/*
 * Adds the i18n <script> tag to every page that does not already have it.
 *
 *   node tools/i18n-inject.js          apply
 *   node tools/i18n-inject.js --check  report only, change nothing
 *
 * Updates public pages only. Archived downloads, standalone console helpers,
 * source evidence and redirect stubs remain untouched.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const VERSION = '3';
const TAG = '<script defer src="/languages/i18n.js?v=' + VERSION + '"></script>';
const CHECK = process.argv.includes('--check');
const SKIP_DIRS = ['.git', '.agents', '.codex', '.claude', '.playwright', '.playwright-cli', 'backup', 'node_modules', 'assets', 'docs', 'design-references', 'downloads', 'i18n-tools', 'languages', 'api', 'css2', 'css2-1'];

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

let added = 0, already = 0, failed = 0;

const publicFiles = require('../scripts/site-public-pages.cjs').pages();
for (const file of publicFiles) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  let html = fs.readFileSync(file, 'utf8');

  if (/whatsite-ps[45]\.html$/.test(rel) || /<meta[^>]+name="robots"[^>]+content="[^"]*noindex/i.test(html) || /http-equiv="refresh"/i.test(html)) continue;

  const loader = /<script\b[^>]*\bsrc="[^"]*(?:^|\/)languages\/i18n\.js(?:\?[^"]*)?"[^>]*>\s*<\/script>/g;
  if (loader.test(html)) {
    const normalized = html.replace(loader, TAG);
    if (normalized === html) { already++; continue; }
    if (!CHECK) fs.writeFileSync(file, normalized, 'utf8');
    console.log((CHECK ? '  would refresh ' : '  refreshed     ') + rel);
    added++;
    continue;
  }

  // Load in <head> (not deferred) so the anti-flash cloak applies before paint.
  let out;
  if (/<\/head>/i.test(html)) {
    out = html.replace(/<\/head>/i, '  ' + TAG + '\n</head>');
  } else if (/<body[^>]*>/i.test(html)) {
    out = html.replace(/(<body[^>]*>)/i, '$1\n' + TAG);
  } else {
    console.log('  SKIP (no <head> or <body>):', rel);
    failed++;
    continue;
  }

  if (!CHECK) fs.writeFileSync(file, out, 'utf8');
  console.log((CHECK ? '  would add ' : '  added    ') + rel);
  added++;
}

console.log('\n' + (CHECK ? 'check' : 'done') + ': ' + added + ' to update, ' +
            already + ' already wired, ' + failed + ' skipped');
