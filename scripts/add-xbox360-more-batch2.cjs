// Convert reviewed source descriptors into pending scoped catalogue entries.
// This does not mark a file ready: prepare-xbox360-more must inspect and archive it.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const target=path.join(root,'docs/xbox360-more-library.json');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function stagedPath(file){
  const absolute=path.resolve(root,file);
  if(!absolute.startsWith(path.join(root,'docs/tmp')+path.sep))throw Error('Staged asset outside docs/tmp');
  return path.relative(root,absolute).replaceAll('\\','/');
}
function normalize(raw){
  const item={...raw};delete item.file;delete item.staged;delete item.verification;
  if(raw.staged||raw.file?.staged)item.sourceFile=stagedPath(raw.staged||raw.file.staged);
  if(raw.file?.name)item.fileName=raw.file.name;
  if(raw.image?.staged){
    const src=path.join(root,stagedPath(raw.image.staged)),bytes=fs.readFileSync(src),sha256=hash(bytes);
    if(raw.image.sha256&&sha256!==raw.image.sha256)throw Error('Artwork checksum mismatch');
    const local='/assets/images/xbox360-more/'+item.id+path.extname(src).toLowerCase();
    const destination=path.join(root,local);fs.mkdirSync(path.dirname(destination),{recursive:true});
    if(fs.existsSync(destination)){if(hash(fs.readFileSync(destination))!==sha256)throw Error('Refusing to replace different artwork');}
    else fs.copyFileSync(src,destination,fs.constants.COPYFILE_EXCL);
    item.image={local,sourceUrl:raw.image.sourceUrl||item.source,credit:raw.image.credit,bytes:bytes.length,sha256};
    if(raw.image.archiveEntry)item.image.archiveEntry=raw.image.archiveEntry;
  }
  if(raw.companions)item.companions=raw.companions.map(c=>({label:c.label||c.role||'Matching coverflow layout',required:c.required||false,format:c.format||'CFLJSON',fileName:c.fileName||c.name,downloadUrl:c.downloadUrl||c.sourceUrl,sourceFile:c.staged?stagedPath(c.staged):c.sourceFile,expectedBytes:c.expectedBytes||c.bytes,expectedSha256:c.expectedSha256||c.sha256,version:c.version,installPath:c.installPath}));
  if(raw.componentFiles){item.components=raw.componentFiles.map(c=>({...c,path:c.relativePath,sourceFile:stagedPath(c.sourceFile),sourceFormat:c.format,format:c.format==='XEX'?'XEX':'Pinned runtime asset'}));delete item.componentFiles;item.expectedFiles=raw.componentFiles.map(c=>({path:path.basename(item.fileName,'.zip')+'/'+c.relativePath,size:c.expectedBytes,sha256:c.expectedSha256}));}
  if(item.id==='dashlaunch-temporary-gui'){item.requirementFilters=['avatar','badupdate'];delete item.requirementFilter;}
  if(item.id==='salvia360'||item.id==='salvia')item.maxBytes=256*1024*1024;
  for(const key of ['id','title','group','version','source','downloadUrl','format','runtime','temporary','prerequisites','launch','installPath','usbPath'])if(!item[key])throw Error('Missing '+key+' for '+item.id);
  if(!Array.isArray(item.setup)||!item.setup.length)throw Error('Missing setup for '+item.id);
  return item;
}
function main(){
  const inputs=process.argv.slice(2);if(!inputs.length)throw Error('Pass reviewed docs/xbox360-more-batch<number>-*.json files.');
  const batchNumbers=inputs.map(file=>Number(file.match(/^docs\/xbox360-more-batch(\d+)-(?:skins|apps|games)\.json$/)?.[1]));
  if(batchNumbers.some(n=>!Number.isSafeInteger(n)||n<2)||new Set(batchNumbers).size!==1)throw Error('Pass descriptors belonging to one valid Xbox360 batch');
  const batchNumber=batchNumbers[0],manifestPath=path.join(root,'docs/xbox360-more-batch'+batchNumber+'.json');
  const data=JSON.parse(fs.readFileSync(target,'utf8'));
  const manifest=fs.existsSync(manifestPath)?JSON.parse(fs.readFileSync(manifestPath,'utf8')):{scope:'xbox360-more',batch:batchNumber,baseline:'docs/qa/xbox360-more-batch'+batchNumber+'-baseline.json',addedIds:[],sourceFiles:[]};
  if(!fs.existsSync(path.join(root,manifest.baseline)))throw Error('Capture the preservation baseline before adding this batch');
  const added=[];
  for(const file of inputs){
    if(!/^docs\/xbox360-more-batch\d+-(?:skins|apps|games)\.json$/.test(file))throw Error('Invalid reviewed descriptor path');
    const source=JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
    for(const raw of source.resources){
      if(data.resources.some(x=>x.id===raw.id)){if(manifest.addedIds.includes(raw.id))continue;throw Error('Refusing to overwrite existing resource '+raw.id);}
      const item=normalize(raw);data.resources.push(item);manifest.addedIds.push(item.id);added.push(item.id);
    }
    if(!manifest.sourceFiles.includes(file))manifest.sourceFiles.push(file);
  }
  manifest.updatedAt=new Date().toISOString();data.reviewed='2026-11-02';
  fs.writeFileSync(target,JSON.stringify(data,null,2)+'\n');fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
  console.log('New pending IDs: '+added.join(','));
}
if(require.main===module)main();
module.exports={normalize,main};
