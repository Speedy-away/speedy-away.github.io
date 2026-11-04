'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const sender=read('docs/qa/host-files-sender.json');
const bytes=fs.readFileSync(sender.file);
if(bytes.length!==sender.bytes||hash(bytes)!==sender.sha256||!fs.readFileSync(sender.backupPath).equals(bytes))throw Error('Sender public/archive identity mismatch');
const {inspectZip}=require('./verify-host-menu-sender-integrity.cjs');
const zip=inspectZip(bytes),prefix='whatwhatboy-console-payload-sender/';
const manifest=JSON.parse(zip.entries.get(prefix+'bundle-manifest.json'));
for(const entry of manifest.files){const b=zip.entries.get(prefix+entry.name);if(!b||b.length!==entry.bytes||hash(b)!==entry.sha256)throw Error('ZIP member mismatch '+entry.name);}
const current=require('./package-console-payload-sender.cjs').collectFiles().files;
const records=[...current].sort(([a],[b])=>a.localeCompare(b)).map(([name,b])=>({name,bytes:b.length,sha256:hash(b)}));
if(hash(JSON.stringify(records))!==sender.snapshot)throw Error('Shared source changed after packaging; retain package and rebuild final snapshot');
const indexText=fs.readFileSync(path.join(root,'docs/qa/host-files-archive-index.txt'),'utf8');
const archive=JSON.parse(indexText.slice(0,indexText.lastIndexOf('}')+1));
const update={date:'2026-11-03',status:'Complete locally; original folder request corrected to actual file-list views',
 userClarification:'Use actual files in explorer-like rows; no folder navigation or repeated exploit-host names. Choose firmware for exploit routes. Browse all payload/game files independently of firmware; show source-pinned compatibility in a support popup and keep Load guards.',
 pages:['/hosts/ps4/','/hosts/ps5/'],views:['loaders','payloads','mods','tools','connection','sender'],
 changes:['Full-width Name/Format/Size/Actions file rows; filenames remain original','Top Back bar and compact category navigation; no sidebar or hero','Exploit view is Choose firmware; preferred reviewed route first and alternatives collapsed, with source attribution retained in requirements','Payload and game-mod browsing no longer hides files based on selected firmware; existing firmware lists, ranges, game/title/update pins and native transports unchanged','Restricted files have clickable firmware checks. Mismatched Load opens support details and refuses dispatch','Connection/sender/file/payload-manager workspaces retained; per-game version popups and four-column game pages preserved','Unknown compatibility is not labelled universal; loader prerequisites remain visible in Requirements','File-table labels added to all twenty generated language dictionaries'],
 verification:{focusedTests:{passed:45,failed:0,report:'docs/qa/host-files-focused-tests.txt'},fullSuite:{tests:671,passed:668,failed:3,report:'docs/qa/host-files-final-full-tests.txt',remaining:['Missing external original C:/Users/whatw/Desktop/plugins.ini','Older RAW GAME external-only expectation conflicts with concurrent source integration','Concurrent hosts/tools/esp-flasher page lacks expected global background integration']},siteAudit:{pages:496,links:57743,issues:0,report:'docs/qa/host-files-site-audit.txt'},browser:['PS4 and PS5 actual file rows inspected','PS4 firmware restriction popup opened without any Load','PS4 all-game file view inspected','No exploit execution or console contact'],screenshots:['docs/screenshots/ps4-host-file-list.png','docs/screenshots/ps5-host-file-list.png','docs/screenshots/ps4-file-support-popup.png'],sender:{...sender,zipEntries:zip.entryCount,manifestFiles:manifest.files.length,allCRCAndSHA256Verified:true,publicAndFArchiveVerified:true,finalSourceSnapshotMatches:true},archive},
 preservation:'No new payload/console catalogue IDs or receiver versions introduced by this layout change. Existing platform-specific/native artifacts and every old sender/archive retained.',
 preview:'http://127.0.0.1:8765/hosts/ps4/?view=payloads',published:false};
const file=path.join(root,'docs/console-expansion-handoff.json'),before=fs.readFileSync(file,'utf8'),h=JSON.parse(before);
h.hostFileView20261103=update;
if(fs.readFileSync(file,'utf8')!==before)throw Error('Concurrent handoff edit; retry');
fs.writeFileSync(file,JSON.stringify(h,null,2)+'\n');
fs.writeFileSync(path.join(root,'docs/host-file-view.json'),JSON.stringify(update,null,2)+'\n');
console.log(JSON.stringify({sender:sender.version,zipEntries:zip.entryCount,archiveFiles:archive.presentFileRecords,focusedTests:45,siteIssues:0}));
