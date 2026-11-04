const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.resolve(__dirname, '../../languages/i18n.js'), 'utf8');

function fixture(options = {}) {
  let doc;
  class Text {
    constructor(value) { this.nodeType = 3; this.parentNode = null; this.value = value; }
    get nodeValue() { return this.value; }
    set nodeValue(value) { this.value = value; doc.notify({type: 'characterData', target: this}); }
    get textContent() { return this.value; }
  }
  class Element {
    constructor(tag) { this.tagName = tag.toUpperCase(); this.nodeType = 1; this.parentNode = null; this.children = []; this.attrs = new Map(); }
    get className() { return this.getAttribute('class') || ''; }
    set className(value) { this.setAttribute('class', value); }
    get classList() { return {
      contains: name => this.className.split(/\s+/).includes(name),
      add: name => { this.className = [...new Set(this.className.split(/\s+/).filter(Boolean).concat(name))].join(' '); },
      remove: name => { this.className = this.className.split(/\s+/).filter(value => value !== name).join(' '); }
    }; }
    get textContent() { return this.children.map(child => child.textContent).join(''); }
    set textContent(value) {
      const removedNodes = this.children;
      for (const child of removedNodes) child.parentNode = null;
      this.children = value === '' ? [] : [new Text(String(value))];
      for (const child of this.children) child.parentNode = this;
      doc.notify({type: 'childList', target: this, addedNodes: this.children, removedNodes});
    }
    hasAttribute(name) { return this.attrs.has(name); }
    getAttribute(name) { return this.attrs.has(name) ? this.attrs.get(name) : null; }
    setAttribute(name, value) { this.attrs.set(name, String(value)); doc.notify({type: 'attributes', target: this, attributeName: name}); }
    removeAttribute(name) { this.attrs.delete(name); doc.notify({type: 'attributes', target: this, attributeName: name}); }
    appendChild(child) {
      if (child.parentNode) child.parentNode.removeChild(child);
      this.children.push(child); child.parentNode = this;
      doc.notify({type: 'childList', target: this, addedNodes: [child], removedNodes: []});
      return child;
    }
    removeChild(child) {
      this.children = this.children.filter(node => node !== child); child.parentNode = null;
      doc.notify({type: 'childList', target: this, addedNodes: [], removedNodes: [child]});
      return child;
    }
    matches(selector) {
      return selector.split(',').some(part => {
        const tag = part.match(/^[A-Za-z]+/);
        if (tag && this.tagName !== tag[0].toUpperCase()) return false;
        const className = part.match(/\.([\w-]+)/);
        if (className && !this.classList.contains(className[1])) return false;
        for (const match of part.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g)) {
          if (!this.hasAttribute(match[1]) || match[2] !== undefined && this.getAttribute(match[1]) !== match[2]) return false;
        }
        return true;
      });
    }
    querySelectorAll(selector) {
      const matches = [];
      for (const child of this.children.filter(node => node.nodeType === 1)) {
        if (child.matches(selector)) matches.push(child);
        matches.push(...child.querySelectorAll(selector));
      }
      return matches;
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  }
  const observers = [];
  const storage = new Map();
  class Observer {
    constructor(callback) { this.callback = callback; this.records = []; observers.push(this); }
    observe(root, options) { this.root = root; this.options = options; }
    disconnect() { this.root = null; this.records = []; }
    takeRecords() { const records = this.records; this.records = []; return records; }
  }
  doc = {
    readyState: 'loading', currentScript: {src: 'https://whatwhatboy.com/languages/i18n.js?v=test'},
    notify(record) {
      for (const observer of observers) {
        if (!observer.root || !observer.options[record.type === 'characterData' ? 'characterData' : record.type === 'childList' ? 'childList' : 'attributes']) continue;
        if (record.type === 'attributes' && !observer.options.attributeFilter.includes(record.attributeName)) continue;
        let node = record.target;
        while (node && node !== observer.root) node = node.parentNode;
        if (node) observer.records.push(record);
      }
    },
    createElement: tag => new Element(tag),
    createTreeWalker(root) {
      const nodes = [];
      const walk = node => { for (const child of node.children || []) { if (child.nodeType === 3) nodes.push(child); else walk(child); } };
      walk(root); let index = 0; return {nextNode: () => nodes[index++] || null};
    },
    querySelectorAll(selector) { return this.documentElement.querySelectorAll(selector); },
    querySelector(selector) { return this.documentElement.querySelector(selector); },
    addEventListener() {}
  };
  doc.documentElement = new Element('html');
  doc.head = doc.documentElement.appendChild(new Element('head'));
  doc.body = doc.documentElement.appendChild(new Element('body'));
  const title = doc.head.appendChild(new Element('title'));
  title.textContent = 'Console downloads';
  Object.defineProperty(doc, 'title', {get: () => title.textContent, set: value => { title.textContent = value; }});
  const context = {
    WWB_HOST_CONSOLE: options.console === true, document: doc, navigator: {languages: ['en']}, NodeFilter: {SHOW_TEXT: 4}, WeakMap, MutationObserver: Observer, Intl: options.intl === false ? undefined : Intl,
    localStorage: {getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key)},
    setTimeout: () => 1, clearTimeout() {}, CustomEvent: class { constructor(name, options) { this.type = name; this.detail = options.detail; } },
    dispatchEvent() {}
  };
  context.window = context;
  vm.runInNewContext(source, context, {filename: 'languages/i18n.js'});
  const api = context.__scoobyI18n;
  return {doc, api, storage, observers,
    element(tag, text, attrs = {}) {
      const el = new Element(tag);
      if (text !== undefined) el.textContent = text;
      for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
      doc.body.appendChild(el);
      return el;
    },
    flush() {
      let count = 0;
      while (observers.some(observer => observer.records.length)) {
        if (++count > 10) throw Error('Translation observer did not settle');
        for (const observer of observers) if (observer.records.length) observer.callback(observer.takeRecords());
      }
    }
  };
}

test('live status text and accessible attributes retain the latest English source on language changes', () => {
  const f = fixture();
  const status = f.element('p', '3 files');
  const search = f.element('input', undefined, {placeholder: 'Search files', 'aria-label': 'Search files'});
  const sidebar = f.element('a', 'Downloads', {'data-tooltip': 'Downloads'});
  f.api.register('es', {'{count} files': '{count} archivos', 'Search files': 'Buscar archivos', 'Search menus': 'Buscar menús', Downloads: 'Descargas'});
  f.api.set('es');
  assert.equal(status.textContent, '3 archivos');
  assert.equal(search.getAttribute('placeholder'), 'Buscar archivos');
  assert.equal(sidebar.getAttribute('data-tooltip'), 'Descargas');
  status.children[0].nodeValue = '4 files';
  search.setAttribute('placeholder', 'Search menus');
  f.flush();
  assert.equal(status.textContent, '4 archivos');
  assert.equal(search.getAttribute('placeholder'), 'Buscar menús');
  f.api.set('en');
  f.flush();
  assert.equal(status.textContent, '4 files');
  assert.equal(search.getAttribute('placeholder'), 'Search menus');
  assert.equal(sidebar.getAttribute('data-tooltip'), 'Downloads');
  assert.equal(f.storage.get('scooby.lang'), 'en');
});

test('complete dictionary templates preserve console names and literal filenames without broad prefix translation', () => {
  const f = fixture();
  f.api.register('es', {'Save on {platform}': 'Guardar en {platform}', 'Download {filename}': 'Descargar {filename}', '{count} files': '{count} archivos'});
  f.api.set('es');
  assert.equal(f.api.t('Save on PS5'), 'Guardar en PS5');
  assert.equal(f.api.t('Save on {platform}', {platform: 'PS4'}), 'Guardar en PS4');
  assert.equal(f.api.t('{count} files', {count: 27}), '27 archivos');
  assert.equal(f.api.t('Download payload$1.elf'), 'Descargar payload$1.elf');
  assert.equal(f.api.t('Download the file and follow the instructions'), 'Download the file and follow the instructions');
  assert.equal(f.api.t('Save on an unsupported machine'), 'Save on an unsupported machine');
  f.api.set('en');
  assert.equal(f.api.t('{count} files', {count: 27}), '27 files');
});

test('inserted guides translate while code, marked content and user-entered values stay unchanged', () => {
  const f = fixture();
  f.api.register('es', {Download: 'Descargar', 'PS5/payload.bin': 'incorrect', Search: 'Buscar'});
  const code = f.element('code', 'PS5/payload.bin');
  const skipped = f.element('span', 'Download', {translate: 'no'});
  const input = f.element('input', undefined, {type: 'text', value: 'Search'});
  const button = f.element('input', undefined, {type: 'button', value: 'Download'});
  f.api.set('es');
  const dynamic = f.element('section', 'Download');
  f.flush();
  assert.equal(dynamic.textContent, 'Descargar');
  assert.equal(code.textContent, 'PS5/payload.bin');
  assert.equal(skipped.textContent, 'Download');
  assert.equal(input.getAttribute('value'), 'Search');
  assert.equal(button.getAttribute('value'), 'Descargar');
  f.api.set('en');
  f.flush();
  assert.equal(dynamic.textContent, 'Download');
});

test('dynamic titles and description metadata revert to their newest source instead of stale text', () => {
  const f = fixture();
  const meta = f.doc.head.appendChild(f.doc.createElement('meta'));
  meta.setAttribute('name', 'description');
  meta.setAttribute('content', 'Search files');
  f.api.register('es', {'Console downloads': 'Descargas de consola', 'Payload downloads': 'Descargas de payloads', 'Search files': 'Buscar archivos', 'Search menus': 'Buscar menús'});
  f.api.set('es');
  assert.equal(f.doc.title, 'Descargas de consola');
  f.doc.title = 'Payload downloads';
  meta.setAttribute('content', 'Search menus');
  f.flush();
  assert.equal(f.doc.title, 'Descargas de payloads');
  assert.equal(meta.getAttribute('content'), 'Buscar menús');
  f.api.set('en');
  f.flush();
  assert.equal(f.doc.title, 'Payload downloads');
  assert.equal(meta.getAttribute('content'), 'Search menus');
});

test('failed dictionary loads keep the current language and can be retried successfully', () => {
  const f = fixture();
  f.api.set('fr');
  let scripts = f.doc.head.children.filter(node => node.tagName === 'SCRIPT');
  assert.equal(scripts.length, 1);
  scripts[0].onerror();
  assert.equal(f.api.get(), 'en');
  assert.equal(f.doc.documentElement.getAttribute('lang'), null);
  assert.equal(f.doc.body.querySelector('[role="alert"]').textContent, 'Unable to load this language. Please try again.');
  f.api.set('fr');
  scripts = f.doc.head.children.filter(node => node.tagName === 'SCRIPT');
  assert.equal(scripts.length, 1);
  f.api.register('fr', {});
  scripts[0].onload();
  assert.equal(f.api.get(), 'fr');
  assert.equal(f.doc.documentElement.getAttribute('lang'), 'fr');
  assert.equal(f.doc.body.querySelector('[role="alert"]'), null);
});

test('a slow earlier dictionary cannot overwrite a newer choice, including RTL direction', () => {
  const f = fixture();
  f.api.set('es');
  f.api.register('ar', {});
  f.api.set('ar');
  f.api.register('es', {});
  assert.equal(f.api.get(), 'ar');
  assert.equal(f.doc.documentElement.getAttribute('dir'), 'rtl');
  f.api.set('en');
  assert.equal(f.doc.documentElement.getAttribute('dir'), 'ltr');
});

test('validated date captures in translated templates localize while English reset preserves the source', () => {
  const f = fixture();
  const footer = f.element('p', 'Reviewed 2 November 2026.');
  f.api.register('es', {'Reviewed {date}.': 'Revisado el {date}.'});
  f.api.set('es');
  assert.equal(footer.textContent, 'Revisado el 2 de noviembre de 2026.');
  assert.equal(f.api.t('Reviewed {date}.', {date: '2 November 2026'}), 'Revisado el 2 de noviembre de 2026.');
  assert.equal(f.api.t('Reviewed 31 February 2026.'), 'Revisado el 31 February 2026.');
  assert.equal(f.api.t('Unknown {date}.', {date: '2 November 2026'}), 'Unknown 2 November 2026.');
  assert.equal(f.api.t('payload-2-November-2026.pkg'), 'payload-2-November-2026.pkg');
  assert.equal(f.api.t('13.52'), '13.52');
  f.api.set('en');
  f.flush();
  assert.equal(footer.textContent, 'Reviewed 2 November 2026.');
});

test('date template captures retain their literal source when Intl is unavailable', () => {
  const f = fixture({intl: false});
  const footer = f.element('p', 'Reviewed 2 November 2026.');
  f.api.register('es', {'Reviewed {date}.': 'Revisado el {date}.'});
  f.api.set('es');
  assert.equal(footer.textContent, 'Revisado el 2 November 2026.');
  f.api.set('en');
  assert.equal(footer.textContent, 'Reviewed 2 November 2026.');
});

test('console English releases the mutation observer and restores dynamic translation on language change',()=>{const f=fixture({console:true}),label=f.element('p','Download');f.api.set('en');assert.equal(f.observers.filter(o=>o.root).length,0);f.api.register('es',{Download:'Descargar'});f.api.set('es');assert.equal(label.textContent,'Descargar');assert.equal(f.observers.filter(o=>o.root).length,1);const dynamic=f.element('p','Download');f.flush();assert.equal(dynamic.textContent,'Descargar');f.api.set('en');assert.equal(label.textContent,'Download');assert.equal(dynamic.textContent,'Download');assert.equal(f.observers.filter(o=>o.root).length,0);});
