// Copy selected verified ready builds to the non-destructive console archive.
const fs = require('node:fs');
const path = require('node:path');
const {createArchive} = require('./console-expansion-archive.cjs');
const root = path.resolve(__dirname,'..');
async function main() {
  const cataloguePath = path.join(root,'docs/switch-themes-catalog.json');
  const catalogue = JSON.parse(fs.readFileSync(cataloguePath,'utf8'));
  const archive = createArchive();
  for (const entry of [...catalogue.themes,catalogue.client,...catalogue.failures.filter(entry=>entry.file)]) {
    const file = entry.file;
    const result = await archive.archiveFile({scope:'switch-themes',item:{id:entry.id,title:entry.title,url:entry.sourceUrl,platform:'Nintendo Switch',category:entry.status==='layout-review-required' ? ['Themes','Review Required'] : entry.kind === 'pack' ? ['Themes','Theme Packs'] : entry.kind === 'individual' ? ['Themes','Individual Themes'] : ['Tools','Theme Installers'],pages:['console/nintendo-switch/themes.html']},file:{name:file.name,sourceUrl:file.sourceUrl,version:file.version,archiveRole:['Builds'],expectedBytes:file.bytes,expectedSha256:file.sha256,format:entry.kind === 'pack' ? 'ZIP pack of NXThemes menu files' : entry.kind === 'individual' ? 'NXTheme ZIP-based container' : 'NRO',compatibility:entry.requirements?.join(' ') || 'Original Switch CFW with NXThemes Installer; internet connection for browsing.'},sourceFile:path.join(root,file.local)});
    file.archived = true;
    file.archiveRole = result.publicFile.archiveRole;
    console.log('Archived',entry.id,file.bytes,file.sha256);
  }
  catalogue.archivedAt = new Date().toISOString();
  fs.writeFileSync(cataloguePath,JSON.stringify(catalogue,null,2)+'\n');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
