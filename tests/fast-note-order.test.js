'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const Wording=require('../app/public/wording'),{seed,categories}=require('../app/seed'),{createApp}=require('../app/server');
function client(){
 const state=seed(),events=new Map(),nodes=new Map(),rows=new Map();let saves=0,saved,hit=null,frame=null,scrolled=0;
 state.noteLibrary=['Alpha','Bravo','Charlie','Delta'].map((text,i)=>({id:`note-${i}`,title:text,text,category:categories[3],background:['blue','pink','green','yellow'][i],textRuns:[{text,bold:true,color:'#b42318'}]}));
 state.reports=[{id:'unchanged-report',findings:[{text:'An existing report copy.',photos:[{caption:'Keep'}]}]}];
 const node=id=>{if(!nodes.has(id))nodes.set(id,{content:'test',dataset:{},nextElementSibling:{},classList:{toggle(){},remove(){}},addEventListener(){},querySelectorAll:()=>[],focus(){},scrollIntoView(){},showModal(){},close(){}});return nodes.get(id);};
 const ctx=vm.createContext({state,categories,Wording,$:node,clone:structuredClone,e:Wording.escape,route:'fast-notes',dirty:0,status(){},toast(){},window:{innerHeight:800,scrollBy:(x,y)=>scrolled+=y,addEventListener(){}},requestAnimationFrame:fn=>{frame=fn;return 1;},cancelAnimationFrame:()=>frame=null,document:{elementFromPoint:()=>hit,addEventListener:(name,fn)=>{if(!events.has(name))events.set(name,[]);events.get(name).push(fn);},querySelectorAll:()=>[...rows.values()],getElementById:node},saveNow:async()=>{saves++;saved=structuredClone(state);},head:()=>''});
 vm.runInContext(fs.readFileSync(require.resolve('../app/public/bank.js'),'utf8')+fs.readFileSync(require.resolve('../app/public/notes.js'),'utf8')+';globalThis.h={moveFastNote,bankMarkup,insertBankText};',ctx);
 const row=id=>{if(!rows.has(id)){const classes=new Set(),r={dataset:{fastNoteId:id},focus(){},setPointerCapture(){},hasPointerCapture:()=>true,releasePointerCapture(){},classList:{add:(...names)=>names.forEach(n=>classes.add(n)),remove:(...names)=>names.forEach(n=>classes.delete(n))},getBoundingClientRect:()=>({top:100,height:100})};r.closest=s=>s==='[data-fast-note-id]'?r:null;rows.set(id,r);}return rows.get(id);};
 const emit=async(name,ev)=>{for(const fn of events.get(name)||[])await fn(ev);};
 return {state,h:ctx.h,get saves(){return saves;},get saved(){return saved;},get scrolled(){return scrolled;},get scrolling(){return !!frame;},tick:()=>frame?.(),pointAt:id=>hit=id?row(id):null,set route(value){ctx.route=value;},emit,pointer:(id,y=110)=>({target:row(id),pointerId:1,button:0,clientX:200,clientY:y,preventDefault(){}}),drag:(id,after=false)=>({target:row(id),clientY:after?190:110,preventDefault(){},dataTransfer:{setData(){}}}),click:(id,delta)=>emit('click',{target:{closest:()=>({dataset:{noteAction:'library-move',id,delta:String(delta)},isConnected:false})}})};
}
test('arrows save the shared order while preserving formatted wording, reports, and templates',async()=>{
 const c=client(),before=structuredClone(c.state);await c.click('note-0',1);assert.deepEqual(c.state.noteLibrary.map(n=>n.id),['note-1','note-0','note-2','note-3']);await c.click('note-3',-1);
 assert.deepEqual(c.saved.noteLibrary.map(n=>n.id),['note-1','note-0','note-3','note-2']);assert.equal(c.saves,2);assert.deepEqual(c.state.reports,before.reports);assert.deepEqual(c.state.templates,before.templates);
 for(const n of c.state.noteLibrary)assert.deepEqual(n,before.noteLibrary.find(old=>old.id===n.id));
 const reportList=c.h.bankMarkup('note');assert.ok(reportList.indexOf('Bravo')<reportList.indexOf('Alpha'));assert.ok(reportList.includes('bank-bg-pink'));assert.ok(reportList.includes('<strong>Bravo</strong>'));assert.ok(!/library-edit|library-delete|library-move|library-new|fast-notes-count|draggable/.test(reportList));
 const draft={text:'Original report text.',category:'Recommendation',photos:[{caption:'Keep'}]};c.h.insertBankText(draft,c.state.noteLibrary[0]);c.h.insertBankText(draft,c.state.noteLibrary[1]);assert.equal(draft.text,'Original report text.\n\nBravo\n\nAlpha');assert.equal(draft.category,'Recommendation');assert.equal(draft.photos[0].caption,'Keep');
});
test('dragging places notes before or after a target in either direction',async()=>{
 const c=client();await c.emit('dragstart',c.drag('note-0'));await c.emit('dragover',c.drag('note-1',true));await c.emit('drop',c.drag('note-1',true));assert.deepEqual(c.state.noteLibrary.map(n=>n.id),['note-1','note-0','note-2','note-3']);
 await c.emit('dragstart',c.drag('note-3'));await c.emit('drop',c.drag('note-1'));assert.equal(c.state.noteLibrary[0].id,'note-3');await c.emit('dragstart',c.drag('note-3'));await c.emit('drop',c.drag('note-2',true));assert.equal(c.state.noteLibrary.at(-1).id,'note-3');assert.equal(c.saves,3);
});
test('pointer dragging works without HTML drag events, supports edge scrolling, and cancels safely',async()=>{
 const c=client();await c.emit('pointerdown',c.pointer('note-0'));c.pointAt('note-2');await c.emit('pointermove',c.pointer('note-0',190));await c.emit('pointerup',c.pointer('note-0',190));assert.deepEqual(c.state.noteLibrary.map(n=>n.id),['note-1','note-2','note-0','note-3']);assert.equal(c.saves,1);
 const before=JSON.stringify(c.state.noteLibrary);await c.emit('pointerdown',c.pointer('note-0'));c.pointAt('note-3');await c.emit('pointermove',c.pointer('note-0',790));c.tick();assert.equal(c.scrolled,18);assert.equal(c.scrolling,true);await c.emit('keydown',{key:'Escape',preventDefault(){}});assert.equal(c.scrolling,false);await c.emit('pointerup',c.pointer('note-0',190));assert.equal(JSON.stringify(c.state.noteLibrary),before);
 await c.emit('pointerdown',c.pointer('note-0'));await c.emit('pointermove',c.pointer('note-0',190));await c.emit('pointercancel',c.pointer('note-0',190));await c.emit('pointerup',c.pointer('note-0',190));assert.equal(JSON.stringify(c.state.noteLibrary),before);assert.equal(c.saves,1);
});
test('cancelled and outside drops, invalid moves and report-side moves leave the order unchanged',async()=>{
 const c=client(),before=JSON.stringify(c.state.noteLibrary);await c.emit('dragstart',c.drag('note-0'));await c.emit('dragend');await c.emit('drop',c.drag('note-2'));
 await c.emit('dragstart',c.drag('note-0'));await c.emit('drop',{target:{closest:()=>null}});await c.emit('drop',c.drag('note-2'));
 await c.emit('dragstart',c.drag('note-0'));await c.emit('drop',c.drag('note-0',true));
 for(const [id,to] of [['missing',0],['note-0',-1],['note-0',4],['note-0',NaN]])assert.equal(await c.h.moveFastNote(id,to),false);
 c.route='editor';assert.equal(await c.h.moveFastNote('note-0',2),false);assert.equal(JSON.stringify(c.state.noteLibrary),before);assert.equal(c.saves,0);
});
test('both arrows remain visible, with boundary directions disabled like template sections',()=>{
 const c=client(),html=c.h.bankMarkup('library');assert.match(html,/<button[^>]*id="fast-note-up-note-0"[^>]* disabled/);assert.match(html,/<button[^>]*id="fast-note-down-note-3"[^>]* disabled/);assert.equal((html.match(/data-note-action="library-move"/g)||[]).length,8);assert.equal((html.match(/ disabled/g)||[]).length,2);
 c.state.noteLibrary.splice(1);const single=c.h.bankMarkup('library');assert.equal((single.match(/data-note-action="library-move"/g)||[]).length,2);assert.equal((single.match(/ disabled/g)||[]).length,2);assert.ok(single.includes('library-edit'));
});
test('reordered notes retain their order through save, backup restore and restart',async()=>{
 const dataDir=fs.mkdtempSync(path.resolve('work/fast-note-order-test-'));let app=createApp({dataDir,port:0});
 try{
  const url=await app.start(),home=await(await fetch(url)).text(),token=home.match(/name="solo-token" content="([a-f0-9]+)"/)[1],headers={'X-Solo-Token':token,'Content-Type':'application/json'},data=app.read();
  const c=client();await c.h.moveFastNote('note-3',0);data.state.noteLibrary=c.state.noteLibrary;
  assert.equal((await fetch(url+'/api/state',{method:'PUT',headers,body:JSON.stringify(data)})).status,200);const backup=await(await fetch(url+'/api/backup',{headers})).json();assert.deepEqual(backup.state.noteLibrary,data.state.noteLibrary);
  assert.equal((await fetch(url+'/api/restore',{method:'POST',headers,body:JSON.stringify({revision:backup.revision,backup})})).status,200);await app.close();app=createApp({dataDir,port:0});await app.start();assert.deepEqual(app.read().state.noteLibrary,data.state.noteLibrary);
 }finally{await app.close();}
});
