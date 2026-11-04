const test = require('node:test');
const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const {transform} = require('../page-search-metadata.cjs');
const {finish} = require('../search-page-output.cjs');
const {bodyContent} = require('../verify-site-search-metadata.cjs');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {createRequire} = require('node:module');
const fixture = '<!doctype html><html><head><title>Search example</title><meta name="description" content="Browse the actual tools on this page."><link rel="canonical" href="https://whatwhatboy.com/console/search-example.html"></head><body><aside><h2>Unrelated Xbox menu</h2></aside><main id="main-content"><h1>PS Vita projects</h1><article data-search="ps vita" data-category="apps"><h3>PlayStation Vita tools</h3><a href="/downloads/pinned-v1.vpk" download>Original download</a></article><h2>Choose your console</h2></main><footer>Keep the footer.</footer></body></html>';

test('metadata engine imports without writing or traversing the public site', () => {
  const code = "const fs=require('node:fs');for(const key of ['writeFileSync','mkdirSync','renameSync','unlinkSync','rmSync','readdirSync'])fs[key]=()=>{throw Error('Unexpected '+key)};require('./scripts/page-search-metadata.cjs');require('./scripts/update-page-metadata.cjs');process.stdout.write('imported')";
  assert.equal(execFileSync(process.execPath, ['-e', code], {cwd: require('node:path').resolve(__dirname, '../..'), encoding: 'utf8'}), 'imported');
});

test('pure metadata updates preserve body, pin, canonical and are idempotent', () => {
  const result = transform('console/search-example.html', fixture);
  assert.equal(bodyContent(result.html), bodyContent(fixture));
  assert.equal(result.metadata.canonical, 'https://whatwhatboy.com/console/search-example.html');
  assert.ok(result.html.includes('href="/downloads/pinned-v1.vpk" download'));
  assert.ok(result.metadata.keywords.includes('PlayStation Vita'));
  assert.ok(!result.metadata.keywords.includes('Unrelated Xbox menu'));
  assert.ok(!result.metadata.keywords.includes('Choose your console'));
  assert.equal(transform('console/search-example.html', result.html).html, result.html);
});

test('generator finalizer restores metadata after legacy keyword/social overrides', () => {
  const initial = finish('console/search-example.html', fixture);
  const overwritten = initial.replace(/<meta name="keywords" content="[^"]*">/, '<meta name="keywords" content="homebrew, console guides">').replace(/<meta property="og:title"[^>]*>\s*/g, '').replace(/<script id="site-page-schema"[^>]*>[\s\S]*?<\/script>\s*/g, '');
  const regenerated = finish('console/search-example.html', overwritten);
  assert.equal(bodyContent(regenerated), bodyContent(initial));
  assert.ok(regenerated.includes('name="keywords"'));
  assert.ok(regenerated.includes('property="og:title"'));
  assert.equal((regenerated.match(/id="site-page-schema"/g) || []).length, 1);
  assert.ok(regenerated.includes('psvita'));
  assert.equal(finish('console/search-example.html', regenerated), regenerated);
});

test('noindex aliases retain exact directives and canonical without an indexable page schema', () => {
  const alias = fixture.replace('<title>', '<meta name="robots" content="noindex, nofollow"><title>');
  const result = finish('console/search-alias.html', alias);
  assert.ok(result.includes('content="noindex, nofollow"'));
  assert.ok(result.includes('href="https://whatwhatboy.com/console/search-example.html"'));
  assert.ok(!result.includes('id="site-page-schema"'));
});

test('metadata checks stay stable when a wrapper appends only styles or scripts', () => {
  const initial = transform('console/search-example.html', fixture).html;
  const styled = initial.replace('</head>', '<link rel="stylesheet" href="/assets/example.css?v=1"><script defer src="/assets/example.js"></script></head>');
  assert.equal(transform('console/search-example.html', styled).html, styled);
});

test('metadata transform supplies a real title when a new page omits the tag', () => {
  const untitled = fixture.replace('<title>Search example</title>', '');
  const result = transform('console/search-example.html', untitled);
  assert.match(result.html, /<title>PS Vita projects \| whatwhatboy<\/title>/);
  assert.equal(transform('console/search-example.html', result.html).html, result.html);
});

test('generator finalizer leaves downloaded and receiver HTML byte-identical', () => {
  for (const file of ['console/ps4/whatsite-ps4.html', 'console/ps5/whatsite-ps5.html', 'downloads/helpers/sender/index.html', 'tmp/render.html']) assert.equal(finish(file, fixture), fixture, file);
  const receiver = fixture.replace('<body>', '<body><script id="receiver-catalog" type="application/json">[]</script>');
  assert.equal(finish('console/ps4/download-receiver.html', receiver), receiver);
});

test('real shared and PS3 page generators retain complete metadata without a repair sweep', () => {
  const output = new Map();
  const root = path.resolve(__dirname, '../..');
  const fakeFs = {...fs, mkdirSync: () => {}, writeFileSync: (file, html) => output.set(path.resolve(file), String(html)), readFileSync: (file, ...args) => output.has(path.resolve(file)) ? output.get(path.resolve(file)) : fs.readFileSync(file, ...args)};
  function load(file, overrides = {}) {
    const absolute = path.join(root, file), localRequire = createRequire(absolute), exported = {exports: {}};
    const requireModule = id => id === 'node:fs' ? fakeFs : Object.hasOwn(overrides, id) ? overrides[id] : localRequire(id);
    vm.runInNewContext(fs.readFileSync(absolute, 'utf8'), {require: requireModule, module: exported, exports: exported.exports, __dirname: path.dirname(absolute), console, URL}, {filename: absolute});
    return exported.exports;
  }
  const guides = load('scripts/build-console-guides.cjs');
  const ps3 = load('scripts/ps3-page.cjs', {'./build-console-guides.cjs': guides});
  guides.page('console/ps2/emulators.html', 'PS2 source title', 'Actual PS2 tools.', '/assets/images/logo.png', [], '<section id="start"><h2>FCEUmm-PS2</h2></section>');
  ps3.page('console/ps3/search-pipeline.html', 'PS3 project resources', 'PS3 resources with exact downloads.', '/assets/images/logo.png', [], '<section id="start"><h2>webMAN MOD</h2><a href="/downloads/pinned-v1.pkg" download>Original download</a></section>', '#start', 'Browse', ['legacy keyword override']);
  assert.equal(output.size, 2);
  for (const [file, html] of output) {
    assert.equal((html.match(/id="site-page-schema"/g) || []).length, 1, file);
    assert.match(html, /property="og:title"/);
    assert.match(html, /name="twitter:description"/);
    assert.equal(transform(file, html).html, html, file + ' needs no repair');
  }
  assert.match(output.get(path.join(root, 'console/ps2/emulators.html')), /<title>PS2 Emulators \| whatwhatboy<\/title>/);
  assert.ok(output.get(path.join(root, 'console/ps3/search-pipeline.html')).includes('href="/downloads/pinned-v1.pkg" download'));
});
