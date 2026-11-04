// Expose already archived PS5 executables; never download or execute payloads.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function localFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, {withFileTypes: true}).flatMap(entry => entry.isDirectory() ? localFiles(path.join(dir, entry.name)) : entry.isFile() && /\.(elf|bin)$/i.test(entry.name) ? [path.join(dir, entry.name)] : []);
}
function build() {
  const catalogue = JSON.parse(fs.readFileSync(path.join(root, 'docs/console-download-catalog.json'), 'utf8'));
  const existing = require('./build-host-selector.cjs').hostActions('ps5').filter(action => !action.id.startsWith('library-'));
  const seen = new Set(existing.map(action => action.sha256).filter(Boolean));
  const files = localFiles(path.join(root, 'downloads')).concat(localFiles(path.join(root, 'assets/files')));
  const byName = new Map();
  for (const file of files) { const key = path.basename(file).toLowerCase(); if (!byName.has(key)) byName.set(key, []); byName.get(key).push(file); }
  const actions = [], verification = [], skipped = [];
  for (const item of catalogue.items.filter(item => item.platforms.includes('ps5') && item.category !== 'mods' && /\.(elf|bin)$/i.test(item.filename))) {
    if (seen.has(item.sha256)) { verification.push({id:item.id, status:'existing-host-build', sha256:item.sha256}); continue; }
    const candidates = (item.url.startsWith('/') ? [path.join(root, item.url)] : []).concat(byName.get(item.filename.toLowerCase()) || []);
    let selected, bytes;
    for (const candidate of [...new Set(candidates)]) {
      if (!fs.existsSync(candidate) || fs.statSync(candidate).size !== item.bytes) continue;
      const content = fs.readFileSync(candidate);
      if (hash(content) === item.sha256) { selected = candidate; bytes = content; break; }
    }
    if (!selected) { skipped.push({id:item.id, filename:item.filename, reason:'No local mirrored file with the exact catalogue bytes and SHA-256. Original download remains on its existing page.'}); continue; }
    const isELF = bytes.subarray(0, 4).toString('hex') === '7f454c46';
    if (isELF) {
      const checked = require('./verify-host-payloads.cjs').validateELF(bytes);
      assert.equal(checked.issues.length, 0, item.id + ': invalid native ELF');
    }
    const relative = '/' + path.relative(root, selected).replaceAll('\\', '/');
    const runnable = isELF && /\.elf$/i.test(item.filename);
    const action = {id:'library-'+item.id, label:/\bPS5\b|^PS5[A-Z0-9]/i.test(item.name) ? item.name : 'PS5 '+item.name,
      platform:'ps5', category:'payloads', categories:['payloads', 'tools'], version:item.version,
      format:path.extname(item.filename).slice(1).toUpperCase(), bytes:item.bytes, sha256:item.sha256,
      downloadURL:relative, consoleFileId:item.id, image:item.image, imageRole:'Project preview',
      source:item.source, sourceURL:item.url, instructionsURL:item.page, firmwares:[], firmwareScope:'release-specific',
      requirements:[item.compatibility, item.description,
        runnable ? 'Requires a compatible active PS5 ELF loader on TCP 9021. This file is an executable payload, not a game package. Preserve its release-specific prerequisites.' : 'Preserve this release’s BIN filename and use its documented initial loader or native Payload Manager workflow. A generic direct website loading route is not enabled for this BIN.']
        .filter(Boolean),
      run:runnable ? {type:'elf-http',port:9021,protocolSource:'https://github.com/ps5-payload-dev/elfldr/blob/v0.27/socksrv.c'} : null};
    if (item.id === 'fps-ps5-patch-system-38108724867') action.firmwares = ['3.00–12.70'];
    if (/^ps5-theme/.test(item.id)) action.firmwareMax = '13.60';
    actions.push(action); seen.add(item.sha256);
    verification.push({id:item.id,path:relative,bytes:bytes.length,sha256:item.sha256,elf:isELF,status:'verified-existing-local-build'});
  }
  const document = {schemaVersion:1,source:'Existing console download catalogue and exact local file hashes. No upstream version changes or new downloads.',actions};
  fs.writeFileSync(path.join(root,'docs/host-native-payload-actions.json'),JSON.stringify(document,null,2)+'\n');
  const report={checkedAt:new Date().toISOString(),added:actions.length,verification,skipped,newDownloads:0,executed:0};
  fs.writeFileSync(path.join(root,'docs/qa/host-payload-library-build.json'),JSON.stringify(report,null,2)+'\n');
  return report;
}
module.exports={build};
if(require.main===module){const r=build();console.log(JSON.stringify({added:r.added,verified:r.verification.length,skipped:r.skipped},null,2));}
