'use strict';
const {createHash}=require('node:crypto');
class MemoryR2 {
 constructor(){this.objects=new Map();this.beforePut=null;this.afterPut=null;this.failDelete=false;}
 async put(key,input,options={}){
  if(this.beforePut)await this.beforePut(key,input,options);
  const old=this.objects.get(key),condition=options.onlyIf;
  if(condition instanceof Headers){
   if(condition.get('If-None-Match')==='*'&&old)return null;
   if(condition.has('If-Match')&&condition.get('If-Match')!=='"'+old?.etag+'"')return null;
  }
  const body=typeof input==='string'?Buffer.from(input):Buffer.from(input);
  const hash=createHash('sha256').update(body).digest('hex');
  if(options.sha256&&options.sha256!==hash)throw Error('Checksum mismatch');
  const value={body,etag:hash,size:body.length,customMetadata:options.customMetadata||{},httpMetadata:options.httpMetadata||{}};
  this.objects.set(key,value);if(this.afterPut)await this.afterPut(key,value);
  return {key,etag:hash,size:body.length};
 }
 async get(key){
  const value=this.objects.get(key);if(!value)return null;
  const body=Buffer.from(value.body);
  return {...value,key,body:new Response(body).body,json:async()=>JSON.parse(body.toString()),text:async()=>body.toString(),arrayBuffer:async()=>body.buffer.slice(body.byteOffset,body.byteOffset+body.byteLength)};
 }
 async head(key){const value=this.objects.get(key);return value?{...value,key,body:undefined}:null;}
 async delete(keys){if(this.failDelete)throw Error('Simulated storage failure');for(const key of Array.isArray(keys)?keys:[keys])this.objects.delete(key);}
 async list({prefix='',limit=1000,cursor}={}){
  const keys=[...this.objects.keys()].sort().filter(key=>key.startsWith(prefix)&&(!cursor||key>cursor)),selected=keys.slice(0,limit);
  return {objects:selected.map(key=>({key})),truncated:keys.length>limit,cursor:selected.at(-1)};
 }
}
module.exports={MemoryR2};
