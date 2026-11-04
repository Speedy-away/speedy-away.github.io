// Refresh site metadata; --check validates without writes. Repeat --page <repo-relative-page> to scope.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const sitePages = require('./site-public-pages.cjs');
const {transform} = require('./page-search-metadata.cjs');
const root = path.resolve(__dirname, '..');

function main(args = process.argv.slice(2)) {
  const selectedPages = new Set();
  let checkOnly = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--check') checkOnly = true;
    else if (args[i] === '--page') {
      const page = args[++i]?.replace(/\\/g, '/');
      assert(page && !page.startsWith('-') && !path.isAbsolute(page) && !page.split('/').includes('..') && page.endsWith('.html'), '--page requires a repo-relative HTML page');
      selectedPages.add(page);
    } else throw new Error(`Unknown argument: ${args[i]}`);
  }
  const report = [], pendingUpdates = [];
  const allFiles = sitePages.pages();
  const knownPages = new Set(allFiles.map(file => path.relative(root, file).replace(/\\/g, '/')));
  for (const page of selectedPages) assert(knownPages.has(page), `Unknown page: ${page}`);
  for (const file of allFiles) {
    const relative = path.relative(root, file).replace(/\\/g, '/');
    if (selectedPages.size && !selectedPages.has(relative)) continue;
    const before = fs.readFileSync(file, 'utf8');
    const {html: after, metadata} = transform(relative, before);
    if (!metadata) continue;
    if (checkOnly) assert(after === before, `${relative}: metadata out of sync`);
    else if (after !== before) pendingUpdates.push({file, before, after});
    report.push(metadata);
  }
  const indexable = report.filter(p => !p.noindex && !p.redirect);
  const uniqueTitles = new Set();
  for (const p of indexable) {
    // The two existing FSL entry points intentionally share content and metadata.
    if (!p.page.endsWith('/fsl.html')) assert(!uniqueTitles.has(p.title), `Duplicate public title: ${p.title}`);
    uniqueTitles.add(p.title);
    assert(p.description.length <= 165, `${p.page}: long description (${p.description.length})`);
  }
  if (!checkOnly) {
    for (const update of pendingUpdates) {
      assert.equal(fs.readFileSync(update.file, 'utf8'), update.before, `${update.file}: changed during metadata refresh`);
      fs.writeFileSync(update.file, update.after);
    }
    fs.mkdirSync(path.join(root, 'docs', 'seo'), {recursive: true});
    const reportPath = path.join(root, 'docs', 'seo', 'page-metadata.json');
    const previous = selectedPages.size && fs.existsSync(reportPath) ? JSON.parse(fs.readFileSync(reportPath, 'utf8')) : {pages: []};
    const replacements = new Map(report.map(page => [page.page, page]));
    const pages = previous.pages.map(page => replacements.get(page.page) || page);
    const existingPages = new Set(previous.pages.map(page => page.page));
    pages.push(...report.filter(page => !existingPages.has(page.page)));
    fs.writeFileSync(reportPath, JSON.stringify({...previous, pages}, null, 2) + '\n');
  }
  console.log(`Validated ${report.length} pages: ${indexable.length} public pages, ${report.filter(p => p.redirect).length} redirects, ${report.filter(p => p.noindex && !p.redirect).length} other noindex pages; ${pendingUpdates.length} metadata updates.`);
  return {pages: report, updated: pendingUpdates.length, checked: report.length, checkOnly};
}
module.exports = {main};
if (require.main === module) main();
