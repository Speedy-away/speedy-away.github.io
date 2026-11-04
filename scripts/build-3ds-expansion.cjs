const fs=require('node:fs');
const path=require('node:path');
const {page,section,grid,resource,note,steps,ext,link,sourceList,esc}=require('./build-console-guides.cjs');
const root=path.resolve(__dirname,'..');
const read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const art=name=>`/assets/images/3ds-more/${name}.svg`;
const nav=[['/console/retro/','Retro consoles'],['/console/retro/3ds.html','2DS / 3DS'],['/console/retro/3ds-mods.html','Game mods'],['/console/retro/3ds-online.html','Online & Pretendo'],['/console/retro/3ds-themes.html','3DS themes & splashes'],['/console/retro/ds.html','DS / DSi']];
const size=bytes=>bytes>=1048576?`${(bytes/1048576).toFixed(2)} MiB`:`${(bytes/1024).toFixed(1)} KiB`;
function fileDetails(files){return files.length?`<details class="three-ds-files"><summary>Files, versions &amp; SHA-256</summary>${files.map(f=>`<dl><dt>${esc(f.name)}</dt><dd>${esc(f.version)} · ${f.bytes.toLocaleString('en-GB')} bytes · ${size(f.bytes)}</dd><dt>SHA-256</dt><dd><code>${f.sha256}</code></dd><dt>Original source</dt><dd>${ext(f.sourceUrl,'Publisher file')}</dd>${f.contents?`<dt>Bundle contents</dt><dd>${esc(f.contents.join(', '))}</dd>`:''}</dl>`).join('')}</details>`:'';}
function downloadLinks(files){return files.map(f=>`<a class="three-ds-download" href="${esc(f.local)}" data-original-href="${esc(f.sourceUrl)}" download>Download ${esc(f.label||f.name)} · ${size(f.bytes)} <i class="fas fa-download" aria-hidden="true"></i></a>`).join('');}
function toolbar(theme=false){return `<div data-three-ds-search="${theme?'themes':'apps'}"><div class="three-ds-toolbar"><label for="threeDsSearch">${theme?'Find a theme or author':'Find an app, game or emulator'}<input id="threeDsSearch" type="search" placeholder="${theme?'Search themes…':'Search name, format, hardware…'}" autocomplete="off"></label>${theme?'':`<label for="threeDsCategory">Category<select id="threeDsCategory"><option value="all">All resources</option><option value="core">Core setup</option><option value="apps">Apps &amp; utilities</option><option value="games">Native games &amp; ports</option><option value="emulators">Emulators &amp; GBA hardware</option></select></label>`}<button type="button">Clear filters</button></div><p class="three-ds-count" role="status" aria-live="polite"></p><p class="three-ds-empty" data-empty hidden>No resources match. Clear the filters to browse everything.</p></div>`;}
function grouped(id,title,body,subtitle=''){return section(id,title,body,subtitle).replace('<section class="section"','<section class="section three-ds-group" data-three-ds-group');}
function finish(file,keywords){
  const target=path.join(root,file);let html=fs.readFileSync(target,'utf8');
  html=html.replace('</head>','<link rel="stylesheet" href="/assets/3ds-more.css?v=1"><script defer src="/assets/3ds-more.js?v=1"></script></head>');
  html=html.replace(/<meta name="keywords" content="[^"]*">/,`<meta name="keywords" content="${esc(keywords.join(', '))}">`);
  const title=html.match(/<title>(.*?)<\/title>/)[1];
  const description=html.match(/name="description" content="([^"]*)"/)[1];
  const url=`https://whatwhatboy.com/${file}`;
  const schema={'@context':'https://schema.org','@type':'CollectionPage',url,name:title.replace(/&amp;/g,'&'),description:description.replace(/&amp;/g,'&'),isPartOf:{'@type':'WebSite',name:'whatwhatboy',url:'https://whatwhatboy.com/'}};
  html=html.replace('</head>',`<meta property="og:title" content="${title}"><meta property="og:description" content="${description}"><meta property="og:url" content="${url}"><meta property="og:type" content="website"><script type="application/ld+json">${JSON.stringify(schema).replaceAll('<','\\u003c')}</script></head>`);
  fs.writeFileSync(target,require('./search-page-output.cjs').finish(file,require('./apply-site-background.cjs').improve(html,file)));
}
function build3dsExpansion(){
  const apps=read('docs/3ds-more-app-research.json').apps;
  const themes=read('docs/themezer-3ds-catalog.json').themes;
  const downloadData=read('docs/3ds-more-downloads.json');
  const filesFor=id=>downloadData.entries.find(x=>x.id===id)?.files||[];
  const core=read('docs/expansion-nintendo-retro.json').apps.filter(x=>x.platform==='3ds');
  const jobs=read('docs/expansion-nintendo-retro-jobs.json').jobs;
  function card(app,isCore=false){
    const files=filesFor(app.id);
    const links=isCore?app.jobs.map((id,i)=>ext(jobs.find(j=>j.id===id).url,esc(app.labels[i]))).join(''):downloadLinks(files);
    const requirements=Array.isArray(app.requirements)?app.requirements.join(' '):app.requirements;
    let html=resource(esc(app.title),esc(app.description),links+ext(app.project,'Project &amp; requirements')+(app.guide?ext(app.guide,'Setup documentation'):''),app.image||art(app.group==='games'?'games':app.group==='emulators'?'emulators':'apps'));
    if(!isCore&&app.image)html=html.replace(' artwork" loading="lazy"',' screenshot published by Universal-DB" loading="lazy"');
    html=html.replace('<article ',`<article id="${esc(app.id)}" data-three-ds-card data-three-ds-category="${isCore?'core':app.group}" `);
    html=html.replace('</h3>',`</h3><div class="three-ds-tags">${[app.version,...(app.tags||[])].map(t=>`<span>${esc(t)}</span>`).join('')}</div>`);
    if(requirements)html=html.replace('<div class="guide-links">',`<p class="three-ds-need"><strong>Setup:</strong> ${esc(requirements)}</p><div class="guide-links">`);
    html=html.replace('</article>',fileDetails(files)+'</article>').replace('data-search="',`data-search="${esc([...(app.tags||[]),requirements||'',app.version].join(' ').toLowerCase())} `);
    return html;
  }
  page('console/retro/3ds.html','Nintendo 2DS & 3DS Homebrew, Games & Emulators',
    'Ready CIA, 3DSX and FIRM downloads for the 2DS / 3DS family, with CFW setup, native homebrew games, emulators and model-specific requirements.',art('hero'),nav,
    section('start','Start with your model and CFW',
      `<p class="three-ds-note">The maintained guide covers original 3DS / 3DS XL / 2DS and New 3DS / New 3DS XL / New 2DS XL. Select the <strong>exact model, region and installed firmware</strong> on the guide. An app download does not install CFW on a stock console.</p>`+steps([
      ['Check the existing setup','Power off, hold Select and power on. Compare the result with Checking for CFW before updating or replacing boot files.'],
      ['Complete the matching installation route','For a stock system, use Get Started and follow its current model and firmware selector to boot9strap and Luma3DS.'],
      ['Keep the system backups','Finish Finalizing Setup and keep NAND and essential-file backups on another device before installing more applications.']
      ])+`<div class="guide-links">${ext('https://3ds.hacks.guide/get-started.html','Start 2DS / 3DS CFW guide')}${ext('https://3ds.hacks.guide/checking-for-cfw.html','Check existing CFW')}${ext('https://3ds.hacks.guide/finalizing-setup.html','Finalizing setup')}</div><div class="three-ds-jumps">${[['#apps','Core tools'],['#more-apps','More apps'],['#games','Games & ports'],['#emulators','Emulators'],['#install','Storage & setup'],['/console/retro/3ds-themes.html','Themes & splashes']].map(([u,t])=>`<a href="${u}" data-three-ds-reveal>${t}</a>`).join('')}</div>`)+
    section('browse','Browse the 3DS collection',toolbar())+
    grouped('apps','Keep your core setup',grid(...core.map(a=>card(a,true))),'The six established resources and their pinned releases are preserved.')+
    grouped('more-apps','Apps &amp; utilities',grid(...apps.filter(a=>a.group==='apps').map(a=>card(a))))+
    grouped('games','Native homebrew games &amp; ports',note('<p>These run on the 3DS itself. A port may still need data copied from your own game installation; the download button supplies the homebrew engine or standalone game described on its card.</p>')+grid(...apps.filter(a=>a.group==='games').map(a=>card(a))))+
    grouped('emulators','Emulators &amp; native GBA mode',note('<p><strong>Original and New hardware have different performance limits.</strong> New 3DS means New 3DS, New 3DS XL or New 2DS XL. Keep games, BIOS files and saves in the locations required by each project. No commercial ROMs or BIOS files are included here.</p>')+grid(...apps.filter(a=>a.group==='emulators').map(a=>card(a))))+
    section('install','Choose CIA, 3DSX or FIRM',steps([
      ['Prepare storage','Use a genuine SD / microSD with FAT32 and an MBR partition table. The maintained guide recommends 2–128 GB; larger cards can introduce GBA graphics and custom-theme issues. Keep the entire existing Nintendo 3DS folder and your saves backed up.'],
      ['CIA apps: install to HOME Menu','Copy a CIA to a convenient SD folder such as /cias/, then use FBI on your prepared CFW system to install it. Read the app requirements first. Universal-Updater is another route for supported apps.'],
      ['3DSX apps: launch through Homebrew Launcher','Put the executable in /3ds/ or its documented app subfolder. Copy bundled data directories separately to their specified SD paths. A lone 3DSX is not a replacement for required game data.'],
      ['FIRM files: boot payloads','For tools that document it, put the FIRM under /luma/payloads/ and use the Luma chainloader at boot. Luma boot.firm itself belongs at the SD root; do not replace it with an app FIRM.'],
      ['DS mode: use the 3DS package','Follow TWiLight Menu++’s 3DS installation page. The DS flashcart and DSi packages use different instructions.'],
      ['Keep versions and dependencies together','Each new download has an expandable file record with its original URL, exact version, byte count and SHA-256. Preserve supplied folders and follow the linked readme for BIOS, ROM or game-data requirements.']
    ])+`<div class="guide-links">${ext('https://3ds.hacks.guide/key-information.html','SD-card and model requirements')}${ext('https://3ds.hacks.guide/godmode9-usage.html','GodMode9 usage guide')}${ext('https://wiki.ds-homebrew.com/twilightmenu/installing-3ds','TWiLight 3DS installation')}${ext('https://db.universal-team.net/3ds','More 3DS homebrew')}</div>`)+
    section('mods-online','Game mods and online services',grid(resource('Game mods & patch setup','CTGP-7, Ocarina of Time 3D Randomizer, Project Restoration and mod managers, with game-specific region and update requirements.',link('/console/retro/3ds-mods.html','Browse game mods'),art('games')),resource('Pretendo & online play','Set up the complete Nimbus package using Pretendo’s official 3DS guide. Learn about PNID accounts, NetPass, local play and CTGP-7’s own network.',link('/console/retro/3ds-online.html','Set up Pretendo &amp; online play'),art('apps'))))+
    section('themes','Make the HOME Menu yours',resource('3DS themes, music & boot splashes','A growing collection of curated themes from Themezer’s dedicated 3DS / 2DS library, with original bundles, author credits and previews. Learn the Anemone3DS paths and how to restore a basic HOME Menu theme.',link('/console/retro/3ds-themes.html','Browse 3DS themes &amp; setup'),art('themes')))+
    section('sources','Documentation &amp; verification',sourceList([
      ['https://3ds.hacks.guide/','3DS Hacks Guide · current model and firmware routes'],['https://github.com/LumaTeam/Luma3DS','Luma3DS · persistent-exploit requirements'],['https://github.com/Universal-Team/Universal-Updater','Universal-Updater · supported Unistores'],['https://github.com/BernardoGiordano/Checkpoint','Checkpoint · supported save environments'],['https://themezer.net/3ds','Themezer · dedicated 3DS / 2DS library']
    ])+note('<p>New files were checked as console formats or archive contents and archived with SHA-256 records. No downloaded executable was run and installation on physical 3DS hardware has not been tested. App screenshots are published by Universal-DB and belong to their creators; category illustrations are original SVG artwork. Theme previews remain credited to their Themezer authors.</p>')),'#browse','Browse 3DS resources');
  finish('console/retro/3ds.html',['Nintendo 3DS','Nintendo 2DS','New Nintendo 3DS','CFW','CIA','3DSX','FIRM','homebrew','emulators',...apps.flatMap(a=>[a.title,...a.tags])]);
  function themeCard(theme){
    const files=filesFor(theme.id);let html=resource(esc(theme.title),esc(theme.description||'Custom HOME Menu theme from Themezer’s 3DS / 2DS catalogue.'),downloadLinks(files)+ext(theme.sourceUrl,'Themezer page &amp; author'),theme.image);
    html=html.replace('<article ',`<article id="${esc(theme.id)}" data-three-ds-card data-three-ds-category="theme" `).replace('class="guide-resource"','class="guide-resource three-ds-theme"');
    html=html.replace('</h3>',`</h3><p class="three-ds-author">By ${esc(theme.author)}</p><div class="three-ds-tags"><span>3DS / 2DS</span><span>${esc(theme.version)}</span><span>${files.some(f=>f.contents?.some(n=>/bgm\.bcstm$/i.test(n)))?'BGM included':'No bundled BGM'}</span></div>`);
    html=html.replace('</article>',`<p class="three-ds-need">${esc(Array.isArray(theme.requirements)?theme.requirements.join(' '):theme.requirements)}</p>${fileDetails(files)}</article>`);
    return html.replace('data-search="',`data-search="${esc(theme.author.toLowerCase())} `);
  }
  const managers=apps.filter(a=>['anemone3ds','themezer-3ds'].includes(a.id));
  page('console/retro/3ds-themes.html','Nintendo 3DS & 2DS Themes, BGM & Splashes',
    'Curated Themezer 3DS / 2DS themes with author previews and ready ZIP downloads, plus Anemone3DS installation, music, splash and removal instructions.',art('themes'),nav,
    section('start','A theme for your HOME Menu',
      `<p class="three-ds-note">These downloads come from <strong>Themezer’s dedicated 3DS / 2DS section</strong>. Use a CFW-enabled 3DS-family system with a theme-capable HOME Menu. Both original and New-family hardware can use HOME Menu themes; a New-model-only emulator requirement does not apply to these theme bundles.</p><div class="three-ds-jumps"><a href="#catalogue">Browse themes</a><a href="#setup">Install with Anemone3DS</a><a href="#formats">Theme, BGM or splash?</a><a href="#remove">Change or remove</a></div><div class="guide-links">${ext('https://themezer.net/3ds/themes','Themezer 3DS themes')}${ext('https://themezer.net/3ds/splashes','Themezer 3DS splashes')}${ext('https://3ds.hacks.guide/get-started.html','Prepare CFW first')}</div>`)+
    section('catalogue','Curated Themezer 3DS / 2DS themes',toolbar(true)+grid(...themes.map(themeCard)),'Author credits and previews link back to the exact theme page. Each button downloads the original theme ZIP.')+
    section('formats','Theme, BGM or splash?',`<div class="three-ds-table-wrap"><table class="three-ds-table"><thead><tr><th>Item</th><th>What changes</th><th>Files and location</th></tr></thead><tbody><tr><td>HOME Menu theme</td><td>Menu backgrounds, colours, folders and optional sounds.</td><td><code>body_LZ.bin</code> inside the theme ZIP. Keep the ZIP in <code>/Themes/</code> for Anemone.</td></tr><tr><td>Background music</td><td>The HOME Menu music; it can be installed separately from the visual theme.</td><td>Optional <code>bgm.bcstm</code> in the bundle. A preview audio file is not automatically installable BGM.</td></tr><tr><td>Luma boot splash</td><td>The image shown during startup, before HOME Menu.</td><td><code>splash.bin</code> / <code>splashbottom.bin</code>. Keep the source ZIP in <code>/Splashes/</code>; Anemone installs the active files to <code>/luma/</code>.</td></tr></tbody></table></div>`+note('<p>Theme and splash files are separate formats. Use the corresponding 3DS section and Anemone mode. Switch NXTheme files do not install as 3DS HOME Menu themes.</p>'))+
    section('installer','Get a 3DS theme manager',grid(...managers.map(a=>card(a))))+
    section('setup','Install a theme with Anemone3DS',steps([
      ['Prepare HOME Menu theme data','On the console, open HOME Menu Settings → Change Theme and select a basic colour once, then return to HOME Menu. If Change Theme is absent, stop and check the console’s HOME Menu region and the guide’s theme support notes. Do not region-change just to apply a theme.'],
      ['Install the official manager','Use Anemone3DS CIA on CFW, or its 3DSX through Luma’s Rosalina Homebrew Launcher. Open it once so its theme and splash folders are created.'],
      ['Copy the original ZIPs','Power off before removing the SD. Put each downloaded theme ZIP directly in /Themes/. Keep its body_LZ.bin and any bgm.bcstm together inside the ZIP; do not rename them to Switch formats. Put only actual 3DS splash ZIPs in /Splashes/.'],
      ['Preview and apply','In Anemone’s theme mode, choose a theme and press Y to preview. Hold A, hold Up, then release A to install the full theme and its included music. Follow Anemone’s displayed exit instructions after installation.'],
      ['Choose visuals or music separately','Hold A + Right, then release A to install the visuals while preserving existing BGM. Hold A + Left, then release A to install only the chosen theme’s BGM. This does not mute music; use a music-free theme or HOME Menu’s basic theme for that.'],
      ['Optional: shuffle themes','Press B to queue between 2 and 10 themes. Hold A + Down and release A to install a shuffle set. The theme changes when HOME Menu closes and reopens.']
    ])+`<pre class="three-ds-layout">SD:/\n├─ Themes/\n│  ├─ theme-one.zip   (body_LZ.bin; optional bgm.bcstm)\n│  └─ theme-two.zip\n├─ Splashes/\n│  └─ boot-splash.zip (splash.bin / splashbottom.bin)\n├─ 3ds/\n│  └─ Anemone3DS.3dsx (if using Homebrew Launcher)\n└─ luma/              (active Luma splash files)</pre><div class="guide-links">${ext('https://github.com/astronautlevel2/Anemone3DS/wiki/Usage','Official Anemone controls')}${ext('https://github.com/astronautlevel2/Anemone3DS/wiki','Anemone documentation')}${ext('https://3ds.hacks.guide/key-information.html','Storage requirements')}</div>`)+
    section('splashes','Use a Luma boot splash',steps([
      ['Choose a 3DS splash','Open Themezer’s 3DS splash section and check the item’s preview, author and actual 3DS splash download. The bundled downloads above are HOME Menu themes.'],
      ['Install in splash mode','In Anemone, press L or the touchscreen S to switch to splashes, select a splash and press A. The installed splash lives in /luma/ on the SD card.'],
      ['Enable the Luma splash setting','Power off, hold Select at startup and set the documented Luma Splash option to Before or After rather than Off. Save configuration. Keep the SD inserted for an SD-based splash.']
    ])+sourceList([['https://github.com/LumaTeam/Luma3DS/wiki/Optional-features','Luma3DS optional features · splash configuration'],['https://themezer.net/3ds/splashes','Browse actual Themezer 3DS / 2DS splashes']]))+
    section('remove','Change, remove or troubleshoot',steps([
      ['Return to a basic theme','Open HOME Menu Settings → Change Theme and select a basic theme. Keep your downloaded ZIPs if you want to reinstall later; removing a file from the library does not restore the menu by itself.'],
      ['Turn off a boot splash','Set Luma’s Splash option to Off to stop displaying it while retaining the files. Anemone’s B action in splash mode deletes active splash files, so keep a source ZIP before using it.'],
      ['Check storage and region first','Use FAT32 storage and initialise the HOME Menu’s theme data. Match the currently installed HOME Menu region after any prior region change; CHN / KOR / TWN HOME Menus have theme-support limits. Use Anemone’s troubleshooting notes before changing extdata.'],
      ['Keep an original backup','Back up the SD card, themes and saves before repairing extdata. Check the exact failure message and current Anemone release. The bundled files were inspected; physical-console installation remains untested.']
    ])+sourceList([['https://github.com/astronautlevel2/Anemone3DS/wiki/Known-Bugs','Anemone known bugs and theme-data troubleshooting'],['https://3ds.hacks.guide/faq.html','3DS guide · SD upgrades and region questions']]))+
    section('sources','Theme sources, credits &amp; file verification',sourceList([['https://themezer.net/3ds','Themezer 3DS / 2DS hub'],['https://themezer.net/3ds/themes','Original 3DS theme catalogue'],['https://github.com/astronautlevel2/Anemone3DS','Official Anemone3DS source and releases']])+note('<p>Theme names, artwork and music belong to their credited creators. Previews are preserved from each exact Themezer entry. Original ZIP containers and their folder entries are retained alongside version, source, size and SHA-256 records. Theme installers and console binaries were never executed.</p>')),'#catalogue','Browse 3DS themes');
  finish('console/retro/3ds-themes.html',['3DS themes','2DS themes','Themezer','Anemone3DS','HOME Menu','body_LZ.bin','bgm.bcstm','Luma splash',...themes.map(t=>t.title)]);
  const extra=fs.existsSync(path.join(root,'docs/3ds-mods-online.json'))?require('./build-3ds-mods-online.cjs').build3dsModsOnline():{};
  return {pages:2+(extra.pages||0),coreApps:core.length,additionalApps:apps.length,themes:themes.length,mods:extra.mods||0,online:extra.online||0,files:downloadData.entries.reduce((n,e)=>n+e.files.length,0)};
}
if(require.main===module)console.log(build3dsExpansion());
module.exports={build3dsExpansion};
