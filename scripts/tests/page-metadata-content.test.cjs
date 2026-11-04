const test = require('node:test');
const assert = require('node:assert/strict');
const {eligible} = require('../site-public-pages.cjs');
const {mainContent, matchesPrefix, trimDescription, fallbackDescription} = require('../page-metadata-content.cjs');

test('metadata traversal includes public libraries and excludes ready/downloaded HTML', () => {
  for (const page of ['index.html', 'console/psvita/home.html', 'console/retro/wii/game-mods.html', 'source-codes/index.html', 'downloads/index.html', 'api/scooby-key.html']) assert.equal(eligible(page), true, page);
  for (const page of ['.playwright-cli/3ds-more-render.html', 'tmp/preview.html', 'scripts/templates/card.html', 'docs/capture.html', 'downloads/helpers/console-payload-sender/index.html', 'console/ps4/whatsite-ps4.html', 'console/ps5/whatsite-ps5.html']) assert.equal(eligible(page), false, page);
});

test('main subject extraction excludes navigation, script markup and related footer links', () => {
  const html = '<body><aside><h2>Xbox 360 navigation</h2></aside><div id="main-content"><nav><h2>PS5 guide links</h2></nav><header><h1>PS Vita games</h1></header><section><h2>SuperTux</h2><div><p>Native Vita</p></div></section><script>const html="<h2>Hidden game</h2>";</script></div><footer><h2>Other platforms</h2></footer></body>';
  const result = mainContent(html);
  assert.match(result, /PS Vita games/);
  assert.match(result, /SuperTux/);
  for (const leak of ['Xbox 360', 'PS5', 'Hidden game', 'Other platforms']) assert.ok(!result.includes(leak), leak);
});

test('platform prefixes respect generations and exact article routes', () => {
  assert.equal(matchesPrefix('console/nintendo-switch/apps.html', 'console/nintendo-switch'), true);
  assert.equal(matchesPrefix('console/nintendo-switch-2/index.html', 'console/nintendo-switch'), false);
  assert.equal(matchesPrefix('games/gta/modded-outfits.html', 'games/gta/modded-outfits.html'), true);
  assert.equal(matchesPrefix('games/gta/modded-outfits.html-old', 'games/gta/modded-outfits.html'), false);
});

test('Safety Tips content remains available while unrelated safety callouts are excluded', () => {
  const html = '<body><main><h1>Safety</h1><!-- Safety Tips Grid --><h2>Verify Downloads</h2><p>Read source notes.</p><!-- Safety Warning --><h2>Other generic callout</h2></main></body>';
  const content = mainContent(html);
  assert.match(content, /Verify Downloads/);
  assert.ok(!content.includes('Other generic callout'));
});

test('description fallback names actual resources and trims at word or sentence boundaries', () => {
  const content = '<h1>Native Vita games</h1><h2>SuperTux</h2><h2>Jump &amp; Bump</h2><h2>Sources</h2>';
  const description = fallbackDescription('PS Vita games', content);
  assert.match(description, /PS Vita games/);
  assert.match(description, /SuperTux/);
  assert.match(description, /Jump & Bump/);
  assert.ok(!description.includes('Sources'));
  const long = 'Browse console games and tools with their source links and exact published version details. ' + 'This complete library provides many more project and package details. '.repeat(3);
  assert.ok(trimDescription(long).length <= 165);
  assert.equal(trimDescription('PS2 setup and boot methods.'), 'PS2 setup and boot methods.');
});
