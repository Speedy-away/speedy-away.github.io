/*!
 * Scooby site i18n — runtime translation + language selector.
 *
 * Drop this one tag into any page and it handles the rest:
 *   <script src="/languages/i18n.js"></script>
 *
 * How it works: the page stays authored in English. Dictionaries map the
 * English source string to a translation, so no per-element markup is needed
 * and new pages are covered automatically once their strings are in the
 * dictionary. See TRANSLATIONS.md.
 */
(function () {
  'use strict';

  if (window.__scoobyI18n) return;              // already loaded on this page

  var DEFAULT_LANG = 'en';
  var STORAGE_KEY = 'scooby.lang';
  // Which corner the floating selector pins to when there is no navbar to sit in.
  var FLOAT_SIDE = 'right';

  var LANGS = [
    { code: 'en', label: 'EN', native: 'English'    },
    { code: 'es', label: 'ES', native: 'Español'    },
    { code: 'pt', label: 'PT', native: 'Português'  },
    { code: 'fr', label: 'FR', native: 'Français'   },
    { code: 'de', label: 'DE', native: 'Deutsch'    },
    { code: 'ru', label: 'RU', native: 'Русский'    },
    { code: 'tr', label: 'TR', native: 'Türkçe'     },
    { code: 'pl', label: 'PL', native: 'Polski'     },
    { code: 'it', label: 'IT', native: 'Italiano'   },
    { code: 'zh', label: 'ZH', native: '简体中文'    },
    { code: 'ja', label: 'JA', native: '日本語'      },
    { code: 'ko', label: 'KO', native: '한국어'      },
    { code: 'th', label: 'TH', native: 'ไทย'        },
    { code: 'vi', label: 'VI', native: 'Tiếng Việt' },
    { code: 'id', label: 'ID', native: 'Indonesia'  },
    { code: 'hi', label: 'HI', native: 'हिन्दी'       },
    { code: 'sr', label: 'SR', native: 'Српски'     },
    { code: 'nl', label: 'NL', native: 'Nederlands' },
    { code: 'ka', label: 'KA', native: 'ქართული'    },
    // Right-to-left: these also flip <html dir> and mirror the selector.
    { code: 'ar', label: 'AR', native: 'العربية', rtl: true },
    { code: 'he', label: 'HE', native: 'עברית',  rtl: true }
  ];
  var CODES = LANGS.map(function (l) { return l.code; });

  // Resolve sibling dictionaries from this script's own URL so the code works
  // at any directory depth, and over file:// as well as http://.
  var DICTIONARY_QUERY = '';
  var BASE = (function () {
    var s = document.currentScript;
    if (!s) {
      var all = document.getElementsByTagName('script');
      for (var i = all.length - 1; i >= 0; i--) {
        if (/i18n\.js(\?|$)/.test(all[i].src)) { s = all[i]; break; }
      }
    }
    var version = s && s.src && s.src.match(/[?&]v=([^&#]+)/);
    if (version) DICTIONARY_QUERY = '?v=' + version[1];
    return s && s.src ? s.src.replace(/[^/]*$/, '') : '/languages/';
  })();

  // ---------------------------------------------------------------- state ---

  var dicts = { en: {} };        // lang -> { english: translated }
  var current = DEFAULT_LANG;
  var textOriginals = new WeakMap();   // text node -> original English
  var textRendered = new WeakMap();    // distinguish app updates from our own translations
  var attrOriginals = new WeakMap();   // element   -> { attr: original }
  var attrRendered = new WeakMap();
  var templateCache = new WeakMap();
  var titleOriginal = null;
  var titleRendered = null;
  var loadErrorNode = null;
  var observer = null;
  var applying = false;

  // ------------------------------------------------------------ preference ---

  function stored() {
    try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
  }
  function store(code) {
    try { localStorage.setItem(STORAGE_KEY, code); } catch (e) { /* private mode */ }
  }

  function detect() {
    var pageLanguage = document.documentElement.getAttribute("data-host-locale");
    if (CODES.indexOf(pageLanguage) !== -1) {store(pageLanguage);return pageLanguage;}
    var saved = stored();
    if (saved && CODES.indexOf(saved) !== -1) return saved;
    var navLangs = navigator.languages || [navigator.language || ''];
    for (var i = 0; i < navLangs.length; i++) {
      var base = String(navLangs[i]).toLowerCase().split('-')[0];
      if (CODES.indexOf(base) !== -1) return base;
    }
    return DEFAULT_LANG;
  }

  // ------------------------------------------------- anti-flash of English ---
  // Only hide content when we already know a non-English language is coming,
  // so English visitors never pay for this.

  var initial = detect();

  function hideWhileLoading() {
    if (initial === DEFAULT_LANG) return;
    var st = document.createElement('style');
    st.id = 'i18n-cloak';
    st.textContent = 'html.i18n-loading body{visibility:hidden!important}';
    (document.head || document.documentElement).appendChild(st);
    document.documentElement.classList.add('i18n-loading');
    // Never leave the page blank if a dictionary fails to arrive.
    setTimeout(reveal, 1800);
  }
  function reveal() {
    document.documentElement.classList.remove('i18n-loading');
  }

  // ------------------------------------------------------- dictionary load ---

  var pending = {};

  function loadDict(code, cb) {
    if (code === DEFAULT_LANG || dicts[code]) return cb(null);
    if (pending[code]) return pending[code].push(cb);
    pending[code] = [cb];

    var s = document.createElement('script');
    s.src = BASE + code + '.js' + DICTIONARY_QUERY;
    s.async = true;
    var finished = false;
    var timer = setTimeout(function () { finish(new Error('dictionary ' + code + ' timed out')); }, 12000);
    function finish(err) {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      if (err && s.parentNode) s.parentNode.removeChild(s);
      flush(code, err);
    }
    s.onload = function () { finish(dicts[code] ? null : new Error('dictionary ' + code + ' did not register')); };
    s.onerror = function () { finish(new Error('dictionary ' + code + ' failed to load')); };
    (document.head || document.documentElement).appendChild(s);
  }

  function flush(code, err) {
    var q = pending[code] || [];
    delete pending[code];
    q.forEach(function (fn) { try { fn(err); } catch (e) {} });
  }

  // Dictionary files call this.
  function register(code, table) {
    dicts[code] = table || {};
    if (pending[code]) flush(code, null);
  }

  // ------------------------------------------------------------ traversal ---

  var SKIP_TAGS = { SCRIPT: 1, STYLE: 1, CODE: 1, PRE: 1, TEXTAREA: 1, NOSCRIPT: 1, SVG: 1, CANVAS: 1 };
  var ATTRS = ['placeholder', 'title', 'alt', 'aria-label', 'aria-description', 'aria-valuetext', 'data-tooltip', 'value'];

  function skipped(el) {
    for (var n = el; n && n.nodeType === 1; n = n.parentNode) {
      if (SKIP_TAGS[n.tagName]) return true;
      if (n.hasAttribute && n.hasAttribute('data-i18n-skip')) return true;
      if (n.getAttribute && n.getAttribute('translate') === 'no') return true;
      if (n.classList && n.classList.contains('notranslate')) return true;
    }
    return false;
  }

  var norm = function (s) { return s.replace(/\s+/g, ' ').trim(); };

  function templates(table) {
    var cached = templateCache.get(table);
    if (cached) return cached;
    cached = [];
    Object.keys(table).forEach(function (key) {
      var names = [], pattern = '', cursor = 0, match;
      var marker = /\{([A-Za-z_][A-Za-z0-9_]*)\}/g;
      while ((match = marker.exec(key))) {
        pattern += key.slice(cursor, match.index).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        var name = match[1];
        names.push(name);
        if (/^(?:count|total|shown|bytes|size|number)$/.test(name)) pattern += '([0-9][0-9.,]*)';
        else if (name === 'platform') pattern += '(PS4(?:\\s*\\/\\s*PS5)?|PS5|PS3|PS Vita|Xbox 360|Nintendo Switch|Steam Deck|PC)';
        else if (name === 'filename') pattern += '([^\\r\\n<>]+\\.(?:pkg|fpkg|elf|bin|prx|sprx|self|zip|rar|7z|iso|json|vpk|pup|jar|csc|gsc|lua|txt|ini|xml))';
        else pattern += '([^\\r\\n]+?)';
        cursor = marker.lastIndex;
      }
      if (!names.length || typeof table[key] !== 'string') return;
      pattern += key.slice(cursor).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      cached.push({pattern: new RegExp('^' + pattern + '$'), names: names, value: table[key], specificity: key.replace(marker, '').length});
    });
    cached.sort(function (a, b) { return b.specificity - a.specificity; });
    templateCache.set(table, cached);
    return cached;
  }

  function localizedDate(value) {
    if (current === DEFAULT_LANG || typeof Intl === 'undefined' || typeof Intl.DateTimeFormat !== 'function') return value;
    var match = /^(0?[1-9]|[12][0-9]|3[01]) (January|February|March|April|May|June|July|August|September|October|November|December) ([12][0-9]{3})$/.exec(String(value));
    if (!match) return value;
    var months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    var day = Number(match[1]), month = months.indexOf(match[2]), year = Number(match[3]);
    var date = new Date(Date.UTC(year, month, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month || date.getUTCDate() !== day) return value;
    try {
      return new Intl.DateTimeFormat(current, {day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'}).format(date);
    } catch (e) { return value; }
  }

  function interpolate(value, values, localizeDates) {
    return value.replace(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g, function (marker, name) {
      if (!Object.prototype.hasOwnProperty.call(values, name)) return marker;
      var result = String(values[name]);
      return localizeDates && name === 'date' ? localizedDate(result) : result;
    });
  }

  function lookup(source, table, values) {
    var key = norm(source);
    if (Object.prototype.hasOwnProperty.call(table, key) && typeof table[key] === 'string') {
      return values ? interpolate(table[key], values, key.indexOf('{date}') !== -1) : table[key];
    }
    if (values) return interpolate(source, values);
    var patterns = templates(table);
    for (var i = 0; i < patterns.length; i++) {
      var rule = patterns[i], match = rule.pattern.exec(key);
      if (!match) continue;
      var captures = {}, valid = true;
      for (var j = 0; j < rule.names.length; j++) {
        var name = rule.names[j], value = match[j + 1];
        if (Object.prototype.hasOwnProperty.call(captures, name) && captures[name] !== value) { valid = false; break; }
        captures[name] = value;
      }
      if (valid) return interpolate(rule.value, captures, rule.names.indexOf('date') !== -1);
    }
    return undefined;
  }

  function translateText(node, table) {
    if (skipped(node.parentNode)) return;
    var original = textOriginals.get(node);
    if(original === undefined && node.parentNode && node.parentNode.getAttribute){var authored=node.parentNode.getAttribute("data-i18n-source");if(authored!==null){original=authored;textOriginals.set(node,original);textRendered.set(node,node.nodeValue);}}
    var value = node.nodeValue;
    if (original === undefined || value !== textRendered.get(node) && value !== original) {
      original = node.nodeValue;
      textOriginals.set(node, original);
      if (!norm(original) || !/[A-Za-z]/.test(original)) { textRendered.set(node, original); return; }
    }
    var key = norm(original);
    var hit = lookup(key, table);
    if (hit === undefined) {
      textRendered.set(node, original);
      if (node.nodeValue !== original) node.nodeValue = original;   // reverting
      return;
    }
    // Keep the surrounding whitespace the layout may depend on.
    var lead = (original.match(/^\s*/) || [''])[0];
    var trail = (original.match(/\s*$/) || [''])[0];
    var next = lead + hit + trail;
    textRendered.set(node, next);
    if (node.nodeValue !== next) node.nodeValue = next;
  }

  function translateAttrs(el, table, attrs) {
    if (skipped(el)) return;
    var saved = attrOriginals.get(el);
    var rendered = attrRendered.get(el);
    attrs = attrs || ATTRS;
    for (var i = 0; i < attrs.length; i++) {
      var a = attrs[i];
      if (a === 'value' && (el.tagName !== 'INPUT' || !/^(?:button|submit|reset)$/i.test(el.getAttribute('type') || ''))) continue;
      if (!el.hasAttribute(a)) continue;
      if (!saved) { saved = {}; attrOriginals.set(el, saved); }
      if (!rendered) { rendered = {}; attrRendered.set(el, rendered); }
      var value = el.getAttribute(a);
      if (saved[a] === undefined || value !== rendered[a] && value !== saved[a]) saved[a] = value;
      var key = norm(saved[a]);
      if (!key) continue;
      var hit = lookup(key, table);
      var next = hit === undefined ? saved[a] : hit;
      rendered[a] = next;
      if (value !== next) el.setAttribute(a, next);
    }
  }

  function apply(root, table) {
    // Text nodes.
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
    var batch = [], n;
    while ((n = walker.nextNode())) batch.push(n);
    for (var i = 0; i < batch.length; i++) translateText(batch[i], table);

    // Attributes.
    var sel = ATTRS.map(function (a) { return '[' + a + ']'; }).join(',');
    var els = root.querySelectorAll ? root.querySelectorAll(sel) : [];
    for (var j = 0; j < els.length; j++) translateAttrs(els[j], table);
    if (root.nodeType === 1 && root.matches && root.matches(sel)) translateAttrs(root, table);
  }

  function applyMeta(table) {
    if (titleOriginal === null || document.title !== titleRendered && document.title !== titleOriginal) titleOriginal = document.title;
    var t = lookup(titleOriginal, table);
    titleRendered = t === undefined ? titleOriginal : t;
    if (document.title !== titleRendered) document.title = titleRendered;

    var metas = document.querySelectorAll('meta[name="keywords"],meta[property="og:image:alt"],meta[name="twitter:image:alt"],meta[name="description"],meta[property="og:title"],meta[property="og:description"],meta[name="twitter:title"],meta[name="twitter:description"]');
    for (var i = 0; i < metas.length; i++) translateAttrs(metas[i], table, ['content']);
    var schemaNode=document.querySelector('#site-page-schema');
    if(schemaNode)try{var schema=JSON.parse(schemaNode.textContent),page=(schema['@graph']||[]).filter(function(item){return item['@type']==='WebPage';})[0],description=document.querySelector('meta[name="description"]'),keywords=document.querySelector('meta[name="keywords"]');if(page){page.name=document.title;page.inLanguage=current;if(description)page.description=description.getAttribute('content');if(keywords)page.keywords=keywords.getAttribute('content');schemaNode.textContent=JSON.stringify(schema).replace(/</g,'\\u003c');}}catch(_){}
    var locale=document.querySelector('meta[property="og:locale"]'),localeMap={en:'en_GB',es:'es_ES',pt:'pt_BR',fr:'fr_FR',de:'de_DE',ru:'ru_RU',tr:'tr_TR',pl:'pl_PL',it:'it_IT',zh:'zh_CN',ja:'ja_JP',ko:'ko_KR',th:'th_TH',vi:'vi_VN',id:'id_ID',hi:'hi_IN',sr:'sr_RS',nl:'nl_NL',ka:'ka_GE',ar:'ar_AR',he:'he_IL'};if(locale)locale.setAttribute('content',localeMap[current]||current);
  }

  function finishApplying() {
    applying = false;
    if (observer) observer.takeRecords();
  }

  function refresh(root) {
    if(current===DEFAULT_LANG)return;
    var table = dicts[current] || {};
    applying = true;
    try {
      if (root && root.nodeType === 3) translateText(root, table);
      else apply(root || document.body || document.documentElement, table);
      applyMeta(table);
    } finally { finishApplying(); }
  }

  // ------------------------------------------------------- dynamic content ---

  function startObserver() {
    if ((window.WWB_HOST_CONSOLE === true || window.WhatsiteConsoleLite && window.WhatsiteConsoleLite.enabled) && current === DEFAULT_LANG) {
      if (observer) observer.disconnect();
      observer = null;
      return;
    }
    if (observer || !window.MutationObserver) return;
    observer = new MutationObserver(function (records) {
      if (applying || current === DEFAULT_LANG) return;
      var table = dicts[current] || {};
      applying = true;
      try {
        for (var i = 0; i < records.length; i++) {
          var record = records[i];
          if (record.type === 'characterData') {
            if (record.target.parentNode && record.target.parentNode.tagName === 'TITLE') applyMeta(table);
            else translateText(record.target, table);
          } else if (record.type === 'attributes') {
            if (record.target.tagName === 'META' && record.attributeName === 'content') applyMeta(table);
            else if (record.attributeName === 'translate' || record.attributeName === 'data-i18n-skip') apply(record.target, table);
            else translateAttrs(record.target, table);
          } else {
            if (record.target && record.target.tagName === 'TITLE') { applyMeta(table); continue; }
            var added = record.addedNodes || [];
            for (var j = 0; j < added.length; j++) {
              var node = added[j];
              if (node.nodeType === 3) translateText(node, table);
              else if (node.nodeType === 1) {
                apply(node, table);
                if (node.tagName === 'META' || node.tagName === 'TITLE') applyMeta(table);
              }
            }
          }
        }
      } finally { finishApplying(); }
    });
    observer.observe(document.documentElement, { childList: true, characterData: true, attributes: true, attributeFilter: ATTRS.concat(['content', 'translate', 'data-i18n-skip']), subtree: true });
  }

  // ------------------------------------------------------------- switching ---

  var requestSeq = 0;

  function setLang(code, opts) {
    opts = opts || {};
    var hostSource=document.documentElement.getAttribute('data-host-source');
    if(!opts.silent && hostSource && CODES.indexOf(code)!==-1 && code!==current){store(code);window.location.href=(code===DEFAULT_LANG?'':'/'+code)+hostSource+(window.location.search||'')+(window.location.hash||'');return;}
    if (CODES.indexOf(code) === -1) code = DEFAULT_LANG;

    // Dictionaries load over the network, so a slow one must never overwrite a
    // newer choice made while it was still in flight.
    var mySeq = ++requestSeq;

    loadDict(code, function (err) {
      if (mySeq !== requestSeq) return;         // superseded by a later switch
      if (err) {
        if (!loadErrorNode) {
          loadErrorNode = document.createElement('div');
          loadErrorNode.className = 'i18n-load-error';
          loadErrorNode.setAttribute('role', 'alert');
          loadErrorNode.setAttribute('data-i18n-skip', '');
          (document.body || document.documentElement).appendChild(loadErrorNode);
        }
        var message = 'Unable to load this language. Please try again.';
        loadErrorNode.textContent = lookup(message, dicts[current] || {}) || message;
        syncUI();
        reveal();
        return;
      }
      if (loadErrorNode && loadErrorNode.parentNode) loadErrorNode.parentNode.removeChild(loadErrorNode);
      loadErrorNode = null;
      current = code;
      var table = dicts[code] || {};
      applying = true;
      try {
        apply(document.body || document.documentElement, table);
        applyMeta(table);
      } finally { finishApplying(); }

      document.documentElement.setAttribute('lang', code);
      // Right-to-left scripts need the whole document mirrored, not just translated.
      var meta = LANGS.filter(function (l) { return l.code === code; })[0];
      document.documentElement.setAttribute('dir', meta && meta.rtl ? 'rtl' : 'ltr');
      if (!opts.silent) store(code);
      syncUI();
      reveal();
      startObserver();

      try {
        window.dispatchEvent(new CustomEvent('scooby:langchange', { detail: { lang: code, userInitiated: !opts.silent } }));
      } catch (e) {}
    });
  }

  // -------------------------------------------------------------- selector ---

  var CSS = [
    '.i18n-load-error{position:fixed;inset-inline-end:16px;bottom:20px;z-index:1300;max-width:calc(100vw - 32px);padding:12px 16px;border:1px solid rgba(255,255,255,.25);border-radius:10px;background:#17191e;color:#fff;font-size:.9rem}',
    '.i18n-switcher{position:relative;display:inline-flex;flex-shrink:0;font-family:inherit;z-index:1200}',
    '.i18n-switcher *{box-sizing:border-box}',
    '.i18n-toggle{display:inline-flex;align-items:center;gap:7px;padding:7px 11px;border-radius:50px;',
    'border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.04);color:#e9e9f1;',
    'font-family:inherit;font-size:.82rem;font-weight:600;letter-spacing:.02em;cursor:pointer;',
    'line-height:1;transition:background .18s,border-color .18s,color .18s;white-space:nowrap}',
    '.i18n-toggle:hover{background:rgba(255,255,255,.09);border-color:rgba(255,255,255,.28);color:#fff}',
    '.i18n-toggle:focus-visible{outline:2px solid #34d399;outline-offset:2px}',
    '.i18n-toggle svg{width:15px;height:15px;flex-shrink:0;stroke:currentColor;fill:none;stroke-width:2}',
    '.i18n-toggle .i18n-caret{width:11px;height:11px;opacity:.65;transition:transform .2s}',
    '.i18n-switcher.open .i18n-toggle .i18n-caret{transform:rotate(180deg)}',
    '.i18n-switcher.open .i18n-toggle{background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.3);color:#fff}',
    /* Capped so a long language list scrolls instead of running off-screen. */
    '.i18n-menu{position:absolute;top:calc(100% + 9px);left:0;min-width:186px;margin:0;padding:6px;',
    'max-height:min(70vh,520px);overflow-y:auto;overscroll-behavior:contain;',
    'list-style:none;background:#111114;border:1px solid rgba(255,255,255,.13);border-radius:13px;',
    'box-shadow:0 18px 48px rgba(0,0,0,.62);opacity:0;visibility:hidden;transform:translateY(-6px);',
    'transition:opacity .17s,transform .17s,visibility .17s}',
    '.i18n-switcher.open .i18n-menu{opacity:1;visibility:visible;transform:none}',
    '.i18n-menu li{margin:0;padding:0;list-style:none}',
    '.i18n-option{display:flex;align-items:center;gap:10px;width:100%;padding:9px 11px;border:0;',
    'border-radius:9px;background:transparent;color:#a9a9ba;font-family:inherit;font-size:.87rem;',
    'font-weight:500;text-align:left;cursor:pointer;transition:background .15s,color .15s}',
    '.i18n-option:hover{background:rgba(255,255,255,.06);color:#fff}',
    '.i18n-option[aria-selected="true"]{color:#fff;background:rgba(16,185,129,.14)}',
    '.i18n-badge{display:inline-flex;align-items:center;justify-content:center;min-width:30px;padding:3px 6px;',
    'border-radius:5px;background:rgba(255,255,255,.08);font-size:.68rem;font-weight:700;letter-spacing:.05em;',
    'color:#d5d5e2;flex-shrink:0}',
    /* Drawn SVG flags - emoji flags do not render on Windows. */
    '.i18n-flag{display:inline-block;width:20px;height:14px;border-radius:2.5px;overflow:hidden;',
    'flex-shrink:0;line-height:0;box-shadow:0 0 0 1px rgba(255,255,255,.14) inset}',
    '.i18n-flag svg{display:block;width:100%;height:100%}',
    '.i18n-toggle .i18n-flag{width:19px;height:13px}',
    '.i18n-option[aria-selected="true"] .i18n-badge{background:rgba(16,185,129,.28);color:#fff}',
    '.i18n-check{margin-left:auto;width:14px;height:14px;stroke:#34d399;fill:none;stroke-width:2.5;opacity:0;flex-shrink:0}',
    '.i18n-option[aria-selected="true"] .i18n-check{opacity:1}',
    // Left group so the selector sits beside the brand without breaking space-between.
    '.i18n-lead{display:flex;align-items:center;gap:14px;flex-shrink:0}',
    '.wwb-host-home .topbar{flex-wrap:wrap}',
    // Fallback for pages with no navigation bar.
    '.i18n-floating{position:fixed;top:16px;left:16px;z-index:99999}',
    '.i18n-floating .i18n-toggle{background:rgba(12,12,14,.9);border-color:rgba(255,255,255,.18);',
    'backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}',
    '.i18n-floating.i18n-float-right{left:auto;right:16px}',
    '.i18n-float-right .i18n-menu{left:auto;right:0}',
    '[dir="rtl"] .i18n-floating.i18n-float-right{right:auto;left:16px}',
    '[dir="rtl"] .i18n-float-right .i18n-menu{right:auto;left:0}',
    '@media (max-width:600px){.i18n-menu{min-width:170px}.i18n-toggle{padding:6px 9px;font-size:.78rem}}',

    /* ---- right-to-left ---- */
    /* The dropdown and the floating pill are anchored with `left`, which has to
       flip so the menu stays inside the viewport when the page is mirrored. */
    '[dir="rtl"] .i18n-menu{left:auto;right:0}',
    '[dir="rtl"] .i18n-floating{left:auto;right:16px}',
    '[dir="rtl"] .i18n-option{text-align:right}',
    '[dir="rtl"] .i18n-check{margin-left:0;margin-right:auto}',
    '[dir="rtl"] .i18n-suggested-tag{margin-left:0;margin-right:auto}',
    /* Language names stay in their own script and direction. */
    '.i18n-option,.i18n-pick{unicode-bidi:isolate}',

    /* ---- first-visit language picker ---- */
    '.i18n-modal-overlay{position:fixed;inset:0;z-index:100000;background:rgba(4,4,6,.84);',
    '-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);display:flex;align-items:center;',
    'justify-content:center;padding:20px;opacity:0;transition:opacity .25s;font-family:inherit}',
    '.i18n-modal-overlay.show{opacity:1}',
    '.i18n-modal{width:100%;max-width:520px;max-height:90vh;overflow-y:auto;background:#0f0f12;',
    'border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:26px;',
    'box-shadow:0 30px 80px rgba(0,0,0,.7);transform:translateY(12px) scale(.985);transition:transform .25s}',
    '.i18n-modal-overlay.show .i18n-modal{transform:none}',
    '.i18n-modal-head{display:flex;align-items:center;gap:11px;margin-bottom:7px}',
    '.i18n-modal-head svg{width:21px;height:21px;stroke:#34d399;fill:none;stroke-width:2;flex-shrink:0}',
    '.i18n-modal h2{margin:0;font-size:1.15rem;font-weight:800;color:#fff;letter-spacing:-.01em}',
    '.i18n-modal-sub{margin:0 0 18px;color:#9a9aaa;font-size:.88rem;line-height:1.5}',
    '.i18n-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}',
    '.i18n-pick{display:flex;align-items:center;gap:10px;width:100%;padding:11px 12px;',
    'border:1px solid rgba(255,255,255,.1);border-radius:11px;background:rgba(255,255,255,.03);',
    'color:#d5d5e2;font-family:inherit;font-size:.9rem;font-weight:600;cursor:pointer;text-align:left;',
    'transition:background .15s,border-color .15s,color .15s}',
    '.i18n-pick:hover{background:rgba(16,185,129,.14);border-color:rgba(16,185,129,.5);color:#fff}',
    '.i18n-pick:focus-visible{outline:2px solid #34d399;outline-offset:2px}',
    '.i18n-pick.suggested{border-color:rgba(16,185,129,.55);background:rgba(16,185,129,.1);color:#fff}',
    '.i18n-suggested-tag{margin-left:auto;font-size:.62rem;font-weight:700;letter-spacing:.06em;',
    'color:#34d399;text-transform:uppercase}',
    '.i18n-modal-foot{margin-top:17px;text-align:center}',
    '.i18n-dismiss{background:none;border:0;color:#6a6a7c;font-family:inherit;font-size:.82rem;',
    'cursor:pointer;text-decoration:underline;padding:6px}',
    '.i18n-dismiss:hover{color:#9a9aaa}',
    '@media (max-width:520px){.i18n-modal{padding:20px}.i18n-pick{padding:10px;font-size:.85rem;gap:8px}}',

    /* ---- site-aligned language redesign ---- */
    ':root{--i18n-accent:var(--accent,#10b981);--i18n-accent-light:var(--accent-light,#6ee7b7);--i18n-bg:var(--bg-secondary,#131316);--i18n-surface:var(--bg-tertiary,#1a1a1e)}',
    '.i18n-toggle{padding:8px 11px;border-radius:11px;border-color:rgba(16,185,129,.3);background:linear-gradient(180deg,rgba(255,255,255,.09),rgba(255,255,255,.035));color:var(--text-primary,#f4f4f5);box-shadow:0 8px 22px rgba(0,0,0,.18),inset 0 1px 0 rgba(255,255,255,.08);}',
    '.i18n-toggle:hover,.i18n-switcher.open .i18n-toggle{background:linear-gradient(180deg,rgba(16,185,129,.2),rgba(16,185,129,.08));border-color:rgba(110,231,183,.68);color:#fff;box-shadow:0 10px 26px rgba(0,0,0,.25),0 0 0 3px rgba(16,185,129,.08)}',
    '.i18n-toggle:focus-visible,.i18n-pick:focus-visible,.i18n-option:focus-visible{outline:2px solid var(--i18n-accent-light);outline-offset:3px}',
    '.i18n-toggle .i18n-caret{color:var(--i18n-accent-light);opacity:.9}',
    '.i18n-menu{width:242px;min-width:242px;margin:0;padding:9px;top:calc(100% + 10px);background:rgba(19,19,22,.97);border-color:rgba(16,185,129,.3);border-radius:15px;box-shadow:0 28px 64px -20px rgba(0,0,0,.9),0 0 0 1px rgba(16,185,129,.07);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);position:absolute}',
    '.i18n-menu::before{content:"";position:absolute;top:0;left:18px;right:18px;height:2px;border-radius:999px;background:linear-gradient(90deg,transparent,var(--i18n-accent-light),transparent);opacity:.9}',
    '.i18n-option{gap:10px;padding:10px 11px;border-radius:10px;color:var(--text-secondary,#a1a1aa);font-size:.84rem;transition:background .18s,color .18s,transform .18s}',
    '.i18n-option:hover{background:rgba(16,185,129,.1);color:#fff;transform:translateX(2px)}',
    '.i18n-option[aria-selected="true"]{background:linear-gradient(90deg,rgba(16,185,129,.2),rgba(16,185,129,.06));color:#fff;box-shadow:inset 2px 0 0 var(--i18n-accent)}',
    '.i18n-badge{min-width:31px;padding:4px 6px;border:1px solid rgba(255,255,255,.08);border-radius:6px;background:rgba(255,255,255,.06);color:#d9fced;font-size:.64rem}',
    '.i18n-option[aria-selected="true"] .i18n-badge{background:rgba(16,185,129,.22);border-color:rgba(110,231,183,.3);color:#fff}',
    '.i18n-check{stroke:var(--i18n-accent-light)}',
    '.i18n-modal-overlay{background:radial-gradient(circle at 50% 18%,rgba(16,185,129,.12),transparent 42%),rgba(4,7,9,.9);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);padding:18px}',
    '.i18n-modal{position:relative;isolation:isolate;max-width:600px;max-height:88vh;padding:30px;background:linear-gradient(180deg,rgba(19,19,22,.99),rgba(10,10,12,.99));border:1px solid rgba(16,185,129,.28);border-radius:20px;box-shadow:0 34px 90px -22px rgba(0,0,0,.92),0 0 0 1px rgba(16,185,129,.06),0 0 48px rgba(16,185,129,.08);overflow-y:auto}',
    '.i18n-modal::before{content:"";position:absolute;z-index:-1;top:0;left:34px;right:34px;height:3px;border-radius:0 0 999px 999px;background:linear-gradient(90deg,transparent,var(--i18n-accent),transparent);box-shadow:0 0 22px rgba(16,185,129,.38)}',
    '.i18n-modal::after{content:"";position:absolute;z-index:-1;top:-110px;right:-100px;width:260px;height:260px;border-radius:50%;background:radial-gradient(circle,rgba(16,185,129,.12),transparent 68%);pointer-events:none}',
    '.i18n-modal-head{position:relative;z-index:1;gap:13px;margin-bottom:10px}',
    '.i18n-modal-head svg{width:38px;height:38px;padding:9px;border:1px solid rgba(110,231,183,.26);border-radius:12px;background:rgba(16,185,129,.12);stroke:var(--i18n-accent-light);stroke-width:1.8}',
    '.i18n-modal h2{font-size:1.28rem;letter-spacing:-.025em}',
    '.i18n-modal-sub{max-width:500px;margin:0 0 22px;color:var(--text-secondary,#a1a1aa);font-size:.9rem;line-height:1.6}',
    '.i18n-grid{gap:10px}',
    '.i18n-pick{min-height:48px;padding:12px 13px;border-color:rgba(255,255,255,.1);border-radius:12px;background:rgba(255,255,255,.035);color:#d9d9e2;font-size:.9rem;transition:background .18s,border-color .18s,color .18s,transform .18s,box-shadow .18s}',
    '.i18n-pick:hover{background:rgba(16,185,129,.12);border-color:rgba(110,231,183,.54);color:#fff;transform:translateY(-1px);box-shadow:0 8px 20px rgba(0,0,0,.2)}',
    '.i18n-pick.suggested{border-color:rgba(110,231,183,.62);background:linear-gradient(90deg,rgba(16,185,129,.19),rgba(16,185,129,.07));box-shadow:inset 3px 0 0 var(--i18n-accent),0 8px 22px rgba(0,0,0,.14);color:#fff}',
    '.i18n-suggested-tag{padding:3px 7px;border:1px solid rgba(110,231,183,.25);border-radius:999px;background:rgba(16,185,129,.12);color:var(--i18n-accent-light);font-size:.58rem}',
    '.i18n-modal-foot{margin-top:21px;padding-top:16px;border-top:1px solid rgba(255,255,255,.08)}',
    '.i18n-dismiss{padding:8px 14px;border:1px solid rgba(255,255,255,.12);border-radius:999px;color:var(--text-muted,#8b8b93);text-decoration:none;background:rgba(255,255,255,.025);transition:background .18s,border-color .18s,color .18s}',
    '.i18n-dismiss:hover{background:rgba(255,255,255,.07);border-color:rgba(255,255,255,.22);color:#fff}',
    '.i18n-menu,.i18n-modal{scrollbar-width:thin;scrollbar-color:rgba(16,185,129,.45) transparent}',
    '.i18n-menu::-webkit-scrollbar,.i18n-modal::-webkit-scrollbar{width:6px}',
    '.i18n-menu::-webkit-scrollbar-thumb,.i18n-modal::-webkit-scrollbar-thumb{background:rgba(16,185,129,.42);border-radius:999px}',
    '@media (max-width:520px){.i18n-menu{width:220px;min-width:220px}.i18n-modal{padding:24px 18px;border-radius:17px}.i18n-grid{gap:8px}.i18n-pick{min-height:44px;padding:10px;font-size:.82rem;gap:8px}.i18n-modal-sub{font-size:.85rem;margin-bottom:18px}}'
  ].join('');

  var GLOBE = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5"/>' +
              '<path d="M2.5 12h19"/><path d="M12 2.5a15 15 0 0 1 0 19a15 15 0 0 1 0-19z"/></svg>';

  // Inline SVG flags. Emoji flags are not rendered on Windows (they fall back to
  // the two letters), so they are drawn instead of using the emoji codepoints.
  var STAR = '0,-1 .225,-.309 .951,-.309 .363,.118 .588,.809 0,.382 -.588,.809 -.363,.118 -.951,-.309 -.225,-.309';
  function star(x, y, r, rot) {
    return '<polygon points="' + STAR + '" fill="#FFDE00" transform="translate(' + x + ',' + y + ') ' +
           'scale(' + r + ')' + (rot ? ' rotate(' + rot + ')' : '') + '"/>';
  }
  var FLAGS = {
    en: '<rect width="60" height="40" fill="#012169"/>' +
        '<path d="M0,0 60,40 M60,0 0,40" stroke="#fff" stroke-width="9"/>' +
        '<path d="M0,0 60,40 M60,0 0,40" stroke="#C8102E" stroke-width="5"/>' +
        '<path d="M30,0 V40 M0,20 H60" stroke="#fff" stroke-width="14"/>' +
        '<path d="M30,0 V40 M0,20 H60" stroke="#C8102E" stroke-width="8"/>',
    es: '<rect width="60" height="40" fill="#AA151B"/><rect y="10" width="60" height="20" fill="#F1BF00"/>',
    pt: '<rect width="60" height="40" fill="#009B3A"/>' +
        '<path d="M30,5 55,20 30,35 5,20Z" fill="#FEDF00"/><circle cx="30" cy="20" r="8.5" fill="#002776"/>',
    fr: '<rect width="60" height="40" fill="#fff"/><rect width="20" height="40" fill="#002395"/>' +
        '<rect x="40" width="20" height="40" fill="#ED2939"/>',
    de: '<rect width="60" height="40" fill="#FFCE00"/><rect width="60" height="26.7" fill="#D00"/>' +
        '<rect width="60" height="13.3" fill="#000"/>',
    ru: '<rect width="60" height="40" fill="#D52B1E"/><rect width="60" height="26.7" fill="#0039A6"/>' +
        '<rect width="60" height="13.3" fill="#fff"/>',
    tr: '<rect width="60" height="40" fill="#E30A17"/><circle cx="24" cy="20" r="9" fill="#fff"/>' +
        '<circle cx="27.5" cy="20" r="7.2" fill="#E30A17"/>' +
        '<polygon points="' + STAR + '" fill="#fff" transform="translate(38,20) scale(5) rotate(15)"/>',
    pl: '<rect width="60" height="40" fill="#DC143C"/><rect width="60" height="20" fill="#fff"/>',
    it: '<rect width="60" height="40" fill="#fff"/><rect width="20" height="40" fill="#008C45"/>' +
        '<rect x="40" width="20" height="40" fill="#CD212A"/>',
    zh: '<rect width="60" height="40" fill="#DE2910"/>' + star(13, 12, 6.5) +
        star(24, 5, 2.2, 20) + star(29, 10, 2.2, 45) + star(29, 17, 2.2, 70) + star(24, 22, 2.2, 20),
    ja: '<rect width="60" height="40" fill="#fff"/><circle cx="30" cy="20" r="12" fill="#BC002D"/>',
    ko: '<rect width="60" height="40" fill="#fff"/>' +
        // Taegeuk: red over blue, rotated as on the real flag.
        '<g transform="rotate(-33 30 20)">' +
        '<path d="M30,11 A9,9 0 0 1 30,29 A4.5,4.5 0 0 0 30,20 A4.5,4.5 0 0 1 30,11Z" fill="#CD2E3A"/>' +
        '<path d="M30,29 A9,9 0 0 1 30,11 A4.5,4.5 0 0 1 30,20 A4.5,4.5 0 0 0 30,29Z" fill="#0047A0"/>' +
        '</g>' +
        // Four trigrams, simplified to bars at the corners.
        '<g fill="#000">' +
        '<rect x="10" y="8"  width="9" height="1.6" transform="rotate(56 14.5 8.8)"/>' +
        '<rect x="10" y="11" width="9" height="1.6" transform="rotate(56 14.5 11.8)"/>' +
        '<rect x="41" y="8"  width="9" height="1.6" transform="rotate(-56 45.5 8.8)"/>' +
        '<rect x="41" y="11" width="9" height="1.6" transform="rotate(-56 45.5 11.8)"/>' +
        '<rect x="10" y="28" width="9" height="1.6" transform="rotate(-56 14.5 28.8)"/>' +
        '<rect x="10" y="31" width="9" height="1.6" transform="rotate(-56 14.5 31.8)"/>' +
        '<rect x="41" y="28" width="9" height="1.6" transform="rotate(56 45.5 28.8)"/>' +
        '<rect x="41" y="31" width="9" height="1.6" transform="rotate(56 45.5 31.8)"/>' +
        '</g>',
    th: '<rect width="60" height="40" fill="#A51931"/>' +
        '<rect y="6.67" width="60" height="26.67" fill="#F4F5F8"/>' +
        '<rect y="13.33" width="60" height="13.33" fill="#2D2A4A"/>',
    vi: '<rect width="60" height="40" fill="#DA251D"/>' +
        '<polygon points="' + STAR + '" fill="#FFFF00" transform="translate(30,20) scale(11)"/>',
    id: '<rect width="60" height="40" fill="#fff"/><rect width="60" height="20" fill="#CE1126"/>',
    hi: '<rect width="60" height="40" fill="#fff"/>' +
        '<rect width="60" height="13.33" fill="#FF9933"/>' +
        '<rect y="26.67" width="60" height="13.33" fill="#138808"/>' +
        // Ashoka Chakra, simplified to a rim plus spokes.
        '<circle cx="30" cy="20" r="5.6" fill="none" stroke="#000080" stroke-width="1.1"/>' +
        '<circle cx="30" cy="20" r="1.1" fill="#000080"/>' +
        '<g stroke="#000080" stroke-width=".55">' +
        '<path d="M30,14.4V25.6M24.4,20H35.6M26,16L34,24M34,16L26,24"/>' +
        '</g>',
    nl: '<rect width="60" height="40" fill="#fff"/>' +
        '<rect width="60" height="13.33" fill="#AE1C28"/>' +
        '<rect y="26.67" width="60" height="13.33" fill="#21468B"/>',
    ka: '<rect width="60" height="40" fill="#fff"/>' +
        // St George's cross plus the four Bolnisi crosses.
        '<path d="M26,0 h8 v40 h-8 z M0,16 h60 v8 h-60 z" fill="#FF0000"/>' +
        '<g fill="#FF0000">' +
        '<path d="M10,6 h3 v-3 h3 v3 h3 v3 h-3 v3 h-3 v-3 h-3 z"/>' +
        '<path d="M44,6 h3 v-3 h3 v3 h3 v3 h-3 v3 h-3 v-3 h-3 z"/>' +
        '<path d="M10,31 h3 v-3 h3 v3 h3 v3 h-3 v3 h-3 v-3 h-3 z"/>' +
        '<path d="M44,31 h3 v-3 h3 v3 h3 v3 h-3 v3 h-3 v-3 h-3 z"/>' +
        '</g>',
    ar: '<rect width="60" height="40" fill="#006C35"/>' +
        // Stylised shahada line above the sword, as on the Saudi flag.
        '<path d="M14,15 h32" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>' +
        '<path d="M14,19.5 h26" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>' +
        '<path d="M15,26 h30" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>' +
        '<path d="M45,26 l-4,-2.2 v4.4 z" fill="#fff"/>',
    he: '<rect width="60" height="40" fill="#fff"/>' +
        '<rect y="5" width="60" height="4.5" fill="#0038B8"/>' +
        '<rect y="30.5" width="60" height="4.5" fill="#0038B8"/>' +
        // Star of David: two overlapping triangles.
        '<g fill="none" stroke="#0038B8" stroke-width="1.5">' +
        '<path d="M30,13 L36,23.5 L24,23.5 Z"/>' +
        '<path d="M30,27 L24,16.5 L36,16.5 Z"/>' +
        '</g>',
    sr: '<rect width="60" height="40" fill="#C6363C"/>' +
        '<rect y="13.33" width="60" height="13.33" fill="#0C4076"/>' +
        '<rect y="26.67" width="60" height="13.33" fill="#fff"/>' +
        // Coat of arms, reduced to a shield at the hoist side.
        '<path d="M16,13 h9 v7 a4.5,4.5 0 0 1 -4.5,4.5 a4.5,4.5 0 0 1 -4.5,-4.5 z" fill="#C6363C" stroke="#EDB92E" stroke-width="1"/>'
  };

  function flagHTML(code) {
    var body = FLAGS[code];
    if (!body) return '';
    return '<span class="i18n-flag" aria-hidden="true"><svg viewBox="0 0 60 40" preserveAspectRatio="none">' +
           body + '</svg></span>';
  }
  var CARET = '<svg class="i18n-caret" viewBox="0 0 24 24" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>';
  var CHECK = '<svg class="i18n-check" viewBox="0 0 24 24" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>';

  // Ordered by preference; the selector lands in the first container that exists.
  var MOUNTS = ['.wwb-host-page .host-taskbar', '.wwb-host-home nav.topbar', '.nav-inner', '.navbar-inner', '.nav-container', 'nav.navbar',
                '.portal-header .header-inner', 'header.header', '.header-inner'];
  var BRANDS = '.sidebar-brand, .brand, .logo, .navbar-brand-text, .portal-logo, .navbar-brand, .brand-name';

  var root = null;

  function buildSelector() {
    if (document.querySelector('.i18n-switcher')) return;

    var style = document.createElement('style');
    style.id = 'i18n-style';
    style.textContent = CSS;
    (document.head || document.documentElement).appendChild(style);

    root = document.createElement('div');
    root.className = 'i18n-switcher';
    root.setAttribute('data-i18n-skip', '');       // never translate language names

    var toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'i18n-toggle';
    toggle.setAttribute('aria-haspopup', 'listbox');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Change language');
    toggle.innerHTML = '<span class="i18n-toggle-flag">' + flagHTML(current) + '</span>' +
                       '<span class="i18n-current">EN</span>' + CARET;

    var menu = document.createElement('ul');
    menu.className = 'i18n-menu';
    menu.setAttribute('role', 'listbox');
    menu.setAttribute('aria-label', 'Select language');

    LANGS.forEach(function (l) {
      var li = document.createElement('li');
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'i18n-option';
      btn.setAttribute('role', 'option');
      btn.setAttribute('data-lang', l.code);
      btn.setAttribute('aria-selected', 'false');
      btn.innerHTML = flagHTML(l.code) + '<span class="i18n-badge">' + l.label + '</span>' +
                      '<span>' + l.native + '</span>' + CHECK;
      btn.addEventListener('click', function () {
        close();
        setLang(l.code);
      });
      li.appendChild(btn);
      menu.appendChild(li);
    });

    root.appendChild(toggle);
    root.appendChild(menu);

    function open() { root.classList.add('open'); toggle.setAttribute('aria-expanded', 'true'); }
    function close() { root.classList.remove('open'); toggle.setAttribute('aria-expanded', 'false'); }

    /*
     * Some navbars (the portal's, for one) use overflow-x:auto for horizontal
     * scrolling, which also clips the absolutely-positioned dropdown. When an
     * ancestor would clip us, pin the menu with position:fixed instead so it
     * escapes the scroll container.
     */
    function clippedByAncestor() {
      for (var n = root.parentNode; n && n.nodeType === 1 && n !== document.body; n = n.parentNode) {
        var o = getComputedStyle(n);
        if (o.overflow !== 'visible' || o.overflowX !== 'visible' || o.overflowY !== 'visible') return true;
      }
      return false;
    }

    function positionMenu() {
      if (!clippedByAncestor()) {
        menu.style.position = menu.style.top = menu.style.left = menu.style.right = '';
        return;
      }
      var r = toggle.getBoundingClientRect();
      var rtl = document.documentElement.getAttribute('dir') === 'rtl';
      menu.style.position = 'fixed';
      menu.style.top = Math.round(r.bottom + 9) + 'px';
      if (rtl) {
        menu.style.right = Math.round(window.innerWidth - r.right) + 'px';
        menu.style.left = 'auto';
      } else {
        menu.style.left = Math.round(r.left) + 'px';
        menu.style.right = 'auto';
      }
    }

    toggle.addEventListener('click', function (e) {
      e.stopPropagation();
      if (root.classList.contains('open')) { close(); return; }
      positionMenu();
      open();
    });
    window.addEventListener('resize', function () { if (root.classList.contains('open')) positionMenu(); });
    window.addEventListener('scroll', function () { if (root.classList.contains('open')) close(); }, true);
    document.addEventListener('click', function (e) {
      if (!root.contains(e.target)) close();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') close();
    });

    mount(root);
    mountSidebarLink();
    syncUI();
  }

  // The floating pill is easy to miss, so also add a Language entry to the
  // sidebar. Cloned from a real nav item, which is the only reliable way to
  // inherit the site's own styling and its collapsed-sidebar tooltip.
  function mountSidebarLink() {
    var list = document.querySelector('.sidebar-nav .nav-list');
    if (!list || list.querySelector('.i18n-nav-link')) return;
    var sample = list.querySelector('li > .nav-link');
    if (!sample) return;

    var li = sample.parentNode.cloneNode(true);
    var a = li.querySelector('.nav-link');
    a.classList.remove('active');
    a.classList.add('i18n-nav-link');
    a.setAttribute('href', '#');
    a.setAttribute('data-tooltip', 'Language');
    a.setAttribute('aria-label', 'Language');
    a.removeAttribute('aria-current');

    var icon = a.querySelector('.nav-icon') || a.querySelector('i');
    var globe = '<svg class="nav-icon" data-nav-icon="language" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/></svg>';
    if (icon) icon.outerHTML = globe;
    else a.insertAdjacentHTML('afterbegin', globe);
    var span = a.querySelector('span');
    if (span) span.textContent = 'Language';

    a.addEventListener('click', function (e) {
      e.preventDefault();
      showPicker(true);
    });
    list.appendChild(li);
    if (!list.querySelector('.webhost-nav-link')) {
      var webItem = sample.parentNode.cloneNode(true);
      var webLink = webItem.querySelector('.nav-link');
      webLink.classList.remove('active');
      webLink.classList.add('webhost-nav-link');
      webLink.setAttribute('href', '/hosts/');
      webLink.setAttribute('data-tooltip', 'PS4 / PS5 webhost');
      webLink.setAttribute('aria-label', 'PS4 / PS5 webhost');
      webLink.removeAttribute('aria-current');
      var webIcon = webLink.querySelector('.nav-icon') || webLink.querySelector('i');
      if (webIcon) webIcon.outerHTML = '<svg class="nav-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8m-4-4v4M8 9v4m-2-2h4m5 0h2"/></svg>';
      var webLabel = webLink.querySelector('span');
      if (webLabel) webLabel.textContent = 'PS4 / PS5 webhost';
      list.appendChild(webItem);
    }
  }

  function mount(el) {
    var host = null;
    for (var i = 0; i < MOUNTS.length; i++) {
      host = document.querySelector(MOUNTS[i]);
      if (host) break;
    }
    if (!host) {                                   // no nav on this page
      el.classList.add('i18n-floating');
      el.classList.add(FLOAT_SIDE === 'right' ? 'i18n-float-right' : 'i18n-float-left');
      document.body.appendChild(el);
      return;
    }
    // Host taskbars reserve an independent end slot after Credits and Offline cache.
    if (/(?:^|\s)host-taskbar(?:\s|$)/.test(host.className || '')) { host.appendChild(el); return; }
    // Group the selector with the brand so flex spacing stays intact.
    var brand = host.querySelector(BRANDS);
    if (brand && brand.parentNode === host) {
      var lead = document.createElement('div');
      lead.className = 'i18n-lead';
      host.insertBefore(lead, brand);
      lead.appendChild(el);
      lead.appendChild(brand);
    } else {
      host.insertBefore(el, host.firstChild);
    }
  }

  function syncUI() {
    if (!root) return;
    var meta = LANGS.filter(function (l) { return l.code === current; })[0] || LANGS[0];
    var toggle = root.querySelector('.i18n-toggle');if(toggle)toggle.setAttribute('aria-label',lookup('Change language',dicts[current]||{})||'Change language');
    var label = root.querySelector('.i18n-current');
    if (label) label.textContent = meta.label;
    var tf = root.querySelector('.i18n-toggle-flag');
    if (tf) tf.innerHTML = flagHTML(current);
    var opts = root.querySelectorAll('.i18n-option');
    for (var i = 0; i < opts.length; i++) {
      opts[i].setAttribute('aria-selected', String(opts[i].getAttribute('data-lang') === current));
    }
  }

  // ------------------------------------------------- first-visit picker ---

  var picker = null;

  function showPicker(force) {
    // Only on a genuine first visit: any explicit choice writes to storage.
    if (!force && stored()) return;
    if (picker) return;

    var suggested = detect();

    picker = document.createElement('div');
    picker.className = 'i18n-modal-overlay';
    picker.setAttribute('data-i18n-skip', '');       // never translate this UI
    picker.setAttribute('role', 'dialog');
    picker.setAttribute('aria-modal', 'true');
    picker.setAttribute('aria-label', 'Choose your language');
    var overlay = picker;

    var box = document.createElement('div');
    box.className = 'i18n-modal';

    var head = '<div class="i18n-modal-head">' + GLOBE + '<h2>Choose your language</h2></div>' +
               '<p class="i18n-modal-sub">Select the language you would like to browse the site in. ' +
               'You can change it any time from Language in the sidebar, or the pill in the top-right corner.</p>';

    var grid = '<div class="i18n-grid">';
    LANGS.forEach(function (l) {
      var isSuggested = l.code === suggested && suggested !== DEFAULT_LANG;
      grid += '<button type="button" class="i18n-pick' + (isSuggested ? ' suggested' : '') +
              '" data-lang="' + l.code + '">' + flagHTML(l.code) +
              '<span>' + l.native + '</span>' +
              (isSuggested ? '<span class="i18n-suggested-tag">Suggested</span>' : '') +
              '</button>';
    });
    grid += '</div>';

    var foot = '<div class="i18n-modal-foot">' +
               '<button type="button" class="i18n-dismiss">Continue in English</button></div>';

    box.innerHTML = head + grid + foot;
    picker.appendChild(box);
    document.body.appendChild(picker);

    var prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function close(code) {
      // A dismissed overlay can still receive bubbling clicks or queued events.
      // Only this picker may close itself; never touch a newly opened picker.
      if (picker !== overlay) return;
      picker = null;
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      overlay.classList.remove('show');
      setTimeout(function () { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 260);
      // Storing the choice is what stops this reappearing on the next visit.
      setLang(code, {});
    }

    box.addEventListener('click', function (e) {
      var pick = e.target.closest ? e.target.closest('.i18n-pick') : null;
      if (pick) { close(pick.getAttribute('data-lang')); return; }
      if (e.target.closest && e.target.closest('.i18n-dismiss')) close(DEFAULT_LANG);
    });
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) close(current);          // click outside = keep as-is
    });
    function onKey(e) {
      if (e.key === 'Escape') close(current);
    }
    document.addEventListener('keydown', onKey);

    // Next frame so the CSS transition runs.
    setTimeout(function () { if (picker === overlay) overlay.classList.add('show'); }, 20);
    var first = box.querySelector('.i18n-pick.suggested') || box.querySelector('.i18n-pick');
    if (first) first.focus();
  }

  // ------------------------------------------------------------------ boot ---

  hideWhileLoading();

  function boot() {
    buildSelector();
    if (initial !== DEFAULT_LANG) setLang(initial, { silent: true });
    else { current = DEFAULT_LANG; syncUI(); startObserver(); reveal(); }
    showPicker();                       // no-ops unless this is a first visit
  }

  // Exported before boot() so a dictionary that lands early can always register.
  window.__scoobyI18n = {
    register: register,
    set: setLang,
    get: function () { return current; },
    langs: LANGS,
    /** Translate a complete source string, optionally filling named placeholders. */
    t: function (source, values) {
      source = String(source);
      var hit = lookup(source, dicts[current] || {}, values);
      return hit === undefined ? source : hit;
    },
    translate: function (source, values) { return window.__scoobyI18n.t(source, values); },
    /** Refresh application-rendered content after a deliberate DOM update. */
    refresh: refresh,
    /** Re-open the language picker (pass true to force it after a choice). */
    showPicker: function () { showPicker(true); },
    /** Forget the saved choice, so the first-visit picker shows again. */
    reset: function () { try { localStorage.removeItem(STORAGE_KEY); } catch (e) {} },
    /** Strings on the page with no translation in the active language. */
    missing: function () {
      var table = dicts[current] || {}, out = {}, w = document.createTreeWalker(
        document.body, NodeFilter.SHOW_TEXT, null, false), n;
      while ((n = w.nextNode())) {
        var v = norm(textOriginals.get(n) !== undefined ? textOriginals.get(n) : n.nodeValue);
        if (v && /[A-Za-z]/.test(v) && !skipped(n.parentNode) && lookup(v, table) === undefined) out[v] = 1;
      }
      var elements = document.body.querySelectorAll(ATTRS.map(function (attr) { return '[' + attr + ']'; }).join(','));
      for (var i = 0; i < elements.length; i++) {
        if (skipped(elements[i])) continue;
        var saved = attrOriginals.get(elements[i]) || {};
        for (var j = 0; j < ATTRS.length; j++) {
          var attr = ATTRS[j];
          if (!elements[i].hasAttribute(attr)) continue;
          if (attr === 'value' && (elements[i].tagName !== 'INPUT' || !/^(?:button|submit|reset)$/i.test(elements[i].getAttribute('type') || ''))) continue;
          var value = norm(saved[attr] === undefined ? elements[i].getAttribute(attr) || '' : saved[attr]);
          if (value && /[A-Za-z]/.test(value) && lookup(value, table) === undefined) out[value] = 1;
        }
      }
      return Object.keys(out);
    }
  };

  // Drain dictionaries that were included manually and arrived first.
  var queued = window.__scoobyI18nQueue;
  if (queued && queued.length) {
    for (var q = 0; q < queued.length; q++) register(queued[q][0], queued[q][1]);
    window.__scoobyI18nQueue = [];
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
