const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {createRequire} = require('node:module');
const {createGameImports, sourceKey} = require('../build-ps4-ps5-game-imports.cjs');
const {createResourceRenderer} = require('../console-resource-renderer.cjs');

const root = path.resolve(__dirname, '../..');
const image = '/assets/images/ps4-gta5/oxagon.png';
const fixture = (resources, files = []) => createGameImports({root, files, data: {
  schemaVersion: 1, games: [{id: 'gta5', slug: 'gta5', title: 'GTA V', cover: image, legacy: true}], resources
}});
const menu = (id, version, url, extra = {}) => ({id, gameIds: ['gta5'], gameVersions: [version], name: id,
  category: 'menu', publication: 'include', downloads: [{id, url, distribution: 'include'}],
  images: [{original: image}], guideBlocks: [], controls: [], videos: [], ...extra});

test('source identity ignores expiring Discord parameters and MediaFire filename aliases', () => {
  assert.equal(sourceKey('https://cdn.discordapp.com/attachments/1/2/menu.zip?ex=123&hm=abc'), sourceKey('https://cdn.discordapp.com/attachments/1/2/menu.zip'));
  assert.equal(sourceKey('https://www.mediafire.com/file/abc/menu.rar/file'), sourceKey('https://www.mediafire.com/file_premium/abc/renamed.rar/file'));
  assert.notEqual(sourceKey('https://mega.nz/file/abc#one'), sourceKey('https://mega.nz/file/abc#two'));
});

test('an archived Discord file without a site mirror opens its source post for a fresh attachment URL', () => {
  const renderer = createResourceRenderer({root});
  const item = menu('discord-tool', '1.57', 'https://cdn.discordapp.com/attachments/123/456/tool.zip', {
    source: {postUrl: 'https://discord.com/channels/100/123'}
  });
  const html = renderer.card(item);
  assert.match(html, /href="https:\/\/discord\.com\/channels\/100\/123" class="btn btn-primary"/);
  assert.match(html, /Download via Discord/);
  assert.doesNotMatch(html, /href="https:\/\/cdn\.discordapp\.com/);
  assert.equal(item.downloads[0].url, 'https://cdn.discordapp.com/attachments/123/456/tool.zip');
});

test('an identical new attachment enhances its matching old game update without replacing the old download', () => {
  const data = fixture([menu('same-menu', '1.56', 'https://example.com/new-attachment')], [{downloadId: 'same-menu', status: 'downloaded', sha256: 'same'}]);
  const old = {source: 'https://example.com/old-attachment', sha256: 'same', group: '156'};
  assert.equal(data.legacyEnhancement('gta5', old).resource.id, 'same-menu');
  assert.equal(data.legacyEnhancement('gta5', {...old, group: '157'}).resource, null);
  const html = data.supplement('gta5', [old]);
  assert.doesNotMatch(html, /id="resource-same-menu"/);
  assert.match(html, /id="guide-same-menu"/);
  assert.match(data.legacyEnhancement('gta5', old).guide, /href="#guide-same-menu" data-guide-open/);
  assert.equal(old.source, 'https://example.com/old-attachment');
});

test('different archive revisions remain separate and source archives stay in the source-code collection', () => {
  const data = fixture([
    menu('new-revision', '1.57', 'https://example.com/new.zip'),
    menu('source-archive', '1.57', 'https://example.com/source.zip', {category: 'source'})
  ], [{downloadId: 'new-revision', status: 'downloaded', sha256: 'new'}]);
  const old = [{source: 'https://example.com/old.zip', group: '157', sha256: 'old'}];
  const mods = data.supplement('gta5', old), sources = data.supplement('gta5', [], 'sources');
  assert.match(mods, /id="resource-new-revision"/); assert.doesNotMatch(mods, /source-archive/);
  assert.match(sources, /id="resource-source-archive"/); assert.doesNotMatch(sources, /new-revision/);
  for (const html of [mods, sources]) {
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
    assert.equal(new Set(ids).size, ids.length);
  }
});

test('a single approved screenshot opens a media panel and YouTube embeds retain timestamp units', () => {
  const renderer = createResourceRenderer({root});
  const item = menu('screenshot-only', '1.57', 'https://example.com/menu.zip');
  assert.ok(renderer.hasDetails(item));
  assert.match(renderer.card(item), /href="#guide-screenshot-only" data-guide-open/);
  assert.match(renderer.details(item), /data-guide-panel/);
  const clip = renderer.videoMarkup({url: 'https://youtube.com/watch?v=WodroCJcxfA&t=1m58s'}, 'Demo');
  assert.match(clip, /youtube-nocookie\.com\/embed\/WodroCJcxfA/);
  assert.match(clip, /start=118/);
  assert.equal(renderer.youtubeVideo('https://youtube.com/watch?v=WodroCJcxfA&t=99999999999999999999'), null);
});

test('current GTA/RDR imports keep all original fifteen local downloads and reachable unique popup targets', () => {
  const data = createGameImports({root});
  const old = JSON.parse(fs.readFileSync(path.join(root, 'downloads/ps4/GTA5/manifest.json'), 'utf8')).files;
  assert.equal(old.length, 15);
  assert.ok(old.every(file => fs.existsSync(path.join(root, file.local))));
  const html = data.supplement('gta5', old);
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  assert.equal(new Set(ids).size, ids.length);
  for (const file of old) {
    const extra = data.legacyEnhancement('gta5', file);
    if (extra.guide) assert.ok(ids.includes('guide-' + extra.resource.id));
  }
  assert.ok(data.forGame('rdr2').some(item => item.id === 'rdr2-oyster'));
  assert.ok(data.forGame('gta5', 'sources').some(item => item.id === 'source-gta5-ai-files'));
});

test('Havana exposes three exact archived builds without a duplicate resource card', () => {
  const imported = createGameImports({root});
  const menu = {url: 'https://github.com/illusionyy/PS4-RDR2-Havana-Mod-Menu-Releases/releases/tag/v1.20', downloadsRendered: true};
  const extra = imported.legacyEnhancement('rdr2', menu);
  assert.equal([...extra.downloads.matchAll(/ download>/g)].length, 3);
  for (const version of ['100', '129', '132']) assert.match(extra.downloads, new RegExp('/downloads/archive/b35a678f8578/rdr3Payload_' + version + '\\.sprx'));
  assert.match(extra.downloads, /1\.00 \(experimental\)/);
  const supplement = imported.supplement('rdr2', [menu]);
  assert.doesNotMatch(supplement, /id="resource-rdr2-havana"/);
  assert.match(supplement, /id="guide-rdr2-havana"/);
  assert.equal(extra.resource.controls[0].input, 'R1 + Square');
});

test('reapplying an additive import preserves the legacy page and creates one supplement', () => {
  const script = path.join(root, 'scripts/build-ps4-ps5-game-imports.cjs');
  const scriptRequire = createRequire(script);
  const target = path.join(root, 'console/mods/ps4/gta5/index.html');
  const original = '<div>Original download cards</div>\n<footer class="guide-footer">Footer</footer>';
  let html = original;
  const safeFs = {...fs,
    existsSync(filename) { return filename === target || fs.existsSync(filename); },
    readFileSync(filename, ...args) { return filename === target ? html : fs.readFileSync(filename, ...args); },
    writeFileSync(filename, value) { assert.equal(filename, target); html = value; }
  };
  const module = {exports: {}};
  vm.runInNewContext(fs.readFileSync(script, 'utf8'), {module, __dirname: path.dirname(script), URL,
    require(name) { return name === 'node:fs' ? safeFs : scriptRequire(name); }
  });
  const importer = module.exports.createGameImports({root, files: [], data: {schemaVersion: 1,
    games: [{id: 'gta5', slug: 'gta5', title: 'GTA V', cover: image, legacy: true}],
    resources: [menu('added-menu', '1.57', 'https://example.com/menu.zip')]
  }});
  importer.buildMods(); const once = html;
  importer.buildMods(); assert.equal(html, once);
  assert.match(html, /Original download cards/);
  assert.equal([...html.matchAll(/id="resource-added-menu"/g)].length, 1);
  assert.equal([...html.matchAll(/id="guide-added-menu"/g)].length, 1);
});
