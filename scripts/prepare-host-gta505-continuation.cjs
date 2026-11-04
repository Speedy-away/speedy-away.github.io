'use strict';
// Static metadata and byte verification only; no downloaded code executes.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const commit='23c946a7f85f1338ea2b78163e72e0ce9bc82b68';
const sourceBase=`https://raw.githubusercontent.com/GamerHack/GamerHack.github.io/${commit}/`;
const manifest='docs/host-gta505-continuation-actions.json';
function prepare(){
 const source=fs.readFileSync(path.join(root,'tmp/host-review-20261103/GamerHack/505/index.html'));
 if(sha(source)!=='1b8fdb8d8cc186534ac1b5b58a6c60073aaecc28a7dedafaab98cf64d8fbc3f3')throw Error('Dispatch identity mismatch');
 const refresh=read('docs/qa/host-source-refresh-20261103.json');
 if(refresh.repositories.find(x=>x.repo.startsWith('GamerHack')).commit!==commit)throw Error('Upstream changed; review required');
 const original=read('docs/host-repository-menu-actions.json').actions;
 const definitions=read('docs/qa/host-remaining-menu-review.json').remainingDistinctCandidates.filter(x=>x.sourceFirmware==='5.05');
 const actions=[],jobs=[];
 const all=fs.readdirSync(path.join(root,'docs')).filter(x=>/^host.*actions(?:-ps[45])?\.json$/.test(x)&&'docs/'+x!==manifest).flatMap(x=>read('docs/'+x).actions||[]);
 for(const d of definitions){
  const family=d.path.includes('arabic')?'ArabicGuy':'WildeModz',key=(family+'505'+d.gameVersion.replace('.','')).toLowerCase();
  const fn='load_'+(family==='ArabicGuy'?'arabicGuy':'WildeModz')+d.gameVersion.replace('.','');
  const text=source.toString(),start=text.indexOf('function '+fn+'(){'),body=text.slice(start,text.indexOf('\n}',start)+2);
  const file=path.basename(d.path),importPath='tmp/host-review-20261103/GamerHack/'+d.path,b=fs.readFileSync(path.join(root,importPath));
  const blob=crypto.createHash('sha1').update(Buffer.from(`blob ${b.length}\0`)).update(b).digest('hex');
  if(start<0||!body.includes('PLfile = "'+file+'";')||!body.includes('load_payload();')||!text.includes('onclick="'+fn+'()"'))throw Error('Missing exact dispatch '+d.path);
  if(b.length!==d.bytes||sha(b)!==d.sha256||blob!==d.sourceGitBlobSHA1||b[0]!==0xe9)throw Error('File identity mismatch '+d.path);
  if(all.some(x=>x.sha256===d.sha256))throw Error('Already integrated '+d.path);
  const base=original.find(x=>x.menuFamily===family),sourceURL=sourceBase+d.path;
  if(!base)throw Error('Missing existing menu family');
  const version=`game ${d.gameVersion} - PS4 5.05 - GamerHack 505 ${commit.slice(0,12)} - ${d.sha256.slice(0,12)}`;
  const requirements=base.requirements.map(x=>x.replace(/9\.00/g,'5.05').replace(/900v3/g,'505').replace(/GTA V game update 1\.\d+/,'GTA V game update '+d.gameVersion));
  // Reuse existing translated prerequisite explaining historical game builds.
  requirements.splice(1,0,'The matching game build must already run on the console. A menu download does not establish game-boot or backport compatibility.');
  const action={...base,id:'ps4-gta505-gamerhack-'+key,version,bytes:d.bytes,sha256:d.sha256,gameVersion:d.gameVersion,menuVersion:null,titleIds:[],firmwares:['5.05'],downloadURL:sourceURL,sourceURL,sourceFile:d.path,sourceGitBlobSHA1:blob,source:sourceBase+'505/index.html',hostURL:'https://gamerhack.github.io/505/',hostVariant:'GamerHack 505',variantLabel:'GamerHack 5.05 build',run:null,launchURL:null,firmwareEvidence:'Exact pinned 505/index.html dispatch and PS4 5.05 title; no other firmware, title ID or platform inferred.',loaderEvidence:{sourceURL:sourceBase+'505/index.html',sourceSHA256:sha(source),function:fn,payloadPath:d.path,transport:'Host-specific ArrayBuffer copied to code_addr1 + 0x100000, followed by p.fcall(code_addr1). No standalone external loader ABI established.',externalTransportVerified:false},requirements,tags:['PS4','GTA V','5.05',family,d.gameVersion,'BIN','GamerHack','older game updates'],versionEvidence:{dispatchSource:sourceBase+'505/index.html',sourceSHA256:sha(source),function:fn,file,gameVersion:d.gameVersion,menuVersion:null,note:'Button and file identify the GTA V game update; no independent menu release or regional title IDs supplied.'},instructionsURL:'/docs/host-gta505-continuation.md'};
  actions.push(action);
  jobs.push({id:'host-gta505-gamerhack-'+key,title:`${family} · GTA V ${d.gameVersion} · PS4 5.05`,platform:'PS4',category:['Games','GTA5',d.gameVersion],project:family,kind:'direct',url:sourceURL,capturedUrl:sourceBase+'505/index.html',version,filename:file,mirror:false,importPath,archiveRole:['Builds'],expectedBytes:d.bytes,expectedSha256:d.sha256,maxBytes:2*1024*1024,pages:['hosts/ps4/gta5/index.html'],sourceCommit:commit,sourceGitBlobSHA1:blob,firmwareScope:['5.05'],gameVersion:d.gameVersion,menuVersion:null,titleIds:[],author:family,license:base.license});
 }
 fs.writeFileSync(path.join(root,manifest),JSON.stringify({schemaVersion:1,scope:'Three original-only historical GTA V downloads for PS4 5.05; standalone Load remains unsupported.',actions},null,2)+'\n');
 fs.writeFileSync(path.join(root,'docs/host-gta505-continuation-jobs.json'),JSON.stringify({schemaVersion:1,jobs},null,2)+'\n');
 return {actions:actions.length,bytes:actions.reduce((n,x)=>n+x.bytes,0),payloadsExecuted:false};
}
if(require.main===module)console.log(prepare());module.exports={prepare};
