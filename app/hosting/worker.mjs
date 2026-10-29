// HomeKanban web reports. Bind private R2 as REPORTS.
// Set HOMEKANBAN_PUBLISH_KEY as a Worker Secret (64 random hexadecimal characters).
// This file is self-contained so it can be pasted into the Cloudflare editor.
const VERSION = '1';
const MAX_FILE = 12 * 1024 * 1024, MAX_TOTAL = 100 * 1024 * 1024, MAX_FILES = 1000;
const ID = /^[a-f0-9]{64}$/, NAME = /^(index\.html|[a-f0-9]{64}\.(jpg|png|webp))$/;
const TYPES = {html:'text/html; charset=utf-8',jpg:'image/jpeg',png:'image/png',webp:'image/webp'};
const controlKey = id => 'homekanban/control/' + id + '.json';
const dataPrefix = id => 'homekanban/data/' + id + '/';
const headers = {
  'Cache-Control':'private, no-store, max-age=0',
  'CDN-Cache-Control':'no-store', 'Cloudflare-CDN-Cache-Control':'no-store',
  'X-Content-Type-Options':'nosniff', 'X-Robots-Tag':'noindex, nofollow, noarchive',
  'Referrer-Policy':'no-referrer', 'X-Frame-Options':'DENY',
  'Content-Security-Policy':"default-src 'none'; img-src 'self'; font-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
};
// Only this fixed script is allowed on report pages. Narrative content remains
// escaped by the report renderer; arbitrary scripts and inline handlers stay blocked.
const PRINT_SCRIPT = `(function(){
'use strict';
const button=document.querySelector('[data-homekanban-print]');
if(!button)return;
let preparing=false;
button.addEventListener('click',async function(){
 if(preparing)return;
 preparing=true;button.disabled=true;const label=button.textContent;
 button.textContent='Preparing photos…';
 let notice=document.getElementById('homekanban-print-status');
 if(!notice){notice=document.createElement('span');notice.id='homekanban-print-status';notice.setAttribute('role','status');button.after(notice);}
 notice.textContent='';let timer;
 try{
  const images=Array.from(document.images).map(function(img){
   img.loading='eager';
   if(typeof img.decode==='function')return img.decode();
   if(img.complete)return img.naturalWidth?Promise.resolve():Promise.reject(new Error('Photo unavailable'));
   return new Promise(function(resolve,reject){img.addEventListener('load',resolve,{once:true});img.addEventListener('error',reject,{once:true});});
  });
  await Promise.race([Promise.all(images),new Promise(function(_,reject){timer=setTimeout(function(){reject(new Error('Photo timeout'));},30000);})]);
  if(document.fonts)await document.fonts.ready;
  window.print();
 }catch(error){notice.textContent=' Unable to prepare this report for printing. Check your connection and try again.';}
 finally{clearTimeout(timer);button.textContent=label;button.disabled=false;preparing=false;}
});
})();`;
let printPolicy;
async function reportHeaders(paymentStatus){
 if(paymentStatus!=='paid')return headers;
 if(!printPolicy)printPolicy=crypto.subtle.digest('SHA-256',new TextEncoder().encode(PRINT_SCRIPT)).then(bytes=>{
  const hash=btoa(String.fromCharCode(...new Uint8Array(bytes)));
  return headers['Content-Security-Policy']+"; script-src 'sha256-"+hash+"'; script-src-attr 'none'";
 });
 return {...headers,'Content-Security-Policy':await printPolicy};
}
// The report generator emits these exact, trusted markers. Replace them as a
// stream so large HTML reports do not need multiple full in-memory copies.
function replaceMarker(stream,marker,replacement){
 const decoder=new TextDecoder(),encoder=new TextEncoder();let pending='';
 const emit=(controller,final)=>{
  let index;
  while((index=pending.indexOf(marker))!==-1){controller.enqueue(encoder.encode(pending.slice(0,index)+replacement));pending=pending.slice(index+marker.length);}
  let count=final?pending.length:Math.max(0,pending.length-marker.length+1);
  // Never encode half of a surrogate pair at a stream boundary.
  if(count<pending.length&&count>0&&pending.charCodeAt(count-1)>=0xd800&&pending.charCodeAt(count-1)<=0xdbff)count--;
  if(count){controller.enqueue(encoder.encode(pending.slice(0,count)));pending=pending.slice(count);}
 };
 return stream.pipeThrough(new TransformStream({
  transform(chunk,controller){pending+=decoder.decode(chunk,{stream:true});emit(controller,false);},
  flush(controller){pending+=decoder.decode();emit(controller,true);}
 }));
}
function printableReport(stream,paymentStatus){
 const button='<button onclick="window.print()">Print / Save PDF</button>';
 if(paymentStatus!=='paid'){
  const toolbar='<div class="toolbar">Home inspection report &nbsp; '+button+'</div>';
  const reminder=`<style>
.toolbar{display:none!important}
.homekanban-payment-reminder{position:fixed;z-index:1000;top:clamp(72px,12vh,112px);left:16px;right:16px;box-sizing:border-box;min-height:108px;padding:20px 28px;border:1px solid #d6a847;border-left:6px solid #b67c17;border-radius:10px;background:#ffedb7;color:#5b3b09;box-shadow:0 5px 18px #3d2d142e;font:18px/1.5 Arial,sans-serif;text-align:center;pointer-events:none;overflow-wrap:anywhere}
.homekanban-payment-reminder strong{display:block;margin-bottom:4px;font-size:23px;line-height:1.3}
@media(max-width:650px){.homekanban-payment-reminder{top:max(64px,env(safe-area-inset-top));left:8px;right:8px;min-height:0;padding:16px 18px;font-size:15px;line-height:1.45}.homekanban-payment-reminder strong{font-size:20px}}
@media(max-height:420px){.homekanban-payment-reminder{top:32px;min-height:0;padding:10px 16px;font-size:14px}.homekanban-payment-reminder strong{font-size:18px}}
@media print{.homekanban-payment-reminder{display:none!important}}
</style><aside class="homekanban-payment-reminder" aria-label="Payment reminder"><strong>Payment Reminder:</strong> Payment for this inspection is still outstanding. Please arrange payment at your convenience.</aside>`;
  // Remove the hosted toolbar and its print action, including on older snapshots.
  // This controls our UI; it cannot prevent the browser's own print or screenshot tools.
  stream=replaceMarker(replaceMarker(stream,toolbar,''),button,'');
  return replaceMarker(stream,'<body>','<body>'+reminder);
 }
 return replaceMarker(replaceMarker(stream,button,'<button type="button" data-homekanban-print>Print / Save PDF</button>'),'</body>','<script>'+PRINT_SCRIPT+'</script></body>');
}
function result(value,status=200) { return new Response(JSON.stringify(value),{status,headers:{...headers,'Content-Type':'application/json; charset=utf-8'}}); }
function fail(message,status=400) { throw Object.assign(new Error(message),{status}); }
async function bytes(request,limit) {
  if(Number(request.headers.get('Content-Length')||0)>limit) fail('Upload is too large.',413);
  if(!request.body)return new Uint8Array();
  const reader=request.body.getReader(),chunks=[];let size=0;
  try {
    for(;;){const next=await reader.read();if(next.done)break;size+=next.value.length;if(size>limit){await reader.cancel();fail('Upload is too large.',413);}chunks.push(next.value);}
  } finally {reader.releaseLock();}
  const output=new Uint8Array(size);let offset=0;for(const chunk of chunks){output.set(chunk,offset);offset+=chunk.length;}return output;
}
async function json(request) {
  try{return JSON.parse(new TextDecoder().decode(await bytes(request,512*1024)));}
  catch(error){if(error.status)throw error;fail('Invalid request.');}
}
async function authorized(request,secret) {
  if(typeof secret!=='string'||!ID.test(secret))return false;
  const value=request.headers.get('Authorization')||'';
  if(!/^Bearer [a-f0-9]{64}$/.test(value))return false;
  const a=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value.slice(7))));
  const b=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(secret)));
  let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];return diff===0;
}
async function read(bucket,id) {
  const object=await bucket.get(controlKey(id));
  return object?{value:await object.json(),etag:object.etag}:null;
}
async function write(bucket,id,value,previous) {
  const condition=new Headers(previous?{'If-Match':'"'+previous.etag+'"'}:{'If-None-Match':'*'});
  return bucket.put(controlKey(id),JSON.stringify(value),{onlyIf:condition,httpMetadata:{contentType:'application/json',cacheControl:'no-store'}});
}
function validateManifest(input) {
  if(!input||!Array.isArray(input.files)||!input.files.length||input.files.length>MAX_FILES)fail('Invalid file manifest.');
  const seen=new Set();let total=0;
  const files=input.files.map(file=>{
    if(!file||!NAME.test(file.name)||seen.has(file.name)||!ID.test(file.sha256)||!Number.isSafeInteger(file.bytes)||file.bytes<1||file.bytes>MAX_FILE)fail('Invalid file manifest.');
    if(file.name!=='index.html'&&!file.name.startsWith(file.sha256+'.'))fail('Invalid image hash.');
    seen.add(file.name);total+=file.bytes;return {name:file.name,sha256:file.sha256,bytes:file.bytes};
  });
  if(!seen.has('index.html')||total>MAX_TOTAL)fail('A web report must contain index.html and fit within 100 MB.',413);
  return files;
}
function publicStatus(record) {
  return {status:record?.status||'missing',created:record?.created||null,files:record?.files?.length||0,uploaded:record?.uploaded?.length||0,...(record&&record.status!=='revoked'?{paymentStatus:record.paymentStatus||'unpaid'}:{})};
}
async function revoke(bucket,id) {
  // A permanent tombstone prevents a delayed begin/commit from restoring an old link.
  for(let attempt=0;attempt<12;attempt++){
    const old=await read(bucket,id);
    if(old?.value.status==='revoked')break;
    const value={status:'revoked',created:old?.value.created||new Date().toISOString(),revoked:new Date().toISOString()};
    if(await write(bucket,id,value,old))break;
    if(attempt===11)fail('Publication changed. Retry termination.',409);
  }
  let cleaned=true,cursor;
  try {
    do {
      const page=await bucket.list({prefix:dataPrefix(id),limit:500,...(cursor?{cursor}:{})});
      if(page.objects.length)await bucket.delete(page.objects.map(object=>object.key));
      cursor=page.truncated?page.cursor:undefined;
    } while(cursor);
  } catch {cleaned=false;}
  return {status:'revoked',cleaned};
}
async function admin(request,env,url) {
  if(!await authorized(request,env.HOMEKANBAN_PUBLISH_KEY))fail('Publishing key is missing or incorrect.',401);
  const bucket=env.REPORTS;if(!bucket)fail('Bind the private R2 bucket as REPORTS.',503);
  if(url.pathname==='/api/v1/connection'&&request.method==='GET'){
    await bucket.head('homekanban/connection-check');
    return result({service:'HomeKanban',protocol:VERSION,storage:'connected',capabilities:['payment-status-v1']});
  }
  if(url.pathname==='/api/v1/publications'&&request.method==='GET'){
    const cursor=url.searchParams.get('cursor');if(cursor&&cursor.length>4096)fail('Invalid cursor.');
    const page=await bucket.list({prefix:'homekanban/control/',limit:20,...(cursor?{cursor}:{})});
    const records=[];
    for(const object of page.objects){
      const id=object.key.slice('homekanban/control/'.length,-5);if(!ID.test(id))continue;
      const record=await read(bucket,id);if(record?.value.status!=='revoked')records.push({id,...publicStatus(record?.value)});
    }
    return result({records,cursor:page.truncated?page.cursor:null});
  }
  const match=url.pathname.match(/^\/api\/v1\/publications\/([a-f0-9]{64})(?:\/(commit|payment|files\/[^/]+))?$/);
  if(!match)fail('Not found.',404);
  const [,id,operation]=match;
  if(!operation&&request.method==='DELETE')return result(await revoke(bucket,id));
  let current=await read(bucket,id);
  if(!operation&&request.method==='GET')return result(publicStatus(current?.value));
  if(!operation&&request.method==='POST'){
    const input=await json(request),files=validateManifest(input),paymentStatus=input.paymentStatus??'unpaid';
    if(!['paid','unpaid'].includes(paymentStatus))fail('Invalid payment status.');
    if(!current){
      const value={status:'staging',created:new Date().toISOString(),files,uploaded:[],paymentStatus};
      await write(bucket,id,value,null);current=await read(bucket,id);
    }
    if(current?.value.status==='revoked')fail('This link was terminated. Publish with a new link.',409);
    if(JSON.stringify(current?.value.files)!==JSON.stringify(files))fail('This publication belongs to a different report snapshot.',409);
    return result(publicStatus(current.value));
  }
  if(!current||current.value.status==='revoked')fail('Publication is unavailable.',409);
  if(operation==='payment'&&request.method==='PUT'){
    const input=await json(request);
    if(!input||!['paid','unpaid'].includes(input.paymentStatus))fail('Invalid payment status.');
    // Update only the control record. A concurrent revocation must always win.
    for(let attempt=0;attempt<12;attempt++){
      current=await read(bucket,id);
      if(current?.value.status!=='published')fail('Publication is unavailable.',409);
      const next={...current.value,paymentStatus:input.paymentStatus};
      if(await write(bucket,id,next,current))return result(publicStatus(next));
    }
    fail('Publication changed. Retry the payment update.',409);
  }
  if(operation?.startsWith('files/')&&request.method==='PUT'){
    if(current.value.status!=='staging')fail('Published files cannot be changed.',409);
    const name=operation.slice(6),file=current.value.files.find(f=>f.name===name);
    if(!file)fail('File is not in this report.',400);
    const content=await bytes(request,file.bytes);
    if(content.length!==file.bytes)fail('The upload is incomplete.',400);
    const key=dataPrefix(id)+name;
    // R2 validates the supplied checksum before accepting the object.
    const stored=await bucket.put(key,content,{sha256:file.sha256,onlyIf:new Headers({'If-None-Match':'*'}),customMetadata:{sha256:file.sha256},httpMetadata:{contentType:TYPES[name.split('.').at(-1)],cacheControl:'no-store'}});
    if(!stored){const existing=await bucket.head(key);if(existing?.size!==file.bytes||existing.customMetadata?.sha256!==file.sha256)fail('Stored file mismatch.',409);}
    for(let attempt=0;attempt<12;attempt++){
      current=await read(bucket,id);
      if(!current||current.value.status==='revoked'){await bucket.delete(key);fail('Publication was terminated.',409);}
      if(current.value.uploaded.includes(name))return result({uploaded:name});
      if(current.value.status!=='staging')fail('Publication changed.',409);
      const next={...current.value,uploaded:[...current.value.uploaded,name]};
      if(await write(bucket,id,next,current))return result({uploaded:name});
    }
    fail('Publication changed. Retry this upload.',409);
  }
  if(operation==='commit'&&request.method==='POST'){
    if(current.value.status==='published')return result({status:'published'});
    if(!current.value.files.every(file=>current.value.uploaded.includes(file.name)))fail('Some report files have not been uploaded.',409);
    const next={...current.value,status:'published',published:new Date().toISOString()};
    if(!await write(bucket,id,next,current)){
      current=await read(bucket,id);
      if(current?.value.status!=='published')fail('Publication changed or was terminated.',409);
    }
    return result({status:'published'});
  }
  fail('Method not allowed.',405);
}
async function serve(request,env,url) {
  if(!['GET','HEAD'].includes(request.method))fail('Method not allowed.',405);
  const match=url.pathname.match(/^\/r\/([a-f0-9]{64})(\/(?:files\/([a-f0-9]{64}\.(?:jpg|png|webp)))?)?$/);
  const unavailable=()=>new Response(request.method==='HEAD'?null:'This report is no longer available.',{status:404,headers:{...headers,'Content-Type':'text/plain; charset=utf-8'}});
  if(!match||!env.REPORTS)return unavailable();
  const [,id,,photo]=match,name=photo||'index.html';
  let record=await read(env.REPORTS,id);
  if(record?.value.status!=='published'||!record.value.files.some(f=>f.name===name))return unavailable();
  if(!photo&&!url.pathname.endsWith('/'))return new Response(null,{status:302,headers:{...headers,Location:'/r/'+id+'/'}});
  const object=await env.REPORTS.get(dataPrefix(id)+name);if(!object)return unavailable();
  // Re-check after fetching the object so a revocation racing with a read wins.
  record=await read(env.REPORTS,id);if(record?.value.status!=='published'){await object.body?.cancel();return unavailable();}
  if(request.method==='HEAD')await object.body?.cancel();
  return new Response(request.method==='HEAD'?null:photo?object.body:printableReport(object.body,record.value.paymentStatus),{headers:{...(photo?headers:await reportHeaders(record.value.paymentStatus)),'Content-Type':TYPES[name.split('.').at(-1)]}});
}
export default {
  async fetch(request,env){
    try {
      const url=new URL(request.url);
      if(url.protocol!=='https:')return new Response('HTTPS is required.',{status:400,headers});
      if(url.pathname.startsWith('/api/'))return await admin(request,env,url);
      return await serve(request,env,url);
    } catch(error){return result({error:error.status?error.message:'The hosting operation could not be completed.'},error.status||503);}
  }
};
