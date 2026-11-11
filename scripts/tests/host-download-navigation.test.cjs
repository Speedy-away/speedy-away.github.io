'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
test('download navigation survives shared page passes without duplicating links or changing native pages',()=>{
 const navigation=require('../host-download-navigation.cjs');
 const html='<html><head></head><body><nav class="host-taskbar"><a href="/">WWB HOST</a></nav><main>Guide</main></body></html>';
 for(const platform of ['ps4','ps5']){
  const file='hosts/'+platform+'/files/index.html';
  const changed=navigation.apply(file,html);
  assert.ok(changed.includes('href="/hosts/'+platform+'/downloads/">Download centre</a>'));
  assert.equal(navigation.apply(file,changed),changed);
  const authored=fs.readFileSync(path.join(root,file),'utf8');
  const dashboard=fs.readFileSync(path.join(root,'hosts',platform,'index.html'),'utf8');
  const taskbar=dashboard.match(/<nav\b[^>]*class="host-taskbar"[^>]*>[\s\S]*?<\/nav>/)[0];
  assert.ok(taskbar.includes('href="/hosts/'+platform+'/downloads/"'));
  assert.equal(require('../host-page-shell.cjs').apply(file,authored).includes('href="/hosts/'+platform+'/downloads/"'),true);
  assert.equal(require('../style-host-pages.cjs').themeHTML(html,file).includes('href="/hosts/'+platform+'/downloads/"'),true);
 }
 for(const file of ['hosts/runtime/ps4-original/index.html','downloads/helpers/ps5/index.html','console/ps4/whatsite-ps4.html'])assert.equal(navigation.apply(file,html),html);
 const redirect=html.replace('<head>','<head><meta http-equiv="refresh" content="0; url=/">');
 assert.equal(navigation.apply('hosts/ps4/old/index.html',redirect),redirect);
});

test('download and package navigation merge within each authored navigation while package guides remain intact',()=>{
 const navigation=require('../host-download-navigation.cjs');
 for(const platform of ['ps4','ps5']){
  const destination='/hosts/'+platform+'/downloads/';
  const packageURL='/hosts/'+platform+'/packages/';
  for(const className of ['host-taskbar','host-workbench-nav','wwb-console-links']){
   const html='<nav class="'+className+'"><a href="'+packageURL+'">Packages</a><a href="'+destination+'" aria-current="page">Downloads</a><a href="/'+platform+'/downloads/">Another downloads link</a><a href="/hosts/'+platform+'/files/">File manager</a></nav><main><a href="'+packageURL+'#setup">Package installation guide</a></main>';
   const changed=navigation.apply('hosts/'+platform+'/files/index.html',html);
   const nav=changed.match(/<nav\b[\s\S]*?<\/nav>/)[0];
   assert.equal((nav.match(/>Download centre<\/a>/g)||[]).length,1);
   assert.equal((nav.match(/downloads\//g)||[]).length,1);
   assert.ok(nav.includes('href="'+destination+'" aria-current="page"'));
   assert.doesNotMatch(nav,/packages\//);
   assert.ok(nav.includes('>File manager</a>'));
   assert.ok(changed.includes('<a href="'+packageURL+'#setup">Package installation guide</a>'));
   assert.equal(navigation.apply('hosts/'+platform+'/files/index.html',changed),changed);
  }
  const legacy='<nav class="host-workbench-nav"><a href="/console/'+platform+'/downloads.html">Console downloads</a></nav>';
  assert.ok(navigation.apply('hosts/'+platform+'/index.html',legacy).includes('href="'+destination+'">Download centre</a>'));
  const shell=require('../host-console-design.cjs').apply('<html><head></head><body><div id="host-file-firmware"></div><div id="host-action-grid"></div></body></html>','hosts/'+platform+'/index.html');
  const quick=shell.match(/<nav class="wwb-console-links"[\s\S]*?<\/nav>/)[0];
  assert.ok(quick.includes('href="'+destination+'">Download centre</a>'));
  assert.doesNotMatch(quick,/packages\//);
 }
});
