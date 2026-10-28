'use strict';
// Store text and a small, explicit formatting vocabulary, never user-supplied HTML.
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.Wording=api;})(globalThis,()=>{
 const colors={'#243746':'Default','#b42318':'Red','#245c99':'Blue','#226b43':'Green','#743a91':'Purple','#9a4b08':'Orange'};
 const editorColors={'#000000':'Black','#b42318':'Red','#ea8a00':'Orange','#245c99':'Blue','#e0b700':'Yellow','#226b43':'Green'};
 Object.assign(colors,editorColors);
 const backgrounds={white:'White',yellow:'Yellow',green:'Green',blue:'Blue',pink:'Pink'};
 const scopeSizes=['10pt','12pt','14pt'];
 const FAST_NOTE_MAX_WORDS=350,FAST_NOTE_MAX_COUNT=50;
 // Count words from plain text, not formatting. Contractions and hyphenated terms are one word.
 function wordCount(text){return (String(text??'').match(/[\p{L}\p{N}][\p{L}\p{N}\p{M}]*(?:['’\-\u2010\u2011][\p{L}\p{N}][\p{L}\p{N}\p{M}]*)*/gu)||[]).length;}
 function validateFastNotes(notes){
  if(notes===undefined)return;
  if(!Array.isArray(notes))throw Error('Invalid fast notes list.');
  if(notes.length>FAST_NOTE_MAX_COUNT)throw Error(`You can save up to ${FAST_NOTE_MAX_COUNT} fast notes. Delete a fast note before adding another.`);
  for(const note of notes)if(wordCount(note?.text)>FAST_NOTE_MAX_WORDS)throw Error(`Each fast note can contain up to ${FAST_NOTE_MAX_WORDS} words. Shorten the wording before saving.`);
 }
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function normalize(runs){
  const out=[];for(const r of runs||[]){if(typeof r?.text!=='string'||!r.text)continue;const n={text:r.text};for(const k of ['bold','italic','underline'])if(r[k]===true)n[k]=true;if(Object.hasOwn(colors,r.color)&&r.color!=='#243746')n.color=r.color;if(scopeSizes.includes(r.size))n.size=r.size;
   const last=out.at(-1);if(last&&['bold','italic','underline','color','size'].every(k=>last[k]===n[k]))last.text+=n.text;else out.push(n);
  }return out;
 }
 function runs(note){return Array.isArray(note.textRuns)&&note.textRuns.map(r=>r?.text||'').join('')===note.text?normalize(note.textRuns):normalize([{text:note.text||''}]);}
 function assign(note,input){const clean=normalize(input);note.text=clean.map(r=>r.text).join('');if(clean.some(r=>r.bold||r.italic||r.underline||r.color||r.size))note.textRuns=clean;else delete note.textRuns;return note;}
 function render(note){return runs(note).map(r=>{let html=escape(r.text).replace(/\n/g,'<br>');if(r.bold)html=`<strong>${html}</strong>`;if(r.italic)html=`<em>${html}</em>`;if(r.underline)html=`<u>${html}</u>`;if(r.color)html=`<span style="color:${r.color}">${html}</span>`;if(r.size)html=`<span style="font-size:${r.size}">${html}</span>`;return html;}).join('');}
 function validate(note,{allowSize=false,allowColor=true}={}){
  if(note.background!==undefined&&!Object.hasOwn(backgrounds,note.background))throw Error('Invalid fast note background.');
  if(note.textRuns===undefined)return;
  if(!Array.isArray(note.textRuns)||note.textRuns.length>10000)throw Error('Invalid note formatting.');
  const keys=['text','bold','italic','underline',...(allowColor?['color']:[]),...(allowSize?['size']:[])];
  let text='';for(const r of note.textRuns){if(!r||typeof r.text!=='string'||r.text.length>100000||Object.keys(r).some(k=>!keys.includes(k)))throw Error('Invalid note formatting.');for(const k of ['bold','italic','underline'])if(r[k]!==undefined&&typeof r[k]!=='boolean')throw Error('Invalid note formatting.');if(r.color!==undefined&&!Object.hasOwn(colors,r.color))throw Error('Invalid note text color.');if(r.size!==undefined&&!scopeSizes.includes(r.size))throw Error('Invalid scope font size.');text+=r.text;if(text.length>100000)throw Error('Note text is too long.');}
  if(text!==note.text)throw Error('Note formatting does not match its text.');
 }
 function scopeNote(record){return assign({},runs({text:record.scope||'',textRuns:record.scopeRuns}).map(({color,...run})=>run));}
 function assignScope(record,note){const value=scopeNote({scope:note.text,scopeRuns:note.textRuns});record.scope=value.text;if(value.textRuns)record.scopeRuns=value.textRuns;else delete record.scopeRuns;return record;}
 function validateScope(record){validate({text:record.scope,textRuns:record.scopeRuns},{allowSize:true,allowColor:false});}
 function append(draft,note,keep=true){const old=runs(draft),incoming=runs(note);assign(draft,keep&&draft.text.trim()?[...old,{text:'\n\n'},...incoming]:incoming);}
 return {colors,editorColors,backgrounds,scopeSizes,scopeNote,assignScope,validateScope,escape,normalize,runs,assign,render,validate,append,wordCount,validateFastNotes,FAST_NOTE_MAX_WORDS,FAST_NOTE_MAX_COUNT};
});
