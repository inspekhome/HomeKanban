'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),{createHash}=require('node:crypto');
const {MemoryR2}=require('./helpers/memory-r2.cjs');
// Expose helpers only in this test module. Worker deployments accept handler
// exports, not arbitrary constants; production source stays self-contained.
const source=require('node:fs').readFileSync(require('node:path').join(__dirname,'../app/hosting/worker.mjs'),'utf8');
const modulePromise=import('data:text/javascript;base64,'+Buffer.from(source+'\nexport { PRINT_SCRIPT, replaceMarker };').toString('base64'));
const sha=value=>createHash('sha256').update(value).digest('base64');
test('legacy published snapshots gain a working print control and an exact script hash without changing stored bytes',async()=>{
 const {default:worker,PRINT_SCRIPT}=await modulePromise,bucket=new MemoryR2(),id='a'.repeat(64),key='b'.repeat(64);
 const original='<!doctype html><html><body><button onclick="window.print()">Print / Save PDF</button><p>房屋 🏠</p></body></html>';
 const manifest={files:[{name:'index.html',bytes:Buffer.byteLength(original),sha256:createHash('sha256').update(original).digest('hex')}]};
 const request=(route,method='GET',body)=>worker.fetch(new Request('https://synthetic.example.workers.dev'+route,{method,headers:{Authorization:'Bearer '+key},body:body===undefined?undefined:typeof body==='string'?body:JSON.stringify(body)}),{REPORTS:bucket,HOMEKANBAN_PUBLISH_KEY:key});
 const base='/api/v1/publications/'+id;
 assert.equal((await request(base,'POST',manifest)).status,200);
 assert.equal((await request(base+'/files/index.html','PUT',original)).status,200);
 assert.equal((await request(base+'/commit','POST',{})).status,200);
 const page=await request('/r/'+id+'/'),csp=page.headers.get('Content-Security-Policy'),html=await page.text();
 assert.match(html,/<button type="button" data-homekanban-print>/);assert.ok(!html.includes('onclick='));
 assert.match(html,/房屋 🏠/);assert.equal(html.match(/<script>([\s\S]*?)<\/script>/)[1],PRINT_SCRIPT);
 assert.ok(csp.includes("script-src 'sha256-"+sha(PRINT_SCRIPT)+"'"));assert.ok(csp.includes("script-src-attr 'none'"));assert.ok(!csp.includes("script-src 'unsafe-inline'"));
 assert.match(csp,/default-src 'none'/);assert.equal(page.headers.get('Cache-Control'),'private, no-store, max-age=0');
 assert.equal((await bucket.get('homekanban/data/'+id+'/index.html')).body!==null,true);
 assert.equal(await(await bucket.get('homekanban/data/'+id+'/index.html')).text(),original);
 const head=await request('/r/'+id+'/','HEAD');assert.equal(await head.text(),'');assert.equal(head.headers.get('Content-Security-Policy'),csp);
 const api=await request(base);assert.ok(!api.headers.get('Content-Security-Policy').includes('script-src '));
 await request(base,'DELETE');assert.equal((await request('/r/'+id+'/')).status,404);
});
test('stream replacement preserves UTF-8, emoji and partial markers at every chunk boundary',async()=>{
 const {replaceMarker}=await modulePromise,marker='</body>',text=('中文🏠abc'.repeat(15))+marker+'é💧tail'+marker,bytes=Buffer.from(text),expected=text.replaceAll(marker,'<script>fixed</script>'+marker);
 for(let size=1;size<=bytes.length;size++){
  const stream=new ReadableStream({start(c){for(let i=0;i<bytes.length;i+=size)c.enqueue(bytes.subarray(i,i+size));c.close();}});
  assert.equal(await new Response(replaceMarker(stream,marker,'<script>fixed</script>'+marker)).text(),expected,'chunk size '+size);
 }
});
function printPage(script,images=[],fonts=Promise.resolve()){
 let click,notice,prints=0,timeout,cleared=false;
 const button={disabled:false,textContent:'Print / Save PDF',addEventListener:(event,fn)=>{assert.equal(event,'click');click=fn;},after:node=>notice=node};
 vm.runInNewContext(script,{document:{querySelector:()=>button,getElementById:()=>notice,createElement:()=>({setAttribute(){},textContent:''}),images,fonts:{ready:fonts}},window:{print:()=>prints++},setTimeout:fn=>{timeout=fn;return 123;},clearTimeout:id=>{if(id===123)cleared=true;}});
 return {button,click:()=>click(),timeout:()=>timeout(),get notice(){return notice;},get prints(){return prints;},get cleared(){return cleared;}};
}
test('printing waits for lazy photos and fonts, ignores duplicate clicks, then re-enables the button',async()=>{
 const {PRINT_SCRIPT}=await modulePromise;let photoReady,fontReady;
 const image={loading:'lazy',decode:()=>new Promise(resolve=>photoReady=resolve)},t=printPage(PRINT_SCRIPT,[image],new Promise(resolve=>fontReady=resolve));
 const pending=t.click();assert.equal(t.button.disabled,true);assert.equal(image.loading,'eager');assert.match(t.button.textContent,/Preparing/);
 await t.click();assert.equal(t.prints,0);photoReady();await Promise.resolve();assert.equal(t.prints,0);fontReady();await pending;
 assert.equal(t.prints,1);assert.equal(t.button.disabled,false);assert.equal(t.button.textContent,'Print / Save PDF');assert.equal(t.cleared,true);
});
test('failed photo preparation shows a clear retry message and can be retried',async()=>{
 const {PRINT_SCRIPT}=await modulePromise;let fail=true;const image={decode:()=>fail?Promise.reject(Error('offline')):Promise.resolve()},t=printPage(PRINT_SCRIPT,[image]);
 await t.click();assert.equal(t.prints,0);assert.match(t.notice.textContent,/Check your connection and try again/);assert.equal(t.button.disabled,false);
 fail=false;await t.click();assert.equal(t.prints,1);assert.equal(t.notice.textContent,'');
});
test('a stalled photo times out without opening an incomplete print dialog',async()=>{
 const {PRINT_SCRIPT}=await modulePromise,t=printPage(PRINT_SCRIPT,[{decode:()=>new Promise(()=>{})}]);const pending=t.click();t.timeout();await pending;
 assert.equal(t.prints,0);assert.equal(t.button.disabled,false);assert.match(t.notice.textContent,/Unable to prepare/);assert.equal(t.cleared,true);
});
