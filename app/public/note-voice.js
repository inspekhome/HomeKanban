(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.NoteVoice=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 'use strict';
 const microphone='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8"/></svg>';
 function toolbar(){return `<div class="note-voice-tools"><button type="button" class="note-voice-button" data-note-action="voice" aria-label="Start voice input" aria-pressed="false" aria-controls="note-text" aria-describedby="note-voice-help" title="Start voice input">${microphone}<span data-voice-label>Voice input</span></button><button type="button" class="note-voice-cancel quiet" data-note-action="cancel-voice" hidden>Cancel voice</button></div>`;}
 function help(){return `<div class="note-voice-info"><p id="note-voice-help">Record, then click Stop to transcribe with OpenAI. Languages are detected automatically. Internet, an API key, and API charges apply.</p><p id="note-voice-status" role="status" aria-live="polite"></p><p id="note-voice-interim" aria-live="off" hidden></p></div>`;}
 // Permission lasts only for one visit to a report, not for the browser session.
 function createConsentGate(){
  let scope=null;
  function enter(reportId){if((scope?.id||null)!==(reportId||null))scope=reportId?{id:reportId,allowed:false,pending:false}:null;}
  async function request(reportId,confirm,isCurrent=()=>true){
   const owner=scope;if(!owner||owner.id!==reportId||!isCurrent())return false;
   if(owner.allowed)return true;if(owner.pending)return false;owner.pending=true;
   try{const approved=await confirm();if(scope!==owner||!isCurrent()||approved!==true)return false;owner.allowed=true;return true;}
   finally{owner.pending=false;}
  }
  return {enter,request};
 }
 // Microphone audio stays in memory; only Stop submits it. A stale note can
 // neither upload a late recording nor receive a late transcription result.
 function create({getUserMedia,Recorder,transcribe,isCurrent=()=>true,onText=()=>{},onInterim=()=>{},onState=()=>{},onMessage=()=>{},setTimer=setTimeout,clearTimer=clearTimeout}){
  let current=null,disposed=false;
  const active=s=>!disposed&&current===s&&isCurrent();
  const tracks=s=>{for(const track of s.stream?.getTracks()||[])track.stop();};
  function finish(s,message,complete){
   if(current!==s)return;const notify=active(s);current=null;clearTimer(s.timer);tracks(s);s.controller?.abort();
   if(s.rec)s.rec.ondataavailable=s.rec.onstop=s.rec.onerror=null;
   s.chunks=[];s.audio=null;s.resolve?.(complete);if(notify){onState('idle');onInterim('');if(message)onMessage(message);}
  }
  function abort(message=''){const s=current;if(!s)return;const rec=s.rec;finish(s,message,false);try{if(rec?.state!=='inactive')rec?.stop();}catch{}}
  async function upload(s){
   if(!active(s)){if(current===s)abort();return;}
   clearTimer(s.timer);tracks(s);onState('transcribing');onMessage('Transcribing with OpenAI…');
   s.controller=new AbortController();
   try{
    const text=await transcribe(s.audio,s.controller.signal);
    if(!active(s)){if(current===s)abort();return;}
    if(typeof text!=='string'||!text.trim())throw Error('No speech was recognized. Retry or record again.');
    onText(text);finish(s,'Voice text added. Review it, or use AI Revise to polish or translate it.',true);
   }catch(error){
    if(!active(s)){if(current===s)abort();return;}
    const resolve=s.resolve;s.wait=null;s.resolve=null;onState('retry');onMessage((error.message||'Transcription failed.')+' Your recording is kept in this open note only. Click Retry to resend, or Cancel voice to discard it.');resolve?.(false);
   }
  }
  async function start(){
   if(disposed||current||!isCurrent())return;
   if(typeof getUserMedia!=='function'||typeof Recorder!=='function'){onMessage('Recording is unavailable in this browser. Use a current Chrome or Edge browser.');return;}
   const mime=['audio/webm;codecs=opus','audio/webm','audio/mp4'].find(type=>Recorder.isTypeSupported(type));
   if(!mime){onMessage('This browser cannot make a supported recording. Use a current Chrome or Edge browser.');return;}
   const s={stream:null,rec:null,chunks:[],bytes:0,timer:null,audio:null,wait:null};current=s;onState('starting');onMessage('Allow microphone access if your browser asks.');
   try{
    s.stream=await getUserMedia({audio:true});
    if(!active(s)){tracks(s);if(current===s)abort();return;}
    s.rec=new Recorder(s.stream,{mimeType:mime,audioBitsPerSecond:64000});
    s.rec.ondataavailable=event=>{if(!active(s))return;if(event.data?.size){s.bytes+=event.data.size;if(s.bytes>20*1024*1024){abort('Recording exceeded 20 MB. Please record a shorter note.');return;}s.chunks.push(event.data);}};
    s.rec.onerror=()=>abort('Microphone recording failed. Your existing note is unchanged.');
    s.rec.onstop=()=>{
     if(!active(s)){tracks(s);if(current===s)abort();return;}
     tracks(s);s.audio=new Blob(s.chunks,{type:s.rec.mimeType||mime});s.chunks=[];
     if(!s.audio.size){finish(s,'No audio was recorded. Please try again.',false);return;}
     void upload(s);
    };
    s.rec.start(1000);onState('listening');onMessage('Recording… Speak in any supported language. Click Stop to transcribe. Maximum 3 minutes.');
    s.timer=setTimer(()=>{if(active(s))void stop();},180000);
   }catch(error){if(current===s)finish(s,error.name==='NotAllowedError'?'Microphone permission was not granted. Allow it in your browser and Windows settings.':error.name==='NotFoundError'?'No microphone was found. Connect a microphone and try again.':'The microphone could not start. Check your microphone and browser settings.',false);}
  }
  function stop(){
   const s=current;if(!s)return Promise.resolve(true);if(s.wait)return s.wait;
   if(!s.rec){abort('Voice input cancelled.');return Promise.resolve(false);}
   s.wait=new Promise(resolve=>s.resolve=resolve);const wait=s.wait;
   if(s.audio){void upload(s);return wait;}
   onState('stopping');onMessage('Finishing recording…');clearTimer(s.timer);
   s.timer=setTimer(()=>{if(current===s)abort('The recorder did not finish. Please record again.');},5000);
   try{s.rec.stop();}catch{abort('The recorder could not finish. Your existing note is unchanged.');}
   return wait;
  }
  function dispose(){abort();disposed=true;}
  return {start,stop,abort,dispose,get active(){return !!current;}};
 }
 return Object.freeze({toolbar,help,create,createConsentGate});
});
