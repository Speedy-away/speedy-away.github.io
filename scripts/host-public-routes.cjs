'use strict';

const fs = require('node:fs');
const path = require('node:path');
const origin = 'https://speedy-away.github.io';
const views = ['payloads', 'mods', 'tools', 'connection', 'sender'];
const sections = ['downloads', 'packages', 'patches', 'files', 'firmware', 'payload-manager', 'lua'];

function routes() {
  return ['ps4', 'ps5'].flatMap(platform => {
    const canonical = 'hosts/' + platform + '/';
    const short = platform + '/';
    const platformViews = platform === 'ps4' ? views.concat('goldhen') : views;
    const platformSections = platform === 'ps4' ? sections.concat('cheats') : sections;
    return [
      {source: canonical + 'index.html', target: short + 'index.html'},
      ...platformViews.map(view => ({source: canonical + 'index.html', target: short + view + '/index.html', view})),
      ...platformSections.map(section => ({
        source: canonical + section + '/index.html', target: short + section + '/index.html'
      }))
    ];
  });
}

function shortLink(url, available) {
  if (url.origin !== origin || url.username || url.password) return null;
  const source = url.pathname.replace(/\/index\.html$/, '/').replace(/\/?$/, '/');
  const platform = /^\/hosts\/(ps[45])\/$/.exec(source)?.[1];
  const view = platform && (url.searchParams.get('view') || url.searchParams.get('folder'));
  const target = view && available.get(source + '?view=' + view) || available.get(source);
  if (!target) return null;
  if (view && (target === '/' + platform + '/' + view + '/' || view === 'loaders')) {
    url.searchParams.delete('view');
    url.searchParams.delete('folder');
  }
  return {url: target + url.search + url.hash, view: platform && (view || 'loaders')};
}

function rewrite(html, source, available, absoluteReferences) {
  const page = origin + '/' + source;
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>|<(?:a|link|img|source|video|audio|form|input)\b[^>]*>/gi, element => {
    const tag = element.match(/^<[^>]+>/)[0];
    const anchor = /^<a\b/i.test(tag);
    let view;
    const updated = tag.replace(/(\s(?:href|src|data-host-src|poster|action)\s*=\s*)(["'])([^"']+)\2/gi, (attr, key, quote, value) => {
      if (value.startsWith('#')) return attr;
      let url;
      try { url = new URL(value.replaceAll('&amp;', '&'), page); } catch (_) { return attr; }
      if (anchor && /^\s+href\s*=/i.test(key)) {
        const short = shortLink(url, available);
        if (short) {
          view = short.view;
          return key + quote + short.url.replaceAll('&', '&amp;') + quote;
        }
      }
      if (absoluteReferences && !/^(?:[a-z][a-z0-9+.-]*:|\/)/i.test(value)) {
        return key + quote + (url.pathname + url.search + url.hash).replaceAll('&', '&amp;') + quote;
      }
      return attr;
    });
    const mark = view && !/\bdata-host-view=/.test(updated) && /^[a-z]+$/.test(view);
    return (mark ? updated.slice(0, -1) + ' data-host-view="' + view + '">' : updated) + element.slice(tag.length);
  });
}

function build(output, hosted) {
  const available = new Map();
  const entries = routes().filter(route => hosted.has(route.source));
  const generated = [];
  for (const route of entries) {
    if (hosted.has(route.target)) throw Error('Short host route collides with an existing file: ' + route.target);
    const canonical = '/' + route.source.replace(/index\.html$/, '');
    const key = canonical + (route.view ? '?view=' + route.view : '');
    available.set(key, '/' + route.target.replace(/index\.html$/, ''));
  }
  for (const route of entries) {
    const destination = path.join(output, route.target);
    const source = fs.readFileSync(path.join(output, route.source), 'utf8');
    let page = rewrite(source, route.source, available, true);
    if (route.view) page = page.replace(/<html\b/i, '<html data-host-view="' + route.view + '"');
    fs.mkdirSync(path.dirname(destination), {recursive: true});
    fs.writeFileSync(destination, page);
    generated.push(route.target);
  }
  for (const name of hosted) {
    if (!/^(?:index\.html|hosts\/(?!runtime\/).+\.html|ps[45]\/.+\/index\.html|offline\/ps[45]\/index\.html)$/.test(name)) continue;
    const file = path.join(output, name);
    const source = fs.readFileSync(file, 'utf8');
    if (/http-equiv=["']refresh/i.test(source)) continue;
    const updated = rewrite(source, name, available, false);
    if (updated !== source) fs.writeFileSync(file, updated);
  }
  return generated;
}

module.exports = {routes, build};
