(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.Hosting=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 let data={configured:false,enabled:false,endpoint:'',publications:[]},ready=false,options;
 const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const publication=id=>data.publications.filter(p=>p.reportId===id&&p.status!=='unpublished').sort((a,b)=>b.created.localeCompare(a.created))[0];
 const action=(name,label,id='')=>'<button type="button" class="small quiet" data-hosting-action="'+name+'" data-publication="'+escape(id)+'">'+label+'</button>';
 const text=status=>({published:'Published',unpublished:'Terminated',publishing:'Publication not yet verified',terminating:'Termination not yet verified',uncertain:'Cloud status unknown'}[status]||'Cloud status unknown');
 async function load(){
   if(!options)return;
   try{data=await options.api('/api/hosting');ready=true;}catch{ready=false;}
 }
 function button(reportId){
   const p=publication(reportId);
   return typeof WebPublishing==='undefined'?'':WebPublishing.button(reportId,{status:p?'published':'unpublished'});
 }
 function info(reportId){
   const p=publication(reportId);if(!p)return '';
   return '<div class="hosting-report-info"><span class="'+(p.status==='published'?'':'hosting-warning')+'">'+text(p.status)+'</span> '+action('check','Check status',p.id)+(p.status==='published'&&p.url?action('copy-link','Copy link',p.id)+'<a href="'+escape(p.url)+'" target="_blank" rel="noreferrer noopener">Open web report ↗</a>':'')+'</div>';
 }
 function history(){
   const rows=data.publications.filter(p=>p.status!=='unpublished'||p.cleaned===false);
   return rows.length?'<div class="hosting-history">'+rows.map(p=>'<div class="hosting-history-row"><div><b>'+escape(p.label)+'</b><br><span class="help">'+text(p.status)+(p.cleaned===false&&p.status==='unpublished'?' · File cleanup pending':'')+'</span></div><div class="actions">'+action('check','Check status',p.id)+action('terminate',p.status==='unpublished'?'Retry cleanup':'Terminate Web Hosting',p.id)+(p.status==='published'?action('copy-link','Copy link',p.id):'')+'</div></div>').join('')+'</div>':'<p class="help">No active web publications are recorded on this computer.</p>';
 }
 function connectionStatus(){
   const saved=ready&&data.configured;
   return {className:'api-key-status'+(saved?' is-saved':''),html:'<strong>'+(saved?'<span aria-hidden="true">✓</span> Connection Saved':ready?'Not connected':'Backend update required')+'</strong>'};
 }
 function settings(){
   const status=connectionStatus();
   return '<div class="card" id="hosting-settings"><div class="card-title api-settings-heading"><h2>Publish a web report</h2><div id="hosting-connection-status" class="'+status.className+'" role="status" aria-live="polite">'+status.html+'</div></div>'+
   '<p class="help">Publish through your own Cloudflare Worker and private R2 storage. Share the link with your client; anyone with that link can read the report. Slide left in Report Library to terminate. No automatic expiration.</p>'+
   '<div class="grid"><label class="field full"><span>Worker address</span><input id="hosting-endpoint" type="url" autocomplete="off" placeholder="https://your-worker.your-account.workers.dev" value="'+escape(data.endpoint)+'"></label>'+
   '<label class="field full"><span>Publishing key · Leave blank to keep the saved key</span><input id="hosting-key" type="password" autocomplete="new-password" placeholder="HOMEKANBAN_PUBLISH_KEY from your Worker" maxlength="64"></label></div>'+
   '<div class="actions">'+action('generate-key','Generate key')+action('copy-key','Copy entered key')+action('copy-worker','Copy Worker code')+'</div>'+
   '<p class="help">One-time setup: copy the Worker code into Cloudflare, keep the REPORTS R2 binding, and add the generated key as a Secret named HOMEKANBAN_PUBLISH_KEY. Save the same key here. This is a dedicated publishing key, not your Cloudflare account API token.</p>'+
   '<label class="hosting-enable"><input id="hosting-enabled" type="checkbox" '+(data.enabled?'checked':'')+'> Allow report uploads</label>'+
   '<p class="help">Turning uploads off does not remove reports already online. Termination and connection checks remain available. Keys are encrypted for your Windows account and excluded from report backups.</p>'+
   '<div class="actions">'+action('save','Save hosting settings')+action('test','Test connection')+action('remove-key','Remove saved key')+'</div>'+
   '<p id="hosting-message" class="help" role="status">'+(ready?(data.hasKey?'Publishing key is saved.':'Save your connection before publishing.'):'Save your work and install the hosting backend update to enable this section.')+'</p>'+
   '<details class="hosting-details"><summary>Manage web publications & recovery</summary><p class="help">These controls also cover reports removed locally or restored from an older backup. Cloud report links are independent of local report backups. Reconnect to the same Worker and key, then use Recover web links after changing computers.</p>'+
   action('recover','Recover web links')+'<div id="hosting-history">'+history()+'</div><p class="help">Terminating blocks new requests; it cannot recall screenshots or downloaded copies. Local edits do not automatically update a published report. Terminate, then publish again to issue a new link.</p></details></div>';
 }
 function refreshHistory(){
   const box=document.querySelector('#hosting-history');if(box)box.innerHTML=history();
   options.onChange?.();
 }
 async function request(reportId,published){
   if(!ready)throw Error('The hosting backend is not ready. Save your work and install the update first.');
   if(!data.configured)throw Error('Connect your Worker in AI & settings → Publish a web report first.');
   const p=publication(reportId);
   try{
     if(published){
       if(!data.enabled)throw Error('Enable Allow report uploads in AI & settings → Publish a web report first.');
       await options.saveNow();
       const result=await options.api('/api/hosting/reports/'+encodeURIComponent(reportId)+'/publish','POST',{revision:options.revision()});
       options.toast('Published. Use Copy link to share this report.');
       return {status:result.status};
     }
     if(!p)throw Error('No publication is recorded. Use Recover web links in AI & settings if needed.');
     const result=await options.api('/api/hosting/publications/'+p.id+'/terminate','POST',{});
     options.toast(result.cleaned?'Web report terminated.':'Access terminated. File cleanup is pending; retry cleanup in AI & settings.');
     return {status:result.status};
   }finally{await load();refreshHistory();}
 }
 async function copy(value){
   if(!value)throw Error('There is nothing to copy.');
   if(!navigator.clipboard?.writeText)throw Error('Clipboard access is unavailable. Open HomeKanban in Chrome or Edge and try again.');
   await navigator.clipboard.writeText(value);
 }
 function bind(config){
   options=config;
   document.addEventListener('click',async event=>{
     const button=event.target.closest?.('[data-hosting-action]');if(!button)return;
     event.preventDefault();if(button.disabled)return;button.disabled=true;
     const name=button.dataset.hostingAction,id=button.dataset.publication;
     const message=value=>{const el=document.querySelector('#hosting-message');if(el)el.textContent=value;};
     try{
       if(!ready)throw Error('Install the hosting backend update before using this feature.');
       if(name==='generate-key'){
         const value=await options.api('/api/hosting/new-key','POST',{});document.querySelector('#hosting-key').value=value.key;
         message('New key generated, not saved yet. Copy it to a Cloudflare Secret named HOMEKANBAN_PUBLISH_KEY, then save these settings.');
       }
       if(name==='copy-key'){await copy(document.querySelector('#hosting-key').value);message('Key copied. Paste it only into the Worker Secret; do not share it in chat or a report.');}
       if(name==='copy-worker'){const response=await options.api('/api/hosting/worker');await copy(await response.text());message('Worker code copied. Paste it into Cloudflare Edit code, then Deploy.');}
       if(name==='save'||name==='remove-key'){
         data=await options.api('/api/hosting/settings','PUT',{endpoint:document.querySelector('#hosting-endpoint').value.trim(),key:name==='save'?document.querySelector('#hosting-key').value.trim():'',enabled:name==='save'&&document.querySelector('#hosting-enabled').checked,clearKey:name==='remove-key'});
         document.querySelector('#hosting-key').value='';document.querySelector('#hosting-enabled').checked=data.enabled;
         const badge=document.querySelector('#hosting-connection-status'),status=connectionStatus();
         badge.className=status.className;badge.innerHTML=status.html;
         message('Hosting settings saved. '+(data.hasKey?'Key encrypted locally.':'No publishing key saved.'));
       }
       if(name==='test'){message('Checking your Worker and R2 connection…');const result=await options.api('/api/hosting/connection','POST',{});message(result.message);}
       if(name==='check'){
         message('Checking publication status…');
         const result=await options.api('/api/hosting/publications/'+id+'/check','POST',{});
         const verified=result?.status==='published'||result?.status==='unpublished';
         const feedback=result?.status==='published'?'Report is published.':result?.status==='unpublished'?'Web hosting is terminated.'+(result.cleaned===false?' File cleanup is pending; use Retry cleanup in AI & settings.':''):'Unable to verify status. The publication may be incomplete or missing. Check again, or terminate this publication before publishing again.';
         await load();refreshHistory();message(feedback);options.toast(feedback,!verified);
       }
       if(name==='terminate'){const result=await options.api('/api/hosting/publications/'+id+'/terminate','POST',{});await load();refreshHistory();options.toast(result.cleaned?'Web report terminated.':'Access terminated. File cleanup is pending; use Retry cleanup.');}
       if(name==='copy-link'){const p=data.publications.find(p=>p.id===id&&p.status==='published');await copy(p?.url);options.toast('Report link copied.');}
       if(name==='recover'){
         let cursor;const seen=new Set();message('Recovering web publication records…');
         do{const result=await options.api('/api/hosting/recover','POST',{...(cursor?{cursor}:{})});data=result;cursor=result.cursor;refreshHistory();if(cursor&&seen.has(cursor))throw Error('Recovery stopped because the Worker repeated a page. Check its deployment and try again.');if(cursor)seen.add(cursor);}while(cursor);
         message('Web links recovered. Review them below; no local reports were changed.');
       }
     }catch(error){const feedback=name==='check'?'Unable to verify status. '+error.message:error.message;message(feedback);options.toast(feedback,true);if(['check','terminate','recover'].includes(name)){await load();refreshHistory();}}
     finally{if(button.isConnected)button.disabled=false;}
   });
 }
 return Object.freeze({bind,load,button,info,settings,request});
});
