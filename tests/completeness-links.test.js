'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {seed}=require('../app/seed'),{issues,issueDetails}=require('../app/report'),{createApp}=require('../app/server');
function fixture(){
 const state=seed(),template=state.templates[0],sections=structuredClone(template.sections),roof=sections.find(s=>s.name==='Roof');
 for(const s of sections)for(const i of s.items)i.rating='I';
 const r={id:'check-demo',address:'DEMONSTRATION',client:'Demo Client',date:'2026-10-25',email:'',phone:'',time:'',weather:'',notes:'',scope:'Software demonstration only.',notice:template.notice,status:'draft',inspector:{...state.profile,name:'Demo Inspector'},sections,findings:[
  {id:'summary-empty',origin:'summary',location:'',text:'',category:'Notes',photos:[],includeInSummary:true},
  {id:'roof-empty',origin:'checklist',sectionId:roof.id,itemId:roof.items[0].id,location:'Roof access',text:'',category:'Notes',photos:[],includeInSummary:false}
 ]};state.reports.push(r);return {state,r};
}
function client(state){
 const nodes=new Map(),opened=[],notices=[];
 function node(id){if(!nodes.has(id))nodes.set(id,{id,content:'test-token',addEventListener(){},focus(){this.focused=true;},scrollIntoView(){this.scrolled=true;},querySelector:s=>node(id+' '+s)});return nodes.get(id);}
 const c=vm.createContext({document:{querySelector:node,getElementById:id=>nodes.get(id),addEventListener(){}},window:{addEventListener(){}},fetch:()=>new Promise(()=>{}),setTimeout,clearTimeout,structuredClone});
 vm.runInContext(fs.readFileSync(path.resolve('app/public/app.js'),'utf8'),c);
 c.fixture=state;c.openNote=(...args)=>opened.push(args);c.toast=message=>notices.push(message);
 vm.runInContext("state=fixture;route='editor';currentId=fixture.reports[0].id;",c);
 return {c,node,nodes,opened,notices};
}
test('identical narrative errors retain distinct note IDs, including notes outside summaries',()=>{
 const {r}=fixture(),details=issueDetails(r);assert.deepEqual(issues(r),details.map(d=>d.message));assert.deepEqual(details.map(d=>d.findingId),['summary-empty','roof-empty']);
 const {c}=client({reports:[r]});const html=c.renderCompletenessIssues({issues:issues(r),issueDetails:details},r);
 assert.match(html,/href="#finding-summary-empty"/);assert.match(html,/href="#check-finding-roof-empty"/);assert.match(html,/Note #01 · Summary note/);assert.match(html,/Note #02 · Roof/);
});
test('field, inspector, missing status and NI errors point to their exact controls after section reordering',()=>{
 const {state,r}=fixture();r.address='';r.client='';r.date='';r.scope='';r.inspector.name='';r.sections[0].items[0].rating='';r.sections[0].items[1].rating='NI';
 const details=issueDetails(r),{c}=client(state);
 for(const field of ['address','client','date','scope'])assert.equal(c.completenessTarget(r,details.find(d=>d.field===field)).anchor,'report-field-'+field);
 assert.equal(c.completenessTarget(r,details.find(d=>d.kind==='inspector')).anchor,'report-inspector');
 const status=details.find(d=>d.kind==='item'&&d.field==='rating'),limitation=details.find(d=>d.field==='limitation');
 const section=r.sections.shift();r.sections.push(section);section.items.reverse();
 const si=r.sections.length-1;assert.equal(c.completenessTarget(r,status).anchor,`check-item-${si}-${section.items.length-1}`);assert.equal(c.completenessTarget(r,limitation).focus,'[data-item-field="limitation"]');
});
test('selecting a missing narrative opens only that existing note and focuses its narrative',()=>{
 const {state,r}=fixture(),{c,node,opened}=client(state),details=issueDetails(r);node('check-finding-roof-empty');node('#note-text');
 assert.equal(c.followCompletenessIssue(details[1]),true);assert.equal(opened.length,1);assert.equal(opened[0][0],'roof-empty');assert.equal(opened[0][3],'check-finding-roof-empty');assert.equal(node('#note-text').focused,true);assert.equal(node('#note-text').scrolled,true);
});
test('stale note targets never create a new empty note',()=>{
 const {state,r}=fixture(),{c,opened,notices}=client(state),detail=issueDetails(r)[1];r.findings.pop();assert.equal(c.followCompletenessIssue(detail),false);assert.equal(opened.length,0);assert.match(notices[0],/Click Mark finalized again/);
});
test('NI targets focus the limitation input rather than change its inspection status',()=>{
 const {state,r}=fixture();r.sections[0].items[0].rating='NI';const {c,node}=client(state),detail=issueDetails(r).find(d=>d.field==='limitation');const row=node('check-item-0-0');
 c.followCompletenessIssue(detail);assert.equal(row.scrolled,true);assert.equal(node('check-item-0-0 [data-item-field="limitation"]').focused,true);assert.equal(r.sections[0].items[0].rating,'NI');assert.equal(r.sections[0].items[0].limitation,'');
});
test('link text is escaped, old responses still display, and corrected reports have no issue links',()=>{
 const {state,r}=fixture(),{c}=client(state);r.findings[0].location='<img src=x onerror=alert(1)>';const details=issueDetails(r),html=c.renderCompletenessIssues({issues:issues(r),issueDetails:details},r);assert.ok(!html.includes('<img'));assert.ok(html.includes('&lt;img'));
 assert.match(c.renderCompletenessIssues({issues:['Older result']},r),/<li>Older result<\/li>/);
 for(const f of r.findings)f.text='Observation entered.';const complete=c.renderCompletenessIssues({issues:issues(r),issueDetails:issueDetails(r)},r);assert.match(complete,/Completeness check passed/);assert.ok(!complete.includes('issue-link'));
});
test('HTTP check returns compatible messages and stable IDs without changing report data',async()=>{
 const {state,r}=fixture(),dataDir=fs.mkdtempSync(path.resolve('work/completeness-api-')),app=createApp({dataDir,port:0});app.db.prepare('UPDATE documents SET json=? WHERE id=1').run(JSON.stringify(state));
 try{
  const url=await app.start(),home=await(await fetch(url)).text(),token=home.match(/name="solo-token" content="([a-f0-9]+)"/)[1],before=app.read();const response=await fetch(url+'/api/reports/'+r.id+'/check',{headers:{'X-Solo-Token':token}});assert.equal(response.status,200);const result=await response.json();assert.deepEqual(result.issues,issues(r));assert.deepEqual(result.issueDetails,issueDetails(r));assert.deepEqual(app.read(),before);
 }finally{await app.close();}
});
