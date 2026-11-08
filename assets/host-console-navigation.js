/* Spatial focus for console browsers that expose directional keys to the page. */
(function (win, doc) {
  'use strict';
  var network = doc.querySelector('[data-wwb-network]');
  var cache = doc.querySelector('[data-wwb-cache]');
  function showNetwork() {
    if (network) network.textContent = win.navigator.onLine === false ? 'Browser is offline' :
      win.navigator.onLine === true ? 'Browser reports online' : 'Unavailable';
  }
  function showCache() {
    if (!cache) return;
    var labels = ['No browser cache attached', 'Cache ready', 'Checking for updates', 'Saving files', 'Update ready', 'Cache needs to be saved again'];
    var appCache = win.applicationCache;
    cache.textContent = appCache ? labels[appCache.status] || 'Cache status unavailable' : 'Check offline cache page';
  }
  showNetwork();
  showCache();
  if (network) {
    win.addEventListener('online', showNetwork);
    win.addEventListener('offline', showNetwork);
  }
  if (cache && win.applicationCache) {
    ['checking','downloading','cached','noupdate','updateready','obsolete','error'].forEach(function (event) {
      win.applicationCache.addEventListener(event, showCache);
    });
  }
  if (!/PlayStation [45]/i.test(win.navigator.userAgent)) return;

  var directions = {ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]};
  var legacyKeys = {37: 'ArrowLeft', 38: 'ArrowUp', 39: 'ArrowRight', 40: 'ArrowDown'};
  var controls = 'a[href],button,input,select,textarea,summary,[tabindex="0"]';

  doc.addEventListener('keydown', function (event) {
    var direction = directions[event.key] || directions[legacyKeys[event.keyCode]];
    var current = doc.activeElement;
    if (!direction || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey ||
        !current || /^(INPUT|SELECT|TEXTAREA)$/.test(current.tagName) || current.isContentEditable) return;

    var dialog = doc.querySelector('[role="dialog"][aria-modal="true"]');
    // Pages can keep multiple dormant dialogs in the DOM. The focused one wins.
    var ancestor = current;
    while (ancestor && ancestor !== doc.body) {
      if (ancestor.getAttribute('role') === 'dialog') { dialog = ancestor; break; }
      ancestor = ancestor.parentNode;
    }
    var scope = dialog && dialog.getClientRects().length ? dialog : doc;
    var candidates = scope.querySelectorAll(controls);
    var from = current.getBoundingClientRect();
    var x = (from.left + from.right) / 2, y = (from.top + from.bottom) / 2;
    var best, bestScore = Infinity;
    for (var i = 0; i < candidates.length; i++) {
      var item = candidates[i];
      if (item === current || item.disabled || item.tabIndex < 0 || item.getAttribute('aria-disabled') === 'true' ||
          !item.getClientRects().length || win.getComputedStyle(item).visibility === 'hidden') continue;
      if (current === doc.body) { best = item; break; }
      var bounds = item.getBoundingClientRect();
      var dx = (bounds.left + bounds.right) / 2 - x, dy = (bounds.top + bounds.bottom) / 2 - y;
      var forward = direction[0] * dx + direction[1] * dy;
      if (forward < 2) continue;
      var sideways = Math.abs(direction[0] * dy + direction[1] * dx);
      var score = forward + 3 * sideways;
      if (score < bestScore) { best = item; bestScore = score; }
    }
    if (!best) return;
    event.preventDefault();
    best.focus();
  });
}(window, document));
