// Organize the existing, preserved console libraries into the shared topic layout.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const manifestFiles = ['docs/console-topic-platforms-retro.json', 'docs/console-topic-platforms-modern.json'];
const decode = value => value.replaceAll('&amp;', '&').replaceAll('&quot;', '"').replaceAll('&#39;', "'");
const reEscape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const esc = value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

function platforms() { return manifestFiles.flatMap(file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'))); }
function attribute(tag, name) {
  const match = tag.match(new RegExp(`(?:^|\\s)${reEscape(name)}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, 'i'));
  return match ? decode(match[2]) : null;
}
function elementRange(html, opening, offset) {
  const name = opening.match(/^<([\w-]+)/)[1];
  const tags = new RegExp(`<(/?)${name}\\b[^>]*>`, 'gi');
  tags.lastIndex = offset + opening.length;
  let depth = 1, token;
  while (depth && (token = tags.exec(html))) depth += token[1] ? -1 : /\/>$/.test(token[0]) ? 0 : 1;
  if (depth) throw Error(`Unclosed ${name} at ${offset}`);
  return {start: offset, end: tags.lastIndex};
}
function capture(html, id) {
  const tags = /<[a-z][\w-]*\b[^>]*>/gi;
  let token;
  while ((token = tags.exec(html))) if (attribute(token[0], 'id') === id) {
    const range = elementRange(html, token[0], token.index);
    return html.slice(range.start, range.end);
  }
  throw Error(`Missing source section: ${id}`);
}
function filterArticles(html, category) {
  if (!category) return html;
  const tags = /<article\b[^>]*>/gi;
  const removals = [];
  let token;
  while ((token = tags.exec(html))) {
    const value = attribute(token[0], category.attribute);
    if (value !== null && !category.values.includes(value)) removals.push(elementRange(html, token[0], token.index));
  }
  for (const range of removals.reverse()) html = html.slice(0, range.start) + html.slice(range.end);
  return html;
}
function normalize(html, source, ids) {
  return html.replace(/\b(href|src|poster|action)\s*=\s*(["'])(.*?)\2/gi, (all, attr, quote, raw) => {
    const value = decode(raw);
    if (!value || /^(?:https?:|mailto:|tel:|data:|javascript:|\/\/)/i.test(value)) return all;
    if (attr.toLowerCase() === 'href' && value.startsWith('#') && ids.has(value.slice(1))) return all;
    const url = new URL(value, 'https://whatwhatboy.com/' + source);
    return `${attr}=${quote}${esc(url.pathname + url.search + url.hash)}${quote}`;
  });
}
function sourceExtras(html, source) {
  const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1] || '';
  const styles = [...head.matchAll(/<link\b(?=[^>]*\brel="stylesheet")[^>]*>/gi)].map(m => m[0]);
  const scripts = [...html.matchAll(/<script\b[^>]*\bsrc="[^"]+"[^>]*>\s*<\/script>/gi)].map(m => m[0]);
  const templates = [...html.matchAll(/<template\b[^>]*>[\s\S]*?<\/template>/gi)].map(m => m[0]);
  return {styles: normalize(styles.join('\n'), source, new Set()), scripts: normalize(scripts.join('\n'), source, new Set()), templates: templates.join('\n')};
}
const hubPath = platform => platform.hubFile ? '/' + platform.hubFile.replace(/^\//, '') : platform.base;
const libraryPath = platform => '/' + platform.source + '?view=all';
const topicPath = (platform, group) => group.route || platform.base + group.slug + '.html';
function navigation(platform) {
  return [[hubPath(platform), platform.title], ...platform.groups.map(group => [topicPath(platform, group), group.title]), [libraryPath(platform), 'All downloads']];
}
function actionLabel(group) {
  const labels = {setup: 'Open setup guide', 'boot-methods': 'Choose your boot method', 'dev-mode': 'Set up Developer Mode', apps: 'Browse apps', emulators: 'Browse emulators', games: 'Browse games', themes: 'Browse themes', storage: 'View storage guide', 'save-disc-tools': 'Open save & disc tools', firmware: 'Browse firmware', 'save-tools': 'Browse save tools', plugins: 'Browse plugins', cfw: 'Browse CFW tools', mods: 'Browse game mods', 'app-store': 'Open App Store', launchers: 'Browse launchers', 'remote-play': 'Set up remote play', tools: 'Browse tools', 'device-portal': 'Open Device Portal', install: 'View installation guide', dependencies: 'Browse frameworks', 'retail-mode': 'View Retail Mode guide', ns2jb: 'Read project requirements', civswitch: 'Open CivSwitch', 'game-tools': 'Browse game tools', gamecube: 'Open GameCube tools'};
  return group.action || labels[group.slug] || 'Open this page';
}
function postprocess(file, platform, {source, extras, topic = false} = {}) {
  const target = path.join(root, file);
  let html = fs.readFileSync(target, 'utf8');
  html = html.replace(/<div class="container guide-hero-grid(?: guide-hero-text)?">/, '<div class="container guide-hero-grid guide-hero-text">')
    .replace(/<img src="[^"]*" alt="[^"]*" width="1280" height="720">/, '')
    .replace('<body class="console-guide">', `<body class="console-guide console-topic-page" data-console-topic="${platform.id}">`)
    .replace('</head>', '<link rel="stylesheet" href="/assets/console-topics.css?v=1">\n</head>');
  // A complete old library remains a deliberate destination, never a hub alias.
  html = html.replace(/<a\b[^>]*>/gi, tag => attribute(tag, 'href') === '/' + platform.source && !/\bdata-console-library\b/.test(tag) ? tag.replace('<a ', '<a data-console-library ') : tag);
  html = html.replace(/\balt="([^"]*)"/g, (_, value) => `alt="${value.replaceAll('&amp;amp;', '&amp;')}"`);
  if (topic && source) {
    const bodyTag = source.match(/<body\b[^>]*>/i)?.[0] || '';
    const classes = attribute(bodyTag, 'class') || '';
    html = html.replace('console-guide console-topic-page', [...new Set(('console-guide console-topic-page ' + classes).split(/\s+/))].join(' '));
    for (const tag of extras.styles.match(/<link\b[^>]*>/gi) || []) {
      const href = attribute(tag, 'href');
      const pathname = href?.split('?')[0];
      if (pathname && !new RegExp(`href="${reEscape(pathname)}(?:[?"])`).test(html)) html = html.replace('</head>', tag + '\n</head>');
    }
    for (const tag of extras.scripts.match(/<script\b[^>]*>\s*<\/script>/gi) || []) {
      const src = attribute(tag, 'src');
      const pathname = src?.split('?')[0];
      if (pathname && !/(?:invoke|console-topic-entry)\.js$/.test(pathname) && !new RegExp(`src="${reEscape(pathname)}(?:[?"])`).test(html)) html = html.replace('</body>', tag + '\n</body>');
    }
    for (const template of extras.templates.match(/<template\b[^>]*>[\s\S]*?<\/template>/gi) || []) {
      const id = attribute(template.match(/^<template\b[^>]*>/)[0], 'id');
      if (!id || !html.includes(`id="${id}"`)) html = html.replace('</body>', template + '\n</body>');
    }
  }
  // The original console theme and shared mobile behavior are kept on every page.
  html = require('./apply-site-background.cjs').improve(html, file);
  html = require('./apply-mobile-layout.cjs').improve(html);
  fs.writeFileSync(target, html);
}
function buildPlatform(platform) {
  const guides = require('./build-console-guides.cjs');
  const nav = navigation(platform);
  const original = fs.readFileSync(path.join(root, platform.source), 'utf8');
  const generated = [];
  for (const group of platform.groups) {
    if (group.route) continue;
    const sourceFile = group.source || platform.source;
    const source = sourceFile === platform.source ? original : fs.readFileSync(path.join(root, sourceFile), 'utf8');
    let content = group.sections.map(id => capture(source, id)).join('\n');
    content = filterArticles(content, group.category);
    content = require('./console-topic-focus.cjs').focusContent(content, group, platform);
    const ids = new Set([...content.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
    content = normalize(content, sourceFile, ids);
    // Steam Deck purpose groups are nested sections with h3 headings; give them the standard topic container.
    if (!/class="[^"]*\bcontainer\b/.test(content)) content = guides.section('topic', esc(group.title), content);
    const file = topicPath(platform, group).slice(1);
    const more = guides.section('console-pages', `More for ${esc(platform.title)}`, `<div class="guide-links"><a href="${hubPath(platform)}">${esc(platform.title)} home <i class="fas fa-arrow-right" aria-hidden="true"></i></a><a data-console-library href="${libraryPath(platform)}">Browse all downloads <i class="fas fa-arrow-right" aria-hidden="true"></i></a></div>`);
    guides.page(file, `${platform.title} · ${group.title}`, group.description, group.image || platform.image, nav, content + more, '#' + (group.sections[0] || 'topic'), 'Browse this page');
    postprocess(file, platform, {source, extras: sourceExtras(source, sourceFile), topic: true});
    generated.push(file);
  }
  const cards = platform.groups.map(group => guides.resource(esc(group.title), esc(group.description), `<a href="${esc(topicPath(platform, group))}">${esc(actionLabel(group))} <i class="fas fa-arrow-right" aria-hidden="true"></i></a>`, group.image || platform.image));
  cards.push(guides.resource('All downloads', `Search the complete ${esc(platform.title)} library, including existing releases and their setup requirements.`, `<a data-console-library href="${libraryPath(platform)}">Open the complete library <i class="fas fa-arrow-right" aria-hidden="true"></i></a>`, platform.image));
  const file = platform.hubFile || platform.base.slice(1) + 'index.html';
  guides.page(file, platform.hubTitle || `${platform.title} Homebrew`, platform.description, platform.image, nav, guides.section('start', `${esc(platform.title)} guides &amp; downloads`, guides.grid(...cards), 'Choose a category, then check the requirements for your console and software.'), '#start', 'Choose a page');
  postprocess(file, platform);
  generated.push(file);
  return generated;
}
function finalizeMetadata(files) {
  const reportFile = path.join(root, 'docs/seo/page-metadata.json');
  const previous = fs.existsSync(reportFile) ? JSON.parse(fs.readFileSync(reportFile, 'utf8')) : {pages: []};
  const replacements = new Map();
  for (const file of files) {
    const target = path.join(root, file);
    const before = fs.readFileSync(target, 'utf8');
    const illustrated = require('./category-card-art.cjs').apply(file, before);
    const searchable = require('./page-search-tags.cjs').apply(file, illustrated);
    const result = require('./page-search-metadata.cjs').transform(file, searchable);
    fs.writeFileSync(target, result.html);
    if (result.metadata) replacements.set(file, result.metadata);
  }
  const rows = (previous.pages || []).map(row => replacements.get(row.page) || row);
  const known = new Set((previous.pages || []).map(row => row.page));
  rows.push(...[...replacements.values()].filter(row => !known.has(row.page)));
  fs.writeFileSync(reportFile, JSON.stringify({...previous, pages: rows}, null, 2) + '\n');
}
function main({integrate = true} = {}) {
  const list = platforms();
  const files = list.flatMap(buildPlatform);
  const sitemapFile = path.join(root, 'sitemap.xml');
  let sitemap = fs.readFileSync(sitemapFile, 'utf8');
  for (const file of files) {
    const url = 'https://whatwhatboy.com/' + file.replace(/index\.html$/, '');
    if (!sitemap.includes('<loc>' + url + '</loc>')) sitemap = sitemap.replace('</urlset>', `  <url><loc>${url}</loc><lastmod>2026-11-02</lastmod></url>\n</urlset>`);
  }
  fs.writeFileSync(sitemapFile, sitemap);
  // Keep this organizer independent of unrelated, concurrently edited catalogues.
  finalizeMetadata(files);
  for (const file of files) {
    const target = path.join(root, file);
    fs.writeFileSync(target, require('./apply-site-background.cjs').improve(fs.readFileSync(target, 'utf8'), file));
  }
  const navigationFile = path.join(__dirname, 'console-topic-navigation.cjs');
  if (integrate && fs.existsSync(navigationFile)) require(navigationFile).main();
  const report = {platforms: list.length, generatedPages: files.length, files};
  fs.mkdirSync(path.join(root, 'docs/qa'), {recursive: true});
  fs.writeFileSync(path.join(root, 'docs/qa/console-topic-hubs-build.json'), JSON.stringify(report, null, 2) + '\n');
  return report;
}
module.exports = {platforms, attribute, capture, filterArticles, normalize, navigation, hubPath, libraryPath, topicPath, buildPlatform, finalizeMetadata, main};
if (require.main === module) console.log(JSON.stringify(main(), null, 2));
