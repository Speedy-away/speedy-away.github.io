(function (global) {
  'use strict';

  function trim(value) {
    return String(value == null ? '' : value).replace(/^\s+|\s+$/g, '');
  }

  function normalizeConsoleHost(value) {
    var host = trim(value).toLowerCase();
    var parts;
    var numbers;
    var i;
    if (host === 'localhost') return 'localhost';
    if (host === '::1' || host === '[::1]') return '[::1]';
    if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return null;
    parts = host.split('.');
    numbers = [];
    for (i = 0; i < parts.length; i += 1) {
      if (parts[i].length > 1 && parts[i].charAt(0) === '0') return null;
      numbers[i] = Number(parts[i]);
      if (numbers[i] > 255) return null;
    }
    if (numbers[0] === 127 || numbers[0] === 10 ||
        (numbers[0] === 172 && numbers[1] >= 16 && numbers[1] <= 31) ||
        (numbers[0] === 192 && numbers[1] === 168) ||
        (numbers[0] === 169 && numbers[1] === 254)) {
      return numbers.join('.');
    }
    return null;
  }

  function buildReceiverURL(platform, host, fileId) {
    var normalized = normalizeConsoleHost(host);
    var path;
    if (!normalized || (platform !== 'ps4' && platform !== 'ps5')) return null;
    path = platform === 'ps4' ? '/data/whatsite-ps4.html' : '/whatsite-ps5.html';
    if (fileId != null && String(fileId) !== '') {
      try {
        path += '?file=' + encodeURIComponent(String(fileId));
      } catch (error) {
        return null;
      }
    }
    return 'http://' + normalized + ':6701' + path;
  }

  function buildPreparationURL(platform, host) {
    var normalized = normalizeConsoleHost(host);
    if (!normalized || (platform !== 'ps4' && platform !== 'ps5')) return null;
    return 'http://' + normalized + (platform === 'ps4'
      ? ':8080/data/whatsite-ps4.html'
      : ':9090/data/homebrew/ezremote-client/assets/whatsite-ps5.html') + '?prepare=1';
  }

  function matchesFilter(searchText, category, query, filter) {
    var text = String(searchText || '').toLowerCase();
    var words = trim(query).toLowerCase().split(/\s+/);
    var i;
    if (filter && filter !== 'all' && category !== filter) return false;
    for (i = 0; i < words.length; i += 1) {
      if (words[i] && text.indexOf(words[i]) < 0) return false;
    }
    return true;
  }

  function matchesFormat(filename, format) {
    var archive = /\.(?:zip|rar|7z)$/i.test(String(filename || ''));
    return !format || format === 'all' || (format === 'archives' ? archive : !archive);
  }

  function install(document) {
    var center = document.getElementById('console-download-center');
    var search;
    var cards;
    var buttons;
    var copyButtons;
    var count;
    var empty;
    var address;
    var apply;
    var addressStatus;
    var copyStatus;
    var platform;
    var activeFilter = 'all';
    var format;
    var activeFormat = 'ready';
    var i;
    if (!center || center.getAttribute('data-downloads-ready') === 'true') return;
    center.setAttribute('data-downloads-ready', 'true');
    platform = center.getAttribute('data-platform');
    search = document.getElementById('console-file-search');
    format = document.getElementById('console-file-format');
    if (format) activeFormat = format.value || 'ready';
    cards = center.querySelectorAll('article.console-download-card');
    buttons = center.querySelectorAll('button[data-download-filter]');
    count = document.getElementById('console-file-count');
    empty = document.getElementById('console-file-empty');
    address = document.getElementById('console-address');
    apply = document.getElementById('console-address-apply');
    addressStatus = document.getElementById('console-address-status');

    function updateFiles() {
      var query = search ? search.value : '';
      var visible = 0;
      var n;
      var show;
      for (n = 0; n < cards.length; n += 1) {
        show = matchesFilter(cards[n].getAttribute('data-search') || cards[n].textContent,
          cards[n].getAttribute('data-category'), query, activeFilter) &&
          matchesFormat(cards[n].getAttribute('data-filename'), activeFormat);
        cards[n].hidden = !show;
        if (show) visible += 1;
      }
      for (n = 0; n < buttons.length; n += 1) {
        buttons[n].setAttribute('aria-pressed',
          buttons[n].getAttribute('data-download-filter') === activeFilter ? 'true' : 'false');
      }
      if (count) count.textContent = visible + ' of ' + cards.length + ' files';
      if (empty) empty.hidden = visible !== 0;
    }

    function applyAddress(showMessage) {
      var host = normalizeConsoleHost(address ? address.value : '127.0.0.1');
      var links;
      var n;
      var href;
      if (!host) {
        if (address) address.setAttribute('aria-invalid', 'true');
        if (addressStatus) {
          addressStatus.textContent = 'Enter localhost, a loopback, private LAN or link-local IPv4 address, without a port or path.';
          addressStatus.setAttribute('data-status', 'error');
        }
        if (showMessage && address) address.focus();
        return false;
      }
      if (address) {
        address.value = host;
        address.removeAttribute('aria-invalid');
      }
      links = center.querySelectorAll('a[data-receiver-file], a[data-receiver-open]');
      for (n = 0; n < links.length; n += 1) {
        href = buildReceiverURL(platform, host,
          links[n].hasAttribute('data-receiver-file') ? links[n].getAttribute('data-receiver-file') : null);
        if (href) links[n].setAttribute('href', href);
      }
      links = center.querySelectorAll('a[data-client-open]');
      for (n = 0; n < links.length; n += 1) {
        href = buildPreparationURL(platform, host);
        if (href) links[n].setAttribute('href', href);
      }
      if (addressStatus) {
        addressStatus.removeAttribute('data-status');
        if (showMessage) {
          addressStatus.textContent = 'Links now use http://' + host + ':6701. Open a receiver link to continue.';
        }
      }
      return true;
    }

    function copyLink(event) {
      var button = event.currentTarget;
      var field = document.getElementById(button.getAttribute('data-copy-target'));
      var copied = false;
      if (!field || typeof field.select !== 'function') return;
      field.focus();
      field.select();
      if (typeof field.setSelectionRange === 'function') {
        try { field.setSelectionRange(0, field.value.length); } catch (error) { /* Selection remains visible. */ }
      }
      try {
        copied = typeof document.execCommand === 'function' && document.execCommand('copy') === true;
      } catch (error) { copied = false; }
      if (!copyStatus) {
        copyStatus = document.getElementById('console-copy-status');
        if (!copyStatus) {
          copyStatus = document.createElement('p');
          copyStatus.id = 'console-copy-status';
          copyStatus.className = 'console-download-copy-status';
          copyStatus.setAttribute('role', 'status');
          copyStatus.setAttribute('aria-live', 'polite');
          center.insertBefore(copyStatus, center.firstChild);
        }
      }
      copyStatus.textContent = copied ? 'Link copied.' : 'Link selected. Use your browser\u2019s Copy command.';
    }

    if (search) {
      search.addEventListener('input', updateFiles);
      search.addEventListener('change', updateFiles);
    }
    if (format) format.addEventListener('change', function () {
      activeFormat = format.value || 'ready';
      updateFiles();
    });
    for (i = 0; i < buttons.length; i += 1) {
      buttons[i].setAttribute('type', 'button');
      if (buttons[i].getAttribute('aria-pressed') === 'true') {
        activeFilter = buttons[i].getAttribute('data-download-filter');
      }
      buttons[i].addEventListener('click', function (event) {
        activeFilter = event.currentTarget.getAttribute('data-download-filter') || 'all';
        updateFiles();
      });
    }
    if (apply) {
      apply.setAttribute('type', 'button');
      apply.addEventListener('click', function () { applyAddress(true); });
    }
    if (address) {
      if (!trim(address.value)) address.value = '127.0.0.1';
      address.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.keyCode === 13) {
          event.preventDefault();
          applyAddress(true);
        }
      });
    }
    copyButtons = center.querySelectorAll('button[data-copy-target]');
    for (i = 0; i < copyButtons.length; i += 1) {
      copyButtons[i].setAttribute('type', 'button');
      copyButtons[i].addEventListener('click', copyLink);
    }
    // A game guide may select one exact build. Preserve intentional archive
    // links while keeping the normal console catalogue focused on ready files.
    var selected = global && global.location && String(global.location.search || '').match(/[?&]file=([^&]+)/);
    var selectedId;
    if (selected) {
      try { selectedId = decodeURIComponent(selected[1]); } catch (error) { selectedId = ''; }
      for (i = 0; i < cards.length; i += 1) {
        if (cards[i].getAttribute('data-file-id') !== selectedId) continue;
        activeFormat = matchesFormat(cards[i].getAttribute('data-filename'), 'archives') ? 'archives' : 'ready';
        if (format) format.value = activeFormat;
        if (search) search.value = cards[i].getAttribute('data-filename');
        break;
      }
    }
    applyAddress(false);
    updateFiles();
  }

  if (typeof module === 'object' && module.exports) {
    module.exports = {
      normalizeConsoleHost: normalizeConsoleHost,
      buildReceiverURL: buildReceiverURL,
      buildPreparationURL: buildPreparationURL,
      matchesFilter: matchesFilter,
      matchesFormat: matchesFormat,
      install: install
    };
  }
  if (global && global.document) {
    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', function () { install(global.document); });
    } else {
      install(global.document);
    }
  }
}(typeof window === 'undefined' ? null : window));
