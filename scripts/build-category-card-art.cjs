const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const scope = require('./site-public-pages.cjs');
const art = require('./category-card-art.cjs');
const {mainContent, plain} = require('./page-metadata-content.cjs');
const read = file => fs.readFileSync(path.join(scope.root, file.replace(/^\//, '')), 'utf8');
const exists = file => fs.existsSync(path.join(scope.root, file.replace(/^\//, '').split(/[?#]/)[0]));
const unique = images => { const seen = new Set(); return images.filter(image => image && !seen.has(image.src) && seen.add(image.src)); };
const cleanLabel = value => plain(value).replace(/\s*[·|]\s*(?:official|native|original|project).*$/i, '').replace(/\s+(?:artwork|logo|icon|screenshot|banner)$/i, '').trim();
function image(src, label, sourcePage) {
  if (!src) return null;
  const resolved = art.route(src, sourcePage || 'index.html').split('?')[0];
  if (!resolved.startsWith('/assets/images/') || /\/social\//.test(resolved) || !exists(resolved)) return null;
  return {src: resolved, alt: cleanLabel(label) || 'Project artwork', label: cleanLabel(label) || 'Project artwork', sourcePage: sourcePage || null};
}
function collect(destination) {
  const url = new URL(destination, 'https://whatwhatboy.com'), file = url.pathname.replace(/^\//, '');
  if (!exists(file)) return [];
  const content = mainContent(read(file)), found = [], category = url.searchParams.get('category');
  const openings = /<(?:article|div)\b[^>]*>/gi;
  let opening;
  while ((opening = openings.exec(content))) {
    if (!/^<article\b/.test(opening[0]) && !/\b(?:game-card|pc-emu-card)\b/.test(art.attribute(opening[0], 'class'))) continue;
    const range = art.range(content, opening.index, opening[0]);
    if (!range) continue;
    openings.lastIndex = range.end;
    const block = content.slice(range.start, range.end);
    if (block.includes('data-category-art=')) continue;
    if (category && art.attribute(opening[0], 'data-category') !== category) continue;
    const heading = block.match(/<h[234]\b[^>]*>([\s\S]*?)<\/h[234]>/i)?.[1];
    const tag = block.match(/<img\b[^>]*>/i)?.[0];
    if (!tag || !heading) continue;
    let src = art.attribute(tag, 'src');
    // The older PC list uses Citra's artwork for the successor project. Use
    // the site's existing actual Azahar logo in the new category composition.
    if (plain(heading) === 'Azahar' && /\/Citra\.jpg$/.test(src)) src = '/assets/images/xbox-one-series/azahar.png';
    if (plain(heading) === 'DuckStation' && /\/ePSXe\.jpg$/.test(src)) continue;
    if (/^Xenia(?: Canary)?$/.test(plain(heading))) src = '/assets/images/xbox-one-series/xenia.png';
    if (/^xemu$/i.test(plain(heading))) src = '/assets/images/xbox-one-series/xemu.png';
    if (plain(heading) === 'Cxbx-Reloaded' && /\/cxbx-reloaded\.png$/.test(src)) continue;
    const result = image(src, heading, file);
    if (result) found.push(result);
  }
  return unique(found);
}
function kindFor(slug) {
  if (/game-download|^downloads$|^all-downloads$/.test(slug)) return 'downloads';
  if (/emulat/.test(slug)) return 'emulators';
  if (/theme/.test(slug)) return 'themes';
  if (/^games$/.test(slug)) return 'games';
  if (/^mods$|game-tools/.test(slug)) return 'mods';
  return 'tools';
}
function buildManifest() {
  const platforms = require('./build-console-topic-hubs.cjs').platforms();
  const directories = JSON.parse(read('docs/console-game-directories.json')).platforms;
  const destinations = {};
  function add(route, title, kind, fallback = [], supplied) {
    const key = art.route(route);
    if (!key || !exists(key)) return;
    let candidates = supplied || collect(key);
    if (key === '/pc/emulators.html') {
      const preferred = ['PCSX2', 'Dolphin', 'RPCS3', 'Xenia'];
      candidates = preferred.map(label => candidates.find(item => item.label === label)).filter(Boolean).concat(candidates);
    }
    if (key === '/pc/nintendo-emulators.html') {
      const preferred = ['Dolphin', 'Cemu', 'Azahar', 'mGBA'];
      candidates = preferred.map(label => candidates.find(item => item.label === label)).filter(Boolean).concat(candidates);
    }
    const images = unique(candidates.concat(candidates.length < 2 ? fallback : [])).slice(0, 4);
    if (images.length) destinations[key] = {title, kind, images};
  }
  for (const platform of platforms) {
    const logo = image(`/assets/images/platform-logos/${platform.id}.svg`, platform.title);
    const fallback = unique([image(platform.image, platform.title), logo]);
    for (const group of platform.groups) {
      const destination = group.route || platform.base + group.slug + '.html';
      const groupFallback = unique([image(group.image, group.title), ...fallback]);
      // Setup guides can recommend apps later on the page. Their cover should
      // still show the actual setup artwork, rather than those related apps.
      const setup = /^(?:setup|jailbreak|cfw|firmware|boot-methods|dev-mode|ns2jb|civswitch)$/.test(group.slug);
      let chosen = setup ? unique([image(group.image, group.title), logo]) : undefined;
      if (platform.id === 'psvita' && group.slug === 'jailbreak') chosen = [image(platform.image, 'HENlo setup'), image('/assets/images/expansion-vita/vitadeploy.png', 'VitaDeploy')];
      if (platform.id === 'psvita' && group.slug === 'cfw') chosen = [image('/assets/images/expansion-vita/vitadeploy.png', 'VitaDeploy'), logo];
      add(destination, group.title, kindFor(group.slug), groupFallback, chosen);
    }
    const libraryMix = ['apps', 'emulators', 'games', 'plugins'].map(slug => {
      const group = platform.groups.find(item => item.slug === slug);
      return group && destinations[art.route(group.route || platform.base + group.slug + '.html')]?.images[0];
    }).filter(Boolean);
    add('/' + platform.source + '?view=all', platform.title + ' full library', 'tools', fallback, libraryMix.length > 1 ? unique(libraryMix) : undefined);
  }
  for (const id of ['ps3', 'ps4', 'ps5', 'xbox360']) {
    const fallback = [image(`/assets/images/platform-logos/${id}.svg`, id === 'xbox360' ? 'Xbox 360' : id.toUpperCase())];
    for (const slug of ['jailbreaks', 'jailbreak', 'apps', 'payloads', 'tools', 'transfer-tools', 'save-tools', 'emulators', 'mods', 'downloads', 'firmware', 'dashboards', 'hardware']) add(`/console/${id}/${slug}.html`, `${id.toUpperCase()} ${slug.replaceAll('-', ' ')}`, kindFor(slug), fallback);
  }
  for (const file of ['pc/emulators.html', 'pc/playstation-emulators.html', 'pc/nintendo-emulators.html', 'pc/xbox-emulators.html', 'console/emulators.html', 'console/playstation-emulators.html', 'console/nintendo-emulators.html', 'console/xbox-emulators.html', 'console/nintendo-switch-2-eden.html', 'tools/index.html', 'tools/injectors.html', 'tools/mods.html', 'mods/gta5.html', 'mods/gta4.html', 'mods/rdr2.html', 'mods/skyrim.html', 'console/mods/ps4/index.html', 'console/ps3/mods/index.html', 'console/xbox360/mods/index.html', 'games-downloads/index.html']) {
    if (!exists(file)) continue;
    const title = plain(read(file).match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || file);
    add('/' + file, title, /emulator|eden/.test(file) ? 'emulators' : /mods/.test(file) ? 'mods' : /games-downloads/.test(file) ? 'downloads' : 'tools');
  }
  for (const platform of directories) {
    const topic = platforms.find(p => p.id === platform.id);
    const games = topic?.groups.find(g => g.slug === 'games');
    const gamesRoute = games ? games.route || topic.base + 'games.html' : `/console/${platform.id}/mods/index.html`;
    let examples = collect(gamesRoute);
    // These are illustrations from the platform's existing pages, not a claim
    // that a particular external provider distributes the pictured project.
    if (!examples.length && topic) examples = collect('/' + topic.source);
    const logo = image(`/assets/images/platform-logos/${platform.id}.svg`, platform.title);
    const fallback = unique([logo, image(platform.image, platform.title)]);
    const supplied = unique(examples.slice(0, 3).concat(fallback.slice(0, 1)));
    add(platform.base + 'game-downloads.html', platform.title + ' game downloads', 'downloads', fallback, supplied.length ? supplied : fallback);
  }
  const allGames = directories.map(platform => destinations[art.route(platform.base + 'game-downloads.html')]?.images[0]).filter(Boolean);
  add('/console/game-downloads/index.html', 'Console game downloads', 'downloads', [], allGames.slice(0, 4));
  return {version: 'category-card-art-v1', policy: 'Native HTML/CSS composition of unchanged existing local artwork; sourcePage records identify where projects are listed. No emulator/platform compatibility inferred.', destinations: Object.fromEntries(Object.entries(destinations).sort(([a], [b]) => a.localeCompare(b)))};
}
function links(html) { return [...html.matchAll(/<a\b[^>]*>/gi)].map(match => match[0]); }
function refresh({check = false, build = true} = {}) {
  const manifestPath = path.join(scope.root, 'docs/category-card-art.json');
  const data = build ? buildManifest() : JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const json = JSON.stringify(data, null, 2) + '\n';
  if (check) assert.equal(fs.readFileSync(manifestPath, 'utf8'), json, 'Category artwork manifest needs refresh');
  else fs.writeFileSync(manifestPath, json);
  const changed = [], covered = [], baseline = [];
  for (const file of scope.pages()) {
    const page = scope.relativePath(file), before = fs.readFileSync(file, 'utf8'), after = art.apply(page, before, data);
    baseline.push({page, sha256: crypto.createHash('sha256').update(before).digest('hex')});
    if (after.includes('data-category-art=')) covered.push({page, cards: [...after.matchAll(/data-category-art=/g)].length});
    if (after === before) continue;
    assert.deepEqual(links(after), links(before), page + ': category artwork must retain every link and attribute');
    assert.deepEqual(after.match(/<script\b[\s\S]*?<\/script>/gi), before.match(/<script\b[\s\S]*?<\/script>/gi), page + ': scripts unchanged');
    changed.push(page);
    if (!check) { assert.equal(fs.readFileSync(file, 'utf8'), before, page + ': concurrently changed'); fs.writeFileSync(file, after); }
  }
  if (check) assert.equal(changed.length, 0, 'Category artwork needs refresh: ' + changed.join(', '));
  const result = {destinations: Object.keys(data.destinations).length, coveredPages: covered.length, cards: covered.reduce((n, p) => n + p.cards, 0), changed, covered};
  if (!check) {
    const baselinePath = path.join(scope.root, 'docs/qa/category-card-art-before.json');
    if (!fs.existsSync(baselinePath)) fs.writeFileSync(baselinePath, JSON.stringify({capturedAt: new Date().toISOString(), pages: baseline}, null, 2) + '\n');
    fs.writeFileSync(path.join(scope.root, 'docs/qa/category-card-art-build.json'), JSON.stringify(result, null, 2) + '\n');
  }
  return result;
}
module.exports = {buildManifest, refresh, collect, kindFor};
if (require.main === module) { const r = refresh({check: process.argv.includes('--check')}); console.log(JSON.stringify({destinations: r.destinations, coveredPages: r.coveredPages, cards: r.cards, changed: r.changed.length})); }
