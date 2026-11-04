(function (global, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (!global.document) return;
  const start = () => api.install(global.document, global);
  if (global.document.readyState === 'loading') global.document.addEventListener('DOMContentLoaded', start, {once: true});
  else start();
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';

  function guideURL(href, base) {
    if (typeof href !== 'string' || !href.trim()) return null;
    try {
      const current = new URL(base);
      const url = new URL(href, current);
      if (!['http:', 'https:', 'file:'].includes(url.protocol) || url.origin !== current.origin || url.username || url.password) return null;
      return url;
    } catch { return null; }
  }
  function isModGuidePath(pathname) {
    if (/^\/source-codes\/console\/ps4\/gta5\/(?:index\.html)?$/.test(pathname)) return true;
    return /^\/(?:console\/mods(?:\/|\.html$)|mods(?:\/|\.html$)|games\/|source-codes\/games\/)/.test(pathname) ||
      /^\/console\/(?:ps[345]|xbox360|psvita)\/mods\.html$/.test(pathname) ||
      /^\/console\/(?:ps3|xbox360)\/mods\//.test(pathname) || /^\/pc\/discord-mods\//.test(pathname) || pathname === '/console/vault.html';
  }
  function modGuideURL(href, base) {
    const url = guideURL(href, base);
    return url && isModGuidePath(url.pathname) ? url : null;
  }
  function plainClick(event) {
    return event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey;
  }
  function sanitizeGuideVideo(frame) {
    if (!frame.classList.contains('guide-video-player')) return false;
    let url;
    try { url = new URL(frame.getAttribute('src')); } catch { return false; }
    if (url.protocol !== 'https:' || !['www.youtube.com', 'www.youtube-nocookie.com'].includes(url.hostname) || url.username || url.password || url.port) return false;
    const video = url.pathname.match(/^\/embed\/([A-Za-z0-9_-]{11})$/);
    if (!video) return false;
    const id = frame.id;
    const start = url.searchParams.get('start');
    const startSeconds = /^\d+$/.test(start || '') && Number.isSafeInteger(Number(start)) ? Number(start) : 0;
    const title = frame.getAttribute('title')?.trim() || 'YouTube video';
    // Rebuild the approved player instead of trusting fetched iframe attributes.
    for (const attribute of [...frame.attributes]) frame.removeAttribute(attribute.name);
    if (id) frame.id = id;
    frame.className = 'guide-video-player';
    frame.setAttribute('src', `https://www.youtube-nocookie.com/embed/${video[1]}?playsinline=1&rel=0&autoplay=0${startSeconds ? '&start=' + startSeconds : ''}`);
    frame.setAttribute('title', title);
    frame.setAttribute('loading', 'lazy');
    frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    frame.setAttribute('allow', 'encrypted-media; picture-in-picture; fullscreen');
    frame.setAttribute('allowfullscreen', '');
    return true;
  }
  function namespaceContent(root, base, prefix) {
    root.querySelectorAll('.site-ad').forEach(node => node.remove());
    const ids = new Map();
    const nodes = [root, ...root.querySelectorAll('*')];
    let index = 0;
    for (const node of nodes) {
      if (!node.id) continue;
      const previous = node.id;
      node.id = prefix + (++index);
      if (!ids.has(previous)) ids.set(previous, node.id);
    }
    for (const node of nodes) {
      for (const attr of [...node.attributes]) if (/^on/i.test(attr.name)) node.removeAttribute(attr.name);
      for (const name of ['aria-labelledby', 'aria-describedby', 'aria-controls', 'for']) {
        if (node.hasAttribute(name)) node.setAttribute(name, node.getAttribute(name).split(/\s+/).map(id => ids.get(id) || id).join(' '));
      }
      for (const name of ['href', 'src', 'poster']) {
        const value = node.getAttribute(name);
        if (!value) continue;
        if (name === 'href' && value.startsWith('#')) {
          let id;
          try { id = decodeURIComponent(value.slice(1)); } catch { id = ''; }
          if (ids.has(id)) node.setAttribute(name, '#' + ids.get(id));
          continue;
        }
        try {
          const url = new URL(value, base);
          if (['http:', 'https:'].includes(url.protocol)) node.setAttribute(name, url.href);
          else if (name === 'href' && ['mailto:', 'tel:'].includes(url.protocol)) continue;
          else node.removeAttribute(name);
        } catch { node.removeAttribute(name); }
      }
    }
    root.querySelectorAll('iframe').forEach(frame => { if (!sanitizeGuideVideo(frame)) frame.remove(); });
    root.querySelectorAll('script, object, embed').forEach(node => node.remove());
    return root;
  }
  function install(document, window) {
    if (!window.HTMLDialogElement || typeof window.HTMLDialogElement.prototype.showModal !== 'function') return null;
    if (document.querySelector('.guide-dialog')) return null;
    const modPage = isModGuidePath(new URL(window.location.href).pathname);

    const panels = new Set();
    const titleFor = panel => panel.getAttribute('data-guide-title') || panel.querySelector('h2, h1')?.textContent.trim() || 'Guide';
    function localTarget(url) {
      const current = new URL(window.location.href);
      if (url.pathname !== current.pathname || url.search !== current.search || !url.hash) return null;
      try { return document.getElementById(decodeURIComponent(url.hash.slice(1))); } catch { return null; }
    }
    function register(panel) {
      panel.setAttribute('data-guide-panel', '');
      if (!panel.hasAttribute('data-guide-title')) panel.setAttribute('data-guide-title', titleFor(panel));
      panels.add(panel);
      panel.hidden = true;
    }
    if (modPage) document.querySelectorAll('[data-guide-panel]').forEach(register);
    // Existing BO3/GTA setup anchors can open guide-only sections too.
    // Grids and download cards stay in place.
    if (modPage) document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      const url = guideURL(anchor.getAttribute('href'), window.location.href);
      const target = url && localTarget(url);
      if (!target?.matches('.section') || !target.querySelector('.guide-steps') || target.querySelector('.games-grid')) return;
      anchor.setAttribute('data-guide-open', '');
      if (!panels.has(target)) register(target);
    });
    document.querySelectorAll('a[data-guide-open]').forEach(anchor => {
      if (modGuideURL(anchor.getAttribute('href'), window.location.href)) return;
      anchor.removeAttribute('data-guide-open');
      anchor.removeAttribute('aria-haspopup');
      anchor.removeAttribute('aria-controls');
    });
    if (!panels.size && !document.querySelector('[data-guide-open]')) return null;

    let id = 'console-guide-dialog-title';
    while (document.getElementById(id)) id += '-next';
    const dialog = document.createElement('dialog');
    dialog.className = 'guide-dialog';
    let dialogId = 'console-guide-dialog';
    while (document.getElementById(dialogId)) dialogId += '-next';
    dialog.id = dialogId;
    dialog.setAttribute('aria-labelledby', id);
    const header = document.createElement('header');
    header.className = 'guide-dialog__header';
    const heading = document.createElement('h2');
    heading.id = id;
    heading.tabIndex = -1;
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'guide-dialog__close';
    close.setAttribute('aria-label', 'Close guide');
    close.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
    header.append(heading, close);
    const body = document.createElement('div');
    body.className = 'guide-dialog__body';
    body.tabIndex = 0;
    body.setAttribute('role', 'region');
    body.setAttribute('aria-label', 'Guide content');
    dialog.append(header, body);
    document.body.append(dialog);
    document.querySelectorAll('a[data-guide-open]').forEach(trigger => {
      trigger.setAttribute('aria-haspopup', 'dialog');
      trigger.setAttribute('aria-controls', dialog.id);
    });

    let restoreContent = null;
    let returnFocus = null;
    let request = null;
    let sequence = 0;
    let backdropStart = false;
    function resetContent() {
      request?.abort();
      request = null;
      body.querySelectorAll('video, audio').forEach(media => media.pause?.());
      // Reload marked players before restoring a hidden local panel so audio
      // cannot continue after the guide is dismissed.
      body.querySelectorAll('iframe').forEach(frame => {
        if (frame.classList.contains('guide-video-player')) sanitizeGuideVideo(frame);
      });
      if (restoreContent) restoreContent();
      restoreContent = null;
      body.replaceChildren();
    }
    function openPanel(panel) {
      const marker = document.createComment('guide position');
      const wasHidden = panel.hidden;
      panel.before(marker);
      panel.hidden = false;
      body.append(panel);
      restoreContent = () => {
        marker.replaceWith(panel);
        panel.hidden = wasHidden;
      };
    }
    async function open(trigger, url, panel = localTarget(url)) {
      if (!isModGuidePath(url.pathname)) {
        window.location.assign(url.href);
        return;
      }
      if (!dialog.open) returnFocus = trigger || document.activeElement;
      ++sequence;
      const current = sequence;
      resetContent();
      heading.textContent = panel ? titleFor(panel) : trigger?.getAttribute('data-guide-title') || 'Guide';
      if (panel) openPanel(panel);
      else {
        const loading = document.createElement('p');
        loading.textContent = 'Loading guide…';
        loading.setAttribute('role', 'status');
        body.append(loading);
      }
      body.scrollTop = 0;
      if (!dialog.open) dialog.showModal();
      document.documentElement.classList.add('guide-dialog-open');
      heading.focus({preventScroll: true});
      if (panel) return;
      request = new window.AbortController();
      try {
        const response = await window.fetch(url.href, {signal: request.signal, credentials: 'same-origin'});
        if (!response.ok || !modGuideURL(response.url || url.href, window.location.href)) throw new Error('Guide unavailable');
        const html = await response.text();
        if (!dialog.open || current !== sequence) return;
        const parsed = new window.DOMParser().parseFromString(html, 'text/html');
        let content = null;
        if (url.hash) {
          try { content = parsed.getElementById(decodeURIComponent(url.hash.slice(1))); } catch { /* Fall back to the guide body. */ }
        }
        content ||= parsed.getElementById('content') || parsed.querySelector('main');
        if (!content) throw new Error('Guide content missing');
        if (!dialog.open || current !== sequence) return;
        heading.textContent = parsed.querySelector('h1')?.textContent.trim() || heading.textContent;
        const prefix = id + '-remote-' + current + '-';
        body.replaceChildren(namespaceContent(content.cloneNode(true), response.url || url.href, prefix));
        body.scrollTop = 0;
      } catch (error) {
        if (error.name === 'AbortError' || current !== sequence || !dialog.open) return;
        dialog.close();
        window.location.assign(url.href);
      }
    }
    close.addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => {
      ++sequence;
      resetContent();
      document.documentElement.classList.remove('guide-dialog-open');
      if (returnFocus?.isConnected && !returnFocus.closest('[hidden]')) returnFocus.focus({preventScroll: true});
      returnFocus = null;
    });
    const outside = event => {
      const rect = dialog.getBoundingClientRect();
      return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
    };
    dialog.addEventListener('pointerdown', event => { backdropStart = event.target === dialog && outside(event); });
    dialog.addEventListener('click', event => {
      if (backdropStart && event.target === dialog && outside(event)) dialog.close();
      backdropStart = false;
    });
    document.addEventListener('click', event => {
      if (!plainClick(event)) return;
      const trigger = event.target.closest?.('a[data-guide-open]');
      if (!trigger || trigger.hasAttribute('download') || trigger.target === '_blank') return;
      const url = modGuideURL(trigger.getAttribute('href'), window.location.href);
      if (!url) return;
      const current = new URL(window.location.href);
      const panel = localTarget(url);
      if (!panel && url.pathname === current.pathname && url.search === current.search && url.hash) return;
      event.preventDefault();
      event.stopPropagation();
      open(trigger, url, panel);
    }, true);
    const openHash = () => {
      const url = guideURL(window.location.href, window.location.href);
      const panel = url && localTarget(url);
      if (!panel || !panels.has(panel)) return;
      const trigger = [...document.querySelectorAll('a[data-guide-open]')].find(anchor => guideURL(anchor.getAttribute('href'), window.location.href)?.hash === url.hash);
      open(trigger, url, panel);
    };
    window.addEventListener('hashchange', openHash);
    openHash();
    return {dialog, open, close: () => dialog.close()};
  }
  return {guideURL, isModGuidePath, modGuideURL, plainClick, namespaceContent, install};
});
