// Read-only catalogue/UI/inventory/HTTP verification. Never executes source contents.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const catalog = require('../docs/gta5-pc-source-catalog.json');
const manifest = require('../downloads/source-codes/gta5-pc/manifest.json');
const expected = require('../docs/gta5-source-research-dump.json').repositoryListing;
const baseline = require('../docs/qa/gta5-pc-source-catalog-initial18.json');
const archiveQA = require('../docs/qa/gta5-pc-source-archives.json');
const audit = require('../docs/download-audit.json');
const httpBase = process.argv.find(arg => arg.startsWith('--base='))?.slice(7);
async function hashStream(stream) {
  const digest = crypto.createHash('sha256'); let bytes = 0;
  for await (const chunk of stream) { digest.update(chunk); bytes += chunk.length; }
  return {bytes, sha256: digest.digest('hex')};
}
async function main() {
  assert.equal(archiveQA.passed, true, 'Archive verification must pass first');
  assert.equal(archiveQA.summary.requestedProjects, 51, 'Archive report must cover the complete catalogue');
  assert.equal(archiveQA.summary.passed, 49, 'Every available exact snapshot must pass verification');
  const gta5dump = catalog.projects.filter(project => project.group === 'gta5dump');
  assert.equal(gta5dump.length, 48);
  assert.deepEqual(gta5dump.map(project => project.repo).sort(), expected.map(item => 'GTA5dump/' + item.name).sort());
  const html = fs.readFileSync(path.join(root, catalog.page), 'utf8');
  assert.equal(require('./page-search-metadata.cjs').transform(catalog.page, html).html, html);
  const cards = [...html.matchAll(/<article\b[^>]*\bdata-source-project(?:\s|>)[\s\S]*?<\/article>/g)].map(match => match[0]);
  assert.equal(cards.length, catalog.projects.length + 1, 'Every catalogue project plus Menyoo must appear once');
  for (const card of cards) {
    assert.doesNotMatch(card, /<p\b/i, 'Compact cards must not contain description paragraphs');
    assert.doesNotMatch(card, />\s*View (?:source|repository)/i, 'Compact cards must not contain View source actions');
    assert.doesNotMatch(card, /<details\b|Archive details/i, 'Compact cards must not contain archive details');
  }
  const downloads = [], unavailable = [], websiteDownloads = [];
  for (const project of catalog.projects) {
    const card = cards.find(card => card.match(/\bdata-search="([^"]*)"/)?.[1].split(/\s+/).includes(project.repo.toLowerCase()));
    assert.ok(card, 'Missing project card: ' + project.repo);
    if (['empty', 'unavailable'].includes(project.status)) {
      assert.doesNotMatch(card, /\bdownload(?:=|\s|>)/i);
      assert.ok(manifest.files.some(file => file.id === project.id && file.status === project.status && file.commit === null));
      unavailable.push({repo: project.repo, status: project.status, reason: project.availabilityNote});
      continue;
    }
    const file = manifest.files.find(file => file.id === project.id && file.commit === project.commit && file.status === 'downloaded');
    assert.ok(file?.backupPath, 'Missing exact archived snapshot: ' + project.repo);
    const href = card.match(/<a\b[^>]*\bhref="([^"]+)"[^>]*>\s*Download\b/)?.[1];
    assert.ok(href, 'Missing download action: ' + project.repo);
    if (href.startsWith('/downloads/')) assert.equal(decodeURI(href), file.local);
    else assert.equal(href, `https://codeload.github.com/${project.repo}/zip/${project.commit}`, 'External download must be a real ZIP pinned to the exact source commit');
    websiteDownloads.push({repo: project.repo, href, mode: href.startsWith('/downloads/') ? 'local-mirror' : 'upstream-exact-commit-zip', backupSHA256: file.sha256, backupIsLocalExport: Boolean(file.archiveMethod)});
    const item = audit.items.find(item => item.id === file.inventoryId);
    assert.ok(item?.files.some(saved => saved.sha256 === file.sha256 && saved.bytes === file.bytes && saved.backupPath === file.backupPath));
    downloads.push({...file, repo: project.repo});
  }
  const menyoo = audit.items.find(item => item.id === 'b28dff23dbd8').files.find(file => file.local && file.name === 'MenyooSP-source.zip');
  assert.ok(menyoo && cards.some(card => card.includes(menyoo.local)));
  const menyooBackup = await hashStream(fs.createReadStream(menyoo.backupPath));
  assert.equal(menyooBackup.sha256, menyoo.sha256); assert.equal(menyooBackup.bytes, menyoo.bytes);
  downloads.push({...menyoo, repo: 'itsjustcurtis/MenyooSP'});
  for (const old of baseline.projects) assert.ok(manifest.files.some(file => file.id === old.id && file.commit === old.commit && file.status === 'downloaded'), 'Older snapshot lost: ' + old.id);
  const http = [];
  if (httpBase) {
    const page = await fetch(new URL('/' + catalog.page, httpBase));
    assert.equal(page.status, 200); assert.equal(await page.text(), html);
    for (const file of downloads) {
      const response = await fetch(new URL(file.local, httpBase));
      assert.equal(response.status, 200);
      assert.match(response.headers.get('content-disposition'), /attachment/);
      const actual = await hashStream(response.body);
      assert.equal(actual.sha256, file.sha256); assert.equal(actual.bytes, file.bytes);
      http.push({repo: file.repo, status: response.status, ...actual});
    }
  }
  const report = {checkedAt: new Date().toISOString(), passed: true, page: catalog.page, gta5dumpRepositories: 48,
    totalProjectCards: cards.length, availableGta5dumpSnapshots: gta5dump.filter(project => project.commit).length,
    unavailable, downloadableSnapshots: downloads.length, bytes: downloads.reduce((sum, file) => sum + file.bytes, 0),
    initial18Preserved: true, cardDescriptions: 0, cardViewSourceActions: 0, metadataSynchronized: true,
    archiveReport: 'docs/qa/gta5-pc-source-archives.json', httpHashChecks: http.length, websiteDownloads, http};
  fs.writeFileSync(path.join(root, 'docs/qa/gta5dump-all-site.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({...report, http: undefined, websiteDownloads: undefined}));
}
if (require.main === module) main().catch(error => {console.error(error); process.exitCode = 1;});
