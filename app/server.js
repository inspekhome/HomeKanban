'use strict';
// Node 24+, no npm packages. All application resources are served from loopback.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {DatabaseSync}=require('node:sqlite');
const {randomBytes,randomUUID}=require('node:crypto');
const {spawn,spawnSync}=require('node:child_process');
const {seed,categories,ratings}=require('./seed');
const currentReport=require('./report-loader').createReportLoader();
const reportHTML=r=>currentReport().reportHTML(r),issues=r=>currentReport().issues(r),issueDetails=r=>currentReport().issueDetails(r);
const {migrateState}=require('./migrate');
const {legacyRatings}=require('./ratings');
const Wording=require('./public/wording');
const {readFrontendAsset}=require('./frontend');
const {defaultDataDirectory,databasePath}=require('./storage');
const {exportPDF}=require('./pdf-export');
const {DEFAULT_AI_INSTRUCTIONS,normalizeAIInstructions,aiMessages}=require('./ai');
const Voice=require('./voice');
const PUBLIC=path.join(__dirname,'public');
const WorkspaceLimits=require('./public/workspace-limits');
const MAX_BODY=WorkspaceLimits.MAX_REQUEST_BYTES;
function fail(message,status=400){const e=new Error(message);e.status=status;throw e;}
function validateState(s){
 if(!s||s.schema!==2||!s.profile||!Array.isArray(s.templates)||!s.templates.length||!Array.isArray(s.reports))fail('Invalid HomeKanban backup or data format.');
 const string=(x,max=100000)=>{if(typeof x!=='string'||x.length>max)fail('A text field is invalid or too long.');};
 const ids=new Set();const id=x=>{string(x,100);if(!/^[a-zA-Z0-9-]+$/.test(x)||ids.has(x))fail('An identifier is invalid or duplicated.');ids.add(x);};
 const profile=p=>{for(const k of ['name','business','license','email','phone','address','website'])string(p[k]);string(p.logo,12e6);};profile(s.profile);
 function sections(rows){if(!Array.isArray(rows)||!rows.length||rows.length>100)fail('Use between 1 and 100 sections.');const local=new Set();for(const sec of rows){string(sec.id,100);if(local.has(sec.id))fail('Duplicate section ID.');local.add(sec.id);string(sec.name,300);string(sec.disclaimer);if(!Array.isArray(sec.items)||sec.items.length>300)fail('Invalid component data.');for(const i of sec.items){string(i.id,100);if(local.has(i.id))fail('Duplicate component ID.');local.add(i.id);string(i.name,300);string(i.note);string(i.limitation);if(!Array.isArray(i.options)||!Array.isArray(i.selected)||i.options.length>100||i.selected.length>100)fail('Invalid choices.');[...i.options,...i.selected].forEach(x=>string(x,500));if(i.choiceTypes!==undefined){if(!i.choiceTypes||typeof i.choiceTypes!=='object'||Array.isArray(i.choiceTypes)||Object.keys(i.choiceTypes).length>100)fail('Invalid choice colors.');for(const [label,kind] of Object.entries(i.choiceTypes)){string(label,500);if(!i.options.includes(label)||!['description','normal','concern'].includes(kind))fail('Invalid choice color.');}}if(i.rating!==''&&!Object.hasOwn(ratings,i.rating))fail('Invalid inspection status.');if(i.legacyRating!==undefined){if(!i.legacyRating||!Object.hasOwn(legacyRatings,i.legacyRating.code)||i.legacyRating.label!==legacyRatings[i.legacyRating.code])fail('Invalid previous classification.');}}}}
 if(s.templates.length>100||s.reports.length>2000)fail('This workspace exceeds the record limit supported by this version.');
 if(s.noteLibrary!==undefined){try{Wording.validateFastNotes(s.noteLibrary);}catch(error){fail(error.message);}const commonIds=new Set();for(const n of s.noteLibrary){string(n.id,100);if(!/^[a-zA-Z0-9-]+$/.test(n.id)||commonIds.has(n.id))fail('Invalid or duplicate common note ID.');commonIds.add(n.id);string(n.title,300);string(n.text);Wording.validate(n);if(n.system!==undefined)string(n.system,100);if(n.topic!==undefined)string(n.topic,300);if(!n.title.trim()||!n.text.trim()||!categories.includes(n.category))fail('Invalid common note content.');}}
 for(const t of s.templates){id(t.id);string(t.name,300);string(t.notice);string(t.scope);Wording.validateScope(t);sections(t.sections);}
 for(const r of s.reports){id(r.id);for(const k of ['client','address','email','phone','date','time','weather','notes','notice','scope'])string(r[k]);Wording.validateScope(r);if(!['draft','final'].includes(r.status))fail('Invalid report status.');profile(r.inspector);sections(r.sections);if(!Array.isArray(r.findings)||r.findings.length>2000)fail('Invalid findings list.');const findingIds=new Set();for(const f of r.findings){string(f.id,100);if(findingIds.has(f.id))fail('Duplicate finding ID.');findingIds.add(f.id);if(f.sectionId!==undefined||f.itemId!==undefined){string(f.sectionId,100);string(f.itemId,100);const section=r.sections.find(sec=>sec.id===f.sectionId);if(!section?.items.some(i=>i.id===f.itemId))fail('The finding must link to a component in this report.');}if(!/^[a-zA-Z0-9-]+$/.test(f.id))fail('Invalid finding ID.');string(f.location);string(f.text);Wording.validate(f);if(f.origin!==undefined&&!['summary','checklist'].includes(f.origin))fail('Invalid note origin.');if(f.origin==='summary'&&(f.sectionId!==undefined||f.itemId!==undefined||f.includeInSummary===false))fail('Summary notes must stay in the summaries without a checklist link.');if(f.includeInSummary!==undefined&&typeof f.includeInSummary!=='boolean')fail('Invalid summary inclusion setting.');if(!categories.includes(f.category))fail('Invalid finding category.');if(!Array.isArray(f.photos)||f.photos.length>30)fail('Each finding supports up to 30 photos.');for(const ph of f.photos){string(ph.caption,2000);if(typeof ph.src!=='string'||ph.src.length>12e6||!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(ph.src))fail('Invalid photo format.');}}if(r.status==='final'&&issues(r).length)fail('This report has incomplete items and cannot be finalized.');}
 return s;
}
function dpapi(value,decrypt=false){
 if(process.platform!=='win32')fail('Secure API key storage requires Windows. The app can be used without an API key.');
 const script=`$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.Security; $v=[Console]::In.ReadToEnd(); ${decrypt?"$b=[Convert]::FromBase64String($v); $o=[Security.Cryptography.ProtectedData]::Unprotect($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Write([Text.Encoding]::UTF8.GetString($o))":"$b=[Text.Encoding]::UTF8.GetBytes($v); $o=[Security.Cryptography.ProtectedData]::Protect($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Write([Convert]::ToBase64String($o))"}`;
 const result=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{input:value,encoding:'utf8',windowsHide:true,timeout:15000});
 if(result.status!==0)fail('Windows key encryption or decryption failed. The key was not saved.');return result.stdout.trim();
}
function findBrowser(){const candidates=[process.env.HOMEKANBAN_BROWSER,process.env.SOLOINSPECT_BROWSER,path.join(process.env['PROGRAMFILES(X86)']||'C:/Program Files (x86)','Microsoft/Edge/Application/msedge.exe'),path.join(process.env.PROGRAMFILES||'C:/Program Files','Microsoft/Edge/Application/msedge.exe'),path.join(process.env.PROGRAMFILES||'C:/Program Files','Google/Chrome/Application/chrome.exe')];return candidates.find(p=>p&&fs.existsSync(p));}
async function makePDF(r,dir){
 return exportPDF(reportHTML(r),dir);
}
function createApp({dataDir=defaultDataDirectory(),port=Number(process.env.HOMEKANBAN_PORT||process.env.SOLOINSPECT_PORT||38473),sessionToken,hostingFetch}={}){
 const db=new DatabaseSync(databasePath(dataDir));db.exec('PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS documents (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, json TEXT NOT NULL); CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY CHECK(id=1), json TEXT NOT NULL);');
 if(!db.prepare('SELECT id FROM documents WHERE id=1').get())db.prepare('INSERT INTO documents VALUES (1,0,?)').run(JSON.stringify(seed()));
 // A controlled update may hand off the existing session to keep open editors usable.
 if(sessionToken!==undefined&&!/^[a-f0-9]{64}$/.test(sessionToken))throw new Error('Invalid session handoff.');
 const token=sessionToken||randomBytes(32).toString('hex');let pdfBusy=false,aiBusy=false,voiceBusy=false,closing=false,closePromise;
 const read=()=>{const row=db.prepare('SELECT * FROM documents WHERE id=1').get();return {revision:row.revision,state:JSON.parse(row.json)};};
 const settings=()=>{const row=db.prepare('SELECT json FROM settings WHERE id=1').get();const cfg=row?JSON.parse(row.json):{endpoint:'https://api.openai.com/v1/chat/completions',model:'',encryptedKey:''};return {...cfg,instructions:typeof cfg.instructions==='string'&&cfg.instructions.trim()?cfg.instructions:DEFAULT_AI_INSTRUCTIONS};};
 function backup(){const dir=path.join(dataDir,'backups');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,`backup-${Date.now()}-${randomBytes(3).toString('hex')}.json`),JSON.stringify({format:'soloinspect-backup',created:new Date().toISOString(),...read()}));}
 function save(s,revision){
  migrateState(s);validateState(s);
  let json;try{json=WorkspaceLimits.stateJSON(s);}catch(error){fail(error.message,413);}
  const conflict=()=>fail('Another window has saved newer data. Use Back up data to export this window before refreshing.',409);
  const old=read();if(revision!==old.revision)conflict();
  backup();
  // Another process can save while this process writes its backup. Check the
  // revision atomically in SQLite so both writers cannot report success.
  const result=db.prepare('UPDATE documents SET revision=revision+1,json=? WHERE id=1 AND revision=?').run(json,revision);
  if(result.changes!==1)conflict();
  return {revision:old.revision+1};
 }
 const existing=read();if(migrateState(existing.state))save(existing.state,existing.revision);
 const hostingPath=path.join(__dirname,'hosting','service.js');
 const hosting=fs.existsSync(hostingPath)?require(hostingPath).createHosting({db,protect:dpapi,read,renderHTML:reportHTML,...(hostingFetch?{fetchImpl:hostingFetch}:{})}):null;
 const server=http.createServer(async(req,res)=>{
  const send=(status,body,type='application/json; charset=utf-8',extra={})=>{res.writeHead(status,{'Content-Type':type,'X-Content-Type-Options':'nosniff','Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY',...extra});res.end(typeof body==='string'||Buffer.isBuffer(body)?body:JSON.stringify(body));};
  try{
   if(closing)fail('HomeKanban is closing. Reopen it from your desktop.',503);
   const host=`127.0.0.1:${server.address().port}`;if(req.headers.host!==host)fail('Invalid host',403);
   if(req.headers.origin&&req.headers.origin!==`http://${host}`)fail('Cross-origin request denied',403);
   if(req.headers['sec-fetch-site']==='cross-site')fail('Cross-site request denied',403);
   const url=new URL(req.url,`http://${host}`),route=url.pathname;
   if(route.startsWith('/api/')){
    const cookie=(req.headers.cookie||'').split(';').map(s=>s.trim()).includes(`solo_session=${token}`);
    if(req.headers['x-solo-token']!==token&&!cookie)fail('Session expired. Reopen HomeKanban.',401);
    let body={};if(['POST','PUT'].includes(req.method)){let bytes=0,chunks=[];for await(const chunk of req){bytes+=chunk.length;if(bytes>(route==='/api/transcribe'?28*1024*1024:MAX_BODY))fail(route==='/api/transcribe'?'The recording is too large.':'The workspace exceeds the 100 MB save limit.',413);chunks.push(chunk);}try{body=JSON.parse(Buffer.concat(chunks).toString()||'{}');}catch{fail('Invalid JSON.');}}
    if(hosting&&await hosting.handle(route,req.method,body,send))return;
    if(route==='/api/state'&&req.method==='GET')return send(200,{...read(),categories,ratings,dataDir,textColors:Object.keys(Wording.colors)});
    if(route==='/api/state'&&req.method==='PUT')return send(200,save(body.state,body.revision));
    if(route==='/api/backup'&&req.method==='GET')return send(200,{format:'soloinspect-backup',created:new Date().toISOString(),...read()},undefined,{'Content-Disposition':'attachment; filename="HomeKanban-backup.json"'});
    if(route==='/api/restore'&&req.method==='POST'){if(body.backup?.format!=='soloinspect-backup')fail('Invalid backup format.');return send(200,save(body.backup.state,body.revision));}
    if(route==='/api/settings'&&req.method==='GET'){const {encryptedKey,encryptedVoiceKey,...rest}=settings();return send(200,{...rest,hasKey:!!encryptedKey,aiRevision:'polish-v2'});}
    if(route==='/api/ai-instructions'&&req.method==='PUT'){
     const instructions=normalizeAIInstructions(body.instructions);
     db.prepare('INSERT OR REPLACE INTO settings VALUES (1,?)').run(JSON.stringify({...settings(),instructions}));
     return send(200,{ok:true,instructions});
    }
    if(route==='/api/settings'&&req.method==='PUT'){
     const instructions=Object.hasOwn(body,'instructions')?normalizeAIInstructions(body.instructions):settings().instructions;
     const u=new URL(body.endpoint);if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash)fail('Use an HTTPS endpoint without credentials, query parameters, or fragments.');if(typeof body.model!=='string'||body.model.length>200)fail('Invalid model ID.');
     let encryptedKey=settings().encryptedKey;if(body.clearKey)encryptedKey='';else if(body.key){if(typeof body.key!=='string'||body.key.length>1000||/[\r\n]/.test(body.key))fail('Invalid API key format.');encryptedKey=dpapi(body.key.trim());}
     // A key cannot silently migrate to a different provider.
     if(settings().endpoint!==u.href&&!body.key)encryptedKey='';
     db.prepare('INSERT OR REPLACE INTO settings VALUES (1,?)').run(JSON.stringify({...settings(),endpoint:u.href,model:body.model.trim(),encryptedKey,instructions}));return send(200,{ok:true,hasKey:!!encryptedKey});
    }
    if(route==='/api/voice-settings'&&req.method==='GET')return send(200,{hasKey:!!settings().encryptedVoiceKey,provider:'OpenAI',model:Voice.MODEL,multilingual:true});
    if(route==='/api/voice-settings'&&req.method==='PUT'){
     let encryptedVoiceKey=settings().encryptedVoiceKey||'';
     if(body.clearKey===true)encryptedVoiceKey='';
     else if(body.key){if(typeof body.key!=='string'||body.key.length>1000||/[\r\n]/.test(body.key)||!body.key.trim())fail('Invalid Voice Input API key.');encryptedVoiceKey=dpapi(body.key.trim());}
     db.prepare('INSERT OR REPLACE INTO settings VALUES (1,?)').run(JSON.stringify({...settings(),encryptedVoiceKey}));
     return send(200,{ok:true,hasKey:!!encryptedVoiceKey});
    }
    if(route==='/api/transcribe'&&req.method==='POST'){
     if(voiceBusy)fail('Another recording is being transcribed. Please wait.',429);
     const cfg=settings();if(!cfg.encryptedVoiceKey)fail('Add your OpenAI API key under Voice Input in AI & settings first.');
     Voice.decodeAudio(body);voiceBusy=true;
     const controller=new AbortController(),cancel=()=>{if(!res.writableFinished)controller.abort();};res.once('close',cancel);
     try{return send(200,await Voice.transcribe(body,dpapi(cfg.encryptedVoiceKey,true),{signal:controller.signal}));}
     finally{voiceBusy=false;res.removeListener('close',cancel);}
    }
    if(route==='/api/ai'&&req.method==='POST'){
     if(aiBusy)fail('An AI request is already in progress.',429);const cfg=settings();if(!cfg.encryptedKey||!cfg.model)fail('Configure an API key and model ID first.');if(typeof body.text!=='string'||!body.text.trim()||body.text.length>100000)fail('Enter note text of up to 100,000 characters.');
     if(!['English'].includes(body.language))fail('Unsupported language.');aiBusy=true;
     try{const response=await fetch(cfg.endpoint,{method:'POST',redirect:'error',signal:AbortSignal.timeout(60000),headers:{Authorization:`Bearer ${dpapi(cfg.encryptedKey,true)}`,'Content-Type':'application/json'},body:JSON.stringify({model:cfg.model,store:false,messages:aiMessages(body.text,body.language,cfg.instructions)})});
      if(!response.ok)fail(`The AI provider returned HTTP ${response.status}. Check your API key, model, quota, and provider compatibility.`,502);const result=await response.json();const draft=result.choices?.[0]?.message?.content;if(typeof draft!=='string'||!draft.trim()||draft.length>100000||result.choices?.[0]?.finish_reason==='length')fail('The provider did not return a usable draft.',502);return send(200,{draft});
     }catch(e){if(e.status)throw e;fail('The AI request failed or timed out. Your original note is unchanged. The provider may have received the text.',502);}finally{aiBusy=false;}
    }
    const m=route.match(/^\/api\/reports\/([a-zA-Z0-9-]+)\/(html|pdf|check)$/);
    if(m&&req.method==='GET'){const r=read().state.reports.find(r=>r.id===m[1]);if(!r)fail('Report not found.',404);if(m[2]==='check')return send(200,{issues:issues(r),issueDetails:issueDetails(r)});if(m[2]==='html')return send(200,reportHTML(r),'text/html; charset=utf-8',url.searchParams.has('download')?{'Content-Disposition':'attachment; filename="index.html"'}:{});if(pdfBusy)fail('A PDF export is in progress. Please try again shortly.',429);pdfBusy=true;try{return send(200,await makePDF(r,dataDir),'application/pdf',{'Content-Disposition':'attachment; filename="inspection-report.pdf"'});}finally{pdfBusy=false;}}
    if(route==='/api/quit'&&req.method==='POST'){if(pdfBusy||aiBusy||voiceBusy||hosting?.busy)fail('Wait for the current export, AI or hosting request to finish, then exit.',409);closing=true;res.once('finish',()=>{close().then(()=>{if(require.main===module)process.exit(0);});});send(200,{ok:true});return;}
    fail('Endpoint not found.',404);
   }
   if(!['GET','HEAD'].includes(req.method))fail('Method not allowed',405);
   if(route==='/fonts/oswald-variable.ttf')return send(200,fs.readFileSync(path.join(PUBLIC,'fonts/oswald-variable.ttf')),'font/ttf');
   const branding={'/branding/homekanban-logo.svg':['homekanban-logo.svg','image/svg+xml'],'/branding/homekanban-house.png':['homekanban-house.png','image/png'],'/favicon.ico':['homekanban.ico','image/x-icon']};
   if(Object.hasOwn(branding,route)){const [name,type]=branding[route];return send(200,fs.readFileSync(path.join(PUBLIC,'branding',name)),type);}
   if(route==='/'||route==='/index.html')return send(200,fs.readFileSync(path.join(PUBLIC,'index.html'),'utf8').replace('__TOKEN__',token),'text/html; charset=utf-8',{'Set-Cookie':`solo_session=${token}; HttpOnly; SameSite=Strict; Path=/`,'Content-Security-Policy':"default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"});
   const assets={'/app.js':'text/javascript; charset=utf-8','/notes.js':'text/javascript; charset=utf-8','/bank.js':'text/javascript; charset=utf-8','/wording.js':'text/javascript; charset=utf-8','/wording-editor.js':'text/javascript; charset=utf-8','/style.css':'text/css; charset=utf-8'};if(Object.hasOwn(assets,route))return send(200,readFrontendAsset(PUBLIC,route.slice(1)),assets[route]);fail('Not found',404);
  }catch(e){if(!res.headersSent)send(e.status||500,{error:e.status?e.message:'The operation failed. Please try again. The failed request did not overwrite your data.'});}
 });
 function close(){if(closePromise)return closePromise;closing=true;closePromise=new Promise(resolve=>server.close(()=>{db.close();resolve();}));server.closeIdleConnections();return closePromise;}
 return {server,db,read,dataDir,start:()=>new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',()=>resolve(`http://127.0.0.1:${server.address().port}`));}),close};
}
function openAppBrowser(url){
 const browser=findBrowser();if(browser)spawn(browser,[`--app=${url}`],{windowsHide:true,detached:true,stdio:'ignore'}).unref();else spawn('cmd.exe',['/c','start','',url],{windowsHide:true,stdio:'ignore'});
}
async function desktopMain(){
 const port=Number(process.env.HOMEKANBAN_PORT||process.env.SOLOINSPECT_PORT||38473),url=`http://127.0.0.1:${port}`;
 // A second launch must not rename storage or create another database writer.
 const running=await new Promise(resolve=>{const socket=require('node:net').createConnection({host:'127.0.0.1',port});const done=value=>{socket.destroy();resolve(value);};socket.once('connect',()=>done(true));socket.once('error',()=>done(false));socket.setTimeout(1000,()=>done(false));});
 if(running){console.log(`HomeKanban is already running. Open ${url}`);if(!process.argv.includes('--no-open'))openAppBrowser(url);return;}
 const sessionToken=process.env.HOMEKANBAN_SESSION_TOKEN||process.env.SOLOINSPECT_SESSION_TOKEN;delete process.env.HOMEKANBAN_SESSION_TOKEN;delete process.env.SOLOINSPECT_SESSION_TOKEN;
 const app=createApp({port,sessionToken});
 try{const address=await app.start();console.log(`HomeKanban: ${address}\nData: ${app.dataDir}\nClose with Ctrl+C or the app Exit button.`);if(!process.argv.includes('--no-open'))openAppBrowser(address);}catch(error){await app.close();throw error;}
}
if(require.main===module)desktopMain().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={createApp,validateState,dpapi,makePDF};
