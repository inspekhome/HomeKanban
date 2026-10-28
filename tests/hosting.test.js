'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {DatabaseSync}=require('node:sqlite'),{randomBytes}=require('node:crypto');
const {MemoryR2}=require('./helpers/memory-r2.cjs');
const {createHosting,endpoint}=require('../app/hosting/service');
const {packageReport,digest}=require('../app/hosting/package');
const {reportHTML}=require('../app/report'),{seed}=require('../app/seed'),{createApp}=require('../app/server');
const workerPromise=import('../app/hosting/worker.mjs').then(module=>module.default);
const KEY='1'.repeat(64),ADDRESS='https://homekanban-test.example.workers.dev';
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aHHcAAAAASUVORK5CYII=';
function report(id='report-one'){
 const state=seed();
 return {id,client:'Synthetic Client',address:'Synthetic property',email:'private@example.invalid',phone:'555-0100',date:'2026-10-27',time:'',weather:'',notes:'',notice:'',scope:'Visible systems only',status:'draft',inspector:state.profile,sections:structuredClone(state.templates[0].sections),findings:[{id:'note-one',sectionId:state.templates[0].sections[0].id,itemId:state.templates[0].sections[0].items[0].id,location:'Test',text:'Synthetic test narrative.',category:'Defect/Action Needed',photos:[{src:png,caption:'Synthetic pixel'}]}]};
}
async function cloud(){
 const worker=await workerPromise,bucket=new MemoryR2(),env={REPORTS:bucket,HOMEKANBAN_PUBLISH_KEY:KEY},calls=[];
 const request=(route,method='GET',body,key=KEY)=>worker.fetch(new Request(ADDRESS+route,{method,headers:{...(key?{Authorization:'Bearer '+key}:{}),...(body?{'Content-Type':Buffer.isBuffer(body)?'application/octet-stream':'application/json'}:{})},body:body?(Buffer.isBuffer(body)?body:JSON.stringify(body)):undefined}),env);
 const fetchImpl=async(url,options={})=>{calls.push({url,method:options.method||'GET'});return worker.fetch(new Request(url,options),env);};
 return {worker,bucket,env,request,fetchImpl,calls};
}
async function staged(c,id=randomBytes(32).toString('hex'),r=report()){
 const bundle=packageReport(r,reportHTML),base='/api/v1/publications/'+id;
 assert.equal((await c.request(base,'POST',bundle.manifest)).status,200);
 return {id,bundle,base,upload:async()=>{for(const file of bundle.files)assert.equal((await c.request(base+'/files/'+file.name,'PUT',file.body)).status,200);}};
}
function local(c,db=new DatabaseSync(':memory:')){
 const state=seed();state.reports=[report()];const disk={state,revision:1};
 const protect=(value,decrypt)=>decrypt?Buffer.from(value.slice(7),'base64').toString():'sealed:'+Buffer.from(value).toString('base64');
 const hosting=createHosting({db,protect,read:()=>structuredClone(disk),renderHTML:reportHTML,fetchImpl:c.fetchImpl});
 return {hosting,db,disk,protect};
}
function connect(hosting,enabled=true){return hosting.saveSettings({endpoint:ADDRESS,key:KEY,enabled});}
test('hosting endpoint rejects redirects, account credentials, local addresses and URL paths',()=>{
 assert.equal(endpoint(ADDRESS+'/'),ADDRESS);
 for(const value of ['http://x.example.workers.dev','https://127.0.0.1','https://evil.invalid','https://user:key@x.example.workers.dev','https://x.example.workers.dev:123','https://x.example.workers.dev/r/private','https://x.example.workers.dev?x=1','https://x.example.workers.dev#secret'])assert.throws(()=>endpoint(value));
});
test('web packaging extracts and deduplicates photos without changing local report or exporting private contact fields',()=>{
 const r=report(),before=structuredClone(r),bundle=packageReport(r,reportHTML),html=bundle.files.find(f=>f.name==='index.html').body.toString();
 assert.deepEqual(r,before);assert.equal(bundle.files.length,2);
 assert.ok(!html.includes('data:image'));assert.ok(!html.includes('private@example.invalid'));
 assert.equal((html.match(/src="files\//g)||[]).length,2);assert.match(html,/loading="lazy"/);
 assert.match(html,/Summary and pictures/);assert.match(html,/data-rating="D"/);
 for(const file of bundle.files){assert.equal(file.sha256,digest(file.body));assert.equal(file.bytes,file.body.length);}
});
test('worker refuses missing/wrong publishing keys and missing R2; public reads cannot write or list storage',async()=>{
 const c=await cloud();
 for(const key of [null,'2'.repeat(64),'bad'])assert.equal((await c.request('/api/v1/connection','GET',undefined,key)).status,401);
 assert.equal((await c.request('/api/v1/publications','GET',undefined,null)).status,401);
 assert.equal((await c.request('/r/'+'a'.repeat(64)+'/','PUT',{},null)).status,405);
 assert.equal(c.bucket.objects.size,0);
 delete c.env.REPORTS;assert.equal((await c.request('/api/v1/connection')).status,503);
});
test('a complete publish serves HTML and photos with no-cache headers; termination blocks both and leaves a tombstone',async()=>{
 const c=await cloud(),s=await staged(c),url='/r/'+s.id+'/',photo=url+'files/'+s.bundle.files[0].name;
 assert.equal((await c.request(url)).status,404);assert.equal((await c.request(s.base+'/commit','POST',{})).status,409);
 await s.upload();assert.equal((await c.request(photo)).status,404);
 assert.equal((await c.request(s.base+'/commit','POST',{})).status,200);
 for(const target of [url,photo]){
  const response=await c.request(target,'GET',undefined,null);assert.equal(response.status,200);
  assert.match(response.headers.get('Cache-Control'),/no-store/);assert.equal(response.headers.get('Cloudflare-CDN-Cache-Control'),'no-store');
  assert.match(response.headers.get('X-Robots-Tag'),/noindex/);assert.equal(response.headers.get('Referrer-Policy'),'no-referrer');assert.equal(response.headers.get('Access-Control-Allow-Origin'),null);
  await response.arrayBuffer();
 }
 const terminated=await (await c.request(s.base,'DELETE')).json();assert.equal(terminated.status,'revoked');assert.equal(terminated.cleaned,true);
 for(const target of [url,photo])assert.equal((await c.request(target,'GET',undefined,null)).status,404);
 assert.equal((await c.request(s.base,'POST',s.bundle.manifest)).status,409);assert.equal((await c.request(s.base+'/commit','POST',{})).status,409);
 assert.equal([...c.bucket.objects.keys()].filter(key=>key.startsWith('homekanban/data/')).length,0);
 assert.equal((await (await c.request(s.base)).json()).status,'revoked');
});
test('termination before delayed creation prevents an uncertain upload from resurrecting a link',async()=>{
 const c=await cloud(),id=randomBytes(32).toString('hex'),base='/api/v1/publications/'+id;
 assert.equal((await c.request(base,'DELETE')).status,200);
 assert.equal((await c.request(base,'POST',packageReport(report(),reportHTML).manifest)).status,409);
});
test('revocation racing with final commit wins through conditional R2 writes',async()=>{
 const c=await cloud(),s=await staged(c);await s.upload();let intercepted=false;
 c.bucket.beforePut=async(key,value)=>{
  if(!intercepted&&key.includes('/control/')&&JSON.parse(value).status==='published'){
   intercepted=true;await c.request(s.base,'DELETE');
  }
 };
 assert.equal((await c.request(s.base+'/commit','POST',{})).status,409);
 assert.equal((await c.request('/r/'+s.id+'/')).status,404);
});
test('late file upload cannot reopen a revoked report and cleans its own data',async()=>{
 const c=await cloud(),s=await staged(c);let intercepted=false;
 c.bucket.afterPut=async(key)=>{
  if(!intercepted&&key.includes('/data/')){intercepted=true;await c.request(s.base,'DELETE');}
 };
 const file=s.bundle.files[0];
 assert.equal((await c.request(s.base+'/files/'+file.name,'PUT',file.body)).status,409);
 assert.equal([...c.bucket.objects.keys()].filter(key=>key.includes('/data/')).length,0);
 assert.equal((await c.request('/r/'+s.id+'/')).status,404);
});
test('failed deletion still closes all public access and reports pending cleanup for retry',async()=>{
 const c=await cloud(),s=await staged(c);await s.upload();await c.request(s.base+'/commit','POST',{});
 c.bucket.failDelete=true;const result=await (await c.request(s.base,'DELETE')).json();
 assert.equal(result.status,'revoked');assert.equal(result.cleaned,false);assert.equal((await c.request('/r/'+s.id+'/')).status,404);
 c.bucket.failDelete=false;assert.equal((await (await c.request(s.base,'DELETE')).json()).cleaned,true);
});
test('unexpected files, incomplete bytes and wrong checksums cannot enter the public report',async()=>{
 const c=await cloud(),s=await staged(c),file=s.bundle.files[0];
 assert.equal((await c.request(s.base+'/files/other.png','PUT',file.body)).status,400);
 assert.equal((await c.request(s.base+'/files/'+file.name,'PUT',Buffer.from('short'))).status,400);
 assert.equal((await c.request(s.base+'/files/'+file.name,'PUT',Buffer.alloc(file.bytes))).status,503);
 assert.equal((await c.request(s.base+'/commit','POST',{})).status,409);
});
test('report A termination does not affect report B; published snapshots cannot be overwritten',async()=>{
 const c=await cloud(),a=await staged(c),b=await staged(c,undefined,report('report-two'));
 for(const s of [a,b]){await s.upload();await c.request(s.base+'/commit','POST',{});}
 await c.request(a.base,'DELETE');assert.equal((await c.request('/r/'+b.id+'/')).status,200);
 const file=b.bundle.files[0];assert.equal((await c.request(b.base+'/files/'+file.name,'PUT',file.body)).status,409);
});
test('local publishing defaults off, saves credentials separately, and does not connect during normal reads',async()=>{
 const c=await cloud(),l=local(c);try{
  assert.equal(l.hosting.localState().enabled,false);assert.equal(c.calls.length,0);
  connect(l.hosting,false);assert.equal(c.calls.length,0);
  const cfg=l.hosting.localState();assert.equal(cfg.hasKey,true);assert.ok(!JSON.stringify(cfg).includes(KEY));assert.ok(!JSON.stringify(l.disk).includes(KEY));
  assert.ok(!l.db.prepare('SELECT json FROM hosting_settings').get().json.includes(KEY));
  await assert.rejects(l.hosting.publish('report-one',1),/Enable Allow report uploads/);assert.equal(c.calls.length,0);
 }finally{l.db.close();}
});
test('backend publishes only selected saved snapshot, requires current revision and can terminate with uploads disabled',async()=>{
 const c=await cloud(),l=local(c);try{
  connect(l.hosting);await assert.rejects(l.hosting.publish('report-one',0),/another window/);assert.equal(c.calls.length,0);
  const before=structuredClone(l.disk),p=await l.hosting.publish('report-one',1);
  assert.equal(p.status,'published');assert.match(p.url,/\/r\/[a-f0-9]{64}\/$/);assert.deepEqual(l.disk,before);
  await assert.rejects(l.hosting.publish('report-one',1),/already has a publication/);
  assert.throws(()=>l.hosting.saveSettings({endpoint:'https://other.example.workers.dev',enabled:true}),/Terminate existing/);
  assert.throws(()=>l.hosting.saveSettings({endpoint:ADDRESS,clearKey:true,enabled:false}),/Terminate existing/);
  l.hosting.saveSettings({endpoint:ADDRESS,enabled:false});
  assert.equal((await l.hosting.terminate(p.id)).status,'unpublished');
  assert.equal((await c.request('/r/'+p.id+'/')).status,404);
 }finally{l.db.close();}
});
test('lost commit response is recorded as uncertain and reconciles to the actual cloud result without republishing',async()=>{
 const c=await cloud(),real=c.fetchImpl;c.fetchImpl=async(url,options)=>{const result=await real(url,options);if(url.endsWith('/commit'))throw Error('Connection lost after commit');return result;};
 const l=local(c);try{
  connect(l.hosting);await assert.rejects(l.hosting.publish('report-one',1),/cloud status may have changed/);
  const p=l.hosting.localState().publications[0];assert.equal(p.status,'uncertain');
  await assert.rejects(l.hosting.publish('report-one',1),/already has/);
  assert.equal((await l.hosting.check(p.id)).status,'published');
  await l.hosting.terminate(p.id);
 }finally{l.db.close();}
});
test('failed initial upload remains recoverable even when remote status is missing; termination creates a tombstone',async()=>{
 const c=await cloud(),real=c.fetchImpl;let fail=true;c.fetchImpl=async(url,options)=>{if(fail)throw Error('offline');return real(url,options);};
 const l=local(c);try{
  connect(l.hosting);await assert.rejects(l.hosting.publish('report-one',1));const p=l.hosting.localState().publications[0];
  fail=false;assert.equal((await l.hosting.check(p.id)).status,'uncertain');
  assert.equal((await l.hosting.terminate(p.id)).status,'unpublished');
  assert.equal((await (await c.request('/api/v1/publications/'+p.id)).json()).status,'revoked');
 }finally{l.db.close();}
});
test('hosting records persist across restart and local report removal, with recovery from the same cloud account',async()=>{
 const c=await cloud(),dir=fs.mkdtempSync(path.join(os.tmpdir(),'homekanban-hosting-test-')),filename=path.join(dir,'test.sqlite');
 let l=local(c,new DatabaseSync(filename));connect(l.hosting);const p=await l.hosting.publish('report-one',1);l.db.close();
 l=local(c,new DatabaseSync(filename));try{
  l.disk.state.reports=[];assert.equal(l.hosting.localState().publications[0].id,p.id);
  const recovered=local(c);try{connect(recovered.hosting);const rows=await recovered.hosting.recover();assert.equal(rows.publications[0].id,p.id);assert.equal(rows.publications[0].reportId,null);await recovered.hosting.terminate(p.id);}finally{recovered.db.close();}
  assert.equal((await l.hosting.check(p.id)).status,'unpublished');
 }finally{l.db.close();fs.rmSync(dir,{recursive:true,force:true});}
});
test('hosting API keeps credentials out of normal settings, reports and backups, and rejects cross-origin requests',async()=>{
 const c=await cloud(),dir=fs.mkdtempSync(path.join(os.tmpdir(),'homekanban-hosting-http-')),app=createApp({dataDir:dir,port:0,hostingFetch:c.fetchImpl});const url=await app.start();
 try{
  const html=await (await fetch(url)).text(),token=html.match(/name="solo-token" content="([a-f0-9]+)"/)[1],headers={'X-Solo-Token':token,'Content-Type':'application/json'};
  assert.equal((await fetch(url+'/api/hosting')).status,401);
  assert.equal((await fetch(url+'/api/hosting/settings',{method:'PUT',headers:{...headers,Origin:'https://evil.invalid'},body:'{}'})).status,403);
  assert.equal((await fetch(url+'/api/hosting/settings',{method:'PUT',headers,body:JSON.stringify({endpoint:ADDRESS,key:KEY,enabled:false})})).status,200);
  for(const route of ['/api/state','/api/settings','/api/backup','/api/hosting']){
   const text=await (await fetch(url+route,{headers})).text();assert.ok(!text.includes(KEY));assert.ok(!text.includes('sealed:'));
   if(route!=='/api/hosting')assert.ok(!text.includes(ADDRESS));
  }
  assert.equal(c.calls.length,0);const check=await fetch(url+'/api/hosting/connection',{method:'POST',headers,body:'{}'});assert.equal(check.status,200);
  const source=await fetch(url+'/api/hosting/worker',{headers});assert.equal(source.status,200);assert.match(await source.text(),/HOMEKANBAN_PUBLISH_KEY/);
 }finally{await app.close();fs.rmSync(dir,{recursive:true,force:true});}
});
