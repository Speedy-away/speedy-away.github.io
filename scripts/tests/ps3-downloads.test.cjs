const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname,'../..');
function fixture() {
  const values = {};
  for (const id of ['ps3DownloadForm','ps3Host','ps3FileBase','ps3LinkStatus']) values[id] = {value:'',innerHTML:''};
  values.ps3Host.value = '127.0.0.1';
  const links = ['/downloads/ps3/demo/build/HEN BLUS/EBOOT.BIN','/downloads/ps3/demo/menu.pkg','/downloads/ps3/demo/build/HEN%20BLUS/YouLeave%231.dds'].map(file=>({href:'',innerHTML:'',getAttribute:()=>file,removeAttribute(name){delete this[name];}}));
  const document = {getElementById:id=>values[id],querySelectorAll:()=>links,createElement(){return {set href(value){this.url=new URL(value);},get hostname(){return this.url.hostname;},get username(){return this.url.username;},get password(){return this.url.password;},get pathname(){return this.url.pathname;},get search(){return this.url.search;},get hash(){return this.url.hash;}};}};
  vm.runInNewContext(fs.readFileSync(path.join(root,'assets/ps3-browser-downloads.js'),'utf8'),{document,window:{location:{protocol:'http:',host:'192.168.1.20:8765'}}});
  return {values,links,submit(){values.ps3DownloadForm.onsubmit({preventDefault(){}});}};
}
test('webMAN requests preserve the literal scheme, escape file paths and only download',()=>{
  const f=fixture();
  assert.equal(f.links[0].href,'http://127.0.0.1/xmb.ps3/download.ps3?url=http://192.168.1.20:8765/downloads/ps3/demo/build/HEN%20BLUS/EBOOT.BIN');
  assert.equal(f.links[2].href,'http://127.0.0.1/xmb.ps3/download.ps3?url=http://192.168.1.20:8765/downloads/ps3/demo/build/HEN%20BLUS/YouLeave%231.dds');
  assert.ok(!f.links.some(link=>/install|play|loadprx/.test(link.href)));
  f.values.ps3Host.value='192.168.1.50';f.submit();
  assert.ok(f.links.every(link=>link.href.startsWith('http://192.168.1.50/')));
});
test('invalid console addresses and credential-bearing file servers are rejected',()=>{
  const f=fixture();
  for(const value of ['8.8.8.8','192.168.1.999','10.0.0.1/path','192.168.01.1']) {
    f.values.ps3Host.value=value;f.submit();assert.match(f.values.ps3LinkStatus.innerHTML,/Enter a private/);
  }
  f.values.ps3Host.value='10.0.0.2';f.values.ps3FileBase.value='https://user:password@example.com';f.submit();
  assert.match(f.values.ps3LinkStatus.innerHTML,/without a path, credentials/);
});
test('webMAN source URL length limit disables oversized commands',()=>{
  const f=fixture();f.values.ps3FileBase.value='https://'+'a'.repeat(320)+'.example';f.submit();
  assert.equal(f.links[0].href,undefined);
  assert.match(f.links[0].innerHTML,/FTP/);
});
test('console list excludes RTM helpers and preserves extracted variant identity',()=>{
  const list=JSON.parse(fs.readFileSync(path.join(root,'downloads/ps3/catalog.json'),'utf8')).files;
  assert.ok(list.length>0);
  assert.ok(!list.some(file=>/\.(?:exe|dll|msi|apk|vpk)$/i.test(file.filename)));
  // RTM is also part of some authors' names (for example LewisRTMs).
  // Exclude desktop-only resources by their recorded role, not that substring.
  const source = require('../build-ps3-catalog.cjs');
  const rtmResources = new Set(source.data().resources.filter(resource=>resource.category==='rtm').map(resource=>resource.id));
  const rtmFiles = new Set(source.inventory().filter(owner=>rtmResources.has(owner.resourceId)||rtmResources.has(owner.id)).flatMap(owner=>(owner.files||[]).map(file=>file.local)));
  assert.ok(!list.some(file=>rtmFiles.has(file.local)));
  // Extracted files keep their archive member; an original standalone EBOOT has no member.
  const inventory=source.inventory();
  for(const file of list.filter(file=>file.filename==='EBOOT.BIN')){
    const owner=inventory.find(owner=>(owner.files||[]).some(saved=>saved.local===file.local&&saved.sha256===file.sha256));
    assert.ok(owner,'EBOOT has matching original inventory provenance');
    const saved=owner.files.find(saved=>saved.local===file.local&&saved.sha256===file.sha256);
    assert.equal(file.memberPath,saved.memberPath||null);
    if(!file.memberPath){
      assert.ok(!saved.extractedFromSha256,'extracted EBOOT must retain its archive member');
      assert.equal(file.source,owner.url);
      assert.match(file.source,/^https:\/\//);
    }
  }
});

test('archived Discord downloads keep exact hosted files and direct readers to the original post',()=>{
  const source = require('../build-ps3-catalog.cjs');
  const item = source.data().resources.find(item=>item.id==='discord-ps3-waw-mp-devil-modz-v2-2');
  const files = source.archivedFor(item);
  assert.ok(files.length);
  const html = source.card(item);
  for (const file of files) {
    assert.ok(html.includes(file.local));
    assert.ok(html.includes(file.sha256));
  }
  assert.ok(html.includes(item.source));
  assert.match(html,/Original Discord post \(sign-in may be needed\)/);
  assert.doesNotMatch(html,/href="https:\/\/cdn\.discordapp\.com\/attachments\//);
});

test('large PS3 originals use their source while smaller extracted builds stay downloadable',()=>{
  const source = require('../build-ps3-catalog.cjs');
  const {MAX_MIRROR_BYTES} = require('../download-mirror-policy.cjs');
  for (const id of ['discord-ps3-gta5-loader-buzzard-v61','discord-ps3-gta5-loader-exotic-v69','discord-ps3-other-rdr-demonic-v27','discord-ps3-waw-zm-elasticity-v1']) {
    const item = source.data().resources.find(item=>item.id===id);
    const entries = source.inventory().filter(entry=>entry.resourceId===id || entry.id===id || (item.downloads||[]).some(download=>download.url===entry.url));
    const originals = entries.flatMap(entry=>entry.files||[]).filter(file=>file.bytes>=MAX_MIRROR_BYTES);
    assert.ok(originals.length, id+' keeps the original archive metadata');
    const html = source.card(item);
    assert.match(html,/Original large download via Discord/);
    assert.ok(html.includes(item.source));
    for (const file of originals) {
      assert.equal(source.localFile(file), false);
      assert.ok(!html.includes('href="'+file.local+'"'));
    }
    for (const file of source.archivedFor(item)) assert.ok(html.includes('href="'+file.local+'"'));
  }
});
test('local archive links preserve resource selection and reject public or malformed hosts',()=>{
  const values={ps3ArchiveAccess:{},ps3ArchiveHost:{value:'192.168.1.20',setAttribute(){},removeAttribute(){}},ps3ArchiveOpen:{href:'',removeAttribute(name){delete this[name];}},ps3ArchiveStatus:{textContent:''}};
  vm.runInNewContext(fs.readFileSync(path.join(root,'assets/ps3-archive-access.js'),'utf8'),{document:{getElementById:id=>values[id]},window:{location:{search:'?resource=gta-iv-texture-installer-v2'}}});
  const submit=()=>values.ps3ArchiveAccess.onsubmit({preventDefault(){}});
  submit();
  assert.equal(values.ps3ArchiveOpen.href,'http://192.168.1.20:8766/?resource=gta-iv-texture-installer-v2');
  for(const host of ['8.8.8.8','192.168.1.999','192.168.1.20:8766','10.0.0.1/path']){
    values.ps3ArchiveHost.value=host;submit();assert.equal(values.ps3ArchiveOpen.href,undefined);assert.match(values.ps3ArchiveStatus.textContent,/private IPv4/);
  }
});
