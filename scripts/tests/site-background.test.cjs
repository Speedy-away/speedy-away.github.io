const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const scriptPath = path.join(__dirname, '../../assets/site-background.js');
const storageKey = 'whatwhatboy.backgroundPaused';
const legacyStorageKey = 'whatwhatboy.home.backgroundPaused';
const palettes = {
    dark: ['144, 144, 150', '93, 93, 101', '173, 173, 179'],
    emerald: ['52, 211, 153', '45, 212, 191', '125, 211, 252'],
    cobalt: ['96, 165, 250', '56, 189, 248', '129, 140, 248'],
    rose: ['251, 113, 133', '251, 146, 60', '253, 164, 175'],
    ice: ['34, 211, 238', '125, 211, 252', '148, 163, 184'],
    violet: ['167, 139, 250', '192, 132, 252', '129, 140, 248'],
    amber: ['251, 191, 36', '251, 146, 60', '253, 230, 138']
};

// Exercise lifecycle, integration and finite drawing geometry. Native rendering
// and appearance are verified separately in the browser.
function fixture({ reduced = false, noContext = false, contextThrows = false,
    storage = new Map(), storageDenied = false, width = 1366, height = 768,
    theme = 'emerald', existing = false, customColors } = {}) {
    const frames = [];
    const gradients = [];
    let frame;
    const finite = values => values.forEach(value => assert.ok(Number.isFinite(value), 'Drawing coordinates must remain finite'));
    const gradient = () => {
        const stops = [];
        gradients.push(stops);
        return { addColorStop(offset, color) { finite([offset]); stops.push(color); } };
    };
    const context = {
        clearRect(...values) { finite(values); frame = { geometry: [], strokes: 0, fills: [] }; frames.push(frame); },
        setTransform(...values) { finite(values); },
        createLinearGradient(...values) { finite(values); return gradient(); },
        createRadialGradient(...values) { finite(values); return gradient(); },
        beginPath() {}, closePath() {}, setLineDash() {}, save() {}, restore() {},
        translate(...values) { finite(values); }, rotate(...values) { finite(values); }, scale(...values) { finite(values); },
        moveTo(x, y) { finite([x, y]); frame?.geometry.push(x, y); },
        lineTo(...values) { finite(values); },
        quadraticCurveTo(...values) { finite(values); },
        bezierCurveTo(...values) { finite(values); },
        arc(...values) { finite(values); },
        stroke() { if (frame) frame.strokes++; },
        fill() { frame?.fills.push(this.fillStyle); },
        fillRect(...values) { finite(values); frame?.fills.push(this.fillStyle); }
    };

    class Element {
        constructor(tag) {
            this.tagName = tag.toUpperCase(); this.attributes = new Map(); this.dataset = {};
            this.children = []; this.parentElement = null; this.listeners = new Map();
            this.style = { setProperty(name, value) { this[name] = value; }, getPropertyValue(name) { return this[name] || ''; } };
            this.hidden = false; this.textContent = '';
            if (tag === 'canvas') {
                this.clientWidth = width; this.clientHeight = height;
                this.getContext = () => {
                    if (contextThrows) throw Error('Canvas unavailable');
                    return noContext ? null : context;
                };
            }
        }
        get id() { return this.getAttribute('id') || ''; }
        set id(value) { this.setAttribute('id', value); }
        get className() { return this.getAttribute('class') || ''; }
        set className(value) { this.setAttribute('class', value); }
        get classList() { return {
            add: (...values) => { this.className = [...new Set(this.className.split(/\s+/).filter(Boolean).concat(values))].join(' '); },
            contains: value => this.className.split(/\s+/).includes(value),
            remove: (...values) => { this.className = this.className.split(/\s+/).filter(value => !values.includes(value)).join(' '); },
            toggle: (value, force) => {
                const selected = force === undefined ? !this.classList.contains(value) : Boolean(force);
                if (selected) this.classList.add(value);
                else this.classList.remove(value);
                return selected;
            }
        }; }
        setAttribute(name, value) {
            this.attributes.set(name, String(value));
            if (name.startsWith('data-')) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, char) => char.toUpperCase())] = String(value);
        }
        getAttribute(name) { return this.attributes.get(name) ?? null; }
        hasAttribute(name) { return this.attributes.has(name); }
        removeAttribute(name) { this.attributes.delete(name); }
        appendChild(child) {
            child.parentElement?.removeChild(child);
            this.children.push(child); child.parentElement = this; return child;
        }
        append(...children) { children.forEach(child => this.appendChild(child)); }
        prepend(child) { this.insertBefore(child, this.firstChild); }
        insertBefore(child, reference) {
            if (!reference) return this.appendChild(child);
            child.parentElement?.removeChild(child);
            this.children.splice(this.children.indexOf(reference), 0, child); child.parentElement = this; return child;
        }
        removeChild(child) { this.children = this.children.filter(node => node !== child); child.parentElement = null; return child; }
        remove() { this.parentElement?.removeChild(this); }
        get firstChild() { return this.children[0] || null; }
        contains(node) { return this === node || this.children.some(child => child.contains(node)); }
        matches(selector) {
            return selector.split(',').some(part => {
                const value = part.trim();
                if (value.startsWith('#')) return this.id === value.slice(1);
                if (value.startsWith('.')) return this.classList.contains(value.slice(1));
                return value === '*' || value.toUpperCase() === this.tagName;
            });
        }
        querySelectorAll(selector) { return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]); }
        querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
        addEventListener(name, callback) { if (!this.listeners.has(name)) this.listeners.set(name, []); this.listeners.get(name).push(callback); }
        emit(name, details = {}) { for (const callback of this.listeners.get(name) || []) callback({ type: name, target: this, ...details }); }
    }

    const document = new Element('document');
    document.documentElement = document.appendChild(new Element('html'));
    document.head = document.documentElement.appendChild(new Element('head'));
    document.body = document.documentElement.appendChild(new Element('body'));
    document.body.classList.add('site-atmosphere');
    document.body.setAttribute('data-background-theme', theme);
    document.createElement = tag => new Element(tag);
    document.getElementById = id => document.querySelector('#' + id);
    document.hidden = false;
    document.readyState = 'complete';
    if (existing) {
        const surface = document.body.appendChild(new Element('div')); surface.id = 'site-flow-background';
        const canvas = surface.appendChild(new Element('canvas')); canvas.id = 'site-flow-canvas';
        const toggle = document.body.appendChild(new Element('button')); toggle.id = 'site-motion-toggle'; toggle.hidden = true;
    }
    const preference = new Element('media-query'); preference.matches = reduced;
    const rafs = new Map(), timers = new Map();
    let sequence = 0;
    const requestAnimationFrame = callback => { const id = ++sequence; rafs.set(id, callback); return id; };
    const cancelAnimationFrame = id => rafs.delete(id);
    const setTimeout = callback => { const id = ++sequence; timers.set(id, callback); return id; };
    const clearTimeout = id => timers.delete(id);
    const getComputedStyle = () => ({ getPropertyValue(name) {
        const colors = customColors || palettes[document.body.dataset.backgroundTheme] || [];
        return colors[{ '--flow-color-a': 0, '--flow-color-b': 1, '--flow-color-c': 2 }[name]] || '';
    } });
    const window = new Element('window');
    Object.assign(window, { innerWidth: width, innerHeight: height, devicePixelRatio: 3,
        location: { pathname: '/games/gta/' }, matchMedia: () => preference,
        getComputedStyle, requestAnimationFrame, cancelAnimationFrame, setTimeout, clearTimeout });
    const sandbox = vm.createContext({
        document, window, getComputedStyle, requestAnimationFrame, cancelAnimationFrame, setTimeout, clearTimeout,
        localStorage: {
            getItem(key) { if (storageDenied) throw Error('Storage denied'); return storage.get(key) ?? null; },
            setItem(key, value) { if (storageDenied) throw Error('Storage denied'); storage.set(key, value); }
        },
        performance: { now: () => 0 }
    });
    const run = () => vm.runInContext(fs.readFileSync(scriptPath, 'utf8'), sandbox, { filename: 'site-background.js' });
    run();
    return {
        document, window, preference, storage, frames, gradients, rafs, timers, run,
        get canvas() { return document.getElementById('site-flow-canvas'); },
        get surface() { return document.getElementById('site-flow-background'); },
        get toggle() { return document.getElementById('site-motion-toggle'); },
        tick(now) { const callbacks = [...rafs.values()]; rafs.clear(); callbacks.forEach(callback => callback(now)); },
        flushTimers() { const callbacks = [...timers.values()]; timers.clear(); callbacks.forEach(callback => callback()); }
    };
}

test('a page without background markup receives one decorative canvas and accessible control', () => {
    const f = fixture();
    assert.ok(f.canvas);
    assert.equal(f.surface.getAttribute('aria-hidden'), 'true');
    assert.equal(f.toggle.getAttribute('type'), 'button');
    assert.equal(f.toggle.getAttribute('aria-label'), 'Pause background animation');
    const previousSurface = f.surface, previousCanvas = f.canvas;
    f.run();
    assert.equal(f.surface, previousSurface);
    assert.equal(f.canvas, previousCanvas);
    assert.equal(f.document.querySelectorAll('#site-flow-background').length, 1);
    assert.equal(f.document.querySelectorAll('#site-motion-toggle').length, 1);
    assert.equal(f.rafs.size, 1);
});

test('existing background elements are reused without duplicate animation loops', () => {
    const f = fixture({ existing: true });
    assert.equal(f.document.querySelectorAll('#site-flow-canvas').length, 1);
    f.run();
    assert.equal(f.document.querySelectorAll('#site-flow-canvas').length, 1);
    assert.equal(f.rafs.size, 1);
});

test('reduced motion draws a still image and resizing never starts a frame loop', () => {
    const f = fixture({ reduced: true });
    assert.ok(f.frames.at(-1).strokes > 0);
    assert.equal(f.surface.dataset.motion, 'reduced');
    assert.equal(f.document.body.classList.contains('site-motion-paused'), true);
    assert.equal(f.toggle.hidden, true);
    assert.equal(f.rafs.size, 0);
    f.window.emit('resize'); f.flushTimers();
    assert.equal(f.rafs.size, 0);
});

test('successive animation frames change finite geometry while retaining one frame loop', () => {
    const f = fixture();
    const initial = f.frames.at(-1).geometry;
    f.tick(0); f.tick(45);
    assert.notDeepEqual(f.frames.at(-1).geometry, initial);
    assert.equal(f.rafs.size, 1);
    f.tick(90);
    assert.equal(f.rafs.size, 1);
});

test('hidden tabs and page restoration stop and resume one loop without drawing while hidden', () => {
    const f = fixture();
    f.document.hidden = true; f.document.emit('visibilitychange');
    assert.equal(f.rafs.size, 0);
    const count = f.frames.length;
    f.tick(1000); assert.equal(f.frames.length, count);
    f.document.hidden = false; f.document.emit('visibilitychange'); f.document.emit('visibilitychange');
    assert.equal(f.rafs.size, 1);
    f.window.emit('pagehide'); assert.equal(f.rafs.size, 0);
    f.window.emit('pageshow'); f.window.emit('pageshow');
    assert.equal(f.rafs.size, 1);
});

test('pause preference persists across pages and resumes through the control', () => {
    const storage = new Map();
    const first = fixture({ storage }); first.toggle.emit('click');
    assert.equal(first.rafs.size, 0);
    assert.equal(first.document.body.classList.contains('site-motion-paused'), true);
    assert.equal(storage.get(storageKey), 'true');
    const second = fixture({ storage, theme: 'rose' });
    assert.equal(second.rafs.size, 0);
    assert.equal(second.surface.dataset.motion, 'paused');
    assert.equal(second.toggle.getAttribute('aria-label'), 'Resume background animation');
    second.toggle.emit('click');
    assert.equal(second.rafs.size, 1);
    assert.equal(second.document.body.classList.contains('site-motion-paused'), false);
    assert.equal(storage.get(storageKey), 'false');
});

test('legacy homepage pause is honoured and the newer site preference takes precedence', () => {
    const legacy = fixture({ storage: new Map([[legacyStorageKey, 'true']]) });
    assert.equal(legacy.rafs.size, 0);
    const global = fixture({ storage: new Map([[legacyStorageKey, 'true'], [storageKey, 'false']]) });
    assert.equal(global.rafs.size, 1);
});

test('live reduced-motion preference changes preserve manual pause', () => {
    const f = fixture();
    f.preference.matches = true; f.preference.emit('change');
    assert.equal(f.rafs.size, 0); assert.equal(f.toggle.hidden, true);
    f.preference.matches = false; f.preference.emit('change');
    assert.equal(f.rafs.size, 1); assert.equal(f.toggle.hidden, false);
    f.toggle.emit('click');
    f.preference.matches = true; f.preference.emit('change');
    f.preference.matches = false; f.preference.emit('change');
    assert.equal(f.rafs.size, 0);
});

test('unavailable canvas or storage cannot break page initialization', () => {
    for (const options of [{ noContext: true }, { contextThrows: true }]) {
        const f = fixture(options);
        assert.equal(f.rafs.size, 0);
        assert.equal(f.toggle?.hidden ?? true, true);
    }
    const denied = fixture({ storageDenied: true });
    assert.equal(denied.rafs.size, 1);
    assert.doesNotThrow(() => denied.toggle.emit('click'));
    assert.equal(denied.rafs.size, 0);
});

test('desktop density is capped and phone resizing remains bounded with one loop', () => {
    const f = fixture();
    assert.ok(f.canvas.width <= Math.ceil(1366 * 1.5));
    f.canvas.clientWidth = f.window.innerWidth = 390;
    f.canvas.clientHeight = f.window.innerHeight = 844;
    f.window.emit('resize'); f.window.emit('resize');
    assert.equal(f.timers.size, 1);
    f.flushTimers();
    assert.ok(f.canvas.width <= Math.ceil(390 * 1.25));
    assert.ok(f.canvas.height <= Math.ceil(844 * 1.25));
    assert.equal(f.rafs.size, 1);
    f.tick(0); f.tick(50);
    assert.ok(f.frames.at(-1).geometry.length > 0);
});

test('default and stored automatic palettes stay dark across page families', () => {
    for (const theme of [...Object.keys(palettes), 'unknown']) {
        const f = fixture({ theme, reduced: true, storage: new Map([['whatwhatboy.backgroundPalette', 'auto']]) });
        assert.equal(f.document.body.getAttribute('data-background-theme'), 'dark');
        const select = f.document.getElementById('site-background-palette');
        assert.equal(select.value, 'auto');
        assert.equal(select.children[0].textContent, 'Dark (default)');
        assert.ok(f.gradients.flat().every(color => !/NaN|undefined|null/.test(color)));
    }
});

test('optional colour palettes remain distinct and use valid drawing colours', () => {
    const signatures = [];
    for (const theme of Object.keys(palettes).filter(theme => theme !== 'dark')) {
        const f = fixture({ theme, reduced: true, storage: new Map([['whatwhatboy.backgroundPalette', theme]]) });
        const colors = f.gradients.flat();
        assert.ok(colors.length > 0);
        assert.ok(colors.every(color => typeof color === 'string' && !/NaN|undefined|null/.test(color)), 'Every gradient uses valid colour components');
        signatures.push(colors.join('|'));
    }
    assert.equal(new Set(signatures).size, 6, 'The six optional colour choices remain distinct');
});

test('colour choices persist between pages and Dark default restores the monochrome palette', () => {
    const storage = new Map([['whatwhatboy.backgroundPalette', 'violet']]);
    const first = fixture({ storage, theme: 'cobalt' });
    const select = first.document.getElementById('site-background-palette');
    assert.equal(select.value, 'violet');
    assert.equal(first.document.body.getAttribute('data-background-theme'), 'violet');
    const before = first.gradients.flat().join('|');
    select.value = 'rose'; select.emit('change');
    assert.equal(storage.get('whatwhatboy.backgroundPalette'), 'rose');
    assert.equal(first.document.body.getAttribute('data-background-theme'), 'rose');
    assert.notEqual(first.gradients.flat().join('|'), before);
    assert.equal(first.rafs.size, 1, 'Selecting a colour must not create another frame loop');

    const second = fixture({ storage, theme: 'ice' });
    const restoredSelect = second.document.getElementById('site-background-palette');
    assert.equal(restoredSelect.value, 'rose');
    assert.equal(second.document.body.getAttribute('data-background-theme'), 'rose');
    second.toggle.emit('click');
    restoredSelect.value = 'auto'; restoredSelect.emit('change');
    assert.equal(second.document.body.getAttribute('data-background-theme'), 'dark');
    assert.equal(storage.get('whatwhatboy.backgroundPalette'), 'auto');
    assert.equal(second.rafs.size, 0, 'Changing colour must preserve manual pause');
});

test('invalid CSS colour variables fall back to usable drawing colours', () => {
    const f = fixture({ customColors: ['not-a-colour', 'url(bad)', ''], reduced: true });
    const colors = f.gradients.flat();
    assert.ok(colors.length > 0);
    assert.ok(colors.every(color => /^rgba\(\d+,\s*\d+,\s*\d+,\s*[\d.]+\)$/.test(color)));
});

test('large displays cannot allocate an unbounded canvas backing store', () => {
    const f = fixture({ width: 3840, height: 2160 });
    assert.ok(f.canvas.width * f.canvas.height <= 3_005_000, 'Rounding aside, the backing store must respect its three-million-pixel budget');
    assert.ok(f.frames.at(-1).geometry.length > 0);
});
