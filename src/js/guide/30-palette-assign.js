/* ---- shell ---- */
function hexRgb(x) {
  const s = x.charAt(0) === '#' ? x.slice(1) : x;
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}
/* The smallest section kept (Sections screen, "Min section size"), in the working picture's pixels, from the
   slider's place (0-100). The slider runs from 2 px (every speck but single pixels) to 400 px, evenly by ratio, so
   each step is the same share bigger. It starts at MIN_DEF (00-state), 10 px: on the sample jellyfish that keeps all 166 of its
   sections, and it still drops the specks of a few pixels a photo of a page leaves. (Before v277 it ran from 2 to
   2,000 px, by the square of the place, and started at 137 px, which dropped the jellyfish's 23 smallest sections;
   minPosOld and minPosFromOld convert between the two scales for saved guides.) */
function minPx(pos) {
  const t = (pos == null ? minPos : pos) / 100;
  // (on the picture as it came: an enlarged one's sections are srcK² times as many pixels, v303)
  return Math.round(MIN_LO * Math.pow(MIN_HI / MIN_LO, t) * srcK * srcK);
}
function minPosOld(pos) {
  const px = MIN_LO * Math.pow(MIN_HI / MIN_LO, pos / 100);
  return Math.round(100 * Math.sqrt(Math.max(0, px - 2) / 1998));
}
function minPosFromOld(old) {
  const t = old / 100,
    px = 2 + t * t * 1998;
  return Math.max(0, Math.min(100, Math.round((100 * Math.log(px / MIN_LO)) / Math.log(MIN_HI / MIN_LO))));
}
function counted(l) {
  const c = comps[l];
  if (!c || c.merged) return false;
  if (sfmode !== 'review') {
    if (assignData && assignData.assign)
      return assignData.assign[l] !== undefined || !!(assignData.paper && assignData.paper[l]);
    return !c.bg;
  }
  const s = secState[l];
  if (s === 1) return true;
  if (s === 2) return false;
  return !c.bg && c.area >= minPx();
}
function countedList() {
  const a = [];
  for (let l = 1; l < comps.length; l++) if (counted(l)) a.push(l);
  return a;
}
/* Temperature (the Colours tab): which markers are warm and which cool, by their hue as the eye sees it (L*C*h°).
   A clearly coloured marker is exactly one of the two: reds, oranges, yellows and red-violets are warm; greens
   (yellow-greens too), blues and violets cool. The two lines are at hue 112° (where yellow turns yellow-green) and
   326° (between violet and red-violet). A grey goes by its faint tint the same way (Warm Greys warm, Cool and
   Green Greys cool); one with no tint to speak of (chroma under TEMP_NEUTRAL_C), and black, is both.
   (It used to go by the hex colour's HSL hue, which left some yellow-greens in neither, put a red-violet in both,
   and put greys wherever their accidental HSL hue fell.) */
const TEMP_COOL_FROM = 112,
  TEMP_WARM_FROM = 326,
  TEMP_NEUTRAL_C = 2.5,
  TEMP_BLACK_L = 20;
// 'warm', 'cool' or 'both'
function markerTemp(m) {
  const x = mLch(m);
  if (x[1] < TEMP_NEUTRAL_C || (x[1] < GREY_C && x[0] < TEMP_BLACK_L)) return 'both';
  return x[2] >= TEMP_COOL_FROM && x[2] < TEMP_WARM_FROM ? 'cool' : 'warm';
}
function poolFor(pal) {
  let base = coll.filter(function (m) {
    return m.pass;
  });
  if (!base.length) base = coll.slice();
  if (pal === 'cool' || pal === 'warm')
    return base.filter(function (m) {
      const t = markerTemp(m);
      return t === pal || t === 'both';
    });
  return base;
}
function orderSections(cl) {
  const arr = cl.slice(),
    c = comps,
    N = arr.length;
  if (gradShape === 'vertical') {
    arr.sort(function (a, b) {
      return c[a].cx - c[b].cx || c[a].cy - c[b].cy;
    });
  } else if (gradShape === 'diagonal') {
    arr.sort(function (a, b) {
      return c[a].cx + c[a].cy - (c[b].cx + c[b].cy);
    });
  } else if (gradShape === 'radial') {
    // (from its centre: where you put it, else the middle of the zone's own extent, zBox, 34-zones)
    const rc = radCentre(),
      mx = rc.x,
      my = rc.y;
    arr.sort(function (a, b) {
      return Math.hypot(c[a].cx - mx, c[a].cy - my) - Math.hypot(c[b].cx - mx, c[b].cy - my);
    });
  } else if (gradShape === 'around') {
    // (v305) round Radial's centre, clockwise from the top; at the same angle, outwards
    const rc = radCentre(),
      ang = {},
      rad = {};
    arr.forEach(function (l) {
      let t = Math.atan2(c[l].cy - rc.y, c[l].cx - rc.x) + Math.PI / 2;
      if (t < 0) t += 2 * Math.PI;
      ang[l] = t;
      rad[l] = Math.hypot(c[l].cx - rc.x, c[l].cy - rc.y);
    });
    arr.sort(function (a, b) {
      return ang[a] - ang[b] || rad[a] - rad[b] || a - b;
    });
  } else {
    const rowH = Math.max(1, zbH() / Math.max(1, Math.round(Math.sqrt(N || 1)))),
      y0 = zbY0();
    arr.sort(function (a, b) {
      const ra = Math.floor((c[a].cy - y0) / rowH),
        rb = Math.floor((c[b].cy - y0) / rowH);
      if (ra !== rb) return ra - rb;
      const d = ra % 2 === 0 ? 1 : -1;
      return d * (c[a].cx - c[b].cx);
    });
  }
  if (dir < 0) arr.reverse();
  return arr;
}
function applyLocks() {
  if (!assignData) return;
  const bk = {};
  coll.forEach(function (m) {
    bk[m.mkey] = m;
  });
  for (const l in locks) {
    if (assignData.assign[l] !== undefined) {
      const m = bk[locks[l]];
      if (m) assignData.assign[l] = m;
    }
  }
}
/* ---- the Gradient pattern ----
   Markers are chosen and ordered by how they look (L*C*h° and CIEDE2000, colour.js), then laid along the flow.
   Which markers (gradPlan): from your own markers, as many as the marker count or the sections, whichever is fewer;
   clearly coloured ones first (greys only when there aren't enough), and with markers to spare the clearer mid-range
   ones (gradTierPool). A saved or generated palette keeps its own markers (fewer only when there are fewer sections).
   How they're laid (the Look): the markers go in groups of g, one group to each band along the flow
   (gradGroupSize). With g = 1 it's a smooth run, one marker after the next; with more, each band runs light to dark
   across the flow (its light side facing the sun when there's shading, else the top; round each ring for Radial),
   so neighbours both along and across a band stay close. Auto grows g as the markers near one per section.
   Loop or ramp: markers that go right round the colour wheel run as a loop, cut where its step is widest (Shuffle
   turns its start); a narrower set runs as an open ramp from its lighter end (Shuffle picks other markers where
   there's a near choice, or rolls a new generated palette; a saved palette's ramp has nothing to shuffle).
   Where one marker (or band) hands over to the next goes by the sections' area, so each covers about its share of
   the picture. Direction turns the flow round either way. */
const _lchMemo = new WeakMap();
// a marker's L*C*h° (worked out once per marker)
function mLch(m) {
  let v = _lchMemo.get(m);
  if (!v) {
    v = lchOf(m.lab || [50, 0, 0]);
    _lchMemo.set(m, v);
  }
  return v;
}
function isGreyM(m) {
  return mLch(m)[1] < GREY_C;
}
function notGreyM(m) {
  return mLch(m)[1] >= GREY_C;
}
function byLightFirst(a, b) {
  return mLch(b)[0] - mLch(a)[0];
}
function byHue(a, b) {
  return mLch(a)[2] - mLch(b)[2];
}
// markers per band: Smooth 1; Light to dark about the square root of the markers (at least 3); Auto 1 while each
// marker covers three or more sections, growing to Light to dark's as they near one per section (Serpentine's rows
// stay smooth)
function gradGroupSize(lk, M, N, shape) {
  if (M < 2 || lk === 'smooth') return 1;
  const big = Math.min(M, Math.max(3, Math.round(Math.sqrt(M))));
  if (lk === 'ltd') return big;
  if (shape === 'serpentine') return 1;
  const r = Math.min(1, M / Math.max(1, N)),
    t = Math.max(0, Math.min(1, (r - 0.3) / 0.5));
  return Math.max(1, Math.round(1 + (big - 1) * t));
}
// the widest gap round the hue circle between these (sorted) hues: [its size, the index of the hue after it]
function hueGap(hs) {
  if (!hs.length) return [360, 0];
  let gw = 360 - hs[hs.length - 1] + hs[0],
    gi = 0;
  for (let i = 1; i < hs.length; i++)
    if (hs[i] - hs[i - 1] > gw) {
      gw = hs[i] - hs[i - 1];
      gi = i;
    }
  return [gw, gi];
}
function huesOf(ms) {
  return ms
    .filter(notGreyM)
    .map(function (m) {
      return mLch(m)[2];
    })
    .sort(function (a, b) {
      return a - b;
    });
}
// markers go right round the colour wheel (a loop) when no gap between their colours' hues is this wide
const GRAD_LOOP_GAP = 100;
function gradIsLoop(ms) {
  const hs = huesOf(ms);
  return hs.length >= 3 && hueGap(hs)[0] < GRAD_LOOP_GAP;
}
// the coloured ones in hue order, starting after the widest gap
function hueRun(ms) {
  const s = ms.filter(notGreyM).sort(byHue),
    gi = hueGap(
      s.map(function (m) {
        return mLch(m)[2];
      }),
    )[1];
  return s.slice(gi).concat(s.slice(0, gi));
}
// k of these, spread evenly through the list
function evenPick(list, k) {
  if (k >= list.length) return list.slice();
  const out = [];
  for (let i = 0; i < k; i++) out.push(list[Math.floor(((i + 0.5) * list.length) / k)]);
  return out;
}
// With markers to spare, the clearer mid-range ones: the tightest of these ([chroma at least, lightness from, to])
// that still has `need`, else all the coloured ones; greys only when there aren't `need` coloured (spread through
// their lightness)
const GRAD_TIERS = [
  [30, 42, 84],
  [25, 38, 86],
  [20, 34, 90],
];
function gradTierPool(pool, need) {
  const col = pool.filter(notGreyM);
  if (col.length >= need) {
    for (let i = 0; i < GRAD_TIERS.length; i++) {
      const T = GRAD_TIERS[i],
        f = col.filter(function (m) {
          const x = mLch(m);
          return x[1] >= T[0] && x[0] >= T[1] && x[0] <= T[2];
        });
      if (f.length >= need) return f;
    }
    return col;
  }
  return col.concat(evenPick(pool.filter(isGreyM).sort(byLightFirst), need - col.length));
}
// a repeatable run of random numbers from 0 to 1, from a seed from 0 to 1 (Shuffle's gradSeed)
function seededRandom(seed) {
  let a = Math.floor(seed * 4294967296) >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hueDiff(h, t) {
  const d = Math.abs(h - t) % 360;
  return Math.min(d, 360 - d);
}
// One marker per band, from your markers: K hues evenly round the wheel (for a ramp, along the stretch of it the
// markers cover), each the marker near it in hue with a lightness near the middle of them all and a clear colour,
// so they run smoothly at much the same lightness. rnd (a ramp's Shuffle) picks at random among the near-equal ones.
const GRAD_NEAR = 6;
// (v306) With shading on (zs: the zone's shading), a marker the shading can't give a lighter and darker partner
// (gradShadeOK) costs GRAD_SH_COST more, and the 12 nearest are looked at instead of 8: Honolulu 48 at 16 markers went
// from 8 to 14 of 16 that shade, with less clash
const GRAD_SH_COST = 15,
  GRAD_SH_NEAR = 12;
function gradPickSpread(src, K, loop, rnd, zs) {
  const col = src.filter(notGreyM);
  if (col.length <= K) return src.slice(0, K);
  const n = col.length,
    hv = huesOf(col),
    gap = hueGap(hv),
    h0 = hv[gap[1]],
    span = loop ? 360 : 360 - gap[0],
    Ls = col
      .map(function (m) {
        return mLch(m)[0];
      })
      .sort(function (a, b) {
        return a - b;
      }),
    Lmed = Ls[n >> 1],
    used = new Uint8Array(n),
    out = [],
    NEAR = zs ? GRAD_SH_NEAR : 8,
    shOK = zs ? new Int8Array(n).fill(-1) : null;
  for (let k = 0; k < K; k++) {
    const th = (h0 + (loop ? (360 * k) / K : K > 1 ? (span * k) / (K - 1) : 0)) % 360,
      near = [];
    // the 8 (12 with shading) unused markers nearest this hue, and what each would cost
    for (let i = 0; i < n; i++) {
      if (used[i]) continue;
      const d = hueDiff(mLch(col[i])[2], th);
      if (near.length < NEAR || d < near[near.length - 1][0]) {
        near.push([d, i]);
        near.sort(function (a, b) {
          return a[0] - b[0];
        });
        if (near.length > NEAR) near.pop();
      }
    }
    if (!near.length) break;
    const cost = near.map(function (e) {
      const x = mLch(col[e[1]]);
      let v = e[0] + Math.abs(x[0] - Lmed) * 0.8 - x[1] * 0.15;
      if (zs) {
        if (shOK[e[1]] < 0) shOK[e[1]] = gradShadeOK(col[e[1]], zs) ? 1 : 0;
        if (!shOK[e[1]]) v += GRAD_SH_COST;
      }
      return v;
    });
    let b = 0;
    for (let q = 1; q < near.length; q++) if (cost[q] < cost[b]) b = q;
    if (rnd) {
      const ok = [];
      for (let q = 0; q < near.length; q++) if (cost[q] <= cost[b] + GRAD_NEAR) ok.push(q);
      b = ok[Math.floor(rnd() * ok.length)];
    }
    used[near[b][1]] = 1;
    out.push(col[near[b][1]]);
  }
  return out;
}
// Bands of several markers, from your markers: M spread evenly through them in hue order (so each band's stretch of
// hues holds its share of your markers); rnd (a ramp's Shuffle) picks at random within each one's share
function gradPickField(src, M, rnd) {
  const hs = src.filter(notGreyM).sort(byHue);
  if (M >= hs.length) return src.slice(0, M);
  const out = [];
  for (let i = 0; i < M; i++) {
    const a = Math.floor((i * hs.length) / M),
      b = Math.max(a + 1, Math.floor(((i + 1) * hs.length) / M));
    out.push(hs[rnd ? a + Math.floor(rnd() * (b - a)) : (a + b - 1) >> 1]);
  }
  return out;
}
/* ---- (v306) Palette's Rainbow scheme: the Gradient's own picking, for the Palette screen ----
   n colours evenly round the rainbow at similar lightness, picked as the Gradient picks one marker per band from your
   markers (gradTierPool, then gradPickSpread's targets and costs, in gradSequence's order), so at the same count a
   Rainbow palette is the Gradient's markers in the Gradient's order, and a guide laid from it lays them so. Three
   differences, all Palette's: two colours closer than RAINBOW_NEED (CIEDE2000) are avoided where another marker near
   that hue will do (Ben's thin teal–cyan stretch gave B111 and B112, 3.9 apart, at 16); `locked` markers (palette
   place → marker index) stay in their places and the free colours are picked round them (each takes the target hue
   nearest it); and `seed` (0 to 1; 0 or none is the Gradient's own pick) picks at random among the near-equal
   markers, so Generate rolls another rainbow. At most as many colours as there are clear markers.
   `idxs`: the markers in play (marker indexes); `mood`: a MOOD_KEYS key. Returns marker indexes in palette order. */
const RAINBOW_NEED = 5;
function rainbowPick(n, mood, idxs, opt) {
  opt = opt || {};
  const all = idxs.map(function (i) {
      return { i: i, mkey: mkey(i), lab: hexToLab(COLORS[i].hex), fam: COLORS[i].fam };
    }),
    locked = opt.locked || {},
    lockIdx = [];
  for (const p in locked)
    if (+p < n && locked[p] != null && lockIdx.indexOf(locked[p]) < 0) lockIdx.push(locked[p]);
  const pre = lockIdx.map(function (i) {
      return (
        all.find(function (m) {
          return m.i === i;
        }) || { i: i, mkey: mkey(i), lab: hexToLab(COLORS[i].hex), fam: COLORS[i].fam }
      );
    }),
    list = all.filter(function (m) {
      return lockIdx.indexOf(m.i) < 0;
    }),
    pool = moodPick(list, MOOD_KEYS.indexOf(mood) >= 0 ? mood : 'neutral', n, mLch).items,
    K = Math.min(n, pool.filter(notGreyM).length + pre.length);
  if (K < 1) return [];
  const tier = gradTierPool(pool, K - pre.length),
    loop = gradIsLoop(tier.concat(pre)),
    picks = rainbowSpread(tier, K, loop, opt.seed > 0 ? seededRandom(opt.seed) : null, pre),
    seq = gradSequence(picks, 1, loop),
    out = new Array(K).fill(-1);
  for (const p in locked) if (+p < K && locked[p] != null && out.indexOf(locked[p]) < 0) out[+p] = locked[p];
  let q = 0;
  for (const m of seq) {
    if (lockIdx.indexOf(m.i) >= 0) continue;
    while (q < K && out[q] >= 0) q++;
    if (q < K) out[q] = m.i;
  }
  return out.filter(function (i) {
    return i >= 0;
  });
}
// gradPickSpread's picking (the same targets, nearest 8 and costs), with the markers in `pre` already placed, each on
// the free target hue nearest it, and never a marker within RAINBOW_NEED of one placed while one further off is near
function rainbowSpread(src, K, loop, rnd, pre) {
  const col = src.filter(notGreyM);
  if (!pre.length && col.length <= K) return src.slice(0, K);
  const n = col.length,
    hv = huesOf(col.length ? col : pre),
    gap = hueGap(hv),
    h0 = hv[gap[1]],
    span = loop ? 360 : 360 - gap[0],
    Ls = col
      .map(function (m) {
        return mLch(m)[0];
      })
      .sort(function (a, b) {
        return a - b;
      }),
    Lmed = Ls[n >> 1],
    used = new Uint8Array(n),
    out = pre.slice(),
    th = [],
    free = [];
  for (let k = 0; k < K; k++) th.push((h0 + (loop ? (360 * k) / K : K > 1 ? (span * k) / (K - 1) : 0)) % 360);
  const taken = new Uint8Array(K);
  pre.forEach(function (m) {
    let b = -1;
    for (let k = 0; k < K; k++)
      if (!taken[k] && (b < 0 || hueDiff(mLch(m)[2], th[k]) < hueDiff(mLch(m)[2], th[b]))) b = k;
    if (b >= 0) taken[b] = 1;
  });
  for (let k = 0; k < K; k++) if (!taken[k]) free.push(k);
  for (const k of free) {
    // the 8 unused markers nearest this hue (as gradPickSpread), less those too close to one placed; when all 8
    // are, the 8 nearest that aren't; when every one is, the 8 nearest
    const close = function (i) {
        return out.some(function (o) {
          return de2000(o.lab, col[i].lab) < RAINBOW_NEED;
        });
      },
      nearest = function (ok) {
        const a = [];
        for (let i = 0; i < n; i++) {
          if (used[i] || !ok(i)) continue;
          const d = hueDiff(mLch(col[i])[2], th[k]);
          if (a.length < 8 || d < a[a.length - 1][0]) {
            a.push([d, i]);
            a.sort(function (x, y) {
              return x[0] - y[0];
            });
            if (a.length > 8) a.pop();
          }
        }
        return a;
      },
      any = function () {
        return true;
      },
      far = function (i) {
        return !close(i);
      };
    let near = nearest(any);
    const keep = near.filter(function (e) {
      return !close(e[1]);
    });
    if (keep.length) near = keep;
    else if (near.length) {
      const f = nearest(far);
      if (f.length) near = f;
    }
    if (!near.length) break;
    const cost = near.map(function (e) {
      const x = mLch(col[e[1]]);
      return e[0] + Math.abs(x[0] - Lmed) * 0.8 - x[1] * 0.15;
    });
    let b = 0;
    for (let q = 1; q < near.length; q++) if (cost[q] < cost[b]) b = q;
    if (rnd) {
      const ok = [];
      for (let q = 0; q < near.length; q++) if (cost[q] <= cost[b] + GRAD_NEAR) ok.push(q);
      b = ok[Math.floor(rnd() * ok.length)];
    }
    used[near[b][1]] = 1;
    out.push(col[near[b][1]]);
  }
  return out;
}
// the colour differences between these markers, n × n
function deMatrix(ms) {
  const n = ms.length,
    D = new Float32Array(n * n);
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) D[i * n + j] = D[j * n + i] = de2000(ms[i].lab, ms[j].lab);
  return D;
}
// The smoothest order of n colours (D their differences): `init` (an order to start from) and nearest neighbour
// from a few starts, each shortened by 2-opt (turning round a stretch wherever that makes the whole shorter),
// keeping the best. After GRAD_TOUR_WORK steps of work it stops improving and keeps the best so far, so hundreds of
// markers can't freeze the page. Counted in steps, not on the clock (v306): with a time limit a slower iPad, or a
// busy one, stopped sooner and laid a different guide from the same settings. A loop, unless `open`: then its ends
// are free (a loop through one more stop that is no distance from any colour, cut there).
const GRAD_TOUR_WORK = 3e7;
let gradTourWork = 0;
function gradTour(D, n, open, init) {
  const idx = [];
  for (let i = 0; i < n; i++) idx.push(i);
  if (n < 3) return idx;
  let m = n,
    E = D;
  if (open) {
    m = n + 1;
    E = new Float32Array(m * m);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) E[i * m + j] = D[i * n + j];
    if (init) init = init.concat([n]);
  }
  let work = 0;
  function len(t) {
    let L = 0;
    for (let q = 0; q < m; q++) L += E[t[q] * m + t[(q + 1) % m]];
    return L;
  }
  function nearest(st) {
    const t = [st],
      used = new Uint8Array(m);
    used[st] = 1;
    work += m * m;
    while (t.length < m) {
      const l = t[t.length - 1] * m;
      let bj = -1,
        bd = Infinity;
      for (let j = 0; j < m; j++)
        if (!used[j] && E[l + j] < bd) {
          bd = E[l + j];
          bj = j;
        }
      t.push(bj);
      used[bj] = 1;
    }
    return t;
  }
  function twoOpt(t) {
    let imp = true;
    while (imp) {
      imp = false;
      for (let i = 0; i < m - 1; i++) {
        if (work >= GRAD_TOUR_WORK) return;
        work += m - i;
        const A = t[i] * m,
          B = t[i + 1];
        for (let k = i + 2; k < m; k++) {
          if (k + 1 === m && i === 0) continue;
          const C = t[k],
            F = t[(k + 1) % m];
          if (E[A + C] + E[B * m + F] < E[A + B] + E[C * m + F] - 1e-6) {
            work += k - i;
            for (let x = i + 1, y = k; x < y; x++, y--) {
              const s = t[x];
              t[x] = t[y];
              t[y] = s;
            }
            imp = true;
            break;
          }
        }
      }
    }
  }
  const starts = init ? [init.slice()] : [],
    S = m <= 40 ? m : 3;
  for (let s = 0; s < S; s++) starts.push(Math.floor((s * m) / S));
  let best = null,
    bl = Infinity;
  for (let s = 0; s < starts.length; s++) {
    if (best && work >= GRAD_TOUR_WORK) break;
    const t = typeof starts[s] === 'number' ? nearest(starts[s]) : starts[s];
    twoOpt(t);
    const L = len(t);
    if (L < bl - 1e-6) {
      bl = L;
      best = t;
    }
  }
  gradTourWork = work;
  if (open) {
    const z = best.indexOf(n);
    best = best.slice(z + 1).concat(best.slice(0, z));
  }
  return best;
}
// Markers in the order they run: a loop cut where its step is widest, a ramp from its lighter end. Bands of several
// on a loop run round the hue circle from its widest gap (any greys after, light to dark).
// (the last few worked out, by their markers: the Pattern tab's Start colour asks for the same one the guide was just
// laid with, and working out hundreds of markers' differences and tour again took as long as laying the guide, v304)
const _seqMemo = new Map();
function gradSequence(ms, g, loop) {
  const key =
    (loop ? 'L' : 'R') +
    (loop && g > 1 ? 'b' : '') +
    ms
      .map(function (m) {
        return m.mkey;
      })
      .join(',');
  let v = _seqMemo.get(key);
  if (!v) {
    v = _gradSequence(ms, g, loop).map(function (m) {
      return m.mkey;
    });
    if (_seqMemo.size >= 6) _seqMemo.delete(_seqMemo.keys().next().value);
    _seqMemo.set(key, v);
  }
  const by = {};
  ms.forEach(function (m) {
    by[m.mkey] = m;
  });
  return v.map(function (k) {
    return by[k];
  });
}
function _gradSequence(ms, g, loop) {
  const init = hueRun(ms).concat(ms.filter(isGreyM).sort(byLightFirst));
  if (init.length < 3 || (loop && g > 1)) return init;
  const n = init.length,
    D = deMatrix(init),
    ix = [];
  for (let i = 0; i < n; i++) ix.push(i);
  let t = gradTour(D, n, !loop, ix);
  if (loop) {
    let gi = 0,
      gw = -1;
    for (let i = 0; i < n; i++) {
      const d = D[t[i] * n + t[(i + 1) % n]];
      if (d > gw) {
        gw = d;
        gi = (i + 1) % n;
      }
    }
    t = t.slice(gi).concat(t.slice(0, gi));
  } else if (init[t[0]].lab[0] < init[t[n - 1]].lab[0]) t.reverse();
  return t.map(function (i) {
    return init[i];
  });
}
// The gradient's markers in the order they run, how many to a band and whether they loop: { seq, g, loop }. src is
// where they come from (poolSource); N the sections.
function gradPlan(src, N) {
  const pool = src.items,
    cnt = gradCount(src, N),
    M = cnt.M,
    g = gradGroupSize(look, M, N, gradShape);
  let loop,
    seq,
    shp = false;
  if (src.seeded) {
    loop = gradIsLoop(pool);
    seq = gradSequence(pool, g, loop);
    if (seq.length > M) seq = evenPick(seq, M);
  } else {
    const tier = gradTierPool(pool, M),
      rnd = gradSeed > 0 ? seededRandom(gradSeed) : null;
    loop = gradIsLoop(tier);
    // (shading-aware picks, v306: one marker to a band, with shading on as it's laid)
    shp = g === 1 && gradShpOn();
    seq = gradSequence(
      g === 1
        ? gradPickSpread(tier, M, loop, loop ? null : rnd, shp ? zsh(zoneLive()) : null)
        : gradPickField(tier, M, loop ? null : rnd),
      g,
      loop,
    );
  }
  // (base: the loop from its smoothest start, where its widest step falls at the two ends; nc: how many of it go
  // round; r: how far round the start is turned. The Start colour slider shows base and moves r.)
  let base = null,
    nc = 0,
    r = 0;
  if (loop && seq.length > 1) {
    // Shuffle, or the Start colour slider, turns the loop's start (with bands of several, only the coloured markers
    // go round)
    base = seq;
    nc = g > 1 ? seq.filter(notGreyM).length : seq.length;
    r = gradStartOf(nc);
    seq = seq.slice(r, nc).concat(seq.slice(0, r), seq.slice(nc));
  }
  return {
    seq: seq,
    g: Math.max(1, Math.min(g, seq.length)),
    loop: loop,
    base: base,
    nc: nc,
    r: r,
    reuse: cnt.reuse,
    shp: shp,
  };
}
/* How many markers the Gradient lays: the marker count's worth, or fewer with fewer sections or markers. { M, reuse }.
   v306 (U6): with the count at all your markers on a page with more sections than your clear markers (chroma 20 or
   more, lightness 34 to 90: GRAD_TIERS' widest), it lays just the clear ones, some on two sections (reuse), instead of
   reaching for greys and browns; the Earthy, Soft, Deep and Pastel Moods (whose colours aren't clear ones) and a
   palette are laid as before. On Ben's 448-section mandala: 268 clear markers instead of 448 with 86 greys. */
const GRAD_REUSE_MOODS = ['neutral', 'vivid'];
function gradClearM(m) {
  const x = mLch(m),
    T = GRAD_TIERS[GRAD_TIERS.length - 1];
  return x[1] >= T[0] && x[0] >= T[1] && x[0] <= T[2];
}
function gradCount(src, N) {
  const pool = src.items;
  let M = Math.max(1, Math.min(limitN, N, pool.length)),
    reuse = false;
  if (!src.seeded && GRAD_REUSE_MOODS.indexOf(emphasis) >= 0 && limitN >= sliderMax()) {
    let k = 0;
    for (let i = 0; i < pool.length; i++) if (gradClearM(pool[i])) k++;
    if (k >= 2 && k < N) {
      M = k;
      reuse = true;
    }
  }
  return { M: M, reuse: reuse };
}
// the Gradient's marker count for the zone being edited, as gradPlan finds it (for the Colours and Pattern tabs)
function gradCountNow() {
  const N = zoneList().length;
  return gradCount(poolSource(Math.min(limitN, N), true), N);
}
/* Shading-aware picks (U7, v306): a Gradient laid with shading on (Main's or the zone's) prefers markers the shading
   has a lighter and darker partner for (gradShadeOK: shadeTones' own test). Turning shading on never picks again by
   itself: re-laying a gradient to face the light keeps how its markers were picked (_shpForce, from assignData's
   shp / shps), and the Shading tab offers "Pick shadeable ones" instead (gradShadeOffer). */
let _shpForce = null;
function gradShpOn() {
  const z = zoneLive();
  if (_shpForce) return !!_shpForce[z];
  return shadeMode !== 'off' && zsh(z).on;
}
// how a zone's markers were picked the last time it was laid (true: shading-aware)
function gradShpOf(id) {
  if (!assignData) return false;
  if (assignData.shps) return !!assignData.shps[id];
  return !id && !!assignData.shp;
}
function gradShadeOK(m, zs) {
  const t = shadeTones(m, zs);
  return !!t.dark && (shadeMode !== 'full' || !!t.light || !!t.paper);
}
// how far round a loop of n starts: gradSeed is kept as a share of the way round (0 is the smoothest start), so a
// start stays about where it was when the marker count changes
function gradStartOf(n) {
  return Math.floor((gradSeed || 0) * n) % Math.max(1, n);
}
// the Start colour slider's choice: the loop's k-th marker first (the middle of its share, so it reads back as k)
function gradStartSet(k, n) {
  gradSeed = k > 0 && n > 1 ? (k + 0.5) / n : 0;
}
// For the Pattern tab: the Gradient's loop as it would run now ({ cols, n, r }: the markers going round from the
// smoothest start, how many, which one comes first), or null when it runs as an open ramp (not right round the
// colour wheel) or has too few markers to turn
function gradStartInfo() {
  if (family !== 'gradient' || !labels || !comps) return null;
  const N = zoneList().length;
  if (!N) return null;
  // (its markers picked as the guide's were: a guide laid before shading was turned on shows the loop it has)
  const f0 = _shpForce;
  _shpForce = {};
  _shpForce[zoneLive()] = assignData ? gradShpOf(zoneLive()) : gradShpOn();
  let p;
  try {
    p = gradPlan(poolSource(Math.min(limitN, N), true), N);
  } finally {
    _shpForce = f0;
  }
  if (!p.loop || !p.base || p.nc < 3) return null;
  return { cols: p.base.slice(0, p.nc), n: p.nc, r: p.r };
}
// items (sections, in order) cut into parts: part k takes shares[k] of the whole area and at least mins[k] items;
// where one part hands over to the next goes by each section's middle in the running total of area
function splitByArea(items, shares, mins) {
  const n = items.length,
    K = shares.length,
    mid = new Float64Array(n),
    out = [];
  let acc = 0,
    sh = 0,
    need = 0;
  for (let i = 0; i < n; i++) {
    const a = Math.max(1, comps[items[i]].area || 1);
    mid[i] = acc + a / 2;
    acc += a;
  }
  for (let k = 0; k < K; k++) {
    sh += shares[k];
    need += mins[k];
  }
  let start = 0,
    p = 0,
    cum = 0;
  for (let k = 0; k < K; k++) {
    need -= mins[k];
    cum += shares[k];
    let end = n;
    if (k < K - 1) {
      const cut = (acc * cum) / sh;
      while (p < n && mid[p] < cut) p++;
      end = Math.min(n - need, Math.max(start + mins[k], p));
    }
    out.push(items.slice(start, end));
    start = end;
  }
  return out;
}
// Which way a band runs light to dark across the flow (+1 or -1 along the line across it): its light side faces the
// sun when the zone is shaded by it, else the top (a flat zone, or light from the photo, has no sun to face). 0 for
// Radial, whose rings run light to dark and back.
function gradLightSign() {
  if (gradShape === 'radial' || gradShape === 'around') return 0;
  const ax = gradShape === 'diagonal' ? [Math.SQRT1_2, -Math.SQRT1_2] : [0, 1];
  let d = 0;
  // (where the sun is from the middle of the extent the flow runs over: the zone's, or the picture's)
  if (shadeMode !== 'off' && zsh(zoneLive()).on && !shadeFromPhoto())
    d =
      (shadeSun.x * (W || 1) - (zbX0() + zbW() / 2)) * ax[0] +
      (shadeSun.y * (H || 1) - (zbY0() + zbH() / 2)) * ax[1];
  if (Math.abs(d) < 1e-9) d = -ax[1];
  return d > 0 ? 1 : -1;
}
// Radial's centre in the picture: where you put it (radC), else the middle of the extent the flow runs over
function radCentre() {
  return radC ? { x: radC.x * W, y: radC.y * H } : { x: zbX0() + zbW() / 2, y: zbY0() + zbH() / 2 };
}
// where a section sits across its band: smaller is nearer the light side (for Radial, round its ring)
function gradAcross(sign) {
  const c = comps;
  // (Around: from the centre outwards)
  if (gradShape === 'around') {
    const rc = radCentre();
    return function (l) {
      return Math.hypot(c[l].cx - rc.x, c[l].cy - rc.y);
    };
  }
  if (gradShape === 'radial') {
    const rc = radCentre();
    return function (l) {
      return Math.atan2(c[l].cy - rc.y, c[l].cx - rc.x);
    };
  }
  const ax = gradShape === 'diagonal' ? [Math.SQRT1_2, -Math.SQRT1_2] : [0, 1];
  return function (l) {
    return -sign * (c[l].cx * ax[0] + c[l].cy * ax[1]);
  };
}
// Around with markers that don't go right round the colour wheel (a warm or cool Temperature, a narrow palette): out
// and back (every other marker one way, the rest back), so the ends meet where the flow comes round to its start
// with no seam, as Radial's rings run light to dark and back
function outAndBack(seq) {
  const ev = [],
    od = [];
  seq.forEach(function (m, q) {
    (q % 2 ? od : ev).push(m);
  });
  return ev.concat(od.reverse());
}
function buildGradient(cl) {
  // (the guide as it was: the other zones' markers, which rough spots' new markers keep clear of)
  const prevAll = assignData,
    N = cl.length,
    order = orderSections(cl),
    src = poolSource(Math.min(limitN, N)),
    plan = gradPlan(src, N),
    seq = gradShape === 'around' && !plan.loop && plan.seq.length > 2 ? outAndBack(plan.seq) : plan.seq,
    M = seq.length,
    K = Math.max(1, Math.round(M / plan.g)),
    groups = [],
    sizes = [],
    assign = {};
  for (let k = 0; k < K; k++) {
    const grp = seq.slice(Math.floor((k * M) / K), Math.floor(((k + 1) * M) / K));
    groups.push(grp);
    sizes.push(grp.length);
  }
  const sign = plan.g > 1 ? gradLightSign() : 0,
    across = gradAcross(sign),
    bands = M && N ? splitByArea(order, sizes, sizes) : [];
  for (let b = 0; b < bands.length; b++) {
    let secs = bands[b],
      grp = groups[b];
    if (grp.length > 1) {
      const key = {};
      secs.forEach(function (l) {
        key[l] = across(l);
      });
      secs = secs.slice().sort(function (x, y) {
        return key[x] - key[y];
      });
      grp = grp.slice().sort(byLightFirst);
      // round a ring: light to dark and back, so its two ends meet
      if (gradShape === 'radial') {
        const ev = [],
          od = [];
        grp.forEach(function (m, q) {
          (q % 2 ? od : ev).push(m);
        });
        grp = ev.concat(od.reverse());
      }
    }
    const ones = grp.map(function () {
        return 1;
      }),
      parts = splitByArea(secs, ones, ones);
    for (let q = 0; q < parts.length; q++)
      for (let j = 0; j < parts[q].length; j++) assign[parts[q][j]] = grp[q];
  }
  // Scatter, Textured and up: the markers laid again, mixed within their band of the run and strayed across bands
  // (Around's two ends meet, so its run goes round as a loop)
  const scat = gradScatAt(M);
  gradScatLast = null;
  if (scat >= 2 && N > 2) {
    const t0 = Date.now();
    gradScatter(order, assign, plan.loop || gradShape === 'around', seq, scat);
    gradScatLast.ms = Date.now() - t0;
  }
  assignData = { assign: assign, order: order, N: N, base: Object.assign({}, assign) };
  // (which way its bands' light side faces, for gradFollowLight: not once Scatter has mixed them, so moving the sun
  // never lays a scattered guide again)
  if (sign && scat < 2) assignData.lit = sign;
  // (its markers picked with shading in mind: kept so when it's laid again to face the light)
  if (plan.shp) assignData.shp = 1;
  applyLocks();
  gradPinClear(order, seq, M >= N && !plan.reuse);
  gradSmoothLast = null;
  gradFixLast = null;
  // (the Gradient's own: not the Photo pattern before it has a photo) Polished: smoothed, and with markers used twice
  // (gradCount's reuse) touching sections sharing one count as a clash; Natural and Scatter: only those split up
  // (v307: the Photo pattern before it has a photo, which lays the Gradient as Natural, has its repeats split up too)
  if (family === 'gradient' && scat === 0)
    gradSmooth(order, M >= N, limitN >= src.items.length, plan.reuse ? 'reuse' : '');
  else if (plan.reuse) gradSmooth(order, false, true, 'split');
  // (v307) markers used twice: what the smoothing left of touching sections sharing one is split up for good
  gradSameLast = null;
  if (plan.reuse) gradSplitSame(order);
  // rough spots smoothed ("Smooth them"), after the Polished pass, so a change that lays it again keeps them
  if (family === 'gradient' && scat === 0 && gradFix) gradFixApply(order, src, prevAll);
}
/* Markers used twice (gradCount's reuse, v307): the smoothing splits up most touching sections that share a marker,
   but runs out of passes on a big page (11 such pairs on a 954-section page, 48 on one of 1,423). This last pass goes
   through the flow in order and, for each pair still sharing one, gives one of the two another of the guide's markers
   that no section touching it has, the nearest in colour to the one it had (so the flow keeps its look). Of the two,
   the one that can move to the nearer marker moves (on a tie, the one met second); never the flow's first section
   (the Start colour), a pinned one or one with ink on the paper (laid as pinned: holdOn). Only the zone being laid:
   its sections, and the markers it lays. Deterministic: no clock, no draws. Saved guides keep their markers. */
let gradSameLast = null; // (what the last one did, for the tests: { before, after, moved })
function gradSplitSame(order) {
  if (!assignData || order.length < 3) return;
  const A = assignData.assign,
    B = assignData.base,
    a = adj || (adj = buildAdj()),
    inZ = new Set(order),
    ms = [],
    seen = {};
  order.forEach(function (l) {
    const m = A[l];
    if (m && !seen[m.mkey]) {
      seen[m.mkey] = 1;
      ms.push(m);
    }
  });
  const first = order[0],
    fixed = function (l) {
      return l === first || locks[l] !== undefined;
    },
    // the nearest of the guide's markers to s's own that no section touching s has (null: none)
    pick = function (s) {
      const own = A[s],
        near = {};
      a[s].forEach(function (x) {
        if (inZ.has(x) && A[x]) near[A[x].mkey] = 1;
      });
      let best = null,
        bd = Infinity;
      for (let i = 0; i < ms.length; i++) {
        const m = ms[i];
        if (m === own || near[m.mkey]) continue;
        const d = own.lab && m.lab ? deMk(own, m) : i;
        if (d < bd) {
          bd = d;
          best = m;
        }
      }
      return best ? { m: best, d: bd } : null;
    };
  let before = 0,
    after = 0,
    moved = 0;
  order.forEach(function (l) {
    const s = a[l];
    if (!s || !A[l]) return;
    s.forEach(function (q) {
      if (q <= l || !inZ.has(q) || !A[q] || A[q].mkey !== A[l].mkey) return;
      before++;
    });
  });
  gradSameLast = { before: before, after: 0, moved: 0 };
  if (!before) return;
  for (let i = 0; i < order.length; i++) {
    const l = order[i],
      s = a[l];
    if (!s || !A[l]) continue;
    const pairs = [];
    s.forEach(function (q) {
      if (inZ.has(q) && A[q] && A[q].mkey === A[l].mkey) pairs.push(q);
    });
    pairs.sort(function (x, y) {
      return x - y;
    });
    for (let k = 0; k < pairs.length; k++) {
      const q = pairs[k];
      if (A[q].mkey !== A[l].mkey) continue;
      const pl = fixed(l) ? null : pick(l),
        pq = fixed(q) ? null : pick(q);
      let mv = null;
      if (pl && (!pq || pl.d < pq.d)) mv = [l, pl.m];
      else if (pq) mv = [q, pq.m];
      if (!mv) continue;
      A[mv[0]] = mv[1];
      if (B) B[mv[0]] = mv[1];
      moved++;
      if (mv[0] === l) break;
    }
  }
  order.forEach(function (l) {
    const s = a[l];
    if (!s || !A[l]) return;
    s.forEach(function (q) {
      if (q <= l || !inZ.has(q) || !A[q] || A[q].mkey !== A[l].mkey) return;
      after++;
    });
  });
  gradSameLast = { before: before, after: after, moved: moved };
}
// A Gradient with a marker for every section (each): a section not pinned whose marker a pinned section has (the
// sections keeping their markers when the guide is built again, as Colour it on the paper round the drawing does, are
// laid as pinned: buildGuide) takes the nearest of the run's markers no section has instead, so it keeps clear of them
// (v306 debugging: Colour it gave the paper a marker another section kept, and the count said one more than there were)
function gradPinClear(order, seq, each) {
  if (!each || !assignData) return;
  const A = assignData.assign,
    pinned = {},
    on = {};
  let any = false;
  order.forEach(function (l) {
    if (!A[l]) return;
    on[A[l].mkey] = 1;
    if (locks[l] !== undefined) {
      pinned[A[l].mkey] = 1;
      any = true;
    }
  });
  if (!any) return;
  const spare = seq.filter(function (m) {
    return !on[m.mkey];
  });
  order.forEach(function (l) {
    const m = A[l];
    if (!m || locks[l] !== undefined || !pinned[m.mkey] || !spare.length) return;
    let bi = 0,
      bd = Infinity;
    spare.forEach(function (s, i) {
      const d = m.lab && s.lab ? de2000(m.lab, s.lab) : i;
      if (d < bd) {
        bd = d;
        bi = i;
      }
    });
    A[l] = spare.splice(bi, 1)[0];
    if (assignData.base) assignData.base[l] = A[l];
  });
}
// The Scatter laid with M markers: Gradient only, and Polished below GRAD_SCAT_MIN markers (with so few there are only
// two colour bands: Sparkle and Confetti came out the same and colours jumped wildly)
const GRAD_SCAT_MIN = 9;
function gradScatAt(M) {
  return family === 'gradient' && M >= GRAD_SCAT_MIN ? gradScat : 0;
}
/* Scatter (v306): 0 Polished (laid, then smoothed: gradSmooth, v305), 1 Natural (laid as v304 did, no smoothing),
   2 Textured, 3 Sparkle, 4 Confetti. For 2-4 the gradient is laid as Natural (the base), then:
   - the run of markers is cut into bands of about a tenth of the run each (GRAD_BANDS; fewer for a short run, at
     least 3 markers to a band), each cut moved to the nearest change of hue family (gradFamOf) within 30% of a band,
     so a band is about one hue family: the light and dark of one colour;
   - each section's place is its base band plus where it sits in that band (by area, along the flow), 0 to 1;
   - Sparkle and Confetti: a share of the sections (GRAD_STRAY) move to the band next door, or two away, either way,
     keeping where they sit in the band (round the run for a loop; turned back at the ends of a run that isn't);
   - the sections are sorted by their new place and cut by area into the bands (each band its markers' share, so
     every marker keeps its share of the picture);
   - Textured and on: within its band, the sections are in a random order and cut by area to the band's markers (any
     of the band's markers anywhere in it).
   Draws come from gradJit and the section's number. On Radial, sections of one ring (radius within a small gap of
   the last and within GRAD_RING[1] of the ring's first) and about the same area (within GRAD_RING[2] of the
   smallest) share one place and their draws, so petals stay matched. The flow's first section keeps its marker
   (Start colour); pins and coloured sections keep theirs (applyLocks, after). Saved guides keep their markers, so
   one laid at any stop reopens as it was. */
const GRAD_SCAT_LABEL = ['Polished', 'Natural', 'Textured', 'Sparkle', 'Confetti'];
const GRAD_SCAT_DESC = [
  '',
  'In flow order, with no clashes tidied away',
  'Light and dark of each colour mixed; bands stay crisp',
  'Textured, with flecks of the next colour along',
  'Colours stray further: confetti close up, a rainbow from afar',
];
const GRAD_BANDS = 10;
// [share of sections going to the next band, share going two bands away], by level
const GRAD_STRAY = [null, null, [0, 0], [0.3, 0], [0.3, 0.2]];
// rings on Radial: [gap, span] as parts of the largest radius, area ratio
const GRAD_RING = [0.005, 0.03, 1.35];
let gradScatLast = null; // (what the last one did, for the tests)
function gradHash(s, l, salt) {
  let h =
    Math.imul(s ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(l + 1, 0xc2b2ae35) ^ Math.imul(salt + 7, 0x27d4eb2f);
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function gradFamOf(m) {
  if (isGreyM(m)) return -1;
  const h = mLch(m)[2];
  // R 5-45, YR -75, Y -100, YG -130, G -170, BG -210, B -250, BV -290, V -330, RV -365
  const from = [5, 45, 75, 100, 130, 170, 210, 250, 290, 330];
  let f = 9;
  for (let i = 0; i < from.length; i++) if (h >= from[i]) f = i;
  return f;
}
function gradScatter(order, assign, loop, seq, lv) {
  const c = comps,
    s = Math.floor((gradJit || 0) * 4294967296) >>> 0,
    first = order[0],
    firstM = assign[first],
    used = new Set();
  order.forEach(function (l) {
    if (assign[l]) used.add(assign[l].mkey);
  });
  const seen = new Set(),
    mk = seq.filter(function (m) {
      if (!used.has(m.mkey) || seen.has(m.mkey)) return false;
      seen.add(m.mkey);
      return true;
    }),
    K = mk.length,
    F = Math.max(2, Math.min(GRAD_BANDS, Math.floor(K / 3)));
  // the bands of the run, each cut moved to a change of hue family nearby
  const fam = mk.map(gradFamOf),
    cut = [0];
  for (let k = 1; k < F; k++) {
    const ideal = Math.round((k * K) / F),
      r = Math.floor((0.3 * K) / F),
      lo = Math.max(cut[k - 1] + 1, ideal - r),
      hi = Math.min(K - (F - k), ideal + r);
    let best = Math.max(lo, Math.min(hi, ideal)),
      bd = Infinity;
    for (let j = lo; j <= hi; j++)
      if (fam[j] !== fam[j - 1] && Math.abs(j - ideal) < bd) {
        bd = Math.abs(j - ideal);
        best = j;
      }
    cut.push(best);
  }
  cut.push(K);
  const bandOf = new Map();
  for (let b = 0; b < F; b++) for (let i = cut[b]; i < cut[b + 1]; i++) bandOf.set(mk[i].mkey, b);
  const edge = cut.map(function (x) {
    return x / K;
  });
  const secs = order.filter(function (l) {
      return assign[l] && bandOf.has(assign[l].mkey);
    }),
    ns = secs.length,
    oi = new Map();
  secs.forEach(function (l, i) {
    oi.set(l, i);
  });
  // each section's place in its base band (by area along the flow), 0 to 1
  const inB = [];
  for (let b = 0; b < F; b++) inB.push([]);
  secs.forEach(function (l) {
    inB[bandOf.get(assign[l].mkey)].push(l);
  });
  const t = new Float64Array(ns),
    base = new Int32Array(ns);
  inB.forEach(function (list, b) {
    let acc = 0,
      run = 0;
    list.forEach(function (l) {
      acc += Math.max(1, c[l].area || 1);
    });
    list.forEach(function (l) {
      const a = Math.max(1, c[l].area || 1),
        i = oi.get(l);
      t[i] = b + (run + a / 2) / acc;
      base[i] = b;
      run += a;
    });
  });
  // rings (Radial): sections that share one place and their draws
  const gid = new Int32Array(ns).fill(-1);
  let ng = 0;
  if (gradShape === 'radial') {
    const rc = radCentre(),
      rr = secs.map(function (l, i) {
        return [i, Math.hypot(c[l].cx - rc.x, c[l].cy - rc.y)];
      });
    rr.sort(function (a, b) {
      return a[1] - b[1];
    });
    const R = rr.length ? rr[rr.length - 1][1] : 1,
      gap = GRAD_RING[0] * R,
      span = GRAD_RING[1] * R,
      rings = [];
    let cur = [],
      r0 = 0,
      rp = 0;
    rr.forEach(function (x) {
      if (cur.length && (x[1] - rp > gap || x[1] - r0 > span)) {
        rings.push(cur);
        cur = [];
      }
      if (!cur.length) r0 = x[1];
      cur.push(x[0]);
      rp = x[1];
    });
    if (cur.length) rings.push(cur);
    rings.forEach(function (ring) {
      ring.sort(function (a, b) {
        return (c[secs[a]].area || 1) - (c[secs[b]].area || 1);
      });
      let a0 = -1,
        g = -1,
        mem = [];
      const close = function () {
        if (mem.length > 1) {
          let m = 0;
          mem.forEach(function (i) {
            m += t[i];
          });
          m /= mem.length;
          mem.forEach(function (i) {
            t[i] = m;
            gid[i] = g;
          });
        }
      };
      ring.forEach(function (i) {
        const a = Math.max(1, c[secs[i]].area || 1);
        if (a0 < 0 || a > a0 * GRAD_RING[2]) {
          close();
          g = ng++;
          a0 = a;
          mem = [];
        }
        mem.push(i);
      });
      close();
    });
  }
  function draw(i, salt) {
    return gradHash(s, gid[i] >= 0 ? 1000000 + gid[i] : secs[i], salt);
  }
  // strays: the sections (a ring as one) in the order of a draw; the first GRAD_STRAY[lv][0] of them (by count) go
  // to the band next door, the next GRAD_STRAY[lv][1] two bands away, either way (so the share is the same for any
  // seed); then each section's new place along the run (0 to 1)
  const st = GRAD_STRAY[lv] || [0, 0],
    far = new Int8Array(ns),
    byU = [];
  for (let i = 1; i < ns; i++) byU.push(i);
  const uu = new Float64Array(ns);
  for (let i = 0; i < ns; i++) uu[i] = draw(i, 3);
  byU.sort(function (a, b) {
    return uu[a] - uu[b] || gid[a] - gid[b] || a - b;
  });
  let taken = 0;
  for (let q = 0; q < byU.length; q++) {
    const i = byU[q];
    // (a ring goes as one: it takes the step of its first section)
    const f = taken < st[0] * ns ? 1 : taken < (st[0] + st[1]) * ns ? 2 : 0;
    if (gid[i] >= 0 && q > 0 && gid[byU[q - 1]] === gid[i]) far[i] = far[byU[q - 1]];
    else far[i] = f;
    taken++;
  }
  const key = new Float64Array(ns),
    ix = [];
  for (let i = 0; i < ns; i++) {
    const sg = draw(i, 4) < 0.5 ? -1 : 1;
    let d = far[i] * sg;
    let tb = Math.floor(t[i]);
    const fr = Math.min(0.999999, t[i] - tb);
    if (tb >= F) tb = F - 1;
    if (loop) tb = (((tb + d) % F) + F) % F;
    else {
      if (tb + d < 0 || tb + d >= F) d = -d;
      tb = Math.max(0, Math.min(F - 1, tb + d));
    }
    key[i] = edge[tb] + fr * (edge[tb + 1] - edge[tb]);
    ix.push(i);
  }
  ix.sort(function (a, b) {
    return key[a] - key[b] || gid[a] - gid[b] || a - b;
  });
  const shares = [];
  for (let b = 0; b < F; b++) shares.push(cut[b + 1] - cut[b]);
  const bands = splitByArea(
    ix.map(function (i) {
      return secs[i];
    }),
    shares,
    shares,
  );
  const fin = new Int32Array(ns);
  for (let b = 0; b < F; b++) {
    const band = bands[b],
      ms = mk.slice(cut[b], cut[b + 1]);
    band.forEach(function (l) {
      fin[oi.get(l)] = b;
    });
    const k2 = new Map();
    band.forEach(function (l) {
      const i = oi.get(l);
      k2.set(l, draw(i, 2));
    });
    const sorted = band.slice().sort(function (x, y) {
      return k2.get(x) - k2.get(y) || gid[oi.get(x)] - gid[oi.get(y)] || oi.get(x) - oi.get(y);
    });
    const ones = ms.map(function () {
        return 1;
      }),
      parts = splitByArea(sorted, ones, ones);
    for (let q = 0; q < parts.length; q++)
      for (let j = 0; j < parts[q].length; j++) assign[parts[q][j]] = ms[q];
  }
  // the flow's first section keeps its marker: swap with the section of about its area that has it now
  if (firstM && assign[first] !== firstM) {
    const fa = c[first].area || 1;
    let best = null,
      bd = Infinity;
    secs.forEach(function (l) {
      if (assign[l] === firstM) {
        const d = Math.abs(Math.log((c[l].area || 1) / fa));
        if (d < bd) {
          bd = d;
          best = l;
        }
      }
    });
    if (best !== null) {
      assign[best] = assign[first];
      assign[first] = firstM;
    }
  }
  // (how far the sections strayed from their base band, for the tests)
  const cnt = [0, 0, 0];
  for (let i = 0; i < ns; i++) {
    let d = Math.abs(fin[i] - base[i]);
    if (loop) d = Math.min(d, F - d);
    cnt[Math.min(2, d)]++;
  }
  gradScatLast = {
    loop: !!loop,
    bands: F,
    sizes: shares,
    groups: ng,
    grouped: Array.from(gid).filter(function (g) {
      return g >= 0;
    }).length,
    n: ns,
    meant:
      Array.from(far).filter(function (f) {
        return f > 0;
      }).length / ns,
    stray1: cnt[1] / ns,
    stray2: cnt[2] / ns,
  };
}
/* Smoothing (v305): after the Gradient is laid, two sections near each other along the flow swap markers when that
   lowers the clash between touching sections (the sum of their CIEDE2000 differences squared). Gradient only: on
   Random it would undo "touching sections differ", and Blend is smooth already. Guards, so the gradient stays as
   laid:
   - each marker moves at most `win` places from where the flow put it, win = sections / 30 between 2 and 12 (a
     37-section page keeps its gradient: 12 places is a third of it);
   - the flow's first section keeps its marker, so the Start colour still starts the flow;
   - while a marker covers several sections, only sections within 1.5 times each other's area swap, so each marker
     keeps its share of the picture;
   - with the marker count at all your markers, a swap never makes a new pair of touching sections that share one;
   - pinned sections and those with ink on the paper (laid as pinned for the moment: holdOn) stay as they are.
   Deterministic: a fixed number of passes, no clock (a slower device lays the same). Typed arrays throughout.
   mode (v306, markers used twice: gradCount's reuse): 'reuse', two touching sections sharing a marker count as a
   clash of SMOOTH_SAME (on Ben's mandala they went from 56 to 4); 'split', for Natural and Scatter, which aren't
   smoothed: only that, so a swap is made only where it leaves fewer touching sections sharing a marker. */
const SMOOTH_PASSES = 8,
  SMOOTH_AREA = 1.5,
  SMOOTH_SAME = 30;
let gradSmoothLast = null; // (what the last one did, for the tests)
function gradSmooth(order, one, all, mode) {
  const n = order.length;
  gradSmoothLast = null;
  if (!assignData || n < 3) return;
  const A = assignData.assign,
    B = assignData.base,
    a = adj || (adj = buildAdj()),
    WIN = Math.max(2, Math.min(12, Math.round(n / 30))),
    at = new Map(),
    mk = [],
    mi = new Map(),
    cur = new Int32Array(n),
    fix = new Uint8Array(n),
    from = new Int32Array(n),
    ar = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const l = order[i],
      m = A[l];
    at.set(l, i);
    from[i] = i;
    if (!m) {
      cur[i] = -1;
      fix[i] = 1;
      continue;
    }
    let k = mi.get(m.mkey);
    if (k === undefined) {
      k = mk.length;
      mi.set(m.mkey, k);
      mk.push(m);
    }
    cur[i] = k;
    fix[i] = locks[l] !== undefined ? 1 : 0;
    ar[i] = Math.max(1, comps[l].area || 1);
  }
  fix[0] = 1;
  const K = mk.length,
    D = new Float32Array(K * K).fill(-1),
    st = new Int32Array(n + 1),
    nb = [];
  for (let i = 0; i < n; i++) {
    st[i] = nb.length;
    const s = a[order[i]];
    if (s)
      s.forEach(function (q) {
        const j = at.get(q);
        if (j !== undefined) nb.push(j);
      });
  }
  st[n] = nb.length;
  const NB = Int32Array.from(nb);
  const same = mode === 'reuse' ? SMOOTH_SAME * SMOOTH_SAME : mode === 'split' ? 1 : 0;
  function d2(x, y) {
    if (x < 0 || y < 0) return 0;
    if (x === y) return same;
    if (mode === 'split') return 0;
    const k = x * K + y;
    let v = D[k];
    if (v < 0) {
      v = de2000(mk[x].lab, mk[y].lab);
      v = D[k] = D[y * K + x] = v * v;
    }
    return v;
  }
  // the clash round section i with marker m (not counting section skip, the other one in the swap)
  function cost(i, m, skip) {
    let t = 0;
    for (let e = st[i]; e < st[i + 1]; e++) {
      const j = NB[e];
      if (j !== skip) t += d2(m, cur[j]);
    }
    return t;
  }
  // a section touching i (other than skip) that has marker m already
  function shares(i, m, skip) {
    for (let e = st[i]; e < st[i + 1]; e++) {
      const j = NB[e];
      if (j !== skip && cur[j] === m) return true;
    }
    return false;
  }
  let swaps = 0,
    pass = 0;
  while (pass < SMOOTH_PASSES) {
    pass++;
    let did = 0;
    for (let i = 1; i < n; i++) {
      if (fix[i]) continue;
      for (let j = i + 1; j < n && j <= i + WIN; j++) {
        const x = cur[i],
          y = cur[j];
        if (fix[j] || x === y) continue;
        if (!one && (ar[i] > ar[j] * SMOOTH_AREA || ar[j] > ar[i] * SMOOTH_AREA)) continue;
        if (Math.abs(from[i] - j) > WIN || Math.abs(from[j] - i) > WIN) continue;
        if (cost(i, y, j) + cost(j, x, i) - cost(i, x, j) - cost(j, y, i) >= -1e-6) continue;
        if (all && (shares(i, y, j) || shares(j, x, i))) continue;
        cur[i] = y;
        cur[j] = x;
        const f = from[i];
        from[i] = from[j];
        from[j] = f;
        did++;
      }
    }
    swaps += did;
    if (!did) break;
  }
  let moved = 0;
  for (let i = 0; i < n; i++) {
    if (fix[i]) continue;
    const l = order[i],
      m = mk[cur[i]];
    if (A[l] !== m) {
      A[l] = m;
      moved = Math.max(moved, Math.abs(from[i] - i));
    }
    // (Unpin gives back the marker as smoothed)
    if (B) B[l] = m;
  }
  gradSmoothLast = { swaps: swaps, passes: pass, win: WIN, moved: moved, mode: mode || '' };
}
/* Rough spots (v306): touching sections of one Gradient zone whose markers jump in colour (CIEDE2000 over ROUGH_DE).
   "Smooth them" (gradFix, saved with the guide and kept by Undo) gives one section of each such pair a marker the
   guide doesn't use, after the Polished pass, so Shuffle or any change that lays it again keeps them smoothed:
   - only from the Gradient's own pool (gradFixPool: your clear markers in its Temperature and Mood, never a grey or
     a dull brown; a palette's own markers), never a marker with the code of one already in the guide (the other
     brand's Y26, nor of a highlight or shadow it uses: v306), and each new marker once;
   - only where it leaves that section fewer rough neighbours, and the pair no longer rough;
   - never a pinned or coloured section, nor the flow's first (the Start colour);
   - only with the marker count at all your markers (gradFixCan): a guide of 16 markers stays 16.
   With Ben's markers: 11 rough spots to 0 on his page, 18 to 2 on his other, in a few milliseconds. On a big
   mandala every clear marker is used already, so there's nothing to do and nothing is shown (87-undo). */
const ROUGH_DE = 30;
let gradFixLast = null; // (what the last one did, for the tests)
const _deMemo = new Map();
function deMk(a, b) {
  const k = a.mkey < b.mkey ? a.mkey + '\u0001' + b.mkey : b.mkey + '\u0001' + a.mkey;
  let v = _deMemo.get(k);
  if (v === undefined) {
    if (_deMemo.size > 200000) _deMemo.clear();
    v = de2000(a.lab, b.lab);
    _deMemo.set(k, v);
  }
  return v;
}
// the rough pairs among secs (both of them in secs), as [l, q, ΔE], the roughest first
function gradRough(secs, A) {
  const a = adj || (adj = buildAdj()),
    inS = new Set(secs),
    out = [];
  secs.forEach(function (l) {
    const s = a[l];
    if (!s || !A[l]) return;
    s.forEach(function (q) {
      if (q <= l || !inS.has(q) || !A[q]) return;
      const d = deMk(A[l], A[q]);
      if (d > ROUGH_DE) out.push([l, q, d]);
    });
  });
  out.sort(function (x, y) {
    return y[2] - x[2] || x[0] - y[0] || x[1] - y[1];
  });
  return out;
}
function gradFixCan() {
  return limitN >= sliderMax();
}
// (a palette's own markers; else your clear ones (gradClearM) in the Temperature and Mood)
function gradFixPool(src) {
  return src.seeded ? src.items : src.items.filter(gradClearM);
}
// Smooth the rough spots among secs in A (changed in place) with markers from cands that no section uses (nor one of
// their codes): theirs in A as it goes, and ext's ({ used, codes }: the guide's other sections'); fixed(l): a
// section that keeps its marker. A marker a swap takes away can serve elsewhere. { before, after, swaps: [[l, mkey]] }
const FIX_PASSES = 4;
function gradFixRun(secs, A, cands, fixed, ext) {
  const a = adj || (adj = buildAdj()),
    inS = new Set(secs),
    first = gradRough(secs, A),
    swaps = [],
    nK = new Map(),
    nC = new Map(),
    inc = function (m, d) {
      nK.set(m.mkey, (nK.get(m.mkey) || 0) + d);
      nC.set(m.code, (nC.get(m.code) || 0) + d);
    },
    // (and never the other brand of a highlight or shadow the guide uses, v306: ext.part, { code: { marker key } })
    part = Object.assign({}, ext.part || {}),
    // (v307: nor a marker whose own highlight or shadow in section s (ext.tones) is the other brand of a code the guide
    // uses, as a marker or as a highlight or shadow)
    clash = function (x) {
      const p = part[x.code];
      if (p && !p[x.mkey]) return true;
      if (nC.get(x.code) > 0 && !(nK.get(x.mkey) > 0)) return true;
      return ext.codes.has(x.code) && !ext.used.has(x.mkey);
    },
    taken = function (m, s) {
      const p = part[m.code];
      if (
        ext.used.has(m.mkey) ||
        ext.codes.has(m.code) ||
        (!!p && !p[m.mkey]) ||
        nK.get(m.mkey) > 0 ||
        nC.get(m.code) > 0
      )
        return true;
      return !!ext.tones && ext.tones(s, m).some(clash);
    },
    // (the partners a swap brings in join the list, so the next swap keeps clear of them too)
    partAdd = function (s, m) {
      if (!ext.tones) return;
      ext.tones(s, m).forEach(function (x) {
        const p = (part[x.code] = Object.assign({}, part[x.code]));
        p[x.mkey] = 1;
      });
    };
  secs.forEach(function (l) {
    if (A[l]) inc(A[l], 1);
  });
  let pairs = first,
    pass = 0;
  // (again over what's left while a pass changed something: a swap can open the way for another)
  while (pass++ < FIX_PASSES) {
    const n0 = swaps.length;
    if (pass > 1) pairs = gradRough(secs, A);
    for (let i = 0; i < pairs.length; i++) {
      const l = pairs[i][0],
        q = pairs[i][1];
      if (deMk(A[l], A[q]) <= ROUGH_DE) continue;
      let best = null;
      [l, q].forEach(function (s) {
        if (fixed(s)) return;
        const o = s === l ? q : l,
          nb = [];
        a[s].forEach(function (x) {
          if (x !== s && inS.has(x) && A[x]) nb.push(x);
        });
        let now = 0;
        nb.forEach(function (x) {
          if (deMk(A[s], A[x]) > ROUGH_DE) now++;
        });
        cands.forEach(function (m) {
          if (deMk(m, A[o]) > ROUGH_DE || taken(m, s)) return;
          let r = 0,
            sum = 0;
          for (let j = 0; j < nb.length; j++) {
            const d = deMk(m, A[nb[j]]);
            if (d > ROUGH_DE) r++;
            sum += d * d;
          }
          if (r >= now) return;
          if (!best || r < best.r || (r === best.r && sum < best.sum)) best = { s: s, m: m, r: r, sum: sum };
        });
      });
      if (!best) continue;
      inc(A[best.s], -1);
      inc(best.m, 1);
      A[best.s] = best.m;
      partAdd(best.s, best.m);
      swaps.push([best.s, best.m.mkey]);
    }
    if (swaps.length === n0) break;
  }
  return {
    before: first.length,
    after: swaps.length ? gradRough(secs, A).length : first.length,
    swaps: swaps,
  };
}
// the markers (and their codes) of the guide's sections outside secs: as A has them, or for a zone being laid, the
// other zones' as they are now (zoneNb: those laid just before this one in the same run as laid, v306: it took prev's,
// the guide before, so Smooth them in two zones gave both the same new marker), else as prev (the guide before) has them
// With shading on, part: the codes of every section's highlight and shadow (secs' too, as they are before the fix),
// with the markers of each ({ code: { marker key: 1 } }), so the fix never brings in the other brand of one (v306).
function gradFixExt(secs, A, prev) {
  const used = new Set(),
    codes = new Set(),
    part = {},
    inS = new Set(secs),
    sh = shadeOn() ? shadeGeom() : null,
    add = function (m) {
      if (!m) return;
      used.add(m.mkey);
      codes.add(m.code);
    },
    addP = function (l, m) {
      if (!sh || !m || !shadeable(l, sh)) return;
      const t = shadeTones(m, zshOf(l));
      [t.light, t.dark].forEach(function (x) {
        if (x) (part[x.code] || (part[x.code] = {}))[x.mkey] = 1;
      });
    },
    seen = {};
  for (const l in A) {
    if (!inS.has(+l)) add(A[l]);
    addP(+l, A[l]);
    seen[l] = 1;
  }
  if (prev && zones.length) {
    const z = zoneLive();
    for (const l in prev.assign)
      if (!inS.has(+l) && zoneOf(+l) !== z) {
        const m = zoneNb && zoneNb[l] ? zoneNb[l] : prev.assign[l];
        add(m);
        if (!seen[l]) addP(+l, m);
        seen[l] = 1;
      }
    if (zoneNb)
      for (const l in zoneNb)
        if (!inS.has(+l)) {
          add(zoneNb[l]);
          if (!seen[l]) addP(+l, zoneNb[l]);
        }
  }
  // (v307: a marker's own highlight and shadow in section l, for the fix to check before bringing it in)
  const tones = sh
    ? function (l, m) {
        if (!shadeable(l, sh)) return [];
        const t = shadeTones(m, zshOf(l));
        return [t.light, t.dark].filter(Boolean);
      }
    : null;
  return { used: used, codes: codes, part: part, tones: tones };
}
// (buildGradient) the zone's rough spots smoothed, as laid now
function gradFixApply(order, src, prevAll) {
  if (!gradFixCan() || !assignData) return;
  const A = assignData.assign,
    B = assignData.base,
    secs = order.filter(function (l) {
      return !!A[l];
    }),
    first = order[0],
    t0 = Date.now(),
    r = gradFixRun(
      secs,
      A,
      gradFixPool(src),
      function (l) {
        return l === first || locks[l] !== undefined;
      },
      gradFixExt(secs, A, prevAll),
    );
  r.swaps.forEach(function (x) {
    if (B) B[x[0]] = A[x[0]];
  });
  r.ms = Date.now() - t0;
  gradFixLast = r;
}
/* Colour it on the paper round the drawing with Smooth them on (v307): the guide is built again with every section
   keeping its marker (laid as pinned: buildGuide), so the fix couldn't move any and the rough spots by the paper came
   back for a second tap. Smoothed again here as Smooth them would (roughNow's run): only pinned sections, those with
   ink on the paper and the flow's first keep theirs. ids: the zones (every one by default). The swaps made. */
function gradFixHeld(ids) {
  if (!assignData || !labels || !comps) return 0;
  const A0 = assignData.assign,
    B = assignData.base;
  let n = 0;
  (ids || zoneIds()).forEach(function (id) {
    if (zoneFamily(id) !== 'gradient') return;
    zoneWith(id, function () {
      if (!gradFix) return;
      const cl = zoneList(),
        N = cl.length;
      if (!N) return;
      const src = poolSource(Math.min(limitN, N), true);
      if (gradScatAt(gradCount(src, N).M) !== 0 || !gradFixCan()) return;
      const secs = cl.filter(function (l) {
          return !!A0[l];
        }),
        first = orderSections(cl)[0],
        r = gradFixRun(
          secs,
          A0,
          gradFixPool(src),
          function (l) {
            return l === first || locks[l] !== undefined || inkOn(l);
          },
          gradFixExt(secs, A0, null),
        );
      r.swaps.forEach(function (x) {
        if (B) B[x[0]] = A0[x[0]];
      });
      n += r.swaps.length;
    });
  });
  return n;
}
// Shading turned on or off, or the sun moved: a gradient laid out here whose bands run light to dark turns them
// round if their light side no longer faces the light. (Not a guide that was opened, taken back by Undo or kept
// from before its sections were built again: those keep their markers.)
function gradFollowLight() {
  // (its own holdRun mustn't lose what the change that called it held: reassign's, for the kept-sections line)
  const h0 = _heldRun;
  try {
    _gradFollowLight();
  } finally {
    _heldRun = heldMerge(h0, _heldRun);
  }
}
function heldMerge(a, b) {
  if (!a || a === b) return b;
  if (!b) return a;
  const u = function (x, y) {
    return x.concat(
      y.filter(function (v) {
        return x.indexOf(v) < 0;
      }),
    );
  };
  return { secs: u(a.secs, b.secs), run: u(a.run, b.run) };
}
function _gradFollowLight() {
  if (!assignData || sfmode !== 'guide') return;
  let ids = [];
  if (!zones.length) {
    if (!assignData.lit || family !== 'gradient') return;
    if (gradLightSign() !== assignData.lit) ids = zoneAll();
  } else {
    // with zones: each gradient zone whose bands no longer face the light
    const lits = assignData.lits || {};
    zoneIds().forEach(function (id) {
      if (!lits[id]) return;
      zoneWith(id, function () {
        if (family === 'gradient' && gradLightSign() !== lits[id]) ids.push(id);
      });
    });
  }
  if (!ids.length) return;
  // (its markers picked as they were: turning shading on never picks others by itself, v306)
  const f0 = _shpForce,
    f = {};
  ids.forEach(function (id) {
    f[id] = gradShpOf(id);
  });
  _shpForce = f;
  try {
    holdRun(ids, assignOne);
  } finally {
    _shpForce = f0;
  }
}
/* Which sections touch (share a border), for Random's "Keep touching sections clearly different": { l: Set of the
   sections l touches }. Lines differ a lot in thickness (a thick felt-tip outline can be 20 px or more across), so
   instead of looking a fixed step away, it looks across the line: along every other row, and down every other
   column, from where one section ends to where the next begins; if that is within adjReach() (a 40th of the
   picture's longer side) across the line, that's one sighting of the two touching. Two sections touch when they are
   seen ADJ_SEEN times or more (about 6 px of shared border), so where lines meet at a corner and a speck of one
   section peeks past another doesn't count. One pass over the picture. (It used to look a fixed 250th of the
   picture across, and on Ben's drawing of 205 sections with thick lines found 270 of its 608 touching pairs.) */
const ADJ_SEEN = 3;
function adjReach() {
  return Math.max(3, Math.round(Math.max(W, H) / 40));
}
/* Specks: cells smaller than Min section size starts at (and than it is set to now), not kept by a tap. White specks
   inside a porous line, seen as sections of their own, hid the two sections either side of them from each other: the
   look across goes over them as over the line. { tiny: 1 for each, sig: which they are (_adjSig: those adj was found
   with; Build guide finds it again when they've changed) }. v304 */
let _adjSig = '';
function adjTiny() {
  const n = comps ? comps.length : 0,
    lim = Math.min(minPx(MIN_DEF), minPx()),
    tiny = new Uint8Array(n),
    kept = [];
  for (let l = 1; l < n; l++) {
    const c = comps[l];
    if (!c || c.merged || !(c.area < lim)) continue;
    if (secState && secState[l] === 1) kept.push(l);
    else tiny[l] = 1;
  }
  return { tiny: tiny, sig: lim + ':' + kept.join(',') };
}
function buildAdj() {
  const D = adjReach(),
    n = comps ? comps.length : 0,
    seen = new Map(),
    // down each column: the section last seen in it, and the row where that section ended
    colL = new Int32Array(W),
    colEnd = new Int32Array(W),
    // (specks, adjTiny, are looked across as the line is, v304)
    sp = adjTiny(),
    tiny = sp.tiny;
  _adjSig = sp.sig;
  function saw(l, r) {
    const k = l < r ? l * n + r : r * n + l;
    seen.set(k, (seen.get(k) || 0) + 1);
  }
  for (let y = 0; y < H; y++) {
    const row = y * W,
      rowOn = (y & 1) === 0;
    let last = 0,
      end = 0;
    for (let x = 0; x < W; x++) {
      const l = labels[row + x];
      if (l < 1 || tiny[l]) continue;
      if (rowOn) {
        if (l !== last) {
          if (last >= 1 && x - end <= D) saw(last, l);
          last = l;
        }
        end = x;
      }
      if ((x & 1) === 0) {
        const c = colL[x];
        if (l !== c) {
          if (c >= 1 && y - colEnd[x] <= D) saw(c, l);
          colL[x] = l;
        }
        colEnd[x] = y;
      }
    }
  }
  const a = {};
  seen.forEach(function (k, key) {
    // (an enlarged picture's borders are srcK times as long in its pixels, v303)
    if (k < ADJ_SEEN * srcK) return;
    const x = Math.floor(key / n),
      y = key - x * n;
    (a[x] || (a[x] = new Set())).add(y);
    (a[y] || (a[y] = new Set())).add(x);
  });
  return a;
}
/* Random: each section a marker at random from the pool. With "Keep touching sections clearly different" (noAdj),
   a section's marker is at least ADJ_DE by eye (CIEDE2000 10: clearly different) from the marker of every section
   it touches that already has one; where no marker in the pool is, one that isn't the same marker as any of theirs;
   and where none is left, any. Pinned sections keep their markers and go first, so their neighbours keep clear of
   them too. (It used to avoid only the same marker, and only on the touching sections it could see.) */
const ADJ_DE = 10,
  RAND_ENOUGH = 24;
function buildRandom(cl, pool) {
  const order = cl.slice(),
    assign = {};
  let a = null;
  // (touching sections never share a marker, or one as good as it (TWIN_DE), while another would do; "clearly
  // different" (noAdj) keeps them ADJ_DE apart too, v304)
  if (pool.length > 1) a = adj || (adj = buildAdj());
  if (!a) {
    for (let i = 0; i < order.length; i++) assign[order[i]] = pool[(Math.random() * pool.length) | 0];
  } else {
    const P = pool.length,
      at = new Map(),
      // pool markers i and j: as good as the same (3, under TWIN_DE), alike (1, under ADJ_DE) or not (2); 0 not yet
      // worked out
      like = new Uint8Array(P * P),
      bk = {};
    pool.forEach(function (m, i) {
      if (!at.has(m.mkey)) at.set(m.mkey, i);
    });
    coll.forEach(function (m) {
      bk[m.mkey] = m;
    });
    // a step through the pool that visits every marker once (prime to P)
    let step = 1;
    for (let c = Math.max(1, Math.round(P * 0.618)); c < P * 2; c++) {
      let x = c,
        y = P;
      while (y) {
        const t = x % y;
        x = y;
        y = t;
      }
      if (x === 1) {
        step = c;
        break;
      }
    }
    // (plain L*a*b* distance first: CIEDE2000 is never under a limit where that is over 8 times it, 6.4 at most over
    // every pair of markers; only the limit in use is looked for, v304)
    const gate = 64 * (noAdj ? ADJ_DE * ADJ_DE : TWIN_DE * TWIN_DE);
    const cat = function (i, m) {
        const j = at.get(m.mkey),
          k = j === undefined ? -1 : i * P + j;
        if (k >= 0 && like[k]) return like[k];
        const a = pool[i].lab,
          b = m.lab,
          q =
            a && b
              ? (a[0] - b[0]) * (a[0] - b[0]) + (a[1] - b[1]) * (a[1] - b[1]) + (a[2] - b[2]) * (a[2] - b[2])
              : 0,
          d = a && b ? (q < gate ? de2000(a, b) : 99) : Infinity,
          v = d < TWIN_DE ? 3 : d < ADJ_DE ? 1 : 2;
        if (k >= 0) like[k] = like[j * P + i] = v;
        return v;
      },
      twin = function (i, m) {
        return cat(i, m) === 3;
      },
      alike = function (i, m) {
        return cat(i, m) !== 2;
      };
    order.forEach(function (l) {
      if (locks[l] !== undefined && bk[locks[l]]) assign[l] = bk[locks[l]];
    });
    const clear = [],
      other = [];
    for (let q = 0; q < order.length; q++) {
      const l = order[q];
      if (assign[l]) continue;
      const nbs = [];
      if (a[l])
        a[l].forEach(function (nb) {
          const x = nbOf(assign, nb);
          if (x) nbs.push(x);
        });
      clear.length = 0;
      other.length = 0;
      // (from a random place, by a step that visits each once, until RAND_ENOUGH are clear: with hundreds of markers
      // testing every one against every neighbour took a second or more, v304)
      const s0 = (Math.random() * P) | 0;
      for (let j = 0; j < P && clear.length < RAND_ENOUGH; j++) {
        const i = (s0 + j * step) % P;
        let ok = true,
          same = false;
        for (let k = 0; k < nbs.length; k++) {
          if (nbs[k].mkey === pool[i].mkey || twin(i, nbs[k])) {
            same = true;
            break;
          }
          if (noAdj && ok && alike(i, nbs[k])) ok = false;
        }
        if (same) continue;
        if (ok) clear.push(pool[i]);
        else other.push(pool[i]);
      }
      const src = clear.length ? clear : other.length ? other : pool;
      assign[l] = src[(Math.random() * src.length) | 0];
    }
  }
  assignData = { assign: assign, order: order, N: order.length, base: Object.assign({}, assign) };
  applyLocks();
}
/* The marker in `pool` closest to a colour (L*a*b*) by eye: the one lookup Blend, the Photo pattern and stand-ins
   for dry or missing markers all use. By eye is CIEDE2000; for speed, a pool of more than NEAR_WHOLE is first
   narrowed to the NEAR_SHORT nearest by plain L*a*b* distance (quick to work out), and CIEDE2000 picks among those.
   Measured on Ben's 451 markers, that finds the one closest by eye for 99.7% of Blend's mixes, 99.3% of stand-ins and
   98.8% of random photo colours (and when not, one under 3 further by eye). Plain L*a*b* distance alone (as it was
   until now) disagreed with the eye for a quarter of Blend's mixes and a third of the rest, off by up to 12. The
   first of equals in the pool wins. */
const NEAR_SHORT = 12,
  NEAR_WHOLE = 40,
  _nearD = new Float64Array(NEAR_SHORT),
  _nearI = new Int32Array(NEAR_SHORT);
function nearestInPool(lab, pool) {
  let best = pool[0],
    bd = Infinity;
  const n = pool.length;
  if (n <= NEAR_WHOLE) {
    for (let i = 0; i < n; i++) {
      const ml = pool[i].lab;
      if (!ml) continue;
      const d = de2000(lab, ml);
      if (d < bd) {
        bd = d;
        best = pool[i];
      }
    }
    return best;
  }
  // the NEAR_SHORT nearest by plain distance, kept in order (nearest first)
  let k = 0;
  for (let i = 0; i < n; i++) {
    const ml = pool[i].lab;
    if (!ml) continue;
    const dl = ml[0] - lab[0],
      da = ml[1] - lab[1],
      db = ml[2] - lab[2],
      d = dl * dl + da * da + db * db;
    if (k === NEAR_SHORT && d >= _nearD[k - 1]) continue;
    let j = k < NEAR_SHORT ? k++ : k - 1;
    while (j > 0 && _nearD[j - 1] > d) {
      _nearD[j] = _nearD[j - 1];
      _nearI[j] = _nearI[j - 1];
      j--;
    }
    _nearD[j] = d;
    _nearI[j] = i;
  }
  let bi = n;
  for (let q = 0; q < k; q++) {
    const i = _nearI[q],
      d = de2000(lab, pool[i].lab);
    if (d < bd || (d === bd && i < bi)) {
      bd = d;
      bi = i;
    }
  }
  return bi < n ? pool[bi] : best;
}
function anchorAt(P) {
  const tol = Math.max(W, H) * 0.03;
  for (let i = anchors.length - 1; i >= 0; i--) {
    if (Math.hypot(anchors[i].x - P.x, anchors[i].y - P.y) < tol) return i;
  }
  return -1;
}
// A new Blend's three anchors: their markers (v305) are the vivid ones (as colourful as the pool's middle or more) nearest
// red, green and blue round the hue wheel, so it starts as a rainbow; they were the first, a third and two thirds of
// the way along the pool in hue order, which with a big set always began on a brown (E713 of 451)
const SEED_HUES = [30, 150, 270];
function seedKeys(pool) {
  const L = pool.map(function (m) {
      const x = mLch(m);
      return { k: m.mkey, c: x[1], h: (((x[2] || 0) % 360) + 360) % 360 };
    }),
    cs = L.map(function (o) {
      return o.c;
    }).sort(function (a, b) {
      return a - b;
    }),
    med = cs[Math.floor(cs.length / 2)],
    used = {};
  let viv = L.filter(function (o) {
    return o.c >= med;
  });
  if (viv.length < SEED_HUES.length) viv = L;
  return SEED_HUES.map(function (h, i) {
    let best = null,
      bd = 1e9;
    viv.forEach(function (o) {
      if (used[o.k]) return;
      const d0 = Math.abs(o.h - h),
        d = Math.min(d0, 360 - d0);
      if (d < bd) {
        bd = d;
        best = o;
      }
    });
    if (!best) best = viv[i % viv.length];
    used[best.k] = 1;
    return best.k;
  });
}
function seedAnchors(cl) {
  const pool = poolFor(palette);
  if (!pool.length) {
    anchors = [];
    return;
  }
  const keys = seedKeys(pool);
  // (three spread over the extent the pattern covers: a zone's, or the picture; v305: over the drawing's own extent,
  // the sections cl, and each one on a section of them, so none sits on the blank paper round the drawing)
  let x0 = zbX0(),
    y0 = zbY0(),
    w = zbW(),
    h = zbH();
  const own = cl && cl.length ? new Set(cl) : null;
  if (own) {
    let a0 = 1e9,
      b0 = 1e9,
      a1 = -1,
      b1 = -1;
    cl.forEach(function (l) {
      const c = comps[l];
      if (!c) return;
      a0 = Math.min(a0, c.x0);
      b0 = Math.min(b0, c.y0);
      a1 = Math.max(a1, c.x1);
      b1 = Math.max(b1, c.y1);
    });
    if (a1 > a0 && b1 > b0) {
      x0 = a0;
      y0 = b0;
      w = a1 - a0;
      h = b1 - b0;
    }
  }
  const pts = [
      [x0 + w * 0.25, y0 + h * 0.25],
      [x0 + w * 0.75, y0 + h * 0.3],
      [x0 + w * 0.5, y0 + h * 0.75],
    ],
    used = {};
  anchors = pts.map(function (p, i) {
    let x = p[0],
      y = p[1];
    const L = labels ? labels[Math.round(y) * W + Math.round(x)] : 0;
    if (own && !own.has(L)) {
      // (off them: the nearest one's label point, a section no anchor before it took)
      let best = -1,
        bd = 1e18;
      cl.forEach(function (l) {
        if (used[l]) return;
        const q = labelPos(l),
          d = (q.x - x) * (q.x - x) + (q.y - y) * (q.y - y);
        if (d < bd) {
          bd = d;
          best = l;
        }
      });
      if (best >= 0) {
        const q = labelPos(best);
        x = q.x;
        y = q.y;
        used[best] = 1;
      }
    } else if (own) used[L] = 1;
    return { x: x, y: y, mkey: keys[i] };
  });
}
// An anchor added by a tap (v306): the vivid marker (as colourful as the pool's middle or more, not a fluorescent)
// whose hue (L*C*h°, as the first three go by) is furthest from every anchor's, so each one adds a colour the blend
// hasn't got; when the vivid ones are all anchors already, any marker not yet one. (It took the next marker along the
// pool in hue order, which with Ben's markers gave FY02, then R016, then the beige E85.)
function addAnchor(P) {
  const pool = poolFor(palette);
  if (!pool.length) return;
  const have = {},
    hs = [];
  const bk = {};
  coll.forEach(function (m) {
    bk[m.mkey] = m;
  });
  anchors.forEach(function (a) {
    have[a.mkey] = 1;
    if (bk[a.mkey]) hs.push(mLch(bk[a.mkey])[2]);
  });
  const cs = pool
      .map(function (m) {
        return mLch(m)[1];
      })
      .sort(function (a, b) {
        return a - b;
      }),
    med = cs[Math.floor(cs.length / 2)],
    free = pool.filter(function (m) {
      return !have[m.mkey];
    }),
    viv = free.filter(function (m) {
      return mLch(m)[1] >= med && m.fam !== 'Fluorescent';
    }),
    from = viv.length ? viv : free.length ? free : pool;
  let best = from[0],
    bd = -1;
  from.forEach(function (m) {
    const h = mLch(m)[2];
    let d = 360;
    hs.forEach(function (x) {
      d = Math.min(d, hueDiff(h, x));
    });
    if (d > bd) {
      bd = d;
      best = m;
    }
  });
  anchors.push({ x: P.x, y: P.y, mkey: best.mkey });
}
function blendAssign(cl, pool) {
  guideDirty = true;
  const byKey = {};
  coll.forEach(function (m) {
    byKey[m.mkey] = m;
  });
  const ax = anchors
    .map(function (a) {
      const m = byKey[a.mkey];
      // (an anchor whose marker has gone is a mid grey)
      return { x: a.x, y: a.y, lab: m ? m.lab : [50, 0, 0], hex: m ? m.hex : '#777777' };
    })
    .filter(function (a) {
      return a.lab;
    });
  const assign = {},
    order = cl.slice();
  if (!ax.length) {
    for (let i = 0; i < order.length; i++) assign[order[i]] = pool[0];
    assignData = { assign: assign, order: order, N: order.length, base: Object.assign({}, assign) };
    applyLocks();
    return;
  }
  const fall = blendFall,
    mix = blendMixer(ax, blendMix),
    w = new Float64Array(ax.length);
  for (let k = 0; k < cl.length; k++) {
    const l = cl[k],
      cx = comps[l].cx,
      cy = comps[l].cy;
    for (let i = 0; i < ax.length; i++) {
      const d = Math.hypot(ax[i].x - cx, ax[i].y - cy) + 0.001;
      w[i] = 1 / Math.pow(d, fall);
    }
    assign[l] = nearestInPool(mix(w), pool);
  }
  assignData = { assign: assign, order: order, N: order.length, base: Object.assign({}, assign) };
  applyLocks();
}
/* Blend's Mix: how the anchors' colours mix at a section, from how much each one counts there (its weight, by its
   distance and the Spread). The mixed colour then goes to the closest marker by eye (nearestInPool).
     soft   the weighted average in L*a*b* (Blend's mix from the start): opposite colours meet in a soft, greyer
            middle (red and green make a muddy brown)
     vivid  round the colour wheel: lightness and chroma are averaged, and the hue goes the shorter way round from one
            anchor's to the next (red and blue meet in purple, at full strength). With more anchors the hue is their
            weighted average on the wheel (the arrangement round it with the least spread). Colours exactly opposite
            (no shorter way) go round through the yellow side, where the lightest markers are. A grey or near-grey
            anchor (chroma under GREY_C) has little or no say in the hue. A colour stronger than a screen can show
            is brought back to one it can (labClip), as markers are. (The old "Keep colours vivid" took the soft
            mix's hue, which for opposite colours could be anything.)
     paint  like layers of ink: the weighted geometric mean of the anchors' light (linear RGB), each layer taking
            away what it absorbs, so blue and yellow make green, and the middle is darker than a plain average.
   blendMixer(anchors, how) gives the mix as a function of the weights (the anchors' own sums are worked out once). */
const BLEND_MIXES = ['soft', 'vivid', 'paint'],
  // (the soft mix is "Muted" from v284: Mood has a Soft of its own)
  BLEND_MIX_LABEL = { soft: 'Muted', vivid: 'Vivid', paint: 'Like paint' },
  // (the line under Mix: how colours meet between the anchors, v285)
  BLEND_MIX_DESC = {
    soft: 'The middle greys a little.',
    vivid: 'Colours stay strong: red and blue meet in purple.',
    paint: 'Colours mix as layers of ink do: blue and yellow make green.',
  };
function blendMixer(ax, how) {
  const n = ax.length;
  if (how === 'paint') {
    const lg = ax.map(function (a) {
      return hexRgb(a.hex || '#777777').map(function (v) {
        return Math.log(Math.max(1e-4, srgbToLin(v)));
      });
    });
    return function (w) {
      let ws = 0,
        r = 0,
        g = 0,
        b = 0;
      for (let i = 0; i < n; i++) {
        ws += w[i];
        r += w[i] * lg[i][0];
        g += w[i] * lg[i][1];
        b += w[i] * lg[i][2];
      }
      return linLab(Math.exp(r / ws), Math.exp(g / ws), Math.exp(b / ws));
    };
  }
  if (how === 'vivid') {
    const lch = ax.map(function (a) {
        return lchOf(a.lab);
      }),
      // how much each has a say in the hue, and the ones that have any, in hue order
      say = lch.map(function (x) {
        return Math.min(1, x[1] / GREY_C);
      }),
      hs = [];
    for (let i = 0; i < n; i++) if (say[i] > 0) hs.push(i);
    hs.sort(function (p, q) {
      return lch[p][2] - lch[q][2];
    });
    const m = hs.length;
    return function (w) {
      let ws = 0,
        L = 0,
        C = 0;
      for (let i = 0; i < n; i++) {
        ws += w[i];
        L += w[i] * lch[i][0];
        C += w[i] * lch[i][1];
      }
      L /= ws;
      C /= ws;
      // the hue: of the m ways to lay the hues out in a row round the wheel (cut before each one), the weighted mean
      // of the one with the least weighted spread; a tie goes to the one whose middle is nearer yellow (90°)
      let h = 0,
        bv = Infinity,
        bmid = 0;
      for (let c = 0; c < m; c++) {
        // (measured from the first hue of the row, which keeps the sums small)
        const first = lch[hs[c]][2];
        let us = 0,
          s = 0,
          s2 = 0;
        for (let q = 0; q < m; q++) {
          const i = hs[(c + q) % m],
            x = lch[i][2] + (c + q >= m ? 360 : 0) - first,
            u = w[i] * say[i];
          us += u;
          s += u * x;
          s2 += u * x * x;
        }
        if (!(us > 0)) break;
        const mean = s / us,
          v = Math.max(0, s2 / us - mean * mean),
          mid = first + (lch[hs[(c + m - 1) % m]][2] + (c > 0 ? 360 : 0) - first) / 2,
          tie = bv < Infinity && Math.abs(v - bv) <= 1e-9 * Math.max(v, bv);
        if (bv === Infinity || (v < bv && !tie) || (tie && hueDiff(mid, 90) < hueDiff(bmid, 90))) {
          bv = v;
          h = first + mean;
          bmid = mid;
        }
      }
      const r = (h * Math.PI) / 180;
      return labClip([L, C * Math.cos(r), C * Math.sin(r)]);
    };
  }
  return function (w) {
    let ws = 0,
      L = 0,
      A = 0,
      B = 0;
    for (let i = 0; i < n; i++) {
      const la = ax[i].lab;
      ws += w[i];
      L += w[i] * la[0];
      A += w[i] * la[1];
      B += w[i] * la[2];
    }
    return [L / ws, A / ws, B / ws];
  };
}
function blendRender() {
  if (blendRaf) return;
  blendRaf = requestAnimationFrame(function () {
    blendRaf = 0;
    blendNow();
    renderGuide();
  });
}
function resolveKeys(keys) {
  if (!keys || !keys.length) return [];
  const bk = {};
  coll.forEach(function (m) {
    bk[m.mkey] = m;
  });
  const out = [],
    seen = {};
  keys.forEach(function (k) {
    let m = bk[k];
    if (!m) {
      const info = api.markerInfo ? api.markerInfo(k) : null;
      if (info && info.lab && coll.length) m = nearestInPool(info.lab, coll);
    }
    if (m && !seen[m.mkey]) {
      seen[m.mkey] = 1;
      out.push(m);
    }
  });
  return out;
}
function palettePoolFromSaved() {
  const list = api.listPalettes ? api.listPalettes() : [];
  let pl = null;
  for (let i = 0; i < list.length; i++)
    if (list[i].id === savedPalId) {
      pl = list[i];
      break;
    }
  return pl && pl.keys ? resolveKeys(pl.keys) : [];
}
// Colours from › Generate palette: the Palette screen's harmonies, in its order (not Custom or Photo: the guide has its
// own Photo pattern), each at a size in its range there (HARM_RANGE); a guide using more markers than that gets the
// rest from “Expand with nearby markers”, or uses just the palette with Expand off
const GEN_HARMS = Object.keys(HARM).filter(function (h) {
  return h !== 'custom' && h !== 'photo';
});
function genSize(h, n) {
  const R = HARM_RANGE[h] || [3, 8];
  return Math.max(R[0], Math.min(R[1], n || R[1]));
}
// (reroll: Shuffle's, another of the same scheme. v306: a Rainbow is the Gradient's own unless it's asked for another,
// as Palette's Generate does, so Shuffle gave the same Rainbow every time)
function generatePalette(reroll) {
  if (GEN_HARMS.indexOf(genHarmony) < 0) genHarmony = 'analogous';
  // (the Colours tab's Mood goes to the generator, which keeps to it where it can)
  if (api.genPalette)
    genPal =
      api.genPalette(genSize(genHarmony, limitN), genHarmony, { mood: emphasis, reroll: reroll === true }) ||
      [];
}
function genPalKeys(a) {
  return (a || [])
    .map(function (e) {
      return typeof e === 'number' ? (COLORS[e] ? mkey(e) : null) : e;
    })
    .filter(function (k) {
      return typeof k === 'string';
    });
}
function thinTo(pool, N) {
  if (!(N >= 2 && N < pool.length)) return pool;
  const hs = pool.slice().sort(function (a, b) {
      return (a.hue || 0) - (b.hue || 0);
    }),
    out = [];
  for (let i = 0; i < N; i++) out.push(hs[Math.floor((i / N) * hs.length)]);
  return out;
}
// A palette's markers and, when Expand is on, the nearest others up to N, by eye (CIEDE2000), within EXPAND_CAP of a
// palette marker. Nearby colours (c, 0 to 1) weighs the two parts of how different they are: towards tints (0) a
// difference in colour (chroma and hue) counts most, so markers of the same colour at other lightnesses come first;
// towards hues (1) a difference in lightness counts most. A generated palette's nearby markers lean to the Colours
// tab's Mood (as the palette does); a saved palette is used as it is. (EXPAND_CAP is 32: on Ben's 451 markers as
// many pairs are that close by eye as were within 48 by the plain L*a*b* distance used until now; the Mood's pull,
// EXPAND_MOOD, was 2 on that scale and is scaled by the same (32/48)², so it leans as much as it did.)
const EXPAND_CAP = 32,
  EXPAND_MOOD = 2 * (32 / 48) * (32 / 48);
function expandToN(seed, N, c) {
  if (!seed.length || !coll.length) return seed;
  if (N <= seed.length) return thinTo(seed, N);
  const wAB = 1 + (1 - c) * 3,
    wL = 1 + c * 3,
    mood = paletteSource === 'generate' ? emphasis : 'neutral',
    chosen = [],
    seen = {};
  seed.forEach(function (m) {
    if (!seen[m.mkey]) {
      seen[m.mkey] = 1;
      chosen.push(m);
    }
  });
  const cand = seed.map(function (s) {
    const sl = s.lab,
      arr = [];
    for (let i = 0; i < coll.length; i++) {
      const m = coll[i];
      if (seen[m.mkey] || !m.lab) continue;
      const part = de2000Split(sl, m.lab),
        de = Math.sqrt(part[0] + part[1]);
      if (de <= 0 || de > EXPAND_CAP) continue;
      const off = mood === 'neutral' ? 0 : moodOff(mood, mLch(m));
      arr.push({ m: m, sd: wAB * part[1] + wL * part[0] + EXPAND_MOOD * off * off });
    }
    arr.sort(function (a, b) {
      return a.sd - b.sd;
    });
    return arr;
  });
  const idx = new Array(seed.length).fill(0);
  let added = true;
  while (chosen.length < N && added) {
    added = false;
    for (let i = 0; i < seed.length && chosen.length < N; i++) {
      const list = cand[i];
      while (idx[i] < list.length) {
        const mk = list[idx[i]++].m;
        if (!seen[mk.mkey]) {
          seen[mk.mkey] = 1;
          chosen.push(mk);
          added = true;
          break;
        }
      }
    }
  }
  return chosen;
}
// the saved or generated palette's markers (none when it has none); one is generated if there isn't one yet, unless
// `peek` (for what the controls say, which mustn't change the guide)
function seedPool(peek) {
  if (paletteSource === 'saved') return palettePoolFromSaved();
  if (paletteSource === 'generate') {
    if (!genPal.length && !peek) generatePalette();
    return resolveKeys(genPal);
  }
  return [];
}
function curSeedLen() {
  return seedPool().length;
}
function sliderMax() {
  var ownedMax = Math.max(2, poolFor(palette).length);
  if (paletteSource !== 'saved' && paletteSource !== 'generate') return ownedMax;
  return expand ? ownedMax : Math.max(2, curSeedLen());
}
// Where a pattern's markers come from, before it picks among them: { items, seeded, seed, widened }. A saved or
// generated palette gives its own markers (seed of them), with nearby ones added when Expand is on; otherwise it's
// your markers in the Colours tab's Temperature and Mood, the Mood widened to the nearest ones outside it when
// fewer than `need` fit (widened: how many). Any Mood keeps them all, greys too. (peek: as seedPool)
function poolSource(need, peek) {
  if (paletteSource === 'saved' || paletteSource === 'generate') {
    const seed = seedPool(peek);
    if (seed.length) {
      const items = expand && limitN > seed.length ? expandToN(seed, limitN, expandChar) : seed;
      return { items: items, seeded: true, seed: seed.length, widened: 0 };
    }
  }
  const r = moodPick(poolFor(palette), emphasis, need, mLch);
  return { items: r.items, seeded: false, seed: 0, widened: r.widened };
}
// the Gradient (and the Photo pattern before it has a photo) picks its own markers from the whole pool
function gradFamily() {
  return family === 'gradient' || family === 'photo';
}
// the markers the pattern may use: Random, Blend and Manual take the marker count's worth, spread round the colours
function activePool() {
  const grad = gradFamily(),
    src = poolSource(grad ? Math.min(limitN, zoneList().length) : limitN);
  if (grad) {
    lastPoolN =
      src.seeded && src.items.length > src.seed ? src.items.length : Math.min(limitN, src.items.length);
    return src.items;
  }
  // (a palette you chose keeps its greys: thinned as before)
  const pool =
    src.seeded && src.items.length > src.seed
      ? src.items
      : src.seeded
        ? thinTo(src.items, limitN)
        : thinPool(src.items, limitN);
  lastPoolN = pool.length;
  return pool;
}
// Random, Blend and Manual's markers from your own: the marker count's worth, spread round the colours. Greys (black,
// the grey families, near-whites) only when the Temperature and Mood leave mostly greys, or one among 12 or more:
// spread by hue with the rest, they came in as often as they are in your collection (black among 6 markers, two
// greys among 8 covering a third of the picture). (Pastels and dark browns are colours here, though their chroma is
// low: thinGreyM, not isGreyM)
function thinGreyM(m) {
  const x = mLch(m);
  return (
    /Gr[ae]y|Black/.test(m.fam || '') ||
    shGreyFam(m) ||
    x[1] < 4 ||
    (x[1] < GREY_C && (x[0] < 22 || x[0] > 96))
  );
}
function thinPool(pool, N) {
  if (!(N >= 2 && N < pool.length)) return pool;
  const col = pool.filter(function (m) {
      return !thinGreyM(m);
    }),
    gr = pool.filter(thinGreyM);
  if (col.length < gr.length) return thinTo(pool, N);
  const nG = col.length < N ? N - col.length : N >= 12 && gr.length ? 1 : 0,
    out = thinTo(col, N - nG);
  if (!nG) return out;
  // (the greys spread through their lightness; not the black while there are others)
  const mid = gr.filter(function (m) {
    return mLch(m)[0] >= 22;
  });
  return out.concat(evenPick((nG === 1 && mid.length ? mid : gr).slice().sort(byLightFirst), nG));
}
// The line under the Colours tab's choices: where the guide's markers come from (v289: no count of its own — the
// slider says how many you asked for and the button under it how many are on the page), or (most useful first) that
// the Mood had to take in markers outside it, or that the Gradient needs greys.
const MOOD_WORDS = {
  vivid: ['bright', 'next brightest'],
  muted: ['soft', 'next softest'],
  pastel: ['light', 'next lightest'],
  deep: ['deep', 'next deepest'],
  earthy: ['earthy', 'nearest to earthy'],
};
function poolMsg() {
  const yours = isDemo()
    ? 'the ' + coll.length + ' catalogue markers'
    : 'your ' + nWord(coll.length, 'marker');
  // (Random's Main colour and No repeats choose their own markers: 31-balance)
  if (family === 'random' && balance === 'main') {
    const p = balPlan();
    if (p.ok)
      return 'From ' + (p.seeded ? 'the palette' : yours) + ', shared out by Main colour (Pattern tab)';
  }
  if (family === 'random' && balance === 'mixed' && noRep) {
    const k = noRepPool(zoneList(), true).length;
    return 'From ' + yours + ': one per section' + (k < zoneList().length ? ' as far as they go' : '');
  }
  const N = zoneList().length,
    grad = gradFamily(),
    need = grad ? Math.min(limitN, N) : limitN,
    src = poolSource(need, true),
    n = src.items.length,
    used = Math.min(need, n),
    one = grad && used >= N ? ': one per section' : '';
  if (src.seeded) {
    const saved = paletteSource === 'saved';
    if (n > src.seed)
      return (
        'From the palette\u2019s ' +
        src.seed +
        ' markers and ' +
        (grad && used < n ? 'nearby ones' : n - src.seed + ' nearby') +
        one
      );
    if (saved)
      return used >= n
        ? 'All ' + n + ' of the saved palette\u2019s markers, as it is'
        : 'From the saved palette\u2019s ' + n + ' markers' + one;
    return used >= n ? 'All ' + n + ' generated markers' : 'From the ' + n + ' generated markers' + one;
  }
  const w = MOOD_WORDS[emphasis];
  if (src.widened && w) {
    const inside = n - src.widened;
    return (
      MOODS[emphasis].label +
      ': ' +
      (inside ? inside + ' of ' : 'none of ') +
      (isDemo() ? 'the catalogue' : 'your') +
      ' markers ' +
      (inside === 1 ? 'is ' : 'are ') +
      w[0] +
      '; the rest are the ' +
      w[1]
    );
  }
  const head = 'From ' + yours;
  if (grad) {
    const col = src.items.filter(notGreyM).length;
    if (used > col)
      return (
        head +
        ': ' +
        (used - col) +
        (used - col === 1 ? ' grey' : ' greys') +
        ', as there aren\u2019t enough coloured ones'
      );
  }
  return head + one;
}
const LOOK_LABEL = { auto: 'Auto', smooth: 'Smooth', ltd: 'Light to dark' };
// a saved palette the Gradient runs as a ramp (it doesn't go round the colour wheel): Shuffle has nothing to change
function savedRamp() {
  if (paletteSource !== 'saved') return false;
  const s = poolSource(limitN, true);
  return s.seeded && !gradIsLoop(s.items);
}
// What Auto does (the note under Look): it goes by how many sections each marker covers
function lookNote() {
  if (look !== 'auto' || family !== 'gradient') return '';
  const N = zoneList().length,
    M = gradCountNow().M,
    g = gradShape === 'serpentine' ? 1 : gradGroupSize('auto', M, N, gradShape),
    per = N / M;
  // (Scatter, Textured and up, places the markers itself: Look still picks them, v306)
  if (gradScatAt(M) >= 2)
    return (
      'Auto: markers picked for ' + (g <= 1 ? 'a smooth run' : 'bands of ' + g) + '; Scatter places them.'
    );
  if (gradShape === 'serpentine') return 'Auto: smooth, as Serpentine runs in rows.';
  if (g <= 1) return 'Auto: smooth, as each marker covers about ' + Math.round(per) + ' sections.';
  if (g >= gradGroupSize('ltd', M, N, gradShape))
    return M >= N
      ? 'Auto: light to dark, as every section has its own marker.'
      : 'Auto: light to dark, as each marker covers only a section or two.';
  return (
    'Auto: bands of ' +
    g +
    ' markers, light to dark, as each marker covers about ' +
    Math.round(per * 10) / 10 +
    ' sections.'
  );
}
// the guide's markers from its pattern: every zone's (zoneRun, 34-zones), or without zones the whole picture's
function assignNow() {
  return zoneRun(zoneAll(), assignOne);
}
// one pattern over the sections cl, from the live settings (a zone's, while zoneRun builds it)
function assignOne(cl) {
  const pool = activePool();
  if (!pool.length) {
    note(
      palette === 'all'
        ? 'No markers to use \u2014 check Filters in Colours.'
        : 'None of your markers are ' + palette + ' \u2014 choose another Temperature.',
    );
    return false;
  }
  if (family === 'random') buildRandomBal(cl, pool);
  else if (family === 'blend') {
    if (anchors.length === 0) seedAnchors(cl);
    blendAssign(cl, pool);
  } else if (family === 'manual') buildManual(cl, pool);
  else if (family === 'photo') {
    // (placed again after the picture was straightened: 46-photo, v304)
    if (_phRefit && photoRef) photoGeoRefit();
    if (photoRef && photoXf && buildPhoto(cl)) return true;
    // (Photo chosen, its photo not picked yet: the pattern before it is laid, and saved, until one is: photoWait)
    const pw = photoWait[pwKey()];
    if (pw && pw !== 'photo' && !photoRef) {
      family = pw;
      try {
        return assignOne(cl);
      } finally {
        family = 'photo';
      }
    }
    buildGradient(cl);
  } else buildGradient(cl);
  return true;
}
// Blend again from its anchors (a drag, the Spread slider, an anchor's colour): the zone being edited only
function blendNow() {
  holdRun([zoneCur], function (cl) {
    // (the last anchor removed: three new ones, as a Blend starts, not one marker everywhere; here, inside the zone
    // being laid, so they're placed over its own extent, v304)
    if (!anchors.length) seedAnchors(cl);
    blendAssign(cl, activePool());
  });
}
function buildManual(cl, pool) {
  var prev = assignData && assignData.assign && !_segFresh ? assignData.assign : {},
    pb = assignData && assignData.base && !_segFresh ? assignData.base : {},
    order = cl.slice(),
    assign = {},
    base = {};
  for (var i = 0; i < order.length; i++) {
    var l = order[i];
    assign[l] = prev[l] || pool[i % pool.length];
    base[l] = pb[l] || assign[l];
  }
  order.sort(function (a, b) {
    return comps[a].cy - comps[b].cy || comps[a].cx - comps[b].cx;
  });
  assignData = { assign: assign, order: order, N: order.length, base: base };
}
// Build guide. Going back to the sections and building again keeps the guide as it was: each section that was in it
// keeps its marker whatever the pattern (a Random guide isn't rolled again), only sections new to it get the
// pattern's; with the sections unchanged the plan's undo steps stay too. Sections found afresh start over. A section
// taken out of the guide (Edit sections) keeps its marker, pin, tick and tones in _gone (saved with the guide as
// `out`), and has them again when it is brought back in. keepPlan (true): the plan's Undo steps are kept even though
// the guide changed, for a change that makes its own step (Colour it on the paper inside a frame, v306)
let _gone = {};
function buildGuide(keepPlan) {
  if (!labels) return;
  // (which sections touch is found again when the specks looked across changed: Min section size, a keep tap, v304)
  if (adj && _adjSig !== adjTiny().sig) adj = null;
  const cl = countedList();
  if (cl.length < 2) {
    note('Not enough sections \u2014 lower Min section size, then Build guide.');
    return;
  }
  if (!coll.length) {
    // (markers owned but every one marked dry: coll leaves those out)
    // (or only the Colorless Blender, which lays down no colour, v299)
    let anyOwned = false,
      anyInk = false;
    try {
      anyOwned = state.owned.size > 0;
      anyInk = COLORS.some(function (c, i) {
        return !NOINK.has(i) && isOwned(i);
      });
    } catch (_) {}
    note(
      anyInk
        ? 'Every marker you own is marked dry \u2014 mark some as not dry in Markers, then Build guide.'
        : anyOwned
          ? 'No colours in your collection (a blender lays down none) \u2014 add the markers you own in Markers, then Build guide.'
          : 'No markers in your collection \u2014 add the ones you own in Markers, then Build guide.',
    );
    return;
  }
  // (a Temperature none of your markers have now, after the collection or filters changed: all of them instead)
  if (palette !== 'all' && !activePool().length) palette = 'all';
  const _had = !!assignData,
    _pc = colored,
    prev = _had && !_segFresh ? assignData : null,
    same = !!prev && guideSig === labelsSig(),
    was = same ? planSnap() : null,
    wasDirty = guideDirty;
  if (prev) {
    const _in = {};
    cl.forEach(function (l) {
      _in[l] = 1;
    });
    prev.order.forEach(function (l) {
      if (!_in[l] && prev.assign[l] && comps[l] && !comps[l].merged)
        _gone[l] = { m: prev.assign[l], lock: locks[l] };
    });
  }
  // the zones follow the section edits (34-zones), or are placed again on sections found afresh
  let _zLost = false;
  if (zones.length) {
    if (_segFresh) _zLost = !zoneAfterFresh();
    else zoneAfterEdit(cl, prev);
  }
  // (the sections keeping their markers (keepMarkers) are laid as pinned for the moment, so the ones new to the guide
  // keep clear of them: v303 laid them all afresh, then put the old markers back next to the new ones, v304)
  const _lk0 = locks;
  if (prev) {
    const tmp = {};
    cl.forEach(function (l) {
      const m = prev.assign[l] || (_gone[l] && _gone[l].m);
      if (m && !(prev.paper && prev.paper[l])) tmp[l] = m.mkey;
    });
    locks = Object.assign(tmp, locks);
  }
  let _built;
  try {
    _built = assignNow();
  } finally {
    locks = _lk0;
  }
  if (!_built) return;
  if (_zLost)
    toast(
      'The zones were cleared: turning, straightening or cropping the picture finds its sections afresh.',
      3200,
    );
  if (prev) {
    keepMarkers(prev, cl);
    // (its markers are the old guide's, not a layout that can turn to face the light)
    delete assignData.lit;
    delete assignData.lits;
    delete assignData.shp;
    delete assignData.shps;
  }
  if (_had && _pc && !_segFresh) {
    const _nc = new Uint8Array(comps.length);
    _nc.set(_pc.subarray(0, Math.min(_pc.length, _nc.length)));
    setColored(_nc);
  } else if (_had) {
    colored = new Uint8Array(comps.length);
  } else {
    colored = new Uint8Array(comps.length);
    curId = null;
    curName = null;
  }
  // (the ticks follow merges and splits: 65-edit)
  tickCarry();
  _segFresh = false;
  zoneBuilt();
  zoneSigSync();
  _openEmpty = false;
  guideSig = labelsSig();
  celebrated = false;
  selAnchor = -1;
  {
    const _lk = locks,
      _in = {};
    cl.forEach(function (l) {
      _in[l] = 1;
    });
    locks = {};
    for (const l in _lk) if (_in[l]) locks[l] = _lk[l];
    cl.forEach(function (l) {
      const g = _gone[l];
      if (!g) return;
      if (g.lock !== undefined && assignData.assign[l]) locks[l] = g.lock;
      delete _gone[l];
    });
  }
  lockMode = false;
  hlKey = null;
  hlZone = null;
  sfmode = 'guide';
  // an Undo step kept from re-detecting or turning the picture starts a new one from here on
  const _t = undoStack[undoStack.length - 1];
  if (_t) _t.sealed = true;
  const now = same ? planSnap() : null,
    unchanged = !!(was && now && planSame(was, now, true));
  guideDirty = unchanged ? wasDirty : true;
  renderGuide();
  renderControls();
  if (unchanged) {
    planLast = now;
    planBtn();
  } else if (keepPlan !== true) planReset();
  markBuilt();
  saveStatus();
  // (a new guide from your photo goes into the Library straight away, not after the usual pause: a page closed or
  // reloaded just after Build lost it, v287)
  // (v305: once the first Build's bloom is over, 41-bloom.js: about a second, the save's work held up its frames)
  // (v307: its section map encoded in the worker first, lmapWarm, so the save doesn't hold the page up just as the
  // guide appears. v307.1: only while the bloom shows, and LMAP_WAIT after it at most; with no bloom it's saved at
  // once, encoded here, as in v306: waiting on the worker, a reload or close soon after Build lost the guide)
  if (canAuto())
    setTimeout(function () {
      const save = function () {
        if (autoT && canAuto() && !_firstBusy) flushAutosave();
      };
      if (!_bloom) {
        save();
        return;
      }
      const warm = lmapWarm();
      bloomAfter(function () {
        Promise.race([
          warm,
          new Promise(function (res) {
            setTimeout(res, LMAP_WAIT);
          }),
        ]).then(save);
      });
    }, 60);
}
// the sections the guide had keep their markers (or stay white), the rest keep what the pattern just gave them
function keepMarkers(prev, cl) {
  const pa = prev.assign || {},
    pb = prev.base || {},
    pp = prev.paper || {},
    A = assignData.assign,
    B = assignData.base || (assignData.base = {}),
    P = {};
  if (assignData.paper) for (const l in assignData.paper) if (!pa[l] && !pp[l]) P[l] = 1;
  cl.forEach(function (l) {
    if (pa[l]) {
      A[l] = pa[l];
      B[l] = pb[l] || pa[l];
      delete P[l];
    } else if (pp[l]) {
      delete A[l];
      delete B[l];
      P[l] = 1;
    } else if (_gone[l]) {
      A[l] = _gone[l].m;
      B[l] = _gone[l].m;
      delete P[l];
    } else {
      // a part split off a section with ink on it has that ink: its marker, its pin, flat or held shading, as the
      // section had (its tick follows it too: tickCarry, 65-edit). v299: it got whatever the pattern gave it.
      const f = splitFrom(l);
      if (f >= 0 && pa[f] && inkOn(f)) {
        A[l] = pa[f];
        B[l] = pb[f] || pa[f];
        delete P[l];
        if (locks[f] !== undefined) locks[l] = locks[f];
        if (shadeFlat[f]) shadeFlat[l] = 1;
        if (heldSh[f]) heldSet(l, Object.assign({}, heldSh[f]));
      }
    }
  });
  const ord = assignData.order.filter(function (l) {
      return !!A[l];
    }),
    inO = {};
  ord.forEach(function (l) {
    inO[l] = 1;
  });
  cl.forEach(function (l) {
    if (A[l] && !inO[l]) ord.push(l);
  });
  assignData.order = ord;
  assignData.N = ord.length;
  if (Object.keys(P).length) assignData.paper = P;
  else delete assignData.paper;
}
// The pattern laid again after a change to its settings: with zones only the zone being edited (so a Random zone
// elsewhere keeps its colours), unless the markers you can use changed since all of them were last laid (your
// collection, the filters), which changes them all. ids: the zones to build (zoneMove's, when sections changed zone);
// moved: those sections ({ section: 1 }), so the ones that stayed in a Random zone keep their markers (a tap in the
// zone editor doesn't roll the zones it touches again).
let _zSig = null;
function zoneMarkersSig() {
  return (
    planFilt() +
    '|' +
    coll
      .map(function (m) {
        return m.mkey + (m.pass ? '' : '-');
      })
      .join(',')
  );
}
// (all the zones were just laid, or put back as they were laid: from these markers)
function zoneSigSync() {
  _zSig = zoneMarkersSig();
}
/* Sections with ink on the paper (ticked, or some of their tones coloured) keep their markers through any change to
   the plan (v284): while a pattern is laid they're pinned for the moment (not saved, no pin ring, no "Section pinned"
   step), in the zones being laid, and Undo leaves them as they are too (planRestore). Their shading keeps too (heldSh,
   34-zones). When a change would have recoloured them a line under the tabs says so, with Recolour them too
   (heldRecolour), once per visit to the plan (and again when more are kept). _heldRun: those kept by the last
   laying out, for that line. */
let _holdOff = false,
  _heldRun = null,
  _heldTold = 0;
function holdOn(run, extra) {
  _heldRun = null;
  if (!assignData) return null;
  const was = locks,
    tmp = Object.assign({}, locks),
    kept = [];
  if (!_holdOff && colored)
    assignData.order.forEach(function (l) {
      const m = assignData.assign[l];
      if (!m || tmp[l] !== undefined || !inkOn(l) || (zones.length && run.indexOf(zoneOf(l)) < 0)) return;
      tmp[l] = m.mkey;
      kept.push(l);
    });
  // (sections keeping their markers anyway, as a Random zone's that stayed put: laid as pinned for the moment, so the
  // sections laid afresh around them keep clear of them, v304)
  let more = 0;
  if (extra)
    for (const l in extra)
      if (tmp[l] === undefined) {
        tmp[l] = extra[l];
        more++;
      }
  if (!kept.length && !more) return null;
  locks = tmp;
  if (kept.length) _heldRun = { secs: kept, run: run.slice() };
  return was;
}
// lay the zones ids with fn, sections with ink on the paper held (holdOn): every re-laying of the plan goes through
// here (reassign; the sun moved under a light-to-dark Gradient; Blend's anchors; the Photo pattern's photo)
function holdRun(ids, fn, extra) {
  const was = holdOn(ids, extra);
  try {
    return zoneRun(ids, fn);
  } finally {
    if (was) locks = was;
  }
}
// { section: marker key } of a zoneStayRandom result (null for none)
function stayKeys(stay) {
  if (!stay) return null;
  const o = {};
  for (const l in stay) o[l] = stay[l].m.mkey;
  return o;
}
function reassign(ids, moved) {
  if (!labels || sfmode !== 'guide') return;
  if (!Array.isArray(ids)) ids = null;
  guideDirty = true;
  selAnchor = -1;
  const sig = zoneMarkersSig(),
    all = _zSig !== sig,
    run = !zones.length || all ? zoneAll() : ids || [zoneCur],
    stay = moved && !all ? zoneStayRandom(run, moved) : null,
    ok = holdRun(run, assignOne, stayKeys(stay));
  // (with zones, the others were laid even if one couldn't be: no markers for it, which a note has said)
  if (!ok && !zones.length) return false;
  if (ok) _zSig = sig;
  if (stay) zoneStayPut(stay);
  // (a stand-in for a dry marker is kept on in the sections that weren't laid again)
  if (!zones.length || run.length === zoneIds().length) _origKeys = {};
  else for (const l in _origKeys) if (run.indexOf(zoneOf(+l)) >= 0 && !(stay && stay[l])) delete _origKeys[l];
  // (a Gradient elsewhere whose bands faced a light that has since changed by itself: Main's pattern to or from Photo
  // under Light from's auto, or the only Photo zone gone)
  gradFollowLight();
  // (a section that changed zone may be shaded differently now, or not at all: part-done tones brought in line)
  normalizeTones();
  renderGuide();
  renderControls();
  if (tipL >= 0) showTip(tipL, tipBtns, true);
  planCommit();
  return true;
}
// (no "are you sure": the change is one Undo step, and coloured sections keep their markers)
function setSavedSource(id) {
  paletteSource = 'saved';
  savedPalId = id;
  palNote();
  return true;
}
// the saved palette a new guide will use: on the Guide screen's card and (v288) under Home's New colouring guide
// Palette's Use in a guide › Recolour: the open guide's plan takes the palette and is laid again, from its Plan (from
// Colour along it goes back to the Plan first; from Edit sections only with nothing edited: 'edits' otherwise)
function recolourWith(id) {
  if (!assignData) return setSavedSource(id);
  if (sfmode === 'review') {
    if (secEdPending()) return 'edits';
    edGoPlan();
  } else if (sfmode === 'color') {
    if (focus) exitFocus();
    exitColor();
  }
  if (sfmode !== 'guide') return false;
  setSavedSource(id);
  return reassign() !== false;
}
// A palette chosen for the next new guide while another is open (v288: Use in a guide › New guide with it) is held
// here, apart from the open guide's plan, and becomes the new guide's when its photo is read (_loadImage).
let _nextPal = null;
function setNextPal(id) {
  if (!assignData) return setSavedSource(id);
  _nextPal = id;
  palNote();
  return true;
}
function takeNextPal() {
  if (_nextPal == null) return;
  // (only if it's still in the Library: deleted meanwhile, the new guide keeps the plan's own source)
  const id = _nextPal,
    there =
      api.listPalettes &&
      api.listPalettes().some(function (x) {
        return x.id === id;
      });
  _nextPal = null;
  if (!there) return;
  paletteSource = 'saved';
  savedPalId = id;
}
// the ✕ on the note: the next guide's palette stops (the open guide's own plan is left alone)
function clearPal() {
  if (_nextPal != null) _nextPal = null;
  else if (!assignData) {
    paletteSource = 'owned';
    savedPalId = null;
  }
  palNote();
}
function palNote() {
  var el = document.getElementById('sfPalNote'),
    hm = document.getElementById('homePalNote');
  if (!el && !hm) return;
  var pl = null,
    pid = _nextPal != null ? _nextPal : paletteSource === 'saved' && !assignData ? savedPalId : null;
  if (pid != null && api.listPalettes) {
    pl =
      api.listPalettes().filter(function (x) {
        return x.id === pid;
      })[0] || null;
  }
  if (!pl) {
    if (el) el.innerHTML = '';
    if (hm) hm.innerHTML = '';
    return;
  }
  var sw = (pl.keys || [])
      .slice(0, 10)
      .map(function (k) {
        var i = keyIdx(k);
        return '<span style="background:' + (i != null ? COLORS[i].hex : '#555') + '"></span>';
      })
      .join(''),
    n = pl.keys ? pl.keys.length : 0,
    one = function (line) {
      return (
        '<div class="sfpalnote"><div class="sstrip">' +
        sw +
        '</div><div class="sfpntx"><b>Using \u201c' +
        esc(pl.name || 'Palette') +
        '\u201d</b><span>' +
        n +
        ' markers \u00b7 ' +
        line +
        '</span></div><button class="mclose" data-clearpal="1" aria-label="Stop using this palette">' +
        ic('x') +
        '</button></div>'
      );
    };
  if (el) el.innerHTML = one('choose a photo or try the sample');
  if (hm) hm.innerHTML = one('for your next new guide');
}
function surprise() {
  if (sfmode !== 'guide' || !labels) return;
  family = 'gradient';
  paletteSource = 'generate';
  limitN = 8 + ((Math.random() * 16) | 0);
  var harms = ['analogous', 'analogous', 'split', 'split', 'complementary', 'triadic', 'tetradic'].filter(
      function (h) {
        return GEN_HARMS.indexOf(h) >= 0 && HARM_RANGE[h][0] <= limitN;
      },
    ),
    hp = harms.filter(function (x) {
      return x !== genHarmony;
    });
  genHarmony = (hp.length ? hp : harms)[(Math.random() * (hp.length || harms.length)) | 0];
  var ar = W / H,
    shapes;
  if (ar > 1.4) shapes = ['serpentine', 'diagonal', 'serpentine'];
  else if (ar < 0.72) shapes = ['vertical', 'serpentine', 'radial'];
  else shapes = ['radial', 'serpentine', 'radial', 'diagonal'];
  gradShape = shapes[(Math.random() * shapes.length) | 0];
  dir = Math.random() < 0.5 ? 1 : -1;
  gradSeed = Math.random();
  // a Mood and a Look, mostly Any and Auto
  var moods = ['neutral', 'neutral', 'neutral', 'vivid', 'muted', 'pastel', 'deep', 'earthy'];
  emphasis = moods[(Math.random() * moods.length) | 0];
  expand = true;
  expandChar = Math.random();
  generatePalette();
  // (drawn after the palette, so the palette a given run of random numbers makes is as it was before there were Looks)
  var looks = ['auto', 'auto', 'auto', 'smooth', 'ltd'];
  look = looks[(Math.random() * looks.length) | 0];
  // about one in three: Random with a main colour, its roles the generated palette's own colours (v283; drawn last, for
  // the same reason)
  if (Math.random() < 1 / 3) {
    family = 'random';
    balance = 'main';
    balM = balS = balA = 'auto';
    balSeed = Math.random();
    noRep = false;
  }
  surpriseNote = true;
  planWhy = 'Surprise';
  reassign();
}
function backToReview() {
  zoneEditEnd(true);
  heldNoteClear();
  if (assignData && guideDirty) {
    clearTimeout(autoT);
    doAutosave();
  }
  sfmode = 'review';
  focus = false;
  hideTip();
  closeSwatchPop(false);
  photoAlign = false;
  photoPeek = false;
  shadeFlatMode = false;
  lockMode = false;
  var _rt2 = document.getElementById('sfRoot');
  if (_rt2) _rt2.classList.remove('sffoc');
  if (sfView) sfView.style.paddingTop = sfView.style.paddingBottom = '';
  renderControls();
  render();
}
