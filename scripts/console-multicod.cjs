const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {section, grid, resource} = require('./build-console-guides.cjs');
const root = path.resolve(__dirname, '..');
const base = '/console/mods/ps4/call-of-duty/';
const indexUrl = base + 'multicod/';
const h = value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const fullLink = (url, label) => `<a href="${h(url)}" target="_blank" rel="noopener noreferrer">${h(label)} <i class="fas fa-arrow-right" aria-hidden="true"></i></a>`;
const labels = {'menu-pack': 'Console menu packs', 'desktop-menu': 'Windows menu tools', 'desktop-helper': 'Shared Windows functions', historical: 'Historical entries'};

function load() {
  const data = JSON.parse(fs.readFileSync(path.join(root, 'docs/ps4-ps5-multicod.json'), 'utf8'));
  const cod = JSON.parse(fs.readFileSync(path.join(root, 'docs/ps4-ps5-cod-resources.json'), 'utf8'));
  const legacy = JSON.parse(fs.readFileSync(path.join(root, 'docs/ps4-bo3-resources.json'), 'utf8')).resources;
  if (data.schemaVersion !== 1 || !Array.isArray(data.families)) throw new Error('Unsupported MultiCOD mapping schema');
  const games = new Map(cod.games.map(game => [game.id, game]));
  const resources = new Map(cod.resources.filter(item => item.publication === 'include').map(item => [item.id, item]));
  const ids = new Set();
  for (const family of data.families) {
    if (!/^[a-z0-9-]+$/.test(family.id) || ids.has(family.id) || !labels[family.type] || family.games.length < 2) throw new Error('Invalid MultiCOD family: ' + family.id);
    ids.add(family.id);
    const mappedGames = new Set();
    for (const mapping of family.games) {
      const item = mapping.legacy ? legacy.find(item => 'bo3-' + item.id === mapping.resourceId) : resources.get(mapping.resourceId);
      if (!games.has(mapping.gameId) || mappedGames.has(mapping.gameId) || !item || (mapping.legacy ? mapping.gameId !== 'black-ops-3' : !item.gameIds.includes(mapping.gameId))) throw new Error('Invalid MultiCOD game/resource mapping: ' + family.id);
      if (!mapping.support || !/^https:\/\//.test(mapping.source)) throw new Error('MultiCOD source and compatibility text required: ' + family.id);
      mappedGames.add(mapping.gameId);
    }
    for (const file of family.evidenceFiles) if (!fs.existsSync(path.join(root, file))) throw new Error('Missing MultiCOD evidence: ' + file);
  }
  const readyPath = path.join(root, 'docs/console-multicod-ready-files.json');
  const cataloguePath = path.join(root, 'docs/console-download-catalog.json');
  const prepared = fs.existsSync(readyPath) ? JSON.parse(fs.readFileSync(readyPath, 'utf8')).resources : [];
  const catalogue = fs.existsSync(cataloguePath) ? JSON.parse(fs.readFileSync(cataloguePath, 'utf8')).items : [];
  // A prepared descriptor becomes public only after archival/catalogue review.
  const readyFiles = prepared.filter(file => {
    const item = catalogue.find(item => item.id === file.id && item.sha256 === file.sha256 && item.bytes === file.bytes);
    if (!item || item.platforms.length !== 1 || item.platforms[0] !== 'ps4' || !games.has(file.gameId) || !/^\/downloads\//.test(item.url)) return false;
    const local = path.resolve(root, '.' + decodeURIComponent(item.url));
    if (!local.startsWith(path.join(root, 'downloads') + path.sep) || !fs.existsSync(local)) return false;
    const bytes = fs.readFileSync(local);
    return bytes.length === file.bytes && crypto.createHash('sha256').update(bytes).digest('hex') === file.sha256;
  });
  return {data, games, resources, legacy, readyFiles};
}

function readyFileLinks(gameId, context) {
  const files = (context.readyFiles || []).filter(file => file.gameId === gameId);
  if (!files.length) return '';
  return `<div class="multicod-ready-files">${files.map(file => `<div class="multicod-download-row" data-game-update="${h(file.gameUpdate)}"><strong>${h(file.gameUpdate)}</strong><a class="btn btn-outline" href="${h(file.url)}" download="${h(file.filename)}" data-no-file-options>Download</a><a class="btn btn-primary" href="/console/ps4/downloads.html?file=${encodeURIComponent(file.id)}#files">Save on PS4</a></div>`).join('')}</div>`;
}

function compactCard(title, image, description, actions, details) {
  return `<article class="guide-resource multicod-card">${image ? `<img src="${h(image)}" alt="${h(title)}" loading="lazy">` : ''}<h3>${h(title)}</h3><p class="multicod-compatibility">${h(description)}</p>${actions}<details class="multicod-details"><summary>Setup &amp; source</summary>${details}</details></article>`;
}

function gameUrl(mapping, context = load()) {
  // Resource anchors navigate to a full game page. The page's own Guide button
  // retains the existing guide dialog without turning cross-game links into one.
  return base + context.games.get(mapping.gameId).slug + '/#resource-' + mapping.resourceId;
}

function mappingCard(family, mapping, context) {
  const game = context.games.get(mapping.gameId);
  const ready = family.id === 'matrix-menus-ps4' ? readyFileLinks(mapping.gameId, context) : '';
  const description = ready ? 'PS4 · choose your installed game update' : mapping.support;
  const files = mapping.archiveFiles?.length ? `<p>Archive files: ${mapping.archiveFiles.map(file => `<code>${h(file)}</code>`).join(', ')}.</p>` : '';
  const details = `<p>${h(mapping.support)}</p>${files}${ready ? '<p>Firmware and title-ID ranges are not documented by the original archive. Saving an ELF does not launch it.</p>' : ''}<div class="guide-links">${fullLink(gameUrl(mapping, context), 'Open game page')}${fullLink(mapping.source, 'Source')}${ready ? `<a href="${h(context.readyFiles.find(file=>file.gameId===mapping.gameId).supportPack)}" download>Original archive</a>` : ''}</div>`;
  return compactCard(game.title, game.cover, description, ready || `<div class="guide-links">${fullLink(gameUrl(mapping, context), 'Open game page')}</div>`, details);
}

function indexContent(context = load()) {
  const intro = section('supported-games', 'One resource, separate game support',
    '<p>Choose your game and match the installed update.</p><details class="multicod-details"><summary>Compatibility notes</summary><p>MultiCOD means a resource supports more than one Call of Duty game. A PS4 payload or Windows tool does not become a native PS5 build by appearing here. PS5 use requires the resource’s documented game environment and loader.</p></details>');
  return intro + Object.entries(labels).map(([type, label]) => {
    const families = context.data.families.filter(family => family.type === type);
    return !families.length ? '' : section('type-' + type, label, families.map(family =>
      `<article id="multicod-${h(family.id)}"><h3>${h(family.title)}</h3><details class="multicod-details"><summary>Pack requirements</summary><p>${h(family.version)}. ${h(family.description)}</p><p>${h(family.environment)}</p></details>${grid(...family.games.map(mapping => mappingCard(family, mapping, context)))}</article>`).join(''));
  }).join('');
}

function gameContent(gameId, context = load()) {
  const families = context.data.families.filter(family => family.games.some(mapping => mapping.gameId === gameId));
  if (!families.length) return '';
  return section('multicod-support', 'Shared resources · game-specific support',
    `${grid(...families.map(family => {
      const current = family.games.find(mapping => mapping.gameId === gameId);
      const others = family.games.filter(mapping => mapping.gameId !== gameId);
      const ready = family.id === 'matrix-menus-ps4' ? readyFileLinks(gameId, context) : '';
      const item=current.legacy?context.legacy.find(item=>'bo3-'+item.id===current.resourceId):context.resources.get(current.resourceId);
      const preview=require('./ps4-ps5-card-images.cjs').resourceImage(item||{gameIds:[gameId]});
      return compactCard(family.title, preview?.src||context.games.get(gameId).cover, ready ? 'PS4 · choose your installed game update' : current.support,
        ready || `<div class="guide-links">${fullLink(indexUrl + '#multicod-' + family.id, 'Compare games')}</div>`,
        `<p>${h(current.support)}</p><p>${h(family.environment)}</p><div class="guide-links">${fullLink(current.source, 'Source')}${fullLink(indexUrl + '#multicod-' + family.id, 'Compare supported games')}${others.map(mapping => fullLink(gameUrl(mapping, context), context.games.get(mapping.gameId).title)).join('')}</div>`);
    }))}`);
}

module.exports = {load, gameUrl, indexContent, gameContent, readyFileLinks, indexUrl};
