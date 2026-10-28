'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {readFrontendAsset,bundleFrontend}=require('../app/frontend'),{createApp}=require('../app/server');
const publicDir=path.resolve(__dirname,'../app/public');
function loadBrowserScripts(scripts){
 const node={content:'test-token',addEventListener(){}};
 const context=vm.createContext({document:{querySelector:()=>node,addEventListener(){}},window:{addEventListener(){}},fetch:()=>new Promise(()=>{}),setTimeout,clearTimeout});
 for(const source of scripts)vm.runInContext(source,context);
 assert.equal(typeof context.Wording.render,'function');assert.equal(typeof context.wordingMarkup,'function');assert.equal(typeof context.openNoteLibrary,'function');assert.equal(typeof context.PhotoEditor.mount,'function');assert.equal(typeof context.PhotoEditor.turn,'function');
 const markup=context.wordingMarkup('test-editor','Test note',{text:'Leak <test>',textRuns:[{text:'Leak <test>',bold:true}]});
 assert.ok(markup.includes('contenteditable="true"'));assert.ok(markup.includes('<strong>Leak &lt;test&gt;</strong>'));assert.ok(markup.includes('Text color'));
}
test('the page uses only established script routes, and they load all editor dependencies',()=>{
 const home=fs.readFileSync(path.join(publicDir,'index.html'),'utf8'),names=[...home.matchAll(/<script src="\/([^"]+)" defer><\/script>/g)].map(m=>m[1]);assert.deepEqual(names,['app.js','bank.js','notes.js']);
 loadBrowserScripts(names.map(name=>readFrontendAsset(publicDir,name)));
});
test('an immediate state response cannot render before the deferred bank and note scripts load',async()=>{
 const {seed,categories,ratings}=require('../app/seed'),nodes=new Map(),events=new Map(),requests=[];
 const node=key=>{if(!nodes.has(key))nodes.set(key,{content:'test-token',addEventListener(){},querySelectorAll:()=>[],classList:{toggle(){}}});return nodes.get(key);};
 const context=vm.createContext({document:{documentElement:{dataset:{}},readyState:'interactive',querySelector:node,getElementById:()=>null,addEventListener:(name,fn)=>events.set(name,fn)},window:{addEventListener(){}},fetch:async url=>{requests.push(url);return {ok:true,headers:{get:()=> 'application/json'},json:async()=>url==='/api/hosting'?{configured:false,enabled:false,publications:[]}:{state:seed(),revision:0,categories,ratings,dataDir:'test'}};},setTimeout,clearTimeout});
 vm.runInContext(readFrontendAsset(publicDir,'app.js'),context);await Promise.resolve();assert.equal(requests.length,0);
 for(const name of ['bank.js','notes.js'])vm.runInContext(readFrontendAsset(publicDir,name),context);
 events.get('DOMContentLoaded')();await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(requests,['/api/hosting','/api/state']);assert.ok(node('#main').innerHTML.includes('Report library'));assert.equal(node('#save-status').textContent,'✓ Local data loaded');
 await context.boot();assert.equal(requests.length,4);assert.equal(node('#save-status').textContent,'✓ Local data loaded');
});
test('packaged scripts work when an older server serves them directly, and a new server never bundles them twice',()=>{
 const dir=fs.mkdtempSync(path.resolve('work/frontend-package-test-'));fs.cpSync(publicDir,dir,{recursive:true});bundleFrontend(publicDir,dir);
 const names=['app.js','bank.js','notes.js'];loadBrowserScripts(names.map(name=>fs.readFileSync(path.join(dir,name),'utf8')));
 for(const name of names)assert.equal(readFrontendAsset(dir,name),fs.readFileSync(path.join(dir,name),'utf8'));
 loadBrowserScripts(names.map(name=>readFrontendAsset(dir,name)));
});
test('development HTTP responses include the same complete dependencies without extra browser requests',async()=>{
 const dataDir=fs.mkdtempSync(path.resolve('work/frontend-http-test-')),app=createApp({dataDir,port:0});
 try{const url=await app.start(),scripts=[];for(const name of ['app.js','bank.js','notes.js']){const response=await fetch(url+'/'+name);assert.equal(response.status,200);scripts.push(await response.text());}loadBrowserScripts(scripts);}finally{await app.close();}
});
