'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const P=require('../app/public/photo-editor');
test('quarter turns preserve image coordinates and return to the original orientation after four clicks',()=>{
 const m=P.model('test',1200,800),point={x:240,y:160};
 P.rotate(m,1);assert.deepEqual(P.size(m),{width:800,height:1200});assert.deepEqual(P.toView(point,m),{x:640,y:240});assert.deepEqual(P.toBase({x:640,y:240},m),point);
 for(let i=0;i<3;i++){P.rotate(m,1);assert.deepEqual(P.toBase(P.toView(point,m),m),point);}
 assert.deepEqual(P.size(m),{width:1200,height:800});assert.deepEqual(P.toView(point,m),point);P.rotate(m,-1);assert.equal(m.turns,3);
});
test('multiple marks are independent, movable, and constrained to the photograph',()=>{
 const m=P.model('test',1200,800);P.add(m,'arrow');P.add(m,'arrow');P.add(m,'rect');P.add(m,'circle');P.add(m,'text');P.add(m,'line');assert.equal(m.shapes.length,6);
 const unchanged=JSON.stringify(m.shapes.slice(1)),s=m.shapes[0];P.move(s,10000,-10000,m);const b=P.bounds(s);assert.equal(b.right,1200);assert.equal(b.top,0);assert.equal(JSON.stringify(m.shapes.slice(1)),unchanged);
 assert.ok(P.hit(s,{x:s.x2,y:s.y2},10));assert.ok(!P.hit(s,{x:0,y:800},10));assert.equal(P.RED,'#e02020');
});
function client(photoAPI={}){
 const photo={src:'data:image/jpeg;base64,b3JpZ2luYWw=',caption:'Original caption'},other={src:'data:image/jpeg;base64,b3RoZXI=',caption:'Other photo'},r={id:'report',findings:[{id:'finding',text:'Keep the narrative',photos:[photo,other],location:'Keep location'}]},nodes=new Map(),events=new Map();
 const node=key=>{if(!nodes.has(key))nodes.set(key,{disabled:false,addEventListener:(event,fn)=>events.set(key+':'+event,fn),close(){},classList:{remove(){},add(){},contains(){return false;}},setAttribute(){},querySelector:node,querySelectorAll:()=>[]});return nodes.get(key);};
 const ctx=vm.createContext({$:node,PhotoEditor:{...P,turn:async(src,d,model)=>({src:'data:image/jpeg;base64,cm90YXRlZA==',model:{src:src,turns:(model?.turns||0)+d}}),...photoAPI},state:{reports:[r]},clone:structuredClone,e:String,window:{addEventListener(){}},document:{addEventListener:(event,fn)=>events.set('document:'+event,fn)},confirmNote:async()=>true,toast(){},changed(){},render(){},jumpTo(){},saveNow:async()=>{}});
 vm.runInContext(fs.readFileSync(require.resolve('../app/public/notes'),'utf8')+`;globalThis.h={start:()=>{const draft=clone(state.reports[0].findings[0]);noteEditor={reportId:'report',draft,original:JSON.stringify(draft),existing:true,photoDrafts:new Map(),busy:false};return noteEditor;},edit:editNotePhoto,reorder:reorderNotePhoto,savePhoto:saveNotePhoto,save:saveNote,close:closeNote,changed:noteChanged};`,ctx);
 return {h:ctx.h,r,photo,other,events,nodes};
}
test('rotation stays in the local draft; cancelling a note never changes the saved report',async()=>{
 const c=client(),before=JSON.stringify(c.r);const session=c.h.start();await c.h.edit(0,'right');assert.equal(session.draft.photos[0].src,c.photo.src);assert.equal(c.h.changed(),true);assert.equal(session.photoDrafts.size,1);await c.h.close(true);assert.equal(JSON.stringify(c.r),before);
});
test('pending rotations follow their photo through reordering and save with captions intact',async()=>{
 const c=client(),session=c.h.start();await c.h.edit(0,'left');c.h.reorder(0,1);await c.h.save();const saved=c.r.findings[0];assert.deepEqual(saved.photos[0],c.other);assert.equal(saved.photos[1].caption,'Original caption');assert.equal(saved.photos[1].src,'data:image/jpeg;base64,cm90YXRlZA==');assert.equal(saved.text,'Keep the narrative');assert.equal(saved.location,'Keep location');
});

test('internal drags with a file payload only reorder and never import duplicate images',async()=>{
 const c=client(),session=c.h.start(),photo=session.draft.photos[0];session.photoDrag=photo;
 let prevented=false;const target={dataset:{notePhoto:'1'}};
 c.events.get('#note-dialog:drop')({target:{closest:()=>target},dataTransfer:{types:['Files','application/x-soloinspect-note-photo'],files:[{name:'browser-generated-image'}]},preventDefault(){prevented=true;},stopPropagation(){}});
 await new Promise(r=>setImmediate(r));assert.equal(prevented,true);assert.equal(session.draft.photos.length,2);assert.equal(session.draft.photos[1],photo);
 assert.equal(session.photoDrag,null);
 c.events.get('#note-dialog:drop')({target:{closest:()=>target},dataTransfer:{types:['application/x-soloinspect-note-photo','Files'],files:[{}]},preventDefault(){},stopPropagation(){}});
 await new Promise(r=>setImmediate(r));assert.equal(session.draft.photos.length,2);
});
test('Save photo commits a rotation to the draft without changing the saved report',async()=>{
 const c=client(),session=c.h.start();await c.h.edit(0,'right');c.h.savePhoto(0);assert.equal(session.photoDrafts.size,0);assert.equal(session.draft.photos[0].src,'data:image/jpeg;base64,cm90YXRlZA==');assert.equal(c.r.findings[0].photos[0].src,c.photo.src);
});
test('late photo operations cannot change a cancelled note',async()=>{
 let finish;const c=client({turn:()=>new Promise(r=>finish=r)}),before=JSON.stringify(c.r);c.h.start();const work=c.h.edit(0,'right');await c.h.close(true);finish({src:'data:image/jpeg;base64,bGF0ZQ==',model:{}});await work;assert.equal(JSON.stringify(c.r),before);
});
