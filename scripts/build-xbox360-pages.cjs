const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const content = require('../docs/console-page-content-xbox360.json');
const base = '/console/xbox360/';
const routes = {
  softmod: 'softmod.html', 'game-downloads': 'downloads.html',
  'more-homebrew': 'payloads.html', 'desktop-tools': 'tools.html',
  'app-setup': 'payloads.html', 'jtag-rgh': 'hardware.html',
  aurora: 'apps.html', homebrew: 'apps.html',
  'game-mods': 'mods.html', mods: 'mods.html', safety: 'jailbreaks.html',
  'rgh-app-note': 'apps.html'
};
const xbox360nav = [
  [base, 'Xbox 360'], [base + 'jailbreaks.html', 'Jailbreak'],
  [base + 'payloads.html', 'Payloads'], [base + 'apps.html', 'Apps & Dashboards'],
  [base + 'tools.html', 'PC Tools'], [base + 'mods.html', 'Mods / Mod Menus'],
  [base + 'downloads.html', 'Downloads']
];
const methodNav = [
  [base, 'Xbox 360'], [base + 'jailbreaks.html', 'Jailbreak'],
  [base + 'softmod.html', 'Peer Pressure'], [base + 'hardware.html', 'JTAG / RGH'],
  [base + 'payloads.html', 'Temporary Exploits & Payloads'],
  [base + 'apps.html', 'Apps & Dashboards'], [base + 'downloads.html', 'Downloads']
];

function normalize(html) {
  return html.replace('Existing homebrew tools', 'Apps &amp; utilities').replace(/\b(href|src)="([^"]*)"/g, (all, attr, value) => {
    if (/^(?:https?:|mailto:|data:|\/\/)/.test(value)) return all;
    if (attr === 'href' && value.startsWith('#')) {
      const id = value.slice(1), route = routes[id];
      return `${attr}="${route ? base + route : base}${value}"`;
    }
    const resolved = new URL(value, 'https://whatwhatboy.com/console/xbox360.html');
    return `${attr}="${resolved.pathname + resolved.search + resolved.hash}"`;
  });
}
function captured(id) {
  const section = content.sections.find(item => item.id === id);
  if (!section) throw Error('Missing captured Xbox section: ' + id);
  return normalize(section.html);
}
function capturedByTitle(title, id) {
  const section = content.sections.find(item => item.title === title);
  if (!section) throw Error('Missing captured Xbox block: ' + title);
  return normalize(section.html.replace(/<section\b/, `<section id="${id}"`));
}
function originalResource(title) {
  const section = content.sections.find(item => item.id === 'softmod');
  const card = [...section.html.matchAll(/<article class="guide-resource"[\s\S]*?<\/article>/g)]
    .map(item => item[0]).find(item => item.match(/<h3>([\s\S]*?)<\/h3>/)?.[1] === title);
  if (!card) throw Error('Missing captured Xbox file card: ' + title);
  return normalize(card);
}

function buildXbox360Pages() {
  const {page, section, grid, resource, note, link} = require('./build-console-guides.cjs');
  const fullPageLink = (url, label) => link(url, label).replace(/\sdata-guide-open\b/g, '').replace('<a ', '<a target="_blank" rel="noopener noreferrer" ');
  const art = require('./custom-console-art.cjs');
  const image = {
    console: art.image('xbox360-peer-pressure'), hardware: art.image('xbox360-jtag'),
    library: art.image('xbox360-game-library'), compatibility: art.image('xbox360-backwards-compatibility'),
    update: art.image('xbox360-system-update'),
    aurora: '/assets/images/expansion-xbox360/aurora.png',
    payload: '/assets/images/expansion-xbox360/xeunshackle.png',
    badupdate: '/assets/images/expansion-xbox360/badupdate-late.png',
    tools: '/assets/images/expansion-xbox360/fatxplorer.png'
  };
  const more = () => section('more', 'More for your Xbox 360', `<div class="guide-links">${
    link(base + 'jailbreaks.html', 'Choose a modification method') +
    link(base + 'apps.html', 'Browse apps') + link(base + 'payloads.html', 'Browse payloads') +
    link(base + 'tools.html', 'Open PC tools') + link(base + 'downloads.html', 'Browse downloads')
  }</div>`);

  page('console/xbox360/index.html', 'Xbox 360 Homebrew',
    'Choose your modification method, then browse Xbox 360 payloads, dashboards, apps, PC tools and game mods.', image.console, xbox360nav,
    section('start', 'Xbox 360 guides & downloads', grid(
      resource('Jailbreak & modification', 'Choose between Peer Pressure, temporary exploit sessions and JTAG or RGH hardware methods. Each route has its own requirements.', link(base + 'jailbreaks.html', 'Choose your method'), image.console),
      resource('Payloads', 'BadUpdate, ABadAvatar, FreeMyXe, XeUnshackle and XeLL, with release files and compatibility notes.', link(base + 'payloads.html', 'Browse payloads'), image.payload),
      resource('Apps & dashboards', 'Aurora, FreeStyle Dash, XeXMenu, XM360, RetroArch and other Xbox 360 utilities.', link(base + 'apps.html', 'Browse apps'), image.aurora),
      resource('PC tools', 'FATXplorer, Velocity and XeCLI for storage, package inspection and supported console connections.', link(base + 'tools.html', 'Open PC tools'), image.tools),
      resource('Mods / Mod Menus', 'Trainer, visual-mod, save-editing and modding-tool information for Xbox 360 games.', fullPageLink(base + 'mods.html', 'Browse mods / mod menus'), image.library),
      resource('Downloads', 'Find installers, firmware references, trial files, the backwards-compatibility pack and game-library directory.', link(base + 'downloads.html', 'Browse downloads'), image.compatibility)
    ), 'Choose the method that matches your console, then find compatible apps and downloads.'), '#start', 'Choose a page');

  page('console/xbox360/jailbreaks.html', 'Xbox 360 Jailbreak & Modification',
    'Choose the Xbox 360 modification route that matches your motherboard and existing setup.', image.console, xbox360nav,
    section('methods', 'Choose your Xbox 360 method', grid(
      resource('Peer Pressure · persistent softmod', 'Supported motherboards, HDD requirements, the installer and developer installation instructions.', link(base + 'softmod.html', 'Open Peer Pressure page'), image.console),
      resource('Temporary exploits & payloads', 'BadUpdate and ABadAvatar start temporary sessions. Choose their matching payloads and keep their restrictions separate from Peer Pressure.', link(base + 'payloads.html', 'Open temporary-exploit page'), image.badupdate),
      resource('JTAG / RGH · hardware', 'Installation and hardware references for JTAG, RGH, CoolRunner and Matrix.', link(base + 'hardware.html', 'Open JTAG / RGH page'), image.hardware)
    ) + note('<p>These methods have different motherboard, dashboard, storage and plugin requirements. Use the compatibility notes on the selected page before choosing apps or files.</p>')) +
    capturedByTitle('Xbox 360 Modding Safety', 'safety'), '#methods', 'Choose your method');

  page('console/xbox360/softmod.html', 'Xbox 360 Peer Pressure Softmod',
    'Peer Pressure 1.0.477, supported hardware, required files and developer installation instructions.', image.console, methodNav,
    captured('softmod') + more(), '#softmod', 'Read requirements');

  page('console/xbox360/hardware.html', 'Xbox 360 JTAG & RGH',
    'JTAG and RGH installation references, CoolRunner and Matrix hardware, and the requirements for your console’s modification method.', image.hardware, methodNav,
    captured('jtag-rgh') + normalize(content.rghAppNote) +
    section('next', 'After the hardware installation',
      `<div class="guide-links">${link(base + 'apps.html', 'Dashboards & apps')}${link(base + 'tools.html', 'PC tools')}${link(base + 'jailbreaks.html#safety', 'Read modding precautions')}</div>`), '#jtag-rgh', 'Browse hardware methods');

  page('console/xbox360/payloads.html', 'Xbox 360 Payloads & Temporary Exploits',
    'BadUpdate, ABadAvatar, FreeMyXe, XeUnshackle and XeLL release files with setup and compatibility notes.', image.payload, xbox360nav,
    captured('more-homebrew') + captured('app-setup') + more(), '#more-homebrew', 'Browse payloads');

  page('console/xbox360/apps.html', 'Xbox 360 Apps & Dashboards',
    'Aurora, FreeStyle Dash, XeXMenu, XM360, RetroArch, Neighborhood and NAND utilities for the modification method you already use.', image.aurora, xbox360nav,
    normalize(content.rghAppNote) + captured('aurora') + captured('homebrew') + more(), '#aurora', 'Browse dashboards & apps');

  page('console/xbox360/tools.html', 'Xbox 360 PC Tools',
    'FATXplorer, Velocity and XeCLI downloads for Windows, with storage, package and console-connection requirements.', image.tools, xbox360nav,
    captured('desktop-tools') + more(), '#desktop-tools', 'Browse PC tools');

  page('console/xbox360/mods.html', 'Xbox 360 Mods / Mod Menus',
    'Trainers, visual mods, save-game editing and Xbox 360 modding tools.', image.library, xbox360nav,
    require('./xbox360-mod-resources.cjs').gamesSection() +
    capturedByTitle('Game Modifications & Trainers', 'game-mods').replace('Game Modifications & Trainers', 'Mods, mod menus & trainers') +
    section('other-consoles', 'Mods on other consoles', `<div class="guide-links">${fullPageLink('/console/mods/', 'Choose another console')}</div>`) +
    more(), '#game-mods', 'Browse mods / mod menus');

  page('console/xbox360/downloads.html', 'Xbox 360 Downloads',
    'Xbox 360 installers, firmware references, trial files and the game-library directory. Check each file’s requirements for your modification method.', image.compatibility, xbox360nav,
    section('files', 'Files for your modification method', grid(
      originalResource('Peer Pressure 1.0.477'), originalResource('17559 System Update'),
      originalResource('Rock Band Blitz Trial'), originalResource('Xbox backwards compatibility')
    ), 'Match the file version and installation instructions to your console’s setup.') +
    captured('game-downloads') +
    section('other-downloads', 'Apps, payloads & desktop downloads',
      `<p>Read each app or payload’s installation and compatibility notes before downloading its release.</p><div class="guide-links">${link(base + 'apps.html', 'App downloads')}${link(base + 'payloads.html', 'Payload downloads')}${link(base + 'tools.html', 'PC-tool downloads')}</div>`), '#files', 'Browse files');
  require('./xbox360-mod-resources.cjs').buildGamePages();
  require('./build-discord-platform-resources.cjs').build('xbox360');
  console.log('Built Xbox 360 landing page and eight topic pages from the preserved content snapshot.');
}

module.exports = {buildXbox360Pages, xbox360nav, methodNav, routes, normalize};
if (require.main === module) buildXbox360Pages();
