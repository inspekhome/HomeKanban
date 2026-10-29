'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {seed}=require('../app/seed'),{validateState}=require('../app/server');
function client({save=async()=>({revision:2}),sync=async()=>({synced:0})}={}){
 const state=seed(),events=new Map(),messages=[],writes=[];
 const node={content:'test',textContent:'',style:{},classList:{toggle(){}},addEventListener(){}};
 const context=vm.createContext({initialState:state,structuredClone,crypto:globalThis.crypto,setTimeout:()=>1,clearTimeout(){},document:{querySelector:()=>node,addEventListener:(n,f)=>events.set(n,f)},window:{addEventListener(){}},Hosting:{bind(){},syncPayment:sync,button:()=>'',info:()=>''},testToast:(...args)=>messages.push(args),testSave:async(u,m,b)=>{writes.push(structuredClone(b));return save(u,m,b);}});
 const source=fs.readFileSync(require.resolve('../app/public/app.js'),'utf8');
 vm.runInContext(source.slice(0,source.lastIndexOf('\nboot().catch'))+`;state=initialState;revision=1;route='reports';api=testSave;toast=testToast;render=()=>{};state.profile.name='Synthetic Inspector';state.reports.push(blankReport(state.templates[0],{id:'one',address:'Synthetic A'}),blankReport(state.templates[0],{id:'two',address:'Synthetic B'}));globalThis.h={toggle:toggleReportPayment,html:renderReports,blank:()=>blankReport(state.templates[0]),button:paymentButton};`,context);
 return {state,writes,messages,h:context.h,click:async action=>events.get('click')({target:{closest:()=>({dataset:{action,id:'one'},isConnected:false})}})};
}
test('new and legacy reports show Unpaid in the former Copy position; stale Copy actions do nothing',async()=>{
 const c=client();delete c.state.reports[0].paymentStatus;
 const html=c.h.html();assert.match(html,/payment-status is-unpaid/);assert.ok(!html.includes('duplicate-report'));assert.equal(c.h.blank().paymentStatus,'unpaid');
 const before=structuredClone(c.state);await c.click('duplicate-report');assert.deepEqual(structuredClone(c.state),before);assert.equal(c.writes.length,0);
});
test('payment toggle persists first, preserves inspection evidence and finalization, and updates only its publication',async()=>{
 const order=[],c=client({save:async()=>{order.push('save');return {revision:2};},sync:async id=>{assert.equal(id,'one');order.push('sync');return {synced:1};}});
 const r=c.state.reports[0];r.client='Synthetic Client';for(const s of r.sections)for(const i of s.items)i.rating='I';r.status='final';const before=structuredClone(c.state);
 await c.h.toggle('one');assert.deepEqual(order,['save','sync']);assert.equal(r.paymentStatus,'paid');assert.match(c.h.button(r),/is-paid/);assert.equal(c.writes[0].state.reports[0].paymentStatus,'paid');
 const expected=structuredClone(before);expected.reports[0].paymentStatus='paid';assert.deepEqual(structuredClone(c.state),expected);assert.doesNotThrow(()=>validateState(c.state));
 await c.h.toggle('one');assert.equal(r.paymentStatus,'unpaid');assert.equal(r.status,'final');
});
test('failed local save leaves payment unchanged and sends no cloud update',async()=>{
 let calls=0;const c=client({save:async()=>{throw Error('Revision conflict');},sync:async()=>{calls++;}});
 await assert.rejects(c.h.toggle('one'),/Revision conflict/);assert.equal(c.state.reports[0].paymentStatus,'unpaid');assert.equal(calls,0);
});
test('cloud failure retains the saved local payment and explains that the online reminder is not confirmed',async()=>{
 const c=client({sync:async()=>{throw Error('Network unavailable');}});await c.h.toggle('one');assert.equal(c.state.reports[0].paymentStatus,'paid');assert.match(c.messages.at(-1)[0],/saved locally.*not confirmed/);assert.equal(c.messages.at(-1)[1],true);
});
test('duplicate clicks while saving cannot toggle the same report back or send extra writes',async()=>{
 let release;const c=client({save:()=>new Promise(resolve=>release=()=>resolve({revision:2}))});const first=c.h.toggle('one');await c.h.toggle('one');assert.equal(c.writes.length,1);release();await first;assert.equal(c.state.reports[0].paymentStatus,'paid');
});
test('payment status accepts legacy absence, paid and unpaid, rejecting malformed restore data',()=>{
 const c=client(),r=c.state.reports[0];for(const value of [undefined,'paid','unpaid']){r.paymentStatus=value;assert.doesNotThrow(()=>validateState(c.state));}for(const value of [null,true,'pending',{},'<script>']){r.paymentStatus=value;assert.throws(()=>validateState(c.state),/Invalid payment status/);}
});
