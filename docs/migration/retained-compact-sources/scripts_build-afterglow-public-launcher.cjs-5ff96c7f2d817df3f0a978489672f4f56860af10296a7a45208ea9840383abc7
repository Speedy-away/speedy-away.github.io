'use strict';
// Public-page presentation only. Never writes a native runtime or archive.
const fs=require('node:fs'),path=require('node:path');
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
function render(build){
  if(!build||!/^\/hosts\/runtime\/ps4-afterglow-[a-f0-9]{12}\/web\/index\.html$/.test(build.entry)||!Array.isArray(build.firmwares)||build.firmwares.join(',')!=='13.52,14.00'||!/^[a-f0-9]{40}$/.test(build.commit||''))throw Error('Expected the preserved exact Afterglow build and firmware contract.');
  const entry=esc(build.entry),config=JSON.stringify({entry:build.entry}).replaceAll('<','\\u003c');
  return '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="index,follow"><meta name="description" content="Choose ps4-hen or GoldHEN on the local PS4 WebKit launcher for PS4 13.52 and14.00."><title>PS4 WebKit Exploit - 13.52–14.00 | WWB HOST</title><link rel="stylesheet" href="/assets/host-home.css"><script defer src="/assets/afterglow-public-launcher.js?v=1"></script></head><body><nav class="topbar" aria-label="Host navigation"><a class="brand" href="/hosts/ps4/">← PS4 host</a><a class="main-link" href="/hosts/ps4/firmware/">Firmware selection</a></nav><main><header class="intro"><h1>PS4 WebKit Exploit - 13.52–14.00</h1><p id="afterglow-public-status" role="status">Opening the local ps4-hen / GoldHEN chooser…</p></header><p><a id="afterglow-public-continue" href="'+entry+'">Choose HEN</a></p><noscript><p>Open the local chooser and enable JavaScript in the PS4 browser.</p></noscript></main><script id="afterglow-public-data" type="application/json">'+config+'</script></body></html>\n';
}
function build(root=path.resolve(__dirname,'..')){
  const report=JSON.parse(fs.readFileSync(path.join(root,'docs/afterglow-build.json'),'utf8'));
  const file=path.join(root,'hosts/ps4/afterglow/index.html'),html=render(report);
  if(!fs.existsSync(path.join(root,report.entry.slice(1))))throw Error('The preserved isolated Afterglow landing is missing.');
  fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,html);
  return {page:'hosts/ps4/afterglow/index.html',runtime:report.entry,controls:'Existing isolated landing: ps4-hen / GoldHEN, Autostart and Start.',nativeFilesChanged:0,archiveFilesChanged:0};
}
if(require.main===module)console.log(JSON.stringify(build()));module.exports={render,build};
