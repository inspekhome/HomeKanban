'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../app/public/notes.js'),'utf8').split('// A note is edited as a local draft')[0];
function setup({delay=false}={}){
 const photos=[{src:'original-1',caption:'First'},{src:'original-2',caption:'Second'}],finding={id:'finding',photos},r={findings:[finding],status:'final'},state={reports:[r]},mounted=[],cards=[];let saves=0,changes=0,failSave=false;
 function card(index){
  const buttons=new Map(['open','select','left','right','arrow','line','arrow-row','rect','circle','text','undo','delete','save'].map(name=>[name,{dataset:{reportPhoto:name},disabled:false,attrs:{},setAttribute(k,v){this.attrs[k]=v;}}]));
  const img={src:photos[index].src},host={clientHeight:300,innerHTML:''},hint={textContent:''},panel={hidden:true,innerHTML:'',querySelectorAll:()=>[...buttons.values()].filter(b=>b.dataset.reportPhoto!=='open')};
  const c={dataset:{photoFinding:'finding',photoIndex:String(index)},isConnected:true,classList:{add(){},remove(){}},querySelectorAll:()=>[...buttons.values()],querySelector(selector){if(selector==='.report-photo-surface')return host;if(selector==='.report-photo-surface img')return img;if(selector==='.report-photo-controls')return panel;if(selector==='.report-photo-hint')return hint;return buttons.get('open');}};
  cards.push(c);return {c,buttons,img,host,panel};
 }
 const a=card(0),b=card(1),linked=card(0);
 const context=vm.createContext({state,route:'editor',report:()=>r,e:s=>s,changed(){changes++;},async saveNow(){saves++;if(failSave)throw Error('Disk full');},toast(){},document:{addEventListener(){},querySelectorAll:()=>cards},PhotoEditor:{icon:()=>'<svg></svg>',mount(host,options){const m={host,options,flushed:0,disposed:0,command:null,flush(){this.flushed++;},dispose(){this.disposed++;}};m.command=name=>{if(name==='undo')options.onChange({src:'undo-result'});};mounted.push(m);if(delay)return new Promise(resolve=>{m.resolve=()=>resolve(m);});return Promise.resolve(m);}}});
 vm.runInContext(source,context);const api=vm.runInContext('ReportPhotos',context);
 return {api,a,b,linked,photos,finding,r,state,mounted,get saves(){return saves;},get changes(){return changes;},set failSave(value){failSave=value;}};
}
test('multiple photos stay independent, share linked previews, and saving one leaves the other open',async()=>{
 const t=setup();await t.api.open(t.a.c);await t.api.open(t.b.c);
 t.mounted[0].options.onChange({src:'arrow'});t.mounted[1].options.onChange({src:'circle'});
 assert.deepEqual(t.photos.map(p=>p.src),['arrow','circle']);assert.equal(t.linked.img.src,'arrow');assert.equal(t.r.status,'draft');assert.equal(t.changes,2);
 await t.api.activate(t.a.c,'save');assert.equal(t.saves,1);assert.equal(t.a.panel.hidden,true);assert.equal(t.b.panel.hidden,false);assert.equal(t.mounted[1].disposed,0);
 await t.api.activate(t.b.c,'undo');assert.equal(t.photos[1].src,'undo-result');assert.equal(t.photos[0].src,'arrow');
});
test('opening the same photo in the other report view retires its old writer',async()=>{
 const t=setup();await t.api.open(t.a.c);t.mounted[0].options.onChange({src:'arrow'});await t.api.open(t.linked.c);
 assert.equal(t.mounted[0].disposed,1);assert.equal(t.a.panel.hidden,true);assert.equal(t.mounted[1].options.src,'arrow');
 t.mounted[0].options.onChange({src:'stale'});assert.equal(t.photos[0].src,'arrow');t.mounted[1].options.onChange({src:'new'});assert.equal(t.photos[0].src,'new');
});
test('opening Edit Note flushes that finding before the draft can be cloned',async()=>{
 const t=setup();await t.api.open(t.a.c);await t.api.open(t.b.c);t.mounted[0].flush=()=>t.mounted[0].options.onChange({src:'finished-text'});
 t.api.closeFinding('finding');assert.equal(t.photos[0].src,'finished-text');assert.equal(t.a.panel.hidden,true);assert.equal(t.b.panel.hidden,true);assert.equal(t.mounted[0].disposed,1);
});
test('save failure keeps the editor and marks for retry',async()=>{
 const t=setup();await t.api.open(t.a.c);t.mounted[0].options.onChange({src:'arrow'});t.failSave=true;
 await assert.rejects(t.api.activate(t.a.c,'save'),/Disk full/);assert.equal(t.a.panel.hidden,false);assert.equal(t.photos[0].src,'arrow');assert.equal(t.mounted[0].disposed,0);
 t.failSave=false;await t.api.activate(t.a.c,'save');assert.equal(t.a.panel.hidden,true);assert.equal(t.saves,2);
});
test('closing during image loading cancels the session without applying a late callback',async()=>{
 const t=setup({delay:true}),opening=t.api.open(t.a.c);t.api.closeWithin({contains:c=>c===t.a.c});t.mounted[0].resolve();await opening;
 assert.equal(t.mounted[0].disposed,1);t.mounted[0].options.onChange({src:'late'});assert.equal(t.photos[0].src,'original-1');assert.equal(t.changes,0);
});
test('deleted notes and replaced photo records cannot receive stale editor writes',async()=>{
 const t=setup();await t.api.open(t.a.c);t.finding.photos[0]={src:'replacement'};t.mounted[0].options.onChange({src:'stale'});assert.equal(t.changes,0);assert.equal(t.photos[0].src,'replacement');
 await t.api.open(t.b.c);t.r.findings=[];t.mounted[1].options.onChange({src:'deleted'});assert.equal(t.photos[1].src,'original-2');assert.equal(t.changes,0);
});
test('opening and closing an unchanged photo does not rewrite or recompress it',async()=>{
 const t=setup();await t.api.open(t.a.c);await t.api.activate(t.a.c,'save');assert.equal(t.photos[0].src,'original-1');assert.equal(t.changes,0);
});
