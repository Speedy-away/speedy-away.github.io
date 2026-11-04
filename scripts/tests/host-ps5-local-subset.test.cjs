'use strict';
// Author-controlled route/guard fixtures only. Native modules and payloads are
// read as metadata; they are never evaluated or sent to a console.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),compact=require('../host-compact-pages.cjs');
const launcher=require('../../assets/host-local-launcher.js'),guard=require('../../assets/host-karo-builds.js');
const exact=['3.10','3.21','5.00','5.02','5.10','5.50'];
const sources=JSON.parse(fs.readFileSync(path.join(root,'docs/host-local-launchers.json'))).groups;
const original=sources.find(g=>g.id==='karo-ps5-umtx');
const subset=()=>compact.ps5RemainingRoute(sources);
function storage(){const values=new Map();return{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};}

test('remaining PS5 route is the exact source-confirmed subset and does not mutate the original native metadata',()=>{
  const before=JSON.stringify(original),route=subset();
  assert.deepEqual(route.firmwares,exact);assert.deepEqual(route.originalEntry.firmwares,exact);
  assert.equal(route.originalEntry.path,original.originalEntry.path);assert.equal(route.originalEntry.scope,original.originalEntry.scope);
  assert.equal(route.runtimeEntry,original.runtimeEntry);assert.deepEqual(route.source,original.source);
  assert.deepEqual(route.originalEntry.ranges,[]);assert.equal(JSON.stringify(original),before);
  const unconfirmed={...original,firmwares:original.firmwares.filter(f=>f!=='3.10')};
  assert.throws(()=>compact.ps5RemainingRoute([unconfirmed]),/no longer confirms/);
});

test('three disjoint primary PS5 families cover all62 offered exact versions while builtin and Relapse arrays remain unchanged',()=>{
  const groups=compact.groups(root).filter(g=>g.platform==='ps5');assert.equal(groups.length,3);
  const builtin=JSON.parse(fs.readFileSync(path.join(root,'docs/host-runtime-builds.json'))).runtimes.find(r=>r.id==='ps5-umtx');
  const relapse=JSON.parse(fs.readFileSync(path.join(root,'docs/ps5-webkit-build.json')));
  assert.deepEqual(groups.find(g=>g.id==='ps5-umtx').firmwares,builtin.firmwares);
  assert.deepEqual(groups.find(g=>g.id===relapse.id).firmwares,relapse.firmwares);
  const all=groups.flatMap(g=>g.firmwares);assert.equal(all.length,62);assert.equal(new Set(all).size,62);
  for(const bad of ['3.11','5.01','5.20','6.00'])assert.ok(!all.includes(bad));
  const html=compact.directory(root,'ps5');assert.equal((html.match(/class="host-firmware-family"/g)||[]).length,3);
  assert.ok(html.includes('3.10 / 3.21 / 5.00–5.50'));assert.ok(html.includes('data-firmwares="'+exact.join(',')+'"'));
});

test('authored subset page uses only the same-origin native runtime and exact6 launcher configuration',()=>{
  const route=subset(),html=fs.readFileSync(path.join(root,route.entry,'index.html'),'utf8');
  const data=JSON.parse(html.match(/<script id="host-local-data"[^>]*>([\s\S]*?)<\/script>/)[1]);
  const parsed=launcher.config(data,new URL('https://example.test'+route.entry));
  assert.equal(parsed.runtime,original.runtime);assert.deepEqual(parsed.entry.firmwares,exact);
  assert.equal(parsed.entry.path,'ps5/UMTX/index.html');assert.equal(parsed.entry.scope,'ps5/UMTX/');
  assert.doesNotMatch(html,/<iframe\b|<script[^>]+src="https?:/);
  for(const m of html.matchAll(/<script[^>]+src="(\/[^"?]+)/g))assert.ok(fs.existsSync(path.join(root,m[1])));
});

test('all6 exact browser versions authorize the unchanged local native entry at root and Pages prefix without evaluating it',()=>{
  for(const prefix of ['', '/WWB-HOST', '/wwb-host'])for(const firmware of exact){
    const route=subset(),data={runtime:prefix+route.runtime,entry:route.originalEntry};
    const config=launcher.config(data,new URL('https://example.test'+prefix+route.entry));
    const win={navigator:{userAgent:'PlayStation 5/'+firmware},document:{visibilityState:'visible'},sessionStorage:storage(),localStorage:storage()};win.top=win.self=win;
    assert.throws(()=>guard.authorize(win,config.entry,config.runtime,true,false));
    const target=guard.authorize(win,config.entry,config.runtime,true,true);
    assert.equal(target,prefix+original.runtimeEntry);
    assert.equal(guard.runtimeAllowed(win,{base:config.runtime,path:original.originalEntry.path,entry:original.originalEntry}).firmware,firmware);
    assert.throws(()=>guard.runtimeAllowed(win,{base:config.runtime,path:original.originalEntry.path,entry:original.originalEntry}),/restored or repeated/);
  }
  for(const firmware of ['3.00','4.51','5.01','6.00','13.60'])assert.equal(guard.supports(subset().originalEntry,{platform:'ps5',firmware}),false);
  assert.equal(guard.supports(subset().originalEntry,guard.consoleInfo('Desktop browser')),false);
});

test('primary catalogue links the remaining versions to the guarded local subset rather than an external host',()=>{
  const rows=require('../build-host-selector.cjs').hostActions('ps5');
  const action=rows.find(a=>a.id==='local-karo-ps5-umtx-remaining');
  assert.ok(action);assert.equal(action.localLauncher,true);assert.equal(action.secondaryHost,undefined);
  assert.equal(action.launchURL,subset().runtimeEntry);assert.deepEqual(action.firmwares,exact);assert.deepEqual(action.nativeRoute.entry.firmwares,exact);assert.equal(action.nativeRoute.autorun,'umtx2');
  const data=JSON.parse(fs.readFileSync(path.join(root,'hosts/ps5/index.html'),'utf8').match(/<script id="host-actions-data"[^>]*>([\s\S]*?)<\/script>/)[1]);
  assert.deepEqual(data.actions.find(a=>a.id===action.id).firmwares,exact);
});
