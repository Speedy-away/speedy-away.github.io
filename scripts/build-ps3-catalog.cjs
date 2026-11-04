const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const {MAX_MIRROR_BYTES, publicMirror} = require('./download-mirror-policy.cjs');
const {section, grid, resource, note, ext, esc, steps} = require('./build-console-guides.cjs');
const {page, fullLink} = require('./ps3-page.cjs');
const read = (file, fallback) => fs.existsSync(path.join(root, file)) ? JSON.parse(fs.readFileSync(path.join(root, file), 'utf8').replace(/^\uFEFF/, '')) : fallback;
const h = value => esc(String(value ?? '')).replaceAll('>','&gt;');
const guideRenderer=require('./console-resource-renderer.cjs').createResourceRenderer({root});
const menuMedia=require('./console-menu-media.cjs').createMenuMedia({root});
const multiGame=require('./ps3-multicod-metadata.cjs');
const downloadContext=require('./ps3-download-context.cjs');
const matchesGame=(item,id)=>item.gameId===id || (item.gameIds || []).includes(id) || (item.indexIds || []).includes(id);
const games = require('./console-mod-navigation.cjs').applyGameImages(multiGame.mergeGameDefinitions([
  {id:'gta-v', title:'Grand Theft Auto V', short:'GTA V', url:'/console/ps3/mods/gta-v/', image:'/assets/images/gta52.png', summary:'Title update 1.27 loaders and SPRX menus, with HEN, DEX and region notes.', aliases:['GTA 5','GTA V','Grand Theft Auto 5','1.27']},
  {id:'gta-iv', title:'Grand Theft Auto IV', short:'GTA IV', url:'/console/ps3/mods/gta-iv/', image:'/assets/images/gta4.png', summary:'GTA IV script loaders and menu archives. Match the base game or Episodes release.', aliases:['GTA 4','GTA IV','EFLC','Episodes from Liberty City']},
  {id:'black-ops-1', parent:'call-of-duty', title:'Call of Duty: Black Ops', short:'Black Ops 1', url:'/console/ps3/mods/call-of-duty/black-ops-1/', image:'/assets/images/covers/cod-black-ops-1.jpg', aliases:['BO1','Black Ops I','Black Ops 1']},
  {id:'black-ops-2', parent:'call-of-duty', title:'Call of Duty: Black Ops II', short:'Black Ops 2', url:'/console/ps3/mods/call-of-duty/black-ops-2/', image:'/assets/images/covers/cod-black-ops-2.jpg', aliases:['BO2','Black Ops II','Black Ops 2','GSC']},
  {id:'uncharted', title:'Uncharted series', short:'Uncharted', url:'/console/ps3/mods/uncharted/', image:'/assets/images/ps3-mods/uncharted-dev-installer.jpg', summary:'Developer-menu resources for the PS3 trilogy, with title and executable requirements.', aliases:['Uncharted 1','Uncharted 2','Uncharted 3','Drakes Fortune','Among Thieves','Drakes Deception','debug menu','developer menu']},
  {id:'uncharted-1',parent:'uncharted',title:'Uncharted: Drake’s Fortune',short:'Uncharted 1',url:'/console/ps3/mods/uncharted/drakes-fortune/',image:'/assets/images/ps3-mods/uncharted-dev-installer.jpg',aliases:['Uncharted 1','Drakes Fortune','BCES00065','developer menu']},
  {id:'uncharted-2',parent:'uncharted',title:'Uncharted 2: Among Thieves',short:'Uncharted 2',url:'/console/ps3/mods/uncharted/among-thieves/',image:'/assets/images/ps3-mods/uncharted-dev-installer.jpg',aliases:['Uncharted 2','Among Thieves','BCES00757','developer menu']},
  {id:'uncharted-3',parent:'uncharted',title:'Uncharted 3: Drake’s Deception',short:'Uncharted 3',url:'/console/ps3/mods/uncharted/drakes-deception/',image:'/assets/images/ps3-mods/uncharted-dev-installer.jpg',aliases:['Uncharted 3','Drakes Deception','BCES01175','developer menu']},
  ...read('docs/ps3-mod-resources.json',{games:[]}).games || [],
  ...(read('docs/discord-ps3-resources.json',{games:[]}).games || []).filter(game=>!(read('docs/ps3-mod-resources.json',{games:[]}).games || []).some(existing=>existing.id===game.id))
]));
if(new Set(games.map(game=>game.id)).size!==games.length)throw Error('Duplicate PS3 game definition');
const labels = {sprx:'SPRX menus', loader:'Mod loaders', script:'Scripts', eboot:'EBOOT variants',texture:'Texture tools',rtm:'Windows RTM helpers', reference:'Compatibility references','dlc-reference':'DLC references', 'developer-menu':'Developer menus', app:'PS3 homebrew', tool:'PS3 tools'};
function data() {
  const base=read('docs/ps3-mod-resources.json',{resources:[]});
  const extra=read('docs/discord-ps3-resources.json',{resources:[]});
  const resources=[...base.resources,...extra.resources].map(multiGame.enhanceResource);
  if(new Set(resources.map(item=>item.id)).size!==resources.length)throw Error('Duplicate PS3 resource ID');
  return {...base,resources};
}
let inventorySnapshot;
function inventory() { return inventorySnapshot ||= [...(read('docs/ps3-expansion-download-inventory.json', {items:[]}).items || []),...(read('docs/download-audit.json',{items:[]}).items || []).filter(item=>item.id.startsWith('ps3-'))]; }
function localFile(file) {
  const local = file.local;
  if (typeof local !== 'string' || !local.startsWith('/downloads/') || /[?#\\]/.test(local)) return false;
  let decoded;
  try { decoded = decodeURIComponent(local); } catch { return false; }
  const target = path.resolve(root, '.' + decoded), base = path.join(root, 'downloads') + path.sep;
  const stored = publicMirror(local, root);
  return target.startsWith(base) && !!stored && stored.bytes === file.bytes && /^[a-f0-9]{64}$/i.test(file.sha256 || '');
}
function archivedFor(item) {
  const urls = new Set([item.source, ...(item.downloads || []).map(d => d.url)]);
  const files = inventory().filter(entry => entry.resourceId === item.id || entry.id === item.id || urls.has(entry.url) || urls.has(entry.sourceUrl))
    .flatMap(entry => (entry.files || []).filter(localFile).map(file => ({...file, owner:entry})));
  // Multiple preserved archive roles can refer to the same site mirror.
  // Keep all archive records while showing each download URL once.
  return [...new Map(files.map(file=>[file.local,file])).values()];
}
const filename = file => file.name || file.filename;
const bytes = value => value < 1048576 ? (value / 1024).toFixed(1) + ' KiB' : (value / 1048576).toFixed(1) + ' MiB';
function discordPost(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && url.hostname === 'discord.com' && url.pathname.startsWith('/channels/'); } catch { return false; }
}
function expiresOnDiscord(download, item) {
  try { return new URL(download.url).hostname === 'cdn.discordapp.com' && discordPost(item.source); } catch { return false; }
}
function tags(item) { const update=String(item.gameUpdate||'').match(/\b\d+\.\d+\b/)?.[0];return [...new Set(['PS3', labels[item.category] || item.category, ...(item.tags || []), update && 'Game ' + update].filter(Boolean))]; }
function terms(item) {
  const matching = games.filter(game => matchesGame(item,game.id));
  return [item.name, item.description, item.version, item.compatibility, item.region, item.gameUpdate, ...matching.flatMap(game=>[game.title,...game.aliases]), ...tags(item), ...(item.keywords || []),...(item.guideBlocks || []).flatMap(block=>[block.title,block.text,...(block.items || []).map(step=>typeof step==='string'?step:step.title+' '+step.text)])].filter(Boolean).join(' ').toLowerCase();
}
function card(item) {
  const stored = archivedFor(item);
  const attempts = inventory().filter(entry=>entry.resourceId===item.id || (item.downloads||[]).some(download=>download.url===entry.url));
  const incomplete=item.readiness==='incomplete'||attempts.length>0&&attempts.every(entry=>entry.readiness==='incomplete');
  const supportedGames=games.filter(game=>game.parent==='call-of-duty' && matchesGame(item,game.id));
  const gameLinks=supportedGames.length>1?`<div class="ps3-supported-games"><h4>Supported games listed in the source</h4><div class="guide-links">${supportedGames.map(game=>fullLink(game.url+'#'+item.id,game.short)).join('')}</div><p>Match the resource's build, title ID and game update requirements for each game.</p></div>`:'';
  const variantMarkup=file=>{const variant=multiGame.variantForFile(item,file);return variant?`<h5>${h(variant.label)}</h5>`:'';};
  const region=String(item.region||'').trim();
  const hasRegion=region&&!/^(?:match your title id|not specified|not stated|unspecified)/i.test(region);
  const guideId='guide-'+item.id;
  const guide=`<div class="guide-links"><a href="#${h(guideId)}" data-guide-open>Guide &amp; requirements</a></div><section class="ps3-resource-guide" id="${h(guideId)}" data-guide-panel data-guide-title="${h(item.name+' · Guide & requirements')}"><p>${h(item.description)}</p><dl class="ps3-meta"><dt>Game update</dt><dd>${h(item.gameUpdate||'Not specified')}</dd><dt>Build / firmware</dt><dd>${h(item.compatibility||'Not specified by source')}</dd>${hasRegion?`<dt>Region / title</dt><dd>${h(region)}</dd>`:''}</dl>${item.note?`<p>${h(item.note)}</p>`:''}${gameLinks}${menuMedia.details(item)}${(item.guideBlocks||[]).map(guideRenderer.guideBlock).join('')}</section>`;
  const ownImage = item.image && fs.existsSync(path.join(root, item.image.slice(1))) ? item.image : '';
  const game=games.find(game=>game.id===item.gameId);
  const fallback=item.gameId==='world-at-war'?'/assets/images/ps3-mods/waw-official-cover.jpg':game?.image||'/assets/images/consoles/ps3.png';
  const image=ownImage||(fs.existsSync(path.join(root,fallback.slice(1)))?fallback:'/assets/images/consoles/ps3.png');
  const media=menuMedia.figure(item,image,game?.title||'PS3');
  const fileTags = file => {
    const context=downloadContext.context(item,file);
    const archive=/\.(?:zip|rar|7z)$/i.test(filename(file));
    const includedTypes=archive&&!context.types.length&&file.owner?[...new Set(stored.filter(member=>member.memberPath&&member.owner?.id===file.owner.id).flatMap(member=>downloadContext.context(item,member).types))]:[];
    const labels=[...(archive?['Full package']:[]),...context.types,...includedTypes,...context.regions];
    if(!archive&&!context.types.length)labels.unshift('Type not specified');
    if(!archive&&!context.regions.length)labels.push('Region not specified');
    if(!labels.length)labels.push('Full package');
    return `<span class="menu-file-tags" aria-label="File variant">${labels.map(label=>`<span class="menu-file-tag">${h(label)}</span>`).join('')}</span>`;
  };
  const fileMarkup = file => `<div class="menu-download">${variantMarkup(file)}<a href="${h(file.local)}" download data-sha256="${h(file.sha256)}" data-i18n-skip translate="no">${h(filename(file))}</a> ${fileTags(file)} <small>${bytes(file.bytes)}</small></div>`;
  const originalFiles = stored.filter(file=>!file.memberPath),extracted = stored.filter(file=>file.memberPath);
  const rank=file=>/\.pkg$/i.test(filename(file))?0:/\.(?:sprx|prx)$/i.test(filename(file))?1:/\.(?:rpf|edat)$/i.test(filename(file))?2:3;
  const eligible=incomplete?[]:extracted.filter(file=>file.owner.readiness!=='incomplete'&&file.readiness!=='invalid-console-header'&&(file.archiveRole||file.owner.archiveRole)?.[0]==='Builds'&&/\.(?:pkg|sprx|prx|rpf|edat|bin|sco|gsc|gscc|csc|ff)$/i.test(filename(file))).sort((a,b)=>rank(a)-rank(b));
  const ready=downloadContext.select(item,eligible).current;
  const archives=downloadContext.select(item,originalFiles);
  const shown=new Set([...ready,...archives.current].map(file=>file.local));
  let remaining=extracted.filter(file=>!shown.has(file.local));
  const variants=new Map();
  for(const file of ready){const c=downloadContext.context(item,file);if(!variants.has(c.key))variants.set(c.key,{...c,files:[]});variants.get(c.key).files.push(file);}
  const chooser=variants.size>1||ready.length>3;
  const downloadsId='downloads-'+item.id;
  const groupedSupport=new Set();
  const choices=[...variants.values()].sort((a,b)=>a.label.localeCompare(b.label)).map(group=>{
    const owners=new Set(group.files.map(file=>file.owner.id));
    const support=remaining.filter(file=>owners.has(file.owner.id)&&downloadContext.context(item,file).key===group.key&&!eligible.includes(file));
    if(chooser)for(const file of support)groupedSupport.add(file.local);
    return `<details class="menu-variant-group"><summary>${h(group.label)} <small>${group.files.length} file${group.files.length===1?'':'s'}</small></summary>${group.files.map(fileMarkup).join('')}${support.length?`<details><summary>Supporting files (${support.length})</summary>${support.map(fileMarkup).join('')}</details>`:''}</details>`;
  }).join('');
  if(chooser)remaining=remaining.filter(file=>!groupedSupport.has(file.local));
  const readyFiles=chooser?`<div class="guide-links"><a href="#${h(downloadsId)}" data-guide-open>Choose console type &amp; download</a></div><section id="${h(downloadsId)}" data-guide-panel data-guide-title="${h(item.name+' · Downloads'+(item.version?' · '+item.version:''))}"><p>Choose your PS3 type and game region. Files in the same group belong together. Labels come from the preserved archive; they do not establish support for other firmware or title IDs.</p>${choices}</section>`:ready.map(fileMarkup).join('');
  const extra=[...archives.preserved,...remaining];
  const files = `<div class="menu-downloads">${readyFiles}${archives.current.map(fileMarkup).join('')}${extra.length?`<details><summary>Supporting files &amp; preserved copies (${extra.length})</summary>${extra.map(fileMarkup).join('')}</details>`:''}</div>`;
  // Preserve attachment URLs in the inventory. Discord renews signatures from
  // the source post; the bare CDN URL expires. Hosted files remain above.
  const originals = (item.downloads || []).filter(download => /^https?:\/\//.test(download.url) && !expiresOnDiscord(download,item) && attempts.some(entry=>entry.url===download.url)).map(download => ext(download.url, h(multiGame.downloadLabel(item,download)))).join('');
  const references=(item.references || []).filter(reference=>{try{const url=new URL(reference.url);return url.protocol==='https:'&&!url.username&&!url.password;}catch{return false;}}).map(reference=>ext(reference.url,h(reference.label || 'Source reference'))).join('');
  const backupOnly = attempts.flatMap(entry=>(entry.files||[]).filter(file=>!localFile(file) && file.backupPath && fs.existsSync(file.backupPath) && fs.statSync(file.backupPath).size===file.bytes));
  const largeSource = attempts.some(entry=>(entry.files||[]).some(file=>file.bytes>=MAX_MIRROR_BYTES)) && item.source
    ? `<div class="guide-links">${ext(item.source, discordPost(item.source) ? 'Original large download via Discord (sign-in may be needed)' : 'Original large download & requirements')}</div>` : '';
  const siteBuilds = stored.filter(file=>file.owner.readiness!=='incomplete'&&file.readiness!=='invalid-console-header'&&!/(?:Metadata|Source Code)/.test(JSON.stringify(file.archiveRole || [])));
  const skippedForSize = attempts.some(entry=>/size.bound|size limit|size-bound|import bound/i.test(entry.status+' '+entry.error));
  const availability = incomplete?'Incomplete source distribution · archived for reference':siteBuilds.length ? siteBuilds.length + ' file download' + (siteBuilds.length === 1 ? '' : 's') + (backupOnly.length ? ' · larger build saved in local archive' : '') : backupOnly.length ? 'Build saved in local archive · external source download' : skippedForSize ? 'Source reachable · not archived (exceeds selected size limit)' : attempts.length ? 'Unavailable locally · source retrieval failed' : item.status==='source-marks-down' ? 'Unavailable · source marks this link down' : item.category.includes('reference') ? 'Compatibility reference · no package download' : 'Source reference · no local build archived';
  const lanAccess=!incomplete&&backupOnly.some(file=>(file.archiveRole||[])?.[0]==='Builds')?`<div class="guide-links">${fullLink('/console/ps3/archive-server.html?resource='+encodeURIComponent(item.id),'Download files from local archive')}</div>`:'';
  const backupRecords = backupOnly.length ? `<details class="menu-card-links"><summary>Local backup downloads (${backupOnly.length})</summary>${backupOnly.map(file=>`<div class="menu-download" data-sha256="${h(file.sha256)}">${variantMarkup(file)}<p data-i18n-skip translate="no">${h(filename(file))} ${fileTags(file)} · ${bytes(file.bytes)}</p></div>`).join('')}</details>` : '';
  const visibleTags=[...new Set(tags(item).filter(tag=>/HEN|DEX|CEX|GOTY|incomplete|mismatch/i.test(tag)))];
  const update=String(item.gameUpdate||'Not specified');
  return `<article class="guide-resource menu-card" id="${h(item.id)}" data-ps3-entry data-game="${h(item.gameId)}" data-games="${h([...new Set([item.gameId,...(item.gameIds || []),...(item.indexIds || [])])].join(' '))}" data-type="${h(item.category)}" data-search="${h(terms(item))}">${media}<h3>${h(item.name)}</h3><p class="menu-description">${h(item.description)}</p><ul class="guide-resource-tags" aria-label="Resource tags">${visibleTags.map(tag => `<li class="feature-tag">${h(tag)}</li>`).join('')}</ul><dl class="menu-card-meta">${item.version?`<dt>Menu</dt><dd>${h(item.version)}</dd>`:''}<dt>Game update</dt><dd>${h(update.length>85?'See per-game guide':update)}</dd></dl>${incomplete?'<p class="menu-card-note">Source limitations · read guide</p>':''}${guide}${lanAccess}${largeSource}${files}${backupRecords}<details class="menu-card-links"><summary>Sources</summary><div class="guide-links">${originals}${references}${item.source ? ext(item.source, discordPost(item.source) ? 'Original Discord post (sign-in may be needed)' : 'Source & requirements') : ''}</div></details></article>`;
}
function filters(items, allGames = false) {
  const types = [...new Set(items.map(item => item.category))];
  return `<div class="ps3-filter"><div><label for="ps3Search">Search menus, builds or compatibility</label><input id="ps3Search" type="search" placeholder="Try HEN, DEX, SPRX or a menu name"></div>${allGames ? `<div><label for="ps3Game">Game or collection</label><select id="ps3Game"><option value="">All PS3 resources</option><optgroup label="Games">${games.filter(game=>game.kind!=='collection').map(game => `<option value="${game.id}">${h(game.short)}</option>`).join('')}</optgroup><optgroup label="Collections">${games.filter(game=>game.kind==='collection').map(game => `<option value="${game.id}">${h(game.short)}</option>`).join('')}</optgroup></select></div>` : ''}<div><label for="ps3Type">Resource type</label><select id="ps3Type"><option value="">All types</option>${types.map(type => `<option value="${h(type)}">${h(labels[type] || type)}</option>`).join('')}</select></div></div><p id="ps3Count" role="status">${items.length} resources</p><p id="ps3Empty" hidden>No matching resources. Clear the search or choose another type.</p>`;
}
function gameCard(game) {
  const count = data().resources.filter(item => matchesGame(item,game.id)).length;
  return resource(h(game.title), h(game.summary || `${count} PS3 menu, tool and compatibility resources.`), fullLink(game.url, 'Browse ' + game.short), game.image).replace('class="guide-resource"', 'class="guide-resource ps3-game-card"');
}
function chooser() {
  const cod = resource('Call of Duty', h(games.filter(game=>game.parent==='call-of-duty').map(game=>game.short).join(', ')+': console menus, game files and separately labelled RTM helpers.'), fullLink('/console/ps3/mods/call-of-duty/', 'Choose a Call of Duty game'), '/assets/images/covers/cod-black-ops-2.jpg').replace('class="guide-resource"', 'class="guide-resource ps3-game-card"');
  const main=games.filter(game=>!game.parent&&game.kind!=='collection'), first=main.find(game=>game.id==='gta-v'), third=main.find(game=>game.id==='gta-iv');
  return section('games', 'Choose your PS3 game', grid(...[first&&gameCard(first),cod,third&&gameCard(third),...main.filter(game=>!['gta-v','gta-iv'].includes(game.id)).map(gameCard)].filter(Boolean)).replace('class="games-grid"','class="games-grid ps3-game-grid"'), 'Game catalogues open as full pages. Start with the title update and build listed for each resource.') + section('directory', 'Find a specific menu', `<div class="guide-links">${fullLink('/console/ps3/mods/menus.html','Search all PS3 menus')}${games.filter(game=>game.kind==='collection').map(game=>fullLink(game.url,game.title)).join('')}${fullLink('/console/ps3/browser-downloads.html','Open PS3 console file list')}${fullLink('/console/ps3/desktop-tools.html','Windows RTM helpers')}</div>`);
}
function compatibility() {
  return section('compatibility', 'Match the build before copying files', note('<p><strong>Game update, title ID and firmware type are separate requirements.</strong> A HEN-labelled archive does not establish support for every HFW version. DEX-only SPRX files require the stated DEX environment; do not treat CEX, DEX and HEN as interchangeable.</p><p>Keep a backup of the original game files. Use each archive’s readme for the exact file destinations and loader. Downloading an SPRX does not load it; downloading a PKG does not install it. Windows RTM tools run on a computer and need the documented console-side connection method.</p>'));
}
function transferWorkflow() {
  return section('browser-files', 'Download, extract, install, run', steps([
    ['Download', 'Use the PS3-only file list below, or download to a computer and transfer by USB/FTP. The lightweight list keeps APK, Vita, PS4/PS5 and desktop helpers out of the console catalogue.'],
    ['Extract archives', 'ZIP, RAR and 7z are containers. Preserve the original archive, then extract the documented PS3 build using a computer or a compatible PS3 file manager such as ezRemote. Inspect the readme and choose the matching region/build.'],
    ['Install a PS3 PKG', 'On a compatible HEN/CFW setup, use Package Manager after the file is available in a supported location. A download or FTP transfer alone does not install the package. PS4/PS5 FPKG packages are not PS3 packages.'],
    ['Copy and load game mods', 'SPRX, script and EBOOT files have game-specific destinations and loaders. Follow the resource’s readme; do not put every SPRX into a generic boot plugin list. Enable the required homebrew environment before running it.']
  ]) + `<div class="guide-links">${fullLink('/console/ps3/browser-downloads.html','Open console file list')}${fullLink('/console/ps3/archive-server.html','Large files from your local archive')}${fullLink('/console/ps3/mods.html','Browse PS3 games')}${ext('https://github.com/aldostools/webMAN-MOD/wiki/Web-Commands','webMAN web-command documentation')}${ext('https://github.com/cy33hc/ps3-ezremote-client','ezRemote file and archive documentation')}</div>` + note('<p><strong>Browser access:</strong> webMAN MOD provides a file browser and download commands on a configured PS3. Open <code>http://127.0.0.1/</code> on the PS3 itself; from a computer or phone use the PS3’s LAN IP. Modern HTTPS, file-host sign-in and ad-heavy download pages can fail in the PS3 browser. A plain HTTP server on your own LAN plus a direct file URL is a practical transfer route; the preview’s 127.0.0.1 address refers to the device opening it.</p>'));
}
function buildArchiveServer(nav) {
  const content=section('setup','Open your PS3 archive over HTTP',note('<p>The local archive server runs on the computer holding your backup. It offers PS3 console files and original archives through plain HTTP, including large PKGs that are not mirrored on the website. Windows RTM helpers, source code and other consoles stay outside this list.</p>')+steps([
    ['Start on the archive computer','Open a terminal in the site checkout and run the command below. Replace the example address with that computer’s private LAN IPv4 address. Keep this terminal running while files transfer.'],
    ['Open from the PS3','In the PS3 browser, visit the printed HTTP address on port 8766. The console and computer must be on the same LAN. Choose a PS3 package, game file or original archive from the separate lists.'],
    ['Download with your chosen tool','Use an ordinary file link, browse the HTTP list in ezRemote, or select Save with webMAN when webMAN MOD is already active on the PS3. The webMAN link downloads to /dev_hdd0/packages; it does not install or run the file.'],
    ['Finish on the console','Install an appropriate PS3 PKG through the supported Package Manager workflow. Extract original ZIP/RAR/7z files first. SPRX, EBOOT and script files still need their documented game update, build and destination.']
  ])+'<pre class="guide-code"><code>node scripts/serve-ps3-downloads.cjs --host=192.168.1.20 --port=8766</code></pre>'+note('<p><strong>Addresses refer to the device opening them.</strong> The default command, <code>node scripts/serve-ps3-downloads.cjs</code>, listens on <code>127.0.0.1:8766</code> for testing on the archive computer. For your console, use the computer’s private LAN address. The PS3 cannot browse a Windows F: path directly.</p><p>The server only reads allowlisted PS3 files. It supports byte-range downloads for compatible clients. It does not extract, install, run or upload files, and it does not change your firewall settings. Keep storage available for both the original download and any extracted or installed copy.</p>'));
  const access=section('open-archive','Open the running archive server','<form id="ps3ArchiveAccess" class="guide-note"><label for="ps3ArchiveHost">Archive computer’s private LAN IPv4 address</label><div class="ps3-filter"><input id="ps3ArchiveHost" type="text" value="127.0.0.1" aria-describedby="ps3ArchiveStatus"><button type="submit" class="btn btn-outline">Prepare link</button></div><p id="ps3ArchiveStatus" role="status">The default address opens the archive on this computer. Enter its LAN IP when opening this page on the PS3.</p><div class="guide-links"><a id="ps3ArchiveOpen" href="http://127.0.0.1:8766/" target="_blank" rel="noopener noreferrer">Open PS3 archive</a></div></form><script defer src="/assets/ps3-archive-access.js?v=1"></script>')+section('ezremote','Browse the archive with ezRemote','<p>In PS3 ezRemote, set the server URL to the address below, choose <strong>Apache</strong> as the HTTP server type, and use <code>/</code> as the remote directory. Browse the resource and build folders to reach the original filenames.</p><pre class="guide-code"><code>http://192.168.1.20:8766/ezremote/</code></pre><p>Replace the example computer address with your own. The server provides a separate Apache-format directory because the browser’s styled download page is not an ezRemote directory format. Downloading a remote PKG or creating its install bubble still requires completing the console’s documented package-installation workflow.</p>');
  page('console/ps3/archive-server.html','PS3 Archive Downloads','Download large PS3 packages and game files from your local backup through a browser, webMAN or ezRemote.','/assets/images/consoles/ps3.png',nav,content+access+section('related','Choose a PS3 resource',`<div class="guide-links">${fullLink('/console/ps3/browser-downloads.html','Website file list')}${fullLink('/console/ps3/mods/gta-iv/','GTA IV mods')}${fullLink('/console/ps3/transfer-tools.html','PS3 file managers')}${ext('https://github.com/aldostools/webMAN-MOD/wiki/Web-Commands','webMAN download commands')}${ext('https://github.com/cy33hc/ps3-ezremote-client','ezRemote HTTP and package workflow')}</div>`),'#setup','Set up LAN access',['PS3 PKG','PS3 LAN downloads','HTTP file server','GTA IV texture installer','SPRX','webMAN MOD','ezRemote','HEN','CFW']);
}
function extraApps({includeCustomization=true} = {}) {
  const apps = [...read('docs/ps3-apps-source-evidence.json',{apps:[]}).apps || [],...data().apps || []];
  const isCustomization=app=>app.category==='customization'||(app.tags||[]).includes('PS3 customization');
  const renderApp=app=>{
    const files = archivedFor(app);
    const packages=files.filter(file=>/\.pkg$/i.test(filename(file)));
    const backed=inventory().some(owner=>(owner.resourceId===app.id||owner.id===app.id||(app.downloads||[]).some(download=>download.url===owner.url))&&(owner.files||[]).some(file=>/\.pkg$/i.test(filename(file))&&file.backupPath&&fs.existsSync(file.backupPath)&&fs.statSync(file.backupPath).size===file.bytes));
    const links = packages.map(file=>`<a href="${h(file.local)}" download data-i18n-skip translate="no">${h(filename(file))} (${bytes(file.bytes)})</a>`).join('')+(!packages.length&&backed?fullLink('/console/ps3/archive-server.html?resource='+encodeURIComponent(app.id),'Download PKG from local archive'):'');
    return resource(h(app.title || app.name),h(app.description+' '+app.compatibility),links+ext(app.source,'Project & requirements'),app.image).replace('</h3>',`</h3><p data-i18n-skip translate="no">${h(app.version)} · PS3 PKG</p>${app.note?`<p>${h(app.note)}</p>`:''}`);
  };
  return section('file-archive-apps','File & archive packages',grid(...apps.filter(app=>!isCustomization(app)).map(renderApp)), 'Additional packages have their own requirements. Existing app and firmware versions remain separately pinned.')+(includeCustomization&&apps.some(isCustomization)?section('legacy-customization','Legacy XMB customization',grid(...apps.filter(isCustomization).map(renderApp)),'Keep the source firmware requirement. These packages do not establish support for the current firmware guide.'):'');
}
function build(nav, options = {}) {
  const items = data().resources;
  const selectedGames=options.onlyGame?[options.onlyGame]:options.onlyGames || null;
  if(selectedGames&&(!Array.isArray(selectedGames)||!selectedGames.length||selectedGames.some(id=>!games.some(game=>game.id===id)))) throw Error('Unknown PS3 game selection');
  const gameNav = [['/console/ps3/mods.html','PS3 games'],['/console/ps3/mods/menus.html','Menu directory'],['/console/ps3/downloads.html','PS3 downloads'],['/console/ps3/transfer-tools.html','Transfer tools']];
  for (const game of games.filter(game=>!selectedGames || selectedGames.includes(game.id))) {
    const entries = items.filter(item => matchesGame(item,game.id));
    const children = games.filter(item=>item.parent===game.id);
    const navigation=game.parent==='call-of-duty'?[['/console/ps3/mods/call-of-duty/','Call of Duty games'],...gameNav]:gameNav;
    page('console/ps3/mods/' + game.url.split('/mods/')[1] + 'index.html', game.short + ' · PS3 Mods', game.summary || 'PS3 mod menus, RTM tools and compatibility resources for ' + game.short + '.', game.image, navigation,
      (children.length?section('games','Choose an Uncharted game',grid(...children.map(gameCard)).replace('class="games-grid"','class="games-grid menu-game-grid"')):'') + section('resources', game.title + ' resources', filters(entries) + grid(...entries.map(card)).replace('class="games-grid"','class="games-grid menu-resource-grid"'), 'Compatibility labels are taken from the cited source. Unknown details stay labelled.') + compatibility() + '<script defer src="/assets/ps3-catalog.js?v=1"></script>', '#resources', 'Browse resources', [...game.aliases,'PS3','CFW','HEN','CEX','DEX',...entries.flatMap(item => [item.name,...tags(item)])]);
  }
  multiGame.writeAliasPages(selectedGames);
  if (!selectedGames || options.updateCategories) page('console/ps3/mods/call-of-duty/index.html','Call of Duty · PS3 Mods','Choose a PS3 Call of Duty title for its menus, console files, RTM helpers and compatibility references.','/assets/images/covers/cod-black-ops-2.jpg',gameNav,
    section('games','Choose a Call of Duty game',grid(...games.filter(game=>game.parent==='call-of-duty').map(gameCard)).replace('class="games-grid"','class="games-grid menu-game-grid"')) + section('collections','Multi-game collections',`<p>These packs contain resources for several source-listed games. Their entries also appear on each supported game's page.</p><div class="guide-links">${games.filter(game=>game.kind==='collection').map(game=>fullLink(game.url,game.title)).join('')}</div>`) + compatibility(),'#games','Choose a game',['BO1','BO2','BO3','Ghosts','Modern Warfare 3','Advanced Warfare','SPRX','RTM','GSC','Black Ops','DLC','PS3']);
  page('console/ps3/mods/menus.html','PS3 Menu Directory','Search PS3 game mods by menu name, title update, build type and resource format.','/assets/images/custom-mod-art/mods-ps3.jpg',gameNav,
    section('resources','Search PS3 mods',filters(items,true)+grid(...items.map(card)).replace('class="games-grid"','class="games-grid menu-resource-grid"')) + '<script defer src="/assets/ps3-catalog.js?v=1"></script>','#resources','Search menus',['GTA V 1.27','GTA IV','BO1','BO2','Uncharted','SPRX','HEN','CEX','DEX','RTM']);
  const helpers = items.filter(item => item.category === 'rtm');
  if (!selectedGames) page('console/ps3/desktop-tools.html','PS3 Desktop RTM Helpers','Windows-side RTM tools for the listed PS3 games. These helpers run on a computer.','/assets/images/consoles/ps3.png',nav,
    section('helpers','Windows helpers for PS3',note('<p>Extract these archives on Windows and follow the author’s requirements. CCAPI/TMAPI/PS3MAPI support depends on the specific tool and console build. A Windows executable cannot be installed with PS3 Package Manager.</p>')+grid(...helpers.map(card)).replace('class="games-grid"','class="games-grid menu-resource-grid"'))+compatibility(),'#helpers','Browse helpers',['PS3','Windows','RTM','CCAPI','TMAPI','PS3MAPI','BO1','BO2']);
  const metadata = {reviewed:'2026-11-02',platform:'PS3',games,resources:items.map(item => ({id:item.id,name:item.name,gameId:item.gameId,gameIds:item.gameIds || [],indexIds:item.indexIds || [],category:item.category,tags:tags(item),search:terms(item),url:games.find(game => game.id === item.gameId)?.url+'#'+item.id,gameUrls:games.filter(game=>game.parent==='call-of-duty' && matchesGame(item,game.id)).map(game=>game.url+'#'+item.id)}))};
  fs.mkdirSync(path.join(root,'docs/seo'),{recursive:true});
  fs.writeFileSync(path.join(root,'docs/seo/ps3-resources.json'),JSON.stringify(metadata,null,2)+'\n');
  console.log(`Built PS3 ${selectedGames?.join(', ') || 'game catalogues'} and directory: ${items.length} resources.`);
}
module.exports = {games,data,inventory,localFile,archivedFor,filename,bytes,card,chooser,compatibility,transferWorkflow,buildArchiveServer,extraApps,build};
if (require.main === module) build(require('./build-ps3-pages.cjs').ps3nav);
