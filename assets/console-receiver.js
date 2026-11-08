(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.ConsoleReceiver = api; api.install(root.document, root); }
}(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  function fail(message, code) { var error = new Error(message); if (code) error.code = code; throw error; }
  function trim(value) { return String(value || '').replace(/^\s+|\s+$/g, ''); }
  function parseUrl(value) {
    value = trim(value);
    if (!value || /[\s\\\x00-\x1f\x7f]/.test(value)) fail('The file URL is invalid.');
    if (value.indexOf('//') === 0) fail('Use a complete HTTP or HTTPS file URL.');
    if (!/^[a-z][a-z0-9+.-]*:/i.test(value)) value = 'https://whatwhatboy.com/' + value.replace(/^\/+/, '');
    var m = /^(https?):\/\/([^\/?#]+)([^#]*)(?:#.*)?$/i.exec(value);
    if (!m || m[2].indexOf('@') >= 0) fail('Only HTTP(S) file URLs without credentials are supported.');
    var authority = m[2], host, port = '', a;
    if (authority.charAt(0) === '[') {
      a = /^(\[[a-f0-9:]+\])(?::([0-9]+))?$/i.exec(authority);
    } else a = /^([a-z0-9.-]+)(?::([0-9]+))?$/i.exec(authority);
    if (!a) fail('The file URL host is invalid.');
    host = a[1].toLowerCase(); port = a[2] || '';
    if (port && (+port < 1 || +port > 65535)) fail('The file URL port is invalid.');
    var path = m[3] || '/';
    if (path.charAt(0) !== '/') path = '/' + path;
    var origin = m[1].toLowerCase() + '://' + host + (port ? ':' + port : '');
    return {url: origin + path, origin: origin, path: path, hostname: host, protocol: m[1].toLowerCase() + ':', port: port};
  }
  function receiverOrigin(location) {
    var host = String(location.hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
    if (location.protocol !== 'http:' || String(location.port) !== '6701') return false;
    if (host === 'localhost' || host === '::1') return true;
    if (/^(?:fc|fd)[a-f0-9]*:|^fe[89ab][a-f0-9]*:/i.test(host) && /^[a-f0-9:]+$/i.test(host)) return true;
    var parts = host.split('.'), i;
    if (parts.length !== 4) return false;
    for (i = 0; i < parts.length; i++) if (!/^\d{1,3}$/.test(parts[i]) || +parts[i] > 255) return false;
    return +parts[0] === 127 || +parts[0] === 10 || (+parts[0] === 192 && +parts[1] === 168) || (+parts[0] === 172 && +parts[1] >= 16 && +parts[1] <= 31) || (+parts[0] === 169 && +parts[1] === 254);
  }
  function platformName(platform) {
    platform = String(platform || '').toLowerCase();
    if (platform !== 'ps4' && platform !== 'ps5') fail('Choose a PS4 or PS5 receiver.');
    return platform;
  }
  function safeFolder(platform, value) {
    platform = platformName(platform);
    var folder = trim(value).replace(/\/+$/, ''), parts, i;
    var pattern = platform === 'ps5' ? /^\/(?:data|mnt\/(?:usb|ext)\d+)(?:\/|$)/ : /^\/(?:data|mnt\/usb\d+)(?:\/|$)/;
    if (!pattern.test(folder) || /[\\%\x00-\x1f\x7f]/.test(folder)) fail('Use /data or a mounted USB folder' + (platform === 'ps5' ? ' / external-storage folder.' : '.'));
    parts = folder.split('/');
    for (i = 1; i < parts.length; i++) if (!parts[i] || parts[i] === '.' || parts[i] === '..' || !/^[a-z0-9 _().+-]+$/i.test(parts[i])) fail('Folder names must not contain traversal, encoded paths or special characters.');
    return folder;
  }
  function safeFilename(value) {
    var name = String(value || '').split(/[\\/]/).pop();
    try { name = decodeURIComponent(name); } catch (ignore) {}
    name = name.replace(/[^a-z0-9._() +@-]/gi, '_').replace(/^[. ]+|[. ]+$/g, '').slice(0, 160);
    if (!name || name === '.' || name === '..') fail('The file does not have a usable filename.');
    return name;
  }
  function makeRequest(platform, item, folder, id) {
    platform = platformName(platform);
    if (item.receiverSupported === false) fail('Use the publisher URL in the native ezRemote file manager for this file.');
    var source = parseUrl(item.url), filename = safeFilename(item.filename || source.path.split('?')[0]);
    folder = safeFolder(platform, folder);
    id = Number(id);
    if (!isFinite(id) || id < 1 || Math.floor(id) !== id || id > 9007199254740991) fail('The download identifier is invalid.');
    var size = Number(item.bytes);
    if (!isFinite(size) || size < 0 || Math.floor(size) !== size) size = 0;
    return {type: platform === 'ps4' ? 7 : 6, url: source.origin, username: '', password: '', http_server_type: '', src_path: source.path, dest_path: folder + '/' + filename, size: size, id: id};
  }
  function submission(text) {
    if (!trim(text)) return {accepted: true, complete: false};
    var value;
    try { value = JSON.parse(text); } catch (ignore) { fail('The receiver returned an unexpected response.'); }
    var result = value && value.result ? value.result : value;
    if (result && result.success === false) fail(result.error || 'The receiver rejected the download.', 'rejected');
    if (result && result.success === true) return {accepted: true, complete: false};
    fail('The receiver did not acknowledge the request.');
  }
  function progress(entry) {
    entry = entry || {};
    var state = entry.state == null || trim(entry.state) === '' ? NaN : Number(entry.state), transferred = Math.max(0, Number(entry.bytes_transfered) || 0), total = Math.max(0, Number(entry.file_size) || 0);
    var phases = ['queued', 'downloading', 'resumed', 'failed', 'receiver-complete'];
    var labels = ['Queued by receiver', 'Downloading', 'Resuming', 'Receiver reports failure', 'Receiver reports complete'];
    if (Math.floor(state) !== state || state < 0 || state > 4) return {phase: 'unknown', label: 'Unknown receiver status', percent: 0, complete: false};
    return {phase: phases[state], label: labels[state], percent: total ? Math.max(0, Math.min(100, Math.floor(transferred / total * 100))) : 0, complete: state === 4, transferred: transferred, total: total};
  }
  function filesystemURL(location, folder, json) {
    var host = String(location.hostname);
    if (host.indexOf(':') >= 0 && host.charAt(0) !== '[') host = '[' + host + ']';
    return 'http://' + host + ':8080/fs' + encodeURI(folder.replace(/\/+$/, '') + '/') + (json ? '?fmt=json' : '');
  }
  function mountedStorage(entries) {
    if (Object.prototype.toString.call(entries) !== '[object Array]') fail('PS5 websrv did not return a folder listing.');
    var mounts = [], seen = {}, i, entry, path;
    for (i = 0; i < entries.length; i++) {
      entry = entries[i];
      // websrv marks a directory on another device as "m". Empty mount-point
      // directories ("d") do not establish that a storage device is present.
      if (!entry || entry.mode !== 'm' || !/^(?:usb|ext)\d+$/.test(entry.name)) continue;
      path = '/mnt/' + entry.name;
      if (!seen[path]) { mounts.push({path: path, kind: entry.name.indexOf('usb') === 0 ? 'USB file storage' : 'External mount'}); seen[path] = true; }
    }
    mounts.sort(function (a, b) { return a.path < b.path ? -1 : a.path > b.path ? 1 : 0; });
    return mounts;
  }
  function folderEntries(text) {
    var entries;
    try { entries = JSON.parse(text); } catch (error) { fail('PS5 websrv returned an unreadable folder listing.'); }
    if (Object.prototype.toString.call(entries) !== '[object Array]') fail('PS5 websrv did not return a folder listing.');
    for (var i = 0; i < entries.length; i++) if (entries[i] && entries[i].name === '.' && entries[i].mode === 'd') return entries;
    fail('PS5 websrv did not confirm an existing directory. Check the folder in the file manager.');
  }
  function managerOrigin(platform, location) {
    return receiverOrigin({protocol:location.protocol,hostname:location.hostname,port:'6701'}) && String(location.port) === (platform === 'ps4' ? '8080' : '9090');
  }
  function localHost(location) { if(!receiverOrigin({protocol:'http:',hostname:location.hostname,port:'6701'}))return '127.0.0.1';var host = String(location.hostname); return host.indexOf(':') >= 0 && host.charAt(0) !== '[' ? '[' + host + ']' : host; }
  function packageInstallerURL(location, platform, file, size) {
    platform = platformName(platform);
    if (!receiverOrigin(location)) fail('Open the native receiver before preparing package installation.');
    // The installed native helper currently supports local IPv4/localhost,
    // not IPv6. Receiver downloads keep their wider host support.
    if (String(location.hostname || '').indexOf(':') >= 0) fail('Open the native receiver before preparing package installation.');
    var originalName = String(file).slice(String(file).lastIndexOf('/')+1);
    var name = safeFilename(file), folder = safeFolder(platform, file.slice(0,file.lastIndexOf('/')));
    if (name !== originalName || file !== folder+'/'+name || file.length > 512) fail('The saved package filename is invalid.');
    if (!/\.pkg$/i.test(name) || !/^(?:\/data(?:\/|$)|\/mnt\/usb[0-9]\/)/.test(folder+'/')) fail('Choose a saved PKG in internal storage or a verified USB folder.');
    if (typeof size !== 'number' || !isFinite(size) || size < 4 || Math.floor(size) !== size || size > 9007199254740991) fail('The package size is unavailable.');
    var path = platform === 'ps4' ? '/data/whatsite-package-installer-ps4.html' : '/data/homebrew/ezremote-client/assets/whatsite-package-installer-ps5.html';
    return 'http://' + localHost(location) + ':' + (platform === 'ps4' ? '8080' : '9090') + path + '?path=' + encodeURIComponent(folder+'/'+name) + '&bytes=' + size;
  }
  function downloadFolder(platform, folder) {
    folder = safeFolder(platform, folder);
    return /\/whatwhatboy$/.test(folder) ? folder : folder + '/whatwhatboy';
  }
  function preparationURL(location, platform, folder, archive) {
    platform = platformName(platform); folder = safeFolder(platform, folder);
    var file = platform === 'ps4' ? '/data/whatsite-ps4.html' : '/data/homebrew/ezremote-client/assets/whatsite-ps5.html';
    return 'http://' + localHost(location) + ':' + (platform === 'ps4' ? '8080' : '9090') + file + '?prepare=1&folder=' + encodeURIComponent(folder) + (archive ? '&archive=' + encodeURIComponent(archive) : '');
  }
  function receiverURL(location, platform, folder) {
    return 'http://' + localHost(location) + ':6701' + (platform === 'ps4' ? '/data/whatsite-ps4.html' : '/whatsite-ps5.html') + '?folder=' + encodeURIComponent(safeFolder(platform, folder));
  }
  function sha256Bytes(bytes) {
    var constants = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
    var hash = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19], words = [], length = bytes.length, blocks = Math.ceil((length + 9) / 64), low = (length * 8) >>> 0, high = Math.floor(length / 536870912), block, i, j;
    function rotate(value, bits) { return (value >>> bits) | (value << (32-bits)); }
    function byteAt(index) {
      if (index < length) return bytes[index];
      if (index === length) return 128;
      var tail = index - (blocks * 64 - 8);
      if (tail >= 0) return tail < 4 ? (high >>> ((3-tail)*8)) & 255 : (low >>> ((7-tail)*8)) & 255;
      return 0;
    }
    for (block = 0; block < blocks; block++) {
      for (i = 0; i < 16; i++) { j=block*64+i*4; words[i]=(byteAt(j)<<24)|(byteAt(j+1)<<16)|(byteAt(j+2)<<8)|byteAt(j+3); }
      for (i = 16; i < 64; i++) { var s0=rotate(words[i-15],7)^rotate(words[i-15],18)^(words[i-15]>>>3), s1=rotate(words[i-2],17)^rotate(words[i-2],19)^(words[i-2]>>>10); words[i]=(words[i-16]+s0+words[i-7]+s1)|0; }
      var a=hash[0],b=hash[1],c=hash[2],d=hash[3],e=hash[4],f=hash[5],g=hash[6],h=hash[7];
      for (i = 0; i < 64; i++) {
        var upper=rotate(e,6)^rotate(e,11)^rotate(e,25), choice=(e&f)^((~e)&g), first=(h+upper+choice+constants[i]+words[i])|0;
        var lower=rotate(a,2)^rotate(a,13)^rotate(a,22), majority=(a&b)^(a&c)^(b&c), second=(lower+majority)|0;
        h=g;g=f;f=e;e=(d+first)|0;d=c;c=b;b=a;a=(first+second)|0;
      }
      hash[0]=(hash[0]+a)|0;hash[1]=(hash[1]+b)|0;hash[2]=(hash[2]+c)|0;hash[3]=(hash[3]+d)|0;hash[4]=(hash[4]+e)|0;hash[5]=(hash[5]+f)|0;hash[6]=(hash[6]+g)|0;hash[7]=(hash[7]+h)|0;
    }
    var output=''; for (i=0;i<hash.length;i++) output+=('00000000'+(hash[i]>>>0).toString(16)).slice(-8); return output;
  }
  function reviewedArchive(item) {
    var review=item && item.archiveSafety;
    return !!(item && isArchive(item) && typeof item.bytes==='number' && Math.floor(item.bytes)===item.bytes && item.bytes > 0 && item.bytes <= 32*1024*1024 && /^[a-f0-9]{64}$/i.test(item.sha256 || '') && review && review.reviewed === true && review.noLinks === true && review.relativePaths === true && review.noDevices === true && review.noAlternateStreams === true && review.noEncryptedEntries === true && review.bytes === item.bytes && review.entryCount >= 1 && review.entryCount <= 5000 && review.expandedBytes >= 0 && review.expandedBytes <= 128*1024*1024 && String(review.sha256).toLowerCase() === item.sha256.toLowerCase());
  }
  var updateLimit = 2 * 1024 * 1024;
  function receiverUpdateFolder(platform) {
    return platform === 'ps4' ? '/data' : '/data/homebrew/ezremote-client/assets';
  }
  function receiverUpdateSpec(platform, location, version, hash, size) {
    platform = platformName(platform);
    if (!managerOrigin(platform, location)) {
      fail('Open the staged update through the running ' + platform.toUpperCase() + ' ezRemote Client on port ' + (platform === 'ps4' ? '8080' : '9090') + '.');
    }
    if (!/^\d{4}\.\d{2}\.\d{2}\.\d{1,5}$/.test(version || '') || !/^[a-f0-9]{64}$/.test(hash || '') ||
        !/^[1-9]\d{0,6}$/.test(String(size)) || Number(size) > updateLimit) {
      fail('The staged receiver version, size or SHA-256 is invalid.');
    }
    var name = 'whatsite-' + platform + '-update-' + version + '-' + hash.slice(0, 12) + '.html';
    var path = receiverUpdateFolder(platform) + '/' + name;
    if (location.pathname !== path) fail('The staged receiver filename does not match this update.');
    return {name: name, path: path, sha256: hash, bytes: Number(size)};
  }
  function installedReceiverVersion(bytes, platform) {
    var marker = '<script id="receiver-catalog" type="application/json">';
    for (var index = 0; index + marker.length < bytes.length; index++) {
      if (bytes[index] !== 60) continue;
      var offset = 0;
      while (offset < marker.length && bytes[index + offset] === marker.charCodeAt(offset)) offset++;
      if (offset !== marker.length) continue;
      var header = '', limit = Math.min(bytes.length, index + offset + 128);
      for (var i = index + offset; i < limit; i++) header += String.fromCharCode(bytes[i]);
      var match = /^\{"platform":"(ps4|ps5)","version":"(\d{4}\.\d{2}\.\d{2}\.\d{1,5})",/.exec(header);
      return match && match[1] === platform ? match[2] : '';
    }
    return '';
  }
  function newerVersion(first, second) {
    var a = first.split('.'), b = second.split('.');
    for (var i = 0; i < a.length; i++) {
      var difference = Number(a[i]) - Number(b[i]);
      if (difference) return difference > 0;
    }
    return false;
  }
  function createManagerClient(platform, location, xhrFactory, browser) {
    platform = platformName(platform);
    var updateFolder = receiverUpdateFolder(platform);
    var updateTarget = 'whatsite-' + platform + '.html';
    var updateBusy = false, updateReads = 0;
    function request(method, path, body, callback, multipart) {
      if (!managerOrigin(platform, location)) { callback(new Error('Open preparation through the running ezRemote Client on its default ' + (platform === 'ps4' ? '8080' : '9090') + ' port.')); return; }
      var xhr = xhrFactory(), finished = false;
      function done(error) { if (finished) return; finished = true; callback(error, xhr.responseText || ''); }
      try { xhr.open(method, path, true); } catch (error) { done(error); return; }
      xhr.timeout = path === '/__local__/extract' ? 0 : 20000;
      if (body !== null && !multipart) xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.onreadystatechange = function () { if (xhr.readyState === 4) done(xhr.status >= 200 && xhr.status < 300 ? null : new Error('ezRemote Client HTTP ' + xhr.status + '. The operation may still be running; inspect the native app before retrying.')); };
      xhr.onerror = function () { done(new Error('The ezRemote Client connection was lost. Inspect the native app before retrying; an operation may still be running.')); };
      xhr.ontimeout = function () { done(new Error('The ezRemote Client did not respond. Inspect the native app before retrying.')); };
      try { xhr.send(body === null || multipart ? body : JSON.stringify(body)); } catch (error) { done(error); }
    }
    function list(folder, callback) {
      request('POST', '/__local__/list', {path:folder,onlyFolders:false}, function (error, text) {
        if (error) { callback(error); return; }
        var data;
        try {
          data = JSON.parse(text);
          if (!data || Object.prototype.toString.call(data.result) !== '[object Array]') fail('ezRemote Client did not return its documented directory listing.');
        } catch (caught) { callback(caught); return; }
        callback(null, data.result);
      });
    }
    function findEntry(entries, name) { for (var i = 0; i < entries.length; i++) if (entries[i] && entries[i].name === name) return entries[i]; return null; }
    function verifyArchiveBytes(archive, item, callback) {
      if (!managerOrigin(platform,location)) { callback(new Error('Archive verification requires the installed local ezRemote Client.')); return; }
      var xhr=xhrFactory(),finished=false;
      function done(error) { if(finished)return;finished=true;callback(error); }
      try { xhr.open('GET',encodeURI(archive),true);xhr.responseType='arraybuffer';xhr.timeout=120000; } catch(error) { done(new Error('This browser cannot read the saved archive for checksum verification. Use the native file manager.'));return; }
      xhr.onreadystatechange=function(){
        if(finished || xhr.readyState!==4)return;
        if(xhr.status<200||xhr.status>=300){done(new Error('The saved archive could not be read for checksum verification. No extraction was requested.'));return;}
        try {
          if(!xhr.response || typeof xhr.response.byteLength!=='number' || xhr.response.byteLength!==item.bytes)fail('The saved archive size does not match its reviewed build. No extraction was requested.');
          if(sha256Bytes(new Uint8Array(xhr.response))!==item.sha256.toLowerCase())fail('The saved archive SHA-256 does not match its reviewed contents. No extraction was requested.');
        }catch(error){done(error);return;}
        done(null);
      };
      xhr.onerror=function(){done(new Error('Archive checksum reading failed. No extraction was requested.'));};
      xhr.ontimeout=function(){done(new Error('Archive checksum reading timed out. No extraction was requested.'));};
      xhr.onprogress=function(event){if(event.loaded>item.bytes || event.loaded>32*1024*1024){done(new Error('The saved archive exceeds its reviewed byte size. No extraction was requested.'));if(typeof xhr.abort==='function')xhr.abort();}};
      try{xhr.send(null);}catch(error){done(error);}
    }
    function acknowledgment(text) {
      var data; try { data = JSON.parse(text); } catch (error) { fail('ezRemote Client returned an unreadable operation result. Inspect the native app before retrying.'); }
      if (!data || !data.result || data.result.success !== true) fail(data && data.result && data.result.error || 'ezRemote Client did not confirm the operation.');
    }
    function readUpdateHash(name, size, callback) {
      if (Math.floor(size) !== size || size < 1 || size > updateLimit) {
        callback(new Error('A receiver file has an invalid size.')); return;
      }
      var xhr = xhrFactory(), finished = false;
      function done(error, hash, bytes) {
        if (finished) return;
        finished = true;
        callback(error, hash, bytes);
      }
      // Read each on-disk version rather than a cached response from before the rename.
      var path = updateFolder + '/' + name + '?wwb-read=' + new Date().getTime() + '-' + (++updateReads);
      try {
        xhr.open('GET', path, true);
        xhr.responseType = 'arraybuffer';
        xhr.timeout = 20000;
      } catch (error) { done(error); return; }
      xhr.onreadystatechange = function () {
        if (finished || xhr.readyState !== 4) return;
        if (xhr.status !== 200 || !xhr.response || xhr.response.byteLength !== size) {
          done(new Error('Could not read the complete receiver file ' + name + '.')); return;
        }
        var bytes = new Uint8Array(xhr.response);
        done(null, sha256Bytes(bytes), bytes);
      };
      xhr.onerror = xhr.ontimeout = function () { done(new Error('Could not verify ' + name + ' through ezRemote.')); };
      xhr.onprogress = function (event) {
        if (event.loaded <= size) return;
        done(new Error('A receiver file exceeds its expected size.'));
        if (typeof xhr.abort === 'function') xhr.abort();
      };
      try { xhr.send(null); } catch (error) { done(error); }
    }
    function applyReceiverUpdate(version, hash, size, callback) {
      var update;
      try { update = receiverUpdateSpec(platform, location, version, hash, size); }
      catch (error) { callback(error); return; }
      if (updateBusy) { callback(new Error('An update check is already in progress.')); return; }
      updateBusy = true;
      var backupName, backupVerified = false;
      function finish(error, alreadyCurrent) {
        updateBusy = false;
        callback(error, {alreadyCurrent: !!alreadyCurrent, backup: backupVerified ? backupName : ''});
      }
      function inspect(name, entries) {
        var match = findEntry(entries, name);
        if (!match || match.type !== 'file' || findEntry(entries, name + '.tmp')) return 0;
        return Number(match.size);
      }
      function verify(name, bytes, expected, callback) {
        readUpdateHash(name, bytes, function (error, actual) {
          callback(error || (actual !== expected ? new Error('SHA-256 mismatch for ' + name + '.') : null));
        });
      }
      list(updateFolder, function (error, entries) {
        if (error) { finish(error); return; }
        var oldSize = inspect(updateTarget, entries);
        if (!oldSize) { finish(new Error('Could not confirm the existing downloader. Open ezRemote to inspect the assets folder.')); return; }
        readUpdateHash(updateTarget, oldSize, function (oldError, oldHash, oldBytes) {
          if (oldError) { finish(oldError); return; }
          if (oldSize === update.bytes && oldHash === update.sha256) { finish(null, true); return; }
          var oldVersion = installedReceiverVersion(oldBytes, platform);
          if (oldVersion && newerVersion(oldVersion, version)) {
            finish(new Error('A newer receiver is already installed (' + oldVersion + ').')); return;
          }
          if (inspect(update.name, entries) !== update.bytes) { finish(new Error('The staged download is incomplete or missing. Check the download queue first.')); return; }
          verify(update.name, update.bytes, update.sha256, function (stageError) {
            if (stageError) { finish(stageError); return; }
            backupName = 'whatsite-' + platform + '-backup-' + oldHash + '.html';
            preserveBackup(oldSize, oldHash, oldBytes);
          });
        });
      });
      function preserveBackup(oldSize, oldHash, oldBytes) {
        list(updateFolder, function (error, entries) {
          if (error) { finish(error); return; }
          if (findEntry(entries, backupName) || findEntry(entries, backupName + '.tmp')) {
            if (inspect(backupName, entries) !== oldSize) { finish(new Error('A backup path is occupied. Nothing was replaced.')); return; }
            confirmBackup();
            return;
          }
          var form;
          try {
            // Native upload reads the destination and chunk metadata before the file part.
            form = new browser.FormData();
            form.append('destination', updateFolder);
            form.append('_chunkNumber', '0');
            form.append('_chunkSize', String(oldSize));
            form.append('_totalSize', String(oldSize));
            form.append('_currentChunkSize', String(oldSize));
            form.append('file', new browser.Blob([oldBytes.buffer], {type: 'application/octet-stream'}), backupName);
          } catch (_) {
            finish(new Error('This browser could not prepare the receiver backup upload.')); return;
          }
          request('POST', '/__local__/upload', form, function (uploadError, response) {
            if (uploadError) { finish(uploadError); return; }
            try { acknowledgment(response); } catch (caught) { finish(caught); return; }
            confirmBackup();
          }, true);
        });
        function confirmBackup() {
          verify(backupName, oldSize, oldHash, function (error) {
            if (error) { finish(error); return; }
            backupVerified = true;
            verify(updateTarget, oldSize, oldHash, function (targetError) {
              if (targetError) { finish(targetError); return; }
              verify(update.name, update.bytes, update.sha256, function (stageError) {
                if (stageError) { finish(stageError); return; }
                replace();
              });
            });
          });
        }
      }
      function replace() {
        request('POST', '/__local__/rename', {item: update.path, newItemPath: updateFolder + '/' + updateTarget}, function () {
          // The pinned handler acknowledges even a failed rename. Read the installed bytes.
          verify(updateTarget, update.bytes, update.sha256, function (error) {
            finish(error && new Error('Could not confirm the update. Open ezRemote to inspect the downloader and its verified backup.'));
          });
        });
      }
    }
    function verifyStorage(folder, confirmed, callback) {
      var mount = /^\/mnt\/(?:usb|ext)\d+(?=\/|$)/.exec(folder);
      if (!mount) { callback(null); return; }
      if (platform === 'ps4') { callback(confirmed ? null : new Error('Confirm the actual mounted USB device in ezRemote before creating folders or extracting there. A numbered directory alone does not prove a device is mounted.')); return; }
      request('GET', filesystemURL(location, '/mnt', true), null, function (error, text) {
        if (error) { callback(error); return; }
        var mounts;
        try { mounts = mountedStorage(JSON.parse(text)); } catch (caught) { callback(caught); return; }
        for (var i = 0; i < mounts.length; i++) if (mounts[i].path === mount[0]) { callback(null); return; }
        callback(new Error('The selected external device is not currently reported as mounted by PS5 websrv. No folder or extraction request was sent.'));
      });
    }
    function ensureDirectory(folder, callback) {
      var anchor = /^\/(?:data|mnt\/(?:usb|ext)\d+)(?=\/|$)/.exec(folder)[0];
      var slash = anchor.lastIndexOf('/'), parent = anchor.slice(0, slash) || '/', name = anchor.slice(slash + 1);
      list(parent, function (error, entries) {
        if (error) { callback(error); return; }
        var entry = findEntry(entries, name);
        if (!entry || entry.type !== 'dir') { callback(new Error('The storage root ' + anchor + ' is not an existing directory. No storage mount point was created.')); return; }
        var remaining = folder.slice(anchor.length).replace(/^\//, '').split('/'), index = 0, current = anchor, created = false;
        function next() {
          if (index === remaining.length || !remaining[index]) { callback(null, {folder:folder,created:created}); return; }
          var child = remaining[index++], path = current + '/' + child;
          list(current, function (listError, children) {
            if (listError) { callback(listError); return; }
            var existing = findEntry(children, child);
            if (existing) {
              if (existing.type !== 'dir') { callback(new Error('A file already occupies ' + path + '. Nothing was replaced.')); return; }
              current = path; next(); return;
            }
            request('POST', '/__local__/createFolder', {newPath:path}, function (createError, result) {
              if (createError) { callback(createError); return; }
              try { acknowledgment(result); } catch (caught) { callback(caught); return; }
              // The upstream handler ignores mkdir errors. Verify the new child
              // in its existing parent instead of trusting success:true alone.
              list(current, function (verifyError, after) {
                if (verifyError) { callback(verifyError); return; }
                var made = findEntry(after, child);
                if (!made || made.type !== 'dir') { callback(new Error('ezRemote did not verify the new directory ' + path + '. Check device permissions and free space.')); return; }
                created = true; current = path; next();
              });
            });
          });
        }
        next();
      });
    }
    return {
      applyReceiverUpdate: applyReceiverUpdate,
      prepareFolder:function (folder, confirmed, callback) {
        try { folder = safeFolder(platform, folder); if (!/\/whatwhatboy$/.test(folder)) fail('Create only the displayed whatwhatboy download folder.'); } catch (error) { callback(error); return; }
        verifyStorage(folder, confirmed, function (error) { if (error) { callback(error); return; } ensureDirectory(folder, callback); });
      },
      extractArchive:function (archive, destination, folderName, confirmed, item, callback) {
        var sourceFolder, filename;
        try {
          var slash = String(archive).lastIndexOf('/'); sourceFolder = safeFolder(platform, String(archive).slice(0,slash)); filename = String(archive).slice(slash+1);
          if (filename !== safeFilename(filename) || !isArchive({filename:filename})) fail('Choose a saved ZIP, RAR or 7z archive with its original filename.');
          if (!reviewedArchive(item) || item.filename !== filename) fail('Automatic extraction is limited to reviewed site archives up to 32 MiB. Use the native file manager for this archive.');
          destination = safeFolder(platform, destination);
          if (!/^[a-z0-9][a-z0-9._ -]{0,110}$/i.test(folderName) || /\.\./.test(folderName)) fail('Use a new simple extraction-folder name.');
          safeFolder(platform, destination + '/' + folderName);
          if (/^\/mnt\//.test(sourceFolder) && sourceFolder.split('/').slice(0,3).join('/') !== destination.split('/').slice(0,3).join('/')) fail('Keep extraction on the selected storage device.');
        } catch (error) { callback(error); return; }
        verifyStorage(sourceFolder, confirmed, function (storageError) {
          if (storageError) { callback(storageError); return; }
          list(sourceFolder, function (sourceError, files) {
            if (sourceError) { callback(sourceError); return; }
            var source = findEntry(files, filename);
            if (!source || source.type !== 'file') { callback(new Error('The complete saved archive is not present at ' + archive + '. Finish the download and verify it in ezRemote first.')); return; }
            if (Number(source.size) !== item.bytes) { callback(new Error('The saved archive size does not match the reviewed file. No extraction was requested.')); return; }
            verifyArchiveBytes(archive,item,function(hashError){
            if(hashError){callback(hashError);return;}
            verifyStorage(destination, confirmed, function (destinationError) {
              if (destinationError) { callback(destinationError); return; }
              ensureDirectory(destination, function (directoryError) {
                if (directoryError) { callback(directoryError); return; }
                list(destination, function (listError, entries) {
                  if (listError) { callback(listError); return; }
                  if (findEntry(entries, folderName)) { callback(new Error('The extraction destination already exists. Choose a new folder; no existing output will be reused.')); return; }
                  request('POST', '/__local__/extract', {item:archive,destination:destination,folderName:folderName}, function (extractError, result) {
                    if (extractError) { callback(extractError); return; }
                    try { acknowledgment(result); } catch (caught) { callback(caught); return; }
                    list(destination, function (verifyError, after) {
                      if (verifyError) { callback(verifyError); return; }
                      var output = findEntry(after, folderName), target = destination + '/' + folderName;
                      if (!output || output.type !== 'dir') { callback(new Error('ezRemote did not verify an extraction output folder. Inspect the native app before retrying.')); return; }
                      list(target, function (contentError, contents) {
                        if (contentError) { callback(contentError); return; }
                        if (!contents.length) { callback(new Error('The extraction output is empty. Inspect ezRemote for unsupported, encrypted or failed archive entries. The original archive was retained.')); return; }
                        callback(null, {folder:target,entries:contents.length});
                      });
                    });
                  });
                });
              });
            });
            });
          });
        });
      }
    };
  }
  function createClient(location, xhrFactory) {
    function request(method, path, body, callback) {
      if (!receiverOrigin(location)) { callback(new Error('Open this companion through your console receiver on port 6701.')); return; }
      var xhr = xhrFactory(), finished = false;
      function done(error) { if (finished) return; finished = true; callback(error, xhr.responseText || '', xhr.status); }
      try { xhr.open(method, path, true); } catch (error) { done(error); return; }
      xhr.timeout = 20000;
      if (body !== null) xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.onreadystatechange = function () { if (xhr.readyState === 4) done(xhr.status >= 200 && xhr.status < 300 ? null : new Error('Receiver HTTP ' + xhr.status + '.')); };
      xhr.onerror = function () { done(new Error('The console receiver is unreachable.')); };
      xhr.ontimeout = function () { done(new Error('The receiver did not respond in time.')); };
      try { xhr.send(body === null ? null : JSON.stringify(body)); } catch (error) { done(error); }
    }
    function detectStorage(platform, callback) {
        try { platform = platformName(platform); } catch (error) { callback(error); return; }
        if (platform !== 'ps5') { callback(new Error('This PS4 receiver has no storage-enumeration API. Confirm the mounted path in ezRemote.')); return; }
        request('GET', filesystemURL(location, '/mnt', true), null, function (error, text) {
          if (error) { callback(new Error('Storage detection needs PS5 websrv on port 8080. ' + error.message)); return; }
          try { callback(null, mountedStorage(JSON.parse(text))); } catch (caught) { callback(caught); }
        });
      }
    return {
      detectStorage: detectStorage,
      checkDestination: function (platform, folder, filename, callback) {
        try { platform = platformName(platform); folder = safeFolder(platform, folder); filename = safeFilename(filename); } catch (error) { callback(error); return; }
        if (platform === 'ps5') {
          function checkFolder() {
            request('GET', filesystemURL(location, folder, true), null, function (error, text) {
              if (error) { callback(new Error('Start PS5 websrv on port 8080 and confirm the existing destination folder. ' + error.message)); return; }
              try {
                var entries = folderEntries(text);
                for (var i = 0; i < entries.length; i++) if (entries[i] && (entries[i].name === filename || entries[i].name === filename + '.tmp')) fail('A file or partial download already exists at this destination. Choose another folder or manage it in ezRemote.');
                callback(null);
              } catch (caught) { callback(caught); }
            });
          }
          var mount = /^\/mnt\/(?:usb|ext)\d+(?=\/|$)/.exec(folder);
          if (!mount) { checkFolder(); return; }
          // Re-read mounts for every save. A disconnected drive may leave an
          // ordinary directory behind at the same path; listing it is insufficient.
          detectStorage(platform, function (error, mounts) {
            if (error) { callback(error); return; }
            for (var i = 0; i < mounts.length; i++) if (mounts[i].path === mount[0]) { checkFolder(); return; }
            callback(new Error('The device at ' + mount[0] + ' is no longer reported as mounted. Detect storage again or choose another destination. No download was queued.'));
          });
        } else {
          var target = encodeURI(folder + '/' + filename);
          request('HEAD', target, null, function (error, text, status) {
            if (!error) { callback(new Error('A file already exists at this destination. Choose another folder.')); return; }
            if (status !== 404) { callback(error); return; }
            request('HEAD', target + '.tmp', null, function (partialError, partialText, partialStatus) {
              if (!partialError) callback(new Error('A partial download already exists. Check the receiver queue or choose another folder.'));
              else if (partialStatus !== 404) callback(partialError);
              else callback(null);
            });
          });
        }
      },
      states: function (callback) { request('GET', '/get_download_state', null, function (error, text) { if (error) { callback(error); return; } try { var data = JSON.parse(text); if (Object.prototype.toString.call(data) !== '[object Array]') fail('The receiver status is invalid.'); for (var i = 0; i < data.length; i++) if (!data[i] || typeof data[i].path !== 'string' || data[i].path.charAt(0) !== '/') fail('The receiver returned an invalid queue entry.'); callback(null, data); } catch (caught) { callback(caught); } }); },
      queue: function (body, callback) { request('POST', '/download_url', body, function (error, text) { if (error) { error.uncertainSubmission = true; callback(error); return; } try { callback(null, submission(text)); } catch (caught) { caught.uncertainSubmission = caught.code !== 'rejected'; callback(caught); } }); }
    };
  }
  function formatBytes(value) { var n = Number(value) || 0, units = ['B', 'KiB', 'MiB', 'GiB'], i = 0; if (!n) return 'Size not supplied'; while (n >= 1024 && i < 3) { n /= 1024; i++; } return (i ? n.toFixed(1) : n) + ' ' + units[i]; }
  function isArchive(item) { return /\.(?:zip|7z|rar)$/i.test(item.filename || ''); }
  function preparation(item) {
    if (trim(item.preparation)) return trim(item.preparation);
    if (isArchive(item)) return 'Extract the complete archive, preserve its folders and follow the installation guide. Saving an archive does not extract it.';
    if (/\.json$/i.test(item.filename)) return 'Place in /data/GoldHEN/cheats/json and open the GoldHEN Cheat Menu for the exact matching PS4 title ID and game update.';
    if (/\.plugin$/i.test(item.filename)) return 'Install through the documented etaHEN plugin setup. This is not a standalone ELF payload.';
    if (/\.pkg$/i.test(item.filename)) return 'Install explicitly using a compatible package installer. Saving this PKG does not install it.';
    if (/\.(?:elf|bin)$/i.test(item.filename)) return 'Load explicitly using the documented compatible loader. Saving does not run this payload.';
    if (/\.xml$/i.test(item.filename)) return 'Follow the linked patch engine and game guide; a patch XML is not a payload or game executable.';
    return 'Place or enable this file using its exact game and loader guide. A loose plugin or script may also need supporting files from its original archive.';
  }
  function matches(item, platform, category, query, format) {
    var names = item.platforms || [platform], found = false, i;
    if (typeof names === 'string') names = [names];
    for (i = 0; i < names.length; i++) if (String(names[i]).toLowerCase() === platform) found = true;
    if (!found || (category && item.category !== category)) return false;
    if ((format === 'ready' && isArchive(item)) || (format === 'archives' && !isArchive(item))) return false;
    var searchable = [item.name, item.filename, item.description, item.version, item.compatibility, names.join(' ')].join(' ').toLowerCase();
    var words = trim(query).toLowerCase().split(/\s+/);
    for (i = 0; i < words.length; i++) if (words[i] && searchable.indexOf(words[i]) < 0) return false;
    return true;
  }
  function queryValue(search, name) {
    var match = new RegExp('(?:\\?|&)' + name + '=([^&]*)').exec(search || '');
    if (!match) return '';
    try { return decodeURIComponent(match[1].replace(/\+/g, ' ')); } catch (error) { return ''; }
  }
  function installReceiverUpdate(document, window, data) {
    var platform = platformName(data.platform);
    var panel = document.getElementById('receiver-preparation');
    if (!panel) return;
    panel.hidden = false;
    var downloads = document.getElementById('receiver-download-ui');
    if (downloads) downloads.hidden = true;
    var setup = document.getElementById('receiver-setup');
    if (setup) setup.hidden = true;
    var title = document.getElementById('receiver-title'), intro = document.getElementById('receiver-intro');
    if (title) title.textContent = 'Update the ' + platform.toUpperCase() + ' downloader';
    if (intro) intro.textContent = 'Verify the staged download and keep a backup before replacing the installed page.';
    function text(tag, message, className) {
      var node = document.createElement(tag);
      if (className) node.className = className;
      node.textContent = message;
      panel.appendChild(node);
      return node;
    }
    var status = text('p', '', 'receiver-message');
    status.setAttribute('role', 'status');
    var sha = queryValue(window.location.search, 'sha256');
    var bytes = queryValue(window.location.search, 'bytes');
    try { receiverUpdateSpec(platform, window.location, data.version, sha, bytes); }
    catch (error) { status.textContent = error.message; return; }
    status.textContent = 'Staged version ' + data.version + ' is ready to check.';
    var button = text('button', 'Apply update', 'receiver-prepare-action');
    button.type = 'button';
    var progressBar = text('progress', '');
    progressBar.hidden = true;
    progressBar.setAttribute('aria-label', 'Checking downloader update');
    var client = createManagerClient(platform, window.location, function () { return new window.XMLHttpRequest(); }, window);
    var receiver = 'http://' + localHost(window.location) + ':6701/' + (platform === 'ps4' ? 'data/' : '');
    var installedURL = receiver + 'whatsite-' + platform + '.html';
    button.onclick = function () {
      if (button.disabled) return;
      button.disabled = true;
      progressBar.hidden = false;
      status.textContent = 'Checking the staged file, the installed downloader and its backup…';
      client.applyReceiverUpdate(data.version, sha, bytes, function (error, result) {
        progressBar.hidden = true;
        if (error) {
          status.className = 'receiver-message receiver-error';
          status.textContent = error.message;
          if (result && result.backup) {
            text('a', 'Open the verified backup', 'receiver-guide').href = receiver + result.backup;
          } else {
            text('a', 'Return to installed downloader', 'receiver-guide').href = installedURL + '?reopen=' + new Date().getTime();
          }
          return;
        }
        status.textContent = result.alreadyCurrent ? 'This version is already installed.' : 'Update installed and verified. The previous downloader is saved as a backup.';
        text('a', 'Open updated downloader', 'receiver-guide').href = installedURL + '?v=' + data.version;
        if (result.backup) text('a', 'Open previous downloader', 'receiver-guide').href = receiver + result.backup;
      });
    };
  }
  function installPreparation(document, window, platform, items) {
    var panel = document.getElementById('receiver-preparation'), normal = document.getElementById('receiver-download-ui');
    if (!panel) return;
    panel.hidden = false; if (normal) normal.hidden = true;
    var title=document.getElementById('receiver-title'),intro=document.getElementById('receiver-intro');
    if(title)title.textContent='Prepare files on your ' + platform.toUpperCase();
    if(intro)intro.textContent='Create a download folder or extract a reviewed saved archive through the installed ezRemote Client. Each operation requires its own explicit click.';
    var allowed = managerOrigin(platform, window.location), client = createManagerClient(platform, window.location, function () { return new window.XMLHttpRequest(); });
    var setup=document.getElementById('receiver-setup');if(setup)setup.hidden=allowed;
    function text(tag, content, className) { var node = document.createElement(tag); if (className) node.className = className; node.appendChild(document.createTextNode(content)); panel.appendChild(node); return node; }
    var folder = queryValue(window.location.search, 'folder') || '/data', archive = queryValue(window.location.search, 'archive'), target;
    try {
      folder = safeFolder(platform, folder); target = downloadFolder(platform, folder);
      if(archive){var archiveSlash=archive.lastIndexOf('/'),archiveName=archive.slice(archiveSlash+1);if(safeFolder(platform,archive.slice(0,archiveSlash))!==folder || archiveName!==safeFilename(archiveName) || !isArchive({filename:archiveName}))fail('Choose a complete ZIP, RAR or 7z saved inside the selected folder.');}
    } catch (error) { text('h2','Choose a supported storage folder'); text('p',error.message,'receiver-error'); return; }
    text('h2', archive ? 'Extract a saved archive on your console' : 'Prepare your download folder');
    text('p','This step uses the installed ezRemote Client. Keep that app running. Creating a folder or extracting an archive happens only after you press the action below.');
    text('p',allowed ? 'Connected to the correct local client origin. The operation will verify its directories before making changes.' : 'Open this installed page through ezRemote Client on port ' + (platform === 'ps4' ? '8080' : '9090') + '. The public copy cannot create folders or extract files. If you changed the client port, use its native file-manager interface.','receiver-help');
    var manager = text('a','Open ezRemote file manager','receiver-guide'); manager.href = 'http://' + localHost(window.location) + ':' + (platform === 'ps4' ? '8080' : '9090') + '/index.html'; manager.target='_blank'; manager.rel='noopener noreferrer';
    var targetLabel = text('p',archive ? 'Saved archive: ' + archive : 'Download folder: ' + target,'receiver-operation-path');
    var nameInput = null, destination = archive ? target + '/extracted' : target, archiveItem=null;
    if (archive) {
      for(var i=0;i<items.length;i++)if(items[i].filename===safeFilename(archive) && matches(items[i],platform,'','','archives') && reviewedArchive(items[i])){archiveItem=items[i];break;}
      text('p','The original ZIP, RAR or 7z remains where it is. Output uses a new folder; an existing extraction folder is refused. Encrypted or unsupported files may need the native app. Extracted files are not installed or run.');
      text('label','New extraction-folder name').setAttribute('for','receiver-extract-name');
      nameInput = document.createElement('input'); nameInput.id='receiver-extract-name'; nameInput.value=safeFilename(archive).replace(/\.(zip|rar|7z)$/i,'').replace(/[^a-z0-9._-]/gi,'-').slice(0,45) + '-' + new Date().getTime(); panel.appendChild(nameInput);
      targetLabel.textContent = 'Saved archive: ' + archive + ' · Output parent: ' + destination;
      if(!archiveItem)text('p','This archive has no matching content-safety review within the 32 MiB browser verification limit. Automatic extraction is unavailable. Open the real ezRemote file manager to inspect and extract it manually.','receiver-help');
    }
    var confirmed = null;
    if (platform === 'ps4' && /^\/mnt\//.test(folder)) {
      var label = text('label','','receiver-confirm'); confirmed = document.createElement('input'); confirmed.type='checkbox'; label.appendChild(confirmed); label.appendChild(document.createTextNode('I confirmed this exact USB device is mounted in ezRemote. Its number does not identify a physical USB port.'));
    }
    var button = text('button',archive ? 'Verify checksum & extract into new folder' : 'Create or verify download folder','receiver-prepare-action'); button.type='button'; button.disabled=!allowed || !!(archive && !archiveItem);
    var status = text('p','Ready. No filesystem operation has been requested.','receiver-message'); status.setAttribute('role','status'); status.setAttribute('aria-live','polite');
    var progressBar = document.createElement('progress'); progressBar.hidden=true; progressBar.setAttribute('aria-label','ezRemote operation in progress'); panel.appendChild(progressBar);
    var use = text('a',archive ? 'Return to the download folder' : 'Use this verified folder in the downloader','receiver-guide'); use.hidden=true;
    var busy = false;
    button.onclick = function () {
      if (!allowed || busy || archive && !archiveItem) return;
      if (confirmed && !confirmed.checked) { status.textContent='Confirm the mounted device in ezRemote before proceeding.'; status.className='receiver-message receiver-error'; return; }
      busy=true; button.disabled=true; if (nameInput) nameInput.disabled=true; if (confirmed) confirmed.disabled=true;
      progressBar.hidden=false; status.className='receiver-message';
      status.textContent=archive ? 'Reading the saved archive and checking its SHA-256 against the reviewed contents, then checking the new destination before extraction. ezRemote does not report a percentage. Keep the app running; do not send another extraction.' : 'Checking existing directories, creating only missing folders, and verifying the result…';
      function complete(error, result) {
        progressBar.hidden=true;
        if (error) { status.textContent=error.message + ' Inspect ezRemote before repeating this action. Existing files and any partial extraction are retained.'; status.className='receiver-message receiver-error'; return; }
        var nextFolder=archive ? folder : result.folder;
        use.href=receiverURL(window.location,platform,nextFolder); use.hidden=false;
        status.textContent=archive ? 'ezRemote reports extraction finished. The output folder contains ' + result.entries + ' top-level entries: ' + result.folder + '. Inspect its complete contents before installation; hashes and game compatibility were not verified.' : (result.created ? 'Created and verified ' : 'Verified existing ') + result.folder + '. Existing files were preserved. You can now return to the downloader.';
        if (platform === 'ps5') { var browse=text('a','Browse verified output folder','receiver-guide'); browse.href=filesystemURL(window.location,result.folder,false); browse.target='_blank'; browse.rel='noopener noreferrer'; }
      }
      if (archive) client.extractArchive(archive,destination,nameInput.value,!!(confirmed && confirmed.checked),archiveItem,complete);
      else client.prepareFolder(target,!!(confirmed && confirmed.checked),complete);
    };
  }
  function install(document, window) {
    if (!document) return;
    function boot() {
      var dataNode = document.getElementById('receiver-catalog');
      if (!dataNode) return;
      var data = JSON.parse(dataNode.textContent), platform = platformName(data.platform), items = data.items || [];
      if (queryValue(window.location.search, 'apply-update') === '1') { installReceiverUpdate(document, window, data); return; }
      if (queryValue(window.location.search,'prepare') === '1') { installPreparation(document,window,platform,items); return; }
      var selectedRequest = /(?:\?|&)(?:file|id)(?:=([^&]*))?(?=&|$)/.exec(window.location.search || '');
      var selectedId = '', selectedItems = [], unavailableFile = false;
      if (selectedRequest) {
        try { selectedId = decodeURIComponent((selectedRequest[1] || '').replace(/\+/g, ' ')); } catch (ignore) {}
        for (var requestedIndex = 0; requestedIndex < items.length; requestedIndex++) {
          var requestedItem = items[requestedIndex];
          if (selectedId && (requestedItem.id === selectedId || requestedItem.receiverFileId === selectedId) &&
            matches(requestedItem, platform, '', '', 'all')) selectedItems.push(requestedItem);
        }
        // A file link is an exact catalogue identity, not a fuzzy name search.
        // Unknown, wrong-platform or ambiguous IDs must not expose other saves.
        unavailableFile = selectedItems.length !== 1;
        items = unavailableFile ? [] : selectedItems;
      }
      var allowed = receiverOrigin(window.location), client = createClient(window.location, function () { return new window.XMLHttpRequest(); });
      var list = document.getElementById('receiver-files'), search = document.getElementById('receiver-search'), category = document.getElementById('receiver-category');
      var format = document.getElementById('receiver-format'), connection = document.getElementById('receiver-connection'), queueList = document.getElementById('receiver-queue'), folderStatus = document.getElementById('receiver-folder-status');
      var folder = document.getElementById('receiver-folder'), storage = document.getElementById('receiver-storage'), message = document.getElementById('receiver-message');
      var detect = document.getElementById('receiver-detect'), storageStatus = document.getElementById('receiver-storage-status');
      var folderConfirmed = document.getElementById('receiver-folder-confirmed'), browse = document.getElementById('receiver-browse');
      var prepareOpen = document.getElementById('receiver-prepare-open'), managerOpen = document.getElementById('receiver-manager-open');
      var jobs = Object.create(null), cards = Object.create(null), timer = null, sequence = 0, readingQueue = false;
      var latestMounts = null, mountReadFailed = false, destinationUnavailable = false;
      var completedPaths = Object.create(null);
      function text(parent, tag, content, className) { var el = document.createElement(tag); if (className) el.className = className; el.appendChild(document.createTextNode(String(content || ''))); parent.appendChild(el); return el; }
      function announce(content, error) { message.textContent = content; message.className = error ? 'receiver-message receiver-error' : 'receiver-message'; }
      function transferLabel(p) {
        if (p.total) return p.label + ' · ' + p.percent + '% · ' + formatBytes(p.transferred) + ' / ' + formatBytes(p.total);
        return p.label + (p.transferred ? ' · ' + formatBytes(p.transferred) + ' received' : '');
      }
      function paintBar(bar, p) {
        var active = p.phase === 'queued' || p.phase === 'downloading' || p.phase === 'resumed' || p.phase === 'submitted';
        bar.hidden = !active && !p.complete && !p.total;
        if (p.total || p.complete) bar.value = p.total ? p.percent : 100;
        else if (active) bar.removeAttribute('value');
      }
      function ready(job, item) {
        var p = job.progress;
        return allowed && job.current && !job.existing && p && p.complete &&
          (!p.total || p.total === item.bytes) && (!p.transferred || p.transferred === item.bytes) &&
          (!p.total || p.transferred === p.total);
      }
      function savedArchive(card) {
        if (!card.extractLink) return;
        var path, status;
        if (allowed && !destinationUnavailable) {
          try {
            path = safeFolder(platform, folder.value) + '/' + safeFilename(card.item.filename);
            status = completedPaths[path];
          } catch (_) {}
        }
        var complete = status && status.total === card.item.bytes && status.transferred === card.item.bytes;
        card.extractLink.hidden = !complete;
        if (complete) {
          if (card.extractLink.textContent !== 'Verify & extract saved copy') card.extractLink.textContent = 'Verify & extract saved copy';
          card.extractLink.href = preparationURL(window.location, platform, path.slice(0, path.lastIndexOf('/')), path);
        }
      }
      function refreshSavedArchives() {
        for (var id in cards) if (!jobs[id]) savedArchive(cards[id]);
      }
      function updateStates(states) {
        completedPaths = Object.create(null);
        for (var j = 0; j < states.length; j++) {
          var completed = progress(states[j]);
          if (completed.complete) completedPaths[states[j].path] = completed;
          else delete completedPaths[states[j].path];
        }
        if (connection) { connection.textContent = 'Receiver answered · ' + states.length + ' download records. Queue status is supplied by ezRemote.'; connection.className = 'receiver-help'; }
        if (queueList) {
          while (queueList.firstChild) queueList.removeChild(queueList.firstChild);
          if (!states.length) text(queueList, 'p', 'The receiver queue is empty.');
          for (var n = states.length - 1; n >= Math.max(0, states.length - 20); n--) {
            var state = progress(states[n]);
            var row = text(queueList, 'p', transferLabel(state) + ' · ' + states[n].path, 'receiver-queue-row');
            row.setAttribute('data-state', state.phase);
          }
        }
        for (var key in jobs) if (Object.prototype.hasOwnProperty.call(jobs, key)) {
          var job = jobs[key], found = false;
          if (job.preflight) continue;
          for (var i = 0; i < states.length; i++) if (states[i].path === job.body.dest_path) { job.progress = progress(states[i]); found = true; }
          if (!found && job.confirmed) job.progress = {label:'Queue record unavailable. Inspect the destination in the file manager.',phase:'unknown'};
          job.current = found;
          if (found) job.confirmed = true;
          if (found && !job.existing && job.progress.complete && !job.completionAnnounced) {
            job.completionAnnounced = true;
            announce('Receiver reports saved to: ' + job.body.dest_path + '. Check the file card for the next step.');
          }
          paint(key);
        }
        refreshSavedArchives();
      }
      function statusError(error) {
        completedPaths = Object.create(null);
        refreshSavedArchives();
        var content = error.message + ' Keep the matching ezRemote Server running, then use Check receiver. Existing transfers may still be running; do not queue them again until you inspect the receiver.';
        if (connection) { connection.textContent = content; connection.className = 'receiver-help receiver-error'; }
        else announce(content, true);
        for (var id in jobs) {
          if (!jobs[id].current) continue;
          jobs[id].current = false;
          jobs[id].progress = {label:'Live progress unavailable. Check the receiver connection.',phase:'unknown'};
          paint(id);
        }
      }
      function refresh() {
        if (!allowed || readingQueue) return;
        if (timer !== null) window.clearTimeout(timer);
        readingQueue = true;
        client.states(function (error, states) {
          readingQueue = false;
          if (error) statusError(error); else updateStates(states);
          timer = window.setTimeout(refresh, 2500);
        });
      }
      function paint(id) {
        var card = cards[id], job = jobs[id]; if (!card || !job) return;
        var p = job.progress || {label: 'Submitted. Waiting for the receiver.', phase: 'submitted'};
        var canPrepare = ready(job, card.item), dest = job.body.dest_path, status = transferLabel(p) + ' · ' + dest;
        var canVerifyArchive = card.extractLink && job.existing && allowed && job.current && p.complete &&
          p.total === card.item.bytes && p.transferred === card.item.bytes;
        if (p.phase === 'failed') status += ' · Check free space, storage and the file URL in ezRemote.';
        if (card.extractLink) {
          card.extractLink.hidden = !canPrepare && !canVerifyArchive;
          var label = canVerifyArchive ? 'Verify & extract saved copy' : 'Extract';
          if (card.extractLink.textContent !== label) card.extractLink.textContent = label;
          if (!card.extractLink.hidden) card.extractLink.href = preparationURL(window.location, platform, dest.slice(0, dest.lastIndexOf('/')), dest);
        }
        if (card.installLink) {
          card.installLink.hidden = true;
          if (canPrepare) {
            try {
              card.installLink.href = packageInstallerURL(window.location, platform, dest, card.item.bytes);
              card.installLink.hidden = false;
            } catch (_) {
              status += ' · Install PKG needs a supported local address and a file under /data or USB 0–9. Use the native ezRemote file manager for this copy.';
            }
          } else if (p.complete && job.current && job.existing) {
            status += ' · For a previously saved PKG, inspect it in ezRemote and open the installed package helper from Package Library.';
          }
        }
        if (p.complete && !canPrepare && !canVerifyArchive && !(card.installLink && job.current && job.existing)) {
          status += ' · Check the saved file in the native file manager.';
        }
        if (card.status.textContent !== status) card.status.textContent = status;
        card.status.setAttribute('data-state', p.phase);
        paintBar(card.bar, p); card.button.disabled = true;
      }
      function save(item) {
        var body;
        if (!allowed) { announce('Open the installed local companion through the console receiver to save files.', true); return; }
        if (item.receiverSupported === false) { announce('Use the publisher URL in the native ezRemote file manager for this file.', true); return; }
        if (destinationUnavailable) { announce('Choose a valid existing folder and confirm that the selected device is still mounted. Detect storage again if needed.', true); return; }
        if (platform === 'ps4' && (!folderConfirmed || !folderConfirmed.checked)) { announce('Confirm this existing save folder in ezRemote, then tick the folder confirmation before saving. The PS4 receiver cannot list folders or detect USB devices.', true); return; }
        try { body = makeRequest(platform, item, folder.value, new Date().getTime() * 1000 + (++sequence)); } catch (error) { announce(error.message, true); return; }
        if (jobs[item.id]) { announce('This item was already submitted in this session. Check its receiver status.'); return; }
        for (var jobId in jobs) if (Object.prototype.hasOwnProperty.call(jobs, jobId) && jobs[jobId].body.dest_path === body.dest_path) { announce('Another item is using this destination. Choose a different existing folder.', true); return; }
        var card = cards[item.id]; card.button.disabled = true;
        jobs[item.id] = {body: body, preflight: true, progress: {label: 'Checking current queue and destination', phase: 'checking'}}; paint(item.id);
        function rejected(error) {
          if (error.uncertainSubmission) {
            jobs[item.id] = {body:body,progress:{label:'Submission could not be confirmed. Check receiver and inspect this destination in ezRemote before retrying.',phase:'unknown',percent:0}};
            paint(item.id); announce(error.message + ' The request may have reached the receiver. A duplicate has not been sent.', true); return;
          }
          delete jobs[item.id];
          if (cards[item.id]) { cards[item.id].button.disabled = !allowed || destinationUnavailable; cards[item.id].bar.hidden = true; cards[item.id].status.textContent = error.message; cards[item.id].status.setAttribute('data-state', 'failed'); }
          announce(error.message, true);
        }
        announce('Checking the receiver queue and ' + body.dest_path + ' before submitting…');
        client.states(function (stateError, states) {
          if (stateError) { rejected(new Error('Cannot confirm the receiver queue. No download was submitted. ' + stateError.message)); return; }
          for (var i = 0; i < states.length; i++) if (states[i].path === body.dest_path) {
            jobs[item.id] = {body:body,progress:progress(states[i]),confirmed:true,current:true,existing:true}; paint(item.id);
            announce('The receiver already has a record for this destination. No duplicate was queued. Inspect it in ezRemote before choosing another folder.'); return;
          }
          client.checkDestination(platform, body.dest_path.slice(0, body.dest_path.lastIndexOf('/')), safeFilename(body.dest_path), function (checkError) {
            if (checkError) { rejected(checkError); return; }
            client.queue(body, function (error) {
              if (error) { rejected(error); return; }
              jobs[item.id] = {body: body}; paint(item.id);
              announce('Request submitted. The receiver queue will report progress; submission does not mean the file is saved.');
            });
          });
        });
      }
      function draw() {
        while (list.firstChild) list.removeChild(list.firstChild); cards = Object.create(null); var count = 0;
        for (var i = 0; i < items.length; i++) {
          var item = items[i]; if (!matches(item, platform, category.value, search.value, format ? format.value : 'all')) continue;
          count++;
          var article = document.createElement('article'); article.className = 'receiver-file'; article.id = 'file-' + i; list.appendChild(article);
          var extension = String(item.filename || '').split('.').pop().toUpperCase(); text(article, 'span', extension || 'FILE', 'receiver-type');
          text(article, 'h2', item.name);
          if (item.description) text(article, 'p', item.description, 'receiver-description');
          text(article, 'p', (item.version || 'Version not supplied') + ' · ' + formatBytes(item.bytes) + ' · ' + item.category, 'receiver-meta');
          if (item.compatibility && trim(item.description).indexOf(trim(item.compatibility)) < 0) text(article, 'p', item.compatibility, 'receiver-compatibility');
          else if (!item.description) text(article, 'p', 'Check the project’s requirements for your firmware.', 'receiver-compatibility');
          text(article, 'p', 'After saving: ' + preparation(item), 'receiver-next-action');
          text(article, 'code', item.filename, 'receiver-filename');
          if (typeof item.page === 'string' && /^\/console\//.test(item.page)) {
            var guide = text(article, 'a', 'Setup & compatibility', 'receiver-guide');
            guide.href = 'https://whatwhatboy.com' + item.page; guide.target = '_blank'; guide.rel = 'noopener noreferrer';
          }
          var extractLink = null, installLink = null;
          if (/^[a-f0-9]{64}$/i.test(item.sha256 || '')) {
            var details = document.createElement('details'); article.appendChild(details);
            text(details, 'summary', 'SHA-256 checksum'); text(details, 'code', item.sha256, 'receiver-hash');
          }
          var manualOnly = item.receiverSupported === false;
          if (manualOnly) {
            text(article, 'p', 'In ezRemote, use Download URL and enter this exact publisher address.', 'receiver-next-action');
            try {
              var publisher = parseUrl(item.url);
              if (publisher.protocol === 'https:') text(article, 'code', publisher.url, 'receiver-filename');
            } catch (_) {}
            if (allowed) {
              var fileManager = text(article, 'a', 'Open ezRemote file manager', 'receiver-guide');
              fileManager.href = 'http://' + localHost(window.location) + ':' + (platform === 'ps4' ? '8080' : '9090') + '/index.html';
            }
          }
          var button = text(article, 'button', 'Save to console', 'receiver-save'); button.type = 'button'; button.disabled = !allowed || destinationUnavailable || manualOnly;
          button.onclick = (function (selected) { return function () { save(selected); }; }(item));
          var status = text(article, 'p', '', 'receiver-file-status'); status.setAttribute('aria-live', 'polite');
          var bar = document.createElement('progress'); bar.max = 100; bar.value = 0; bar.hidden = true; bar.setAttribute('aria-label', 'Download progress'); article.appendChild(bar);
          if (!manualOnly && /\.pkg$/i.test(item.filename || '')) { installLink=text(article,'a','Install PKG','receiver-guide receiver-ready'); installLink.target='_blank'; installLink.rel='noopener noreferrer'; installLink.hidden=true; }
          if (!manualOnly && reviewedArchive(item)) { extractLink=text(article,'a','Extract','receiver-guide receiver-ready'); extractLink.target='_blank'; extractLink.rel='noopener noreferrer'; extractLink.hidden=true; }
          cards[item.id] = {button: button, status: status, bar: bar, extractLink:extractLink, installLink:installLink, item:item}; paint(item.id);
        }
        document.getElementById('receiver-count').textContent = count + ' files' + (format && format.value === 'ready' ? ' · archive files hidden' : '');
        if (!count) text(list, 'p', unavailableFile ? 'The requested file is unavailable in this installed ' + platform.toUpperCase() + ' downloader. Update the companion from the site and open the file again. No download was queued.' : 'No files match these filters. Choose All files to include archives, or clear the search.', unavailableFile ? 'receiver-error' : '');
        folderChanged(false);
      }
      function folderChanged(resetConfirmation) {
        if (folderConfirmed && resetConfirmation !== false) folderConfirmed.checked = false;
        destinationUnavailable = false;
        try {
          var chosenFolder = safeFolder(platform, folder.value);
          var chosenMount = /^\/mnt\/(?:usb|ext)\d+(?=\/|$)/.exec(chosenFolder), found = false;
          if (platform === 'ps5' && chosenMount && (latestMounts !== null || mountReadFailed)) {
            for (var i = 0; latestMounts && i < latestMounts.length; i++) if (latestMounts[i].path === chosenMount[0]) found = true;
            destinationUnavailable = !found || mountReadFailed;
          }
          if (browse && platform === 'ps5') { browse.href = filesystemURL(window.location, chosenFolder, false); browse.hidden = !allowed || destinationUnavailable; }
          if (prepareOpen) { prepareOpen.href=preparationURL(window.location,platform,chosenFolder); prepareOpen.hidden=!allowed || destinationUnavailable; }
          if (managerOpen) { managerOpen.href='http://' + localHost(window.location) + ':' + (platform === 'ps4' ? '8080' : '9090') + '/index.html'; managerOpen.hidden=!allowed; }
          if (folderStatus) folderStatus.textContent = destinationUnavailable ? 'This device is absent from the latest mounted-storage results or could not be checked. Detect storage again, or choose internal storage. Save is disabled for this folder.' : platform === 'ps5' ? 'Save checks the current queue, mounted device and existing folder before submitting. A folder listing does not prove free space or write permission.' : 'Confirm the exact existing folder in ezRemote before saving. The PS4 receiver checks filename collisions but cannot list the parent folder.';
        } catch (error) {
          destinationUnavailable = true; if (browse) browse.hidden = true;
          if (prepareOpen) prepareOpen.hidden=true;
          if (folderStatus) folderStatus.textContent = error.message;
        }
        folder.setAttribute('aria-invalid', destinationUnavailable ? 'true' : 'false');
        for (var id in cards) if (Object.prototype.hasOwnProperty.call(cards, id)) {
          if (!jobs[id]) cards[id].button.disabled = !allowed || destinationUnavailable || cards[id].item.receiverSupported === false;
        }
        refreshSavedArchives();
      }
      function detectStorage() {
        if (!allowed || platform !== 'ps5') return;
        if (detect) detect.disabled = true;
        if (storageStatus) storageStatus.textContent = 'Reading mounted storage from PS5 websrv…';
        client.detectStorage(platform, function (error, mounts) {
          if (detect) detect.disabled = false;
          latestMounts = error ? null : mounts; mountReadFailed = !!error;
          // Clear stale devices before showing current results. Detection never
          // changes the selected save folder or starts a transfer.
          while (storage.firstChild) storage.removeChild(storage.firstChild);
          var internal = text(storage, 'option', 'Internal HDD / SSD · /data/whatwhatboy'); internal.value = '/data/whatwhatboy';
          if (!error) for (var i = 0; i < mounts.length; i++) {
            var option = text(storage, 'option', mounts[i].kind + ' · ' + mounts[i].path + ' (detected)'); option.value = mounts[i].path + '/whatwhatboy';
          }
          var custom = text(storage, 'option', 'Existing folder (enter path)'); custom.value = '';
          storage.value = folder.value === '/data/whatwhatboy' ? '/data/whatwhatboy' : '';
          if (!error) for (var j = 0; j < mounts.length; j++) if (mounts[j].path + '/whatwhatboy' === folder.value) storage.value = folder.value;
          if (storageStatus) storageStatus.textContent = error ? error.message + ' The save folder has not changed.' : (mounts.length ? mounts.length + ' mounted device path' + (mounts.length === 1 ? '' : 's') + ' detected.' : 'No USB or external device mounts were reported.') + ' Mount numbers do not identify physical USB ports. Writability and available space must be checked in the file manager.';
          folderChanged(false);
        });
      }
      search.oninput = draw; category.onchange = draw;
      if (format) format.onchange = draw;
      storage.onchange = function () { if (storage.value) folder.value = storage.value; folderChanged(); };
      folder.oninput = folderChanged; folder.onchange = folderChanged;
      if (detect) { detect.disabled = !allowed || platform !== 'ps5'; detect.onclick = detectStorage; }
      document.getElementById('receiver-check').onclick = refresh;
      document.getElementById('receiver-check').disabled = !allowed;
      var notice = document.getElementById('receiver-setup'); notice.hidden = allowed;
      if (!allowed) announce('Preview mode. Save buttons work only when this file is opened through your console’s HTTP receiver on port 6701.');
      else announce('Choose an existing folder and a file. Save checks the current receiver queue and destination before submitting.');
      folderChanged(false);
      var requestedFolder=queryValue(window.location.search,'folder');
      if (requestedFolder) { try { folder.value=safeFolder(platform,requestedFolder); storage.value=folder.value === '/data/whatwhatboy' ? '/data/whatwhatboy' : ''; } catch (error) { announce(error.message,true); } }
      if (selectedRequest && !unavailableFile) { search.value = items[0].name; if (format) format.value = isArchive(items[0]) ? 'archives' : 'ready'; }
      if (unavailableFile) announce('The requested file is unavailable in this installed ' + platform.toUpperCase() + ' downloader. Update the companion from the site and open the file again. No download was queued.', true);
      draw(); if (allowed) refresh();
      document.addEventListener('keydown', function (event) {
        var code = event.keyCode, target = event.target, tag = target && target.tagName;
        if (code < 37 || code > 40 || tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
        var elements = document.querySelectorAll('a,button,input,select'), available = [], index = -1, k;
        for (k = 0; k < elements.length; k++) if (!elements[k].disabled && elements[k].offsetParent !== null) { if (elements[k] === target) index = available.length; available.push(elements[k]); }
        if (available.length && index >= 0) { event.preventDefault(); available[(index + ((code === 37 || code === 38) ? -1 : 1) + available.length) % available.length].focus(); }
      });
      window.addEventListener('pagehide', function () { if (timer !== null) window.clearTimeout(timer); });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  }
  return {packageInstallerURL:packageInstallerURL,parseUrl: parseUrl, receiverOrigin: receiverOrigin, safeFolder: safeFolder, safeFilename: safeFilename, makeRequest: makeRequest, submission: submission, progress: progress, filesystemURL: filesystemURL, mountedStorage: mountedStorage, folderEntries: folderEntries, managerOrigin:managerOrigin, downloadFolder:downloadFolder, preparationURL:preparationURL, receiverURL:receiverURL, sha256Bytes:sha256Bytes, reviewedArchive:reviewedArchive, createManagerClient:createManagerClient, createClient: createClient, formatBytes: formatBytes, isArchive:isArchive, preparation:preparation, matches: matches, install: install};
}));
