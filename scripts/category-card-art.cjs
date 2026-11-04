// Presentation only: compose existing, unmodified project artwork in category cards.
const fs = require('node:fs');
const path = require('node:path');
const scope = require('./site-public-pages.cjs');
const {decode, plain} = require('./page-metadata-content.cjs');
const origin = 'https://whatwhatboy.com';
const manifestFile = path.join(scope.root, 'docs/category-card-art.json');
const esc = value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
let cached, stamp;
function manifest() {
  if (!fs.existsSync(manifestFile)) return {destinations: {}};
  const stat = fs.statSync(manifestFile), next = `${stat.mtimeMs}:${stat.size}`;
  if (stamp !== next) { cached = JSON.parse(fs.readFileSync(manifestFile, 'utf8')); stamp = next; }
  return cached;
}
function attribute(tag, key) {
  return decode(tag.match(new RegExp(`(?:^|\\s)${key}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, 'i'))?.[2] || '');
}
function route(value, file = 'index.html') {
  try {
    const url = new URL(decode(value), `${origin}/${file}`);
    if (url.origin !== origin || !/^https?:$/.test(url.protocol)) return '';
    const pathname = url.pathname.endsWith('/') ? url.pathname + 'index.html' : url.pathname;
    return pathname + url.search;
  } catch { return ''; }
}
function range(html, start, opening) {
  const name = opening.match(/^<([\w-]+)/)[1], tags = new RegExp(`<(/?)${name}\\b[^>]*>`, 'gi');
  tags.lastIndex = start + opening.length;
  let depth = 1, token;
  while (depth && (token = tags.exec(html))) depth += token[1] ? -1 : 1;
  return depth ? null : {start, end: tags.lastIndex, close: token.index};
}
function cards(html) {
  const result = [], tags = /<(?:article|div|a)\b[^>]*>/gi;
  let token;
  while ((token = tags.exec(html))) {
    if (!/(?:^|\s)(?:guide-resource|game-card|emulator-card|console-card|tool-card|category-card|platform-card)(?:\s|$)/.test(attribute(token[0], 'class'))) continue;
    const found = range(html, token.index, token[0]);
    if (found) { result.push({...found, html: html.slice(found.start, found.end)}); tags.lastIndex = found.end; }
  }
  return result;
}
function media(config, key) {
  const merged = require('./merged-category-covers.cjs').render(key, config);
  if (merged) return merged;
  if (!Array.isArray(config.images) || !config.images.length || config.images.length > 4) throw Error('Invalid category image count: ' + key);
  const badge = config.kind === 'downloads' ? '<span class="category-art__download" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3v12m-4-4 4 4 4-4M4 17v4h16v-4"/></svg></span>' : '';
  return `<div class="category-art category-art--${esc(config.kind)} category-art--${config.images.length}" data-category-art="${esc(key)}">${config.images.map(image => `<figure class="category-art__item"><img${image.src.includes('/platform-logos/') ? ' class="category-art__platform"' : ''} src="${esc(image.src)}" alt="${esc(image.alt)}" loading="lazy" decoding="async"><figcaption>${esc(image.label || image.alt)}</figcaption></figure>`).join('')}${badge}</div>`;
}
function isCategory(title, config, file, opening) {
  if (/\bdata-file-id=|\bconsole-download-card\b/.test(opening)) return false;
  if (/^(?:console\/index|console\/game-downloads\/index|console\/mods\/index|pc\/emulators)\.html$/.test(file)) return true;
  const name = plain(title).toLowerCase();
  if (name === config.title.toLowerCase()) return true;
  return /\b(?:emulators?|themes|plugins|tools|payloads|downloads|mods)\b|\bmod menus\b|^(?:games & source ports|homebrew games|apps\b|firmware\b|jailbreak\b|cfw\b|storage\b|files & desktop|launchers\b|remote play|setup\b|universal mod managers)|homebrew (?:setup|guide|boot)/.test(name);
}
function apply(file, html, data = manifest()) {
  const relative = scope.relativePath(file);
  if (!scope.eligible(relative) || /\bid=["']receiver-catalog["']/i.test(html)) return html;
  let changed = false;
  // Broad PC emulation headers should represent their catalogue, rather than
  // using one emulator's logo as the artwork for every system.
  if (/^pc\/(?:index|emulators|(?:playstation|nintendo|xbox)-emulators)\.html$/.test(relative)) {
    const key = relative === 'pc/index.html' ? '/pc/emulators.html' : '/' + relative;
    if (data.destinations?.[key]) html = html.replace(/<header\b[^>]*class="[^"]*\bguide-hero\b[^>]*>[\s\S]*?<\/header>/i, header => {
      const old = /<div\b(?=[^>]*\bdata-category-art=)[^>]*>/i.exec(header);
      const replacement = media(data.destinations[key], key);
      if (old) { const found = range(header, old.index, old[0]); if (found) return header.slice(0, found.start) + replacement + header.slice(found.end); }
      return header.replace(/<img\b(?=[^>]*\bwidth="1280")(?=[^>]*\bheight="720")[^>]*>/i, replacement);
    });
  }
  for (const card of cards(html).reverse()) {
    const heading = card.html.match(/<h[23]\b[^>]*>[\s\S]*?<\/h[23]>/i);
    if (!heading) continue;
    let chosen;
    for (const match of card.html.matchAll(/<a\b[^>]*>/gi)) {
      const href = attribute(match[0], 'href');
      if (!href || href.startsWith('#') || /\bdownload(?:\s|=|>)/i.test(match[0])) continue;
      if (!route(href, relative)) continue;
      if (href.includes('#') && !/[?&]category=/.test(href)) break;
      const key = route(href, relative), config = data.destinations?.[key];
      if (config && key !== route(relative) && isCategory(heading[0], config, relative, card.html.match(/^<[^>]*>/)[0])) { chosen = {key, config}; break; }
      break;
    }
    // Some home cards are a single link wrapped around the image and title.
    if (!chosen && /^<a\b/.test(card.html)) {
      const key = route(attribute(card.html.match(/^<a\b[^>]*>/)[0], 'href'), relative);
      if (data.destinations?.[key] && isCategory(heading[0], data.destinations[key], relative, card.html.match(/^<[^>]*>/)[0])) chosen = {key, config: data.destinations[key]};
    }
    if (!chosen) continue;
    const beforeTitle = card.html.slice(0, heading.index);
    let imageRange;
    const oldMix = /<div\b(?=[^>]*(?:\bdata-category-art=|\bclass="[^"]*\bguide-card-media\b))[^>]*>/i.exec(beforeTitle);
    if (oldMix) imageRange = range(card.html, oldMix.index, oldMix[0]);
    else {
      const image = /<img\b[^>]*>/i.exec(beforeTitle);
      if (image) imageRange = {start: image.index, end: image.index + image[0].length};
    }
    // Category navigation cards without artwork get the same treatment.
    // Detailed resource entries remain outside the destination map.
    if (!imageRange) imageRange = {start: heading.index, end: heading.index};
    const replacement = media(chosen.config, chosen.key);
    const updated = card.html.slice(0, imageRange.start) + replacement + card.html.slice(imageRange.end);
    if (updated !== card.html) { changed = true; html = html.slice(0, card.start) + updated + html.slice(card.end); }
  }
  // Retained hash links (for example Firmware) keep their exact destination,
  // while their previously composed artwork still receives the merged cover.
  const retained=[...html.matchAll(/<div\b(?=[^>]*\bdata-category-art=)[^>]*>/gi)];
  for(const match of retained.reverse()){
    if(attribute(match[0],'class').includes('category-art--merged'))continue;
    const key=attribute(match[0],'data-category-art'),config=data.destinations?.[key];
    if(!config)continue;
    const found=range(html,match.index,match[0]);
    if(found){html=html.slice(0,found.start)+media(config,key)+html.slice(found.end);changed=true;}
  }
  if (changed || html.includes('data-category-art=')) {
    const tag = '<link rel="stylesheet" href="/assets/category-card-art.css?v=2">';
    let found = false;
    html = html.replace(/<link\b(?=[^>]*href=["'][^"']*\/assets\/category-card-art\.css(?:\?[^"']*)?["'])[^>]*>/gi, () => { if (found) return ''; found = true; return tag; });
    if (!found) html = html.replace('</head>', tag + '\n</head>');
  }
  return html;
}
module.exports = {apply, cards, range, route, media, attribute, plain, isCategory};
