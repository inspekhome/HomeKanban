'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {DatabaseSync}=require('node:sqlite'),{spawn}=require('node:child_process');
const {defaultDataDirectory,databasePath}=require('../app/storage'),{createApp}=require('../app/server'),{seed}=require('../app/seed');
function temp(){return fs.mkdtempSync(path.resolve('work/homekanban-test-'));}
function oldWorkspace(base){
 const dir=path.join(base,'SoloInspect');fs.mkdirSync(path.join(dir,'backups'),{recursive:true});fs.mkdirSync(path.join(dir,'exports'));
 const state=seed();state.profile.name='Migration test inspector';
 const db=new DatabaseSync(path.join(dir,'soloinspect.sqlite'));
 db.exec('PRAGMA journal_mode=WAL;CREATE TABLE documents(id INTEGER PRIMARY KEY,revision INTEGER NOT NULL,json TEXT NOT NULL);CREATE TABLE settings(id INTEGER PRIMARY KEY,json TEXT NOT NULL)');
 db.prepare('INSERT INTO documents VALUES(1,42,?)').run(JSON.stringify(state));
 db.prepare('INSERT INTO settings VALUES(1,?)').run(JSON.stringify({endpoint:'https://example.invalid',model:'test',encryptedKey:'TEST ENCRYPTED VALUE'}));db.close();
 fs.writeFileSync(path.join(dir,'backups/previous.json'),'original recovery file');fs.writeFileSync(path.join(dir,'exports/example.html'),'previous report');return {dir,state};
}
test('legacy directory and SQLite rename preserve reports, preferences, backups and exports',async()=>{
 const base=temp(),{dir,state}=oldWorkspace(base),target=defaultDataDirectory({LOCALAPPDATA:base});
 assert.equal(target,path.join(base,'HomeKanban'));assert.equal(fs.existsSync(dir),false);
 const app=createApp({dataDir:target,port:0});
 try{
  assert.deepEqual(app.read(),{revision:42,state});assert.equal(JSON.parse(app.db.prepare('SELECT json FROM settings WHERE id=1').get().json).encryptedKey,'TEST ENCRYPTED VALUE');
  assert.equal(fs.readFileSync(path.join(target,'backups/previous.json'),'utf8'),'original recovery file');assert.equal(fs.readFileSync(path.join(target,'exports/example.html'),'utf8'),'previous report');
  assert.equal(fs.existsSync(path.join(target,'soloinspect.sqlite')),false);assert.equal(fs.existsSync(path.join(target,'homekanban.sqlite')),true);
 }finally{await app.close();}
 assert.equal(defaultDataDirectory({LOCALAPPDATA:base}),target);assert.equal(databasePath(target),path.join(target,'homekanban.sqlite'));
});
test('an existing HomeKanban workspace is never overwritten by legacy storage',()=>{
 const base=temp(),{dir}=oldWorkspace(base),target=path.join(base,'HomeKanban');fs.mkdirSync(target);fs.writeFileSync(path.join(target,'homekanban.sqlite'),'existing database');
 assert.equal(defaultDataDirectory({LOCALAPPDATA:base}),target);assert.equal(databasePath(target),path.join(target,'homekanban.sqlite'));assert.equal(fs.readFileSync(path.join(target,'homekanban.sqlite'),'utf8'),'existing database');assert.ok(fs.existsSync(path.join(dir,'soloinspect.sqlite')));
});
test('an empty new folder cannot hide the old workspace',()=>{
 const base=temp(),{dir}=oldWorkspace(base);fs.mkdirSync(path.join(base,'HomeKanban'));assert.throws(()=>defaultDataDirectory({LOCALAPPDATA:base}),/empty HomeKanban folder/);assert.ok(fs.existsSync(path.join(dir,'soloinspect.sqlite')));
});
test('custom data directories support new and legacy environment variables without moving them',()=>{
 const base=temp(),{dir}=oldWorkspace(base),custom=path.join(base,'custom');assert.equal(defaultDataDirectory({LOCALAPPDATA:base,HOMEKANBAN_DATA:custom,SOLOINSPECT_DATA:dir}),custom);assert.equal(defaultDataDirectory({SOLOINSPECT_DATA:dir}),dir);assert.ok(fs.existsSync(dir));
});
test('busy legacy WAL is left intact instead of being renamed',()=>{
 const dir=temp(),file=path.join(dir,'soloinspect.sqlite'),writer=new DatabaseSync(file);writer.exec('PRAGMA journal_mode=WAL;CREATE TABLE data(value TEXT);INSERT INTO data VALUES (\'first\')');
 const reader=new DatabaseSync(file);reader.exec('BEGIN;SELECT * FROM data');writer.exec("INSERT INTO data VALUES ('second')");
 try{assert.throws(()=>databasePath(dir),/Close the previous/);assert.ok(fs.existsSync(file));assert.ok(!fs.existsSync(path.join(dir,'homekanban.sqlite')));}finally{reader.close();writer.close();}
});
test('HomeKanban title and download filename retain old backup and session compatibility',async()=>{
 const app=createApp({dataDir:temp(),port:0,sessionToken:'b'.repeat(64)});
 try{
  const url=await app.start(),home=await(await fetch(url)).text();assert.match(home,/<title>HomeKanban/);assert.ok(!home.includes('SoloInspect'));
  const headers={'X-Solo-Token':'b'.repeat(64),'Content-Type':'application/json'},response=await fetch(url+'/api/backup',{headers}),backup=await response.json();
  assert.match(response.headers.get('content-disposition'),/HomeKanban-backup.json/);assert.equal(backup.format,'soloinspect-backup');
  const restored=await fetch(url+'/api/restore',{method:'POST',headers,body:JSON.stringify({backup,revision:0})});assert.equal(restored.status,200);
 }finally{await app.close();}
});
test('a repeated CLI launch leaves legacy storage untouched while a server is running',async()=>{
 const base=temp(),{dir}=oldWorkspace(base),app=createApp({dataDir:temp(),port:0});
 try{
  await app.start();const port=app.server.address().port;
  const child=spawn(process.execPath,[path.resolve('app/server.js'),'--no-open'],{env:{...process.env,LOCALAPPDATA:base,HOMEKANBAN_DATA:'',SOLOINSPECT_DATA:'',HOMEKANBAN_PORT:String(port)},windowsHide:true,stdio:['ignore','pipe','pipe']});
  let output='';child.stdout.on('data',chunk=>output+=chunk);child.stderr.on('data',chunk=>output+=chunk);const code=await new Promise((resolve,reject)=>{child.once('exit',resolve);child.once('error',reject);});
  assert.equal(code,0,output);assert.match(output,/already running/);assert.ok(fs.existsSync(dir));assert.ok(!fs.existsSync(path.join(base,'HomeKanban')));
 }finally{await app.close();}
});
