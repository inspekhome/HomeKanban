'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const {seed}=require('../app/seed');
test('Copy preserves scope and notice while clearing property-specific evidence and leaving the original intact',async()=>{
 const state=seed(),t=state.templates[0];state.profile.name='Current inspector';
 const old={id:'source-report',templateName:t.name,scope:'Inspection scope customized for this report.',notice:'Keep this notice.',client:'Private client',address:'Private address',status:'final',inspector:{...state.profile,name:'Old inspector'},sections:structuredClone(t.sections),findings:[{text:'Original evidence',photos:[{src:'original-photo'}]}]};
 old.sections[0].items[0].rating='D';old.sections[0].items[0].note='Original condition';old.sections[0].items[0].selected=['Concrete'];state.reports.push(old);const original=structuredClone(old),events=new Map(),nodes=new Map();
 const node=key=>{if(!nodes.has(key))nodes.set(key,{content:'test-token',style:{},classList:{toggle(){}},addEventListener(){}});return nodes.get(key);};
 const ctx=vm.createContext({initialState:state,structuredClone,crypto,setTimeout:()=>1,clearTimeout(){},document:{querySelector:node,addEventListener:(name,fn)=>events.set(name,fn)},window:{addEventListener(){}}});
 const source=fs.readFileSync(require.resolve('../app/public/app.js'),'utf8');
 vm.runInContext(source.slice(0,source.lastIndexOf('\nboot().catch'))+`;state=initialState;render=()=>{};saveNow=async()=>{saved=dirty;};openReport=()=>{};`,ctx);
 await events.get('click')({target:{closest:()=>({dataset:{action:'duplicate-report',id:old.id},isConnected:false})}});
 const copy=state.reports[1];assert.ok(copy);assert.notEqual(copy.id,old.id);assert.equal(copy.scope,old.scope);assert.equal(copy.notice,old.notice);assert.equal(copy.templateName,old.templateName);assert.equal(copy.client,'');assert.equal(copy.address,'');assert.equal(copy.status,'draft');assert.equal(copy.inspector.name,'Current inspector');assert.equal(copy.findings.length,0);
 assert.ok(copy.sections.flatMap(s=>s.items).every(i=>i.rating===''&&i.note===''&&i.selected.length===0));assert.deepEqual(old,original);copy.sections[0].name='Changed copy';assert.equal(old.sections[0].name,original.sections[0].name);
});
