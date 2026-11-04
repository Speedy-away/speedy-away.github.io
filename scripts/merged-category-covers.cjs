// Single, generated merged covers. Original reference images remain untouched.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const file = path.join(root, 'docs/merged-category-covers.json');
let cache, stamp;
const esc = value => String(value).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
function read() {
  if (!fs.existsSync(file)) return null;
  const stat = fs.statSync(file), next = `${stat.mtimeMs}:${stat.size}`;
  if (next !== stamp) { cache = JSON.parse(fs.readFileSync(file,'utf8')); stamp = next; }
  return cache;
}
function get(key, kind = 'tools') {
  const data = read();
  if (!data) return null;
  const fallback = kind === 'themes' ? 'category-themes-universal' : kind === 'emulators' ? 'emulators-emulators' : ['games','mods'].includes(kind) ? 'category-'+kind : kind === 'downloads' ? 'library-game-downloads' : 'category-apps';
  return data.covers[data.routes[key] || key] || data.covers[fallback];
}
function image(cover, alt, className = '') {
  if (!cover) return '';
  return `<img${className ? ` class="${esc(className)}"` : ''} src="${esc(cover.path)}" alt="${esc(alt || cover.alt)}" width="${cover.width}" height="${cover.height}" loading="lazy" decoding="async">`;
}
function render(key, config = {}) {
  const cover = get(key, config.kind);
  if (!cover) return '';
  const labels = (config.images || []).map(item => item.label || item.alt).filter(Boolean);
  const alt = `Merged ${config.title || cover.title} cover${labels.length ? ': '+labels.join(', ') : ''}`;
  return `<div class="category-art category-art--merged" data-category-art="${esc(key)}" data-merged-cover="${esc(cover.id)}">${image(cover, alt)}</div>`;
}
function directory(platform) {
  const key = platform ? platform.base+'game-downloads.html' : '/console/game-downloads/index.html';
  const cover = get(key, 'downloads');
  return cover ? `<div class="directory-cover" data-directory-cover="${esc(cover.id)}">${image(cover,(platform?.title || 'Console')+' game directory cover')}</div>` : '';
}
module.exports={get, image, render, directory};
