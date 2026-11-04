// Read-only verification of generated search metadata and versioned HTML tools.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const scope = require('./site-public-pages.cjs');
const engine = require('./page-search-metadata.cjs');
const quality = require('./search-keyword-quality.cjs');
const root = path.resolve(__dirname, '..');
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
function hashFile(file) {
  const bytes = fs.readFileSync(path.join(root, file));
  return {bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex')};
}
function verify({write = true} = {}) {
  const pages = scope.pages(), drift = [], noise = [];
  for (const file of pages) {
    const html = fs.readFileSync(file, 'utf8');
    const result = engine.transform(file, html);
    if (result.html !== html) drift.push(scope.relativePath(file));
    if (!result.metadata.noindex && !result.metadata.redirect) {
      for (const term of result.metadata.keywords.split(',').map(term => term.trim())) {
        if (quality.isGenericKeyword(term)) noise.push({page: result.metadata.page, term});
      }
    }
  }
  const activation = read('docs/host-menu-companion-build.json');
  const oldJobs = read('docs/console-companion-download-jobs.json').jobs;
  const previousJobs = activation.previousJobsPath ? read(activation.previousJobsPath).jobs : [];
  const helpers = activation.records.map(record => {
    const old = [...oldJobs, ...previousJobs].find(job => job.platform.toLowerCase() === record.platform && job.expectedSha256 === record.previousSha256);
    const live = hashFile(record.path);
    const immutable = hashFile(record.immutablePath);
    const retained = hashFile(record.previousPublicSnapshot);
    return {
      platform: record.platform, activatedVersion: record.version, path: record.path,
      live, immutable, retainedPrevious: retained,
      livePassed: live.bytes === record.bytes && live.sha256 === record.sha256,
      immutablePassed: immutable.bytes === record.bytes && immutable.sha256 === record.sha256,
      previousPassed: !!old && retained.bytes === old.expectedBytes && retained.sha256 === old.expectedSha256
    };
  });
  const generatorFiles = fs.readdirSync(path.join(root, 'scripts'))
    .filter(file => file.endsWith('.cjs') && file !== path.basename(__filename))
    .filter(file => fs.readFileSync(path.join(root, 'scripts', file), 'utf8').includes("require('./search-page-output.cjs')"))
    .map(file => 'scripts/' + file);
  if (!generatorFiles.includes('scripts/build-console-topic-hubs.cjs')) generatorFiles.push('scripts/build-console-topic-hubs.cjs');
  const passed = !drift.length && !noise.length && activation.activated === true && helpers.every(item => item.livePassed && item.immutablePassed && item.previousPassed);
  const report = {checkedAt: new Date().toISOString(), passed, pages: pages.length, metadataDrift: drift,
    genericKeywordEntries: noise, generatorFiles, protectedHelpers: helpers};
  if (write) fs.writeFileSync(path.join(root, 'docs/qa/site-search-durable-verification.json'), JSON.stringify(report, null, 2) + '\n');
  return report;
}
module.exports = {verify};
if (require.main === module) {
  const result = verify();
  console.log(JSON.stringify({passed: result.passed, pages: result.pages, metadataDrift: result.metadataDrift,
    genericKeywordEntries: result.genericKeywordEntries.length, generatorFiles: result.generatorFiles.length,
    helpersPassed: result.protectedHelpers.every(item => item.livePassed && item.immutablePassed && item.previousPassed)}, null, 2));
  if (!result.passed) process.exitCode = 1;
}
