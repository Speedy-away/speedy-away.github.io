// Official product imagery only. Does not download or execute console software.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const sourcePage = 'https://www.nintendo.com/en-gb/Hardware/Nintendo-Switch-2/Nintendo-Switch-2-Specifications-2785627.html';
const jobs = [
  ['console', '2x1_NSwitch2_0101_Console_image950w.jpg'],
  ['dock', '2x1_NSwitch2_0101_Dock_image950w.jpg'],
  ['joy-con-2', '2x1_NSwitch2_0101_HWJoy_Con2_image950w.jpg']
];
async function main() {
  const images = [];
  for (const [id, name] of jobs) {
    const url = 'https://www.nintendo.com/eu/media/images/hardware_2/nintendo_switch_18/specifications/' + name;
    const response = await fetch(url, { signal: AbortSignal.timeout(45000) });
    if (!response.ok) throw Error(`${id}: HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > 5 * 1024 * 1024 || bytes[0] !== 255 || bytes[1] !== 216 || bytes[2] !== 255) throw Error('Expected bounded JPEG: ' + id);
    const file = 'assets/images/switch2-console/' + id + '.jpg';
    const absolute = path.join(root, file);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    if (fs.existsSync(absolute)) {
      if (!fs.readFileSync(absolute).equals(bytes)) throw Error('Preserve existing different artwork: ' + file);
    } else fs.writeFileSync(absolute, bytes, { flag: 'wx' });
    images.push({ id, file, sourcePage, sourceUrl: url, resolvedUrl: response.url, credit: 'Nintendo', rights: '© Nintendo. Official hardware product artwork, used for identification; no open licence asserted.', format: 'JPEG', bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), adaptations: 'None; original bytes preserved.' });
  }
  fs.writeFileSync(path.join(root, 'docs/switch2-console-artwork.json'), JSON.stringify({ scope: 'switch2-console', checkedAt: new Date().toISOString(), images }, null, 2) + '\n');
  console.log(JSON.stringify(images.map(({id,bytes,sha256}) => ({id,bytes,sha256})), null, 2));
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
