// Follow explicit archive move history, never filename guesses or platform labels.
function createRelocationRepair(reports,{exists,verify}) {
 const moves=new Map(),verified=new Set();
 const identity=(id,file,location)=>JSON.stringify([id,String(location).replaceAll('\\','/').toLowerCase(),file.name,file.bytes,String(file.sha256).toLowerCase(),file.version||file.releaseTag||null]);
 for(const report of reports)for(const item of report.items||[])for(const file of item.files||[]){
  if(!file.backupPath||!file.previousBackupPaths?.length||!exists(file.backupPath))continue;
  for(const previous of file.previousBackupPaths||[]){const key=identity(item.id,file,previous);if(!moves.has(key))moves.set(key,file);}
 }
 return (id,file)=>{
  if(!file.backupPath||exists(file.backupPath))return file;
  const target=moves.get(identity(id,file,file.backupPath));if(!target)return file;
  const key=identity(id,target,target.backupPath);if(!verified.has(key)){verify(target);verified.add(key);}
  const result={...file,...target,local:file.local||target.local,
   previousBackupPaths:[...new Set([...(file.previousBackupPaths||[]),file.backupPath,...(target.previousBackupPaths||[])])],
   relocationOriginalFileRecords:[...new Map([...(file.relocationOriginalFileRecords||[]),...(target.relocationOriginalFileRecords||[]),file].map(record=>[JSON.stringify(record),record])).values()],
   relocationMethod:'Explicit previousBackupPaths, same owner/name/version/size/SHA-256, verified current bytes'};
  delete result.archiveAvailabilityReason;
  return result;
 };
}
module.exports={createRelocationRepair};
