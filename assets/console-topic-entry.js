(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (!root || !root.document || !root.location) return;
  const entry = root.document.body?.getAttribute('data-console-topic-entry');
  const target = api.destination(root.location, entry);
  if (target) root.location.replace(target);
})(typeof window === 'undefined' ? null : window, function () {
  const hubs = new Set([
    '/console/ps2/', '/console/psvita/home.html', '/console/gamecube/',
    '/console/nintendo-switch/', '/console/nintendo-switch-2/',
    '/console/wii/', '/console/wiiu/', '/console/psp/', '/console/3ds/',
    '/console/ds/', '/console/xbox-one-series/', '/console/steamdeck/'
  ]);
  function destination(location, entry) {
    if (!location || location.hash || location.search || !entry || !hubs.has(entry)) return null;
    try {
      const current = new URL(location.href);
      const target = new URL(entry, current);
      if (target.origin !== current.origin || target.search || target.hash || !hubs.has(target.pathname)) return null;
      if (target.href === current.href) return null;
      return target.pathname;
    } catch { return null; }
  }
  return {destination};
});
