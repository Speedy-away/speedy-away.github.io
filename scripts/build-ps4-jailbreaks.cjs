const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const fourteen = '/console/ps4/jailbreak.html';
const thirteen = '/console/ps4/jailbreak-13-52.html';
const selector = '/console/ps4/jailbreaks.html';
const jailbreakNav = [
  ['/console/ps4/', 'PS4 Hub'], [selector, 'Jailbreak'],
  [selector + '#firmware-downloads', 'Firmware'],
  [fourteen, '14.00'], [thirteen, '13.52 or lower'],
  ['/console/ps4/goldhen.html', 'GoldHEN'], ['/console/ps4/downloads.html', 'Console Downloads']
];

function firmwareCard(url, title, description, image, tag, action) {
  const {esc} = require('./build-console-guides.cjs');
  return `<a class="guide-resource guide-firmware-card" href="${url}"><img src="${image}" alt="${esc(title)} tutorial" loading="lazy"><h3>${esc(title)}</h3><div class="game-features"><span class="feature">${esc(tag)}</span></div><p>${esc(description)}</p><span class="guide-firmware-open">${esc(action)} <i class="fas fa-arrow-right" aria-hidden="true"></i></span></a>`;
}

function buildSelector() {
  const {page, section, grid, note, resource, ext, link, ps4nav} = require('./build-console-guides.cjs');
  page('console/ps4/jailbreaks.html', 'PS4 Jailbreak',
    'Choose the PS4 14.00 guide or the 13.52-or-lower browser tutorial, then follow the requirements for your exact firmware.',
    '/assets/images/consoles/playstation.jpg', ps4nav,
    section('firmware', 'Choose your PS4 firmware',
      grid(
        firmwareCard(fourteen, '14.00', 'The supplied experimental 14.00 guide, with Blu-ray preparation, DNS, browser-host alternatives and its video companion.', '/assets/images/consoles/ps4-jailbreak.jpg', 'Experimental · disc / browser resources', 'Open 14.00 page'),
        firmwareCard(thirteen, '13.52 or lower', 'MODDED WARFARE’s browser tutorial. The demonstrated route covers 7.00–13.52; use the host’s exact firmware options for older systems.', '/assets/images/consoles/ps4-1352.jpg', 'Browser tutorial · firmware-specific', 'Open 13.52-or-lower page')
      ) + note('<p>Check <strong>Settings → System → System Information</strong> before choosing. Keep your existing firmware while checking compatibility. Older firmware does not automatically use the same exploit chain as a newer version.</p>')) +
    section('firmware-downloads', 'PS4 firmware downloads', grid(
      resource('PS4 system software & recovery', 'Darthsternie’s PS4 firmware archive lists update and recovery files by version, with file sizes and MD5 hashes. Choose the exact version and file type required by your guide.', ext('https://darthsternie.net/ps4-firmwares/', 'Open PS4 firmware archive'), '/assets/images/consoles/playstation.jpg')
    ), 'Firmware files are separate from jailbreak payloads. Keep your installed version while checking compatibility.') +
    section('hen', 'GoldHEN & HEN downloads', grid(
      resource('GoldHEN page', 'Find the archived official GoldHEN release and the separately supplied 14.00 HEN ISO, with compatibility notes and download details.', link('/console/ps4/goldhen.html', 'Open GoldHEN page'), '/assets/images/console-software/goldhen.png')
    )), '#firmware', 'Choose firmware');
}

function buildBrowserGuide() {
  const {page, section, note, ext, link, sourceList, videoEmbed, esc} = require('./build-console-guides.cjs');
  const data = JSON.parse(fs.readFileSync(path.join(root, 'docs/ps4-1352-guide.json'), 'utf8'));
  const flow = `<ol class="guide-steps">${data.steps.map(step => {
    const links = (step.links || []).map(item => /^https?:/.test(item.url) ? ext(item.url, esc(item.label)) : `<a href="${esc(item.url)}">${esc(item.label)} <i class="fas fa-arrow-right" aria-hidden="true"></i></a>`).join('');
    return `<li><div class="guide-step-heading"><strong>${esc(step.title)}</strong>${links ? `<span class="guide-step-links">${links}</span>` : ''}</div>${esc(step.text)}</li>`;
  }).join('')}</ol>`;
  const chapterLinks = `<ul class="guide-source-list">${data.video.chapters.map(chapter => {
    const timestamp = Math.floor(chapter.seconds / 60) + ':' + String(chapter.seconds % 60).padStart(2, '0');
    return `<li>${ext(`https://www.youtube.com/watch?v=${data.video.id}&t=${chapter.seconds}`, `${timestamp} · ${esc(chapter.label)}`)}</li>`;
  }).join('')}</ul>`;
  const dns = `<dl class="guide-dns"><div><dt>Primary DNS from the video</dt><dd><code>${esc(data.dns.primary)}</code></dd></div><div><dt>Alternate primary DNS</dt><dd><code>${esc(data.dns.alternatePrimary)}</code></dd></div></dl>`;
  const addresses = data.hosts.map(host => `<p><strong>${esc(host.label)}</strong><br>${ext(host.url, esc(host.url))}</p>`).join('');
  page('console/ps4/jailbreak-13-52.html', 'PS4 Jailbreak · 13.52 or Lower',
    'Follow MODDED WARFARE’s PS4 browser tutorial: firmware checks, DNS, offline caching, GoldHEN settings and homebrew packages.',
    data.image.path, jailbreakNav,
    section('requirements', 'Check your PS4 before starting',
      note(`<p><strong>Demonstrated browser route: ${esc(data.compatibility.videoRange)}.</strong> ${esc(data.compatibility.summary)}</p><p>${esc(data.compatibility.excluded)}</p>`) +
      `<ul class="guide-source-list">${data.requirements.map(item => `<li>${esc(item)}</li>`).join('')}</ul>` +
      `<div class="guide-links">${link(selector, 'Choose a different firmware')}${link(fourteen, 'Open the 14.00 page')}</div>`) +
    section('video', 'Video walkthrough · MODDED WARFARE', videoEmbed(data.video.id, data.video.title) + chapterLinks,
      'Written steps below were checked against the supplied video’s full captions and the linked project documentation.') +
    section('hosts', 'Browser addresses from the video', addresses +
      note(`<p>${esc(data.compatibility.olderFirmware)}</p><p>${esc(data.compatibility.hostRouterCaveat)}</p>`)) +
    section('dns', 'DNS settings & online play', dns + `<p>${esc(data.dns.note)}</p>` + require('./console-dns-notice.cjs').notice()) +
    section('walkthrough', 'Browser jailbreak · step by step', flow) +
    section('goldhen-version', 'Use the matching GoldHEN build',
      note(`<p>${esc(data.compatibility.goldhenVersions)}</p><p>${esc(data.compatibility.persistence)}</p>`) +
      `<div class="guide-links">${link('/console/ps4/goldhen.html', 'GoldHEN downloads & notes')}${link('/console/ps4/apps.html', 'PS4 homebrew apps')}${link('/console/ps4/downloads.html', 'Download on your PS4')}</div>`) +
    section('sources', 'Tutorial & host documentation', sourceList(data.sources.map(item => [item.url, item.supports]))),
    '#requirements', 'Start with your firmware');
}

function refreshPs4NavigationAndHub() {
  const {section, ps4Resources, ps4nav, esc} = require('./build-console-guides.cjs');
  const hub = path.join(root, 'console/ps4/index.html');
  let html = fs.readFileSync(hub, 'utf8');
  const replacement = section('start', 'PS4 guides & downloads', ps4Resources(), 'Start with Jailbreak to choose your firmware. GoldHEN downloads, payloads, apps and emulators have their own pages.');
  if (!/<section\b[^>]*id="start"/.test(html)) throw Error('PS4 hub guide section is missing.');
  html = html.replace(/<section\b(?=[^>]*id="start")[^>]*>[\s\S]*?<\/section>/, replacement);
  html = html.replace(/(<header class="guide-hero">[\s\S]*?<img src=")[^"]+("[^>]*>)/, '$1/assets/images/consoles/playstation.jpg$2');
  html = html.replace(/(<meta (?:property="og:image"|name="twitter:image") content=")[^"]+("[^>]*>)/g, '$1https://whatwhatboy.com/assets/images/consoles/playstation.jpg$2');
  fs.writeFileSync(hub, html);
  for (const entry of fs.readdirSync(path.join(root, 'console/ps4'))) {
    if (!entry.endsWith('.html') || entry === 'whatsite-ps4.html') continue;
    const file = path.join(root, 'console/ps4', entry);
    const relative = '/console/ps4/' + entry;
    let body = fs.readFileSync(file, 'utf8');
    const nav = /^(?:jailbreak|jailbreak-13-52)\.html$/.test(entry) ? jailbreakNav : ps4nav;
    const markup = nav.map(([url, title]) => `<a href="${url}"${url === relative || entry === 'index.html' && url === '/console/ps4/' ? ' aria-current="page"' : ''}>${esc(title)}</a>`).join('');
    body = body.replace(/(<nav class="guide-nav" aria-label="Console pages">)[\s\S]*?(<\/nav>)/, '$1' + markup + '$2');
    fs.writeFileSync(file, body);
  }
}

function buildPs4Jailbreaks() {
  buildSelector();
  buildBrowserGuide();
  refreshPs4NavigationAndHub();
}

if (require.main === module) buildPs4Jailbreaks();
module.exports = {buildPs4Jailbreaks, buildSelector, buildBrowserGuide, refreshPs4NavigationAndHub, jailbreakNav};
