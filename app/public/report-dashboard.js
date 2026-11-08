(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ReportDashboard=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const icons={home:'<path d="m3 10 9-7 9 7v11h-6v-7H9v7H3Z"/>',person:'<circle cx="12" cy="7" r="4"/><path d="M4 21v-3a8 8 0 0 1 16 0v3"/>',calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 2v6M17 2v6M3 11h18"/>',note:'<path d="M14 3H5v18h14V8l-5-5ZM14 3v5h5M8 13h8M8 17h6"/>',payment:'<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>',globe:'<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18M5 6h14M5 18h14"/>'};
 const icon=name=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||icons.note}</svg>`;

 let options,selection=null,page=1;
 const hosted=status=>['published','publishing','terminating','uncertain'].includes(status);
 const hostedStatus=(hosting,id)=>hosting?.status?.(id)??null;
 function counts(reports,hosting){return {unfinished:reports.filter(r=>r.status==='draft').length,unpaid:reports.filter(r=>r.paymentStatus!=='paid').length,hosted:reports.filter(r=>hosted(hostedStatus(hosting,r.id))).length,unverified:reports.filter(r=>['publishing','terminating','uncertain'].includes(hostedStatus(hosting,r.id))).length};}
 function matches(report,filter,hosting){if(!filter)return true;if(filter.type==='unfinished')return report.status==='draft';if(filter.type==='unpaid')return report.paymentStatus!=='paid';if(filter.type==='hosted')return hosted(hostedStatus(hosting,report.id));return true;}
 function filtered(reports,search,hosting){return reports.filter(r=>matches(r,selection,hosting)&&(r.address+' '+r.client).toLowerCase().includes(String(search||'').toLowerCase()));}
 const label=filter=>!filter?'':({unfinished:'Unfinished',unpaid:'Unpaid',hosted:'Web-hosted'}[filter.type]||'');
 function select(filter){selection=filter;page=1;options?.render();}
 function resetPage(){page=1;}
 function paginate(reports){const pages=Math.max(1,Math.ceil(reports.length/10));page=Math.min(Math.max(1,page),pages);return {reports:reports.slice((page-1)*10,page*10),page,pages,total:reports.length,start:reports.length?(page-1)*10+1:0,end:Math.min(page*10,reports.length)};}
 function filterChip(){return selection?`<div class="library-filter-state"><span class="active-filter-label">${escape(label(selection))}</span><button type="button" class="dashboard-filter" data-dashboard="clear" aria-label="Show all reports. Clear ${escape(label(selection))} filter">Show all reports <span aria-hidden="true">×</span></button></div>`:'';}
 function pagination(info){return `<div class="library-pagination"><span role="status">Showing ${info.start}–${info.end} of ${info.total} matching reports</span><div><button type="button" data-dashboard="page" data-page="${info.page-1}" ${info.page===1?'disabled':''} aria-label="Previous report page">‹</button><span>Page ${info.page} of ${info.pages}</span><button type="button" data-dashboard="page" data-page="${info.page+1}" ${info.page===info.pages?'disabled':''} aria-label="Next report page">›</button></div></div>`;}
 function overview(reports,hosting){
  const c=counts(reports,hosting);
  const card=(type,title,symbol,count,hint)=>`<button type="button" data-dashboard="filter" data-filter="${type}" class="report-filter-card ${selection?.type===type?'is-active':''}" aria-pressed="${selection?.type===type}" title="${escape(hint)}">${icon(symbol)}<span>${title}</span><strong>${count}</strong><span class="filter-card-arrow" aria-hidden="true">${selection?.type===type?'×':'›'}</span></button>`;
  return `<section class="reports-overview report-dashboard" aria-label="Report filters">${card('unfinished','Unfinished reports','note',c.unfinished,'Show unfinished reports. Select again to show all reports.')}${card('unpaid','Unpaid inspections','payment',c.unpaid,'Show unpaid inspections. Select again to show all reports.')}${card('hosted','Web-hosted reports','globe',hosting?.ready?.()===false?'—':c.hosted,c.unverified?`${c.unverified} publications need a status check. Select again to show all reports.`:'Show active web publications using locally recorded status. Select again to show all reports.')}</section>`;
 }
 function bind(config){options=config;document.addEventListener('click',event=>{const button=event.target.closest?.('[data-dashboard]');if(!button)return;const kind=button.dataset.dashboard;if(kind==='filter')select(selection?.type===button.dataset.filter?null:{type:button.dataset.filter});if(kind==='clear')select(null);if(kind==='page'){page=Number(button.dataset.page)||1;options.render();}});}
 return {icon,counts,matches,filtered,paginate,filterChip,pagination,overview,bind,resetPage,select};
});
