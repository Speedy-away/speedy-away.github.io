// Convert one reviewed, MIT-licensed RAR to ZIP. Never execute its contents.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const source = path.join(root, 'downloads/ps4-ps5/gta5-expulsion-v5-1-57/Expulsion-V5.0-PS4-1.57-Release.rar');
const target = path.join(root, 'downloads/ps4-ps5/expulsion-v5-zip/Expulsion-V5.0-PS4-1.57.zip');
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
if (hash(source) !== '7d907976539ee8c10bf810e7655dcb77db6e2e60850bc97e840dafddbcb4cac6') throw Error('Reviewed original RAR changed');
const sevenZip = process.env.WHATSITE_SEVEN_ZIP || 'C:/Program Files/7-Zip/7z.exe';
const listing = execFileSync(sevenZip, ['l', '-slt', source], {encoding:'utf8'}).split('----------')[1];
if (!listing) throw Error('Archive listing unavailable');
for (const entry of listing.split(/\r?\n\r?\n/)) {
  const name = entry.match(/^Path = (.+)$/m)?.[1];
  if (!name) continue;
  if (/^[\\/]|:|(?:^|[\\/])\.\.(?:[\\/]|$)/.test(name) || /^(?:Symbolic|Hard|Copy) Link = .+/m.test(entry)) throw Error('Unsafe archive entry');
  if (/\.(exe|dll|bat|cmd|ps1|com|msi)$/i.test(name)) throw Error('Desktop executable in console-only archive');
}
const license = execFileSync(sevenZip, ['e', '-so', source, 'LICENSE'], {encoding:'utf8'});
if (!license.startsWith('MIT License') || !license.includes('The above copyright notice')) throw Error('Expected MIT license missing');
if (fs.existsSync(target)) { console.log('Existing ZIP preserved: ' + hash(target)); process.exit(0); }
const stagingRoot = path.join(root, 'docs/tmp');
fs.mkdirSync(stagingRoot, {recursive:true});
const staging = fs.mkdtempSync(path.join(stagingRoot, 'expulsion-staging-'));
execFileSync(sevenZip, ['x', '-y', '-o' + staging, source], {stdio:'pipe'});
fs.mkdirSync(path.dirname(target), {recursive:true});
execFileSync(sevenZip, ['a', '-tzip', '-mx=7', target, '.'], {cwd:staging, stdio:'pipe'});
execFileSync(sevenZip, ['t', target], {stdio:'pipe'});
// Staging is retained as an additional extracted copy; the source is untouched.
console.log(JSON.stringify({source, sourceSha256:hash(source), target, bytes:fs.statSync(target).size, sha256:hash(target), staging, license:'MIT'}, null, 2));
