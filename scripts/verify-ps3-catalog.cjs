// Read-only verification of PS3 pages, their public file list, and preserved archive records.
// Downloaded packages/tools are only opened as bytes for hashing; none are executed.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const backupRoot = 'F:\\whatsite-backup-downloads-etc';
const errors = [];
const warnings = [];
const linksOnly=process.argv.includes('--links-only');
const check = (condition, message) => { if (!condition && !errors.includes(message)) errors.push(message); return condition; };
const relative = filename => path.relative(root, filename).split(path.sep).join('/');
const decode = value => String(value).replace(/&(?:amp|quot|apos|lt|gt|#39|#\d+|#x[\da-f]+);/gi, entity => {
  const named = {'&amp;':'&','&quot;':'"','&apos;':"'",'&lt;':'<','&gt;':'>','&#39;':"'"};
  return named[entity.toLowerCase()] ?? String.fromCodePoint(parseInt(entity.slice(entity[2].toLowerCase() === 'x' ? 3 : 2, -1), entity[2].toLowerCase() === 'x' ? 16 : 10));
});
function readJson(name) {
  try { return JSON.parse(fs.readFileSync(path.join(root, name), 'utf8').replace(/^\uFEFF/, '')); }
  catch (error) { errors.push(`${name}: ${error.message}`); return null; }
}
function walk(dir) {
  return fs.readdirSync(dir, {withFileTypes:true}).flatMap(entry => entry.isDirectory() ? walk(path.join(dir,entry.name)) : [path.join(dir,entry.name)]);
}
function attrs(tag) {
  const values = {};
  for (const [,name,double,single,bare] of tag.matchAll(/\s([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) values[name.toLowerCase()] = decode(double ?? single ?? bare ?? '');
  return values;
}
function inside(base, filename) {
  const rel = path.relative(base, filename);
  return rel !== '..' && !rel.startsWith('..' + path.sep) && !path.isAbsolute(rel);
}
function localTarget(url, from) {
  let resolved;
  try { resolved = new URL(url, 'https://whatwhatboy.com/' + relative(from)); }
  catch { errors.push(`${relative(from)}: invalid URL ${url}`); return null; }
  if (!['whatwhatboy.com','www.whatwhatboy.com'].includes(resolved.hostname) || !['http:','https:'].includes(resolved.protocol)) return null;
  let pathname;
  try { pathname = decodeURIComponent(resolved.pathname); }
  catch { errors.push(`${relative(from)}: invalid escaped path ${url}`); return null; }
  const filename = path.resolve(root, '.' + pathname + (pathname.endsWith('/') ? 'index.html' : ''));
  if (!check(inside(root,filename), `${relative(from)}: URL escapes the site: ${url}`)) return null;
  return {filename, url:resolved};
}
function isPs3(filename) { return relative(filename).startsWith('console/ps3/'); }
const htmlCache = new Map();
function htmlFor(filename) {
  if (htmlCache.has(filename)) return htmlCache.get(filename);
  const html = fs.readFileSync(filename, 'utf8');
  const ids = new Set();
  for (const tag of html.matchAll(/<[a-z][^>]*>/gi)) {
    const id = attrs(tag[0]).id;
    if (id !== undefined) { check(!ids.has(id), `${relative(filename)}: duplicate HTML id ${id}`); ids.add(id); }
  }
  const record = {html,ids};
  htmlCache.set(filename,record);
  return record;
}
function verifyPage(filename) {
  const {html,ids} = htmlFor(filename);
  const name = relative(filename);
  check(/<html\b[^>]*lang="en"/i.test(html),`${name}: missing document language`);
  check(/<title>[^<]+<\/title>/i.test(html),`${name}: missing title`);
  check(/<meta\b[^>]*name="description"[^>]*content="[^\"]+"/i.test(html),`${name}: missing description`);
  check(/<meta\b[^>]*name="keywords"[^>]*content="[^\"]*PS3[^\"]*"/i.test(html),`${name}: missing PS3 search metadata`);
  check(!/<(?:video|iframe|embed)\b/i.test(html),`${name}: embedded video/media is prohibited`);
  for (const match of html.matchAll(/<(?:a|img|script|link|source)\b[^>]*>/gi)) {
    const tag = match[0], a = attrs(tag);
    for (const field of ['href','src']) {
      if (!a[field]) continue;
      const url = a[field];
      if (/^(?:data:|mailto:|tel:|javascript:)/i.test(url)) continue;
      if (/^<a\b/i.test(tag)) check(!/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch|embed\/|shorts\/)|\.(?:mp4|webm|mov)(?:[?#]|$))/i.test(url),`${name}: video link remains: ${url}`);
      const target = localTarget(url,filename);
      if (!target) continue;
      if (!check(fs.existsSync(target.filename) && fs.statSync(target.filename).isFile(),`${name}: missing ${field} target ${url}`)) continue;
      if (target.url.hash && isPs3(target.filename) && target.filename.endsWith('.html')) {
        let fragment;
        try { fragment = decodeURIComponent(target.url.hash.slice(1)); }
        catch { errors.push(`${name}: invalid fragment ${url}`); continue; }
        check(htmlFor(target.filename).ids.has(fragment),`${name}: missing PS3 anchor ${url}`);
      }
      // Every game/category catalogue opens as a full page, including links with a resource fragment.
      if (/^<a\b/i.test(tag) && /^\/console\/ps3\/mods\//.test(target.url.pathname) && target.filename !== filename) {
        check(a.target === '_blank',`${name}: game catalogue link is not a new tab: ${url}`);
        check(a['data-guide-open'] === undefined,`${name}: game catalogue link requests a guide popup: ${url}`);
        check((a.rel || '').split(/\s+/).includes('noopener'),`${name}: new-tab catalogue lacks noopener: ${url}`);
      }
    }
  }
  return ids;
}
function verifyFirmwarePins() {
  const hen = htmlFor(path.join(root,'console/ps3/hen.html')).html;
  const cfw = htmlFor(path.join(root,'console/ps3/cfw.html')).html;
  const jailbreak = htmlFor(path.join(root,'console/ps3/jailbreaks.html')).html;
  check(/HFW\s+4\.93\.1/.test(hen), 'HEN page lost its HFW 4.93.1 pin');
  check(/Evilnat\s+4\.93\s+CFW/.test(cfw), 'CFW page lost its Evilnat 4.93 CFW pin');
  check(/4-93-evilnat-w-cobra-v8-5-cex-pex-d-pex\.39743/.test(cfw), 'CFW page lost its pinned Evilnat release URL');
  check(/https:\/\/darthsternie\.net\/ps3-firmwares\//.test(jailbreak), 'Jailbreak page lost the distinct Darthsternie OFW archive');
  check(/https:\/\/darthsternie\.net\/ps3-cfws\//.test(jailbreak), 'Jailbreak page lost the distinct Darthsternie CFW archive');
  const legacy = fs.readFileSync(path.join(root,'console/ps3.html'),'utf8');
  check(/data-console-migration=["']ps3["']/.test(legacy) && /console-legacy-redirect\.js/.test(legacy),'Legacy /console/ps3.html redirect is no longer present');
}
const hashCache = new Map();
async function digest(filename) {
  if (!hashCache.has(filename)) hashCache.set(filename,(async () => {
    const hash = crypto.createHash('sha256');
    for await (const bytes of fs.createReadStream(filename)) hash.update(bytes);
    return hash.digest('hex');
  })());
  return hashCache.get(filename);
}
async function verifyFile(filename, record, label) {
  if (!check(Number.isSafeInteger(record.bytes) && record.bytes > 0,`${label}: invalid byte count`)) return;
  if (!check(/^[a-f0-9]{64}$/i.test(record.sha256 || ''),`${label}: invalid SHA-256`)) return;
  if (!check(fs.existsSync(filename) && fs.statSync(filename).isFile(),`${label}: missing file ${filename}`)) return;
  if (!check(fs.statSync(filename).size === record.bytes,`${label}: byte count mismatch`)) return;
  if (linksOnly) return;
  try { check((await digest(filename)) === record.sha256.toLowerCase(),`${label}: SHA-256 mismatch`); }
  catch (error) { errors.push(`${label}: cannot hash file: ${error.message}`); }
}
function safeBackup(record, label) {
  const filename = record.backupPath;
  if (!check(typeof filename === 'string' && /^F:[\\/]/i.test(filename || ''),`${label}: missing F: backup path`)) return null;
  const rel = path.win32.relative(backupRoot,path.win32.resolve(filename));
  if (!check(rel && rel !== '..' && !rel.startsWith('..\\') && !path.win32.isAbsolute(rel),`${label}: backup path escapes the authorized archive`)) return null;
  if (fs.existsSync(filename) && fs.existsSync(backupRoot)) check(inside(fs.realpathSync(backupRoot),fs.realpathSync(filename)),`${label}: backup symlink escapes the archive`);
  return filename;
}
function publicValues(value, label) {
  if (typeof value === 'string') check(!/^(?:[a-z]:[\\/]|\\\\)/i.test(value),`${label}: machine path leaked into public data`);
  else if (Array.isArray(value)) value.forEach((entry,index)=>publicValues(entry,`${label}[${index}]`));
  else if (value && typeof value === 'object') Object.entries(value).forEach(([key,entry])=>publicValues(entry,`${label}.${key}`));
}
async function main() {
  const pageDir = path.join(root,'console/ps3');
  if (!check(fs.existsSync(pageDir),'Missing console/ps3 page directory')) return;
  const pages = walk(pageDir).filter(file=>file.endsWith('.html'));
  const required = ['index.html','jailbreaks.html','hen.html','cfw.html','apps.html','transfer-tools.html','downloads.html','mods.html','browser-downloads.html','desktop-tools.html','mods/menus.html','mods/gta-v/index.html','mods/gta-iv/index.html','mods/call-of-duty/index.html','mods/call-of-duty/black-ops-1/index.html','mods/call-of-duty/black-ops-2/index.html','mods/uncharted/index.html'];
  required.forEach(file=>check(fs.existsSync(path.join(pageDir,file)),`Missing generated PS3 page ${file}`));
  pages.forEach(verifyPage);
  if (['hen.html','cfw.html','jailbreaks.html'].every(file=>fs.existsSync(path.join(pageDir,file)))) verifyFirmwarePins();
  const chooser = htmlFor(path.join(pageDir,'mods.html')).html;
  check(/href="\/console\/ps3\/mods\/call-of-duty\/"/.test(chooser),'PS3 chooser lacks its Call of Duty category');
  check(!/<a\b[^>]*href="\/console\/ps3\/mods\/call-of-duty\/[a-z0-9-]+\//.test(chooser),'Individual Call of Duty games were duplicated under the top-level PS3 chooser');

  const resources = require('./build-ps3-catalog.cjs').data();
  const inventory = readJson('docs/ps3-expansion-download-inventory.json');
  const manifest = readJson('downloads/ps3/catalog.json');
  const audit = readJson('docs/download-audit.json');
  const seo = readJson('docs/seo/ps3-resources.json');
  if (!resources || !inventory || !manifest || !audit || !seo) return;
  const items = resources.resources || [];
  const resourceIds = new Set();
  for (const item of items) {
    check(/^[a-z0-9-]+$/.test(item.id || ''),`Invalid resource ID ${item.id}`);
    check(!resourceIds.has(item.id),`Duplicate resource ID ${item.id}`); resourceIds.add(item.id);
    check(Boolean(item.name && item.gameId && item.category && item.compatibility),`${item.id}: incomplete searchable resource metadata`);
    check(/^https?:\/\//.test(item.source || ''),`${item.id}: missing source URL`);
    check(htmlFor(path.join(pageDir,'mods/menus.html')).ids.has(item.id),`${item.id}: absent from the searchable PS3 directory`);
    check(seo.resources?.some(entry=>entry.id===item.id && /ps3/i.test(entry.search)),`${item.id}: absent from PS3 search metadata`);
  }
  for (const game of seo.games || []) {
    const target = localTarget(game.url,path.join(pageDir,'index.html'));
    if (!target || !fs.existsSync(target.filename)) continue;
    for (const item of items.filter(entry=>entry.gameId===game.id || (entry.gameIds || []).includes(game.id))) check(htmlFor(target.filename).ids.has(item.id),`${item.id}: absent from its game catalogue`);
  }

  const allRecords = [...(inventory.items || []),...(audit.items || [])];
  let archiveFiles = 0, publicFiles = 0;
  for (const item of inventory.items || []) {
    check(item.platform === 'PS3',`${item.id}: expansion inventory contains a different platform`);
    check(/^https?:\/\//.test(item.url || ''),`${item.id}: missing source URL`);
    check(Boolean(item.version || item.release),`${item.id}: missing version/Unversioned label`);
    if (item.status !== 'downloaded' && !(item.files || []).length) { check(Boolean(item.error),`${item.id}: unavailable source has no truthful error`); continue; }
    for (const file of item.files || []) {
      const label = `${item.id}/${file.name || file.filename}`;
      const filename = safeBackup(file,label);
      if (filename) await verifyFile(filename,file,'Backup '+label);
      const role = file.archiveRole || item.archiveRole || [];
      if (filename) {
        check(/[\\/]files[\\/]PS3[\\/]/i.test(filename),`${label}: new backup is outside the organized PS3 tree`);
        if (/\.(?:exe|dll|msi)$/i.test(file.name || '')) check(role.includes('Helpers') && role.includes('Windows'),`${label}: desktop executable is not classified as a Windows helper`);
        if (role.includes('Helpers')) check(/[\\/]Helpers[\\/]/i.test(filename),`${label}: helper was stored among console builds`);
        if (role.includes('Source Code')) check(/[\\/]Source Code[\\/]/i.test(filename),`${label}: source was stored among builds/helpers`);
      }
      if (file.local) {
        const target = localTarget(file.local,path.join(pageDir,'index.html'));
        if (check(target && /^\/downloads\//.test(file.local),`${label}: invalid public mirror URL`)) await verifyFile(target.filename,file,'Local '+label);
      }
      archiveFiles++;
    }
  }
  check(manifest.platform === 'PS3','Console file manifest platform is not PS3');
  publicValues(manifest,'catalog');
  const fileUrls = new Set();
  for (const file of manifest.files || []) {
    const label = file.local || file.filename || file.id;
    check(!fileUrls.has(file.local),`Console manifest repeats ${label}`); fileUrls.add(file.local);
    const identity = [file.name,file.filename,file.local,file.platform,file.archiveRole,file.role].flat().filter(Boolean).join(' ');
    check(!/\b(?:APK|Vita|PS4|PS5|Windows|desktop|RTM)\b|\.(?:apk|vpk|exe|msi|dll)\b/i.test(identity),`Incompatible or desktop helper in console manifest: ${label}`);
    check(['packages','mods','archives'].includes(file.category),`Invalid console file category: ${label}`);
    const recordOwner = allRecords.find(item=>(item.files || []).some(record=>record.local===file.local && record.sha256===file.sha256));
    const record = recordOwner?.files.find(record=>record.local===file.local && record.sha256===file.sha256);
    if (!check(Boolean(record),`Console file has no private archive record: ${label}`)) continue;
    check(!/Helpers|Windows|Source Code|Development/i.test(JSON.stringify(record.archiveRole || recordOwner.archiveRole || '')),`Non-console private role leaked into console manifest: ${label}`);
    const sourceResource = items.find(item=>item.id===recordOwner.resourceId || item.id===recordOwner.id || (item.downloads || []).some(download=>download.url===recordOwner.url));
    check(sourceResource?.category !== 'rtm',`RTM resource leaked into console manifest: ${label}`);
    check(sourceResource?.readiness !== 'incomplete',`Incomplete source distribution leaked into console-ready manifest: ${label}`);
    const target = localTarget(file.local,path.join(pageDir,'index.html'));
    if (target) await verifyFile(target.filename,file,'Public '+label);
    const backup = safeBackup(record,label);
    if (backup) await verifyFile(backup,file,'Public backup '+label);
    check(Boolean(file.version && file.source),`Console file lacks version or source metadata: ${label}`);
    const page = localTarget(file.page || '',path.join(pageDir,'index.html'));
    if (page) {
      check(isPs3(page.filename),`Console file requirements point outside PS3: ${label}`);
      check(fs.existsSync(page.filename),`Console file has missing requirements page: ${label}`);
      if (fs.existsSync(page.filename) && page.url.hash) check(htmlFor(page.filename).ids.has(decodeURIComponent(page.url.hash.slice(1))),`Console file has missing requirements anchor: ${label}`);
    }
    publicFiles++;
  }
  if (!manifest.files?.length) warnings.push('Console file manifest is empty.');
  console.log(JSON.stringify({mode:linksOnly?'links-metadata-and-sizes':'full-checksums',pages:pages.length,resources:items.length,expansionArchiveFiles:archiveFiles,consoleFiles:publicFiles,hashedFiles:hashCache.size,errors,warnings},null,2));
}
main().then(()=>{
  if (errors.length) { console.error(`PS3 verification failed: ${errors.length} issue(s).`); process.exitCode=1; }
  else console.log(linksOnly?'PS3 catalogue, links, metadata, firmware pins and file sizes verified; hashes were not repeated.':'PS3 catalogue, links, metadata, firmware pins and local/archive checksums verified.');
}).catch(error=>{console.error(error.stack);process.exitCode=1;});
