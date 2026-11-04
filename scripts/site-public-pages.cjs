// Browser-facing site pages only; packaged/downloaded HTML keeps its exact bytes.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const excluded = new Set(['node_modules', 'assets', 'docs', 'scripts', 'tmp', 'design-references', 'languages', 'i18n-tools']);
const relativePath = file => path.isAbsolute(file) ? path.relative(root, file).replaceAll('\\', '/') : file.replaceAll('\\', '/').replace(/^\/+/, '');
function eligible(relative) {
  const parts = relative.replaceAll('\\', '/').replace(/^\/+/, '').split('/');
  return /\.html$/i.test(relative) && !parts.some(part => part.startsWith('.') || excluded.has(part)) &&
    !/^hosts\/runtime(?:\/|$)/.test(parts.join('/')) &&
    (parts[0] !== 'downloads' || parts.length === 2 && parts[1] === 'index.html') &&
    !/^console\/ps([45])\/whatsite-ps\1\.html$/.test(parts.join('/'));
}
function pages(directory = root) {
  return fs.readdirSync(directory, {withFileTypes: true}).flatMap(entry => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.startsWith('.') || excluded.has(entry.name)) return [];
      if (path.relative(root, file).replaceAll('\\', '/') === 'hosts/runtime') return [];
      if (path.relative(root, file).replaceAll('\\', '/') === 'downloads') {
        const index = path.join(file, 'index.html');
        return fs.existsSync(index) ? [index] : [];
      }
      return pages(file);
    }
    return entry.isFile() && eligible(relativePath(file)) ? [file] : [];
  });
}
module.exports = {root, eligible, pages, relativePath};
