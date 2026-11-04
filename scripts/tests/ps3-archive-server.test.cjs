const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const crypto = require('node:crypto');
const {selectArchiveFiles, createArchiveServer, parseSingleRange, parseArgs, isPrivateHost} = require('../serve-ps3-downloads.cjs');

function fixture(t) {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'ps3-archive-server-'));
  const archiveRoot = path.join(temporary, 'archive');
  fs.mkdirSync(archiveRoot);
  t.after(() => {
    // Only remove this fixture's newly created temporary directory, never the real archive.
    if (path.dirname(path.resolve(temporary)) !== path.resolve(os.tmpdir()) || !path.basename(temporary).startsWith('ps3-archive-server-')) throw Error('Unexpected fixture cleanup path.');
    fs.rmSync(temporary, {recursive: true, force: true});
  });
  function file(name, content = 'Harmless fixture data for HTTP tests.', extra = {}) {
    const backupPath = path.join(archiveRoot, crypto.randomBytes(6).toString('hex'), name);
    fs.mkdirSync(path.dirname(backupPath), {recursive: true});
    const bytes = Buffer.from(content); fs.writeFileSync(backupPath, bytes, {flag: 'wx'});
    return {name, backupPath, bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), archiveRole: ['Builds'], ...extra};
  }
  const data = Buffer.from('0123456789abcdefghijklmnopqrstuvwxyz');
  const ready = file('Texture Installer [HEN & CFW].pkg', data, {local: '/downloads/ps3/texture/123/Texture Installer [HEN & CFW].pkg', memberPath: 'Texture V2\\BLES HEN\\Texture Installer [HEN & CFW].pkg', releaseTag: 'v2'});
  const original = file('Texture Installer.rar');
  const owner = {id: 'texture-job', resourceId: 'gta-iv-texture-installer-v2', platform: 'PS3', title: 'Texture Installer', archiveRole: ['Builds'], files: [ready, original]};
  const resource = {id: owner.resourceId, name: 'Texture <Installer>', category: 'texture', compatibility: 'PS3 HEN/CFW; verify the listed variant.', region: 'BLES', gameUpdate: 'Not stated'};
  return {temporary, archiveRoot, file, ready, original, owner, resource, data, select(items = [owner], extras = {}) { return selectArchiveFiles({archiveRoot, scopedInventory: {items}, resources: [resource], ...extras}); }};
}

async function serve(t, f, options = {}) {
  const files = f.select();
  const server = createArchiveServer({archiveRoot: f.archiveRoot, files, ...options});
  await new Promise((resolve, reject) => {server.once('error', reject); server.listen(0, '127.0.0.1', resolve);});
  t.after(async () => { await new Promise(resolve => server.close(resolve)); });
  return {files, server, origin: 'http://127.0.0.1:' + server.address().port};
}

function rawRequest(origin, target, {method = 'GET', headers = {}} = {}) {
  const url = new URL(origin);
  return new Promise((resolve, reject) => {
    const request = http.request({host: url.hostname, port: url.port, path: target, method, headers}, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks)}));
    });
    request.on('error', reject); request.end();
  });
}

test('allowlist accepts ready builds and originals, excludes helpers, source, other consoles and invalid paths', t => {
  const f = fixture(t);
  const helper = f.file('Windows-helper.zip', 'helper', {archiveRole: ['Helpers', 'Windows']});
  const metadata = f.file('Config.ini', 'metadata', {archiveRole: ['Metadata']});
  const source = f.file('Source.zip', 'source', {archiveRole: ['Source Code']});
  const nonPs3 = {...f.owner, id: 'ps4-owner', platform: 'PS4', files: [f.file('Other.pkg')]};
  const invalid = f.file('Missing.pkg'); fs.unlinkSync(invalid.backupPath);
  const wrongSize = {...f.ready, bytes: f.ready.bytes + 1};
  const wrongHash = {...f.ready, sha256: 'not-a-sha256'};
  const outside = path.join(f.temporary, 'outside.pkg'); fs.writeFileSync(outside, 'outside');
  const badPath = {...f.ready, backupPath: outside, bytes: 7};
  const files = f.select([{...f.owner, files: [...f.owner.files, helper, metadata, source, invalid, wrongSize, wrongHash, badPath]}, nonPs3]);
  assert.equal(files.length, 2);
  assert.ok(files.every(file => /^[a-f0-9]{32}$/.test(file.id)));
  assert.ok(files.find(file => file.kind === 'package').variant.includes('BLES HEN'));
  assert.equal(f.select([{...f.owner, archiveRole: ['Helpers', 'Windows']}]).length, 0);
  assert.equal(f.select([{...f.owner, kind: 'github-source'}]).length, 0);
  const dependencies = [f.file('Runtime.dds'), f.file('Runtime.txt'), f.file('Readme.txt', 'documentation', {archiveRole: ['Metadata']}),f.file('._patch_mp.ff')];
  assert.deepEqual(f.select([{...f.owner, files: dependencies}]).map(file => file.filename), ['Runtime.dds', 'Runtime.txt']);
  assert.equal(f.select([{...f.owner, files: [f.file('EBOOT.BIN')]}])[0].filename, 'EBOOT.BIN');
});

test('a symlink or junction escaping the archive cannot become a downloadable record', t => {
  const f = fixture(t), outside = path.join(f.temporary, 'external');
  fs.mkdirSync(outside); fs.writeFileSync(path.join(outside, 'External.pkg'), 'external');
  const link = path.join(f.archiveRoot, 'linked');
  fs.symlinkSync(outside, link, 'junction');
  const entry = {...f.ready, name: 'External.pkg', backupPath: path.join(link, 'External.pkg'), bytes: 8};
  assert.equal(f.select([{...f.owner, files: [entry]}]).length, 0);
});

test('incomplete source distributions stay out of console-ready listings while archived files remain intact', t => {
  const f=fixture(t);
  assert.equal(f.select(undefined,{resources:[{...f.resource,readiness:'incomplete'}]}).length,0);
  assert.equal(f.select([{...f.owner,readiness:'incomplete'}],{resources:[]}).length,0);
  assert.ok(fs.existsSync(f.ready.backupPath)&&fs.existsSync(f.original.backupPath));
  assert.equal(f.select().length,2);
});

test('rejected console headers stay archived while game-data variants retain separate download identities', t => {
  const f=fixture(t),invalid=f.file('Misnamed.sprx','not an executable',{readiness:'invalid-console-header'});
  const variants=[f.file('common-NPEB00882.edat'),f.file('common-NPUB30702.edat'),f.file('patch_mp.ff')];
  const files=f.select([{...f.owner,files:[invalid,...variants]}]);
  assert.deepEqual(files.map(file=>file.filename).sort(),variants.map(file=>file.name).sort());
  assert.equal(new Set(files.map(file=>file.id)).size,3);
  assert.ok(fs.existsSync(invalid.backupPath));
});

test('shared audit selection includes only the exact pinned PS3 app and deduplicates repeated records', t => {
  const f = fixture(t), pinned = f.file('Pinned.pkg', 'pinned', {local: '/downloads/archive/pinned/Pinned.pkg'});
  delete pinned.archiveRole;
  const other = f.file('Not-pinned.pkg');
  const files = f.select([{...f.owner, files: [f.ready, f.ready]}], {
    pinnedApps: [{id: 'pinned-app', title: 'Pinned PS3 app', url: pinned.local, description: 'Pinned PS3 package.'}],
    auditInventory: {items: [{id: 'pinned-audit', pages: ['console/ps3.html'], files: [pinned, other]}, {id: 'other-platform', platform: 'PS4', pages: ['console/ps3.html'], files: [pinned]}]}
  });
  assert.equal(files.length, 2);
  assert.equal(files.find(file => file.filename === 'Pinned.pkg').resourceId, 'pinned-app');
  assert.ok(!files.some(file => file.filename === 'Not-pinned.pkg'));
});

test('directory and JSON expose plain direct links, compatible webMAN links and sanitized metadata only', async t => {
  const f = fixture(t), {origin, files} = await serve(t, f);
  const html = await rawRequest(origin, '/');
  assert.equal(html.status, 200);
  const text = html.body.toString();
  assert.match(text, /Texture &lt;Installer&gt;/);
  assert.ok(!/<script\b|<iframe\b|<video\b|install_ps3\?url|install\.ps3\?url/.test(text));
  assert.ok(text.includes('http://127.0.0.1/xmb.ps3/download.ps3?url=' + origin + '/files/'));
  assert.ok(!/\?url=http%3A/.test(text));
  assert.ok(!text.includes(f.archiveRoot));
  const json = await rawRequest(origin, '/catalog.json');
  const data = JSON.parse(json.body);
  assert.equal(data.platform, 'PS3'); assert.equal(data.files.length, 2);
  assert.ok(!/backupPath|archivePath|realPath|resolvedUrl|retainedTransferPath|partial|sourceUrl/.test(json.body.toString()));
  assert.ok(!json.body.toString().includes(f.archiveRoot));
  assert.equal((await rawRequest(origin, '/catalog.json?resource=' + f.owner.resourceId)).status, 200);
  assert.equal(JSON.parse((await rawRequest(origin, '/catalog.json?resource=unknown-resource')).body).files.length, 0);
  assert.equal((await rawRequest(origin, '/?resource=../bad')).status, 400);
  assert.equal((await rawRequest(origin, '/catalog.json?file=C:/private')).status, 400);
  assert.equal((await rawRequest(origin, '/', {method: 'HEAD'})).body.length, 0);
  assert.ok(files.every(file => text.includes(file.url)));
});

test('GET and HEAD return exact bytes and strong validators; approved site URLs alias the same file', async t => {
  const f = fixture(t), {origin, files} = await serve(t, f), entry = files.find(file => file.kind === 'package');
  const get = await rawRequest(origin, entry.url);
  assert.equal(get.status, 200); assert.deepEqual(get.body, f.data);
  assert.equal(Number(get.headers['content-length']), f.data.length);
  assert.equal(get.headers.etag, '"sha256-' + f.ready.sha256 + '"');
  assert.equal(get.headers['x-checksum-sha256'], f.ready.sha256);
  assert.equal(get.headers['accept-ranges'], 'bytes');
  assert.match(get.headers['content-disposition'], /^attachment; filename="Texture Installer/);
  const head = await rawRequest(origin, entry.url, {method: 'HEAD'});
  assert.equal(head.status, 200); assert.equal(head.body.length, 0); assert.equal(head.headers['content-length'], get.headers['content-length']);
  const alias = await rawRequest(origin, entry.aliases[0]);
  assert.deepEqual(alias.body, f.data);
  assert.equal((await rawRequest(origin, entry.url, {headers: {'If-None-Match': get.headers.etag}})).status, 304);
});

test('encoded # filenames remain downloadable and already escaped site aliases are normalized once', async t => {
  const f = fixture(t), filename = 'YouLeave#1.dds';
  const file = f.file(filename, 'runtime texture', {local: '/downloads/ps3/infarcted/123/Build%20HEN/YouLeave%231.dds'});
  const files = f.select([{...f.owner, files: [file]}]);
  assert.equal(files.length, 1);
  const entry = files[0];
  assert.ok(entry.url.endsWith('/YouLeave%231.dds'));
  assert.deepEqual(entry.aliases, ['/downloads/ps3/infarcted/123/Build%20HEN/YouLeave%231.dds']);
  const server = createArchiveServer({archiveRoot: f.archiveRoot, files});
  await new Promise((resolve, reject) => {server.once('error', reject); server.listen(0, '127.0.0.1', resolve);});
  t.after(async () => {await new Promise(resolve => server.close(resolve));});
  const origin = 'http://127.0.0.1:' + server.address().port;
  for (const route of [entry.url, entry.aliases[0], entry.ezremoteUrl]) {
    const response = await rawRequest(origin, route);
    assert.equal(response.status, 200, route);
    assert.equal(response.body.toString(), 'runtime texture');
  }
  assert.equal((await rawRequest(origin, entry.url.replace('%23', '#'))).status, 404);
  assert.equal((await rawRequest(origin, entry.url.replace('%23', '%2523'))).status, 404);
  assert.equal((await rawRequest(origin, entry.url.replace('%23', '%2f'))).status, 404);
  const traversal = {...file, local: '/downloads/ps3/infarcted/%2e%2e/YouLeave%231.dds'};
  assert.deepEqual(f.select([{...f.owner, files: [traversal]}])[0].aliases, []);
});

test('ezRemote Apache directory provides four-column relative resource/build/file links without renaming console files', async t => {
  const f = fixture(t), {origin, files} = await serve(t, f), entry = files.find(file => file.kind === 'package');
  const root = await rawRequest(origin, '/ezremote/');
  assert.equal(root.status, 200); assert.ok(root.body.toString().includes('<a href="' + f.owner.resourceId + '/">'));
  const resource = await rawRequest(origin, '/ezremote/' + f.owner.resourceId + '/');
  assert.equal(resource.status, 200);
  const directory = entry.directoryUrl.split('/').filter(Boolean).pop();
  assert.ok(resource.body.toString().includes('<a href="' + directory + '/">'));
  const build = await rawRequest(origin, entry.directoryUrl);
  const row = build.body.toString().match(/<tr><td><img alt="\[   \]"><\/td><td><a href="([^"]+)">[^<]+<\/a><\/td><td>(\d{4}-\d{2}-\d{2} \d{2}:\d{2})<\/td><td>(\d+)K<\/td><\/tr>/);
  assert.ok(row); assert.equal(row[1], encodeURIComponent(entry.filename));
  assert.ok(!row[1].includes('/')); assert.equal(Number(row[3]), Math.ceil(entry.bytes / 1024));
  const download = await rawRequest(origin, entry.directoryUrl + row[1]);
  assert.equal(download.status, 200); assert.deepEqual(download.body, f.data);
  const head = await rawRequest(origin, entry.ezremoteUrl, {method: 'HEAD'});
  assert.equal(Number(head.headers['content-length']), f.data.length);
  assert.equal((await rawRequest(origin, '/ezremote/unknown-resource/')).status, 404);
  assert.equal((await rawRequest(origin, '/ezremote/?path=elsewhere')).status, 400);
});

test('single byte ranges, suffixes, open ends and If-Range support download resumption', async t => {
  const f = fixture(t), {origin, files} = await serve(t, f), entry = files.find(file => file.kind === 'package');
  const range = await rawRequest(origin, entry.url, {headers: {Range: 'bytes=4-9'}});
  assert.equal(range.status, 206); assert.deepEqual(range.body, f.data.subarray(4, 10));
  assert.equal(range.headers['content-range'], 'bytes 4-9/' + f.data.length); assert.equal(range.headers['content-length'], '6');
  const suffix = await rawRequest(origin, entry.url, {headers: {Range: 'bytes=-5'}});
  assert.deepEqual(suffix.body, f.data.subarray(-5));
  const open = await rawRequest(origin, entry.url, {headers: {Range: 'bytes=30-'}});
  assert.deepEqual(open.body, f.data.subarray(30));
  const clamped = await rawRequest(origin, entry.url, {headers: {Range: 'bytes=30-999'}});
  assert.deepEqual(clamped.body, f.data.subarray(30));
  const head = await rawRequest(origin, entry.url, {method: 'HEAD', headers: {Range: 'bytes=0-2'}});
  assert.equal(head.status, 206); assert.equal(head.headers['content-length'], '3'); assert.equal(head.body.length, 0);
  const matched = await rawRequest(origin, entry.url, {headers: {Range: 'bytes=1-3', 'If-Range': range.headers.etag}});
  assert.equal(matched.status, 206);
  const changed = await rawRequest(origin, entry.url, {headers: {Range: 'bytes=1-3', 'If-Range': '"old"'}});
  assert.equal(changed.status, 200); assert.deepEqual(changed.body, f.data);
  for (const value of ['bytes=999-', 'bytes=4-2', 'bytes=-0', 'bytes=0-1,4-5', 'bytes=-', 'items=0-1']) {
    const invalid = await rawRequest(origin, entry.url, {headers: {Range: value}});
    assert.equal(invalid.status, 416, value); assert.equal(invalid.headers['content-range'], 'bytes */' + f.data.length);
  }
});

test('mutations and arbitrary, encoded traversal, helper and mismatched routes never serve data', async t => {
  const f = fixture(t), {origin, files} = await serve(t, f), entry = files[0];
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) {
    const result = await rawRequest(origin, entry.url, {method});
    assert.equal(result.status, 405); assert.equal(result.headers.allow, 'GET, HEAD');
  }
  for (const route of ['/F:/private.pkg', '/../private.pkg', '/%2e%2e/private.pkg', '/files/%2f/private.pkg', '/files/../private.pkg', entry.url + '/extra', entry.url.replace(/[^/]+$/, 'Wrong.pkg'), '/downloads/ps3/windows/helper.exe', entry.url + '?path=private']) {
    assert.equal((await rawRequest(origin, route)).status, 404, route);
  }
  assert.equal((await rawRequest(origin, '/', {headers: {Host: 'untrusted.example'}})).status, 400);
});

test('deleted files and same-size tampering are rejected without leaking desktop paths', async t => {
  const f = fixture(t), {origin, files} = await serve(t, f), entry = files.find(file => file.kind === 'package');
  assert.equal((await rawRequest(origin, entry.url)).status, 200);
  const replacement = Buffer.alloc(f.ready.bytes, 'x'); fs.writeFileSync(f.ready.backupPath, replacement);
  // Also force a distinct timestamp on filesystems with coarse timestamp precision.
  const changedTime = new Date(Date.now() + 5000); fs.utimesSync(f.ready.backupPath, changedTime, changedTime);
  const changed = await rawRequest(origin, entry.url);
  assert.equal(changed.status, 409); assert.ok(!changed.body.toString().includes(f.archiveRoot));
  fs.unlinkSync(f.ready.backupPath);
  assert.equal((await rawRequest(origin, entry.url)).status, 409);
});

test('binding defaults to loopback and rejects public, wildcard and malformed addresses', () => {
  assert.deepEqual(parseArgs([]), {host: '127.0.0.1', port: 8766, help: false});
  for (const host of ['10.0.0.2', '172.16.0.2', '172.31.255.2', '192.168.1.20']) assert.ok(isPrivateHost(host));
  for (const host of ['0.0.0.0', '8.8.8.8', '::', '172.32.0.1', '192.168.01.1', '127.0.0.2', 'localhost', '192.168.1.2/path']) assert.throws(() => parseArgs(['--host=' + host]));
  assert.throws(() => parseArgs(['--port=0'])); assert.throws(() => parseArgs(['--unknown']));
  assert.deepEqual(parseSingleRange('bytes=-99', 4), {start: 0, end: 3, length: 4});
  assert.throws(() => parseSingleRange('bytes=0-', 0));
});
