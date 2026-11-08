'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createApp}=require('../app/server');
test('retired location cache is removed on upgrade while workspace documents and hosting records survive',async()=>{
 const dataDir=fs.mkdtempSync(path.resolve('work/report-home-cleanup-'));let app=createApp({dataDir,port:0});
 const before=app.read();
 app.db.exec('CREATE TABLE map_locations (address TEXT PRIMARY KEY,json TEXT,checked INTEGER)');
 app.db.prepare('INSERT INTO map_locations VALUES (?,?,?)').run('Synthetic address','{}',0);
 app.db.prepare('INSERT INTO hosting_publications VALUES (?,?)').run('test-publication',JSON.stringify({id:'test-publication',reportId:'sample',status:'published'}));
 await app.close();app=createApp({dataDir,port:0});
 try{assert.equal(app.db.prepare("SELECT name FROM sqlite_master WHERE name='map_locations'").get(),undefined);assert.deepEqual(app.read(),before);assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM hosting_publications').get().n,1);
  const url=await app.start(),home=await fetch(url),cookie=home.headers.get('set-cookie').split(';')[0];assert.ok(!home.headers.get('content-security-policy').includes('tile.openstreetmap.org'));
  assert.equal((await fetch(url+'/api/map/locate',{method:'POST',headers:{cookie,'Content-Type':'application/json'},body:'{}'})).status,404);
  assert.equal((await fetch(url+'/vendor/leaflet/leaflet.js')).status,404);
 }finally{await app.close();}
});
