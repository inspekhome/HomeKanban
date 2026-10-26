'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createApp}=require('../app/server');

test('an open server uses updated renderer files for preview, web download and PDF without a restart',async()=>{
 const root=fs.mkdtempSync(path.resolve('work/export-update-test-')),copy=path.join(root,'app'),dataDir=path.join(root,'data');
 fs.cpSync(path.resolve('app'),copy,{recursive:true});
 const app=require(path.join(copy,'server')).createApp({dataDir,port:0});
 try{
  const url=await app.start(),home=await(await fetch(url)).text(),token=home.match(/name="solo-token" content="([a-f0-9]+)"/)[1];
  const request=(route,method='GET',body)=>fetch(url+route,{method,headers:{'X-Solo-Token':token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  const data=app.read(),t=data.state.templates[0];
  const report={id:'sync-report',address:'TEST ONLY',client:'Test',date:'2026-10-24',time:'',weather:'',email:'',phone:'',notes:'',scope:'Test only',notice:t.notice,status:'draft',inspector:{...data.state.profile,name:'Test'},sections:structuredClone(t.sections),findings:[{id:'first',origin:'summary',location:'',text:'Latest saved observation.',category:'Defect/Action Needed',includeInSummary:true,photos:[]}]};
  report.sections[0].items.forEach((item,index)=>item.rating=['I','NI','NP','D'][index]);
  const editorCSS=fs.readFileSync(path.join(copy,'public/style.css'),'utf8');
  const checkStatusColors=html=>{
   for(const code of ['I','NI','NP','D']){
    const color=editorCSS.match(new RegExp('\\.section-rating\\.'+code+'\\.active\\{background:(#[a-f0-9]+);'))?.[1];
    assert.ok(color,'Editor must define the selected '+code+' color');
    assert.ok(html.includes('.status-box.checked[data-rating="'+code+'"]{background:'+color+';border-color:'+color+'}'),'Exported '+code+' must match the editor');
    assert.ok(html.includes('class="status-box checked" data-rating="'+code+'" role="img" aria-label="'+code+': selected"'),'Export must mark the recorded '+code+' selection');
   }
   assert.ok(html.includes('print-color-adjust:exact'));
  };
  data.state.reports.push(report);
  assert.equal((await request('/api/state','PUT',data)).status,200);
  const initial=await(await request('/api/reports/sync-report/html')).text();
  assert.ok(initial.includes('<ol class="summary-list">'));
  const file=path.join(copy,'report.js'),original=fs.readFileSync(file,'utf8');
  const update=marker=>fs.writeFileSync(file,original.replace('<main>','<main data-update="'+marker+'">'));
  update('A');
  assert.ok((await(await request('/api/reports/sync-report/html')).text()).includes('data-update="A"'));
  // An update with the same file size and timestamp must still take effect.
  const stat=fs.statSync(file);update('B');fs.utimesSync(file,stat.atime,stat.mtime);
  const latest=app.read();latest.state.reports[0].findings[0].text='Saved after the template update.';
  assert.equal((await request('/api/state','PUT',latest)).status,200);
  for(const route of ['/html','/html?download=1']){
   const response=await request('/api/reports/sync-report'+route),html=await response.text();
   assert.equal(response.status,200);assert.ok(html.includes('data-update="B"'));assert.ok(!html.includes('data-update="A"'));
   assert.ok(html.includes('Saved after the template update.'));assert.ok(!html.includes('Latest saved observation.'));
   assert.equal(response.headers.get('cache-control'),'no-store');
   checkStatusColors(html);
  }
  const pdf=await request('/api/reports/sync-report/pdf');assert.equal(pdf.status,200);
  const bytes=Buffer.from(await pdf.arrayBuffer());assert.equal(bytes.subarray(0,5).toString(),'%PDF-');
  const exported=fs.readdirSync(path.join(dataDir,'exports')).map(dir=>fs.readFileSync(path.join(dataDir,'exports',dir,'report.html'),'utf8'));
  assert.equal(exported.length,1);assert.ok(exported[0].includes('data-update="B"'));assert.ok(exported[0].includes('Saved after the template update.'));
  checkStatusColors(exported[0]);
  // A failed update must fail visibly, rather than silently serving an older layout.
  fs.writeFileSync(file,'this is invalid javascript');
  assert.equal((await request('/api/reports/sync-report/html')).status,500);
  update('C');assert.ok((await(await request('/api/reports/sync-report/html')).text()).includes('data-update="C"'));
 }finally{await app.close();}
});

test('a controlled update preserves the existing session and data while normal restarts rotate sessions',async()=>{
 const dataDir=fs.mkdtempSync(path.resolve('work/session-handoff-test-')),sessionToken='ab'.repeat(32);
 let app=createApp({dataDir,port:0,sessionToken}),url=await app.start();
 const headers={'X-Solo-Token':sessionToken};
 try{
  const before=app.read();before.state.profile.name='Preserved inspector';
  assert.equal((await fetch(url+'/api/state',{method:'PUT',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(before)})).status,200);
  const saved=app.read();await app.close();app=createApp({dataDir,port:0,sessionToken});url=await app.start();
  assert.deepEqual(await(await fetch(url+'/api/backup',{headers})).json().then(x=>({revision:x.revision,state:x.state})),saved);
  assert.equal((await fetch(url+'/api/state',{headers:{Cookie:'solo_session='+sessionToken}})).status,200);
  assert.equal((await fetch(url+'/api/state',{headers:{...headers,Origin:'https://untrusted.invalid'}})).status,403);
  await app.close();app=createApp({dataDir,port:0});url=await app.start();
  assert.equal((await fetch(url+'/api/state',{headers})).status,401);
  assert.deepEqual(app.read(),saved);
 }finally{await app.close();}
});
