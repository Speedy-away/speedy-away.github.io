const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const audit = require('../audit-external-downloads.cjs');

test('classifies direct files, provider pages, pinned releases and excluded device/gate links separately', () => {
  assert.equal(audit.classify('https://github.com/a/b/releases/download/v1/file.zip'), 'direct-file');
  assert.equal(audit.classify('https://github.com/a/b/releases/tag/v1'), 'download-page');
  assert.equal(audit.classify('https://www.mediafire.com/file/abc/tool.zip/file'), 'provider-page');
  assert.equal(audit.classify('https://raw.githubusercontent.com/a/b/main/host/index.html'), 'source-page');
  assert.equal(audit.classify('https://github.com/a/b/blob/v1/patch.xml'), 'source-page');
  assert.equal(audit.classify('https://bstlar.com/gate/abc'), 'gated-skipped');
  assert.equal(audit.classify('http://127.0.0.1:6701/file.zip'), 'local-device-target');
  assert.equal(audit.classify('http://{address}:8080/fs/'), 'local-device-target');
  assert.equal(audit.classify('https://whatwhatboy.com/downloads/tool.zip'), null);
});

test('collects dynamic runtime download URLs and de-duplicates anchor references without matching data-href as href', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(),'whatsite-link-audit-'));
  t.after(() => fs.rmSync(dir,{recursive:true,force:true}));
  fs.mkdirSync(path.join(dir,'downloads'));
  fs.writeFileSync(path.join(dir,'index.html'), `<a href="https://example.com/tool.zip?x=1&amp;y=2" download>Download</a><a href="https://example.com/tool.zip?x=1&amp;y=2">Again</a><a data-href="https://ignored.example/fake.zip">No native link</a><button data-download-url="https://example.com/dynamic.bin">Save</button><script type="application/json">{"files":[{"url":"https://example.com/catalog.elf"}]}</script>`);
  fs.writeFileSync(path.join(dir,'downloads/catalog.json'),JSON.stringify({items:[{url:'https://example.com/provider',title:'Download tool'}]}));
  const result = audit.collect({root:dir});
  assert.equal(result.pages,1);
  assert.equal(result.entries.length,5);
  assert.equal(result.entries.find(entry => entry.url.includes('tool.zip')).references.length,2);
  assert.ok(result.entries.some(entry => entry.url.endsWith('dynamic.bin')));
  assert.ok(result.entries.some(entry => entry.url.endsWith('catalog.elf')));
  assert.ok(result.entries.some(entry => entry.references[0].page === 'downloads/catalog.json'));
  assert.equal(audit.attribute(' data-href="https://ignored.example/fake.zip"', 'href'),null);
  assert.equal(result.entries.find(entry => entry.url.includes('ignored.example')).references[0].field,'dynamic-data');
});

test('HTTP status alone cannot turn HTML, challenges, empty bytes, JSON errors or LFS pointers into a working file', () => {
  const file = {kind:'direct-file'};
  const response = {status:200,headers:{'content-type':'application/octet-stream'},sampledBytes:32,snippet:'PK\u0003\u0004binary'};
  assert.equal(audit.resultStatus(file,response),'reachable-file');
  assert.equal(audit.resultStatus(file,{...response,snippet:'<!doctype html><title>Error</title>'}),'html-instead-of-file');
  assert.equal(audit.resultStatus(file,{...response,snippet:'<html>Just a moment cf-chl-token</html>'}),'challenge-page');
  assert.equal(audit.resultStatus(file,{...response,sampledBytes:0,snippet:''}),'invalid-file');
  assert.equal(audit.resultStatus(file,{...response,snippet:'version https://git-lfs.github.com/spec/v1\noid sha256:abc\nsize 10000'}),'invalid-file');
  assert.equal(audit.resultStatus(file,{...response,snippet:'{"error":"File not found"}'}),'error-instead-of-file');
  assert.equal(audit.resultStatus(file,{...response,snippet:'{"patches":[1,2],"name":"fps"}'}),'reachable-file');
  assert.equal(audit.resultStatus(file,{...response,status:404}),'unavailable');
  assert.equal(audit.resultStatus(file,{...response,status:403}),'access-blocked');
  assert.equal(audit.resultStatus({kind:'provider-page'},{...response,headers:{'content-type':'text/html'},snippet:'<html>Download</html>'}),'provider-page-unverified');
  assert.equal(audit.resultStatus({kind:'provider-page'},{...response,snippet:'{"error":"notFound"}'}),'provider-page-unverified');
});

test('bounded GET sends Range, cancels a large response and follows only public HTTP redirects', async () => {
  const calls = [];
  let cancelled = false;
  const fetcher = async (url, options) => {
    calls.push({url,options});
    if (calls.length === 1) return new Response(null,{status:302,headers:{Location:'https://cdn.example.com/file.zip'}});
    return new Response(new ReadableStream({start(controller){controller.enqueue(new Uint8Array(100000));},cancel(){cancelled = true;}}),{status:200,headers:{'content-type':'application/zip'}});
  };
  const result = await audit.boundedRequest('https://example.com/file.zip',{method:'GET',limit:512,fetch:fetcher});
  assert.equal(calls.length,2);
  assert.equal(calls[1].options.headers.Range,'bytes=0-511');
  assert.equal(result.sampledBytes,512);
  assert.equal(result.finalUrl,'https://cdn.example.com/file.zip');
  assert.equal(cancelled,true);
  const privateRedirect = await audit.boundedRequest('https://example.com/file.zip',{fetch:async () => new Response(null,{status:302,headers:{Location:'http://127.0.0.1/private'}})});
  assert.equal(privateRedirect.error,'non-public HTTP target');
});

test('GET success replaces a provider HEAD denial while intentional gates and device actions perform no HTTP request', async () => {
  let calls = 0;
  const result = await audit.check({url:'https://example.com/file.zip',kind:'direct-file',references:[]},{fetch:async (url,options) => {calls++;return options.method === 'HEAD' ? new Response(null,{status:403}) : new Response('PKdata',{status:200,headers:{'content-type':'application/zip'}});}});
  assert.equal(result.outcome,'reachable-file');
  assert.equal(result.headStatus,403);
  assert.equal(calls,2);
  for (const kind of ['gated-skipped','local-device-target']) {
    const skipped = await audit.check({url:'https://example.com/file.zip',kind},{fetch:async () => {throw Error('must not fetch');}});
    assert.match(skipped.outcome,/^skipped-/);
  }
});

test('phone probes send the selected browser user agent, and HEAD404 is confirmed by a bounded GET', async () => {
  const agents = [];
  for (const device of ['iphone','android']) {
    const result = await audit.check({url:'https://example.com/help',kind:'external-page',device},{fetch:async (url,options) => {
      agents.push(options.headers['User-Agent']);
      return options.method === 'HEAD' ? new Response(null,{status:404}) : new Response('<html>Help</html>',{status:200,headers:{'content-type':'text/html'}});
    }});
    assert.equal(result.outcome,'reachable-page');
    assert.equal(result.headStatus,404);
    assert.equal(result.device,device);
  }
  assert.match(agents[0],/iPhone/);
  assert.match(agents[2],/Android/);
});

test('MediaFire verification probes only its public Download button and distinguishes provider HTML from actual file bytes', async () => {
  const provider = {url:'https://www.mediafire.com/file/abc/menu.zip/file',kind:'provider-page',device:'iphone'};
  const calls = [];
  const result = await audit.check(provider,{fetch:async (url,options) => {
    calls.push({url,options});
    if (options.method === 'HEAD') return new Response(null,{status:200,headers:{'content-type':'text/html'}});
    if (url.includes('www.mediafire.com')) return new Response(' '.repeat(70000) + '<a href="https://advert.example/fake.zip">Ad</a><a id="downloadButton" href="https://download1.mediafire.com/abc/menu.zip">Download</a>',{status:200,headers:{'content-type':'text/html'}});
    return new Response('PKfilebytes',{status:206,headers:{'content-type':'application/zip','content-range':'bytes 0-10/100000'}});
  }});
  assert.equal(result.outcome,'provider-file-available');
  assert.equal(result.providerTarget.outcome,'reachable-file');
  assert.equal(calls.length,3);
  assert.equal(calls[1].options.headers.Range,'bytes=0-196607');
  assert.equal(calls[2].options.headers.Range,'bytes=0-2047');
  assert.ok(calls.every(call => !call.url.includes('advert.example')));
  assert.equal(audit.advertisedDownload(provider,{snippet:'<a id="downloadButton" href="http://127.0.0.1/file.zip">Bad</a>'}),null);
});
