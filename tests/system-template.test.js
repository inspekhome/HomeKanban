'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const baseline=require('../app/data/system-template.json'),fastNotes=require('../app/data/fast-notes.json'),{seed}=require('../app/seed'),{createApp,validateState}=require('../app/server'),Wording=require('../app/public/wording');
const withoutId=({id,...value})=>value;
test('the approved System Template baseline retains its wording, order and choice colors',()=>{
 // Update only when the owner explicitly approves a new public baseline.
 assert.equal(createHash('sha256').update(JSON.stringify(baseline)).digest('hex'),'0442a72f48e7efc8b5481f7f32065ab18cad7ee98741023e3597c82676824d65');
 const s=seed(),t=s.templates[0];assert.equal(t.name,'System Template');assert.equal(t.sections.length,18);assert.equal(t.sections.flatMap(s=>s.items).length,65);
 assert.equal(t.sections.flatMap(s=>s.items).reduce((n,i)=>n+i.options.length,0),205);assert.doesNotThrow(()=>validateState(s));
 assert.equal(t.scope,baseline.scope);assert.equal(t.notice,baseline.notice);
 const foundation=t.sections[0].items.find(i=>i.name==='Foundation');assert.equal(foundation.choiceTypes.Concrete,'description');assert.ok(foundation.options.includes('Slab on Ground'));
 const drainage=t.sections.find(s=>s.name==='Exterior').items.find(i=>i.name==='Grading & drainage');assert.equal(drainage.choiceTypes['Sign of Ponding'],'concern');
});
test('a fresh workspace has only the approved defaults, a blank profile and no inspection results',()=>{
 const s=seed();assert.ok(Object.values(s.profile).every(v=>v===''));assert.deepEqual(s.reports,[]);assert.deepEqual(s.noteLibrary.map(withoutId),fastNotes);assert.equal(s.templates.length,1);
 for(const section of s.templates[0].sections)for(const item of section.items){assert.deepEqual(item.selected,[]);assert.equal(item.rating,'');assert.equal(item.note,'');assert.equal(item.limitation,'');assert.equal(item.legacyRating,undefined);}
 const publicKeys=new Set(['name','scope','scopeRuns','notice','sections','disclaimer','items','options','choiceTypes']);
 function check(obj){for(const [key,value] of Object.entries(obj)){assert.ok(publicKeys.has(key),'Unexpected workspace field in public baseline: '+key);if(key==='sections'||key==='items')value.forEach(check);}}
 check(baseline);
 const noteKeys=new Set(['title','category','text','textRuns','background','system','topic']);
 for(const note of fastNotes)for(const key of Object.keys(note))assert.ok(noteKeys.has(key),'Unexpected field in public Fast notes: '+key);
});
test('the 11 reviewed public Fast notes retain their exact order, wording and formatting within the library limits',()=>{
 assert.equal(createHash('sha256').update(JSON.stringify(fastNotes)).digest('hex'),'e2c63c5997f3d24d08ede1b1b248ee7393dc83ce20561a79820b350a004f863e');
 const s=seed();assert.equal(s.noteLibrary.length,11);assert.doesNotThrow(()=>Wording.validateFastNotes(s.noteLibrary));
 for(const note of s.noteLibrary){assert.doesNotThrow(()=>Wording.validate(note));assert.ok(Wording.wordCount(note.text)<=350);assert.ok(note.textRuns.some(r=>r.bold&&r.color==='#b42318'));}
 assert.equal(s.noteLibrary[0].background,'blue');assert.equal(s.noteLibrary[1].background,'pink');
});
test('editing seeded defaults cannot change the maintained files or another workspace',()=>{
 const a=seed(),b=seed(),before=JSON.stringify([baseline,fastNotes]);a.templates[0].sections[0].items[1].options.push('Custom private option');a.templates[0].sections[0].items[1].choiceTypes.Concrete='normal';
 a.noteLibrary[0].text='Changed personal note';a.noteLibrary[0].textRuns[0].color='#245c99';a.noteLibrary.reverse();
 const ids=s=>[...s.templates.flatMap(t=>[t.id,...t.sections.flatMap(section=>[section.id,...section.items.map(i=>i.id)])]),...s.noteLibrary.map(n=>n.id)];
 assert.equal(new Set(ids(a)).size,95);assert.ok(ids(b).every(id=>!ids(a).includes(id)));
 assert.equal(JSON.stringify([baseline,fastNotes]),before);assert.ok(!b.templates[0].sections[0].items[1].options.includes('Custom private option'));assert.equal(b.templates[0].sections[0].items[1].choiceTypes.Concrete,'description');assert.deepEqual(b.noteLibrary.map(withoutId),fastNotes);
});
for(const emptyLibrary of [false,true])test('reopening an existing workspace preserves custom templates and '+(emptyLibrary?'an intentionally empty library':'edited Fast notes and report snapshots'),async()=>{
 fs.mkdirSync(path.resolve('work/tests'),{recursive:true});const dir=fs.mkdtempSync(path.resolve('work/tests/system-template-'));let app=createApp({dataDir:dir,port:0});
 try{await app.start();const state=app.read().state;state.profile.name='Synthetic existing inspector';state.templates[0].name='My existing template';state.templates[0].sections.reverse();state.templates[0].sections[0].items[0].options.push('Keep my choice');
  state.noteLibrary=emptyLibrary?[]:[{id:'personal-note',title:'Custom wording',category:'Notes',text:'Keep my own wording.'}];
  state.reports=[{id:'existing-report',address:'Synthetic test property',client:'Test client',date:'2026-10-28',email:'',phone:'',time:'',weather:'',notes:'',notice:'Synthetic notice',scope:'Synthetic scope',status:'draft',inspector:structuredClone(state.profile),sections:structuredClone(state.templates[0].sections),findings:[]}];
  assert.doesNotThrow(()=>validateState(state));app.db.prepare('UPDATE documents SET revision=42,json=? WHERE id=1').run(JSON.stringify(state));await app.close();app=createApp({dataDir:dir,port:0});await app.start();assert.deepEqual(app.read(),{revision:42,state});
 }finally{await app.close();}
});
