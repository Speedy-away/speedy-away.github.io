const {page, section, grid, resource, ext, link, esc} = require('./build-console-guides.cjs');
const fs = require('node:fs');
const path = require('node:path');
const available = route => fs.existsSync(path.join(__dirname, '..', route.replace(/^\//, '')));
const localOr = (route, label, fallback, fallbackLabel) => available(route) ? link(route, label) : ext(fallback, fallbackLabel);

const art = '/assets/images/expansion-nintendo-retro/';
const nav = [
  ['/console/retro/', 'Retro Consoles'],
  ['/console/retro/wii.html', 'Wii'],
  ['/console/retro/wiiu.html', 'Wii U'],
  ['/console/retro/gamecube.html', 'GameCube'],
  ['/console/retro/ps2.html', 'PS2'],
  ['/console/retro/ds.html', 'DS & DSi'],
  ['/console/retro/3ds.html', '2DS & 3DS'],
  ['/console/xbox360/', 'Xbox 360']
];

function card(title, description, links, image, tags) {
  return resource(title, description, links, image)
    .replace('data-search="', `data-search="${esc(tags.join(' ').toLowerCase())} `)
    .replace('</h3>', `</h3><div class="game-features" aria-label="Console topics">${tags.map(tag => `<span class="feature">${esc(tag)}</span>`).join('')}</div>`);
}

function buildRetroPage() {
  const currentNav = [...nav];
  for (const [route, label] of [['/console/retro/xbox.html', 'Original Xbox'], ['/console/retro/psp.html', 'PSP'], ['/console/themes.html', 'Console themes']]) if (available(route)) currentNav.push([route, label]);
  page('console/retro/index.html', 'Retro Console Homebrew',
    'Wii U, Wii, GameCube, PS2, DS, DSi, Nintendo 2DS and 3DS homebrew, with setup guides, apps, custom firmware and tools for your console.',
    art + 'gamecube.png', currentNav,
    section('consoles', 'Home consoles', grid(
      card('Nintendo Wii', 'Set up the Homebrew Channel, browse Wii apps, manage your system menu and explore GameCube support with Nintendont.', link('/console/retro/wii.html', 'Explore Wii'), art + 'wii.png', ['Homebrew Channel', 'Apps', 'Nintendont']),
      card('Nintendo Wii U', 'Set up Aroma, browse WUHB apps and WPS plugins, back up saves, play homebrew games and choose compatible native emulators.', link('/console/retro/wiiu.html', 'Explore Wii U'), '/assets/images/wiiu-homebrew/library.svg', ['Aroma', 'WUHB Apps', 'Plugins', 'Emulators']),
      card('Nintendo GameCube', 'Choose a homebrew boot method, use Swiss, back up memory cards with GCMM and dump your discs with CleanRip.', link('/console/retro/gamecube.html', 'Explore GameCube'), art + 'gamecube.png', ['Swiss', 'Memory Cards', 'Disc Tools']),
      card('PlayStation 2', 'Compare FreeMcBoot and OpenTuna, then find Open PS2 Loader, wLaunchELF, Apollo saves and hardware information tools.', link('/console/retro/ps2.html', 'Explore PS2'), '/assets/images/expansion-ps2/fmcb.png', ['FreeMcBoot', 'OpenTuna', 'PS2 Apps']),
      card('Original Xbox', 'Original Xbox dashboards, native homebrew, ports and emulators, with model-specific setup and storage instructions.', localOr('/console/retro/xbox.html', 'Explore original Xbox', 'https://github.com/Rocky5/Xbox-Softmodding-Tool', 'Xbox Softmodding Tool'), '/assets/images/consoles/xbox.jpg', ['Softmod', 'Homebrew', 'Original Xbox'])
    ), 'Choose the physical console you are setting up. Each new platform page includes illustrated tools and its installation requirements.') +
    section('handhelds', 'Handheld consoles', grid(
      card('Nintendo DS & DSi', 'DS and DS Lite use a compatible flashcart; DSi has an SD-card homebrew route. Find TWiLight Menu++, nds-bootstrap and file tools.', link('/console/retro/ds.html', 'Explore DS & DSi'), art + 'twilight.png', ['Flashcarts', 'TWiLight Menu++', 'DSi CFW']),
      card('Nintendo 2DS & 3DS', 'Start with the maintained model and firmware guide, then explore Luma3DS, GodMode9, Universal-Updater, save backups and FTP.', link('/console/retro/3ds.html', 'Explore 2DS & 3DS'), art + 'luma.png', ['Luma3DS', 'Custom Firmware', 'Homebrew Apps']),
      card('PlayStation Portable', 'PSP apps, homebrew games, ports, emulators and themes, with ARK-4 model-specific installation resources.', localOr('/console/retro/psp.html', 'Explore PSP', 'https://github.com/PSP-Archive/ARK-4', 'ARK-4 project'), '/assets/images/emulators/PPSSPP.jpg', ['PSP', 'ARK-4', 'Themes']),
      card('PlayStation Vita', 'VPK apps, homebrew ports and emulators, plus HENlo, Ensō, Adrenaline and SD2Vita setup.', link(available('/console/psvita/library.html') ? '/console/psvita/library.html' : '/console/psvita/', 'Explore PS Vita'), '/assets/images/expansion-vita/vitadeploy.png', ['HENlo', 'Ensō', 'Vita Apps'])
    )) +
    section('browse', 'More console homebrew', grid(
      resource('Xbox 360 apps & tools', 'Dashboards, homebrew, file tools and storage helpers, with separate requirements for Peer Pressure, temporary exploits and RGH/JTAG.', link(available('/console/xbox360/library.html') ? '/console/xbox360/library.html' : '/console/xbox360/', 'Explore Xbox 360'), '/assets/images/consoles/xbox360.png'),
      resource('PlayStation 3 homebrew', 'PS3HEN and CFW guides, illustrated homebrew apps, save management and firmware tools.', link('/console/ps3/', 'Explore PS3'), '/assets/images/consoles/ps3.png'),
      ...(available('/console/themes.html') ? [resource('Console themes', 'Preview credited themes for Switch, Wii U, Nintendo 2DS / 3DS and PS3, then follow the installation guide for your console.', link('/console/themes.html', 'Browse themes'), art + 'luma.png')] : [])
    ) + `<div class="guide-links">${link('/console/', 'All console resources')}${link('/pc/emulators.html', 'PC emulators')}</div>`), '#consoles', 'Choose your console');
  const output=path.join(__dirname,'..','console/retro/index.html');
  const routed=require('./console-topic-navigation.cjs').apply('console/retro/index.html',fs.readFileSync(output,'utf8'));
  fs.writeFileSync(output,require('./search-page-output.cjs').finish('console/retro/index.html',require('./apply-site-background.cjs').improve(routed,'console/retro/index.html')));
  console.log('Built Retro landing with nine illustrated platform cards and Xbox 360 / PS3 links.');
}

if (require.main === module) buildRetroPage();
module.exports = {buildRetroPage};
