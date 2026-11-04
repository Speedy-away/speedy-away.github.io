const test = require('node:test');
const assert = require('node:assert/strict');
const {resourceTags, resourceTerms} = require('../console-resource-tags.cjs');
const {catalog} = require('../console-mod-catalog.cjs');
const {metadataByPage, pageSchema} = require('../console-mod-metadata.cjs');

test('tags describe documented formats, modes and game aliases without assigning platforms', () => {
  const item = {name: 'Example ZM', category: 'menu', gameIds: ['black-ops-3'], downloads: [{url: 'https://example.com/menu.gscc'}]};
  assert.deepEqual(resourceTags(item), ['Mod menu', 'BO3', 'Zombies', 'GSCC']);
  const terms = resourceTerms(item).join(' ');
  assert.match(terms, /Black Ops III/);
  assert.match(terms, /BO 3/);
  assert.doesNotMatch(terms, /PS5|GoldHEN|Multiplayer|Windows/);
});

test('every catalog entry has resource tags and aliases, including legacy BO3 injector and packs', () => {
  const {entries} = catalog();
  assert.ok(entries.every(entry => entry.tags.length >= 2));
  const injector = entries.find(entry => entry.name === 'GSC Injector · no PC needed');
  assert.equal(injector.category, 'injector');
  assert.ok(injector.tags.includes('PRX'));
  const pack = entries.find(entry => entry.name === 'MuzzMan BO3 Menu Pack');
  assert.equal(pack.category, 'pack');
  assert.ok(pack.tags.includes('Multiplayer'));
  assert.ok(entries.filter(entry => entry.gameId === 'wwii').every(entry => entry.search.includes('ww2')));
  assert.ok(entries.filter(entry => entry.gameId === 'modern-warfare-remastered').every(entry => entry.search.includes('mw4r')));
});

test('game metadata stays specific and all editorial descriptions fit the page metadata limit', () => {
  const pages = metadataByPage();
  const titles = new Set();
  for (const data of pages.values()) {
    assert.ok(data.description.length <= 165, data.title);
    assert.ok(!titles.has(data.title), data.title);
    titles.add(data.title);
  }
  const rdr = pages.get('console/mods/ps4/rdr2/index.html');
  assert.doesNotMatch(rdr.keywords.join(' '), /PS5|Jiggy|HYDRA/);
  assert.match(rdr.keywords.join(' '), /Havana/);
  const iw = pages.get('console/mods/ps4/call-of-duty/infinite-warfare/index.html');
  assert.doesNotMatch(iw.keywords.join(' '), /HYDRA|GoldHEN|Zombies mod menus/);
  assert.match(iw.keywords.join(' '), /CUSA04762/);
});

test('directory schema lists exactly the visible entries and keeps every target on this site', () => {
  const {games,entries}=catalog();
  const metadata = metadataByPage().get('console/mods/ps4/menus.html');
  const schema = pageSchema({canonical: 'https://whatwhatboy.com/console/mods/ps4/menus.html', title: metadata.title,
    description: metadata.description, keywords: metadata.keywords.join(', '), metadata});
  const page = schema['@graph'].find(node => node['@type'] === 'CollectionPage');
  assert.equal(page.mainEntity.numberOfItems, entries.length);
  for (const [index, item] of page.mainEntity.itemListElement.entries()) {
    assert.equal(item.position, index + 1);
    assert.equal(new URL(item.url).origin, 'https://whatwhatboy.com');
    assert.equal(item.name,entries[index].game+' · '+entries[index].name);
    assert.equal(item.url,new URL(entries[index].url,'https://whatwhatboy.com').href);
  }
  assert.equal(schema['@graph'][0]['@id'], page.isPartOf['@id']);
  for (const game of games) assert.ok(page.mainEntity.itemListElement.some(item=>
    item.name.startsWith(game.title+' · ') && new URL(item.url).pathname===new URL(game.url,'https://whatwhatboy.com').pathname
  ),game.title+' is missing its named game-page target');
});
