'use strict';
// One personal list, shared by every template and report. No imported source pack.
function bankControlIcon(kind){const paths={up:'M12 19V5m-5 5 5-5 5 5',down:'M12 5v14m-5-5 5 5 5-5',remove:'m6 6 12 12M18 6 6 18',edit:'m15 5 4 4M4 20l5-1L20 8a2.8 2.8 0 0 0-4-4L5 15l-1 5Z'};return `<svg class="control-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="${paths[kind]}"/></svg>`;}
function bankFind(id){return (state.noteLibrary||[]).find(n=>n.id===id);}
function fastNoteLabel(n){return n.text.trim().replace(/\s+/g,' ').slice(0,80)||'Fast note';}
function bankCard(n,prefix,index){
 const label=fastNoteLabel(n),background=Object.hasOwn(Wording.backgrounds,n.background)?n.background:'white';
 if(prefix==='note')return `<article class="bank-card fast-note-row bank-bg-${background}"><button type="button" class="bank-insert" data-note-action="append-common" data-id="${e(n.id)}" aria-label="${e('Append '+label)}" title="Click to append this wording">${Wording.render(n)}</button></article>`;
 const arrow=(delta,icon,direction,disabled)=>noteAction('library-move',icon,`id="fast-note-${direction}-${e(n.id)}" data-id="${e(n.id)}" data-delta="${delta}" aria-label="${e('Move '+label+' '+direction)}" title="Move ${direction}" ${disabled?'disabled':''}`,'bank-icon');
 const controls=`<div class="bank-card-controls">${arrow(-1,bankControlIcon('up'),'up',index===0)}${arrow(1,bankControlIcon('down'),'down',index===(state.noteLibrary||[]).length-1)}${noteAction('library-edit',bankControlIcon('edit'),`data-id="${e(n.id)}" aria-label="${e('Edit '+label)}" title="Edit fast note"`,'bank-icon')}${noteAction('library-delete-card',bankControlIcon('remove'),`data-id="${e(n.id)}" aria-label="${e('Delete '+label)}" title="Delete fast note"`,'quiet danger bank-icon')}</div>`;
 return `<article id="fast-note-row-${e(n.id)}" class="bank-card fast-note-row fast-note-sortable bank-bg-${background}" data-fast-note-id="${e(n.id)}" draggable="true" tabindex="-1"><span class="fast-note-drag-handle" aria-hidden="true" title="Drag to reorder"><svg class="square-grip-icon" viewBox="0 0 8 12" aria-hidden="true" focusable="false"><rect x="0" y="0" width="3" height="3"/><rect x="5" y="0" width="3" height="3"/><rect x="0" y="4.5" width="3" height="3"/><rect x="5" y="4.5" width="3" height="3"/><rect x="0" y="9" width="3" height="3"/><rect x="5" y="9" width="3" height="3"/></svg></span><div class="bank-formatted-text">${Wording.render(n)}</div>${controls}</article>`;
}
function bankRows(prefix){return (state.noteLibrary||[]).map((n,index)=>bankCard(n,prefix,index)).join('')||`<p class="fast-notes-empty">${prefix==='note'?'No fast notes yet.':'No fast notes yet. Add your own frequently used wording.'}</p>`;}
function fastNoteCount(){return `<p class="help fast-notes-count">${(state.noteLibrary||[]).length} / ${Wording.FAST_NOTE_MAX_COUNT} fast notes · Up to ${Wording.FAST_NOTE_MAX_WORDS} words each</p>`;}
function addFastNoteButton(cls=''){const full=(state.noteLibrary||[]).length>=Wording.FAST_NOTE_MAX_COUNT;return noteAction('library-new','＋ Add Fast Note',full?'disabled title="50 fast notes reached. Delete one before adding another."':'',cls);}
function bankMarkup(prefix){return `<div id="${prefix}-bank-list" class="fast-notes-list">${bankRows(prefix)}</div>${prefix==='library'?fastNoteCount():''}`;}
function renderBank(prefix){const list=$(`#${prefix}-bank-list`);if(list){list.innerHTML=bankRows(prefix);if(prefix==='library')list.nextElementSibling.outerHTML=fastNoteCount();}}
function renderFastNotes(){return head('YOUR REUSABLE WORDING','Fast notes','Drag notes to reorder them, or use the arrows. Your order is shared across all reports.')+`<section class="card fast-notes-page" aria-label="Your fast notes">${bankMarkup('library')}<div id="fast-note-order-status" class="visually-hidden" role="status" aria-live="polite"></div><div class="actions fast-notes-actions">${addFastNoteButton()}${noteAction('library-save-all','Save','','primary')}</div></section>`;}
async function moveFastNote(id,to,direction=''){
 if(route!=='fast-notes')return false;
 const rows=state.noteLibrary||[],from=rows.findIndex(n=>n.id===id);
 if(from<0||!Number.isInteger(to)||to<0||to>=rows.length||from===to)return false;
 const [note]=rows.splice(from,1);rows.splice(to,0,note);dirty++;status('Unsaved changes');renderBank('library');
 const row=document.getElementById('fast-note-row-'+id),focus=document.getElementById(`fast-note-${direction}-${id}`)||row;
 focus?.focus({preventScroll:true});row?.scrollIntoView({block:'nearest'});
 $('#fast-note-order-status').textContent=`${fastNoteLabel(note)} moved to position ${to+1}.`;
 await saveNow();return true;
}
let fastNoteDragId=null,fastNotePointer=null,fastNoteScrollFrame=null;
function clearFastNoteDrag(){fastNoteDragId=null;document.querySelectorAll('[data-fast-note-id]').forEach(row=>row.classList.remove('fast-note-dragging','fast-note-drop-before','fast-note-drop-after'));}
function fastNoteDropTarget(ev){return fastNoteDragId&&route==='fast-notes'?ev.target.closest('[data-fast-note-id]'):null;}
document.addEventListener('dragstart',ev=>{
 const row=ev.target.closest('[data-fast-note-id]');if(!row||route!=='fast-notes')return;
 if(fastNotePointer||ev.target.closest('.bank-card-controls')){ev.preventDefault();return;}
 if(!bankFind(row.dataset.fastNoteId)||!ev.dataTransfer)return;
 fastNoteDragId=row.dataset.fastNoteId;ev.dataTransfer.effectAllowed='move';ev.dataTransfer.setData('text/plain',fastNoteDragId);row.classList.add('fast-note-dragging');
});
document.addEventListener('dragover',ev=>{
 const row=fastNoteDropTarget(ev);if(!row)return;ev.preventDefault();ev.dataTransfer.dropEffect='move';
 document.querySelectorAll('[data-fast-note-id]').forEach(item=>item.classList.remove('fast-note-drop-before','fast-note-drop-after'));
 if(row.dataset.fastNoteId===fastNoteDragId)return;
 const rect=row.getBoundingClientRect();row.classList.add(ev.clientY>rect.top+rect.height/2?'fast-note-drop-after':'fast-note-drop-before');
});
document.addEventListener('drop',async ev=>{
 const row=fastNoteDropTarget(ev),id=fastNoteDragId;if(!row){clearFastNoteDrag();return;}ev.preventDefault();
 const rows=state.noteLibrary||[],from=rows.findIndex(n=>n.id===id),target=rows.findIndex(n=>n.id===row.dataset.fastNoteId),rect=row.getBoundingClientRect();
 const insertion=target+(ev.clientY>rect.top+rect.height/2?1:0),to=insertion-(from<insertion?1:0);clearFastNoteDrag();
 if(from<0||target<0)return;try{await moveFastNote(id,to);}catch(error){toast(error.message,true);}
});
document.addEventListener('dragend',clearFastNoteDrag);
// Pointer dragging also works in embedded browsers that do not generate HTML drag events.
function pointerFastNoteTarget(){
 const drag=fastNotePointer;if(!drag?.active)return null;
 const row=document.elementFromPoint(drag.clientX,drag.clientY)?.closest('[data-fast-note-id]');
 document.querySelectorAll('[data-fast-note-id]').forEach(item=>item.classList.remove('fast-note-drop-before','fast-note-drop-after'));
 if(row&&row.dataset.fastNoteId!==drag.id){const rect=row.getBoundingClientRect();row.classList.add(drag.clientY>rect.top+rect.height/2?'fast-note-drop-after':'fast-note-drop-before');}
 return row;
}
function scrollFastNoteDrag(){
 fastNoteScrollFrame=null;const drag=fastNotePointer;if(!drag?.active)return;
 const step=drag.clientY<48?-18:drag.clientY>window.innerHeight-48?18:0;
 if(step){window.scrollBy(0,step);pointerFastNoteTarget();fastNoteScrollFrame=requestAnimationFrame(scrollFastNoteDrag);}
}
function stopFastNotePointer(){
 const drag=fastNotePointer;fastNotePointer=null;
 if(fastNoteScrollFrame!==null){cancelAnimationFrame(fastNoteScrollFrame);fastNoteScrollFrame=null;}
 if(drag?.row.hasPointerCapture?.(drag.pointerId))drag.row.releasePointerCapture(drag.pointerId);
 clearFastNoteDrag();
}
document.addEventListener('pointerdown',ev=>{
 const row=ev.target.closest('[data-fast-note-id]');if(!row||route!=='fast-notes'||ev.button!==0||ev.target.closest('.bank-card-controls')||fastNotePointer)return;
 ev.preventDefault();fastNotePointer={id:row.dataset.fastNoteId,row,pointerId:ev.pointerId,x:ev.clientX,y:ev.clientY,clientX:ev.clientX,clientY:ev.clientY,active:false};
 row.setPointerCapture(ev.pointerId);row.focus({preventScroll:true});
});
document.addEventListener('pointermove',ev=>{
 const drag=fastNotePointer;if(!drag||ev.pointerId!==drag.pointerId)return;
 drag.clientX=ev.clientX;drag.clientY=ev.clientY;
 if(!drag.active&&Math.hypot(ev.clientX-drag.x,ev.clientY-drag.y)<6)return;
 drag.active=true;drag.row.classList.add('fast-note-dragging');ev.preventDefault();pointerFastNoteTarget();
 if(fastNoteScrollFrame===null&&(ev.clientY<48||ev.clientY>window.innerHeight-48))fastNoteScrollFrame=requestAnimationFrame(scrollFastNoteDrag);
});
document.addEventListener('pointerup',async ev=>{
 const drag=fastNotePointer;if(!drag||ev.pointerId!==drag.pointerId)return;
 drag.clientX=ev.clientX;drag.clientY=ev.clientY;const row=pointerFastNoteTarget(),rows=state.noteLibrary||[],from=rows.findIndex(n=>n.id===drag.id),target=rows.findIndex(n=>n.id===row?.dataset.fastNoteId),rect=row?.getBoundingClientRect();
 const insertion=target+(rect&&ev.clientY>rect.top+rect.height/2?1:0),to=insertion-(from<insertion?1:0);stopFastNotePointer();
 if(!drag.active||from<0||target<0)return;try{await moveFastNote(drag.id,to);}catch(error){toast(error.message,true);}
});
document.addEventListener('pointercancel',ev=>{if(ev.pointerId===fastNotePointer?.pointerId)stopFastNotePointer();});
document.addEventListener('lostpointercapture',ev=>{if(ev.pointerId===fastNotePointer?.pointerId)stopFastNotePointer();});
document.addEventListener('keydown',ev=>{if(ev.key==='Escape'&&fastNotePointer){ev.preventDefault();stopFastNotePointer();}});
// Copy formatted wording only. Never change the finding's category or other fields.
function insertBankText(draft,n,append=true){Wording.append(draft,{text:n.text},append);}
