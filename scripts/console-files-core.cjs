'use strict';
const path = require('node:path');
const crypto = require('node:crypto');
const {Readable, Writable} = require('node:stream');
const HASH = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const INI = '/data/GoldHEN/plugins.ini';
function remote(value, write = false) {
  if (typeof value !== 'string' || value.length > 1024 || !value.startsWith('/') || /[\\\x00-\x1f\x7f]/.test(value) || value.split('/').some(x => x === '..' || x === '.')) throw Error('Use an absolute console path without dot segments or control characters.');
  const result = path.posix.normalize(value);
  if (write && !/^\/(?:data|mnt\/usb[0-7])\//.test(result)) throw Error('Writes are limited to /data and /mnt/usb0 through /mnt/usb7.');
  return result;
}
function filename(value) {
  if (typeof value !== 'string' || !value || value.length > 180 || /[\\/\x00-\x1f\x7f:*?"<>|]/.test(value) || value === '.' || value === '..' || /[. ]$/.test(value)) throw Error('Choose a filename without slashes, control characters or reserved punctuation.');
  return value;
}
function settings(c) {
  const p = String(c.host || '').split('.').map(Number);
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(c.host || '') || p.join('.') !== c.host || p.some(n => n < 0 || n > 255) || !(p[0] === 10 || p[0] === 192 && p[1] === 168 || p[0] === 172 && p[1] >= 16 && p[1] <= 31) || p[3] === 0 || p[3] === 255) throw Error('Enter the console private LAN IPv4 address.');
  const port = Number(c.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error('FTP port must be between 1 and 65535.');
  for (const key of ['user','password']) if (typeof c[key] !== 'string' || c[key].length > 256 || /[\x00-\x1f\x7f]/.test(c[key])) throw Error('Invalid FTP credentials.');
  return {host:c.host,port,user:c.user || 'anonymous',password:c.password,secure:false};
}
async function exists(client, file) {
  const rows = await client.list(path.posix.dirname(file));
  return rows.some(row => row.name === path.posix.basename(file));
}
async function read(client, file, limit = 1024 * 1024) {
  const chunks = []; let count = 0;
  await client.downloadTo(new Writable({write(chunk, _, done) {
    count += chunk.length;
    if (count > limit) return done(Error('File exceeds the size limit.'));
    chunks.push(chunk); done();
  }}), remote(file));
  return Buffer.concat(chunks);
}
async function upload(client, local, target, bytes) {
  remote(target, true);
  if (await exists(client, target)) throw Error('A file with that name already exists. Rename the new file or move the existing copy first.');
  const staging = target + '.wwb-part-' + crypto.randomBytes(8).toString('hex');
  try {
    await client.uploadFrom(local, staging);
    if (await client.size(staging) !== bytes) throw Error('Uploaded size did not match. The final filename was not changed.');
    if (await exists(client, target)) throw Error('The destination appeared during transfer. The existing file was preserved.');
    await client.rename(staging, target);
    return {path:target,bytes};
  } catch (error) {
    // Only this operation's randomly named incomplete file can be removed.
    try { await client.remove(staging); } catch (_) {}
    throw error;
  }
}
async function readIni(client) {
  if (!await exists(client, INI)) return {text:'',sha256:HASH(''),exists:false};
  const bytes = await read(client, INI);
  return {text:bytes.toString('utf8'),sha256:HASH(bytes),exists:true};
}
async function saveIni(client, text, expected) {
  if (typeof text !== 'string' || Buffer.byteLength(text) > 1024 * 1024 || text.includes('\0')) throw Error('Invalid or oversized plugins.ini.');
  if (!/^[a-f0-9]{64}$/.test(expected || '')) throw Error('Read plugins.ini from this console before saving.');
  const before = await readIni(client);
  if (before.sha256 !== expected) throw Error('plugins.ini changed on the console. Read it again before applying your edits.');
  const bytes = Buffer.from(text), suffix = Date.now() + '-' + crypto.randomBytes(5).toString('hex');
  const temporary = INI + '.wwb-part-' + suffix, backup = before.exists ? INI + '.bak-' + suffix : null;
  try {
    await client.uploadFrom(Readable.from(bytes), temporary);
    if (HASH(await read(client, temporary)) !== HASH(bytes)) throw Error('Config verification failed; the existing file was preserved.');
    const latest = await readIni(client);
    if (latest.sha256 !== before.sha256 || latest.exists !== before.exists) throw Error('plugins.ini changed while uploading. Read it again.');
    if (backup) await client.rename(INI, backup);
    try { await client.rename(temporary, INI); }
    catch (error) {
      if (backup) { try { await client.rename(backup, INI); } catch (_) { error.message += ' Restore the retained backup at ' + backup; } }
      throw error;
    }
    return {path:INI,backup,sha256:HASH(bytes),text};
  } catch (error) { try { await client.remove(temporary); } catch (_) {} throw error; }
}
function archiveEntries(output) {
  const rows = [];
  for (const block of output.split(/\r?\n\r?\n/)) {
    const item = {};
    for (const line of block.split(/\r?\n/)) { const i = line.indexOf(' = '); if (i > 0) item[line.slice(0,i)] = line.slice(i+3); }
    if (!item.Path) continue;
    if (item.Folder === '+' || /^D/.test(item.Attributes || '')) continue;
    const name = item.Path.replace(/\\/g,'/');
    if (/^[\/@]|^[a-z]:/i.test(name) || name.split('/').some(p => p === '..' || p === '.') || /[\x00-\x1f\x7f]/.test(name)) throw Error('Archive contains an unsafe path.');
    if (item['Symbolic Link'] || item['Hard Link'] || /[lL]/.test(item.Attributes || '') || /\bl[rwx-]{9}/.test(item.Mode || '')) throw Error('Archives containing links are not supported.');
    if (item.Encrypted === '+') throw Error('Encrypted archives are not supported. Extract them with your archive application first.');
    const bytes = Number(item.Size);
    if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > 64 * 1024 * 1024) throw Error('Each extracted file must be 64 MiB or smaller.');
    if (rows.some(row => row.name === name)) throw Error('Archive contains duplicate member names.');
    rows.push({name,bytes,member:item.Path});
  }
  if (!rows.length || rows.length > 5000 || rows.reduce((n,r) => n+r.bytes,0) > 2 * 1024**3) throw Error('Archive is empty or exceeds the 5,000 file / 2 GiB expanded limit.');
  return rows;
}
module.exports = {remote,filename,settings,exists,read,upload,readIni,saveIni,archiveEntries,HASH,INI};
