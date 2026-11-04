'use strict';
// Independent artifact reads only; no extraction, servers or console execution.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),vm=require('node:vm');
const {inspectZip}=require('./verify-host-menu-sender-integrity.cjs');
const root=path.resolve(__dirname,'..'),prefix='whatwhatboy-console-payload-sender/';
const read=name=>JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));
const sha=data=>crypto.createHash('sha256').update(data).digest('hex');
const audit=()=>read('docs/download-audit.json').items;
function verifiedFile(file,record){const bytes=fs.readFileSync(file);assert.equal(bytes.length,record.bytes,file);assert.equal(sha(bytes),record.sha256,file);return bytes;}
function archives(record,items){const matches=items.flatMap(i=>i.files||[]).filter(f=>f.sha256===record.sha256&&f.backupPath);assert.ok(matches.length,'Missing archive '+record.sha256);return [...new Set(matches.map(f=>f.backupPath))].map(file=>{verifiedFile(file,record);return file;});}
function verify(){
  const inventory=audit(),sender=read('downloads/helpers/console-payload-sender/manifest.json'),latest=sender.files.find(f=>f.url===sender.latest);
  assert.ok(latest&&latest.version.startsWith('1.6.0+'));
  const retained=sender.files.map(item=>{verifiedFile(path.join(root,item.url),item);return{version:item.version,bytes:item.bytes,sha256:item.sha256,backupPaths:archives(item,inventory)};});
  const zip=inspectZip(verifiedFile(path.join(root,latest.url),latest)),member=name=>{const data=zip.entries.get(prefix+name);assert.ok(data,'Missing ZIP member '+name);return data;};
  const manifest=JSON.parse(member('bundle-manifest.json'));
  assert.equal(manifest.version,latest.version);assert.equal(sha(JSON.stringify(manifest.files)),manifest.snapshot);assert.equal(manifest.files.length+1,zip.entryCount);
  for(const item of manifest.files)verifiedBytes(member(item.name),item);
  function verifiedBytes(bytes,record){assert.equal(bytes.length,record.bytes);assert.equal(sha(bytes),record.sha256);}
  const workspace=read('docs/host-native-workspace-build.json');
  const helpers=[...workspace.artifacts,...workspace.retainedArtifacts].map(item=>{const file=path.join(root,item.local);verifiedFile(file,item);const result={platform:item.platform,local:item.local,bytes:item.bytes,sha256:item.sha256,backupPaths:archives(item,inventory)};if(workspace.artifacts.includes(item)){verifiedBytes(member(item.local.slice(1)),item);const html=fs.readFileSync(file,'utf8');assert.ok(!/<script[^>]+src=|<link[^>]+stylesheet/.test(html));assert.ok(html.includes("connect-src 'self'"));}return result;});
  const pages=[];
  for(const platform of ['ps4','ps5'])for(const scope of ['', 'files/','payload-manager/','gta5/','rdr2/','other-games/']){
    const name='hosts/'+platform+'/'+scope+'index.html',html=member(name).toString(),data=JSON.parse(html.match(/<script id="host-actions-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
    assert.equal(data.platform,platform);assert.ok(data.actions.every(a=>a.platform===platform));
    if(scope==='files/'||scope==='payload-manager/'){assert.ok(!html.includes('id="host-action-grid"'));assert.ok(!html.includes('class="host-tools-grid"'));assert.ok(html.includes('data-open-workspace="'+(scope==='files/'?'files':'payloads')+'"'));}
    if(['gta5/','rdr2/','other-games/'].includes(scope))assert.equal(data.gameScope,scope.slice(0,-1));
    if(!scope)assert.equal(data.gamesLanding,true);
    pages.push(name);
  }
  const utilities=JSON.parse(member('docs/host-web-utility-actions.json')).actions;assert.equal(utilities.length,18);
  for(const item of utilities){verifiedBytes(member(item.downloadURL.slice(1)),item);assert.equal(item.platform,'ps4');assert.equal(item.run.type,'goldhen-http');assert.ok(!item.firmwares.includes('14.00'));}
  const dashboard=member('assets/host-dashboard.js').toString();new vm.Script(dashboard);assert.ok(!dashboard.includes('<figcaption>'));assert.ok(dashboard.includes('confirmBeforeLoad'));
  for(const code of ['es','pt','fr','de','ru','tr','pl','it','zh','ja','ko','th','vi','id','hi','sr','nl','ka','ar','he'])assert.ok(member('languages/'+code+'.js').length);
  const receiver=read('docs/host-menu-companion-build.json');assert.equal(receiver.activated,true);
  const receivers=receiver.records.map(item=>{verifiedFile(path.join(root,item.path),item);verifiedFile(path.join(root,item.immutablePath),item);verifiedFile(item.backupPath,item);return{platform:item.platform,version:item.version,bytes:item.bytes,sha256:item.sha256,items:item.items,backupPath:item.backupPath};});
  const report={checkedAt:new Date().toISOString(),status:'passed',method:'Independent bounded ZIP/CRC32/SHA-256 reader plus public/F: rehashes; syntax parsing only, no downloaded payload execution.',sender:{...latest,zipEntries:zip.entryCount,manifestFiles:manifest.files.length,payloads:manifest.payloads.length},retainedSenders:retained,workspaces:helpers,receivers,pages,utilityFiles:utilities.length,languages:20,limitations:['Mock service tests and artifact checks do not establish hardware execution.','Native workspace requires one-time installation through the matching running ezRemote Client.','Autoload-file edits do not prove live manager settings applied.']};
  fs.writeFileSync(path.join(root,'docs/qa/host-organisation-integrity.json'),JSON.stringify(report,null,2)+'\n');
  return {status:report.status,version:latest.version,senderSnapshots:retained.length,nativeWorkspaceSnapshots:helpers.length,zipEntries:zip.entryCount,utilityFiles:utilities.length,receivers:receivers.map(x=>({platform:x.platform,version:x.version,items:x.items}))};
}
if(require.main===module)console.log(JSON.stringify(verify(),null,2));
module.exports={verify};
