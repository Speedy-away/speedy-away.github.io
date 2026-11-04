const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const start = '<!-- BEGIN SITE AD -->';
const end = '<!-- END SITE AD -->';
const stylesheet = '<link rel="stylesheet" href="/assets/site-ads.css?v=2">';
const script = '<script defer src="/assets/site-ads.js?v=2"></script>';

function eligible(file, html) {
  html = html.replace(/<!-- BEGIN SITE AD -->[\s\S]*?<!-- END SITE AD -->/g, '');
  return /^(?:console|pc|hosts)\//.test(file.replaceAll('\\', '/')) &&
    !/^hosts\/runtime\//.test(file.replaceAll('\\', '/')) &&
    !/^console\/ps[45]\/whatsite-ps[45]\.html$/.test(file.replaceAll('\\', '/')) &&
    !/<meta\b[^>]*name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(html) &&
    !/http-equiv=["']refresh/i.test(html) &&
    !/\bclass=["'][^"']*receiver-/.test(html) &&
    !/aloudalimonyexplosion\.com\//i.test(html);
}

function placement() {
  // Use the site's existing native embed pattern: the provider expects its
  // container in the top-level document. Only public content pages use this.
  return `${start}\n<aside class="site-ad" id="page-advertisement" aria-label="Advertisement"><div class="container"><div class="site-ad-panel"><span class="site-ad-label">Advertisement</span><div class="site-ad-stage"><script async="async" data-cfasync="false" src="https://aloudalimonyexplosion.com/fd0a4dcec74a63f4d2662af5273f9d5b/invoke.js"></script><div id="container-fd0a4dcec74a63f4d2662af5273f9d5b"></div><p class="site-ad-empty" hidden>Ad unavailable.</p></div></div></div></aside>\n${end}`;
}

function applyAds(file, html) {
  if (!eligible(file, html)) return html;
  html = html.replace('/assets/site-ads.css?v=1', '/assets/site-ads.css?v=2').replace('/assets/site-ads.js?v=1', '/assets/site-ads.js?v=2');
  html = html.replace(/\/assets\/console-guides\.css\?v=\d+/g, '/assets/console-guides.css?v=9');
  html = html.replace(/\/assets\/console-guide-dialog\.js\?v=\d+/g, '/assets/console-guide-dialog.js?v=4');
  if (!html.includes('/assets/site-ads.css')) html = html.replace('</head>', stylesheet + '\n</head>');
  if (!html.includes('/assets/site-ads.js')) html = html.replace('</body>', script + '</body>');
  if (html.includes(start) && !html.includes(end, html.indexOf(start))) throw Error('Unterminated ad placement in ' + file);
  // Reposition existing placements too, so older ads inside cards are repaired.
  html = html.replace(/\s*<!-- BEGIN SITE AD -->[\s\S]*?<!-- END SITE AD -->\s*/g, '');
  // Keep the first content section (including exploit-host lists) at the top.
  const content = html.indexOf('<div id="content">');
  const main = html.search(/<(?:main|div)\b[^>]*\bid="main-content"/i);
  const first = html.indexOf('<section ', content >= 0 ? content : main >= 0 ? main : 0);
  let sectionEnd = -1, depth = 0;
  if (first >= 0) {
    const tokens = /<!--[\s\S]*?-->|<script\b[^>]*>[\s\S]*?<\/script\s*>|<style\b[^>]*>[\s\S]*?<\/style\s*>|<\/?section\b[^>]*>/gi;
    tokens.lastIndex = first;
    let token;
    while ((token = tokens.exec(html))) {
      if (!/^<\/?section\b/i.test(token[0])) continue;
      depth += /^<\//.test(token[0]) ? -1 : 1;
      if (depth === 0) { sectionEnd = tokens.lastIndex; break; }
    }
  }
  if (sectionEnd < 0) throw Error('No content placement found in ' + file);
  const insert = sectionEnd;
  return html.slice(0, insert) + '\n' + placement() + '\n' + html.slice(insert);
}

function addExisting() {
  const files = dir => fs.readdirSync(dir, {withFileTypes: true}).flatMap(entry => entry.isDirectory()
    ? files(path.join(dir, entry.name)) : entry.name.endsWith('.html') ? [path.join(dir, entry.name)] : []);
  let changed = 0, total = 0;
  for (const file of [...files(path.join(root, 'console')), ...files(path.join(root, 'pc')), ...files(path.join(root,'hosts')).filter(file=>!path.relative(root,file).replaceAll('\\','/').startsWith('hosts/runtime/'))]) {
    const relative = path.relative(root, file).replaceAll('\\', '/');
    const before = fs.readFileSync(file, 'utf8');
    if (!eligible(relative, before)) continue;
    total++;
    const after = applyAds(relative, before);
    if (after !== before) { fs.writeFileSync(file, after); changed++; }
  }
  console.log(`Configured inline ads on ${total} console / PC pages; updated ${changed}.`);
}

if (require.main === module) addExisting();
module.exports = {eligible, placement, applyAds, addExisting};
