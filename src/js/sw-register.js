// an installed app can stay open for days: each time it comes back to the screen it checks for a new version
if ('serviceWorker' in navigator) {
  addEventListener('load', function () {
    var had = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!had) {
        had = true;
        return;
      }
      if (window.toastHTML)
        toastHTML(
          'Marker Studio was updated. <button class="sflink" onclick="location.reload()">Reload</button>',
          15000,
        );
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
