function rgb(hex) {
  let h = hex.slice(1);
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function rgba(hex, a) {
  const [r, g, b] = rgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}
// Text on a coloured background: dark or white, whichever contrasts more (WCAG contrast ratio, from each colour's
// relative luminance in linear light). The old brightness rule (weighted RGB over 142) chose the less readable one
// for 75 of the 721 markers, e.g. white on blue B111 (2.9:1) where dark text reads at 6.4:1.
function relLum(hex) {
  const [r, g, b] = rgb(hex),
    f = function (v) {
      v /= 255;
      return v > 0.04045 ? Math.pow((v + 0.055) / 1.055, 2.4) : v / 12.92;
    };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
let _darkTxtLum = null; // relative luminance of #141216, the dark text used across the app (worked out once)
function darkText(hex) {
  if (_darkTxtLum == null) _darkTxtLum = relLum('#141216');
  const y = relLum(hex);
  return (y + 0.05) / (_darkTxtLum + 0.05) >= 1.05 / (y + 0.05);
}
function txt(hex) {
  return darkText(hex) ? '#141216' : '#fff';
}
function hsl(hex) {
  const [R, G, B] = rgb(hex),
    r = R / 255,
    g = G / 255,
    b = B / 255,
    mx = Math.max(r, g, b),
    mn = Math.min(r, g, b),
    l = (mx + mn) / 2;
  let s = 0,
    hu = 0;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    hu = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    hu *= 60;
  }
  return { h: hu, s, l, c: mx - mn };
}
const HS = COLORS.map((c) => hsl(c.hex));
if (typeof globalThis !== 'undefined' && globalThis.__MS_TEST) {
  globalThis.__match = { COLORS: COLORS, HS: HS };
}
function hexToLab(hex) {
  const s = hex.replace('#', '');
  const r = parseInt(s.substr(0, 2), 16) / 255,
    g = parseInt(s.substr(2, 2), 16) / 255,
    b = parseInt(s.substr(4, 2), 16) / 255;
  const f = (v) => (v > 0.04045 ? Math.pow((v + 0.055) / 1.055, 2.4) : v / 12.92);
  return linLab(f(r), f(g), f(b));
}
// L*a*b* from linear-light RGB (0-1 each)
function linLab(r, g, b) {
  let x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047,
    y = r * 0.2126 + g * 0.7152 + b * 0.0722,
    z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const t = (v) => (v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116);
  x = t(x);
  y = t(y);
  z = t(z);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
// the colour a screen can show (sRGB) nearest to an L*a*b* colour that may be outside what it can, by keeping each
// channel of its linear RGB between 0 and 1 (the reverse of linLab, then linLab); one it can show comes back as it was
function labClip(lab) {
  const u = function (f) {
      const c = f * f * f;
      return c > 0.008856 ? c : (f - 16 / 116) / 7.787;
    },
    fy = (lab[0] + 16) / 116,
    x = u(fy + lab[1] / 500) * 0.95047,
    y = u(fy),
    z = u(fy - lab[2] / 200) * 1.08883,
    k = function (v) {
      return Math.max(0, Math.min(1, v));
    },
    r = 3.2406254773 * x - 1.5372079722 * y - 0.4986285987 * z,
    g = -0.9689307147 * x + 1.8757560609 * y + 0.0415175238 * z,
    b = 0.0557101204 * x - 0.2040210506 * y + 1.0569959423 * z,
    // (a hair outside is rounding: a colour clipped once is left alone)
    e = 1e-6;
  if (r >= -e && r <= 1 + e && g >= -e && g <= 1 + e && b >= -e && b <= 1 + e) return lab;
  return linLab(k(r), k(g), k(b));
}
const LAB = COLORS.map((c) => hexToLab(c.hex));

/* ---- colour as the eye sees it (shared by the palette generator and the guide's gradient) ---- */
// L*C*h° from L*a*b*: lightness 0-100, chroma (how strong; greys are near 0), hue angle 0-360
function lchOf(lab) {
  let h = (Math.atan2(lab[2], lab[1]) * 180) / Math.PI;
  if (h < 0) h += 360;
  return [lab[0], Math.hypot(lab[1], lab[2]), h];
}
const LCH = LAB.map(lchOf);
// below this chroma a marker reads as a grey (or near-grey): no hue a colour scheme or gradient can place it by
const GREY_C = 12;
// CIEDE2000 colour difference: about 2 is just noticeable, under 5 reads as the same colour on paper, over 10 is
// clearly different. With `out` (an array), its lightness part and its colour part (chroma and hue, with their
// cross term) are also written to out[0] and out[1], squared: de2000 is the square root of their sum (de2000Split).
function de2000(a, b, out) {
  const rad = Math.PI / 180,
    L1 = a[0],
    a1 = a[1],
    b1 = a[2],
    L2 = b[0],
    a2 = b[1],
    b2 = b[2];
  const C1 = Math.hypot(a1, b1),
    C2 = Math.hypot(a2, b2),
    Cm7 = Math.pow((C1 + C2) / 2, 7),
    G = 0.5 * (1 - Math.sqrt(Cm7 / (Cm7 + 6103515625)));
  const ap1 = (1 + G) * a1,
    ap2 = (1 + G) * a2,
    Cp1 = Math.hypot(ap1, b1),
    Cp2 = Math.hypot(ap2, b2);
  let hp1 = Math.atan2(b1, ap1) / rad,
    hp2 = Math.atan2(b2, ap2) / rad;
  if (hp1 < 0) hp1 += 360;
  if (hp2 < 0) hp2 += 360;
  const dL = L2 - L1,
    dC = Cp2 - Cp1;
  let dh = 0;
  if (Cp1 * Cp2) {
    dh = hp2 - hp1;
    if (dh > 180) dh -= 360;
    else if (dh < -180) dh += 360;
  }
  const dH = 2 * Math.sqrt(Cp1 * Cp2) * Math.sin((dh / 2) * rad),
    Lm = (L1 + L2) / 2,
    Cpm = (Cp1 + Cp2) / 2;
  let hm = hp1 + hp2;
  if (Cp1 * Cp2) {
    if (Math.abs(hp1 - hp2) > 180) hm += hm < 360 ? 360 : -360;
    hm /= 2;
  }
  const T =
      1 -
      0.17 * Math.cos((hm - 30) * rad) +
      0.24 * Math.cos(2 * hm * rad) +
      0.32 * Math.cos((3 * hm + 6) * rad) -
      0.2 * Math.cos((4 * hm - 63) * rad),
    dth = 30 * Math.exp(-Math.pow((hm - 275) / 25, 2)),
    Cpm7 = Math.pow(Cpm, 7),
    RC = 2 * Math.sqrt(Cpm7 / (Cpm7 + 6103515625)),
    SL = 1 + (0.015 * (Lm - 50) * (Lm - 50)) / Math.sqrt(20 + (Lm - 50) * (Lm - 50)),
    SC = 1 + 0.045 * Cpm,
    SH = 1 + 0.015 * Cpm * T,
    RT = -Math.sin(2 * dth * rad) * RC;
  if (out) {
    out[0] = (dL / SL) * (dL / SL);
    out[1] = (dC / SC) * (dC / SC) + (dH / SH) * (dH / SH) + RT * (dC / SC) * (dH / SH);
  }
  return Math.sqrt(
    (dL / SL) * (dL / SL) + (dC / SC) * (dC / SC) + (dH / SH) * (dH / SH) + RT * (dC / SC) * (dH / SH),
  );
}
// CIEDE2000 split in two, squared: [how different in lightness, how different in colour (chroma and hue)]. The
// colour part is never below 0 (the cross term is at most the other two), and the two add up to de2000 squared.
function de2000Split(a, b) {
  const out = [0, 0];
  de2000(a, b, out);
  return out;
}
// The six looks (the guide's Colours tab; "emphasis" in saved guides, where Vivid and Muted were the old Bright and
// Soft). Each is a region of lightness L (0-100) and chroma C: markers inside fit it; `off` says how far outside a
// marker is, for widening to the nearest when a look has too few. Measured on a 322-marker Ohuhu collection: Pastel
// about 89 markers, Deep 44, Bright 55, Soft 114, Earthy 28 (all clearly coloured).
const MOODS = {
  neutral: { label: 'Any', L: [0, 101], C: [GREY_C, 999] },
  vivid: { label: 'Bright', L: [0, 101], C: [45, 999] },
  muted: { label: 'Soft', L: [0, 101], C: [GREY_C, 30] },
  pastel: { label: 'Pastel', L: [78, 101], C: [10, 999] },
  deep: { label: 'Deep', L: [0, 52], C: [20, 999] },
  earthy: { label: 'Earthy', L: [0, 62], C: [GREY_C, 32] },
};
const MOOD_KEYS = ['neutral', 'vivid', 'muted', 'pastel', 'deep', 'earthy'];
// how far a colour (as L*C*h°) is outside a look's region: 0 inside; lightness and chroma steps weigh about the same
function moodOff(mood, lch) {
  const m = MOODS[mood] || MOODS.neutral,
    L = lch[0],
    C = lch[1],
    dl = L < m.L[0] ? m.L[0] - L : L > m.L[1] ? L - m.L[1] : 0,
    dc = C < m.C[0] ? m.C[0] - C : C > m.C[1] ? C - m.C[1] : 0;
  return Math.hypot(dl, dc);
}
// the items of `list` that fit a look, widened to the nearest ones outside it until there are `need` (lchFn gives an
// item's L*C*h°). Returns { items, widened } — widened is how many had to come from outside the look.
function moodPick(list, mood, need, lchFn) {
  if (!mood || mood === 'neutral') return { items: list.slice(), widened: 0 };
  const scored = list.map(function (x) {
    return [moodOff(mood, lchFn(x)), x];
  });
  const inside = scored.filter(function (s) {
    return s[0] === 0;
  });
  if (inside.length >= need) return { items: inside.map((s) => s[1]), widened: 0 };
  const out = scored
    .filter(function (s) {
      return s[0] > 0;
    })
    .sort(function (a, b) {
      return a[0] - b[0];
    })
    .slice(0, need - inside.length);
  return { items: inside.concat(out).map((s) => s[1]), widened: out.length };
}
/* (v308) Unowned's orders follow Brands I'd buy, as Match does. Automatic: your brands (those of the markers you own
   that lay down colour; every brand when you have none) come first, and a marker of another brand only after them,
   when it brings a colour none of your brands has (no marker of theirs within BUY_OTHER_DE): an Ohuhu-only collection
   was told to buy 17 Copic markers before any Ohuhu one. Brands ticked: only those. Fluorescents and the Colorless
   Blender aren't gaps to fill or families to finish (as Ramp gaps already left them out), unless the filters leave
   nothing else. */
const BUY_OTHER_DE = 8;
function buyPref() {
  if (state.buyBrands) return { pref: new Set(state.buyBrands), strict: true };
  const s = new Set();
  for (let i = 0; i < COLORS.length; i++) if (!NOINK.has(i) && isOwned(i)) s.add(COLORS[i].brand);
  return { pref: s.size ? s : new Set(COLORS.map((c) => c.brand)), strict: false };
}
// how far each marker is from the nearest marker of these brands (CIEDE2000), kept for the brands asked last
let _buyFar = null;
function buyFar(pref) {
  const key = [...pref].sort().join('|');
  if (_buyFar && _buyFar.key === key) return _buyFar.d;
  const ref = [];
  for (let i = 0; i < COLORS.length; i++) if (!NOINK.has(i) && pref.has(COLORS[i].brand)) ref.push(i);
  const d = new Float32Array(COLORS.length);
  for (let i = 0; i < COLORS.length; i++) {
    if (pref.has(COLORS[i].brand) || NOINK.has(i)) continue;
    let mn = Infinity;
    for (const p of ref) {
      const x = de2000(LAB[i], LAB[p]);
      if (x < mn) mn = x;
    }
    d[i] = mn;
  }
  _buyFar = { key: key, d: d };
  return d;
}
// candidates as { mine: your brands' (or those ticked), other: another brand's that bring a colour yours don't have }
function buySplit(cands) {
  const bp = buyPref(),
    mine = [],
    other = [];
  cands.forEach((i) => (bp.pref.has(COLORS[i].brand) ? mine : other).push(i));
  if (bp.strict || !other.length) return { mine: mine, other: [] };
  const far = buyFar(bp.pref);
  return { mine: mine, other: other.filter((i) => far[i] >= BUY_OTHER_DE) };
}
// not a gap to fill: the Colorless Blender, and fluorescents (unless the filters leave only those)
function gapCands(cands) {
  const c = cands.filter((i) => !NOINK.has(i));
  const nf = c.filter((i) => COLORS[i].fam !== 'Fluorescent');
  return nf.length ? nf : c;
}
function completeGroups(only) {
  const ok = only ? new Set(gapCands(only)) : null,
    bp = buyPref(),
    noFl = !only || ok.size === 0 || [...ok].some((i) => COLORS[i].fam !== 'Fluorescent'),
    map = {};
  for (let i = 0; i < COLORS.length; i++) {
    if (!passes(i) || NOINK.has(i) || (noFl && COLORS[i].fam === 'Fluorescent')) continue;
    // (a family is counted in your brands: one of another brand counts only when you own it)
    if (!isOwned(i) && !bp.pref.has(COLORS[i].brand)) continue;
    const f = COLORS[i].fam;
    map[f] = map[f] || { owned: 0, total: 0, un: [] };
    map[f].total++;
    if (isOwned(i)) map[f].owned++;
    else if (!ok || ok.has(i)) map[f].un.push(i);
  }
  const groups = Object.keys(map)
    .map((f) => ({ fam: f, owned: map[f].owned, total: map[f].total, un: map[f].un }))
    .filter((g) => g.un.length > 0);
  groups.sort((a, b) => {
    const ra = a.owned / a.total,
      rb = b.owned / b.total;
    if (rb !== ra) return rb - ra;
    if (b.owned !== a.owned) return b.owned - a.owned;
    return b.total - a.total;
  });
  groups.forEach((g) => g.un.sort((x, y) => HS[x].l - HS[y].l));
  return groups;
}
// (v305) a ramp is one hue getting lighter or darker: fluorescents and the blacks aren't shading ramps, and within a
// family only markers of about the same hue (30°, or both near-grey) count as the gap's ends (a pink between a red
// and a violet isn't a step between light and dark)
const RAMP_SKIP = new Set(['Fluorescent', 'Neutral / Black']);
function rampAlong(a, b) {
  const ga = LCH[a][1] < GREY_C,
    gb = LCH[b][1] < GREY_C;
  return ga || gb ? ga && gb : hueDist(LCH[a][2], LCH[b][2]) <= 30;
}
function rampRank(cands) {
  cands = cands.filter((i) => !RAMP_SKIP.has(COLORS[i].fam) && !NOINK.has(i));
  if (!cands.length) return [];
  // (v308: your brands' gaps first, then another brand's that bring a colour yours don't have)
  const sp = buySplit(cands);
  if (sp.other.length || sp.mine.length < cands.length) {
    const a = rampRankOf(sp.mine);
    return a.concat(rampRankOf(sp.other).filter((i) => a.indexOf(i) < 0));
  }
  return rampRankOf(cands);
}
function rampRankOf(cands) {
  if (!cands.length) return [];
  const TH = 8;
  const sub = (a, b) => [LAB[a][0] - LAB[b][0], LAB[a][1] - LAB[b][1], LAB[a][2] - LAB[b][2]];
  const nrm = (v) => Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  const present = {};
  for (let i = 0; i < COLORS.length; i++)
    if (isOwned(i)) {
      const f = COLORS[i].fam;
      (present[f] = present[f] || []).push(i);
    }
  const scoreOf = (c) => {
    const arr = (present[COLORS[c].fam] || []).filter((o) => rampAlong(o, c));
    if (arr.length < 2) return -1;
    let n1 = -1,
      d1 = 1e9;
    for (const o of arr) {
      const d = nrm(sub(o, c));
      if (d < d1) {
        d1 = d;
        n1 = o;
      }
    }
    if (n1 < 0) return -1;
    const v1 = sub(n1, c);
    let opp = false;
    for (const o of arr) {
      if (o === n1) continue;
      const vo = sub(o, c);
      if (v1[0] * vo[0] + v1[1] * vo[1] + v1[2] * vo[2] < 0) {
        opp = true;
        break;
      }
    }
    return opp ? d1 : -1;
  };
  const remaining = new Set(cands),
    order = [],
    score = new Map();
  for (const c of remaining) score.set(c, scoreOf(c));
  while (remaining.size) {
    let bp = null,
      bs = -1;
    for (const c of remaining) {
      const s = score.get(c);
      if (s > bs) {
        bs = s;
        bp = c;
      }
    }
    if (bp == null || bs < TH) break;
    remaining.delete(bp);
    order.push(bp);
    const f = COLORS[bp].fam;
    present[f].push(bp);
    for (const c of remaining) if (COLORS[c].fam === f) score.set(c, scoreOf(c));
  }
  return order;
}
function gapRank(cands) {
  // (the Colorless Blender lays down no colour: not a gap to fill, and owning one doesn't cover white, v304; v308: nor
  // fluorescents, and it isn't listed at all)
  cands = gapCands(cands);
  if (!cands.length) return [];
  const owned = [];
  for (let i = 0; i < COLORS.length; i++) if (isOwned(i) && !NOINK.has(i)) owned.push(i);
  // (v308: your brands' first, then another brand's that bring a colour yours don't have, each filling what's left)
  const sp = buySplit(cands);
  if (sp.mine.length === cands.length) return gapOrder(cands, owned);
  const a = gapOrder(sp.mine, owned);
  return a.concat(gapOrder(sp.other, owned.concat(a)));
}
function gapOrder(cands, owned) {
  if (!cands.length) return [];
  const D = (a, b) => {
    const l = a[0] - b[0],
      m = a[1] - b[1],
      n = a[2] - b[2];
    return Math.sqrt(l * l + m * m + n * n);
  };
  const dmin = cands.map((ci) => {
    const la = LAB[ci];
    let mn = Infinity;
    for (const oi of owned) {
      const d = D(la, LAB[oi]);
      if (d < mn) mn = d;
    }
    return mn;
  });
  const n = cands.length,
    used = new Array(n).fill(false),
    order = [];
  for (let step = 0; step < n; step++) {
    let bi = -1,
      bd = -1;
    for (let j = 0; j < n; j++)
      if (!used[j] && dmin[j] > bd) {
        bd = dmin[j];
        bi = j;
      }
    if (bi < 0) break;
    used[bi] = true;
    order.push(cands[bi]);
    const pk = LAB[cands[bi]];
    for (let j = 0; j < n; j++)
      if (!used[j]) {
        const d = D(LAB[cands[j]], pk);
        if (d < dmin[j]) dmin[j] = d;
      }
  }
  return order;
}
const TONE = HS.map((o) => (o.l >= 0.8 ? 'pale' : o.l >= 0.62 ? 'light' : o.l >= 0.49 ? 'mid' : 'dark'));
const TONE_DEFS = [
  { k: 'pale', t: 'Pale', d: '#f0efe9' },
  { k: 'light', t: 'Light', d: '#cfccc3' },
  { k: 'mid', t: 'Mid', d: '#8b8880' },
  { k: 'dark', t: 'Dark', d: '#2c2b30' },
];
const SAT = HS.map((o) => (o.c < 0.125 ? 'neutral' : o.c < 0.26 ? 'muted' : o.c < 0.42 ? 'medium' : 'vivid'));
const SAT_DEFS = [
  { k: 'neutral', t: 'Neutral', d: '#8c8c8f' },
  { k: 'muted', t: 'Muted', d: '#6f8a99' },
  { k: 'medium', t: 'Medium', d: '#3f9dc4' },
  { k: 'vivid', t: 'Vivid', d: '#0e8fd6' },
];
const BRAND_DEFS = [
  { k: 'Ohuhu', t: 'Ohuhu' },
  { k: 'Copic', t: 'Copic' },
];
function hueDist(a, b) {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
}

// family names saved before v308 (the Markers filters), as they are now
const FAM_RENAMED = { 'Blue-Green-Yellow': 'Blue Grey', 'Yellow-Green-Yellow': 'Yellow Grey' };
function famNow(n) {
  return Object.prototype.hasOwnProperty.call(FAM_RENAMED, n) ? FAM_RENAMED[n] : n;
}
const fmap = {};
COLORS.forEach((c, i) => {
  (fmap[c.fam] = fmap[c.fam] || []).push(i);
});
const families = Object.keys(fmap).map((name) => {
  const idxs = fmap[name];
  let sx = 0,
    sy = 0,
    ss = 0,
    rep = idxs[0],
    best = 9;
  idxs.forEach((i) => {
    const { h, s, l } = HS[i];
    const rad = (h * Math.PI) / 180;
    sx += Math.cos(rad) * s;
    sy += Math.sin(rad) * s;
    ss += s;
    const d = Math.abs(l - 0.5);
    if (d < best) {
      best = d;
      rep = i;
    }
  });
  let avgH = (Math.atan2(sy, sx) * 180) / Math.PI;
  if (avgH < 0) avgH += 360;
  return { name, idxs, avgH, neutral: ss / idxs.length < 0.12, repHex: COLORS[rep].hex, repL: HS[rep].l };
});
// (v300) a family's dot is its marker nearest the middle lightness, which for Yellow is an ochre and for Yellow-Red /
// Orange a brown, both like Earth's, and for Fluorescent a green like Yellow-Green's: those take the marker nearest a
// clear colour of their own instead (a canary yellow, an orange, the fluorescent pink; L*, C*, h°)
const FAM_IDEAL = { 'Yellow-Red / Orange': [64, 62, 55], Yellow: [84, 80, 95], Fluorescent: [60, 85, 350] };
families.forEach((f) => {
  const id = FAM_IDEAL[f.name];
  if (!id) return;
  const a0 = id[1] * Math.cos((id[2] * Math.PI) / 180),
    b0 = id[1] * Math.sin((id[2] * Math.PI) / 180);
  let best = -1,
    bd = Infinity;
  f.idxs.forEach((i) => {
    const [L, C, h] = LCH[i],
      a = C * Math.cos((h * Math.PI) / 180),
      b = C * Math.sin((h * Math.PI) / 180),
      d = (L - id[0]) ** 2 + (a - a0) ** 2 + (b - b0) ** 2;
    if (d < bd) {
      bd = d;
      best = i;
    }
  });
  if (best >= 0) {
    f.repHex = COLORS[best].hex;
    f.repL = HS[best].l;
  }
});
// (v308: Ohuhu's BGY and YGY greys are "Blue Grey" and "Yellow Grey", with the greys: they were "Blue-Green-Yellow" and
// "Yellow-Green-Yellow", between the colours, while their caps say Storm Grey, Oyster Grey… FAM_RENAMED)
const FAM_ORDER = [
  'Red',
  'Yellow-Red / Orange',
  'Yellow',
  'Yellow-Green',
  'Green',
  'Blue-Green',
  'Blue',
  'Blue-Violet',
  'Violet',
  'Red-Violet',
  'Earth / Skin / Brown',
  'Warm Grey',
  'Yellow Grey',
  'Toner Grey',
  'Neutral Grey',
  'Cool Grey',
  'Blue Grey',
  'Green Grey',
  'Neutral / Black',
  'Fluorescent',
];
families.sort((a, b) => {
  const ia = FAM_ORDER.indexOf(a.name),
    ib = FAM_ORDER.indexOf(b.name);
  return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
});

/* ---- lighting correction from the paper ----
   A phone photographs white paper as a darker, often tinted grey (measured on Ben's photos of his pages: lightness
   62-74 instead of about 95, sometimes warm). Correcting every pixel by the same per-channel gain, in linear light,
   brings the paper back to white and the inks back towards their true colours (on three photos of coloured pages the
   coloured areas moved about 20% closer to his real markers). One correction for the whole page was as good as a
   local one there. The very top end is compressed rather than clipped, so pale colours don't wash out to white. */
function srgbToLin(v) {
  v /= 255;
  return v > 0.04045 ? Math.pow((v + 0.055) / 1.055, 2.4) : v / 12.92;
}
function linToSrgb(v) {
  v = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(v * 255)));
}
// linear value paper should reach: about L* 95 (a little below pure white, as real paper is)
const PAPER_LIN = 0.88;
// the paper's colour in an image (RGBA data): the median, per channel in linear light, of its light, near-neutral pixels
// (the lighter 60% with chroma under 14 — paper under a warm lamp is tinted, so a strict grey test would miss it).
// `mask(i)` (optional) says which pixels may be paper, e.g. only the parts of a lined-up page left uncoloured.
// Returns [r, g, b] in linear light, or null when too little of the image looks like paper to trust.
function paperOf(data, mask) {
  const ls = [];
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    if (data[i + 3] < 125 || (mask && !mask(p))) continue;
    const lab = rgbLab8(data[i], data[i + 1], data[i + 2]);
    if (Math.hypot(lab[1], lab[2]) < 14 && lab[0] > 30) ls.push([lab[0], i]);
  }
  if (ls.length < 50) return null;
  ls.sort(function (a, b) {
    return a[0] - b[0];
  });
  const top = ls.slice(Math.floor(ls.length * 0.4)),
    ch = [[], [], []];
  top.forEach(function (x) {
    for (let k = 0; k < 3; k++) ch[k].push(srgbToLin(data[x[1] + k]));
  });
  return ch.map(function (a) {
    a.sort(function (p, q) {
      return p - q;
    });
    return a[a.length >> 1];
  });
}
function rgbLab8(r, g, b) {
  return hexToLab('#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1));
}
// the correction that takes `paper` ([r, g, b] linear, from paperOf or a tapped spot) to white; null for none needed or
// a reference too dark or too coloured to be paper. `loose` (v307) is for "something white" rather than paper: a cap
// label or a white mug in a dim, warm room (a cap tray under a lamp: brightest labels L* 70, blue at 0.47 of red)
const LIGHT_REF = { dark: 0.08, ratio: 0.55 },
  LIGHT_REF_LOOSE = { dark: 0.05, ratio: 0.42 },
  // (v308) "Photo looks dim"'s whites in a dark room: a night scene's lightest greys (L* about 25)
  LIGHT_REF_DIM = { dark: 0.025, ratio: 0.42 };
function lightFix(paper, loose) {
  if (!paper) return null;
  const mx = Math.max(paper[0], paper[1], paper[2]),
    mn = Math.min(paper[0], paper[1], paper[2]),
    lim = loose === 'dim' ? LIGHT_REF_DIM : loose ? LIGHT_REF_LOOSE : LIGHT_REF;
  if (mx < lim.dark || mn / mx < lim.ratio) return null;
  const gain = paper.map(function (v) {
    return PAPER_LIN / Math.max(v, 1e-4);
  });
  if (
    gain.every(function (g) {
      return Math.abs(g - 1) < 0.02;
    })
  )
    return null;
  return { gain: gain };
}
// one pixel through a correction: [r, g, b] 0-255 in and out. Above the knee the result is eased towards 1 instead of
// clipped, so a pale yellow stays a pale yellow.
const LIGHT_KNEE = 0.8;
function lightApply(fix, r, g, b) {
  if (!fix) return [r, g, b];
  const src = [r, g, b];
  return src.map(function (v, k) {
    let x = srgbToLin(v) * fix.gain[k];
    if (x > LIGHT_KNEE)
      x = LIGHT_KNEE + (1 - LIGHT_KNEE) * (1 - Math.exp(-(x - LIGHT_KNEE) / (1 - LIGHT_KNEE)));
    return linToSrgb(x);
  });
}
// a whole RGBA buffer in place
function lightApplyData(fix, data) {
  if (!fix) return data;
  const lut = [0, 1, 2].map(function (k) {
    const t = new Uint8ClampedArray(256);
    for (let v = 0; v < 256; v++) {
      let x = srgbToLin(v) * fix.gain[k];
      if (x > LIGHT_KNEE)
        x = LIGHT_KNEE + (1 - LIGHT_KNEE) * (1 - Math.exp(-(x - LIGHT_KNEE) / (1 - LIGHT_KNEE)));
      t[v] = linToSrgb(x);
    }
    return t;
  });
  for (let i = 0; i < data.length; i += 4) {
    data[i] = lut[0][data[i]];
    data[i + 1] = lut[1][data[i + 1]];
    data[i + 2] = lut[2][data[i + 2]];
  }
  return data;
}

// (v306) Palette › From photo's "Paper looks warm · Make it white": the photo's paper (paperOf), when it is clearly
// paper and clearly warm: light (L* 75 or more), at least 15% of the picture near-neutral and light enough to be
// paper, and yellow by b* 8 or more. Returns { fix, lab, share } (fix: what tapping that paper would do, paperSpot) or
// null. Measured on synthetic photos: white paper under a warm lamp shows it; daylight and cool light, sunsets, autumn
// leaves and caps on a wooden desk (no paper found) don't, nor pale fur or skin (too dark to be paper). Cream paper
// in daylight reads warm too, so the wording says what is seen, not why. Never applied by itself: a sunset's cast is
// the picture.
const WARM_PAPER = { L: 75, share: 0.15, b: 8 };
function paperWarm(data) {
  let n = 0,
    ok = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 125) continue;
    n++;
    const lab = rgbLab8(data[i], data[i + 1], data[i + 2]);
    if (Math.hypot(lab[1], lab[2]) < 14 && lab[0] > 30) ok++;
  }
  if (!n || ok / n < WARM_PAPER.share) return null;
  const p = paperOf(data);
  if (!p) return null;
  const lab = linLab(p[0], p[1], p[2]);
  if (lab[0] < WARM_PAPER.L || lab[2] < WARM_PAPER.b) return null;
  const r = paperSpot(p);
  return r.fix ? { fix: r.fix, lab: lab, share: ok / n } : null;
}

// (v307) "Photo looks warm · Balance it", for a photo with no paper to go by (a tray of caps under a lamp): its
// brightest 2% of pixels, when most of them are near-neutral (chroma under 26), together are dim (L* 35-80, where
// paper white is about 95), stand out (at least twice as light as the picture's middle pixel: white things in a
// scene, not a pale picture) and are spread over the picture (in at least half of a 4 × 4 grid: many white labels, not
// one sun or lamp), are taken as something white, and lifted to paper white as a tap on them would be
// (paperSpot, loose). Warm (b* 8 or more) or only dim says which. Returns { fix, lab, warm } or null. Never applied by
// itself; asked only when paperWarm finds no paper. A sunset's brightest pixels are its sun and glow: too light, or
// too coloured, or (exposed darker) in one place. Measured on Ben's cap-tray photo: labels L* 70, b* 20, 60% of the
// brightest 2% near-neutral, 6.7 times as light as the middle pixel, in 11 of the 16 parts. `w`: the image's width.
// (v308) A photo whose whites are all dim (L* 15-35: a coffee cup or a landscape at night, a dark room) is offered "dim"
// without its whites having to be spread about: they're the lightest things in a dark picture, not a lamp. A photo
// that is nearly all black (85% of it under L* 12: a starry sky, deep space) is offered nothing: its stars aren't
// whites in a dim room, and balancing turned its black space green.
const WARM_PHOTO = {
  top: 0.02,
  C: 26,
  near: 0.5,
  Lmin: 35,
  Lmax: 80,
  b: 8,
  stand: 2,
  spread: 8,
  dimMin: 15,
  black: 0.85,
  blackL: 12,
};
function photoWarm(data, w) {
  const px = [],
    // (the luminance of L* 12)
    blk = Math.pow((WARM_PHOTO.blackL + 16) / 116, 3);
  let nb = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 125) continue;
    const y = 0.2126 * srgbToLin(data[i]) + 0.7152 * srgbToLin(data[i + 1]) + 0.0722 * srgbToLin(data[i + 2]);
    if (y < blk) nb++;
    px.push([y, i]);
  }
  if (px.length < 100 || nb >= WARM_PHOTO.black * px.length) return null;
  px.sort(function (a, b) {
    return b[0] - a[0];
  });
  // (every pixel as light as the 2%'s darkest: many labels alike are all in, not those first in the picture)
  let n = Math.max(20, Math.round(px.length * WARM_PHOTO.top));
  while (n < px.length && px[n][0] >= px[n - 1][0]) n++;
  const top = px.slice(0, n),
    ch = [[], [], []];
  let near = 0;
  top.forEach(function (p) {
    const lab = rgbLab8(data[p[1]], data[p[1] + 1], data[p[1] + 2]);
    if (Math.hypot(lab[1], lab[2]) < WARM_PHOTO.C) near++;
    for (let k = 0; k < 3; k++) ch[k].push(srgbToLin(data[p[1] + k]));
  });
  if (
    near / top.length < WARM_PHOTO.near ||
    top[top.length >> 1][0] < WARM_PHOTO.stand * px[px.length >> 1][0]
  )
    return null;
  const h = data.length / 4 / w,
    cells = new Set();
  top.forEach(function (p) {
    const q = p[1] / 4;
    cells.add(
      Math.min(3, Math.floor(((q / w) | 0) / (h / 4))) * 4 + Math.min(3, Math.floor((q % w) / (w / 4))),
    );
  });
  // the white: the median per channel, in linear light
  const white = ch.map(function (a) {
    a.sort(function (p, q) {
      return p - q;
    });
    return a[a.length >> 1];
  });
  const lab = linLab(white[0], white[1], white[2]),
    warm = lab[2] >= WARM_PHOTO.b,
    // (v308) all dim, and not warm: no spread asked for
    dark = !warm && lab[0] >= WARM_PHOTO.dimMin && lab[0] < WARM_PHOTO.Lmin;
  if (Math.hypot(lab[1], lab[2]) >= WARM_PHOTO.C || lab[0] >= WARM_PHOTO.Lmax) return null;
  if (!dark && (lab[0] < WARM_PHOTO.Lmin || cells.size < WARM_PHOTO.spread)) return null;
  const r = paperSpot(white, dark ? 'dim' : true);
  return r.fix ? { fix: r.fix, lab: lab, warm: warm } : null;
}

/* ---- Match a colour: the markers nearest a colour, by eye (match.js) ----
   Ranked by CIEDE2000, which follows the eye: plain L*a*b* distance (ΔE76) overstates differences in strong colours,
   so on a 451-marker collection its top pick wasn't the closest by eye about a third of the time. */
// the words for how close a match is, by CIEDE2000: [below, word]; anything further is Loose
const MATCH_STEPS = [
  [2, 'Near-exact'],
  [4, 'Very close'],
  [7, 'Close'],
  [12, 'Rough'],
];
function matchWord(d) {
  for (let k = 0; k < MATCH_STEPS.length; k++) if (d < MATCH_STEPS[k][0]) return MATCH_STEPS[k][1];
  return 'Loose';
}
// a marker you could buy is listed only when it is clearly closer than your best: by at least this much (CIEDE2000;
// about 2 is just noticeable)
const MATCH_BUY_GAIN = 2;
// The markers nearest a colour (L*a*b*), each { i, d } with d its CIEDE2000, nearest first: `owned`, up to 5 you can
// use (owned and not dry, any brand), and `buy`, those of the 3 nearest markers to buy (not owned, or dry) that are
// clearly closer than the best of yours (all 3 when you have none). Which brands a marker to buy comes from is Brands
// I'd buy (v304): automatic, your brands (those of the markers you own that lay down colour, dry ones too; none, an
// empty collection, is all), and `other`, at most one marker of another brand, only when it is clearly closer than both
// your best and anything of your brands (an Ohuhu-only collection was offered Copic markers 0.1 closer than an Ohuhu
// one); or only the brands ticked, and no `other`. opt.exclude: a marker left out (Find similar's own, v304). One
// pass, no sort of every marker: it runs on every frame of a drag.
function matchNearest(lab, opt) {
  const ex = opt && opt.exclude != null ? opt.exclude : -1,
    set = state.buyBrands,
    mine = new Set(set || []);
  if (!set) for (let i = 0; i < LAB.length; i++) if (!NOINK.has(i) && isOwned(i)) mine.add(COLORS[i].brand);
  const owned = [],
    others = [];
  let ownNear = Infinity,
    oth = null;
  const keep = (list, max, o) => {
    if (list.length === max && o.d >= list[max - 1].d) return;
    let k = list.length;
    while (k > 0 && list[k - 1].d > o.d) k--;
    list.splice(k, 0, o);
    if (list.length > max) list.pop();
  };
  for (let i = 0; i < LAB.length; i++) {
    if (NOINK.has(i) || i === ex) continue;
    const o = { i: i, d: de2000(lab, LAB[i]) },
      use = isOwned(i) && !isDry(i);
    // (a marker you can use counts whatever its brand: Brands I'd buy is about buying)
    if (use) {
      keep(owned, 5, o);
      if (o.d < ownNear) ownNear = o.d;
      continue;
    }
    if (mine.size && !mine.has(COLORS[i].brand)) {
      if (!set && (!oth || o.d < oth.d)) oth = o;
      continue;
    }
    if (o.d < ownNear) ownNear = o.d;
    keep(others, 3, o);
  }
  const best = owned.length ? owned[0].d : Infinity;
  return {
    owned: owned,
    buy: others.filter(function (o) {
      return o.d <= best - MATCH_BUY_GAIN;
    }),
    other: oth && oth.d <= Math.min(best, ownNear) - MATCH_BUY_GAIN ? [oth] : [],
  };
}

/* ---- "Tap something white" (Match's photo, Palette › From photo; "Tap the white paper" until v307) ----
   Never automatic: a sunset's warm cast is the picture, so only a spot you say is white corrects a photo (or an offer
   you take: paperWarm, photoWarm). */
// the average colour, in linear light, of the square patch of RGBA `data` (`w` × `h`) within `rad` of (x, y); null
// when all of it is see-through
function patchLin(data, w, h, x, y, rad) {
  let r = 0,
    g = 0,
    b = 0,
    n = 0;
  for (let yy = Math.max(0, y - rad); yy <= Math.min(h - 1, y + rad); yy++)
    for (let xx = Math.max(0, x - rad); xx <= Math.min(w - 1, x + rad); xx++) {
      const i = (yy * w + xx) * 4;
      if (data[i + 3] < 125) continue;
      r += srgbToLin(data[i]);
      g += srgbToLin(data[i + 1]);
      b += srgbToLin(data[i + 2]);
      n++;
    }
  return n ? [r / n, g / n, b / n] : null;
}
// (v307) "Tap something white": the brightest quarter of the patch, averaged in linear light, so a small white thing
// (a cap's label) among darker ones can be tapped; on plain paper it is the paper, as patchLin gives it
function whiteLin(data, w, h, x, y, rad) {
  const px = [];
  for (let yy = Math.max(0, y - rad); yy <= Math.min(h - 1, y + rad); yy++)
    for (let xx = Math.max(0, x - rad); xx <= Math.min(w - 1, x + rad); xx++) {
      const i = (yy * w + xx) * 4;
      if (data[i + 3] < 125) continue;
      const c = [srgbToLin(data[i]), srgbToLin(data[i + 1]), srgbToLin(data[i + 2])];
      px.push([0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2], c]);
    }
  if (!px.length) return null;
  px.sort(function (a, b) {
    return b[0] - a[0];
  });
  const top = px.slice(0, Math.max(1, Math.ceil(px.length / 4))),
    s = [0, 0, 0];
  top.forEach(function (p) {
    for (let k = 0; k < 3; k++) s[k] += p[1][k];
  });
  return s.map(function (v) {
    return v / top.length;
  });
}
// what a tapped spot (linear [r, g, b], from patchLin or whiteLin) gives as the paper: { fix } to use; { fix: null,
// note } when it already looks white (v307: whatever white thing was tapped, not just the paper); { bad: true, note } when the spot can't be paper. `loose`: the limits
// for something white (lightFix)
function paperSpot(lin, loose) {
  const fix = lightFix(lin, loose);
  if (fix) {
    // (paper brighter than paper white — a scan, a picture made on screen — is balanced to its own brightest channel
    // instead of darkened to PAPER_LIN: a cream scan loses its cast, a white one is left as it is, v304)
    const mx = Math.max(lin[0], lin[1], lin[2]);
    if (mx <= PAPER_LIN) return { fix: fix, note: '' };
    const gain = lin.map(function (v) {
      return mx / Math.max(v, 1e-4);
    });
    if (
      gain.some(function (g) {
        return g >= 1.02;
      })
    )
      return { fix: { gain: gain }, note: '' };
    return { fix: null, note: 'That already looks white: nothing to correct.' };
  }
  // lightFix gives none both for paper that needs no correction (every channel within 2% of it) and for a spot that
  // can't be paper
  if (
    lin &&
    lin.every(function (v) {
      return Math.abs(PAPER_LIN / Math.max(v, 1e-4) - 1) < 0.02;
    })
  )
    return { fix: null, note: 'That already looks white: nothing to correct.' };
  return {
    bad: true,
    fix: null,
    note: 'That spot is too dark or too coloured to be white. Tap the paper or something else white.',
  };
}
