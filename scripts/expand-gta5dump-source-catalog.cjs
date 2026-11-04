// Merge the explicitly requested whole account listing without discarding earlier snapshots.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const target = path.join(root, 'docs/gta5-pc-source-catalog.json');
const current = JSON.parse(fs.readFileSync(target, 'utf8'));
const review = require('../docs/gta5dump-all-repository-review.json');
const listing = require('../docs/gta5-source-research-dump.json').repositoryListing;
const expected = new Set(listing.map(item => 'GTA5dump/' + item.name));
if (review.repositories.length !== 48 || expected.size !== 48 || review.repositories.some(item => !expected.has(item.repository))) throw Error('Expected the complete reviewed 48-repository listing');
const baseline = path.join(root, 'docs/qa/gta5-pc-source-catalog-initial18.json');
if (!fs.existsSync(baseline)) fs.copyFileSync(target, baseline, fs.constants.COPYFILE_EXCL);
const existing = new Map(current.projects.map(project => [project.repo, project]));
const projects = current.projects.filter(project => !project.repo.startsWith('GTA5dump/'));
for (const item of review.repositories) {
  const previous = existing.get(item.repository) || {};
  const unavailable = ['inaccessible', 'unavailable'].includes(item.status);
  const empty = item.status === 'empty';
  const contentKind = item.status === 'decompiled-scripts' ? 'decompiled-scripts' : item.sourceVerified ? 'source' : /data|reference/.test(item.status) ? 'data' : /metadata|placeholder|incomplete|solution/.test(item.status) ? 'metadata' : 'archive';
  const note = unavailable ? 'GitHub returns HTTP 403: repository unavailable due to a DMCA takedown.' : empty ? 'No branch references or committed files are available.' : item.classificationNote || item.contentNote || item.availabilityNote || item.readmeSummary || item.reviewBasis || 'Pinned repository snapshot; inspect its original contents and requirements.';
  const id = 'gta5dump-' + item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  projects.push({...previous, id, title: item.name === 'YimMenu' ? 'YimMenu (GTA5dump)' : item.displayTitle || previous.title || item.name,
    description: previous.description || 'GTA5dump repository snapshot.', repo: item.repository, branch: item.branch,
    commit: item.commit || null, edition: 'Legacy', license: item.license || null, status: unavailable ? 'unavailable' : empty ? 'empty' : contentKind === 'metadata' ? 'metadata-only' : 'available', contentKind,
    availabilityNote: note, compatibility: item.compatibilityNote || previous.compatibility || 'Legacy collection supplied by the user; current game-build compatibility is not established.',
    branchUrl: item.branchUrl || item.url + '/tree/' + item.branch, commitUrl: item.commit ? item.url + '/commit/' + item.commit : null,
    sourceEvidence: item.sourceEvidence || item.treeEvidence, group: 'gta5dump',
    ...(item.name === 'NHA-Cleaned-Decompiled-Scripts' ? {maxBytes: 2 * 1024 ** 3, maxUncompressedBytes: 10 * 1024 ** 3, timeoutMs: 3600000} : {})});
}
const output = {...current, checkedAt: new Date().toISOString(), coverage: {account: 'GTA5dump', repositories: 48, unavailable: projects.filter(project => project.group === 'gta5dump' && project.status === 'unavailable').length, empty: projects.filter(project => project.group === 'gta5dump' && project.status === 'empty').length}, projects};
fs.writeFileSync(target, JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify({projects: projects.length, ...output.coverage}));
