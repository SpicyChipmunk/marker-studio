// an installed app can stay open for days: each time it comes back to the screen it checks for a new version
if ('serviceWorker' in navigator) {
  addEventListener('load', function () {
    var had = !!navigator.serviceWorker.controller;
    // (v318.22 debug: a page opened with a hard reload has no controller though the app is installed: an update taking
    // it over later is still said, not taken for the first install)
    try {
      navigator.serviceWorker
        .getRegistration()
        .then(function (r) {
          if (r && r.active) had = true;
        })
        .catch(function () {});
    } catch (e) {}
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!had) {
        had = true;
        return;
      }
      // (v318.22 debug: a tab out of view when another tab updated it is told when it next comes into view: told while
      // hidden, it never saw the toast, and kept running the old code)
      var say = function () {
        if (document.visibilityState !== 'visible')
          return document.addEventListener('visibilitychange', say, { once: true });
        if (window.toastHTML)
          toastHTML(
            'Marker Studio was updated. <button class="sflink" onclick="location.reload()">Reload</button>',
            15000,
          );
      };
      // (v318.22, fourth pass) not a page that's the version which took it over already: a hard reload that fetched the
      // new release was told to reload. The new worker has deleted the other versions' caches before it takes over, so
      // the one left is its own
      var e = document.getElementById('appVer'),
        m = /v?(\d+(?:\.\d+)?)/.exec((e && e.textContent) || ''),
        mine = m ? 'marker-studio-v' + m[1] : '';
      if (!mine || !window.caches) return say();
      caches.keys().then(function (ks) {
        var cur = ks.filter(function (k) {
          return /^marker-studio-v\d/.test(k);
        });
        if (!(cur.length === 1 && cur[0] === mine)) say();
      }, say);
    });
    navigator.serviceWorker
      .register('service-worker.js')
      .then(function (reg) {
        document.addEventListener('visibilitychange', function () {
          if (document.visibilityState === 'visible')
            try {
              reg.update().catch(function () {});
            } catch (e) {}
        });
      })
      .catch(function () {});
  });
}
