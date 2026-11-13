'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const shortLoader = require('../../assets/host-short-loader.js');
const gamerHack = require('../../assets/host-gamerhack-result.js');
const siteLoad = require('../../assets/host-site-load.js');
const guard = require('../../assets/host-karo-builds.js');
const compact = require('../host-compact-pages.cjs');
const offline = require('../host-offline-pack.cjs');
const { hostActions } = require('../build-host-selector.cjs');

const root = path.resolve(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const route = 'ps4/14.00/index.html';
const page = read(route);
const config = page.match(/id="wwb-short-data"[^>]*>([^<]+)</)[1];

test('the public PS4 loader points to one exact firmware and the offline manifest covers its short page', () => {
  const source = hostActions('ps4');
  const published = compact.publicPS4Actions(source);
  const launchers = published.filter(action => action.category === 'loaders');
  const retained = launchers.find(action => action.entryURL === '/ps4/14.00/');
  const original = source.find(action => action.id === retained.id);
  const pinned = JSON.parse(config);
  assert.equal(launchers.length, 2);
  assert.deepEqual(launchers.find(a=>a.id==='local-ps4-afterglow-1402').firmwares,['14.02']);
  assert.equal(launchers[0].entryURL, '/ps4/14.02/');
  assert.deepEqual(retained.firmwares, ['14.00']);
  assert.equal(pinned.nativeRoute.runtime, original.nativeRoute.runtime);
  assert.equal(pinned.nativeRoute.entry.path, original.nativeRoute.entry.path);
  const isUnchanged = action => action.category !== 'loaders' && action.id !== 'ps4-goldhen-user-supplied';
  assert.deepEqual(published.filter(isUnchanged), source.filter(isUnchanged));
  const historical = source.find(action => action.id === 'ps4-goldhen-user-supplied');
  const download = published.find(action => action.id === historical.id);
  for (const key of ['downloadURL', 'bytes', 'sha256', 'firmwares', 'source', 'instructionsURL']) {
    assert.deepEqual(download[key], historical[key], key);
  }
  assert.equal(download.nativeRoute, undefined);
  assert.equal(download.launchURL, undefined);
  assert.match(offline.decorate(page, route, []), /manifest="\/offline\/ps4\.manifest"/);
  for (const alias of ['afterglow', 'gamer']) {
    const bookmark = read('ps4/' + alias + '/index.html');
    assert.match(bookmark, /href="\/ps4\/14\.00\/"/);
    assert.doesNotMatch(bookmark, /href="\/hosts\/ps4\/(?:afterglow|exploit)\//);
  }
});

test('the PS4 native screen adds a back link and log heading without rewriting embedded scripts', () => {
  const name = 'hosts/runtime/gamerhack-g2all-d05d71ff8db2-52269ecd47ec/web/g2all/index.html';
  const original = JSON.parse(read(name).match(/"original"\s*:\s*("(?:\\.|[^"\\])*")/)[1]);
  const themed = compact.showNativeLog(original, name);
  const scripts = html => [...html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/gi)].map(match => match[0]);
  assert.match(themed, /<header class="wwb-runtime-bar">/);
  assert.match(themed, /Live loader log/);
  assert.deepEqual(scripts(themed), scripts(original));
});

test('terminal GamerHack reports distinguish kernel misses, kernel-only success and GoldHEN start', () => {
  const done = 'AG  done -- jailbroken, rwx open, syscall 11 is a kexec gate';
  assert.match(gamerHack.result('AG  handles implausible -- nothing written\nAG  gave up after 4 attempts', '').message, /GoldHEN was not started/);
  assert.equal(gamerHack.result(done, 'GoldHEN v2.4b18.13 Loaded ...').state, 'error');
  assert.equal(gamerHack.result('AG  done', 'GoldHEN v2.4b18.13 Loaded ...').state, 'notice');
  assert.equal(gamerHack.result(done + ', enabler running', '').state, 'ready');
  assert.equal(gamerHack.result('AG  the handles are NOT defused\n' + done + ', enabler running', '').state, 'error');
  assert.equal(gamerHack.result('', 'GoldHEN is Already Loaded ...').state, 'notice');
});

function fixture(ua) {
  function target(properties = {}) {
    return Object.assign({
      listeners: {},
      childNodes: [],
      checked: false,
      textContent: '',
      addEventListener(name, listener) { this.listeners[name] = listener; },
      fire(name, event) { if (this.listeners[name]) this.listeners[name](event); },
      appendChild(node) { this.childNodes.push(node); },
      setAttribute() {},
      removeAttribute() {}
    }, properties);
  }
  const storage = () => {
    const data = new Map();
    return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
  };
  const nodes = Object.fromEntries(['status', 'log', 'load', 'cache', 'progress', 'recovery', 'restarted', 'clear', 'device', 'cache-state', 'refresh'].map(key => [key, target()]));
  nodes.load.disabled = true;
  nodes.data = { textContent: config };
  const doc = { visibilityState: 'visible', getElementById: id => nodes[id.replace('wwb-short-', '')], createElement: () => target() };
  const cache = target({ status: 0 });
  const win = target({
    document: doc,
    navigator: { userAgent: ua },
    location: new URL('https://host.test/ps4/14.00/'),
    localStorage: storage(),
    sessionStorage: storage(),
    HostSiteLoad: siteLoad,
    WhatsiteKaro: guard,
    applicationCache: cache
  });
  const logs = () => nodes.log.childNodes.map(node => node.textContent).join('\n');
  return { win, doc, nodes, cache, logs };
}

test('14.00 shows real cache events and issues a single trusted handoff only after cache readiness', () => {
  for (const ua of ['Desktop', 'PlayStation 4/13.52', 'PlayStation 5/14.00']) {
    const { win, doc, nodes } = fixture(ua);
    shortLoader.install(win, doc);
    assert.equal(nodes.load.disabled, true);
    assert.match(nodes.status.textContent, /PS4 browser on firmware 14\.00/);
    assert.equal(win.sessionStorage.getItem(guard.TICKET), null);
  }
  const { win, doc, nodes, cache, logs } = fixture('PlayStation 4/14.00');
  shortLoader.install(win, doc);
  assert.equal(nodes.load.disabled, true);
  cache.status = 3;
  cache.fire('downloading');
  cache.fire('progress', { loaded: 3, total: 10 });
  assert.equal(nodes.progress.value, 3);
  assert.match(logs(), /Saved 3 of 10 cache files/);
  nodes.load.fire('click', { isTrusted: true });
  assert.equal(win.sessionStorage.getItem(guard.TICKET), null);
  cache.status = 1;
  cache.fire('cached');
  assert.equal(nodes.load.disabled, false);
  nodes.load.fire('click', { isTrusted: false });
  assert.equal(win.sessionStorage.getItem(guard.TICKET), null);
  nodes.load.fire('click', { isTrusted: true });
  assert.match(win.location.pathname, /\/g2all\/index\.html$/);
  const ticket = win.sessionStorage.getItem(guard.TICKET);
  assert.equal(JSON.parse(ticket).firmware, '14.00');
  assert.match(logs(), /Opening the 14\.00 loader/);
  nodes.load.fire('click', { isTrusted: true });
  assert.equal(win.sessionStorage.getItem(guard.TICKET), ticket);
});

test('an existing native lock exposes explicit recovery and permits a new handoff only after clearing', () => {
  const { win, doc, nodes, cache } = fixture('PlayStation 4/14.00');
  win.localStorage.setItem(guard.LOCK, '{}');
  win.sessionStorage.setItem('jb2.goldhen_done', '1');
  win.sessionStorage.setItem('jb1352-read-retry', '4');
  cache.status = 1;
  shortLoader.install(win, doc);
  assert.equal(nodes.recovery.hidden, false);
  assert.equal(nodes.load.disabled, true);
  nodes.clear.fire('click', {isTrusted:true});
  assert.equal(win.localStorage.getItem(guard.LOCK), '{}');
  nodes.restarted.checked = true;
  nodes.restarted.fire('change');
  nodes.clear.fire('click', {isTrusted:false});
  assert.equal(win.sessionStorage.getItem('jb2.goldhen_done'), '1');
  nodes.clear.fire('click', {isTrusted:true});
  assert.equal(win.localStorage.getItem(guard.LOCK), null);
  assert.equal(win.sessionStorage.getItem('jb2.goldhen_done'), null);
  assert.equal(win.sessionStorage.getItem('jb1352-read-retry'), null);
  assert.equal(nodes.load.disabled, false);
});

test('the short launcher applies a saved cache update automatically and never arms Load', () => {
  const {win, doc, nodes, cache} = fixture('PlayStation 4/14.00');
  let reloads = 0;
  cache.status = 4;
  cache.swapCache = () => { cache.status = 1; };
  win.location.reload = () => { reloads++; };
  shortLoader.install(win, doc);
  assert.equal(cache.status, 1);
  assert.equal(nodes.refresh.hidden, true);
  assert.equal(nodes.load.disabled, true);
  assert.equal(reloads, 1);
  cache.fire('updateready');
  assert.equal(reloads, 1);
  assert.equal(win.sessionStorage.getItem(guard.TICKET), null);
  assert.equal(win.localStorage.getItem(guard.LOCK), null);
});

test('an unsuccessful automatic cache swap leaves a manual retry and no launch ticket', () => {
  const {win, doc, nodes, cache} = fixture('PlayStation 4/14.00');
  let reloads = 0;
  cache.status = 4;
  cache.swapCache = () => {};
  win.location.reload = () => { reloads++; };
  shortLoader.install(win, doc);
  assert.equal(nodes.refresh.hidden, false);
  assert.equal(nodes.load.disabled, true);
  assert.match(nodes.status.textContent, /could not be applied/);
  cache.swapCache = () => { cache.status = 1; };
  nodes.refresh.fire('click', {isTrusted: false});
  assert.equal(reloads, 0);
  nodes.refresh.fire('click', {isTrusted: true});
  assert.equal(reloads, 1);
  assert.equal(win.sessionStorage.getItem(guard.TICKET), null);
  assert.equal(win.localStorage.getItem(guard.LOCK), null);
});

test('curated downloads without a console queue id remain downloadable on the device', () => {
  const dash = require('../../assets/host-dashboard.js');
  const action = { platform: 'ps4', downloadURL: '/downloads/test/menu.bin' };
  assert.deepEqual(dash.downloadPlan(action, 'ps4', '', { platform: 'ps4', firmware: '14.00' }, x => x), { destination: 'device', address: '', url: action.downloadURL });
});
