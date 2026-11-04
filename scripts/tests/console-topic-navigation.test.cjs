const test = require('node:test');
const assert = require('node:assert/strict');
const navigation = require('../console-topic-navigation.cjs');
const platforms = [{id:'ps2',source:'console/retro/ps2.html',base:'/console/ps2/',hubFile:'console/ps2/index.html',hub:'/console/ps2/'}];
test('topic navigation preserves deep links, filters and deliberate libraries', () => {
  const input='<a href="/console/retro/ps2.html">Explore PS2</a><a href="/console/retro/ps2.html#apps">App</a><a href="/console/retro/ps2.html?category=games">Games</a><a href="/console/retro/ps2.html" data-console-library>All downloads</a>';
  const output=navigation.apply('console/index.html',input,{platforms});
  assert.ok(output.startsWith('<a href="/console/ps2/">'));
  assert.ok(output.includes('href="/console/retro/ps2.html#apps"'));
  assert.ok(output.includes('href="/console/retro/ps2.html?category=games"'));
  assert.ok(output.includes('href="/console/retro/ps2.html" data-console-library'));
});
test('topic navigation resolves relative links without changing external destinations', () => {
  const input='<a href="retro/ps2.html">PS2</a><a href="https://example.com/console/retro/ps2.html">Other site</a>';
  assert.equal(navigation.apply('console/index.html',input,{platforms}),'<a href="/console/ps2/">PS2</a><a href="https://example.com/console/retro/ps2.html">Other site</a>');
});
test('topic navigation protects exact archived companion and download bytes', () => {
  const input='<a href="/console/retro/ps2.html">PS2</a>';
  for(const file of ['console/ps4/whatsite-ps4.html','console/ps5/whatsite-ps5.html','downloads/archive/example.html'])assert.equal(navigation.apply(file,input,{platforms}),input);
});
test('topic sidebar activation follows hub and child topic pages idempotently', () => {
  const input='<a href="/pc/" class="nav-link active" aria-current="page">PC</a><a href="/console/retro/ps2.html" class="nav-link nav-sublink">PS2</a>';
  const output=navigation.apply('console/ps2/apps.html',input,{platforms});
  assert.ok(output.includes('href="/console/ps2/" class="nav-link nav-sublink active" aria-current="page"'));
  assert.equal((output.match(/aria-current="page"/g)||[]).length,1);
  assert.equal(navigation.apply('console/ps2/apps.html',output,{platforms}),output);
});
test('original console entry pages gain a hub shortcut without changing source content', () => {
  const input='<html><head><title>PS2</title></head><body class="console-guide"><section id="apps">Original downloads</section></body></html>';
  const output=navigation.apply('console/retro/ps2.html',input,{platforms});
  assert.match(output, /<body\b[^>]*data-console-topic-entry="\/console\/ps2\/"/);
  assert.match(output, /class="console-guide site-atmosphere"/);
  assert.ok(output.includes('/assets/console-topic-entry.js?v=1'));
  assert.ok(output.includes('<section id="apps">Original downloads</section>'));
  assert.equal(navigation.apply('console/retro/ps2.html',output,{platforms}),output);
  assert.equal(navigation.apply('console/ps2/apps.html',input,{platforms}),input);
  assert.equal(navigation.apply('console/retro/ps2.html','<nav>Fragment</nav>',{platforms}),'<nav>Fragment</nav>');
});
test('Vita shortcut belongs to the original index while its complete library stays accessible', () => {
  const vita=[{id:'psvita',source:'console/psvita/library.html',base:'/console/psvita/',hubFile:'console/psvita/home.html',hub:'/console/psvita/home.html'}];
  assert.equal(navigation.entryFor('console/psvita/index.html',vita),'/console/psvita/home.html');
  assert.equal(navigation.entryFor('console/psvita/library.html',vita),null);
  assert.equal(navigation.entryFor('console/psvita/home.html',vita),null);
});
test('entry shortcut preserves library queries and historic hash links and only accepts registered hubs', () => {
  const {destination}=require('../../assets/console-topic-entry.js');
  const location={href:'https://whatwhatboy.com/console/retro/ps2.html',hash:'',search:''};
  assert.equal(destination(location,'/console/ps2/'),'/console/ps2/');
  assert.equal(destination({...location,search:'?view=all',href:location.href+'?view=all'},'/console/ps2/'),null);
  assert.equal(destination({...location,hash:'#apps',href:location.href+'#apps'},'/console/ps2/'),null);
  for(const entry of ['https://example.com/console/ps2/','//example.com/console/ps2/','/console/unknown/','/console/ps2/?view=all','/downloads/payload.bin'])assert.equal(destination(location,entry),null);
  assert.equal(destination({href:'https://whatwhatboy.com/console/ps2/',hash:'',search:''},'/console/ps2/'),null);
});
