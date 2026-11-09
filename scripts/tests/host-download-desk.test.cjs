'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const transport = require('../../assets/console-downloads.js');
const {resolveTarget} = require('../host-legacy-redirect.cjs');
const {receiverCatalogue, receiverUpdate} = require('../host-project-pages.cjs');
const catalogue = require('../../docs/console-download-catalog.json').items;
const retained = require('../../docs/host-retained-download-aliases.json');

const source = fs.readFileSync(path.resolve(__dirname, '../../assets/host-download-desk.js'), 'utf8');
const ps4 = catalogue.find(item => item.id === 'ps4-homebrew-store');
const ps5 = catalogue.find(item => item.id === 'ps5-whatsite-site-launcher');

function openDesk({platform = 'ps4', mode = 'downloads', userAgent = '', query = '', statuses = [200], items = [ps4, ps5], updateRelease, pagePath, localStorage} = {}) {
  const location = new URL('https://speedy-away.github.io' + (pagePath || '/hosts/' + platform + '/' + mode + '/') + query);
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
  for (const id of ['desk','results','status','search','type','more','retry','address','address-status','connection','clear','native']) {
    ids['host-download-' + id] = element();
  }
  ids.setup = element('details');
  if (updateRelease !== undefined) {
    const prefix = 'host-' + platform + '-update';
    for (const id of ['form','request','submit','open','track','status','data','retry']) ids[prefix + '-' + id] = element();
    ids[prefix] = element('section');
    ids[prefix].hidden = true;
    ids[prefix + '-submit'].disabled = true;
    ids[prefix + '-data'].textContent = JSON.stringify(updateRelease);
  }
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
  const windowEvents = {};
  const window = {location, navigator:{userAgent}, WWBConsoleDownloads:transport, XMLHttpRequest, setTimeout, clearTimeout, localStorage,
    addEventListener(type, callback) { windowEvents[type] = callback; }};
  vm.runInNewContext(source, {window, document});
  function links() {
    function find(node) { return (node.tag === 'a' ? [node] : []).concat(node.children.flatMap(find)); }
    return new Map(find(ids['host-download-results']).map(link => [link.textContent, link.href]));
  }
  return {ids, requests, links, windowEvents};
}

function testUpdateRelease(platform, version = '2026.11.02.26') {
  return {version, bytes:584080, sha256:'a'.repeat(64),
    url:`https://speedy-away.github.io/downloads/helpers/console-download-receivers/${platform}/${version}-aaaaaaaaaaaa/whatsite-${platform}.html`};
}

test('a pinned package opens the exact same-console queue and keeps a separate direct link', () => {
  const {ids, requests, links} = openDesk({
    mode:'packages', userAgent:'Mozilla/5.0 (PlayStation 4 14.00)', query:'?file=' + ps4.id + '#setup'
  });
  assert.deepEqual(requests, [['GET', '/docs/console-download-catalog.json']]);
  assert.equal(ids.setup.open, true);
  assert.match(ids['host-download-status'].textContent, /1 of 1/);
  assert.equal(links().get('Save / install on PS4'), 'http://127.0.0.1:6701/data/whatsite-ps4.html?file=' + ps4.id);
  assert.equal(links().get('Download file'), ps4.url);
  assert.equal(links().has('Save / install on PS5'), false);
});

for (const [platform, folder, port, queuePath, type] of [
  ['ps4', '/data/', '8080', '/data/whatsite-ps4.html', 7],
  ['ps5', '/data/homebrew/ezremote-client/assets/', '9090', '/whatsite-ps5.html', 6]
]) test(`${platform.toUpperCase()} downloader update serializes one explicit loopback request to the matching staging path`, () => {
  const prefix = 'host-' + platform + '-update';
  const html = fs.readFileSync(path.resolve(__dirname, '../../hosts/' + platform + '/downloads/index.html'), 'utf8');
  const formHTML = html.match(new RegExp(`<form\\b[^>]*id="${prefix}-form"[^>]*>[\\s\\S]*?<\\/form>`))[0];
  assert.match(formHTML, /action="http:\/\/127\.0\.0\.1:6701\/download_url"/);
  assert.match(formHTML, /method="post" enctype="text\/plain" target="_self"/);
  assert.equal((formHTML.match(/<(?:input|button)\b/g) || []).length, 2);
  assert.doesNotMatch(formHTML, /\bname=/);
  assert.ok(html.includes(`id="${prefix}-track">View update progress</a>`));
  const release = testUpdateRelease(platform);
  const userAgent = platform === 'ps4' ? 'PlayStation 4/14.00' : 'PlayStation 5/7.61';
  const {ids, requests} = openDesk({platform, userAgent, updateRelease:release});
  const field = ids[prefix + '-request'];
  assert.equal(ids[prefix].hidden, false);
  assert.equal(ids[prefix + '-retry'].hidden, true);
  assert.equal(field.name, undefined);
  assert.deepEqual(requests, [['GET', '/docs/console-download-catalog.json']]);
  const stage = `${folder}whatsite-${platform}-update-2026.11.02.26-aaaaaaaaaaaa.html`;
  ids['host-download-address'].value = '192.168.1.40';
  ids['host-download-connection'].events.submit({preventDefault(){}});
  assert.equal(ids[prefix + '-track'].href, `http://127.0.0.1:6701${queuePath}?update-progress=1&version=${release.version}&sha256=${release.sha256}&bytes=${release.bytes}`);
  const applyURL = 'http://127.0.0.1:' + port + stage + '?apply-update=1&sha256=' + release.sha256 + '&bytes=' + release.bytes;
  const applyLink = ids[prefix + '-open'];
  assert.equal(applyLink.href, applyURL);
  assert.equal(ids[prefix + '-submit'].textContent, 'Download update ' + release.version);
  applyLink.events.click({preventDefault(){ assert.fail('The apply link should navigate normally'); }});
  const firstOpen = applyLink.href;
  assert.ok(firstOpen.startsWith(applyURL + '&wwb-open='));
  applyLink.events.click({preventDefault(){ assert.fail('The apply link should navigate normally'); }});
  assert.ok(applyLink.href.startsWith(applyURL + '&wwb-open='));
  assert.notEqual(applyLink.href, firstOpen);
  const submit = ids[prefix + '-form'].events.submit;
  let prevented = 0;
  submit({preventDefault(){ prevented++; }});
  assert.equal(prevented, 0);
  const {id, ...payload} = JSON.parse(field.name + '=' + field.value + '\r\n');
  assert.ok(Number.isSafeInteger(id) && id > 0);
  assert.deepEqual(payload, {
    type, url:'https://speedy-away.github.io', username:'', password:'', http_server_type:'',
    src_path:new URL(release.url).pathname, dest_path:stage, size:release.bytes, _form:'='
  });
  assert.deepEqual(requests, [['GET', '/docs/console-download-catalog.json']]);
  assert.equal(ids[prefix + '-submit'].disabled, true);
  assert.equal(ids[prefix + '-retry'].hidden, false);
  submit({preventDefault(){ prevented++; }});
  assert.equal(prevented, 1);
  ids[prefix + '-retry'].events.click();
  assert.equal(ids[prefix + '-submit'].disabled, false, 'the current page can recover even without storage');
  assert.equal(ids[prefix + '-submit'].textContent, 'Retry update ' + release.version);
  assert.deepEqual(requests, [['GET', '/docs/console-download-catalog.json']]);
  for (const options of [
    {userAgent:'Desktop', updateRelease:release},
    {userAgent:platform === 'ps4' ? 'PlayStation 5/7.61' : 'PlayStation 4/14.00', updateRelease:release},
    {userAgent, updateRelease:null},
    {userAgent, updateRelease:{...release, url:release.url.replace('speedy-away.github.io','example.net')}},
    {userAgent, updateRelease:{...release, bytes:2 * 1024 * 1024 + 1}},
    {userAgent, updateRelease:{...release, version:'2026.11.02.123456', url:release.url.replace('02.26-','02.123456-')}}
  ]) {
    const desk = openDesk({platform, ...options});
    assert.equal(desk.ids[prefix].hidden, true);
    assert.equal(desk.ids[prefix + '-form'].events.submit, undefined);
  }
});

test('a staging request survives reload and alias navigation, and one manual retry needs another submit', () => {
  const state = new Map();
  const localStorage = {getItem:key => state.get(key), setItem:(key, value) => state.set(key, value)};
  const config = {platform:'ps4', userAgent:'PlayStation 4/14.00', updateRelease:testUpdateRelease('ps4'), localStorage};
  const open = options => openDesk({...config, ...options});
  const prefix = 'host-ps4-update';
  function submit(desk) {
    let prevented = false;
    desk.ids[prefix + '-form'].events.submit({preventDefault(){ prevented = true; }});
    return prevented;
  }
  const first = open();
  const waitingTab = open({pagePath:'/ps4/downloads/'});
  first.ids[prefix + '-open'].events.click();
  assert.equal(state.size, 0, 'opening the staged link is not a queue attempt');
  assert.equal(submit(first), false);
  assert.equal(state.size, 1);
  const [[key, firstId]] = state;
  assert.match(key, /ps4:2026\.11\.02\.26-aaaaaaaaaaaa$/);
  waitingTab.windowEvents.storage({key});
  assert.equal(waitingTab.ids[prefix + '-submit'].disabled, true);
  const reopened = open({pagePath:'/ps4/downloads/'});
  assert.equal(reopened.ids[prefix + '-submit'].disabled, true);
  assert.equal(reopened.ids[prefix + '-retry'].hidden, false);
  assert.match(reopened.ids[prefix + '-status'].textContent, /Update requested.*View update progress/);
  assert.equal(submit(reopened), true);
  assert.equal(reopened.ids[prefix + '-request'].name, undefined);
  reopened.ids[prefix + '-retry'].events.click();
  assert.equal(reopened.ids[prefix + '-submit'].disabled, false);
  assert.equal(reopened.ids[prefix + '-request'].name, undefined);
  assert.equal(state.get(key), firstId, 'enabling retry leaves the stored attempt in place');
  assert.equal(open().ids[prefix + '-submit'].disabled, true);
  assert.equal(submit(reopened), false);
  assert.notEqual(state.get(key), firstId);
  assert.equal(submit(reopened), true, 'a further attempt needs another explicit retry');
  assert.equal(open({updateRelease:testUpdateRelease('ps4','2026.11.02.27')}).ids[prefix + '-submit'].disabled, false);
  const other = open({platform:'ps5', userAgent:'PlayStation 5/7.61', updateRelease:testUpdateRelease('ps5')});
  assert.equal(other.ids['host-ps5-update-submit'].disabled, false);
  assert.deepEqual(reopened.requests, [['GET', '/docs/console-download-catalog.json']]);
});

test('publication exposes only each platform’s activated staged update release', () => {
  const report = require('../../docs/host-menu-companion-build.json');
  for (const platform of ['ps4', 'ps5']) {
    const record = report.records.find(item => item.platform === platform);
    assert.deepEqual(receiverUpdate(platform), report.activated && record?.supportsStagedUpdate === true ? {
      version:record.version, url:'https://speedy-away.github.io/' + record.immutablePath,
      bytes:record.bytes, sha256:record.sha256
    } : null);
  }
});

test('the PS4 archive view shows the exact receiver handoff only as reviewed extraction for a reviewed build', () => {
  const archive = catalogue.find(item => item.platforms.includes('ps4') && item.archiveSafety?.reviewed && /\.(zip|rar|7z)$/i.test(item.filename));
  const {ids, links} = openDesk({userAgent:'PlayStation 4/14.00', query:'?type=archives', items:[ps4, archive]});
  assert.equal(ids['host-download-type'].value, 'archives');
  assert.equal(links().get('Save / extract on PS4'), 'http://127.0.0.1:6701/data/whatsite-ps4.html?file=' + archive.id);
  assert.match(ids['host-download-results'].textContent, /checks the SHA-256/);
  assert.equal(links().has('Save on PS4'), false);
});

test('the PS5 package filter and native tools use the matching same-console origin', () => {
  const {ids, links} = openDesk({platform:'ps5', userAgent:'PlayStation 5/7.61', query:'?type=packages'});
  assert.equal(ids['host-download-type'].value, 'packages');
  assert.equal(links().get('Save / install on PS5'), 'http://127.0.0.1:6701/whatsite-ps5.html?file=' + ps5.id);
  assert.match(ids['host-download-results'].textContent, /When ready, choose Install PKG/);
  assert.equal(ids['host-download-native'].children[0].href, 'http://127.0.0.1:9090/');
  assert.equal(ids['host-download-native'].children[1].href, 'http://127.0.0.1:6701/whatsite-ps5.html');
});

test('a failing catalogue can be retried, and desktop only shows native save after selecting a private address', () => {
  const {ids, links} = openDesk({platform:'ps5', statuses:[503, 200]});
  assert.match(ids['host-download-status'].textContent, /could not load/);
  assert.equal(ids['host-download-retry'].hidden, false);
  ids['host-download-retry'].events.click();
  assert.equal(ids['host-download-retry'].hidden, true);
  assert.equal(links().has('Save / install on PS5'), false);
  assert.equal(ids['host-download-native'].hidden, true);
  assert.match(links().get('Download file'), /\.pkg$/);
  ids['host-download-address'].value = '192.168.1.40';
  ids['host-download-connection'].events.submit({preventDefault(){}});
  assert.equal(links().get('Save / install on PS5'), 'http://192.168.1.40:6701/whatsite-ps5.html?file=' + ps5.id);
  assert.equal(ids['host-download-native'].hidden, false);
  assert.deepEqual(ids['host-download-native'].children.map(item => item.href), [
    'http://192.168.1.40:9090/',
    'http://192.168.1.40:6701/whatsite-ps5.html',
    'http://192.168.1.40:9090/data/homebrew/ezremote-client/assets/whatsite-ps5.html?prepare=1'
  ]);
  ids['host-download-address'].value = '8.8.8.8';
  ids['host-download-connection'].events.submit({preventDefault(){}});
  assert.equal(ids['host-download-address'].attrs['aria-invalid'], 'true');
  assert.match(links().get('Save / install on PS5'), /192\.168\.1\.40/);
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
  assert.equal(links().get('Download file'), original);
  assert.match(ids['host-download-results'].textContent, /Use the direct URL in ezRemote Client/);
});

test('the three repaired PS5 cheat files keep their public IDs and use new exact receiver handoffs', () => {
  const repairedIds = [
    'ps5-native-shn-ppsa05366-01-005-000',
    'ps5-native-shn-ppsa02745-01-000-004',
    'ps5-native-shn-ppsa10261-01-000-000'
  ];
  const receiverItems = receiverCatalogue(catalogue);
  assert.deepEqual(receiverItems.filter(item => item.receiverFileId).map(item => item.id).sort(), repairedIds.slice().sort());
  for (const id of repairedIds) {
    const original = catalogue.find(item => item.id === id);
    const item = receiverItems.find(item => item.id === id);
    const handoff = 'shn-' + original.sha256.slice(0, 12);
    assert.equal(item.receiverFileId, handoff);
    assert.notEqual(item.receiverSupported, false);
    assert.equal(item.url, retained.aliases[original.url]);
    assert.deepEqual([item.filename, item.version, item.bytes, item.sha256], [original.filename, original.version, original.bytes, original.sha256]);
    const {ids, links} = openDesk({
      platform:'ps5', userAgent:'PlayStation 5/7.61', query:'?file=' + id,
      items:[{...item, receiverSupported:false}, ps5]
    });
    assert.match(ids['host-download-status'].textContent, /1 of 1/);
    assert.equal(links().get('Save on PS5'), 'http://127.0.0.1:6701/whatsite-ps5.html?file=' + handoff);
    assert.equal(links().get('Download file'), retained.aliases[original.url]);
  }
});
