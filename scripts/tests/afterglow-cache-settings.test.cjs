'use strict';
// Validate the live upstream cache contract without evaluating console code.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..');
const build=JSON.parse(fs.readFileSync(path.join(root,'docs/afterglow-1402-build.json'))),base=path.join(root,build.base,'web');
const read=name=>fs.readFileSync(path.join(base,name),'utf8'),sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');

test('live landing and run documents use only the upstream Application Cache',()=>{
 for(const name of ['index.html','jb.html'])assert.match(read(name),/<html[^>]+manifest="cache\.appcache"/,name);
 for(const name of ['index.html','jb.html'])assert.doesNotMatch(read(name),/serviceWorker|offline-sw|cache-frame|afterglow-cache|settings\.js/,name);
});

test('manifest closure is local, complete and hash-pinned',()=>{
 const manifest=read('cache.appcache'),lines=manifest.split(/\r?\n/);let count=0;
 for(const line of lines){const match=line.match(/^([^#\s][^ ]*) #([a-f0-9]{32})$/i);if(!match)continue;count++;assert.doesNotMatch(match[1],/https?:|^\//);const bytes=fs.readFileSync(path.join(base,match[1]));assert.ok(sha(bytes).startsWith(match[2].toLowerCase()),match[1]);}
 assert.equal(count,24);assert.match(manifest,/NETWORK:\s*\n\*/);assert.match(manifest,/FALLBACK:\s*\njb\.html jb\.html/);
});

test('cache refresh is bounded and swaps only a ready generation',()=>{
 const launch=read('launch.js');assert.match(launch,/var CACHE_WAIT_MS = 4000/);assert.match(launch,/updateready/);assert.match(launch,/swapCache\(\)/);assert.match(launch,/Date\.now\(\) - last < 10000/);assert.match(launch,/location\.reload\(\)/);
});

test('old custom cache runtime remains archived but is not the public build',()=>{
 const old=path.join(root,'hosts/runtime/ps4-afterglow-944d5aeed06f/web/offline-sw.js');assert.ok(fs.existsSync(old));assert.notEqual(build.base,'hosts/runtime/ps4-afterglow-944d5aeed06f');
});
