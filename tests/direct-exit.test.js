'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const {seed}=require('../app/seed');

// Exercise the real click handler and save queue; a failed save must never quit.
function client(view='reports'){
 const state=seed(),events=new Map(),nodes=new Map(),requests=[];let confirmations=0;
 const node=key=>{if(!nodes.has(key))nodes.set(key,{content:'test-token',innerHTML:'Open workspace',textContent:'',style:{},classList:{toggle(){},remove(){}},focus(){},addEventListener(){}});return nodes.get(key);};
 const context=vm.createContext({initialState:state,initialRoute:view,TypeError,AbortSignal,Wording:require('../app/public/wording'),structuredClone,crypto,setTimeout:()=>1,clearTimeout(){},confirm(){confirmations++;throw Error('Confirmation must not be used for Save or Exit');},fetch:(url,options)=>new Promise(resolve=>requests.push({url,options,reply(body,status=200){resolve({ok:status===200,status,headers:{get:()=> 'application/json'},json:async()=>body});}})),document:{body:{classList:{add(){}}},querySelectorAll:()=>[],querySelector:node,addEventListener:(name,fn)=>events.set(name,fn)},window:{close(){},addEventListener(){}}});
 const source=fs.readFileSync(require.resolve('../app/public/app.js'),'utf8');
 vm.runInContext(source.slice(0,source.lastIndexOf('\nboot().catch'))+`
 state=initialState;revision=7;route=initialRoute;state.reports.push(blankReport(state.templates[0],{id:'test-report'}));currentId=route==='editor'?'test-report':state.templates[0].id;
 globalThis.h={edit(value){state.profile.name=value;changed();},save:saveNow,get dirty(){return dirty;},get saved(){return saved;}};`,context);
 const click=action=>{const button={dataset:{action},isConnected:true,disabled:false};return {button,done:events.get('click')({target:{closest:()=>button}})};};
 return {h:context.h,requests,node,click,get confirmations(){return confirmations;}};
}
async function waitFor(c,count){for(let n=0;n<100&&c.requests.length<count;n++)await new Promise(setImmediate);assert.equal(c.requests.length,count);return c.requests[count-1];}

test('Exit saves first and quits directly from report and template views',async()=>{
 for(const view of ['reports','templates','editor','template-editor']){
  const c=client(view);c.h.edit('Pending '+view);const exit=c.click('quit');assert.equal(exit.button.disabled,true);
  const save=await waitFor(c,1);assert.equal(save.url,'/api/state');assert.equal(save.options.method,'PUT');assert.equal(JSON.parse(save.options.body).state.profile.name,'Pending '+view);assert.equal(JSON.parse(save.options.body).revision,7);
  save.reply({revision:8});const quit=await waitFor(c,2);assert.equal(quit.url,'/api/quit');assert.equal(quit.options.method,'POST');quit.reply({ok:true});await exit.done;
  assert.equal(c.confirmations,0);assert.equal(c.h.saved,c.h.dirty);assert.match(c.node('#main').innerHTML,/Safely closed/);
 }
});

test('Exit waits for an autosave and for edits made while that save is pending',async()=>{
 const c=client('editor');c.h.edit('First draft');const saving=c.h.save(),exit=c.click('quit');c.h.edit('Latest draft');
 const first=await waitFor(c,1);first.reply({revision:8});const second=await waitFor(c,2);assert.equal(second.url,'/api/state');assert.equal(JSON.parse(second.options.body).revision,8);assert.equal(JSON.parse(second.options.body).state.profile.name,'Latest draft');
 second.reply({revision:9});const quit=await waitFor(c,3);assert.equal(quit.url,'/api/quit');quit.reply({ok:true});await Promise.all([saving,exit.done]);assert.equal(c.h.saved,c.h.dirty);assert.equal(c.confirmations,0);
});

test('A failed save keeps the app open, retains changes and allows Exit to retry',async()=>{
 const c=client('template-editor');c.h.edit('Keep my template edits');const first=c.click('quit');(await waitFor(c,1)).reply({error:'Disk is full'},500);await first.done;
 assert.equal(c.requests.length,1);assert.equal(first.button.disabled,false);assert.equal(c.node('#main').innerHTML,'Open workspace');assert.equal(c.h.saved,0);assert.equal(c.h.dirty,1);assert.match(c.node('#toast').textContent,/Disk is full/);
 const retry=c.click('quit');const save=await waitFor(c,2);assert.equal(JSON.parse(save.options.body).state.profile.name,'Keep my template edits');save.reply({revision:8});(await waitFor(c,3)).reply({ok:true});await retry.done;assert.match(c.node('#main').innerHTML,/Safely closed/);assert.equal(c.confirmations,0);
});

test('Save saves directly without confirmation and never calls Quit',async()=>{
 for(const view of ['editor','template-editor']){
  const c=client(view);c.h.edit('Saved directly');const result=c.click('save');(await waitFor(c,1)).reply({revision:8});await result.done;
  assert.equal(c.requests.length,1);assert.equal(c.confirmations,0);assert.equal(c.node('#main').innerHTML,'Open workspace');assert.equal(c.h.saved,c.h.dirty);assert.equal(result.button.disabled,false);
 }
});

test('Exit with no pending changes quits without a redundant save or confirmation',async()=>{
 const c=client(),exit=c.click('quit'),quit=await waitFor(c,1);assert.equal(quit.url,'/api/quit');quit.reply({ok:true});await exit.done;assert.equal(c.confirmations,0);assert.match(c.node('#main').innerHTML,/Safely closed/);
});

test('A failed quit request does not claim that the workspace is closed',async()=>{
 const c=client(),exit=c.click('quit');(await waitFor(c,1)).reply({error:'Unable to stop service'},500);await exit.done;assert.equal(exit.button.disabled,false);assert.equal(c.node('#main').innerHTML,'Open workspace');assert.match(c.node('#toast').textContent,/Unable to stop service/);
});

test('after Exit, cached navigation and save actions cannot reopen or edit the workspace',async()=>{
 const c=client('editor'),exit=c.click('quit');(await waitFor(c,1)).reply({ok:true});await exit.done;
 assert.equal(c.node('.sidebar').hidden,true);assert.equal(c.node('.topbar').hidden,true);const closed=c.node('#main').innerHTML;
 await c.click('open-template').done;await c.click('save').done;await c.click('quit').done;
 assert.equal(c.requests.length,1);assert.equal(c.node('#main').innerHTML,closed);assert.equal(exit.button.disabled,true);
});
