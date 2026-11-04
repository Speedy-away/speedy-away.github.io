const fs = require('node:fs');
const path = require('node:path');
const {page, section, note, steps, ext, link, sourceList} = require('./build-console-guides.cjs');
const root = path.resolve(__dirname, '..');
const esc = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const read = (file, fallback) => fs.existsSync(path.join(root, file)) ? JSON.parse(fs.readFileSync(path.join(root, file), 'utf8')) : fallback;
const size = bytes => bytes >= 1048576 ? (bytes / 1048576).toFixed(1) + ' MiB' : Math.ceil(bytes / 1024) + ' KiB';
const cataloguePage = '/console/nintendo-switch/apps.html';
const css = '<link rel="stylesheet" href="/assets/nintendo-switch-homebrew.css?v=2">';
const categoryUrl = category => cataloguePage + '?category=' + encodeURIComponent(category) + '#apps';
const icon = app => {
 const recovered=require('../docs/switch-homebrew-expansion-image-sources.json').images.find(image=>image.id===app.id&&image.recovery)?.file;
 return recovered || (fs.existsSync(path.join(root, 'assets/images/switch-homebrew', app.id + '.png')) ? '/assets/images/switch-homebrew/' + app.id + '.png' : '/assets/images/switch-homebrew/' + (app.category === 'Homebrew games' ? 'game' : 'network') + '.svg');
};
const updatedDate = value => {
  const [day, month, year] = value.split('/').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-GB', {timeZone:'UTC', day:'numeric', month:'short', year:'numeric'});
};

function storeCallout(app, hub = false) {
  return `<aside class="switch-store-callout" aria-label="Homebrew App Store"><img src="${icon(app)}" width="64" height="64" alt="Homebrew App Store icon"><div><h2>Homebrew App Store</h2><p>Find more community apps at hb-app.store, or install and update them directly on your Switch with the App Store NRO.</p>${hub ? `<div class="switch-section-links">${link(cataloguePage, 'Apps &amp; downloads')}${link(cataloguePage + '#install', 'Installation guide')}</div>` : ''}</div><a class="btn btn-primary" href="https://hb-app.store/" target="_blank" rel="noopener noreferrer">Open App Store <i class="fas fa-external-link-alt" aria-hidden="true"></i></a></aside>`;
}

function fileDetails(file) {
  if (!file) return '';
  return `<div class="switch-file"><strong translate="no">${esc(file.name)}</strong><span>${size(file.bytes)}</span><code translate="no">SHA-256: ${esc(file.sha256)}</code>${file.local ? `<a href="${esc(file.local)}" download>Download file</a> · ` : ''}${ext(file.source, 'Original file')}</div>`;
}

function card(app, downloaded) {
  const record = downloaded || {};
  const detail = require('./switch-app-page-content.cjs').find(entry => entry.id === app.id) || (app.id === 'appstore' ? {slug:'app-store'} : null);
  const primary = app.standaloneNro && record.officialNro || (record.requiresBundle ? record.package : record.nro || record.package);
  const local = primary?.local;
  const buildLabel = primary?.role === 'store-package' ? 'Download SD bundle' : 'Download NRO';
  const files = [record.nro, record.officialNro, record.package, record.officialBundle].filter(Boolean).filter((file, index, all) => all.findIndex(other => other.sha256 === file.sha256) === index);
  const allSearch = [app.title, app.category, app.version, ...app.tags, app.description, app.requirements, app.installPath].join(' ');
  return `<article class="switch-app" id="${esc(app.id)}" data-switch-app data-category="${esc(app.category)}" data-search="${esc(allSearch)}">
<header class="switch-app-head"><img src="${icon(app)}" alt="${esc(app.title)} ${app.id==='jumpnbump'?'gameplay screenshot':'icon'}" width="64" height="64" loading="lazy"><div><h3 translate="no">${esc(app.title)}</h3><div class="switch-app-category">${esc(app.category)}</div></div></header>
<p>${esc(app.description)}</p>
<dl class="switch-app-meta"><dt>Store build</dt><dd translate="no">${esc(app.version)}</dd><dt>Updated</dt><dd translate="no">${esc(updatedDate(app.updated))}</dd><dt>SD path</dt><dd><code>${esc(app.installPath)}</code></dd><dt>Requires</dt><dd>${esc(app.requirements)}</dd></dl>
<ul class="switch-app-tags" aria-label="Resource tags">${app.tags.map(tag => `<li>${esc(tag)}</li>`).join('')}</ul>
<div class="switch-app-actions">${detail ? `<a class="btn btn-outline" href="/console/nintendo-switch/${detail.slug}.html">Setup &amp; downloads</a>` : ''}${local ? `<a class="btn btn-primary" href="${esc(local)}" data-original-href="${esc(primary.source)}" download>${buildLabel} <span translate="no">(${size(primary.bytes)})</span></a>` : ext(app.packageUrl, 'Download store bundle')}${local && record.package?.local && primary.sha256 !== record.package.sha256 ? `<a href="${esc(record.package.local)}" download>Complete store ZIP</a>` : ''}</div>
<div class="switch-app-sources">${ext(app.storeUrl, 'Store entry')}${ext(app.project, 'Official project')}${app.officialReleaseUrl ? ext(app.officialReleaseUrl, app.officialVersion.replace(/^v/,'') !== app.version ? 'Upstream release ' + esc(app.officialVersion) : 'Release notes') : ''}</div>
<details><summary>Installation &amp; file details</summary><p style="margin-top:14px">${esc(app.install)}</p>${record.requiresBundle && !app.standaloneNro ? '<p>Use the complete SD bundle. Its companion files must stay in the supplied folders.</p>' : ''}${record.status === 'unavailable' ? `<p>Archive unavailable: ${esc(record.error)}. The original publisher links remain available.</p>` : ''}${files.map(fileDetails).join('')}${record.nroPaths?.length ? `<p style="margin-top:12px">NRO paths inside the store ZIP:</p><ul>${record.nroPaths.map(file => `<li><code>${esc(file)}</code></li>`).join('')}</ul>` : ''}</details></article>`;
}

function enhanceHub(catalogue) {
  const file = path.join(root, 'console/nintendo-switch.html');
  let html = fs.readFileSync(file, 'utf8');
  const begin = '<!-- BEGIN SWITCH HOMEBREW CATALOGUE -->';
  const end = '<!-- END SWITCH HOMEBREW CATALOGUE -->';
  const banner = `${begin}<div class="container switch-hub-banner">${storeCallout(catalogue.apps[0], true)}</div>${end}`;
  if (html.includes(begin)) html = html.replace(new RegExp(begin + '[\\s\\S]*?' + end), banner);
  else html = html.replace('<!-- Custom Firmware Section -->', banner + '\n<!-- Custom Firmware Section -->');
  if (!html.includes('/assets/nintendo-switch-homebrew.css')) html = html.replace('</head>', css + '\n</head>');
  const buttonBegin = '<!-- BEGIN SWITCH STORE BUTTONS -->', buttonEnd = '<!-- END SWITCH STORE BUTTONS -->';
  const buttons = `${buttonBegin}<a class="btn btn-outline" href="${cataloguePage}">Apps &amp; downloads</a><a class="btn btn-outline" href="/console/nintendo-switch/mods.html">Game mods</a><a class="btn btn-outline" href="https://hb-app.store/" target="_blank" rel="noopener noreferrer">Homebrew App Store <i class="fas fa-external-link-alt" aria-hidden="true"></i></a>${buttonEnd}`;
  if (html.includes(buttonBegin)) html = html.replace(new RegExp(buttonBegin + '[\\s\\S]*?' + buttonEnd), buttons);
  else html = html.replace('<div class="hero-buttons">', '<div class="hero-buttons">' + buttons);
  const sectionBegin = '<!-- BEGIN SWITCH APP PREVIEW -->', sectionEnd = '<!-- END SWITCH APP PREVIEW -->';
  const preview = `${sectionBegin}<div class="guide-note switch-catalogue-preview"><h3>${catalogue.apps.length} Switch apps, ready console builds</h3><p>Emulators, homebrew games, save managers, file transfer, media players and diagnostics. Browse verified versions, requirements, SD paths and checksums.</p><div class="switch-section-links">${link(cataloguePage + '#apps', 'Browse apps')}${link(categoryUrl('Emulators'), 'Emulators')}${link(categoryUrl('Homebrew games'), 'Homebrew games')}${link('/console/nintendo-switch/mods.html', 'Game mods')}${link(cataloguePage + '#install', 'Installation guide')}</div></div>${sectionEnd}`;
  if (html.includes(sectionBegin)) html = html.replace(new RegExp(sectionBegin + '[\\s\\S]*?' + sectionEnd), preview);
  else html = html.replace(/(<section class="section" id="homebrew">[\s\S]*?<div class="games-grid">)/, match => match.replace('<div class="games-grid">', preview + '<div class="games-grid">'));
  fs.writeFileSync(file, require('./search-page-output.cjs').finish(file, require('./apply-site-background.cjs').improve(html, file)));
}

function buildSwitchHomebrew() {
  const catalogue = read('docs/switch-homebrew-catalog.json');
  if (!catalogue?.apps?.length) throw Error('Switch homebrew catalogue is missing');
  const downloads = read('docs/switch-homebrew-downloads.json', {apps: []});
  const byId = Object.fromEntries(downloads.apps.map(app => [app.id, app]));
  const categories = [...new Set(catalogue.apps.map(app => app.category))];
  const nav = [['/console/nintendo-switch.html', 'Switch Hub'], [cataloguePage, 'Apps & downloads'], [categoryUrl('Emulators'), 'Emulators'], [categoryUrl('Homebrew games'), 'Homebrew games'], ['/console/nintendo-switch/mods.html', 'Game mods'], [cataloguePage + '#install', 'Installation guide'], [cataloguePage + '#storage', 'Storage & file formats'], ['/console/nintendo-switch.html#cfw', 'CFW & bootloader'], ['/console/nintendo-switch.html#firmware-downloads', 'Firmware archive']];
  const install = `<div class="switch-install-grid"><div>${steps([
    ['Start with an existing homebrew setup', 'Use the maintained Nintendo Homebrew guide for your exact Switch model. This catalogue assumes your console already runs a compatible CFW and can open hbmenu. An NRO is an app executable; copying one does not enable homebrew.'],
    ['Choose one installation route', 'For on-console installation, open Homebrew App Store and find the app. For manual installation, use the pinned NRO or SD bundle here. Compare the version and read its requirements before replacing an older build.'],
    ['Keep the supplied folders', 'Put standalone NRO files at the path shown on the card. For a complete store ZIP, extract its SD-layout files onto the microSD root, keeping <code>switch/</code>, <code>config/</code> and other runtime folders intact. Store <code>info.json</code> and <code>manifest.install</code> are package-manager metadata, not apps to launch.'],
    ['Open hbmenu with enough memory', 'Follow your CFW guide’s application-mode instructions. A common Atmosphère title-takeover setup opens hbmenu by holding R while starting an installed game and selecting a user. Album entry normally runs in restricted applet mode; use application mode when the project requires it.'],
    ['Launch, configure and keep backups', 'Select the app in hbmenu, then follow its project documentation. Configure network hosts, FTP credentials or game data where required. Back up saves and existing configuration files before restoring data or updating a bundle.']
  ])}<div class="guide-links">${ext('https://switch.hacks.guide/', 'Nintendo Homebrew setup guide')}${ext('https://github.com/fortheusers/hb-appstore#switch', 'App Store installation')}${ext('https://switch.hacks.guide/homebrew/', 'Homebrew file locations')}</div></div><figure class="switch-sd-map"><figcaption>Example microSD layout</figcaption><pre translate="no">microSD:/
├── hbmenu.nro
├── switch/
│   ├── appstore/
│   │   └── appstore.nro
│   ├── JKSV/
│   │   └── JKSV.nro
│   └── nxmp/
│       ├── nxmp.nro
│       └── [bundled resources]
└── config/
    └── ftpsrv/
        └── config.ini</pre></figure></div>`;
  const storage = `<p class="switch-intro">Use the card’s documented path and keep enough free space for extracted files, downloads and save backups. Safely eject the microSD before removing it. The Switch setup guide recommends FAT32; follow its formatting instructions for your existing card.</p><table class="switch-storage-table"><thead><tr><th scope="col">File type</th><th scope="col">Where it belongs</th></tr></thead><tbody><tr><th scope="row">NRO app</th><td>Usually <code>sdmc:/switch/&lt;app&gt;/&lt;app&gt;.nro</code>. The launcher itself is <code>sdmc:/hbmenu.nro</code>. Card-specific paths take priority.</td></tr><tr><th scope="row">Complete SD bundle</th><td>Extract the ZIP and preserve its runtime folder layout. NXMP, ftpsrv and the bundled games here require their supplied resources or configuration.</td></tr><tr><th scope="row">CFW / bootloader</th><td>Atmosphère, Hekate, BIN payloads and system modules use their own documented setup and compatibility. Use the existing <a href="/console/nintendo-switch.html#cfw">Switch CFW resources</a>.</td></tr><tr><th scope="row">Source code</th><td>GitHub source ZIP/TAR archives need a build toolchain. Use a documented Switch release asset or store package for installation.</td></tr><tr><th scope="row">PC / mobile helper</th><td>Moonlight’s Sunshine host and FTP clients run on your other device. Their Windows, Linux, macOS or Android builds do not go in <code>/switch/</code>.</td></tr></tbody></table><div class="guide-links">${ext('https://switch.hacks.guide/user_guide/all/sd_preparation.html', 'microSD preparation guide')}${link('/console/nintendo-switch.html#firmware-downloads', 'Switch firmware archive')}</div>`;
  const content = section('store', 'More apps, directly from the community', storeCallout(catalogue.apps[0])) +
    section('apps', 'Choose your Switch apps', `<p class="switch-intro">${esc(catalogue.compatibility)} The versions below are pinned to the checked store packages. The official projects may publish newer builds.</p><div class="switch-filters"><div><label for="switch-app-search">Search apps</label><input id="switch-app-search" data-switch-search type="search" placeholder="Search apps, tags or file formats..." autocomplete="off"></div><div><label for="switch-app-category">Category</label><select id="switch-app-category" data-switch-category><option value="">All categories</option>${categories.map(category => `<option value="${esc(category)}">${esc(category)}</option>`).join('')}</select></div></div><div class="switch-results"><span data-switch-count role="status" aria-live="polite">${catalogue.apps.length} apps</span><span>Checked 2 November 2026 · Nintendo Switch</span></div><div class="switch-app-grid">${catalogue.apps.map(app => card(app, byId[app.id])).join('\n')}</div><p class="switch-empty" data-switch-empty hidden>No results found matching your search.</p>`) +
    section('install', 'Install homebrew on your Switch', install) +
    section('emulator-setup', 'Set up an emulator', steps([
      ['Choose the Switch build and its launch mode', 'Use the Emulators category and check each card’s supported systems, release and memory requirements. Launch through full application mode when required. A legacy build with a documented current-system issue needs a compatible setup; its version is not a promise of support for every firmware.'],
      ['Keep the complete emulator package', 'An emulator may need fonts, shaders, configuration or other runtime assets beside its NRO. Extract a complete SD bundle with its supplied folders intact. A standalone NRO is offered only when the project supports that route.'],
      ['Prepare its system and game files', 'Follow the emulator’s linked documentation for your own game dumps and any BIOS or firmware it requires. These are separate from the app download. Match the supported formats and paths; a PSP emulator and a Nintendo DS emulator have different requirements.'],
      ['Test controls, saves and performance', 'Start with one title and configure controls and audio. Keep in-game saves backed up separately. Save states can depend on the emulator version and are not a replacement for portable save backups.']
    ]) + `<div class="guide-links">${link(categoryUrl('Emulators'), 'Emulators')}${link('/console/nintendo-switch/mods.html', 'Game mods')}${link('/pc/nintendo-emulators.html', 'Nintendo emulators for PC')}</div>`) +
    section('storage', 'Storage &amp; file formats', storage) +
    section('sources', 'Build verification &amp; sources', `<div class="switch-provenance"><p>This is a curated selection from the Switch catalogue linked by <a href="https://hb-app.store/" target="_blank" rel="noopener noreferrer">hb-app.store</a>. Package versions, project links and icons were checked against the store metadata and linked official projects on 2 November 2026.</p><p>Downloaded ZIPs were inspected for their file layout and NRO headers. Original containers and ready console builds are retained with sizes, versions and SHA-256 checksums. Companion files remain bundled where required. These checks do not establish physical-console compatibility; installation and execution on a Switch have not been tested here.</p><p>Apps with no documented current firmware range are labelled in their requirements. The 90DNS tester store package remains pinned to 1.0.4 even though its project has a 1.1.0 release. Checkpoint uses the Switch NRO, separately from its 3DS builds.</p><p>App icons belong to their respective projects. The green library illustration is original artwork created for this site.</p></div>` + sourceList([['https://hb-app.store/', 'Homebrew App Store · platform directory'], ['https://switch.cdn.fortheusers.org/repo.json', 'Switch catalogue · package metadata'], ['https://github.com/fortheusers/hb-appstore', 'Homebrew App Store · project and install documentation'], ['https://switch.hacks.guide/homebrew/', 'Nintendo Homebrew · NRO and sysmodule file locations']]) + `<div class="guide-links">${link('/docs/switch-homebrew-catalog.json', 'Catalogue metadata')}${link('/docs/switch-homebrew-downloads.json', 'File checksums &amp; package contents')}</div>`);
  page('console/nintendo-switch/apps.html', 'Nintendo Switch Apps & Homebrew', 'A curated Switch homebrew library: ready NRO downloads, complete SD bundles, save tools, file transfer, media, diagnostics and games.', '/assets/images/switch-homebrew/library.svg', nav, content, '#apps', 'Browse apps');
  const file = path.join(root, 'console/nintendo-switch/apps.html');
  let html = fs.readFileSync(file, 'utf8');
  html = html.replace('</head>', css + '\n</head>').replace('</body>', '<script defer src="/assets/nintendo-switch-homebrew.js?v=2"></script></body>');
  html = html.replace('<a class="btn btn-outline" href="/pc/">PC</a>', '<a class="btn btn-outline" href="https://hb-app.store/" target="_blank" rel="noopener noreferrer">Open App Store</a>');
  html = html.replace(/class="nav-link nav-sublink active" aria-current="page"/g, 'class="nav-link nav-sublink"').replace('href="/console/nintendo-switch.html" class="nav-link nav-sublink"', 'href="/console/nintendo-switch.html" class="nav-link nav-sublink active" aria-current="page"');
  const keywords = ['Nintendo Switch', 'Switch homebrew', 'NRO downloads', 'Homebrew App Store', 'hb-app.store', ...catalogue.apps.flatMap(app => [app.title, app.category, ...app.tags])];
  html = html.replace(/<meta name="keywords" content="[^"]*">/, `<meta name="keywords" content="${esc([...new Set(keywords)].join(', '))}">`);
  const structured = { '@context':'https://schema.org', '@type':'CollectionPage', name:'Nintendo Switch Apps & Homebrew', url:'https://whatwhatboy.com' + cataloguePage, dateModified:catalogue.verifiedAt.slice(0,10), mainEntity:{'@type':'ItemList',numberOfItems:catalogue.apps.length,itemListElement:catalogue.apps.map((app,index)=>({'@type':'ListItem',position:index+1,url:'https://whatwhatboy.com'+cataloguePage+'#'+app.id,name:app.title}))}};
  html = html.replace('</head>', `<script type="application/ld+json">${JSON.stringify(structured).replaceAll('<', '\\u003c')}</script>\n</head>`);
  fs.writeFileSync(file, require('./search-page-output.cjs').finish(file, require('./apply-site-background.cjs').improve(html, file)));
  if (fs.existsSync(path.join(root, 'docs/switch-app-pages.json')) && read('docs/switch-app-pages.json').apps.length === require('./switch-app-page-content.cjs').length) require('./build-switch-app-pages.cjs').build();
  enhanceHub(catalogue);
  // Re-read immediately before the small additive sitemap edit.
  const sitemapPath = path.join(root, 'sitemap.xml');
  let sitemap = fs.readFileSync(sitemapPath, 'utf8');
  const canonical = 'https://whatwhatboy.com' + cataloguePage;
  if (!sitemap.includes('<loc>' + canonical + '</loc>')) {
    sitemap = sitemap.replace('</urlset>', `  <url><loc>${canonical}</loc><lastmod>${catalogue.verifiedAt.slice(0,10)}</lastmod></url>\n</urlset>`);
    fs.writeFileSync(sitemapPath, sitemap);
  }
  return {apps:catalogue.apps.length,pages:['console/nintendo-switch.html','console/nintendo-switch/apps.html']};
}
if (require.main === module) console.log('Built Switch homebrew:', buildSwitchHomebrew());
module.exports = {buildSwitchHomebrew};
