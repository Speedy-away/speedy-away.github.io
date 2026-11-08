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
    var saveURL = destination && item.receiverSupported !== false && transport.buildReceiverURL(platform, destination, item.id);
    var archive = transport.matchesFormat(item.filename, 'archives');
    var reviewed = archive && item.receiverSupported !== false && item.archiveSafety && item.archiveSafety.reviewed === true;
    var saveLabel = reviewed ? 'Save / extract on ' : packageFile(item) ? 'Save / install on ' : 'Save on ';
    if (saveURL) link(controls, saveLabel + platform.toUpperCase(), saveURL, 'host-download-primary');
    if (saveURL && packageFile(item)) add(card, 'p',
      'Watch the progress in the console queue. When ready, choose Install PKG to verify the file and open the compatible installer.', 'host-download-meta');
    if (archive) add(card, 'p', reviewed
      ? 'Watch the progress in the console queue. When ready, choose Extract. The preparation page checks the SHA-256 and extracts into a new folder.'
      : 'Save the archive first, then extract it with the installed console file manager. Follow the build’s compatibility guide.', 'host-download-meta');
    var direct = link(controls, 'Download file', httpsURL(item.url));
    direct.setAttribute('download', item.filename);
    direct.setAttribute('data-no-file-options', '');
    var help = httpsURL(item.pages && item.pages[platform] || item.page);
    var support = httpsURL(item.requiresSupportArchive);
    if (support) link(controls, 'Required support pack', support);
    var details = add(card, 'details');
    add(details, 'summary', 'File details');
    add(details, 'code', item.displayFilename || item.filename);
    add(details, 'code', direct.href);
    add(details, 'code', item.sha256);
    if (help) link(details, 'Compatibility guide', help);
    if (item.receiverSupported === false) {
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
    if (items.length) render();
  }

  if (!transport || (platform !== 'ps4' && platform !== 'ps5')) {
    status.textContent = 'The download controls did not load. Refresh this page.';
    return;
  }
  if (destination) address.value = destination;
  showNativeTools();
  if (win.location.hash === '#setup') doc.getElementById('setup').open = true;
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
