(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else api.install(root.document, root);
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  // Authored entry controls only. No original exploit or payload is evaluated here.
  var firmwareList = ['13.60','13.42','13.40','13.20','13.00','12.70','12.60','12.40','12.20','12.02','12.00','11.60','11.20','11.00','10.60','10.40','10.20','10.01','10.00','9.60','9.40','9.20','9.00','8.60','8.40','8.20','8.00','7.61','7.60','7.40','7.20','7.01','7.00'];
  var ticketKey = 'wwb.ps5-webkit.dd8e4e0914c5.start';
  function detected(ua) {
    var match = /PlayStation 5\/(\d+\.\d+)/.exec(String(ua || ''));
    return match && firmwareList.indexOf(match[1]) !== -1 ? match[1] : '';
  }
  function permitted(win, doc) {
    return Boolean(detected(win.navigator.userAgent)) && win.top === win.self && doc.visibilityState === 'visible' && !doc.wasDiscarded && /^https?:$/.test(win.location.protocol);
  }
  function navigationType(win) {
    var entry = win.performance && win.performance.getEntriesByType && win.performance.getEntriesByType('navigation')[0];
    return entry && entry.type || '';
  }
  function exactRunPath(win, value) {
    var match = String(win.location.pathname).match(/^(\/(?:(?:WWB-HOST|wwb-host)\/)?hosts\/runtime\/ps5-webkit-dd8e4e0914c5\/)(?:index\.html|web\/index\.html)?$/);
    if (!match) throw Error('Invalid local entry path');
    var expected = match[1] + 'web/index.html', declared = new URL(value, win.location.href);
    var unprefixed = expected.replace(/^\/(?:WWB-HOST|wwb-host)/, '');
    if (declared.origin !== win.location.origin || declared.search || declared.hash || (declared.pathname !== expected && declared.pathname !== unprefixed)) throw Error('Invalid local run path');
    return expected;
  }
  function install(doc, win, explicitConfig) {
    var node = doc.getElementById('runtime-config'), config;
    try { config = explicitConfig || JSON.parse(node.textContent); } catch (_) { return false; }
    var status = doc.getElementById('runtime-status');
    function tell(message) { if (status) status.textContent = message; }
    function clearTicket() { try { win.sessionStorage.removeItem(ticketKey); } catch (_) {} }
    if (!config || ['entry','run'].indexOf(config.mode) === -1 || !/\/web\/index\.html$/.test(config.runPath)) return false;
    try { config = {mode:config.mode,runPath:exactRunPath(win,config.runPath)}; } catch (_) { clearTicket(); tell('The local entry path is invalid. Nothing was started.'); return false; }
    if (config.mode === 'entry') {
      var button = doc.getElementById('runtime-start');
      if (!button) return false;
      button.disabled = !permitted(win, doc);
      clearTicket();
      tell(button.disabled ? 'Open this page in a supported PS5 browser.' : 'Detected PS5 ' + detected(win.navigator.userAgent) + '. Press Start when ready.');
      button.addEventListener('click', function (event) {
        if (!event.isTrusted || button.disabled || !permitted(win, doc)) return;
        button.disabled = true;
        try {
          var ticket = {origin:win.location.origin,runPath:config.runPath,firmware:detected(win.navigator.userAgent),at:Date.now()};
          win.sessionStorage.setItem(ticketKey,JSON.stringify(ticket));
          if (win.sessionStorage.getItem(ticketKey) !== JSON.stringify(ticket)) throw Error('Storage refused');
          win.location.href = config.runPath;
        } catch (_) { clearTicket(); tell('Browser session storage is unavailable. Nothing was started.'); }
      });
      if (win.addEventListener) win.addEventListener('pageshow',function (event) { if (event.persisted) { clearTicket(); button.disabled = true; tell('Reopen the entry page before starting a new attempt.'); } });
      return true;
    }
    // Consume authorization before creating any original script element.
    var ticket;
    try { ticket = JSON.parse(win.sessionStorage.getItem(ticketKey) || 'null'); win.sessionStorage.removeItem(ticketKey); } catch (_) { ticket = null; }
    var age = ticket ? Date.now() - ticket.at : Infinity;
    if (!permitted(win, doc) || !ticket || ticket.origin !== win.location.origin || ticket.runPath !== config.runPath || config.runPath !== win.location.pathname || ticket.firmware !== detected(win.navigator.userAgent) || age < 0 || age > 30000 || ['reload','back_forward'].indexOf(navigationType(win)) !== -1) {
      tell('Start from the PS5 WebKit entry page. This attempt was not authorized.');
      return false;
    }
    var scripts = [['./src/firmware.js',''],['./src/main.js',''],['./src/rop.js',''],['./src/utils/syscalls.js',''],['./src/site.js','module']], index = 0;
    function next() {
      if (index >= scripts.length) return;
      var item = scripts[index++], script = doc.createElement('script');
      if (item[1]) script.type = item[1];
      script.async = false; script.src = item[0]; script.onload = next;
      script.onerror = function () { tell('A local runtime file could not be loaded. Nothing will be retried automatically.'); };
      doc.body.appendChild(script);
    }
    tell('Starting the local PS5 WebKit chain. Follow its own status below.');
    next();
    return true;
  }
  return {exactRunPath:exactRunPath,firmwares:firmwareList,ticketKey:ticketKey,detected:detected,permitted:permitted,install:install};
}));
