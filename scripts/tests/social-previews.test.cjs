const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const scope = require('../site-public-pages.cjs');
const previews = require('../build-social-previews.cjs');
const metadata = require('../page-search-metadata.cjs');
const root = path.resolve(__dirname, '../..');
const local = url => path.join(root, url.replace(/^\/+/, ''));
const decode = value => value.replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"').replaceAll('&apos;', "'").replaceAll('&amp;', '&');

function verifyPng(url, sha256, size, page, dimensions = {width: 1200, height: 630}) {
  assert.match(url, /^\/assets\/images\/[a-z0-9/_.-]+\.png$/i, page);
  assert.ok(!url.split('/').includes('..'), page);
  assert.ok(path.resolve(local(url)).startsWith(path.resolve(root, 'assets/images') + path.sep), page);
  const bytes = fs.readFileSync(local(url));
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', page);
  assert.equal(bytes.readUInt32BE(16), dimensions.width, page);
  assert.equal(bytes.readUInt32BE(20), dimensions.height, page);
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), sha256, page);
  assert.equal(bytes.length, size, page);
}

test('social titles wrap without dropping exact game, platform or version wording', () => {
  const titles = [
    'PS Vita Game Downloads & External Directories',
    'Call of Duty: Black Ops III — PS3 HEN and DEX Tools, Source Downloads & Setup Guides',
    'GTA V Legacy Menus: Exact Game Updates 1.27, 1.32, 1.34, 1.38, 1.46 & 1.47',
    'Astro Bot PS5 Cheats: PPSA21564 01.007.000 JSON Downloads'
  ];
  for (const title of titles) {
    const wrapped = previews.wrapTitle(title);
    assert.ok(wrapped.lines.length > 0 && wrapped.lines.length <= 3, title);
    assert.equal(wrapped.lines.join(' ').replace(/\s+/g, ' '), title.replace(/\s+/g, ' '), title);
    assert.ok(wrapped.fontSize > 0 && wrapped.fontSize <= 76);
    assert.ok(wrapped.lineHeight >= wrapped.fontSize);
  }
});

test('original SVG cards escape title markup and retain page-specific text', () => {
  const svg = previews.renderCard({page: 'console/psvita/test.html', title: 'PS Vita <script> & PPSA21564 01.007.000'});
  assert.match(svg, /<svg\b/);
  assert.ok(!/<script\b/i.test(svg));
  assert.ok(svg.includes('&lt;script&gt;'));
  assert.ok(svg.includes('&amp;'));
  assert.ok(svg.includes('PPSA21564'));
  assert.ok(svg.includes('01.007.000'));
  assert.ok(svg.includes('whatwhatboy'));
  assert.ok(!/<image\b|https?:\/\//i.test(svg.replace(/xmlns=(["'])http:\/\/www\.w3\.org\/2000\/svg\1/g, '')), 'cards are self-contained original vectors');
});

test('platform themes distinguish console families without changing the page title', () => {
  const playstation = previews.pageTheme('console/psvita/game-downloads.html');
  const xbox = previews.pageTheme('console/xbox360/apps.html');
  const nintendo = previews.pageTheme('console/nintendo-switch-2/index.html');
  for (const theme of [playstation, xbox, nintendo]) {
    assert.ok(theme.family && theme.eyebrow && theme.accent);
  }
  assert.notEqual(playstation.accent, xbox.accent);
  assert.notEqual(xbox.accent, nintendo.accent);
});

test('every eligible page has a valid primary preview and a unique original vector card', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'docs/seo/social-images.json'), 'utf8'));
  const pages = scope.pages().map(scope.relativePath);
  assert.ok(manifest.version && manifest.images);
  assert.deepEqual(Object.keys(manifest.images).sort(), [...pages].sort());
  const paths = new Set();
  for (const page of pages) {
    const image = manifest.images[page];
    if (image.cardPath) {
      assert.ok(image.width >= 1200 && image.height >= 630, page + ' uses a full-size illustrated primary');
      assert.ok(image.width / image.height >= 1.8 && image.width / image.height <= 2, page + ' uses a landscape social-preview ratio');
    } else {
      assert.equal(image.width, 1200, page);
      assert.equal(image.height, 630, page);
    }
    assert.equal(image.type, 'image/png', page);
    assert.ok(image.title && image.alt && image.source, page);
    const expectedTitle = previews.displayTitle(metadata.transform(page, fs.readFileSync(path.join(root, page), 'utf8')).metadata.title);
    assert.equal(image.title, expectedTitle, page + ' retains its exact page title');
    verifyPng(image.path, image.sha256, image.bytes, page, image);
    const native = image.cardPath ? {
      path: image.cardPath, sourcePath: image.cardSourcePath, sha256: image.cardSha256,
      bytes: image.cardBytes, source: image.cardSource
    } : image;
    assert.equal(native.source, 'original-vector-render', page);
    assert.match(native.path, /^\/assets\/images\/social\/pages\/[^/]+\.png$/, page);
    assert.match(native.sourcePath, /^\/assets\/images\/social\/sources\/[^/]+\.svg$/, page);
    assert.ok(!paths.has(native.path), page + ' has its own native card URL');
    paths.add(native.path);
    if (image.cardPath) {
      assert.equal(image.sourcePath, undefined, page + ' keeps the SVG source attached to its native fallback');
      verifyPng(native.path, native.sha256, native.bytes, page + ' native fallback');
    }
    const svg = fs.readFileSync(local(native.sourcePath), 'utf8');
    assert.match(svg, /<svg\b/);
    assert.ok(svg.includes('whatwhatboy'), page);
    assert.ok(!/<image\b/i.test(svg), page + ' does not edit or composite generated raster artwork');
    const visibleText = [...svg.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g)].map(match => decode(match[1])).join(' ').replace(/\s+/g, ' ');
    assert.ok(visibleText.includes(expectedTitle.replace(/\s+/g, ' ')), page + ' visibly retains its complete title');
  }
});

test('configured illustrated previews remain primary while native cards stay available', t => {
  const overridePath = path.join(root, 'docs/seo/social-image-overrides.json');
  if (!fs.existsSync(overridePath)) return t.skip('No illustrated primary previews configured yet');
  const config = JSON.parse(fs.readFileSync(overridePath, 'utf8'));
  const overrides = config.images || config;
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'docs/seo/social-images.json'), 'utf8'));
  for (const [page, expected] of Object.entries(overrides)) {
    const actual = manifest.images[page];
    assert.ok(actual, page);
    for (const key of ['path', 'alt', 'width', 'height', 'type', 'source', 'sha256', 'bytes']) {
      assert.equal(actual[key], expected[key], page + ': ' + key);
    }
    assert.ok(actual.cardPath && actual.cardSourcePath && actual.cardSha256 && actual.cardBytes, page);
    assert.equal(actual.cardSource, 'original-vector-render', page);
  }
});

test('preview coverage excludes ready receivers and downloaded HTML tools', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'docs/seo/social-images.json'), 'utf8'));
  for (const page of ['console/ps4/whatsite-ps4.html', 'console/ps5/whatsite-ps5.html', 'downloads/helpers/console-payload-sender/index.html', 'hosts/runtime/ps4-900/upstream/index.html', 'tmp/render.html']) {
    assert.equal(scope.eligible(page), false, page);
    assert.equal(manifest.images[page], undefined, page);
  }
});
