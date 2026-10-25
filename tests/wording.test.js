'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const Wording=require('../app/public/wording'),{seed,categories}=require('../app/seed'),{createApp,validateState}=require('../app/server'),{reportHTML}=require('../app/report');
function fixture(){const state=seed(),t=state.templates[0],s=t.sections[0];const note={id:'styled-note',title:'Leak',text:'Water leak.\nRepair needed.',textRuns:[{text:'Water leak.',bold:true,color:'#b42318'},{text:'\nRepair needed.',italic:true,underline:true}],background:'blue',system:'General',category:categories[0]};state.noteLibrary=[note];const f={id:'styled-finding',location:'Sink',category:note.category,sectionId:s.id,itemId:s.items[0].id,text:'',photos:[{src:'data:image/png;base64,iVBORw0KGgo=',caption:'Test photo'}],includeInSummary:true};Wording.append(f,note);const r={id:'styled-report',address:'TEST ONLY',client:'Test client',date:'2026-10-24',time:'',weather:'',email:'',phone:'',notes:'',scope:'Test only',notice:t.notice,status:'draft',inspector:{...state.profile,name:'Test'},sections:structuredClone(t.sections),findings:[f]};state.reports.push(r);return {state,note,f,r};}
test('formatted append preserves the original report evidence and copies independent runs',()=>{
 const {note,f}=fixture(),before=structuredClone(f);Wording.append(f,{text:'Second note.',textRuns:[{text:'Second ',underline:true},{text:'note.'}]});assert.equal(f.text,before.text+'\n\nSecond note.');assert.deepEqual(f.photos,before.photos);assert.equal(f.sectionId,before.sectionId);assert.equal(f.includeInSummary,true);assert.ok(!f.background);note.textRuns[0].text='Changed bank wording';assert.equal(f.textRuns[0].text,'Water leak.');Wording.append(f,{text:'Plain replacement.'},false);assert.equal(f.text,'Plain replacement.');assert.ok(!f.textRuns);
});
test('the 350-word limit applies to reusable Fast notes, not report narratives',()=>{
 const {state,f}=fixture();Wording.assign(f,[{text:Array(500).fill('observation').join(' '),bold:true}]);
 assert.equal(Wording.wordCount(f.text),500);assert.doesNotThrow(()=>validateState(state));
});
test('formatting accepts legacy plain notes and rejects mismatches, markup colors, invalid backgrounds and excessive runs',()=>{
 const {state,note}=fixture();assert.doesNotThrow(()=>validateState(state));const original=structuredClone(note);
 for(const patch of [{background:'url(javascript:bad)'},{textRuns:[{text:note.text,color:'red; background:url(x)'}]},{textRuns:[{text:'wrong'}]},{textRuns:[{text:note.text,html:'<script>bad</script>'}]},{textRuns:Array.from({length:10001},()=>({text:''}))}]){Object.assign(note,original,patch);assert.throws(()=>validateState(state));}
 Object.assign(note,original);delete note.textRuns;delete note.background;assert.doesNotThrow(()=>validateState(state));assert.equal(Wording.render({text:'<img onerror="bad"> & text'}),'&lt;img onerror=&quot;bad&quot;&gt; &amp; text');
});
test('formatted text appears in both summaries and System checks; report copies stay plain text',()=>{
 const {r,f}=fixture(),html=reportHTML(r);assert.equal(html.split('<strong>Water leak.</strong>').length-1,3);assert.equal(html.split('style="color:#b42318"').length-1,3);assert.equal(html.split('<u><em><br>Repair needed.</em></u>').length-1,3);assert.ok(!html.includes('bank-bg-blue'));assert.equal(f.text,'Water leak.\nRepair needed.');
 assert.ok(html.includes('.summary-narrative>span{display:block;'));assert.ok(!html.includes('.summary-narrative span{display:block;'));
 f.includeInSummary=false;assert.equal(reportHTML(r).split('<strong>Water leak.</strong>').length-1,1);
});
test('formatted library and report notes survive save, backup, restore and restart',async()=>{
 const {state,note,f}=fixture(),dataDir=fs.mkdtempSync(path.resolve('work/wording-test-'));let app=createApp({dataDir,port:0});
 const colored=Object.entries(Wording.editorColors).map(([color,name])=>({text:name+' ',color}));Wording.assign(note,colored);Wording.assign(f,colored);
 try{const url=await app.start(),home=await(await fetch(url)).text(),token=home.match(/name="solo-token" content="([a-f0-9]+)"/)[1],headers={'X-Solo-Token':token,'Content-Type':'application/json'};const request=(route,body,method='POST')=>fetch(url+route,{method,headers,body:JSON.stringify(body)});
 for(const asset of ['wording.js','wording-editor.js'])assert.equal((await fetch(url+'/'+asset)).status,200);
 const loaded=await(await fetch(url+'/api/state',{headers})).json();for(const color of Object.keys(Wording.editorColors))assert.ok(loaded.textColors.includes(color));
 assert.equal((await request('/api/state',{state,revision:0},'PUT')).status,200);const backup=await(await fetch(url+'/api/backup',{headers})).json();assert.deepEqual(backup.state,state);assert.equal((await request('/api/restore',{backup,revision:1})).status,200);await app.close();app=createApp({dataDir,port:0});await app.start();assert.deepEqual(app.read().state,state);
 }finally{await app.close();}
});

test('six new text color choices coexist with existing purple and default formatting',()=>{
 assert.deepEqual(Object.values(Wording.editorColors),['Black','Red','Orange','Blue','Yellow','Green']);
 const note={};Wording.assign(note,Object.keys(Wording.colors).map(color=>({text:color+' ',color})));
 assert.doesNotThrow(()=>Wording.validate(note));const html=Wording.render(note);
 for(const color of ['#743a91','#9a4b08','#000000','#ea8a00','#e0b700'])assert.ok(html.includes('color:'+color));
});

test('new colors cannot alter a draft while the old server still needs a restart',()=>{
 const clicks=[],notices=[];let edits=0;
 const ctx=vm.createContext({Wording,supportedTextColors:['#243746','#b42318','#245c99','#226b43','#743a91','#9a4b08'],toast:message=>notices.push(message),document:{addEventListener:(name,fn)=>{if(name==='click')clicks.push(fn);},execCommand(){edits++;},getElementById(){throw Error('The draft must not be touched.');}},WeakMap});
 vm.runInContext(fs.readFileSync(require.resolve('../app/public/wording-editor.js'),'utf8'),ctx);
 for(const color of ['#000000','#ea8a00','#e0b700'])for(const click of clicks)click({target:{closest:selector=>selector==='[data-wording-color]'?{dataset:{wordingColor:color}}:null}});
 assert.equal(edits,0);assert.equal(notices.length,3);assert.ok(notices.every(message=>message.includes('exit and reopen HomeKanban')));
});
test('DOM formatting is reduced to supported text, preserving paragraphs and blank lines',()=>{
 const ctx=vm.createContext({Wording,document:{addEventListener(){}},WeakMap});vm.runInContext(fs.readFileSync(require.resolve('../app/public/wording-editor.js'),'utf8')+';globalThis.read=readWording;',ctx);
 const txt=text=>({nodeType:3,nodeValue:text});const el=(tag,children=[],style={},attrs={})=>({nodeType:1,tagName:tag,nodeName:tag,childNodes:children,firstChild:children[0],style:{fontWeight:'',fontStyle:'',textDecoration:'',color:'',...style},getAttribute:key=>attrs[key]});
 const root=el('DIV',[el('B',[txt('Leak')]),txt(' found.'),el('DIV',[el('SPAN',[el('B',[el('BR')])])]),el('DIV',[el('SPAN',[txt('Repair')],{color:'rgb(180, 35, 24)'}),txt(' needed.')]),el('SCRIPT',[txt('bad()')])]);
 const result=ctx.read(root);assert.equal(result.text,'Leak found.\n\nRepair needed.');assert.equal(result.textRuns[0].bold,true);assert.equal(result.textRuns.find(r=>r.text==='Repair').color,'#b42318');assert.ok(!result.text.includes('bad'));
});
