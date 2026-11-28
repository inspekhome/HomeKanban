'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {JSDOM}=require('../scripts/editor/node_modules/jsdom');
const KEY='soloinspect-note-typing-v1';
const copy=value=>JSON.parse(JSON.stringify(value));

function client({stored=null,blocked=false}={}){
 const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'http://localhost',pretendToBeVisual:true,runScripts:'outside-only'}),w=dom.window;
 const rect=()=>({x:0,y:0,top:0,left:0,right:0,bottom:0,width:0,height:0});
 w.Range.prototype.getBoundingClientRect=rect;w.Range.prototype.getClientRects=()=>[];w.HTMLElement.prototype.scrollIntoView=()=>{};
 if(stored!==null)w.localStorage.setItem(KEY,stored);
 if(blocked)Object.defineProperty(w,'localStorage',{get(){throw Error('Browser storage unavailable');}});
 w.noteEditor=null;w.libraryEditor=null;w.noteHint=()=>{};w.updateLibraryStyle=()=>{};
 for(const file of ['wording.js','vendor/editor.js','wording-editor.js'])vm.runInContext(fs.readFileSync(path.resolve('app/public',file),'utf8'),dom.getInternalVMContext());
 let current;
 function open(note={text:''},{id='note-text',reportId='report-one'}={}){
  if(current)w.disposeWording(current.el.id);
  w.noteEditor={reportId,draft:structuredClone(note)};
  const scope=id.includes('scope');
  w.document.body.innerHTML=w.wordingMarkup(id,'Narrative',note,'',id==='note-text',scope)+(id==='note-text'?w.wordingToolbar(id,'Narrative',true):'');
  const q=w.mountWording(id),el=w.document.getElementById(id);
  const select=(index,length=0)=>{q.setSelection(index,length,'api');w.rememberWordingSelection();};
  const click=selector=>{const button=w.document.querySelector(selector);assert.ok(button,selector);button.dispatchEvent(new w.MouseEvent('pointerdown',{bubbles:true,cancelable:true}));button.click();};
  const type=text=>{const range=q.getSelection();assert.ok(range);assert.equal(range.length,0);q.insertText(range.index,text,q.getFormat(range),'user');select(range.index+text.length);};
  const keyboardBold=()=>el.dispatchEvent(new w.KeyboardEvent('keydown',{key:'b',code:'KeyB',ctrlKey:true,bubbles:true,cancelable:true}));
  current={q,el,select,click,type,keyboardBold,read:()=>copy(w.readWording(el)),format:(command,value)=>w.formatWording(el,command,value)};
  q.focus({preventScroll:true});select(0);
  return current;
 }
 return {w,open,stored:()=>w.localStorage.getItem(KEY),close(){if(current)w.disposeWording(current.el.id);dom.window.close();}};
}
function assertTyping(c,{color,bold}){
 const format=c.q.getFormat(c.q.getSelection());
 assert.equal(format.bold===true,bold);
 assert.equal(format.color||'#000000',color);
}
const redBold=JSON.stringify({color:'#b42318',bold:true});

test('selected Note color and bold survive another note, another report and browser restart',()=>{
 const app=client();let saved;
 try{
  let c=app.open({text:'Leak found. Repair needed.'});c.select(0,11);
  c.click('[data-wording-color="#b42318"]');c.click('[data-wording-command="bold"]');
  assert.deepEqual(c.read().textRuns,[{text:'Leak found.',color:'#b42318',bold:true},{text:' Repair needed.'}]);
  for(const reportId of ['report-one','report-two']){
   c=app.open({text:''},{reportId});assertTyping(c,{color:'#b42318',bold:true});assert.deepEqual(c.read(),{text:''});
   c.type('New observation.');assert.deepEqual(c.read().textRuns,[{text:'New observation.',color:'#b42318',bold:true}]);
  }
  saved=app.stored();
 }finally{app.close();}
 const restarted=client({stored:saved});
 try{const c=restarted.open();assertTyping(c,{color:'#b42318',bold:true});c.type('After restart.');assert.equal(c.read().textRuns[0].color,'#b42318');assert.equal(c.read().textRuns[0].bold,true);}finally{restarted.close();}
});

test('opening and navigating an existing mixed-format note preserves its evidence and remembered preference',()=>{
 const old={text:'Blue text. Plain text.\n\n',textRuns:[{text:'Blue text.',color:'#245c99',italic:true},{text:' Plain text.\n\n'}]},app=client({stored:redBold});
 try{
  const c=app.open(old);assert.deepEqual(c.read(),old);assert.deepEqual(app.w.noteEditor.draft,old);
  const before=copy(c.q.getContents());
  c.select(0,10);assert.equal(c.q.getFormat(c.q.getSelection()).color,'#245c99');assert.equal(app.stored(),redBold);assert.deepEqual(c.read(),old);
  c.select(4);assertTyping(c,{color:'#b42318',bold:true});assert.deepEqual(c.read(),old);assert.deepEqual(app.w.noteEditor.draft,old);assert.deepEqual(copy(c.q.getContents()),before);
  c.select(old.text.length);c.type('Added wording.');
  assert.equal(c.read().text,old.text+'Added wording.');assert.equal(c.q.getFormat(old.text.length,14).color,'#b42318');assert.equal(c.q.getFormat(old.text.length,14).bold,true);
  assert.equal(c.q.getFormat(0,10).color,'#245c99');assert.equal(c.q.getFormat(0,10).italic,true);assert.equal(app.stored(),redBold);
 }finally{app.close();}
});

test('choosing black and normal weight replaces the preference for future notes',()=>{
 const app=client({stored:redBold});
 try{
  let c=app.open();c.click('[data-wording-color="#000000"]');c.click('[data-wording-command="bold"]');
  c=app.open();assertTyping(c,{color:'#000000',bold:false});c.type('Normal observation.');
  assert.equal(c.read().text,'Normal observation.');assert.equal(c.q.getFormat(0,19).bold,undefined);assert.equal(c.q.getFormat(0,19).color||'#000000','#000000');
  const persisted=JSON.parse(app.stored());assert.equal(persisted.color,'#000000');assert.equal(persisted.bold,false);
 }finally{app.close();}
});

test('Clear formatting changes only selected text and resets the future typing preference',()=>{
 const old={text:'First. Second.',textRuns:[{text:'First. ',color:'#245c99',italic:true},{text:'Second.',color:'#b42318',bold:true}]},app=client({stored:redBold});
 try{
  let c=app.open(old);c.select(7,7);c.click('[data-wording-command="removeFormat"]');
  assert.deepEqual(c.read().textRuns,[{text:'First. ',color:'#245c99',italic:true},{text:'Second.'}]);
  c=app.open();assertTyping(c,{color:'#000000',bold:false});c.type('Plain note.');assert.deepEqual(c.read(),{text:'Plain note.'});
 }finally{app.close();}
});

test('Fast note and Scope editors neither inherit nor overwrite the Note typing preference',()=>{
 const app=client({stored:redBold});
 try{
  let c=app.open({text:'Fast wording.'},{id:'library-note-text'});assertTyping(c,{color:'#000000',bold:false});c.select(0,13);c.format('bold');c.format('color','#226b43');c.format('removeFormat');assert.equal(app.stored(),redBold);
  c=app.open({text:'Scope wording.'},{id:'template-field-scope'});assertTyping(c,{color:'#000000',bold:false});c.select(0,14);c.format('bold');c.format('size','14pt');c.format('removeFormat');assert.equal(app.stored(),redBold);
  c=app.open();assertTyping(c,{color:'#b42318',bold:true});
 }finally{app.close();}
});

test('reading existing styles and choosing italic or underline does not create color or bold preferences',()=>{
 const app=client();
 try{
  let c=app.open({text:'Styled old note.',textRuns:[{text:'Styled old note.',color:'#b42318',bold:true}]});c.select(0,16);c.format('italic');c.format('underline');assert.equal(app.stored(),null);
  c=app.open();assertTyping(c,{color:'#000000',bold:false});assert.equal(app.stored(),null);
 }finally{app.close();}
});

test('keyboard bold choices are remembered for the next note',()=>{
 const app=client();
 try{
  let c=app.open();c.keyboardBold();assertTyping(c,{color:'#000000',bold:true});
  c=app.open();assertTyping(c,{color:'#000000',bold:true});c.keyboardBold();
  c=app.open();assertTyping(c,{color:'#000000',bold:false});
 }finally{app.close();}
});

test('invalid saved preferences cannot inject formatting or prevent editing',()=>{
 for(const stored of ['not json','null','[]','{"color":"url(javascript:bad)","bold":"yes","italic":true}','{"color":"#b42318","bold":false,"underline":true}']){
  const app=client({stored});
  try{const c=app.open();c.type('Safe wording.');assert.equal(c.read().text,'Safe wording.');assert.equal(c.q.getFormat(0,13).italic,undefined);assert.equal(c.q.getFormat(0,13).underline,undefined);assert.equal(c.q.getFormat(0,13).bold,undefined);assert.ok([undefined,'#b42318'].includes(c.q.getFormat(0,13).color));assert.equal(c.el.querySelectorAll('script,img').length,0);}finally{app.close();}
 }
});

test('unavailable browser storage still permits formatting and preference reuse in the current session',()=>{
 const app=client({blocked:true});
 try{
  let c=app.open();c.click('[data-wording-color="#b42318"]');c.click('[data-wording-command="bold"]');c.type('First.');
  c=app.open();assertTyping(c,{color:'#b42318',bold:true});c.type('Second.');assert.equal(c.read().textRuns[0].bold,true);
 }finally{app.close();}
});
