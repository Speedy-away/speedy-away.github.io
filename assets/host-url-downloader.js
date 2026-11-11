(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.WWBURLDownloader = api; api.install(root.document, root); }
}(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  var active;

  function install(doc, win) {
    var form = doc.getElementById('host-url-form');
    if (!form) return;
    var panel = doc.getElementById('host-url-downloader');
    var platform = panel.getAttribute('data-platform');
    var shared = win.ConsoleURLDownloads;
    var transport = win.WWBConsoleDownloads;
    var input = doc.getElementById('host-url-input');
    var filename = doc.getElementById('host-url-filename');
    var message = doc.getElementById('host-url-status');
    var review = doc.getElementById('host-url-review');
    var browser = doc.getElementById('host-url-browser');
    var consoleLink = doc.getElementById('host-url-console');
    var connectionHelp = doc.getElementById('host-url-connection-help');
    var updateHelp = doc.getElementById('host-url-update-help');
    var prepared = null, host = '', manualName = false;
    var detected = /PlayStation\s*([45])\b/i.exec(win.navigator.userAgent);
    if (detected && 'ps' + detected[1] === platform) {
      host = '127.0.0.1';
      if (updateHelp) updateHelp.setAttribute('href', '#host-' + platform + '-update');
    }

    function clearReview() {
      prepared = null;
      review.hidden = true;
      browser.removeAttribute('href');
      consoleLink.removeAttribute('href');
      consoleLink.hidden = true;
      message.textContent = '';
      input.removeAttribute('aria-invalid');
      filename.removeAttribute('aria-invalid');
    }

    function updateConsole() {
      consoleLink.hidden = !prepared || !host;
      connectionHelp.hidden = Boolean(host);
      if (prepared && host) {
        consoleLink.href = transport.buildReceiverURL(platform, host, 'custom-url') + shared.fragment(prepared);
      } else consoleLink.removeAttribute('href');
    }

    function setHost(value) {
      host = transport && transport.normalizeConsoleHost(value) || '';
      updateConsole();
    }

    if (!shared || !transport || !/^ps[45]$/.test(platform)) {
      message.textContent = 'The URL downloader could not load. Refresh this page.';
      doc.getElementById('host-url-continue').disabled = true;
      return;
    }

    input.addEventListener('input', function () {
      clearReview();
      if (!manualName) {
        try { filename.value = shared.suggestFilename(input.value); }
        catch (_) { filename.value = ''; }
      }
    });
    filename.addEventListener('input', function () {
      manualName = Boolean(filename.value);
      clearReview();
    });
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      clearReview();
      var invalidField = input;
      try {
        shared.suggestFilename(input.value);
        invalidField = filename;
        prepared = shared.prepare(input.value, filename.value);
      } catch (error) {
        message.textContent = error.message;
        invalidField.setAttribute('aria-invalid', 'true');
        if (invalidField === filename && filename.parentNode) filename.parentNode.open = true;
        invalidField.focus();
        return;
      }
      filename.value = prepared.filename;
      doc.getElementById('host-url-name').textContent = prepared.filename;
      doc.getElementById('host-url-source').textContent = prepared.url;
      browser.href = prepared.url;
      browser.setAttribute('download', prepared.filename);
      review.hidden = false;
      updateConsole();
      message.textContent = 'Link ready. Choose where to download it.';
    });
    doc.getElementById('host-url-clear').addEventListener('click', function () {
      clearReview();
      input.value = '';
      filename.value = '';
      manualName = false;
      input.focus();
    });
    active = {setHost:setHost};
    updateConsole();
    return active;
  }

  return {install:install, setHost:function (host) { if (active) active.setHost(host); }};
}));
