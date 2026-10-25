'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),{Worker}=require('node:worker_threads');
const {createApp}=require('../app/server');
const root=()=>fs.mkdtempSync(path.resolve('work/acceptance-data-'));
const token='ae'.repeat(32),headers={'X-Solo-Token':token,'Content-Type':'application/json'};
const put=(url,data)=>fetch(url+'/api/state',{method:'PUT',headers,body:JSON.stringify(data)});
test('untrusted origins, missing sessions, invalid JSON and invalid restores cannot change saved data',async()=>{
 const app=createApp({dataDir:root(),port:0,sessionToken:token}),url=await app.start(),before=app.read();
 try{
  assert.equal((await fetch(url+'/api/state')).status,401);
  assert.equal((await fetch(url+'/api/state',{method:'PUT',headers:{...headers,Origin:'https://untrusted.invalid'},body:JSON.stringify(before)})).status,403);
  assert.equal((await fetch(url+'/api/state',{method:'PUT',headers:{...headers,'Sec-Fetch-Site':'cross-site'},body:JSON.stringify(before)})).status,403);
  assert.equal((await fetch(url+'/api/state',{method:'PUT',headers,body:'{broken'})).status,400);
  assert.equal((await fetch(url+'/api/restore',{method:'POST',headers,body:JSON.stringify({revision:before.revision,backup:{format:'bad',state:before.state}})})).status,400);
  const host=await new Promise((resolve,reject)=>{const req=http.get(url+'/api/state',{headers:{...headers,Host:'untrusted.invalid'}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});req.on('error',reject);});assert.equal(host,403);
  assert.deepEqual(app.read(),before);
 }finally{await app.close();}
});
test('an unwritable backup destination fails safely and saving recovers after repair',async()=>{
 const dataDir=root(),app=createApp({dataDir,port:0,sessionToken:token}),url=await app.start(),before=app.read();
 try{
  fs.writeFileSync(path.join(dataDir,'backups'),'Synthetic blocked directory');const edited=structuredClone(before);edited.state.profile.name='Must not be lost';
  const response=await put(url,edited);assert.equal(response.status,500);assert.deepEqual(app.read(),before);
  fs.renameSync(path.join(dataDir,'backups'),path.join(dataDir,'blocked-marker.txt'));assert.equal((await put(url,edited)).status,200);assert.equal(app.read().state.profile.name,'Must not be lost');
  const snapshots=fs.readdirSync(path.join(dataDir,'backups'));assert.equal(snapshots.length,1);assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dataDir,'backups',snapshots[0]))).state,before.state);
 }finally{await app.close();}
});
test('a committed save survives abrupt worker termination and SQLite reopens cleanly',async()=>{
 const dataDir=root(),worker=new Worker(`const {parentPort,workerData}=require('node:worker_threads');const app=require(workerData.server).createApp({dataDir:workerData.dataDir,port:0,sessionToken:workerData.token});app.start().then(url=>parentPort.postMessage(url));`,{eval:true,workerData:{dataDir,token,server:require.resolve('../app/server')}});
 try{
  const url=await new Promise((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);});const data=await(await fetch(url+'/api/state',{headers})).json();data.state.profile.name='Saved before forced shutdown';
  assert.equal((await put(url,{state:data.state,revision:data.revision})).status,200);await worker.terminate();
  const app=createApp({dataDir,port:0});await app.start();try{assert.equal(app.read().state.profile.name,'Saved before forced shutdown');assert.equal(app.read().revision,1);assert.equal(app.db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');}finally{await app.close();}
 }finally{await worker.terminate();}
});
