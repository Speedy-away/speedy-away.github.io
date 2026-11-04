// Shared page metadata transform. Importing this module never writes or scans pages.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const origin = 'https://whatwhatboy.com';
const hostCatalog = require('../docs/console-exploit-hosts.json');
const sitePages = require('./site-public-pages.cjs');
const metadataContent = require('./page-metadata-content.cjs');
const {isGenericKeyword} = require('./search-keyword-quality.cjs');
const overridesPath = path.join(root, 'docs/seo/search-editorial-overrides.json');
const searchOverrides = fs.existsSync(overridesPath) ? JSON.parse(fs.readFileSync(overridesPath, 'utf8')) : {};
const socialImagesPath = path.join(root, 'docs/seo/social-images.json');
let socialImagesCache, socialImagesStamp;
function socialImageFor(relative, options) {
  let manifest = options.socialImages;
  if (!Object.prototype.hasOwnProperty.call(options, 'socialImages')) {
    if (!fs.existsSync(socialImagesPath)) return null;
    const stat = fs.statSync(socialImagesPath);
    const stamp = `${stat.mtimeMs}:${stat.size}`;
    if (stamp !== socialImagesStamp) {
      socialImagesCache = JSON.parse(fs.readFileSync(socialImagesPath, 'utf8'));
      socialImagesStamp = stamp;
    }
    manifest = socialImagesCache;
  }
  const entry = manifest?.images?.[relative];
  if (!entry) return null;
  assert(entry.path && entry.alt && Number.isInteger(entry.width) && entry.width > 0 && Number.isInteger(entry.height) && entry.height > 0 && /^image\//.test(entry.type), `${relative}: incomplete social preview entry`);
  return {...entry, url: new URL(entry.path, origin).href};
}
let cachedModMetadata;
function getModMetadata(relative) {
  if (!relative.startsWith('console/mods/') && relative !== 'console/vault.html') return null;
  cachedModMetadata ||= require('./console-mod-metadata.cjs').metadataByPage();
  return cachedModMetadata;
}
function normalizedFile(file) {
  const value = String(file).replaceAll('\\', '/');
  if (/^\/(?:console|pc|games|tools|downloads|source-codes|pages|free-keys|hosts|mods|guides|api)\//.test(value) || value === '/index.html' || value === '/404.html') return value.slice(1);
  return sitePages.relativePath(file);
}
function protectedFile(file, html = '') {
  const relative = normalizedFile(file);
  return !sitePages.eligible(relative) || /(?:^|\/)whatsite-ps[45]\.html$/i.test(relative) || /\bid=["']receiver-catalog["']/i.test(html);
}
const decode = text => text.replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&(?:#39|lsquo|rsquo);/g, "'").replace(/&nbsp;/g, ' ').replace(/&(?:mdash|ndash);/g, '-').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const plain = text => decode(text.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
const escape = text => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const titles = {
  'console/ps4/index.html': hostCatalog.seo.ps4.title,
  'console/ps5/index.html': hostCatalog.seo.ps5.title,
  'console/mods/ps4/rdr2/index.html': 'RDR2 PS4 Mod Menus: Oyster, North & More | whatwhatboy',
  'console/mods/ps4/gta5/index.html': 'GTA 5 PS4 Mod Menus by Game Update | whatwhatboy',
  'mods/gta5.html': 'GTA V Mods: Menyoo, Script Hook V & Graphics | whatwhatboy',
  'mods/gta4.html': 'GTA IV Mods: iCEnhancer & LCPDFR | whatwhatboy',
  'mods/rdr2.html': 'RDR2 Mods: Rampage, Script Hook & Gameplay | whatwhatboy',
  'mods/skyrim.html': 'Skyrim Mods: ENB & SkyUI | whatwhatboy',
  'console/nintendo-emulators.html': 'Nintendo Emulators: Dolphin, Cemu & Switch | whatwhatboy',
  'console/playstation-emulators.html': 'PlayStation Emulators: PS1, PS2, PS3 & PSP | whatwhatboy',
  'games/cs2/index.html': 'CS2 Cheats & Tools: PassatHook, Undetek & Scooby | whatwhatboy',
  'games/cod/index.html': 'Call of Duty Cheats, GSC Menus & Clients | whatwhatboy',
  'games/cod/plutonium.html': 'Plutonium Tools: Black Ops 1, BO2 & MW3 | whatwhatboy',
  'pages/profile.html': 'whatwhatboy Profile & Social Links',
};
const descriptions = {
  'console/mods/ps4/rdr2/index.html': 'Browse North Beta, Sheriff 1.32, Havana and Oyster Free for RDR2 on PS4, with menu previews, version details and supplied setup guides.',
  'console/mods/ps4/gta5/index.html': 'Find GTA 5 PS4 menus by game update, including older builds, Expulsion, Cyprus, Ozark, Velora and Beach, plus scripts and setup guides.',
  'index.html': 'Browse game cheats, mod menus, Lua scripts, console homebrew, emulators and setup guides for GTA V, CS2, Call of Duty, FiveM, TF2 and more.',
  'console/emulators.html': 'Browse PC console emulators including PCSX2, RPCS3, Dolphin, Cemu, Xenia, Project64 and PPSSPP, with feature summaries, setup tips and official links.',
  'console/index.html': 'Browse consoles by family: PlayStation, Xbox, Nintendo, Sega and handheld PCs. Find console guides, homebrew, themes and clearly labelled PC emulation resources.',
  'console/nintendo-emulators.html': 'Explore Nintendo emulators including Dolphin, Cemu, Ryujinx, yuzu and Project64, with setup notes for GameCube, Wii, Wii U, Switch and handhelds.',
  'console/playstation-emulators.html': 'Find PlayStation emulators including ePSXe, PCSX2, RPCS3 and PPSSPP, with PS1, PS2, PS3 and PSP setup guides and links to project websites.',
  'console/xbox-emulators.html': 'Compare Xemu, Xenia and Xenia Canary for Original Xbox and Xbox 360 emulation on PC, with setup notes, compatibility resources and project links.',
  'console/ps3/index.html': 'Choose PS3 HEN or CFW guides, apps, file-transfer tools, Apollo saves, emulators, game mods and downloads for PlayStation 3.',
  'console/ps4/index.html': hostCatalog.seo.ps4.description,
  'console/ps5/index.html': hostCatalog.seo.ps5.description,
  'console/xbox360/index.html': 'Choose Xbox 360 softmod or JTAG/RGH guides, then browse payloads, dashboards, homebrew apps, PC tools, game mods and downloads.',
  'console/nintendo-switch.html': 'Find Nintendo Switch homebrew tools, Atmosphere custom firmware, Hekate bootloader, Homebrew App Store and model-specific setup resources.',
  'console/steamdeck.html': `Browse Steam Deck apps, Decky plugins, Proton tools, file transfers and remote play, with official downloads and ${require('../docs/steamdeck-setup-guides.json').length} setup guides.`,
  'mods/gta5.html': 'Browse GTA V single-player mods for Enhanced and Legacy: Menyoo, Rampage Trainer, Script Hook V, NaturalVision Evolved, VisualV and Redux.',
  'mods/gta4.html': 'Explore GTA IV mods including iCEnhancer graphics and LCPDFR gameplay, with download links and installation notes for modding Liberty City.',
  'mods/rdr2.html': 'Browse Red Dead Redemption 2 single-player mods: Script Hook RDR2, Rampage Trainer, superhero mods and Dive, with links and installation notes.',
  'mods/skyrim.html': 'Find Skyrim graphics and interface mods including ENB Series and SkyUI, with project links and installation notes for Skyrim Special Edition.',
  'tools/index.html': 'Browse DLL injectors, memory tools and modding utilities including Extreme Injector, System Informer, Cheat Engine, ReShade and Mod Organizer 2.',
  'tools/injectors.html': 'Browse DLL injectors and memory tools including Extreme Injector, Xenos, GH Injector, System Informer and Cheat Engine, with features and setup notes.',
  'tools/mods.html': 'Explore modding utilities including ReShade, ENB, Mod Organizer 2, Vortex, OpenIV, SKSE and LOOT, with features and links to the listed tools.',
  'games/tf2/index.html': 'Browse Team Fortress 2 64-bit tools including SEOwned, neu3 and Scooby, plus TF2 Classic and Classified listings, with previews and download links.',
  'games/cs2/index.html': 'Explore CS2 tools including PassatHook, Undetek, Osiris V2, Enigma, SharkHack and Scooby, with screenshots, feature summaries and download links.',
  'games/cod/plutonium.html': 'Browse Plutonium tools for Black Ops 1, Black Ops 2 and Modern Warfare 3 (2011), with feature summaries, client-specific listings and download links.',
  'pages/help.html': 'Find help with game mod installation, missing runtimes, download issues and antivirus alerts, plus troubleshooting answers for tools listed on this site.',
  'pages/nenyoo.html': 'Read the Nenyoo account access update and follow the access instructions provided on this page.',
  'pages/old-scoobyontop2.html': 'Legacy Scooby Menu free-key access page. Follow the access instructions and links shown on this page.',
  'api/scooby-key.html': 'Scooby key output endpoint used by the site access flow.',
  'free-keys/sponsor-frame.html': 'Advertisement frame displayed during the free-key access flow.',
  '404.html': 'This page could not be found. Return to the whatwhatboy home page to browse game tools, mods, console homebrew and help resources.',
};
const aliases = {
  'console/ps4/jailbreaks.html': ['PS4 jailbreak firmware selector', 'PS4 14.00 guide', 'PS4 13.52 or lower', 'PS4 browser jailbreak', 'PS4 Blu-ray jailbreak'],
  'console/ps4/jailbreak-13-52.html': ['PS4 13.52 jailbreak', 'PS4 7.00 to 13.52 browser guide', 'MODDED WARFARE PS4 tutorial', 'GamerHack PS4 host', 'RAW GAME host', 'PS4 offline jailbreak cache'],
  'console/ps4/goldhen.html': ['GoldHEN download page', 'archived GoldHEN 2.3', 'supplied GOLDHEN14 ISO', 'PS4 HEN firmware requirements'],
  'console/ps4/downloads.html': ['PS4 console downloads', 'download PS4 homebrew to HDD', 'PS4 Games Installer catalogue', 'PS4 ezRemote downloader', 'PS4 mod file downloads', 'PS4 payload files'],
  'console/ps5/downloads.html': ['PS5 console downloads', 'download PS5 homebrew to SSD', 'PS5 Payload Manager source', 'PS5 ezRemote downloader', 'PS5 payload files', 'PS5 USB downloads'],
  'console/ps4/': ['PS4', 'PlayStation 4', 'PS4 jailbreak', 'GoldHEN', 'PS4 homebrew', 'PS4 tools'],
  'console/ps5/': ['PS5', 'PlayStation 5', 'PS5 jailbreak', 'PS5 homebrew', 'etaHEN', 'PS5 payloads'],
  'console/ps3': ['PS3', 'PlayStation 3', 'PS3 homebrew', 'PS3HEN', 'custom firmware'],
  'console/xbox360': ['Xbox 360', 'Xbox 360 homebrew', 'Aurora dashboard', 'RGH', 'JTAG'],
  'console/nintendo-switch': ['Nintendo Switch', 'Switch homebrew', 'Atmosphere', 'Hekate'],
  'console/mods/ps4/': ['PS4 game mods', 'PlayStation 4 mod menus', 'console mod menus', 'GoldHEN plugins', 'SPRX menus', 'PRX plugins'],
  'console/mods/ps4/gta5/': ['GTA 5 PS4 mod menus', 'GTA V PS4 mods', 'Grand Theft Auto V', 'GTA 5 1.57 mod menus', 'GTA 5 1.56 mod menus', 'Expulsion', 'Ozark', 'Velora', 'Beach', 'LTS', 'Serendipity', 'Oxagon', 'GTA V script loader', 'CSC scripts'],
  'console/psvita/': ['PS Vita', 'PlayStation Vita', 'Apollo Save Tool', 'VitaShell', 'Vita homebrew', 'save backups'],
  'downloads/': ['mod menu downloads', 'Lua scripts', 'modding tools', 'source code archives'],
  'source-codes/': ['game source code', 'mod menu source codes'],
  'source-codes/games/gta5/': ['GTA 5', 'GTA V', 'Grand Theft Auto V', 'PS4 source codes', 'PlayStation 4'],
  'console/mods/ps4/call-of-duty/': ['Call of Duty', 'PS4 mod menus'],
  'console/mods/ps4/call-of-duty/black-ops-3/': ['Black Ops 3', 'Black Ops III', 'BO3', 'GSC Injector', 'Zombies', 'Multiplayer', 'MuzzMan', 'DayBreak', 'EnCoRe', 'Purple Lake', 'Frostbite', 'WhiteShadow8500', 'Synergy', 'MatrixMods'],
  'console/mods/ps4/rdr2/': ['RDR2 mod menu PS4', 'RDR2 PS4 mod menus', 'Red Dead Redemption 2 PS4 mods', 'Red Dead Redemption 2 mod menu', 'RDR2 mod menu downloads', 'North Beta mod menu', 'Sheriff 1.32 mod menu', 'Havana mod menu', 'RDR2 PS4 installation', 'Red Dead Redemption 2', 'RDR2', 'North', 'Sheriff 1.32', 'Havana'],
  'games/gta/': ['GTA 5', 'GTA V', 'Grand Theft Auto V', 'GTA Online'],
  'games/cod/': ['Call of Duty', 'COD'],
  'games/cs2/': ['Counter-Strike 2', 'CS2'],
  'games/cs16/': ['Counter-Strike 1.6', 'CS 1.6'],
  'games/css/': ['Counter-Strike Source', 'CSS'],
  'games/csgo/': ['Counter-Strike Global Offensive', 'CS:GO'],
  'games/rdr2/': ['Red Dead Redemption 2', 'RDR2'],
  'games/gmod/': ["Garry's Mod", 'GMod', 'Lua scripts'],
  'games/left4dead/': ['Left 4 Dead', 'Left 4 Dead 2', 'L4D2'],
  'games/tf2/': ['Team Fortress 2', 'TF2', 'TF2 Classic', 'TF2 Classified'],
  'games/fivem/': ['FiveM', 'GTA V'],
  'games/battlefield/': ['Battlefield', 'Battlefield PC tools'],
  'games/battlefield/battlefield-5.html': ['Battlefield V', 'Battlefield 5', 'BFV', 'BF5'],
  'games/battlefield/battlefield-2042.html': ['Battlefield 2042', 'BF2042'],
  'games/apex/': ['Apex Legends', 'Apex PC tools'],
  'games/valorant/': ['Valorant', 'Valorant PC tools'],
  'games/fortnite/': ['Fortnite', 'Fortnite PC tools'],
  'games/rust/': ['Rust', 'Rust PC tools'],
  'games/farlight84/': ['Farlight 84', 'Farlight84'],
  'games/pvzgw2/': ['Plants vs. Zombies Garden Warfare 2', 'PVZ GW2', 'Garden Warfare 2'],
  'games/gta/modded-outfits.html': ['GTA 5 modded outfits', 'GTA Online outfit mods', 'GTA V custom outfits'],
  'games/gta/modded-vehicles.html': ['GTA 5 modded vehicles', 'GTA V custom vehicles', 'GTA Online vehicle mods'],
  'games/gta/lua/kiddions-scripts.html': ['Kiddions Lua scripts', 'Kiddions Modest Menu scripts', 'GTA 5 Lua downloads'],
  'pc/playstation-emulators.html': ['PlayStation emulators for PC', 'PS1 emulator', 'PS2 emulator', 'PS3 emulator', 'PSP emulator', 'PCSX2', 'RPCS3', 'PPSSPP'],
  'pc/nintendo-emulators.html': ['Nintendo emulators for PC', 'GameCube emulator', 'Wii emulator', 'Wii U emulator', 'Nintendo DS emulator', 'Nintendo 3DS emulator', 'Dolphin', 'Cemu'],
  'pc/xbox-emulators.html': ['Xbox emulators for PC', 'original Xbox emulator', 'Xbox 360 emulator', 'Xemu', 'Xenia', 'Xenia Canary'],
  'pc/emulators.html': ['console emulators for Windows', 'retro gaming on PC', 'emulator setup guides', 'emulator compatibility'],
  'tools/cheatengine/': ['Cheat Engine', 'Cheat Engine download', 'memory scanner', 'cheat tables', 'CT files'],
  'mods/rdr2.html': ['RDR2 PC mods', 'Red Dead Redemption 2 single-player mods', 'Rampage Trainer', 'Script Hook RDR2', 'RDR2 gameplay mods'],
  'mods/gta5.html': ['GTA 5 PC mods', 'GTA V Enhanced mods', 'GTA V Legacy mods', 'Menyoo', 'Script Hook V', 'GTA 5 graphics mods'],
  'mods/gta4.html': ['GTA 4 mods', 'Grand Theft Auto IV', 'Liberty City mods', 'iCEnhancer', 'LCPDFR'],
  'tools/injectors.html': ['DLL injection tools', 'DLL injector downloads', 'Xenos Injector', 'Extreme Injector', 'memory editing tools'],
  'tools/mods.html': ['PC mod managers', 'ReShade presets', 'Vortex mod manager', 'Mod Organizer 2', 'OpenIV tools'],
  'console/ps3/hen.html': ['PS3 HEN installation guide', 'PS3 HFW 4.93.1', 'PS3HEN setup', 'PS3 hybrid firmware'],
  'console/ps3/cfw.html': ['PS3 CFW installation guide', 'Evilnat CFW', 'PS3 Toolset', 'PS3Xploit', 'PS3 flash checker'],
  'console/ps5/jailbreaks.html': ['PS5 jailbreak firmware selector', 'PS5 firmware guides', 'PS5 UMTX2 browser jailbreak', 'PS5 6.00 6.02 6.50 Blu-ray BD-J', 'PS5 7.00 to 13.60 Relapse', 'PlayStation 5 jailbreak requirements'],
  'console/ps5/umtx2.html': ['PS5 UMTX2 jailbreak', 'PS5 1.00 to 5.50 browser guide', 'idlesauce UMTX2 host', 'PS5 ELF loader 9021', 'PS5 firmware compatibility'],
  'console/ps5/bdj.html': ['PS5 BD-J jailbreak', 'PS5 Blu-ray guide', 'PS5 JAR Loader 4.1.1', 'PS5 6.00 6.02 6.50', 'PS5 7.61 UMTX', 'PS5 recordable Blu-ray requirements'],
  'console/ps5/y2jb.html': ['PS5 Y2JB installer', 'Y2JB autoloader', 'PS5 homebrew setup', 'itsPLK autoloader'],
  'console/ps5/relapse.html': ['PS5 Relapse jailbreak', 'PS5 13.60 firmware', 'PS5 manual DNS settings', 'PS5 jailbreak setup guide'],
  'console/ps4/jailbreak.html': ['PlayStation 4 jailbreak guide', 'PS4 DNS setup guide', 'PS4 HEN setup', 'PS4 browser exploit host', 'PS4 BD-J exploit', 'Blu-ray jailbreak requirements'],
  'console/ps4/emulators.html': ['PS4 emulator downloads', 'emulators on jailbroken PS4', 'PS4 PS2 emulator', 'PS4 GameCube emulator', 'PS4 Wii emulator', 'PS4 Wii U emulator', 'PS4 Dreamcast emulator', 'PS4 homebrew PKG installation'],
  'console/ps5/emulators.html': ['PS5 emulator downloads', 'emulators on jailbroken PS5', 'PS5 PS2 emulator', 'PS5 PS3 emulator', 'PS5 GameCube emulator', 'PS5 Wii emulator', 'PS5 Wii U emulator', 'PS5 Xbox 360 emulator', 'PS5 Dreamcast emulator', 'PS5 RetroArch'],
  'console/mods/ps4/gta5/install.html': ['GTA 5 PS4 mod menu installation', 'GTA V GoldHEN plugin setup', 'GTA 5 plugins.ini', 'PS4 SPRX installation guide', 'GTA V CSC script installation'],
  'console/mods/ps4/gta5/online.html': ['Los Santos Online', 'GTA 5 PS4 private server', 'GTA V private server setup', 'Los Santos Online guide'],
  'console/retro/wii.html': ['Nintendo Wii homebrew', 'Wii Homebrew Channel', 'Wii apps', 'Wii setup guide'],
  'console/retro/gamecube.html': ['Nintendo GameCube homebrew', 'GameCube apps', 'Swiss GameCube loader', 'GameCube setup guide'],
  'console/retro/ds.html': ['Nintendo DS homebrew', 'Nintendo DSi homebrew', 'DS flashcart setup', 'DSi custom firmware'],
  'console/retro/3ds.html': ['Nintendo 3DS homebrew', 'Nintendo 2DS homebrew', '3DS custom firmware', '2DS CFW', '3DS apps'],
  'console/retro/ps2.html': ['PlayStation 2 homebrew', 'PS2 apps', 'PS2 memory card setup', 'PS2 ELF tools'],
  'console/retro/index.html': ['retro console homebrew', 'Wii homebrew', 'GameCube homebrew', 'Nintendo DS and DSi', 'Nintendo 2DS and 3DS', 'PlayStation 2 homebrew', 'PSP homebrew', 'original Xbox mods'],
  'console/steamdeck.html': ['Steam Deck plugins', 'Steam Deck tools', ...require('../docs/steamdeck-resources.json').items.map(item => item.title), 'SteamOS desktop mode'],
  'console/': ['console homebrew'],
  'pc/': ['PC gaming', 'PC emulators'],
  'mods/': ['game mods', 'single-player mods'],
  'tools/': ['PC gaming tools', 'modding utilities'],
};
const codGames = {
  'black-ops-1': ['Call of Duty Black Ops', 'Black Ops 1', 'BO1'],
  'black-ops-2': ['Call of Duty Black Ops II', 'Black Ops 2', 'BO2'],
  'black-ops-3': ['Call of Duty Black Ops III', 'Black Ops 3', 'BO3'],
  'black-ops-4': ['Call of Duty Black Ops 4', 'Black Ops IV', 'BO4'],
  'black-ops-6': ['Call of Duty Black Ops 6', 'BO6'],
  'cold-war': ['Call of Duty Black Ops Cold War', 'BOCW', 'Cold War'],
  'cod4': ['Call of Duty 4 Modern Warfare', 'COD4'],
  'mw2-2009': ['Call of Duty Modern Warfare 2 2009', 'MW2 2009', 'IW4'],
  'mw3-2011': ['Call of Duty Modern Warfare 3 2011', 'MW3 2011', 'IW5'],
  'mw-2019': ['Call of Duty Modern Warfare 2019', 'MW2019'],
  'mw2019': ['Call of Duty Modern Warfare 2019', 'MW2019'],
  'advanced-warfare': ['Call of Duty Advanced Warfare', 'COD AW'],
  'infinite-warfare': ['Call of Duty Infinite Warfare', 'COD IW'],
  'ghosts': ['Call of Duty Ghosts', 'COD Ghosts'],
  'warzone': ['Call of Duty Warzone', 'COD Warzone'],
  'h2m': ['H2M', 'H2M mod', 'Modern Warfare Remastered'],
};
const consoleTopics = [
  { paths: /^console\/retro\//, topics: [
    ['Homebrew Channel', 'Wii Homebrew Channel setup'], ['Open Shop Channel', 'Wii homebrew apps'],
    ['Priiloader', 'Wii Priiloader system menu tools'], ['Nintendont', 'Nintendont GameCube compatibility'],
    ['Swiss', 'Swiss GameCube homebrew loader'], ['GCMM', 'GameCube memory card manager'],
    ['TWiLight', 'TWiLight Menu DS and DSi'], ['nds-bootstrap', 'nds-bootstrap DS launcher'],
    ['Unlaunch', 'Unlaunch DSi bootcode exploit'], ['Luma3DS', 'Luma3DS custom firmware'],
    ['GodMode9', 'GodMode9 3DS file manager'], ['Universal-Updater', 'Universal-Updater 3DS apps'],
    ['Checkpoint', 'Checkpoint save backup manager'], ['FreeMcBoot', 'FreeMcBoot PS2 memory card setup'],
    ['OpenTuna', 'OpenTuna PS2 exploit'], ['Open PS2 Loader', 'Open PS2 Loader OPL'],
    ['wLaunchELF', 'wLaunchELF PS2 file manager'], ['PS2Ident', 'PS2Ident hardware information'],
    ['Apollo', 'Apollo PS2 save manager'],
  ] },
  { paths: /^console\/ps[45]\//, topics: [
    ['GoldHEN', 'GoldHEN homebrew enabler'], ['etaHEN', 'etaHEN payload setup'],
    ['ShadowMountPlus', 'ShadowMountPlus payload'], ['PS5upload', 'PS5 payload upload tool'],
    ['PlaydenPS5', 'Playden PS5 PC gaming'], ['ProsperoStore', 'ProsperoStore homebrew downloads'],
    ['Orbit Store', 'Orbit PS5 store installation'], ['Y2JB', 'Y2JB setup guide'],
  ] },
  { paths: /^console\/ps3(?:\/|\.html)/, topics: [
    ['multiMAN', 'multiMAN PS3 download'], ['webMAN MOD', 'webMAN MOD PS3'],
    ['IRISMAN', 'IRISMAN PS3 file manager'], ['PKGi', 'PKGi PS3 homebrew app'],
    ['CCAPI', 'PS3 Control Console API'], ['Artemis', 'Artemis PS3 tools'],
  ] },
  { paths: /^console\/xbox360(?:\/|\.html)/, topics: [
    ['Peer Pressure', 'Xbox 360 Peer Pressure softmod'], ['Aurora', 'Aurora Xbox 360 dashboard'],
    ['FreeStyle Dash', 'Xbox 360 FreeStyle Dash'], ['XeXMenu', 'XeXMenu Xbox 360'],
    ['Neighborhood', 'Xbox 360 Neighborhood tools'], ['NAND Flasher', 'Xbox 360 NAND backup tools'],
    ['BadUpdate', 'Xbox 360 BadUpdate homebrew'], ['FreeMyXe', 'FreeMyXe Xbox 360 payload'],
    ['XeUnshackle', 'XeUnshackle Xbox 360 payload'], ['ABadAvatar', 'ABadAvatar Xbox 360'],
    ['XeLL', 'XeLL Reloaded libxenon'], ['FATXplorer', 'FATXplorer Xbox storage tools'],
    ['Velocity', 'Velocity Xbox 360 file tools'], ['XeCLI', 'XeCLI Xbox 360 helper'],
  ] },
  { paths: /^console\/psvita\//, topics: [
    ['Apollo', 'Apollo PS Vita save manager'], ['VitaShell', 'VitaShell file manager'],
    ['HENlo', 'HENlo PS Vita jailbreak'], ['HENkaku', 'HENkaku homebrew setup'],
    ['Ensō', 'PS Vita Ensō CFW'], ['VitaDeploy', 'VitaDeploy setup guide'],
    ['VitaDB', 'VitaDB Downloader'], ['Adrenaline', 'Adrenaline PSP and PS1'],
    ['PKGj', 'PKGj Vita package downloader'], ['AutoPlugin II', 'AutoPlugin II Vita plugins'],
    ['iTLS', 'iTLS-Enso HTTPS support'], ['YAMT', 'YAMT SD2Vita storage'],
    ['VPK', 'PS Vita VPK installation'], ['USB', 'PS Vita USB file transfer'],
  ] },
  { paths: /^console\/nintendo-switch(?:\/|\.html)/, topics: [
    ['Atmosphère', 'Atmosphere Switch custom firmware'], ['Hekate', 'Hekate Switch bootloader'],
    ['Homebrew App Store', 'Switch homebrew app downloads'], ['RetroArch', 'Switch RetroArch emulators'],
  ] },
];
// Search phrases identify a page's subject; firmware phrases never assert support.
function contextualTerms(relative, content) {
  const text = plain(content);
  const terms = [];
  for (const group of consoleTopics) {
    if (!group.paths.test(relative)) continue;
    for (const [visibleTerm, phrase] of group.topics) {
      if (text.toLowerCase().includes(visibleTerm.toLowerCase())) terms.push(phrase);
    }
  }
  const hostPlatform = relative.match(/^console\/(ps[45])\/index\.html$/)?.[1];
  if (hostPlatform) {
    const hosts = hostCatalog.platforms[hostPlatform];
    terms.push(...hostCatalog.seo[hostPlatform].keywords);
    // Keep every listed host discoverable before adding broader page terminology.
    terms.push(...hosts.map(host => host.label));
    terms.push(...hosts.flatMap(host => host.tags || []));
  }
  if (/^(?:games\/cod\/|console\/mods\/[^/]+\/call-of-duty\/)/.test(relative)) {
    const slug = relative.split('/').filter(p => p !== 'index.html').at(-1).replace(/\.html$/, '').replace(/-gsc$/, '');
    const names = codGames[slug];
    if (names) {
      terms.push(...names);
      if (/mod menu/i.test(text)) terms.push(`${names[1] || names[0]} mod menus`);
      if (/GSC/i.test(text)) terms.push(`${names[1] || names[0]} GSC scripts`);
      if (/Zombies/i.test(text)) terms.push(`${names[1] || names[0]} Zombies mods`);
    }
  }
  if (/^console\/ps4\/(?:index|jailbreak)\.html$/.test(relative)) {
    terms.push('PS4 14.0 jailbreak', 'PS4 14.00 jailbreak', 'PS4 manual DNS', 'PS4 Blu-ray jailbreak', 'HEN firmware compatibility');
  }
  if (relative === 'console/ps4/index.html') terms.push('PS4 13.52 jailbreak guide', 'PS4 Jailbreak pages', 'PS4 GoldHEN downloads');
  if (relative === 'console/ps5/index.html') {
    terms.push('PS5 jailbreak firmware compatibility', 'PS5 14.0 jailbreak status', 'PS5 14.00 jailbreak status', 'PS5 14.10 jailbreak status', 'PS5 14.20 jailbreak status', 'PS5 13.60 jailbreak', 'Relapse', 'Y2JB');
  }
  if (relative === 'console/ps5/apps.html') {
    terms.push('PS5 apps', 'PS5 homebrew store', 'PlaydenPS5', 'ProsperoStore', 'Orbit Store', 'homebrew app downloads');
  }
  if (relative === 'console/ps5/payloads.html') {
    terms.push('PS5 payloads', 'ShadowMountPlus', 'etaHEN', 'PS5 ELF loader', 'PS5 kernel logs');
  }
  if (relative === 'console/ps5/transfer-tools.html') {
    terms.push('PS5 transfer tools', 'PS5upload', 'PS5 ezRemote Client', 'PS5 FTP server', 'PS5 websrv', 'PS5 file transfers');
  }
  if (relative === 'console/ps4/payloads.html') {
    terms.push('PS4 payloads', 'PS4 HEN resources', 'GoldHEN', 'PS4 payload compatibility');
  }
  if (relative === 'console/ps4/apps.html') {
    terms.push('PS4 apps', 'PS4 homebrew utilities', 'Apollo Save Tool', 'PS4-Xplorer', 'PS4 save manager', 'PS4 file manager');
  }
  if (/^console\/mods\//.test(relative)) {
    terms.push('console game resources');
  }
  if (/^source-codes\/games\/gta5\//.test(relative)) {
    terms.push('GTA 5 mod menu source code', 'GTA V PS4 source code', 'GTA 5 1.57 source codes', 'PS4 mod menu development');
  }
  if (/^console\/ps[345](?:\/|\.html)/.test(relative) && /Apollo Save Tool/.test(text)) {
    terms.push('Apollo Save Tool', 'PlayStation save manager', 'save backup tools', 'save data management');
  }
  if (/yim(?:v2)?-scripts/.test(relative)) {
    const version = /yimv2/.test(relative) ? 'V2' : 'V1';
    terms.push('YimMenu Lua scripts', `YimMenu ${version}`, `Yim ${version} Lua scripts`, 'GTA 5 Lua scripts', 'GTA V 1.73 scripts', 'Lua script downloads');
  }
  // Visible card tags are useful page-specific terms, unlike sidebar labels.
  for (const m of content.matchAll(/<(?:span|li)\b[^>]*class="[^"]*\b(?:tag|game-tag|feature-tag)\b[^"]*"[^>]*>([\s\S]*?)<\/(?:span|li)>/gi)) {
    const term = plain(m[1]);
    if (term.length > 2 && term.length < 55 && !generic.test(term) && !isGenericKeyword(term)) terms.push(term);
  }
  return terms;
}
const generic = /^(?:whatwhatboy(?:'s)?|free|active|safe|easy|enhanced|working|download.*|official site|video guide|before you install|graphics|gameplay|interface|mod menus|system requirements|safety.*|.*guidelines|important.*|how to.*|frequently asked questions|.*installation|.*tips|.*features|.*benefits|.*requirements|.*support|quick links|connect with me|.*\d+\+|\d+%|\d+(?:\.\d+)?|v\d+)$/i;

function pageSchema({canonical, title, description, keywords, image, imageInfo, metadata}) {
  const origin = 'https://whatwhatboy.com';
  const website = {'@type': 'WebSite', '@id': origin + '/#website', url: origin + '/', name: 'whatwhatboy'};
  const page = {'@type': metadata?.type || 'WebPage', '@id': canonical + '#webpage', url: canonical,
    name: title, description, inLanguage: 'en', isPartOf: {'@id': website['@id']}, keywords};
  if (image) page.image = image;
  if (imageInfo) page.primaryImageOfPage = {'@type': 'ImageObject', contentUrl: image,
    url: image, description: imageInfo.alt, encodingFormat: imageInfo.type,
    width: imageInfo.width, height: imageInfo.height};
  if (metadata?.items) page.mainEntity = {'@type': 'ItemList', numberOfItems: metadata.items.length,
    itemListElement: metadata.items.map((item, i) => ({'@type': 'ListItem', position: i + 1, name: item.name, url: new URL(item.url, origin).href}))};
  return {'@context': 'https://schema.org', '@graph': [website, page]};
}

function transform(file, before, options = {}) {
  const relative = normalizedFile(file);
  if (protectedFile(relative, before)) return {html: before, metadata: null, skipped: true};
  let head = before.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1];
  assert(head !== undefined, `${relative}: missing head`);
  const newline = before.includes('\r\n') ? '\r\n' : '\n';
  const tagPattern = name => new RegExp(`<${name}\\b(?:"[^"]*"|'[^']*'|[^'">])*>`, 'gi');
  const readAttribute = (tag, name) => {
    const match = tag.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, 'i'));
    return match ? decode(match[2]) : undefined;
  };
  const appendTag = tag => {
    // Existing tags and their surrounding whitespace stay in place. A later
    // wrapper may append CSS after metadata without making that metadata stale.
    head += `${head.endsWith('\n') ? '' : newline}    ${tag}${newline}`;
  };
  const get = (attribute, key) => {
    for (const match of head.matchAll(tagPattern('meta'))) {
      if (readAttribute(match[0], attribute)?.toLowerCase() === key.toLowerCase()) return readAttribute(match[0], 'content') || '';
    }
  };
  const oldTitle = plain(head.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '');
  const configuredMetadata = Object.prototype.hasOwnProperty.call(options, 'modMetadata') ? options.modMetadata : getModMetadata(relative);
  const editorial = configuredMetadata?.get(relative);
  const override = (options.overrides || searchOverrides)[relative];
  const noindex = /noindex/i.test(get('name', 'robots') || '');
  const redirect = /http-equiv=["']refresh/i.test(head);
  const canonicalTag = [...head.matchAll(tagPattern('link'))].find(match => readAttribute(match[0], 'rel')?.toLowerCase().split(/\s+/).includes('canonical'))?.[0];
  const canonical = readAttribute(canonicalTag || '', 'href') || `${origin}/${relative.replace(/index\.html$/, '')}`;
  const target = canonical.startsWith(origin + '/') ? canonical.slice(origin.length + 1).replace(/\/$/, '/index.html') || 'index.html' : '';
  const targetHtml = redirect && target && fs.existsSync(path.join(root, target)) ? fs.readFileSync(path.join(root, target), 'utf8') : '';
  const targetTitle = plain(targetHtml.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || '');
  let content = metadataContent.mainContent(before);
  let title = override?.title || editorial?.title || titles[relative] || oldTitle || plain(content.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || relative.replace(/(?:\/index)?\.html$/, '').split('/').at(-1).replaceAll('-', ' '));
  if (redirect) title = `${(titles[target] || targetTitle || 'Page').split(' | ')[0]} - Page Moved | whatwhatboy`;
  if (!title.includes('whatwhatboy')) title += ' | whatwhatboy';
  let description = override?.description || editorial?.description || descriptions[relative] || get('name', 'description');
  if (redirect) description = `This page has moved. Visit ${targetTitle.split(' | ')[0] || 'the updated page'} on whatwhatboy for the current page and links.`;
  const subject = title.split(' | ')[0];
  if (!description || description === 'Native PS5 cheat downloads. Match the PPSA title ID and installed game update.') description = metadataContent.fallbackDescription(subject, content);
  description = metadataContent.trimDescription(description);
  const terms = [subject];
  if (redirect) terms.push('page moved', targetTitle.split(' | ')[0]);
  else if (noindex) terms.push(...[...content.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map(m => plain(m[1])).filter(t => !/bypass|you found|access granted|your free key/i.test(t)));
  else if (override?.keywords) terms.push(...override.keywords);
  else if (editorial) terms.push(...editorial.keywords);
  else {
    terms.push(...contextualTerms(relative, content));
    const matchingAliases = Object.entries(aliases).filter(([prefix]) => metadataContent.matchesPrefix(relative, prefix)).sort((a, b) => b[0].length - a[0].length);
    for (const [prefix, values] of matchingAliases.slice(0, 1)) {
      const isExact = relative === prefix || relative === prefix + 'index.html' || relative === prefix + '.html';
      const visible = plain(content).toLowerCase();
      terms.push(...values.filter(term => isExact || visible.includes(term.toLowerCase())));
    }
    if (relative === 'index.html') terms.push('game cheats', 'mod menus', 'Lua scripts', 'console homebrew', 'emulators', 'game downloads');
    if (/yim(?:v2)?-scripts/.test(relative)) terms.push(...(get('name', 'keywords') || '').split(',').map(t => t.trim()));
    const templateMismatch = false;
    if (!templateMismatch) for (const m of content.matchAll(/<h[123]\b[^>]*>([\s\S]*?)<\/h[123]>/gi)) {
      const text = plain(m[1]);
      if (text.length > 2 && text.length < 70 && !generic.test(text) && !isGenericKeyword(text)) terms.push(text);
    }
  }
  const aliasModule = path.join(__dirname, 'page-search-tags.cjs');
  if (!noindex && !redirect && fs.existsSync(aliasModule)) {
    const subjectHeadings = subject + ' ' + [...content.matchAll(/<h[123]\b[^>]*>([\s\S]*?)<\/h[123]>/gi)].map(m => plain(m[1])).join(' ');
    terms.push(...require(aliasModule).aliasesFor(subjectHeadings));
  }
  terms.push('whatwhatboy');
  const keywordLimit = /^console\/ps[45]\/index\.html$/.test(relative) ? 60 : 35;
  const keywords = [...new Map(terms.filter(t => t && t.toLowerCase() !== 'whatwhatboy').map(t => [t.toLowerCase(), t])).values()].slice(0, keywordLimit).concat('whatwhatboy').join(', ');
  const bodyHero = before.match(/class="hero-image"[^>]*>[\s\S]*?<img\b[^>]*src="([^"]*)"/i)?.[1];
  let image = get('property', 'og:image') || get('name', 'twitter:image');
  if (/games\/gta\/lua\/yim/.test(relative)) image = `${origin}/assets/images/${relative.includes('yimv2') ? 'yimmenu-v2-lua' : 'yimmenu-lua'}.jpg?v=5`;
  if (!image && bodyHero) image = new URL(bodyHero, `${origin}/${relative}`).href;
  if (!image) image = `${origin}/assets/images/logo.png`;
  const imageInfo = socialImageFor(relative, options);
  if (imageInfo) image = imageInfo.url;
  const imageAlt = imageInfo?.alt || (image.includes('/logo.png') ? 'whatwhatboy logo' : `${subject} artwork`);
  function meta(attribute, key, value) {
    let found = false;
    head = head.replace(tagPattern('meta'), tag => {
      if (readAttribute(tag, attribute)?.toLowerCase() !== key.toLowerCase()) return tag;
      if (found) return '';
      found = true;
      if (readAttribute(tag, 'content') === value) return tag;
      const content = /(\scontent\s*=\s*)(["'])([\s\S]*?)\2/i;
      if (content.test(tag)) return tag.replace(content, (_, prefix, quote) => prefix + quote + (quote === "'" ? escape(value).replaceAll("'", '&#39;') : escape(value)) + quote);
      return tag.replace(/(\/?>)$/, ` content="${escape(value)}"$1`);
    });
    if (!found) appendTag(`<meta ${attribute}="${key}" content="${escape(value)}">`);
  }
  let foundTitle = false;
  head = head.replace(/(<title\b[^>]*>)[\s\S]*?(<\/title>)/gi, (_, open, close) => {
    if (foundTitle) return '';
    foundTitle = true;
    return open + escape(title) + close;
  });
  if (!foundTitle) appendTag(`<title>${escape(title)}</title>`);
  if (!canonicalTag) appendTag(`<link rel="canonical" href="${escape(canonical)}">`);
  meta('name', 'robots', get('name', 'robots') || 'index, follow');
  meta('name', 'description', description);
  meta('name', 'keywords', keywords);
  meta('property', 'og:type', 'website');
  meta('property', 'og:site_name', 'whatwhatboy');
  meta('property', 'og:locale', 'en_US');
  meta('property', 'og:url', canonical);
  meta('property', 'og:title', title);
  meta('property', 'og:description', description);
  meta('property', 'og:image', image);
  if (imageInfo) {
    meta('property', 'og:image:secure_url', image);
    meta('property', 'og:image:type', imageInfo.type);
    meta('property', 'og:image:width', String(imageInfo.width));
    meta('property', 'og:image:height', String(imageInfo.height));
  }
  meta('property', 'og:image:alt', imageAlt);
  meta('name', 'twitter:card', image.includes('/logo.png') ? 'summary' : 'summary_large_image');
  meta('name', 'twitter:title', title);
  meta('name', 'twitter:description', description);
  meta('name', 'twitter:image', image);
  meta('name', 'twitter:image:alt', imageAlt);
  const schema = !noindex && !redirect ? pageSchema({canonical, title, description, keywords, image, imageInfo, metadata: editorial}) : null;
  const schemaTag = schema ? `<script id="site-page-schema" type="application/ld+json">${JSON.stringify(schema).replace(/</g, '\\u003c')}</script>` : '';
  let foundSchema = false;
  head = head.replace(/(<script\b(?:"[^"]*"|'[^']*'|[^'">])*>)[\s\S]*?<\/script>/gi, (block, opening) => {
    if (readAttribute(opening, 'id') !== 'site-page-schema') return block;
    if (foundSchema || !schemaTag) return '';
    foundSchema = true;
    return schemaTag;
  });
  if (schemaTag && !foundSchema) appendTag(schemaTag);
  const after = before.replace(/(<head\b[^>]*>)[\s\S]*?(<\/head>)/i, (_, open, close) => open + head + close);
  assert.equal(before.split(/<body\b/i)[1], after.split(/<body\b/i)[1], `${relative}: body modified`);
  assert.equal(/noindex/i.test(before.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)[1]), /noindex/i.test(head), `${relative}: indexing changed`);
  return {html: after, metadata: {page: relative, title, description, keywords, canonical, noindex, redirect, image, structuredData: !noindex && !redirect ? editorial?.type || 'WebPage' : null}, skipped: false};
}
module.exports = {transform, protectedFile, normalizedFile, getModMetadata};
