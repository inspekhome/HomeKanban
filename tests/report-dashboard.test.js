'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const D=require('../app/public/report-dashboard');
const reports=[
 {id:'a',address:'124 Maple Lane, Rockville, MD 20850',client:'Alice',date:'2026-11-07',status:'final',paymentStatus:'paid'},
 {id:'b',address:'86 Oak Street, Gaithersburg MD 20877',client:'Bob',date:'2026-10-02',status:'draft',paymentStatus:'unpaid'},
 {id:'c',address:'945 Riverbend Drive, North Bethesda, MD 20852',client:'Carol',date:'2026-11-03',status:'final'},
 {id:'demo',address:'Demo',client:'Demo',date:'2026-11-01',status:'draft',paymentStatus:'paid',isDemo:true}
];
const hosting={status:id=>({a:'published',b:'unpublished',c:'uncertain'}[id]||'unpublished')};
test('attention counts include unpaid defaults and do not hide unverified hosting',()=>{
 assert.deepEqual(D.counts(reports,hosting),{unfinished:2,unpaid:2,hosted:2,unverified:1});
 assert.deepEqual(reports.filter(r=>D.matches(r,{type:'hosted'},hosting)).map(r=>r.id),['a','c']);
});
test('attention filters combine with search and can be cleared without mutating reports',()=>{
 const before=JSON.stringify(reports);D.select({type:'unpaid'});assert.deepEqual(D.filtered(reports,'Carol',hosting).map(r=>r.id),['c']);
 D.select({type:'unfinished'});assert.deepEqual(D.filtered(reports,'Bob',hosting).map(r=>r.id),['b']);
 D.select({type:'hosted'});assert.deepEqual(D.filtered(reports,'alice',hosting).map(r=>r.id),['a']);
 D.select(null);assert.equal(D.filtered(reports,'',hosting).length,4);assert.equal(JSON.stringify(reports),before);
});
test('filter selection resets pagination and the empty result stays on a valid page',()=>{
 D.select(null);assert.equal(D.paginate(Array.from({length:21},()=>({}))).reports.length,10);D.select({type:'unfinished'});assert.equal(D.paginate([]).page,1);assert.equal(D.paginate([]).start,0);assert.equal(D.paginate([]).pages,1);D.select(null);
});
test('paging events advance and clamp pages, and switching attention filters resets the page',()=>{
 const events={},previousDocument=global.document;global.document={addEventListener:(name,fn)=>events[name]=fn};let renders=0;
 try{D.bind({render:()=>renders++,reports:()=>reports});D.select(null);const rows=Array.from({length:21},(_,id)=>({id}));
  events.click({target:{closest:()=>({dataset:{dashboard:'page',page:'2'}})}});assert.equal(D.paginate(rows).reports[0].id,10);
  events.click({target:{closest:()=>({dataset:{dashboard:'filter',filter:'unfinished'}})}});assert.equal(D.paginate(rows).page,1);
  events.click({target:{closest:()=>({dataset:{dashboard:'page',page:'99'}})}});assert.equal(D.paginate(rows).page,3);assert.equal(D.paginate(rows).reports.length,1);assert.ok(renders>=3);D.select(null);
 }finally{global.document=previousDocument;}
});

test('clicking a selected card or Show all reports clears an empty filter while preserving the search',()=>{
 const events={},previousDocument=global.document;global.document={addEventListener:(name,fn)=>events[name]=fn};
 try{D.bind({render(){}});D.select(null);const click=dataset=>events.click({target:{closest:()=>({dataset})}});
  click({dashboard:'filter',filter:'unfinished'});assert.equal(D.filtered(reports,'Alice',hosting).length,0);assert.match(D.filterChip(),/Show all reports/);
  click({dashboard:'filter',filter:'unfinished'});assert.deepEqual(D.filtered(reports,'Alice',hosting).map(r=>r.id),['a']);assert.equal(D.filterChip(),'');
  click({dashboard:'filter',filter:'unpaid'});click({dashboard:'clear'});assert.equal(D.filtered(reports,'',hosting).length,4);assert.equal(D.filterChip(),'');
 }finally{global.document=previousDocument;}
});
