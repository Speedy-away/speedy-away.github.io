const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pages, improve, themeFor, eligible } = require('../apply-site-background.cjs');

test('integration preserves page content and is idempotent for root and nested pages', () => {
    const html = '<!doctype html>\r\n<html><head><title>Platform</title></head><body class="console-guide" data-brand="ps5"><main><a href="/downloads/pinned-v1.pkg">Pinned download</a></main></body></html>';
    const result = improve(html, 'console/ps5/index.html');
    assert.match(result, /class="console-guide site-atmosphere"/);
    assert.match(result, /data-background-theme="cobalt"/);
    assert.match(result, /data-brand="ps5"/);
    assert.match(result, /<a href="\/downloads\/pinned-v1.pkg">Pinned download<\/a>/);
    assert.equal((result.match(/site-background\.css/g) || []).length, 1);
    assert.equal((result.match(/site-background\.js/g) || []).length, 1);
    assert.equal(improve(result, 'console/ps5/index.html'), result);
});

test('homepage migration removes old runtime, canvas and motion button while retaining the homepage stylesheet', () => {
    const html = '<html><head><link rel="stylesheet" href="assets/home.css?v=2"><script defer src="assets/home-background.js?v=1"></script></head><body class="home-page"><div class="home-flow-background" id="home-flow-background" aria-hidden="true"><canvas id="home-flow-canvas"></canvas></div><main>Home</main><button id="home-motion-toggle"><i class="fas fa-pause"></i></button></body></html>';
    const result = improve(html, 'index.html');
    assert.doesNotMatch(result, /home-background\.js|home-flow-background|home-flow-canvas|home-motion-toggle/);
    assert.match(result, /assets\/home\.css\?v=2/);
    assert.match(result, /<main>Home<\/main>/);
    assert.match(result, /data-background-theme="emerald"/);
    assert.equal(improve(result, 'index.html'), result);
});

test('later page-generator assets retain their ordering without repeated background rewrites', () => {
    const original = improve('<html><head><title>Home</title></head><body>Content</body></html>', 'index.html');
    const withMobile = original.replace('</head>', '<link rel="stylesheet" href="/assets/mobile.css?v=3.3.0"></head>');
    assert.equal(improve(withMobile, 'index.html'), withMobile);
    const withLaterClass = original.replace('class="site-atmosphere"', 'class="site-atmosphere host-selector"');
    assert.equal(improve(withLaterClass, 'index.html'), withLaterClass);
});

test('palette mapping stays stable for platform and resource sections', () => {
    const examples = {
        'index.html': 'emerald',
        'console/ps4/index.html': 'cobalt',
        'console/mods/ps4/gta5/index.html': 'cobalt',
        'hosts/ps5/index.html': 'cobalt',
        'console/xbox360/index.html': 'emerald',
        'console/nintendo-switch.html': 'rose',
        'console/steamdeck.html': 'ice',
        'pc/playstation-emulators.html': 'ice',
        'games/gta/index.html': 'violet',
        'downloads/index.html': 'amber',
        'source-codes/games/gta5/ps4.html': 'amber',
        'tools/injectors.html': 'amber'
    };
    for (const [file, theme] of Object.entries(examples)) assert.equal(themeFor(file), theme, file);
});

test('redirects and helper or self-contained payload pages remain unchanged', () => {
    const normal = '<html><head></head><body><main>Content</main></body></html>';
    const redirect = '<html><head><meta content="0;url=/" http-equiv="refresh"></head><body>Redirect</body></html>';
    for (const [html, file] of [[redirect, 'old.html'], [normal, '.tmp/source-review/index.html'], [normal, 'free-keys/sponsor-frame.html'], [normal, 'console/ps4/whatsite-ps4.html'], [normal, 'console/ps5/whatsite-ps5.html']]) {
        assert.equal(eligible(html, file), false);
        assert.equal(improve(html, file), html);
    }
    assert.equal(eligible(normal.replace('<head>', '<head><meta name="robots" content="noindex">'), '404.html'), true);
});

test('site pages include current background assets or the generator-safe shared loader', () => {
    const files = pages();
    const relative = file => path.relative(path.resolve(__dirname, '../..'), file).replaceAll('\\', '/');
    const routes = files.map(relative);
    for (const route of ['index.html', '404.html', 'free-keys/scooby/index.html', 'downloads/index.html', 'console/ps5/index.html', 'pages/help.html']) assert.ok(routes.includes(route), route);
    assert.ok(!routes.some(route => route.split('/').some(part => part.startsWith('.')) || route.startsWith('api/') || route === 'free-keys/sponsor-frame.html' || /^downloads\/(?!index\.html$)/.test(route)));
    for (const file of files) {
        const html = fs.readFileSync(file, 'utf8');
        // Other page builders can run independently of the static pass. Their
        // shared script installs the same assets, covered by controller tests.
        const hasDirectAsset = /(?:href|src)=["'][^"']*site-background\.(?:css|js)/.test(html);
        const hasSharedLoader = /<script\b[^>]*src=["'](?:[^"']*\/)?script\.js(?:\?[^"']*)?["']/.test(html);
        // Heading stylesheet cache versions belong to their page generator.
        // They can differ while the background itself is fully integrated.
        const backgroundOnly = text => text.replace(/(\bhref\s*=\s*["'](?:[^"']*\/)?(?:style|console-guides)\.css)(?:\?[^"']*)?(["'])/gi, '$1$2');
        assert.ok(backgroundOnly(improve(html, file)) === backgroundOnly(html) || (!hasDirectAsset && hasSharedLoader), relative(file) + ' needs background integration');
    }
});

test('PS3 file-list regeneration retains background integration and plain download links', () => {
    const vm = require('node:vm');
    const filename = path.resolve(__dirname, '../build-ps3-browser-downloads.cjs');
    const localRequire = require('node:module').createRequire(filename);
    const writes = new Map();
    const memoryFs = {...fs, mkdirSync() {}, writeFileSync(file, value) { writes.set(path.resolve(file), value); }};
    const module = {exports: {}};
    const sandbox = {module, exports: module.exports, __dirname: path.dirname(filename), console: {log() {}},
        require(name) { return name === 'node:fs' ? memoryFs : localRequire(name); }};
    vm.runInNewContext(fs.readFileSync(filename, 'utf8'), sandbox, {filename});
    module.exports.build();
    const root = path.resolve(__dirname, '../..');
    const html = writes.get(path.join(root, 'console/ps3/browser-downloads.html'));
    const files = JSON.parse(writes.get(path.join(root, 'downloads/ps3/catalog.json'))).files;
    assert.ok(files.length > 0);
    assert.equal(improve(html, 'console/ps3/browser-downloads.html'), html);
    assert.equal((html.match(/site-background\.css/g) || []).length, 1);
    assert.equal((html.match(/site-background\.js/g) || []).length, 1);
    assert.match(html, /data-background-theme="cobalt"/);
    for (const file of files) {
        assert.ok(html.includes(`href="${file.local.replaceAll('&', '&amp;')}" download`));
        assert.ok(html.includes(file.sha256));
    }
    assert.doesNotMatch(html, /<(?:video|iframe)\b/i);
});
