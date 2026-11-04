'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const b=read('docs/afterglow-build.json'),inv=read('docs/afterglow-download-inventory.json');
const artifactReport=read('docs/qa/afterglow-artifact-integrity.json');
const update={date:'2026-11-03',status:'Complete locally; preview running at user request',url:'http://127.0.0.1:8765/hosts/ps4/firmware/',
 changes:['Full-width firmware folder rows, newest firmware first; no sidebar or oversized hero','Opening a folder uses a shareable ?fw= version URL and shows only its exact routes','Sticky top bar with Back, PS4 host, firmware navigation and existing language control','Route requirements remain expandable; built-in, external, Ethernet and USB methods stay separately labelled','Afterglow landing gets a back/navigation bar and responsive larger controls; run document and all exploit/native bytes unchanged'],
 browser:{folderRootVerified:true,firmware1400OnlyAfterglow:true,backVerified:true,actualRuntimeOpened:false,landing:'Authored inert fixture only; no exploit module or payload execution',screenshots:['docs/screenshots/ps4-firmware-folders.png','docs/screenshots/afterglow-full-page-inert.png']},
 tests:{passed:20,failed:0,report:'docs/qa/afterglow-folder-tests.txt'},
 audit:{report:'docs/qa/afterglow-folder-site-audit.txt',note:'Full audit initially found five missing links on concurrently created ESP flasher and PS4 trainer pages, outside this layout change. Do not overwrite their work.'},
 artifacts:b.jobs.map(j=>({...j,backupPath:inv.items.find(i=>i.id===j.id).files[0].backupPath})),
 artifactIntegrity:artifactReport,archiveIndex:'docs/qa/afterglow-folder-archive-index.txt',published:false};
const file=path.join(root,'docs/console-expansion-handoff.json'),before=fs.readFileSync(file,'utf8'),h=JSON.parse(before);
const section=h.ps4AfterglowFirmware20261103;
section.folderLayout=update;section.artifacts=update.artifacts;section.updatedAt=new Date().toISOString();
section.resume=section.resume.filter(s=>!s.startsWith('Local preview49948'));
section.resume.push('At owner request, loopback preview is running on port8765 and firmware directory tab is left open. Server supports WHATSITE_PREVIEW_PORT; do not stop it merely for QA cleanup.');
if(fs.readFileSync(file,'utf8')!==before)throw Error('Concurrent handoff edit; retry');
fs.writeFileSync(file,JSON.stringify(h,null,2)+'\n');
fs.writeFileSync(path.join(root,'docs/afterglow-folder-layout.json'),JSON.stringify(update,null,2)+'\n');
console.log(JSON.stringify({folders:39,routes:33,tests:20,artifacts:6,preview:update.url}));
