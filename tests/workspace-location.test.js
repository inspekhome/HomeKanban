'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {DatabaseSync}=require('node:sqlite'),{defaultDataDirectory}=require('../app/storage'),{createApp}=require('../app/server'),{seed}=require('../app/seed');
function setup(){
 const profile=fs.mkdtempSync(path.resolve('work/workspace-location-test-')),directory=path.join(profile,'HomeKanbanData'),config=path.join(profile,'.homekanban-workspace.json');
 fs.mkdirSync(directory);fs.writeFileSync(config,JSON.stringify({format:'homekanban-workspace-location',dataDirectory:directory}));
 const state=seed();state.profile.name='Synthetic recovery inspector';const t=state.templates[0];state.templates.push({...structuredClone(t),id:'custom-template',name:'Custom test template'});
 state.reports.push({id:'kept-report',address:'Synthetic recovery property',client:'Test client',date:'2026-10-26',time:'',weather:'',email:'',phone:'',notes:'',scope:'',notice:t.notice,status:'draft',inspector:structuredClone(state.profile),sections:structuredClone(t.sections),findings:[]});
 const file=path.join(directory,'homekanban.sqlite'),db=new DatabaseSync(file);db.exec('CREATE TABLE documents(id INTEGER PRIMARY KEY,revision INTEGER NOT NULL,json TEXT NOT NULL)');db.prepare('INSERT INTO documents VALUES(1,19,?)').run(JSON.stringify(state));db.close();
 return {profile,directory,config,file,state,env:{USERPROFILE:profile,LOCALAPPDATA:path.join(profile,'AppData/Local')}};
}
test('normal and redirected AppData launch contexts resolve to the same pinned workspace across restarts',async()=>{
 const f=setup();
 for(const base of [f.env.LOCALAPPDATA,path.join(f.profile,'AppData/Local/Packages/Test/LocalCache/Local'),f.env.LOCALAPPDATA]){
  const directory=defaultDataDirectory({...f.env,LOCALAPPDATA:base});assert.equal(directory,f.directory);
  const app=createApp({dataDir:directory,port:0});try{assert.equal(app.read().revision,19);assert.deepEqual(app.read().state,f.state);}finally{await app.close();}
  assert.equal(fs.existsSync(path.join(base,'HomeKanban')),false);
 }
});
test('missing or unreadable pinned databases stop startup without creating a blank replacement',()=>{
 const f=setup();fs.renameSync(f.file,f.file+'.recovery');assert.throws(()=>defaultDataDirectory(f.env),/No empty workspace was created/);assert.equal(fs.existsSync(f.file),false);
 fs.writeFileSync(f.file,'');assert.throws(()=>defaultDataDirectory(f.env),/No empty workspace was created/);assert.equal(fs.statSync(f.file).size,0);assert.equal(fs.existsSync(path.join(f.env.LOCALAPPDATA,'HomeKanban')),false);
});
test('invalid location configuration does not fall back to another workspace',()=>{
 const f=setup();
 for(const value of ['invalid JSON',JSON.stringify({format:'wrong',dataDirectory:f.directory}),JSON.stringify({format:'homekanban-workspace-location',dataDirectory:'relative/path'})]){fs.writeFileSync(f.config,value);assert.throws(()=>defaultDataDirectory(f.env),/workspace location/);}
 assert.equal(fs.existsSync(path.join(f.env.LOCALAPPDATA,'HomeKanban')),false);
});
test('explicit custom data directories take precedence, and users without a pinned location keep existing storage behavior',()=>{
 const f=setup(),override=path.join(f.profile,'explicit-data');assert.equal(defaultDataDirectory({...f.env,HOMEKANBAN_DATA:override}),override);assert.equal(defaultDataDirectory({...f.env,SOLOINSPECT_DATA:override}),override);
 fs.renameSync(f.config,f.config+'.backup');assert.equal(defaultDataDirectory(f.env),path.join(f.env.LOCALAPPDATA,'HomeKanban'));assert.equal(fs.existsSync(f.file),true);
});
