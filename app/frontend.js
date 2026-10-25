'use strict';
const fs=require('node:fs'),path=require('node:path');
// Keep the established script URLs usable while an older local server is still running.
// Packaged files contain their dependencies; development serves the same bundles on demand.
const bundles={'app.js':['wording.js','app.js'],'notes.js':['wording-editor.js','photo-editor.js','notes.js']};
function readFrontendAsset(publicDir,name){
 const source=fs.readFileSync(path.join(publicDir,name),'utf8'),parts=bundles[name];
 if(!parts)return source;
 const marker=`// SoloInspect bundled ${name}\n`;
 if(source.startsWith(marker))return source;
 return marker+parts.map(part=>part===name?source:fs.readFileSync(path.join(publicDir,part),'utf8')).join('\n;\n');
}
function bundleFrontend(sourceDir,destinationDir){
 for(const name of Object.keys(bundles))fs.writeFileSync(path.join(destinationDir,name),readFrontendAsset(sourceDir,name));
}
module.exports={readFrontendAsset,bundleFrontend};
