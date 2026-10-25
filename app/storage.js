'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {DatabaseSync}=require('node:sqlite');

// Run only before opening a workspace. The desktop entry point first checks for
// an existing server so renaming never moves a database used by that server.
function defaultDataDirectory(env=process.env){
 const configured=env.HOMEKANBAN_DATA||env.SOLOINSPECT_DATA;
 if(configured)return path.resolve(configured);
 const base=path.resolve(env.LOCALAPPDATA||os.homedir());
 const target=path.join(base,'HomeKanban'),legacy=path.join(base,'SoloInspect');
 if(fs.existsSync(target)&&fs.existsSync(path.join(legacy,'soloinspect.sqlite'))&&!['homekanban.sqlite','soloinspect.sqlite'].some(name=>fs.existsSync(path.join(target,name)))){
  throw new Error('An empty HomeKanban folder already exists beside your previous workspace. Keep both folders and resolve the destination before starting.');
 }
 if(!fs.existsSync(target)&&fs.existsSync(legacy))fs.renameSync(legacy,target);
 return target;
}

function databasePath(dataDir){
 fs.mkdirSync(dataDir,{recursive:true});
 const target=path.join(dataDir,'homekanban.sqlite'),legacy=path.join(dataDir,'soloinspect.sqlite');
 if(fs.existsSync(target))return target;
 if(fs.existsSync(legacy)){
  // Recover/checkpoint an interrupted old session before changing the filename.
  const db=new DatabaseSync(legacy);
  try{
   const result=db.prepare('PRAGMA wal_checkpoint(TRUNCATE)').get();
   if(result.busy)throw new Error('Close the previous inspection app before opening HomeKanban.');
   if(db.prepare('PRAGMA quick_check').get().quick_check!=='ok')throw new Error('The existing workspace needs recovery before it can be renamed.');
  }finally{db.close();}
  fs.renameSync(legacy,target);
 }
 return target;
}
module.exports={defaultDataDirectory,databasePath};
