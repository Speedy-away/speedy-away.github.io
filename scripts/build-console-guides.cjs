const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const esc = s => s.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
const template = fs.readFileSync(path.join(root, fs.existsSync(path.join(root,'console/index.html'))?'console/index.html':'scripts/templates/host-page.html'), 'utf8');
const sidebar = require('./sidebar-icons.cjs').decorateNavLinks(template.slice(template.indexOf('    <!-- Sidebar Navigation -->'), template.indexOf('    <!-- Main Content -->')).replace(/((?:href|src)=")([^"]*)"/g, (all, prefix, value) => {
  if (/^(?:https?:|mailto:|#)/.test(value)) return all;
  const resolved = new URL(value, 'https://whatwhatboy.com/console/index.html');
  if (resolved.pathname === '/console/ps3.html') resolved.pathname = '/console/ps3/';
  if (resolved.pathname === '/console/xbox360.html') resolved.pathname = '/console/xbox360/';
  return prefix + resolved.pathname + resolved.search + resolved.hash + '"';
}));
const ext = (url, label) => `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${label} <i class="fas fa-external-link-alt" aria-hidden="true"></i></a>`;
const link = (url, label) => `<a href="${esc(url)}"${/^\/(?!\/)/.test(url) && require('../assets/console-guide-dialog.js').isModGuidePath(url.split(/[?#]/)[0]) && /\b(?:guide|setup|checklist)\b/i.test(label) ? ' data-guide-open' : ''}>${label} <i class="fas fa-arrow-right" aria-hidden="true"></i></a>`;
const guideLink = (url, label = 'View guide') => `<a href="${esc(url)}" data-guide-open>${label} <i class="fas fa-arrow-right" aria-hidden="true"></i></a>`;
const github = (repo, label = 'Releases') => ext(`https://github.com/${repo}/releases`, label);
function resource(title, description, links, image = '') {
  const artwork = !image ? '' : typeof image === 'string'
    ? `<img src="${image}" alt="${esc(title)} artwork" loading="lazy">`
    : require('./console-card-media.cjs').cardMedia(image);
  return `<article class="guide-resource" data-search="${esc(title.toLowerCase() + ' ' + description.toLowerCase())}">${artwork}<h3>${title}</h3><p>${description}</p><div class="guide-links">${links}</div></article>`;
}
const grid = (...cards) => `<div class="games-grid">${cards.join('\n')}</div>`;
const section = (id, title, content, subtitle = '') => `<section class="section" id="${id}"><div class="container"><div class="section-header"><h2 class="section-title">${title}</h2>${subtitle ? `<p class="section-subtitle">${subtitle}</p>` : ''}</div>${content}</div></section>`;
const guideSection = (id, title, content, subtitle = '') => section(id, esc(title), content, subtitle).replace('<section ', `<section data-guide-panel data-guide-title="${esc(title)}" `);
const note = html => `<aside class="guide-note">${html}</aside>`;
const steps = items => `<ol class="guide-steps">${items.map(([title, text]) => `<li><strong>${title}</strong>${text}</li>`).join('')}</ol>`;
const video = (id, title) => `<a class="guide-video" href="https://www.youtube.com/watch?v=${id}" target="_blank" rel="noopener noreferrer"><img src="https://i.ytimg.com/vi/${id}/hqdefault.jpg" alt="Video: ${esc(title)}" loading="lazy"><span><i class="fab fa-youtube" aria-hidden="true"></i> Watch: ${title}</span></a>`;
const videoEmbed = (id, title, startSeconds = 0) => {
  if (!/^[\w-]{11}$/.test(id)) throw new Error('Invalid YouTube video ID');
  if (!Number.isSafeInteger(startSeconds) || startSeconds < 0) throw new Error('Invalid YouTube start time');
  const start = startSeconds ? `&amp;start=${startSeconds}` : '';
  const watchStart = startSeconds ? `&amp;t=${startSeconds}s` : '';
  return `<figure class="guide-video guide-video-embed"><iframe class="guide-video-player" width="760" height="428" src="https://www.youtube-nocookie.com/embed/${id}?playsinline=1&amp;rel=0&amp;autoplay=0${start}" title="${esc(title)}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allow="encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe><figcaption><a href="https://www.youtube.com/watch?v=${id}${watchStart}" target="_blank" rel="noopener noreferrer"><i class="fab fa-youtube" aria-hidden="true"></i> Watch on YouTube: ${esc(title)}</a></figcaption></figure>`;
};
const sourceList = links => `<ul class="guide-source-list">${links.map(([url, label]) => `<li>${ext(url, label)}</li>`).join('')}</ul>`;
const hostSection = platform => {
  const catalog = require('../docs/console-exploit-hosts.json');
  const hosts = catalog.platforms[platform];
  const cards = hosts.map(host => `<a class="guide-host" href="${esc(host.url)}" target="_blank" rel="noopener noreferrer"><img src="${esc(host.image)}" alt="" width="128" height="80" loading="lazy"><h3 class="guide-host-label">${esc(host.label)}</h3><span class="guide-host-tags">${host.tags.map(tag => `<span class="feature-tag">${esc(tag)}</span>`).join('')}</span></a>`).join('\n');
  const source = platform === 'ps5' ? '' : `<div class="guide-links guide-host-source">${ext(catalog.sources[platform], `View ${platform.toUpperCase()} host directory`)}</div>`;
  return section('exploit-hosts', 'Exploit &amp; Redirect Hosts', `<div class="guide-host-grid">${cards}</div>${source}`, esc(catalog.seo[platform].intro));
};
const ps5nav = [['/console/ps5/', 'PS5 Hub'], ['/console/ps5/jailbreaks.html', 'Jailbreak'], ['/console/ps5/y2jb.html', 'Y2JB Setup'], ['/console/ps5/downloads.html', 'Console Downloads'], ['/console/ps5/payloads.html', 'Payloads'], ['/console/ps5/transfer-tools.html', 'Transfer Tools'], ['/console/ps5/apps.html', 'Apps'], ['/console/ps5/emulators.html', 'PS5 Emulators'], ['/console/ps5/mods.html', 'Mods / Mod Menus']];
const ps4nav = [['/console/ps4/', 'PS4 Hub'], ['/console/ps4/jailbreaks.html', 'Jailbreak'], ['/console/ps4/goldhen.html', 'GoldHEN'], ['/console/ps4/downloads.html', 'Console Downloads'], ['/console/ps4/payloads.html', 'Payloads'], ['/console/ps4/apps.html', 'Apps'], ['/console/ps4/emulators.html', 'PS4 Emulators'], ['/console/ps4/#save-tools', 'Save Tools'], ['/console/mods/ps4/', 'Mods / Mod Menus']];
for (const [platform, nav] of [['ps4', ps4nav], ['ps5', ps5nav]]) {
  if (platform === 'ps4') nav.splice(nav.findIndex(([url]) => url.endsWith('/apps.html')), 0, ['/console/ps4/transfer-tools.html', 'Transfer Tools']);
  nav.push([`/console/${platform}/game-patches.html`, 'Game patches'], [`/console/${platform}/themes.html`, 'Themes'], [`/console/${platform}/site-launcher.html`, 'Site launcher']);
  nav.splice(2, 0, [`/console/${platform}/jailbreaks.html#firmware-downloads`, 'Firmware']);
}
const softwareImage = (id, fallback) => {
  const file = path.join(root, 'docs/console-software-images.json');
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8'))[id]?.image || fallback : fallback;
};
const goldhen14Download = () => {
  const data = require('../docs/ps4-goldhen14.json');
  const file = data.file;
  const size = (file.bytes / 1048576).toFixed(1) + ' MiB';
  return `<a href="${esc(file.local)}" data-original-href="${esc(data.jobs[0].url)}" download>Download GOLDHEN14.iso (${size}) <i class="fas fa-download" aria-hidden="true"></i></a>`;
};
const goldhen14Card = () => resource('GoldHEN 14.00 · supplied ISO', 'Supplied GOLDHEN14.iso disc image for the PS4 14.00 resources. Publisher identity and firmware compatibility have not been independently verified.', goldhen14Download() + link('/console/ps4/jailbreak.html#disc', 'Disc setup guide'), '/assets/images/consoles/ps4-jailbreak.jpg');
const ps5Resources = () => grid(
  resource('Jailbreak', 'Choose your firmware: UMTX2 on listed 1.00–5.50 versions, the 6.00–7.61 Blu-ray route, or Relapse on supported 7.00–13.60 versions.', link('/console/ps5/jailbreaks.html', 'Choose your firmware'), '/assets/images/consoles/ps5-featured-image.avif'),
  resource('Firmware downloads', 'Browse PS5 system-software update and recovery files by version in Darthsternie’s firmware archive.', link('/console/ps5/jailbreaks.html#firmware-downloads', 'Browse PS5 firmware'), '/assets/images/consoles/ps5-featured-image.avif'),
  resource('Y2JB setup & autoloader', 'After initial jailbreak access, prepare YouTube with the installer and configure a firmware-compatible autoloader.', link('/console/ps5/y2jb.html', 'Open Y2JB page'), '/assets/images/consoles/ps5-y2jb.jpg'),
  resource('Payloads', 'etaHEN, ShadowMountPlus, ELF loaders and kernel-log payloads for PS5.', link('/console/ps5/payloads.html', 'Browse payloads'), require('./console-card-media.cjs').ps5Media.payloads),
  resource('Transfer tools', 'Move files with PS5upload, ezRemote, FTP and web services. Check each tool’s console setup before connecting.', link('/console/ps5/transfer-tools.html', 'Browse transfer tools'), require('./console-card-media.cjs').ps5Media.transfers),
  resource('Apps & homebrew stores', 'PlaydenPS5, Orbit, ProsperoStore, payload managers, media players and save tools for PS5.', link('/console/ps5/apps.html', 'Browse apps'), require('./console-card-media.cjs').ps5Media.apps),
  resource('Emulators on PS5', 'PS2, GameCube, Wii, Wii U, Xbox, Xbox 360 and multi-system projects that run on a homebrew-enabled PS5.', link('/console/ps5/emulators.html', 'Browse emulators'), '/assets/images/emulators/retroarch.png'),
  resource('Mods / Mod Menus', 'Call of Duty, GTA V and Red Dead Redemption 2 mod menus, screenshots and game-specific setup guides.', link('/console/ps5/mods.html', 'Browse game mods'), require('./console-card-media.cjs').ps5Media.mods)
);
const ps4Resources = () => grid(
  resource('Jailbreak', 'Choose a firmware-specific guide: the experimental 14.00 route or the browser tutorial for 13.52 or lower.', link('/console/ps4/jailbreaks.html', 'Choose your firmware'), '/assets/images/consoles/playstation.jpg'),
  resource('Firmware downloads', 'Browse PS4 system-software update and recovery files by version in Darthsternie’s firmware archive.', link('/console/ps4/jailbreaks.html#firmware-downloads', 'Browse PS4 firmware'), '/assets/images/consoles/playstation.jpg'),
  resource('GoldHEN', 'Official GoldHEN release resources and the separately supplied 14.00 HEN ISO, with firmware and download notes.', link('/console/ps4/goldhen.html', 'Open GoldHEN page'), softwareImage('goldhen', '/assets/images/consoles/playstation.jpg')),
  resource('Payloads & transfer tools', 'FTP servers, debugging payloads, kernel logs and firmware-specific loader resources.', link('/console/ps4/payloads.html', 'Browse payloads'), '/assets/images/expansion-ps4-ps5/payload-guest.png'),
  resource('Apps & utilities', 'Homebrew stores, file managers, package installers and save tools for PS4.', link('/console/ps4/apps.html', 'Browse apps'), '/assets/images/expansion-ps4-ps5/homebrew-store.png'),
  resource('Emulators on PS4', 'PS2, PS3, Wii, GameCube, Wii U and Dreamcast projects, plus installation requirements and source links.', link('/console/ps4/emulators.html', 'Browse emulators'), '/assets/images/emulators/retroarch.png'),
  resource('Mods / Mod Menus', 'GTA V, Red Dead Redemption 2 and Call of Duty collections with menu previews and setup guides.', link('/console/mods/ps4/', 'Browse game mods'), '/assets/images/ps4-gta5/oxagon.png')
);
function page(file, title, description, image, nav, content, primary = '#content', primaryLabel = 'Explore') {
  const reviewed = new Date().toLocaleDateString('en-GB', { timeZone: 'Europe/London', day: 'numeric', month: 'long', year: 'numeric' });
  const isSource = file.startsWith('source-codes/');
  const isDownloads = file.startsWith('downloads/');
  const isPhoneHelp = file === 'guides/phone-downloads/index.html';
  const hasHosts = /^console\/ps[45]\/index\.html$/.test(file);
  const textOnlyHero = file === 'downloads/index.html' || file === 'guides/phone-downloads/index.html' || file === 'console/mods/index.html' || file === 'console/mods/ps4/index.html' || file === 'console/ps5/index.html' || file === 'console/retro/index.html' || /^console\/ps[45]\/(?:payloads|apps|mods|downloads|goldhen|jailbreaks|transfer-tools)\.html$/.test(file) || /^console\/(?:ps3|xbox360)\/(?:index|jailbreaks|apps|tools|payloads|transfer-tools|downloads|mods|save-tools|emulators|hardware|dashboards)\.html$/.test(file) || /^console\/psvita\/(?:apps|jailbreak|cfw)\.html$/.test(file);
  const hostCatalog = hasHosts ? require('../docs/console-exploit-hosts.json') : null;
  const hostPlatform = hasHosts ? file.split('/')[1] : null;
  const seo = hasHosts ? hostCatalog.seo[hostPlatform] : null;
  const keywords = hasHosts ? [...new Set([...seo.keywords, ...hostCatalog.platforms[hostPlatform].flatMap(host => [host.label, ...host.tags]), 'homebrew', 'console guides'])].join(', ') : `${title}, homebrew, console guides`;
  const url = `https://whatwhatboy.com/${file.replace(/index\.html$/, '')}`;
  let currentSidebar = sidebar.replace(/nav-link nav-sublink active/g, 'nav-link nav-sublink').replace(/ aria-current="page"/g, '').replace(/class="nav-group open"/g, 'class="nav-group"').replace(/aria-expanded="true"/g, 'aria-expanded="false"');
  const activeTarget = isSource ? '/source-codes/index.html' : file.startsWith('console/psvita/') ? '/console/psvita/index.html' : file.startsWith('console/ps3/') ? '/console/ps3/' : file.startsWith('console/xbox360/') ? '/console/xbox360/' : file.startsWith('console/retro/') ? '/console/retro/index.html' : file.startsWith('console/mods/') ? '/console/mods/index.html' : file.startsWith('console/ps5/') ? '/console/ps5/index.html' : file.startsWith('console/ps4/') ? '/console/ps4/index.html' : '/pc/index.html';
  currentSidebar = currentSidebar.replace(`href="${activeTarget}" class="nav-link nav-sublink"`, `href="${activeTarget}" class="nav-link nav-sublink active" aria-current="page"`);
  if (isDownloads) currentSidebar = currentSidebar.replace(/class="nav-link nav-sublink active" aria-current="page"/g, 'class="nav-link nav-sublink"').replace('href="/tools/index.html" class="nav-link"', 'href="/tools/index.html" class="nav-link active" aria-current="page"');
  if (isPhoneHelp) currentSidebar = currentSidebar.replace(/class="nav-link nav-sublink active" aria-current="page"/g, 'class="nav-link nav-sublink"').replace('href="/pages/help.html" class="nav-link"', 'href="/pages/help.html" class="nav-link active" aria-current="location"');
  const html = `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="dark"><meta name="theme-color" content="#0a0a0c">
<title>${esc(seo ? seo.title : `${title} | whatwhatboy`)}</title>
<meta name="description" content="${esc(seo ? seo.description : description)}"><meta name="keywords" content="${esc(keywords)}">
<link rel="canonical" href="${url}"><meta name="robots" content="index, follow">
<meta property="og:image" content="https://whatwhatboy.com${image}">
<link rel="icon" href="/assets/images/logo.png" type="image/png">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
<link rel="stylesheet" href="/style.css?v=3.1.23"><link rel="stylesheet" href="/assets/console-guides.css?v=10">
<script defer src="/languages/i18n.js?v=3"></script></head>
<body class="console-guide">${currentSidebar}
<main class="main-content" id="main-content">
<header class="guide-hero"><div class="container guide-hero-grid${textOnlyHero ? ' guide-hero-text' : ''}"><div>
<div class="guide-breadcrumb"><a href="/">Home</a> / <a href="${isPhoneHelp ? '/pages/help.html' : isDownloads ? '/tools/' : isSource ? '/source-codes/' : file.startsWith('pc/') ? '/pc/' : '/console/'}">${isPhoneHelp ? 'Help' : isDownloads ? 'Tools' : isSource ? 'Source Codes' : file.startsWith('pc/') ? 'PC' : 'Console'}</a></div>
<h1>${title}</h1><p>${description}</p><div class="hero-buttons"><a class="btn btn-primary" href="${primary}">${primaryLabel}</a>${isSource || isDownloads || isPhoneHelp ? '' : `<a class="btn btn-outline" href="${file.startsWith('pc/') ? '/console/' : '/pc/'}">${file.startsWith('pc/') ? 'Console' : 'PC'}</a>`}</div>
</div>${textOnlyHero ? '' : `<img src="${image}" alt="${esc(title)}" width="1280" height="720">`}</div></header>
<div class="container"><nav class="guide-nav" aria-label="${isPhoneHelp ? 'Phone download help' : isDownloads ? 'Download library' : isSource ? 'Source code' : file.startsWith('pc/') ? 'PC' : 'Console'} pages">${hasHosts ? '<a href="#exploit-hosts">Exploit &amp; Redirect Hosts</a>' : ''}${nav.map(([u, t]) => `<a href="${u}"${u === '/' + file || u === '/' + file.replace(/index\.html$/, '') ? ' aria-current="page"' : ''}>${t}</a>`).join('')}</nav></div>
<div id="content">${content}</div>
<footer class="guide-footer"><div class="container">${isPhoneHelp ? 'Saving steps vary by browser and file type. Browser help is linked above.' : isDownloads ? 'Menus, scripts, tools and source-code downloads.' : isSource ? 'Game source-code collections and project links.' : `Reviewed ${reviewed}. Check each project's release notes for firmware and installation requirements.`} <a href="/pages/contact.html">Report a broken link</a>.</div></footer>
</main><script src="/script.js?v=3.1.21"></script><script defer src="/assets/console-guide-dialog.js?v=5"></script></body></html>`;
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  const prepared = require('./page-search-tags.cjs').apply(file, require('./guide-popup-policy.cjs').applyGuidePopupPolicy(file, require('./console-game-directories.cjs').apply(file, require('./console-hubs.cjs').improveHub(file, html))));
  const output = require('./apply-mobile-layout.cjs').improve(require('./sidebar-icons.cjs').applySidebarIcons(file, require('./site-ads.cjs').applyAds(file, prepared)));
  fs.writeFileSync(path.join(root, file), require('./search-page-output.cjs').finish(file, output));
}
// Catalogue metadata can reference these helpers while this CLI is building.
module.exports = {page, section, guideSection, grid, resource, note, steps, video, videoEmbed, ext, link, guideLink, sourceList, esc, hostSection, ps5Resources, ps4Resources, ps5nav, ps4nav, goldhen14Card, goldhen14Download};
if (require.main === module) {
const ps5image = '/assets/images/consoles/ps5-relapse.jpg';
const ps4image = '/assets/images/consoles/ps4-jailbreak.jpg';
const dns = () => `<dl class="guide-dns"><div><dt>Primary DNS</dt><dd><code>45.56.67.85</code></dd></div><div><dt>Secondary DNS</dt><dd><code>62.210.38.117</code></dd></div></dl>` + require('./console-dns-notice.cjs').notice();
const provenance = '<p>The videos are linked as viewing companions. The written steps below use the project documentation; a video transcript was not available for verification.</p>';

page('console/ps5/index.html', 'PlayStation 5 Homebrew', 'Relapse, Y2JB, payloads, apps and native console emulators. Start with your firmware, then choose a guide.', ps5image, ps5nav,
hostSection('ps5') + require('./build-console-downloads.cjs').intro('ps5') +
section('start', 'PS5 guides & downloads', ps5Resources(), 'Start with Jailbreak to choose your firmware. Each route has its own requirements; Y2JB installer setup follows initial homebrew access.') + section('sources', 'Compatibility sources', sourceList([['https://github.com/idlesauce/umtx2', 'UMTX2 browser route'], ['https://github.com/hammer-83/ps5-jar-loader', 'Blu-ray / BD-J requirements'], ['https://github.com/soniciso1/relapse', 'Relapse firmware list and payload loader']])), '#start', 'Choose a guide');

page('console/ps5/relapse.html', 'PS5 Jailbreak · 7.00–13.60', 'Use Relapse on its listed PS5 firmware versions, with manual DNS, browser access and payload-loader instructions. Excludes 9.05, 10.60 and 11.40.', ps5image, ps5nav,
section('compatibility', 'Before you start', note('<p><strong>Firmware support is specific.</strong> The linked Relapse build supports listed versions from 7.00 to 13.60. It does not list 9.05, 10.60 or 11.40. Firmware below 7.00 needs a different compatible entry point.</p><p>Find your version under Settings &gt; System &gt; System Software &gt; Console Information. Keep it unchanged while checking compatibility. DNS changes alone do not jailbreak the console.</p>') + sourceList([['https://github.com/soniciso1/relapse', 'Check the exact supported firmware list']] )) +
section('dns', 'Set manual DNS on PS5', dns() + steps([
['Open your connection settings', 'Go to Settings &gt; Network &gt; Settings &gt; Set Up Internet Connection. Highlight the Wi-Fi or wired connection you use.'],
['Open Advanced Settings', 'Press the Options button for the saved connection and select Advanced Settings. For a new connection, use Set Up Manually.'],
['Change DNS Settings to Manual', 'Enter <code>45.56.67.85</code> as Primary DNS and <code>62.210.38.117</code> as Secondary DNS. Keep your existing IP, DHCP, MTU and proxy settings.'],
['Save and reconnect', 'Confirm the settings and reconnect. Record your old settings first so you can restore DNS Settings to Automatic later.'],
['Open the entry point', 'Open Settings &gt; User’s Guide, Health &amp; Safety, and Other Information &gt; User’s Guide. If the chosen DNS host redirects it, its host menu appears. Host availability can change; DNS is not a guarantee of update blocking.']
]) + sourceList([['https://www.playstation.com/en-gb/support/connectivity/internet-connect-playstation/', 'PlayStation network settings reference']])) +
section('relapse', 'Run Relapse and load a payload', steps([
['Choose the matching Relapse host', 'From the host menu choose the PS5 Relapse option for your exact firmware. If you already have browser access, the project also provides a direct host link below.'],
['Let the exploit complete', 'Leave the console on the page until it shows success or the payload menu. A crash or failure is not success; restart normally and retry the matching instructions.'],
['Load a compatible homebrew payload', 'Use the host payload menu for a build explicitly supporting your firmware. An ELF loader on port <code>9021</code> is the hand-off point for payload tools.'],
['Check before adding more', 'Confirm the first payload works before setting up Y2JB, a store or an emulator. Recheck requirements after changing any payload version.']
]) + `<div class="guide-links">${ext('https://soniciso1.github.io/relapse/', 'Relapse host')}${github('etaHEN/etaHEN', 'etaHEN releases')}${link('/console/ps5/y2jb.html', 'Next: Y2JB')}</div>` ) +
section('downloads', 'Companion downloads', grid(resource('DNS tool', 'Download supplied with the guide. Check the archive contents and instructions before using it.', ext('https://gofile.io/d/XzXVFnOo', 'DNS tool')),resource('etaHEN', 'Use a build supporting your exact firmware. The project releases are the reference; the supplied mirror is also linked.', github('etaHEN/etaHEN') + ext('https://gofile.io/d/ZZz79gu8', 'Supplied mirror'))) + note('<p>The supplied MediaFire DNS-tool mirror was incomplete, so it is not used as a download link.</p>')) +
section('video', 'Relapse video guide', videoEmbed('HqF1rmvA2iE', 'How to Jailbreak the PS5 with Relapse (13.60 or lower)') + note(provenance)) +
section('sources', 'Project documentation', sourceList([['https://github.com/soniciso1/relapse', 'Relapse support and loader behavior'], ['https://github.com/etaHEN/etaHEN', 'etaHEN requirements']])), '#dns', 'Set manual DNS');

page('console/ps5/y2jb.html', 'PS5 Y2JB Setup & Autoloader', 'Prepare the YouTube entry point, install Y2JB and configure payload loading with the installer or manual method.', '/assets/images/consoles/ps5-y2jb.jpg', ps5nav,
section('requirements', 'Start with working homebrew access', note('<p>The installer prepares Y2JB; it does not supply the initial exploit. You need compatible kernel read/write access and an ELF loader on TCP port <code>9021</code>.</p><p>The installer lists firmware 4.03 to 13.60 and specifically excludes 11.40 for the autoloader. Check the release you choose. Fast startup depends on your console and payload chain; there is no one-second guarantee.</p>')) +
section('downloads', 'Choose your setup tool', grid(
resource('Y2JB Installer', 'Desktop and Android setup app for account activation, YouTube installation and the Y2JB data file.', github('jamesst20/ps5-y2jb-installer')),
resource('Maj0r’s Y2JB', 'YouTube userland entry point and manual setup instructions. Match the YouTube version to your firmware.', github('notmaj0r/Y2JB') + ext('https://github.com/notmaj0r/Y2JB', 'Manual instructions')),
resource('itsPLK Autoloader', 'Loads a supported kernel exploit and configured ELF payloads. Supports a payload-manager workflow or autoload.txt.', github('itsPLK/ps5-y2jb-autoloader'))
)) + section('installer', 'Install with Y2JB Installer', steps([
['Download the matching installer', 'Choose the release for your computer or Android device and read its installation notes. Connect that device and the PS5 to the same local network.'],
['Start the initial exploit', 'Use Relapse or another firmware-compatible entry point. Leave the ELF loader available on TCP <code>9021</code>.'],
['Connect the installer to your PS5', 'Use its LAN discovery or enter the console IP from your PS5 connection status. Follow the installer prompts to deliver its cooperating console payload.'],
['Complete the setup tasks', 'Use the installer’s account activation, fake sign-in, firmware-aware YouTube install and data-file placement steps. Confirm each succeeds before continuing.'],
['Block updates, reboot and disconnect Internet', 'Complete the installer’s update-blocking step and reboot when prompted. Disconnect Internet access before launching the prepared YouTube app: an online launch can replace download0.dat. Keep the local Wi-Fi or Ethernet connection active when the selected exploit needs LAN access; Internet access itself is unnecessary.']
]) + sourceList([['https://github.com/jamesst20/ps5-y2jb-installer', 'Installer requirements and setup tasks']])) +
section('manual', 'Manual Y2JB installation', steps([
['Choose the correct YouTube build', 'Maj0r lists PPSA01650 version <code>01.000.003</code> for firmware 4.03 to 12.40, and <code>01.000.030</code> for 12.60 and later. Check the current project table.'],
['Use a separate fake-activated account', 'Follow the project account instructions. Its manual setup calls for a separate fake-activated account rather than reusing a legitimately PSN-activated account.'],
['Place download0.dat', 'Download it from the chosen project release. Transfer it to <code>/user/download/PPSA01650</code>, <code>/user/download/PPSA01651</code> or <code>/user/download/PPSA01652</code>, matching the installed YouTube title ID.'],
['Keep update blocking configured', 'Y2JB needs PSN/YouTube update blocking. The project documents its own DNS options, which differ from the public Relapse host DNS. Follow the selected build’s instructions, then start YouTube.']
]) + sourceList([['https://github.com/notmaj0r/Y2JB', 'Maj0r Y2JB manual setup']])) +
section('autoload', 'Configure itsPLK payload loading', steps([
['Install the autoloader build', 'Use itsPLK’s release and matching setup instructions. Its YouTube versions are <code>01.000.003</code> on 4.03–12.40, <code>01.000.030</code> on 12.60–13.20, and <code>01.009.253</code> on 13.40–13.60. These differ from Maj0r’s table above. With no autoload.txt configuration, its payload-manager interface is the default route.'],
['Or make a manual payload folder', 'Create <code>ps5_autoloader</code> at the USB drive root, or <code>/data/ps5_autoloader</code> on internal storage. Put your compatible ELF/BIN payloads there.'],
['Create autoload.txt', 'List one payload filename per line in the required load order. Match filename case exactly. A line such as <code>!1000</code> adds a 1,000 ms delay.'],
['Test the chain', 'Launch the prepared YouTube app and confirm every payload loads. If the configuration file is present, Payload Manager does not automatically open unless you include its payload.']
]) + sourceList([['https://github.com/itsPLK/ps5-y2jb-autoloader', 'Autoloader configuration reference']])) + section('video', 'Y2JB video companion', videoEmbed('9ciuKNY7T7w', 'Fastest PS5 Jailbreak method yet with New Y2JB!') + note(provenance)), '#installer', 'Start setup');

page('console/ps5/emulators.html', 'Emulators on PlayStation 5', 'Native homebrew emulator projects for PS2, GameCube, Wii, Wii U, Xbox, Xbox 360 and retro systems on PS5.', ps5image, ps5nav,
section('emulators', 'Choose a system', note('<p>These projects run on a homebrew-enabled PS5. PC emulators live under <a href="/pc/emulators.html">PC &gt; Emulators</a>. Console-port compatibility and performance depend on the game, firmware and payload versions.</p>') + grid(
resource('PS5SX2 · PlayStation 2', 'PCSX2 port for PS5. Read its installer and helper requirements; use your own games and a compatible BIOS configuration.', github('Swordpdf/PS5SX2'), '/assets/images/emulators/PCSX2.png'),
resource('Porpoise · GameCube & Wii', 'Dolphin-based native PS5 port with controller-oriented library and game settings.', github('elripalda/Porpoise-Dolphin-Emulator-for-PS5'), '/assets/images/emulators/Dolphin.png'),
resource('PS5-ECAM · Wii U and handhelds', 'The supplied PS5CEMU-HAR project now redirects to PS5-ECAM. Check each bundled emulator’s requirements and compatibility.', github('premohq/PS5-ECAM'), '/assets/images/emulators/Cemu.png'),
resource('PS5X360 · Xbox 360', 'Xenia-based PS5 project. It requires a working homebrew environment; compatibility and performance are still developing.', github('BrinooTk/PS5X360'), '/assets/images/emulators/Xenia.png'),
resource('XPSemu · Original Xbox', 'Native PS5 port based on xemu. Follow the project setup for BIOS, firmware and game files.', github('ZiZc3/XPSemu'), '/assets/images/consoles/xbox.jpg'),
resource('RetroArch · Retro systems', 'PS5 RetroArch build with core-specific support. Check the supplied cores before adding games.', github('mihawk-99/PS5_RetroArch'), '/assets/images/emulators/retroarch.png'),
resource('PSFlycast · Dreamcast', 'Flycast-based PS5 homebrew project for Dreamcast and related arcade systems. Check the release for installation and game support.', github('Press5elect/PSFlycast')),
resource('KB-RPCS3 · PlayStation 3', 'Unofficial native PS5 RPCS3 port. The alpha is a source release; it is not presented here as a ready-to-install app.', ext('https://github.com/kamb205/KB-RPCS3', 'Source & build notes'), '/assets/images/emulators/RPCS3.jpg')
)) + section('setup', 'Installing console emulator ports', steps([
['Read the release requirements', 'Confirm your firmware, homebrew enabler, loader and helper payloads match the project release.'],
['Install the correct console build', 'Follow the project’s homebrew-folder, PKG or ELF-installer instructions. A PC executable cannot be copied over as a PS5 app.'],
['Add your game files', 'Use your own dumps and required BIOS or firmware. Follow the emulator’s documented directory layout.'],
['Test one title', 'Check controller input, audio and saves before expanding your library. Report problems to the console-port project.']
]) + sourceList([['https://github.com/Swordpdf/PS5SX2', 'PS5SX2 requirements'], ['https://github.com/BrinooTk/PS5X360', 'PS5X360 installation and compatibility']])), '#emulators', 'Browse emulators');

page('console/ps4/index.html', 'PlayStation 4 Homebrew', 'Firmware-specific jailbreak resources, manual DNS, GoldHEN and native emulator ports for PlayStation 4 and PS4 Pro.', '/assets/images/consoles/playstation.jpg', ps4nav,
hostSection('ps4') + require('./build-console-downloads.cjs').intro('ps4') +
section('start', 'PS4 guides & downloads', ps4Resources(), 'Start with Jailbreak to choose your firmware. GoldHEN downloads, payloads, apps and emulators have their own pages.') + require('./apollo-tools.cjs').section('ps4'), '#start', 'Choose a guide');

page('console/ps4/jailbreak.html', 'PS4 14.00 Jailbreak & DNS', 'An experimental 14.00 resource guide with manual DNS, browser-host links and the Blu-ray disc requirements for the supplied video.', ps4image, ps4nav,
section('requirements', '14.00 is an unstable route', note('<p><strong>For the disc method you need a blank recordable Blu-ray disc and a Blu-ray burner.</strong> A DVD, CD or USB drive is not a substitute. Your PS4 must have a working Blu-ray drive.</p><p>The 14.00 steps and HEN ISO are supplied with the linked video. Firmware support and the archive contents could not be independently confirmed. Read the video’s current notes before burning. Do not update a console just to match this guide.</p>')) +
section('dns', 'Set manual DNS on PS4', dns() + steps([
['Open the network wizard', 'Go to Settings &gt; Network &gt; Set Up Internet Connection. Choose Use Wi-Fi or Use a LAN Cable, then Custom.'],
['Keep your normal IP settings', 'Use your existing IP and DHCP configuration. For a typical home network these are Automatic and Do Not Specify.'],
['Set DNS to Manual', 'Primary DNS: <code>45.56.67.85</code>. Secondary DNS: <code>62.210.38.117</code>.'],
['Finish setup', 'Keep the normal MTU and proxy settings; a typical network uses Automatic and Do Not Use. Save and test the connection. You can restore DNS to Automatic later.']
]) + sourceList([['https://www.playstation.com/en-gb/support/connectivity/internet-connect-playstation/', 'PlayStation network setup reference']])) +
section('disc', 'Blu-ray method: preparation & flow', require('./ps4-disc-links.cjs').discSteps([
['Check your firmware and equipment', 'Read Settings &gt; System &gt; System Information. Confirm the video applies to that exact firmware. Prepare a computer, Blu-ray writer and blank supported BD-R/BD-RE media.'],
['Get the supplied HEN ISO', 'Download the ISO using the links here. If the supplied file is an archive, extract it first. Check the video’s current notes and any published checksum before using the ISO.'],
['Burn the image to Blu-ray', 'In ImgBurn choose Write image file to disc, select the ISO and the Blu-ray writer, and burn to the blank disc. Enable verification and let it complete. Copying the ISO as a normal data file does not create the same disc.'],
['Start the disc on PS4', 'Insert the finished disc and open its disc/Blu-ray tile. The documented 14.00 disc waits for one Cross (X) press after validation. Follow the instructions shown by the actual image you burned.'],
['Confirm HEN success', 'Check that the HEN features actually work before installing homebrew. After a failure, shut down completely and cold-boot before another attempt; do not repeatedly trigger it in the same session.']
]) + `<div class="guide-links">${goldhen14Download()}${ext('https://gofile.io/d/kg4BSziZ', 'Supplied HEN ISO')}${ext('https://www.imgburn.com/index.php?act=download', 'ImgBurn downloads')}${ext('https://github.com/OptiTronOffical/PS4-14.00-BD-JB', '14.00 disc workflow reference')}</div>`) +
section('browser', 'Browser-host alternative', note('<p>The supplied SilverPS4HEN link requests a 14.00 route. Its availability and payload support must be checked on the exact firmware. It is a separate alternative to the disc method; entering DNS does not by itself run the exploit.</p>') + `<p>PS4 browser address:<br><a href="https://aminegold0.github.io/silverps4hen/" target="_blank" rel="noopener noreferrer">https://aminegold0.github.io/silverps4hen/</a></p><div class="guide-links">${ext('https://aminegold0.github.io/silverps4hen/raw13/jb.html?log=1&hx1400=1&v=6', 'Open supplied 14.00 host')}${ext('https://github.com/aminegold0/silverps4hen', 'Host source')}${link('/console/ps4/goldhen.html', 'GoldHEN page')}</div>` + steps([
['Open the host on the PS4', 'Use the console Internet Browser after configuring the connection. Read the host’s displayed firmware and payload options.'],
['Match the payload', 'Use only a HEN build whose release notes list your firmware and entry point. GoldHEN is linked as a separate project, not as verified 14.00 support.'],
['Wait for the result', 'Confirm success before using Package Installer or other homebrew services. If it fails, follow the host’s recovery notes instead of assuming the console is enabled.']
])) + section('video', 'PS4 14.00 video companion', videoEmbed('F7y-hk5qpxM', 'PS4 14.00 Jailbreak (unstable)') + note(provenance)), '#requirements', 'Read requirements');

page('console/ps4/emulators.html', 'Emulators on PlayStation 4', 'PS2, PS3, GameCube, Wii, Wii U and Dreamcast emulator ports for an already homebrew-enabled PS4.', ps4image, ps4nav,
section('emulators', 'Choose a console emulator', note('<p>A PS4 port needs a compatible jailbreak and homebrew enabler. An experimental 14.00 entry point does not establish compatibility with every app below.</p>') + grid(
resource('DolphinPS4 · GameCube & Wii', 'Native homebrew port based on Dolphin. Read firmware, renderer and game compatibility notes.', github('iHaiDeeZ/DolphinPS4'), '/assets/images/emulators/Dolphin.png'),
resource('Crema · Wii U', 'Cemu-based Wii U emulator for PS4. The project source and supplied download are linked separately.', github('iHaiDeeZ/Crema') + ext('https://gofile.io/d/AuSpG026', 'Supplied download'), '/assets/images/emulators/Cemu.png'),
resource('Resonance · Dreamcast', 'Flycast-based Dreamcast port for PS4. Follow the project setup and game-format instructions.', github('iHaiDeeZ/Resonance')),
resource('PS4SX2 · PlayStation 2', 'Experimental PCSX2 port for PS4 with controller-oriented library and per-game compatibility limits.', github('Phoenixx1202/PS4SX2'), '/assets/images/emulators/PCSX2.png'),
resource('RPCS3 port · PlayStation 3', 'Unofficial Roberix Studios port, separate from the desktop RPCS3 team. Needs a compatible GoldHEN setup and official PS3 firmware; performance varies.', github('RoberixStudios/rpcs3-port-for-ps4') + ext('https://gofile.io/d/oTSXa5pw', 'Supplied download'), '/assets/images/emulators/RPCS3.jpg')
)) + section('setup', 'Install a PS4 emulator port', steps([
['Enable homebrew first', 'Check the project’s firmware requirements against your actual console and HEN version.'],
['Install its PS4 package', 'Download the correct console release and follow its PKG installer instructions. Keep PC and PS4 builds separate.'],
['Add required firmware and your games', 'Use the directories specified by the project. For the RPCS3 port, obtain PS3UPDAT.PUP from PlayStation and install it through that port’s firmware menu.'],
['Test and keep saves backed up', 'Try a single title and verify controller input, sound and saves. Use the port’s issue tracker for support.']
]) + `<div class="guide-links">${ext('https://www.playstation.com/en-gb/support/hardware/ps3/system-software/', 'Official PS3 firmware')}${ext('https://github.com/Lapy055/PS4-Xplorer', 'PS4-Xplorer project')}${link('/console/ps4/', 'Back to PS4')}</div>`) + section('sources', 'Source & download notes', sourceList([['https://github.com/RoberixStudios/rpcs3-port-for-ps4', 'RPCS3 PS4 requirements and installation'], ['https://github.com/iHaiDeeZ/Crema', 'Crema project'], ['https://github.com/iHaiDeeZ/Resonance', 'Resonance project']]) + note('<p>The supplied PS4Xplorer Mega link was truncated. The project source is linked above instead; no missing download key has been guessed.</p>')), '#emulators', 'Browse emulators');

page('pc/index.html', 'PC Gaming & Emulation', 'Console emulators, game tools and setup resources for your computer, grouped separately from console homebrew.', '/assets/images/emulators/PCSX2.png', [['/pc/', 'PC'], ['/pc/emulators.html', 'Emulators'], ['/tools/', 'PC Tools'], ['/games-downloads/', 'Game Downloads']],
section('browse', 'Explore PC resources', grid(
resource('Console emulators for PC', 'Browse modern, retro and handheld emulators with project links and setup notes.', link('/pc/emulators.html', 'Browse emulators'), '/assets/images/emulators/retroarch.png'),
resource('PlayStation emulators', 'PS1, PS2, PS3 and PSP tools for PC, including ePSXe, PCSX2, RPCS3 and PPSSPP.', link('/pc/playstation-emulators.html', 'Browse PlayStation'), '/assets/images/emulators/RPCS3.jpg'),
resource('Nintendo emulators', 'Dolphin, Cemu and other Nintendo emulator projects for your computer.', link('/pc/nintendo-emulators.html', 'Browse Nintendo'), '/assets/images/emulators/Dolphin.png'),
resource('Xbox emulators', 'Original Xbox and Xbox 360 emulator projects, including Xemu and Xenia.', link('/pc/xbox-emulators.html', 'Browse Xbox'), '/assets/images/emulators/Xenia.png'),
resource('PC tools', 'Memory tools, mod managers, graphics utilities and their setup resources.', link('/tools/', 'Browse tools')),
resource('Game downloads', 'Game launchers and fan-made projects collected in the download directory.', link('/games-downloads/', 'Browse downloads'))
)), '#browse', 'Browse PC resources');
console.log('Built console and PC guide pages.');
}

if (require.main === module) {
  require('./build-ps5-software.cjs').buildPs5Software();
  require('./build-ps4-software.cjs').buildPs4Software();
  require('./build-ps4-goldhen.cjs').buildPs4Goldhen();
  require('./build-ps4-jailbreaks.cjs').buildPs4Jailbreaks();
  require('./build-vita-guides.cjs').buildVitaGuides();
  require('./build-ps5-mods.cjs').buildPs5Mods();
  require('./build-ps5-jailbreaks.cjs').buildPs5Jailbreaks();
  require('./build-ps3-pages.cjs').buildPs3Pages();
  require('./build-xbox360-pages.cjs').buildXbox360Pages();
  require('./console-platform-routes.cjs').refreshConsoleRoutes();
}
