const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {transform} = require('../page-search-metadata.cjs');
const {attributes, decode, bodyContent} = require('../verify-site-search-metadata.cjs');

const page = 'console/social-preview-fixture.html';
const canonical = 'https://whatwhatboy.com/console/preserved-preview-canonical.html';
const preview = {
  path: '/assets/images/social/pages/fixture-preview.png',
  alt: 'Original console artwork with a blue controller, "PS Vita" & <tools> text.',
  width: 1200,
  height: 630,
  type: 'image/png',
  title: 'PS Vita preview fixture',
  source: 'original-vector-render',
  sha256: '0'.repeat(64)
};
const manifest = {version: 'test-fixture', images: {[page]: preview}};
const options = {socialImages: manifest, modMetadata: null, overrides: {}};
const fixture = '<!doctype html><html><head><title>PS Vita preview fixture</title>' +
  '<meta name="description" content="Read PS Vita setup notes and the named tools.">' +
  '<link rel="canonical" href="' + canonical + '">' +
  '<meta name="robots" content="index, follow, max-image-preview:large">' +
  '<meta property="og:image" content="https://whatwhatboy.com/old-logo.svg">' +
  '<meta property="og:image:width" content="32"><meta property="og:image:width" content="64">' +
  '<meta property="og:image:height" content="32"><meta property="og:image:type" content="image/svg+xml">' +
  '<meta property="og:image:secure_url" content="https://whatwhatboy.com/old-logo.svg">' +
  '<meta name="twitter:image" content="https://whatwhatboy.com/old-logo.svg">' +
  '</head><body><main><h1>PS Vita setup notes</h1><h2>VitaShell and Apollo</h2>' +
  '<a href="/downloads/pinned-v1.vpk" download>Retain pinned download</a></main></body></html>';

function metaValues(html, key) {
  const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1] || '';
  return [...head.matchAll(/<meta\b[^>]*>/gi)]
    .map(match => attributes(match[0]))
    .filter(tag => (tag.property || tag.name || '').toLowerCase() === key.toLowerCase())
    .map(tag => decode(tag.content || ''));
}

function schemaPage(html) {
  const tag = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .find(match => attributes(match[1]).id === 'site-page-schema');
  assert.ok(tag, 'one public-page schema is present');
  const schema = JSON.parse(tag[2]);
  const graph = schema['@graph'] || [schema];
  const webpage = graph.find(item => item.url === canonical);
  assert.ok(webpage, 'page schema keeps the canonical URL');
  const resolve = value => {
    const item = Array.isArray(value) ? value[0] : value;
    if (item && typeof item === 'object' && item['@id']) return graph.find(node => node['@id'] === item['@id']) || item;
    return item;
  };
  return {webpage, resolve};
}

test('configured raster previews replace stale image metadata consistently and idempotently', () => {
  const result = transform(page, fixture, options);
  const url = 'https://whatwhatboy.com' + preview.path;
  const expected = {
    'og:image': url,
    'og:image:secure_url': url,
    'og:image:type': preview.type,
    'og:image:width': String(preview.width),
    'og:image:height': String(preview.height),
    'og:image:alt': preview.alt,
    'twitter:card': 'summary_large_image',
    'twitter:image': url,
    'twitter:image:alt': preview.alt
  };
  for (const [key, value] of Object.entries(expected)) assert.deepEqual(metaValues(result.html, key), [value], key);
  assert.equal(bodyContent(result.html), bodyContent(fixture));
  assert.equal(result.metadata.canonical, canonical);
  assert.deepEqual(metaValues(result.html, 'robots'), ['index, follow, max-image-preview:large']);
  assert.ok(result.html.includes('href="/downloads/pinned-v1.vpk" download'));
  assert.equal(result.metadata.image, url);
  assert.equal(transform(page, result.html, options).html, result.html);
});

test('page schema uses the exact social image, description, MIME type and pixel dimensions', () => {
  const result = transform(page, fixture, options);
  const {webpage, resolve} = schemaPage(result.html);
  const image = resolve(webpage.primaryImageOfPage);
  assert.ok(image && typeof image === 'object', 'primaryImageOfPage resolves to ImageObject');
  assert.equal(image['@type'], 'ImageObject');
  assert.equal(image.contentUrl || image.url, 'https://whatwhatboy.com' + preview.path);
  assert.equal(image.description, preview.alt);
  assert.equal(image.encodingFormat, preview.type);
  assert.equal(Number(image.width), preview.width);
  assert.equal(Number(image.height), preview.height);
  const pageImage = resolve(webpage.image);
  assert.equal(typeof pageImage === 'string' ? pageImage : pageImage?.contentUrl || pageImage?.url,
    image.contentUrl || image.url, 'WebPage.image and primaryImageOfPage agree');
  assert.equal((result.html.match(/id="site-page-schema"/g) || []).length, 1);
});

test('noindex and redirect previews retain their directives and suppress indexable schema', () => {
  for (const extra of [
    '<meta name="robots" content="noindex, nofollow, max-image-preview:none">',
    '<meta http-equiv="refresh" content="0; url=https://whatwhatboy.com/console/psvita/home.html">'
  ]) {
    const before = fixture.replace('<meta name="robots" content="index, follow, max-image-preview:large">', extra);
    const result = transform(page, before, options);
    assert.equal(bodyContent(result.html), bodyContent(before));
    assert.ok(result.html.includes(extra), 'original robots/refresh directive is retained');
    assert.ok(result.html.includes('<link rel="canonical" href="' + canonical + '">'));
    assert.ok(!result.html.includes('id="site-page-schema"'));
    assert.deepEqual(metaValues(result.html, 'og:image'), ['https://whatwhatboy.com' + preview.path]);
    assert.deepEqual(metaValues(result.html, 'twitter:image:alt'), [preview.alt]);
    assert.equal(transform(page, result.html, options).html, result.html);
  }
});

test('receiver and downloaded HTML remain byte-identical even when a preview is configured', () => {
  for (const protectedPage of [
    'console/ps4/whatsite-ps4.html',
    'console/ps5/whatsite-ps5.html',
    'downloads/helpers/console-payload-sender/index.html',
    'hosts/runtime/ps4-900/upstream/index.html',
    'tmp/render.html'
  ]) {
    const result = transform(protectedPage, fixture, {...options,
      socialImages: {version: 'test-fixture', images: {[protectedPage]: preview}}});
    assert.equal(result.html, fixture, protectedPage);
    assert.equal(result.skipped, true, protectedPage);
  }
});

test('default engine configuration selects the generated manifest without a special caller option', () => {
  const root = path.resolve(__dirname, '../..');
  const generated = JSON.parse(fs.readFileSync(path.join(root, 'docs/seo/social-images.json'), 'utf8'));
  const actualPage = 'console/psvita/home.html';
  const configured = generated.images[actualPage];
  assert.ok(configured, 'generated manifest contains a real platform landing page');
  const result = transform(actualPage, fixture, {modMetadata: null, overrides: {}});
  assert.deepEqual(metaValues(result.html, 'og:image'), ['https://whatwhatboy.com' + configured.path]);
  assert.deepEqual(metaValues(result.html, 'og:image:width'), [String(configured.width)]);
  assert.deepEqual(metaValues(result.html, 'og:image:height'), [String(configured.height)]);
  assert.deepEqual(metaValues(result.html, 'twitter:image:alt'), [configured.alt]);
});
