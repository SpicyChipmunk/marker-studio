// A page spec -> a Design (drawn, text applied, coloured in) -> one product per size: the picture as it reaches the app
// (grey or RGBA at its own size) and the truth at the app's working size, with tags, pairs, ambiguity and the hazards'
// positions in working pixels. Products are cached (gzip) outside the repo: they are a pure function of the spec.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import * as ST from './styles.mjs';
import { rng } from './raster.mjs';
import { Design, appSize, radii, radius0, boxDown, truthDown, labelPaper } from './design.mjs';
import { textMask } from './browser.mjs';

export const GEN_VERSION = 'bench-gen-8';
const STYLES = {
  neuro: ST.neuro,
  mandala: ST.mandala,
  tessellation: ST.tessellation,
  mosaic: ST.mosaic,
  zentangle: ST.zentangle,
  botanical: ST.botanical,
  cartoon: ST.cartoon,
  stainedGlass: ST.stainedGlass,
  waveBands: ST.waveBands,
  doodles: ST.doodles,
};

const hash = (o) => crypto.createHash('sha1').update(JSON.stringify(o)).digest('hex').slice(0, 16);

// ---- a tiny container: JSON header + typed arrays, gzipped
export function save(file, meta, arrays) {
  const head = {
    meta,
    arrays: Object.entries(arrays).map(([k, a]) => ({ k, t: a.constructor.name, n: a.length })),
  };
  const hb = Buffer.from(JSON.stringify(head));
  const parts = [
    Buffer.alloc(4),
    hb,
    ...Object.values(arrays).map((a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength)),
  ];
  parts[0].writeUInt32LE(hb.length, 0);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file + '.tmp', zlib.gzipSync(Buffer.concat(parts), { level: 1 }));
  fs.renameSync(file + '.tmp', file);
}
export function load(file) {
  const b = zlib.gunzipSync(fs.readFileSync(file)),
    hl = b.readUInt32LE(0),
    head = JSON.parse(b.subarray(4, 4 + hl).toString());
  let o = 4 + hl;
  const T = { Uint8Array, Int32Array, Float32Array, Uint8ClampedArray };
  const arrays = {};
  for (const a of head.arrays) {
    const C = T[a.t],
      bytes = a.n * C.BYTES_PER_ELEMENT,
      buf = new ArrayBuffer(bytes);
    new Uint8Array(buf).set(b.subarray(o, o + bytes));
    arrays[a.k] = new C(buf);
    o += bytes;
  }
  return { meta: head.meta, ...arrays };
}

// ---- text: render-only ink in the hi-res render (letters are not sections; their counters aren't either: answer 3)
async function applyText(R, specs, cacheDir) {
  const boxes = [];
  for (const spec of specs) {
    const key = hash({ spec, S: R.S, v: 1 }),
      f = path.join(cacheDir, 'text', key + '.gz');
    let m;
    if (fs.existsSync(f)) {
      const c = load(f);
      m = { ...c.meta, alpha: c.alpha };
    } else {
      m = await textMask(spec, R.S);
      save(f, { w: m.w, h: m.h, x0: m.x0, y0: m.y0 }, { alpha: m.alpha });
    }
    R.applyMask(m.x0, m.y0, m.w, m.h, m.alpha, spec.grey || 0);
    // counters: closed holes in the glyphs (paper not reaching the block's edge)
    const ink = new Uint8Array(m.w * m.h);
    let x0 = 1e9,
      y0 = 1e9,
      x1 = -1,
      y1 = -1;
    for (let y = 0; y < m.h; y++)
      for (let x = 0; x < m.w; x++)
        if (m.alpha[y * m.w + x] > 127) {
          ink[y * m.w + x] = 1;
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
    const L = labelPaper(ink, m.w, m.h),
      border = new Set();
    for (let x = 0; x < m.w; x++) {
      border.add(L.lab[x]);
      border.add(L.lab[(m.h - 1) * m.w + x]);
    }
    for (let y = 0; y < m.h; y++) {
      border.add(L.lab[y * m.w]);
      border.add(L.lab[y * m.w + m.w - 1]);
    }
    let counters = 0;
    for (let l = 1; l <= L.n; l++) if (!border.has(l) && L.area[l] >= R.S * R.S) counters++;
    const S = R.S;
    boxes.push({
      role: spec.kind,
      str: spec.str,
      grey: spec.grey || 0,
      angle: spec.angle || 0,
      counters,
      box:
        x1 < 0 ? null : [(m.x0 + x0) / S - 3, (m.y0 + y0) / S - 3, (m.x0 + x1) / S + 3, (m.y0 + y1) / S + 3],
    });
  }
  return boxes;
}

// ---- colouring in (answer 4: a partly coloured page). Port of the preview's colour_in: whole sections in marker
// colours with a streaky texture, a 1 px bleed, one section run over its line by 5 px, a lighter rim on some.
const MARKERS = [
  [236, 118, 150],
  [116, 168, 232],
  [250, 206, 84],
  [112, 192, 142],
  [176, 124, 206],
  [244, 150, 92],
  [90, 190, 190],
  [232, 96, 96],
  [160, 200, 110],
  [250, 170, 190],
];
function colourIn(D, o) {
  const R = D.R,
    { HW, HH, S } = R,
    N = HW * HH,
    r = rng(o.seed || 7),
    L = D.labelsAt(D.baseR),
    { tag } = D.tags(L);
  const share = o.share == null ? 0.3 : o.share,
    bleed = o.bleed == null ? 1 : o.bleed;
  const ids = [];
  for (let l = 1; l <= L.n; l++) if (L.area[l] / (S * S) >= 400 && tag[l] === 'drawing') ids.push(l);
  const chosen = ids.filter(() => r() < share);
  const bb = new Map(chosen.map((l) => [l, [HW, HH, -1, -1]]));
  for (let y = 0; y < HH; y++)
    for (let x = 0; x < HW; x++) {
      const b = bb.get(L.lab[y * HW + x]);
      if (b) {
        if (x < b[0]) b[0] = x;
        if (y < b[1]) b[1] = y;
        if (x > b[2]) b[2] = x;
        if (y > b[3]) b[3] = y;
      }
    }
  const layer = new Uint8Array(N * 3).fill(255);
  let overrun = null;
  for (const l of chosen) {
    const col = MARKERS[(r() * MARKERS.length) | 0],
      b = bb.get(l),
      areaPg = L.area[l] / (S * S);
    let k = bleed;
    if (!overrun && areaPg > 6000 && areaPg < 40000) {
      k = 5;
      overrun = { label: l, px: 5 };
    }
    const kh = Math.round(k * S),
      pad = kh + 2,
      x0 = Math.max(0, b[0] - pad),
      y0 = Math.max(0, b[1] - pad),
      x1 = Math.min(HW - 1, b[2] + pad),
      y1 = Math.min(HH - 1, b[3] + pad);
    const w = x1 - x0 + 1,
      h = y1 - y0 + 1,
      m = new Uint8Array(w * h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) m[y * w + x] = L.lab[(y0 + y) * HW + x0 + x] === l ? 1 : 0;
    const dil = kh ? squareMorph(m, w, h, kh, 1) : m,
      er = squareMorph(m, w, h, 2 * S, 0);
    const ang = r() * Math.PI,
      per = 3.5 + 2 * r(),
      ph = r() * 6,
      rim = r() < 0.35 && r() < 0.5,
      ca = Math.cos(ang),
      sa = Math.sin(ang);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (!dil[i]) continue;
        const proj = ((x0 + x) / S) * ca + ((y0 + y) / S) * sa;
        const stripes = 0.5 + 0.5 * Math.sin((proj / per) * Math.PI + ph);
        let tex = 1 - 0.07 * stripes - 0.05 * (Math.sin(proj / 23 + 1) > 0.6 ? 1 : 0);
        if (rim && m[i] && !er[i]) tex += 0.35;
        tex = Math.min(1.2, Math.max(0, tex));
        const p = ((y0 + y) * HW + x0 + x) * 3;
        for (let c = 0; c < 3; c++) {
          const v = Math.round(col[c] * tex + (1 - tex) * 255);
          if (v < layer[p + c]) layer[p + c] = Math.max(0, v);
        }
      }
  }
  const rgb = new Uint8Array(N * 3),
    dk = R.dark;
  for (let p = 0; p < N; p++) {
    const g = dk[p] / 255;
    for (let c = 0; c < 3; c++) rgb[p * 3 + c] = Math.round(layer[p * 3 + c] * g);
  }
  D.rgb = rgb;
  D.colouredBase = new Set(chosen);
  return { kind: 'coloured', share, n: chosen.length, bleedPx: bleed, overrun };
}
// square dilation (on = 1) or erosion (on = 0) by k px, separable
function squareMorph(m, w, h, k, dilate) {
  const a = new Uint8Array(w * h),
    b = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let v = dilate ? 0 : 1;
      for (let d = -k; d <= k; d++) {
        const xx = x + d;
        const s = xx < 0 || xx >= w ? (dilate ? 0 : 1) : m[y * w + xx];
        if (dilate ? s : !s) {
          v = dilate ? 1 : 0;
          break;
        }
      }
      a[y * w + x] = v;
    }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let v = dilate ? 0 : 1;
      for (let d = -k; d <= k; d++) {
        const yy = y + d;
        const s = yy < 0 || yy >= h ? (dilate ? 0 : 1) : a[yy * w + x];
        if (dilate ? s : !s) {
          v = dilate ? 1 : 0;
          break;
        }
      }
      b[y * w + x] = v;
    }
  return b;
}

// ---- the design (hi-res), built in memory
export async function buildDesign(spec, cacheDir) {
  const t0 = Date.now();
  // (pages are paper-shaped: Letter 1200 x 1553 unless the spec says A4, 1200 x 1697)
  const { R } = STYLES[spec.style](spec.seed, { H: 1553, ...(spec.p || {}) });
  const textBoxes = await applyText(R, R.textSpecs || [], cacheDir);
  const D = new Design(R, spec);
  D.baseR = radii(R, R.W).r1;
  D.textBoxes = textBoxes;
  D.extraHazards = [];
  if (spec.colour) D.extraHazards.push(colourIn(D, spec.colour));
  D.ms = Date.now() - t0;
  return D;
}

// hazards with positions, mapped to working pixels (k = working px per design px)
function placeHazards(hz, k) {
  const pt = (p) => (p ? [p[0] * k, p[1] * k] : null);
  return hz.map((h) => {
    const o = { ...h };
    delete o.g;
    if (h.at) o.at = pt(h.at);
    if (h.g && h.g.mid) o.mid = pt(h.g.mid);
    if (h.rad) o.rad = h.rad * k;
    if (h.size) o.sizeW = h.size * k;
    delete o.pairs;
    return o;
  });
}

// ---- one size: input picture (inW x inH, grey or RGBA) + truth at the working size
export function deriveSize(D, sizeW) {
  const R = D.R,
    inW0 = sizeW,
    inH0 = Math.round((sizeW * R.H) / R.W),
    A = appSize(inW0, inH0);
  // (one truth per page: the sections don't change with the download size; what a size can't show is the ambiguity
  // set's business, at the size's own stronger closing r2)
  const { r2 } = radii(R, A.inW),
    L = D.labelsAt(D.baseR),
    L2 = D.labelsAt(r2);
  const { tag, edge, frameLabel } = D.tags(L);
  const pairs = D.pairs(L),
    amb = D.ambiguous(L, L2),
    ambPairs = D.ambiguousPairs(L, D.labelsAt(radius0(D.baseR))),
    col = D.colouredIn(L);
  const truth = truthDown(L.lab, R.HW, R.HH, A.W, A.H);
  const input = D.rgb
    ? boxDown(D.rgb, R.HW, R.HH, A.inW, A.inH, 3)
    : boxDown(R.dark, R.HW, R.HH, A.inW, A.inH, 1);
  const k = A.W / R.W,
    aK = (A.W / R.HW) * (A.H / R.HH);
  const hazards = placeHazards([...R.hazards, ...D.extraHazards], k);
  // render-only patches (hatching, stipple) as the truth sections they lie in
  [...R.hazards, ...D.extraHazards].forEach((h, i) => {
    if (!h.pts) return;
    const c = new Map();
    for (const [x, y] of h.pts) {
      const l =
        L.lab[Math.min(R.HH - 1, Math.round(y * R.S)) * R.HW + Math.min(R.HW - 1, Math.round(x * R.S))];
      if (l > 0) c.set(l, (c.get(l) || 0) + 1);
    }
    hazards[i].labels = [...c].filter(([, n]) => n >= 2).map(([l]) => l);
    delete hazards[i].pts;
  });
  pairs.forEach((p, i) => {
    const h = hazards[R.hazards.indexOf(p.hazard)];
    if (h) h.pairs = p.pairs;
  });
  const meta = {
    id: D.meta.id,
    set: D.meta.set,
    style: D.meta.style,
    family: D.meta.family,
    size: sizeW,
    inW: A.inW,
    inH: A.inH,
    W: A.W,
    H: A.H,
    srcK: A.srcK,
    lw: R.lw,
    lwW: R.lw * k,
    r1: D.baseR / R.S,
    r2: r2 / R.S,
    rgb: !!D.rgb,
    nTruth: L.n,
    truthArea: L.area.map((a) => +(a * aK).toFixed(1)),
    tag,
    edgeTouch: [...edge],
    frameLabel,
    ambiguous: [...amb],
    slivers: [...amb.slivers],
    ambPairs,
    coloured: [...col],
    hazards,
    textBoxes: D.textBoxes.filter((b) => b.box).map((b) => ({ ...b, box: b.box.map((v) => v * k) })),
    markBoxes: D.markBoxes || [],
    envelope: !!R.envelope,
    marginRule: R.marginRule,
  };
  return { meta, input, truth };
}

// a spec's products for the given sizes, from the cache or built (and cached)
export async function products(spec, sizes, cacheDir, log = () => {}) {
  const key = hash({ spec, v: GEN_VERSION }),
    out = {},
    need = [];
  for (const s of sizes) {
    const f = path.join(cacheDir, 'pages', `${spec.id}-${s}-${key}.gz`);
    if (fs.existsSync(f)) out[s] = load(f);
    else need.push([s, f]);
  }
  if (need.length) {
    const D = await buildDesign(spec, cacheDir);
    for (const [s, f] of need) {
      const t0 = Date.now(),
        p = deriveSize(D, s);
      save(f, p.meta, { input: p.input, truth: p.truth });
      out[s] = p;
      log(
        `  built ${spec.id} @${s}: truth ${p.meta.nTruth}, ambiguous ${p.meta.ambiguous.length} (${Date.now() - t0} ms)`,
      );
    }
    log(`  design ${spec.id}: ${D.ms} ms`);
  }
  return out;
}
