'use strict';
const fs=require('node:fs'),path=require('node:path');
const family='"Oswald","Arial Narrow","Segoe UI",sans-serif';
const fontFile=path.join(__dirname,'public/fonts/oswald-variable.ttf');
// Reports must carry the font and its notice: neither a CDN nor an installed
// desktop font is available when a customer opens an offline or hosted copy.
let embedded;
function reportFontCSS(){
 if(!embedded){
  const license=fs.readFileSync(path.join(__dirname,'public/fonts/OFL.txt'),'utf8');
  embedded=`/* ${license.replace(/\*\//g,'* /').replace(/</g,'\\3c ')} */\n@font-face{font-family:"Oswald";font-style:normal;font-weight:200 700;font-display:block;src:url(data:font/ttf;base64,${fs.readFileSync(fontFile).toString('base64')}) format("truetype")}\n`;
 }
 return embedded;
}
module.exports={family,fontFile,reportFontCSS};
