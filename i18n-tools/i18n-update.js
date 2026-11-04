/*
 * Keeps every dictionary in sync with the site's actual text.
 *
 *   node tools/i18n-update.js                 report drift, change nothing
 *   node tools/i18n-update.js --apply         refresh the to-translate lists
 *   node tools/i18n-update.js --merge         fold finished translations back in
 *   node tools/i18n-update.js --prune         drop entries no page uses any more
 *   node tools/i18n-update.js --watch         re-report whenever a page changes
 *   node tools/i18n-update.js --lang tr       restrict to one language
 *   node tools/i18n-update.js --install-hook  report drift on every git commit
 *
 * Round trip:
 *   1. Content changes on the site.
 *   2. --apply writes languages/_todo/<lang>.js listing the new English strings
 *      as "English": "English" placeholders.
 *   3. You translate the right-hand sides in that file.
 *   4. --merge moves every finished line into languages/<lang>.js and drops it
 *      from the to-do list.
 *
 * The to-do files deliberately live outside assets/, so untranslated
 * placeholders are never shipped to visitors. Untranslated strings already
 * fall back to English at runtime, so shipping them would be pure dead weight.
 *
 * Exit code is 1 while anything is out of sync, which makes it usable as a
 * commit hook or CI gate.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { collect } = require('./i18n-extract.js');

const ROOT = path.resolve(__dirname, '..');
const I18N = path.join(ROOT, 'languages');
const TODO = path.join(ROOT, 'languages', '_todo');

const argv = process.argv.slice(2);
const has = f => argv.includes(f);
const APPLY = has('--apply');
const MERGE = has('--merge');
const PRUNE = has('--prune');
const WATCH = has('--watch');
const ONLY = (() => { const i = argv.indexOf('--lang'); return i > -1 ? argv[i + 1] : null; })();

const MERGED_BEGIN = '/* ===== merged by tools/i18n-update.js ===== */';

// ---------------------------------------------------------------- helpers ---

const langs = () => fs.readdirSync(I18N)
  .filter(f => /^[a-z]{2}\.js$/.test(f))
  .map(f => f.replace('.js', ''))
  .filter(c => !ONLY || c === ONLY);

function sandboxLoad(file, code) {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox);
  const pair = (sandbox.window.__scoobyI18nQueue || []).find(p => p[0] === code);
  return pair ? pair[1] : {};
}

const loadDict = code => sandboxLoad(path.join(I18N, code + '.js'), code);

function loadTodo(code) {
  const f = path.join(TODO, code + '.js');
  if (!fs.existsSync(f)) return {};
  try { return sandboxLoad(f, code); } catch (e) { return {}; }
}

function writeTodo(code, entries) {
  if (!fs.existsSync(TODO)) fs.mkdirSync(TODO, { recursive: true });
  const f = path.join(TODO, code + '.js');
  if (!entries.length) { if (fs.existsSync(f)) fs.unlinkSync(f); return; }

  const body = entries.map(([k, v]) => '    ' + JSON.stringify(k) + ': ' + JSON.stringify(v) + ',')
                      .join('\n').replace(/,$/, '');
  const out =
`/* ${code} — strings still awaiting translation.
   Translate the RIGHT-hand side of each line, then run:
       node tools/i18n-update.js --merge
   Finished lines move into languages/${code}.js and disappear from here.
   Lines left identical to the English are treated as not yet done.
   This file is never loaded by the website. */
(function () {
  var t = {
${body}
  };

  if (window.__scoobyI18n) window.__scoobyI18n.register(${JSON.stringify(code)}, t);
  else (window.__scoobyI18nQueue = window.__scoobyI18nQueue || []).push([${JSON.stringify(code)}, t]);
})();
`;
  fs.writeFileSync(f, out, 'utf8');
}

/** Removes `"key": ...,` lines for the given keys. */
function removeKeys(src, keys) {
  if (!keys.size) return src;
  return src.split('\n').filter(line => {
    const m = line.match(/^\s*("(?:[^"\\]|\\.)*")\s*:/);
    if (!m) return true;
    try { return !keys.has(JSON.parse(m[1])); } catch (e) { return true; }
  }).join('\n');
}

/** Appends entries just before the dictionary object's closing `};`. */
function appendEntries(src, entries) {
  if (!entries.length) return src;
  const close = src.lastIndexOf('\n  };');
  if (close === -1) throw new Error('could not find the end of the dictionary object');

  let head = src.slice(0, close);
  const tail = src.slice(close);
  head = head.replace(/,?\s*$/, ',');           // previous entry needs a comma

  const marker = src.includes(MERGED_BEGIN) ? '' : '\n\n    ' + MERGED_BEGIN;
  const body = entries.map(([k, v]) => '    ' + JSON.stringify(k) + ': ' + JSON.stringify(v) + ',')
                      .join('\n').replace(/,$/, '');
  return head + marker + '\n' + body + tail;
}

// ------------------------------------------------------------------- main ---

function run() {
  const site = collect(ROOT);
  const siteKeys = site.map(e => e.text);
  const siteSet = new Set(siteKeys);
  const codes = langs();

  console.log('site strings: ' + siteSet.size + '   dictionaries: ' + codes.length +
              (ONLY ? '  (only ' + ONLY + ')' : ''));
  console.log('');

  const rows = [];
  let anyDrift = false;

  for (const code of codes) {
    const file = path.join(I18N, code + '.js');
    let src = fs.readFileSync(file, 'utf8');
    let dict = loadDict(code);
    const todo = loadTodo(code);

    let mergedCount = 0, prunedCount = 0;

    // ---- fold finished translations back into the real dictionary ----
    if (MERGE) {
      const done = Object.entries(todo).filter(([k, v]) => v && v !== k && siteSet.has(k));
      if (done.length) {
        src = appendEntries(src, done);
        fs.writeFileSync(file, src, 'utf8');
        dict = loadDict(code);
        mergedCount = done.length;
      }
      const remaining = Object.entries(todo).filter(([k, v]) => (!v || v === k) && siteSet.has(k));
      writeTodo(code, remaining);
    }

    // ---- drop entries the site no longer contains ----
    const dead = Object.keys(dict).filter(k => !siteSet.has(k));
    if (PRUNE && dead.length) {
      src = removeKeys(src, new Set(dead));
      fs.writeFileSync(file, src, 'utf8');
      dict = loadDict(code);
      prunedCount = dead.length;
    }

    // ---- refresh the to-translate list ----
    const missing = siteKeys.filter(k => dict[k] === undefined);
    if (APPLY) {
      const current = loadTodo(code);
      // Keep any translation already typed in; add newly discovered strings.
      const entries = missing.map(k => [k, current[k] !== undefined ? current[k] : k]);
      writeTodo(code, entries);
    }

    const pending = APPLY || MERGE ? Object.keys(loadTodo(code)).length : Object.keys(todo).length;
    const translated = Object.keys(dict).filter(k => siteSet.has(k)).length;
    if (missing.length || dead.length) anyDrift = true;

    rows.push({ code, translated, missing: missing.length, dead: dead.length,
                pending, mergedCount, prunedCount });
  }

  const pad = (s, n) => String(s).padStart(n);
  console.log('lang   translated   missing   unused   to-do' + (MERGE ? '   merged' : '') + (PRUNE ? '   pruned' : ''));
  console.log('----   ----------   -------   ------   -----' + (MERGE ? '   ------' : '') + (PRUNE ? '   ------' : ''));
  for (const r of rows) {
    console.log(' ' + r.code.toUpperCase() + '    ' + pad(r.translated, 10) + '   ' + pad(r.missing, 7) +
                '   ' + pad(r.dead, 6) + '   ' + pad(r.pending, 5) +
                (MERGE ? '   ' + pad(r.mergedCount, 6) : '') +
                (PRUNE ? '   ' + pad(r.prunedCount, 6) : ''));
  }

  const sum = k => rows.reduce((n, r) => n + r[k], 0);
  console.log('');

  if (MERGE) console.log('merged ' + sum('mergedCount') + ' finished translation(s) into languages/');
  if (PRUNE) console.log('pruned ' + sum('prunedCount') + ' unused entr(ies)');
  if (APPLY) {
    console.log('to-translate lists written to languages/_todo/');
    console.log('Translate the values there, then run: node tools/i18n-update.js --merge');
  }
  if (!APPLY && !MERGE && !PRUNE) {
    if (sum('missing')) console.log(sum('missing') + ' string(s) need translating. Run --apply to generate the to-do lists.');
    if (sum('dead')) console.log(sum('dead') + ' dictionary entr(ies) match nothing on the site. Run --prune to remove.');
    if (!sum('missing') && !sum('dead')) console.log('Everything is in sync.');
  }

  return anyDrift ? 1 : 0;
}

// ------------------------------------------------------------------ modes ---

function installHook() {
  const hookDir = path.join(ROOT, '.git', 'hooks');
  if (!fs.existsSync(hookDir)) { console.error('No .git/hooks directory here.'); process.exit(1); }
  const hook = path.join(hookDir, 'pre-commit');
  const line = 'node "$(git rev-parse --show-toplevel)/tools/i18n-update.js" || ' +
               'echo "  (run: node tools/i18n-update.js --apply)"';
  let body = fs.existsSync(hook) ? fs.readFileSync(hook, 'utf8') : '#!/bin/sh\n';
  if (body.includes('i18n-update.js')) { console.log('Hook already installed.'); return; }
  if (!body.startsWith('#!')) body = '#!/bin/sh\n' + body;
  body = body.replace(/\s*$/, '\n') + '\n# Report translation drift. Never blocks the commit.\n' + line + '\n';
  fs.writeFileSync(hook, body, { mode: 0o755 });
  console.log('Installed .git/hooks/pre-commit - reports drift on every commit, never blocks one.');
}

function watch() {
  const SKIP = ['.git', '.claude', 'backup', 'node_modules', 'revolution', 'tools'];
  const dirs = [];
  (function crawl(d) {
    dirs.push(d);
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory() && !SKIP.includes(e.name)) crawl(path.join(d, e.name));
    }
  })(ROOT);

  let timer = null;
  const trigger = f => {
    if (!/\.html?$/i.test(f || '')) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      console.log('\n--- ' + f + ' changed ---\n');
      try { run(); } catch (e) { console.error(e.message); }
      console.log('\nwatching ' + dirs.length + ' directories - Ctrl+C to stop');
    }, 300);
  };

  dirs.forEach(d => { try { fs.watch(d, (_, f) => trigger(f)); } catch (e) { /* unwatchable */ } });
  run();
  console.log('\nwatching ' + dirs.length + ' directories - Ctrl+C to stop');
}

if (has('--install-hook')) installHook();
else if (WATCH) watch();
else process.exit(run());
