'use strict';
// Browser routing fixtures only; never run native pages or contact a console.
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {resolveTarget,render404,renderHomeRedirect}=require('../host-legacy-redirect.cjs');
const origin='https://speedy-away.github.io';
const aliases={'/hosts/ps4/':'/hosts/ps4/','/hosts/ps5/':'/hosts/ps5/','/hosts/ps5/patches/':'/hosts/ps5/patches/','/assets/test image.svg':'/assets/test image.svg','/downloads/old.zip':'https://raw.githubusercontent.com/Speedy-away/speedy-away.github.io/'+('a'.repeat(40))+'/downloads/old.zip'};
const at=(pathname,search='',hash='')=>({pathname,search,hash});
test('old project roots and host choosers open the canonical root with query and fragment intact',()=>{
 for(const p of ['/WWB-HOST','/WWB-HOST/','/WWB-HOST/index.html','/WWB-HOST/hosts','/WWB-HOST/hosts/','/WWB-HOST/hosts/index.html','/wwb-host/hosts/','/WwB-HoSt/hosts/','/hosts','/hosts/','/hosts/index.html'])assert.equal(resolveTarget(at(p,'?lang=en','#choose'),{aliases}), '/?lang=en#choose',p);
 assert.equal(resolveTarget(at('/'),{aliases}),null);
});
test('legacy deep pages retain the exact known console route and browsing state',()=>{
 for(const prefix of ['/WWB-HOST','/wwb-host']){
  assert.equal(resolveTarget(at(prefix+'/hosts/ps5/','?view=mods','#actions'),{aliases}),'/hosts/ps5/?view=mods#actions');
  assert.equal(resolveTarget(at(prefix+'/hosts/ps4','?view=payloads','#files'),{aliases}),'/hosts/ps4/?view=payloads#files');
  assert.equal(resolveTarget(at(prefix+'/hosts/ps5/patches/','?game=rdr2','#patch'),{aliases}),'/hosts/ps5/patches/?game=rdr2#patch');
 }
 assert.equal(resolveTarget(at('/WWB-HOST/assets/test%20image.svg'),{aliases}),'/assets/test image.svg');
});
test('preserved downloads keep exact immutable identities and disallow arbitrary external destinations',()=>{
 assert.equal(resolveTarget(at('/WWB-HOST/downloads/old.zip','?untrusted=query'),{aliases}),aliases['/downloads/old.zip']);
 const key='/hosts/ps4/';
 for(const target of ['//evil.test/','/%2fevil.test/','https://evil.test/','javascript:alert(1)','https://github.com/Speedy-away/speedy-away.github.io.evil/releases/download/x/a.zip','https://raw.githubusercontent.com/Speedy-away/WWB-HOST/../other/file','/a/../b','/%252e%252e/b','/a\\b'])assert.equal(resolveTarget(at('/WWB-HOST'+key),{aliases:{[key]:target}}),null,target);
});
test('unknown or malformed paths do not invent destinations or create redirect loops',()=>{
 for(const path of ['/WWB-HOST/unknown/','/WWB-HOST-not-a-prefix/hosts/','/%zz','/WWB-HOST/../hosts/ps4/','/WWB-HOST/%2e%2e/hosts/ps4/','/WWB-HOST/%255c/hosts/ps4/'])assert.equal(resolveTarget(at(path),{aliases}),null,path);
 assert.equal(resolveTarget(at('/hosts/ps4/','?view=mods','#a'),{aliases}),null);
 assert.equal(resolveTarget(at('/assets/test%20image.svg'),{aliases}),null);
});
function run(html,location,map){const status={textContent:''},targets=[];for(const script of html.matchAll(/<script>([\s\S]*?)<\/script>/g))vm.runInNewContext(script[1],{location:{...location,replace(v){targets.push(v);}},window:{WWB_HOST_PROJECT:map},document:{getElementById(){return status;}}});return{targets,status};}
test('generated 404 executes the corrected local route without loading another host or native action',()=>{
 const html=render404(origin,'a'.repeat(40));
 assert.ok(html.includes('/host-project-map.js?v='+'a'.repeat(40)));
 assert.deepEqual(run(html,at('/WWB-HOST/hosts/'),{aliases}).targets,['/']);
 assert.deepEqual(run(html,at('/WWB-HOST/hosts/ps5/','?view=mods','#a'),{aliases}).targets,['/hosts/ps5/?view=mods#a']);
 const unknown=run(html,at('/unknown/'),{aliases});assert.equal(unknown.targets.length,0);assert.match(unknown.status.textContent,/not in the active site/);
});
test('public /hosts/ landing uses root ownership without changing the loopback helper source',()=>{
 const html=renderHomeRedirect(origin);assert.ok(html.includes('rel="canonical" href="'+origin+'/"'));assert.ok(html.includes('href="'+origin+'/"'));
 assert.deepEqual(run(html,at('/hosts/','?lang=en','#choose')).targets,['/?lang=en#choose']);
 assert.throws(()=>renderHomeRedirect('https://evil.test'));
});
