(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.HostSelfHost = api; api.install(root.document, root); }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function install(doc, win) {
    if (!doc || !win) return;
    var trigger = doc.getElementById('host-self-host-trigger');
    var overlay = doc.getElementById('host-self-host-overlay');
    var closeButton = doc.getElementById('host-self-host-close');
    if (!trigger || !overlay || !closeButton || trigger.getAttribute('data-self-host-ready')) return;
    trigger.setAttribute('data-self-host-ready', 'true');
    var returnFocus = null, previousOverflow = '', opened = false;
    function close() {
      if (!opened) return;
      opened = false;
      overlay.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
      doc.body.style.overflow = previousOverflow;
      if (returnFocus && returnFocus.focus) returnFocus.focus();
    }
    function open() {
      if (opened) return;
      returnFocus = doc.activeElement || trigger;
      previousOverflow = doc.body.style.overflow;
      doc.body.style.overflow = 'hidden';
      opened = true;
      overlay.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
      if (win.__scoobyI18n && win.__scoobyI18n.refresh) win.__scoobyI18n.refresh(overlay);
      closeButton.focus();
    }
    trigger.addEventListener('click', open);
    closeButton.addEventListener('click', close);
    overlay.addEventListener('click', function (event) { if (event.target === overlay) close(); });
    doc.addEventListener('keydown', function (event) {
      if (!opened) return;
      if (event.key === 'Escape') { event.preventDefault(); close(); return; }
      if (event.key !== 'Tab') return;
      var controls = Array.prototype.filter.call(overlay.querySelectorAll('a[href],button:not([disabled]),[tabindex="0"]'), function (node) {
        return !node.hidden && (node.offsetWidth || node.offsetHeight || node === doc.activeElement);
      });
      var first = controls[0] || closeButton, last = controls[controls.length - 1] || closeButton;
      if (event.shiftKey && (doc.activeElement === first || !overlay.contains(doc.activeElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (doc.activeElement === last || !overlay.contains(doc.activeElement))) {
        event.preventDefault(); first.focus();
      }
    });
    return {open: open, close: close};
  }
  return {install: install};
}));
