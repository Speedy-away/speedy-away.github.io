const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const captured = require('../docs/console-page-content-ps3.json');
const ps3nav = [
  ['/console/ps3/', 'PS3'], ['/console/ps3/jailbreaks.html', 'Jailbreak'],
  ['/console/ps3/apps.html', 'Apps'], ['/console/ps3/transfer-tools.html', 'Transfer Tools'],
  ['/console/ps3/save-tools.html', 'Save Tools'], ['/console/ps3/emulators.html', 'Emulators'],
  ['/console/ps3/mods.html', 'Mods / Mod Menus'], ['/console/ps3/downloads.html', 'Downloads'],
  ['/console/ps3/jailbreaks.html#firmware-downloads', 'Firmware']
];
const guideNav = [
  ['/console/ps3/', 'PS3'], ['/console/ps3/jailbreaks.html', 'Jailbreak'],
  ['/console/ps3/hen.html', 'HEN 4.93'], ['/console/ps3/cfw.html', 'CFW 4.93'],
  ['/console/ps3/apps.html', 'Apps'], ['/console/ps3/downloads.html', 'Downloads'],
  ['/console/ps3/jailbreaks.html#firmware-downloads', 'Firmware']
];
const legacyAnchors = {
  setup493: '/console/ps3/jailbreaks.html#setup493',
  cfw: '/console/ps3/cfw.html#cfw', hen: '/console/ps3/hen.html#hen',
  homebrew: '/console/ps3/apps.html#homebrew', downloads493: '/console/ps3/downloads.html#downloads493',
  'save-tools': '/console/ps3/save-tools.html#save-tools',
  mods: '/console/ps3/mods.html#mods', safety: '/console/ps3/jailbreaks.html#safety'
};
const plain = text => text.replace(/<[^>]*>/g, ' ').replaceAll('&amp;', '&').replace(/\s+/g, ' ').trim();
const sectionHtml = id => {
  const found = captured.sections.find(item => item.id === id);
  if (!found) throw Error('Missing captured PS3 section: ' + id);
  return found.html;
};

function normalize(html, base = '/console/ps3.html') {
  const {esc} = require('./build-console-guides.cjs');
  return html.replace(/\b(href|src)="([^"]*)"/g, (all, attr, value) => {
    if (!value || /^(?:https?:|mailto:|tel:|data:|javascript:)/.test(value)) return all;
    if (value.startsWith('#')) {
      return base === '/console/ps3.html' && legacyAnchors[value.slice(1)] ? `${attr}="${legacyAnchors[value.slice(1)]}"` : all;
    }
    const url = new URL(value.replaceAll('&amp;', '&'), 'https://whatwhatboy.com' + base);
    if (url.pathname === '/console/ps3.html') {
      const target = legacyAnchors[url.hash.slice(1)] || '/console/ps3/' + url.hash;
      return `${attr}="${esc(target)}"`;
    }
    return `${attr}="${esc(url.pathname + url.search + url.hash)}"`;
  });
}

function cards(html) {
  const result = [];
  const starts = /<(article|div)\b[^>]*class="[^"]*\b(?:guide-resource|game-card)\b[^"]*"[^>]*>/g;
  let found;
  while ((found = starts.exec(html))) {
    const tag = found[1], tokens = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'g');
    tokens.lastIndex = starts.lastIndex;
    let depth = 1, token;
    while (depth && (token = tokens.exec(html))) depth += token[1] ? -1 : 1;
    if (depth) throw Error('Unclosed PS3 resource card');
    const card = normalize(html.slice(found.index, tokens.lastIndex));
    const title = plain(card.match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/)?.[1] || '');
    if (!title) throw Error('PS3 card has no title');
    result.push({title, html: card});
    starts.lastIndex = tokens.lastIndex;
  }
  return result;
}

function renderCard(item) {
  const toolImage={'CCAPI (Control Console API)':'ccapi','Artemis PS3':'artemis','PSNinja':'psninja'}[item.title];
  if (item.html.startsWith('<article')) return toolImage?item.html.replace(/(<img\b[^>]*src=")[^"]+/,`$1/assets/images/game-card-covers/${toolImage}-tool-v1.svg`):item.html;
  const {resource, esc} = require('./build-console-guides.cjs');
  const h = item.html;
  const description = h.match(/<p\b[^>]*class="game-description"[^>]*>([\s\S]*?)<\/p>/)?.[1] || '';
  const image = toolImage?`/assets/images/game-card-covers/${toolImage}-tool-v1.svg`:h.match(/<img\b[^>]*src="([^"]+)"/)?.[1] || '';
  const links = [...h.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/g)].map(m => m[0]).join('') || (h.includes('No verified download linked.') ? '<span>No verified download linked.</span>' : '');
  const features = h.match(/<div class="game-features">[\s\S]*?<\/div>/)?.[0] || '';
  const status = h.match(/<span class="game-status[^"]*">([^<]*)<\/span>/)?.[1];
  return resource(esc(item.title), description, links, image)
    .replace('</h3>', `</h3>${status ? `<div class="game-features"><span class="feature">${esc(status)}</span></div>` : ''}${features}`);
}

function firmwareArchives() {
  const {section, grid, resource, note, ext} = require('./build-console-guides.cjs');
  return section('firmware-downloads', 'PS3 firmware archives', grid(
    resource('PS3 OFW · official firmware', 'Browse Darthsternie’s PS3 system-firmware archive, including official releases and separately labelled hybrid and special-purpose firmware.', ext('https://darthsternie.net/ps3-firmwares/', 'Browse PS3 OFW archive'), '/assets/images/consoles/ps3.png'),
    resource('PS3 CFW · custom firmware', 'Browse archived custom firmware by version and build type. Match the CEX, DEX or other listed variant to your console and installation guide.', ext('https://darthsternie.net/ps3-cfws/', 'Browse PS3 CFW archive'), '/assets/images/consoles/ps3.png')
  ) + note('<p>OFW, HFW and CFW serve different purposes. Keep the firmware version and model requirements from your chosen guide, and compare the downloaded file with the archive’s listed checksum before use.</p>'), 'Separate official and custom firmware directories from Darthsternie.');
}

function buildPs3Pages(options = {}) {
  const {section, grid, resource, note, link, esc} = require('./build-console-guides.cjs');
  const {page: renderPage} = require('./ps3-page.cjs');
  const selected=options.onlyPages?new Set(options.onlyPages):null;
  if(selected&&[...selected].some(file=>!/^console\/ps3\/[a-z0-9-]+\.html$/.test(file)))throw Error('Select PS3 topic-page filenames only');
  const page=(file,...args)=>{if(!selected||selected.has(file))renderPage(file,...args);};
  if(!options.skipResourceRefresh) require('./build-ps3-resource-data.cjs').build();
  const catalog = require('./build-ps3-catalog.cjs');
  const fullPageLink = (url, label) => link(url, label).replace(/\sdata-guide-open\b/g, '').replace('<a ', '<a target="_blank" rel="noopener noreferrer" ');
  const appCards = cards(sectionHtml('homebrew'));
  const modCards = cards(sectionHtml('mods'));
  const transferTitles = new Set(['webMAN MOD', 'ezRemote Client', 'Simple File Manager']);
  const saveTitles = new Set(['Bruteforce Save Data']);
  const byTitle = title => {
    const found = [...appCards, ...modCards].find(item => item.title === title);
    if (!found) throw Error('Missing existing PS3 card: ' + title);
    return found;
  };
  const list = items => grid(...items.map(renderCard));
  const related = () => section('more', 'More for your PS3', `<div class="guide-links">${ps3nav.map(([url, label]) => link(url, esc(label))).join('')}</div>`);
  const image = '/assets/images/consoles/ps3.png';
  const apolloImage = '/assets/images/consoles/apollo-save-tool.png';
  const safety = normalize(sectionHtml('safety')).replace('<section class="section">', '<section class="section" id="safety">');

  page('console/ps3/index.html', 'PlayStation 3 Homebrew',
    'PS3 jailbreak guides, homebrew apps, file transfers, save tools, emulators, game mod tools and downloads.', image, ps3nav,
    section('start', 'PS3 guides & downloads', grid(
      resource('Jailbreak', 'Choose HEN on HFW 4.93.1 or the Evilnat 4.93 CFW guide for your model and firmware.', link('/console/ps3/jailbreaks.html', 'Choose your route'), '/assets/images/ps3-resources/ps3xploit.jpg'),
      resource('Apps & homebrew', 'multiMAN, IRISMAN, PKGi, prepISO and ManaGunZ packages, with project requirements.', link('/console/ps3/apps.html', 'Browse apps'), '/assets/images/expansion-ps3/irisman.png'),
      resource('Transfer tools', 'Use webMAN MOD, ezRemote or Simple File Manager for network services and file management.', link('/console/ps3/transfer-tools.html', 'Browse transfer tools'), '/assets/images/expansion-ps3/ezremote.png'),
      resource('Save tools', 'Back up and manage PS3 saves with Apollo Save Tool, or browse legacy save-editing tools.', link('/console/ps3/save-tools.html', 'Browse save tools'), apolloImage),
      resource('Emulators', 'RetroArch for PS3 and its platform information.', link('/console/ps3/emulators.html', 'Browse emulators'), '/assets/images/emulators/retroarch.png'),
      resource('Mods / Mod Menus', 'GTA V 1.27, GTA IV, Call of Duty and Uncharted game catalogues, with archived console files and build requirements.', fullPageLink('/console/ps3/mods.html', 'Browse mods / mod menus'), '/assets/images/custom-mod-art/mods-ps3.jpg'),
      resource('PS3 console downloads', 'A PS3-only file list with homebrew PKGs, game-mod archives and optional webMAN download links.', link('/console/ps3/downloads.html', 'Browse downloads'), '/assets/images/ps3-resources/pkgi.png'),
      resource('Firmware', 'Separate PS3 official firmware (OFW) and custom firmware (CFW) archives from Darthsternie.', link('/console/ps3/jailbreaks.html#firmware-downloads', 'Browse firmware'), image)
    ), 'Choose a topic for guides, apps and downloads.'), '#start', 'Choose a page');

  page('console/ps3/jailbreaks.html', 'PS3 Jailbreak',
    'Choose HEN or CFW for your PS3 model. Keep the current firmware and check the route before downloading system files.', '/assets/images/ps3-resources/ps3xploit.jpg', ps3nav,
    section('setup493', 'Choose your PS3 route',
      note('<p><strong>HEN and CFW are different routes.</strong> The HEN 4.93 guide uses HFW 4.93.1. The CFW guide checks model eligibility before the Evilnat 4.93 installation.</p>') + grid(
        resource('HEN on HFW 4.93.1', 'Hybrid firmware, the official HEN installer and homebrew setup steps.', link('/console/ps3/hen.html', 'Open HEN page'), '/assets/images/ps3-resources/ps3xploit.jpg'),
        resource('Evilnat 4.93 CFW', 'Model compatibility, flash-dump checks and a firmware installation workflow.', link('/console/ps3/cfw.html', 'Open CFW page'), image)
      )) + firmwareArchives() + safety, '#setup493', 'Choose HEN or CFW');

  const legacyHen = cards(sectionHtml('hen'));
  for (const kind of ['hen', 'cfw']) {
    const original = captured.guides[kind];
    const originalSections = [...original.matchAll(/<section\b[^>]*>[\s\S]*?<\/section>/g)].map(m => normalize(m[0], `/console/ps3/${kind}.html`)).join('');
    const legacy = kind === 'hen' ? legacyHen.filter(item => item.title !== 'BGToolset') : cards(sectionHtml('cfw'));
    const legacySection = section(kind, kind === 'hen' ? 'HEN installers & project links' : 'CFW projects & legacy releases', list(legacy), kind === 'cfw' ? 'Rebug, FERROX and Evilnat have their own firmware and model requirements. Check the release for your console.' : 'Project documentation and browser-based HEN installers.');
    const tools = kind === 'cfw' ? section('toolset', 'Console inspection & CFW eligibility', list(legacyHen.filter(item => item.title === 'BGToolset'))) : '';
    const title = kind === 'hen' ? 'PS3 HEN Guide for 4.93' : 'PS3 4.93 CFW Guide';
    const description = kind === 'hen' ? 'Install compatible hybrid firmware, set up PS3HEN and enable homebrew on a supported PS3 configuration.' : 'Check CFW eligibility, back up and validate flash memory, then use the matching Evilnat 4.93 release.';
    page(`console/ps3/${kind}.html`, title, description, image, guideNav, originalSections + legacySection + tools + (kind === 'cfw' ? firmwareArchives() : '') + related(), kind === 'hen' ? '#requirements' : '#compatibility', 'Start with requirements');
  }

  page('console/ps3/apps.html', 'PS3 Apps & Homebrew',
    'PS3 homebrew apps, package tools and library managers, with project requirements and downloads.', '/assets/images/expansion-ps3/irisman.png', ps3nav,
    section('homebrew', 'Apps & homebrew tools', list(appCards.filter(item => !transferTitles.has(item.title) && item.title !== 'RetroArch · PS3')), 'Package installation, game-library management and homebrew utilities.') + catalog.extraApps() + related(), '#homebrew', 'Browse apps');
  page('console/ps3/transfer-tools.html', 'PS3 Transfer Tools',
    'File clients and network services for your PS3 HEN or CFW setup.', '/assets/images/expansion-ps3/ezremote.png', ps3nav,
    catalog.transferWorkflow() + section('transfer-tools', 'File management & network services', list(appCards.filter(item => transferTitles.has(item.title)))) + catalog.extraApps({includeCustomization:false}) + related(), '#browser-files', 'Open transfer workflow', ['PS3 browser','webMAN MOD','FTP','HTTP','PKG','SPRX','RAR','ZIP','ezRemote','file manager','HEN','CFW']);
  page('console/ps3/save-tools.html', 'PS3 Save Tools',
    'Manage PS3 saves with Apollo Save Tool and browse legacy save-editing tools.', apolloImage, ps3nav,
    normalize(sectionHtml('save-tools')) + section('legacy-save-tools', 'Legacy save tools', list([byTitle('Bruteforce Save Data')])) + related(), '#save-tools', 'Browse save tools');
  page('console/ps3/emulators.html', 'Emulators on PS3',
    'RetroArch for PS3, with its platform information and project link.', '/assets/images/emulators/retroarch.png', ps3nav,
    section('emulators', 'Emulators on PS3', list([byTitle('RetroArch · PS3')])) + related(), '#emulators', 'Browse emulators');
  page('console/ps3/mods.html', 'PS3 Mods / Mod Menus',
    'GTA V 1.27, GTA IV, Call of Duty, Uncharted and Dead Island mods, console files and compatibility notes.', '/assets/images/custom-mod-art/mods-ps3.jpg', ps3nav,
    catalog.chooser() + catalog.compatibility() + section('mods', 'Console mod utilities & legacy resources', list(modCards.filter(item => !saveTitles.has(item.title)))) +
    section('other-consoles', 'Mods on other consoles', `<div class="guide-links">${fullPageLink('/console/mods/', 'Choose another console')}</div>`) +
    related(), '#games', 'Choose a game', ['GTA V 1.27','GTA IV','BO1','BO2','Call of Duty','Uncharted','SPRX','mod loader','HEN','CFW','CEX','DEX','RTM']);
  page('console/ps3/downloads.html', 'PS3 Downloads',
    'PS3 homebrew packages and game-mod files, with browser downloads, archive extraction and installation steps.', '/assets/images/ps3-resources/pkgi.png', ps3nav,
    section('console-files', 'Downloads for your PS3', grid(
      resource('Console file list', 'PS3 PKGs, extracted game files and original archives, with sizes and SHA-256 hashes. No desktop helpers or other console packages.', fullPageLink('/console/ps3/browser-downloads.html','Open PS3 file list'), '/assets/images/consoles/ps3.png'),
      resource('Game mods', 'Browse the matching game, title update, region and HEN/CEX/DEX build before downloading.',fullPageLink('/console/ps3/mods.html','Choose a PS3 game'),'/assets/images/custom-mod-art/mods-ps3.jpg'),
      resource('Desktop RTM helpers', 'Windows-side tools for PS3 games have a separate catalogue and archive role.',fullPageLink('/console/ps3/desktop-tools.html','Browse PC helpers'),'/assets/images/menu-previews/ps3-base/project-safe-candidate-XGKwgja1B00.jpg')
    )) + catalog.transferWorkflow() + normalize(sectionHtml('downloads493')) + firmwareArchives() + related(), '#console-files', 'Open download options', ['PS3 PKG','PS3 browser downloads','SPRX','RAR','ZIP','webMAN MOD','homebrew','HEN','CFW']);
  if(!selected){
    catalog.build(ps3nav);
    catalog.buildArchiveServer(ps3nav);
    require('./build-ps3-browser-downloads.cjs').build();
  }
  // Merge only PS3 URLs into the latest sitemap, preserving other active work.
  const sitemapPath = path.join(root, 'sitemap.xml');
  let sitemap = fs.readFileSync(sitemapPath, 'utf8');
  const files = directory => fs.readdirSync(directory, {withFileTypes:true}).flatMap(entry => entry.isDirectory() ? files(path.join(directory,entry.name)) : entry.name.endsWith('.html') ? [path.join(directory,entry.name)] : []);
  const additions = files(path.join(root,'console/ps3')).filter(file=>!/<meta name="robots" content="noindex, follow">/.test(fs.readFileSync(file,'utf8'))).map(file => 'https://whatwhatboy.com/' + path.relative(root,file).replaceAll('\\','/').replace(/index\.html$/,''))
    .filter(url => !sitemap.includes('<loc>'+url+'</loc>'));
  if (additions.length) {
    sitemap = sitemap.replace('</urlset>', additions.map(url=>`  <url><loc>${url}</loc><lastmod>2026-11-02</lastmod></url>`).join('\n')+'\n</urlset>');
    fs.writeFileSync(sitemapPath,sitemap);
  }
  console.log(selected?'Built selected PS3 topic pages: '+[...selected].join(', '):'Built PS3 hub, topic pages and game catalogues.');
}

if (require.main === module) buildPs3Pages();
module.exports = {buildPs3Pages, ps3nav, guideNav, legacyAnchors, firmwareArchives};
