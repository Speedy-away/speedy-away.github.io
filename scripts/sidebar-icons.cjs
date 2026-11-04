const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const cssVersion = '3.1.23';
const shapes = {
  home: '<path d="m3 10 9-7 9 7v10h-6v-6H9v6H3Z"/>',
  controller: '<path d="M7 8h10a3 3 0 0 1 2.9 2.3l1.2 6a2.4 2.4 0 0 1-4 2.2L14.5 16h-5L7 18.5a2.4 2.4 0 0 1-4-2.2l1.2-6A3 3 0 0 1 7 8Z"/><path d="M7 10v4m-2-2h4"/><circle cx="16" cy="11" r=".75" fill="currentColor" stroke="none"/><circle cx="18" cy="13" r=".75" fill="currentColor" stroke="none"/><path d="M10 8V6h4"/>',
  crosshair: '<circle cx="12" cy="12" r="6"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/>',
  puzzle: '<path d="M3 3h6v3a2 2 0 1 0 4 0V3h8v6h-3a2 2 0 1 0 0 4h3v8h-6v-3a2 2 0 1 0-4 0v3H3v-6h3a2 2 0 1 0 0-4H3Z"/>',
  download: '<path d="M12 3v12m-4-4 4 4 4-4M4 15v5h16v-5"/>',
  android: '<path d="m7 6-2-3m12 3 2-3M5 11a7 7 0 0 1 14 0v7H5Zm-3 0v5m20-5v5M8 18v3m8-3v3"/><circle cx="9" cy="11" r=".75" fill="currentColor" stroke="none"/><circle cx="15" cy="11" r=".75" fill="currentColor" stroke="none"/>',
  console: '<rect x="3" y="3" width="8" height="18" rx="2"/><path d="M6 6h2m-2 3h2m7 3h4a2 2 0 0 1 2 1.6l1 4.5a1.7 1.7 0 0 1-2.8 1.7L17 18h-2"/><circle cx="7" cy="17" r=".75" fill="currentColor" stroke="none"/><path d="M16 14v2m-1-1h2"/>',
  retro: '<path d="M3 12a9 9 0 1 0 2.6-6.3L3 8m0-5v5h5m4-1v5l3 2"/>',
  workstation: '<rect x="2" y="4" width="14" height="11" rx="1.5"/><path d="M9 15v5m-4 0h8"/><rect x="19" y="4" width="3" height="16" rx="1"/><path d="M20 8h1m-1 8h1"/>',
  desktop: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M3 8h18m-9 9v3m-4 0h8"/>',
  emulator: '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4m6-4v4M9 18v4m6-4v4M2 9h4m-4 6h4m12-6h4m-4 6h4m-12-6 5 3-5 3Z"/>',
  code: '<path d="m8 7-5 5 5 5m8-10 5 5-5 5m-3-14-2 18"/>',
  gameSource: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Zm0 0v6h6m-10 3-3 3 3 3m4-6 3 3-3 3"/>',
  toolbox: '<rect x="3" y="8" width="18" height="12" rx="2"/><path d="M8 8V4h8v4M3 13h18m-12 0v3h6v-3"/>',
  community: '<circle cx="9" cy="8" r="3"/><path d="M3 21v-2a6 6 0 0 1 12 0v2m2-16a3 3 0 0 1 0 6m2 10v-2a6 6 0 0 0-2-4.5"/>',
  profile: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="9" r="3"/><path d="M6 19a6 6 0 0 1 12 0"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 .5c0 1.5-2.5 1.8-2.5 3.5"/><circle cx="12" cy="17" r=".75" fill="currentColor" stroke="none"/>',
  language: '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
  chevron: '<path d="m5 8 7 7 7-7"/>'
};
const labels = {
  Home: 'home', 'Cheats & Mods': 'controller', 'Free Cheats': 'crosshair',
  'Game Mods': 'puzzle', 'Game Downloads': 'download', 'APK Downloads': 'android',
  Console: 'console', Retro: 'retro', 'Console Mods': 'puzzle', Mods: 'puzzle', 'Mods / Mod Menus': 'puzzle',
  Emulators: 'emulator', 'Source Codes': 'code', 'Game Source Codes': 'gameSource',
  Tools: 'toolbox', Community: 'community', Profile: 'profile', 'Help & FAQ': 'help', Language: 'language', 'PS4 / PS5 webhost': 'console'
};
const esc = value => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
function icon(id, caret = false) {
  if (!shapes[id]) throw Error('Unknown sidebar icon: ' + id);
  return `<svg class="nav-icon${caret ? ' nav-caret' : ''}" data-nav-icon="${id}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${caret ? 12 : 20}" height="${caret ? 12 : 20}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${shapes[id]}</svg>`;
}
function decorateNavLinks(fragment, options = {}) {
  fragment = require('./host-webhost-navigation.cjs').integrateWebhostLink(fragment);
  fragment = require('./add-themes-sidebar.cjs').integrateThemes(fragment, options.file);
  fragment = require('./integrate-console-platforms.cjs').integrateConsoleList(fragment, options);
  fragment = require('./source-code-navigation.cjs').integrateSourceCodes(fragment, options.file);
  fragment = fragment.replace(/(<(a|button)\b(?=[^>]*\bclass="[^"]*\bnav-link\b)[^>]*>)([\s\S]*?)(<\/\2>)/g, (all, open, tag, content, close) => {
    let label = (open.match(/\bdata-tooltip="([^"]*)"/)?.[1] || content.match(/<span[^>]*>([\s\S]*?)<\/span>/)?.[1] || '').replaceAll('&amp;', '&').replace(/<[^>]+>/g, '').trim();
    if (tag === 'a' && (label === 'Console Mods' || /href="[^"]*console\/mods\/(?:index\.html)?"/.test(open))) {
      label = 'Mods / Mod Menus';
      open = open.replace(/\b(?:data-tooltip|aria-label)="[^"]*"/g, attr => attr.slice(0, attr.indexOf('=')) + '="' + label + '"');
      content = content.replace(/(<span[^>]*>)[\s\S]*?(<\/span>)/, '$1' + label + '$2');
      open = open.replace(/\s(?:target|rel)="[^"]*"/g, '').replace(/>$/, ' target="_blank" rel="noopener noreferrer">');
    }
    if (label && !/\baria-label=/.test(open)) open = open.replace(/>$/, ` aria-label="${esc(label)}">`);
    if (/\bnav-platform-logo\b/.test(content)) return open + content + close;
    const id = label === 'PC' ? tag === 'button' ? 'workstation' : 'desktop' : labels[label];
    if (!id) return open + content + close;
    const existing = /<svg\b(?=[^>]*\bdata-nav-icon="(?!chevron)[^"]+")[^>]*>[\s\S]*?<\/svg>/;
    const old = /<i\b(?![^>]*\bnav-caret\b)[^>]*>[\s\S]*?<\/i>/;
    if (existing.test(content)) content = content.replace(existing, icon(id));
    else if (old.test(content)) content = content.replace(old, icon(id));
    else content = icon(id) + content;
    content = content.replace(/<i\b(?=[^>]*\bnav-caret\b)[^>]*>[\s\S]*?<\/i>/g, icon('chevron', true));
    return open + content + close;
  });
  return require('./console-topic-navigation.cjs').apply(options.file || '', fragment);
}
function applySidebarIcons(file, html) {
  if (require('./integrate-console-platforms.cjs').isProtected(file, html)) return html;
  const opening = /<(div|nav|aside)\b(?=[^>]*\bid="sidebar")[^>]*>/.exec(html);
  if (!opening) return html;
  const tags = new RegExp(`<(/?)${opening[1]}\\b[^>]*>`, 'g');
  tags.lastIndex = opening.index + opening[0].length;
  let depth = 1, token;
  while (depth && (token = tags.exec(html))) depth += token[1] ? -1 : 1;
  if (depth) throw Error('Unclosed sidebar: ' + file);
  html = html.slice(0, opening.index) + decorateNavLinks(html.slice(opening.index, tags.lastIndex), {file}) + html.slice(tags.lastIndex);
  html = html.replace(/(<link\b[^>]*\bhref=")([^"]+)(")/g, (all, start, value, end) => {
    const url = new URL(value.replaceAll('&amp;', '&'), 'https://whatwhatboy.com/' + file);
    if (url.origin !== 'https://whatwhatboy.com' || url.pathname !== '/style.css') return all;
    url.searchParams.set('v', cssVersion);
    return start + value.split(/[?#]/)[0] + '?' + url.searchParams.toString().replaceAll('&', '&amp;') + url.hash + end;
  });
  return html.replace(/(<script\b[^>]*\bsrc=")([^"]+)(")/g, (all, start, value, end) => {
    const url = new URL(value.replaceAll('&amp;', '&'), 'https://whatwhatboy.com/' + file);
    if (url.origin !== 'https://whatwhatboy.com' || url.pathname !== '/languages/i18n.js') return all;
    url.searchParams.set('v', '3');
    return start + value.split(/[?#]/)[0] + '?' + url.searchParams.toString().replaceAll('&', '&amp;') + url.hash + end;
  });
}
function updateSidebarIcons() {
  const skip = new Set(['.git', '.agents', '.codex', '.claude', '.playwright', 'node_modules', 'assets', 'docs', 'downloads', 'languages', 'i18n-tools', 'design-references']);
  function files(dir) {
    return fs.readdirSync(dir, {withFileTypes: true}).flatMap(entry => entry.isDirectory() ? skip.has(entry.name) ? [] : files(path.join(dir, entry.name)) : entry.name.endsWith('.html') ? [path.join(dir, entry.name)] : []);
  }
  let changed = 0;
  for (const file of [...files(root), path.join(root, 'downloads/index.html')]) {
    if (!fs.existsSync(file) || /whatsite-ps[45]\.html$/.test(file)) continue;
    const before = fs.readFileSync(file, 'utf8'), after = applySidebarIcons(path.relative(root, file).replaceAll('\\', '/'), before);
    if (before !== after) { fs.writeFileSync(file, after); changed++; }
  }
  console.log('Updated sidebar icons in ' + changed + ' pages.');
}
if (require.main === module) updateSidebarIcons();
module.exports = {icon, decorateNavLinks, applySidebarIcons, updateSidebarIcons};
