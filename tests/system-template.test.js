'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const baseline=require('../app/data/system-template.json'),{seed}=require('../app/seed'),{createApp,validateState}=require('../app/server');
test('the approved System Template baseline retains its wording, order and choice colors',()=>{
 // Update only when the owner explicitly approves a new public baseline.
 assert.equal(createHash('sha256').update(JSON.stringify(baseline)).digest('hex'),'138f248685e29406b29243ad5d9cc9ff23072d3b3946c8bd7fa80ea844d48e25');
 const s=seed(),t=s.templates[0];assert.equal(t.name,'System Template');assert.equal(t.sections.length,15);assert.equal(t.sections.flatMap(s=>s.items).length,59);
 assert.equal(t.sections.flatMap(s=>s.items).reduce((n,i)=>n+i.options.length,0),189);assert.doesNotThrow(()=>validateState(s));
 const foundation=t.sections[0].items.find(i=>i.name==='Foundation');assert.equal(foundation.choiceTypes.Concrete,'description');assert.equal(foundation.choiceTypes.Cracks,'concern');
 const flashing=t.sections.find(s=>s.name==='Roof').items.find(i=>i.name==='Flashing');assert.equal(flashing.choiceTypes['Limited Visibility'],'normal');
});
test('a fresh workspace has only the public template, blank profile and no inspection or narrative data',()=>{
 const s=seed();assert.ok(Object.values(s.profile).every(v=>v===''));assert.deepEqual(s.reports,[]);assert.deepEqual(s.noteLibrary,[]);assert.equal(s.templates.length,1);
 for(const section of s.templates[0].sections)for(const item of section.items){assert.deepEqual(item.selected,[]);assert.equal(item.rating,'');assert.equal(item.note,'');assert.equal(item.limitation,'');assert.equal(item.legacyRating,undefined);}
 const publicKeys=new Set(['name','scope','notice','sections','disclaimer','items','options','choiceTypes']);
 function check(obj){for(const [key,value] of Object.entries(obj)){assert.ok(publicKeys.has(key),'Unexpected workspace field in public baseline: '+key);if(key==='sections'||key==='items')value.forEach(check);}}
 check(baseline);
});
test('editing a seeded template cannot change the maintained baseline or another workspace',()=>{
 const a=seed(),b=seed(),before=JSON.stringify(baseline);a.templates[0].sections[0].items[1].options.push('Custom private option');a.templates[0].sections[0].items[1].choiceTypes.Cracks='normal';
 assert.notEqual(a.templates[0].id,b.templates[0].id);const ids=a.templates[0].sections.flatMap(s=>[s.id,...s.items.map(i=>i.id)]);assert.equal(new Set(ids).size,74);for(const s of b.templates[0].sections){assert.ok(!ids.includes(s.id));for(const i of s.items)assert.ok(!ids.includes(i.id));}
 assert.equal(JSON.stringify(baseline),before);assert.ok(!b.templates[0].sections[0].items[1].options.includes('Custom private option'));assert.equal(seed().templates[0].sections[0].items[1].choiceTypes.Cracks,'concern');
});
test('upgrading or reopening an existing workspace preserves its customized templates',async()=>{
 fs.mkdirSync(path.resolve('work/tests'),{recursive:true});const dir=fs.mkdtempSync(path.resolve('work/tests/system-template-'));let app=createApp({dataDir:dir,port:0});
 try{await app.start();const state=app.read().state;state.profile.name='Synthetic existing inspector';state.templates[0].name='My existing template';state.templates[0].sections.reverse();state.templates[0].sections[0].items[0].options.push('Keep my choice');
  app.db.prepare('UPDATE documents SET revision=42,json=? WHERE id=1').run(JSON.stringify(state));await app.close();app=createApp({dataDir:dir,port:0});await app.start();assert.deepEqual(app.read(),{revision:42,state});
 }finally{await app.close();}
});
