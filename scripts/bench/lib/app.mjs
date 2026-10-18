// The app, headless (test/harness.mjs runs the BUILT index.html in a vm): the clean path (a download, a PDF), the
// photo path (pgFind on the 720 px copy, pgShapeOf, the app's own pgWarp, the UPSIDE enlargement, Sensitivity 6) and
// the unstraightened path (the photo as taken, findPage). Each returns what the scorer needs.
import { createApp } from '../../../test/harness.mjs';
import { apply, homog, shrink } from './photo.mjs';

export function makeApp() {
  // (DataView and ArrayBuffer for the app's EXIF reader, pgExifFocal: the harness's sandbox lacks them)
  const t = createApp({ DataView, ArrayBuffer }).__mstest;
  t.assign.quiet();
  // (a new picture's settings, as _loadImage gives them: gradArea 3 and the rest, 20-image-input)
  t.assign.resetForNewPicture();
  return t;
}

// grey as processSrc makes it (0.299/0.587/0.114, truncated), and srcColour = colourShare of the picture
function toGrey(t, input, w, h, rgb) {
  const n = w * h,
    g = new Uint8Array(n),
    d = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) {
    const r = rgb ? input[i * 3] : input[i],
      gg = rgb ? input[i * 3 + 1] : input[i],
      b = rgb ? input[i * 3 + 2] : input[i];
    d[i * 4] = r;
    d[i * 4 + 1] = gg;
    d[i * 4 + 2] = b;
    d[i * 4 + 3] = 255;
    g[i] = (r * 0.299 + gg * 0.587 + b * 0.114) | 0;
  }
  return { g, colour: t.colourShare(d, n) };
}
function fromRGBA(t, d, w, h) {
  const n = w * h,
    g = new Uint8Array(n);
  for (let i = 0, j = 0; i < n; i++, j += 4) g[i] = (d[j] * 0.299 + d[j + 1] * 0.587 + d[j + 2] * 0.114) | 0;
  return { g, colour: t.colourShare(d, n) };
}

function seg(t, gray, W, H, srcK, adaptC, colour) {
  t.adaptC = adaptC;
  t.srcK = srcK;
  t.W = W;
  t.H = H;
  // (as processSrc: the picture as it came, and a new picture's own Min section size, v318.13)
  t.srcDims = { w: Math.round(W / srcK), h: Math.round(H / srcK) };
  if (t.minAuto && t.minPosAuto) t.styleVars.minPos = t.minPosAuto();
  t.gray = gray;
  t.srcColour = colour;
  const t0 = performance.now();
  t.segment();
  const ms = performance.now() - t0;
  // (counted() reads Review's own rule only in Review: sfmode 'review', as pgProceed leaves it)
  t.assign.sfmode = 'review';
  const t1 = performance.now(),
    adj = t.adj,
    adjMs = performance.now() - t1;
  return {
    labels: t.labels,
    comps: t.comps,
    counted: new Set(t.countedList()),
    adj,
    segWarn: t.segWarn,
    faintOffer: t.faintOffer,
    colored: t.colored,
    minPx: t.minPx(),
    ms,
    adjMs,
    W,
    H,
    gray,
    srcK,
  };
}

// a picture of the person's own at inW x inH (grey or RGB), enlarged by the app's rule to the product's W x H
export function cleanPath(t, prod, adaptC = 9) {
  const m = prod.meta,
    { g, colour } = toGrey(t, prod.input, m.inW, m.inH, m.rgb);
  const gray = m.srcK > 1 ? t.grayUp(g, m.inW, m.inH, m.W, m.H) : g;
  return seg(t, gray, m.W, m.H, m.srcK, adaptC, colour);
}

// the photo path. ph: makePhoto() output (d possibly JPEG'd). page: the 1200 product (meta + truth at page size).
// o: {f35, path: 'auto' (as the app: straighten when sure) | 'none' (the photo as taken)}
export function photoPath(t, ph, page, o = {}) {
  const t0 = performance.now(),
    pm = page.meta,
    PW = pm.W,
    PH = pm.H;
  const sm = shrink(ph.W, ph.H, ph.d, 720);
  const img = (w, h, d) => ({
    width: w,
    height: h,
    naturalWidth: w,
    naturalHeight: h,
    __buf: d,
    __w: w,
    __h: h,
  });
  let f;
  try {
    f = t.pgFind(img(sm.w, sm.h, sm.d));
  } catch (e) {
    f = { tier: 'none', why: 'threw ' + e.message };
  }
  const q = f.q ? f.q.map((p) => [p[0] / sm.sc, p[1] / sm.sc]) : null;
  const diag = Math.hypot(ph.W, ph.H),
    // (the app's corners may start at any corner of the paper, or run the other way round, if the photo is turned)
    cornerErr = q
      ? Math.min(
          ...[0, 1, 2, 3].flatMap((s) =>
            [1, -1].map((dir) =>
              Math.max(
                ...q.map((p, i) => {
                  const c = ph.C[(((s + dir * i) % 4) + 4) % 4];
                  return Math.hypot(p[0] - c[0], p[1] - c[1]);
                }),
              ),
            ),
          ),
        ) / diag
      : null;
  const finder = {
    tier: f.tier,
    why: f.why || '',
    kind: f.kind || '',
    cornerErr: cornerErr == null ? null : +(100 * cornerErr).toFixed(3),
  };
  const straighten = o.path !== 'none' && q && (f.tier === 'sure' || (o.unsure && f.tier === 'unsure'));
  if (!straighten) {
    // pgProceed: the photo as taken (srcUp: 1800 x 2400 needs no enlargement), Sensitivity 9
    const { g, colour } = fromRGBA(t, ph.d, ph.W, ph.H);
    const r = seg(t, g, ph.W, ph.H, 1, 9, colour);
    // truth: each photo pixel's page truth (2x2 uniform), the table round the page its own region
    const truth = new Int32Array(ph.W * ph.H),
      sur = pm.nTruth + 1;
    for (let y = 0; y < ph.H; y++)
      for (let x = 0; x < ph.W; x++)
        truth[y * ph.W + x] = sampleTruth(page.truth, PW, PH, ph.toPage(x + 0.5, y + 0.5), sur);
    const Hp2i = homog(
        [
          [0, 0],
          [PW, 0],
          [PW, PH],
          [0, PH],
        ],
        ph.C,
      ),
      // (lengths scale by the page's mean size in the photo, not one foreshortened edge)
      kk = Math.sqrt(
        Math.abs(ph.C.reduce((s, p, i) => s + p[0] * ph.C[(i + 1) % 4][1] - ph.C[(i + 1) % 4][0] * p[1], 0)) /
          2 /
          (PW * PH),
      );
    const meta = frameMeta(pm, truth, ph.W, ph.H, (p) => apply(Hp2i, p[0], p[1]), kk, sur);
    const inQuad = (x, y) => ph.toPage(x, y) !== null;
    return { finder, path: 'none', r, truth, meta, inPage: inQuad, ms: performance.now() - t0 };
  }
  const sh = t.pgShapeOf(q, ph.W, ph.H, o.f35 || 0, null);
  const flat = t.pgWarp(img(ph.W, ph.H, ph.d), q, sh.aspect),
    ow = flat.width,
    oh = flat.height,
    wd = flat.getContext('2d').getImageData(0, 0, ow, oh).data;
  // processSrc on the flat page: enlarged to UPSIDE when small (srcUp), Sensitivity 6 after straightening (SENS_PHOTO)
  const { g, colour } = fromRGBA(t, wd, ow, oh);
  const up = Math.min(8, 2400 / Math.max(ow, oh), Math.max(1, 1600 / Math.max(ow, oh)));
  let W2 = ow,
    H2 = oh,
    gray = g,
    srcK = 1;
  if (up > 1.05) {
    W2 = Math.round(ow * up);
    H2 = Math.round(oh * up);
    gray = t.grayUp(g, ow, oh, W2, H2);
    srcK = W2 / ow;
  }
  const r = seg(t, gray, W2, H2, srcK, 6, colour);
  // truth through the app's own quad: working px -> flat px -> photo px -> page px
  const Hw2p = homog(
      [
        [0, 0],
        [ow, 0],
        [ow, oh],
        [0, oh],
      ],
      q,
    ),
    truth = new Int32Array(W2 * H2);
  for (let y = 0; y < H2; y++)
    for (let x = 0; x < W2; x++) {
      const [px, py] = apply(Hw2p, (x + 0.5) / srcK, (y + 0.5) / srcK);
      truth[y * W2 + x] = sampleTruth(page.truth, PW, PH, ph.toPage(px, py), -1);
    }
  const meta = frameMeta(
    pm,
    truth,
    W2,
    H2,
    (p) => [(p[0] * W2) / PW, (p[1] * H2) / PH],
    Math.sqrt((W2 / PW) * (H2 / PH)),
    0,
    true,
  );
  const trueAspect = sh.aspect > 1 ? PH / PW : PW / PH;
  return {
    finder: {
      ...finder,
      aspect: +sh.aspect.toFixed(4),
      measured: +sh.measured.toFixed(4),
      shape: sh.shape,
      aspectErr: +(100 * (sh.aspect / trueAspect - 1)).toFixed(2),
      flat: [ow, oh],
    },
    path: f.tier === 'sure' ? 'straightened' : 'unsure: finder corners',
    r,
    truth,
    meta,
    ms: performance.now() - t0,
  };
}
// page truth at a page point (2x2 block uniform, else -1); off the page: `off`
function sampleTruth(tr, PW, PH, q, off) {
  if (!q) return off;
  const x0 = Math.floor(q[0] - 0.5),
    y0 = Math.floor(q[1] - 0.5);
  let l0 = -2;
  for (let dy = 0; dy <= 1; dy++)
    for (let dx = 0; dx <= 1; dx++) {
      const xx = x0 + dx,
        yy = y0 + dy,
        l = xx < 0 || yy < 0 || xx >= PW || yy >= PH ? -1 : tr[yy * PW + xx];
      if (l0 === -2) l0 = l;
      else if (l0 !== l) l0 = -1;
    }
  return l0 < 0 ? -1 : l0;
}
// the page meta re-expressed in a new frame: areas counted from the mapped truth, positions through map(p), lengths x k
// (which sections touch the paper's edge stays the page's: in a photo the paper's edge isn't the picture's)
// cropCheck: sections the app's quad left (mostly) out of the flat page: under half their area there, against what the
// true page would give (larger than 200 working px; the 2x2 rule's band costs small ones more)
function frameMeta(pm, truth, W, H, map, k, sur, cropCheck) {
  const n = pm.nTruth + (sur ? 1 : 0),
    area = new Array(n + 1).fill(0);
  for (let i = 0; i < truth.length; i++) if (truth[i] > 0) area[truth[i]]++;
  const cropped = [];
  if (cropCheck)
    for (let l = 1; l <= pm.nTruth; l++) {
      const want = pm.truthArea[l] * k * k;
      if (want >= 200 && area[l] < 0.5 * want) cropped.push([l, Math.round(want)]);
    }
  const tag = pm.tag.slice();
  if (sur) tag[sur] = 'surroundings';
  const pt = (p) => (p ? map(p) : p);
  return {
    ...pm,
    W,
    H,
    nTruth: n,
    truthArea: area,
    cropped,
    tag,
    lwW: pm.lwW * k,
    hazards: pm.hazards.map((h) => ({
      ...h,
      at: pt(h.at),
      mid: pt(h.mid),
      rad: h.rad ? h.rad * k : h.rad,
      sizeW: h.sizeW ? h.sizeW * k : h.sizeW,
    })),
    markBoxes: (pm.markBoxes || []).map((b) => {
      const a = map([b[0], b[1]]),
        c = map([b[2], b[3]]);
      return [Math.min(a[0], c[0]), Math.min(a[1], c[1]), Math.max(a[0], c[0]), Math.max(a[1], c[1])];
    }),
    textBoxes: pm.textBoxes.map((b) => {
      const a = map([b.box[0], b.box[1]]),
        c = map([b.box[2], b.box[3]]);
      return {
        ...b,
        box: [Math.min(a[0], c[0]), Math.min(a[1], c[1]), Math.max(a[0], c[0]), Math.max(a[1], c[1])],
      };
    }),
  };
}
