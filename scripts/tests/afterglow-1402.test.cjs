'use strict';
// Read and hash runtime bytes only. Native modules and payloads are never executed.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const build=JSON.parse(read('docs/afterglow-1402-build.json')),base=build.base+'/web/';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const md5=b=>crypto.createHash('md5').update(b).digest('hex');

test('14.02 points to the latest pinned upstream runtime and preserves older firmware groups',()=>{
 assert.equal(build.commit,'587c00a564c4765b78ab413e400a392efdd9a780');
 assert.equal(build.schemaVersion,3);
 const api=require('../host-compact-pages.cjs'),groups=api.groups(root),old=groups.find(g=>g.id==='ps4-afterglow'),fresh=groups.find(g=>g.id==='ps4-afterglow-1402');
 assert.deepEqual(old.firmwares,['13.52','14.00']);assert.deepEqual(fresh.firmwares,['14.02']);
 const actions=api.publicPS4Actions(require('../build-host-selector.cjs').hostActions('ps4'),root),action=actions.find(a=>a.id==='local-ps4-afterglow-1402');
 assert.equal(action.launchURL,'/'+base+'index.html');assert.equal(action.entryURL,'/ps4/14.02/');assert.deepEqual(action.firmwares,['14.02']);
 assert.match(action.source,/587c00a564c4765b78ab413e400a392efdd9a780/);
});

test('native exploit modules and payloads remain byte-for-byte upstream',()=>{
 for(const file of build.original){
  const source=fs.readFileSync(path.join(root,build.base,'upstream',file.path));
  assert.equal(source.length,file.bytes,file.path);assert.equal(sha(source),file.sha256,file.path);
  if(!file.path.startsWith('.')&&!['index.html','jb.html','launch.js','cache.appcache'].includes(file.path))assert.deepEqual(fs.readFileSync(path.join(root,base,file.path)),source,file.path);
 }
 for(const name of ['afterglow.js','core.js','int64.js','mem.js','ps4_offsets.js','patchset-1402.bin','hen.bin','goldhen.bin'])assert.deepEqual(fs.readFileSync(path.join(root,base,name)),fs.readFileSync(path.join(root,build.base,'upstream',name)),name);
});

test('restored optional cache closes over the WWB layout and current runtime',()=>{
 const manifest=read(base+'cache.appcache');
 assert.doesNotMatch(read(base+'index.html'),/\bmanifest=/);assert.doesNotMatch(read(base+'jb.html'),/\bmanifest=/);
 for(const name of ['index.html','jb.html','launch.js','afterglow-1402.css','settings.js','cache.js','cache-frame.html','afterglow.js','ps4_offsets.js','patchset-1402.bin','hen.bin','goldhen.bin','loaders.html'])assert.ok(manifest.split(/\r?\n/).some(line=>line.split('?')[0]===name),name);
 for(const line of manifest.split(/\r?\n/).filter(x=>x&&!/^(#|CACHE|NETWORK|\*)/.test(x))){assert.doesNotMatch(line,/https?:/);assert.ok(fs.existsSync(path.join(root,base,line.split('?')[0])),line);}
});

test('restored run page keeps the one-use 14.02 guard around the pinned native module',()=>{
 const run=read(base+'jb.html');
 assert.match(run,/import\('\.\/jb\.js'\)/);assert.match(run,/whatsite\.afterglow\.1402\.arm\.v1/);assert.match(run,/\['14\.02'\]/);assert.match(run,/MutationObserver/);assert.doesNotMatch(run,/bellnewyork|accountut|cache\.js|offline-sw|host-project-routing/);
 const launch=read(base+'launch.js');assert.match(launch,/whatsite\.afterglow\.1402\.choice\.v1/);assert.match(launch,/whatsite\.afterglow\.1402\.arm\.v1/);
});

test('current HEN identities and previous runtime are preserved',()=>{
 assert.equal(sha(fs.readFileSync(path.join(root,base,'goldhen.bin'))),'c5480587d99efc2e3cc132352d9b7cf052dd3068280f1686e7fbb37d57e9ba8b');
 assert.equal(md5(fs.readFileSync(path.join(root,base,'hen.bin'))),'e7df7fb94e58a1b4a4a5e7dda4f190e1');
 assert.equal(build.ps4Hen.readmeClaimedPatchedMD5,'6417a84a72f9c7988f0e33b3ae190542');assert.match(build.ps4Hen.provenanceStatus,/do not match/);
 const previous=path.join(root,'hosts/runtime/ps4-afterglow-944d5aeed06f/web/goldhen.bin');assert.ok(fs.existsSync(previous));assert.equal(sha(fs.readFileSync(previous)),'fd68056e16a00dd3e18fcc97013b05b0b530d26be438f682bb25af9ab298dd19');
});

test('separate loader tools remain available from the restored offline layout',()=>{
 const manifest=read(base+'cache.appcache');
 for(const name of ['loaders.html','elfldr.bin','elfldr.elf','ps4-loader-sender.zip']){assert.ok(fs.existsSync(path.join(root,base,name)),name);assert.ok(manifest.split(/\r?\n/).some(line=>line.split('?')[0]===name),name);}
});

test('ready-to-use archive and public wrapper match the pinned build',()=>{
 for(const file of build.files){const bytes=fs.readFileSync(path.join(root,base,file.path));assert.equal(bytes.length,file.bytes,file.path);assert.equal(sha(bytes),file.sha256,file.path);}
 const archive=fs.readFileSync(path.join(root,build.archive.local));assert.equal(archive.length,build.archive.bytes);assert.equal(sha(archive),build.archive.sha256);
 const wrapper=read('hosts/ps4/afterglow-1402/index.html');assert.match(wrapper,new RegExp(build.base.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));assert.match(wrapper,/afterglow-public-launcher\.js\?v=2/);
});

test('14.02 uses the restored WWB two-panel layout instead of the stock Afterglow page',()=>{
 const html=read(base+'index.html'),css=read(base+'afterglow-1402.css');
 assert.match(html,/<h1>WebKit Exploit<\/h1>/);assert.match(html,/class="console-layout"/);assert.match(html,/id="settings-panel"/);assert.match(html,/id="cache-enabled"/);assert.match(html,/BIN \/ ELF loaders/);assert.match(html,/pepe-banner\.png/);
 assert.match(html,/role="dialog" aria-modal="true"/);assert.match(html,/aria-current="location"/);assert.match(html,/class="choice-mark" aria-hidden="true">GH/);
 assert.doesNotMatch(html,/<div id="brand"><b>afterglow<\/b><\/div>/i);assert.match(css,/host-xmb-waves\.svg/);assert.match(css,/\.console-layout\{display:grid/);
 assert.match(build.archive.version,/wwb-layout-v3\.1$/);assert.match(build.changes.join(' '),/Restored the authored WWB 14\.02 landing/);assert.match(build.changes.join(' '),/keyboard focus loop/);
});
test('14.02 guide describes the WWB chooser and optional cache instead of the retired stock copy',()=>{
 const guide=read('hosts/ps4/14.02-guide/index.html');
 assert.match(guide,/WWB 14\.02 chooser/);assert.match(guide,/optional offline caching/);assert.match(guide,/WWB supplies the landing page/);assert.match(guide,/included in the WWB offline bundle/);
 assert.doesNotMatch(guide,/published landing, run document, launcher.*byte-for-byte/i);assert.doesNotMatch(guide,/uses its original HTML5 Application Cache/i);
});
