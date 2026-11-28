'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {seed,ratings,categories}=require('../app/seed');
const {createApp,validateState}=require('../app/server');
const {reportHTML}=require('../app/report');
function client(){
 const state=seed(),events=new Map(),nodes=new Map(),confirmations=[],shownDialogs=[];let approved=true;state.profile.name='Synthetic inspector';
 const node=key=>{if(!nodes.has(key))nodes.set(key,{content:'test-token',textContent:'',innerHTML:'',style:{},dataset:{},classList:{toggle(){}},addEventListener(){},focus(){},showModal(){shownDialogs.push(key);},close(){}});return nodes.get(key);};
 const context=vm.createContext({Wording:require('../app/public/wording'),crypto:globalThis.crypto,structuredClone,initialState:state,initialRatings:ratings,initialCategories:categories,setTimeout:()=>1,clearTimeout(){},document:{querySelector:node,getElementById:node,addEventListener:(name,fn)=>events.set(name,fn)},window:{addEventListener(){}},confirmNote:async(message)=>{confirmations.push(message);return approved;}});
 const source=fs.readFileSync(require.resolve('../app/public/app.js'),'utf8');
 vm.runInContext(source.slice(0,source.lastIndexOf('\nboot().catch'))+`
 state=initialState;ratings=initialRatings;categories=initialCategories;
 const sample=blankReport(state.templates[0],{address:'SYNTHETIC',client:'Test client',scope:'Test only'});state.reports.push(sample);route='editor';currentId=sample.id;render=()=>{};
 globalThis.harness={get r(){return report();},get dirty(){return dirty;},remove:removeReportComponent,html:()=>renderSystemChecks(report()),blank:()=>blankReport(state.templates[0]),templateMode(){route='template-editor';currentId=state.templates[0].id;sectionId=state.templates[0].sections[0].id;},draft(id,choices){choiceDraft={templateId:currentId,sectionId,itemId:id,choices};},edit:editChoices,saveChoices,kind:choiceKind};`,context);
 return {state,h:context.harness,node,confirmations,shownDialogs,approve:value=>approved=value,click:dataset=>events.get('click')({target:{closest:()=>({dataset,isConnected:false})}})};
}
test('template choices and colors are independent report snapshots with blank selections',()=>{
 const c=client(),t=c.state.templates[0],i=t.sections[0].items[0];i.options=['Wood','Operated','Damaged','Equipment age'];i.choiceTypes={Wood:'description',Operated:'normal',Damaged:'concern','Equipment age':'note'};i.selected=['Damaged','Equipment age'];i.rating='D';
 const r=c.h.blank(),copy=r.sections[0].items[0];assert.deepEqual(copy.options,i.options);assert.deepEqual(copy.choiceTypes,i.choiceTypes);assert.equal(copy.selected.length,0);assert.equal(copy.rating,'');
 i.choiceTypes.Wood='concern';i.choiceTypes['Equipment age']='description';assert.equal(copy.choiceTypes.Wood,'description');assert.equal(copy.choiceTypes['Equipment age'],'note');assert.equal(c.h.kind({options:['Old material']},'Old material'),'description');
});
test('every choice is exported, checked states are explicit, and old custom selections remain visible',()=>{
 const c=client(),i=c.h.r.sections[0].items[0];i.options=['Wood','Operated','Damaged <surface>','Equipment age <recorded>','Water heater age'];i.choiceTypes={Wood:'description',Operated:'normal','Damaged <surface>':'concern','Equipment age <recorded>':'note','Water heater age':'note'};i.selected=['Wood','Damaged <surface>','Equipment age <recorded>','Custom old selection'];
 const html=reportHTML(c.h.r);assert.ok(html.includes('aria-label="Wood: selected"'));assert.ok(html.includes('aria-label="Operated: not selected"'));assert.ok(html.includes('aria-label="Damaged &lt;surface&gt;: selected"'));assert.ok(html.includes('aria-label="Custom old selection: selected"'));assert.ok(!html.includes('<surface>'));
 assert.match(html,/class="report-choice " data-choice-type="normal"/);assert.match(html,/class="report-choice selected" data-choice-type="concern"/);assert.ok(html.includes('only checked choices apply'));
 assert.match(html,/class="report-choice selected" data-choice-type="note" role="img" aria-label="Equipment age &lt;recorded&gt;: selected"/);assert.match(html,/class="report-choice " data-choice-type="note" role="img" aria-label="Water heater age: not selected"/);assert.ok(!html.includes('<recorded>'));
});
test('editing template choices validates duplicates and saves types without rewriting an existing report',()=>{
 const c=client(),before=structuredClone(c.state.reports),item=c.state.templates[0].sections[0].items[0];c.h.templateMode();
 const original=structuredClone(item);c.h.draft(item.id,[{text:'Wood',kind:'description'},{text:' Wood ',kind:'concern'}]);c.h.saveChoices();assert.deepEqual(item,original);assert.match(c.node('#choice-error').textContent,/different label/);
 c.h.draft(item.id,[{text:'Wood',kind:'description'},{text:'Operated',kind:'normal'},{text:'Damaged',kind:'concern'},{text:'Equipment age',kind:'note'}]);c.h.saveChoices();assert.deepEqual(Array.from(item.options),['Wood','Operated','Damaged','Equipment age']);assert.equal(item.choiceTypes.Damaged,'concern');assert.equal(item.choiceTypes['Equipment age'],'note');assert.deepEqual(structuredClone(c.state.reports),before);assert.doesNotThrow(()=>validateState(c.state));
 const next=c.h.blank().sections[0].items[0];assert.equal(next.choiceTypes['Equipment age'],'note');assert.equal(next.selected.length,0);assert.equal(next.note,'');
 c.h.edit(item.id);assert.match(c.node('#choice-rows').innerHTML,/<option value="note" selected>Note<\/option>/);
});

test('Note choices toggle independently of inspection ratings without opening a dialog or requiring a note',async()=>{
 const c=client(),r=c.h.r,i=r.sections[0].items[0];i.options=['Equipment age'];i.choiceTypes={'Equipment age':'note'};i.selected=[];i.note='';const findings=structuredClone(r.findings);
 for(const rating of ['', 'I', 'NI', 'NP', 'D']){
  i.rating=rating;await c.click({option:'0',item:i.id});assert.deepEqual(Array.from(i.selected),['Equipment age']);assert.equal(i.rating,rating);assert.equal(i.note,'');assert.doesNotThrow(()=>validateState(c.state));
  if(rating===''){const html=c.h.html();assert.match(html,/class="chip choice-chip selected" data-choice-type="note"[^>]*aria-pressed="true" title="Note"/);assert.ok(!html.includes('aria-required="true"'));}
  await c.click({option:'0',item:i.id});assert.equal(i.selected.length,0);assert.equal(i.rating,rating);
 }
 assert.deepEqual(c.confirmations,[]);assert.deepEqual(c.shownDialogs,[]);assert.deepEqual(structuredClone(r.findings),findings);
});
test('report-local removal retains linked text and photos without an undo banner',async()=>{
 const c=client(),r=c.h.r,s=r.sections[0],item=s.items[1],templates=structuredClone(c.state.templates);item.selected=['Concrete'];item.note='Keep observation';
 const f={id:'linked-note',sectionId:s.id,itemId:item.id,origin:'checklist',includeInSummary:true,location:'Foundation',category:categories[0],text:'Preserve this finding.',photos:[{src:'data:image/png;base64,dGVzdA==',caption:'Preserve this photo'}]};r.findings.push(f);
 const original=structuredClone(r);await c.click({action:'remove-report-component',sectionId:s.id,itemId:item.id});assert.equal(s.items.length,original.sections[0].items.length-1);assert.equal(f.itemId,undefined);assert.equal(f.sectionId,undefined);assert.equal(f.text,original.findings[0].text);assert.deepEqual(f.photos,original.findings[0].photos);assert.deepEqual(c.state.templates,templates);assert.equal(r.status,'draft');assert.doesNotThrow(()=>validateState(c.state));
 assert.equal(c.confirmations.length,1);assert.ok(!c.confirmations[0].includes('undo'));
 const html=reportHTML(r);assert.match(html,/<h3>Other observations<\/h3>/);assert.ok(html.includes('id="summary-linked-note"'));assert.ok(html.includes('id="check-finding-linked-note"'));
 assert.ok(!c.h.html().includes('Undo removal'));assert.ok(!c.h.html().includes('component-undo'));assert.ok(!s.items.some(i=>i.id===item.id));
});
test('removed components do not interfere with subsequent note edits or other component associations',()=>{
 const c=client(),r=c.h.r,s=r.sections[0],item=s.items[0],other=s.items[1];r.findings.push({id:'test-note',sectionId:s.id,itemId:item.id,location:'',category:categories[0],text:'Before',photos:[]});c.h.remove(s.id,item.id);
 r.findings[0].text='Edited after removal';r.findings[0].sectionId=s.id;r.findings[0].itemId=other.id;assert.equal(r.findings[0].text,'Edited after removal');assert.equal(r.findings[0].itemId,other.id);assert.equal(c.h.remove('missing','missing'),false);
});
test('optional choice colors validate strictly while existing templates without them remain valid',()=>{
 const c=client(),i=c.h.r.sections[0].items[0];assert.doesNotThrow(()=>validateState(c.state));
 for(const invalid of [null,[],5,{'no-such-choice':'normal'},{[i.options[0]]:'red'}]){i.choiceTypes=invalid;assert.throws(()=>validateState(c.state),/choice color/i);}
 for(const kind of ['description','normal','concern','note']){i.choiceTypes={[i.options[0]]:kind};assert.doesNotThrow(()=>validateState(c.state));}
});
test('compact directory keeps status indicators and accessible completion information without count columns',()=>{
 const c=client(),s=c.h.r.sections[0];s.items.forEach(i=>i.rating='I');const html=c.h.html();assert.ok(!html.includes('class="count"'));assert.ok(html.includes('report-section-handle is-complete'));assert.ok(html.includes('report-section-handle is-incomplete'));assert.ok(html.includes('All statuses selected'));assert.ok(!html.includes('class="system-number"'));assert.ok(html.includes('class="square-grip-icon"'));assert.ok(html.includes('class="system-label">Structure'));
});
test('choice metadata persists through HTTP save, backup, restore and a process restart',async()=>{
 const c=client(),i=c.state.templates[0].sections[0].items[0];i.options=['Operated','Equipment age'];i.choiceTypes={Operated:'normal','Equipment age':'note'};const next=c.h.blank();c.state.reports.push(next);const reportItem=next.sections[0].items[0];reportItem.selected=['Equipment age'];const before=structuredClone(c.state);const base=path.resolve('work/tests');fs.mkdirSync(base,{recursive:true});const dataDir=fs.mkdtempSync(path.join(base,'choice-colors-'));let app=createApp({dataDir,port:0});
 try{const url=await app.start(),home=await(await fetch(url)).text(),headers={'X-Solo-Token':home.match(/name="solo-token" content="([a-f0-9]+)"/)[1],'Content-Type':'application/json'};
  let res=await fetch(url+'/api/state',{method:'PUT',headers,body:JSON.stringify({state:c.state,revision:0})});assert.equal(res.status,200);
  const backup=await(await fetch(url+'/api/backup',{headers})).json();assert.deepEqual(backup.state.templates[0].sections[0].items[0].choiceTypes,i.choiceTypes);assert.deepEqual(backup.state.reports,before.reports);
  res=await fetch(url+'/api/restore',{method:'POST',headers,body:JSON.stringify({backup,revision:1})});assert.equal(res.status,200);
  await app.close();app=createApp({dataDir,port:0});await app.start();assert.equal(app.read().revision,2);assert.deepEqual(app.read().state.templates[0].sections[0].items[0].choiceTypes,i.choiceTypes);assert.deepEqual(app.read().state.reports,before.reports);
 }finally{await app.close();}
});

 test('cancelling component removal leaves the report and evidence unchanged',async()=>{
 const c=client(),r=c.h.r,s=r.sections[0],before=structuredClone(c.state);c.approve(false);
 await c.click({action:'remove-report-component',sectionId:s.id,itemId:s.items[0].id});
 assert.equal(c.confirmations.length,1);assert.deepEqual(structuredClone(c.state),before);
 });
