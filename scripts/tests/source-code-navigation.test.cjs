const test = require('node:test');
const assert = require('node:assert/strict');
const navigation = require('../source-code-navigation.cjs');
const legacy = '<li class="nav-group open" data-nav-section="source-codes"><button class="nav-link nav-group-toggle">Source Codes</button><ul class="nav-sublist"><li><a href="/source-codes/index.html">Games</a></li></ul></li>';
const tools = '<li><a href="/tools/index.html" class="nav-link" data-tooltip="Tools">Tools</a></li>';
const shell = content => '<nav class="sidebar-nav"><ul>' + content + '</ul></nav><main>Source content</main>';

test('old source group is replaced once while surrounding navigation and content stay intact', () => {
  const before = shell('<li>Before</li>' + legacy + '<li>After</li>' + tools);
  const after = navigation.apply('index.html', before);
  assert.ok(after.includes('<li>Before</li>' + navigation.group('index.html') + '<li>After</li>' + tools));
  assert.ok(after.endsWith('<main>Source content</main>'));
  assert.equal((after.match(/data-nav-section="source-codes"/g) || []).length, 1);
  assert.doesNotMatch(after, />Games<\/a>/);
  assert.equal(navigation.apply('index.html', after), after);
});

test('source group inserts before Tools and preserves a page with no sidebar', () => {
  const before = shell(tools);
  const after = navigation.apply('pc/tools.html', before);
  assert.ok(after.includes(navigation.group('pc/tools.html') + '\n                ' + tools));
  assert.equal(navigation.apply('pc/tools.html', '<nav>Other navigation</nav>'), '<nav>Other navigation</nav>');
});

test('category active states distinguish category roots and child pages including historic game URLs', () => {
  const cases = [
    ['source-codes/index.html', 'overview', 'page'],
    ['source-codes/console/index.html', 'console', 'page'],
    ['source-codes/console/ps4/gta5/index.html', 'console', 'location'],
    ['source-codes/games/gta5/ps4.html', 'console', 'location'],
    ['source-codes/games/gta5/index.html', 'overview', 'location'],
    ['source-codes/pc/gta5/index.html', 'pc', 'location'],
    ['source-codes/other/index.html', 'other', 'page']
  ];
  for (const [file, key, current] of cases) {
    const output = navigation.group(file);
    const entry = navigation.entries.find(entry => entry.key === key);
    assert.ok(output.includes('class="nav-group open"'));
    assert.ok(output.includes('aria-expanded="true"'));
    assert.match(output, new RegExp('href="' + entry.href + '" class="nav-link nav-sublink active"[^>]*aria-current="' + current + '"'));
    assert.equal((output.match(/aria-current=/g) || []).length, 1);
  }
  assert.doesNotMatch(navigation.group('console/ps4/index.html'), /aria-current=|class="nav-group open"/);
});

test('downloaded HTML, receiver helpers and private research files keep their exact bytes', () => {
  const before = shell(legacy + tools);
  for (const file of ['downloads/archive/source.html', 'console/ps4/whatsite-ps4.html', 'console/ps5/whatsite-ps5.html', 'hosts/runtime/ps4-900/index.html', 'tmp/source.html', 'docs/source.html']) {
    assert.equal(navigation.apply(file, before), before, file);
  }
  assert.equal(navigation.apply('console/ps4/tool.html', '<script id="receiver-catalog"></script>' + before), '<script id="receiver-catalog"></script>' + before);
});

test('shared icon regeneration keeps the new category group idempotent', () => {
  const {decorateNavLinks} = require('../sidebar-icons.cjs');
  const output = decorateNavLinks(legacy + tools, {file: 'source-codes/pc/index.html'});
  assert.ok(output.includes('<span>Other Projects</span>'));
  assert.equal((output.match(/data-nav-section="source-codes"/g) || []).length, 1);
  assert.equal(navigation.integrateSourceCodes(output, 'source-codes/pc/index.html'), output);
  assert.equal(decorateNavLinks(output, {file: 'source-codes/pc/index.html'}), output);
});
