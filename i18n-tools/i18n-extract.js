/*
 * Pulls every translatable string out of the site's HTML.
 *
 *   node tools/i18n-extract.js              summary + per-page counts
 *   node tools/i18n-extract.js --list       print every string
 *   node tools/i18n-extract.js --missing es strings with no `es` translation
 *
 * The keys it produces are exactly what the runtime looks up, so anything
 * printed here can be pasted straight into a dictionary file.
 */
const fs = require('fs');
const path = require('path');

const SKIP_DIRS = ['.git', '.claude', 'backup', 'node_modules', 'i18n-tools', 'languages', 'api', 'css2', 'css2-1'];

// Machine-generated reference dumps: function signatures, not prose.
const DUMP = new Set([]);

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

const strip = html => html
  .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
  .replace(/<code\b[\s\S]*?<\/code>/gi, ' ')
  .replace(/<pre\b[\s\S]*?<\/pre>/gi, ' ')
  .replace(/<svg\b[\s\S]*?<\/svg>/gi, ' ')
  .replace(/<!--[\s\S]*?-->/g, ' ');

const NAMED = {
  nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
  mdash: '—', ndash: '–', hellip: '…', copy: '©',
  reg: '®', trade: '™', rsquo: '’', lsquo: '‘',
  ldquo: '“', rdquo: '”', times: '×', deg: '°',
  euro: '€', pound: '£', middot: '·',
};

// Must mirror the browser, since lookups happen against live DOM text.
const decode = s => s
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
  .replace(/&([a-z]+);/gi, (m, n) => (n.toLowerCase() in NAMED ? NAMED[n.toLowerCase()] : m));

const norm = s => decode(s).replace(/\s+/g, ' ').trim();

function isTranslatable(s) {
  if (s.length < 2 || s.length > 400) return false;
  if (!/[A-Za-z]/.test(s)) return false;
  if (!/[aeiouAEIOU]/.test(s)) return false;
  if (/^[\d\s.,%+\-$€£:/]+$/.test(s)) return false;
  if (/^[A-Z0-9_]{4,}$/.test(s)) return false;
  if (/^Scooby[A-Z_.]/.test(s)) return false;                          // API names
  if (/^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)+$/.test(s)) return false; // dotted idents
  if (/^\(.*\)$/.test(s)) return false;                                // (a, b)
  if (/->/.test(s)) return false;                                      // -> type
  if (/^0x[0-9a-f]+/i.test(s)) return false;
  if (/^[a-z]+([A-Z][a-z]*)+$/.test(s)) return false;                  // camelCase
  if (/^[A-Z][a-z]*([A-Z][a-z]*){2,}$/.test(s) && !/\s/.test(s)) return false;
  if (/[{};=]/.test(s) && !/[.!?]/.test(s)) return false;
  if (/^[\w.-]+\.(png|jpe?g|svg|webp|gif|css|js|html?|json|ico|mp4|lua|dll|exe)$/i.test(s)) return false;
  if (/^https?:\/\//i.test(s) || /^[/#]/.test(s)) return false;
  if (/^[{}\[\]()<>|/\\*+•·—–-]+$/.test(s)) return false;
  return true;
}

/** Returns [{ text, files: [relative page paths] }], widest-used first. */
function collect(root) {
  const map = new Map();
  for (const f of walk(root)) {
    const rel = path.relative(root, f).replace(/\\/g, '/');
    const html = strip(fs.readFileSync(f, 'utf8'));
    const found = new Set();

    for (const m of html.matchAll(/>([^<>]+)</g)) {
      const t = norm(m[1]);
      if (isTranslatable(t)) found.add(t);
    }
    for (const m of html.matchAll(/\b(?:placeholder|title|alt|aria-label)\s*=\s*"([^"]+)"/gi)) {
      const t = norm(m[1]);
      if (isTranslatable(t)) found.add(t);
    }
    for (const t of found) {
      if (!map.has(t)) map.set(t, new Set());
      map.get(t).add(rel);
    }
  }

  const all = [...map.entries()].map(([text, s]) => ({ text, files: [...s] }));
  // Drop strings that only ever appear on generated reference dumps.
  const core = all.filter(e => e.files.some(f => !DUMP.has(f)));
  core.sort((a, b) => b.files.length - a.files.length || a.text.localeCompare(b.text));
  return core;
}

module.exports = { collect, isTranslatable, norm, DUMP };

// ------------------------------------------------------------------- CLI ---
if (require.main === module) {
  const ROOT = path.resolve(__dirname, '..');
  const core = collect(ROOT);
  const args = process.argv.slice(2);

  if (args[0] === '--missing') {
    const code = args[1] || 'es';
    const vm = require('vm');
    const sandbox = { window: {} };
    vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'languages', code + '.js'), 'utf8'), sandbox);
    const pair = (sandbox.window.__scoobyI18nQueue || []).find(p => p[0] === code) || [null, {}];
    const dict = pair[1];
    const missing = core.filter(e => dict[e.text] === undefined);
    console.log('// ' + missing.length + ' string(s) with no ' + code + ' translation');
    missing.forEach(e => console.log('    ' + JSON.stringify(e.text) + ': ' + JSON.stringify(e.text) + ','));
    return;
  }

  if (args[0] === '--list') {
    core.forEach(e => console.log(e.text));
    return;
  }

  const words = core.reduce((n, e) => n + e.text.split(/\s+/).length, 0);
  console.log('translatable strings:', core.length, '(' + words + ' words)');
  const per = {};
  core.forEach(e => e.files.forEach(f => { per[f] = (per[f] || 0) + 1; }));
  console.log('\nper page:');
  Object.entries(per).sort((a, b) => b[1] - a[1])
    .forEach(([f, n]) => console.log(String(n).padStart(6), f));
}
