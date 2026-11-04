const fs = require('node:fs');
const path = require('node:path');
const {modGuideURL} = require('../assets/console-guide-dialog.js');
const root = path.resolve(__dirname, '..');

function applyGuidePopupPolicy(file, html) {
  const base = 'https://whatwhatboy.com/' + file;
  html = html.replace(/<a\b(?=[^>]*\bdata-guide-open(?:\s|=|>))[^>]*>/g, tag => {
    const href = tag.match(/\bhref="([^"]*)"/)?.[1]?.replaceAll('&amp;', '&');
    if (modGuideURL(href, base)) return tag;
    return tag.replace(/\sdata-guide-open(?:="[^"]*")?/g, '')
      .replace(/\saria-haspopup="dialog"/g, '').replace(/\saria-controls="console-guide-dialog[^"]*"/g, '');
  });
  // Catalogue and console selection links open full pages; guide triggers keep their dialogs.
  html = html.replace(/<a\b[^>]*\bhref="([^"]*)"[^>]*>/g, (tag, href) => {
    if (/\b(?:data-guide-open|download)\b/.test(tag)) return tag;
    let url;
    try { url = new URL(href.replaceAll('&amp;', '&'), base); } catch { return tag; }
    if (url.origin !== 'https://whatwhatboy.com' || url.hash ||
        !(/^\/console\/mods\//.test(url.pathname) || /^\/console\/(?:ps[345]|xbox360)\/mods\.html$/.test(url.pathname))) return tag;
    return tag.replace(/\s(?:target|rel)="[^"]*"/g, '').replace(/>$/, ' target="_blank" rel="noopener noreferrer">');
  });
  html = html.replace(/(<nav\b(?=[^>]*\bclass="guide-nav")[^>]*>)([\s\S]*?)(<\/nav>)/g, (all, open, content, close) =>
    open + content.replace(/(<a\b[^>]*href="[^"]*console\/(?:mods\/(?:index\.html)?|(?:ps[345]|xbox360)\/mods\.html)"[^>]*>)(?:Console Mods|Game Mods)(<\/a>)/g, '$1Mods / Mod Menus$2') + close);
  return require('./apply-console-setup-popups.cjs').apply(file, html.replace(/\/assets\/console-guide-dialog\.js\?v=\d+/g, '/assets/console-guide-dialog.js?v=5'));
}
function updateGuidePopupPages() {
  const skip = new Set(['.git', '.agents', '.codex', '.claude', '.playwright', 'node_modules', 'assets', 'docs', 'downloads', 'languages', 'i18n-tools', 'design-references']);
  function files(dir) {
    return fs.readdirSync(dir, {withFileTypes: true}).flatMap(entry => entry.isDirectory()
      ? skip.has(entry.name) ? [] : files(path.join(dir, entry.name))
      : entry.name.endsWith('.html') ? [path.join(dir, entry.name)] : []);
  }
  let changed = 0;
  for (const file of [...files(root), path.join(root, 'downloads/index.html')]) {
    if (!fs.existsSync(file) || /whatsite-ps[45]\.html$/.test(file)) continue;
    const before = fs.readFileSync(file, 'utf8');
    const after = applyGuidePopupPolicy(path.relative(root, file).replaceAll('\\', '/'), before);
    if (before !== after) { fs.writeFileSync(file, after); changed++; }
  }
  console.log('Updated ' + changed + ' pages: console guides navigate normally; mod guides retain popups.');
}
if (require.main === module) updateGuidePopupPages();
module.exports = {applyGuidePopupPolicy, updateGuidePopupPages};
