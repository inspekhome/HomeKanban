'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
function setup({api,saveNow=async()=>{},report}={}){
 const nodes=new Map(),events=new Map(),calls=[],toasts=[];
 const node=key=>{if(!nodes.has(key))nodes.set(key,{value:'',checked:false,textContent:'',innerHTML:''});return nodes.get(key);};
 let state={configured:true,enabled:true,endpoint:'https://sample.inspector.workers.dev',hasKey:true,publications:[]};
 const context=vm.createContext({document:{querySelector:node,addEventListener:(type,handler)=>events.set(type,handler)},navigator:{clipboard:{writeText:async text=>calls.push(['clipboard',text])}},WebPublishing:{button:(id,value)=>JSON.stringify({id,...value})}});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../app/public/hosting-ui.js'),'utf8'),context);
 const call=async(...args)=>{calls.push(args);if(args[0]==='/api/hosting')return state;return api?.(...args);};
 context.Hosting.bind({api:call,saveNow,report,revision:()=>7,toast:(...args)=>toasts.push(args),onChange(){}});
 return {ui:context.Hosting,calls,toasts,node,setState:value=>state={...state,...value},click:async(name,id)=>{const button={dataset:{hostingAction:name,publication:id},disabled:false,isConnected:true};await events.get('click')({target:{closest:()=>button},preventDefault(){}});assert.equal(button.disabled,false);}};
}
test('hosting UI saves local edits before publishing the selected report and passes the saved revision',async()=>{
 const order=[],t=setup({saveNow:async()=>order.push('save'),api:async(url,method,body)=>{order.push('publish');assert.equal(url,'/api/hosting/reports/report-a/publish');assert.equal(method,'POST');assert.equal(body.revision,7);return {status:'published'};}});
 await t.ui.load();assert.equal((await t.ui.request('report-a',true)).status,'published');assert.deepEqual(order,['save','publish']);
});
test('failed local save prevents any upload; unavailable or disabled hosting never silently publishes',async()=>{
 const t=setup({saveNow:async()=>{throw Error('Save conflict');}});await t.ui.load();await assert.rejects(t.ui.request('a',true),/Save conflict/);assert.ok(t.calls.every(c=>c[0]==='/api/hosting'));
 t.setState({enabled:false});await t.ui.load();await assert.rejects(t.ui.request('a',true),/Enable/);
 t.setState({configured:false});await t.ui.load();await assert.rejects(t.ui.request('a',true),/Connect/);
});
test('uncertain publication exposes termination and status, but no share link; disabled uploads still allow termination',async()=>{
 const id='a'.repeat(64),t=setup({api:async url=>{assert.equal(url,'/api/hosting/publications/'+id+'/terminate');return {status:'unpublished',cleaned:false};}});
 t.setState({enabled:false,publications:[{id,reportId:'a',status:'uncertain',created:'2026',label:'<script>',url:null}]});await t.ui.load();
 assert.match(t.ui.button('a'),/published/);assert.match(t.ui.info('a'),/Cloud status unknown/);assert.ok(!t.ui.info('a').includes('Open web report'));assert.ok(t.ui.settings().includes('&lt;script&gt;'));
 assert.equal((await t.ui.request('a',false)).status,'unpublished');assert.match(t.toasts.at(-1)[0],/cleanup is pending/);
});
test('settings save clears the entered key and keeps connection status accurate without changing report state',async()=>{
 const t=setup({api:async(url,method,body)=>{assert.equal(url,'/api/hosting/settings');assert.equal(method,'PUT');assert.equal(body.key,'b'.repeat(64));return {configured:true,enabled:true,hasKey:true,publications:[]};}});await t.ui.load();
 t.node('#hosting-endpoint').value='https://sample.inspector.workers.dev';t.node('#hosting-key').value='b'.repeat(64);t.node('#hosting-enabled').checked=true;
 await t.click('save');assert.equal(t.node('#hosting-key').value,'');assert.equal(t.node('#hosting-connection-status').className,'api-key-status is-saved');assert.equal(t.node('#hosting-connection-status').innerHTML,'<strong><span aria-hidden="true">✓</span> Connection Saved</strong>');assert.ok(t.calls.every(c=>!c[0].includes('/api/state')));
});
test('recovery stops repeated pages and does not upload reports or overwrite local report data',async()=>{
 let pages=0;const t=setup({api:async url=>{assert.equal(url,'/api/hosting/recover');pages++;return {configured:true,enabled:false,publications:[],cursor:'repeated'};}});await t.ui.load();await t.click('recover');assert.equal(pages,2);assert.match(t.toasts.at(-1)[0],/repeated a page/);
});
for(const [status,cleaned,expected,errorFlag] of [
 ['published',undefined,'Report is published.',false],
 ['unpublished',true,'Web hosting is terminated.',false],
 ['unpublished',false,'File cleanup is pending',false],
 ['uncertain',undefined,'Unable to verify status.',true],
 ['uploading',undefined,'Unable to verify status.',true]
])test('Check status gives specific feedback for '+status+' / cleaned '+cleaned,async()=>{
 const id='c'.repeat(64),t=setup({api:async(url,method)=>{assert.equal(url,'/api/hosting/publications/'+id+'/check');assert.equal(method,'POST');return {status,cleaned};}});
 t.setState({publications:[{id,reportId:'test',status,cleaned,url:status==='published'?'https://synthetic.example.workers.dev/r/'+id+'/':null}]});
 await t.ui.load();await t.click('check',id);
 assert.ok(t.toasts.at(-1)[0].includes(expected));assert.equal(t.toasts.at(-1)[1],errorFlag);assert.ok(t.node('#hosting-message').textContent.includes(expected));
 assert.equal(t.ui.info('test').includes('Open web report'),status==='published');
});
test('Check status errors explain failure, do not claim success, and permit retry',async()=>{
 let fail=true;const t=setup({api:async()=>{if(fail)throw Error('Network unavailable');return {status:'published'};}});await t.ui.load();
 await t.click('check','d'.repeat(64));assert.equal(t.toasts.at(-1)[0],'Unable to verify status. Network unavailable');assert.equal(t.toasts.at(-1)[1],true);
 fail=false;await t.click('check','d'.repeat(64));assert.equal(t.toasts.at(-1)[0],'Report is published.');assert.equal(t.toasts.at(-1)[1],false);
});

test('payment retry saves the latest local status first and visibly clears a confirmed pending update',async()=>{
 const id='e'.repeat(64),order=[],p={id,reportId:'test',status:'published',created:'2026',paymentStatus:'unpaid',paymentSync:'pending'},t=setup({report:()=>({paymentStatus:'paid'}),saveNow:async()=>order.push('save'),api:async(url,method,body)=>{order.push('sync');assert.equal(url,'/api/hosting/reports/test/payment');assert.equal(method,'POST');assert.equal(body.revision,7);p.paymentStatus='paid';p.paymentSync='synced';return {synced:1};}});
 t.setState({enabled:false,publications:[p]});await t.ui.load();assert.match(t.ui.info('test'),/Retry payment update/);
 await t.click('retry-payment',id);assert.deepEqual(order,['save','sync']);assert.ok(!t.ui.info('test').includes('Retry payment update'));assert.match(t.toasts.at(-1)[0],/updated/);
});

test('unpublished payment changes remain local; status checks flag an unsynced reminder',async()=>{
 const t=setup({report:()=>({paymentStatus:'paid'}),api:async()=>({status:'published',paymentSync:'pending'})});
 assert.equal((await t.ui.syncPayment('local-only')).synced,0);assert.ok(t.calls.every(c=>c[0]==='/api/hosting'));
 await t.click('check','f'.repeat(64));assert.match(t.toasts.at(-1)[0],/Payment reminder not synced/);assert.equal(t.toasts.at(-1)[1],true);
});
