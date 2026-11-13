'use strict';
const manifest=require('../docs/ps5-web-file-manager.json');
function panel(legacy){
 const [manager,helper]=manifest.assets;
 return `<section class="host-native-workspace ps5-wfm" aria-labelledby="ps5-wfm-title"><span class="host-eyebrow">OWENDSWANG · NATIVE PS5 APP · ${manifest.version}</span><h2 id="ps5-wfm-title">PS5 Web File Manager</h2><p>Browse your console and USB drives. Copy, move, rename, upload and download files in the full native interface.</p><div class="host-manager-actions"><a href="${manager.sourceURL}" data-no-file-options>Download manager ELF · ${manifest.version}</a><a href="/hosts/ps5/?view=tools">Load through payload tools</a></div><ol><li>Load <code>${manager.name}</code> through your compatible PS5 ELF loader (TCP 9021).</li><li>Enter your PS5 address above. Keep the app running, then open its web interface below. You can also use its shortcut in the PS5 Media tab.</li></ol><div class="ps5-wfm-connect"><label for="ps5-wfm-port">Web interface port <input id="ps5-wfm-port" type="number" min="8888" max="65535" value="8888" inputmode="numeric"></label><button type="button" id="ps5-wfm-open">Open PS5 Web File Manager ↗</button></div><p id="ps5-wfm-status" role="status">Default port: 8888. If it is busy, use the next port shown in the console notification.</p><p class="host-note">Requires an already jailbroken PS5 and a compatible ELF loader. File operations run in the console app. This host page does not connect until you choose Open.</p><details class="host-setup"><summary>Archive extraction &amp; optional helper</summary><p>For archive extraction, download the helper and copy it to <code>/data/wfm/wfm-7zip-helper.elf</code>. The manager launches it when needed; do not send it as a standalone payload.</p><a href="${helper.sourceURL}" data-no-file-options>Download 7-Zip helper</a></details><details class="host-setup"><summary>Features &amp; release details</summary><p>Includes multi-select, text editing, file permissions, saved paths, and remote SMB, FTP and WebDAV connections. Version 1.14 notes a ShellUI crash when toggling fullscreen on firmware 11.60; see the release notes for limitations.</p><a href="${manifest.releaseURL}" target="_blank" rel="noopener">Release notes</a> · <a href="${manifest.repository}" target="_blank" rel="noopener">Source &amp; GPL license</a></details><details class="host-setup ps5-wfm-legacy"><summary>Previous file managers &amp; autoload workspace</summary>${legacy.replace('<section class="host-native-workspace">','<div>').replace('</section>','</div>')}<button type="button" data-open-service="websrv-files">Open legacy websrv · port 8080</button></details></section>`;
}
function apply(html){
 if(!html.includes('id="ps5-wfm-title"')){
  const section=/<section class="host-native-workspace">[\s\S]*?<\/section>/;
  if(!section.test(html))throw Error('PS5 workspace boundary missing');
  html=html.replace(section,old=>panel(old));
 }
 if(!html.includes('src="/assets/ps5-web-file-manager.js'))html=html.replace('</body>','<script defer src="/assets/ps5-web-file-manager.js?v=1"></script></body>');
 if(!html.includes('href="/assets/ps5-web-file-manager.css'))html=html.replace('</head>','<link rel="stylesheet" href="/assets/ps5-web-file-manager.css?v=1"></head>');
 return html;
}
module.exports={panel,apply};
