'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function client({width=1600,height=1000,stored=null,blocked=false}={}){
 const nodes=new Map(),events=new Map(),storage=new Map(stored?[['soloinspect-note-window-v1',stored]]:[]);
 // Browsers retain every listener; replacing earlier handlers hid resize/move handlers.
 const listen=(key,fn)=>{const previous=events.get(key);events.set(key,previous?event=>{previous(event);return fn(event);}:fn);};
 const node=key=>{if(!nodes.has(key))nodes.set(key,{style:{},open:true,disabled:false,classList:{toggle(){}},addEventListener:(name,fn)=>listen(key+':'+name,fn),querySelector:node,setAttribute(k,v){this[k]=v;},focus(){},closest(selector){if(selector===key)return this;if(selector==='.note-heading'&&['title','control','[data-note-move]'].includes(key))return node('.note-heading');if(selector==='button,a,input,select,textarea'&&key==='control')return this;return null;},setPointerCapture(id){this.capture=id;},hasPointerCapture(id){return this.capture===id;},releasePointerCapture(){this.capture=null;},getBoundingClientRect(){return {width:parseFloat(this.style.width),height:parseFloat(this.style.height),left:parseFloat(this.style.left),top:parseFloat(this.style.top)};}});return nodes.get(key);};
 const win={innerWidth:width,innerHeight:height,addEventListener:(name,fn)=>events.set('window:'+name,fn)};
 const ctx=vm.createContext({$:node,window:win,document:{addEventListener:(name,fn)=>events.set('document:'+name,fn)},localStorage:{getItem:k=>{if(blocked)throw Error('Storage unavailable');return storage.get(k)||null;},setItem:(k,v)=>{if(blocked)throw Error('Storage unavailable');storage.set(k,v);}},toast(){}});
 vm.runInContext(fs.readFileSync(require.resolve('../app/public/notes.js'),'utf8')+`;globalThis.h={layout:layoutNoteWindow,resize:resizeNoteWindow,move:moveNoteWindow,settings:noteWindowSettings,startDraft:()=>noteEditor={draft:{text:'KEEP THIS DRAFT',photos:[{src:'test',caption:'Keep caption'}]}},get draft(){return noteEditor.draft;}};`,ctx);
 return {h:ctx.h,node,events,win,storage,click:a=>events.get('document:click')({target:{closest:()=>({dataset:{noteAction:a},isConnected:false})}})};
}
const size=c=>JSON.parse(JSON.stringify(c.h.layout()));
test('saved sizes are bounded by the current screen and recover when moving to a larger screen',()=>{
 const c=client();c.h.resize({width:1400,height:900});assert.deepEqual(size(c),{width:1400,height:900});c.win.innerWidth=500;c.win.innerHeight=340;c.events.get('window:resize')();assert.deepEqual(size(c),{width:476,height:316});
 c.win.innerWidth=1600;c.win.innerHeight=1000;assert.deepEqual(size(c),{width:1400,height:900});c.h.resize({width:1,height:1});assert.deepEqual(size(c),{width:640,height:360});
});
test('a corner drag changes both dimensions and persists for the next New Note or Edit Note session',()=>{
 const c=client(),draft=c.h.startDraft(),before=JSON.stringify(draft.draft);c.h.resize({width:1000,height:700});const grip=c.node('[data-note-resize]');
 c.events.get('#note-dialog:pointerdown')({target:grip,button:0,pointerId:1,clientX:1300,clientY:850,preventDefault(){}});
 c.events.get('#note-dialog:pointermove')({pointerId:1,clientX:1200,clientY:800});assert.deepEqual(size(c),{width:800,height:600});
 c.events.get('#note-dialog:pointerup')({pointerId:1});assert.equal(JSON.stringify(c.h.draft),before);assert.equal(grip.capture,null);
 const next=client({stored:c.storage.get('soloinspect-note-window-v1')});assert.deepEqual(size(next),{width:800,height:600});
});
test('keyboard resizing and maximize/restore preserve draft contents',async()=>{
 const c=client();c.h.startDraft();const before=JSON.stringify(c.h.draft);c.h.resize({width:1000,height:700});
 c.events.get('#note-dialog:keydown')({target:c.node('[data-note-resize]'),key:'ArrowDown',shiftKey:false,preventDefault(){}});assert.deepEqual(size(c),{width:1000,height:724});
 await c.click('maximize-window');assert.deepEqual(size(c),{width:1576,height:976});await c.click('maximize-window');assert.deepEqual(size(c),{width:1000,height:724});assert.equal(JSON.stringify(c.h.draft),before);
});
test('cancelled pointer gestures restore the prior size; invalid or unavailable storage does not prevent resizing',()=>{
 const c=client({stored:'{"width":null,"height":-1}'});assert.deepEqual(size(c),{width:1320,height:820});const grip=c.node('[data-note-resize]');
 c.events.get('#note-dialog:pointerdown')({target:grip,button:0,pointerId:2,clientX:1300,clientY:850,preventDefault(){}});c.events.get('#note-dialog:pointermove')({pointerId:2,clientX:1100,clientY:700});c.events.get('#note-dialog:pointercancel')({pointerId:2});assert.deepEqual(size(c),{width:1320,height:820});
 const blocked=client({blocked:true});assert.doesNotThrow(()=>blocked.h.resize({width:1000,height:600}));assert.deepEqual(size(blocked),{width:1000,height:600});
});
const position=c=>{const r=c.node('#note-dialog').getBoundingClientRect();return {left:r.left,top:r.top};};
const pointer=(c,type,{target='title',x=800,y=180,id=10}={})=>c.events.get('#note-dialog:'+type)({target:c.node(target),button:0,pointerId:id,clientX:x,clientY:y,preventDefault(){}});
test('dragging the title moves the whole window, preserves drafts and remembers its position',()=>{
 const c=client();c.h.startDraft();const before=JSON.stringify(c.h.draft);c.h.resize({width:1000,height:700});assert.deepEqual(position(c),{left:300,top:150});
 pointer(c,'pointerdown');pointer(c,'pointermove',{x:650,y:230});pointer(c,'pointerup');assert.deepEqual(position(c),{left:150,top:200});assert.deepEqual(size(c),{width:1000,height:700});assert.equal(JSON.stringify(c.h.draft),before);
 const next=client({stored:c.storage.get('soloinspect-note-window-v1')});size(next);assert.deepEqual(position(next),{left:150,top:200});
 pointer(c,'pointerdown',{target:'[data-note-resize]',x:1150,y:900});pointer(c,'pointermove',{x:1250,y:950});pointer(c,'pointerup');assert.deepEqual(size(c),{width:1100,height:750});assert.deepEqual(position(c),{left:150,top:200});
});
test('movement stays on screen and survives maximize/restore',async()=>{
 const c=client();c.h.resize({width:1000,height:700});c.h.move(200,100);await c.click('maximize-window');assert.deepEqual(position(c),{left:12,top:12});c.h.move(400,200);await c.click('maximize-window');assert.deepEqual(position(c),{left:200,top:100});
 c.h.move(10000,10000);assert.deepEqual(position(c),{left:588,top:288});c.h.move(-100,-100);assert.deepEqual(position(c),{left:12,top:12});
 c.h.move(200,100);c.win.innerWidth=500;c.win.innerHeight=340;c.events.get('window:resize')();assert.deepEqual(position(c),{left:12,top:12});assert.deepEqual(size(c),{width:476,height:316});
 c.win.innerWidth=1600;c.win.innerHeight=1000;size(c);assert.deepEqual(position(c),{left:200,top:100});
});
test('header controls do not drag, cancelled moves roll back, and keyboard movement works',()=>{
 const c=client();c.h.resize({width:1000,height:700});pointer(c,'pointerdown',{target:'control'});pointer(c,'pointermove',{x:600,y:230});pointer(c,'pointerup');assert.deepEqual(position(c),{left:300,top:150});
 pointer(c,'pointerdown');pointer(c,'pointermove',{x:650,y:230});pointer(c,'pointercancel');assert.deepEqual(position(c),{left:300,top:150});
 c.events.get('#note-dialog:keydown')({target:c.node('[data-note-move]'),key:'ArrowLeft',shiftKey:false,preventDefault(){}});assert.deepEqual(position(c),{left:290,top:150});
 c.events.get('#note-dialog:keydown')({target:c.node('[data-note-move]'),key:'ArrowDown',shiftKey:true,preventDefault(){}});assert.deepEqual(position(c),{left:290,top:190});
});
