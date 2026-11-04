// Read-only social/search metadata, PNG and local HTTP verification.
// The only optional write is its QA report; this never refreshes site HTML.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const scope = require('./site-public-pages.cjs');
const {inspect, attributes, decode} = require('./verify-site-search-metadata.cjs');
const {isGenericKeyword} = require('./search-keyword-quality.cjs');
const root = scope.root;
const origin = 'https://whatwhatboy.com';
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const required = [
  ['name', 'description'], ['name', 'keywords'],
  ['property', 'og:type'], ['property', 'og:site_name'], ['property', 'og:locale'],
  ['property', 'og:url'], ['property', 'og:title'], ['property', 'og:description'],
  ['property', 'og:image'], ['property', 'og:image:secure_url'], ['property', 'og:image:type'],
  ['property', 'og:image:width'], ['property', 'og:image:height'], ['property', 'og:image:alt'],
  ['name', 'twitter:card'], ['name', 'twitter:title'], ['name', 'twitter:description'],
  ['name', 'twitter:image'], ['name', 'twitter:image:alt']
];

function bundledSharp() {
  try { return require('sharp'); } catch {}
  const roots = [process.env.SOCIAL_PREVIEW_NODE_MODULES,
    path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')].filter(Boolean);
  for (const base of roots) {
    try { return require(require.resolve('sharp', {paths: [base]})); } catch {}
  }
  throw Error('Bundled sharp is unavailable. Set SOCIAL_PREVIEW_NODE_MODULES to its node_modules directory.');
}

function localImagePath(imagePath) {
  if (typeof imagePath !== 'string' || !/^\/assets\/images\/[a-z0-9/_\-.]+\.png$/i.test(imagePath) || imagePath.split('/').includes('..')) {
    throw Error('Expected a local PNG URL under /assets/images/: ' + imagePath);
  }
  const absolute = path.resolve(root, imagePath.slice(1));
  if (!absolute.startsWith(path.resolve(root, 'assets/images') + path.sep)) throw Error('Image path leaves asset directory');
  return absolute;
}

async function mapLimit(items, concurrency, worker) {
  let cursor = 0;
  const result = new Array(items.length);
  await Promise.all(Array.from({length: Math.min(concurrency, items.length)}, async () => {
    for (;;) {
      const index = cursor++;
      if (index >= items.length) break;
      result[index] = await worker(items[index], index);
    }
  }));
  return result;
}

async function fetchLocalResource(base, resource, expected) {
  const url = new URL('/' + resource.replace(/^\/+/, ''), base).href;
  try {
    const response = await fetch(url, {redirect: 'manual', signal: AbortSignal.timeout(15000)});
    const bytes = Buffer.from(await response.arrayBuffer());
    const digest = sha256(bytes), contentType = response.headers.get('content-type') || '';
    const expectedType = expected.kind === 'page' ? /^text\/html(?:;|$)/i : /^image\/png(?:;|$)/i;
    const problems = [];
    if (response.status !== 200) problems.push('Expected HTTP 200');
    if (!expectedType.test(contentType)) problems.push('Unexpected Content-Type');
    if (bytes.length !== expected.bytes || digest !== expected.sha256) problems.push('Served bytes differ from local file');
    return {resource, url, status: response.status, contentType, bytes: bytes.length, sha256: digest, passed: !problems.length, problems};
  } catch (error) {
    return {resource, url, passed: false, problems: [error.message]};
  }
}

async function verify({write = true, http = true, httpBase = 'http://127.0.0.1:8765/', concurrency = 8, authorizedSearchAttributePages = []} = {}) {
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 24) throw Error('Concurrency must be an integer from 1 to 24');
  const base = new URL(httpBase);
  if (http && (base.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname))) throw Error('HTTP verification accepts a local HTTP server only');
  const issues = [], warnings = [], newPages = [], authorizedSearchAttributeChanges = [];
  const authorizedSearchPages = new Set(authorizedSearchAttributePages);
  const add = (page, message, category = 'metadata') => issues.push({page, category, message});
  const readJson = (relative, requiredFile = true) => {
    try { return JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8')); }
    catch (error) { if (requiredFile) add(relative, error.message, 'configuration'); return null; }
  };
  const manifest = readJson('docs/seo/social-images.json');
  const baseline = readJson('docs/qa/social-preview-preservation-baseline.json');
  const before = new Map((baseline?.pages || []).map(page => [page.page, page]));
  const files = scope.pages();
  const pageNames = files.map(scope.relativePath).sort();
  const entries = manifest?.images && typeof manifest.images === 'object' && !Array.isArray(manifest.images) ? manifest.images : {};
  if (!manifest?.version || !manifest?.images || typeof manifest.images !== 'object' || Array.isArray(manifest.images)) add('docs/seo/social-images.json', 'Expected version and images object', 'configuration');
  const missingManifestPages = pageNames.filter(page => !Object.hasOwn(entries, page));
  const extraManifestPages = Object.keys(entries).filter(page => !pageNames.includes(page)).sort();
  for (const page of missingManifestPages) add(page, 'Eligible page is missing from social image manifest', 'coverage');
  for (const page of extraManifestPages) add(page, 'Manifest includes a page outside eligible public scope', 'coverage');
  for (const page of before.keys()) if (!pageNames.includes(page)) add(page, 'Preservation baseline page is missing', 'preservation');

  const records = files.map(inspect), pageReports = [], assets = new Map();
  const titles = new Map(), descriptions = new Map();
  const addAsset = (page, image, role) => {
    const entry = role === 'primary' ? image : {path: image.cardPath, sha256: image.cardSha256, bytes: image.cardBytes, width: 1200, height: 630, type: 'image/png'};
    if (!entry?.path) return;
    const prior = assets.get(entry.path);
    if (prior) {
      prior.pages.push(page);
      if (prior.sha256 !== entry.sha256 || prior.bytes !== entry.bytes || prior.width !== entry.width || prior.height !== entry.height) add(page, 'Shared image URL has conflicting manifest facts', 'asset');
    } else assets.set(entry.path, {...entry, role, pages: [page]});
  };
  for (const record of records) {
    const page = record.file, image = entries[page], old = before.get(page), start = issues.length;
    const publicPage = !record.noindex && !record.redirect;
    if (record.titles.length !== 1 || !record.title.trim()) add(page, 'Expected one nonempty title');
    if (record.canonicalTags.length !== 1 || !record.canonical) add(page, 'Expected one nonempty canonical link');
    try { if (new URL(record.canonical).protocol !== 'https:') add(page, 'Canonical must use absolute HTTPS'); } catch { add(page, 'Canonical is not an absolute URL'); }
    const tags = [...(record.head || '').matchAll(/<meta\b[^>]*>/gi)].map(match => attributes(match[0]));
    const metadata = {};
    for (const [attribute, key] of required) {
      const values = record.meta(attribute, key).map(tag => decode(tag.content || ''));
      metadata[key] = {count: values.length, values};
      const allMatches = tags.filter(tag => [tag.name, tag.property].some(value => value?.toLowerCase() === key)).length;
      if (values.length !== 1 || !values[0]?.trim() || allMatches !== 1) add(page, 'Expected one nonempty, correctly attributed ' + key + ' tag');
    }
    if (record.description.length > 165) add(page, 'Description exceeds 165 decoded characters');
    const keywords = record.keywords.split(',').map(term => term.trim()).filter(Boolean);
    const genericKeywords = keywords.filter(isGenericKeyword);
    if (publicPage && keywords.length < 4) add(page, 'Indexable page has fewer than four keyword terms');
    if (genericKeywords.length) add(page, 'Keywords contain generic navigation terms: ' + genericKeywords.join(', '));
    const expected = {
      'og:type': 'website', 'og:site_name': 'whatwhatboy', 'og:url': record.canonical,
      'og:title': record.title, 'og:description': record.description,
      'twitter:card': 'summary_large_image', 'twitter:title': record.title, 'twitter:description': record.description
    };
    if (image) {
      const url = new URL(image.path || '', origin).href;
      Object.assign(expected, {'og:image': url, 'og:image:secure_url': url, 'og:image:type': image.type,
        'og:image:width': String(image.width), 'og:image:height': String(image.height),
        'og:image:alt': image.alt, 'twitter:image': url, 'twitter:image:alt': image.alt});
      const title = record.title.replace(/\s*\|\s*whatwhatboy(?:'s)?\s*$/i, '').trim();
      if (image.title !== title) add(page, 'Manifest title differs from page title', 'manifest');
      if (typeof image.alt !== 'string' || !image.alt.trim() || typeof image.source !== 'string' || !image.source.trim()) add(page, 'Manifest needs descriptive alt and image source', 'manifest');
      addAsset(page, image, 'primary');
      if (image.cardPath) addAsset(page, image, 'card');
    }
    for (const [key, value] of Object.entries(expected)) if (metadata[key]?.values[0] !== value) add(page, key + ' differs from its expected page/manifest value');

    if (!old) newPages.push(page);
    else {
      for (const [key, actual] of Object.entries({canonical: record.canonical, noindex: record.noindex, redirect: record.redirect,
        bodySha256: record.bodySha256, normalizedBodySha256: record.normalizedBodySha256, robots: record.robots, refresh: record.refresh})) {
        if (JSON.stringify(old[key]) !== JSON.stringify(actual)) {
          if (key === 'bodySha256' && authorizedSearchPages.has(page) && old.normalizedBodySha256 === record.normalizedBodySha256) {
            authorizedSearchAttributeChanges.push({page, previousBodySha256: old.bodySha256, bodySha256: record.bodySha256,
              normalizedBodySha256: record.normalizedBodySha256, reason: 'Explicitly authorized search-attribute refresh; all other body bytes match after excluding data-search/data-library-search attributes.'});
          } else add(page, key + ' changed from immediate-before-refresh baseline', 'preservation');
        }
      }
    }

    const schemaChecks = [];
    if (record.schemaTags.length !== (publicPage ? 1 : 0)) add(page, publicPage ? 'Expected exactly one site-page-schema' : 'Noindex/redirect page has indexable site-page-schema', 'schema');
    for (const tag of record.schemaTags) {
      try {
        const schema = JSON.parse(tag[2]), graph = Array.isArray(schema['@graph']) ? schema['@graph'] : [schema];
        const webpage = graph.find(node => node['@id'] === record.canonical + '#webpage') ||
          graph.find(node => node.url === record.canonical && node['@type'] !== 'WebSite');
        const resolve = value => {
          const first = Array.isArray(value) ? value[0] : value;
          return first && typeof first === 'object' && first['@id'] ? graph.find(node => node['@id'] === first['@id']) || first : first;
        };
        if (!webpage) add(page, 'Schema has no page identifying the canonical URL', 'schema');
        else {
          if (webpage.name !== record.title || webpage.description !== record.description || webpage.keywords !== record.keywords) add(page, 'Schema title/description/keywords differ from page metadata', 'schema');
          const primary = resolve(webpage.primaryImageOfPage), pageImage = resolve(webpage.image);
          const urlOf = value => typeof value === 'string' ? value : value?.contentUrl || value?.url;
          const expectedUrl = image && new URL(image.path || '', origin).href;
          if (!primary || primary['@type'] !== 'ImageObject') add(page, 'primaryImageOfPage must resolve to ImageObject', 'schema');
          else if (image && (urlOf(primary) !== expectedUrl || primary.description !== image.alt || primary.encodingFormat !== image.type || Number(primary.width) !== image.width || Number(primary.height) !== image.height)) add(page, 'ImageObject URL/alt/type/dimensions differ from manifest', 'schema');
          if (urlOf(pageImage) !== expectedUrl) add(page, 'Schema image differs from manifest', 'schema');
          schemaChecks.push({validJson: true, canonical: webpage.url, image: urlOf(primary)});
        }
      } catch (error) { add(page, 'Invalid schema: ' + error.message, 'schema'); }
    }
    if (publicPage) for (const [map, value] of [[titles, record.title], [descriptions, record.description]]) {
      if (!map.has(value)) map.set(value, []);
      map.get(value).push(page);
    }
    pageReports.push({page, public: publicPage, title: record.title, titleLength: record.title.length,
      description: record.description, descriptionLength: record.description.length, keywords: record.keywords,
      keywordCount: keywords.length, genericKeywords, canonical: record.canonical, robots: record.robots,
      refresh: record.refresh, noindex: record.noindex, redirect: record.redirect,
      bodySha256: record.bodySha256, metadata, pageSchemaCount: record.schemaTags.length, schema: schemaChecks,
      image: image ? {path: image.path, alt: image.alt, type: image.type, width: image.width, height: image.height} : null,
      passed: issues.length === start});
  }
  const duplicates = map => [...map].filter(([, pages]) => pages.length > 1).map(([value, pages]) => {
    const intentionalFSL = pages.every(page => ['games/gta/fsl.html', 'pages/fsl.html'].includes(page));
    if (intentionalFSL) warnings.push({message: 'Intentional FSL duplicate', value, pages});
    else for (const page of pages) add(page, 'Duplicate public title/description: ' + value);
    return {value, pages, intentionalFSL};
  });
  const duplicateTitles = duplicates(titles), duplicateDescriptions = duplicates(descriptions);

  const sharp = bundledSharp();
  const imageReports = await mapLimit([...assets.values()], Math.min(concurrency, 4), async image => {
    const start = issues.length;
    try {
      const bytes = fs.readFileSync(localImagePath(image.path)), digest = sha256(bytes);
      if (bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') add(image.path, 'File does not have PNG signature', 'asset');
      const details = await sharp(bytes, {failOn: 'warning'}).metadata();
      await sharp(bytes, {failOn: 'warning'}).stats();
      if (details.format !== 'png' || image.type !== 'image/png') add(image.path, 'Expected real PNG bytes and image/png manifest MIME type', 'asset');
      if (details.width !== image.width || details.height !== image.height) add(image.path, 'Actual pixel dimensions differ from manifest', 'asset');
      const ratio = details.width / details.height;
      if (details.width < 1200 || details.height < 630 || ratio < 1.8 || ratio > 2) add(image.path, 'Preview is below 1200 x 630 or outside landscape aspect ratio 1.8 to 2.0', 'asset');
      if (image.bytes !== bytes.length || image.sha256 !== digest) add(image.path, 'Actual byte count/SHA-256 differ from manifest', 'asset');
      if (!/^[a-f0-9]{64}$/i.test(image.sha256 || '')) add(image.path, 'Manifest has no valid SHA-256', 'asset');
      return {path: image.path, role: image.role, pages: image.pages, bytes: bytes.length, sha256: digest,
        width: details.width, height: details.height, format: details.format, decoded: true, passed: issues.length === start};
    } catch (error) {
      add(image.path, error.message, 'asset');
      return {path: image.path, role: image.role, pages: image.pages, decoded: false, passed: false};
    }
  });

  const activation = readJson('docs/host-menu-companion-build.json');
  const protectedArtifacts = [];
  for (const record of activation?.records || []) for (const [field, expectedSha256, expectedBytes] of [
    ['path', record.sha256, record.bytes], ['immutablePath', record.sha256, record.bytes], ['previousPublicSnapshot', record.previousSha256, null]
  ]) {
    try {
      const artifactPath = record[field], bytes = fs.readFileSync(path.join(root, artifactPath)), digest = sha256(bytes);
      const passed = digest === expectedSha256 && (expectedBytes === null || bytes.length === expectedBytes);
      protectedArtifacts.push({platform: record.platform, field, path: artifactPath, bytes: bytes.length, sha256: digest, passed});
      if (!passed) add(artifactPath, 'Protected helper bytes differ from activation record', 'preservation');
    } catch (error) { add(record[field] || field, error.message, 'preservation'); }
  }

  let httpReports = [];
  if (http) {
    const requests = records.map(record => ({resource: record.file, kind: 'page', bytes: record.bytes, sha256: sha256(fs.readFileSync(path.join(root, record.file)))}))
      .concat(imageReports.filter(image => image.sha256).map(image => ({resource: image.path, kind: 'image', bytes: image.bytes, sha256: image.sha256})));
    httpReports = await mapLimit(requests, concurrency, async request => {
      const result = await fetchLocalResource(base, request.resource, request);
      result.kind = request.kind;
      if (!result.passed) add(request.resource, result.problems.join('; '), 'http');
      return result;
    });
  }
  const failed = new Set(issues.map(issue => issue.page));
  for (const page of pageReports) page.passed = !failed.has(page.page);
  for (const image of imageReports) image.passed = !failed.has(image.path);
  const bodyDifferences = records.filter(record => before.has(record.file) &&
    (before.get(record.file).bodySha256 !== record.bodySha256 || before.get(record.file).normalizedBodySha256 !== record.normalizedBodySha256))
    .map(record => ({page: record.file, beforeBodySha256: before.get(record.file).bodySha256, bodySha256: record.bodySha256,
      beforeNormalizedBodySha256: before.get(record.file).normalizedBodySha256, normalizedBodySha256: record.normalizedBodySha256}));
  const canonicalOrDirectiveChanges = issues.filter(issue => issue.category === 'preservation' && /^(?:canonical|noindex|redirect|robots|refresh) changed/.test(issue.message));
  const report = {
    checkedAt: new Date().toISOString(), passed: issues.length === 0,
    metadataPassed: !issues.some(issue => ['metadata', 'schema', 'manifest', 'coverage', 'configuration'].includes(issue.category)),
    assetsPassed: !issues.some(issue => issue.category === 'asset'),
    preservationPassed: !issues.some(issue => issue.category === 'preservation'),
    httpPassed: http && !issues.some(issue => issue.category === 'http'),
    policy: 'Read-only verification; no HTML, metadata, assets, baseline, helpers or inventories were changed. Only this optional report is written.',
    manifestVersion: manifest?.version, preservationBaselineCapturedAt: baseline?.capturedAt,
    summary: {pages: records.length, indexablePages: records.filter(page => !page.noindex && !page.redirect).length,
      noindexOrRedirectPages: records.filter(page => page.noindex || page.redirect).length,
      manifestPages: Object.keys(entries).length, missingManifestPages, extraManifestPages,
      existingBaselinePages: before.size, newPages: newPages.length, authorizedSearchAttributeChanges: authorizedSearchAttributeChanges.length,
      observedBodyDifferences: bodyDifferences.length, canonicalOrDirectiveChanges: canonicalOrDirectiveChanges.length,
      pagesWithCompleteRequiredTags: pageReports.filter(page => required.every(([, key]) => page.metadata[key]?.count === 1 && page.metadata[key].values[0]?.trim())).length,
      emptyDescriptions: pageReports.filter(page => !page.description.trim()).length,
      emptyKeywords: pageReports.filter(page => !page.keywordCount).length,
      thinPublicKeywords: pageReports.filter(page => page.public && page.keywordCount < 4).length,
      genericKeywordPages: pageReports.filter(page => page.genericKeywords.length).length,
      publicPagesWithSchema: pageReports.filter(page => page.public && page.pageSchemaCount === 1).length,
      primaryImagePaths: new Set(Object.values(entries).map(image => image.path)).size,
      pngFiles: imageReports.length, fullyDecodedPNGs: imageReports.filter(image => image.decoded).length,
      protectedArtifacts: protectedArtifacts.length, httpEnabled: http, httpBase: http ? base.href : null,
      httpRequests: httpReports.length, httpPassed: httpReports.filter(item => item.passed).length,
      issueCount: issues.length, warningCount: warnings.length},
    requiredMeta: required.map(([, key]) => key), issues, warnings, duplicateTitles, duplicateDescriptions,
    preservation: {baseline: 'docs/qa/social-preview-preservation-baseline.json', baselinePages: before.size,
      newPages, authorizedSearchAttributePages: [...authorizedSearchPages], authorizedSearchAttributeChanges,
      canonicalOrDirectiveChanges, bodyDifferences,
      limitation: 'A body hash mismatch proves a difference; hashes alone cannot identify its exact source or changed bytes. Concurrent site edits are not rebased or silently accepted as exact preservation.'},
    activatedHelperVersion: activation?.version, protectedArtifacts, pages: pageReports, images: imageReports, http: httpReports
  };
  if (write) fs.writeFileSync(path.join(root, 'docs/qa/site-social-preview-verification.json'), JSON.stringify(report, null, 2) + '\n');
  return report;
}

module.exports = {verify, localImagePath, mapLimit, fetchLocalResource};
if (require.main === module) {
  const args = process.argv.slice(2), value = key => args.find(arg => arg.startsWith(key + '='))?.slice(key.length + 1);
  verify({write: !args.includes('--no-write'), http: !args.includes('--no-http'),
    httpBase: value('--http-base') || 'http://127.0.0.1:8765/', concurrency: Number(value('--concurrency') || 8),
    authorizedSearchAttributePages: (value('--allow-search-attribute-changes') || '').split(',').filter(Boolean)})
    .then(report => { console.log(JSON.stringify({...report.summary, httpPassedRequests: report.summary.httpPassed,
      passed: report.passed, metadataPassed: report.metadataPassed, assetsPassed: report.assetsPassed,
      httpPassed: report.httpPassed, preservationPassed: report.preservationPassed,
      sampleIssues: report.issues.slice(0, 8)}, null, 2)); if (!report.passed) process.exitCode = 1; })
    .catch(error => { console.error(error); process.exitCode = 1; });
}
