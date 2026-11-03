# The threads test (v329.3, after its first GitHub run)

Does the subject finder get faster with more than one thread on a real iPad, and does TE-6 run in the app without
running out of memory? ONNX Runtime uses threads only on a cross-origin isolated page, which GitHub Pages can't make
(it can't send the two headers). `threads-test/` is a copy of the app, one folder down, whose own service worker adds
them; the app itself is untouched (its workers use one thread unless the page is isolated, so nothing changes there).

- Made by `node scripts/threads-test.mjs` after `scripts/build.mjs`. `te6.onnx` (E6-mix, 46 MB, round 6's
  `subject-E6-mix-576-w8.onnx`) is put in `threads-test/` by hand.
- It uses the app's own files one folder up (the engine, the models, fonts, icons) and the app's caches, and shares the
  app's saved data (the same site): back up first.
- Open `…/marker-studio/threads-test/?subtime`: it reloads itself once to become isolated, then a button at the bottom
  right, **Time the subject finder**, times TE-4 and TE-6 the app's way (a fresh helper per photo, five in a row) with
  1, 2 and 4 threads, checks the outlines against one thread's, and checks Send feedback's post (to a form that doesn't
  exist). Copy its text to Claude. Try it in Safari, then added to the Home Screen.
- Send feedback in this copy: its service worker posts the form, outside the page's isolation, and answers the page
  itself (with Cross-Origin-Resource-Policy, which Safari needs).
- Delete the folder when the test is done (te6.onnx stays in the repo's history).
