'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const transport = require('../../assets/console-downloads.js');
const {resolveTarget} = require('../host-legacy-redirect.cjs');
const catalogue = require('../../docs/console-download-catalog.json').items;
const retained = require('../../docs/host-retained-download-aliases.json');

const source = fs.readFileSync(path.resolve(__dirname, '../../assets/host-download-desk.js'), 'utf8');
const ps4 = catalogue.find(item => item.id === 'ps4-homebrew-store');
const ps5 = catalogue.find(item => item.id === 'ps5-whatsite-site-launcher');

function openDesk({platform = 'ps4', mode = 'downloads', userAgent = '', query = '', statuses = [200], items = [ps4, ps5]} = {}) {
  const location = new URL('https://speedy-away.github.io/hosts/' + platform + '/' + mode + '/' + query);
  function element(tag = 'div') {
    return {
      tag, children: [], attrs: {}, events: {}, value: '', hidden: false,
      get textContent() { return this.children.length ? this.children.map(child => child.textContent).join(' ') : this.message || ''; },
      set textContent(value) { this.message = value; this.children = []; },
      get href() { return this.url?.href; }, set href(value) { this.url = new URL(value, location); },
      get protocol() { return this.url?.protocol; }, get host() { return this.url?.host; },
      appendChild(child) { this.children.push(child); },
      setAttribute(key, value) { this.attrs[key] = value; },
      getAttribute(key) { return this.attrs[key]; },
      removeAttribute(key) { delete this.attrs[key]; },
      addEventListener(type, callback) { this.events[type] = callback; },
      focus() { this.focused = true; }
    };
  }
  const ids = {};
  for (const id of ['desk','results','status','search','type','more','retry','address','address-status','connection','clear']) {
    ids['host-download-' + id] = element();
  }
  ids.setup = element('details');
  ids['host-download-type'].value = 'all';
  ids['host-download-desk'].attrs = {'data-platform':platform,'data-library':mode,'data-catalogue':'/docs/console-download-catalog.json'};
  const requests = [];
  function XMLHttpRequest() {
    this.open = (method, url) => requests.push([method, url]);
    this.send = () => {
      this.status = statuses.shift();
      this.responseText = JSON.stringify({items});
      this.onload();
    };
  }
  const document = {getElementById(id) { return ids[id]; }, createElement:element};
  const window = {location, navigator:{userAgent}, WWBConsoleDownloads:transport, XMLHttpRequest, setTimeout, clearTimeout};
  vm.runInNewContext(source, {window, document});
  function links() {
    function find(node) { return (node.tag === 'a' ? [node] : []).concat(node.children.flatMap(find)); }
    return new Map(find(ids['host-download-results']).map(link => [link.textContent, link.href]));
  }
  return {ids, requests, links};
}

test('a pinned package opens the exact same-console queue and keeps a separate direct link', () => {
  const {ids, requests, links} = openDesk({
    mode:'packages', userAgent:'Mozilla/5.0 (PlayStation 4 14.00)', query:'?file=' + ps4.id + '#setup'
  });
  assert.deepEqual(requests, [['GET', '/docs/console-download-catalog.json']]);
  assert.equal(ids.setup.open, true);
  assert.match(ids['host-download-status'].textContent, /1 of 1/);
  assert.equal(links().get('Save on PS4'), 'http://127.0.0.1:6701/data/whatsite-ps4.html?file=' + ps4.id);
  assert.equal(links().get('Direct file'), ps4.url);
  assert.equal(links().has('Save on PS5'), false);
});

test('a failing catalogue can be retried, and desktop only shows native save after selecting a private address', () => {
  const {ids, links} = openDesk({platform:'ps5', statuses:[503, 200]});
  assert.match(ids['host-download-status'].textContent, /could not load/);
  assert.equal(ids['host-download-retry'].hidden, false);
  ids['host-download-retry'].events.click();
  assert.equal(ids['host-download-retry'].hidden, true);
  assert.equal(links().has('Save on PS5'), false);
  assert.match(links().get('Direct file'), /\.pkg$/);
  ids['host-download-address'].value = '192.168.1.40';
  ids['host-download-connection'].events.submit({preventDefault(){}});
  assert.equal(links().get('Save on PS5'), 'http://192.168.1.40:6701/whatsite-ps5.html?file=' + ps5.id);
  ids['host-download-address'].value = '8.8.8.8';
  ids['host-download-connection'].events.submit({preventDefault(){}});
  assert.equal(ids['host-download-address'].attrs['aria-invalid'], 'true');
  assert.match(links().get('Save on PS5'), /192\.168\.1\.40/);
});

test('retained catalogue links map to exact versions and an incompatible receiver route is withheld', () => {
  const urls = new Set(catalogue.map(item => decodeURIComponent(item.url)));
  for (const [pathname, target] of Object.entries(retained.aliases)) {
    assert.ok(urls.has(pathname), pathname);
    assert.match(new URL(target).pathname, /\/[a-f0-9]{40}\//);
    const encoded = pathname.split('/').map(encodeURIComponent).join('/');
    assert.equal(resolveTarget({pathname:encoded}, retained), target, pathname);
  }
  const row = catalogue.find(item => item.id === 'ps5-native-shn-ppsa05366-01-005-000');
  const original = retained.aliases[row.url];
  const {ids, links} = openDesk({
    platform:'ps5', userAgent:'Mozilla/5.0 (PlayStation 5 7.61)', items:[{...row, url:original, receiverSupported:false}]
  });
  assert.equal(links().has('Save on PS5'), false);
  assert.equal(links().get('Direct file'), original);
  assert.match(ids['host-download-results'].textContent, /Use the direct URL in ezRemote Client/);
});
