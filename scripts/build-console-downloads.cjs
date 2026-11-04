const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const origin = 'https://whatwhatboy.com';
const size = bytes => bytes < 104858 ? (bytes / 1024).toFixed(1) + ' KiB' : (bytes / 1048576).toFixed(1) + ' MiB';
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');

const settings = {
  ps4: {
    name: 'PS4', version: '2.08', clientPort: 8080,
    helperPath: '/data/whatsite-ps4.html', receiverPath: '/data/whatsite-ps4.html',
    app: 'https://github.com/cy33hc/ps4-ezremote-client/releases/download/2.08/ezremote_client.pkg',
    appSource: 'https://github.com/cy33hc/ps4-ezremote-client/tree/2.08',
    image: '/assets/images/expansion-ps4-ps5/ps4-ezremote.jpg',
    nativeImage: '/assets/images/expansion-ps4-ps5/games-installer.jpg',
    nativeName: 'PS4 Games Installer', feed: '/console/ps4/homebrew.json'
  },
  ps5: {
    name: 'PS5', version: '2.18', clientPort: 9090,
    helperPath: '/data/homebrew/ezremote-client/assets/whatsite-ps5.html', receiverPath: '/whatsite-ps5.html',
    app: 'https://github.com/cy33hc/ps5-ezremote-client/releases/download/2.18/ezremote-client.zip',
    appSource: 'https://github.com/cy33hc/ps5-ezremote-client/tree/2.18',
    image: '/assets/images/expansion-ps4-ps5/ps5-ezremote.jpg',
    nativeImage: '/assets/images/expansion-ps4-ps5/payload-manager.png',
    nativeName: 'PS5 Payload Manager', feed: '/console/ps5/payloads.json'
  }
};

function intro(platform) {
  const name = platform.toUpperCase();
  return `<section class="section" id="console-downloads"><div class="container"><aside class="guide-note"><h2>Download on your ${name}</h2><p>Save apps, mod files and payloads to the console’s HDD/SSD or supported USB storage. Use the native catalogue or set up the console downloader once.</p><div class="guide-links"><a href="/console/${platform}/downloads.html">Open ${name} download center <i class="fas fa-arrow-right" aria-hidden="true"></i></a><a href="/console/${platform}/downloads.html#native">Native app catalogue <i class="fas fa-arrow-right" aria-hidden="true"></i></a></div></aside></div></section>`;
}

function urlField(id, label, url) {
  return `<div class="console-download-file"><label for="${id}">${label}</label><div><input id="${id}" type="text" value="${escape(url)}" readonly spellcheck="false"><button type="button" data-copy-target="${id}">Copy URL</button></div></div>`;
}

function buildConsoleDownloads(options = {}) {
  const {page, section, grid, resource, note, steps, ext, link, sourceList, ps4nav, ps5nav} = require('./build-console-guides.cjs');
  const {getCatalog, buildCatalog} = require('./console-download-catalog.cjs');
  const {renderCompanion} = require('./console-download-companion.cjs');
  buildCatalog();

  for (const platform of ['ps4', 'ps5']) {
    const config = settings[platform];
    const items = getCatalog(platform);
    const receiver = `http://127.0.0.1:6701${config.receiverPath}`;
    const preparation = `http://127.0.0.1:${config.clientPort}${config.helperPath}?prepare=1`;
    const helperURL = `${origin}/console/${platform}/whatsite-${platform}.html`;
    const nativeInstructions = platform === 'ps4'
      ? `<p>Add this source in <strong>PS4 Games Installer → Options → Settings → Games JSON URL</strong>, test the connection and save. Browse and install the listed homebrew packages in the app. Its r40 documentation tests PS4 11.00 with GoldHEN; this does not establish PS4 14.00 support.</p>${urlField('native-source', 'PS4 Games Installer catalogue', origin + config.feed)}<div class="guide-links">${link('/console/ps4/apps.html', 'Get PS4 Games Installer')}${ext('https://github.com/e1z0/PS4-Games-Installer/blob/main/EXPERT.md', 'Catalogue instructions')}</div>`
      : `<p>In <strong>PS5 Payload Manager 0.6.3 → Settings → Manage Sources → Add Source</strong>, add this source. It contains ready PS5 ELF/BIN payloads with checksums. The manager saves repository downloads under <code>/data/pldmgr/payloads/repo/</code>; ZIPs, packages and PS4-only mods are separate.</p>${urlField('native-source', 'PS5 Payload Manager source', origin + config.feed)}<div class="guide-links">${link('/console/ps5/payload-manager.html', 'Open payload manager')}${link('/console/ps5/apps.html', 'Get Payload Manager')}${ext('https://github.com/itsPLK/ps5-payload-manager/blob/v0.6.3/CUSTOM_REPOSITORIES.md', 'Custom source instructions')}</div>`;

    const setup = steps([
      ['Prepare homebrew and ezRemote', `Use a working homebrew environment and install ezRemote Client ${config.version} for ${config.name}. ${platform === 'ps5' ? 'The PS5 client also requires websrv; follow its installation and homebrew-folder layout.' : 'Use a GoldHEN setup supported by the app. Enable its BIN Loader when starting ezRemote Server.'} This is a one-time prerequisite for the downloader.`],
      ['Save the companion page on this console', `In ezRemote, use its direct-link download feature to save the HTML URL below as <code>${config.helperPath}</code>. ${platform === 'ps5' ? 'Keep it inside the client’s existing assets folder.' : 'Use the existing /data folder.'}`],
      ['Start the matching services', `Enable background downloads in ezRemote settings and start its bundled ezRemote Server on port 6701. Keep ezRemote Client running with its web service available on port ${config.clientPort} for folder creation and extraction. ${platform === 'ps5' ? 'PS5 websrv on port 8080 supplies mounted-storage and destination checks.' : 'The client’s port 8080 file manager is separate from the background server.'} Keep the console awake during an operation.`],
      ['Open the console downloader', `Open <code>${receiver}</code> in the console’s browser. The local page can talk to the download service and show its transfer queue.`],
      ['Choose storage and prepare its download folder', `Internal storage defaults to <code>/data/whatwhatboy</code>. ${platform === 'ps5' ? 'Use Detect mounted storage with websrv running on port 8080 to select an actual USB or external mount; its download folder is <code>&lt;mounted path&gt;/whatwhatboy</code>.' : 'For USB storage, inspect the actual mounted path in ezRemote and enter its <code>whatwhatboy</code> download folder.'} Choose <strong>Prepare download folder</strong>, then press <strong>Create or verify download folder</strong> on the client page. It creates only missing child folders, preserves existing directories and refuses colliding files. Choose <strong>Use this verified folder in the downloader</strong> to return.`],
      ['Choose and save the compatible file', `${platform === 'ps4' ? 'Confirm that the selected folder is writable and has enough space, then tick its confirmation in the downloader. ' : ''}Ready files are shown first. Press <strong>Save to console</strong> for the selected file and wait for the receiver’s reported completion. Packages still need installation; payloads need a compatible loader; plugins, patches and scripts need their exact game/update guide and any supporting files.`]
    ]);

    const cards = items.map((item, index) => {
      const fileURL = new URL(item.url, origin).href;
      const type = path.extname(item.filename).slice(1).toUpperCase();
      const search = [item.name, item.version, item.filename, item.category, item.compatibility, item.description].filter(Boolean).join(' ').toLowerCase();
      const image = item.image ? `<img src="${escape(item.image)}" alt="${escape(item.name)} artwork" loading="lazy">` : '';
      const compatibility = item.compatibility && !(item.description || '').includes(item.compatibility) ? `<p>${escape(item.compatibility)}</p>` : '';
      const action = item.preparation || (/\.xml$/i.test(item.filename) ? 'Follow the matching patch-engine guide; patch XML is not a payload or game executable' : /\.json$/i.test(item.filename) ? 'Place in /data/GoldHEN/cheats/json; use the matching GoldHEN Cheat Menu' : /\.plugin$/i.test(item.filename) ? 'Install using the documented etaHEN plugin setup' : /\.(zip|rar|7z)$/i.test(item.filename) ? 'Extract archive, then follow its guide' : /\.pkg$/i.test(item.filename) ? 'Install with a compatible package installer' : /\.(elf|bin)$/i.test(item.filename) ? 'Load with the documented compatible loader' : 'Place using the game’s mod guide');
      return `<article class="guide-resource console-download-card" id="download-${escape(item.id)}" data-file-id="${escape(item.id)}" data-filename="${escape(item.filename)}" data-category="${escape(item.category)}" data-search="${escape(search)}">${image}<div class="console-file-kind">${escape(/\.plugin$/i.test(item.filename) ? 'etaHEN plugin' : item.category === 'patches' ? 'Game patch' : item.category === 'mods' ? 'Game mod' : item.category === 'payloads' ? 'Payload' : 'App / homebrew')} · ${type}</div><h3>${escape(item.name)}</h3><div class="game-features"><span class="feature">${escape(item.version || 'Archived build')}</span><span class="feature">${size(item.bytes)}</span></div><p>${escape(item.description || '')}</p>${compatibility}<p class="console-next-action">${escape(action)}</p><div class="guide-links console-file-actions"><a class="btn btn-primary" data-receiver-file="${escape(item.id)}" href="${receiver}?file=${encodeURIComponent(item.id)}">Save on ${config.name}</a><a class="btn btn-outline" href="${escape(item.url)}" download="${escape(item.filename)}">Download</a>${item.page ? link(item.page, 'Setup & compatibility') : ''}${item.requiresSupportArchive ? `<a href="${escape(item.requiresSupportArchive)}" download>Complete support pack</a>` : ''}${platform === 'ps5' && /\.(elf|bin)$/i.test(item.filename) ? link('/console/ps5/payload-manager.html', 'Open payload manager') : ''}</div><details class="console-file-details"><summary>Download file, URL & checksum</summary><p><a href="${escape(item.url)}" download="${escape(item.filename)}">Download ${escape(item.filename)}</a></p><p>This link downloads through your current browser. To choose console storage, use Save on ${config.name} after setting up the downloader.</p>${urlField('file-url-' + index, 'Direct file URL', fileURL)}<p>SHA-256</p><code class="console-file-hash">${escape(item.sha256)}</code></details></article>`;
    });

    const content = `<div id="console-download-center" data-platform="${platform}">` +
      require('./console-store-cards.cjs').storeIntro(platform) + section('start', `Your ${config.name} download desk`, `<div class="console-download-summary"><p><strong>${items.length} curated files</strong><span>Console builds, homebrew, payloads and game mods. Compatibility stays attached to each file.</span></p><div class="guide-links">${link('#files', 'Browse files')}${link(`/console/${platform}/game-patches.html`, '60 FPS & game patches')}${link(`/console/${platform}/themes.html`, 'Themes & customization')}${link(`/console/${platform}/site-launcher.html`, 'Console home-screen access')}${link('/downloads/', 'All-platform library')}</div></div>` + note(`<p><strong>Save → prepare → use.</strong> Saving puts a file on storage. Packages still need installation, archives need extraction and payloads need a compatible loader. Set up the local downloader to choose console folders; a stock console browser cannot write to arbitrary paths.</p>`) + grid(
        resource('Browse in a native app', platform === 'ps4' ? 'Use the homebrew catalogue in PS4 Games Installer to browse and install compatible packages directly on the console.' : 'Add the PS5 Payload Manager source to browse and download ready PS5 payloads directly on the console.', link('#native', 'Add native catalogue'), config.nativeImage),
        resource('Save apps, menus & payload files', 'The console downloader uses the installed ezRemote background service to save files to internal storage or a mounted USB drive.', link(`/console/${platform}/downloads.html#setup`, 'Set up console downloader') + `<a data-receiver-open href="${receiver}">Open console downloader <i class="fas fa-arrow-right" aria-hidden="true"></i></a>`, config.image),
        resource('Create folders & extract archives', 'Open the running ezRemote client, then explicitly create or verify the whatwhatboy download folder. Saved, reviewed archives up to 32 MiB can be checksum-checked and extracted into a new folder through their archive cards.', `<a data-client-open href="${preparation}">Open folder preparation <i class="fas fa-arrow-right" aria-hidden="true"></i></a>`, '/assets/images/console-software/storage-folders.svg')
      )) +
      section('files', 'Choose files for your console', `<div class="console-download-toolbar"><div class="console-search-fields"><div><label for="console-file-search">Search apps, menus &amp; payloads</label><input id="console-file-search" type="search" placeholder="Name, game, version or file type…"></div><div><label for="console-file-format">File format</label><select id="console-file-format"><option value="ready">Ready files (no extraction)</option><option value="archives">Archives & complete packs</option><option value="all">All formats</option></select></div></div><div class="console-category-filters" role="group" aria-label="File categories">${[['all', 'All files'], ['apps', 'Apps & homebrew'], ['payloads', 'Payloads'], ['mods', 'Mod files'], ['patches', 'Game patches']].map(([value, label]) => `<button type="button" data-download-filter="${value}" aria-pressed="${value === 'all'}">${label}</button>`).join('')}</div><details class="console-connection"><summary>Connecting from another device? Set console address</summary><label for="console-address">Console address</label><div class="console-address-row"><input id="console-address" type="text" value="127.0.0.1" spellcheck="false" autocomplete="off"><button id="console-address-apply" type="button">Use address</button></div><p id="console-address-status" role="status">Use 127.0.0.1 when browsing on this PlayStation.</p></details><p id="console-file-count" role="status">${items.length} files</p></div><p id="console-file-empty" hidden>No files match these filters. Try All formats to include original archives and complete packs.</p><div class="games-grid">${cards.join('\n')}</div>`, 'Save on console opens your installed local downloader. It does not start a transfer until you select Save to console there.') +
      section('native', 'Browse and install with a native app', nativeInstructions) +
      section('setup', 'Set up the console downloader once', setup + urlField('companion-url', 'Companion HTML download URL', helperURL) + `<div class="guide-links">${ext(config.app, `Get ezRemote ${config.version}`)}${ext(config.appSource, 'ezRemote installation instructions')}<a data-receiver-open href="${receiver}">Open installed downloader <i class="fas fa-arrow-right" aria-hidden="true"></i></a><a data-client-open href="${preparation}">Open folder preparation <i class="fas fa-arrow-right" aria-hidden="true"></i></a></div><p class="guide-firmware-note">The local address opens the PlayStation you are browsing on. From a phone or computer, enter that console’s LAN address above and enable the client’s web access if needed. These quick links use the documented default ports: ${config.clientPort} for client folder actions and 6701 for background downloads. If you configured another client port, use its native file manager. PS4 and PS5 use different companion paths and protocols.</p>`) +
      section('storage', 'Choose storage that your console exposes', `<div class="console-storage-table"><table><thead><tr><th>Destination</th><th>How to choose it</th></tr></thead><tbody><tr><th>Internal HDD / SSD</th><td>The default download folder is <code>/data/whatwhatboy</code>. Use Prepare download folder and explicitly create or verify it before saving. This stages a file; it does not select an installed game’s storage.</td></tr><tr><th>USB HDD / SSD / flash drive</th><td>${platform === 'ps5' ? 'Choose Detect mounted storage in the local downloader. PS5 websrv reports actual mounted filesystems; select a detected mount and prepare its whatwhatboy folder. The device is rechecked before saving.' : 'Open ezRemote, confirm the actual mounted path, then prepare its whatwhatboy folder through the local client page. The pinned PS4 service cannot automatically enumerate USB mounts.'} Mount numbers do not identify a physical front or rear USB port.</td></tr><tr><th>PlayStation Extended Storage</th><td>System-managed game storage is separate from general-purpose USB files. An external drive is usable here only if the homebrew service exposes a writable file folder.</td></tr></tbody></table></div><p class="guide-firmware-note">Keep space for the file and its extracted or installed copy. A queued request is not a completed save; confirm the finished file in ezRemote. Match firmware, title ID and game update before installing or loading anything.</p>`) +
      section('extract', 'Extract a saved archive when needed', `<p>Choose <strong>Archives &amp; complete packs</strong> to find the retained ZIP, RAR and 7z downloads. Save the complete archive first. In the local downloader, choose <strong>Extract a saved copy on console</strong> on its card, then press the explicit verification-and-extraction action on the client page.</p><p>Automatic extraction accepts reviewed archives up to 32 MiB only after checking the saved file’s SHA-256. It uses a new output folder and preserves the original archive. Other archives remain available through the real ezRemote file manager. Extraction shows an in-progress state and the native service’s result; the API does not supply a percentage. Nothing extracts, installs or launches when a page opens.</p>${link(platform === 'ps4' ? '/console/ps4/archive-files.html' : '/console/ps5/transfer-tools.html#save-on-console', platform === 'ps4' ? 'Archive preparation & installation guide' : 'File-manager & transfer instructions')}`) +
      section('sources', 'Supported download methods', sourceList([
        [config.appSource, `ezRemote ${config.name} · storage and background downloads`],
        [platform === 'ps4' ? 'https://github.com/cy33hc/ps4-ezremote-server/tree/4d8b1075bcf3bb1d2d05fc52d73ed26446f6358a' : 'https://github.com/cy33hc/ps5-ezremote-server/tree/22cfffe76001a3bd5a6e136cee753c77ab93abde', 'Bundled background server · queue and local page service'],
        [platform === 'ps4' ? 'https://github.com/GoldHEN/GoldHEN' : 'https://github.com/ps5-payload-dev/websrv', 'Console services and payload loading']
      ])) + '</div>';

    const output = `console/${platform}/downloads.html`;
    page(output, `${config.name} Console Downloads`,
      `Download ${config.name} apps, homebrew, mod files and payloads to console storage with native catalogues and the ezRemote console downloader.`,
      config.image, platform === 'ps4' ? ps4nav : ps5nav, content, '#files', `Browse ${config.name} files`);
    const file = path.join(root, output);
    const keywords = `${config.name} console downloads, ${config.name} PKG homebrew, ${config.name} payloads, mod menus, internal HDD SSD, USB file transfer, ezRemote, firmware compatibility, game update, SHA-256`;
    let html = fs.readFileSync(file, 'utf8').replace(/<meta name="keywords" content="[^"]*">/, `<meta name="keywords" content="${keywords}">`).replace('</head>', '<link rel="stylesheet" href="/assets/console-downloads.css?v=4">\n<script defer src="/assets/console-downloads.js?v=3"></script></head>');
    // Keep the existing ad placement after the download workflow so it does not
    // interrupt browsing, address selection or setup on a console display.
    const advertisement = html.match(/<!-- BEGIN SITE AD -->[\s\S]*?<!-- END SITE AD -->/)?.[0];
    if (advertisement) html = html.replace(advertisement, '').replace('<footer class="guide-footer">', advertisement + '\n<footer class="guide-footer">');
    fs.writeFileSync(file, require('./search-page-output.cjs').finish(output, require('./apply-mobile-layout.cjs').improve(html)));
    // Companions are ready-to-use archived downloads. Regenerate deliberately,
    // then version and archive their new hashes; routine page builds leave them alone.
    if (options.companions) fs.writeFileSync(path.join(root, `console/${platform}/whatsite-${platform}.html`), renderCompanion(platform, items));
  }
  console.log('Built PS4 / PS5 download centers and native catalogues.' + (options.companions ? ' Companions deliberately regenerated; archive new versions before delivery.' : ' Archived companions preserved.'));
}

if (require.main === module) buildConsoleDownloads({companions: process.argv.includes('--companions')});
module.exports = {buildConsoleDownloads, intro, settings};
