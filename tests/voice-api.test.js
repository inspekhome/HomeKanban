'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const Voice=require('../app/voice'),{createApp,dpapi}=require('../app/server');
const nativeFetch=fetch,audio=Buffer.from([0x1a,0x45,0xdf,0xa3,0,1,2,3]).toString('base64'),body={mime:'audio/webm;codecs=opus',audio};
async function fixture(t){
 const dataDir=fs.mkdtempSync(path.resolve('work/voice-api-test-')),app=createApp({dataDir,port:0}),url=await app.start();t.after(()=>app.close());
 const token=(await(await nativeFetch(url)).text()).match(/name="solo-token" content="([a-f0-9]+)"/)[1];
 const request=async(route,method='GET',body)=>{const res=await nativeFetch(url+route,{method,headers:{'X-Solo-Token':token,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:res.status,data:await res.json()};};return {app,url,request,dataDir};
}
test('audio accepts valid recorder formats and rejects malformed, unsupported and oversized input',()=>{
 assert.equal(Voice.decodeAudio(body).mime,'audio/webm');
 const large=Buffer.alloc(1024*1024);Buffer.from([0x1a,0x45,0xdf,0xa3]).copy(large);assert.equal(Voice.decodeAudio({mime:body.mime,audio:large.toString('base64')}).audio.length,large.length);
 for(const value of [{mime:'text/html',audio},{mime:'audio/webm',audio:'!!!'},{mime:'audio/webm',audio:'abcd'},{mime:'audio/webm',audio:''},{mime:'audio/webm',audio:'A'.repeat(28*1024*1024)}])assert.throws(()=>Voice.decodeAudio(value));
});
test('transcription sends only audio to the fixed OpenAI endpoint without restricting language or following redirects',async()=>{
 const result=await Voice.transcribe(body,'synthetic-only',{fetchImpl:async(url,options)=>{
  assert.equal(url,'https://api.openai.com/v1/audio/transcriptions');assert.equal(options.redirect,'error');assert.equal(options.headers.Authorization,'Bearer synthetic-only');assert.equal(options.body.get('model'),'gpt-transcribe');assert.equal(options.body.get('language'),null);assert.equal(options.body.get('languages'),null);
  assert.deepEqual([...options.body.keys()].sort(),['file','model','prompt']);assert.equal(options.body.get('file').name,'recording.webm');return Response.json({text:'水管漏水。 The pipe is leaking.'});
 }});assert.equal(result.text,'水管漏水。 The pipe is leaking.');
 for(const response of [new Response('',{status:401}),new Response('',{status:429}),Response.json({text:''})])await assert.rejects(Voice.transcribe(body,'synthetic',{fetchImpl:async()=>response}));
});
test('voice settings and encrypted key are independent, survive AI settings edits, and never appear in backup or API output',{skip:process.platform!=='win32'},async t=>{
 const {app,request}=await fixture(t),before=JSON.stringify(app.read());assert.equal((await request('/api/voice-settings')).data.hasKey,false);
 assert.equal((await request('/api/transcribe','POST',body)).status,400);
 assert.equal((await request('/api/voice-settings','PUT',{key:'synthetic-voice-test-key'})).status,200);
 let cfg=JSON.parse(app.db.prepare('SELECT json FROM settings WHERE id=1').get().json);assert.notEqual(cfg.encryptedVoiceKey,'synthetic-voice-test-key');assert.equal(dpapi(cfg.encryptedVoiceKey,true),'synthetic-voice-test-key');const encrypted=cfg.encryptedVoiceKey;
 await request('/api/settings','PUT',{endpoint:'https://test-provider.invalid/v1/chat/completions',model:'test'});await request('/api/ai-instructions','PUT',{instructions:'Keep all facts.'});
 cfg=JSON.parse(app.db.prepare('SELECT json FROM settings WHERE id=1').get().json);assert.equal(cfg.encryptedVoiceKey,encrypted);assert.equal(cfg.instructions,'Keep all facts.');
 for(const route of ['/api/settings','/api/voice-settings','/api/backup']){const output=JSON.stringify((await request(route)).data);assert.ok(!output.includes(encrypted));assert.ok(!output.includes('synthetic-voice-test-key'));}
 await request('/api/voice-settings','PUT',{clearKey:true});cfg=JSON.parse(app.db.prepare('SELECT json FROM settings WHERE id=1').get().json);assert.equal(cfg.encryptedVoiceKey,'');assert.equal(cfg.model,'test');assert.equal(JSON.stringify(app.read()),before);
});
test('authenticated transcription handles busy/error cases without modifying report data or saving audio',{skip:process.platform!=='win32'},async t=>{
 const {app,request,dataDir}=await fixture(t);app.db.prepare('INSERT OR REPLACE INTO settings VALUES (1,?)').run(JSON.stringify({endpoint:'https://test.invalid',encryptedVoiceKey:dpapi('synthetic-voice-key')}));
 const before=JSON.stringify(app.read()),files=fs.readdirSync(dataDir).sort();let finish,calls=0;
 t.mock.method(globalThis,'fetch',async(url,options)=>{calls++;assert.equal(url,Voice.ENDPOINT);return new Promise(resolve=>finish=()=>resolve(Response.json({text:'다락방의 누수. Attic leak.'})));});
 const pending=request('/api/transcribe','POST',body);for(let i=0;i<100&&!finish;i++)await new Promise(r=>setTimeout(r,20));assert.equal(calls,1);
 assert.equal((await request('/api/transcribe','POST',body)).status,429);assert.equal((await request('/api/quit','POST',{})).status,409);finish();const result=await pending;assert.equal(result.status,200);assert.equal(result.data.text,'다락방의 누수. Attic leak.');assert.equal(JSON.stringify(app.read()),before);assert.deepEqual(fs.readdirSync(dataDir).sort(),files);
});
test('Quit acknowledges then closes its listener; close is safe to call again and saved data remains readable',async t=>{
 const {app,url,request,dataDir}=await fixture(t),snapshot=app.read();snapshot.state.profile.name='Saved sample';assert.equal((await request('/api/state','PUT',snapshot)).status,200);
 assert.equal((await request('/api/quit','POST',{})).status,200);await app.close();await app.close();assert.equal(app.server.listening,false);await assert.rejects(nativeFetch(url));
 const reopened=createApp({dataDir,port:0});assert.equal(reopened.read().state.profile.name,'Saved sample');await reopened.close();
});
