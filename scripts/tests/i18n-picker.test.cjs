const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.resolve(__dirname, '../../languages/i18n.js'), 'utf8');

function fixture() {
  class Element {
    constructor() { this.children = []; this.listeners = new Map(); this.style = {}; this.attrs = {}; this.classes = new Set(); this.classList = {add: c => this.classes.add(c), remove: c => this.classes.delete(c)}; }
    setAttribute(k, v) { this.attrs[k] = v; }
    getAttribute(k) { return this.attrs[k]; }
    appendChild(el) { this.children.push(el); el.parentNode = this; }
    removeChild(el) { this.children = this.children.filter(c => c !== el); el.parentNode = null; }
    querySelector() { return null; }
    addEventListener(type, fn) { const list = this.listeners.get(type) || new Set(); list.add(fn); this.listeners.set(type, list); }
    removeEventListener(type, fn) { this.listeners.get(type)?.delete(fn); }
    dispatch(type, event) { for (const fn of [...this.listeners.get(type) || []]) fn(event); }
  }
  const document = new Element();
  document.body = new Element(); document.body.style.overflow = 'auto'; document.createElement = () => new Element();
  const choices = [], timers = [];
  const context = {document, LANGS:[{code:'en',native:'English'}], DEFAULT_LANG:'en', current:'en', GLOBE:'', stored:()=>null, detect:()=>'en', flagHTML:()=>'', setLang:code=>choices.push(code), setTimeout:fn=>timers.push(fn)};
  const start = source.indexOf('  var picker = null;');
  const end = source.indexOf('  // ------------------------------------------------------------------ boot', start);
  vm.runInNewContext(source.slice(start, end), context);
  return {document, choices, context, flush:()=>{while(timers.length) timers.shift()();}, open:()=>{context.showPicker(true); return context.picker;}};
}

for (const action of ['dismiss', 'choice', 'outside', 'escape']) {
  test(`language picker ${action} closes once and releases its Escape handler`, () => {
    const f = fixture(), old = f.open(), box = old.children[0];
    const target = {closest: selector => selector === (action === 'choice' ? '.i18n-pick' : '.i18n-dismiss') ? {getAttribute:()=>'es'} : null};
    const close = () => action === 'outside' ? old.dispatch('click', {target:old}) : action === 'escape' ? f.document.dispatch('keydown', {key:'Escape'}) : box.dispatch('click', {target});
    close(); close();
    assert.equal(f.choices.length, 1);
    assert.equal(f.document.body.style.overflow, 'auto');
    assert.equal(f.document.listeners.get('keydown').size, 0);
    const fresh = f.open();
    old.dispatch('click', {target:old});
    assert.equal(f.context.picker, fresh);
    assert.equal(f.document.body.style.overflow, 'hidden');
    f.flush();
    assert.equal(old.parentNode, null);
    assert.equal(fresh.parentNode, f.document.body);
    f.document.dispatch('keydown', {key:'Escape'});
    assert.equal(f.choices.length, 2);
    assert.equal(f.context.picker, null);
    assert.equal(f.document.body.style.overflow, 'auto');
  });
}
