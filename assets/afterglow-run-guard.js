/* Inline before importing any upstream module; no exploit or payload is run by this guard. */
(function () {
  'use strict';
  var key = 'whatsite.afterglow.arm.v1', stamp = 0, from = false, navigation = true;
  try { stamp = Number(sessionStorage.getItem(key)); sessionStorage.removeItem(key); } catch (_) {}
  try {
    var ref = new URL(document.referrer), here = location.pathname.replace(/[^/]*$/, '');
    from = ref.origin === location.origin && (ref.pathname === here || ref.pathname === here + 'index.html');
    navigation = performance.navigation.type === 0;
  } catch (_) { navigation = false; }
  var ua = navigator.userAgent.match(/PlayStation 4[\/ ](\d+\.\d{2})(?:\D|$)/i);
  var valid = ua && ['13.52','14.00'].indexOf(ua[1]) >= 0;
  var query = location.search;
  var target = query === '?log=1&afterglow=run&payload=hen.bin' || query === '?log=1&afterglow=run&mode=goldhen';
  if (valid && target && from && navigation && stamp > 0 && Date.now() - stamp >= 0 && Date.now() - stamp < 30000) {
    import('./jb.js').catch(function () { document.body.className = 'fail'; document.getElementById('msg').textContent = 'Runtime dependency failed'; });
  } else {
    document.body.className = 'fail';
    document.getElementById('msg').textContent = 'Return to the landing page';
    location.replace('index.html?restored=1');
  }
})();
