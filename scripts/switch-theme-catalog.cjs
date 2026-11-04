// Derive menu/layout labels directly from bounded, read-only theme containers.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {inspectZip} = require('./archive-switch-homebrew.cjs');
const {inspectTheme} = require('./verify-switch-themes.cjs');
const root = path.resolve(__dirname,'..');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function annotate(catalogue) {
  for (const theme of catalogue.themes) {
    const bytes = fs.readFileSync(path.join(root,theme.file.local));
    if (bytes.length !== theme.file.bytes || sha(bytes) !== theme.file.sha256) throw Error('Pinned theme bytes changed: '+theme.id);
    const files = theme.kind === 'pack' ? inspectZip(bytes,32*1024*1024).filter(file=>!file.directory && /\.nxtheme$/i.test(file.path)) : [{path:theme.file.name,data:bytes}];
    if (files.length !== theme.components.length) throw Error('Component count differs: '+theme.id);
    for (const file of files) {
      const parsed = inspectTheme(file.data);
      const id = parsed.manifest.Id?.match(/^Themezer:([^:]+):/)?.[1];
      const component = theme.components.find(component=>component.id===id);
      if (!component || parsed.target !== component.target || parsed.manifest.Author !== theme.author || parsed.manifest.ThemeName !== component.title) throw Error('Embedded source metadata differs: '+file.path);
      Object.assign(component,{layoutInfo:parsed.manifest.LayoutInfo,layout:parsed.layout,commonLayout:parsed.commonLayout,container:parsed.format,containerPath:file.path,bytes:parsed.bytes,sha256:parsed.sha256});
    }
    if (theme.components.some(component=>component.container==='ZIP-based NXTheme')) {
      const requirement='These preserved components use the ZIP-based NXTheme format: use NXThemes Installer 3.0 or later with support for your exact firmware (linked build: 3.0.2).';
      if (!theme.requirements.includes(requirement)) theme.requirements.push(requirement);
    }
  }
  return catalogue;
}
if (require.main === module) {
  const file = path.join(root,'docs/switch-themes-catalog.json');
  fs.writeFileSync(file,JSON.stringify(annotate(JSON.parse(fs.readFileSync(file,'utf8'))),null,2)+'\n');
  console.log('Annotated all theme menu components from original containers.');
}
module.exports={annotate};
