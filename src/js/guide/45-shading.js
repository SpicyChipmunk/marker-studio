/* ---- shading: layered tones inside each section, lit by one sun you can drag around the picture ----
    Tones are layered the way alcohol markers are: the lighter marker covers the whole section, the base
    marker goes over the middle and the shadow, the darker marker only in the shadow. Companion markers
    come only from the markers you own; with no darker match, the shadow is a 2nd coat of the base.
    Shadows (shadeShadow) and Highlights (shadeHilite) choose what kind of companion: the same colour (a darker or
    lighter marker of the colour's own family, as always), a cooler shadow or a grey one, a warmer highlight or the
    paper left white. A cooler or grey marker is laid over the base in the shadow, and alcohol ink is see-through,
    so the shadow is shown as that glaze (shadeGlaze), not as the marker's own colour.
    With zones (34-zones), each zone has its own shading: whether it's shaded at all, how round, and its Highlights
    and Shadows (kind and amount): zsh(id), zshOf(section). Main's are the variables below (shadeMain, shadeRound,
    shadeHi, shadeLo, shadeShadow, shadeHilite), saved as the guide's own; the other zones keep theirs in z.sh, never
    swapped into these (so drawing, labels and print always use each section's own zone). The mode, the light (the sun
    or the photo) and the tone lines are the whole picture's. A section's tones (shadeTones(marker, its zone's
    shading)) carry where each tone hands over (T2, T3), so everything that reads them follows the zone. */
let shadeMode = 'off',
  shadeShadow = 'same',
  shadeHilite = 'same',
  shadeSun = { x: 0.2, y: 0.12 },
  shadeRound = 0.5,
  shadeLines = true,
  shadeHi = 0.5,
  shadeLo = 0.5,
  // where the light comes from: 'auto' (the photo when Main uses the Photo pattern, else the sun), 'sun' or 'photo'
  shadeLight = 'auto',
  // Main's "Shade Main" with zones (each other zone has its own, z.sh.on); without zones every section is Main's and
  // this has no effect
  shadeMain = true,
  shadeFlat = {},
  shadeFlatMode = false,
  _flatVer = 0;
let shadeGeo = null,
  shadeV = null,
  shadeVKey = '',
  shadeToneCache = {},
  shadeToneColl = null,
  _toneId = 0,
  sunEl = null,
  sunRaf = 0;
const SH_MINR = 5,
  PH_SPAN = 60;
// where one tone hands over to the next along the shade value (0 = lit .. 1 = deepest shadow), for a zone's shading
// zs; its Highlight and Shadow sliders move them (at 50% they are 0.34 and 0.60; a paper highlight 0.17). Kept on the
// zone's tones (t.T2, t.T3: shadeTones).
function shT2(zs) {
  // (paper left white is the brightest part only: about half as much as a lighter marker covers)
  return shadeMode === 'full' && zs.hilite === 'paper' ? 0.08 + 0.18 * zs.hi : 0.2 + 0.28 * zs.hi;
}
function shT3(zs) {
  return 0.78 - 0.36 * zs.lo;
}
// is there a photo in place to take the light from? (one of the zones, or the guide, uses the Photo pattern)
function photoLightOK() {
  return !!(photoRef && photoXf) && zoneUsesPhoto();
}
// the light in use, for the whole picture: the photo's own light and dark, or the sun. Chosen in Light from; until
// then (auto) the photo when Main uses the Photo pattern, as a guide without zones always did
function shadeFromPhoto() {
  if (!photoLightOK()) return false;
  return shadeLight === 'photo' || (shadeLight === 'auto' && zoneFamily(0) === 'photo');
}
function shadeOn() {
  return shadeMode !== 'off' && !!assignData;
}
function shadeReset() {
  // every shading setting in STYLE_FIELDS (05-style-fields) to its default: off, the sun top left, and so on
  styleOpen({}, 'shade');
  shadeFlat = {};
  shadeFlatMode = false;
  _flatVer++;
  shadeV = null;
  shadeVKey = '';
}
// per-section geometry that doesn't depend on the sun: distance to the section's edge, centre, size
function shadeGeom() {
  if (!labels || !comps) return null;
  if (!labelPts || !_ldq || _ldq._lp !== labelPts) buildLabelPts();
  if (shadeGeo && shadeGeo.lp === labelPts && shadeGeo.W === W && shadeGeo.H === H) return shadeGeo;
  // the distance to each section's edge was already worked out for the label positions (_ldq, in 1/8 px)
  const K = comps.length,
    Q = _ldq;
  const cx = new Float64Array(K),
    cy = new Float64Array(K),
    ar = Q._ar,
    mx = new Float32Array(K);
  for (let l = 1; l < K; l++) {
    const p = labelPts[l];
    mx[l] = p ? p.r : 0;
    if (ar[l]) {
      cx[l] = Q._sx[l] / ar[l];
      cy[l] = Q._sy[l] / ar[l];
    }
  }
  shadeGeo = { lp: labelPts, W: W, H: H, D: Q, cx: cx, cy: cy, ar: ar, mx: mx, N: null };
  shadeV = null;
  shadeVKey = '';
  return shadeGeo;
}
// outward surface direction at each pixel (which way that bit of the shape "faces"), from a softened edge-distance
// field so the direction turns smoothly instead of flipping along each shape's middle line. Stored as bytes (x127).
function shadeNormals(g) {
  if (g.N) return g.N;
  // worked out at half size (plenty for a direction that changes slowly), with row-order blurs that stay cache-friendly
  const hw = (W + 1) >> 1,
    hh = (H + 1) >> 1,
    m = hw * hh,
    Q = g.D,
    A = new Float32Array(m),
    B = new Float32Array(m),
    R = Math.max(2, Math.round(Math.min(W, H) / 180));
  for (let y = 0; y < H; y++) {
    const ro = y * W,
      ho = (y >> 1) * hw;
    for (let x = 0; x < W; x++) A[ho + (x >> 1)] += Q[ro + x] * 0.25;
  }
  const blurH = function (src, dst) {
    for (let y = 0; y < hh; y++) {
      const ro = y * hw;
      let acc = 0,
        cnt = 0;
      for (let x = -R; x < hw; x++) {
        const a = x + R;
        if (a < hw) {
          acc += src[ro + a];
          cnt++;
        }
        const r = x - R - 1;
        if (r >= 0) {
          acc -= src[ro + r];
          cnt--;
        }
        if (x >= 0) dst[ro + x] = acc / cnt;
      }
    }
  };
  const col = new Float32Array(hw),
    blurV = function (src, dst) {
      col.fill(0);
      let cnt = 0;
      for (let y = -R; y < hh; y++) {
        const a = y + R;
        if (a < hh) {
          const ro = a * hw;
          for (let x = 0; x < hw; x++) col[x] += src[ro + x];
          cnt++;
        }
        const r = y - R - 1;
        if (r >= 0) {
          const ro = r * hw;
          for (let x = 0; x < hw; x++) col[x] -= src[ro + x];
          cnt--;
        }
        if (y >= 0) {
          const ro = y * hw,
            k = 1 / cnt;
          for (let x = 0; x < hw; x++) dst[ro + x] = col[x] * k;
        }
      }
    };
  blurH(A, B);
  blurV(B, A);
  blurH(A, B);
  blurV(B, A);
  const NX = new Int8Array(m),
    NY = new Int8Array(m);
  for (let y = 1; y < hh - 1; y++) {
    const ro = y * hw;
    for (let x = 1; x < hw - 1; x++) {
      const q = ro + x,
        gx = A[q + 1] - A[q - 1],
        gy = A[q + hw] - A[q - hw],
        mm = Math.hypot(gx, gy);
      if (mm < 1e-6) continue;
      NX[q] = Math.round((-gx / mm) * 127);
      NY[q] = Math.round((-gy / mm) * 127);
    }
  }
  g.N = { x: NX, y: NY, hw: hw };
  return g.N;
}
// why a section isn't shaded ('' when it is): not in the guide ('none'), too small or background-sized ('small'),
// left flat itself ('flat'), in a zone that's flat ('zone'), or outside the photo the light comes from ('photo')
function shadeWhy(l, g, fp) {
  if (!(assignData && assignData.assign[l])) return 'none';
  if (g.mx[l] < SH_MINR || g.ar[l] >= 0.25 * W * H) return 'small';
  if (shadeFlat[l]) return 'flat';
  if (!zshOf(l).on) return 'zone';
  if ((fp === undefined ? shadeFromPhoto() : fp) && !photoCovers(l)) return 'photo';
  return '';
}
// is this section shaded at all? (fp: whether the light comes from the photo, when the caller knows)
function shadeable(l, g, fp) {
  return !shadeWhy(l, g, fp);
}
// shade value per pixel, 0 = facing the sun .. 1 = deepest shadow; 0 in the array means "not shaded"
function shadeField(step) {
  const g = shadeGeom();
  if (!g) return null;
  step = step || 1;
  const fromPhoto = shadeFromPhoto(),
    key = [
      fromPhoto ? 'photo' : 'sun',
      shadeSun.x.toFixed(4),
      shadeSun.y.toFixed(4),
      shadeRound.toFixed(3),
      step,
      _flatVer,
      // (the zones' membership and shading: 34-zones; Main's own flat choice)
      _zshVer,
      zones.length && !shadeMain ? 'mflat' : '',
      fromPhoto
        ? [photoXf.cx, photoXf.cy, photoXf.sx, photoXf.sy, photoXf.r, photoRef.w, photoRef.url.length].join(
            ',',
          )
        : '',
    ].join('|');
  if (
    shadeV &&
    shadeVKey === key &&
    shadeV._g === g &&
    shadeV._a === assignData &&
    (!fromPhoto || shadeV._p === photoRef)
  )
    return shadeV;
  if (fromPhoto) return photoShadeField(g, step, key);
  const n = W * H,
    K = comps.length,
    sx = shadeSun.x * W,
    sy = shadeSun.y * H,
    ux = new Float32Array(K),
    uy = new Float32Array(K),
    pmin = new Float32Array(K).fill(1e9),
    pmax = new Float32Array(K).fill(-1e9),
    ok = new Uint8Array(K),
    rnd = new Float32Array(K);
  for (let l = 1; l < K; l++) {
    if (!shadeable(l, g, false)) continue;
    ok[l] = 1;
    // (each section as round as its zone says)
    rnd[l] = zshOf(l).round;
    let dx = g.cx[l] - sx,
      dy = g.cy[l] - sy;
    const m = Math.hypot(dx, dy);
    if (m < 1e-3) {
      dx = 0.6;
      dy = 0.8;
    } else {
      dx /= m;
      dy /= m;
    }
    ux[l] = dx;
    uy[l] = dy;
  }
  for (let y = 0; y < H; y += step) {
    const ro = y * W;
    for (let x = 0; x < W; x += step) {
      const l = labels[ro + x];
      if (l < 1 || !ok[l]) continue;
      const p = (x - g.cx[l]) * ux[l] + (y - g.cy[l]) * uy[l];
      if (p < pmin[l]) pmin[l] = p;
      if (p > pmax[l]) pmax[l] = p;
    }
  }
  const V = shadeV && shadeV.length === n ? shadeV : new Uint8Array(n),
    NN = shadeNormals(g);
  // the straight gradient s = x*sa + y*sb + sc runs 0..1 across each section along the light
  const sa = new Float64Array(K),
    sb = new Float64Array(K),
    sc = new Float64Array(K),
    ie = new Float64Array(K);
  for (let l = 1; l < K; l++) {
    if (!ok[l]) continue;
    const rg = 1 / Math.max(1, pmax[l] - pmin[l]);
    sa[l] = ux[l] * rg;
    sb[l] = uy[l] * rg;
    sc[l] = (-(g.cx[l] * ux[l] + g.cy[l] * uy[l]) - pmin[l]) * rg;
    ie[l] = 1 / (8 * g.mx[l]);
  }
  const Dq = g.D;
  for (let y = 0; y < H; y += step) {
    const ro = y * W;
    for (let x = 0; x < W; x += step) {
      const q = ro + x,
        l = labels[q];
      if (l < 1 || !ok[l]) {
        V[q] = 0;
        continue;
      }
      // lin: straight gradient across the shape, away from the sun. facing: whether this bit of the shape's edge turns
      // toward the sun (-1) or away from it (+1), strongest at the edge and fading toward the middle. Roundness mixes the two.
      let e = Dq[q] * ie[l];
      e = e >= 1 ? 0 : 1 - e;
      const hq = (y >> 1) * NN.hw + (x >> 1),
        lin = x * sa[l] + y * sb[l] + sc[l],
        facing = (NN.x[hq] * ux[l] + NN.y[hq] * uy[l]) / 127,
        w = e * (0.6 + 0.4 * e);
      const R = rnd[l];
      let v = (1 - R) * (lin - 0.04) + R * (0.5 + 0.52 * facing * w + 0.32 * (lin - 0.5));
      v = v < 0 ? 0 : v > 1 ? 1 : v;
      V[q] = 1 + Math.round(v * 254);
    }
  }
  V._g = g;
  V._a = assignData;
  shadeV = V;
  shadeVKey = key;
  return V;
}
// shading from the photo: where the photo is lighter than the section's own colour it gets the highlight, darker gets
// the shadow, and where the photo is even the section stays flat. The photo's lightness is softened first so
// texture and noise don't speckle the tones.
function photoLight() {
  if (photoRef.Lb) return photoRef.Lb;
  const w = photoRef.w,
    h = photoRef.h,
    d = photoRef.data,
    A = new Float32Array(w * h),
    B = new Float32Array(w * h),
    R = Math.max(2, Math.round(Math.min(w, h) / 160));
  for (let i = 0, j = 0; i < w * h; i++, j += 4) A[i] = rgbLab(d[j], d[j + 1], d[j + 2])[0];
  const bh = function (s, t) {
    for (let y = 0; y < h; y++) {
      let acc = 0,
        c = 0;
      for (let x = -R; x < w; x++) {
        const a = x + R;
        if (a < w) {
          acc += s[y * w + a];
          c++;
        }
        const r = x - R - 1;
        if (r >= 0) {
          acc -= s[y * w + r];
          c--;
        }
        if (x >= 0) t[y * w + x] = acc / c;
      }
    }
  };
  const bv = function (s, t) {
    for (let x = 0; x < w; x++) {
      let acc = 0,
        c = 0;
      for (let y = -R; y < h; y++) {
        const a = y + R;
        if (a < h) {
          acc += s[a * w + x];
          c++;
        }
        const r = y - R - 1;
        if (r >= 0) {
          acc -= s[r * w + x];
          c--;
        }
        if (y >= 0) t[y * w + x] = acc / c;
      }
    }
  };
  bh(A, B);
  bv(B, A);
  photoRef.Lb = A;
  return A;
}
function photoShadeField(g, step, key) {
  const n = W * H,
    K = comps.length,
    V = shadeV && shadeV.length === n ? shadeV : new Uint8Array(n),
    Lb = photoLight(),
    C = photoColours(),
    X = photoXf,
    cs = Math.cos(X.r),
    sn = Math.sin(X.r),
    pw = photoRef.w,
    ph = photoRef.h,
    ok = new Uint8Array(K),
    ref = new Float32Array(K);
  for (let l = 1; l < K; l++) {
    if (!shadeable(l, g, true) || !C.has[l]) continue;
    ok[l] = 1;
    ref[l] = C.lab[l * 3];
  }
  for (let y = 0; y < H; y += step) {
    const ro = y * W;
    for (let x = 0; x < W; x += step) {
      const q = ro + x,
        l = labels[q];
      if (l < 1 || !ok[l]) {
        V[q] = 0;
        continue;
      }
      const dx = x + 0.5 - X.cx,
        dy = y + 0.5 - X.cy;
      const px = Math.floor((dx * cs + dy * sn) / X.sx + pw / 2),
        py = Math.floor((-dx * sn + dy * cs) / X.sy + ph / 2);
      // (a bit of a section past the photo's edge has no light or dark of its own: even, so the base tone, rather
      // than the edge's pixels smeared across it)
      if (px < 0 || py < 0 || px >= pw || py >= ph) {
        V[q] = 1 + Math.round(0.47 * 254);
        continue;
      }
      let v = 0.47 - (Lb[py * pw + px] - ref[l]) / PH_SPAN;
      v = v < 0 ? 0 : v > 1 ? 1 : v;
      V[q] = 1 + Math.round(v * 254);
    }
  }
  V._g = g;
  V._a = assignData;
  V._p = photoRef;
  shadeV = V;
  shadeVKey = key;
  return V;
}
// pick a lighter (side -1) or darker (+1) companion from a pool: a clear but not huge step, same colour family or a close hue
function shadePick(base, pool, side) {
  const bl = base.lab || hexToLab(base.hex),
    fv = famVal(base.code);
  let best = null,
    bs = 1e9;
  for (let i = 0; i < pool.length; i++) {
    const m = pool[i];
    if (!m || m.mkey === base.mkey) continue;
    const ml = m.lab || hexToLab(m.hex),
      dL = (bl[0] - ml[0]) * side;
    if (dL < 4 || dL > (side > 0 ? 30 : 26)) continue;
    const f = famVal(m.code),
      same = !!(fv && f && m.brand === base.brand && f.fam === fv.fam);
    if (!same && !_hueOK(bl, ml)) continue;
    const sc =
      Math.abs(dL - (side > 0 ? 12 : 10)) +
      Math.hypot(ml[1] - bl[1], ml[2] - bl[2]) * (side > 0 ? 0.5 : 0.35) -
      (same ? 6 : 0) +
      (m.brand !== base.brand ? 3 : 0);
    if (sc < bs) {
      bs = sc;
      best = m;
    }
  }
  return best;
}
/* The other kinds of companion (Shadows: Cooler or Grey; Highlights: Warmer). Hues are L*C*h° angles.
   Cooler: a marker turned 8-40° round the colour wheel the cool way (shCoolWay): reds and oranges towards
   red-violet, yellows towards yellow-green, greens towards blue-green, blues towards violet, violets and
   red-violets towards blue-violet. It's laid over the base, and the glaze must be a clear step darker.
   Grey: a marker from a grey family laid over the base the same way, a warm grey under a warm colour and a cool
   grey under a cool one.
   Warmer: a lighter marker turned 8-40° the warm way (shWarmWay): blues towards teal, greens towards
   yellow-green, yellows towards orange, oranges and reds towards yellow-orange, violets towards pink.
   The two ways are never the same for one colour. A grey base takes a cooler (or warmer) grey. */
const SHADE_SHADOW_LABEL = { same: 'Same colour', cool: 'Cooler', grey: 'Grey' },
  SHADE_HILITE_LABEL = { same: 'Same colour', warm: 'Warmer', paper: 'Paper white' };
const SH_TURN = [8, 40];
// the signed turn from hue a to hue b, the shorter way round (-180..180)
function shTurn(a, b) {
  let d = ((((b - a) % 360) + 540) % 360) - 180;
  return d === -180 ? 180 : d;
}
// +1: the cool (or warm) way is up the hue angle; -1 down
// (one line splits the wheel, so for every colour the two ways are opposite)
function shCoolWay(h) {
  return h >= 70 && h < 282 ? 1 : -1;
}
function shWarmWay(h) {
  return -shCoolWay(h);
}
// the grey families: Cool, Warm, Green, Neutral and Toner Grey, and Ohuhu's BGY and YGY greys (not black)
function shGreyFam(m) {
  const f = m.fam || '';
  return /Grey/.test(f) || f === 'Blue-Green-Yellow' || f === 'Yellow-Green-Yellow';
}
function shLab(m) {
  return m.lab || hexToLab(m.hex);
}
// the base with marker m laid over it (see-through inks: in linear light, each lets through its share of the light)
function shadeGlaze(b, m) {
  const c = hexRgb(m.hex);
  return [0, 1, 2].map(function (k) {
    return linToSrgb((srgbToLin(b[k]) * srgbToLin(c[k])) / 1);
  });
}
function shRgbLab(rgb) {
  return linLab(srgbToLin(rgb[0]), srgbToLin(rgb[1]), srgbToLin(rgb[2]));
}
// a shadow of kind 'cool' or 'grey' from pool, laid over the base; null when none fits
function shadeStylePick(base, pool, kind) {
  const bl = shLab(base),
    bx = lchOf(bl),
    brgb = hexRgb(base.hex),
    greyBase = bx[1] < 8,
    dir = shCoolWay(bx[2]),
    // a grey base's cooler shadow is a cool grey; the grey shadow matches the base's warmth
    want = kind === 'grey' || greyBase ? (kind === 'cool' ? 'cool' : markerTemp(base)) : '';
  let best = null,
    bs = 1e9;
  for (let i = 0; i < pool.length; i++) {
    const m = pool[i];
    if (!m || m.mkey === base.mkey) continue;
    const ml = shLab(m),
      mx = lchOf(ml);
    let sc;
    if (want) {
      if (!shGreyFam(m) || mx[0] < 22) continue;
      const tm = markerTemp(m);
      sc = want === 'both' || tm === want ? 0 : tm === 'both' ? 2 : 6;
      if (kind === 'cool' && tm === 'warm') continue;
    } else {
      if (mx[1] < Math.max(6, 0.3 * bx[1])) continue;
      const turn = shTurn(bx[2], mx[2]) * dir;
      if (turn < SH_TURN[0] || turn > SH_TURN[1]) continue;
      sc = Math.abs(turn - 22) * 0.25 + Math.abs(mx[1] - bx[1]) * 0.08;
    }
    // (two inks of near the same hue glaze to a stronger colour than either: a shadow that turns vivid reads as
    // brighter, not darker, so a glaze much stronger than the base is passed over)
    const gl = shRgbLab(shadeGlaze(brgb, m)),
      dL = bl[0] - gl[0],
      dC = Math.hypot(gl[1], gl[2]) - bx[1];
    if (dL < 5 || dL > 26 || dC > 12) continue;
    sc += Math.abs(dL - 12) + Math.max(0, dC) * 0.4 + (m.brand !== base.brand ? 3 : 0);
    if (sc < bs) {
      bs = sc;
      best = m;
    }
  }
  return best;
}
// a warmer highlight from pool: a clear step lighter and turned towards yellow; null when none fits
function shadeWarmPick(base, pool) {
  const bl = shLab(base),
    bx = lchOf(bl),
    greyBase = bx[1] < 8,
    dir = shWarmWay(bx[2]);
  let best = null,
    bs = 1e9;
  for (let i = 0; i < pool.length; i++) {
    const m = pool[i];
    if (!m || m.mkey === base.mkey) continue;
    const ml = shLab(m),
      mx = lchOf(ml),
      dL = ml[0] - bl[0];
    if (dL < 4 || dL > 26) continue;
    let sc;
    if (greyBase) {
      if (!shGreyFam(m)) continue;
      const tm = markerTemp(m);
      if (tm === 'cool') continue;
      sc = tm === 'warm' ? 0 : 2;
    } else {
      if (mx[1] < Math.max(4, 0.3 * bx[1])) continue;
      const turn = shTurn(bx[2], mx[2]) * dir;
      if (turn < SH_TURN[0] || turn > SH_TURN[1]) continue;
      sc = Math.abs(turn - 22) * 0.25 + Math.abs(mx[1] - bx[1]) * 0.12;
    }
    sc += Math.abs(dL - 10) + (m.brand !== base.brand ? 3 : 0);
    if (sc < bs) {
      bs = sc;
      best = m;
    }
  }
  return best;
}
// the tones for one marker, with a zone's shading zs (its Highlights and Shadows; Main's when not given):
// {light, dark} markers you own (or null) and whether the shadow is a 2nd coat. glaze: the dark marker is a cooler
// or grey one laid over the base (S is the glaze); paper: the highlight is the paper left white (no light marker);
// fellS / fellH: the Shadows or Highlights choice had no marker of that kind you own, so it fell back to the same
// colour. T2 / T3: where the tones hand over (the zone's amounts); sig: which markers, for telling apart the tones of
// one marker in two zones (the same markers with other amounts are the same to buy and to colour with). One object
// per marker and shading, kept until the markers you own change: its identity is what the drawing's caches go by.
function shadeTones(base, zs) {
  zs = zs || zshMain();
  if (coll !== shadeToneColl) {
    shadeToneCache = {};
    shadeToneColl = coll;
  }
  const full = shadeMode === 'full',
    key =
      shadeMode +
      '|' +
      zs.shadow +
      '|' +
      (full ? zs.hilite + '|' + zs.hi : '') +
      '|' +
      zs.lo +
      '|' +
      base.mkey,
    c = shadeToneCache[key];
  if (c) return c;
  const bl0 = (base.lab || hexToLab(base.hex))[0],
    noShadow = bl0 < 28, // near-black: nothing darker to add, a 2nd coat changes nothing
    sStyle = zs.shadow !== 'same',
    paper = full && zs.hilite === 'paper';
  let dark = null,
    glaze = false,
    light = null,
    warm = false;
  if (!noShadow) {
    if (sStyle) {
      dark = shadeStylePick(base, coll, zs.shadow);
      glaze = !!dark;
    }
    if (!dark) dark = shadePick(base, coll, 1);
  }
  if (full && !paper) {
    if (zs.hilite === 'warm') {
      light = shadeWarmPick(base, coll);
      warm = !!light;
    }
    if (!light) light = shadePick(base, coll, -1);
  }
  // (never the same marker for both: a light cooler marker can be both a colour's highlight and, laid over it, its
  // shadow. The shadow goes to the next cooler or grey one, or the same colour's darker one)
  if (light && dark && light.mkey === dark.mkey) {
    const lk = light.mkey,
      rest = coll.filter(function (m) {
        return m.mkey !== lk;
      });
    dark = glaze ? shadeStylePick(base, rest, zs.shadow) : null;
    glaze = !!dark;
    if (!dark) dark = shadePick(base, rest, 1);
  }
  let wantDark = null,
    wantLight = null;
  if (!isDemo()) {
    const cat = catPool().filter(function (m) {
        return m.brand === base.brand;
      }),
      // (a marker to buy for the shadow is never the highlight you already use)
      catS = light
        ? cat.filter(function (m) {
            return m.mkey !== light.mkey;
          })
        : cat;
    if (!noShadow) {
      if (sStyle && !glaze) wantDark = shadeStylePick(base, catS, zs.shadow);
      if (!wantDark && !dark) wantDark = shadePick(base, catS, 1);
    }
    if (full && !paper) {
      if (zs.hilite === 'warm' && !warm) wantLight = shadeWarmPick(base, cat);
      if (!wantLight && !light) wantLight = shadePick(base, cat, -1);
    }
  }
  const b = hexRgb(base.hex),
    coat = [0, 1, 2].map(function (k) {
      return Math.round(b[k] * (0.52 + (0.48 * b[k]) / 255));
    });
  const t = {
    light: light,
    dark: dark,
    coat: !dark && !noShadow,
    noShadow: noShadow,
    wantDark: wantDark,
    wantLight: wantLight,
    glaze: glaze,
    paper: paper,
    fellS: sStyle && !noShadow && !glaze,
    fellH: full && zs.hilite === 'warm' && !warm,
    // (the kinds asked for, for the notes that say which kind was missing)
    kS: zs.shadow,
    kH: zs.hilite,
    L: paper ? PAPER.slice() : light ? hexRgb(light.hex) : null,
    B: b,
    S: dark ? (glaze ? shadeGlaze(b, dark) : hexRgb(dark.hex)) : noShadow ? b : coat,
    T2: shT2(zs),
    T3: shT3(zs),
    id: ++_toneId,
  };
  t.sig =
    (light ? light.mkey : paper ? 'paper' : '-') +
    '|' +
    (dark ? dark.mkey + (glaze ? 'g' : '') : noShadow ? 'n' : 'c');
  shadeToneCache[key] = t;
  return t;
}
// everything renderGuide needs: the field and the tone colours per section
// while the sun is dragged the picture is previewed at about 160k pixels, so it keeps up with a finger
function previewStep() {
  return Math.max(2, Math.ceil(Math.sqrt((W * H) / 160000)));
}
// colour and zone for every shade value, per tone set: the per-pixel loops look these up instead of blending
let _lutC = null;
function shadeLUT() {
  const K = comps.length,
    tone = new Array(K),
    ti = new Uint16Array(K),
    list = [null],
    idx = new Map();
  for (const l in assignData.assign) {
    const t = shadeTones(assignData.assign[l], zshOf(+l));
    tone[l] = t;
    let k = idx.get(t);
    if (k == null) {
      k = list.length;
      idx.set(t, k);
      list.push(t);
    }
    ti[l] = k;
  }
  // (each tone set carries where its tones hand over, so the same list is the same table)
  if (!(
    _lutC &&
    _lutC.list.length === list.length &&
    list.every(function (t, i) {
      return t === _lutC.list[i];
    })
  )) {
    const T = list.length,
      mix = new Float32Array(T * 768),
      zn = new Uint8Array(T * 256),
      o = [0, 0, 0];
    for (let k = 1; k < T; k++) {
      const t = list[k];
      for (let v = 1; v < 256; v++) {
        const f = (v - 1) / 254;
        shadeMix(t, f, o);
        const j = k * 768 + v * 3;
        mix[j] = o[0];
        mix[j + 1] = o[1];
        mix[j + 2] = o[2];
        zn[k * 256 + v] = shadeZone(t, f);
      }
    }
    _lutC = { list: list, mix: mix, zn: zn };
  }
  return { tone: tone, ti: ti, mix: _lutC.mix, zn: _lutC.zn };
}
function shadePrep(drag) {
  if (!shadeOn()) return null;
  const step = drag ? previewStep() : 1,
    V = shadeField(step);
  if (!V) return null;
  const T = shadeLUT();
  return { V: V, tone: T.tone, ti: T.ti, mix: T.mix, zn: T.zn, step: step };
}
function shadeZone(t, v) {
  return v >= t.T3 && !t.noShadow ? 2 : t.L && v < t.T2 ? 0 : 1;
}
// colour at shade value v (0..1): light -> base -> shadow, blended softly across each boundary like wet ink
function shadeMix(t, v, out) {
  const T2 = t.T2,
    T3 = t.T3,
    a0 = T2 - 0.09,
    a1 = T2 + 0.09,
    b0 = T3 - 0.09,
    b1 = T3 + 0.09;
  let r = t.B[0],
    g = t.B[1],
    bb = t.B[2];
  if (t.L && v < a1) {
    let k = (v - a0) / (a1 - a0);
    k = k < 0 ? 0 : k > 1 ? 1 : k;
    k = k * k * (3 - 2 * k);
    r = t.L[0] + (r - t.L[0]) * k;
    g = t.L[1] + (g - t.L[1]) * k;
    bb = t.L[2] + (bb - t.L[2]) * k;
  }
  if (v > b0) {
    let k = (v - b0) / (b1 - b0);
    k = k < 0 ? 0 : k > 1 ? 1 : k;
    k = k * k * (3 - 2 * k);
    r += (t.S[0] - r) * k;
    g += (t.S[1] - g) * k;
    bb += (t.S[2] - bb) * k;
  }
  out[0] = r;
  out[1] = g;
  out[2] = bb;
  return out;
}
// dashed lines where one tone hands over to the next (inside a section only)
function shadeLinesDraw(sh, fade, o) {
  o = o || {};
  const V = sh.V,
    buf = o.buf || rgbOut,
    t = o.t || Math.max(1, Math.round(Math.max(W, H) / 900)),
    dash = o.dash || 6 * t,
    ink = o.ink,
    one = o.l != null ? o.l : -2,
    bx = o.box || [0, 0, W - 1, H - 1],
    ya = bx[1],
    yb = Math.min(bx[3], H - 1 - t),
    xa = bx[0],
    xb = Math.min(bx[2], W - 1 - t);
  const ti = sh.ti,
    zn = sh.zn;
  for (let y = ya; y <= yb; y++) {
    const ro = y * W;
    for (let x = xa; x <= xb; x++) {
      const q = ro + x,
        v = V[q];
      if (!v) continue;
      if ((((x + y) / dash) | 0) & 1) continue;
      const l = labels[q];
      if (one !== -2 && l !== one) continue;
      if (fade && fade[l]) continue;
      const k = ti[l];
      if (!k) continue;
      const zb = k * 256,
        z = zn[zb + v];
      const qa = q + t,
        qb = q + t * W;
      if (
        (labels[qa] === l && V[qa] && zn[zb + V[qa]] !== z) ||
        (labels[qb] === l && V[qb] && zn[zb + V[qb]] !== z)
      ) {
        const j = q * 4;
        if (ink) {
          buf[j] = ink[0];
          buf[j + 1] = ink[1];
          buf[j + 2] = ink[2];
        } else {
          buf[j] = buf[j] * 0.35 + 14;
          buf[j + 1] = buf[j + 1] * 0.35 + 14;
          buf[j + 2] = buf[j + 2] * 0.35 + 18;
        }
      }
    }
  }
}
// colour of pixel q (section l) in a finished-looking picture: shaded when shading is on, flat otherwise
function shadeRGB(sh, q, l, base, out) {
  if (sh && sh.V[q] && sh.tone[l]) return shadeMix(sh.tone[l], (sh.V[q] - 1) / 254, out);
  out[0] = base[0];
  out[1] = base[1];
  out[2] = base[2];
  return out;
}
// where to print the small tone numbers: the roomiest point of each shaded zone that is big enough
// (tone 2 = the base, only marked when a lighter tone 1 exists; tone 3 = the shadow)
function shadeZoneLabels(sh, minR, only) {
  const V = sh.V,
    R2 = 1.4142;
  let bx0 = 0,
    by0 = 0,
    bx1 = W - 1,
    by1 = H - 1;
  if (only != null) {
    const B = secBoxes();
    if (!(only < B.K) || B.x1[only] < 0) return [];
    bx0 = B.x0[only];
    by0 = B.y0[only];
    bx1 = B.x1[only];
    by1 = B.y1[only];
  }
  // work inside the box only (the whole picture, or one section for focus mode); w x h local arrays
  const w = bx1 - bx0 + 1,
    h = by1 - by0 + 1,
    n = w * h,
    Z = new Int32Array(n).fill(-1),
    D = new Float32Array(n);
  for (let y = 0; y < h; y++) {
    const ro = (y + by0) * W + bx0;
    for (let x = 0; x < w; x++) {
      const q = ro + x,
        l = labels[q],
        v = V[q];
      if (l < 1 || !v || !sh.tone[l] || (only != null && l !== only)) continue;
      Z[y * w + x] = l * 3 + shadeZone(sh.tone[l], (v - 1) / 254);
    }
  }
  for (let q = 0; q < n; q++) D[q] = Z[q] < 0 ? 0 : 1e9;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const q = y * w + x,
        z = Z[q];
      if (z < 0) continue;
      let d = D[q];
      if (x === 0 || y === 0) d = 1;
      if (x > 0 && (Z[q - 1] === z ? D[q - 1] + 1 : 1) < d) d = Z[q - 1] === z ? D[q - 1] + 1 : 1;
      if (y > 0) {
        const u = q - w;
        if ((Z[u] === z ? D[u] + 1 : 1) < d) d = Z[u] === z ? D[u] + 1 : 1;
        if (x > 0 && (Z[u - 1] === z ? D[u - 1] + R2 : R2) < d) d = Z[u - 1] === z ? D[u - 1] + R2 : R2;
        if (x < w - 1 && (Z[u + 1] === z ? D[u + 1] + R2 : R2) < d) d = Z[u + 1] === z ? D[u + 1] + R2 : R2;
      }
      D[q] = d;
    }
  const best = {};
  for (let y = h - 1; y >= 0; y--)
    for (let x = w - 1; x >= 0; x--) {
      const q = y * w + x,
        z = Z[q];
      if (z < 0) continue;
      let d = D[q];
      if (x === w - 1 || y === h - 1) d = Math.min(d, 1);
      if (x < w - 1 && (Z[q + 1] === z ? D[q + 1] + 1 : 1) < d) d = Z[q + 1] === z ? D[q + 1] + 1 : 1;
      if (y < h - 1) {
        const u = q + w;
        if ((Z[u] === z ? D[u] + 1 : 1) < d) d = Z[u] === z ? D[u] + 1 : 1;
        if (x < w - 1 && (Z[u + 1] === z ? D[u + 1] + R2 : R2) < d) d = Z[u + 1] === z ? D[u + 1] + R2 : R2;
        if (x > 0 && (Z[u - 1] === z ? D[u - 1] + R2 : R2) < d) d = Z[u - 1] === z ? D[u - 1] + R2 : R2;
      }
      D[q] = d;
      const b = best[z];
      if (!b || d > b.r) best[z] = { x: x + bx0 + 0.5, y: y + by0 + 0.5, r: d };
    }
  const out = [];
  for (const k in best) {
    const z = k % 3,
      l = (k - z) / 3,
      b = best[k],
      t = sh.tone[l];
    if (b.r < minR) continue;
    if (z === 1) continue;
    if (z === 0 && !t.L) continue;
    out.push({ l: l, zone: z, tone: z === 0 ? 'H' : 'S', x: b.x, y: b.y, r: b.r });
  }
  return out;
}
// worked out one section at a time and kept until the light or the sections change. A section narrower than
// minR can't hold a marker that big (a zone is never roomier than its section), so it is skipped outright.
let _zlAll = null;
// (each entry remembers the tones it was worked out for: a section's marker, the shading mode or the collection
// can change its tones without the light moving)
function zoneLabelsOf(sh, l) {
  if (!_zlAll || _zlAll.V !== sh.V || _zlAll.key !== shadeVKey || _zlAll.lp !== labelPts)
    _zlAll = { V: sh.V, key: shadeVKey, lp: labelPts, per: new Map() };
  let e = _zlAll.per.get(l);
  if (!e || e.t !== sh.tone[l]) {
    e = { t: sh.tone[l], li: shadeZoneLabels(sh, 3, l) };
    _zlAll.per.set(l, e);
  }
  return e.li;
}
function shadeZoneLabelsAll(sh, minR) {
  if (!labelPts) buildLabelPts();
  const out = [];
  for (const k in assignData.assign) {
    const l = +k,
      p = labelPts[l];
    if (!p || p.r < minR || !sh.tone[l]) continue;
    const li = zoneLabelsOf(sh, l);
    for (let i = 0; i < li.length; i++) if (li[i].r >= minR) out.push(li[i]);
  }
  return out;
}
// one line for the key: how to lay the tones down
const SHADE_HOWTO2 =
  'Shading \u2014 B = base (the section\u2019s marker), S = shadow. Colour the whole section with B, then add S in the shadow while it\u2019s still wet and soften the edge with B. The dashed lines and small S circles on the colouring page show where the shadow starts; the \u2600 marks where the light comes from.';
const SHADE_HOWTO =
  'Shading \u2014 H = highlight (lighter marker), B = base (the section\u2019s marker), S = shadow (darker marker). Work light to dark while the ink is wet: H over the whole section, B over everything except the highlight, S in the shadow, then soften the edges with the lighter marker. Dashed lines and the small H and S circles on the colouring page show where each goes; the \u2600 marks where the light comes from.';
const SHADE_HOWTO_MIX =
  'Shading \u2014 H = highlight (a lighter marker, or the paper left white where the key says so), B = base (the section\u2019s marker), S = shadow (darker marker). Work light to dark while the ink is wet: H over the whole section, B over everything except the highlight (where H is the paper, start with B and leave the highlight white), S in the shadow, then soften the edges with the lighter marker. Dashed lines and the small H and S circles on the colouring page show where each goes; the \u2600 marks where the light comes from.';
const SHADE_HOWTO_GLAZE =
  ' A cooler or grey shadow is laid over the base once it\u2019s dry, not while it\u2019s wet, so the base shows through.';
const SHADE_HOWTO_PAPER =
  'Shading \u2014 H = highlight (the paper left white), B = base (the section\u2019s marker), S = shadow. Colour the section with B, leaving the highlight white, add S in the shadow while it\u2019s still wet, then soften the edges with B. Dashed lines and the small H and S circles on the colouring page show where each goes; the \u2600 marks where the light comes from.';
// the key's how-to line; with the light taken from the photo there is no sun to point at
// (with zones, the highlights asked for in the shaded sections: all the paper, all a lighter marker, or some of each)
function shadeHowto() {
  const u = shadeUse(),
    t =
      shadeMode === 'full'
        ? u.hp && u.hm
          ? SHADE_HOWTO_MIX
          : u.hp
            ? SHADE_HOWTO_PAPER
            : SHADE_HOWTO
        : SHADE_HOWTO2;
  // (a cooler or grey shadow is a glaze: laid over the base once it's dry)
  const tg = u.gl ? t + SHADE_HOWTO_GLAZE : t;
  return shadeFromPhoto()
    ? tg.replace('the \u2600 marks where the light comes from.', 'the light and shadow follow your photo.')
    : tg;
}
// what the tip says when you tap a section
function shadeTipHTML(l) {
  if (!shadeOn() || !assignData || !assignData.assign[l]) return '';
  const g = shadeGeom();
  if (!g) return '';
  // (why not, when it isn't shaded)
  const why = shadeWhy(l, g);
  if (why)
    return (
      '<div class="sftipsh">' +
      (why === 'flat'
        ? 'Left flat — one colour'
        : why === 'zone'
          ? esc(zoneName(zoneOf(l))) + ' is flat — one colour'
          : why === 'photo'
            ? 'Outside the photo — one flat colour'
            : 'Too small to shade — one flat colour') +
      '</div>'
    );
  const m = assignData.assign[l],
    t = shadeTones(m, zshOf(l)),
    sw = function (hex) {
      return '<i style="background:' + esc(hex) + '"></i>';
    },
    parts = [];
  if (t.light) parts.push(sw(t.light.hex) + 'H ' + esc(mcode(t.light)));
  else if (t.paper) parts.push(sw('rgb(' + t.L.join(',') + ')') + 'H paper');
  parts.push(sw(m.hex) + 'B ' + esc(mcode(m)));
  if (!t.noShadow)
    parts.push(
      t.dark ? sw(t.dark.hex) + 'S ' + esc(mcode(t.dark)) : sw('rgb(' + t.S.join(',') + ')') + 'S 2nd coat',
    );
  return (
    '<div class="sftipsh"><span class="sftv" aria-hidden="true">' +
    parts.join(' <span>›</span> ') +
    '</span><span class="sfsr">' +
    esc(toneSay(m, t)) +
    '</span></div>'
  );
}
// the note under the Shading controls (#8), one line that opens: "4 markers would make the shading richer · Show"
// (with none to suggest, how many colours shade with a 2nd coat or have no lighter marker). Show gives the details
// and the markers, with their shopping-list buttons.
let shNoteOpen = false;
// With zones it's about the whole guide: every shaded section's colour, with its own zone's kinds of highlight and
// shadow (a colour counts once in each list, however many zones it's shaded in).
function shadeNoteHTML() {
  if (!shadeOn()) return '';
  const u = shadeUse();
  if (!u.on)
    return (
      '<div class="sfshnote">Every section is flat, so nothing is shaded' +
      (zones.length ? ': tick “Shade” for a zone below its chips to shade it.' : '.') +
      '</div>'
    );
  const seen = {},
    sets = {},
    coats = [],
    noLight = [],
    fellS = [],
    fellH = [],
    fsKind = {},
    want = {},
    wantFor = {},
    once = function (a, code) {
      if (a.indexOf(code) < 0) a.push(code);
    };
  for (const k in assignData.assign) {
    const l = +k,
      t = shadeSec(l);
    if (!t) continue;
    const m = assignData.assign[l];
    seen[m.mkey] = 1;
    if (sets[t.id]) continue;
    sets[t.id] = 1;
    if (t.coat) once(coats, m.code);
    if (shadeMode === 'full' && !t.light && !t.paper) once(noLight, m.code);
    if (t.fellS) {
      once(fellS, m.code);
      fsKind[t.kS] = 1;
    }
    if (t.fellH) once(fellH, m.code);
    if (t.wantDark) {
      want[t.wantDark.mkey] = t.wantDark;
      wantFor[t.wantDark.mkey] = wantFor[t.wantDark.mkey] || m.code;
    }
    if (t.wantLight) {
      want[t.wantLight.mkey] = t.wantLight;
      wantFor[t.wantLight.mkey] = wantFor[t.wantLight.mkey] || m.code;
    }
  }
  const n = Object.keys(seen).length,
    w = Object.keys(want).map(function (k) {
      return want[k];
    });
  let s = '';
  // (one kind of highlight and one of shadow over the shaded sections: say which; zones asking for different kinds:
  // say so)
  const kS = Object.keys(u.kS),
    kH = Object.keys(u.kH),
    sK = kS.length === 1 ? kS[0] : null,
    hK = kH.length === 1 ? kH[0] : null,
    _hs = shadeMode === 'full' && hK !== 'paper',
    _all =
      !sK || (!hK && shadeMode === 'full')
        ? 'the highlights and shadows each zone asks for, from markers you own'
        : sK === 'same' && hK === 'same'
          ? _hs
            ? 'lighter and darker markers you own'
            : 'darker markers you own'
          : (_hs ? (hK === 'warm' ? 'warmer highlights' : 'lighter markers') + ' and ' : '') +
            (sK === 'cool' ? 'cooler' : sK === 'grey' ? 'grey' : 'darker') +
            ' shadows from markers you own',
    fsK = Object.keys(fsKind);
  if (!coats.length && !noLight.length && !fellS.length && !fellH.length && !w.length)
    return '<div class="sfshnote">All ' + n + ' colours have ' + _all + '.</div>';
  const few = function (a, one, many) {
    return a.length === 1 ? a[0] + ' ' + one : a.length + ' colours ' + many;
  };
  if (fellS.length)
    s +=
      few(fellS, 'has', 'have') +
      ' no ' +
      (fsK.length === 1 ? (fsK[0] === 'cool' ? 'cooler' : 'grey') : 'cooler or grey') +
      ' marker in your collection that shades ' +
      (fellS.length === 1 ? 'it' : 'them') +
      ', so ' +
      (fellS.length === 1 ? 'its' : 'their') +
      ' shadow is the same colour. ';
  if (fellH.length)
    s +=
      few(fellH, 'has', 'have') +
      ' no warmer lighter marker in your collection, so ' +
      (fellH.length === 1 ? 'its' : 'their') +
      ' highlight is the same colour. ';
  if (coats.length)
    s +=
      coats.length +
      ' of ' +
      n +
      (n === 1 ? ' colour shades' : coats.length === 1 ? ' colours shades' : ' colours shade') +
      ' with a second coat (no darker match in your markers). ';
  if (noLight.length)
    s +=
      (noLight.length === 1 ? noLight[0] + ' has' : noLight.length + ' colours have') +
      ' no lighter marker in your collection, so ' +
      (noLight.length === 1 ? 'its' : 'their') +
      ' highlight stays the base colour. ';
  const head = w.length
    ? w.length + ' marker' + (w.length === 1 ? '' : 's') + ' would make the shading richer'
    : coats.length
      ? coats.length +
        ' of ' +
        n +
        (n === 1 ? ' colour shades' : coats.length === 1 ? ' colours shades' : ' colours shade') +
        ' with a second coat'
      : noLight.length
        ? (noLight.length === 1 ? noLight[0] + ' has' : noLight.length + ' colours have') +
          ' no lighter marker'
        : fellS.length
          ? few(fellS, 'has', 'have') + ' a same-colour shadow instead'
          : few(fellH, 'has', 'have') + ' a same-colour highlight instead';
  let more = s ? '<div>' + s.trim() + '</div>' : '';
  // letters when these, with the guide's own markers, mix brands (or your collection does)
  if (w.length) {
    let gb = null;
    for (const l in assignData.assign) {
      gb = assignData.assign[l].brand;
      break;
    }
    const mixed =
      brandsMixed() ||
      w.some(function (m) {
        return m.brand !== (gb || w[0].brand);
      });
    more +=
      '<div class="sfshrich"><b>Richer with:</b> ' +
      w
        .slice(0, 8)
        .map(function (m) {
          const lab = esc((mixed ? bTag(m.brand) + ' ' : '') + m.code);
          return api.wishChip
            ? api.wishChip(
                m.mkey,
                'shading for ' + wantFor[m.mkey],
                '<i style="background:' + esc(m.hex) + '"></i>' + lab,
              )
            : lab;
        })
        .join(api.wishChip ? ' ' : ', ') +
      (w.length > 8 ? ' +' + (w.length - 8) + ' more' : '') +
      (api.wishAll
        ? api.wishAll(
            w.map(function (m) {
              return [m.mkey, 'shading for ' + wantFor[m.mkey]];
            }),
          )
        : '') +
      '</div>';
  }
  return (
    '<div class="sfshnote sfonel' +
    (shNoteOpen ? ' open' : '') +
    '"><div class="sfonelh"><span>' +
    head +
    '</span><button type="button" id="sfShNoteT" class="sfonelb" aria-expanded="' +
    shNoteOpen +
    '" aria-controls="sfShNoteMore">' +
    (shNoteOpen ? 'Hide' : 'Show') +
    '</button></div><div id="sfShNoteMore" class="sfshmore"' +
    (shNoteOpen ? '' : ' hidden') +
    '>' +
    more +
    '</div></div>'
  );
}
// Show / Hide in place (the rest of the tab stays as it is)
function shadeNoteToggle() {
  shNoteOpen = !shNoteOpen;
  const b = document.getElementById('sfShNoteT'),
    m = document.getElementById('sfShNoteMore');
  if (b) {
    b.textContent = shNoteOpen ? 'Hide' : 'Show';
    b.setAttribute('aria-expanded', shNoteOpen ? 'true' : 'false');
    const o = b.closest('.sfonel');
    if (o) o.classList.toggle('open', shNoteOpen);
  }
  if (m) m.hidden = !shNoteOpen;
}
// ---- Radial's centre (v282): a target-shaped handle over the picture, while the Pattern tab shows a Radial
// Gradient; drag it (or use the arrow keys) to move where the rings start from. One Undo step a drag. ----
let radEl = null,
  radRaf = 0;
function radCOn() {
  return !!(
    cv &&
    sfView &&
    sfmode === 'guide' &&
    gTab === 'pattern' &&
    family === 'gradient' &&
    gradShape === 'radial' &&
    assignData &&
    !zoneEditOn() &&
    !root.classList.contains('sfrev') &&
    workEl &&
    workEl.style.display !== 'none'
  );
}
// where the centre is now, as parts of the picture (the zone's middle until it's moved)
function radCNow() {
  if (radC) return radC;
  const b = zones.length ? zoneBoxOf(zoneSecs(zoneCur)) : null;
  return b ? { x: (b.x0 + b.x1) / 2 / W, y: (b.y0 + b.y1) / 2 / H } : { x: 0.5, y: 0.5 };
}
function positionRadC() {
  if (!radCOn()) {
    if (radEl) radEl.style.display = 'none';
    return;
  }
  if (!radEl) {
    radEl = document.createElement('button');
    radEl.id = 'sfRadC';
    radEl.className = 'sfradc';
    radEl.type = 'button';
    radEl.setAttribute(
      'aria-label',
      'Radial centre — drag, or use the arrow keys, to move where the rings start',
    );
    radEl.innerHTML =
      '<svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true"><g fill="none" stroke-linecap="round"><circle cx="20" cy="20" r="12" stroke="#000" stroke-opacity=".55" stroke-width="5"/><circle cx="20" cy="20" r="12" stroke="#fff" stroke-width="2.6"/><path d="M20 3v9M20 28v9M3 20h9M28 20h9" stroke="#000" stroke-opacity=".55" stroke-width="5"/><path d="M20 3v9M20 28v9M3 20h9M28 20h9" stroke="#fff" stroke-width="2.6"/><circle cx="20" cy="20" r="3" fill="#fff" stroke="#000" stroke-opacity=".55" stroke-width="1.5"/></g></svg>';
    (picEl || sfView).appendChild(radEl);
    let drag = false;
    const lay = function () {
      if (!radRaf)
        radRaf = requestAnimationFrame(function () {
          radRaf = 0;
          // (still one Undo step if another finger lifted meanwhile: the page's pointerup ends planDrag for any)
          if (drag) planDrag = true;
          reassign();
        });
    };
    const move = function (e) {
      const r = cv.getBoundingClientRect();
      radC = {
        x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
        y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)),
      };
      positionRadC();
      lay();
    };
    radEl.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      e.stopPropagation();
      drag = true;
      // (the rings follow the finger; the whole drag is one Undo step, taken when it's let go)
      planDrag = true;
      try {
        radEl.setPointerCapture(e.pointerId);
      } catch (_) {}
      radEl.classList.add('on');
    });
    radEl.addEventListener('pointermove', function (e) {
      if (!drag) return;
      e.preventDefault();
      move(e);
    });
    const end = function () {
      if (!drag) return;
      drag = false;
      radEl.classList.remove('on');
      if (radRaf) {
        cancelAnimationFrame(radRaf);
        radRaf = 0;
      }
      planDrag = false;
      reassign();
    };
    radEl.addEventListener('pointerup', end);
    radEl.addEventListener('pointercancel', end);
    radEl.addEventListener('keydown', function (e) {
      const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (!d) return;
      e.preventDefault();
      const c = radCNow();
      radC = {
        x: Math.max(0, Math.min(1, c.x + d[0] * 0.05)),
        y: Math.max(0, Math.min(1, c.y + d[1] * 0.05)),
      };
      reassign();
      positionRadC();
    });
  }
  const c = radCNow(),
    r = cv.getBoundingClientRect(),
    hs = picHost(),
    vr = hs.getBoundingClientRect(),
    k = picK();
  let x = (r.left - vr.left + c.x * r.width) / k,
    y = (r.top - vr.top + c.y * r.height) / k;
  x = Math.max(22, Math.min(hs.clientWidth - 22, x));
  y = Math.max(22, Math.min(hs.clientHeight - 22, y));
  radEl.style.display = '';
  radEl.style.left = x + 'px';
  radEl.style.top = y + 'px';
}
// the sun: a small handle over the picture; drag it (or use the arrow keys) to move the light
function positionSun() {
  // (Radial's centre is placed with it, wherever the picture moves)
  positionRadC();
  const show = !!(
    cv &&
    sfView &&
    sfmode === 'guide' &&
    // (not while choosing a zone's sections: a drag there is for them, and the picture is faded)
    !zoneEditOn() &&
    shadeUse().sun &&
    !root.classList.contains('sfrev') &&
    workEl &&
    workEl.style.display !== 'none'
  );
  if (!show) {
    if (sunEl) sunEl.style.display = 'none';
    return;
  }
  if (!sunEl) {
    sunEl = document.createElement('button');
    sunEl.id = 'sfSun';
    sunEl.className = 'sfsun';
    sunEl.type = 'button';
    sunEl.setAttribute('aria-label', 'Light source — drag, or use the arrow keys, to move the light');
    sunEl.innerHTML =
      '<svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true"><g stroke="#ffd84a" stroke-width="2.6" stroke-linecap="round">' +
      [0, 45, 90, 135, 180, 225, 270, 315]
        .map(function (a) {
          const r = (a * Math.PI) / 180;
          return (
            '<line x1="' +
            (20 + Math.cos(r) * 12.5).toFixed(1) +
            '" y1="' +
            (20 + Math.sin(r) * 12.5).toFixed(1) +
            '" x2="' +
            (20 + Math.cos(r) * 17).toFixed(1) +
            '" y2="' +
            (20 + Math.sin(r) * 17).toFixed(1) +
            '"/>'
          );
        })
        .join('') +
      '</g><circle cx="20" cy="20" r="8.5" fill="#ffd84a" stroke="rgba(0,0,0,.45)" stroke-width="1.5"/></svg>';
    (picEl || sfView).appendChild(sunEl);
    let drag = false;
    const move = function (e) {
      const r = cv.getBoundingClientRect();
      shadeSun = {
        x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
        y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)),
      };
      guideDirty = true;
      positionSun();
      if (!sunRaf)
        sunRaf = requestAnimationFrame(function () {
          sunRaf = 0;
          dragPreview = true;
          renderGuide();
        });
    };
    sunEl.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      e.stopPropagation();
      drag = true;
      try {
        sunEl.setPointerCapture(e.pointerId);
      } catch (_) {}
      sunEl.classList.add('on');
    });
    sunEl.addEventListener('pointermove', function (e) {
      if (!drag) return;
      e.preventDefault();
      move(e);
    });
    const end = function () {
      if (!drag) return;
      drag = false;
      sunEl.classList.remove('on');
      if (sunRaf) {
        cancelAnimationFrame(sunRaf);
        sunRaf = 0;
      }
      dragPreview = false;
      gradFollowLight();
      renderGuide();
      planCommit();
    };
    sunEl.addEventListener('pointerup', end);
    sunEl.addEventListener('pointercancel', end);
    sunEl.addEventListener('keydown', function (e) {
      const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (!d) return;
      e.preventDefault();
      guideDirty = true;
      shadeSun = {
        x: Math.max(0, Math.min(1, shadeSun.x + d[0] * 0.05)),
        y: Math.max(0, Math.min(1, shadeSun.y + d[1] * 0.05)),
      };
      gradFollowLight();
      renderGuide();
      planCommit();
    });
  }
  const r = cv.getBoundingClientRect(),
    hs = picHost(),
    vr = hs.getBoundingClientRect(),
    k = picK();
  let x = (r.left - vr.left + shadeSun.x * r.width) / k,
    y = (r.top - vr.top + shadeSun.y * r.height) / k;
  x = Math.max(22, Math.min(hs.clientWidth - 22, x));
  y = Math.max(22, Math.min(hs.clientHeight - 22, y));
  sunEl.style.display = '';
  sunEl.style.left = x + 'px';
  sunEl.style.top = y + 'px';
}
/* ---- colouring along with shading ----
    Each section is finished before moving on (tones laid wet, one after another), colour by colour.
    Progress stays one tick per section (colored[]); a section part-way through its tones keeps the
    done tones as bits in tonePart: 1 = lighter tone, 2 = base, 4 = shadow (darker marker or 2nd coat). */
let tonePart = null,
  toneSteps = false;
try {
  toneSteps = localStorage.getItem('ms-tone-steps') === '1';
} catch (_) {}
// swap in a new progress array without losing ticks or part-done tones (rebuild, undo)
function setColored(c) {
  const old = tonePart && tonePart._c === colored ? tonePart : null;
  colored = c;
  if (old) {
    const P = tp();
    P.set(old.subarray(0, Math.min(old.length, P.length)));
  }
}
// after an undo in the sections editor: once a guide exists, colouring progress belongs to the guide, not the snapshot
function keepProgress(snapCol) {
  if (!assignData || !colored) {
    colored = snapCol;
    return;
  }
  const c = new Uint8Array(comps.length);
  c.set(colored.subarray(0, Math.min(colored.length, c.length)));
  setColored(c);
  // (ticks a build took off for a merge this Undo takes apart: 65-edit)
  tickBack();
}
// bring part-done tones in line with the current plan. A section whose done tones are all the plan now asks for
// (shading switched off, left flat, full light to shadows only) counts as done, but keeps its tones: when the plan
// asks for more again (shading back on, Undo) it is part-done again. A tick by hand clears the tones (done is done).
function normalizeTones() {
  if (!assignData || !colored) return;
  const P = tp();
  assignData.order.forEach(function (l) {
    if (!P[l]) return;
    const req = shadeReq(l),
      met = (P[l] & req) === req;
    if (colored[l] && !met) colored[l] = 0;
    else if (!colored[l] && met) colored[l] = 1;
  });
}
function tp() {
  if (!tonePart || tonePart._c !== colored || tonePart.length !== comps.length) {
    tonePart = new Uint8Array(comps.length);
    tonePart._c = colored;
  }
  return tonePart;
}
function shadeSec(l) {
  if (!shadeOn() || !assignData || !assignData.assign[l]) return null;
  const g = shadeGeom();
  if (!g || !shadeable(l, g)) return null;
  return shadeTones(assignData.assign[l], zshOf(l));
}
// how many of the guide's sections the photo doesn't cover, with the light from the photo (they stay flat)
function shadeOutside() {
  if (!assignData || !shadeFromPhoto()) return 0;
  const g = shadeGeom();
  if (!g) return 0;
  let n = 0;
  for (const k in assignData.assign) if (shadeWhy(+k, g, true) === 'photo') n++;
  return n;
}
// what the shading comes to over the whole guide: on (any section shaded at all: with every zone flat, or every
// section too small, there's nothing to shade, so no how-to, tone columns or tone steps), sun (shaded by the sun, so
// its handle shows), hp / hm (a shaded section whose highlight is the paper, or a lighter marker), kS / kH (the kinds
// of shadow and highlight asked for, over the shaded sections). Kept until something it depends on changes.
let _suKey = null,
  _su = null;
function shadeUse() {
  const none = { on: false, sun: false, hp: false, hm: false, gl: false, kS: {}, kH: {} };
  if (!shadeOn() || !labels || !comps) return none;
  const fp = shadeFromPhoto(),
    key = [
      assignData,
      shadeMode,
      _zshVer,
      zshMain(),
      _flatVer,
      coll,
      fp,
      fp ? [photoXf.cx, photoXf.cy, photoXf.sx, photoXf.sy, photoXf.r].join() + photoRef.w : '',
      labelPts,
    ];
  if (
    _suKey &&
    _suKey.length === key.length &&
    key.every(function (v, i) {
      return v === _suKey[i];
    })
  )
    return _su;
  const g = shadeGeom();
  if (!g) return none;
  // (gl: some section's shadow is a glaze, laid over the base once it's dry)
  const u = { on: false, sun: false, hp: false, hm: false, gl: false, kS: {}, kH: {} };
  for (const k in assignData.assign) {
    const l = +k;
    if (!shadeable(l, g, fp)) continue;
    const zs = zshOf(l);
    u.on = true;
    u.kS[zs.shadow] = 1;
    u.kH[zs.hilite] = 1;
    if (!u.gl && zs.shadow !== 'same' && shadeTones(assignData.assign[l], zs).glaze) u.gl = true;
    if (shadeMode === 'full') {
      if (zs.hilite === 'paper') u.hp = true;
      else u.hm = true;
    }
  }
  u.sun = u.on && !fp;
  _suKey = labelPts ? key : null;
  _su = u;
  return u;
}
// the tone bits a section needs: flat sections just the base
function shadeReq(l) {
  const t = shadeSec(l);
  return t ? (t.light ? 1 : 0) | 2 | (t.noShadow ? 0 : 4) : 2;
}
function stepDone(l, bits) {
  return !!colored[l] || (tp()[l] & bits) === bits;
}
// mark a step done (or undo it); the section is done once all its tones are
function stepSet(l, bits, on) {
  const P = tp(),
    req = shadeReq(l);
  if (on) {
    P[l] |= bits;
    if ((P[l] & req) === req) {
      colored[l] = 1;
      P[l] = 0;
    }
  } else {
    if (colored[l]) {
      colored[l] = 0;
      P[l] = req;
    }
    P[l] &= ~bits;
  }
}
// does pixel q belong to the part of section l this step covers?
function stepCovers(l, bits, q, sh) {
  if (!sh || !sh.V[q] || !sh.tone[l]) return true;
  const t = sh.tone[l],
    z = shadeZone(t, (sh.V[q] - 1) / 254);
  if (bits & 1) return true;
  if (bits & 2) return t.L ? z >= 1 : true;
  if (bits & 4) return z === 2;
  return true;
}
function shadeZoneLabelsFor(sh, l, minR) {
  return zoneLabelsOf(sh, l).filter(function (z) {
    return z.r >= minR;
  });
}
// the brand tag (O / C) shows on screen when the guide mixes brands or your collection does (brandsMixedIn in
// brands.js), so a guide of one brand, for someone who owns only that brand, doesn't read "E713°". Exports go by the
// guide's own markers alone (guideMixed).
let _mixKey = null,
  _mixVal = false,
  _mixColl = false;
function mixCache() {
  // (the shaded sections' own tones: each zone's kinds of highlight and shadow, none for flat ones)
  const fp = shadeFromPhoto(),
    key = [
      assignData,
      shadeMode,
      coll,
      _zshVer,
      zshMain(),
      _flatVer,
      fp,
      fp ? [photoXf.cx, photoXf.cy, photoXf.sx, photoXf.sy, photoXf.r].join() : '',
    ];
  if (
    _mixKey &&
    key.every(function (v, i) {
      return v === _mixKey[i];
    })
  )
    return;
  const b = {};
  for (const l in assignData.assign) {
    const m = assignData.assign[l];
    b[m.brand] = 1;
    if (shadeOn()) {
      const t = shadeSec(+l);
      if (t && t.light) b[t.light.brand] = 1;
      if (t && t.dark) b[t.dark.brand] = 1;
    }
  }
  _mixKey = key;
  _mixVal = Object.keys(b).length > 1;
  _mixColl = collMixed();
}
function guideMixed() {
  if (!assignData) return false;
  mixCache();
  return _mixVal;
}
function brandsMixed() {
  if (!assignData) return collMixed();
  mixCache();
  return _mixVal || _mixColl;
}
function mcode(m) {
  return (brandsMixed() ? bTag(m.brand) + ' ' : '') + m.code;
}
// as HTML: the letter is for the eye, a screen reader hears the brand's name (and for speech: msay)
function mcodeHTML(m) {
  return (
    (brandsMixed()
      ? '<span aria-hidden="true">' +
        esc(bTag(m.brand)) +
        ' </span><span class="sfsr">' +
        esc(m.brand) +
        ' </span>'
      : '') + esc(m.code)
  );
}
function msay(m) {
  return (brandsMixed() ? m.brand + ' ' : '') + m.code;
}
// "1 E69 › 2 E713 › 3 R215" (or "… › 3 2nd coat") for a colour's tones t (a section's: shadeSec; Main's if not
// given) (as HTML the letters and › are hidden from screen readers, which hear "highlight R11, base R16, shadow R28")
function toneTrio(m, html, t) {
  t = t || shadeTones(m, zshMain());
  const parts = [],
    sw = function (hex) {
      return html ? '<i style="background:' + esc(hex) + '"></i>' : '';
    },
    c = function (s) {
      return html ? esc(s) : s;
    };
  if (t.light) parts.push(sw(t.light.hex) + 'H ' + c(mcode(t.light)));
  else if (t.paper) parts.push(sw('rgb(' + t.L.join(',') + ')') + 'H paper');
  parts.push(sw(m.hex) + 'B ' + c(mcode(m)));
  if (!t.noShadow)
    parts.push(
      t.dark ? sw(t.dark.hex) + 'S ' + c(mcode(t.dark)) : sw('rgb(' + t.S.join(',') + ')') + 'S 2nd coat',
    );
  return html
    ? '<span class="sftv" aria-hidden="true">' +
        parts.join(' <span>›</span> ') +
        '</span><span class="sfsr">' +
        esc(toneSay(m, t)) +
        '</span>'
    : parts.join(' › ');
}
function toneSay(m, t) {
  t = t || shadeTones(m, zshMain());
  const p = [];
  if (t.light) p.push('highlight ' + msay(t.light));
  else if (t.paper) p.push('highlight: the paper left white');
  p.push('base ' + msay(m));
  if (!t.noShadow)
    p.push(t.dark ? 'shadow ' + msay(t.dark) + (t.glaze ? ' over the base' : '') : 'shadow: a second coat');
  return p.join(', ');
}
// the different tones a marker's shaded sections ask for (secs: its sections), by which markers go with it (sig):
// [{ t, n, z: { zone id: sections } }], most sections first. One entry with or without zones when they all agree;
// none when none of them is shaded.
function toneRows(secs) {
  const by = {},
    out = [];
  secs.forEach(function (l) {
    const t = shadeSec(l);
    if (!t) return;
    let e = by[t.sig];
    if (!e) {
      e = by[t.sig] = { t: t, n: 0, z: {} };
      out.push(e);
    }
    e.n++;
    const z = zoneOf(l);
    e.z[z] = (e.z[z] || 0) + 1;
  });
  return out.sort(function (a, b) {
    return b.n - a.n;
  });
}
// a marker's tones when its zones differ ("H Y26 / paper › B G410 › S G46"): each tone's options, at most two, then
// "+1 more"; the screen reader hears "highlight Y26 or the paper left white, ...". rows: toneRows'
function toneTrioMulti(m, rows, html) {
  if (rows.length < 2) return toneTrio(m, html, rows.length ? rows[0].t : null);
  const opts = function (f) {
      const seen = {},
        o = [];
      rows.forEach(function (r) {
        const x = f(r.t);
        if (x && !seen[x.k]) {
          seen[x.k] = 1;
          o.push(x);
        }
      });
      return o;
    },
    // (a zone whose tones have no highlight, where others' do: "—", "no highlight")
    anyH = rows.some(function (r) {
      return r.t.light || r.t.paper;
    }),
    H = opts(function (t) {
      return t.light
        ? { k: t.light.mkey, hex: t.light.hex, tx: mcode(t.light), say: msay(t.light) }
        : t.paper
          ? { k: 'paper', hex: 'rgb(' + t.L.join(',') + ')', tx: 'paper', say: 'the paper left white' }
          : anyH
            ? { k: '-', hex: t.B ? 'rgb(' + t.B.join(',') + ')' : m.hex, tx: '—', say: 'none' }
            : null;
    }),
    S = opts(function (t) {
      return t.noShadow
        ? null
        : t.dark
          ? {
              k: t.dark.mkey + (t.glaze ? 'g' : ''),
              hex: t.dark.hex,
              tx: mcode(t.dark),
              say: msay(t.dark) + (t.glaze ? ' over the base' : ''),
            }
          : { k: 'coat', hex: 'rgb(' + t.S.join(',') + ')', tx: '2nd coat', say: 'a second coat' };
    }),
    part = function (lt, o) {
      const two = o.slice(0, 2),
        more = o.length > 2 ? ' +' + (o.length - 2) + ' more' : '';
      if (!html)
        return (
          lt +
          ' ' +
          two
            .map(function (x) {
              return x.tx;
            })
            .join(' / ') +
          more
        );
      return (
        two
          .map(function (x, i) {
            return '<i style="background:' + esc(x.hex) + '"></i>' + (i ? '' : lt + ' ') + esc(x.tx);
          })
          .join(' / ') + esc(more)
      );
    },
    say = function (lt, o) {
      return (
        lt +
        ' ' +
        o
          .map(function (x) {
            return x.say;
          })
          .join(' or ')
      );
    },
    parts = [],
    sp = [];
  if (H.length) {
    parts.push(part('H', H));
    sp.push(say('highlight', H));
  }
  parts.push(html ? '<i style="background:' + esc(m.hex) + '"></i>B ' + esc(mcode(m)) : 'B ' + mcode(m));
  sp.push('base ' + msay(m));
  if (S.length) {
    parts.push(part('S', S));
    sp.push(say('shadow', S));
  }
  return html
    ? '<span class="sftv" aria-hidden="true">' +
        parts.join(' <span>›</span> ') +
        '</span><span class="sfsr">' +
        esc(sp.join(', ')) +
        '</span>'
    : parts.join(' › ');
}
// what one step asks you to do, for the focus bar
function stepText(l, bits) {
  const m = assignData.assign[l],
    t = shadeSec(l);
  if (!t || bits === shadeReq(l)) return null;
  const nm = function (x) {
    return mcode(x) + (x.name ? ' ' + x.name : '');
  };
  if (bits === 4)
    return t.dark
      ? {
          hex: t.dark.hex,
          name: 'Shadow \u00b7 ' + nm(t.dark),
          sub: t.glaze ? 'over the dry base, away from the light' : 'the side away from the light',
        }
      : {
          hex: 'rgb(' + t.S.join(',') + ')',
          name: 'Shadow \u00b7 2nd coat of ' + mcode(m),
          sub: 'the side away from the light',
        };
  if (bits === 1)
    return { hex: t.light.hex, name: 'Highlight \u00b7 ' + nm(t.light), sub: 'the whole section' };
  if (bits === 2)
    return {
      hex: m.hex,
      name: 'Base \u00b7 ' + nm(m),
      sub:
        t.coat && !toneSteps
          ? '2nd coat comes later'
          : t.glaze && !toneSteps
            ? 'the shadow goes over it later, once it\u2019s dry'
            : t.paper
              ? 'all but the lit side: leave it white, soften its edge'
              : t.light
                ? 'all but the highlight'
                : 'the whole section',
    };
  if (bits === 3)
    return {
      hex: m.hex,
      name: 'Highlight ' + mcode(t.light) + ' \u203a Base ' + mcode(m),
      sub: t.glaze ? 'the shadow goes over it later, once it\u2019s dry' : '2nd coat comes later',
    };
  return null;
}
// crisp H / S markers over the zoomed section in focus mode (drawn in the page, not into the picture, so they stay sharp)
let zoneEl = null,
  _zT = 0;
function positionZones() {
  if (!sfView || !cv) return;
  if (!zoneEl) {
    zoneEl = document.createElement('div');
    zoneEl.className = 'sfzones';
    zoneEl.setAttribute('aria-hidden', 'true');
    (picEl || sfView).appendChild(zoneEl);
  }
  const l = focusCur(),
    sh = sfmode === 'color' && focus && l > 0 && shadeOn() ? shadePrep(false) : null;
  if (!sh || !sh.tone[l]) {
    zoneEl.innerHTML = '';
    return;
  }
  if (cv.style.transition) {
    zoneEl.innerHTML = '';
    clearTimeout(_zT);
    _zT = setTimeout(positionZones, 400);
    return;
  }
  const r0 = cv.getBoundingClientRect(),
    vr = picHost().getBoundingClientRect(),
    q = picK(),
    k = r0.width / q / W,
    r = { left: vr.left + (r0.left - vr.left) / q, top: vr.top + (r0.top - vr.top) / q };
  const sb = toneSteps ? stepBits(focusPos) : 0,
    cur = sb === 1 ? 'H' : sb === 4 ? 'S' : '';
  zoneEl.innerHTML = shadeZoneLabelsFor(sh, l, 10 / k)
    .map(function (z) {
      return (
        '<span class="sfzone' +
        (toneSteps && z.tone !== cur ? ' off' : '') +
        '" style="left:' +
        (r.left - vr.left + z.x * k).toFixed(1) +
        'px;top:' +
        (r.top - vr.top + z.y * k).toFixed(1) +
        'px">' +
        z.tone +
        '</span>'
      );
    })
    .join('');
}
