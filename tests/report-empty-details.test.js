'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {reportHTML}=require('../app/report'),{seed}=require('../app/seed');
function fixture(){
 const state=seed(),t=state.templates[0],item={...t.sections[0].items[0],rating:'I',selected:[],note:'',limitation:''};
 const r={id:'empty-details',address:'Test property',client:'Test',date:'2026-10-25',time:'',weather:'',notes:'',notice:'Test notice',scope:'Test scope',inspector:state.profile,status:'draft',sections:[{...t.sections[0],items:[item]}],findings:[]};
 return {r,item};
}
const details=html=>html.match(/<td class="inspection-details">([\s\S]*?)<\/td>/)[1];
test('blank material and note fields render empty, with inspected status retained',()=>{
 const {r,item}=fixture();let html=reportHTML(r);assert.equal(details(html),'');assert.ok(html.includes('aria-label="I: selected"'));assert.ok(!html.includes('Status not recorded · review required'));
 item.selected=['  '];item.note=' \n ';item.limitation='\t';assert.equal(details(reportHTML(r)),'');
 item.rating='';html=reportHTML(r);assert.equal(details(html),'');assert.ok(html.includes('Status not recorded · review required'));
});
test('notes and limitations appear without an empty material line or leading break',()=>{
 const {r,item}=fixture();item.note='Inspected & operated';assert.equal(details(reportHTML(r)),'<span class="muted">Inspected &amp; operated</span>');
 item.note='';item.rating='NI';item.limitation='Access <blocked>';assert.equal(details(reportHTML(r)),'<b>Reason not inspected:</b> Access &lt;blocked&gt;');
 item.selected=['Copper','PVC'];item.note='Check joints';assert.equal(details(reportHTML(r)),'Copper, PVC<br><span class="muted">Check joints</span><br><b>Reason not inspected:</b> Access &lt;blocked&gt;');
});
test('a finding link alone remains visible and clickable without a dash',()=>{
 const {r,item}=fixture();r.findings.push({id:'linked-finding',sectionId:r.sections[0].id,itemId:item.id,category:'Defect/Action Needed',location:'Test & location',text:'Test finding',photos:[]});
 assert.equal(details(reportHTML(r)),'<a href="#check-finding-linked-finding">Finding #01: Test &amp; location</a>');
});
