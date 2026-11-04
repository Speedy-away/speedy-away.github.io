const test = require('node:test');
const assert = require('node:assert/strict');
const {improveHub} = require('../console-hubs.cjs');

function fixture(platform) {
  const card = (title, href) => '<article class="guide-resource"><img src="/assets/images/logo.png" alt="' + title + '"><h3>' + title + '</h3><p>Keep the original compatibility description.</p><div class="guide-links"><a href="' + href + '">Open ' + title + '</a></div></article>';
  const setup = ['jailbreaks', 'goldhen', 'y2jb'].map(name => card(name, '/console/' + platform + '/' + name + '.html'));
  const library = [card('Payloads', '/console/' + platform + '/payloads.html'), card('Game mods', platform === 'ps4' ? '/console/mods/ps4/' : '/console/ps5/mods.html')];
  return '<html><head></head><body class="console-guide site-atmosphere" data-background-theme="cobalt"><aside><header>Sidebar header</header><nav>Sidebar navigation</nav></aside><main class="main-content"><header class="guide-hero"><div class="container guide-hero-grid guide-hero-text"><div><h1>Original heading</h1><p>Original description</p><a href="/pc/">PC</a></div></div></header><div class="container"><nav class="guide-nav"><a href="/console/">Original navigation</a></nav></div><div id="content"><section id="exploit-hosts"><a href="https://example.test/host">Host</a></section><section class="section" id="start"><div class="container"><div class="section-header"><h2>Original resources</h2></div><div class="games-grid">' + [...setup, ...library].join('') + '</div></div></section><section id="console-downloads"><a href="/downloads/original.pkg" download>Original download</a></section><section id="save-tools"><p>Original save tools</p></section></div><footer>Original footer</footer></main></body></html>';
}

test('hub grouping preserves original cards, compatibility text, navigation and downloads', () => {
  for (const platform of ['ps4', 'ps5']) {
    const original = fixture(platform), html = improveHub('console/' + platform + '/index.html', original);
    for (const value of [...original.matchAll(/href="([^"]+)"/g)].map(match => match[1])) assert.ok(html.includes('href="' + value + '"'), value);
    assert.equal((html.match(/<article\b/g) || []).length, 5);
    assert.equal((html.match(/Keep the original compatibility description\./g) || []).length, 5);
    assert.ok(html.indexOf('id="start"') < html.indexOf('id="exploit-hosts"'));
    assert.ok(html.includes('id="save-tools"'));
    assert.ok(html.includes('class="console-guide site-atmosphere console-hub'));
    assert.ok(html.includes('data-background-theme="cobalt"'));
    assert.ok(html.includes('Original footer'));
    const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/)[1];
    assert.equal((html.match(/class="container console-hub-shortcuts"/g) || []).length, 1);
    assert.ok(main.indexOf('console-hub-shortcuts') > main.indexOf('class="guide-nav"'));
    assert.ok(main.indexOf('console-hub-shortcuts') < main.indexOf('id="content"'));
    assert.equal(improveHub('console/' + platform + '/index.html', html), html);
  }
});

test('earlier hub layout migrates its sidebar shortcut into main without regrouping cards', () => {
  const current = improveHub('console/ps5/index.html', fixture('ps5'));
  const quick = current.match(/<nav class="container console-hub-shortcuts"[\s\S]*?<\/nav>/)[0];
  const misplaced = current.replace(quick, '').replace('</header>', '</header>' + quick).replace('data-console-hub-layout="3"', 'data-console-hub-layout="2"');
  const migrated = improveHub('console/ps5/index.html', misplaced);
  assert.ok(migrated.indexOf('console-hub-shortcuts') > migrated.indexOf('class="guide-nav"'));
  assert.equal((migrated.match(/<article\b/g) || []).length, 5);
  assert.equal((migrated.match(/id="console-hub-setup"/g) || []).length, 1);
  assert.equal(improveHub('console/ps5/index.html', migrated), migrated);
});

test('hub presentation does not modify other console pages or immutable helpers', () => {
  for (const file of ['console/ps5/apps.html', 'console/ps4/whatsite-ps4.html', 'console/ps5/whatsite-ps5.html', 'console/ps3/index.html', 'hosts/ps4/index.html']) assert.equal(improveHub(file, fixture('ps4')), fixture('ps4'));
});
