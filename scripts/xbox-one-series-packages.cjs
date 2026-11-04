// Read ZIP-based Xbox UWP release packages without installing or executing them.
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
function zip(buffer) {
  let end = buffer.length - 22;
  while (end >= Math.max(0, buffer.length - 65557) && buffer.readUInt32LE(end) !== 0x06054b50) end--;
  if (end < 0 || buffer.readUInt32LE(end) !== 0x06054b50) throw Error('Missing ZIP directory');
  let count = buffer.readUInt16LE(end + 10), at = buffer.readUInt32LE(end + 16);
  const entries = new Map();
  if (count === 0xffff || at === 0xffffffff) {
    if (buffer.readUInt32LE(end - 20) !== 0x07064b50) throw Error('Missing ZIP64 locator');
    const record = Number(buffer.readBigUInt64LE(end - 12));
    if (buffer.readUInt32LE(record) !== 0x06064b50) throw Error('Missing ZIP64 directory');
    count = Number(buffer.readBigUInt64LE(record + 32));
    at = Number(buffer.readBigUInt64LE(record + 48));
  }
  if (count > 20000) throw Error('Too many ZIP entries');
  for (let i = 0; i < count; i++) {
    if (buffer.readUInt32LE(at) !== 0x02014b50) throw Error('Invalid ZIP directory entry');
    const length = buffer.readUInt16LE(at + 28), extra = buffer.readUInt16LE(at + 30), comment = buffer.readUInt16LE(at + 32);
    const name = buffer.subarray(at + 46, at + 46 + length).toString('utf8');
    const entry = {method: buffer.readUInt16LE(at + 10), compressed: buffer.readUInt32LE(at + 20), bytes: buffer.readUInt32LE(at + 24), offset: buffer.readUInt32LE(at + 42)};
    let extraAt = at + 46 + length;
    const extraEnd = extraAt + extra;
    while (extraAt + 4 <= extraEnd) {
      const type = buffer.readUInt16LE(extraAt), size = buffer.readUInt16LE(extraAt + 2);
      if (type === 1) {
        let valueAt = extraAt + 4;
        for (const key of ['bytes', 'compressed', 'offset']) if (entry[key] === 0xffffffff) {entry[key] = Number(buffer.readBigUInt64LE(valueAt)); valueAt += 8;}
      }
      extraAt += 4 + size;
    }
    entries.set(name, entry);
    at += 46 + length + extra + comment;
  }
  return {names: [...entries.keys()], read(name) {
    const e = entries.get(name);
    if (!e || e.bytes > 512 * 1024 ** 2) throw Error('Missing or oversized ZIP member ' + name);
    if (buffer.readUInt32LE(e.offset) !== 0x04034b50) throw Error('Invalid local ZIP entry');
    const start = e.offset + 30 + buffer.readUInt16LE(e.offset + 26) + buffer.readUInt16LE(e.offset + 28);
    const packed = buffer.subarray(start, start + e.compressed);
    const result = e.method === 0 ? Buffer.from(packed) : e.method === 8 ? zlib.inflateRawSync(packed, {maxOutputLength: e.bytes}) : null;
    if (!result || result.length !== e.bytes) throw Error('Unsupported or damaged ZIP member ' + name);
    return result;
  }};
}
const attrs = text => Object.fromEntries([...text.matchAll(/([\w:]+)="([^"]*)"/g)].map(m => [m[1], m[2]]));
function inspect(buffer, label, depth = 0) {
  if (depth > 2) throw Error('Unexpected package nesting');
  const archive = zip(buffer), packages = [];
  const manifest = archive.names.find(n => n.toLowerCase() === 'appxmanifest.xml');
  if (manifest) {
    const xml = archive.read(manifest).toString('utf8').replace(/^\uFEFF/, '');
    packages.push({member: label, identity: attrs(xml.match(/<Identity\b[^>]*>/)?.[0] || ''), targets: [...xml.matchAll(/<TargetDeviceFamily\b[^>]*>/g)].map(m => attrs(m[0])), dependencies: [...xml.matchAll(/<PackageDependency\b[^>]*>/g)].map(m => attrs(m[0])), framework: /<Framework>true<\/Framework>/i.test(xml), executable: attrs(xml.match(/<Application\b[^>]*>/)?.[0] || '').Executable || null, logo: (xml.match(/Square150x150Logo="([^"]+)"/) || xml.match(/<Logo>([^<]+)<\/Logo>/))?.[1] || null, xml});
  }
  for (const name of archive.names.filter(n => /\.(?:appx|msix|appxbundle|msixbundle)$/i.test(n))) packages.push(...inspect(archive.read(name), label + ' > ' + name, depth + 1));
  return packages;
}
function artwork(buffer, member) {
  const parts = member.split(' > ').slice(1);
  for (const name of parts) buffer = zip(buffer).read(name);
  const archive = zip(buffer);
  const names = archive.names.filter(n => /\.(?:png|jpg|jpeg)$/i.test(n));
  const selected = names.find(n => /Square150x150Logo.*scale-200/i.test(n)) || names.find(n => /Square150x150Logo/i.test(n)) || names.find(n => /(?:StoreLogo|Logo150|flycast150|icon).*\.png$/i.test(n));
  return selected ? {name: selected, buffer: archive.read(selected)} : null;
}
function inspectFile(file) {
  const buffer = fs.readFileSync(file);
  return {name: path.basename(file), bytes: buffer.length, sha256: crypto.createHash('sha256').update(buffer).digest('hex'), packages: inspect(buffer, path.basename(file))};
}
if (require.main === module) {
  const directory = path.resolve(__dirname, '../tmp/xbox-one-series');
  const result = fs.readdirSync(directory).filter(n => /\.(?:zip|appx|msix|msixbundle)$/i.test(n)).map(n => inspectFile(path.join(directory, n)));
  fs.mkdirSync(path.resolve(__dirname, '../docs/qa'), {recursive:true});
  fs.writeFileSync(path.resolve(__dirname, '../docs/qa/xbox-one-series-staging-inspection.json'), JSON.stringify({reviewed: '2026-11-02', method: 'Static ZIP/manifest inspection only; no builds executed', files: result}, null, 2) + '\n');
  console.log(JSON.stringify(result.map(f => ({...f, packages: f.packages.map(({xml, ...p}) => p)})), null, 2));
}
module.exports = {zip, inspect, inspectFile, artwork};
