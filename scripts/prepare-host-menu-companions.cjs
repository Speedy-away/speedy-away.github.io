'use strict';
// Build immutable receiver snapshots; activate only after their F: copies pass.
// This script reads/copies HTML and catalogue data. It never runs payload files.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname,'..');
const {renderCompanion} = require('./console-download-companion.cjs');
const read = name => JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const reportPath = 'docs/host-menu-companion-build.json';
const jobsPath = 'docs/qa/host-menu-companion-jobs.json';
function preserve(name,bytes,outputRoot=root) {
  const file=path.join(outputRoot,name);
  if(fs.existsSync(file)) { if(sha(fs.readFileSync(file))!==sha(bytes))throw Error('Different immutable file exists: '+name); return; }
  fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes,{flag:'wx'});
}
function retainJobs(version,bytes,outputRoot=root) {
  if(!/^2026\.11\.02\.\d+$/.test(version))throw Error('Unexpected receiver version.');
  let name='docs/qa/host-menu-companion-jobs-'+version+'.json';
  const current=path.join(outputRoot,name);
  // Multiple preparations may share a release number before archive activation.
  // Keep every distinct job set instead of replacing or losing its earlier pins.
  if(fs.existsSync(current)&&sha(fs.readFileSync(current))!==sha(bytes))name='docs/qa/host-menu-companion-jobs-'+version+'-'+sha(bytes).slice(0,12)+'.json';
  preserve(name,bytes,outputRoot);return name;
}
function prepare() {
  const previousReport=fs.existsSync(path.join(root,reportPath))?read(reportPath):null;
  let previousJobsPath=previousReport?.jobsPath;
  // The rolling host job file is replaced below; retain its prior version's pins.
  if(previousJobsPath===jobsPath){
    previousJobsPath=retainJobs(previousReport.version,fs.readFileSync(path.join(root,jobsPath)));
  }
  const audit=read('docs/download-audit.json').items,catalogue=read('docs/console-download-catalog.json').items;
  const releases=audit.flatMap(item=>item.files||[]).map(f=>/^2026\.11\.02\.(\d+)$/.exec(f.version||f.releaseTag||'')).filter(Boolean).map(m=>Number(m[1]));
  const version='2026.11.02.'+(Math.max(8,...releases)+1),jobs=[],records=[];
  for(const platform of ['ps4','ps5']) {
    const stable='console/'+platform+'/whatsite-'+platform+'.html',old=fs.readFileSync(path.join(root,stable)),oldHash=sha(old);
    const saved=audit.flatMap(item=>item.files||[]).find(f=>f.sha256===oldHash&&f.backupPath&&fs.existsSync(f.backupPath)&&sha(fs.readFileSync(f.backupPath))===oldHash);
    if(!saved)throw Error('The previous '+platform+' companion must have a matching archived copy.');
    const oldItems=JSON.parse(old.toString().match(/<script id="receiver-catalog" type="application\/json">([\s\S]*?)<\/script>/)[1]).items;
    const items=catalogue.filter(item=>item.platforms.includes(platform)).map(item=>item.pages?.[platform]?{...item,page:item.pages[platform]}:item);
    for(const before of oldItems){const after=items.find(item=>item.id===before.id);if(!after||after.sha256!==before.sha256||after.filename!==before.filename)throw Error('A previous receiver file changed or disappeared: '+before.id);}
    const retained='downloads/helpers/console-download-receivers/'+platform+'/retained-'+oldHash.slice(0,12)+'/whatsite-'+platform+'.html';preserve(retained,old);
    const bytes=Buffer.from(renderCompanion(platform,items)),hash=sha(bytes),name='whatsite-'+platform+'.html';
    const immutable='downloads/helpers/console-download-receivers/'+platform+'/'+version+'-'+hash.slice(0,12)+'/'+name;preserve(immutable,bytes);
    const record={platform,version,path:stable,immutablePath:immutable,bytes:bytes.length,sha256:hash,previousSha256:oldHash,previousPublicSnapshot:retained,previousItems:oldItems.length,items:items.length};records.push(record);
    jobs.push({id:'whatsite-'+platform+'-console-downloader-'+version.replaceAll('.','-'),title:'whatwhatboy '+platform.toUpperCase()+' console downloader',platform:platform.toUpperCase(),category:['Tools'],project:'whatsite Console Downloader',version,filename:name,url:'https://speedy-away.github.io/wwb-host/'+immutable,importPath:immutable,mirror:true,archiveRole:['Builds'],expectedBytes:bytes.length,expectedSha256:hash,pages:[stable,'console/'+platform+'/downloads.html']});
  }
  fs.writeFileSync(path.join(root,jobsPath),JSON.stringify({reviewed:'2026-11-02',jobs},null,2)+'\n');
  fs.writeFileSync(path.join(root,reportPath),JSON.stringify({preparedAt:new Date().toISOString(),version,jobsPath,previousJobsPath,activated:false,records},null,2)+'\n');
  return {status:'prepared',version,jobsPath,records};
}
function activate() {
  const report=read(reportPath),audit=read('docs/download-audit.json').items;
  for(const record of report.records){
    const file=audit.flatMap(item=>item.files||[]).find(f=>f.sha256===record.sha256&&f.backupPath&&fs.existsSync(f.backupPath));
    if(!file||sha(fs.readFileSync(file.backupPath))!==record.sha256)throw Error('Archive verification failed for '+record.platform);
    const bytes=fs.readFileSync(path.join(root,record.immutablePath)),target=path.join(root,record.path),current=sha(fs.readFileSync(target));
    if(sha(bytes)!==record.sha256||![record.previousSha256,record.sha256].includes(current))throw Error('Companion changed during preparation: '+record.platform);
    fs.writeFileSync(target,bytes);record.backupPath=file.backupPath;
  }
  report.activated=true;report.verifiedAt=new Date().toISOString();fs.writeFileSync(path.join(root,reportPath),JSON.stringify(report,null,2)+'\n');return report;
}
if(require.main===module) console.log(JSON.stringify(process.argv.includes('--activate')?activate():prepare(),null,2));
module.exports={prepare,activate,retainJobs};
