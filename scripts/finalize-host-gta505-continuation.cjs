'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const integrity=read('docs/qa/host-gta505-integrity.json'),source=read('docs/qa/host-source-refresh-20261103.json');
const tests=fs.readFileSync(path.join(root,'docs/qa/host-gta505-tests-final.txt'),'utf8');
const count=k=>Number(tests.match(new RegExp('(?:ℹ |# )'+k+' (\\d+)'))?.[1]||0);
if(!count('tests'))throw Error('Final test run must finish before closeout');
const archiveText=fs.readFileSync(path.join(root,'docs/qa/host-gta505-archive-index.txt'),'utf8');
const archive=JSON.parse(archiveText.slice(0,archiveText.indexOf('\nRefreshed')));
const browser={checkedAt:new Date().toISOString(),method:'Supported CUA on loopback catalogue pages only; no exploit runtime, console or Download/Load request opened.',desktop:{columns:4,wildeModz505Versions:['1.46','1.33'],arabicGuy505Versions:['1.00'],loadDisabled:true,originalPinnedDownloadLinks:true,fullImageObjectFit:'contain'},phone:{width:430,documentWidth:430,popupWidth:389,imageFit:'contain',imageLoaded:true},languages:{verified:'English → Spanish → English; exact 5.05 / 1.00 prerequisites and host-specific ABI explanation translated',generatedLanguages:20},screenshot:'docs/screenshots/host-gta505-phone.png',cleanup:'Temporary viewport reset and owned browser tab closed.'};
fs.writeFileSync(path.join(root,'docs/qa/host-gta505-browser.json'),JSON.stringify(browser,null,2)+'\n');
const handoffPath=path.join(root,'docs/console-expansion-handoff.json');
const handoff=JSON.parse(fs.readFileSync(handoffPath,'utf8'));
handoff.repositoryHostReview20261102.continuation20261103={
 updatedAt:new Date().toISOString(),status:'Three source-confirmed historical PS4 5.05 GTA V variants added locally and F: archived. Download and exact receiver mapping enabled; unsupported standalone Load remains disabled. No publication or payload execution.',
 repositories:source.repositories.map(r=>({repo:r.repo,commit:r.commit,branches:r.branches,releases:r.releases,tags:r.tags})),
 completed:integrity.archived,sourceReview:'docs/qa/host-source-refresh-20261103.json',
 ui:'Existing ArabicGuy and WildeModz families reused; no additional family cards. Version buttons, separate game updates/menu versions, full uncropped artwork, four desktop columns and 430px phone popup verified. Existing PS4/PS5 child-page and native-workspace boundaries retained.',
 languages:'Eight additional exact/template requirement keys generated in all20 dictionaries by deriving existing reviewed translations with literal firmware/host/game substitutions. Spanish compatibility text browser-verified; original licence attribution remains English fallback.',
 receivers:integrity.receivers,sender:integrity.sender,
 preservation:{baselineCataloguePins:integrity.previousCataloguePinsPreserved,baselineSenderVersions:integrity.retainedSenderVersions.length,nativeHelpersUnchanged:integrity.nativeHelpersUnchanged,interimSenderSnapshotsAlsoRetained:['1.9.1+5cd57fb1ee09','1.9.1+b5d1eecaa124'],noBinaryPublicMirrors:true,originalOnlyBinaryCount:0},
 verification:{tests:{total:count('tests'),passed:count('pass'),failed:count('fail'),report:'docs/qa/host-gta505-tests-final.txt'},integrity:'docs/qa/host-gta505-integrity.json',browser:'docs/qa/host-gta505-browser.json',siteAudit:'docs/qa/host-gta505-site-audit.txt',archiveIndex:archive},
 remaining:[
  'Three6.72 ArabicGuy candidates remain deferred: native file bytes conflict with script-element dispatch; no working standalone ABI established.',
  '5.05 ArabicGuy1.27 is JavaScript despite its BIN extension and stays excluded.',
  'raw13g unchanged; licence excludes required primitives/patches/payloads and original-source checks still404. Do not vendor or imply a built-in/PS5 runtime.',
  'Hardware execution, installation and real-console storage transfers remain untested. Downloaded payloads were never executed.',
  'Concurrent Afterglow/firmware pages are owned by another chat. Shared-workspace test failures, if any, remain recorded honestly in the final test log; do not regenerate their pages from an older snapshot.'
 ],
 resume:[
  'Use current host-menu-companion-build.json and sender manifest as authoritative, preserving every historical snapshot. Receiver version2026.11.02.16 follows the existing series; preparation/verification timestamps are3November.',
  'New catalogue is host-gta505-continuation-actions.json, registered in selector, console catalogue, bridge and sender. Preparation verifies fresh static source bytes against pinned Git blob/SHA identities.',
  'Background integration now rejects hidden temporary directories so source/runtime review files cannot be modified by a broad styling pass.',
  'Concurrent shared language/dashboard edits required two extra immutable sender snapshots; both are retained and the final snapshot was independently ZIP CRC/SHA-verified against current shared source at its recorded time.'
 ],published:false,committed:false
};
fs.writeFileSync(handoffPath,JSON.stringify(handoff,null,2)+'\n');
console.log(JSON.stringify({updated:'repositoryHostReview20261102.continuation20261103',tests:{total:count('tests'),passed:count('pass'),failed:count('fail')},sender:integrity.sender.version,archiveItems:archive.items,missing:archive.missingFileRecords}));
