const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {consolePage, collectRepositories, isReadyAsset, preferredItem, mergeUpdateInventory, saveExclusive} = require('../update-local-downloads.cjs');

test('default updates include directory-based Xbox, Switch and retro console pages', () => {
  for (const page of ['console/ps3/apps.html', 'console/xbox360/apps.html', 'console/xbox360.html',
    'console/nintendo-switch.html', '/console/nintendo-switch/apps.html', 'console/switch/downloads.html',
    'console/retro/wii.html', 'console/psvita/apps.html', 'console/mods/ps4/gta5/index.html',
    'https://whatwhatboy.com/console/ps5/payloads.html#files']) assert.equal(consolePage(page), true, page);
  for (const page of ['pc/tools.html', 'console/ps45/apps.html', 'console/nintendo-switching.html', 'source-codes/index.html']) assert.equal(consolePage(page), false, page);
  const items = ['console/xbox360/apps.html', 'console/nintendo-switch/apps.html', 'console/retro/wii.html'].map((page, i) =>
    ({id: String(i), url: 'https://github.com/owner/tool' + i + '/releases', pages: [page]}));
  assert.equal(collectRepositories({items}).length, 3);
});

test('console builds are selected by default while source, metadata and desktop variants stay separate', () => {
  for (const file of ['app.pkg', 'app.fpkg', 'payload.elf', 'payload.bin', 'app.nro', 'overlay.ovl',
    'app.wuhb', 'app.dol', 'app.cia', 'app.3dsx', 'app.nds', 'app.jar', 'app.self', 'ps4-linux-loader.bin', 'ready-bundle.zip']) assert.equal(isReadyAsset(file), true, file);
  for (const file of ['app-source.zip', 'app-sdk.7z', 'symbols.zip', 'SHA256SUMS.txt', 'app.json',
    'app-Windows-x64.zip', 'app.exe', 'app.dll', 'app-linux-x64.zip', 'app-macos.zip', 'app-android.apk']) assert.equal(isReadyAsset(file), false, file);
  assert.equal(isReadyAsset('app-Windows-x64.zip', {allTools: true}), true);
});

test('excluded and private resources do not become update jobs and recorded release pins stay intact', () => {
  const pinned = {id: 'pin', url: 'https://github.com/owner/app/releases/tag/v1', pages: ['console/ps5/apps.html'], files: [{resolvedUrl: 'https://github.com/owner/app/releases/download/v1/app.elf'}]};
  const inventory = {items: [pinned,
    {id: 'excluded', url: 'https://github.com/owner/excluded', pages: pinned.pages, status: 'excluded'},
    {id: 'private', url: 'https://github.com/owner/private', pages: pinned.pages, publication: 'private-review'},
    {id: 'gated', url: 'https://github.com/owner/gated', pages: pinned.pages, kind: 'bstlar'}]};
  const jobs = collectRepositories(inventory);
  assert.equal(jobs.length, 1);
  assert.deepEqual([...jobs[0].pinnedTags], ['v1']);
  const item = preferredItem(jobs[0], inventory);
  item.release = 'v2';
  assert.equal(item.url, 'https://github.com/owner/app/releases');
  assert.equal(pinned.url, 'https://github.com/owner/app/releases/tag/v1');
  assert.equal(pinned.release, undefined);
});

test('incremental saves retain other chats, classification edits and every version/copy', () => {
  const old = {name: 'app.elf', sha256: 'old', backupPath: 'F:/archive/v1/app.elf'};
  const next = {name: 'app.elf', sha256: 'new', backupPath: 'F:/archive/v2/app.elf'};
  const duplicate = {...next, backupPath: 'F:/archive/v2/app (2).elf'};
  const latest = {reviews: ['keep'], items: [{id: 'app', title: 'New title from another chat', pages: ['console/ps5/apps.html'], files: [old, duplicate]}, {id: 'ps3-new', files: [{name: 'new.pkg'}]}]};
  const stale = {reviews: [], items: [{id: 'app', title: 'Old title', pages: ['console/ps5/payloads.html'], files: [old, next], release: 'v2', status: 'downloaded'}, {id: 'unrelated-stale', files: []}]};
  const merged = mergeUpdateInventory(latest, stale, new Set(['app']));
  assert.deepEqual(merged.reviews, ['keep']);
  assert.deepEqual(merged.items.map(item => item.id), ['app', 'ps3-new']);
  assert.equal(merged.items[0].title, 'New title from another chat');
  assert.equal(merged.items[0].release, 'v2');
  assert.deepEqual(merged.items[0].files, [old, duplicate, next]);
  assert.equal(latest.items[0].files.length, 2);
});

test('a new update file never replaces an existing build at the same destination', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'whatsite-updates-'));
  try {
    fs.writeFileSync(path.join(directory, 'app.bin'), 'old');
    const temporary = path.join(directory, 'app.partial');
    fs.writeFileSync(temporary, 'new');
    const saved = saveExclusive(temporary, directory, 'app.bin');
    assert.notEqual(saved, path.join(directory, 'app.bin'));
    assert.equal(fs.readFileSync(path.join(directory, 'app.bin'), 'utf8'), 'old');
    assert.equal(fs.readFileSync(saved, 'utf8'), 'new');
  } finally { fs.rmSync(directory, {recursive: true, force: true}); }
});
