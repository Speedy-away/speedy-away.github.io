// Default: refresh search attributes. --check reports drift without any writes.
const fs = require('node:fs');
const path = require('node:path');
const {root, pages, relativePath} = require('./site-public-pages.cjs');
const tags = require('./page-search-tags.cjs');
const searchCount = html => [...html.matchAll(/\sdata-(?:library-)?search\s*=\s*(["'])[\s\S]*?\1/gi)].length;

function main({check = false} = {}) {
  const report = {checkedAt: new Date().toISOString(), mode: check ? 'check' : 'write', visited: 0, skippedProtected: 0, changed: 0, searchAttributesBefore: 0, searchAttributesAfter: 0, pages: []};
  for (const file of pages()) {
    const relative = relativePath(file);
    const before = fs.readFileSync(file, 'utf8');
    if (tags.protectedFile(relative, before)) { report.skippedProtected++; continue; }
    const after = tags.apply(relative, before);
    report.visited++;
    report.searchAttributesBefore += searchCount(before);
    report.searchAttributesAfter += searchCount(after);
    if (before === after) continue;
    report.changed++;
    report.pages.push({page: relative, searchAttributes: searchCount(after)});
    if (!check) fs.writeFileSync(file, after);
  }
  if (!check) {
    const reportFile = path.join(root, 'docs/qa/site-search-tags-report.json');
    fs.mkdirSync(path.dirname(reportFile), {recursive: true});
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2) + '\n');
  }
  return report;
}
module.exports = {main};
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.some(arg => !['--check', '--write'].includes(arg)) || args.includes('--check') && args.includes('--write')) {
    console.error('Use --check or --write (default).');
    process.exitCode = 1;
  } else {
    const report = main({check: args.includes('--check')});
    console.log(JSON.stringify(report, null, 2));
    if (args.includes('--check') && report.changed) process.exitCode = 1;
  }
}
