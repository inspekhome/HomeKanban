'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const {seed,ratings,categories}=require('../app/seed'),{reportHTML}=require('../app/report'),{createApp,validateState}=require('../app/server');
function client(){
 const state=seed(),events=new Map(),nodes=new Map(),rows=new Map(),handles=new Map();let hit=null,frame=null;
 const node=key=>{if(!nodes.has(key))nodes.set(key,{content:'test-token',scrollTop:70,style:{},classList:{toggle(){}},addEventListener(){},focus(){},getBoundingClientRect:()=>({top:0,bottom:600})});return nodes.get(key);};
 const ctx=vm.createContext({initialState:state,initialRatings:ratings,initialCategories:categories,Wording:require('../app/public/wording'),structuredClone,crypto,setTimeout:()=>1,clearTimeout(){},requestAnimationFrame:fn=>{frame=fn;return 1;},cancelAnimationFrame:()=>frame=null,document:{querySelector:node,getElementById:node,querySelectorAll:s=>s==='.report-section-row'?[...rows.values()]:[],elementFromPoint:()=>hit,addEventListener:(name,fn)=>events.set(name,fn)},window:{location:{hash:'#check-section-0'},history:{replaceState(a,b,hash){ctx.window.location.hash=hash;}},addEventListener(){},scrollBy(){}}});
 const source=fs.readFileSync(require.resolve('../app/public/app.js'),'utf8');
 vm.runInContext(source.slice(0,source.lastIndexOf('\nboot().catch'))+`
 state=initialState;ratings=initialRatings;categories=initialCategories;state.profile.name='Test inspector';
 const r=blankReport(state.templates[0],{id:'report-under-test',address:'TEST ONLY',client:'Synthetic',scope:'Synthetic scope'});state.reports.push(r,blankReport(state.templates[0],{id:'untouched-report'}));
 r.sections.push({id:'custom14',name:'Custom system',disclaimer:'Keep this notice',items:[]});r.sections[0].items[0].rating='D';r.sections[0].items[0].selected=['Single family'];
 r.findings.push({id:'linked-note',sectionId:r.sections[0].id,itemId:r.sections[0].items[0].id,origin:'checklist',location:'Test location',category:categories[0],text:'Keep this note',photos:[{src:'data:image/png;base64,dGVzdA==',caption:'Keep this photo'}]});
 route='editor';currentId=r.id;render=()=>{};
 globalThis.h={get r(){return report();},get dirty(){return dirty;},move:moveReportSection,html:()=>renderSystemChecks(report()),changeRoute(value){route=value;},otherReport(){currentId='untouched-report';}};`,ctx);
 const row=id=>{if(!rows.has(id)){const classes=new Set(),r={dataset:{reportSection:id},classList:{add:(...a)=>a.forEach(x=>classes.add(x)),remove:(...a)=>a.forEach(x=>classes.delete(x))},getBoundingClientRect:()=>({top:100,height:40,bottom:140})};r.closest=s=>s==='.report-section-row'?r:s==='.system-nav'?node('.system-nav'):null;rows.set(id,r);}return rows.get(id);};
 const handle=id=>{if(!handles.has(id)){const h={dataset:{reportReorder:id},focus(){},setPointerCapture(){},hasPointerCapture:()=>true,releasePointerCapture(){}};h.closest=s=>s==='[data-report-reorder]'?h:s==='.report-section-row'?row(id):null;handles.set(id,h);}return handles.get(id);};
 return {state,h:ctx.h,events,get hash(){return ctx.window.location.hash;},get scrolling(){return !!frame;},get scrollTop(){return node('.system-nav').scrollTop;},tick:()=>frame?.(),pointAt:id=>hit=id?row(id):null,drag:(id,after=false)=>({target:row(id),clientY:after?135:105,preventDefault(){},dataTransfer:{setData(){}}}),pointer:(id,y=105)=>({target:handle(id),pointerId:1,button:0,clientX:100,clientY:y,preventDefault(){}}),key:(id,key)=>({target:handle(id),key,altKey:true,preventDefault(){}})};
}
test('moving a report section preserves all inspection evidence and leaves templates and other reports unchanged',()=>{
 const c=client(),before=structuredClone(c.state),r=c.h.r,id=r.sections[0].id;r.status='final';assert.equal(c.h.move(id,2),true);
 assert.equal(r.sections[2].id,id);assert.equal(c.hash,'#check-section-2');assert.equal(r.status,'draft');assert.equal(c.h.dirty,1);
 for(const s of r.sections)assert.deepEqual(structuredClone(s),before.reports[0].sections.find(old=>old.id===s.id));
 assert.deepEqual(structuredClone(r.findings),before.reports[0].findings);assert.deepEqual(c.state.templates,before.templates);assert.deepEqual(structuredClone(c.state.reports[1]),before.reports[1]);assert.doesNotThrow(()=>validateState(c.state));
 const html=reportHTML(r);assert.ok(html.indexOf('<h3>Exterior</h3>')<html.indexOf('<h3>Structure</h3>'));assert.ok(html.includes('id="check-item-2-0"'));assert.ok(html.includes('id="summary-linked-note"'));assert.ok(html.includes('id="check-finding-linked-note"'));
});
test('HTML drag inserts sections before or after targets in either direction',()=>{
 const c=client(),first=c.h.r.sections[0].id,second=c.h.r.sections[1].id;c.events.get('dragstart')(c.drag(first));c.events.get('dragover')(c.drag(second,true));c.events.get('drop')(c.drag(second,true));assert.deepEqual(c.h.r.sections.slice(0,2).map(s=>s.id),[second,first]);
 c.events.get('dragstart')(c.drag('custom14'));c.events.get('drop')(c.drag(second));assert.equal(c.h.r.sections[0].id,'custom14');c.events.get('dragstart')(c.drag('custom14'));c.events.get('drop')(c.drag(c.h.r.sections.at(-1).id,true));assert.equal(c.h.r.sections.at(-1).id,'custom14');
});
test('pointer dragging and keyboard moves work without HTML drag events and edge scrolling is cancellable',()=>{
 const c=client(),first=c.h.r.sections[0].id,third=c.h.r.sections[2].id;c.events.get('pointerdown')(c.pointer(first));c.pointAt(third);c.events.get('pointermove')(c.pointer(first,135));c.events.get('pointerup')(c.pointer(first,135));assert.equal(c.h.r.sections[2].id,first);
 c.events.get('keydown')(c.key(first,'ArrowUp'));assert.equal(c.h.r.sections[1].id,first);
 const before=JSON.stringify(c.h.r.sections);c.events.get('pointerdown')(c.pointer(first));c.pointAt(third);c.events.get('pointermove')(c.pointer(first,590));c.tick();assert.equal(c.scrollTop,86);assert.equal(c.scrolling,true);c.events.get('keydown')({key:'Escape',preventDefault(){}});assert.equal(c.scrolling,false);c.events.get('pointerup')(c.pointer(first,135));assert.equal(JSON.stringify(c.h.r.sections),before);
});
test('cancelled drags, outside drops, route changes and invalid positions cannot reorder a report',()=>{
 const c=client(),id=c.h.r.sections[0].id,before=JSON.stringify(c.state);
 c.events.get('dragstart')(c.drag(id));c.events.get('dragend')();c.events.get('drop')(c.drag('custom14'));
 c.events.get('dragstart')(c.drag(id));c.events.get('drop')({target:{closest:()=>null}});c.events.get('drop')(c.drag('custom14'));
 c.events.get('pointerdown')(c.pointer(id));c.pointAt('custom14');c.events.get('pointermove')(c.pointer(id,135));c.events.get('pointercancel')(c.pointer(id));c.events.get('pointerup')(c.pointer(id,135));
 c.events.get('dragstart')(c.drag(id));c.h.otherReport();c.events.get('drop')(c.drag('custom14'));
 for(const to of [-1,14,NaN,0])assert.equal(c.h.move('missing',to),false);c.h.changeRoute('templates');assert.equal(c.h.move(id,1),false);assert.equal(JSON.stringify(c.state),before);
});
test('report navigation has square colored drag handles without section numbers or count columns',()=>{
 const c=client(),r=c.h.r;r.sections[0].items.forEach(i=>i.rating='I');const html=c.h.html();assert.ok(!html.includes('class="system-number"'));assert.ok(!html.includes('class="count"'));assert.ok(!html.includes('class="section-progress'));
 assert.equal((html.match(/class="square-grip-icon"/g)||[]).length,r.sections.length);assert.equal((html.match(/<rect /g)||[]).length,r.sections.length*6);assert.match(html,/report-section-handle is-complete/);assert.match(html,/report-section-handle is-incomplete/);assert.ok(html.includes('Reorder Structure'));assert.ok(html.includes('Summaries'));assert.ok(html.includes('Other observations'));
});
test('report section order survives save, backup, restore and restart and controls web export order',async()=>{
 const c=client(),id=c.h.r.sections[0].id;c.h.move(id,3);const base=path.resolve('work/tests');fs.mkdirSync(base,{recursive:true});const dir=fs.mkdtempSync(path.join(base,'report-section-order-'));let app=createApp({dataDir:dir,port:0});
 try{const url=await app.start(),home=await(await fetch(url)).text(),headers={'X-Solo-Token':home.match(/name="solo-token" content="([a-f0-9]+)"/)[1],'Content-Type':'application/json'};
  let response=await fetch(url+'/api/state',{method:'PUT',headers,body:JSON.stringify({revision:0,state:c.state})});assert.equal(response.status,200);
  const backup=await(await fetch(url+'/api/backup',{headers})).json();response=await fetch(url+'/api/restore',{method:'POST',headers,body:JSON.stringify({revision:1,backup})});assert.equal(response.status,200);
  const preview=await(await fetch(url+'/api/reports/report-under-test/html',{headers})).text(),web=await(await fetch(url+'/api/reports/report-under-test/html?download=1',{headers})).text();assert.equal(preview,web);assert.ok(web.indexOf('<h3>Exterior</h3>')<web.indexOf('<h3>Structure</h3>'));
  await app.close();app=createApp({dataDir:dir,port:0});await app.start();assert.deepEqual(app.read().state.reports[0].sections.map(s=>s.id),c.h.r.sections.map(s=>s.id));assert.deepEqual(app.read().state.reports[0].findings,structuredClone(c.h.r.findings));
 }finally{await app.close();}
});
