'use strict';
const wordingSelections=new WeakMap();
const wordingEditors=new WeakMap();
function wordingToolbar(id,label,compact=false,scopeFormatting=false){
 const extra=scopeFormatting?`<label>Font size<select data-wording-size aria-label="Scope font size"><option value="">Default</option>${Wording.scopeSizes.map(size=>`<option value="${size}">${size.replace('pt',' pt')}</option>`).join('')}<option value="mixed" hidden disabled>Mixed</option></select></label>`:`<div class="wording-color-swatches" role="group" aria-label="Text color">${compact?'':'<span>Text color</span>'}${Object.entries(Wording.editorColors).map(([value,name])=>`<button type="button" data-wording-color="${value}" class="color-swatch" style="--swatch:${value}" aria-label="${name} text color" title="${name}" aria-pressed="${value==='#000000'}"></button>`).join('')}</div>`;
 return `<div class="wording-toolbar${compact?' note-format-toolbar':''}${scopeFormatting?' scope-format-toolbar':''}" role="group" aria-label="${Wording.escape(label)} formatting" data-wording-toolbar="${id}">${[['bold','B','Bold'],['italic','I','Italic'],['underline','U','Underline']].map(([cmd,icon,name])=>`<button type="button" data-wording-command="${cmd}" aria-label="${name}" aria-pressed="false" title="${name}"><${cmd==='bold'?'b':cmd==='italic'?'i':'u'}>${icon}</${cmd==='bold'?'b':cmd==='italic'?'i':'u'}></button>`).join('')}${extra}<button type="button" data-wording-command="removeFormat" title="Clear selected text formatting">Clear formatting</button></div>`;
}
function wordingMarkup(id,label,note={text:''},descriptionId='',detachedToolbar=false,scopeFormatting=false){
 const isNote=id==='note-text',voice=isNote&&typeof NoteVoice!=='undefined';
 const heading=isNote?`<div class="note-narrative-heading"><h3 id="${id}-label">${Wording.escape(label)}</h3>${voice?NoteVoice.toolbar():''}</div>`:`<span id="${id}-label">${Wording.escape(label)}</span>`;
 return `<div class="wording-field field${scopeFormatting?' scope-field full':''}">${heading}${detachedToolbar?'':wordingToolbar(id,label,false,scopeFormatting)}${voice?NoteVoice.help():''}<div id="${id}" class="wording-editor${scopeFormatting?' scope-editor':''}" ${scopeFormatting?'data-wording-kind="scope"':''} contenteditable="true" role="textbox" aria-multiline="true" aria-labelledby="${id}-label" ${descriptionId?`aria-describedby="${Wording.escape(descriptionId)}"`:""} spellcheck="true">${Wording.render(note)}</div></div>`;
}
function scopeMarkup(record,kind){
 const id=kind+'-field-scope',label='Standard of Practice, Scope & limitations',note=Wording.scopeNote(record);
 if(kind==='report')return `<div class="wording-field field scope-field full"><span id="${id}-label">${Wording.escape(label)}</span><div id="${id}" class="wording-editor scope-editor scope-readonly" contenteditable="false" role="textbox" aria-readonly="true" aria-multiline="true" aria-labelledby="${id}-label" tabindex="0">${Wording.render(note)}</div></div>`;
 return wordingMarkup(id,label,note,'',false,true);
}
function wordingColor(value){
 value=(value||'').toLowerCase();const rgb=value.match(/^rgb\(\s*(\d+),\s*(\d+),\s*(\d+)\s*\)$/);if(rgb)value='#'+rgb.slice(1).map(n=>Number(n).toString(16).padStart(2,'0')).join('');return Object.hasOwn(Wording.colors,value)?value:null;
}
function readWording(editor){
 const controller=wordingEditors.get(editor);
 if(controller){
  const contents=controller.quill.getContents();
  // Opening an older note is not an edit, including styling on line breaks.
  if(JSON.stringify(contents.ops)===controller.loadedDelta)return Wording.assign({},Wording.runs(controller.loadedNote));
  // Quill owns one terminating newline. Remove only that sentinel, keeping
  // every user-entered paragraph and trailing blank line.
  let remaining=Math.max(0,controller.quill.getLength()-1);const runs=[];
  for(const op of contents.ops){if(typeof op.insert!=='string')continue;const text=op.insert.slice(0,remaining);remaining-=text.length;if(text)runs.push({text,...op.attributes});}
  return Wording.assign({},runs);
 }
 const read=(node,style={})=>{
  if(node.nodeType===3)return [{text:node.nodeValue.replace(/\u00a0/g,' '),...style}];
  if(node.nodeType!==1)return [];
  const tag=node.tagName;if(['SCRIPT','STYLE','IFRAME','OBJECT','IMG','SVG'].includes(tag))return [];
  if(tag==='BR')return [{text:'\n',...style}];
  const next={...style};if(['B','STRONG'].includes(tag)||/^(bold|[6-9]00)$/.test(node.style.fontWeight))next.bold=true;if(['I','EM'].includes(tag)||node.style.fontStyle==='italic')next.italic=true;if(tag==='U'||node.style.textDecoration.includes('underline'))next.underline=true;
  const color=wordingColor(node.style.color||node.getAttribute('color'));if(color)next.color=color;
  if(Wording.scopeSizes.includes(node.style.fontSize))next.size=node.style.fontSize;
  const children=[...node.childNodes].filter(child=>child.nodeType===3||(child.nodeType===1&&!['SCRIPT','STYLE','IFRAME','OBJECT','IMG','SVG'].includes(child.tagName))),out=[];let prevBlock=false;
  children.forEach((child,i)=>{const block=child.nodeType===1&&['DIV','P','LI'].includes(child.tagName);if(i&&(block||prevBlock))out.push({text:'\n'});
   // Chromium's empty paragraph contains a placeholder BR, which is not an extra line.
   const part=read(child,next);if(!(block&&part.map(r=>r.text).join('')==='\n'))out.push(...part);prevBlock=block;
  });return out;
 };
 return Wording.assign({},read(editor));
}
function wordingDelta(note,Delta){const delta=new Delta();for(const run of Wording.runs(note)){const {text,...marks}=run;delta.insert(text,marks);}return delta.insert('\n');}
function mountWording(id,onChange=null){
 const old=document.getElementById(id);if(wordingEditors.has(old))return wordingEditors.get(old).quill;
 const note=readWording(old),scopeFormatting=old.dataset.wordingKind==='scope',{Quill,Delta}=HomeKanbanRichText();
 const attrs=['role','aria-multiline','aria-labelledby','aria-describedby','spellcheck','data-wording-kind'].map(name=>[name,old.getAttribute(name)]);
 old.removeAttribute('id');old.removeAttribute('contenteditable');for(const [name] of attrs)old.removeAttribute(name);
 old.className='wording-host';old.innerHTML='';
 const quill=new Quill(old,{formats:['bold','italic','underline',scopeFormatting?'size':'color'],modules:{toolbar:false,history:{delay:700,maxStack:100,userOnly:false},uploader:{handler:()=>{}}},theme:null});
 const editor=quill.root;editor.id=id;editor.classList.add('wording-editor');if(scopeFormatting)editor.classList.add('scope-editor');for(const [name,value] of attrs)if(value!==null)editor.setAttribute(name,value);
 quill.setContents(wordingDelta(note,Delta),'silent');quill.history.clear();
 const onText=()=>{syncWordingEditor(editor);updateWordingToolbar(editor);};
 const onSelection=range=>{if(range)wordingSelections.set(editor,{index:range.index,length:range.length});updateWordingToolbar(editor);};
 wordingEditors.set(editor,{quill,Delta,onText,onSelection,onChange,loadedDelta:JSON.stringify(quill.getContents().ops),loadedNote:note});
 quill.on('text-change',onText);quill.on('selection-change',onSelection);
 wordingSelections.set(editor,{index:0,length:0});updateWordingToolbar(editor);return quill;
}
function disposeWording(id){const editor=document.getElementById(id),controller=wordingEditors.get(editor);if(!controller)return;controller.quill.off('text-change',controller.onText);controller.quill.off('selection-change',controller.onSelection);controller.quill.disable();wordingSelections.delete(editor);wordingEditors.delete(editor);}
function setWording(id,note){
 const editor=document.getElementById(id),controller=wordingEditors.get(editor);
 if(!controller)throw Error('The text editor is not ready. Reopen the note.');
 const {quill,Delta}=controller,replacement=Wording.assign({},Wording.runs(note));quill.history.cutoff();quill.setContents(wordingDelta(replacement,Delta),'api');quill.history.cutoff();
 controller.loadedDelta=JSON.stringify(quill.getContents().ops);controller.loadedNote=replacement;syncWordingEditor(editor);
 wordingSelections.set(editor,{index:Math.max(0,quill.getLength()-1),length:0});updateWordingToolbar(editor);
}
function focusWordingEnd(id){const editor=document.getElementById(id),q=wordingEditors.get(editor)?.quill;if(!q)return;q.focus({preventScroll:true});q.setSelection(Math.max(0,q.getLength()-1),0,'api');rememberWordingSelection();}
function updateWordingToolbar(editor){
 const q=wordingEditors.get(editor)?.quill,bar=document.querySelector(`[data-wording-toolbar="${editor.id}"]`);if(!q||!bar)return;
 const range=q.getSelection()||wordingSelections.get(editor)||{index:0,length:0},format=q.getFormat(range);
 bar.querySelectorAll('[data-wording-command][aria-pressed]').forEach(b=>b.setAttribute('aria-pressed',String(format[b.dataset.wordingCommand]===true)));
 const color=Array.isArray(format.color)?null:wordingColor(format.color)||'#000000';bar.querySelectorAll('[data-wording-color]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.wordingColor===color)));
 const size=bar.querySelector('[data-wording-size]');if(size)size.value=Array.isArray(format.size)?'mixed':format.size||'';
}
function rememberWordingSelection(){
 const editor=document.activeElement?.closest?.('.wording-editor'),q=wordingEditors.get(editor)?.quill;if(!q)return;
 const range=q.getSelection();if(range)wordingSelections.set(editor,{index:range.index,length:range.length});updateWordingToolbar(editor);
}
function restoreWordingSelection(editor){
 const q=wordingEditors.get(editor)?.quill;if(!q)throw Error('The text editor is not ready. Reopen the note.');
 const saved=wordingSelections.get(editor)||{index:q.getLength()-1,length:0},index=Math.min(saved.index,q.getLength()-1),length=Math.min(saved.length,q.getLength()-1-index);
 q.focus({preventScroll:true});const current=q.getSelection();if(!current||current.index!==index||current.length!==length)q.setSelection(index,length,'silent');return q;
}
function formatWording(editor,command,value){
 const q=restoreWordingSelection(editor),range=q.getSelection();if(!range)return;
 q.history.cutoff();
 if(command==='removeFormat'){
  if(range.length)q.removeFormat(range.index,range.length,'user');
  else for(const name of q.options.formats)q.format(name,false,'user');
 }else q.format(command,value===undefined?q.getFormat(range)[command]!==true:value,'user');
 q.history.cutoff();rememberWordingSelection();updateWordingToolbar(editor);
}
function insertWordingVoiceText(editor,text){
 const q=restoreWordingSelection(editor),range=q.getSelection(),index=range.index+range.length,{Delta}=wordingEditors.get(editor);
 // Dictation adds after a selection, never replaces the selected evidence.
 const before=q.getText(0,index),after=q.getText(index,Math.max(0,q.getLength()-1-index));
 const gap=(left,right)=>left&&right&&!/\s$/u.test(left)&&!/^\s|^[,.;:!?，。！？；：、)\]}]/u.test(right)&&!/[([{]$/u.test(left)&&!(/[\p{Script=Han}]$/u.test(left)&&/^[\p{Script=Han}]/u.test(right))?' ':'';
 const words=gap(before,text)+text+gap(text,after);
 q.history.cutoff();q.updateContents(new Delta().retain(index).insert(words,q.getFormat(index)),'user');q.setSelection(index+words.length,0,'api');q.history.cutoff();rememberWordingSelection();
}
function syncWordingEditor(editor){
 const value=readWording(editor);
 wordingEditors.get(editor)?.onChange?.(value);
 if(editor.id==='note-text'&&noteEditor){Wording.assign(noteEditor.draft,Wording.runs(value));noteHint('Draft changed. Save the note to update the report.');}
 if(editor.id==='library-note-text'&&libraryEditor)updateLibraryStyle();
}
document.addEventListener('selectionchange',rememberWordingSelection);
document.addEventListener('pointerdown',ev=>{const bar=ev.target.closest('[data-wording-toolbar],.note-voice-tools');if(!bar)return;rememberWordingSelection();if(ev.target.closest('button'))ev.preventDefault();});
document.addEventListener('click',ev=>{const button=ev.target.closest('[data-wording-command]');if(!button)return;const editor=document.getElementById(button.closest('[data-wording-toolbar]').dataset.wordingToolbar);formatWording(editor,button.dataset.wordingCommand);});
document.addEventListener('click',ev=>{const button=ev.target.closest('[data-wording-color]');if(!button)return;if(typeof supportedTextColors!=='undefined'&&!supportedTextColors.includes(button.dataset.wordingColor)){toast('Save your current work, then exit and reopen HomeKanban to use the updated text colors.',true);return;}const editor=document.getElementById(button.closest('[data-wording-toolbar]').dataset.wordingToolbar);formatWording(editor,'color',button.dataset.wordingColor);});
document.addEventListener('change',ev=>{const select=ev.target.closest('[data-wording-size]');if(!select||(!Wording.scopeSizes.includes(select.value)&&select.value!==''))return;const editor=document.getElementById(select.closest('[data-wording-toolbar]').dataset.wordingToolbar);formatWording(editor,'size',select.value||false);});
document.addEventListener('drop',ev=>{if(ev.target.closest('.wording-editor'))ev.preventDefault();});
