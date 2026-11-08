'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
const receiver = require('../../assets/console-receiver.js');

const folder = '/data/homebrew/ezremote-client/assets';
const target = 'whatsite-ps5.html';
const version = '2026.11.02.25';
const content = version => Buffer.from('<!doctype html><script id="receiver-catalog" type="application/json">' +
  JSON.stringify({platform: 'ps5', ...(version ? {version} : {}), items: []}) + '</script>');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

function fixture(options = {}) {
  const staged = content(version);
  const previous = options.previous || content();
  const hash = sha(staged);
  const stage = 'whatsite-ps5-update-' + version + '-' + hash.slice(0, 12) + '.html';
  const backup = 'whatsite-ps5-backup-' + sha(previous) + '.html';
  const files = new Map([[target, previous], [stage, options.staged || staged]]);
  if (options.interrupted) {
    files.delete(stage);
    files.set(stage + '.tmp', staged.subarray(0, 10));
  }
  if (options.backup) files.set(backup, options.backup);
  const requests = [];
  const location = {
    protocol: 'http:', hostname: '127.0.0.1', port: '9090', pathname: folder + '/' + stage,
    search: '?apply-update=1&sha256=' + hash + '&bytes=' + staged.length,
    ...options.location
  };
  function XHR() {
    this.open = (method, path) => { this.method = method; this.path = path; };
    this.setRequestHeader = () => {};
    this.send = raw => {
      const body = raw && JSON.parse(raw);
      requests.push({method: this.method, path: this.path, body});
      const leaf = this.path.split('?')[0].split('/').pop();
      this.status = 200;
      if (this.path === '/__local__/list') {
        assert.deepEqual(body, {path: folder, onlyFolders: false});
        this.responseText = JSON.stringify({result: [...files].map(([name, bytes]) => ({name, size: bytes.length, type: 'file'}))});
      } else if (this.path === '/__local__/copy') {
        assert.deepEqual(body, {items: [folder + '/' + target], newPath: folder + '/' + backup});
        files.set(backup, options.badCopy ? Buffer.alloc(previous.length) : files.get(target));
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
  const client = receiver.createManagerClient('ps5', location, () => new XHR());
  const mutations = () => requests.filter(x => x.path === '/__local__/copy' || x.path === '/__local__/rename');
  function apply() {
    let outcome;
    client.applyReceiverUpdate(version, hash, staged.length, (error, result) => { outcome = {error, result}; });
    assert.ok(outcome);
    return outcome;
  }
  return {apply, backup, files, hash, location, mutations, previous, requests, stage, staged, XHR};
}

test('the installed page changes only after the staged bytes and old backup are verified', () => {
  const f = fixture();
  assert.equal(f.requests.length, 0);
  assert.deepEqual(f.apply(), {error: null, result: {alreadyCurrent: false, backup: f.backup}});
  assert.deepEqual(f.mutations().map(x => x.path), ['/__local__/copy', '/__local__/rename']);
  assert.deepEqual(f.files.get(f.backup), f.previous);
  assert.deepEqual(f.files.get(target), f.staged);
  assert.equal(f.files.has(f.stage), false);
  assert.equal(f.apply().result.alreadyCurrent, true);
  assert.equal(f.mutations().length, 2);
});

test('wrong origins and staged paths, changed content, backup failure and newer installs cannot replace the current page', () => {
  for (const [options, message, writes] of [
    [{location: {port: '6701'}}, /port 9090/, []],
    [{location: {pathname: folder + '/' + target}}, /filename/, []],
    [{interrupted: true}, /incomplete or missing/, []],
    [{staged: Buffer.alloc(content(version).length)}, /SHA-256 mismatch/, []],
    [{badCopy: true}, /SHA-256 mismatch/, ['/__local__/copy']],
    [{backup: Buffer.alloc(content().length)}, /SHA-256 mismatch/, []],
    [{previous: content('2026.11.02.26')}, /newer receiver/, []]
  ]) {
    const f = fixture(options);
    assert.match(f.apply().error.message, message);
    assert.deepEqual(f.mutations().map(x => x.path), writes);
    assert.deepEqual(f.files.get(target), f.previous);
    if (options.location) assert.equal(f.requests.length, 0);
  }
});

test('native rename acknowledgement alone cannot report a successful update', () => {
  const f = fixture({badRename: true});
  const outcome = f.apply();
  assert.match(outcome.error.message, /Could not confirm the update/);
  assert.equal(outcome.result.backup, f.backup);
  assert.deepEqual(f.files.get(f.backup), f.previous);
  assert.deepEqual(f.files.get(target), f.previous);
  assert.deepEqual(f.files.get(f.stage), f.staged);
});

test('opening the staged browser page is inert until Apply update is selected', () => {
  const f = fixture();
  function element(tagName) {
    return {tagName, children: [], appendChild(child) { this.children.push(child); }, setAttribute() {}};
  }
  const elements = {
    'receiver-preparation': element('section'),
    'receiver-download-ui': element('div'),
    'receiver-catalog': {textContent: JSON.stringify({platform: 'ps5', version, items: []})}
  };
  const document = {readyState: 'complete', createElement: element, getElementById(id) { return elements[id]; }};
  receiver.install(document, {location: f.location, XMLHttpRequest: f.XHR});
  assert.equal(f.requests.length, 0);
  assert.equal(elements['receiver-download-ui'].hidden, true);
  const apply = elements['receiver-preparation'].children.find(node => node.tagName === 'button');
  assert.equal(apply.textContent, 'Apply update');
  apply.onclick();
  apply.onclick();
  assert.deepEqual(f.mutations().map(x => x.path), ['/__local__/copy', '/__local__/rename']);
  assert.ok(elements['receiver-preparation'].children.some(node => node.href === 'http://127.0.0.1:6701/whatsite-ps5.html?v=' + version));
});
