const test = require('node:test');
const assert = require('node:assert/strict');
const {focusContent} = require('../console-topic-focus.cjs');
const group = {title:'Games & ports', description:'Choose a game and read its requirements.'};

test('Vita topic keeps relevant categories, formats and filter hooks with an accurate static count', () => {
  const source = '<section id="library"><h2 class="section-title">Choose your next install</h2><p class="section-subtitle">Full library</p><div data-vita-library><input id="vita-query"><select id="vita-category"><option value="">All categories</option><option>Games</option><option>Ports</option><option>Emulators</option></select><select id="vita-format"><option>VPK</option><option>ZIP</option></select><button data-vita-reset>Clear</button><p data-vita-count role="status">14 projects</p><p data-vita-empty hidden>No matches</p><article data-vita-item data-category="Games"><a download href="/game.vpk">Download</a></article><article data-vita-item data-category="Ports"></article></div></section>';
  const result = focusContent(source, group, {id:'psvita'});
  assert.match(result, /<h2 class="section-title">Games &amp; ports<\/h2>/);
  assert.match(result, /<option>Games<\/option><option>Ports<\/option>/);
  assert.doesNotMatch(result, /<option>Emulators/);
  assert.match(result, /<select id="vita-format"><option>VPK<\/option><option>ZIP<\/option>/);
  assert.match(result, /data-vita-count role="status">2 projects/);
  assert.match(result, /<button data-vita-reset>/);
  assert.match(result, /<a download href="\/game.vpk">Download<\/a>/);
  assert.equal(focusContent(result, group, {id:'psvita'}), result);
});

test('Wii U categories keep multiword values intact and preserve unrelated model controls', () => {
  const source = '<section id="apps"><h2>All apps</h2><select data-wiiu-category><option value="">All</option><option value="Saves &amp; system">Saves</option><option value="Media &amp; network">Media</option><option value="Emulators">Emulators</option></select><select id="model"><option value="one">Model one</option><option value="two">Model two</option></select><span data-wiiu-count>37 apps</span><article data-wiiu-app data-category="Saves &amp; system"></article></section>';
  const result = focusContent(source, group, {id:'wiiu'});
  assert.match(result, /value="Saves &amp; system"/);
  assert.doesNotMatch(result, /value="Media &amp; network"|value="Emulators"/);
  assert.match(result, /<select id="model"><option value="one">Model one<\/option><option value="two">Model two/);
  assert.match(result, /data-wiiu-count>1 app<\/span>/);
});

test('DS and 3DS category memberships use space-separated values', () => {
  const ds = '<section id="library"><h2>Find a resource</h2><select id="dsCategory"><option value="all">All</option><option value="apps">Apps</option><option value="core">Core</option><option value="games">Games</option></select><p data-ds-count data-total-count="19">19 resources</p><article data-ds-card data-ds-group="core apps"></article></section>';
  const result = focusContent(ds, group, {id:'ds'});
  assert.match(result, /value="apps"/);
  assert.match(result, /value="core"/);
  assert.doesNotMatch(result, /value="games"/);
  assert.match(result, /data-total-count="1" data-visible-count="1">1 resource shown/);
  const threeDs = '<select id="threeDsCategory"><option value="all">All</option><option value="games">Games</option><option value="emulators">Emulators</option><option value="apps">Apps</option></select><p class="three-ds-count" role="status"></p><article data-three-ds-card data-three-ds-category="games emulators"></article>';
  const threeResult = focusContent(threeDs, group, {id:'3ds'});
  assert.match(threeResult, /value="games"/);
  assert.match(threeResult, /value="emulators"/);
  assert.doesNotMatch(threeResult, /value="apps"/);
  assert.match(threeResult, />1 resource shown<\/p>/);
});

test('Wii and PSP prune category buttons without deleting all, reset or model filters', () => {
  const wii = '<button data-wii-filter="all">All</button><button data-wii-filter="games">Games</button><button data-wii-filter="apps">Apps</button><select id="wii-more-model"><option value="all">All models</option><option value="vwii">vWii</option></select><button id="wii-more-reset">Reset</button><p id="wii-more-status">12 resources shown</p><article data-wii-card data-category="games"></article>';
  const result = focusContent(wii, group, {id:'wii'});
  assert.doesNotMatch(result, /data-wii-filter="apps"/);
  assert.match(result, /data-wii-filter="all"/);
  assert.match(result, /value="vwii"/);
  assert.match(result, /id="wii-more-reset"/);
  assert.match(result, />1 resource shown<\/p>/);
  const psp = '<button data-filter="all">All</button><button data-filter="games">Games</button><button data-filter="ports">Ports</button><button data-filter="apps">Apps</button><button id="resetGameSearch">Reset</button><p id="gameSearchStatus" data-result-noun="download">18 downloads shown</p><article class="game-card guide-resource" data-category="games ports"></article>';
  const pspResult = focusContent(psp, group, {id:'psp'});
  assert.doesNotMatch(pspResult, /data-filter="apps"/);
  assert.match(pspResult, /data-filter="ports"/);
  assert.match(pspResult, /id="resetGameSearch"/);
  assert.match(pspResult, />1 download shown<\/p>/);
});

test('non-catalogue setup content remains byte-identical', () => {
  const source = '<section id="setup"><h2>Check firmware before installation</h2><p>Read the model notes.</p></section>';
  assert.equal(focusContent(source, group, {id:'ps2'}), source);
  assert.equal(focusContent(source, group, {id:'steamdeck'}), source);
});
