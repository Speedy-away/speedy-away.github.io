// Fresh-read merge of this continuation's results; preserve other chats' notes.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
const write=(f,d)=>fs.writeFileSync(path.join(root,f),JSON.stringify(d,null,2)+'\n');
const report=read('docs/qa/console-batch5-verification.json');
if(!report.passed||!report.helpersComplete)throw Error('Verify all downloads and active receiver catalogues first');
const now=new Date().toISOString();
const testSummary=(file)=>{
  const text=fs.readFileSync(path.join(root,file),'utf8');
  return {tests:Number(text.match(/tests (\d+)/)?.[1]),passed:Number(text.match(/pass (\d+)/)?.[1]),failed:Number(text.match(/fail (\d+)/)?.[1]),checkedAt:fs.statSync(path.join(root,file)).mtime.toISOString(),output:file};
};
const focused=testSummary('docs/qa/console-batch5-focused-tests.txt');
if(!focused.tests||focused.failed)throw Error('Focused checks must pass');
const broad=testSummary('docs/qa/console-batch5-node-tests.txt');
broad.scope='All scripts/tests/*.test.cjs and free-keys/tests/*.test.cjs';
broad.note='One unrelated Wii U directory/provider assertion failed during concurrent Wii U work. PS4/PS5 batch5 tests pass. Do not replace the other chat’s files to force a broad green result.';
const auditText=fs.readFileSync(path.join(root,'docs/qa/console-batch5-site-audit.txt'),'utf8');
const auditMatch=auditText.match(/Audited (\d+) public pages and (\d+) local links\/assets; (\d+) issue/);
if(!auditMatch||Number(auditMatch[3]))throw Error('Clean current link audit is required');
const siteAudit={publicPages:Number(auditMatch[1]),localLinksAndAssets:Number(auditMatch[2]),issues:0,output:'docs/qa/console-batch5-site-audit.txt'};
const indexText=fs.readFileSync(path.join(root,'docs/qa/console-batch5-archive-index.txt'),'utf8');
const archiveIndex=JSON.parse(indexText.match(/\{[\s\S]*?\n\}/)[0]);
const captures=read('docs/tmp/console-batch5/source-mega-captures.json');
const sourceAttempts={checkedAt:now,scope:'Only exact links observed on supplied VirusMike source pages; no gates bypassed or source code executed.',attempts:[
  {name:'CJ House custom zombie map',...report.cjHouse},
  {name:'Ghosts Appendum',source:captures.urls[0],status:'unavailable',error:'MEGA ETOOMANY (-6): Too many concurrent IP addresses are accessing this upload target URL.'},
  {name:'MW2 Remastered TER152 ELF',source:captures.urls[1],status:'unavailable',error:'MEGA ETOOMANY (-6): Too many concurrent IP addresses are accessing this upload target URL.'},
  {name:'Ghosts SilentShadow V2',...read('docs/tmp/console-batch5/silentshadow-transfer.json')}
]};
write('docs/qa/console-batch5-source-availability.json',sourceAttempts);
const native=read('docs/ps5-native-batch5.json'),config=read('docs/console-expansion-batch5.json');
const screenshots=['docs/qa/console-batch5-ps4-card.jpg','docs/qa/console-batch5-ps4-mobile.jpg','docs/qa/console-batch5-ps5-mobile.jpg'];
const state={updatedAt:now,status:'complete locally',newGames:16,PS4:config.cheats.map(p=>({game:p.title,filename:p.filename,page:'/console/mods/ps4/'+p.game+'/'})),PS5:native.resources.map(p=>({game:p.game,filename:p.filename,page:p.page})),baseline:'docs/qa/console-batch5-baseline.json',verification:'docs/qa/console-batch5-verification.json',jobs:'docs/qa/console-batch5-download-jobs.json',durableIntake:'docs/ps4-ps5-private-inventory.json',inventoryMerge:'docs/qa/console-batch5-inventory-merge.json',sourceAvailability:'docs/qa/console-batch5-source-availability.json',sourceBoundary:'The source-site CJ House/Ghosts/MW2 candidates remain unavailable. All sixteen added game definitions are separately attributed pinned GoldHEN/etaHEN publisher files; none is falsely attributed to VirusMike.',compactCards:'New PS4 and PS5 cards show exact build, Download, Save and a closed Setup & source disclosure. Long labels, author conditions, credits and original metadata caveats remain accessible.',nativeCounts:{games:17,files:20},cheatFiles:read('docs/ps4-extra-game-cheats.json').files.length,...report.summary,focusedTests:focused,broadSnapshot:broad,siteAudit,archiveIndex,helpers:report.helpers,priorVersion10HelpersPreserved:report.priorHelpers.every(h=>h.passed),browser:{phoneViewport:390,documentWidth:375,horizontalOverflow:false,setupClosedByDefault:true,exactPS4Save:'goldhen-cusa04482-01-12',exactPS5Save:'ps5-native-shn-ppsa02745-01-000-004',authorConditionVerified:'Tales of Arise: Only enable once the encounter starts',httpDownloadsHashVerified:16},screenshots,payloadsExecuted:false,hardwareExecutionTested:false,publication:'Local changes only; not committed, pushed or deployed.'};
const handoffFile='docs/console-expansion-handoff.json',notes=read(handoffFile);
notes.updatedAt=now;notes.additionalGameBatch5=state;
notes.statusHistory||=[];
if(notes.status&&!notes.status.includes('game batch5'))notes.statusHistory.push({retainedAt:now,status:notes.status});
notes.status='PS4/PS5 game batch5 complete locally: sixteen new verified game downloads, compact cards, exact Save routes and shared receiver11 integration. Source-site failures and the unrelated Wii U test are recorded separately.';
notes.completed.catalogue={uniqueResources:report.summary.currentCatalogue,ps4Files:report.summary.ps4Catalogue,ps5Files:report.summary.ps5Catalogue};
notes.completed.games='93 PS4 Other Games collections; 97 pinned GoldHEN JSON files. Searchable PS4 menu directory:106 games/196 resources. Native PS5 cheat index:17 games/20 exact builds.';
notes.completed.nativePS5={games:17,files:20,index:'/console/ps5/game-cheats.html',newSHNFiles:8,source:native.repository,revision:native.commit};
const currentItems=read('docs/download-audit.json').items;
notes.companions=report.helpers.map(h=>{
  const owner=currentItems.find(i=>i.files?.some(f=>f.sha256===h.sha256));
  const activation=read('docs/host-menu-companion-build.json').records.find(r=>r.platform===h.platform&&r.sha256===h.sha256);
  return {id:owner?.id,path:h.path,version:h.version,bytes:h.bytes,sha256:h.sha256,backupPath:h.backupPath,immutablePath:activation?.immutablePath};
});
notes.verification.batch5=state;
notes.verification.lastFocusedSuite=focused;
notes.verification.lastBroadSnapshot=broad;
notes.verification.lastWholeSiteAudit=siteAudit;
notes.verification.finalArchiveIndex={...archiveIndex,note:'All sixteen batch5 files and prior helper10 copies were independently hash verified. The six missing global paths belong to older PS3 records; this batch did not delete or move any download.'};
notes.screenshots=[...new Set([...(notes.screenshots||[]),...screenshots])];
notes.regeneration='Default scoped PS4/PS5 build preserves the active archived receiver11 bytes. Shared host integration prepared/activated11 with all sixteen new file IDs; no helper was overwritten by this batch. A deliberate later regeneration must use a new unused version and F: archival, preserving old immutable snapshots.';
notes.nextSteps=[...new Set([...(notes.nextSteps||[]),'Batch5 is complete. Source availability report has exact failed URLs and both retained CJ House partial locations. Retry only when a complete real source is available; never give an incomplete file a full hash or working download claim.','Keep original PS5 SHN metadata quirks disclosed: Demon’s Souls uses embedded version1.004 vs filename01.004.000; its and MK11 XML encoding declarations are retained unchanged. Source bytes, creator credit, exact filename and update pins must stay preserved.','Shared archive index reports six missing older PS3 paths. Follow the PS3 handoff for reconciliation; do not delete records or infer Xbox support from a misplaced archive.'])];
write(handoffFile,notes);
const qaFile='docs/qa/ps4-ps5-verification.json',qa=read(qaFile);
qa.checkedAt=now;qa.batch5=state;qa.siteAudit=siteAudit;qa.catalogue=notes.completed.catalogue;qa.companions=notes.companions;
qa.archive.batch5={newFilesHashVerified:16,oldCatalogueIDsPreserved:532,priorHelpersPreserved:2,receiverCataloguesComplete:true,report:'docs/qa/console-batch5-verification.json'};
qa.archive.index=archiveIndex;qa.archive.indexRefreshedAt=now;
write(qaFile,qa);
const helperFile='docs/qa/final-console-companions-verification.json',helpers=read(helperFile);
if(JSON.stringify(helpers.results)!==JSON.stringify(notes.companions)){
  helpers.history||=[];helpers.history.push({checkedAt:helpers.checkedAt,results:helpers.results});
}
Object.assign(helpers,{status:'passed',checkedAt:now,results:notes.companions});write(helperFile,helpers);
console.log(JSON.stringify({status:'notes updated',games:16,files:16,focused,siteAudit,receiverVersion:report.helpers[0].version,broadSnapshot:broad}));
