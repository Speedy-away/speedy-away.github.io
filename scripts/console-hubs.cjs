'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

// Presentation only: keep the hub's current cards, downloads and source links.
function improveHub(file, html) {
  const match = /^console\/(ps[45])\/index\.html$/.exec(file);
  if (!match || html.includes('data-console-hub-layout="3"')) return html;
  const platform = match[1], name = platform.toUpperCase();
  const existingLayout = html.includes('data-console-hub-layout="2"');
  if (existingLayout) html = html.replace('data-console-hub-layout="2"', 'data-console-hub-layout="3"');
  else html = html.replace(/<body\b([^>]*?)class="([^"]*)"/, '<body$1class="$2 console-hub console-hub--' + platform + '" data-console-hub-layout="3"');
  html = html.replace(/<link\b[^>]*href="\/assets\/console-hubs\.css[^"\s]*"[^>]*>\s*/g, '');
  html = html.replace('</head>', '<link rel="stylesheet" href="/assets/console-hubs.css?v=3">\n</head>');
  if (!existingLayout) {
  html = html.replace(/<header class="guide-hero">[\s\S]*?<\/header>/, hero => {
    hero = hero.replace(/guide-hero-grid(?: guide-hero-text)?/, 'guide-hero-grid console-hub-hero-grid');
    hero = hero.replace(/<img\b[^>]*>/g, '');
    const artwork = '<figure class="console-hub-art"><img src="/assets/images/host-selector/whatwhatboy-' + platform + '.jpg" width="1672" height="941" alt="' + name + ' console and controller" fetchpriority="high" decoding="async"><figcaption>' + name + ' · Homebrew, games &amp; tools</figcaption></figure>';
    hero = hero.replace('</div></header>', artwork + '</div></header>');
    return hero;
  });
  }
  const shortcuts = [
    ['#console-hub-setup', 'Set up your console', 'Firmware & jailbreak'],
    [platform === 'ps4' ? '/console/mods/ps4/' : '/console/ps5/mods.html', 'Find game mods', 'Menus, cheats & patches'],
    ['/console/' + platform + '/apps.html', 'Explore apps', 'Stores & homebrew'],
    ['/console/' + platform + '/downloads.html', 'Download files', 'Console, computer or phone']
  ];
  const quick = '<nav class="container console-hub-shortcuts" aria-label="' + name + ' quick destinations">' + shortcuts.map(([url, label, detail], index) => '<a href="' + url + '"><span class="console-hub-shortcut-number" aria-hidden="true">0' + (index + 1) + '</span><span><strong>' + label + '</strong><small>' + detail + '</small></span><i class="fas fa-arrow-right" aria-hidden="true"></i></a>').join('') + '</nav>';
  // The shared sidebar also contains a header. Locate the hub navigation inside
  // main explicitly, including when migrating the earlier misplaced shortcut.
  html = html.replace(/<nav\b[^>]*class="[^"]*\bconsole-hub-shortcuts\b[^"]*"[^>]*>[\s\S]*?<\/nav>/g, '');
  html = html.replace(/(<main\b[^>]*>)([\s\S]*?)(<\/main>)/, (all, open, content, close) => {
    const navigation = /(<nav\b[^>]*class="[^"]*\bguide-nav\b[^"]*"[^>]*>[\s\S]*?<\/nav>)(\s*<\/div>)?/;
    return open + content.replace(navigation, (nav, element, wrapper = '') => element + wrapper + quick) + close;
  });

  const start = html.match(/<section\b[^>]*id="start"[^>]*>[\s\S]*?<\/section>/)?.[0];
  if (start && !existingLayout) {
    const cards = [...start.matchAll(/<article\b[\s\S]*?<\/article>/g)].map(value => value[0]);
    const setup = [], library = [];
    for (let card of cards) {
      if (/href="\/console\/ps[45]\/(?:jailbreaks|goldhen|y2jb)\.html/.test(card)) setup.push(card);
      else {
        if (platform === 'ps4' && /href="\/console\/mods\/ps4\//.test(card)) {
          card = card.replace(/<img\b[^>]*>/, require('./console-card-media.cjs').cardMedia(require('./console-card-media.cjs').ps5Media.mods));
        }
        library.push(card);
      }
    }
    // Put game collections first without dropping or changing any resource.
    library.sort((a, b) => Number(/href="\/console\/(?:mods\/ps4\/|ps5\/mods\.html)/.test(b)) - Number(/href="\/console\/(?:mods\/ps4\/|ps5\/mods\.html)/.test(a)));
    if (cards.length && setup.length && library.length) {
      const grouped = '<div class="console-hub-group"><p class="console-hub-group-label">Game mods, apps &amp; tools</p><div class="games-grid console-hub-library">' + library.join('\n') + '</div></div><div class="console-hub-group console-hub-setup" id="console-hub-setup"><div class="console-hub-group-heading"><p class="console-hub-group-label">Set up your ' + name + '</p><span>Check your installed firmware before choosing a route.</span></div><div class="games-grid console-hub-setup-grid">' + setup.join('\n') + '</div></div>';
      const improved = start.replace(/<div class="games-grid">[\s\S]*<\/div>(?=<\/div><\/section>$)/, grouped);
      html = html.replace(start, improved);
      // The useful destinations come before the full external-host directory.
      html = html.replace(improved, '').replace('<div id="content">', '<div id="content">' + improved);
    }
  }
  return html;
}

function refreshHubs() {
  for (const platform of ['ps4', 'ps5']) {
    const file = 'console/' + platform + '/index.html';
    const target = path.join(root, file), html = fs.readFileSync(target, 'utf8');
    const improved = improveHub(file, html);
    if (improved !== html) fs.writeFileSync(target, improved);
  }
}
if (require.main === module) refreshHubs();
module.exports = {improveHub, refreshHubs};
