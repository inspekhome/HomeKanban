'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createApp}=require('../app/server'),{seed}=require('../app/seed'),{reportHTML}=require('../app/report');
const {fontFile}=require('../app/fonts'),{packageReport}=require('../app/hosting/package');
const {MemoryR2}=require('./helpers/memory-r2.cjs');
function report(){const state=seed();return {id:'font-test',address:'Typography test',client:'Example',date:'2026-10-28',status:'draft',inspector:state.profile,sections:structuredClone(state.templates[0].sections),findings:[]};}

test('a clean offline app serves the bundled font locally with the correct binary type',async()=>{
 const app=createApp({dataDir:fs.mkdtempSync(path.resolve('work/font-test-')),port:0});
 try{const base=await app.start(),home=await fetch(base),css=await(await fetch(base+'/style.css')).text();
  assert.match(home.headers.get('Content-Security-Policy'),/default-src 'self'/);
  assert.match(css,/src:url\("\/fonts\/oswald-variable.ttf"\)/);
  const response=await fetch(base+'/fonts/oswald-variable.ttf');assert.equal(response.status,200);
  assert.equal(response.headers.get('Content-Type'),'font/ttf');
  assert.deepEqual(Buffer.from(await response.arrayBuffer()),fs.readFileSync(fontFile));
  assert.equal((await fetch(base+'/fonts/not-a-font.ttf')).status,404);
 }finally{await app.close();}
});

test('preview, offline and hosted HTML carry identical font bytes and license without changing report data',()=>{
 const r=report(),before=structuredClone(r),html=reportHTML(r),bundle=packageReport(r,reportHTML),hosted=bundle.files.find(f=>f.name==='index.html').body.toString();
 for(const text of [html,hosted]){
  const data=text.match(/data:font\/ttf;base64,([A-Za-z0-9+/=]+)/);assert.ok(data);
  assert.deepEqual(Buffer.from(data[1],'base64'),fs.readFileSync(fontFile));
  assert.match(text,/Copyright 2016 The Oswald Project Authors/);assert.match(text,/SIL OPEN FONT LICENSE Version 1.1/);
  assert.ok(!text.includes('fonts.googleapis.com'));assert.match(text,/font-weight:200 700/);
 }
 assert.deepEqual(r,before);
});

test('Worker serves the embedded report font under a narrow font-only data policy and termination still blocks it',async()=>{
 const worker=(await import('../app/hosting/worker.mjs')).default,env={REPORTS:new MemoryR2(),HOMEKANBAN_PUBLISH_KEY:'1'.repeat(64)},id='a'.repeat(64),base='/api/v1/publications/'+id,bundle=packageReport(report(),reportHTML);
 const request=(route,method='GET',body)=>worker.fetch(new Request('https://test.example.workers.dev'+route,{method,headers:{Authorization:'Bearer '+env.HOMEKANBAN_PUBLISH_KEY},body}),env);
 assert.equal((await request(base,'POST',JSON.stringify(bundle.manifest))).status,200);
 for(const file of bundle.files)assert.equal((await request(base+'/files/'+file.name,'PUT',file.body)).status,200);
 assert.equal((await request(base+'/commit','POST','{}')).status,200);
 const response=await request('/r/'+id+'/'),policy=response.headers.get('Content-Security-Policy');
 assert.equal(response.status,200);assert.match(policy,/font-src data:;/);assert.match(policy,/default-src 'none'/);
 assert.ok(!policy.includes("script-src 'unsafe-inline'"));assert.ok(!policy.includes('font-src *'));
 assert.match(await response.text(),/data:font\/ttf;base64,/);
 assert.equal((await request(base,'DELETE')).status,200);assert.equal((await request('/r/'+id+'/')).status,404);
});
