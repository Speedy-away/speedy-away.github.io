const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {createRequire} = require('node:module');
const {guideURL, modGuideURL, isModGuidePath, plainClick, namespaceContent, install} = require('../../assets/console-guide-dialog.js');
const helpers = require('../build-console-guides.cjs');

// Small DOM fixture for controller behavior. Native dialog focus containment,
// Escape handling and layout still require a browser check when UI is available.
class Node {
  constructor(tag, document) { this.tag = tag; this.ownerDocument = document; this.children = []; this.parentNode = null; this.attrs = new Map(); this.events = new Map(); this.textContent = ''; this.scrollTop = 0; }
  get attributes() { return [...this.attrs].map(([name, value]) => ({name, value})); }
  get id() { return this.getAttribute('id') || ''; } set id(value) { this.setAttribute('id', value); }
  get className() { return this.getAttribute('class') || ''; } set className(value) { this.setAttribute('class', value); }
  get target() { return this.getAttribute('target') || ''; }
  get hidden() { return this.hasAttribute('hidden'); } set hidden(value) { value ? this.setAttribute('hidden', '') : this.removeAttribute('hidden'); }
  get classList() { return {add: value => { this.className = [...new Set([...this.className.split(/\s+/).filter(Boolean), value])].join(' '); }, remove: value => { this.className = this.className.split(/\s+/).filter(item => item !== value).join(' '); }, contains: value => this.className.split(/\s+/).includes(value)}; }
  get isConnected() { let node = this; while (node.parentNode) node = node.parentNode; return node === this.ownerDocument.documentElement; }
  setAttribute(name, value) { this.attrs.set(name, String(value)); }
  getAttribute(name) { return this.attrs.get(name) ?? null; }
  hasAttribute(name) { return this.attrs.has(name); }
  removeAttribute(name) { this.attrs.delete(name); }
  remove() { if (this.parentNode) { const list = this.parentNode.children; list.splice(list.indexOf(this), 1); this.parentNode = null; } }
  adopt(document) { this.ownerDocument = document; this.children.forEach(child => child.adopt(document)); }
  append(...nodes) { for (const node of nodes) { node.remove(); node.parentNode = this; node.adopt(this.ownerDocument); this.children.push(node); } }
  before(node) { const parent = this.parentNode; node.remove(); node.parentNode = parent; parent.children.splice(parent.children.indexOf(this), 0, node); }
  replaceWith(node) { const parent = this.parentNode; const index = parent.children.indexOf(this); node.remove(); parent.children[index] = node; node.parentNode = parent; this.parentNode = null; }
  replaceChildren(...nodes) { this.children.forEach(node => { node.parentNode = null; }); this.children = []; this.append(...nodes); }
  matches(selector) {
    return selector.split(',').some(part => {
      const value = part.trim();
      if (value === '*') return true;
      if (value.startsWith('.')) return this.className.split(/\s+/).includes(value.slice(1));
      const match = value.match(/^([a-z][a-z0-9]*)?(?:\[([\w-]+)(?:\^="([^"]*)")?\])?$/i);
      return !!match && (!match[1] || match[1] === this.tag) && (!match[2] || this.hasAttribute(match[2]) && (match[3] === undefined || this.getAttribute(match[2]).startsWith(match[3])));
    });
  }
  querySelectorAll(selector) { const found = []; const visit = node => { for (const child of node.children) { if (child.matches(selector)) found.push(child); visit(child); } }; visit(this); return found; }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  closest(selector) { let node = this; while (node) { if (node.matches(selector)) return node; node = node.parentNode; } return null; }
  addEventListener(type, listener) { if (!this.events.has(type)) this.events.set(type, []); this.events.get(type).push(listener); }
  emit(type, init = {}) { const event = {target: this, button: 0, preventDefault() { this.defaultPrevented = true; }, stopPropagation() { this.stopped = true; }, ...init}; for (const listener of this.events.get(type) || []) listener(event); return event; }
  focus() { this.ownerDocument.activeElement = this; }
  showModal() { this.open = true; }
  close() { if (!this.open) return; this.open = false; this.emit('close'); }
  getBoundingClientRect() { return {left: 100, top: 100, right: 900, bottom: 700}; }
  cloneNode(deep) { const clone = new Node(this.tag, this.ownerDocument); clone.attrs = new Map(this.attrs); clone.textContent = this.textContent; if (deep) clone.append(...this.children.map(node => node.cloneNode(true))); return clone; }
}
function fixture(href = 'https://whatwhatboy.com/console/mods/ps4/game/index.html') {
  const document = {
    createElement(tag) { return new Node(tag, this); }, createComment() { return new Node('#comment', this); },
    querySelectorAll(selector) { return this.documentElement.querySelectorAll(selector); },
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; },
    getElementById(id) { return this.querySelectorAll('*').find(node => node.id === id) || null; },
    events: new Map(), addEventListener: Node.prototype.addEventListener, emit: Node.prototype.emit
  };
  document.documentElement = new Node('html', document); document.body = new Node('body', document); document.documentElement.append(document.body); document.activeElement = document.body;
  const window = {HTMLDialogElement: Node, location: {href, assign(value) { this.assigned = value; }}, AbortController, addEventListener() {}, fetch: async () => { throw new Error('Unavailable'); }};
  const element = (tag, attrs = {}, parent = document.body) => { const node = document.createElement(tag); for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value); parent.append(node); return node; };
  return {document, window, element};
}

test('fallback markup remains visible without JavaScript and helpers preserve normal download links', () => {
  const markup = helpers.guideSection('guide-test', 'Setup & controls', '<p>Exact instructions.</p>');
  assert.match(markup, /data-guide-panel/); assert.match(markup, /Setup &amp; controls/); assert.doesNotMatch(markup, / hidden/);
  assert.match(helpers.guideLink('#guide-test'), /href="#guide-test" data-guide-open/);
  assert.match(helpers.link('/console/mods/ps4/gta5/install.html', 'Read installation guide'), /data-guide-open/);
  assert.doesNotMatch(helpers.link('/console/psvita/jailbreak.html', 'Read jailbreak guide'), /data-guide-open/);
  assert.doesNotMatch(helpers.link('/console/ps5/y2jb.html', 'Y2JB setup guide'), /data-guide-open/);
  assert.doesNotMatch(helpers.link('/downloads/file.zip', 'Download'), /data-guide-open/);
  const f = fixture(); const panel = f.element('section', {'data-guide-panel': '', id: 'guide-test'}); f.window.HTMLDialogElement = undefined;
  assert.equal(install(f.document, f.window), null); assert.equal(panel.hidden, false);
});

test('local guide content moves once, closes, restores its position and returns focus', async () => {
  const f = fixture(); const anchor = f.element('a', {href: '#guide-one', 'data-guide-open': ''});
  const panel = f.element('section', {id: 'guide-one', 'data-guide-panel': '', 'data-guide-title': 'Installation'});
  const media = f.element('video', {}, panel); media.pause = () => { media.pausedByClose = true; };
  const frame = f.element('iframe', {class: 'guide-video-player', src: 'https://www.youtube-nocookie.com/embed/F7y-hk5qpxM?start=118&autoplay=1'}, panel);
  let playerReloads = 0;
  frame.setAttribute = function(name, value) { if (name === 'src') ++playerReloads; Node.prototype.setAttribute.call(this, name, value); };
  const controller = install(f.document, f.window); assert.equal(panel.hidden, true);
  const click = f.document.emit('click', {target: anchor}); assert.equal(click.defaultPrevented, true);
  assert.equal(controller.dialog.open, true); assert.equal(panel.hidden, false); assert.equal(panel.closest('.guide-dialog'), controller.dialog);
  assert.equal(f.document.querySelectorAll('*').filter(node => node.id === 'guide-one').length, 1);
  assert.equal(f.document.activeElement.tag, 'h2');
  controller.close(); // The same close event is fired by native Escape dismissal.
  assert.equal(panel.parentNode, f.document.body); assert.equal(panel.hidden, true); assert.equal(f.document.activeElement, anchor);
  assert.equal(media.pausedByClose, true);
  assert.equal(playerReloads, 1);
  assert.equal(frame.getAttribute('src'), 'https://www.youtube-nocookie.com/embed/F7y-hk5qpxM?playsinline=1&rel=0&autoplay=0&start=118');
  assert.equal(f.document.documentElement.classList.contains('guide-dialog-open'), false);
});

test('legacy guide-only setup anchors enhance without hiding resource/download grids', () => {
  const f = fixture(); const anchor = f.element('a', {href: '#setup'}); const setup = f.element('section', {id: 'setup', class: 'section'}); f.element('ol', {class: 'guide-steps'}, setup);
  const cardsAnchor = f.element('a', {href: '#downloads'}); const cards = f.element('section', {id: 'downloads', class: 'section'}); f.element('ol', {class: 'guide-steps'}, cards); f.element('div', {class: 'games-grid'}, cards);
  install(f.document, f.window); assert.equal(anchor.hasAttribute('data-guide-open'), true); assert.equal(setup.hidden, true);
  assert.equal(cardsAnchor.hasAttribute('data-guide-open'), false); assert.equal(cards.hidden, false);
});

test('popup URLs are limited to game and mod guides, including game source-code panels', () => {
  for (const pathname of ['/source-codes/console/ps4/gta5/', '/source-codes/console/ps4/gta5/index.html']) {
    assert.equal(isModGuidePath(pathname), true, pathname);
    assert.ok(modGuideURL(pathname + '#guide-source-gta5-ai-files', 'https://whatwhatboy.com/source-codes/'), pathname);
  }
  for (const pathname of ['/console/mods/ps4/gta5/install.html', '/mods/gta5.html', '/games/cod/black-ops-3.html', '/source-codes/games/gta5/ps4.html', '/console/ps5/mods.html', '/console/ps3/mods/call-of-duty/modern-warfare-2/', '/console/ps3/mods/menus.html', '/console/xbox360/mods/call-of-duty/black-ops-2/index.html', '/pc/discord-mods/call-of-duty/cod4/index.html', '/console/vault.html']) {
    assert.equal(isModGuidePath(pathname), true, pathname);
    assert.ok(modGuideURL(pathname + '#setup', 'https://whatwhatboy.com/console/ps5/'), pathname);
  }
  for (const pathname of ['/console/psvita/jailbreak.html', '/console/psvita/cfw.html', '/console/ps3/hen.html', '/console/ps4/jailbreak.html', '/console/ps4/goldhen.html', '/console/ps5/relapse.html', '/console/ps5/y2jb.html', '/console/xbox360/softmod.html', '/pc/emulators.html']) {
    assert.equal(isModGuidePath(pathname), false, pathname);
    assert.equal(modGuideURL(pathname, 'https://whatwhatboy.com/console/ps5/'), null, pathname);
  }
  assert.equal(modGuideURL('https://example.org/console/mods/ps4/gta5/install.html', 'https://whatwhatboy.com/console/ps5/'), null);
});

test('PS3 per-resource guides open in a dialog while the menu card and downloads stay in place', () => {
  const f = fixture('https://whatwhatboy.com/console/ps3/mods/call-of-duty/modern-warfare-2/');
  const card = f.element('article', {id:'menu-one'});
  const anchor = f.element('a', {href:'#guide-menu-one','data-guide-open':''}, card);
  const download = f.element('a', {href:'/downloads/ps3/original.rar',download:''}, card);
  const panel = f.element('section', {id:'guide-menu-one','data-guide-panel':'','data-guide-title':'Menu one requirements'}, card);
  const controller = install(f.document,f.window);
  assert.ok(controller);
  assert.equal(panel.hidden,true);
  f.document.emit('click',{target:anchor});
  assert.equal(controller.dialog.open,true);
  assert.equal(panel.closest('.guide-dialog'),controller.dialog);
  assert.equal(download.parentNode,card);
  assert.equal(card.parentNode,f.document.body);
  controller.close();
  assert.equal(panel.parentNode,card);
  assert.equal(f.document.activeElement,anchor);
});

test('Vita jailbreak and CFW guide links keep normal full-page navigation', () => {
  for (const href of ['/console/psvita/jailbreak.html', '/console/psvita/cfw.html']) {
    const f = fixture('https://whatwhatboy.com/console/psvita/');
    const trigger = f.element('a', {href, 'data-guide-open': ''});
    let requests = 0;
    f.window.fetch = async () => { requests++; throw Error('Should not fetch a system guide'); };
    assert.equal(install(f.document, f.window) === null, true);
    assert.equal(f.document.emit('click', {target: trigger}).defaultPrevented, undefined);
    assert.equal(trigger.getAttribute('href'), href);
    assert.equal(trigger.hasAttribute('data-guide-open'), false);
    assert.equal(trigger.hasAttribute('aria-haspopup'), false);
    assert.equal(f.document.querySelector('.guide-dialog'), null);
    assert.equal(requests, 0);
  }
});

test('PS5 setup sections remain visible and use normal in-page anchors', () => {
  const f = fixture('https://whatwhatboy.com/console/ps5/y2jb.html');
  const link = f.element('a', {href: '#installer'});
  const setup = f.element('section', {id: 'installer', class: 'section'});
  f.element('ol', {class: 'guide-steps'}, setup);
  const marked = f.element('section', {id: 'manual', class: 'section', 'data-guide-panel': ''});
  f.element('ol', {class: 'guide-steps'}, marked);
  assert.equal(install(f.document, f.window) === null, true);
  assert.equal(setup.hidden, false);
  assert.equal(marked.hidden, false);
  assert.equal(link.hasAttribute('data-guide-open'), false);
  assert.equal(f.document.emit('click', {target: link}).defaultPrevented, undefined);
});

test('a console landing page can open a mod guide while system guide links stay normal', async () => {
  const f = fixture('https://whatwhatboy.com/console/ps5/');
  const system = f.element('a', {href: '/console/psvita/jailbreak.html', 'data-guide-open': ''});
  const mod = f.element('a', {href: '/console/mods/ps4/gta5/install.html', 'data-guide-open': ''});
  const remote = fixture('https://whatwhatboy.com/console/mods/ps4/gta5/install.html');
  const content = remote.element('main', {id: 'content'});
  const heading = remote.element('h1', {}, content); heading.textContent = 'GTA V menu setup';
  const paragraph = remote.element('p', {}, content); paragraph.textContent = 'Installation instructions.';
  f.window.DOMParser = class { parseFromString() { return remote.document; } };
  const requests = [];
  f.window.fetch = async url => { requests.push(url); return {ok: true, url, text: async () => '<main id="content">Mod setup</main>'}; };
  const controller = install(f.document, f.window);
  assert.ok(controller);
  assert.equal(f.document.emit('click', {target: system}).defaultPrevented, undefined);
  assert.equal(requests.length, 0);
  assert.equal(f.document.emit('click', {target: mod}).defaultPrevented, true);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(requests, ['https://whatwhatboy.com/console/mods/ps4/gta5/install.html']);
  assert.equal(controller.dialog.open, true);
  assert.equal(controller.dialog.querySelector('h2').textContent, 'GTA V menu setup');
  assert.equal(f.window.location.href, 'https://whatwhatboy.com/console/ps5/');
  controller.close();
});

test('modified clicks, downloads and off-site links keep their normal behavior', () => {
  const f = fixture(); const guide = f.element('a', {href: '#guide', 'data-guide-open': ''}); f.element('section', {id: 'guide', 'data-guide-panel': ''});
  const download = f.element('a', {href: '#guide', 'data-guide-open': '', download: ''}); const external = f.element('a', {href: 'https://example.org/guide', 'data-guide-open': ''});
  const controller = install(f.document, f.window);
  for (const event of [{target: guide, ctrlKey: true}, {target: download}, {target: external}]) assert.equal(f.document.emit('click', event).defaultPrevented, undefined);
  assert.equal(controller.dialog.open, undefined); assert.equal(plainClick({button: 1}), false);
  assert.equal(guideURL('https://whatwhatboy.com.evil.test/guide', f.window.location.href), null);
  assert.equal(guideURL('javascript:alert(1)', f.window.location.href), null);
});

test('backdrop close requires a press and click outside, so dragging from content does not dismiss', async () => {
  const f = fixture(); const guide = f.element('a', {href: '#guide', 'data-guide-open': ''}); f.element('section', {id: 'guide', 'data-guide-panel': ''}); const controller = install(f.document, f.window);
  await controller.open(guide, guideURL('#guide', f.window.location.href)); const dialog = controller.dialog;
  dialog.emit('pointerdown', {clientX: 300, clientY: 200}); dialog.emit('click', {clientX: 20, clientY: 20}); assert.equal(dialog.open, true);
  dialog.emit('pointerdown', {clientX: 20, clientY: 20}); dialog.emit('click', {clientX: 20, clientY: 20}); assert.equal(dialog.open, false);
});

test('remote content keeps relative media/download links working and namespaces IDs and references', () => {
  const f = fixture(); const root = f.element('div', {id: 'content'}); const heading = f.element('h2', {id: 'setup'}, root);
  const anchor = f.element('a', {href: '#setup', 'aria-describedby': 'setup'}, root); const image = f.element('img', {src: '../images/menu.png', onerror: 'bad()'}, root); const download = f.element('a', {href: './menu.zip', download: ''}, root); f.element('script', {}, root);
  namespaceContent(root, 'https://whatwhatboy.com/console/gta/install.html', 'modal-');
  assert.equal(heading.id, 'modal-2'); assert.equal(anchor.getAttribute('href'), '#modal-2'); assert.equal(anchor.getAttribute('aria-describedby'), 'modal-2');
  assert.equal(image.getAttribute('src'), 'https://whatwhatboy.com/console/images/menu.png'); assert.equal(image.hasAttribute('onerror'), false);
  assert.equal(download.getAttribute('href'), 'https://whatwhatboy.com/console/gta/menu.zip'); assert.equal(download.hasAttribute('download'), true); assert.equal(root.querySelector('script'), null);
});

test('remote guides keep marked YouTube embeds with canonical safe player settings', () => {
  for (const host of ['www.youtube.com', 'www.youtube-nocookie.com']) {
    const f = fixture();
    const root = f.element('div', {id: 'content'});
    const frame = f.element('iframe', {
      id: 'player', class: 'guide-video-player extra-class',
      src: `https://${host}/embed/F7y-hk5qpxM?autoplay=1&enablejsapi=1&rel=1#extra`,
      title: 'PS4 14.00 video', srcdoc: '<script>bad()</script>', onload: 'bad()',
      allow: '*', loading: 'eager', referrerpolicy: 'no-referrer',
      sandbox: 'allow-top-navigation allow-popups'
    }, root);
    namespaceContent(root, 'https://whatwhatboy.com/console/ps4/jailbreak.html', 'modal-');
    assert.equal(root.querySelector('iframe'), frame);
    assert.deepEqual(Object.fromEntries(frame.attributes.map(({name, value}) => [name, value])), {
      id: 'modal-2', class: 'guide-video-player',
      src: 'https://www.youtube-nocookie.com/embed/F7y-hk5qpxM?playsinline=1&rel=0&autoplay=0',
      title: 'PS4 14.00 video', loading: 'lazy',
      referrerpolicy: 'strict-origin-when-cross-origin',
      allow: 'encrypted-media; picture-in-picture; fullscreen', allowfullscreen: ''
    });
  }
});

test('remote guides remove unmarked players and unapproved iframe hosts, paths and protocols', () => {
  const f = fixture(); const root = f.element('div', {id: 'content'});
  const sources = [
    'https://www.youtube.com.evil.example/embed/F7y-hk5qpxM',
    'https://user:password@www.youtube.com/embed/F7y-hk5qpxM',
    'https://www.youtube.com:8443/embed/F7y-hk5qpxM',
    'http://www.youtube.com/embed/F7y-hk5qpxM',
    'https://www.youtube.com/watch?v=F7y-hk5qpxM',
    'https://www.youtube-nocookie.com/embed/short',
    'javascript:bad()',
    '/embed/F7y-hk5qpxM'
  ];
  for (const src of sources) f.element('iframe', {class: 'guide-video-player', src}, root);
  f.element('iframe', {src: 'https://www.youtube.com/embed/F7y-hk5qpxM'}, root);
  f.element('iframe', {class: 'guide-video-player', srcdoc: '<p>Unapproved document</p>'}, root);
  f.element('script', {}, root); f.element('object', {}, root); f.element('embed', {}, root);
  namespaceContent(root, 'https://whatwhatboy.com/console/ps4/jailbreak.html', 'modal-');
  assert.equal(root.querySelectorAll('iframe, script, object, embed').length, 0);
});

test('video companions retain a valid source timestamp through remote guide sanitization', () => {
  const markup = helpers.videoEmbed('F7y-hk5qpxM', 'Setup', 118);
  assert.match(markup, /autoplay=0&amp;start=118/);
  assert.match(markup, /watch\?v=F7y-hk5qpxM&amp;t=118s/);
  assert.throws(() => helpers.videoEmbed('F7y-hk5qpxM', 'Setup', -1));
  const f = fixture(); const root = f.element('div');
  const frame = f.element('iframe', {class: 'guide-video-player', src: 'https://www.youtube.com/embed/F7y-hk5qpxM?start=118&autoplay=1'}, root);
  namespaceContent(root, 'https://whatwhatboy.com/console/install.html', 'modal-');
  assert.equal(frame.getAttribute('src'), 'https://www.youtube-nocookie.com/embed/F7y-hk5qpxM?playsinline=1&rel=0&autoplay=0&start=118');
});

test('failed remote guide loads fall back to the original full page', async () => {
  const f = fixture(); const anchor = f.element('a', {href: '../gta5/install.html', 'data-guide-open': ''}); const controller = install(f.document, f.window);
  const url = guideURL(anchor.getAttribute('href'), f.window.location.href); await controller.open(anchor, url, null);
  assert.equal(f.window.location.assigned, url.href); assert.equal(controller.dialog.open, false); assert.equal(f.document.activeElement, anchor);
});

test('closing while a remote request is pending aborts it and prevents late content insertion', async () => {
  const f = fixture(); const anchor = f.element('a', {href: '../gta5/install.html', 'data-guide-open': ''});
  let release, signal;
  f.window.fetch = (url, options) => { signal = options.signal; return new Promise(resolve => { release = resolve; }); };
  const controller = install(f.document, f.window);
  const pending = controller.open(anchor, guideURL(anchor.getAttribute('href'), f.window.location.href), null);
  controller.close(); assert.equal(signal.aborted, true);
  release({ok: true, url: anchor.getAttribute('href'), text: async () => '<main>Late response</main>'});
  await pending;
  assert.equal(controller.dialog.open, false); assert.equal(controller.dialog.querySelector('.guide-dialog__body').children.length, 0); assert.equal(f.window.location.assigned, undefined);
});

test('current COD builder keeps reachable guide panels without videos while the media renderer retains source support', () => {
  const root = path.resolve(__dirname, '../..'); const pages = [];
  const scriptRequire = createRequire(path.join(root, 'scripts/build-ps4-ps5-cod.cjs'));
  const bo3Target = path.join(root, 'console/mods/ps4/call-of-duty/black-ops-3/index.html');
  // Model the legacy generator's output in memory before the additive BO3 import.
  const safeFs = {...fs,
    readFileSync(file, ...args) { return file === bo3Target ? '</div>\n<footer class="guide-footer">' : fs.readFileSync(file, ...args); },
    writeFileSync(file, content) {
      assert.equal(file, bo3Target, 'Only the legacy BO3 supplement uses a direct write');
      pages.push({file: 'console/mods/ps4/call-of-duty/black-ops-3/index.html', content});
    }
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'scripts/build-ps4-ps5-cod.cjs'), 'utf8'), {
    __dirname: path.join(root, 'scripts'), URL, console: {log() {}},
    require(name) { if (name === './build-console-guides.cjs') return {...helpers, page: (...args) => pages.push({file: args[0], content: args[5]})}; if (name === './build-ps4-cod.cjs') return {}; if (name === 'node:fs') return safeFs; return scriptRequire(name); }
  });
  const bo2 = pages.find(page => page.file.includes('black-ops-2/index.html')); assert.ok(bo2);
  assert.match(bo2.content, /href="#guide-bo2-relay-guide" data-guide-open/); assert.match(bo2.content, /data-guide-title="BO2 Relay setup guide"/);
  assert.match(bo2.content, /Game Port to 3074/); assert.doesNotMatch(bo2.content, /gofile\.io\/d\/T4N8CPTY/);
  assert.doesNotMatch(bo2.content, /<video\b|bo1-bo2-payload-injector-guide\.mp4/);
  // Retain coverage of local media rendering independently of the video-free
  // game-page presentation. Existing source records and files remain preserved.
  const sourceData = JSON.parse(fs.readFileSync(path.join(root, 'docs/ps4-ps5-cod-resources.json'), 'utf8'));
  const mediaResource = sourceData.resources.find(item => item.id === 'bo1-bo2-payload-injector-debug');
  assert.ok(mediaResource.videos.length);
  const mediaRenderer = scriptRequire('./console-resource-renderer.cjs').createResourceRenderer({root, files: []});
  const sourceMedia = mediaRenderer.gameContent([mediaResource]);
  assert.match(sourceMedia, /<video controls playsinline preload="metadata">/);
  assert.match(sourceMedia, /bo1-bo2-payload-injector-guide\.mp4/);
  for (const slug of ['infinite-warfare', 'wwii']) {
    const reference = pages.find(page => page.file.includes('/' + slug + '/index.html'));
    assert.ok(reference);
    assert.match(reference.content, /data-guide-open/);
    assert.match(reference.content, /DLC compatibility reference/);
    const referenceCard = reference.content.match(/<article\b[^>]*id="resource-cod-dlc-[^"]+-reference"[\s\S]*?<\/article>/)?.[0];
    assert.ok(referenceCard);
    assert.doesNotMatch(referenceCard, /class="btn btn-primary"[^>]*download|fa-download/);
  }
  for (const page of pages) { const ids = [...page.content.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]); assert.equal(new Set(ids).size, ids.length, page.file); }
});
