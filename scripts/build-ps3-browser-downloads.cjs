const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
const catalog = require('./build-ps3-catalog.cjs');
const {esc} = require('./build-console-guides.cjs');
const h = value => esc(String(value ?? ''));
const encodedPath = value => value.split('/').map(segment=>{
  try{return encodeURIComponent(decodeURIComponent(segment));}catch{return encodeURIComponent(segment);}
}).join('/');
function collect() {
  const rows = [], seen = new Set();
  const appEvidence = JSON.parse(fs.readFileSync(path.join(root,'docs/ps3-apps-source-evidence.json'),'utf8'));
  const resources = [...catalog.data().resources,...appEvidence.apps,...catalog.data().apps || []];
  function add(file, owner, resource) {
    const name = catalog.filename(file);
    if (/^(?:\._|\.DS_Store$)/i.test(name)||/(?:^|[\\/])__MACOSX(?:[\\/]|$)/i.test(file.memberPath||'')) return;
    const role = JSON.stringify(file.archiveRole || owner.archiveRole || file.role || '');
    if (!catalog.localFile(file) || file.readiness === 'invalid-console-header' || /Helpers|Windows|Source Code|Development|Metadata/i.test(role) || owner.readiness === 'incomplete' || resource?.category === 'rtm' || resource?.readiness === 'incomplete' || /\.exe$|\.dll$|\.msi$|\.apk$|\.vpk$|source|windows|desktop/i.test(name)) return;
    if (!/\.(?:pkg|sprx|prx|zip|rar|7z|gsc|csc|gscc|bin|rpf|edat|img|sco|sc3|ini|cfg|xml|dat|ctd|key|dds|txt|ff)$/i.test(name)) return;
    if (seen.has(file.local)) return;
    seen.add(file.local);
    rows.push({id:owner.id,name:resource?.name || owner.title || name,filename:name,memberPath:file.memberPath || null,local:file.local,bytes:file.bytes,sha256:file.sha256,version:file.version || file.releaseTag || owner.release || resource?.version || 'Archived build',gameId:resource?.gameId || null,category:/\.pkg$/i.test(name)?'packages':/\.(?:rar|zip|7z)$/i.test(name)?'archives':'mods',compatibility:resource?.compatibility || owner.compatibility || 'Check the project’s PS3 requirements.',source:owner.url || resource?.source || '',page:resource?.gameId ? catalog.games.find(game=>game.id===resource.gameId)?.url+'#'+resource.id : resource ? '/console/ps3/apps.html#file-archive-apps' : '/console/ps3/apps.html'});
  }
  for (const owner of catalog.inventory()) {
    const resource = resources.find(item => owner.resourceId === item.id || owner.id === item.id || (item.downloads || []).some(download=>download.url===owner.url));
    for (const file of owner.files || []) add(file,owner,resource);
  }
  // Existing pinned PS3 apps remain available alongside newly archived versions.
  const apps = JSON.parse(fs.readFileSync(path.join(root,'docs/expansion-ps3.json'),'utf8')).apps;
  const audit = JSON.parse(fs.readFileSync(path.join(root,'docs/download-audit.json'),'utf8'));
  for (const app of apps) {
    if (!app.url?.startsWith('/downloads/')) continue;
    for (const owner of audit.items) for (const file of owner.files || []) if (file.local === app.url) add(file,{...owner,title:app.title,compatibility:app.description});
  }
  return rows.sort((a,b)=>a.category.localeCompare(b.category)||a.name.localeCompare(b.name)||a.filename.localeCompare(b.filename));
}
function build() {
  const files = collect();
  const groups = [['packages','PS3 PKG packages'],['mods','Console mod files'],['archives','Original mod archives · extract first']];
  const list = groups.map(([id,title])=>`<h2 id="${id}">${title}</h2><ul class="files">${files.filter(file=>file.category===id).map(file=>`<li><h3>${h(file.name)}</h3><p data-i18n-skip translate="no">${h(file.filename)} · ${catalog.bytes(file.bytes)} · ${h(file.version)}</p>${file.memberPath?`<p><strong>Build / region path:</strong> <span data-i18n-skip translate="no">${h(file.memberPath.replaceAll('\\',' / '))}</span></p>`:''}<p>${h(file.compatibility)}</p><p><a href="${h(file.local)}" download>Download file</a> &nbsp; <a data-webman-file="${h(file.local)}" href="http://127.0.0.1/xmb.ps3/download.ps3?url=${'https://whatwhatboy.com'+encodedPath(file.local)}">Save with webMAN</a> &nbsp; <a href="${h(file.page)}" target="_blank" rel="noopener noreferrer">Requirements</a></p><p class="hash" data-i18n-skip translate="no">SHA-256 ${h(file.sha256)}</p></li>`).join('') || '<li>No archived files in this group.</li>'}</ul>`).join('');
  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><title>PS3 Console File List | whatwhatboy</title><meta name="description" content="Lightweight PS3-only homebrew and game-mod downloads, file sizes, SHA-256 hashes and optional webMAN download links."><meta name="keywords" content="PS3 browser downloads, PS3 PKG, SPRX, webMAN MOD, HEN, CFW, GTA V 1.27"><link rel="canonical" href="https://whatwhatboy.com/console/ps3/browser-downloads.html"><link rel="icon" href="/assets/images/logo.png"><link rel="stylesheet" href="/assets/ps3-browser-downloads.css?v=1"><script defer src="/languages/i18n.js?v=3"></script></head>
<body><main><p class="brand">whatwhatboy / PLAYSTATION 3</p><h1>PS3 console file list</h1><p>${files.length} PS3 files. Plain links work without JavaScript. Packages, game files and archives remain separate.</p><nav><a href="/console/ps3/">PS3 hub</a><a href="/console/ps3/mods.html" target="_blank" rel="noopener noreferrer">Game mods</a><a href="#packages">PKG</a><a href="#mods">Mod files</a><a href="#archives">Archives</a><a href="/console/ps3/desktop-tools.html">PC helpers</a></nav>
<div class="notice"><p><strong>Download is the first step.</strong> A PKG still needs installation through the supported PS3 environment. An SPRX needs its game-specific loader and destination. ZIP/RAR/7z files need extraction. These files do not establish compatibility with an unmodified PS3.</p><p>Modern HTTPS or file hosts may fail in the PS3 browser. Use a direct file URL from your own HTTP LAN server, USB/FTP, or a compatible PS3 file client. Keep the original archives and readmes.</p></div>
<p><strong>Large PKGs in your local archive:</strong> the PS3-only LAN archive server offers direct downloads of larger builds such as the GTA IV texture installer and Uncharted installer. <a href="/console/ps3/archive-server.html">Set up archive downloads over HTTP</a>.</p>
<h2>Optional webMAN download links</h2><p>Requires webMAN MOD already running on the PS3. These links save to <code>/dev_hdd0/packages</code>; they do not install, extract or launch files. From the PS3, use <code>127.0.0.1</code>. From another device, enter the PS3’s LAN IP.</p>
<form id="ps3DownloadForm"><p><label for="ps3Host">PS3 address (no port or path)</label><input id="ps3Host" value="127.0.0.1" type="text"></p><p><label for="ps3FileBase">File server URL (this site or your HTTP LAN server)</label><input id="ps3FileBase" type="text" placeholder="http://192.168.1.20:8765"></p><button type="submit">Prepare links</button><p id="ps3LinkStatus" role="status">JavaScript is optional. Set the addresses before using a webMAN link.</p></form>
<p><a href="https://github.com/aldostools/webMAN-MOD/wiki/Web-Commands">webMAN command documentation</a> · <a href="/downloads/ps3/catalog.json" download>File inventory &amp; checksums</a></p>
${list}<footer>Reviewed 2 November 2026. Files were archived and inspected without execution. Hardware installation and execution have not been tested.</footer></main><script src="/assets/ps3-browser-downloads.js?v=1"></script></body></html>`;
  fs.mkdirSync(path.join(root,'downloads/ps3'),{recursive:true});
  fs.writeFileSync(path.join(root,'downloads/ps3/catalog.json'),JSON.stringify({reviewed:'2026-11-02',platform:'PS3',files},null,2)+'\n');
  const route='console/ps3/browser-downloads.html';
  const background=require('./apply-site-background.cjs').improve(html,route);
  fs.writeFileSync(path.join(root,route),require('./search-page-output.cjs').finish(route,require('./apply-mobile-layout.cjs').improve(background)));
  console.log(`Built lightweight PS3 console file list: ${files.length} files.`);
}
module.exports = {collect,build};
if(require.main===module)build();
