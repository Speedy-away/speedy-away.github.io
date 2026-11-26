/* Purge worker.
 *
 * This origin used to install a cache-first worker, which kept serving the
 * old exploit page and old payload bytes after every edit -- a stale payload
 * on a cold boot costs a console reboot. This worker deletes every cache and
 * unregisters itself. It does not touch the open page: the earlier version
 * navigated its clients, and since the page registers again on the next load,
 * that made a reload loop out of every visit.
 */
self.addEventListener("install", function () {
  self.skipWaiting();
});
self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.map(function (k) { return caches.delete(k); }));
      })
      .then(function () { return self.registration.unregister(); })
  );
});
