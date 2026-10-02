// CI diagnostic: where the time goes when a photo is turned into a guide, in this machine's browser (E2E_BROWSER).
// (Until v294 the photo tests were left out on WebKit: no photo opened there, because the tests' block on outside
// addresses stopped the page's own blob: links in Playwright's WebKit.) This loads one made-up photo, as the photo
// tests do, and reports how long until each step showed (the status line under the picture, Build on the bar), and
// what the page waited on meanwhile: animation frames, timers (and their delays), and how long the main thread was
// busy.
// Usage: E2E_BROWSER=webkit node e2e/ci-photo-timing.mjs  (a notice on GitHub, else printed)
import { setup, teardown, openApp, welcome, ENGINE } from './helpers.mjs';

// counts what the page waits on, from the start
const init = () => {
  const w = (window.__wait = { raf: 0, to: 0, toMs: 0, busy: 0, gaps: 0, t0: performance.now() });
  const raf = window.requestAnimationFrame.bind(window),
    st = window.setTimeout.bind(window);
  window.requestAnimationFrame = function (f) {
    w.raf++;
    return raf(f);
  };
  window.setTimeout = function (f, ms) {
    w.to++;
    w.toMs += +ms || 0;
    return st.apply(window, arguments);
  };
  // a heartbeat: a 50 ms timer that comes much later means the main thread was busy for that long
  let last = performance.now();
  const beat = () => {
    const now = performance.now(),
      late = now - last - 50;
    if (late > 30) {
      w.busy += late;
      w.gaps++;
    }
    last = now;
    st(beat, 50);
  };
  st(beat, 50);
};

await setup();
const { page, errors } = await openApp({ width: 390, height: 844, init: `(${init})()` });
await welcome(page, 'look');
// (not idle(): the heartbeat below keeps a timer going all the time)
await page.waitForTimeout(800);
// a made-up photo, as the photo tests make theirs: circles in outline on white
const b64 = await page.evaluate(() => {
  const c = document.createElement('canvas');
  c.width = 1600;
  c.height = 1200;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, 1600, 1200);
  g.strokeStyle = '#000';
  g.lineWidth = 10;
  for (let i = 0; i < 24; i++) {
    g.beginPath();
    g.arc(140 + (i % 6) * 260, 160 + Math.floor(i / 6) * 280, 110, 0, Math.PI * 2);
    g.stroke();
  }
  g.strokeRect(5, 5, 1590, 1190);
  return c.toDataURL('image/png').split(',')[1];
});
const mark = () => page.evaluate(() => ({ ...window.__wait, now: performance.now() }));
const steps = [];
const w0 = await mark();
const [fc] = await Promise.all([
  page.waitForEvent('filechooser'),
  page.evaluate(() => {
    setMode('sections');
    SF.pickPhoto();
  }),
]);
await fc.setFiles({ name: 'pic.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
const t0 = Date.now();
let lastNote = '',
  done = false;
while (Date.now() - t0 < 240000) {
  const s = await page
    .evaluate(() => {
      const n = document.getElementById('sfMeta');
      const b = document.getElementById('sfBuild');
      return {
        note: n ? n.textContent.trim().slice(0, 40) : '',
        build: !!(b && b.offsetParent),
        pg: !!(window.__mstest && __mstest.pgEd),
      };
    })
    .catch(() => ({ note: '?', build: false, pg: false }));
  const label = s.build ? 'Build shown' : s.pg ? 'page check' : s.note;
  if (label && label !== lastNote) {
    steps.push(`${((Date.now() - t0) / 1000).toFixed(1)} s ${label}`);
    lastNote = label;
  }
  if (s.build) {
    done = true;
    break;
  }
  // a photographed page asks to check its corners: Keep as is
  if (s.pg) {
    const k = await page.$('#sfPgNo');
    if (k) await k.click().catch(() => {});
  }
  await page.waitForTimeout(250);
}
const w1 = await mark();
const secs = ((Date.now() - t0) / 1000).toFixed(1);
const msg =
  `${ENGINE}: ${done ? 'Build shown after ' + secs + ' s' : 'no Build after ' + secs + ' s'} — ` +
  steps.join('; ') +
  ` — meanwhile ${w1.raf - w0.raf} animation frames asked for, ${w1.to - w0.to} timers (${Math.round(w1.toMs - w0.toMs)} ms of delays), ` +
  `main thread busy ${(Math.round(w1.busy - w0.busy) / 1000).toFixed(1)} s in ${w1.gaps - w0.gaps} stretches` +
  (errors.length ? ` — errors: ${errors.join(' | ').slice(0, 200)}` : '');
console.log(process.env.GITHUB_ACTIONS ? `::notice title=Photo timing (${ENGINE})::${msg}` : msg);
await teardown();
