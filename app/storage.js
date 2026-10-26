'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {DatabaseSync}=require('node:sqlite');

// Run only before opening a workspace. The desktop entry point first checks for
// an existing server so renaming never moves a database used by that server.
function defaultDataDirectory(env=process.env){
 const configured=env.HOMEKANBAN_DATA||env.SOLOINSPECT_DATA;
 if(configured)return path.resolve(configured);
 // Keep an explicitly recovered workspace outside AppData redirection. This
 // per-user file is shared by ordinary desktop and packaged development launches.
 // Never silently fall back to an empty workspace if its saved location is lost.
 const locationFile=path.join(env.USERPROFILE||os.homedir(),'.homekanban-workspace.json');
 if(fs.existsSync(locationFile)){
  let location;
  try{location=JSON.parse(fs.readFileSync(locationFile,'utf8'));}catch{throw new Error('The saved HomeKanban workspace location is invalid. Keep your data files and repair '+locationFile);}
  if(location?.format!=='homekanban-workspace-location'||typeof location.dataDirectory!=='string'||!path.isAbsolute(location.dataDirectory))throw new Error('The saved HomeKanban workspace location must contain an absolute data directory: '+locationFile);
  const directory=path.resolve(location.dataDirectory),file=path.join(directory,'homekanban.sqlite');
  if(!fs.existsSync(file))throw new Error('Your saved HomeKanban workspace is missing: '+file+'. No empty workspace was created.');
  let db;
  try{db=new DatabaseSync(file,{readOnly:true});const row=db.prepare('SELECT revision,json FROM documents WHERE id=1').get();if(!row||!Number.isInteger(row.revision)||!JSON.parse(row.json)?.profile)throw new Error('Invalid workspace');}
  catch{throw new Error('Your saved HomeKanban workspace could not be read: '+file+'. No empty workspace was created.');}
  finally{db?.close();}
  return directory;
 }
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
