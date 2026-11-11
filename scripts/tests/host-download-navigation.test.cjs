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
