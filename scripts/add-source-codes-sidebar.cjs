const fs = require('node:fs');
const scope = require('./site-public-pages.cjs');
const navigation = require('./source-code-navigation.cjs');

function main({check = false} = {}) {
  let checked = 0, changed = 0;
  for (const file of scope.pages()) {
    const before = fs.readFileSync(file, 'utf8');
    if (!/\bid=["']sidebar["']/.test(before)) continue;
    checked++;
    const after = navigation.apply(scope.relativePath(file), before);
    if (after === before) continue;
    changed++;
    if (!check) fs.writeFileSync(file, after);
  }
  return {checked, changed, mode: check ? 'check' : 'write'};
}

module.exports = {main};
if (require.main === module) {
  const report = main({check: process.argv.includes('--check')});
  console.log(JSON.stringify(report));
  if (report.mode === 'check' && report.changed) process.exitCode = 1;
}
