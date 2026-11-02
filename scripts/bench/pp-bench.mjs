#!/usr/bin/env node
// The photo-to-page bench, step 3 of 3 (Claude's plan v4, decisions 76-82, 99): the app's own builder (ppBuildCore, the
// built index.html headless) on the bench photos' working pictures (pp-prep.mjs) at each Detail step, Even and Focus's
// two modes (the subject maps from pp_maps.py through the app's own subMapUp), measured against Open Images' outlines
// (pp_masks.py): spill, edge-following, likeness and the printed-page measures; per photo, checkpointed; a baseline
// written or compared with (the rule: decision 79 with FINDINGS-Y/AL's amendments).
//
//   node scripts/bench/pp-bench.mjs --cache <cache> --photos <bench-photos> --set TUNE [--n 100 --seed <idea name>]
//        [--modes even,sharp,calm] [--steps 0,1,2,3,4] [--pool large|h24] [--map subject-te4] [--workers 2]
//        [--tag <run name>] [--compare <run tag>]
//
// Writes <cache>/runs/<tag>/head.json (what made the run: build, settings, the app's hashes, the pool's colours, the map's
// model), <id>.json (one per photo), results.json and report.md; and one line per comparison in <cache>/runs/LOG.md.
// A run folder belongs to one head: a tag made by another build or other settings is refused (give it another --tag;
// the default tag carries the build). --compare refuses a baseline made on another set, steps, modes, pool or map, one
// whose builder copies moved, and a run or baseline whose same-page-twice check failed. Nothing goes into the repo.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createApp } from '../../test/harness.mjs';
import {
  HASH,
  COPIED,
  BUILD,
  PREP_HASH,
  PP_STEPS,
  SUB_GF_R,
  SUB_GF_EPS,
  POOLS,
  appWith,
  poolOf,
  poolLab,
  job,
  sigOf,
  pictures,
  parseCsv,
  lineTally,
} from './lib/pp.mjs';

const FLOOR = 0.1; // (decisions 109, 110, 112: points of spill or edge-following)
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const argv = process.argv.slice(2),
  arg = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d),
  flag = (k) => argv.includes(k);
const CACHE = arg('--cache'),
  PHOTOS = arg('--photos'),
  SET = arg('--set', 'TUNE'),
  NSUB = +arg('--n', 0),
  SEED = arg('--seed', ''),
  MODES = arg('--modes', 'even,sharp,calm').split(','),
  STEPS = arg('--steps', '0,1,2,3,4').split(',').map(Number),
  POOL = arg('--pool', 'large'),
  MAP = arg('--map', 'subject-te4'),
  WORKERS = +arg('--workers', 2),
  SHARD = arg('--shard', null),
  // (FINDINGS-AP 6) an experiment's settings, bench-only: --x lam=0.1,k=0.35 reaches the builder as job.x (the job is the
  // bench's frozen copy of ppJobData, so a setting put there by a candidate's own ppJobData would never arrive)
  XOPT = arg('--x')
    ? Object.fromEntries(
        arg('--x')
          .split(',')
          .map((kv) => kv.split('='))
          .map(([k, v]) => [k, isNaN(+v) ? v : +v]),
      )
    : null,
  // (a deliberate change to a slice the bench copies, made with the copy in lib/pp.mjs updated in the same commit)
  ACCEPT = (arg('--accept-drift') || '').split(',').filter(Boolean),
  TAG = arg(
    '--tag',
    `${SET}-${MODES.join('+')}-${POOL}${NSUB ? `-n${NSUB}-${SEED}` : ''}${arg('--x') ? '-x' + arg('--x').replace(/[=,]/g, '') : ''}-${BUILD.slice(0, 8)}`,
  ),
  RUN = path.join(CACHE || '.', 'runs', TAG);
if (!CACHE || !PHOTOS) {
  console.error(
    'usage: pp-bench.mjs --cache <cache> --photos <bench-photos> --set TUNE|HELD|FINAL [options]',
  );
  process.exit(2);
}

// ---- photos ----
function readIndex() {
  const lines = fs.readFileSync(path.join(PHOTOS, 'index.csv'), 'utf8').split(/\r?\n/).filter(Boolean),
    head = parseCsv(lines[0]);
  return lines.slice(1).map((l) => Object.fromEntries(parseCsv(l).map((v, i) => [head[i], v])));
}
const hashOf = (s) => crypto.createHash('sha256').update(s).digest('hex');
function chosenIds() {
  let rows = readIndex().filter(
    (r) => r.set === SET && fs.existsSync(path.join(CACHE, 'prep', r.id + '.json')),
  );
  if (NSUB) rows = rows.sort((a, b) => (hashOf(SEED + a.id) < hashOf(SEED + b.id) ? -1 : 1)).slice(0, NSUB); // (a fresh subset per idea)
  return rows;
}

// ---- measures ----
function labOf(r, g, b) {
  const f = (v) => ((v /= 255) <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)),
    R = f(r),
    G = f(g),
    B = f(b),
    X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047,
    Y = R * 0.2126 + G * 0.7152 + B * 0.0722,
    Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883,
    q = (v) => (v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116);
  return [116 * q(Y) - 16, 500 * (q(X) - q(Y)), 200 * (q(Y) - q(Z))];
}
function lineDist(lab, W, H) {
  // (chamfer 3-4 distance to the nearest line pixel, in guide pixels)
  const INF = 1e9,
    d = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) d[i] = lab[i] < 0 ? 0 : INF;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      let v = d[i];
      if (x > 0) v = Math.min(v, d[i - 1] + 3);
      if (y > 0) {
        v = Math.min(v, d[i - W] + 3);
        if (x > 0) v = Math.min(v, d[i - W - 1] + 4);
        if (x < W - 1) v = Math.min(v, d[i - W + 1] + 4);
      }
      d[i] = v;
    }
  for (let y = H - 1; y >= 0; y--)
    for (let x = W - 1; x >= 0; x--) {
      const i = y * W + x;
      let v = d[i];
      if (x < W - 1) v = Math.min(v, d[i + 1] + 3);
      if (y < H - 1) {
        v = Math.min(v, d[i + W] + 3);
        if (x < W - 1) v = Math.min(v, d[i + W + 1] + 4);
        if (x > 0) v = Math.min(v, d[i + W - 1] + 4);
      }
      d[i] = v;
    }
  for (let i = 0; i < W * H; i++) d[i] /= 3;
  return d;
}
// wobble (for contour smoothing, C8): each section's outer outline traced (Moore neighbours) and its length against the
// same outline simplified by Douglas-Peucker at 2 guide pixels; summed over the page. 1: lines as smooth as they can be
// at that tolerance; higher: wigglier lines.
function wobble(lab, W, H, S, first) {
  const DX = [1, 1, 0, -1, -1, -1, 0, 1],
    DY = [0, 1, 1, 1, 0, -1, -1, -1];
  let raw = 0,
    simp = 0;
  for (let s = 1; s <= S; s++) {
    const f = first[s];
    if (f < 0) continue;
    const sx = f % W,
      sy = (f / W) | 0,
      pts = [[sx, sy]];
    let x = sx,
      y = sy,
      dir = 7,
      n = 0;
    // (Moore tracing; the start is the section's first pixel in reading order, so its west and north are outside)
    for (;;) {
      let found = false;
      for (let k = 0; k < 8; k++) {
        const d = (dir + 6 + k) % 8,
          nx = x + DX[d],
          ny = y + DY[d];
        if (nx >= 0 && ny >= 0 && nx < W && ny < H && lab[ny * W + nx] === s) {
          x = nx;
          y = ny;
          dir = d;
          found = true;
          break;
        }
      }
      if (!found || (x === sx && y === sy) || ++n > 4 * W * H) break;
      pts.push([x, y]);
    }
    if (pts.length < 8) continue;
    let L = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i],
        b = pts[(i + 1) % pts.length];
      L += Math.hypot(a[0] - b[0], a[1] - b[1]);
    }
    // (Douglas-Peucker on the closed outline: split at the point farthest from the first)
    let far = 0,
      fd = -1;
    for (let i = 1; i < pts.length; i++) {
      const d = Math.hypot(pts[i][0] - pts[0][0], pts[i][1] - pts[0][1]);
      if (d > fd) ((fd = d), (far = i));
    }
    const keep = new Uint8Array(pts.length + 1),
      ring = pts.concat([pts[0]]);
    keep[0] = keep[far] = keep[pts.length] = 1;
    const stack = [
      [0, far],
      [far, pts.length],
    ];
    while (stack.length) {
      const [a, b] = stack.pop(),
        [ax, ay] = ring[a],
        [bx, by] = ring[b],
        len = Math.hypot(bx - ax, by - ay) || 1;
      let mi = -1,
        md = 2;
      for (let i = a + 1; i < b; i++) {
        const d = Math.abs((bx - ax) * (ay - ring[i][1]) - (ax - ring[i][0]) * (by - ay)) / len;
        if (d > md) ((md = d), (mi = i));
      }
      if (mi > 0) {
        keep[mi] = 1;
        stack.push([a, mi], [mi, b]);
      }
    }
    let Ls = 0,
      prev = 0;
    for (let i = 1; i <= pts.length; i++)
      if (keep[i]) {
        Ls += Math.hypot(ring[i][0] - ring[prev][0], ring[i][1] - ring[prev][1]);
        prev = i;
      }
    raw += L;
    simp += Ls;
  }
  return simp ? raw / simp : null;
}
function measures(t, prep, jb, r, objs, workLab, gradL) {
  const W = prep.GW,
    H = prep.GH,
    N = W * H,
    lab = r.lab,
    S = r.S,
    gpm = jb._gpm,
    out = {};
  // sections: area, boundary pixels (next to a line or another section), slits
  const first = new Int32Array(S + 1).fill(-1),
    area = new Float64Array(S + 1),
    perim = new Float64Array(S + 1);
  let lines = 0,
    slits = 0;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x,
        s = lab[i];
      if (s < 0) {
        lines++;
        continue;
      }
      if (!area[s]) first[s] = i;
      area[s]++;
      let nl = 0,
        edge = false;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const xx = x + dx,
            yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          const v = lab[yy * W + xx];
          if (v < 0) nl++;
          if (v !== s && (dx === 0 || dy === 0)) edge = true;
        }
      if (edge) perim[s]++;
      if (nl >= 6) slits++;
    }
  out.S = S;
  out.lines = lines / N; // (share of the page in line: total line length's proxy)
  out.slits = slits;
  const minArea = Math.pow(2.2 * jb._mm * gpm, 2),
    T = (jb._mm * gpm) / 4,
    areas = [];
  let fiddly = 0,
    sliv = 0,
    slivA = 0,
    ribbons = 0,
    tiny = 0,
    big = 0;
  for (let s = 1; s <= S; s++) {
    if (!area[s]) continue;
    areas.push(area[s]);
    if (area[s] < 2 * minArea) fiddly++;
    if (area[s] < jb.fragMin) tiny++;
    if (area[s] / Math.max(1, perim[s] * T) < 1.7) (sliv++, (slivA += area[s]));
    // (FINDINGS-AP 11: a section thinner than the step's narrowest width; "slivers" also counts small compact ones)
    if (area[s] / Math.max(1, perim[s] * T) < 1.0) ribbons++;
    if (area[s] > big) big = area[s];
  }
  areas.sort((a, b) => a - b);
  out.medianMm2 = areas.length ? areas[areas.length >> 1] / (gpm * gpm) : 0;
  out.fiddly = areas.length ? fiddly / areas.length : 0;
  out.slivers = sliv;
  out.ribbons = ribbons;
  {
    const lt = lineTally(r, W, H);
    out.stubs = lt.stubs;
    out.splits = lt.splits;
    out.splitPx = lt.splitPx;
  }
  out.sliverArea = slivA / N;
  out.largest = big / N;
  out.underFrag = tiny;
  out.wobble = wobble(lab, W, H, S, first);
  // markers: used, and the chosen set (for the Jaccard between builders)
  const used = new Set();
  for (let s = 1; s <= S; s++) if (r.secMk[s] >= 0 && !r.secWhite[s]) used.add(r.secMk[s]);
  out.K = used.size;
  out.chosen = Array.from(r.pick.chosen);
  // likeness: each working pixel's colour against its section's marker (the paper for Leave white), lines left out
  const w = prep.w,
    h = prep.h,
    pl = jb.pl,
    ch = r.pick.chosen;
  let de = 0,
    nde = 0,
    gLine = 0,
    nLine = 0,
    gAll = 0;
  // (every second working pixel each way: a quarter of them, the same mean to a few hundredths)
  for (let y = 0; y < h; y += 2) {
    const gy = Math.min(H - 1, Math.round(((y + 0.5) * H) / h - 0.5));
    for (let x = 0; x < w; x += 2) {
      const gx = Math.min(W - 1, Math.round(((x + 0.5) * W) / w - 0.5)),
        s = lab[gy * W + gx],
        i = y * w + x,
        g = gradL[i];
      gAll += g;
      if (s < 0) {
        gLine += g;
        nLine++;
        continue;
      }
      const L = workLab.subarray(i * 3, i * 3 + 3),
        mk = r.secMk[s];
      let m0 = 100,
        m1 = 0,
        m2 = 0;
      if (!r.secWhite[s] && mk >= 0) {
        const p = ch[mk] * 3;
        m0 = pl[p];
        m1 = pl[p + 1];
        m2 = pl[p + 2];
      }
      de += t.ppDe(L[0], L[1], L[2], m0, m1, m2);
      nde++;
    }
  }
  out.likeness = de / Math.max(1, nde);
  // lines on the photo's edges: the photo's lightness gradient under lines against its mean everywhere (1: no better
  // than chance; higher: lines sit on edges)
  out.linesOnEdges = nLine ? gLine / nLine / (gAll / Math.max(1, nLine + nde)) : 0;
  // spill and edge-following, per outlined object
  const dist = lineDist(lab, W, H),
    rNeed = (jb._mm * gpm) / 2;
  let spW = 0,
    spS = 0,
    sp2W = 0,
    sp2S = 0,
    e1 = 0,
    e2 = 0,
    eN = 0;
  for (const o of objs) {
    const m = o.bits;
    const [x0, y0, x1, y1] = o.bb;
    if (o.r_in >= rNeed) {
      // (sections it shares with outside: min(in, out) over each section it touches, as a share of the object; a
      // section's outside part = its area minus its inside part)
      const inC = new Map();
      for (let y = y0; y <= y1; y++)
        for (let x = x0; x <= x1; x++) {
          const i = y * W + x,
            s = lab[i];
          if (s >= 0 && (m[i >> 3] >> (7 - (i & 7))) & 1) inC.set(s, (inC.get(s) || 0) + 1);
        }
      let sp = 0;
      inC.forEach((a, s) => (sp += Math.min(a, area[s] - a)));
      spS += sp;
      spW += o.area;
      // (FINDINGS-AP 11: reported beside it, objects at least twice the step's narrowest width: a one-section object's
      // spill swings from 20 to 97 on one join)
      if (o.r_in >= 2 * rNeed) ((sp2S += sp), (sp2W += o.area));
    }
    if (o.r_in >= rNeed) {
      // (FINDINGS-AM 7: objects big enough for the step, as spill; the outline within 1 mm of the photo's edge left out,
      // not the whole object: Open Images' outlines stop short of the frame where an object runs off it)
      const d1 = gpm,
        d2 = 2 * gpm,
        bd = Math.max(1, Math.ceil(gpm));
      for (let y = Math.max(bd, y0); y <= Math.min(H - 1 - bd, y1); y++)
        for (let x = Math.max(bd, x0); x <= Math.min(W - 1 - bd, x1); x++) {
          const i = y * W + x;
          if (!((m[i >> 3] >> (7 - (i & 7))) & 1)) continue;
          const nb = [i - 1, i + 1, i - W, i + W].some((j) => !((m[j >> 3] >> (7 - (j & 7))) & 1));
          if (!nb) continue;
          eN++;
          if (dist[i] <= d1) e1++;
          if (dist[i] <= d2) e2++;
        }
    }
  }
  out.spill = spW ? (100 * spS) / spW : null; // (percent of the objects' area)
  out.spill2 = sp2W ? (100 * sp2S) / sp2W : null;
  out.edge1 = eN ? (100 * e1) / eN : null;
  out.edge2 = eN ? (100 * e2) / eN : null;
  if (jb.sal) {
    // (Focus rows) sections whose mean subject-map value is within 0.05 of the cut (0.5): a little map noise flips them
    const sm = new Float64Array(S + 1),
      sn = new Float64Array(S + 1);
    for (let y = 0; y < h; y += 2) {
      const gy = Math.min(H - 1, Math.round(((y + 0.5) * H) / h - 0.5));
      for (let x = 0; x < w; x += 2) {
        const sec = lab[gy * W + Math.min(W - 1, Math.round(((x + 0.5) * W) / w - 0.5))];
        if (sec < 0) continue;
        sm[sec] += jb.sal[y * w + x];
        sn[sec]++;
      }
    }
    let near = 0,
      tot = 0;
    for (let k = 1; k <= S; k++)
      if (sn[k]) {
        tot++;
        if (Math.abs(sm[k] / sn[k] - 0.5) < 0.05) near++;
      }
    out.nearCut = tot ? near / tot : 0;
  }
  out.ms = r.t.all;
  out.digest = crypto.createHash('sha256').update(Buffer.from(lab.buffer)).digest('hex').slice(0, 12);
  return out;
}

// ---- one photo ----
function photo(t, pools, row, pid) {
  const meta = JSON.parse(fs.readFileSync(path.join(CACHE, 'prep', row.id + '.json'))),
    rgb = new Uint8Array(fs.readFileSync(path.join(CACHE, 'prep', row.id + '.rgb'))),
    prep = {
      key: 'bench',
      pid,
      rgb,
      w: meta.w,
      h: meta.h,
      GW: meta.GW,
      GH: meta.GH,
      tl: new Float32Array(meta.tl),
      tw: new Float32Array(meta.tw),
    },
    mj = JSON.parse(fs.readFileSync(path.join(CACHE, 'masks', row.id + '.json'))),
    objs = mj.objs.map((o) => {
      const bits = zlib.gunzipSync(fs.readFileSync(path.join(CACHE, 'masks', `${row.id}-${o.k}.bits.gz`))),
        bb = [1e9, 1e9, -1, -1];
      for (let i = 0; i < meta.GW * meta.GH; i++)
        if ((bits[i >> 3] >> (7 - (i & 7))) & 1) {
          const x = i % meta.GW,
            y = (i / meta.GW) | 0;
          if (x < bb[0]) bb[0] = x;
          if (y < bb[1]) bb[1] = y;
          if (x > bb[2]) bb[2] = x;
          if (y > bb[3]) bb[3] = y;
        }
      return { ...o, bits, bb };
    });
  const n = meta.w * meta.h,
    workLab = new Float32Array(n * 3),
    gradL = new Float32Array(n);
  for (let i = 0; i < n; i++) workLab.set(labOf(rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]), i * 3);
  for (let y = 1; y < meta.h - 1; y++)
    for (let x = 1; x < meta.w - 1; x++) {
      const i = y * meta.w + x;
      gradL[i] =
        Math.hypot(
          workLab[(i + 1) * 3] - workLab[(i - 1) * 3],
          workLab[(i + meta.w) * 3] - workLab[(i - meta.w) * 3],
        ) / 2;
    }
  const res = { id: row.id, kind: row.kind, focus_ok: row.focus_ok === '1', rows: {}, mapIoU: undefined };
  for (const f of MODES) {
    if (f !== 'even') {
      if (row.focus_ok !== '1') continue;
      const mp = path.join(CACHE, 'maps', MAP, row.id + '.y');
      if (!fs.existsSync(mp)) continue;
      const side = JSON.parse(fs.readFileSync(path.join(CACHE, 'maps', MAP, 'model.json'))).side,
        y = new Float32Array(new Uint8Array(fs.readFileSync(mp)).buffer);
      prep.sal = t.subMapUp(y, side, rgb, meta.w, meta.h, SUB_GF_R, SUB_GF_EPS);
      if (res.mapIoU === undefined) {
        // (reported) the map cut at 0.5 against every outline together, at the working size
        let I = 0,
          U = 0;
        for (let yy = 0; yy < meta.h; yy++) {
          const gy = Math.min(meta.GH - 1, Math.round(((yy + 0.5) * meta.GH) / meta.h - 0.5));
          for (let xx = 0; xx < meta.w; xx++) {
            const g = gy * meta.GW + Math.min(meta.GW - 1, Math.round(((xx + 0.5) * meta.GW) / meta.w - 0.5)),
              o = objs.some((ob) => (ob.bits[g >> 3] >> (7 - (g & 7))) & 1),
              m = prep.sal[yy * meta.w + xx] >= 0.5;
            if (o && m) I++;
            if (o || m) U++;
          }
        }
        res.mapIoU = U ? I / U : 1;
      }
      prep._fTg = null;
    } else prep.sal = null;
    const pool = pools[f],
      sig = sigOf(pool);
    for (const d of STEPS) {
      const jb = Object.assign(job(t, prep, d, f, pool, sig), XOPT ? { x: XOPT } : {}),
        r = t.ppBuildCore(jb);
      res.rows[f + d] = measures(t, prep, jb, r, objs, workLab, gradL);
      if (PICS && PICS.has(row.id) && d === 2 && f !== 'calm') {
        // (pictures of the same few photos in every run, Medium, Even and Sharper subject: compare.html sets two runs'
        // side by side)
        const pc = pictures({ r, pl: jb.pl, GW: prep.GW, GH: prep.GH });
        fs.mkdirSync(path.join(RUN, 'pics'), { recursive: true });
        fs.writeFileSync(path.join(RUN, 'pics', `${row.id}-${f}.png`), Buffer.from(pc.colour, 'base64'));
        fs.writeFileSync(path.join(RUN, 'pics', `${row.id}-${f}-lines.png`), Buffer.from(pc.lines, 'base64'));
      }
    }
  }
  return res;
}

// ---- a worker: its share of the photos ----
let PICS = null;
async function worker() {
  const [k, K] = SHARD.split('/').map(Number),
    all = chosenIds(),
    rows = all.filter((_, i) => i % K === k),
    t = appWith(createApp, POOL),
    pools = Object.fromEntries(MODES.map((f) => [f, poolOf(t, f)]));
  PICS = new Set(
    all
      .map((r) => r.id)
      .sort((a, b) => (hashOf('pics:' + a) < hashOf('pics:' + b) ? -1 : 1))
      .slice(0, +arg('--pics', 8)),
  );
  fs.mkdirSync(RUN, { recursive: true });
  // (pids: distinct for every photo and every rebuild, across workers; ppBuildCore's smoothing cache is kept by pid)
  let pid = 1e6 * (k + 1);
  if (rows.length) {
    // (determinism: each worker's first photo built twice gives the same page)
    const a = photo(t, pools, rows[0], ++pid),
      b = photo(t, pools, rows[0], ++pid),
      da = Object.values(a.rows)
        .map((x) => x.digest)
        .join(),
      db = Object.values(b.rows)
        .map((x) => x.digest)
        .join();
    fs.writeFileSync(
      path.join(RUN, `_determinism-${k}.json`),
      JSON.stringify({ id: rows[0].id, same: da === db }),
    );
  }
  for (const row of rows) {
    const out = path.join(RUN, row.id + '.json');
    if (fs.existsSync(out)) continue;
    const res = photo(t, pools, row, ++pid);
    res.build = BUILD;
    fs.writeFileSync(out + '.tmp', JSON.stringify(res));
    fs.renameSync(out + '.tmp', out);
    process.send && process.send({ done: row.id });
  }
}

// ---- the run: workers, then the summary, the baseline or the comparison ----
const MEAS = [
  'wobble',
  'nearCut',
  'spill',
  'edge1',
  'edge2',
  'likeness',
  'S',
  'lines',
  'K',
  'slivers',
  'ribbons',
  'spill2',
  'stubs',
  'splits',
  'sliverArea',
  'fiddly',
  'medianMm2',
  'largest',
  'slits',
  'linesOnEdges',
  'underFrag',
  'ms',
];
function summarise(res) {
  const sum = {};
  for (const f of MODES)
    for (const d of STEPS) {
      const key = f + d,
        rs = res.map((r) => r.rows[key]).filter(Boolean);
      if (!rs.length) continue;
      sum[key] = { n: rs.length };
      for (const m of MEAS) {
        const v = rs.map((x) => x[m]).filter((x) => x !== null && x !== undefined);
        sum[key][m] = v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
      }
    }
  return sum;
}
function ci(d, seed) {
  let s = seed >>> 0 || 1;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647,
    n = d.length,
    bs = [];
  if (!n) return [NaN, NaN, NaN];
  for (let b = 0; b < 4000; b++) {
    let a = 0;
    for (let i = 0; i < n; i++) a += d[(rnd() * n) | 0];
    bs.push(a / n);
  }
  bs.sort((a, b) => a - b);
  return [d.reduce((a, b) => a + b, 0) / n, bs[100], bs[3899]];
}
function compare(A, B, Bh) {
  // B (this run) minus A (the baseline), photo by photo: each photo's measure averaged over the steps, per mode
  const byA = new Map(A.map((r) => [r.id, r])),
    lines = [],
    lacks = [];
  lines.lacks = lacks;
  for (const f of MODES.filter((m) => !Bh || Bh.modes.includes(m))) {
    const per = (r, m) => {
      const v = STEPS.map((d) => r.rows[f + d] && r.rows[f + d][m]).filter(
        (x) => x !== null && x !== undefined,
      );
      return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
    };
    for (const m of [
      'spill',
      'wobble',
      'edge1',
      'edge2',
      'likeness',
      'S',
      'lines',
      'slivers',
      'ribbons',
      'spill2',
      'underFrag',
      'stubs',
      'splits',
      'largest',
      'slits',
      'linesOnEdges',
    ]) {
      const d = [];
      for (const b of B) {
        const a = byA.get(b.id);
        if (!a) continue;
        const x = per(a, m),
          y = per(b, m);
        if (x !== null && y !== null) d.push(y - x);
      }
      if (!d.length) {
        // (a measure added after the baseline was made: said, not silently left out, FINDINGS-AQ 2)
        if (
          B.some((b) => STEPS.some((s) => b.rows[f + s] && b.rows[f + s][m] !== undefined)) &&
          !lacks.includes(m)
        )
          lacks.push(m);
        continue;
      }
      const [mean, lo, hi] = ci(d, 7 + m.length * 31 + f.length);
      lines.push({
        mode: f,
        m,
        n: d.length,
        mean,
        lo,
        hi,
        // (photos worse; for the guards without a better direction, sections, line share and the largest section:
        // photos up)
        worse: d.filter((x) => (m === 'edge1' || m === 'edge2' || m === 'linesOnEdges' ? x < 0 : x > 0))
          .length,
        up: m === 'S' || m === 'lines' || m === 'largest',
      });
    }
  }
  return lines;
}

// The rule (decisions 79 and 99 as amended by FINDINGS-Y and -AL), on one mode (Even is the headline; each Focus mode
// is judged on its own): passes if spill is shown lower (95% high end below 0) and edge-following at 1 mm not shown worse
// (its high end not below 0), or edge-following shown higher and spill not shown worse; each photo's measure averaged
// over the steps, paired. Guards, step by step (means over photos): likeness +0.15 at most, and no photo worse than +1.0
// (its steps' mean); sections within max(10%, 5) of the baseline's and no page over its step's ceiling; line share within
// ±10%; slit pixels up by max(1, 5%) a page at most (stand-in pages have 20-80 already); the largest section's share
// within ±0.10; no more sections under the step's fragment size than the baseline's (today's builder leaves a few
// specks after its last merge: FINDINGS-AM 1).
// Reported: marker overlap (Jaccard), per-kind lines, the worst photos. Build time: the separate time pass.
function judge(A, B, f) {
  const byA = new Map(A.map((r) => [r.id, r])),
    pairs = B.filter(
      (b) => byA.has(b.id) && STEPS.every((d) => b.rows[f + d] && byA.get(b.id).rows[f + d]),
    ).map((b) => [byA.get(b.id), b]),
    avg = (r, m) => {
      const v = STEPS.map((d) => r.rows[f + d][m]).filter((x) => x !== null && x !== undefined);
      return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
    },
    seedOf = (k) => [...k].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  if (!pairs.length) return null;
  const dif = (m) =>
      pairs
        .map(([a, b]) => [avg(a, m), avg(b, m)])
        .filter(([x, y]) => x !== null && y !== null)
        .map(([x, y]) => y - x),
    sp = ci(dif('spill'), seedOf(f + 'spill')),
    e1 = ci(dif('edge1'), seedOf(f + 'edge1')),
    e2 = ci(dif('edge2'), seedOf(f + 'edge2'));
  // (decisions 109, 110, 112: better or worse only when the whole interval is more than FLOOR points beyond 0)
  const spGain = sp[2] < -FLOOR,
    spWorse = sp[1] > FLOOR,
    eGain = e1[1] > FLOOR,
    eWorse = e1[2] < -FLOOR;
  const better = (spGain && !eWorse) || (eGain && !spWorse);
  const G = [];
  const lk = dif('likeness'),
    lkm = lk.length ? lk.reduce((a, b) => a + b, 0) / lk.length : 0,
    lkx = lk.length ? Math.max(...lk) : 0;
  G.push({ g: 'likeness +0.15 at most (mean of the steps)', ok: lkm <= 0.15, v: lkm });
  G.push({ g: "no photo's likeness worse than +1.0", ok: lkx <= 1.0, v: lkx });
  for (const d of STEPS) {
    const k = f + d,
      mA = (m) => pairs.reduce((a, [x]) => a + x.rows[k][m], 0) / pairs.length,
      mB = (m) => pairs.reduce((a, [, y]) => a + y.rows[k][m], 0) / pairs.length,
      SA = mA('S'),
      SB = mB('S');
    G.push({
      g: `step ${d}: sections within max(10%, 5) of the baseline's`,
      ok: Math.abs(SB - SA) <= Math.max(0.1 * SA, 5),
      v: SB - SA,
    });
    // (relative, as the specks': today's builder already goes over the ceiling on a few pages, by its own rules)
    G.push({
      g: `step ${d}: no page over the step's ceiling (${PP_STEPS[d].cap}) where the baseline's wasn't, nor further over`,
      ok: pairs.every(([x, y]) => y.rows[k].S <= Math.max(PP_STEPS[d].cap, x.rows[k].S)),
      v: Math.max(...pairs.map(([x, y]) => y.rows[k].S - Math.max(PP_STEPS[d].cap, x.rows[k].S))),
    });
    G.push({
      g: `step ${d}: line share within ±10%`,
      ok: Math.abs(mB('lines') / mA('lines') - 1) <= 0.1,
      v: mB('lines') / mA('lines') - 1,
    });
    G.push({
      g: `step ${d}: slit pixels up by max(1, 5%) a page at most`,
      ok: mB('slits') - mA('slits') <= Math.max(1, 0.05 * mA('slits')),
      v: mB('slits') - mA('slits'),
    });
    G.push({
      g: `step ${d}: largest section's share within ±0.10`,
      ok: Math.abs(mB('largest') - mA('largest')) <= 0.1,
      v: mB('largest') - mA('largest'),
    });
    const uA = pairs.reduce((a, [x]) => a + x.rows[k].underFrag, 0),
      uB = pairs.reduce((a, [, y]) => a + y.rows[k].underFrag, 0);
    G.push({
      g: `step ${d}: sections under the fragment size no more than the baseline's (${uA}; this run ${uB})`,
      ok: uB <= uA,
      v: uB - uA,
    });
  }
  const jac = [];
  for (const [a, b] of pairs)
    for (const d of STEPS) {
      const x = new Set(a.rows[f + d].chosen),
        y = new Set(b.rows[f + d].chosen),
        i = [...x].filter((v) => y.has(v)).length;
      jac.push(i / Math.max(1, x.size + y.size - i));
    }
  const kinds = {},
    dd = (a, b, m) => {
      const x = avg(a, m),
        y = avg(b, m);
      return x === null || y === null ? null : y - x;
    };
  for (const [a, b] of pairs) {
    const k = (kinds[b.kind] = kinds[b.kind] || { n: 0, sp: 0, nsp: 0, e1: 0, ne1: 0, dsp: [], de1: [] }),
      x = dd(a, b, 'spill'),
      y = dd(a, b, 'edge1');
    k.n++;
    if (x !== null) ((k.sp += x), k.nsp++, k.dsp.push(x));
    if (y !== null) ((k.e1 += y), k.ne1++, k.de1.push(y));
  }
  // (the by-kind trigger, agreed with 112-113: a kind whose spill or edge-following is worse by more than 1 point,
  // the whole interval beyond it, is looked at by Ben before any HELD look)
  const look = [];
  for (const [kn, k] of Object.entries(kinds)) {
    const s = k.dsp.length ? ci(k.dsp, seedOf(f + kn + 's')) : [NaN, NaN, NaN],
      e = k.de1.length ? ci(k.de1, seedOf(f + kn + 'e')) : [NaN, NaN, NaN];
    k.spCI = s;
    k.e1CI = e;
    delete k.dsp;
    delete k.de1;
    if (s[1] > 1 || e[2] < -1) look.push(kn);
  }
  const worst = pairs
    .map(([a, b]) => ({ id: b.id, kind: b.kind, d: dd(a, b, 'spill') }))
    .filter((w) => w.d !== null)
    .sort((x, y) => y.d - x.d)
    .slice(0, 5);
  // (decision 109, proposed: the rule for a fix that should change nothing else, reported beside the main one: its
  // purpose, fewer specks at every step that had any, and spill and edge-following not shown worse, every guard held)
  const fewer = STEPS.every((d) => {
    const a = pairs.reduce((s, [x]) => s + x.rows[f + d].underFrag, 0),
      b = pairs.reduce((s, [, y]) => s + y.rows[f + d].underFrag, 0);
    return a === 0 ? b === 0 : b < a;
  });
  const neutral = fewer && !spWorse && !eWorse && G.every((x) => x.ok);
  return {
    mode: f,
    n: pairs.length,
    neutral,
    spWorse,
    eWorse,
    look,
    spill: sp,
    edge1: e1,
    edge2: e2,
    better,
    guardsOk: G.every((x) => x.ok),
    G,
    jaccard: jac.reduce((a, b) => a + b, 0) / jac.length,
    kinds,
    worst,
  };
}

// The time pass (the +25% build-time guard): one process, the baseline's app (this checkout) and the candidate's (--b
// <its checkout, built>), each photo's rows built A then B, or B then A on every other photo; the median of B/A per row.
async function timePass() {
  const broot = arg('--b');
  if (!broot) throw new Error('--time needs --b <the candidate checkout, built>');
  const { createApp: createB } = await import(path.join(path.resolve(broot), 'test', 'harness.mjs'));
  const mk = (ca) => {
    const app = ca(),
      E = app.__eval,
      t = app.__mstest;
    t.assign.quiet();
    t.assign.resetForNewPicture();
    E(`state.owned = new Set(${POOLS[POOL]})`);
    t.coll = E('sfCollection()');
    return { t, pools: Object.fromEntries(MODES.map((f) => [f, poolOf(t, f)])) };
  };
  const A = mk(createApp),
    B = mk(createB),
    rows = chosenIds(),
    ratios = {};
  let pid = 1;
  for (const [ri, row] of rows.entries()) {
    const meta = JSON.parse(fs.readFileSync(path.join(CACHE, 'prep', row.id + '.json'))),
      rgb = new Uint8Array(fs.readFileSync(path.join(CACHE, 'prep', row.id + '.rgb')));
    for (const f of MODES) {
      let sal = null;
      if (f !== 'even') {
        const mp = path.join(CACHE, 'maps', MAP, row.id + '.y');
        if (row.focus_ok !== '1' || !fs.existsSync(mp)) continue;
        const side = JSON.parse(fs.readFileSync(path.join(CACHE, 'maps', MAP, 'model.json'))).side;
        sal = A.t.subMapUp(
          new Float32Array(new Uint8Array(fs.readFileSync(mp)).buffer),
          side,
          rgb,
          meta.w,
          meta.h,
          SUB_GF_R,
          SUB_GF_EPS,
        );
      }
      const p = ++pid,
        prepOf = () => ({
          key: 'bench',
          pid: p,
          rgb,
          w: meta.w,
          h: meta.h,
          GW: meta.GW,
          GH: meta.GH,
          tl: new Float32Array(meta.tl),
          tw: new Float32Array(meta.tw),
          sal,
        });
      const pa = prepOf(),
        pb = prepOf();
      for (const d of STEPS) {
        const time = (X, prep) => {
          const jb = Object.assign(
              job(X.t, prep, d, f, X.pools[f], sigOf(X.pools[f])),
              XOPT ? { x: XOPT } : {},
            ),
            t0 = process.hrtime.bigint();
          X.t.ppBuildCore(jb);
          return Number(process.hrtime.bigint() - t0) / 1e6;
        };
        let ta, tb;
        if (ri % 2) ((tb = time(B, pb)), (ta = time(A, pa)));
        else ((ta = time(A, pa)), (tb = time(B, pb)));
        (ratios[f + d] = ratios[f + d] || []).push(tb / ta);
      }
    }
    if ((ri + 1) % 10 === 0) console.log(`  ${ri + 1} of ${rows.length}`);
  }
  const med = (v) => {
    const s = [...v].sort((a, b) => a - b);
    return s[s.length >> 1];
  };
  const all = Object.values(ratios).flat(),
    overall = med(all),
    R = [
      `# Time pass: ${path.resolve(broot)} against this checkout, ${rows.length} photos of ${SET}`,
      '',
      '| Row | photos | median B/A |',
      '|---|---|---|',
    ];
  for (const [k, v] of Object.entries(ratios)) R.push(`| ${k} | ${v.length} | ${med(v).toFixed(3)} |`);
  R.push(
    '',
    `Overall median B/A ${overall.toFixed(3)}: ${overall <= 1.25 ? 'within' : '**over**'} the +25% guard.`,
  );
  fs.mkdirSync(RUN, { recursive: true });
  fs.writeFileSync(path.join(RUN, 'time.md'), R.join('\n') + '\n');
  console.log(R.join('\n'));
}
// what made a run (FINDINGS-AM 2, 5): a run folder belongs to one head
function runHead() {
  const t = appWith(createApp, POOL),
    mapJ = path.join(CACHE, 'maps', MAP, 'model.json'),
    prepJ = path.join(CACHE, 'prep', '_head.json');
  return {
    set: SET,
    n: NSUB,
    seed: SEED,
    modes: MODES,
    steps: STEPS,
    pool: POOL,
    poolLab: Object.fromEntries(MODES.map((f) => [f, poolLab(poolOf(t, f))])),
    map: MAP,
    mapSha:
      MODES.some((f) => f !== 'even') && fs.existsSync(mapJ)
        ? JSON.parse(fs.readFileSync(mapJ)).sha256
        : null,
    prepare: fs.existsSync(prepJ) ? JSON.parse(fs.readFileSync(prepJ)).prepare : null,
    build: BUILD,
    hashes: HASH,
    x: XOPT,
    accepted: ACCEPT,
  };
}
const refuse = (msg) => {
  console.error('REFUSED: ' + msg);
  process.exit(3);
};
async function main() {
  // (--compare a,b: a first, the gate; the others for attribution, from the one run: FINDINGS-AP 12)
  const rows = chosenIds(),
    cmps = (arg('--compare') || '').split(',').filter(Boolean),
    cmp = cmps[0];
  if (cmps.includes(TAG)) refuse(`--compare ${TAG} is this run's own tag: give the candidate its own --tag.`);
  const head0 = runHead();
  if (head0.prepare && head0.prepare !== PREP_HASH)
    refuse(
      `the working pictures in ${CACHE}/prep were made by another ppPrepare (${head0.prepare}, this checkout's ${PREP_HASH}): prepare a new cache with pp-prep.mjs.`,
    );
  if (!head0.prepare)
    console.log(`  (note: ${CACHE}/prep has no _head.json: made before pp-prep recorded its ppPrepare)`);
  // (a baseline that can't be compared with is refused before the run, not after)
  const BH = {};
  for (const c of cmps) {
    const bdir = path.join(CACHE, 'runs', c);
    if (!fs.existsSync(path.join(bdir, 'results.json'))) refuse(`runs/${c} has no results.json.`);
    const bh = JSON.parse(fs.readFileSync(path.join(bdir, 'results.json'))).head;
    const drift = COPIED.filter((k) => (bh.hashes || {})[k] !== HASH[k] && !ACCEPT.includes(k));
    if (drift.length)
      refuse(
        `the app's ${drift.join(', ')} changed since ${c} (the bench copies these): rebase the baseline, or, for a deliberate change with lib/pp.mjs's copy updated, --accept-drift ${drift.join(',')}.`,
      );
    // (the map only matters to Focus rows: an Even-only run carries its name but never reads it)
    const focus = MODES.some((f) => f !== 'even' && bh.modes.includes(f));
    // (a subset run is compared with a full-set baseline photo by photo: FINDINGS-AP 6; the baseline's modes need only be
    // among this run's, and only those are judged)
    const same = [
      'set',
      ...(bh.n ? ['n', 'seed'] : []),
      'steps',
      'pool',
      ...(focus ? ['map', 'mapSha'] : []),
    ].filter((k) => JSON.stringify(bh[k] ?? null) !== JSON.stringify(head0[k] ?? null));
    if (!bh.modes.every((f) => MODES.includes(f))) same.push('modes');
    const lab = bh.modes.filter(
      (f) => JSON.stringify((bh.poolLab || {})[f]) !== JSON.stringify(head0.poolLab[f]),
    );
    if (lab.length) same.push('poolLab');
    if (same.length)
      refuse(
        `${c} differs from this run in ${same.join(', ')} (${same.map((k) => `${JSON.stringify(bh[k])} there`).join('; ')}): make a baseline with the same settings.`,
      );
    if (bh.partial) refuse(`${c} did not finish (partial).`);
    if (bh.determinism !== true) refuse(`${c}'s same-page-twice check did not pass (${bh.determinism}).`);
    BH[c] = { bdir, bh };
  }
  fs.mkdirSync(RUN, { recursive: true });
  const HEADF = path.join(RUN, 'head.json');
  if (fs.existsSync(HEADF)) {
    const old = fs.readFileSync(HEADF, 'utf8');
    if (old !== JSON.stringify(head0, null, 1)) {
      const o = JSON.parse(old),
        diff = Object.keys(head0).filter((k) => JSON.stringify(o[k]) !== JSON.stringify(head0[k]));
      refuse(
        `runs/${TAG} was made by another build or other settings (${diff.join(', ')} differ): use another --tag.`,
      );
    }
  } else if (fs.readdirSync(RUN).some((f) => f.endsWith('.json')))
    refuse(`runs/${TAG} has photos from before runs kept a head.json: use another --tag.`);
  else fs.writeFileSync(HEADF, JSON.stringify(head0, null, 1));
  console.log(
    `pp-bench ${TAG}: ${rows.length} photos of ${SET}, modes ${MODES.join(', ')}, steps ${STEPS.join(',')}, pool ${POOL}, ${WORKERS} workers`,
  );
  const t0 = Date.now(),
    kids = [];
  let done = 0,
    failed = null;
  await Promise.all(
    Array.from(
      { length: WORKERS },
      (_, k) =>
        new Promise((res) => {
          const c = fork(fileURLToPath(import.meta.url), [...argv, '--shard', `${k}/${WORKERS}`]);
          kids.push(c);
          c.on('message', () => {
            done++;
            if (done % 10 === 0)
              console.log(`  ${done} photos (${((Date.now() - t0) / 60000).toFixed(1)} min)`);
          });
          c.on('exit', (code, sig) => {
            if ((code || sig) && !failed) {
              // (FINDINGS-AM 7: one worker failed: stop the others, report what there is, marked partial)
              failed = `worker ${k} ${sig ? 'stopped by ' + sig : 'failed (' + code + ')'}`;
              console.error(failed + ': stopping the others');
              for (const o of kids) if (o !== c && o.exitCode === null) o.kill();
            }
            res();
          });
        }),
    ),
  );
  const res = rows
    .map((r) => path.join(RUN, r.id + '.json'))
    .filter((p) => fs.existsSync(p))
    .map((p) => JSON.parse(fs.readFileSync(p)));
  const dets = fs
      .readdirSync(RUN)
      .filter((f) => /^_determinism-\d+\.json$/.test(f))
      .map((f) => JSON.parse(fs.readFileSync(path.join(RUN, f))).same),
    det = dets.length ? dets.every(Boolean) : null,
    stale = res.filter((r) => r.build !== BUILD).length;
  if (stale) refuse(`${stale} photo results in runs/${TAG} were made by another build.`);
  const head = {
    tag: TAG,
    ...head0,
    photos: res.length,
    determinism: det,
    partial: !!failed || res.length < rows.length,
    minutes: (Date.now() - t0) / 60000,
  };
  const sum = summarise(res);
  const out = { head, sum };
  const R = [
    `# Photo-to-page bench: ${TAG}`,
    '',
    `${res.length} photos (${SET}), modes ${MODES.join(', ')}, pool ${POOL}, map ${MAP}; build ${BUILD}; same page twice: ${det}; ${head.minutes.toFixed(1)} min${head.partial ? `; **partial** (${failed || `${rows.length - res.length} photos missing`})` : ''}`,
    '',
  ];
  // (FINDINGS-AP 5: a HELD or FINAL run's levels stay unseen until a change is judged: differences only; they're in
  // results.json for later, unread)
  const LEVELS = SET === 'TUNE' || flag('--show-levels');
  if (!LEVELS)
    R.push(
      `(${SET}: the measures' levels are not shown, only differences from a baseline; --show-levels shows them.)`,
    );
  else {
    R.push(
      '| Row | n | spill % | spill, objects ≥ 2× | edge 1 mm % | edge 2 mm % | likeness ΔE | sections | line share | slivers | ribbons | largest | slits | specks | lines on edges | wobble | ms |',
    );
    R.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  }
  const f2 = (v, k = 2) => (v === null || v === undefined ? '–' : v.toFixed(k));
  for (const [k, s] of LEVELS ? Object.entries(sum) : [])
    R.push(
      `| ${k} | ${s.n} | ${f2(s.spill)} | ${f2(s.spill2)} | ${f2(s.edge1)} | ${f2(s.edge2)} | ${f2(s.likeness)} | ${f2(s.S, 0)} | ${f2(s.lines, 4)} | ${f2(s.slivers, 1)} | ${f2(s.ribbons, 1)} | ${f2(s.largest, 3)} | ${f2(s.slits, 0)} | ${f2(s.underFrag, 2)} | ${f2(s.linesOnEdges)} | ${f2(s.wobble, 3)} | ${f2(s.ms, 0)} |`,
    );
  const mi = res.map((r) => r.mapIoU).filter((x) => typeof x === 'number');
  if (mi.length && LEVELS)
    R.push(
      '',
      `Focus: the subject map (cut at 0.5) against the outlines, mean IoU ${(mi.reduce((a, b) => a + b, 0) / mi.length).toFixed(3)} over ${mi.length} photos; sections whose mean map value is within 0.05 of the cut: ${Object.entries(
        sum,
      )
        .filter(([k, v]) => v.nearCut !== null && !k.startsWith('even'))
        .map(([k, v]) => `${k} ${(100 * v.nearCut).toFixed(1)}%`)
        .join(', ')} (Focus rows compare builders fairly; they don't reproduce the iPad's page bit for bit).`,
    );
  if (det === false)
    R.push('', '**The same photo built twice gave different pages: no comparison is made with this run.**');
  if (cmp && (head.partial || det !== true))
    R.push(
      '',
      `No comparison with ${cmps.join(', ')}: this run is ${head.partial ? 'partial' : 'not shown to give the same page twice'}.`,
    );
  let notSame = 0;
  out.compares = {};
  // (decision 110: each mode is judged against the first baseline that has it: base-*-even for Even, base-*-focus for
  // the two Focus modes; a later baseline with no mode of its own is for attribution)
  const gateOf = {};
  for (const c of cmps) for (const f of BH[c].bh.modes) if (!gateOf[f]) gateOf[f] = c;
  const todo = cmp && !head.partial && det === true ? cmps : [];
  for (const [ci_, cmp] of todo.entries()) {
    const { bdir, bh } = BH[cmp],
      gateModes = bh.modes.filter((f) => gateOf[f] === cmp),
      gate = gateModes.length > 0;
    const live = Object.keys(HASH).filter((k) => !COPIED.includes(k) && (bh.hashes || {})[k] !== HASH[k]);
    if (live.length)
      R.push('', `(The app's ${live.join(', ')} changed since ${cmp}: measured as this checkout has them.)`);
    const A = fs
      .readdirSync(bdir)
      .filter((f) => /^[0-9a-f]+\.json$/.test(f))
      .map((f) => JSON.parse(fs.readFileSync(path.join(bdir, f))));
    if (A.some((r) => r.build !== bh.build))
      refuse(`runs/${cmp} holds photo results from another build than its head's.`);
    const C = (out.compares[cmp] = { against: cmp, gate, lines: compare(A, res, bh) });
    C.gateModes = gateModes;
    if (ci_ === 0) out.compare = C;
    // (--expect-same: the proof that a change does nothing where it shouldn't, every common page's digest equal)
    const byA0 = new Map(A.map((r) => [r.id, r]));
    let diff = 0,
      tot = 0;
    for (const r of res) {
      const a = byA0.get(r.id);
      if (!a) continue;
      for (const k of Object.keys(r.rows))
        if (a.rows[k]) (tot++, (diff += a.rows[k].digest !== r.rows[k].digest ? 1 : 0));
    }
    C.pagesDiffer = diff;
    if (gate && flag('--expect-same')) notSame = diff;
    R.push(
      '',
      `## This run minus ${cmp}${gate ? ` (the gate for ${gateModes.join(', ')})` : ' (for attribution)'}, photo by photo (each photo's measure averaged over the steps; 95% interval); pages that differ: ${diff} of ${tot}`,
      '',
    );
    R.push(
      '| Mode | Measure | n | difference | 95% interval | photos worse (or up) |',
      '|---|---|---|---|---|---|',
    );
    for (const l of C.lines)
      R.push(
        `| ${l.mode} | ${l.m} | ${l.n} | ${l.mean.toFixed(3)} | ${l.lo.toFixed(3)} to ${l.hi.toFixed(3)} | ${l.worse}${l.up ? ' up' : ''} |`,
      );
    if (C.lines.lacks.length)
      R.push('', `(Not in ${cmp}, made before they were measured: ${C.lines.lacks.join(', ')}.)`);
    C.judge = bh.modes.map((f) => judge(A, res, f)).filter(Boolean);
    if (ci_ === 0) out.judge = C.judge;
    // (the pictured photos, the baseline's page beside this run's, most spill added first)
    const pics =
      ci_ === 0 && fs.existsSync(path.join(RUN, 'pics')) ? fs.readdirSync(path.join(RUN, 'pics')) : [];
    if (pics.length) {
      const byA = new Map(A.map((r) => [r.id, r])),
        sp = (r) => (r && r.rows.even2 ? (r.rows.even2.spill ?? 0) : 0),
        ids = [...new Set(pics.map((f) => f.split('-')[0]))].sort((a, b) => {
          const ra = res.find((r) => r.id === a),
            rb = res.find((r) => r.id === b);
          return sp(rb) - sp(byA.get(b)) - (sp(ra) - sp(byA.get(a)));
        });
      const rowsH = ids
        .flatMap((id) =>
          ['even', 'sharp']
            .filter((f) => pics.includes(`${id}-${f}.png`))
            .map((f) => {
              const r = res.find((x) => x.id === id),
                a = byA.get(id),
                d = (m) =>
                  r && a && r.rows[f + 2] && a.rows[f + 2]
                    ? (r.rows[f + 2][m] - a.rows[f + 2][m]).toFixed(2)
                    : '–';
              return `<section><h2>${id} (${r ? r.kind : ''}), ${f}, Medium: spill ${d('spill')}, edge 1 mm ${d('edge1')}, sections ${d('S')}</h2><div><figure><figcaption>${cmp}</figcaption><img src="../${cmp}/pics/${id}-${f}.png"></figure><figure><figcaption>${TAG}</figcaption><img src="pics/${id}-${f}.png"></figure></div></section>`;
            }),
        )
        .join('\n');
      fs.writeFileSync(
        path.join(RUN, 'compare.html'),
        `<!doctype html><meta charset="utf-8"><title>${TAG} vs ${cmp}</title><style>body{font:14px system-ui;margin:16px;background:#fafafa}div{display:grid;grid-template-columns:1fr 1fr;gap:8px}img{width:100%;border:1px solid #ccc;background:#fff}h2{font-size:15px}</style>${rowsH}`,
      );
      R.push(
        '',
        `Pictures: compare.html (the baseline's Medium pages beside this run's, ${ids.length} photos, most spill added first).`,
      );
    }
    const iv = (x) =>
      Number.isFinite(x[0])
        ? `${x[0].toFixed(3)} (${x[1].toFixed(3)} to ${x[2].toFixed(3)})`
        : '– (no photo had it)';
    for (const j of C.judge) {
      R.push(
        '',
        `## ${j.mode} against ${cmp}: ${j.better && j.guardsOk ? 'PASSES' : 'does not pass'} (${j.n} photos)`,
        '',
        `- spill ${iv(j.spill)}; edge-following 1 mm ${iv(j.edge1)}, 2 mm ${iv(j.edge2)}: ${j.better ? 'better by the rule' : 'not shown better'}`,
        `- a fix that should change nothing else (decision 109's rule): ${j.neutral ? 'holds' : 'does not hold'}`,
        `- worse by more than ${FLOOR} point: spill ${j.spWorse ? 'yes' : 'no'}, edge-following ${j.eWorse ? 'yes' : 'no'}${j.look.length ? `; **kinds to look at first (worse by more than 1 point): ${j.look.join(', ')}**` : ''}`,
        `- guards: ${
          j.guardsOk
            ? 'all hold'
            : 'not held: ' +
              j.G.filter((x) => !x.ok)
                .map((x) => `${x.g} (${(+x.v).toFixed(3)})`)
                .join('; ')
        }`,
        `- markers chosen, overlap with the baseline's (Jaccard): ${j.jaccard.toFixed(3)}`,
        `- by kind (spill / edge 1 mm): ${Object.entries(j.kinds)
          .map(
            ([k, v]) =>
              `${k} n ${v.n} ${v.nsp ? (v.sp / v.nsp).toFixed(2) : '–'} / ${v.ne1 ? (v.e1 / v.ne1).toFixed(2) : '–'}`,
          )
          .join('; ')}`,
        `- most spill added: ${j.worst.map((w) => `${w.id} (${w.kind}) ${w.d.toFixed(2)}`).join('; ')}`,
      );
    }
    R.push(
      '',
      'Before FINAL: the same comparison on TUNE must show a gain of which HELD keeps at least half (the shrinkage check), and the time pass (pp-time) must hold +25% at most.',
    );
  }
  // decision 110 across the modes, each against its own gate; decision 109's rule likewise; the by-kind trigger
  const J = {};
  for (const C of Object.values(out.compares))
    for (const j of C.judge) if (C.gateModes.includes(j.mode)) J[j.mode] = j;
  if (Object.keys(J).length) {
    const ok = (j) => j.guardsOk,
      notWorse = (j) => !j.spWorse && !j.eWorse && ok(j),
      fm = ['sharp', 'calm'].filter((f) => J[f]),
      ev = J.even,
      pass =
        Object.values(J).every(ok) &&
        ((ev && ev.better && fm.every((f) => notWorse(J[f]))) ||
          (fm.length === 2 && fm.every((f) => J[f].better) && (!ev || notWorse(ev)))),
      neutral = Object.values(J).every((j) => j.neutral),
      look = [...new Set(Object.values(J).flatMap((j) => j.look.map((k) => `${k} (${j.mode})`)))];
    out.verdict = { modes: Object.keys(J), pass, neutral, look };
    R.push(
      '',
      `## All modes (${Object.keys(J).join(', ')}): decision 110 ${pass ? '**PASSES**' : 'does not pass'}; decision 109's rule (a fix that should change nothing else) ${neutral ? '**holds**' : 'does not hold'}${look.length ? `; **look first at: ${look.join(', ')}**` : ''}`,
    );
  }
  if (flag('--expect-same'))
    R.push(
      '',
      notSame
        ? `**--expect-same: ${notSame} pages differ from ${cmp}.**`
        : `--expect-same: every page the same as ${cmp}.`,
    );
  fs.writeFileSync(path.join(RUN, 'results.json'), JSON.stringify(out, null, 1));
  fs.writeFileSync(path.join(RUN, 'report.md'), R.join('\n') + '\n');
  if (out.verdict)
    fs.appendFileSync(
      path.join(CACHE, 'runs', 'LOG.md'),
      `- ${new Date().toISOString().slice(0, 16)} ${TAG}, ${SET}${NSUB ? ` n${NSUB}` : ''}, all modes (${out.verdict.modes.join(', ')}): decision 110 ${out.verdict.pass ? 'PASSES' : 'does not pass'}; 109 ${out.verdict.neutral ? 'holds' : 'does not hold'}${out.verdict.look.length ? '; look first: ' + out.verdict.look.join(', ') : ''}\n`,
    );
  for (const C of Object.values(out.compares || {})) {
    // (FINDINGS-AM 7: every comparison logged, so a set judged once shows it)
    const verdicts = C.judge
      .map((j) => `${j.mode} ${j.better && j.guardsOk ? 'PASSES' : 'does not pass'} (${j.n})`)
      .join(', ');
    fs.appendFileSync(
      path.join(CACHE, 'runs', 'LOG.md'),
      `- ${new Date().toISOString().slice(0, 16)} ${TAG} vs ${C.against}${C.gate ? ` (gate: ${C.gateModes.join(', ')})` : ' (attribution)'}, ${SET}${NSUB ? ` n${NSUB}` : ''}${XOPT ? ' x ' + JSON.stringify(XOPT) : ''}, build ${BUILD.slice(0, 8)}: ${verdicts}; pages differing ${C.pagesDiffer}\n`,
    );
  }
  console.log(R.join('\n'));
  if (head.partial || det === false || notSame) process.exit(1);
}
if (SHARD) await worker();
else if (flag('--time')) await timePass();
else await main();
