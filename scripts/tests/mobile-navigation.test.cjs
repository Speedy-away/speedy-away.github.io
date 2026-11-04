const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Controller tests deliberately do not claim to validate native browser layout.
function fixture({ mobile = true, collapsed = false, storageDenied = false } = {}) {
    let document;
    class Element {
        constructor(tag) {
            this.tagName = tag.toUpperCase(); this.attrs = new Map(); this.children = [];
            this.events = new Map(); this.style = {}; this.dataset = {}; this.parentElement = null;
        }
        get id() { return this.getAttribute('id') || ''; }
        set id(value) { this.setAttribute('id', value); }
        get className() { return this.getAttribute('class') || ''; }
        set className(value) { this.setAttribute('class', value); }
        get classList() { return {
            contains: value => this.className.split(/\s+/).includes(value),
            add: value => { this.className = [...new Set(this.className.split(/\s+/).filter(Boolean).concat(value))].join(' '); },
            remove: value => { this.className = this.className.split(/\s+/).filter(item => item !== value).join(' '); },
            toggle: (value, force) => {
                const on = force === undefined ? !this.classList.contains(value) : Boolean(force);
                on ? this.classList.add(value) : this.classList.remove(value); return on;
            }
        }; }
        setAttribute(name, value) { this.attrs.set(name, String(value)); }
        getAttribute(name) { return this.attrs.get(name) ?? null; }
        hasAttribute(name) { return this.attrs.has(name); }
        removeAttribute(name) { this.attrs.delete(name); }
        get inert() { return this.hasAttribute('inert'); }
        set inert(value) { value ? this.setAttribute('inert', '') : this.removeAttribute('inert'); }
        get hidden() { return this.hasAttribute('hidden'); }
        set hidden(value) { value ? this.setAttribute('hidden', '') : this.removeAttribute('hidden'); }
        appendChild(child) {
            if (child.parentElement) child.parentElement.children = child.parentElement.children.filter(node => node !== child);
            child.parentElement = this; this.children.push(child); return child;
        }
        insertBefore(child, reference) {
            if (!reference) return this.appendChild(child);
            if (child.parentElement) child.parentElement.children = child.parentElement.children.filter(node => node !== child);
            child.parentElement = this; this.children.splice(this.children.indexOf(reference), 0, child); return child;
        }
        get firstChild() { return this.children[0] || null; }
        contains(node) { return node === this || this.children.some(child => child.contains(node)); }
        get isConnected() { return document.documentElement.contains(this); }
        matches(selector) {
            return selector.split(',').some(value => {
                const part = value.trim();
                const denied = [...part.matchAll(/:not\(\[([^\]]+)\]\)/g)];
                if (denied.some(match => this.hasAttribute(match[1].split('=')[0]))) return false;
                const plain = part.replace(/:not\([^)]*\)/g, '');
                const structure = plain.replace(/\[[^\]]*\]/g, '');
                const tag = structure.match(/^[a-z]+/i);
                if (tag && this.tagName !== tag[0].toUpperCase()) return false;
                if ([...structure.matchAll(/\.([\w-]+)/g)].some(match => !this.classList.contains(match[1]))) return false;
                for (const match of plain.matchAll(/\[([\w-]+)(?:(\*=|=)"([^"]*)")?\]/g)) {
                    if (!this.hasAttribute(match[1])) return false;
                    const actual = this.getAttribute(match[1]);
                    if (match[2] === '=' && actual !== match[3]) return false;
                    if (match[2] === '*=' && !actual.includes(match[3])) return false;
                }
                return true;
            });
        }
        querySelectorAll(selector) {
            return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]);
        }
        querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
        closest(selector) { return this.matches(selector) ? this : this.parentElement?.closest(selector) || null; }
        addEventListener(type, fn) { if (!this.events.has(type)) this.events.set(type, []); this.events.get(type).push(fn); }
        dispatchEvent(event) { event.target ||= this; for (const fn of this.events.get(event.type) || []) fn(event); return !event.defaultPrevented; }
        emit(type, details = {}) {
            const event = { type, target: this, preventDefault() { this.defaultPrevented = true; }, ...details };
            this.dispatchEvent(event); return event;
        }
        click() { this.emit('click'); }
        focus() { document.activeElement = this; }
        getClientRects() { return this.closest('[hidden]') ? [] : [{}]; }
    }
    document = new Element('document');
    document.documentElement = new Element('html');
    document.head = document.documentElement.appendChild(new Element('head'));
    document.body = document.documentElement.appendChild(new Element('body'));
    document.createElement = tag => new Element(tag);
    document.querySelectorAll = selector => document.documentElement.querySelectorAll(selector);
    document.querySelector = selector => document.querySelectorAll(selector)[0] || null;
    document.getElementById = id => document.querySelectorAll('*').find(element => element.id === id) || null;
    const add = (tag, attributes, parent = document.body) => {
        const element = new Element(tag);
        for (const [name, value] of Object.entries(attributes || {})) element.setAttribute(name, value);
        parent.appendChild(element); return element;
    };
    const sidebar = add('div', { id: 'sidebar', class: 'sidebar' });
    const toggle = add('button', { id: 'sidebar-toggle' }, sidebar); add('i', {}, toggle);
    const firstLink = add('a', { href: '/index.html' }, sidebar);
    const lastLink = add('a', { href: '/contact.html' }, sidebar);
    const header = add('header');
    const mobileButton = add('button', { id: 'mobile-sidebar-btn' }, header); add('i', {}, mobileButton);
    const main = add('main', { id: 'main-content' });
    const alreadyInert = add('div', { inert: '' });
    document.activeElement = mobileButton;
    const viewport = { matches: mobile, events: [], addEventListener(type, fn) { this.events.push(fn); }, change(value) { this.matches = value; this.events.forEach(fn => fn({ matches: value })); } };
    const window = { matchMedia: () => viewport, scrollX: 0, scrollY: 640, scrollTo(x, y) { this.scrollX = x; this.scrollY = y; } };
    const storage = new Map([['sidebarCollapsed', String(collapsed)]]);
    const localStorage = {
        getItem(key) { if (storageDenied) throw Error('Storage denied'); return storage.get(key); },
        setItem(key, value) { if (storageDenied) throw Error('Storage denied'); storage.set(key, value); }
    };
    const context = vm.createContext({ document, window, localStorage, Event: class { constructor(type) { this.type = type; } } });
    vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../script.js'), 'utf8'), context);
    context.initSidebar();
    return { context, document, window, viewport, sidebar, toggle, mobileButton, header, main, alreadyInert, firstLink, lastLink, add, storage };
}

test('mobile drawer is modal, traps focus, restores the opener and preserves scroll/styles', () => {
    const f = fixture();
    f.document.body.style.overflow = 'clip';
    assert.equal(f.sidebar.inert, true);
    assert.equal(f.mobileButton.getAttribute('aria-expanded'), 'false');
    f.mobileButton.click();
    assert.equal(f.sidebar.inert, false);
    assert.equal(f.sidebar.getAttribute('aria-modal'), 'true');
    assert.equal(f.mobileButton.getAttribute('aria-expanded'), 'true');
    assert.equal(f.main.inert, true);
    assert.equal(f.header.inert, true);
    assert.equal(f.document.activeElement, f.toggle);
    assert.equal(f.document.body.style.position, 'fixed');
    assert.equal(f.document.body.style.top, '-640px');
    f.lastLink.focus();
    assert.equal(f.document.emit('keydown', { key: 'Tab' }).defaultPrevented, true);
    assert.equal(f.document.activeElement, f.toggle);
    f.document.emit('keydown', { key: 'Tab', shiftKey: true });
    assert.equal(f.document.activeElement, f.lastLink);
    f.window.scrollY = 0;
    f.document.emit('keydown', { key: 'Escape' });
    assert.equal(f.sidebar.inert, true);
    assert.equal(f.sidebar.getAttribute('aria-modal'), null);
    assert.equal(f.main.inert, false);
    assert.equal(f.alreadyInert.inert, true);
    assert.equal(f.document.activeElement, f.mobileButton);
    assert.equal(f.window.scrollY, 640);
    assert.equal(f.document.body.style.overflow, 'clip');
});

test('crossing the tablet breakpoint closes the drawer and restores the desktop preference', () => {
    const f = fixture({ mobile: false, collapsed: true });
    assert.equal(f.sidebar.classList.contains('collapsed'), true);
    f.viewport.change(true);
    assert.equal(f.sidebar.classList.contains('collapsed'), false);
    assert.equal(f.sidebar.inert, true);
    f.mobileButton.click();
    f.viewport.change(false);
    assert.equal(f.sidebar.classList.contains('active'), false);
    assert.equal(f.sidebar.classList.contains('collapsed'), true);
    assert.equal(f.sidebar.inert, false);
    assert.equal(f.main.inert, false);
    assert.equal(f.document.body.classList.contains('sidebar-open'), false);
    f.toggle.click();
    assert.equal(f.storage.get('sidebarCollapsed'), 'false');
    assert.equal(f.toggle.getAttribute('aria-expanded'), 'true');
});

test('blocked storage does not disable navigation, backdrop dismissal, or resize recovery', () => {
    const f = fixture({ storageDenied: true });
    f.mobileButton.click();
    f.document.querySelector('.sidebar-backdrop').click();
    assert.equal(f.sidebar.classList.contains('active'), false);
    f.viewport.change(false);
    assert.doesNotThrow(() => f.toggle.click());
    assert.equal(f.sidebar.classList.contains('collapsed'), true);
});

test('closed navigation groups are removed from the keyboard path and expose their control relationship', () => {
    const f = fixture();
    const group = f.add('li', { class: 'nav-group' }, f.sidebar);
    const button = f.add('button', { class: 'nav-group-toggle' }, group);
    const list = f.add('ul', { class: 'nav-sublist' }, group);
    f.add('a', { href: '/console/ps5/' }, list);
    f.context.initSidebarGroups();
    assert.equal(list.inert, true);
    assert.equal(button.getAttribute('aria-controls'), list.id);
    button.click();
    assert.equal(list.inert, false);
    assert.equal(button.getAttribute('aria-expanded'), 'true');
    button.click();
    assert.equal(list.inert, true);
});

test('FAQ answers work with the keyboard, remain unconstrained when expanded and close accessibly', () => {
    const f = fixture();
    const item = f.add('div', { class: 'faq-item' }, f.main);
    const question = f.add('div', { class: 'faq-question' }, item);
    const answer = f.add('div', { class: 'faq-answer' }, item);
    f.context.initFaqAccordion();
    assert.equal(question.getAttribute('role'), 'button');
    assert.equal(question.getAttribute('tabindex'), '0');
    assert.equal(answer.hidden, true);
    question.emit('keydown', { key: 'Enter' });
    assert.equal(answer.hidden, false);
    assert.equal(answer.style.maxHeight, 'none');
    assert.equal(question.getAttribute('aria-expanded'), 'true');
    assert.equal(question.getAttribute('aria-controls'), answer.id);
    question.emit('keydown', { key: ' ' });
    assert.equal(answer.hidden, true);
    assert.equal(question.getAttribute('aria-expanded'), 'false');
});

test('regenerated pages receive one mobile shell, skip link, and each mobile asset across repeated initialization', () => {
    const f = fixture();
    const backgroundStyles = f.add('link', { rel: 'stylesheet', href: '/assets/site-background.css?v=1' }, f.document.head);
    const sharedStyles = f.add('link', { rel: 'stylesheet', href: '/style.css?v=shared' }, f.document.head);
    const search = f.add('input', { id: 'gameSearch', placeholder: 'Search games' }, f.main);
    const labelled = f.add('input', { type: 'search', 'aria-label': 'Filter downloads' }, f.main);
    const withLabel = f.add('input', { type: 'search', placeholder: 'Search tools' }, f.main);
    withLabel.labels = [{}];
    f.context.initResponsiveShell();
    f.context.initResponsiveShell();
    assert.equal(f.document.querySelectorAll('.mobile-site-header').length, 1);
    assert.equal(f.document.querySelectorAll('.mobile-brand').length, 1);
    assert.equal(f.document.querySelectorAll('.skip-link').length, 1);
    const mobileStyles = f.document.querySelectorAll('link[rel="stylesheet"]')
        .filter(link => (link.getAttribute('href') || '').split(/[?#]/)[0].endsWith('/assets/mobile.css'));
    assert.equal(mobileStyles.length, 1);
    assert.equal(mobileStyles[0].getAttribute('href'), '/assets/mobile.css?v=3.3.8');
    assert.equal(f.document.head.contains(backgroundStyles), true);
    assert.equal(f.document.head.contains(sharedStyles), true);
    assert.equal(backgroundStyles.getAttribute('href'), '/assets/site-background.css?v=1');
    assert.equal(sharedStyles.getAttribute('href'), '/style.css?v=shared');
    assert.equal(f.document.querySelectorAll('link[href*="/assets/mobile-downloads.css"]').length, 1);
    assert.equal(f.document.querySelector('link[href*="/assets/mobile-downloads.css"]').getAttribute('href'), '/assets/mobile-downloads.css?v=3.3.8');
    assert.equal(f.document.querySelectorAll('script[src*="/assets/mobile-downloads.js"]').length, 1);
    assert.equal(f.document.querySelector('.mobile-brand').getAttribute('href'), '/');
    assert.equal(f.mobileButton.closest('.mobile-site-header') !== null, true);
    assert.equal(f.main.getAttribute('tabindex'), '-1');
    assert.equal(search.getAttribute('aria-label'), 'Search games');
    assert.equal(labelled.getAttribute('aria-label'), 'Filter downloads');
    assert.equal(withLabel.getAttribute('aria-label'), null);
});

test('an installed mobile shell retains its existing elements and stylesheet', () => {
    const f = fixture();
    f.header.className = 'mobile-site-header';
    const brand = f.add('a', { class: 'mobile-brand', href: '/' }, f.header);
    const skip = f.add('a', { class: 'skip-link', href: '#main-content' });
    const backgroundStyles = f.add('link', { rel: 'stylesheet', href: '/assets/site-background.css?v=1' }, f.document.head);
    const stylesheet = f.add('link', { rel: 'stylesheet', href: '/assets/mobile.css?v=3.2.0' }, f.document.head);
    const sharedStyles = f.add('link', { rel: 'stylesheet', href: '/style.css?v=shared' }, f.document.head);
    f.context.initResponsiveShell();
    f.context.initResponsiveShell();
    assert.equal(f.mobileButton.closest('.mobile-site-header'), f.header);
    assert.equal(f.document.querySelector('.mobile-brand'), brand);
    assert.equal(f.document.querySelector('.skip-link'), skip);
    const mobileStyles = f.document.querySelectorAll('link[rel="stylesheet"]')
        .filter(link => (link.getAttribute('href') || '').split(/[?#]/)[0].endsWith('/assets/mobile.css'));
    assert.equal(mobileStyles.length, 1);
    assert.equal(mobileStyles[0], stylesheet);
    assert.equal(stylesheet.getAttribute('href'), '/assets/mobile.css?v=3.2.0');
    assert.equal(f.document.head.contains(backgroundStyles), true);
    assert.equal(f.document.head.contains(sharedStyles), true);
    assert.equal(f.document.querySelectorAll('link[href*="/assets/mobile-downloads.css"]').length, 1);
    assert.equal(f.document.querySelectorAll('script[src*="/assets/mobile-downloads.js"]').length, 1);
});

test('regenerated pages load the shared background stylesheet and script once', () => {
    const f = fixture();
    f.context.initSiteBackground();
    const stylesheet = f.document.querySelector('link[rel="stylesheet"]');
    const script = f.document.querySelector('script[src]');
    assert.equal(stylesheet.getAttribute('href'), '/assets/site-background.css?v=2');
    assert.equal(script.getAttribute('src'), '/assets/site-background.js?v=2');
    assert.equal(script.defer, true);
    f.context.initSiteBackground();
    assert.equal(f.document.querySelectorAll('link[rel="stylesheet"]').length, 1);
    assert.equal(f.document.querySelectorAll('script[src]').length, 1);
    assert.equal(f.document.querySelector('link[rel="stylesheet"]'), stylesheet);
    assert.equal(f.document.querySelector('script[src]'), script);
});

test('directly included background assets retain their nodes and versions without duplicate loaders', () => {
    const f = fixture();
    const stylesheet = f.add('link', { rel: 'stylesheet', href: '../../assets/site-background.css?v=existing' }, f.document.head);
    const script = f.add('script', { src: '/assets/site-background.js?v=existing', defer: '' });
    f.context.initSiteBackground();
    f.context.initSiteBackground();
    assert.equal(f.document.querySelectorAll('link[rel="stylesheet"]').length, 1);
    assert.equal(f.document.querySelectorAll('script[src]').length, 1);
    assert.equal(f.document.querySelector('link[rel="stylesheet"]'), stylesheet);
    assert.equal(stylesheet.getAttribute('href'), '../../assets/site-background.css?v=existing');
    assert.equal(f.document.querySelector('script[src]'), script);
    assert.equal(script.getAttribute('src'), '/assets/site-background.js?v=existing');
});

test('standalone pages without the shared navigation shell are left alone', () => {
    const f = fixture();
    f.sidebar.id = 'standalone';
    f.context.initResponsiveShell();
    assert.equal(f.document.querySelector('.mobile-site-header'), null);
    assert.equal(f.document.querySelector('.skip-link'), null);
    assert.equal(f.document.head.children.length, 0);
});

test('game search combines categories and text, announces counts, and reset restores the full list', () => {
    const f = fixture();
    const search = f.add('input', { id: 'gameSearch' }, f.main);
    search.value = '';
    const status = f.add('p', { id: 'gameSearchStatus' }, f.main);
    const reset = f.add('button', { id: 'resetGameSearch' }, f.main);
    const all = f.add('button', { class: 'filter-btn active' }, f.main);
    all.dataset.filter = 'all';
    const shooters = f.add('button', { class: 'filter-btn' }, f.main);
    shooters.dataset.filter = 'shooters';
    const heading = f.add('div', { class: 'section-header' }, f.main);
    const grid = f.add('div', { class: 'games-grid' }, f.main);
    grid.previousElementSibling = heading;
    const gta = f.add('div', { class: 'game-card' }, grid);
    Object.assign(gta.dataset, { search: 'Grand Theft Auto GTA', category: 'open-world sandbox' });
    const cod = f.add('div', { class: 'game-card' }, grid);
    Object.assign(cod.dataset, { search: 'Call of Duty COD', category: 'shooters' });
    const empty = f.add('div', { class: 'no-results' }, f.main);

    f.context.initSearch();
    assert.equal(status.textContent, '2 games shown');
    assert.equal(status.getAttribute('role'), 'status');
    assert.equal(status.getAttribute('aria-live'), 'polite');
    shooters.click();
    assert.equal(status.textContent, '1 game shown');
    assert.equal(gta.style.display, 'none');
    assert.equal(cod.style.display, '');
    assert.equal(all.getAttribute('aria-pressed'), 'false');
    assert.equal(shooters.getAttribute('aria-pressed'), 'true');

    search.value = 'GTA';
    search.emit('input');
    assert.equal(status.textContent, '0 games shown');
    assert.equal(empty.style.display, 'block');
    assert.equal(grid.style.display, 'none');
    assert.equal(heading.style.display, 'none');

    reset.click();
    assert.equal(search.value, '');
    assert.equal(f.document.activeElement, search);
    assert.equal(status.textContent, '2 games shown');
    assert.equal(empty.style.display, 'none');
    assert.equal(grid.style.display, '');
    assert.equal(heading.style.display, '');
    assert.equal(all.classList.contains('active'), true);
    assert.equal(all.getAttribute('aria-pressed'), 'true');
    assert.equal(shooters.classList.contains('active'), false);
    assert.equal(shooters.getAttribute('aria-pressed'), 'false');
});

test('legacy game searches still work without a count or reset control', () => {
    const f = fixture();
    const search = f.add('input', { id: 'gameSearch' }, f.main);
    search.value = '';
    const card = f.add('div', { class: 'game-card' }, f.main);
    Object.assign(card.dataset, { search: 'Team Fortress 2 TF2', category: 'pc' });
    const empty = f.add('div', { class: 'no-results' }, f.main);
    assert.doesNotThrow(() => f.context.initSearch());
    search.value = 'unmatched';
    search.emit('input');
    assert.equal(card.style.display, 'none');
    assert.equal(empty.style.display, 'block');
    search.value = 'tf2';
    search.emit('input');
    assert.equal(card.style.display, '');
    assert.equal(empty.style.display, 'none');
});

test('search accepts reordered words and accents while retaining exact update tokens',()=>{
    const f=fixture();
    const search=f.add('input',{id:'gameSearch'},f.main);search.value='';
    const card=f.add('div',{class:'game-card'},f.main);
    Object.assign(card.dataset,{search:'Pokémon GTA5 PS4 single-player 1.57',category:'console'});
    f.context.initSearch();
    for(const query of ['PS4 pokemon GTA5 1.57','POKÉMON—PS4','single player pokemon']){
        search.value=query;search.emit('input');assert.equal(card.style.display,'',query);
    }
    search.value='pokemon 1.58';search.emit('input');assert.equal(card.style.display,'none');
});

test('hero titles without data-text retain their child markup on all motion and viewport settings', () => {
    for (const mobile of [false, true]) {
        const f = fixture({ mobile });
        const title = f.add('h1', { class: 'hero-title' }, f.main);
        const emphasis = f.add('span', {}, title);
        Object.defineProperty(title, 'textContent', { get: () => 'Find your next game', set() { throw Error('Authored title was replaced'); } });
        assert.doesNotThrow(() => f.context.initHeroAnimations());
        assert.equal(title.children[0], emphasis);
    }
});

test('opted-in hero titles still show their full text immediately with reduced motion', () => {
    const f = fixture({ mobile: true });
    const title = f.add('h1', { class: 'hero-title', 'data-text': 'Welcome back' }, f.main);
    title.dataset.text = 'Welcome back';
    f.context.initHeroAnimations();
    assert.equal(title.textContent, 'Welcome back');
});

test('opted-in desktop hero titles retain the existing typing animation', () => {
    const f = fixture({ mobile: false });
    const title = f.add('h1', { class: 'hero-title', 'data-text': 'Welcome' }, f.main);
    title.dataset.text = 'Welcome';
    f.document.createTextNode = textContent => ({ textContent, parentElement: null });
    const timers = [];
    f.context.setTimeout = callback => timers.push(callback);
    f.context.initHeroAnimations();
    assert.equal(title.children[0].className, 'typing-cursor');
    assert.equal(timers.length, 1);
    while (timers.length) timers.shift()();
    assert.equal(title.children.map(child => child.textContent).join(''), 'Welcome|');
});
