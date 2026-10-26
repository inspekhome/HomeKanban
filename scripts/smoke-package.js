'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const packageRoot=path.resolve(process.argv[2]||'dist/HomeKanban-Windows-v0.18.11');
const {createApp}=require(path.join(packageRoot,'app/server.js'));
async function main(){
 const dataDir=fs.mkdtempSync(path.resolve('work/package-smoke-'));
 const app=createApp({dataDir,port:0});
 try{
  const url=await app.start();
  const home=await (await fetch(url)).text();
  assert.ok(home.includes('v0.18.11'));
  assert.ok(home.includes('<title>HomeKanban'));
  for(const [asset,type] of [['/branding/homekanban-logo.svg','image/svg+xml'],['/branding/homekanban-house.png','image/png'],['/favicon.ico','image/x-icon']]){const response=await fetch(url+asset);assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),type);assert.ok((await response.arrayBuffer()).byteLength>1000);}
  assert.ok(!home.includes('SoloInspect'));
  assert.ok(fs.existsSync(path.join(dataDir,'homekanban.sqlite')));
  const token=home.match(/name="solo-token" content="([a-f0-9]+)"/)[1];
  const response=await fetch(url+'/api/state',{headers:{'X-Solo-Token':token}});
  assert.equal(response.status,200);
  const data=await response.json();
  assert.equal(data.state.schema,2);
  assert.equal(data.state.templates[0].scope,'');
  assert.deepEqual(Object.keys(data.ratings),['I','NI','NP','D']);
  const script=await (await fetch(url+'/app.js')).text();
  assert.ok(script.includes('checklist-columns'));
  const notes=await (await fetch(url+'/notes.js')).text();
  assert.ok(script.includes('root.Wording=api'));
  assert.equal((notes.match(/function wordingMarkup\(/g)||[]).length,1);
  assert.ok(!home.includes('src="/wording.js"'));
  assert.ok(!home.includes('src="/wording-editor.js"'));
  assert.ok(home.includes('note-dialog'));
  assert.equal((await fetch(url+'/bank.js')).status,200);
  assert.equal((await fetch(url+'/wording.js')).status,200);
  assert.equal((await fetch(url+'/wording-editor.js')).status,200);
  assert.equal((await fetch(url+'/api/narratives',{headers:{'X-Solo-Token':token}})).status,404);
  assert.ok(!fs.existsSync(path.join(packageRoot,'app/data/narratives.json')));
  assert.deepEqual(data.state.noteLibrary,[]);
  assert.ok(!script.includes("rating==='NT'"));
  assert.ok(fs.statSync(path.join(packageRoot,'HomeKanban.exe')).size>0);
  const t=data.state.templates[0],r={id:'package-smoke',client:'Test client',address:'PACKAGE ACCEPTANCE TEST ONLY',email:'',phone:'',date:'2026-10-25',time:'',weather:'',notes:'',scope:'Synthetic package test.',notice:t.notice,status:'draft',inspector:{...data.state.profile,name:'Test inspector'},sections:structuredClone(t.sections),findings:[]};
  data.state.reports.push(r);
  assert.equal((await fetch(url+'/api/state',{method:'PUT',headers:{'X-Solo-Token':token,'Content-Type':'application/json'},body:JSON.stringify({state:data.state,revision:data.revision})})).status,200);
  const pdf=await fetch(url+'/api/reports/package-smoke/pdf',{headers:{'X-Solo-Token':token}});assert.equal(pdf.status,200);const bytes=Buffer.from(await pdf.arrayBuffer());assert.equal(bytes.subarray(0,5).toString(),'%PDF-');assert.match(bytes.subarray(-1024).toString(),/%%EOF\s*$/);
  console.log(JSON.stringify({package:packageRoot,packagedNode:process.version,status:'passed',ratings:data.ratings,pdfBytes:bytes.length}));
 }finally{await app.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
