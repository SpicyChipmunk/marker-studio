// The photo-to-page bench's shared pieces (pp-bench.mjs, pp-ab.mjs): the app's step table and Focus constants, copied and
// checked against the source (each slice hashed: a comparison refuses when the app's job-making moved), the marker
// pools, and the job ppBuildCore is sent (a copy of ppChoose + ppJobData: pp.hand false, minCount 0, Use up to 48 off).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
// ---- the app's constants and the job, copied from the source (each slice's hash in results.json; a compare refuses
// when they differ: the app's builder moved, rebase the baseline) ----
export const SRC47 = fs.readFileSync(path.join(ROOT, 'src/js/guide/47-photo-page.js'), 'utf8'),
  SRC48 = fs.readFileSync(path.join(ROOT, 'src/js/guide/48-subject.js'), 'utf8');
function slice(src, start, end) {
  const i = src.indexOf(start);
  if (i < 0) throw new Error('the app has changed: "' + start + '" not found (pp-bench.mjs needs updating)');
  const j = src.indexOf(end, i + start.length);
  return src.slice(i, j < 0 ? i + 4000 : j + end.length);
}
const SLICES = {
  steps: slice(SRC47, 'const PP_STEPS = [', 'PP_TARGETS = 500;'),
  jobData: slice(SRC47, 'function ppJobData(prep, d, ch) {', '\n}\n'),
  choose: slice(SRC47, 'function ppChoose(prep, d) {', '\n}\n'),
  sig: slice(SRC47, 'function ppSig(pool) {', '\n}\n'),
  cap: slice(SRC47, 'function ppCap(d) {', '\n}\n'),
  subConsts: slice(SRC48, 'SUB_AREA = {', 'SUB_GF_EPS = 0.004'),
  subSample: slice(
    SRC48,
    "// the photo at the model's size, as it wants it",
    '// (the working picture sent too',
  ),
  // (FINDINGS-AM 5: the working picture and sizes, mm per guide pixel, Focus's colour targets and the map's upscaling)
  prepare: slice(SRC47, 'function ppPrepare() {', '\n}\n// (v326)'),
  mmPx: slice(SRC47, 'function ppMmPx(w, h, p) {', '\n}\n'),
  focusTargets: slice(SRC48, 'function ppFocusTargets(prep) {', '\n}\n'),
  subMapUp: slice(SRC48, 'function subMapUp(m, S, rgb, w, h, r, eps) {', '\n}\n'),
};
// (the slices the bench copies: a comparison refuses when one moved. The others the bench calls live in each app, so a
// candidate that changes them is measured as it is; the report says they moved)
export const COPIED = ['steps', 'jobData', 'choose', 'sig', 'cap', 'subConsts', 'subSample', 'prepare'];
// (pp-prep.mjs's cache is made by ppPrepare: its hash there says which)
export const PREP_HASH = HASH_OF(SLICES.prepare);
function HASH_OF(v) {
  return crypto.createHash('sha256').update(v).digest('hex').slice(0, 16);
}
export const HASH = Object.fromEntries(Object.entries(SLICES).map(([k, v]) => [k, HASH_OF(v)]));
// (the values the copies below use; checked against the slices)
export const PP_STEPS = [
  { n: 'Very simple', mm: 6, cap: 60, mk: 12 },
  { n: 'Simple', mm: 4, cap: 120, mk: 18 },
  { n: 'Medium', mm: 3, cap: 220, mk: 24 },
  { n: 'Detailed', mm: 2, cap: 400, mk: 36 },
  { n: 'Very detailed', mm: 1.5, cap: 700, mk: 48 },
];
export const SUB_AREA = { even: [1, 1], sharp: [0.3, 1], calm: [0.3, 2.5] },
  SUB_GF_R = 8,
  SUB_GF_EPS = 0.004,
  PAPER = 'letter',
  PP_PAPER = [100, 0, 0];
for (const s of PP_STEPS)
  if (!SLICES.steps.includes(`{ n: '${s.n}', mm: ${s.mm}, cap: ${s.cap}, mk: ${s.mk} }`))
    throw new Error(`the app's Detail step "${s.n}" has changed: update pp-bench.mjs`);
if (
  !/sharp: \[0\.3, 1\]/.test(SLICES.subConsts) ||
  !/calm: \[0\.3, 2\.5\]/.test(SLICES.subConsts) ||
  !/SUB_GF_R = 8/.test(SLICES.subConsts)
)
  throw new Error("the app's Focus settings have changed: update pp-bench.mjs");

export const POOLS = {
  large: `[...presetMkeys(MARKER_SETS.find((s) => s.n.startsWith('Honolulu 320'))), ...presetMkeys(MARKER_SETS.find((s) => s.n === 'Sketch 72 - Set A')), ...presetMkeys(MARKER_SETS.find((s) => s.n === 'Sketch 72 - Set B'))]`,
  h24: `presetMkeys(MARKER_SETS.find((s) => s.n === 'Honolulu 24'))`,
};

// ---- the app ----
export function appWith(createApp, pool) {
  const app = createApp(),
    E = app.__eval,
    t = app.__mstest;
  t.assign.quiet();
  t.assign.resetForNewPicture();
  E(`state.owned = new Set(${POOLS[pool]})`);
  t.coll = E('sfCollection()');
  return t;
}
export function poolOf(t, f) {
  t.pp = { d: 2, f, paper: PAPER, hand: false, more: false };
  return t
    .ppPool()
    .slice()
    .sort((a, b) => (a.mkey < b.mkey ? -1 : a.mkey > b.mkey ? 1 : 0));
}
// the pool's colours as well as its names (FINDINGS-AM 5: a catalogue edit to a marker's colour is not a builder change)
export const poolLab = (pool) =>
  HASH_OF(pool.map((m) => m.mkey + ':' + Array.from(m.lab, (v) => v.toFixed(3)).join(',')).join(';'));
// the app's own file, built (the build these numbers came from)
export const BUILD = HASH_OF(fs.readFileSync(path.join(ROOT, 'index.html')));
// ppChoose + ppJobData (copies: pp.hand false, so n 0 and the step's cap; minCount 0; Use up to 48 markers off)
export function job(t, prep, d, f, pool, sig) {
  const st = PP_STEPS[d],
    mmpx = t.ppMmPx(prep.GW, prep.GH, PAPER),
    wpm = prep.w / prep.GW / mmpx,
    gpm = 1 / mmpx,
    cap = st.mk,
    focus = (f === 'sharp' || f === 'calm') && prep.sal,
    tg = focus ? t.ppFocusTargets(prep) : { l: prep.tl, w: prep.tw },
    pl = new Float32Array(pool.length * 3);
  pool.forEach((m, i) => pl.set(m.lab, i * 3));
  return {
    pid: prep.pid,
    rgb: prep.rgb.slice(),
    w: prep.w,
    h: prep.h,
    GW: prep.GW,
    GH: prep.GH,
    tl: tg.l,
    tw: tg.w,
    pl,
    n: 0,
    mkCap: cap,
    fl: null,
    ck: prep.pid + '|' + sig + '|0|' + cap + (focus ? '|focus' : ''),
    minArea: Math.pow(2.2 * st.mm * wpm, 2),
    minR: (st.mm * wpm) / 2,
    cap: st.cap,
    minCount: 0,
    paper: PP_PAPER,
    fragMin: Math.max(24, 0.5 * Math.pow((st.mm * gpm) / 2, 2)),
    sal: focus ? prep.sal : null,
    areaK: focus ? SUB_AREA[f] : [1, 1],
    bgm: null,
    _gpm: gpm,
    _mm: st.mm,
  };
}
export const sigOf = (pool) =>
  '|' +
  pool
    .map((m) => m.mkey)
    .sort()
    .join(','); // (ppSig with paletteSource as the app's default)

// the page as printed and coloured in: each section its marker's colour (white for Leave white), lines dark; and the
// line page alone. Shrunk to 1000 px on the long side (each output pixel a box of the page's), as a paletted PNG
export function pictures(b) {
  const { r, pl, GW, GH } = b,
    k = 1000 / Math.max(GW, GH),
    w = Math.round(GW * k),
    h = Math.round(GH * k),
    col = new Uint8Array(w * h),
    lin = new Uint8Array(w * h),
    pal = [
      [255, 255, 255],
      [40, 40, 40],
    ],
    idx = new Map();
  const secCol = new Int32Array(r.S + 1);
  for (let s = 1; s <= r.S; s++) {
    const mk = r.secMk[s];
    if (r.secWhite[s] || mk < 0) {
      secCol[s] = 0;
      continue;
    }
    const m = r.pick.chosen[mk];
    if (!idx.has(m)) {
      const L = pl.subarray(m * 3, m * 3 + 3);
      idx.set(m, pal.length);
      pal.push(labRgb(L[0], L[1], L[2]));
    }
    secCol[s] = idx.get(m);
  }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      // (a line anywhere in the box shows: lines stay visible when shrunk)
      const x0 = Math.floor(x / k),
        x1 = Math.min(GW, Math.floor((x + 1) / k)),
        y0 = Math.floor(y / k),
        y1 = Math.min(GH, Math.floor((y + 1) / k));
      let line = false,
        s0 = 0;
      for (let yy = y0; yy < y1 && !line; yy++)
        for (let xx = x0; xx < x1; xx++) {
          const s = r.lab[yy * GW + xx];
          if (s < 0) {
            line = true;
            break;
          }
          s0 = s;
        }
      col[y * w + x] = line ? 1 : secCol[s0] || 0;
      lin[y * w + x] = line ? 1 : 0;
    }
  return { colour: png(w, h, col, pal), lines: png(w, h, lin, pal.slice(0, 2)), w, h };
}
export function labRgb(L, a, b) {
  const fy = (L + 16) / 116,
    fx = fy + a / 500,
    fz = fy - b / 200,
    inv = (t) => (t > 0.206893 ? t * t * t : (t - 16 / 116) / 7.787),
    X = 0.95047 * inv(fx),
    Y = inv(fy),
    Z = 1.08883 * inv(fz),
    g = (v) =>
      Math.round(
        255 * Math.max(0, Math.min(1, v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055)),
      );
  return [
    g(3.2406 * X - 1.5372 * Y - 0.4986 * Z),
    g(-0.9689 * X + 1.8758 * Y + 0.0415 * Z),
    g(0.0557 * X - 0.204 * Y + 1.057 * Z),
  ];
}
export function png(w, h, data, pal) {
  const chunk = (type, body) => {
    const len = Buffer.alloc(4),
      tb = Buffer.concat([Buffer.from(type), body]),
      crc = Buffer.alloc(4);
    len.writeUInt32BE(body.length);
    crc.writeUInt32BE(zlib.crc32(tb) >>> 0);
    return Buffer.concat([len, tb, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 3; // (paletted)
  const raw = Buffer.alloc((w + 1) * h);
  for (let y = 0; y < h; y++) raw.set(data.subarray(y * w, (y + 1) * w), y * (w + 1) + 1);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('PLTE', Buffer.from(pal.flat())),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]).toString('base64');
}

// one line of index.csv (its credit column is quoted)
export function parseCsv(l) {
  const out = [];
  let cur = '',
    q = false;
  for (let i = 0; i < l.length; i++) {
    const c = l[i];
    if (q) {
      if (c === '"' && l[i + 1] === '"') ((cur += '"'), i++);
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') (out.push(cur), (cur = ''));
    else cur += c;
  }
  out.push(cur);
  return out;
}

// (FINDINGS-AQ) a page's line pixels, each with the sections within two pixels of it (the 12 places ppPageCore's tidy
// looks at): stubs, line that separates no two sections (a dangling cut, a blob); and same-marker pairs, two touching
// sections with one marker (today a rare leftover; the same-marker split, X3a, makes them on purpose), with the line
// pixels between them
const OX12 = [-1, 1, -2, 2, 0, 0, 0, 0, -1, 1, -1, 1],
  OY12 = [0, 0, 0, 0, -1, 1, -2, 2, -1, -1, 1, 1];
export function lineTally(r, GW, GH) {
  const lab = r.lab,
    mk = (s) => (r.secWhite[s] || r.secMk[s] < 0 ? -1 : r.secMk[s]),
    win = new Int32Array(12),
    pairs = new Set();
  let stubs = 0,
    splitPx = 0;
  for (let y = 0; y < GH; y++)
    for (let x = 0; x < GW; x++) {
      const p = y * GW + x;
      if (lab[p] >= 0) continue;
      let k = 0;
      for (let o = 0; o < 12; o++) {
        const xx = x + OX12[o],
          yy = y + OY12[o];
        if (xx < 0 || xx >= GW || yy < 0 || yy >= GH) continue;
        const s = lab[yy * GW + xx];
        if (s <= 0) continue;
        let i = 0;
        while (i < k && win[i] !== s) i++;
        if (i === k) win[k++] = s;
      }
      // (at the page's edge a line beside one section is the frame's, not a stub)
      const edge = x < 2 || y < 2 || x >= GW - 2 || y >= GH - 2;
      if (k <= 1 && !edge) stubs++;
      if (k === 2 && mk(win[0]) === mk(win[1])) {
        splitPx++;
        pairs.add(Math.min(win[0], win[1]) * 1048576 + Math.max(win[0], win[1]));
      }
    }
  return { stubs, splits: pairs.size, splitPx, pairs };
}
