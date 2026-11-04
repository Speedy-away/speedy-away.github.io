// Only regenerates console/retro/psp.html; shared console/Retro builders stay untouched.
const fs = require('node:fs');
const path = require('node:path');
const {page, section, steps, note, ext, sourceList, esc} = require('./build-console-guides.cjs');
const root = path.resolve(__dirname, '..');
const route = 'console/retro/psp.html';
const size = bytes => (bytes / 1048576).toFixed(2) + ' MiB';
const text = value => esc(String(value));
function buildPspMore() {
  const data = JSON.parse(fs.readFileSync(path.join(root, 'docs/psp-more-catalogue.json')));
  for (const item of data.items) for (const file of item.files) {
    if (!file.sha256 || !file.bytes || !file.verifiedFormat) throw Error('Download and inspect first: '+item.id);
  }
  const native = data.items.filter(i=>['Apps','Games','Ports','Emulators'].includes(i.category));
  const card = item => {
    const photo = `/assets/images/psp-more/${item.id}.jpg`;
    const image = item.image || (fs.existsSync(path.join(root, photo)) ? photo : '/assets/images/psp-more/ark4.png');
    const artworkCredit = item.imageCredit || item.author + ' · preview hosted by pspunk';
    const files = item.files.map(file=>`<div class="psp-file"><a class="psp-download" href="${text(item.directSourceOnly ? file.sourceUrl : file.local)}" download data-original-href="${text(file.sourceUrl)}"><i class="fas fa-download" aria-hidden="true"></i> Download ${text(file.label || file.name)}</a><p>${text(file.version)} · ${size(file.bytes)} · ${text(file.verifiedFormat)}</p><details><summary>SHA-256 &amp; original file</summary><code>${file.sha256}</code><p>${ext(file.sourceUrl, 'Original download')}</p>${file.nativePbpPaths.length ? `<p>Native package: <code>${text(file.nativePbpPaths.find(name => /(?:^|\/)EBOOT\.PBP$/i.test(name)) || file.nativePbpPaths[0])}</code></p>` : ''}</details></div>`).join('');
    const category = item.category.toLowerCase();
    return `<article class="game-card guide-resource psp-card" id="${item.id}" data-category="${category}" data-search="${text([item.title,item.category,item.format,item.description,item.compatibility,item.install,item.author,...item.files.map(f=>f.version)].join(' ').toLowerCase())}">
<figure><img src="${image}" alt="${text(item.title)} · original project artwork" width="480" height="272" loading="lazy"><figcaption>${text(artworkCredit)}</figcaption></figure>
<div class="psp-tags"><span>${text(item.category)}</span><span>${text(item.format)}</span></div><h3>${text(item.title)}</h3><p>${text(item.description)}</p>
<p class="psp-requirements"><strong>Requires:</strong> ${text(item.compatibility)}</p><details class="psp-install"><summary>Installation &amp; storage path</summary><p>${text(item.install)}</p>${item.expectedPath ? `<p>App path: <code>${text(item.expectedPath)}</code></p>` : ''}</details>
<div class="psp-files">${files}</div><div class="guide-links">${ext(item.source,'Source &amp; release notes')}${ext(item.imageSource || item.source,'Artwork credit')}</div></article>`;
  };
  const search = `<div class="psp-search"><label for="gameSearch">Find a PSP download</label><input type="search" id="gameSearch" placeholder="Search apps, EBOOT, themes, firmware…" autocomplete="off"><div class="psp-filters" aria-label="Download categories">${['All','Apps','Games','Ports','Emulators','Themes','Plugins','Setup'].map((name,i)=>`<button type="button" class="filter-btn${i===0?' active':''}" data-filter="${name.toLowerCase()}" aria-pressed="${i===0}">${name}</button>`).join('')}<button type="button" id="resetGameSearch">Clear filters</button></div><p id="gameSearchStatus" data-result-noun="download" role="status" aria-live="polite">${data.items.length} downloads shown</p><p class="no-results" hidden>No matching downloads. Clear filters to return to the catalogue.</p></div>`;
  const body = section('start','Start with your PSP',note(`<p><strong>${native.length} native PSP apps, games, ports and emulators</strong>, plus ARK-4, CXMB and four theme files. These packages run on the handheld after compatible homebrew access. Each download shows its exact pinned file, size and checksum.</p><p><strong>ARK-4 is archived.</strong> Its final v4.20.69 r206 release links to ARK-5. Keep the ARK-4 instructions below for that version; use the official FasterARK instructions for the current upstream route.</p><div class="guide-links">${ext('https://github.com/PSP-Arkfive/FasterARK','Current ARK-5 setup')}${ext('https://github.com/PSP-Archive/ARK-4/wiki/Installation-on-PSP','ARK-4 setup reference')}</div>`)+steps([
    ['Check model and firmware','Read Settings → System Settings → System Information. ARK-4’s live install route uses official 6.60 or 6.61 on retail 1000, 2000, 3000, Go and E1000/Street. Follow the project’s separate migration instructions if PRO, ME or another CFW is already installed.'],
    ['Prepare the correct storage','Back up the existing card and saves. Connect by USB or use a reader. Keep the Memory Stick/Go storage’s existing layout. The table below distinguishes the drive’s root from folders inside PSP.'],
    ['Install ARK-4 live access','In the final ARK4.zip, copy ARK_01234 into PSP/SAVEDATA/ and ARK_Loader into PSP/GAME/. On Go, put both on the same storage. Eject safely and launch ARK Loader from Game. It must be relaunched after a full reboot unless you separately install cIPL.'],
    ['Add a native app','Extract the selected binary archive. Put its complete app folder, including EBOOT.PBP and bundled resources, under PSP/GAME/. Launch it from Game → Memory Stick or System Storage. Do not copy the unextracted ZIP there.']
  ])+`<div class="psp-table-wrap"><table class="psp-paths"><caption>Paths on the console</caption><thead><tr><th>Content</th><th>Memory Stick (all models, Go M2)</th><th>PSP Go internal storage</th></tr></thead><tbody><tr><th>Homebrew</th><td><code>ms0:/PSP/GAME/App/EBOOT.PBP</code></td><td><code>ef0:/PSP/GAME/App/EBOOT.PBP</code></td></tr><tr><th>ARK savedata</th><td><code>ms0:/PSP/SAVEDATA/ARK_01234/</code></td><td><code>ef0:/PSP/SAVEDATA/ARK_01234/</code></td></tr><tr><th>Themes</th><td><code>ms0:/PSP/THEME/</code></td><td><code>ef0:/PSP/THEME/</code></td></tr><tr><th>CXMB</th><td><code>ms0:/seplugins/cxmb/cxmb.prx</code></td><td><code>ef0:/seplugins/cxmb/cxmb.prx</code></td></tr></tbody></table></div><p class="psp-small">On a computer, X:/ means the USB drive letter: X:/PSP/GAME/ maps to that device’s ms0:/PSP/GAME/ or ef0:/PSP/GAME/. An app may still use a hard-coded ms0 path; check its requirements. Street has no WLAN, so network features need another model. PC assistants and Vita VPKs are separate from these native PSP files.</p>`)+
  section('library','PSP download catalogue',search+`<div class="games-grid psp-grid">${data.items.map(card).join('\n')}</div>`,'Search the exact files below. Open installation notes before copying a package.')+
  section('theme-setup','PTF and CTF setup',steps([
    ['PTF: use the PSP theme menu','Copy a .ptf to PSP/THEME/ on the selected device and apply it in Settings → Theme Settings → Theme. The distributor lists the included PTF files for 6.60/6.61 on official or custom firmware.'],
    ['CTF: match firmware and install CXMB','The included originals are 6.60-labelled CTF files. Use compatible 6.60 CFW with CXMB; a theme’s file extension alone does not prove support for another firmware. Copy the CTF to PSP/THEME/.'],
    ['Enable CXMB in ARK-4','Copy cxmb.prx into seplugins/cxmb/. In ARK Custom Launcher’s file browser, select the PRX, install it for VSH (XMB), and enable it. Restart VSH, then open Theme Settings. Do not register this XMB plugin as always or Game.'],
    ['Classic PRO/ME configuration','For those CFWs, the CXMB readme specifies ms0:/seplugins/cxmb/cxmb.prx 1 (or ef0:/seplugins/cxmb/cxmb.prx 1) as the first line of seplugins/VSH.txt. Restart VSH after changing it. ARK-4 has its own plugin manager and configuration format.']
  ])+sourceList([['https://github.com/PSP-Archive/ARK-4/wiki/Plugins','ARK-4 plugin installation'],['https://github.com/cello0314/CXMB','CXMB installation and contributors'],['https://www.pspunk.com/psp-themes/','Theme distributor: original files and screenshots']]))+
  section('sources','Sources & file verification',`<p>Reviewed 2 November 2026. Downloads were inspected as data: ZIP CRCs, native PBP headers and section offsets, PRX signature and theme container headers. File sizes and SHA-256 values identify the archived originals. Project artwork is extracted from each official build or credited to the theme distributor. Physical PSP installation and performance have not been tested here.</p><div class="guide-links">${ext('/docs/psp-more-catalogue.json','Public file metadata')}${ext('https://docs.scummvm.org/en/latest/other_platforms/playstation_portable.html','ScummVM PSP instructions')}${ext('https://github.com/PSP-Archive/ARK-4/wiki/cIPL','ARK-4 permanent cIPL reference')}</div>`);
  page(route,'PSP Homebrew & Themes','Native EBOOT.PBP apps, homebrew games, emulators and PSP themes, with ARK-4 setup, exact storage paths and pinned ready-to-use files.','/assets/images/psp-more/ark4.png',[
    ['/console/retro/','Retro consoles'],['#start','PSP setup'],['#library','Downloads'],['#theme-setup','Theme setup'],['/console/psvita/','PS Vita']
  ],body,'#library','Browse PSP downloads');
  const output = path.join(root,route);
  let html = fs.readFileSync(output,'utf8').replace('</head>','<link rel="stylesheet" href="/assets/psp-more.css?v=1">\n</head>').replace('class="guide-hero-grid"','class="guide-hero-grid guide-hero-text"').replace(/<img src="\/assets\/images\/psp-more\/ark4\.png" alt="PSP Homebrew &amp; Themes" width="1280" height="720">/,'');
  html = html.replace('class="no-results" hidden','class="no-results" style="display:none"');
  // Custom styles/hero changes must precede the shared metadata/search pass.
  const prepared = require('./apply-site-background.cjs').improve(html,route);
  fs.writeFileSync(output,require('./search-page-output.cjs').finish(route,prepared));
  console.log(`Built ${route}: ${native.length} native PSP homebrew titles; ${data.items.length} catalogue entries.`);
}
module.exports = {buildPspMore};
if (require.main === module) buildPspMore();
