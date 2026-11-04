// Stream one explicitly captured direct attachment. Never execute its content.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { Readable, Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const { safeName } = require('./download-archive-layout.cjs');
const root = path.resolve(__dirname, '..');
const arg = name => process.argv.find(value => value.startsWith('--' + name + '='))?.slice(name.length + 3);
const id = arg('id');
if (!/^[a-z0-9-]+$/.test(id || '')) throw Error('Supply a stable --id');
const capturePath = path.resolve(root, arg('capture') || '');
const relative = path.relative(root, capturePath);
if (relative.startsWith('..') || path.isAbsolute(relative)) throw Error('Capture must stay inside the checkout');
const capture = JSON.parse(fs.readFileSync(capturePath, 'utf8'));
const source = capture.urls[Number(arg('url-index') || 0)];
const url = new URL(source);
if (url.protocol !== 'https:' || url.hostname !== 'cdn.discordapp.com') throw Error('Require the explicitly captured Discord attachment');
const maximum = Number(arg('max-bytes')) || 64 * 1024 * 1024;
const expected = Number(arg('expected-bytes')) || null;
const timeoutMs = Math.min(Number(arg('timeout-ms')) || 60000, 300000);
const deadline = setTimeout(() => { console.error(id + ': transfer exceeded configured bound; partial preserved'); process.exit(1); }, timeoutMs);
(async () => {
  const response = await fetch(source, { signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw Error('HTTP ' + response.status);
  if (/html|json/.test(response.headers.get('content-type') || '')) throw Error('Received an error page');
  const declared = Number(response.headers.get('content-length'));
  if (declared > maximum || expected && declared && declared !== expected) { await response.body.cancel(); throw Error('Attachment size does not match bounded metadata'); }
  const name = safeName(decodeURIComponent(url.pathname.split('/').pop()));
  const dir = path.join(root, 'docs/discord-ps4-ps5-raw/http-staging', id, 'transfer-' + Date.now());
  fs.mkdirSync(dir, { recursive: true });
  const partial = path.join(dir, name + '.partial'), target = path.join(dir, name);
  let bytes = 0, reported = 0;
  const hash = crypto.createHash('sha256');
  const meter = new Transform({ transform(chunk, encoding, callback) {
    bytes += chunk.length;
    if (bytes > maximum) return callback(Error('Attachment exceeded byte limit'));
    hash.update(chunk);
    if (bytes - reported >= 64 * 1024 * 1024) { console.log(id + ': received ' + Math.round(bytes / 1048576) + ' MiB'); reported = bytes; }
    callback(null, chunk);
  } });
  console.log(JSON.stringify({ id, name, declaredBytes: declared }));
  await pipeline(Readable.fromWeb(response.body), meter, fs.createWriteStream(partial, { flags: 'wx' }));
  if (expected && bytes !== expected) throw Error('Completed attachment length mismatch');
  const sha256 = hash.digest('hex');
  fs.renameSync(partial, target);
  const info = { id, name, bytes, sha256, sourceUrl: source, stagedRelative: path.relative(root, target).replaceAll('\\', '/') };
  fs.writeFileSync(path.join(root, 'docs/discord-ps4-ps5-raw', id + '-http-info.txt'), JSON.stringify(info, null, 2) + '\n');
  console.log(JSON.stringify({ ...info, sourceUrl: undefined }));
})().catch(error => { console.error(id + ': ' + error.message); process.exitCode = 1; }).finally(() => clearTimeout(deadline));
