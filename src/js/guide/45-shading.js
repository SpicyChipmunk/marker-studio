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
  // (paper left white is the brightest part only: about half as much as a lighter marker covers; v318.17: a blender's
  // lift the same)
  return hiOn(zs) && (zs.hilite === 'paper' || (zs.hilite === 'blender' && blenderOwned()))
    ? 0.08 + 0.18 * zs.hi
    : 0.2 + 0.28 * zs.hi;
}
// (v318.17) whether a shading record's sections have a highlight: shading Light & shadow and its Highlights not None
// (Shadows only, per zone; shadeMode 'shadow' is the whole picture's, as saved before)
function hiOn(zs) {
  return shadeMode === 'full' && !!zs && zs.hilite !== 'none';
}
// whether any shaded section of the guide has one (the how-to, the key's H column, the info line)
function shAnyHi() {
  const u = shadeUse();
  return !!(u.hp || u.hm || u.hb);
}
// (v318.17) Blender highlights: the Colorless Blender you own for a base (its own brand's first), or null; as the
// highlight it's laid first, the base over it, so the highlight is the base lifted (BLEND_LIFT of the way to white)
const BLEND_LIFT = 0.4;
function rgbHexOf(c) {
  return (
    '#' +
    c
      .map(function (v) {
        return Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0');
      })
      .join('')
  );
}
let _blendColl = null,
  _blends = [];
function blenderFor(base) {
  if (_blendColl !== coll) {
    _blendColl = coll;
    _blends = typeof sfBlenders === 'function' ? sfBlenders() : [];
  }
  return (
    _blends.find(function (m) {
      return m.brand === base.brand;
    }) ||
    _blends[0] ||
    null
  );
}
// (v318.17) leaving whole-picture Shadows only from one zone: every other record None, and every section coloured
// so far held as None (it was coloured without a highlight)
function shZonesNone(keep) {
  [0]
    .concat(
      zones.map(function (z) {
        return z.id;
      }),
    )
    .forEach(function (id) {
      if (id !== keep) zshSet(id, 'hilite', 'none');
    });
  for (const l in heldSh) {
    const h = heldSh[l];
    if (h && h.hilite !== 'none') heldSet(l, Object.assign({}, h, { hilite: 'none' }));
  }
}
function blenderOwned() {
  if (_blendColl !== coll) blenderFor({ brand: '' });
  return _blends.length > 0;
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
// (v318.15) Shading styles: each sets existing values only, shown as chosen while they all still match (within half a
// slider step). v318.16: the Shading row itself (Off · Soft · Dramatic · Rounded · Neuro), the whole picture's look:
// the mode, Main's and every zone's Roundness, Highlights and Shadows amounts, and Light from only between the sun and
// the edges (a photo's light is kept: the three amounts alone then say which style it is; Neuro is the edges).
const SH_PRESETS = [
  { k: 'soft', n: 'Soft', mode: 'full', light: 'sun', round: 0.35, hi: 0.35, lo: 0.35 },
  { k: 'dramatic', n: 'Dramatic', mode: 'full', light: 'sun', round: 0.6, hi: 0.6, lo: 0.65 },
  { k: 'rounded', n: 'Rounded', mode: 'full', light: 'sun', round: 0.9, hi: 0.5, lo: 0.6 },
  { k: 'neuro', n: 'Neuro', mode: 'full', light: 'edges', round: 0.5, hi: 0.4, lo: 0.45 },
];
// the shading records a style sets and is judged by: Main's (when shaded, or with no zones) and each shaded zone's;
// Main's when none is shaded
function shStyleRecs() {
  const ids = [];
  if (!zones.length || shadeMain) ids.push(0);
  zones.forEach(function (z) {
    if (zsh(z.id).on) ids.push(z.id);
  });
  return ids.length ? ids : [0];
}
function shPresetOn(p) {
  if (shadeMode !== p.mode) return false;
  // (v327: Photo, its amounts the page's own; the others not while it's chosen)
  if (p.k === 'photo') return shadePStyle;
  if (shadePStyle) return false;
  if (shadeFromPhoto() ? p.light === 'edges' : (shadeEdges() ? 'edges' : 'sun') !== p.light) return false;
  const near = function (a, b) {
      return Math.abs(a - b) < 0.006;
    },
    // (v318.17: Roundness isn't drawn or used with the photo's light, so it isn't asked of a photo-lit guide)
    fp = shadeFromPhoto();
  return shStyleRecs().every(function (id) {
    const zs = zsh(id);
    return (fp || near(zs.round, p.round)) && near(zs.hi, p.hi) && near(zs.lo, p.lo);
  });
}
// (v327) the Shading row's styles: on a photo-made page lit by its photo, Photo in Rounded's place (Roundness isn't
// used with the photo's light)
const PT_PRESET = { k: 'photo', n: 'Photo', mode: 'full', light: 'photo' };
function shRowPresets() {
  if (!ptAvail(0)) return SH_PRESETS;
  return SH_PRESETS.map(function (p) {
    return p.k === 'rounded' ? PT_PRESET : p;
  });
}
// the style shown as chosen, or null (Custom: shading on, amounts of your own)
function shStyleCur() {
  if (shadeMode !== 'full') return null;
  return (
    shRowPresets().find(function (p) {
      return shPresetOn(p);
    }) || null
  );
}
function shPresetApply(k) {
  if (k === 'photo') return ptAvail(0) ? ptStyleApply() : false;
  const p = SH_PRESETS.find(function (x) {
    return x.k === k;
  });
  if (!p) return false;
  shadePStyle = false;
  shadeMode = p.mode;
  if (p.light === 'edges') shadeLight = 'edges';
  else if (shadeLight === 'edges') shadeLight = 'sun';
  [0]
    .concat(
      zones.map(function (z) {
        return z.id;
      }),
    )
    .forEach(function (id) {
      zshSet(id, 'round', p.round);
      zshSet(id, 'hi', p.hi);
      zshSet(id, 'lo', p.lo);
    });
  return true;
}
// (v318.15) Light from the edges: each section darker along its lines, lighter in its middle (edgeShadeField)
function shadeEdges() {
  return shadeLight === 'edges' && !shadeFromPhoto();
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
// why a section isn't shaded ('' when it is): not in the guide ('none'), too small ('small'), the page's background
// at a quarter of the picture or more ('bg'), left flat itself ('flat'), in a zone that's flat ('zone'), or outside the
// photo the light comes from ('photo')
function shadeWhy(l, g, fp, noEven) {
  if (!(assignData && assignData.assign[l])) return 'none';
  // (SH_MINR in the guide's own pixels, as up to v302: v303 took it on the picture as it came, so a page downloaded at
  // 400 pixels, enlarged, had half the shaded sections of the same page photographed, v304)
  if (g.mx[l] < SH_MINR) return 'small';
  // (a big shape inside the page is shaded; only the background that size is left flat. v303 left any section of a
  // quarter of the picture flat as "too small", v304)
  if (g.ar[l] >= 0.25 * W * H && shadeBgLike(l)) return 'bg';
  if (shadeFlat[l]) return 'flat';
  if (!zshOf(l).on) return 'zone';
  if ((fp === undefined ? shadeFromPhoto() : fp) && !photoCovers(l)) return 'photo';
  // (v327: photo tones that wouldn't bring it nearer the photo: flat. Not asked while the light's field is made, which
  // photo tones are worked out from: noEven)
  if (!noEven && ptFlat(l)) return 'even';
  return '';
}
// is a background-sized section the page's background? The background itself, a section touching the picture's edge,
// or the paper inside a frame drawn round the page: across most of the picture both ways, but filling under half of
// its box, as the drawing is inside it (a big shape fills most of its box), v304
function shadeBgLike(l) {
  const c = comps[l];
  if (!c || c.bg || c.bpx > 0 || c.x0 == null) return true;
  const bw = c.x1 - c.x0 + 1,
    bh = c.y1 - c.y0 + 1;
  return bw >= 0.75 * W && bh >= 0.75 * H && c.area < 0.5 * bw * bh;
}
// is this section shaded at all? (fp: whether the light comes from the photo, when the caller knows)
function shadeable(l, g, fp, noEven) {
  return !shadeWhy(l, g, fp, noEven);
}
// shade value per pixel, 0 = facing the sun .. 1 = deepest shadow; 0 in the array means "not shaded"
function shadeField(step) {
  const g = shadeGeom();
  if (!g) return null;
  // (v327) a guide lit by its photo, opened a moment ago, whose photo isn't read yet: no tones until it is (it had
  // been lit by the sun meanwhile, on the screen and in a print or share made then)
  if (shadeWaitsPhoto()) return null;
  step = step || 1;
  const fromPhoto = shadeFromPhoto(),
    key = [
      fromPhoto ? 'photo' : shadeEdges() ? 'edges' : 'sun',
      shadeSun.x.toFixed(4),
      shadeSun.y.toFixed(4),
      shadeRound.toFixed(3),
      's' + step,
      _flatVer,
      // (the zones' membership, Shade and Roundness: 34-zones; Main's own flat choice)
      _zshGeoVer,
      zones.length && !shadeMain ? 'mflat' : '',
      fromPhoto
        ? [photoXf.cx, photoXf.cy, photoXf.sx, photoXf.sy, photoXf.r, photoRef.w, photoRef.url.length].join(
            ',',
          )
        : '',
    ].join('|');
  const same = function (k) {
    return (
      shadeV &&
      shadeVKey === k &&
      shadeV._g === g &&
      shadeV._a === assignData &&
      (!fromPhoto || shadeV._p === photoRef)
    );
  };
  if (same(key)) return shadeV;
  // (a preview asked for while the field at full size is still the one wanted, as when the Highlights or Shadows
  // slider moves: that one does, every pixel of it, v304)
  if (step > 1 && same(key.replace('|s' + step + '|', '|s1|'))) return shadeV;
  if (fromPhoto) return photoShadeField(g, step, key);
  if (shadeEdges()) return edgeShadeField(g, step, key);
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
    if (!shadeable(l, g, false, true)) continue;
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
// (v318.15) Light from the edges, as neurographic drawings are rounded: each section darker along its outline and lighter
// in its middle. e is how near a pixel is to the section's edge (1 on the line, 0 at the point farthest in: the label's;
// from the distances worked out for the labels, in 1/8 px), the tone 0.08 + 0.9·e^k, k = 3 − 2·Roundness: at 0.5 (k 2)
// the tones take about the shares of a round section they do with the sun (the share inside e is e²); rounder, the
// shadow reaches further in. A corner fills where the bands from its two sides meet. Highlights and Shadows move the
// handovers (shT2, shT3) as with the sun.
function edgeShadeField(g, step, key) {
  const n = W * H,
    K = comps.length,
    ok = new Uint8Array(K),
    ie = new Float64Array(K),
    kk = new Float64Array(K);
  for (let l = 1; l < K; l++) {
    if (!shadeable(l, g, false, true)) continue;
    ok[l] = 1;
    ie[l] = 1 / (8 * Math.max(1, g.mx[l]));
    kk[l] = 3 - 2 * zshOf(l).round;
  }
  const V = shadeV && shadeV.length === n ? shadeV : new Uint8Array(n),
    Dq = g.D;
  for (let y = 0; y < H; y += step) {
    const ro = y * W;
    for (let x = 0; x < W; x += step) {
      const q = ro + x,
        l = labels[q];
      if (l < 1 || !ok[l]) {
        V[q] = 0;
        continue;
      }
      let e = Dq[q] * ie[l];
      e = e >= 1 ? 0 : 1 - e;
      let v = 0.08 + 0.9 * Math.pow(e, kk[l]);
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
// (v327) the light should come from the photo but the photo is still being read (a guide just opened: 97-open)
function shadeWaitsPhoto() {
  return (
    !photoLightOK() &&
    !!_phPend &&
    (shadeLight === 'photo' || (shadeLight === 'auto' && zoneFamily(0) === 'photo'))
  );
}
// (v327) resolves once the photo is read (at most 6 s), for a print or share made straight after opening
function shadePhotoWait() {
  return new Promise(function (res) {
    const t0 = Date.now();
    (function f() {
      if (!shadeWaitsPhoto() || Date.now() - t0 > 6000) res();
      else setTimeout(f, 100);
    })();
  });
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
    if (!shadeable(l, g, true, true) || !C.has[l]) continue;
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
// (v327: Matched to the photo, photo tones: on a photo-made page lit by its photo, 'photo' at the end of this file)
const SHADE_SHADOW_LABEL = {
    same: 'Same colour',
    cool: 'Cooler',
    grey: 'Grey',
    photo: 'Matched to the photo',
  },
  SHADE_HILITE_LABEL = {
    same: 'Same colour',
    warm: 'Warmer',
    paper: 'Paper white',
    photo: 'Matched to the photo',
  },
  // (v318.16: the Highlights list's, with None: Shadows only, shadeMode 'shadow')
  SHADE_HILITE_LABEL_ALL = Object.assign({ blender: 'Blender (0)', none: 'None' }, SHADE_HILITE_LABEL);
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
// the grey families: Cool, Warm, Green, Neutral and Toner Grey, and Ohuhu's BGY and YGY greys, Blue Grey and Yellow
// Grey (v308; before, "Blue-Green-Yellow" and "Yellow-Green-Yellow") (not black)
function shGreyFam(m) {
  return /Grey/.test(m.fam || '');
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
  // (v318.17: a record with Highlights None has none, as Shadows only does for the whole picture)
  const full = hiOn(zs),
    key =
      famRule +
      '|' +
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
    // (v327: Matched to the photo is a section's own, photoTones: here, as for a section it can't be, Same colour)
    sStyle = zs.shadow !== 'same' && zs.shadow !== 'photo',
    paper = full && zs.hilite === 'paper',
    // (v318.17: the Colorless Blender laid first, the base over it; one you own, else Same colour's)
    blM = full && zs.hilite === 'blender' ? blenderFor(base) : null;
  let dark = null,
    glaze = false,
    light = null,
    warm = false;
  if (blM) {
    const bb = hexRgb(base.hex),
      up = bb.map(function (v) {
        return Math.round(v + (255 - v) * BLEND_LIFT);
      });
    // (the blender itself, shown as the base it lifts: its code, the lifted colour)
    const lh = rgbHexOf(up);
    light = Object.assign({}, blM, { hex: lh, lab: hexToLab(lh), blender: true });
  }
  if (!noShadow) {
    if (sStyle) {
      dark = shadeStylePick(base, coll, zs.shadow);
      glaze = !!dark;
    }
    if (!dark) dark = shadePick(base, coll, 1);
  }
  if (full && !paper && !light) {
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
    // (base's own brand, or Brands I'd buy's when it isn't one of them, v304)
    const cat = shadeBuyPool(base),
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
    if (full && !paper && !blM) {
      if (zs.hilite === 'warm' && !warm) wantLight = shadeWarmPick(base, cat);
      if (!wantLight && !light) wantLight = shadePick(base, cat, -1);
    }
  }
  const b = hexRgb(base.hex),
    coat = coatTwo(b);
  const t = {
    light: light,
    dark: dark,
    coat: !dark && !noShadow,
    noShadow: noShadow,
    wantDark: wantDark,
    wantLight: wantLight,
    glaze: glaze,
    paper: paper,
    // (v318.17) the highlight is the Colorless Blender's lift; no highlight at all (Highlights None)
    blender: !!blM,
    noHi: !full,
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
    const t = secTones(+l);
    // (v327: a section photo tones leave flat has none)
    if (!t) continue;
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
  const T = shadeLUT(),
    // (v327: the tone patches tidied, on the whole picture; a preview while a slider is dragged isn't)
    td = step === 1 ? shadeTidy(V, T) : null;
  return {
    V: td ? td.out : V,
    tone: T.tone,
    ti: T.ti,
    mix: T.mix,
    zn: T.zn,
    step: step,
    has: td ? td.has : null,
  };
}
/* ---- (v327) the tone patches tidied (docs/PLAN-v327-photo-tones.md, C) ----
    A light or shadow patch smaller than TIDY_MM across on the printed page (its area under TIDY_MM²) takes the tone
    round it: its pixels take the shade value of its border in that tone, so the drawing, the tone lines, the tone
    numbers and Colour along's coverage all follow. On a photo-made page lit by its photo, a patch thinner than
    TIDY_THIN_MM (2 · area / perimeter) too: the photo's texture. Never with the sun or the edges, whose bands along
    an outline are thin by design (Neuro's). Measured on the author's photos: today's Dramatic lit from the photo
    1,717 patches to 205, its tone lines half as long, and nearer the photo (+0.4); the sun on the line-art sample
    327-401 to 187-212. Made on a copy of the field, again whenever the field or the tones change: the field is kept
    while only the amounts change, so tidying it in place would have kept patches merged for amounts they weren't
    merged for. has[l]: which tones section l still has on the page (1 light, 4 shadow), for its steps. */
const TIDY_THIN_MM = 0.9;
// (let: the measurements try others through __mstest.shadeTune)
let TIDY_MM = 1.5;
let _tidy = null,
  _tdZ = null,
  _tdQ = null;
function shadeTidy(V, T) {
  const n = W * H,
    K = comps.length,
    thin = ppOn() && shadeFromPhoto(),
    mm = ppMmPx(W, H, paper),
    L = _lutC.list;
  // (the field's array is reused as it's made again: its key says which field it holds)
  if (
    _tidy &&
    _tidy.V === V &&
    _tidy.vk === shadeVKey &&
    _tidy.L === L &&
    _tidy.thin === thin &&
    _tidy.mm === mm &&
    _tidy.ti.length === T.ti.length &&
    _tidy.ti.every(function (v, i) {
      return v === T.ti[i];
    })
  )
    return _tidy;
  const minA = Math.pow(TIDY_MM / mm, 2),
    minT = TIDY_THIN_MM / mm,
    out = V.slice(),
    zn = T.zn,
    ti = T.ti,
    has = new Uint8Array(K);
  if (!_tdZ || _tdZ.length !== n) {
    _tdZ = new Int8Array(n);
    _tdQ = new Int32Array(n);
  }
  const Z = _tdZ,
    Q = _tdQ;
  // each pixel's tone (0 light, 1 base, 2 shadow), -1 off the shaded sections
  for (let q = 0; q < n; q++) {
    const l = labels[q],
      v = V[q];
    Z[q] = l > 0 && v && ti[l] ? zn[ti[l] * 256 + v] : -1;
  }
  for (let p = 0; p < n; p++) {
    const z = Z[p];
    if (z !== 0 && z !== 2) continue;
    const l = labels[p];
    // (a patch: its pixels, 4-connected, in one section and one tone; visited ones marked by z + 8)
    let h = 0,
      t = 0,
      per = 0;
    const nbN = [0, 0, 0],
      nbV = [0, 0, 0];
    Q[t++] = p;
    Z[p] = z + 8;
    while (h < t) {
      const q = Q[h++],
        x = q % W;
      for (let k = 0; k < 4; k++) {
        const r =
          k === 0 ? (x > 0 ? q - 1 : -1) : k === 1 ? (x < W - 1 ? q + 1 : -1) : k === 2 ? q - W : q + W;
        if (r < 0 || r >= n || labels[r] !== l || Z[r] < 0) {
          per++;
          continue;
        }
        const zr = Z[r];
        if (zr === z + 8) continue;
        if (zr === z) {
          Z[r] = z + 8;
          Q[t++] = r;
          continue;
        }
        per++;
        const zb = zr >= 8 ? zr - 8 : zr;
        nbN[zb]++;
        nbV[zb] += out[r];
      }
    }
    if (t >= minA && !(thin && (2 * t) / Math.max(1, per) < minT)) {
      has[l] |= z === 0 ? 1 : 4;
      continue;
    }
    // (into the tone its border touches most, in its own section; with none, it stays)
    let bz = -1;
    for (let k = 0; k < 3; k++) if (k !== z && nbN[k] && (bz < 0 || nbN[k] > nbN[bz])) bz = k;
    if (bz < 0) {
      has[l] |= z === 0 ? 1 : 4;
      continue;
    }
    const nv = Math.round(nbV[bz] / nbN[bz]);
    for (let i = 0; i < t; i++) {
      out[Q[i]] = nv;
      Z[Q[i]] = bz + 8;
    }
    if (bz !== 1) has[l] |= bz === 0 ? 1 : 4;
  }
  _tidy = { V: V, vk: shadeVKey, L: L, thin: thin, mm: mm, ti: Array.from(ti), out: out, has: has };
  return _tidy;
}
// (v327) which tones section l has on the page once tidied (1 light, 4 shadow), or 5 when that isn't known (no
// shading drawn yet): a tone with no part of the section left asks for no step
let _hasMemo = null;
function shadeHas(l) {
  // (worked out once for a run of calls, as normalizeTones and Colour along's steps make one a section: it's let go
  // when the run ends, so a change made after is seen)
  if (!_hasMemo) {
    const sh = shadeOn() ? shadePrep(false) : null;
    _hasMemo = { has: sh && sh.has ? sh.has : null };
    Promise.resolve().then(function () {
      _hasMemo = null;
    });
  }
  return _hasMemo.has ? _hasMemo.has[l] : 5;
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
    // (in proportion to the guide's own pixels, as up to v302: with the smallest shaded sections back to SH_MINR, an
    // enlarged picture's srcK-wide lines filled them, v304. Print passes its own)
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
        // dashed along the line: a line running more up and down than across is dashed by y, otherwise by x (by x + y,
        // a line at 45° to the corner the light comes from was drawn whole or not at all, v304). Which way it runs
        // is from how the shade value changes across it, t pixels either side within the section.
        const qc = q - t,
          qd = q - t * W,
          va = labels[qa] === l && V[qa] ? V[qa] : v,
          vc = x >= t && labels[qc] === l && V[qc] ? V[qc] : v,
          vb = labels[qb] === l && V[qb] ? V[qb] : v,
          vd = y >= t && labels[qd] === l && V[qd] ? V[qd] : v;
        if ((((Math.abs(va - vc) > Math.abs(vb - vd) ? y : x) / dash) | 0) & 1) continue;
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
// (v318.17) where H is the Colorless Blender's lift
const SHADE_HOWTO_BLEND =
  ' Where H is 0 (the Colorless Blender): the 0 on the highlight first, then B over the whole section; while it\u2019s wet, touch the 0 again to lift more. Small strokes from the light side: it pushes ink outward.';
const SHADE_HOWTO_PAPER =
  'Shading \u2014 H = highlight (the paper left white), B = base (the section\u2019s marker), S = shadow. Colour the section with B, leaving the highlight white, add S in the shadow while it\u2019s still wet, then soften the edges with B. Dashed lines and the small H and S circles on the colouring page show where each goes; the \u2600 marks where the light comes from.';
// the key's how-to line; with the light taken from the photo there is no sun to point at
// (with zones, the highlights asked for in the shaded sections: all the paper, all a lighter marker, or some of each)
function shadeHowto(noLines) {
  const u = shadeUse(),
    t =
      u.hp || u.hm || u.hb
        ? u.hp && u.hm
          ? SHADE_HOWTO_MIX
          : u.hp
            ? SHADE_HOWTO_PAPER
            : SHADE_HOWTO
        : SHADE_HOWTO2;
  // (noLines: printed without Print's Tone lines, so the circles alone, which go only where they fit, v304)
  const tl = noLines
    ? t.replace(
        /(?:The d|D)ashed lines and (?:the )?small (H and S|S) circles on the colouring page show where (each goes|the shadow starts)/,
        'The small $1 circles show where $2, where there\u2019s room',
      )
    : t;
  // (a cooler or grey shadow is a glaze: laid over the base once it's dry)
  const tg = (u.gl ? tl + SHADE_HOWTO_GLAZE : tl) + (u.hb ? SHADE_HOWTO_BLEND : '');
  return shadeFromPhoto()
    ? tg.replace('the \u2600 marks where the light comes from.', 'the light and shadow follow your photo.')
    : shadeEdges()
      ? tg.replace(
          'the \u2600 marks where the light comes from.',
          'S goes along each section\u2019s lines and into its corners, H in its middle.',
        )
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
            : why === 'even'
              ? 'Its tones wouldn’t be closer to the photo — one flat colour'
              : why === 'bg'
                ? 'Background-sized — one flat colour'
                : 'Too small to shade — one flat colour') +
      '</div>'
    );
  const m = assignData.assign[l],
    t = secTones(l) || shadeTones(m, zshOf(l)),
    sw = function (hex) {
      return '<i style="background:' + esc(hex) + '"></i>';
    },
    parts = [];
  if (t.light) parts.push(sw(t.light.hex) + 'H ' + mcodeEye(t.light));
  else if (t.paper) parts.push(sw('rgb(' + t.L.join(',') + ')') + 'H paper');
  parts.push(sw(m.hex) + 'B ' + mcodeEye(m));
  if (!t.noShadow)
    parts.push(
      t.dark ? sw(t.dark.hex) + 'S ' + mcodeEye(t.dark) : sw('rgb(' + t.S.join(',') + ')') + 'S 2nd coat',
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
    // (v327: a highlight Matched to the photo left out is one that wouldn't be closer, not one you lack)
    const pz = zshOf(l);
    if (!t.noHi && !t.light && !t.paper && !(pz.hilite === 'photo' && ptOn(pz, l))) once(noLight, m.code);
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
    // (v318.17: by what the shaded sections have: with Highlights None somewhere, or the blender)
    _any = shAnyHi(),
    _hs = _any && hK !== 'paper' && hK !== 'blender',
    _all =
      !sK || (!hK && _any)
        ? 'the highlights and shadows each zone asks for, from markers you own'
        : sK === 'same' && hK === 'same'
          ? _hs
            ? 'lighter and darker markers you own'
            : 'darker markers you own'
          : (_hs
              ? (hK === 'warm' ? 'warmer highlights' : 'lighter markers') + ' and '
              : _any && hK === 'blender'
                ? 'blender highlights and '
                : '') +
            (sK === 'cool' ? 'cooler' : sK === 'grey' ? 'grey' : 'darker') +
            ' shadows from markers you own',
    fsK = Object.keys(fsKind);
  if (!coats.length && !noLight.length && !fellS.length && !fellH.length && !w.length)
    return sK === 'photo' && hK === 'photo'
      ? '<div class="sfshnote">Highlights and shadows matched to the photo, from markers you own.</div>'
      : '<div class="sfshnote">All ' + n + ' colours have ' + _all + '.</div>';
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
  // (v306: a Gradient whose markers were picked before shading was on, which shading-aware picks would shade more of,
  // says so first, with Pick shadeable ones)
  const offer = gradShadeOffer();
  const head = offer
    ? offer.ok +
      ' of ' +
      offer.n +
      ' can be shaded \u00b7 <button type="button" id="sfShPickGo" class="sfonelb">Pick shadeable ones</button>'
    : w.length
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
          const lab = esc((mixed ? bTag(m.brand) + ' ' : '') + capCode(m));
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
/* U7 (v306): a Gradient laid before shading was on picked its markers without it, and turning shading on doesn't
   pick again by itself (gradShpOn). The Shading tab says how many of its colours shade, "8 of 16 can be shaded ·
   Pick shadeable ones", which lays it again with shading-aware picks as one Undo step. Only for the Gradients that
   pick that way (one marker to a band, from your markers), only when that would pick more that shade, and gone once
   they were picked with shading on. It leads the shading note (shadeNoteHTML). */
let _shOffer = null;
function gradShadeOffer() {
  if (!shadeOn() || sfmode !== 'guide') return null;
  const ids = [];
  let n = 0,
    ok = 0;
  zoneIds().forEach(function (id) {
    if (zoneFamily(id) !== 'gradient' || gradShpOf(id)) return;
    const zs = zsh(id),
      seen = {};
    let now = 0,
      k = 0,
      could = -1;
    zoneSecs(id).forEach(function (l) {
      const m = assignData.assign[l];
      if (!m || seen[m.mkey]) return;
      seen[m.mkey] = 1;
      k++;
      if (gradShadeOK(m, zs)) now++;
    });
    if (now >= k) return;
    zoneWith(id, function () {
      if (!gradShpOn()) return;
      const N = zoneList().length,
        src = poolSource(Math.min(limitN, N), true),
        M = gradCount(src, N).M;
      if (src.seeded || gradGroupSize(look, M, N, gradShape) !== 1) return;
      // (how many the shading-aware picks would shade: worked out again only when something they go by changed)
      const key = JSON.stringify([zLiveSt(), N, coll.length, planFilt(), shadeMode, zs]);
      if (_shOffer && _shOffer.key === key) {
        could = _shOffer.n;
        return;
      }
      // (the same picks the Gradient makes: gradPickSet, from the same markers)
      could = gradPickSet(
        src.items,
        M,
        1,
        gradSeed > 0 ? seededRandom(gradSeed) : null,
        zs,
        gradV8() ? emphasis : null,
      ).picks.filter(function (m) {
        return gradShadeOK(m, zs);
      }).length;
      _shOffer = { key: key, n: could };
    });
    if (could <= now) return;
    ids.push(id);
    n += k;
    ok += now;
  });
  return ids.length ? { ids: ids, n: n, ok: ok } : null;
}
function gradShadePick() {
  const o = gradShadeOffer();
  if (!o) return;
  planWhy = 'Shadeable markers picked';
  reassign(o.ids);
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
    (gradShape === 'radial' || gradShape === 'around' || gradShape === 'rings') &&
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
  // (Around goes round the same centre, v305)
  radEl.setAttribute(
    'aria-label',
    gradShape === 'around'
      ? 'Centre \u2014 drag, or use the arrow keys, to move what the colours go round'
      : gradShape === 'rings'
        ? 'Centre \u2014 drag, or use the arrow keys, to the section the rings start from'
        : 'Radial centre \u2014 drag, or use the arrow keys, to move where the rings start',
  );
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
      '</g><circle cx="20" cy="20" r="8.5" fill="#ffd84a" fill-opacity=".45" stroke="rgba(0,0,0,.45)" stroke-width="1.5"/></svg>';
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
  return secTones(l);
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
  const none = { on: false, sun: false, hp: false, hm: false, hb: false, gl: false, kS: {}, kH: {} };
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
      shadeLight,
      fp ? [photoXf.cx, photoXf.cy, photoXf.sx, photoXf.sy, photoXf.r].join() + photoRef.w : '',
      labelPts,
      // (a coloured section's held Highlights and Shadows, noted or let go as it's ticked and unticked, v304)
      _heldVer,
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
  const u = { on: false, sun: false, hp: false, hm: false, hb: false, gl: false, kS: {}, kH: {} };
  for (const k in assignData.assign) {
    const l = +k;
    if (!shadeable(l, g, fp)) continue;
    const zs = zshOf(l),
      // (Matched to the photo without the photo's light is drawn as Same colour, v327)
      po = ptOn(zs, l);
    u.on = true;
    u.kS[zs.shadow === 'photo' && !po ? 'same' : zs.shadow] = 1;
    if (!u.gl && zs.shadow !== 'same') {
      const t = secTones(l);
      if (t && t.glaze) u.gl = true;
    }
    // (v318.17: only the sections that have a highlight say what kind; the blender's lift, one you own, its own)
    if (hiOn(zs)) {
      const bl = zs.hilite === 'blender' && blenderOwned(),
        hk = (zs.hilite === 'blender' && !bl) || (zs.hilite === 'photo' && !po) ? 'same' : zs.hilite;
      u.kH[hk] = 1;
      if (hk === 'paper') u.hp = true;
      else if (bl) u.hb = true;
      else u.hm = true;
    }
  }
  u.sun = u.on && !fp && !shadeEdges();
  _suKey = labelPts ? key : null;
  _su = u;
  return u;
}
// the tone bits a section needs: flat sections just the base
function shadeReq(l) {
  const t = shadeSec(l);
  if (!t) return 2;
  // (v327: a tone none of the section takes on the page, once tidied, isn't a step: a glaze over nothing)
  const h = shadeHas(l);
  return (t.light && h & 1 ? 1 : 0) | 2 | (!t.noShadow && h & 4 ? 4 : 0);
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
      // (which sections are shaded, and a coloured section's held Highlights and Shadows, v304)
      labelPts,
      _heldVer,
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
// (v318.21: the code on your cap, with a * when another marker in the guide shows the same code: capLabel)
function mcode(m) {
  return (brandsMixed() ? bTag(m.brand) + ' ' : '') + capLabel(m);
}
// (v307) the brand as a badge for the eye, as Colour along's rows show it (hidden from screen readers), or ''
function mbadge(m) {
  return brandsMixed() ? '<b class="btag" aria-hidden="true">' + esc(bTag(m.brand)) + '</b> ' : '';
}
// as HTML: the badge is for the eye, a screen reader hears the brand's name (and for speech: msay). v307: the letter
// was bare ("O R46"), and read out as a letter
function mcodeHTML(m) {
  return (
    (brandsMixed() ? mbadge(m) + '<span class="sfsr">' + esc(m.brand) + ' </span>' : '') +
    esc(capCode(m)) +
    (capStar(m) ? '<span aria-hidden="true">*</span><span class="sfsr">, your older cap,</span>' : '')
  );
}
// (for something hidden from screen readers, which hear msay's words elsewhere: the badge and the code)
function mcodeEye(m) {
  return mbadge(m) + esc(capLabel(m));
}
function msay(m) {
  return (brandsMixed() ? m.brand + ' ' : '') + capCode(m) + (capStar(m) ? ', your older cap' : '');
}
/* (v306) Same code, two brands. 18 of Ben's codes are both an Ohuhu and a Copic marker (Y26 is Ohuhu Light Gold and
   Copic Mustard), and a guide can use both: a Gradient at one marker per section, Random, zones each laying their
   own, Change colour, or a shading partner. Nothing is moved apart (the nearest other marker was always clearly
   worse); instead the two are marked wherever you pick a marker up: a "2 brands" chip on Colour along's rows, a filled
   brand tag on the labels and in the PDF key, "Not the Ohuhu Y26" in Focus mode and a line in Change colour. Worked
   out from the guide as it is shown (its sections, every zone's, and with shading on each section's highlight and
   shadow), so a guide saved before v306 gets the marks too, and nothing new is saved. */
function codeNorm(c) {
  return String(c == null ? '' : c)
    .toUpperCase()
    .replace(/[-.\s]/g, '');
}
// { b: {marker key: [the guide's markers of the same code in another brand]}, s: {marker key: [the same brand's]} },
// for every such marker in the guide. (v318.21) By the code on your cap (caps.js): an older cap's R22, RV17 now, and
// the R22 of now, both Ohuhu, are two markers that show the same code: the older cap's labels carry a *, and both
// are named by their caps' names, "R22 Ballet Pink cap", where the code alone would leave you to guess
function sameCodeScan() {
  const by = {},
    out = {},
    same = {};
  if (!assignData) return { b: out, s: same };
  const put = function (m) {
      if (!m || !m.mkey || !m.code) return;
      const k = codeNorm(capCode(m));
      (by[k] || (by[k] = {}))[m.mkey] = m;
    },
    sh = shadeOn();
  for (const l in assignData.assign) {
    put(assignData.assign[l]);
    if (sh) {
      const t = shadeSec(+l);
      if (t) {
        put(t.light);
        put(t.dark);
      }
    }
  }
  for (const k in by) {
    const ms = Object.keys(by[k]).map(function (x) {
      return by[k][x];
    });
    if (ms.length < 2) continue;
    ms.forEach(function (m) {
      const o = ms.filter(function (x) {
          return x.brand !== m.brand;
        }),
        // (other markers, by their codes now: the same marker held twice isn't two)
        s = ms.filter(function (x) {
          return x.brand === m.brand && x.code !== m.code;
        });
      if (o.length) out[m.mkey] = o;
      if (s.length) same[m.mkey] = s;
    });
  }
  return { b: out, s: same };
}
// (worked out once for everything drawn in one go: every label asks. Forgotten at each redraw of the picture, where
// a change to the markers always ends, and once the task that asked is over)
let _scMemo = null;
function sameCodes() {
  if (_scMemo && _scMemo.a === assignData) return _scMemo.v;
  const v = sameCodeScan();
  _scMemo = { a: assignData, v: v };
  setTimeout(function () {
    _scMemo = null;
  }, 0);
  return v;
}
function sameCodeReset() {
  _scMemo = null;
}
// the guide's other markers with m's code (another brand), or null
function sameOf(m) {
  const o = m && assignData ? sameCodes().b[m.mkey] : null;
  return o && o.length ? o : null;
}
// (v318.21) the guide's other markers of m's brand that show the same code (an older cap's and one of now), or null
function capSame(m) {
  // (a marker as the guide holds it, or by its index or key: caps.js capIdx)
  const k = m == null ? null : typeof m === 'object' ? m.mkey : capIdx(m) != null ? mkey(capIdx(m)) : null,
    o = k && assignData ? sameCodes().s[k] : null;
  return o && o.length ? o : null;
}
// an older cap's code shown where another marker in the guide shows the same: its * (the labels, keys, rows)
function capStar(m) {
  return !!capSame(m) && capIsOld(m);
}
function capLabel(m) {
  return capCode(m) + (capStar(m) ? '*' : '');
}
// (v318.22 debug) the labels of a change from marker a to b, said once it's made: where the two show one code (an older
// cap's R22, RV17 now, and the R22 of now) the * may have gone with a, so each is named by its cap's name as well.
// "Replaced R22 with R22" had been said
function capPair(a, b) {
  if (a && b && a.mkey !== b.mkey && codeNorm(capCode(a)) === codeNorm(capCode(b)))
    return [capLabel(a) + ' ' + capName(a), capLabel(b) + ' ' + capName(b), true];
  return [capLabel(a), capLabel(b), false];
}
// a key's name for a marker: your cap's, and an older cap's code as it is now ("Rose Red, now R213")
function capKeyName(m) {
  const n = capName(m),
    w = capNow(m);
  return n + (w ? (n ? ', ' : '') + w : '');
}
// "Ohuhu Y26" (the others with m's code), or ''; (v318.21) of the same brand, by their caps: "R22 Ballet Pink cap"
function sameName(m) {
  const o = sameOf(m),
    s = capSame(m);
  return []
    .concat(
      o
        ? o.map(function (x) {
            return x.brand + ' ' + capLabel(x);
          })
        : [],
      s
        ? s.map(function (x) {
            return capLabel(x) + ' ' + capName(x) + ' cap';
          })
        : [],
    )
    .join(' or ');
}
// "1 E69 › 2 E713 › 3 R215" (or "… › 3 2nd coat") for a colour's tones t (a section's: shadeSec; Main's if not
// given) (as HTML the letters and › are hidden from screen readers, which hear "highlight R11, base R16, shadow R28")
function toneTrio(m, html, t) {
  t = t || shadeTones(m, zshMain());
  const parts = [],
    sw = function (hex) {
      return html ? '<i style="background:' + esc(hex) + '"></i>' : '';
    },
    c = function (x) {
      return html ? mcodeEye(x) : mcode(x);
    };
  if (t.light) parts.push(sw(t.light.hex) + 'H ' + c(t.light));
  else if (t.paper) parts.push(sw('rgb(' + t.L.join(',') + ')') + 'H paper');
  parts.push(sw(m.hex) + 'B ' + c(m));
  if (!t.noShadow)
    parts.push(t.dark ? sw(t.dark.hex) + 'S ' + c(t.dark) : sw('rgb(' + t.S.join(',') + ')') + 'S 2nd coat');
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
// (v327) what a marker's line of tones is, where it has more than one (rows: toneRows'): by its zones when they
// differ, and with photo tones' Two tone sets by its set (its sections' labels carry the prime: E415′), or "as
// coloured" for sections that keep what they were coloured with
function toneRowName(x, rows, m) {
  const ids = zoneIds().filter(function (id) {
      return x.z[id];
    }),
    zk = function (r) {
      return Object.keys(r.z).sort().join(',');
    },
    zDiff =
      zones.length > 0 &&
      rows.some(function (r) {
        return zk(r) !== zk(x);
      }),
    sets = rows.some(function (r) {
      return r.t.set === 1 || r.t.held;
    }),
    zn = ids
      .map(function (id) {
        return zoneName(id);
      })
      .join(', '),
    st = x.t.held ? 'as coloured' : sets ? capLabel(m) + (x.t.set === 1 ? '′' : '') : '';
  return [st, zDiff || !st ? 'in ' + zn : ''].filter(Boolean).join(' ');
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
        ? { k: t.light.mkey, hex: t.light.hex, tx: mcode(t.light), th: mcodeEye(t.light), say: msay(t.light) }
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
              th: mcodeEye(t.dark),
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
            return (
              '<i style="background:' + esc(x.hex) + '"></i>' + (i ? '' : lt + ' ') + (x.th || esc(x.tx))
            );
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
  parts.push(html ? '<i style="background:' + esc(m.hex) + '"></i>B ' + mcodeEye(m) : 'B ' + mcode(m));
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
// what one step asks you to do, for the focus bar: name as text, nameH with the brand as a badge, say for a screen
// reader (the brand's name: v307)
function stepText(l, bits) {
  const r = stepText1(l, bits, mcode, false);
  if (r) {
    r.nameH = stepText1(l, bits, mcodeEye, true).name;
    r.say = stepText1(l, bits, msay, false).name;
  }
  return r;
}
function stepText1(l, bits, cd, html) {
  const m = assignData.assign[l],
    t = shadeSec(l);
  if (!t || bits === shadeReq(l)) return null;
  const nm = function (x) {
    return cd(x) + (capName(x) ? ' ' + (html ? esc(capName(x)) : capName(x)) : '');
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
          name: 'Shadow \u00b7 2nd coat of ' + cd(m),
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
      name: 'Highlight ' + cd(t.light) + (html ? ' \u203a Base ' : ' \u203a Base ') + cd(m),
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

/* ---- (v327) Photo tones: Matched to the photo (docs/PLAN-v327-photo-tones.md, B) ----
    On a photo-made page lit by its photo, in a zone that uses the Photo pattern, Highlights and Shadows can be
    Matched to the photo: each marker of the page gets one highlight and one shadow (two with Two tone sets, each
    section the one that fits it), chosen for the photo's own light and dark parts of its sections: a highlight a
    lighter marker of its colour family or a close hue (as Same colour's), laid under the whole section; a shadow a
    marker laid over the base (a glaze), 4 or more darker. From the page's own markers and up to PT_EXTRA of your
    others, each only when it brings the tones clearly nearer. A section whose tones wouldn't bring it nearer the
    photo by PT_MIN_GAIN stays flat ('even'). Measured on the author's 17 photos (in the app, as drawn): today's Same
    colour lit by the photo +1.7 over flat, Matched to the photo +4.2 (shadows only) with 392 markers; +2.1 and +12.5
    with Honolulu 72; never worse than flat.
    Worked out from samples of each section (PT_STEP apart, at most PT_SAMP): the photo's colour there and the light
    field's value, so the amounts can be tried without the field again (the field doesn't depend on them). Choices by
    the parts' mean colours; a section's flat-or-not, and the Photo style's amounts, by the samples themselves.
    Sections with ink keep what they were coloured with (as heldSh keeps their kinds): the highlight once there's ink
    on it, the shadow once the shadow is on the paper (_ptHeld, saved with the page: pp.th). The markers added are
    kept while what they were chosen for is the same (pp.tx), so a marker bought doesn't reshuffle a guide being
    coloured; tapping Photo again chooses afresh. */
const PT_EXTRA = 4,
  PT_STEP = 4,
  PT_SAMP = 80,
  PT_HI = [0.5, 0.65],
  PT_LO = [0.65, 0.75, 0.85, 1],
  // (when the Photo style can't try them: the best fixed pair measured)
  PT_HI0 = 0.5,
  PT_LO0 = 0.85;
// (let: the measurements try others through __mstest.shadeTune)
let PT_MIN_GAIN = 0.1,
  // (each marker added must bring the page's samples this much nearer the photo, all told: the first one often does,
  // a fourth seldom. Measured: by the toned parts' own error instead, a fourth was nearly always taken)
  PT_EXTRA_MIN = 0.01;
// the tunable numbers, for the measurements (scratch scripts) through __mstest.shadeTune
function shadeTune(o) {
  if (o) {
    if (o.tidyMm != null) TIDY_MM = o.tidyMm;
    if (o.extraMin != null) PT_EXTRA_MIN = o.extraMin;
    if (o.minGain != null) PT_MIN_GAIN = o.minGain;
    _tidy = null;
    _pt = null;
    _ptMemo = null;
    _ptX = null;
  }
  return { tidyMm: TIDY_MM, extraMin: PT_EXTRA_MIN, minGain: PT_MIN_GAIN };
}
// Two tone sets per marker (the whole picture's); the Photo style chosen (its amounts the page's own)
let shadeSets = false,
  shadePStyle = false;
let _pt = null, // { key, tone: { section: tones or null (flat) }, flat, extras }
  _ptS = null, // the samples: { key, s: { section: Float32Array [L, a, b, v] × n } }
  _ptMemo = null,
  _ptHeld = {}, // { section: { L: mkey or '', S: mkey or '' } }
  _ptX = null, // the markers added: { k: what they were chosen for, x: [mkeys] }
  _ptAutoK = '',
  _ptForce = false;
const _ptT = new Map(), // tones objects kept by what they are, so the drawing's caches keep them
  _ptZs = new WeakMap();
// whether a zone's sections can have photo tones: a photo-made page lit by its photo, the zone's pattern the Photo one
function ptAvail(id) {
  return typeof ppOn === 'function' && ppOn() && shadeFromPhoto() && zoneFamily(id || 0) === 'photo';
}
// whether section l's shading (zs) is Matched to the photo, and can be
function ptOn(zs, l) {
  return (zs.shadow === 'photo' || zs.hilite === 'photo') && ptAvail(zones.length ? zoneOf(l) : 0);
}
// a section's tones: its photo tones (null: flat), else its marker's in its zone's shading. m: another marker than
// the plan's (Gradient's picks, 30-palette-assign), whose are the marker's
function secTones(l, m) {
  const A = assignData && assignData.assign,
    b = m || (A && A[l]);
  if (!b) return null;
  const zs = zshOf(l);
  if (A && A[l] === b && ptOn(zs, l)) {
    const r = ptGet();
    if (r && l in r.tone) return r.tone[l];
  }
  return shadeTones(b, zs);
}
// (photo tones would leave it flat)
function ptFlat(l) {
  if (!assignData || !assignData.assign[l]) return false;
  const zs = zshOf(l);
  if (!ptOn(zs, l)) return false;
  const r = ptGet();
  return !!r && l in r.tone && r.tone[l] === null;
}
// the zone's shading with the photo's kinds as Same colour: the base and the kinds that aren't the photo's
function ptBaseZs(zs) {
  let z = _ptZs.get(zs);
  if (!z) {
    z = Object.assign({}, zs, {
      shadow: zs.shadow === 'photo' ? 'same' : zs.shadow,
      hilite: zs.hilite === 'photo' ? 'same' : zs.hilite,
    });
    _ptZs.set(zs, z);
  }
  return z;
}
// one section's samples: the photo's colour (L*a*b*) and the light's value, at most PT_SAMP of them; worked out
// again when the field, the plan or the photo change
function ptSamples() {
  const V = shadeField(1);
  if (!V || !photoRef || !photoXf) return null;
  const A = assignData.assign,
    key = shadeVKey + '|' + _ptAssignSig();
  if (_ptS && _ptS.key === key && _ptS.V === V) return _ptS;
  const g = shadeGeom(),
    X = photoXf,
    cs = Math.cos(X.r),
    sn = Math.sin(X.r),
    pw = photoRef.w,
    ph = photoRef.h,
    d = photoRef.data,
    K = comps.length,
    cnt = new Uint32Array(K),
    lists = new Array(K);
  // (how many on the grid each section has, so the ones kept are spread over it)
  for (let y = 0; y < H; y += PT_STEP)
    for (let x = 0; x < W; x += PT_STEP) {
      const l = labels[y * W + x];
      if (l > 0 && A[l] && V[y * W + x]) cnt[l]++;
    }
  const every = new Uint32Array(K),
    seen = new Uint32Array(K),
    got = new Uint32Array(K);
  for (const k in A) {
    const l = +k;
    if (!cnt[l] || !ptOn(zshOf(l), l) || !shadeable(l, g, true, true)) continue;
    // (every so many on the grid, so the ones kept spread over the whole section, not its top)
    every[l] = Math.max(1, Math.ceil(cnt[l] / PT_SAMP));
    lists[l] = new Float32Array(Math.min(cnt[l], PT_SAMP + 1) * 4);
  }
  for (let y = 0; y < H; y += PT_STEP)
    for (let x = 0; x < W; x += PT_STEP) {
      const q = y * W + x,
        l = labels[q];
      if (l < 1 || !lists[l] || !V[q]) continue;
      if (seen[l]++ % every[l] || got[l] * 4 >= lists[l].length) continue;
      const dx = x + 0.5 - X.cx,
        dy = y + 0.5 - X.cy,
        px = Math.floor((dx * cs + dy * sn) / X.sx + pw / 2),
        py = Math.floor((-dx * sn + dy * cs) / X.sy + ph / 2);
      if (px < 0 || py < 0 || px >= pw || py >= ph) continue;
      const j = (py * pw + px) * 4,
        lab = rgbLab(d[j], d[j + 1], d[j + 2]),
        o = got[l]++ * 4;
      lists[l][o] = lab[0];
      lists[l][o + 1] = lab[1];
      lists[l][o + 2] = lab[2];
      lists[l][o + 3] = (V[q] - 1) / 254;
    }
  const S = {};
  for (let l = 1; l < K; l++) if (lists[l] && got[l]) S[l] = lists[l].subarray(0, got[l] * 4);
  _ptS = { key: key, V: V, s: S };
  return _ptS;
}
// (the plan's markers by section, as a key)
function _ptAssignSig() {
  const A = assignData.assign,
    o = [];
  for (const l in A) o.push(l + ':' + A[l].mkey);
  return o.join(',');
}
// a marker laid over the base, as it's drawn (shadeGlaze), in L*a*b*
const _ptGl = new Map();
function ptGlaze(b, m) {
  const k = b.mkey + '>' + m.mkey;
  let v = _ptGl.get(k);
  if (!v) {
    v = shRgbLab(shadeGlaze(hexRgb(b.hex), m));
    _ptGl.set(k, v);
  }
  return v;
}
function ptLab(m) {
  return m.lab || (m.lab = hexToLab(m.hex));
}
// may m be base b's highlight (Same colour's test: 4 or more lighter, its colour family or a close hue)
function ptLightOK(b, m) {
  const bl = ptLab(b),
    ml = ptLab(m);
  if (m.mkey === b.mkey || ml[0] - bl[0] < 4) return false;
  const fv = famVal(b.code),
    f = famVal(m.code);
  return !!(fv && f && m.brand === b.brand && f.fam === fv.fam) || _hueOK(bl, ml);
}
// The choice, for the amounts each zone has (amt: { zone id: [hi, lo] } to try others): for every section that's
// Matched to the photo, its tones or null (flat), and the samples' error with them. extras: the markers added (null:
// chosen here). Returns { tone, err, extras, nFlat }.
function ptChoose(S, amt, extras) {
  if (extras) return _ptChoose(S, amt, extras);
  // (the markers added: the ones that would help the toned parts most, in turn, each kept while it brings the page
  // PT_EXTRA_MIN nearer the photo)
  const order = _ptChoose(S, amt, null).extras;
  let best = _ptChoose(S, amt, []),
    use = [];
  for (let i = 0; i < order.length; i++) {
    const r = _ptChoose(S, amt, use.concat([order[i]]));
    if (best.err <= 0 || (best.err - r.err) / best.err < PT_EXTRA_MIN) break;
    best = r;
    use = use.concat([order[i]]);
  }
  return best;
}
function _ptChoose(S, amt, extras) {
  const A = assignData.assign,
    page = {},
    groups = new Map(),
    sec = [];
  for (const l in A) page[A[l].mkey] = A[l];
  // each section's samples in its tones, by the zone's amounts (as shadeZone hands them over)
  for (const k in S) {
    const l = +k,
      b = A[l],
      zs = zshOf(l),
      zid = zones.length ? zoneOf(l) : 0,
      a = amt && amt[zid],
      zz = a ? Object.assign({}, zs, { hi: a[0], lo: a[1] }) : zs,
      T2 = shT2(zz),
      T3 = shT3(zz),
      hiP = zs.hilite === 'photo' && hiOn(zs),
      shP = zs.shadow === 'photo',
      sm = S[k],
      n = sm.length / 4,
      part = new Uint8Array(n),
      sum = [
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ];
    // (a section whose base is near-black has no shadow: 45-shading noShadow)
    const noS = ptLab(b)[0] < 28;
    for (let i = 0; i < n; i++) {
      const v = sm[i * 4 + 3],
        z = v >= T3 && !noS ? 2 : v < T2 ? 0 : 1;
      part[i] = z;
      const s = sum[z];
      s[0] += sm[i * 4];
      s[1] += sm[i * 4 + 1];
      s[2] += sm[i * 4 + 2];
      s[3]++;
    }
    const gk = zid + '|' + b.mkey;
    let gr = groups.get(gk);
    if (!gr) {
      gr = {
        b: b,
        zs: zs,
        hiP: hiP,
        shP: shP,
        secs: [],
        sum: [
          [0, 0, 0, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
        ],
      };
      groups.set(gk, gr);
    }
    for (let z = 0; z < 3; z++) for (let c = 0; c < 4; c++) gr.sum[z][c] += sum[z][c];
    const e = { l: l, b: b, gr: gr, sm: sm, part: part, sum: sum, T2: T2, T3: T3 };
    gr.secs.push(e);
    sec.push(e);
  }
  const mean = function (s) {
      return s[3] ? [s[0] / s[3], s[1] / s[3], s[2] / s[3]] : null;
    },
    // (a part's mean, n samples, against a colour: what picking by means weighs)
    pcost = function (s, c) {
      return s[3] ? s[3] * de2000(mean(s), c) : 0;
    };
  // the candidates: the page's markers, and the ones added
  let cand = Object.keys(page).map(function (k) {
    return page[k];
  });
  const bestL = function (gr, s, C) {
      if (!gr.hiP || !s[3]) return null;
      let best = null,
        be = pcost(s, ptLab(gr.b));
      C.forEach(function (m) {
        if (!ptLightOK(gr.b, m)) return;
        const e = pcost(s, ptLab(m));
        if (e < be) {
          be = e;
          best = m;
        }
      });
      return best;
    },
    bestS = function (gr, s, C) {
      if (!gr.shP || !s[3] || ptLab(gr.b)[0] < 28) return null;
      const bl = ptLab(gr.b);
      let best = null,
        be = pcost(s, bl);
      C.forEach(function (m) {
        if (m.mkey === gr.b.mkey) return;
        const gl = ptGlaze(gr.b, m);
        if (bl[0] - gl[0] < 4) return;
        const e = pcost(s, gl);
        if (e < be) {
          be = e;
          best = m;
        }
      });
      return best;
    };
  // the markers added: as kept, while still yours; else up to PT_EXTRA, each saving PT_EXTRA_MIN of what's left
  let added = [];
  if (extras) {
    const byK = {};
    coll.forEach(function (m) {
      byK[m.mkey] = m;
    });
    added = extras
      .map(function (k) {
        return byK[k];
      })
      .filter(Boolean);
    cand = cand.concat(added);
  } else {
    const others = coll.filter(function (m) {
      return !page[m.mkey] && (m.lab || m.hex);
    });
    // (each group's best light and dark parts' cost so far; a marker's saving is what it would better of them)
    const G = Array.from(groups.values()),
      cL = G.map(function (gr) {
        const L = bestL(gr, gr.sum[0], cand);
        return pcost(gr.sum[0], L ? ptLab(L) : ptLab(gr.b));
      }),
      cS = G.map(function (gr) {
        const Sm = bestS(gr, gr.sum[2], cand);
        return pcost(gr.sum[2], Sm ? ptGlaze(gr.b, Sm) : ptLab(gr.b));
      });
    let cur = 0;
    for (let i = 0; i < G.length; i++) cur += cL[i] + cS[i];
    for (let r = 0; r < PT_EXTRA && cur > 0; r++) {
      let bm = null,
        bg = 0;
      others.forEach(function (m) {
        if (added.indexOf(m) >= 0) return;
        let g = 0;
        for (let i = 0; i < G.length; i++) {
          const gr = G[i];
          if (gr.hiP && gr.sum[0][3] && ptLightOK(gr.b, m)) {
            const e = pcost(gr.sum[0], ptLab(m));
            if (e < cL[i]) g += cL[i] - e;
          }
          if (gr.shP && gr.sum[2][3] && m.mkey !== gr.b.mkey && ptLab(gr.b)[0] >= 28) {
            const gl = ptGlaze(gr.b, m);
            if (ptLab(gr.b)[0] - gl[0] >= 4) {
              const e = pcost(gr.sum[2], gl);
              if (e < cS[i]) g += cS[i] - e;
            }
          }
        }
        if (g > bg) {
          bg = g;
          bm = m;
        }
      });
      if (!bm || bg / cur < 0.001) break;
      added.push(bm);
      cand = cand.concat([bm]);
      for (let i = 0; i < G.length; i++) {
        const gr = G[i];
        if (gr.hiP && gr.sum[0][3] && ptLightOK(gr.b, bm))
          cL[i] = Math.min(cL[i], pcost(gr.sum[0], ptLab(bm)));
        if (gr.shP && gr.sum[2][3] && bm.mkey !== gr.b.mkey && ptLab(gr.b)[0] >= 28) {
          const gl = ptGlaze(gr.b, bm);
          if (ptLab(gr.b)[0] - gl[0] >= 4) cS[i] = Math.min(cS[i], pcost(gr.sum[2], gl));
        }
      }
      cur -= bg;
    }
  }
  // a section's samples' error with highlight L and shadow Sm (null: the base there)
  const secCost = function (e, L, Sm) {
    const b = e.b,
      bl = ptLab(b),
      lc = L ? ptLab(L) : bl,
      sc = Sm ? ptGlaze(b, Sm) : bl,
      sm = e.sm;
    let flat = 0,
      tone = 0,
      all = 0;
    for (let i = 0, n = e.part.length; i < n; i++) {
      const c = [sm[i * 4], sm[i * 4 + 1], sm[i * 4 + 2]],
        z = e.part[i],
        f = de2000(c, bl);
      if (z === 1) {
        all += f;
        continue;
      }
      const t = de2000(c, z === 0 ? lc : sc);
      flat += f;
      tone += t;
      all += t;
    }
    return { flat: flat, tone: tone, all: all };
  };
  const tone = {},
    byK = {};
  cand.concat(coll).forEach(function (m) {
    byK[m.mkey] = m;
  });
  let err = 0,
    nFlat = 0;
  groups.forEach(function (gr) {
    // the pairs: one, chosen for all its sections; with Two tone sets up to two, from each section's own best
    const pairOf = function (secs) {
      const s0 = [0, 0, 0, 0],
        s2 = [0, 0, 0, 0];
      secs.forEach(function (e) {
        for (let c = 0; c < 4; c++) {
          s0[c] += e.sum[0][c];
          s2[c] += e.sum[2][c];
        }
      });
      return [bestL(gr, s0, cand), bestS(gr, s2, cand)];
    };
    const decide = function (pairs) {
      // each section: the pair that brings its toned parts nearest, if by PT_MIN_GAIN; else flat
      return gr.secs.map(function (e) {
        let best = -1,
          bc = null;
        const f = secCost(e, null, null);
        pairs.forEach(function (p, i) {
          if (!p[0] && !p[1]) return;
          const c = secCost(e, p[0], p[1]);
          if (f.flat > 0 && (f.flat - c.tone) / f.flat >= PT_MIN_GAIN && (!bc || c.all < bc.all)) {
            bc = c;
            best = i;
          }
        });
        return { e: e, i: best, all: bc ? bc.all : f.all };
      });
    };
    let pairs = [pairOf(gr.secs)],
      dec = decide(pairs);
    // (chosen again for the sections that took it: the ones it didn't suit had pulled it their way)
    const took = dec
      .filter(function (x) {
        return x.i === 0;
      })
      .map(function (x) {
        return x.e;
      });
    if (took.length && took.length < gr.secs.length) {
      const p2 = pairOf(took);
      if (p2[0] !== pairs[0][0] || p2[1] !== pairs[0][1]) {
        const d2 = decide([p2]),
          a1 = dec.reduce(function (s, x) {
            return s + x.all;
          }, 0),
          a2 = d2.reduce(function (s, x) {
            return s + x.all;
          }, 0);
        if (a2 < a1) {
          pairs = [p2];
          dec = d2;
        }
      }
    }
    if (shadeSets && gr.secs.length > 1) {
      // (up to two: each section's own best pair a candidate, the two that together save most)
      const cands = [pairs[0]],
        seenP = {};
      gr.secs.forEach(function (e) {
        const p = pairOf([e]),
          k = (p[0] ? p[0].mkey : '-') + '|' + (p[1] ? p[1].mkey : '-');
        if ((p[0] || p[1]) && !seenP[k]) {
          seenP[k] = 1;
          cands.push(p);
        }
      });
      let chosen = [],
        bestTot = Infinity,
        bestDec = null;
      for (let r = 0; r < 2; r++) {
        let bi = -1;
        cands.forEach(function (p, i) {
          if (chosen.indexOf(p) >= 0) return;
          const d = decide(chosen.concat([p])),
            t = d.reduce(function (s, x) {
              return s + x.all;
            }, 0);
          if (t < bestTot - 1e-9) {
            bestTot = t;
            bi = i;
            bestDec = d;
          }
        });
        if (bi < 0) break;
        chosen = chosen.concat([cands[bi]]);
      }
      if (bestDec) {
        pairs = chosen;
        dec = bestDec;
      }
    }
    dec.forEach(function (x) {
      err += x.all;
      const l = x.e.l;
      let p = x.i >= 0 ? pairs[x.i] : null,
        set = x.i > 0 ? 1 : 0;
      // (a section with ink keeps what it was coloured with)
      const h = _ptHeld[l];
      if (!amt && h && inkOn(l)) {
        const hl = h.L ? byK[h.L] || null : null,
          hs = shadowOn(l) ? (h.S ? byK[h.S] || null : null) : p ? p[1] : null;
        if ((hl || null) !== (p ? p[0] : null) || hs !== (p ? p[1] : null)) {
          const j = pairs.findIndex(function (q) {
            return q[0] === hl && q[1] === hs;
          });
          if (j >= 0) {
            p = pairs[j];
            set = j;
          } else {
            p = hl || hs ? [hl, hs] : null;
            set = -1;
          }
        }
      }
      if (!p) {
        tone[l] = null;
        nFlat++;
      } else tone[l] = ptTone(x.e.b, gr.zs, p[0], p[1], set, x.e.T2, x.e.T3);
    });
  });
  return {
    tone: tone,
    err: err,
    nFlat: nFlat,
    extras: added.map(function (m) {
      return m.mkey;
    }),
  };
}
// a tones object (as shadeTones makes them), its highlight L and shadow Sm the photo's; set 1 its second, -1 as
// coloured (held). Kept by what it is, so the drawing's table and the key's rows see the same one
function ptTone(b, zs, L, Sm, set, T2, T3) {
  const k =
    b.mkey +
    '|' +
    (L ? L.mkey : '-') +
    '|' +
    (Sm ? Sm.mkey : '-') +
    '|' +
    set +
    '|' +
    T2.toFixed(4) +
    '|' +
    T3.toFixed(4) +
    '|' +
    zs.shadow +
    '|' +
    zs.hilite +
    '|' +
    famRule +
    '|' +
    shadeMode;
  let t = _ptT.get(k);
  if (t && t._coll === coll) return t;
  const t0 = shadeTones(b, ptBaseZs(zs)),
    hiP = zs.hilite === 'photo' && hiOn(zs),
    shP = zs.shadow === 'photo';
  t = Object.assign({}, t0, {
    id: ++_toneId,
    _coll: coll,
    set: set,
    held: set < 0,
  });
  if (hiP) {
    t.light = L || null;
    t.L = L ? hexRgb(L.hex) : null;
    t.paper = false;
    t.blender = false;
    t.wantLight = null;
    t.fellH = false;
  }
  if (shP) {
    t.dark = Sm || null;
    t.glaze = !!Sm;
    t.coat = false;
    t.noShadow = !Sm;
    t.S = Sm ? shadeGlaze(t0.B, Sm) : t0.B;
    t.wantDark = null;
    t.fellS = false;
  }
  t.T2 = T2;
  t.T3 = T3;
  t.sig =
    (t.light ? t.light.mkey : t.paper ? 'paper' : '-') +
    '|' +
    (t.dark ? t.dark.mkey + (t.glaze ? 'g' : '') : t.noShadow ? 'n' : 'c') +
    (set > 0 ? '|2' : set < 0 ? '|h' : '');
  _ptT.set(k, t);
  return t;
}
// the photo tones, as they are now (null while there are none to have: no photo read, nothing Matched to the photo).
// Once for a run of calls (the drawing asks a section at a time), then checked against what they depend on
function ptGet() {
  if (_ptMemo) return _ptMemo.r;
  _ptMemo = { r: _ptGet1() };
  Promise.resolve().then(function () {
    _ptMemo = null;
  });
  return _ptMemo.r;
}
function _ptZsSig() {
  return zoneIds()
    .map(function (id) {
      const z = zsh(id);
      return [id, z.on ? 1 : 0, z.hi, z.lo, z.shadow, z.hilite].join(':');
    })
    .join(',');
}
function _ptGet1() {
  if (!assignData || !shadeOn()) return null;
  let any = false;
  for (const l in assignData.assign)
    if (ptOn(zshOf(+l), +l)) {
      any = true;
      break;
    }
  if (!any) return null;
  const S = ptSamples();
  if (!S) return null;
  // (the Photo style: its amounts the page's own, tried again when the page or the plan changed)
  if (shadePStyle && (_ptForce || _ptAutoK !== S.key)) ptAuto(S);
  // (what the markers added were chosen for: the plan, the light, the kinds and amounts, the sets)
  const base = S.key + '|' + _ptZsSig() + '|' + (shadeSets ? 2 : 1) + '|' + shadeMode,
    kx = ptHash(base),
    key = function () {
      return (
        base +
        '|' +
        Object.keys(_ptHeld)
          .map(function (l) {
            return l + ':' + _ptHeld[l].L + ':' + _ptHeld[l].S;
          })
          .join(',')
      );
    };
  if (_pt && !_ptForce && _pt.coll === coll && _pt.key === key()) {
    // (a section given ink since: what it's coloured with noted, which makes them chosen again with it kept)
    if (ptNoteHeld(_pt.tone)) return _ptGet1();
    return _pt;
  }
  const keepX = !_ptForce && _ptX && _ptX.k === kx ? _ptX.x : null,
    r = ptChoose(S.s, null, keepX);
  _ptX = { k: kx, x: r.extras };
  _ptForce = false;
  ptNoteHeld(r.tone);
  _pt = { key: key(), coll: coll, tone: r.tone, nFlat: r.nFlat, extras: r.extras };
  return _pt;
}
// (sections with ink: what they're coloured with noted, the shadow as it follows until it's on the paper; none
// without ink). Whether anything changed
function ptNoteHeld(tone) {
  let ch = false;
  for (const l in _ptHeld)
    if (!inkOn(+l)) {
      delete _ptHeld[l];
      ch = true;
    }
  for (const k in tone) {
    const l = +k;
    if (!inkOn(l)) continue;
    const t = tone[l],
      h = _ptHeld[l],
      L = t && t.light ? t.light.mkey : '',
      Sk = t && t.dark ? t.dark.mkey : '';
    if (!h) {
      _ptHeld[l] = { L: L, S: Sk };
      ch = true;
    } else if (!shadowOn(l) && h.S !== Sk) {
      _ptHeld[l] = { L: h.L, S: Sk };
      ch = true;
    }
  }
  return ch;
}
// (a short, steady key for a long one)
function ptHash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
// The Photo style's amounts: the pair, of PT_HI × PT_LO, that brings the page nearest the photo, by the samples, for
// Main and each zone that's Matched to the photo; set as their Highlights and Shadows amounts
function ptAuto(S) {
  S = S || ptSamples();
  _ptAutoK = S ? S.key : '';
  const ids = zoneIds().filter(function (id) {
    const z = zsh(id);
    return ptAvail(id) && (z.shadow === 'photo' || z.hilite === 'photo');
  });
  if (!ids.length) return;
  let best = null,
    bi = [PT_HI0, PT_LO0];
  // (the markers added chosen once, at the amounts as they are, so each pair isn't a search of your collection)
  if (S && !(_ptX && !_ptForce)) _ptX = { k: '', x: ptChoose(S.s, null, null).extras };
  if (S)
    PT_HI.forEach(function (hi) {
      PT_LO.forEach(function (lo) {
        const amt = {};
        ids.forEach(function (id) {
          amt[id] = [hi, lo];
        });
        const r = ptChoose(S.s, amt, _ptX ? _ptX.x : null);
        if (best == null || r.err < best) {
          best = r.err;
          bi = [hi, lo];
        }
      });
    });
  ids.forEach(function (id) {
    zshSet(id, 'hi', bi[0]);
    zshSet(id, 'lo', bi[1]);
  });
}
// Photo in the Shading row: shading on, the photo's light, both kinds Matched to the photo in Main and the zones that
// use the Photo pattern, and the amounts the page's own (chosen afresh: markers bought since come in)
function ptStyleApply() {
  shadeMode = 'full';
  if (shadeLight === 'edges' || shadeLight === 'sun') shadeLight = 'auto';
  zoneIds().forEach(function (id) {
    if (!ptAvail(id)) return;
    zshSet(id, 'shadow', 'photo');
    zshSet(id, 'hilite', 'photo');
  });
  shadePStyle = true;
  _ptForce = true;
  _ptX = null;
  _pt = null;
  _ptMemo = null;
  return true;
}
// the photo tones' sections left flat, for the Shading panel
function ptFlatN() {
  const r = ptGet();
  return r ? r.nFlat : 0;
}
// the section on its marker's second set (its label's prime)
function ptSet2(l) {
  if (!assignData || !assignData.assign[l] || !shadeOn()) return false;
  const zs = zshOf(l);
  if (!ptOn(zs, l)) return false;
  const r = ptGet(),
    t = r && r.tone[l];
  return !!(t && t.set === 1);
}
// (saving and opening: the markers added and the sections' held pairs, with the page: 47-photo-page ppSave)
function ptSaveState() {
  const th = {};
  for (const l in _ptHeld) th[l] = [_ptHeld[l].L, _ptHeld[l].S];
  return {
    tx: _ptX && _ptX.x.length ? { k: _ptX.k, x: _ptX.x.slice() } : undefined,
    th: Object.keys(th).length ? th : undefined,
  };
}
function ptOpenState(tx, th, map) {
  _pt = null;
  _ptS = null;
  _ptMemo = null;
  _ptForce = false;
  _ptX =
    tx && typeof tx.k === 'string' && Array.isArray(tx.x)
      ? {
          k: tx.k,
          x: tx.x
            .filter(function (k) {
              return typeof k === 'string' && k.length < 40;
            })
            .slice(0, PT_EXTRA),
        }
      : null;
  _ptHeld = {};
  if (th && typeof th === 'object')
    for (const ol in th) {
      const nl = map ? map[ol] : +ol,
        h = th[ol];
      if (nl && Array.isArray(h) && typeof h[0] === 'string' && typeof h[1] === 'string')
        _ptHeld[nl] = { L: h[0], S: h[1] };
    }
}
// a new picture, or another guide: nothing kept
function ptReset() {
  ptOpenState(null, null);
  _ptAutoK = '';
}
