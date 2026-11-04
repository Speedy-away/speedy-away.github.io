const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {resourcesForGame, gamesSection} = require('../xbox360-mod-resources.cjs');
const {layoutFor} = require('../download-archive-layout.cjs');
const root = path.resolve(__dirname, '../..');
const data = require('../../docs/xbox360-mod-resources.json');
const inventory = JSON.parse(fs.readFileSync(path.join(root, 'docs/download-audit.json'), 'utf8').replace(/^\uFEFF/, '')).items;

test('game membership supports explicit multiple games without assigning another console or guessing coverage', () => {
  const shared = {id:'shared',platforms:['xbox360'],gameIds:['cod4','black-ops-2']};
  const cod4 = {id:'cod4-only',platforms:['xbox360'],gameIds:['cod4']};
  const ps3 = {id:'ps3-only',platforms:['ps3'],gameIds:['cod4','black-ops-2']};
  const fixture = {resources:[shared,cod4,ps3]};
  assert.deepEqual(resourcesForGame('cod4',fixture).map(item=>item.id),['shared','cod4-only']);
  assert.deepEqual(resourcesForGame('black-ops-2',fixture).map(item=>item.id),['shared']);
  assert.deepEqual(resourcesForGame('ghosts',fixture),[]);
  assert.equal(data.resources.length,4);assert.ok(data.resources.every(item=>item.gameIds.length===1&&item.gameIds[0]==='cod4'));
  assert.match(data.scope,/no source-confirmed Xbox 360 MultiCOD resource has been imported/);
});

test('Xbox entries retain existing archive identities, source pins and platform-layout backup references', () => {
  for(const item of data.resources){
    assert.deepEqual(item.platforms,['xbox360']);assert.equal(item.gameUpdate,null);assert.equal(item.region,null);
    assert.match(item.compatibility,/Exact title update, region, media ID/);
    const original=inventory.find(row=>row.id===item.archive.inventoryId);assert.ok(original,item.id);assert.equal(original.platform,'Xbox 360');
    const archive=original.files.find(file=>file.name===item.archive.filename);assert.ok(archive);
    assert.equal(item.archive.local,archive.local);assert.equal(item.archive.backupPath,archive.backupPath);assert.equal(item.archive.bytes,archive.bytes);assert.equal(item.archive.sha256,archive.sha256);
    assert.equal(item.archive.url,archive.sourceUrl||original.url);
    assert.ok(item.archive.backupPath.replaceAll('\\','/').endsWith('/files/'+layoutFor(original,archive).join('/')+'/'+archive.name));
    const saved=fs.readFileSync(path.join(root,'.'+item.archive.local));assert.equal(saved.length,item.archive.bytes);assert.equal(crypto.createHash('sha256').update(saved).digest('hex'),item.archive.sha256);
    assert.ok(item.members.some(member=>/\/default_mp\.xex$/.test(member)));assert.ok(item.members.some(member=>/\/patch_mp\.ff$/.test(member)));
    assert.ok(item.members.every(member=>/Xbox|XBOX/.test(member)));
  }
});

test('the Xbox game chooser opens the specific game page in a full tab and creates no unverified game entries', () => {
  const html=gamesSection();
  assert.match(html,/href="\/console\/xbox360\/mods\/call-of-duty\/cod4\/index\.html" target="_blank"/);
  assert.doesNotMatch(html,/data-guide-open|black-ops|modern-warfare-2|ghosts|DEX|HEN/);
  assert.match(html,/COD4 multiplayer patch archives/);
});

test('generated game page keeps four archive references and truthful unknown-update labels without executable actions', () => {
  const game=data.games[0],html=fs.readFileSync(path.join(root,'.'+game.page),'utf8');
  assert.ok(fs.readFileSync(path.join(root,'console/xbox360/mods.html'),'utf8').includes(game.page));
  const content=html.slice(html.indexOf('<div id="content">'));
  for(const item of data.resources){assert.ok(content.includes(item.archive.local));assert.ok(content.includes(item.archive.sha256));assert.ok(content.includes(item.source));}
  assert.equal((content.match(/>Download original RAR<\/a>/g)||[]).length,4);
  assert.equal((content.match(/Game update \/ region:<\/strong> not specified/g)||[]).length,4);
  assert.match(content,/Console execution and title-update compatibility were not tested/);
  assert.doesNotMatch(content,/<video|youtube|data-receiver-file|data-client-open|DEX|HEN/);
  assert.ok(html.includes('/assets/images/covers/cod4.jpg'));
});
