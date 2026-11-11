(function (win, doc) {
  'use strict';

  var desk = doc.getElementById('host-download-desk');
  if (!desk) return;
  var platform = desk.getAttribute('data-platform');
  var packagesOnly = desk.getAttribute('data-library') === 'packages';
  var library = desk.getAttribute('data-catalogue');
  var transport = win.WWBConsoleDownloads;
  var results = doc.getElementById('host-download-results');
  var status = doc.getElementById('host-download-status');
  var search = doc.getElementById('host-download-search');
  var type = doc.getElementById('host-download-type');
  var more = doc.getElementById('host-download-more');
  var retry = doc.getElementById('host-download-retry');
  var address = doc.getElementById('host-download-address');
  var addressStatus = doc.getElementById('host-download-address-status');
  var nativeTools = doc.getElementById('host-download-native');
  var quickFilters = desk.querySelectorAll ? desk.querySelectorAll('[data-download-filter]') : [];
  var consolePlatform = /PlayStation\s*([45])\b/i.exec(win.navigator.userAgent);
  var destination = consolePlatform && 'ps' + consolePlatform[1] === platform ? '127.0.0.1' : '';
  var requestedFile = /[?&]file=([^&#]*)/.exec(win.location.search);
  var pinnedId = '';
  var items = [];
  var matches = [];
  var shown = 0;
  var pageSize = 16;
  var typing;

  if (requestedFile) {
    try { pinnedId = decodeURIComponent(requestedFile[1]); } catch (_) { /* Show the library. */ }
  }
  var requestedType = /[?&]type=(archives|packages)(?:&|$)/.exec(win.location.search);
  if (type && !packagesOnly && requestedType) type.value = requestedType[1];

  function add(parent, tag, message, className) {
    var node = doc.createElement(tag);
    if (message) node.textContent = message;
    if (className) node.className = className;
    parent.appendChild(node);
    return node;
  }

  function link(parent, label, href, className) {
    var node = add(parent, 'a', label, className);
    node.href = href;
    return node;
  }

  function httpsURL(value) {
    if (typeof value !== 'string' || !/^(?:https:\/\/|\/(?!\/))/.test(value) || /[\\\x00-\x1f]/.test(value)) return '';
    var resolved = doc.createElement('a');
    resolved.href = value;
    if (resolved.protocol !== 'https:' && !(resolved.host === win.location.host && value.charAt(0) === '/')) return '';
    return resolved.href;
  }

  function packageFile(item) {
    return item.category === 'apps' && /\.pkg$/i.test(item.filename);
  }

  function showNativeTools() {
    if (!nativeTools) return;
    nativeTools.textContent = '';
    nativeTools.hidden = !destination;
    if (!destination) return;
    link(nativeTools, 'Open ezRemote Web UI', transport.buildEzRemoteClientURL(platform, destination));
    link(nativeTools, 'Open download queue', transport.buildReceiverURL(platform, destination));
    link(nativeTools, 'Prepare a storage folder', transport.buildPreparationURL(platform, destination));
  }

  function showDownloaderUpdate() {
    var prefix = 'host-' + platform + '-update';
    var panel = doc.getElementById(prefix);
    if (!panel || !consolePlatform || 'ps' + consolePlatform[1] !== platform) return;
    var release;
    try { release = JSON.parse(doc.getElementById(prefix + '-data').textContent); } catch (_) { return; }
    if (!release || typeof release.version !== 'string' || !/^\d{4}\.\d{2}\.\d{2}\.\d{1,5}$/.test(release.version) ||
        typeof release.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(release.sha256) ||
        typeof release.bytes !== 'number' || release.bytes <= 0 || release.bytes > 2 * 1024 * 1024 || Math.floor(release.bytes) !== release.bytes) return;
    var releaseKey = release.version + '-' + release.sha256.slice(0, 12);
    var sourcePath = '/downloads/helpers/console-download-receivers/' + platform + '/' + releaseKey + '/whatsite-' + platform + '.html';
    var origin = 'https://speedy-away.github.io';
    if (release.url !== origin + sourcePath) return;

    var ps4 = platform === 'ps4';
    var stagingFolder = ps4 ? '/data/' : '/data/homebrew/ezremote-client/assets/';
    var stagingPath = stagingFolder + 'whatsite-' + platform + '-update-' + releaseKey + '.html';
    var form = doc.getElementById(prefix + '-form');
    var field = doc.getElementById(prefix + '-request');
    var button = doc.getElementById(prefix + '-submit');
    var message = doc.getElementById(prefix + '-status');
    var open = doc.getElementById(prefix + '-open');
    var track = doc.getElementById(prefix + '-track');
    var retryUpdate = doc.getElementById(prefix + '-retry');
    var storageKey = 'wwb-downloader-update:' + platform + ':' + releaseKey;
    var requested = '';
    var retryFor = '';
    var attempts = 0;
    var applyURL = 'http://127.0.0.1:' + (ps4 ? '8080' : '9090') + stagingPath +
      '?apply-update=1&sha256=' + release.sha256 + '&bytes=' + release.bytes;
    var trackURL = 'http://127.0.0.1:6701' + (ps4 ? '/data/' : '/') + 'whatsite-' + platform +
      '.html?update-progress=1&version=' + release.version + '&sha256=' + release.sha256 + '&bytes=' + release.bytes;
    track.href = trackURL;
    track.addEventListener('click', function () {
      track.href = trackURL + '&wwb-open=' + new Date().getTime() + '-' + (++attempts);
    });
    open.href = applyURL;
    open.addEventListener('click', function () {
      open.href = applyURL + '&wwb-open=' + new Date().getTime() + '-' + (++attempts);
    });
    function previousRequest() {
      try { return win.localStorage.getItem(storageKey) || requested; } catch (_) { return requested; }
    }
    function showRequestState(previous) {
      var retryEnabled = previous && previous === retryFor;
      button.disabled = Boolean(previous) && !retryEnabled;
      retryUpdate.hidden = !button.disabled;
      button.textContent = (retryEnabled ? 'Retry update ' : 'Download update ') + release.version;
      message.textContent = retryEnabled ? 'One retry is enabled on this page. Choose Retry update to request it again.' :
        button.disabled ? 'Update requested. Open View update progress to see when it is ready.' : '';
    }
    retryUpdate.addEventListener('click', function () {
      retryFor = previousRequest();
      showRequestState(retryFor);
      button.focus();
    });
    form.addEventListener('submit', function (event) {
      var previous = previousRequest();
      if (previous && previous !== retryFor) {
        event.preventDefault();
        showRequestState(previous);
        return;
      }
      var id = new Date().getTime() * 1000;
      var previousId = Number(previous);
      if (previousId >= id && previousId < 9007199254740991 && Math.floor(previousId) === previousId) id = previousId + 1;
      var request = {type:ps4 ? 7 : 6, url:origin, username:'', password:'', http_server_type:'',
        src_path:sourcePath, dest_path:stagingPath, size:release.bytes, id:id};
      // A text/plain form serializes its sole field as name=value plus CRLF.
      // Keep that equals sign inside an ignored JSON string in the request body.
      field.name = JSON.stringify(request).slice(0, -1) + ',"_form":"';
      field.value = '"}';
      requested = String(id);
      retryFor = '';
      try { win.localStorage.setItem(storageKey, requested); } catch (_) { /* Keep the in-page request state. */ }
      showRequestState(requested);
    });
    win.addEventListener('storage', function (event) {
      if (event.key === storageKey) showRequestState(previousRequest());
    });
    showRequestState(previousRequest());
    panel.hidden = false;
  }

  function usable(item) {
    return item && typeof item.id === 'string' && typeof item.name === 'string' &&
      typeof item.filename === 'string' && typeof item.bytes === 'number' && item.bytes > 0 &&
      /^[a-f0-9]{64}$/i.test(item.sha256) && Array.isArray(item.platforms) &&
      item.platforms.indexOf(platform) !== -1 && (!packagesOnly || packageFile(item)) &&
      httpsURL(item.url);
  }

  function showRow(item) {
    var card = add(results, 'article', '', 'host-download-item');
    var header = add(card, 'div', '', 'host-download-item-head');
    var extension = item.filename.split('.').pop().toUpperCase();
    add(header, 'span', extension, 'host-download-format');
    add(header, 'h3', item.name);
    var bytes = item.bytes >= 1048576 ? (item.bytes / 1048576).toFixed(1) + ' MiB' : (item.bytes / 1024).toFixed(1) + ' KiB';
    add(card, 'p', (item.version || 'Archived build') + ' · ' + bytes, 'host-download-meta');
    add(card, 'p', item.compatibility || item.description);
    var controls = add(card, 'div', '', 'host-download-controls');
    var receiverAvailable = Boolean(item.receiverFileId) || item.receiverSupported !== false;
    var saveURL = destination && receiverAvailable &&
      transport.buildReceiverURL(platform, destination, item.receiverFileId || item.id);
    var archive = transport.matchesFormat(item.filename, 'archives');
    var reviewed = archive && receiverAvailable && item.archiveSafety && item.archiveSafety.reviewed === true;
    var saveLabel = reviewed ? 'Save / extract on ' : packageFile(item) ? 'Save / install on ' : 'Save on ';
    if (saveURL) link(controls, saveLabel + platform.toUpperCase(), saveURL, 'host-download-primary');
    if (saveURL && item.receiverFileId) {
      link(add(card, 'p', '', 'host-download-meta'), 'Update the PS5 downloader if this file is unavailable', '#setup');
    }
    var details = add(card, 'details');
    add(details, 'summary', 'File details');
    if (saveURL && packageFile(item)) add(details, 'p',
      'Watch the progress in the console queue. When ready, choose Install PKG to verify the file and open the compatible installer.', 'host-download-meta');
    if (saveURL && archive) add(details, 'p', reviewed
      ? 'Watch the progress in the console queue. When ready, choose Extract. The preparation page checks the SHA-256 and extracts into a new folder.'
      : 'Save the archive first, then extract it with the installed console file manager. Follow the build’s compatibility guide.', 'host-download-meta');
    var direct = link(controls, 'Download file', httpsURL(item.url), saveURL ? '' : 'host-download-primary');
    direct.setAttribute('download', item.filename);
    direct.setAttribute('data-no-file-options', '');
    var help = httpsURL(item.pages && item.pages[platform] || item.page);
    var support = httpsURL(item.requiresSupportArchive);
    if (support) link(controls, 'Required support pack', support);
    add(details, 'code', item.displayFilename || item.filename);
    add(details, 'code', direct.href);
    add(details, 'code', item.sha256);
    if (help) link(details, 'Compatibility guide', help);
    if (!receiverAvailable) {
      add(card, 'p', 'Use the direct URL in ezRemote Client. This file’s original bytes are available from its publisher.');
    }
    if (item.preparation) add(details, 'p', item.preparation);
  }

  function showMore(moveFocus) {
    var limit = Math.min(shown + pageSize, matches.length);
    var first = shown;
    for (; shown < limit; shown += 1) showRow(matches[shown]);
    more.hidden = shown >= matches.length;
    status.textContent = matches.length
      ? 'Showing ' + shown + ' of ' + matches.length + ' files.'
      : pinnedId ? 'This file is unavailable in this catalogue. Clear the exact file selection to browse.' : 'No matching files. Try a different search or file type.';
    if (moveFocus && results.children[first]) {
      var nextLink = results.children[first].querySelector('a');
      if (nextLink) nextLink.focus();
    }
  }

  function render() {
    var query = search.value;
    var filter = type ? type.value : 'all';
    Array.prototype.forEach.call(quickFilters, function (choice) {
      if (choice.getAttribute('data-download-filter') === filter) choice.setAttribute('aria-current', 'true');
      else choice.removeAttribute('aria-current');
    });
    matches = items.filter(function (item) {
      if (pinnedId) return item.id === pinnedId;
      if (filter === 'packages' && !packageFile(item)) return false;
      if (filter === 'archives' && !transport.matchesFormat(item.filename, 'archives')) return false;
      if (filter !== 'packages' && filter !== 'archives' && filter !== 'all' && item.category !== filter) return false;
      return transport.matchesFilter(item.searchText, item.category, query, 'all');
    });
    results.textContent = '';
    shown = 0;
    showMore(false);
  }

  function load() {
    retry.hidden = true;
    status.textContent = 'Opening the ' + platform.toUpperCase() + ' file library…';
    var request = new win.XMLHttpRequest();
    function fail() {
      status.textContent = 'The library could not load. Check the connection and choose Retry.';
      retry.hidden = false;
    }
    request.onload = function () {
      try {
        if (request.status !== 200) throw Error('Catalogue HTTP ' + request.status);
        var catalogue = JSON.parse(request.responseText);
        if (!Array.isArray(catalogue.items)) throw Error('Catalogue is missing its file list.');
        items = catalogue.items.filter(usable);
        items.forEach(function (item) {
          item.searchText = [item.name, item.version, item.filename, item.compatibility, item.description].join(' ');
        });
        render();
      } catch (_) { fail(); }
    };
    request.onerror = fail;
    request.ontimeout = fail;
    try {
      request.open('GET', library, true);
      request.timeout = 15000;
      request.send();
    } catch (_) { fail(); }
  }

  function useAddress(event) {
    event.preventDefault();
    var next = transport.normalizeConsoleHost(address.value);
    if (!next) {
      address.setAttribute('aria-invalid', 'true');
      addressStatus.textContent = 'Enter a private console IP address without a port or path.';
      address.focus();
      return;
    }
    destination = next;
    showNativeTools();
    address.removeAttribute('aria-invalid');
    addressStatus.textContent = 'Save on console links now open ' + next + '. Start the installed ezRemote Server before opening a file.';
    if (items.length) render();
  }

  function clearPin() {
    pinnedId = '';
    if (win.history && win.history.replaceState) {
      var query = win.location.search.slice(1).split('&').filter(function (part) {
        return part && !/^(?:file|type)=/.test(part);
      });
      query.push('type=' + encodeURIComponent(type ? type.value : 'all'));
      try { win.history.replaceState(null, '', win.location.pathname + '?' + query.join('&') + win.location.hash); } catch (_) { /* Filtering still works without history. */ }
    }
    if (items.length) render();
  }

  if (!transport || (platform !== 'ps4' && platform !== 'ps5')) {
    status.textContent = 'The download controls did not load. Refresh this page.';
    return;
  }
  if (destination) address.value = destination;
  showNativeTools();
  showDownloaderUpdate();
  function revealHelp(hash) {
    if (!/^#(?:guide|setup|extract|native-feed|host-ps[45]-update)$/.test(hash)) return;
    var panel = doc.getElementById(hash.slice(1));
    if (panel) panel.open = true;
  }
  revealHelp(win.location.hash);
  win.addEventListener('hashchange', function () { revealHelp(win.location.hash); });
  desk.addEventListener('click', function (event) {
    var target = event.target;
    while (target && target !== desk) {
      if (target.tagName === 'A') {
        revealHelp(target.getAttribute('href') || '');
        break;
      }
      target = target.parentNode;
    }
  });
  Array.prototype.forEach.call(quickFilters, function (choice) {
    choice.addEventListener('click', function (event) {
      if (!type || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || (event.button && event.button !== 0)) return;
      event.preventDefault();
      type.value = choice.getAttribute('data-download-filter');
      clearPin();
    });
  });
  doc.getElementById('host-download-connection').addEventListener('submit', useAddress);
  search.addEventListener('input', function () {
    win.clearTimeout(typing);
    typing = win.setTimeout(clearPin, 120);
  });
  if (type) type.addEventListener('change', clearPin);
  doc.getElementById('host-download-clear').addEventListener('click', function () {
    search.value = '';
    if (type) type.value = 'all';
    clearPin();
    search.focus();
  });
  more.addEventListener('click', function () { showMore(true); });
  retry.addEventListener('click', load);
  load();
}(window, document));
