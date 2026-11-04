const fs = require('node:fs');
const path = require('node:path');
const {page, section, ext, link} = require('./build-console-guides.cjs');
const root = path.resolve(__dirname, '..');
const output = 'console/themes.html';
const escape = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const plain = value => String(value ?? '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
const text = value => Array.isArray(value) ? value.map(plain).join(' · ') : plain(value);
const size = bytes => bytes >= 1048576 ? (bytes / 1048576).toFixed(1) + ' MiB' : Math.ceil(bytes / 1024) + ' KiB';
const platforms = [
  {id:'switch', name:'Nintendo Switch', short:'Switch', icon:'fas fa-gamepad', file:'docs/themezer-switch-catalog.json', local:'/console/nintendo-switch/themes.html', collection:'https://themezer.net/switch/packs', extra:'https://themezer.net/switch/themes', kind:'Packs & individual menus', formats:'.nxtheme · theme pack ZIP', requirement:'A compatible CFW setup, NXThemes Installer and patches for your exact HOME Menu firmware.', guide:'https://switch.hacks.guide/homebrew/nxtheme-installer', method:'Copy the .nxtheme files to SD:/themes/, extract your own HOME Menu data when prompted, then install the selected menus and reboot into CFW.'},
  {id:'3ds', name:'Nintendo 2DS & 3DS', short:'2DS / 3DS', icon:'fas fa-gamepad', file:'docs/themezer-3ds-catalog.json', local:'/console/retro/3ds-themes.html', collection:'https://themezer.net/3ds/themes', kind:'HOME Menu themes', formats:'Theme ZIP · body_LZ.bin', requirement:'A homebrew-enabled 2DS or 3DS and a compatible theme manager such as Anemone3DS.', guide:'https://themezer.net/3ds/faq/what-are-the-best-theming-tools', method:'Use the theme manager’s documented SD folder and import flow. HOME Menu themes, Luma splashes and badge sets are separate content types.'},
  {id:'wiiu', name:'Nintendo Wii U', short:'Wii U', icon:'fas fa-gamepad', file:'docs/themezer-wiiu-catalog.json', local:'/console/retro/wiiu-themes.html', collection:'https://themezer.net/wiiu/themes', kind:'Wii U Menu themes', formats:'UTheme · theme bundle', requirement:'Aroma, Themiify and the StyleMiiU plugin; check the theme’s region, menu and language requirements.', guide:'https://themecafe.github.io/Docs/faq/', method:'Themiify and StyleMiiU load themes from SD:/wiiu/themes/. Follow the theme’s own format instructions and keep the original Wii U Menu files.'},
  {id:'ps3', name:'PlayStation 3', short:'PS3', icon:'fab fa-playstation', file:'docs/themezer-ps3-catalog.json', local:'/console/ps3/themes.html', collection:'https://themezer.net/ps3/themes', kind:'Static & dynamic themes', formats:'.p3t', requirement:'A PS3 with Theme Settings and a compatible P3T theme. Ordinary P3T theme installation does not require CFW or HEN.', guide:'https://manuals.playstation.net/document/en/ps3/current/settings/themesettings.html', method:'Put the P3T file in /PS3/THEME/ on a compatible USB drive, then open Settings → Theme Settings → Theme → Install on the PS3.'},
  {id:'psp', name:'PlayStation Portable', short:'PSP', icon:'fab fa-playstation', file:'docs/psp-more-catalogue.json', local:'/console/retro/psp.html', anchor:'#theme-setup', collection:'https://www.pspunk.com/psp-themes/', collectionLabel:'Theme distributor & credits', kind:'Native PTF & custom CTF themes', formats:'.ptf · .ctf', requirement:'Included PTF files target 6.60/6.61 official or custom firmware. The original 6.60 CTF builds require compatible CFW and CXMB enabled for VSH/XMB.', guide:'https://github.com/cello0314/CXMB', method:'Copy themes to ms0:/PSP/THEME/ (Memory Stick) or ef0:/PSP/THEME/ (Go internal). Apply PTF in Theme Settings; CTF also needs the matching firmware and CXMB. Follow the PSP page’s ARK-4 plugin instructions.'}
];

function localFile(url, base = root) {
  if (typeof url !== 'string' || !url.startsWith('/') || url.startsWith('//') || /[?#\\]/.test(url)) return null;
  let decoded;
  try { decoded = decodeURIComponent(url); } catch { return null; }
  const resolved = path.resolve(base, '.' + decoded);
  if (!resolved.startsWith(path.resolve(base) + path.sep)) return null;
  return fs.existsSync(resolved) && fs.statSync(resolved).isFile() ? resolved : null;
}

function sourceUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' ? parsed.href : null;
  } catch { return null; }
}

function previewUrl(url, base) {
  if (localFile(url, base)) return url;
  const remote = sourceUrl(url);
  return remote && ['img.themezer.net','cdn.themezer.net'].includes(new URL(remote).hostname) ? remote : null;
}

function loadThemes(base = root) {
  const records = [], warnings = [], seen = new Set();
  for (const platform of platforms) {
    const file = path.join(base, platform.file);
    if (!fs.existsSync(file)) continue;
    const catalogue = JSON.parse(fs.readFileSync(file, 'utf8'));
    const entries = platform.id === 'psp' ? catalogue.items.filter(item => item.category === 'Themes').map(item => ({...item, sourceUrl:item.source, image:`/assets/images/psp-more/${item.id}.jpg`, type:item.format + ' theme', requirements:item.compatibility, version:item.files[0].version, localDownload:item.files[0].local, bytes:item.files[0].bytes})) : Array.isArray(catalogue) ? catalogue : catalogue.themes || catalogue.items || [];
    for (const theme of entries) {
      const title = plain(theme.title || theme.name), url = sourceUrl(theme.sourceUrl || theme.url);
      if (!title || !url) { warnings.push(`${platform.id}: skipped theme without title/source`); continue; }
      const id = `${platform.id}-${theme.id || title}`;
      if (seen.has(id)) continue;
      seen.add(id);
      const download = typeof theme.localDownload === 'string' ? theme.localDownload : theme.localDownload?.local || theme.localDownload?.url;
      const downloadFile = localFile(download, base);
      const validDownload = downloadFile ? download : null;
      if (download && !validDownload) warnings.push(`${id}: local download is absent or invalid`);
      const image = previewUrl(theme.image, base);
      const rawType = plain(theme.type || theme.kind || (platform.id === 'switch' && /\/packs\//.test(url) ? 'Theme pack' : 'Theme'));
      const type = ({static:'Static theme', dynamic:'Dynamic theme', theme:'Theme', pack:'Theme pack'})[rawType.toLowerCase()] || rawType;
      records.push({...theme, id, title, sourceUrl:url, platform, image, localDownload:validDownload, type, author:plain(theme.author || theme.creator || 'See creator credits'), description:plain(theme.description), requirements:text(theme.requirements), version:plain(theme.version), bytes:theme.bytes || theme.localDownload?.bytes || (downloadFile ? fs.statSync(downloadFile).size : null)});
    }
  }
  return {records, warnings};
}

function collectionCard(platform, count) {
  const ready = localFile(platform.local);
  return `<article class="themes-console" id="${platform.id}"><div class="themes-console-heading"><i class="${platform.icon}" aria-hidden="true"></i><h3>${platform.name}</h3></div><p>${platform.kind}</p><span class="themes-format" translate="no">${platform.formats}</span><p class="themes-requirement">${escape(platform.requirement)}</p><div class="guide-links">${ready ? link(platform.local + (platform.anchor || ''), 'Themes & setup') : ''}${ext(platform.collection, platform.collectionLabel || (platform.id === 'switch' ? 'Themezer packs' : 'Browse Themezer'))}${platform.extra ? ext(platform.extra, 'Individual themes') : ''}</div>${count ? `<a class="themes-pick-link" href="?console=${platform.id}#themes">${count} theme${count === 1 ? '' : 's'} in this collection <i class="fas fa-arrow-right" aria-hidden="true"></i></a>` : ''}</article>`;
}

function themeCard(theme) {
  const platform = theme.platform;
  const description = theme.description.length > 150 ? theme.description.slice(0, 147).replace(/\s+\S*$/, '') + '…' : theme.description;
  const filetype = theme.localDownload ? path.extname(theme.localDownload).slice(1).toUpperCase() : '';
  const badges = [platform.short, theme.type].filter(Boolean);
  const search = [theme.title, theme.author, theme.description, theme.type, theme.requirements, text(theme.features), text(theme.tags), platform.name].join(' ');
  return `<article class="themes-card" id="theme-${escape(theme.id)}" data-theme-card data-platform="${platform.id}" data-kind="${escape(theme.type)}" data-search="${escape(search)}">
${theme.image ? `<a class="themes-preview" href="${escape(theme.sourceUrl)}" target="_blank" rel="noopener noreferrer" aria-label="Preview ${escape(theme.title)} at the source"><img src="${escape(theme.image)}" alt="${escape(theme.title)} preview by ${escape(theme.author)}" width="640" height="360" loading="lazy"></a>` : ''}
<div class="themes-card-content"><div class="themes-badges">${badges.map(badge => `<span>${escape(badge)}</span>`).join('')}</div><h3 translate="no">${escape(theme.title)}</h3><p class="themes-author">By <span translate="no">${escape(theme.author)}</span></p>${description ? `<p class="themes-description">${escape(description)}</p>` : ''}
${platform.id === 'switch' && /\b(?:SWITCH2|SW2)\b/i.test(theme.title) ? '<p class="themes-console-target">For the original Nintendo Switch.</p>' : ''}
<dl class="themes-meta">${theme.version ? `<div><dt>Version</dt><dd translate="no">${escape(theme.version)}</dd></div>` : ''}${theme.localDownload && theme.bytes ? `<div><dt>File</dt><dd translate="no">${filetype} · ${size(theme.bytes)}</dd></div>` : ''}</dl>
${theme.requirements ? `<details class="themes-compatibility"><summary>Compatibility & requirements</summary><p>${escape(theme.requirements)}</p></details>` : ''}
<div class="themes-actions">${theme.localDownload ? `<a class="btn btn-primary" href="${escape(theme.localDownload)}" download>Download ${escape(filetype)} <i class="fas fa-download" aria-hidden="true"></i></a>` : ''}${ext(theme.sourceUrl, 'Creator & details')}${localFile(platform.local) ? link(platform.local + (platform.anchor || ''), 'Install & requirements') : ext(platform.guide, 'Install instructions')}</div>
</div></article>`;
}

function buildConsoleThemes() {
  const {records, warnings} = loadThemes();
  const nav = [['/console/', 'Consoles'], ['/console/themes.html','Themes'], ...platforms.filter(platform => localFile(platform.local)).map(platform => [platform.local + (platform.anchor || ''), platform.short])];
  const types = [...new Set(records.map(theme => theme.type))].sort((a,b) => a.localeCompare(b));
  const collection = `<div class="themes-console-grid">${platforms.map(platform => collectionCard(platform, records.filter(theme => theme.platform.id === platform.id).length)).join('\n')}</div><div class="themes-directory"><div><h3>Browse more on Themezer</h3><p>Explore the community collections, or open a creator’s page for full credits and release notes.</p></div>${ext('https://themezer.net/', 'Open Themezer')}</div>`;
  const gallery = records.length ? section('themes', 'Themes to try', `<form class="themes-filter" role="search" data-themes-filter hidden><label class="themes-search">Search themes<input type="search" name="q" placeholder="Title, creator, game or style" data-theme-search autocomplete="off"></label><label>Console<select name="console" data-theme-platform><option value="">All consoles</option>${platforms.map(platform => `<option value="${platform.id}">${platform.short}</option>`).join('')}</select></label><label>Type<select name="kind" data-theme-kind><option value="">All types</option>${types.map(type => `<option value="${escape(type)}">${escape(type)}</option>`).join('')}</select></label><button type="reset" class="themes-reset">Clear filters</button></form><p class="themes-count" data-theme-count role="status" aria-live="polite">${records.length} themes</p><div class="themes-gallery">${records.map(themeCard).join('\n')}</div><p class="themes-empty" data-theme-empty hidden>No themes match these filters. Try another console or clear your search.</p>`, 'Creator previews and ready files where available. Open the installation page before choosing a theme for your system.') : '';
  const install = `<div class="themes-install-grid">${platforms.map(platform => `<article class="themes-install"><h3>${platform.name}</h3><p>${escape(platform.method)}</p><div class="guide-links">${localFile(platform.local) ? link(platform.local + (platform.anchor || ''), 'Full setup & recovery') : ''}${ext(platform.guide, 'Installation reference')}</div></article>`).join('')}</div>`;
  page(output, 'Console Themes', 'Browse themes for Switch, Wii U, 2DS, 3DS, PS3 and PSP, with creator previews, ready downloads and installation requirements.', '/assets/images/consoles/nintendo-switch.jpg', nav,
    section('collections','Choose your console',collection) + gallery + section('install','Install for your console',install), '#collections','Browse themes');
  const target = path.join(root, output);
  let html = fs.readFileSync(target, 'utf8');
  const mainIndex = html.indexOf('<main ');
  html = html.slice(0, mainIndex).replace(/\sactive(?=")/g, '').replace(/ aria-current="page"/g, '')
    .replace(/<li class="nav-group"><button([^>]*data-tooltip="Console"[^>]*)>/, (_, attributes) => `<li class="nav-group open"><button${attributes.replace('aria-expanded="false"','aria-expanded="true"')} aria-current="location">`) + html.slice(mainIndex);
  html = html.replace('<body class="console-guide"', '<body class="console-guide console-themes"')
    .replace('</head>', '<link rel="stylesheet" href="/assets/console-themes.css?v=2"><script defer src="/assets/console-themes.js?v=1"></script></head>')
    .replace('guide-hero-grid"><div>', 'guide-hero-grid guide-hero-text"><div>')
    .replace('<img src="/assets/images/consoles/nintendo-switch.jpg" alt="Console Themes" width="1280" height="720">','')
    .replace(/<meta name="keywords" content="[^"]*">/, '<meta name="keywords" content="console themes, Themezer, Nintendo Switch themes, NXThemes, theme packs, Wii U themes, UTheme, Themiify, StyleMiiU, 2DS themes, 3DS themes, Anemone3DS, PS3 themes, P3T themes, PSP themes, PTF themes, CTF themes, CXMB, theme setup">');
  const prepared = require('./apply-mobile-layout.cjs').improve(require('./apply-site-background.cjs').improve(html, target));
  fs.writeFileSync(target, require('./search-page-output.cjs').finish(output, prepared));
  const result = {page:output, themes:records.length, downloads:records.filter(theme => theme.localDownload).length, platforms:Object.fromEntries(platforms.map(platform => [platform.id,records.filter(theme => theme.platform.id === platform.id).length])), warnings};
  console.log(JSON.stringify(result, null, 2));
  return result;
}

module.exports = {buildConsoleThemes, loadThemes, localFile, platforms};
if (require.main === module) buildConsoleThemes();
