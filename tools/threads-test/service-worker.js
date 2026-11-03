// The threads test's service worker (v329.4, tools/threads-test): the copy of Marker Studio in threads-test/ made
// cross-origin isolated, so ONNX Runtime may use more than one thread. GitHub Pages can't send the two headers that
// allow it, so this worker adds them to the page as it's loaded. Nothing is stored: every file comes from the network
// (the engine and models from the app's own caches, as the page keeps them). The app's own caches are left alone.
self.addEventListener('install', function () {
  self.skipWaiting();
});
self.addEventListener('activate', function (e) {
  e.waitUntil(self.clients.claim());
});
self.addEventListener('fetch', function (e) {
  const r = e.request,
    u = new URL(r.url);
  // (Send feedback's form: posted from here, outside the page's isolation, which would refuse Google's answer; the page
  // is told it went, as it was before: it never reads the answer. No network: it fails, as before. Safari refuses even
  // this answer to an isolated page unless it says it may be used anywhere, Cross-Origin-Resource-Policy)
  if (r.method === 'POST' && u.hostname === 'docs.google.com' && /\/formResponse$/.test(u.pathname)) {
    e.respondWith(
      fetch(r).then(function () {
        return new Response('', { status: 200, headers: { 'Cross-Origin-Resource-Policy': 'cross-origin' } });
      }),
    );
    return;
  }
  if (r.method !== 'GET' || r.mode !== 'navigate' || u.origin !== self.location.origin) return;
  e.respondWith(
    fetch(r).then(function (res) {
      const h = new Headers(res.headers);
      h.set('Cross-Origin-Opener-Policy', 'same-origin');
      h.set('Cross-Origin-Embedder-Policy', 'require-corp');
      return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
    }),
  );
});
