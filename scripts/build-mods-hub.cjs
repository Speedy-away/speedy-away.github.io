const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const platforms = [
  {name: 'PS4 / PS5', url: '/console/mods/ps4/', image: 'mods-ps4-ps5',
    alt: 'PlayStation 4 and PlayStation 5 consoles with their controllers',
    description: 'GTA V, Red Dead Redemption 2 and Call of Duty mod menus, downloads and installation guides.'},
  {name: 'PS3', url: '/console/ps3/mods.html', image: 'mods-ps3',
    alt: 'PlayStation 3 console and controller',
    description: 'PS3 game tools, Artemis cheats and CCAPI setup, with the requirements for each tool.'},
  {name: 'Xbox 360', url: '/console/xbox360/mods.html', image: 'mods-xbox360',
    alt: 'Xbox 360 console and controller',
    description: 'Xbox 360 trainers, game-mod setup and the dashboard requirements for your console.'}
];
function buildModsHub() {
  const {page, section, grid, esc} = require('./build-console-guides.cjs');
  const cards = platforms.map(platform => `<a class="guide-resource guide-firmware-card mod-console-card" href="${platform.url}" target="_blank" rel="noopener noreferrer" aria-label="Browse ${platform.name} mods and mod menus (opens in a new tab)"><img src="/assets/images/custom-mod-art/${platform.image}.jpg" alt="${esc(platform.alt)}" width="1672" height="940" loading="lazy"><h3>${platform.name}</h3><p>${esc(platform.description)}</p><span class="guide-firmware-open">Browse ${platform.name} <i class="fas fa-external-link-alt" aria-hidden="true"></i></span></a>`);
  page('console/mods/index.html', 'Mods / Mod Menus',
    'Choose your console to browse game mods, mod menus, downloads and setup guides.',
    '/assets/images/custom-mod-art/mods-ps4-ps5.jpg',
    [['/console/mods/', 'Mods / Mod Menus'], ...platforms.map(platform => [platform.url, platform.name])],
    section('platforms', 'Choose your console', grid(...cards).replace('class="games-grid"', 'class="games-grid mods-console-grid"'), 'Console catalogues open in a new tab. Choose a game inside its console page.'),
    '#platforms', 'Choose console');
  const file = path.join(root, 'console/mods/index.html');
  const html = fs.readFileSync(file, 'utf8').replace('</head>', '<link rel="stylesheet" href="/assets/console-mods.css?v=1">\n</head>');
  fs.writeFileSync(file, html);
}
if (require.main === module) buildModsHub();
module.exports = {buildModsHub, platforms};
