'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const {seed}=require('../app/seed');
function client(){
 const state=seed(),events=new Map(),nodes=new Map();state.reports.push({id:'existing',sections:structuredClone(state.templates[0].sections)});
 const node=key=>{if(!nodes.has(key))nodes.set(key,{content:'test-token',id:key.slice(1),dataset:{},value:'',style:{},classList:{toggle(){}},addEventListener(){},focus(){this.focused=true;},setAttribute(k,v){this[k]=v;},removeAttribute(k){delete this[k];},showModal(){this.open=true;},close(){this.open=false;}});return nodes.get(key);};
 const context=vm.createContext({initialState:state,structuredClone,crypto,setTimeout:()=>1,clearTimeout(){},prompt(){throw Error('prompt() is not supported');},document:{querySelector:node,addEventListener:(name,fn)=>events.set(name,fn)},window:{addEventListener(){}}});
 const source=fs.readFileSync(require.resolve('../app/public/app.js'),'utf8');
 vm.runInContext(source.slice(0,source.lastIndexOf('\nboot().catch'))+`
 state=initialState;route='template-editor';currentId=state.templates[0].id;sectionId=state.templates[0].sections[0].id;
 let stored=null;render=()=>{};saveNow=async()=>{stored=clone(state);saved=dirty;};
 globalThis.h={get selected(){return sectionId;},get stored(){return stored;},get dirty(){return dirty;},newReport:()=>blankReport(template()),open:addSectionDialog};`,context);
 const form=node('#add-section-form');form.dataset.templateId=state.templates[0].id;
 const click=action=>events.get('click')({target:{closest:()=>({dataset:{action},isConnected:false})}});
 const submit=name=>{node('#new-section-name').value=name;return events.get('submit')({target:form,preventDefault(){}});};
 return {state,h:context.h,form,node,click,submit};
}
test('Add section opens an in-app form even when browser prompts are unsupported; Cancel leaves the template intact',async()=>{
 const c=client(),before=structuredClone(c.state);await c.click('add-section');assert.equal(c.node('#dialog').open,true);assert.match(c.node('#dialog-content').innerHTML,/form id="add-section-form"/);assert.equal(c.node('#new-section-name').focused,true);
 c.node('#new-section-name').value='Cancelled section';await c.click('close-dialog');assert.equal(c.node('#dialog').open,false);assert.deepEqual(c.state,before);assert.equal(c.h.dirty,0);
});
test('blank names, overlong names, stale forms and the section limit cannot alter the template',async()=>{
 const c=client(),before=structuredClone(c.state);await c.click('add-section');
 for(const name of ['', '   ', 'x'.repeat(301)]){await c.submit(name);assert.ok(c.node('#add-section-error').textContent);assert.deepEqual(c.state,before);assert.equal(c.node('#dialog').open,true);}
 c.form.dataset.templateId='another-template';await c.submit('Valid name');assert.deepEqual(c.state,before);assert.match(c.node('#add-section-error').textContent,/template has changed/);
 const t=c.state.templates[0];c.form.dataset.templateId=t.id;while(t.sections.length<100)t.sections.push({id:crypto.randomUUID(),name:'Test section',disclaimer:'',items:[]});await c.submit('One too many');assert.equal(t.sections.length,100);assert.match(c.node('#add-section-error').textContent,/100/);assert.throws(()=>c.h.open(),/100/);
});
test('submitting adds and selects one section, saves it, and includes it only in new reports',async()=>{
 const c=client(),before=structuredClone(c.state),t=c.state.templates[0];await c.click('add-section');await c.submit('  Pool & Spa  ');await c.submit('Duplicate submission');
 assert.equal(t.sections.length,before.templates[0].sections.length+1);const section=t.sections.at(-1);assert.equal(section.name,'Pool & Spa');assert.equal(section.disclaimer,'');assert.equal(section.items.length,0);assert.equal(c.h.selected,section.id);assert.equal(c.node('#dialog').open,false);assert.deepEqual(c.h.stored,structuredClone(c.state));
 assert.deepEqual(c.state.reports,before.reports);assert.equal(c.h.newReport().sections.at(-1).name,'Pool & Spa');assert.equal(c.h.dirty,1);
});
