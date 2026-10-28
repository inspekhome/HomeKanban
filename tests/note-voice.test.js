'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Voice=require('../app/public/note-voice');
function harness({transcribe,getUserMedia}={}){
 const instances=[],text=[],messages=[],states=[],timers=new Map(),uploads=[],track={stops:0,stop(){this.stops++;}};let valid=true,next=0;
 class Recorder{
  static isTypeSupported(type){return type==='audio/webm;codecs=opus';}
  constructor(stream,options){this.mimeType=options.mimeType;this.state='inactive';instances.push(this);}
  start(){this.state='recording';}
  stop(){this.state='inactive';this.ondataavailable?.({data:new Blob([new Uint8Array([0x1a,0x45,0xdf,0xa3,0,1])],{type:this.mimeType})});this.onstop?.();}
 }
 const c=Voice.create({getUserMedia:getUserMedia||(async()=>({getTracks:()=>[track]})),Recorder,transcribe:async(blob,signal)=>{uploads.push({blob,signal});return transcribe?transcribe(blob,signal):'The pipe is leaking. 水管漏水。';},isCurrent:()=>valid,onText:t=>text.push(t),onState:s=>states.push(s),onMessage:m=>messages.push(m),setTimer:(fn,ms)=>{const id=++next;timers.set(id,{fn,ms});return id;},clearTimer:id=>timers.delete(id)});
 return {c,instances,text,states,messages,timers,uploads,track,invalidate:()=>valid=false};
}
test('compact voice controls keep accessible help and live feedback outside the formatting toolbar',()=>{
 const ctx=vm.createContext({NoteVoice:Voice,Wording:require('../app/public/wording'),document:{addEventListener(){}}});vm.runInContext(fs.readFileSync(require.resolve('../app/public/wording-editor'),'utf8'),ctx);
 const {JSDOM}=require('../scripts/editor/node_modules/jsdom');
 const html=ctx.wordingMarkup('note-text','Note / report narrative',{text:'Existing wording'},'',true)+ctx.wordingToolbar('note-text','Note / report narrative',true),dom=new JSDOM(html),doc=dom.window.document;
 try{
  const button=doc.querySelector('[data-note-action="voice"]');assert.equal(button.getAttribute('aria-label'),'Start voice input');assert.equal(button.getAttribute('aria-controls'),'note-text');assert.ok(button.closest('.note-narrative-heading'));
  assert.match(doc.getElementById(button.getAttribute('aria-describedby')).textContent,/Voice input.*Internet.*API key.*API fees apply/);
  assert.equal(doc.getElementById('note-voice-status').getAttribute('aria-live'),'polite');assert.equal(doc.querySelectorAll('[data-wording-toolbar="note-text"]').length,1);assert.equal(doc.querySelector('.wording-color-swatches>span'),null);
  assert.equal(doc.querySelector('.wording-field .wording-toolbar'),null);assert.equal(doc.querySelector('#note-text').textContent,'Existing wording');
  assert.doesNotMatch(html,/<select/);assert.doesNotMatch(ctx.wordingMarkup('library-note-text','Wording'),/data-note-action="voice"/);
 }finally{dom.window.close();}
});
test('recording sends nothing until Stop, inserts mixed language text once, and releases capture',async()=>{
 const h=harness();assert.equal(h.instances.length,0);await h.c.start();await h.c.start();assert.equal(h.instances.length,1);assert.equal(h.uploads.length,0);assert.equal(h.c.active,true);
 const stop=h.c.stop();assert.equal(h.c.stop(),stop);assert.equal(await stop,true);assert.deepEqual(h.text,['The pipe is leaking. 水管漏水。']);assert.equal(h.uploads.length,1);assert.ok(h.track.stops>0);assert.equal(h.c.active,false);assert.equal(h.timers.size,0);
});
test('cancel during capture never uploads; closing during upload blocks late words',async()=>{
 const h=harness();await h.c.start();h.c.abort();assert.equal(h.uploads.length,0);assert.equal(h.track.stops,1);
 let finish;const late=harness({transcribe:()=>new Promise(resolve=>finish=resolve)});await late.c.start();const stop=late.c.stop();late.c.dispose();assert.equal(await stop,false);assert.equal(late.uploads[0].signal.aborted,true);finish('Late text');await new Promise(setImmediate);assert.deepEqual(late.text,[]);
});
test('a late microphone permission response is stopped without creating a recorder',async()=>{
 let allow;const h=harness({getUserMedia:()=>new Promise(resolve=>allow=resolve)});const start=h.c.start();h.c.abort();allow({getTracks:()=>[h.track]});await start;assert.equal(h.instances.length,0);assert.equal(h.track.stops,1);assert.equal(h.uploads.length,0);
});
test('failed transcription retains the recording for an explicit retry and cannot trigger save',async()=>{
 let calls=0;const h=harness({transcribe:async()=>{if(++calls===1)throw Error('Quota reached');return '수도관이 새고 있습니다.';}});await h.c.start();assert.equal(await h.c.stop(),false);assert.equal(h.states.at(-1),'retry');assert.equal(h.c.active,true);assert.deepEqual(h.text,[]);assert.equal(await h.c.stop(),true);assert.equal(h.instances.length,1);assert.deepEqual(h.text,['수도관이 새고 있습니다.']);assert.equal(h.uploads[0].blob,h.uploads[1].blob);
});
test('duration limit stops and transcribes, while stale report sessions never receive text',async()=>{
 const h=harness();await h.c.start();const timer=[...h.timers.values()][0];assert.equal(timer.ms,180000);timer.fn();await new Promise(setImmediate);assert.equal(h.text.length,1);
 const stale=harness();await stale.c.start();stale.invalidate();stale.instances[0].stop();assert.equal(stale.uploads.length,0);assert.equal(stale.track.stops>0,true);assert.equal(stale.c.active,false);
});
test('microphone denial and unsupported browsers leave the note untouched',async()=>{
 const h=harness({getUserMedia:async()=>{throw Object.assign(Error(),{name:'NotAllowedError'});}});await h.c.start();assert.equal(h.c.active,false);assert.match(h.messages.at(-1),/permission/);assert.deepEqual(h.text,[]);
 let message;const c=Voice.create({onMessage:m=>message=m});await c.start();assert.equal(c.active,false);assert.match(message,/Chrome or Edge/);
});

test('voice consent is reused within a report but renewed after leaving, reopening or switching',async()=>{
 const gate=Voice.createConsentGate();let prompts=0;const allow=async()=>{prompts++;return true;};
 gate.enter('A');assert.equal(await gate.request('A',allow),true);gate.enter('A');assert.equal(await gate.request('A',allow),true);assert.equal(prompts,1);
 gate.enter(null);gate.enter('A');assert.equal(await gate.request('A',allow),true);assert.equal(prompts,2);
 gate.enter('B');assert.equal(await gate.request('B',allow),true);assert.equal(prompts,3);
 gate.enter('A');assert.equal(await gate.request('A',allow),true);assert.equal(prompts,4);
});

test('Cancel never grants voice access, and an invalid note cannot reuse earlier permission',async()=>{
 const gate=Voice.createConsentGate();gate.enter('A');
 assert.equal(await gate.request('A',async()=>false),false);let prompts=0;
 assert.equal(await gate.request('A',async()=>{prompts++;return true;}),true);assert.equal(prompts,1);
 assert.equal(await gate.request('A',async()=>true,()=>false),false);
 assert.equal(await gate.request('B',async()=>true),false);
});

test('a late permission answer cannot authorize a reopened report or a replaced note',async()=>{
 const gate=Voice.createConsentGate();let resolve;gate.enter('A');
 const pending=gate.request('A',()=>new Promise(r=>resolve=r));
 assert.equal(await gate.request('A',async()=>true),false);
 gate.enter(null);gate.enter('A');resolve(true);assert.equal(await pending,false);
 let valid=true;const second=gate.request('A',()=>new Promise(r=>resolve=r),()=>valid);valid=false;resolve(true);assert.equal(await second,false);
 let prompts=0;assert.equal(await gate.request('A',async()=>{prompts++;return true;}),true);assert.equal(prompts,1);
});
