/* Display authored launcher state and delegate trusted starts to HostSiteLoad. */
(function (win, doc) {
  'use strict';
  var ua = String(win.navigator.userAgent || '');
  var device = /PlayStation\s+(4|5)[ /]+(\d+\.\d+)/i.exec(ua);
  var output = doc.querySelector('[data-ps5-deck-firmware]');
  if (output) output.textContent = device ? 'PS' + device[1] + ' ' + device[2] : 'No PlayStation detected';

  var log = doc.getElementById('ps5-deck-log');
  var last = '', lines = [];
  function record(message) {
    if (!message || message === last || !log) return;
    last = message;
    lines.push('[' + new Date().toLocaleTimeString() + '] ' + message);
    if (lines.length > 20) lines.shift();
    log.textContent = lines.join('\n');
    log.scrollTop = log.scrollHeight;
  }

  var data = doc.getElementById('ps5-launch-data');
  if (!data) {
    var authoredStatus = doc.getElementById('runtime-status') || doc.getElementById('host-local-status');
    if (!authoredStatus) return;
    function mirrorStatus() { record(authoredStatus.textContent); }
    mirrorStatus();
    if (win.MutationObserver) new win.MutationObserver(mirrorStatus).observe(authoredStatus, {childList:true, subtree:true, characterData:true});
    return;
  }

  var start = doc.getElementById('ps5-launch-start');
  var status = doc.getElementById('ps5-launch-status');
  if (!status || !start) return;
  function tell(message) {
    status.textContent = message;
    record(message);
  }
  var action, controller = win.HostSiteLoad;
  // Match the existing native receiver's exact UA contract.
  var ps5 = /PlayStation 5\/(\d+\.\d+)/.exec(ua);
  try {
    action = JSON.parse(data.textContent);
    if (!controller || !action || action.platform !== 'ps5' || !Array.isArray(action.firmwares) ||
        !action.nativeRoute || action.nativeRoute.kind !== 'ps5-native') throw Error('Invalid launcher');
  } catch (_) {
    tell('Launcher settings could not be loaded. Reload this page.');
    return;
  }

  var matches = ps5 && action.firmwares.indexOf(ps5[1]) !== -1;
  var restored = false, starting = false;
  function visible() { return win.top === win.self && doc.visibilityState === 'visible' && !doc.wasDiscarded; }
  function update() {
    start.disabled = restored || starting || !matches || !visible();
    if (restored) tell('Check the console and reopen this entry before starting another attempt.');
    else if (!matches) tell(action.firmwares.length === 1 ? 'Open this page on PS5 firmware ' + action.firmwares[0] + '.' :
      'Open this page in a PS5 browser with one of the exact supported firmware versions.');
    else if (!visible()) tell('Keep this PS5 launcher in the active browser tab.');
    else tell('PS5 ' + ps5[1] + ' detected. Press Load WebKit when ready.');
  }

  doc.addEventListener('visibilitychange', function () { if (!starting) update(); });
  win.addEventListener('pageshow', function (event) {
    if (event.persisted) { restored = true; start.removeAttribute('aria-busy'); update(); }
  });
  start.addEventListener('click', function (event) {
    if (event.isTrusted !== true || start.disabled || starting || !visible()) return;
    starting = true;
    start.disabled = true;
    start.setAttribute('aria-busy', 'true');
    try {
      var target = controller.start(win, doc, action, true);
      tell('Opening the native PS5 loader. Its live log follows.');
      win.location.href = target;
    } catch (error) {
      // A failed navigation must not leave a usable native ticket behind.
      var match = /\/ps5-webkit-([a-f0-9]{12})\/web\/index\.html$/.exec(action.nativeRoute.target);
      if (match) {
        try { win.sessionStorage.removeItem('wwb.ps5-webkit.' + match[1] + '.start'); } catch (_) {}
      }
      start.removeAttribute('aria-busy');
      tell((error && error.message) || 'The loader could not be opened. Reload this page.');
    }
  });
  update();
}(window, document));
