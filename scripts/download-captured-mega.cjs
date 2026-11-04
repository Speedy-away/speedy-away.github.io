// Explicit public-link transfers only. Source content is never executed.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const { safeName } = require('./download-archive-layout.cjs');
const root = path.resolve(__dirname, '..');
const arg = name => process.argv.find(value => value.startsWith('--' + name + '='))?.slice(name.length + 3);
const id = arg('id');
if (!/^[a-z0-9-]+$/.test(id || '')) throw Error('Supply a stable --id');
const capturePath = path.resolve(root, arg('capture') || '');
const relativeCapture = path.relative(root, capturePath);
if (relativeCapture.startsWith('..') || path.isAbsolute(relativeCapture)) throw Error('Capture must stay in the checkout');
const capture = JSON.parse(fs.readFileSync(capturePath, 'utf8').replace(/^\uFEFF/, ''));
const source = capture.urls[Number(arg('url-index') || 0)];
const parsed = new URL(source);
if (parsed.hostname !== 'mega.nz' || !parsed.pathname.startsWith('/file/') || !parsed.hash) throw Error('Require an explicit public MEGA file link with its fragment');
const { File } = require(path.join(process.env.TEMP, 'whatsite-mega-tool/node_modules/megajs'));
const maxBytes = Number(arg('max-bytes')) || 40 * 1024 * 1024;
const timeoutMs = Math.min(Number(arg('timeout-ms')) || 45000, 300000);
const deadline = setTimeout(() => { console.error(id + ': transfer exceeded configured time bound; any partial file is preserved'); process.exit(1); }, timeoutMs);
(async () => {
  const file = File.fromURL(source);
  await file.loadAttributes();
  if (!file.name || !file.size || file.size > maxBytes) throw Error('Unexpected file size/name; transfer not started');
  const name = safeName(file.name);
  const dir = path.join(root, 'docs/discord-ps4-ps5-raw/mega-staging', id, 'transfer-' + Date.now());
  fs.mkdirSync(dir, { recursive: true });
  const target = path.join(dir, name);
  const partial = target + '.partial';
  let bytes = 0, reported = 0;
  const sha = crypto.createHash('sha256');
  if (process.argv.includes('--resume-latest')) {
    const base = path.dirname(dir);
    const candidates = fs.readdirSync(base, { withFileTypes: true }).filter(entry => entry.isDirectory())
      .map(entry => path.join(base, entry.name, name + '.partial'))
      .filter(filename => fs.existsSync(filename) && fs.statSync(filename).size > 0 && fs.statSync(filename).size < file.size);
    candidates.sort((left, right) => fs.statSync(right).size - fs.statSync(left).size);
    const previous = candidates[0];
    if (!previous) throw Error('No matching partial available; transfer was not restarted');
    if (previous) {
      fs.copyFileSync(previous, partial, fs.constants.COPYFILE_EXCL);
      for await (const chunk of fs.createReadStream(previous)) { bytes += chunk.length; sha.update(chunk); }
      reported = bytes;
      console.log(id + ': resuming from ' + bytes + ' bytes; earlier partial preserved');
    }
  }
  const start = bytes;
  const meter = new Transform({ transform(chunk, encoding, callback) {
    bytes += chunk.length;
    if (bytes > maxBytes) return callback(Error('Transfer exceeded configured byte limit'));
    sha.update(chunk);
    if (bytes - reported >= 64 * 1024 * 1024) { console.log(id + ': received ' + Math.round(bytes / 1048576) + ' MiB'); reported = bytes; }
    callback(null, chunk);
  } });
  console.log(JSON.stringify({ id, name, declaredBytes: file.size }));
  await pipeline(file.download({ start, maxConnections: 1, forceHttps: true, handleRetries: (tries, error, callback) => callback(error) }), meter, fs.createWriteStream(partial, { flags: start ? 'a' : 'wx' }));
  if (bytes !== file.size) throw Error('Completed transfer size differs from public metadata');
  const sha256 = sha.digest('hex');
  fs.renameSync(partial, target);
  const result = { id, name, bytes, sha256, resumedFromBytes: start, sourceUrl: source, stagedRelative: path.relative(root, target).replaceAll('\\', '/') };
  fs.writeFileSync(path.join(root, 'docs/discord-ps4-ps5-raw', id + '-mega-info.txt'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ id, name, bytes, sha256, stagedRelative: result.stagedRelative }));
})().catch(error => { console.error(id + ': ' + error.message); process.exitCode = 1; }).finally(() => clearTimeout(deadline));
