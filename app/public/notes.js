'use strict';
// Report-page photo sessions are independent. Completed gestures update the shared
// photo record immediately, so both report views and autosave use the same image.
const ReportPhotos=(()=>{
 const sessions=new Map();
 const tools=[['left','Rotate left 90°'],['right','Rotate right 90°'],['arrow','Draw arrow'],['line','Draw straight line'],['arrow-row','Draw arrow row'],['rect','Draw rectangle'],['circle','Draw circle'],['text','Add text'],['undo','Undo']];
 const isCurrent=s=>sessions.get(s.card)===s&&state.reports.includes(s.r)&&s.r.findings.includes(s.finding)&&s.finding.photos.includes(s.photo);
 const button=(name,label,icon)=>`<button type="button" class="photo-icon ${['arrow','line','arrow-row','rect','circle','text'].includes(name)?'red-photo-tool':''}" data-report-photo="${name}" title="${label}" aria-label="${label}">${PhotoEditor.icon(icon||name)}</button>`;
 function controls(){return `<div class="report-photo-tools" role="group" aria-label="Photo tools">${tools.map(([name,label])=>button(name,label)).join('')}${button('save','Save photo')}</div><p class="report-photo-hint">Drag to draw. Press Esc to move or resize marks. Changes save locally; Save photo closes the tools.</p>`;}
 function matchingCards(s){return [...document.querySelectorAll('.report-photo')].filter(card=>card.dataset.photoFinding===s.finding.id&&Number(card.dataset.photoIndex)===s.finding.photos.indexOf(s.photo));}
 function preview(s){
  for(const card of matchingCards(s)){if(sessions.has(card))continue;const img=card.querySelector('.report-photo-surface img');if(img)img.src=s.photo.src;}
 }
 function update(s,edit){
  if(!isCurrent(s)||s.photo.src===edit.src)return;
  s.photo.src=edit.src;s.r.status='draft';s.r.updated=new Date().toISOString();changed();preview(s);
 }
 function updateState(s,status){
  if(!isCurrent(s))return;
  s.card.querySelectorAll('[data-report-photo]').forEach(b=>{
   const tool=b.dataset.reportPhoto;
   if(tools.some(([name])=>name===tool))b.setAttribute('aria-pressed',String(tool===status.tool));
   if(tool==='undo')b.disabled=!status.canUndo;
  });
 }
 function close(s){
  if(sessions.get(s.card)!==s)return;
  s.controller?.flush();s.controller?.dispose();sessions.delete(s.card);
  if(s.card.isConnected){
   s.card.querySelector('.report-photo-surface').innerHTML=`<img loading="lazy" src="${e(s.photo.src)}" alt="${e(s.photo.caption||'Inspection photograph')}">`;
   const controls=s.card.querySelector('.report-photo-controls');controls.hidden=true;controls.innerHTML='';
   s.card.querySelector('[data-report-photo="open"]').setAttribute('aria-expanded','false');
   s.card.classList.remove('report-photo-editing');
  }
  preview(s);
 }
 function closeWithin(container){for(const s of [...sessions.values()])if(container?.contains(s.card))close(s);}
 function closeFinding(id){for(const s of [...sessions.values()])if(s.finding.id===id)close(s);}
 async function open(card){
  if(sessions.has(card)||route!=='editor')return;
  const r=report(),finding=r?.findings.find(f=>f.id===card.dataset.photoFinding),photo=finding?.photos[Number(card.dataset.photoIndex)];if(!photo)return;
  // The same photo occurs in Summary and System checks. Keep a single writer.
  for(const existing of [...sessions.values()])if(existing.photo===photo)close(existing);
  const s={card,r,finding,photo,controller:null};sessions.set(card,s);
  const panel=card.querySelector('.report-photo-controls');panel.innerHTML=controls();panel.hidden=false;
  panel.querySelectorAll('button').forEach(b=>b.disabled=true);
  card.classList.add('report-photo-editing');card.querySelector('[data-report-photo="open"]').setAttribute('aria-expanded','true');
  const host=card.querySelector('.report-photo-surface');
  try{
   const controller=await PhotoEditor.mount(host,{src:photo.src,maxHeight:()=>host.clientHeight||300,onChange:edit=>update(s,edit),onState:status=>updateState(s,status)});
   if(!isCurrent(s)||!card.isConnected){controller.dispose();return;}
   s.controller=controller;panel.querySelectorAll('button').forEach(b=>b.disabled=false);updateState(s,{tool:'select',canUndo:false,selected:false});
  }catch(error){close(s);throw error;}
 }
 async function activate(card,name){
  if(name==='open')return open(card);
  const s=sessions.get(card);if(!s?.controller||!isCurrent(s))return;
  if(name==='save'){
   s.controller.flush();await saveNow();close(s);toast('Photo saved. Linked report views are updated.');
  }else{
   s.controller.command(name);
   const hint=card.querySelector('.report-photo-hint');if(hint)hint.textContent=name==='arrow-row'?'Drag across the row to place separate parallel arrows. Use the end handles to resize, the middle handle for arrow height, and the blue handle to rotate.':'Drag to draw. Press Esc to move or resize marks. Changes save locally; Save photo closes the tools.';
  }
 }
 document.addEventListener('click',async ev=>{
  const b=ev.target.closest('button[data-report-photo]');if(!b?.dataset.reportPhoto)return;
  const card=b.closest('.report-photo');if(!card)return;
  try{await activate(card,b.dataset.reportPhoto);}catch(error){toast(error.message,true);}
 });
 return {closeWithin,closeFinding,open,activate};
})();
// A note is edited as a local draft, then committed once to its shared report record.
let noteEditor=null, libraryEditor=null;
let noteVoiceConsent=null;
function syncNoteVoiceScope(reportId){
 if(typeof NoteVoice==='undefined')return;
 noteVoiceConsent??=NoteVoice.createConsentGate();noteVoiceConsent.enter(reportId);
 if(noteEditor&&noteEditor.reportId!==reportId){noteEditor.voice?.dispose();if($('#voice-confirm')?.open)$('#voice-confirm').close('cancel');}
}
const noteAction=(name,label,extra='',cls='')=>`<button type="button" data-note-action="${name}" ${extra} class="${cls}">${label}</button>`;
const noteLibrary=()=>state.noteLibrary||[];
// Window preferences belong to this browser/computer, never to a report draft.
const NOTE_WINDOW_KEY='soloinspect-note-window-v1';
let noteWindowPreference=null,noteWindowDrag=null;
function noteWindowBounds(){return {width:Math.max(1,window.innerWidth-24),height:Math.max(1,window.innerHeight-24)};}
function fitNoteWindow(size){
 const max=noteWindowBounds();
 return {width:Math.round(Math.min(max.width,Math.max(Math.min(640,max.width),size.width))),height:Math.round(Math.min(max.height,Math.max(Math.min(360,max.height),size.height)))};
}
function noteWindowSettings(){
 if(!noteWindowPreference){
  try{const p=JSON.parse(localStorage.getItem(NOTE_WINDOW_KEY));if(p&&Number.isFinite(p.width)&&p.width>0&&Number.isFinite(p.height)&&p.height>0)noteWindowPreference={width:p.width,height:p.height,maximized:p.maximized===true,...(Number.isFinite(p.left)&&Number.isFinite(p.top)?{left:p.left,top:p.top}:{})};}catch{}
  noteWindowPreference??={width:1320,height:820,maximized:false};
 }
 return noteWindowPreference;
}
function rememberNoteWindow(){try{localStorage.setItem(NOTE_WINDOW_KEY,JSON.stringify(noteWindowSettings()));}catch{ /* Resizing still works when browser storage is unavailable. */ }}
function noteWindowPosition(size,p=noteWindowSettings()){
 const left=p.maximized?12:p.left??(window.innerWidth-size.width)/2,top=p.maximized?12:p.top??(window.innerHeight-size.height)/2;
 return {left:Math.round(Math.max(12,Math.min(window.innerWidth-size.width-12,left))),top:Math.round(Math.max(12,Math.min(window.innerHeight-size.height-12,top)))};
}
function layoutNoteWindow(){
 const dialog=$('#note-dialog'),p=noteWindowSettings(),size=fitNoteWindow(p.maximized?noteWindowBounds():p);
 dialog.style.width=size.width+'px';dialog.style.height=size.height+'px';
 const position=noteWindowPosition(size,p);dialog.style.left=position.left+'px';dialog.style.top=position.top+'px';
 dialog.classList.toggle('note-window-maximized',p.maximized);
 dialog.classList.toggle('note-window-narrow',size.width<1000);dialog.classList.toggle('note-window-small',size.width<600);
 const maximize=dialog.querySelector('[data-note-action="maximize-window"]');
 if(maximize){maximize.textContent=p.maximized?'Restore':'Maximize';maximize.setAttribute('aria-pressed',String(p.maximized));}
 const grip=dialog.querySelector('[data-note-resize]');if(grip)grip.setAttribute('aria-label',`Resize note window, ${size.width} by ${size.height} pixels. Drag or use arrow keys.`);
 const move=dialog.querySelector('[data-note-move]');if(move)move.disabled=p.maximized;
 return size;
}
function resizeNoteWindow(size,remember=true){
 const p=noteWindowSettings(),next=fitNoteWindow(size),position=noteWindowPosition(fitNoteWindow(p),p);
 const anchored=Number.isFinite(p.left)&&!p.maximized;
 if(anchored){next.width=Math.min(next.width,window.innerWidth-position.left-12);next.height=Math.min(next.height,window.innerHeight-position.top-12);}
 noteWindowPreference={...next,maximized:false,...(anchored?position:{})};layoutNoteWindow();if(remember)rememberNoteWindow();
}
function moveNoteWindow(left,top,remember=true){
 const p=noteWindowSettings();if(p.maximized)return;
 noteWindowPreference={...p,...noteWindowPosition(fitNoteWindow(p),{...p,left,top})};
 layoutNoteWindow();if(remember)rememberNoteWindow();
}
function finishNoteWindowGesture(ev,cancel=false){
 const drag=noteWindowDrag;if(!drag||ev.pointerId!==drag.pointerId)return;
 noteWindowDrag=null;if(cancel){noteWindowPreference=drag.preference;layoutNoteWindow();}else rememberNoteWindow();
 $('#note-dialog').classList.toggle('note-window-moving',false);
 if(drag.grip.hasPointerCapture?.(ev.pointerId))drag.grip.releasePointerCapture(ev.pointerId);
}
$('#note-dialog').addEventListener('pointerdown',ev=>{
 if(ev.button!==0||noteWindowDrag)return;
 const resize=ev.target.closest('[data-note-resize]'),heading=ev.target.closest('.note-heading'),handle=ev.target.closest('[data-note-move]');
 if(!resize&&(!heading||noteWindowSettings().maximized||(!handle&&ev.target.closest('button,a,input,select,textarea'))))return;
 const grip=resize||handle||heading;
 ev.preventDefault();grip.focus({preventScroll:true});const rect=$('#note-dialog').getBoundingClientRect();
 noteWindowDrag={mode:resize?'resize':'move',pointerId:ev.pointerId,grip,x:ev.clientX,y:ev.clientY,left:rect.left,top:rect.top,width:rect.width,height:rect.height,anchored:Number.isFinite(noteWindowSettings().left)&&!noteWindowSettings().maximized,preference:{...noteWindowSettings()}};
 $('#note-dialog').classList.toggle('note-window-moving',!resize);
 grip.setPointerCapture(ev.pointerId);
});
$('#note-dialog').addEventListener('pointermove',ev=>{
 const drag=noteWindowDrag;if(!drag||ev.pointerId!==drag.pointerId)return;
 if(drag.mode==='move'){moveNoteWindow(drag.left+ev.clientX-drag.x,drag.top+ev.clientY-drag.y,false);return;}
 // Keep centered resizing until the user chooses a position, then anchor the top-left corner.
 const factor=drag.anchored?1:2;
 resizeNoteWindow({width:drag.width+factor*(ev.clientX-drag.x),height:drag.height+factor*(ev.clientY-drag.y)},false);
});
$('#note-dialog').addEventListener('pointerup',ev=>finishNoteWindowGesture(ev));
$('#note-dialog').addEventListener('pointercancel',ev=>finishNoteWindowGesture(ev,true));
$('#note-dialog').addEventListener('lostpointercapture',ev=>finishNoteWindowGesture(ev));
$('#note-dialog').addEventListener('keydown',ev=>{
 if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(ev.key))return;
 if(ev.target.closest('[data-note-move]')){
  ev.preventDefault();const position=noteWindowPosition(layoutNoteWindow()),step=ev.shiftKey?40:10;
  moveNoteWindow(position.left+(ev.key==='ArrowRight'?step:ev.key==='ArrowLeft'?-step:0),position.top+(ev.key==='ArrowDown'?step:ev.key==='ArrowUp'?-step:0));return;
 }
 if(!ev.target.closest('[data-note-resize]'))return;
 ev.preventDefault();const size=layoutNoteWindow(),step=ev.shiftKey?64:24;
 if(ev.key==='ArrowLeft')size.width-=step;if(ev.key==='ArrowRight')size.width+=step;if(ev.key==='ArrowUp')size.height-=step;if(ev.key==='ArrowDown')size.height+=step;
 resizeNoteWindow(size);
});
window.addEventListener('resize',()=>{if($('#note-dialog').open)layoutNoteWindow();});
function confirmNote(message,label='Discard changes'){
 const dialog=$('#note-confirm');
 dialog.innerHTML=`<h2>Confirm change</h2><p>${e(message)}</p><form method="dialog" class="actions"><button value="cancel" autofocus>Keep editing</button><button value="confirm" class="primary">${e(label)}</button></form>`;
 return new Promise(resolve=>{dialog.addEventListener('close',()=>resolve(dialog.returnValue==='confirm'),{once:true});dialog.returnValue='cancel';dialog.showModal();});
}
function noteChanged(){return !!noteEditor&&(!!noteEditor.photoDrafts?.size||!!noteEditor.inlinePhoto?.controller?.dirty||JSON.stringify(noteEditor.draft)!==noteEditor.original);}
function noteHint(message){$('#note-message').textContent=message;}
function noteDestination(r,draft){const ref=findingComponent(r,draft);return draft.origin==='summary'?'':ref?`${ref.section.name} / ${ref.item.name}`:'System checks / Other observations';}
function setNoteSummary(included){
 if(!noteEditor)return;
 if(noteEditor.summaryOnly){noteEditor.draft.includeInSummary=true;return;}
 noteEditor.draft.includeInSummary=included;
 const r=state.reports.find(r=>r.id===noteEditor.reportId);
 if(r){const destination=$('#note-destination'),text=noteDestination(r,noteEditor.draft);destination.textContent=text;destination.hidden=!text;}
 noteHint('Draft changed. Save the note to update the report.');
}
function openNote(findingId=null,sectionId=null,itemId=null,origin=null,source='checklist'){
 disposeWording('note-text');
 noteEditor?.voice?.dispose();
 if($('#voice-confirm')?.open)$('#voice-confirm').close('cancel');
 if(typeof ReportPhotos!=='undefined')ReportPhotos.closeFinding(findingId);
 const r=report(),existing=r.findings.find(f=>f.id===findingId),section=r.sections.find(s=>s.id===sectionId),item=section?.items.find(i=>i.id===itemId);
 const draft=existing?clone(existing):{id:uid(),location:item?`${section.name} / ${item.name}`:'',category:categories[0],text:'',photos:[],includeInSummary:true,origin:source,...(item?{sectionId:section.id,itemId:item.id}:{})};
 if(draft.origin==='summary')draft.includeInSummary=true;
 const returnAnchor=origin||(draft.origin==='summary'?'finding-':'check-finding-')+draft.id;
 noteEditor={reportId:r.id,draft,original:JSON.stringify(draft),existing:!!existing,photoDrafts:new Map(),origin:returnAnchor,summaryOnly:draft.origin==='summary',busy:false};
 const destination=noteDestination(r,draft);
 $('#note-dialog').innerHTML=`<header class="note-heading"><div class="note-window-title"><button type="button" class="note-move-grip" data-note-move aria-label="Move note window" title="Drag the title bar to move. Focus this handle and use arrow keys to move with the keyboard."><span aria-hidden="true">✥</span></button><div><h2 id="note-title">${existing?'Edit Note':'New Note'}</h2><p class="help" id="note-destination" ${destination?'':'hidden'}>${e(destination)}</p></div></div><div class="note-window-controls">${noteAction('maximize-window','Maximize','aria-pressed="false"','small')}${noteAction('cancel','Close','aria-label="Close note editor"','quiet')}</div></header>
 <div class="note-layout bank-note-layout">${noteAction('toggle-note-bank','Fast notes','aria-expanded="false" aria-controls="note-bank-sidebar"','note-bank-toggle')}<aside id="note-bank-sidebar" class="note-library"><h3>Fast notes</h3>${bankMarkup('note')}</aside><div class="note-writing">
 <section class="note-photo-section" aria-labelledby="note-photos-title"><div class="note-row"><h3 id="note-photos-title">Photos</h3>${noteAction('add-photos','＋ Add photos','','small')}</div><input id="note-photo-file" type="file" accept="image/jpeg,image/png,image/webp" multiple hidden><div id="note-photos"></div></section>
 ${wordingMarkup('note-text','Note / report narrative',draft,'',true)}
 <fieldset class="note-categories"><legend class="visually-hidden">Category</legend>${categories.map(c=>`<label><input type="radio" name="note-category" data-note-field="category" value="${e(c)}" ${c===draft.category?'checked':''}><span>${e(c)}</span></label>`).join('')}</fieldset>
 <div class="note-tools"><div class="note-secondary-tools">${wordingToolbar('note-text','Note / report narrative',true)}${noteEditor.summaryOnly?'':`<div class="note-summary-control"><label class="note-summary-toggle"><input type="checkbox" role="switch" class="note-summary-switch" data-note-field="includeInSummary" ${draft.includeInSummary!==false?'checked':''}> Add to summary</label></div>`}</div><div class="note-ai-control">${noteAction('ai','✧ AI Revise','title="Polish all text in this note"','small')}${noteAction('undo-ai','Undo AI revision','hidden','small')}<p class="help">Uses your saved AI instructions. Requires Internet; API fees apply.</p></div></div></div>
 <footer class="note-footer"><div id="note-message" class="help" role="status"></div><div class="actions">${noteAction('cancel','Cancel')}${noteAction('save',existing?'Update note':'Add note','','primary')}</div></footer></div><button type="button" class="note-window-grip" data-note-resize title="Drag to resize. Arrow keys also adjust the size."><span aria-hidden="true">◢</span></button>`;
 mountWording('note-text');renderNotePhotos();$('#note-dialog').classList.remove('note-bank-open');layoutNoteWindow();$('#note-dialog').showModal();$('#note-text').focus({preventScroll:true});$('#note-dialog').scrollTop=0;initNoteVoice(noteEditor);
}
function initNoteVoice(session){
 if(typeof NoteVoice==='undefined')return;
 syncNoteVoiceScope(session.reportId);
 const editor=$('#note-text'),button=$('#note-dialog [data-note-action="voice"]');
 if(!button)return;
 const current=()=>noteEditor===session&&route==='editor'&&currentId===session.reportId&&$('#note-dialog').open&&editor.isConnected;
 session.voice=NoteVoice.create({getUserMedia:navigator.mediaDevices?.getUserMedia.bind(navigator.mediaDevices),Recorder:window.MediaRecorder,isCurrent:current,
  transcribe:async(blob,signal)=>{
   const audio=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(Error('Unable to read this recording.'));reader.readAsDataURL(blob);});
   if(!current()||signal.aborted)throw Error('Voice input cancelled.');
   const result=await api('/api/transcribe','POST',{audio,mime:blob.type},{signal});return result.text;
  },
  onText:text=>insertNoteVoiceText(session,text),
  onInterim:text=>{const el=$('#note-voice-interim');el.textContent=text?'Hearing: '+text:'';el.hidden=!text;},
  onMessage:text=>{$('#note-voice-status').textContent=text;},
  onState:status=>{
   const listening=status!=='idle';button.classList.toggle('is-listening',listening);button.setAttribute('aria-pressed',String(listening));
   const actionLabel=status==='retry'?'Retry voice transcription':status==='transcribing'?'Transcribing voice input':status==='stopping'?'Finishing recording':listening?'Stop voice input':'Start voice input';
   button.setAttribute('aria-label',actionLabel);button.title=actionLabel;button.setAttribute('data-voice-state',status);
   button.querySelector('[data-voice-label]').textContent=status==='transcribing'?'Transcribing…':status==='retry'?'Retry':status==='stopping'?'Finishing…':listening?'Stop':'Voice input';button.disabled=['stopping','transcribing'].includes(status);$('#note-dialog [data-note-action="cancel-voice"]').hidden=!listening;
  }
 });
}
function insertNoteVoiceText(session,text){
 if(noteEditor!==session||!$('#note-dialog').open)return;
 const editor=$('#note-text');if(readWording(editor).text.length+text.length+2>100000)throw Error('This note has reached its text limit. Shorten it before adding more voice text.');
 insertWordingVoiceText(editor,text);
}
async function toggleNoteVoice(){
 const session=noteEditor;if(!session?.voice)return;
 if(session.voice.active){await session.voice.stop();return;}
 if(session.voicePrompt)return;
 if(session.aiBusy){noteHint('Wait for AI Revise to finish before starting voice input.');return;}
 restoreWordingSelection($('#note-text'));rememberWordingSelection();
 session.voicePrompt=true;
 const current=()=>noteEditor===session&&route==='editor'&&currentId===session.reportId&&$('#note-dialog').open;
 try{
  const cfg=await api('/api/voice-settings');if(!current())return;
  if(!cfg.multilingual||!cfg.hasKey){$('#note-voice-status').textContent=cfg.multilingual?'Set up your OpenAI API key in AI & settings → Voice Input first.':'Save your work, then restart HomeKanban to enable multilingual Voice Input.';return;}
  const allowed=await noteVoiceConsent.request(session.reportId,()=>confirmNoteVoice(session),current);
  if(!current())return;
  if(!allowed){$('#note-voice-status').textContent='Voice input was not started.';return;}
  restoreWordingSelection($('#note-text'));rememberWordingSelection();await session.voice.start();
 }finally{session.voicePrompt=false;}
}
function confirmNoteVoice(session){
 const dialog=$('#voice-confirm'),r=state.reports.find(r=>r.id===session.reportId);if(!r)return Promise.resolve(false);
 dialog.innerHTML=`<h2 id="voice-confirm-title">Use voice input for this report?</h2><p><strong>${e(r.address||'Address not entered')}</strong>${r.client?'<br>'+e(r.client):''}</p><p>Click Stop to send this recording to <strong>OpenAI</strong> for transcription using your Voice Input API key. Internet and API charges apply. After 3 minutes, recording stops and transcribes automatically.</p><p>Languages are detected automatically. The original language is kept; use AI Revise for English wording. HomeKanban holds audio only in memory and does not save recordings to disk. Cancel voice discards the recording.</p><p class="help">Allow voice input while this report stays open. We will ask again when you leave and reopen it, or switch to another report. Your browser may also request microphone permission.</p><form method="dialog" class="actions"><button value="cancel" autofocus>Cancel</button><button value="allow" class="primary">Allow for this report</button></form>`;
 return new Promise(resolve=>{dialog.addEventListener('close',()=>resolve(dialog.returnValue==='allow'),{once:true});dialog.returnValue='';dialog.showModal();});
}
async function finishNoteVoice(session){const complete=await session.voice.stop();return complete!==false&&noteEditor===session;}
function renderCommonNotes(){if(noteEditor)renderBank('note');}
function notePhotoSource(photo){return noteEditor.photoDrafts?.get(photo)?.src||photo.src;}
function endInlinePhoto(session=noteEditor,discard=false){const active=session?.inlinePhoto;if(!active)return;if(!discard)active.controller?.flush();active.controller?.dispose();session.inlinePhoto=null;}
function renderNotePhotos(){
 endInlinePhoto();
 const photos=noteEditor.draft.photos;
 const editTools=[['left','Rotate left 90°'],['right','Rotate right 90°'],['arrow','Draw arrow'],['line','Draw straight line'],['arrow-row','Draw arrow row'],['rect','Draw rectangle'],['circle','Draw circle'],['text','Add text']];
 $('#note-photos').innerHTML=photos.length?`<div class="note-photo-grid">${photos.map((ph,j)=>`<figure data-note-photo="${j}"><div class="note-photo-frame"><div class="note-photo-surface" data-note-photo-drag="${j}" draggable="true" tabindex="0" role="img" aria-label="Photo ${j+1}. Drag to reorder; Alt and arrow keys also move it." title="Drag this photo to change its order"><img draggable="false" src="${e(notePhotoSource(ph))}" alt="${e(ph.caption||'Inspection photograph '+(j+1))}"></div>${noteAction('remove-photo','<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>',`data-index="${j}" aria-label="Remove photo ${j+1}" title="Remove photo ${j+1}"`,'photo-remove')}</div><div class="note-photo-toolbar"><div class="note-photo-tools" role="group" aria-label="Edit photo ${j+1}">${editTools.map(([tool,label])=>noteAction('edit-photo',PhotoEditor.icon(tool),`data-index="${j}" data-tool="${tool}" aria-label="${label} on photo ${j+1}" title="${label}"`,'photo-icon '+(['left','right'].includes(tool)?'':'red-photo-tool'))).join('')}${noteAction('edit-photo',PhotoEditor.icon('undo'),`data-index="${j}" data-tool="undo" aria-label="Undo photo ${j+1} edit" title="Undo" ${noteEditor.photoDrafts?.get(ph)?.history?.length?'':'disabled'}`,'photo-icon')}${noteAction('save-photo',PhotoEditor.icon('save'),`data-index="${j}" aria-label="Save photo ${j+1}" title="Save photo" ${noteEditor.photoDrafts?.has(ph)?'':'disabled'}`,'photo-icon')}</div></div></figure>`).join('')}</div>`:noteAction('add-photos','Click to add photos, or drop them here. JPG, PNG, WebP · up to 30 photos.','aria-label="Add photos or drop images here"','note-drop-hint');
}
function applyNotePhotoDrafts(session){endInlinePhoto(session);for(const [photo,edit] of session.photoDrafts||[])photo.src=edit.src;session.photoDrafts?.clear();}
function saveNotePhoto(index){
 endInlinePhoto();const ph=noteEditor.draft.photos[index],edit=noteEditor.photoDrafts?.get(ph);if(edit){ph.src=edit.src;noteEditor.photoDrafts.delete(ph);}renderNotePhotos();noteHint('Photo saved in this note. Select Add note or Update note to save the report.');
}
function inlinePhotoState(session,photo,status){
 if(noteEditor!==session)return;const index=session.draft.photos.indexOf(photo),card=$(`#note-photos [data-note-photo="${index}"]`);if(!card)return;
 card.querySelectorAll('[data-note-action="edit-photo"]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tool===status.tool)));
 card.querySelector('[data-tool="undo"]').disabled=!status.canUndo;
 card.querySelector('[data-note-action="save-photo"]').disabled=!session.photoDrafts.has(photo)&&!status.changed;
}
async function editNotePhoto(index,tool){
 const session=noteEditor;if(!session||session.busy)return;const photo=session.draft.photos[index];if(!photo)return;
 if(session.inlinePhoto?.photo===photo&&session.inlinePhoto.controller){session.inlinePhoto.controller.command(tool);if(['arrow-row','end-arrows'].includes(tool))noteHint('Drag across the row to place separate parallel arrows. Drag end handles to resize, the middle handle to adjust arrow height, or the blue round handle to rotate. Save photo when finished.');return;}
 endInlinePhoto(session);session.photoDrafts??=new Map();session.busy=true;$('#note-dialog [data-note-action="save"]').disabled=true;
 try{
  const pending=session.photoDrafts.get(photo);
  if(tool==='left'||tool==='right'){
   const edit=await PhotoEditor.turn(photo.src,tool==='left'?-1:1,pending?.model,pending?.history);if(noteEditor!==session)return;
   session.photoDrafts.set(photo,edit);renderNotePhotos();noteHint('Photo rotated. Save photo to apply it, or keep editing.');
  }else{
   renderNotePhotos();const card=$(`#note-photos [data-note-photo="${index}"]`),host=card.querySelector('.note-photo-surface'),active={photo,controller:null};session.inlinePhoto=active;
   const controller=await PhotoEditor.mount(host,{src:photo.src,pending:pending?.model,undoHistory:pending?.history,tool:tool==='undo'?'select':tool,onChange:edit=>{if(noteEditor===session&&session.draft.photos.includes(photo)){session.photoDrafts.set(photo,edit);noteHint('Photo changed. Save photo to finish.');}},onState:status=>inlinePhotoState(session,photo,status)});
   if(noteEditor!==session||session.inlinePhoto!==active){controller.dispose();return;}active.controller=controller;if(tool==='undo')controller.command('undo');
   if(['arrow-row','end-arrows'].includes(tool))noteHint('Drag across the row to place separate parallel arrows. Drag end handles to resize, the middle handle to adjust arrow height, or the blue round handle to rotate. Save photo when finished.');
  }
 }catch(err){toast(err.message,true);if(noteEditor===session){endInlinePhoto(session,true);renderNotePhotos();noteHint(err.message);}}
 finally{session.busy=false;if(noteEditor===session)$('#note-dialog [data-note-action="save"]').disabled=false;}
}
function reorderNotePhoto(from,to){
 if(!noteEditor||noteEditor.busy)return;const photos=noteEditor.draft.photos;if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||to<0||from>=photos.length||to>=photos.length||from===to)return;
 endInlinePhoto();const [photo]=photos.splice(from,1);photos.splice(to,0,photo);renderNotePhotos();noteHint('Photo order changed. Save the note to apply it.');
}
async function addNotePhotos(files){
 const session=noteEditor;if(!session||!files.length)return;
 try{
  if(session.busy)throw Error('Please wait for the current photos to finish.');
  if(session.draft.photos.length+files.length>30)throw Error('Each note supports up to 30 photos.');
  session.busy=true;$('#note-dialog [data-note-action="save"]').disabled=true;noteHint('Preparing photos locally…');
  const photos=[];for(const file of files)photos.push({src:await imageData(file),caption:''});
  if(noteEditor!==session)return;
  session.draft.photos.push(...photos);renderNotePhotos();noteHint('');
 }catch(err){toast(err.message,true);if(noteEditor===session)noteHint(err.message);}
 finally{session.busy=false;if(noteEditor===session)$('#note-dialog [data-note-action="save"]').disabled=false;}
}
async function closeNote(force=false){
 if($('#voice-confirm')?.open)$('#voice-confirm').close('cancel');
 if(!force&&(noteChanged()||noteEditor?.voice?.active)&&!await confirmNote('Discard the unsaved changes and any pending voice recording in this note?'))return;
 noteEditor?.voice?.abort('Voice input stopped.');
 noteEditor?.voice?.dispose();endInlinePhoto(noteEditor,true);$('#note-dialog').close();noteEditor=null;
}
async function saveNote(){
 const session=noteEditor;if(!session||session.busy)return;
 if(session.voice?.active&&!await finishNoteVoice(session))return;
 const r=state.reports.find(r=>r.id===session.reportId);if(!r)throw Error('The report no longer exists.');
 applyNotePhotoDrafts(session);
 if(session.summaryOnly){session.draft.origin='summary';session.draft.includeInSummary=true;}
 if(!session.draft.text.trim()&&!session.draft.photos.length)throw Error('Enter a note or add a photo before saving.');
 if(session.existing){const index=r.findings.findIndex(f=>f.id===session.draft.id);if(index<0)throw Error('The note no longer exists.');r.findings[index]=clone(session.draft);}
 else r.findings.push(clone(session.draft));
 const origin=session.draft.includeInSummary===false?'check-finding-'+session.draft.id:session.origin;
 changed();await closeNote(true);render();jumpTo(origin);await saveNow();toast('Note saved. Linked views have been updated.');
}
function updateNoteAIControls(){
 const button=$('#note-dialog [data-note-action="ai"]'),undo=$('#note-dialog [data-note-action="undo-ai"]');
 button.disabled=!!noteEditor?.aiBusy;button.textContent=noteEditor?.aiBusy?'Revising…':'✧ AI Revise';button.setAttribute('aria-busy',String(!!noteEditor?.aiBusy));
 undo.hidden=!noteEditor?.aiUndo;undo.disabled=!!noteEditor?.aiBusy;
}
async function reviseNote(){
 const session=noteEditor;if(!session||session.aiBusy)return;
 if(session.voice?.active&&!await finishNoteVoice(session))return;
 if(session.aiBusy||noteEditor!==session)return;
 // Always read the entire editor at click time, regardless of the current selection.
 const original=readWording($('#note-text'));
 if(!original.text.trim())throw Error('Enter a note before using AI Revise.');
 if(original.text.length>100000)throw Error('AI Revise supports notes up to 100,000 characters. Your text has not been sent.');
 session.aiBusy=true;updateNoteAIControls();noteHint('Preparing to revise all text in this note…');
 const unchanged=()=>noteEditor===session&&JSON.stringify(readWording($('#note-text')))===JSON.stringify(original);
 try{
  const cfg=await api('/api/settings');if(noteEditor!==session)return;
  if(!cfg.hasKey||!cfg.model)throw Error('Configure your API key and model in AI & settings first. Your note has not been sent.');
  if(cfg.aiRevision!=='polish-v2')throw Error('Save your work, then exit and reopen HomeKanban to activate the updated AI Revise. Your note has not been sent.');
  if(!unchanged()){noteHint('The note changed. Click AI Revise again to revise the latest text. Nothing was sent.');return;}
  noteHint('Polishing all note text: spelling, grammar, and clarity…');
  const result=await api('/api/ai','POST',{text:original.text,language:'English'});
  if(noteEditor!==session)return;
  if(!unchanged()){noteHint('The note changed while AI was working. Your latest edits were kept. Click AI Revise again when ready.');return;}
  if(typeof result.draft!=='string'||!result.draft.trim()||result.draft.length>100000)throw Error('The AI service did not return usable wording. Your note is unchanged.');
  Wording.assign(session.draft,[{text:result.draft}]);setWording('note-text',session.draft);
  session.aiUndo={before:original,after:readWording($('#note-text'))};
  noteHint('AI revision applied. Review the wording, then select '+(session.existing?'Update note':'Add note')+'. Use Undo AI revision to restore your previous wording.');
 }catch(error){if(noteEditor===session)noteHint(error.message);}
 finally{session.aiBusy=false;if(noteEditor===session)updateNoteAIControls();}
}
async function undoNoteAI(){
 const session=noteEditor,undo=session?.aiUndo;if(!undo||session.aiBusy)return;
 if(JSON.stringify(readWording($('#note-text')))!==JSON.stringify(undo.after)&&!await confirmNote('Restore the wording from before AI Revise? This will also replace text edits made since that revision.','Restore previous wording'))return;
 if(noteEditor!==session||session.aiUndo!==undo)return;
 Wording.assign(session.draft,Wording.runs(undo.before));setWording('note-text',session.draft);delete session.aiUndo;updateNoteAIControls();noteHint('Previous wording restored. Save the note when ready.');
}
async function openNoteLibrary(){await saveNow();route='fast-notes';currentId=null;render();}
function openFastNote(id=null){
 if(libraryEditor)return;
 if(!id&&noteLibrary().length>=Wording.FAST_NOTE_MAX_COUNT)throw Error('You can save up to 50 fast notes. Delete one before adding another.');
 const existing=id?bankFind(id):null;if(id&&!existing)throw Error('This fast note no longer exists.');
 libraryEditor={id:existing?.id||uid(),existing:!!existing,metadata:clone(existing||{}),background:existing?.background||'white',original:'',busy:false};
 $('#library-dialog').innerHTML=`<header class="note-heading"><h2 id="library-title">${existing?'Edit Fast Note':'Add Fast Note'}</h2>${noteAction('library-close','×','aria-label="Close fast note editor"','quiet')}</header><div class="fast-note-form">${wordingMarkup('library-note-text','Wording',existing||{text:''},'fast-note-word-count')}<p id="fast-note-word-count" class="help fast-note-word-count" role="status" aria-live="polite"></p><fieldset class="bank-backgrounds"><legend>Background color</legend>${Object.entries(Wording.backgrounds).map(([value,name])=>noteAction('library-background','<span aria-hidden="true">✓</span>',`data-color="${value}" aria-label="${name} background" aria-pressed="false" title="${name}"`,'bank-swatch bank-bg-'+value)).join('')}</fieldset></div><footer class="note-footer"><div class="actions">${noteAction('library-close','Cancel')}${noteAction('library-save','Save','','primary')}</div></footer>`;
 mountWording('library-note-text');updateLibraryStyle();libraryEditor.original=JSON.stringify(libraryForm());$('#library-dialog').showModal();$('#library-note-text').focus({preventScroll:true});
}
function libraryForm(){return {...readWording($('#library-note-text')),background:libraryEditor.background};}
function libraryChanged(){return !!libraryEditor&&JSON.stringify(libraryForm())!==libraryEditor.original;}
function updateLibraryStyle(){
 if(!libraryEditor)return;
 $('#library-note-text').dataset.background=libraryEditor.background;
 const words=Wording.wordCount(libraryForm().text),over=words>Wording.FAST_NOTE_MAX_WORDS,counter=$('#fast-note-word-count');
 counter.textContent=`${words} / ${Wording.FAST_NOTE_MAX_WORDS} words${over?' — Shorten this note before saving.':''}`;counter.classList.toggle('error',over);
 $('#library-dialog [data-note-action="library-save"]').disabled=libraryEditor.busy||over;
 $('#library-dialog').querySelectorAll('[data-note-action="library-background"]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.color===libraryEditor.background)));
}
function refreshFastNotes(){if(route==='fast-notes')render();if(noteEditor)renderCommonNotes();}
let fastNotesDeleting=false;
async function deleteLibraryNote(id){
 if(fastNotesDeleting||!id)return;const note=bankFind(id);if(!note)return;
 fastNotesDeleting=true;
 try{
  if(!await confirmNote(`Delete “${fastNoteLabel(note)}”? Wording already copied into reports will stay.`,'Delete fast note'))return;
  state.noteLibrary=noteLibrary().filter(n=>n.id!==id);dirty++;status('Unsaved changes');refreshFastNotes();await saveNow();toast('Fast note deleted.');
 }finally{fastNotesDeleting=false;}
}
async function closeLibrary(){if(libraryEditor?.busy)return;if(libraryChanged()&&!await confirmNote('Discard unsaved fast note changes?'))return;$('#library-dialog').close();libraryEditor=null;if(!inFlight)status(dirty>saved?'Unsaved changes':'✓ Saved locally');}
async function saveLibraryNote(){
 const session=libraryEditor;if(!session||session.busy)return;
 const values=libraryForm();if(!values.text.trim())throw Error('Enter your reusable wording.');
 Wording.validate(values);Wording.validateFastNotes([values]);if(values.text.length>100000)throw Error('The note is too long. Use fewer than 100,000 characters.');
 const item={...session.metadata,id:session.id,title:fastNoteLabel(values),category:session.metadata.category||categories[3],...values};
 if(!values.textRuns)delete item.textRuns;
 if(!noteLibrary().some(n=>n.id===item.id)&&noteLibrary().length>=Wording.FAST_NOTE_MAX_COUNT)throw Error('You can save up to 50 fast notes. Delete one before adding another.');
 session.busy=true;
 try{
  await commitWorkspaceEdit(draft=>{draft.noteLibrary??=[];const index=draft.noteLibrary.findIndex(n=>n.id===item.id);if(index<0)draft.noteLibrary.push(item);else draft.noteLibrary[index]=item;});
  session.original=JSON.stringify(values);session.existing=true;session.metadata=clone(item);refreshFastNotes();
  // Keep later typing/format/color changes in the open editor, ready for Save.
  if(libraryChanged())toast('Fast note saved. Newer edits are still unsaved.');
  else{$('#library-dialog').close();libraryEditor=null;toast('Fast note saved.');}
 }finally{session.busy=false;if(libraryEditor===session)updateLibraryStyle();}
}
document.addEventListener('input',ev=>{
 const el=ev.target;
 if(el.dataset.noteField&&noteEditor){if(el.dataset.noteField==='includeInSummary'){setNoteSummary(el.checked);return;}noteEditor.draft[el.dataset.noteField]=el.type==='checkbox'?el.checked:el.value;noteHint('Draft changed. Save the note to update the report.');}
 if(el.dataset.noteCaption!==undefined&&noteEditor)noteEditor.draft.photos[Number(el.dataset.noteCaption)].caption=el.value;
});
document.addEventListener('change',ev=>{
 if(ev.target.id==='note-photo-file'){addNotePhotos([...ev.target.files]);ev.target.value='';}
});
document.addEventListener('click',async ev=>{
 const b=ev.target.closest('[data-note-action]');if(!b)return;
 const a=b.dataset.noteAction;try{
  if(a==='maximize-window'){const p=noteWindowSettings();p.maximized=!p.maximized;layoutNoteWindow();rememberNoteWindow();}
  if(a==='toggle-note-bank'){const open=$('#note-dialog').classList.toggle('note-bank-open');b.setAttribute('aria-expanded',String(open));}
  if(a==='cancel')await closeNote();
  if(a==='save'){b.disabled=true;await saveNote();}
  if(a==='add-photos')$('#note-photo-file').click();
  if(a==='remove-photo'){endInlinePhoto();const [photo]=noteEditor.draft.photos.splice(Number(b.dataset.index),1);noteEditor.photoDrafts?.delete(photo);renderNotePhotos();}
  if(a==='edit-photo')await editNotePhoto(Number(b.dataset.index),b.dataset.tool);
  if(a==='save-photo')saveNotePhoto(Number(b.dataset.index));
  if(a==='preview-photo'){const ph=noteEditor.draft.photos[Number(b.dataset.index)];modal(`<h2>Photo preview</h2><img class="enlarged-note-photo" src="${e(notePhotoSource(ph))}" alt="${e(ph.caption||'Inspection photograph')}"><p class="help">${e(ph.caption)}</p><div class="actions">${action('close-dialog','Close')}</div>`);}
  if(a==='append-common'){
   const n=bankFind(b.dataset.id),f=noteEditor.draft;if(!n)return;
   insertBankText(f,n,true);
   setWording('note-text',f);noteHint('Wording copied. Adjust it for this property, then save the note.');$('#note-dialog').classList.remove('note-bank-open');$('#note-dialog [data-note-action="toggle-note-bank"]').setAttribute('aria-expanded','false');focusWordingEnd('note-text');
  }
  if(a==='ai'){b.disabled=true;await reviseNote();}
  if(a==='voice')await toggleNoteVoice();
  if(a==='cancel-voice')noteEditor?.voice?.abort('Voice input cancelled. The recording was discarded.');
  if(a==='undo-ai')await undoNoteAI();
  if(a==='library-close')await closeLibrary();
  if(a==='library-background'){libraryEditor.background=b.dataset.color;updateLibraryStyle();}
  if(a==='library-delete-card'){await deleteLibraryNote(b.dataset.id);}
  if(a==='library-move'){b.disabled=true;const index=noteLibrary().findIndex(n=>n.id===b.dataset.id),delta=Number(b.dataset.delta);if(index>=0)await moveFastNote(b.dataset.id,index+delta,delta<0?'up':'down');}
  if(a==='library-new'||a==='library-edit')openFastNote(a==='library-edit'?b.dataset.id:null);
  if(a==='library-save'){b.disabled=true;await saveLibraryNote();}
  if(a==='library-save-all'){b.disabled=true;await saveNow();toast('Fast notes saved.');}
 }catch(err){toast(err.message,true);}finally{if(b.isConnected&&!(a==='edit-photo'&&b.dataset.tool==='undo'))b.disabled=false;if(libraryEditor)updateLibraryStyle();}
});
$('#note-dialog').addEventListener('cancel',ev=>{ev.preventDefault();closeNote();});
$('#note-dialog').addEventListener('close',()=>{if(!$('#note-dialog').open){noteEditor?.voice?.dispose();disposeWording('note-text');}});
$('#library-dialog').addEventListener('close',()=>{if(!$('#library-dialog').open)disposeWording('library-note-text');});
document.addEventListener('visibilitychange',()=>{if(document.hidden)noteEditor?.voice?.abort('Voice input stopped because the app is no longer visible.');});
window.addEventListener('pagehide',()=>{noteVoiceConsent?.enter(null);noteEditor?.voice?.dispose();});
$('#library-dialog').addEventListener('cancel',ev=>{ev.preventDefault();closeLibrary();});
$('#note-dialog').addEventListener('paste',ev=>{if($('#library-dialog').open||$('#dialog').open)return;const files=[...ev.clipboardData.items].filter(i=>i.kind==='file'&&i.type.startsWith('image/')).map(i=>i.getAsFile()).filter(Boolean);if(files.length){ev.preventDefault();addNotePhotos(files);}});
// Internal photo drags reorder only; they must never enter the external-file import path.
$('#note-dialog').addEventListener('dragstart',ev=>{
 const surface=ev.target.closest('[data-note-photo-drag]');if(!surface)return;
 if(!noteEditor||noteEditor.busy||surface.classList.contains('photo-inline-active')){ev.preventDefault();return;}
 const index=Number(surface.dataset.notePhotoDrag);noteEditor.photoDrag=noteEditor.draft.photos[index];ev.dataTransfer.clearData();ev.dataTransfer.setData('application/x-soloinspect-note-photo',String(index));ev.dataTransfer.effectAllowed='move';surface.classList.add('photo-dragging');
});
function clearNotePhotoDrag(){if(noteEditor)noteEditor.photoDrag=null;$('#note-dialog').querySelectorAll('.photo-dragging,.photo-drop-target').forEach(el=>el.classList.remove('photo-dragging','photo-drop-target'));}
$('#note-dialog').addEventListener('dragover',ev=>{
 if(noteEditor?.photoDrag){ev.preventDefault();ev.dataTransfer.dropEffect='move';const target=ev.target.closest('[data-note-photo]');$('#note-dialog').querySelectorAll('.photo-drop-target').forEach(el=>el.classList.remove('photo-drop-target'));target?.classList.add('photo-drop-target');return;}
 if(ev.dataTransfer.types.includes('Files'))ev.preventDefault();
});
$('#note-dialog').addEventListener('drop',ev=>{
 if(noteEditor?.photoDrag||ev.dataTransfer.types.includes('application/x-soloinspect-note-photo')){
  ev.preventDefault();ev.stopPropagation();const target=ev.target.closest('[data-note-photo]'),from=noteEditor?.draft.photos.indexOf(noteEditor.photoDrag);clearNotePhotoDrag();if(target)reorderNotePhoto(from,Number(target.dataset.notePhoto));return;
 }
 if(ev.dataTransfer.files.length){ev.preventDefault();addNotePhotos([...ev.dataTransfer.files]);}
});
$('#note-dialog').addEventListener('dragend',clearNotePhotoDrag);
$('#note-dialog').addEventListener('keydown',ev=>{const surface=ev.target.closest('[data-note-photo-drag]');if(!surface||!ev.altKey||!['ArrowLeft','ArrowRight'].includes(ev.key))return;ev.preventDefault();const index=Number(surface.dataset.notePhotoDrag);reorderNotePhoto(index,index+(ev.key==='ArrowLeft'?-1:1));});
window.addEventListener('beforeunload',ev=>{if(noteChanged()||libraryChanged()){ev.preventDefault();ev.returnValue='';}});
