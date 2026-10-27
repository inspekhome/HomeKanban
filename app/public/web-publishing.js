(function(root,factory){
 const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.WebPublishing=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 // Isolated presentation/interaction only: no network access or workspace mutation.
 // onRequest must return a confirmed publication status before the switch changes.
 const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const label=published=>published?'Terminate Web Hosting':'Export to Web Hosting';
 const hint=published=>published?'Slide the circle left to terminate web hosting.':'Slide the circle right to publish this report.';
 const arrows='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 6 6 6-6 6m7-12 6 6-6 6"/></svg>';
 function button(reportId,publication={}){
  const published=publication.status==='published';
  return `<div class="web-hosting-control"><button type="button" role="switch" aria-checked="${published}" aria-label="${label(published)}" class="web-hosting-button web-hosting-slider ${published?'is-published':'is-unpublished'}" data-web-hosting-slider data-id="${escape(reportId)}" title="${hint(published)} Keyboard: Right/Left arrows, Space or Enter."><span class="web-hosting-thumb" aria-hidden="true">${arrows}</span><span class="web-hosting-label" aria-hidden="true">${label(published)}</span></button></div>`;
 }
 function bind(root,{onRequest,onError=()=>{},onHint=()=>{}}={}){
  const busy=new WeakSet(),suppressClick=new WeakSet(),listeners=[];let drag=null,disposed=false;
  const find=event=>event.target?.closest?.('[data-web-hosting-slider]');
  const isPublished=button=>button.getAttribute('aria-checked')==='true';
  const on=(name,fn,capture=false)=>{root.addEventListener(name,fn,capture);listeners.push([name,fn,capture]);};
  function reset(button){button.style.removeProperty('--hosting-offset');button.classList.remove('is-dragging');}
  function setState(button,published){
   button.classList.toggle('is-published',published);button.classList.toggle('is-unpublished',!published);
   button.setAttribute('aria-checked',String(published));button.setAttribute('aria-label',label(published));
   button.setAttribute('title',hint(published)+' Keyboard: Right/Left arrows, Space or Enter.');
   button.querySelector('.web-hosting-label').textContent=label(published);
  }
  async function request(button,published){
   if(disposed||!button.isConnected||busy.has(button)||button.disabled||published===isPublished(button))return;
   const previous=isPublished(button);busy.add(button);button.disabled=true;button.setAttribute('aria-busy','true');
   button.querySelector('.web-hosting-label').textContent=published?'Publishing…':'Terminating…';
   try{
    if(typeof onRequest!=='function')throw Error('Cloudflare is not connected yet. No report was uploaded or taken offline.');
    const result=await onRequest(button.dataset.id,published);
    if(result?.status!==(published?'published':'unpublished'))throw Error('Web hosting did not confirm the change. The previous status has been kept.');
    if(!disposed&&button.isConnected)setState(button,published);
   }catch(error){if(!disposed&&button.isConnected)setState(button,previous);if(!disposed)onError(error instanceof Error?error.message:String(error));}
   finally{reset(button);busy.delete(button);button.disabled=false;button.removeAttribute('aria-busy');}
  }
  function finish(cancel=false){
   if(!drag)return;const current=drag;drag=null;
   const {button,pointerId,offset,travel,published}=current;suppressClick.add(button);
   button.classList.remove('is-dragging');
   if(button.hasPointerCapture?.(pointerId))button.releasePointerCapture(pointerId);
   if(!cancel&&button.isConnected&&Math.abs(offset)>=travel*.9)void request(button,!published);
   else {reset(button);if(!cancel&&Math.abs(offset)<3)onHint(hint(published));}
  }
  on('pointerdown',event=>{
   const button=find(event);if(!button||!event.target.closest?.('.web-hosting-thumb')||event.button!==0||event.isPrimary===false||busy.has(button)||button.disabled||drag)return;
   const thumb=button.querySelector('.web-hosting-thumb'),travel=button.clientWidth-thumb.offsetWidth-8;if(travel<=0)return;
   event.preventDefault();button.focus({preventScroll:true});suppressClick.delete(button);
   drag={button,pointerId:event.pointerId,startX:event.clientX,travel,offset:0,published:isPublished(button)};
   button.classList.add('is-dragging');button.setPointerCapture(event.pointerId);
  });
  on('pointermove',event=>{
   if(!drag||event.pointerId!==drag.pointerId)return;if(!drag.button.isConnected){finish(true);return;}
   const movement=event.clientX-drag.startX;drag.offset=drag.published?Math.max(-drag.travel,Math.min(0,movement)):Math.min(drag.travel,Math.max(0,movement));
   drag.button.style.setProperty('--hosting-offset',drag.offset+'px');event.preventDefault();
  });
  on('pointerup',event=>{if(drag&&event.pointerId===drag.pointerId){event.preventDefault();finish();}});
  on('pointercancel',event=>{if(drag&&event.pointerId===drag.pointerId)finish(true);});
  on('lostpointercapture',event=>{if(drag&&event.pointerId===drag.pointerId)finish(true);});
  on('keydown',event=>{
   if(event.key==='Escape'&&drag){event.preventDefault();finish(true);return;}
   const button=find(event);if(!button||!['ArrowRight','ArrowLeft',' ','Enter'].includes(event.key))return;
   event.preventDefault();suppressClick.add(button);if(event.repeat||drag)return;
   const published=event.key==='ArrowRight'?true:event.key==='ArrowLeft'?false:!isPublished(button);void request(button,published);
  });
  on('click',event=>{
   const button=find(event);if(!button)return;event.preventDefault();event.stopPropagation();
   if(suppressClick.has(button)){suppressClick.delete(button);return;}
   if(event.detail===0)void request(button,!isPublished(button));else onHint(hint(isPublished(button)));
  },true);
  const blur=()=>finish(true);root.defaultView?.addEventListener('blur',blur);
  return ()=>{disposed=true;finish(true);for(const [name,fn,capture] of listeners)root.removeEventListener(name,fn,capture);root.defaultView?.removeEventListener('blur',blur);};
 }
 return Object.freeze({button,bind});
});
