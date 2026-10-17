// The printed set (scripts/bench, step 4): a bench page laid on a Letter sheet with four registration squares and a
// page code, as one drawing whose truth is made by the same rules as every other page. The squares let a photo of the
// printed sheet be mapped back to the sheet exactly, without the app's page finder, so the finder can be judged.
import { Raster, rng } from './raster.mjs';
import { Design, radii } from './design.mjs';

export const PAPER = { w: 215.9, h: 279.4 }; // Letter, mm
export const SQ = { size: 5, hole: 2, inset: 10 }; // squares: 5 mm, a 2 mm hole, centres 10 mm from the edges
export const BITS = { y: 279.4 - 10, xs: [80, 95, 110, 125], size: 3 }; // page code: 3 bits of n-1 and an odd-parity bit
export const GAP = 10; // the drawing keeps 10 mm from the squares
const PX = 1200 / PAPER.w; // page px per mm (the product is 1200 x 1553, like every Letter page)

export const squareCentres = () => [
  [SQ.inset, SQ.inset],
  [PAPER.w - SQ.inset, SQ.inset],
  [PAPER.w - SQ.inset, PAPER.h - SQ.inset],
  [SQ.inset, PAPER.h - SQ.inset],
];
export const codeBits = (n) => {
  const v = (n - 1) & 7,
    b = [(v >> 2) & 1, (v >> 1) & 1, v & 1];
  // (odd parity: every page has at least one mark, so a code that can't be read never looks like page 1)
  return [...b, 1 - ((b[0] + b[1] + b[2]) & 1)];
};

// D: a built Design (buildDesign). n: the page's number in the set (1-8). Returns {D: the sheet's Design, layout}
export function onPaper(D, n, meta) {
  const R = D.R,
    S = R.S,
    W = 1200,
    H = Math.round(PAPER.h * PX);
  const P = new Raster(W, H, S);
  // the drawing: as large as fits inside the squares' band, centred
  const m0 = SQ.inset + SQ.size / 2 + GAP,
    boxW = PAPER.w - 2 * m0,
    boxH = PAPER.h - 2 * m0;
  const sc = Math.min(boxW / R.W, boxH / R.H),
    dw = R.W * sc,
    dh = R.H * sc; // mm per design px
  const rect = { x: (PAPER.w - dw) / 2, y: (PAPER.h - dh) / 2, w: dw, h: dh };
  const kp = sc * PX,
    ox = rect.x * PX,
    oy = rect.y * PX; // design page px -> sheet page px
  const hx0 = Math.round(ox * S),
    hy0 = Math.round(oy * S),
    hw = Math.round(dw * PX * S),
    hh = Math.round(dh * PX * S);
  for (let y = 0; y < hh; y++) {
    const sy = Math.min(R.HH - 1, Math.floor(((y + 0.5) * R.HH) / hh));
    for (let x = 0; x < hw; x++) {
      const sx = Math.min(R.HW - 1, Math.floor(((x + 0.5) * R.HW) / hw)),
        s = sy * R.HW + sx,
        p = (hy0 + y) * P.HW + hx0 + x;
      P.clean[p] = R.clean[s];
      P.dark[p] = R.dark[s];
    }
  }
  const pt = (p) => (p ? [ox + p[0] * kp, oy + p[1] * kp] : p);
  // registration squares: ink in truth whole; printed with a white hole (render only), which no drawing has
  const mmPoly = (cx, cy, s) => [
    [(cx - s / 2) * PX, (cy - s / 2) * PX],
    [(cx + s / 2) * PX, (cy - s / 2) * PX],
    [(cx + s / 2) * PX, (cy + s / 2) * PX],
    [(cx - s / 2) * PX, (cy + s / 2) * PX],
  ];
  for (const [cx, cy] of squareCentres()) {
    P.fillPoly(mmPoly(cx, cy, SQ.size), { cleanOnly: true });
    const a = SQ.size / 2,
      b = SQ.hole / 2;
    for (const [x0, y0, x1, y1] of [
      [-a, -a, a, -b],
      [-a, b, a, a],
      [-a, -b, -b, b],
      [b, -b, a, b],
    ])
      P.fillPoly(
        [
          [(cx + x0) * PX, (cy + y0) * PX],
          [(cx + x1) * PX, (cy + y0) * PX],
          [(cx + x1) * PX, (cy + y1) * PX],
          [(cx + x0) * PX, (cy + y1) * PX],
        ],
        { renderOnly: true },
      );
  }
  const bits = codeBits(n);
  bits.forEach((bit, i) => {
    if (bit) P.fillPoly(mmPoly(BITS.xs[i], BITS.y, BITS.size));
  });
  // the drawing's records, moved onto the sheet
  P.lw = R.lw * kp;
  P.hazards = R.hazards.map((h) => {
    const o = { ...h };
    if (h.at) o.at = pt(h.at);
    if (h.rad) o.rad = h.rad * kp;
    if (h.size) o.size = h.size * kp;
    if (h.g && h.g.mid) o.g = { ...h.g, mid: pt(h.g.mid) };
    if (h.pts) o.pts = h.pts.map(pt);
    return o;
  });
  P.sepStrokes = R.sepStrokes.map((s) => ({
    pts: s.pts.map(pt),
    lw: s.lw * kp,
    hazard: P.hazards[R.hazards.indexOf(s.hazard)] || s.hazard,
  }));
  if (R.frameBox) {
    const f = R.frameBox,
      a = pt([f.x0, f.y0]),
      b = pt([f.x1, f.y1]);
    P.frameBox = { x0: a[0], y0: a[1], x1: b[0], y1: b[1] };
  }
  // margin: the sheet's paper outside the drawing's rectangle and touching the sheet's edge (an edge-to-edge drawing's
  // edge shapes join it on paper: printed, they are open, not shapes)
  const ex0 = ox,
    ey0 = oy,
    ex1 = ox + dw * PX,
    ey1 = oy + dh * PX;
  P.envelope = { sdf: (x, y) => Math.max(ex0 - x, x - ex1, ey0 - y, y - ey1), box: [ex0, ey0, ex1, ey1] };
  P.marginRule = 'envelope';
  const D2 = new Design(P, meta);
  D2.baseR = radii(P, P.W).r1;
  D2.textBoxes = (D.textBoxes || []).map((b) => ({
    ...b,
    box: b.box ? [ox + b.box[0] * kp, oy + b.box[1] * kp, ox + b.box[2] * kp, oy + b.box[3] * kp] : null,
  }));
  D2.extraHazards = [];
  // (the squares and the code: their holes and edges are the printed set's own marks, not the page's)
  D2.markBoxes = [
    ...squareCentres().map(([x, y]) => [x, y, SQ.size]),
    ...BITS.xs.map((x) => [x, BITS.y, BITS.size]),
  ].map(([x, y, s]) => [(x - s) * PX, (y - s) * PX, (x + s) * PX, (y + s) * PX]);
  return {
    D: D2,
    layout: {
      n,
      bits,
      paper: PAPER,
      squares: squareCentres(),
      squareSize: SQ.size,
      hole: SQ.hole,
      bitsAt: BITS.xs.map((x) => [x, BITS.y]),
      bitSize: BITS.size,
      drawing: rect,
      pxPerMm: PX,
      W,
      H,
    },
  };
}
