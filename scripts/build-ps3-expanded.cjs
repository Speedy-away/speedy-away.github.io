const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const data = require('../docs/expansion-ps3.json');

function homebrewSection() {
  const {section, grid, resource, ext, esc} = require('./build-console-guides.cjs');
  const cards = data.apps.map(app => {
    const primary = app.download
      ? `<a href="${esc(app.url)}"${app.url.startsWith('/') ? ' download' : ' target="_blank" rel="noopener noreferrer"'}>${esc(app.label)} <i class="fas fa-download" aria-hidden="true"></i></a>`
      : ext(app.url, app.label);
    const release = app.id === 'ezremote' ? 'https://github.com/cy33hc/ps3-ezremote-client/releases/tag/1.15'
      : app.id === 'simplefm' ? 'https://github.com/lmirel/fm_psx/releases/tag/v0.5.2'
      : app.id === 'managunz' ? 'https://github.com/Zarh/ManaGunZ/releases/tag/1.41' : '';
    return resource(app.title, app.description, primary + (release ? ext(release, 'Release notes') : ''), app.image);
  });
  return section('homebrew', 'PS3 apps & homebrew tools', grid(...cards), 'File managers, network services, storage utilities and emulation resources. Check each project’s requirements for your HEN or CFW setup.');
}

function directoriesSection() {
  const {section, grid, resource, ext} = require('./build-console-guides.cjs');
  const existing = require('../docs/ps3-resource-images.json');
  return section('downloads493', 'Homebrew & game downloads', grid(
    resource('PS3 homebrew', 'Brewology’s PS3 application directory.', ext('https://store.brewology.com/homebrew.php?lang=', 'Browse homebrew'), existing.homebrew.image),
    resource('Vimm’s Lair · PS3', 'External PS3 catalog supplied for this page. Check the site for current availability.', ext('https://vimm.net/vault/PS3', 'Open PS3 library'), existing.vimm.image)
  ));
}

function illustrateTools(file, titles) {
  const {esc} = require('./build-console-guides.cjs');
  let html = fs.readFileSync(file, 'utf8');
  const found = new Set();
  html = html.replace(/<article class="guide-resource"[\s\S]*?<\/article>/g, card => {
    const title = card.match(/<h3>([^<]+)<\/h3>/)?.[1].replaceAll('&amp;', '&');
    const image = titles[title];
    if (!image) return card;
    found.add(title);
    const markup = `<img src="${esc(image)}" alt="${esc(title)} artwork" loading="lazy">`;
    return /<img\b[^>]*>/.test(card) ? card.replace(/<img\b[^>]*>/, markup) : card.replace('<h3>', markup + '<h3>');
  });
  for (const title of Object.keys(titles)) if (!found.has(title)) throw new Error('Missing PS3 tool card: ' + title);
  fs.writeFileSync(file, html);
}

function buildPs3Expanded() {
  const file = path.join(root, 'console/ps3.html');
  let html = fs.readFileSync(file, 'utf8');
  if (/\bdata-console-migration=["']ps3["']/.test(html)) {
    return require('./build-ps3-pages.cjs').buildPs3Pages();
  }
  const apps = /<section class="section" id="homebrew">[\s\S]*?<\/section>/;
  if (!apps.test(html)) throw new Error('Existing PS3 homebrew section not found');
  html = html.replace(apps, '');
  const directories = /<section class="section" id="downloads493">[\s\S]*?<\/section>/;
  if (!directories.test(html)) throw new Error('PS3 homebrew directory section not found');
  html = html.replace(directories, directoriesSection() + homebrewSection());
  fs.writeFileSync(file, html);

  const image = data.toolImages;
  illustrateTools(path.join(root, 'console/ps3/cfw.html'), {
    'PS3Xploit': image.ps3xploit,
    'PS3 Toolset': image.toolset,
    'Rufus': image.rufus,
    'PyPS3checker / PyPS3tools': image.pyps3tools,
    'Evilnat 4.93 CFW': image.evilnat
  });
  illustrateTools(path.join(root, 'console/ps3/hen.html'), {
    'HFW 4.93.1': image.hfw,
    'PS3HEN installer': image.hen,
    'Homebrew & multiMAN': image.homebrew
  });
  console.log('Expanded PS3 homebrew: ' + data.apps.length + ' illustrated app cards and eight HEN/CFW tool images.');
}

module.exports = {homebrewSection, directoriesSection, buildPs3Expanded};
if (require.main === module) buildPs3Expanded();
