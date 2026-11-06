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
