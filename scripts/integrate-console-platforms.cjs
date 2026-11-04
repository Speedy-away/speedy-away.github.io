// Add the requested console tabs without rebuilding pages or touching download builds.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const platforms = [
  {id:'xbox-one-series',label:'Xbox One / Series X|S',route:'/console/xbox-one-series.html',image:'/assets/images/platform-logos/xbox-one-series.svg',after:'/console/xbox360/'},
  {id:'nintendo-switch-2',label:'Nintendo Switch 2',route:'/console/nintendo-switch-2.html',image:'/assets/images/platform-logos/nintendo-switch-2-symbol.svg',after:'/console/nintendo-switch.html'}
];
const excludedDirectories = new Set(['.git','.agents','.codex','.claude','.playwright','.playwright-cli','node_modules','assets','docs','design-references','downloads','languages','i18n-tools','scripts','tmp']);
const decode = value => String(value).replaceAll('&amp;','&').replaceAll('&quot;','"').replaceAll('&#39;',"'");
const escape = value => String(value).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
function normalizedFile(file) {
  if (!file) return '';
  const relative = path.isAbsolute(file) ? path.relative(root, file) : file;
  return relative.replaceAll('\\','/').replace(/^\/+/, '').split(/[?#]/)[0];
}
function isProtected(file, html = '') {
  const relative = normalizedFile(file);
  return /(?:^|\/)whatsite-ps[45]\.html$/i.test(relative) ||
    relative.startsWith('downloads/') && relative !== 'downloads/index.html' ||
    /id=["']receiver-catalog["']/.test(html) && /<title>PS[45] Download Receiver \| whatwhatboy<\/title>/.test(html);
}
function routePath(value, file) {
  try {
    const url = new URL(decode(value), 'https://whatwhatboy.com/' + (normalizedFile(file) || 'console/index.html'));
    return url.origin === 'https://whatwhatboy.com' ? url.pathname : null;
  } catch { return null; }
}
function currentPlatform(file) {
  const current = '/' + normalizedFile(file);
  return platforms.find(platform => current === platform.route || current.startsWith(platform.route.replace(/\.html$/, '/') ));
}
function availablePlatforms(options = {}) {
  if (options.availableRoutes) return platforms.filter(platform => options.availableRoutes.includes(platform.route));
  const current = currentPlatform(options.file);
  return platforms.filter(platform => current?.id === platform.id || fs.existsSync(path.join(root, platform.route.slice(1))));
}
function consoleListRange(fragment) {
  const opening = /<ul\b(?=[^>]*\bclass=["'][^"']*\bnav-console-list\b)[^>]*>/i.exec(fragment);
  if (!opening) return null;
  const tags = /<\/?ul\b[^>]*>/gi;
  tags.lastIndex = opening.index + opening[0].length;
  let depth = 1, token;
  while (depth && (token = tags.exec(fragment))) depth += /^<\//.test(token[0]) ? -1 : 1;
  return depth ? null : {start:opening.index + opening[0].length, end:token.index};
}
function listItem(platform, active) {
  return `<li data-console-platform="${platform.id}"><a href="${platform.route}" class="nav-link nav-sublink${active ? ' active' : ''}" data-tooltip="${escape(platform.label)}" aria-label="${escape(platform.label)}"${active ? ' aria-current="page"' : ''}><img src="${platform.image}" class="nav-platform-logo" width="44" height="22" alt="" aria-hidden="true"><span>${escape(platform.label)}</span></a></li>`;
}
function integrateConsoleList(fragment, options = {}) {
  const available = availablePlatforms(options);
  if (!available.length) return fragment;
  const topics = require('./console-topic-navigation.cjs');
  const topicRoutes = topics.platforms();
  const canonical = value => topics.resolveRoute(value, options.file || 'console/index.html', topicRoutes);
  // Recognize already-integrated hub aliases so later sidebar refreshes neither
  // duplicate the console nor restore its older complete-library destination.
  const usesTopicRoutes = available.some(platform => canonical(platform.route) !== platform.route && fragment.includes(`href="${canonical(platform.route)}"`));
  const current = currentPlatform(options.file);
  // New console pages used to inherit the generic builder's active PC link.
  // Clear sidebar nav state before selecting their actual console entry.
  if (current) fragment = fragment.replace(/<a\b(?=[^>]*\bclass=["'][^"']*\bnav-link\b)[^>]*>/gi, tag => tag
    .replace(/(\bclass=["'])([^"']*)(["'])/i, (_, start, classes, end) => start + classes.split(/\s+/).filter(name => name !== 'active').join(' ') + end)
    .replace(/\saria-current=["'][^"']*["']/i, ''));
  const range = consoleListRange(fragment);
  if (!range) return fragment;
  let body = fragment.slice(range.start, range.end);
  const originalActive = new Set();
  body = body.replace(/<li\b[^>]*>[\s\S]*?<\/li>/gi, item => {
    const anchor = item.match(/<a\b[^>]*>/i)?.[0];
    const href = anchor?.match(/\bhref=["']([^"']*)["']/i)?.[1];
    const pathname = href && routePath(href, options.file);
    const platform = available.find(p => pathname === p.route || pathname === canonical(p.route) || item.includes(`data-console-platform="${p.id}"`));
    if (!platform) return item;
    if (/\bclass=["'][^"']*\bactive\b/.test(anchor || '') || /\baria-current=["']page["']/.test(anchor || '')) originalActive.add(platform.id);
    return '';
  });
  for (const platform of available) {
    const active = current?.id === platform.id || !options.file && originalActive.has(platform.id);
    const item = listItem(usesTopicRoutes ? {...platform,route:canonical(platform.route)} : platform, active);
    let inserted = false;
    body = body.replace(/<li\b[^>]*>[\s\S]*?<\/li>/gi, original => {
      if (inserted) return original;
      const href = original.match(/<a\b[^>]*\bhref=["']([^"']*)["']/i)?.[1];
      const pathname = href && routePath(href, options.file);
      if (pathname !== platform.after && pathname !== canonical(platform.after) && !(platform.after.endsWith('/') && pathname === platform.after + 'index.html')) return original;
      inserted = true;
      return original + item;
    });
    if (!inserted) body += item;
  }
  return fragment.slice(0, range.start) + body + fragment.slice(range.end);
}
function integratePageConsoleNav(file, html, options = {}) {
  if (isProtected(file, html)) return html;
  const opening = /<(div|nav|aside)\b(?=[^>]*\bid=["']sidebar["'])[^>]*>/i.exec(html);
  if (!opening) return html;
  const tags = new RegExp(`<(/?)${opening[1]}\\b[^>]*>`, 'gi');
  tags.lastIndex = opening.index + opening[0].length;
  let depth = 1, token;
  while (depth && (token = tags.exec(html))) depth += token[1] ? -1 : 1;
  if (depth) throw Error('Unclosed sidebar: ' + file);
  const sidebar = integrateConsoleList(html.slice(opening.index, tags.lastIndex), {...options, file});
  return html.slice(0, opening.index) + sidebar + html.slice(tags.lastIndex);
}
function publicPages(directory = root) {
  return fs.readdirSync(directory, {withFileTypes:true}).flatMap(entry => entry.isDirectory()
    ? excludedDirectories.has(entry.name) ? [] : publicPages(path.join(directory, entry.name))
    : entry.name.endsWith('.html') && !isProtected(path.join(directory, entry.name)) ? [path.join(directory, entry.name)] : []);
}
function integrateConsolePlatforms({check = false} = {}) {
  const missing = platforms.filter(platform => !fs.existsSync(path.join(root, platform.route.slice(1)))).map(platform => platform.route);
  const files = [...publicPages(), path.join(root, 'downloads/index.html')].filter(file => fs.existsSync(file));
  const changed = [];
  for (const file of files) {
    const relative = normalizedFile(file), before = fs.readFileSync(file, 'utf8');
    const after = integratePageConsoleNav(relative, before);
    if (before === after) continue;
    changed.push(relative);
    if (!check) fs.writeFileSync(file, after);
  }
  const report = {checked:files.length,changed:changed.length,missingDestinations:missing,mode:check?'check':'write',pages:changed};
  console.log(JSON.stringify(report));
  return report;
}
module.exports = {platforms, normalizedFile, isProtected, routePath, currentPlatform, availablePlatforms, integrateConsoleList, integratePageConsoleNav, publicPages, integrateConsolePlatforms};
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.some(arg => !['--check','--write'].includes(arg)) || args.includes('--check') && args.includes('--write')) { console.error('Use --check or --write'); process.exitCode = 1; }
  else { const report = integrateConsolePlatforms({check:!args.includes('--write')}); if (!args.includes('--write') && report.changed) process.exitCode = 1; }
}
