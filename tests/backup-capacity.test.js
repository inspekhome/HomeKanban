'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const {createApp}=require('../app/server'),{categories}=require('../app/seed'),Limits=require('../app/public/workspace-limits'),{workspaceClient}=require('./helpers/workspace-client.cjs');
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
function pngWithText(bytes){
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6c8AAAAASUVORK5CYII=','base64'),data=Buffer.alloc(Math.max(9,bytes),65);data.write('Comment\0');
 const chunk=Buffer.alloc(data.length+12);chunk.writeUInt32BE(data.length);chunk.write('tEXt',4);data.copy(chunk,8);
 let crc=0xffffffff;for(const b of chunk.subarray(4,-4)){crc^=b;for(let k=0;k<8;k++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}chunk.writeUInt32BE((crc^0xffffffff)>>>0,chunk.length-4);
 return 'data:image/png;base64,'+Buffer.concat([png.subarray(0,-12),chunk,png.subarray(-12)]).toString('base64');
}
function fillWorkspace(state){
 const t=state.templates[0],photo=pngWithText(6*1024*1024),photos=Array.from({length:12},()=>({src:photo,caption:'Synthetic capacity fixture'}));
 state.reports.push({id:'capacity-report',client:'Test client',address:'Synthetic capacity test',date:'2026-10-27',time:'',weather:'',email:'',phone:'',notes:'',scope:'Test only',notice:t.notice,status:'draft',inspector:{...state.profile,name:'Test'},sections:structuredClone(t.sections),findings:[{id:'capacity-note',location:'',origin:'summary',category:categories[3],text:'Synthetic data.',photos}]});
 const remaining=Limits.MAX_STATE_BYTES-Buffer.byteLength(JSON.stringify(state));photos.push({src:pngWithText(Math.floor((remaining-512)*3/4)),caption:''});
 const padding=Limits.MAX_STATE_BYTES-Buffer.byteLength(JSON.stringify(state));assert.ok(padding>=0&&padding<1000);state.reports[0].notes='x'.repeat(padding);
 assert.equal(Buffer.byteLength(Limits.stateJSON(state)),Limits.MAX_STATE_BYTES);
}

test('frontend restore rejects oversized files before reading and strips file-only metadata',async()=>{
 const c=workspaceClient();let read=false;await c.restore({size:Limits.MAX_BACKUP_FILE_BYTES+1,text:async()=>{read=true;}});assert.equal(read,false);assert.match(c.messages.at(-1).message,/200 MB import limit/);
 const backup={format:'soloinspect-backup',created:'old date',revision:10,extra:'file-only metadata',state:c.state},file=JSON.stringify(backup,null,2),pending=c.restore({size:Buffer.byteLength(file),text:async()=>file});
 await new Promise(resolve=>setImmediate(resolve));assert.equal(c.requests.length,1);const sent=JSON.parse(c.requests[0].options.body);assert.deepEqual(Object.keys(sent.backup),['format','state']);assert.equal(sent.revision,0);c.requests[0].reply();await pending;assert.equal(c.messages.at(-1).error,undefined);
});

test('a workspace at the 100 MiB state limit round-trips through backup, UI restore and restart; overflow never changes data',async()=>{
 const work=path.resolve('work'),dir=fs.mkdtempSync(path.join(work,'backup-capacity-regression-')),token='bd'.repeat(32),headers={'X-Solo-Token':token,'Content-Type':'application/json'};
 let app=createApp({dataDir:dir,port:0,sessionToken:token}),url=await app.start();
 try{
  const {state}=app.read();fillWorkspace(state);const expected=hash(state),saveBody=JSON.stringify({state,revision:0});assert.ok(Buffer.byteLength(saveBody)<Limits.MAX_REQUEST_BYTES);
  assert.equal((await fetch(url+'/api/state',{method:'PUT',headers,body:saveBody})).status,200);
  const backupText=await(await fetch(url+'/api/backup',{headers})).text();assert.ok(Buffer.byteLength(backupText)>95*1024*1024);assert.ok(Buffer.byteLength(backupText)<Limits.MAX_BACKUP_FILE_BYTES);
  let restoreRequests=0;const c=workspaceClient({revision:1,fetchImpl:async(route,options)=>{restoreRequests++;assert.equal(route,'/api/restore');assert.ok(Buffer.byteLength(options.body)<Limits.MAX_REQUEST_BYTES);return fetch(url+route,{...options,headers});}});
  await c.restore({size:Buffer.byteLength(backupText),text:async()=>backupText});assert.equal(restoreRequests,1);assert.match(c.messages.at(-1).message,/Backup restored/);assert.equal(app.read().revision,2);assert.equal(hash(app.read().state),expected);
  // One UTF-8 character beyond the state limit must be rejected on both paths,
  // even though its request still fits in the transport allowance.
  state.reports[0].notes+='水';
  for(const restoring of [false,true]){const data=restoring?{backup:{format:'soloinspect-backup',state},revision:2}:{state,revision:2};const response=await fetch(url+(restoring?'/api/restore':'/api/state'),{method:restoring?'POST':'PUT',headers,body:JSON.stringify(data)});assert.equal(response.status,413);assert.match((await response.json()).error,/100 MB data limit/);assert.equal(app.read().revision,2);}
  assert.equal(fs.readdirSync(path.join(dir,'backups')).length,2);
  const snapshotFiles=fs.readdirSync(path.join(dir,'backups')).map(f=>path.join(dir,'backups',f)),large=snapshotFiles.find(f=>fs.statSync(f).size>95*1024*1024);assert.ok(large);assert.ok(fs.statSync(large).size<Limits.MAX_BACKUP_FILE_BYTES);assert.equal(hash(Limits.prepareRestore(JSON.parse(fs.readFileSync(large))).state),expected);
  await app.close();app=createApp({dataDir:dir,port:0,sessionToken:token});await app.start();assert.equal(hash(app.read().state),expected);assert.equal(app.read().state.reports[0].findings[0].photos.length,13);
 }finally{
  await app.close();const resolved=path.resolve(dir);if(path.dirname(resolved)!==work||!path.basename(resolved).startsWith('backup-capacity-regression-'))throw Error('Unexpected test directory');fs.rmSync(resolved,{recursive:true,force:true});
 }
});
