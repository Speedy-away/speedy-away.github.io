// Original vector social cards, rendered to self-contained 1200 x 630 PNGs.
// No source image is edited and no downloadable HTML tool is touched.
// Run after page generation, then refresh HTML metadata in a fresh process.
// --check verifies the committed manifest without writing. Prior renders are immutable.
// Optional docs/seo/social-image-overrides.json selects unmodified illustrated primaries;
// every selected illustration retains the exact native title card as a card* fallback.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const {root, pages, relativePath} = require('./site-public-pages.cjs');
const rendererVersion = 'whatwhatboy-social-v1';
const width = 1200, height = 630;
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
let canvasModule, measureContext;
function bundled(name) {
  try { return require(name); } catch {}
  const roots = [process.env.SOCIAL_PREVIEW_NODE_MODULES, path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')].filter(Boolean);
  for (const base of roots) {
    try { return require(require.resolve(name, {paths: [base]})); } catch {}
  }
  throw Error('The bundled image runtime is unavailable for ' + name + '. Set SOCIAL_PREVIEW_NODE_MODULES to its package directory.');
}
function context() {
  if (!measureContext) {
    canvasModule = bundled('@napi-rs/canvas');
    const font = process.platform === 'win32' ? path.join(process.env.WINDIR || 'C:/Windows', 'Fonts/arialbd.ttf') : '';
    if (font && fs.existsSync(font)) canvasModule.GlobalFonts.registerFromPath(font, 'Arial');
    measureContext = canvasModule.createCanvas(4, 4).getContext('2d');
  }
  return measureContext;
}
function displayTitle(title) {
  return String(title).replace(/\s*\|\s*whatwhatboy(?:'s)?\s*$/i, '').trim();
}
function wrapTitle(title, {fontSize = 76, minFontSize = 32, maxWidth = 1056, maxLines = 3} = {}) {
  const text = displayTitle(title), words = text.split(/\s+/).filter(Boolean), ctx = context();
  for (let size = fontSize; size >= minFontSize; size -= 2) {
    ctx.font = `700 ${size}px Arial`;
    const lines = [];
    let line = '', fits = true;
    for (const word of words) {
      if (ctx.measureText(word).width > maxWidth) { fits = false; break; }
      const next = line ? line + ' ' + word : word;
      if (line && ctx.measureText(next).width > maxWidth) { lines.push(line); line = word; }
      else line = next;
    }
    if (line) lines.push(line);
    if (fits && lines.length <= maxLines) return {lines, fontSize: size, lineHeight: Math.round(size * 1.1)};
  }
  throw Error('Social title needs manual copy review: ' + text);
}
function pageTheme(page) {
  const p = String(page).replaceAll('\\', '/');
  const make = (family, eyebrow, accent) => ({family, eyebrow, accent});
  if (/^hosts\/(ps[45])\//.test(p)) return make('PlayStation', p.includes('/ps4/') ? 'PS4 · PAYLOAD HOST' : 'PS5 · PAYLOAD HOST', '#83b5ff');
  if (/^console\/(?:psvita|psp|retro\/psp|retro\/ps2|ps[2345]|mods\/ps4)/.test(p)) {
    const label = /psvita/.test(p) ? 'PS VITA' : /psp/.test(p) ? 'PSP' : /ps2/.test(p) ? 'PS2' : /ps3/.test(p) ? 'PS3' : /ps5/.test(p) ? 'PS5' : 'PS4';
    return make('PlayStation', label + ' · GUIDES & TOOLS', '#83b5ff');
  }
  if (/^console\/(?:xbox|retro\/xbox)/.test(p)) return make('Xbox', /xbox360/.test(p) ? 'XBOX 360 · GUIDES & TOOLS' : /one-series/.test(p) ? 'XBOX ONE / SERIES · TOOLS' : 'ORIGINAL XBOX · GUIDES & TOOLS', '#68dcaa');
  if (/^console\/(?:nintendo|wii|3ds|ds|gamecube|retro\/(?:wii|3ds|ds|gamecube))/.test(p)) {
    const label = /switch-2/.test(p) ? 'SWITCH 2' : /switch/.test(p) ? 'NINTENDO SWITCH' : /wiiu/.test(p) ? 'WII U' : /wii/.test(p) ? 'NINTENDO WII' : /3ds/.test(p) ? 'NINTENDO 2DS / 3DS' : /gamecube/.test(p) ? 'GAMECUBE' : /(?:\/ds|retro\/ds)/.test(p) ? 'NINTENDO DS / DSi' : 'NINTENDO';
    return make('Nintendo', label + ' · GUIDES & TOOLS', '#ffac91');
  }
  if (/^console\/steamdeck/.test(p)) return make('Steam Deck', 'STEAM DECK · TOOLS & GUIDES', '#7edce8');
  if (/themes/.test(p)) return make('Themes', 'THEMES & CUSTOMIZATION', '#c0a6ee');
  if (/^source-codes\//.test(p)) return make('Source code', 'SOURCE CODE & DEVELOPMENT', '#edc375');
  if (/^tools\//.test(p)) return make('Tools', 'TOOLS & UTILITIES', '#edc375');
  if (/^games\//.test(p) || /^mods\//.test(p)) return make('Games', 'GAME MODS & RESOURCES', '#b1b4fa');
  if (/download/.test(p)) return make('Downloads', 'GAMES & DOWNLOAD DIRECTORIES', '#68dcaa');
  if (/^pages\//.test(p) || /^guides\//.test(p)) return make('Guides', 'GUIDES & SITE INFORMATION', '#edc375');
  if (/^free-keys\//.test(p) || /^api\//.test(p)) return make('Site access', 'SITE ACCESS & INFORMATION', '#68dcaa');
  return make('whatwhatboy', 'GAMES · MODS · HOMEBREW', '#68dcaa');
}
function renderCard({page, title}) {
  const theme = pageTheme(page), wrapped = wrapTitle(title), seed = parseInt(digest(page).slice(0, 6), 16);
  const contours = Array.from({length: 14}, (_, n) => {
    const x = 680 + n * 34, offset = (seed % 60) - 30;
    return `<path d="M${x} -60 C${x - 200} ${110 + offset},${x + 120} 300,${x - 190} 710"/>`;
  }).join('');
  const firstBaseline = wrapped.lines.length === 1 ? 310 : wrapped.lines.length === 2 ? 264 : 245;
  const text = wrapped.lines.map((line, index) => `<text x="64" y="${firstBaseline + wrapped.lineHeight * index}" font-family="Arial,Helvetica,sans-serif" font-size="${wrapped.fontSize}" font-weight="700" letter-spacing="-2" fill="#f5f7f8">${escape(line)}</text>`).join('');
  const route = '/' + page.replace(/index\.html$/, '');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-label="${escape(displayTitle(title))}"><defs><radialGradient id="glow"><stop stop-color="${theme.accent}" stop-opacity=".095"/><stop offset="1" stop-color="${theme.accent}" stop-opacity="0"/></radialGradient><linearGradient id="floor" x2="1" y2="0"><stop stop-color="#14191c"/><stop offset="1" stop-color="#0b0e11"/></linearGradient></defs><rect width="1200" height="630" fill="#0b0e11"/><ellipse cx="1040" cy="250" rx="660" ry="500" fill="url(#glow)"/><g fill="none" stroke="${theme.accent}" stroke-width="1" opacity=".14">${contours}</g><path d="M1088 120 H1154 V186 M1154 446 V512 H1088" fill="none" stroke="${theme.accent}" stroke-width="2" opacity=".55"/><g transform="translate(64 50)"><rect width="48" height="48" rx="11" fill="#151d20" stroke="${theme.accent}" stroke-opacity=".45"/><path d="M10 15 L17 33 L24 21 L31 33 L38 15" fill="none" stroke="${theme.accent}" stroke-width="3.5" stroke-linejoin="round"/><text x="66" y="32" font-family="Arial,Helvetica,sans-serif" font-size="30" font-weight="700" letter-spacing="-.8" fill="#f5f7f8">whatwhatboy</text></g><text x="64" y="153" font-family="Arial,Helvetica,sans-serif" font-size="18" font-weight="700" letter-spacing="2.4" fill="${theme.accent}">${escape(theme.eyebrow)}</text>${text}<rect x="64" y="490" width="74" height="4" rx="2" fill="${theme.accent}"/><path d="M64 542 H1136" stroke="#30393f" stroke-width="1"/><text x="64" y="582" font-family="Arial,Helvetica,sans-serif" font-size="20" font-weight="700" fill="#d8dfe2">whatwhatboy.com</text><text x="1136" y="582" text-anchor="end" font-family="Arial,Helvetica,sans-serif" font-size="15" fill="#839197">${escape(route)}</text></svg>`;
}
function artifactBase(page, title) {
  const slug = page.replace(/(?:\/index)?\.html$/, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 86) || 'home';
  return slug + '-' + digest(rendererVersion + '\n' + page + '\n' + title).slice(0, 12);
}
function writeNew(file, bytes) {
  if (fs.existsSync(file)) {
    if (!fs.readFileSync(file).equals(Buffer.from(bytes))) throw Error('Refusing to replace different social asset: ' + file);
    return false;
  }
  fs.writeFileSync(file, bytes);
  return true;
}
async function build({check = false} = {}) {
  const sharp = bundled('sharp');
  const metadataEngine = require('./page-search-metadata.cjs');
  const imageDir = path.join(root, 'assets/images/social/pages'), sourceDir = path.join(root, 'assets/images/social/sources');
  if (!check) { fs.mkdirSync(imageDir, {recursive: true}); fs.mkdirSync(sourceDir, {recursive: true}); }
  const overridePath = path.join(root, 'docs/seo/social-image-overrides.json');
  const overrideDocument = fs.existsSync(overridePath) ? JSON.parse(fs.readFileSync(overridePath, 'utf8')) : {};
  const overrides = overrideDocument.images || overrideDocument;
  if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) throw Error('Invalid social image overrides: expected an images object');
  const manifest = {version: rendererVersion, width, height, renderer: 'Original SVG rendered by bundled sharp; Arial Bold measured with @napi-rs/canvas.', images: {}};
  let created = 0;
  for (const file of pages()) {
    const page = relativePath(file), html = fs.readFileSync(file, 'utf8');
    const record = metadataEngine.transform(page, html).metadata;
    if (!record) continue;
    const title = displayTitle(record.title), svg = renderCard({page, title});
    let base = artifactBase(page, title);
    const originalSource = path.join(sourceDir, base + '.svg');
    // A design correction receives a new URL; previous source and PNG files stay intact.
    if (fs.existsSync(originalSource) && fs.readFileSync(originalSource, 'utf8') !== svg) base += '-' + digest(svg).slice(0, 8);
    const local = '/assets/images/social/pages/' + base + '.png', sourcePath = '/assets/images/social/sources/' + base + '.svg';
    const output = path.join(root, local.slice(1));
    const svgPath = path.join(root, sourcePath.slice(1));
    let bytes;
    if (fs.existsSync(output) && fs.existsSync(svgPath) && fs.readFileSync(svgPath, 'utf8') === svg) bytes = fs.readFileSync(output);
    else {
      bytes = await sharp(Buffer.from(svg)).png({compressionLevel: 9, palette: true, effort: 10}).toBuffer();
      if (!check) { if (writeNew(output, bytes)) created++; writeNew(svgPath, svg); }
      else throw Error('Social preview needs generation: ' + page);
    }
    manifest.images[page] = {path: local, sourcePath, alt: 'Original whatwhatboy preview: ' + title, width, height, type: 'image/png', title, source: 'original-vector-render', sha256: digest(bytes), bytes: bytes.length, theme: pageTheme(page).family};
    if (Object.hasOwn(overrides, page)) {
      const override = overrides[page];
      if (!override || typeof override !== 'object' || Array.isArray(override)) throw Error('Invalid social image override for ' + page);
      const imagePath = override.path;
      if (typeof imagePath !== 'string' || !/^\/assets\/images\/[a-z0-9/_\-.]+\.png$/i.test(imagePath) || imagePath.split('/').includes('..')) throw Error('Social image override must name a local PNG under /assets/images/: ' + page);
      const absolute = path.resolve(root, imagePath.slice(1));
      if (!absolute.startsWith(path.resolve(root, 'assets/images') + path.sep) || !fs.existsSync(absolute)) throw Error('Social image override is missing: ' + imagePath);
      const primaryBytes = fs.readFileSync(absolute), primaryHash = digest(primaryBytes), details = await sharp(primaryBytes).metadata();
      const ratio = details.width / details.height;
      if (details.format !== 'png' || details.width < width || details.height < height || ratio < 1.8 || ratio > 2) throw Error('Social image override must be a PNG at least 1200 x 630 with aspect ratio 1.8 to 2.0: ' + imagePath);
      if (override.width !== details.width || override.height !== details.height || override.type !== 'image/png' || override.sha256 !== primaryHash || override.bytes !== primaryBytes.length) throw Error('Social image override dimensions, type, hash or size mismatch: ' + imagePath);
      if (typeof override.alt !== 'string' || !override.alt.trim() || typeof override.source !== 'string' || !override.source.trim()) throw Error('Social image override requires alt and source: ' + page);
      const native = manifest.images[page];
      manifest.images[page] = {...native, cardPath: native.path, cardSourcePath: native.sourcePath, cardSha256: native.sha256, cardBytes: native.bytes, cardSource: native.source,
        path: imagePath, alt: override.alt, width: details.width, height: details.height, type: 'image/png', source: override.source, sha256: primaryHash, bytes: primaryBytes.length};
      delete manifest.images[page].sourcePath;
    }
  }
  for (const page of Object.keys(overrides)) if (!Object.hasOwn(manifest.images, page)) throw Error('Social image override references a page outside public scope: ' + page);
  const manifestPath = path.join(root, 'docs/seo/social-images.json');
  const json = JSON.stringify(manifest, null, 2) + '\n';
  if (check) {
    if (!fs.existsSync(manifestPath) || fs.readFileSync(manifestPath, 'utf8') !== json) throw Error('Social preview manifest needs refresh');
  } else fs.writeFileSync(manifestPath, json);
  return {pages: Object.keys(manifest.images).length, created, manifest: 'docs/seo/social-images.json', rendererVersion};
}
module.exports = {wrapTitle, renderCard, pageTheme, artifactBase, displayTitle, build};
if (require.main === module) build({check: process.argv.includes('--check')}).then(result => console.log(JSON.stringify(result, null, 2))).catch(error => {console.error(error); process.exitCode = 1;});
