const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const catalogFile = path.join(root, 'docs/console-exploit-hosts.json');
const brand = "whatwhatboy's";
const image = platform => `/assets/images/host-selector/whatwhatboy-${platform}.jpg`;

function hostActions(platform) {
  const rows = [];
  const downloads = fs.existsSync(path.join(root,'docs/console-download-catalog.json')) ? JSON.parse(fs.readFileSync(path.join(root,'docs/console-download-catalog.json'),'utf8')).items : [];
  for (const name of [`host-actions-${platform}.json`, 'host-webkitty-loader-actions.json', 'host-modern-plugin-actions.json', 'host-current-cheat-actions.json', 'host-game-actions.json', 'host-legacy-menu-actions.json', 'host-extra-game-actions.json', 'host-native-payload-actions.json', 'host-web-utility-actions.json', 'host-repository-menu-actions.json', 'host-original-tool-actions.json', 'host-legacy-firmware-menu-actions.json', 'host-next-utility-actions.json', 'host-gta505-continuation-actions.json', 'host-arabicguy-672-actions.json']) {
    const filename = path.join(root, 'docs', name);
    if (!fs.existsSync(filename)) continue;
    const data = JSON.parse(fs.readFileSync(filename, 'utf8'));
    for (const action of data.actions || []) {
      if ((action.platform || data.platform) !== platform) continue;
      const normalized = {...action, platform};
      if (platform === 'ps4' && action.game === 'GTA V' && /^1\.\d+$/.test(action.gameVersion || '') && Number(action.gameVersion) < 1.56) normalized.legacy = true;
      if (!normalized.run && normalized.transport === 'goldhen-http') normalized.run = {type: 'goldhen-http'};
      if (!normalized.downloadURL && normalized.local) normalized.downloadURL = normalized.local;
      const consoleFile = downloads.find(file => file.platforms.includes(platform) && file.sha256 === action.sha256 && file.filename === path.basename(normalized.downloadURL || ''));
      if (consoleFile) normalized.consoleFileId = consoleFile.id;
      if (action.category !== 'mods' && /^(?:ELF|BIN)$/i.test(action.format || '') && normalized.downloadURL) {
        normalized.categories = [...new Set([action.category, ...(action.categories || []), 'payloads'])];
        if (!new RegExp('\\b'+platform+'\\b|^'+platform+'[A-Z0-9]','i').test(normalized.label)) normalized.label = platform.toUpperCase() + ' ' + normalized.label;
        if (consoleFile && !normalized.image) normalized.image = consoleFile.image;
      }
      if (!normalized.image && action.id === 'ps5-payload-manager') normalized.image = '/assets/images/expansion-ps4-ps5/payload-manager.png';
      if (!normalized.image && action.category === 'mods') {
        const artwork = action.game === 'GTA V' ? 'gta52.png' : /Miles Morales/.test(action.game || '') ? 'ps4-ps5/spider-man-miles-morales.jpg' : action.game === 'Sonic Frontiers' ? 'ps4-ps5/sonic-frontiers.jpg' : null;
        if (artwork) { normalized.image = '/assets/images/' + artwork; normalized.imageRole = 'Game artwork'; }
      }
      if (normalized.image && !fs.existsSync(path.join(root,normalized.image))) delete normalized.image;
      rows.push(normalized);
    }
  }
  if(platform==='ps4') {
    for(let i=rows.length-1;i>=0;i--)if(/^ps4-(?:original-)?goldhen-/.test(rows[i].id)&&String(rows[i].format).toUpperCase()==='BIN')rows.splice(i,1);
    const current=path.join(root,'docs/host-goldhen-current.json');
    if(fs.existsSync(current))rows.push(...JSON.parse(fs.readFileSync(current,'utf8')).actions);
    const retained=path.join(root,'docs/host-goldhen-retained-versions.json');
    if(fs.existsSync(retained))rows.push(...JSON.parse(fs.readFileSync(retained,'utf8')).actions);
  }
  const runtimeFile = path.join(root,'docs/host-runtime-builds.json');
  const runtimeDownloads = fs.existsSync(path.join(root,'docs/host-runtime-downloads.json')) ? JSON.parse(fs.readFileSync(path.join(root,'docs/host-runtime-downloads.json'),'utf8')).runtimes : [];
  if (fs.existsSync(runtimeFile)) for (const runtime of JSON.parse(fs.readFileSync(runtimeFile,'utf8')).runtimes || []) {
    if (runtime.console !== platform || !runtime.verified?.staticDependencies) continue;
    const correspondingSource = runtimeDownloads.find(item=>item.runtimeId===runtime.id)?.archives.find(item=>item.role==='Source Code');
    rows.unshift({id:'built-in-'+runtime.id,platform,label:runtime.title,category:'loaders',runtimeId:runtime.id,
      launchURL:runtime.entry,format:'Built-in browser loader',firmwares:runtime.firmwares,
      image:image(platform),imageRole:'Project preview',license:runtime.license,
      source:runtime.source.repository+'/tree/'+runtime.source.commit,
      instructionsURL:runtime.entry+'README.md',sourceArchiveURL:correspondingSource?.url || runtime.source.repository+'/tree/'+runtime.source.commit,
      requirements:[
        'Open on the matching console browser and choose Start on the built-in loader page. Nothing runs when viewing the dashboard.',
        'Native '+runtime.listener.format.toUpperCase()+' listener: '+runtime.listener.transport.toUpperCase()+' '+runtime.listener.port+'. Match this loader’s ABI; other payload transports are separate.',
        runtime.console === 'ps4' ? 'This PS4 bootstrap does not automatically load GoldHEN. Its raw BIN port 9020 is separate from GoldHEN HTTP port 9090 and ELF port 9021.' : 'The bundled PS5 ELF loader is limited to the listed versions below 5.00; the upstream source reports its loader broken on 5.xx.',
        'Static dependencies and file checksums verified. Console hardware execution has not been tested.'
      ]});
  }
  if(platform==='ps4'&&fs.existsSync(path.join(root,'docs/afterglow-build.json'))){
    const build=JSON.parse(fs.readFileSync(path.join(root,'docs/afterglow-build.json'),'utf8'));
    rows.unshift({id:'built-in-ps4-afterglow',runtimeId:'ps4-afterglow',platform:'ps4',label:'Afterglow · ps4-hen / GoldHEN',category:'loaders',format:'Built-in browser loader',firmwares:['13.52','14.00'],launchURL:build.entry,image:image('ps4'),source:'https://github.com/well0nez/afterglow-web/tree/'+build.commit,instructionsURL:'/hosts/ps4/afterglow/',requirements:['PS4 browser required','13.52 / 14.00 only','Autostart is opt-in']});
  }
  return require('./host-compact-pages.cjs').actions(root,platform,require('./ps5-browser-hosts.cjs').prepare(require('./ps4-browser-hosts.cjs').prepare([...new Map(rows.map(action => [action.id, action])).values()],platform),platform).map(require('./host-first-party-navigation.cjs').bind).filter(Boolean));
}

const {dashboard,workspaceDashboard} = require('./host-dashboard-markup.cjs');

function savePage(file, title, description, artwork, nav, content, primary, action, chooser = false) {
  const {page} = require('./build-console-guides.cjs');
  page(file, title, description, artwork, nav, content, primary, action);
  const filename = path.join(root, file);
  let html = fs.readFileSync(filename, 'utf8');
  // The shared shell's default PC active state does not apply to host routes.
  html = html.replace(/class="nav-link nav-sublink active" aria-current="page"/g, 'class="nav-link nav-sublink"');
  html = html.replace('</head>', '<link rel="stylesheet" href="/assets/host-selector.css?v=1">\n</head>');
  html = html.replace('<body class="console-guide">', '<body class="console-guide host-selector">');
  const parent=file==='hosts/index.html'?'/' : /^hosts\/ps[45]\/index\.html$/.test(file)?'/hosts/':'/hosts/'+(file.includes('/ps5/')?'ps5':'ps4')+'/';
  // The shared guide shell can already supply this bar. Replace that one owned
  // navigation block before inserting the host route's bar, so builds stay singular.
  html=html.replace(/<nav\b[^>]*class=["'][^"']*\bhost-taskbar\b[^"']*["'][^>]*>[\s\S]*?<\/nav>/gi,'');
  html=html.replace(/(<body\b[^>]*>)/,'$1<nav class="host-taskbar" aria-label="Webhost taskbar"><a href="'+parent+'">← Back</a><a class="host-taskbar-brand" href="/hosts/">whatwhatboy webhost</a><a href="/hosts/ps4/">PS4</a><a href="/hosts/ps5/">PS5</a><a href="/">Site home</a></nav>');
  if(!html.includes('/assets/host-webhost.css'))html=html.replace('</head>','<link rel="stylesheet" href="/assets/host-webhost.css?v=2"></head>');
  html = html.replace('<a class="btn btn-outline" href="/pc/">PC</a>', '');
  html = html.replace(/(<meta name="keywords" content=")[^"]*(")/, '$1whatwhatboy hosts, PS4 exploit hosts, PS5 exploit hosts, firmware selector, console IP, GTA V mod menus, RDR2 mods, ELF loader, BIN loader, offline trainer, file explorer, console downloads, payloads$2');
  if (chooser) {
    html = html.replace('class="container guide-hero-grid"', 'class="container guide-hero-grid guide-hero-text"');
    html = html.replace(/(<header class="guide-hero">[\s\S]*?<\/div>)<img[^>]*>/, '$1');
  }
  if(/^hosts\/ps[45]\/index\.html$/.test(file)&&!html.includes('host-file-entry.js'))html=html.replace('</head>','<script src="../../assets/host-file-entry.js"></script></head>');
  fs.writeFileSync(filename, require('./search-page-output.cjs').finish(file, html));
}

function buildHostSelector({hostOnly=false}={}) {
  const {section, grid, resource, link, ext, esc} = require('./build-console-guides.cjs');
  const catalog = JSON.parse(fs.readFileSync(catalogFile, 'utf8'));
  for (const platform of ['ps4', 'ps5']) {
    const previous = catalog.platforms[platform].find(host => host.firstParty);
    const entry = {label: brand, url: '/hosts/', image: image(platform), firstParty: true,
      tags: [platform.toUpperCase(), 'Payload launcher']};
    catalog.platforms[platform] = [entry, ...catalog.platforms[platform].filter(host => host !== previous && host.url !== '/hosts/')];
    catalog.seo[platform].keywords = [...new Set([...catalog.seo[platform].keywords, brand, 'whatwhatboy hosts', 'PS4 PS5 host selector'])];
  }
  catalog.notes = catalog.notes.filter(note => !note.startsWith('The first-party whatwhatboy host directory links to platform guides'));
  catalog.notes = catalog.notes.filter(note=>!note.startsWith('The first-party whatwhatboy host pages provide firmware-filtered'));
  catalog.notes.push('The first-party whatwhatboy host pages provide pinned built-in PS4/PS5 browser runtimes, separate external hosts, curated downloads and service-dependent Load controls. Each runtime and payload retains its exact firmware and transport requirements; hardware execution remains untested.');
  fs.writeFileSync(catalogFile, JSON.stringify(catalog, null, 2) + '\n');

  const address = '<p id="host-auto-detect" class="host-note">Open this page in your console browser for automatic firmware detection.</p><a id="host-detected-link" class="host-service-link" hidden></a><p class="host-address"><span>Easy address</span><a href="/hosts/"><code translate="no" data-i18n-skip>whatwhatboy.com/hosts/</code></a></p>';
  const cards = ['ps4','ps5'].map(platform=>'<a class="host-console-choice" href="/hosts/'+platform+'/"><span class="host-eyebrow">PlayStation '+platform.slice(-1)+'</span><h3>'+platform.toUpperCase()+'</h3><p>Firmware, payloads, game mods and console files.</p><strong>Open '+platform.toUpperCase()+' →</strong></a>');
  savePage('hosts/index.html', 'PS4 / PS5 webhost',
    'Choose your console to launch payloads, mod menus and tools.', image('ps5'),
    [['/hosts/', brand], ['/hosts/ps4/', 'PS4'], ['/hosts/ps5/', 'PS5']],
    section('consoles', 'Choose your console', address + grid(...cards).replace('class="games-grid"', 'class="games-grid host-console-grid"')),
    '#consoles', 'Choose console', true);

  const chooserFile = path.join(root, 'hosts/index.html');
  fs.writeFileSync(chooserFile, require('./search-page-output.cjs').finish(chooserFile, fs.readFileSync(chooserFile, 'utf8').replace('</body>', '<script defer src="/assets/host-catalog-grid.js?v=3"></script><script defer src="/assets/host-karo-builds.js?v=site-load-1"></script><script defer src="/assets/host-site-load.js?v=1"></script><script defer src="/assets/host-dashboard.js?v=site-load-1"></script></body>')));

  for (const platform of ['ps4', 'ps5']) {
    const name = platform.toUpperCase();
    const base = `/console/${platform}/`;
    const actions = hostActions(platform);
    if (!actions.length) throw Error('The verified action catalogue is not ready: ' + platform);
    savePage(`hosts/${platform}/index.html`, `${name} webhost`,
      'Choose firmware, load compatible payloads and manage your console files.', image(platform),
      [['/hosts/', 'Choose another console'], [`/hosts/${platform}/`, name], ...(platform==='ps4'?[['/hosts/ps4/firmware/','Firmware selection']]:[]), [base + 'downloads.html', 'Downloads']],
      section('actions', 'Host controls', dashboard(platform, actions,{gamesLanding:true})), '#actions', 'Open host', true);
    for (const scope of ['gta5','rdr2','other-games']) {
      const relative = `hosts/${platform}/${scope}/index.html`;
      const file=path.join(root,relative);fs.mkdirSync(path.dirname(file),{recursive:true});
      fs.writeFileSync(file,require('./host-mods-redirect.cjs').renderModRedirect(platform,scope));
    }
    const managerFile = `hosts/${platform}/payload-manager/index.html`;
    savePage(managerFile, `${brand} · ${name} payload manager`,
      `Load, download and organise ${name} payloads with the matching native console tools.`, image(platform),
      [[`/hosts/${platform}/`,`${name} host`],[`/hosts/${platform}/payload-manager/`,'Payload manager'],[base+'downloads.html','Downloads'],['/docs/host-payload-management.md','Setup guide']],
      section('actions','Payload management',workspaceDashboard(platform,actions,'payloads')), '#actions','Manage payloads',true);
    const filesPage=`hosts/${platform}/files/index.html`;
    savePage(filesPage,`${name} file manager`,
      `Manage files on your ${name} through its installed native workspace.`,image(platform),
      [[`/hosts/${platform}/`,`${name} host`],[`/hosts/${platform}/files/`,'File manager'],[`/hosts/${platform}/payload-manager/`,'Payload manager'],[base+'downloads.html','Downloads']],
      section('actions','Console files',workspaceDashboard(platform,actions,'files')),'#actions','Open files',true);
    for (const relative of [`hosts/${platform}/index.html`,managerFile,filesPage]) {
      const hostFile = path.join(root,relative);
      let hostHtml = fs.readFileSync(hostFile, 'utf8').replace('console-guide host-selector', 'console-guide host-selector host-dashboard-page');
      hostHtml = hostHtml.replace('</head>', '<link rel="stylesheet" href="/assets/host-dashboard.css?v=16"><link rel="stylesheet" href="/assets/host-webhost.css?v=2"><link rel="stylesheet" href="/assets/host-firmware-buttons.css?v=3"><link rel="stylesheet" href="/assets/host-catalog-grid.css?v=2">\n</head>').replace('</body>', '<script defer src="/assets/host-console-client.js?v=15"></script><script defer src="/assets/host-catalog-grid.js?v=3"></script><script defer src="/assets/host-karo-builds.js?v=site-load-1"></script><script defer src="/assets/host-site-load.js?v=1"></script><script defer src="/assets/host-dashboard.js?v=site-load-1"></script></body>');
      if(relative===`hosts/${platform}/index.html`)hostHtml=require('./host-folder-markup.cjs').shell(hostHtml);
      if(platform==='ps5'&&relative===filesPage)hostHtml=require('./ps5-web-file-manager.cjs').apply(hostHtml);
      fs.writeFileSync(hostFile, require('./search-page-output.cjs').finish(relative, hostHtml));
    }
  }

  // Only replace the host grid section in existing hubs; preserve other chats' downloads work.
  delete require.cache[require.resolve('../docs/console-exploit-hosts.json')];
  for (const platform of hostOnly?[]:['ps4', 'ps5']) {
    const file = path.join(root, `console/${platform}/index.html`);
    const html = fs.readFileSync(file, 'utf8');
    const sectionMarkup = require('./build-console-guides.cjs').hostSection(platform);
    if (!/<section\b[^>]*id="exploit-hosts"/.test(html)) throw Error('Missing existing host section: ' + platform);
    let updated = html.replace(/<section\b(?=[^>]*id="exploit-hosts")[^>]*>[\s\S]*?<\/section>/, sectionMarkup);
    updated = updated.replace(/(<meta\b[^>]*name="keywords"[^>]*content=")([^"]*)(")/, (all, open, values, close) =>
      open + [...new Set([...values.split(',').map(value => value.trim()), brand, 'whatwhatboy hosts', 'PS4 PS5 host selector'])].join(', ') + close);
    fs.writeFileSync(file, require('./search-page-output.cjs').finish(file, updated));
  }

  if(!hostOnly){
  const sitemapFile = path.join(root, 'sitemap.xml');
  let sitemap = fs.readFileSync(sitemapFile, 'utf8');
  for (const suffix of ['', 'ps4/', 'ps5/',...['ps4','ps5'].flatMap(platform=>['payload-manager','files','gta5','rdr2','other-games'].map(page=>platform+'/'+page+'/'))]) {
    const url = `https://whatwhatboy.com/hosts/${suffix}`;
    if (!sitemap.includes(`<loc>${url}</loc>`)) sitemap = sitemap.replace('</urlset>', `  <url><loc>${url}</loc><lastmod>2026-11-02</lastmod></url>\n</urlset>`);
  }
  fs.writeFileSync(sitemapFile, sitemap);
  if(fs.existsSync(path.join(root,'docs/afterglow-download-inventory.json')))require('./build-ps4-firmware.cjs').build();
  }
  require('./build-host-support-pages.cjs').build();
  console.log('Built /hosts/, /hosts/ps4/ and /hosts/ps5/; added first-party entries to both console host grids.');
}
module.exports = {buildHostSelector,hostActions};
if (require.main === module) buildHostSelector({hostOnly:process.argv.includes('--host-only')});
