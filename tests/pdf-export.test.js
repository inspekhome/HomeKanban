'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{EventEmitter}=require('node:events');
const {completedPDF,renderWithBrowser,exportPDF}=require('../app/pdf-export');
const folder=()=>fs.mkdtempSync(path.resolve('work/pdf-lifecycle-test-'));
const content=Buffer.from('%PDF-1.7\nsynthetic lifecycle fixture\n%%EOF\n');
test('PDF completion waits for delayed browser output after its launcher exits',async()=>{
 const dir=folder(),pdf=path.join(dir,'report.pdf');let killed=false;
 const launch=()=>{const child=new EventEmitter();child.kill=()=>killed=true;setTimeout(()=>child.emit('exit',0),5);setTimeout(()=>fs.writeFileSync(pdf,'%PDF-1.7\npartial'),20);setTimeout(()=>fs.writeFileSync(pdf,content),150);return child;};
 const bytes=await renderWithBrowser('test-browser',path.join(dir,'report.html'),pdf,path.join(dir,'browser'),{launch,timeoutMs:2000});
 assert.deepEqual(bytes,content);assert.equal(killed,false);
});
test('partial or missing PDF times out instead of reporting successful export',async()=>{
 const dir=folder(),pdf=path.join(dir,'report.pdf');fs.writeFileSync(pdf,'%PDF-1.7\npartial');assert.equal(completedPDF(pdf),null);let killed=false;
 const launch=()=>{const child=new EventEmitter();child.kill=()=>killed=true;setTimeout(()=>child.emit('exit',0),5);return child;};
 await assert.rejects(renderWithBrowser('test',path.join(dir,'source.html'),pdf,path.join(dir,'browser'),{launch,timeoutMs:50}),/timed out/);assert.equal(killed,true);
});
test('a failed browser falls back without deleting reports or backups',async()=>{
 const dir=folder(),sentinel=path.join(dir,'backups');fs.mkdirSync(sentinel);fs.writeFileSync(path.join(sentinel,'keep.json'),'Keep');const tried=[];
 const bytes=await exportPDF('<main>Test report</main>',dir,{browsers:['first','second'],render:async(browser,source,pdf,profile)=>{tried.push(browser);assert.match(fs.readFileSync(source,'utf8'),/Test report/);fs.mkdirSync(profile);if(browser==='first')throw Error('First unavailable');return content;}});
 assert.deepEqual(tried,['first','second']);assert.deepEqual(bytes,content);assert.equal(fs.readFileSync(path.join(sentinel,'keep.json'),'utf8'),'Keep');
});
test('missing browsers return an actionable error without generating partial exports',async()=>{
 const dir=folder();await assert.rejects(exportPDF('Test',dir,{browsers:[]}),error=>error.status===503&&/PDF Preview/.test(error.message));assert.deepEqual(fs.readdirSync(dir),[]);
});
