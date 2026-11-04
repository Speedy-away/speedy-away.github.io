const test = require('node:test');
const assert = require('node:assert/strict');
const {archivedMirrors} = require('../console-archived-mirrors.cjs');
const hash = 'a'.repeat(64);
const file = (name, extra = {}) => ({local: '/downloads/archive/' + name, sha256: hash, ...extra});
const resource = url => [{publication: 'include', downloads: [{id: 'menu', distribution: 'include', url}]}];

test('a release asset maps only to its exact archived file', () => {
  const inventory = [{status: 'downloaded', url: 'https://example.com/releases/v1', files: [
    file('100.sprx', {resolvedUrl: 'https://example.com/100.sprx'}),
    file('132.sprx', {resolvedUrl: 'https://example.com/132.sprx'})
  ]}];
  const mirrors = archivedMirrors(resource('https://example.com/132.sprx'), inventory);
  assert.equal(mirrors.length, 1);
  assert.equal(mirrors[0].local, '/downloads/archive/132.sprx');
  assert.equal(mirrors[0].downloadId, 'menu');
  assert.deepEqual(archivedMirrors(resource('https://example.com/releases/v1'), inventory), []);
});

test('an unambiguous old MediaFire archive accepts a renamed source URL', () => {
  const inventory = [{status: 'downloaded', url: 'https://www.mediafire.com/file/abc/old.rar/file', files: [file('menu.rar')]}];
  assert.equal(archivedMirrors(resource('https://www.mediafire.com/file/abc/new.rar/file'), inventory)[0].local, '/downloads/archive/menu.rar');
});

test('private files, failed downloads and ambiguous revisions never become public mirror aliases', () => {
  const url = 'https://example.com/menu.zip';
  for (const publication of ['private-review', 'review', 'excluded']) {
    assert.deepEqual(archivedMirrors(resource(url), [{status: 'downloaded', publication, url, files: [file('menu.zip')]}]), []);
  }
  assert.deepEqual(archivedMirrors(resource(url), [{status: 'unavailable', url, files: [file('menu.zip')]}]), []);
  assert.deepEqual(archivedMirrors(resource(url), [
    {status: 'downloaded', url, files: [file('old.zip')]},
    {status: 'downloaded', url, files: [file('new.zip', {sha256: 'b'.repeat(64)})]}
  ]), []);
});
