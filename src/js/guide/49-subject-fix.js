// ---- (v329.4) Fix the subject (docs/PLAN-fix-subject.md) ----
// The photo cut into pieces that follow its edges (SLIC, run in the JOBS worker), and the fix itself: a layer of three
// states over the subject finder's map (0 the finder's, 1 in, 2 out), kept in the photo's own frame (as first shown:
// unturned, uncropped, at the tilt it was made at), so it follows crops and quarter turns; read with the finder's map
// as one subject map everywhere (prep.sal).

// ---- the pieces (pure: the JOBS worker runs them, ppWorkerSrc) ----
// sRGB bytes to L*a*b* (D65), three Float32Arrays
function fixLab(rgb, n) {
  const g = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const v = i / 255;
    g[i] = v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  }
  const f = function (t) {
      return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
    },
    L = new Float32Array(n),
    A = new Float32Array(n),
    B = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const r = g[rgb[i * 3]],
      gg = g[rgb[i * 3 + 1]],
      b = g[rgb[i * 3 + 2]],
      x = f((r * 0.4124 + gg * 0.3576 + b * 0.1805) / 0.95047),
      y = f(r * 0.2126 + gg * 0.7152 + b * 0.0722),
      z = f((r * 0.0193 + gg * 0.1192 + b * 0.9505) / 1.08883);
    L[i] = 116 * y - 16;
    A[i] = 500 * (x - y);
    B[i] = 200 * (y - z);
  }
  return { L: L, A: A, B: B };
}
// the colour gradient's size per pixel (Sobel on L*, a*, b*), for the seeds
function fixGrad(lab, w, h) {
  const n = w * h,
    gr = new Float32Array(n),
    CH = [lab.L, lab.A, lab.B];
  for (let c = 0; c < 3; c++) {
    const C = CH[c];
    for (let y = 1; y < h - 1; y++)
      for (let x = 1; x < w - 1; x++) {
        const p = y * w + x,
          gx = C[p - w + 1] + 2 * C[p + 1] + C[p + w + 1] - C[p - w - 1] - 2 * C[p - 1] - C[p + w - 1],
          gy = C[p + w - 1] + 2 * C[p + w] + C[p + w + 1] - C[p - w - 1] - 2 * C[p - w] - C[p - w + 1];
        gr[p] += (gx * gx + gy * gy) / 64;
      }
  }
  for (let i = 0; i < n; i++) gr[i] = Math.sqrt(gr[i]);
  return gr;
}
// The pieces: SLIC (Achanta et al., TPAMI 2012), written from the paper. Seeds on a grid of step S (moved to the
// lowest gradient of their 3 x 3), then SFX_PASSES rounds of k-means on (L*, a*, b*, x, y) in a 2S window round each
// centre, compactness SFX_M; then each 4-connected fragment its own piece and those under a quarter of a cell joined
// to the neighbour they touch most. (The piece trial, 3 Nov: on 20 bench photos the outlines' border lay within a
// pixel of a piece's 53% of the time at S = the long side / 30, 73% at / 75; a seeded watershed 6-7 points lower.)
// Returns { L: Int32Array, the piece of each pixel, n }.
const SFX_M = 5,
  SFX_PASSES = 10,
  SFX_COARSE = 30,
  SFX_FINE = 75;
function fixPieces(rgb, w, h, S) {
  const n = w * h,
    lab = fixLab(rgb, n),
    gr = fixGrad(lab, w, h),
    seeds = [];
  for (let y = Math.floor(S / 2); y < h; y += S)
    for (let x = Math.floor(S / 2); x < w; x += S) {
      let bx = x,
        by = y,
        bv = Infinity;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const xx = Math.min(w - 2, Math.max(1, x + dx)),
            yy = Math.min(h - 2, Math.max(1, y + dy)),
            v = gr[yy * w + xx];
          if (v < bv) {
            bv = v;
            bx = xx;
            by = yy;
          }
        }
      seeds.push(bx, by);
    }
  const K = seeds.length / 2,
    C = new Float64Array(K * 5);
  for (let k = 0; k < K; k++) {
    const p = seeds[k * 2 + 1] * w + seeds[k * 2];
    C[k * 5] = lab.L[p];
    C[k * 5 + 1] = lab.A[p];
    C[k * 5 + 2] = lab.B[p];
    C[k * 5 + 3] = seeds[k * 2];
    C[k * 5 + 4] = seeds[k * 2 + 1];
  }
  const lbl = new Int32Array(n).fill(-1),
    dist = new Float64Array(n),
    wxy = (SFX_M / S) * (SFX_M / S);
  for (let it = 0; it < SFX_PASSES; it++) {
    dist.fill(Infinity);
    for (let k = 0; k < K; k++) {
      const cl = C[k * 5],
        ca = C[k * 5 + 1],
        cb = C[k * 5 + 2],
        cx = C[k * 5 + 3],
        cy = C[k * 5 + 4],
        x0 = Math.max(0, Math.floor(cx - S)),
        x1 = Math.min(w - 1, Math.ceil(cx + S)),
        y0 = Math.max(0, Math.floor(cy - S)),
        y1 = Math.min(h - 1, Math.ceil(cy + S));
      for (let y = y0; y <= y1; y++)
        for (let x = x0; x <= x1; x++) {
          const p = y * w + x,
            dl = lab.L[p] - cl,
            da = lab.A[p] - ca,
            db = lab.B[p] - cb,
            dx = x - cx,
            dy = y - cy,
            D = dl * dl + da * da + db * db + wxy * (dx * dx + dy * dy);
          if (D < dist[p]) {
            dist[p] = D;
            lbl[p] = k;
          }
        }
    }
    const acc = new Float64Array(K * 6);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const p = y * w + x,
          k = lbl[p];
        if (k < 0) continue;
        const o = k * 6;
        acc[o] += lab.L[p];
        acc[o + 1] += lab.A[p];
        acc[o + 2] += lab.B[p];
        acc[o + 3] += x;
        acc[o + 4] += y;
        acc[o + 5]++;
      }
    for (let k = 0; k < K; k++) {
      const c = acc[k * 6 + 5];
      if (c) for (let j = 0; j < 5; j++) C[k * 5 + j] = acc[k * 6 + j] / c;
    }
  }
  // (a pixel no window reached: the nearest centre's)
  for (let p = 0; p < n; p++)
    if (lbl[p] < 0) {
      const x = p % w,
        y = (p - x) / w;
      let bk = 0,
        bd = Infinity;
      for (let k = 0; k < K; k++) {
        const d = (x - C[k * 5 + 3]) * (x - C[k * 5 + 3]) + (y - C[k * 5 + 4]) * (y - C[k * 5 + 4]);
        if (d < bd) {
          bd = d;
          bk = k;
        }
      }
      lbl[p] = bk;
    }
  return fixTidy(lbl, w, h, S);
}
// each 4-connected fragment a piece, then pieces under a quarter of a cell joined to the neighbour they share most
// border with (three passes); ids 0..n-1
function fixTidy(L, w, h, S) {
  const n = w * h,
    out = new Int32Array(n).fill(-1),
    st = new Int32Array(n);
  let k = 0;
  for (let p = 0; p < n; p++) {
    if (out[p] >= 0) continue;
    const l = L[p];
    let sp = 0;
    st[sp++] = p;
    out[p] = k;
    while (sp) {
      const q = st[--sp],
        x = q % w;
      if (x > 0 && out[q - 1] < 0 && L[q - 1] === l) {
        out[q - 1] = k;
        st[sp++] = q - 1;
      }
      if (x < w - 1 && out[q + 1] < 0 && L[q + 1] === l) {
        out[q + 1] = k;
        st[sp++] = q + 1;
      }
      if (q >= w && out[q - w] < 0 && L[q - w] === l) {
        out[q - w] = k;
        st[sp++] = q - w;
      }
      if (q + w < n && out[q + w] < 0 && L[q + w] === l) {
        out[q + w] = k;
        st[sp++] = q + w;
      }
    }
    k++;
  }
  const min = Math.max(4, (S * S) / 4),
    par = new Int32Array(k),
    find = function (x) {
      while (par[x] !== x) x = par[x] = par[par[x]];
      return x;
    };
  for (let i = 0; i < k; i++) par[i] = i;
  for (let pass = 0; pass < 3; pass++) {
    const area = new Float64Array(k),
      touch = new Map();
    for (let p = 0; p < n; p++) area[find(out[p])]++;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const p = y * w + x,
          a = find(out[p]);
        if (area[a] >= min) continue;
        const nb = [x < w - 1 ? p + 1 : -1, y < h - 1 ? p + w : -1, x > 0 ? p - 1 : -1, y > 0 ? p - w : -1];
        for (let j = 0; j < 4; j++) {
          if (nb[j] < 0) continue;
          const b = find(out[nb[j]]);
          if (b === a) continue;
          const key = a * k + b;
          touch.set(key, (touch.get(key) || 0) + 1);
        }
      }
    const best = new Map();
    touch.forEach(function (c, key) {
      const a = Math.floor(key / k),
        b = key - a * k,
        o = best.get(a);
      if (!o || c > o[1]) best.set(a, [b, c]);
    });
    if (!best.size) break;
    best.forEach(function (o, a) {
      const ra = find(a),
        rb = find(o[0]);
      if (ra !== rb) par[ra] = rb;
    });
  }
  const map = new Int32Array(k).fill(-1);
  let m = 0;
  for (let p = 0; p < n; p++) {
    const r = find(out[p]);
    if (map[r] < 0) map[r] = m++;
    out[p] = map[r];
  }
  return { L: out, n: m };
}
// the grid step for a working picture: coarse (the long side / SFX_COARSE) or fine (/ SFX_FINE)
function fixStep(w, h, fine) {
  return Math.max(4, Math.round(Math.max(w, h) / (fine ? SFX_FINE : SFX_COARSE)));
}

// ---- the layer ----
// a new layer, in the frame of the photo prepared's source (keep: ppPrepare's { src, rot, tilt, rect }) at a grid
// gw x gh; complete: everything not marked in is out (a subject chosen from empty: the finder never asked); source:
// 'finder' (no fix), 'hand' (chosen from empty), 'both' (fixes over the finder's)
function fixNew(keep, gw, gh, complete) {
  return {
    src: keep.src,
    tilt: keep.tilt || 0,
    gw: gw,
    gh: gh,
    a: new Uint8Array(gw * gh),
    complete: !!complete,
  };
}
// whether a layer belongs to the photo prepared (the same photo at the same tilt: a crop or a quarter turn keeps it)
function fixFits(L, keep) {
  return !!(L && keep && L.src === keep.src && (L.tilt || 0) === (keep.tilt || 0));
}
// a place in the photo prepared (u, v: fractions of it) as fractions of the layer's frame: back through the crop
// (keep.rect, fractions of the turned photo), then the quarter turn (keep.rot, as subFromKept turns a kept map)
function fixBase(keep, u, v) {
  const r = keep.rect || { x: 0, y: 0, w: 1, h: 1 },
    tu = r.x + u * r.w,
    tv = r.y + v * r.h,
    t = (((keep.rot || 0) % 360) + 360) % 360;
  if (t === 90) return [tv, 1 - tu];
  if (t === 180) return [1 - tu, 1 - tv];
  if (t === 270) return [1 - tv, tu];
  return [tu, tv];
}
// each pixel of the photo prepared (w x h) to its layer cell; fine: the layer made fine enough first that a cell is
// at most a pixel of this view (capped at maxW x maxH, the photo's own pixels)
function fixCells(L, keep, w, h) {
  const n = w * h,
    c = new Int32Array(n);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const b = fixBase(keep, (x + 0.5) / w, (y + 0.5) / h),
        cx = Math.min(L.gw - 1, Math.max(0, Math.floor(b[0] * L.gw))),
        cy = Math.min(L.gh - 1, Math.max(0, Math.floor(b[1] * L.gh)));
      c[y * w + x] = cy * L.gw + cx;
    }
  return c;
}
// the layer's grid made at least as fine as this view's pixels (cells copied, nearest), never past maxW x maxH;
// returns the layer (a new one when it grew)
function fixRefine(L, keep, w, h, maxW, maxH) {
  const r = keep.rect || { x: 0, y: 0, w: 1, h: 1 },
    t = (((keep.rot || 0) % 360) + 360) % 360,
    // (this view's pixels across the whole frame)
    vw = t === 90 || t === 270 ? h / r.h : w / r.w,
    vh = t === 90 || t === 270 ? w / r.w : h / r.h,
    gw = Math.min(maxW || Infinity, Math.max(L.gw, Math.ceil(vw))),
    gh = Math.min(maxH || Infinity, Math.max(L.gh, Math.ceil(vh)));
  if (gw <= L.gw && gh <= L.gh) return L;
  const a = new Uint8Array(gw * gh);
  for (let y = 0; y < gh; y++) {
    const sy = Math.min(L.gh - 1, Math.floor(((y + 0.5) * L.gh) / gh));
    for (let x = 0; x < gw; x++)
      a[y * gw + x] = L.a[sy * L.gw + Math.min(L.gw - 1, Math.floor(((x + 0.5) * L.gw) / gw))];
  }
  return { src: L.src, tilt: L.tilt, gw: gw, gh: gh, a: a, complete: L.complete };
}
// the layer as it falls on the photo prepared: 0 the finder's, 1 in, 2 out, a pixel each
function fixView(L, keep, w, h) {
  const c = fixCells(L, keep, w, h),
    v = new Uint8Array(w * h);
  for (let i = 0; i < c.length; i++) v[i] = L.a[c[i]];
  return v;
}
// the subject map read with the layer: in 1, out 0, else the finder's (sal; none, or a complete layer: 0). A fresh
// array every time, so what's kept from the old map (ppSubjectMask's _bgm, the targets) is made again
function fixCombine(sal, view, complete) {
  const n = view.length,
    out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = view[i] === 1 ? 1 : view[i] === 2 || complete || !sal ? 0 : sal[i];
  return out;
}
// what the user added, a pixel each (1): subStrays leaves the parts they touch
function fixAdded(view) {
  const n = view.length,
    m = new Uint8Array(n);
  for (let i = 0; i < n; i++) m[i] = view[i] === 1 ? 1 : 0;
  return m;
}
// the layer for the guide (pp.fix): runs of [value, count] as a string ("v,count;...") and its frame
function fixEncode(L) {
  const a = L.a,
    parts = [];
  let i = 0;
  while (i < a.length) {
    const v = a[i];
    let j = i + 1;
    while (j < a.length && a[j] === v) j++;
    parts.push(v + ',' + (j - i));
    i = j;
  }
  return { src: L.src, tilt: L.tilt, gw: L.gw, gh: L.gh, complete: L.complete, runs: parts.join(';') };
}
function fixDecode(e) {
  if (!e || !e.runs || !(e.gw > 0) || !(e.gh > 0)) return null;
  const a = new Uint8Array(e.gw * e.gh),
    parts = e.runs.split(';');
  let i = 0;
  for (let k = 0; k < parts.length; k++) {
    const pc = parts[k].split(','),
      v = +pc[0],
      c = +pc[1];
    if (!(c > 0) || i + c > a.length || !(v >= 0 && v <= 2)) return null;
    a.fill(v, i, i + c);
    i += c;
  }
  if (i !== a.length) return null;
  return { src: e.src, tilt: e.tilt || 0, gw: e.gw, gh: e.gh, a: a, complete: !!e.complete };
}
// the layer's key (for the marker choice's and the page memory's keys): its frame and contents, FNV-1a, 8 hex; ''
// for no layer, or one that marks nothing and isn't complete (the finder's map as it is)
function fixKey(e) {
  if (!e || (!e.complete && !/(^|;)[12],/.test(e.runs || ''))) return '';
  const s = [e.src, e.tilt, e.gw, e.gh, e.complete ? 1 : 0, e.runs].join('|');
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return ('0000000' + h.toString(16)).slice(-8);
}
// a stroke: every pixel of the pieces touched (ids, in L: the pieces of the photo prepared) set to v (1 in, 2 out) in
// the layer, through the view's cells
function fixPaint(L, cells, P, ids, v) {
  const set = new Set(ids);
  for (let i = 0; i < P.length; i++) if (set.has(P[i])) L.a[cells[i]] = v;
  return L;
}
// how much of the photo prepared the layer changes from the finder's map (0-1), for Copy diagnostics
function fixShare(sal, view, complete) {
  let k = 0;
  for (let i = 0; i < view.length; i++) {
    const was = !complete && sal ? sal[i] >= SUB_CUT : false,
      now = view[i] === 1 ? true : view[i] === 2 ? false : was;
    if (now !== was) k++;
  }
  return view.length ? k / view.length : 0;
}

// ---- the hooks: the layer read with the finder's map where the map is first set (subFind's result, subFromKept's
// kept map, or, for a subject chosen from empty, subMap without the finder), and again whenever the guide's layer has
// changed since (fixSync: ppMake and the Focus row). Never inside a function the bench copies (scripts/bench/lib/pp.mjs)
// ----
// the guide's layer, decoded once for each stored one (pp.fix)
let _fixDec = null;
function fixLayer() {
  const e = pp && pp.fix;
  if (!e) return null;
  if (_fixDec && _fixDec.e === e) return _fixDec.L;
  _fixDec = { e: e, L: fixDecode(e) };
  return _fixDec.L;
}
// each photo prepared and layer: its own pid (so the marker choice's key, ppChoose's ck, and the page memory's,
// ppMemKey, are another for another subject; the same again when a fix is undone)
const _fixPids = new Map();
// the photo prepared's subject map read with the guide's layer: prep.salF the finder's own (null when it never ran),
// prep.sal the two together, prep.fixAdd what the user added (for subStrays), prep.fixKey the layer's key. A layer for
// another photo is let go of; one for this photo at another tilt too, said (the photo's shape changed). Returns prep.sal
// (pressure test 1: a layer of fixes over a finder's map not yet made leaves the map unmade, so the finder is still
// asked, subMap, and its answer read with the layer then, subFind; 2: only the photo prepared now binds or lets go of
// the guide's layer: a finder answering for an older one, another guide opened meanwhile, leaves it alone)
function fixApply(prep) {
  if (!prep) return null;
  const live = prep === _ppPrep && prep.key === ppPrepKey();
  if (live) fixBind(prep);
  const raw = prep.salF !== undefined ? prep.salF : prep.sal || null;
  let L = pp ? fixLayer() : null;
  if (L && !fixFits(L, prep.keep)) {
    if (live) {
      if (prep.keep && L.src === prep.keep.src)
        note('Your subject changes were cleared because the photo’s shape changed.');
      pp.fix = null;
    }
    L = null;
  }
  if (L && !L.complete && raw === null && prep.salF === undefined) return null;
  const k = L ? fixKey(pp.fix) : '',
    pk = prep.key + '|';
  if (!_fixPids.has(pk)) _fixPids.set(pk, prep.pid);
  prep.salF = raw;
  prep.fixKey = k;
  if (!k) {
    prep.sal = raw;
    prep.fixAdd = null;
    prep.pid = _fixPids.get(pk);
    return prep.sal;
  }
  const v = fixView(L, prep.keep, prep.w, prep.h);
  prep.sal = fixCombine(raw, v, L.complete);
  prep.fixAdd = fixAdded(v);
  if (!_fixPids.has(pk + k)) _fixPids.set(pk + k, ++_ppPid);
  prep.pid = _fixPids.get(pk + k);
  return prep.sal;
}
// (ppMake and the Focus row) the photo prepared made to agree with the guide's layer, when it doesn't (an Undo, Done,
// Use the finder's subject): cheap when it does
function fixSync(prep) {
  if (!prep || !pp) return;
  fixBind(prep);
  const k = pp.fix ? fixKey(pp.fix) : '';
  if ((prep.fixKey || '') === k && prep.salF !== undefined) return;
  if (prep.salF === undefined && !prep.sal && !k) return;
  fixApply(prep);
}
// a guide opened again: its saved layer is its own photo's, the first one prepared (the session's number for it)
function fixBind(prep) {
  if (pp && pp.fix && pp.fix.src == null && prep && prep.keep)
    pp.fix = Object.assign({}, pp.fix, { src: prep.keep.src });
}
// (subMap) a subject chosen from empty: the map is the layer's alone, the finder never asked (decision 7)
function fixOwnMap(prep) {
  fixBind(prep);
  const L = fixLayer();
  if (!L || !L.complete || !fixFits(L, prep.keep)) return null;
  prep.salF = null;
  return fixApply(prep);
}

// ---- (the worker: 03-jobs, the 'fixp' job) the pieces' source for the worker ----
function fixWorkerSrc() {
  return (
    'const SFX_M = ' +
    SFX_M +
    ', SFX_PASSES = ' +
    SFX_PASSES +
    ';\n' +
    [fixLab, fixGrad, fixPieces, fixTidy]
      .map(function (f) {
        return f.toString();
      })
      .join('\n')
  );
}

// ---- what's saved with the guide (payload.pp.fix): the layer without the session's photo number (src), which a
// guide opened again takes from its own photo, the first one prepared (fixApply) ----
function fixSave(e) {
  if (!e || !e.runs) return undefined;
  return { tilt: e.tilt || 0, gw: e.gw, gh: e.gh, complete: e.complete ? 1 : undefined, runs: e.runs };
}
function fixLoad(o) {
  if (!o || typeof o !== 'object' || typeof o.runs !== 'string' || o.runs.length > 8000000) return null;
  const e = {
    src: null,
    tilt: typeof o.tilt === 'number' && isFinite(o.tilt) ? o.tilt : 0,
    gw: o.gw | 0,
    gh: o.gh | 0,
    complete: o.complete === 1,
    runs: o.runs,
  };
  if (!(e.gw > 0 && e.gh > 0 && e.gw * e.gh <= 64000000) || !fixDecode(e)) return null;
  return e;
}

// ---- the mode (decisions 1-6): the photo with its subject bright and the rest dimmed, the pieces' borders faint;
// one finger adds pieces to the subject or takes them away (the pixel under the first touch decides which), two
// fingers zoom and move; the strokes a draft with its own Undo until Done ----
let fixOn = false,
  _fx = null,
  // (the stroke under the finger)
  _fxS = null,
  _fxRaf = 0,
  // (zoom and position kept between visits, for the photo prepared: { key, z, x, y })
  _fxZoom = null,
  // (Done's draft while its page is made: back in the mode with it if the page can't be made, ppRemade)
  _fxRetry = null,
  _fxFailed = false,
  // (what the next make says while it works, ppMake)
  _fxMakeWord = null,
  // (decision 7b: choosing the subject by hand for this launch, the finder not downloaded: Focus choices go straight
  // to choosing, 48-subject ppSetFocus)
  _subHand = false;
const FIX_UNDO_MAX = 200,
  FIX_ACCENT = '#b9a8ff';
function fixMakeWord() {
  const w = _fxMakeWord;
  _fxMakeWord = null;
  return w;
}
// the mode can be opened: the page step of a photo-made page, nothing being made
function fixCanOpen() {
  return !!(
    pp &&
    srcImg &&
    // (pressure test 8: not while the subject finder downloads, whose end makes the page again)
    !_subDl &&
    sfmode === 'review' &&
    ppOn() &&
    !_ppBusy &&
    !cropMode &&
    !pgMode &&
    subCan() &&
    !(root && root.classList.contains('sfrev'))
  );
}
// (the Focus row, 48-subject ppFocusHTML) the way in: with a Focus that uses the subject; "Choose the subject" when
// there's none
// (Subject only gone back to Even for want of a clear subject, ppMake: the photo prepared's key, for Choose the
// subject under Even, which chooses it for Subject only)
let _fxNone = '';
function fixNoneSet(k) {
  _fxNone = k;
}
function fixNoneHere() {
  return !!(
    pp &&
    pp.f === 'even' &&
    _fxNone &&
    _ppPrep &&
    _ppPrep.key === ppPrepKey() &&
    _fxNone === _ppPrep.key
  );
}
function fixLinkHTML(f) {
  if (!srcImg || !pp) return '';
  if (f === 'even' && !fixNoneHere()) return '';
  const pr = _ppPrep && _ppPrep.key === ppPrepKey() ? _ppPrep : null,
    none = f === 'even' || (pr && (pr.sal ? ppSubjectShare(pr) < SUB_NONE : pr.salF === null));
  return (
    '<div class="sffixln"><button type="button" class="sflink" id="sfPpFix"' +
    (_ppBusy ? ' disabled' : '') +
    '>' +
    (none ? 'Choose the subject' : 'Fix the subject') +
    '</button></div>'
  );
}
// the guide's subject is one chosen by hand from empty (a complete layer) for the photo prepared: no finder needed
// (pressure test 4: decided from the guide's layer itself, so a guide opened again, nothing prepared yet, needs no
// finder either)
function fixHandMap() {
  if (!pp || !pp.fix || !srcImg) return false;
  const pr = _ppPrep && _ppPrep.key === ppPrepKey() ? _ppPrep : null;
  if (pr) fixBind(pr);
  const e = pp.fix;
  return !!(e.complete && (e.tilt || 0) === (tilt || 0) && (e.src == null || e.src === _ppSrcId(srcImg)));
}
// (pressure test 3) the photo prepared now has a subject map already (the finder's, found before): a Focus needs no
// finder and no choosing
function fixHaveMap() {
  const pr = _ppPrep && _ppPrep.key === ppPrepKey() ? _ppPrep : null;
  return !!(pr && (pr.salF || pr.sal));
}
// (decision 7: 48-subject ppSetFocus) a Focus that needs a subject chosen with no finder (off this launch, not
// downloaded, choosing by hand chosen): the mode opened empty for it; Done makes the page with that Focus, and ending
// with no subject keeps the Focus as it was
function fixChooseFor(f) {
  if (fixOn || !fixCanOpen()) {
    renderControls();
    return;
  }
  const prep = ppPrepare();
  if (!prep) return;
  fixSync(prep);
  fixOpen(prep, null, f);
}
// the photo's whole frame in its own pixels (as first shown, at its tilt): the finest the layer ever gets
function fixFrameMax() {
  const a = ((tilt || 0) * Math.PI) / 180,
    c = Math.abs(Math.cos(a)),
    s = Math.abs(Math.sin(a)),
    sw = srcImg.width,
    sh = srcImg.height;
  return [Math.max(1, Math.round(sw * c + sh * s)), Math.max(1, Math.round(sw * s + sh * c))];
}
// each view pixel's cells in the layer (those whose middle is in it; the one under its middle when there's none), a
// range along each of the layer's sides: columns X and rows Y of the view; sw: the view's columns run down the layer
// (a quarter turn)
function fixFoot(L, keep, w, h) {
  const r = keep.rect || { x: 0, y: 0, w: 1, h: 1 },
    t = (((keep.rot || 0) % 360) + 360) % 360,
    sw = t === 90 || t === 270,
    ax = function (n, o, k, flip, G) {
      const lo = new Int32Array(n),
        hi = new Int32Array(n);
      for (let i = 0; i < n; i++) {
        let a = o + (i / n) * k,
          b = o + ((i + 1) / n) * k;
        if (flip) {
          const t2 = 1 - a;
          a = 1 - b;
          b = t2;
        }
        let c0 = Math.ceil(a * G - 0.5),
          c1 = Math.ceil(b * G - 0.5);
        if (c1 <= c0) {
          c0 = Math.floor(((a + b) / 2) * G);
          c1 = c0 + 1;
        }
        lo[i] = Math.max(0, Math.min(G - 1, c0));
        hi[i] = Math.max(lo[i] + 1, Math.min(G, c1));
      }
      return { lo: lo, hi: hi };
    };
  return {
    X: ax(w, r.x, r.w, t === 180 || t === 90, sw ? L.gh : L.gw),
    Y: ax(h, r.y, r.h, t === 180 || t === 270, sw ? L.gw : L.gh),
    sw: sw,
  };
}
// a piece's pixels (k, of the pieces P) set to v (1 in, 2 out) in the layer, each changed cell recorded (rec: its
// Undo)
function fixSetPiece(F, P, k, v, rec) {
  const a = F.L.a,
    gw = F.L.gw,
    ft = F.foot,
    w = F.w;
  for (let j = P.start[k]; j < P.start[k + 1]; j++) {
    const p = P.idx[j],
      x = p % w,
      y = (p - x) / w,
      x0 = ft.sw ? ft.Y.lo[y] : ft.X.lo[x],
      x1 = ft.sw ? ft.Y.hi[y] : ft.X.hi[x],
      y0 = ft.sw ? ft.X.lo[x] : ft.Y.lo[y],
      y1 = ft.sw ? ft.X.hi[x] : ft.Y.hi[y];
    for (let cy = y0; cy < y1; cy++)
      for (let c = cy * gw + x0, e = cy * gw + x1; c < e; c++)
        if (a[c] !== v) {
          rec.c.push(c);
          rec.o.push(a[c]);
          a[c] = v;
        }
    F.view[p] = v;
    F.disp[p] = v === 1 ? 1 : 0;
  }
}
// the subject as the page will read it: the layer over the finder's map, then the strays rule (what was added kept)
function fixSubOf(F) {
  const n = F.w * F.h,
    s = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const v = F.view[i];
    s[i] = v === 1 ? 1 : v === 2 || F.L.complete || !F.sal ? 0 : F.sal[i] >= SUB_CUT ? 1 : 0;
  }
  return s;
}
function fixDisp(F) {
  const n = F.w * F.h,
    s = fixSubOf(F),
    m = new Uint8Array(n),
    add = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    m[i] = s[i] ? 0 : 1;
    add[i] = F.view[i] === 1 ? 1 : 0;
  }
  subStrays(m, F.w, F.h, add);
  let k = 0;
  for (let i = 0; i < n; i++) {
    F.disp[i] = m[i] ? 0 : 1;
    k += F.disp[i];
  }
  F.share = k / n;
}
// the layer read again at every pixel (after a stroke, an Undo, Clear): the view and the subject shown
function fixReview(F) {
  const c = F.cells,
    a = F.L.a;
  for (let i = 0; i < c.length; i++) F.view[i] = a[c[i]];
  fixDisp(F);
}
// the pieces of the photo prepared (coarse, or fine when zoomed in 2x or more), each piece's pixels listed
function fixPieceSet(F, r) {
  const n = F.w * F.h,
    L = r.L,
    m = r.n,
    start = new Int32Array(m + 1),
    idx = new Int32Array(n),
    bd = new Uint8Array(n),
    w = F.w;
  for (let p = 0; p < n; p++) start[L[p] + 1]++;
  for (let k = 0; k < m; k++) start[k + 1] += start[k];
  const at = start.slice(0, m);
  for (let p = 0; p < n; p++) idx[at[L[p]]++] = p;
  for (let p = 0; p < n; p++) {
    const x = p % w;
    bd[p] = (x < w - 1 && L[p] !== L[p + 1]) || (p + w < n && L[p] !== L[p + w]) ? 1 : 0;
  }
  return { L: L, n: m, start: start, idx: idx, bd: bd };
}
// the pieces for this zoom: made once each (the JOBS worker; on the page when there's none)
function fixPiecesFor(F) {
  const fine = zoom >= 2,
    k = fine ? 'fine' : 'coarse';
  F.want = k;
  if (F.ps[k]) {
    if (F.pc !== F.ps[k] && !_fxS) {
      F.pc = F.ps[k];
      fixQueue();
    }
    return;
  }
  if (F.asked[k]) return;
  F.asked[k] = true;
  const S = fixStep(F.w, F.h, fine),
    rgb = F.prep.rgb,
    w = F.w,
    h = F.h;
  JOBS.run('fixp', { rgb: rgb, w: w, h: h, S: S, n: w * h })
    .catch(function (e) {
      // (pressure test 9: made on the page only where there's no worker at all; a worker that took too long or failed
      // (memory) isn't followed by the same work on the page's own thread, which would hold the screen)
      if (!/no worker/.test(String((e && e.message) || e))) throw e;
      return new Promise(function (res) {
        afterPaint(function () {
          res(fixPieces(rgb, w, h, S));
        });
      });
    })
    .then(function (r) {
      if (_fx !== F && _fxRetry !== F) return;
      F.ps[k] = fixPieceSet(F, r);
      if (F.want === k && !_fxS) F.pc = F.ps[k];
      if (!F.pc) F.pc = F.ps[k];
      if (fixOn && _fx === F) {
        const ld = document.getElementById('sfFixLoad');
        if (ld) ld.remove();
        fixQueue();
      }
    })
    .catch(function (e) {
      errLog('Fix the subject', e);
      // (asked again on the next zoom; with no pieces at all, said: the mode can't be used meanwhile)
      F.asked[k] = false;
      if (fixOn && _fx === F && !F.pc) {
        const ld = document.getElementById('sfFixLoad');
        if (ld)
          ld.textContent =
            'Couldn’t get the pieces ready on this device. Cancel, then try Fix the subject again.';
      }
    });
}
// (70-view applyXform) zoomed: the pieces for the new zoom
function fixZoomed() {
  if (fixOn && _fx) fixPiecesFor(_fx);
}
// the photo as it's made into a page, at the page's size (the mode's own copy, let go of on leaving)
function fixPhoto(GW, GH) {
  const z = ppSize(),
    oc = rot90 || tilt ? buildRotatedFull(false) : null,
    c = document.createElement('canvas');
  c.width = GW;
  c.height = GH;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, GW, GH);
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  if (oc) {
    g.drawImage(oc, z.cx, z.cy, z.cw, z.ch, 0, 0, GW, GH);
    freeCanvas(oc);
  } else g.drawImage(srcImg, z.cx / z.sc, z.cy / z.sc, z.cw / z.sc, z.ch / z.sc, 0, 0, GW, GH);
  return c;
}
// Fix the subject's link: the mode opened for the photo prepared (its subject found first when it hasn't been this
// session: "Finding the subject…"; none can be: the mode starts empty)
function fixEnter() {
  if (fixOn || !fixCanOpen()) return;
  // (under Even after Subject only found none: chosen for Subject only)
  if (pp.f === 'even') {
    if (fixNoneHere()) fixChooseFor('subject');
    return;
  }
  const prep = ppPrepare();
  if (!prep) return;
  fixSync(prep);
  if (prep.salF === undefined && !prep.sal) {
    // (the finder off this launch, or choosing by hand: not asked, the mode starts empty)
    if (subOff() || _subHand) {
      prep.salF = null;
      fixOpen(prep);
      return;
    }
    const g = loadGen;
    note('Finding the subject…');
    _ppBusy = true;
    renderControls();
    subMap(prep)
      .catch(function (e) {
        errLog('Fix the subject', e);
        prep.salF = null;
      })
      .then(function () {
        _ppBusy = false;
        note(metaText());
        if (g !== loadGen || !pp || prep !== _ppPrep) return;
        if (prep.salF === undefined) prep.salF = prep.sal || null;
        fixOpen(prep);
      });
    return;
  }
  fixOpen(prep);
}
// focus: the Focus this is chosen for (fixChooseFor), made with it at Done
function fixOpen(prep, F0, focus) {
  if (!fixCanOpen() || prep.GW !== W || prep.GH !== H) return;
  let F = F0;
  if (!F) {
    const raw = focus ? null : prep.salF !== undefined ? prep.salF : prep.sal || null,
      // (pressure test 11: for a pending Focus, a subject chosen by hand before, too small for Subject only, say, is
      // where it starts)
      L0 = fixFits(fixLayer(), prep.keep) && (!focus || fixLayer().complete) ? fixLayer() : null,
      fm = fixFrameMax();
    // (decision 7: every empty start, the finder's subject none or missing, is complete: the finder never asked again)
    let L = L0
      ? { src: L0.src, tilt: L0.tilt, gw: L0.gw, gh: L0.gh, a: L0.a.slice(), complete: L0.complete }
      : fixNew(prep.keep, 1, 1, !raw || fixFinderShare(raw) < SUB_NONE);
    L = fixRefine(L, prep.keep, prep.w, prep.h, fm[0], fm[1]);
    const n = prep.w * prep.h;
    F = {
      prep: prep,
      key: prep.key,
      w: prep.w,
      h: prep.h,
      sal: raw,
      L: L,
      cells: fixCells(L, prep.keep, prep.w, prep.h),
      foot: fixFoot(L, prep.keep, prep.w, prep.h),
      view: new Uint8Array(n),
      disp: new Uint8Array(n),
      share: 0,
      undo: [],
      redo: [],
      ps: {},
      asked: {},
      pc: null,
      want: 'coarse',
      focus: focus || null,
    };
    fixReview(F);
    // (what the page has now, for Done's "nothing changed": the subject as the page reads it)
    F.sub0 = fixSubOf(F);
    F.choose = F.share < SUB_NONE;
    F.finder = !!raw && fixFinderShare(raw) >= SUB_NONE;
    // (Use the finder's subject for a subject chosen by hand when the finder never ran on this photo and could: it's
    // asked then, fixUseFinder; only once it's known to be stored)
    F.canAsk = false;
    if (!raw && L.complete && !focus && !_subHand && !subOff() && subCan() && !prep._fxTried)
      subMissing().then(function (need) {
        if (_fx !== F || !need || need.length) return;
        F.canAsk = true;
        if (fixOn) renderControls();
      });
  }
  F.photo = fixPhoto(W, H);
  F.tmp = document.createElement('canvas');
  F.tmp.width = W;
  F.tmp.height = H;
  F.maskC = document.createElement('canvas');
  F.maskC.width = F.w;
  F.maskC.height = F.h;
  F.lineC = document.createElement('canvas');
  F.lineC.width = F.w;
  F.lineC.height = F.h;
  F.z0 = { z: zoom, x: panX, y: panY };
  _fx = F;
  fixOn = true;
  photoPeek = false;
  hideTip();
  if (_fxZoom && _fxZoom.key === F.key) {
    zoom = _fxZoom.z;
    panX = _fxZoom.x;
    panY = _fxZoom.y;
    clampPan();
    applyXform();
  } else resetZoom();
  fixPiecesFor(F);
  renderControls();
  positionPeekBtn();
  fixQueue();
  ctlRefocus('#sfFixHead');
}
// how much of the photo the finder's own map calls its subject
function fixFinderShare(sal) {
  let k = 0;
  for (let i = 0; i < sal.length; i++) if (sal[i] >= SUB_CUT) k++;
  return sal.length ? k / sal.length : 0;
}
// the mode left (Cancel, Done): the view as it was on the page; keep: the draft held for Done's retry
function fixExit(keep) {
  const F = _fx;
  if (_fxS) fixStrokeEnd(false);
  fixOn = false;
  _fx = null;
  if (_fxRaf) {
    cancelAnimationFrame(_fxRaf);
    _fxRaf = 0;
  }
  if (F) {
    _fxZoom = { key: F.key, z: zoom, x: panX, y: panY };
    fixFree(F);
    if (!keep) F.ps = {};
    zoom = F.z0.z;
    panX = F.z0.x;
    panY = F.z0.y;
    clampPan();
    applyXform();
  }
  renderControls();
  render();
  positionPeekBtn();
  ctlRefocus('#sfPpFix');
}
function fixFree(F) {
  ['photo', 'tmp', 'maskC', 'lineC'].forEach(function (k) {
    if (F[k]) freeCanvas(F[k]);
    F[k] = null;
  });
}
// (a new picture, another stage, 20-image-input and 50-controls) the mode gone, its draft with it
function fixOff() {
  if (_fxS) {
    clearTimeout(_fxS.t);
    _fxS = null;
  }
  if (_fx) fixFree(_fx);
  if (_fxRetry && _fxRetry !== _fx) fixFree(_fxRetry);
  fixOn = false;
  _fx = null;
  _fxRetry = null;
}
function fixCancel() {
  if (_fx && _fx.asking) return;
  fixExit(false);
}
// Done: nothing changed, nothing made; else asked first when there's something to lose (okGeom: Cancel there keeps
// the mode and its strokes), the Undo step kept, the layer the guide's, and the page made again with it. A page that
// can't be made: the layer as it was, back in the mode with the strokes, said (ppRemade)
function fixDone() {
  const F = _fx;
  // (pressure test 7: not while the finder is asked, Use the finder's subject)
  if (!F || _ppBusy || F.asking) return;
  if (_fxS) fixStrokeEnd(true);
  const now = fixSubOf(F);
  let same = true;
  for (let i = 0; i < now.length && same; i++) if (now[i] !== F.sub0[i]) same = false;
  // (a pending Focus with the subject as it was, one chosen by hand: the Focus is still made)
  if (same && !(F.focus && F.share >= SUB_NONE)) {
    fixExit(false);
    return;
  }
  // (a Focus chosen with no subject chosen after all: as it was)
  if (F.focus && F.share < SUB_NONE) {
    fixExit(false);
    return;
  }
  okGeom(
    function () {
      const was = pp.fix,
        wasF = pp.f,
        marked =
          F.L.complete ||
          F.L.a.some(function (v) {
            return v !== 0;
          });
      pp.fix = marked ? fixEncode(F.L) : null;
      if (F.focus) pp.f = F.focus;
      _fxRetry = F;
      _fxFailed = false;
      fixExit(true);
      _fxMakeWord = 'Making the page with your subject…';
      ppRemade(false).then(function (ok) {
        const failed = _fxFailed;
        _fxFailed = false;
        if (_fxRetry !== F) return;
        _fxRetry = null;
        if (ok || !failed || !pp) {
          F.ps = {};
          return;
        }
        pp.fix = was;
        pp.f = wasF;
        const prep = ppPrepare();
        if (prep && prep.key === F.key) {
          fixSync(prep);
          fixOpen(prep, F);
        }
      });
    },
    true,
    function () {
      renderControls();
    },
  );
}
// (ppRemade's failure) the words when it was Done's page
function fixFailWords() {
  if (!_fxRetry) return null;
  _fxFailed = true;
  return 'Couldn’t make the page, so your subject fixes weren’t applied. Your fixes are still there to try again.';
}

// ---- the strokes (80-input: one finger; two fingers pinch, and end a stroke) ----
function fixPt(e) {
  const r = cv.getBoundingClientRect(),
    F = _fx;
  return {
    x: Math.floor(((e.clientX - r.left) / r.width) * F.w),
    y: Math.floor(((e.clientY - r.top) / r.height) * F.h),
  };
}
function fixStrokeStart(e) {
  const F = _fx;
  if (!F || !F.pc) return;
  const P = fixPt(e),
    s = {
      id: e.pointerId,
      p0: P,
      last: P,
      sx: e.clientX,
      sy: e.clientY,
      pend: true,
      v: 0,
      seen: new Uint8Array(F.pc.n),
      pc: F.pc,
      rec: { c: [], o: [] },
      t: 0,
    };
  _fxS = s;
  // (a finger waits a moment, or until it moves, so a second finger landing for a pinch changes nothing: as Paint)
  if (e.pointerType === 'mouse' || e.pointerType === 'pen') fixGo(s);
  else
    s.t = setTimeout(function () {
      if (_fxS === s) fixGo(s);
    }, 110);
}
function fixGo(s) {
  if (!s.pend) return;
  clearTimeout(s.t);
  s.pend = false;
  const F = _fx,
    P = s.p0;
  if (P.x < 0 || P.y < 0 || P.x >= F.w || P.y >= F.h) {
    s.v = 0;
    return;
  }
  // (the pixel under the first touch: on the subject, the stroke takes away; else it adds)
  s.v = F.disp[P.y * F.w + P.x] ? 2 : 1;
  fixDot(s, P);
  fixQueue();
}
function fixStrokeMove(e) {
  const s = _fxS;
  if (!s) return;
  const P = fixPt(e);
  if (s.pend) {
    if (Math.abs(e.clientX - s.sx) + Math.abs(e.clientY - s.sy) <= 6) return;
    fixGo(s);
  }
  if (!s.v) return;
  const dx = P.x - s.last.x,
    dy = P.y - s.last.y,
    n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))));
  for (let i = 1; i <= n; i++)
    fixDot(s, { x: Math.round(s.last.x + (dx * i) / n), y: Math.round(s.last.y + (dy * i) / n) });
  s.last = P;
  fixQueue();
}
function fixDot(s, P) {
  const F = _fx;
  if (!s.v || P.x < 0 || P.y < 0 || P.x >= F.w || P.y >= F.h) return;
  const k = s.pc.L[P.y * F.w + P.x];
  if (s.seen[k]) return;
  s.seen[k] = 1;
  fixSetPiece(F, s.pc, k, s.v, s.rec);
}
// the stroke over (tap: a touch let go before its moment, which counts)
function fixStrokeEnd(tap) {
  const s = _fxS,
    F = _fx;
  if (!s) return;
  _fxS = null;
  clearTimeout(s.t);
  if (!F) return;
  if (tap && s.pend) {
    s.pend = false;
    fixGo(s);
  }
  if (s.rec.c.length) {
    F.undo.push({ c: Int32Array.from(s.rec.c), o: Uint8Array.from(s.rec.o), v: s.v });
    if (F.undo.length > FIX_UNDO_MAX) F.undo.shift();
    F.redo = [];
  }
  fixReview(F);
  // (the pieces for the zoom now, held back during the stroke)
  if (F.want && F.ps[F.want]) F.pc = F.ps[F.want];
  fixQueue();
  fixPaneSync();
}
// Clear and Use the finder's subject: the whole layer, one Undo step
function fixWhole(empty) {
  const F = _fx;
  if (!F) return;
  if (_fxS) fixStrokeEnd(false);
  // (pressure test 11: the cells changed only, not two copies of the whole layer: a fine one is millions of cells)
  const a = F.L.a,
    c = [],
    o = [],
    c0 = F.L.complete;
  for (let i = 0; i < a.length; i++)
    if (a[i]) {
      c.push(i);
      o.push(a[i]);
      a[i] = 0;
    }
  F.L.complete = !!empty || !F.sal;
  F.undo.push({ c: Int32Array.from(c), o: Uint8Array.from(o), v: 0, comp: [c0, F.L.complete] });
  if (F.undo.length > FIX_UNDO_MAX) F.undo.shift();
  F.redo = [];
  fixReview(F);
  fixQueue();
  fixPaneSync();
  sayLive(empty ? 'Subject cleared' : 'The finder’s subject back');
}
function fixUndo() {
  const F = _fx;
  if (!F || !F.undo.length) return;
  if (_fxS) fixStrokeEnd(false);
  const u = F.undo.pop(),
    a = F.L.a;
  for (let i = u.c.length - 1; i >= 0; i--) a[u.c[i]] = u.o[i];
  if (u.comp) F.L.complete = u.comp[0];
  F.redo.push(u);
  fixReview(F);
  fixQueue();
  fixPaneSync();
}
function fixRedo() {
  const F = _fx;
  if (!F || !F.redo.length) return;
  if (_fxS) fixStrokeEnd(false);
  const u = F.redo.pop(),
    a = F.L.a;
  for (let i = 0; i < u.c.length; i++) a[u.c[i]] = u.v;
  if (u.comp) F.L.complete = u.comp[1];
  F.undo.push(u);
  fixReview(F);
  fixQueue();
  fixPaneSync();
}
// (87-undo planBtn) the tool row's Undo and Redo while the mode is open: the draft's
function fixBtns(b, r) {
  const F = _fx,
    on = !!(F && F.undo.length),
    ron = !!(F && F.redo.length);
  if (b) {
    b.style.display = '';
    b.style.visibility = on ? '' : 'hidden';
    b.setAttribute('aria-label', 'Undo the last change to the subject');
    b.title = 'Undo the last change to the subject';
  }
  if (r) {
    r.style.display = ron ? '' : 'none';
    r.setAttribute('aria-label', 'Redo the change to the subject');
    r.title = 'Redo the change to the subject';
  }
}

// ---- drawing ----
function fixQueue() {
  if (_fxRaf) return;
  _fxRaf = requestAnimationFrame(function () {
    _fxRaf = 0;
    if (fixOn && _fx) {
      fixMasks(_fx);
      fixDraw();
    }
  });
}
// the subject (a mask, at the working size) and the lines (its outline in the accent, the pieces' borders faint)
function fixMasks(F) {
  const w = F.w,
    h = F.h,
    n = w * h,
    mg = F.maskC.getContext('2d'),
    lg = F.lineC.getContext('2d'),
    md = mg.createImageData(w, h),
    ld = lg.createImageData(w, h),
    M = md.data,
    D = ld.data,
    s = F.disp,
    bd = F.pc ? F.pc.bd : null;
  let ac = FIX_ACCENT;
  try {
    ac = getComputedStyle(document.documentElement).getPropertyValue('--accent-ink').trim() || FIX_ACCENT;
  } catch (_) {}
  const m = /^#([0-9a-f]{6})$/i.exec(ac),
    ar = m ? parseInt(m[1].slice(0, 2), 16) : 185,
    agg = m ? parseInt(m[1].slice(2, 4), 16) : 168,
    ab = m ? parseInt(m[1].slice(4, 6), 16) : 255;
  for (let p = 0; p < n; p++) {
    const x = p % w,
      v = s[p],
      j = p * 4;
    if (v) {
      M[j] = M[j + 1] = M[j + 2] = 255;
      M[j + 3] = 255;
    }
    const e =
      (x < w - 1 && s[p + 1] !== v) ||
      (x > 0 && s[p - 1] !== v) ||
      (p + w < n && s[p + w] !== v) ||
      (p >= w && s[p - w] !== v);
    if (e) {
      D[j] = ar;
      D[j + 1] = agg;
      D[j + 2] = ab;
      D[j + 3] = 255;
    } else if (bd && bd[p]) {
      D[j] = D[j + 1] = D[j + 2] = 255;
      D[j + 3] = 36;
    }
  }
  mg.putImageData(md, 0, 0);
  lg.putImageData(ld, 0, 0);
}
// (10-segment render) the mode's picture: the photo dimmed and a little greyed, its subject bright, the lines over
function fixDraw() {
  _rg = null;
  const F = _fx;
  if (!F || !F.photo) return;
  sizeCanvas();
  if (cv.width !== W || cv.height !== H) {
    cv.width = W;
    cv.height = H;
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(F.photo, 0, 0);
  ctx.fillStyle = 'rgba(30,30,34,0.64)';
  ctx.fillRect(0, 0, W, H);
  const tg = F.tmp.getContext('2d');
  tg.globalCompositeOperation = 'copy';
  tg.imageSmoothingEnabled = true;
  tg.drawImage(F.maskC, 0, 0, W, H);
  tg.globalCompositeOperation = 'source-in';
  tg.drawImage(F.photo, 0, 0);
  tg.globalCompositeOperation = 'source-over';
  ctx.drawImage(F.tmp, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(F.lineC, 0, 0, W, H);
  ctx.imageSmoothingEnabled = true;
}

// ---- the mode's pane (50-controls _renderControls), in place of the page step's controls ----
const FIX_SMALL_SAY =
  'The subject is too small a part of this photo for Subject only, so the page would be made Even. Crop to the subject after Done instead.';
function ctlFix() {
  const F = _fx;
  if (!F) return;
  ctlEl.innerHTML =
    '<div class="sfpane sffixp"><h3 class="sfedhead" id="sfFixHead" tabindex="-1">' +
    (F.choose ? 'Choose the subject' : 'Fix the subject') +
    '</h3><div class="sfc-note sfedline" id="sfFixIns">' +
    (F.choose
      ? 'Tap or drag on the photo to choose the subject. Start on a part you’ve chosen to take it away again. Use two fingers to zoom and move; zoomed in, the pieces are smaller.'
      : 'Tap or drag on the photo. Start on the background to add parts to the subject, or start on the subject to take parts away. Use two fingers to zoom and move; zoomed in, the pieces are smaller.') +
    '</div>' +
    (F.pc
      ? ''
      : '<div class="sfc-note sfc-mt8" id="sfFixLoad" role="status">Getting the pieces ready…</div>') +
    '<div class="sffixlinks"><button type="button" class="sflink" id="sfFixUndo">Undo</button><span class="sfdot" aria-hidden="true">·</span><button type="button" class="sflink" id="sfFixClear">Clear</button>' +
    (F.finder || F.canAsk
      ? '<span class="sfdot" aria-hidden="true">·</span><button type="button" class="sflink" id="sfFixFinder">Use the finder’s subject</button>'
      : '') +
    '</div><div class="sffixacts"><button type="button" class="sfghost" id="sfFixCancel">Cancel</button><button type="button" class="sfprimary" id="sfFixDone">Done</button></div>' +
    '<div class="sfc-note sfc-mt8" id="sfFixSmall" hidden>' +
    FIX_SMALL_SAY +
    '</div>' +
    (hasEdits
      ? '<div class="sfc-note sfc-mt8" id="sfFixEd">Your section edits will go when you tap Done; Undo brings them back.</div>'
      : '') +
    '</div>';
  const on = function (id, fn) {
    const b = document.getElementById(id);
    if (b) b.addEventListener('click', fn);
  };
  on('sfFixUndo', fixUndo);
  on('sfFixClear', function () {
    fixWhole(true);
  });
  on('sfFixFinder', fixUseFinder);
  on('sfFixCancel', fixCancel);
  on('sfFixDone', fixDone);
  fixPaneSync();
}
// Use the finder's subject: back to the finder's own map (the layer emptied, one Undo step); for a subject chosen by
// hand where the finder never ran, the finder is asked first ("Finding the subject…"), once
function fixUseFinder() {
  const F = _fx;
  if (!F || F.asking) return;
  if (F.finder) {
    fixWhole(false);
    return;
  }
  if (!F.canAsk) return;
  const prep = F.prep,
    s0 = prep.sal;
  F.asking = true;
  fixPaneSync();
  note('Finding the subject…');
  prep.sal = null;
  prep.salF = undefined;
  subMap(prep, true)
    .then(function () {
      F.asking = false;
      F.canAsk = false;
      note(metaText());
      if (_fx !== F) return;
      F.sal = prep.salF;
      F.finder = !!F.sal && fixFinderShare(F.sal) >= SUB_NONE;
      if (F.finder) fixWhole(false);
      else note('No clear subject found in this photo.');
      renderControls();
    })
    .catch(function (e) {
      F.asking = false;
      F.canAsk = false;
      prep._fxTried = true;
      prep.sal = s0;
      prep.salF = null;
      const k = subFailKind(e);
      if (k) errLog('Fix the subject', e);
      note(
        k
          ? SUB_OFF_SAID[k].replace(', so the page is made Even', '')
          : errNote('Couldn’t find the photo’s subject.', 'Focus', e),
      );
      if (_fx === F) renderControls();
    });
}
// the pane's state without drawing it again: Undo, Clear and the finder's subject as they can be, the small note
function fixPaneSync() {
  const F = _fx;
  if (!F) return;
  const u = document.getElementById('sfFixUndo'),
    c = document.getElementById('sfFixClear'),
    s = document.getElementById('sfFixSmall');
  if (u) u.disabled = !F.undo.length;
  const dn = document.getElementById('sfFixDone'),
    cn = document.getElementById('sfFixCancel'),
    fd = document.getElementById('sfFixFinder');
  if (dn) dn.disabled = !!F.asking;
  if (cn) cn.disabled = !!F.asking;
  if (fd) fd.disabled = !!F.asking;
  if (c) c.disabled = F.share === 0 && F.L.complete;
  if (s) s.hidden = !(pp && (F.focus || pp.f) === 'subject' && F.share >= SUB_NONE && F.share < SUB_FEW);
  if (typeof planBtn === 'function') planBtn();
}

// ---- (step 7) Copy diagnostics and Send feedback (safety.js diagHead, through SF.subjectDiag): the photo-made page's
// subject, one line: found by the finder, fixed by hand (how much of the photo the fixes changed) or chosen by hand;
// '' when the page has none to speak of ----
function fixDiagLine() {
  if (!pp || !srcImg) return '';
  const pr = _ppPrep && _ppPrep.key === ppPrepKey() ? _ppPrep : null;
  if (pr) fixBind(pr);
  const L = fixLayer(),
    fits = !!(L && pr && fixFits(L, pr.keep));
  if (L && L.complete && (fits || !pr)) return 'Subject: chosen by hand';
  if (L && fits && pr.salF) {
    const n = Math.round(fixShare(pr.salF, fixView(L, pr.keep, pr.w, pr.h), false) * 100);
    return 'Subject: fixed by hand (' + (n < 1 ? 'under 1' : n) + '% of the photo changed)';
  }
  if (L && !pr) return 'Subject: fixed by hand';
  if (pr && (pr.salF || pr.sal)) return 'Subject: found';
  return '';
}
