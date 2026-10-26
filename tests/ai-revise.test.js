'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const Wording=require('../app/public/wording'),{createApp,dpapi}=require('../app/server');
const nativeFetch=globalThis.fetch;
// Synthetic notes and provider responses only. These tests cannot call a real provider.
function client(send=async()=>({draft:'Revised wording.'}),settings={hasKey:true,model:'test-model',aiRevision:'polish-v2'}){
 const nodes=new Map(),requests=[];let editor={text:''},allowUndo=true;
 const $=key=>{if(!nodes.has(key))nodes.set(key,{addEventListener(){},setAttribute(){},disabled:false,hidden:true,textContent:''});return nodes.get(key);};
 const context=vm.createContext({$,Wording,JSON,document:{addEventListener(){}},window:{addEventListener(){}},readWording:()=>structuredClone(editor),setWording:(_id,note)=>editor=Wording.assign({},Wording.runs(note)),api:async(url,method,body)=>{requests.push({url,method,body});return url==='/api/settings'?settings:send(body);}});
 vm.runInContext(fs.readFileSync(require.resolve('../app/public/notes.js'),'utf8')+';globalThis.h={start:(draft,existing)=>noteEditor={draft,existing},revise:reviseNote,undo:undoNoteAI,close:()=>noteEditor=null};',context);
 context.confirmNote=async()=>allowUndo;
 return {h:context.h,requests,nodes,set:note=>editor=structuredClone(note),get:()=>structuredClone(editor),confirm:value=>allowUndo=value,hint:()=>$('#note-message').textContent};
}
const note={text:'The sink are leeking.\n\nThe attic was not inspectd because access was blocked.',textRuns:[{text:'The sink are leeking.\n\n',bold:true},{text:'The attic was not inspectd because access was blocked.'}],category:'Deficient',photos:[{src:'synthetic-photo'}],includeInSummary:true};

test('one click sends the entire current editor, applies wording only, and repeated clicks use the latest text',async()=>{
 const inputs=[],c=client(async body=>{inputs.push(body.text);return {draft:body.text.replace('are leeking','is leaking').replace('inspectd','inspected')};});
 const draft=structuredClone(note),session=c.h.start(draft,true);c.set(note);draft.text='Stale cached value';
 await c.h.revise();assert.equal(inputs[0],note.text);assert.match(c.get().text,/is leaking/);assert.match(c.get().text,/was not inspected because access was blocked/);
 assert.deepEqual(draft.photos,note.photos);assert.equal(draft.category,note.category);assert.equal(draft.includeInSummary,true);assert.ok(session.aiUndo);assert.match(c.hint(),/Update note/);
 c.set({text:c.get().text+'\nThere is 2 cracks.'});await c.h.revise();assert.match(inputs[1],/There is 2 cracks\.$/);assert.equal(inputs.length,2);
 assert.deepEqual(c.requests.filter(r=>r.method==='POST').map(r=>Object.keys(r.body).sort()),[['language','text'],['language','text']]);
});
test('Undo restores original words and formatting, and later typing requires confirmation',async()=>{
 const c=client(),session=c.h.start(structuredClone(note),false);c.set(note);await c.h.revise();assert.match(c.hint(),/Add note/);
 await c.h.undo();assert.deepEqual(c.get(),{text:note.text,textRuns:note.textRuns});assert.equal(session.aiUndo,undefined);
 await c.h.revise();c.set({text:'New inspection observation.'});c.confirm(false);await c.h.undo();assert.equal(c.get().text,'New inspection observation.');c.confirm(true);await c.h.undo();assert.equal(c.get().text,note.text);
});
test('overlapping clicks make one request and edits made during generation are never overwritten',async()=>{
 let finish;const c=client(()=>new Promise(resolve=>finish=resolve)),draft=structuredClone(note);c.h.start(draft);c.set(note);
 const pending=c.h.revise();await new Promise(resolve=>setImmediate(resolve));await c.h.revise();assert.equal(c.requests.filter(r=>r.method==='POST').length,1);
 c.set({text:'New observation entered during generation.'});finish({draft:'Old response.'});await pending;assert.equal(c.get().text,'New observation entered during generation.');assert.match(c.hint(),/latest edits were kept/);
});
test('a closed or reopened editor never receives an abandoned AI result',async()=>{
 let finish;const c=client(()=>new Promise(resolve=>finish=resolve));c.h.start(structuredClone(note));c.set(note);const pending=c.h.revise();await new Promise(resolve=>setImmediate(resolve));c.h.close();c.h.start({text:'Different note'});c.set({text:'Different note'});finish({draft:'Late result'});await pending;assert.equal(c.get().text,'Different note');
});
test('missing credentials, old backend, blank text, and API failure preserve notes without unintended requests',async()=>{
 for(const settings of [{hasKey:false,model:''},{hasKey:true,model:'old'}]){const c=client(undefined,settings);c.h.start(structuredClone(note));c.set(note);await c.h.revise();assert.equal(c.requests.filter(r=>r.method==='POST').length,0);assert.equal(c.get().text,note.text);assert.match(c.hint(),/not been sent/);}
 const c=client(async()=>{throw Error('Simulated provider failure');}),session=c.h.start(structuredClone(note));c.set(note);await c.h.revise();assert.equal(c.get().text,note.text);assert.equal(session.aiBusy,false);assert.match(c.hint(),/Simulated provider failure/);
 c.set({text:'  '});await assert.rejects(c.h.revise(),/Enter a note/);
});
test('long notes are sent in full; malformed output and overly long input are rejected without replacement',async()=>{
 let sent;const c=client(async body=>{sent=body.text;return {draft:''};});const text='Observation. '.repeat(1100);c.h.start({text});c.set({text});await c.h.revise();assert.equal(sent,text);assert.equal(c.get().text,text);
 c.set({text:'x'.repeat(100001)});await assert.rejects(c.h.revise(),/100,000/);
});

test('backend sends all text with polish instructions, rejects truncated responses, and never saves AI output automatically',{skip:process.platform!=='win32'},async t=>{
 const dataDir=fs.mkdtempSync(path.resolve('work/ai-polish-test-')),app=createApp({dataDir,port:0});
 const encryptedKey=dpapi('synthetic-test-key-not-a-secret');
 app.db.prepare('INSERT OR REPLACE INTO settings VALUES(1,?)').run(JSON.stringify({endpoint:'https://test-provider.invalid/v1/chat/completions',model:'synthetic-model',encryptedKey}));
 const url=await app.start(),home=await(await nativeFetch(url)).text(),token=home.match(/name="solo-token" content="([a-f0-9]+)"/)[1];
 const headers={'X-Solo-Token':token,'Content-Type':'application/json'},before=JSON.stringify(app.read());let captured,finishReason='stop',status=200;
 t.mock.method(globalThis,'fetch',async(endpoint,options)=>{assert.equal(endpoint,'https://test-provider.invalid/v1/chat/completions');captured=JSON.parse(options.body);assert.equal(options.redirect,'error');return new Response(JSON.stringify({choices:[{message:{content:'The sink is leaking.\n\nThe attic was not inspected because access was blocked.'},finish_reason:finishReason}]}),{status,headers:{'Content-Type':'application/json'}});});
 const request=text=>nativeFetch(url+'/api/ai',{method:'POST',headers,body:JSON.stringify({text,language:'English'})});
 try{
  const cfg=await(await nativeFetch(url+'/api/settings',{headers})).json();assert.equal(cfg.aiRevision,'polish-v2');assert.equal(cfg.encryptedKey,undefined);
  const text=note.text+'\n'+'Long paragraph. '.repeat(1000),response=await request(text);assert.equal(response.status,200);assert.match((await response.json()).draft,/sink is leaking/);
  assert.equal(captured.messages[2].content,text);assert.equal(captured.store,false);assert.match(captured.messages[0].content,/ALL of the supplied note text/);assert.match(captured.messages[0].content,/misspelled words, grammar/);assert.match(captured.messages[0].content,/Do not summarize/);assert.match(captured.messages[0].content,/negation/);
  finishReason='length';assert.equal((await request(note.text)).status,502);finishReason='stop';status=429;assert.equal((await request(note.text)).status,502);
  assert.equal((await request('x'.repeat(100001))).status,400);assert.equal(JSON.stringify(app.read()),before);
 }finally{await app.close();}
});
