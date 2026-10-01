// a guide's own settings: everything starts from the defaults, then takes what the file says (checked and kept in
// range, so nothing from the guide open before carries over and a hand-edited file can't break the controls).
// The style and the Sections screen's settings come from STYLE_FIELDS (05-style-fields); the shading, the
// flat sections and the photo are opened further on in openDesignObj.
function styleFrom(d) {
  styleOpen(d.style && typeof d.style === 'object' ? d.style : {}, 'style');
  styleOpen(d, 'payload');
  // (the photo's see-through goes back to its default even when the guide has no photo)
  photoOp = 0.65;
}
// a marker from the catalogue that isn't in the collection (dry, or no longer owned), to show a saved guide as it is
function catMarker(k) {
  let i = null;
  try {
    i = keyIdx(k);
  } catch (_) {}
  if (i == null || typeof COLORS === 'undefined' || !COLORS[i]) return null;
  const c = COLORS[i],
    hs = (typeof HS !== 'undefined' && HS[i]) || {};
  let lab = null;
  try {
    lab = hexToLab(c.hex);
  } catch (_) {
    const inf = api.markerInfo ? api.markerInfo(k) : null;
    lab = inf && inf.lab;
  }
  return {
    mkey: k,
    code: c.code,
    brand: c.brand,
    hex: c.hex,
    name: c.name,
    hue: hs.h || 0,
    lab: lab,
    sat: hs.s || 0,
    pass: false,
    fam: c.fam,
  };
}
function markerDry(k) {
  try {
    const i = keyIdx(k);
    return i != null && isOwned(i) && isDry(i);
  } catch (_) {
    return false;
  }
}
// quiet: reloaded in place (a backup replaced it) without bringing the guide screen forward
function openDesignObj(d, id, resumed, quiet, col) {
  if (!quiet) {
    root.style.display = '';
    if (!document.getElementById('sfPick')) mount();
  }
  _smpLoad = false;
  const gen = ++loadGen,
    // (from Home's Continue: taken here, so no other open finds it left on)
    cont = _contNext;
  _contNext = false;
  hideTip();
  if (!d || typeof d.lmap !== 'string' || !/^data:image\/png;base64,/.test(d.lmap)) {
    // (from the Library, id: its stored copy is missing or unreadable; otherwise a file that isn't a guide)
    note(
      id != null && !d
        ? 'Couldn’t open that guide \u2014 its stored copy is missing from this browser. A backup or guide file can bring it back.'
        : 'Couldn’t load that guide \u2014 the file isn\u2019t a Marker Studio guide.',
    );
    return;
  }
  note('Opening guide\u2026');
  const img = new Image();
  img.onload = function () {
    if (gen !== loadGen) return;
    try {
      if (!(img.width > 0 && img.height > 0 && img.width <= MAXSIDE * 2 && img.height <= MAXSIDE * 2)) {
        note('Couldn’t load that guide \u2014 its picture is the wrong size.');
        return;
      }
      // a section map with a different section on nearly every pixel would take all the memory there is: turned away first
      const _lm = lmapRead(img);
      if (!_lm) {
        note('Couldn’t load that guide \u2014 its picture didn\u2019t decode.');
        return;
      }
      if (lmapCount(_lm, MAXSECS) > MAXSECS) {
        note(TOO_COMPLEX);
        return;
      }
      resetForNewPicture();
      if (resumed) slotClaim();
      pgOrig = null;
      srcImg = null;
      shadeReset();
      gray = null;
      adj = null;
      edgeDist = null;
      labelPts = null;
      texField = null;
      _rg = null;
      W = img.width;
      H = img.height;
      cv.width = W;
      cv.height = H;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const data = _lm,
        n = W * H,
        raw = new Int32Array(n);
      labels = new Int32Array(n);
      for (let i = 0, j = 0; i < n; i++, j += 4) {
        const v = data[j] | (data[j + 1] << 8) | (data[j + 2] << 16);
        raw[i] = v === 0 ? -1 : v - 1;
      }
      const map = {};
      let next = 0;
      for (let i = 0; i < n; i++) {
        const r = raw[i];
        if (r < 0) {
          labels[i] = -1;
          continue;
        }
        if (map[r] === undefined) map[r] = ++next;
        labels[i] = map[r];
      }
      const K = next;
      comps = [null];
      for (let l = 1; l <= K; l++)
        comps.push({ area: 0, bg: false, bpx: 0, cx: 0, cy: 0, h: 0, merged: false });
      const sx = new Float64Array(K + 1),
        sy = new Float64Array(K + 1),
        bp = new Int32Array(K + 1),
        mn = new Int32Array(K + 1).fill(1e9),
        mx = new Int32Array(K + 1).fill(-1),
        mnx = new Int32Array(K + 1).fill(1e9),
        mxx = new Int32Array(K + 1).fill(-1);
      for (let i = 0; i < n; i++) {
        const l = labels[i];
        if (l < 1) continue;
        const px = i % W,
          py = (i / W) | 0,
          c = comps[l];
        c.area++;
        sx[l] += px;
        sy[l] += py;
        if (py < mn[l]) mn[l] = py;
        if (py > mx[l]) mx[l] = py;
        if (px < mnx[l]) mnx[l] = px;
        if (px > mxx[l]) mxx[l] = px;
        if (px === 0 || py === 0 || px === W - 1 || py === H - 1) bp[l]++;
      }
      for (let l = 1; l <= K; l++) {
        const c = comps[l];
        c.cx = sx[l] / c.area;
        c.cy = sy[l] / c.area;
        c.bpx = bp[l];
        c.bg = false;
        c.h = mx[l] - mn[l];
        c.x0 = mnx[l];
        c.y0 = mn[l];
        c.x1 = mxx[l];
        c.y1 = mx[l];
      }
      // the guide's own settings first: which sections are background depends on its Background trim
      styleFrom(d);
      applyBg(true);
      secColor = new Array(comps.length);
      for (let l = 1; l < comps.length; l++) {
        const hh = (l * 137.508) % 248,
          s = 22 + ((l * 37) % 14),
          li = 61 + ((l * 29) % 13);
        secColor[l] = hsl2rgb(hh, s, li);
      }
      secState = new Uint8Array(comps.length);
      colored = new Uint8Array(comps.length);
      heldSh = {};
      progAt = {
        s: d.dates && d.dates.s > 0 ? +d.dates.s : 0,
        e: d.dates && d.dates.e > 0 ? +d.dates.e : 0,
        // (u: coloured before the dates were kept, v284: when it was started isn't known, so none are given)
        u:
          !d.dates &&
          ((Array.isArray(d.prog) && d.prog.length) ||
            (d.tones && typeof d.tones === 'object' && Object.keys(d.tones).length))
            ? 1
            : 0,
      };
      celebrated = false;
      if (d.secStates) {
        for (const k in d.secStates) {
          const nl = map[k];
          const v = d.secStates[k];
          if (nl && nl < secState.length && (v === 1 || v === 2)) secState[nl] = v;
        }
      }
      rgbOut = new Uint8ClampedArray(n * 4);
      imgData = new ImageData(rgbOut, W, H);
      // the saved markers: a dry one, or one no longer in the collection, shows as the closest one owned in a section
      // still to colour (a done section keeps it; so does every section when nothing owned is close)
      const byKey = {};
      coll.forEach(function (m) {
        byKey[m.mkey] = m;
      });
      const assign = {},
        order = [],
        sa = d.assign && typeof d.assign === 'object' ? d.assign : {},
        done = {},
        cat = {},
        dryK = {},
        goneK = {};
      if (Array.isArray(d.prog))
        d.prog.forEach(function (o) {
          done[o] = 1;
        });
      const pick = function (k) {
        if (byKey[k]) return { m: byKey[k] };
        if (!(k in cat)) {
          const c = catMarker(k);
          cat[k] = { c: c, rep: c && c.lab && coll.length ? nearestInPool(c.lab, coll) : null };
        }
        return cat[k];
      };
      for (const oldL in sa) {
        const nl = map[oldL],
          key = sa[oldL];
        if (!nl || typeof key !== 'string') continue;
        const r = pick(key);
        if (r.m) {
          assign[nl] = r.m;
          continue;
        }
        if (!r.c) {
          _lostKeys[nl] = key;
          continue;
        }
        const m = !done[oldL] && r.rep ? r.rep : r.c;
        assign[nl] = m;
        _origKeys[nl] = { k: key, s: [r.c.mkey].concat(r.rep ? [r.rep.mkey] : []) };
        if (m !== r.c) {
          (markerDry(key) ? dryK : goneK)[key] = 1;
        }
      }
      for (const l in assign) order.push(+l);
      order.sort(function (a, b) {
        return comps[a].cy - comps[b].cy || comps[a].cx - comps[b].cx;
      });
      // a pinned section's pattern colour, for Unpin
      const base = Object.assign({}, assign);
      if (d.base && typeof d.base === 'object')
        for (const ol in d.base) {
          const nl = map[ol],
            k = d.base[ol];
          if (!nl || !assign[nl] || typeof k !== 'string') continue;
          const r = pick(k),
            m = r.m || r.rep || r.c;
          if (m) base[nl] = m;
        }
      _openEmpty = !order.length && Object.keys(sa).length > 0;
      assignData = { assign: assign, order: order, N: order.length, base: base };
      guideSig = labelsSig();
      if (Array.isArray(d.paper)) {
        const _pp = {};
        d.paper.forEach(function (o) {
          const nl = map[o];
          if (nl && !assign[nl]) _pp[nl] = 1;
        });
        if (Object.keys(_pp).length) assignData.paper = _pp;
      }
      curName = typeof d.name === 'string' && d.name ? d.name.slice(0, 120) : null;
      {
        const st = d.style && typeof d.style === 'object' ? d.style : {},
          _ph = st.photo;
        if (
          _ph &&
          photoXfOK(_ph.xf) &&
          typeof d.ref === 'string' &&
          /^data:image\/(jpeg|png|webp);base64,/.test(d.ref) &&
          d.ref.length < 6e6
        ) {
          const _x = _ph.xf,
            _u = d.ref;
          if (typeof _ph.op === 'number' && isFinite(_ph.op)) photoOp = Math.max(0.2, Math.min(0.9, _ph.op));
          if (_ph.paper === false) photoPaper = false;
          _phBumped = true;
          // until the photo decodes (or another replaces it) the guide keeps saving it as it was
          _phPend = {
            url: _u,
            xf: { cx: _x.cx, cy: _x.cy, sx: _x.sx, sy: _x.sy, r: _x.r },
            op: photoOp,
            paper: photoPaper,
            light: _ph.light,
          };
          const _im = new Image(),
            _g = loadGen;
          _im.onload = function () {
            if (_g !== loadGen) return;
            const r = photoFromImage(_im, _u);
            if (r && !photoRef && _phPend && _phPend.url === _u) {
              photoRef = photoLitOpen(r, _phPend.light);
              photoXf = Object.assign({}, _phPend.xf);
              _phPend = null;
              planPhotoIn(photoRef);
              try {
                photoColours();
                photoStats();
              } catch (_) {}
              // (with the light from the photo, which sections it covers, so which are shaded, is known only now:
              // part-done tones brought in line again, as they were when it was saved)
              normalizeTones();
              if (sfmode === 'guide') renderControls();
              if (assignData && (sfmode === 'guide' || sfmode === 'color')) renderGuide();
              positionPhoto();
              planSync();
            }
          };
          _im.src = _u;
        }
        const _sh = st.shade;
        if (_sh && typeof _sh === 'object') {
          // the shading settings (STYLE_FIELDS), each checked, or its default (as shadeReset, above, left it)
          styleOpen(_sh, 'shade');
          if (Array.isArray(_sh.flat)) {
            _sh.flat.forEach(function (o) {
              const nl = map[o];
              if (nl) shadeFlat[nl] = 1;
            });
            _flatVer++;
          }
        }
      }
      anchors = Array.isArray(d.anchors)
        ? d.anchors
            .filter(function (a) {
              return (
                a &&
                typeof a.x === 'number' &&
                typeof a.y === 'number' &&
                isFinite(a.x) &&
                isFinite(a.y) &&
                typeof a.mkey === 'string'
              );
            })
            .slice(0, 64)
            .map(function (a) {
              return { x: Math.max(0, Math.min(W, a.x)), y: Math.max(0, Math.min(H, a.y)), mkey: a.mkey };
            })
        : [];
      // the guide's zones (34-zones), after its Main settings and anchors
      zoneOpen(d.zones, map);
      zoneSigSync();
      Object.keys(done).forEach(function (ol) {
        const nl = map[ol];
        if (nl) colored[nl] = 1;
      });
      // sections left out of the guide keep their marker, pin, tick and tones for when they are brought back in
      if (d.out && typeof d.out === 'object')
        for (const ol in d.out) {
          const nl = map[ol],
            o = d.out[ol];
          if (!nl || assign[nl] || !o || typeof o.k !== 'string') continue;
          const r = pick(o.k),
            m = r.m || r.rep || r.c;
          if (!m) continue;
          _gone[nl] = { m: m, lock: typeof o.lock === 'string' ? o.lock : undefined };
          if (o.done === 1) colored[nl] = 1;
          if (typeof o.t === 'number') tp()[nl] = o.t & 7;
        }
      // part-done tones (also kept for a section counted done because the plan asked for fewer tones)
      if (d.tones && typeof d.tones === 'object') {
        const P = tp();
        for (const ol in d.tones) {
          const nl = map[ol],
            b = d.tones[ol] | 0;
          if (nl && nl < P.length) P[nl] = b & 7;
        }
      }
      // (v284) the Shadows and Highlights coloured sections were coloured with, where they differ from their zone's
      if (d.held && typeof d.held === 'object')
        for (const ol in d.held) {
          const nl = map[ol],
            h = d.held[ol];
          if (
            nl &&
            Array.isArray(h) &&
            ['same', 'cool', 'grey'].includes(h[0]) &&
            ['same', 'warm', 'paper'].includes(h[1])
          )
            heldSh[nl] =
              h.length > 2
                ? { shadow: h[0], hilite: h[1], free: !!h[2] }
                : { shadow: h[0], hilite: h[1], legacy: true };
        }
      locks = {};
      if (d.locks && typeof d.locks === 'object')
        for (const ol in d.locks) {
          const nl = map[ol];
          if (nl && assign[nl] && typeof d.locks[ol] === 'string') locks[nl] = d.locks[ol];
        }
      lockMode = false;
      normalizeTones();
      curId = id;
      libNote();
      focus = false;
      var _rt1 = document.getElementById('sfRoot');
      if (_rt1) _rt1.classList.remove('sffoc');
      if (sfView) sfView.style.paddingTop = sfView.style.paddingBottom = '';
      hlKey = null;
      hlZone = null;
      resetZoom();
      // section edits kept when the page was hidden come back in Edit sections, still to be built (from Resume, or from
      // their "(section edits)" copy in the Library: see keepSlot)
      markBuilt();
      _edResumed = d.edits === 1;
      sfmode = _edResumed ? 'review' : 'guide';
      if (!quiet) enterWork();
      renderControls();
      if (_edResumed) render();
      else renderGuide();
      planReset();
      if (resumed) guideDirty = true;
      const nd = Object.keys(dryK).length,
        ng = Object.keys(goneK).length,
        // (sections whose marker the app doesn't know, from a file made elsewhere: kept as they are, left white)
        nlost = Object.keys(_lostKeys).length,
        lostTxt = nlost
          ? nWord(nlost, 'section') +
            (nlost === 1 ? ' uses a marker' : ' use markers') +
            ' this app doesn\u2019t know, so ' +
            (nlost === 1 ? 'it stays' : 'they stay') +
            ' white.'
          : '',
        pl = function (k, w) {
          return k + ' marker' + (k > 1 ? 's' : '') + ' ' + w;
        };
      note(
        _edResumed
          ? 'Your section edits are back \u2014 Build again to keep them.'
          : _openEmpty
            ? 'None of this guide\u2019s markers could be shown, so it won\u2019t be saved over. Check your collection, then open it again.'
            : nd || ng
              ? [
                  nd ? pl(nd, nd > 1 ? 'are dry' : 'is dry') : '',
                  ng ? pl(ng, 'no longer in your collection') : '',
                ]
                  .filter(Boolean)
                  .join(' and ') +
                ' \u2014 sections still to colour show the closest you own. The guide keeps ' +
                (nd + ng > 1 ? 'them' : 'it') +
                ' until you change those sections.' +
                (lostTxt ? ' ' + lostTxt : '')
              : lostTxt || metaText(),
      );
      // reloaded in place while colouring along (col): it stays in Colour along; from Home's Continue, at the marker
      // to pick up (_contNext)
      if (col && !_edResumed) {
        enterColor();
        if (cont) alongResume();
      }
      if (id === _justImported) _justImported = null;
    } catch (err) {
      curId = null;
      guideDirty = false;
      assignData = null;
      // (only a guide just imported, that never opened, is taken out again)
      const imp = id != null && id === _justImported;
      _justImported = null;
      if (imp && api.deleteDesign) {
        api.deleteDesign(id);
        if (api.refreshSaved) api.refreshSaved();
      }
      note('Couldn’t open that guide: ' + ((err && err.message) || err));
    }
  };
  img.onerror = function () {
    if (gen === loadGen) note('Couldn’t decode that guide.');
  };
  img.src = d.lmap;
}
// Home's Continue: open the guide (in Colour along, as a part-coloured one does) at the marker to pick up
let _contNext = false;
function continueGuide(id) {
  if (assignData && id != null && id === curId && !pgMode && !cropMode && !guideStale() && !secEdPending()) {
    if (sfmode !== 'color') enterColor();
    alongResume();
    return;
  }
  openDesign(id, true);
}
function openDesign(id, cont) {
  ++loadGen;
  _contNext = false;
  if (
    assignData &&
    labels &&
    id != null &&
    id === curId &&
    !pgMode &&
    !cropMode &&
    !guideStale() &&
    !secEdPending()
  ) {
    if (sfmode === 'review') {
      sfmode = 'guide';
      renderControls();
      renderGuide();
    }
    return;
  }
  const g = loadGen;
  stashDirty().then(function (ok) {
    if (!ok || g !== loadGen) return;
    Promise.resolve(api.loadDesign ? api.loadDesign(id) : null)
      .then(function (d) {
        if (g !== loadGen) return;
        // a guide part-way coloured opens in Colour along, where it was left; one not started, or finished, in the
        // plan (v284)
        const nAll = d && d.assign && typeof d.assign === 'object' ? Object.keys(d.assign).length : 0,
          nDone = d && Array.isArray(d.prog) ? d.prog.length : 0,
          part = d && d.tones && typeof d.tones === 'object' ? Object.keys(d.tones).length : 0;
        _contNext = !!cont;
        openDesignObj(d, id, false, false, (nDone > 0 || part > 0) && nDone < nAll);
      })
      .catch(function (err) {
        note('Couldn’t open that guide: ' + ((err && err.message) || err));
      });
  });
}
// a backup replaced the open guide's Library entry, or another tab saved it: the open copy is dropped for what is
// stored (col: it was open in Colour along)
function reloadOpen(id, col) {
  const g = ++loadGen;
  Promise.resolve(api.loadDesign ? api.loadDesign(id) : null)
    .then(function (d) {
      if (g === loadGen && d && id === curId) openDesignObj(d, id, false, true, col);
    })
    .catch(function () {});
}
function setCollection(list) {
  coll = Array.isArray(list) ? list : [];
  if (metaEl) metaEl.innerHTML = metaText();
}
function configure(a) {
  api = a || {};
}
