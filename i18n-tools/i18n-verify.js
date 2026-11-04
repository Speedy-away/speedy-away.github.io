/*
 * Checks every dictionary against the strings actually present on the site.
 *
 *   node tools/i18n-verify.js
 *
 * Reports:
 *   - dead keys      : dictionary entries no page contains (typo / stale copy)
 *   - untranslated   : site strings with no entry, worst-covered pages first
 *   - coverage       : per language, share of site strings translated
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const I18N_DIR = path.join(ROOT, 'languages');

// ---- collect the site's real strings (same rules as i18n-extract.js) --------
const { collect } = require('./i18n-extract.js');
const site = collect(ROOT);
const siteKeys = new Set(site.map(e => e.text));

// Strings i18n.js injects into the DOM at runtime. They are genuinely on the
// page but appear in no .html file, so a static scan would call them dead.
['Language'].forEach(k => siteKeys.add(k));

// ---- load each dictionary in a sandbox -------------------------------------
function loadDict(code) {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(I18N_DIR, code + '.js'), 'utf8'), sandbox);
  const q = sandbox.window.__scoobyI18nQueue || [];
  const hit = q.find(p => p[0] === code);
  if (!hit) throw new Error(code + '.js did not register a dictionary');
  return hit[1];
}

const codes = fs.readdirSync(I18N_DIR)
  .filter(f => /^[a-z]{2}\.js$/.test(f))
  .map(f => f.replace('.js', ''));

console.log('site strings:', siteKeys.size, '\n');

let anyDead = false;
const perLang = {};

for (const code of codes) {
  const dict = loadDict(code);
  const keys = Object.keys(dict);
  const dead = keys.filter(k => !siteKeys.has(k));
  const covered = keys.filter(k => siteKeys.has(k));
  perLang[code] = new Set(covered);

  const pct = ((covered.length / siteKeys.size) * 100).toFixed(1);
  console.log(code.toUpperCase() + ':', String(keys.length).padStart(4), 'entries,',
              String(covered.length).padStart(4), 'match site  (' + pct + '% of all site strings)');

  if (dead.length) {
    anyDead = true;
    console.log('   ' + dead.length + ' DEAD KEY(S) - match nothing on the site:');
    dead.slice(0, 25).forEach(k => console.log('     ' + JSON.stringify(k)));
    if (dead.length > 25) console.log('     ... and ' + (dead.length - 25) + ' more');
  }
  // Empty or identical-to-source values usually mean an unfinished entry.
  const empty = keys.filter(k => !dict[k] || !String(dict[k]).trim());
  if (empty.length) console.log('   ' + empty.length + ' EMPTY value(s):', empty.slice(0, 8));
}

// ---- untranslated strings, by page -----------------------------------------
const base = perLang[codes[0]] || new Set();
const missing = site.filter(e => !base.has(e.text));
const byPage = {};
for (const e of missing) for (const f of e.files) byPage[f] = (byPage[f] || 0) + 1;

console.log('\nuntranslated in ' + (codes[0] || '-').toUpperCase() + ': ' + missing.length + ' strings');
console.log('worst-covered pages:');
Object.entries(byPage).sort((a, b) => b[1] - a[1]).slice(0, 12)
  .forEach(([f, n]) => console.log(String(n).padStart(6), f));

process.exit(anyDead ? 1 : 0);
