'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function client({writeText,legacyCopy=false}={}){
 const nodes=new Map(),messages=[],dialogs=[],selections=[];
 const node=key=>{if(!nodes.has(key))nodes.set(key,{content:'test',style:{},addEventListener(){},focus(){},select(){selections.push(this.value);},remove(){}});return nodes.get(key);};
 const ctx=vm.createContext({document:{querySelector:node,addEventListener(){},createElement:()=>node('temporary'),body:{append(){}},execCommand:()=>legacyCopy},window:{addEventListener(){}},navigator:{clipboard:{writeText}},structuredClone,messages,dialogs});
 const source=fs.readFileSync(require.resolve('../app/public/app.js'),'utf8').replace(/boot\(\)\.catch\(err=>[\s\S]*$/,'');
 vm.runInContext(source+`;toast=(text)=>messages.push(text);modal=html=>dialogs.push(html);categories=['Defect/Action Needed','Notes'];route='editor';currentId='test';state={reports:[]};globalThis.h={text:summaryPlainText,copy:copySummary,set:r=>state.reports=[r]};`,ctx);
 return {h:ctx.h,messages,dialogs,selections};
}
function report(){return {id:'test',sections:[],findings:[
 {id:'note',origin:'summary',location:'Roof & attic',category:'Notes',text:'First paragraph.\n\n第二段 <keep literal text>.',photos:[{src:'data:image/png;base64,private',caption:'Do not copy caption'}]},
 {id:'defect',origin:'summary',location:'Kitchen',category:'Defect/Action Needed',text:'Leak observed.\nRepair recommended.',photos:[]},
 {id:'excluded',location:'Checklist only',category:'Defect/Action Needed',text:'Do not copy this note',includeInSummary:false,photos:[]}
]};}
test('copied summary preserves grouping, numbering and paragraphs, excluding photos and unchecked notes',()=>{
 const c=client(),r=report(),before=JSON.stringify(r);
 assert.equal(c.h.text(r),'Defect/Action Needed\n\n1. Leak observed.\nRepair recommended.\n\nNotes\n\n1. First paragraph.\n\n第二段 <keep literal text>.');
 assert.equal(JSON.stringify(r),before);r.findings[1].text='Updated wording';assert.ok(c.h.text(r).includes('Updated wording'));r.findings=[];assert.equal(c.h.text(r),'');
});
test('summary numbers are consecutive within categories after deletion, exclusion and recategorization',()=>{
 const c=client(),r=report();
 r.findings.push({id:'defect-two',category:'Defect/Action Needed',text:'Gutter corrosion.'},{id:'note-two',category:'Notes',text:'Monitor condition.'},{id:'defect-three',category:'Defect/Action Needed',text:'Caulk needed.'});
 assert.equal(c.h.text(r),'Defect/Action Needed\n\n1. Leak observed.\nRepair recommended.\n\n2. Gutter corrosion.\n\n3. Caulk needed.\n\nNotes\n\n1. First paragraph.\n\n第二段 <keep literal text>.\n\n2. Monitor condition.');
 r.findings=r.findings.filter(f=>f.id!=='defect');
 assert.ok(c.h.text(r).startsWith('Defect/Action Needed\n\n1. Gutter corrosion.\n\n2. Caulk needed.'));
 r.findings.find(f=>f.id==='defect-two').includeInSummary=false;
 assert.ok(c.h.text(r).startsWith('Defect/Action Needed\n\n1. Caulk needed.'));
 r.findings.find(f=>f.id==='defect-three').category='Notes';
 assert.equal(c.h.text(r),'Notes\n\n1. First paragraph.\n\n第二段 <keep literal text>.\n\n2. Monitor condition.\n\n3. Caulk needed.');
});
test('clipboard receives plain text and empty summaries leave the clipboard untouched',async()=>{
 const writes=[],c=client({writeText:async text=>writes.push(text)}),r=report();c.h.set(r);await c.h.copy();assert.deepEqual(writes,[c.h.text(r)]);assert.deepEqual(c.messages,['Summary text copied.']);
 r.findings=[];await c.h.copy();assert.equal(writes.length,1);assert.equal(c.messages.at(-1),'No summary text to copy yet.');
});
test('blocked clipboard access falls back without falsely reporting success',async()=>{
 const c=client({writeText:async()=>{throw Error('Denied');}});c.h.set(report());await c.h.copy();assert.equal(c.messages.length,0);assert.equal(c.dialogs.length,1);assert.ok(c.dialogs[0].includes('Press Ctrl+C'));assert.ok(c.dialogs[0].includes('&lt;keep literal text&gt;'));
 const legacy=client({legacyCopy:true});legacy.h.set(report());await legacy.h.copy();assert.deepEqual(legacy.messages,['Summary text copied.']);assert.equal(legacy.dialogs.length,0);
});
