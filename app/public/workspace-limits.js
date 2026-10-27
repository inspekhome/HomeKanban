(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.WorkspaceLimits=factory();})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 'use strict';
 const MiB=1024*1024,MAX_STATE_BYTES=100*MiB;
 // Save and restore have the same canonical state limit. Reserve transport
 // space for revision/backup metadata; accept older, indented backup files.
 const MAX_REQUEST_BYTES=MAX_STATE_BYTES+MiB,MAX_BACKUP_FILE_BYTES=2*MAX_STATE_BYTES;
 function stateJSON(state){
  const json=JSON.stringify(state);
  if(typeof json!=='string')throw Error('Invalid workspace data.');
  if(new TextEncoder().encode(json).byteLength>MAX_STATE_BYTES)throw Error('The workspace exceeds the 100 MB data limit. Reduce its size before saving or restoring.');
  return json;
 }
 function prepareRestore(backup){
  if(backup?.format!=='soloinspect-backup')throw Error('This is not a valid backup.');
  stateJSON(backup.state);
  // File-only metadata and indentation must not consume the request budget.
  return {format:'soloinspect-backup',state:backup.state};
 }
 return Object.freeze({MAX_STATE_BYTES,MAX_REQUEST_BYTES,MAX_BACKUP_FILE_BYTES,stateJSON,prepareRestore});
});
