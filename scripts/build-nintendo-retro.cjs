const fs = require('node:fs');
const path = require('node:path');
const { page, section, grid, resource, note, steps, ext, link, sourceList, esc } = require('./build-console-guides.cjs');
const root = path.resolve(__dirname, '..');
const nav = [
  ['/console/retro/', 'Retro Consoles'],
  ['/console/retro/wii.html', 'Wii'],
  ['/console/retro/gamecube.html', 'GameCube'],
  ['/console/retro/ds.html', 'DS / DSi'],
  ['/console/retro/3ds.html', '2DS / 3DS'],
  ['/console/retro/ps2.html', 'PS2']
];

function buildNintendoRetro() {
  const catalog = JSON.parse(fs.readFileSync(path.join(root, 'docs/expansion-nintendo-retro.json'), 'utf8'));
  const jobs = JSON.parse(fs.readFileSync(path.join(root, 'docs/expansion-nintendo-retro-jobs.json'), 'utf8')).jobs;
  const byJob = Object.fromEntries(jobs.map(job => [job.id, job]));
  const byId = Object.fromEntries(catalog.apps.map(app => [app.id, app]));
  const img = id => `/assets/images/expansion-nintendo-retro/${id}.png`;
  const card = app => {
    const downloads = app.jobs.map((id, i) => ext(byJob[id].url, esc(app.labels[i]))).join('');
    const links = downloads + ext(app.project, 'Project &amp; requirements') + (app.guide ? ext(app.guide, 'Setup &amp; documentation') : '');
    const art = catalog.images.find(image => image.image === app.image);
    return resource(esc(app.title), esc(app.description), links, app.image)
      .replace('<article ', `<article id="${esc(app.id)}" `)
      .replace('data-search="', `data-search="${esc(app.tags.join(' ').toLowerCase())} ${esc(app.version)} `)
      .replace(/alt="[^"]* artwork"/, `alt="${esc(art?.description || app.title)}"`)
      .replace('</h3>', `</h3><div class="game-features" aria-label="Resource tags"><span class="feature">${esc(app.version)}</span>${app.tags.map(tag => `<span class="feature">${esc(tag)}</span>`).join('')}</div>`);
  };
  const cards = ids => grid(...ids.map(id => card(byId[id])));
  const docCard = (title, description, url, label, image) => resource(title, description, ext(url, label), img(image));

  page('console/retro/wii.html', 'Nintendo Wii Homebrew & Apps',
    'Wii homebrew setup, Priiloader, USB Loader GX, Nintendont, CleanRip and GameCube save tools with images and console-specific guides.',
    img('wii'), nav,
    section('start', 'Start with your Wii model',
      note('<p><strong>Wii, Wii mini and Wii U’s vWii have different setup routes.</strong> Use the maintained guide’s console selector. Homebrew Channel launches apps; cIOS adds features used by loaders. Install the files and settings documented for your model.</p>') +
      steps([
        ['Identify the console', 'Check whether you have a Wii / Family Edition, Wii mini or Wii mode on Wii U. An already modified system should use the guide’s existing-homebrew route.'],
        ['Prepare storage and homebrew access', 'Follow the selected exploit to install the Homebrew Channel. The Wii guide lists what SD or USB storage each model can use.'],
        ['Make the documented backup', 'Create and keep the console backup specified by the guide, then complete its Priiloader and model-specific cIOS sections before using loaders.']
      ]) + `<div class="guide-links">${ext('https://wii.hacks.guide/get-started.html', 'Choose your Wii setup guide')}${ext('https://wii.hacks.guide/cios.html', 'cIOS guide')}</div>`) +
    section('apps', 'Wii homebrew & system tools', cards(['priiloader', 'usbloadergx']),
      'Official project builds with installation documentation. Open a download or project link in a new tab.') +
    section('gamecube', 'GameCube software, discs & saves', cards(['nintendont', 'cleanrip-wii', 'gcmm-wii'])) +
    section('install', 'Add an app to the Homebrew Channel',
      steps([
        ['Extract the console build', 'For an app ZIP with an <code>apps</code> folder, copy that folder to the root of the storage device used by your Wii setup. Keep each app in its own subfolder.'],
        ['Keep the executable and app information together', 'A normal Homebrew Channel app folder contains <code>boot.dol</code> or <code>boot.elf</code>, with <code>meta.xml</code> and <code>icon.png</code> when supplied.'],
        ['Set up Nintendont’s three files', 'Rename the downloaded <code>loader.dol</code> to <code>boot.dol</code> and place it with its linked <code>meta.xml</code> and <code>icon.png</code> in <code>/apps/Nintendont/</code>. This page pins the upstream build snapshot rather than assigning it a new release number.'],
        ['Launch the app and finish its own setup', 'Open the Homebrew Channel, select the app and follow its project instructions. Loaders, storage devices and disc tools can have additional requirements.']
      ]) + `<div class="guide-links">${ext('https://github.com/FIX94/Nintendont#quick-installation', 'Nintendont installation')}${ext('https://wii.hacks.guide/recommended-homebrew.html', 'More Wii homebrew')}${link('/console/retro/gamecube.html', 'Original GameCube resources')}</div>`) +
    section('sources', 'Wii documentation', sourceList([
      ['https://wii.hacks.guide/', 'Wii Hacks Guide · model selection, homebrew and backups'],
      ['https://github.com/wiidev/usbloadergx', 'USB Loader GX · maintained project and releases'],
      ['https://github.com/emukidid/cleanrip', 'CleanRip · disc and storage requirements']
    ])), '#apps', 'Browse Wii apps');

  page('console/retro/gamecube.html', 'Nintendo GameCube Homebrew & Tools',
    'GameCube homebrew boot methods, Swiss, GCMM save backups and CleanRip disc tools with images, downloads and hardware requirements.',
    img('gamecube'), nav,
    section('start', 'Choose a GameCube boot method',
      `<p>Start by checking how your console can launch a DOL executable. <strong>Swiss is a homebrew utility and launcher.</strong> Its files work after you have a compatible way to boot homebrew.</p>` + grid(
        docCard('Homebrew on an unmodified GameCube', 'A supported game-save exploit needs the matching game and prepared memory-card files. Check the exact game region and revision in the documentation.', 'https://www.gc-forever.com/wiki/index.php?title=Booting_homebrew', 'Read boot-method guide', 'gamecube'),
        docCard('Storage & hardware boot methods', 'Existing optical-drive replacements and IPL modifications have their own Swiss filename, storage and boot instructions. Match the release files to your installed device.', 'https://github.com/emukidid/swiss-gc#requirements', 'Check Swiss requirements', 'gcmm')
      )) +
    section('apps', 'GameCube apps & homebrew tools', cards(['swiss', 'gcmm', 'cleanrip-gamecube']),
      'The GameCube DOL builds run on original hardware with an established homebrew entry point.') +
    section('setup', 'Load a GameCube homebrew app',
      steps([
        ['Prepare your boot route', 'Follow the documentation for the save exploit or device already fitted to the console. A storage adapter provides storage; it still needs a suitable homebrew launch method.'],
        ['Choose the matching Swiss files', 'Extract the Swiss release and use the DOL, GCI or device-specific file called for by your setup. The release contains multiple forms for different boot methods.'],
        ['Launch the application', 'Use Swiss to browse supported storage and open the app’s GameCube DOL. Keep any required data files beside it as documented by that project.'],
        ['Back up memory cards first', 'Use GCMM to keep an original save or raw card backup before restoring memory-card data. Choose the GameCube build of CleanRip when making disc backups on the GameCube.']
      ]) + `<div class="guide-links">${ext('https://www.gc-forever.com/wiki/index.php?title=Swiss/Usage', 'Swiss usage guide')}${link('/console/retro/wii.html#gamecube', 'GameCube apps on Wii')}</div>`) +
    section('sources', 'GameCube documentation & image credit', sourceList([
      ['https://www.gc-forever.com/wiki/index.php?title=Booting_homebrew', 'GC-Forever · boot methods and prerequisites'],
      ['https://github.com/emukidid/swiss-gc', 'Swiss · supported devices, builds and controls'],
      ['https://github.com/suloku/gcmm', 'GCMM · card backup and restore documentation'],
      ['https://commons.wikimedia.org/wiki/File:GameCube-Console-Set.png', 'GameCube console photograph · Evan-Amos, public domain']
    ])), '#apps', 'Browse GameCube tools');

  page('console/retro/ds.html', 'Nintendo DS & DSi Homebrew Apps',
    'DS and DSi homebrew setup, flashcart and SD routes, TWiLight Menu++, nds-bootstrap, GodMode9i and FTP tools with images and downloads.',
    img('twilight'), nav,
    section('start', 'Choose DS / DS Lite or DSi', grid(
      docCard('Nintendo DS / DS Lite · flashcart', 'Use a supported flashcart and its microSD card. The TWiLight Menu++ Flashcard package is separate from the DSi and 3DS SD-card builds.', 'https://wiki.ds-homebrew.com/twilightmenu/installing-flashcard', 'Read flashcart setup guide', 'twilight'),
      docCard('Nintendo DSi / DSi XL · SD card', 'Use the maintained DSi guide for an SD-card entry point, homebrew setup and a NAND backup. It also explains the optional Unlaunch bootcode installation and its risks.', 'https://dsi.cfw.guide/', 'Read DSi setup guide', 'godmode9i')
    ) + `<p>For Nintendo 2DS, 3DS and New models, use the separate ${link('/console/retro/3ds.html', '2DS / 3DS page')}. Those systems have their own CFW setup and TWiLight Menu++ package.</p>`) +
    section('apps', 'DS / DSi apps & homebrew tools', cards(['twilight', 'nds-bootstrap', 'godmode9i', 'ftpd-ds'])) +
    section('setup', 'Prepare and launch DS homebrew',
      steps([
        ['Choose the right package', 'A DS / DS Lite uses the Flashcard TWiLight package with a compatible flashcart. A DSi SD-card setup uses the DSi package and its documented entry point.'],
        ['Keep the supplied folder layout', 'Extract the package and follow the matching installation page. For the Flashcard package, its <code>_nds</code> folder, <code>roms</code> folder and documented boot NDS file go at the flashcart microSD root.'],
        ['Use the correct app format', 'Open the NDS or DSi build through the launcher specified by the project. GodMode9i’s cartridge functions have additional model-specific access requirements.'],
        ['Keep a backup before changes', 'Copy your existing saves and SD files before replacing a setup. On DSi, follow the NAND-backup instructions before choosing whether to install Unlaunch.']
      ]) + sourceList([
        ['https://wiki.ds-homebrew.com/twilightmenu/installing-flashcard', 'Flashcart installation · supported boot files and card-specific settings'],
        ['https://wiki.ds-homebrew.com/twilightmenu/installing-dsi', 'DSi installation · SD-card package and entry point'],
        ['https://dsi.cfw.guide/dumping-nand.html', 'DSi NAND backup procedure'],
        ['https://wiki.ds-homebrew.com/godmode9i/', 'GodMode9i · cartridge and save access by model']
      ])) +
    section('more', 'More DS / DSi homebrew',
      `<p>Browse the maintained DS-Homebrew documentation for compatibility and usage, or Universal-DB for additional homebrew projects. Check each app’s supported launch mode before copying it to your console.</p><div class="guide-links">${ext('https://wiki.ds-homebrew.com/', 'DS-Homebrew documentation')}${ext('https://db.universal-team.net/ds', 'DS homebrew directory')}${link('/console/retro/3ds.html#twilight-3ds', 'TWiLight Menu++ on 3DS')}</div>`), '#apps', 'Browse DS apps');

  page('console/retro/3ds.html', 'Nintendo 2DS & 3DS CFW, Apps & Homebrew',
    '2DS and 3DS CFW setup with Luma3DS, GodMode9, Universal-Updater, Checkpoint, ftpd and TWiLight Menu++ with images and ready console builds.',
    img('luma'), nav,
    section('start', 'Set up CFW for the 2DS / 3DS family',
      `<p>The maintained 3DS guide covers Nintendo 2DS, 3DS, XL and New-family consoles. It installs <strong>boot9strap and Luma3DS</strong>, then prepares homebrew and system backups. Choose its route using your exact model and installed firmware.</p>` +
      steps([
        ['Check for an existing setup', 'Power off, hold Select and turn the system on. Use the maintained CFW-check page to identify any configuration menu and choose its documented update or restore route.'],
        ['Follow the model and firmware selector', 'For a stock system, begin at the guide’s Get Started page and complete its matching exploit and boot9strap sections.'],
        ['Finish setup and save the backups', 'Complete Finalizing Setup, including the system backup and essential-file backup. Keep copies away from the SD card before adding more apps.']
      ]) + `<div class="guide-links">${ext('https://3ds.hacks.guide/get-started.html', 'Start 2DS / 3DS CFW guide')}${ext('https://3ds.hacks.guide/checking-for-cfw.html', 'Check existing CFW')}${ext('https://3ds.hacks.guide/finalizing-setup.html', 'Finalizing setup')}</div>`) +
    section('apps', 'CFW, apps & homebrew tools', cards(['luma', 'godmode9', 'universal-updater', 'checkpoint', 'ftpd-3ds', 'twilight-3ds']),
      'Ready console builds for an already prepared 2DS / 3DS. Read each project’s requirements before installing.') +
    section('install', 'Choose CIA, 3DSX or FIRM',
      steps([
        ['CIA apps', 'Install a CIA with the package installer prepared by the CFW guide. It then appears on HOME Menu. Universal-Updater can download and update supported homebrew directly.'],
        ['3DSX homebrew', 'A 3DSX executable normally goes under <code>/3ds/</code> on the SD card and runs through the Homebrew Launcher. Use the format named by the app’s documentation.'],
        ['FIRM payloads', 'GodMode9 and Luma use system or payload files, rather than ordinary HOME Menu application installs. Follow the guide’s exact file paths and boot steps for these tools.'],
        ['DS-mode software', 'Use the 3DS-specific TWiLight Menu++ installation instructions for DS-mode homebrew. The DS flashcart package belongs to a different setup.']
      ]) + `<div class="guide-links">${ext('https://3ds.hacks.guide/godmode9-usage.html', 'GodMode9 usage guide')}${ext('https://wiki.ds-homebrew.com/twilightmenu/installing-3ds', 'TWiLight 3DS installation')}${ext('https://db.universal-team.net/3ds', 'More 3DS homebrew')}</div>`) +
    section('sources', '2DS / 3DS documentation', sourceList([
      ['https://3ds.hacks.guide/', '3DS Hacks Guide · CFW installation, final setup and backups'],
      ['https://github.com/LumaTeam/Luma3DS', 'Luma3DS · features and persistent-exploit requirement'],
      ['https://github.com/Universal-Team/Universal-Updater', 'Universal-Updater · app installation and Unistores'],
      ['https://github.com/BernardoGiordano/Checkpoint', 'Checkpoint · supported saves and launch environments']
    ])), '#apps', 'Browse 2DS / 3DS apps');

  for (const [file, platform] of [['wii.html', 'wii'], ['gamecube.html', 'gamecube'], ['ds.html', 'ds'], ['3ds.html', '3ds']]) {
    const names = catalog.apps.filter(app => app.platform === platform).flatMap(app => [app.title, ...app.tags]);
    const keywords = [...new Set([platform === '3ds' ? 'Nintendo 2DS, Nintendo 3DS, New Nintendo 3DS, 3DS CFW' : `Nintendo ${platform}`, 'homebrew', 'apps', 'setup guides', 'downloads', ...names])].join(', ');
    const filePath = path.join(root, 'console/retro', file);
    fs.writeFileSync(filePath, require('./search-page-output.cjs').finish(filePath, fs.readFileSync(filePath, 'utf8').replace(/<meta name="keywords" content="[^"]*">/, `<meta name="keywords" content="${esc(keywords)}">`)));
  }
  return { pages: catalog.pages, apps: catalog.apps.length, downloads: jobs.length };
}

if (require.main === module) console.log('Built Nintendo retro resources:', buildNintendoRetro());
module.exports = { buildNintendoRetro };
