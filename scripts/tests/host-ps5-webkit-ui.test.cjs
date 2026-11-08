'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ui = require('../host-ps5-webkit-ui.cjs');
const compact = require('../host-compact-pages.cjs');
const style = require('../style-host-pages.cjs');
const siteLoad = require('../../assets/host-site-load.js');
const nativeGuard = require('../../hosts/runtime/ps5-webkit-dd8e4e0914c5/guard.js');
const build = require('../../docs/ps5-webkit-build.json');
const root = path.resolve(__dirname, '../..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const config = page => JSON.parse(page.match(/id="ps5-launch-data" type="application\/json">([^<]+)/)[1]);

test('short PS5 pages preserve the exact pinned firmware choices and stage no native scripts', () => {
  const exact = read('ps5/7.61/index.html');
  const group = read('ps5/relapse/index.html');
  assert.deepEqual(config(exact).firmwares, ['7.61']);
  assert.deepEqual(config(group).firmwares, [...build.firmwares].reverse());
  for (const page of [exact, group]) {
    assert.equal(config(page).nativeRoute.target, build.runEntry);
    assert.match(page, /<figure class="ps5-deck-art"><img [^>]+whatwhatboy-ps5\.jpg/);
    assert.match(page, /id="ps5-deck-log"/);
    assert.doesNotMatch(page, /src="[^"]*(?:guard\.js|\/web\/src\/)/);
  }
});

function fixture(userAgent, { visible = true, failNavigation = false } = {}) {
  const action = config(read('ps5/7.61/index.html'));
  const store = new Map(), events = {}, attributes = {};
  const state = {textContent:''}, log = {textContent:''};
  const start = {disabled:true, addEventListener:(type, handler) => { events[type] = handler; },
    setAttribute:(name, value) => { attributes[name] = value; }, removeAttribute:name => { delete attributes[name]; }};
  const nodes = {'ps5-launch-data':{textContent:JSON.stringify(action)}, 'ps5-launch-status':state, 'ps5-launch-start':start, 'ps5-deck-log':log};
  const document = {visibilityState:visible?'visible':'hidden', querySelector:() => null, getElementById:id => nodes[id],
    addEventListener:(type, handler) => { events[type] = handler; }};
  const entry = new URL('https://wwb.test/ps5/7.61/');
  const location = {origin:entry.origin, protocol:entry.protocol, pathname:entry.pathname,
    get href() { return entry.href; }, set href(value) { if (failNavigation) throw Error('Navigation blocked'); target = value; }};
  let target;
  const window = {navigator:{userAgent}, location, HostSiteLoad:siteLoad,
    sessionStorage:{getItem:key => store.get(key) || null, setItem:(key, value) => store.set(key, value), removeItem:key => store.delete(key)},
    addEventListener:(type, handler) => { events[type] = handler; }};
  window.top = window.self = window;
  vm.runInNewContext(read('assets/host-ps5-webkit-ui.js'), {window, document});
  return {state, log, start, store, events, target:() => target};
}

test('short PS5 launcher sends only one matching trusted click to the existing native ticket gate', () => {
  for (const ua of ['Desktop', 'PlayStation 5/7.60', 'PlayStation 4/7.61', 'PlayStation 5/07.61']) {
    const f = fixture(ua);
    assert.equal(f.start.disabled, true, ua);
    f.events.click({isTrusted:true});
    assert.equal(f.store.size, 0);
  }
  const hidden = fixture('PlayStation 5/7.61', {visible:false});
  hidden.events.click({isTrusted:true});
  assert.equal(hidden.store.size, 0);

  const f = fixture('PlayStation 5/7.61');
  assert.equal(f.start.disabled, false);
  f.events.click({isTrusted:false});
  assert.equal(f.store.size, 0);
  f.events.click({isTrusted:true});
  assert.equal(f.start.disabled, true);
  assert.equal(f.target(), 'https://wwb.test' + build.runEntry);
  const ticket = JSON.parse(f.store.get(nativeGuard.ticketKey));
  assert.equal(ticket.runPath, build.runEntry);
  assert.equal(ticket.firmware, '7.61');
  assert.match(f.log.textContent, /Opening the native PS5 loader/);
  f.events.click({isTrusted:true});
  assert.deepEqual(JSON.parse(f.store.get(nativeGuard.ticketKey)), ticket);
  f.events.pageshow({persisted:true});
  assert.match(f.state.textContent, /reopen this entry/);
});

test('failed navigation clears the native ticket and keeps the page safe to refresh', () => {
  const f = fixture('PlayStation 5/7.61', {failNavigation:true});
  f.events.click({isTrusted:true});
  assert.equal(f.store.size, 0);
  assert.equal(f.start.disabled, true);
  assert.match(f.log.textContent, /Navigation blocked/);
});

test('older PS5 chooser controls retain their guard and the native output retains its original scripts', () => {
  const chooser = 'hosts/ps5/exploit/karo-ps5-umtx-remaining/index.html';
  const old = read(chooser);
  const themed = compact.apply(style.themeHTML(old, chooser), chooser);
  assert.match(themed, /class="ps5-deck"/);
  for (const id of ['host-local-confirm', 'host-local-status', 'host-local-load', 'host-local-restarted', 'host-local-clear', 'host-local-data']) {
    assert.equal([...themed.matchAll(new RegExp('id="' + id + '"', 'g'))].length, 1, id);
  }
  const data = value => value.match(/<script id="host-local-data"[^>]*>([\s\S]*?)<\/script>/)[1];
  assert.equal(data(themed), data(old));

  const run = build.runEntry.slice(1);
  const runOriginal = read(run);
  const runRedesign = ui.apply(runOriginal, run);
  assert.match(runRedesign, /id="console" role="log"/);
  assert.match(runRedesign, /<h2 id="ps5-native-log-title">Live loader log<\/h2>/);
  const scripts = value => [...value.matchAll(/<script[^>]*>[\s\S]*?<\/script>/g)].map(match => match[0]);
  assert.deepEqual(scripts(runRedesign), scripts(runOriginal));
  assert.equal(ui.apply(runRedesign, run), runRedesign);
});
