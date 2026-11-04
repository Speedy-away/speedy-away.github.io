#!/usr/bin/env node
'use strict';
// Package curated public host files only. Never execute a downloaded payload.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const {MAX_GIT_BYTES,releaseInfo,markLocalOnly}=require('./sender-release-delivery.cjs');
const {staticPath, loadActions, localFileFor} = require('./console-payload-bridge.cjs');
const {destinationForFile} = require('./download-archive-layout.cjs');

const ROOT = path.resolve(__dirname, '..');
const BACKUP = path.resolve('F:/whatsite-backup-downloads-etc');
const OUT = 'downloads/helpers/console-payload-sender';
const VERSION = '2.1.0';
const PREFIX = 'whatwhatboy-console-payload-sender/';
const ORIGIN = fs.existsSync(path.join(ROOT,'docs/migration/status.json')) ? 'https://speedy-away.github.io/wwb-host' : 'https://whatwhatboy.com';
const CATALOGUES = ['docs/host-actions-ps4.json', 'docs/host-actions-ps5.json', 'docs/host-game-actions.json', 'docs/host-modern-plugin-actions.json', 'docs/host-current-cheat-actions.json', 'docs/host-legacy-menu-actions.json', 'docs/host-extra-game-actions.json', 'docs/host-native-payload-actions.json', 'docs/host-web-utility-actions.json', 'docs/host-repository-menu-actions.json', 'docs/host-original-tool-actions.json', 'docs/host-legacy-firmware-menu-actions.json', 'docs/host-next-utility-actions.json', 'docs/host-gta505-continuation-actions.json', 'docs/host-arabicguy-672-actions.json'];
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const slash = value => value.split(path.sep).join('/');
function contained(base, target) {
  const relative = path.relative(path.resolve(base), path.resolve(target));
  if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) throw Error('Path is outside its intended directory: ' + target);
}
function readPublic(relative, root) {
  if (relative.startsWith('/') || relative.split('/').some(p => p === '..' || p === '.') || /[\x00-\x1f\\]/.test(relative)) throw Error('Invalid bundle path: ' + relative);
  const file = fs.realpathSync(path.join(root, relative));
  contained(root, file);
  if (!fs.statSync(file).isFile()) throw Error('Not a file: ' + relative);
  return fs.readFileSync(file);
}
function localReference(value, from) {
  if (!value || /^(?:[a-z]+:|\/\/|#)/i.test(value)) return null;
  const clean = value.replace(/[?#].*$/, '');
  if (!clean) return null;
  const relative = clean.startsWith('/') ? clean.slice(1) : path.posix.normalize(path.posix.join(path.posix.dirname(from), clean));
  return relative;
}
function references(text, from) {
  const values = [];
  const patterns = from.endsWith('.js')
    ? [/["'](\/(?:assets|languages)\/[^"'\s?#]+\.(?:css|js|svg|png|jpe?g|webp|ico))(?:[?#][^"']*)?["']/gi]
    : [/(?:src|href|poster)\s*=\s*["']([^"']+)["']/gi, /url\(\s*["']?([^\s)'";]+)["']?\s*\)/gi];
  for (const pattern of patterns) {
    for (const m of text.matchAll(pattern)) {
      const relative = localReference(m[1], from);
      if (relative && /^(?:assets\/|languages\/|style\.css$|script\.js$)/.test(relative)) values.push(relative);
    }
  }
  return values;
}
function packagedHTML(text) {
  // Public browser runtimes remain outside the loopback helper. Only their
  // presentation URLs change; run contracts and local payload URLs stay pinned.
  if (!['https://speedy-away.github.io/wwb-host','https://speedy-away.github.io/WWB-HOST','https://whatwhatboy.com'].includes(ORIGIN)) throw Error('Unknown public host origin');
  function publicURL(value) {
    if (typeof value !== 'string' || !value.startsWith('/')) return value;
    if (value.startsWith('//') || /[\\\x00-\x20]/.test(value) || /%(?:2e|2f|5c)/i.test(value) || value.split(/[?#]/)[0].split('/').some(part=>part==='.'||part==='..')) throw Error('Invalid public host route');
    return ORIGIN + value;
  }
  const marker='<meta name="whatwhatboy-public-host" content="'+ORIGIN+'">';
  text=text.replace(/<meta\b[^>]*\bname=['"]whatwhatboy-public-host['"][^>]*>/gi,'');
  text=/<head\b[^>]*>/i.test(text)?text.replace(/<head\b[^>]*>/i,head=>head+marker):marker+text;
  text=text.replace(/(<script\b[^>]*\bid="host-actions-data"[^>]*>)([\s\S]*?)(<\/script>)/gi,(whole,open,json,close)=>{
    const catalogue=JSON.parse(json);
    for(const action of catalogue.actions||[]){
      if(action.localLauncher)for(const key of ['launchURL','instructionsURL'])if(action[key])action[key]=publicURL(action[key]);
      if(!action.run&&(/^\/hosts\/runtime\//.test(action.downloadURL||'')||action.downloadOnDevice&&/^\/downloads\//.test(action.downloadURL||'')))action.downloadURL=publicURL(action.downloadURL);
    }
    return open+JSON.stringify(catalogue).replace(/</g,'\\u003c')+close;
  });
  return text.replace(/href=(['"])(\/[^'"]*)\1/g, (whole, quote, target) => {
    const pathname = target.replace(/[?#].*$/, '');
    return staticPath(pathname) || /^\/downloads\/.+\.(?:elf|bin)$/i.test(pathname) ? whole : 'href=' + quote + publicURL(target) + quote;
  });
}
function startupCMD() {
  return '@echo off\r\nsetlocal\r\ncd /d "%~dp0"\r\nwhere node >nul 2>nul\r\nif errorlevel 1 (\r\n  echo Install Node.js 20 or newer from https://nodejs.org/ and try again.\r\n  pause\r\n  exit /b 1\r\n)\r\nnode -e "process.exit(Math.max(0,20-Number(process.versions.node.split(\'.\')[0])))"\r\nif errorlevel 1 (\r\n  echo Node.js 20 or newer is required.\r\n  pause\r\n  exit /b 1\r\n)\r\necho Open the localhost URL printed below in this computer\'s browser.\r\necho Keep this window open; press Ctrl+C to stop the sender.\r\nnode "%~dp0scripts\\console-payload-bridge.cjs"\r\nif errorlevel 1 pause\r\n';
}
function quickstart() {
  return '# whatwhatboy console payload sender\n\n' +
    'Extract this entire ZIP into a new folder. Keep scripts/, assets/, docs/, hosts/ and downloads/ beside this README. Do not run the ZIP in place.\n\n' +
    '1. Install Node.js 20 or newer from https://nodejs.org/. Node is not included.\n' +
    '2. On Windows, double-click "Start Sender.cmd". On macOS/Linux, open a terminal in this folder and run `node scripts/console-payload-bridge.cjs`.\n' +
    '3. Open http://127.0.0.1:8766/hosts/ on this computer. Enter the fresh pairing token printed in the terminal.\n' +
    '4. Choose PS4 or PS5, enter the console LAN IPv4 address, and select its exact firmware and game update. Start the compatible console loader separately, then choose Load for one compatible payload.\n' +
    '5. Keep the sender running while using it. Ctrl+C stops it.\n\n' +
    'The server binds only 127.0.0.1; it cannot be opened from a console browser. This computer and the console must reach each other on the same LAN. No payload runs merely by starting the helper or opening its dashboard. A new token is generated each launch and is never stored in this ZIP.\n\n' +
    'Run sends a curated, checksum-verified BIN to an already running PS4 GoldHEN HTTP loader on 9090, an explicitly marked PS4 BIN to its already waiting TCP 9020 listener, or an ELF to an already running compatible PS4/PS5 TCP loader on 9021. TCP 9020 uses one connection with exact bytes and EOF, without a readiness probe or automatic retry. Transfer acceptance is not proof of successful execution. This helper does not jailbreak the console, create console folders, install PKGs or extract archives.\n\n' +
    'Original-only selected-file BIN actions require Download from the original author, then Load and selection of the exact local BIN. Browser and paired sender verify its size and SHA-256 in memory before fixed PS4 TCP9020 or GoldHEN HTTP9090 transfer. No selected binary is bundled or saved by the sender. Use Download separately for a console copy; turn off copy-on-Load for these actions. The four earlier GamerHack menu variants retain disabled Load because their standalone ABI is not established. See docs/host-original-tool-loading.md.\n\n' +
    'Built-in browser runtimes are public-site features and must be opened directly on a matching console. They are not included in this loopback-only desktop helper. Other hosts stay under a separate collapsed directory and retain accurately labelled external links. Public-site navigation and externally hosted fonts/icons require Internet. Local payload transfers use the files bundled here. Firmware/game compatibility remains pinned in the catalogue.\n\n' +
    'Every mod menu uses one card and a Choose version popup with version buttons, including single-build entries. Match the separate game update, menu release and original host variant before choosing Download or Load. Selecting a build does not send anything. Unknown menu versions are not inferred from game updates. Unsupported plugin/cheat/source-host-only Load methods stay disabled with their real requirements.\n\n' +
    'Download uses the configured console receiver, or the viewing device when no console address is set. Its destination is shown beside the actions. The receiver checks its queue and chosen storage before saving; opening it submits no download. Use receiver2026.11.02.15 or newer for current exact file IDs. An invalid destination or missing file is reported without silently downloading another file or switching devices.\n\n' +
    'The optional copy-on-Load checkbox uses that same exact-file destination during the original click. It does not silently save to the computer or trigger another copy after the loader responds.\n\n' +
    'Protocol2 Check services reads the loader/manager, downloader queue and standard file-manager pages through fixed, bounded GET requests. A queue count does not verify the installed companion or storage. No generic TCP9020/9021 readiness probe is made.\n\n' +
    'If an executing request times out or loses its acknowledgement, the result is uncertain. Check the console before clearing its saved transfer warning. The dashboard locks further Load actions for that address across reloads until you explicitly clear the warning; clearing never sends or retries a payload. Other console addresses retain their own state.\n\n' +
    'GTA5, RDR2 and Other games have separate pages. File manager and Payload manager also have separate pages. Install the bundled authored native workspace HTML at its displayed console path to browse/upload payloads and edit the actual autoload file with verified backups. Native operations require ezRemote Client at its own origin; the public/desktop preview stays read-only. PS4 uses GoldHEN LaunchPad/AutoRun; PS5 also provides native Payload Manager8084 controls. A queue-file edit does not prove live autoload settings applied. File-manager links target the entered console address; loopback is reserved for the matching console browser.\n\n' +
    'Read docs/host-payload-sender.md, docs/host-console-services.md and docs/host-payload-management.md for detailed setup and limits. bundle-manifest.json lists included files, sizes and SHA-256 hashes; THIRD-PARTY.txt retains payload license/source attribution.\n';
}
function collectFiles(root = ROOT) {
  root = fs.realpathSync(root);
  const files = new Map(), queue = [];
  const add = (relative, data, scan = false) => {
    if (files.has(relative)) return;
    data = data || readPublic(relative, root);
    if (relative.endsWith('.html')) data = Buffer.from(packagedHTML(data.toString('utf8')));
    files.set(relative, data);
    if (scan && /\.(?:html|css|js)$/.test(relative)) queue.push(relative);
  };
  for (const relative of ['hosts/index.html', 'hosts/ps4/index.html', 'hosts/ps5/index.html', 'hosts/ps4/payload-manager/index.html', 'hosts/ps5/payload-manager/index.html', ...['ps4','ps5'].flatMap(platform=>['files','gta5','rdr2','other-games','lua','packages',...(platform==='ps4'?['cheats']:[])].map(scope=>'hosts/'+platform+'/'+scope+'/index.html')), 'style.css', 'script.js', 'assets/host-console-client.js', 'assets/host-dashboard.js', 'scripts/console-payload-bridge.cjs', 'docs/host-console-services.md', 'docs/host-payload-sender.md', 'docs/host-payload-management.md', 'docs/host-native-workspace.md', 'docs/host-dashboard.md', 'docs/host-extra-game-trainers.md', 'docs/host-original-tool-loading.md', 'docs/host-next-batch.md', 'docs/host-gta505-continuation.md', 'docs/host-reviews/ps4/6.72/arabicguy/README.md', 'docs/screenshots/host-next-batch-oysters.png', ...CATALOGUES]) add(relative, null, true);
  function addToolDirectory(relative){for(const entry of fs.readdirSync(path.join(root,relative),{withFileTypes:true})){const name=relative+'/'+entry.name;if(entry.isDirectory())addToolDirectory(name);else if(/\.(?:html|json|js|txt|md|svg)$/.test(name)){if(!staticPath('/'+name))throw Error('Tooloutsideallowlist '+name);add(name,null,true);}}}
  for(const tool of ['ps4-trainer','esp-flasher'])addToolDirectory('hosts/tools/'+tool);
  for(const record of Object.values(JSON.parse(readPublic('hosts/tools/ps4-trainer/tile-art.json',root)).covers||{}))add(record.image.replace(/^\//,''));
  for(const name of ['games','updates','payloads','loaders','tools','files'])add('assets/images/host-catalog/'+name+'.svg');
  const installers=JSON.parse(readPublic('docs/host-package-installer-build.json',root)).artifacts||[];
  for(const item of installers){const relative=item.downloadURL.slice(1),data=readPublic(relative,root);if(!staticPath('/'+relative)||sha(data)!==item.sha256||data.length!==item.bytes)throw Error('Installerartifactchanged');add(relative,data);}
  const workspaces = JSON.parse(readPublic('docs/host-native-workspace-build.json',root)).artifacts || [];
  for (const workspace of workspaces) {
    const relative = workspace.downloadURL.slice(1);
    const bytes = readPublic(relative,root);
    if (!staticPath('/'+relative) || sha(bytes) !== workspace.sha256 || bytes.length !== workspace.bytes) throw Error('Native workspace artifact mismatch');
    add(relative,bytes);
  }
  for (const [name,bytes] of [...files]) if (name.endsWith('.html')) {
    const match = bytes.toString('utf8').match(/<script id="host-actions-data" type="application\/json">([\s\S]*?)<\/script>/);
    if (match) for (const action of JSON.parse(match[1]).actions) if (/^\/assets\/images\//.test(action.image || '')) add(action.image.slice(1));
  }
  for (const name of fs.readdirSync(path.join(root, 'languages')).filter(name => /^[a-z-]+\.js$/i.test(name))) add('languages/' + name, null, true);
  const actions = loadActions(root), payloads = [];
  for (const action of actions) {
    if (action.image && action.image.startsWith('/assets/images/')) add(action.image.slice(1));
    if (!action.downloadURL || !action.downloadURL.startsWith('/downloads/')) continue;
    const item = localFileFor(action, root, {forRun:false}), bytes = fs.readFileSync(item.file);
    if (sha(bytes) !== action.sha256.toLowerCase()) throw Error('Payload checksum mismatch: ' + action.id);
    if (Number.isSafeInteger(action.bytes) && bytes.length !== action.bytes) throw Error('Payload size mismatch: ' + action.id);
    add(decodeURIComponent(action.downloadURL.slice(1)), bytes);
    payloads.push({id:action.id,platform:action.platform,name:path.basename(item.file),bytes:bytes.length,sha256:sha(bytes),source:action.sourceURL || action.source,version:action.version || action.menuVersion || action.gameVersion || 'Pinned catalogue build',license:action.license || 'See upstream source attribution'});
  }
  for (let i = 0; i < queue.length; i++) {
    const relative = queue[i];
    for (const dependency of references(files.get(relative).toString('utf8'), relative)) {
      if (!staticPath('/' + dependency)) throw Error('An asset dependency from ' + relative + ' is outside the sender serving allowlist: ' + dependency);
      add(dependency, null, true);
    }
  }
  add('Start Sender.cmd', Buffer.from(startupCMD()));
  add('README.md', Buffer.from(quickstart()));
  add('THIRD-PARTY.txt', Buffer.from('Payload/source attribution for this pinned bundle. No new third-party license is asserted by packaging.\n\n' + payloads.map(p => `${p.platform.toUpperCase()} / ${p.name}\nVersion: ${p.version}\nSHA-256: ${p.sha256}\nLicense: ${p.license}\nUpstream: ${p.source}\n`).join('\n')));
  return {files, actions, payloads};
}
// Small deterministic ZIP writer using only Node standard-library modules.
// Files have a fixed DOS timestamp; immutable snapshots are named by content.
const crcTable = Array.from({length:256}, (_, n) => { for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ n >>> 1 : n >>> 1; return n >>> 0; });
function crc32(bytes) { let crc = 0xffffffff; for (const b of bytes) crc = crcTable[(crc ^ b) & 255] ^ crc >>> 8; return (crc ^ 0xffffffff) >>> 0; }
function zip(files, {prefix = PREFIX} = {}) {
  const chunks = [], central = []; let offset = 0;
  for (const [relative, data] of [...files].sort(([a],[b]) => a.localeCompare(b))) {
    const name = Buffer.from(prefix + relative), packed = zlib.deflateRawSync(data, {level:9}), crc = crc32(data);
    const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50); h.writeUInt16LE(20,4); h.writeUInt16LE(0x0800,6); h.writeUInt16LE(8,8); h.writeUInt16LE(33,12); h.writeUInt32LE(crc,14); h.writeUInt32LE(packed.length,18); h.writeUInt32LE(data.length,22); h.writeUInt16LE(name.length,26);
    chunks.push(h,name,packed);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50); c.writeUInt16LE(20,4); c.writeUInt16LE(20,6); c.writeUInt16LE(0x0800,8); c.writeUInt16LE(8,10); c.writeUInt16LE(33,14); c.writeUInt32LE(crc,16); c.writeUInt32LE(packed.length,20); c.writeUInt32LE(data.length,24); c.writeUInt16LE(name.length,28); c.writeUInt32LE(offset,42);
    central.push(c,name); offset += h.length + name.length + packed.length;
  }
  const directory = Buffer.concat(central), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(files.size,8); end.writeUInt16LE(files.size,10); end.writeUInt32LE(directory.length,12); end.writeUInt32LE(offset,16);
  return Buffer.concat([...chunks,directory,end]);
}
function preserve(file, bytes, boundary) {
  contained(boundary, file);
  if (fs.existsSync(file)) {
    if (sha(fs.readFileSync(file)) !== sha(bytes)) throw Error('Refusing to replace an existing different file: ' + file);
    return;
  }
  fs.mkdirSync(path.dirname(file), {recursive:true}); fs.writeFileSync(file,bytes,{flag:'wx'});
}
function writePublicIndex(info, root) {
  const mib=(info.bytes/1048576).toFixed(1);
  const html='<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, follow"><meta name="theme-color" content="#0a0a0c"><title>Console Payload Sender | whatwhatboy</title><link rel="canonical" href="'+ORIGIN+'/'+OUT+'/"><script defer src="/languages/i18n.js?v=3"></script><style>body{margin:0;background:#0a0a0c;color:#eee;font:17px/1.6 system-ui,sans-serif}main{max-width:760px;margin:8vh auto;padding:24px}a{color:#65e2bd}h1{line-height:1.15;font-size:clamp(2rem,6vw,3rem)}.download{display:inline-block;padding:12px 20px;border:1px solid #65e2bd;border-radius:8px;text-decoration:none;font-weight:700}code{display:block;overflow-wrap:anywhere;padding:14px;background:#16181a;border-radius:8px;font-size:14px}dt{color:#aaa}dd{margin:0 0 15px}</style></head><body><main><a href="/hosts/">whatwhatboy hosts</a><h1>Console Payload Sender</h1><p>Download the desktop helper for the PS4 and PS5 host dashboards. Extract the complete ZIP, then start it on a computer on the same local network as your console.</p><p><a class="download" href="'+(info.publicDownloadURL||info.name)+'" download>Download sender ZIP</a></p><dl><dt>Version</dt><dd>'+info.version+'</dd><dt>Download size</dt><dd>'+mib+' MiB ('+info.bytes+' bytes)</dd><dt>SHA-256</dt><dd><code>'+info.sha256+'</code></dd></dl><p>Node.js 20 or newer is required. Windows users can double-click Start Sender.cmd. On macOS/Linux, run the included Node.js command. Starting the helper does not run a payload.</p><p><a href="/docs/host-payload-sender.md">Setup and usage instructions</a> · <a href="manifest.json">Versions and checksums</a></p><p>The sender listens only on this computer. It transfers compatible, checksum-verified files to an already running console loader after you choose Run.</p></main></body></html>\n';
  fs.writeFileSync(path.join(root,OUT,'index.html'),html);
}
function buildPackage(root = ROOT) {
  const {files, actions, payloads} = collectFiles(root);
  const records = [...files].sort(([a],[b]) => a.localeCompare(b)).map(([name,data]) => ({name,bytes:data.length,sha256:sha(data)}));
  const snapshot = sha(JSON.stringify(records));
  const version = VERSION + '+' + snapshot.slice(0,12);
  files.set('bundle-manifest.json', Buffer.from(JSON.stringify({schemaVersion:1,version,snapshot,entryRoot:PREFIX,requirements:'Node.js 20 or newer; same-LAN compatible running console loader',files:records,payloads},null,2)+'\n'));
  const bytes = zip(files), digest = sha(bytes);
  const name = 'console-payload-sender-' + VERSION + '-' + snapshot.slice(0,12) + '.zip';
  const relative = OUT + '/' + name, file = path.join(root,relative);
  preserve(file,bytes,path.join(root,OUT));
  const info = {id:'console-payload-sender-'+snapshot.slice(0,12),name,version,url:'/'+relative,source:ORIGIN+'/'+relative,bytes:bytes.length,sha256:digest,snapshot,files:files.size,payloads:payloads.length,actions:actions.length};
  if(info.bytes>=MAX_GIT_BYTES){Object.assign(info,releaseInfo(info));info.originalSource=info.source;info.source=info.publicDownloadURL;markLocalOnly(info,root);}
  const manifestPath = path.join(root,OUT,'manifest.json');
  const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath,'utf8')) : {schemaVersion:1,files:[]};
  if (!manifest.files.some(f=>f.sha256===digest)) manifest.files.push(info);
  else if(info.publicDownloadURL)Object.assign(manifest.files.find(f=>f.sha256===digest),{publicDownloadURL:info.publicDownloadURL,releaseTag:info.releaseTag});
  manifest.latest = info.url; fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
  // This mutable landing page is deliberately outside collectFiles(), so a
  // dashboard link to it cannot make the bundle's own checksum self-referential.
  writePublicIndex(info,root);
  return {...info,file};
}
function mergeAudit(item, root) {
  // Read the latest inventory after all packaging/archiving I/O. Keep every ID
  // and every older file; do not write a stale whole-inventory snapshot.
  const file = path.join(root,'docs/download-audit.json');
  for (let attempt=0;attempt<4;attempt++) {
    const before = fs.readFileSync(file), current = JSON.parse(before);
    const previous = current.items.find(i=>i.id===item.id);
    if (previous) {
      for (const f of item.files) if (!previous.files.some(p=>p.sha256===f.sha256&&p.name===f.name&&p.backupPath===f.backupPath)) previous.files.push(f);
      previous.status='downloaded';
    } else current.items.push(item);
    current.updated = new Date().toISOString();
    const updated = Buffer.from(JSON.stringify(current,null,2)+'\n');
    if (sha(fs.readFileSync(file)) !== sha(before)) continue;
    fs.writeFileSync(file,updated); return;
  }
  throw Error('The shared download inventory kept changing. The helper ZIP is retained; retry --archive after the other importer finishes.');
}
function archivePackage(info, root = ROOT, backup = BACKUP) {
  const bytes=fs.readFileSync(info.file);
  if (sha(bytes)!==info.sha256) throw Error('The helper ZIP changed before archiving.');
  const at=new Date().toISOString();
  const item={id:info.id,title:'Console Payload Sender desktop helper',project:'Console Payload Sender',platform:'PC',category:['Tools'],kind:'desktop-helper',archiveRole:['Helpers'],release:info.version,url:info.source,sourceUrls:[info.source,ORIGIN+'/hosts/'],pages:['hosts/ps4/index.html','hosts/ps5/index.html'],labels:['Desktop sender ZIP'],status:'downloaded',files:[]};
  const entry={name:info.name,version:info.version,releaseTag:info.version,bytes:info.bytes,sha256:info.sha256,sourceUrl:info.source,resolvedUrl:info.source,local:info.url,archivedAt:at,archiveRole:['Helpers']};
  const target=destinationForFile(backup,item,entry); preserve(target,bytes,backup);
  entry.backupPath=target;entry.archiveAvailability='present';entry.archiveCheckedAt=at; item.files.push(entry);mergeAudit(item,root);
  return target;
}
function main(args=process.argv.slice(2)) {
  if (args.some(a=>!['--check','--build','--archive'].includes(a))) throw Error('Usage: node scripts/package-console-payload-sender.cjs [--check | --build | --archive]');
  if (!args.includes('--build')&&!args.includes('--archive')) {
    const {files,payloads,actions}=collectFiles();
    console.log(JSON.stringify({status:'ready',files:files.size,payloads:payloads.length,actions:actions.length,uncompressedBytes:[...files.values()].reduce((n,b)=>n+b.length,0)}));return;
  }
  const info=buildPackage();
  if(args.includes('--archive')) info.backupPath=archivePackage(info);
  console.log(JSON.stringify(info,null,2));
}
if(require.main===module){try{main();}catch(e){process.stderr.write(e.message+'\n');process.exitCode=1;}}
module.exports={ROOT,VERSION,collectFiles,zip,crc32,buildPackage,archivePackage,packagedHTML,main};
