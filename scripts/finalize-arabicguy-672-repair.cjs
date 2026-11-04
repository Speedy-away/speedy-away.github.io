'use strict';
// Closeout metadata only. No original file, hardware or payload is changed.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),dir='docs/host-reviews/ps4/6.72/arabicguy',read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8')),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function stats(file){const text=fs.readFileSync(path.join(root,file),'utf8'),count=key=>Number(text.match(new RegExp('(?:ℹ |# )'+key+' (\\d+)'))?.[1]||0);return {tests:count('tests'),passed:count('pass'),failed:count('fail'),report:file};}
function main(){
 const tests=stats(dir+'/full-tests-repair-final.txt'),focused=stats(dir+'/focused-tests-repair.txt');assert.ok(tests.tests>0);assert.equal(tests.failed,0,'Finish a clean full test run before closeout');assert.equal(tests.passed,tests.tests,'The full run must finish');assert.equal(focused.failed,0);assert.equal(focused.passed,focused.tests);assert.ok(focused.tests>0);
 const siteAudit=fs.readFileSync(path.join(root,dir,'site-audit-repair.txt'),'utf8');assert.match(siteAudit,/; 0 issue\(s\)\./,'Finish a clean site audit before closeout');
 const download=read(dir+'/download-verification.json');assert.equal(download.status,'passed');assert.equal(download.files.filter(f=>f.gameVersion).length,3);
 const integrity=read(dir+'/integrity.json'),controller=read(dir+'/prepared.json');assert.equal(integrity.status,'passed');assert.equal(controller.sha256,integrity.controller.sha256);
 const audit=read('docs/download-audit.json').items,toolBuild=read('docs/host-local-tools-build.json');
 const toolPackages=toolBuild.artifacts.map(a=>{
  const bytes=fs.readFileSync(path.join(root,a.local));assert.equal(bytes.length,a.bytes);assert.equal(sha(bytes),a.sha256);
  for(const f of a.manifest.filter(f=>f.name!=='README.md'))assert.equal(sha(fs.readFileSync(path.join(root,f.name))),f.sha256,a.scope+' current '+f.name);
  for(const name of ['assets/site-background.css','assets/site-background.js'])assert.ok(a.manifest.some(f=>f.name===name));
  const saved=audit.flatMap(i=>i.files||[]).find(f=>f.sha256===a.sha256&&f.backupPath);assert.ok(saved);assert.equal(sha(fs.readFileSync(saved.backupPath)),a.sha256);
  return {scope:a.scope,version:a.version,local:a.local,bytes:a.bytes,sha256:a.sha256,backupPath:saved.backupPath};
 });
 for(const a of toolBuild.retainedArtifacts){const b=fs.readFileSync(path.join(root,a.local));assert.equal(sha(b),a.sha256);assert.equal(b.length,a.bytes);}
 const inputExamples=read('docs/qa/gta5-plugin-config-inputs.json').inputFiles.map(f=>{const bytes=fs.readFileSync(path.join(root,f.snapshot));assert.equal(bytes.length,f.bytes);assert.equal(sha(bytes),f.sha256);assert.equal(bytes.toString('utf8'),f.text);return {originalPath:f.file,snapshot:f.snapshot,bytes:f.bytes,sha256:f.sha256};});
 const archiveRaw=fs.readFileSync(path.join(root,dir,'archive-index-repair.txt'),'utf8'),archive=JSON.parse(archiveRaw.slice(0,archiveRaw.indexOf('\nRefreshed')));assert.equal(archive.missingFileRecords,0);
 const report={checkedAt:new Date().toISOString(),status:'passed',tests,focused,builds:download.files.filter(f=>f.gameVersion),downloadMethod:download.method,controller:integrity.controller,receivers:integrity.receivers,sender:integrity.sender,toolPackages,retainedToolPackages:toolBuild.retainedArtifacts.length,inputExamples,archive,browser:dir+'/browser-repair.json',siteAudit:dir+'/site-audit-repair.txt',fixes:['Original plugin input checks use byte-exact repository captures instead of mutable Desktop/Downloads paths; regeneration preserves captures and Git retains their line endings.','Authored trainer/flasher pages and their ready ZIPs include the shared background assets; old packages and vendor files are preserved.','Background integration preserves later-added body class ordering and remains idempotent.','RAW GAME source-contract assertions remain intact while recognizing its exclusion from the first-party catalogue.','The GTA V popup has one generated top navigation bar.','All three 6.72 variants were checked through real HTTPS download hashes, exact receiver IDs, popup routes, and inert Prepare/Load/uncertain-state tests.'],nativeCodeExecuted:false,consoleContact:false,hardwareExecutionVerified:false,published:false};
 const file=path.join(root,'docs/console-expansion-handoff.json'),before=fs.readFileSync(file),handoff=JSON.parse(before),section=handoff.repositoryHostReview20261102.arabicguy672Followup20261103;
 report.fixes.push('The sender packages cheats only for PS4, where that route exists; new shared cheats/Lua/packages pages have social-preview and sitemap entries.');
 fs.writeFileSync(path.join(root,dir,'repair-verification.json'),JSON.stringify(report,null,2)+'\n');
 section.repair20261103=report;section.status='Complete locally: original test failures fixed; current full suite passes. All three 6.72 ArabicGuy Download/Load routes rechecked with verified bytes and inert native fixtures. Internet required; physical PS4 execution remains untested.';section.updatedAt=report.checkedAt;section.sender=integrity.sender;
 section.verification.previousFull ||= section.verification.full;section.verification.full={...tests,remainingFailures:[]};section.verification.repair=dir+'/repair-verification.json';section.verification.archiveIndex=archive;
 section.verification.previousFocused ||= section.verification.focused;section.verification.focused=focused;
 section.verification.previousBrowser ||= section.verification.browser;section.verification.browser=report.browser;
 section.verification.previousSiteAudit ||= section.verification.siteAudit;section.verification.siteAudit=report.siteAudit;
 section.verification.downloads=dir+'/download-verification.json';
 section.remaining=section.remaining.map(note=>note.includes('Shared host/tool work and its unrelated test failures')?'Shared host/tool work continues independently; the full suite passed at this recorded snapshot.':note);
 const next=JSON.stringify(handoff,null,2)+'\n';assert.ok(fs.readFileSync(file).equals(before),'Shared handoff changed; retry without overwriting it');fs.writeFileSync(file,next);
 console.log(JSON.stringify({status:'passed',tests:tests.tests,failed:tests.failed,focused:focused.passed,builds:report.builds.map(x=>x.gameVersion),sender:report.sender.version,archiveItems:archive.items,missing:archive.missingFileRecords}));
}
if(require.main===module)main();module.exports={main};
