'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {JSDOM}=require('../scripts/editor/node_modules/jsdom');
const Wording=require('../app/public/wording');
function editor(note={text:''},id='note-text',scopeFormatting=false,onChange=null){
 const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'http://localhost',pretendToBeVisual:true,runScripts:'outside-only'}),w=dom.window;
 const rect=()=>({x:0,y:0,top:0,left:0,right:0,bottom:0,width:0,height:0});w.Range.prototype.getBoundingClientRect=rect;w.Range.prototype.getClientRects=()=>[];w.HTMLElement.prototype.scrollIntoView=()=>{};
 for(const key of ['execCommand','queryCommandState','queryCommandValue'])Object.defineProperty(w.document,key,{get(){throw Error('Removed editing API was accessed: '+key);}});
 w.noteEditor={draft:structuredClone(note)};w.libraryEditor=null;w.noteHint=()=>{};w.updateLibraryStyle=()=>{};
 for(const file of ['wording.js','vendor/editor.js','wording-editor.js'])vm.runInContext(fs.readFileSync(path.resolve('app/public',file),'utf8'),dom.getInternalVMContext());
 w.document.body.innerHTML=w.wordingMarkup(id,'Narrative',note,'',id==='note-text',scopeFormatting)+(id==='note-text'?`<section>${w.wordingToolbar(id,'Narrative',true)}</section>`:'');const q=w.mountWording(id,onChange),el=w.document.getElementById(id);
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

test('format buttons below the writing field preserve the selection and clear only the selected formatting',()=>{
 const c=editor({text:'Water leak. Repair needed.'});
 const click=selector=>{const button=c.w.document.querySelector(selector);button.dispatchEvent(new c.w.MouseEvent('pointerdown',{bubbles:true,cancelable:true}));button.click();};
 try{
  c.select(6,4);click('[data-wording-command="bold"]');click('[data-wording-color="#b42318"]');
  assert.deepEqual(c.read().textRuns,[{text:'Water '},{text:'leak',bold:true,color:'#b42318'},{text:'. Repair needed.'}]);
  click('[data-wording-command="removeFormat"]');assert.deepEqual(c.read(),{text:'Water leak. Repair needed.'});
  c.q.history.undo();assert.equal(c.read().textRuns[1].color,'#b42318');
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

test('scope font-size dropdown preserves selection, updates its record and supports undo and clear formatting',()=>{
 const record={scope:'Visual inspection only. Access may be limited.'},c=editor(Wording.scopeNote(record),'template-field-scope',true,value=>Wording.assignScope(record,value));
 try{
  assert.equal(c.w.document.querySelectorAll('[data-wording-color]').length,0);
  c.select(0,17);c.format('bold');c.format('italic');c.format('underline');
  const select=c.w.document.querySelector('[data-wording-size]');select.dispatchEvent(new c.w.MouseEvent('pointerdown',{bubbles:true}));select.focus();select.value='14pt';select.dispatchEvent(new c.w.Event('change',{bubbles:true}));
  assert.deepEqual(JSON.parse(JSON.stringify(record.scopeRuns)),[{text:'Visual inspection',bold:true,italic:true,underline:true,size:'14pt'},{text:' only. Access may be limited.'}]);
  assert.equal(c.el.querySelector('[style]').style.fontSize,'14pt');assert.equal(select.value,'14pt');
  c.q.history.undo();assert.equal(record.scopeRuns[0].size,undefined);assert.equal(record.scopeRuns[0].underline,true);
  c.q.history.redo();assert.equal(record.scopeRuns[0].size,'14pt');
  c.select(0,17);c.format('removeFormat');assert.deepEqual(record,{scope:'Visual inspection only. Access may be limited.'});
 }finally{c.close();}
});

test('scope formatting reopens with every allowed size and never enables color or unsupported sizes',()=>{
 for(const size of Wording.scopeSizes){
  const note={text:'First\n\nSecond\n',textRuns:[{text:'First',size,bold:true},{text:'\n\nSecond\n',italic:true}]},c=editor(note,'report-field-scope',true);
  try{assert.deepEqual(c.read(),note);c.select(0,5);assert.equal(c.w.document.querySelector('[data-wording-size]').value,size);c.format('color','#b42318');c.format('size','36pt');assert.deepEqual(c.read(),note);c.format('size',false);assert.equal(c.read().textRuns[0].size,undefined);assert.equal(c.read().textRuns[0].bold,true);}finally{c.close();}
 }
});

test('scope editor callbacks cannot change an open note draft and normal note editors do not accept scope font sizes',()=>{
 const c=editor({text:'Scope only'},'template-field-scope',true,()=>{});
 try{const draft=structuredClone(c.w.noteEditor.draft);c.select(0,5);c.format('bold');assert.deepEqual(c.w.noteEditor.draft,draft);}finally{c.close();}
 const note=editor({text:'Note only'});try{note.select(0,4);note.format('size','14pt');assert.deepEqual(note.read(),{text:'Note only'});}finally{note.close();}
});
