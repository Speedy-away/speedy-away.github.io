// Keep individual public mirrors below the existing site limit. Archive copies
// remain independent of whether a file can be published in this repository.
const fs = require('node:fs');
const path = require('node:path');

const MAX_MIRROR_BYTES = 95 * 1024 * 1024;
const workspace = path.resolve(__dirname, '..');
function publicMirror(local, root = workspace) {
  if (typeof local !== 'string' || !local.startsWith('/downloads/')) return null;
  try {
    const url = new URL(local, 'https://whatwhatboy.com');
    if (url.origin !== 'https://whatwhatboy.com' || url.search || url.hash) return null;
    const decoded = decodeURIComponent(url.pathname);
    const base = path.resolve(root, 'downloads');
    const file = path.resolve(root, '.' + decoded);
    const inside = (parent, child) => {
      const relative = path.relative(parent, child);
      return relative && relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
    };
    if (!inside(base, file) || !inside(fs.realpathSync(base), fs.realpathSync(file))) return null;
    const stat = fs.statSync(file);
    if (!stat.isFile() || stat.size >= MAX_MIRROR_BYTES) return null;
    return {local: decoded.split('/').map(encodeURIComponent).join('/'), bytes: stat.size};
  } catch { return null; }
}

module.exports = {MAX_MIRROR_BYTES, publicMirror};
