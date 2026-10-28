'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createApp,dpapi}=require('../app/server'),{DEFAULT_AI_INSTRUCTIONS,normalizeAIInstructions,aiMessages}=require('../app/ai');
const nativeFetch=globalThis.fetch;
async function fixture(t,dataDir=fs.mkdtempSync(path.resolve('work/ai-instructions-test-'))){
 const app=createApp({dataDir,port:0}),url=await app.start();t.after(()=>app.close());
 const home=await(await nativeFetch(url)).text(),token=home.match(/name="solo-token" content="([a-f0-9]+)"/)[1];
 const request=async(route,method='GET',body)=>{const response=await nativeFetch(url+route,{method,headers:{'X-Solo-Token':token,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:response.status,data:await response.json()};};
 return {app,request,dataDir};
}
test('blank instructions use the editable default; invalid or excessive instructions are rejected',()=>{
 assert.equal(normalizeAIInstructions(' \n '),DEFAULT_AI_INSTRUCTIONS);
 const custom='修正英文语法，保留全部事实。\nUse more than 50 English words.';assert.equal(normalizeAIInstructions(custom),custom);
 for(const value of [undefined,null,[],{},'x'.repeat(10001)])assert.throws(()=>normalizeAIInstructions(value),/10,000/);
 const messages=aiMessages('The sink are leeking.','English',custom);assert.equal(messages[1].content,custom);assert.equal(messages[2].content,'The sink are leeking.');assert.match(messages[0].content,/desired word count/);assert.match(messages[0].content,/never invent facts/);
});
test('instructions can be saved without an API key and persist in the settings row without changing reports',async t=>{
 const {app,request,dataDir}=await fixture(t),before=JSON.stringify(app.read());
 let cfg=(await request('/api/settings')).data;assert.equal(cfg.instructions,DEFAULT_AI_INSTRUCTIONS);assert.equal(cfg.hasKey,false);
 const custom='Keep every observation.\nWrite more than 50 words in precise English.';
 assert.equal((await request('/api/ai-instructions','PUT',{instructions:custom})).status,200);
 cfg=(await request('/api/settings')).data;assert.equal(cfg.instructions,custom);assert.equal(cfg.model,'');assert.equal(cfg.hasKey,false);assert.equal(JSON.stringify(app.read()),before);
 // Open a second application on the same isolated DB to exercise loading persisted settings.
 const reopened=await fixture(t,dataDir);assert.equal((await reopened.request('/api/settings')).data.instructions,custom);
 for(const instructions of [null,{},'x'.repeat(10001)]){assert.equal((await request('/api/ai-instructions','PUT',{instructions})).status,400);assert.equal((await request('/api/settings')).data.instructions,custom);}
 assert.equal((await request('/api/ai-instructions','PUT',{instructions:''})).data.instructions,DEFAULT_AI_INSTRUCTIONS);
});
test('legacy credentials survive prompt-only saves; provider changes and key removal preserve saved instructions',async t=>{
 const {app,request}=await fixture(t),endpoint='https://test-provider.invalid/v1/chat/completions';
 app.db.prepare('INSERT OR REPLACE INTO settings VALUES (1,?)').run(JSON.stringify({endpoint,model:'old-model',encryptedKey:'opaque-existing-encrypted-key'}));
 assert.equal((await request('/api/settings')).data.instructions,DEFAULT_AI_INSTRUCTIONS);
 const instructions='Use short sentences. Preserve all measurements.';
 await request('/api/ai-instructions','PUT',{instructions,key:'must-not-replace',endpoint:'https://wrong.invalid'});
 let stored=JSON.parse(app.db.prepare('SELECT json FROM settings WHERE id=1').get().json);assert.equal(stored.encryptedKey,'opaque-existing-encrypted-key');assert.equal(stored.endpoint,endpoint);
 assert.equal((await request('/api/settings','PUT',{endpoint,model:'new-model',key:''})).status,200);assert.equal((await request('/api/settings')).data.instructions,instructions);
 assert.equal((await request('/api/settings','PUT',{endpoint,model:'new-model',clearKey:true})).status,200);
 stored=JSON.parse(app.db.prepare('SELECT json FROM settings WHERE id=1').get().json);assert.equal(stored.instructions,instructions);assert.equal(stored.encryptedKey,'');
 assert.equal((await request('/api/settings','PUT',{endpoint,model:'new-model',instructions:{bad:true}})).status,400);assert.equal((await request('/api/settings')).data.instructions,instructions);
});
test('every AI call reads the latest saved instructions independently of note text and does not contact a real provider',{skip:process.platform!=='win32'},async t=>{
 const {app,request}=await fixture(t),captures=[];
 app.db.prepare('INSERT OR REPLACE INTO settings VALUES (1,?)').run(JSON.stringify({endpoint:'https://test-provider.invalid/v1/chat/completions',model:'test-model',encryptedKey:dpapi('artificial-key-only')}));
 t.mock.method(globalThis,'fetch',async(url,options)=>{assert.equal(url,'https://test-provider.invalid/v1/chat/completions');captures.push(JSON.parse(options.body));return new Response(JSON.stringify({choices:[{message:{content:'The sink is leaking.'},finish_reason:'stop'}]}));});
 for(const instructions of ['Be concise and correct grammar.','Use more than 50 English words. Explain precisely without adding facts.']){
  await request('/api/ai-instructions','PUT',{instructions});
  const result=await request('/api/ai','POST',{text:'The sink are leeking.',language:'English',instructions:'Not a settings update'});assert.equal(result.status,200);
  assert.equal(captures.at(-1).messages[1].content,instructions);assert.equal(captures.at(-1).messages[2].content,'The sink are leeking.');
 }
 assert.equal(captures.length,2);assert.notEqual(captures[0].messages[1].content,captures[1].messages[1].content);
});

function settingsUI(api){
 const nodes=new Map(),$=key=>{if(!nodes.has(key))nodes.set(key,{value:'',textContent:'',disabled:true});return nodes.get(key);};
 const source=fs.readFileSync(require.resolve('../app/public/app.js'),'utf8');
 const start=source.indexOf('function showKeyStatus('),end=source.indexOf('\nfunction ',source.indexOf('async function saveAIInstructions()',start));
 const context=vm.createContext({$,api,route:'settings',toast(){}});vm.runInContext(source.slice(start,end),context);return {context,$};
}
test('the instructions field loads safely as text and stays disabled against an older backend',async()=>{
 for(const supported of [false,true]){
  const prompt='<script>example, not markup</script>\nKeep all facts.',ui=settingsUI(async()=>({endpoint:'https://test.invalid',model:'demo',hasKey:false,instructions:prompt,aiRevision:supported?'polish-v2':'polish-v1'}));
  await ui.context.loadSettings();assert.equal(ui.$('#ai-instructions').value,prompt);assert.equal(ui.$('#ai-instructions').disabled,!supported);assert.equal(ui.$('[data-action="save-ai-instructions"]').disabled,!supported);
 }
});
test('saving instructions preserves edits made during a save and displays errors without erasing text',async()=>{
 let finish;const ui=settingsUI(()=>new Promise(resolve=>finish=resolve));ui.$('#ai-instructions').value='First instructions';const pending=ui.context.saveAIInstructions();ui.$('#ai-instructions').value='Newer instructions';finish({instructions:'First instructions'});await pending;assert.equal(ui.$('#ai-instructions').value,'Newer instructions');assert.match(ui.$('#ai-instructions-status').textContent,/not saved yet/);
 const failure=settingsUI(async()=>{throw Error('Save failed');});failure.$('#ai-instructions').value='Keep these edits';await assert.rejects(failure.context.saveAIInstructions(),/Save failed/);assert.equal(failure.$('#ai-instructions').value,'Keep these edits');assert.match(failure.$('#ai-instructions-status').textContent,/not saved/);
});
