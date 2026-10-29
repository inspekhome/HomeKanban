'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {seed}=require('../app/seed');
function client(legacy=false){
 const state=seed(),system=state.templates[0],events=new Map(),messages=[];let confirms=0;
 if(legacy)delete system.isSystem;
 state.templates.push({...structuredClone(system),id:'custom',name:'Everyday',isSystem:false});
 const node={content:'test',textContent:'',style:{},classList:{toggle(){}},addEventListener(){}};
 const context=vm.createContext({initialState:state,Wording:require('../app/public/wording'),structuredClone,crypto:globalThis.crypto,setTimeout:()=>1,clearTimeout(){},document:{querySelector:()=>node,addEventListener:(name,fn)=>events.set(name,fn)},window:{addEventListener(){}},confirm:()=>{confirms++;return true;},testToast:message=>messages.push(message)});
 const source=fs.readFileSync(require.resolve('../app/public/app.js'),'utf8');
 vm.runInContext(source.slice(0,source.lastIndexOf('\nboot().catch'))+`;state=initialState;route='templates';saveNow=async()=>{};render=()=>{};toast=testToast;globalThis.h={protect:isSystemTemplate,rename(id,name){currentId=id;route='template-editor';},templateCards:renderTemplates};`,context);
 return {state,system,messages,get confirms(){return confirms;},h:context.h,
  click:(action,id)=>events.get('click')({target:{closest:()=>({dataset:{action,id},isConnected:true})}}),
  rename(id,value){context.h.rename(id);events.get('input')({target:{id:'template-field-name',dataset:{scope:'template',field:'name'},type:'text',value}});}
 };
}
test('existing and new System Templates reject a stale delete action without confirmation or mutation',async()=>{
 for(const legacy of [false,true]){const c=client(legacy),before=structuredClone(c.state);await c.click('delete-template',c.system.id);assert.deepEqual(c.state,before);assert.equal(c.confirms,0);assert.match(c.messages[0],/System Template cannot be deleted/);}
});
test('editing the name preserves System Template protection',async()=>{
 const c=client(true);c.rename(c.system.id,'My renamed baseline');assert.equal(c.system.name,'My renamed baseline');assert.equal(c.system.isSystem,true);await c.click('delete-template',c.system.id);assert.equal(c.state.templates.length,2);assert.equal(c.confirms,0);
});
test('duplicating a protected template produces an editable removable independent copy',async()=>{
 const c=client(),before=structuredClone(c.system);await c.click('duplicate-template',c.system.id);const copy=c.state.templates.at(-1);assert.notEqual(copy.id,c.system.id);assert.equal(copy.isSystem,undefined);assert.equal(c.h.protect(copy),false);copy.sections[0].name='Changed copy';assert.deepEqual(c.system,before);await c.click('delete-template',copy.id);assert.equal(c.state.templates.length,2);assert.equal(c.confirms,1);assert.deepEqual(c.system,before);
});
