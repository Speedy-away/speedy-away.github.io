const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {scan,snapshotName}=require('../research-virusmike-ps4-next.cjs');
const root=path.resolve(__dirname,'../..');
const read=name=>JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));
const data=read('docs/virusmike-ps4-next-resources.json');
const jobs=read('docs/virusmike-ps4-next-jobs.json');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');

test('source scanner reads actual outbound and embedded URLs without executing source code',()=>{
  const html='<a href="https://www.google.com/url?q=https%3A%2F%2Fwww.mediafire.com%2Ffile%2Factual%2Fmenu.rar%2Ffile&amp;sa=D">Menu</a><div data-code="&lt;button onclick=&quot;window.open(\'https://example.com/mod.rar\')&quot;&gt;Download&lt;/button&gt;&lt;script&gt;globalThis.sourceCodeWasExecuted=true&lt;/script&gt;"></div>';
  const result=scan(html,data.source);
  assert.ok(result.links.some(link=>link.url==='https://www.mediafire.com/file/actual/menu.rar/file'));
  assert.ok(result.links.some(link=>link.url==='https://example.com/mod.rar'&&link.kind==='decoded-embed-literal'));
  assert.equal(globalThis.sourceCodeWasExecuted,undefined);
  assert.notEqual(snapshotName(data.source+'/ps4-pkg-apps'),snapshotName('https://sites.google.com/view/im-virusmike-exe/ps4-pkg-apps'));
});

test('only the fully retrieved source pack has a job, with exact bytes and original source pins',()=>{
  assert.equal(jobs.jobs.length,data.artifacts.length);
  for(const artifact of data.artifacts){
    const job=jobs.jobs.find(job=>job.id===artifact.id),resource=data.resources.find(resource=>resource.id===artifact.id);
    assert.ok(job&&resource);
    const bytes=fs.readFileSync(path.join(root,job.importPath));
    assert.equal(bytes.length,artifact.bytes);
    assert.equal(hash(bytes),artifact.sha256);
    assert.equal(job.expectedSha256,artifact.sha256);
    assert.equal(job.expectedBytes,artifact.bytes);
    assert.equal(job.platform,'PS4');
    assert.equal(job.url,artifact.source);
    assert.equal(resource.downloads[0].url,artifact.source);
    assert.ok(data.sourceAudit.pages.find(page=>page.url===artifact.sourcePage).downloadLinks.some(link=>link.url===artifact.source));
    assert.deepEqual(resource.gameVersions,['01.33']);
    assert.ok(artifact.titleIds.every(id=>resource.compatibilityText.includes(id)));
    assert.deepEqual(resource.videos,[]);
    assert.deepEqual(data.descriptors.find(item=>item.id===artifact.id).platforms,['ps4']);
    assert.equal(artifact.inspection.members.length,artifact.inspection.regularFiles);
    assert.equal(artifact.inspection.members.filter(file=>/\.(?:gsc|gscc)$/.test(file.path)).length,artifact.inspection.menuScripts);
    const old=artifact.inspection.originalInjectorComparison,oldBytes=fs.readFileSync(path.join(root,old.local.slice(1)));
    assert.equal(oldBytes.length,old.bytes);
    assert.equal(hash(oldBytes),old.sha256);
    assert.notEqual(old.sha256,artifact.inspection.pluginSha256);
  }
});

test('incomplete and unreachable sources remain unavailable without ready jobs or invented full checksums',()=>{
  for(const item of data.unavailable){
    assert.ok(!jobs.jobs.some(job=>job.id===item.id));
    assert.ok(item.reason);
    assert.ok(!item.sha256&&!item.completeSha256);
  }
  const map=data.unavailable.find(item=>item.id==='virusmike-bo3-cjhouse');
  assert.ok(map.partialBytes<map.declaredBytes);
  assert.equal(fs.statSync(path.join(root,map.partialPath)).size,map.partialBytes);
  assert.match(data.unavailable.find(item=>item.id==='virusmike-chronoss-cheats-pack-v2').reason,/HTTP 404.*ETOOMANY/);
  assert.match(data.sourceScope,/does not replace the 38 pinned official GoldHEN files/);
});
