// Read-only remote link checks. Never saves or executes a downloaded payload.
const fs = require('node:fs');
const path = require('node:path');
const origin = 'https://whatwhatboy.com';
const root = path.resolve(__dirname, '..');
const excluded = new Set(['.git', '.agents', '.codex', '.claude', '.playwright', '.playwright-cli', 'node_modules', 'assets', 'docs', 'design-references', 'languages', 'i18n-tools', 'scripts', 'tmp']);
const fileExtension = /\.(?:zip|7z|rar|tar|gz|bz2|xz|bin|elf|pkg|prx|sprx|plugin|lua|gsc|csc|gscc|asi|dll|exe|msi|apk|ipa|iso|img|vpk|p3t|ptf|ctf|nxtheme|wuhb|xbe|pbp|rpl|self|fself|rpx|nro|nsp|cia|3dsx|nds|dol|wad|pup|upd|pdb|jar|json|xml|csv|txt|md|pdf|xex|gpd|ct|ini|cfg|dat)$/i;
const providers = /(^|\.)(?:mediafire\.com|mega\.(?:nz|co\.nz)|gofile\.io|drive\.google\.com|dropbox\.com|workupload\.com|pixeldrain\.com|1fichier\.com|modsfire\.com|sendspace\.com|anonfiles\.com)$/i;
const userAgents = {
  iphone:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  android:'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36'
};
const decode = value => String(value).replace(/&(?:amp|#38);/gi, '&').replace(/&quot;|&#34;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
function attribute(tag, name) {
  const match = tag.match(new RegExp('(?:^|\\s)' + name + '\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\'|([^\\s>]+))', 'i'));
  return match ? decode(match[1] ?? match[2] ?? match[3]) : null;
}
function pageFiles(dir = root) {
  if (/^hosts\/runtime(?:\/|$)/.test(path.relative(root,dir).replaceAll('\\','/'))) return [];
  return fs.readdirSync(dir, {withFileTypes:true}).flatMap(entry => {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (excluded.has(entry.name)) return [];
      if (entry.name === 'downloads') return fs.existsSync(path.join(file, 'index.html')) ? [path.join(file, 'index.html')] : [];
      return pageFiles(file);
    }
    return entry.name.endsWith('.html') && !/^whatsite-ps[45]\.html$/.test(entry.name) ? [file] : [];
  });
}
function classify(value, label = '', explicit = false) {
  let url;
  try { url = new URL(value); } catch { return null; }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.origin === origin) return null;
  if (!publicHttp(value) || /\{|\}/.test(url.hostname)) return 'local-device-target';
  if (/(^|\.)bstlar\.com$/i.test(url.hostname)) return 'gated-skipped';
  if (providers.test(url.hostname)) return 'provider-page';
  if (url.hostname === 'raw.githubusercontent.com' && /\.html?$/i.test(url.pathname)) return 'source-page';
  if (url.hostname === 'github.com' && /\/(?:blob|tree|issues|pull|wiki)(?:\/|$)/.test(url.pathname)) return 'source-page';
  if (fileExtension.test(url.pathname) || /github\.com$/.test(url.hostname) && /\/releases\/download\//.test(url.pathname) || /^(?:raw\.githubusercontent\.com|objects\.githubusercontent\.com|release-assets\.githubusercontent\.com|cdn\.discordapp\.com|cdn\.discordapp\.net)$/.test(url.hostname)) return 'direct-file';
  if (explicit || /\b(?:download|save|installer|release|firmware|payload)\b/i.test(label) || /\/releases(?:\/|$)/.test(url.pathname)) return 'download-page';
  if (/^(?:github\.com|gitlab\.com|codeberg\.org|bitbucket\.org)$/.test(url.hostname)) return 'source-page';
  return 'external-page';
}
function collect(options = {}) {
  const entries = new Map();
  const add = (href, page, label = '', explicit = false, field = 'anchor') => {
    const kind = classify(href, label, explicit);
    if (!kind) return;
    const parsed = new URL(href);
    // Fragments identify MEGA files but never change the HTTP request elsewhere.
    const key = /(^|\.)mega\.(?:nz|co\.nz)$/i.test(parsed.hostname) ? parsed.href : (parsed.hash = '', parsed.href);
    let entry = entries.get(key);
    if (!entry) { entry = {url:key, kind, references:[]}; entries.set(key, entry); }
    const rank = {'local-device-target':7, 'gated-skipped':6, 'direct-file':5, 'provider-page':4, 'download-page':3, 'source-page':2, 'external-page':1};
    if (rank[kind] > rank[entry.kind]) entry.kind = kind;
    const reference = {page, label:label.replace(/\s+/g, ' ').trim().slice(0,160), field};
    if (!entry.references.some(ref => ref.page === page && ref.label === reference.label && ref.field === field)) entry.references.push(reference);
  };
  const files = pageFiles(options.root || root);
  for (const file of files) {
    const page = path.relative(options.root || root, file).replaceAll('\\', '/');
    const html = fs.readFileSync(file, 'utf8');
    for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi)) {
      const href = attribute(' ' + match[1], 'href');
      if (href && /^https?:\/\//i.test(href)) add(href, page, decode(match[2].replace(/<[^>]*>/g, ' ')), /(?:^|\s)download(?:\s|=|$)/i.test(match[1]));
    }
    for (const match of html.matchAll(/\bdata-(?:download|url|href|source|file-url|source-url|download-url)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) {
      const value = decode(match[1] || match[2] || '');
      if (/^https?:\/\//i.test(value)) add(value, page, '', true, 'dynamic-data');
    }
    for (const match of html.matchAll(/<script\b[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
      try { walk(JSON.parse(match[1]), page); } catch { /* Not executable JavaScript. */ }
    }
  }
  function walk(value, page, field = '') {
    if (Array.isArray(value)) { for (const item of value) walk(item, page, field); return; }
    if (!value || typeof value !== 'object') return;
    for (const [key, item] of Object.entries(value)) {
      if (typeof item === 'string' && /^https?:\/\//i.test(item) && /(?:url|href|source|download|asset|file)/i.test(key)) add(item, page, String(value.title || value.name || ''), /download|asset|file/i.test(key), field ? field + '.' + key : key);
      else if (typeof item === 'object') walk(item, page, key);
    }
  }
  // This is a public runtime data source used by the download library.
  const catalogPath = path.join(options.root || root, 'downloads/catalog.json');
  if (fs.existsSync(catalogPath)) walk(JSON.parse(fs.readFileSync(catalogPath, 'utf8')), 'downloads/catalog.json');
  return {pages:files.length, entries:[...entries.values()].sort((a,b) => a.url.localeCompare(b.url))};
}
function publicHttp(value) {
  const url = new URL(value);
  return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && !/\{|\}|%7[bd]/i.test(url.hostname) && !/^(?:localhost|.*\.localhost|.*\.local|0\.0\.0\.0|127\..*|10\..*|192\.168\..*|169\.254\..*|172\.(?:1[6-9]|2\d|3[01])\..*|\[.*\])$/i.test(url.hostname);
}
async function boundedRequest(value, options = {}) {
  const fetcher = options.fetch || fetch;
  let url = value;
  const redirects = [];
  for (let attempt = 0; attempt <= 7; attempt++) {
    if (!publicHttp(url)) return {status:0, error:'non-public HTTP target', redirects};
    const response = await fetcher(url, {method:options.method || 'HEAD', redirect:'manual', signal:options.signal, headers:{'User-Agent':options.userAgent || 'whatsite-readonly-link-check/1.0', Accept:'*/*', ...(options.method === 'GET' ? {Range:'bytes=0-' + ((options.limit || 8192) - 1), 'Accept-Encoding':'identity'} : {})}});
    const headers = Object.fromEntries(['content-type','content-length','content-range','content-disposition','location','server','retry-after'].map(name => [name, response.headers.get(name)]).filter(([,value]) => value !== null));
    if ([301,302,303,307,308].includes(response.status) && headers.location) {
      await response.body?.cancel();
      redirects.push({status:response.status, url});
      url = new URL(headers.location, url).href;
      continue;
    }
    let snippet = '', sampledBytes = 0;
    if (options.method === 'GET' && response.body) {
      const reader = response.body.getReader();
      const chunks = [];
      try {
        while (sampledBytes < (options.limit || 8192)) {
          const next = await reader.read(); if (next.done) break;
          const sample = next.value.subarray(0, (options.limit || 8192) - sampledBytes);
          chunks.push(Buffer.from(sample)); sampledBytes += sample.length;
        }
        snippet = Buffer.concat(chunks).toString('utf8');
      } finally { await reader.cancel().catch(() => {}); }
    } else await response.body?.cancel();
    return {status:response.status, finalUrl:url, headers, redirects, snippet, sampledBytes};
  }
  return {status:0, error:'redirect limit exceeded', redirects};
}
function resultStatus(entry, result) {
  if (result.error) return 'network-error';
  if ([404,410].includes(result.status)) return 'unavailable';
  if ([401,403,429,451].includes(result.status)) return 'access-blocked';
  if (result.status >= 400) return 'http-error';
  if (result.status < 200 || result.status >= 300) return 'unverified';
  const flags = result.sampleFlags || sampleFlags(result);
  const html = /text\/html|application\/xhtml/i.test(result.headers?.['content-type'] || '') || flags.html;
  if (flags.challenge) return 'challenge-page';
  if (entry.kind === 'direct-file') {
    if (flags.empty || flags.gitLfsPointer) return 'invalid-file';
    if (flags.errorDocument) return 'error-instead-of-file';
    return html ? 'html-instead-of-file' : 'reachable-file';
  }
  if (entry.kind === 'provider-page') {
    if (flags.providerUnavailable) return 'provider-unavailable';
    if (flags.empty || flags.gitLfsPointer || flags.errorDocument) return 'provider-page-unverified';
    return html ? 'provider-page-unverified' : 'reachable-file';
  }
  return 'reachable-page';
}
function sampleFlags(result) {
  const text = String(result.snippet || '').replace(/^\uFEFF/,'').trimStart();
  let errorDocument = false;
  try {
    const object = JSON.parse(text);
    errorDocument = object && typeof object === 'object' && !Array.isArray(object) && typeof object.error === 'string' && Boolean(object.error) && Object.keys(object).every(key => /^(?:error|message|code|status|success)$/i.test(key));
  } catch { /* A bounded sample may deliberately be incomplete JSON. */ }
  return {
    html:/^(?:<!doctype\s+html|<html\b)/i.test(text),
    challenge:/cf-chl-|<title[^>]*>\s*(?:Just a moment|CAPTCHA)|verify (?:that )?you are human|Checking your browser/i.test(text),
    gitLfsPointer:/^version https:\/\/git-lfs\.github\.com\/spec\/v1\s/.test(text),
    empty:result.status === 204 || result.sampledBytes === 0 || result.headers?.['content-length'] === '0' || /\/0$/.test(result.headers?.['content-range'] || ''),
    errorDocument,
    providerUnavailable:/file (?:has been|was) (?:deleted|removed)|file (?:you requested )?(?:does not exist|not found)|invalid or deleted file|(?:file|download) is no longer available|The file you requested has been deleted/i.test(text)
  };
}
function advertisedDownload(entry, result) {
  const url = new URL(entry.url);
  if (!/(^|\.)mediafire\.com$/i.test(url.hostname)) return null;
  for (const match of String(result.snippet || '').matchAll(/<a\b([^>]*)>/gi)) {
    const tag = ' ' + match[1];
    if (attribute(tag,'id') !== 'downloadButton') continue;
    const href = attribute(tag,'href');
    if (!href) continue;
    let target;
    try {target = new URL(href,result.finalUrl || entry.url);} catch {continue;}
    // Only the provider's own advertised download host. Do not crawl adverts,
    // execute page JavaScript, solve gates, or follow another provider.
    if (publicHttp(target.href) && /(^|\.)mediafire\.com$/i.test(target.hostname) && target.href !== entry.url) return target.href;
  }
  return null;
}
async function check(entry, options = {}) {
  const checkedAt = new Date().toISOString();
  options = {...options, ...(userAgents[entry.device] ? {userAgent:userAgents[entry.device]} : {})};
  if (entry.kind === 'gated-skipped') return {...entry, checkedAt, outcome:'skipped-gated', reason:'Bstlar is intentionally skipped by AGENTS.md; no gate solving.'};
  if (entry.kind === 'local-device-target') return {...entry, checkedAt, outcome:'skipped-local-device', reason:'Console/device address or template; not a public internet download.'};
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeout || 18000);
    let result, providerTarget, providerButton;
    try {
      result = await boundedRequest(entry.url, {...options, method:'HEAD', signal:controller.signal});
      // A page-only HEAD proves no file availability. Sample content without
      // retaining a payload so HTML errors cannot masquerade as a file.
      if (result.status && ![429,451].includes(result.status) && (['direct-file','provider-page'].includes(entry.kind) || [403,404,405,410,501].includes(result.status))) {
        const mediafire = entry.kind === 'provider-page' && /(^|\.)mediafire\.com$/i.test(new URL(entry.url).hostname);
        const sampled = await boundedRequest(entry.url, {...options, method:'GET', limit:entry.kind === 'direct-file' ? 2048 : mediafire ? 196608 : 16384, signal:controller.signal});
        result = {...sampled, headStatus:result.status};
      }
      const target = advertisedDownload(entry,result);
      if (entry.kind === 'provider-page' && /(^|\.)mediafire\.com$/i.test(new URL(entry.url).hostname)) providerButton = {probeVersion:2,found:Boolean(target),htmlSampleCapped:result.sampledBytes >= 196608, ...(target ? {url:target} : {}),note:'Public Download button only; JavaScript actions, gates, sign-in and adverts are not followed.'};
      if (target && result.status >= 200 && result.status < 300) {
        try {
          const sampled = await boundedRequest(target,{...options,method:'GET',limit:2048,signal:controller.signal});
          const {snippet,...evidence} = sampled;
          providerTarget = {url:target,...evidence,sampleFlags:sampleFlags(sampled),outcome:resultStatus({kind:'direct-file'},sampled),note:'Publicly advertised provider URL may be temporary. Bounded bytes only; file integrity and physical saving untested.'};
        } catch (error) {providerTarget = {url:target,outcome:'network-error',error:error.cause?.code || error.code || error.name};}
      }
    } finally { clearTimeout(timer); }
    let outcome = resultStatus(entry, result);
    if (providerTarget) outcome = providerTarget.outcome === 'reachable-file' ? 'provider-file-available' : ['unavailable','invalid-file','error-instead-of-file'].includes(providerTarget.outcome) ? 'provider-target-unavailable' : 'provider-target-unverified';
    const {snippet, ...evidence} = result;
    evidence.sampleFlags = sampleFlags(result);
    const title = snippet?.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim().slice(0,160);
    return {...entry, checkedAt, outcome, ...evidence, ...(providerTarget ? {providerTarget} : {}), ...(providerButton ? {providerButton} : {}), ...(title ? {pageTitle:title} : {})};
  } catch (error) {
    return {...entry, checkedAt, outcome:'network-error', error:error.cause?.code || error.code || error.name, detail:String(error.message).slice(0,180)};
  }
}
async function run(entries, options = {}) {
  const results = new Array(entries.length);
  const pending = entries.map((entry,index) => ({entry,index,host:new URL(entry.url).hostname}));
  const active = new Set(), perHost = new Map();
  let completed = 0;
  while (pending.length || active.size) {
    while (active.size < (options.concurrency || 10)) {
      const next = pending.findIndex(job => (perHost.get(job.host) || 0) < 2);
      if (next < 0) break;
      const {entry,index,host} = pending.splice(next,1)[0];
      perHost.set(host, (perHost.get(host) || 0) + 1);
      const task = check(entry,options).then(result => {results[index] = result; options.onResult?.(result,++completed,entries.length);}).finally(() => {active.delete(task); perHost.set(host,perHost.get(host) - 1);});
      active.add(task);
    }
    if (active.size) await Promise.race(active);
  }
  return results;
}
function summary(results) {
  const counts = {};
  for (const result of results) counts[result.outcome || result.kind] = (counts[result.outcome || result.kind] || 0) + 1;
  return counts;
}
module.exports = {attribute, classify, collect, publicHttp, boundedRequest, sampleFlags, resultStatus, advertisedDownload, check, run, summary, userAgents};
if (require.main === module) (async () => {
  const args = process.argv.slice(2);
  const option = name => args.find(value => value.startsWith(name + '='))?.slice(name.length + 1);
  const inventory = collect();
  let entries = inventory.entries;
  if (args.includes('--downloads-only') || args.includes('--visible-downloads-only')) entries = entries.filter(entry => ['direct-file','provider-page','download-page'].includes(entry.kind));
  if (args.includes('--visible-downloads-only')) entries = entries.filter(entry => entry.references.some(ref => /\b(?:download|save|installer?|get|release)\b/i.test(ref.label) && !/^(?:original|source|upstream)/i.test(ref.label)));
  const only = option('--host'); if (only) entries = entries.filter(entry => new URL(entry.url).hostname.includes(only));
  const limit = Number(option('--limit')); if (limit > 0) entries = entries.slice(0,limit);
  const devices = (option('--devices') || option('--device') || '').split(',').filter(Boolean);
  if (devices.some(device => !userAgents[device])) throw Error('Device must be iphone or android.');
  const uniqueSelectedUrls = entries.length;
  if (devices.length) entries = entries.flatMap(entry => devices.map(device => ({...entry,device})));
  const reportPath = path.resolve(root, option('--output') || 'docs/qa/external-download-links.json');
  if (!reportPath.startsWith(root + path.sep)) throw Error('Report must stay inside checkout.');
  console.log(`Found ${inventory.entries.length} unique external URLs on ${inventory.pages} public pages and the runtime download catalog. Kinds: ${JSON.stringify(summary(inventory.entries))}`);
  const resultKey = result => (result.device || 'default') + '\n' + result.url;
  const prior = args.includes('--resume') && fs.existsSync(reportPath) ? new Map(JSON.parse(fs.readFileSync(reportPath,'utf8')).results.map(result => [resultKey(result),result])) : new Map();
  const reuse = [], pending = [];
  for (const entry of entries) {
    const existing = prior.get(resultKey(entry));
    // Resume can refresh classification and references without another remote
    // request. Old short/plain direct samples lacked LFS/error flags, so only
    // those ambiguous responses need a fresh bounded sample.
    const needsSample = existing && ((entry.kind === 'direct-file' && existing.kind !== 'direct-file') || (!existing.sampleFlags && existing.outcome === 'reachable-file' && /text\/|json|xml/i.test(existing.headers?.['content-type'] || '') && existing.sampledBytes < 2048) || existing.outcome === 'unavailable' && existing.headStatus == null || entry.device && entry.kind === 'provider-page' && /(^|\.)mediafire\.com$/i.test(new URL(entry.url).hostname) && existing.sampledBytes >= 131072 && existing.providerButton?.probeVersion !== 2);
    if (existing?.outcome && !needsSample) {
      const merged = {...existing,...entry};
      if (!merged.outcome.startsWith('skipped-') && !merged.providerTarget) merged.outcome = resultStatus(entry,merged);
      reuse.push(merged);
    } else pending.push(entry);
  }
  const partial = [...reuse];
  if (prior.size) console.log(`Reusing ${reuse.length} checked URLs; checking ${pending.length} new or ambiguous URLs.`);
  const checked = args.includes('--check') ? await run(pending, {timeout:Number(option('--timeout')) || 18000, concurrency:Number(option('--concurrency')) || 10, onResult:(result,index,total) => {
    partial.push(result);
    if (index % 25 === 0 || index === total) {
      console.log(`Checked ${index}/${total}: ${JSON.stringify(summary(partial))}`);
      fs.mkdirSync(path.dirname(reportPath), {recursive:true});
      fs.writeFileSync(reportPath, JSON.stringify({generatedAt:new Date().toISOString(), status:'in-progress', totalUniqueExternalUrls:inventory.entries.length, completed:index, summary:summary(partial), results:partial},null,2) + '\n');
    }
  }}) : entries;
  const results = args.includes('--check') ? [...reuse,...checked].sort((a,b) => a.url.localeCompare(b.url)) : entries;
  const report = {generatedAt:new Date().toISOString(), mode:args.includes('--check') ? 'read-only external HTTP checks; bounded samples only, no payloads saved or executed' : 'inventory only; no network checks', publicPages:inventory.pages, totalUniqueExternalUrls:inventory.entries.length, selectedUniqueUrls:uniqueSelectedUrls, devices, ...(devices.length ? {userAgents:Object.fromEntries(devices.map(device => [device,userAgents[device]]))} : {}), processedEntries:args.includes('--check') ? entries.length : 0, httpAttemptedEntries:args.includes('--check') ? results.filter(result => !result.outcome.startsWith('skipped-')).length : 0, summary:summary(results), byDevice:devices.length ? Object.fromEntries(devices.map(device => [device,summary(results.filter(result => result.device === device))])) : undefined, limits:['HTTP reachability is not a physical iPhone/Android saving test.', 'Provider pages requiring JavaScript, sign-in, gates or a user session remain unverified.', 'Bstlar links are recorded but intentionally skipped.', 'Successful samples do not prove complete file integrity.'], results};
  fs.mkdirSync(path.dirname(reportPath), {recursive:true}); fs.writeFileSync(reportPath, JSON.stringify(report,null,2) + '\n');
  if (args.includes('--check')) {
    const visible = results.filter(result => result.references.some(ref => /\b(?:download|save|installer?|get|release)\b/i.test(ref.label) && !/^(?:original|source|upstream)/i.test(ref.label)) && ['direct-file','provider-page','download-page'].includes(result.kind));
    const issuePath = reportPath.replace(/\.json$/i,'-visible-actions.json');
    fs.writeFileSync(issuePath,JSON.stringify({generatedAt:report.generatedAt,sourceReport:path.relative(root,reportPath).replaceAll('\\','/'),visibleActionEntries:visible.length,summary:summary(visible),issues:visible.filter(result => !['reachable-file','reachable-page','provider-file-available'].includes(result.outcome)),note:'Provider and access limitations are unverified, not asserted broken. Source/provenance-only references are excluded from this priority list.'},null,2) + '\n');
  }
  console.log(JSON.stringify({report:path.relative(root,reportPath), summary:report.summary}));
})().catch(error => {console.error(error); process.exitCode = 1;});
