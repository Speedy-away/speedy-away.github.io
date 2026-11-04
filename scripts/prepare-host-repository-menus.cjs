'use strict';
// Prepare reviewed metadata only. Console files are read as bytes, never executed.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const commit = '23c946a7f85f1338ea2b78163e72e0ce9bc82b68';
const repo = 'GamerHack/GamerHack.github.io';
const sourceBase = `https://raw.githubusercontent.com/${repo}/${commit}/`;
const dispatchURL = `https://github.com/${repo}/blob/${commit}/900v3/index.html`;
const stage = 'tmp/host-repository-review/gamerhack-review/files/';
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const definitions = [
  {key:'wildemodz138',family:'WildeModz',gameVersion:'1.38',file:'WildeModz-1.38.bin',fn:'load_WildeModz138',bytes:593216,sha256:'e82fe24709f9155bc1c77ffa1b2318bee03b5ec7bb4d120b7aadf21b48f6adf8'},
  {key:'arabicguy100',family:'ArabicGuy',gameVersion:'1.00',file:'arabic-guy100.bin',fn:'load_arabicGuy100',bytes:1055408,sha256:'80849dc10d770b5e4596b0c32774b03b156245c18f1527157d6a967854b990a8'},
  {key:'arabicguy127',family:'ArabicGuy',gameVersion:'1.27',file:'arabic-guy127.bin',fn:'load_arabicGuy127',bytes:1055408,sha256:'a603fa84029a0c9bd29e3e5d6ea2f97aa668f0600403c4102f4c35b186b982f4'},
  {key:'arabicguy132',family:'ArabicGuy',gameVersion:'1.32',file:'arabic-guy132.bin',fn:'load_arabicGuy132',bytes:1055408,sha256:'3dddf0161fb409e7e9711c6b53e4eaef4c34f9768e263a9821b217b1bde00daa'}
];
function prepare() {
  const comparison = JSON.parse(fs.readFileSync(path.join(root,'tmp/host-repository-review/gamerhack-review/menu-comparison.json'),'utf8'));
  const dispatch = fs.readFileSync(path.join(root,stage,'900v3/index.html'));
  const dispatchText = dispatch.toString('utf8');
  const dispatchSHA256 = hash(dispatch);
  if (!/PS4 9\.00 FW Host v3\.0 by GamerHack/.test(dispatchText)) throw Error('Exact firmware host label missing');
  const existing = ['docs/host-game-actions.json','docs/host-legacy-menu-actions.json'].flatMap(file => JSON.parse(fs.readFileSync(path.join(root,file),'utf8')).actions);
  const actions = [], jobs = [];
  for (const d of definitions) {
    const sourcePath = '900v3/' + d.file;
    const prior = comparison.find(row => row.path === sourcePath);
    const importPath = stage + sourcePath;
    const bytes = fs.readFileSync(path.join(root,importPath));
    if (bytes.length !== d.bytes || hash(bytes) !== d.sha256) throw Error('Reviewed file identity differs: ' + d.file);
    if (!prior || prior.bytes !== d.bytes || prior.sha256 !== d.sha256 || prior.existingMatches.length || prior.sharedInventoryMatches.length) throw Error('Missing or duplicate comparison record: ' + d.file);
    const start = dispatchText.indexOf('function ' + d.fn + '(){');
    const body = start < 0 ? '' : dispatchText.slice(start,dispatchText.indexOf('\n}',start)+2);
    if (!body.includes('PLfile = "' + d.file + '";') || !body.includes('load_poc();')) throw Error('Exact upstream dispatch mapping missing: ' + d.file);
    if (existing.some(action => action.sha256 === d.sha256)) throw Error('Build already exists in an earlier catalogue: ' + d.file);
    const existingFamily = existing.find(action => action.label === d.family && action.image);
    const sourceURL = sourceBase + sourcePath;
    const version = `game ${d.gameVersion} - PS4 9.00 - GamerHack 900v3 ${commit.slice(0,12)} - ${d.sha256.slice(0,12)}`;
    const id = 'ps4-repository-gamerhack-' + d.key;
    const requirements = [
      `PS4 firmware 9.00 and GTA V game update ${d.gameVersion}; the game update is separate from console firmware.`,
      'No regional CUSA list was supplied for this exact build. Confirm the title ID and executable before using it.',
      'The reviewed GamerHack 900v3 host loads this exact BIN through its in-page native loader. Compatible standalone GoldHEN HTTP or ELF-loader support has not been verified; built-in Load is unavailable.',
      'Use the matching original host or a native loader confirmed compatible with this exact build. Keep one game menu active at a time.',
      'Menu release is not independently established. The source button and file numbers identify the game build; they are not asserted as menu releases.',
      'Download is the original pinned upstream file. No public mirror or redistribution licence is asserted. No payload was executed during review.'
    ];
    actions.push({id,label:d.family,family:d.family,menuFamily:d.family,platform:'ps4',category:'mods',game:'GTA V',gameVersion:d.gameVersion,menuVersion:null,titleIds:[],firmwares:['9.00'],legacy:true,format:'BIN',bytes:d.bytes,sha256:d.sha256,downloadURL:sourceURL,run:null,launchURL:null,hostURL:'https://gamerhack.github.io/900v3/',hostVariant:'GamerHack 900v3',variantLabel:'GamerHack 900v3 build',source:dispatchURL,sourceURL,sourceCommit:commit,sourceFile:sourcePath,sourceGitBlobSHA1:prior.sha,firmwareEvidence:'Pinned 900v3/index.html identifies PS4 9.00 and maps the exact menu function to this BIN. No other firmware or PS5 support is inferred.',loaderEvidence:{sourceURL:sourceBase+'900v3/index.html',sourceSHA256:dispatchSHA256,function:d.fn,payloadPath:sourcePath,transport:'In-page XMLHttpRequest ArrayBuffer copied into native executable memory, then passed to pthread_create. No generic external loading transport is enabled.'},license:'No redistribution licence was established for this compiled menu. Preserve original authorship and host attribution; original upstream download only.',publicMirror:false,image:existingFamily?.image||'/assets/images/gta52.png',imageAlt:'Grand Theft Auto V artwork for the '+d.family+' menu family',imageRole:'Game artwork',imageDescription:'Existing GTA V artwork reused from this menu family; not a screenshot or hardware verification of the exact build.',requirements,tags:['PS4','GTA V',d.family,d.gameVersion,'9.00','BIN','GamerHack','900v3','older game updates'],versionEvidence:{dispatchSource:dispatchURL,sourceSHA256:dispatchSHA256,function:d.fn,file:d.file,gameVersion:d.gameVersion,menuVersion:null,note:'Game update follows the existing menu family mapping and original host selection. No independent menu release number or title ID was supplied.'}});
    jobs.push({id:'host-repository-gamerhack-'+d.key,title:`${d.family} · GTA V ${d.gameVersion} · GamerHack 900v3`,platform:'PS4',category:['Games','GTA5',d.gameVersion],project:d.family,kind:'direct',url:sourceURL,capturedUrl:dispatchURL,version,filename:d.file,mirror:false,importPath,archiveRole:['Builds'],expectedBytes:d.bytes,expectedSha256:d.sha256,maxBytes:2*1024*1024,pages:['hosts/ps4/gta5/index.html'],sourceCommit:commit,sourceGitBlobSHA1:prior.sha,sourcePage:dispatchURL,sourceFunction:d.fn,firmwareScope:['9.00'],gameVersion:d.gameVersion,menuVersion:null,titleIds:[],author:d.family,license:'No redistribution licence established for this exact compiled build; personal archive and original upstream download only.'});
  }
  const at = new Date().toISOString();
  fs.writeFileSync(path.join(root,'docs/host-repository-menu-actions.json'),JSON.stringify({schemaVersion:1,updated:at,scope:'Four byte-distinct PS4 9.00 GTA V menu builds selected from the requested GamerHack repository. Original upstream downloads only; no unverified Load transport or public mirror.',notes:['Group under existing WildeModz and ArabicGuy menu families. Keep game update and menu release separate.','Exact hashes differ from earlier Nazky/Kameleon builds; retain every previous action and archived file.','Source-host in-page loading is evidence for that host pairing only. No downloaded console code was executed.'],sources:[{repo,commit,dispatch:dispatchURL,dispatchSHA256}],actions},null,2)+'\n');
  fs.writeFileSync(path.join(root,'docs/host-repository-menu-jobs.json'),JSON.stringify({schemaVersion:1,reviewedAt:at,status:'prepared-awaiting-archive',scope:'Four exact ready BIN files. Run the existing targeted importer with these jobs and an explicitly supplied F: backup root using normal permission tooling. mirror:false preserves original-only public Downloads. No source repository archive or unrelated binary is included.',jobs},null,2)+'\n');
  return {actions:actions.length,jobs:jobs.length,bytes:definitions.reduce((n,d)=>n+d.bytes,0),payloadsExecuted:false,archiveWrites:false,publicMirrorWrites:false};
}
if (require.main === module) { try { console.log(JSON.stringify(prepare(),null,2)); } catch (error) { console.error(error.message); process.exitCode = 1; } }
module.exports = {commit,definitions,prepare};
