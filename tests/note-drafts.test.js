'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
// Exercise image events with synthetic files; never read the computer clipboard.
function client(imageData){
 const nodes=new Map(),events=new Map(),errors=[];
 const $=key=>{if(!nodes.has(key))nodes.set(key,{open:false,disabled:false,click(){this.clicks=(this.clicks||0)+1;},addEventListener:(name,fn)=>events.set(key+':'+name,fn)});return nodes.get(key);};
 const context=vm.createContext({PhotoEditor:require('../app/public/photo-editor'),$,imageData,e:String,toast:message=>errors.push(message),document:{addEventListener:(name,fn)=>events.set('document:'+name,fn)},window:{addEventListener(){}}});
 vm.runInContext(fs.readFileSync(require.resolve('../app/public/notes.js'),'utf8')+`;globalThis.harness={start:()=>noteEditor={draft:{photos:[]},busy:false},cancel:()=>noteEditor=null,add:addNotePhotos,render:renderNotePhotos};`,context);
 return {h:context.harness,events,nodes,errors};
}
test('pasting a synthetic image uses the same local image path and prevents text insertion',async()=>{
 const c=client(async file=>'data:image/jpeg;base64,'+file.name),session=c.h.start();let prevented=false;
 c.events.get('#note-dialog:paste')({clipboardData:{items:[{kind:'file',type:'image/png',getAsFile:()=>({name:'test-image'})}]},preventDefault(){prevented=true;}});
 await new Promise(resolve=>setImmediate(resolve));assert.equal(prevented,true);assert.equal(session.draft.photos.length,1);assert.match(session.draft.photos[0].src,/test-image$/);
});
test('failed photo batches are atomic, and cancelled drafts cannot receive late uploads',async()=>{
 const c=client(async f=>{if(f.name==='bad')throw Error('Invalid test image');return 'data:image/jpeg;base64,test';});const session=c.h.start();await c.h.add([{name:'good'},{name:'bad'}]);assert.equal(session.draft.photos.length,0);assert.equal(c.errors[0],'Invalid test image');
 let finish;const pending=client(()=>new Promise(resolve=>finish=resolve));const abandoned=pending.h.start();const upload=pending.h.add([{name:'slow'}]);pending.h.cancel();finish('data:image/jpeg;base64,test');await upload;assert.equal(abandoned.draft.photos.length,0);
});
test('photo count limit and overlapping uploads are rejected without losing existing photos',async()=>{
 let finish;const c=client(()=>new Promise(resolve=>finish=resolve)),session=c.h.start();session.draft.photos=Array.from({length:30},()=>({src:'test',caption:''}));await c.h.add([{}]);assert.equal(session.draft.photos.length,30);assert.match(c.errors[0],/30/);
 session.draft.photos=[];const first=c.h.add([{}]);await c.h.add([{}]);assert.match(c.errors[1],/wait/);finish('test');await first;assert.equal(session.draft.photos.length,1);
});


test('the empty photo button opens the shared picker, and selection plus dropping still add photos',async()=>{
 const c=client(async file=>'data:image/jpeg;base64,'+file.name),session=c.h.start();c.h.render();
 const markup=c.nodes.get('#note-photos').innerHTML;
 assert.match(markup,/<button type="button" data-note-action="add-photos"/);
 assert.match(markup,/aria-label="Add photos or drop images here"/);
 await c.events.get('document:click')({target:{closest:()=>({dataset:{noteAction:'add-photos'},isConnected:false})}});
 assert.equal(c.nodes.get('#note-photo-file').clicks,1);
 const input={id:'note-photo-file',files:[{name:'selected'}],value:'selected'};
 c.events.get('document:change')({target:input});await new Promise(resolve=>setImmediate(resolve));
 assert.equal(input.value,'');assert.equal(session.draft.photos.length,1);
 let prevented=false;c.events.get('#note-dialog:drop')({dataTransfer:{types:['Files'],files:[{name:'dropped'}]},preventDefault(){prevented=true;}});
 await new Promise(resolve=>setImmediate(resolve));assert.equal(prevented,true);assert.equal(session.draft.photos.length,2);
 assert.match(session.draft.photos[0].src,/selected$/);assert.match(session.draft.photos[1].src,/dropped$/);
 assert.equal(c.nodes.get('#note-message').textContent,'');
});
