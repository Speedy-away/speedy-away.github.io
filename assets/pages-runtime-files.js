// Deployment-only transport for preserved runtime data. Native JS stays local.
(function (win) {
  'use strict';
  var files = win.WHATSITE_RUNTIME_FILES;
  if (!files || win.whatsiteRepositoryRuntimeFiles) return;
  win.whatsiteRepositoryRuntimeFiles = true;
  function route(value, method) {
    if (method && !/^(GET|HEAD)$/i.test(method)) return value;
    try {
      var url = new win.URL(String(value), win.location.href);
      if (url.origin !== win.location.origin || !/^\/hosts\/runtime\/karo-[^/]+\/web\//.test(url.pathname)) return value;
      var target = files[decodeURIComponent(url.pathname)];
      if (typeof target === 'string' && /^https:\/\/raw\.githubusercontent\.com\/Speedy-away\/whatsite\/[a-f0-9]{40}\/hosts\/runtime\/karo-[^/]+\/web\/.+\.(bin|elf|bz2|zip)$/i.test(target)) return target;
    } catch (ignore) {}
    return value;
  }
  if (win.XMLHttpRequest) {
    var open = win.XMLHttpRequest.prototype.open, header = win.XMLHttpRequest.prototype.setRequestHeader;
    win.XMLHttpRequest.prototype.open = function (method, value) {
      var args = Array.prototype.slice.call(arguments), target = route(value, method);
      args[1] = target;
      var result = open.apply(this, args);
      this.whatsiteRepositoryFile = target !== value;
      if (this.whatsiteRepositoryFile) this.withCredentials = false;
      return result;
    };
    win.XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
      if (this.whatsiteRepositoryFile && /^(authorization|cookie|proxy-authorization)$/i.test(name)) return;
      return header.call(this, name, value);
    };
  }
  if (win.fetch) {
    var fetch = win.fetch;
    win.fetch = function (value, options) {
      var request = typeof value === 'object' && value && typeof value.url === 'string';
      var original = request ? value.url : value, method = options && options.method || request && value.method || 'GET';
      var target = route(original, method);
      if (target === original) return fetch.apply(this, arguments);
      var safe = {}, key;
      if (options) for (key in options) if (Object.prototype.hasOwnProperty.call(options, key)) safe[key] = options[key];
      if (request) for (var i = 0, inherited = ['signal', 'cache', 'integrity']; i < inherited.length; i++) {
        key = inherited[i]; if (!(key in safe) && value[key] !== undefined) safe[key] = value[key];
      }
      safe.method = method; safe.mode = 'cors'; safe.credentials = 'omit'; safe.redirect = 'error';
      if (win.Headers) {
        var headers = new win.Headers(options && options.headers || request && value.headers || {});
        headers.delete('Authorization'); headers.delete('Cookie'); headers.delete('Proxy-Authorization');
        safe.headers = headers;
      } else delete safe.headers;
      return fetch.call(this, target, safe);
    };
  }
  if (win.document) win.document.addEventListener('click', function (event) {
    var node = event.target;
    while (node && node.tagName !== 'A') node = node.parentNode;
    if (node && node.href) {
      var target = route(node.href, 'GET');
      if (target !== node.href) node.href = target;
    }
  }, true);
}(typeof window === 'undefined' ? {} : window));
