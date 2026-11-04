// Scoped console landing-page organisation; preserves the shared shell and footer.
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
const groups=[
 ['playstation','PlayStation','Home consoles and handhelds, together in one place.',[
  ['PlayStation 5','/console/ps5/','ps5','Firmware guides, payloads, homebrew apps and native emulator ports.'],
  ['PlayStation 4','/console/ps4/','ps4','Firmware-specific setup, GoldHEN, apps and game modifications.'],
  ['PlayStation 3','/console/ps3/','ps3','PS3HEN and CFW guides, apps, save tools and P3T themes.'],
  ['PlayStation 2','/console/retro/ps2.html','PS2','FreeMcBoot, OpenTuna, Open PS2 Loader and PS2 utilities.'],
  ['PlayStation','/pc/emulators.html#emu-duckstation','PS1','Original PlayStation emulation on PC. This link opens the PC emulator collection.'],
  ['PlayStation Portable','/console/retro/psp.html','PSP','PSP setup, ARK-4, homebrew games, apps and themes.'],
  ['PlayStation Vita','/console/psvita/index.html','psvita','Vita setup, homebrew apps, Adrenaline, save tools and storage.']
 ]],
 ['xbox','Xbox','Original Xbox, Xbox 360, Xbox One and Xbox Series.',[
  ['Xbox One / Series X|S','/console/xbox-one-series.html','xbox-one-series','Developer Mode, Device Portal and compatible UWP apps.'],
  ['Xbox 360','/console/xbox360/','xbox360','Model-specific setup, dashboards, homebrew and file tools.'],
  ['Original Xbox',fs.existsSync(path.join(root,'console/retro/xbox.html'))?'/console/retro/xbox.html':'/pc/emulators.html#emu-xemu','XBOX',fs.existsSync(path.join(root,'console/retro/xbox.html'))?'Native XBE dashboards and game port downloads, plus emulator source projects.':'Original Xbox emulation on PC. This link opens the PC emulator collection.']
 ]],
 ['nintendo','Nintendo','Switch generations, earlier home consoles and portable systems.',[
  ['Nintendo Switch 2','/console/nintendo-switch-2.html','nintendo-switch-2','Setup, storage, system software and compatibility research.'],
  ['Nintendo Switch','/console/nintendo-switch.html','nintendo-switch','Atmosphère setup, homebrew, game mods and themes.'],
  ['Nintendo Wii U','/console/retro/wiiu.html','Wii U','Aroma setup, apps, plugins, save tools and homebrew games.'],
  ['Nintendo Wii','/console/retro/wii.html','Wii','Homebrew Channel, apps, disc tools and GameCube support.'],
  ['Nintendo GameCube','/console/retro/gamecube.html','GAMECUBE','Swiss, homebrew boot methods and memory-card tools.'],
  ['Nintendo DS & DSi','/console/retro/ds.html','DS / DSi','Flashcart and DSi setup, TWiLight Menu++ and homebrew.'],
  ['Nintendo 2DS & 3DS','/console/retro/3ds.html','2DS / 3DS','Model-specific setup, Luma3DS, apps and save backups.']
 ]],
 ['sega','Sega','Find the Sega coverage currently available on the site.',[
  ['Sega classics','/pc/emulators.html#emu-genesis-plus-gx','SEGA','Mega Drive / Genesis, Master System, Game Gear and Sega CD through PC emulation.']
 ]],
 ['other','Other platforms','Handheld PC gaming and its tools.',[
  ['Steam Deck','/console/steamdeck.html','steamdeck','Plugins, launchers, Proton tools, emulation and remote play.']
 ]],
 ['collections','Themes & shared resources','Collections covering more than one console family.',[
  ['Console game downloads','/console/game-downloads/','GAMES','Game directories grouped by console: Vimm’s Lair, DLPSGame, PSP / Vita and Nintendo sources.'],
  ['Console themes','/console/themes.html','THEMES','PS3, Switch, Wii U and 2DS / 3DS themes with previews and installation guides.'],
  ['Retro consoles','/console/retro/','RETRO','Browse the retro console directory for setup, apps and tools.','retro'],
  ['Console game mods','/console/mods/index.html','MODS','Game-specific console mod collections and installation guidance.','game-mods'],
  ['PS4 / PS5 game mods','/console/mods/ps4/','PS4 / PS5','The existing PS4 / PS5 game-mod collection, including GTA V resources.'],
  ['PC emulators','/pc/emulators.html','EMULATION','Console emulation on Windows, macOS and Linux, with platform requirements.','emulators']
 ]]
];
function card(row,family) {
 const [title,originalURL,art,description,id]=row;
 const url=require('./console-topic-navigation.cjs').resolveRoute(originalURL);
 const logo='/assets/images/platform-logos/'+art+'.svg';
 const isLogo=fs.existsSync(path.join(root,logo.slice(1)));
 const extra=title==='Nintendo Wii U'?"<nav class=\"guide-links\" aria-label=\"Wii U resources\"><a href=\"/console/retro/wiiu.html?view=all\">Downloads</a><a href=\"/console/retro/wiiu-themes.html\">Themes</a><a href=\"/console/wiiu/online.html\">Online</a><a href=\"/console/wiiu/mods.html\">Game mods</a><a href=\"/console/wiiu/vwii.html\">vWii</a></nav>":'';
 const media=isLogo?`<img src="${logo}" alt="${esc(title)}" width="480" height="220" loading="lazy">`:require('./console-rest-card-images.cjs').markup('console/index.html',title)||`<div class="console-wordmark" aria-hidden="true"><span>${esc(art)}</span><small>${esc(title)}</small></div>`;
 return `<article class="game-card"${id?` id="${id}"`:''} data-category="${family}" data-search="${esc([family,title,description].join(' ').toLowerCase())}"><div class="game-image">${media}</div><div class="game-info"><h3 class="game-title">${esc(title)}</h3><p class="game-description">${esc(description)}</p><a class="game-link" href="${url}">${url.startsWith('/pc/')?'View PC emulators':'Explore '+esc(title)} <i class="fas fa-arrow-right" aria-hidden="true"></i></a>${extra}</div></article>`;
}
function build() {
 const file=path.join(root,'console/index.html');let html=fs.readFileSync(file,'utf8');
 const total=groups.reduce((n,g)=>n+g[3].length,0);
 const intro=`<section class="section console-directory-intro" id="modern"><div class="container"><h2>Browse by console family</h2><p>Choose a family, then your console. Home consoles and handhelds stay together.</p><nav class="console-family-nav" aria-label="Console families">${groups.map(([id,title])=>`<a href="#${id}" data-search-reveal>${title}</a>`).join('')}</nav><div class="console-directory-search"><label for="gameSearch">Search consoles and resources</label><div class="search-box"><i class="fas fa-search search-icon" aria-hidden="true"></i><input class="search-input" type="search" id="gameSearch" placeholder="Try PlayStation, Wii, themes…"></div><button class="btn btn-outline" id="resetGameSearch" type="button">Clear search</button></div><p id="gameSearchStatus" data-result-noun="resource" role="status">${total} resources shown</p><div class="no-results" id="noResults" style="display:none"><p>No matching consoles or resources. Try a different name or clear the search.</p></div></div></section>`;
 const content=intro+groups.map(([id,title,description,rows])=>`<section class="section console-family" id="${id}" data-search-group><div class="container"><div class="section-header"><h2 class="section-title">${title}</h2><p class="section-subtitle">${description}</p></div><div class="games-grid">${rows.map(r=>card(r,id)).join('\n')}</div></div></section>`).join('\n');
 const block='<!-- CONSOLE DIRECTORY START -->'+content+'<!-- CONSOLE DIRECTORY END -->';
 if(html.includes('<!-- CONSOLE DIRECTORY START -->')) html=html.replace(/<!-- CONSOLE DIRECTORY START -->[\s\S]*?<!-- CONSOLE DIRECTORY END -->/,block);
 else {const start=html.indexOf('<!-- Modern Consoles Section -->'),end=html.indexOf('<!-- Safety Information -->');if(start<0||end<start)throw Error('Console content boundaries missing');html=html.slice(0,start)+block+'\n'+html.slice(end);}
 if(!html.includes('/assets/console-directory.css'))html=html.replace('</head>','<link rel="stylesheet" href="/assets/console-directory.css?v=1">\n</head>');
 html=html.replace('class="site-atmosphere"','class="site-atmosphere console-directory"');
 html=html.replace(/<div class="hero-image"[\s\S]*?<\/div>/,'').replace('Modern Consoles\n','Browse console families\n');
 // Hero statistics are removed only inside the hero, never across sections.
 const heroStart=html.indexOf('<section class="hero">'),heroEnd=html.indexOf('</section>',heroStart);
 let hero=html.slice(heroStart,heroEnd);
 const stats=hero.indexOf('<div class="hero-stats">');
 if(stats>=0) hero=hero.slice(0,stats)+'</div>\n';
 hero=hero.replace(/Modern Consoles/g,'Browse console families');
 html=html.slice(0,heroStart)+hero+html.slice(heroEnd);
 fs.writeFileSync(file,require('./search-page-output.cjs').finish('console/index.html',require('./console-topic-navigation.cjs').apply('console/index.html',html)));
 fs.writeFileSync(path.join(root,'docs/console-directory.json'),JSON.stringify({groups:groups.map(([id,title,description,rows])=>({id,title,description,entries:rows.map(([title,url,art,description])=>({title,url:require('./console-topic-navigation.cjs').resolveRoute(url),art,description}))})),artwork:'Existing platform SVGs retain their recorded provenance. Other panels use matching existing platform/category artwork from console-rest-card-images.cjs; unmatched panels retain typeset labels.',scope:'Organisation only. PC-only coverage is explicitly labelled; no new console builds or compatibility claims.'},null,2)+'\n');
 console.log('Built console directory: '+groups.length+' groups, '+total+' cards');
}
module.exports={build,groups};if(require.main===module)build();
