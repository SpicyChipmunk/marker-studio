/* ---- (v318.34) the source picture, kept with the guide ----
    A guide built from a picture (a photo, scan, download or PDF page; not the sample) keeps that picture on this
    device, so Edit sections' Adjust photo (turn, straighten, crop, tilt, enhance, sensitivity) works after the guide
    is opened again, as it does on a first build. Two parts, so the settings and the sections can never disagree:
    - the picture, in a record of its own beside the guide's ('src-<id>' in the guides' store): { u: a data: URL
      (JPEG q 0.9; a PNG for a scan or PDF page when smaller), w, h, ts, kind: 'photo' | 'scan' | 'pdf' }, checked by
      guide-bridge's srcRecOk (SRC_MAX). It is the picture as it came in at working size (pgOrig, at most MAXSIDE),
      before straightening, turning and cropping, so every step can be done again or undone from it;
    - its settings, in the guide's payload as `src` (saved with the sections, 60-persist currentDesignObj): the page's
      corners and shape, the lens, turn, tilt, crop, Enhance, Sensitivity and the faint cut the sections were found
      with (srcSettings / srcOpen).
    Written after the guide's first save (srcKeep, from 60-persist firstSave); a write that fails never blocks the
    guide: it says so once, and the guide behaves as one saved before v318.34 (Adjust photo's note, 53-controls-stages).
    Nothing is read when a guide opens: Adjust photo opened reads and decodes the record (srcLoad), with a loading
    state meanwhile, rebuilds srcImg through the same straighten / turn / crop path and prepares gray (srcPrep) so
    the controls work as on a first build (a change still asks before clearing progress: okGeom / resegment).
    Deleted with the guide (guide-bridge sfDeleteDesign, library.js libPurge), back with Put back (the record stays
    until the purge); copied by Save a copy, the "(section edits)" copy and Duplicate (srcCopy); in a backup only
    when "Include guide photos" is ticked (gatherGuides); never in a guide file. Reset progress keeps it. */
const SRC_SIDE = MAXSIDE,
  SRC_Q = 0.9,
  // (v318.37: how far, in pixels, a picture rebuilt from a saved guide's settings may be from the saved map's size
  // and still be fitted to it, srcPlace. v319: for settings saved from v319 on (v: 2, exact crop and corners), where a
  // picture further off than a rounding isn't the sections' picture)
  SRC_FIT = 2,
  // (v319, Y2-1) and for settings saved before (v: 1, the crop and corners rounded to 1/100: v318.34–36, and v318.37
  // for a guide it fitted), as a share of the map's long side: a crop edge rounded to 1/100 moves it by up to 1/200
  // of the picture's side, which the enlargement to UPSIDE (srcUp, a crop of half the picture doubled) makes up to
  // 1/100 of the map's. 2 px rescued a quarter of such guides enlarged from 850 × 1100 and a tenth at 1800 × 2400
  // (Fable's fitsim, R37 Y2); 1/100 of the long side rescues 97 % (the rest sit across srcPrep's 1.05 enlargement
  // step and are not within reach), 0.006 about 85 %. The resample feeds later re-detections only; the saved
  // sections are untouched either way
  SRC_FIT_LEGACY = 0.01;
// how the open picture came in: 'pic' (a photo, scan or download: 20-image-input), 'pdf' (21-pdf), null (the sample,
// or a guide opened again without its picture)
let _srcPre = null,
  srcFrom = null,
  // the settings a guide opened again was saved with (its payload's `src`), carried into its saves until the picture
  // is in memory again
  _srcSet = null,
  // the open guide's record: id, loadGen it was read for, whether it was looked for, the record, loading, and the
  // picture object (pgOrig or srcImg) a record was last written for, with its id (so one picture is written once)
  _src = { id: null, gen: -1, read: false, rec: null, busy: false, miss: false },
  _srcWrote = null;
function srcKey(id) {
  return 'src-' + id;
}
// the guide's picture as it came in, when it's in memory (not the sample's)
function srcPic() {
  return srcFrom ? pgOrig || srcImg : null;
}
// what kind of picture: the page was straightened or the camera said its lens → a photo; a PDF's page; otherwise a
// scan or a download
function srcKind() {
  if (srcFrom === 'pdf') return 'pdf';
  // (v325: a photo made into a page, 47-photo-page)
  if (ppOn()) return 'photo';
  return pgQ || pgF35 > 0 ? 'photo' : 'scan';
}
// the settings the sections were found with, for the payload's `src`; null for a guide with no picture of its own
let _srcLegacy = false;
function srcSettings() {
  if (!srcPic()) return _srcSet;
  const r = function (v) {
    return Math.round(v * 100) / 100;
  };
  const o = {
    // (v319: 2 marks the crop and corners saved exactly, so srcPlace fits a rebuilt picture by SRC_FIT, not the
    // legacy allowance)
    v: _srcLegacy ? 1 : 2,
    k: srcKind(),
    rot: rot90 || 0,
    tilt: r(tilt || 0),
    enh: enhance ? 1 : 0,
    c: adaptC,
  };
  // (v318.37: the corners and the crop as they are, not rounded to 1/100: srcPlace must rebuild a picture of exactly
  // the sections' size, and a crop edge rounded to 1/100 moved it by up to 12 px, so every cropped guide lost its
  // picture on reopening; JSON keeps the doubles exactly, and srcCheck clamps them)
  if (pgQ)
    o.q = pgQ.map(function (p) {
      return [+p[0], +p[1]];
    });
  if (pgShape) o.shape = pgShape;
  if (pgHint) o.hint = pgHint;
  if (pgF35 > 0) o.f35 = r(pgF35);
  if (srcUp) o.up = 1;
  if (cropRect) o.crop = { x: +cropRect.x, y: +cropRect.y, w: +cropRect.w, h: +cropRect.h };
  if (sensUser) o.su = 1;
  if (faintCut) o.fc = faintCut;
  return o;
}
// a saved guide's `src`, checked and kept in range (null when there is none, or it can't be used)
function srcCheck(s) {
  if (!s || typeof s !== 'object' || Array.isArray(s)) return null;
  const num = function (v, lo, hi, d) {
      return typeof v === 'number' && isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d;
    },
    o = {
      // (v319: the mark kept, 1 for anything without it: srcFit)
      v: s.v === 2 ? 2 : 1,
      k: ['photo', 'scan', 'pdf'].indexOf(s.k) >= 0 ? s.k : 'scan',
      rot: [0, 90, 180, 270].indexOf(s.rot) >= 0 ? s.rot : 0,
      tilt: num(s.tilt, -8, 8, 0),
      enh: s.enh === 0 ? 0 : 1,
      c: Math.round(num(s.c, 1, 16, 9)),
    };
  if (
    Array.isArray(s.q) &&
    s.q.length === 4 &&
    s.q.every(function (p) {
      return Array.isArray(p) && p.length === 2 && isFinite(p[0]) && isFinite(p[1]);
    })
  )
    o.q = s.q.map(function (p) {
      return [+p[0], +p[1]];
    });
  if (['letter', 'a4', 'square'].indexOf(s.shape) >= 0) o.shape = s.shape;
  if (s.hint === 'kept') o.hint = 'kept';
  if (typeof s.f35 === 'number' && s.f35 > 0 && s.f35 < 1000) o.f35 = s.f35;
  if (s.up === 1) o.up = 1;
  if (s.crop && typeof s.crop === 'object') {
    const c = {
      x: num(s.crop.x, 0, 1, 0),
      y: num(s.crop.y, 0, 1, 0),
      w: num(s.crop.w, 0, 1, 1),
      h: num(s.crop.h, 0, 1, 1),
    };
    if (c.w > 0 && c.h > 0 && !(c.x === 0 && c.y === 0 && c.w === 1 && c.h === 1)) o.crop = c;
  }
  if (s.su === 1) o.su = 1;
  if (typeof s.fc === 'number' && s.fc > 0 && s.fc <= 255) o.fc = s.fc;
  return o;
}
// a guide opening (97-open): its settings, so the controls show them, and the record is looked for only when
// Adjust photo opens (srcLoad). Nothing is read here
function srcOpen(s) {
  _srcPre = null;
  _srcSet = srcCheck(s);
  srcFrom = null;
  _src = { id: curId, gen: loadGen, read: false, rec: null, busy: false, miss: false };
  if (!_srcSet) return;
  rot90 = _srcSet.rot;
  tilt = _srcSet.tilt;
  cropRect = _srcSet.crop ? Object.assign({}, _srcSet.crop) : null;
  enhance = !!_srcSet.enh;
  adaptC = _srcSet.c;
  sensUser = !!_srcSet.su;
  faintCut = _srcSet.fc || 0;
  pgShape = _srcSet.shape || null;
  pgHint = _srcSet.hint || null;
  pgF35 = _srcSet.f35 || 0;
}
// a guide opened again may have its picture: its settings are known and the record hasn't been found missing
function srcMay() {
  return !srcImg && !!_srcSet && curId != null && !(_src.id === curId && _src.gen === loadGen && _src.miss);
}
function srcLoading() {
  return _src.busy && _src.id === curId && _src.gen === loadGen;
}
// the record, as a data: URL, from the picture as it came in: a JPEG; for a scan or a PDF page a PNG too, kept when
// smaller (line art is often smaller lossless, and exact).
// (v324) Encoded with toBlob and read back as a data: URL: the same file toDataURL makes, but the browser encodes it
// away from the page's thread where it can (a photo's JPEG had held the page up for about 0.35 s just after a new
// guide's first save; 1.4 s with the processor slowed 4×). Where there's no toBlob, toDataURL as before.
// (v324.1) The JPEG is started as the picture opens (srcPrewarm), while its sections are found, so by the first save
// it's ready and the record is written in the same moment as the guide, as before v324: waited for then, a reload
// just after Build lost the photo (the guide stayed, without it). _srcPre: above, with the other state
function srcDraw(pic) {
  const w0 = pic.naturalWidth || pic.width,
    h0 = pic.naturalHeight || pic.height,
    k = Math.min(1, SRC_SIDE / Math.max(w0, h0)),
    t = document.createElement('canvas');
  t.width = Math.max(1, Math.round(w0 * k));
  t.height = Math.max(1, Math.round(h0 * k));
  const g = t.getContext('2d');
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  // (v328 review: on white, as the picture is read: a JPEG keeps a cut-out PNG's clear parts as black, and a page made
  // from it again after reopening had a black background)
  g.fillStyle = '#fff';
  g.fillRect(0, 0, t.width, t.height);
  if (k < 1) drawShrunk(g, pic, t.width, t.height);
  else g.drawImage(pic, 0, 0);
  return t;
}
// a canvas `t` encoded as `type`, as a data: URL (toBlob, else toDataURL)
function srcCanvasURL(t, type, q) {
  if (!t.toBlob || typeof FileReader === 'undefined') return Promise.resolve(t.toDataURL(type, q));
  return new Promise(function (res, rej) {
    t.toBlob(
      function (b) {
        if (!b) return rej(new Error('no blob'));
        const f = new FileReader();
        f.onload = function () {
          res(f.result);
        };
        f.onerror = rej;
        f.readAsDataURL(b);
      },
      type,
      q,
    );
  });
}
// the picture `pic` drawn once, now, and encoded as each of `types` ([type, quality]): a promise each, of a data: URL
// or null; the canvas freed once they're all done
function srcURLs(pic, types) {
  const t = srcDraw(pic),
    ps = types.map(function (x) {
      return srcCanvasURL(t, x[0], x[1]).catch(function () {
        return null;
      });
    });
  Promise.all(ps).then(function () {
    freeCanvas(t);
  });
  return ps;
}
// (v324.1) a picture just opened (a photo, a scan, a PDF's page): its JPEG begun now, for the first save, and its PNG
// too unless the camera said it's a photo (png: a scan or a PDF's page keeps the smaller), from one drawing. One kept
// at a time; a failure is forgotten (the save then encodes it itself)
function srcPrewarm(pic, png) {
  if (!pic || typeof IDB === 'undefined' || (_srcPre && _srcPre.pic === pic)) return;
  _srcPre = null;
  try {
    const ps = srcURLs(pic, png ? [['image/jpeg', SRC_Q], ['image/png']] : [['image/jpeg', SRC_Q]]);
    _srcPre = { pic: pic, jpg: ps[0], png: ps[1] || null };
  } catch (_) {
    _srcPre = null;
  }
}
function srcEncode(pic, kind) {
  const w0 = pic.naturalWidth || pic.width,
    h0 = pic.naturalHeight || pic.height,
    k = Math.min(1, SRC_SIDE / Math.max(w0, h0)),
    tw = Math.max(1, Math.round(w0 * k)),
    th = Math.max(1, Math.round(h0 * k)),
    pre = _srcPre && _srcPre.pic === pic ? _srcPre : null;
  return Promise.all([pre && pre.jpg, kind === 'photo' ? 'none' : pre && pre.png])
    .then(function (r) {
      // (what wasn't encoded ahead, or failed then, encoded now, from one drawing)
      const need = [];
      if (!r[0]) need.push(['image/jpeg', SRC_Q]);
      if (!r[1]) need.push(['image/png']);
      if (!need.length) return r;
      return Promise.all(srcURLs(pic, need)).then(function (x) {
        if (x.indexOf(null) >= 0) throw new Error('not encoded');
        return [r[0] || x.shift(), r[1] || x.shift()];
      });
    })
    .then(function (r) {
      return kind !== 'photo' && r[1].length < r[0].length ? r[1] : r[0];
    })
    .then(function (u) {
      return { u: u, w: tw, h: th, ts: Date.now(), kind: kind };
    });
}
// the open guide's picture written beside the guide `id` (just saved), once per picture; a failure is said once and
// never holds the guide up. Resolves true when a record is in place
function srcKeep(id) {
  return srcWrite(id, srcPic(), srcKind(), true);
}
// (v318.37) the guide `id`'s first save landed after the person opened something else (60-persist firstSave): the
// picture in memory is the next one's by then, so the one the save was of, taken before it, is written from here,
// when the guide hasn't a record already (a Put back whose record stayed). Nothing is said of the open guide
function srcKeepLate(id, pic, kind) {
  if (id == null || !pic || typeof IDB === 'undefined') return Promise.resolve(false);
  return IDB.get(srcKey(id))
    .catch(function () {
      return null;
    })
    .then(function (r) {
      return srcRecOk(r) ? true : srcWrite(id, pic, kind, false);
    });
}
// the picture `pic` (of kind `kind`) encoded and written as the guide `id`'s record; mark: it's the open guide's,
// noted in _srcWrote so it's written once. Resolves true when a record is in place
function srcWrite(id, pic, kind, mark) {
  if (id == null || !pic || typeof IDB === 'undefined') return Promise.resolve(false);
  // (a picture freed since it was taken: nothing to write)
  if (!(pic.naturalWidth || pic.width) || !(pic.naturalHeight || pic.height)) return Promise.resolve(false);
  if (mark && _srcWrote && _srcWrote.id === id && _srcWrote.pic === pic) return Promise.resolve(true);
  // (v324: noted before the encoding, now waited for, so a second save meanwhile doesn't write it again)
  const mine = { id: id, pic: pic };
  if (mark) _srcWrote = mine;
  let rec = null;
  let enc;
  try {
    enc = srcEncode(pic, kind);
  } catch (e) {
    enc = Promise.reject(e);
  }
  return enc
    .catch(function () {
      return null;
    })
    .then(function (r) {
      rec = r;
      if (!srcRecOk(rec)) {
        if (_srcWrote === mine) _srcWrote = null;
        // (v319, Y2-2: a record over SRC_MAX is the photo's size, not the storage's)
        srcFail(id, rec && typeof rec.u === 'string' && rec.u.length >= SRC_MAX ? 'big' : '');
        return false;
      }
      return IDB.put(srcKey(id), rec).then(ok, bad);
    });
  function ok() {
    if (_src.id === id) {
      _src.rec = rec;
      _src.read = true;
      _src.miss = false;
    }
    return true;
  }
  function bad() {
    if (_srcWrote === mine) _srcWrote = null;
    srcFail(id);
    return false;
  }
}
// (a guide deleted while open, then Put back after its record was purged: its picture is written again from the one
// in memory, when it is; as 24-page-photo's finPutBack)
function srcPutBack(id) {
  if (id == null || !srcPic() || typeof IDB === 'undefined') return;
  IDB.get(srcKey(id))
    .catch(function () {
      return null;
    })
    .then(function (r) {
      if (srcRecOk(r)) return;
      if (_srcWrote && _srcWrote.id === id) _srcWrote = null;
      srcKeep(id);
    });
}
// said once per guide: the guide is saved, its picture isn't (why: 'big', the encoded photo is over SRC_MAX; else the
// write failed, v319)
let _srcSaid = null;
function srcFail(id, why) {
  if (_srcSaid === id) return;
  _srcSaid = id;
  toast(
    'The guide is saved, but its photo ' +
      (why === 'big'
        ? 'is too big to keep with it'
        : 'couldn’t be kept with it (this browser’s storage may be full)') +
      ', so it can’t be turned or cropped again later.',
    8000,
  );
}
// a copy of the guide `from` saved as `to` (Save a copy, a "(section edits)" copy, Duplicate): its picture goes with
// it; with no record (the write failed, or an older guide), the picture in memory when it's the open guide's
function srcCopy(from, to) {
  if (from == null || to == null || from === to || typeof IDB === 'undefined') return Promise.resolve(false);
  return IDB.get(srcKey(from))
    .catch(function () {
      return null;
    })
    .then(function (r) {
      if (srcRecOk(r))
        return IDB.put(srcKey(to), r).then(function () {
          return true;
        });
      return from === curId ? srcKeep(to) : false;
    })
    .catch(function () {
      return false;
    });
}
// Adjust photo opened for a guide whose picture isn't in memory: the record read and decoded, srcImg built from it
// as the sections were (the page straightened from its corners, then turned, tilted and cropped as srcPrep does),
// and gray prepared, so the controls work as on a first build. The sections stay as they are (no segment). Draws
// the controls again when done; with no record, or one that doesn't give the saved map's size, the note stays
function srcLoad() {
  if (!srcMay() || srcLoading()) return;
  const id = curId,
    gen = loadGen,
    set = _srcSet,
    live = function () {
      return curId === id && loadGen === gen && !srcImg;
    },
    done = function (ok) {
      if (_src.id === id && _src.gen === gen) {
        _src.busy = false;
        _src.read = true;
        if (!ok) _src.miss = true;
      }
      if (curId === id && loadGen === gen) renderControls();
      // (v325: a photo-made page waiting for its photo to be made again, 47-photo-page)
      ppLoaded(ok && curId === id && loadGen === gen);
    };
  _src = { id: id, gen: gen, read: false, rec: null, busy: true, miss: false };
  IDB.get(srcKey(id))
    .catch(function () {
      return null;
    })
    .then(function (r) {
      if (!live()) return done(false);
      if (!srcRecOk(r)) return done(false);
      _src.rec = r;
      const im = new Image();
      im.onload = function () {
        if (!live()) return done(false);
        let ok = false;
        try {
          ok = srcPlace(im, r, set);
        } catch (e) {
          ok = false;
        }
        done(ok);
      };
      im.onerror = function () {
        done(false);
      };
      im.src = r.u;
    });
}
// (v319, Y2-1) how far, in pixels, a picture rebuilt from the settings `set` may be from the saved map (W × H) and
// still be fitted to it: SRC_FIT for settings saved exactly (v: 2), else SRC_FIT_LEGACY of the long side (at least
// SRC_FIT)
function srcFit(set, W, H) {
  if (set && set.v >= 2) return SRC_FIT;
  return Math.max(SRC_FIT, Math.ceil(SRC_FIT_LEGACY * Math.max(W || 0, H || 0)));
}
// the decoded picture put in place as the guide's (srcLoad): false when it doesn't fit the saved sections
function srcPlace(im, r, set) {
  if (ppOn()) return srcPlacePp(im, set);
  const keep = {
    srcImg: srcImg,
    pgOrig: pgOrig,
    pgQ: pgQ,
    srcUp: srcUp,
    gray: gray,
    chroma: chroma,
    srcColour: srcColour,
    srcK: srcK,
    srcDims: srcDims,
    bands: edgeBands,
  };
  srcFrom = r.kind === 'pdf' || set.k === 'pdf' ? 'pdf' : 'pic';
  pgOrig = srcFrom === 'pdf' ? null : im;
  pgF35 = set.f35 || 0;
  pgShape = set.shape || null;
  pgHint = set.hint || null;
  srcUp = !!set.up;
  pgQ = null;
  srcImg = im;
  if (set.q && pgOrig) {
    const iw = im.naturalWidth || im.width,
      ih = im.naturalHeight || im.height,
      sh = pgShapeOf(set.q, iw, ih, pgF35, pgShape);
    srcImg = pgWarp(pgOrig, set.q, sh.aspect);
    pgQ = set.q.map(function (p) {
      return p.slice();
    });
  }
  rot90 = set.rot;
  tilt = set.tilt;
  cropRect = set.crop ? Object.assign({}, set.crop) : null;
  const p = srcPrep();
  // (v318.37: a guide saved before v318.37 kept its crop and corners rounded to 1/100, so the picture rebuilt from
  // them can be a few pixels off the saved map's size: that close (srcFit: SRC_FIT, or the legacy allowance for
  // settings without v319's mark), its grey and colour are resampled to the map's size, grayUp, rather than the
  // picture given up; the settings stay as saved, and a control changed finds the sections again from the picture
  // as before. Further off, it isn't the picture the sections came from)
  const fit = srcFit(set, W, H);
  // (v328 review: placed by the legacy allowance, its settings are still the rounded ones: saved again as such,
  // srcSettings, not as exact, or the next opening's 2 px allowance lost the picture)
  _srcLegacy = !!(p && (p.W !== W || p.H !== H) && !(set && set.v >= 2));
  if (p && (p.W !== W || p.H !== H) && Math.abs(p.W - W) <= fit && Math.abs(p.H - H) <= fit) {
    p.gray = grayUp(p.gray, p.W, p.H, W, H);
    if (p.chroma) p.chroma = grayUp(p.chroma, p.W, p.H, W, H);
    p.W = W;
    p.H = H;
  }
  if (!p || p.W !== W || p.H !== H) {
    // (not the picture the sections were found from: left as a guide without one)
    if (srcImg !== im && srcImg !== keep.srcImg) freeCanvas(srcImg);
    srcImg = keep.srcImg;
    pgOrig = keep.pgOrig;
    pgQ = keep.pgQ;
    srcUp = keep.srcUp;
    srcFrom = null;
    return false;
  }
  gray = p.gray;
  chroma = p.chroma || null;
  srcColour = p.colour;
  srcK = p.srcK;
  srcDims = null;
  if (p.bands !== undefined) edgeBands = p.bands;
  bindBands = p.bind || null;
  // (the picture this guide was saved with: nothing to write again unless it's copied)
  _srcWrote = { id: curId, pic: pgOrig || srcImg };
  return true;
}
// (v325) a photo made into a page: the photo itself is the picture (no page to straighten, nothing to find in it), and
// what's under the guide stays the page drawn from the section map (97-open). It fits when the page it would be made
// into is the saved map's size (ppSize, from the turn and crop); a Detail change or a remake then works from it
function srcPlacePp(im, set) {
  const keep = { srcImg: srcImg, pgOrig: pgOrig, rot: rot90, tilt: tilt, crop: cropRect };
  srcImg = im;
  pgOrig = im;
  pgQ = null;
  srcUp = false;
  pgF35 = set.f35 || 0;
  rot90 = set.rot;
  tilt = 0;
  cropRect = set.crop ? Object.assign({}, set.crop) : null;
  const z = ppSize();
  if (z.GW !== W || z.GH !== H) {
    srcImg = keep.srcImg;
    pgOrig = keep.pgOrig;
    rot90 = keep.rot;
    tilt = keep.tilt;
    cropRect = keep.crop;
    return false;
  }
  srcFrom = 'pic';
  _srcWrote = { id: curId, pic: im };
  return true;
}
