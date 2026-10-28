'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const Wording=require('../app/public/wording'),{seed}=require('../app/seed'),{validateState,createApp}=require('../app/server'),{reportHTML}=require('../app/report');
function sample(){
 const state=seed(),t=state.templates[0];
 Wording.assignScope(t,{text:'VISUAL INSPECTION\nAccessible areas only.\nNo destructive testing.',textRuns:[{text:'VISUAL INSPECTION',bold:true,size:'14pt'},{text:'\nAccessible areas only.',italic:true,size:'12pt'},{text:'\nNo destructive testing.',underline:true,size:'10pt'}]});
 const r={id:'scope-format-test',scope:t.scope,scopeRuns:structuredClone(t.scopeRuns),notice:t.notice,client:'Fictional client',address:'SYNTHETIC SCOPE TEST',date:'2026-10-27',time:'',weather:'',notes:'',email:'',phone:'',status:'draft',inspector:structuredClone(state.profile),sections:structuredClone(t.sections),findings:[]};
 state.reports.push(r);return {state,t,r};
}
test('scope validation allows legacy text and limited sizes but rejects color, markup, mismatches and oversize text',()=>{
 const {state,t,r}=sample();assert.doesNotThrow(()=>validateState(state));
 for(const record of [t,r]){
  const saved=structuredClone(record.scopeRuns);
  for(const runs of [[{text:record.scope,size:'15pt'}],[{text:record.scope,color:'#b42318'}],[{text:record.scope,size:'14pt;background:red'}],[{text:record.scope,html:'<script>bad()</script>'}],[{text:'mismatch'}],[{text:record.scope,bold:'true'}]]){record.scopeRuns=runs;assert.throws(()=>validateState(state));}
  record.scopeRuns=saved;
 }
 delete t.scopeRuns;delete r.scopeRuns;assert.doesNotThrow(()=>validateState(state));assert.deepEqual(Wording.scopeNote({scope:'Legacy <text>\n\nSecond paragraph.'}),{text:'Legacy <text>\n\nSecond paragraph.'});
 assert.throws(()=>Wording.validate({text:'Note',textRuns:[{text:'Note',size:'14pt'}]}));
});
test('new reports take independent formatted scope snapshots and later template changes do not alter old reports',()=>{
 const {state,t,r}=sample(),original=structuredClone(r),nodes=new Map();const node=key=>{if(!nodes.has(key))nodes.set(key,{content:'test-token',style:{},classList:{toggle(){}},addEventListener(){}});return nodes.get(key);};
 const ctx=vm.createContext({initialState:state,structuredClone,crypto,document:{querySelector:node,addEventListener(){}},window:{addEventListener(){}}});const source=fs.readFileSync(require.resolve('../app/public/app.js'),'utf8');vm.runInContext(source.slice(0,source.lastIndexOf('\nboot().catch'))+';state=initialState;globalThis.make=blankReport;',ctx);
 const newReport=ctx.make(t);assert.deepEqual(newReport.scopeRuns,t.scopeRuns);newReport.scopeRuns[0].bold=false;assert.equal(t.scopeRuns[0].bold,true);
 Wording.assignScope(t,{text:'New template wording.'});assert.deepEqual(r,original);assert.equal(newReport.scope,original.scope);
 const overridden=ctx.make({...t,scope:original.scope,scopeRuns:original.scopeRuns},{scope:'Explicit plain scope'});assert.equal(overridden.scope,'Explicit plain scope');assert.equal(overridden.scopeRuns,undefined);
});
test('shared PDF preview, PDF and Web HTML renders safe formatted scope without altering plain-text output',()=>{
 const {r}=sample(),html=reportHTML(r);assert.ok(html.includes('Standard of Practice, Scope &amp; limitations')||html.includes('Standard of Practice, Scope & limitations'));
 assert.ok(html.includes('<span style="font-size:14pt"><strong>VISUAL INSPECTION</strong></span>'));assert.ok(html.includes('<span style="font-size:12pt"><em><br>Accessible areas only.</em></span>'));assert.ok(html.includes('<span style="font-size:10pt"><u><br>No destructive testing.</u></span>'));
 r.scope='<script>alert(1)</script> & scope';r.scopeRuns=[{text:r.scope,bold:true,size:'14pt'}];const safe=reportHTML(r);assert.ok(safe.includes('&lt;script&gt;alert(1)&lt;/script&gt; &amp; scope'));assert.ok(!safe.includes('<script>alert(1)</script>'));
 delete r.scopeRuns;r.scope='Legacy\n\nScope';assert.ok(reportHTML(r).includes('Legacy<br><br>Scope'));
});
test('formatted template and report scope survives HTTP save, backup, restore and a fresh server',async()=>{
 const {state}=sample(),dataDir=fs.mkdtempSync(path.resolve('work/scope-format-test-'));let app=createApp({dataDir,port:0});
 try{
  let url=await app.start(),home=await(await fetch(url)).text(),token=home.match(/name="solo-token" content="([a-f0-9]+)"/)[1],headers={'X-Solo-Token':token,'Content-Type':'application/json'};
  const request=(route,body,method='POST')=>fetch(url+route,{method,headers,body:JSON.stringify(body)});
  assert.equal((await request('/api/state',{state,revision:0},'PUT')).status,200);
  const backup=await(await fetch(url+'/api/backup',{headers})).json();assert.deepEqual(backup.state,state);
  assert.equal((await request('/api/restore',{backup,revision:1})).status,200);await app.close();app=createApp({dataDir,port:0});url=await app.start();assert.deepEqual(app.read().state,state);
  home=await(await fetch(url)).text();headers={'X-Solo-Token':home.match(/name="solo-token" content="([a-f0-9]+)"/)[1]};const response=await fetch(url+'/api/reports/scope-format-test/html',{headers});assert.equal(response.status,200);const html=await response.text();assert.ok(html.includes('font-size:14pt'));
 }finally{await app.close();}
});
