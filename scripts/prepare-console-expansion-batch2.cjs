// Download only selected ready JSONs and official artwork; inspect data, never execute it.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const normalize = value => String(value || '').replace(/[™®©]/g, '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/gi, ' ').toLowerCase().trim();
function preserve(file, bytes) {
  const target = path.join(root, file);
  fs.mkdirSync(path.dirname(target), {recursive: true});
  if (fs.existsSync(target)) {
    if (digest(fs.readFileSync(target)) !== digest(bytes)) throw Error('Refusing to replace ' + file);
  } else fs.writeFileSync(target, bytes, {flag: 'wx'});
}
async function request(url) {
  const response = await fetch(url, {signal: AbortSignal.timeout(20000), headers: {'User-Agent': 'whatsite-reviewed-game-expansion/1.0'}});
  if (!response.ok) throw Error('HTTP ' + response.status + ': ' + url);
  return response;
}
async function main() {
  const configPath = process.argv.find(arg => arg.startsWith('--config='))?.slice(9) || 'docs/console-expansion-batch2.json';
  if (!/^docs\/console-expansion-batch\d+\.json$/.test(configPath)) throw Error('Expected a scoped console expansion batch file');
  const batch = path.basename(configPath, '.json');
  const config = read(configPath);
  const sourceFile = 'docs/ps4-extra-game-cheats.json';
  const source = read(sourceFile), tree = read('docs/ps4-ps5-research/goldhen-full-tree.json');
  if (tree.sha !== source.commit) throw Error('Cheat tree does not match the pinned revision');
  const additions = [];
  for (const pick of config.cheats) {
    if (source.files.some(file => file.filename === pick.filename)) continue;
    const upstream = tree.tree.find(file => file.path === 'json/' + pick.filename);
    if (!upstream) throw Error('Exact cheat filename missing from official pinned tree: ' + pick.filename);
    const url = `https://raw.githubusercontent.com/GoldHEN/GoldHEN_Cheat_Repository/${source.commit}/json/${pick.filename}`;
    const stagedPath = `downloads/staging/${batch}/${pick.filename}`;
    const bytes = fs.existsSync(path.join(root, stagedPath)) ? fs.readFileSync(path.join(root, stagedPath)) : Buffer.from(await (await request(url)).arrayBuffer());
    const blob = crypto.createHash('sha1').update(Buffer.from('blob ' + bytes.length + '\0')).update(bytes).digest('hex');
    if (bytes.length !== upstream.size || blob !== upstream.sha) throw Error('File differs from pinned Git blob: ' + pick.filename);
    const data = JSON.parse(bytes.toString('utf8'));
    if (pick.filename !== data.id + '_' + data.version + '.json' || !normalize(data.name).includes(normalize(pick.expectedName)) || !Array.isArray(data.mods) || !data.mods.length) throw Error('Cheat identity does not match reviewed selection: ' + pick.filename);
    preserve(stagedPath, bytes);
    const image = pick.image || `/assets/images/ps4-ps5/${pick.game}.jpg`;
    const artMetaFile = `docs/ps4-ps5-research/${batch.replace('console-expansion-', '')}-art-${pick.game}.json`;
    let artwork;
    if (pick.image && pick.artwork) {
      const art = fs.readFileSync(path.join(root, image.slice(1)));
      artwork = {...pick.artwork, bytes:art.length, sha256:digest(art)};
    } else if (fs.existsSync(path.join(root, artMetaFile))) {
      artwork = read(artMetaFile);
      if (digest(fs.readFileSync(path.join(root, image.slice(1)))) !== artwork.sha256) throw Error('Captured artwork changed');
    } else {
      const json = await (await request(`https://store.steampowered.com/api/appdetails?appids=${pick.steamApp}&l=english&cc=us`)).json();
      const app = json[pick.steamApp]?.data;
      if (!normalize(app?.name).includes(normalize(pick.expectedName))) throw Error('Official artwork identity mismatch: ' + pick.game);
      const art = Buffer.from(await (await request(app.header_image)).arrayBuffer());
      if (art.length < 1000 || art.length > 8 * 1024 * 1024 || art.subarray(0, 3).toString('hex') !== 'ffd8ff') throw Error('Invalid official JPEG');
      preserve(image.slice(1), art);
      artwork = {source: app.header_image, page: `https://store.steampowered.com/app/${pick.steamApp}/`, sourceTitle: app.name, bytes: art.length, sha256: digest(art), type: 'Official publisher storefront artwork; image does not establish PC or PS5 cheat compatibility'};
      preserve(artMetaFile, Buffer.from(JSON.stringify(artwork, null, 2) + '\n'));
    }
    const details = data.mods.filter(mod => String(mod.description || '').trim()).map(mod => ({name: mod.name, description: mod.description.trim()}));
    const record = {game: pick.game, title: pick.title, steamApp: pick.steamApp, filename: pick.filename, url, sourceName: data.name, titleId: data.id, version: data.version, process: data.process, credits: data.credits || [], cheats: data.mods.map(mod => mod.name), cheatDetails: details, bytes: bytes.length, sha256: digest(bytes), stagedPath, image, artwork};
    additions.push(record);
    if(config.compactCards===true)record.compactDownload=true;
    console.log(pick.title + ': identity, Git blob, ' + record.cheats.length + ' cheat labels, ' + details.length + ' conditions and official artwork verified');
  }
  // Fresh read just before the additive merge, so other content additions survive.
  const current = read(sourceFile);
  for (const record of additions) {
    const existing = current.files.find(file => file.filename === record.filename);
    if (existing && existing.sha256 !== record.sha256) throw Error('Conflicting concurrent cheat entry');
    if (!existing) current.files.push(record);
  }
  fs.writeFileSync(path.join(root, sourceFile), JSON.stringify(current, null, 2) + '\n');
  console.log(JSON.stringify({addedCheatGames: additions.length, totalCheatFiles: current.files.length}));
}
if (require.main === module) main().catch(error => {console.error(error); process.exitCode = 1;});
