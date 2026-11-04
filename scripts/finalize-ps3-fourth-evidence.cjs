// Reconcile public source records with completed static archive inspections.
// Reads downloaded files as data only; does not run them or write to the backup.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const inventory=read('docs/ps3-expansion-download-inventory.json');
const files=['docs/ps3-fourth-gta-source-evidence.json','docs/ps3-fourth-cod-source-evidence.json','docs/ps3-fourth-tools-source-evidence.json'];
const completed=[];
for(const filename of files){
  const data=read(filename);
  for(const resource of [...(data.resources||[]),...(data.resourceUpdates||[])]){
    const owner=inventory.items.find(item=>item.resourceId===resource.id);
    if(!owner||owner.status!=='downloaded')continue;
    const original=owner.files.find(file=>!file.memberPath),archive=/\.(zip|rar|7z)$/i.test(original?.name||'');
    if(archive&&(owner.inspection?.integrity?.status!=='passed'||owner.inspection.extractedFiles===undefined))continue;
    const summaries=owner.files.map(file=>({name:file.name,bytes:file.bytes,sha256:file.sha256,archiveRole:file.archiveRole||owner.archiveRole,...(file.memberPath?{memberPath:file.memberPath}:{}),...(file.local?{local:file.local}:{}),...(file.readiness?{readiness:file.readiness}:{}),...(file.pkgHeader?{pkgHeader:file.pkgHeader}:{}),...(file.consoleBinaryHeader?{consoleBinaryHeader:file.consoleBinaryHeader}:{})}));
    resource.archiveEvidence={...resource.archiveEvidence,inventory:'docs/ps3-expansion-download-inventory.json',itemId:owner.id,originalSha256:original.sha256,originalBytes:original.bytes,integrity:archive?'7-Zip CRC/data integrity passed without execution':'Exact transfer size and SHA-256 recorded; inspected as data only',files:summaries,...(owner.inspection?.skippedMembers?.length?{skippedMembers:owner.inspection.skippedMembers}:{}),hardwareExecutionTested:false};
    if(owner.readiness==='incomplete'){
      resource.readiness='incomplete';resource.availability='Incomplete source distribution; originals and inspected components preserved for reference';
      resource.note=[resource.note,owner.readinessReason].filter(Boolean).join(' ');
    }else{
      resource.readiness=resource.readiness==='optional-regional-component'?resource.readiness:'archive-inspected';
      resource.availability=resource.readiness==='optional-regional-component'?'Archived optional regional component; identical file is already included in the full ZIP':archive?'Original archive and selected console files archived; CRC passed. Static console headers checked where applicable; no hardware execution tested.':'Direct console data file archived; exact size and SHA-256 recorded. No hardware execution tested.';
    }
    completed.push(owner.id);
  }
  fs.writeFileSync(path.join(root,filename),JSON.stringify(data,null,2)+'\n');
}
console.log(JSON.stringify({reconciled:completed.length,items:completed},null,2));
