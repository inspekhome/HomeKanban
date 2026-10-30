'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {seed}=require('../app/seed');
function client(){
 const state=seed(),node={content:'test',textContent:'',style:{},classList:{toggle(){}},addEventListener(){}},writes=[];
 const context=vm.createContext({initialState:state,structuredClone,crypto:globalThis.crypto,setTimeout:()=>1,clearTimeout(){},document:{readyState:'complete',querySelector:()=>node,addEventListener(){}},window:{addEventListener(){}},testWrite:(body)=>writes.push(structuredClone(body))});
 const source=fs.readFileSync(require.resolve('../app/public/app.js'),'utf8');
 vm.runInContext(source.slice(0,source.lastIndexOf('\nboot().catch'))+`
 state=initialState;revision=0;state.profile.name='Synthetic Inspector';
 api=async(url,method,body)=>{if(method==='PUT'){testWrite(body);return {revision:revision+1};}return {state,revision,categories:[],ratings:{},dataDir:'test'};};
 render=()=>{};applySystemTheme=()=>{};
 globalThis.h={boot,saveNow,blank:values=>blankReport(state.templates[0],values),
 order:()=>[...renderReports().matchAll(/<tr data-report-id="([^"]+)"/g)].map(m=>m[1]),
 edit(id){route='editor';currentId=id;changed();},search(value){search=value;},
 get dirty(){return dirty;}};`,context);
 return {state,h:context.h,writes,order:()=>Array.from(context.h.order())};
}
test('library sorts newest creation first, independently of inspection and last-edit dates',()=>{
 const c=client();c.state.reports.push(
  c.h.blank({id:'old',created:'2026-10-01T10:00:00Z',updated:'2026-12-01T10:00:00Z',date:'2026-12-02'}),
  c.h.blank({id:'new',created:'2026-10-03T10:00:00Z',updated:'2026-10-03T10:00:00Z',date:'2026-09-01'}),
  c.h.blank({id:'middle',created:'2026-10-02T10:00:00Z',date:'2026-11-01'}));
 const original=c.state.reports.map(r=>r.id);assert.deepEqual(c.order(),['new','middle','old']);
 assert.deepEqual(c.state.reports.map(r=>r.id),original,'rendering must not mutate stored order');
});
test('editing and saving an old report retains its creation timestamp and library position',async()=>{
 const c=client(),old=c.h.blank({id:'old',created:'2026-10-01T10:00:00Z',updated:'2026-10-01T10:00:00Z'});
 c.state.reports.push(old,c.h.blank({id:'new',created:'2026-10-02T10:00:00Z'}));
 const order=c.order();old.notes='Edited after the newer report';c.h.edit('old');await c.h.saveNow();
 assert.notEqual(old.updated,'2026-10-01T10:00:00Z');assert.equal(old.created,'2026-10-01T10:00:00Z');
 assert.deepEqual(c.order(),order);assert.equal(c.writes[0].state.reports[0].created,old.created);
 old.status='final';old.paymentStatus='paid';assert.deepEqual(c.order(),order);
});
test('legacy report dates are frozen on load, survive save/reload, and never use modified time',async()=>{
 const c=client(),old=c.h.blank({id:'legacy-old',date:'2026-10-01',updated:'2099-12-31T00:00:00Z'}),recent=c.h.blank({id:'legacy-new',date:'2026-10-05'});
 delete old.created;delete recent.created;c.state.reports.push(old,recent);
 await c.h.boot();assert.equal(c.h.dirty,0);assert.equal(c.writes.length,0);
 assert.equal(old.creationDateFallback,'2026-10-01');assert.equal(old.created,undefined);
 assert.deepEqual(c.order(),['legacy-new','legacy-old']);
 old.date='2099-10-01';c.h.edit(old.id);await c.h.saveNow();
 const restored=client();restored.state.reports=c.writes[0].state.reports;await restored.h.boot();
 assert.deepEqual(restored.order(),['legacy-new','legacy-old']);
 assert.equal(restored.state.reports[0].creationDateFallback,'2026-10-01');
});
test('same-day timestamps use time order and equal or missing timestamps remain stable',async()=>{
 const c=client();c.state.reports.push(
  c.h.blank({id:'morning',created:'2026-10-29T08:00:00-04:00'}),
  c.h.blank({id:'afternoon',created:'2026-10-29T17:00:00Z'}),
  c.h.blank({id:'same-time',created:'2026-10-29T17:00:00Z'}),
  c.h.blank({id:'missing',created:undefined,date:'',updated:'2099-01-01T00:00:00Z'}),
  c.h.blank({id:'invalid',created:'invalid',date:'not-a-date',updated:'2099-02-01T00:00:00Z'}));
 await c.h.boot();const expected=['afternoon','same-time','morning','missing','invalid'];assert.deepEqual(c.order(),expected);
 c.state.reports[3].date='2099-01-01';assert.deepEqual(c.order(),expected);
});
test('search preserves creation ordering and new reports record a fixed creation timestamp',()=>{
 const c=client(),before=Date.now(),fresh=c.h.blank({id:'fresh',address:'Match New'}),after=Date.now();
 assert.ok(Date.parse(fresh.created)>=before&&Date.parse(fresh.created)<=after);assert.equal(fresh.created,fresh.updated);
 c.state.reports.push(c.h.blank({id:'old',created:'2001-01-01T00:00:00Z',address:'Match Old'}),fresh,
  c.h.blank({id:'other',created:'2099-01-01T00:00:00Z',address:'Other'}));
 c.h.search('match');assert.deepEqual(c.order(),['fresh','old']);
});
