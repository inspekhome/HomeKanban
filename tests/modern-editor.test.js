'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {JSDOM}=require('../scripts/editor/node_modules/jsdom');
const Wording=require('../app/public/wording');
function editor(note={text:''},id='note-text'){
 const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'http://localhost',pretendToBeVisual:true,runScripts:'outside-only'}),w=dom.window;
 const rect=()=>({x:0,y:0,top:0,left:0,right:0,bottom:0,width:0,height:0});w.Range.prototype.getBoundingClientRect=rect;w.Range.prototype.getClientRects=()=>[];w.HTMLElement.prototype.scrollIntoView=()=>{};
 for(const key of ['execCommand','queryCommandState','queryCommandValue'])Object.defineProperty(w.document,key,{get(){throw Error('Removed editing API was accessed: '+key);}});
 w.noteEditor={draft:structuredClone(note)};w.libraryEditor=null;w.noteHint=()=>{};w.updateLibraryStyle=()=>{};
 for(const file of ['wording.js','vendor/editor.js','wording-editor.js'])vm.runInContext(fs.readFileSync(path.resolve('app/public',file),'utf8'),dom.getInternalVMContext());
 w.document.body.innerHTML=w.wordingMarkup(id,'Narrative',note);const q=w.mountWording(id),el=w.document.getElementById(id);
 const read=()=>JSON.parse(JSON.stringify(w.readWording(el)));
 const select=(start,length=0)=>{q.setSelection(start,length,'api');w.rememberWordingSelection();};
 return {dom,w,q,el,read,select,format:(name,value)=>w.formatWording(el,name,value),close:()=>{w.disposeWording(id);dom.window.close();}};
}
test('legacy note content and formatting round-trip without changing empty or trailing paragraphs',()=>{
 for(const text of ['', '\n', '\n\n', 'A\n\nB\n\n', ' Leak\t found.  ', '屋顶漏水。 Korean 한국어 😀']){
  const note={};Wording.assign(note,[{text,bold:true,underline:true,color:'#743a91'}]);const c=editor(note);
  try{assert.deepEqual(c.read(),note);assert.equal(c.q.getText().slice(0,-1),text);assert.equal(c.el.getAttribute('aria-label'),null);assert.equal(c.el.getAttribute('aria-labelledby'),'note-text-label');}finally{c.close();}
 }
});
test('partial formatting, mixed selections, clear formatting and undo/redo preserve unselected evidence',()=>{
 const c=editor({text:'Water leak. Repair needed.'});
 try{
  c.select(6,4);c.format('bold');c.format('color','#b42318');assert.deepEqual(c.read().textRuns,[{text:'Water '},{text:'leak',bold:true,color:'#b42318'},{text:'. Repair needed.'}]);
  c.q.history.undo();assert.equal(c.read().textRuns[1].bold,true);assert.equal(c.read().textRuns[1].color,undefined);
  c.q.history.redo();assert.equal(c.read().textRuns[1].color,'#b42318');
  c.select(0,10);c.format('italic');assert.equal(c.read().textRuns.find(r=>r.text==='leak').italic,true);
  c.select(6,4);c.format('removeFormat');assert.equal(c.read().text,'Water leak. Repair needed.');assert.equal(c.read().textRuns.find(r=>r.text.startsWith('leak')).bold,undefined);assert.equal(c.read().textRuns[0].italic,true);
  c.q.history.undo();assert.equal(c.read().textRuns.find(r=>r.text==='leak').color,'#b42318');
 }finally{c.close();}
});
test('caret formatting applies to newly typed text and clear formatting resets the typing style',()=>{
 const c=editor({text:'Observation: '});
 try{c.select(13);c.format('bold');c.format('color','#245c99');c.q.insertText(13,'leak',c.q.getFormat(13),'user');assert.equal(c.read().textRuns.at(-1).color,'#245c99');c.select(17);c.format('removeFormat');c.q.insertText(17,' repaired',c.q.getFormat(17),'user');assert.deepEqual(c.read().textRuns.at(-1),{text:' repaired'});}finally{c.close();}
});
test('pasted text replaces the selected words, keeps blank lines and cannot import external HTML',()=>{
 const c=editor({text:'Old words remain.'});
 try{
  c.select(0,9);const ev=new c.w.Event('paste',{bubbles:true,cancelable:true});Object.defineProperty(ev,'clipboardData',{value:{items:[],getData:type=>type==='text/plain'?'New\r\n\r\n文字':'<img src=x onerror=bad()><script>bad()</script>'}});c.el.dispatchEvent(ev);
  assert.equal(c.read().text,'New\n\n文字 remain.');assert.equal(c.el.querySelectorAll('script,img').length,0);assert.equal(ev.defaultPrevented,true);c.q.history.undo();assert.equal(c.read().text,'Old words remain.');c.q.history.redo();assert.equal(c.read().text,'New\n\n文字 remain.');
 }finally{c.close();}
});
test('image paste remains available to the note photo handler without putting images in the narrative',()=>{
 const c=editor({text:'Keep narrative.'});
 try{let received=false;c.w.document.addEventListener('paste',()=>received=true);const ev=new c.w.Event('paste',{bubbles:true,cancelable:true});Object.defineProperty(ev,'clipboardData',{value:{items:[{kind:'file',type:'image/png'}],getData:()=>''}});c.el.dispatchEvent(ev);assert.equal(received,true);assert.equal(c.read().text,'Keep narrative.');assert.equal(c.el.querySelectorAll('img').length,0);}finally{c.close();}
});
test('AI and Fast note replacements form separate undo steps and retain the existing text-run format',()=>{
 const old={text:'Leak.',textRuns:[{text:'Leak.',bold:true,color:'#b42318'}]},c=editor(old);
 try{c.w.setWording('note-text',{text:'A leak was observed.'});assert.equal(c.read().text,'A leak was observed.');c.q.history.undo();assert.deepEqual(c.read(),old);c.q.history.redo();assert.equal(c.read().text,'A leak was observed.');c.w.setWording('note-text',old);assert.deepEqual(c.read(),old);
  const combined=structuredClone(old);Wording.append(combined,{text:'Plain Fast note.'});c.w.setWording('note-text',combined);assert.equal(c.read().text,'Leak.\n\nPlain Fast note.');assert.equal(c.read().textRuns.at(-1).bold,undefined);c.q.history.undo();assert.deepEqual(c.read(),old);
 }finally{c.close();}
});
test('dictation appends after a selection, handles English and Chinese spacing, and can be undone',()=>{
 const c=editor({text:'Leak here. Repair needed.'});
 try{c.select(0,10);c.w.insertWordingVoiceText(c.el,'More detail.');assert.equal(c.read().text,'Leak here. More detail. Repair needed.');c.q.history.undo();assert.equal(c.read().text,'Leak here. Repair needed.');c.w.setWording('note-text',{text:'漏水。'});c.select(3);c.w.insertWordingVoiceText(c.el,'需要维修。');assert.equal(c.read().text,'漏水。 需要维修。');}finally{c.close();}
});
test('Fast note editor keeps its word limit and supported colors without affecting the report editor',()=>{
 const c=editor({text:'Fast note'},'library-note-text');
 try{c.select(0,9);c.format('underline');c.format('color','#e0b700');assert.equal(c.read().textRuns[0].underline,true);assert.equal(c.read().textRuns[0].color,'#e0b700');assert.equal(Wording.wordCount(c.read().text),2);assert.deepEqual(c.w.noteEditor.draft,{text:'Fast note'});}finally{c.close();}
});
test('the complete shipped text editor contains no deprecated editing commands',()=>{
 for(const file of ['app.js','notes.js','wording-editor.js','vendor/editor.js'])assert.doesNotMatch(fs.readFileSync(path.resolve('app/public',file),'utf8'),/\b(?:execCommand|queryCommandState|queryCommandValue)\b/,file);
});
