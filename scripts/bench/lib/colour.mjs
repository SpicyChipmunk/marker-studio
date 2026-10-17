// Stage B, step 3 (scripts/bench): what the app does with the RIGHT sections. The app's own builds (buildGuide) on a
// page's truth, seeded, and the measures each family is meant to be judged by (f3191 plan, pressure-tested by Fable:
// PT-stageB.md). Sections are the truth's drawing regions; the margin and the paper inside a frame are background.
import { createApp } from '../../../test/harness.mjs';

// mulberry32 in place of Math.random around a build (Random, Balance, No repeats and the generated palettes draw from
// it); the harness shares the host's Math, so this reaches the app
export function seeded(seed, fn) {
  const r = Math.random;
  let s = seed >>> 0 || 1;
  Math.random = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  try {
    return fn();
  } finally {
    Math.random = r;
  }
}

// (expressions in the app's scope giving the mkeys owned; public presets only. 'Large mixed' stands in for a big
// two-brand collection like Ben's own, about the same size, without using his: Honolulu 320 + Copic Sketch 72 A and B)
const preset = (q) => `presetMkeys(MARKER_SETS.find((s) => ${q}))`;
export const COLLECTIONS = {
  'Large mixed': `[...${preset("s.n.startsWith('Honolulu 320')")}, ...${preset("s.n === 'Sketch 72 - Set A'")}, ...${preset("s.n === 'Sketch 72 - Set B'")}]`,
  'Honolulu 320': preset("s.n.startsWith('Honolulu 320')"),
  'Honolulu 120': preset("s.n === 'Honolulu 120'"),
  'Honolulu 24': preset("s.n === 'Honolulu 24'"),
  'Ciao 12': preset("s.n === 'Ciao 12'"),
};

// sections from a label map (truth, or the app's own): area, bbox, centroid, pixels on the picture's edge
function compsOf(labels, W, H, n) {
  const acc = [];
  for (let l = 0; l <= n; l++) acc.push({ area: 0, bpx: 0, sx: 0, sy: 0, x0: 1e9, y0: 1e9, x1: -1, y1: -1 });
  for (let p = 0; p < W * H; p++) {
    const l = labels[p];
    if (l < 1) continue;
    const a = acc[l],
      x = p % W,
      y = (p / W) | 0;
    a.area++;
    a.sx += x;
    a.sy += y;
    if (x < a.x0) a.x0 = x;
    if (x > a.x1) a.x1 = x;
    if (y < a.y0) a.y0 = y;
    if (y > a.y1) a.y1 = y;
    if (x === 0 || y === 0 || x === W - 1 || y === H - 1) a.bpx++;
  }
  return acc;
}

// the app with a collection and a page's truth as its sections. Builds run in Guide mode (counted() = !bg there, and
// the labels' signature is cached: 10-20 ms a build instead of 0.4 s), so sections under Min section size are marked
// background, as Review's rule leaves them out. bgOf(l): background by Ben's answers (margin, frame interior).
export function appOn(page, coll, o = {}) {
  const app = createApp(),
    E = app.__eval,
    t = app.__mstest;
  t.assign.quiet();
  t.assign.resetForNewPicture();
  E(`state.owned = new Set(${COLLECTIONS[coll]})`);
  t.coll = E('sfCollection()');
  const m = page.meta,
    W = m.W,
    H = m.H,
    n = o.n || m.nTruth,
    src = o.labels || page.truth;
  const labels = new Int32Array(W * H);
  for (let p = 0; p < W * H; p++) labels[p] = src[p] < 1 ? -1 : src[p];
  const acc = compsOf(labels, W, H, n),
    comps = [null];
  for (let l = 1; l <= n; l++) {
    const a = acc[l],
      tg = o.tagOf ? o.tagOf(l) : m.tag[l];
    comps.push({
      area: a.area,
      bg: tg !== 'drawing',
      bpx: a.bpx,
      cx: a.area ? a.sx / a.area : 0,
      cy: a.area ? a.sy / a.area : 0,
      h: a.y1 - a.y0,
      x0: a.x0,
      y0: a.y0,
      x1: a.x1,
      y1: a.y1,
      merged: a.area === 0,
      framed: tg === 'frameInterior',
    });
  }
  t.srcK = o.srcK || m.srcK || 1;
  t.W = W;
  t.H = H;
  t.labels = labels;
  t.comps = comps;
  t.secState = new Uint8Array(comps.length);
  t.secColor = new Array(comps.length).fill([200, 200, 200]);
  t.colored = new Uint8Array(comps.length);
  t.assign.adj = null;
  t.assign.segFresh = true;
  const mp = t.minPx();
  for (let l = 1; l < comps.length; l++)
    if (comps[l] && !comps[l].bg && comps[l].area < mp) comps[l].bg = true;
  t.assign.sfmode = 'guide';
  const tagBg = comps.map((c) => (c ? c.bg : true));
  return { app, E, t, de: E('de2000'), moods: E('MOODS'), greyC: E('GREY_C'), page, W, H, tagBg };
}

export const BASE = {
  family: 'gradient',
  gradShape: 'serpentine',
  look: 'auto',
  paletteSource: 'owned',
  palette: 'all',
  emphasis: 'neutral',
  limitN: 16,
  gradScat: 0,
  gradSeed: 0,
  balance: 'mixed',
  noRep: false,
  noAdj: false,
  balM: 'auto',
  balS: 'auto',
  balA: 'auto',
  balSeed: 0.3,
  blendMix: 'soft',
};

export function lay(a, vars, seed, keepPrev) {
  const t = a.t;
  for (const k in BASE) t.styleVars[k] = k in vars ? vars[k] : BASE[k];
  if (!keepPrev) {
    t.assign.segFresh = true;
    t.assignData = null;
  }
  const t0 = performance.now();
  let bal = null;
  seeded(seed, () => {
    t.assign.buildGuide();
    if (vars.family === 'random' && vars.balance === 'main') bal = t.balMeasure(t.balPlan());
  });
  return { ad: t.assignData, ms: performance.now() - t0, poolN: t.assign.lastPoolN, bal };
}

// which sections touch as the eye sees it: seen across at most `reach` px of line along rows and columns, every row and
// column; the count of sightings is the shared border's length (the pair's weight)
export function strictAdj(labels, W, H, reach) {
  const a = new Map();
  const add = (p, q) => {
    if (p === q) return;
    const k = p < q ? p * 1e6 + q : q * 1e6 + p;
    a.set(k, (a.get(k) || 0) + 1);
  };
  for (let y = 0; y < H; y++) {
    let last = 0,
      end = -1e9;
    for (let x = 0; x < W; x++) {
      const l = labels[y * W + x];
      if (l < 1) continue;
      if (l !== last) {
        if (last >= 1 && x - end <= reach) add(last, l);
        last = l;
      }
      end = x;
    }
  }
  for (let x = 0; x < W; x++) {
    let last = 0,
      end = -1e9;
    for (let y = 0; y < H; y++) {
      const l = labels[y * W + x];
      if (l < 1) continue;
      if (l !== last) {
        if (last >= 1 && y - end <= reach) add(last, l);
        last = l;
      }
      end = y;
    }
  }
  // (at least 3 sightings, as the app's own ADJ_SEEN: a touch at one corner point isn't touching)
  return [...a].filter(([, c]) => c >= 3).map(([k, c]) => [Math.floor(k / 1e6), k % 1e6, c]);
}
const appPairs = (adj) => {
  const out = [];
  for (const k in adj) for (const q of adj[k]) if (q > +k) out.push([+k, q, 1]);
  return out;
};

const gini = (v) => {
  if (!v.length) return 0;
  const s = v.slice().sort((x, y) => x - y),
    n = s.length,
    tot = s.reduce((a, b) => a + b, 0);
  let acc = 0;
  s.forEach((x, i) => (acc += (2 * (i + 1) - n - 1) * x));
  return tot ? acc / (n * tot) : 0;
};
const lch = (lab) => [lab[0], Math.hypot(lab[1], lab[2])];

// the measures of one build. strict: [[a, b, border]] (headline); app: the app's own adj (what noAdj and the
// Gradient's smoothing see)
export function measure(a, r, strict, vars) {
  const A = r.ad && r.ad.assign,
    order = (r.ad && r.ad.order) || [],
    comps = a.t.comps;
  if (!A) return null;
  const pairStats = (pairs) => {
    let n = 0,
      w = 0,
      same = 0,
      wSame = 0,
      same6 = 0,
      twin = 0,
      wTwin = 0,
      low = 0,
      rough = 0,
      wRough = 0;
    for (const [p, q, c] of pairs) {
      if (!A[p] || !A[q]) continue;
      n++;
      w += c;
      if (A[p].mkey === A[q].mkey) {
        same++;
        wSame += c;
        if (c >= 6) same6++;
        continue;
      }
      const d = a.de(A[p].lab, A[q].lab);
      if (d < 2.5) {
        twin++;
        wTwin += c;
      }
      if (d < 10) low++;
      if (d > 30) {
        rough++;
        wRough += c;
      }
    }
    return {
      pairs: n,
      same,
      // (on a border of 6 sightings or more: about what the app's own look across can see)
      same6,
      twin,
      low,
      rough,
      wSame: +(wSame / Math.max(1, w)).toFixed(4),
      wTwin: +(wTwin / Math.max(1, w)).toFixed(4),
      wRough: +(wRough / Math.max(1, w)).toFixed(4),
    };
  };
  const s = pairStats(strict),
    ap = pairStats(appPairs(a.t.adj));
  const per = new Map(),
    area = new Map();
  for (const l of order) {
    const k = A[l].mkey;
    per.set(k, (per.get(k) || 0) + 1);
    area.set(k, (area.get(k) || 0) + comps[l].area);
  }
  const counted = a.t.countedList().length;
  // near-identical markers among the ones used (whether they touch or not): the pool the build picked
  const usedM = [...per.keys()].map((k) => A[order.find((l) => A[l].mkey === k)]);
  let usedTwins = 0;
  for (let i = 0; i < usedM.length; i++)
    for (let j = i + 1; j < usedM.length; j++) if (a.de(usedM[i].lab, usedM[j].lab) < 2.5) usedTwins++;
  const out = {
    N: order.length,
    counted,
    unassigned: counted - order.length,
    used: per.size,
    limitN: vars.limitN || BASE.limitN,
    poolN: r.poolN,
    usedTwins,
    giniN: +gini([...per.values()]).toFixed(3),
    giniA: +gini([...area.values()]).toFixed(3),
    strict: s,
    app: ap,
    ms: Math.round(r.ms),
  };
  // along the Gradient's own order: mean ΔE where the marker changes, and steps over 30
  if ((vars.family || BASE.family) === 'gradient') {
    let k = 0,
      sum = 0,
      big = 0;
    for (let i = 1; i < order.length; i++) {
      const p = A[order[i - 1]],
        q = A[order[i]];
      if (p.mkey === q.mkey) continue;
      const d = a.de(p.lab, q.lab);
      k++;
      sum += d;
      if (d > 30) big++;
    }
    out.flow = { steps: k, meanDE: +(sum / Math.max(1, k)).toFixed(2), over30: big };
    try {
      out.appRough = a.t.grad.rough(order, A).length;
    } catch (e) {
      out.appRough = null;
    }
  }
  // a mood: share of the markers used inside its L/C box, against the share of the pool inside it
  const mood = vars.emphasis || 'neutral';
  if (mood !== 'neutral') {
    const M = a.moods[mood],
      inBox = (lab) => {
        const [L, C] = lch(lab);
        return L >= M.L[0] && L <= M.L[1] && C >= M.C[0] && C <= M.C[1];
      };
    const used = [...new Set(order.map((l) => A[l].mkey))].map((k) => A[order.find((l) => A[l].mkey === k)]);
    const poolIn = a.t.coll.filter((c) => c.lab && inBox(c.lab)).length;
    out.mood = {
      adherence: +(used.filter((m) => inBox(m.lab)).length / Math.max(1, used.length)).toFixed(3),
      poolIn,
      achievable: +Math.min(1, poolIn / Math.max(1, Math.min(out.limitN, used.length))).toFixed(3),
    };
  }
  if (r.bal)
    out.balance = {
      miss: +r.bal.miss.toFixed(3),
      f: Object.fromEntries(Object.entries(r.bal.f).map(([k, v]) => [k, +v.toFixed(3)])),
    };
  out.sig = order.map((l) => A[l].mkey).join(',');
  return out;
}
