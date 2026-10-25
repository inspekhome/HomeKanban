'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{Worker}=require('node:worker_threads');
const token='ac'.repeat(32);
async function start(dataDir,barrier,delay=0){
 const worker=new Worker(`const {parentPort,workerData}=require('node:worker_threads'),fs=require('node:fs');
 const app=require(workerData.server).createApp({dataDir:workerData.dataDir,port:0,sessionToken:workerData.token});
 // Synchronize backup writes to reproduce two independent processes saving the
 // same revision. Slow disks/large photo workspaces can produce this overlap.
 const original=fs.writeFileSync;fs.writeFileSync=function(file,...rest){if(String(file).includes('backup-')){const gate=new Int32Array(workerData.barrier);Atomics.add(gate,0,1);Atomics.notify(gate,0);while(Atomics.load(gate,0)<2)Atomics.wait(gate,0,1,3000);if(workerData.delay)Atomics.wait(gate,1,0,workerData.delay);}return original.call(this,file,...rest);};
 app.start().then(url=>parentPort.postMessage(url));parentPort.on('message',async()=>{await app.close();parentPort.close();});`,{eval:true,workerData:{server:require.resolve('../app/server'),dataDir,token,barrier,delay}});
 const url=await new Promise((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);});return {worker,url};
}
test('independent servers cannot overwrite a newer workspace revision',async()=>{
 const dataDir=fs.mkdtempSync(path.resolve('work/concurrent-save-')),barrier=new SharedArrayBuffer(8),servers=[];
 try{
  servers.push(await start(dataDir,barrier));servers.push(await start(dataDir,barrier,100));const headers={'X-Solo-Token':token,'Content-Type':'application/json'};
  const states=await Promise.all(servers.map(async({url},i)=>{const data=await(await fetch(url+'/api/state',{headers})).json();data.state.profile.name='Writer '+i;return {state:data.state,revision:data.revision};}));
  const responses=await Promise.all(servers.map(({url},i)=>fetch(url+'/api/state',{method:'PUT',headers,body:JSON.stringify(states[i])})));
  assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);
  const winner=responses.findIndex(r=>r.status===200),saved=await(await fetch(servers[0].url+'/api/state',{headers})).json();assert.equal(saved.revision,1);assert.equal(saved.state.profile.name,'Writer '+winner);
 }finally{await Promise.all(servers.map(({worker})=>new Promise(resolve=>{worker.once('exit',resolve);worker.postMessage('close');})));}
});
