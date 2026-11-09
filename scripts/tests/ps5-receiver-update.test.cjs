'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
const receiver = require('../../assets/console-receiver.js');

const version = '2026.11.02.25';
const content = (platform, version) => Buffer.from('<!doctype html><script id="receiver-catalog" type="application/json">' +
  JSON.stringify({platform, ...(version ? {version} : {}), items: []}) + '</script>');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

function fixture(platform, options = {}) {
  const folder = platform === 'ps4' ? '/data' : '/data/homebrew/ezremote-client/assets';
  const target = 'whatsite-' + platform + '.html';
  const staged = content(platform, version);
  const previous = options.previous || content(platform);
  const hash = sha(staged);
  const stage = 'whatsite-' + platform + '-update-' + version + '-' + hash.slice(0, 12) + '.html';
  const backup = 'whatsite-' + platform + '-backup-' + sha(previous) + '.html';
  const files = new Map([[target, previous], [stage, options.staged || staged]]);
  if (options.interrupted) {
    files.delete(stage);
    files.set(stage + '.tmp', staged.subarray(0, 10));
  }
  if (options.backup) files.set(backup, options.backup);
  const requests = [];
  const location = {
    protocol: 'http:', hostname: '127.0.0.1', port: platform === 'ps4' ? '8080' : '9090', pathname: folder + '/' + stage,
    search: '?apply-update=1&sha256=' + hash + '&bytes=' + staged.length,
    ...options.location
  };
  class FormData {
    constructor() { this.parts = []; }
    append(name, value, filename) { this.parts.push({name, value, filename}); }
  }
  class Blob {
    constructor(parts, options) {
      this.bytes = Buffer.concat(parts.map(part => Buffer.from(part)));
      this.type = options.type;
    }
  }
  const browser = options.noMultipart ? {} : {FormData, Blob};
  function XHR() {
    this.open = (method, path) => { this.method = method; this.path = path; };
    this.setRequestHeader = (name, value) => { this.requestHeader = {name, value}; };
    this.send = raw => {
      const body = raw instanceof FormData ? raw : raw && JSON.parse(raw);
      requests.push({method: this.method, path: this.path, body});
      const leaf = this.path.split('?')[0].split('/').pop();
      this.status = 200;
      if (this.path === '/__local__/list') {
        assert.deepEqual(body, {path: folder, onlyFolders: false});
        this.responseText = JSON.stringify({result: [...files].map(([name, bytes]) => ({name, size: bytes.length, type: 'file'}))});
      } else if (this.path === '/__local__/upload') {
        assert.equal(this.method, 'POST');
        assert.equal(this.requestHeader, undefined);
        assert.deepEqual(body.parts.map(part => part.name), ['destination', '_chunkNumber', '_chunkSize', '_totalSize', '_currentChunkSize', 'file']);
        assert.deepEqual(body.parts.slice(0, 5).map(part => part.value), [folder, '0', ...Array(3).fill(String(previous.length))]);
        const file = body.parts[5];
        assert.equal(file.filename, backup);
        assert.equal(file.value.type, 'application/octet-stream');
        assert.deepEqual(file.value.bytes, previous);
        files.set(backup, options.badUpload ? Buffer.alloc(previous.length) : file.value.bytes);
        this.responseText = '{"result":{"success":true}}';
      } else if (this.path === '/__local__/rename') {
        assert.deepEqual(body, {item: folder + '/' + stage, newItemPath: folder + '/' + target});
        if (!options.badRename) {
          files.set(target, files.get(stage));
          files.delete(stage);
        }
        this.responseText = '{"result":{"success":true}}';
      } else {
        assert.equal(this.method, 'GET');
        assert.match(this.path, /\?wwb-read=/);
        const bytes = files.get(leaf);
        if (!bytes) this.status = 404;
        else this.response = Uint8Array.from(bytes).buffer;
      }
      this.readyState = 4;
      this.onreadystatechange();
    };
  }
  const client = receiver.createManagerClient(platform, location, () => new XHR(), browser);
  const mutations = () => requests.filter(x => x.path === '/__local__/upload' || x.path === '/__local__/rename');
  function apply() {
    let outcome;
    client.applyReceiverUpdate(version, hash, staged.length, (error, result) => { outcome = {error, result}; });
    assert.ok(outcome);
    return outcome;
  }
  return {apply, backup, browser, files, folder, hash, location, mutations, previous, requests, stage, staged, target, XHR};
}

function openStagedPage(platform, f) {
  function element(tagName) {
    return {tagName, children: [], appendChild(child) { this.children.push(child); }, setAttribute() {}};
  }
  const elements = {
    'receiver-preparation': element('section'),
    'receiver-download-ui': element('div'),
    'receiver-catalog': {textContent: JSON.stringify({platform, version, items: []})}
  };
  const document = {readyState: 'complete', createElement: element, getElementById(id) { return elements[id]; }};
  const browser = {location: f.location, XMLHttpRequest: f.XHR, ...f.browser};
  browser.top = browser;
  receiver.install(document, browser);
  assert.equal(f.requests.length, 0);
  assert.equal(elements['receiver-download-ui'].hidden, true);
  return elements['receiver-preparation'].children;
}

function openProgress(platform, f, options = {}) {
  const receiverPath = (platform === 'ps4' ? '/data/' : '/') + f.target;
  const nodes = new Map();
  const timers = [], requests = [], events = {};
  let states = [];
  function element(tag) {
    return {tag, children: [], appendChild(child) { this.children.push(child); }, setAttribute() {}, removeAttribute() {}};
  }
  const document = {readyState: 'complete', createElement: element, getElementById(id) {
    if (!nodes.has(id)) nodes.set(id, element(id));
    return nodes.get(id);
  }};
  document.getElementById('receiver-catalog').textContent = JSON.stringify({platform, version: '2026.11.02.24', items: []});
  const location = {protocol: 'http:', hostname: '127.0.0.1', port: '6701', pathname: receiverPath,
    search: '?update-progress=1&version=' + version + '&sha256=' + f.hash + '&bytes=' + f.staged.length, ...options.location};
  const browser = {location, setTimeout(fn) { timers.push(fn); }, clearTimeout() {}, addEventListener(name, fn) { events[name] = fn; }, XMLHttpRequest: function () {
    this.open = (method, url) => {
      assert.equal(method, 'GET');
      requests.push(url);
      this.url = url;
    };
    this.send = () => {
      this.status = 200;
      if (this.url.startsWith('/get_download_state?wwb-read=')) this.responseText = JSON.stringify(states);
      else {
        assert.match(this.url, new RegExp('^' + (platform === 'ps4' ? '/data/' : '/') + f.stage.replaceAll('.', '\\.') + '\\?wwb-read='));
        const bytes = f.files.get(f.stage);
        if (!bytes) this.status = 404;
        else this.response = Uint8Array.from(bytes).buffer;
      }
      this.readyState = 4;
      this.onreadystatechange();
    };
  }};
  browser.top = options.framed ? {} : browser;
  const state = (state, bytes_transfered) => ({state, bytes_transfered, path: f.folder + '/' + f.stage, file_size: f.staged.length});
  states = options.initialStates || [state(0, 0)];
  receiver.install(document, browser);
  return {nodes, requests, state, events, advance(next) { states = next; timers.shift()(); }};
}

for (const platform of ['ps4', 'ps5']) {
  test(platform + ' tracks only the selected update and exposes Apply after verifying it', () => {
    const f = fixture(platform);
    const page = openProgress(platform, f);
    const [status, , meter, apply] = page.nodes.get('receiver-preparation').children;
    assert.equal(apply.hidden, true);
    page.advance([page.state(4, f.staged.length), page.state(1, Math.floor(f.staged.length / 2))]);
    assert.match(status.textContent, /Downloading · (49|50)% received/);
    assert.equal(apply.hidden, true);
    page.advance([page.state(1, f.staged.length)]);
    assert.equal(meter.value, 100);
    assert.equal(apply.hidden, true);
    assert.ok(page.requests.every(url => url.startsWith('/get_download_state?wwb-read=')));
    page.advance([page.state(4, f.staged.length)]);
    assert.equal(apply.hidden, false);
    assert.match(status.textContent, /downloaded and verified/);
    const managerURL = new URL(apply.href);
    assert.equal(managerURL.pathname, f.folder + '/' + f.target);
    assert.equal(managerURL.searchParams.get('version'), version);
    assert.equal(managerURL.searchParams.get('sha256'), f.hash);
    const manager = fixture(platform, {location: {pathname: managerURL.pathname, search: managerURL.search}});
    const children = openStagedPage(platform, manager);
    assert.equal(manager.requests.length, 0);
    children.find(node => node.tagName === 'button').onclick();
    assert.deepEqual(manager.mutations().map(x => x.path), ['/__local__/upload', '/__local__/rename']);
  });

  test(platform + ' progress with missing or corrupt staging cannot offer Apply', () => {
    const f = fixture(platform, {interrupted: true});
    const page = openProgress(platform, f);
    const [status, , , apply] = page.nodes.get('receiver-preparation').children;
    page.advance([page.state(4, f.staged.length)]);
    assert.match(status.textContent, /missing/);
    assert.equal(apply.hidden, true);
    f.files.set(f.stage, Buffer.alloc(f.staged.length));
    page.advance([page.state(4, f.staged.length)]);
    assert.match(status.textContent, /could not be verified/);
    assert.equal(apply.hidden, true);
    assert.deepEqual(openProgress(platform, f, {framed: true}).requests, []);
    assert.deepEqual(openProgress(platform, f, {location: {hostname: '192.168.1.10'}}).requests, []);
  });
  test(platform + ' replaces the installed page only after verifying the staged file and backup', () => {
    const f = fixture(platform);
    assert.equal(f.requests.length, 0);
    assert.deepEqual(f.apply(), {error: null, result: {alreadyCurrent: false, backup: f.backup}});
    assert.deepEqual(f.mutations().map(x => x.path), ['/__local__/upload', '/__local__/rename']);
    assert.deepEqual(f.files.get(f.backup), f.previous);
    assert.deepEqual(f.files.get(f.target), f.staged);
    assert.equal(f.files.has(f.stage), false);
    assert.equal(f.apply().result.alreadyCurrent, true);
    assert.equal(f.mutations().length, 2);
  });

  test(platform + ' preserves the current page on wrong origins, corrupt staging or backup, and downgrade', () => {
    const local = fixture(platform);
    const other = fixture(platform === 'ps4' ? 'ps5' : 'ps4');
    for (const [options, message, writes] of [
      [{location: {port: other.location.port}}, /port (8080|9090)/, []],
      [{location: {pathname: other.location.pathname}}, /filename/, []],
      [{location: {pathname: local.folder + '/' + local.target}}, /filename/, []],
      [{interrupted: true}, /incomplete or missing/, []],
      [{staged: Buffer.alloc(local.staged.length)}, /SHA-256 mismatch/, []],
      [{badUpload: true}, /SHA-256 mismatch/, ['/__local__/upload']],
      [{noMultipart: true}, /could not prepare the receiver backup/, []],
      [{backup: Buffer.alloc(local.previous.length)}, /SHA-256 mismatch/, []],
      [{previous: content(platform, '2026.11.02.26')}, /newer receiver/, []]
    ]) {
      const f = fixture(platform, options);
      assert.match(f.apply().error.message, message);
      assert.deepEqual(f.mutations().map(x => x.path), writes);
      assert.deepEqual(f.files.get(f.target), f.previous);
      if (options.location) assert.equal(f.requests.length, 0);
    }
  });

  test(platform + ' requires byte readback after native rename acknowledgement', () => {
    const f = fixture(platform, {badRename: true});
    const outcome = f.apply();
    assert.match(outcome.error.message, /Could not confirm the update/);
    assert.equal(outcome.result.backup, f.backup);
    assert.deepEqual(f.files.get(f.backup), f.previous);
    assert.deepEqual(f.files.get(f.target), f.previous);
    assert.deepEqual(f.files.get(f.stage), f.staged);
  });

  test(platform + ' staged browser page is inert until Apply update is selected', () => {
    const f = fixture(platform);
    const children = openStagedPage(platform, f);
    const apply = children.find(node => node.tagName === 'button');
    assert.equal(apply.textContent, 'Apply update');
    apply.onclick();
    apply.onclick();
    assert.deepEqual(f.mutations().map(x => x.path), ['/__local__/upload', '/__local__/rename']);
    const prefix = platform === 'ps4' ? '/data/' : '/';
    const open = 'http://127.0.0.1:6701' + prefix + f.target + '?v=' + version;
    assert.ok(children.some(node => node.href === open));
  });

  test(platform + ' provides the installed downloader or verified backup after an update failure', () => {
    const prefix = 'http://127.0.0.1:6701' + (platform === 'ps4' ? '/data/' : '/');
    for (const options of [{badUpload: true}, {badRename: true}]) {
      const f = fixture(platform, options);
      const children = openStagedPage(platform, f);
      children.find(node => node.tagName === 'button').onclick();
      const link = children.find(node => node.tagName === 'a');
      if (options.badRename) {
        assert.equal(link.href, prefix + f.backup);
      } else {
        const url = new URL(link.href);
        assert.equal(url.origin + url.pathname, prefix + f.target);
        assert.match(url.searchParams.get('reopen'), /^\d+$/);
      }
    }
  });
}
