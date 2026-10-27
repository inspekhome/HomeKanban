'use strict';
const ENDPOINT='https://api.openai.com/v1/audio/transcriptions',MODEL='gpt-transcribe',MAX_AUDIO=20*1024*1024;
function fail(message,status=400){const error=new Error(message);error.status=status;throw error;}
function decodeAudio(body){
 const types={'audio/webm':'webm','audio/mp4':'mp4','audio/wav':'wav'},mime=String(body?.mime||'').split(';')[0];
 if(!Object.hasOwn(types,mime))fail('Unsupported recording format. Use a current Chrome or Edge browser.');
 if(typeof body.audio!=='string'||!body.audio.length||body.audio.length%4||body.audio.length>Math.ceil(MAX_AUDIO/3)*4||!/^[A-Za-z0-9+/]*={0,2}$/.test(body.audio))fail('The recording is invalid or larger than 20 MB.');
 const audio=Buffer.from(body.audio,'base64');if(!audio.length||audio.length>MAX_AUDIO||audio.toString('base64')!==body.audio)fail('The recording is empty, invalid, or larger than 20 MB.');
 const valid=mime==='audio/webm'?audio.subarray(0,4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3])):mime==='audio/mp4'?audio.subarray(4,8).toString()==='ftyp':audio.subarray(0,4).toString()==='RIFF'&&audio.subarray(8,12).toString()==='WAVE';
 if(!valid)fail('The recording could not be read. Please record again.');
 return {audio,mime,extension:types[mime]};
}
async function transcribe(body,key,{signal,fetchImpl=fetch}={}){
 const {audio,mime,extension}=decodeAudio(body),form=new FormData();
 form.append('file',new Blob([audio],{type:mime}),'recording.'+extension);form.append('model',MODEL);
 // No language restriction: keep Chinese, English, Korean, and mixed speech as spoken.
 form.append('prompt','Home inspection dictation, often in English. Transcribe only the words spoken, in their original languages. Do not translate or add observations.');
 const timeout=AbortSignal.timeout(90000);
 try{
  const response=await fetchImpl(ENDPOINT,{method:'POST',redirect:'error',headers:{Authorization:'Bearer '+key},body:form,signal:signal?AbortSignal.any([signal,timeout]):timeout});
  if(!response.ok)fail(response.status===401?'The Voice Input API key was rejected. Check it in AI & settings.':response.status===429?'The voice service reached its quota or rate limit. Check your OpenAI billing or retry later.':`The voice service returned HTTP ${response.status}. Check your OpenAI account and model access.`,502);
  const result=await response.json();if(typeof result.text!=='string'||!result.text.trim()||result.text.length>100000)fail('No usable speech was recognized. Retry or record again.',502);
  return {text:result.text.trim()};
 }catch(error){if(error.status)throw error;fail('Voice transcription failed or timed out. Your note is unchanged. OpenAI may have received the audio; retrying may incur another charge.',502);}
}
module.exports={ENDPOINT,MODEL,MAX_AUDIO,decodeAudio,transcribe};
