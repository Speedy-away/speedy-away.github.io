(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.ConsoleServiceOpener = api; api.bind(document); }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var services = {manager: {port: 8084, path: '/'}, files: {port: 8080, path: '/fs/'}, 'ps4-files': {port:8080,path:'/'}, homebrew: {port: 8080, path: '/index.html'}, patches: {port: 23900, path: '/'}};
  function normalizeAddress(value) {
    var input = String(value || '').trim();
    if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(input)) throw Error('Enter the console IPv4 address, for example 192.168.1.50.');
    var parts = input.split('.').map(Number);
    if (parts.some(function (part) { return part > 255; })) throw Error('Each part of the IP address must be between 0 and 255.');
    if (!(parts[0] === 10 || parts[0] === 127 || parts[0] === 192 && parts[1] === 168 || parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)) throw Error('Use the console’s private local-network address.');
    return parts.join('.');
  }
  function buildServiceUrl(address, service) {
    if (!services[service]) throw Error('Unknown console service.');
    return 'http://' + normalizeAddress(address) + ':' + services[service].port + services[service].path;
  }
  function consoleAddress(value, platform, userAgent) {
    var address = normalizeAddress(value), matching = new RegExp('PlayStation\\s*' + (platform === 'ps4' ? '4' : '5') + '\\b','i').test(userAgent || '');
    if (/^127\./.test(address) && !matching) throw Error('Enter the ' + platform.toUpperCase() + ' LAN address when using another device.');
    return address;
  }
  function bind(doc) {
    var form = doc.querySelector('[data-console-service-opener]');
    if (!form) return;
    var input = form.querySelector('input'), status = form.querySelector('[role="status"]');
    var platform = form.getAttribute('data-platform') === 'ps4' ? 'ps4' : 'ps5';
    var storageKey = 'whatsite.' + platform + '.service-address';
    var links = form.querySelectorAll('[data-console-service]');
    function update() {
      try {
        var address = consoleAddress(input.value,platform,navigator.userAgent);
        for (var i = 0; i < links.length; i++) { var service = links[i].getAttribute('data-console-service'); links[i].href = buildServiceUrl(address,platform === 'ps4' && service === 'files' ? 'ps4-files' : service); links[i].removeAttribute('aria-disabled'); }
        status.textContent = 'Ready to open ' + platform.toUpperCase() + ' at ' + address + '. Its console service must be running.';
        try { localStorage.setItem(storageKey, address); } catch (_) {}
      } catch (error) {
        for (var j = 0; j < links.length; j++) { links[j].removeAttribute('href'); links[j].setAttribute('aria-disabled', 'true'); }
        status.textContent = error.message;
      }
    }
    try { input.value = localStorage.getItem(storageKey) || ''; } catch (_) {}
    var matching = new RegExp('PlayStation\\s*' + (platform === 'ps4' ? '4' : '5') + '\\b','i').test(navigator.userAgent);
    if (!input.value && matching) input.value = '127.0.0.1';
    input.addEventListener('input', update);
    var loopback = form.querySelector('[data-use-loopback]'); loopback.hidden = !matching; loopback.disabled = !matching;
    loopback.addEventListener('click', function () { if (matching) { input.value = '127.0.0.1'; update(); } });
    var labels = {manager:'Open PS5 Payload Manager',files:'Open '+platform.toUpperCase()+' file manager',homebrew:'Open PS5 homebrew launcher',patches:'Open '+platform.toUpperCase()+' patch manager'};
    for (var n = 0; n < links.length; n++) if (labels[links[n].getAttribute('data-console-service')]) links[n].textContent = labels[links[n].getAttribute('data-console-service')];
    for (var k = 0; k < links.length; k++) links[k].addEventListener('click', function (event) { if (this.getAttribute('aria-disabled') === 'true') event.preventDefault(); });
    form.addEventListener('submit', function (event) { event.preventDefault(); update(); });
    update();
  }
  return {normalizeAddress: normalizeAddress, consoleAddress:consoleAddress, buildServiceUrl: buildServiceUrl, bind: bind};
}));
