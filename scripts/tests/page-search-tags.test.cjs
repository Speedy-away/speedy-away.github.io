const test = require('node:test');
const assert = require('node:assert/strict');
const {apply, aliasesFor, resourceTerms, decode} = require('../page-search-tags.cjs');
const search = html => decode(html.match(/data-(?:library-)?search=(["'])([\s\S]*?)\1/)[2]);

test('game-name aliases distinguish numbered games and console generations', () => {
  assert.ok(aliasesFor('GTA V').includes('Grand Theft Auto 5'));
  assert.ok(aliasesFor('Black Ops III').includes('BO3'));
  assert.ok(!aliasesFor('Black Ops III').includes('BO1'));
  assert.ok(!aliasesFor('Black Ops III').includes('BO2'));
  assert.ok(!aliasesFor('Nintendo Switch 2').includes('Nintendo Switch'));
  assert.ok(!aliasesFor('Nintendo Wii U').includes('Nintendo Wii'));
  assert.ok(!aliasesFor('Xbox 360').includes('Original Xbox'));
  assert.ok(!aliasesFor('Nintendo 3DS').includes('Nintendo 2DS'));
  assert.ok(!aliasesFor('Switch to Retail Mode').includes('Nintendo Switch'));
});

test('resource aliases come from headings and tags rather than negative compatibility notes', () => {
  const input = '<article data-search="gta v not tested on ps5" data-category="ps4" data-game-version="1.57"><h3>GTA V · PS4</h3><p>Not compatible with PS5. Xbox 360 is unsupported.</p><ul class="guide-resource-tags"><li class="feature-tag">GSC</li></ul><a href="/downloads/old-version.elf" download>Exact file</a></article>';
  const output = apply('console/ps4/mods.html', input);
  assert.ok(search(output).includes('grand theft auto 5'));
  assert.ok(search(output).includes('playstation 4'));
  assert.ok(search(output).includes('gsc'));
  assert.ok(!search(output).includes('playstation 5'));
  assert.ok(!search(output).includes('xbox360'));
  assert.ok(output.includes('data-game-version="1.57"'));
  assert.ok(output.includes('href="/downloads/old-version.elf" download'));
  assert.equal(apply('console/ps4/mods.html', output), output);
});

test('native library fields and visible tags retain their filter scopes', () => {
  const input = '<article data-library-card data-library-category="emulators" data-library-support="rgh" data-library-search="swanstation xex"><h3>SwanStation</h3><ul class="library-tags"><li>Xbox 360</li><li>XEX</li></ul></article>';
  const output = apply('console/xbox360/library.html', input);
  assert.ok(search(output).includes('xbox360'));
  assert.ok(search(output).includes('x360'));
  assert.match(output, /data-library-category="emulators" data-library-support="rgh"/);
  assert.ok(!/\sdata-search=/.test(output));
  assert.equal(apply('console/xbox360/library.html', output), output);
});

test('Unicode search alternatives preserve escaped quotes and visible markup', () => {
  const input = "<div class='game-card' data-search='Pokémon &amp; friends'><h3>Pokémon – Garry’s Mod</h3><span class='feature-tag'>PS Vita</span><p>Keep &amp; preserve the text.</p></div>";
  const output = apply('index.html', input);
  assert.ok(search(output).includes('pokemon'));
  assert.ok(search(output).includes('garry\'s mod'));
  assert.ok(search(output).includes('playstation vita'));
  assert.ok(output.includes("garry&#39;s mod"));
  assert.ok(output.includes('<h3>Pokémon – Garry’s Mod</h3>'));
  assert.ok(output.includes('<p>Keep &amp; preserve the text.</p>'));
  assert.equal(apply('index.html', output), output);
  const missing = apply('console/psvita/library.html', '<article data-vita-item><h3>Pokémon viewer</h3></article>');
  assert.ok(search(missing).includes('pokémon viewer'));
  assert.ok(search(missing).includes('pokemon viewer'));
});

test('only searchable cards are changed and embedded scripts/comments are inert', () => {
  const input = '<nav><span>PS5 GTA V</span></nav><script>const card=`<div data-search="ps2"><h3>PS2</h3></div>`;</script><!-- <article data-search="PS3"><h3>PS3</h3></article> --><article><h3>GTA V</h3></article><article data-vita-item data-category="Apps"><h3>VitaShell</h3><ul class="vita-tags"><li>Native Vita</li><li>VPK</li></ul></article>';
  const output = apply('console/psvita/apps.html', input);
  assert.ok(output.includes('<script>const card=`<div data-search="ps2"><h3>PS2</h3></div>`;</script>'));
  assert.ok(output.includes('<!-- <article data-search="PS3"><h3>PS3</h3></article> -->'));
  assert.ok(output.includes('<article><h3>GTA V</h3></article>'));
  const actual=search(output.slice(output.lastIndexOf('<article data-vita-item')));
  for(const term of ['vitashell','native vita','playstation vita','psvita','vpk package'])assert.ok(actual.includes(term),term);
  assert.equal(apply('console/psvita/apps.html', output), output);
});

test('immutable ready builds and downloaded HTML keep their exact bytes', () => {
  const html = '<article data-search="PS2"><h3>PS2</h3></article>';
  for (const file of ['console/ps4/whatsite-ps4.html', 'console/ps5/whatsite-ps5.html', 'downloads/archive/tool.html', 'hosts/runtime/ps4-900/upstream/index.html']) assert.equal(apply(file, html), html);
  const receiver = '<script id="receiver-catalog" type="application/json">[]</script>' + html;
  assert.equal(apply('console/ps4/receiver.html', receiver), receiver);
  assert.deepEqual(resourceTerms('<article><h3>PS2ME</h3><p>PS2 ELF</p></article>'), ['PS2ME']);
});

test('new game aliases keep numbered titles distinct without inventing an update or year',()=>{
  assert.ok(aliasesFor('GTA San Andreas').includes('GTASA'));
  assert.ok(aliasesFor('Grand Theft Auto Vice City').includes('GTA VC'));
  assert.ok(aliasesFor('Modern Warfare 2 (2009)').includes('MW2'));
  assert.ok(!aliasesFor('Modern Warfare 2 (2009)').some(x=>/2022|MW3/.test(x)));
  assert.ok(aliasesFor('Modern Warfare III (2023)').includes('MW3'));
  assert.ok(!aliasesFor('Modern Warfare III (2023)').includes('MW2'));
  assert.ok(!aliasesFor('Red Dead Redemption 2').includes('RDR1'));
  assert.ok(!aliasesFor('Left 4 Dead 2').includes('L4D1'));
  assert.ok(aliasesFor('Borderlands 3').includes('BL3'));
});

test('file and gameplay tags add useful searches without assigning console support from a format',()=>{
  const input='<article data-search=""><h3>Example single-player PKG</h3><span class="feature-tag">PS4</span><span class="feature-tag">PS5 support unconfirmed</span><a href="/downloads/pinned.pkg" download>Download</a></article>';
  const output=apply('console/example.html',input);
  assert.ok(search(output).includes('singleplayer'));
  assert.ok(search(output).includes('package file'));
  assert.ok(search(output).includes('playstation 4'));
  assert.ok(!search(output).includes('playstation 5'));
  assert.ok(!aliasesFor('PKG').some(x=>/PS[345]|PlayStation/.test(x)));
  assert.ok(aliasesFor('theme.nxtheme').includes('theme file'));
  assert.ok(aliasesFor('PBP').includes('EBOOT.PBP'));
  assert.equal(apply('console/example.html',output),output);
});
