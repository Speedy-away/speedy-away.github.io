// Read-only verification of continuation downloads and preserved catalogue data.
// The only write is docs/qa/console-continuation-verification.json.
// Downloaded files are read and hashed; none is executed or loaded on a console.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const reportPath = path.join(root, 'docs/qa/console-continuation-verification.json');
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const platforms = values => JSON.stringify([...(values || [])].sort());
const canonicalSource = value => {
  try {
    const url = new URL(value);
    return /(?:^|\.)discordapp\.com$/.test(url.hostname) ? url.origin + url.pathname : url.href;
  } catch { return null; }
};
const inside = (directory, target) => {
  const relative = path.relative(path.resolve(directory), path.resolve(target));
  return relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
};

function verifyFile(file, expectedBytes, expectedSha256, allowedRoot) {
  const record = {path: file || null, expectedBytes, expectedSha256, passed: false};
  try {
    if (!file || !inside(allowedRoot, file)) throw Error('File path is missing or outside its required root');
    const actualPath = fs.realpathSync(file);
    if (!inside(fs.realpathSync(allowedRoot), actualPath)) throw Error('Resolved file path escapes its required root');
    const bytes = fs.readFileSync(actualPath);
    record.bytes = bytes.length;
    record.sha256 = digest(bytes);
    record.passed = bytes.length === expectedBytes && record.sha256 === expectedSha256;
    if (!record.passed) record.reason = 'File size or SHA-256 differs from the pinned job';
  } catch (error) { record.reason = error.message; }
  return record;
}

function verifyCatalogueBaseline(baseline, catalogue) {
  return baseline.map(prior => {
    const matches = catalogue.filter(item => item.id === prior.id);
    const issues = [];
    if (matches.length !== 1) issues.push('Expected exactly one current catalogue entry for this preserved ID');
    const item = matches[0];
    if (item) {
      if (item.sha256 !== prior.sha256) issues.push('Preserved SHA-256 changed');
      if (item.filename !== prior.filename) issues.push('Preserved filename changed');
      if (platforms(item.platforms) !== platforms(prior.platforms)) issues.push('Preserved platform set changed');
    }
    return {id: prior.id, sha256: prior.sha256, filename: prior.filename, platforms: prior.platforms, passed: issues.length === 0, issues};
  });
}

function verify() {
  // Load every input afresh on every invocation; other chats may add resources.
  const inputs = [];
  const read = relative => {
    const bytes = fs.readFileSync(path.join(root, relative));
    inputs.push({file: relative, bytes: bytes.length, sha256: digest(bytes)});
    return JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''));
  };
  const baseline = read('docs/qa/console-expansion-continuation-baseline.json');
  const cheatJobs = read('docs/qa/console-continuation-download-jobs.json').jobs;
  const matrixJobs = read('docs/console-multicod-ready-file-jobs.json').jobs;
  const audit = read('docs/download-audit.json');
  const manifest = read('downloads/ps4-ps5/manifest.json');
  const catalogue = read('docs/console-download-catalog.json');
  const matrix = read('docs/console-multicod-ready-files.json').resources;
  const patches = read('docs/ps4-ps5-game-patches.json').resources;
  const cheats = read('docs/ps4-extra-game-cheats.json').files;
  const backupRoot = path.resolve('F:/whatsite-backup-downloads-etc');
  const jobs = [...cheatJobs, ...matrixJobs];
  const inputIssues = [];
  if (baseline.items.length !== 232) inputIssues.push('Expected the original 232-entry catalogue baseline');
  if (cheatJobs.length !== 79 || matrixJobs.length !== 8 || jobs.length !== 87) inputIssues.push('Expected 79 continuation cheat/patch jobs and eight Matrix ELF jobs');
  if (new Set(jobs.map(job => job.id)).size !== jobs.length) inputIssues.push('Duplicate continuation job IDs');
  const descriptors = new Map([...matrix, ...patches].map(item => [item.id, item]));
  const fileChecks = jobs.map(job => {
    const issues = [];
    if (!/^[a-z0-9][a-z0-9-]*$/.test(job.id) || !job.filename || path.basename(job.filename) !== job.filename || !Number.isSafeInteger(job.expectedBytes) || job.expectedBytes <= 0 || !/^[a-f0-9]{64}$/.test(job.expectedSha256 || '') || !job.version || !/^https:\/\//.test(job.url || '')) issues.push('Incomplete or invalid pinned job metadata');
    const item = audit.items.find(item => item.id === 'ps4-ps5-' + job.id);
    const archived = item?.files?.find(file => file.name === job.filename && file.sha256 === job.expectedSha256);
    const publicFile = manifest.files.find(file => file.downloadId === job.id && file.name === job.filename && file.sha256 === job.expectedSha256 && file.status === 'downloaded');
    const catalogueMatches = catalogue.items.filter(item => item.id === job.id);
    const current = catalogueMatches[0];
    const descriptor = descriptors.get(job.id);
    const cheat = cheats.find(file => file.filename === job.filename && file.sha256 === job.expectedSha256 && file.url === job.url);
    const expectedCatalogueSource = descriptor?.source || cheat?.url;
    const expectedCatalogueVersion = descriptor?.version || cheat?.version;
    const expectedPlatforms = descriptor?.platforms || (cheat ? ['ps4'] : null);
    if (!expectedCatalogueSource || !expectedCatalogueVersion || !expectedPlatforms) issues.push('Expected approved source/version/platform descriptor is missing');
    if (!item || item.status !== 'downloaded') issues.push('Shared inventory item is missing or not downloaded');
    if (item && canonicalSource(item.url) !== canonicalSource(job.url)) issues.push('Shared inventory source URL differs from the pinned job');
    if (item && item.release !== job.version) issues.push('Shared inventory release differs from the pinned job');
    if (!archived || archived.bytes !== job.expectedBytes || archived.version !== job.version || canonicalSource(archived.sourceUrl) !== canonicalSource(job.url)) issues.push('Archived file source/version/size metadata differs from the pinned job');
    const archive = verifyFile(archived?.backupPath, job.expectedBytes, job.expectedSha256, backupRoot);
    if (!archive.passed) issues.push('Required F: archive copy failed verification');
    if (!publicFile || publicFile.bytes !== job.expectedBytes || publicFile.version !== job.version || canonicalSource(publicFile.source) !== canonicalSource(job.url) || !publicFile.archived) issues.push('Public manifest source/version/archive metadata differs from the pinned job');
    let mirror = null;
    if (job.mirror !== false) {
      const local = publicFile?.local;
      const target = typeof local === 'string' && /^\/(?!\/)/.test(local) ? path.resolve(root, local.slice(1)) : null;
      mirror = verifyFile(target, job.expectedBytes, job.expectedSha256, root);
      if (!mirror.passed) issues.push('Required site mirror failed verification');
      if (archived && archived.local !== local) issues.push('Inventory and public manifest mirror paths differ');
    }
    if (catalogueMatches.length !== 1) issues.push('Expected exactly one public catalogue entry for this new job');
    if (current) {
      if (current.filename !== job.filename || current.bytes !== job.expectedBytes || current.sha256 !== job.expectedSha256) issues.push('Catalogue filename/size/SHA-256 differs from the pinned job');
      if (canonicalSource(current.source) !== canonicalSource(expectedCatalogueSource)) issues.push('Catalogue source differs from the approved descriptor');
      if (current.version !== expectedCatalogueVersion) issues.push('Catalogue version differs from the approved descriptor');
      if (platforms(current.platforms) !== platforms(expectedPlatforms)) issues.push('Catalogue platforms differ from the approved descriptor');
      if (job.mirror !== false && current.url !== publicFile?.local) issues.push('Catalogue download URL differs from the verified site mirror');
    }
    return {id: job.id, filename: job.filename, source: job.url, version: job.version, expectedBytes: job.expectedBytes, expectedSha256: job.expectedSha256, catalogue: current ? {id: current.id, source: current.source, version: current.version, platforms: current.platforms, url: current.url} : null, archive, mirror, passed: issues.length === 0, issues};
  });
  const preserved = verifyCatalogueBaseline(baseline.items, catalogue.items);
  const priorCompanions = (baseline.companions || []).map(prior => {
    const item = audit.items.find(item => item.id === prior.id || item.id === 'ps4-ps5-' + prior.id);
    const file = item?.files?.find(file => file.sha256 === prior.sha256 && file.bytes === prior.bytes);
    const archive = verifyFile(file?.backupPath, prior.bytes, prior.sha256, backupRoot);
    return {id: prior.id, archive, passed: archive.passed};
  });
  const ownedIds = new Set([...baseline.items.map(item => item.id), ...jobs.map(job => job.id)]);
  const additionalItems = catalogue.items.filter(item => !ownedIds.has(item.id)).map(item => item.id);
  const passed = !inputIssues.length && fileChecks.every(item => item.passed) && preserved.every(item => item.passed) && priorCompanions.every(item => item.passed);
  const report = {
    schemaVersion: 1, checkedAt: new Date().toISOString(), passed,
    method: 'Fresh JSON inputs; actual SHA-256 and byte-size reads of F: archive files and required site mirrors; exact source/release and approved catalogue metadata checks; original catalogue identity/platform preservation. No downloaded binary was executed.',
    backupRoot, inputs, inputIssues,
    summary: {expectedNewFiles: 87, newFilesChecked: fileChecks.length, newFilesPassed: fileChecks.filter(item => item.passed).length, expectedPreservedCatalogueItems: 232, preservedCatalogueItems: preserved.filter(item => item.passed).length, priorCompanionArchivesChecked: priorCompanions.length, priorCompanionArchivesPassed: priorCompanions.filter(item => item.passed).length, currentCatalogueItems: catalogue.items.length, additionalItemsAllowed: additionalItems.length, failures: inputIssues.length + fileChecks.filter(item => !item.passed).length + preserved.filter(item => !item.passed).length + priorCompanions.filter(item => !item.passed).length},
    newFiles: fileChecks, preservedCatalogue: preserved, priorCompanions, additionalItems
  };
  fs.mkdirSync(path.dirname(reportPath), {recursive: true});
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
  return report;
}

module.exports = {verify, verifyFile, verifyCatalogueBaseline};
if (require.main === module) {
  try {
    const report = verify();
    console.log(JSON.stringify({passed: report.passed, ...report.summary, report: path.relative(root, reportPath).replaceAll('\\', '/')}, null, 2));
    if (!report.passed) process.exitCode = 1;
  } catch (error) {
    const report = {schemaVersion: 1, checkedAt: new Date().toISOString(), passed: false, fatalInputError: error.message};
    fs.mkdirSync(path.dirname(reportPath), {recursive: true});
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
    console.error(error.message);
    process.exitCode = 1;
  }
}
