'use strict';

// Presentation for authored launch pages only. The preserved native modules and
// their input/output elements are kept at their original URLs and identities.
const build = require('../docs/ps5-webkit-build.json');
const ART = '/assets/images/host-selector/whatwhatboy-ps5.jpg';
const ENTRY = 'hosts/runtime/ps5-webkit-dd8e4e0914c5/index.html';
const RUN = 'hosts/runtime/ps5-webkit-dd8e4e0914c5/web/index.html';
const VERSION = '20261108webkit1';
const esc = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');

function addAssets(html, base = '', script = true) {
  if (html.includes('host-ps5-webkit.css')) return html;
  return html.replace(/<body\b([^>]*)>/i, (_, attrs) =>
    '<body' + (/\bclass="/.test(attrs) ? attrs.replace(/\bclass="([^"]*)"/, 'class="$1 wwb-ps5-webkit"') : attrs + ' class="wwb-ps5-webkit"') + '>')
    .replace(/<\/head>/i, '<link rel="stylesheet" href="' + base + '/assets/host-ps5-webkit.css?v=' + VERSION + '">' +
      (script ? '<script defer src="' + base + '/assets/host-ps5-webkit-ui.js?v=' + VERSION + '"></script>' : '') + '</head>');
}

function nav(base, run = false) {
  return '<nav class="ps5-deck-nav" aria-label="Host navigation"><a href="' + base + '/">WWB HOST</a>' +
    '<a href="' + base + '/hosts/ps5/">PS5 host</a>' +
    (run ? '<a href="' + base + '/ps5/relapse/">WebKit entry</a>' : '') +
    '<a href="' + base + '/offline/ps5/">Offline cache</a></nav>';
}

function heading(title, subtitle, kicker = 'PLAYSTATION 5 / WEBKIT') {
  return '<header class="ps5-deck-copy"><p class="ps5-deck-kicker">' + esc(kicker) + '</p><h1>' + esc(title) +
    '</h1><p class="ps5-deck-subtitle">' + esc(subtitle) + '</p></header>';
}

function deck({ title, subtitle, status, controls, references, base = '' }) {
  const visual = '<figure class="ps5-deck-art"><img width="1672" height="941" src="' + base + ART +
    '" alt="PlayStation 5 console with DualSense controller"></figure>';
  const firmware = '<dl class="ps5-deck-firmware"><dt>Detected firmware</dt><dd data-ps5-deck-firmware>Checking browser…</dd></dl>';
  return '<main class="ps5-deck"><div class="ps5-deck-content">' + visual +
    '<div class="ps5-deck-controls">' + heading(title, subtitle) + '<section class="ps5-deck-panel" aria-label="Console readiness">' +
    firmware + status + controls + '</section></div></div>' +
    '<section class="ps5-deck-output ps5-deck-panel" aria-labelledby="ps5-deck-log-heading"><h2 id="ps5-deck-log-heading">Session log</h2>' +
      '<pre class="ps5-deck-log" id="ps5-deck-log" role="log" aria-live="off" tabindex="0"></pre></section>' +
    '<div class="ps5-deck-references">' + references + '</div></main>';
}

function details(firmwares) {
  return '<details><summary>Exact firmware, recovery and credits</summary><p>Supported firmware: ' +
    firmwares.map(esc).join(', ') + '.</p><p>If the chain stalls or the console restarts, check the console and reopen this page before trying again.</p>' +
    '<p><a href="' + esc(build.source.repository + '/tree/' + build.source.commit) + '">Original Relapse source and credits</a>. MIT licence.</p></details>';
}

function short(firmware = '') {
  if (firmware && !build.firmwares.includes(firmware)) throw Error('PS5 firmware is not pinned by this runtime.');
  const firmwares = firmware ? [firmware] : [...build.firmwares].reverse();
  const title = firmware ? 'PS5 WebKit ' + firmware : 'PS5 WebKit';
  const subtitle = firmware ? 'Relapse loader for PS5 firmware ' + firmware + '.' : 'Relapse loader for supported PS5 firmware from 7.00 to 13.60.';
  const action = { platform: 'ps5', firmwares, nativeRoute: { kind: 'ps5-native', target: build.runEntry } };
  const status = '<p id="ps5-launch-status" role="status">Checking this browser…</p><noscript>Enable JavaScript to check this console.</noscript>';
  const controls = '<button type="button" id="ps5-launch-start" disabled>Load WebKit</button>';
  return addAssets('<!doctype html>\n<html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex, follow">' +
    '<title>' + title + ' | WWB HOST</title><script defer src="/assets/host-site-load.js"></script></head><body>' + nav('') +
    deck({title, subtitle, status, controls, references:details(firmwares)}) +
    '<script id="ps5-launch-data" type="application/json">' +
    JSON.stringify(action).replaceAll('<', '\\u003c') + '</script></body></html>\n');
}

function apply(html, name, {base = ''} = {}) {
  if (html.includes('host-ps5-webkit.css')) return html;
  if (name === RUN && html.includes('id="runtime-config"') && html.includes('id="console"')) {
    const output = '<main class="ps5-deck">' + heading('PS5 WebKit', 'Follow the native loader’s output here.', 'PLAYSTATION 5 / NATIVE LOG') +
      '<section class="ps5-deck-panel" aria-labelledby="ps5-native-log-title"><h2 id="ps5-native-log-title">Live loader log</h2>$1' +
      '<div id="console" role="log" aria-labelledby="ps5-native-log-title" aria-live="off" tabindex="0"></div></section></main>';
    const body = html.replace(/<nav(?:\s[^>]*)?>[\s\S]*?<\/nav>/i, nav(base, true))
      .replace(/(<p id="runtime-status"[^>]*>[\s\S]*?<\/p>)\s*<div id="console"><\/div>/i, output);
    // No extra script runs in the native document.
    return addAssets(body, base, false);
  }

  if (name === ENTRY && html.includes('id="runtime-start"')) {
    const status = html.match(/<p id="runtime-status"[^>]*>[\s\S]*?<\/p>/)?.[0];
    const controls = html.match(/<button[^>]+id="runtime-start"[^>]*>[\s\S]*?<\/button>/)?.[0];
    const references = html.match(/<div class="details">([\s\S]*?)<\/div>/)?.[1];
    if (!status || !controls || !references) return html;
    const content = deck({title:'PS5 WebKit', subtitle:'Relapse loader for supported PS5 firmware from 7.00 to 13.60.', status,
      controls:controls.replace('>Load exploit<', '>Start WebKit<'),
      references:'<details><summary>Exact firmware, recovery and credits</summary>' + references + '</details>', base});
    return addAssets(html.replace(/<nav(?:\s[^>]*)?>[\s\S]*?<\/nav>/i, nav(base))
      .replace(/<main>[\s\S]*?<\/main>/i, content), base);
  }

  if (!/^hosts\/ps5\/exploit\/[a-z0-9-]+\/index\.html$/.test(name) || !html.includes('id="host-local-data"')) return html;
  const main = html.match(/<main><header><h1>([^<]+)<\/h1>([\s\S]*?)<\/header>([\s\S]*?)<\/main>/i);
  if (!main) return html;
  const status = main[3].match(/<p id="host-local-status"[^>]*>[\s\S]*?<\/p>/)?.[0];
  if (!status) return html;
  const controls = main[3].replace(status, '');
  const content = deck({title:main[1], subtitle:'Check the exact installed firmware before opening the local loader.',
    status, controls, references:'<details><summary>Supported firmware</summary>' + main[2] + '</details>', base});
  return addAssets(html.replace('class="host-taskbar"', 'class="host-taskbar ps5-deck-nav"').replace(main[0], content), base);
}

module.exports = {apply, short};
