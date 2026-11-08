// Build a bounded console-only catalogue from files already recorded in the archive.
// This module never downloads, executes, moves or changes archived files.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {publicMirror} = require('./download-mirror-policy.cjs');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'docs/console-download-catalog.json');
const backup = path.resolve('F:/whatsite-backup-downloads-etc');
const MAX_PLATFORM_ITEMS = 1024;
function assertCatalogueBounds(items) {
  if (new Set(items.map(item => item.id)).size !== items.length) throw Error('Duplicate catalogue IDs');
  for (const platform of ['ps4', 'ps5']) {
    const count = items.filter(item => item.platforms.includes(platform)).length;
    if (!count) throw Error('No verified ' + platform + ' downloads; refusing to replace its catalogue.');
    if (count > MAX_PLATFORM_ITEMS) throw Error('Console catalogue exceeds curated limit');
  }
}
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8').replace(/^\uFEFF/, ''));
const slug = value => String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const contained = (base, file) => {
  const relative = path.relative(base, path.resolve(file));
  return relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
};
const statSize = (file, bytes) => {
  try { return fs.statSync(file).isFile() && fs.statSync(file).size === bytes; } catch { return false; }
};
const localFile = value => {
  if (typeof value !== 'string' || !value.startsWith('/downloads/')) return null;
  let name;
  try { name = decodeURIComponent(value.split(/[?#]/)[0]); } catch { return null; }
  const file = path.resolve(root, '.' + name);
  return contained(path.join(root, 'downloads'), file) ? file : null;
};
const publicDirect = value => {
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:' || u.username || u.password) return null;
    // Do not publish signed temporary redirect URLs, a project page or a file-host landing page.
    if (u.hostname === 'github.com' && /\/releases\/download\/[^/]+\/.+/.test(u.pathname)) return u.href;
    if (u.hostname === 'raw.githubusercontent.com' && /\/[a-f0-9]{40}\//i.test(u.pathname)) return u.href;
    if (u.hostname === 'pkg-zone.com' && /^\/download\/ps4\/[A-Z0-9]+\/[0-9.]+$/.test(u.pathname) && !u.search && !u.hash) return u.href;
  } catch {}
  return null;
};
const image = (candidate, fallback = '/assets/images/consoles/playstation.jpg') => {
  const p = candidate && path.resolve(root, '.' + candidate);
  return p && contained(path.join(root, 'assets/images'), p) && fs.existsSync(p) && fs.statSync(p).size > 100 ? candidate : fallback;
};
function availablePage(value, platform, category) {
  if (!value || !value.startsWith('/')) return value;
  const url = new URL(value,'https://whatwhatboy.com');
  let file = path.join(root,decodeURIComponent(url.pathname));
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file,'index.html');
  if (!fs.existsSync(file)) {
    const fallback = category === 'patches' ? `/console/${platform}/game-patches.html` : platform === 'ps4' ? '/console/mods/ps4/index.html' : '/console/ps5/mods.html';
    return fs.existsSync(path.join(root,fallback)) ? fallback : `/console/${platform}/`;
  }
  if (url.hash && file.endsWith('.html') && !fs.readFileSync(file,'utf8').includes('id="'+decodeURIComponent(url.hash.slice(1))+'"')) return url.pathname;
  return value;
}

function collect() {
  if (!fs.existsSync(backup)) throw Error('The local download archive is unavailable. Keep the checked-in catalogue instead of rebuilding an empty one.');
  const audit = read('docs/download-audit.json').items;
  const expansion = read('docs/expansion-ps4-ps5.json').platforms;
  const media = read('docs/console-software-images.json');
  const result = [];
  const seen = new Set();
  function add(file, options, owner) {
    if (!file || !/^[a-f0-9]{64}$/i.test(file.sha256 || '') || !Number.isSafeInteger(file.bytes) || file.bytes < 1) return;
    const filename = file.filename || file.name;
    if (!/\.(?:pkg|ffpkg|elf|bin|zip|7z|rar|prx|sprx|csc|gsc|gscc)$/i.test(filename || '') &&
      !(options.reviewedData && /\.(?:json|plugin|xml|lua|mc4|shn)$/i.test(filename || ''))) return;
    if (/source|\bwin(?:dows)?[-_ ]|linux|macos|\.exe(?:\.|$)|desktop|tool[-_ ]box|rtm[-_ ]tool/i.test(filename)) return;
    const local = localFile(file.local);
    const backupPath = file.backupPath && path.resolve(file.backupPath);
    let backed = backupPath && contained(backup, backupPath) && statSize(backupPath, file.bytes);
    if (!backed && local) {
      // The older GTA/BO3 manifests predate the merged audit. Their retained site
      // snapshots are backing copies; verify their bytes before exposing them.
      for (const folder of ['existing-site-files', 'site']) {
        const saved = path.resolve(backup, folder, '.' + file.local);
        if (!contained(backup, saved) || !statSize(saved, file.bytes)) continue;
        if (crypto.createHash('sha256').update(fs.readFileSync(saved)).digest('hex') === file.sha256.toLowerCase()) { backed = true; break; }
      }
    }
    if (!backed) return;
    const mirror = publicMirror(file.local, root);
    const url = mirror && mirror.bytes === file.bytes ? mirror.local
      : [file.sourceUrl, file.resolvedUrl, file.source, owner?.url].map(publicDirect).find(Boolean);
    if (!url) return;
    const platforms = options.platforms || [options.platform];
    let key = platforms.join(',') + ':' + file.sha256 + (/\.(?:xml|mc4|json)$/i.test(filename) ? ':' + filename : '');
    if (seen.has(key)) {
      if (!options.preserveFilename || result.some(item => item.sha256 === file.sha256 && item.filename === filename && item.platforms.join(',') === platforms.join(','))) return;
      key += ':' + filename;
      if (seen.has(key)) return;
    }
    seen.add(key);
    result.push({
      id: options.id,
      name: options.name,
      filename,
      url,
      bytes: file.bytes,
      sha256: file.sha256.toLowerCase(),
      version: options.version || file.version || owner?.release || 'Unversioned',
      category: options.category,
      compatibility: options.compatibility,
      image: image(options.image),
      page: availablePage(options.page, platforms[0], options.category),
      ...(options.pages ? {pages: Object.fromEntries(Object.entries(options.pages).map(([platform,value]) => [platform,availablePage(value,platform,options.category)]))} : {}),
      platforms,
      description: options.description || options.compatibility,
      ...(options.preparation ? {preparation: options.preparation} : {}),
      ...(options.requiresSupportArchive ? {requiresSupportArchive: options.requiresSupportArchive} : {}),
      ...(options.replacementOnly ? {replacementOnly: true} : {}),
      source: options.source || owner?.url || options.page
    });
  }
  const find = id => audit.find(item => item.id === id);
  function audited(id, match, options) {
    const owner = find(id);
    if (!owner || owner.status !== 'downloaded') return;
    const files = (owner.files || []).filter(file => typeof match === 'string' ? file.name === match : match.test(file.name));
    for (const file of files) add(file, {...options, id: options.id || options.platform + '-' + slug(id + '-' + file.name)}, owner);
  }

  // Existing explicitly pinned app/payload entries. Their versions are not advanced.
  for (const platform of ['ps4', 'ps5']) for (const category of ['apps', 'payloads']) {
    for (const entry of expansion[platform][category]) for (const download of entry.downloads) {
      audited('ps4-ps5-' + download.jobId, download.filename, {
        id: platform + '-' + entry.id + (entry.downloads.length > 1 ? '-' + slug(download.filename) : ''),
        platform, category, name: entry.title + (entry.downloads.length > 1 ? ' · ' + download.label : ''),
        description: entry.description, compatibility: entry.description,
        version: platform === 'ps5' && download.filename === 'ezRemote-Loader-1.01.elf' ? 'Loader 1.01 / client bundle 2.18' : entry.version,
        image: entry.image, page: `/console/${platform}/${category}.html`, source: entry.source
      });
    }
  }
  const core = [
    ['ps4', 'f07434d99146', /^GoldHEN_v2\.3\.7z$/, 'GoldHEN 2.3 archive', 'payloads', 'goldhen', 'GoldHEN 2.3 requires its own supported firmware. This archive is not a direct BIN and does not establish PS4 14.00 support.'],
    ['ps4', '86923843b6f3', /\.pkg$/, 'Apollo Save Tool · PS4', 'apps', null, 'PS4 console PKG, archived version 2.4.0. Requires an existing compatible homebrew environment.'],
    ['ps5', 'f22d8b3749d7', /\.elf$/, 'ShadowMountPlus payload', 'payloads', 'shadowmountplus', 'PS5 payload; match firmware, loader and the pinned 1.7beta11 release requirements.'],
    ['ps5', 'f22d8b3749d7', /\.zip$/, 'ShadowMountPlus files', 'payloads', 'shadowmountplus', 'Extract the matching PS5 release archive before following its mounting and registration instructions.'],
    ['ps5', '78aec0f39465', /^etaHEN-2\.5B\.bin$/, 'etaHEN 2.5B', 'payloads', 'etahen', 'PS5 homebrew enabler. Use the existing pinned 2.5B build only on firmware supported by its release.'],
    ['ps5', 'cd469f63fa67', /^ps5upload-10\.6\.0\.elf$/, 'PS5upload console service', 'payloads', 'ps5upload', 'PS5 ELF service, not the desktop/mobile sender. Requires a compatible running ELF loader.'],
    ['ps5', '036a862b2f14', /^playden-ps5-0\.8\.0\.zip$/, 'PlaydenPS5 app files', 'apps', 'playden', 'PS5 app archive, version 0.8.0. Requires the project’s matching runtime kit, kstuff, ShadowMountPlus and loader.'],
    ['ps5', 'ddcf24160dd6', /^PPSA99000\.zip$/, 'ProsperoStore app files', 'apps', 'prosperostore', 'PS5 app archive, pinned v1.000.116. Extract and follow the project’s homebrew installation requirements.'],
    ['ps5', '5a12cb950970', /^orbit_store\.elf$/, 'Orbit Store 1.8.1', 'apps', 'orbit', 'PS5 ELF installer, pinned 1.8.1. Follow Orbit’s supported firmware, loader and storage setup.']
  ];
  for (const [platform, id, match, name, category, key, compatibility] of core) audited(id, match, {
    platform, name, category, compatibility,
    version: id === '86923843b6f3' ? '2.4.0' : undefined,
    image: key ? media[key]?.image : '/assets/images/consoles/apollo-save-tool.png',
    page: `/console/${platform}/${category}.html`
  });
  const emulators = [
    ['ps4', 'aa7beb68a4bc', /\.pkg$/, 'DolphinPS4', 'Dolphin.png'],
    ['ps4', '12c7a1cb9614', /\.pkg$/, 'Crema · PS4', 'Cemu.png'],
    ['ps4', '628642807328', /\.pkg$/, 'Resonance · PS4', 'retroarch.png'],
    ['ps4', 'b171167057ba', /\.pkg$/, 'PS4SX2', 'PCSX2.png'],
    ['ps4', '2adda4a14f5d', /\.pkg$/, 'RPCS3 port · PS4', 'RPCS3.jpg'],
    ['ps5', '640d68a152b5', /\.zip$/, 'PS5SX2 app files', 'PCSX2.png'],
    ['ps5', '640d68a152b5', /^PS5SX2Installer\.elf$/, 'PS5SX2 installer', 'PCSX2.png'],
    ['ps5', '640d68a152b5', /^PS5SXHelper\.elf$/, 'PS5SX2 helper', 'PCSX2.png'],
    ['ps5', '24e9baa79ea0', /\.zip$/, 'Porpoise · PS5', 'Dolphin.png'],
    ['ps5', 'ffa3d0d38f43', /\.zip$/, 'PS5-ECAM app files', 'Cemu.png'],
    ['ps5', '3a4d278d7ff5', /^PPSA50011\.zip$/, 'PS5X360 app files', 'Xenia.png'],
    ['ps5', '3a4d278d7ff5', /^PS5X360-Helper\.elf$/, 'PS5X360 helper', 'Xenia.png'],
    ['ps5', '7d1b737c85a3', /^PPSA97358\.zip$/, 'XPSemu app files', null],
    ['ps5', '7d1b737c85a3', /^helper\.elf$/, 'XPSemu helper', null],
    ['ps5', '27a850f2459f', /^PS5_RetroArch.*\.zip$/, 'RetroArch · PS5', 'retroarch.png'],
    ['ps5', 'c0009d75bd21', /^PSFlyCast.*\.zip$/, 'PSFlycast', 'retroarch.png']
  ];
  for (const [platform, id, match, name, art] of emulators) audited(id, match, {
    platform, name, category: 'apps', page: `/console/${platform}/emulators.html`,
    image: art ? '/assets/images/emulators/' + art : '/assets/images/consoles/xbox.jpg',
    compatibility: `Native ${platform.toUpperCase()} homebrew build. Follow the linked page’s release-specific firmware, loader, helper and data-file requirements; PC builds are separate.`
  });

  // Curated game-specific files retain their game-update groups and PS4-only scope.
  for (const file of read('downloads/ps4/GTA5/manifest.json').files.filter(file => ['156', '157'].includes(file.group))) add(file, {
    id: 'ps4-gta5-' + file.group + '-' + slug(file.name), platform: 'ps4', category: 'mods',
    name: `${file.name} · GTA V 1.${file.group.slice(1)}`, version: `GTA V 1.${file.group.slice(1)}`,
    compatibility: `PS4 GTA V game update 1.${file.group.slice(1)}; match the regional title ID and GoldHEN plugin requirements. This group describes the game update, not console firmware or PS5 support.`,
    image: file.image && '/assets/images/ps4-gta5/' + file.image, page: '/console/mods/ps4/gta5/install.html', source: file.source
  });
  const bo3 = read('docs/ps4-bo3-resources.json').resources;
  const selectedBo3 = new Set(['injector', 'muzzman', 'daybreak', 'encore-zm']);
  for (const file of read('downloads/ps4/BO3/manifest.json').files.filter(file => selectedBo3.has(file.resource))) {
    const entry = bo3.find(entry => entry.id === file.resource);
    add(file, {
      id: 'ps4-bo3-' + file.resource, platform: 'ps4', category: 'mods', name: entry.name,
      compatibility: `PS4 Black Ops 3 ${entry.group === 'zombies' ? 'Zombies' : entry.group === 'multiplayer' ? 'Multiplayer' : 'GSC/plugin'} resource. Match game update, title ID and injector requirements in its guide.`,
      description: entry.description || entry.name, image: '/assets/images/ps4-bo3/' + (file.resource === 'encore-zm' ? 'encore-zombies' : file.resource) + '.png',
      page: '/console/mods/ps4/call-of-duty/black-ops-3/', source: file.source
    });
  }
  for (const [id, title, gameVersion, art] of [
    ['e224e986af65', 'North Beta', 'Check the supplied North build’s supported RDR2 game update.', 'north'],
    ['4340f681a21d', 'Sheriff', 'RDR2 game update 1.32.', 'sheriff'],
    ['b35a678f8578', 'Havana', null, 'havana']
  ]) {
    const owner = find(id);
    for (const file of owner?.files || []) {
      const version = file.name.match(/_(100|129|132)\./)?.[1];
      const compatibility = `PS4 Red Dead Redemption 2 menu. ${gameVersion || 'RDR2 game update 1.' + version.slice(1) + '.'} Match title ID and plugin setup. No PS5 compatibility is inferred.`;
      add(file, {id: 'ps4-rdr2-' + slug(title + '-' + file.name), platform: 'ps4', category: 'mods', name: title + (version ? ' · RDR2 1.' + version.slice(1) : ''),
        compatibility, page: '/console/mods/ps4/rdr2/', image: '/assets/images/ps4-rdr2/' + art + '.png'}, owner);
    }
  }
  // The supplied source explicitly names PS4/PS5 and GoldHEN/etaHEN. Keep that
  // narrow designation; ordinary PS4 mod entries are not assigned to PS5.
  for (const [suffix, match, name] of [
    ['pack', /\.rar$/, 'BO1 / BO2 GSC Injector files'],
    ['prx', /\.prx$/, 'BO1 / BO2 GSC Injector plugin']
  ]) audited('ps4-ps5-bo1-bo2-gsc-injector-' + suffix, match, {
    id: 'ps4-ps5-bo1-bo2-gsc-injector-' + suffix, platforms: ['ps4', 'ps5'], name, category: 'mods',
    compatibility: 'The supplied injector resource explicitly lists PS4/PS5 and GoldHEN/etaHEN. Match its BO1/BO2 title IDs, game update, enabler and exact plugin filename; this is not blanket PS5 compatibility.',
    image: '/assets/images/ps4-bo3/matrixmods.png', page: '/console/mods/ps4/call-of-duty/black-ops-1/'
  });
  // Explicitly reviewed console data and builds, never an unfiltered all-platform inventory.
  const additions = read('docs/ps4-ps5-customization.json').resources;
  for (const entry of additions) audited('ps4-ps5-' + entry.id, entry.filename, {
    id: entry.id, platforms: entry.platforms, reviewedData: true,
    name: entry.title, category: entry.category === 'game-mod' ? 'mods' : 'payloads',
    version: entry.version, compatibility: entry.compatibility,
    description: entry.format + '. ' + entry.compatibility,
    image: entry.image, page: entry.page, source: entry.source
  });
  for (const document of ['docs/console-ready-file-descriptors.json', 'docs/console-multicod-ready-files.json', 'docs/ps4-extra-game-downloads.json', 'docs/ps4-ps5-game-patches.json', 'docs/console-ready-software.json', 'docs/ps4-store-apps.json', 'docs/console-batch4-apps.json', 'docs/virusmike-ps4-next-resources.json', 'docs/ps5-native-extra-cheats.json', 'docs/ps5-native-batch5.json']) {
    if (!fs.existsSync(path.join(root, document))) continue;
    const data = read(document);
    for (const entry of data.descriptors || data.resources || data.entries || []) audited('ps4-ps5-' + (entry.importJobId || entry.id), entry.filename, {
      ...entry, id: entry.id, name: entry.name || entry.title,
      platforms: entry.platforms || [entry.platform], reviewedData: true,
      category: entry.category === 'game-mod' ? 'mods' : entry.category,
      preparation: entry.preparation || (entry.replacementOnly ? 'Replacement file for an existing matching installation. Keep the complete support pack and license; follow the linked setup before replacing the PRX.' : undefined)
    });
  }
  const patchBundle = read('docs/ps4-ps5-game-patches.json');
  audited('ps4-ps5-fps-patch-archive-' + patchBundle.release, 'patch1.zip', {
    id: 'fps-patch-archive-' + patchBundle.release, platforms: ['ps4','ps5'], category:'patches',
    name:'Original complete patch XML bundle', version:patchBundle.release,
    compatibility:'Original upstream patch-data archive. Choose title ID, game update and the matching PS4 or PS5 patch engine before installing any definition.',
    description:'Complete original XML distribution, preserved alongside the selected ready title-specific files.',
    preparation:'Extract to a new folder, then install only the exact matching title-ID XML using the platform guide.',
    image:'/assets/images/game-patches/bloodborne.svg', page:'/console/ps4/game-patches.html#archive',
    pages:{ps4:'/console/ps4/game-patches.html#archive',ps5:'/console/ps5/game-patches.html#archive'},
    source:patchBundle.archive.url
  });
  audited('ps4-ps5-gta5-expulsion-v5-1-57-prepared-zip', 'Expulsion-V5.0-PS4-1.57.zip', {
    id: 'ps4-expulsion-v5-zip', platform: 'ps4', category: 'mods',
    name: 'Expulsion V5.0 · complete ZIP files', version: '5.0 / GTA V 1.57',
    compatibility: 'PS4 GTA V CUSA00419 game 1.57; GoldHEN plugin. Extract the complete ZIP and preserve data/user folders. No PS5 support is inferred.',
    description: 'Complete ZIP equivalent of the MIT-licensed RAR, including plugin, supporting files and license. Original RAR retained.',
    image: '/assets/images/ps4-gta5/expulsion.png', page: '/console/ps4/archive-files.html'
  });
  audited('ps4-ps5-whatsite-ps5-site-launcher-2026-11-02', /\.pkg$/i, {
    id: 'ps5-whatsite-site-launcher', platform: 'ps5', category: 'apps',
    name: 'whatwhatboy PS5 site shortcut', version: '2026.11.02.1',
    compatibility: 'Unofficial PS5 Media shortcut PKG, title ID WHAT00001. Requires an existing compatible PS5 homebrew package installer. Structural checks passed; physical console installation and launch untested.',
    description: 'A custom icon and Media tile linking to the PS5 hub. Installing this package is a separate explicit action.',
    image: '/assets/images/console-software/whatsite-launcher.png', page: '/console/ps5/site-launcher.html',
    source: 'https://github.com/kvnhrt/ps5-browser-app/tree/d427877157b5ffdf90847a0c3ad54c7025100f55'
  });
  // Host downloads remain console files, never implicit Run actions. Preserve
  // exact filenames for title-specific cheat packs even when bytes coincide.
  for (const catalog of ['docs/host-modern-plugin-actions.json','docs/host-current-cheat-actions.json','docs/host-game-actions.json','docs/host-legacy-menu-actions.json','docs/host-extra-game-actions.json','docs/host-web-utility-actions.json','docs/host-repository-menu-actions.json', 'docs/host-original-tool-actions.json', 'docs/host-legacy-firmware-menu-actions.json', 'docs/host-next-utility-actions.json', 'docs/host-gta505-continuation-actions.json', 'docs/host-arabicguy-672-actions.json']) {
    if (!fs.existsSync(path.join(root,catalog))) continue;
    for (const action of read(catalog).actions || []) {
      const owner = audit.find(item => item.status === 'downloaded' && (item.files || []).some(file => file.sha256 === action.sha256 && file.bytes === action.bytes));
      const file = owner && owner.files.find(file => file.sha256 === action.sha256 && file.bytes === action.bytes);
      if (!file || !['ps4','ps5'].includes(action.platform)) continue;
      add({...file, name:path.basename(action.downloadURL), filename:path.basename(action.downloadURL), local:action.downloadURL}, {
        id:action.id, platform:action.platform, category:action.category==='mods'?'mods':'payloads', reviewedData:true, preserveFilename:true,
        name:action.label + (action.gameVersion ? ' · ' + action.gameVersion : '') + (action.titleIds?.length ? ' · ' + action.titleIds.join(', ') : ''),
        version:action.menuVersion || action.version || action.gameVersion, image:action.image,
        compatibility:action.requirements.join(' '), description:[action.game,action.gameVersion,action.format].filter(Boolean).join(' · ') + '. Follow the exact file type and console loader requirements.',
        page:`/hosts/${action.platform}/`, source:action.source,
        preparation:action.directFileScope || action.installPath,
        requiresSupportArchive:action.supportArchiveURL || undefined,
        replacementOnly:Boolean(action.supportArchiveURL)
      }, owner);
    }
  }
  // Bind the native extraction allowlist to exact reviewed archive bytes. This
  // is attached after hash deduplication, including older GTA/BO3 catalogue rows.
  if (fs.existsSync(path.join(root,'docs/console-archive-safety.json'))) {
    const archiveReviews = read('docs/console-archive-safety.json').items;
    for (const item of result) {
      if (!/\.(zip|rar|7z)$/i.test(item.filename)) continue;
      const review = archiveReviews.find(row => row.sha256 === item.sha256 && row.bytes === item.bytes && row.reviewed);
      if (review) item.archiveSafety = review;
    }
  }
  const retainedPath=path.join(root,'docs/host-goldhen-retained-versions.json');
  const merged=fs.existsSync(retainedPath)?require('./prepare-host-goldhen-versions.cjs').mergeCatalogActions(result,read('docs/host-goldhen-retained-versions.json').actions,{root}).items:result;
  assertCatalogueBounds(merged);
  return merged;
}

function getCatalog(platform) {
  if (!['ps4', 'ps5'].includes(platform)) throw Error('Expected ps4 or ps5');
  return read('docs/console-download-catalog.json').items.filter(item => item.platforms.includes(platform)).map(item => item.pages?.[platform] ? {...item, page: item.pages[platform]} : item);
}

function nativeFeeds(items, options = {}) {
  const origin = new URL(options.origin || 'https://whatwhatboy.com');
  if (!['http:', 'https:'].includes(origin.protocol) || origin.pathname !== '/' || origin.search || origin.hash || origin.username || origin.password) throw Error('Expected a plain HTTP(S) origin');
  const absolute = value => new URL(options.resolveURL ? options.resolveURL(value) : value, origin.origin).href;
  const ps4 = items.filter(item => item.platforms.includes('ps4') && item.category === 'apps' && /\.pkg$/i.test(item.filename));
  const description = item => item.description === item.compatibility ? item.description : item.description + ' ' + item.compatibility;
  const artMetadata = options.images || [];
  const ps4Feed = {DATA: Object.fromEntries(ps4.map(item => {
    const art = artMetadata.find(entry => entry.image === item.image);
    // PS4 Games Installer accepts covers up to2048px; retain the full screenshot
    // on the website, but use the valid console artwork for an oversized cover.
    const cover = art && (art.width > 2048 || art.height > 2048) ? '/assets/images/consoles/playstation.jpg' : item.image;
    return [absolute(item.url), {name: item.name, version: item.version, description: description(item), size: item.bytes, cover_url: absolute(cover)}];
  }))};
  const ps5 = items.filter(item => item.platforms.includes('ps5') && item.category !== 'mods' && /\.(?:elf|bin)$/i.test(item.filename) && !/^pldmgr[_-]/i.test(item.filename));
  const ps5Feed = {name: options.name || 'whatwhatboy · PS5 payloads', payloads: ps5.map(item => ({
    id: item.id, name: item.name, filename: item.filename, url: absolute(item.url), version: item.version,
    description: description(item), category: item.category === 'payloads' ? 'System & services' : 'Apps & helpers',
    checksum: item.sha256, ...(item.source ? {source: absolute(item.source)} : {})
  }))};
  return {ps4Feed, ps5Feed};
}

function buildCatalog(options = {}) {
  const items = collect();
  const document = {schemaVersion: 1, reviewed: '2026-11-02',
    sources: ['docs/download-audit.json', 'docs/expansion-ps4-ps5.json', 'docs/ps4-ps5-customization.json', 'docs/console-prepared-archive-jobs.json', 'docs/console-ready-file-descriptors.json', 'docs/console-multicod-ready-files.json', 'docs/ps4-extra-game-downloads.json', 'docs/ps4-ps5-game-patches.json', 'docs/console-ready-software.json', 'docs/ps4-store-apps.json', 'docs/virusmike-ps4-next-resources.json', 'docs/ps5-native-extra-cheats.json', 'docs/ps5-native-batch5.json', 'docs/host-modern-plugin-actions.json', 'docs/host-current-cheat-actions.json', 'docs/host-game-actions.json', 'docs/host-legacy-menu-actions.json', 'docs/host-extra-game-actions.json', 'docs/host-web-utility-actions.json', 'docs/host-repository-menu-actions.json', 'docs/host-original-tool-actions.json', 'docs/host-legacy-firmware-menu-actions.json', 'docs/host-next-utility-actions.json', 'docs/host-gta505-continuation-actions.json', 'docs/host-arabicguy-672-actions.json', 'docs/console-archive-safety.json', 'docs/ps4-ps5-launcher-build.json', 'downloads/ps4/GTA5/manifest.json', 'downloads/ps4/BO3/manifest.json'], items};
  document.sources.push('docs/console-batch4-apps.json');
  if(fs.existsSync(path.join(root,'docs/host-goldhen-retained-versions.json')))document.sources.push('docs/host-goldhen-retained-versions.json');
  const {ps4Feed, ps5Feed} = nativeFeeds(items, {...options, images:read('docs/expansion-ps4-ps5.json').images});
  fs.writeFileSync(output, JSON.stringify(document, null, 2) + '\n');
  fs.writeFileSync(path.join(root, 'console/ps4/homebrew.json'), JSON.stringify(ps4Feed, null, 2) + '\n');
  fs.writeFileSync(path.join(root, 'console/ps5/payloads.json'), JSON.stringify(ps5Feed, null, 2) + '\n');
  return {items: items.length, ps4: items.filter(item => item.platforms.includes('ps4')).length,
    ps5: items.filter(item => item.platforms.includes('ps5')).length, ps4Packages: Object.keys(ps4Feed.DATA).length, ps5Payloads: ps5Feed.payloads.length};
}

if (require.main === module) console.log(JSON.stringify(buildCatalog(), null, 2));
module.exports = {getCatalog, buildCatalog, nativeFeeds, MAX_PLATFORM_ITEMS, assertCatalogueBounds};
