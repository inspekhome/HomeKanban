'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createApp,validateState}=require('../app/server'),{seed,categories}=require('../app/seed'),Wording=require('../app/public/wording');
function client(){
 const state=seed(),nodes=new Map();let serial=0,form={text:''},allow=true,fail=false;
 const node=k=>{if(!nodes.has(k))nodes.set(k,{dataset:{},classList:{toggle(){}},addEventListener(){},querySelectorAll:()=>[],focus(){},showModal(){this.open=true;},close(){this.open=false;}});return nodes.get(k);};
 const ctx=vm.createContext({state,categories,Wording,$:node,clone:structuredClone,e:Wording.escape,uid:()=>`fast-${++serial}`,wordingMarkup:()=>'',mountWording(){},disposeWording(){},readWording:()=>structuredClone(form),window:{addEventListener(){}},document:{addEventListener(){}},route:'fast-notes',dirty:0,saved:0,inFlight:null,render(){},status(){},toast(){},saveNow:async()=>{if(fail)throw Error('Test save failure');validateState(state);},commitWorkspaceEdit:async apply=>{const draft=structuredClone(state);apply(draft);if(fail)throw Error('Test save failure');validateState(draft);apply(state);}});
 vm.runInContext(fs.readFileSync(require.resolve('../app/public/bank.js'),'utf8')+fs.readFileSync(require.resolve('../app/public/notes.js'),'utf8')+';confirmNote=async()=>approve();globalThis.h={openFastNote,saveLibraryNote,closeLibrary,deleteLibraryNote,insertBankText,bankFind,updateLibraryStyle,background:value=>libraryEditor.background=value};',Object.assign(ctx,{approve:()=>allow}));
 return {h:ctx.h,state,node,set form(v){form=v;},set approve(v){allow=v;},set fail(v){fail=v;}};
}
test('personal wording can be created, edited, cancelled and deleted without changing report copies',async()=>{
 const c=client();c.form={text:'TEST leak.',textRuns:[{text:'TEST leak.',bold:true,color:'#b42318'}]};c.h.openFastNote();c.h.background('blue');await c.h.saveLibraryNote();
 const first=structuredClone(c.state.noteLibrary[0]);assert.equal(first.title,'TEST leak.');assert.equal(first.background,'blue');assert.equal(first.textRuns[0].bold,true);
 const reportCopy={category:'Recommendation',text:'',photos:[],location:'Roof',includeInSummary:false};c.h.insertBankText(reportCopy,first);assert.equal(reportCopy.text,'TEST leak.');assert.ok(!reportCopy.textRuns);const originalCopy=JSON.stringify(reportCopy);
 c.h.openFastNote(first.id);c.form={text:'Cancelled wording'};c.approve=false;await c.h.closeLibrary();assert.equal(c.node('#library-dialog').open,true);c.approve=true;await c.h.closeLibrary();assert.equal(c.state.noteLibrary[0].text,'TEST leak.');
 c.h.openFastNote(first.id);c.form={text:'Edited wording'};await c.h.saveLibraryNote();assert.equal(c.state.noteLibrary.length,1);assert.equal(c.state.noteLibrary[0].text,'Edited wording');assert.ok(!c.state.noteLibrary[0].textRuns);assert.equal(c.state.noteLibrary[0].background,'blue');
 c.approve=false;await c.h.deleteLibraryNote(first.id);assert.equal(c.state.noteLibrary.length,1);c.approve=true;await c.h.deleteLibraryNote(first.id);assert.equal(c.state.noteLibrary.length,0);assert.equal(JSON.stringify(reportCopy),originalCopy);
});
test('empty wording is rejected and retrying a failed save does not duplicate a note',async()=>{
 const c=client();c.h.openFastNote();c.form={text:'   '};await assert.rejects(c.h.saveLibraryNote(),/Enter your reusable wording/);assert.equal(c.state.noteLibrary.length,0);
 c.form={text:'Retry this note.'};c.fail=true;await assert.rejects(c.h.saveLibraryNote(),/Test save failure/);assert.equal(c.node('#library-dialog').open,true);c.fail=false;await c.h.saveLibraryNote();assert.equal(c.state.noteLibrary.length,1);assert.equal(c.node('#library-dialog').open,false);
});
test('Fast notes append plain text while preserving existing report formatting and all other evidence',()=>{
 const c=client(),original={text:'Existing.',textRuns:[{text:'Existing.',bold:true}],category:'Recommendation',photos:[{src:'test',caption:'Keep'}],sectionId:'s',itemId:'i',location:'Kitchen',includeInSummary:false},draft=structuredClone(original),n={text:'My wording.',textRuns:[{text:'My wording.',italic:true,bold:true,underline:true,color:'#b42318'}],category:'Notes'},bankBefore=JSON.stringify(n);
 c.h.insertBankText(draft,n);c.h.insertBankText(draft,n);assert.equal(draft.text,'Existing.\n\nMy wording.\n\nMy wording.');assert.equal(Wording.render(draft),'<strong>Existing.</strong><br><br>My wording.<br><br>My wording.');assert.equal(JSON.stringify(n),bankBefore);const {text,textRuns,...rest}=draft,{text:_,textRuns:__,...expected}=original;assert.deepEqual(rest,expected);n.textRuns[0].text='Changed later';assert.ok(Wording.render(draft).includes('My wording.'));
 const empty={...original,text:''};c.h.insertBankText(empty,{text:'First',category:'Notes'});assert.equal(empty.category,original.category);
});
test('no imported pack ships or loads; personal notes persist through backup and restart',async()=>{
 assert.ok(!fs.existsSync(path.resolve('app/data/narratives.json')));
 const dataDir=fs.mkdtempSync(path.resolve('work/fast-notes-test-'));let app=createApp({dataDir,port:0});
 try{const before=app.read(),url=await app.start(),home=await(await fetch(url)).text(),token=home.match(/name="solo-token" content="([a-f0-9]+)"/)[1],headers={'X-Solo-Token':token,'Content-Type':'application/json'};
 assert.equal((await fetch(url+'/api/narratives',{headers})).status,404);assert.deepEqual(app.read(),before);
 const bank=await(await fetch(url+'/bank.js')).text();assert.ok(!bank.includes('/api/narratives'));
 before.state.noteLibrary=[{id:'personal',title:'Old personal note',text:'TEST wording',category:categories[3],system:'Roof',topic:'Old metadata',background:'pink'}];
 assert.equal((await fetch(url+'/api/state',{method:'PUT',headers,body:JSON.stringify(before)})).status,200);
 const backup=await(await fetch(url+'/api/backup',{headers})).json();assert.deepEqual(backup.state.noteLibrary,before.state.noteLibrary);await app.close();app=createApp({dataDir,port:0});await app.start();assert.deepEqual(app.read().state.noteLibrary,before.state.noteLibrary);
 }finally{await app.close();}
});
const words=n=>Array.from({length:n},(_,i)=>`word${i+1}`).join(' ');
const personal=i=>({id:`limit-${i}`,title:`Test ${i}`,text:'Test wording.',category:categories[3]});
test('word counts ignore formatting and punctuation, preserving contractions, hyphens and paragraphs',()=>{
 assert.equal(Wording.wordCount(' \n\t— ... !'),0);
 assert.equal(Wording.wordCount("Don't replace well-maintained equipment.\nIt’s 20 years old."),8);
 assert.equal(Wording.wordCount('café\u00a0roof\twall\npipe'),4);
 assert.equal(Wording.wordCount(words(350)),350);
});
test('350 words save with formatting; 351 words cannot change saved wording and the counter recovers',async()=>{
 const c=client();c.h.openFastNote();c.form={text:words(350),textRuns:[{text:words(350),bold:true}]};c.h.updateLibraryStyle();
 assert.equal(c.node('#fast-note-word-count').textContent,'350 / 350 words');assert.equal(c.node('#library-dialog [data-note-action="library-save"]').disabled,false);await c.h.saveLibraryNote();
 const saved=JSON.stringify(c.state.noteLibrary);c.h.openFastNote(c.state.noteLibrary[0].id);c.form={text:words(351)};c.h.updateLibraryStyle();assert.equal(c.node('#library-dialog [data-note-action="library-save"]').disabled,true);assert.match(c.node('#fast-note-word-count').textContent,/351 \/ 350 words.*Shorten/);await assert.rejects(c.h.saveLibraryNote(),/350 words/);assert.equal(JSON.stringify(c.state.noteLibrary),saved);
 c.form={text:'Shortened wording'};c.h.updateLibraryStyle();assert.equal(c.node('#library-dialog [data-note-action="library-save"]').disabled,false);await c.h.saveLibraryNote();assert.equal(c.state.noteLibrary[0].text,'Shortened wording');
});
test('the 50th note saves, the 51st is blocked, editing remains possible and deletion frees a slot',async()=>{
 const c=client();c.state.noteLibrary=Array.from({length:49},(_,i)=>personal(i));c.h.openFastNote();c.form={text:'The fiftieth note.'};await c.h.saveLibraryNote();assert.equal(c.state.noteLibrary.length,50);
 assert.throws(()=>c.h.openFastNote(),/50 fast notes/);c.h.openFastNote('limit-0');c.form={text:'An edited existing note.'};await c.h.saveLibraryNote();assert.equal(c.state.noteLibrary.length,50);
 await c.h.deleteLibraryNote('limit-1');c.h.openFastNote();c.form={text:'A new note in the freed slot.'};await c.h.saveLibraryNote();assert.equal(c.state.noteLibrary.length,50);
});
test('saving checks capacity again if the list fills while an add dialog is open',async()=>{
 const c=client();c.state.noteLibrary=Array.from({length:49},(_,i)=>personal(i));c.h.openFastNote();c.state.noteLibrary.push(personal(49));c.form={text:'Should not be added.'};await assert.rejects(c.h.saveLibraryNote(),/50 fast notes/);assert.equal(c.state.noteLibrary.length,50);
});
test('HTTP save and backup restore enforce both boundaries atomically',async()=>{
 const dataDir=fs.mkdtempSync(path.resolve('work/fast-note-limits-test-')),app=createApp({dataDir,port:0});
 try{
  const url=await app.start(),home=await(await fetch(url)).text(),token=home.match(/name="solo-token" content="([a-f0-9]+)"/)[1],headers={'X-Solo-Token':token,'Content-Type':'application/json'};
  const initial=app.read();initial.state.noteLibrary=Array.from({length:50},(_,i)=>personal(i));initial.state.noteLibrary[0].text=words(350);initial.state.noteLibrary[0].textRuns=[{text:words(350),bold:true}];
  assert.equal((await fetch(url+'/api/state',{method:'PUT',headers,body:JSON.stringify(initial)})).status,200);const before=app.read();
  for(const mutation of [s=>s.noteLibrary.push(personal(50)),s=>{s.noteLibrary[0].text=words(351);delete s.noteLibrary[0].textRuns;}]){
   const state=structuredClone(before.state);mutation(state);
   for(const restore of [false,true]){
    const body=restore?{revision:before.revision,backup:{format:'soloinspect-backup',state}}:{revision:before.revision,state};
    const response=await fetch(url+(restore?'/api/restore':'/api/state'),{method:restore?'POST':'PUT',headers,body:JSON.stringify(body)});assert.equal(response.status,400);assert.match((await response.json()).error,/50 fast notes|350 words/);assert.deepEqual(app.read(),before);
   }
  }
 }finally{await app.close();}
});
