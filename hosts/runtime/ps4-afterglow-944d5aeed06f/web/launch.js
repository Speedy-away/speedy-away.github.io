/* whatwhatboy Afterglow landing integration. No exploit code is evaluated here. */
(function () {
  'use strict';
  var form = document.getElementById('pick'), auto = document.getElementById('auto');
  var count = document.getElementById('count'), cache = document.getElementById('cache');
  var startButton = document.getElementById('start'), timer = null, queued = false, leaving = false;
  var choiceKey = 'whatsite.afterglow.1402.choice.v1', armKey = 'whatsite.afterglow.1402.arm.v1';
  function say(element, text) { element.textContent = window.afterglowTranslate ? window.afterglowTranslate(text) : text; }
  var match = navigator.userAgent.match(/PlayStation 4[\/ ](\d+\.\d{2})(?:\D|$)/i);
  var allowed = !!match && ['14.02'].indexOf(match[1]) >= 0;
  var targets = {hen: 'log=1&afterglow=run&payload=hen.bin', goldhen: 'log=1&afterglow=run&mode=goldhen'};
  var appCache = null;
  try { appCache = window.applicationCache; } catch (_) {}
  function picked() { return form.querySelector('input[name="payload"]:checked').value; }
  function remember() { if(window.AfterglowSettingsUpdated)window.AfterglowSettingsUpdated();try { localStorage.setItem(choiceKey, JSON.stringify({payload: picked(), autostart: auto.checked})); } catch (_) {} }
  function stop() { if (timer !== null) clearInterval(timer); timer = null; queued = false; count.textContent = ''; }
  function busy() { return window.AfterglowCache && window.AfterglowCache.isBusy(); }
  function note() {
    say(cache, busy() ? 'Waiting for cache' : appCache && appCache.status === 4 ? 'Reopen to update cache' : '');
    if (queued && !busy()) { queued = false; start(); }
  }
  function start() {
    stop();
    if (!allowed || leaving) return;
    if (appCache && appCache.status === 4) { say(cache, 'Reopen to update cache'); return; }
    if (busy()) { queued = true; say(count, 'Waiting for cache'); return; }
    try { sessionStorage.setItem(armKey, String(Date.now())); } catch (_) { say(count, 'Session storage required'); return; }
    if(!retryVisit)try{sessionStorage.removeItem('wwb.afterglow.1402.retry.used');}catch(_){}
    leaving = true;
    location.href = 'jb.html?' + targets[picked()];
  }
  function clock() {
    stop();
    if (!allowed) return;
    var left = 5;
    count.textContent = '5';
    timer = setInterval(function () { if (busy()) return; left--; count.textContent = String(left); if (left <= 0) start(); }, 1000);
  }
  try {
    sessionStorage.removeItem(armKey);
    var saved = JSON.parse(localStorage.getItem(choiceKey) || 'null');
    if (saved && targets[saved.payload]) form.querySelector('input[value="' + saved.payload + '"]').checked = true;
    auto.checked = !!(saved && saved.autostart === true);
  } catch (_) { auto.checked = false; }
  startButton.disabled = !allowed;
  auto.disabled = !allowed;
  say(document.getElementById('browser-firmware'), match ? 'PS4 ' + match[1] : 'PS4 browser required');
  form.addEventListener('submit', function (event) { event.preventDefault(); remember(); start(); });
  form.addEventListener('change', function () { stop(); remember(); if (auto.checked) clock(); });
  document.getElementById('cancel').addEventListener('click', function () { stop(); auto.checked = false; remember(); });
  window.addEventListener('pagehide', stop);
  window.addEventListener('pageshow', function (event) { if (event.persisted) { stop(); try { sessionStorage.removeItem(armKey); } catch (_) {} } });
  if (appCache) ['checking','downloading','progress','cached','noupdate','updateready','error','obsolete'].forEach(function (name) { appCache.addEventListener(name, note); });
  if (window.AfterglowCache) window.AfterglowCache.subscribe(note);
  note();
  var retryVisit=false;
  try {
    var retryStamp=Number(sessionStorage.getItem('wwb.afterglow.1402.retry'));
    sessionStorage.removeItem('wwb.afterglow.1402.retry');
    var prefs=JSON.parse(localStorage.getItem('wwb.afterglow.1402.settings.v1')||'{}')||{};
    var ref=new URL(document.referrer),here=location.pathname.replace(/[^/]*$/, '');
    retryVisit=allowed&&prefs.retry!==false&&/[?&]retry=1(?:&|$)/.test(location.search)&&performance.navigation.type===0&&ref.origin===location.origin&&(ref.pathname===here+'jb.html'||ref.pathname===here+'index.html')&&retryStamp>0&&Date.now()-retryStamp>=0&&Date.now()-retryStamp<30000;
  }catch(_){}
  window.AfterglowLanding={stop:stop,isAuto:function(){return auto.checked;},setAuto:function(value){stop();auto.checked=!!value&&allowed;remember();if(auto.checked)clock();}};
  if(window.AfterglowCache&&window.AfterglowCache.onDelete)window.AfterglowCache.onDelete(stop);
  var restored = /[?&]restored=1(?:&|$)/.test(location.search);
  try { restored = restored || performance.navigation.type !== 0; } catch (_) {}
  if (retryVisit || (allowed && auto.checked && !restored)) clock();
})();
