const fs = require('node:fs');
const path = require('node:path');
const {
  page, section, grid, resource, note, steps, videoEmbed, ext, link, sourceList, esc
} = require('./build-console-guides.cjs');
const apollo = require('./apollo-tools.cjs');
const root = path.resolve(__dirname, '..');
const nav = [
  ['/console/psvita/', 'PS Vita'],
  ['/console/psvita/jailbreak.html', 'Jailbreak Guide'],
  ['/console/psvita/cfw.html', 'CFW & Ensō'],
  ['/console/psvita/#firmware-downloads', 'Firmware archive'],
  ['/console/psvita/apps.html', 'Apps & Homebrew'],
  ['/console/psvita/library.html', 'Homebrew Library'],
  ['/console/psvita/#save-tools', 'Save Tools']
];
const guideImage = require('./custom-console-art.cjs').image('vita-henlo');
const host = 'https://jailbreak.psp2.dev/';
const hacksGuide = 'https://vita.hacks.guide/';
const henloGuide = 'https://vita.hacks.guide/using-henlo.html';
const storageGuide = 'https://vita.hacks.guide/creating-an-internal-memory-card.html';
const ensoGuide = 'https://vita.hacks.guide/installing-enso.html';
const finalGuide = 'https://vita.hacks.guide/finalizing-setup.html';
const yamtGuide = 'https://vita.hacks.guide/yamt.html';
const firmwareArchive = 'https://darthsternie.net/ps-vita-firmwares/';
const firmwareSection = () => section('firmware-downloads', 'PS Vita firmware archive',
  `<p>Darthsternie’s archive lists normal, preinstalled and systemdata firmware packages with version numbers, file sizes and MD5 hashes. Choose the package type and version required by your setup guide.</p><p>These are system-software files. For HENkaku and persistent homebrew, follow the separate jailbreak and Ensō guides; the setup on this site remains pinned to VitaDeploy’s Quick 3.65 Install.</p><div class="guide-links">${ext(firmwareArchive, 'Browse PS Vita firmwares · Darthsternie')}</div>`);

function buildVitaGuides() {
  const catalog = JSON.parse(fs.readFileSync(path.join(root, 'docs/expansion-vita.json'), 'utf8'));
  const jobs = JSON.parse(fs.readFileSync(path.join(root, 'docs/expansion-vita-jobs.json'), 'utf8')).jobs;
  const byId = Object.fromEntries(catalog.apps.map(app => [app.id, app]));
  const byJob = Object.fromEntries(jobs.map(job => [job.id, job]));
  const download = app => app.download
    ? `<a href="${esc(app.download)}" data-original-href="${esc(app.original)}" download>Download VPK · ${esc(app.version)} <i class="fas fa-download" aria-hidden="true"></i></a>`
    : ext(byJob[app.job].url, `Download VPK · ${esc(app.version)}`);
  const appCard = app => resource(app.title, esc(app.description),
    download(app) + ext(app.project, 'Project & requirements') + (app.guide ? ext(app.guide, app.guideLabel) : ''), app.image
  ).replace('<article ', `<article id="${app.id}" `)
    .replace('data-search="', `data-search="${esc(app.tags.join(' ').toLowerCase())} `)
    .replace('</h3>', `</h3><div class="game-features" aria-label="App tags">${app.tags.map(tag => `<span class="feature">${esc(tag)}</span>`).join('')}</div>`);
  const cards = ids => grid(...ids.map(id => appCard(byId[id])));
  const hostAddress = `<p>HENlo host: ${ext(host, 'https://jailbreak.psp2.dev/')}</p>`;
  const videoChapters = `<ul class="guide-source-list">${catalog.video.chapters.map(chapter => {
    const stamp = `${Math.floor(chapter.seconds / 60)}:${String(chapter.seconds % 60).padStart(2, '0')}`;
    return `<li>${ext(`https://www.youtube.com/watch?v=${catalog.video.id}&t=${chapter.seconds}`, `${stamp} · ${esc(chapter.label)}`)}</li>`;
  }).join('')}</ul>`;
  const saveSection = apollo.section('vita').replace(
    '<a href="https://github.com/bucanero/apollo-vita/releases" class="btn btn-primary" target="_blank" rel="noopener noreferrer">',
    '<a href="/downloads/archive/fe91136b6bc0/apollo-vita.vpk" data-original-href="https://github.com/bucanero/apollo-vita/releases" class="btn btn-primary" download>'
  );

  page('console/psvita/index.html', 'PS Vita Homebrew, Apps & Jailbreak',
    'PS Vita jailbreak and Ensō setup, a video walkthrough, homebrew apps, PSP tools, SD2Vita storage and Apollo save management.',
    guideImage, nav,
    section('start', 'Choose your PS Vita guide',
      hostAddress + grid(
        resource('Jailbreak with HENlo', 'Start with your firmware and storage, install HENkaku and VitaDeploy, then continue to persistent homebrew setup.', link('/console/psvita/jailbreak.html', 'Read jailbreak guide'), guideImage),
        resource('CFW & Ensō setup', 'Use VitaDeploy’s Quick 3.65 Install and finish the iTLS, update and homebrew settings shown in the supplied video.', link('/console/psvita/cfw.html', 'Read CFW guide'), byId.vitadeploy.image),
        resource('Apps & homebrew tools', 'Nine Vita tools for file transfers, save management, homebrew downloads, plugins, storage and PSP or PS1 software.', link('/console/psvita/apps.html', 'Browse Vita apps'), byId.vitadb.image),
        resource('Native games, emulators & themes', 'Explore the Vita library for native games, source ports, emulators, apps, themes and plugins, with ready downloads and project-specific setup.', link('/console/psvita/library.html', 'Browse Vita library'), '/assets/images/vita-more/supertux.png'),
        resource('SD2Vita & microSD storage', 'Set up a game-card microSD adapter with the maintained YAMT guide. The documented route is for Ensō on firmware 3.60 or 3.65.', ext(yamtGuide, 'Read SD2Vita guide'), byId.yamt.image),
        resource('PSP & PS1 with Adrenaline', 'Prepare the Adrenaline environment and follow its first-run PSP firmware setup on a homebrew-enabled Vita.', ext('https://vita.hacks.guide/adrenaline.html', 'Read Adrenaline guide') + link('/console/psvita/apps.html#adrenaline', 'Get Adrenaline'), byId.adrenaline.image),
        resource('Apollo save management', 'Keep backups, import and export saves, and use the Vita build of Apollo for PS Vita, PSP/Adrenaline and PS1 saves.', link('#save-tools', 'Get Apollo for Vita'), apollo.image)
      ), 'Start with the jailbreak guide on an unmodified system, or open the apps page on an already prepared Vita.') +
    firmwareSection() +
    section('essentials', 'Essential PS Vita apps', cards(['vitashell', 'vitadeploy', 'vitadb']) + `<div class="guide-links">${link('/console/psvita/apps.html', 'See all Vita apps')}</div>`) +
    saveSection +
    section('setup', 'Install Apollo on PS Vita', steps([
      ['Prepare homebrew access', 'Use a homebrew-enabled PS Vita. If you are starting from an unmodified console, follow the Vita jailbreak guide for your device.'],
      ['Download the Vita package', 'Choose the Apollo Vita VPK. The PS3 and PS4 PKG files are separate console builds.'],
      ['Transfer and install', 'Transfer the VPK to your Vita and install it using VitaShell. Open Apollo after installation; its setup documentation says user settings are detected on first launch.'],
      ['Back up your saves', 'Keep an original backup before applying save patches, resigning or restoring data. Check the project documentation for each game and save format.']
    ]) + `<div class="guide-links">${ext('https://github.com/bucanero/apollo-vita', 'Apollo setup documentation')}${link('/console/psvita/jailbreak.html', 'Vita jailbreak guide')}${link('/console/ps3/save-tools.html#save-tools', 'Apollo for PS3')}${link('/console/ps4/#save-tools', 'Apollo for PS4')}</div>`) +
    section('sources', 'PS Vita documentation', sourceList([
      [hacksGuide, 'Vita Hacks Guide · choose the route for your firmware and model'],
      ['https://github.com/SKGleba/VitaDeploy', 'VitaDeploy project and setup features']
    ])), '#start', 'Choose a guide');

  page('console/psvita/apps.html', 'PS Vita Apps & Homebrew Tools',
    'VitaShell, VitaDeploy, Apollo, VitaDB, Adrenaline, PKGj, AutoPlugin II, iTLS and YAMT with artwork, VPK downloads and setup links.',
    byId.vitadb.image, nav,
    section('essentials', 'File management & essential tools', cards(['vitashell', 'vitadeploy', 'apollo']), 'Ready-to-install PS Vita VPK builds with their project documentation.') +
    section('homebrew', 'Homebrew, packages & PSP tools', cards(['vitadb', 'adrenaline', 'pkgj'])) +
    section('system', 'Plugins, HTTPS & SD2Vita storage', cards(['autoplugin2', 'itls', 'yamt'])) +
    section('install', 'Install a Vita VPK', steps([
      ['Prepare your Vita', 'Start with a homebrew-enabled Vita running HENkaku. Check each app’s firmware and plugin requirements; some system tools specifically require Ensō.'],
      ['Transfer the package', 'Download the Vita VPK and copy it to a folder on the Vita using VitaShell’s USB or FTP connection.'],
      ['Install with VitaShell', 'Browse to the VPK in VitaShell and select it to install. Follow its on-screen prompts, then return to LiveArea to open the new app.'],
      ['Finish the app-specific setup', 'Some tools need data files, plugins or an additional first-run step. Follow the project instructions linked on the card; for storage changes, back up before formatting.']
    ]) + `<div class="guide-links">${link('/console/psvita/jailbreak.html', 'Jailbreak guide')}${link('/console/psvita/cfw.html', 'CFW setup guide')}${ext('https://github.com/TheOfficialFloW/VitaShell', 'VitaShell documentation')}</div>`), '#essentials', 'Browse Vita apps');

  page('console/psvita/jailbreak.html', 'PS Vita Jailbreak Guide · HENlo',
    'Follow the supplied Vita video with firmware checks, the HENlo browser address, HENkaku installation and VitaDeploy setup.',
    guideImage, nav,
    section('before', 'Check your firmware & storage',
      `<p>Find the installed firmware in Settings &gt; System &gt; System Information. The HENlo host lists 3.65–3.74; use the maintained guide’s firmware selector to confirm the route for your exact version. Keep the Vita charged and connected to the internet.</p>` +
      note(`<p><strong>Vita 1000 without an official memory card:</strong> follow the separate internal-memory-card procedure before continuing. It includes storage changes and a system restore, so back up first. Vita 2000 and PS TV have internal storage available for the normal route.</p>`) +
      sourceList([[hacksGuide, 'Choose your firmware and model'], [storageGuide, 'Vita 1000 internal-memory-card procedure']])) +
    section('host', 'Open the HENlo browser host', hostAddress +
      `<p>Use <code>http://jailbreak.psp2.dev</code> in the Vita browser, as shown by the maintained guide. The HTTPS link above can be opened on a computer or phone.</p>` +
      steps([
        ['Prepare the browser', 'Following the video, allow cookies and enable JavaScript in the browser settings. Its preparation also clears cookies and search history before loading the host.'],
        ['Enter the address', 'Type the host into the Vita browser’s address bar. Check that the hostname is <code>jailbreak.psp2.dev</code>.'],
        ['Start HENlo', 'Choose <strong>Unlock my Vita</strong>, then <strong>Unlock</strong>. Wait for the henlo-bootstrap menu to appear.'],
        ['Install the homebrew components', 'Choose <strong>Install henkaku</strong>, then <strong>Install VitaDeploy</strong>. When both complete, choose <strong>Exit</strong>.'],
        ['Enable homebrew in Settings', 'Open Settings &gt; HENkaku Settings and enable <strong>Enable Unsafe Homebrew</strong>. Confirm VitaDeploy is now available in LiveArea.']
      ]) + sourceList([[henloGuide, 'Maintained HENlo installation instructions'], ['https://www.youtube.com/watch?v=9cbJqNYbk0w&t=54', 'Video · browser preparation and HENlo sequence']])) +
    section('next', 'Continue to persistent homebrew',
      `<p>HENkaku enables homebrew in the current session. VitaDeploy is the installation toolbox. Ensō adds boot-time persistence; the next guide uses VitaDeploy’s documented firmware 3.65 preset.</p><div class="guide-links">${link('/console/psvita/cfw.html', 'Next: CFW & Ensō setup guide')}${ext('https://github.com/SKGleba/VitaDeploy', 'VitaDeploy features & requirements')}</div>`) +
    section('video', 'PS Vita video walkthrough', videoEmbed(catalog.video.id, catalog.video.title) +
      `<p>Blaine Locklair · published 7 September 2026. The written guide follows the video’s English transcript and cross-checks the install details against Vita Hacks Guide. Open a chapter below to jump to the matching step.</p>` + videoChapters), '#before', 'Start the Vita guide');

  page('console/psvita/cfw.html', 'PS Vita CFW & Ensō Setup',
    'Install persistent Vita homebrew with VitaDeploy’s 3.65 preset, then configure iTLS, update settings and optional SD2Vita storage.',
    byId.vitadeploy.image, nav,
    section('requirements', 'Start with HENkaku & VitaDeploy',
      `<p>Complete the HENlo guide first and enable Unsafe Homebrew. This route installs firmware <strong>3.65</strong> with <strong>HENkaku Ensō</strong> so homebrew starts after a reboot. Connect to the internet and keep the console powered throughout the installation.</p>` +
      `<div class="guide-links">${link('/console/psvita/jailbreak.html', 'Return to HENlo guide')}${ext(ensoGuide, 'Check the maintained Ensō procedure')}</div>`) +
    section('enso', 'Install firmware 3.65 & Ensō', steps([
      ['Open VitaDeploy', 'From LiveArea, launch VitaDeploy and choose <strong>Install a different OS</strong>.'],
      ['Choose Quick 3.65 Install', 'Select the quick preset and let it download and prepare the required components.'],
      ['Read and confirm', 'When prompted, press Cross (X), read the installation notice and wait through its countdown before confirming. Stop if the displayed firmware or operation differs from the documented route.'],
      ['Let the installation finish', 'Leave the Vita powered on while the firmware installs. It reboots when the process completes.'],
      ['Handle the memory-card prompt carefully', 'If the reboot asks to transfer internal-memory-card data to a removable card, choose <strong>No</strong>. The maintained guide warns that choosing Yes deletes data on the removable card.']
    ]) + sourceList([[ensoGuide, 'VitaDeploy quick-install steps and reboot prompt'], ['https://www.youtube.com/watch?v=9cbJqNYbk0w&t=283', 'Video · installing custom firmware']])) +
    firmwareSection() +
    section('finalize', 'Finish the system setup', steps([
      ['Download iTLS Installer', 'Open VitaDeploy &gt; App downloader, select <strong>iTLS Installer</strong>, then <strong>Download the selected apps</strong>.'],
      ['Install iTLS for Ensō', 'Open iTLS-Enso and select <strong>Install the full iTLS package</strong>, then reboot when asked. The full package is for an Ensō system; other configurations use the project’s separate instructions.'],
      ['Disable automatic system-update downloads', 'In Settings &gt; System &gt; Auto-Start Settings, turn off <strong>Download Update File for System Software</strong>.'],
      ['Review HENkaku spoofing settings', 'In Settings &gt; HENkaku Settings, enable <strong>Enable PSN Spoofing</strong> and <strong>Enable Version Spoofing</strong>. The checked guide sets the spoofed version to <strong>3.74</strong>; use its current value if those instructions change. This changes the reported version, not the installed firmware.']
    ]) + sourceList([[finalGuide, 'Final setup · iTLS, update downloads and spoofing'], ['https://github.com/SKGleba/iTLS-Enso', 'iTLS-Enso installation options']])) +
    section('storage', 'Optional SD2Vita storage',
      `<p>SD2Vita is a microSD adapter for the Vita game-card slot. YAMT requires Ensō on firmware 3.60 or 3.65 and is included in VitaDeploy’s Quick 3.65 Install. Follow the complete storage guide before changing mounts; formatting erases the selected storage.</p><div class="guide-links">${ext(yamtGuide, 'Read the YAMT / SD2Vita setup guide')}</div>`) +
    section('apps', 'Add your homebrew apps', cards(['vitashell', 'vitadb', 'apollo']) + `<div class="guide-links">${link('/console/psvita/apps.html', 'Browse all Vita apps')}${link('/console/psvita/', 'Back to PS Vita')}</div>`), '#requirements', 'Set up Ensō');

  const keywords = {
    'index.html': ['PS Vita', 'PlayStation Vita', 'PS TV', 'homebrew', 'apps', 'jailbreak', 'HENlo', 'HENkaku', 'VitaDeploy', 'Ensō', 'CFW', 'jailbreak.psp2.dev', 'Apollo Save Tool', 'VitaShell', 'VitaDB', 'Adrenaline', 'SD2Vita', 'YAMT', 'VPK', 'save management'],
    'apps.html': ['PS Vita apps', 'Vita homebrew', 'VPK downloads', ...catalog.apps.map(app => app.title), 'file manager', 'USB', 'FTP', 'save backups', 'PSP', 'PS1', 'plugins', 'SD2Vita', 'microSD', 'TLS 1.2', 'package manager'],
    'jailbreak.html': ['PS Vita jailbreak', 'HENlo', 'HENkaku', 'jailbreak.psp2.dev', 'VitaDeploy', 'Vita 1000', 'Vita 2000', 'PS TV', 'firmware 3.65', 'firmware 3.74', 'homebrew setup', 'video guide', 'Blaine Locklair'],
    'cfw.html': ['PS Vita CFW', 'HENkaku Ensō', 'VitaDeploy', 'Quick 3.65 Install', 'firmware 3.65', 'persistent homebrew', 'iTLS-Enso', 'HTTPS', 'version spoofing', 'SD2Vita', 'YAMT', 'Vita setup']
  };
  for (const [file, words] of Object.entries(keywords)) {
    const target = path.join(root, 'console/psvita', file);
    const html = fs.readFileSync(target, 'utf8').replace(/<meta name="keywords" content="[^"]*">/, `<meta name="keywords" content="${esc([...new Set(words)].join(', '))}">`);
    fs.writeFileSync(target, require('./search-page-output.cjs').finish(target, html));
  }
  console.log('Built PS Vita homebrew, apps, jailbreak and CFW pages.');
}

if (require.main === module) buildVitaGuides();
module.exports = {buildVitaGuides};
