// Download only three selected original-Xbox release assets. Never run their XBEs.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const write=(file,data)=>fs.writeFileSync(path.join(root,file),JSON.stringify(data,null,2)+'\n');
const selections=[
 {id:'lithiumx',metadata:'lithium',title:'LithiumX',asset:'LithiumX.zip',group:'Dashboards',description:'A native nxdk dashboard with title browsing, artwork support and an FTP server.',setup:'Extract the complete folder to an applications directory on your existing homebrew-enabled Xbox, such as E:/Apps/LithiumX/. Launch default.xbe from your current dashboard. The first launch creates E:/UDATA/LithiumX/lithiumx.toml for search paths.',source:'https://github.com/Ryzee119/LithiumX',notes:'This original repository is archived. Its v0.9.7 notes fix cache clearing affecting E:/CACHE. Keep your existing dashboard and configuration; no boot-dashboard replacement is required.'},
 {id:'nevolutionx',metadata:'nevolution',title:'NevolutionX',asset:'NevolutionX.zip',group:'Dashboards',description:'An original Xbox dashboard and application launcher built with nxdk. The release ZIP contains a native Xbox ISO.',setup:'Extract NevolutionX.iso from the ZIP, then use an Xbox XISO-aware tool on your PC to extract its complete application folder. Transfer default.xbe and all companion assets together to a separate directory, for example E:/Apps/NevolutionX/, and launch from your current dashboard. The project documents DHCP networking and an automatically started FTP server with xbox/xbox credentials.',source:'https://github.com/dracc/NevolutionX',notes:'The nevox_hdd.zip emulator HDD image is deliberately excluded. This is the native application ISO in its original ZIP, not an emulator HDD image or a directly installable folder ZIP.'},
 {id:'sdlpopx',metadata:'sdlpopx',title:'SDLPoPX',asset:'SDLPoP_Xbox.zip',group:'Game ports',description:'The original Xbox port of the SDLPoP Prince of Persia engine.',setup:'Extract the complete Xbox release into a separate game folder, for example E:/Games/SDLPoPX/. Keep the supplied data and configuration beside default.xbe, then launch it from your existing dashboard.',source:'https://github.com/Ryzee119/SDLPoPX',notes:'Use the Xbox ZIP linked here. The similarly named Xbox-Homebrew/SDLPoP release is an APPX/UWP build, which is not an original Xbox XBE.'}
];
function inspectXbe(bytes){
 if(bytes.length<0x178||bytes.subarray(0,4).toString()!=='XBEH')throw Error('Not an original Xbox XBE header');
 const base=bytes.readUInt32LE(0x104),headers=bytes.readUInt32LE(0x108),sections=bytes.readUInt32LE(0x11c),table=bytes.readUInt32LE(0x120)-base;
 if(headers<0x178||headers>bytes.length||sections<1||sections>256||table<0||table+sections*0x38>headers)throw Error('Invalid XBE header bounds');
 for(let index=0;index<sections;index++){
  const offset=table+index*0x38,raw=bytes.readUInt32LE(offset+12),size=bytes.readUInt32LE(offset+16);
  if(raw>bytes.length||size>bytes.length-raw)throw Error('Truncated XBE section');
 }
 return {magic:'XBEH',bytes:bytes.length,sha256:hash(bytes),sections,headerBytes:headers};
}
function inspectXiso(bytes){
 const descriptor=0x10000,magic='MICROSOFT*XBOX*MEDIA';
 if(bytes.subarray(descriptor,descriptor+20).toString()!==magic)throw Error('Not an Xbox XISO');
 const sector=bytes.readUInt32LE(descriptor+20),size=bytes.readUInt32LE(descriptor+24),start=sector*2048;
 if(start>bytes.length||size>bytes.length-start)throw Error('Truncated XISO directory');
 const seen=new Set();
 function find(offset){
  if(seen.has(offset)||seen.size>4096||offset<0||offset+14>size)throw Error('Invalid XISO directory tree');
  seen.add(offset);const at=start+offset;
  const left=bytes.readUInt16LE(at),right=bytes.readUInt16LE(at+2),length=bytes[at+13];
  if(offset+14+length>size)throw Error('Truncated XISO filename');
  const name=bytes.subarray(at+14,at+14+length).toString();
  if(name.toLowerCase()==='default.xbe'){
   const position=bytes.readUInt32LE(at+4)*2048,length=bytes.readUInt32LE(at+8);
   if(position>bytes.length||length>bytes.length-position)throw Error('Truncated XISO executable');
   return {executable:name,...inspectXbe(bytes.subarray(position,position+length))};
  }
  return (left&&find(left*4))||(right&&find(right*4))||null;
 }
 const result=find(0);if(!result)throw Error('No default.xbe in native Xbox ISO');return result;
}
function inspectZip(file){
 const seven='C:/Program Files/7-Zip/7z.exe';
 execFileSync(seven,['t',file],{stdio:'pipe',maxBuffer:4*1024*1024});
 const listing=execFileSync(seven,['l','-slt',file],{encoding:'utf8',maxBuffer:4*1024*1024});
 const names=[...listing.slice(listing.indexOf('----------')).matchAll(/^Path = (.+)$/gm)].map(match=>match[1].trim());
 if(names.some(name=>/^(?:[/\\]|[A-Za-z]:)|(?:^|[/\\])\.\.(?:[/\\]|$)/.test(name)))throw Error('Unsafe archive path');
 const executable=names.find(name=>/(?:^|[/\\])default\.xbe$/i.test(name));
 if(!executable){
  const iso=names.find(name=>/\.iso$/i.test(name));if(!iso)throw Error('No native default.xbe or Xbox ISO in selected release');
  const bytes=execFileSync(seven,['e','-so',file,iso],{maxBuffer:32*1024*1024});
  return {crcPassed:true,entries:names.length,container:'Xbox ISO inside ZIP',iso,...inspectXiso(bytes)};
 }
 const bytes=execFileSync(seven,['e','-so',file,executable],{maxBuffer:32*1024*1024});
 return {crcPassed:true,entries:names.length,executable,...inspectXbe(bytes)};
}
async function main(){
 if(!process.argv.includes('--download'))throw Error('Use --download to prepare and archive the explicit three native release files.');
 const archive=require('./console-expansion-archive.cjs').createArchive();
 const resources=[];
 const snapshotFile='docs/original-xbox-release-snapshots.json';
 const releases=fs.existsSync(path.join(root,snapshotFile))?read(snapshotFile):{};
 for(const pick of selections){
  const release=releases[pick.id]||read('tmp/original-xbox-'+pick.metadata+'-release.json');
  releases[pick.id]=release;
  const asset=release.assets.find(asset=>asset.name===pick.asset);
  const publishedSource=release.html_url?.split('/releases/tag/')[0];
  const allowedSources=pick.id==='sdlpopx'?[pick.source,'https://github.com/Ryzee119/SDLPoP']:[pick.source];
  if(!asset||!allowedSources.includes(publishedSource)||!asset.browser_download_url.startsWith(publishedSource+'/releases/download/'))throw Error('Wrong release asset source');
  const local='/downloads/original-xbox/'+pick.id+'/'+release.tag_name+'/'+asset.name;
  const target=path.join(root,local.slice(1));
  let bytes;
  if(fs.existsSync(target))bytes=fs.readFileSync(target);
  else{
   const response=await fetch(asset.browser_download_url,{signal:AbortSignal.timeout(60000)});
   if(!response.ok)throw Error('Release HTTP '+response.status);
   bytes=Buffer.from(await response.arrayBuffer());
   if(bytes.length!==asset.size||bytes.subarray(0,2).toString()!=='PK')throw Error('Release asset size or ZIP signature differs');
   fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes,{flag:'wx'});
  }
  if(bytes.length!==asset.size)throw Error('Preserved local release size differs');
  const inspection=inspectZip(target),sha256=hash(bytes);
  if(asset.digest&&asset.digest!=='sha256:'+sha256)throw Error('Publisher release digest mismatch');
  const saved=await archive.archiveFile({scope:'original-xbox',item:{id:'original-xbox-'+pick.id,title:pick.title,platform:'Original Xbox',category:[pick.group],project:pick.title,url:pick.source,release:release.tag_name,pages:['console/retro/xbox.html']},file:{name:asset.name,version:release.tag_name,sourceUrl:asset.browser_download_url,resolvedUrl:asset.browser_download_url,local,expectedBytes:bytes.length,expectedSha256:sha256,archiveRole:['Builds']},sourceFile:target});
  resources.push({...pick,metadata:undefined,asset:undefined,version:release.tag_name,release:release.html_url,file:saved.publicFile,inspection});
  console.log(pick.title+': archived '+bytes.length+' bytes; CRC and native XBE sections verified');
 }
 write(snapshotFile,releases);
 write('docs/original-xbox-catalogue.json',{reviewed:'2026-11-02',scope:'original-xbox',resources,sourceIndex:'https://github.com/XboxDev/nxdk/wiki/Projects-using-nxdk',sourceOnly:[{title:'Peanut-GB Xbox port',source:'https://github.com/Ryzee119/Peanut-GB/tree/xbox/port/xbox',status:'Source project only; no tagged ready release returned by the publisher release endpoint in this review. No source archive downloaded.'}],excluded:[{source:'https://github.com/Xbox-Homebrew/SDLPoP',reason:'UWP/APPX build, not original Xbox.'}],limits:['No downloaded build executed.','No physical console testing.','Recorded SHA-256 values measure the fetched release bytes; these older GitHub assets expose no publisher digest.']});
}
module.exports={inspectXbe,inspectXiso,inspectZip,selections};
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
