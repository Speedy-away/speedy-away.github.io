const test = require('node:test');
const assert = require('node:assert/strict');
const {improve} = require('../apply-mobile-layout.cjs');
const page = head => '<!doctype html><html><head>' + head + '</head><body><main>Phone downloads</main></body></html>';

test('optional legacy ads cannot block page parsing and download controls', () => {
    const result=improve(page('<script data-cfasync="false" src="https://abscloud.org/1/example"></script><script defer src="/free-keys/key.js?v=3.3.0"></script>'));
    assert.match(result,/<script async data-cfasync="false" src="https:\/\/abscloud.org\/1\/example">/);
    assert.match(result,/<script defer src="\/free-keys\/key.js\?v=3.3.0">/);
    assert.equal(improve(result),result);
});

test('mobile integration preserves newer shared asset versions and their URL parameters', () => {
    const html = page('<link rel="stylesheet" href="/assets/console-guides.css?theme=dark&amp;v=3.3.2#rules"><script src="/script.js?v=3.10.1&amp;page=console"></script><link rel="stylesheet" href="/free-keys/key-page.css?v=4.0"><link rel="stylesheet" href="/free-keys/page-access.css?v=3"><script src="/free-keys/key.js?v=3.4.0"></script>');
    const result = improve(html);
    for(const url of ['/assets/console-guides.css?theme=dark&amp;v=3.3.2#rules','/script.js?v=3.10.1&amp;page=console','/free-keys/key-page.css?v=4.0','/free-keys/page-access.css?v=3','/free-keys/key.js?v=3.4.0']) assert.ok(result.includes('"'+url+'"'),url);
    assert.equal(improve(result),result);
});

test('mobile integration raises old numeric versions without losing unrelated parameters or fragments', () => {
    const result=improve(page('<link rel="stylesheet" href="/assets/console-guides.css?theme=dark&amp;v=3.2.9#rules"><script src="../script.js?mode=phone&amp;v=3.2.0"></script><link rel="stylesheet" href="/free-keys/key-page.css?v=3.1.1"><link rel="stylesheet" href="/free-keys/page-access.css?v=1"><script src="../key.js?v=3.1.0"></script>'));
    for(const url of ['/assets/console-guides.css?theme=dark&amp;v=3.3.0#rules','../script.js?mode=phone&amp;v=3.3.9','/free-keys/key-page.css?v=3.1.29','/free-keys/page-access.css?v=2','../key.js?v=3.3.0']) assert.ok(result.includes('"'+url+'"'),url);
    assert.equal(improve(result),result);
});

test('mobile asset deduplication retains the highest existing cache versions', () => {
    const result=improve(page('<link rel="stylesheet" href="/assets/mobile.css?v=3.10.0"><link rel="stylesheet" href="/assets/mobile.css?v=3.3.1"><link rel="stylesheet" href="/assets/mobile-downloads.css?v=3.4.0&amp;phone=1"><script defer src="/assets/mobile-downloads.js?v=3.5.0#ready"></script>'));
    assert.ok(result.includes('href="/assets/mobile.css?v=3.10.0"'));
    assert.ok(result.includes('href="/assets/mobile-downloads.css?v=3.4.0&amp;phone=1"'));
    assert.ok(result.includes('src="/assets/mobile-downloads.js?v=3.5.0#ready"'));
    assert.equal((result.match(/\/assets\/mobile\.css/g)||[]).length,1);
    assert.equal((result.match(/\/assets\/mobile-downloads\.css/g)||[]).length,1);
    assert.equal((result.match(/\/assets\/mobile-downloads\.js/g)||[]).length,1);
    assert.equal(improve(result),result);
});

test('opaque generator cache tokens survive and fragment-only mobile assets remain singletons', () => {
    const result=improve(page('<link rel="stylesheet" href="/assets/console-downloads.css?v=release-2026-11-02"><script src="/script.js?v=host-fix-abc"></script><link rel="stylesheet" href="/assets/mobile.css#safe-area"><script src="/assets/mobile-downloads.js?v=phone-fix-abc"></script><script src="/assets/mobile-downloads.js?v=3.3.4"></script>'));
    assert.ok(result.includes('console-downloads.css?v=release-2026-11-02'));
    assert.ok(result.includes('script.js?v=host-fix-abc'));
    assert.ok(result.includes('href="/assets/mobile.css?v=3.3.8#safe-area"'));
    assert.ok(result.includes('src="/assets/mobile-downloads.js?v=phone-fix-abc"'));
    assert.equal((result.match(/\/assets\/mobile\.css/g)||[]).length,1);
    assert.equal((result.match(/\/assets\/mobile-downloads\.js/g)||[]).length,1);
    assert.equal(improve(result),result);
});
