const fs = require('node:fs');
const target = 'docs/console-expansion-handoff.json';
const handoff = JSON.parse(fs.readFileSync(target, 'utf8'));
const site = require('../docs/qa/gta5dump-all-site.json');
const archives = require('../docs/qa/gta5-pc-source-archives.json');
const inventory = JSON.parse(fs.readFileSync('docs/download-audit.json', 'utf8'));
const manifest = require('../downloads/source-codes/gta5-pc/manifest.json');
const externalDownloads = require('../docs/qa/gta5dump-external-downloads.json');
if (!site.passed || !archives.passed || archives.summary.requestedProjects !== 51 || archives.summary.passed !== 49 || site.gta5dumpRepositories !== 48 || site.availableGta5dumpSnapshots !== 46 || site.httpHashChecks !== 50) throw Error('Complete all directory, HTTP and archive checks before finalizing.');
if (!externalDownloads.passed || externalDownloads.links.length !== 2 || externalDownloads.links.some(link => link.status !== 200)) throw Error('Verify both oversized upstream source ZIP links.');
handoff.updatedAt = new Date().toISOString();
for (const request of ['Include all 48 GTA5dump repositories in the GTA 5 PC source directory, preserving each accessible source snapshot locally.', 'Remove repeated GTA 5 source-card descriptions and per-card View source actions; keep downloads and collapsed details.']) if (!handoff.latestUserRequests.includes(request)) handoff.latestUserRequests.push(request);
handoff.gta5dumpAllRepositories = {
  updatedAt: handoff.updatedAt,
  status: 'Complete locally: all 48 GTA5dump entries listed; 46 exact repository snapshots saved and verified, WildMOdz recorded empty, GTA5dump/YimMenu recorded inaccessible. Compact cards and search implemented.',
  page: '/source-codes/pc/gta5/',
  scope: {gta5dumpRepositories: 48, gta5dumpDownloads: 46, originalFeaturedProjects: 3, existingMenyooPreserved: true, totalCards: 52, totalDownloadLinks: 50, newGta5dumpArchivesThisContinuation: 31},
  exceptions: site.unavailable,
  content: {sourceRepositories: 43, incompleteSolutionOnly: 'bronze', referenceData: 'GtaV_2.1', decompiledScripts: 'NHA-Cleaned-Decompiled-Scripts', note: 'Data, incomplete projects and decompiled scripts retain accurate content details; no original GTA engine-source or current-game compatibility claims.'},
  preservation: ['All original eighteen source snapshots remain listed and byte-preserved in the manifest and F: archive.', 'All source archives are pinned to exact commits. No source builds, archive extraction or bundled binary execution.', 'Source archives use download-archive-layout.cjs under PC/Games/GTA5/Legacy or Enhanced/.../Source Code/<branch-commit>. No older download or duplicate version was replaced or deleted.', 'MenyooSP existing source ZIP was mirrored from its already-verified F: backup; the original remains preserved.', 'No commit, push, deployment, publication or scheduled monitor.'],
  sourceExportMethods: manifest.files.filter(file => file.archiveMethod).map(({repo, commit, sourceUrl, archiveMethod}) => ({repo, commit, sourceUrl, archiveMethod})),
  ui: {cardDescriptions: 0, perCardViewSourceActions: 0, archiveDetails: 0, kept: ['Project title', 'Edition badge', 'Download ZIP'], search: {accountQuery: 'gta5dump', expectedMatches: 48, clearRestores: 52, noResultsState: true, escapeResets: true}, browser: {desktopViewport: 1280, phoneViewport: 390, phoneDocumentWidth: 375}},
  reports: ['docs/qa/gta5dump-all-site.json', 'docs/qa/gta5-pc-source-archives.json', 'docs/qa/gta5dump-all-tests.txt', 'docs/qa/gta5dump-external-downloads.json'],
  baselineReportsRetained: ['docs/qa/gta5-pc-source-archives-initial18.json', 'docs/qa/gta5-pc-source-catalog-initial18.json', 'docs/qa/gta5-pc-source-site.json'],
  verification: {archiveSummary: archives.summary, httpHashChecks: site.httpHashChecks, bytes: site.bytes, initial18Preserved: site.initial18Preserved, tests: {passed: 27, failed: 0}, archiveIndex: inventory.indexRefresh},
  downloadRouting: {localWebsiteMirrors: 48, externalPinnedZIPs: 2, policy: 'Existing shared download-mirror-policy.cjs limit95MiB retained. GtaV_2.1 and NHA download original exact-commit codeload ZIPs. Both respond200 application/zip; all complete backup files remain onF:. Exported backup checksum, size and provenance remain in the internal inventory and verification reports.'},
  screenshots: ['C:/Users/whatw/.codex/visualizations/2026/11/02/01a19ca9-49db-7830-b905-d4370ab14794/gta5dump-all-clean-desktop.jpg', 'C:/Users/whatw/.codex/visualizations/2026/11/02/01a19ca9-49db-7830-b905-d4370ab14794/gta5dump-all-clean-phone.jpg'],
  files: ['docs/gta5dump-all-repository-review.json', 'docs/gta5dump-large-data-review.json', 'docs/gta5-pc-source-catalog.json', 'scripts/expand-gta5dump-source-catalog.cjs', 'scripts/prepare-gta5-pc-sources.cjs', 'scripts/verify-gta5-pc-source-archives.py', 'scripts/verify-gta5dump-directory.cjs', 'scripts/build-source-code-pages.cjs', 'assets/source-codes.css', 'assets/source-code-search.js'],
  regeneration: ['node scripts/expand-gta5dump-source-catalog.cjs', 'node scripts/prepare-gta5-pc-sources.cjs --download --archive', 'node scripts/build-source-code-pages.cjs', 'python scripts/verify-gta5-pc-source-archives.py', 'node scripts/verify-gta5dump-directory.cjs --base=<local-preview-origin>', 'node scripts/refresh-local-download-index.cjs --write']
};
if (handoff.sourceCodeOrganisation) handoff.sourceCodeOrganisation.latestExpansion = 'gta5dumpAllRepositories';
if (handoff.gta5PCSourceExpansion) handoff.gta5PCSourceExpansion.latestContinuation = 'gta5dumpAllRepositories';
if (handoff.gta5dumpAllRepositoriesPending) { handoff.gta5dumpAllRepositoriesPending.status = 'Completed. See gta5dumpAllRepositories for final verification and archive provenance.'; handoff.gta5dumpAllRepositoriesPending.completedAt = handoff.updatedAt; }
fs.writeFileSync(target, JSON.stringify(handoff, null, 2) + '\n');
console.log('Saved all48 GTA5dump coverage, UI clarification, verification and preservation handoff.');
