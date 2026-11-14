'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const controller = require('../../assets/host-url-downloader.js');
const shared = require('../../assets/console-url-downloads.js');
const transport = require('../../assets/console-downloads.js');

function open(platform = 'ps4', userAgent = '') {
  const ids = {};
  for (const name of ['downloader','form','input','filename','status','review','browser','console','connection-help','continue','clear','name','source','update-help']) {
    ids['host-url-' + name] = {
      value:'', hidden:false, attrs:{}, events:{}, textContent:'',
      addEventListener(event, listener) { this.events[event] = listener; },
      setAttribute(name, value) { this.attrs[name] = value; },
      getAttribute(name) { return this.attrs[name]; },
      removeAttribute(name) { delete this.attrs[name]; if (name === 'href') delete this.href; },
      focus() { this.focused = true; }
    };
  }
  ids['host-url-downloader'].attrs['data-platform'] = platform;
  ids['host-url-filename'].parentNode = {open:false};
  const api = controller.install({getElementById:id => ids[id]}, {
    navigator:{userAgent}, ConsoleURLDownloads:shared, WWBConsoleDownloads:transport
  });
  const submit = () => ids['host-url-form'].events.submit({preventDefault(){}});
  const input = (id, value) => { ids[id].value = value; ids[id].events.input(); };
  return {ids, api, submit, input};
}

test('a URL is staged for browser or exact-platform receiver without sending any download request', () => {
  for (const platform of ['ps4','ps5']) {
    const page = open(platform, 'PlayStation ' + platform.slice(2));
    const {ids} = page;
    page.input('host-url-input', 'https://example.org/tool.zip?token=abc%2B123');
    assert.equal(ids['host-url-filename'].value, 'tool.zip');
    page.submit();
    assert.equal(ids['host-url-review'].hidden, false);
    assert.equal(ids['host-url-browser'].href, 'https://example.org/tool.zip?token=abc%2B123');
    assert.equal(ids['host-url-browser'].attrs.download, 'tool.zip');
    assert.equal(ids['host-url-console'].hidden, true);
    assert.equal(ids['host-url-console'].href, undefined);
    page.api.setHost('127.0.0.1');
    const target = new URL(ids['host-url-console'].href);
    assert.equal(target.origin, 'http://127.0.0.1:6701');
    assert.equal(target.pathname, platform === 'ps4' ? '/data/whatsite-ps4.html' : '/whatsite-ps5.html');
    assert.equal(target.search, '?file=custom-url');
    assert.deepEqual(shared.fromFragment(target.hash), {url:ids['host-url-browser'].href,filename:'tool.zip'});
    assert.match(ids['host-url-status'].textContent, /Link ready/);
    assert.equal(ids['host-url-update-help'].attrs.href, '#host-' + platform + '-update');
  }
});

test('desktop connects only to a validated private console address and can change it after staging', () => {
  const {ids, api, input, submit} = open('ps5');
  input('host-url-input', 'https://example.org/app.pkg'); submit();
  assert.equal(ids['host-url-console'].hidden, true);
  api.setHost('192.168.1.50');
  assert.equal(ids['host-url-console'].hidden, false);
  assert.ok(ids['host-url-console'].href.startsWith('http://192.168.1.50:6701/whatsite-ps5.html?file=custom-url#'));
  api.setHost('8.8.8.8');
  assert.equal(ids['host-url-console'].hidden, true);
  assert.equal(ids['host-url-console'].href, undefined);
  assert.equal(ids['host-url-browser'].href, 'https://example.org/app.pkg');
});

test('editing or clearing a staged link revokes old actions and preserves a manually chosen filename', () => {
  const {ids, input, submit} = open('ps4', 'PlayStation 4');
  input('host-url-input', 'https://example.org/one.zip'); submit();
  input('host-url-input', 'https://example.org/two.zip');
  assert.equal(ids['host-url-review'].hidden, true);
  assert.equal(ids['host-url-browser'].href, undefined);
  assert.equal(ids['host-url-console'].href, undefined);
  assert.equal(ids['host-url-filename'].value, 'two.zip');
  input('host-url-filename', 'my-file.zip');
  input('host-url-input', 'https://example.org/three.zip'); submit();
  assert.equal(ids['host-url-browser'].attrs.download, 'my-file.zip');
  ids['host-url-clear'].events.click();
  assert.equal(ids['host-url-input'].value, '');
  assert.equal(ids['host-url-filename'].value, '');
  assert.equal(ids['host-url-review'].hidden, true);
});

test('invalid input offers no browser or console action', () => {
  const {ids, input, submit} = open('ps4', 'PlayStation 4');
  for (const value of ['javascript:alert(1)', 'file:///data/x', 'https://user:pass@example.org/a.zip']) {
    input('host-url-input', value); submit();
    assert.equal(ids['host-url-review'].hidden, true);
    assert.equal(ids['host-url-browser'].href, undefined);
    assert.equal(ids['host-url-console'].href, undefined);
    assert.ok(ids['host-url-status'].textContent.length);
  }
});

test('a filename error reveals the filename option and focuses the field that needs correction', () => {
  const {ids, input, submit} = open();
  input('host-url-input', 'https://example.org/file.zip');
  input('host-url-filename', '../other.zip'); submit();
  assert.equal(ids['host-url-filename'].parentNode.open, true);
  assert.equal(ids['host-url-filename'].attrs['aria-invalid'], 'true');
  assert.equal(ids['host-url-filename'].focused, true);
  assert.equal(ids['host-url-input'].attrs['aria-invalid'], undefined);
  assert.equal(ids['host-url-review'].hidden, true);
});
