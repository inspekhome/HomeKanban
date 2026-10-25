'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {seed,categories}=require('../app/seed'),{validateState,createApp}=require('../app/server'),{reportHTML}=require('../app/report');
function fixture(){const state=seed(),t=state.templates[0],s=t.sections[0];const f={id:'note-test',sectionId:s.id,itemId:s.items[0].id,location:'TEST ONLY',category:categories[3],text:'Unique test observation.',photos:[]};const r={id:'notes-report',address:'Test property',client:'Test client',date:'2026-10-23',time:'',weather:'',email:'',phone:'',notes:'',scope:'Test only',notice:t.notice,status:'draft',inspector:{...state.profile,name:'Test'},sections:structuredClone(t.sections),findings:[f]};state.reports.push(r);state.noteLibrary=[{id:'common-test',title:'Reusable wording',text:'Reusable test note.',category:categories[2]}];return {state,r,f};}
test('old backups without a note library or summary setting still validate and include notes',()=>{const {state,r}=fixture();delete state.noteLibrary;assert.doesNotThrow(()=>validateState(state));assert.equal(reportHTML(r).split('Unique test observation.').length-1,3);});
test('notes added in summaries appear in both summaries and never in System checks',()=>{
 const {state,r,f}=fixture();f.origin='summary';f.includeInSummary=true;delete f.sectionId;delete f.itemId;
 assert.doesNotThrow(()=>validateState(state));const html=reportHTML(r);
 assert.equal(html.split(f.text).length-1,2);assert.ok(!html.includes('id="check-finding-note-test"'));assert.ok(!html.includes('href="#check-finding-note-test"'));
 const checks=html.slice(html.indexOf('<section id="system-checks">'));assert.ok(!checks.includes(f.text));
 for(const [,target] of html.matchAll(/href="#([^"]+)"/g))assert.ok(html.includes(`id="${target}"`),target);
 f.includeInSummary=false;assert.throws(()=>validateState(state),/Summary notes/);f.includeInSummary=true;f.sectionId=r.sections[0].id;f.itemId=r.sections[0].items[0].id;assert.throws(()=>validateState(state),/Summary notes/);
});
test('both summaries regroup notes when their category changes, independent of creation order',()=>{
 const {r,f}=fixture();f.origin='summary';delete f.sectionId;delete f.itemId;f.category=categories[3];
 const second={...f,id:'second-note',text:'Second observation.',category:categories[2]};r.findings.push(second);
 let html=reportHTML(r);let photos=html.slice(html.indexOf('<section id="photo-summary">'),html.indexOf('<section id="system-checks">'));
 assert.ok(photos.indexOf('id="finding-second-note"')<photos.indexOf('id="finding-note-test"'));
 f.category=categories[0];html=reportHTML(r);photos=html.slice(html.indexOf('<section id="photo-summary">'),html.indexOf('<section id="system-checks">'));
 const text=html.slice(html.indexOf('<section id="text-summary">'),html.indexOf('<section id="photo-summary">'));
 assert.ok(photos.indexOf('id="finding-note-test"')<photos.indexOf('id="finding-second-note"'));assert.ok(text.indexOf('id="summary-note-test"')<text.indexOf('id="summary-second-note"'));
 assert.equal(html.split(f.text).length-1,2);
});
test('excluded notes remain only in System checks with no broken summary links',()=>{const {state,r,f}=fixture();f.includeInSummary=false;assert.doesNotThrow(()=>validateState(state));let html=reportHTML(r);assert.equal(html.split(f.text).length-1,1);assert.ok(!html.includes('id="summary-note-test"'));assert.ok(!html.includes('href="#finding-note-test"'));assert.ok(html.includes('id="check-finding-note-test"'));f.includeInSummary=true;html=reportHTML(r);assert.equal(html.split(f.text).length-1,3);for(const [,target] of html.matchAll(/href="#([^"]+)"/g))assert.ok(html.includes(`id="${target}"`),target);});
test('exported summaries use clean category lists and matching gap-free photo numbers after changes',()=>{
 const {r,f}=fixture();f.category=categories[0];
 r.findings.push({...f,id:'other-category',category:categories[1],text:'Other category observation.'},{...f,id:'hidden-note',includeInSummary:false,text:'Checklist only.'},{...f,id:'next-defect',text:'Next defect.'});
 function check(expected){
  const html=reportHTML(r),summary=html.slice(html.indexOf('<section id="text-summary">'),html.indexOf('<section id="photo-summary">')),photos=html.slice(html.indexOf('<section id="photo-summary">'),html.indexOf('<section id="system-checks">'));
  assert.ok(!summary.includes('TEST ONLY'));assert.ok(!summary.includes('finding-links'));assert.ok(!summary.includes('Photos and details'));assert.ok(!summary.includes('Checklist only.'));
  for(const [id,n] of expected){assert.ok(summary.includes(`id="summary-${id}"`));const card=photos.slice(photos.indexOf(`id="finding-${id}"`)).split('</article>')[0];assert.ok(card.includes(`<span class="summary-note-number">${n}. </span>`));}
  assert.equal((summary.match(/<ol class="summary-list">/g)||[]).length,2);
 }
 check([['note-test',1],['other-category',1],['next-defect',2]]);
 r.findings=r.findings.filter(n=>n.id!=='note-test');check([['other-category',1],['next-defect',1]]);
 r.findings.find(n=>n.id==='next-defect').category=categories[2];check([['other-category',1],['next-defect',1]]);
});
test('picture summaries show one source annotation without duplicate automatic titles',()=>{
 const {r,f}=fixture();f.origin='summary';delete f.sectionId;delete f.itemId;f.location='';
 const picture=()=>reportHTML(r).split('<section id="photo-summary">')[1].split('<section id="system-checks">')[0];
 let html=picture();assert.equal((html.match(/>Summary note</g)||[]).length,1);assert.ok(html.includes('<span class="summary-note-number">1. </span>Unique test observation.'));assert.ok(!html.includes('<h4>Summary note</h4>'));
 const roof=r.sections.find(s=>s.name==='Roof');f.origin='checklist';f.sectionId=roof.id;f.itemId=roof.items[0].id;f.location=`${roof.name} / ${roof.items[0].name}`;
 html=picture();assert.equal((html.match(/>Roof</g)||[]).length,1);assert.ok(!html.includes(`<h4>${f.location}</h4>`));assert.ok(html.includes('class="note-source note-source-link" href="#check-finding-note-test"'));assert.ok(reportHTML(r).includes('id="check-finding-note-test"'));
 f.location='North roof slope';html=picture();assert.ok(html.includes('<h4>North roof slope</h4>'));assert.equal((html.match(/>Roof</g)||[]).length,1);
});
test('invalid common notes and invalid summary inclusion are rejected',()=>{const {state,f}=fixture();f.includeInSummary='false';assert.throws(()=>validateState(state),/summary/);f.includeInSummary=false;state.noteLibrary[0].category='Unknown';assert.throws(()=>validateState(state),/common note/);state.noteLibrary[0].category=categories[0];state.noteLibrary.push({...state.noteLibrary[0]});assert.throws(()=>validateState(state),/duplicate common/);state.noteLibrary.pop();state.noteLibrary[0].text=' ';assert.throws(()=>validateState(state),/common note/);});
test('library edits do not change copied report notes; all note data survives backup, restore and restart',async()=>{
 const {state,r,f}=fixture();f.text=state.noteLibrary[0].text;state.noteLibrary[0].text='Revised common wording';assert.notEqual(f.text,state.noteLibrary[0].text);f.includeInSummary=false;f.origin='checklist';r.findings.push({id:'summary-persist',origin:'summary',location:'Roof',category:categories[0],text:'Summary-only test note.',photos:[],includeInSummary:true});
 const dataDir=fs.mkdtempSync(path.resolve('work/notes-test-'));let app=createApp({dataDir,port:0});let url=await app.start();
 try{const home=await(await fetch(url)).text(),token=home.match(/name="solo-token" content="([a-f0-9]+)"/)[1];const request=(u,method='GET',body)=>fetch(url+u,{method,headers:{'X-Solo-Token':token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});assert.equal((await request('/api/state','PUT',{state,revision:0})).status,200);const backup=await(await request('/api/backup')).json();assert.deepEqual(backup.state.noteLibrary,state.noteLibrary);assert.equal((await request('/api/restore','POST',{backup,revision:1})).status,200);assert.equal((await request('/notes.js')).status,200);await app.close();app=createApp({dataDir,port:0});url=await app.start();assert.deepEqual(app.read().state.noteLibrary,state.noteLibrary);assert.deepEqual(app.read().state.reports[0].findings,r.findings);}finally{await app.close();}
});
