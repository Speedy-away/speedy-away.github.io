// Build an original whatwhatboy Media shortcut with the documented
// kvnhrt/ps5-browser-app packer. This never runs a console payload.
// Source tools are fetched only with --fetch-tools, into ignored docs/tmp/.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const {spawnSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const revision = 'd427877157b5ffdf90847a0c3ad54c7025100f55';
const upstream = 'https://github.com/kvnhrt/ps5-browser-app';
const work = path.join(root, 'docs/tmp/ps5-site-launcher-build');
const assets = path.join(root, 'console/ps5/site-launcher-assets');
const output = path.join(root, 'downloads/ps4-ps5/whatsite-ps5-site-launcher-2026-11-02');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function crc32(bytes) { let crc = -1; for (const value of bytes) { crc ^= value; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); } return (crc ^ -1) >>> 0; }
function chunk(type, bytes) { const name = Buffer.from(type), size = Buffer.alloc(4), sum = Buffer.alloc(4); size.writeUInt32BE(bytes.length); sum.writeUInt32BE(crc32(Buffer.concat([name, bytes]))); return Buffer.concat([size, name, bytes, sum]); }
function inside(x,y,poly) { let hit = false; for(let i=0,j=poly.length-1;i<poly.length;j=i++) { const [xi,yi]=poly[i], [xj,yj]=poly[j]; if((yi>y)!==(yj>y) && x<(xj-xi)*(y-yi)/(yj-yi)+xi)hit=!hit; } return hit; }
function inspectPackage(bytes) {
  if(bytes.length<0x100||bytes.subarray(0,4).toString('hex')!=='7f464948'||bytes.readUInt16LE(6)!==3)throw Error('Unexpected PS5 FIH package structure.');
  const cnt=Number(bytes.readBigUInt64LE(0x58));
  if(!Number.isSafeInteger(cnt)||cnt<0x100||cnt+0x100>bytes.length||bytes.subarray(cnt,cnt+4).toString('hex')!=='7f434e54')throw Error('Invalid embedded CNT.');
  const count=bytes.readUInt32BE(cnt+0x10),table=cnt+bytes.readUInt32BE(cnt+0x18);
  if(count>1000||table+count*32>bytes.length)throw Error('Invalid package entry table.');
  let param,iconBytes;
  for(let i=0;i<count;i++) {
    const row=table+i*32,id=bytes.readUInt32BE(row),start=cnt+bytes.readUInt32BE(row+16),size=bytes.readUInt32BE(row+20);
    if(start+size>bytes.length)throw Error('Package entry exceeds file.');
    if(id===0x2000)param=JSON.parse(bytes.subarray(start,start+size).toString('utf8'));
    if(id===0x1200)iconBytes=bytes.subarray(start,start+size);
  }
  if(param?.titleId!=='WHAT00001'||param?.deeplinkUri!=='https://whatwhatboy.com/console/ps5/'||param?.applicationCategoryType!==65536)throw Error('Shortcut metadata does not match the expected site and Media category.');
  if(!iconBytes||hash(iconBytes)!==hash(fs.readFileSync(path.join(assets,'icon0.png'))))throw Error('Packaged icon differs from the original site icon.');
  return {format:'FullDebug PS5 FIH with embedded CNT',entries:count,mediaCategory:param.applicationCategoryType,deeplinkUri:param.deeplinkUri,titleId:param.titleId,packagedSdkVersion:param.sdkVersion,packagedRequiredSystemSoftwareVersion:param.requiredSystemSoftwareVersion,iconSha256:hash(iconBytes)};
}
const mark = [[100,155],[154,155],[185,280],[228,182],[269,182],[312,280],[343,155],[397,155],[343,357],[292,357],[248,259],[204,357],[153,357]];
function makeIcon() {
  fs.mkdirSync(assets, {recursive:true});
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" rx="92" fill="#071b15"/><rect x="24" y="24" width="464" height="464" rx="72" fill="#0c2720" stroke="#2b6854" stroke-width="2"/><path d="M100 155h54l31 125 43-98h41l43 98 31-125h54l-54 202h-51l-44-98-44 98h-51z" fill="#6be6ad"/><path d="M204 402h104" stroke="#6be6ad" stroke-width="12" stroke-linecap="round"/><circle cx="410" cy="101" r="10" fill="#6be6ad"/></svg>\n`;
  fs.writeFileSync(path.join(assets, 'icon0.svg'), svg);
  const raw=Buffer.alloc(512*(512*4+1));
  for(let y=0;y<512;y++)for(let x=0;x<512;x++) {
    let c=[7,27,21,255];
    const dx=Math.max(96-x,0,x-415),dy=Math.max(96-y,0,y-415);
    if(x>=24&&x<488&&y>=24&&y<488&&dx*dx+dy*dy<72*72)c=[12,39,32,255];
    if(inside(x,y,mark)||(y>=396&&y<408&&x>=204&&x<=308)||(x-410)**2+(y-101)**2<=100)c=[107,230,173,255];
    const p=y*(512*4+1)+1+x*4; for(let i=0;i<4;i++)raw[p+i]=c[i];
  }
  const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(512);ihdr.writeUInt32BE(512,4);ihdr[8]=8;ihdr[9]=6;
  fs.writeFileSync(path.join(assets,'icon0.png'),Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]));
}
async function fetchTools() {
  const response = await fetch(`https://api.github.com/repos/kvnhrt/ps5-browser-app/git/trees/${revision}?recursive=1`);
  if(!response.ok)throw Error('Upstream tree request failed: '+response.status);
  const tree=(await response.json()).tree.filter(item=>item.type==='blob'&&(item.path.startsWith('tools/')||item.path==='LICENSE'));
  fs.mkdirSync(work,{recursive:true});
  for(const item of tree) {
    const file=path.join(work,...item.path.split('/'));
    const data=await fetch(`https://raw.githubusercontent.com/kvnhrt/ps5-browser-app/${revision}/${item.path}`);
    if(!data.ok)throw Error('Source request failed: '+item.path);
    fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,Buffer.from(await data.arrayBuffer()));
  }
  // The installed SDK is .NET 9. These tools have no external package dependencies.
  // Record the compatibility patch; it does not change package content or signing.
  for(const file of ['tools/pkg-builder/pkg-builder.csproj','tools/LibProsperoPKG/src/LibProsperoPkg.csproj']) {
    const full=path.join(work,file); fs.writeFileSync(full,fs.readFileSync(full,'utf8').replaceAll('net10.0','net9.0').replace('<LangVersion>14.0</LangVersion>','<LangVersion>preview</LangVersion>'));
  }
  const cryptoFile=path.join(work,'tools/LibProsperoPKG/src/Util/Crypto.cs');
  fs.writeFileSync(cryptoFile,fs.readFileSync(cryptoFile,'utf8').replace('BitConverter.GetBytes(Index).Reverse().ToArray()', 'Enumerable.Reverse(BitConverter.GetBytes(Index)).ToArray()'));
}
async function main() {
  const recordExisting=process.argv.includes('--record-existing');
  if(!recordExisting)makeIcon();
  const param={applicationCategoryType:65536,applicationDrmType:'free',contentId:'IV9999-WHAT00001_00-WHATWHATBOY00001',contentVersion:'01.000.000',deeplinkUri:'https://whatwhatboy.com/console/ps5/',localizedParameters:{defaultLanguage:'en-US','en-US':{titleName:'whatwhatboy · PS5'}},masterVersion:'01.00',requiredSystemSoftwareVersion:'0x0000000000000000',sdkVersion:'0x0000000000000000',titleId:'WHAT00001'};
  if(!recordExisting)fs.writeFileSync(path.join(assets,'param.json'),JSON.stringify(param,null,2)+'\n');
  if(process.argv.includes('--assets-only'))return;
  if(process.argv.includes('--fetch-tools'))await fetchTools();
  const project=path.join(work,'tools/pkg-builder/pkg-builder.csproj');
  if(!recordExisting) {
    if(!fs.existsSync(project))throw Error('Run with --fetch-tools to prepare the pinned source packer.');
    const stage=path.join(work,'stage');fs.mkdirSync(path.join(stage,'sce_sys'),{recursive:true});
    for(const file of ['param.json','icon0.png'])fs.copyFileSync(path.join(assets,file),path.join(stage,'sce_sys',file));
    fs.writeFileSync(path.join(stage,'eboot.bin'),Buffer.alloc(0));fs.mkdirSync(output,{recursive:true});
    if(fs.readdirSync(output).some(name=>name.endsWith('.pkg')))throw Error('Refusing to replace an existing package. Use a new version/output directory, or --record-existing to verify the saved build.');
    const env={...process.env,DOTNET_CLI_HOME:path.join(work,'.dotnet'),DOTNET_NOLOGO:'1',DOTNET_SKIP_FIRST_TIME_EXPERIENCE:'1'};
    const offline=path.join(work,'offline-nuget');fs.mkdirSync(offline,{recursive:true});
    const restore=spawnSync('dotnet',['restore',project,'--source',offline],{cwd:work,encoding:'utf8',env});
    if(restore.status)throw Error('Offline restore failed: '+restore.stderr+restore.stdout);
    const result=spawnSync('dotnet',['run','--no-restore','--project',project,'-c','Release','--',stage,output],{cwd:work,encoding:'utf8',env});
    process.stdout.write(result.stdout||'');process.stderr.write(result.stderr||'');if(result.status)throw Error('Package builder failed.');
  }
  const pkg=fs.readdirSync(output).find(name=>name.endsWith('.pkg'));if(!pkg)throw Error('Builder emitted no package.');
  const bytes=fs.readFileSync(path.join(output,pkg));
  const structure=inspectPackage(bytes);
  const provenance={version:'2026.11.02.1',upstream,revision,builder:'LibProsperoPkg 2.6.0, locally built from pinned source',buildPatch:'Target net9.0; LangVersion preview; disambiguate byte reversal with Enumerable.Reverse; installed .NET SDK 9.0.307',target:param.deeplinkUri,titleId:param.titleId,filename:pkg,bytes:bytes.length,sha256:hash(bytes),icon:{creator:'whatwhatboy site',path:'/console/ps5/site-launcher-assets/icon0.png',sha256:hash(fs.readFileSync(path.join(assets,'icon0.png')))},structure,nativeExecutableReadiness:{isLaunchReady:false,reason:'eboot.bin is intentionally empty. The documented browser-app shortcut mechanism uses param.json deeplinkUri instead of starting a native executable.'},verification:'Package generated; FIH/CNT bounds, packaged site URI, Media category, title ID and embedded icon hash checked. Never executed or installed on console hardware.'};
  fs.writeFileSync(path.join(root,'docs/ps4-ps5-launcher-build.json'),JSON.stringify(provenance,null,2)+'\n');
  console.log(JSON.stringify(provenance,null,2));
}
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={makeIcon,inspectPackage};
