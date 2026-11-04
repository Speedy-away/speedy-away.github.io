// Source-code categories share the same sidebar on generated and existing pages.
const path = require('node:path');
const scope = require('./site-public-pages.cjs');
const entries = [
  {key: 'overview', href: '/source-codes/', label: 'Overview', icon: 'code'},
  {key: 'console', href: '/source-codes/console/', label: 'Console', icon: 'console'},
  {key: 'pc', href: '/source-codes/pc/', label: 'PC', icon: 'desktop'},
  {key: 'other', href: '/source-codes/other/', label: 'Other Projects', icon: 'gameSource'}
];
const shapes = {
  code: '<path d="m8 7-5 5 5 5m8-10 5 5-5 5m-3-14-2 18"/>',
  console: '<rect x="3" y="3" width="8" height="18" rx="2"/><path d="M6 6h2m-2 3h2m7 3h4a2 2 0 0 1 2 1.6l1 4.5a1.7 1.7 0 0 1-2.8 1.7L17 18h-2"/><circle cx="7" cy="17" r=".75" fill="currentColor" stroke="none"/><path d="M16 14v2m-1-1h2"/>',
  desktop: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M3 8h18m-9 9v3m-4 0h8"/>',
  gameSource: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Zm0 0v6h6m-10 3-3 3 3 3m4-6 3 3-3 3"/>',
  chevron: '<path d="m5 8 7 7 7-7"/>'
};
function icon(name, caret = false) {
  return `<svg class="nav-icon${caret ? ' nav-caret' : ''}" data-nav-icon="${name}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${caret ? 12 : 20}" height="${caret ? 12 : 20}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${shapes[name]}</svg>`;
}
function normalized(file = '') {
  const value = file.replaceAll('\\', '/');
  const root = scope.root.replaceAll('\\', '/');
  return (value.toLowerCase().startsWith(root.toLowerCase() + '/') ? path.relative(scope.root, file).replaceAll('\\', '/') : value).replace(/^\/+/, '').split(/[?#]/)[0];
}
function currentCategory(file) {
  const relative = normalized(file).replace(/index\.html$/, '');
  if (relative === 'source-codes/' || relative === 'source-codes/games/gta5/') return 'overview';
  if (/^source-codes\/(?:console\/|games\/)/.test(relative)) return 'console';
  if (relative.startsWith('source-codes/pc/')) return 'pc';
  if (relative.startsWith('source-codes/other/')) return 'other';
  return null;
}
function group(file = '') {
  const category = currentCategory(file);
  const relative = normalized(file).replace(/index\.html$/, '');
  const links = entries.map(entry => {
    const active = category === entry.key;
    const exact = relative === entry.href.slice(1);
    return `<li><a href="${entry.href}" class="nav-link nav-sublink${active ? ' active' : ''}" data-tooltip="${entry.label}" aria-label="${entry.label}"${active ? ` aria-current="${exact ? 'page' : 'location'}"` : ''}>${icon(entry.icon)}<span>${entry.label}</span></a></li>`;
  }).join('');
  return `<li class="nav-group${category ? ' open' : ''}" data-nav-section="source-codes"><button type="button" class="nav-link nav-group-toggle" aria-expanded="${Boolean(category)}" data-tooltip="Source Codes" aria-label="Source Codes">${icon('code')}<span>Source Codes</span>${icon('chevron', true)}</button><ul class="nav-sublist">${links}</ul></li>`;
}
function integrateSourceCodes(fragment, file = '') {
  const opening = /<li\b(?=[^>]*\bdata-nav-section=["']source-codes["'])[^>]*>/i.exec(fragment);
  const replacement = group(file);
  if (opening) {
    // Match the enclosing LI rather than stopping at the first child link.
    const tags = /<(\/?)li\b[^>]*>/gi;
    tags.lastIndex = opening.index + opening[0].length;
    let depth = 1, tag;
    while (depth && (tag = tags.exec(fragment))) depth += tag[1] ? -1 : 1;
    if (depth) throw new Error('Unclosed Source Codes navigation group: ' + file);
    return fragment.slice(0, opening.index) + replacement + fragment.slice(tags.lastIndex);
  }
  const anchor = /<li\b[^>]*>\s*<a\b(?=[^>]*\bdata-tooltip=["']Tools["'])[^>]*>/i;
  return fragment.replace(anchor, replacement + '\n                $&');
}
function apply(file, html) {
  const relative = normalized(file);
  if (!scope.eligible(relative) || /\bid=["']receiver-catalog["']/.test(html)) return html;
  return html.replace(/<nav\b(?=[^>]*\bclass=["'][^"']*\bsidebar-nav\b)[^>]*>[\s\S]*?<\/nav>/i, fragment => integrateSourceCodes(fragment, relative));
}
module.exports = {entries, normalized, currentCategory, group, integrateSourceCodes, apply};
