'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const {seed}=require('../app/seed');

function client(){
 const state=seed(),t=state.templates[0],events=new Map(),nodes=new Map(),rows=new Map();
 t.sections.push({id:'custom14',name:'Custom section 14',disclaimer:'Keep this notice',items:[]},{id:'custom15',name:'Custom section 15',disclaimer:'',items:[]});
 const other=structuredClone(t);other.id='other-template';state.templates.push(other);
 state.reports.push({id:'existing',sections:structuredClone(t.sections),findings:[]});
 const node=key=>{if(!nodes.has(key))nodes.set(key,{content:'test-token',scrollTop:70,style:{},classList:{toggle(){}},addEventListener(){},focus(){},scrollIntoView(){},getBoundingClientRect:()=>({top:0,bottom:800})});return nodes.get(key);};
 const context=vm.createContext({structuredClone,crypto,initialState:state,setTimeout:()=>1,clearTimeout(){},document:{querySelector:node,querySelectorAll:()=>[...rows.values()],getElementById:node,addEventListener:(name,fn)=>events.set(name,fn)},window:{addEventListener(){}}});
 const source=fs.readFileSync(require.resolve('../app/public/app.js'),'utf8');
 vm.runInContext(source.slice(0,source.lastIndexOf('\nboot().catch'))+`
 state=initialState;route='template-editor';currentId=state.templates[0].id;sectionId=state.templates[0].sections[0].id;render=()=>{};
 globalThis.harness={get dirty(){return dirty;},get selected(){return sectionId;},html:()=>renderTemplateSections(template()),newReport:()=>blankReport(template()),move:moveTemplateSection};`,context);
 const row=id=>{if(!rows.has(id)){const classes=new Set(),r={dataset:{templateSection:id},classList:{add:(...names)=>names.forEach(n=>classes.add(n)),remove:(...names)=>names.forEach(n=>classes.delete(n))},getBoundingClientRect:()=>({top:100,height:50,bottom:150})};r.closest=selector=>selector==='.template-section-row'?r:selector==='.template-section-nav'?node('.template-section-nav'):null;rows.set(id,r);}return rows.get(id);};
 const dragEvent=(id,after=false)=>({target:row(id),clientY:after?145:105,preventDefault(){this.prevented=true;},dataTransfer:{setData(){}}});
 return {state,t,h:context.harness,events,dragEvent,click:(id,delta)=>events.get('click')({target:{closest:()=>({dataset:{action:'move-section',id,delta:String(delta)},id:'move-button',isConnected:false})}})};
}

test('row arrows move any section, preserve contents and selection, and leave reports and other templates unchanged',async()=>{
 const c=client(),initial=structuredClone(c.state),id=c.t.sections[0].id;
 await c.click(id,1);assert.equal(c.t.sections[1].id,id);assert.equal(c.h.selected,id);
 await c.click('custom15',-1);assert.equal(c.t.sections.at(-2).id,'custom15');assert.equal(c.h.selected,id);
 assert.deepEqual(c.state.reports,initial.reports);assert.deepEqual(c.state.templates[1],initial.templates[1]);
 for(const section of c.t.sections)assert.deepEqual(section,initial.templates[0].sections.find(s=>s.id===section.id));
 const before=structuredClone(c.t);await c.click(c.t.sections[0].id,-1);await c.click(c.t.sections.at(-1).id,1);await c.click('missing',1);assert.deepEqual(c.t,before);assert.equal(c.h.dirty,2);
});

test('drag and drop inserts before or after a target in both directions, including custom sections',()=>{
 const c=client(),first=c.t.sections[0].id,second=c.t.sections[1].id;
 c.events.get('dragstart')(c.dragEvent(first));c.events.get('dragover')(c.dragEvent(second,true));c.events.get('drop')(c.dragEvent(second,true));
 assert.deepEqual(c.t.sections.slice(0,2).map(s=>s.id),[second,first]);
 c.events.get('dragstart')(c.dragEvent('custom15'));c.events.get('drop')(c.dragEvent(second));assert.equal(c.t.sections[0].id,'custom15');
 c.events.get('dragstart')(c.dragEvent('custom15'));c.events.get('drop')(c.dragEvent('custom14',true));assert.equal(c.t.sections.at(-1).id,'custom15');
 assert.equal(new Set(c.t.sections.map(s=>s.id)).size,c.t.sections.length);assert.equal(c.h.dirty,3);
});

test('cancelled drags, outside drops, same-position drops and invalid positions do not reorder sections',()=>{
 const c=client(),id=c.t.sections[0].id,before=structuredClone(c.t);
 c.events.get('dragstart')(c.dragEvent(id));c.events.get('dragend')();c.events.get('drop')(c.dragEvent('custom15'));
 c.events.get('dragstart')(c.dragEvent(id));c.events.get('drop')(c.dragEvent(id,true));
 c.h.move(id,NaN);c.h.move(id,-1);c.h.move(id,c.t.sections.length);c.h.move('missing',0);
 assert.deepEqual(c.t,before);assert.equal(c.h.dirty,0);
});

test('new reports inherit reordered sections with blank statuses while existing reports retain their snapshots',async()=>{
 const c=client(),old=structuredClone(c.state.reports[0]);
 await c.click('custom15',-1);c.h.move('custom15',0);
 const report=c.h.newReport();assert.deepEqual(report.sections.map(s=>s.id),c.t.sections.map(s=>s.id));
 assert.ok(report.sections.flatMap(s=>s.items).every(i=>i.rating===''));assert.notEqual(report.sections,c.t.sections);assert.deepEqual(c.state.reports[0],old);
});

test('all section rows expose drag handles and named arrows with only the boundary directions disabled',()=>{
 const c=client(),html=c.h.html();assert.equal((html.match(/draggable="true"/g)||[]).length,c.t.sections.length);assert.equal((html.match(/data-action="move-section"/g)||[]).length,c.t.sections.length*2);
 assert.match(html,/aria-label="Move Structure up" disabled/);assert.match(html,/aria-label="Move Custom section 15 down" disabled/);
 assert.equal((html.match(/ disabled/g)||[]).length,2);assert.match(html,/Drag a section up or down/);
});
