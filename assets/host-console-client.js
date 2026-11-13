/* Console host connections. No exploit is run and no connection is made on import.
 * Protocol references and limitations: docs/host-console-services.md.
 */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HostConsoleClient = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';
  var services = {
    manager: {port: 8084, path: '/'}, files: {port: 8080, path: '/fs/'},
    homebrew: {port: 8080, path: '/index.html'}, patches: {port: 23900, path: '/'},
    ezremote: {port: 9090, path: '/'}, 'ps4-files': {port: 8080, path: '/'}, saves: {port: 8082, path: '/'}
  };
  function fault(code, message) { var e = new Error(message); e.code = code; return e; }
  function normalizeAddress(value) {
    var input = String(value || '').trim().toLowerCase();
    if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(input)) {
      var a = input.split('.').map(Number);
      if (a.some(function (v) { return v > 255; }) || !(a[0] === 10 || a[0] === 127 || a[0] === 192 && a[1] === 168 || a[0] === 172 && a[1] >= 16 && a[1] <= 31))
        throw fault('invalid-address', 'Enter the console private IPv4 address.');
      if (a[0] !== 127 && (a[3] === 0 || a[3] === 255)) throw fault('invalid-address', 'Enter a console address, not a network or broadcast address.');
      return a.join('.');
    }
    // Hostnames are local-name syntax only. DNS resolution is not proof of a device identity.
    var label = '[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?';
    if (input.length <= 253 && !/^\d+(?:\.\d+)*$/.test(input) && (new RegExp('^' + label + '(?:\\.local)?$')).test(input)) return input;
    throw fault('invalid-address', 'Enter a private IPv4 address or local hostname, without a URL, port or path.');
  }
  function serviceURL(address, name) {
    if (!services[name]) throw fault('unknown-service', 'Unknown console service.');
    return 'http://' + normalizeAddress(address) + ':' + services[name].port + services[name].path;
  }
  function pageOrigin(options) {
    return options && options.origin !== undefined ? options.origin : root.location && root.location.origin || '';
  }
  function capabilities(address, options) {
    address = normalizeAddress(address);
    var managerURL = serviceURL(address, 'manager'), target = managerURL.slice(0, -1), origin = pageOrigin(options);
    var same = origin === target, mixed = /^https:/i.test(origin);
    return {address: address, managerURL: managerURL, canInspectManager: same, canRunManager: same,
      code: same ? 'same-origin' : mixed ? 'mixed-content' : 'manager-origin-required',
      reason: same ? 'Payload Manager requests are permitted from its own origin.' : 'Open Payload Manager on the console. Its API accepts requests only from its own origin.'};
  }
  function result(status, code, message, extra) {
    var out = {status: status, code: code, message: message};
    if (extra) Object.keys(extra).forEach(function (key) { out[key] = extra[key]; });
    return out;
  }
  function failed(error, extra) {
    if (error.mayHaveExecuted) return result('uncertain',error.code || 'transfer-result-unknown','The transfer result is unknown. Check the console before trying again. ' + (error.message || ''),Object.assign({},extra || {},{mayHaveExecuted:true,outcome:'unknown'}));
    return result('error', error.code || 'connection-failed', error.message || 'Connection failed.', extra);
  }
  // SHA-256 for console browsers without WebCrypto on HTTP origins. The input is
  // bounded before use by the BIN sender. Constants are those defined by SHA-256.
  function sha256(bytes) {
    var input = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    var length = input.length, padded = new Uint8Array(Math.ceil((length + 9) / 64) * 64);
    padded.set(input); padded[length] = 0x80;
    var view = new DataView(padded.buffer), end = padded.length;
    view.setUint32(end - 8, Math.floor(length / 0x20000000), false);
    view.setUint32(end - 4, length * 8 >>> 0, false);
    var k = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
    var h = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19], w = new Int32Array(64);
    function rr(v,n) { return v >>> n | v << (32 - n); }
    for (var off = 0; off < end; off += 64) {
      var i;
      for (i = 0; i < 16; i++) w[i] = view.getInt32(off + i * 4, false);
      for (i = 16; i < 64; i++) {
        var x = w[i - 15], y = w[i - 2];
        w[i] = w[i - 16] + (rr(x,7) ^ rr(x,18) ^ x >>> 3) + w[i - 7] + (rr(y,17) ^ rr(y,19) ^ y >>> 10) | 0;
      }
      var a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], j = h[7];
      for (i = 0; i < 64; i++) {
        var t1 = j + (rr(e,6) ^ rr(e,11) ^ rr(e,25)) + (e & f ^ ~e & g) + k[i] + w[i] | 0;
        var t2 = (rr(a,2) ^ rr(a,13) ^ rr(a,22)) + (a & b ^ a & c ^ b & c) | 0;
        j = g; g = f; f = e; e = d + t1 | 0; d = c; c = b; b = a; a = t1 + t2 | 0;
      }
      var values = [a,b,c,d,e,f,g,j];
      for (i = 0; i < 8; i++) h[i] = h[i] + values[i] | 0;
    }
    return h.map(function (n) { return ('00000000' + (n >>> 0).toString(16)).slice(-8); }).join('');
  }
  function digestSHA256(bytes, options) {
    var crypto = options && options.crypto || root.crypto;
    if (crypto && crypto.subtle && crypto.subtle.digest) return crypto.subtle.digest('SHA-256',bytes).then(function (hash) {
      return Array.prototype.map.call(new Uint8Array(hash), function (n) { return ('0' + n.toString(16)).slice(-2); }).join('');
    }, function () { return sha256(bytes); });
    return Promise.resolve(sha256(bytes));
  }
  function request(url, init, options, acceptHTTPError, executionPossible) {
    var fetcher = options && options.fetch || root.fetch;
    if (typeof fetcher !== 'function') return Promise.reject(fault('fetch-unavailable', 'This browser cannot make the required request. Open the native manager or local sender.'));
    var timeout = options && options.timeoutMs || 10000;
    var controller = typeof root.AbortController === 'function' ? new root.AbortController() : null;
    if (controller) init.signal = controller.signal;
    var timer;
    var issued = false;
    var pending = Promise.resolve().then(function () { issued = true; return fetcher(url, init); });
    var limited = new Promise(function (resolve, reject) {
      timer = root.setTimeout(function () {
        if (controller) controller.abort();
        reject(fault('timeout', 'The request timed out. Check the console service and network.'));
      }, timeout);
      pending.then(resolve, reject);
    });
    return limited.then(function (response) {
      root.clearTimeout(timer);
      if (!response || response.type === 'opaque') throw fault('unreadable-response', 'The browser could not read the service response.');
      if (!response.ok && !acceptHTTPError) throw fault('http-' + response.status, 'The service returned HTTP ' + response.status + '.');
      return response;
    }, function (e) {
      root.clearTimeout(timer);
      if (e.code) throw e;
      throw fault('connection-failed', 'Could not reach the service. Check that it is running; browser CORS or network restrictions may also block the request.');
    }).catch(function (error) {
      // A timeout/CORS failure can hide the response after the console already
      // received an execution request. A known 4xx rejection stays an error.
      if (executionPossible && issued && !/^http-4\d\d$/.test(error.code || '')) error.mayHaveExecuted = true;
      throw error;
    });
  }
  function readResponseBody(response, method, options) {
    var timer, timeout = options && options.timeoutMs || 10000;
    var pending = Promise.resolve().then(function () { return response[method](); });
    var limited = new Promise(function (resolve,reject) {
      timer = root.setTimeout(function () {
        if (response.body && response.body.cancel) { try { Promise.resolve(response.body.cancel()).catch(function () {}); } catch (_) {} }
        reject(fault('timeout','The request timed out. Check the console service and network.'));
      },timeout);
      pending.then(resolve,reject);
    });
    return limited.then(function (value) { root.clearTimeout(timer); return value; },function (error) { root.clearTimeout(timer); throw error; });
  }
  function inspectManager(address, options) {
    var c;
    try { c = capabilities(address, options); } catch (e) { return Promise.resolve(failed(e)); }
    if (!c.canInspectManager) return Promise.resolve(result('blocked', c.code, c.reason, c));
    var init = {method: 'GET', mode: 'same-origin', credentials: 'same-origin', cache: 'no-store', redirect: 'error'};
    return Promise.all([
      request(c.managerURL + 'version', init, options).then(function (r) { return r.text(); }),
      request(c.managerURL + 'getip', init, options).then(function (r) { return r.text(); })
    ]).then(function (values) {
      var version = String(values[0]).trim(), reportedAddress = String(values[1]).trim();
      if (!/^\d+\.\d+\.\d+(?:[-+][a-z0-9.-]+)?$/i.test(version)) throw fault('unexpected-response', 'The service did not return a Payload Manager version.');
      if (reportedAddress === '0.0.0.0') reportedAddress = null;
      else reportedAddress = normalizeAddress(reportedAddress);
      return result('connected', 'manager-connected', 'Payload Manager ' + version + ' responded. The console payload loader has not been tested.', {address: c.address, reportedAddress: reportedAddress, version: version, managerURL: c.managerURL});
    }).catch(function (e) { return result('unavailable', e.code || 'connection-failed', e.message, {address: c.address, managerURL: c.managerURL}); });
  }
  function validatePayloadPath(value) {
    var path = String(value || '');
    if (path.length > 400 || !/^\/(?:data\/pldmgr\/payloads\/(?:repo|local)\/|mnt\/usb[0-7]\/pldmgr\/)/.test(path) ||
        /[\x00-\x1f\x7f%\\?#]/.test(path) || path.split('/').some(function (p) { return p === '.' || p === '..' || !p && path.indexOf('//') >= 0; }) || !/\.elf$/i.test(path))
      throw fault('invalid-payload-path', 'Select an installed ELF inside the Payload Manager repository, local, or USB payload directory.');
    if (/(?:^|\/)pldmgr[^/]*\.elf$/i.test(path)) throw fault('manager-self-launch', 'Payload Manager cannot launch itself through its payload API.');
    return path;
  }
  function launchInstalled(address, path, options) {
    var c, responseReceived = false;
    try { c = capabilities(address, options); path = validatePayloadPath(path); } catch (e) { return Promise.resolve(failed(e)); }
    if (!c.canRunManager) return Promise.resolve(result('blocked', c.code, c.reason, {managerURL: c.managerURL}));
    return request(c.managerURL + 'loadpayload:' + encodeURIComponent(path), {method: 'POST', mode: 'same-origin', credentials: 'same-origin', redirect: 'error', headers: {'X-PLDMGR-Request': '1'}}, options, false, true)
      .then(function (r) { responseReceived = true; return readResponseBody(r,'text',options); }).then(function (body) {
        if (String(body).trim() !== 'OK') throw fault('unexpected-response', 'The manager did not confirm the loader transfer.');
        return result('accepted', 'manager-transfer-complete', 'Payload Manager transferred the ELF to its loader. Check the console for the payload result.', {managerURL: c.managerURL, path: path});
      }).catch(function (e) { if (responseReceived) e.mayHaveExecuted = true; return failed(e, {managerURL: c.managerURL}); });
  }
  function bridgeOrigin(value) {
    // The sender binds localhost only. Public pages must navigate there, not bypass CORS.
    var input = String(value || 'http://127.0.0.1:8766').replace(/\/$/, '');
    if (!/^http:\/\/(?:127\.0\.0\.1|localhost):\d{1,5}$/.test(input)) throw fault('invalid-bridge', 'Use the localhost sender URL, for example http://127.0.0.1:8766.');
    var port = Number(input.slice(input.lastIndexOf(':') + 1));
    if (!port || port > 65535) throw fault('invalid-bridge', 'The sender port is invalid.');
    return input;
  }
  function bridgeRequest(bridgeURL, token, route, body, options) {
    var base, executionResponse = false;
    try {
      base = bridgeOrigin(bridgeURL);
      if (pageOrigin(options) !== base) return Promise.resolve(result('blocked', 'bridge-origin-required', 'Open the local sender dashboard, then enter its pairing token there.', {bridgeURL: base}));
      if (!/^[a-f0-9]{48,128}$/i.test(String(token || ''))) throw fault('invalid-token', 'Enter the pairing token printed by the local sender.');
    } catch (e) { return Promise.resolve(failed(e)); }
    var init = {method: body ? 'POST' : 'GET', mode: 'same-origin', credentials: 'omit', cache: 'no-store', redirect: 'error', headers: {'X-Whatsite-Token': token}};
    if (body) { init.headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(body); }
    return request(base + route, init, options, true, route === '/api/run').then(function (r) {
      executionResponse = route === '/api/run' && !(r.status >= 400 && r.status < 500);
      if (executionResponse && !r.ok) throw fault('unexpected-response', 'The sender returned an unexpected response.');
      return readResponseBody(r,'json',options);
    }).then(function (out) {
      if (!out || typeof out.status !== 'string' || typeof out.message !== 'string') throw fault('unexpected-response', 'The sender returned an unexpected response.');
      out.bridgeURL = base;
      return out;
    }).catch(function (e) { if (executionResponse) e.mayHaveExecuted = true; return failed(e, {bridgeURL: base}); });
  }
  function inspectBridge(bridgeURL, token, options) { return bridgeRequest(bridgeURL, token, '/api/status', null, options); }
  function inspectConsole(address, platform, options) {
    try {
      address = normalizeAddress(address);
      if (platform !== 'ps4' && platform !== 'ps5') throw fault('invalid-platform', 'Choose PS4 or PS5.');
    } catch (e) { return Promise.resolve(failed(e)); }
    return bridgeRequest(options && options.bridgeURL, options && options.token, '/api/inspect', {address:address,platform:platform}, options);
  }
  function runViaBridge(address, actionId, token, platform, options) {
    try {
      address = normalizeAddress(address);
      if (platform !== 'ps4' && platform !== 'ps5') throw fault('invalid-platform', 'Choose PS4 or PS5.');
      if (!/^[a-z0-9][a-z0-9._-]{0,127}$/i.test(String(actionId))) throw fault('invalid-action', 'Choose a listed action.');
    } catch (e) { return Promise.resolve(failed(e)); }
    return bridgeRequest(options && options.bridgeURL, token, '/api/run', {address: address, actionId: actionId, platform: platform, firmware: options && options.firmware || '', gameVersion: options && options.gameVersion || ''}, options);
  }
  function runFileViaBridge(address, action, file, token, platform, options) {
    var base, metadata, expected, executionResponse = false;
    try {
      address = normalizeAddress(address);
      base = bridgeOrigin(options && options.bridgeURL);
      if (pageOrigin(options) !== base) return Promise.resolve(result('blocked','bridge-origin-required','Open the local sender dashboard, then enter its pairing token there.',{bridgeURL:base}));
      if (!/^[a-f0-9]{48,128}$/i.test(String(token || ''))) throw fault('invalid-token','Enter the pairing token printed by the local sender.');
      var run = action && action.run || {};
      if (platform !== 'ps4' || !action || action.platform !== platform || action.format !== 'BIN' || run.input !== 'user-file' ||
          !/^[a-z0-9][a-z0-9._-]{0,127}$/i.test(String(action.id || '')) ||
          !((run.type === 'goldhen-http' && run.port === 9090) || (run.type === 'bin-tcp' && run.port === 9020)) ||
          !/^[a-f0-9]{64}$/i.test(action.sha256 || '') || !isFinite(action.bytes) || Math.floor(action.bytes) !== action.bytes || action.bytes < 1 || action.bytes > 0x300000)
        throw fault('invalid-user-file-action','Choose a verified selected-file BIN action.');
      if (!action.firmwares || !action.firmwares.length || action.firmwares.some(function (fw) { return typeof fw !== 'string' || !/^\d{1,2}\.\d{2}$/.test(fw); }) || action.firmwares.indexOf(options && options.firmware) === -1)
        throw fault('firmware-mismatch','Choose a payload matching the installed firmware.');
      var versions = action.gameVersions && action.gameVersions.length ? action.gameVersions : action.gameVersion ? [action.gameVersion] : [];
      if (versions.length && versions.indexOf(options && options.gameVersion) === -1) throw fault('game-version-mismatch','Select the exact game update supported by this menu.');
      if (!file || typeof file.arrayBuffer !== 'function' || typeof file.name !== 'string' || !/\.bin$/i.test(file.name) ||
          file.size !== action.bytes)
        throw fault('selected-file-required','Select the exact downloaded BIN file with the listed size.');
      expected = action.bytes;
      metadata = JSON.stringify({address:address,actionId:action.id,platform:platform,firmware:options.firmware,gameVersion:options.gameVersion || ''});
      if (metadata.length > 4096 || /[^\x20-\x7e]/.test(metadata)) throw fault('invalid-user-file-action','Choose a verified selected-file BIN action.');
    } catch (error) { return Promise.resolve(failed(error)); }
    var timer, timeout = options && options.timeoutMs || 10000;
    var selected = new Promise(function (resolve,reject) {
      timer = root.setTimeout(function () { reject(fault('selected-file-timeout','The selected BIN could not be read. Nothing was sent.')); },timeout);
      Promise.resolve().then(function () { return file.arrayBuffer(); }).then(resolve,function () { reject(fault('selected-file-unreadable','The selected BIN could not be read. Nothing was sent.')); });
    });
    return selected.then(function (buffer) {
      root.clearTimeout(timer);
      var bytes;
      try { bytes = new Uint8Array(buffer); } catch (_) { throw fault('selected-file-unreadable','The selected BIN could not be read. Nothing was sent.'); }
      if (bytes.byteLength !== expected) throw fault('selected-file-size','The selected BIN size does not match the catalogue. Nothing was sent.');
      if (bytes.length >= 4 && bytes[0] === 0x7f && bytes[1] === 0x45 && bytes[2] === 0x4c && bytes[3] === 0x46) throw fault('invalid-bin','Select the original flat BIN, not an ELF executable. Nothing was sent.');
      return digestSHA256(bytes,options).then(function (digest) {
        if (digest !== action.sha256.toLowerCase()) throw fault('checksum-mismatch','The payload checksum does not match the catalogue. Nothing was sent.');
        if (options && typeof options.beforeDispatch === 'function') {
          // The file read/hash can outlive the original gesture. Revalidate the
          // captured console/pairing state immediately before offering bytes.
          try {
            var ready = options.beforeDispatch();
            if (ready === false || ready && typeof ready.then === 'function') throw Error();
          } catch (_) { throw fault('selected-file-state-changed','The console selection changed. Choose Load again.'); }
        }
        return request(base+'/api/run-file',{method:'POST',mode:'same-origin',credentials:'omit',cache:'no-store',redirect:'error',headers:{'X-Whatsite-Token':token,'X-Whatsite-Run':metadata,'Content-Type':'application/octet-stream'},body:bytes},options,true,true);
      });
    }).then(function (response) {
      executionResponse = !(response.status >= 400 && response.status < 500);
      if (executionResponse && !response.ok) throw fault('unexpected-response','The sender returned an unexpected response.');
      return readResponseBody(response,'json',options);
    }).then(function (out) {
      if (!out || typeof out.status !== 'string' || typeof out.message !== 'string') throw fault('unexpected-response','The sender returned an unexpected response.');
      out.bridgeURL=base;return out;
    }).catch(function (error) { root.clearTimeout(timer); if (executionResponse) error.mayHaveExecuted=true;return failed(error,{bridgeURL:base}); });
  }
  function inspectGoldHEN(address, options) {
    try { address = normalizeAddress(address); } catch (e) { return Promise.resolve(failed(e)); }
    if (/^https:/i.test(pageOrigin(options))) return Promise.resolve(result('blocked', 'mixed-content', 'This HTTPS page cannot contact the console HTTP loader. Use the local sender dashboard.'));
    return request('http://' + address + ':9090/status', {method: address === '127.0.0.1' ? 'POST' : 'GET', mode: 'cors', credentials: 'omit', cache: 'no-store', redirect: 'error'}, options)
      .then(function (r) { return readResponseBody(r,'json',options); }).then(function (body) {
        if (!body || body.status !== 'ready') return result('blocked', 'loader-busy', 'GoldHEN HTTP loader is not ready. Enable its BinLoader server and wait until it is idle.');
        return result('connected', 'goldhen-ready', 'GoldHEN HTTP loader is ready.', {address: address});
      }).catch(function (e) { return failed(e); });
  }
  // Production Pages may serve a pinned repository URL for an offloaded file.
  // Arbitrary external URLs and moving branches are not payload sources.
  function payloadFileURL(value, extension) {
    var url = String(value || '');
    var alias = /^https:\/\/raw\.githubusercontent\.com\/Speedy-away\/(?:speedy-away\.github\.io|whatsite)\/[a-f0-9]{40}(\/downloads\/[^?#]+)$/i.exec(url);
    var decoded = decodeURIComponent(alias ? alias[1] : url);
    if (decoded.length > 2048 || decoded.indexOf('/downloads/') !== 0 ||
        decoded.slice(-extension.length).toLowerCase() !== extension || /[%?#\\\x00-\x1f\x7f]/.test(decoded) ||
        decoded.split('/').some(function (part) { return part === '.' || part === '..'; }))
      throw fault('invalid-download', 'Choose a verified payload from the site download library.');
    return {url: url, offloaded: Boolean(alias)};
  }
  function sendGoldHEN(address, action, options) {
    var url, sha;
    try {
      address = normalizeAddress(address);
      if (!action || String(action.format).toUpperCase() !== 'BIN' || !/^[a-f0-9]{64}$/i.test(action.sha256 || '')) throw fault('invalid-action', 'Choose a verified BIN payload from the host catalogue.');
      url = payloadFileURL(action.downloadURL, '.bin');
      sha = action.sha256.toLowerCase();
    } catch (e) { return Promise.resolve(failed(e)); }
    return inspectGoldHEN(address, options).then(function (state) {
      if (state.status !== 'connected') return state;
      return request(url.url, {method: 'GET', mode: url.offloaded ? 'cors' : 'same-origin', credentials: 'omit', cache: 'no-store', redirect: 'error'}, options).then(function (r) { return readResponseBody(r,'arrayBuffer',options); }).then(function (bytes) {
        if (!bytes.byteLength || bytes.byteLength > 32 * 1024 * 1024) throw fault('invalid-payload', 'The payload file size is invalid.');
        return digestSHA256(bytes, options).then(function (hex) {
          if (hex !== sha) throw fault('checksum-mismatch', 'The payload checksum does not match the catalogue. Nothing was sent.');
          return request('http://' + address + ':9090/', {method: 'POST', mode: 'cors', credentials: 'omit', redirect: 'error', body: bytes}, options, false, true);
        });
      }).then(function (r) {
        if (r.status !== 200 && r.status !== 202) { var error = fault('unexpected-response', 'The loader did not acknowledge the payload.'); error.mayHaveExecuted = true; throw error; }
        return result('accepted', 'goldhen-accepted', 'GoldHEN accepted the payload bytes. Check the game or console for the result.', {address: address, sha256: sha});
      });
    }).catch(function (e) { return failed(e); });
  }
  function payloadOrigin(options) {
    var value = options && options.payloadOrigin || pageOrigin(options), parsed;
    try { parsed = new root.URL(value); } catch (_) { throw fault('payload-origin-unreachable','Open this site using its public or computer LAN URL, or connect the paired sender. The console cannot fetch files from the computer localhost preview.'); }
    if (!/^https?:$/.test(parsed.protocol)) throw fault('payload-origin-unreachable','Open the site over HTTP or HTTPS using a console-reachable public or computer LAN address, or use the paired sender.');
    if (parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash)
      throw fault('invalid-payload-origin','Choose the HTTP or HTTPS origin that actually hosts these payload files, without credentials or a path.');
    var name = parsed.hostname.toLowerCase();
    if (name === 'localhost' || /\.localhost$/.test(name) || /^127\./.test(name) || name === '0.0.0.0' || name.indexOf(':') !== -1)
      throw fault('payload-origin-unreachable','The console cannot fetch payloads from the computer localhost preview. Open the site using the computer LAN address, publish it, or connect the paired sender.');
    return parsed.origin;
  }
  function elfLaunchURL(address, action, options) {
    address = normalizeAddress(address);
    if (!action || String(action.format).toUpperCase() !== 'ELF' || !/^[a-f0-9]{64}$/i.test(action.sha256 || '')) throw fault('invalid-action','Choose an ELF from the verified host catalogue.');
    var download = payloadFileURL(action.downloadURL, '.elf');
    // Use the actual file host, not the canonical domain: a local new build may
    // not be published there yet, and desktop loopback is unreachable by a PS5.
    return 'http://' + address + ':9021/?uri=' + encodeURIComponent(download.offloaded ? download.url : payloadOrigin(options) + download.url);
  }
  function sendPS5ELF(address, action, options) {
    var url;
    try { url = elfLaunchURL(address,action,options); } catch (e) { return Promise.resolve(e.code === 'payload-origin-unreachable' ? result('blocked',e.code,e.message) : failed(e)); }
    if (/^https:/i.test(pageOrigin(options))) return Promise.resolve(result('blocked','mixed-content','This HTTPS page cannot request the console HTTP loader. Open the loader link on the console, or use the local sender dashboard.',{launchURL:url}));
    return request(url,{method:'GET',mode:'cors',credentials:'omit',cache:'no-store',redirect:'error'},options,false,true).then(function (r) {
      if (r.status !== 200) { var error = fault('unexpected-response','The ELF loader did not acknowledge the URL request.'); error.mayHaveExecuted = true; throw error; }
      // The official v0.27 loader writes its HTTP200 before downloading or
      // spawning the ELF. Reading that status is NOT an execution acknowledgement.
      return result('accepted','elf-loader-requested','ELF loader accepted the URL request. The console download and payload result have not been verified.',{launchURL:url,address:normalizeAddress(address)});
    }).catch(function (e) { return failed(e,{launchURL:url}); });
  }
  return {normalizeAddress: normalizeAddress, serviceURL: serviceURL, buildServiceUrl: serviceURL,
    capabilities: capabilities, inspectManager: inspectManager, validatePayloadPath: validatePayloadPath,
    launchInstalled: launchInstalled, bridgeOrigin: bridgeOrigin, inspectBridge: inspectBridge, inspectConsole: inspectConsole,
    runViaBridge: runViaBridge, runFileViaBridge: runFileViaBridge, inspectGoldHEN: inspectGoldHEN, sendGoldHEN: sendGoldHEN,
    sha256: sha256, elfLaunchURL: elfLaunchURL, sendPS5ELF: sendPS5ELF};
}));
