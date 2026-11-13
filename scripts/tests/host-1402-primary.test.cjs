const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),compact=require('../host-compact-pages.cjs');
test('14.02 is the first firmware tile; old 14.00 remains a separately labelled compatible route',()=>{
 const html=compact.directory(root,'ps4');assert.match(html,/<div class="host-firmware-families"><a class="host-firmware-family" data-firmwares="14.02" href="\/ps4\/14.02\/">/);assert.equal((html.match(/data-firmwares="14.02"/g)||[]).length,1);assert.match(html,/class="host-older-firmware"[^]*href="\/ps4\/14.00\/">14.00 WebKit loader/);
 const published=compact.apply(html,'hosts/ps4/firmware/index.html',{root});assert.equal((published.match(/data-firmwares="14.02"/g)||[]).length,1);assert.equal((published.match(/class="host-older-firmware"/g)||[]).length,1);
});
test('home and generated PS4 notes lead to 14.02 without modifying historical native firmware gates',()=>{
 const home=fs.readFileSync(path.join(root,'index.html'),'utf8');assert.match(home,/class="home-start" href="\.\/ps4\/14.02\/">Open PS4 14.02 WebKit Exploit/);
 const rows=require('../build-host-selector.cjs').hostActions('ps4'),actions=compact.publicPS4Actions(rows,root);assert.equal(actions[0].entryURL,'/ps4/14.02/');assert.deepEqual(actions[0].firmwares,['14.02']);
 const old=actions.find(a=>a.entryURL==='/ps4/14.00/');assert.deepEqual(old.firmwares,['14.00']);assert.deepEqual(old.nativeRoute.entry.firmwares,['14.00']);
 const markup=require('../host-webhost-markup.cjs').dashboard('ps4',rows);assert.match(markup,/href="\/ps4\/14.02\/">14.02 · WebKit Exploit/);assert.doesNotMatch(markup,/13.52 \/ 14.00 · Afterglow/);
});
