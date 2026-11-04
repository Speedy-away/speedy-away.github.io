/* Downloads only selected console release assets. Downloaded code is never executed. */
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const {createArchive}=require('./console-expansion-archive.cjs');
const root=path.resolve(__dirname,'..'),scope='3ds-more';
const archive=createArchive();
const seven=process.env.ProgramFiles?path.join(process.env.ProgramFiles,'7-Zip','7z.exe'):'7z';
const read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const safe=s=>String(s).replace(/[^a-zA-Z0-9_.-]/g,'_');
function entries(file){
  const output=execFileSync(seven,['l','-slt',file],{maxBuffer:32*1024*1024,encoding:'utf8'});
  const records=output.split(/\r?\n\r?\n/).filter(x=>/^Path = /m.test(x)&&!/^Type = /m.test(x));
  return records.map(record=>({name:record.match(/^Path = (.*)$/m)[1].trim(),directory:/^Folder = \+/m.test(record),size:Number(record.match(/^Size = (\d+)/m)?.[1]||0)})).filter(x=>!x.directory);
}
function inspect(file,kind){
  const data=fs.readFileSync(file),ext=path.extname(file).toLowerCase();
  if(data.length<16||/^\s*(?:<!doctype|<html|\{"error)/i.test(data.subarray(0,200).toString('utf8')))throw Error('Not a ready binary/container: '+file);
  if(ext==='.3dsx'&&data.subarray(0,4).toString()!=='3DSX')throw Error('Invalid 3DSX header');
  if(ext==='.firm'&&data.subarray(0,4).toString()!=='FIRM')throw Error('Invalid FIRM header');
  if(ext==='.cia'&&(data.length<8192||data.readUInt32LE(0)!==0x2020))throw Error('Invalid CIA header');
  if(!['.zip','.7z'].includes(ext))return [];
  const names=entries(file);
  if(names.some(x=>x.name.startsWith('/')||x.name.split(/[\\/]/).includes('..')))throw Error('Unsafe archive path');
  if(kind==='theme'&&!names.some(x=>/(^|[\\/])body_LZ\.bin$/i.test(x.name)))throw Error('Theme has no body_LZ.bin');
  if(kind!=='theme'&&kind!=='data'&&!names.some(x=>/\.(cia|3dsx|firm)$/i.test(x.name)))throw Error('No ready console executable in archive');
  return names;
}
async function fetchFile(url,target,expected){
  if(fs.existsSync(target)){
    if(expected&&fs.statSync(target).size!==expected)throw Error('Existing stage length differs: '+target);
    return;
  }
  const response=await fetch(url,{headers:{'User-Agent':'whatsite-3ds-expansion','Accept':'application/octet-stream'},signal:AbortSignal.timeout(180000)});
  if(!response.ok)throw Error(`HTTP ${response.status} ${url}`);
  const bytes=Buffer.from(await response.arrayBuffer());
  if(bytes.length>150*1024*1024)throw Error('Selected asset exceeds bounded download');
  if(expected&&bytes.length!==expected)throw Error('Release metadata byte mismatch: '+url);
  fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes,{flag:'wx'});
}
async function run(){
  const specialized=process.argv.includes('--mods-online-only');
  const apps=specialized?read('docs/3ds-mods-online.json').entries:process.argv.includes('--themes-only')?[]:read('docs/3ds-more-app-research.json').apps;
  const themes=specialized||process.argv.includes('--apps-only')?[]:read('docs/themezer-3ds-catalog.json').themes;
  const data=fs.existsSync(path.join(root,'docs/3ds-more-downloads.json'))?read('docs/3ds-more-downloads.json'):{schemaVersion:1,scope,entries:[],checkedAt:new Date().toISOString()};
  const selected=process.argv.find(arg=>arg.startsWith('--ids='))?.slice(6).split(',');
  for(const app of [...apps,...themes.map(t=>({...t,project:t.sourceUrl,group:'theme',assets:[{name:`${t.id}.zip`,url:t.downloadUrl,size:t.expectedBytes}]}))].filter(app=>!selected||selected.includes(app.id))){
    const item={id:`${scope}-${app.id}`,title:app.title,url:app.project,platform:'Nintendo 3DS',category:app.archiveCategory||[app.group==='theme'?'Themes':app.group==='emulators'?'Emulators':app.group==='games'?'Homebrew Games':'Tools'],pages:app.pages||[app.group==='theme'?'console/retro/3ds-themes.html':'console/retro/3ds.html']};
    let row=data.entries.find(x=>x.id===app.id);if(!row){row={id:app.id,title:app.title,files:[],attempts:[]};data.entries.push(row);}
    for(const asset of app.assets){
      if(process.argv.includes('--missing-only')&&row.files.some(f=>f.name===safe(asset.name)&&f.sourceUrl===asset.url&&f.version===app.version&&f.local&&fs.existsSync(path.join(root,f.local))))continue;
      try{
        const dir=path.join(root,'downloads','3ds-more',safe(app.id),safe(app.version));
        const target=path.join(dir,safe(asset.name));
        await fetchFile(asset.url,target,asset.size);
        const contents=inspect(target,app.group==='theme'?'theme':asset.kind==='patch'||asset.role==='required support data'?'data':'app');
        const versions={name:path.basename(target),sourceUrl:asset.url,version:app.version,expectedBytes:asset.size,archiveRole:['Builds'],format:path.extname(target).slice(1).toUpperCase()};
        const result=await archive.archiveFile({scope,item,file:versions,sourceFile:target});
        const publicFile={...result.publicFile,local:'/'+path.relative(root,target).split(path.sep).join('/'),contents:contents.map(x=>x.name)};
        publicFile.label=asset.label||path.basename(target);
        if(!row.files.some(f=>f.sha256===publicFile.sha256&&f.name===publicFile.name))row.files.push(publicFile);
        // Preserve the original container; expose its small ready console builds too.
        if(app.group!=='theme')for(const entry of contents.filter(e=>/\.(cia|3dsx|firm)$/i.test(e.name)&&e.size<=40*1024*1024)){
          const extractedName=path.basename(entry.name.replaceAll('\\','/'));
          const extractedTarget=path.join(dir,safe(extractedName));
          if(extractedTarget===target)continue;
          const bytes=execFileSync(seven,['x','-so',target,entry.name],{maxBuffer:45*1024*1024});
          if(bytes.length!==entry.size)throw Error('Extracted member size differs');
          if(fs.existsSync(extractedTarget)){if(hash(fs.readFileSync(extractedTarget))!==hash(bytes))throw Error('Refusing differing member at destination');}
          else fs.writeFileSync(extractedTarget,bytes,{flag:'wx'});
          inspect(extractedTarget,'app');
          const derived=await archive.archiveFile({scope,item,file:{name:path.basename(extractedTarget),version:app.version,sourceUrl:asset.url,archiveRole:['Builds'],derivedFrom:{name:publicFile.name,sha256:publicFile.sha256,entry:entry.name},format:path.extname(extractedName).slice(1).toUpperCase()},sourceFile:extractedTarget});
          const file={...derived.publicFile,local:'/'+path.relative(root,extractedTarget).split(path.sep).join('/'),label:path.basename(extractedTarget),derivedFrom:{name:publicFile.name,sha256:publicFile.sha256,entry:entry.name}};
          if(!row.files.some(f=>f.sha256===file.sha256&&f.name===file.name))row.files.push(file);
        }
        row.status='archived';console.log(app.id+' '+asset.name+' '+publicFile.bytes+' bytes');
      }catch(error){row.attempts.push({url:asset.url,error:error.message,checkedAt:new Date().toISOString()});row.status=row.files.length?'partially-archived':'unavailable';console.error(app.id+': '+error.message);}
      fs.writeFileSync(path.join(root,'docs/3ds-more-downloads.json'),JSON.stringify(data,null,2)+'\n');
    }
    const complete=app.assets.every(asset=>row.files.some(f=>f.name===safe(asset.name)&&f.sourceUrl===asset.url&&f.version===app.version));
    row.status=complete?'archived':row.files.length?'partially-archived':'unavailable';
  }
  data.checkedAt=new Date().toISOString();fs.writeFileSync(path.join(root,'docs/3ds-more-downloads.json'),JSON.stringify(data,null,2)+'\n');
  const themeCatalogue=read('docs/themezer-3ds-catalog.json');
  for(const theme of themeCatalogue.themes){const file=data.entries.find(e=>e.id===theme.id)?.files.find(f=>f.contents?.some(n=>/body_LZ\.bin$/.test(n)));if(file){theme.localDownload=file.local;theme.bytes=file.bytes;theme.sha256=file.sha256;theme.contents=file.contents;}}
  fs.writeFileSync(path.join(root,'docs/themezer-3ds-catalog.json'),JSON.stringify(themeCatalogue,null,2)+'\n');
  console.log(JSON.stringify({entries:data.entries.length,files:data.entries.reduce((n,e)=>n+e.files.length,0),unavailable:data.entries.filter(e=>e.status!=='archived').map(e=>e.id)}));
}
if(require.main===module)run().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={inspect};
