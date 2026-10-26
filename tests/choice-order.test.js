'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {seed,ratings,categories}=require('../app/seed'),{createApp}=require('../app/server'),{reportHTML}=require('../app/report');
const same=(a,b)=>assert.deepEqual(structuredClone(a),structuredClone(b));
function client(){
 const state=seed(),events=new Map(),nodes=new Map(),rows=new Map(),handles=new Map();let hit=null,frame=null;
 const node=key=>{if(!nodes.has(key))nodes.set(key,{content:'test-token',dataset:{},scrollTop:40,style:{},textContent:'',innerHTML:'',classList:{toggle(){}},addEventListener(){},focus(){},showModal(){},close(){},getBoundingClientRect:()=>({left:0,right:700,top:0,bottom:600})});return nodes.get(key);};
 const ctx=vm.createContext({initialState:state,ratings,categories,crypto:globalThis.crypto,structuredClone,Wording:require('../app/public/wording'),setTimeout:()=>1,clearTimeout(){},requestAnimationFrame:fn=>{frame=fn;return 1;},cancelAnimationFrame:()=>frame=null,document:{querySelector:node,getElementById:node,querySelectorAll:s=>s==='.choice-edit-row'?[...rows.values()]:[],elementFromPoint:()=>hit,addEventListener:(name,fn)=>events.set(name,fn)},window:{addEventListener(){}}});
 const source=fs.readFileSync(require.resolve('../app/public/app.js'),'utf8');
 vm.runInContext(source.slice(0,source.lastIndexOf('\nboot().catch'))+`
 state=initialState;route='template-editor';currentId=state.templates[0].id;sectionId=state.templates[0].sections[0].id;render=()=>{};
 const item=selectedSection().items[0];item.options=['Alpha','Bravo','Charlie','Delta'];item.choiceTypes={Alpha:'description',Bravo:'normal',Charlie:'concern',Delta:'description'};
 state.reports.push(blankReport(template(),{id:'old-report',address:'SYNTHETIC TEST'}));
 editChoices(item.id);
 globalThis.h={get draft(){return choiceDraft;},get item(){return item;},get dirty(){return dirty;},move:moveChoice,save:saveChoices,cancel:closeModal,reopen:()=>editChoices(item.id),newReport:()=>blankReport(template()),changeRoute(){route='reports';}};`,ctx);
 const row=index=>{if(!rows.has(index)){const r={dataset:{choiceRow:String(index)},classList:{add(){},remove(){}},getBoundingClientRect:()=>({top:100+index*60,height:50})};r.closest=s=>s==='.choice-edit-row'?r:s==='#choice-rows'?node('#choice-rows'):null;rows.set(index,r);}return rows.get(index);};
 const handle=index=>{if(!handles.has(index)){const h={dataset:{choiceReorder:String(index)},focus(){},setPointerCapture(){},hasPointerCapture:()=>true,releasePointerCapture(){}};h.closest=s=>s==='[data-choice-reorder]'?h:s==='.choice-edit-row'?row(index):null;handles.set(index,h);}return handles.get(index);};
 return {state,h:ctx.h,node,events,emit:(name,ev)=>events.get(name)(ev),pointAt:index=>hit=index===null?null:row(index),tick:()=>frame?.(),get scrolling(){return !!frame;},pointer:(index,y=110+index*60)=>({target:handle(index),pointerId:1,button:0,clientX:100,clientY:y,preventDefault(){}}),key:(index,key)=>({target:handle(index),altKey:true,key,preventDefault(){}}),click:dataset=>events.get('click')({target:{closest:()=>({dataset,isConnected:false})}})};
}
test('choice arrows move edited wording and purpose together in a cancelable draft only',async()=>{
 const c=client(),before=structuredClone(c.state);
 c.emit('input',{target:{dataset:{choiceLabel:'0'},value:'Edited Alpha'}});c.emit('change',{target:{dataset:{choiceKind:'0'},value:'concern'}});
 await c.click({action:'move-choice',index:'0',delta:'1'});same(structuredClone(c.h.draft.choices[1]),{text:'Edited Alpha',kind:'concern'});same(c.state,before);assert.equal(c.h.dirty,0);
 for(const args of [[-1,1],[0,-1],[3,4],[0,0],[NaN,1]])assert.equal(c.h.move(...args),false);
 c.h.cancel();assert.equal(c.h.draft,null);c.h.reopen();same(c.h.draft.choices.map(v=>v.text),['Alpha','Bravo','Charlie','Delta']);
});
test('choice pointer dragging supports both directions, keyboard moves and cancellation with edge scrolling',()=>{
 const c=client();c.emit('pointerdown',c.pointer(0));c.pointAt(2);c.emit('pointermove',c.pointer(0,270));c.emit('pointerup',c.pointer(0,270));same(c.h.draft.choices.map(v=>v.text),['Bravo','Charlie','Alpha','Delta']);
 c.emit('pointerdown',c.pointer(3));c.pointAt(0);c.emit('pointermove',c.pointer(3,105));c.emit('pointerup',c.pointer(3,105));assert.equal(c.h.draft.choices[0].text,'Delta');
 c.emit('keydown',c.key(0,'ArrowDown'));assert.equal(c.h.draft.choices[1].text,'Delta');
 const before=JSON.stringify(c.h.draft);c.emit('pointerdown',c.pointer(0));c.pointAt(3);c.emit('pointermove',c.pointer(0,590));c.tick();assert.equal(c.node('#dialog').scrollTop,54);assert.ok(c.scrolling);c.emit('keydown',{key:'Escape',preventDefault(){}});assert.equal(c.scrolling,false);c.emit('pointerup',c.pointer(0,290));assert.equal(JSON.stringify(c.h.draft),before);
});
test('outside drops, pointer cancellation and stale choice dialogs cannot reorder or save',()=>{
 const c=client(),before=JSON.stringify(c.h.draft),state=JSON.stringify(c.state);
 c.emit('pointerdown',c.pointer(0));c.pointAt(null);c.emit('pointermove',c.pointer(0,200));c.emit('pointerup',c.pointer(0,200));assert.equal(JSON.stringify(c.h.draft),before);
 c.emit('pointerdown',c.pointer(0));c.pointAt(3);c.emit('pointermove',c.pointer(0,300));c.emit('pointercancel',c.pointer(0));c.emit('pointerup',c.pointer(0,300));assert.equal(JSON.stringify(c.h.draft),before);
 c.emit('pointerdown',c.pointer(0));c.pointAt(3);c.emit('pointermove',c.pointer(0,300));c.h.reopen();c.emit('pointerup',c.pointer(0,300));assert.equal(JSON.stringify(c.h.draft),before);
 c.h.changeRoute();assert.equal(c.h.move(0,2),false);c.h.save();assert.equal(JSON.stringify(c.state),state);
});
test('saved choice order persists after restart and is inherited by new reports without changing existing reports',async()=>{
 const c=client(),old=structuredClone(c.state.reports[0]);c.h.move(2,0);c.h.save();same(c.h.item.options,['Charlie','Alpha','Bravo','Delta']);assert.equal(c.h.item.choiceTypes.Charlie,'concern');same(c.state.reports[0],old);
 const next=c.h.newReport();next.id='new-report';c.state.reports.push(next);const item=next.sections[0].items[0];same(item.options,c.h.item.options);assert.equal(item.selected.length,0);
 const html=reportHTML(next);assert.ok(html.indexOf('aria-label="Charlie: not selected"')<html.indexOf('aria-label="Alpha: not selected"'));
 const dir=fs.mkdtempSync(path.resolve('work/tests/choice-order-'));let app=createApp({dataDir:dir,port:0});
 try{const url=await app.start(),home=await(await fetch(url)).text(),headers={'X-Solo-Token':home.match(/name="solo-token" content="([a-f0-9]+)"/)[1],'Content-Type':'application/json'};
  const response=await fetch(url+'/api/state',{method:'PUT',headers,body:JSON.stringify({revision:0,state:c.state})});assert.equal(response.status,200);await app.close();app=createApp({dataDir:dir,port:0});await app.start();
  const restored=app.read().state;same(restored.templates[0].sections[0].items[0].options,c.h.item.options);same(restored.reports[0],old);same(restored.reports[1].sections[0].items[0].choiceTypes,item.choiceTypes);
 }finally{await app.close();}
});
