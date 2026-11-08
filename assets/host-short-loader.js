/* Authored preflight and browser-cache status for short host bookmarks. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else api.install(root, root.document);
}(typeof window === 'undefined' ? this : window, function () {
  'use strict';

  function install(win, doc) {
    function node(name) { return doc.getElementById('wwb-short-' + name); }

    var data = node('data'), status = node('status'), log = node('log');
    if (!data || !status || !log) return;

    function record(message) {
      var line = doc.createElement('div');
      line.textContent = '[' + new Date().toLocaleTimeString() + '] ' + message;
      log.appendChild(line);
      if (log.childNodes.length > 40) log.removeChild(log.firstChild);
      log.scrollTop = log.scrollHeight;
    }

    var load = node('load'), retry = node('cache'), progress = node('progress');
    var recovery = node('recovery'), restarted = node('restarted'), clear = node('clear');
    var device = node('device'), cacheState = node('cache-state'), refresh = node('refresh');
    var controller = win.HostSiteLoad, guard = win.WhatsiteKaro;
    var cache, info, action, busy = false, cacheError = '', lastPercent = -10;

    try {
      action = JSON.parse(data.textContent);
      info = controller.firmware(win.navigator.userAgent);
      if (!guard || typeof guard.clear !== 'function' || typeof guard.LOCK !== 'string') throw Error('Missing loader controls.');
    } catch (_) {
      status.textContent = 'The loader controls could not open. Reload this page.';
      record(status.textContent);
      return;
    }

    var matches = info && info.platform === action.platform && action.firmwares.indexOf(info.firmware) !== -1;
    if (device) {
      device.textContent = info ? info.platform.toUpperCase() + ' ' + info.firmware : 'PlayStation not detected';
      device.setAttribute('data-state', matches ? 'ready' : 'blocked');
    }
    record(info ? 'Detected ' + info.platform.toUpperCase() + ' ' + info.firmware + '.' : 'PlayStation browser not detected.');
    if (!matches) {
      if (cacheState) cacheState.textContent = 'Requires PS4 14.00';
      status.textContent = 'Open this page in the PS4 browser on firmware 14.00.';
      record(status.textContent);
      return;
    }

    try { cache = win.applicationCache; } catch (_) {}

    function savedAttempt() { return Boolean(win.localStorage.getItem(guard.LOCK)); }

    function render() {
      try {
        var locked = savedAttempt();
        var cacheStatus = cache && Number(cache.status);
        var ready = cacheStatus === 1 || cacheStatus === 4;
        var saving = cacheStatus === 2 || cacheStatus === 3;
        var canRefresh = refresh && cacheStatus === 4 && typeof cache.swapCache === 'function';
        if (refresh) refresh.hidden = !canRefresh || busy;
        if (cacheState) {
          cacheState.textContent = cacheStatus === 4 ? 'Update ready' : ready ? 'Ready' : cacheError ? 'Check failed' :
            !cache ? 'Unavailable' : saving ? 'Saving files' : 'Waiting';
          cacheState.setAttribute('data-state', ready ? 'ready' : cacheError || !cache ? 'blocked' : 'waiting');
        }
        load.disabled = busy || locked || !ready || Boolean(canRefresh);
        retry.hidden = !cache || ready || saving || busy;
        recovery.hidden = !locked || busy;
        clear.disabled = busy || !locked || !restarted.checked;
        if (busy) return;
        if (locked) status.textContent = 'Check and restart the console before another attempt.';
        else if (canRefresh) status.textContent = 'An updated host is available. Apply it before loading.';
        else if (ready) status.textContent = 'Cache ready. Press Load GoldHEN when you are ready.';
        else if (cacheError) status.textContent = cacheError;
        else if (!cache) status.textContent = 'This browser did not provide the offline cache required by this loader.';
        else if (saving) status.textContent = 'Saving the loader files. Keep this page open.';
        else status.textContent = 'Waiting for the browser cache. Keep this page open or choose Retry cache.';
      } catch (_) {
        load.disabled = true;
        clear.disabled = true;
        if (cacheState) {
          cacheState.textContent = 'Storage unavailable';
          cacheState.setAttribute('data-state', 'blocked');
        }
        status.textContent = 'Browser storage is unavailable. Reopen this page with browser storage enabled.';
      }
    }

    if (cache && typeof cache.addEventListener === 'function') {
      var cacheMessages = {
        checking: 'Browser checking the loader cache.',
        downloading: 'Browser downloading the loader files.',
        cached: 'Cache ready. The browser saved the loader files.',
        noupdate: 'Cache ready. The browser found a current copy.',
        updateready: 'Cache ready. The browser also saved an updated copy.',
        error: 'The browser could not save the cache. Retry while connected.',
        obsolete: 'The saved cache is out of date. Reopen this page while connected.'
      };
      Object.keys(cacheMessages).forEach(function (name) {
        cache.addEventListener(name, function () {
          cacheError = name === 'error' || name === 'obsolete' ? cacheMessages[name] : '';
          if (name === 'checking') lastPercent = -10;
          if (name !== 'downloading') progress.hidden = true;
          record(cacheMessages[name]);
          render();
        });
      });
      cache.addEventListener('progress', function (event) {
        progress.hidden = false;
        if (!event.total) return;
        progress.max = event.total;
        progress.value = event.loaded;
        var percent = Math.floor(event.loaded / event.total * 100);
        if (percent >= lastPercent + 10 || percent === 100) {
          record('Saved ' + event.loaded + ' of ' + event.total + ' cache files.');
          lastPercent = percent;
        }
      });
    }

    retry.addEventListener('click', function () {
      try { cacheError = ''; cache.update(); render(); }
      catch (_) {
        cacheError = 'Cache check could not start. Reload this page while connected.';
        record(cacheError);
        render();
      }
    });
    if (refresh) refresh.addEventListener('click', function (event) {
      if (event.isTrusted !== true || busy || !cache || cache.status !== 4) return;
      try {
        cache.swapCache();
        record('Cache update applied. Reloading the host.');
        win.location.reload();
      } catch (_) {
        status.textContent = 'The cache update could not be applied. Close and reopen this page.';
        record(status.textContent);
      }
    });
    restarted.addEventListener('change', render);
    clear.addEventListener('click', function () {
      if (clear.disabled) return;
      try {
        guard.clear(win, restarted.checked);
        restarted.checked = false;
        record('Saved attempt cleared.');
        render();
      } catch (error) { status.textContent = error.message; record(error.message); }
    });
    load.addEventListener('click', function (event) {
      if (busy || load.disabled || event.isTrusted !== true) return;
      try {
        var target = controller.start(win, doc, action, true);
        busy = true;
        load.setAttribute('aria-busy', 'true');
        render();
        status.textContent = 'Opening the 14.00 loader. Its live log will continue on the next screen.';
        record(status.textContent);
        win.location.href = target;
      } catch (error) {
        busy = false;
        load.removeAttribute('aria-busy');
        render();
        status.textContent = error.message;
        record(error.message);
      }
    });
    win.addEventListener('pageshow', function (event) {
      if (!event.persisted) return;
      busy = false;
      load.removeAttribute('aria-busy');
      render();
    });
    render();
    record(status.textContent);
  }

  return { install: install };
}));
