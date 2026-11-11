(function (win, doc) {
  'use strict';
  var link = doc.getElementById('package-download-centre');
  if (!link) return;
  var query = ['type=packages'];
  var selected = /(?:\?|&)(?:file|id)=([^&]*)/.exec(win.location.search || '');
  if (selected) {
    try { query.push('file=' + encodeURIComponent(decodeURIComponent(selected[1].replace(/\+/g, ' ')))); }
    catch (_) { query.push('file=unavailable'); }
  }
  var hash = /^(?:#setup|#workflow)$/.test(win.location.hash) ? '#package-setup' :
    win.location.hash === '#extract' ? '#extract' : '#downloads';
  var destination = link.href.split(/[?#]/)[0] + '?' + query.join('&') + hash;
  link.href = destination;
  win.location.replace(destination);
}(window, document));
