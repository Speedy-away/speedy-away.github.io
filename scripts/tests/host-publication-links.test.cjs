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

test('root publication checks resolve old bookmarks through current aliases without changing pinned repositories',()=>{
 const aliases={'/hosts/entry.html':'/hosts/entry.html','/downloads/build.zip':'https://raw.githubusercontent.com/Speedy-away/speedy-away.github.io/'+'a'.repeat(40)+'/downloads/build.zip'};
 for(const prefix of ['','/WWB-HOST','/wwb-host'])assert.equal(resolveURL(prefix+'/hosts/entry.html?build=1#load',aliases),'https://speedy-away.github.io/hosts/entry.html?build=1#load');
 assert.equal(resolveURL('/downloads/build.zip',aliases),aliases['/downloads/build.zip']);
});
