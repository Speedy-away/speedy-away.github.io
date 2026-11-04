// Verify the 17-game continuation without executing any downloaded definition.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const {verifyFile, verifyCatalogueBaseline} = require('./verify-console-continuation.cjs');
async function verify({http = false} = {}) {
  const evidence = read('docs/ps4-ps5-research/patch-linked-cheats.json');
  const baseline = read('docs/qa/patch-linked-cheats-baseline.json');
  const jobs = read('docs/qa/patch-linked-cheats-download-jobs.json').jobs;
  const audit = read('docs/download-audit.json');
  const manifest = read('downloads/ps4-ps5/manifest.json');
  const catalogue = read('docs/console-download-catalog.json');
  const resources = read('docs/ps4-ps5-game-resources.json');
  const issues = [];
  if (jobs.length !== 24 || evidence.games.length !== 17) issues.push('Expected 24 files across 17 added game collections');
  const fileChecks = jobs.map(job => {
    const errors = [];
    const source = evidence.files.find(file => file.filename === job.filename);
    const saved = audit.items.find(item => item.id === 'ps4-ps5-' + job.id);
    const archive = saved?.files?.find(file => file.name === job.filename && file.sha256 === job.expectedSha256);
    const mirrored = manifest.files.find(file => file.downloadId === job.id && file.status === 'downloaded' && file.sha256 === job.expectedSha256);
    const item = catalogue.items.find(item => item.id === job.id);
    const archiveCheck = verifyFile(archive?.backupPath, job.expectedBytes, job.expectedSha256, 'F:/whatsite-backup-downloads-etc');
    const mirrorCheck = verifyFile(mirrored?.local && path.join(root, mirrored.local.slice(1)), job.expectedBytes, job.expectedSha256, root);
    if (!archiveCheck.passed || !mirrorCheck.passed) errors.push('Archive or mirror bytes failed verification');
    if (saved?.status !== 'downloaded' || !mirrored?.archived || saved?.url !== job.url || archive?.sourceUrl !== job.url || archive?.version !== job.version || saved?.release !== job.version || mirrored?.version !== job.version || mirrored?.source !== job.url) errors.push('Inventory source/version/archive fields differ');
    if (!item || item.sha256 !== job.expectedSha256 || item.bytes !== job.expectedBytes || item.filename !== job.filename || item.url !== mirrored?.local || item.source !== source?.url || item.version !== source?.version || JSON.stringify(item.platforms) !== '["ps4"]') errors.push('Public catalogue differs from approved PS4-only file');
    const game = resources.games.find(game => game.id === source?.game);
    const resource = resources.resources.find(resource => resource.id === job.id);
    const html = game && fs.readFileSync(path.join(root, 'console/mods/ps4', game.slug, 'index.html'), 'utf8');
    if (!html?.includes(mirrored?.local) || !html.includes(source.titleId) || !html.includes('id="related-game-patches"') || /<video\b|youtube\.com\/embed\//.test(html)) errors.push('Game page lacks exact download/patch context or includes a video');
    if (resource?.gameIds?.[0] !== source?.game || !resource?.compatibilityText.includes(source.titleId) || !resource?.compatibilityText.includes(source.version)) errors.push('Game routing or compatibility differs');
    return {id: job.id, game: source?.game, source: job.url, version: job.version, filename: job.filename, archive: archiveCheck, mirror: mirrorCheck, passed: !errors.length, errors};
  });
  const preserved = verifyCatalogueBaseline(baseline.catalogue, catalogue.items);
  const inventoryChecks = baseline.inventory.map(prior => {
    const current = audit.items.find(item => item.id === prior.id);
    const lost = prior.files.filter(file => !current?.files?.some(saved => saved.name === file.name && saved.sha256 === file.sha256 && saved.bytes === file.bytes && saved.backupPath === file.backupPath));
    return {id: prior.id, passed: !!current && !lost.length, lost};
  });
  const source = read('docs/ps4-extra-game-cheats.json');
  const sourcePreserved = baseline.sourceFiles.every(prior => source.files.some(current => JSON.stringify(current) === JSON.stringify(prior)));
  const priorCompanions = baseline.companions.map(prior => {
    const archived = audit.items.flatMap(item => item.files || []).find(file => file.sha256 === prior.sha256 && file.bytes === prior.bytes && file.backupPath);
    return {file: prior.file, ...verifyFile(archived?.backupPath, prior.bytes, prior.sha256, 'F:/whatsite-backup-downloads-etc')};
  });
  let helpers = [];
  const helperJobs = path.join(root, 'docs/qa/patch-linked-cheats-helper-jobs.json');
  if (fs.existsSync(helperJobs)) helpers = read('docs/qa/patch-linked-cheats-helper-jobs.json').jobs.map(job => {
    const item = audit.items.find(item => item.id === 'ps4-ps5-' + job.id);
    const file = item?.files?.find(file => file.sha256 === job.expectedSha256);
    const archive = verifyFile(file?.backupPath, job.expectedBytes, job.expectedSha256, 'F:/whatsite-backup-downloads-etc');
    const publicFile = verifyFile(path.join(root, job.importPath), job.expectedBytes, job.expectedSha256, root);
    const html = fs.readFileSync(path.join(root, job.importPath), 'utf8');
    const embedded = JSON.parse(html.match(/<script id="receiver-catalog" type="application\/json">([\s\S]*?)<\/script>/)[1]);
    const missing = catalogue.items.filter(item => item.platforms.includes(embedded.platform)).filter(item => !embedded.items.some(file => file.id === item.id && file.sha256 === item.sha256)).map(item => item.id);
    return {id: job.id, version: job.version, archive, publicFile, embeddedItems: embedded.items.length, missing, passed: archive.passed && publicFile.passed && !missing.length};
  });
  const httpChecks = [];
  if (http) for (const filename of ['CUSA00207_01.09.json', 'CUSA16579_01.61.json', 'CUSA07187_01.02.json']) {
    const job = jobs.find(job => job.filename === filename);
    const file = manifest.files.find(file => file.downloadId === job.id && file.status === 'downloaded');
    const response = await fetch('http://127.0.0.1:8765' + file.local, {signal: AbortSignal.timeout(10000)});
    const bytes = Buffer.from(await response.arrayBuffer());
    const sha256 = require('node:crypto').createHash('sha256').update(bytes).digest('hex');
    httpChecks.push({filename, url: file.local, status: response.status, bytes: bytes.length, sha256, passed: response.ok && bytes.length === job.expectedBytes && sha256 === job.expectedSha256});
  }
  const passed = !issues.length && sourcePreserved && [...fileChecks, ...preserved, ...inventoryChecks, ...priorCompanions, ...helpers, ...httpChecks].every(check => check.passed);
  const report = {checkedAt: new Date().toISOString(), passed, method: 'Actual archive/mirror size and SHA-256; exact source/version/platform routing; game-page links; all baseline catalogue identities and inventory file records preserved; previous helper versions retained. Optional local HTTP bytes checked in memory. No downloaded files executed.', issues,
    summary: {newGames: evidence.games.length, newFiles: fileChecks.length, filesPassed: fileChecks.filter(check => check.passed).length, preservedCatalogue: preserved.filter(check => check.passed).length, baselineCatalogue: baseline.catalogue.length, preservedInventoryItems: inventoryChecks.filter(check => check.passed).length, baselineInventoryItems: baseline.inventory.length, sourcePreserved, priorCompanionArchives: priorCompanions.filter(check => check.passed).length, newHelpers: helpers.filter(check => check.passed).length, httpFiles: httpChecks.filter(check => check.passed).length, currentCatalogue: catalogue.items.length, ps4: catalogue.items.filter(item => item.platforms.includes('ps4')).length, ps5: catalogue.items.filter(item => item.platforms.includes('ps5')).length},
    files: fileChecks, preservedCatalogue: preserved, preservedInventory: inventoryChecks, priorCompanions, helpers, httpChecks};
  fs.writeFileSync(path.join(root, 'docs/qa/patch-linked-cheats-verification.json'), JSON.stringify(report, null, 2) + '\n');
  return report;
}
module.exports = {verify};
if (require.main === module) verify({http: process.argv.includes('--http')}).then(report => {console.log(JSON.stringify({passed: report.passed, ...report.summary}, null, 2)); if (!report.passed) process.exitCode = 1;}).catch(error => {console.error(error.message); process.exitCode = 1;});
