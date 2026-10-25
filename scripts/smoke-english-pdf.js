'use strict';
const fs=require('node:fs'),path=require('node:path');
const {seed}=require('../app/seed'),{reportHTML}=require('../app/report'),{makePDF}=require('../app/server');
async function main(){
 const state=seed(),t=state.templates[0];
 const report={id:'demo-report',client:'Demo Client',address:'DEMONSTRATION - 123 Example Street',date:'2026-10-22',time:'09:00',weather:'Demonstration weather field',notes:'This is a software test report, not an actual inspection.',notice:t.notice,scope:'DEMONSTRATION ONLY. No actual property was inspected. This example tests report text, limitations, and photographs.',status:'draft',inspector:{name:'Demo Inspector',business:'HomeKanban Demonstration',license:'TEST ONLY',email:'demo@example.invalid',phone:'555-0100',logo:''},sections:structuredClone(t.sections),findings:[{id:'demo-finding-1',category:'Defect/Action Needed',location:'Kitchen (example)',text:'DEMONSTRATION ONLY: The food disposal did not respond to its control. Evaluation and repair by a qualified plumber are recommended.',photos:[]}]};
 for(const section of report.sections)for(const item of section.items){item.rating='NI';item.limitation='Software demonstration: no physical inspection performed.';}
 for(const [index,code] of ['I','NI','NP','D'].entries()){const item=report.sections[0].items[index];item.rating=code;item.note='Illustrative '+code+' status for layout testing only.';if(code!=='NI')item.limitation='';}
 report.sections[6].items[0].selected=['Not tested in summer'];
 const photo=path.resolve('work/demo-photo.jpg');
 if(fs.existsSync(photo))report.findings[0].photos.push({src:'data:image/jpeg;base64,'+fs.readFileSync(photo).toString('base64'),caption:'Synthetic demonstration image - not property evidence.'});
 const dir=path.resolve('work/pdf-smoke');fs.mkdirSync(dir,{recursive:true});
 fs.writeFileSync(path.join(dir,'index.html'),reportHTML(report));
 const pdf=await makePDF(report,dir);fs.writeFileSync(path.join(dir,'sample-report.pdf'),pdf);
 console.log(JSON.stringify({bytes:pdf.length,output:path.join(dir,'sample-report.pdf')}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
