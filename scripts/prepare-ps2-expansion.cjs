/* Download/audit/archive PS2 builds. Never loads or executes a downloaded file. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {spawnSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const digest = b => crypto.createHash('sha256').update(b).digest('hex');
const cataloguePath = path.join(root, 'docs/ps2-expansion-catalogue.json');
const staged = path.join(root, 'docs/tmp/ps2-builds');
const publicRoot = path.join(root, 'downloads/ps2-expansion');
function keep(file, bytes) {
  fs.mkdirSync(path.dirname(file), {recursive:true});
  if (fs.existsSync(file)) {
    if (digest(fs.readFileSync(file)) !== digest(bytes)) throw Error('Refusing to replace different bytes: '+file);
  } else fs.writeFileSync(file, bytes, {flag:'wx'});
}
async function main() {
  const catalogue = JSON.parse(fs.readFileSync(cataloguePath));
  fs.mkdirSync(staged,{recursive:true});
  const downloading = process.argv.includes('--download'), archiving = process.argv.includes('--archive');
  const archive = archiving ? require('./console-expansion-archive.cjs').createArchive() : null;
  const report = {checkedAt:new Date().toISOString(), scope:'ps2-expansion', executedDownloads:false, items:[]};
  for (const item of catalogue.items) {
    const row = {id:item.id, files:[], buildPaths:[]};
    for (const f of item.downloads) {
      const folder = path.join(staged,item.id,f.version.replace(/[^a-z0-9._-]/ig,'_'));
      const target = path.join(folder,f.name);
      if(f.member && !fs.existsSync(target)) {
        const extraction=spawnSync('python',[path.join(__dirname,'inspect-ps2-package.py'),path.join(folder,f.derivedFrom),f.member,target],{encoding:'utf8'});
        if(extraction.status!==0)throw Error(extraction.stderr||extraction.stdout);
      }
      if (!fs.existsSync(target) && downloading && !f.member) {
        const res = await fetch(f.sourceUrl, {signal:AbortSignal.timeout(60000)});
        if (!res.ok) throw Error(res.status+' '+f.sourceUrl);
        const bytes = Buffer.from(await res.arrayBuffer());
        if (bytes.length > 128*1024*1024 || (f.expectedBytes && bytes.length!==f.expectedBytes)) throw Error('Unexpected download size: '+f.name);
        keep(target,bytes);
      }
      if (!fs.existsSync(target)) throw Error('Missing staged file: '+target+'; run --download');
      const audit = spawnSync('python',[path.join(__dirname,'inspect-ps2-package.py'),target], {encoding:'utf8'});
      if (audit.status!==0) throw Error(audit.stderr||audit.stdout);
      const details = JSON.parse(audit.stdout);
      row.buildPaths.push(...details.buildPaths);
      const bytes = fs.readFileSync(target), sha256=digest(bytes);
      if(f.expectedBytes && f.expectedBytes!==bytes.length)throw Error('Staged size mismatch');
      const versionFolder=f.version.replace(/[^a-z0-9._-]/ig,'_');
      const publicPath='/downloads/ps2-expansion/'+item.id+'/'+versionFolder+'/'+encodeURIComponent(f.name);
      const metadata={name:f.name,sourceUrl:f.sourceUrl,version:f.version,bytes:bytes.length,sha256,format:details.format,archiveRole:['Builds'],...(f.member?{derivedFrom:f.derivedFrom,member:f.member}:{}),...(item.mirror===false?{}:{local:publicPath}),elfs:details.elfs};
      if(archive) {
        const result=await archive.archiveFile({scope:'ps2-expansion',item:{id:'ps2-expansion-'+item.id,title:item.title,url:item.project,platform:'PS2',category:[item.category],pages:['console/retro/ps2.html']},file:{...f,expectedSha256:sha256,archiveRole:['Builds'],format:details.format},sourceFile:target});
        if(result.publicFile.sha256!==sha256)throw Error('Archive hash mismatch');
        if(item.mirror!==false)keep(path.join(publicRoot,item.id,versionFolder,f.name),bytes);
      }
      row.files.push(metadata);
    }
    row.buildPaths=[...new Set(row.buildPaths)];
    report.items.push(row);
    console.log(item.id+': '+row.files.length+' file(s), '+row.buildPaths.length+' console/layout entries');
  }
  const reportFile=path.join(root,'docs/qa/ps2-expansion-package-checks.json');
  fs.mkdirSync(path.dirname(reportFile),{recursive:true});fs.writeFileSync(reportFile,JSON.stringify(report,null,2)+'\n');
  if(archiving)fs.writeFileSync(path.join(root,'docs/ps2-expansion-files.json'),JSON.stringify(report,null,2)+'\n');
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={keep};
