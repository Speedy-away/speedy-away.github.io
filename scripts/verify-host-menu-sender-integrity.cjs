#!/usr/bin/env node
'use strict';
// Read package bytes as data only. No extraction, server startup or payload execution.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ROOT = path.resolve(__dirname, '..');
const PREFIX = 'whatwhatboy-console-payload-sender/';
const REPORT = 'docs/qa/host-menu-actions-sender-integrity.json';
const CATALOGUES = ['host-actions-ps4', 'host-actions-ps5', 'host-game-actions', 'host-modern-plugin-actions', 'host-current-cheat-actions', 'host-legacy-menu-actions', 'host-extra-game-actions'];
const EXPECTED = {
  '1.4.0+daa01c23011a': {bytes:58643090, sha256:'d355d603da19b48e979f11ede35641dfe376c2b8d3e8c68f5c7b5973acf10266'},
  '1.4.1+4ae2029f9107': {bytes:58643115, sha256:'933eb219f5152adf635ac3c3449b2b23821de76724de22b57009de25dc2dcafd'}
};
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const read = name => JSON.parse(fs.readFileSync(path.join(ROOT, name), 'utf8'));
function inspectZip(bytes, {prefix = PREFIX} = {}) {
  assert.match(prefix, /^[a-z0-9][a-z0-9_-]*\/$/i, 'One safe package-root directory');
  assert.ok(bytes.length <= 128*1024*1024, 'Archive byte bound');
  const end = bytes.lastIndexOf(Buffer.from('504b0506','hex'));
  assert.ok(end >= 0 && end+22 === bytes.length, 'EOCD bounds and no trailing bytes');
  assert.equal(bytes.readUInt16LE(end+4), 0, 'Single ZIP disk');
  assert.equal(bytes.readUInt16LE(end+6), 0, 'Central directory on same disk');
  const count = bytes.readUInt16LE(end+10), size = bytes.readUInt32LE(end+12), start = bytes.readUInt32LE(end+16);
  assert.equal(bytes.readUInt16LE(end+8), count);
  assert.ok(count > 0 && count <= 4096);
  assert.equal(bytes.readUInt16LE(end+20), 0, 'No ZIP comment');
  assert.equal(start+size, end, 'Central directory bounds');
  const entries = new Map(), ranges = [], evidence = [];
  let at = start, expanded = 0;
  for (let n=0; n<count; n++) {
    assert.ok(at+46 <= end);
    assert.equal(bytes.readUInt32LE(at), 0x02014b50, 'Central header signature');
    const flags=bytes.readUInt16LE(at+8), method=bytes.readUInt16LE(at+10), crc=bytes.readUInt32LE(at+16);
    const packed=bytes.readUInt32LE(at+20), size=bytes.readUInt32LE(at+24), nameLength=bytes.readUInt16LE(at+28);
    const extraLength=bytes.readUInt16LE(at+30), commentLength=bytes.readUInt16LE(at+32), local=bytes.readUInt32LE(at+42);
    const nameBytes=bytes.subarray(at+46,at+46+nameLength), name=nameBytes.toString('utf8');
    assert.ok(nameBytes.equals(Buffer.from(name)), 'Valid UTF-8 path');
    assert.ok(name.startsWith(prefix) && !name.endsWith('/') && !/[\\\x00-\x1f]/.test(name));
    assert.ok(!name.split('/').some(part=>part==='..'||part==='.'||part===''), 'Bounded regular member path');
    assert.ok(!entries.has(name), 'No duplicate ZIP member');
    assert.equal(flags, 0x0800, 'UTF-8 only; no encryption or data descriptors');
    assert.equal(method, 8, 'Reviewed deflate method');
    assert.equal(extraLength, 0); assert.equal(commentLength, 0); assert.equal(bytes.readUInt16LE(at+34), 0);
    assert.equal((bytes.readUInt32LE(at+38)>>>16)&0xf000, 0, 'No Unix special member');
    assert.ok(size <= 128*1024*1024 && packed <= 128*1024*1024);
    expanded += size; assert.ok(expanded <= 256*1024*1024, 'Expanded byte bound');
    assert.ok(local+30 <= start);
    assert.equal(bytes.readUInt32LE(local), 0x04034b50, 'Local header signature');
    assert.equal(bytes.readUInt16LE(local+6), flags); assert.equal(bytes.readUInt16LE(local+8), method);
    assert.equal(bytes.readUInt32LE(local+14), crc); assert.equal(bytes.readUInt32LE(local+18), packed); assert.equal(bytes.readUInt32LE(local+22), size);
    assert.equal(bytes.readUInt16LE(local+26), nameLength); assert.equal(bytes.readUInt16LE(local+28), 0);
    assert.ok(bytes.subarray(local+30,local+30+nameLength).equals(nameBytes), 'Central/local member names agree');
    const dataStart=local+30+nameLength, dataEnd=dataStart+packed;
    assert.ok(dataEnd <= start, 'Member remains before central directory');
    const data=zlib.inflateRawSync(bytes.subarray(dataStart,dataEnd), {maxOutputLength:Math.max(1,size+1)});
    assert.equal(data.length, size, 'Expanded member size');
    assert.equal(zlib.crc32(data), crc, 'Member CRC32');
    ranges.push([local,dataEnd]); entries.set(name,data);
    evidence.push({name:name.slice(prefix.length),compressedBytes:packed,bytes:size,crc32:crc.toString(16).padStart(8,'0'),sha256:sha(data)});
    at += 46+nameLength+extraLength+commentLength;
  }
  assert.equal(at, end, 'Exactly parsed central records');
  ranges.sort((a,b)=>a[0]-b[0]); let boundary=0;
  for (const [from,to] of ranges) { assert.equal(from,boundary,'No hidden gaps or overlapping local records'); boundary=to; }
  assert.equal(boundary,start);
  return {entries,evidence,entryCount:count,expandedBytes:expanded};
}
function inspectPackage(info) {
  const publicPath=path.join(ROOT, info.url.slice(1)), bytes=fs.readFileSync(publicPath), expected=EXPECTED[info.version];
  assert.ok(expected); assert.equal(bytes.length,expected.bytes); assert.equal(sha(bytes),expected.sha256);
  assert.equal(info.bytes,expected.bytes); assert.equal(info.sha256,expected.sha256);
  const zip=inspectZip(bytes), member=name=>{const b=zip.entries.get(PREFIX+name); assert.ok(b,'Required member '+name);return b;};
  const manifest=JSON.parse(member('bundle-manifest.json'));
  assert.equal(zip.entryCount,213); assert.equal(manifest.files.length,212); assert.equal(manifest.payloads.length,95);
  assert.equal(manifest.version,info.version); assert.equal(manifest.snapshot,info.snapshot);
  assert.equal(sha(JSON.stringify(manifest.files)),manifest.snapshot,'Manifest record snapshot hash');
  const names=new Set();
  for (const record of manifest.files) { const data=member(record.name); assert.ok(!names.has(record.name)); names.add(record.name); assert.equal(data.length,record.bytes); assert.equal(sha(data),record.sha256); }
  assert.equal(names.size,zip.entries.size-1,'Manifest covers every non-manifest member exactly once');
  const actions=CATALOGUES.flatMap(name=>{const j=JSON.parse(member('docs/'+name+'.json'));return j.actions.map(a=>({...a,platform:a.platform||j.platform}));});
  assert.equal(actions.length,133); assert.equal(new Set(actions.map(a=>a.platform+':'+a.id)).size,133);
  const ready=actions.filter(a=>a.downloadURL?.startsWith('/downloads/'));
  assert.equal(ready.length,95);
  for (const action of ready) {
    const data=member(decodeURIComponent(action.downloadURL.slice(1))), record=manifest.payloads.find(p=>p.id===action.id);
    assert.ok(record); assert.equal(sha(data),action.sha256); assert.equal(data.length,record.bytes); assert.equal(sha(data),record.sha256);
    if(Number.isSafeInteger(action.bytes))assert.equal(data.length,action.bytes);
    assert.equal(record.platform,action.platform);
  }
  const js=member('assets/host-dashboard.js').toString(), bridge=member('scripts/console-payload-bridge.cjs').toString();
  new vm.Script(js,{filename:'packaged-host-dashboard.js'}); // Syntax only; not executed.
  const actionTemplate=js.slice(js.indexOf('function actionMarkup('),js.indexOf('function groupMarkup('));
  const versionTemplate=js.slice(js.indexOf('function openVersions('),js.indexOf('function render()'));
  assert.ok(versionTemplate.includes('<button type="button" data-version-id="'));
  assert.ok(js.includes('data-choose-group="') && js.includes('>Choose version</button>'));
  assert.ok(actionTemplate.includes('data-download-action="') && actionTemplate.includes('download>Download</a>'));
  assert.ok(actionTemplate.includes('data-launch="') && actionTemplate.includes("? 'Load'"));
  assert.ok(!/data-save|Save (?:on|to) PS[45]|Open PS[45] file manager|data-open-service/.test(actionTemplate));
  if(info.version.startsWith('1.4.1'))assert.ok(actionTemplate.includes('data-no-file-options'),'No injected third-party file options on the menu Download control');
  const runtimeActions=[];
  for(const platform of ['ps4','ps5']) {
    const html=member('hosts/'+platform+'/index.html').toString();
    assert.ok(!html.includes('data-host-category="all"'));
    assert.ok(html.includes('id="host-version-choices"') && !html.includes('id="host-version-select"'));
    const embedded=JSON.parse(html.match(/<script id="host-actions-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
    runtimeActions.push(...embedded.actions.filter(a=>a.runtimeId).map(a=>({id:a.id,platform,localRuntimePath:a.launchURL,publicURL:'https://whatwhatboy.com'+a.launchURL})));
  }
  assert.equal(runtimeActions.length,2);
  assert.ok(![...zip.entries.keys()].some(name=>name.startsWith(PREFIX+'hosts/runtime/')),'Browser runtimes not included in desktop ZIP');
  assert.ok(js.includes('/^\\/hosts\\/runtime\\//.test(parsed.pathname)') && js.includes("return 'https://whatwhatboy.com' + parsed.pathname"));
  assert.ok(bridge.includes('<meta name="whatwhatboy-local-sender" content="true">'));
  return {version:info.version,publicPath,bytes:bytes.length,sha256:sha(bytes),zip:{entries:zip.entryCount,expandedBytes:zip.expandedBytes,allCentralLocalSizesAndCRCsVerified:true,memberEvidence:zip.evidence},manifest:{records:manifest.files.length,allMemberSHA256Verified:true,snapshot:manifest.snapshot,payloads:manifest.payloads.length,actions:actions.length},packagedUI:{syntaxParsedOnly:true,versionChoiceButtons:true,noAllCategory:true,noVersionDropdown:true,menuActions:['Download','Load'],noSeparateSaveOrMenuFileManagerControl:true,noInjectedMobileFileOptions:info.version.startsWith('1.4.1'),verificationMethod:'Inspect packaged HTML and action/version template source; no payload execution.'},browserRuntimes:{bundled:false,publicNavigationRewriteVerified:true,actions:runtimeActions}};
}
function main(args=process.argv.slice(2)) {
  assert.ok(args.every(a=>a==='--write-report'));
  const manifest=read('downloads/helpers/console-payload-sender/manifest.json'), audit=read('docs/download-audit.json').items;
  const final=manifest.files.find(f=>f.version==='1.4.1+4ae2029f9107'),interim=manifest.files.find(f=>f.version==='1.4.0+daa01c23011a');
  assert.ok(final&&interim); assert.equal(manifest.latest,final.url);
  const preserved=manifest.files.map(info=>{
    const publicPath=path.join(ROOT,info.url.slice(1)), data=fs.readFileSync(publicPath);
    assert.equal(data.length,info.bytes);assert.equal(sha(data),info.sha256);
    const matches=audit.flatMap(i=>(i.files||[]).filter(f=>f.sha256===info.sha256&&f.backupPath));
    assert.ok(matches.length);
    const backups=matches.map(record=>{const bytes=fs.readFileSync(record.backupPath);assert.equal(bytes.length,info.bytes);assert.equal(sha(bytes),info.sha256);assert.equal(record.bytes,info.bytes);return record.backupPath;});
    return {version:info.version,bytes:info.bytes,sha256:info.sha256,publicPath,backupPaths:backups,publicAndArchiveVerified:true};
  });
  assert.equal(preserved.length,8); assert.equal(preserved.filter(p=>!p.version.startsWith('1.4.')).length,6);
  const report={checkedAt:new Date().toISOString(),status:'passed',method:'Bounded independent ZIP reader using Node standard-library CRC32, inflate and SHA-256; no packager import, extraction, server startup, console contact or downloaded payload execution.',final:inspectPackage(final),interim:inspectPackage(interim),retention:{historicalSnapshotsThrough13:6,allSnapshots:preserved.length,records:preserved},limits:['Static file integrity and UI template verification do not prove physical PS4/PS5 loader execution.','External browser runtimes are opened on the public site and are deliberately absent from the loopback desktop helper.']};
  if(args.includes('--write-report'))fs.writeFileSync(path.join(ROOT,REPORT),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({status:report.status,report:args.includes('--write-report')?REPORT:null,version:report.final.version,zipEntries:report.final.zip.entries,manifestRecords:report.final.manifest.records,readyFiles:report.final.manifest.payloads,actions:report.final.manifest.actions,historicalSnapshots:6,allPublicAndArchiveSnapshots:preserved.length},null,2));
  return report;
}
if(require.main===module)main();
module.exports={inspectZip,inspectPackage,main};
