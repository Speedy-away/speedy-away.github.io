#!/usr/bin/env node
'use strict';
// Optional desktop sender. Importing this module neither listens nor sends bytes.
// Protocol sources and operation instructions: docs/host-console-services.md.
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const net = require('node:net');
const dns = require('node:dns/promises');
const crypto = require('node:crypto');
const {normalizeAddress} = require('../assets/host-console-client.js');
const ROOT = path.resolve(__dirname, '..');
const MAX_FILE = 64 * 1024 * 1024;
const CATALOGUES = ['docs/host-actions-ps4.json', 'docs/host-webkitty-loader-actions.json', 'docs/host-actions-ps5.json', 'docs/host-game-actions.json', 'docs/host-modern-plugin-actions.json', 'docs/host-current-cheat-actions.json', 'docs/host-legacy-menu-actions.json', 'docs/host-extra-game-actions.json', 'docs/host-native-payload-actions.json', 'docs/host-web-utility-actions.json', 'docs/host-repository-menu-actions.json', 'docs/host-original-tool-actions.json', 'docs/host-legacy-firmware-menu-actions.json', 'docs/host-next-utility-actions.json', 'docs/host-gta505-continuation-actions.json', 'docs/host-arabicguy-672-actions.json'];
const MIME = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon','.woff2':'font/woff2','.elf':'application/octet-stream','.bin':'application/octet-stream'};
function fail(code, message) { const e = new Error(message); e.code = code; return e; }
function uncertainFailure(error) {
  if (!error.code) error.code = 'transfer-result-unknown';
  error.mayHaveExecuted = true;
  error.outcome = 'unknown';
  error.message = 'The transfer result is unknown. Check the console before trying again. ' + error.message;
  return error;
}
function isPrivateIPv4(value) {
  if (net.isIP(value) !== 4) return false;
  const a = value.split('.').map(Number);
  return (a[0] === 10 || a[0] === 192 && a[1] === 168 || a[0] === 172 && a[1] >= 16 && a[1] <= 31) && a[3] !== 0 && a[3] !== 255;
}
async function resolveConsoleAddress(value, lookup = dns.lookup) {
  const name = normalizeAddress(value);
  // Loopback means the computer running this helper, not the console browser.
  if (net.isIP(name)) {
    if (!isPrivateIPv4(name)) throw fail('console-lan-address-required', 'Enter the console LAN IPv4 address. Loopback points to this computer.');
    return name;
  }
  const records = await lookup(name, {all:true, verbatim:true});
  if (!records.length || records.some(r => r.family !== 4 || !isPrivateIPv4(r.address))) throw fail('console-lan-address-required', 'The console hostname must resolve only to private LAN IPv4 addresses.');
  return records[0].address; // Connect to this checked numeric result; do not resolve a second time.
}
function loadActions(root = ROOT) {
  const actions = [], keys = new Set();
  for (const name of CATALOGUES) {
    if (!fs.existsSync(path.join(root, name))) continue;
    const data = JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
    for (const entry of data.actions || []) {
      const a = {...entry, platform: entry.platform || data.platform};
      if (!['ps4','ps5'].includes(a.platform) || !/^[a-z0-9][a-z0-9._-]{0,127}$/i.test(a.id || '')) throw fail('invalid-catalogue', 'Invalid host action identifier or platform in ' + name + '.');
      const key = a.platform + ':' + a.id;
      if (keys.has(key)) throw fail('invalid-catalogue', 'Duplicate host action: ' + key);
      keys.add(key); actions.push(a);
    }
  }
  return actions;
}
function localFileFor(action, root = ROOT, {forRun = true} = {}) {
  if (forRun && action.run?.input === 'user-file') throw fail('user-file-required', 'Select the exact downloaded BIN through the paired sender.');
  const url = action.downloadURL || '';
  if (!/^\/downloads\//.test(url) || /[?#\x00-\x1f\\]/.test(url)) throw fail('local-file-required', 'A locally hosted ready-to-use file is required for the sender.');
  let decoded;
  try { decoded = decodeURIComponent(url); } catch (_) { throw fail('invalid-file', 'Invalid download path.'); }
  if (decoded.split('/').some(p => p === '..' || p === '.') || /[\x00-\x1f\\]/.test(decoded)) throw fail('invalid-file', 'The download path is invalid.');
  const format = String(action.format || '').toUpperCase();
  const formats = forRun ? ['ELF','BIN'] : ['ELF','BIN','PRX','SPRX','JSON','SHN','XML','MC4'];
  if (!formats.includes(format) || path.extname(decoded).toUpperCase() !== '.' + format) throw fail('unsupported-format', 'This action does not contain a supported ready-to-use file.');
  if (!/^[a-f0-9]{64}$/i.test(action.sha256 || '')) throw fail('checksum-required', 'The curated action must include its SHA-256 checksum.');
  const run = action.run || {};
  const supported = (run.type === 'elf-tcp' || run.type === 'elf-http' && action.platform === 'ps5') && format === 'ELF' && run.port === 9021 ||
    run.type === 'bin-tcp' && action.platform === 'ps4' && format === 'BIN' && run.port === 9020 ||
    run.type === 'goldhen-http' && action.platform === 'ps4' && format === 'BIN' && (!run.port || run.port === 9090);
  if (forRun && !supported)
    throw fail('unsupported-transport', 'No verified sender protocol is available for this action.');
  const downloadRoot = fs.realpathSync(path.join(root, 'downloads'));
  const candidate = path.resolve(root, '.' + decoded);
  const file = fs.realpathSync(candidate);
  if (!file.startsWith(downloadRoot + path.sep)) throw fail('invalid-file', 'The payload file must stay inside the download library.');
  const stat = fs.statSync(file);
  // The pinned PS4 9.00 runBinLoader maps exactly 0x300000 bytes. Its raw
  // receiver has no negotiated size or framing, so reject larger files locally.
  const limit = forRun && run.type === 'bin-tcp' ? 0x300000 : forRun ? MAX_FILE : 512 * 1024 * 1024;
  if (!stat.isFile() || stat.size <= 0 || stat.size > limit) throw fail('invalid-file-size', 'The payload file size is invalid.');
  return {file, bytes:stat.size, format};
}
function availability(action, root) {
  if (action.run?.input === 'user-file') {
    try { const item = userFileSpec(action); return {id:action.id,platform:action.platform,available:true,requiresFile:true,format:'BIN',bytes:item.bytes}; }
    catch (e) { return {id:action.id,platform:action.platform,available:false,reason:e.code || 'file-unavailable'}; }
  }
  try { const item = localFileFor(action, root); return {id:action.id,platform:action.platform,available:true,format:item.format,bytes:item.bytes}; }
  catch (e) { return {id:action.id,platform:action.platform,available:false,reason:e.code || 'file-unavailable'}; }
}
function userFileSpec(action) {
  const run = action.run || {};
  if (run.input !== 'user-file' || action.platform !== 'ps4' || action.format !== 'BIN' ||
      !/^[a-z0-9][a-z0-9._-]{0,127}$/i.test(action.id || '') ||
      !((run.type === 'goldhen-http' && run.port === 9090) || (run.type === 'bin-tcp' && run.port === 9020)))
    throw fail('unsupported-user-file', 'This action does not support a selected BIN file.');
  if (!Number.isSafeInteger(action.bytes) || action.bytes < 1 || action.bytes > 0x300000 || !/^[a-f0-9]{64}$/i.test(action.sha256 || ''))
    throw fail('invalid-user-file-pin', 'The selected-file action needs an exact bounded size and SHA-256.');
  if (!Array.isArray(action.firmwares) || !action.firmwares.length || action.firmwares.some(fw => typeof fw !== 'string' || !/^\d{1,2}\.\d{2}$/.test(fw)))
    throw fail('invalid-user-file-pin', 'The selected-file action needs an exact firmware whitelist.');
  return {bytes:action.bytes,sha256:action.sha256.toLowerCase()};
}
async function readVerifiedFile(action, root) {
  const item = localFileFor(action, root), data = await fsp.readFile(item.file);
  if (data.length !== item.bytes || data.length > MAX_FILE) throw fail('file-changed', 'The payload file changed while it was being read. Nothing was sent.');
  const digest = crypto.createHash('sha256').update(data).digest('hex');
  if (digest !== action.sha256.toLowerCase()) throw fail('checksum-mismatch', 'The payload checksum does not match the catalogue. Nothing was sent.');
  if (item.format === 'ELF' && (data.length < 64 || !data.subarray(0,4).equals(Buffer.from([0x7f,0x45,0x4c,0x46])))) throw fail('invalid-elf', 'The file does not contain an ELF executable. Nothing was sent.');
  if (action.run.type === 'bin-tcp' && data.subarray(0,4).equals(Buffer.from([0x7f,0x45,0x4c,0x46]))) throw fail('invalid-bin', 'The raw BIN loader does not accept an ELF executable. Nothing was sent.');
  return {data,sha256:digest};
}
// Documented netcat transport: raw ELF bytes followed by EOF on TCP 9021.
// A successful local write is a transfer result, not proof the payload executed.
function sendRawELF(address, data, {connect = net.createConnection, timeoutMs = 15000} = {}) {
  return sendRawPayload(address, data, 'ELF', 9021, {connect,timeoutMs});
}
// PSFree/Lapse runBinLoader (pinned PS4 9.00): one raw BIN stream followed by
// EOF on TCP 9020. Never probe first: a connection consumes the single listener.
function sendRawBIN(address, data, options = {}) {
  if (!data.length || data.length > 0x300000) return Promise.reject(fail('invalid-file-size', 'The payload file size is invalid.'));
  if (data.subarray(0,4).equals(Buffer.from([0x7f,0x45,0x4c,0x46]))) return Promise.reject(fail('invalid-bin', 'The raw BIN loader does not accept an ELF executable. Nothing was sent.'));
  return sendRawPayload(address, data, 'BIN', 9020, options);
}
function sendRawPayload(address, data, format, port, {connect = net.createConnection, timeoutMs = 15000} = {}) {
  return new Promise((resolve,reject) => {
    const socket = connect({host:address,port});
    let settled = false, bytesAttempted = false;
    const timer = setTimeout(() => done(fail('loader-timeout', 'The ' + format + ' transfer timed out. The console result is unknown.')), timeoutMs);
    function done(error) {
      if (settled) return; settled = true; clearTimeout(timer); socket.destroy();
      if (error) reject(bytesAttempted ? uncertainFailure(error) : error);
      else resolve({status:'sent',code:format.toLowerCase()+'-bytes-sent',message:format+' bytes sent to the console loader on port '+port+'. Check the console for the payload result.',bytes:data.length,port});
    }
    socket.once('error', () => done(fail('loader-connection-failed', 'Could not transfer the '+format+'. Start the compatible network '+format+' loader on port '+port+'.')));
    socket.once('connect', () => { bytesAttempted = true; try { socket.end(data); } catch (error) { done(error); } });
    socket.once('finish', () => done());
    socket.once('close', () => { if (!settled) done(fail('loader-disconnected', 'The loader disconnected before the transfer finished.')); });
  });
}
async function sendGoldHENHTTP(address, data, {fetcher = globalThis.fetch, timeoutMs = 15000} = {}) {
  async function send(route, method, body) {
    const controller = new AbortController();
    let response, timer, issued = false;
    try {
      response = await Promise.race([
        Promise.resolve().then(() => { issued = true; return fetcher('http://' + address + ':9090' + route, {method,body,redirect:'error',signal:controller.signal}); }),
        new Promise((resolve,reject) => { timer = setTimeout(() => { controller.abort(); reject(fail('loader-timeout','The GoldHEN request timed out.')); },timeoutMs); })
      ]);
    } catch (error) {
      const failure = error.code ? error : fail('loader-connection-failed','Could not read the GoldHEN HTTP loader response on port 9090.');
      throw method === 'POST' && issued ? uncertainFailure(failure) : failure;
    } finally { clearTimeout(timer); }
    if (!response || !response.ok) {
      const error = fail('loader-http-' + (response && response.status || 'unknown'), 'The GoldHEN loader rejected the request or returned an unreadable response.');
      throw method === 'POST' && (!response || response.status >= 500) ? uncertainFailure(error) : error;
    }
    return response;
  }
  const readiness = await send('/status','GET');
  let status, timer;
  try {
    status = await Promise.race([
      Promise.resolve().then(()=>readiness.json()),
      new Promise((resolve,reject)=>{ timer=setTimeout(()=>{ if(readiness.body&&readiness.body.cancel){try{Promise.resolve(readiness.body.cancel()).catch(()=>{});}catch(_){}} reject(fail('loader-timeout','The GoldHEN request timed out.')); },timeoutMs); })
    ]);
  } finally { clearTimeout(timer); }
  if (!status || status.status !== 'ready') throw fail('loader-busy', 'The GoldHEN HTTP loader is busy or not ready.');
  const response = await send('/','POST',data);
  if (response.status !== 200 && response.status !== 202) throw uncertainFailure(fail('loader-unacknowledged', 'The loader did not acknowledge the payload.'));
  return {status:'accepted',code:'goldhen-accepted',message:'GoldHEN accepted the payload bytes. Check the game or console for the result.',bytes:data.length,port:9090};
}
// Fixed read-only routes, never a URL proxy, write API or TCP/ELF probe.
// Source routes: cy33hc/ps4-ezremote-client and ps5-ezremote-client READMEs;
// ps5-payload-dev/websrv v0.34 README; local console-receiver.js states().
async function inspectConsoleServices(address, platform, {fetcher = globalThis.fetch, timeoutMs = 4000} = {}) {
  if (!isPrivateIPv4(address)) throw fail('console-lan-address-required','Use the checked console LAN IPv4 address.');
  if (!['ps4','ps5'].includes(platform)) throw fail('invalid-platform','Choose PS4 or PS5.');
  const service = platform === 'ps4' ? 'goldhen' : 'payload-manager';
  const corePort = platform === 'ps4' ? 9090 : 8084;
  async function read(port, route, limit = 2048) {
    const controller = new AbortController();
    let response, timer, activeReader;
    try {
      return await Promise.race([
        (async () => {
          // No Origin/Referer, credentials, request body or redirects.
          response = await fetcher('http://' + address + ':' + port + route,{method:'GET',credentials:'omit',redirect:'error',signal:controller.signal});
          if (!response || response.type === 'opaque' || !response.ok || response.status && response.status !== 200) {
            const error = fail('service-http-error','The console service rejected its read-only request.');
            error.httpStatus = response && response.status;
            throw error;
          }
          const length = response.headers && response.headers.get('content-length');
          if (length !== null && length !== undefined && (!/^\d+$/.test(length) || Number(length) > limit)) {
            if (response.body && response.body.cancel) Promise.resolve(response.body.cancel()).catch(()=>{});
            throw fail('unexpected-response','The console service response exceeded its metadata limit.');
          }
          let text;
          if (response.body && typeof response.body.getReader === 'function') {
            const reader = activeReader = response.body.getReader(), chunks = []; let size = 0;
            try {
              while (true) {
                const item = await reader.read();
                if (item.done) break;
                size += item.value.byteLength;
                if (size > limit) { Promise.resolve(reader.cancel()).catch(()=>{}); throw fail('unexpected-response','The console service response exceeded its metadata limit.'); }
                chunks.push(Buffer.from(item.value));
              }
              text = Buffer.concat(chunks).toString('utf8').trim();
            } finally { try { reader.releaseLock(); } catch (_) {} }
          } else {
            // Native fetch streams. A non-streaming implementation must provide
            // a bounded length before we buffer its response.
            if (length === null || length === undefined) throw fail('unexpected-response','The console service response length could not be bounded.');
            text = String(await response.text());
            if (Buffer.byteLength(text) > limit) throw fail('unexpected-response','The console service response exceeded its metadata limit.');
            text = text.trim();
          }
          return {text,contentType:response.headers && response.headers.get('content-type') || ''};
        })(),
        new Promise((resolve,reject) => { timer = setTimeout(() => { controller.abort(); if (activeReader) Promise.resolve(activeReader.cancel()).catch(()=>{}); reject(fail('service-timeout','The console service read timed out. Its availability is unknown.')); },timeoutMs); })
      ]);
    } catch (error) {
      if (error.code) throw error;
      throw fail('service-unavailable','The console service could not be read. It may be stopped, unreachable or blocked.');
    } finally { clearTimeout(timer); }
  }
  function probeFailure(error) {
    return [401,403,405,429].includes(error.httpStatus) ? 'blocked' : error.code === 'unexpected-response' || error.code === 'service-timeout' || !error.httpStatus ? 'unknown' : 'unavailable';
  }
  const common = {address,platform,service,reportedAddress:null,version:null};
  async function core() {
    try {
      if (platform === 'ps4') {
        let body;
        try { body = JSON.parse((await read(corePort,'/status')).text); } catch (error) { if (error.code) throw error; throw fail('unexpected-response','The service did not return GoldHEN readiness metadata.'); }
        if (!body || !['ready','busy'].includes(body.status)) throw fail('unexpected-response','The service did not return GoldHEN readiness metadata.');
        const result = {...common,status:'connected',connection:body.status,code:body.status === 'ready' ? 'goldhen-ready' : 'goldhen-busy',message:body.status === 'ready' ? 'GoldHEN HTTP loader responded and is ready. Firmware and game have not been detected.' : 'GoldHEN HTTP loader responded but is busy. Firmware and game have not been detected.'};
        return {result,check:{service,status:'connected',connection:body.status,code:result.code,port:corePort,path:'/status',message:result.message}};
      }
      const values = await Promise.all([read(corePort,'/version'),read(corePort,'/getip')]);
      const [version,reported] = values.map(value=>value.text);
      if (!/^\d+\.\d+\.\d+(?:[-+][a-z0-9.-]+)?$/i.test(version) || reported !== '0.0.0.0' && !isPrivateIPv4(reported)) throw fail('unexpected-response','The service did not return valid Payload Manager metadata.');
      const result = {...common,status:'connected',connection:'responding',code:'manager-connected',version,reportedAddress:reported === '0.0.0.0' ? null : reported,message:'Payload Manager ' + version + ' responded. This is the app version; firmware and game have not been detected.'};
      return {result,check:{service,status:'connected',connection:'responding',code:result.code,port:corePort,path:'/version',message:result.message}};
    } catch (error) {
      const result = {...common,status:'unavailable',connection:'unavailable',code:error.code || 'service-unavailable',message:error.message || 'The console service metadata could not be read. No firmware or game was detected.'};
      return {result,check:{service,status:probeFailure(error),code:result.code,port:corePort,path:platform === 'ps4' ? '/status' : '/version',message:result.message}};
    }
  }
  async function extra(definition) {
    const base = {service:definition.service,port:definition.port,path:definition.path};
    try {
      const response = await read(definition.port,definition.path,64 * 1024);
      if (definition.service === 'downloader') {
        let queue;
        try { queue = JSON.parse(response.text); } catch (_) { throw fail('unexpected-response','The receiver did not return a valid queue array.'); }
        if (!Array.isArray(queue) || queue.length > 4096 || queue.some(item=>!item || Array.isArray(item) || typeof item !== 'object' || typeof item.path !== 'string' || item.path[0] !== '/' || item.path.length > 4096 || /[\x00-\x1f\x7f]/.test(item.path))) throw fail('unexpected-response','The receiver did not return a valid queue array.');
        return {...base,status:'connected',code:'receiver-queue-readable',queueCount:queue.length,companionVerified:false,message:'Receiver queue responded. The installed downloader page and saving destination have not been verified.'};
      }
      if (response.contentType && !/^(?:text\/html|application\/xhtml\+xml)(?:;|$)/i.test(response.contentType) || !/<(?:!doctype\s+html|html|head|body|title)\b/i.test(response.text)) throw fail('unexpected-response','The configured file-manager endpoint did not return a recognizable HTML page.');
      return {...base,status:'connected',code:'file-page-responded',identityVerified:false,message:'The configured file-manager page responded. Its identity and file operations have not been verified.'};
    } catch (error) {
      return {...base,status:probeFailure(error),code:error.code || 'service-unavailable',message:error.message || 'The configured service could not be read; its availability is unknown.'};
    }
  }
  const definitions = [{service:'downloader',port:6701,path:'/get_download_state'},...(platform === 'ps4' ? [{service:'ps4-files',port:8080,path:'/'}] : [{service:'files',port:8888,path:'/'},{service:'ezremote',port:9090,path:'/'}])];
  const [main,...checks] = await Promise.all([core(),...definitions.map(extra)]);
  return {...main.result,checks:[main.check,...checks]};
}
function equalToken(expected, received) {
  if (typeof received !== 'string' || received.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}
function json(res, statusCode, value) {
  res.writeHead(statusCode, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});
  res.end(JSON.stringify(value));
}
function readJSON(req) {
  return new Promise((resolve,reject) => {
    let text = '', oversized = false;
    req.on('data',chunk => { if (oversized) return; if (Buffer.byteLength(text) + chunk.length > 4096) { oversized = true; reject(fail('body-too-large','The request is too large.')); } else text += chunk.toString('utf8'); });
    req.on('end',() => { if (oversized) return; try { const body = JSON.parse(text); if (!body || Array.isArray(body) || typeof body !== 'object') throw Error(); resolve(body); } catch (_) { reject(fail('invalid-json','Send a JSON action request.')); } });
    req.on('error',reject);
  });
}
function readSelectedBIN(req, expectedBytes, timeoutMs = 10000) {
  if(!Number.isSafeInteger(expectedBytes)||expectedBytes<1||expectedBytes>0x300000)return Promise.reject(fail('invalid-user-file-pin','The selected-file action needs an exact bounded size and SHA-256.'));
  return new Promise((resolve,reject) => {
    let size=0,settled=false; const chunks=[];
    const timer=setTimeout(()=>done(fail('selected-file-timeout','The selected BIN upload timed out. Nothing was sent to the console.')),timeoutMs);
    function done(error) {
      if(settled)return;settled=true;clearTimeout(timer);
      req.removeListener('data',data);req.removeListener('end',end);req.removeListener('aborted',aborted);req.removeListener('error',errorEvent);
      // IncomingMessage can emit error after aborted. Keep that late stream
      // error harmless after the upload has already failed or completed.
      req.once('error',()=>{});
      if(error){chunks.length=0;req.resume();reject(error);}else{const bytes=Buffer.concat(chunks,size);chunks.length=0;resolve(bytes);}
    }
    function data(chunk){size+=chunk.length;if(size>expectedBytes)return done(fail('selected-file-size','The selected BIN size does not match the catalogue. Nothing was sent to the console.'));chunks.push(chunk);}
    function end(){done(size===expectedBytes?null:fail('selected-file-size','The selected BIN size does not match the catalogue. Nothing was sent to the console.'));}
    function aborted(){done(fail('selected-file-interrupted','The selected BIN upload was interrupted. Nothing was sent to the console.'));}
    function errorEvent(){done(fail('selected-file-interrupted','The selected BIN upload was interrupted. Nothing was sent to the console.'));}
    req.on('data',data);req.once('end',end);req.once('aborted',aborted);req.once('error',errorEvent);
  });
}
function runActionFor(actions, body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(k => !['actionId','platform','address','firmware','gameVersion'].includes(k)))
    throw fail('unexpected-field','The request contains an unsupported field.');
  if (Object.values(body).some(value => typeof value !== 'string') || typeof body.actionId !== 'string' || typeof body.address !== 'string')
    throw fail('invalid-action','Send a listed action and selected versions.');
  normalizeAddress(body.address); // Syntax/private numeric scope, without DNS or a connection.
  const action=actions.find(a=>a.id===body.actionId&&a.platform===body.platform);
  if(!action)throw fail('unknown-action','Choose an action from this platform host catalogue.');
  if(!body.firmware || !require('../assets/host-dashboard.js').firmwareMatches(action,body.firmware))throw fail('firmware-mismatch','Select a firmware supported by this action.');
  const gameVersions=action.gameVersions&&action.gameVersions.length?action.gameVersions:action.gameVersion?[action.gameVersion]:[];
  if(gameVersions.length&&!gameVersions.includes(body.gameVersion))throw fail('game-version-mismatch','Select the exact game update supported by this menu.');
  return action;
}
function staticPath(requestURL) {
  const raw = requestURL.split('?')[0];
  let decoded;
  try { decoded = decodeURIComponent(raw); } catch (_) { return null; }
  if (!decoded.startsWith('/') || /[\x00-\x1f\\]/.test(decoded) || decoded.split('/').some(p => p === '..' || p === '.') || decoded.includes('//')) return null;
  let value = decoded;
  if (value === '/') value = '/hosts/';
  if (value.endsWith('/') && value.startsWith('/hosts/')) value += 'index.html';
  const allowed = /^\/hosts\/(?:ps[45]\/(?:(?:payload-manager|loaders|files|gta5|rdr2|other-games|cheats|lua|packages)\/)?)?index\.html$/.test(value) ||
    /^\/hosts\/tools\/(?:ps4-trainer|esp-flasher)\/(?:[a-z0-9_ .()+@/-]+\.(?:html|json|js|txt|md|svg))$/i.test(value) ||
    /^\/assets\/(?:images\/.+\.(?:png|jpe?g|svg|webp)|[a-z0-9._-]+\.(?:css|js))$/i.test(value) ||
    /^\/languages\/(?:i18n|[a-z-]+)\.js$/i.test(value) ||
    /^\/downloads\/helpers\/host-native-workspace\/(ps[45])\/[a-f0-9]{16}\/whatsite-workspace-\1\.html$/.test(value) ||
    /^\/downloads\/helpers\/host-package-installer\/(ps[45])\/[a-f0-9]{16}\/whatsite-package-installer-\1\.html$/.test(value) ||
    /^\/(?:script\.js|style\.css)$/.test(value) ||
    /^\/docs\/host-(?:actions-ps[45]|game-actions)\.json$/.test(value);
  return allowed ? value : null;
}
function createBridge({root = ROOT, actions = loadActions(root), token = crypto.randomBytes(32).toString('hex'), resolveAddress = resolveConsoleAddress, sendELF = sendRawELF, sendBIN = sendGoldHENHTTP, sendRawBIN: sendTCPBIN = sendRawBIN, inspectServices = inspectConsoleServices, userFileTimeoutMs = 10000} = {}) {
  if (!/^[a-f0-9]{64}$/i.test(token)) throw fail('invalid-token', 'The sender token must be 32 random bytes encoded as hexadecimal.');
  root = fs.realpathSync(root);
  const busy = new Set();
  const server = http.createServer(async (req,res) => {
    const port = server.address() && server.address().port;
    const host = req.headers.host;
    if (!['127.0.0.1:' + port,'localhost:' + port].includes(host)) return json(res,403,{status:'error',code:'host-rejected',message:'Use the localhost sender address.'});
    const origin = req.headers.origin, fetchSite = req.headers['sec-fetch-site'];
    if (origin && origin !== 'http://' + host || fetchSite === 'cross-site' || fetchSite === 'same-site' && origin && origin !== 'http://' + host)
      return json(res,403,{status:'error',code:'origin-rejected',message:'Open the sender dashboard on its own localhost address.'});
    if (req.url.startsWith('/api/')) {
      if (!equalToken(token,req.headers['x-whatsite-token'])) return json(res,401,{status:'error',code:'pairing-required',message:'Enter the current sender pairing token.'});
      if (req.method === 'GET' && req.url === '/api/status') return json(res,200,{status:'connected',code:'sender-ready',version:'1.0.0',protocolVersion:2,capabilities:{serviceOverview:true,uncertainOutcomes:true,userSelectedBIN:true},message:'Local sender connected. This check did not send a payload.',actions:actions.map(a => availability(a,root))});
      if (req.method === 'GET' && req.url === '/api/loader-status') return json(res,200,{status:'connected',ps4LoaderUpload:true,message:'PS4 loader sender connected.'});
      if (req.method === 'POST' && req.url === '/api/loader-file') {
        try { return json(res,200,await require('./ps4-loader-upload.cjs').receive(req,{busy,resolveAddress,sendELF,sendBIN,sendTCPBIN,timeoutMs:userFileTimeoutMs})); }
        catch(e){res.shouldKeepAlive=false;req.resume();return json(res,e.mayHaveExecuted?200:400,{status:e.mayHaveExecuted?'uncertain':'error',code:e.code||'loader-failed',message:e.message,...(e.mayHaveExecuted?{mayHaveExecuted:true}: {})});}
      }
      if (req.method === 'POST' && req.url === '/api/run-file') {
        let key,acquired=false;
        try {
          if(origin!=='http://'+host)throw fail('origin-rejected','Open the sender dashboard on its own localhost address.');
          if(!/^application\/octet-stream$/i.test(req.headers['content-type']||'') || req.headers['content-encoding'])throw fail('binary-body-required','Send only the selected uncompressed BIN bytes.');
          const header=req.headers['x-whatsite-run'];
          if(typeof header!=='string'||header.length>4096||/[^\x20-\x7e]/.test(header))throw fail('invalid-run-header','The selected BIN action metadata is invalid.');
          let body;try{body=JSON.parse(header);}catch(_){throw fail('invalid-run-header','The selected BIN action metadata is invalid.');}
          const action=runActionFor(actions,body),spec=userFileSpec(action);
          const length=req.headers['content-length'];
          if(length!==undefined&&(!/^(?:0|[1-9]\d*)$/.test(length)||Number(length)!==spec.bytes))throw fail('selected-file-size','The selected BIN size does not match the catalogue. Nothing was sent to the console.');
          const data=await readSelectedBIN(req,spec.bytes,userFileTimeoutMs);
          const digest=crypto.createHash('sha256').update(data).digest('hex');
          if(digest!==spec.sha256)throw fail('checksum-mismatch','The payload checksum does not match the catalogue. Nothing was sent.');
          if(data.subarray(0,4).equals(Buffer.from([0x7f,0x45,0x4c,0x46])))throw fail('invalid-bin','Select the original flat BIN, not an ELF executable. Nothing was sent.');
          const address=await resolveAddress(body.address);key=address;
          if(busy.has(key))throw fail('console-busy','Another payload transfer is still in progress for this console.');
          busy.add(key);acquired=true;
          const outcome=action.run.type==='bin-tcp'?await sendTCPBIN(address,data):await sendBIN(address,data);
          return json(res,200,{...outcome,actionId:action.id,platform:action.platform,address,sha256:digest});
        }catch(e){res.shouldKeepAlive=false;req.resume();return json(res,e.mayHaveExecuted?200:400,{status:e.mayHaveExecuted?'uncertain':'error',code:e.code||'sender-failed',message:e.code?e.message:'The sender could not complete the action. Nothing has been confirmed on the console.',...(e.mayHaveExecuted?{mayHaveExecuted:true,outcome:'unknown'}:{})});}
        finally{if(acquired)busy.delete(key);}
      }
      if (req.method !== 'POST' || !['/api/run','/api/inspect'].includes(req.url)) return json(res,405,{status:'error',code:'method-rejected',message:'Use an explicit POST action.'});
      if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) return json(res,415,{status:'error',code:'json-required',message:'The action request must use JSON.'});
      let key, acquired = false;
      try {
        const body = await readJSON(req);
        if (req.url === '/api/inspect') {
          if (Object.keys(body).some(k => !['address','platform'].includes(k))) throw fail('unexpected-field','The service check accepts only an address and platform.');
          if (!['ps4','ps5'].includes(body.platform)) throw fail('invalid-platform','Choose PS4 or PS5.');
          const address = await resolveAddress(body.address);
          return json(res,200,await inspectServices(address,body.platform));
        }
        const action = runActionFor(actions,body);
        if(action.run?.input==='user-file')throw fail('user-file-required','Select the exact downloaded BIN through the paired sender.');
        const address = await resolveAddress(body.address);
        key = address;
        if (busy.has(key)) throw fail('console-busy','Another payload transfer is still in progress for this console.');
        busy.add(key); acquired = true;
        const file = await readVerifiedFile(action,root);
        const outcome = action.run.type === 'bin-tcp' ? await sendTCPBIN(address,file.data) :
          action.run.type === 'elf-tcp' || action.run.type === 'elf-http' ? await sendELF(address,file.data) : await sendBIN(address,file.data);
        return json(res,200,{...outcome,actionId:action.id,platform:action.platform,address,sha256:file.sha256});
      } catch (e) { return json(res,e.mayHaveExecuted ? 200 : 400,{status:e.mayHaveExecuted ? 'uncertain' : 'error',code:e.code || 'sender-failed',message:e.code ? e.message : 'The sender could not complete the action. Nothing has been confirmed on the console.',...(e.mayHaveExecuted ? {mayHaveExecuted:true,outcome:'unknown'} : {})}); }
      finally { if (acquired) busy.delete(key); }
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return json(res,405,{status:'error',code:'read-only',message:'This path is read-only.'});
    const localDownload = actions.find(a => a.downloadURL && a.downloadURL === req.url.split('?')[0]);
    let file, extension;
    try {
      if (localDownload) { file = localFileFor(localDownload,root,{forRun:false}).file; extension = path.extname(file).toLowerCase(); }
      else {
        const pathname = staticPath(req.url);
        if (!pathname) throw Error();
        file = await fsp.realpath(path.join(root,pathname));
        if (!file.startsWith(root + path.sep)) throw Error();
        extension = path.extname(file).toLowerCase();
      }
      const stat = await fsp.stat(file);
      if (!stat.isFile()) throw Error();
      let body;
      if (extension === '.html' && file.startsWith(path.join(root,'hosts') + path.sep)) {
        let html = await fsp.readFile(file,'utf8');
        html = html.replace(/(<a\b[^>]*\bhref=")([^"#]+)(")/gi, (all, open, href, close) => {
          if (!href.startsWith('/') || href.startsWith('//')) return all;
          const pathname = href.split(/[?#]/)[0];
          if (staticPath(pathname) || actions.some(action => action.downloadURL === pathname)) return all;
          return open + 'https://speedy-away.github.io' + href + close;
        });
        const marker = '<meta name="whatwhatboy-local-sender" content="true">';
        body = Buffer.from(/<head\b[^>]*>/i.test(html) ? html.replace(/<head\b[^>]*>/i, value => value + marker) : marker + html);
      }
      res.writeHead(200,{'Content-Type':MIME[extension] || 'application/octet-stream','Content-Length':body ? body.length : stat.size,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});
      if (req.method === 'HEAD') return res.end();
      if (body) return res.end(body);
      fs.createReadStream(file).on('error',() => res.destroy()).pipe(res);
    } catch (_) { return json(res,404,{status:'error',code:'not-found',message:'This file is not served by the local sender.'}); }
  });
  server.requestTimeout = 20000;
  server.headersTimeout = 10000;
  return {server,token,actions};
}
function main(args = process.argv.slice(2)) {
  let port = 8766;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--port' && /^\d+$/.test(args[i + 1] || '')) port = Number(args[++i]);
    else throw fail('invalid-option','Usage: node scripts/console-payload-bridge.cjs [--port 8766]. The sender binds 127.0.0.1 only.');
  }
  if (port < 1 || port > 65535) throw fail('invalid-port','Choose a port between 1 and 65535.');
  const {server,token} = createBridge();
  server.once('error',e => { process.stderr.write('Sender could not start: ' + e.message + '\n'); process.exitCode = 1; });
  server.listen(port,'127.0.0.1',() => {
    process.stdout.write('Local console sender: http://127.0.0.1:' + port + '/hosts/\nPairing token (this session only): ' + token + '\nEnter the token in the local dashboard. No payload runs until you choose Run.\n');
  });
  return server;
}
if (require.main === module) { try { main(); } catch (e) { process.stderr.write(e.message + '\n'); process.exitCode = 1; } }
module.exports = {ROOT,loadActions,localFileFor,availability,userFileSpec,readSelectedBIN,readVerifiedFile,isPrivateIPv4,resolveConsoleAddress,sendRawELF,sendRawBIN,sendGoldHENHTTP,inspectConsoleServices,equalToken,staticPath,createBridge,main};
