const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const guides = require('./build-console-guides.cjs');

// Keep PS3 metadata and media policy scoped to the PS3 generator.
function page(file, title, description, image, nav, content, primary, label, keywords = []) {
  guides.page(file, title, description, image, nav, content, primary, label);
  const target = path.join(root, file);
  let html = fs.readFileSync(target, 'utf8');
  const terms = [...new Set([title, 'PS3', 'PlayStation 3', 'homebrew', ...keywords])];
  html = html.replace(/<meta name="keywords" content="[^"]*">/, `<meta name="keywords" content="${guides.esc(terms.join(', '))}">`)
    .replace('</head>', '<link rel="stylesheet" href="/assets/ps3-catalog.css?v=3.3.3"><link rel="stylesheet" href="/assets/console-menu-catalog.css?v=1"></head>')
    .replace('class="console-guide"', 'class="console-guide ps3-catalog"')
    .replace(/<section\b[^>]*\bid="video"[^>]*>[\s\S]*?<\/section>/gi, '')
    .replace(/<figure\b[^>]*class="[^"]*\bguide-(?:local-video|video)[^"]*"[^>]*>[\s\S]*?<\/figure>/gi, '')
    .replace(/<a\b[^>]*class="[^"]*\bguide-video\b[^"]*"[^>]*>[\s\S]*?<\/a>/gi, '')
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, '')
    .replace(/<video\b[^>]*>[\s\S]*?<\/video>/gi, '');
  // PS3 game catalogues are full pages even when their labels include "guide".
  html = html.replace(/<a\b[^>]*href="\/console\/ps3\/mods\/[^"#]*"[^>]*>/g, tag => tag
    .replace(/\s(?:data-guide-open|target="[^"]*"|rel="[^"]*")/g, '')
    .replace(/>$/, ' target="_blank" rel="noopener noreferrer">'));
  if (file.includes('/mods/') || file.endsWith('/archive-server.html')) html = html.replace(/<div class="container guide-hero-grid(?: guide-hero-text)?">/, '<div class="container guide-hero-grid guide-hero-text">').replace(/<img src="[^"]*" alt="[^"]*" width="1280" height="720">/, '');
  fs.writeFileSync(target, require('./search-page-output.cjs').finish(file, require('./apply-mobile-layout.cjs').improve(html)));
}
const fullLink = (url, label) => `<a href="${guides.esc(url)}" target="_blank" rel="noopener noreferrer">${guides.esc(label)} <i class="fas fa-arrow-right" aria-hidden="true"></i></a>`;
module.exports = {page, fullLink};
