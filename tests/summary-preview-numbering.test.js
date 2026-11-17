'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {reportHTML}=require('../app/report');
const {packageReport}=require('../app/hosting/package');
test('preview and web text summaries carry visible numbers matching photo summaries after exclusions',()=>{
 const r={id:'numbering',inspector:{},sections:[],findings:[
  {id:'a',category:'Notes',text:'First note.\nSecond paragraph.'},
  {id:'hidden',category:'Notes',text:'Excluded',includeInSummary:false},
  {id:'b',category:'Notes',text:'Second note.'},
  {id:'c',category:'Recommendation',text:'Another category.'}
 ]};
 const before=structuredClone(r),html=reportHTML(r),hosted=packageReport(r,reportHTML).files.find(f=>f.name==='index.html').body.toString();
 for(const output of [html,hosted]){
  const text=output.split('<section id="text-summary">')[1].split('<section id="photo-summary">')[0];
  for(const [id,n] of [['a',1],['b',2],['c',1]]){
   assert.ok(text.includes(`href="#finding-${id}"><span class="summary-note-number">${n}. </span>`));
   assert.ok(output.includes(`id="finding-${id}"><div class="photo-note-heading"><div class="photo-note-body"><p><span class="summary-note-number">${n}. </span>`));
  }
  assert.ok(!text.includes('Excluded'));assert.ok(text.includes('First note.'));assert.ok(text.includes('Second paragraph.'));
 }
 assert.deepEqual(r,before);
});

test('editor text summaries explicitly number each category and renumber after edits',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),Wording=require('../app/public/wording');
 const node=()=>({content:'test',style:{},addEventListener(){}});
 const ctx=vm.createContext({Wording,document:{querySelector:node,addEventListener(){}},window:{addEventListener(){}},structuredClone});
 const source=fs.readFileSync(require.resolve('../app/public/app.js'),'utf8').replace(/boot\(\)\.catch\(err=>[\s\S]*$/,'');
 vm.runInContext(source+`;categories=['Defect/Action Needed','Marginal/Deferred Maintenance','Recommendation','Notes'];globalThis.renderSummary=renderTextSummary;`,ctx);
 const r={findings:[{id:'a',category:'Defect/Action Needed',text:'First.\nSecond paragraph.'},{id:'excluded',category:'Defect/Action Needed',text:'Hidden',includeInSummary:false},{id:'b',category:'Defect/Action Needed',text:'Second.'},{id:'m',category:'Marginal/Deferred Maintenance',text:'Maintenance.'},{id:'r',category:'Recommendation',text:'Recommendation.'},{id:'n',category:'Notes',text:'Note.'}]};
 const numbers=html=>[...html.matchAll(/href="#finding-([^"]+)"><span class="summary-note-number">(\d+)\.<\/span>/g)].map(m=>[m[1],Number(m[2])]);
 const before=JSON.stringify(r),html=ctx.renderSummary(r);
 assert.deepEqual(numbers(html),[['a',1],['b',2],['m',1],['r',1],['n',1]]);
 assert.ok(!html.includes('Hidden'));assert.ok(html.includes('Second paragraph.'));assert.equal(JSON.stringify(r),before);
 r.findings=r.findings.filter(f=>f.id!=='a');assert.deepEqual(numbers(ctx.renderSummary(r)),[['b',1],['m',1],['r',1],['n',1]]);
 r.findings.find(f=>f.id==='b').category='Notes';assert.deepEqual(numbers(ctx.renderSummary(r)),[['m',1],['r',1],['b',1],['n',2]]);
});
