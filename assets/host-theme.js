/* Appearance only: never loads or sends console payloads. ES5 for console WebKit. */
(function (w, d) {
  'use strict';
  var key = 'wwb-host-theme', theme = 'dark';
  try { if (w.localStorage.getItem(key) === 'light') theme = 'light'; } catch (_) {}
  d.documentElement.setAttribute('data-host-theme', theme);
  function init() {
    var nav = d.querySelector('.topbar,.host-taskbar,.host-patches-taskbar,.pkg-taskbar');
    if (!nav || d.querySelector('.host-theme-toggle')) return;
    var button = d.createElement('button');
    button.type = 'button'; button.className = 'host-theme-toggle';
    function refresh() {
      button.textContent = theme === 'dark' ? '☼ Light mode' : '☾ Dark mode';
      button.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
      button.setAttribute('aria-pressed', theme === 'light' ? 'true' : 'false');
      var meta = d.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', theme === 'dark' ? '#000000' : '#f5f5f5');
    }
    button.onclick = function () {
      theme = theme === 'dark' ? 'light' : 'dark';
      d.documentElement.setAttribute('data-host-theme', theme);
      try { w.localStorage.setItem(key, theme); } catch (_) {}
      refresh();
    };
    refresh(); nav.appendChild(button);
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', init); else init();
}(window, document));
