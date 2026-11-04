// Read-only check of tracked files and unignored files Git would add.
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const {MAX_MIRROR_BYTES} = require('./download-mirror-policy.cjs');
const root = path.resolve(__dirname, '..');
const names = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
  cwd: root, maxBuffer: 64 * 1024 * 1024
}).toString('utf8').split('\0').filter(Boolean);
const oversized = [];
let checked = 0, bytes = 0;
for (const name of new Set(names)) {
  const file = path.resolve(root, name);
  let stat;
  try { stat = fs.lstatSync(file); }
  catch (error) { if (error.code === 'ENOENT') continue; throw error; }
  if (!stat.isFile()) continue;
  checked++;
  bytes += stat.size;
  if (stat.size >= MAX_MIRROR_BYTES) oversized.push({path: name, bytes: stat.size});
}
for (const file of oversized) console.error(`${(file.bytes / 1048576).toFixed(1)} MiB: ${file.path}`);
console.log(`Checked ${checked} Git-eligible files (${(bytes / 1073741824).toFixed(2)} GiB); ${oversized.length} at or above the 95 MiB per-file ceiling.`);
if (oversized.length) process.exitCode = 1;
