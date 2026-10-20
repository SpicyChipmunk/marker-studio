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
    var stale = false,
      // (v318.25: closed with ✕: not brought back by the next screen change, only when the page next comes back)
      shut = false;
    var updShow = function () {
      if (!stale || document.visibilityState !== 'visible' || document.getElementById('msUpd')) return;
      var w = document.querySelector('.wrap');
      if (w && w.classList.contains('sfmode')) {
        var t = document.getElementById('msToast');
        if (t && t.classList.contains('on') && document.getElementById('toastAct')) return;
        if (window.toastHTML)
          toastHTML(
            'A new version of Marker Studio is ready. <button class="sflink" onclick="location.reload()">Reload</button>',
            15000,
          );
        return;
      }
      var h = document.querySelector('.head');
      if (!h) return;
      h.insertAdjacentHTML(
        'beforeend',
        '<div class="msblocked msupd" id="msUpd"><b>A new version of Marker Studio is ready.</b> ' +
          '<button type="button" class="sflink" id="msUpdGo">Reload</button>' +
          '<button type="button" class="msupdx" id="msUpdX" aria-label="Not now">\u2715</button></div>',
      );
      // (v318.28) said from #msSay, a live region there from the start: the banner, inserted holding its words, was
      // a live region that didn't exist before they did, which screen readers (iOS VoiceOver) don't announce
      var say = document.getElementById('msSay');
      if (say) say.textContent = 'A new version of Marker Studio is ready.';
      document.getElementById('msUpdGo').addEventListener('click', function () {
        location.reload();
      });
      document.getElementById('msUpdX').addEventListener('click', function () {
        var b = document.getElementById('msUpd');
        // (v318.28) the keyboard's focus, on the ✕ going with it, to the tab that's open (it fell to the page's start)
        var tab = document.querySelector('.modes button.on');
        if (b && tab && b.contains(document.activeElement)) tab.focus();
        if (b) b.remove();
        shut = true;
      });
    };
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') shut = false;
      updShow();
    });
    // (leaving the guide's screen, where it was a toast: the banner, on the screen that opens)
    try {
      var wr = document.querySelector('.wrap');
      if (wr && window.MutationObserver)
        new MutationObserver(function () {
          if (!stale) return;
          if (!wr.classList.contains('sfmode')) {
            if (!shut) updShow();
            return;
          }
          // (v318.25: a banner shown before a guide opened would sit above its picture and move it: there it's the
          // toast, and the banner comes back on leaving the guide's screen)
          var b = document.getElementById('msUpd');
          if (b) {
            b.remove();
            updShow();
          }
        }).observe(wr, { attributes: true, attributeFilter: ['class'] });
    } catch (e) {}
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!had) {
        had = true;
        return;
      }
      // (v318.23) this page is now older than the app it came from: said until it's reloaded, not for 15 s once. A
      // banner under the title, as storage that can't be written is (not a toast: the next Undo toast would take its
      // place). On the guide's screen a banner above the picture moves it (Safari keeps no scroll place), so there it's
      // the toast it was, not over an Undo, and said again each time the page comes back to the screen. Closed with ✕,
      // it's back the next time too. (v318.22 debug: one out of view is told when it next comes into view)
      var say = function () {
        stale = true;
        updShow();
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
