const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const {page,section,note,steps,link,ext,sourceList,ps4nav,ps5nav} = require('./build-console-guides.cjs');
const icon='/console/ps5/site-launcher-assets/icon0.png';
function prepare(file, opener=false) {
  const target=path.join(root,file);let html=fs.readFileSync(target,'utf8');
  const keywords=file.includes('payload-manager')?'PS5 Payload Manager v0.6.3, pldmgr ELF, PS5 port 8084, websrv v0.34, PS5 file manager port 8080, ELF loader 9021, PS5 payload compatibility':file.includes('/ps4/')?'PS4 Internet Browser bookmark, PS4 home screen browser, whatwhatboy PS4 downloads, PS4 browser storage permissions':'PS5 home screen shortcut, PS5 Media tile, whatwhatboy PS5 PKG, WHAT00001, deeplinkUri, PS5 homebrew package installer, PS5 Relapse firmware compatibility';
  html=html.replace(/<meta name="keywords" content="[^"]*">/,`<meta name="keywords" content="${keywords}">`);
  html=html.replace('</head>','<link rel="stylesheet" href="/assets/console-launcher.css?v=1"></head>');
  html=html.replace('<link rel="icon" href="/assets/images/logo.png" type="image/png">',`<link rel="icon" href="${icon}" type="image/png">`);
  if(opener)html=html.replace('</body>','<script defer src="/assets/console-service-opener.js?v=3"></script></body>');
  fs.writeFileSync(target,html);
}
const iconPreview=`<div class="launcher-icon-preview"><img src="${icon}" width="512" height="512" alt="Original mint-green whatwhatboy W launcher icon"><p>The original whatwhatboy icon is included in the PS5 shortcut package. The bookmark route on PS4 uses the console’s Internet Browser tile.</p></div>`;
function buildConsoleLaunchers() {
  page('console/ps5/payload-manager.html','Open PS5 Payload Manager','Open the running PS5 Payload Manager dashboard on port 8084, or websrv’s file browser on port 8080. Choose payloads and press Load inside the manager.',icon,ps5nav,
    section('open-manager','Connect to your running PS5 service',`<form class="console-service-opener" data-console-service-opener><div><label for="ps5-service-address">PS5 IP address</label><input id="ps5-service-address" inputmode="decimal" autocomplete="off" spellcheck="false" placeholder="192.168.1.50" aria-describedby="ps5-address-help"></div><button type="button" data-use-loopback>Use this PS5 · 127.0.0.1</button><div class="guide-links"><a data-console-service="manager" aria-disabled="true" target="_blank" rel="noopener noreferrer">Open payload manager</a><a data-console-service="files" aria-disabled="true" target="_blank" rel="noopener noreferrer">Open websrv file manager</a><a data-console-service="homebrew" aria-disabled="true" target="_blank" rel="noopener noreferrer">Open websrv launcher</a></div><p id="ps5-address-help">On a phone or computer, enter the console’s address from Settings &gt; Network &gt; Connection Status. Use 127.0.0.1 only in the browser running on that PS5.</p><p role="status" aria-live="polite"></p></form><noscript><p>JavaScript is needed to prepare these links. In the PS5 browser you can manually open <code>http://127.0.0.1:8084/</code> for the running manager or <code>http://127.0.0.1:8080/fs/</code> for running websrv. On another device, replace 127.0.0.1 with the PS5’s local IP.</p></noscript>`+note('<p>Opening a dashboard requires its service to be running on the console. The site does not send or run a payload. A connection error means the browser could not open the entered service; check the IP, local network and running payload.</p>'))+
    section('setup','Prepare Payload Manager',steps([
      ['Start a compatible homebrew environment','Choose the firmware-specific jailbreak route and working ELF loader for your console. The manager is not an initial jailbreak.'],
      ['Load the pinned manager ELF','The site’s Apps page retains Payload Manager v0.6.3. Load that ELF using the documented compatible loader, or use the version bundled with your supported itsPLK autoloader.'],
      ['Open its dashboard','Use the button above after starting the manager. Its documented port is 8084. The v0.6.3 manager can register its own Payload Manager Media tile when AUTO_INSTALL_APP is enabled.'],
      ['Import, review, then load','Import a compatible ELF using the manager’s UI. Check its firmware requirements, then choose Load there. Downloading the file alone does not run it.']
    ])+`<div class="guide-links">${link('/console/ps5/apps.html','Download manager ELF')}${link('/console/ps5/downloads.html','PS5 downloads')}${link('/console/ps5/site-launcher.html','Site home-screen shortcut')}</div>`)+
    section('file-manager','Open websrv separately',note('<p>websrv v0.34 serves <code>/fs/</code> and its homebrew launcher on port <code>8080</code>. Start the PS5 websrv ELF first. Payload Manager’s port 8084 and ezRemote’s receiver port 6701 are different services; starting one does not start the others.</p>')+`<div class="guide-links">${link('/console/ps5/transfer-tools.html','Transfer tools and setup')}</div>`)+
    section('sources','Verified project behavior',sourceList([
      ['https://github.com/itsPLK/ps5-payload-manager/tree/v0.6.3','Pinned Payload Manager v0.6.3'],
      ['https://github.com/itsPLK/ps5-payload-manager/blob/v0.6.3/include/pldmgr.h','Manager port 8084 and loader port 9021'],
      ['https://github.com/itsPLK/ps5-payload-manager/blob/v0.6.3/assets/param.json','Manager’s own home-screen shortcut'],
      ['https://github.com/ps5-payload-dev/websrv/tree/v0.34','websrv v0.34 services']
    ]))+section('more','More PS5 resources',`<div class="guide-links">${link('/console/ps5/themes.html','PS5 themes & customization')}${link('/console/ps5/downloads.html','PS5 download centre')}</div>`), '#open-manager','Open manager');
  prepare('console/ps5/payload-manager.html',true);

  page('console/ps4/site-launcher.html','Open whatwhatboy from PS4 Home','Keep the PS4 download hub in Internet Browser bookmarks, then open it from the console’s existing browser tile.',icon,ps4nav,
    section('bookmark','Add the PS4 site bookmark',iconPreview+steps([
      ['Open Internet Browser from the content area','On the PS4 home screen choose Internet Browser. Press Triangle to enter a URL.'],
      ['Open the PS4 hub','Enter <code>https://whatwhatboy.com/console/ps4/</code>. The Downloads navigation stays within PS4 resources.'],
      ['Save the bookmark','While viewing the hub, press OPTIONS and select Add Bookmark. Name it whatwhatboy PS4.'],
      ['Return from Home','Open the Internet Browser tile, press OPTIONS, choose Bookmarks and select whatwhatboy PS4. Frequently Used Pages is another browser shortcut.']
    ])+note('<p>This is the PS4 browser’s supported bookmark workflow. It does not install a separate whatwhatboy PKG or replace the browser’s home-screen icon. A browser bookmark gives no additional storage permissions.</p>')+`<div class="guide-links">${link('/console/ps4/','Open PS4 hub')}${link('/console/ps4/downloads.html','PS4 downloads')}${ext(icon,'Download original icon')}</div>`)+
    section('sources','PlayStation browser documentation',sourceList([['https://manuals.playstation.net/document/en/ps4/basic/browse.html','PS4 Internet Browser, content-area tile and bookmarks']])), '#bookmark','Set up bookmark');
  prepare('console/ps4/site-launcher.html');

  const provenanceFile=path.join(root,'docs/ps4-ps5-launcher-build.json');
  const build=fs.existsSync(provenanceFile)?JSON.parse(fs.readFileSync(provenanceFile,'utf8')):null;
  const packageLink=build?`<a href="/downloads/ps4-ps5/whatsite-ps5-site-launcher-2026-11-02/${build.filename}" download>Download whatwhatboy PS5 shortcut PKG</a>`:'';
  page('console/ps5/site-launcher.html','whatwhatboy PS5 Home-Screen Shortcut','A custom browser shortcut designed to add a whatwhatboy tile to the PS5 Media row. Install it through an already working, compatible PS5 homebrew package installer.',icon,ps5nav,
    section('shortcut','Open the site from the Media row',iconPreview+`<div class="guide-links">${packageLink}${link('/console/ps5/','Open PS5 hub')}${ext(icon,'Download original icon')}</div>`+note('<p>This is an unofficial PS5 browser shortcut package using <code>param.json</code>’s <code>deeplinkUri</code>. It targets <code>https://whatwhatboy.com/console/ps5/</code> and registers title ID <code>WHAT00001</code>. It requires active homebrew access to install. The site does not offer a stock-console PWA installation.</p>')+steps([
      ['Check the requirements','Keep your current firmware and use your existing compatible homebrew environment and package installer. This shortcut does not jailbreak the console or enable package support.'],
      ['Download and transfer the PKG','Save the package to USB or transfer it with the tools supported by your existing installer. It is a PS5 homebrew shortcut, not a PS4 theme or game package.'],
      ['Install with your console’s supported installer','Open the matching package installer and explicitly select the downloaded PKG. Installing the file is a separate action from downloading it.'],
      ['Open whatwhatboy · PS5 from Media','The tile opens the PS5 hub. From there choose Downloads, Payloads or Apps. Internet access is needed for the public website; local services still need their console payloads running.']
    ]))+
    section('build-details','Package details',build?`<p>Version ${build.version} · ${(build.bytes/1024).toFixed(1)} KiB · Title ID <code>WHAT00001</code></p><p>SHA-256 <code style="overflow-wrap:anywhere">${build.sha256}</code></p><p>Generated locally with the pinned open-source browser-app package builder. The package has been structurally checked; console installation, icon rendering and launch behavior have not been tested on physical hardware.</p>`:note('<p>The shortcut build is not available yet. Use the PS5 hub link above in your existing browser entry point.</p>'))+
    section('entry-point','Relapse and the site shortcut',note('<p>Relapse covers its exact listed PS5 firmware versions from 7.00 to 13.60; <strong>9.05, 10.60 and 11.40 are absent from its whitelist</strong>. This build targets retail consoles and testkits; devkits use the separate upstream build.</p><p>The site tile is a convenience after homebrew setup. Opening this site or its shortcut does not automatically run Relapse, start an ELF loader or launch a payload. A supported exploit version does not establish support for every payload or installer.</p>')+`<div class="guide-links">${link('/console/ps5/jailbreaks.html','Check your PS5 firmware route')}${link('/console/ps5/payload-manager.html','Open payload manager')}${link('/console/ps5/transfer-tools.html','File-transfer tools')}</div>`)+
    section('sources','Shortcut implementation and source',sourceList([
      ['https://github.com/kvnhrt/ps5-browser-app/tree/d427877157b5ffdf90847a0c3ad54c7025100f55','Pinned browser-app source and documented PKG/deeplink mechanism'],
      ['https://github.com/kvnhrt/ps5-browser-app#customizing','Custom URL, title ID and 512×512 PNG requirements'],
      ['https://github.com/soniciso1/relapse','Relapse firmware list and payload-loading behavior']
    ])), '#shortcut','Get site shortcut');
  prepare('console/ps5/site-launcher.html');
  console.log('Built PS4 bookmark guide, PS5 site shortcut guide and PS5 service opener.');
}
if(require.main===module)buildConsoleLaunchers();
module.exports={buildConsoleLaunchers};
