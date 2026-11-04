(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.HostDashboard = api; api.install(document, root); }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function escape(value) { return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function firmwareNumber(value) { var m = /^(\d+)(?:\.(\d+))?/.exec(String(value)); if (!m) return null; var minor = (m[2] || '0').slice(0, 2); if (minor.length < 2) minor += '0'; return Number(m[1]) * 100 + Number(minor); }
  function firmwareMatches(action, firmware) {
    if (firmware && action.firmwareMax && firmwareNumber(firmware) > firmwareNumber(action.firmwareMax)) return false;
    if (!firmware || !action.firmwares || !action.firmwares.length) return true;
    var selected = firmwareNumber(firmware);
    if (selected === null) return false;
    return action.firmwares.some(function (rule) {
      var range = String(rule).match(/^(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)/);
      if (range) return selected >= firmwareNumber(range[1]) && selected <= firmwareNumber(range[2]);
      return firmwareNumber(rule) === selected;
    });
  }
  function browserFirmware(ua, platform) {
    var pattern = platform === 'ps4' ? /PlayStation\s*4[ /]+(\d+\.\d+)/i : /PlayStation\s*5[ /]+(\d+\.\d+)/i;
    var match = pattern.exec(ua || '');
    if (!match) return '';
    var parts = match[1].split('.'); return Number(parts[0]) + '.' + (parts[1] + '0').slice(0, 2);
  }
  function detectBrowser(ua) {
    ua = String(ua || '');
    var platform = /PlayStation\s*5\b/i.test(ua) ? 'ps5' : /PlayStation\s*4\b/i.test(ua) ? 'ps4' : '';
    return {platform: platform, firmware: platform ? browserFirmware(ua, platform) : '',
      device: platform ? platform.toUpperCase() : /Android|iPhone|iPad|Mobile/i.test(ua) ? 'Phone / tablet' : 'Computer / other browser',
      source: platform ? 'Console browser' : 'No console browser detected'};
  }
  function compareGameVersions(a, b) {
    var av = String(a.gameVersion || '').split('.').map(Number), bv = String(b.gameVersion || '').split('.').map(Number);
    for (var i = 0; i < Math.max(av.length, bv.length); i++) { var diff = (bv[i] || 0) - (av[i] || 0); if (diff) return diff; }
    return String(a.label || '').localeCompare(String(b.label || ''));
  }
  function firmwareLabel(action) {
    var versions = action.firmwares || [];
    if (!versions.length) return 'See requirements';
    if (versions.length <= 3) return versions.join(', ');
    return versions[0] + ' … ' + versions[versions.length - 1] + ' (' + versions.length + ' listed versions)';
  }
  function requiresFirmware(action) { return Boolean(action.run) || action.browserHost || action.category === 'loaders' && Boolean(action.launchURL); }
  function availableBrowserFirmwares(actions) {
    var versions=[];
    (actions||[]).forEach(function(action){if(action.category!=='loaders'||(!action.browserHost&&!action.localLauncher)||!action.launchURL)return;(action.firmwares||[]).forEach(function(fw){if(/^\d{1,2}\.\d{2}$/.test(fw)&&versions.indexOf(fw)===-1)versions.push(fw);});});
    return versions.sort(function(a,b){return Number(a)-Number(b);});
  }
  function consoleDownloadURL(platform, address, fileId, normalize) {
    if (platform !== 'ps4' && platform !== 'ps5') throw Error('Choose PS4 or PS5.');
    if (!/^[a-z0-9][a-z0-9._-]{0,159}$/i.test(fileId || '')) throw Error('Choose a file from the console catalogue.');
    return 'http://' + normalize(address) + ':6701/' + (platform === 'ps4' ? 'data/' : '') + 'whatsite-' + platform + '.html?file=' + encodeURIComponent(fileId);
  }
  function targetAddress(value, platform, detected, normalize) {
    var address = normalize(value);
    if ((address === 'localhost' || /^127\./.test(address)) && detected.platform !== platform) throw Error('Enter the ' + platform.toUpperCase() + ' LAN address when using a PC, phone or another console.');
    return address;
  }
  function managerURL(address, route, normalize) {
    if (['','autoload','storage','sources','processes','settings'].indexOf(route) < 0) throw Error('Choose a supported Payload Manager screen.');
    return 'http://' + normalize(address) + ':8084/#/' + route;
  }
  function workspaceURL(platform,address,view,normalize) {
    if (['files','payloads','autoload'].indexOf(view) < 0 || ['ps4','ps5'].indexOf(platform) < 0) throw Error('Choose a supported console workspace.');
    return 'http://' + normalize(address) + (platform === 'ps4' ? ':8080/data/' : ':9090/data/homebrew/ezremote-client/assets/') + 'whatsite-workspace-' + platform + '.html?view=' + view;
  }
  function actionImage(action) {
    var value = String(action.image || '');
    return /^\/(?:WWB-HOST\/)?assets\/images\/[a-z0-9._/ -]+\.(?:png|jpe?g|webp|svg)$/i.test(value) && value.indexOf('..') < 0 ? value : '';
  }
  function menuFamily(action) {
    return String(action.menuFamily || action.family || action.label || '').replace(/\s+v?\d+(?:\.\d+)+$/i, '').trim();
  }
  function versionOrder(a, b) {
    if (!a || !b) return a ? -1 : b ? 1 : 0;
    var av = String(a).replace(/^v/i, '').split('.').map(Number), bv = String(b).replace(/^v/i, '').split('.').map(Number);
    for (var i = 0; i < Math.max(av.length, bv.length); i++) { var difference = (bv[i] || 0) - (av[i] || 0); if (difference) return difference; }
    return 0;
  }
  function groupActions(actions) {
    var groups = [], byKey = Object.create(null);
    actions.forEach(function (action) {
      var goldhen=action.platform==='ps4'&&action.category==='goldhen';
      var family = goldhen?'GoldHEN':action.category === 'mods' && action.game ? menuFamily(action) : action.label;
      var key = goldhen?'goldhen|ps4':action.category === 'mods' && action.game ? [action.platform,action.game,family].join('|').toLowerCase() : 'action|' + action.id;
      if (!byKey[key]) { byKey[key] = {id:'host-group-' + groups.length,label:action.resourceType === 'cheat-definitions' ? action.label : family,game:action.game,platform:action.platform,actions:[]}; groups.push(byKey[key]); }
      if(goldhen)byKey[key].firmwarePicker=true;
      byKey[key].actions.push(action);
    });
    groups.forEach(function (group) { group.actions.sort(function (a,b) { return versionOrder(a.gameVersion,b.gameVersion) || versionOrder(a.menuVersion,b.menuVersion) || String(a.id).localeCompare(String(b.id)); }); });
    return groups;
  }
  function variantLabel(action) {
    return ['Game update: ' + (action.gameVersion || 'Not provided'), (action.resourceType === 'cheat-definitions' ? 'Trainer version: ' : 'Menu version: ') + (action.menuVersion || 'Not provided'), String(action.format || '').toUpperCase(), action.variantLabel || action.hostVariant, (action.titleIds || []).join(', ')].filter(Boolean).join(' · ');
  }
  function imageCaption(action) {
    return /menu cover/i.test(action.imageRole || '') ? 'Menu cover' : /game artwork/i.test(action.imageRole || '') || /^(?:MC4|JSON|SHN|XML)$/i.test(action.format || '') ? 'Game artwork' : action.game ? 'Menu preview' : 'Project preview';
  }
  function scopeActions(actions, scope) {
    if (!scope) return actions;
    return actions.filter(function (action) {
      if (action.category !== 'mods') return true;
      var game = String(action.game || '');
      var gta = /^(?:GTA\s*(?:V|5)|Grand Theft Auto\s*(?:V|5))$/i.test(game);
      var rdr = /^(?:RDR\s*2|Red Dead Redemption\s*2)$/i.test(game);
      return scope === 'gta5' ? gta : scope === 'rdr2' ? rdr : scope === 'other-games' ? !gta && !rdr : false;
    });
  }
  function loadCapability(action) {
    var type = action.run && action.run.type, format = String(action.format || '').toUpperCase();
    if (['goldhen-http','elf-http','elf-tcp','ps5-manager'].indexOf(type) !== -1 || type === 'bin-tcp' && action.platform === 'ps4' && format === 'BIN' && action.run.port === 9020) return {available:true,kind:'payload',reason:''};
    if (action.browserHost || action.runtimeId && /^\/hosts\/runtime\//.test(action.launchURL || '')) return {available:true,kind:'browser',reason:action.browserLoadMessage || 'Open this host on the matching console to use its built-in browser loader.'};
    if (/^(PRX|SPRX)$/.test(format)) return {available:false,kind:'plugin',reason:'This plugin loads through the console’s native plugin manager. Web loading is not available for this build.'};
    if (/^(JSON|MC4|SHN|XML)$/.test(format)) return {available:false,kind:'data',reason:'Install this file in the native cheat or patch manager, then enable it in the game.'};
    return {available:false,kind:'unsupported',reason:'No verified built-in loading method is available for this build. Setup and original sources are under Requirements.'};
  }
  function bridgeFileReady(action, bridge, platform) {
    if (!action || !action.run || action.run.input !== 'user-file' || action.platform !== platform || platform !== 'ps4' || action.format !== 'BIN') return false;
    if (!(action.run.type === 'goldhen-http' && action.run.port === 9090 || action.run.type === 'bin-tcp' && action.run.port === 9020)) return false;
    return Boolean(bridge && bridge.status === 'connected' && bridge.capabilities && bridge.capabilities.userSelectedBIN === true && bridge.actions && bridge.actions.some(function (item) {
      return item.id === action.id && item.platform === platform && item.available === true && item.requiresFile === true && item.format === 'BIN' && item.bytes === action.bytes;
    }));
  }
  function payloadFileFacts(action) {
    if (!action || !action.run || action.run.input !== 'user-file' || action.format !== 'BIN' || typeof action.bytes !== 'number' || !isFinite(action.bytes) || Math.floor(action.bytes) !== action.bytes || action.bytes < 1 || action.bytes > 0x300000 || !/^[a-f0-9]{64}$/i.test(action.sha256 || '')) return null;
    try {
      var url = new URL(action.downloadURL);
      if (url.protocol !== 'https:' || url.username || url.password) return null;
      var name = decodeURIComponent(url.pathname.slice(url.pathname.lastIndexOf('/') + 1));
      if (!/\.bin$/i.test(name) || /[\\/\x00-\x1f]/.test(name)) return null;
      return {filename:name,bytes:action.bytes,sha256:action.sha256.toLowerCase()};
    } catch (_) { return null; }
  }
  function choosePayloadFile(doc, win, action) {
    return new Promise(function (resolve, reject) {
      var input = doc.createElement('input'), settled = false, timer;
      input.setAttribute('type','file'); input.setAttribute('accept','.bin'); input.hidden = true;
      var schedule = win.setTimeout || setTimeout, unschedule = win.clearTimeout || clearTimeout;
      function finish(file, error) {
        if (settled) return; settled = true;
        if (timer) unschedule(timer);
        if (win.removeEventListener) win.removeEventListener('focus', focused);
        if (input.parentNode) input.parentNode.removeChild(input);
        if (error) reject(error); else resolve(file);
      }
      function changed() {
        var files = input.files;
        if (!files || !files.length) { finish(null); return; }
        if (files.length !== 1 || !/\.bin$/i.test(files[0].name || '') || files[0].size !== action.bytes) { finish(null, new Error('Choose the original BIN with the exact listed file size. Nothing was sent.')); return; }
        finish(files[0]);
      }
      function focused() { timer = schedule(changed,250); }
      input.addEventListener('change',changed); input.addEventListener('cancel',function () { finish(null); });
      if (win.addEventListener) win.addEventListener('focus',focused);
      doc.body.appendChild(input);
      // Stay inside the explicit Load gesture; no asynchronous preflight first.
      try { input.click(); } catch (error) { finish(null,error); }
    });
  }
  function downloadPlan(action, platform, address, detected, normalize) {
    if (!action.downloadURL) throw Error('This entry does not provide a downloadable file.');
    if(action.downloadOnDevice)return {destination:'device',address:'',url:action.downloadURL};
    if (String(address || '').trim() || detected.platform === platform) {
      var target = targetAddress(address || '127.0.0.1',platform,detected,normalize);
      if (!action.consoleFileId) throw Error('Update the console downloader catalogue before saving this file to the console.');
      return {destination:'console',address:target,url:consoleDownloadURL(platform,target,action.consoleFileId,normalize)};
    }
    return {destination:'device',address:'',url:action.downloadURL};
  }
  function connectionState() {
    var generation = 0, warnings = Object.create(null);
    return {
      invalidate:function () { generation++; },
      beginCheck:function (address) { return {generation:++generation,address:address}; },
      accepts:function (ticket,address) { return ticket.generation === generation && ticket.address === address; },
      warning:function (address) { return warnings[address] || null; },
      markUncertain:function (address,actionId) { warnings[address] = {actionId:actionId,at:Date.now()}; },
      clearWarning:function (address) { delete warnings[address]; },
      serialize:function () { return warnings; },
      restore:function (value,normalize) {
        warnings = Object.create(null);
        Object.keys(value || {}).slice(0,32).forEach(function (address) {
          try {
            var item = value[address];
            if (normalize(address) !== address || !item || !/^[a-z0-9][a-z0-9._-]{0,127}$/i.test(item.actionId || '') || !isFinite(item.at)) return;
            warnings[address] = {actionId:item.actionId,at:Number(item.at)};
          } catch (_) {}
        });
      }
    };
  }
  function filterActions(actions, category, firmware, query, game, showLegacy) {
    var words = String(query || '').toLowerCase().trim().split(/\s+/).filter(Boolean);
    return actions.filter(function (action) {
      if (!(showLegacy || !action.legacy) || !(category === 'all' || action.category === category || (action.categories || []).indexOf(category) !== -1) || game && action.game !== game || (!action.localLauncher || action.nativeRoute) && !firmwareMatches(action, firmware)) return false;
      if (!words.length) return true;
      var text = [action.label, action.menuFamily, action.game, action.gameVersion, action.menuVersion, action.version, action.format, (action.titleIds || []).join(' '), (action.tags || []).join(' '), (action.requirements || []).join(' ')].join(' ').toLowerCase();
      return words.every(function (word) { return text.indexOf(word) !== -1; });
    }).sort(function (a, b) { return a.game && b.game && a.game === b.game ? compareGameVersions(a, b) : 0; });
  }
  function safeURL(value, base) {
    if (!value || !String(value).trim()) return '';
    try { var url = new URL(value, base); return /^https?:$/.test(url.protocol) && !url.username && !url.password ? url.href : ''; } catch (_) { return ''; }
  }
  function install(doc, win) {
    var chooser = doc.querySelector('#host-auto-detect');
    if (chooser) {
      var browser = detectBrowser(win.navigator.userAgent), detectedLink = doc.querySelector('#host-detected-link');
      chooser.textContent = browser.platform ? 'Detected console: ' + browser.device + (browser.firmware ? ' · Browser firmware: ' + browser.firmware : '') : 'Open this page in your console browser for automatic firmware detection.';
      if (browser.platform && detectedLink) { detectedLink.href = '/hosts/' + browser.platform + '/'; detectedLink.textContent = 'Open ' + browser.device + ' host'; detectedLink.hidden = false; }
    }
    var source = doc.querySelector('#host-actions-data'); if (!source) return;
    var catalog; try { catalog = JSON.parse(source.textContent); if(catalog.actionsKey){var shared=win.WWB_HOST_ACTION_DATA;if(!shared||shared.key!==catalog.actionsKey||!Array.isArray(shared.actions)){var unavailable=doc.querySelector('#host-status');if(unavailable){unavailable.textContent='The file catalogue could not load. Reload this page.';unavailable.hidden=false;unavailable.setAttribute('data-host-catalog-error','true');}return;}catalog.actions=shared.actions;}win.WWB_HOST_CATALOG=catalog; } catch (_) { return; }
    var actions = catalog.actions || [], platform = catalog.platform;
    var availableFirmwares=availableBrowserFirmwares(actions),restrictFirmware=platform==='ps5'&&Boolean(catalog.firmwareChoicesOnly);
    var fileListView=Boolean(catalog.fileListView);
    var gameScope = catalog.gameScope || '', gamesLanding = Boolean(catalog.gamesLanding)&&!fileListView;
    var client = win.HostConsoleClient, category = catalog.initialCategory || (catalog.managerView ? 'payloads' : 'mods'), bridge = null, loading = false, browserHandoff = false;
    var initialCategory = String(win.location.hash || '').replace(/^#/, '');
    if (['mods','payloads','loaders','tools','goldhen'].indexOf(initialCategory) !== -1) category = initialCategory;
    var firmware = doc.querySelector('#host-firmware'), search = doc.querySelector('#host-search'), game = doc.querySelector('#host-game'), legacy = doc.querySelector('#host-show-legacy');
    var firmwareSource = doc.querySelector('#host-firmware-source'), detection = detectBrowser(win.navigator.userAgent);
    var firmwareButtons = doc.querySelector('#host-firmware-buttons'), firmwareStatus = doc.querySelector('#host-firmware-status');
    var catalogGrid = Boolean(catalog.catalogGrid && win.HostCatalogGrid), catalogUI = win.HostCatalogGrid;
    var catalogGame = gameScope==='gta5'||gameScope==='rdr2'?gameScope:'', catalogUpdate = '';
    if(catalogGrid&&!gameScope){try{var requested=new URL(win.location.href).searchParams,requestedGame=requested.get('game'),requestedUpdate=requested.get('update');if(requestedGame&&catalogUI.gameGroups(actions).some(function(g){return g.key===requestedGame;})){catalogGame=requestedGame;var requestedActions=actions.filter(function(a){return catalogUI.gameKey(a.game)===catalogGame;});if(requestedUpdate&&catalogUI.updates(requestedActions).indexOf(requestedUpdate)!==-1)catalogUpdate=requestedUpdate;}}catch(_){}}
    var consoleBrowser=Boolean(detection.platform),pageSize=12,renderLimit=pageSize,renderKey='',moreButton=null,searchTimer=null,allGameGroups=null;
    var scopedCatalogue=scopeActions(actions,gameScope);

    function windowed(rows){if(moreButton){moreButton.hidden=rows.length<=renderLimit;moreButton.textContent='Show more ('+Math.min(rows.length,renderLimit)+' of '+rows.length+')';}return consoleBrowser?rows.slice(0,renderLimit):rows;}
    function catalogTile(options){if(consoleBrowser||category==='payloads')options.textOnly=true;return catalogUI.tileMarkup(options);}
    var address = doc.querySelector('#host-console-address'), status = doc.querySelector('#host-status');
    var grid = doc.querySelector('#host-action-grid'), count = doc.querySelector('#host-action-count');
    var lastGridMarkup=null,lastGridKey='',lastCountText=null,gridChanged=false,countChanged=false,catalogueStamp=null,lastChoiceStructure=null;
    function writeGrid(markup){
      if(markup===lastGridMarkup){lastGridKey=renderKey;return;}
      if(consoleBrowser&&renderKey===lastGridKey&&lastGridMarkup&&markup.indexOf(lastGridMarkup)===0&&grid.insertAdjacentHTML)grid.insertAdjacentHTML('beforeend',markup.slice(lastGridMarkup.length));
      else grid.innerHTML=markup;
      lastGridMarkup=markup;lastGridKey=renderKey;gridChanged=true;
    }
    function writeCount(value){value=String(value);if(value===lastCountText)return;lastCountText=value;count.textContent=value;countChanged=true;}
    if(consoleBrowser&&grid&&doc.createElement){moreButton=doc.createElement('button');moreButton.type='button';moreButton.id='host-show-more';moreButton.hidden=true;moreButton.addEventListener('click',function(){renderLimit+=pageSize;render();});if(grid.parentNode)grid.parentNode.appendChild(moreButton);}
    var overlay = doc.querySelector('#host-version-overlay'), versionChoices = doc.querySelector('#host-version-choices'), versionDetail = doc.querySelector('#host-version-detail');
    var renderedGroups = [], activeGroup = null, selectedActionId = '', returnFocus = null,goldhenFirmware='';
    if (overlay) doc.body.appendChild(overlay);
    var bridgeURL = doc.querySelector('#host-bridge-url'), token = doc.querySelector('#host-bridge-token');
    var storageKey = 'whatwhatboy.host.' + platform, connection = connectionState(), pairingGeneration = 0;
    function each(nodes, callback) { Array.prototype.forEach.call(nodes, callback); }
    function refresh(node) { if (win.__scoobyI18n && win.__scoobyI18n.refresh) win.__scoobyI18n.refresh(node); }
    function tell(message, error) { status.textContent = message; status.setAttribute('data-error', error ? 'true' : 'false'); refresh(status); var modalStatus = doc.querySelector('#host-version-status'); if (modalStatus && overlay && !overlay.hidden) { modalStatus.textContent += (modalStatus.textContent ? '\n' : '') + '[' + new Date().toLocaleTimeString() + '] ' + message; modalStatus.scrollTop = modalStatus.scrollHeight; modalStatus.setAttribute('data-error',error ? 'true' : 'false'); refresh(modalStatus); } }
    function currentAddress() {
      if (!client) throw Error('The console connection helper is unavailable. Reload this page.');
      return targetAddress(address.value, platform, detection, client.normalizeAddress);
    }
    function remember() { try { win.localStorage.setItem(storageKey, JSON.stringify({address: address.value, firmware: firmware.value,uncertainTransfers:connection.serialize()})); } catch (_) {} }
    function syncFirmwareButtons() {
      if (!firmwareButtons) return;
      if(restrictFirmware){
        if(firmware.value&&availableFirmwares.indexOf(firmware.value)===-1){firmware.value='';firmwareSource.textContent='Choose firmware with an available Load route';}
        availableFirmwares.forEach(function(version){if(!firmwareButtons.querySelector('[data-host-firmware="'+version+'"]')){var item=doc.createElement('button');item.type='button';item.setAttribute('data-host-firmware',version);item.setAttribute('translate','no');item.textContent=version;firmwareButtons.appendChild(item);}});
        each(firmwareButtons.querySelectorAll('[data-host-firmware]'),function(button){var unavailable=availableFirmwares.indexOf(button.getAttribute('data-host-firmware'))===-1;button.hidden=unavailable;button.disabled=unavailable;});
      }
      if (/^\d{1,2}\.\d{2}$/.test(firmware.value) && !firmwareButtons.querySelector('[data-host-firmware="' + firmware.value + '"]')) {
        var button = doc.createElement('button'); button.type = 'button'; button.setAttribute('data-host-firmware',firmware.value); button.setAttribute('translate','no'); button.textContent = firmware.value; firmwareButtons.appendChild(button);
      }
      each(firmwareButtons.querySelectorAll('[data-host-firmware]'),function (button) { button.setAttribute('aria-pressed',button.getAttribute('data-host-firmware') === firmware.value ? 'true' : 'false'); });
      if (firmwareStatus) {
        firmwareStatus.textContent = restrictFirmware&&detection.platform===platform&&detection.firmware&&availableFirmwares.indexOf(detection.firmware)===-1 ? 'No Load route for browser firmware '+detection.firmware : detection.platform === platform && detection.firmware === firmware.value ? 'Browser firmware: ' + detection.firmware : firmware.value ? firmwareSource.textContent + ' · ' + firmware.value : restrictFirmware?'Choose firmware with an available Load route':'Browser firmware: not detected';
        refresh(firmwareStatus);
      }
    }
    function configuredAddress() { try { return currentAddress(); } catch (_) { return ''; } }
    function invalidateChecks() {
      connection.invalidate();
      doc.querySelector('#host-service-status').textContent = 'Service: not verified';
      var checks = doc.querySelector('#host-service-checks'); if (checks) { checks.hidden = true; checks.innerHTML = ''; }
      var checkButton = doc.querySelector('#host-check-services'); checkButton.disabled = false; checkButton.removeAttribute('aria-busy');
    }
    function actionById(id) { return actions.filter(function (a) { return a.id === id; })[0]; }
    function launchURL(action) {
      var raw = action.launchURL || '';
      if (raw.indexOf('{address}') !== -1) raw = raw.replace(/\{address\}/g, currentAddress());
      return navigationURL(raw);
    }
    function navigationURL(value) {
      var url = safeURL(value, win.location.href);
      if (url && doc.querySelector('meta[name="whatwhatboy-local-sender"]')) {
        var parsed = new URL(url);
        var publicMeta = doc.querySelector('meta[name="whatwhatboy-public-host"]'), publicOrigin = publicMeta && publicMeta.getAttribute('content');
        if (publicOrigin !== 'https://speedy-away.github.io' && publicOrigin !== 'https://speedy-away.github.io/wwb-host' && publicOrigin !== 'https://speedy-away.github.io/WWB-HOST' && publicOrigin !== 'https://whatwhatboy.com') publicOrigin = 'https://speedy-away.github.io';
        var localPage = /^\/hosts\/(?:ps[45]\/(?:(?:payload-manager|files|gta5|rdr2|other-games|cheats|lua|packages)\/)?)?(?:index\.html)?$/.test(parsed.pathname) || /^\/hosts\/tools\/(?:ps4-trainer|esp-flasher)\//.test(parsed.pathname);
        var localPayload = /^\/downloads\//.test(parsed.pathname) && actions.some(function (action) { return action.downloadURL === parsed.pathname; });
        if (parsed.origin === win.location.origin && !localPage && !localPayload) return publicOrigin + parsed.pathname + parsed.search + parsed.hash;
      }
      return url;
    }
    function requestDownload(action, event, plan) {
      if (!plan) plan = downloadPlan(action,platform,address.value,detection,client && client.normalizeAddress);
      if (plan.destination === 'console') {
        if (event) event.preventDefault();
        win.open(plan.url,'_blank','noopener');
        tell('Opening the console downloader. It must be installed and running; its native page checks the queue and destination before saving.');
      } else {
        if (!event) {
          var url = safeURL(plan.url,win.location.href); if (!url) throw Error('The file URL is invalid.');
          var anchor = doc.createElement('a'); anchor.href = url; anchor.setAttribute('download',''); anchor.setAttribute('data-no-file-options',''); anchor.hidden = true;
          doc.body.appendChild(anchor); anchor.click(); doc.body.removeChild(anchor);
        }
        tell('Download requested to this device.');
      }
      return plan;
    }
    function downloadLink(action,url,content){
      if(action.downloadOnDevice&&detection.platform===platform)return '<span class="host-load-note">Download on PC / mobile</span>';
      return '<a class="host-download" data-no-file-options data-download-action="'+escape(action.id)+'" href="'+escape(url)+'" download>'+content+'</a>';
    }
    function actionMarkup(action) {
        if(fileListView&&!activeGroup)return fileMarkup(action);
        var download = safeURL(action.downloadURL || '', win.location.href);
        var launch = Boolean(action.launchURL), capability = loadCapability(action);
        var needsFile = action.run && action.run.input === 'user-file';
        var canBridge = needsFile ? bridgeFileReady(action,bridge,platform) && client && typeof client.runFileViaBridge === 'function' : bridge && bridge.actions && bridge.actions.some(function (a) { return a.id === action.id && a.platform === platform && a.available; });
        var needsFirmware = requiresFirmware(action) && !firmware.value;
        var isMenu = action.category === 'mods';
        var label = isMenu || action.run || capability.kind === 'browser' ? 'Load' : launch ? (action.launchLabel || 'Open tool') : '';
        var requiresSender = action.run && (action.run.type === 'elf-tcp' || action.run.type === 'bin-tcp' || needsFile) && !canBridge;
        var uncertain = action.run && connection.warning(configuredAddress());
        var disabled = isMenu && !capability.available || needsFirmware || requiresSender || capability.kind === 'browser' && (detection.platform !== platform || !firmwareMatches(action,firmware.value)) || loading || action.browserHost && browserHandoff || uncertain;
        var meta = [action.format ? String(action.format).toUpperCase() : '', action.game ? '' : action.version, firmwareLabel(action)].filter(Boolean).join(' · ');
        var details = (action.requirements || []).map(function (text) { return '<li>' + escape(text) + '</li>'; }).join('');
        var facts = payloadFileFacts(action);
        var fileDetails = facts ? '<dl class="host-file-facts"><div><dt>File</dt><dd><code translate="no" data-i18n-skip>' + escape(facts.filename) + '</code></dd></div><div><dt>File size</dt><dd><code translate="no" data-i18n-skip>' + facts.bytes + ' B</code></dd></div><div><dt translate="no" data-i18n-skip>SHA-256</dt><dd><code translate="no" data-i18n-skip>' + facts.sha256 + '</code></dd></div></dl>' : '';
        var links = [['source','Project source'],['licenseURL','Licence'],['instructionsURL','Instructions'],['sourceArchiveURL','Corresponding source']].map(function (entry) { var url = navigationURL(action[entry[0]]); return url ? '<a href="' + escape(url) + '" target="_blank" rel="noopener noreferrer">' + entry[1] + '</a>' : ''; }).filter(Boolean).join(' · ');
        var originalHost = action.hostURL || action.launchURL || '';
        if (originalHost.indexOf('{address}') !== -1) originalHost = '';
        originalHost = navigationURL(originalHost);
        var artwork = consoleBrowser || category==='payloads' || action.category==='loaders' || action.category==='payloads' ? '' : catalogGrid ? catalogUI.representativeImage([action]) : isMenu ? actionImage(action) : '', imageLabel = imageCaption(action), releaseLabel = action.resourceType === 'cheat-definitions' ? 'Trainer version' : 'Menu version';
        return '<article class="host-action' + (artwork ? ' host-action-with-art' : '') + '">' + (artwork ? '<figure class="host-action-art"><img src="' + escape(artwork) + '" alt="' + escape(action.imageAlt || action.label + ' · ' + imageLabel) + '" loading="lazy"></figure>' : '') + '<div class="host-action-content"><div class="host-action-title"><h3>' + escape(action.label) + '</h3>' + (action.game ? '<span>' + escape(action.game) + '</span>' : '') + '</div>' + (action.game ? '<dl class="host-version-facts"><div><dt>Game update</dt><dd>' + escape(action.gameVersion || 'Not provided') + '</dd></div><div><dt>' + releaseLabel + '</dt><dd>' + escape(action.menuVersion || 'Not provided') + '</dd></div></dl>' : '') + '<p class="host-action-meta">' + escape(meta) + '</p>' + (action.variantLabel || action.hostVariant ? '<p class="host-action-meta">' + escape(action.variantLabel || action.hostVariant) + '</p>' : '') + (action.titleIds && action.titleIds.length ? '<p class="host-action-meta">' + escape(action.titleIds.join(', ')) + '</p>' : '') + (action.supportArchiveURL ? '<p class="host-file-note">Plugin update file. First installation also needs its support files.</p>' : '') + '<div class="host-action-buttons">' +
          (download ? downloadLink(action,download,'Download') : '') +
          (label ? '<button type="button" class="host-launch" data-launch="' + escape(action.id) + '"' + (disabled ? ' disabled title="' + escape(!capability.available && isMenu ? capability.reason : 'Choose compatible firmware and a running console loader.') + '"' : '') + '>' + escape(label) + '</button>' : '') + '</div>' +
          (download ? '<p class="host-download-destination">Download destination: ' + escape(!action.downloadOnDevice&&(String(address.value || '').trim() || detection.platform === platform) ? platform.toUpperCase() : 'This device') + '</p>' : '') +
          (isMenu && !capability.available ? '<p class="host-load-note">' + escape(capability.reason) + '</p>' : '') +
          '' +
          (requiresSender ? '<p class="host-load-note">' + (action.format === 'BIN' ? 'Connect the paired desktop sender to load this BIN.' : 'Connect the paired desktop sender to load this ELF.') + '</p>' : '') +
          (needsFile ? '<p class="host-load-note">Load uses the original downloaded BIN you choose. The sender verifies it in memory without saving a copy.</p>' : '') +
          (uncertain ? '<p class="host-load-note">A previous transfer has an unknown result. Check the console and clear its transfer warning before loading again.</p>' : '') +
          '<details><summary>Details</summary>' + fileDetails + '<ul>' + details + '</ul>' + (action.firmwares && action.firmwares.length ? '<p>Firmware: ' + escape(action.firmwares.join(', ')) + '</p>' : '') + (action.license ? '<p>' + escape(action.license) + '</p>' : '') + links + (action.supportArchiveURL ? ' · <a href="' + escape(navigationURL(action.supportArchiveURL)) + '">Full setup files</a>' : '') + (!action.run && originalHost ? ' · <a href="' + escape(originalHost) + '" target="_blank" rel="noopener noreferrer">Original host</a>' : '') + '</details></div></article>';
    }
    function showSupport(action){
      var overlay=doc.querySelector('#host-support-overlay');if(!overlay)return;
      var fw=action.firmwares&&action.firmwares.length?action.firmwares.join(', '):action.firmwareMax?'≤ '+action.firmwareMax:firmwareLabel(action);
      var fact=payloadFileFacts(action),evidence=fact?'\n'+fact.filename+' · '+fact.bytes+' B\nSHA-256: '+fact.sha256:'';
      doc.querySelector('#host-support-text').textContent=platform.toUpperCase()+' · '+fw+'\n'+(action.requirements||[]).join('\n')+evidence;
      var filenameNode=doc.querySelector('#host-support-filename'),factsNode=doc.querySelector('#host-support-facts'),linksNode=doc.querySelector('#host-support-links');
      if(filenameNode)filenameNode.textContent=fact?fact.filename:action.downloadURL?decodeURIComponent(action.downloadURL.split('/').pop().split('?')[0]):action.label;
      if(factsNode)factsNode.textContent=[action.format,Number.isSafeInteger(action.bytes)?action.bytes.toLocaleString()+' B':'',action.game,action.gameVersion].filter(Boolean).join(' · ');
      if(linksNode)linksNode.innerHTML=[['source','Project source'],['licenseURL','Licence'],['instructionsURL','Instructions'],['sourceArchiveURL','Corresponding source']].map(function(entry){var link=navigationURL(action[entry[0]]);return link?'<a href="'+escape(link)+'" target="_blank" rel="noopener noreferrer">'+entry[1]+' <span aria-hidden="true">↗</span></a>':'';}).join('');
      var previousFocus=doc.activeElement;
      overlay.hidden=false;var close=doc.querySelector('#host-support-close');close.onclick=function(){overlay.hidden=true;if(previousFocus&&previousFocus.focus)previousFocus.focus();};close.focus();
      overlay.onkeydown=function(event){
        if(event.key==='Escape'){close.onclick();return;}
        if(event.key==='Tab'){
          var focusable=[close].concat(linksNode?Array.prototype.slice.call(linksNode.querySelectorAll('a[href]')):[]),last=focusable[focusable.length-1];
          if(event.shiftKey&&doc.activeElement===close){event.preventDefault();last.focus();}
          else if(!event.shiftKey&&doc.activeElement===last){event.preventDefault();close.focus();}
        }
      };
      overlay.onclick=function(event){if(event.target===overlay)close.onclick();};
    }
    function fileMarkup(action){
      var capability=loadCapability(action),facts=payloadFileFacts(action),url=safeURL(action.downloadURL||'',win.location.href);
      var filename=facts?facts.filename:action.downloadURL?decodeURIComponent(action.downloadURL.split('/').pop().split('?')[0]):action.label;
      var title=category==='loaders'?platform.toUpperCase()+' '+(firmware.value||''):filename;
      var canBridge=bridge&&bridge.actions&&bridge.actions.some(function(a){return a.id===action.id&&a.platform===platform&&a.available;});
      var requiresSender=action.run&&(action.run.type==='elf-tcp'||action.run.type==='bin-tcp'||action.run.input==='user-file')&&!canBridge;
      var disabled=loading||requiresFirmware(action)&&!firmware.value||requiresSender||action.category==='mods'&&!capability.available||capability.kind==='browser'&&detection.platform!==platform||action.run&&connection.warning(configuredAddress());
      var reason=requiresSender?'Connect the paired desktop sender to load this file.':requiresFirmware(action)&&!firmware.value?'Choose your installed firmware first.':capability.kind==='browser'&&detection.platform!==platform?capability.reason:action.category==='mods'&&!capability.available?capability.reason:loading?'Loading…':'Check the console and its running loader before trying again.';
      var pins=(action.firmwares||[]),restriction=pins.length?pins.join(', '):action.firmwareMax?'≤ '+action.firmwareMax:'';
      var fileBytes=facts?facts.bytes:action.bytes,size='—';
      if(Number.isSafeInteger(fileBytes)){var divisor=fileBytes>=1048576?1048576:fileBytes>=1024?1024:1,unit=divisor===1048576?'MiB':divisor===1024?'KiB':'B',value=fileBytes/divisor;size=(divisor===1?String(value):value.toFixed(value<10?1:0))+' '+unit;}
      var format=/browser|html/i.test(action.format||'')?'HTML':action.format||'—';
      var subtitle=[action.game,action.label,action.gameVersion,action.menuVersion].filter(Boolean).join(' · ');
      if(subtitle===title||category==='loaders')subtitle='';
      var icon='<svg class="host-file-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M6 3h8l4 4v14H6zM14 3v5h4M9 12h6m-6 4h6"/></svg>';
      var arrow='<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 3v9m-3-3 3 3 3-3M4 13v4h12v-4"/></svg>';
      var play='<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" aria-hidden="true"><path d="m7 4 9 6-9 6z"/></svg>';
      var info='<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" aria-hidden="true"><circle cx="10" cy="10" r="7"/><path d="M10 9v5m0-8v.1"/></svg>';
      return '<article class="host-action host-file-row"><div class="host-file-line"><div class="host-file-identity"><span class="host-file-glyph">'+icon+'</span><div><h3 translate="no">'+escape(title)+'</h3>'+(subtitle?'<small>'+escape(subtitle)+'</small>':'')+'</div></div><span class="host-file-type" translate="no">'+escape(format)+'</span><span class="host-file-size" translate="no" title="'+(Number.isSafeInteger(fileBytes)?fileBytes+' B':'')+'">'+size+'</span><div class="host-file-compat">'+(restriction?'<button type="button" class="host-support-check" data-support-action="'+escape(action.id)+'" title="'+escape(restriction)+'"><span translate="no">'+escape(pins.length>2?'…':restriction)+'</span></button>':'<span class="host-file-unspecified">—</span>')+'</div><div class="host-action-buttons">'+(url?downloadLink(action,url,arrow+'<span>Download</span>'):'')+(action.run||action.launchURL?'<button class="host-launch" type="button" data-launch="'+escape(action.id)+'"'+(disabled?' disabled title="'+escape(reason)+'"':'')+'>'+play+'<span>Load</span></button>':'')+'<button type="button" class="host-file-info" data-support-action="'+escape(action.id)+'" aria-label="Requirements" title="Requirements">'+info+'</button></div></div></article>';
    }
    function groupMarkup(group) {
      if (group.actions[0].category !== 'mods') return actionMarkup(group.actions[0]);
      var first = group.actions[0], artwork = actionImage(first), caption = imageCaption(first);
      var gameVersions = group.actions.map(function (a) { return a.gameVersion || 'Not provided'; }).filter(function (v,i,all) { return all.indexOf(v) === i; });
      var menuVersions = group.actions.map(function (a) { return a.menuVersion || 'Not provided'; }).filter(function (v,i,all) { return all.indexOf(v) === i; });
      var releaseLabel = first.resourceType === 'cheat-definitions' ? 'Trainer versions' : 'Menu versions';
      return '<article class="host-action host-menu-group">' + (artwork ? '<figure class="host-action-art"><img src="' + escape(artwork) + '" alt="' + escape(group.label + ' · ' + caption) + '" loading="lazy"></figure>' : '') + '<div class="host-action-content"><div class="host-action-title"><h3>' + escape(group.label) + '</h3><span>' + escape(group.game) + '</span></div><dl class="host-version-facts"><div><dt>Game updates</dt><dd>' + escape(gameVersions.join(', ')) + '</dd></div><div><dt>' + releaseLabel + '</dt><dd>' + escape(menuVersions.join(', ')) + '</dd></div></dl><p class="host-action-meta">' + group.actions.length + ' variants · ' + escape(group.platform.toUpperCase()) + '</p><button type="button" class="host-choose-version" data-choose-group="' + escape(group.id) + '">Choose version</button></div></article>';
    }
    function collectionMarkup(actions) {
      var collections = [['gta5','GTA 5','/assets/images/gta52.png'],['rdr2','RDR2','/assets/images/rdr2.png'],['other-games','Other games','/assets/images/custom-mod-art/mods-ps4-ps5.jpg']];
      return collections.map(function (collection) {
        var items = scopeActions(actions,collection[0]), groups = groupActions(items);
        return '<a class="host-action host-game-collection" href="/hosts/' + platform + '/?view=mods'+(collection[0]==='other-games'?'':'&amp;game='+collection[0])+'#actions"><figure class="host-action-art"><img src="' + collection[2] + '" alt="' + escape(collection[1]) + '" loading="lazy"></figure><div class="host-action-content"><h3>' + escape(collection[1]) + '</h3><p>' + groups.length + ' menus · ' + items.length + ' variants</p><span>Browse mods →</span></div></a>';
      }).join('');
    }
    function catalogMarkup(visible) {
      grid.classList.add('host-catalog-grid');grid.setAttribute('data-host-view',category);
      if(category==='loaders')grid.classList.add('host-catalog-grid--loaders');else grid.classList.remove('host-catalog-grid--loaders');
      var allGames=category==='mods'?(allGameGroups||(allGameGroups=catalogUI.gameGroups(scopedCatalogue.filter(function(a){return a.category==='mods';})))):[];
      if (!catalogGame && (gameScope==='gta5'||gameScope==='rdr2')) catalogGame=gameScope;
      var selected=allGames.filter(function(g){return g.key===catalogGame;})[0];
      grid.setAttribute('data-catalog-level',category==='mods'?(selected?(catalogUpdate?'menus':'updates'):'games'):'');
      if (category!=='mods') {
        renderedGroups=groupActions(visible);
        writeCount(renderedGroups.length);
        function catalogRow(group){var first=group.actions[0];if(group.firmwarePicker)return catalogTile({id:group.id,label:'GoldHEN',image:catalogUI.representativeImage(group.actions),detail:'Choose firmware · '+group.actions.length+' versions',attribute:'data-choose-group'});if(first.localLauncher&&!first.nativeRoute)return '<a class="host-firmware-family" href="'+escape(navigationURL(first.launchURL))+'"><strong>'+escape(first.firmwareLabel||group.label)+'</strong><span>Choose HEN / Load</span></a>';if(category==='loaders'&&first.browserHost)return catalogTile({id:first.id,label:'Load',image:'',textOnly:true,detail:group.label+(detection.platform!==platform?' · Open on '+platform.toUpperCase():''),attribute:'data-launch',disabled:browserHandoff||detection.platform!==platform||!firmware.value||!firmwareMatches(first,firmware.value)||Boolean(detection.firmware&&detection.firmware!==firmware.value)});return catalogTile({id:group.id,label:group.label,image:category==='loaders'||category==='payloads'?'':catalogUI.representativeImage(group.actions),detail:[first.format,category==='payloads'&& !/^v?\d+\.\d/i.test(first.version||'')?'':first.version||first.menuVersion||''].filter(Boolean).join(' · '),attribute:'data-choose-group'});}
        var shown=windowed(renderedGroups);if(category==='loaders'){var primary=shown.filter(function(g){return !g.actions[0].secondaryHost;}),other=shown.filter(function(g){return g.actions[0].secondaryHost;});return primary.map(catalogRow).join('')+(other.length?'<details class="host-other-hosts"><summary>Other hosts</summary><div class="host-catalog-grid">'+other.map(catalogRow).join('')+'</div></details>':'');}
        return shown.map(catalogRow).join('');
      }
      var groups=catalogUI.gameGroups(visible),path=selected?'<nav class="host-catalog-path" aria-label="Mods / Mod Menus">'+(gameScope?'<a href="/hosts/'+platform+'/?view=mods">Mods / Mod Menus</a>':'<button type="button" data-catalog-back="games">Mods / Mod Menus</button>')+'<span aria-hidden="true">/</span><button type="button" data-catalog-back="updates" translate="no">'+escape(selected.label)+'</button>'+(catalogUpdate?'<span aria-hidden="true">/</span><strong translate="no">'+escape(catalogUpdate==='unspecified'?'Not provided':catalogUpdate)+'</strong>':'')+'</nav>':'';
      if (!selected) {
        renderedGroups=[];writeCount(groups.length);
        return path+windowed(groups).map(function(group){var updates=catalogUI.updates(group.actions);return catalogTile({id:group.key,label:group.label,image:group.image,detail:updates.length+' update'+(updates.length===1?'':'s'),attribute:'data-catalog-game'});}).join('');
      }
      var gameActions=visible.filter(function(action){return catalogUI.gameKey(action.game)===selected.key;});
      if (!catalogUpdate) {
        var updates=catalogUI.updates(gameActions);renderedGroups=[];writeCount(updates.length);
        return path+windowed(updates).map(function(update){return catalogTile({id:update,label:update==='unspecified'?'Not provided':update,textOnly:true,attribute:'data-catalog-update'});}).join('');
      }
      var exact=catalogUI.filterByGameUpdate(gameActions,selected.key,catalogUpdate);
      renderedGroups=groupActions(exact);writeCount(renderedGroups.length);
      return path+windowed(renderedGroups).map(function(group){return catalogTile({id:group.id,label:group.label,image:catalogUI.representativeImage(group.actions),detail:group.actions.map(function(a){return a.menuVersion||a.format;}).filter(function(v,i,all){return v&&all.indexOf(v)===i;}).join(' · '),attribute:'data-choose-group'});}).join('');
    }
    function writeChoices(markup){var structure=markup.replace(/aria-pressed="(?:true|false)"/g,'');if(structure===lastChoiceStructure)return false;lastChoiceStructure=structure;versionChoices.innerHTML=markup;return true;}
    function renderVersionChoices(group) {
      var rows=group.actions,prefix='';
      if(group.firmwarePicker){
        if(!goldhenFirmware){var choices=[];group.actions.forEach(function(action){var options=goldhenOptions(action);options.forEach(function(fw){if(choices.indexOf(fw)<0)choices.push(fw);});});choices.sort(function(a,b){return a==='requirements'?1:b==='requirements'?-1:firmwareNumber(a)-firmwareNumber(b);});return writeChoices(choices.map(function(fw){return '<button type="button" data-goldhen-firmware="'+escape(fw)+'"><strong>'+escape(fw==='requirements'?'See requirements':fw)+'</strong></button>';}).join(''));}
        rows=group.actions.filter(function(action){return goldhenOptions(action).indexOf(goldhenFirmware)>=0;});prefix='<button type="button" data-goldhen-back>← Change firmware · '+escape(goldhenFirmware==='requirements'?'See requirements':goldhenFirmware)+'</button>';
      }
      return writeChoices(prefix+rows.map(function (action) { return '<button type="button" data-version-id="' + escape(action.id) + '" aria-label="' + escape(action.game ? variantLabel(action) : action.label) + '" aria-pressed="' + (action.id === selectedActionId ? 'true' : 'false') + '">'+(action.game?'<span>Game update <strong>' + escape(action.gameVersion || 'Not provided') + '</strong></span><span>' + (action.resourceType === 'cheat-definitions' ? 'Trainer version' : 'Menu version') + ' <strong>' + escape(action.menuVersion || 'Not provided') + '</strong></span>':'<strong>'+escape(action.label)+'</strong>')+'<small>' + escape([String(action.format || '').toUpperCase(),action.variantLabel || action.hostVariant,(action.titleIds || []).join(', ')].filter(Boolean).join(' · ')) + '</small></button>'; }).join(''));
    }
    function goldhenOptions(action){var options=(action.firmwareChoices||action.firmwares||[]).filter(function(fw){return /^\d{1,2}\.\d{2}$/.test(fw);});return options.length?options:['requirements'];}
    function renderVariant() {
      if(activeGroup&&activeGroup.firmwarePicker&&!goldhenFirmware){versionDetail.innerHTML='<p>Choose your PS4 firmware to view GoldHEN versions.</p>';return;}
      var action = activeGroup && activeGroup.actions.filter(function (a) { return a.id === selectedActionId; })[0];
      versionDetail.innerHTML = action ? actionMarkup(action) : '';
      each(versionChoices.querySelectorAll('[data-version-id]'),function (button) { button.setAttribute('aria-pressed',button.getAttribute('data-version-id') === selectedActionId ? 'true' : 'false'); });
      refresh(versionDetail);
    }
    function closeVersions() {
      if (!overlay || overlay.hidden) return;
      var groupId = activeGroup && activeGroup.id;
      overlay.hidden = true; doc.body.classList.remove('host-dialog-open'); activeGroup = null; selectedActionId = '';
      if (returnFocus && doc.documentElement.contains(returnFocus)) returnFocus.focus();
      else { var firstChoice = groupId && grid.querySelector('[data-choose-group="' + groupId + '"]') || grid.querySelector('[data-choose-group]'); if (firstChoice) firstChoice.focus(); }
    }
    function openVersions(group, trigger) {
      if (!group || !overlay) return;
      activeGroup = group; returnFocus = trigger;
      doc.querySelector('#host-version-title').textContent = group.label;
      doc.querySelector('#host-version-game').textContent = [group.game,platform.toUpperCase()].filter(Boolean).join(' · ');
      goldhenFirmware='';selectedActionId = group.firmwarePicker?'':group.actions[0].id;
      renderVersionChoices(group);
      doc.querySelector('#host-version-status').textContent = '';
      overlay.hidden = false; doc.body.classList.add('host-dialog-open'); renderVariant(); refresh(overlay); versionChoices.querySelector('button').focus();
    }
    function render() {
      gridChanged=false;countChanged=false;
      var query=search?search.value:'',selectedGame=game?game.value:'',includeLegacy=Boolean(legacy&&legacy.checked);
      var nextKey=[category,firmware.value,query,selectedGame,includeLegacy,catalogGame,catalogUpdate].join('|');if(nextKey!==renderKey){renderLimit=pageSize;renderKey=nextKey;}
      var firmwareNote = doc.querySelector('#host-firmware-note');
      if (firmwareNote) firmwareNote.hidden = firmware.value !== '14.00';
      if (grid) {
      var stamp=JSON.stringify([category,firmware.value,query,selectedGame,includeLegacy,catalogGame,catalogUpdate,renderLimit,detection.platform,detection.firmware,browserHandoff]),reuseCatalogue=catalogGrid&&stamp===catalogueStamp;
      if(!reuseCatalogue){
      if(moreButton)moreButton.hidden=true;
      var visible = filterActions(scopedCatalogue, category, (fileListView||catalogGrid)&&category!=='loaders'?'':firmware.value, query, category === 'mods' ? selectedGame : '', includeLegacy);
      if((fileListView||catalogGrid)&&category==='loaders'&&!firmware.value)visible=[];
      doc.querySelector('#host-game-filter').hidden = catalogGrid || category !== 'mods' || gamesLanding || gameScope === 'gta5' || gameScope === 'rdr2';
      if (category === 'mods' && gamesLanding) grid.classList.add('host-game-collections'); else grid.classList.remove('host-game-collections');
      renderedGroups = catalogGrid?[]:groupActions(visible);
      if(!catalogGrid&&!(category==='mods'&&gamesLanding))writeCount(fileListView?String(visible.length):renderedGroups.length + ' cards · ' + visible.length + ' variants');
      if (catalogGrid) {
        writeGrid(catalogMarkup(visible));
      } else if (category === 'mods' && gamesLanding) {
        writeCount('3 game pages');
        writeGrid(collectionMarkup(visible));
      } else if(fileListView){
        if(category==='loaders'&&visible.length){
          var preferred=visible.filter(function(a){return !!a.runtimeId;});if(!preferred.length)preferred=[visible[0]];
          var alternatives=visible.filter(function(a){return preferred.indexOf(a)===-1;});
          writeGrid(preferred.map(actionMarkup).join('')+(alternatives.length?'<details class="host-other-hosts"><summary>Other hosts</summary>'+alternatives.map(actionMarkup).join('')+'</details>':''));
        }else writeGrid(visible.map(actionMarkup).join(''));
      } else if (category === 'loaders') {
        var localGroups = [], otherGroups = [];
        renderedGroups.forEach(function (group) { (group.actions[0].runtimeId ? localGroups : otherGroups).push(group); });
        writeGrid(localGroups.map(groupMarkup).join('') + (otherGroups.length ? '<details class="host-other-hosts"><summary>Other hosts</summary><p>These links open the original external hosts and setup pages.</p><div class="host-action-grid">' + otherGroups.map(groupMarkup).join('') + '</div></details>' : ''));
      } else writeGrid(renderedGroups.map(groupMarkup).join(''));
      catalogueStamp=stamp;
      }
      if (activeGroup) {
        var selectedId = selectedActionId;
        var updated = renderedGroups.filter(function (g) { return activeGroup.firmwarePicker&&!selectedId?g.firmwarePicker:g.actions.some(function (a) { return a.id === selectedId; }); })[0];
        if (updated) { var focusedVersion=doc.activeElement&&doc.activeElement.getAttribute('data-version-id'); activeGroup = updated; var choicesChanged=renderVersionChoices(updated); renderVariant(); if(choicesChanged)refresh(versionChoices); if(focusedVersion){var replacement=versionChoices.querySelector('[data-version-id="'+focusedVersion+'"]');if(replacement)replacement.focus();} } else closeVersions();
      }
      if(!reuseCatalogue)doc.querySelector('#host-empty').hidden = catalogGrid ? Boolean(grid.querySelector('[data-catalog-game],[data-catalog-update],[data-choose-group],[data-launch],.host-firmware-family')) : visible.length !== 0 || category === 'mods' && gamesLanding;
      if(gridChanged)refresh(grid);if(countChanged)refresh(count);
      }
      var managerLoad = doc.querySelector('#host-load-manager'); if (managerLoad) managerLoad.disabled = loading || !firmware.value;
      var warning = connection.warning(configuredAddress()), recovery = doc.querySelector('#host-transfer-warning');
      if (recovery) {
        recovery.hidden = !warning;
        if (warning) {
          var uncertainAction = actionById(warning.actionId);
          doc.querySelector('#host-transfer-warning-target').textContent = platform.toUpperCase() + ' · ' + configuredAddress() + ' · ' + (uncertainAction ? uncertainAction.label : warning.actionId);
          if (managerLoad) managerLoad.disabled = true;
        }
      }
    }
    function service(name) {
      try { var selector = doc.querySelector('#host-file-service'); var selected = name === 'files' ? selector ? selector.value : platform === 'ps4' ? 'ps4-files' : 'files' : name; var destination = currentAddress(); var url = client.serviceURL(destination, selected); win.open(url, '_blank', 'noopener'); tell('Opening ' + platform.toUpperCase() + ' ' + (name === 'files' ? 'file manager' : name) + ' at ' + destination + '. Start the named console service first.'); }
      catch (error) { tell(error.message, true); }
    }
    function result(value) {
      tell(value.message || value.status || 'Request finished.', /error|blocked|unavailable|uncertain/.test(value.status || ''));
      var url = safeURL(value.launchURL, win.location.href);
      if (url && /^(?:blocked|error)$/.test(value.status || '')) { var link = doc.createElement('a'); link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = ' Send using console loader'; status.appendChild(link); refresh(status); }
    }
    function runAction(action) {
      if (!action || !action.run) return;
      if (requiresFirmware(action) && !firmware.value || !firmwareMatches(action,firmware.value)) { tell('Choose a payload matching the installed firmware.',true); return; }
      if (loading) { tell('A payload transfer is already in progress. Check its result before sending another.',true); return; }
      var destination; try { destination = currentAddress(); } catch (error) { tell(error.message, true); return; }
      if (connection.warning(destination)) { tell('A previous transfer has an unknown result. Check the console and clear its transfer warning before loading again.',true); return; }
      var needsFile = action.run.input === 'user-file';
      var bridgeAction = needsFile ? bridgeFileReady(action,bridge,platform) && client && typeof client.runFileViaBridge === 'function' : bridge && bridge.actions && bridge.actions.some(function (a) { return a.id === action.id && a.platform === platform && a.available; });
      if (needsFile && !bridgeAction) { tell('Update and connect the paired desktop sender before choosing a BIN.',true); return; }
      if (bridgeAction && (!bridge.capabilities || !bridge.capabilities.uncertainOutcomes)) { tell('Update the desktop sender before loading. This version cannot report uncertain transfer results.',true); return; }
      var confirmation = action.confirmBeforeLoad;
      if (confirmation && win.__scoobyI18n && win.__scoobyI18n.t) confirmation = win.__scoobyI18n.t(confirmation);
      if (confirmation && (!win.confirm || !win.confirm(confirmation))) { tell('Load cancelled. Nothing was sent.'); return; }
      var copyControl = doc.querySelector('#host-download-on-run'), copy = copyControl && copyControl.checked;
      if (needsFile && copy) { tell('Use Download separately for a console copy, then turn off Download a copy when pressing Load.',true); return; }
      if (copy && !needsFile) {
        try { requestDownload(action,null,downloadPlan(action,platform,destination,detection,client.normalizeAddress)); }
        catch (error) { tell(error.message,true); return; }
      }
      loading = true; render(); tell(needsFile ? 'Choose the original downloaded BIN. It must pass verification before transfer.' : 'Sending the selected payload to ' + platform.toUpperCase() + ' at ' + destination + '…');
      var request;
      try {
      if (needsFile) {
        var selected = {address:destination,firmware:firmware.value,token:token.value,url:bridgeURL.value,generation:pairingGeneration};
        var verifySelection = function () {
          if (currentAddress() !== selected.address || firmware.value !== selected.firmware || token.value !== selected.token || bridgeURL.value !== selected.url || pairingGeneration !== selected.generation || !bridgeFileReady(action,bridge,platform) || connection.warning(destination)) throw Error('The console or sender settings changed. Choose Load again after reviewing them. Nothing was sent.');
        };
        request = choosePayloadFile(doc,win,action).then(function (file) {
          if (!file) return {status:'cancelled',message:'Load cancelled. Nothing was sent.'};
          verifySelection();
          tell('Sending the selected payload to ' + platform.toUpperCase() + ' at ' + destination + '…');
          return client.runFileViaBridge(destination,action,file,selected.token,platform,{bridgeURL:selected.url,origin:win.location.origin,firmware:selected.firmware,gameVersion:action.gameVersion || '',beforeDispatch:verifySelection});
        });
      }
      else if (bridgeAction) request = client.runViaBridge(destination, action.id, token.value, platform, {bridgeURL: bridgeURL.value, origin: win.location.origin, firmware: firmware.value, gameVersion: action.gameVersion || ''});
      else if (action.run.type === 'goldhen-http') request = client.sendGoldHEN(destination, action, {origin: win.location.origin});
      else if (action.run.type === 'elf-http') request = client.sendPS5ELF(destination, action, {origin: win.location.origin});
      else if (action.run.type === 'ps5-manager') request = client.launchInstalled(destination, action.run.path, {origin: win.location.origin});
      else { loading = false; render(); tell('Connect the local sender to run this payload. You can download it now.', true); return; }
      } catch (error) { loading = false; render(); tell(error.message, true); return; }
      Promise.resolve(request).then(function (value) {
        if (value.status === 'uncertain' || value.mayHaveExecuted) { connection.markUncertain(destination,action.id); remember(); }
        loading = false; render();
        result(value);
      }).catch(function (error) { if (error.mayHaveExecuted) { connection.markUncertain(destination,action.id); remember(); } loading = false; render(); tell(error.message, true); });
    }
    function handleActionClick(event) {
      if (catalogGrid) {
        var tile=event.target;
        while(tile&&tile!==grid&&!tile.hasAttribute('data-catalog-game')&&!tile.hasAttribute('data-catalog-update')&&!tile.hasAttribute('data-catalog-back'))tile=tile.parentNode;
        if(tile&&tile!==grid){
          if(tile.hasAttribute('data-catalog-game')){catalogGame=tile.getAttribute('data-catalog-game');catalogUpdate='';}
          else if(tile.hasAttribute('data-catalog-update'))catalogUpdate=tile.getAttribute('data-catalog-update');
          else if(tile.getAttribute('data-catalog-back')==='games'){catalogGame='';catalogUpdate='';}
          else catalogUpdate='';
          if(!gameScope&&win.history&&typeof win.history.replaceState==='function'){try{var catalogueURL=new URL(win.location.href);catalogueURL.searchParams.set('view','mods');if(catalogGame)catalogueURL.searchParams.set('game',catalogGame);else catalogueURL.searchParams.delete('game');if(catalogUpdate)catalogueURL.searchParams.set('update',catalogUpdate);else catalogueURL.searchParams.delete('update');win.history.replaceState(null,'',catalogueURL.pathname+catalogueURL.search+catalogueURL.hash);}catch(_){}}
          closeVersions();render();var first=grid.querySelector('button');if(first)first.focus();return;
        }
      }
      var button = event.target;
      var container = event.currentTarget;
      while (button && button !== container && !button.hasAttribute('data-launch') && !button.hasAttribute('data-open-action') && !button.hasAttribute('data-download-action') && !button.hasAttribute('data-choose-group') && !button.hasAttribute('data-support-action')) button = button.parentNode;
      if (!button || button === container) return;
      if (button.hasAttribute('data-choose-group')) { openVersions(renderedGroups.filter(function (g) { return g.id === button.getAttribute('data-choose-group'); })[0],button); return; }
      var action = actionById(button.getAttribute('data-launch') || button.getAttribute('data-open-action') || button.getAttribute('data-download-action') || button.getAttribute('data-support-action')); if (!action) return;
      if(button.hasAttribute('data-support-action')){showSupport(action);return;}
      if (button.hasAttribute('data-download-action')) {
        try {
          if (!client && (String(address.value || '').trim() || detection.platform === platform)) throw Error('The console connection helper is unavailable. Reload this page.');
          requestDownload(action,event);
        } catch (error) { event.preventDefault(); tell(error.message,true); }
        return;
      }
      if (button.hasAttribute('data-open-action')) { try { win.open(launchURL(action), '_blank', 'noopener'); tell('Opening the installed service. Its availability has not been verified.'); } catch (error) { tell(error.message, true); } return; }
      if (requiresFirmware(action) && !firmware.value) { tell('Choose your installed firmware first.', true); return; }
      if (!firmwareMatches(action, firmware.value)) { if(fileListView)showSupport(action);tell('Choose a payload matching the installed firmware.', true); return; }
      if (action.run && (action.run.type === 'goldhen-http' || action.run.type === 'elf-http' || action.run.type === 'ps5-manager' || bridge)) { runAction(action); return; }
      if (action.run && (action.run.type === 'elf-tcp' || action.run.type === 'bin-tcp') && !action.launchURL) { doc.querySelector('.host-sender').open = true; tell(action.run.type === 'bin-tcp' ? 'Connect the paired desktop sender to load this BIN.' : 'Start the local sender, open its host page, and connect with the pairing token to run ELF files.'); return; }
      if (action.category === 'mods' && !loadCapability(action).available) { tell(loadCapability(action).reason,true); return; }
      if (loadCapability(action).kind === 'browser' && detection.platform !== platform) { tell(loadCapability(action).reason,true); return; }
      var url; try { url = launchURL(action); } catch (error) { tell(error.message, true); return; }
      if (url && action.browserHost) {
        if(browserHandoff||button.disabled)return;
        if(detection.firmware!==firmware.value){tell('Choose the firmware detected on this '+platform.toUpperCase()+'.',true);return;}
        if(event.isTrusted!==true){tell('Press Load in the console browser.',true);return;}
        browserHandoff=true;button.disabled=true;button.setAttribute('aria-busy','true');
        status.setAttribute('role','status');status.setAttribute('aria-live','polite');
        tell('Loading…');
        try {
          if(action.nativeRoute){if(!win.HostSiteLoad)throw Error('The local Load controller is unavailable. Reload this page.');url=win.HostSiteLoad.start(win,doc,action,true);}
          else if(action.platform==='ps5'&&action.runtimeId==='ps5-umtx'){var request=JSON.stringify({firmware:firmware.value,createdAt:Date.now()});win.sessionStorage.setItem('wwb.ps5.load.request.v1',request);if(win.sessionStorage.getItem('wwb.ps5.load.request.v1')!==request)throw Error('Browser session storage is unavailable. Nothing was started.');}
          win.location.href=url;
        } catch(error) {button.setAttribute('aria-busy','false');status.setAttribute('role','alert');tell(error.message,true);}
      }
      else if (url) { win.open(url, '_blank', 'noopener'); tell('Opening ' + action.label + '. Follow the loader status on that page.'); }
      else service('files');
    }
    if (grid) grid.addEventListener('click', handleActionClick);
    if (overlay) {
      versionDetail.addEventListener('click',handleActionClick);
      versionChoices.addEventListener('click',function (event) {
        var button = event.target;
        while (button && button !== versionChoices && !button.hasAttribute('data-version-id')&&!button.hasAttribute('data-goldhen-firmware')&&!button.hasAttribute('data-goldhen-back')) button = button.parentNode;
        if (!button || button === versionChoices) return;
        if(button.hasAttribute('data-goldhen-back')){goldhenFirmware='';selectedActionId='';renderVersionChoices(activeGroup);renderVariant();refresh(versionChoices);versionChoices.querySelector('button').focus();return;}
        if(button.hasAttribute('data-goldhen-firmware')){var chosen=button.getAttribute('data-goldhen-firmware'),matching=activeGroup.actions.filter(function(action){return goldhenOptions(action).indexOf(chosen)>=0;});if(!matching.length)return;goldhenFirmware=chosen;selectedActionId=matching[0].id;if(chosen!=='requirements'){firmware.value=chosen;firmwareSource.textContent='Firmware selection: manual';syncFirmwareButtons();remember();}doc.querySelector('#host-version-status').textContent='';render();var first=versionChoices.querySelector('[data-version-id]');if(first)first.focus();return;}
        selectedActionId = button.getAttribute('data-version-id');
        doc.querySelector('#host-version-status').textContent = '';
        renderVariant();
      });
      doc.querySelector('#host-version-close').addEventListener('click',closeVersions);
      overlay.addEventListener('click',function (event) { if (event.target === overlay) closeVersions(); });
      overlay.addEventListener('keydown',function (event) {
        if (event.key === 'Escape' || event.keyCode === 27) { event.preventDefault(); closeVersions(); return; }
        if (event.key !== 'Tab' && event.keyCode !== 9) return;
        var focusable = Array.prototype.filter.call(overlay.querySelectorAll('button:not([disabled]),a[href],select,input,summary,[tabindex="0"]'),function (node) {
          var ancestor = node.parentNode;
          while (ancestor && ancestor !== overlay) {
            if (ancestor.hidden || ancestor.tagName === 'DETAILS' && !ancestor.open && node !== ancestor.querySelector('summary')) return false;
            ancestor = ancestor.parentNode;
          }
          return node.offsetWidth || node.offsetHeight || node === doc.activeElement;
        });
        var first = focusable[0], last = focusable[focusable.length-1];
        if (!first) return;
        if (event.shiftKey && (doc.activeElement === first || !overlay.contains(doc.activeElement))) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (doc.activeElement === last || !overlay.contains(doc.activeElement))) { event.preventDefault(); first.focus(); }
      });
    }
    function useAddress(event) {
      if (event) event.preventDefault(); try { var value = currentAddress(); address.value = value; invalidateChecks(); remember(); doc.querySelector('#host-address-display').textContent = value; tell('Console address configured. Service availability has not been checked.'); render(); refresh(doc.querySelector('.host-connection-info')); } catch (error) { invalidateChecks(); tell(error.message, true); }
    }
    doc.querySelector('#host-address-form').addEventListener('submit', useAddress);
    address.addEventListener('input',function () {
      invalidateChecks();
      doc.querySelector('#host-address-display').textContent = configuredAddress() || 'Not configured';
      each(doc.querySelectorAll('.host-download-destination'),function (node) {
        node.textContent = 'Download destination: ' + (String(address.value || '').trim() || detection.platform === platform ? platform.toUpperCase() : 'This device'); refresh(node);
      });
      render();
    });
    doc.querySelector('#host-loopback').addEventListener('click', function () { address.value = '127.0.0.1'; useAddress(); });
    each(doc.querySelectorAll('[data-host-category]'), function (button) { button.setAttribute('aria-pressed', button.getAttribute('data-host-category') === category ? 'true' : 'false'); button.addEventListener('click', function () { category = button.getAttribute('data-host-category'); each(doc.querySelectorAll('[data-host-category]'), function (item) { item.setAttribute('aria-pressed', item === button ? 'true' : 'false'); }); render(); }); });
    firmware.addEventListener('change', function () { firmwareSource.textContent = 'Firmware selection: manual'; syncFirmwareButtons(); remember(); render(); refresh(firmwareSource); });
    if (firmwareButtons) firmwareButtons.addEventListener('click', function (event) {
      var button=event.target; while(button && button!==firmwareButtons && !button.hasAttribute('data-host-firmware'))button=button.parentNode;
      if(!button || button===firmwareButtons)return;
      if(restrictFirmware&&availableFirmwares.indexOf(button.getAttribute('data-host-firmware'))===-1)return;
      firmware.value=button.getAttribute('data-host-firmware'); firmwareSource.textContent='Firmware selection: manual'; syncFirmwareButtons(); remember(); render(); refresh(firmwareSource);
    });
    if (search) search.addEventListener('input', function(){if(!consoleBrowser){render();return;}if(searchTimer)(win.clearTimeout||clearTimeout)(searchTimer);searchTimer=(win.setTimeout||setTimeout)(function(){searchTimer=null;render();},120);}); if (game) game.addEventListener('change', render); if (legacy) legacy.addEventListener('change', render);
    function detectConsole(manualRequest) {
      invalidateChecks();
      detection = detectBrowser(win.navigator.userAgent);
      var loopback = doc.querySelector('#host-loopback'); loopback.hidden = detection.platform !== platform; loopback.disabled = detection.platform !== platform;
      doc.querySelector('#host-detected-device').textContent = detection.device;
      doc.querySelector('#host-browser-firmware').textContent = detection.firmware ? 'Browser firmware: ' + detection.firmware : 'Browser firmware: not detected';
      var other = doc.querySelector('#host-other-console'); other.hidden = !detection.platform || detection.platform === platform;
      if (!other.hidden) { other.href = '/hosts/' + detection.platform + '/'; other.textContent = 'Open ' + detection.platform.toUpperCase() + ' host'; }
      if (detection.platform === platform && detection.firmware) {
        firmware.value = detection.firmware;
        firmwareSource.textContent = 'Firmware selection: console browser';
        if (!address.value && !doc.querySelector('meta[name="whatwhatboy-local-sender"]')) address.value = '127.0.0.1';
        if (manualRequest) tell('Console browser firmware detected. Check the matching loader requirements.');
      } else if (manualRequest) tell('Open this page in the console browser to detect its firmware. On a computer or phone, select firmware manually.');
      doc.querySelector('#host-address-display').textContent = address.value || 'Not configured';
      syncFirmwareButtons(); remember(); render(); refresh(doc.querySelector('.host-connection-info'));
    }
    doc.querySelector('#host-detect').addEventListener('click', function () { detectConsole(true); });
    doc.querySelector('#host-check-services').addEventListener('click', function () {
      var target; try { target = currentAddress(); } catch (error) { tell(error.message, true); return; }
      if (!bridge || bridge.status !== 'connected') { doc.querySelector('.host-sender').open = true; tell('Connect the local sender to check console services. This does not run a payload.', true); return; }
      var ticket = connection.beginCheck(target), checkButton = doc.querySelector('#host-check-services');
      checkButton.disabled = true; checkButton.setAttribute('aria-busy','true');
      tell('Checking console services…');
      client.inspectConsole(target, platform, {bridgeURL:bridgeURL.value, token:token.value, origin:win.location.origin}).then(function (value) {
        if (!connection.accepts(ticket,configuredAddress())) return;
        checkButton.disabled = false; checkButton.removeAttribute('aria-busy');
        result(value);
        doc.querySelector('#host-service-status').textContent = value.status === 'connected' ? 'Service: ' + value.service + (value.version ? ' ' + value.version : '') : 'Service: not verified';
        if (value.reportedAddress) doc.querySelector('#host-address-display').textContent = value.reportedAddress + ' (service-reported)';
        var checks = doc.querySelector('#host-service-checks');
        if (checks && Array.isArray(value.checks)) {
          var labels = {goldhen:'GoldHEN loader','payload-manager':'Payload Manager',downloader:'Console downloader','ps4-files':'PS4 file manager',files:'PS5 websrv',ezremote:'PS5 ezRemote'};
          checks.hidden = false;
          checks.innerHTML = value.checks.map(function (check) { return '<div class="host-service-result" data-state="' + escape(check.status) + '"><strong>' + escape(labels[check.service || check.id] || check.service || check.id) + '</strong><span>' + escape(check.status === 'connected' ? 'Responding' : 'Not verified') + '</span><p>' + escape(check.message) + '</p></div>'; }).join('');
          refresh(checks);
        } else if (checks) {
          checks.hidden = false;
          checks.innerHTML = '<p>Update the desktop sender to check the downloader and file-manager services.</p>';
          refresh(checks);
        }
        refresh(doc.querySelector('.host-connection-info'));
      }).catch(function (error) { if (!connection.accepts(ticket,configuredAddress())) return; checkButton.disabled = false; checkButton.removeAttribute('aria-busy'); tell(error.message, true); });
    });
    var clearTransfer = doc.querySelector('#host-clear-transfer-warning'); if (clearTransfer) clearTransfer.addEventListener('click',function () {
      var target = configuredAddress(); if (!target) return;
      connection.clearWarning(target); remember(); render();
      tell('Transfer warning cleared for this address. Nothing was sent or retried.');
    });
    each(doc.querySelectorAll('[data-open-service]'), function (button) { button.addEventListener('click', function () { service(button.getAttribute('data-open-service')); }); });
    each(doc.querySelectorAll('[data-open-workspace]'),function (button) { button.addEventListener('click',function () {
      try { var destination = currentAddress(); win.open(workspaceURL(platform,destination,button.getAttribute('data-open-workspace'),client.normalizeAddress),'_blank','noopener'); tell('Opening the installed console workspace. Keep ezRemote Client running and install the helper at the displayed path first.'); } catch (error) { tell(error.message,true); }
    }); });
    each(doc.querySelectorAll('[data-manager-route]'), function (button) { button.addEventListener('click', function () {
      try { if (platform !== 'ps5') throw Error('PS5 Payload Manager requires a PS5.'); var destination = currentAddress(); win.open(managerURL(destination,button.getAttribute('data-manager-route'),client.normalizeAddress),'_blank','noopener'); tell('Opening PS5 Payload Manager at ' + destination + '. The manager ELF must already be running.'); } catch (error) { tell(error.message,true); }
    }); });
    var loadManager = doc.querySelector('#host-load-manager'); if (loadManager) loadManager.addEventListener('click', function () { runAction(actionById('ps5-payload-manager')); });
    doc.querySelector('#host-connect-bridge').addEventListener('click', function () {
      if (!client) return;
      var generation = ++pairingGeneration, pairedURL = bridgeURL.value, pairedToken = token.value;
      bridge = null; invalidateChecks(); render();
      tell('Checking local sender…');
      client.inspectBridge(pairedURL, pairedToken, {origin: win.location.origin}).then(function (value) { if (generation !== pairingGeneration || pairedURL !== bridgeURL.value || pairedToken !== token.value) return; bridge = value.status === 'connected' ? value : null; result(value); render(); }).catch(function (error) { if (generation === pairingGeneration) tell(error.message, true); });
    });
    [bridgeURL,token].forEach(function (field) { field.addEventListener('input',function () { pairingGeneration++; bridge = null; invalidateChecks(); render(); }); });
    if (win.addEventListener) win.addEventListener('storage',function (event) {
      if (event.key !== storageKey || !client) return;
      try { var saved = JSON.parse(event.newValue || '{}'); connection.restore(saved.uncertainTransfers,client.normalizeAddress); render(); } catch (_) {}
    });
    doc.querySelector('#host-open-bridge').addEventListener('click', function () {
      var url = safeURL(bridgeURL.value, win.location.href); if (!url) { tell('Enter the local sender address.', true); return; }
      var parsed = new URL(url); parsed.pathname = '/hosts/' + platform + '/'; parsed.search = ''; parsed.hash = '';
      win.open(parsed.href, '_blank', 'noopener');
    });
    try { var saved = JSON.parse(win.localStorage.getItem(storageKey) || '{}'); address.value = saved.address || ''; firmware.value = saved.firmware || ''; if (client) connection.restore(saved.uncertainTransfers,client.normalizeAddress); } catch (_) {}
    firmwareSource.textContent = firmware.value ? 'Firmware selection: saved choice' : 'Firmware selection: not selected';
    if (doc.querySelector('meta[name="whatwhatboy-local-sender"]')) bridgeURL.value = win.location.origin;
    detectConsole(false);
  }
  return {availableBrowserFirmwares:availableBrowserFirmwares,firmwareNumber: firmwareNumber, firmwareMatches: firmwareMatches, firmwareLabel: firmwareLabel, requiresFirmware: requiresFirmware, consoleDownloadURL: consoleDownloadURL, targetAddress:targetAddress, managerURL:managerURL,workspaceURL:workspaceURL, actionImage:actionImage, menuFamily:menuFamily, groupActions:groupActions, variantLabel:variantLabel, imageCaption:imageCaption,scopeActions:scopeActions, loadCapability:loadCapability,bridgeFileReady:bridgeFileReady,payloadFileFacts:payloadFileFacts,choosePayloadFile:choosePayloadFile,downloadPlan:downloadPlan,connectionState:connectionState,browserFirmware: browserFirmware, detectBrowser: detectBrowser, compareGameVersions: compareGameVersions, filterActions: filterActions, safeURL: safeURL, install: install};
}));
