'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process'),{randomUUID}=require('node:crypto'),{pathToFileURL}=require('node:url');
function browserCandidates(){
 return [...new Set([process.env.HOMEKANBAN_BROWSER,process.env.SOLOINSPECT_BROWSER,
  path.join(process.env['PROGRAMFILES(X86)']||'C:/Program Files (x86)','Microsoft/Edge/Application/msedge.exe'),
  path.join(process.env.PROGRAMFILES||'C:/Program Files','Microsoft/Edge/Application/msedge.exe'),
  path.join(process.env.PROGRAMFILES||'C:/Program Files','Google/Chrome/Application/chrome.exe')].filter(file=>file&&fs.existsSync(file)))];
}
function completedPDF(file){
 try{const bytes=fs.readFileSync(file);return bytes.subarray(0,5).toString()==='%PDF-'&&/%%EOF\s*$/.test(bytes.subarray(-1024).toString())?bytes:null;}catch{return null;}
}
// Some Windows browser launchers return before their rendering process finishes.
// Success requires a complete PDF, not the launcher exit code or file existence.
function renderWithBrowser(browser,source,pdf,profile,{timeoutMs=30000,launch=spawn}={}){
 return new Promise((resolve,reject)=>{
  let finished=false,poll,timer,child;
  const finish=(error,bytes)=>{if(finished)return;finished=true;clearTimeout(timer);clearInterval(poll);error?reject(error):resolve(bytes);};
  const check=()=>{const bytes=completedPDF(pdf);if(bytes)finish(null,bytes);};
  try{child=launch(browser,['--headless','--disable-gpu','--no-first-run','--no-pdf-header-footer','--allow-file-access-from-files',`--user-data-dir=${profile}`,`--print-to-pdf=${pdf}`,pathToFileURL(source).href],{windowsHide:true,stdio:'ignore'});}catch(error){finish(error);return;}
  timer=setTimeout(()=>{child.kill();finish(new Error('PDF export timed out.'));},timeoutMs);
  poll=setInterval(check,100);
  child.once('error',error=>finish(error));
  child.once('exit',code=>{check();if(code!==0&&!finished)finish(new Error('The PDF browser could not finish rendering.'));});
  check();
 });
}
async function exportPDF(html,dir,{browsers=browserCandidates(),render=renderWithBrowser}={}){
 if(!browsers.length)throw Object.assign(new Error('Edge or Chrome was not found. Open PDF Preview and choose Print > Save as PDF.'),{status:503});
 const output=path.resolve(dir,'exports',randomUUID());fs.mkdirSync(output,{recursive:true});
 const source=path.join(output,'report.html');fs.writeFileSync(source,html);
 let failure;
 for(const [index,browser] of browsers.entries()){
  const pdf=path.join(output,index?'report-'+index+'.pdf':'report.pdf'),profile=path.join(output,'browser-'+index);
  try{return await render(browser,source,pdf,profile);}catch(error){failure=error;}
  // Browser helpers may outlive their launcher. Leave generated files for later
  // maintenance; removing a live profile can interrupt rendering or the browser.
 }
 throw Object.assign(new Error((failure?.message||'PDF export failed.')+' Open PDF Preview and print to PDF instead.'),{status:503});
}
module.exports={browserCandidates,completedPDF,renderWithBrowser,exportPDF};
