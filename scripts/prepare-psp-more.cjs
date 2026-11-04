// Scoped PSP intake. Downloads/inspects data only; never runs console binaries.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {createArchive} = require('./console-expansion-archive.cjs');
const root = path.resolve(__dirname, '..');
const catalogPath = path.join(root, 'docs/psp-more-catalogue.json');
async function main() {
  const data = JSON.parse(fs.readFileSync(catalogPath));
  const archive = createArchive();
  for (const item of data.items) for (const file of item.files) {
    const target = path.join(root, file.local.replace(/^\//, ''));
    fs.mkdirSync(path.dirname(target), {recursive:true});
    if (!fs.existsSync(target)) {
      const response = await fetch(file.sourceUrl, {signal:AbortSignal.timeout(120000)});
      if (!response.ok) throw Error(`${item.id}: HTTP ${response.status} ${file.sourceUrl}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (!bytes.length || bytes.length > 250 * 1024 * 1024 || /^\s*<(?:!doctype|html)/i.test(bytes.subarray(0, 120).toString())) throw Error('Unexpected download content');
      fs.writeFileSync(target, bytes, {flag:'wx'});
    }
    const bytes = fs.readFileSync(target);
    const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
    if (file.sha256 && sha256 !== file.sha256) throw Error('Existing pinned file differs: ' + target);
    Object.assign(file, {bytes:bytes.length, sha256});
    if (process.argv.includes('--archive')) {
      if (!file.verifiedFormat) throw Error('Inspect formats first: python scripts/inspect-psp-more.py');
      const result = await archive.archiveFile({scope:'psp-more', item:{id:'psp-more-'+item.id,title:item.title,url:item.source,platform:'PSP',category:[item.category],pages:['console/retro/psp.html']},file:{...file,archiveRole:['Builds'],expectedBytes:bytes.length,expectedSha256:sha256},sourceFile:target});
      Object.assign(file, result.publicFile);
    }
    console.log(item.id, file.name, bytes.length, sha256);
    fs.writeFileSync(catalogPath, JSON.stringify(data, null, 2)+'\n');
  }
}
if (require.main === module) main().catch(e=>{console.error(e);process.exitCode=1;});
