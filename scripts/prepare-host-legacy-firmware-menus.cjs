'use strict';
// Metadata preparation only: read original console files as bytes; never execute them.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const repo = 'GamerHack/GamerHack.github.io';
const commit = '23c946a7f85f1338ea2b78163e72e0ce9bc82b68';
const sourceBase = `https://raw.githubusercontent.com/${repo}/${commit}/`;
const dispatchURL = `https://github.com/${repo}/blob/${commit}/505/index.html`;
const stage = 'tmp/host-repository-review/gamerhack-review/files/';
const definitions = [
  {key:'100',gameVersion:'1.00',bytes:1260864,sha256:'09925fe9288bd9e68f49ffaffba3e92fb6ddb1c8cf416e16251cdef53f19a67a',gitBlobSHA1:'a658ceafd4b580c1bfd71173f9c7e6ec4ec91d4c',buttonLine:60,functionLine:319},
  {key:'113',gameVersion:'1.13',bytes:1260864,sha256:'38f847706303c2c2b5b71102073ac86fa534f1bc09b6c40129275a53b0c81718',gitBlobSHA1:'5d14a719a814a38a9e2d3083b07e815f7760686a',buttonLine:61,functionLine:326},
  {key:'119',gameVersion:'1.19',bytes:1260864,sha256:'93fd71c737f4433f72dd594685303e23183859fa448dfafefc15bd8906676f7e',gitBlobSHA1:'563eab1efea2447849115fb12a86d98ff6ae43a9',buttonLine:62,functionLine:333},
  {key:'124',gameVersion:'1.24',bytes:1260864,sha256:'b5566c5629c86f8860ba190537e0c2a2e220c879f469a155b924467b975ec08d',gitBlobSHA1:'9ec99c1ae2c4133edc4f39ac90f65890598ced8f',buttonLine:63,functionLine:340}
];
const read = file => JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const gitBlobSHA1 = bytes => crypto.createHash('sha1').update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest('hex');
function prepare() {
  const comparison = read('tmp/host-repository-review/gamerhack-review/menu-comparison.json');
  const dispatch = fs.readFileSync(path.join(root,stage,'505/index.html'));
  const dispatchText = dispatch.toString('utf8');
  const dispatchSHA256 = sha256(dispatch);
  if (dispatchSHA256 !== '1b8fdb8d8cc186534ac1b5b58a6c60073aaecc28a7dedafaab98cf64d8fbc3f3' || gitBlobSHA1(dispatch) !== 'ec9b7d4fddf3b39013bdd37055ac7225dbce3f44') throw Error('Pinned 5.05 dispatch identity changed');
  if (!dispatchText.includes('<title>PS4 5.05 FW Host v2.5 by GamerHack</title>')) throw Error('Exact firmware host label missing');
  const catalogueFiles = fs.readdirSync(path.join(root,'docs')).filter(file => /^host.*actions(?:-ps[45])?\.json$/.test(file) && file !== 'host-legacy-firmware-menu-actions.json').map(file => 'docs/'+file);
  const existing = catalogueFiles.flatMap(file => (read(file).actions || []).map(action => ({...action,catalogue:file})));
  const audit = read('docs/download-audit.json').items;
  const family = existing.find(action => action.id === 'ps4-oysters-rdr2-129');
  if (!family || family.menuFamily !== 'Oysters' || !family.image || !fs.existsSync(path.join(root,family.image.replace(/^\//,'')))) throw Error('Existing Oysters family artwork missing');
  const actions = [], jobs = [];
  for (const d of definitions) {
    const filename = `OystersMenu-v${d.gameVersion}.bin`;
    const sourceFile = '505/'+filename;
    const importPath = stage+sourceFile;
    const bytes = fs.readFileSync(path.join(root,importPath));
    const prior = comparison.find(row => row.path === sourceFile);
    if (bytes.length !== d.bytes || sha256(bytes) !== d.sha256 || gitBlobSHA1(bytes) !== d.gitBlobSHA1 || prior?.sha !== d.gitBlobSHA1 || prior?.sha256 !== d.sha256) throw Error('Reviewed file identity changed: '+sourceFile);
    if (bytes[0] !== 0xe9 || bytes.subarray(0,64).includes(Buffer.from('var payload'))) throw Error('Not the reviewed flat BIN: '+sourceFile);
    const fn = 'load_Oysters'+d.key;
    const start = dispatchText.indexOf('function '+fn+'(){');
    const body = start < 0 ? '' : dispatchText.slice(start,dispatchText.indexOf('\n}',start)+2);
    const button = dispatchText.split(/\r?\n/)[d.buttonLine-1];
    if (!body.includes('PLfile = "'+filename+'";') || !body.includes('load_payload();') || !button.includes('> RDR2 v'+d.gameVersion+' </button>') || !button.includes('onclick="'+fn+'()"')) throw Error('Exact game-update dispatch mapping missing: '+sourceFile);
    const id = 'ps4-legacy-firmware-gamerhack-oysters505-'+d.key;
    const jobId = 'host-legacy-firmware-gamerhack-oysters505-'+d.key;
    if (existing.some(action => action.sha256 === d.sha256 && action.id !== id)) throw Error('Exact bytes already appear in another action: '+sourceFile);
    if (audit.some(item => item.id !== jobId && item.files?.some(file => file.sha256 === d.sha256))) throw Error('Exact bytes already archived under another item: '+sourceFile);
    const sourceURL = sourceBase+sourceFile;
    const version = `game ${d.gameVersion} - PS4 5.05 - GamerHack 505 ${commit.slice(0,12)} - ${d.sha256.slice(0,12)}`;
    const requirements = [
      `PS4 firmware 5.05 and Red Dead Redemption 2 game update ${d.gameVersion}; game update and console firmware are separate requirements.`,
      'The matching game build must already run on the console. A menu download does not establish game-boot or backport compatibility.',
      'No regional CUSA/title-ID list was supplied for this exact build. Confirm the regional title ID and executable with the original menu requirements.',
      'Menu release is unknown. The host button explicitly labels the RDR2 game update; it does not establish a menu release number.',
      'This exact BIN is mapped by the GamerHack 5.05 host to its in-page native loader. A compatible standalone GoldHEN HTTP, TCP BinLoader or ELF loader has not been established; built-in Load is unavailable.',
      'Use the matching original host or a loader independently confirmed compatible with this exact build. Keep one game menu active at a time.',
      'Download is the original pinned upstream file. Redistribution rights have not been established; no public mirror is supplied. No payload was executed during review.'
    ];
    actions.push({id,label:'Oysters',family:'Oysters',menuFamily:'Oysters',platform:'ps4',category:'mods',game:'RDR2',gameVersion:d.gameVersion,menuVersion:null,titleIds:[],firmwares:['5.05'],legacy:true,format:'BIN',version,bytes:d.bytes,sha256:d.sha256,downloadURL:sourceURL,downloadLabel:'Download BIN',run:null,launchURL:null,hostURL:'https://gamerhack.github.io/505/',hostVariant:'GamerHack 505',variantLabel:'GamerHack 5.05 build',source:dispatchURL,sourceURL,sourceCommit:commit,sourceFile,sourceGitBlobSHA1:d.gitBlobSHA1,firmwareEvidence:'Pinned 505/index.html explicitly identifies PS4 5.05 and maps the RDR2 game-update button to this exact BIN. No later firmware or PS5 support is inferred.',loaderEvidence:{sourceURL:sourceBase+'505/index.html',sourceSHA256:dispatchSHA256,function:fn,functionLine:d.functionLine,payloadPath:sourceFile,transport:'Host-specific in-page XMLHttpRequest ArrayBuffer, copied into native memory at code_addr1 + 0x100000, followed by p.fcall(code_addr1). This is not evidence for a generic external loader ABI.',externalTransportVerified:false},license:'No redistribution licence was established for this compiled menu. Preserve Oysters family and GamerHack host attribution; original upstream download only.',publicMirror:false,image:family.image,imageAlt:'Oysters menu family preview for Red Dead Redemption 2',imageRole:family.imageRole||'Menu preview',imageDescription:'Existing source-published Oysters family showcase reused. It is not a screenshot or hardware verification of this exact historical 5.05 BIN; no current SPRX release version is applied.',requirements,tags:['PS4','5.05','RDR2',d.gameVersion,'Oysters','BIN','GamerHack','older firmware','older game updates'],versionEvidence:{dispatchSource:dispatchURL,sourceSHA256:dispatchSHA256,buttonLine:d.buttonLine,function:fn,functionLine:d.functionLine,file:filename,gameVersion:d.gameVersion,menuVersion:null,note:'The visible upstream button says RDR2 v'+d.gameVersion+'. That is the game update; a separate menu release and regional title-ID list are not supplied.'}});
    jobs.push({id:jobId,title:`Oysters · RDR2 ${d.gameVersion} · PS4 5.05 · GamerHack`,platform:'PS4',category:['Games','RDR2',d.gameVersion],project:'Oysters',kind:'direct',url:sourceURL,capturedUrl:dispatchURL,version,filename,mirror:false,importPath,archiveRole:['Builds'],expectedBytes:d.bytes,expectedSha256:d.sha256,maxBytes:2*1024*1024,pages:['hosts/ps4/rdr2/index.html'],sourceCommit:commit,sourceGitBlobSHA1:d.gitBlobSHA1,sourcePage:dispatchURL,sourceFunction:fn,firmwareScope:['5.05'],gameVersion:d.gameVersion,menuVersion:null,titleIds:[],author:'Oysters',license:'No redistribution licence established for this exact compiled build; original upstream download only.'});
  }
  const at = new Date().toISOString();
  fs.writeFileSync(path.join(root,'docs/host-legacy-firmware-menu-actions.json'),JSON.stringify({schemaVersion:1,updated:at,scope:'Four byte-distinct historical PS4 5.05 Oysters RDR2 game-update variants from the requested GamerHack repository. Original downloads only; host-specific loading ABI is not confirmed for the built-in sender.',notes:['Reuse the existing Oysters family and actual family preview. Keep game update, console firmware and unknown menu release separate.','Retain every older download and existing compatibility pin. Exact file hashes were checked against current action catalogues and archive inventory.','No downloaded file was executed; source-host dispatch does not qualify a generic selected-file Load action.'],sources:[{repo,commit,dispatch:dispatchURL,dispatchSHA256}],actions},null,2)+'\n');
  fs.writeFileSync(path.join(root,'docs/host-legacy-firmware-menu-jobs.json'),JSON.stringify({schemaVersion:1,reviewedAt:at,status:'prepared-awaiting-archive',scope:'Four exact ready BINs for PS4 5.05. Use the targeted importer and normal permission tooling for the F: archive. mirror:false retains original public Downloads; no source archive or helper binary is included.',jobs},null,2)+'\n');
  return {actions:actions.length,jobs:jobs.length,bytes:definitions.reduce((n,d)=>n+d.bytes,0),payloadsExecuted:false,archiveWrites:false,publicMirrorWrites:false};
}
if (require.main === module) {try {console.log(JSON.stringify(prepare(),null,2));} catch(error) {console.error(error.message);process.exitCode=1;}}
module.exports = {repo,commit,definitions,prepare};
