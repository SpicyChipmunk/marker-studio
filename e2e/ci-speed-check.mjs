// CI diagnostic: how fast this machine's WebKit runs plain JavaScript and canvas work (next to Chromium's where it's
// installed), as a notice on the run's page. Turning a photo into sections takes minutes in GitHub's WebKit but about
// 2 s in WebKit itself; a loop far slower than a laptop's (about 180 ms) points to WebKit running without its JIT there.
// Usage: node e2e/ci-speed-check.mjs
import * as pw from 'playwright';

const work = () => {
  const t0 = performance.now();
  let x = 0;
  for (let i = 0; i < 3e7; i++) x = (x + i * 7) % 1000003;
  const js = performance.now() - t0;
  const c = document.createElement('canvas');
  c.width = 1200;
  c.height = 1600;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.fillStyle = '#c33';
  g.fillRect(0, 0, 1200, 1600);
  const t1 = performance.now(),
    d = g.getImageData(0, 0, 1200, 1600).data;
  let s = 0;
  for (let i = 0; i < d.length; i += 4) s += d[i];
  const px = performance.now() - t1;
  return { js: Math.round(js), px: Math.round(px), x, s };
};
const out = {};
for (const name of ['chromium', 'webkit']) {
  try {
    const b = await pw[name].launch();
    const p = await b.newPage();
    out[name] = await p.evaluate(work);
    await b.close();
  } catch (e) {
    out[name] = { error: String(e.message || e).split('\n')[0] };
  }
}
const c = out.chromium,
  w = out.webkit;
const ratio = (k) => (c && w && c[k] > 0 && w[k] >= 0 ? (w[k] / c[k]).toFixed(1) + '×' : '?');
const msg =
  `JavaScript loop: Chromium ${c?.js ?? '?'} ms, WebKit ${w?.js ?? '?'} ms (${ratio('js')}); ` +
  `reading a 1200×1600 canvas: Chromium ${c?.px ?? '?'} ms, WebKit ${w?.px ?? '?'} ms (${ratio('px')})` +
  (w?.error ? `; WebKit: ${w.error}` : '') +
  (c?.error ? '; Chromium not installed here' : '');
console.log(process.env.GITHUB_ACTIONS ? `::notice title=WebKit speed check::${msg}` : msg);
