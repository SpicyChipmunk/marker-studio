function retrigger(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}
function pulse() {
  if (reduce) return;
  retrigger(halo, 'go');
  retrigger(stage, 'pulse');
}
function shine() {
  if (reduce) return;
  retrigger(shineEl, 'go');
}
function setAmb(hex) {
  root.style.setProperty('--amb', hex ? rgba(hex, 0.5) : 'transparent');
  ambient.style.background = hex
    ? 'radial-gradient(120% 80% at 50% -8%,' + rgba(hex, 0.56) + ',transparent 60%)'
    : '';
}
function flood(hex) {
  if (reduce) {
    swatch.style.background = hex;
    return;
  }
  const r = document.createElement('span');
  r.className = 'ripple';
  r.style.background = hex;
  swatch.appendChild(r);
  requestAnimationFrame(() => r.classList.add('go'));
  r.addEventListener(
    'animationend',
    () => {
      swatch.style.background = hex;
      r.remove();
    },
    { once: true },
  );
}

function showColor(idx, animate) {
  const c = COLORS[idx];
  hint.style.display = 'none';
  code.style.display = '';
  code.style.color = txt(c.hex);
  if (animate) {
    flood(c.hex);
    code.textContent = c.code;
    retrigger(code, 'pop');
    pulse();
    shine();
  } else {
    swatch.style.background = c.hex;
    code.textContent = c.code;
  }
  const old = c.old && c.old !== c.code ? ' — was ' + oldCode(c) : '';
  const tl = (TONE_DEFS.find((t) => t.k === TONE[idx]) || {}).t || '',
    sl = (SAT_DEFS.find((s) => s.k === SAT[idx]) || {}).t || '';
  readout.classList.remove('rpal');
  readout.innerHTML =
    '<div><div class="name">' +
    c.name +
    '</div><div class="fam">' +
    c.brand +
    ' · ' +
    c.fam +
    old +
    '</div><div class="ts">' +
    tl +
    ' · ' +
    sl +
    '</div></div><div class="hex">' +
    c.hex.toUpperCase() +
    '</div>';
  if (animate) retrigger(readout, 'pop');
  setAmb(c.hex);
}
function clearColor() {
  code.style.display = 'none';
  hint.style.display = '';
  swatch.style.background = '#1a1a20';
  readout.innerHTML = '';
  setAmb(null);
}

// eslint-disable-next-line no-unused-vars -- not called by the app any more; test/matching.test.mjs checks it
function nearest(target, opt) {
  opt = opt || {};
  const ex = opt.exclude || new Set();
  let best = -1,
    bc = 1e9;
  for (let i = 0; i < COLORS.length; i++) {
    if (ex.has(i) || !inPool(i)) continue;
    const o = HS[i];
    if (o.s < (opt.minS != null ? opt.minS : 0.16)) continue;
    let cost =
      hueDist(o.h, target) / 180 +
      (1 - o.s) * 0.15 +
      (opt.preferL != null ? Math.abs(o.l - opt.preferL) * 0.55 : 0);
    if (cost < bc) {
      bc = cost;
      best = i;
    }
  }
  if (best < 0) {
    for (let i = 0; i < COLORS.length; i++) {
      if (ex.has(i) || !inPool(i)) continue;
      const o = HS[i];
      let cost = hueDist(o.h, target) / 180 + (opt.preferL != null ? Math.abs(o.l - opt.preferL) * 0.55 : 0);
      if (cost < bc) {
        bc = cost;
        best = i;
      }
    }
  }
  return best;
}
/* ---- the palette generator: the Palette screen's schemes and the guide's Generate palette ----
   Colours are chosen as the eye sees them (L*C*h°, colour.js), not by HSL, which counts dull brown-greys as colours
   and spaces hues unevenly. Each colour has a target (a hue from the scheme, a lightness from a ramp) and gets one of
   the three markers that fit it best, so rolls vary. The rules, strictest first:
   - every two colours are clearly different: CIEDE2000 at least 10 (Monochrome 6, as its steps are meant to be close);
   - no greys or near-greys in a colour scheme (a Monochrome of a greyish family may use its own);
   - each colour within 30° of its scheme hue; Analogous keeps all its colours within 120°, Monochrome within 25°.
   When a collection can't fill every colour that way, the rules are relaxed a step at a time (closer colours first,
   then hues further out, greys last) rather than making a shorter palette, and the caller is told (opts.report).
   A mood (the guide's looks, colour.js MOODS) moves the lightness and chroma aimed for; a colour comes from outside
   the mood only when no marker inside it fits. */
const ANCH = {
  complementary: [0, 180],
  split: [0, 150, 210],
  triadic: [0, 120, 240],
  tetradic: [0, 90, 180, 270],
  mono: [0],
};
// the smallest colour difference (CIEDE2000) a scheme's palette aims for between any two of its colours
function genNeed(harmony) {
  // (v306: Rainbow's colours are only as far apart as the markers round the wheel allow, at similar lightness)
  return harmony === 'mono' ? 6 : harmony === 'rainbow' ? 5 : 10;
}
// The steps tried in turn: [smallest ΔE00 between two colours, hue allowance in degrees, greys allowed]. The hue
// allowance is how far a colour may be from its scheme hue; for Analogous it's how widely all its hues may spread (it
// gives up closeness entirely before spreading past 120°, or it wouldn't be analogous any more); for Monochrome how far
// from the base colour's hue. Colour schemes give up a little closeness before drifting a little in hue. (v304: when
// greys have to fill in, closeness is asked for again first, so the greys chosen aren't near-copies of each other)
const GEN_LEVELS = {
  anchors: [
    [10, 30],
    [8, 30],
    [8, 45],
    [6, 45],
    [6, 60],
    [4, 60],
    [4, 90],
    [0, 90],
    [0, 180],
    [10, 180, 1],
    [6, 180, 1],
    [4, 180, 1],
    [0, 180, 1],
  ],
  analogous: [
    [10, 120],
    [8, 120],
    [6, 120],
    [4, 120],
    [0, 120],
    [0, 180],
    [0, 360],
    [10, 360, 1],
    [6, 360, 1],
    [4, 360, 1],
    [0, 360, 1],
  ],
  mono: [
    [6, 25],
    [4, 25],
    [4, 35],
    [2, 35],
    [0, 35],
    [0, 60],
    [0, 180],
    [6, 180, 1],
    [4, 180, 1],
    [2, 180, 1],
    [0, 180, 1],
  ],
};
// A family is greyish when its typical marker (the middle chroma of the brand's family) is a near-grey: Ohuhu's
// Blue Grey and Yellow Grey (BGY, YGY) as well as the other greys. A Monochrome of one may use its near-greys.
let _famMidC = null;
function famGreyish(i) {
  if (!_famMidC) {
    const m = {};
    COLORS.forEach((c, k) => {
      const f = c.brand + '|' + c.fam;
      (m[f] = m[f] || []).push(LCH[k][1]);
    });
    _famMidC = {};
    for (const f in m) _famMidC[f] = m[f].sort((a, b) => a - b)[m[f].length >> 1];
  }
  return _famMidC[COLORS[i].brand + '|' + COLORS[i].fam] < GREY_C;
}
// a hue's signed offset from the base hue, -180..180 (for Analogous's spread)
function hueOff(h, bh) {
  return ((h - bh + 540) % 360) - 180;
}
// the lightness a mood's colours aim for (Pastel light, Deep and Earthy dark), short of the near-white and near-black
function genBand(mood) {
  const L = MOODS[mood].L;
  return [Math.max(L[0], 24), Math.min(L[1], 94)];
}
// how much a marker's chroma suits the mood: stronger is mildly better, much better for Bright; Soft and Earthy
// prefer the middle of their range
function genChromaCost(mood, C) {
  if (mood === 'vivid') return -Math.min(C, 100) / 100;
  if (mood === 'muted' || mood === 'earthy')
    return Math.abs(C - (MOODS[mood].C[0] + MOODS[mood].C[1]) / 2) / 60;
  return -Math.min(C, 60) / 120;
}
// the markers in play (minus `exclude`), their place in that list, and how far each is outside the mood
function genCtx(harmony, mood, exclude) {
  const pool = [],
    at = new Int32Array(COLORS.length).fill(-1);
  for (let i = 0; i < COLORS.length; i++)
    if (inPool(i) && !(exclude && exclude.has(i))) {
      at[i] = pool.length;
      pool.push(i);
    }
  let off = null;
  if (mood !== 'neutral') {
    off = new Float32Array(pool.length);
    for (let j = 0; j < pool.length; j++) off[j] = moodOff(mood, LCH[pool[j]]);
  }
  return {
    harmony,
    mood,
    pool,
    at,
    off,
    des: new Map(),
    cum: null,
    levels: GEN_LEVELS[harmony === 'mono' || harmony === 'analogous' ? harmony : 'anchors'],
    bh: 0,
    fam: null,
    greyFam: false,
  };
}
// the colour difference between two markers, worked out once per palette (tries and steps ask again)
function genDE(ctx, a, b) {
  const k = a < b ? a * 4096 + b : b * 4096 + a;
  let d = ctx.des.get(k);
  if (d === undefined) {
    d = de2000(LAB[a], LAB[b]);
    ctx.des.set(k, d);
  }
  return d;
}
// whether the markers in play have enough colours near a base hue for n colours of Analogous (within 60° either side)
// or Monochrome (within its allowance) at the first step, counted from a histogram of the clear markers' hues so that
// trying every base is quick. (The other schemes don't ask: on a small collection it made them repeat themselves and
// relax closeness more, for little gain in keeping to their hues.)
function genRoomy(ctx, h, n) {
  if (ctx.harmony !== 'analogous' && ctx.harmony !== 'mono') return true;
  if (!ctx.cum) {
    const cum = new Int32Array(721);
    for (const i of ctx.pool) if (LCH[i][1] >= GREY_C) cum[((LCH[i][2] | 0) % 360) + 1]++;
    for (let d = 1; d <= 720; d++) cum[d] = (d > 360 ? cum[d - 360] - cum[d - 361] : cum[d]) + cum[d - 1];
    ctx.cum = cum;
  }
  const near = (c, w) => {
    const a = Math.round(c - w + 720) % 360;
    return ctx.cum[a + 2 * w + 1] - ctx.cum[a];
  };
  return near(h, ctx.harmony === 'analogous' ? 60 : ctx.levels[0][1]) >= n;
}
// A random base colour: a clear colour of middling lightness (in the mood when there is one) with room around it for
// Analogous or Monochrome (from a small collection's sparse hues they'd drift), else any clear colour, else any.
function genBase(ctx, n) {
  const tiers = [[], [], [], [], [], []];
  for (let j = 0; j < ctx.pool.length; j++) {
    const i = ctx.pool[j],
      L = LCH[i],
      clear = L[1] >= 20 && L[0] >= 25 && L[0] <= 90,
      inMood = !(ctx.off && ctx.off[j] > 0);
    if (clear) tiers[genRoomy(ctx, L[2], n) ? (inMood ? 0 : 1) : inMood ? 2 : 3].push(i);
    else tiers[L[1] >= GREY_C ? 4 : 5].push(i);
  }
  const t = tiers.find((x) => x.length);
  return t ? t[(Math.random() * t.length) | 0] : null;
}
// whether a marker is a candidate for a colour whose hue is `h` at the first step (for the lightness range)
function genNear(ctx, i, h) {
  const L = LCH[i];
  if (L[1] < GREY_C) return ctx.greyFam && COLORS[i].fam === ctx.fam;
  if (ctx.harmony === 'analogous') return hueDist(L[2], ctx.bh) <= 60;
  return hueDist(L[2], h) <= ctx.levels[0][1];
}
// the lightness range a group of colours spreads over: the mood's, narrowed to what the markers near that hue have
function genRange(ctx, h) {
  const band = genBand(ctx.mood);
  let lo = 1e9,
    hi = -1e9,
    lo2 = 1e9,
    hi2 = -1e9;
  for (let j = 0; j < ctx.pool.length; j++) {
    const i = ctx.pool[j];
    if (!genNear(ctx, i, h)) continue;
    const L = LCH[i][0];
    lo2 = Math.min(lo2, L);
    hi2 = Math.max(hi2, L);
    if (!(ctx.off && ctx.off[j] > 0)) {
      lo = Math.min(lo, L);
      hi = Math.max(hi, L);
    }
  }
  if (lo > hi) {
    lo = lo2;
    hi = hi2;
  }
  lo = Math.max(lo, band[0]);
  hi = Math.min(hi, band[1]);
  return lo < hi ? [lo, hi] : band;
}
// k lightnesses evenly spread over a range, lightest first, short of its ends
function genRamp(r, k) {
  const out = [];
  for (let j = 0; j < k; j++) out.push(r[1] - ((r[1] - r[0]) * (j + 0.5)) / k);
  return out;
}
// each colour's target { h, L } in palette order, and the order to fill them in (the hardest first: the scheme hue
// with the fewest markers; Analogous from the middle out, so its spread stays centred)
function genSlots(ctx, n) {
  const slots = [],
    bh = ctx.bh;
  if (ctx.harmony === 'analogous' || ctx.harmony === 'mono') {
    const Ls = genRamp(genRange(ctx, bh), n),
      span = ctx.harmony === 'mono' ? 0 : n <= 2 ? 20 : n <= 4 ? 30 : 40;
    for (let p = 0; p < n; p++)
      slots.push({ h: (bh + (n === 1 ? 0 : -span + (2 * span * p) / (n - 1)) + 360) % 360, L: Ls[p] });
    const order = slots.map((_, p) => p);
    if (ctx.harmony === 'analogous')
      order.sort((a, b) => Math.abs(a - (n - 1) / 2) - Math.abs(b - (n - 1) / 2));
    return { slots, order, groups: [order.slice().sort((a, b) => a - b)] };
  }
  const anchors = ANCH[ctx.harmony] || ANCH.complementary,
    A = anchors.length,
    groups = [];
  for (let a = 0; a < A; a++) {
    const k = Math.floor(n / A) + (a < n % A ? 1 : 0);
    if (!k) continue;
    const h = (bh + anchors[a]) % 360,
      g = [];
    for (const L of genRamp(genRange(ctx, h), k)) {
      g.push(slots.length);
      slots.push({ h, L });
    }
    let have = 0;
    for (const i of ctx.pool) if (genNear(ctx, i, h)) have++;
    groups.push([have, g]);
  }
  groups.sort((a, b) => a[0] - b[0]);
  return { slots, order: [].concat(...groups.map((g) => g[1])), groups: groups.map((g) => g[1]) };
}
// the running state of one try: markers taken (in the pool, and every colour placed so far), each marker's
// smallest difference to the first `upto` of those (brought up to date only when it is a contender), and Analogous's
// spread of hues (offsets from the base)
function genState(ctx, lv, fixed) {
  const st = {
      used: new Uint8Array(ctx.pool.length),
      placed: [],
      minD: new Float32Array(ctx.pool.length).fill(1e9),
      upto: new Int32Array(ctx.pool.length),
      lo: Infinity,
      hi: -Infinity,
      widened: 0,
      avoid: -1,
    },
    offs = [];
  for (const i of fixed) {
    genPlace(ctx, st, i, false);
    if (LCH[i][1] >= GREY_C) offs.push(hueOff(LCH[i][2], ctx.bh));
  }
  // locked colours count toward the spread only while they keep within it themselves (else they're the user's choice)
  if (offs.length && Math.max(...offs) - Math.min(...offs) <= lv[1]) {
    st.lo = Math.min(...offs);
    st.hi = Math.max(...offs);
  }
  return st;
}
function genPlace(ctx, st, i, spread) {
  if (ctx.at[i] >= 0) st.used[ctx.at[i]] = 1;
  st.placed.push(i);
  if (spread && LCH[i][1] >= GREY_C) {
    const o = hueOff(LCH[i][2], ctx.bh);
    st.lo = Math.min(st.lo, o);
    st.hi = Math.max(st.hi, o);
  }
}
// a pool marker's smallest difference to the colours placed so far
function genMinD(ctx, st, j) {
  let m = st.minD[j];
  for (let q = st.upto[j]; q < st.placed.length; q++) m = Math.min(m, genDE(ctx, st.placed[q], ctx.pool[j]));
  st.upto[j] = st.placed.length;
  return (st.minD[j] = m);
}
// the best three [cost, place] so far, cheapest first
function worse3(B, c) {
  return B.length === 3 && c >= B[2][0];
}
function keep3(B, c, j) {
  B.push([c, j]);
  B.sort((a, b) => a[0] - b[0]);
  if (B.length > 3) B.pop();
}
// The marker for one colour: among the free markers that pass this step's rules, one of the three that best fit its
// target (not one much worse than the best), from inside the mood while any fit, else the nearest outside it.
// Returns its place in the pool, or -1.
function genPick(ctx, slot, lv, st) {
  const P = ctx.pool,
    mono = ctx.harmony === 'mono',
    ana = ctx.harmony === 'analogous',
    inB = [],
    outB = [];
  for (let j = 0; j < P.length; j++) {
    if (st.used[j]) continue;
    const i = P[j],
      L = LCH[i];
    let hc;
    if (L[1] < GREY_C) {
      if (!lv[2] && !(ctx.greyFam && COLORS[i].fam === ctx.fam)) continue;
      hc = ctx.greyFam ? 0 : 1; // a near-grey's hue means little
    } else if (ana) {
      const o = hueOff(L[2], ctx.bh);
      if (Math.max(st.hi, o) - Math.min(st.lo, o) > lv[1]) continue;
      hc = hueDist(L[2], slot.h) / 30;
    } else {
      const d = hueDist(L[2], mono ? ctx.bh : slot.h);
      if (d > lv[1]) continue;
      hc = mono ? d / 15 : d / 30;
    }
    // (a greyish family's Monochrome keeps to its greys: less colour is better there)
    let c = hc + Math.abs(L[0] - slot.L) / 18 + (ctx.greyFam ? L[1] / 30 : genChromaCost(ctx.mood, L[1]));
    if (mono && COLORS[i].fam !== ctx.fam) c += 0.6;
    if (st.avoid >= 0 && genDE(ctx, st.avoid, i) < 5) c += 0.8;
    const out = ctx.off && ctx.off[j] > 0,
      B = out ? outB : inB;
    if (out) c += ctx.off[j] / 8;
    // closeness last: it's the costly check, needed only for a marker that would make the best three
    if (worse3(B, c) || (lv[0] > 0 && genMinD(ctx, st, j) < lv[0])) continue;
    keep3(B, c, j);
  }
  const B = inB.length ? inB : outB;
  if (!B.length) return -1;
  if (!inB.length) st.widened++;
  const ok = B.filter((b) => b[0] <= B[0][0] + 0.6);
  return ok[(Math.random() * ok.length) | 0][1];
}
// one try at filling every colour at one step; the palette, or null when a colour found no marker
function genTry(ctx, plan, locked, lv) {
  const fixed = [],
    out = [];
  for (let p = 0; p < plan.slots.length; p++) {
    out.push(locked[p] != null ? locked[p] : -1);
    if (locked[p] != null) fixed.push(locked[p]);
  }
  const st = genState(ctx, lv, fixed);
  for (const p of plan.order) {
    if (out[p] >= 0) continue;
    const j = genPick(ctx, plan.slots[p], lv, st);
    if (j < 0) return null;
    out[p] = ctx.pool[j];
    genPlace(ctx, st, out[p], true);
  }
  return { out, widened: st.widened };
}
// the smallest colour difference between two colours of a palette, leaving out pairs of fixed ones (a locked pair
// that is close is the user's choice); null with no pair to measure
function palMinDE(pal, fixed) {
  let m = null;
  for (let a = 0; a < pal.length; a++)
    for (let b = a + 1; b < pal.length; b++) {
      if (fixed && fixed.has(pal[a]) && fixed.has(pal[b])) continue;
      const d = de2000(LAB[pal[a]], LAB[pal[b]]);
      if (m == null || d < m) m = d;
    }
  return m;
}
/* (v308) The most colours a scheme offers from the markers in play, as Rainbow stops at its clear colours: a size needs
   that many clearly different clear markers (CIEDE2000 8 apart) near the scheme's hues, as its note judges them
   (palOnScheme: Monochrome within 25° of one hue, or a greyish family's greys; Analogous within 120°; the others within
   30° of each of their hues, each hue with its share), round the best base hue (in 5° steps). Honolulu 24's Monochrome
   had offered 10, which spanned yellow, red and violet; it now stops at 5. Never under the scheme's smallest size;
   Custom, Photo and Rainbow keep theirs, and so does a collection with 160 or more clear markers in play (every size
   was set for a full one). Worked out once for the markers in play. */
let _capK = '',
  _cap = {};
const CAP_DE = 8,
  CAP_BIG = 160;
function palCap(h) {
  const R = HARM_RANGE[h] || [2, 6];
  if (h === 'custom' || h === 'photo' || h === 'rainbow') return R[1];
  const k = poolSig();
  if (k !== _capK) {
    _capK = k;
    _cap = {};
  }
  if (_cap[h] != null) return _cap[h];
  const P = [];
  let greys = 0;
  for (let i = 0; i < COLORS.length; i++) {
    if (!inPool(i)) continue;
    if (LCH[i][1] < GREY_C) greys++;
    else P.push(i);
  }
  if (P.length >= CAP_BIG) return (_cap[h] = R[1]);
  // the clear markers within w degrees of hue c, counting only those clearly different from one counted
  const near = (c, w) => {
    const kept = [];
    for (const i of P)
      if (hueDist(LCH[i][2], c) <= w && kept.every((j) => de2000(LAB[i], LAB[j]) >= CAP_DE)) kept.push(i);
    return kept.length;
  };
  let best = 0;
  if (h === 'mono') {
    best = greys;
    for (let b = 0; b < 360; b += 5) best = Math.max(best, near(b, 25));
  } else if (h === 'analogous') {
    for (let b = 0; b < 360; b += 5) best = Math.max(best, near(b, 60));
  } else {
    const A = ANCH[h] || ANCH.complementary;
    for (let b = 0; b < 360 && best < R[1]; b += 5) {
      const c = A.map((a) => near(b + a, 30));
      for (let n = R[1]; n > best; n--)
        if (A.every((_, q) => Math.floor(n / A.length) + (q < n % A.length ? 1 : 0) <= c[q])) {
          best = n;
          break;
        }
    }
  }
  return (_cap[h] = Math.max(R[0], Math.min(R[1], best)));
}
// a scheme's size within what the markers in play offer (palCap)
function palSizeFit() {
  const h = state.harmony;
  if (h === 'custom' || h === 'photo' || h === 'rainbow') return;
  const c = palCap(h);
  if (state.palSize > c) state.palSize = c;
}
// (v296) from a map made once: it's asked per marker in Library tiles, To buy and the swatch chart
let _keyIdx = null;
function keyIdx(key) {
  if (key == null) return null;
  if (!_keyIdx) {
    _keyIdx = new Map();
    for (let i = 0; i < COLORS.length; i++) _keyIdx.set(mkey(i), i);
  }
  const i = _keyIdx.get(key);
  return i == null ? null : i;
}
function paletteOpts() {
  const opts = { locked: {} };
  const cur = state.palettes[state.palettes.length - 1];
  const seedIdx = keyIdx(state.seed);
  if (seedIdx != null && inPool(seedIdx)) {
    opts.baseHue = LCH[seedIdx][2];
    opts.locked[0] = seedIdx;
    opts.seedIdx = seedIdx;
  } else if (cur && cur.length && state.locked.length) {
    opts.baseHue = LCH[cur[0]][2];
  }
  if (cur) {
    const out = [];
    cur.forEach((idx, pos) => {
      if (!state.locked.includes(idx) || Object.values(opts.locked).includes(idx)) return;
      if (pos < state.palSize && opts.locked[pos] == null) opts.locked[pos] = idx;
      else out.push(idx);
    });
    // (v296) a colour locked past the new size (8 → 4) moves into a free place instead of being dropped
    for (let pos = state.palSize - 1; pos >= 0 && out.length; pos--)
      if (opts.locked[pos] == null) opts.locked[pos] = out.shift();
  }
  return opts;
}
// Palette › From photo: the photo, the colour each band came from, and the lighting correction from its paper (when
// you tapped the white paper; events.js)
var _photoImg = null,
  _photoLabs = null,
  _photoFix = null;
// (each band's markers shown since the photo's palette was made: a tap walks on to the next nearest instead of going
// back to the one before, v304)
var _photoTried = {};
// (v308) the photo colours each photo palette's markers stand for, kept with that palette: Undo can go back to an
// earlier one (another size), whose bands aren't the latest's
var _photoLabsOf = new WeakMap();
function swapPhotoBand(k) {
  var pal = state.palettes[state.palettes.length - 1],
    labs = (pal && _photoLabsOf.get(pal)) || _photoLabs;
  if (!pal || !labs || !labs[k]) return;
  var lab = labs[k],
    exc = {},
    tried = _photoTried[k] || (_photoTried[k] = new Set()),
    others = pal.filter(function (_, p) {
      return p !== k;
    }),
    i;
  for (i = 0; i < pal.length; i++) exc[pal[i]] = 1;
  tried.add(pal[k]);
  // (round the five nearest and back to the first: Photo has no Undo button, so the taps mustn't only lead away, v304)
  if (tried.size > 5) {
    tried.clear();
    tried.add(pal[k]);
  }
  // the nearest free marker not shown yet that keeps `min` (CIEDE2000) from the other colours, as the palette does
  function near(min) {
    var best = -1,
      bd = 1e9,
      d;
    for (var j = 0; j < COLORS.length; j++) {
      if (exc[j] || tried.has(j) || !inPool(j)) continue;
      d = de2000(lab, LAB[j]);
      if (d >= bd) continue;
      if (
        min > 0 &&
        others.some(function (o) {
          return de2000(LAB[o], LAB[j]) < min;
        })
      )
        continue;
      bd = d;
      best = j;
    }
    return best;
  }
  var best = near(6);
  if (best < 0) best = near(4);
  if (best < 0) best = near(0);
  // every marker shown: round again from the nearest
  if (best < 0 && tried.size > 1) {
    tried.clear();
    tried.add(pal[k]);
    best = near(6);
    if (best < 0) best = near(0);
  }
  if (best < 0) return;
  // (a new step in the history, so Undo brings the colour back, v299)
  const np = pal.slice();
  np[k] = best;
  _photoLabsOf.set(np, labs);
  palPush(np, 20);
  save();
  showPalette(np, false);
}
function _pRgbLab(r, g, b) {
  return hexToLab(
    '#' +
      [r, g, b]
        .map(function (v) {
          return ('0' + ((v | 0) & 255).toString(16)).slice(-2);
        })
        .join(''),
  );
}
/* The markers for a photo (Palette › From photo): { markers, labs } (labs: the photo colour each marker stands for), or
   null when the image can't be read; { none: true } when it has no colour a marker can make.
   The photo's colours (v305): its pixels binned by colour, then clustered in L*a*b* (k-means from a fixed seed, so the
   same photo always gives the same palette) and merged when they look alike (CIEDE2000 under 5). Median cut before
   split each colour's pixels across boxes and averaged them into mud (six bright blocks on a dark ground gave white,
   two browns and one yellow). Each colour is ranked by √share × (1 + chroma/30); only when at least a tenth of the
   photo is clearly coloured do its blacks, whites and paper go well down and its mid-greys a little, so a grey cat on
   grass keeps its grey. The boldest colour covering at least 1% is always kept (a red umbrella in a grey street).
   Then each colour in turn gets the marker in play nearest it by eye: first only a close match (within 12) clearly
   different from those chosen (at least 10), then looser (v308: 18 and 6, then 18 and any). Near-white is skipped: no marker
   makes white. When the photo has fewer colours than wanted, its colours take a second marker each, and so on,
   until there are n (or the markers in play run out).
   (v308) The first pass also keeps hues apart (a sunset at 4 had been four reds); the darks, when together they cover
   more than 15% of the photo (a silhouette), aren't pushed down (only a little from half of it: a dark ground); no marker further than PHOTO_FAR (18) from its colour
   is used, so a photo with fewer colours gives fewer markers (few: true, "This photo has about N colours") rather
   than made-up ones; and the bands come in hue order, then the near-greys light to dark.
   `fix` (optional): the lighting correction from the photo's paper, applied first. */
function extractPhotoPalette(img, n, fix) {
  var cv = document.createElement('canvas'),
    area = img.width * img.height,
    sc = Math.min(1, Math.sqrt(9000 / Math.max(1, area)));
  var w = Math.max(1, Math.round(img.width * sc)),
    hh = Math.max(1, Math.round(img.height * sc));
  cv.width = w;
  cv.height = hh;
  var cx = cv.getContext('2d');
  // (in halving steps: Safari's engine shrinks in one go without averaging, so the photo's colours came out noisy, v296)
  drawShrunk(cx, img, w, hh);
  var d;
  try {
    d = cx.getImageData(0, 0, w, hh).data;
  } catch (e) {
    return null;
  } finally {
    freeCanvas(cv);
  }
  if (fix) lightApplyData(fix, d);
  // the pixels by colour (5 bits a channel), each bin the average L*a*b* of its pixels and how many
  var bins = new Map(),
    i,
    j;
  for (i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 125) continue;
    var key = ((d[i] >> 3) << 10) | ((d[i + 1] >> 3) << 5) | (d[i + 2] >> 3),
      bn = bins.get(key);
    if (!bn) {
      bn = [0, 0, 0, 0];
      bins.set(key, bn);
    }
    bn[0] += d[i];
    bn[1] += d[i + 1];
    bn[2] += d[i + 2];
    bn[3]++;
  }
  if (!bins.size) return { markers: [], labs: [], none: true };
  var px = [],
    wt = [];
  bins.forEach(function (bn) {
    px.push(_pRgbLab(bn[0] / bn[3], bn[1] / bn[3], bn[2] / bn[3]));
    wt.push(bn[3]);
  });
  var U = px.length;
  // k-means in L*a*b* (weighted by pixels), k-means++ start from a fixed seed: the same photo always gives the same palette
  var k = Math.min(U, Math.max(16, 3 * n)),
    seed = 0x9e3779b9;
  function rnd() {
    seed = (seed + 0x6d2b79f5) >>> 0;
    var t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function d2(a, b) {
    var x = a[0] - b[0],
      y = a[1] - b[1],
      z = a[2] - b[2];
    return x * x + y * y + z * z;
  }
  var first = 0;
  for (i = 1; i < U; i++) if (wt[i] > wt[first]) first = i;
  var C = [px[first].slice()],
    best = new Float64Array(U);
  for (i = 0; i < U; i++) best[i] = d2(px[i], C[0]);
  while (C.length < k) {
    var tot = 0;
    for (i = 0; i < U; i++) tot += best[i] * wt[i];
    if (!tot) break;
    var r = rnd() * tot;
    for (i = 0; i < U - 1 && r > best[i] * wt[i]; i++) r -= best[i] * wt[i];
    var c = px[i].slice();
    C.push(c);
    for (j = 0; j < U; j++) {
      var dd = d2(px[j], c);
      if (dd < best[j]) best[j] = dd;
    }
  }
  var asg = new Int32Array(U).fill(-1),
    K = C.length,
    it,
    moved = true;
  for (it = 0; it < 12 && moved; it++) {
    moved = false;
    for (i = 0; i < U; i++) {
      var b = 0,
        bd = Infinity;
      for (j = 0; j < K; j++) {
        var e = d2(px[i], C[j]);
        if (e < bd) {
          bd = e;
          b = j;
        }
      }
      if (asg[i] !== b) {
        asg[i] = b;
        moved = true;
      }
    }
    var S = [];
    for (j = 0; j < K; j++) S.push([0, 0, 0, 0]);
    for (i = 0; i < U; i++) {
      var s = S[asg[i]],
        ww = wt[i];
      s[0] += px[i][0] * ww;
      s[1] += px[i][1] * ww;
      s[2] += px[i][2] * ww;
      s[3] += ww;
    }
    for (j = 0; j < K; j++) if (S[j][3]) C[j] = [S[j][0] / S[j][3], S[j][1] / S[j][3], S[j][2] / S[j][3]];
  }
  var cnt = new Array(K).fill(0);
  for (i = 0; i < U; i++) cnt[asg[i]] += wt[i];
  var reps = [];
  for (j = 0; j < K; j++) if (cnt[j]) reps.push({ lab: C[j], w: cnt[j] });
  reps.sort(function (a, b) {
    return b.w - a.w;
  });
  var merged = [];
  for (i = 0; i < reps.length; i++) {
    var dup = false;
    for (j = 0; j < merged.length; j++)
      if (de2000(reps[i].lab, merged[j].lab) < 5) {
        var m = merged[j],
          tw = m.w + reps[i].w;
        m.lab = [0, 1, 2].map(function (z) {
          return (m.lab[z] * m.w + reps[i].lab[z] * reps[i].w) / tw;
        });
        m.w = tw;
        dup = true;
        break;
      }
    if (!dup) merged.push({ lab: reps[i].lab, w: reps[i].w });
  }
  var cand = merged.filter(function (rp) {
    return !(rp.lab[0] >= 90 && Math.hypot(rp.lab[1], rp.lab[2]) < GREY_C);
  });
  if (!cand.length) return { markers: [], labs: [], none: true };
  // ranked by share × colourfulness; when a fair part of the photo has colour (10%), its greys and blacks (a
  // background, a tray, shadows) come after its colours
  var tw2 = 0,
    cw = 0;
  cand.forEach(function (c) {
    c.c = Math.hypot(c.lab[1], c.lab[2]);
    tw2 += c.w;
    if (c.c >= 20) cw += c.w;
  });
  var colourful = cw >= 0.1 * tw2,
    // (v308) the photo's darks together: a sunset's silhouette (a quarter of it) is part of the picture, not shadow
    dk = 0;
  cand.forEach(function (c) {
    if (c.lab[0] < 25) dk += c.w;
  });
  // (most of the photo dark is its ground, as for coloured caps on a black tray: pushed down, if less far)
  var darkBig = dk > PHOTO_DARK * tw2,
    darkGround = dk >= PHOTO_GROUND * tw2;
  cand.forEach(function (c) {
    var sh = c.w / tw2,
      dark = c.lab[0] < 25,
      low = c.lab[0] > 80 || dark ? (dark && darkBig ? (darkGround ? PHOTO_DARK_K : 0.8) : 0.15) : 0.8;
    c.s =
      Math.sqrt(sh) *
      (1 + Math.min(c.c, 60) / 30) *
      (colourful ? Math.max(low, Math.min(1, (c.c - 6) / 18)) : 1) *
      (sh < 0.005 ? 0.1 : 1);
  });
  cand.sort(function (a, b) {
    return b.s - a.s;
  });
  // the photo's boldest colour (at least 1% of it) is never left out: a red umbrella in a grey street
  var acc = -1;
  for (i = 0; i < cand.length; i++)
    if (
      cand[i].c >= 30 &&
      cand[i].w >= 0.01 * tw2 &&
      (acc < 0 || cand[i].c * Math.sqrt(cand[i].w) > cand[acc].c * Math.sqrt(cand[acc].w))
    )
      acc = i;
  if (acc > 1) cand.splice(1, 0, cand.splice(acc, 1)[0]);
  var pool = [];
  for (i = 0; i < COLORS.length; i++) if (inPool(i)) pool.push(i);
  var out = [],
    outLabs = [],
    taken = new Set();
  // the marker in play nearest `lab` that is at least `min` from every one chosen (closeness checked only for a
  // marker that would be the nearest so far: it's the costly part), or -1
  function pick(lab, min) {
    var best = -1,
      bd = 1e9,
      kk,
      q,
      mi,
      dd,
      ok;
    for (kk = 0; kk < pool.length; kk++) {
      mi = pool[kk];
      if (taken.has(mi)) continue;
      dd = de2000(lab, LAB[mi]);
      if (dd >= bd) continue;
      ok = true;
      for (q = 0; q < out.length && ok && min > 0; q++) if (de2000(LAB[out[q]], LAB[mi]) < min) ok = false;
      if (!ok) continue;
      bd = dd;
      best = mi;
    }
    return best;
  }
  function add(mi, lab) {
    taken.add(mi);
    out.push(mi);
    outLabs.push(lab);
  }
  // (v308) a photo colour whose hue is near one already chosen (both clearly coloured, and not dark): the first pass
  // leaves it for later, so four colours of a sunset aren't four reds (a dark's hue counts for little: a sunset's dark
  // violet hills and its violet sky are both kept)
  var chosenH = [];
  function hueOf(c) {
    return (Math.atan2(c.lab[2], c.lab[1]) * 180) / Math.PI;
  }
  function hued(c) {
    return c.c >= PHOTO_HUE_C && c.lab[0] >= 25;
  }
  function hueTaken(c) {
    if (!hued(c)) return false;
    var h = hueOf(c);
    for (var q = 0; q < chosenH.length; q++) if (hueDist(h, chosenH[q]) < PHOTO_HUE_APART) return true;
    return false;
  }
  // first the colours a marker matches well (within 12), clearly different from those chosen (10) and of a hue not
  // chosen yet, then looser; never a marker further than PHOTO_FAR from the colour it stands for (v308: a grey photo
  // at 12 had been given a blue, a red-violet and a green 15-25 from the colours they stood for)
  var steps = [10, 10, 6, 0],
    caps = [12, 12, PHOTO_FAR, PHOTO_FAR],
    st,
    done = new Set();
  for (st = 0; st < steps.length && out.length < n; st++)
    for (i = 0; i < cand.length && out.length < n; i++) {
      if (done.has(i) || (st === 0 && hueTaken(cand[i]))) continue;
      var bb = pick(cand[i].lab, steps[st]);
      if (bb >= 0 && de2000(cand[i].lab, LAB[bb]) <= caps[st]) {
        add(bb, cand[i].lab);
        done.add(i);
        if (hued(cand[i])) chosenH.push(hueOf(cand[i]));
      }
    }
  // fewer colours in the photo than wanted: each takes another marker in turn, as different as can be, while one is
  // within PHOTO_FAR of it; past that the photo has no more colours to give (said: few)
  for (st = 1; st < steps.length && out.length < n; st++) {
    var more = true;
    while (more && out.length < n) {
      more = false;
      for (i = 0; i < cand.length && out.length < n; i++) {
        var b2 = pick(cand[i].lab, steps[st]);
        if (b2 >= 0 && de2000(cand[i].lab, LAB[b2]) <= PHOTO_FAR) {
          add(b2, cand[i].lab);
          more = true;
        }
      }
    }
  }
  var few = out.length < n && out.length < pool.length;
  // (v308) the bands in order: the clear colours by hue, round from the widest gap between them, so they run on
  // (a sunset's violet, red, orange, gold); near-greys after them, light to dark. They had come by rank, jumbled.
  var ord = out.map(function (mi, k) {
      return k;
    }),
    hs = [];
  out.forEach(function (mi) {
    if (LCH[mi][1] >= GREY_C) hs.push(LCH[mi][2]);
  });
  hs.sort(function (a, b) {
    return a - b;
  });
  var h0 = 0;
  if (hs.length) {
    var gap = 360 - hs[hs.length - 1] + hs[0];
    h0 = hs[0];
    for (i = 1; i < hs.length; i++)
      if (hs[i] - hs[i - 1] > gap) {
        gap = hs[i] - hs[i - 1];
        h0 = hs[i];
      }
  }
  function okey(mi) {
    var L = LCH[mi];
    return L[1] >= GREY_C ? (L[2] - h0 + 360) % 360 : 1000 + (100 - L[0]);
  }
  ord.sort(function (a, b) {
    return okey(out[a]) - okey(out[b]) || LCH[out[b]][0] - LCH[out[a]][0];
  });
  return {
    markers: ord.map(function (k) {
      return out[k];
    }),
    labs: ord.map(function (k) {
      return outLabs[k];
    }),
    few: few,
  };
}
// (v308) From photo: the darks' share above which they count as part of the picture (not pushed down), and the share
// from which they are its ground (pushed down, by PHOTO_DARK_K rather than 0.15); the chroma above which a photo
// colour's hue counts, and how far apart hues are kept in the first pass; the furthest a marker may be from the photo
// colour it stands for (CIEDE2000)
const PHOTO_DARK = 0.15,
  PHOTO_GROUND = 0.5,
  PHOTO_DARK_K = 0.4,
  PHOTO_HUE_C = 15,
  PHOTO_HUE_APART = 25,
  PHOTO_FAR = 18;
function applyPhotoPalette() {
  if (!_photoImg) return;
  var nn = document.getElementById('photoNote');
  var _res = extractPhotoPalette(_photoImg, state.palSize, _photoFix);
  if (_res === null) {
    errCard(document.getElementById('photoPick'), 'Couldn\u2019t read that image. Try another photo.');
    return;
  }
  var pal = _res.markers;
  _photoLabs = _res.labs;
  _photoTried = {};
  if (!pal.length) {
    errCard(
      document.getElementById('photoPick'),
      'No usable colours in that image' +
        (_res.none ? '' : ' among the markers in play') +
        '. Try another photo' +
        (_res.none ? '' : ' or loosen the filters') +
        '.',
    );
    return;
  }
  _photoLabsOf.set(pal, _res.labs);
  palPush(pal, 20);
  state.locked = [];
  save();
  showPalette(pal, true);
  if (nn)
    nn.textContent =
      pal.length < state.palSize
        ? _res.few
          ? // (v308: it stops when the markers left are far from the photo's colours, rather than make some up)
            'This photo has about ' + pal.length + ' colours'
          : state.palSize +
            ' colours pulled \u2192 ' +
            pal.length +
            (pal.length === 1 ? ' distinct marker' : ' distinct markers') +
            (state.owned.size ? ' you own' : '')
        : pal.length + ' markers matched from your photo';
  chrome();
}
// A generated palette: an array of n marker indexes (COLORS), or null when fewer than n markers are in play.
// opts (all optional):
//   baseHue  the scheme's base hue, as an L*C*h° angle (else a random marker's)
//   seedIdx  Monochrome's base marker (else the first locked one, else a random clear colour)
//   locked   { position: marker index } kept where they are; the other colours are chosen to differ from them
//   mood     one of MOOD_KEYS (default 'neutral', Any): the look the colours aim for (colour.js)
//   report   an object, filled in with how the palette came out:
//            { need, minDE, relaxed, hueWidened, moodWidened, grey }: the scheme's smallest difference and the
//            palette's (pairs of locked colours left out; null with none), relaxed when minDE < need; hueWidened when
//            a colour is further from its scheme hue than the first step allows (Analogous: spread past 120°);
//            moodWidened, how many colours come from outside the mood; grey, when a colour scheme had to use a
//            near-grey. All false/0 for a clean palette.
function genPalette(n, harmony, opts) {
  opts = opts || {};
  n = n || state.palSize;
  harmony = harmony || state.harmony;
  if (harmony === 'rainbow') return genRainbow(n, opts);
  const mood = MOODS[opts.mood] && MOOD_KEYS.includes(opts.mood) ? opts.mood : 'neutral',
    locked = opts.locked || {},
    // (v308: opts.exclude, a Set of marker indexes kept out: the guide's Include row's groups that are off)
    ctx = genCtx(harmony, mood, opts.exclude || null);
  let bi = null;
  if (harmony === 'mono') {
    bi = opts.seedIdx != null ? opts.seedIdx : null;
    for (let p = 0; p < n && bi == null; p++) if (locked[p] != null) bi = locked[p];
    if (bi == null) bi = genBase(ctx, n);
    if (bi == null) return null;
    ctx.fam = COLORS[bi].fam;
    ctx.greyFam = LCH[bi][1] < GREY_C || famGreyish(bi);
    ctx.bh = LCH[bi][2];
  } else if (opts.baseHue != null) ctx.bh = opts.baseHue;
  else {
    bi = genBase(ctx, n);
    if (bi == null) return null;
    ctx.bh = LCH[bi][2];
  }
  const plan = genSlots(ctx, n);
  // (v296) the chosen marker, locked first, takes the target that fits it (Analogous: the middle of the fan; Monochrome:
  // the step nearest its lightness), not the first one (the fan's end, the lightest step): the other colours were
  // lopsided round it, two thirds of them on one side
  const si = opts.seedIdx;
  if (si != null && locked[0] === si && n > 1 && (harmony === 'analogous' || harmony === 'mono')) {
    let best = 0,
      bd = Infinity;
    plan.slots.forEach(function (sl, p) {
      const dL = Math.abs(sl.L - LCH[si][0]),
        d = harmony === 'mono' ? dL : hueDist(sl.h, LCH[si][2]) + dL / 10;
      if (d < bd) {
        bd = d;
        best = p;
      }
    });
    if (best) {
      const t = plan.slots[0];
      plan.slots[0] = plan.slots[best];
      plan.slots[best] = t;
    }
  }
  let res = null;
  for (const lv of ctx.levels) {
    for (let t = 0; t < 3 && !res; t++) res = genTry(ctx, plan, locked, lv);
    if (res) break;
  }
  if (!res) return null;
  const pal = res.out;
  // Each scheme hue's colours lightest first (Analogous: along its hues), as their targets were, whichever colour got
  // which marker: the palette reads as a ramp even where the collection skipped a step. Locked ones stay put.
  for (const g of plan.groups) {
    const free = g.filter((p) => locked[p] == null),
      picks = free.map((p) => pal[p]);
    picks.sort((a, b) =>
      harmony === 'analogous' ? hueOff(LCH[a][2], ctx.bh) - hueOff(LCH[b][2], ctx.bh) : LCH[b][0] - LCH[a][0],
    );
    free.forEach((p, q) => (pal[p] = picks[q]));
  }
  if (opts.report) {
    const fixed = new Set(),
      need = genNeed(harmony);
    for (let p = 0; p < n; p++) if (locked[p] != null) fixed.add(locked[p]);
    const minDE = palMinDE(pal, fixed),
      free = pal.filter((i) => !fixed.has(i)),
      chroma = free.filter((i) => LCH[i][1] >= GREY_C);
    let hueWidened;
    if (harmony === 'analogous') {
      const offs = chroma.map((i) => hueOff(LCH[i][2], ctx.bh));
      hueWidened = offs.length > 1 && Math.max(...offs) - Math.min(...offs) > ctx.levels[0][1];
    } else
      hueWidened = pal.some(
        (i, p) =>
          !fixed.has(i) &&
          LCH[i][1] >= GREY_C &&
          hueDist(LCH[i][2], harmony === 'mono' ? ctx.bh : plan.slots[p].h) > ctx.levels[0][1],
      );
    Object.assign(opts.report, {
      need,
      minDE,
      relaxed: minDE != null && minDE < need,
      hueWidened,
      moodWidened: res.widened,
      grey: !ctx.greyFam && chroma.length < free.length,
    });
  }
  return pal;
}
/* (v306) Rainbow: n colours round the wheel (v308: lightness follows hue, from red), picked from the markers in play (inPool:
   filters and a selection count) as the guide's Gradient picks them (SF.rainbowPick), so a saved Rainbow laid by the
   Gradient at the same count gives the same markers. Generate rolls another from a new seed (opts.reroll); a scheme,
   size or filter change makes the Gradient's own. Locked colours stay, and the free ones are picked round them. At
   most as many colours as there are clear markers in play; null when fewer than its smallest size. (v308) Shown in
   rainbow order from red (rainbowOrder), locked colours with the rest. */
function genRainbow(n, opts) {
  if (!window.SF || !SF.rainbowPick) return null;
  const pool = [];
  for (let i = 0; i < COLORS.length; i++)
    if (inPool(i) && !(opts.exclude && opts.exclude.has(i))) pool.push(i);
  const mood = MOODS[opts.mood] && MOOD_KEYS.includes(opts.mood) ? opts.mood : 'neutral',
    pal = SF.rainbowPick(n, mood, pool, {
      locked: opts.locked || {},
      seed: opts.reroll ? Math.random() || 0.5 : 0,
    });
  if (!pal || pal.length < Math.min(n, HARM_RANGE.rainbow[0])) return null;
  rainbowOrder(pal);
  if (opts.report) {
    const fixed = new Set(Object.values(opts.locked || {})),
      minDE = palMinDE(pal, fixed);
    Object.assign(opts.report, {
      need: genNeed('rainbow'),
      minDE,
      relaxed: minDE != null && minDE < genNeed('rainbow'),
      hueWidened: !palOnScheme(pal, 'rainbow', fixed),
      moodWidened: 0,
      grey: pal.some((i) => !fixed.has(i) && LCH[i][1] < GREY_C),
    });
  }
  return pal;
}
// (v308) A Rainbow in rainbow order from its red: red, orange, yellow, green, blue, violet, then pinks (round the wheel
// by L*C*h° hue, from the colour nearest RAINBOW_RED). Colours you locked take their place in that order too: kept in
// the places they had under another scheme, they scrambled it, and it had started wherever the hue gap fell (one roll
// at yellow-green). Near-greys, if any, go last. In place; returns pal.
const RAINBOW_RED = 25;
function rainbowOrder(pal) {
  const clear = pal.filter((i) => LCH[i][1] >= GREY_C),
    grey = pal.filter((i) => LCH[i][1] < GREY_C);
  if (!clear.length) return pal;
  let h0 = LCH[clear[0]][2];
  for (const i of clear) if (hueDist(LCH[i][2], RAINBOW_RED) < hueDist(h0, RAINBOW_RED)) h0 = LCH[i][2];
  const at = (i) => (LCH[i][2] - h0 + 360) % 360;
  clear.sort((a, b) => at(a) - at(b));
  clear.concat(grey).forEach((i, k) => (pal[k] = i));
  return pal;
}
// Re-rolling one colour of a generated palette (tapping its band): another marker near its hue and lightness, by the
// scheme's rules against the palette's other colours (clearly different from them, no greys in a colour scheme,
// Analogous within its spread, Monochrome near the palette's hue), and visibly different from the one it replaces
// where it can be. Returns a marker index, or -1 when no other marker fits the scheme (v304).
function rerollPick(pal, k, harmony) {
  harmony = harmony || state.harmony;
  const cur = pal[k],
    others = pal.filter((_, p) => p !== k),
    ctx = genCtx(harmony, 'neutral', new Set(pal));
  if (!ctx.pool.length) return -1;
  ctx.bh = LCH[cur][2];
  if (harmony === 'mono') {
    // the palette's hue: the average of its clear colours' hues (else this one's)
    let x = 0,
      y = 0;
    for (const i of pal)
      if (LCH[i][1] >= GREY_C) {
        x += Math.cos((LCH[i][2] * Math.PI) / 180);
        y += Math.sin((LCH[i][2] * Math.PI) / 180);
      }
    if (x || y) ctx.bh = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
    ctx.fam = COLORS[cur].fam;
    ctx.greyFam = LCH[cur][1] < GREY_C || famGreyish(cur);
  }
  const slot = { h: LCH[cur][2], L: LCH[cur][0] };
  // (v306) Rainbow: aimed at the middle of the gap round the wheel this colour fills (between its neighbours in hue
  // among the other clear colours), at their middle lightness
  if (harmony === 'rainbow') {
    const hs = others
        .filter((i) => LCH[i][1] >= GREY_C)
        .map((i) => LCH[i][2])
        .sort((a, b) => a - b),
      Ls = others.map((i) => LCH[i][0]).sort((a, b) => a - b);
    if (hs.length >= 2) {
      const h = LCH[cur][2];
      let lo = hs[hs.length - 1] - 360,
        hi = hs[0];
      for (let q = 0; q < hs.length; q++) {
        const a = hs[q],
          b = q + 1 < hs.length ? hs[q + 1] : hs[0] + 360;
        if ((h >= a && h < b) || (h + 360 >= a && h + 360 < b)) {
          lo = a;
          hi = b;
          break;
        }
      }
      slot.h = ((((lo + hi) / 2) % 360) + 360) % 360;
    }
    if (Ls.length) slot.L = Ls[Ls.length >> 1];
  }
  // (Analogous: its spread measured round the other colours' own hues, not this one's, which for a near-grey means
  // nothing; such a colour is aimed at their middle, v304)
  if (harmony === 'analogous') {
    let x = 0,
      y = 0;
    for (const i of others)
      if (LCH[i][1] >= GREY_C) {
        x += Math.cos((LCH[i][2] * Math.PI) / 180);
        y += Math.sin((LCH[i][2] * Math.PI) / 180);
      }
    if (x || y) {
      ctx.bh = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
      if (LCH[cur][1] < GREY_C) slot.h = ctx.bh;
    }
  }
  // (a scheme of set hues: aimed at the scheme hue nearest this colour, around the base the other colours fit best —
  // the one leaving the most room either side, half a degree at a time — not at this colour's own hue, so re-rolling
  // one colour again and again doesn't walk it away from the scheme, v298; v299: the best fit, not one of the other
  // colours' own hues, and leaving out colours you locked, as the scheme's note does)
  const A = ANCH[harmony];
  if (A && harmony !== 'mono') {
    const clear = (i) => LCH[i][1] >= GREY_C,
      lk = new Set(state.locked || []);
    let hs = others.filter((i) => clear(i) && !lk.has(i)).map((i) => LCH[i][2]);
    if (!hs.length) hs = others.filter(clear).map((i) => LCH[i][2]);
    if (hs.length) {
      let bb = 0,
        be = Infinity;
      for (let b = 0; b < 360; b += 0.5) {
        let e = 0;
        for (const h of hs) {
          let d = Infinity;
          for (const a of A) d = Math.min(d, hueDist(h, b + a));
          if (d > e) e = d;
          if (e >= be) break;
        }
        if (e < be) {
          be = e;
          bb = b;
        }
      }
      let to = slot.h,
        d = Infinity;
      for (const a of A) {
        const t = (bb + a) % 360,
          dd = hueDist(slot.h, t);
        if (dd < d) {
          d = dd;
          to = t;
        }
      }
      slot.h = to;
    }
  }
  // (v304) only the steps that keep to the scheme's hues, closeness given up a step at a time: on a small collection
  // a tap turned a Monochrome's yellow green once the yellows ran out. A grey's own band may take another grey.
  const win = ctx.levels[0][1],
    steps = ctx.levels.filter((lv) => lv[1] <= win && !lv[2]);
  for (const c of [6, 4, 2, 0]) if (c < steps[steps.length - 1][0]) steps.push([c, win]);
  if (LCH[cur][1] < GREY_C) steps.push([0, win, 1]);
  // (and a palette on its scheme stays on it, as its note judges it: one colour at a time can walk a Monochrome's
  // hues apart even within its window)
  const fixed = new Set(state.locked || []),
    wasOn = palOnScheme(pal, harmony, fixed),
    np = pal.slice();
  for (const lv of steps) {
    const st = genState(ctx, lv, others);
    st.avoid = cur;
    for (let t = 0; t < 24; t++) {
      const j = genPick(ctx, slot, lv, st);
      if (j < 0) break;
      np[k] = ctx.pool[j];
      if (!wasOn || palOnScheme(np, harmony, fixed)) return ctx.pool[j];
      st.used[j] = 1;
    }
  }
  return -1;
}
// whether a palette's clear colours (leaving out fixed ones) sit where its scheme puts them, around some base hue:
// Analogous within its spread, Monochrome around one hue, the others each near one of their scheme hues
const RAINBOW_GAP = 130;
function palOnScheme(pal, harmony, fixed) {
  const hs = pal.filter((i) => !(fixed && fixed.has(i)) && LCH[i][1] >= GREY_C).map((i) => LCH[i][2]);
  if (hs.length < 2) return true;
  // (v298: the bases tried are exactly the ones that can matter — where a colour sits at the edge of a hue's window —
  // so no palette made on the scheme is called off it, and none just off it passes; before, whole degrees and half a
  // degree of slack)
  // (v306) Rainbow: round the whole wheel, as the Gradient's loop is (no gap between its hues as wide as
  // GRAD_LOOP_GAP's 100°); colours you locked count, as they take their place on it
  if (harmony === 'rainbow') {
    const all = pal
      .filter((i) => LCH[i][1] >= GREY_C)
      .map((i) => LCH[i][2])
      .sort((a, b) => a - b);
    if (all.length < 3) return false;
    let gap = 360 - all[all.length - 1] + all[0];
    for (let q = 1; q < all.length; q++) gap = Math.max(gap, all[q] - all[q - 1]);
    // (v308: the Rainbow's colours go through red, orange, yellow, green, blue and violet, so at 6 there's no cyan
    // between green and blue: up to RAINBOW_GAP)
    return gap < RAINBOW_GAP;
  }
  const win = GEN_LEVELS[harmony === 'mono' || harmony === 'analogous' ? harmony : 'anchors'][0][1],
    A = harmony === 'analogous' ? [0] : ANCH[harmony] || [0],
    E = 1e-6,
    fits =
      harmony === 'analogous'
        ? // Analogous: every hue within its spread, going round from the base
          (b) => hs.every((h) => (((h - b) % 360) + 360) % 360 <= win + E)
        : (b) => hs.every((h) => A.some((a) => hueDist(h, b + a) <= win + E)) && covers(b),
    // (v299) a scheme of set hues uses as many of them as it has colours for: four blues aren't Complementary, though
    // each sits on one of its hues. Colours you locked count here, on the hue they take.
    all = pal.filter((i) => LCH[i][1] >= GREY_C).map((i) => LCH[i][2]),
    need = Math.min(A.length, all.length),
    covers = (b) => A.filter((a) => all.some((h) => hueDist(h, b + a) <= win + E)).length >= need;
  for (const h of harmony === 'analogous' ? hs : all)
    for (const a of A)
      for (const b of harmony === 'analogous' ? [h, h - win] : [h - a - win, h - a + win, h - a])
        if (fits(b)) return true;
  return false;
}
// the line under the Colours row when a generated palette isn't clean: two colours closer than its scheme wants, or
// colours away from the scheme's hues (the markers in play don't have enough that fit). Colours you locked (and the
// seed) don't count: they're your choice.
function closeNote() {
  const el = document.getElementById('palClose');
  if (!el) return;
  let t = '';
  if (state.mode === 'palette' && state.harmony !== 'custom' && state.harmony !== 'photo') {
    const pal = state.palettes[state.palettes.length - 1];
    if (pal && pal.length > 1) {
      const fixed = new Set(state.locked),
        si = keyIdx(state.seed);
      if (si != null && pal[0] === si) fixed.add(si);
      const d = palMinDE(pal, fixed);
      // (v306) a Rainbow stops at the clear markers in play
      if (state.harmony === 'rainbow' && pal.length < state.palSize)
        t =
          'Your markers in play have ' +
          pal.length +
          ' clear colours for a rainbow, not ' +
          state.palSize +
          '.';
      else if (d != null && d < genNeed(state.harmony))
        t =
          'Two colours are close: your markers don\u2019t have ' +
          pal.length +
          ' clearly different colours for this scheme.';
      else if (!palOnScheme(pal, state.harmony, fixed))
        t =
          'Some colours stray from the scheme: your markers don\u2019t have ' + pal.length + ' that fit it.';
    }
  }
  el.textContent = t;
  el.style.display = t ? '' : 'none';
}
function buildBands(n) {
  bands.innerHTML = '';
  for (let k = 0; k < n; k++) {
    // (v288: the band's tap and its lock are two sibling buttons, not a button inside a button; the band is their
    // positioned frame, .bhit filling it under the lock)
    const b = document.createElement('div');
    b.className = 'band';
    b.innerHTML =
      '<button type="button" class="bhit"></button><span class="bt" aria-hidden="true"></span><button type="button" class="blk" aria-label="Lock this colour">' +
      LOCKSVG +
      '</button><span class="bcode" aria-hidden="true"></span>';
    bands.appendChild(b);
  }
}
// a band's own button says what a tap does: another like it, the next nearest (Photo), or nothing while locked (v289)
function bandLabel(b, idx) {
  const c = COLORS[idx],
    h = b && b.querySelector('.bhit');
  if (!c || !h) return;
  h.setAttribute(
    'aria-label',
    c.brand +
      ' ' +
      c.code +
      ' ' +
      c.name +
      (state.locked.includes(idx)
        ? ', locked'
        : state.harmony === 'photo'
          ? ', tap for the next nearest'
          : ', tap for another like it'),
  );
}
function showPalette(pal, animate) {
  phint.style.display = 'none';
  buildBands(pal.length);
  bands.classList.toggle('grid', pal.length > 8);
  var _pel = document.getElementById('palette');
  if (_pel) _pel.classList.toggle('gridmode', pal.length > 8);
  const bs = [...bands.querySelectorAll('.band')],
    mixed = brandsMixedIn(pal);
  bs.forEach((b, k) => {
    const c = COLORS[pal[k]];
    b.style.background = c.hex;
    var _bt = b.querySelector('.bt');
    if (_bt) {
      _bt.textContent = mixed ? bTag(c.brand) : '';
      _bt.style.display = mixed ? '' : 'none';
    }
    b.title =
      state.harmony === 'photo'
        ? 'Tap for the next-nearest owned marker'
        : 'Tap for another like it · lock to keep';
    b.classList.toggle('locked', state.locked.includes(pal[k]));
    {
      const _lk = b.querySelector('.blk');
      if (_lk) {
        _lk.setAttribute('aria-pressed', state.locked.includes(pal[k]) ? 'true' : 'false');
        // (which colour it locks, v287)
        _lk.setAttribute('aria-label', 'Lock ' + c.code);
      }
    }
    bandLabel(b, pal[k]);
    const cd = b.querySelector('.bcode');
    cd.textContent = c.code;
    cd.style.color = txt(c.hex);
    if (animate && !reduce) {
      b.style.animationDelay = k * 55 + 'ms';
      b.classList.add('bin');
    }
  });
  if (animate) pulse();
  const base = COLORS[pal[0]];
  palReadout(shownPaletteName(pal), palSub(pal), pal);
  if (animate) retrigger(readout, 'pop');
  setAmb(base.hex);
  closeNote();
}
// the line under a palette's name: its scheme, and the marker it was built from (a photo's is just "From photo")
function palSub(pal) {
  if (state.harmony === 'photo') return HARM.photo;
  // (v296) "… base" only for the marker you chose to build from (Start from): otherwise the first colour is just the
  // lightest of the scheme's first hue, and the base the palette was built round isn't in it
  const si = keyIdx(state.seed);
  return si != null && pal[0] === si
    ? HARM[state.harmony] + ' \u00b7 ' + COLORS[si].brand + ' ' + COLORS[si].name + ' base'
    : HARM[state.harmony];
}
// a palette's name, its line, and its codes under them (each code kept whole; brand letters as on the bands, when
// the palette or your collection mixes brands)
function palReadout(name, sub, idxs) {
  const mix = brandsMixedIn(idxs);
  readout.classList.add('rpal');
  readout.innerHTML =
    '<div><div class="name">' +
    esc(name) +
    '</div><div class="fam">' +
    esc(sub) +
    '</div></div><div class="hex">' +
    idxs
      .map(
        (i) =>
          '<span>' +
          (mix
            ? '<b class="rbt" aria-hidden="true">' +
              bTag(COLORS[i].brand) +
              '</b>\u00a0<span class="sfsr">' +
              esc(COLORS[i].brand) +
              ' </span>'
            : '') +
          esc(COLORS[i].code) +
          '</span>',
      )
      .join(' ') +
    '</div>';
}
function clearPalette() {
  phint.style.display = '';
  bands.innerHTML = '';
  readout.innerHTML = '';
  setAmb(null);
  var _pel = document.getElementById('palette');
  if (_pel) _pel.classList.remove('gridmode');
}
function currentPaletteIdxs() {
  if (state.mode !== 'palette') return [];
  if (state.harmony === 'custom') return state.customPal.filter((x) => x != null);
  if (state.harmony === 'photo' && !_photoImg) return [];
  // (v308: none in play, the card is empty: nothing to save or use)
  if (palNone()) return [];
  const p = state.palettes[state.palettes.length - 1] || palPreview();
  return p ? p.slice() : [];
}
