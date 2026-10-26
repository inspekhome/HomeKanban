'use strict';
const $=s=>document.querySelector(s), uid=()=>crypto.randomUUID(), clone=x=>structuredClone(x);
const e=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const token=$('meta[name=solo-token]').content;
let supportedTextColors=['#243746','#b42318','#245c99','#226b43','#743a91','#9a4b08'];
let state,revision,categories,ratings,dataDir,route='reports',currentId=null,sectionId=null,dirty=0,saved=0,saveTimer,inFlight=null,photoTarget=null,aiTarget=null,search='';
async function api(url,method='GET',data){if(url==='/api/state'&&method==='PUT')Wording.validateFastNotes(data?.state?.noteLibrary);if(url==='/api/restore'&&method==='POST')Wording.validateFastNotes(data?.backup?.state?.noteLibrary);const r=await fetch(url,{method,headers:{'X-Solo-Token':token,...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined});if(!r.ok){let body;try{body=await r.json();}catch{}throw Error(body?.error||`Request failed (${r.status})`);}return r.headers.get('content-type')?.includes('application/json')?r.json():r;}
function toast(message,error=false){const t=$('#toast');t.textContent=message;t.style.background=error?'#913f36':'#234f73';t.style.display='block';clearTimeout(t.timer);t.timer=setTimeout(()=>t.style.display='none',6000);}
function status(text,error=false){$('#save-status').textContent=text;$('#save-status').classList.toggle('error',error);}
function changed(){dirty++;if(route==='editor'){const r=report();r.status='draft';r.updated=new Date().toISOString();const review=$('#review-results');if(review)review.hidden=true;}status('Unsaved changes');clearTimeout(saveTimer);saveTimer=setTimeout(()=>saveNow().catch(err=>toast(err.message,true)),700);}
async function saveNow(){clearTimeout(saveTimer);if(inFlight){await inFlight;return dirty>saved?saveNow():undefined;}if(dirty<=saved)return;inFlight=(async()=>{while(saved<dirty){const generation=dirty;status('Saving locally…');const result=await api('/api/state','PUT',{state:clone(state),revision});revision=result.revision;saved=generation;}status('✓ Saved locally');})().catch(err=>{status('Save failed · Please retry',true);throw err;}).finally(()=>{inFlight=null;});return inFlight;}
window.addEventListener('beforeunload',ev=>{if(dirty>saved){ev.preventDefault();ev.returnValue='';}});
const field=(label,key,value,{type='text',full=false,scope='report',textarea=false}={})=>`<label class="field ${full?'full':''}"><span>${e(label)}</span>${textarea?`<textarea id="${e(scope)}-field-${e(key)}" data-field="${e(key)}" data-scope="${scope}">${e(value)}</textarea>`:`<input id="${e(scope)}-field-${e(key)}" type="${type}" data-field="${e(key)}" data-scope="${scope}" value="${e(value)}">`}</label>`;
const head=(label,title,sub,actions='')=>`<div class="page-head"><div><div class="eyebrow">${label}</div><h1>${title}</h1><p class="sub">${sub}</p></div><div class="actions">${actions}</div></div>`;
const action=(name,label,extra='',cls='')=>`<button data-action="${name}" ${extra} class="${cls}">${label}</button>`;
const report=()=>state.reports.find(r=>r.id===currentId), template=()=>state.templates.find(t=>t.id===currentId);
// Appearance belongs to the workspace, not the inspector snapshot in a report.
const systemThemes=[
 {id:'blue-gray',name:'Blue Gray',description:'Classic blue & slate'},
 {id:'indigo',name:'Indigo',description:'Cool blue & soft periwinkle'},
 {id:'sage',name:'Sage',description:'Soft green & warm neutrals'},
 {id:'peach',name:'Peach',description:'Warm cream & muted coral'},
 {id:'lavender',name:'Lavender',description:'Soft violet & dusty rose'},
 {id:'black-gray',name:'Black & Gray',description:'Charcoal black & soft gray'}
];
function currentSystemTheme(){const id=state?.preferences?.theme;return systemThemes.some(t=>t.id===id)?id:'blue-gray';}
function applySystemTheme(){document.documentElement.dataset.theme=currentSystemTheme();}
function renderSystemThemes(){
 const current=currentSystemTheme();
 return `<section class="card system-themes" aria-labelledby="system-themes-title"><div class="card-title"><div><h2 id="system-themes-title">System Themes</h2><p class="help">Choose the colors for your workspace. Your choice is saved automatically.</p></div></div><div class="theme-options" role="group" aria-label="System themes">${systemThemes.map(t=>`<button type="button" class="theme-choice" data-theme-choice="${t.id}" aria-label="${t.name} theme" aria-pressed="${t.id===current}"><span class="theme-miniature" aria-hidden="true"><span class="theme-mini-sidebar"><i></i><i></i><i></i></span><span class="theme-mini-main"><span class="theme-mini-title"></span><span class="theme-mini-stats"><i></i><i></i><i></i></span><span class="theme-mini-chart"><svg viewBox="0 0 120 32" fill="none"><path d="M0 26 20 16 39 21 62 7 82 14 101 8 120 3" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></span></span></span><span class="theme-choice-title"><strong>${t.name}</strong><span class="theme-choice-check" aria-hidden="true">✓</span></span><span class="theme-description">${t.description}</span></button>`).join('')}</div><p id="theme-status" class="help theme-status" role="status" aria-live="polite">Current theme: ${systemThemes.find(t=>t.id===current).name}</p><p class="help">Themes change the workspace colors. Report exports, inspection status colors, and your Fast notes formatting stay the same.</p></section>`;
}
async function selectSystemTheme(id){
 const selected=systemThemes.find(t=>t.id===id);if(!selected)return;
 if(currentSystemTheme()===id)return;
 state.preferences={...(state.preferences&&typeof state.preferences==='object'&&!Array.isArray(state.preferences)?state.preferences:{}),theme:id};
 applySystemTheme();
 document.querySelectorAll('[data-theme-choice]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.themeChoice===id)));
 const message=$('#theme-status');if(message)message.textContent=`Applying ${selected.name}…`;
 changed();
 try{await saveNow();if(currentSystemTheme()===id&&message?.isConnected)message.textContent=`${selected.name} theme saved.`;}
 catch(error){if(currentSystemTheme()===id&&message?.isConnected)message.textContent=`${selected.name} applied. Saving failed; use Save profile to retry.`;throw error;}
}
const progress=r=>{const items=r.sections.flatMap(s=>s.items);return items.length?Math.round(items.filter(i=>i.rating).length/items.length*100):0;};
function modal(html){$('#dialog-content').innerHTML=html;$('#dialog').showModal();}
function closeModal(){$('#dialog').close();}
function render(){
 if(typeof ReportPhotos!=='undefined')ReportPhotos.closeWithin($('#main'));
 $('#nav').querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.nav===(route==='editor'?'reports':route==='template-editor'?'templates':route)));
 $('#breadcrumb').textContent=({reports:'Reports','fast-notes':'Fast notes',templates:'Templates',profile:'User info',settings:'AI & settings',editor:'Report editor', 'template-editor':'Template editor'})[route];$('#avatar').textContent=state.profile.name.trim().slice(0,2).toUpperCase()||'HI';
 const views={reports:renderReports,'fast-notes':renderFastNotes,templates:renderTemplates,profile:renderProfile,settings:renderSettings,editor:renderEditor,'template-editor':renderTemplate};
 $('#main').innerHTML=views[route]();$('#main').classList.toggle('report-editor',route==='editor');if(route==='settings')loadSettings();
}
function renderReports(){const reports=state.reports.filter(r=>(r.address+' '+r.client).toLowerCase().includes(search.toLowerCase())).sort((a,b)=>(b.updated||'').localeCompare(a.updated||''));return head('LOCAL-FIRST INSPECTION','Clear findings. Confident reports.','Your entire inspection workflow, from field notes to a finished report.',action('backup','Back up data')+action('new-report','＋ Create report','','primary'))+(!state.profile.name?`<div class="welcome"><div><h2>Your independent inspection workspace</h2><p>Add your inspector details, choose a template, and start your first report.</p><div class="actions" style="margin-top:16px">${action('go-profile','Set up your profile')}${action('demo','Create demo report','','quiet')}</div></div><div class="welcome-mark">⌂</div></div>`:'')+`<div class="stats"><div class="stat"><div class="label">TOTAL REPORTS</div><strong>${state.reports.length.toString().padStart(2,'0')}</strong><span>Stored on this computer</span></div><div class="stat"><div class="label">IN PROGRESS</div><strong>${state.reports.filter(r=>r.status==='draft').length.toString().padStart(2,'0')}</strong><span>Ready to pick up where you left off</span></div><div class="stat"><div class="label">FINALIZED</div><strong>${state.reports.filter(r=>r.status==='final').length.toString().padStart(2,'0')}</strong><span>Completeness checks passed</span></div></div><div class="card"><div class="card-title"><h2>Report library</h2><input class="search" id="report-search" placeholder="Search property or client…" value="${e(search)}"></div>${reports.length?`<div class="table-wrap"><table class="table library-table"><thead><tr><th>PROPERTY</th><th>CLIENT</th><th>DATE</th><th>STATUS</th><th>ACTIONS</th></tr></thead><tbody>${reports.map(r=>`<tr data-report-id="${r.id}"><td data-label="Property"><b class="address">${e(r.address||'Address not entered')}</b><span class="muted tiny">${r.isDemo?'Demo · ':''}${r.sections.length} sections · ${r.findings.length} ${r.findings.length===1?'finding':'findings'}</span></td><td data-label="Client">${e(r.client||'Not entered')}</td><td data-label="Date">${e(r.date)}</td><td data-label="Status"><span class="badge ${r.status==='final'?'final':''}">${r.status==='final'?'Finalized':'In progress'}</span><div class="progress"><div style="width:${progress(r)}%"></div></div><span class="tiny muted">${progress(r)}% recorded</span></td><td class="library-actions-cell"><div class="actions library-actions" role="group" aria-label="Actions for ${e(r.address||'this report')}">${action('open-report','Open',`data-id="${r.id}"`,'small')}${action('preview','PDF Preview',`data-id="${r.id}" title="Open the printable report preview"`,'small')}${action('pdf','Export PDF',`data-id="${r.id}" title="Download this report as a PDF"`,'small')}${action('html','Export to Web Hosting',`data-id="${r.id}" title="Download index.html for upload to your web host"`,'small')}${action('duplicate-report','Copy',`data-id="${r.id}"`,'small quiet')}${action('delete-report','Delete',`data-id="${r.id}"`,'small quiet danger')}</div></td></tr>`).join('')}</tbody></table></div>`:`<div class="empty"><div class="empty-icon">▤</div><h2>${search?'No matching reports':'Your first report starts here'}</h2><p>Start with a reusable template. Complete the checklist, add findings and photos, then export a PDF or web report.</p>${action('new-report','＋ Create report','','primary')}</div>`}</div><p class="help">PDF Preview opens the printable report. Export to Web Hosting downloads an index.html file with embedded photos, ready to upload to your web host. Exporting does not publish the report.</p><p class="help">Saved locally. No online sign-in required. Keep a regular backup on a separate drive.</p>`;}
function renderTemplates(){return head('YOUR INSPECTION SYSTEM','Your experience, built into every inspection.','Customize your scope, limitations, sections, and components. Template changes apply to new reports.')+`<div class="grid">${state.templates.map(t=>`<div class="card template-card"><div class="template-art">▦ &nbsp; ${t.sections.length.toString().padStart(2,'0')}</div><h2>${e(t.name)}</h2><p class="help">${t.sections.length} sections · ${t.sections.reduce((n,s)=>n+s.items.length,0)} components<br>Reusable template · Fully editable</p><div class="actions">${action('open-template','Edit template',`data-id="${t.id}"`,'primary')}${action('duplicate-template','Duplicate',`data-id="${t.id}"`)}${action('delete-template','Delete',`data-id="${t.id}"`,'quiet danger')}</div></div>`).join('')}</div><div class="callout">Templates provide your scope, limitations, report notice, and checklist structure. Inspection statuses and findings start blank for each property.</div>`;}
function renderProfile(){const p=state.profile;return head('ONE INSPECTOR · ONE WORKSPACE','Your name. Your business. Your report.','One inspector profile for your independent business.',action('save','Save profile','','primary'))+`<div class="card"><div class="card-title"><h2>Inspector & business details</h2></div><div class="grid">${field('Inspector name','name',p.name,{scope:'profile'})}${field('Business name','business',p.business,{scope:'profile'})}${field('License number','license',p.license,{scope:'profile'})}${field('Email','email',p.email,{scope:'profile',type:'email'})}${field('Phone','phone',p.phone,{scope:'profile'})}${field('Website','website',p.website,{scope:'profile'})}${field('Business address','address',p.address,{scope:'profile',full:true})}</div></div><div class="card"><div class="card-title"><h2>Report logo</h2></div>${p.logo?`<img class="logo-preview" src="${e(p.logo)}" alt="Business logo">`:''}<div class="actions">${action('upload-logo','Choose logo')}${action('remove-logo','Remove logo','','quiet')}</div><p class="help">JPG, PNG, and WebP supported. Each report keeps a snapshot of your profile at creation. Update an existing report explicitly when needed.</p></div>`+renderSystemThemes();}
function renderSettings(){return head('WRITING ASSISTANT','Your judgment. A little help with the words.','Connect only when you send a note. Review every draft before adding it to your report.')+`<div class="callout">Only the selected finding text is sent to your AI provider. The full report, contact fields, and photos stay local. API charges may apply. Review the draft before using it.</div><div class="card"><div class="card-title"><h2>AI provider · OpenAI-compatible</h2><span class="badge" id="key-status">Loading…</span></div><div class="grid"><label class="field full"><span>Full HTTPS endpoint</span><input id="api-endpoint" placeholder="https://api.openai.com/v1/chat/completions"></label><label class="field"><span>Model ID</span><input id="api-model" placeholder="Enter a model ID supported by your provider"></label><label class="field"><span>API key · Leave blank to keep the saved key</span><input id="api-key" type="password" autocomplete="new-password" placeholder="Encrypted locally for your Windows account"></label></div><div class="actions" style="margin-top:22px">${action('save-api','Save API settings','','primary')}${action('clear-key','Remove saved key','','quiet danger')}</div><p class="help">Uses the Chat Completions protocol. Your key is encrypted for your Windows account and excluded from reports and backups. Enter a new key when changing providers.</p></div><div class="card"><div class="card-title"><h2>Local data & backups</h2></div><p class="help code">${e(dataDir)}</p><div class="actions">${action('save','Save now')}${action('backup','Export backup')}${action('restore','Restore backup')}</div><p class="help">Backups include your profile, templates, reports, and photos, but no API key. A recovery snapshot is retained before every save. Snapshots are not automatically removed in this version.</p></div><div class="card"><h2>Publish a web report</h2><p class="help">In Reports, use Export to Web Hosting beside the report to download index.html, then upload it to a static host such as Cloudflare Pages. Publishing requires internet access and your own hosting account. The file includes the report and photos. Public hosting does not include password protection by default.</p><a href="https://developers.cloudflare.com/pages/get-started/direct-upload/" target="_blank" rel="noreferrer">Read the Cloudflare upload guide ↗</a></div>`;}
async function loadSettings(){try{const s=await api('/api/settings');if(route!=='settings')return;$('#api-endpoint').value=s.endpoint;$('#api-model').value=s.model;$('#key-status').textContent=s.hasKey?'Key encrypted & saved':'No key configured';}catch(err){toast(err.message,true);}}
function findingComponent(r,f){const section=r.sections.find(s=>s.id===f.sectionId),item=section?.items.find(i=>i.id===f.itemId);return item?{section,item}:null;}
function reportItem(id){return report().sections.flatMap(s=>s.items).find(i=>i.id===id);}
function toggleSectionRating(id,rating){
 if(route!=='editor'||!Object.hasOwn(ratings,rating))return false;
 const section=report()?.sections.find(s=>s.id===id);
 if(!section?.items.length)return false;
 const nextRating=section.items.every(i=>i.rating===rating)?'':rating;
 for(const item of section.items)item.rating=nextRating;
 changed();return true;
}
function renderSectionRatings(s,si){
 return `<div class="status-columns" role="group" aria-label="Set or clear status for all components in ${e(s.name)}">${Object.entries(ratings).map(([k,v])=>{const all=s.items.length>0&&s.items.every(i=>i.rating===k),label=`${s.name}: ${all?'clear all':'set all to'} ${k} = ${v}${all?' selections':''}`;return `<button type="button" class="section-rating ${k} ${all?'active':''}" id="section-rating-${si}-${k}" data-section-rating="${k}" data-section-id="${e(s.id)}" title="${e(label)}" aria-label="${e(label)}" aria-pressed="${all}" ${s.items.length?'':'disabled'}>${k}</button>`;}).join('')}</div>`;
}
function findingNumber(r,f){return String(r.findings.indexOf(f)+1).padStart(2,'0');}
function findingContext(r,f){if(f.origin==='summary')return 'Summary note';const ref=findingComponent(r,f);return ref?`${ref.section.name} / ${ref.item.name}`:'Other observations';}
function summaryFindings(r){return r.findings.filter(f=>f.includeInSummary!==false);}
function summaryPlainText(r){
 const findings=summaryFindings(r);
 return categories.filter(cat=>findings.some(f=>f.category===cat)).map(cat=>`${cat}\n\n${findings.filter(f=>f.category===cat).map((f,index)=>`${index+1}. ${f.text.trim()}`).join('\n\n')}`).join('\n\n');
}
async function copySummary(){
 if(route!=='editor'||!report())return;
 const text=summaryPlainText(report());
 if(!text){toast('No summary text to copy yet.');return;}
 try{await navigator.clipboard.writeText(text);toast('Summary text copied.');return;}catch{}
 // Older embedded browsers may not expose the Clipboard API.
 const previous=document.activeElement,field=document.createElement('textarea');
 field.value=text;field.readOnly=true;field.style.cssText='position:fixed;left:0;top:0;width:1px;height:1px;opacity:0';
 document.body.append(field);field.focus({preventScroll:true});field.select();
 let copied=false;
 try{copied=document.execCommand('copy');}catch{}
 finally{field.remove();if(previous?.isConnected&&!previous.disabled)previous.focus({preventScroll:true});}
 if(copied){toast('Summary text copied.');return;}
 modal(`<h2>Copy summary text</h2><p class="help">Automatic copying is unavailable in this browser. The text is selected below. Press Ctrl+C to copy, then close this window.</p><textarea id="summary-copy-text" class="summary-copy-text" aria-label="Summary text to copy" readonly>${e(text)}</textarea><div class="actions">${action('close-dialog','Close')}</div>`);
 $('#summary-copy-text').focus({preventScroll:true});$('#summary-copy-text').select();
}
function renderTextSummary(r){
 const findings=summaryFindings(r);
 return findings.length?categories.filter(cat=>findings.some(f=>f.category===cat)).map(cat=>`<section class="summary-category" data-category="${e(cat)}"><h4>${e(cat)}</h4><ol class="summary-list">${findings.filter(f=>f.category===cat).map(f=>`<li class="summary-entry" id="summary-${e(f.id)}" tabindex="-1"><a class="summary-narrative" href="#finding-${e(f.id)}"><span class="narrative">${f.text?Wording.render(f):'Narrative not yet entered.'}</span></a></li>`).join('')}</ol></section>`).join(''):'<p class="summary-empty">No notes included yet. Add a note in Summary and pictures or in System checks.</p>';
}
function findingSource(r,f){return f.origin==='summary'?'Summary note':findingComponent(r,f)?.section.name||'Other observations';}
function findingCustomTitle(r,f){return f.location&&f.location!==findingContext(r,f)?f.location:'';}
function renderFindingSource(r,f){
 const label=e(findingSource(r,f)),context=findingContext(r,f);
 return f.origin==='summary'?`<span class="badge note-source" title="Source: Summary note">${label}</span>`:`<a class="badge note-source note-source-link" href="#check-finding-${e(f.id)}" title="${e('Go to '+context+' in System checks')}">${label}</a>`;
}
function renderNoteActions(f,number,origin=''){
 return `<div class="photo-note-actions" role="group" aria-label="Actions for note ${e(number)}">${action('edit-note','<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m16 3 5 5-12 12-6 1 1-6L16 3Z"/><path d="m13 6 5 5"/></svg>',`type="button" data-id="${e(f.id)}" ${origin?`data-origin="${e(origin)}"`:""} title="Edit note" aria-label="Edit note"`,'photo-note-icon')}${action('remove-finding','<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="m6 6 12 12M18 6 6 18"/></svg>',`type="button" data-id="${e(f.id)}" title="Delete note" aria-label="Delete note"`,'photo-note-icon danger')}</div>`;
}
function renderReportPhoto(f,ph,index){
 const label=`Edit photo ${index+1}`,pencil='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m16 3 5 5-12 12-6 1 1-6L16 3Z"/><path d="m13 6 5 5"/></svg>';
 return `<figure class="report-photo" data-photo-finding="${e(f.id)}" data-photo-index="${index}"><div class="report-photo-frame"><div class="report-photo-surface"><img loading="lazy" src="${e(ph.src)}" alt="${e(ph.caption||'Inspection photograph')}"></div><button type="button" class="report-photo-edit" data-report-photo="open" title="${label}" aria-label="${label}" aria-expanded="false">${pencil}</button></div><div class="report-photo-controls" hidden></div>${ph.caption?`<figcaption>${e(ph.caption)}</figcaption>`:''}</figure>`;
}
function renderPhotoSummary(r){
 const findings=summaryFindings(r);
 return findings.length?categories.filter(cat=>findings.some(f=>f.category===cat)).map(cat=>`<section class="photo-summary-category" data-category="${e(cat)}"><h4 class="photo-category-title">${e(cat)}</h4>${findings.filter(f=>f.category===cat).map((f,index)=>`<article class="summary-photo-card" id="finding-${e(f.id)}" tabindex="-1"><div class="finding-head"><div class="photo-note-body">${findingCustomTitle(r,f)?`<h4>${e(findingCustomTitle(r,f))}</h4>`:''}<p class="narrative"><span class="summary-note-number">${index+1}. </span>${f.text?Wording.render(f):'Narrative not yet entered.'}</p></div><div class="photo-note-heading-actions">${renderFindingSource(r,f)}${renderNoteActions(f,index+1,'finding-'+f.id)}</div></div>${f.photos.length?`<div class="summary-photos">${f.photos.map((ph,index)=>renderReportPhoto(f,ph,index)).join('')}</div>`:'<p class="help">No photos attached.</p>'}</article>`).join('')}</section>`).join(''):'<p class="summary-empty">Add a new note here, with text and one or more photos. Its text also appears in Summary.</p>';
}
function refreshSummaries(){if(route!=='editor')return;const r=report();if(!r)return;if(typeof ReportPhotos!=='undefined')ReportPhotos.closeWithin($('#photo-summary'));$('#text-summary').innerHTML=renderTextSummary(r);$('#photo-summary').innerHTML=renderPhotoSummary(r);$('#finding-count').textContent=`${r.findings.length} ${r.findings.length===1?'finding':'findings'}`;}
function jumpTo(id){const target=document.getElementById(id);if(target){target.scrollIntoView({block:'start'});target.focus({preventScroll:true});}}
function completenessTarget(r,issue){
 if(issue.kind==='field'&&['address','client','date','scope'].includes(issue.field))return {anchor:'report-field-'+issue.field};
 if(issue.kind==='inspector')return {anchor:'report-inspector',focus:'[data-action="refresh-profile"]'};
 if(issue.kind==='item'&&['rating','limitation'].includes(issue.field)){
  const si=r.sections.findIndex(s=>s.id===issue.sectionId),ii=si<0?-1:r.sections[si].items.findIndex(i=>i.id===issue.itemId);
  if(ii>=0)return {anchor:`check-item-${si}-${ii}`,focus:issue.field==='limitation'?'[data-item-field="limitation"]':'[data-rating]'};
 }
 if(issue.kind==='finding'){
  const finding=r.findings.find(f=>f.id===issue.findingId);if(!finding)return null;
  const context=findingContext(r,finding),location=finding.location&&finding.location!==context?' · '+finding.location:'';
  return {anchor:(finding.origin==='summary'?'finding-':'check-finding-')+finding.id,findingId:finding.id,label:`Note #${findingNumber(r,finding)} · ${context}${location}`};
 }
 return null;
}
function renderCompletenessIssues(result,r){
 if(!result.issues.length)return '<p class="help">✓ Completeness check passed. Review the observations and final report before delivery.</p>';
 const rows=result.issues.map((message,index)=>{
  const issue=result.issueDetails?.[index],target=issue?.message===message?completenessTarget(r,issue):null;
  if(!target)return `<li>${e(message)}</li>`;
  return `<li><a class="issue-link" href="#${e(target.anchor)}" data-completeness-issue="${e(JSON.stringify(issue))}">${target.label?`<span class="issue-context">${e(target.label)}</span>`:''}${e(message)}</a></li>`;
 });
 return '<p class="help">Select an issue to go directly to the field or note that needs attention.</p><ul class="issue-list">'+rows.join('')+'</ul>';
}
function followCompletenessIssue(issue){
 if(route!=='editor'||!report())return false;
 const target=completenessTarget(report(),issue),element=target&&document.getElementById(target.anchor);
 if(!element){toast('This item has changed. Run Check completeness again.',true);return false;}
 jumpTo(target.anchor);
 if(target.findingId){openNote(target.findingId,null,null,target.anchor);$('#note-text').scrollIntoView({block:'center'});$('#note-text').focus({preventScroll:true});}
 else if(target.focus){const field=element.querySelector(target.focus);field?.focus({preventScroll:true});field?.scrollIntoView({block:'center'});}
 return true;
}
document.addEventListener('click',ev=>{
 const link=ev.target.closest('a[data-completeness-issue]');
 if(!link||ev.button>0||ev.ctrlKey||ev.metaKey||ev.shiftKey||ev.altKey)return;
 ev.preventDefault();try{followCompletenessIssue(JSON.parse(link.dataset.completenessIssue));}catch(error){toast(error.message,true);}
});
function renderFindingEditor(r,f){
 return `<article class="finding source-finding" id="check-finding-${e(f.id)}" tabindex="-1"><div class="finding-head"><h4>Note #${findingNumber(r,f)} · ${e(f.location||findingContext(r,f))}</h4>${renderNoteActions(f,findingNumber(r,f))}</div><span class="badge">${e(f.category)}</span><p class="narrative">${f.text?Wording.render(f):'Photo documentation · narrative not yet entered.'}</p>${f.photos.length?`<div class="source-note-photos">${f.photos.map((ph,index)=>renderReportPhoto(f,ph,index)).join('')}</div>`:''}<div class="finding-links">${f.includeInSummary!==false?`<a href="#summary-${e(f.id)}">↑ Text summary</a><a href="#finding-${e(f.id)}">↑ Summary and pictures</a>`:'<span class="help">System checks only · not included in summaries</span>'}</div></article>`;
}
function renderCheckComponent(r,s,i,si,ii){
 return `<div class="check-row ${i.legacyRating&&!i.rating?'needs-review':''}" id="check-item-${si}-${ii}" tabindex="-1"><div class="rating-group" role="group" aria-label="${e(i.name)} inspection status">${Object.entries(ratings).map(([k,v])=>`<button class="rating ${k} ${i.rating===k?'active':''}" data-rating="${k}" data-item="${e(i.id)}" title="${k} = ${e(v)}" aria-label="${e(i.name)}: ${k} = ${e(v)}" aria-pressed="${i.rating===k}"><span class="status-box" aria-hidden="true">${i.rating===k?'✓':k}</span></button>`).join('')}</div><div class="component-body"><div class="component-heading"><div class="check-name">${e(i.name)}</div>${action('component-finding','<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M14 3H5v18h14V8l-5-5Z"/><path d="M14 3v5h5M8 14h8M12 10v8"/></svg>',`type="button" aria-label="Add note" data-tooltip="Add note" data-section-id="${e(s.id)}" data-item-id="${e(i.id)}"`,'report-tool component-add-note')}</div>${i.legacyRating&&!i.rating?`<p class="review-note">Previous classification: ${e(i.legacyRating.label)}. Select a new status to confirm.</p>`:''}<div class="chips">${i.options.map((v,n)=>`<button class="chip ${i.selected.includes(v)?'selected':''}" data-option="${n}" data-item="${e(i.id)}" aria-pressed="${i.selected.includes(v)}">${i.selected.includes(v)?'✓ ':''}${e(v)}</button>`).join('')}</div><div class="check-notes"><input aria-label="Additional notes / materials" title="Additional notes / materials" data-item-field="note" data-item="${e(i.id)}" value="${e(i.note)}" placeholder="Additional notes / materials"><input aria-label="Limitation" title="Limitation" class="${i.rating==='NI'&&!i.limitation.trim()?'required':''}" ${i.rating==='NI'?'aria-required="true"':''} data-item-field="limitation" data-item="${e(i.id)}" value="${e(i.limitation)}" placeholder="Limitation"></div><div class="component-findings">${r.findings.filter(f=>f.sectionId===s.id&&f.itemId===i.id).map(f=>renderFindingEditor(r,f)).join('')}</div></div></div>`;
}
function sectionNavName(name){if(/^Attic\s*&\s*Insulation$/i.test(name.trim()))return 'Attic';if(/^Basement\s*(?:&|and)\s*Crawl\s*space$/i.test(name.trim()))return 'BSMT & Crawl';return name;}
function renderSystemSectionLink(s,si){
 const total=s.items.length,recorded=s.items.filter(i=>Object.hasOwn(ratings,i.rating)).length,complete=total>0&&recorded===total;
 const label=`${s.name}: ${recorded}/${total} statuses selected. ${complete?'All statuses selected':total?'Statuses incomplete':'No checklist components'}.`;
 return `<a class="system-link" href="#check-section-${si}" title="${e(label)}" aria-label="${e(label)}"><span class="section-progress ${complete?'is-complete':'is-incomplete'}" aria-hidden="true"></span><span class="system-number">${String(si+1).padStart(2,'0')}</span><span class="system-label">${e(sectionNavName(s.name))}</span><span class="count">${recorded}/${total}</span></a>`;
}
function renderSystemChecks(r){
 return `<section id="system-checks" class="report-block" tabindex="-1"><div class="block-heading"><div class="eyebrow">SYSTEM INSPECTION</div><h2>System checks</h2><p class="help">Click I, NI, NP, or D at the top of a section to set all its components, then adjust individual items as needed. Click the highlighted status again to clear the section. Use Add note to document an observed problem.</p></div><div class="legend">${Object.entries(ratings).map(([k,v])=>`<span><b>${k}</b> = ${e(v)}</span>`).join('')}</div>${r.sections.some(s=>s.items.some(i=>i.legacyRating&&!i.rating))?'<div class="callout">Previous checklist classifications need review. Your notes, choices, and photos have been kept. Select I, NI, NP, or D for each highlighted component.</div>':''}<div class="editor-layout"><aside class="section-nav system-nav" aria-label="System sections"><a href="#findings-photos">Summaries</a>${r.sections.map(renderSystemSectionLink).join('')}<a href="#other-observations">Other observations</a></aside><div class="system-sections">${r.sections.map((s,si)=>`<section class="card checklist-card" id="check-section-${si}" tabindex="-1"><div class="section-title"><h3>${e(s.name)}</h3><a class="tiny" href="#findings-photos">↑ Summaries</a></div><div class="checklist-columns">${renderSectionRatings(s,si)}<b>COMPONENT / INSPECTION NOTES</b></div>${s.items.map((i,ii)=>renderCheckComponent(r,s,i,si,ii)).join('')}${s.disclaimer?`<div class="callout" style="margin-top:20px">${e(s.disclaimer)}</div>`:''}</section>`).join('')}<section class="card" id="other-observations" tabindex="-1"><div class="card-title"><h3>Other observations</h3>${action('add-finding','<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M14 3H5v18h14V8l-5-5Z"/><path d="M14 3v5h5M8 14h8M12 10v8"/></svg>','type="button" aria-label="Add note" data-tooltip="Add note"','report-tool component-add-note')}</div><p class="help">Checklist notes without a component link are kept here.</p>${r.findings.filter(f=>f.origin!=='summary'&&!findingComponent(r,f)).map(f=>renderFindingEditor(r,f)).join('')}</section><p class="help">Choose one status per component. I records that the component was inspected; use D when a deficiency is observed. NI requires a reason. NP means the component is not present. Selecting a material does not record an inspection status.</p></div></div></section>`;
}
function renderReportTools(){
 const svg=paths=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths}</svg>`;
 const tool=(name,label,paths,primary=false)=>action(name,svg(paths),`type="button" aria-label="${e(label)}" data-tooltip="${e(label)}"`,'report-tool'+(primary?' primary':''));
 return `<div class="report-tools" role="group" aria-label="Report actions">${tool('summary-note','Add note','<path d="M14 3H5v18h14V8l-5-5Z"/><path d="M14 3v5h5M8 14h8M12 10v8"/>')}${tool('check','Check completeness','<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M8 10l1.5 1.5L12 9M8 16l1.5 1.5L12 15M15 10h1M15 16h1"/>')}${tool('finalize','Mark finalized','<path d="m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6l8-4Z"/><path d="m8 12 3 3 5-6"/>')}${tool('save','Save now','<path d="M4 3h13l4 4v14H3V3h1Z"/><path d="M7 3v6h9V3M7 21v-8h10v8M13 5v2"/>',true)}</div>`;
}
function renderEditor(){
 const r=report();if(!r){route='reports';return renderReports();}
 return `<button class="back" data-nav="reports">← Back to reports</button>`+head('INSPECTION REPORT',e(r.address||'New inspection report'),`${e(r.client||'Client details needed')} · ${e(r.date)} · ${r.status==='final'?'Finalized':'Draft'} · ${progress(r)}% recorded`,renderReportTools())+`
 <section id="review-results" class="card review-results" aria-label="Report completeness" tabindex="-1" hidden><h2>Completeness check</h2><div id="issues" aria-live="polite"></div></section>
 <div class="report-jump-links" role="navigation" aria-label="Jump within report"><span class="help">On this page:</span><a href="#property-details">Property details</a><a href="#findings-photos">Findings & photos</a><a href="#system-checks">System checks</a></div>
 <section id="property-details" class="report-block" tabindex="-1"><div class="card"><div class="card-title"><h2>Property details</h2><span class="badge ${r.status==='final'?'final':''}">${r.status==='final'?'Finalized':'In progress'}</span></div><div class="grid">${field('Property address','address',r.address,{full:true})}${field('Client name','client',r.client)}${field('Inspection date','date',r.date,{type:'date'})}${field('Client email','email',r.email,{type:'email'})}${field('Client phone','phone',r.phone)}${field('Inspection time','time',r.time)}${field('Weather','weather',r.weather)}${field('Additional notes','notes',r.notes,{textarea:true,full:true})}${field('Scope & limitations','scope',r.scope,{textarea:true,full:true})}${field('Report notice','notice',r.notice,{textarea:true,full:true})}</div></div><div class="card" id="report-inspector" tabindex="-1"><div class="card-title"><h2>Inspector profile for this report</h2>${action('refresh-profile','Update from current profile','','small')}</div><p class="help">${e(r.inspector.name||'Inspector name needed')} · ${e(r.inspector.business)} · ${e(r.inspector.license)}<br>${e(r.inspector.email)} · ${e(r.inspector.phone)}</p><label class="help"><input type="checkbox" data-field="includeContact" data-scope="report" ${r.includeContact?'checked':''}> Include client email and phone in PDF and web exports (off by default)</label></div></section>
 <section id="findings-photos" class="card report-block" tabindex="-1"><div class="card-title"><h2>Findings & photos</h2><span class="badge" id="finding-count">${r.findings.length} ${r.findings.length===1?'finding':'findings'}</span></div><p class="help">Add notes directly in Summary and pictures, or include notes from System checks. Both summaries use the same text and category.</p><section class="summary-block" aria-labelledby="text-summary-title"><div class="card-title summary-heading"><h3 id="text-summary-title">Summary</h3>${action('copy-summary','<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h3"/></svg>','type="button" title="Copy summary text" aria-label="Copy summary text"','summary-copy')}</div><div id="text-summary">${renderTextSummary(r)}</div></section><section class="summary-block" aria-labelledby="photo-summary-title"><div class="card-title"><h3 id="photo-summary-title">Summary and pictures</h3></div><div id="photo-summary">${renderPhotoSummary(r)}</div></section></section>
 ${renderSystemChecks(r)}`;
}

function renderTemplate(){const t=template();const sec=t.sections.find(s=>s.id===sectionId)||t.sections[0];sectionId=sec.id;return `<button class="back" data-nav="templates">← Back to templates</button>`+head('TEMPLATE EDITOR',e(t.name),'Reorder sections and edit components and choices. Existing reports keep their own template snapshot.',action('save','Save template','','primary'))+`<div class="card"><div class="grid">${field('Template name','name',t.name,{scope:'template'})}${field('Scope & limitations','scope',t.scope,{scope:'template',textarea:true,full:true})}<p class="help full template-scope-help">Saved with this template and automatically filled in when you create a report from it. You can edit the text for each property in Property details. Existing reports keep their saved wording.</p>${field('Report notice','notice',t.notice,{scope:'template',textarea:true,full:true})}</div></div><div class="editor-layout template-layout">${renderTemplateSections(t)}<div class="card"><div class="section-title"><h2>Edit section</h2><div class="section-controls">${action('delete-section','Delete section','','danger')}</div></div><div class="grid" style="margin-top:20px">${field('Section name','name',sec.name,{scope:'section',full:true})}${field('Section notice / limitations','disclaimer',sec.disclaimer,{scope:'section',textarea:true,full:true})}</div><p class="help">Separate choices with |, for example: Operated | Not tested in summer. A choice does not replace an inspection status or the actual reason for NI (Not Inspected).</p>${sec.items.map((i,n)=>`<div class="section-edit-row"><input aria-label="Component name" data-template-item="${i.id}" data-template-field="name" value="${e(i.name)}"><input aria-label="Component choices" data-template-item="${i.id}" data-template-field="options" value="${e(i.options.join(' | '))}" placeholder="Choice one | Choice two"><div class="section-controls">${action('move-item','↑',`data-id="${i.id}" data-delta="-1"`)}${action('move-item','↓',`data-id="${i.id}" data-delta="1"`)}${action('delete-item','×',`data-id="${i.id}"`,'danger')}</div></div>`).join('')}<div class="actions" style="margin-top:20px">${action('add-item','＋ Add component')}</div></div></div>`;}
function renderTemplateSections(t){
 return `<aside class="section-nav template-section-nav" aria-label="Template sections"><h3>Section order</h3><p class="help">Drag a section up or down, or use its arrows.</p><div id="template-section-list" role="list" aria-label="Template section order">${t.sections.map((s,i)=>`<div class="template-section-row ${s.id===sectionId?'active':''}" data-template-section="${e(s.id)}" draggable="true" role="listitem"><span class="section-drag-handle" aria-hidden="true" title="Drag to reorder">⠿</span><button class="template-section-select" data-section="${e(s.id)}" id="template-select-${e(s.id)}" ${s.id===sectionId?'aria-current="true"':''} title="${e(s.name)}"><span class="section-position">${i+1}.</span><span>${e(s.name)}</span></button><div class="template-row-arrows">${action('move-section','↑',`id="template-up-${e(s.id)}" data-id="${e(s.id)}" data-delta="-1" title="Move ${e(s.name)} up" aria-label="Move ${e(s.name)} up" ${i===0?'disabled':''}`,'template-section-move')}${action('move-section','↓',`id="template-down-${e(s.id)}" data-id="${e(s.id)}" data-delta="1" title="Move ${e(s.name)} down" aria-label="Move ${e(s.name)} down" ${i===t.sections.length-1?'disabled':''}`,'template-section-move')}</div></div>`).join('')}</div>${action('add-section','＋ Add section','','small template-add-section')}</aside>`;
}
function moveTemplateSection(id,to,focusId){
 if(route!=='template-editor')return false;
 const rows=template()?.sections,from=rows?.findIndex(s=>s.id===id);
 if(from===undefined||from<0||!Number.isInteger(to)||to<0||to>=rows.length||to===from)return false;
 const nav=$('.template-section-nav'),scrollTop=nav?.scrollTop||0;
 rows.splice(to,0,rows.splice(from,1)[0]);changed();render();
 const newNav=$('.template-section-nav');if(newNav)newNav.scrollTop=scrollTop;
 const preferred=focusId&&document.getElementById(focusId),focus=preferred&&!preferred.disabled?preferred:document.getElementById('template-select-'+id);
 focus?.focus({preventScroll:true});focus?.scrollIntoView({block:'nearest'});
 return true;
}
let templateSectionDrag=null;
function clearTemplateDrag(){
 templateSectionDrag=null;
 document.querySelectorAll('.template-section-row').forEach(row=>row.classList.remove('dragging','drop-before','drop-after'));
}
function templateDropTarget(ev){
 if(route!=='template-editor'||templateSectionDrag?.templateId!==currentId)return null;
 return ev.target.closest('.template-section-row');
}
document.addEventListener('dragstart',ev=>{
 const row=ev.target.closest('.template-section-row');if(!row||route!=='template-editor')return;
 if(ev.target.closest('.template-row-arrows')){ev.preventDefault();return;}
 templateSectionDrag={templateId:currentId,sectionId:row.dataset.templateSection};
 ev.dataTransfer.effectAllowed='move';ev.dataTransfer.setData('text/plain',row.dataset.templateSection);row.classList.add('dragging');
});
document.addEventListener('dragenter',ev=>{if(templateDropTarget(ev)){ev.preventDefault();ev.dataTransfer.dropEffect='move';}});
document.addEventListener('dragover',ev=>{
 const row=templateDropTarget(ev);if(!row)return;
 ev.preventDefault();ev.dataTransfer.dropEffect='move';
 document.querySelectorAll('.template-section-row').forEach(el=>el.classList.remove('drop-before','drop-after'));
 const rect=row.getBoundingClientRect();row.classList.add(ev.clientY<rect.top+rect.height/2?'drop-before':'drop-after');
 const nav=row.closest('.template-section-nav'),bounds=nav.getBoundingClientRect();
 if(ev.clientY<bounds.top+36)nav.scrollTop-=16;else if(ev.clientY>bounds.bottom-36)nav.scrollTop+=16;
});
document.addEventListener('drop',ev=>{
 const row=templateDropTarget(ev);if(!row)return;
 ev.preventDefault();const id=templateSectionDrag.sectionId,rows=template().sections,from=rows.findIndex(s=>s.id===id),target=rows.findIndex(s=>s.id===row.dataset.templateSection),rect=row.getBoundingClientRect();
 const insertion=target+(ev.clientY>=rect.top+rect.height/2?1:0),to=insertion-(from<insertion?1:0);
 clearTemplateDrag();if(from>=0&&target>=0)moveTemplateSection(id,to);
});
document.addEventListener('dragend',clearTemplateDrag);
function dateToday(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function blankReport(t,values={}){return {id:uid(),templateName:t.name,client:'',address:'',email:'',phone:'',date:dateToday(),time:'',weather:'',notes:'',notice:t.notice,scope:t.scope??'',includeContact:false,inspector:clone(state.profile),sections:clone(t.sections).map(s=>({...s,items:s.items.map(i=>{const {legacyRating,...component}=i;return {...component,selected:[],rating:'',note:'',limitation:''};})})),findings:[],status:'draft',updated:new Date().toISOString(),...values};}
function openReport(id){route='editor';currentId=id;sectionId=null;render();window.scrollTo(0,0);}
function newReportDialog(){modal(`<h2>Create inspection report</h2><p class="sub">Your selected template supplies the scope, limitations, report notice, and checklist. Inspection results start blank.</p><div class="grid"><label class="field full"><span>Choose a template</span><select id="new-template-id">${state.templates.map(t=>`<option value="${t.id}">${e(t.name)}</option>`).join('')}</select></label><label class="field full"><span>Property address</span><input id="new-address" placeholder="123 Main Street, City, State ZIP"></label><label class="field"><span>Client name</span><input id="new-client"></label><label class="field"><span>Inspection date</span><input id="new-date" type="date" value="${dateToday()}"></label></div><div class="actions">${action('close-dialog','Cancel')}${action('create-report','Create report','','primary')}</div>`);}
function selectedSection(){return (route==='template-editor'?template():report()).sections.find(s=>s.id===sectionId);}
function addSectionDialog(){
 if(route!=='template-editor'||!template())return;
 if(template().sections.length>=100)throw Error('A template supports up to 100 sections.');
 modal(`<h2 id="add-section-title">Add section</h2><p class="help">Add a section to this template, then add its checklist components.</p><form id="add-section-form" data-template-id="${e(currentId)}" aria-labelledby="add-section-title" novalidate><label class="field"><span>Section name</span><input id="new-section-name" name="sectionName" maxlength="300" required autocomplete="off" placeholder="For example: Pool & Spa" aria-describedby="add-section-error"></label><p id="add-section-error" class="help error" role="alert"></p><div class="actions">${action('close-dialog','Cancel','type="button"')}<button type="submit" class="primary">Add section</button></div></form>`);
 $('#new-section-name').focus();
}
document.addEventListener('submit',async ev=>{
 const form=ev.target;if(form.id!=='add-section-form')return;
 ev.preventDefault();if(form.dataset.submitting==='true')return;
 const input=$('#new-section-name'),name=input.value.trim(),error=$('#add-section-error');
 error.textContent='';input.removeAttribute('aria-invalid');
 if(!name||name.length>300){error.textContent=name?'Use a section name of 300 characters or fewer.':'Enter a section name.';input.setAttribute('aria-invalid','true');input.focus();return;}
 if(route!=='template-editor'||currentId!==form.dataset.templateId||!template()){error.textContent='The template has changed. Close this form and try again.';return;}
 if(template().sections.length>=100){error.textContent='A template supports up to 100 sections.';return;}
 form.dataset.submitting='true';
 const section={id:uid(),name,disclaimer:'',items:[]};template().sections.push(section);sectionId=section.id;
 changed();closeModal();render();
 try{await saveNow();toast('Section added and saved.');}catch(err){toast(err.message,true);}
});
function newFinding(location='',sectionId,itemId){openNote(null,sectionId,itemId);}
async function download(url,name){await saveNow();const r=await api(url);const blob=r instanceof Response?await r.blob():new Blob([JSON.stringify(r,null,2)],{type:'application/json'});downloadBlob(blob,name);}
function downloadBlob(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
document.addEventListener('input',ev=>{
 const el=ev.target;if(el.id==='report-search'){search=el.value;const start=el.selectionStart;render();$('#report-search').focus();$('#report-search').setSelectionRange(start,start);return;}
 if(el.dataset.field){let target=el.dataset.scope==='profile'?state.profile:el.dataset.scope==='template'?template():el.dataset.scope==='section'?selectedSection():report();target[el.dataset.field]=el.type==='checkbox'?el.checked:el.value;changed();}
 if(el.dataset.itemField){reportItem(el.dataset.item)[el.dataset.itemField]=el.value;changed();}
 if(el.dataset.findingField){report().findings.find(f=>f.id===el.dataset.finding)[el.dataset.findingField]=el.value;changed();refreshSummaries();}
 if(el.dataset.photoCaption!==undefined){report().findings.find(f=>f.id===el.dataset.finding).photos[Number(el.dataset.photoCaption)].caption=el.value;changed();refreshSummaries();}
 if(el.dataset.templateField){const i=selectedSection().items.find(i=>i.id===el.dataset.templateItem);i[el.dataset.templateField]=el.dataset.templateField==='options'?[...new Set(el.value.split('|').map(x=>x.trim()).filter(Boolean))]:el.value;changed();}
});
document.addEventListener('change',ev=>{
 const id=ev.target.dataset.findingLink;if(!id)return;
 const f=report().findings.find(f=>f.id===id),value=ev.target.value;
 if(value){const [si,ii]=value.split(':').map(Number),s=report().sections[si],i=s.items[ii];f.sectionId=s.id;f.itemId=i.id;}
 else{delete f.sectionId;delete f.itemId;}
 changed();render();jumpTo('check-finding-'+f.id);
});
document.addEventListener('click',async ev=>{const b=ev.target.closest('button');if(!b)return;try{
 if(b.dataset.themeChoice){await selectSystemTheme(b.dataset.themeChoice);return;}
 if(b.dataset.nav){await saveNow();route=b.dataset.nav;currentId=null;render();return;}
 if(b.dataset.section){await saveNow();sectionId=b.dataset.section;render();return;}
 if(b.dataset.sectionRating){if(toggleSectionRating(b.dataset.sectionId,b.dataset.sectionRating)){const focusId=b.id;render();document.getElementById(focusId)?.focus({preventScroll:true});}return;}
 if(b.dataset.rating){const i=reportItem(b.dataset.item);i.rating=i.rating===b.dataset.rating?'':b.dataset.rating;changed();render();return;}
 if(b.dataset.option!==undefined){const i=reportItem(b.dataset.item),v=i.options[Number(b.dataset.option)];i.selected=i.selected.includes(v)?i.selected.filter(x=>x!==v):[...i.selected,v];changed();render();return;}
 const a=b.dataset.action;if(!a)return;b.disabled=true;
 if(a==='save'){await saveNow();toast('Saved to this computer.');}
 if(a==='go-profile'){await saveNow();route='profile';render();}
 if(a==='new-report')newReportDialog();
 if(a==='close-dialog')closeModal();
 if(a==='create-report'){const t=state.templates.find(t=>t.id===$('#new-template-id').value),r=blankReport(t,{address:$('#new-address').value.trim(),client:$('#new-client').value.trim(),date:$('#new-date').value});if(!r.address||!r.client||!r.date)throw Error('Enter the property address, client name, and inspection date.');state.reports.push(r);dirty++;await saveNow();closeModal();openReport(r.id);}
 if(a==='demo'){const r=blankReport(state.templates[0],{isDemo:true,address:'DEMO · 123 Example Street',client:'Demo Client',scope:'Demonstration only. This is not an actual property inspection.',findings:[{id:uid(),location:'Demo kitchen',category:categories[0],text:'DEMONSTRATION ONLY: The food disposal did not respond to its control. Evaluation and repair by a qualified plumber are recommended.',photos:[]}]});state.reports.push(r);dirty++;await saveNow();openReport(r.id);}
 if(a==='open-report'){await saveNow();openReport(b.dataset.id);}
 if(a==='delete-report'&&confirm('Delete this report? A local recovery snapshot will be retained.')){state.reports=state.reports.filter(r=>r.id!==b.dataset.id);dirty++;await saveNow();render();}
 if(a==='duplicate-report'){const old=state.reports.find(r=>r.id===b.dataset.id),r=blankReport({name:old.templateName,notice:old.notice,scope:old.scope,sections:old.sections});state.reports.push(r);dirty++;await saveNow();openReport(r.id);toast('Checklist structure, scope, and report notice copied. Client details, ratings, findings, and photos are blank.');}
 if(a==='new-template'){const name=prompt('Template name:','New residential template');if(name?.trim()){const t=clone(state.templates[0]);t.id=uid();t.name=name.trim();state.templates.push(t);dirty++;await saveNow();route='template-editor';currentId=t.id;sectionId=null;render();}}
 if(a==='open-template'){await saveNow();route='template-editor';currentId=b.dataset.id;sectionId=null;render();}
 if(a==='duplicate-template'){const t=clone(state.templates.find(t=>t.id===b.dataset.id));t.id=uid();t.name+=' · Copy';state.templates.push(t);dirty++;await saveNow();render();}
 if(a==='delete-template'){if(state.templates.length===1)throw Error('Keep at least one template.');if(confirm('Delete this template? Existing reports will be preserved.')){state.templates=state.templates.filter(t=>t.id!==b.dataset.id);dirty++;await saveNow();render();}}
 if(a==='add-section')addSectionDialog();
 if(a==='move-section'&&route==='template-editor'){const id=b.dataset.id||sectionId,rows=template().sections,i=rows.findIndex(s=>s.id===id);if(i>=0)moveTemplateSection(id,i+Number(b.dataset.delta),b.id);}
 if(a==='delete-section'){if(template().sections.length===1)throw Error('Keep at least one section.');if(confirm('Delete this section and its components?')){template().sections=template().sections.filter(s=>s.id!==sectionId);sectionId=null;changed();render();}}
 if(a==='add-item'){selectedSection().items.push({id:uid(),name:'New component',options:[],selected:[],rating:'',note:'',limitation:''});changed();render();}
 if(a==='delete-item'){if(confirm('Delete this component?')){selectedSection().items=selectedSection().items.filter(i=>i.id!==b.dataset.id);changed();render();}}
 if(a==='move-item'){const rows=selectedSection().items,i=rows.findIndex(i=>i.id===b.dataset.id),j=i+Number(b.dataset.delta);if(j>=0&&j<rows.length){[rows[i],rows[j]]=[rows[j],rows[i]];changed();render();}}
 if(a==='refresh-profile'&&confirm('Update the inspector details in this report from your current profile?')){report().inspector=clone(state.profile);changed();render();}
 if(a==='add-finding')newFinding();
 if(a==='summary-note')openNote(null,null,null,null,'summary');
 if(a==='copy-summary')await copySummary();
 if(a==='edit-note')openNote(b.dataset.id,null,null,b.dataset.origin);
 if(a==='note-library')await openNoteLibrary();
 if(a==='component-finding'){const s=report().sections.find(s=>s.id===b.dataset.sectionId),i=s?.items.find(i=>i.id===b.dataset.itemId);if(!i)throw Error('Component not found.');newFinding(s.name+' / '+i.name,s.id,i.id);}
 if(a==='remove-finding'&&await confirmNote('Delete this note and its photos from the report?', 'Delete note')){report().findings=report().findings.filter(f=>f.id!==b.dataset.id);changed();render();}
 if(a==='add-photos'){photoTarget={report:currentId,finding:b.dataset.id};$('#photo-file').click();}
 if(a==='remove-photo'){report().findings.find(f=>f.id===b.dataset.id).photos.splice(Number(b.dataset.index),1);changed();render();}
 if(a==='upload-logo')$('#logo-file').click();if(a==='remove-logo'){state.profile.logo='';changed();render();}
 if(['preview','pdf','html'].includes(a)){
  // Each library button owns its report ID, independent of the last opened editor.
  const reportId=b.dataset.id;
  if(!state.reports.some(r=>r.id===reportId))throw Error('Report not found. Refresh the library and try again.');
  if(a==='preview'){
   const preview=window.open('about:blank','_blank');
   if(!preview)throw Error('Allow pop-ups for HomeKanban to open the report preview.');
   preview.opener=null;
   try{await saveNow();preview.location.replace(`/api/reports/${reportId}/html`);}catch(error){preview.close();throw error;}
  }
  if(a==='pdf'){toast('Creating your PDF locally…');await download(`/api/reports/${reportId}/pdf`,'inspection-report.pdf');toast('PDF exported.');}
  if(a==='html'){await download(`/api/reports/${reportId}/html?download=1`,'index.html');toast('Web report exported as index.html. Upload this file to your web host.');}
 }
 if(a==='check'||a==='finalize'){
  const reportId=currentId;
  await saveNow();const checkedGeneration=dirty;
  const result=await api(`/api/reports/${reportId}/check`);
  if(route!=='editor'||currentId!==reportId)return;
  if(dirty!==checkedGeneration){toast('The report changed. Run the completeness check again.',true);return;}
  $('#review-results').hidden=false;
  $('#issues').innerHTML=renderCompletenessIssues(result,report());
  jumpTo('review-results');
  if(a==='finalize'){
   if(result.issues.length)toast('Some items need attention. See the completeness results below.',true);
   else if(confirm('I have reviewed the report, checklist, and photos. Mark this report as finalized?')){report().status='final';dirty++;await saveNow();render();toast('Report finalized.');}
  }
 }
 if(a==='backup'){downloadBlob(new Blob([JSON.stringify({format:'soloinspect-backup',created:new Date().toISOString(),revision,state:clone(state)},null,2)],{type:'application/json'}),`HomeKanban-backup-${dateToday()}.json`);toast('Current workspace exported, including unsaved changes.');}
 if(a==='restore')$('#restore-file').click();
 if(a==='save-api'){const r=await api('/api/settings','PUT',{endpoint:$('#api-endpoint').value.trim(),model:$('#api-model').value.trim(),key:$('#api-key').value});$('#api-key').value='';$('#key-status').textContent=r.hasKey?'Key encrypted & saved':'No key configured';toast('API settings saved.');}
 if(a==='clear-key'&&confirm('Remove the API key saved on this computer?')){const s=await api('/api/settings');await api('/api/settings','PUT',{...s,clearKey:true});await loadSettings();toast('API key removed.');}
 if(a==='ai-finding'){const f=report().findings.find(f=>f.id===b.dataset.id),cfg=await api('/api/settings');if(!cfg.hasKey||!cfg.model)throw Error('Configure an API key and model in AI & settings first.');aiTarget={reportId:currentId,findingId:f.id,original:f.text};modal(`<h2>AI writing assistant</h2><p class="help">Send the text below to <b>${e(new URL(cfg.endpoint).hostname)}</b>, model ${e(cfg.model)}. API charges may apply. AI will not change your ratings or finding categories.</p><label class="field"><span>Field notes to send</span><textarea id="ai-input">${e(f.text)}</textarea></label><label class="field"><span>Output language</span><select id="ai-language"><option>English</option></select></label><div id="ai-output"></div><div class="actions">${action('close-dialog','Cancel')}${action('generate-ai','Send & generate draft','','primary')}</div>`);}
 if(a==='generate-ai'){const requestTarget=aiTarget,original=$('#ai-input').value;$('#ai-output').textContent='Generating a draft…';const result=await api('/api/ai','POST',{text:original,language:$('#ai-language').value});if(aiTarget!==requestTarget||!$('#dialog').open)return;$('#ai-output').innerHTML=`<label class="field"><span>AI draft · Review and edit</span><textarea id="ai-draft" style="min-height:180px">${e(result.draft)}</textarea></label><div class="actions">${action('accept-ai','Use this draft','','primary')}</div>`;}
 if(a==='accept-ai'){if(aiTarget.noteSession){useNoteAIDraft($('#ai-draft').value);return;}const r=state.reports.find(r=>r.id===aiTarget.reportId),f=r.findings.find(f=>f.id===aiTarget.findingId);if(f.text!==aiTarget.original)throw Error('The original note has changed. Generate again or copy the draft manually.');f.text=$('#ai-draft').value;delete f.textRuns;changed();closeModal();render();}
 if(a==='quit'){await saveNow();if(confirm('Save and exit HomeKanban?')){await api('/api/quit','POST',{});$('#main').innerHTML='<div class="empty"><h1>Safely closed</h1><p>You can close this window. Open HomeKanban again to continue.</p></div>';}}
 }catch(err){toast(err.message,true);}finally{if(b.isConnected)b.disabled=false;}});
async function imageData(file){if(file.size>25*1024*1024)throw Error('Each source image must be smaller than 25 MB.');if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Use a JPG, PNG, or WebP image.');const source=URL.createObjectURL(file);try{const img=new Image();img.src=source;await img.decode();const canvas=document.createElement('canvas'),scale=Math.min(1,1800/Math.max(img.width,img.height));canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);return canvas.toDataURL('image/jpeg',.84);}finally{URL.revokeObjectURL(source);}}
$('#photo-file').addEventListener('change',async ev=>{const target=photoTarget,files=[...ev.target.files];try{const r=state.reports.find(r=>r.id===target.report),f=r?.findings.find(f=>f.id===target.finding);if(!f)throw Error('The report or finding no longer exists.');if(f.photos.length+files.length>30)throw Error('Each finding supports up to 30 photos.');const photos=[];for(const file of files)photos.push({src:await imageData(file),caption:''});f.photos.push(...photos);r.status='draft';r.updated=new Date().toISOString();dirty++;await saveNow();if(route==='editor'&&currentId===target.report){render();jumpTo('check-finding-'+target.finding);}toast(`Added ${photos.length} photos locally.`);}catch(err){toast(err.message,true);}finally{ev.target.value='';}});
$('#logo-file').addEventListener('change',async ev=>{try{if(ev.target.files[0]){state.profile.logo=await imageData(ev.target.files[0]);changed();render();}}catch(err){toast(err.message,true);}finally{ev.target.value='';}});
$('#restore-file').addEventListener('change',async ev=>{try{const file=ev.target.files[0];if(!file)return;if(file.size>95*1024*1024)throw Error('The backup exceeds the 95 MB import limit.');const backup=JSON.parse(await file.text());if(backup.format!=='soloinspect-backup')throw Error('This is not a valid backup.');if(!confirm('Replace the current profile, templates, and reports with this backup? A local recovery snapshot will be retained first.'))return;await saveNow();await api('/api/restore','POST',{backup,revision});await boot();toast('Backup restored. Your local API key settings were retained.');}catch(err){toast(err.message,true);}finally{ev.target.value='';}});
// All deferred editor scripts must be ready before the first render or a later restore.
const frontendReady=document.readyState==='complete'?Promise.resolve():new Promise(resolve=>document.addEventListener('DOMContentLoaded',resolve,{once:true}));
async function boot(){await frontendReady;const result=await api('/api/state');({state,revision,categories,ratings,dataDir}=result);if(Array.isArray(result.textColors))supportedTextColors=result.textColors;dirty=saved=0;route='reports';currentId=null;applySystemTheme();render();status('✓ Local data loaded');}
boot().catch(err=>{$('#main').textContent=err.message;status('Unable to load',true);});
