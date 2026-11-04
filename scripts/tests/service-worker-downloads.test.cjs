const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname,'../../service-worker.js'),'utf8');
function worker({offline = false, quota = false, cachedPages = {}} = {}) {
    const listeners = {}, writes = [], waits = [], matches = [], deletes = [];
    const origin = 'https://whatwhatboy.com';
    const caches = {
        open: async () => ({put: async request => { writes.push(request.url); if (quota) throw Error('quota'); }}),
        match: async request => { matches.push(request); const url=typeof request==='string'?request:new URL(request.url).pathname;return cachedPages[url] ? new Response(cachedPages[url],{headers:{'Content-Type':'text/html'}}) : undefined; },
        keys: async () => ['whatwhatboy-old','unrelated-app-cache'],
        delete: async name => {deletes.push(name); return true;}
    };
    vm.runInNewContext(source, {URL,Response,caches,fetch: async () => {if (offline) throw Error('offline'); return new Response('asset');},
        self:{location:{origin},clients:{claim:async()=>{}},addEventListener:(name,fn)=>listeners[name]=fn}});
    return {listeners,writes,waits,matches,deletes,request(url,destination='document') {
        let result;
        listeners.fetch({request:{method:'GET',url:new URL(url,origin).href,destination},respondWith:p=>result=p,waitUntil:p=>waits.push(p)});
        return result;
    }};
}
test('hosted binaries, inventories and file fetches use native network downloads without UI-cache interception', () => {
    const app=worker({offline:true});
    for (const name of ['/downloads/ps4/file.pkg','/downloads/source/build.zip?version=1','/downloads/catalog.json','/guides/console-files/ps4.md','/payload.elf','/game.xml','/theme.p3t','/menu.nxtheme','/app.wuhb','/EBOOT.PBP','/default.xbe','/PS4UPDATE.PUP']) assert.equal(app.request(name),undefined,name);
    assert.equal(app.request('/api/file',''),undefined);
    assert.deepEqual(app.writes,[]);
    assert.deepEqual(app.matches,[]);
});

test('isolated console runtime documents, modules and appcache bypass UI-cache interception', () => {
    const app=worker({offline:true});
    for(const name of ['/hosts/runtime/ps4-afterglow-test/web/index.html','/hosts/runtime/ps4-afterglow-test/web/jb.js','/hosts/runtime/ps4-afterglow-test/web/cache.appcache'])assert.equal(app.request(name),undefined);
    assert.deepEqual(app.writes,[]);assert.deepEqual(app.matches,[]);
});
test('uncached nested pages receive a self-contained offline explanation instead of the wrong homepage', async () => {
    const app=worker({offline:true});
    const page=await app.request('/pages/help.html');
    assert.equal(page.status,503);
    assert.match(page.headers.get('Content-Type'),/text\/html/);
    const html=await page.text();
    assert.match(html,/This page is unavailable offline/);
    assert.match(html,/<style>/);
    assert.match(html,/href="\/"/);
    assert.doesNotMatch(html,/<(?:link|script)\b[^>]*(?:href|src)="[^/]/);
    assert.equal(app.matches.some(request=>request==='/index.html'),false);
});
test('a failed image never becomes HTML', async () => {
    const app=worker({offline:true});
    const image=await app.request('/assets/images/missing.png','image');
    assert.equal(image.status,503);
    assert.doesNotMatch(await image.text(),/<html>/);
});
test('the download library remains an offline-capable page', async () => {
    const app=worker({offline:true,cachedPages:{'/downloads/':'<html>Saved library</html>','/downloads/index.html':'<html>Saved library</html>'}});
    assert.match(await (await app.request('/downloads/')).text(),/Saved library/);
    assert.match(await (await app.request('/downloads/index.html')).text(),/Saved library/);
});
test('local QA pages bypass the worker so server failures cannot masquerade as successful site checks', () => {
    const app=worker({offline:true});
    assert.equal(app.request('/.playwright-cli/mobile-audit.html'),undefined);
    assert.equal(app.request('/.playwright/fixture.html'),undefined);
    assert.deepEqual(app.matches,[]);
});
test('a cache quota failure does not fail a valid network response or leave a rejected background task', async () => {
    const app=worker({quota:true});
    assert.equal(await (await app.request('/style.css','style')).text(),'asset');
    await Promise.all(app.waits);
    assert.equal(app.writes.length,1);
});
test('other origins and unrelated caches are preserved', async () => {
    const app=worker();
    assert.equal(app.request('https://whatwhatboy.com.other.example/file'),undefined);
    let activation;
    app.listeners.activate({waitUntil:p=>activation=p});
    await activation;
    assert.deepEqual(app.deletes,['whatwhatboy-old']);
});
