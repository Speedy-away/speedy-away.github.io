'use strict';
// Read-only HTTP verification. Never evaluate native pages or payload bytes.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const site = 'https://speedy-away.github.io/';
const resolveURL = (value, aliases) => {
  const parsed=new URL(value,site);
  if(parsed.origin!==new URL(site).origin)return parsed.href;
  const key=parsed.pathname.replace(/^\/(?:WWB-HOST|wwb-host)(?=\/)/,'');
  return new URL(aliases[key]||key,site).href+parsed.search+parsed.hash;
};
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function request(url, method) {
  let last;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, {method, signal: AbortSignal.timeout(45000)});
      if (response.status === 429 || response.status >= 500) {
        await response.body?.cancel();
        throw Error('HTTP ' + response.status);
      }
      return response;
    } catch (error) { last = error; if (attempt < 2) await delay(1500 * (attempt + 1)); }
  }
  throw last;
}
async function main() {
  const response = await request(site + 'host-project-map.js', 'GET');
  assert.equal(response.status, 200);
  const source = await response.text();
  assert.ok(source.startsWith('window.WWB_HOST_PROJECT='));
  const map = JSON.parse(source.slice(source.indexOf('=') + 1).replace(/;\s*$/, ''));
  const revision = [...new Set(Object.values(map.aliases).map(url => url.match(/^https:\/\/raw\.githubusercontent\.com\/Speedy-away\/speedy-away\.github\.io\/([a-f0-9]{40})\//)?.[1]).filter(Boolean))];
  assert.equal(revision.length, 1, 'Downloads must use one immutable deployed revision');
  const build = JSON.parse(fs.readFileSync(path.join(root, 'docs/host-reviews/karo/build.json')));
  const arabic = JSON.parse(fs.readFileSync(path.join(root, 'docs/host-arabicguy-672-actions.json'))).actions;
  const resolve = value => resolveURL(value, map.aliases);
  const rows = [
    ...build.entries.map(entry => ({kind: 'KARO Load', id: entry.id, url: resolve(build.runtime + entry.path)})),
    ...build.artifacts.map(file => ({kind: 'KARO ZIP', id: file.unit, url: resolve(file.url), bytes: file.bytes})),
    ...build.downloads.filter(file => !file.invalid).map(file => ({kind: 'KARO Download', id: file.path, url: resolve(file.url), bytes: file.bytes})),
    ...arabic.map(action => ({kind: 'ArabicGuy Load', id: action.id, url: resolve(action.launchURL)})),
    ...arabic.map(action => ({kind: 'ArabicGuy Download', id: action.id, url: resolve(action.downloadURL), bytes: action.bytes}))
  ];
  assert.ok(!rows.some(row => /\/(?:900NM|900New)\/payload\.js(?:$|\?)/i.test(row.url)), 'Quarantined files must never be requested');
  const unique = [...new Map(rows.map(row => [row.url, row])).values()], results = [], failures = [];
  for (const row of unique) assert.match(row.url, /^https:\/\//, 'The HTTP client requires an absolute URL');
  let next = 0, checked = 0;
  async function worker() {
    while (next < unique.length) {
      const row = unique[next++];
      try {
        const r = await request(row.url, 'HEAD');
        assert.equal(r.status, 200, row.url);
        const length = r.headers.get('content-length');
        if (row.bytes && length && !r.headers.has('content-encoding')) assert.equal(Number(length), row.bytes, row.url);
        if (/raw\.githubusercontent\.com/.test(row.url)) assert.equal(r.headers.get('access-control-allow-origin'), '*', 'Native fetch requires CORS: ' + row.url);
        results.push({...row, status: r.status, contentType: r.headers.get('content-type'), headerBytes: length ? Number(length) : null});
      } catch (error) { failures.push({...row, error: error.message}); }
      if (++checked % 100 === 0) console.log('Checked ' + checked + '/' + unique.length + ' published Load/Download URLs; failures: ' + failures.length);
    }
  }
  const workers = Number(process.env.WWB_HOST_HTTP_WORKERS || 6);
  assert.ok(Number.isInteger(workers) && workers >= 1 && workers <= 24);
  await Promise.all(Array.from({length: workers}, worker));
  const exactArabic = [];
  for (const action of arabic) {
    const r = await request(action.downloadURL, 'GET');
    assert.equal(r.status, 200);
    const bytes = Buffer.from(await r.arrayBuffer());
    assert.equal(bytes.length, action.bytes);
    const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
    assert.equal(sha256, action.sha256);
    exactArabic.push({id: action.id, gameVersion: action.gameVersion, bytes: bytes.length, sha256, status: 'exact-original'});
  }
  const report = {checkedAt: new Date().toISOString(), status: failures.length ? 'failed' : 'passed', site, deployedRevision: revision[0], build: build.version, nativeLoadEntries: build.entries.length, readyZIPs: build.artifacts.length, enabledPayloadRecords: build.downloads.filter(file => !file.invalid).length, uniqueURLs: unique.length, failures, exactArabic, results, nativeCodeExecuted: false, consoleContact: false, hardwareExecutionVerified: false};
  const destination = path.join(root, 'docs/migration/public-http-verification.json');
  fs.mkdirSync(path.dirname(destination), {recursive: true});
  fs.writeFileSync(destination, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({...report, results: undefined, failures: failures.length, failureSample: failures.slice(0, 3)}));
  assert.equal(failures.length, 0, 'Some published URLs failed; inspect the saved report');
}
if (require.main === module) main().catch(error => {console.error(error.message); process.exitCode = 1;});
module.exports = {main, resolveURL};
