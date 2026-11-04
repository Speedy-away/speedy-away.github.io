'use strict';
// Static definitions only. Source is read as text; no original code is evaluated.
const fs=require('node:fs'),path=require('node:path');
const COMMIT='743646c9df9ab4c83821b660c12e23a3dda57b49';
const SOURCE_ROOT=path.resolve(__dirname,'../tmp/karo-review',COMMIT);
const PS4_7_9=['7.00','7.01','7.02','7.50','7.51','7.55','8.00','8.01','8.03','8.50','8.52','9.00','9.03','9.04','9.50','9.51','9.60'];
const PS4_75=['7.50','7.51','7.55'];
const NATIVE='Original browser-native preparation and payload loader; not the paired desktop sender or an interchangeable GoldHEN HTTP ABI.';
function entries({sourceRoot=SOURCE_ROOT}={}){
 const source=relative=>{try{return fs.readFileSync(path.join(sourceRoot,relative),'utf8');}catch(e){if(e.code==='ENOENT')return '';throw e;}};
 const present=relative=>{try{return fs.statSync(path.join(sourceRoot,relative)).isFile()&&fs.statSync(path.join(sourceRoot,relative)).size>0;}catch(e){if(e.code==='ENOENT')return false;throw e;}};
 const result=[];
 function define(relative,firmwares,label,contract,notes=[],options={}){
  const folder=relative.split('/')[0],html=source(relative).replace(/<!--[\s\S]*?-->/g,''),required=[relative,...(options.required||[])];
  // Only explicit, executable script references are prerequisites here. Dormant
  // menu branches and cosmetic links are reported separately, not made global blockers.
  const refs=[...html.matchAll(/<script\b[^>]*\bsrc\s*=\s*['"]([^'"]+)['"]/gi),...html.matchAll(/\brunJS\(\s*['"]([^'"]+)['"]/g)];
  for(const match of refs){const ref=match[1].replace(/[?#].*$/,'');if((options.dormantReferences||[]).includes(ref))continue;if(/^[a-z0-9_./-]+\.m?js$/i.test(ref))required.push(path.posix.normalize(path.posix.join(path.posix.dirname(relative),ref)));}
  const missing=[...new Set(required)].filter(file=>!present(file));
  const row={id:'karo-'+relative.replace(/\/index\.html$/,'').replace(/\.html$/,'').replace(/[^a-z0-9]+/gi,'-').toLowerCase(),folder,path:relative,platform:options.platform||'ps4',firmwares:[...firmwares],label,kind:options.kind||'loader',contract:NATIVE+' '+contract,notes:[...notes,'Source matching is not a physical-console execution test.']};
  if(options.ranges)row.ranges=options.ranges.map(range=>[...range]);
  if(options.blockedReason||missing.length)row.blockedReason=[options.blockedReason,missing.length?'Required source files are absent or empty: '+missing.join(', '):''].filter(Boolean).join(' ');
  result.push(row);return row;
 }
 const sevenNotes=['The source title advertises 7.00–7.02; this entry conservatively selects 7.02 because its native chain is the single 702 build.'];
 define('505/index.html',['5.05'],'KARO 5.05','The chosen action opens its original per-payload HTML inside the exp-loader iframe. Preserve that HTML and its native JavaScript dependencies.', ['Some original game actions are embedded JavaScript payloads, not standalone BIN files.']);
 define('505Gold/index.html',['5.05'],'KARO 5.05 Gold','The page selects bin and exploit.js; Mira and Orbis AFR use ordered two/three-BIN exploit variants.',[],{required:['505Gold/exploit.js','505Gold/exploit_bin_x2.js','505Gold/exploit_bin_x3.js','505Gold/binloader.js']});
 define('672/index.html',['6.72'],'KARO 6.72 Manual','Explicit jailbreak; BZIP2 download into PLS, native memory staging and exp_loader.js.', ['Menu and utility payloads use the already prepared native browser context.'],{required:['672/exp_loader.js']});
 define('672A/index.html',['6.72'],'KARO 6.72 Auto','Application-cache events prepare the native context; compressed payloads use exp_loader.js or pl_loader.js according to the original action.', ['Application-cache onnoupdate and onerror can automatically invoke jailbreak.'],{required:['672A/exp_loader.js','672A/pl_loader.js']});
 define('672L/index.html',['6.72'],'KARO 6.72 Light','Raw PLfile; HEN uses exp_loader.js, native listener uses pl_loader.js and utilities use pls_loader.js.',[],{required:['672L/exp_loader.js','672L/pl_loader.js','672L/pls_loader.js']});
 for(const folder of ['702','702L'])define(folder+'/index.html',['7.02'],'KARO 7.02'+(folder.endsWith('L')?' Light':''),'ArrayBuffer XHR, native memory allocation/copy and thread launch through the existing ROP chain. Its separate BIN listener advertises TCP 9020.',[...sevenNotes,...(folder==='702'?['Original Kernel Dumper references missing kerneldumper.bin; enablebrowser.bin is empty. Those actions must remain unavailable.']:[])]);
 for(const folder of ['755','755L'])define(folder+'/index.html',PS4_75,'KARO 7.50 / 7.51 / 7.55'+(folder.endsWith('L')?' Light':''),'BZIP2 to PLS, then jb.js, the exact firmware preloader, payloads.js and loader.js. The native BIN listener advertises 9021.',[folder==='755'?'Some old GoldHEN branches and kernelclock.bin.bz2 are missing upstream; do not enable those individual actions.':'The Light page retains dormant branches for absent full-host files; only its visible, present-file actions are valid.'],{dormantReferences:folder==='755L'?['fanThreshold.js']:[],required:['jb.js','payloads.js','loader.js',...['750','751','755'].map(v=>'preloader'+v+'.js')].map(f=>folder+'/'+f)});
 for(const folder of ['900C','900CM','900N','900NA','900NM','900New']){
  const compressed=['900C','900CM','900NM','900New'].includes(folder),manual=['900CM','900N','900NM'].includes(folder),webkit=['900NM','900New'].includes(folder);
  define(folder+'/index.html',['9.00'],'KARO 9.00 '+folder,(manual?'Manual':'Automatic')+' browser preparation'+(webkit?' using the revised WebKit path':'')+'; '+(compressed?'BZIP2 payload staging':'raw payload staging')+' and the original native ROP/MiraLoader path.', ['Retain the original USB/kernel-exploit prerequisites and original payload selection; a sender cannot replace initial preparation.'],{required:[folder+'/MiraLoader.js']});
 }
 define('900L/index.html',['9.00'],'KARO 9.00 Light','Automatic revised-WebKit/native kernel preparation, then raw ArrayBuffer payload loading.',[],{required:['900L/int64.js','900L/rop.js','900L/kexploit.js','900L/exploit.js']});
 define('G702/index.html',['7.02'],'KARO 7.02 GoldHEN Auto','jbdone automatically selects goldhen_2.3_702.bin and passes its ArrayBuffer to the native ROP loader.',sevenNotes,{required:['G702/goldhen_2.3_702.bin']});
 define('G755/index.html',['7.55'],'KARO 7.55 GoldHEN Auto','The native chain evaluates rop.js, jb.js, goldhen_2.3_755.js and loader.js.', ['The source title is broader, but this entry is pinned to the exact 755 embedded payload. There is no standalone BIN asset in this folder.'],{required:['G755/rop.js','G755/jb.js','G755/goldhen_2.3_755.js','G755/loader.js']});
 define('G900/index.html',['9.00'],'KARO 9.00 GoldHEN Auto','jbdone automatically selects goldhen.bin and passes its ArrayBuffer to the original native loader.',[],{required:['G900/goldhen.bin']});
 define('Goldhen505/index.html',['5.05'],'KARO 5.05 GoldHEN','The cached-page onload handler sets bin=goldhen.bin and invokes the original exploit.js.', ['A prior application-cache flag causes automatic native execution on opening.'],{required:['Goldhen505/exploit.js','Goldhen505/goldhen.bin']});
 define('Goldhen672/index.html',['6.72'],'KARO 6.72 GoldHEN','The cached-page onload handler sets PLfile=goldhen.bin, invokes jailbreak and then exp_loader.js.', ['A prior application-cache flag causes automatic native execution on opening.'],{required:['Goldhen672/goldhen.bin']});
 for(const folder of ['g2all','g2allproold']){
  const moduleBuild=folder==='g2all',firmwareSource=source(folder+(moduleBuild?'/lapse.mjs':'/exploit.js'));
  const validTable=PS4_7_9.every(fw=>firmwareSource.includes(fw));
  define(folder+'/index.html',PS4_7_9,'KARO '+folder,'PSFree and Lapse native preparation with the source-listed per-firmware kernel patches, followed by payload.bin.', ['The exact firmware list comes from the native per-firmware table, not the 7.XX–9.XX title. PS5 is not implemented by this kernel path.'],{required:[folder+'/'+(moduleBuild?'psfree.mjs':'exploit.js'),folder+'/payload.bin',...['700','750','800','850','900','903','950'].map(v=>folder+'/'+(moduleBuild?'kpatch/':'')+v+'.bin')],blockedReason:validTable?'':'The expected exact PS4 7.00–9.60 firmware table could not be confirmed.'});
 }
 const proSource=source('g2allpro/index.html');
 define('g2allpro/index.html',['5.05','5.07',...PS4_7_9],'KARO g2allpro','Firmware-dispatched original exploit5/exploit7_9/exploit10 and later native exploit scripts, followed by payload.bin.', ['The dispatch intervals are discontinuous. Ranges describe the original numeric gates; they do not invent intermediate firmware releases or prove hardware execution.'],{ranges:[['7.00','9.60'],['10.00','11.02'],['11.50','12.02'],['12.50','13.00'],['13.02','13.52']],required:['exploit5.js','exploit7_9.js','exploit10.js','1150_1202.js','1250_13.js','1302_1352.js','payload.bin'].map(f=>'g2allpro/'+f),blockedReason:/fwNum\s*==\s*5\.07/.test(proSource)?'':'The expected g2allpro firmware dispatcher could not be confirmed.'});
 for(const [version,fw]of [['505','5.05'],['672','6.72'],['702','7.02'],['755','7.55']])define('binloader/'+version+'/index.html',[fw],'KARO BIN Loader '+fw,'The original standalone browser entry prepares its native listener. Preserve the nested directory, scripts and original listener port.', ['These pages can start preparation immediately on opening; 6.72, 7.02 and 7.55 advertise port 9021.']);
 define('nobd/620/index.html',['6.20'],'KARO NoBD 6.20','ChendoChap-based native preparation followed by the original LM payload.',[],{kind:'nobd'});
 define('nobd/67X/index.html',['6.72'],'KARO NoBD 6.72','Automatic onload selects payload.bin, invokes jailbreak and exp_loader.js.', ['The kernel script is byte-identical to the reviewed 6.72 manual kernel; broader 6.7X support is not inferred.'],{kind:'nobd',required:['nobd/67X/payload.bin']});
 define('nobd/70X/index.html',['7.02'],'KARO NoBD 7.02','Automatic browser preparation, 702.js/jb.js, preloader.js, payload.js and loader.js.', ['The 70X label is conservatively pinned to its exact 702 native build.'],{kind:'nobd',required:['702.js','jb.js','preloader.js','payload.js','loader.js'].map(f=>'nobd/70X/'+f)});
 define('nobd/75X/index.html',PS4_75,'KARO NoBD 7.50 / 7.51 / 7.55','Automatic browser preparation and the explicitly selected firmware preloader/payload pair.',[],{kind:'nobd',required:['750.js','jb.js','loader.js',...['750','751','755'].flatMap(v=>['preloader'+v+'.js','payload'+v+'.js'])].map(f=>'nobd/75X/'+f)});
 // Enumerate every retained source variant, including historical folders absent
 // from the upstream selector and the distinct USB/Cheat Copy entry documents.
 for(const family of ['restore','restore2']){
  const base=path.join(sourceRoot,family);if(!fs.existsSync(base))continue;
  for(const child of fs.readdirSync(base,{withFileTypes:true}).filter(x=>x.isDirectory()).sort((a,b)=>a.name.localeCompare(b.name))){
   const match=child.name.match(/^(505|672|702|755|900)/),fw=match?({'505':'5.05','672':'6.72','702':'7.02','755':'7.55','900':'9.00'})[match[1]]:null;
   for(const name of ['index.html','usb.html','copych.html']){
    const relative=family+'/'+child.name+'/'+name;if(!present(relative))continue;
    const suffix=name==='usb.html'?' USB':name==='copych.html'?' Cheat Copy':'';
    define(relative,fw?[fw]:[], 'KARO '+family+' '+child.name+suffix,'Original browser-native restore/copy preparation and its embedded or selected payload. Keep this exact entry and its relative dependencies.', ['This can write or restore console data; use only its original matching-console workflow. Historical variants remain separate.'],{kind:'restore',blockedReason:fw?'':'The exact target firmware is unresolved.'});
   }
  }
 }
 function firmwareList(file,name){const text=source(file),match=text.match(new RegExp('(?:const|let|var)\\s+'+name+'\\s*=\\s*\\[([\\s\\S]*?)\\]'));return match?[...match[1].matchAll(/['"](\d+\.\d{2})['"]/g)].map(m=>m[1]):[];}
 const ps5=[
  ['ps5/UMTX/index.html','ps5/UMTX/main.js','supportedFirmwares','ps5/UMTX/offsets/','KARO PS5 UMTX2',['ps5/UMTX/umtx2.js','ps5/UMTX/rop_slave.js']],
  ['ps5/P2JB/index.html','ps5/P2JB/main.js','supportedFirmwares','ps5/P2JB/offsets/','KARO PS5 P2JB',['ps5/P2JB/p2jb.html','ps5/P2JB/core.js','ps5/P2JB/mem.js','ps5/P2JB/poops.js','ps5/P2JB/payloads/elfldr-ps5-1360.elf']],
  ['ps5/poopspl/index.html','ps5/poopspl/poopsploit/main.js','supportedFirmwares','ps5/poopspl/offsets/','KARO PS5 Poopsploit',['ps5/poopspl/poopsploit/poops.html','ps5/poopspl/poopsploit/core.js','ps5/poopspl/poopsploit/mem.js','ps5/poopspl/poopsploit/poops.js','ps5/poopspl/payloads/elfldr-ps5-1360.elf']],
  ['ps5/relapse/index.html','ps5/relapse/firmware.js','SUPPORTED','ps5/relapse/offsets/','KARO PS5 Relapse',['ps5/relapse/relapse.html','ps5/relapse/core.js','ps5/relapse/mem.js','ps5/relapse/exploit.js','ps5/relapse/main.js']],
  ['ps5/pr/poops/index.html','ps5/pr/poops/main.js','supportedFirmwares','ps5/pr/poops/offsets/','KARO PS5 PR Poopsploit',['ps5/pr/poops/core.js','ps5/pr/poops/mem.js','ps5/pr/poops/poops.js','ps5/pr/payloads.js','ps5/pr/payloads/elfldr-ps5-1360.elf']],
  ['ps5/pr/relapse/index.html','ps5/pr/relapse/src/firmware.js','supportedFirmware','ps5/pr/relapse/offsets/','KARO PS5 PR Relapse',['ps5/pr/relapse/src/kexp.js','ps5/pr/relapse/src/relapse_exploit.js','ps5/pr/relapse/src/utils/rop_slave.js','ps5/pr/payloads.js']]
 ];
 for(const [relative,firmwareFile,name,offsetPrefix,label,required]of ps5){
  const firmwares=firmwareList(firmwareFile,name),missingOffsets=firmwares.filter(fw=>!present(offsetPrefix+fw+'.js'));
  define(relative,firmwares,label,'Use the original PS5 browser entry, WebKit/native kernel chain and its own ELF-loader handoff. The exact firmware list is read from the original dispatcher and checked against its offset files.', ['Offset availability establishes source coverage only; author hardware claims are not independent validation. Preserve the original page-to-subpage route and query parameters.'],{platform:'ps5',required:[firmwareFile,...required,...firmwares.map(fw=>offsetPrefix+fw+'.js')],blockedReason:!firmwares.length?'The original PS5 supported-firmware table is unresolved.':missingOffsets.length?'Required PS5 console offsets are unresolved: '+missingOffsets.join(', '):''});
 }
 return result;
}
module.exports={COMMIT,SOURCE_ROOT,PS4_7_9,entries};
