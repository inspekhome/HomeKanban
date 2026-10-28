'use strict';
const {createHash}=require('node:crypto');
const digest=value=>createHash('sha256').update(value).digest('hex');
function packageReport(report,renderHTML){
  const assets=new Map();
  let html=renderHTML(report).replace(/src="data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)"/g,(_,type,base64)=>{
    const body=Buffer.from(base64,'base64'),sha256=digest(body),name=sha256+'.'+(type==='jpeg'?'jpg':type);
    assets.set(name,{name,body,sha256,bytes:body.length});
    return 'loading="lazy" decoding="async" src="files/'+name+'"';
  });
  const body=Buffer.from(html,'utf8');
  assets.set('index.html',{name:'index.html',body,sha256:digest(body),bytes:body.length});
  const files=[...assets.values()];
  if(files.length>1000||files.some(file=>file.bytes>12*1024*1024)||files.reduce((sum,file)=>sum+file.bytes,0)>100*1024*1024)throw Error('This web report exceeds the hosting limit (100 MB total, 12 MB per file, 1,000 files). Reduce its size before publishing.');
  return {files,manifest:{files:files.map(({body,...file})=>file)},snapshot:digest(JSON.stringify(report))};
}
module.exports={packageReport,digest};
