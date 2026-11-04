// Only fetches official, explicitly selected ready files; never executes them.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const seven = 'C:/Program Files/7-Zip/7z.exe';
const jobs = require('../docs/vita-more-jobs.json');
const {createArchive} = require('./console-expansion-archive.cjs');
const archive = createArchive();
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const out = path.join(root, 'docs/vita-more-files.json');
const records = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out,'utf8')).items : [];
function save() {fs.writeFileSync(out,JSON.stringify({scope:jobs.scope,checkedAt:new Date().toISOString(),items:records},null,2)+'\n');}
function inspect(file) {
 const data = fs.readFileSync(file), ext = path.extname(file).toLowerCase();
 if (['.vpk','.zip','.7z'].includes(ext)) {
  execFileSync(seven,['t','-bso0','-bsp0',file],{windowsHide:true,timeout:120000});
  const listing = execFileSync(seven,['l','-slt',file],{windowsHide:true,encoding:'utf8',maxBuffer:20*1024*1024});
  const entries = [...listing.matchAll(/^Path = (.+)$/gm)].map(x=>x[1].trim()).slice(1);
  if (entries.some(x=>/^(?:[A-Za-z]:|[\\/])|(?:^|[\\/])\.\.(?:[\\/]|$)/.test(x))) throw Error('Unsafe archive entry');
  if(ext==='.vpk') {
   for(const needed of ['eboot.bin','sce_sys/param.sfo']) if(!entries.some(x=>x.replaceAll('\\','/')===needed)) throw Error('Missing VPK '+needed);
   const self = execFileSync(seven,['e','-so',file,'eboot.bin'],{windowsHide:true,maxBuffer:80*1024*1024});
   if(self.subarray(0,4).toString('hex')!=='53434500')throw Error('VPK executable is not SCE SELF');
   const sfo = execFileSync(seven,['e','-so',file,'sce_sys/param.sfo'],{windowsHide:true,maxBuffer:2*1024*1024});
   if(sfo.subarray(0,4).toString('hex')!=='00505346')throw Error('Invalid SFO');
  }
  return {format:ext==='.vpk'?'VPK':ext.slice(1).toUpperCase(),entries:entries.length,crc:'passed',paths:entries};
 }
 if(['.skprx','.suprx'].includes(ext) && data.subarray(0,4).toString('hex')==='53434500')return {format:ext.slice(1).toUpperCase(),magic:'SCE SELF'};
 throw Error('Unexpected ready file format: '+file);
}
async function intake(item, url, name, bytes, derivedFrom) {
 const hash = sha(bytes);
 const dir = path.join(root,'downloads/vita-more',item.id,hash.slice(0,12)); fs.mkdirSync(dir,{recursive:true});
 const target = path.join(dir,name);
 if(fs.existsSync(target)){if(sha(fs.readFileSync(target))!==hash)throw Error('Mirror collision');} else fs.writeFileSync(target,bytes,{flag:'wx'});
 const checked=inspect(target);
 const archived=await archive.archiveFile({scope:jobs.scope,item:{id:jobs.scope+'-'+item.id,title:item.title,url:item.project||'https://github.com/'+item.repo,platform:'PS Vita',category:[item.category],pages:['console/psvita/library.html']},file:{name,sourceUrl:url,version:name==='ioplus.skprx'?'1.0':item.version,archiveRole:['Builds'],expectedBytes:bytes.length,expectedSha256:hash,format:checked.format,...(derivedFrom?{derivedFrom}:{})},sourceFile:target});
 const {paths,...inspection}=checked;
 const record={...archived.publicFile,local:'/'+path.relative(root,target).replaceAll('\\','/'),verification:{...inspection,...(paths?{samplePaths:paths.slice(0,12)}:{})}};
 const row=records.find(x=>x.id===item.id)||{id:item.id,files:[]}; if(!records.includes(row))records.push(row);
 if(!row.files.some(x=>x.sha256===hash&&x.name===name))row.files.push(record);
 if(checked.format==='VPK'){
  const img=execFileSync(seven,['e','-so',target,'sce_sys/icon0.png'],{windowsHide:true,maxBuffer:5*1024*1024});
  if(img.subarray(0,8).toString('hex')==='89504e470d0a1a0a'){
   const image='/assets/images/vita-more/'+item.id+'.png'; fs.mkdirSync(path.join(root,'assets/images/vita-more'),{recursive:true});fs.writeFileSync(path.join(root,image),img);
   row.image={local:image,source:url+'#sce_sys/icon0.png',credit:item.author+' · original package icon',bytes:img.length,sha256:sha(img)};
  }
 }
 save();console.log(item.id+': '+name+' · '+bytes.length+' bytes · '+hash);
 return {target,checked,hash};
}
async function main(){
 for(const item of jobs.items){
  for(const url of item.assets){
   const name=item.filename||decodeURIComponent(new URL(url).pathname.split('/').pop());
   const existing=records.find(x=>x.id===item.id)?.files.find(x=>x.sourceUrl===url && !x.derivedFrom);
   if(existing && fs.existsSync(path.join(root,existing.local))){console.log('Preserved '+item.id+'/'+name);continue;}
   try{
    const r=await fetch(url+(url.includes('?')?'&':'?')+'vita_more='+Date.now(),{signal:AbortSignal.timeout(180000)});
    if(!r.ok)throw Error('HTTP '+r.status);
    const len=Number(r.headers.get('content-length'));if(len>200*1024*1024)throw Error('Size limit');
    const bytes=Buffer.from(await r.arrayBuffer());if(bytes.length>200*1024*1024 || len && bytes.length!==len)throw Error('Incomplete/oversize download');
    const result=await intake(item,url,name,bytes);
    if(item.id==='mgba'){
     const vpk=result.checked.paths.find(x=>x.toLowerCase().endsWith('.vpk'));if(!vpk)throw Error('No Vita VPK in mGBA asset');
     const extracted=execFileSync(seven,['e','-so',result.target,vpk],{windowsHide:true,maxBuffer:40*1024*1024});
     await intake(item,url,path.basename(vpk),extracted,{name,sha256:result.hash,member:vpk});
    }
   }catch(e){
    const row=records.find(x=>x.id===item.id)||{id:item.id,files:[]};if(!records.includes(row))records.push(row);
    row.attempts=[...(row.attempts||[]),{url,checkedAt:new Date().toISOString(),status:'unavailable',error:e.message}];save();console.error(item.id+': '+e.message);process.exitCode=1;
   }
  }
 }
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={inspect};
