'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {seed,categories}=require('../app/seed'),{workspaceClient}=require('./helpers/workspace-client.cjs');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function client(existing=true){const state=seed();if(existing)state.noteLibrary=[{id:'existing-fast',title:'Original.',text:'Original.',category:categories[3],background:'white'}];return workspaceClient({state});}

for(const existing of [true,false])test(`Fast note ${existing?'edit':'creation'} keeps later typing, formatting and background changes after a pending save`,async()=>{
 const c=client(existing);c.h.openFastNote(existing?'existing-fast':null);c.form={text:'First saved words.'};const first=c.h.saveLibraryNote();
 assert.equal(c.h.editor.busy,true);assert.equal(c.state.noteLibrary.length,existing?1:0);assert.equal(c.state.noteLibrary[0]?.text,existing?'Original.':undefined);
 c.form={text:'First saved words. Additional words.',textRuns:[{text:'First saved words. '},{text:'Additional words.',bold:true,color:'#b42318'}]};c.h.editor.background='blue';
 c.requests[0].reply();await first;
 assert.equal(c.node('#library-dialog').open,true);assert.equal(c.h.libraryChanged(),true);assert.equal(c.h.editor.busy,false);assert.equal(c.state.noteLibrary.length,1);assert.equal(c.disk.noteLibrary[0].text,'First saved words.');
 const id=c.disk.noteLibrary[0].id,second=c.h.saveLibraryNote();c.requests[1].reply();await second;
 assert.equal(c.node('#library-dialog').open,false);assert.equal(c.disk.noteLibrary.length,1);assert.equal(c.disk.noteLibrary[0].id,id);assert.equal(c.disk.noteLibrary[0].text,c.form.text);assert.equal(c.disk.noteLibrary[0].textRuns[1].bold,true);assert.equal(c.disk.noteLibrary[0].background,'blue');
});

for(const existing of [true,false])test(`failed Fast note ${existing?'edit':'creation'} then discard never leaks into a later workspace save`,async()=>{
 const c=client(existing),original=structuredClone(c.state.noteLibrary);c.state.profile.name='Keep unrelated profile edit';c.h.changed();
 c.h.openFastNote(existing?'existing-fast':null);c.form={text:'Discard this attempt.'};const pending=c.h.saveLibraryNote();c.requests[0].reply(500);await assert.rejects(pending,/Simulated disk failure/);
 assert.deepEqual(c.state.noteLibrary,original);assert.equal(c.node('#library-dialog').open,true);await c.h.closeLibrary();assert.equal(c.node('#library-dialog').open,false);
 const later=c.h.saveNow();c.requests[1].reply();await later;
 assert.deepEqual(c.disk.noteLibrary,original);assert.equal(c.disk.profile.name,'Keep unrelated profile edit');assert.equal(c.h.dirty,c.h.saved);
});

test('a failed second Fast note save can be discarded without reverting the first successful save',async()=>{
 const c=client();c.h.openFastNote('existing-fast');c.form={text:'First success.'};const first=c.h.saveLibraryNote();c.form={text:'New unsaved text.'};c.requests[0].reply();await first;
 const second=c.h.saveLibraryNote();c.requests[1].reply(500);await assert.rejects(second);await c.h.closeLibrary();await c.h.saveNow();
 assert.equal(c.disk.noteLibrary[0].text,'First success.');assert.equal(c.state.noteLibrary[0].text,'First success.');assert.equal(c.requests.length,2);assert.equal(c.node('#save-status').textContent,'✓ Saved locally');
});

test('new report creation can fail repeatedly and retry without duplicate or abandoned reports',async()=>{
 const c=client();c.node('#new-template-id').value=c.state.templates[0].id;c.node('#new-address').value='Synthetic retry test';c.node('#new-client').value='Test client';c.node('#new-date').value='2026-10-27';
 for(let i=0;i<3;i++){const attempt=c.click('create-report');assert.equal(c.state.reports.length,0);assert.equal(JSON.parse(c.requests[i].options.body).state.reports.length,1);c.requests[i].reply(500);await attempt;assert.equal(c.state.reports.length,0);assert.equal(c.disk.reports.length,0);}
 const retry=c.click('create-report');c.requests[3].reply();await retry;assert.equal(c.state.reports.length,1);assert.equal(c.disk.reports.length,1);assert.equal(c.disk.reports[0].address,'Synthetic retry test');
});

test('draft commits serialize with autosave and preserve edits made while each request is pending',async()=>{
 const c=client();c.state.profile.name='Before autosave';c.h.changed();const first=c.h.saveNow();
 c.h.openFastNote('existing-fast');c.form={text:'Committed note'};const draft=c.h.saveLibraryNote();assert.equal(c.requests.length,1);
 c.state.profile.phone='Before draft snapshot';c.h.changed();c.requests[0].reply();await tick();assert.equal(c.requests.length,2);c.requests[1].reply();await first;await tick();assert.equal(c.requests.length,3);
 c.state.profile.email='after-snapshot@example.invalid';c.h.changed();const later=c.h.saveNow();c.requests[2].reply();await draft;await tick();assert.equal(c.requests.length,4);c.requests[3].reply();await later;
 assert.equal(c.disk.noteLibrary[0].text,'Committed note');assert.equal(c.disk.profile.name,'Before autosave');assert.equal(c.disk.profile.phone,'Before draft snapshot');assert.equal(c.disk.profile.email,'after-snapshot@example.invalid');assert.equal(c.h.revision,4);assert.equal(c.h.saved,c.h.dirty);
});

test('a queued autosave cannot publish a failed, cancelled draft',async()=>{
 const c=client();c.h.openFastNote('existing-fast');c.form={text:'Never commit this draft'};const draft=c.h.saveLibraryNote();c.state.profile.name='Retain this edit';c.h.changed();const autosave=c.h.saveNow();
 const rejected=Promise.all([assert.rejects(draft,/Simulated/),assert.rejects(autosave,/Simulated/)]);c.requests[0].reply(500);await rejected;await c.h.closeLibrary();const retry=c.h.saveNow();c.requests[1].reply();await retry;
 assert.equal(c.disk.noteLibrary[0].text,'Original.');assert.equal(c.disk.profile.name,'Retain this edit');
});

test('closing the page warns while a staged save is pending even with no earlier dirty changes',async()=>{
 const c=client();let prevented=false;const pending=c.h.commitWorkspaceEdit(s=>s.profile.name='Pending');assert.equal(c.h.dirty,c.h.saved);c.events.get('window:beforeunload')[0]({preventDefault(){prevented=true;}});assert.equal(prevented,true);c.requests[0].reply();await pending;
});
