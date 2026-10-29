'use strict';
const {randomUUID}=require('node:crypto');
const baseline=require('./data/system-template.json');
const fastNotes=require('./data/fast-notes.json');
const categories=['Defect/Action Needed','Marginal/Deferred Maintenance','Recommendation','Notes'];
const {ratings}=require('./ratings');
// This reviewed baseline is versioned with the app. Seed only a new workspace;
// never replace existing templates or report snapshots during an upgrade.
function systemTemplate(){
 const template=structuredClone(baseline);template.id=randomUUID();template.isSystem=true;
 for(const section of template.sections){section.id=randomUUID();for(const item of section.items)Object.assign(item,{id:randomUUID(),selected:[],rating:'',note:'',limitation:''});}
 return template;
}
function seed(){return {schema:2,profile:{name:'',business:'',license:'',email:'',phone:'',address:'',website:'',logo:''},templates:[systemTemplate()],noteLibrary:fastNotes.map(note=>({...structuredClone(note),id:randomUUID()})),reports:[]};}
module.exports={seed,categories,ratings};
