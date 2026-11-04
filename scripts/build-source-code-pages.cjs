// Category -> platform -> game/project. Source archives come from the recorded inventory.
const fs = require('node:fs');
const path = require('node:path');
const {publicMirror, MAX_MIRROR_BYTES} = require('./download-mirror-policy.cjs');
const {page, section, grid, resource, link, ext, esc} = require('./build-console-guides.cjs');
const {icon} = require('./sidebar-icons.cjs');
const root = path.resolve(__dirname, '..');
const base = '/source-codes/';
const image = '/assets/images/ps4-gta5/oxagon.png';
const nav = [[base, 'Overview'], [base + 'console/', 'Console'], [base + 'pc/', 'PC'], [base + 'other/', 'Other Projects']];
const inventory = JSON.parse(fs.readFileSync(path.join(root, 'docs/download-audit.json'), 'utf8')).items;
const imported = require('./build-ps4-ps5-game-imports.cjs').createGameImports();
const catalog = require('../docs/source-code-catalog.json');
const built = [];
const consoleTrail = [[base + 'console/', 'Console']];
const ps4Trail = [...consoleTrail, [base + 'console/ps4/', 'PS4']];
const pcTrail = [[base + 'pc/', 'PC']];

function directoryCard(title, description, url, label, symbol, trail) {
  return `<article class="guide-resource source-directory-card"><div class="source-symbol">${icon(symbol)}</div><p class="source-trail">${esc(trail)}</p><h3>${esc(title)}</h3><p>${esc(description)}</p><div class="guide-links">${link(url, label)}</div></article>`;
}

function sourcePage(file, title, description, trail, content, primary, primaryLabel, options = {}) {
  page(file, title, description, options.image || image, nav, content, primary, primaryLabel);
  const target = path.join(root, file);
  let html = fs.readFileSync(target, 'utf8');
  const crumbs = [['/', 'Home'], [base, 'Source Codes'], ...trail];
  html = html.replace('class="console-guide"', 'class="console-guide source-code-page"')
    .replace('</head>', '<link rel="stylesheet" href="/assets/source-codes.css?v=2"></head>')
    .replace(/<div class="guide-breadcrumb">[\s\S]*?<\/div>/, `<nav class="guide-breadcrumb source-breadcrumb" aria-label="Breadcrumb"><ol>${crumbs.map(([url, label], index) => `<li>${index === crumbs.length - 1 ? `<span aria-current="page">${esc(label)}</span>` : `<a href="${url}">${esc(label)}</a>`}</li>`).join('')}</ol></nav>`)
    .replace('Game source-code collections and project links.', 'Source code for console, PC and other projects.')
    .replace('/assets/console-guide-dialog.js?v=5', '/assets/console-guide-dialog.js?v=6');
  if (!options.image) {
    html = html.replace('class="container guide-hero-grid"', 'class="container guide-hero-grid guide-hero-text"')
      .replace(/<img src="[^"]*" alt="[^"]*" width="1280" height="720">(?=<\/div><\/header>)/, '');
  }
  if (options.canonical) {
    html = html.replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="https://whatwhatboy.com${options.canonical}">`)
      .replace(/<meta name="robots" content="[^"]*">/, '<meta name="robots" content="noindex, follow">');
  }
  if (file === 'source-codes/pc/gta5/index.html') html = html.replace('</body>', '<script defer src="/assets/source-code-search.js?v=1"></script></body>');
  fs.writeFileSync(target, require('./search-page-output.cjs').finish(file, html));
  built.push(file);
}

function archiveCard(project) {
  const entry = inventory.find(item => item.id === project.inventoryId);
  if (!entry) throw Error('Missing source inventory item: ' + project.inventoryId);
  const file = entry.files?.find(file => /source.*\.zip$/i.test(file.name));
  const mirror = publicMirror(file?.local, root);
  const originalZip = file?.archiveMethod && project.repo && project.commit ? `https://codeload.github.com/${project.repo}/zip/${project.commit}` : file?.sourceUrl;
  const source = file?.bytes >= MAX_MIRROR_BYTES && /^https:\/\//.test(originalZip || '') ? originalZip : null;
  if (!file || (!mirror && !source)) throw Error('Missing public source archive: ' + project.inventoryId);
  const bytes = mirror ? mirror.bytes : file.bytes;
  if (bytes !== file.bytes) throw Error('Source archive size mismatch: ' + file.local);
  const version = file.version || entry.release || 'Archived source snapshot; version not recorded';
  const projectDetails = project.commit ? `<dt>Branch</dt><dd>${esc(project.branch)}</dd><dt>Commit</dt><dd>${ext(project.commitUrl, '<code>' + esc(project.commit) + '</code>')}</dd><dt>License</dt><dd>${esc(project.license || 'No license identified in the reviewed repository metadata')}</dd>${project.compatibility ? `<dt>Game compatibility</dt><dd>${esc(project.compatibility)}</dd>` : ''}` : '';
  const provenance = project.compact ? `<dt>Repository</dt><dd><code>${esc(project.repo || entry.url)}</code></dd>${project.availabilityNote ? `<dt>Contents</dt><dd>${esc(project.availabilityNote)}</dd>` : ''}` : '';
  const exportNote = file.archiveMethod ? '<dt>Archive provenance</dt><dd>Source export from the verified Git commit.</dd>' : '';
  const archiveScope = !mirror && file.archiveMethod ? 'Local archive ' : '';
  const details = `<details class="source-file-details"><summary>Archive details</summary><dl><dt>Version</dt><dd>${esc(version)}</dd>${projectDetails}${provenance}${exportNote}<dt>${archiveScope}File</dt><dd>${esc(file.name)}</dd><dt>${archiveScope}Size</dt><dd>${bytes.toLocaleString('en-GB')} bytes</dd><dt>${archiveScope}SHA-256</dt><dd><code>${esc(file.sha256)}</code></dd></dl></details>`;
  const size = bytes >= 1048576 ? (bytes / 1048576).toFixed(1) + ' MiB' : (bytes / 1024).toFixed(1) + ' KiB';
  const description = esc(project.description || '');
  const downloadLabel = project.compact ? 'Download' : 'Download source ZIP';
  const repositoryAction = project.compact ? '' : ext(project.branchUrl || entry.url, project.branchUrl ? 'View source' : 'View repository');
  const downloadTail = !mirror && file.archiveMethod ? '<i class="fas fa-download" aria-hidden="true"></i>' : project.compact ? `<span class="source-download-tail">(${size}) <i class="fas fa-download" aria-hidden="true"></i></span>` : `(${size}) <i class="fas fa-download" aria-hidden="true"></i>`;
  let card = resource(esc(project.title), description, `<a href="${esc(mirror?.local || source)}" ${mirror ? 'download' : 'target="_blank" rel="noopener noreferrer"'}>${downloadLabel} ${downloadTail}</a>${repositoryAction}`, project.image || '');
  if (project.edition) card = card.replace('</h3>', `</h3><span class="source-edition source-edition--${project.edition.toLowerCase()}">GTA 5 ${esc(project.edition)}</span>`);
  if (project.compact) card = card.replace('class="guide-resource"', 'class="guide-resource source-project-card" data-source-project')
    .replace('<p>' + description + '</p>', '')
    .replace(/data-search="[^"]*"/, `data-search="${esc([project.title, project.repo, project.edition].filter(Boolean).join(' ').toLowerCase())}"`);
  return project.compact ? card : card.replace('</article>', `${details}</article>`);
}

function unavailableSourceCard(project) {
  const empty = project.status === 'empty';
  const status = empty ? 'No files available' : 'Archive unavailable';
  return `<article class="guide-resource source-project-card" data-source-project data-search="${esc([project.title, project.repo, project.edition].filter(Boolean).join(' ').toLowerCase())}"><h3>${esc(project.title)}</h3>${project.edition ? `<span class="source-edition source-edition--${project.edition.toLowerCase()}">GTA 5 ${esc(project.edition)}</span>` : ''}<span class="source-availability">${status}</span></article>`;
}

function gtaPCContent() {
  const projects = require('../docs/gta5-pc-source-catalog.json').projects;
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'downloads/source-codes/gta5-pc/manifest.json'), 'utf8'));
  const cards = edition => projects.filter(project => project.edition === edition).map(project => {
    const file = manifest.files.find(file => file.id === project.id && file.commit === project.commit && file.status === 'downloaded' && file.backupPath);
    if (!file) return unavailableSourceCard(project);
    return archiveCard({...project, inventoryId: file.inventoryId, compact: true});
  });
  const legacy = cards('Legacy'), enhanced = cards('Enhanced');
  const menyooEntry = inventory.find(item => item.id === 'b28dff23dbd8');
  const menyooAvailable = menyooEntry?.files?.some(file => file.local && /source.*\.zip$/i.test(file.name) && fs.existsSync(path.join(root, file.local)));
  const menyoo = menyooAvailable
    ? archiveCard({title: 'MenyooSP', description: '', repo: 'itsjustcurtis/MenyooSP', inventoryId: 'b28dff23dbd8', compact: true})
    : `<article class="guide-resource source-project-card" data-source-project data-search="menyoo menyooSP gta 5"><h3>MenyooSP</h3><div class="guide-links">${link('/mods/gta5.html', 'GTA 5 mods & downloads')}</div></article>`;
  const count = legacy.length + enhanced.length + 1;
  const search = `<div class="source-project-search" data-source-search><label for="sourceProjectSearch">Search projects</label><div class="source-project-search-controls"><input id="sourceProjectSearch" type="search" placeholder="Search by name" autocomplete="off" aria-describedby="sourceProjectCount"><button type="button" id="sourceProjectReset" disabled>Clear</button></div><p id="sourceProjectCount" role="status" aria-live="polite">${count} projects shown</p><p id="sourceProjectEmpty" hidden>No matching projects.</p></div>`;
  const jumps = `<nav class="source-edition-nav" aria-label="GTA 5 editions"><a href="#legacy">Legacy <span>${legacy.length}</span></a><a href="#enhanced">Enhanced <span>${enhanced.length}</span></a></nav>`;
  const projectSection = (id, title, content) => section(id, title, content).replace('<section ', '<section data-source-project-section ');
  return section('editions', 'Choose your GTA 5 edition', jumps + search) +
    projectSection('enhanced', 'GTA 5 Enhanced', grid(...enhanced)) +
    projectSection('legacy', 'GTA 5 Legacy & GTA Online', grid(...legacy)) +
    projectSection('projects', 'More GTA 5 projects', grid(menyoo)) +
    section('source-collections', 'Source collections', `<div class="guide-links">${ext('https://github.com/GTA5dump?tab=repositories', 'Browse GTA5dump repositories')}</div>`);
}

sourcePage('source-codes/index.html', 'Source Codes', 'Browse source code by platform and project. Choose Console, PC or other development projects to get started.', [],
  section('categories', 'Choose a category', grid(
    directoryCard('Console', 'Console source code organized by platform, then game or tool.', base + 'console/', 'Browse consoles', 'console', 'Console / PS4 / GTA 5'),
    directoryCard('PC', 'PC game projects and desktop tool source code.', base + 'pc/', 'Browse PC source code', 'workstation', 'PC / Games & tools'),
    directoryCard('Other Projects', 'Graphics shaders and reusable development libraries.', base + 'other/', 'Browse other projects', 'code', 'Other / Graphics & libraries')
  )), '#categories', 'Browse categories');

sourcePage('source-codes/console/index.html', 'Console Source Codes', 'Choose a console to find game and tool source code for that platform.', consoleTrail,
  section('platforms', 'Choose a console', grid(
    directoryCard('PlayStation 4', 'GTA 5 modding files and GoldHEN plugin source code.', base + 'console/ps4/', 'Browse PS4 source code', 'console', 'Console / PS4'),
    directoryCard('Xbox 360', 'Xbox360PeerPressure project source.', base + 'console/xbox360/', 'Browse Xbox 360 source code', 'controller', 'Console / Xbox 360'),
    directoryCard('Steam Deck', 'Decky Loader project source.', base + 'console/steamdeck/', 'Browse Steam Deck source code', 'workstation', 'Console / Steam Deck')
  )), '#platforms', 'Choose a console');

sourcePage('source-codes/console/ps4/index.html', 'PS4 Source Codes', 'Choose a game or tool to browse PlayStation 4 source code and modding files.', ps4Trail,
  section('collections', 'Games & tools', grid(
    resource('GTA 5', 'Supplied GTA V 1.57 modding files and source-folder notes.', link(base + 'console/ps4/gta5/', 'Open GTA 5 source codes'), image),
    directoryCard('Tools & plugins', 'GoldHEN Plugins Repository source archive and project.', base + 'console/ps4/tools.html', 'Open PS4 tool sources', 'toolbox', 'Console / PS4 / Tools')
  )), '#collections', 'Browse PS4 collections');

const gtaTrail = [...ps4Trail, [base + 'console/ps4/gta5/', 'GTA 5']];
const sourceExtra = imported.legacyEnhancement('gta5', 'https://gofile.io/d/aENwykPu', 'sources');
sourceExtra.guide = sourceExtra.guide.replace(/Guide &amp; media|Guide & media/g, 'Source notes');
const gtaContent = section('downloads', 'PS4 source codes & modding files', grid(`<article class="guide-resource"><h3>GTA 5 PS4 modding files</h3><p>GTA V 1.57</p><p>The source folder returned HTTP 401 during the 2 November 2026 archive check. Its contents have not been verified or archived.</p><div class="guide-links"><a href="https://gofile.io/d/aENwykPu" class="btn btn-primary" target="_blank" rel="noopener noreferrer"><i class="fas fa-external-link-alt" aria-hidden="true"></i> Open source folder</a>${sourceExtra.guide}</div></article>`)) + imported.supplement('gta5', ['https://gofile.io/d/aENwykPu'], 'sources');
sourcePage('source-codes/console/ps4/gta5/index.html', 'GTA 5 PS4 Source Codes & Modding Files', 'Browse supplied GTA 5 PS4 modding files for game update 1.57, with the original source link and access notes.', gtaTrail, gtaContent, '#downloads', 'View source codes', {image});
// Keep the original URL and every imported guide anchor functional.
sourcePage('source-codes/games/gta5/ps4.html', 'GTA 5 PS4 Source Codes & Modding Files', 'Browse supplied GTA 5 PS4 modding files for game update 1.57, with the original source link and access notes.', gtaTrail, gtaContent, '#downloads', 'View source codes', {image, canonical: base + 'console/ps4/gta5/'});

for (const collection of catalog.collections) {
  sourcePage(collection.page, collection.title, collection.description, collection.trail,
    section('projects', collection.heading, grid(...collection.projects.map(archiveCard)), 'Archived source snapshots. Check the repository for build instructions and requirements.'), '#projects', 'Browse source projects');
}

sourcePage('source-codes/pc/index.html', 'PC Source Codes', 'Browse PC game source projects and desktop tool source archives.', pcTrail,
  section('collections', 'Games & tools', grid(
    resource('GTA 5 & GTA Online', 'Legacy and Enhanced source code: YimMenu V1, YimMenu V2, Impulse and more GTA5dump projects.', link(base + 'pc/gta5/', 'Open GTA 5 PC source codes'), '/assets/images/mods/menyoo.jpg'),
    directoryCard('Tools', 'Xenos and GuidedHacking Injector source archives.', base + 'pc/tools.html', 'Browse PC tool sources', 'toolbox', 'PC / Tools')
  )), '#collections', 'Browse PC collections');

sourcePage('source-codes/pc/gta5/index.html', 'GTA 5 PC Source Codes', 'GTA 5 and GTA Online source code for PC: YimMenu V1 Legacy, YimMenu V2 Enhanced, Impulse and more menu projects.', [...pcTrail, [base + 'pc/gta5/', 'GTA 5']],
  gtaPCContent(), '#editions', 'Browse source projects');

sourcePage('source-codes/games/gta5/index.html', 'GTA 5 Source Codes', 'Choose Console or PC to browse GTA 5 source projects and modding files.', [[base + 'games/gta5/', 'GTA 5']],
  section('platforms', 'Choose a platform', grid(
    resource('Console · PS4', 'Supplied GTA V 1.57 source-folder notes and modding-file guides.', link(base + 'console/ps4/gta5/', 'Open PS4 source codes'), image),
    resource('PC', 'GTA 5 Legacy and Enhanced: YimMenu V1, YimMenu V2, Impulse and other source projects.', link(base + 'pc/gta5/', 'Open PC source codes'), '/assets/images/mods/menyoo.jpg')
  )), '#platforms', 'Choose a platform');

console.log('Built ' + built.length + ' Source Codes pages with Console, PC and Other Projects categories.');
module.exports = {built};
