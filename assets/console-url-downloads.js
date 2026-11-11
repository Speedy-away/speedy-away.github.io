(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ConsoleURLDownloads = api;
}(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  function trim(value) { return String(value == null ? '' : value).replace(/^\s+|\s+$/g, ''); }
  function fail(message) { throw new Error(message); }

  function fileURL(value) {
    if (typeof value !== 'string') fail('Enter a complete HTTP or HTTPS file URL.');
    if (/[\\\x00-\x1f\x7f]/.test(value)) fail('The file URL contains an invalid character.');
    value = trim(value);
    if (!value || value.length > 4096 || /[\s\\\x00-\x1f\x7f]/.test(value) || /%(?![a-f0-9]{2})/i.test(value)) fail('Enter a valid file URL, up to 4096 characters.');
    try { encodeURI(value); } catch (_) { fail('The file URL contains an invalid character.'); }
    var match = /^(https?):\/\/([^\/?#]+)([^#]*)(?:#.*)?$/i.exec(value);
    if (!match || match[2].indexOf('@') !== -1) fail('Use a complete HTTP or HTTPS URL without a username or password.');
    var authority = /^(\[[a-f0-9:]+\]|[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?)(?::([0-9]+))?$/i.exec(match[2]);
    if (!authority || authority[2] && (+authority[2] < 1 || +authority[2] > 65535)) fail('The file URL address or port is invalid.');
    var hostname = authority[1].toLowerCase(), labels, i;
    if (hostname.charAt(0) === '[') {
      var address = hostname.slice(1, -1), halves = address.split('::'), groups = [];
      if (halves.length > 2 || address.indexOf(':') === -1) fail('The file URL IP address is invalid.');
      for (i = 0; i < halves.length; i++) if (halves[i]) groups = groups.concat(halves[i].split(':'));
      if (halves.length === 1 && groups.length !== 8 || halves.length === 2 && groups.length >= 8) fail('The file URL IP address is invalid.');
      for (i = 0; i < groups.length; i++) if (!/^[a-f0-9]{1,4}$/i.test(groups[i])) fail('The file URL IP address is invalid.');
    } else {
      labels = hostname.split('.');
      for (i = 0; i < labels.length; i++) if (!labels[i] || labels[i].charAt(0) === '-' || /-$/.test(labels[i])) fail('The file URL address is invalid.');
      if (/^[0-9.]+$/.test(hostname)) {
        if (labels.length !== 4) fail('Use a complete IP address in the file URL.');
        for (i = 0; i < labels.length; i++) if (+labels[i] > 255 || labels[i].length > 1 && labels[i].charAt(0) === '0') fail('The file URL IP address is invalid.');
      }
    }
    var path = match[3] || '/';
    if (path.charAt(0) !== '/') path = '/' + path;
    return match[1].toLowerCase() + '://' + hostname + (authority[2] ? ':' + authority[2] : '') + path;
  }

  function filename(value) {
    if (typeof value !== 'string' || !value || value.length > 160 || !/^[a-z0-9_()@+-][a-z0-9._() +@-]*$/i.test(value) || /[. ]$/.test(value)) fail('Use a single filename, up to 160 characters, without folders or special characters.');
    return value;
  }

  function suggestFilename(url) {
    var source = fileURL(url), path = source.replace(/^https?:\/\/[^/]+/i, '').split('?')[0];
    var name = path.slice(path.lastIndexOf('/') + 1);
    try { name = decodeURIComponent(name); } catch (_) { /* Use the encoded spelling. */ }
    name = name.replace(/[^a-z0-9._() +@-]/gi, '_').replace(/^[. ]+|[. ]+$/g, '').slice(0, 160).replace(/[. ]+$/g, '');
    return name || 'download';
  }

  function prepare(url, name) {
    url = fileURL(url);
    if (name == null || name === '') name = suggestFilename(url);
    return {url: url, filename: filename(name)};
  }

  function fragment(data) {
    if (!data || typeof data !== 'object') fail('The download link is missing its file details.');
    return '#download-url=' + encodeURIComponent(JSON.stringify(prepare(data.url, data.filename)));
  }

  function fromFragment(hash) {
    hash = String(hash || '');
    if (hash.indexOf('#download-url') !== 0) return null;
    if (hash.indexOf('#download-url=') !== 0 || hash.length > 50000) fail('This custom download link is invalid. Enter the file URL again.');
    var data;
    try { data = JSON.parse(decodeURIComponent(hash.slice(14))); } catch (_) { fail('This custom download link could not be read. Enter the file URL again.'); }
    if (!data || Object.prototype.toString.call(data) !== '[object Object]' || typeof data.filename !== 'string' || !data.filename) fail('This custom download link is missing its filename.');
    for (var key in data) if (Object.prototype.hasOwnProperty.call(data, key) && key !== 'url' && key !== 'filename') fail('This custom download link contains unsupported file details.');
    return prepare(data.url, data.filename);
  }

  return {prepare: prepare, suggestFilename: suggestFilename, fragment: fragment, fromFragment: fromFragment};
}));
