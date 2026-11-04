const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const scope = 'ps4-user-plugin-templates';
const manifestPath = path.join(root, 'downloads/ps4/plugin-templates/manifest.json');
const definitions = [
  {id: 'gta5', name: 'GTA V', source: 'C:/Users/whatw/Desktop/GTA5 - plugins.ini', titleIds: ['CUSA00411', 'CUSA00419', 'CUSA-00880']},
  {id: 'rdr2', name: 'RDR2', source: 'C:/Users/whatw/Desktop/RDR2 - plugins.ini', titleIds: ['CUSA08519', 'CUSA-03041', 'CUSA-08568']}
];
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const esc = text => String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
function prepare() {
  const files = definitions.map(game => {
    const bytes = fs.readFileSync(game.source), sha256 = hash(bytes);
    const local = `/downloads/ps4/plugin-templates/${game.id}/${sha256.slice(0, 12)}/plugins.ini`;
    const destination = path.join(root, '.' + local);
    if (fs.existsSync(destination)) {
      if (hash(fs.readFileSync(destination)) !== sha256) throw Error('Refusing to replace different file: ' + destination);
    } else {
      fs.mkdirSync(path.dirname(destination), {recursive: true});
      fs.writeFileSync(destination, bytes, {flag: 'wx'});
    }
    return {id: game.id, game: game.name, name: 'plugins.ini', originalName: path.basename(game.source),
      titleIds: game.titleIds, regions: ['EU', 'USA', 'JP'], version: 'User-supplied snapshot 2026-11-03',
      local, sourceUrl: 'https://whatwhatboy.com' + local, provenance: 'User-supplied desktop file; original bytes preserved.',
      bytes: bytes.length, sha256, template: true};
  });
  fs.writeFileSync(manifestPath, JSON.stringify({schemaVersion: 1, files}, null, 2) + '\n');
  return files;
}
function sectionFor(id) {
  const file = JSON.parse(fs.readFileSync(manifestPath, 'utf8')).files.find(file => file.id === id);
  if (!file) throw Error('Unknown game: ' + id);
  return `<section class="section" id="goldhen-plugin-template"><div class="container"><div class="section-header"><h2 class="section-title">GoldHEN plugins.ini · ${esc(file.game)}</h2><p class="section-subtitle">EU / USA / JP title IDs</p></div><aside class="guide-note" data-search="goldhen plugins.ini ${esc(file.game.toLowerCase())} eu usa jp ${file.titleIds.join(' ').toLowerCase()}"><div class="guide-links"><a class="btn btn-primary" href="${esc(file.local)}" download="plugins.ini"><i class="fas fa-download" aria-hidden="true"></i> Download ${esc(file.game)} plugins.ini</a></div><p>${file.titleIds.map((titleId, index) => `<strong>${file.regions[index]}</strong>: <code>${titleId}</code>`).join(' · ')}</p><p>Template with all three regional sections. Add the exact plugin filenames after <code>/data/GoldHEN/plugins/</code> and match the section to your installed game’s title ID. Merge into <code>/data/GoldHEN/plugins.ini</code>, keeping your existing entries. Plugin files are downloaded separately.</p></aside></div></section>`;
}
function apply() {
  for (const {id} of definitions) {
    const destination = path.join(root, `console/mods/ps4/${id}/index.html`);
    let html = fs.readFileSync(destination, 'utf8');
    html = html.replace(/<section class="section" id="goldhen-plugin-template">[\s\S]*?<\/section>/, '');
    if (!html.includes('<div id="content">')) throw Error('Missing content container: ' + destination);
    html = html.replace('<div id="content">', () => '<div id="content">' + sectionFor(id));
    fs.writeFileSync(destination, html);
  }
}
async function archive() {
  const intake = require('./console-expansion-archive.cjs').createArchive();
  const files = JSON.parse(fs.readFileSync(manifestPath, 'utf8')).files;
  const results = [];
  for (const file of files) {
    const bytes = fs.readFileSync(path.join(root, '.' + file.local));
    const result = await intake.writeBytes({scope,
      item: {id: scope + '-' + file.id, title: file.game + ' GoldHEN plugins.ini template', project: 'GoldHEN Plugin Templates',
        platform: 'PS4', category: ['Games', file.id === 'gta5' ? 'GTA5' : 'RDR2', 'Configurations'],
        pages: [`console/mods/ps4/${file.id}/index.html`], url: file.sourceUrl},
      file: {...file, archiveRole: ['Builds'], expectedSha256: file.sha256, expectedBytes: file.bytes}, bytes});
    if (hash(fs.readFileSync(result.file.backupPath)) !== file.sha256) throw Error('Archive verification failed');
    results.push(result.file);
  }
  await intake.mergeInventory({inventory: intake.inventoryPath(scope)});
  fs.writeFileSync(path.join(root, 'docs/qa/ps4-user-plugin-template-archive.json'), JSON.stringify({scope, files: results, allFilesVerified: true}, null, 2) + '\n');
  return results.map(file => ({name: file.originalName, backupPath: file.backupPath, bytes: file.bytes, sha256: file.sha256}));
}
if (require.main === module) (async () => {
  if (process.argv.includes('--prepare')) { console.log(JSON.stringify(prepare())); apply(); }
  else if (process.argv.includes('--archive')) console.log(JSON.stringify(await archive()));
  else throw Error('Use --prepare or --archive');
})().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = {sectionFor, apply, prepare, archive};
