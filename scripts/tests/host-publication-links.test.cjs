'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {resolveURL} = require('../check-host-publication.cjs');
test('live HTTP checks resolve project aliases, query strings and immutable external downloads', () => {
  const aliases = {'/hosts/entry.html': '/WWB-HOST/hosts/entry.html', '/downloads/build.zip': 'https://raw.githubusercontent.com/Speedy-away/WWB-HOST/abcdef/build.zip'};
  assert.equal(resolveURL('/hosts/entry.html', aliases), 'https://speedy-away.github.io/WWB-HOST/hosts/entry.html');
  assert.equal(resolveURL('/hosts/entry.html?build=100', aliases), 'https://speedy-away.github.io/WWB-HOST/hosts/entry.html?build=100');
  assert.equal(resolveURL('/downloads/build.zip', aliases), 'https://raw.githubusercontent.com/Speedy-away/WWB-HOST/abcdef/build.zip');
  assert.equal(resolveURL('/WWB-HOST/hosts/entry.html', aliases), 'https://speedy-away.github.io/WWB-HOST/hosts/entry.html');
  assert.equal(resolveURL('https://upstream.example/menu.bin', aliases), 'https://upstream.example/menu.bin');
});
