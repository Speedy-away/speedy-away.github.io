const fs = require('node:fs');
const path = require('node:path');
const {page,section,note,steps,ext,link,sourceList,esc} = require('./build-console-guides.cjs');
const root = path.resolve(__dirname,'..'), route = 'console/xbox-one-series.html';
const data = require('../docs/xbox-one-series-catalogue.json');
const frameworkImages = require('../docs/xbox-framework-image-provenance.json').images;
const frameworkImage = file => {
  const image=frameworkImages.find(image=>image.packageSha256===file.sha256);
  return image?`<img class="xbox-framework-icon" src="${image.image}" alt="${esc(file.name.replace(/\.appx$/i,''))} package logo" width="48" height="48" loading="lazy" style="width:48px;height:48px;object-fit:contain">`:'';
};
const {publicMirror} = require('./download-mirror-policy.cjs');
const sources = {
  account:'https://learn.microsoft.com/en-us/windows/apps/publish/partner-center/open-a-developer-account',
  activation:'https://learn.microsoft.com/en-us/previous-versions/windows/uwp/xbox-apps/devkit-activation',
  home:'https://learn.microsoft.com/en-us/previous-versions/windows/uwp/xbox-apps/devhome-home',
  portal:'https://learn.microsoft.com/en-us/previous-versions/windows/uwp/xbox-apps/device-portal-xbox',
  lan:'https://learn.microsoft.com/en-us/microsoft-edge/webview2/how-to/remote-debugging-xbox',
  deployment:'https://learn.microsoft.com/en-us/windows/uwp/apps-for-xbox/development-options',
  install:'https://learn.microsoft.com/en-us/windows/advanced-settings/device-portal',
  architecture:'https://learn.microsoft.com/en-us/previous-versions/windows/uwp/xbox-apps/development-environment-setup',
  storage:'https://learn.microsoft.com/en-gb/previous-versions/windows/uwp/debug-test-perf/device-portal-api-core',
  resources:'https://learn.microsoft.com/en-us/previous-versions/windows/uwp/xbox-apps/system-resource-allocation',
  deactivate:'https://learn.microsoft.com/en-us/previous-versions/windows/uwp/xbox-apps/devkit-deactivation'
};
const tech = value => `<span translate="no" data-i18n-skip>${esc(String(value))}</span>`;
const size = bytes => (bytes/1048576).toFixed(1)+' MiB';
const packageOf = file => file.packages.find(p=>p.executable && p.identity.ProcessorArchitecture==='x64');
const modelLabel = app => app.modelLabel || app.models.map(model=>model==='one'?'Xbox One family':model==='series'?'Series S / X':'Model support unconfirmed').join(' / ');
function download(file) {
  const pkg = packageOf(file);
  const mirror = publicMirror(file.local, root), url = mirror?.local || file.sourceUrl;
  const sourceArchive = !mirror && file.derivedFrom;
  const action = sourceArchive ? 'Download original ZIP' : file.original && file.name.endsWith('.zip') ? 'Download ZIP' : 'Download';
  return `<div class="xbox-file" data-models="${file.models.join(' ')}"><a class="xbox-download" href="${esc(url)}" ${mirror ? 'download' : 'target="_blank" rel="noopener noreferrer"'}>${action} · ${esc(file.label)} <i class="fas fa-download" aria-hidden="true"></i></a>${sourceArchive ? `<p class="xbox-file-meta">Extract ${tech(file.name)} before installation. The package size and SHA-256 below describe that extracted file.</p>` : ''}<span class="xbox-file-meta">${tech(file.format)} · ${tech(size(file.bytes))} · ${tech(file.version)}</span>${pkg ? `<span class="xbox-file-meta">Minimum OS ${tech(pkg.targets[0].MinVersion)} · ${tech(pkg.identity.ProcessorArchitecture)}</span>` : ''}<details class="xbox-checksum"><summary>File &amp; SHA-256</summary><p>${tech(file.name)}</p><code translate="no" data-i18n-skip>${file.sha256}</code><p>${ext(file.sourceUrl,'Original publisher download')}</p>${file.derivedFrom ? `<p>Unmodified member extracted from ${tech(file.derivedFrom.name)}. The original ZIP remains available.</p>` : ''}</details></div>`;
}
function card(app) {
  const ready = app.files.filter(f=>!f.framework && !f.name.endsWith('.zip'));
  const visibleModels = [...new Set([...app.models,...app.files.filter(f=>!f.framework).flatMap(f=>f.models)])];
  const pkg = ready.map(packageOf).find(Boolean);
  const dependencies = pkg.dependencies.map(d=>`<li>${tech(d.Name)} ≥ ${tech(d.MinVersion)} · x64</li>`).join('');
  return `<article class="guide-resource xbox-app" id="${app.id}" data-xbox-app data-models="${visibleModels.join(' ')}" data-category="${app.category.toLowerCase()}" data-search="${esc([app.title,app.description,app.requirements,app.paths,...app.formats,pkg.dependencies.map(d=>d.Name).join(' ')].join(' ').toLowerCase())}">
<div class="xbox-app-heading"><img src="${app.artwork.image}" alt="${esc(app.title.split(' · ')[0])} official package icon" width="96" height="96" loading="lazy"><div><p class="xbox-eyebrow">${esc(app.category)} · ${tech(app.version)}</p><h3>${esc(app.title)}</h3></div></div>
<p>${esc(app.description)}</p><div class="xbox-tags"><span>x64 UWP</span><span>${app.id === 'dolphin' ? 'One / Series · legacy build confirmed' : esc(modelLabel(app))}</span>${app.formats.map(f=>`<span translate="no" data-i18n-skip>${esc(f)}</span>`).join('')}</div>
<p><strong>Before first launch.</strong> ${esc(app.requirements)}</p><p><strong>Files &amp; folders.</strong> ${tech(app.paths)}</p>
<div class="xbox-builds">${ready.map(download).join('')}</div>
<details class="xbox-details"><summary>OS requirements &amp; dependencies</summary><p>Minimum platform version: ${tech(pkg.targets[0].MinVersion)}. Compare the OS shown in Developer Home. This is the package’s platform requirement, not an exploit firmware range.</p><p>Target family: ${tech(pkg.targets.map(t=>t.Name).join(', '))}. Architecture: ${tech(pkg.identity.ProcessorArchitecture)}.</p><ul>${dependencies || '<li>No separate framework dependency declared.</li>'}</ul><p>${link('#frameworks','Get the x64 frameworks below')}</p><p>Package identity: ${tech(pkg.identity.Name)}. Version: ${tech(pkg.identity.Version)}.</p></details>
${app.files.some(f=>f.name.endsWith('.zip') || f.legacy) ? `<details class="xbox-details"><summary>Original archives${app.files.some(f=>f.legacy) ? ' & previous build' : ''}</summary>${app.files.filter(f=>f.name.endsWith('.zip') || f.legacy).map(download).join('')}${app.files.some(f=>f.legacy) ? '<p>Dolphin 1.1.9.0 is the discontinued earlier port. Its minimum OS is 10.0.26100.0 and it uses a different package identity. Back up saves before moving to the successor.</p>' : ''}</details>` : ''}
<div class="guide-links">${ext(app.guide,'Setup documentation')}${ext(app.release,'Release / publisher')}${ext(app.project,'Project')}${(app.sources||[]).map(([url,label])=>ext(url,label)).join('')}</div><p class="xbox-credit">Package artwork: ${esc(app.credit)}. ${ext(app.artwork.source,'Artwork source')}</p></article>`;
}
function build() {
  const frameworkFiles = data.frameworks.filter((f,i,a)=>a.findIndex(o=>o.sha256===f.sha256)===i);
  const content = section('start','Start with your console',
    `<div class="xbox-start-grid"><div><h3>One, One S or One X</h3><p>Use Xbox One compatible x64 UWP packages. For XBSX2 select <strong>SSE4</strong>. Expect tighter emulator performance limits than on Series consoles.</p></div><div><h3>Series S or Series X</h3><p>Use the Series build where offered. For XBSX2 select <strong>AVX2</strong>. Performance depends on the app and game; Dev Mode does not grant unrestricted hardware access.</p></div><div><h3>What you need</h3><p>A retail console, controller, internet for activation, a registered developer account, and a computer with a browser on the same LAN. USB storage is optional and app-specific.</p></div></div>` +
    note('<p><strong>This is Microsoft’s retail Developer Mode route.</strong> Retail games and Store apps run in Retail Mode; sideloaded development apps run in Dev Mode. No physical console installation or performance testing was performed for this page.</p>') +
    `<div class="guide-links">${ext(sources.activation,'Supported retail consoles')}${ext(sources.architecture,'x64 and local-network requirements')}${ext(sources.resources,'UWP resource limits')}</div>`,'Activate once, connect over your LAN, then install the matching native UWP build.') +
  section('activate','1 · Register & activate',steps([
    ['Create or check your developer account',`New users should start at ${ext('https://storedeveloper.microsoft.com/','Microsoft Store developer registration')}. Microsoft’s account page, updated 29 October 2026, says the new Individual and Company flow has no registration fee. Individual registration uses a personal Microsoft account, government ID and selfie. Complete verification and reach the Partner Center Apps &amp; Games workspace. Existing fully registered accounts can be reused.`],
    ['Install Xbox Dev Mode on the console','In the console Microsoft Store, find the Microsoft-published Xbox Dev Mode app. Open it and note the activation code. Keep the console connected while activation completes.'],
    ['Register the displayed code',`On your computer sign into the same registered app-developer account and open ${ext('https://partner.microsoft.com/xboxconfig/devices','Manage Xbox development consoles')}. Enter the code shown on your own console and review Microsoft’s activation agreement. A normal Microsoft account without completed developer enrollment is insufficient.`],
    ['Switch and restart','After successful activation choose Switch and restart in Xbox Dev Mode. Developer Home opens in the development environment. Keep a console user signed in when deploying apps.']
  ]) + note('<p>Microsoft warns that direct Xbox / Partner Center links may still enter the legacy registration flow. Begin new enrollment at storedeveloper.microsoft.com and check the current account page if a fee or verification screen differs. No fee is collected by this site.</p>') + sourceList([[sources.account,'Microsoft: current developer-account registration'],[sources.activation,'Microsoft: console activation and mode switching']])) +
  section('connect','2 · Open Device Portal over your LAN',steps([
    ['Find Developer Home','Dev Home shows the console’s name, IP address and OS version. Keep the computer and console on the same local subnet; wired Ethernet is useful for large transfers.'],
    ['Enable remote access','In Dev Home open Home → Remote Access Settings. Enable Xbox Device Portal, set a username and password, and save. Read the Remote Access URL shown on that console.'],
    ['Connect from your computer','Open the displayed URL in a browser. The usual form is <code translate="no" data-i18n-skip>https://&lt;console-system-IP&gt;:11443</code>. Check the address matches your console before handling its console-generated certificate warning. Sign in using the Remote Access username and password.'],
    ['Use the correct credentials','The Developer Home “Show Visual Studio pin” action is for Visual Studio pairing. Browser access uses the Remote Access login. Visual Studio and the Windows SDK are not required just to upload these prepared packages through Portal.']
  ]) + `<figure class="xbox-setup-figure"><img src="/assets/images/xbox-one-series/remote-access.png" width="1920" height="1080" loading="lazy" alt="Microsoft screenshot of Xbox Developer Home Remote Access settings"><figcaption>Remote Access settings in Microsoft’s Xbox Device Portal documentation. UI wording can change. ${ext(sources.portal,'Microsoft Learn screenshot credit')}</figcaption></figure>` + sourceList([[sources.home,'Microsoft: Developer Home controls'],[sources.portal,'Microsoft: enable Xbox Device Portal'],[sources.lan,'Microsoft: current Xbox HTTPS endpoint and port 11443']])) +
  section('install','3 · Install an app & its x64 dependencies',steps([
    ['Download the matching console package','Choose your model in the catalogue below. Download the native APPX / MSIX or bundle and the listed x64 frameworks to your computer. The extracted PPSSPP MSIX and DurangoFTP APPX bundle are ready for Portal; their original ZIPs remain available separately.'],
    ['Open the Portal app installer','On the Device Portal Home / Apps area, use Add or Install app. Choose the APPX, MSIX, APPX bundle or MSIX bundle as the main package. A ZIP must be extracted first. Follow the portal prompts for the publisher certificate if it requests one.'],
    ['Attach the required frameworks','Choose each required x64 APPX under dependency packages, then install. The catalogue lists the exact manifest identities and minimum versions. Existing matching frameworks at the required version or newer can be reused. Microsoft.VCLibs.140.00.UWPDesktop is a different framework from Microsoft.VCLibs.140.00.'],
    ['Wait for installation, then launch','Wait for Portal to report success. Launch the app from Developer Home → Games & apps. Where the publisher requires it, use the app’s options / details to set App type to Game before launch. For emulators, select the required BIOS, game and save folders inside the app.'],
    ['Read failures before retrying','For dependency errors, compare Name, Publisher, version and x64 architecture with the package details. For minimum-OS errors, read your Dev Home OS version against that specific build. Do not substitute a desktop EXE, x86 app or Store-submission .appxupload wrapper.']
  ]) + sourceList([[sources.deployment,'Microsoft: manual sideloading with dependencies'],[sources.install,'Microsoft: Device Portal app installation and removal']])) +
  section('apps','Native apps & ready downloads',
    `<form class="xbox-filters" id="xboxFilters" role="search"><div><label for="xboxSearch">Search apps, systems or formats</label><input id="xboxSearch" type="search" placeholder="Try PS2, streaming, CHD…" autocomplete="off"></div><div><label for="xboxModel">Your console</label><select id="xboxModel"><option value="all">All models</option><option value="one">Xbox One / One S / One X</option><option value="series">Xbox Series S / Series X</option><option value="unspecified">Unconfirmed model scope</option></select></div><div><label for="xboxCategory">Category</label><select id="xboxCategory"><option value="all">All apps</option><option value="emulators">Emulators</option><option value="tools">Apps &amp; tools</option><option value="engines">Game engines &amp; ports</option></select></div><button type="reset" class="btn btn-outline">Clear filters</button></form><p id="xboxCount" role="status" aria-live="polite">${data.apps.length} of ${data.apps.length} apps</p><p id="xboxEmpty" hidden>No matching apps. Clear the filters to see all ${data.apps.length}.</p><div class="xbox-app-grid">${data.apps.map(card).join('\n')}</div>`,
    `${data.apps.length} source-confirmed console projects. Builds and dependencies were inspected without running them. Every linked local package has a recorded SHA-256.`) +
  section('frameworks','x64 framework downloads',
    `<p>Install the versions required by your chosen app. These are unmodified Microsoft framework packages supplied with the publishers’ releases. The older VCLibs file remains available with DurangoFTP; modern emulator packages require the newer 14.0.33519.0 framework. Select the required version or newer with the same identity and publisher.</p><div class="xbox-framework-grid">${frameworkFiles.map(f=>{const p=f.packages.find(p=>p.framework&&p.identity.ProcessorArchitecture==='x64');return `<article class="guide-resource">${frameworkImage(f)}<h3>${tech(p.identity.Name)}</h3><p>${tech(p.identity.Version)} · x64</p>${download(f)}</article>`}).join('')}</div>` + note('<p>Moonlight needs both XAML 2.7 and VCLibs. DurangoFTP additionally needs .NET Native Framework 2.2 and .NET Native Runtime 2.2. The dependency lists on each app card show the actual minimum versions from its manifest.</p>')) +
  section('storage','Storage, USB paths & save backups',steps([
    ['Keep app data separate from the installed package','Use Device Portal File explorer to select the installed app’s local storage. Apps can store data in LocalState or LocalCache; follow the path on the app card. Kodi uses LocalCache\\Roaming\\Kodi. Package identities are listed on the cards so similarly named apps can be distinguished. Back up saves and configuration before uninstalling or moving to a different package identity.'],
    ['Choose real folders in each app','USB drive letters vary; use the app’s picker and check the actual mounted drive. The catalogue’s folders are examples. There is no SD-card layout or shared mandatory USB path for Xbox Dev Mode.'],
    ['Prepare external storage for the chosen emulator','The XBSX2 publisher guide calls for NTFS and ALL APPLICATION PACKAGES access permissions when preparing the drive on Windows. Follow its exact permission steps and choose BIOS / game / memory-card folders in XBSX2. Do not reformat a drive containing the only copy of your data. Other apps have their own folder and access requirements.'],
    ['Check available development storage','Use the storage information shown by your console and Portal. No universal free-space quota is promised here. ROMs, optional NAND / BIOS files, textures and save states can consume much more space than the app download.']
  ]) + sourceList([[sources.storage,'Microsoft: package-specific LocalAppData file access'],[data.apps[0].guide,'XBSX2 publisher: USB formatting, permissions and directory choices']])) +
  section('remove','Remove apps or return to Retail Mode',steps([
    ['Remove one app','Close the app, back up its documented save/profile directories, then select the app in Device Portal’s Apps manager and use Remove / Uninstall. Preserve your external game and save folders. Reinstalling a different package identity does not automatically migrate old data.'],
    ['Return to your retail games','In Developer Home → Quick actions choose Leave Dev Mode and restart. Read any cleanup option before confirming; leave deletion of sideloaded apps/data unselected when you want to preserve them. Routine mode switching does not require a factory reset.'],
    ['Return to development later','In Retail Mode open Xbox Dev Mode and choose Switch and restart. This is different from permanently deactivating the console.'],
    ['Permanently deactivate only when intended','Return to Retail Mode and use Xbox Dev Mode → Deactivate, or remove the matching console in Partner Center. Back up development data first and read the prompts. This removes developer activation; it is not the normal daily switching action.']
  ]) + sourceList([[sources.install,'Microsoft: close and uninstall a development app'],[sources.activation,'Microsoft: switch between development and retail'],[sources.deactivate,'Microsoft: permanent deactivation']])) +
  section('sources','Sources, artwork & verification',
    `<p>Reviewed 2 November 2026. Microsoft’s current account article was updated 29 October 2026; several console UWP instructions are archived under Previous Versions. The newer Microsoft Edge Xbox guide corroborates the LAN endpoint. Package requirements here come from the downloaded manifests, rather than assumptions based on file extensions.</p><p>Developer Home screenshots © Microsoft, via ${ext(sources.portal,'Microsoft Learn')}. App icons are extracted from the credited publishers’ original console packages; each app links its artwork source. ${link('/docs/xbox-one-series-artwork.json','Artwork provenance')} · ${link('/docs/xbox-one-series-catalogue.json','Public file catalogue')} · ${link('/docs/xbox-one-series-package-verification.json','Manifest and hash report')}.</p><p>File checks cover archive hashes, native package structure, declared requirements and local links. No physical Xbox execution, app installation or measured performance is claimed.</p>`);
  page(route,'Xbox One / Series Dev Mode','Activate Microsoft Developer Mode, connect over your LAN and install native Xbox UWP apps. Includes model-specific downloads, dependencies and save-folder setup.','/assets/images/xbox-one-series/dev-home.png',[
    ['#activate','Activate'],['#connect','Device Portal'],['#install','Install apps'],['#apps','Native apps'],['#frameworks','Dependencies'],['#storage','Storage'],['#remove','Retail Mode'],['/console/xbox360/','Xbox 360']
  ],content,'#activate','Set up Dev Mode');
  const file = path.join(root,route);
  let html = fs.readFileSync(file,'utf8').replace('</head>','<link rel="stylesheet" href="/assets/xbox-one-series.css?v=1"><script defer src="/assets/xbox-one-series.js?v=1"></script></head>');
  html = html.replace(/(<a\b[^>]*href="\/pc\/index.html"[^>]*class=")([^"]*)" aria-current="page"/g,(_,start,classes)=>start+classes.replace(/\sactive\b/,'')+'"');
  html = require('./apply-site-background.cjs').improve(html,route);
  const navigationHelper = path.join(__dirname,'console-topic-navigation.cjs');
  if (fs.existsSync(navigationHelper)) html = require(navigationHelper).apply(route,html);
  fs.writeFileSync(file,html);
  // Cooperate with the coordinator's topic layout, rebuilding this console only.
  const topicHelper = path.join(__dirname,'build-console-topic-hubs.cjs');
  if (fs.existsSync(topicHelper)) {
    const topics = require(topicHelper), platform = topics.platforms().find(p=>p.id==='xbox-one-series');
    if (platform) for (const scopedFile of topics.buildPlatform(platform)) {
      const scopedPath = path.join(root,scopedFile);
      if (fs.existsSync(navigationHelper)) fs.writeFileSync(scopedPath,require(navigationHelper).apply(scopedFile,fs.readFileSync(scopedPath,'utf8')));
    }
  }
  fs.writeFileSync(path.join(root,'docs/xbox-one-series-sources.json'),JSON.stringify({reviewed:data.reviewed,microsoft:sources,apps:data.apps.map(a=>({id:a.id,project:a.project,release:a.release,setup:a.guide})),screenshots:[{file:'/assets/images/xbox-one-series/dev-home.png',source:'https://learn.microsoft.com/en-us/previous-versions/windows/uwp/xbox-apps/images/device-portal-xbox-1.png',credit:'Microsoft Learn'},{file:'/assets/images/xbox-one-series/remote-access.png',source:'https://learn.microsoft.com/en-us/previous-versions/windows/uwp/xbox-apps/images/device-portal-xbox-15.png',credit:'Microsoft Learn'}]},null,2)+'\n');
  console.log('Built scoped Xbox One / Series library and available topic pages.');
}
if(require.main===module)build();
module.exports={build};
