'use strict';
// Add only this reviewed batch. Read/copy bytes; never evaluate downloaded code.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const read = name => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
function prepare() {
  const catalogue = read('docs/console-download-catalog.json').items;
  const entry = catalogue.find(item => item.id === 'goldhen-2-3-9-00');
  if (!entry || entry.sha256 !== 'c9b8f33d28258af9e80465da591868dada25a1454f30f63882668d5e0dcff9c2') throw Error('The existing pinned GoldHEN 2.3 build changed.');
  const saved = read('docs/download-audit.json').items.flatMap(item => item.files || []).find(file => file.name === entry.filename && file.sha256 === entry.sha256 && file.backupPath);
  if (!saved) throw Error('Existing GoldHEN archive record unavailable.');
  const bytes = fs.readFileSync(saved.backupPath);
  if (bytes.length !== entry.bytes || sha(bytes) !== entry.sha256) throw Error('Existing GoldHEN archive bytes differ.');
  const local = '/downloads/hosts/ps4/goldhen/2.3-firmware-9.00/' + entry.filename;
  const target = path.join(root, local);
  if (fs.existsSync(target)) {
    if (sha(fs.readFileSync(target)) !== entry.sha256) throw Error('Different public GoldHEN file already exists.');
  } else {
    fs.mkdirSync(path.dirname(target), {recursive:true});
    fs.writeFileSync(target, bytes, {flag:'wx'});
  }
  const filename = path.join(root, 'docs/host-actions-ps4.json');
  const document = read('docs/host-actions-ps4.json');
  const original = document.actions.find(action => action.id === 'gamerhack-g2all');
  if (!original) throw Error('Existing GamerHack action unavailable.');
  Object.assign(original, {
    label:'GamerHack · 5.05 / 5.07 / 7.00–13.52',
    source:'https://github.com/GamerHack/GamerHack.github.io/tree/23c946a7f85f1338ea2b78163e72e0ce9bc82b68',
    sourceCommit:'23c946a7f85f1338ea2b78163e72e0ce9bc82b68',
    sourceReview:'/docs/qa/gamerhack-source-review.json',
    instructionsURL:'/docs/host-repository-review.md',
    notes:'Exact router whitelist preserved. This external host selects separate firmware-specific chains; it is not a built-in whatwhatboy runtime.'
  });
  const raw = read('docs/host-raw13g-action-proposal.json').actions[0];
  raw.source = 'https://github.com/raw13g/raw13g.github.io/tree/' + raw.sourceCommit;
  raw.instructionsURL = '/docs/host-repository-review.md';
  const goldhen = {
    id:'ps4-goldhen-2-3-900-binloader', platform:'ps4', label:'GoldHEN 2.3 · 9.00', category:'payloads',
    format:'BIN', firmwares:['9.00'], version:'2.3', bytes:entry.bytes, sha256:entry.sha256,
    downloadURL:local, consoleFileId:entry.id, source:entry.source, sourceURL:entry.url,
    sourceCommit:'b5a78e1e1f6ecbc2dfdcd63b4bb5446f49e309c9',
    instructionsURL:'/docs/host-repository-review.md', image:entry.image,
    run:{type:'bin-tcp',port:9020,protocolSource:'/hosts/runtime/ps4-900/web/lapse.js'},
    requirements:[
      'PS4 firmware 9.00 only. Start the built-in PSFree / Lapse loader on the console and wait for its BIN listener on TCP 9020.',
      'Connect the paired desktop sender to load this BIN.',
      'This is the existing official GoldHEN 2.3 build, also byte-identical to GamerHack’s 9.00 copy. It does not provide features introduced in newer GoldHEN releases.',
      'TCP delivery confirms a transfer only. Check the console for successful GoldHEN execution before sending another payload.'
    ],
    license:'Official compiled GoldHEN release; no open-source license is asserted. Original publisher attribution and exact bytes retained.',
    tags:['PS4','9.00','GoldHEN','2.3','BIN','TCP 9020','PSFree','Lapse','GamerHack','ready-to-use'],
    provenance:{review:'/docs/qa/gamerhack-source-review.json',sameBytesAs:'https://raw.githubusercontent.com/GamerHack/GamerHack.github.io/23c946a7f85f1338ea2b78163e72e0ce9bc82b68/900v3/goldhen_2.3.bin',archivePath:saved.backupPath}
  };
  for (const action of [raw, goldhen]) {
    const at = document.actions.findIndex(before => before.id === action.id);
    if (at < 0) document.actions.push(action); else document.actions[at] = action;
  }
  document.updated = '2026-11-02';
  fs.writeFileSync(filename, JSON.stringify(document, null, 2) + '\n');
  return {actions:[original.id,raw.id,goldhen.id],goldhen:{local,sha256:entry.sha256,bytes:bytes.length},newGoldHENDownloads:0};
}
module.exports = {prepare};
if (require.main === module) console.log(JSON.stringify(prepare(), null, 2));
