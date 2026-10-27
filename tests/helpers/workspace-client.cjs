'use strict';
const fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const {seed,categories}=require('../../app/seed'),Wording=require('../../app/public/wording'),WorkspaceLimits=require('../../app/public/workspace-limits');
function workspaceClient({state=seed(),revision=0,fetchImpl}={}){
 const nodes=new Map(),events=new Map(),requests=[],messages=[];let form={text:''},disk=structuredClone(state),diskRevision=revision;
 const node=key=>{
  if(!nodes.has(key))nodes.set(key,{value:'',dataset:{},content:'test-token',style:{},classList:{toggle(){},remove(){}},querySelectorAll:()=>[],focus(){},setAttribute(){},removeAttribute(){},addEventListener:(name,fn)=>events.set(key+':'+name,fn),showModal(){this.open=true;},close(){this.open=false;}});
  return nodes.get(key);
 };
 const fetch=fetchImpl||((url,options)=>new Promise(resolve=>requests.push({url,options,reply(status=200){
  let body={error:'Simulated disk failure'};
  if(status===200){const data=JSON.parse(options.body);disk=structuredClone(data.state);body={revision:++diskRevision};}
  resolve({ok:status===200,status,headers:{get:()=> 'application/json'},json:async()=>body});
 }})));
 const context=vm.createContext({initialState:state,initialRevision:revision,initialCategories:categories,TypeError,TextEncoder,AbortSignal,Wording,WorkspaceLimits,structuredClone,crypto,fetch,setTimeout:()=>1,clearTimeout(){},confirm:()=>true,document:{readyState:'complete',querySelector:node,querySelectorAll:()=>[],addEventListener:(name,fn)=>{const list=events.get(name)||[];list.push(fn);events.set(name,list);}},window:{addEventListener:(name,fn)=>{const list=events.get('window:'+name)||[];list.push(fn);events.set('window:'+name,list);}},wordingMarkup:(id,label,note)=>{form=structuredClone(note);return '';},mountWording(){},disposeWording(){},readWording:()=>structuredClone(form),testToast:(message,error)=>messages.push({message,error})});
 const source=fs.readFileSync(require.resolve('../../app/public/app.js'),'utf8');
 vm.runInContext(source.slice(0,source.lastIndexOf('\nboot().catch'))+';state=initialState;revision=initialRevision;categories=initialCategories;route="fast-notes";render=()=>{};openReport=()=>{};toast=testToast;boot=async()=>{};',context);
 const appClick=events.get('click').at(-1);
 for(const name of ['bank','notes'])vm.runInContext(fs.readFileSync(require.resolve('../../app/public/'+name+'.js'),'utf8'),context);
 vm.runInContext('confirmNote=async()=>true;globalThis.h={saveNow,commitWorkspaceEdit,openFastNote,saveLibraryNote,closeLibrary,libraryChanged,newReportDialog,changed,get editor(){return libraryEditor;},get dirty(){return dirty;},get saved(){return saved;},get revision(){return revision;},get pending(){return inFlight;}};',context);
 return {state,h:context.h,node,events,requests,messages,get disk(){return disk;},get form(){return form;},set form(value){form=value;},click:action=>appClick({target:{closest:()=>({dataset:{action},isConnected:true,disabled:false})}}),restore:file=>events.get('#restore-file:change')({target:{files:[file],value:'test'}})};
}
module.exports={workspaceClient};
