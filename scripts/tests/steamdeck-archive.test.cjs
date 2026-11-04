const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {validateJob, optionsFor, selectedJobs, validateInstallerContent, mergeReports, saveExclusive} = require('../archive-steamdeck-tools.cjs');
const {layoutFor} = require('../download-archive-layout.cjs');

const fixture = changes => ({id: 'steamdeck-tool', title: 'Steam Deck Tool', version: 'v1.0',
  url: 'https://github.com/owner/tool', assetUrl: 'https://github.com/owner/tool/releases/download/v1.0/tool-x86_64.AppImage',
  filename: 'tool-x86_64.AppImage', archiveRole: ['Builds', 'Linux'], maxBytes: 1024, expectedBytes: 512, ...changes});

test('validation permits bounded Linux releases and raw installer snapshots', () => {
  assert.equal(validateJob(fixture()).id, 'steamdeck-tool');
  const installer = fixture({assetUrl: 'https://raw.githubusercontent.com/owner/tool/commit/install.desktop', filename: 'install.desktop'});
  assert.equal(validateJob(installer).filename, 'install.desktop');
  for (const assetUrl of ['https://github.com/SteamDeckHomebrew/decky-installer/releases/latest/download/decky_installer.desktop', 'https://www.emudeck.com/EmuDeck.desktop', 'https://dl.flathub.org/repo/appstream/net.retrodeck.retrodeck.flatpakref']) {
    assert.doesNotThrow(() => validateJob(fixture({assetUrl, filename: assetUrl.split('/').pop(), archiveRole: ['Helpers', 'Linux']})));
  }
  assert.doesNotThrow(() => validateJob(fixture({filename: 'chiaki-ng.AppImage_x86_64', expectedSha256: 'a'.repeat(64)})));
});

test('approved Flathub installers retain the exact app ID and installer role', () => {
  for (const appId of ['net.lutris.Lutris', 'com.github.Matoking.protontricks', 'com.github.tchx84.Flatseal', 'org.kde.kdeconnect', 'com.usebottles.bottles', 'org.kde.filelight']) {
    const job = fixture({assetUrl: 'https://dl.flathub.org/repo/appstream/' + appId + '.flatpakref', filename: appId + '.flatpakref', archiveRole: ['Helpers', 'Linux']});
    assert.doesNotThrow(() => validateJob(job));
    assert.doesNotThrow(() => validateInstallerContent('[Flatpak Ref]\nName=' + appId + '\nBranch=stable\n', job));
    assert.throws(() => validateInstallerContent('[Flatpak Ref]\nName=org.other.App\n', job), /app ID/);
    assert.throws(() => validateJob({...job, filename: 'other.flatpakref'}));
    assert.throws(() => validateJob({...job, archiveRole: ['Builds', 'Linux']}));
    assert.throws(() => validateJob({...job, assetUrl: job.assetUrl + '?app=other'}));
  }
  assert.throws(() => validateJob(fixture({assetUrl: 'https://dl.flathub.org/repo/appstream/org.other.App.flatpakref', filename: 'org.other.App.flatpakref'})));
  assert.throws(() => validateInstallerContent('<html>Error page</html>', fixture({filename: 'installer.desktop'})));
});

test('Decky build bundles are archived separately from Linux tools and installers', () => {
  const plugin = fixture({category: 'Plugins', filename: 'SteamGridDB.zip', assetUrl: 'https://github.com/SteamDeckHomebrew/decky-steamgriddb/releases/download/v1.0/SteamGridDB.zip', archiveRole: ['Builds']});
  assert.doesNotThrow(() => validateJob(plugin));
  const segments = layoutFor({...plugin, platform: 'Steam Deck'}, {name: plugin.filename, releaseTag: plugin.version, archiveRole: plugin.archiveRole});
  assert.equal(segments[0], 'Steam Deck');
  assert.equal(segments[1], 'Plugins');
  assert(segments.includes('Builds'));
  assert(!segments.includes('Source Code'));
  assert.throws(() => validateJob({...plugin, archiveRole: ['Helpers', 'Linux']}));
  assert.throws(() => validateJob({...plugin, category: 'Other'}));
  assert.throws(() => validateJob({...plugin, filename: 'plugin.AppImage'}));
  assert.throws(() => validateJob({...plugin, assetUrl: 'https://github.com/owner/repo/releases/download/v1.0/source.zip'}));
});

test('Decky CDN allows only the store build path with its matching published hash', () => {
  const sha256 = '99beaf1374af82408e6d056e0b0147e5fca544e1035fa7ab88419231697bc231';
  const assetUrl = 'https://cdn.tzatzikiweeb.moe/file/steam-deck-homebrew/versions/' + sha256 + '.zip';
  const plugin = fixture({category: 'Plugins', filename: 'CSSLoader-2.1.3.zip', assetUrl, archiveRole: ['Builds'], expectedSha256: sha256});
  assert.doesNotThrow(() => validateJob(plugin));
  for (const changes of [
    {category: 'Tools'}, {expectedSha256: undefined}, {expectedSha256: 'a'.repeat(64)},
    {assetUrl: assetUrl.replace('/versions/', '/sources/')}, {assetUrl: assetUrl + '?other=1'},
    {assetUrl: assetUrl.replace(sha256, 'unknown')}, {assetUrl: assetUrl.replace('cdn.tzatzikiweeb.moe', 'other.tzatzikiweeb.moe')},
  ]) assert.throws(() => validateJob({...plugin, ...changes}));
});

test('repeated job IDs select only requested work without modifying older jobs', () => {
  const jobs = [fixture({id: 'old-tool'}), fixture({id: 'new-tool'}), fixture({id: 'new-plugin', category: 'Plugins'})];
  const before = JSON.stringify(jobs);
  const options = optionsFor(['--download', '--id=new-plugin', '--id=new-tool', '--id=new-tool']);
  assert.equal(options.download, true);
  assert.deepEqual(selectedJobs(jobs, options.ids).map(job => job.id), ['new-tool', 'new-plugin']);
  assert.equal(JSON.stringify(jobs), before);
  assert.equal(optionsFor([]).download, false);
  assert.deepEqual(selectedJobs(jobs, optionsFor(['--check']).ids), jobs);
  assert.throws(() => selectedJobs(jobs, new Set(['missing-job'])), /Unknown/);
  for (const args of [['--id='], ['--id=../bad'], ['--unknown'], ['--download', '--check']]) assert.throws(() => optionsFor(args));
});

test('validation rejects repository/source URLs, unrelated platforms, and unbounded files', () => {
  for (const changes of [
    {assetUrl: 'https://github.com/owner/tool'},
    {assetUrl: 'https://codeload.github.com/owner/tool/zip/main'},
    {assetUrl: 'https://example.com/tool.AppImage'},
    {assetUrl: 'https://raw.githubusercontent.com/owner/tool/main/source.zip', filename: 'build.zip'},
    {filename: 'tool-source.zip'}, {filename: 'tool-arm64.AppImage'}, {filename: 'tool.exe'},
    {filename: '../tool.AppImage'}, {version: '../../v1'}, {maxBytes: 0}, {expectedBytes: 1025},
    {archiveRole: ['Source Code']}, {archiveRole: []}, {expectedSha256: 'not a hash'},
    {assetUrl: 'https://www.emudeck.com/other.zip'}, {assetUrl: 'https://dl.flathub.org/other.flatpakref'},
  ]) assert.throws(() => validateJob(fixture(changes)), JSON.stringify(changes));
});

test('inventory merge preserves older versions, duplicate copies, attempts, and unrelated items', () => {
  const oldFile = {name: 'tool.AppImage', backupPath: 'F:/archive/v1/tool.AppImage', sha256: 'old'};
  const nextFile = {...oldFile, backupPath: 'F:/archive/v2/tool.AppImage', sha256: 'new'};
  const duplicate = {...nextFile, backupPath: 'F:/archive/v2/tool (copy 2).AppImage'};
  const old = {scope: 'tools', items: [{id: 'tool', url: 'https://github.com/owner/tool', pages: ['old.html'], files: [oldFile], attempts: [{at: 'old', status: 'downloaded'}]}, {id: 'unrelated', files: []}]};
  const next = {items: [{id: 'tool', url: 'https://github.com/owner/tool/releases', pages: ['console/steamdeck.html'], files: [nextFile, duplicate], attempts: [{at: 'new', status: 'downloaded'}]}]};
  const merged = mergeReports(old, next);
  assert.equal(merged.scope, 'tools');
  assert.equal(merged.items.length, 2);
  assert.deepEqual(merged.items[0].files, [oldFile, nextFile, duplicate]);
  assert.deepEqual(merged.items[0].pages, ['old.html', 'console/steamdeck.html']);
  assert.equal(merged.items[0].attempts.length, 2);
  assert.equal(merged.items[0].sourceUrls.length, 2);
});

test('saving never replaces an existing file or discards a different version', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'steamdeck-archive-test-'));
  const temporary = path.join(directory, 'new.partial'), target = path.join(directory, 'tool.AppImage');
  fs.writeFileSync(target, 'old version');
  fs.writeFileSync(temporary, 'new version');
  const saved = saveExclusive(temporary, target);
  assert.notEqual(saved, target);
  assert.equal(fs.readFileSync(target, 'utf8'), 'old version');
  assert.equal(fs.readFileSync(saved, 'utf8'), 'new version');
  assert.equal(fs.readFileSync(temporary, 'utf8'), 'new version');
  // Remove only this test's individual files, leaving the real archive untouched.
  for (const file of [temporary, target, saved]) fs.unlinkSync(file);
  fs.rmdirSync(directory);
});
