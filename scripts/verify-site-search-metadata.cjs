// Read-only verification of site metadata, page bodies and immutable ready HTML.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const scope = require('./site-public-pages.cjs');
const root = path.resolve(__dirname, '..');
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const decode = value => String(value)
  .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'")
  .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&(?:lsquo|rsquo);/g, "'").replace(/&(?:mdash|ndash);/g, '-');
function attributes(tag) {
  return Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)]
    .map(match => [match[1].toLowerCase(), match[2] ?? match[3] ?? '']));
}
const plain = value => decode(value.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
const bodyContent = html => html.split(/<body\b/i).slice(1).join('<body');
const normalizeBody = body => body.replace(/\sdata-(?:library-)?search\s*=\s*(["'])[\s\S]*?\1/gi, '');
function inspect(file) {
  const bytes = fs.readFileSync(file), html = bytes.toString('utf8');
  const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1];
  const metaTags = [...(head || '').matchAll(/<meta\b[^>]*>/gi)].map(match => attributes(match[0]));
  const meta = (attribute, name) => metaTags.filter(tag => (tag[attribute] || '').toLowerCase() === name.toLowerCase());
  const get = (attribute, name) => decode(meta(attribute, name)[0]?.content || '');
  const titles = [...(head || '').matchAll(/<title\b[^>]*>([\s\S]*?)<\/title>/gi)].map(match => plain(match[1]));
  const canonicalTags = [...(head || '').matchAll(/<link\b[^>]*>/gi)].map(match => attributes(match[0])).filter(tag => (tag.rel || '').toLowerCase() === 'canonical');
  const schemaTags = [...(head || '').matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter(match => attributes(match[1]).id === 'site-page-schema');
  const body = bodyContent(html);
  return {file: scope.relativePath(file), bytes: bytes.length, html, head, meta, get,
    title: titles[0] || '', titles, description: get('name', 'description'), keywords: get('name', 'keywords'),
    canonical: decode(canonicalTags[0]?.href || ''), canonicalTags,
    robots: meta('name', 'robots').map(tag => tag.content || ''),
    refresh: meta('http-equiv', 'refresh').map(tag => tag.content || ''),
    noindex: /noindex/i.test(get('name', 'robots')), redirect: meta('http-equiv', 'refresh').length > 0,
    schemaTags, bodySha256: sha256(body), normalizedBodySha256: sha256(normalizeBody(body))};
}
function verify({write = true} = {}) {
  const baselineFile = path.join(root, 'docs/qa/site-search-metadata-baseline.json');
  const baseline = JSON.parse(fs.readFileSync(baselineFile, 'utf8'));
  const before = new Map(baseline.pages.map(page => [page.page, page]));
  const records = scope.pages().map(inspect);
  const issues = [], warnings = [], pageReports = [], titlePages = new Map();
  const bodyChanges = [], authorizedSearchChanges = [], rawBodyChanges = [], defaultRobotsAdditions = [];
  const protectedReports = [], newPages = [];
  const add = (page, message, category = 'metadata') => issues.push({page, message, category});
  const requiredMeta = [
    ['name', 'description'], ['name', 'keywords'],
    ['property', 'og:type'], ['property', 'og:site_name'], ['property', 'og:locale'],
    ['property', 'og:url'], ['property', 'og:title'], ['property', 'og:description'],
    ['property', 'og:image'], ['property', 'og:image:alt'],
    ['name', 'twitter:card'], ['name', 'twitter:title'], ['name', 'twitter:description'],
    ['name', 'twitter:image'], ['name', 'twitter:image:alt']
  ];
  for (const record of records) {
    const page = record.file, old = before.get(page), initialIssues = issues.length;
    if (record.head === undefined) add(page, 'Missing head element');
    if (record.titles.length !== 1 || !record.title) add(page, `Expected one nonempty title; found ${record.titles.length}`);
    if (record.canonicalTags.length !== 1 || !record.canonical) add(page, `Expected one nonempty canonical link; found ${record.canonicalTags.length}`);
    if (record.description.length > 165) add(page, `Description has ${record.description.length} decoded characters`);
    for (const [attribute, key] of requiredMeta) {
      const matches = record.meta(attribute, key);
      if (matches.length !== 1 || !decode(matches[0]?.content || '').trim()) add(page, `Expected one nonempty ${key} tag; found ${matches.length}`);
    }
    if (record.get('property', 'og:url') !== record.canonical) add(page, 'Open Graph URL differs from canonical');
    if (record.get('property', 'og:title') !== record.title || record.get('name', 'twitter:title') !== record.title) add(page, 'Social title differs from page title');
    if (record.get('property', 'og:description') !== record.description || record.get('name', 'twitter:description') !== record.description) add(page, 'Social description differs from meta description');
    if (record.get('property', 'og:image') !== record.get('name', 'twitter:image')) add(page, 'Open Graph and Twitter images differ');
    const publicPage = !record.noindex && !record.redirect;
    if (publicPage) {
      if (record.schemaTags.length !== 1) add(page, `Expected one site-page-schema on public page; found ${record.schemaTags.length}`);
      if (!titlePages.has(record.title)) titlePages.set(record.title, []);
      titlePages.get(record.title).push(page);
    } else if (record.schemaTags.length) add(page, 'Noindex/redirect page has public site-page-schema');
    for (const tag of record.schemaTags) {
      try {
        const schema = JSON.parse(tag[2]);
        const candidates = Array.isArray(schema['@graph']) ? schema['@graph'] : [schema];
        if (!candidates.some(item => item.url === record.canonical)) add(page, 'Page schema does not identify canonical URL');
      } catch (error) { add(page, 'Invalid page schema JSON: ' + error.message); }
    }
    if (old) {
      if (old.canonical && old.canonical !== record.canonical) add(page, 'Canonical changed from baseline', 'preservation');
      if (old.noindex !== record.noindex) add(page, 'Indexability changed from baseline', 'preservation');
      if (old.redirect !== record.redirect) add(page, 'Meta-refresh redirect status changed from baseline', 'preservation');
      if (old.robotsValues && JSON.stringify(old.robotsValues) !== JSON.stringify(record.robots)) {
        const explicitDefault = old.robotsValues.length === 0 && record.robots.length === 1 && /^\s*index\s*,\s*follow\s*$/i.test(record.robots[0]);
        if (explicitDefault) defaultRobotsAdditions.push(page);
        else add(page, 'Robots directives changed from baseline', 'preservation');
      }
      if (old.refreshValues && JSON.stringify(old.refreshValues) !== JSON.stringify(record.refresh)) add(page, 'Meta-refresh destination changed from baseline', 'preservation');
      if (old.bodySha256 !== record.bodySha256) rawBodyChanges.push(page);
      if (old.normalizedBodySha256) {
        if (old.normalizedBodySha256 !== record.normalizedBodySha256) {
          bodyChanges.push(page);
          add(page, 'Body content differs after excluding authorized search attributes', 'preservation');
        } else if (old.bodySha256 !== record.bodySha256) authorizedSearchChanges.push(page);
      } else if (old.bodySha256 !== record.bodySha256) {
        bodyChanges.push(page);
        warnings.push({page, message: 'No normalized baseline available for raw body change'});
      }
    } else newPages.push(page);
    pageReports.push({page, title: record.title, description: record.description, keywords: record.keywords,
      canonical: record.canonical, noindex: record.noindex, redirect: record.redirect,
      sitePageSchemaCount: record.schemaTags.length, passed: issues.length === initialIssues});
  }
  for (const [title, pages] of titlePages) if (pages.length > 1) {
    if (pages.every(page => page === 'games/gta/fsl.html' || page === 'pages/fsl.html')) warnings.push({message: 'Intentional duplicate FSL title', title, pages});
    else for (const page of pages) add(page, 'Duplicate public title: ' + title);
  }
  const present = new Set(records.map(record => record.file));
  const missingBaselinePages = baseline.pages.filter(page => !page.protected && scope.eligible(page.page) && !present.has(page.page)).map(page => page.page);
  for (const page of missingBaselinePages) add(page, 'Page from baseline is missing', 'preservation');
  for (const expected of [...(baseline.protectedArtifacts || []), ...(baseline.downloadHtmlArtifacts || [])]) {
    const file = path.join(root, expected.page);
    if (!fs.existsSync(file)) { add(expected.page, 'Protected HTML artifact is missing', 'preservation'); protectedReports.push({...expected, passed: false, exists: false}); continue; }
    const bytes = fs.readFileSync(file), actualSha = sha256(bytes);
    const passed = bytes.length === expected.bytes && actualSha === expected.sha256;
    protectedReports.push({page: expected.page, bytes: bytes.length, sha256: actualSha, passed});
    if (!passed) add(expected.page, 'Protected HTML artifact bytes changed', 'preservation');
  }
  const failedPages = new Set(issues.map(issue => issue.page));
  for (const page of pageReports) page.passed = !failedPages.has(page.page);
  const report = {checkedAt: new Date().toISOString(), passed: issues.length === 0,
    metadataPassed: !issues.some(issue => issue.category === 'metadata'),
    preservationPassed: !issues.some(issue => issue.category === 'preservation'),
    pages: records.length, indexablePages: records.filter(record => !record.noindex && !record.redirect).length,
    noindexPages: records.filter(record => record.noindex).length, redirectPages: records.filter(record => record.redirect).length,
    metadataChecks: {requiredMetaTags: requiredMeta.map(([, key]) => key), descriptionMaxDecodedCharacters: 165,
      uniquePublicTitlesExceptFSL: true, canonicalAndSocialConsistency: true},
    preservation: {normalizedBodyPolicy: baseline.normalizedBodyPolicy || 'Only data-search and data-library-search attributes ignored',
      normalizedBaselineCapturedAt: baseline.normalizedCaptureAt || null,
      bodyChanges, rawBodyChanges, authorizedSearchAttributeChanges: authorizedSearchChanges,
      changesAlreadyPresentBeforeRefresh: baseline.bodyChangedBeforeSearchRefresh || [], defaultRobotsAdditions,
      newPages, supplementalBaselinePages: baseline.supplementalPages || [], missingBaselinePages,
      protectedArtifacts: protectedReports}, issues, warnings, pageReports};
  if (write) fs.writeFileSync(path.join(root, 'docs/qa/site-search-metadata-verification.json'), JSON.stringify(report, null, 2) + '\n');
  return report;
}
module.exports = {decode, attributes, plain, bodyContent, normalizeBody, inspect, verify};
if (require.main === module) {
  const result = verify();
  console.log(JSON.stringify({passed: result.passed, metadataPassed: result.metadataPassed,
    preservationPassed: result.preservationPassed, pages: result.pages, indexablePages: result.indexablePages,
    issueCount: result.issues.length, affectedPages: [...new Set(result.issues.map(issue => issue.page))],
    sampleIssues: result.issues.slice(0, 8), warnings: result.warnings, newPages: result.preservation.newPages,
    bodyChanges: result.preservation.bodyChanges, authorizedSearchAttributeChanges: result.preservation.authorizedSearchAttributeChanges.length,
    protectedArtifacts: result.preservation.protectedArtifacts}, null, 2));
  if (!result.passed) process.exitCode = 1;
}
