'use strict';
const wordingSelections=new WeakMap();
function wordingMarkup(id,label,note={text:''},descriptionId=''){
 return `<div class="wording-field field"><span id="${id}-label">${Wording.escape(label)}</span><div class="wording-toolbar" role="group" aria-label="${Wording.escape(label)} formatting" data-wording-toolbar="${id}">${[['bold','B','Bold'],['italic','I','Italic'],['underline','U','Underline']].map(([cmd,icon,name])=>`<button type="button" data-wording-command="${cmd}" aria-label="${name}" aria-pressed="false" title="${name}"><${cmd==='bold'?'b':cmd==='italic'?'i':'u'}>${icon}</${cmd==='bold'?'b':cmd==='italic'?'i':'u'}></button>`).join('')}<div class="wording-color-swatches" role="group" aria-label="Text color"><span>Text color</span>${Object.entries(Wording.editorColors).map(([value,name])=>`<button type="button" data-wording-color="${value}" class="color-swatch" style="--swatch:${value}" aria-label="${name} text color" title="${name}" aria-pressed="${value==='#000000'}"></button>`).join('')}</div><button type="button" data-wording-command="removeFormat" title="Clear selected text formatting">Clear formatting</button></div><div id="${id}" class="wording-editor" contenteditable="true" role="textbox" aria-multiline="true" aria-labelledby="${id}-label" ${descriptionId?`aria-describedby="${Wording.escape(descriptionId)}"`:""} spellcheck="true">${Wording.render(note)}</div></div>`;
}
function wordingColor(value){
 value=(value||'').toLowerCase();const rgb=value.match(/^rgb\(\s*(\d+),\s*(\d+),\s*(\d+)\s*\)$/);if(rgb)value='#'+rgb.slice(1).map(n=>Number(n).toString(16).padStart(2,'0')).join('');return Object.hasOwn(Wording.colors,value)?value:null;
}
function readWording(editor){
 const read=(node,style={})=>{
  if(node.nodeType===3)return [{text:node.nodeValue.replace(/\u00a0/g,' '),...style}];
  if(node.nodeType!==1)return [];
  const tag=node.tagName;if(['SCRIPT','STYLE','IFRAME','OBJECT','IMG','SVG'].includes(tag))return [];
  if(tag==='BR')return [{text:'\n',...style}];
  const next={...style};if(['B','STRONG'].includes(tag)||/^(bold|[6-9]00)$/.test(node.style.fontWeight))next.bold=true;if(['I','EM'].includes(tag)||node.style.fontStyle==='italic')next.italic=true;if(tag==='U'||node.style.textDecoration.includes('underline'))next.underline=true;
  const color=wordingColor(node.style.color||node.getAttribute('color'));if(color)next.color=color;
  const children=[...node.childNodes].filter(child=>child.nodeType===3||(child.nodeType===1&&!['SCRIPT','STYLE','IFRAME','OBJECT','IMG','SVG'].includes(child.tagName))),out=[];let prevBlock=false;
  children.forEach((child,i)=>{const block=child.nodeType===1&&['DIV','P','LI'].includes(child.tagName);if(i&&(block||prevBlock))out.push({text:'\n'});
   // Chromium's empty paragraph contains a placeholder BR, which is not an extra line.
   const part=read(child,next);if(!(block&&part.map(r=>r.text).join('')==='\n'))out.push(...part);prevBlock=block;
  });return out;
 };
 return Wording.assign({},read(editor));
}
function setWording(id,note){const editor=document.getElementById(id);editor.innerHTML=Wording.render(note);wordingSelections.delete(editor);}
function focusWordingEnd(id){const editor=document.getElementById(id);editor.focus({preventScroll:true});const range=document.createRange();range.selectNodeContents(editor);range.collapse(false);const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);rememberWordingSelection();}
function rememberWordingSelection(){
 const selection=window.getSelection();if(!selection?.rangeCount)return;const range=selection.getRangeAt(0),node=range.commonAncestorContainer,editor=(node.nodeType===1?node:node.parentElement)?.closest('.wording-editor');
 if(!editor)return;wordingSelections.set(editor,range.cloneRange());const bar=document.querySelector(`[data-wording-toolbar="${editor.id}"]`);if(!bar)return;
 bar.querySelectorAll('[data-wording-command][aria-pressed]').forEach(b=>b.setAttribute('aria-pressed',String(document.queryCommandState(b.dataset.wordingCommand))));
 const color=wordingColor(document.queryCommandValue('foreColor'))||'#000000';bar.querySelectorAll('[data-wording-color]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.wordingColor===color)));
}
function restoreWordingSelection(editor){editor.focus({preventScroll:true});const selection=window.getSelection(),saved=wordingSelections.get(editor),range=saved&&editor.contains(saved.commonAncestorContainer)?saved:document.createRange();if(range!==saved){range.selectNodeContents(editor);range.collapse(false);}selection.removeAllRanges();selection.addRange(range);}
function syncWordingEditor(editor){
 const value=readWording(editor);
 if(editor.id==='note-text'&&noteEditor){Wording.assign(noteEditor.draft,Wording.runs(value));noteHint('Draft changed. Save the note to update the report.');}
 if(editor.id==='library-note-text'&&libraryEditor)updateLibraryStyle();
}
document.addEventListener('selectionchange',rememberWordingSelection);
document.addEventListener('pointerdown',ev=>{const bar=ev.target.closest('[data-wording-toolbar]');if(!bar)return;rememberWordingSelection();if(ev.target.closest('button'))ev.preventDefault();});
document.addEventListener('click',ev=>{const button=ev.target.closest('[data-wording-command]');if(!button)return;const editor=document.getElementById(button.closest('[data-wording-toolbar]').dataset.wordingToolbar);restoreWordingSelection(editor);document.execCommand(button.dataset.wordingCommand,false);syncWordingEditor(editor);rememberWordingSelection();});
document.addEventListener('click',ev=>{const button=ev.target.closest('[data-wording-color]');if(!button)return;if(typeof supportedTextColors!=='undefined'&&!supportedTextColors.includes(button.dataset.wordingColor)){toast('Save your current work, then exit and reopen HomeKanban to use the updated text colors.',true);return;}const editor=document.getElementById(button.closest('[data-wording-toolbar]').dataset.wordingToolbar);restoreWordingSelection(editor);document.execCommand('foreColor',false,button.dataset.wordingColor);syncWordingEditor(editor);rememberWordingSelection();});
document.addEventListener('input',ev=>{if(ev.target.matches('.wording-editor'))syncWordingEditor(ev.target);});
document.addEventListener('paste',ev=>{
 const editor=ev.target.closest('.wording-editor');if(!editor)return;if([...ev.clipboardData.items].some(i=>i.kind==='file'&&i.type.startsWith('image/')))return;
 ev.preventDefault();document.execCommand('insertText',false,ev.clipboardData.getData('text/plain'));syncWordingEditor(editor);
});
document.addEventListener('drop',ev=>{if(ev.target.closest('.wording-editor'))ev.preventDefault();});
