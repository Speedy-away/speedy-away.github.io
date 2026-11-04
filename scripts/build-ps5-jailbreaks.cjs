const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const selector = '/console/ps5/jailbreaks.html';
const firmware = require('../docs/ps5-jailbreak-firmware.json');
const relapseVersions = firmware.routes.find(route => route.id === 'relapse').supportedVersions.join(', ');
const jailbreakNav = [
  ['/console/ps5/', 'PS5 Hub'], [selector, 'Jailbreak'],
  [selector + '#firmware-downloads', 'Firmware'],
  ['/console/ps5/umtx2.html', '1.00–5.50 · UMTX2'],
  ['/console/ps5/bdj.html', '6.00–7.61 · Blu-ray'],
  ['/console/ps5/relapse.html', '7.00–13.60 · Relapse'],
  ['/console/ps5/y2jb.html', 'Y2JB Setup'],
  ['/console/ps5/downloads.html', 'Console Downloads']
];

function firmwareCard(url, title, method, description, image, alt, action) {
  const {esc} = require('./build-console-guides.cjs');
  return `<a class="guide-resource guide-firmware-card" href="${url}"><img src="${image}" alt="${esc(alt)}" loading="lazy" width="1280" height="720"><h3>${esc(title)}</h3><div class="game-features"><span class="feature">${esc(method)}</span></div><p>${esc(description)}</p><span class="guide-firmware-open">${esc(action)} <i class="fas fa-arrow-right" aria-hidden="true"></i></span></a>`;
}

function buildSelector() {
  const {page, section, grid, note, resource, ext, link, sourceList, ps5nav} = require('./build-console-guides.cjs');
  page('console/ps5/jailbreaks.html', 'PS5 Jailbreak',
    'Choose a guide for your exact PS5 firmware: UMTX2, Blu-ray / BD-J or Relapse. Check the supported versions and equipment before starting.',
    '/assets/images/consoles/ps5-featured-image.avif', ps5nav,
    section('firmware', 'Choose your PS5 firmware', grid(
      firmwareCard('/console/ps5/umtx2.html', '1.00–5.50', 'UMTX2 · browser',
        'The UMTX2 browser route for its listed 1.xx–5.xx versions. Includes the exact firmware list, host address and payload-loader steps.',
        '/assets/images/consoles/ps5-umtx2.jpg', 'UMTX2 browser host landing screen', 'Open UMTX2 page'),
      firmwareCard('/console/ps5/bdj.html', '6.00–7.61', 'Blu-ray / BD-J · disc required',
        'A disc-based route for listed 6.xx–7.xx versions. Requires a working Blu-ray drive, a Blu-ray writer and a recordable BD-R or BD-RE disc.',
        '/assets/images/consoles/ps5-bdj-jar-loader.png', 'Official PS5 JAR Loader artwork with a Blu-ray disc', 'Open Blu-ray page'),
      firmwareCard('/console/ps5/relapse.html', '7.00–13.60', 'Relapse · browser',
        'Relapse on its exact supported firmware list, with DNS and payload-loader instructions. This build does not list 9.05, 10.60 or 11.40.',
        '/assets/images/consoles/ps5-relapse.jpg', 'Relapse PS5 jailbreak video thumbnail', 'Open Relapse page')
    ) + note('<p>Check <strong>Settings → System → System Software → Console Information</strong> first. The numbers on the boxes describe ranges; each guide lists the exact supported versions. The 7.00–7.61 ranges overlap because they offer different entry methods.</p><p><strong>Firmware outside a guide’s list:</strong> check the linked project documentation before proceeding. Keep your existing firmware while choosing a route.</p>')) +
    section('firmware-downloads', 'PS5 firmware downloads', grid(
      resource('PS5 system software & recovery', 'Darthsternie’s PS5 firmware archive lists update and recovery files by version, with published MD5 hashes. Choose the exact version and file type required by your guide.', ext('https://darthsternie.net/ps5-firmwares/', 'Open PS5 firmware archive'), '/assets/images/consoles/ps5-featured-image.avif')
    ), 'Firmware files are separate from jailbreak payloads. Keep your installed version while checking compatibility.') +
    section('y2jb', 'After your first jailbreak', grid(
      resource('Y2JB installer & autoloader', 'This installer-based guide starts with working kernel access and an ELF loader. Prepare YouTube, match the app version to your firmware and configure payload loading.',
        link('/console/ps5/y2jb.html', 'Open Y2JB page'), '/assets/images/consoles/ps5-y2jb.jpg'),
      resource('Payloads, apps & console downloads', 'Once your selected loader works, choose firmware-compatible payloads and homebrew. The download page explains saving supported files to the PS5’s storage.',
        link('/console/ps5/payloads.html', 'Browse payloads') + link('/console/ps5/apps.html', 'Browse apps') + link('/console/ps5/downloads.html', 'Download on your PS5'), '/assets/images/expansion-ps4-ps5/payload-manager.png')
    )) +
    section('sources', 'Firmware & method references', sourceList([
      ['https://github.com/idlesauce/umtx2', 'UMTX2 · browser support and loader'],
      ['https://github.com/hammer-83/ps5-jar-loader', 'PS5 JAR Loader · Blu-ray requirements and restrictions'],
      ['https://github.com/soniciso1/relapse', 'Relapse · exact firmware list'],
      ['https://github.com/jamesst20/ps5-y2jb-installer', 'Y2JB installer · initial jailbreak requirements']
    ])), '#firmware', 'Choose firmware');
}

function refreshExistingGuides() {
  const {section, note, sourceList, link, videoEmbed, esc} = require('./build-console-guides.cjs');
  const relapseFile = path.join(root, 'console/ps5/relapse.html');
  let relapse = fs.readFileSync(relapseFile, 'utf8');
  const description = 'Use Relapse on its listed PS5 firmware versions, with manual DNS, browser access and payload-loader instructions. Excludes 9.05, 10.60 and 11.40.';
  relapse = relapse.replace(/<h1>[\s\S]*?<\/h1>/, '<h1>PS5 Jailbreak · 7.00–13.60</h1>');
  relapse = relapse.replace(/(<h1>[\s\S]*?<\/h1>)<p>[\s\S]*?<\/p>/, '$1<p>' + description + '</p>');
  const compatibility = section('compatibility', 'Check your exact Relapse firmware',
    note('<p><strong>Listed firmware only: 7.00–13.60.</strong> This build does not list 9.05, 10.60 or 11.40. Versions below 7.00 need another entry point.</p><p>Find your version under Settings → System → System Software → Console Information. Keep it unchanged while checking compatibility. DNS changes alone do not jailbreak the console.</p>') +
    `<details class="guide-version-details"><summary>Show the supported firmware list</summary><p>${esc(relapseVersions)}</p></details>` +
    sourceList([['https://github.com/soniciso1/relapse', 'Check Relapse’s exact firmware list']]) +
    `<div class="guide-links">${link(selector, 'Choose a different firmware')}</div>`);
  relapse = relapse.replace(/<section\b(?=[^>]*id="compatibility")[^>]*>[\s\S]*?<\/section>/, compatibility);
  relapse = relapse.replace(/<a class="guide-video" href="https:\/\/www.youtube.com\/watch\?v=HqF1rmvA2iE"[\s\S]*?<\/a>/, videoEmbed('HqF1rmvA2iE', 'How to Jailbreak the PS5 with Relapse (13.60 or lower)'));
  fs.writeFileSync(relapseFile, require('./playstation-nonmod-card-images.cjs').decorate('console/ps5/relapse.html',relapse));

  const y2jbFile = path.join(root, 'console/ps5/y2jb.html');
  let y2jb = fs.readFileSync(y2jbFile, 'utf8');
  y2jb = y2jb.replace('Use the installer’s update-blocking step, then launch the prepared YouTube app. Keep its PSN and update-blocking requirements in place. Use the project instructions for errors.', 'Complete the installer’s update-blocking step and reboot when prompted. Disconnect Internet access before launching the prepared YouTube app: an online launch can replace download0.dat. Keep the local Wi-Fi or Ethernet connection active when the selected exploit needs LAN access; Internet access itself is unnecessary.');
  y2jb = y2jb.replace('<strong>Block the YouTube update and test</strong>', '<strong>Block updates, reboot and disconnect Internet</strong>');
  y2jb = y2jb.replace('Use itsPLK’s release and matching setup instructions. With no autoload.txt configuration, its payload-manager interface is the default route.', 'Use itsPLK’s release and matching setup instructions. Its YouTube versions are <code>01.000.003</code> on 4.03–12.40, <code>01.000.030</code> on 12.60–13.20, and <code>01.009.253</code> on 13.40–13.60. These differ from Maj0r’s table above. With no autoload.txt configuration, its payload-manager interface is the default route.');
  const installerScope = note('<p><strong>This is the installer route after initial jailbreak access.</strong> Choose a firmware page first if you have not yet obtained kernel access. Maj0r also documents a separate backup-restore method for an unmodified console; that method resets console data and is outside this installer walkthrough.</p>');
  if (!y2jb.includes('This is the installer route after initial jailbreak access.')) y2jb = y2jb.replace(/(<section\b(?=[^>]*id="requirements")[^>]*>[\s\S]*?<\/h2><\/div>)/, '$1' + installerScope);
  y2jb = y2jb.replace(/<a class="guide-video" href="https:\/\/www.youtube.com\/watch\?v=9ciuKNY7T7w"[\s\S]*?<\/a>/, videoEmbed('9ciuKNY7T7w', 'Fastest PS5 Jailbreak method yet with New Y2JB!'));
  fs.writeFileSync(y2jbFile, require('./playstation-nonmod-card-images.cjs').decorate('console/ps5/y2jb.html',y2jb));
}

function refreshPs5NavigationAndHub() {
  const {section, ps5Resources, ps5nav, esc} = require('./build-console-guides.cjs');
  const hubFile = path.join(root, 'console/ps5/index.html');
  let hub = fs.readFileSync(hubFile, 'utf8');
  if (!/<section\b[^>]*id="start"/.test(hub)) throw Error('PS5 hub guide section is missing.');
  hub = hub.replace(/<section\b(?=[^>]*id="start")[^>]*>[\s\S]*?<\/section>/,
    section('start', 'PS5 guides & downloads', ps5Resources(), 'Start with Jailbreak to choose your firmware. Each route has its own requirements; Y2JB installer setup follows initial homebrew access.'));
  fs.writeFileSync(hubFile, hub);
  for (const entry of fs.readdirSync(path.join(root, 'console/ps5'))) {
    if (!entry.endsWith('.html') || entry === 'whatsite-ps5.html') continue;
    const file = path.join(root, 'console/ps5', entry);
    let body = fs.readFileSync(file, 'utf8');
    const nav = ['umtx2.html', 'bdj.html', 'relapse.html'].includes(entry) ? jailbreakNav : ps5nav;
    const markup = (entry === 'index.html' ? '<a href="#exploit-hosts">Exploit &amp; Redirect Hosts</a>' : '') + nav.map(([url, title]) => `<a href="${url}"${url === '/console/ps5/' + entry || entry === 'index.html' && url === '/console/ps5/' ? ' aria-current="page"' : ''}>${esc(title)}</a>`).join('');
    body = body.replace(/(<nav class="guide-nav" aria-label="Console pages">)[\s\S]*?(<\/nav>)/, '$1' + markup + '$2');
    body = body.replace(/\/assets\/console-guides\.css\?v=\d+/g, '/assets/console-guides.css?v=9');
    body = require('./guide-popup-policy.cjs').applyGuidePopupPolicy('console/ps5/' + entry, body);
    fs.writeFileSync(file, body);
  }
}

function buildPs5Jailbreaks() {
  require('./build-ps5-legacy-guides.cjs').buildPs5LegacyGuides();
  require('./build-ps5-bdj-guide.cjs').buildPs5BdjGuide();
  buildSelector();
  refreshExistingGuides();
  refreshPs5NavigationAndHub();
}

if (require.main === module) buildPs5Jailbreaks();
module.exports = {buildPs5Jailbreaks, buildSelector, refreshExistingGuides, refreshPs5NavigationAndHub, jailbreakNav};
