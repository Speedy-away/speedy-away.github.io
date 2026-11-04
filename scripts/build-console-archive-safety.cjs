// Conservative allowlist for native extraction. This never executes archive contents.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');
const {TextDecoder} = require('node:util');
const root = path.resolve(__dirname, '..');
const sevenZip = process.env.WHATSITE_SEVEN_ZIP || 'C:/Program Files/7-Zip/7z.exe';
const MAX_ARCHIVE_BYTES = 32 * 1024 * 1024;
const MAX_EXPANDED_BYTES = 128 * 1024 * 1024;
function checkedPath(value) {
  if (!value || /^[\\/]|[\x00-\x1f\x7f:]|(?:^|[\\/])\.\.(?:[\\/]|$)/.test(value)) throw Error('Absolute, parent, control-character or stream path');
  return path.posix.normalize(value.replaceAll('\\', '/')).replace(/\/$/, '');
}
function checkedNames(names) {
  const seen = new Set();
  for (const name of names) {
    const normalized = checkedPath(name);
    if (!normalized || normalized === '.' || seen.has(normalized)) throw Error('Empty or duplicate extraction path');
    seen.add(normalized);
  }
}
function zipName(bytes, flags) {
  if (bytes.includes(0)) throw Error('NUL byte in ZIP name');
  if (!(flags & 0x800) && [...bytes].some(byte => byte > 127)) throw Error('Unverified legacy ZIP filename encoding');
  const value = new TextDecoder('utf-8', {fatal: true}).decode(bytes);
  checkedPath(value);
  return value;
}
function zipExtra(bytes) {
  let offset = 0;
  const pathOverrides = [];
  while (offset < bytes.length) {
    if (offset + 4 > bytes.length) throw Error('Truncated ZIP extra field');
    const id = bytes.readUInt16LE(offset), size = bytes.readUInt16LE(offset + 2);
    offset += 4;
    if (offset + size > bytes.length) throw Error('Truncated ZIP extra data');
    const field = bytes.subarray(offset, offset + size);
    offset += size;
    if (id === 0x7075) {
      if (field.length < 5 || field[0] !== 1) throw Error('Unverified ZIP Unicode path field');
      const value = new TextDecoder('utf-8', {fatal: true}).decode(field.subarray(5));
      checkedPath(value); pathOverrides.push(value);
    } else if (id === 0x000d || id === 0x5855) {
      // The optional tail carries link/device information; omit such archives.
      if (![8, 12].includes(field.length)) throw Error('ZIP Unix field may carry link or device information');
    } else if (id === 0x756e) {
      if (field.length !== 14) throw Error('ZIP ASi Unix link/device tail');
      const modeType = field.readUInt16LE(4) & 0xf000;
      if (![0, 0x4000, 0x8000].includes(modeType) || field.readUInt32LE(6) !== 0) throw Error('ZIP ASi Unix special file');
    } else if (id === 0x000a) {
      // Standard NTFS timestamp tag only; reparse data is not approved.
      if (field.length < 4) throw Error('Truncated ZIP NTFS extra field');
      let position = 4;
      while (position < field.length) {
        if (position + 4 > field.length) throw Error('Truncated ZIP NTFS tag');
        const tag = field.readUInt16LE(position), length = field.readUInt16LE(position + 2);
        position += 4;
        if (tag !== 1 || length !== 24 || position + length > field.length) throw Error('Unverified ZIP NTFS tag');
        position += length;
      }
    } else if (![0x5455, 0x7875, 0x7855, 0x6375].includes(id)) {
      throw Error('Unverified ZIP extra field 0x' + id.toString(16));
    }
  }
  return pathOverrides;
}
function reviewZip(bytes) {
  let eocd = -1;
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65557); offset--) {
    if (bytes.readUInt32LE(offset) === 0x06054b50 && offset + 22 + bytes.readUInt16LE(offset + 20) === bytes.length) { eocd = offset; break; }
  }
  if (eocd < 0) throw Error('ZIP end directory unavailable');
  const disk = bytes.readUInt16LE(eocd + 4), centralDisk = bytes.readUInt16LE(eocd + 6);
  const count = bytes.readUInt16LE(eocd + 10), diskCount = bytes.readUInt16LE(eocd + 8);
  const centralSize = bytes.readUInt32LE(eocd + 12), centralOffset = bytes.readUInt32LE(eocd + 16);
  if (disk || centralDisk || count !== diskCount || count === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff) throw Error('Multivolume or ZIP64 extraction not reviewed');
  if (centralOffset + centralSize !== eocd || count > 5000) throw Error('ZIP central directory boundary or entry limit');
  let offset = centralOffset, expandedBytes = 0;
  const names = [], effectiveNames = [];
  for (let index = 0; index < count; index++) {
    if (offset + 46 > eocd || bytes.readUInt32LE(offset) !== 0x02014b50) throw Error('Invalid ZIP central entry');
    const flags = bytes.readUInt16LE(offset + 8), method = bytes.readUInt16LE(offset + 10);
    const compressed = bytes.readUInt32LE(offset + 20), expanded = bytes.readUInt32LE(offset + 24);
    const nameLength = bytes.readUInt16LE(offset + 28), extraLength = bytes.readUInt16LE(offset + 30), commentLength = bytes.readUInt16LE(offset + 32);
    const attributes = bytes.readUInt32LE(offset + 38), localOffset = bytes.readUInt32LE(offset + 42);
    if (flags & 0x2041 || ![0, 8].includes(method) || compressed === 0xffffffff || expanded === 0xffffffff || bytes.readUInt16LE(offset + 34)) throw Error('Encrypted, unsupported or split ZIP entry');
    const next = offset + 46 + nameLength + extraLength + commentLength;
    if (next > eocd) throw Error('ZIP entry crosses central-directory boundary');
    const nameBytes = bytes.subarray(offset + 46, offset + 46 + nameLength);
    const name = zipName(nameBytes, flags);
    const modeType = (attributes >>> 16) & 0xf000;
    if (![0, 0x4000, 0x8000].includes(modeType) || (attributes & 0x440)) throw Error('ZIP symbolic link, device or reparse entry');
    if ((modeType === 0x8000 && name.endsWith('/')) || (modeType === 0x4000 && expanded !== 0)) throw Error('Conflicting ZIP file/directory attributes');
    const overrides = zipExtra(bytes.subarray(offset + 46 + nameLength, offset + 46 + nameLength + extraLength));
    if (localOffset + 30 > centralOffset || bytes.readUInt32LE(localOffset) !== 0x04034b50) throw Error('Invalid ZIP local header');
    const localFlags = bytes.readUInt16LE(localOffset + 6), localMethod = bytes.readUInt16LE(localOffset + 8);
    const localNameLength = bytes.readUInt16LE(localOffset + 26), localExtraLength = bytes.readUInt16LE(localOffset + 28);
    const localName = bytes.subarray(localOffset + 30, localOffset + 30 + localNameLength);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    if (dataStart + compressed > centralOffset || localFlags !== flags || localMethod !== method || !nameBytes.equals(localName)) throw Error('ZIP central/local header disagreement');
    zipName(localName, localFlags);
    const localOverrides = zipExtra(bytes.subarray(localOffset + 30 + localNameLength, dataStart));
    names.push(name);
    effectiveNames.push(overrides.at(-1) || localOverrides.at(-1) || name);
    expandedBytes += expanded;
    offset = next;
  }
  if (offset !== eocd || expandedBytes > MAX_EXPANDED_BYTES) throw Error('ZIP expanded-size limit or unexpected central records');
  checkedNames(names); checkedNames(effectiveNames);
  return {entryCount: count, expandedBytes, proof: 'ZIP central and local headers; raw and Unicode paths; Unix file-type/DOS device and reparse attributes; explicit extra-field allowlist'};
}
function reviewRar5(listing) {
  if (!/^Type = Rar5$/m.test(listing) || !/^Multivolume = -$/m.test(listing) || /^Encrypted = \+$/m.test(listing)) throw Error('RAR5 volume/encryption not approved');
  const blocks = listing.split('----------').slice(1).join('----------').split(/\r?\n\r?\n/).filter(block => /^Path =/m.test(block));
  if (!blocks.length || blocks.length > 5000) throw Error('RAR5 entry count unavailable');
  const names = [];
  let expandedBytes = 0;
  for (const block of blocks) {
    // A path with a newline must not be able to forge another listing field.
    const expectedKeys = new Set(['Path', 'Folder', 'Size', 'Packed Size', 'Modified', 'Created', 'Accessed', 'Attributes', 'Alternate Stream', 'Encrypted', 'Solid', 'Split Before', 'Split After', 'CRC', 'Host OS', 'Method', 'Characteristics', 'Symbolic Link', 'Hard Link', 'Copy Link', 'Volume Index', 'Checksum', 'NT Security']);
    const fields = new Map();
    for (const line of block.split(/\r?\n/).filter(Boolean)) {
      const match = line.match(/^([^=]+) = (.*)$/);
      if (!match || !expectedKeys.has(match[1]) || fields.has(match[1])) throw Error('RAR5 ambiguous listing metadata');
      fields.set(match[1], match[2]);
    }
    if (fields.size !== expectedKeys.size) throw Error('RAR5 incomplete per-entry metadata');
    const value = key => fields.get(key);
    const name = value('Path'); checkedPath(name); names.push(name);
    if (!['+', '-'].includes(value('Folder')) || value('Encrypted') !== '-' || value('Alternate Stream') !== '-' || value('Split Before') !== '-' || value('Split After') !== '-') throw Error('RAR5 entry type, alternate stream, encryption or split flag not confirmed');
    for (const key of ['Symbolic Link', 'Hard Link', 'Copy Link']) if (value(key) !== '') throw Error('RAR5 link field is set or unavailable');
    const attributes = value('Attributes') || '';
    const unixType = attributes.match(/(?:^|\s)([-dlbcps])[rwxstST-]{9}(?:$|\s)/)?.[1];
    if (unixType) {
      if (!['-', 'd'].includes(unixType) || (unixType === 'd') !== (value('Folder') === '+')) throw Error('RAR5 special file or conflicting directory type');
    } else if (!/^[ADRH_SN ]+$/.test(attributes) || attributes.includes('D') !== (value('Folder') === '+')) throw Error('RAR5 unverified DOS file attributes');
    const size = value('Size');
    if (!/^\d+$/.test(size || '')) throw Error('RAR5 entry size unavailable');
    expandedBytes += Number(size);
  }
  if (expandedBytes > MAX_EXPANDED_BYTES) throw Error('RAR5 expanded-size limit');
  checkedNames(names);
  return {entryCount: blocks.length, expandedBytes, proof: 'RAR5 per-entry regular-file/directory attributes, explicit empty symbolic/hard/copy link fields, negative alternate-stream/encrypted/split flags and validated paths'};
}
function build() {
  const audit = JSON.parse(fs.readFileSync(path.join(root, 'docs/console-archive-readiness-audit.json'), 'utf8'));
  const items = [];
  for (const archive of audit.archives) {
    const absolute = path.join(root, archive.local.replace(/^\//, ''));
    const bytes = fs.readFileSync(absolute);
    const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
    const item = {sha256, filename: path.basename(absolute), local: archive.local, bytes: bytes.length, reviewed: false, noLinks: false, relativePaths: false, noDevices: false};
    try {
      if (sha256 !== archive.originalSha256) throw Error('Archive differs from audited checksum');
      if (bytes.length > MAX_ARCHIVE_BYTES) throw Error('Archive exceeds browser verification limit of 32 MiB');
      const listing = execFileSync(sevenZip, ['l', '-slt', absolute], {encoding: 'utf8', maxBuffer: 32 * 1024 * 1024});
      const type = listing.match(/^Type = (.+)$/m)?.[1];
      item.type = type;
      let review;
      if (type === 'zip') review = reviewZip(bytes);
      else if (type === 'Rar5') review = reviewRar5(listing);
      else throw Error('Format lacks independently confirmed per-entry link/type metadata; GUI only');
      Object.assign(item, review, {reviewed: true, noLinks: true, relativePaths: true, noDevices: true, noAlternateStreams: true, noEncryptedEntries: true});
    } catch (error) { item.reason = error.message; }
    items.push(item);
  }
  const result = {schemaVersion: 1, reviewed: '2026-11-02', maxArchiveBytes: MAX_ARCHIVE_BYTES, maxExpandedBytes: MAX_EXPANDED_BYTES, method: 'Static metadata inspection only. Native extraction additionally requires hashing the actual saved archive, exact allowlist SHA-256 match and a new empty destination.', items};
  fs.writeFileSync(path.join(root, 'docs/console-archive-safety.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({total: items.length, approved: items.filter(item => item.reviewed).length, rejected: items.filter(item => !item.reviewed).map(item => ({filename: item.filename, reason: item.reason}))}, null, 2));
  return result;
}
module.exports = {checkedPath, reviewZip, reviewRar5, build};
if (require.main === module) build();
