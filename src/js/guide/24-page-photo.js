/* ---- (v314) a photo of the finished page ----
    One photo per guide, kept on this device in a record of its own beside the guide's ('fin-<id>' in the guides'
    store): { u: a JPEG data: URL, its long side at most FIN_SIDE; w, h; ts: when it was added; flat: 1 straightened,
    0 kept as taken }. Added from the Page finished panel, Home's latest piece or the guide's ⋯ menu. The page is found
    and straightened by itself when the finder is sure of it (22-straighten, as a coloured reference photo is:
    pgRefFlat); otherwise four corner handles over the photo, with Keep as is. It's in the Library's backup
    (guide-bridge gatherGuides/restoreGuideList), not in a guide file; it goes when the guide is deleted for good
    (library.js libPurge) and comes back with Put back; Save a copy doesn't copy it; Reset progress keeps it. It never
    leaves the device unless it's shared or backed up. */
const FIN_SIDE = 1600,
  FIN_Q = 0.85;
// the open guide's photo: its id, whether it's been looked for (read), the record (null: none) and the picture decoded
// (tok: the guide as opened, _gTok, so a guide opened again, say after a restore, is read again)
let _fin = { id: null, tok: -1, read: false, rec: null, img: null, gen: 0 },
  // the last photo chosen this visit, as taken (at FIN_SIDE), for Adjust corners: { id, src, q, f35 }
  _finLast = null,
  _finFor = null;
function finKey(id) {
  return 'fin-' + id;
}
// (the check is guide-bridge's finRecOk, which backups use too)
function finOk(r) {
  return finRecOk(r);
}
function finGet(id) {
  if (id == null || typeof IDB === 'undefined') return Promise.resolve(null);
  return IDB.get(finKey(id)).then(
    function (r) {
      return finOk(r) ? r : null;
    },
    function () {
      return null;
    },
  );
}
// a guide still in the Library (the photo is kept only with one)
function finInLib(id) {
  const a = api.listDesigns ? api.listDesigns() : [];
  for (let i = 0; i < a.length; i++) if (a[i].id === id) return true;
  return false;
}
// the open guide's photo, read when the guide changes (the Page finished panel asks; v315: and as a guide opens, so a
// Put back after a delete always has it: lazy, the record only, the picture decoded when it's first shown)
function finSync(lazy) {
  if (_fin.id === curId && _fin.tok === _gTok) return;
  const g = _fin.gen + 1,
    id = curId;
  _fin = { id: id, tok: _gTok, read: false, rec: null, img: null, gen: g };
  if (_finLast && _finLast.id !== id) finFreeLast();
  if (id == null) return;
  finGet(id).then(function (r) {
    if (_fin.gen === g) finSetRec(r, lazy);
  });
}
// (v315) the open guide's photo read again, as it may have changed elsewhere: another tab added, changed or removed it
// (the tab coming back into view), or a restore put a newer one in. Only when it differs; not while its corners are
// open (that photo is the one being worked on)
function finRefresh() {
  const id = curId;
  if (id == null || _fin.id !== id || !_fin.read || _finEd) return Promise.resolve();
  const g = _fin.gen;
  return finGet(id).then(function (r) {
    const a = _fin.rec;
    if (_fin.gen !== g || _fin.id !== id || _finEd) return;
    if ((!a && !r) || (a && r && +a.ts === +r.ts && a.u === r.u)) return;
    const shown = !!_fin.img;
    _fin.gen = g + 1;
    finSetRec(r, !shown);
    // (Home's latest piece shows it too; the row's own note of it came with the other tab's save)
    if (typeof homeFinSeen === 'function') homeFinSeen();
  });
}
document.addEventListener('visibilitychange', function () {
  if (document.visibilityState === 'visible') finRefresh();
});
// the last photo let go (not while the corners are open on it: a photo for another guide, chosen on Home)
function finFreeLast() {
  if (_finLast && !(_finEd && _finEd.src === _finLast.src)) freeCanvas(_finLast.src);
  _finLast = null;
}
function finSetRec(r, lazy) {
  _fin.read = true;
  _fin.rec = r || null;
  _fin.img = null;
  _fin.dec = false;
  if (r && !lazy) finDecode();
  finPanel();
}
// the photo decoded, for the card (once)
function finDecode() {
  const r = _fin.rec;
  if (!r || _fin.img || _fin.dec) return;
  _fin.dec = true;
  const im = new Image(),
    g = _fin.gen;
  im.onload = function () {
    if (_fin.gen === g && _fin.rec === r) _fin.img = im;
  };
  im.src = r.u;
}
// the photo was added, changed or removed: Home's latest piece shows it (library.js)
function finChanged(id, rec) {
  if (typeof homeFinChanged === 'function') homeFinChanged(id, rec || null);
}
// the photo as taken, for the corners, still to hand for guide id (finSync lets it go when another guide opens)
function finAdjOk(id) {
  return !!(_finLast && _finLast.id === id && _finLast.src && _finLast.src.width > 0 && !_finEd);
}
// (the toast is read out as it shows)
function finSay(m) {
  if (m) toast(m, 4000);
}

/* -- choosing it: the picker opens in the tap itself (iOS opens it only from a tap) -- */
function finInput() {
  let el = document.getElementById('sfFinFile');
  if (el) return el;
  el = document.createElement('input');
  el.type = 'file';
  el.id = 'sfFinFile';
  el.className = 'fileinput';
  el.accept = 'image/*';
  el.addEventListener('change', function (e) {
    const f = e.target.files && e.target.files[0],
      who = _finFor;
    _finFor = null;
    e.target.value = '';
    if (f && who) finFile(f, who.id);
  });
  document.body.appendChild(el);
  return el;
}
// id: the guide's (Home), or null for the open guide
function finPick(id) {
  _finFor = { id: id == null ? null : id };
  finInput().click();
}
function finFile(file, id) {
  if (isPdf(file)) {
    finSay('Choose a photo of your page (a JPEG or PNG).');
    return;
  }
  (id != null
    ? Promise.resolve(id)
    : flushNow().then(function () {
        return libEntry() ? curId : null;
      })
  )
    .then(function (gid) {
      if (gid == null || !finInLib(gid)) {
        finSay('This guide isn’t in your Library, so the photo can’t be kept with it.');
        return;
      }
      if (storeBlocked()) {
        finSay('This browser isn’t letting Marker Studio save, so the photo can’t be kept.');
        return;
      }
      return finRead(file).then(function (r) {
        finFound(gid, r.src, r.f35);
      });
    })
    .catch(function (e) {
      finSay(e && e.finMsg ? e.finMsg : 'Couldn’t read that photo. Try it again, or another photo.');
    });
}
// the photo at FIN_SIDE on its long side (v328: or side, Tick off from a photo's), and its lens (0 if unknown)
function finRead(file, side) {
  const lens =
    file && file.slice
      ? file
          .slice(0, 262144)
          .arrayBuffer()
          .then(pgExifFocal)
          .catch(function () {
            return 0;
          })
      : Promise.resolve(0);
  return new Promise(function (res, rej) {
    let url = null;
    try {
      url = URL.createObjectURL(file);
    } catch (_) {}
    const go = function (s) {
      const img = new Image();
      img.onload = function () {
        if (url) URL.revokeObjectURL(url);
        const w0 = img.naturalWidth || img.width,
          h0 = img.naturalHeight || img.height;
        if (!w0 || !h0) {
          const e = new Error('empty');
          e.finMsg = 'That photo looked empty. Try another.';
          rej(e);
          return;
        }
        const k = Math.min(1, (side || FIN_SIDE) / Math.max(w0, h0)),
          c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(w0 * k));
        c.height = Math.max(1, Math.round(h0 * k));
        const g = c.getContext('2d');
        g.imageSmoothingEnabled = true;
        g.imageSmoothingQuality = 'high';
        g.fillStyle = '#fff';
        g.fillRect(0, 0, c.width, c.height);
        drawShrunk(g, img, c.width, c.height);
        lens.then(function (f35) {
          res({ src: c, f35: f35 });
        });
      };
      img.onerror = function () {
        if (url) URL.revokeObjectURL(url);
        const e = new Error('unreadable');
        e.finMsg = 'That file couldn’t be opened as a picture. Try a JPEG or PNG.';
        rej(e);
      };
      img.src = s;
    };
    if (url) go(url);
    else {
      const fr = new FileReader();
      fr.onload = function () {
        go(fr.result);
      };
      fr.onerror = function () {
        rej(new Error('read'));
      };
      fr.readAsDataURL(file);
    }
  });
}
// found and straightened when the finder is sure; else the corners to check
function finFound(id, src, f35) {
  let f = { tier: 'none' };
  try {
    // (the page is coloured in: v315)
    f = pgFind(src, { coloured: true });
  } catch (_) {}
  if (_finLast && _finLast.src !== src) finFreeLast();
  _finKeep = null;
  _finLast = { id: id, src: src, q: f.q || null, f35: f35 || 0, tier: f.tier };
  if (f.tier === 'sure') finFlatten(id, src, f.q, f35);
  else finEdit(id, src, f.tier === 'unsure' ? f.q : null, f.tier === 'unsure' ? f.why : 'none');
}
function finFlatten(id, src, q, f35) {
  let out = null;
  try {
    out = pgWarp(src, q, finAspect(q, src.width, src.height, f35));
  } catch (_) {}
  if (!out) {
    finStore(id, src, 0, 'Couldn’t straighten that photo, so it’s kept as taken.');
    return;
  }
  // (v315) turned by hand since (Turn): kept that way, not compared with the plan again
  if (_finLast && _finLast.src === src && _finLast.manual) {
    const t = finTurned(out, _finLast.turns || 0);
    finStore(id, t, 1, '', true).then(function () {
      if (t !== out) freeCanvas(t);
      freeCanvas(out);
    });
    return;
  }
  finStore(id, out, 1).then(function () {
    freeCanvas(out);
  });
}
// (v315) the page's shape: as measured, or the paper Print uses (Letter, A4…, either way up) when it's within 6% of it,
// so a photo whose camera doesn't say its lens (a 2× zoom measured 4% too wide) still comes out the paper's shape
function finAspect(q, iw, ih, f35) {
  let a = pgShapeOf(q, iw, ih, f35, null).aspect;
  const P = PAPERS[paper] || PAPERS.letter,
    pa = P[0] / P[1];
  [pa, 1 / pa].forEach(function (t) {
    if (Math.abs(a / t - 1) < 0.06) a = t;
  });
  return a;
}
/* (v315) A photo taken with the phone turned is straightened on its side (the finder takes the side nearest level as
   the top), and upside down when the phone was. It's compared with the plan, both shrunk to a few dozen pixels, at
   each quarter turn: the drawing's box in each (finInkBox: the paper's margins and the table left out), stretched to a
   small grid and compared colour for colour (and the boxes' shapes); it's turned only when one turn is clearly the best
   (FIN_TURN_*), else left as it is, and the panel's Turn is there for the rest. On 144 made-up photos of three
   coloured pages (on their sides both ways, upside down, a little turned, two tables, two tilts) the right turn scored
   best every time it was a page with no key printed beside the drawing, 0.19 or more ahead; with these thresholds 131
   came out the right way up, none the wrong way, and 13 were left (12 of them a page with a large printed key). */
const FIN_TURN_MIN = 0.2,
  FIN_TURN_GAIN = 0.1,
  FIN_TURN_LEAD = 0.05;
function finRow(id) {
  const a = api.listDesigns ? api.listDesigns() : [];
  for (let i = 0; i < a.length; i++) if (a[i].id === id) return a[i];
  return null;
}
// a canvas turned a quarter turn clockwise `turns` times (the same canvas for none)
function finTurned(c, turns) {
  turns = ((turns % 4) + 4) % 4;
  if (!turns) return c;
  const w = c.naturalWidth || c.width,
    h = c.naturalHeight || c.height,
    o = document.createElement('canvas');
  o.width = turns % 2 ? h : w;
  o.height = turns % 2 ? w : h;
  const g = o.getContext('2d');
  g.translate(o.width / 2, o.height / 2);
  g.rotate((turns * Math.PI) / 2);
  g.drawImage(c, -w / 2, -h / 2);
  return o;
}
// the drawing's box in a small picture: rows and columns with enough ink (darker than the paper by a fifth, or clearly
// coloured), so the page's margins, the table and a printed key's spacing don't count
function finInkBox(c) {
  const w = c.width,
    h = c.height,
    d = c.getContext('2d').getImageData(0, 0, w, h).data,
    lum = new Float32Array(w * h),
    srt = [];
  for (let i = 0; i < w * h; i++) {
    lum[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
    if (i % 7 === 0) srt.push(lum[i]);
  }
  srt.sort(function (a, b) {
    return a - b;
  });
  const P = srt[Math.floor(srt.length * 0.95)] || 255,
    rows = new Uint16Array(h),
    cols = new Uint16Array(w);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x,
        r = d[i * 4],
        g = d[i * 4 + 1],
        b = d[i * 4 + 2];
      if (lum[i] < 0.8 * P || Math.max(r, g, b) - Math.min(r, g, b) > 50) {
        rows[y]++;
        cols[x]++;
      }
    }
  const edge = function (a, n, lim) {
    let lo = 0,
      hi = n - 1;
    while (lo < n && a[lo] <= lim) lo++;
    while (hi > lo && a[hi] <= lim) hi--;
    return [lo, hi];
  };
  const ry = edge(rows, h, Math.max(1, w * 0.03)),
    rx = edge(cols, w, Math.max(1, h * 0.03));
  if (rx[1] - rx[0] < 4 || ry[1] - ry[0] < 4) return { x: 0, y: 0, w: w, h: h };
  return { x: rx[0], y: ry[0], w: rx[1] - rx[0] + 1, h: ry[1] - ry[0] + 1 };
}
// colour on a G × G grid (the box stretched to it), each channel less its mean
const FIN_G = 24;
function finGrid(src, box, turns) {
  const c = document.createElement('canvas');
  c.width = c.height = FIN_G;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.translate(FIN_G / 2, FIN_G / 2);
  g.rotate((turns * Math.PI) / 2);
  g.drawImage(src, box.x, box.y, box.w, box.h, -FIN_G / 2, -FIN_G / 2, FIN_G, FIN_G);
  const d = g.getImageData(0, 0, FIN_G, FIN_G).data,
    n = FIN_G * FIN_G,
    v = new Float32Array(n * 3);
  for (let k = 0; k < 3; k++) {
    let m = 0;
    for (let i = 0; i < n; i++) m += d[i * 4 + k];
    m /= n;
    for (let i = 0; i < n; i++) v[k * n + i] = d[i * 4 + k] - m;
  }
  freeCanvas(c);
  return v;
}
function finNcc(a, b) {
  let ab = 0,
    aa = 0,
    bb = 0;
  for (let i = 0; i < a.length; i++) {
    ab += a[i] * b[i];
    aa += a[i] * a[i];
    bb += b[i] * b[i];
  }
  return aa > 0 && bb > 0 ? ab / Math.sqrt(aa * bb) : 0;
}
// how well the photo's drawing, turned `turns` quarter turns, matches the plan's, each in its own box (their shapes
// compared too: a wrong quarter turn swaps the box's width and height)
function finTurnScore(photo, pbox, plan, qbox, turns) {
  const ap = turns % 2 ? pbox.h / pbox.w : pbox.w / pbox.h,
    aq = qbox.w / qbox.h,
    fit = Math.sqrt(Math.min(ap / aq, aq / ap));
  return finNcc(finGrid(photo, pbox, turns), finGrid(plan, qbox, 0)) * fit;
}
// the photo the right way up: resolves to { c (the same canvas, or a turned copy), turns }
function finOrient(id, c) {
  const keep = { c: c, turns: 0 },
    row = finRow(id);
  if (!row || typeof homeArt !== 'function') return Promise.resolve(keep);
  return Promise.resolve(homeArt(row, 'plan', 120))
    .then(function (u) {
      if (!u) return null;
      return new Promise(function (res) {
        const im = new Image();
        im.onload = function () {
          res(im);
        };
        im.onerror = function () {
          res(null);
        };
        im.src = u;
      });
    })
    .then(function (plan) {
      if (!plan || !plan.width) return keep;
      // (a small copy of the photo to compare)
      const k = Math.min(1, 160 / Math.max(c.width, c.height)),
        sm = document.createElement('canvas');
      sm.width = Math.max(1, Math.round(c.width * k));
      sm.height = Math.max(1, Math.round(c.height * k));
      drawShrunk(sm.getContext('2d'), c, sm.width, sm.height);
      const pc = document.createElement('canvas');
      pc.width = plan.naturalWidth || plan.width;
      pc.height = plan.naturalHeight || plan.height;
      pc.getContext('2d').drawImage(plan, 0, 0);
      const pbox = finInkBox(sm),
        qbox = finInkBox(pc),
        sc = [0, 1, 2, 3].map(function (t) {
          return finTurnScore(sm, pbox, pc, qbox, t);
        });
      freeCanvas(sm);
      freeCanvas(pc);
      let best = 0;
      for (let t = 1; t < 4; t++) if (sc[t] > sc[best]) best = t;
      const next = Math.max.apply(
        null,
        sc.filter(function (_, t) {
          return t !== best;
        }),
      );
      finOrient.last = sc;
      if (
        !best ||
        sc[best] < FIN_TURN_MIN ||
        sc[best] - sc[0] < FIN_TURN_GAIN ||
        sc[best] - next < FIN_TURN_LEAD
      )
        return keep;
      return { c: finTurned(c, best), turns: best };
    })
    .catch(function () {
      return keep;
    });
}
// (v315) the panel's Turn: a quarter turn clockwise, as it is now
function finTurn() {
  const id = curId,
    r = _fin.rec;
  if (id == null || !r || _fin.id !== id) return;
  finKeepAdded(id);
  // (v315) from the photo as taken, while it's to hand: straightened again and turned, so turning round and round
  // never loses anything to JPEG; else the photo as kept, turned
  const L = _finLast;
  if (r.flat && finAdjOk(id) && L.q) {
    let out = null;
    try {
      out = pgWarp(L.src, L.q, finAspect(L.q, L.src.width, L.src.height, L.f35));
    } catch (_) {}
    if (out) {
      L.turns = ((L.turns || 0) + 1) % 4;
      L.manual = true;
      const t = finTurned(out, L.turns);
      finStore(id, t, 1, 'Photo turned.', true).then(function () {
        if (t !== out) freeCanvas(t);
        freeCanvas(out);
      });
      return;
    }
  }
  const im = new Image();
  im.onload = function () {
    const c = finTurned(im, 1);
    finStore(id, c, r.flat, 'Photo turned.', true).then(function () {
      freeCanvas(c);
    });
  };
  im.src = r.u;
}
// asis: kept the way it is (the panel's Turn), not compared with the plan
function finStore(id, c, flat, msg, asis) {
  return (asis ? Promise.resolve({ c: c, turns: 0 }) : finOrient(id, c)).then(function (o) {
    // (how it was turned upright, for Turn to count on from: v315)
    if (!asis && _finLast && _finLast.id === id) {
      _finLast.turns = o.turns || 0;
      _finLast.manual = false;
    }
    const r = finStoreNow(
      id,
      o.c,
      flat,
      !asis,
      msg ||
        (o.turns
          ? flat
            ? 'Photo of your page added, straightened and turned upright.'
            : 'Photo of your page added, turned upright.'
          : ''),
    );
    if (o.c !== c) freeCanvas(o.c);
    return r;
  });
}
// (v315) a Turn or Adjust corners of the photo already kept: the record keeps the day it was added (its ts moves on, for
// a restore's newer-wins)
let _finKeep = null;
function finKeepAdded(id) {
  const r = _fin.id === id ? _fin.rec : null;
  _finKeep = r ? { id: id, added: +r.added || +r.ts || Date.now() } : null;
}
// adj: just added, so a straightened one's toast offers Adjust corners (v315)
function finStoreNow(id, c, flat, adj, msg) {
  let rec = null;
  try {
    const w0 = c.width,
      h0 = c.height,
      k = Math.min(1, FIN_SIDE / Math.max(w0, h0)),
      t = document.createElement('canvas');
    t.width = Math.max(1, Math.round(w0 * k));
    t.height = Math.max(1, Math.round(h0 * k));
    const g = t.getContext('2d');
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    if (k < 1) drawShrunk(g, c, t.width, t.height);
    else g.drawImage(c, 0, 0);
    rec = {
      u: t.toDataURL('image/jpeg', FIN_Q),
      w: t.width,
      h: t.height,
      ts: Date.now(),
      flat: flat ? 1 : 0,
    };
    if (_finKeep && _finKeep.id === id) rec.added = _finKeep.added;
    _finKeep = null;
    freeCanvas(t);
  } catch (_) {}
  if (!finOk(rec)) {
    finSay('Couldn’t keep that photo. Try it again, or another photo.');
    return Promise.resolve(false);
  }
  if (!finInLib(id)) {
    finSay('That guide is no longer in your Library, so the photo can’t be kept with it.');
    return Promise.resolve(false);
  }
  return IDB.put(finKey(id), rec).then(
    function () {
      if (_fin.id === id) finSetRec(rec);
      finChanged(id, rec);
      const m = msg || (flat ? 'Photo of your page added, straightened.' : 'Photo of your page added.');
      // (v315) straightened: a button to check the corners, from Home too (the photo as taken is still to hand)
      if (adj && flat && finAdjOk(id))
        toastAction(m, 'Adjust corners', function () {
          if (finAdjOk(id)) finEdit(id, _finLast.src, _finLast.q, 'adjust');
        });
      else finSay(m);
      return true;
    },
    function () {
      finSay('Couldn’t keep the photo: this device’s storage may be full.');
      return false;
    },
  );
}
function finRemove(id) {
  askBox(
    'Remove your photo?',
    'Your photo of the finished page goes from this device. The guide stays as it is.',
    '<button type="button" class="sfghost" data-a="stay">Cancel</button><button type="button" class="btn-primary" data-a="go">Remove</button>',
  ).then(function (a) {
    if (a !== 'go') return;
    IDB.del(finKey(id)).then(
      function () {
        if (_fin.id === id) finSetRec(null);
        finChanged(id);
        finSay('Photo removed.');
      },
      function () {
        finSay('Couldn’t remove the photo. Try again.');
      },
    );
  });
}
// (deleted for good: library.js libPurge, guide-bridge sfDeleteDesign) the photo goes with the guide
function finDrop(id) {
  return IDB.del(finKey(id)).catch(function () {});
}
// (a guide deleted while open, then Put back after its record went: its photo comes back from the one read at open)
function finPutBack(id) {
  if (_fin.id !== id || !_fin.rec) return;
  const r = _fin.rec;
  finGet(id).then(function (now) {
    if (!now && finInLib(id)) IDB.put(finKey(id), r).catch(function () {});
  });
}

/* -- the corners: four handles over the photo (the guide's own editor, pgOpen, works on the guide's picture, so this
   is one of its own, in a dialog that opens over Home as well) -- */
const FIN_WHY = {
  off: 'Part of the page looks outside the photo. Check the corners, then Straighten.',
  unclear: 'One edge of the page is hard to see. Check the corners, then Straighten.',
  none: 'Drag the four corners onto the corners of your page, or keep the photo as it is.',
  adjust: 'Drag a corner to move it.',
  // (v315: a patterned table round the page, 22-straighten pgFind)
  cloth: 'The table’s pattern makes the page’s edges hard to be sure of. Check the corners, then Straighten.',
};
let _finEd = null;
// (v328: end, for Tick off from a photo: given the corners for Straighten, null for Keep as is, false for Cancel, in
// place of keeping the photo of the finished page)
function finEdit(id, src, q, why, end) {
  finEdClose();
  const iw = src.width,
    ih = src.height;
  if (!q) {
    const m = 0.06;
    q = [
      [iw * m, ih * m],
      [iw * (1 - m), ih * m],
      [iw * (1 - m), ih * (1 - m)],
      [iw * m, ih * (1 - m)],
    ];
  }
  const sc = Math.min(1, 1200 / Math.max(iw, ih)),
    dw = Math.round(iw * sc),
    dh = Math.round(ih * sc),
    pad = Math.round(Math.max(dw, dh) * 0.07),
    o = document.createElement('div'),
    op = document.activeElement;
  o.className = 'overlay on sffined';
  o.id = 'sfFinEd';
  o.setAttribute('role', 'dialog');
  o.setAttribute('aria-modal', 'true');
  o.setAttribute('aria-labelledby', 'sfFinEdT');
  o.setAttribute('aria-describedby', 'sfFinEdD');
  o.innerHTML =
    '<div class="ocard dcard sffinedc"><div class="mhead"><h2 class="mtitle" id="sfFinEdT">Straighten your photo</h2></div>' +
    '<div class="dsub" id="sfFinEdD">' +
    esc(FIN_WHY[why] || FIN_WHY.adjust) +
    '</div><canvas id="sfFinCv" tabindex="0" aria-label="The photo, with the page’s four corners. Arrow keys move the highlighted corner; Space picks the next one."></canvas>' +
    // (its line kept, so the dialog doesn't move when it shows: v314.1)
    '<div class="sfpgnote warn" id="sfFinX" style="visibility:hidden">Those corners cross over. Drag them back to the page’s four corners.</div>' +
    // (v314.1, as the guide's own corners since v313: the page not found, Keep as is is the main button; a Straighten of
    // the starting corners would trim the photo's edges and call it straightened)
    '<div class="sfedaskbtns"><button type="button" class="sfghost sffincx" data-a="cancel">Cancel</button><button type="button" class="' +
    (why === 'none' ? 'btn-primary' : 'sfghost') +
    '" data-a="keep">Keep as is</button><button type="button" class="' +
    (why === 'none' ? 'sfghost' : 'btn-primary') +
    '" data-a="go">Straighten</button></div></div>';
  const cvs = o.querySelector('#sfFinCv');
  cvs.width = dw + 2 * pad;
  cvs.height = dh + 2 * pad;
  const E = {
    id: id,
    src: src,
    q: q.map(function (p) {
      return p.slice();
    }),
    k: sc,
    pad: pad,
    drag: -1,
    sel: 0,
    kb: false,
    off: [0, 0],
    el: o,
    cv: cvs,
    g: cvs.getContext('2d'),
    op: op,
    t0: Date.now(),
    why: why,
    end: end || null,
  };
  _finEd = E;
  o.addEventListener('click', function (e) {
    const b = e.target.closest('[data-a]');
    if (b) {
      if (!b.disabled) finEdDo(b.dataset.a);
    } else if (e.target === o && (Date.now() - E.t0 > 400 || e.detail === 0)) finEdDo('cancel');
  });
  cvs.addEventListener('pointerdown', function (e) {
    finEdPtr(e, 'down');
  });
  cvs.addEventListener('pointermove', function (e) {
    finEdPtr(e, 'move');
  });
  cvs.addEventListener('pointerup', function (e) {
    finEdPtr(e, 'up');
  });
  cvs.addEventListener('pointercancel', function (e) {
    finEdPtr(e, 'up');
  });
  cvs.addEventListener('keydown', finEdKey);
  cvs.addEventListener('focus', function () {
    E.kb = true;
    finEdDraw();
  });
  cvs.addEventListener('blur', function () {
    E.kb = false;
    finEdDraw();
  });
  document.body.appendChild(o);
  // (the margin round the photo in the dialog's own colour: v314.1)
  try {
    const bg = getComputedStyle(o.querySelector('.ocard')).backgroundColor;
    if (bg && !/rgba\(0, 0, 0, 0\)|transparent/.test(bg)) E.bg = bg;
  } catch (_) {}
  finEdDraw();
  finEdOK();
  try {
    o.querySelector('.btn-primary').focus({ preventScroll: true });
  } catch (_) {}
}
function finEdClose() {
  const E = _finEd;
  if (!E) return;
  _finEd = null;
  E.el.remove();
  // (v329: the page live again before focus goes back to it, layers.js)
  modalSync();
  freeCanvas(E.cv);
  try {
    if (E.op && E.op.isConnected && E.op !== document.body) E.op.focus({ preventScroll: true });
  } catch (_) {}
}
function finEdGood(q) {
  return pgConvex(q) && pgAngles(q)[0] > 20;
}
function finEdOK() {
  const E = _finEd;
  if (!E) return;
  const ok = finEdGood(E.q),
    b = E.el.querySelector('[data-a="go"]'),
    x = E.el.querySelector('#sfFinX');
  if (b) b.disabled = !ok;
  if (x) x.style.visibility = ok ? 'hidden' : 'visible';
}
function finEdDo(a) {
  const E = _finEd;
  if (!E) return;
  if (E.end) {
    if (a === 'go' && !finEdGood(E.q)) return;
    const q = a === 'go' ? pgOrder(E.q) : a === 'keep' ? null : false;
    finEdClose();
    E.end(q);
    return;
  }
  if (a === 'go') {
    if (!finEdGood(E.q)) return;
    const q = pgOrder(E.q),
      id = E.id,
      src = E.src,
      f35 = _finLast && _finLast.src === src ? _finLast.f35 : 0;
    if (_finLast && _finLast.src === src) _finLast.q = q;
    // (v315) the same photo's corners adjusted: it keeps the day it was added
    if (E.why === 'adjust') finKeepAdded(id);
    finEdClose();
    finFlatten(id, src, q, f35);
  } else if (a === 'keep') {
    const id = E.id,
      src = E.src;
    finEdClose();
    finStore(id, src, 0);
  } else finEdClose();
}
function finEdDraw() {
  const E = _finEd;
  if (!E) return;
  const g = E.g,
    cvs = E.cv,
    k = E.k,
    pad = E.pad,
    iw = E.src.width,
    ih = E.src.height;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = E.bg || '#202124';
  g.fillRect(0, 0, cvs.width, cvs.height);
  g.imageSmoothingEnabled = true;
  g.drawImage(E.src, pad, pad, iw * k, ih * k);
  const P = E.q.map(function (p) {
    return [pad + p[0] * k, pad + p[1] * k];
  });
  g.fillStyle = 'rgba(0,0,0,.45)';
  g.beginPath();
  g.rect(0, 0, cvs.width, cvs.height);
  g.moveTo(P[0][0], P[0][1]);
  for (let i = 3; i >= 0; i--) g.lineTo(P[i][0], P[i][1]);
  g.closePath();
  g.fill('evenodd');
  const lw = Math.max(2, cvs.width / 300);
  g.lineJoin = 'round';
  g.beginPath();
  P.forEach(function (p, i) {
    i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]);
  });
  g.closePath();
  g.strokeStyle = 'rgba(0,0,0,.6)';
  g.lineWidth = lw * 2.6;
  g.stroke();
  g.strokeStyle = '#ffd84a';
  g.lineWidth = lw;
  g.stroke();
  const r = Math.max(10, cvs.width / 45);
  P.forEach(function (p, i) {
    g.beginPath();
    g.arc(p[0], p[1], r, 0, 6.283);
    g.fillStyle = i === E.drag ? 'rgba(255,216,74,.45)' : 'rgba(255,255,255,.25)';
    g.fill();
    g.lineWidth = lw * 1.3;
    g.strokeStyle = '#ffd84a';
    g.stroke();
    // (the corner the arrow keys move)
    if (E.kb && i === E.sel) {
      g.beginPath();
      g.arc(p[0], p[1], r * 1.5, 0, 6.283);
      g.lineWidth = lw;
      g.strokeStyle = '#fff';
      g.stroke();
    }
  });
  // a magnifier beside the finger while a corner is dragged (the finger hides the corner itself)
  if (E.drag >= 0) {
    const c = P[E.drag],
      R = Math.round(cvs.width * 0.14),
      Z = 3;
    // (above the finger; with no room above — the top corners — beside it, towards the middle: below, the hand hid it)
    let lx = c[0],
      ly = c[1] - 2.3 * R;
    if (ly < R + 4) {
      ly = c[1];
      lx = c[0] < cvs.width / 2 ? c[0] + 2.3 * R : c[0] - 2.3 * R;
    }
    lx = Math.max(R + 4, Math.min(cvs.width - R - 4, lx));
    ly = Math.max(R + 4, Math.min(cvs.height - R - 4, ly));
    g.save();
    g.beginPath();
    g.arc(lx, ly, R, 0, 6.283);
    g.clip();
    g.fillStyle = '#202124';
    g.fillRect(lx - R, ly - R, 2 * R, 2 * R);
    const sx = (c[0] - pad) / k,
      sy = (c[1] - pad) / k,
      half = R / (Z * k);
    g.drawImage(E.src, sx - half, sy - half, 2 * half, 2 * half, lx - R, ly - R, 2 * R, 2 * R);
    g.strokeStyle = '#ffd84a';
    g.lineWidth = Math.max(1.5, lw * 0.8);
    g.beginPath();
    g.moveTo(lx - R, ly);
    g.lineTo(lx + R, ly);
    g.moveTo(lx, ly - R);
    g.lineTo(lx, ly + R);
    g.stroke();
    g.restore();
    g.beginPath();
    g.arc(lx, ly, R, 0, 6.283);
    g.lineWidth = lw * 1.5;
    g.strokeStyle = '#fff';
    g.stroke();
  }
}
// the pointer, in the canvas's own pixels (it's drawn smaller than that on screen)
function finEdAt(e) {
  const E = _finEd,
    r = E.cv.getBoundingClientRect(),
    s = E.cv.width / Math.max(1, r.width);
  return { x: (e.clientX - r.left) * s, y: (e.clientY - r.top) * s, s: s };
}
function finEdClamp(p) {
  const E = _finEd,
    m = E.pad / E.k;
  return [Math.max(-m, Math.min(E.src.width + m, p[0])), Math.max(-m, Math.min(E.src.height + m, p[1]))];
}
function finEdPtr(e, kind) {
  const E = _finEd;
  if (!E) return;
  const P = finEdAt(e),
    k = E.k,
    pad = E.pad;
  if (kind === 'down') {
    let bi = -1,
      bd = Math.max(32 * P.s, E.cv.width * 0.08);
    E.q.forEach(function (p, i) {
      const d = Math.hypot(pad + p[0] * k - P.x, pad + p[1] * k - P.y);
      if (d < bd) {
        bd = d;
        bi = i;
      }
    });
    if (bi < 0) return;
    e.preventDefault();
    try {
      E.cv.setPointerCapture(e.pointerId);
    } catch (_) {}
    const p = E.q[bi];
    E.drag = bi;
    E.sel = bi;
    E.off = [pad + p[0] * k - P.x, pad + p[1] * k - P.y];
    finEdDraw();
    return;
  }
  if (E.drag < 0) return;
  if (kind === 'move') {
    E.q[E.drag] = finEdClamp([(P.x + E.off[0] - pad) / k, (P.y + E.off[1] - pad) / k]);
    finEdDraw();
    return;
  }
  E.drag = -1;
  try {
    E.cv.releasePointerCapture(e.pointerId);
  } catch (_) {}
  finEdDraw();
  finEdOK();
}
function finEdKey(e) {
  const E = _finEd;
  if (!E) return;
  const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
  if (d) {
    e.preventDefault();
    const st = Math.max(E.src.width, E.src.height) * (e.shiftKey ? 0.05 : 0.01),
      p = E.q[E.sel];
    E.q[E.sel] = finEdClamp([p[0] + d[0] * st, p[1] + d[1] * st]);
    finEdDraw();
    finEdOK();
  } else if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault();
    E.sel = (E.sel + 1) % 4;
    finEdDraw();
  }
}

/* -- the Page finished panel: Add a photo of your page, or the photo with Show beside the plan and Change -- */
function finPanel() {
  const el = document.getElementById('sfFin');
  if (!el) return;
  finSync();
  const id = curId,
    on = id != null && _fin.id === id && !!libEntry() && pageDone();
  let h = '';
  if (on && _fin.rec) {
    // (shown: decoded for the card)
    finDecode();
    const r = _fin.rec,
      // (v315: the day it was added; a Turn or Adjust corners since doesn't move it)
      at = +r.added || r.ts || 0,
      d = new Date(at),
      today = new Date().toDateString() === d.toDateString(),
      when = today ? 'today' : typeof heroDate === 'function' ? heroDate(at) : '';
    h =
      // (v314.1: the picture opens the card too)
      '<div class="sffinhave"><button type="button" class="sffinpic" data-fin="show" aria-label="Your photo of the finished page, beside the plan"><img alt="" src="' +
      esc(r.u) +
      '"></button><div class="sffint"><b>Your page</b><span class="sffinwhen">Added ' +
      esc(when) +
      (r.flat ? ' · straightened' : '') +
      '</span><span class="sffinlinks"><button type="button" class="sflink" data-fin="show">Show beside the plan</button>' +
      (_finLast && _finLast.id === id
        ? '<button type="button" class="sflink" data-fin="adjust">Adjust corners</button>'
        : '') +
      // (v315: a quarter turn, for a photo the wrong way up)
      '<button type="button" class="sflink" data-fin="turn" aria-label="Turn the photo a quarter turn">Turn</button>' +
      '<button type="button" class="sflink" data-fin="change">Change</button></span></div></div>';
  } else if (on && _fin.read)
    h =
      '<button type="button" class="sffinadd" data-fin="add">' +
      ic('camera') +
      ' Add a photo of your page</button><div class="sffinnote">Keep your finished page beside its plan. It stays on this device. On a plain table darker than the paper, it straightens by itself.</div>';
  if (el._h === h) return;
  el._h = h;
  el.innerHTML = h;
  el.onclick = function (e) {
    const b = e.target.closest('[data-fin]');
    if (!b) return;
    const a = b.dataset.fin;
    if (a === 'add' || a === 'change') finPick(null);
    else if (a === 'show') finCardOpen();
    else if (a === 'turn') finTurn();
    else if (a === 'adjust' && _finLast && _finLast.id === curId)
      finEdit(_finLast.id, _finLast.src, _finLast.q, 'adjust');
  };
}

/* -- the card with the plan and the page: tall pages side by side, wide ones one over the other, a label over each,
   in Reveal's frame (89-show showLayout, with a box made to hold both) -- */
// the two slots in units of the box: the plan on its paper (p round it), and the photo; side by side, or one over the
// other
const FIN_LAB = 0.085,
  FIN_GAP = 0.07,
  FIN_PAD = 0.035;
function finCardBox(a1, a2, side) {
  const lab = FIN_LAB,
    gap = FIN_GAP,
    p = FIN_PAD;
  let bw, bh, s1, s2;
  if (side) {
    const ph = 1 + 2 * p;
    s1 = { x: 0, y: lab, w: a1 + 2 * p, h: ph };
    s2 = { x: s1.w + gap, y: lab, w: a2 * ph, h: ph };
    bw = s2.x + s2.w;
    bh = lab + ph;
  } else {
    s1 = { x: 0, y: lab, w: 1, h: (1 - 2 * p) / a1 + 2 * p };
    s2 = { x: 0, y: s1.y + s1.h + gap + lab, w: 1, h: 1 / a2 };
    bw = 1;
    bh = s2.y + s2.h;
  }
  return { bw: bw, bh: bh, s1: s1, s2: s2 };
}
// (v315) side by side or one over the other, whichever shows both pictures bigger: the smaller of the two, as the card
// lays them out (a tall plan beside a wide photo kept as is had been side by side and both small; a wide plan over a
// tall photo, stacked and both small). Side by side when they're as big.
function finCardSide(M, a1, a2, w, h) {
  const c = document.createElement('canvas'),
    g = c.getContext('2d'),
    p = FIN_PAD,
    at = function (side) {
      const b = finCardBox(a1, a2, side),
        L = showLayout(
          g,
          Object.assign({}, M, { crop: { x: 0, y: 0, w: b.bw * 1000, h: b.bh * 1000 } }),
          w,
          h,
          {
            card: true,
          },
        ),
        K = Math.min(L.art.w / b.bw, L.art.h / b.bh);
      return Math.min((b.s1.w - 2 * p) * (b.s1.h - 2 * p), b.s2.w * b.s2.h) * K * K;
    },
    side = at(true) >= at(false);
  freeCanvas(c);
  return side;
}
function buildFinCard(im, w, h, sideAs) {
  const M = showModel();
  if (!M || !im) return null;
  w = w || 1080;
  h = h || 1350;
  let xc = null;
  try {
    xc = buildExportCanvas(false, true);
  } catch (_) {}
  if (!xc) return null;
  const k = xc.width / W,
    cr = M.crop,
    a1 = cr.w / cr.h,
    a2 = (im.naturalWidth || im.width) / (im.naturalHeight || im.height),
    side = sideAs != null ? !!sideAs : finCardSide(M, a1, a2, w, h),
    lab = FIN_LAB,
    p = FIN_PAD,
    B = finCardBox(a1, a2, side),
    bw = B.bw,
    bh = B.bh,
    s1 = B.s1,
    s2 = B.s2;
  const M2 = Object.assign({}, M, { crop: { x: 0, y: 0, w: bw * 1000, h: bh * 1000 } }),
    c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d'),
    L = showLayout(g, M2, w, h, { card: true }),
    A = L.art,
    K = Math.min(A.w / bw, A.h / bh),
    ox = A.x + (A.w - bw * K) / 2,
    oy = A.y + (A.h - bh * K) / 2,
    at = function (s) {
      return { x: ox + s.x * K, y: oy + s.y * K, w: s.w * K, h: s.h * K };
    },
    P1 = at(s1),
    P2 = at(s2),
    pp = p * K,
    shade = function () {
      g.shadowColor = 'rgba(0,0,0,.55)';
      g.shadowBlur = Math.max(18, 60 * L.s);
      g.shadowOffsetY = Math.max(8, 26 * L.s);
    };
  showDrawGlow(g, M, L);
  // the plan, on its paper
  g.save();
  shade();
  g.fillStyle = 'rgb(' + PAPER.join(',') + ')';
  showRR(g, P1.x, P1.y, P1.w, P1.h, L.r);
  g.fill();
  g.restore();
  showDrawPaper(g, M, L, xc, k, {
    paper: P1,
    art: { x: P1.x + pp, y: P1.y + pp, w: P1.w - 2 * pp, h: P1.h - 2 * pp },
  });
  freeCanvas(xc);
  // the photo
  g.save();
  shade();
  g.fillStyle = '#000';
  showRR(g, P2.x, P2.y, P2.w, P2.h, L.r);
  g.fill();
  g.restore();
  g.save();
  showRR(g, P2.x, P2.y, P2.w, P2.h, L.r);
  g.clip();
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.drawImage(im, P2.x, P2.y, P2.w, P2.h);
  g.restore();
  // the labels
  // (v315: never smaller than 2% of the card's width, to read in a feed)
  const fs = Math.max(0.02 * w, lab * K * 0.42);
  g.save();
  g.font = showFont(SHOW_TEXT, fs).replace('500', '700');
  g.fillStyle = 'rgba(244,242,236,.66)';
  g.textBaseline = 'alphabetic';
  g.textAlign = 'left';
  g.fillText('THE PLAN', P1.x, P1.y - lab * K * 0.32);
  g.fillText('MY PAGE', P2.x, P2.y - lab * K * 0.32);
  g.restore();
  showDrawCap(g, M, L);
  // (where each went, for the tests)
  c.finAt = { side: side, plan: P1, page: P2, lab: fs };
  return c;
}
// the card, shown with Share (a tap of its own: Safari shares only from a tap)
function finCardOpen() {
  if (!_fin.rec || _fin.id !== curId || _finCardBusy || document.getElementById('sfFinCard')) return;
  const ready = _fin.img
    ? Promise.resolve(_fin.img)
    : new Promise(function (res) {
        const im = new Image();
        im.onload = function () {
          res(im);
        };
        im.onerror = function () {
          res(null);
        };
        im.src = _fin.rec.u;
      });
  _finCardBusy = true;
  Promise.all([ready, showFonts()])
    .then(function (r) {
      let c = null;
      try {
        c = buildFinCard(r[0]);
      } catch (_) {}
      if (!c) return null;
      // (made before it shows, so Share has it at once)
      return new Promise(function (res) {
        c.toBlob(
          function (b) {
            freeCanvas(c);
            res(b);
          },
          'image/jpeg',
          0.92,
        );
      });
    })
    .then(
      function (blob) {
        _finCardBusy = false;
        if (blob) finCardShow(blob);
        else note(errNote('Couldn’t make the picture.', 'Plan and page', 'its card couldn’t be drawn'));
      },
      function (e) {
        _finCardBusy = false;
        note(errNote('Couldn’t make the picture.', 'Plan and page', e));
      },
    );
}
let _finCardBusy = false;
function finCardShow(blob) {
  const url = URL.createObjectURL(blob),
    o = document.createElement('div'),
    op = document.activeElement,
    t0 = Date.now();
  o.className = 'overlay on sffincard';
  o.id = 'sfFinCard';
  o.setAttribute('role', 'dialog');
  o.setAttribute('aria-modal', 'true');
  o.setAttribute('aria-labelledby', 'sfFinCardT');
  o.innerHTML =
    '<div class="ocard dcard"><div class="mhead"><h2 class="mtitle" id="sfFinCardT">The plan and your page</h2></div>' +
    '<img class="sffincardimg" alt="The plan beside your photo of the finished page" src="' +
    url +
    '"><div class="sfedaskbtns"><button type="button" class="sfghost" data-a="close">Close</button><button type="button" class="btn-primary" data-a="share">Share</button></div></div>';
  const end = function () {
    o.remove();
    // (v329: the page live again before focus goes back to it, layers.js)
    modalSync();
    // (a minute on: a download Safari asks about first still has it)
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 60000);
    try {
      if (op && op.isConnected && op !== document.body) op.focus({ preventScroll: true });
    } catch (_) {}
  };
  o.addEventListener('click', function (e) {
    const b = e.target.closest('[data-a]');
    if (b && b.dataset.a === 'share')
      shareOrSave(
        blob,
        fileSlug(curName, 'my-page', 80).toLowerCase() + '-plan-and-page.jpg',
        curName || 'My colouring',
        'image',
        'Image downloaded.',
        finSay,
      );
    else if (b || (e.target === o && (Date.now() - t0 > 400 || e.detail === 0))) end();
  });
  document.body.appendChild(o);
  try {
    o.querySelector('.btn-primary').focus({ preventScroll: true });
  } catch (_) {}
}
// for Reveal's end (86-reveal-share) and the ⋯ menu (72-frame): the open guide has a photo
function finHas() {
  finSync();
  return curId != null && _fin.id === curId && !!_fin.rec;
}
