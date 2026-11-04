'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {rewriter, rawURL, eligible} = require('../build-pages.cjs');
const {renderCompanion} = require('../console-download-companion.cjs');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
test('Pages references resolve to exact encoded repository files without modifying compatibility or hashes', () => {
  const name = 'downloads/ps4/Old Menu (1.0).zip', revision = 'a'.repeat(40), target = rawURL(name, revision);
  const rewrite = rewriter(new Map([[name, target]]));
  const html = '<a href="/downloads/ps4/Old%20Menu%20(1.0).zip">1.0</a><a href="../Old%20Menu%20(1.0).zip">old</a>';
  const result = rewrite(html, 'downloads/ps4/child/index.html');
  assert.equal((result.match(/raw\.githubusercontent\.com/g)||[]).length, 2);
  assert.ok(result.includes(target));
  assert.equal(rewrite('{"url":"https://whatwhatboy.com/downloads/ps4/Old%20Menu%20(1.0).zip","sha256":"original","firmwares":["9.00"]}', 'docs/catalog.json'), '{"url":"'+target+'","sha256":"original","firmwares":["9.00"]}');
  assert.equal(rewrite('/downloads/ps4/Old%20Menu%20(1.0).zip.extra', 'index.html'), '/downloads/ps4/Old%20Menu%20(1.0).zip.extra');
  const entity = rewriter(new Map([['downloads/ps3/A & B.zip', rawURL('downloads/ps3/A & B.zip')]]));
  assert.equal(entity('<a href="/downloads/ps3/A%20&amp;%20B.zip" download>Download</a>', 'downloads/index.html'), '<a href="'+rawURL('downloads/ps3/A & B.zip')+'" download>Download</a>');
  const image = rewriter(new Map([['assets/images/test.png',rawURL('assets/images/test.png')]]));
  assert.equal(image('<img src="../../assets/images/test.png">','games/example/index.html'),'<img src="'+rawURL('assets/images/test.png')+'">');
  assert.equal(image('https://example.com/assets/images/test.png','index.html'),'https://example.com/assets/images/test.png');
});
test('Pages excludes repository internals and QA captures but retains runtime and immutable download helpers', () => {
  for (const name of ['.git/config','.agents/skills/a','scripts/test.cjs','docs/qa/a.txt','docs/screenshots/a.png']) assert.equal(eligible(name), false, name);
  for (const name of ['hosts/runtime/ps4/index.html','docs/host-actions-ps4.json','downloads/helpers/old/helper.html','CNAME']) assert.equal(eligible(name), true, name);
});
test('new native receiver snapshots fetch repository bytes directly while preserving source pins and foreign URLs', () => {
  const items = [{id:'one',url:'https://whatwhatboy.com/downloads/ps4/menu.bin',filename:'menu.bin',sha256:'a'.repeat(64),bytes:123,firmwares:['9.00']},{id:'two',url:'https://example.com/build.pkg'}];
  const html = renderCompanion('ps4', items);
  const result = JSON.parse(html.match(/<script id="receiver-catalog" type="application\/json">([\s\S]*?)<\/script>/)[1]).items;
  assert.deepEqual(result[0], {...items[0],url:rawURL('downloads/ps4/menu.bin')});
  assert.deepEqual(result[1], items[1]);
  assert.equal(items[0].url, 'https://whatwhatboy.com/downloads/ps4/menu.bin');
});
test('runtime data transport maps only pinned GET/HEAD data files and strips cross-origin credentials', async () => {
  const calls = [], events = {}, local = '/hosts/runtime/karo-test/web/900/payload.bin';
  const remote = rawURL(local.slice(1), 'b'.repeat(40));
  function XHR() {}
  XHR.prototype.open = function (...args) { calls.push(args); };
  XHR.prototype.setRequestHeader = function (...args) { calls.push(args); };
  const win = {URL, Headers, location:{href:'https://whatwhatboy.com/hosts/runtime/karo-test/web/900/index.html',origin:'https://whatwhatboy.com'}, WHATSITE_RUNTIME_FILES:{[local]:remote}, XMLHttpRequest:XHR, fetch:(...args)=>{calls.push(args);return Promise.resolve('bytes');}, document:{addEventListener:(name,fn)=>events[name]=fn}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../../assets/pages-runtime-files.js'),'utf8'),{window:win});
  const request = new XHR();request.open('GET','payload.bin',true);assert.equal(calls[0][1],remote);assert.equal(request.withCredentials,false);
  request.setRequestHeader('Authorization','private');assert.equal(calls.length,1);request.setRequestHeader('Range','bytes=0-99');assert.deepEqual(calls[1],['Range','bytes=0-99']);
  await win.fetch('payload.bin',{mode:'same-origin',credentials:'include',headers:{Authorization:'private',Range:'bytes=0-99'}});
  const [target, options] = calls[2];assert.equal(target,remote);assert.equal(options.mode,'cors');assert.equal(options.credentials,'omit');assert.equal(options.headers.has('Authorization'),false);assert.equal(options.headers.get('Range'),'bytes=0-99');
  for (const [url,method] of [['payload.bin','POST'],['https://example.com/payload.bin','GET'],['original.js','GET'],['/__local__/install','POST']]) {await win.fetch(url,{method});assert.equal(calls.at(-1)[0],url);}
  const link = {tagName:'A',href:'https://whatwhatboy.com'+local};events.click({target:link});assert.equal(link.href,remote);
});
