'use strict';
const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');

// Preview, PDF and web export must pick up updates even if the app stays open.
// Hash the small renderer dependency set: copied files can retain their timestamps.
function createReportLoader(root=__dirname){
 const files=['report.js','public/wording.js','seed.js','ratings.js'].map(file=>path.join(root,file));
 let fingerprint,renderer;
 return ()=>{
  const hash=createHash('sha256');
  for(const file of files)hash.update(fs.readFileSync(file)).update('\0');
  const next=hash.digest('hex');
  if(next!==fingerprint){
   for(const file of files)delete require.cache[require.resolve(file)];
   const updated=require(files[0]);
   if(typeof updated.reportHTML!=='function'||typeof updated.issues!=='function')throw new Error('The report generator is incomplete.');
   renderer=updated;fingerprint=next;
  }
  return renderer;
 };
}
module.exports={createReportLoader};
