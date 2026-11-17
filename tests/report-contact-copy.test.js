const test=require('node:test');
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const source=fs.readFileSync(require.resolve('../app/public/app.js'),'utf8').replace(/boot\(\)\.catch\(err=>[\s\S]*$/,'');
const nodes=new Map(),writes=[],messages=[],dialogs=[];
const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',style:{},addEventListener(){},focus(){},select(){}});return nodes.get(id)};
const ctx=vm.createContext({document:{querySelector:node,getElementById:node,addEventListener(){}},window:{addEventListener(){}},navigator:{clipboard:{writeText:async text=>writes.push(text)}},structuredClone});
vm.runInContext(source+`;toast=t=>messages.push(t);modal=h=>dialogs.push(h);route='editor';currentId='test';state={reports:[{id:'test',address:'Saved address',client:'Saved client',email:'saved@example.com'}]};globalThis.h={copy:copyReportField,field:reportContactField};`,Object.assign(ctx,{messages,dialogs}));
test('report contact copy uses current values and supports a safe manual fallback',async()=>{
 for(const [key,text] of Object.entries({address:'123 Example Road, Example City, MD 20000',client:'Updated client',email:'updated@example.com'})){node('report-field-'+key).value=text;await ctx.h.copy(key);assert.equal(writes.at(-1),text)}
 assert.equal(writes.length,3);node('report-field-client').value=' ';await ctx.h.copy('client');await ctx.h.copy('time');assert.equal(writes.length,3);
 node('report-field-client').value='<Literal & client>';ctx.navigator.clipboard.writeText=async()=>{throw Error('Denied')};await ctx.h.copy('client');assert.match(dialogs.at(-1),/&lt;Literal &amp; client&gt;/);assert.equal(writes.length,3);
 const markup=ctx.h.field('Client email','email','x"<y',{type:'email'});assert.match(markup,/aria-label="Copy client email"/);assert.match(markup,/value="x&quot;&lt;y"/);assert.ok(!ctx.h.field('Inspection time','time','10 AM',{copy:false}).includes('data-copy-field'));
});
