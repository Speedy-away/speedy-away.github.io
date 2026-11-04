const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {createArchive, contained, mergeReports, publicFile} = require('../console-expansion-archive.cjs');
const workspace = path.resolve(__dirname, '../..');
const fixtures = path.join(workspace, 'docs/tmp');
fs.mkdirSync(fixtures, {recursive: true});
function fixture() {
  const base = fs.mkdtempSync(path.join(fixtures, 'archive-intake-test-'));
  const backup = path.join(base, 'backup'); fs.mkdirSync(backup);
  const api = createArchive({workspaceRoot: base, backupRoot: backup, lockTimeoutMs: 5000, lockPollMs: 5});
  return {base, backup, api};
}
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const item = (scope = 'sample', resource = 'app') => ({id: scope + '-' + resource, title: 'Sample app', url: 'https://example.com/project', platform: 'Nintendo Switch', category: ['Games', 'Sample Game', 'Mods'], pages: ['console/example.html']});
const file = (version = '1.0', source = 'https://example.com/releases/build.nro') => ({name: 'build.nro', version, sourceUrl: source, archiveRole: ['Builds']});
function report(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function writeReport(file, value) { fs.mkdirSync(path.dirname(file), {recursive: true}); fs.writeFileSync(file, JSON.stringify(value)); }

test('preserves different destinations and all versions; identical bytes can be reused', async () => {
  const {api} = fixture();
  const first = await api.writeBytes({scope:'sample', item:item(), file:file(), bytes:Buffer.from('ready-build-one')});
  const identical = await api.writeBytes({scope:'sample', item:item(), file:file(), bytes:Buffer.from('ready-build-one')});
  const changed = await api.writeBytes({scope:'sample', item:item(), file:file(), bytes:Buffer.from('ready-build-two')});
  const next = await api.writeBytes({scope:'sample', item:item(), file:file('2.0'), bytes:Buffer.from('ready-build-one')});
  assert.equal(first.file.backupPath, identical.file.backupPath);
  assert.equal(identical.reused, true);
  assert.notEqual(changed.file.backupPath, first.file.backupPath);
  assert.notEqual(next.file.backupPath, first.file.backupPath);
  assert.equal(fs.readFileSync(first.file.backupPath, 'utf8'), 'ready-build-one');
  assert.equal(fs.readFileSync(changed.file.backupPath, 'utf8'), 'ready-build-two');
  const sidecar = report(first.inventory);
  assert.equal(sidecar.items[0].files.length, 3);
  assert.deepEqual(sidecar.items[0].files.map(row => row.version).sort(), ['1.0','1.0','2.0']);
  assert.equal(first.publicFile.backupPath, undefined);
  assert.equal(first.publicFile.sourceUrl, file().sourceUrl);
});

test('archiveFile copies and hashes regular files without executing them', async () => {
  const {api, base} = fixture();
  const source = path.join(base, 'source-payload.bin'), bytes = crypto.randomBytes(128 * 1024);
  fs.writeFileSync(source, bytes);
  const saved = await api.archiveFile({scope:'sample', item:item(), file:{...file(), name:'payload.bin', expectedBytes:bytes.length, expectedSha256:sha(bytes)}, sourceFile:source});
  assert.equal(saved.file.bytes, bytes.length);
  assert.equal(saved.file.sha256, sha(bytes));
  assert.deepEqual(fs.readFileSync(saved.file.backupPath), bytes);
  assert.deepEqual(fs.readFileSync(source), bytes);
});

test('unions both latest inventories and retains unrelated top-level fields, files and sources', async () => {
  const {api, base, backup} = fixture();
  const a = await api.writeBytes({scope:'sample', item:item(), file:file(), bytes:Buffer.from('one')});
  await api.writeBytes({scope:'sample', item:item(), file:file('2.0','https://example.com/other.nro'), bytes:Buffer.from('two')});
  writeReport(path.join(base,'docs/download-audit.json'), {workspaceNote:{preserved:true}, items:[{id:'legacy-workspace', title:'Legacy workspace', files:[{name:'old.bin', sha256:'a', version:'old'}]}]});
  writeReport(path.join(backup,'download-inventory.json'), {backupNote:{preserved:true}, items:[{id:'legacy-backup', title:'Legacy backup', files:[{name:'other.bin', sha256:'b', version:'old'}]}]});
  const checked = await api.mergeInventory({inventory:a.inventory, checkOnly:true, verifyFiles:true});
  assert.equal(checked.items, 1);
  assert.equal(report(path.join(backup,'download-inventory.json')).items.length, 1);
  const result = await api.mergeInventory({inventory:a.inventory, verifyFiles:true});
  assert.equal(result.items, 3);
  for (const target of [path.join(base,'docs/download-audit.json'),path.join(backup,'download-inventory.json')]) {
    const merged = report(target);
    assert.equal(merged.workspaceNote.preserved, true);
    assert.equal(merged.backupNote.preserved, true);
    assert.equal(merged.items.find(row=>row.id==='sample-app').files.length, 2);
  }
  assert.ok(fs.readdirSync(path.join(backup,'archive-history/console-expansion-intake')).length >= 3);
});

test('cooperating concurrent archive and merge calls keep every file and item', async () => {
  const {api, backup, base} = fixture();
  const sameDestination = await Promise.all(['first','second'].map(text=>api.writeBytes({scope:'racing',item:item('racing'),file:file(),bytes:Buffer.from(text)})));
  assert.notEqual(sameDestination[0].file.backupPath, sameDestination[1].file.backupPath);
  const results = await Promise.all(Array.from({length:6},(_,index)=>api.writeBytes({scope:'scope'+index,item:item('scope'+index),file:file(),bytes:Buffer.from('build-'+index)})));
  await Promise.all(results.map(value=>api.mergeInventory({inventory:value.inventory})));
  const merged = report(path.join(backup,'download-inventory.json'));
  assert.equal(merged.items.length, 7);
  assert.equal(merged.items.find(row=>row.id==='racing-app').files.length, 2);
  assert.equal(fs.existsSync(path.join(base,'.console-expansion-intake.lock')), false);
  assert.equal(fs.existsSync(path.join(backup,'.console-expansion-intake.lock')), false);
});

test('immutable sidecars and metadata snapshots recover an overwritten materialized inventory', async () => {
  const {api, base, backup} = fixture();
  const a = await api.writeBytes({scope:'sample',item:item(),file:file(),bytes:Buffer.from('one')});
  writeReport(path.join(backup,'download-inventory.json'), {items:[{id:'older-legacy', files:[{name:'kept.zip', version:'v1', sha256:'older'}]}]});
  await api.mergeInventory({inventory:a.inventory});
  // Simulate an older task that ignores the helper lock and writes a stale view.
  writeReport(path.join(base,'docs/download-audit.json'), {items:[{id:'late-legacy', files:[]}]});
  writeReport(path.join(backup,'download-inventory.json'), {items:[{id:'late-legacy', files:[]}]});
  writeReport(a.inventory, {schemaVersion:1, scope:'sample', items:[]});
  await api.mergeInventory({inventory:a.inventory});
  const recovered = report(path.join(backup,'download-inventory.json'));
  assert.deepEqual(recovered.items.map(row=>row.id).sort(), ['late-legacy','older-legacy','sample-app']);
  assert.equal(recovered.items.find(row=>row.id==='sample-app').files.length, 1);
});

test('rejects traversal, symlink escape, false hashes and out-of-root sidecar paths', async t => {
  const {api, base, backup} = fixture();
  assert.throws(()=>contained(backup,path.join(base,'outside.bin')),/escapes/);
  await assert.rejects(api.writeBytes({scope:'sample',item:item(),file:{...file(),name:'../escape.bin'},bytes:Buffer.from('bad')}),/basename/);
  await assert.rejects(api.writeBytes({scope:'sample',item:item(),file:{...file(),expectedSha256:'0'.repeat(64)},bytes:Buffer.from('bad')}),/SHA-256/);
  assert.throws(()=>publicFile({...file(),local:'F:/private/file.bin'}),/public local/i);
  const outside=path.join(base,'outside');fs.mkdirSync(outside);
  const link=path.join(backup,'junction');
  try { fs.symlinkSync(outside,link,process.platform==='win32'?'junction':'dir'); }
  catch(error) { if(['EPERM','EACCES'].includes(error.code)) t.diagnostic('Host denied test symlink creation; lexical boundary checks still verified'); else throw error; }
  if(fs.existsSync(link))assert.throws(()=>contained(backup,path.join(link,'nested/file.bin')),/resolves outside/);
  const external=path.join(base,'external.bin');fs.writeFileSync(external,'bad');
  await assert.rejects(api.appendInventory({scope:'sample',items:[{...item(),files:[{...file(),backupPath:external,bytes:3,sha256:sha('bad')}]}]}),/escapes/);
});

test('metadata merge keeps duplicate origins/versions and existing unknown sections', () => {
  const first={id:'same',files:[{name:'same.bin',backupPath:'one',sha256:'hash',version:'1',sourceUrl:'https://a.example/file'}]};
  const second={id:'same',files:[{name:'same.bin',backupPath:'one',sha256:'hash',version:'2',sourceUrl:'https://b.example/file'}]};
  const merged=mergeReports({extra:{one:true},items:[first]},{extra:{two:true},items:[second]});
  assert.equal(merged.items[0].files.length,2);
  assert.deepEqual(merged.extra,{one:true,two:true});
});
