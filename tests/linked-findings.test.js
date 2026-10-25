'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {seed,categories}=require('../app/seed');
const {validateState,createApp}=require('../app/server');
const {reportHTML}=require('../app/report');
function fixture(){
 const state=seed(),template=state.templates[0],sections=structuredClone(template.sections);
 const section=sections.find(s=>s.name==='Plumbing'),item=section.items.at(-1);
 const finding={id:'test-leak',sectionId:section.id,itemId:item.id,location:'Kitchen sink (software test)',category:categories[0],text:'TEST ONLY: Active leakage observed below the kitchen sink.',photos:[{src:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jS1sAAAAASUVORK5CYII=',caption:'Synthetic test photo'}]};
 const report={id:'test-report',address:'TEST ONLY',client:'Test client',email:'',phone:'',date:'2026-10-23',time:'',weather:'',notes:'',notice:template.notice,scope:'Software test only.',inspector:{...state.profile,name:'Test inspector'},sections,findings:[finding],status:'draft',includeContact:false};
 state.reports.push(report);return {state,report,finding,section,item};
}
test('one finding produces a text summary, photo summary, and linked system entry',()=>{
 const {report,finding}=fixture();const html=reportHTML(report);
 assert.equal(html.split(finding.text).length-1,3);
 assert.equal(html.split(finding.photos[0].src).length-1,2);
 assert.equal(html.split(finding.photos[0].caption).length-1,4); // alt text and caption in both photo views
 const textSummary=html.slice(html.indexOf('<section id="text-summary">'),html.indexOf('<section id="photo-summary">'));
 assert.ok(!textSummary.includes('<img'));
 assert.ok(textSummary.includes('href="#finding-test-leak"'));
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);assert.equal(new Set(ids).size,ids.length);
 for(const match of html.matchAll(/href="#([^"]+)"/g))assert.ok(ids.includes(match[1]),'Missing anchor '+match[1]);
 assert.ok(html.indexOf('<section id="property-details">')<html.indexOf('<section id="findings-photos">'));
 assert.ok(html.indexOf('<section id="findings-photos">')<html.indexOf('<section id="system-checks">'));
 assert.ok(html.includes('Plumbing / Fixtures &amp; drainage'));
});
test('changes and deletion update every generated view without storing summary copies',()=>{
 const {report,finding}=fixture();const old=finding.text;finding.text='Updated observation & recommendation.';finding.photos[0].caption='Updated caption';
 let html=reportHTML(report);assert.ok(!html.includes(old));assert.equal(html.split('Updated observation &amp; recommendation.').length-1,3);assert.equal(html.split('Updated caption').length-1,4);
 finding.photos=[];html=reportHTML(report);assert.ok(!html.includes('data:image/'));assert.ok(!html.includes('Updated caption'));
 report.findings=[];html=reportHTML(report);assert.ok(!html.includes('Updated observation'));assert.ok(!html.includes('href="#finding-test-leak"'));
});
test('finding references must identify a real component; old unlinked findings remain valid',()=>{
 const {state,report,finding}=fixture();assert.doesNotThrow(()=>validateState(state));
 const oldItem=finding.itemId;finding.itemId='missing';assert.throws(()=>validateState(state),/component/);finding.itemId=oldItem;
 delete finding.itemId;assert.throws(()=>validateState(state));delete finding.sectionId;assert.doesNotThrow(()=>validateState(state));
 const html=reportHTML(report);assert.ok(html.includes('id="other-observations"'));assert.ok(html.includes('id="check-finding-test-leak"'));
 report.findings.push(structuredClone(finding));assert.throws(()=>validateState(state),/Duplicate finding ID/);
});
test('component links, narratives, captions, and photos survive save, backup, restore, and restart',async()=>{
 const {state,report}=fixture();const base=path.resolve('work/tests');fs.mkdirSync(base,{recursive:true});const dataDir=fs.mkdtempSync(path.join(base,'linked-'));
 let app=createApp({dataDir,port:0});let url=await app.start();
 try{
  const home=await (await fetch(url)).text(),token=home.match(/name="solo-token" content="([a-f0-9]+)"/)[1];
  const request=(endpoint,method='GET',body)=>fetch(url+endpoint,{method,headers:{'X-Solo-Token':token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  assert.equal((await request('/api/state','PUT',{state,revision:0})).status,200);
  const backup=await (await request('/api/backup')).json();assert.deepEqual(backup.state.reports[0].findings,report.findings);
  assert.equal((await request('/api/restore','POST',{backup,revision:1})).status,200);
  const html=await (await request('/api/reports/test-report/html')).text();assert.ok(html.includes('id="check-finding-test-leak"'));
  await app.close();app=createApp({dataDir,port:0});url=await app.start();assert.deepEqual(app.read().state.reports[0].findings,report.findings);
 }finally{await app.close();}
});
