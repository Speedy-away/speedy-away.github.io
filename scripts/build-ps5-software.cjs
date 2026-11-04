function buildPs5Software() {
  const {intro} = require('./build-console-downloads.cjs');
  const fs = require('node:fs');
  const path = require('node:path');
  const {page, section, grid, resource, note, steps, ext, link, sourceList, esc, ps5nav: nav} = require('./build-console-guides.cjs');
  const expansion = require('../docs/expansion-ps4-ps5.json').platforms.ps5;
  const extraCards = cards => cards.map(item => resource(
    esc(item.title), item.description,
    item.downloads.map(download => ext(download.url, esc(download.label))).join('') + ext(item.source, 'Setup & requirements'),
    item.image
  ));
  const imageFile = path.join(__dirname, '../docs/console-software-images.json');
  const images = fs.existsSync(imageFile) ? JSON.parse(fs.readFileSync(imageFile, 'utf8')) : {};
  const fallbackImage = '/assets/images/consoles/ps5-featured-image.avif';
  const image = id => images[id]?.image || fallbackImage;
  const archivedRelease = (url, original, download = false) => `<a href="${esc(url)}" data-original-href="${esc(original)}"${download ? ' download' : ''}>Releases <i class="fas fa-external-link-alt" aria-hidden="true"></i></a>`;
  const transferPayloadIds = new Set(['ftpsrv', 'websrv']);
  const transferAppIds = new Set(['ezremote']);
  const related = () => section('related', 'More for your PS5', `<div class="guide-links">${link('/console/ps5/payload-manager.html', 'Open payload manager')}${link('/console/ps5/payloads.html', 'Payloads')}${link('/console/ps5/apps.html', 'Apps & homebrew')}${link('/console/ps5/transfer-tools.html', 'Transfer tools')}${link('/console/ps5/downloads.html', 'Console downloads')}${link('/console/ps5/site-launcher.html', 'Home-screen site shortcut')}</div>`);

  page(
    'console/ps5/payloads.html',
    'PS5 Payloads',
    'PS5 payloads including ShadowMountPlus, etaHEN, kernel logs and the ELF loader. File-transfer apps and servers have their own page.',
    image('etahen'),
    nav,
    intro('ps5') + section('manage-payloads', 'Manage saved payloads', `<p>Start the compatible Payload Manager ELF on your PS5, then open its dashboard on port 8084. Import the file and explicitly choose Load in the manager after checking firmware support.</p><div class="guide-links">${link('/console/ps5/payload-manager.html', 'Open payload manager')}${link('/console/ps5/downloads.html', 'Download PS5 files')}</div>`) + section('payloads', 'Payloads', grid(
      resource(
        'ShadowMountPlus',
        'Background mounting and registration for supported homebrew and backup layouts. Check the release requirements for your loader and firmware.',
        archivedRelease('/console/ps5/downloads.html?file=ps5-f22d8b3749d7-shadowmountplus-elf#files', 'https://github.com/drakmor/ShadowMountPlus/releases'),
        image('shadowmountplus')
      ),
      resource(
        'etaHEN',
        'Homebrew-enabler payload with toolbox and services. Confirm the release supports your exact firmware before loading it.',
        archivedRelease('/downloads/archive/78aec0f39465/etaHEN-2.5B.bin', 'https://github.com/etaHEN/etaHEN/releases', true) + ext('https://gofile.io/d/ZZz79gu8', 'Supplied mirror'),
        image('etahen')
      ),
      ...extraCards(expansion.payloads.filter(item => !transferPayloadIds.has(item.id)))
    )) + related(),
    '#payloads',
    'Browse payloads'
  );

  page(
    'console/ps5/apps.html',
    'PS5 Apps & Homebrew Stores',
    'PS5 apps and stores including Playden, ProsperoStore, Orbit, Payload Manager, FFplay, PKGInstall and Garlic SaveMgr. Find file clients on the Transfer Tools page.',
    image('playden'),
    nav,
    require('./console-store-cards.cjs').storeIntro('ps5') + intro('ps5') + require('./console-store-cards.cjs').storeCards('ps5') + section('apps', 'Apps & homebrew stores', grid(
      resource(
        'PlaydenPS5',
        'Run supported Windows games from your Steam library or local game folders on the PS5 using Wine, without installing Linux. Experimental; game compatibility varies.',
        archivedRelease('/console/ps5/downloads.html?file=ps5-036a862b2f14-playden-ps5-0-8-0-zip#files', 'https://github.com/leolobato/playden-ps5/releases') + ext('https://github.com/leolobato/playden-ps5', 'Setup & requirements'),
        image('playden')
      ),
      resource(
        'ProsperoStore',
        'Native PS5 app for the homebrew catalog. Browse project requirements before installing the store.',
        archivedRelease('/console/ps5/downloads.html?file=ps5-ddcf24160dd6-ppsa99000-zip#files', 'https://github.com/darkxex/ProsperoStore/releases') + ext('https://homebrew.page/', 'Homebrew catalog'),
        image('prosperostore')
      ),
      resource(
        'Orbit Store 1.8.1',
        'PS5 download manager and store interface. Use the supplied release or check newer release notes for your setup.',
        ext('https://github.com/saawant12/orbit-store-ps5/releases/tag/v1.8.1', '1.8.1 release') + ext('https://github.com/saawant12/orbit-store-ps5/releases/download/v1.8.1/orbit_store.elf', 'orbit_store.elf'),
        image('orbit')
      ),
      resource(
        'PS5 Payload Manager · v0.6.3',
        'Load the pinned ELF through your compatible homebrew environment, then open its dashboard on port 8084. Import and launch payloads with explicit actions inside the manager.',
        link('/console/ps5/payload-manager.html', 'Open payload manager') + expansion.apps.find(item => item.id === 'payload-manager').downloads.map(download => ext(download.url, esc(download.label))).join('') + ext('https://github.com/itsPLK/ps5-payload-manager/tree/v0.6.3', 'Pinned setup & source'),
        '/assets/images/expansion-ps4-ps5/payload-manager.png'
      ),
      resource(
        'whatwhatboy PS5 shortcut',
        'Install the dedicated Media-row browser shortcut through your existing compatible package installer. Uses an original whatwhatboy icon and opens the PS5 hub.',
        link('/console/ps5/site-launcher.html', 'Get site shortcut'),
        '/console/ps5/site-launcher-assets/icon0.png'
      ),
      ...extraCards(expansion.apps.filter(item => !transferAppIds.has(item.id) && item.id !== 'payload-manager'))
    )) + section('install', 'Install Orbit from the ELF payload', steps([
      ['Download orbit_store.elf', 'Use the 1.8.1 link above for the release supplied with this guide.'],
      ['Start your jailbreak and loader', 'Use an already working homebrew environment and the ELF loader required by that Orbit release.'],
      ['Send and run the ELF', 'Use your payload manager or supported upload tool. Let the installer finish and check the PS5 home screen for the Orbit tile.'],
      ['Open the installed app', 'Use content you own or have permission to download. Read the release’s setup guide for storage, downloads and installation behavior.']
    ]) + `<div class="guide-links">${ext('https://github.com/saawant12/orbit-store-ps5', 'Orbit setup documentation')}</div>`) +
    section('playden', 'Playden requirements', note('<p>Playden’s project tests on firmware 13.60 and requires kstuff, ShadowMountPlus and an ELF loader. Installation also needs a supported transfer service. It uses a separate runtime kit and does not promise compatibility with every Windows game.</p><p>Back up Steam Cloud saves before testing: Playden can upload saves. Games with anti-cheat and online multiplayer are not supported by the documented setup.</p>') + sourceList([['https://github.com/leolobato/playden-ps5', 'Playden installation and limitations']])) + related(),
    '#selected-apps',
    'Browse apps'
  );
  page(
    'console/ps5/transfer-tools.html',
    'PS5 Transfer Tools',
    'Transfer and manage PS5 files with PS5upload, ezRemote Client, FTP and websrv. Start with working homebrew access and the service required by your chosen tool.',
    '/assets/images/expansion-ps4-ps5/ps5-ezremote.jpg',
    nav,
    intro('ps5') + section('transfer-tools', 'File transfers & servers', grid(
      resource(
        'PS5upload',
        'Transfer and manage homebrew from a computer, phone or browser. Follow its console-service setup instructions.',
        archivedRelease('/downloads/index.html#resource-cd469f63fa67', 'https://github.com/phantomptr/ps5upload/releases'),
        image('ps5upload')
      ),
      ...extraCards(expansion.apps.filter(item => transferAppIds.has(item.id))),
      ...extraCards(expansion.payloads.filter(item => transferPayloadIds.has(item.id)))
    ), 'Choose a file client or the console service it needs. Match the tool’s release to your firmware and loader.') +
    section('save-on-console', 'Save files on the PS5',
      `<p>Console Downloads uses <code>/data/whatwhatboy</code> for internal storage, or a <code>whatwhatboy</code> folder on an actual detected USB/external mount. Choose Prepare download folder, then explicitly create or verify it through the running ezRemote Client on port 9090. Return to the downloader on background-server port 6701 before saving a file.</p><p>PS5 websrv on port 8080 supplies destination checks, mounted-storage detection and a read-only filesystem browser. Folder creation and reviewed-archive extraction use the separate client page on port 9090. Each extraction needs its own action and a new output folder; opening a page never extracts or runs a file.</p><div class="guide-links">${link('/console/ps5/downloads.html', 'Open Console Downloads')}${link('/console/ps5/downloads.html#setup', 'Set up folder preparation')}${link('/console/ps5/payload-manager.html', 'Open websrv file manager')}</div>`) +
    related(),
    '#transfer-tools',
    'Browse transfer tools'
  );
  require('./playstation-nonmod-card-images.cjs').repairFiles(['console/ps5/emulators.html']);
  console.log('Built separate PS5 payload, app and transfer-tool pages.');
}

module.exports = {buildPs5Software};
if (require.main === module) buildPs5Software();
