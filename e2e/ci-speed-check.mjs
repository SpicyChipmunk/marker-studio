// CI diagnostic: how fast this machine's WebKit runs plain JavaScript, canvas work, frames, timers and a JPEG (next to Chromium's where it's
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
// (v293) the rest of what turning a photo into a guide waits on: frames, timers, making and reading back a JPEG
const waits = async () => {
  const frames = await new Promise((res) => {
    let n = 0;
    const t0 = performance.now(),
      f = () => (performance.now() - t0 < 1000 ? (n++, requestAnimationFrame(f)) : res(n));
    requestAnimationFrame(f);
  });
  const timers = await new Promise((res) => {
    let n = 0;
    const t0 = performance.now(),
      f = () => (performance.now() - t0 < 500 ? (n++, setTimeout(f, 0)) : res(n));
    setTimeout(f, 0);
  });
  const c = document.createElement('canvas');
  c.width = 2400;
  c.height = 1800;
  const g = c.getContext('2d');
  for (let i = 0; i < 400; i++) {
    g.fillStyle = 'hsl(' + ((i * 37) % 360) + ',60%,50%)';
    g.fillRect((i * 97) % 2400, (i * 53) % 1800, 120, 90);
  }
  const t0 = performance.now(),
    blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9)),
    t1 = performance.now(),
    url = await new Promise((r) => {
      const fr = new FileReader();
      fr.onload = () => r(fr.result);
      fr.readAsDataURL(blob);
    }),
    t2 = performance.now();
  await new Promise((r) => {
    const im = new Image();
    im.onload = r;
    im.onerror = r;
    im.src = url;
  });
  const t3 = performance.now();
  return {
    frames,
    timers,
    jpeg: Math.round(t1 - t0),
    read: Math.round(t2 - t1),
    decode: Math.round(t3 - t2),
    kb: Math.round(blob.size / 1024),
  };
};
const out = {};
for (const name of ['chromium', 'webkit']) {
  try {
    const b = await pw[name].launch();
    const p = await b.newPage();
    out[name] = await p.evaluate(work);
    Object.assign(out[name], await p.evaluate(waits));
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
  (w && w.frames != null
    ? `; WebKit: ${w.frames} frames a second, ${w.timers} zero-delay timers in half a second, a ${w.kb} KB JPEG made in ${w.jpeg} ms, read back in ${w.read} ms and decoded in ${w.decode} ms`
    : '') +
  (w?.error ? `; WebKit: ${w.error}` : '') +
  (c?.error ? '; Chromium not installed here' : '');
console.log(process.env.GITHUB_ACTIONS ? `::notice title=WebKit speed check::${msg}` : msg);
