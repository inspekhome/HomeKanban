'use strict';
const {legacyRatings}=require('./ratings');
// Translate only known product-supplied labels. Preserve custom text and IDs.
const legacyNames = new Map([
 ['Residential Inspection · 住宅检查','Residential Inspection'],
 ['Structure · 房屋结构','Structure'],['Exterior · 房屋外部','Exterior'],
 ['Roof · 屋顶','Roof'],['Attic & Insulation · 阁楼与保温','Attic & Insulation'],
 ['Basement & Crawlspace · 地下室','Basement & Crawlspace'],['Plumbing · 水管','Plumbing'],
 ['Heating · 供暖','Heating'],['Cooling · 制冷','Cooling'],['Electrical · 电气','Electrical'],
 ['Interior · 房屋内部','Interior'],['Kitchen · 厨房','Kitchen'],['Bathrooms · 卫生间','Bathrooms'],
 ['Garage & Fireplace · 车库与壁炉','Garage & Fireplace']
]);
function migrateEnglishDefaults(state){
 let changed=false;
 function label(obj,key){const old=obj[key];let translated=legacyNames.get(old);if(translated===undefined&&typeof old==='string'&&old.endsWith(' · 副本')){const base=legacyNames.get(old.slice(0,-5));if(base)translated=base+' · Copy';}if(translated!==undefined){obj[key]=translated;changed=true;}}
 for(const template of state.templates||[]){label(template,'name');for(const section of template.sections||[])label(section,'name');}
 for(const report of state.reports||[]){label(report,'templateName');for(const section of report.sections||[])label(section,'name');if(report.isDemo){if(report.client==='Demo Client（演示客户）'){report.client='Demo Client';changed=true;}for(const finding of report.findings||[]){if(finding.location==='Demo kitchen / 示例厨房'){finding.location='Demo kitchen';changed=true;}}}}
 return changed;
}
function migrateChecklistRatings(state){
 if(state?.schema!==1)return false;
 // No old classification is silently treated as an inspector's new selection.
 // In particular, Not applicable does not establish that a component is absent.
 for(const record of [...(state.templates||[]),...(state.reports||[])]){
  let needsReview=false;
  for(const section of record.sections||[])for(const item of section.items||[]){
   if(Object.hasOwn(legacyRatings,item.rating)){
    item.legacyRating={code:item.rating,label:legacyRatings[item.rating]};
    item.rating='';
    needsReview=true;
   }
  }
  if(needsReview&&record.status==='final')record.status='draft';
 }
 state.schema=2;
 return true;
}
function migrateState(state){
 if(!state||![1,2].includes(state.schema))return false;
 const english=migrateEnglishDefaults(state);
 const checklist=migrateChecklistRatings(state);
 let templateScope=false;
 for(const template of state.templates||[]){
  if(template.scope===undefined){template.scope='';templateScope=true;}
 }
 return english||checklist||templateScope;
}
module.exports={migrateEnglishDefaults,migrateChecklistRatings,migrateState};
