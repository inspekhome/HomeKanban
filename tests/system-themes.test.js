'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {seed}=require('../app/seed'),{validateState,createApp}=require('../app/server'),path=require('node:path');
const app=fs.readFileSync(require.resolve('../app/public/app.js'),'utf8'),source=app.slice(app.indexOf('const systemThemes='),app.indexOf('const progress='));
function setup(preferences){
 const state=seed();state.preferences=preferences;state.reports=[{id:'existing',status:'final',inspector:structuredClone(state.profile)}];
 const message={textContent:'',isConnected:true},documentElement={dataset:{}},buttons=['blue-gray','indigo','sage','peach','lavender','black-gray'].map(id=>({dataset:{themeChoice:id},setAttribute(k,v){this[k]=v;}}));let saves=0,changed=0,fail=false;
 const context=vm.createContext({state,$:()=>message,document:{documentElement,querySelectorAll:()=>buttons},changed(){changed++;},async saveNow(){saves++;if(fail)throw Error('Save unavailable');}});vm.runInContext(source,context);
 return {state,context,message,buttons,documentElement,get saves(){return saves;},get changed(){return changed;},set fail(value){fail=value;}};
}
test('old or unknown theme settings safely use Blue Gray',()=>{
 for(const preference of [undefined,{},null,{theme:'unknown'},{theme:'<script>'}]){const t=setup(preference);t.context.applySystemTheme();assert.equal(t.documentElement.dataset.theme,'blue-gray');assert.ok(t.context.renderSystemThemes().includes('Blue Gray theme'));}
});

test('a saved Black & Gray selection opens as Dark Mode without migration or report changes',async()=>{
 const t=setup({theme:'black-gray',otherSetting:'keep'}),before=JSON.stringify(t.state);t.context.applySystemTheme();
 assert.equal(t.documentElement.dataset.theme,'black-gray');const html=t.context.renderSystemThemes();assert.ok(html.includes('Dark Mode theme'));assert.ok(html.includes('Current theme: Dark Mode'));assert.ok(!html.includes('Black & Gray'));assert.equal((html.match(/data-theme-choice=/g)||[]).length,6);
 assert.equal(JSON.stringify(t.state),before);assert.equal(t.saves,0);await t.context.selectSystemTheme('black-gray');assert.equal(t.saves,0);
 await t.context.selectSystemTheme('blue-gray');assert.equal(t.documentElement.dataset.theme,'blue-gray');assert.equal(t.state.preferences.otherSetting,'keep');
 await t.context.selectSystemTheme('black-gray');assert.equal(t.message.textContent,'Dark Mode theme saved.');assert.equal(JSON.stringify(t.state),before);
});
test('theme choice applies and saves without changing profile, reports, or other preferences',async()=>{
 const t=setup({theme:'blue-gray',otherSetting:'keep'}),before=JSON.stringify({profile:t.state.profile,reports:t.state.reports});
 await t.context.selectSystemTheme('lavender');assert.equal(t.documentElement.dataset.theme,'lavender');assert.equal(t.state.preferences.theme,'lavender');assert.equal(t.state.preferences.otherSetting,'keep');assert.equal(t.saves,1);assert.equal(t.changed,1);
 assert.equal(JSON.stringify({profile:t.state.profile,reports:t.state.reports}),before);assert.equal(t.buttons.filter(b=>b['aria-pressed']==='true').length,1);assert.equal(t.message.textContent,'Lavender theme saved.');
 await t.context.selectSystemTheme('invalid');await t.context.selectSystemTheme('lavender');assert.equal(t.saves,1);
});
test('failed theme save stays visible as unsaved and can be retried through normal Save profile',async()=>{
 const t=setup();t.fail=true;await assert.rejects(t.context.selectSystemTheme('sage'),/Save unavailable/);assert.equal(t.documentElement.dataset.theme,'sage');assert.equal(t.changed,1);assert.ok(t.message.textContent.includes('Saving failed'));assert.equal(t.state.preferences.theme,'sage');
});
test('workspace theme survives database restart and backup/restore',async()=>{
 const dataDir=fs.mkdtempSync(path.resolve('work/theme-persistence-'));let instance=createApp({dataDir,port:0});
 try{
  let url=await instance.start(),home=await(await fetch(url)).text(),token=home.match(/name="solo-token" content="([a-f0-9]+)"/)[1],headers={'X-Solo-Token':token,'Content-Type':'application/json'};
  const data=instance.read();data.state.preferences={theme:'black-gray'};validateState(data.state);assert.equal((await fetch(url+'/api/state',{method:'PUT',headers,body:JSON.stringify(data)})).status,200);
  const backup=await(await fetch(url+'/api/backup',{headers})).json();assert.equal(backup.state.preferences.theme,'black-gray');
  await instance.close();instance=createApp({dataDir,port:0});url=await instance.start();assert.equal(instance.read().state.preferences.theme,'black-gray');
  home=await(await fetch(url)).text();token=home.match(/name="solo-token" content="([a-f0-9]+)"/)[1];headers={'X-Solo-Token':token,'Content-Type':'application/json'};
  assert.equal((await fetch(url+'/api/restore',{method:'POST',headers,body:JSON.stringify({backup,revision:instance.read().revision})})).status,200);assert.equal(instance.read().state.preferences.theme,'black-gray');
 }finally{await instance.close();}
});
