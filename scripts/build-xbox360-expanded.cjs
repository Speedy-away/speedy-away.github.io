const fs = require('node:fs');
const path = require('node:path');
const {section, grid, resource, note, ext, link, esc, sourceList} = require('./build-console-guides.cjs');
const root = path.resolve(__dirname, '..');
const data = require('../docs/expansion-xbox360.json');
const jobs = require('../docs/expansion-xbox360-jobs.json').jobs;
const consoleImage = '/assets/images/consoles/xbox360.png';
const pp = 'https://github.com/grimdoomer/Xbox360PeerPressure';
const softmodStart = '<!-- BEGIN UPDATED CONSOLE RESOURCES -->';
const softmodEnd = '<!-- END UPDATED CONSOLE RESOURCES -->';
const start = '<!-- BEGIN EXPANDED XBOX360 APPS -->';
const end = '<!-- END EXPANDED XBOX360 APPS -->';

function card(item) {
  const job = jobs.find(job => job.id === item.downloadId);
  if (!job) throw Error('Missing Xbox 360 download job: ' + item.downloadId);
  const tags = `<div class="game-features">${item.tags.map(tag => `<span class="feature-tag">${esc(tag)}</span>`).join('')}</div>`;
  return resource(esc(item.title), esc(item.description), ext(job.url, 'Download ' + esc(job.version)) + ext(item.url, 'Project & requirements'), item.image)
    .replace('<div class="guide-links">', tags + '<div class="guide-links">');
}

function baseSections() {
  const installer = jobs.find(job => job.id === 'xbox360-peerpressure-installer');
  return section('softmod', 'Softmod · Peer Pressure',
    `<nav class="guide-links" aria-label="Xbox 360 resources">${link('#more-homebrew', 'More homebrew & payloads')}${link('#desktop-tools', 'Windows tools')}${link('#aurora', 'Dashboards & file managers')}${link('#homebrew', 'Apps & utilities')}</nav>` +
    note('<p>Peer Pressure is a persistent Xbox 360 softmod for Xenon, Zephyr, Falcon, Jasper and Trinity motherboards. Corona and Winchester are unsupported. It requires an attached HDD; the developer recommends a mechanical drive. Read its installation wiki before changing NAND or HDD data. DashLaunch and DashLaunch plugins are not supported.</p>') + grid(
      resource('Peer Pressure 1.0.477', 'Official installer, supported hardware and installation documentation. Keep the matching console NAND backup and recovery information produced by the developer’s workflow.', ext(installer.url, 'Download installer') + ext(pp + '/wiki/Installation', 'Installation guide') + ext(pp, 'Project & compatibility'), consoleImage),
      resource('17559 System Update', 'Supplied dashboard 2.0.17559.0 download reference. Apply updates only when the softmod instructions require them for your existing setup.', ext('https://digiex.net/threads/xbox-360-dashboard-system-update-2-0-17559-0-download-with-avatars.16047/', '17559 download page'), consoleImage),
      resource('Rock Band Blitz Trial', 'Supplied trial-file directory. Check the Peer Pressure instructions for the required version and layout.', ext('https://archive.org/download/rbblitz-trial', 'Trial files'), consoleImage),
      resource('Aurora Dashboard', 'Phoenix / XboxUnity dashboard resources. Check Peer Pressure’s homebrew compatibility notes before installing; do not assume its NOVA or other plugin features are supported by the softmod.', ext('https://phoenix.xboxunity.net/#/news', 'Aurora site') + ext(pp + '#homebrew-compatibility', 'Softmod compatibility'), '/assets/images/expansion-xbox360/aurora.png'),
      resource('Xbox backwards compatibility', 'ConsoleMods Xefu pack reference with supporting files and file history. Follow the requirements for your existing modification method.', ext('https://consolemods.org/wiki/File:Hacked_Xefu_Pack_with_HUD.7z', 'Back-compat files'), consoleImage)
    )) + section('game-downloads', 'Xbox 360 game library', grid(
      resource('Vimm’s Lair · Xbox 360', 'External Xbox 360 catalog supplied for this page. Title availability and download access are controlled by that site.', ext('https://vimm.net/vault/Xbox360', 'Open Xbox 360 library'), consoleImage)
    ));
}

function expansionSections() {
  return section('more-homebrew', 'More Xbox 360 homebrew & payloads',
    note('<p><strong>Choose the route matching your console.</strong> BadUpdate and ABadAvatar start temporary sessions. FreeMyXe and XeUnshackle are payload choices for that workflow. They are separate from Peer Pressure’s persistent softmod. Follow each developer’s requirements before mixing apps or plugins.</p>') + grid(...data.resources.filter(item => item.group === 'console').map(card)),
    'Exploit entry points, runtime payloads and the LibXenon loader, with official release builds.') +
    section('desktop-tools', 'Xbox 360 tools for your PC', grid(...data.resources.filter(item => item.group === 'desktop').map(card)), 'Desktop storage, package and console-management helpers. These downloads run on Windows.') +
    section('app-setup', 'Install apps for your setup',
      `<div class="guide-links">${link('#softmod', 'Peer Pressure')}${link('#more-homebrew', 'Temporary exploits & payloads')}${link('#aurora', 'Dashboards & file managers')}${link('#homebrew', 'Existing homebrew tools')}${link('/console/retro/', 'More console homebrew')}</div>` +
      sourceList([[pp + '/wiki/Installation', 'Peer Pressure installation'], ['https://github.com/grimdoomer/Xbox360BadUpdate/wiki/How-To-Use', 'BadUpdate: supported game and payload setup'], ['https://github.com/shutterbug2000/ABadAvatar', 'ABadAvatar: avatar data and offline requirements'], ['https://github.com/SaveEditors/xecli/wiki', 'XeCLI: desktop and plugin setup']]));
}

function transform(html) {
  if (!html.includes(softmodStart) || !html.includes(softmodEnd)) throw Error('Missing existing Xbox 360 resource boundary');
  const a = html.indexOf(softmodStart), b = html.indexOf(softmodEnd, a) + softmodEnd.length;
  html = html.slice(0, a) + softmodStart + '\n' + baseSections() + '\n' + softmodEnd + html.slice(b);
  if (html.includes(start)) {
    const first = html.indexOf(start), last = html.indexOf(end, first);
    if (last < 0) throw Error('Unterminated Xbox 360 expansion');
    html = html.slice(0, first).replace(/\r?\n$/, '') + html.slice(last + end.length);
  }
  html = html.replace(softmodEnd, softmodEnd + '\n' + start + '\n' + expansionSections() + '\n' + end);
  html = html.replace(/<link rel="stylesheet" href="\/assets\/console-guides\.css[^\"]*">/, '<link rel="stylesheet" href="/assets/console-guides.css?v=9">');
  html = html.replace('Complete guide to Xbox 360 modification including JTAG, RGH installation, Aurora Dashboard, homebrew applications, and game modifications.', 'Xbox 360 homebrew, Peer Pressure, temporary exploit payloads, dashboards and Windows tools. Choose resources for your console’s modification method.');
  html = html.replace('<h3>50+</h3>', '<h3>Homebrew</h3>').replace('<p>Homebrew Apps</p>', '<p>Apps &amp; tools</p>');
  html = html.replace('Media player and file manager with support for various video and audio formats.', 'Team XeDev collection manager for installed XBLA, DLC and title updates. Scan your content library and review the project’s setup requirements.');
  html = html.replace('data-search="xm360 xbla media player multi-format file manager support various video audio formats"', 'data-search="xm360 xbla dlc title updates collection manager installed content scan"');
  html = html.replace(/(<h3 class="game-title">XM360 \(XBLA\)<\/h3>[\s\S]*?<\/a>)/, old => old.replace('Media Player</span>', 'Content Library</span>').replace('Multi-format</span>', 'XBLA &amp; DLC</span>').replace('File Manager</span>', 'Title Updates</span>'));
  html = html.replace(/(<img src=")[^"]+(" alt="RetroArch 360")/, '$1/assets/images/emulators/retroarch.png$2');
  html = html.replace(/(<img src=")[^"]+(" alt="Aurora Dashboard")/, '$1/assets/images/expansion-xbox360/aurora.png$2');
  const jtag = html.indexOf('<section class="section" id="jtag-rgh">');
  const aurora = html.indexOf('<section class="section" id="aurora">');
  if (jtag >= 0 && aurora > jtag && !html.includes('id="rgh-app-note"')) {
    html = html.slice(0, aurora) + '<div class="container"><aside id="rgh-app-note" class="guide-note"><p>The dashboard, Neighborhood and NAND tools below describe established RGH/JTAG workflows. Check each app against your actual exploit. Peer Pressure does not support DashLaunch plugins, while temporary-session payloads prohibit modified-NAND flashing.</p></aside></div>\n' + html.slice(aurora);
  }
  return require('./custom-console-art.cjs').applyXboxArtwork(html);
}

function buildXbox360Expanded() {
  const file = path.join(root, 'console/xbox360.html');
  const html = fs.readFileSync(file, 'utf8');
  if (/\bdata-console-migration=["']xbox360["']/.test(html)) {
    return require('./build-xbox360-pages.cjs').buildXbox360Pages();
  }
  fs.writeFileSync(file, transform(html));
  console.log('Expanded Xbox 360 with ' + data.resources.length + ' illustrated homebrew, payload and desktop-tool cards.');
}
module.exports = {baseSections, expansionSections, transform, buildXbox360Expanded};
if (require.main === module) buildXbox360Expanded();
