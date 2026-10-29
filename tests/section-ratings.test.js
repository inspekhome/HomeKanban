'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {seed,ratings,categories}=require('../app/seed');
const {issues}=require('../app/report');

// Run the real click listener with synthetic DOM nodes and an isolated report.
function client(){
 const events=new Map(),nodes=new Map();
 const node=key=>{if(!nodes.has(key))nodes.set(key,{content:'test-token',textContent:'',style:{},classList:{toggle(){}},addEventListener(){},focus(){}});return nodes.get(key);};
 const state=seed(),r={id:'test-report',address:'TEST ONLY',client:'Test Client',scope:'Software test only',date:'2026-10-24',inspector:{name:'Test Inspector'},status:'final',updated:'before',sections:structuredClone(state.templates[0].sections),findings:[{id:'note1',location:'Test',category:'Notes',text:'Keep this note',photos:[{src:'data:image/png;base64,dGVzdA==',caption:'Keep this caption'}]}]};
 for(const s of r.sections)for(const i of s.items)i.rating='I';
 state.reports.push(r);
 const context=vm.createContext({Wording:require('../app/public/wording'),structuredClone,initialState:state,initialRatings:ratings,initialCategories:categories,setTimeout:()=>1,clearTimeout(){},document:{querySelector:node,getElementById:node,addEventListener:(name,fn)=>events.set(name,fn)},window:{addEventListener(){}}});
 const source=fs.readFileSync(require.resolve('../app/public/app.js'),'utf8');
 vm.runInContext(source.slice(0,source.lastIndexOf('\nboot().catch'))+`
 state=initialState;ratings=initialRatings;categories=initialCategories;route='editor';currentId='test-report';render=()=>{};
 globalThis.harness={get dirty(){return dirty;},html:()=>renderSystemChecks(report())};`,context);
 return {state,r,h:context.harness,click:dataset=>events.get('click')({target:{closest:()=>({dataset,id:'test-button',isConnected:false})}})};
}

test('all four section buttons affect only their section and preserve inspection evidence',async()=>{
 for(const rating of Object.keys(ratings)){
  const c=client(),target=c.r.sections[5],item=target.items[0];
  target.items.forEach((i,n)=>i.rating=['','NI','NP','D'][n%4]);
  item.note='Keep field note';item.limitation='Keep reason';item.selected=['Custom material'];
  const before=structuredClone(c.state);
  await c.click({sectionRating:rating,sectionId:target.id});
  assert.ok(target.items.every(i=>i.rating===rating));
  const expected=before.reports[0];expected.sections[5].items.forEach(i=>i.rating=rating);expected.status='draft';expected.updated=c.r.updated;
  assert.deepEqual(c.r,expected);assert.deepEqual(c.state.templates,before.templates);assert.equal(c.h.dirty,1);
 }
});

test('all four headers toggle their entire section off and on without changing other data',async()=>{
 for(const rating of Object.keys(ratings)){
  const c=client(),s=c.r.sections[0];s.items.forEach(i=>i.rating='');
  s.items[0].note='Keep observation';s.items[0].limitation='Keep limitation';s.items[0].selected=['Keep material'];
  const before=structuredClone(c.state);
  await c.click({sectionRating:rating,sectionId:s.id});assert.ok(s.items.every(i=>i.rating===rating));
  await c.click({sectionRating:rating,sectionId:s.id});assert.ok(s.items.every(i=>i.rating===''));
  const expected=before.reports[0];expected.status='draft';expected.updated=c.r.updated;
  assert.deepEqual(c.r,expected);assert.deepEqual(c.state.templates,before.templates);assert.equal(c.h.dirty,2);
  assert.equal(issues(c.r).filter(x=>x.includes('inspection status not recorded')).length,s.items.length);
  await c.click({sectionRating:rating,sectionId:s.id});assert.ok(s.items.every(i=>i.rating===rating));
 }
});

test('individual adjustments remain possible and a mixed section is selected before it can be cleared',async()=>{
 const c=client(),s=c.r.sections[0],item=s.items[0];
 await c.click({sectionRating:'NP',sectionId:s.id});
 assert.equal(c.h.dirty,1);assert.ok(s.items.every(i=>i.rating==='NP'));
 await c.click({rating:'D',item:item.id});
 assert.equal(item.rating,'D');assert.ok(s.items.slice(1).every(i=>i.rating==='NP'));
 await c.click({sectionRating:'NP',sectionId:s.id});assert.ok(s.items.every(i=>i.rating==='NP'));
 await c.click({rating:'D',item:item.id});
 await c.click({rating:'D',item:item.id});assert.equal(item.rating,'');
 await c.click({sectionRating:'I',sectionId:s.id});assert.ok(s.items.every(i=>i.rating==='I'));
});

test('clearing statuses reopens a finalized report and section NI selections still require reasons',async()=>{
 const c=client(),s=c.r.sections[0];
 await c.click({sectionRating:'I',sectionId:s.id});assert.equal(c.r.status,'draft');assert.equal(c.h.dirty,1);assert.ok(s.items.every(i=>i.rating===''));
 await c.click({sectionRating:'NI',sectionId:s.id});
 assert.equal(issues(c.r).filter(x=>x.includes('a reason is required for Not Inspected')).length,s.items.length);
 assert.equal(c.r.status,'draft');
});

test('headers expose enabled named buttons for every populated section and reflect mixed states',async()=>{
 const c=client(),s=c.r.sections[0];
 let html=c.h.html();assert.equal((html.match(/data-section-rating=/g)||[]).length,c.r.sections.length*4);
 assert.equal((html.match(/class="checklist-heading"><b>COMPONENT \/ NOTES<\/b>/g)||[]).length,c.r.sections.length);
 assert.equal((html.match(/aria-label="Inspection status definitions"/g)||[]).length,c.r.sections.length);
 const rows=html.split('<div class="check-row ').slice(1);
 assert.equal(rows.length,c.r.sections.reduce((count,section)=>count+section.items.length,0));
 for(const row of rows){assert.ok(row.indexOf('class="component-body"')<row.indexOf('class="rating-group"'));assert.match(row,/<\/div><div class="rating-group" role="group"/);}
 assert.match(html,/aria-label="Structure: clear all I = Inspected selections" aria-pressed="true"/);
 assert.ok(!html.includes('class="checklist-columns" aria-hidden="true"'));
 await c.click({rating:'D',item:s.items[0].id});html=c.h.html();
 assert.match(html,/aria-label="Structure: set all to I = Inspected" aria-pressed="false"/);
 const before=structuredClone(c.r);await c.click({sectionRating:'unknown',sectionId:s.id});await c.click({sectionRating:'D',sectionId:'missing'});assert.deepEqual(c.r,before);
 s.items=[];assert.match(c.h.html(),/aria-label="Structure: set all to I = Inspected" aria-pressed="false" disabled/);
});

