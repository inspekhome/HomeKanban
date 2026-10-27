'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const WebPublishing=require('../app/public/web-publishing'),{seed,ratings,categories}=require('../app/seed');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function client(withModule=true){
 const state=seed(),events=new Map(),nodes=new Map(),downloads=[];let networkCalls=0,callbacks;
 const node=key=>{if(!nodes.has(key))nodes.set(key,{content:'test-token',innerHTML:'',textContent:'',style:{},classList:{toggle(){}},addEventListener(){},showModal(){this.open=true;},close(){this.open=false;}});return nodes.get(key);};
 const context=vm.createContext({...(withModule?{WebPublishing:{...WebPublishing,bind(root,options){callbacks=options;}}}:{}),initialState:state,initialRatings:ratings,initialCategories:categories,structuredClone,crypto,setTimeout:()=>1,clearTimeout(){},fetch(){networkCalls++;throw Error('Hosting UI must not make requests');},document:{querySelector:node,addEventListener:(name,fn)=>events.set(name,fn)},window:{addEventListener(){}},recordDownload:(...args)=>downloads.push(args)});
 const source=fs.readFileSync(require.resolve('../app/public/app.js'),'utf8');vm.runInContext(source.slice(0,source.lastIndexOf('\nboot().catch'))+`
 state=initialState;ratings=initialRatings;categories=initialCategories;state.profile.name='Synthetic inspector';
 state.reports.push(blankReport(state.templates[0],{id:'first-report',address:'First synthetic property',client:'Test one'}),blankReport(state.templates[0],{id:'second-report',address:'Second <property>',client:'Test two'}));
 route='reports';currentId='first-report';download=async(...args)=>recordDownload(...args);
 globalThis.h={html:renderReports,get dirty(){return dirty;}};`,context);
 return {state,h:context.h,node,downloads,callbacks,get networkCalls(){return networkCalls;},click:dataset=>events.get('click')({target:{closest:()=>({dataset,isConnected:true})}})};
}
function controller(onRequest){
 const events=new Map(),windows=new Map(),errors=[],hints=[],requests=[];
 const root={addEventListener:(name,fn)=>events.set(name,fn),removeEventListener:(name,fn)=>{if(events.get(name)===fn)events.delete(name);},defaultView:{addEventListener:(name,fn)=>windows.set(name,fn),removeEventListener:name=>windows.delete(name)}};
 const dispose=WebPublishing.bind(root,{onRequest:async(...args)=>{requests.push(args);if(onRequest)return onRequest(...args);throw Error('Cloudflare is not connected yet.');},onError:error=>errors.push(error),onHint:hint=>hints.push(hint)});
 function makeButton(published=false,id='report-one'){
  const attrs=new Map([['aria-checked',String(published)]]),styles=new Map(),classes=new Set([published?'is-published':'is-unpublished']),label={textContent:published?'Terminate Web Hosting':'Export to Web Hosting'};
  const button={dataset:{id},isConnected:true,disabled:false,clientWidth:242,getAttribute:n=>attrs.get(n),setAttribute:(n,v)=>attrs.set(n,v),removeAttribute:n=>attrs.delete(n),style:{setProperty:(n,v)=>styles.set(n,v),removeProperty:n=>styles.delete(n)},classList:{add:n=>classes.add(n),remove:n=>classes.delete(n),toggle(n,value){value?classes.add(n):classes.delete(n);}},focus(){},setPointerCapture(id){this.captured=id;},hasPointerCapture(id){return this.captured===id;},releasePointerCapture(){this.captured=null;}};
  const thumb={offsetWidth:34,closest:sel=>sel==='.web-hosting-thumb'?thumb:sel==='[data-web-hosting-slider]'?button:null};button.closest=sel=>sel==='[data-web-hosting-slider]'?button:null;button.querySelector=sel=>sel==='.web-hosting-thumb'?thumb:label;
  return {button,thumb,label,attrs,styles,classes};
 }
 function send(name,target,extra={}){const event={target,pointerId:1,clientX:100,button:0,isPrimary:true,detail:1,preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;},...extra};events.get(name)?.(event);return event;}
 function slide(control,endX=300){send('pointerdown',control.thumb);send('pointermove',control.thumb,{clientX:endX});send('pointerup',control.thumb,{clientX:endX});send('click',control.button);}
 return {makeButton,send,slide,errors,hints,requests,dispose,events,windows};
}

test('hosting requests are scoped to the selected report and cannot publish, save or open a modal before connection',()=>{
 const c=client(),before=structuredClone(c.state);assert.throws(()=>c.callbacks.onRequest('second-report',true),/Cloudflare is not connected yet/);assert.throws(()=>c.callbacks.onRequest('deleted-report',false),/Report not found/);
 assert.equal(c.networkCalls,0);assert.deepEqual(structuredClone(c.state),before);assert.equal(c.h.dirty,0);assert.ok(!c.node('#dialog').open);
});

test('local HTML download remains tied to the selected report and library action order is preserved',async()=>{
 const c=client(),before=structuredClone(c.state),html=c.h.html();const markers=['data-action="open-report"','data-action="preview"','data-action="pdf"','data-web-hosting-slider','data-action="duplicate-report"','data-action="delete-report"'];let previous=-1;for(const marker of markers){const index=html.indexOf(marker);assert.ok(index>previous);previous=index;}
 await c.click({action:'html',id:'second-report'});assert.deepEqual(c.downloads,[['/api/reports/second-report/html?download=1','index.html']]);assert.equal(c.networkCalls,0);assert.deepEqual(structuredClone(c.state),before);
});

test('removing the optional hosting module leaves report and PDF actions available',()=>{
 const c=client(false),html=c.h.html();assert.ok(html.includes('Report library'));assert.ok(html.includes('data-action="preview"'));assert.ok(html.includes('data-action="pdf"'));assert.ok(!html.includes('data-web-hosting-slider'));assert.equal(c.networkCalls,0);
});

test('both switch states are accessible and escaped, with no extra HTML download button',()=>{
 const original={status:'published'};const green=WebPublishing.button('test"report',{status:'exported'}),red=WebPublishing.button('test"report',original);
 assert.match(green,/role="switch" aria-checked="false"/);assert.match(green,/is-unpublished/);assert.match(green,/Export to Web Hosting/);assert.match(red,/aria-checked="true"/);assert.match(red,/is-published/);assert.match(red,/Terminate Web Hosting/);assert.match(red,/test&quot;report/);assert.doesNotMatch(green+red,/Download HTML|data-action="html"/);assert.deepEqual(original,{status:'published'});
});

test('a full right drag publishes exactly once; the reverse drag terminates the same report without a confirmation',async()=>{
 const c=controller(async(id,published)=>({status:published?'published':'unpublished'})),b=c.makeButton();c.slide(b);await tick();assert.deepEqual(c.requests,[['report-one',true]]);assert.equal(b.attrs.get('aria-checked'),'true');assert.equal(b.label.textContent,'Terminate Web Hosting');assert.ok(b.classes.has('is-published'));
 c.slide(b,-100);await tick();assert.deepEqual(c.requests,[['report-one',true],['report-one',false]]);assert.equal(b.attrs.get('aria-checked'),'false');assert.equal(b.label.textContent,'Export to Web Hosting');assert.equal(c.errors.length,0);assert.equal(b.styles.size,0);
});

test('partial drags, wrong-direction drags and clicking the track never publish',async()=>{
 const c=controller(),b=c.makeButton();c.slide(b,180);c.slide(b,-100);c.send('click',b.button);await tick();assert.equal(c.requests.length,0);assert.equal(b.attrs.get('aria-checked'),'false');assert.equal(b.styles.size,0);assert.ok(c.hints.some(h=>h.includes('right')));
 const red=c.makeButton(true);c.slide(red,300);assert.equal(c.requests.length,0);assert.equal(red.attrs.get('aria-checked'),'true');
});

test('pointer cancellation, escape, lost capture and blur discard completed-but-unreleased gestures',async()=>{
 for(const kind of ['pointercancel','lostpointercapture','keydown','blur']){const c=controller(),b=c.makeButton();c.send('pointerdown',b.thumb);c.send('pointermove',b.thumb,{clientX:300});if(kind==='blur')c.windows.get('blur')();else c.send(kind,b.thumb,{key:'Escape'});c.send('pointerup',b.thumb,{clientX:300});await tick();assert.equal(c.requests.length,0,kind);assert.equal(b.styles.size,0,kind);}
});

test('no connection, API failure and unconfirmed results retain the real original state in either direction',async()=>{
 for(const published of [false,true])for(const adapter of [undefined,async()=>{throw Error('Network unavailable');},async()=>({status:'pending'})]){const c=controller(adapter),b=c.makeButton(published);c.slide(b,published?-100:300);await tick();assert.equal(b.attrs.get('aria-checked'),String(published));assert.equal(b.button.disabled,false);assert.equal(b.styles.size,0);assert.equal(c.errors.length,1);assert.equal(c.requests.length,1);}
});

test('pending operations cannot double-submit and status changes only after confirmed completion',async()=>{
 let complete;const c=controller(()=>new Promise(resolve=>{complete=resolve;})),b=c.makeButton();c.slide(b);assert.equal(b.button.disabled,true);assert.equal(b.attrs.get('aria-checked'),'false');assert.equal(b.label.textContent,'Publishing…');c.slide(b);c.send('keydown',b.button,{key:'Enter'});assert.equal(c.requests.length,1);
 complete({status:'published'});await tick();assert.equal(b.attrs.get('aria-checked'),'true');assert.equal(b.button.disabled,false);assert.equal(b.attrs.has('aria-busy'),false);
});

test('keyboard and assistive activation work without mouse dragging or repeated submissions',async()=>{
 const c=controller(async(id,published)=>({status:published?'published':'unpublished'})),b=c.makeButton();c.send('keydown',b.button,{key:'ArrowLeft'});assert.equal(c.requests.length,0);c.send('keydown',b.button,{key:'ArrowRight'});c.send('keydown',b.button,{key:'ArrowRight',repeat:true});await tick();c.send('click',b.button,{detail:0});assert.equal(c.requests.length,1);assert.equal(b.attrs.get('aria-checked'),'true');
 c.send('keydown',b.button,{key:' '});await tick();c.send('click',b.button,{detail:0});assert.equal(c.requests.length,2);assert.equal(b.attrs.get('aria-checked'),'false');c.send('click',b.button,{detail:0});await tick();assert.equal(c.requests.length,3);
});

test('secondary pointers, detached rows and disposal cannot trigger requests',async()=>{
 const c=controller(),b=c.makeButton();c.send('pointerdown',b.thumb,{button:2});c.send('pointerdown',b.thumb,{isPrimary:false});c.send('pointermove',b.thumb,{clientX:300});c.send('pointerup',b.thumb,{clientX:300});assert.equal(c.requests.length,0);
 c.send('pointerdown',b.thumb);c.send('pointermove',b.thumb,{pointerId:2,clientX:300});c.send('pointerup',b.thumb,{pointerId:2,clientX:300});b.button.isConnected=false;c.send('pointermove',b.thumb,{clientX:300});await tick();assert.equal(c.requests.length,0);assert.equal(b.styles.size,0);c.dispose();assert.equal(c.events.size,0);assert.equal(c.windows.size,0);
});
