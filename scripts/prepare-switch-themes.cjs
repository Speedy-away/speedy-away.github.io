// Fetch only selected public Themezer entries and ready console files; never execute them.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const stage = path.join(root, 'tmp/switch-themes');
const seeds = [
  ['packs/switch2-neon-nebula-1997E', 'A neon space-inspired coordinated menu pack. SWITCH2 is its design name; Themezer categorizes it as an original Switch theme.'],
  ['packs/cozy-snorlax-adventures-1984E', 'A calm Pokémon night scene. The author requires Basic White in Settings > Themes and credits their own ComfyUI artwork.'],
  ['packs/pixel-forest-1E93C', 'A forest and pixel-art set covering seven menu components, including News.'],
  ['packs/ps5-theme-18815', 'A PlayStation-inspired visual style for Nintendo Switch, covering seven Switch menu components.'],
  ['themes/the-great-wave-off-kanagawa-E474', 'Ganipote’s Japanese painting background for the HOME Menu, from the Old School Japanese Painting pack.'],
  ['themes/black-rayquaza-lock-1F302', 'A dark Pokémon lockscreen by VtoSopran, supplied as one menu component.'],
  ['themes/pixel-cyber-punk-E6BB', 'Smushi’s pixel cyberpunk HOME Menu. The related pack credits its artwork to Valenberg.'],
  ['themes/minimalist-zelda-home-screen-E7CF', 'A restrained Zelda HOME Menu by Scruff; change the home screen alone with this individual component.']
];
if (process.argv.includes('--expand')) seeds.push(
 ['packs/zelda-breath-of-the-wild-pack-with-custom-icons-189CE','Zelda artwork and custom menu icons by auslachy, including a Tears of the Kingdom component.'],
 ['packs/shin-chan-switch-190ED','A coordinated Shin-chan menu set. Check the individual menu labels before installing.'],
 ['packs/light-and-dark-japanese-195B5','A monochrome Japanese-inspired set. The creator credits Luvingiane for the HOME Menu button layout.'],
 ['packs/evangelion-1EB1E','A coordinated Evangelion menu set, supplied as ready theme components.']
);
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
async function get(url, limit = 60 * 1024 * 1024) {
  const response = await fetch(url, {signal: AbortSignal.timeout(60000)});
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  const chunks = []; let length = 0;
  for await (const chunk of response.body) {
    length += chunk.length;
    if (length > limit) throw new Error('Response exceeded size limit');
    chunks.push(chunk);
  }
  return {bytes: Buffer.concat(chunks), url: response.url, type: response.headers.get('content-type')};
}
function entryFromHTML(html, hexId, kind) {
  const match = html.match(/<script[^>]+id="__NUXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) throw new Error('No Themezer metadata');
  const values = JSON.parse(match[1]);
  const apollo = values.find(v => v && typeof v === 'object' && Object.keys(v).some(k => k.startsWith('SwitchPack:') || k.startsWith('SwitchTheme:')));
  const memo = new Map();
  function value(i) {
    if (i < 0) return null;
    if (memo.has(i)) return memo.get(i);
    const raw = values[i];
    if (raw === null || typeof raw !== 'object') return raw;
    if (raw.__ref !== undefined) return value(apollo[values[raw.__ref]]);
    const result = Array.isArray(raw) ? [] : {};
    memo.set(i, result);
    if (Array.isArray(raw)) raw.forEach(v => result.push(value(v)));
    else Object.entries(raw).forEach(([k, v]) => result[k] = value(v));
    return result;
  }
  const index = values.findIndex(v => v && typeof v === 'object' && values[v.hexId] === hexId && values[v.__typename] === (kind === 'pack' ? 'SwitchPack' : 'SwitchTheme') && v.downloadUrl !== undefined);
  if (index < 0) throw new Error(`No full entry for ${hexId}`);
  return value(index);
}
async function main() {
  fs.mkdirSync(stage, {recursive:true});
  const catalogue = process.argv.includes('--expand') ? JSON.parse(fs.readFileSync(path.join(root,'docs/switch-themes-catalog.json'),'utf8')) : {schemaVersion:1, checkedAt:new Date().toISOString(), platform:'Switch', sourceDirectories:['https://themezer.net/','https://themezer.net/switch/packs','https://themezer.net/switch/themes'], themes:[], failures:[]};
  for (const [relative, summary] of seeds) {
    const sourceUrl = `https://themezer.net/switch/${relative}`;
    if (process.argv.includes('--expand') && catalogue.themes.some(theme=>theme.sourceUrl===sourceUrl)) continue;
    const hexId = relative.match(/-([A-F0-9]+)$/)[1];
    const kind = relative.startsWith('packs/') ? 'pack' : 'individual';
    try {
      const page = await get(sourceUrl, 3*1024*1024);
      fs.writeFileSync(path.join(stage, `${hexId}.html`), page.bytes);
      const source = entryFromHTML(page.bytes.toString(), hexId, kind);
      if (process.argv.includes('--expand') && kind==='pack' && source.themes?.length) seeds.push([new URL(source.themes[0].pageUrl).pathname.replace('/switch/',''), 'A single menu component from '+source.name+'. Download it separately to change only the labelled menu.']);
      const sourceImage = (source.collagePreview || source.screenshotPreview).hdUrl;
      const image = await get(sourceImage, 8*1024*1024);
      const imageExt = image.type?.includes('png') ? 'png' : image.type?.includes('webp') ? 'webp' : image.type?.includes('avif') ? 'avif' : 'jpg';
      const imageLocal = `/assets/images/switch-themes/${hexId}.${imageExt}`;
      fs.mkdirSync(path.dirname(path.join(root, imageLocal)), {recursive:true});
      fs.writeFileSync(path.join(root, imageLocal), image.bytes);
      const download = await get(source.downloadUrl + '?src=webapp');
      const version = `Themezer ${source.quickId || (kind === 'pack' ? 'P' : 'T')+hexId} snapshot 2026-11-02`;
      const filename = `${source.slug}-${hexId}.${kind === 'pack' ? 'zip' : 'nxtheme'}`;
      const local = `/downloads/nintendo-switch/themes/${hexId}/2026-11-02/${filename}`;
      fs.mkdirSync(path.dirname(path.join(root, local)), {recursive:true});
      if (fs.existsSync(path.join(root,local)) && sha(fs.readFileSync(path.join(root,local))) !== sha(download.bytes)) throw new Error('Refusing to replace a different snapshot');
      fs.writeFileSync(path.join(root,local), download.bytes);
      const components = (kind === 'pack' ? source.themes : [source]).map(t => ({id:t.hexId, title:t.name, target:t.target, layoutId:t.layoutId ?? null, sourceUrl:t.pageUrl}));
      const item = {id:`switch-themes-${hexId.toLowerCase()}`, themezerId:source.quickId || (kind === 'pack' ? 'P' : 'T')+hexId, title:source.name, author:source.creator.username, authorUrl:'https://themezer.net'+source.creator.pagePath, sourceUrl, image:imageLocal, imageProvenance:{sourceUrl:sourceImage, page:sourceUrl, credit:source.creator.username, bytes:image.bytes.length, sha256:sha(image.bytes)}, kind, summary, version, platform:'Switch', sourceCreatedAt:source.createdAt, sourceUpdatedAt:source.updatedAt, tags:(source.tags||[]).map(t=>t.name), components, requirements:['Original Nintendo Switch with Atmosphère and NXThemes Installer supporting its exact firmware.','Author has not published a universal firmware or region range for this entry. Menu layouts may need an update.'], file:{name:filename,local,version,sourceUrl:source.downloadUrl+'?src=webapp',bytes:download.bytes.length,sha256:sha(download.bytes),header:download.bytes.subarray(0,16).toString('hex')}};
      if (hexId === '1984E') item.requirements.push('Select Settings > Themes > Basic White before installation.');
      if (hexId === '1997E') item.requirements.push('SWITCH2 is a design name, not evidence of Nintendo Switch 2 hardware support.');
      try { require('./switch-theme-catalog.cjs').annotate({themes:[item]}); } catch(error) { catalogue.failures.push({...item,status:'layout-review-required',error:error.message}); continue; }
      catalogue.themes.push(item);
      console.log('Fetched',item.themezerId,item.title,item.file.bytes,item.file.header);
    } catch(error) { catalogue.failures.push({sourceUrl,status:'inaccessible',error:error.message}); console.error(error.message); }
  }
  const appUrl = 'https://github.com/ThemezerNX/Themezer-NX/releases/download/3.3.1/themezer-nx.nro';
  const app = await get(appUrl,20*1024*1024);
  if (sha(app.bytes) !== 'c83741eafe3a999e717b056055d42df91369555d94285077ce6c117b16c0fe62' || app.bytes.toString('ascii',16,20) !== 'NRO0') throw new Error('Themezer-NX publisher hash or NRO header mismatch');
  const appLocal = '/downloads/nintendo-switch/themes/themezer-nx/3.3.1/themezer-nx.nro';
  fs.mkdirSync(path.dirname(path.join(root,appLocal)),{recursive:true});fs.writeFileSync(path.join(root,appLocal),app.bytes);
  catalogue.client = {id:'switch-themes-themezer-nx',title:'Themezer-NX',version:'3.3.1',sourceUrl:'https://github.com/ThemezerNX/Themezer-NX',file:{name:'themezer-nx.nro',local:appLocal,version:'3.3.1',sourceUrl:appUrl,bytes:app.bytes.length,sha256:sha(app.bytes),format:'NRO'}};
  fs.writeFileSync(path.join(stage,'expansion-candidate.json'),JSON.stringify(catalogue,null,2));
  require('./switch-theme-catalog.cjs').annotate(catalogue);
  fs.writeFileSync(path.join(root,'docs/switch-themes-catalog.json'),JSON.stringify(catalogue,null,2)+'\n');
}
if (require.main === module) main().catch(error=>{console.error(error);process.exitCode=1;});
module.exports = {entryFromHTML};
