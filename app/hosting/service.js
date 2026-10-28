'use strict';
const {randomBytes}=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
const {packageReport}=require('./package');
function fail(message,status=400){throw Object.assign(new Error(message),{status});}
function endpoint(value){
  let url;try{url=new URL(value);}catch{fail('Enter your HTTPS workers.dev address.');}
  if(url.protocol!=='https:'||url.port||url.username||url.password||url.search||url.hash||url.pathname!=='/'||!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.workers\.dev$/.test(url.hostname))fail('Use only the HTTPS address of your Worker, ending in workers.dev, without a report path.');
  return url.origin;
}
function createHosting({db,protect,read,renderHTML,fetchImpl=fetch}){
  // Separate tables intentionally stay outside report saves and portable backups.
  db.exec('CREATE TABLE IF NOT EXISTS hosting_settings (id INTEGER PRIMARY KEY CHECK(id=1), json TEXT NOT NULL); CREATE TABLE IF NOT EXISTS hosting_publications (id TEXT PRIMARY KEY, json TEXT NOT NULL);');
  let busy=false;
  const settings=()=>JSON.parse(db.prepare('SELECT json FROM hosting_settings WHERE id=1').get()?.json||'{"enabled":false,"endpoint":"","encryptedKey":""}');
  const records=()=>db.prepare('SELECT json FROM hosting_publications').all().map(row=>JSON.parse(row.json));
  const put=record=>db.prepare('INSERT OR REPLACE INTO hosting_publications VALUES (?,?)').run(record.id,JSON.stringify(record));
  const get=id=>{const row=db.prepare('SELECT json FROM hosting_publications WHERE id=?').get(id);if(!row)fail('Web publication not found.',404);return JSON.parse(row.json);};
  const active=()=>records().some(record=>record.status!=='unpublished'||record.cleaned===false);
  const visible=record=>({...record,url:record.status==='published'?record.endpoint+'/r/'+record.id+'/':null});
  function localState(){
    const cfg=settings();return {configured:!!(cfg.endpoint&&cfg.encryptedKey),enabled:cfg.enabled===true,endpoint:cfg.endpoint,hasKey:!!cfg.encryptedKey,protocol:'1',busy,publications:records().map(visible)};
  }
  function saveSettings(body){
    if(busy)fail('Wait for the current hosting operation.',409);
    const old=settings(),next={...old,enabled:body.enabled===true};
    if(typeof body.endpoint!=='string')fail('Enter your Worker address.');
    next.endpoint=body.endpoint.trim()?endpoint(body.endpoint.trim()):'';
    if(next.endpoint!==old.endpoint&&active())fail('Terminate existing web publications before changing the Worker address.',409);
    if(body.clearKey===true){if(active())fail('Terminate existing web publications before removing the publishing key.',409);next.encryptedKey='';}
    else if(body.key){if(typeof body.key!=='string'||!/^[a-f0-9]{64}$/.test(body.key.trim()))fail('Use the 64-character publishing key configured as HOMEKANBAN_PUBLISH_KEY.');next.encryptedKey=protect(body.key.trim());}
    else if(next.endpoint!==old.endpoint)next.encryptedKey='';
    if(next.enabled&&(!next.endpoint||!next.encryptedKey))fail('Save a Worker address and publishing key before enabling uploads.');
    db.prepare('INSERT OR REPLACE INTO hosting_settings VALUES (1,?)').run(JSON.stringify(next));return localState();
  }
  async function remote(cfg,route,method='GET',body){
    if(!cfg.endpoint||!cfg.encryptedKey)fail('Connect your Worker in AI & settings → Publish a web report first.');
    const key=protect(cfg.encryptedKey,true);
    let response;
    try{
      response=await fetchImpl(endpoint(cfg.endpoint)+route,{method,redirect:'error',signal:AbortSignal.timeout(60000),headers:{Authorization:'Bearer '+key,...(body?{'Content-Type':Buffer.isBuffer(body)?'application/octet-stream':'application/json'}:{})},body:body?(Buffer.isBuffer(body)?body:JSON.stringify(body)):undefined});
    }catch{fail('Could not contact your Worker. The cloud status may have changed; use Check status or Terminate before trying again.',502);}
    let text='';
    if(response.body){
      const reader=response.body.getReader();let size=0;const chunks=[];
      try{for(;;){const next=await reader.read();if(next.done)break;size+=next.value.length;if(size>1024*1024){await reader.cancel();fail('Unexpected hosting response.',502);}chunks.push(Buffer.from(next.value));}}finally{reader.releaseLock();}
      text=Buffer.concat(chunks).toString('utf8');
    }
    let value;try{value=JSON.parse(text);}catch{fail('This Worker is still running the example or an incompatible program. Install the HomeKanban Worker code first.',502);}
    if(!response.ok){
      if(response.status===401)fail('The publishing key does not match HOMEKANBAN_PUBLISH_KEY in your Worker.',401);
      if(response.status===429)fail('Cloudflare is limiting requests. Wait and use Check status before retrying.',429);
      fail('The Worker could not complete the operation (HTTP '+response.status+'). Check its R2 binding, deployment and limits.',502);
    }
    return value;
  }
  async function lock(operation){
    if(busy)fail('Another hosting operation is in progress. Please wait.',409);
    busy=true;try{return await operation();}finally{busy=false;}
  }
  async function connection(){
    return lock(async()=>{
      const value=await remote(settings(),'/api/v1/connection');
      if(value.service!=='HomeKanban'||value.protocol!=='1'||value.storage!=='connected')fail('The Worker code or R2 binding is not ready.',502);
      return {ok:true,message:'Connected. Your private R2 storage is ready.'};
    });
  }
  function updateRemote(record,value){
    if(value.status==='published')record.status='published';
    else if(value.status==='revoked'){record.status='unpublished';record.cleaned=record.cleaned===true;}
    else record.status='uncertain';
    record.checked=new Date().toISOString();put(record);return visible(record);
  }
  async function check(id){
    return lock(async()=>{
      const record=get(id),cfg=settings();
      if(record.endpoint!==cfg.endpoint)fail('Reconnect the Worker used for this publication.');
      try{return updateRemote(record,await remote(cfg,'/api/v1/publications/'+record.id));}
      catch(error){record.status='uncertain';put(record);throw error;}
    });
  }
  async function terminate(id){
    return lock(async()=>{
      const record=get(id),cfg=settings();
      if(record.endpoint!==cfg.endpoint)fail('Reconnect the Worker used for this publication.');
      record.status='terminating';put(record);
      try{
        const result=await remote(cfg,'/api/v1/publications/'+id,'DELETE');
        if(result.status!=='revoked')fail('Termination has not been confirmed.',502);
        const confirmed=await remote(cfg,'/api/v1/publications/'+id);
        if(confirmed.status!=='revoked')fail('Termination has not been confirmed.',502);
        record.status='unpublished';record.cleaned=result.cleaned===true;record.checked=new Date().toISOString();put(record);
        return visible(record);
      }catch(error){record.status='uncertain';put(record);throw error;}
    });
  }
  async function publish(reportId,revision){
    return lock(async()=>{
      const cfg=settings();if(!cfg.enabled)fail('Enable Allow report uploads in AI & settings → Publish a web report first.');
      if(!cfg.endpoint||!cfg.encryptedKey)fail('Configure your Worker and publishing key first.');
      const snapshot=read();
      if(snapshot.revision!==revision)fail('The report changed in another window. Refresh and review it before publishing.',409);
      const report=snapshot.state.reports.find(report=>report.id===reportId);if(!report)fail('Report not found.',404);
      const previous=records().find(record=>record.reportId===reportId&&record.status!=='unpublished');
      if(previous)fail('This report already has a publication or an uncertain attempt. Check its status or terminate it first.',409);
      const bundle=packageReport(report,renderHTML),record={id:randomBytes(32).toString('hex'),reportId,endpoint:cfg.endpoint,label:report.address||'Untitled report',snapshot:bundle.snapshot,status:'publishing',created:new Date().toISOString(),cleaned:false};
      put(record); // Persist the intent before any external request, including across restart.
      try {
        const base='/api/v1/publications/'+record.id;
        const ready=await remote(cfg,base,'POST',bundle.manifest);
        if(ready.status!=='staging')fail('The Worker did not accept the report upload.',502);
        for(const file of bundle.files){
          const uploaded=await remote(cfg,base+'/files/'+file.name,'PUT',file.body);
          if(uploaded.uploaded!==file.name)fail('The Worker did not confirm a report file.',502);
        }
        const committed=await remote(cfg,base+'/commit','POST',{});
        if(committed.status!=='published')fail('Publication has not been confirmed.',502);
        const confirmed=await remote(cfg,base);
        if(confirmed.status!=='published')fail('Publication has not been confirmed.',502);
        record.status='published';record.checked=new Date().toISOString();put(record);return visible(record);
      } catch(error){record.status='uncertain';put(record);throw error;}
    });
  }
  async function recover(cursor){
    return lock(async()=>{
      const cfg=settings();if(cursor!==undefined&&typeof cursor!=='string')fail('Invalid cursor.');
      const page=await remote(cfg,'/api/v1/publications'+(cursor?'?cursor='+encodeURIComponent(cursor):''));
      if(!Array.isArray(page.records)||page.records.length>20||(page.cursor!=null&&(typeof page.cursor!=='string'||page.cursor.length>4096)))fail('Unexpected hosting response.',502);
      for(const item of page.records){
        if(!/^[a-f0-9]{64}$/.test(item.id))fail('Unexpected hosting response.',502);
        let record=records().find(record=>record.id===item.id);
        if(!record){record={id:item.id,reportId:null,endpoint:cfg.endpoint,label:'Recovered web report',created:item.created||new Date().toISOString(),status:'uncertain',cleaned:false};}
        if(record.endpoint!==cfg.endpoint)continue;
        updateRemote(record,item);
      }
      return {cursor:page.cursor||null,...localState()};
    });
  }
  async function handle(route,method,body,send){
    if(!route.startsWith('/api/hosting'))return false;
    if(route==='/api/hosting'&&method==='GET')send(200,localState());
    else if(route==='/api/hosting/settings'&&method==='PUT')send(200,saveSettings(body));
    else if(route==='/api/hosting/new-key'&&method==='POST')send(200,{key:randomBytes(32).toString('hex')});
    else if(route==='/api/hosting/connection'&&method==='POST')send(200,await connection());
    else if(route==='/api/hosting/recover'&&method==='POST')send(200,await recover(body.cursor));
    else if(route==='/api/hosting/worker'&&method==='GET')send(200,fs.readFileSync(path.join(__dirname,'worker.mjs'),'utf8'),'text/javascript; charset=utf-8',{'Content-Disposition':'attachment; filename="homekanban-worker.js"'});
    else {
      let match=route.match(/^\/api\/hosting\/reports\/([a-zA-Z0-9-]+)\/publish$/);
      if(match&&method==='POST')send(200,await publish(match[1],body.revision));
      else {
        match=route.match(/^\/api\/hosting\/publications\/([a-f0-9]{64})\/(check|terminate)$/);
        if(!match||method!=='POST')fail('Hosting endpoint not found.',404);
        send(200,await (match[2]==='check'?check(match[1]):terminate(match[1])));
      }
    }
    return true;
  }
  return {handle,localState,saveSettings,publish,terminate,check,connection,recover,get busy(){return busy;}};
}
module.exports={createHosting,endpoint};
