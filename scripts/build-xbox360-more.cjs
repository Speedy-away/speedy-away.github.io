// Owns only the Xbox 360 library; importing the shared page helper runs no broad build.
const fs=require('node:fs');
const path=require('node:path');
const {page,section,note,ext,link,esc,sourceList}=require('./build-console-guides.cjs');
const root=path.resolve(__dirname,'..');
const data=require('../docs/xbox360-more-library.json');
const route='console/xbox360/library.html';
const size=n=>n<1048576?(n/1024).toFixed(1)+' KiB':(n/1048576).toFixed(2)+' MiB';
const groupNames={apps:'Apps & dashboard',games:'Homebrew games',ports:'Native game ports',emulators:'Emulators',skins:'Aurora skins'};
function support(item){return require('./xbox360-library-requirements.cjs').requirementsFor(item).join(' ');}
function fileLink(file,label='Download',publisherPage=false){
  return `<a class="library-download" href="${esc(file.sourceUrl)}" target="_blank" rel="noopener noreferrer"${publisherPage?'':` download="${esc(file.name)}"`}>${esc(label)} · ${size(file.bytes)} <i class="fas fa-download" aria-hidden="true"></i></a>`;
}
function card(item){
  if(item.status!=='ready'||!item.file)throw Error('Unverified library item '+item.id);
  if(item.launcherVerificationRequired||item.wrapperVerificationRequired)throw Error('Inspect launcher/archive wrapper before publishing '+item.id);
  const f=item.file, search=[item.title,item.author,item.group,item.format,item.runtime,item.prerequisites,item.version,item.titleId].filter(Boolean).join(' ').toLowerCase();
  return `<article id="${esc(item.id)}" class="guide-resource library-card" data-library-card data-library-category="${item.group}" data-library-support="${support(item)}" data-library-search="${esc(search)}">
    <figure class="library-art"><img src="${esc(item.image?.local||'/assets/images/consoles/xbox360.png')}" alt="${esc(item.title)} ${item.group==='skins'?'skin preview':'artwork'}" loading="lazy" width="1280" height="720">${item.image?`<figcaption>${ext(item.image.sourceUrl,esc(item.image.credit))}</figcaption>`:''}</figure>
    <div class="library-card-body"><div class="game-features"><span class="feature-tag">${groupNames[item.group]}</span><span class="feature-tag">${esc(item.format)}</span>${item.id==='harissadc'?'<span class="feature-tag">Development build</span>':''}</div>
    <h3>${esc(item.title)}</h3><p class="library-author">${esc(item.author)}</p><p>${esc(item.description)}</p>
    <dl class="library-facts"><div><dt>Version</dt><dd>${esc(item.version)}</dd></div><div><dt>Console setup</dt><dd>${esc(item.runtime)}</dd></div>${item.titleId?`<div><dt>Homebrew title ID</dt><dd><code>${esc(item.titleId)}</code></dd></div>`:''}</dl>
    <p class="library-required"><strong>Before you launch</strong>${esc(item.prerequisites)}</p>
    <div class="guide-links">${fileLink(item.localDownloadUrl?{...f,sourceUrl:item.localDownloadUrl}:f,item.downloadLabel||(item.downloadLinkKind==='publisher-page'?'Author download page':'Download'),item.downloadLinkKind==='publisher-page')}${(item.companions||[]).filter(c=>c.required).map(c=>fileLink(c.file,c.label||'Required companion')).join('')}${ext(item.release||item.source,'Official source')}</div>
    <details class="library-setup"><summary>Setup, paths & checksum</summary>
      <p><strong>Temporary exploit:</strong> ${esc(item.temporary)}</p>
      <dl class="library-facts"><div><dt>HDD example</dt><dd><code>${esc(item.installPath)}</code></dd></div><div><dt>USB example</dt><dd><code>${esc(item.usbPath)}</code></dd></div><div><dt>Launch</dt><dd><code>${esc(item.launch)}</code></dd></div></dl>
      <ol>${item.setup.map(x=>`<li>${esc(x)}</li>`).join('')}</ol>${item.notes?`<p>${esc(item.notes)}</p>`:''}
      <p class="library-file"><strong>${esc(f.name)}</strong><br>${f.bytes.toLocaleString('en-GB')} bytes · SHA-256<br><code>${f.sha256}</code></p>
      ${(item.companions||[]).map(c=>`<div class="library-alternate"><p><strong>${esc(c.label||'Matching coverflow layout')}</strong></p>${fileLink(c.file,c.label||'Download layout')}<p>Copy to <code>${esc(c.installPath)}</code>.</p><code>${c.file.sha256}</code></div>`).join('')}
      ${(item.alternateFiles||[]).map(a=>`<div class="library-alternate"><p><strong>${esc(a.label)}</strong> (${esc(a.name)})</p>${fileLink(a,'Alternate store package')}<p>This contains the same native XEX and supports first-run conversion of your own ${item.id==='ctr360'?'supported BIN disc image':'Balatro PC game files'}. For manual installation, extract the ZIP contents directly into <code>${esc(item.installPath)}</code>. ${item.id==='ctr360'?'The optional Windows converter is included in the primary manual ZIP.':'The primary manual ZIP adds the apps folder layout and setup instructions.'}</p><code>${a.sha256}</code></div>`).join('')}
      <p class="library-check">File structure and SHA-256 checked. No console execution test performed.</p>
    </details></div>
  </article>`;
}
const intro=section('start','Choose your console setup',
  note('<p>These are Xbox 360 homebrew applications and skin files. Start with an established unsigned-code setup. The model and dashboard required by your exploit take precedence over the application’s requirements. A ready XEX download does not enable homebrew on a stock console.</p>')+
  `<div class="library-routes"><div><h3>RGH / JTAG</h3><p>Harissa64, HarissaDC, Starship, Dusklight, SwanStation and the native Homebrew App Store explicitly require RGH/JTAG. Their releases do not state an exact dashboard minimum or a motherboard list. Keep the working hacked dashboard and follow your hardware-specific setup.</p>${link('/console/xbox360/hardware.html','RGH / JTAG requirements')}</div>
  <div><h3>Temporary sessions</h3><p>BadUpdate targets dashboard <strong>2.0.17559.0</strong> and uses a supported game plus FAT32 USB. It requires a suitable retail-format XEX and runtime payload; unsigned apps are not interchangeable with exploit files. Re-run the entry point after reboot. Balatro360 explicitly supports ABadAvatar; other unconfirmed combinations are labelled individually.</p>${ext('https://github.com/grimdoomer/Xbox360BadUpdate/wiki/How-To-Use','BadUpdate official setup')}${link('/console/xbox360/payloads.html','Runtime payload choices')}</div>
  <div><h3>Peer Pressure</h3><p>The persistent softmod supports Xenon, Zephyr, Falcon, Jasper and Trinity, requires an attached HDD, and excludes Corona / Winchester. It has no DashLaunch plugin support. None of this library’s app entries is presented as separately tested with Peer Pressure; follow its compatibility notes before using modules or plugins.</p>${ext('https://github.com/grimdoomer/Xbox360PeerPressure','Official compatibility')}</div></div>`+
  note('<p><strong>Storage:</strong> <code>Hdd1:\\</code> and <code>Usb0:\\</code> below are example mounts shown by Xbox 360 file managers; verify your actual device. Native XEX apps stay in ordinary folders with their companion files. Aurora scripts go in <code>Aurora\\User\\Scripts\\Utility\\</code>; skins go in <code>Aurora\\Skins\\</code>. Use FAT32 for the temporary-exploit USB workflow. No SD-card installation is specified by these releases.</p>'));
const controls=`<div class="library-controls"><label for="library-search">Search library<input id="library-search" type="search" placeholder="Name, system, format or required data" autocomplete="off"></label><label for="library-category">Category<select id="library-category"><option value="all">All categories</option>${Object.entries(groupNames).map(([id,name])=>`<option value="${id}">${name}</option>`).join('')}</select></label><label for="library-support">Console requirement<select id="library-support"><option value="all">All requirements</option><option value="rgh">RGH / JTAG explicitly required</option><option value="avatar">ABadAvatar explicitly supported</option><option value="badupdate">BadUpdate explicitly supported</option><option value="unsigned">Unsigned-code setup / Aurora</option></select></label><button id="library-reset" type="button">Clear filters</button></div><p id="library-count" role="status" aria-live="polite">${data.resources.length} resources</p><p id="library-empty" hidden>No matching resources. Clear the filters to see the full library.</p>`;
const content=intro+section('library','Xbox 360 homebrew library',controls+`<div class="games-grid library-grid">${data.resources.map(card).join('\n')}</div>`,'Verified ready builds, exact versions and source credits. Download on your phone or PC, then extract and transfer to your console. Commercial game data and BIOS files are supplied by you.')+
section('verification','Sources & release checks',
  `<p>Reviewed ${data.reviewed}. All ${data.resources.length} entries include source links, filenames, versions, byte counts and SHA-256 checksums. Publisher files remain unchanged; convenience bundles assembled from pinned runtime files are labelled. Native XEX2 executables, Aurora’s RAR contents and the skins’ XUIZ headers were inspected. No downloaded build was run or tested on physical Xbox 360 hardware.</p>`+
  `<details><summary>Download availability notes</summary><p>Two lowercase package URLs in the official store catalogue returned HTTP 404: Starship and Homebrew App Store. The direct buttons use the verified manual release assets instead. The smaller store packages for Balatro360 and CTR360 remain available as labelled alternatives with their separate hashes.</p></details>`+
  sourceList([...new Map([...data.resources.map(x=>[x.release||x.source,x.title+' · '+x.version]),...data.sources.map(x=>[x.url,x.purpose])]).entries()]));
page(route,'Xbox 360 Homebrew Library','Native XEX apps, homebrew games, ports, emulators and Aurora skins with ready downloads, requirements and setup paths.','/assets/images/xbox360-more/anarch360.png',[
  ['/console/xbox360/','Xbox 360'],['/console/xbox360/jailbreaks.html','Jailbreak'],['/console/xbox360/apps.html','Apps & Dashboards'],['/console/xbox360/library.html','Homebrew Library'],['#start','Setup requirements'],['#library','Browse files']
],content,'#library','Browse the library');
let html=fs.readFileSync(path.join(root,route),'utf8');
html=html.replace('</head>','<link rel="stylesheet" href="/assets/xbox360-library.css?v=1"><script defer src="/assets/xbox360-library.js?v=2"></script></head>');
html=html.replace('<body class="','<body data-xbox360-library class="');
html=require('./apply-site-background.cjs').improve(html,route);
fs.writeFileSync(path.join(root,route),html);
console.log('Built only '+route+' with '+data.resources.length+' ready resources.');
