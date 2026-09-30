// Draws the app icon: six rainbow marker strokes laid side by side, overlapping a little
// like layered alcohol-marker ink, in one tapered swoosh. Writes the SVG sources and the PNGs.
//   node scripts/make-icons.mjs      (needs the dev dependency: npm install)
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const cols = ['#ff4d7d', '#ff9442', '#ffd447', '#44dc8c', '#38b2ff', '#9466ff'];
const bez = (p, t) => { const u = 1 - t; return [0, 1].map((k) => u*u*u*p[0][k] + 3*u*u*t*p[1][k] + 3*u*t*t*p[2][k] + t*t*t*p[3][k]); };
const SPLIT = 0.42;
const A = [[48, 300], [120, 372], [206, 384], [272, 350]], B = [[272, 350], [352, 310], [412, 214], [458, 96]];
const centre = (t) => t < SPLIT ? bez(A, t / SPLIT) : bez(B, (t - SPLIT) / (1 - SPLIT));
// band width: full body, then a long taper into the flick
const W = (t) => 34 * (t < 0.16 ? 0.34 + 0.66 * Math.sin(Math.PI / 2 * t / 0.16) : Math.max(0.04, 1 - Math.pow((t - 0.16) / 0.84, 1.55) * 0.96));
const OVER = 0.74; // spacing as a share of width -> neighbours overlap by ~26%
function band(i, n, streak) {
  const N = 260, L = [], R = [], S = [];
  let start = null;
  for (let k = 0; k <= N; k++) {
    const t = k / N, p = centre(t), q = centre(Math.min(1, t + 0.002)), r = centre(Math.max(0, t - 0.002));
    let dx = q[0] - r[0], dy = q[1] - r[1]; const m = Math.hypot(dx, dy) || 1; dx /= m; dy /= m;
    const nx = -dy, ny = dx, w = W(t), o = i * w * OVER;
    const cx = p[0] + nx * o, cy = p[1] + ny * o;
    if (k === 0) start = { cx, cy, r: w / 2, dx, dy };
    if (streak != null) S.push([cx + nx * w * streak, cy + ny * w * streak]);
    L.push([cx - nx * w / 2, cy - ny * w / 2]); R.push([cx + nx * w / 2, cy + ny * w / 2]);
  }
  // rounded start cap (a marker tip set down), pointed end (flicked off)
  const cap = [];
  for (let a = 0; a <= 16; a++) { const th = Math.atan2(-start.dy, -start.dx) - Math.PI / 2 + Math.PI * a / 16; cap.push([start.cx + Math.cos(th) * start.r, start.cy + Math.sin(th) * start.r]); }
  // cap goes from R side around the back to L side
  if (streak != null) return S;
  const pts = [...L, ...R.reverse(), ...cap.reverse()];
  return pts;
}
function svg({ fit = 0.84 } = {}) {
  const n = cols.length, polys = cols.map((c, i) => band(i, n));
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; polys.flat().forEach(([x, y]) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); });
  const k = fit * 512 / Math.max(x1 - x0, y1 - y0), tx = 256 - k * (x0 + x1) / 2 + 12 * fit, ty = 256 - k * (y0 + y1) / 2 - 26 * fit;
  const paths = polys.map((pts) => 'M' + pts.map((p) => (p[0] * k + tx).toFixed(1) + ' ' + (p[1] * k + ty).toFixed(1)).join(' L') + ' Z');
  const inks = paths.map((d, i) => `<path d="${d}" fill="${cols[i]}" style="mix-blend-mode:multiply"/>`).join('');
  const line = (pts) => 'M' + pts.map((p) => (p[0] * k + tx).toFixed(1) + ' ' + (p[1] * k + ty).toFixed(1)).join(' L');
  const streaks = cols.map((c, i) => [[-0.28, 0.35, 1.3], [0.05, 0.16, 0.8], [0.3, 0.12, 0.7]].map(([o, a, sw]) => `<path d="${line(band(i, n, o))}" fill="none" stroke="#fff" stroke-opacity="${a}" stroke-width="${sw * k}" stroke-linecap="round"/>`).join('')).join('');
  const edges = `<g clip-path="url(#clip)">${streaks}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <radialGradient id="bg" cx="40%" cy="36%" r="82%"><stop offset="0" stop-color="#2b1e48"/><stop offset=".52" stop-color="#15101f"/><stop offset="1" stop-color="#07070a"/></radialGradient>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="${18 * fit}"/></filter>
    <linearGradient id="gloss" gradientUnits="userSpaceOnUse" x1="0" y1="${ty + k * 200}" x2="0" y2="${ty + k * 400}"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <clipPath id="clip">${paths.map((d) => `<path d="${d}"/>`).join('')}</clipPath>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <g filter="url(#glow)" opacity=".55">${paths.map((d, i) => `<path d="${d}" fill="${cols[i]}"/>`).join('')}</g>
  <g style="isolation:isolate">${inks}</g>
  ${edges}
</svg>`;
}
const any = svg({ fit: 0.82 }), mask = svg({ fit: 0.555 }); // maskable: stays inside the 80% safe circle
mkdirSync(join(ROOT, 'src/assets'), { recursive: true });
writeFileSync(join(ROOT, 'src/assets/icon.svg'), any);
writeFileSync(join(ROOT, 'src/assets/icon-maskable.svg'), mask);
const sized = (s, n) => s.replace('width="512" height="512"', `width="${n}" height="${n}"`);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 512, height: 512 } });
for (const [src, n, out] of [[any, 512, 'icon-512.png'], [any, 192, 'icon-192.png'], [any, 180, 'apple-touch-icon.png'], [mask, 512, 'icon-maskable-512.png']]) {
  await p.setContent(`<html><body style="margin:0">${sized(src, n)}</body></html>`);
  await p.screenshot({ path: join(ROOT, out), clip: { x: 0, y: 0, width: n, height: n } });
  console.log('wrote', out);
}
await b.close();
