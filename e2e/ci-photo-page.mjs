// CI diagnostic and stage 0 bench (v325): a photo made into a colouring page (47-photo-page), timed in this machine's
// browser (E2E_BROWSER). A made-up 12-megapixel photo (soft gradients, shapes, texture and noise, as a camera's) is
// made into a page at Medium, then at each Detail step in turn; for each: how long the page took, the longest the
// screen was held (the work is in the worker: a 50 ms heartbeat that comes late), and the longest pieces of work on the
// page's thread (Copy diagnostics' list). The gates (docs/PLAN-photo-to-page.md, stage 0): Medium in 5 s or less with the
// processor slowed 4×, a Detail change in 3 s or less, the screen never held for more than 100 ms. (Memory isn't
// measured here: Chromium's heap count leaves out the typed arrays, which are nearly all of it; the plan counts them.)
// Usage: node e2e/ci-photo-page.mjs [--slow 4]   (E2E_BROWSER=webkit for WebKit; a notice on GitHub, else printed)
import { setup, teardown, openApp, ENGINE } from './helpers.mjs';

const ai = process.argv.indexOf('--slow'),
  SLOW = ai > 0 ? +process.argv[ai + 1] || 1 : 1;
// the heartbeat, from the start: the longest late beat, and the total
const init = () => {
  const w = (window.__beat = { max: 0, busy: 0 });
  const st = window.setTimeout.bind(window);
  let last = performance.now();
  const beat = () => {
    const now = performance.now(),
      late = now - last - 50;
    if (late > w.max) w.max = late;
    if (late > 30) w.busy += late;
    last = now;
    st(beat, 50);
  };
  st(beat, 50);
};

await setup();
const { page, errors } = await openApp({
  width: 820,
  height: 1180,
  storage: { 'ms-onboarded': '1', 'ms-setup-tip': '1' },
  init: `(${init})()`,
});
if (SLOW > 1 && ENGINE === 'chromium') {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: SLOW });
}
await page.waitForTimeout(800);
// the made-up photo: a sky-to-ground gradient, soft blobs of colour, a few hard-edged shapes, fine texture and noise
const b64 = await page.evaluate(() => {
  const c = document.createElement('canvas'),
    w = 4000,
    h = 3000;
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  const lg = g.createLinearGradient(0, 0, 0, h);
  lg.addColorStop(0, '#7fb2e0');
  lg.addColorStop(0.55, '#d8e4ec');
  lg.addColorStop(0.56, '#6c8a3c');
  lg.addColorStop(1, '#3d4f22');
  g.fillStyle = lg;
  g.fillRect(0, 0, w, h);
  let s = 7;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 60; i++) {
    const x = rnd() * w,
      y = rnd() * h,
      r = 80 + rnd() * 420,
      rg = g.createRadialGradient(x, y, 0, x, y, r),
      hue = Math.round(rnd() * 360);
    rg.addColorStop(0, `hsla(${hue},55%,${35 + rnd() * 40}%,0.85)`);
    rg.addColorStop(1, `hsla(${hue},55%,50%,0)`);
    g.fillStyle = rg;
    g.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  for (let i = 0; i < 12; i++) {
    g.fillStyle = `hsl(${Math.round(rnd() * 360)},60%,${30 + rnd() * 40}%)`;
    g.beginPath();
    g.ellipse(rnd() * w, rnd() * h, 60 + rnd() * 300, 40 + rnd() * 200, rnd() * 3, 0, Math.PI * 2);
    g.fill();
  }
  // grass-like texture in the lower half, and sensor noise over all of it
  g.strokeStyle = 'rgba(30,50,10,0.25)';
  g.lineWidth = 3;
  for (let i = 0; i < 6000; i++) {
    const x = rnd() * w,
      y = h * 0.56 + rnd() * h * 0.44;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (rnd() - 0.5) * 20, y - 15 - rnd() * 30);
    g.stroke();
  }
  const id = g.getImageData(0, 0, w, h),
    d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rnd() - 0.5) * 18;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  g.putImageData(id, 0, 0);
  return c.toDataURL('image/jpeg', 0.9).split(',')[1];
});
const beat = () => page.evaluate(() => Object.assign({}, window.__beat));
const beatReset = () =>
  page.evaluate(() => {
    window.__beat.max = 0;
  });
const ready = (step) =>
  page.waitForFunction(
    (k) =>
      window.__mstest &&
      __mstest.pp &&
      !__mstest.ppBusy &&
      __mstest.pp.d === k &&
      /This page:/.test((document.getElementById('sfPpCount') || {}).textContent || ''),
    step,
    { timeout: 120000, polling: 50 },
  );
const rows = [];
await beatReset();
const [fc] = await Promise.all([
  page.waitForEvent('filechooser'),
  page.evaluate(() => SF.ppPick(() => setMode('sections'))),
]);
let t = Date.now();
await fc.setFiles({ name: 'photo.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(b64, 'base64') });
await ready(2);
let b = await beat();
const first = { s: (Date.now() - t) / 1000, held: b.max };
rows.push(`first page (Medium) ${first.s.toFixed(1)} s, ${await page.textContent('#sfPpCount')}`);
const detail = {};
for (const k of [0, 1, 3, 4, 2]) {
  await beatReset();
  t = Date.now();
  await page.evaluate((v) => {
    const d = document.getElementById('sfPpDet');
    d.value = String(v);
    d.dispatchEvent(new Event('input', { bubbles: true }));
    d.dispatchEvent(new Event('change', { bubbles: true }));
  }, k);
  await ready(k);
  b = await beat();
  detail[k] = { s: (Date.now() - t) / 1000, held: b.max };
  rows.push(
    `${['Very simple', 'Simple', 'Medium', 'Detailed', 'Very detailed'][k]} ${detail[k].s.toFixed(1)} s (held ${Math.round(b.max)} ms), ${(await page.textContent('#sfPpCount')).replace('This page: ', '')}`,
  );
}
const ds = Object.values(detail),
  worstD = Math.max(...ds.map((x) => x.s)),
  worstH = Math.max(...ds.map((x) => x.held));
const gates = [
  SLOW >= 4 ? (first.s <= 5 ? 'Medium ≤ 5 s: yes' : 'Medium ≤ 5 s: NO') : null,
  worstD <= 3 ? 'Detail ≤ 3 s: yes' : 'Detail ≤ 3 s: NO (' + worstD.toFixed(1) + ' s)',
  (worstH <= 100 ? 'held ≤ 100 ms on a Detail change: yes' : 'held ≤ 100 ms on a Detail change: NO') +
    ' (' +
    Math.round(worstH) +
    ' ms; the first page, with the photo read: ' +
    Math.round(first.held) +
    ' ms)',
].filter(Boolean);
const msg =
  `${ENGINE}${SLOW > 1 ? ' slowed ' + SLOW + '×' : ''}: ` +
  rows.join('; ') +
  ' — ' +
  gates.join(', ') +
  ` — the longest waits on the page's thread: ${(await page.evaluate(() => holdLines())).join(', ')}` +
  (errors.length ? ` — errors: ${errors.join(' | ').slice(0, 200)}` : '');
console.log(process.env.GITHUB_ACTIONS ? `::notice title=Photo page (${ENGINE})::${msg}` : msg);
await teardown();
