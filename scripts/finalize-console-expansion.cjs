// Save coordination state without replacing another console chat's handoff fields.
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const write=(file,value)=>fs.writeFileSync(path.join(root,file),JSON.stringify(value,null,2)+'\n');
const registry=read('docs/new-console-expansion-ownership.json');
registry.updatedAt=new Date().toISOString();
for(const thread of registry.threads){
  thread.destinationPresent=fs.existsSync(path.join(root,thread.canonical.slice(1)));
  thread.status='Created; console-specific completion belongs to this chat';
}
write('docs/new-console-expansion-ownership.json',registry);
const report={
  updatedAt:registry.updatedAt,
  status:'Shared theme hub, PC emulator refresh, console tabs and ready-page integration complete locally. Separate console chats retain their own unfinished expansion work.',
  preview:'http://127.0.0.1:8767/console/themes.html',
  themes:{total:36,readyDownloads:36,Switch:8,WiiU:8,Nintendo2DS3DS:8,PS3:12},
  pc:{entries:29,archivedBuilds:22,publicMirrors:21,verifiedBytes:689661708,edenNS2:'Exact requested repository has Windows source instructions; Linux untested, no verified macOS route or packaged release.'},
  archiveSnapshot:{checkedAt:'2026-11-02T08:43:08Z',items:1351,fileRecords:2185,missingPaths:0,unlocatedRecords:63,note:'Successful verified cooperative merge and organized index refresh. Other console chats can add later files; retain all sidecars/events and repeat reconciliation after they finish.'},
  verification:{focusedTests:26,passed:26,siteAudit:{pages:278,links:28939,issues:0},navigation:{pendingChanges:0,missingDestinations:0},browser:'Theme search/reset/platform filters and PC OS/package filters passed. PC390/320 and Xbox390 phone layouts have no horizontal overflow. Xbox desktop images loaded. No console builds executed.'},
  rootEntrypoints:['node scripts/build-console-themes.cjs','node scripts/build-pc-emulators.cjs','node scripts/integrate-console-expansion.cjs'],
  laterReconciliation:['Read each docs/chat-handoffs/*.json before rebuilding its console.','After remaining console chats finish, rebuild theme hub and run integrate-console-expansion.cjs to connect newly ready pages.','Use normal F: escalation for node scripts/console-expansion-archive.cjs --all --verify, then node scripts/refresh-local-download-index.cjs --write.','Run node scripts/audit-site.cjs. Do not run broad legacy Retro/console builds over the scoped expansions.'],
  threads:registry.threads.map(({scope,title,threadId,canonical,destinationPresent})=>({scope,title,threadId,canonical,destinationPresent})),
  remaining:'Original Xbox canonical page not yet present at this snapshot; its dedicated chat has the requested scope queued. Other console chats may still be importing or checking files. A route existing does not establish completion of its child task.',
  constraints:['Local only; no commit, publish, deployment or worktree.','No videos added to expanded pages.','All older builds and original archives retained.','No physical console installation or execution claimed.']
};
write('docs/chat-handoffs/console-expansion-coordinator.json',report);
const handoff=read('docs/console-expansion-handoff.json');
handoff.updatedAt=registry.updatedAt;
handoff.themeRetroExpansion=report;
write('docs/console-expansion-handoff.json',handoff);
console.log(JSON.stringify({saved:true,themes:36,pcEntries:29,threads:registry.threads.length}));
