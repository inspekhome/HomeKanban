'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const {seed,categories}=require('../app/seed'),{validateState}=require('../app/server'),{reportHTML}=require('../app/report');
function client(summaryOnly=false){
 const state=seed(),t=state.templates[0],s=t.sections[0];
 const f={id:'toggle-note',origin:summaryOnly?'summary':'checklist',includeInSummary:true,location:'TEST location',category:categories[3],text:'TEST inclusion narrative.',photos:[{src:'data:image/png;base64,iVBORw0KGgo=',caption:'Keep this caption'}],...(!summaryOnly?{sectionId:s.id,itemId:s.items[0].id}:{})};
 const r={id:'toggle-report',address:'TEST property',client:'TEST client',email:'',phone:'',date:'2026-10-24',time:'',weather:'',notes:'',scope:'Test only',notice:t.notice,status:'draft',inspector:{...state.profile,name:'Test'},sections:structuredClone(t.sections),findings:[f]};state.reports.push(r);
 const nodes=new Map(),events=new Map(),jumps=[];
 const node=key=>{if(!nodes.has(key))nodes.set(key,{style:{},classList:{toggle(){},remove(){}},addEventListener:(name,fn)=>events.set(key+':'+name,fn),querySelector:node,setAttribute(){},focus(){},showModal(){this.open=true;},close(){this.open=false;}});return nodes.get(key);};
 const ctx=vm.createContext({PhotoEditor:require('../app/public/photo-editor'),Wording:require('../app/public/wording'),wordingMarkup:()=>'',mountWording(){},disposeWording(){},$:node,state,categories,report:()=>r,clone:structuredClone,uid:()=>'new-toggle-note',e:String,bankMarkup:()=>'',addFastNoteButton:()=>'',findingComponent:(r,f)=>{const section=r.sections.find(s=>s.id===f.sectionId),item=section?.items.find(i=>i.id===f.itemId);return item?{section,item}:null;},window:{innerWidth:1600,innerHeight:1000,addEventListener(){}},localStorage:{getItem:()=>null,setItem(){}},document:{addEventListener:(name,fn)=>events.set('document:'+name,fn)},changed(){},render(){},jumpTo:id=>jumps.push(id),saveNow:async()=>validateState(state),toast(){}});
 vm.runInContext(fs.readFileSync(require.resolve('../app/public/notes.js'),'utf8')+';globalThis.h={open:openNote,save:saveNote,close:closeNote,get draft(){return noteEditor.draft;}};',ctx);
 return {h:ctx.h,state,r,f,node,jumps,toggle:checked=>events.get('document:input')({target:{dataset:{noteField:'includeInSummary'},type:'checkbox',checked}})};
}
test('a checklist note edited from a summary can be excluded and restored without losing its source or photos',async()=>{
 const c=client();c.h.open(c.f.id,null,null,'summary-'+c.f.id);const original=JSON.stringify(c.f);c.toggle(false);assert.equal(JSON.stringify(c.f),original);await c.h.save();
 assert.equal(c.r.findings[0].includeInSummary,false);assert.equal(c.r.findings[0].sectionId,c.f.sectionId);assert.deepEqual(c.r.findings[0].photos,c.f.photos);assert.equal(c.r.findings[0].location,c.f.location);
 let html=reportHTML(c.r);assert.equal(html.split(c.f.text).length-1,1);assert.ok(html.includes('id="check-finding-toggle-note"'));assert.ok(!html.includes('id="summary-toggle-note"'));
 c.h.open(c.f.id);c.toggle(true);await c.h.save();html=reportHTML(c.r);assert.equal(html.split(c.f.text).length-1,3);
});
test('an existing summary-only note stays included, while cancelling preserves the saved report',async()=>{
 const c=client(true),before=JSON.stringify(c.r.findings);c.h.open(c.f.id);
 const markup=c.node('#note-dialog').innerHTML,switchTag=markup.match(/<input[^>]+data-note-field="includeInSummary"[^>]*>/)[0];
 assert.match(switchTag,/checked/);assert.match(switchTag,/disabled/);assert.ok(markup.includes('Always included in both summaries'));
 c.toggle(false);assert.equal(c.h.draft.origin,'summary');assert.equal(c.h.draft.includeInSummary,true);await c.h.close(true);assert.equal(JSON.stringify(c.r.findings),before);
 c.h.open(c.f.id);c.toggle(false);await c.h.save();const saved=c.r.findings[0];assert.equal(saved.origin,'summary');assert.equal(saved.includeInSummary,true);assert.deepEqual(saved.photos,c.f.photos);assert.equal(saved.location,c.f.location);
 const html=reportHTML(c.r);assert.ok(!html.includes('id="check-finding-toggle-note"'));assert.equal(html.split(c.f.text).length-1,2);assert.equal(c.jumps.at(-1),'finding-toggle-note');
});

test('a new summary note cannot be excluded, including through a changed draft before saving',async()=>{
 const c=client();c.h.open(null,null,null,null,'summary');const markup=c.node('#note-dialog').innerHTML;assert.match(markup,/<input[^>]+data-note-field="includeInSummary"[^>]*checked disabled/);assert.ok(!markup.includes('Save to My Notes'));
 c.h.draft.text='New summary-origin test.';c.toggle(false);assert.equal(c.h.draft.includeInSummary,true);
 c.h.draft.includeInSummary=false;c.h.draft.origin='checklist';await c.h.save();assert.equal(c.r.findings[1].origin,'summary');assert.equal(c.r.findings[1].includeInSummary,true);assert.equal(reportHTML(c.r).split('New summary-origin test.').length-1,2);
});

test('new System checks notes retain an enabled switch and can be saved without inclusion',async()=>{
 const c=client(),section=c.r.sections[0];c.h.open(null,section.id,section.items[0].id);
 const markup=c.node('#note-dialog').innerHTML,switchTag=markup.match(/<input[^>]+data-note-field="includeInSummary"[^>]*>/)[0];assert.ok(!switchTag.includes('disabled'));
 c.h.draft.text='Checklist only test.';c.toggle(false);await c.h.save();const saved=c.r.findings[1];assert.equal(saved.origin,'checklist');assert.equal(saved.includeInSummary,false);assert.equal(saved.itemId,section.items[0].id);assert.equal(reportHTML(c.r).split('Checklist only test.').length-1,1);
});
