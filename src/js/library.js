function shortDate() {
  try {
    return new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch (e) {
    return '';
  }
}
// The name on the Palette card is the one the Library keeps: a palette in the Library (the same markers, in order)
// shows its name there; any other is named once for its markers and keeps that name while they stay, so saving
// doesn't rename it (paletteName skips names already in the Library, the palette's own included once it's saved)
var _palShown = { k: '', name: '' };
function shownPaletteName(idxs) {
  const keys = idxs.map(mkey),
    k = keys.join(','),
    inLib = state.saved.find(
      (s) =>
        s.type === 'palette' && s.name && s.keys && s.keys.length === keys.length && s.keys.join(',') === k,
    );
  if (inLib) return inLib.name;
  if (_palShown.k !== k) _palShown = { k: k, name: paletteName(idxs) };
  return _palShown.name;
}
// the name to save a new Library entry under: the one shown, unless the Library has it already (this palette saved
// before, or another item renamed to it), then a fresh one, which the card shows from then on
function nameForSave(idxs) {
  let nm = shownPaletteName(idxs);
  if (usedSavedNames().has(nm.toLowerCase())) {
    nm = paletteName(idxs);
    _palShown = { k: idxs.map(mkey).join(','), name: nm };
    const el = state.mode === 'palette' && readout.querySelector('.name');
    if (el) el.textContent = nm;
  }
  return nm;
}
// (v308) the Palette card's name again, after the Library renamed the palette shown (it kept the old one until drawn
// again)
function palNameSync() {
  const el = state.mode === 'palette' && readout.querySelector('.name'),
    idxs = el ? currentPaletteIdxs() : [];
  if (el && idxs.length) el.textContent = shownPaletteName(idxs);
}
function doSave() {
  const idxs = currentPaletteIdxs();
  if (!idxs.length) return;
  const entry = {
    id: Date.now(),
    type: 'palette',
    name: nameForSave(idxs),
    keys: idxs.map(mkey),
    ts: Date.now(),
    // (v308) its scheme, so it opens as that again (it had always opened as Custom); (v318.25) the palette's own,
    // not one chosen since that couldn't be made (currentPaletteHarm)
    h: currentPaletteHarm(),
  };
  state.saved.unshift(entry);
  saveNew(entry);
}
// keep a new Library entry, or take it back out and say storage is full (no "Saved" for something that wasn't)
function saveNew(entry) {
  if (!save(true)) {
    const j = state.saved.indexOf(entry);
    if (j >= 0) state.saved.splice(j, 1);
    chrome();
    saveFailNotice(true);
    return false;
  }
  chrome();
  flashSaved();
  renderRecent();
  return true;
}
// the Save button says Saved for a moment, then goes back to Save (a second save meanwhile just restarts the moment)
function flashSaved() {
  clearTimeout(flashSaved.t);
  saveBtn.textContent = 'Saved \u2713';
  saveBtn.disabled = true;
  saveBtn.classList.add('flash');
  flashSaved.t = setTimeout(() => {
    saveBtn.textContent = 'Save';
    saveBtn.classList.remove('flash');
    chrome();
  }, 1100);
}
var libQuery = '',
  libSort = 'recent';
function relDate(ts) {
  if (!ts) return '';
  var d = Date.now() - ts,
    day = 86400000;
  if (d < 0) return '';
  if (d < day) return 'today';
  if (d < 2 * day) return 'yesterday';
  if (d < 7 * day) return Math.floor(d / day) + ' days ago';
  try {
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch (e) {
    return '';
  }
}
var _thumbTried = {};
// ---- Home (v285): the Continue card (the newest guide part-way coloured: its picture as coloured so far, the rest of
// the plan pale, how far, and the marker to pick up next; it opens Colour along at that marker) and Your guides (the
// others, a grid on an iPad, a sideways strip on a phone), each picture drawn from the guide's sections and cached.
// The intro line shows only before there are any guides. ----
var _homeArt = {};
// a guide's picture from its stored sections: mode 'plan' every section in its marker; 'prog' those coloured (ticked,
// or some tones) in theirs and the rest pale. Resolves to a data: URL, or '' when it can't be drawn. `over`: how many
// times bigger it is drawn before being shrunk smoothly (2; the latest piece's 1.4, about half the work, v306)
function homeArt(g, mode, maxW, over) {
  over = over || 2;
  var key = g.id + '|' + (g.ts || 0) + '|' + mode + '|' + maxW + (over === 2 ? '' : '|' + over);
  if (_homeArt[key]) return _homeArt[key];
  // (one picture kept per guide and kind: an older one of this guide goes)
  var pre = g.id + '|',
    suf = '|' + mode + '|' + maxW + (over === 2 ? '' : '|' + over);
  Object.keys(_homeArt).forEach(function (k) {
    if (k.indexOf(pre) === 0 && k.slice(-suf.length) === suf) delete _homeArt[k];
  });
  // (and no more than 60 kept in all, the oldest going first: a Library of many guides scrolled through)
  var ks = Object.keys(_homeArt);
  for (var q = 0; q < ks.length - 59; q++) delete _homeArt[ks[q]];
  var p = IDB.get('guide-' + g.id)
    .then(function (pl) {
      if (!pl || typeof pl.lmap !== 'string' || pl.lmap.slice(0, 11) !== 'data:image/') return '';
      return new Promise(function (res) {
        var im = new Image();
        // (v307: decoded first, off the page's thread where the browser can: drawn straight from the file, Safari's
        // engine decoded it there and then, holding Home up)
        im.onload = function () {
          if (im.decode && !im.__dec) {
            im.__dec = 1;
            im.decode().then(im.onload, im.onload);
            return;
          }
          try {
            // (drawn at twice the size and then shrunk smoothly: read pixel by pixel at the size shown, the lines came
            // out stepped and broken, v303)
            var W = im.width,
              H = im.height,
              k = Math.min(1, (over * maxW) / W, (over * maxW) / H),
              w = Math.max(1, Math.round(W * k)),
              h = Math.max(1, Math.round(H * k)),
              c = document.createElement('canvas');
            c.width = w;
            c.height = h;
            var gx = c.getContext('2d');
            // (nearest pixel: each one keeps a section's number)
            gx.imageSmoothingEnabled = false;
            gx.drawImage(im, 0, 0, w, h);
            var id = gx.getImageData(0, 0, w, h),
              px = id.data,
              sa = pl.assign && typeof pl.assign === 'object' ? pl.assign : {},
              done = {},
              cache = {},
              paper = PROG_PAPER;
            (Array.isArray(pl.prog) ? pl.prog : []).forEach(function (l) {
              done[l] = 1;
            });
            if (pl.tones && typeof pl.tones === 'object')
              for (var t in pl.tones) if (pl.tones[t]) done[t] = 1;
            for (var j = 0; j < px.length; j += 4) {
              var v = px[j] | (px[j + 1] << 8) | (px[j + 2] << 16),
                col;
              if (v === 0) col = [34, 36, 38];
              else {
                var l = v - 1,
                  on = mode === 'plan' || !!done[l],
                  ck = l + (on ? '+' : '-');
                col = cache[ck];
                if (!col) {
                  var ki = typeof sa[l] === 'string' ? keyIdx(sa[l]) : null,
                    hx = ki != null && COLORS[ki] ? COLORS[ki].hex : null;
                  if (!hx) col = paper;
                  else {
                    var rgb = [1, 3, 5].map(function (q) {
                      return parseInt(hx.slice(q, q + 2), 16);
                    });
                    col = on ? rgb : progMix(rgb, PROG_PALE);
                  }
                  cache[ck] = col;
                }
              }
              px[j] = col[0];
              px[j + 1] = col[1];
              px[j + 2] = col[2];
              px[j + 3] = 255;
            }
            gx.putImageData(id, 0, 0);
            var k2 = Math.min(1, maxW / w, maxW / h),
              o = c;
            if (k2 < 1) {
              o = document.createElement('canvas');
              o.width = Math.max(1, Math.round(w * k2));
              o.height = Math.max(1, Math.round(h * k2));
              var og = o.getContext('2d');
              og.imageSmoothingEnabled = true;
              og.imageSmoothingQuality = 'high';
              og.drawImage(c, 0, 0, o.width, o.height);
              freeCanvas(c);
            }
            var u = o.toDataURL('image/jpeg', 0.86);
            // (the canvas let go at once: Safari limits the memory all canvases may hold)
            freeCanvas(o);
            res(u);
          } catch (e) {
            res('');
          }
        };
        im.onerror = function () {
          res('');
        };
        im.src = pl.lmap;
      });
    })
    .catch(function () {
      return '';
    });
  _homeArt[key] = p;
  return p;
}
// the marker to pick up next in a guide (as Colour along goes: lightest first): one part-way done, else the first
// not finished. { hex, code, name } or null
function homeNext(pl) {
  // (zone by zone, Colour along goes zone first: the card doesn't name a marker it might not open at)
  try {
    if (pl && Array.isArray(pl.zones) && pl.zones.length && localStorage.getItem('ms-along-zones') === '1')
      return null;
  } catch (_) {}
  var sa = pl && pl.assign && typeof pl.assign === 'object' ? pl.assign : {},
    done = {},
    part = {},
    by = {};
  (Array.isArray(pl && pl.prog) ? pl.prog : []).forEach(function (l) {
    done[l] = 1;
  });
  if (pl && pl.tones && typeof pl.tones === 'object') for (var t in pl.tones) if (pl.tones[t]) part[t] = 1;
  for (var l in sa) {
    var k = sa[l];
    if (typeof k !== 'string') continue;
    var e = by[k] || (by[k] = { k: k, n: 0, d: 0, p: 0 });
    e.n++;
    if (done[l]) e.d++;
    else if (part[l]) e.p++;
  }
  var lum = function (hx) {
      return hx
        ? 0.299 * parseInt(hx.slice(1, 3), 16) +
            0.587 * parseInt(hx.slice(3, 5), 16) +
            0.114 * parseInt(hx.slice(5, 7), 16)
        : 0;
    },
    list = Object.keys(by)
      .map(function (k) {
        var e = by[k],
          i = keyIdx(k);
        e.c = i != null ? COLORS[i] : null;
        return e;
      })
      .filter(function (e) {
        return e.c && e.d < e.n;
      })
      .sort(function (a, b) {
        return lum(b.c.hex) - lum(a.c.hex) || b.n - a.n;
      }),
    pick =
      list.find(function (e) {
        return e.d > 0 || e.p > 0;
      }) || list[0];
  if (!pick) return null;
  // (a marker dry or no longer owned shows as the closest one owned where there's still colouring to do: the card
  // doesn't name one Colour along won't open at)
  var pi = keyIdx(pick.k);
  try {
    if (state.owned.size && (pi == null || !isOwned(pi) || isDry(pi))) return null;
  } catch (_) {}
  // (v318.21: your cap's code and name, caps.js)
  return {
    hex: pick.c.hex,
    code: pi != null ? capCode(pi) : pick.c.code,
    name: (pi != null ? capName(pi) : pick.c.name) || '',
  };
}
function homeName(g) {
  var nm =
    g.name && !/^(Guide|Colour guide)$/.test(g.name)
      ? g.name
      : evoName(
          (g.keys || []).map(function (k) {
            var _i = keyIdx(k);
            return _i != null && COLORS[_i] ? COLORS[_i].hex : null;
          }),
        ) || 'Colouring guide';
  return nm || 'Guide';
}
// started (a tick, or some tones) and not finished: what the Continue card offers
// (v313) the Continue card's "Last coloured 3 days ago": nothing the same day; the last tick's time (lc), else when it was
// last saved, for a guide coloured before that was kept
function homeWhen(g) {
  const t = +g.lc || +g.ts || 0;
  if (!t) return '';
  const day = function (x) {
      const d = new Date(x);
      return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5;
    },
    n = Math.round(day(Date.now()) - day(t));
  return n < 1 ? '' : n === 1 ? 'Last coloured yesterday' : 'Last coloured ' + n + ' days ago';
}
// (v313: not the sample with a few ticks to try it, until it's printed or renamed: smp)
function homeStarted(g) {
  return !g.smp && (+g.done > 0 || +g.tn > 0) && !(+g.n > 0 && +g.done >= +g.n);
}
// the start card's buttons: a photo (the picker straight away, in the tap, as New colouring guide once there are
// guides), or the sample
function homeStart(what) {
  if (!window.SF) return;
  if (what === 'sample') {
    setMode('sections');
    if (SF.loadSample) SF.loadSample();
    return;
  }
  // (v313) a page in a PDF: its own picker, then the Guide screen
  if (what === 'pdf') {
    if (SF.pickPdfHome)
      SF.pickPdfHome(function () {
        setMode('sections');
      });
    return;
  }
  // (section edits not built: the Guide screen and its question first, as New colouring guide does)
  if (SF.secEdPending && SF.secEdPending() && SF.edToPlan) {
    setMode('sections');
    SF.edToPlan(true);
    return;
  }
  if (SF.pickPhotoHome)
    SF.pickPhotoHome(function () {
      setMode('sections');
    });
}
// New colouring guide as it shows: on an iPad with no guide in progress, the start card's Choose a photo (v300)
function homeStartBtn() {
  var b = document.querySelector('#homeCont [data-start="photo"]');
  return b && b.getClientRects().length ? b : document.getElementById('homeNew');
}
/* ---- Home's latest piece (v306): the newest guide, when it's finished and none is in progress, leads Home above the
   two columns, with Reveal & share and Print…. Its box is laid out at once from what the Library holds (the name,
   sections, markers and the markers' ribbon, the picture's box in the page's shape) and the picture comes after the
   first paint, drawn from the guide's sections at 1.4 times its size (cached, as Home's other pictures are), with the
   finish date; the glow is soft washes of the guide's own colours (no blur: heavy in Safari). Nothing new is saved.
   A guide whose picture can't be read has none: Home goes back to the start card. ---- */
var _heroBad = {};
// a copy kept with section edits still to be built ("… (section edits)", keepSlot in 60-persist): its row says so
// (eds), or, kept before rows did, its name does
function heroEdits(g) {
  return g.eds === 1 || (g.eds === undefined && / \(section edits\)$/.test(g.name || ''));
}
// the newest guide, leaving out copies with section edits to build, when it's finished and Continue has nothing to
// offer; else null
function homeHeroPick(all, cont) {
  var g =
    !cont &&
    all.find(function (x) {
      return !heroEdits(x);
    });
  if (!g || !(+g.n > 0) || +g.done < +g.n) return null;
  return _heroBad[g.id + '|' + (g.ts || 0)] ? null : g;
}
// "4 Oct" (and the year, when it isn't this one)
function heroDate(t) {
  try {
    var d = new Date(t),
      o = { day: 'numeric', month: 'short' };
    if (d.getFullYear() !== new Date().getFullYear()) o.year = 'numeric';
    return d.toLocaleDateString('en-GB', o);
  } catch (e) {
    return '';
  }
}
function heroHex(keys) {
  return (keys || [])
    .map(function (k) {
      var i = keyIdx(k);
      return i != null && COLORS[i] ? COLORS[i].hex : null;
    })
    .filter(Boolean);
}
// the ribbon: the guide's markers in the order they were laid (up to 32, evenly), hard stops
function heroRibbon(hx) {
  if (!hx.length) return 'none';
  var n = Math.min(32, hx.length),
    out = [];
  for (var q = 0; q < n; q++) {
    var c = hx[Math.floor(((q + 0.5) * hx.length) / n)];
    out.push(c + ' ' + ((q * 100) / n).toFixed(2) + '%', c + ' ' + (((q + 1) * 100) / n).toFixed(2) + '%');
  }
  return 'linear-gradient(90deg,' + out.join(',') + ')';
}
// the glow: four soft washes of its colours, from the start of the run (top left) to its end (bottom right)
function heroGlow(hx) {
  if (!hx.length) return '';
  var at = function (f) {
      var c = hx[Math.min(hx.length - 1, Math.floor(f * hx.length))];
      return [1, 3, 5]
        .map(function (q) {
          return parseInt(c.slice(q, q + 2), 16);
        })
        .join(',');
    },
    w = function (x, y, f, a) {
      return (
        'radial-gradient(ellipse 60% 70% at ' +
        x +
        ' ' +
        y +
        ',rgba(' +
        at(f) +
        ',' +
        a +
        '),transparent 70%)'
      );
    };
  return [
    w('8%', '6%', 0.05, 0.3),
    w('92%', '10%', 0.35, 0.22),
    w('10%', '96%', 0.65, 0.24),
    w('94%', '94%', 0.92, 0.26),
  ].join(',');
}
// (v314) the latest piece's picture: the photo of the finished page (v 'page') or the plan; fade: as it first shows
function heroShow(el, ar, v, fade) {
  var b = el.querySelector('.hhbox'),
    h = el._hero,
    seg = el.querySelector('.hhseg'),
    wh = el.querySelector('.hhwhen');
  if (!b || !h) return;
  var ph = !!h.fin && v !== 'plan',
    src = ph ? h.fin.u : h.plan;
  // (v314.1) the box keeps one shape for both pictures, so Your page | Plan doesn't move the card: a straightened
  // photo's (the plan sits on paper of that shape), else the plan's (a photo kept as taken sits inside it)
  b.style.setProperty('--ar', heroShape(h.fin, ar).toFixed(4));
  b.classList.toggle('ph', ph);
  b.innerHTML =
    '<img alt="' +
    (ph ? 'Your photo of the finished page' : '') +
    '" src="' +
    esc(src) +
    '"' +
    (fade && !reduce ? ' class="hhfade"' : '') +
    '>';
  if (seg) {
    seg.hidden = !h.fin;
    seg.querySelectorAll('[data-v]').forEach(function (x) {
      x.setAttribute('aria-pressed', String((x.getAttribute('data-v') === 'page') === ph));
    });
  }
  if (wh && h.when) wh.textContent = h.when + (ph ? ' · your photo' : '');
  heroPillFit(el);
}
window.addEventListener('resize', function () {
  var el = document.getElementById('homeHero');
  if (el && el._hero && el.offsetParent !== null) heroPillFit(el);
});
// the picture's box: a straightened photo's shape, else the page's (ar)
function heroShape(fin, ar) {
  return fin && fin.flat ? Math.max(0.2, Math.min(5, fin.w / fin.h)) : ar;
}
// (v314.1) the pill over the picture's foot (Your page | Plan, or Add photo): when it's wider than the picture (a narrow
// page), Add photo without its camera, and if that's still too wide, the pill under the picture. On a phone the
// picture is its whole cream column (the card's footprint is fixed there), so only that column counts.
function heroPillFit(el) {
  var phone = !(window.matchMedia && matchMedia('(min-width: 700px)').matches),
    b = el.querySelector(phone ? '.hhpic' : '.hhbox'),
    w = el.querySelector('.hhpicw');
  if (!b || !w) return;
  w.classList.remove('hhnarrow', 'hhunder');
  var bw = b.getBoundingClientRect().width,
    wide = function () {
      var p = el.querySelector('.hhseg:not([hidden]), .hhfin:not([hidden])');
      return !!p && p.getBoundingClientRect().width > bw - 8;
    };
  if (!bw || !wide()) return;
  w.classList.add('hhnarrow');
  if (!phone && wide()) w.classList.add('hhunder');
}
// which picture a guide's latest piece shows (its photo, unless Plan was chosen for it), kept as ms-fin-view
var FIN_VIEW = 'ms-fin-view',
  FIN_X = 'ms-finx';
function heroView(id) {
  try {
    var m = JSON.parse(localStorage.getItem(FIN_VIEW) || '{}');
    return m && m[id] === 'plan' ? 'plan' : 'page';
  } catch (e) {
    return 'page';
  }
}
function heroViewSet(id, v) {
  try {
    var m = JSON.parse(localStorage.getItem(FIN_VIEW) || '{}') || {};
    if (v === 'plan') m[id] = 'plan';
    else delete m[id];
    // (no more than 60 kept: the oldest go)
    var ks = Object.keys(m);
    for (var i = 0; i < ks.length - 60; i++) delete m[ks[i]];
    localStorage.setItem(FIN_VIEW, JSON.stringify(m));
  } catch (e) {}
}
// Add a photo of your page put away (✕) for a guide, kept as ms-finx
function heroFinX(id) {
  try {
    var a = JSON.parse(localStorage.getItem(FIN_X) || '[]');
    return Array.isArray(a) && a.indexOf(id) >= 0;
  } catch (e) {
    return false;
  }
}
function heroFinXSet(id) {
  try {
    var a = JSON.parse(localStorage.getItem(FIN_X) || '[]');
    if (!Array.isArray(a)) a = [];
    if (a.indexOf(id) < 0) a.push(id);
    localStorage.setItem(FIN_X, JSON.stringify(a.slice(-60)));
  } catch (e) {}
}
// (v314) a guide's photo of its finished page was added, changed or removed (guide/24-page-photo.js): the backup
// reminder counts it as a change (fn), and Home's latest piece shows it
function homeFinChanged(id, rec) {
  var r = state.saved.find(function (s) {
    return s.id === id && s.type === 'guide';
  });
  if (r) {
    r.fn = Date.now();
    finRowShape(r, rec);
    save(true);
  }
  var el = document.getElementById('homeHero');
  if (el) el.removeAttribute('data-hid');
  renderRecent();
  if (typeof renderBackupNudge === 'function') renderBackupNudge();
}
// (v315) the open guide's photo changed in another tab or by a restore: Home's latest piece drawn again (the row's
// note of it is already saved)
function homeFinSeen() {
  var el = document.getElementById('homeHero');
  if (el) el.removeAttribute('data-hid');
  renderRecent();
}
function homeHero(g) {
  var el = document.getElementById('homeHero');
  if (!el) return;
  if (!g) {
    if (el.getAttribute('data-hid')) {
      el.removeAttribute('data-hid');
      el.innerHTML = '';
    }
    el.style.display = 'none';
    return;
  }
  var sig = g.id + '|' + (g.ts || 0) + '|' + homeName(g);
  el.style.display = '';
  if (el.getAttribute('data-hid') === sig) return;
  el.setAttribute('data-hid', sig);
  var nm = esc(homeName(g)),
    hx = heroHex(g.keys),
    nk = (g.keys || []).length,
    W = +g.W > 0 ? +g.W : 3,
    H = +g.H > 0 ? +g.H : 4,
    ar = Math.max(0.2, Math.min(5, W / H)),
    // (v314.1: the shape its straightened photo will give the box, kept in its row, so the box doesn't change when
    // the photo comes)
    ar0 = +g.fa > 0 ? Math.max(0.2, Math.min(5, +g.fa)) : ar;
  el.innerHTML =
    '<div class="hhcard" style="background-image:' +
    heroGlow(hx) +
    '"><div class="hhpicw"><button type="button" class="hhpic" data-hero="open" aria-label="Open ' +
    nm +
    '"><span class="hhbox" style="--ar:' +
    ar0.toFixed(4) +
    '"></span></button>' +
    // (v314) with a photo of the finished page: it shows first, and the plan a tap away (remembered for the guide)
    '<div class="hhseg" role="group" aria-label="Picture" hidden><button type="button" data-hero="view" data-v="page" aria-pressed="true">Your page</button><button type="button" data-hero="view" data-v="plan" aria-pressed="false">Plan</button></div>' +
    // (v314) without one, in its place: Add a photo of your page, until it's added or put away (✕); over the picture,
    // so the card keeps its size
    '<div class="hhfin" hidden><button type="button" class="hhfinadd" data-hero="fin" aria-label="Add a photo of your page">' +
    ic('camera') +
    '<span aria-hidden="true">Add photo</span></button><button type="button" class="hhfinx" data-hero="finx" aria-label="Not now: no photo of this page">' +
    ic('x') +
    '</button></div></div><div class="hhbody"><span class="hheb"><i class="hhdone" aria-hidden="true"></i><span class="hhwhen">Finished</span></span><h2 class="hhname">' +
    nm +
    '</h2><span class="hhmeta">' +
    nWord(+g.n, 'section') +
    ' · <span class="hhnw">' +
    nk +
    ' marker' +
    (nk === 1 ? '' : 's') +
    '</span>' +
    // (v307: with shading, the markers it takes besides; on a phone the line breaks only before the "+")
    (+g.sk > 0 ? ' <span class="hhnw">+ ' + +g.sk + ' for shading</span>' : '') +
    '</span><span class="hhribbon" aria-hidden="true" style="background:' +
    heroRibbon(hx) +
    '"></span><div class="hhacts"><button type="button" id="homeHeroGo" class="btn-primary hhgo" data-hero="reveal">' +
    ic('sparkles') +
    ' Reveal &amp; share</button><button type="button" id="homeHeroPrint" class="hhprint" data-hero="print" aria-haspopup="dialog">' +
    ic('printer') +
    ' Print…</button></div></div></div>';
  var gid = g.id,
    same = function () {
      return el.getAttribute('data-hid') === sig;
    };
  // (after the first paint: drawing the picture holds the page up for a moment, longer in Safari)
  requestAnimationFrame(function () {
    setTimeout(function () {
      var box = same() && el.querySelector('.hhbox');
      if (!box) return;
      var r = box.getBoundingClientRect(),
        px = Math.max(r.width, r.height) * Math.min(2, window.devicePixelRatio || 1),
        maxW = Math.max(200, Math.min(1200, Math.ceil(px / 50) * 50));
      Promise.all([
        homeArt(g, 'plan', maxW, 1.4),
        IDB.get('guide-' + gid).catch(function () {
          return null;
        }),
        window.SF && SF.finGet ? SF.finGet(gid) : null,
      ]).then(function (res) {
        if (!same()) return;
        if (!res[0]) {
          // (its picture can't be read: no latest piece, and Home as it would be without it)
          _heroBad[g.id + '|' + (g.ts || 0)] = 1;
          renderRecent();
          return;
        }
        var e = res[1] && res[1].dates && +res[1].dates.e;
        hero.plan = res[0];
        hero.fin = res[2] || null;
        hero.when = e ? 'Finished · ' + heroDate(e) : '';
        heroShow(el, ar, heroView(gid), true);
        var hf = el.querySelector('.hhfin');
        if (hf) hf.hidden = !!hero.fin || heroFinX(gid) || !(window.SF && SF.finPick);
        heroPillFit(el);
      });
    }, 0);
  });
  var hero = { plan: '', fin: null, when: '' };
  el._hero = hero;
  el.onclick = function (e) {
    var b = e.target.closest('[data-hero]');
    if (!b || !window.SF) return;
    var what = b.getAttribute('data-hero');
    // (v314) the photo of the finished page: which picture shows, and adding one (the picker opens in the tap)
    if (what === 'view') {
      heroViewSet(gid, b.getAttribute('data-v'));
      heroShow(el, ar, heroView(gid), false);
      return;
    }
    if (what === 'fin') {
      if (SF.finPick) SF.finPick(gid);
      return;
    }
    if (what === 'finx') {
      heroFinXSet(gid);
      var hf = el.querySelector('.hhfin');
      if (hf) hf.hidden = true;
      heroPillFit(el);
      var go = document.getElementById('homeHeroGo');
      if (go)
        try {
          go.focus({ preventScroll: true });
        } catch (_) {}
      return;
    }
    setMode('sections');
    if (what === 'open' || !SF.openThen) {
      if (SF.openDesign) SF.openDesign(gid);
    } else SF.openThen(gid, what);
  };
}
function renderRecent() {
  var _ls = document.getElementById('homeLibSub');
  if (_ls) {
    var _n = state.saved.length;
    _ls.textContent = _n ? _n + ' saved' : 'Nothing yet';
  }
  // (only while Home shows: a save while colouring would otherwise redraw the Continue card's picture on every tick;
  // showing Home draws it, chrome.js)
  if (window.SF && SF.startPic)
    SF.startPic(
      !state.saved.some(function (s) {
        return s.type === 'guide';
      }),
    );
  var _hv = document.getElementById('homeView');
  if (_hv && _hv.style.display === 'none') return;
  if (window.SF && SF.palNote) SF.palNote();
  var el = document.getElementById('sfRecent'),
    cel = document.getElementById('homeCont'),
    top = cel && cel.parentElement,
    head = document.querySelector('#homeView .homehead');
  if (!el) return;
  var all = state.saved
      .filter(function (s) {
        return s.type === 'guide';
      })
      .sort(function (a, b) {
        return (b.ts || 0) - (a.ts || 0);
      }),
    cont = all.find(homeStarted) || null,
    // (v306: the latest piece, left out of Your guides before its cards are picked, or the grid shows three)
    hero = homeHeroPick(all, cont),
    gs = all
      .filter(function (g) {
        return g !== cont && g !== hero;
      })
      .slice(0, 4);
  homeHero(hero);
  if (head) head.style.display = all.length ? 'none' : '';
  // the Continue card
  if (cel) {
    if (!cont) {
      // (v300) no guide in progress: a card for starting one in its place, so Home is the same two columns on an iPad
      // in every state (the CSS shows it only where there's room for them; a phone keeps New colouring guide)
      // (until there's a guide of one's own, the sample page and its guide, tapped for the sample; then just the words)
      var nc = !all.length && !!(window.SF && SF.sampleBA),
        cid = nc ? 'start' : 'start-c';
      if (cel.getAttribute('data-cid') !== cid) {
        var ba = nc ? SF.sampleBA() : '';
        cel.setAttribute('data-cid', cid);
        cel.removeAttribute('data-ts');
        cel.removeAttribute('data-nm');
        cel.innerHTML =
          '<div class="hccard hcstart' +
          (ba ? '' : ' compact') +
          '">' +
          (ba
            ? // (a big target for the sample; screen readers and the keyboard have "or try the sample")
              '<button type="button" class="hcpic" data-start="sample" tabindex="-1" aria-hidden="true">' +
              ba +
              '</button>'
            : '') +
          '<div class="hcbody"><span class="hceb">New colouring guide</span><h2 class="hcname">Turn a photo of a colouring page into a <span class="hcnw">marker-by-number</span> guide</h2><span class="hcmeta hcown"></span><button type="button" class="btn-primary hcgo" data-start="photo">Choose a photo</button><button type="button" class="homelink hcalt" data-start="sample">or try the sample</button><button type="button" class="homelink hcalt hcpdf" data-start="pdf">Page in a PDF? Open the PDF</button></div></div>';
      }
      var own = cel.querySelector('.hcown'),
        // (v309.1: the colours; a set's Colorless Blender builds nothing. v318.27: Home's Markers card counts the
        // same colours, the blender aside)
        // (v310.2: what guides use: not those marked dry, said as left out)
        ink = inkKeys([...state.owned]),
        nDry = ink.filter(function (k) {
          const i = keyIdx(k);
          return i != null && isDry(i);
        }).length,
        nOwn = ink.length - nDry;
      if (own)
        own.textContent =
          (nOwn
            ? 'Built from your ' +
              nOwn +
              ' colour' +
              (nOwn === 1 ? '' : 's') +
              (nDry ? ' (' + nDry + ' marked dry ' + (nDry === 1 ? 'is' : 'are') + ' left out)' : '') +
              '. '
            : ink.length
              ? 'Every marker you own is marked dry: unmark the ones you’ve refilled or replaced in Markers. '
              : 'Built from the markers you own: add yours in Markers. ') +
          'Lay the page flat in even light, and get all of it in the frame.';
      cel.style.display = '';
    } else if (
      cel.getAttribute('data-cid') !== String(cont.id) ||
      cel.getAttribute('data-ts') !== String(cont.ts) ||
      cel.getAttribute('data-nm') !== homeName(cont) ||
      cel.getAttribute('data-when') !== homeWhen(cont)
    ) {
      var nm = esc(homeName(cont)),
        n = +cont.n || 0,
        d = +cont.done || 0,
        pc = n ? Math.max(1, Math.min(100, Math.round((d * 100) / n))) : 0;
      cel.setAttribute('data-cid', String(cont.id));
      cel.setAttribute('data-ts', String(cont.ts));
      cel.setAttribute('data-nm', homeName(cont));
      cel.setAttribute('data-when', homeWhen(cont));
      cel.innerHTML =
        '<button type="button" class="hccard" data-gid="' +
        esc(cont.id) +
        '" data-cont="1" aria-label="Continue colouring ' +
        nm +
        ': ' +
        progressText(d, n, true) +
        (homeWhen(cont) ? '. ' + homeWhen(cont) : '') +
        '"><span class="hcpic"><span class="hcph"></span></span><span class="hcbody"><span class="hceb" aria-hidden="true">Continue colouring</span><span class="hcname" aria-hidden="true">' +
        nm +
        '</span><span class="hcbar" aria-hidden="true"><i style="width:' +
        pc +
        '%"></i></span><span class="hcmeta" aria-hidden="true">' +
        progressText(d, n) +
        '</span>' +
        (homeWhen(cont)
          ? '<span class="hcmeta hcwhen" aria-hidden="true">' + homeWhen(cont) + '</span>'
          : '') +
        '<span class="btn-primary hcgo" aria-hidden="true">Continue</span></span></button>';
      cel.style.display = '';
      var gid = cont.id,
        gts = String(cont.ts),
        same = function () {
          return cel.getAttribute('data-cid') === String(gid) && cel.getAttribute('data-ts') === gts;
        };
      homeArt(cont, 'prog', 560).then(function (u) {
        var ph = same() && cel.querySelector('.hcph');
        if (u && ph) ph.outerHTML = '<img alt="" src="' + u + '">';
      });
      IDB.get('guide-' + gid)
        .then(function (pl) {
          var nx = pl ? homeNext(pl) : null,
            m = same() && cel.querySelector('.hcmeta');
          if (nx && m && !m.querySelector('.hcdot')) {
            var cb = cel.querySelector('.hccard');
            if (cb) {
              // (the next marker after how far along; "Last coloured …" stays last, v313)
              var lb = cb.getAttribute('aria-label'),
                wh = homeWhen(cont);
              if (wh && lb.slice(-wh.length) === wh) lb = lb.slice(0, -(wh.length + 2));
              cb.setAttribute(
                'aria-label',
                lb + ', next ' + nx.code + (nx.name ? ' ' + nx.name : '') + (wh ? '. ' + wh : ''),
              );
            }
            m.innerHTML +=
              ' · next <span class="hcdot" style="background:' +
              esc(nx.hex) +
              '"></span> <b>' +
              esc(nx.code) +
              '</b> ' +
              esc(nx.name);
          }
        })
        .catch(function () {});
    }
    if (top) top.classList.toggle('nocont', !cont);
  }
  var hub0 = document.querySelector('#homeView .homehub');
  if (hub0) hub0.classList.toggle('hasstart', !cont);
  // (v316) How it works, under the cards on a wide screen, until the first guide is made
  if (hub0) hub0.classList.toggle('hownew', !all.length);
  var nb = document.getElementById('homeNew');
  // (beside the Continue card, a new guide is the second choice)
  if (nb) nb.classList.toggle('homenew2', !!cont);
  // (hasall: Your guides shows, with its All guides link; the Library card stays beside it, v308.1)
  var hub = document.querySelector('#homeView .homehub');
  if (hub) hub.classList.toggle('hasall', !!gs.length);
  if (!gs.length) {
    el.style.display = 'none';
    el.innerHTML = '';
  } else {
    var html =
      '<div class="sfRecentHead"><h2 class="sfrech">Your guides</h2><button class="homelink sfSeeAll" data-lib="1">All guides (' +
      all.length +
      ') <span aria-hidden="true">›</span></button></div><div class="sfRecList">';
    gs.forEach(function (g) {
      html +=
        '<button class="sfRecCard" data-gid="' +
        esc(g.id) +
        '"><span class="sfRecPic">' +
        (safeThumb(g.thumb) ? '<img class="sfRecThumb" src="' + esc(safeThumb(g.thumb)) + '" alt="">' : '') +
        '</span><span class="sfRecMeta"><span class="sfRecName">' +
        esc(homeName(g)) +
        '</span><span class="sfRecDate">' +
        // (how far it's coloured, then when, in the Library's order: v284, v300)
        progressText(g.done, g.n) +
        ' · ' +
        relDate(g.ts) +
        '</span></span></button>';
    });
    el.innerHTML = html + '</div>';
    el.style.display = '';
    // (each card's picture drawn from its sections: sharper than the Library's small thumbnail)
    gs.forEach(function (g) {
      homeArt(g, 'plan', 320).then(function (u) {
        var c = u && el.querySelector('.sfRecCard[data-gid="' + g.id + '"] .sfRecPic');
        if (c) c.innerHTML = '<img class="sfRecThumb" alt="" src="' + u + '">';
      });
    });
  }
  var go = function (e) {
    if (e.target.closest('[data-lib]')) {
      openLibrary();
      return;
    }
    var st = e.target.closest('[data-start]');
    if (st) {
      homeStart(st.getAttribute('data-start'));
      return;
    }
    var c = e.target.closest('[data-gid]');
    if (!c) return;
    var id = +c.getAttribute('data-gid');
    setMode('sections');
    if (c.hasAttribute('data-cont') && window.SF && SF.continueGuide) SF.continueGuide(id);
    else if (window.SF && SF.openDesign) SF.openDesign(id);
  };
  el.onclick = go;
  if (cel) cel.onclick = go;
  all.slice(0, 5).forEach(function (g) {
    if (safeThumb(g.thumb)) return;
    if (_thumbTried[g.id]) return;
    _thumbTried[g.id] = 1;
    if (window.SF && SF.thumbFor)
      SF.thumbFor(g.id).then(function (t) {
        if (!t) return;
        g.thumb = t;
        if (!save(true, true)) g.thumb = '';
      });
  });
}
function renderLibStat() {
  const el = $('libStat');
  if (!el) return;
  const n = state.saved.filter((s) => s.type === 'guide').length,
    bk = lastGuideBackup(),
    risk = guidesAtRisk();
  if (!n) {
    el.textContent = '';
    return;
  }
  // (guides saved as built, nothing coloured, aren't counted as at risk, v285, but they aren't in a backup either)
  const out = state.saved.filter((s) => s.type === 'guide' && s.fresh && (s.ts || 0) > (+s.bk || bk)).length;
  el.textContent = bk
    ? 'Last backup: ' +
      relDate(bk) +
      (risk ? ' \u00b7 ' + risk + ' not in a backup' : out ? '' : ' \u00b7 all backed up')
    : risk
      ? 'Not backed up yet (' + nWord(risk, 'guide') + ')'
      : out
        ? 'Not backed up yet'
        : 'All guides are in a backup';
  el.classList.toggle('warn', !!risk);
}
// the Library overlay: from Home's Library card, the Recent strip's Library link, the Library button and the guide's ⋯ menu
var _libPalFirst = false;
function openLibrary(palFirst) {
  _libPalFirst = palFirst === true;
  renderSaved();
  hideToast();
  openDialog(savedOverlay);
}
// the line under the Library's title says what a tap does to what's there (v289)
function libSubText() {
  var g = 0,
    p = 0;
  state.saved.forEach(function (s) {
    if (s.type === 'guide') g++;
    else p++;
  });
  return g && p
    ? 'Tap a palette to load it, or a guide to open it.'
    : g
      ? 'Tap a guide to open it.'
      : p
        ? 'Tap a palette to load it.'
        : 'Your guides and palettes are kept here.';
}
function renderSaved() {
  if (_libEd) libEndRename(true, false);
  renderLibStat();
  renderLibBin();
  if (typeof preRestoreRender === 'function') preRestoreRender();
  var _sub = $('libSub');
  if (_sub) _sub.textContent = libSubText();
  var list = state.saved.slice();
  var q = (libQuery || '').trim().toLowerCase();
  if (q)
    list = list.filter(function (s) {
      if (((s.name || '') + ' ' + (s.type || '')).toLowerCase().indexOf(q) >= 0) return true;
      var ks = s.keys || [];
      for (var _i = 0; _i < ks.length; _i++) {
        var _ix = keyIdx(ks[_i]);
        if (_ix == null) continue;
        var _c = COLORS[_ix];
        if (!_c) continue;
        if ((_c.code + ' ' + _c.brand + ' ' + bTag(_c.brand)).toLowerCase().indexOf(q) >= 0) return true;
      }
      return false;
    });
  if (libSort === 'name')
    list.sort(function (a, b) {
      return (a.name || '').localeCompare(b.name || '');
    });
  else if (libSort === 'markers')
    list.sort(function (a, b) {
      return (b.keys ? b.keys.length : 0) - (a.keys ? a.keys.length : 0);
    });
  else
    list.sort(function (a, b) {
      return (b.ts || 0) - (a.ts || 0);
    });
  // (opened from Palette's ⋯: palettes and draws first, then guides, each in the chosen order)
  if (_libPalFirst)
    list = list
      .filter(function (x) {
        return x.type !== 'guide';
      })
      .concat(
        list.filter(function (x) {
          return x.type === 'guide';
        }),
      );
  savedList.innerHTML = list.length
    ? list
        .map(function (s) {
          return libRowHTML(s, false);
        })
        .join('')
    : q
      ? '<div class="empty">No matches.</div>'
      : '<div class="empty">Nothing yet. A guide saves itself here once it\u2019s built; a palette is kept with <b>Save</b>.</div><div class="emptyhow"><svg class="ic" aria-hidden="true" focusable="false"><use href="#i-library-big"/></svg><button type="button" id="libTrySample" class="btn-soft">Try the sample</button></div>';
  // (v313) with nothing to search or sort, no search box or sort menu
  {
    var _bar = document.querySelector('#savedOverlay .libbar');
    if (_bar) _bar.style.display = state.saved.length ? '' : 'none';
  }
  var _ts = document.getElementById('libTrySample');
  if (_ts)
    _ts.addEventListener('click', function () {
      closeDialog(savedOverlay);
      setMode('sections');
      if (SF.loadSample) SF.loadSample();
    });
  libArtWatch();
  libBackfill();
}
// the delete control: a bin, not a ✕ (a ✕ is a dialog's Close), and rename's pen: from the icon sprite (Lucide)
var LIB_PEN = ic('pencil'),
  LIB_BIN = ic('trash-2');
// how far along a guide is, in one wording everywhere (v288): "5 of 122 coloured" ("5 of 122 sections coloured" where
// there's room: long), "finished", "not started"
function progressText(d, n, long) {
  d = +d || 0;
  n = +n || 0;
  if (!(d > 0)) return 'not started';
  if (n && d >= n) return 'finished';
  return d + ' of ' + n + (long ? ' sections coloured' : ' coloured');
}
// the line under a name, e.g. Guide · 16 markers · 5 of 122 coloured · yesterday (each part kept on one line; v289:
// Home's words for how far and when — "not started", "today", "3 days ago", then the date)
function libMeta(s) {
  var t = s.type === 'draw' ? 'Random draw' : s.type === 'guide' ? 'Guide' : 'Palette',
    cnt = s.keys ? s.keys.length : 0,
    p = s.type === 'guide' ? progressText(s.done, s.n) : '',
    age = s.ts ? Date.now() - s.ts : -1,
    when = age >= 0 && age < 7 * 86400000 ? relDate(s.ts) : evoWhen(s.ts);
  // (an item without a name shows its kind as the name: not twice)
  // (v303: on two lines, what it is and then how far and when, as Home has them, so no tile is left with one word on a
  // line of its own; the dot between the two lines is there for a screen reader, not shown)
  const part = function (a) {
      return a
        .filter(Boolean)
        .map(function (x) {
          return '<span>' + esc(x) + '</span>';
        })
        .join(' \u00b7 ');
    },
    l1 = part([s.name ? t : '', cnt ? cnt + ' marker' + (cnt === 1 ? '' : 's') : '']),
    l2 = part([p, when]);
  return l1 && l2 ? l1 + '<span class="smsep"> \u00b7 </span>' + l2 : l1 || l2;
}
// A Library tile (v288: a grid of pictures): the picture and name open the item; ⋯ has Rename (the name becomes an
// input in place: ed) and Delete (with Undo). A guide shows its page as you've coloured it (drawn when the tile comes
// into view, libArt), a palette or draw its markers as bands.
function libRowHTML(s, ed) {
  var nm = esc(s.name || ''),
    shown = nm || (s.type === 'draw' ? 'Random draw' : s.type === 'guide' ? 'Guide' : 'Palette');
  // (v308: all of a palette's colours, up to its 16; 12 had cut a rainbow's last ones)
  var strip = (s.keys || [])
    .slice(0, 16)
    .map(function (k) {
      var i = keyIdx(k);
      return i != null && COLORS[i] ? '<span style="background:' + COLORS[i].hex + '"></span>' : '';
    })
    .join('');
  var vis =
    s.type === 'guide'
      ? '<span class="spic">' +
        (safeThumb(s.thumb)
          ? '<img class="sthumb" alt="" src="' + esc(safeThumb(s.thumb)) + '">'
          : '<img class="sthumb" alt="" hidden>') +
        '</span>'
      : '<span class="spic"><span class="sstrip">' + strip + '</span></span>';
  var inner =
    vis +
    '<span class="scol">' +
    (ed
      ? '<input class="sname-in" type="text" maxlength="120" autocomplete="off" aria-label="Name" value="' +
        nm +
        '">'
      : // (a spacer floated at the end of its first line, where ⋯ sits; the lines under it use the tile's width, v289)
        '<span class="sname"><span class="snfl" aria-hidden="true"></span>' + shown + '</span>') +
    '<span class="smeta">' +
    libMeta(s) +
    '</span></span>';
  return (
    '<div class="srow stile s' +
    esc(s.type || 'palette') +
    (ed ? ' editing' : '') +
    '" data-id="' +
    esc(s.id) +
    '">' +
    (ed
      ? '<div class="sopen">' + inner + '</div>'
      : '<button type="button" class="sopen">' +
        inner +
        '</button><button type="button" class="smore" aria-haspopup="menu" aria-expanded="false" aria-label="More: ' +
        shown +
        '">' +
        ic('ellipsis') +
        '</button><div class="smenu libmenu" role="menu" aria-label="' +
        shown +
        '" hidden><button type="button" class="sren" role="menuitem" tabindex="-1" aria-label="Rename ' +
        shown +
        '">' +
        LIB_PEN +
        '<span>Rename</span></button>' +
        // (v308) a guide's copy with ticks starting fresh, to try another plan on the same page
        (s.type === 'guide'
          ? '<button type="button" class="sdup" role="menuitem" tabindex="-1" aria-label="Duplicate ' +
            shown +
            '">' +
            ic('copy') +
            '<span>Duplicate</span></button>'
          : '') +
        '<button type="button" class="sdel" role="menuitem" tabindex="-1" aria-label="Delete ' +
        shown +
        '">' +
        LIB_BIN +
        '<span>Delete</span></button></div>') +
    '</div>'
  );
}
// a tile's ⋯ menu: one open at a time; an item closes it (focus back on ⋯ first, so what the item does next decides)
function tileMenuClose(back) {
  var m = savedList.querySelector('.smenu:not([hidden])');
  if (!m) return false;
  var mb = m.parentNode.querySelector('.smore'),
    had = m.contains(document.activeElement);
  m.hidden = true;
  if (mb) mb.setAttribute('aria-expanded', 'false');
  if (mb && (back || had)) mb.focus({ preventScroll: true });
  return true;
}
function tileMenuOpen(mb, focusFirst) {
  var m = mb.parentNode.querySelector('.smenu');
  if (!m) return;
  var was = !m.hidden;
  tileMenuClose(false);
  if (was) return;
  m.hidden = false;
  mb.setAttribute('aria-expanded', 'true');
  m.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  if (focusFirst) {
    var f = m.querySelector('button');
    if (f) f.focus({ preventScroll: true });
  }
}
// The pictures: drawn as each tile comes into view (one guide at a time from its stored sections), as you've coloured
// it (or its plan, not started); the stored thumbnail shows until then.
var _libIO = null,
  _libArtQ = Promise.resolve('');
function libArt(row) {
  var id = row && +row.dataset.id,
    s =
      row &&
      state.saved.find(function (x) {
        return x.id === id;
      }),
    im = row && row.querySelector('img.sthumb');
  if (!s || s.type !== 'guide' || !im) return;
  // (the picture's longer side as shown: a tall page fills the box's height, v303)
  var sp = row.querySelector('.spic'),
    w = Math.min(
      480,
      Math.round(
        (Math.max(row.clientWidth || 160, sp ? sp.clientHeight : 0) *
          Math.min(2, window.devicePixelRatio || 1)) /
          40,
      ) * 40 || 320,
    ),
    ts = String(s.ts || 0);
  // (one at a time: each reads and redraws a whole stored page)
  _libArtQ = _libArtQ
    .then(function () {
      return im.isConnected ? homeArt(s, +s.done > 0 ? 'prog' : 'plan', w) : '';
    })
    .catch(function () {
      return '';
    });
  _libArtQ.then(function (u) {
    if (!u || !im.isConnected || im.dataset.ts === ts + '|' + w) return;
    im.dataset.ts = ts + '|' + w;
    im.src = u;
    im.hidden = false;
  });
}
function libArtWatch() {
  if (_libIO) _libIO.disconnect();
  var rows = savedList.querySelectorAll('.stile.sguide');
  if (typeof IntersectionObserver === 'undefined') {
    rows.forEach(libArt);
    return;
  }
  _libIO = new IntersectionObserver(
    function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        _libIO.unobserve(e.target);
        libArt(e.target);
      });
    },
    { root: savedList.closest('.dcard'), rootMargin: '200px 0px' },
  );
  rows.forEach(function (r) {
    _libIO.observe(r);
  });
}
// Deleting: the row goes at once and a toast offers Undo for 6 seconds. (v318.1) Then it waits in Recently deleted,
// at the foot of the Library, for a week: Put back brings it back as it was; a guide's stored picture and progress (its
// 'guide-<id>' record) are only removed when the week is up. The ids waiting are kept in localStorage with the row
// (without its thumbnail, drawn again from the guide), so they last through reloads and are seen by every tab.
var libPend = null;
const LIBDEL_KEY = 'ms-lib-deleting',
  LIB_KEEP_DAYS = 7;
// each waiting id carries when and in which tab it was deleted ({id,t,tab}; a plain number is from before and counts
// as long ago): a start in another tab leaves one alone while that tab's Undo can still bring it back; a reload of the
// same tab (its Undo is gone) tidies it straight away
const LIB_TAB = (function () {
  try {
    let v = sessionStorage.getItem('ms-tab');
    if (!v) {
      v = Math.random().toString(36).slice(2);
      sessionStorage.setItem('ms-tab', v);
    }
    return v;
  } catch (_) {
    return '';
  }
})();
function libPendList() {
  try {
    const a = JSON.parse(localStorage.getItem(LIBDEL_KEY) || '[]');
    return Array.isArray(a)
      ? a
          .map((x) =>
            typeof x === 'number'
              ? { id: x, t: 0 }
              : { id: x && +x.id, t: (x && +x.t) || 0, tab: x && x.tab, e: (x && cleanSaved(x.e)) || null },
          )
          .filter((x) => Number.isFinite(x.id))
      : [];
  } catch (_) {
    return [];
  }
}
function libPendSet(l) {
  try {
    if (l.length) localStorage.setItem(LIBDEL_KEY, JSON.stringify(l));
    else localStorage.removeItem(LIBDEL_KEY);
  } catch (_) {}
}
function libPendDrop(id) {
  libPendSet(libPendList().filter((x) => x.id !== id));
}
// the id stays in the list until the stored guide is really gone (a delete that fails is tried again at the next
// start), so a deleted guide is never offered back as a lost one (see Lost guides in boot.js)
function libPurge(id) {
  if (state.saved.some((s) => s.id === id)) {
    libPendDrop(id);
    return;
  }
  const x = libPendList().find((y) => y.id === id);
  if (x && x.e && x.e.type !== 'guide') {
    libPendDrop(id);
    return;
  }
  IDB.del('guide-' + id)
    .then(function () {
      libPendDrop(id);
    })
    .catch(function () {});
  // (v314: and its photo of the finished page: guide/24-page-photo.js)
  IDB.del('fin-' + id).catch(function () {});
}
// a guide being put back (the guide's Put back, v285): its stored record mustn't be tidied away behind the save
function libUnpend(id) {
  if (libPend && libPend.entry.id === id) {
    clearTimeout(libPend.t);
    libPend = null;
  }
  libPendDrop(id);
}
// the Undo's time over (or another delete): it waits in Recently deleted now (v318.1: it had gone for good then)
function libFinish() {
  const p = libPend;
  if (!p) return;
  libPend = null;
  clearTimeout(p.t);
  renderLibBin();
}
// Focus moves to the next row's bin (the one before when it was the last; the list when it's empty), and back to the
// row on Undo, so the keyboard never drops to the top of the page.
function libDelete(id) {
  const i = state.saved.findIndex((s) => s.id === id);
  if (i < 0) return;
  libFinish();
  const entry = state.saved[i];
  state.saved.splice(i, 1);
  forgetSaved(id);
  if (
    !keep(function () {
      state.saved.splice(i, 0, entry);
      _savedGone.delete(id);
    })
  )
    return;
  // (v318.1: every kind waits in Recently deleted, its row with it, the thumbnail left out for room)
  const keepRow = Object.assign({}, entry);
  delete keepRow.thumb;
  libPendSet(
    libPendList()
      .filter((x) => x.id !== id)
      .concat([{ id: id, t: Date.now(), tab: LIB_TAB, e: keepRow }]),
  );
  if (entry.type === 'guide' && window.SF && SF.libChanged) SF.libChanged(id, false);
  const p = { entry: entry, i: i };
  p.t = setTimeout(libFinish, 6000);
  libPend = p;
  const rows = [...savedList.querySelectorAll('.srow')],
    at = rows.findIndex((r) => +r.dataset.id === id);
  renderSaved();
  chrome();
  libFocus(at);
  toastAction(
    'Deleted \u201c' +
      (entry.name || (entry.type === 'guide' ? 'Guide' : entry.type === 'draw' ? 'Random draw' : 'Palette')) +
      '\u201d',
    'Undo',
    function () {
      if (libPend !== p) return;
      clearTimeout(p.t);
      libPend = null;
      if (!state.saved.some((s) => s.id === entry.id))
        state.saved.splice(Math.min(p.i, state.saved.length), 0, entry);
      _savedGone.delete(entry.id);
      libPendDrop(entry.id);
      save();
      renderSaved();
      chrome();
      if (entry.type === 'guide' && window.SF && SF.libChanged) SF.libChanged(entry.id, true);
      if (savedOverlay.classList.contains('on')) {
        const b = savedList.querySelector('.srow[data-id="' + entry.id + '"] .smore');
        if (b) b.focus({ preventScroll: true });
      }
    },
    6000,
  );
}
// (v308) Duplicate: a guide's copy, "… (2)", with its plan, zones, pins, frame, photo and thumbnail, its ticks, tones,
// kept shading and dates starting fresh. The open guide's last changes are saved first. Each copy holds its own photo.
function libDuplicate(id) {
  const e = state.saved.find((s) => s.id === id && s.type === 'guide');
  if (!e) return Promise.resolve(null);
  return Promise.resolve(window.SF && SF.flushSave ? SF.flushSave() : null)
    .catch(function () {})
    .then(function () {
      return IDB.get('guide-' + id).catch(function () {
        return null;
      });
    })
    .then(function (pl) {
      const src = state.saved.find((s) => s.id === id && s.type === 'guide') || e;
      if (!pl || typeof pl !== 'object' || typeof pl.lmap !== 'string') {
        toast(
          'Couldn\u2019t duplicate \u201c' +
            (src.name || 'Guide') +
            '\u201d \u2014 its stored copy couldn\u2019t be read.',
          5000,
        );
        return null;
      }
      const p = Object.assign({}, pl);
      delete p.prog;
      delete p.tones;
      delete p.held;
      delete p.dates;
      if (p.out && typeof p.out === 'object') {
        const q = {};
        Object.keys(p.out).forEach(function (l) {
          const x = Object.assign({}, p.out[l]);
          delete x.done;
          delete x.t;
          q[l] = x;
        });
        p.out = q;
      }
      const nm = copyName(src.name || 'Guide');
      return Promise.resolve(
        sfSaveDesign({
          id: _newGuideId(),
          name: nm,
          W: src.W,
          H: src.H,
          keys: src.keys || [],
          n: src.n,
          thumb: src.thumb || '',
          payload: p,
          quiet: true,
        }),
      ).then(function (nid) {
        if (!nid) {
          toast(
            'Couldn\u2019t duplicate \u2014 this browser\u2019s storage is full. Back up, then delete a few guides in the Library.',
            7000,
          );
          return null;
        }
        renderSaved();
        renderRecent();
        chrome();
        // (v318.22 debug: the keyboard on the copy's ⋯, as Delete puts it on the next one's; it was left on the page)
        if (savedOverlay.classList.contains('on'))
          focusKept(true, null, '', 0, savedList.querySelector('.srow[data-id="' + nid + '"] .smore'));
        toastAction('Duplicated as \u201c' + nm + '\u201d, ticks start fresh', 'Open', function () {
          const x = state.saved.find((s) => s.id === nid);
          if (x) loadGuide(x);
        });
        return nid;
      });
    });
}
function libFocus(at) {
  if (!savedOverlay.classList.contains('on')) return;
  const rows = savedList.querySelectorAll('.srow'),
    r = rows[Math.min(Math.max(at, 0), rows.length - 1)],
    b = r && r.querySelector('.smore');
  (b || savedList).focus({ preventScroll: true });
}
// at start: what's waited its week in Recently deleted goes for good (and one from before v318.1, with no row to put
// back, at once, as it did then)
setTimeout(function tidy() {
  libPendList().forEach(function (x) {
    if (!x.e || Date.now() - x.t > LIB_KEEP_DAYS * 864e5 || x.t > Date.now() + 864e5) libPurge(x.id);
  });
  renderLibBin();
}, 1500);
// (v318.1) Recently deleted: what's waiting, newest first, each with Put back; Delete them now ends the wait
function libBinList() {
  return libPendList()
    .filter((x) => x.e && !state.saved.some((s) => s.id === x.id) && !(libPend && libPend.entry.id === x.id))
    .sort((a, b) => b.t - a.t);
}
function renderLibBin() {
  const b = $('libBin');
  if (!b) return;
  const n = libBinList().length;
  b.hidden = !n;
  b.textContent = 'Recently deleted (' + n + ')';
}
function libBinOpen() {
  const ask = window.SF && SF.askBox,
    l = libBinList();
  if (!ask || !l.length) return renderLibBin();
  const kind = (e) => (e.type === 'guide' ? 'guide' : e.type === 'draw' ? 'random draw' : 'palette');
  ask(
    'Recently deleted',
    'Kept on this device for ' +
      LIB_KEEP_DAYS +
      ' days after you delete them, then gone for good. They aren’t in a backup made meanwhile.',
    l
      .map(
        (x) =>
          '<button type="button" data-a="put:' +
          x.id +
          '">Put back “' +
          esc(x.e.name || kind(x.e)) +
          '” <span class="libbinwhen">' +
          esc(kind(x.e) + ', deleted ' + (relDate(x.t) || 'today')) +
          '</span></button>',
      )
      .join('') +
      '<button type="button" data-a="purge">Delete them now</button><button type="button" class="sfghost" data-a="stay">Close</button>',
    false,
  ).then(function (a) {
    if (a === 'purge') {
      libBinList().forEach((x) => libPurge(x.id));
      renderLibBin();
      toast('Deleted for good', 3000);
    } else if (a && a.indexOf('put:') === 0) libPutBack(+a.slice(4));
  });
}
function libPutBack(id) {
  const x = libBinList().find((y) => y.id === id);
  if (!x) return renderLibBin();
  const entry = cleanSaved(x.e);
  if (!entry) return;
  state.saved.unshift(entry);
  _savedGone.delete(id);
  if (
    !keep(function () {
      state.saved.splice(state.saved.indexOf(entry), 1);
    })
  )
    return;
  libPendDrop(id);
  if (entry.type === 'guide' && window.SF && SF.libChanged) SF.libChanged(id, true);
  renderSaved();
  chrome();
  toast('Put back “' + (entry.name || 'it') + '”', 4000);
  const b = savedList.querySelector('.srow[data-id="' + id + '"] .smore');
  if (b && savedOverlay.classList.contains('on')) b.focus({ preventScroll: true });
}
// renaming in place: one edit at a time; _libEd is cleared before the row is redrawn, so the blur that redraw causes is ignored
var _libEd = null;
function libStartRename(id) {
  if (_libEd) libEndRename(true, false);
  var s = state.saved.find(function (x) {
      return x.id === id;
    }),
    row = savedList.querySelector('.srow[data-id="' + id + '"]');
  if (!s || !row) return;
  _libEd = { id: id };
  row.outerHTML = libRowHTML(s, true);
  libArt(savedList.querySelector('.srow[data-id="' + id + '"]'));
  var inp = savedList.querySelector('.srow[data-id="' + id + '"] .sname-in');
  if (inp) {
    inp.focus();
    try {
      inp.select();
    } catch (e) {}
  }
}
// with storage full the old name comes back (and the storage-full message says why)
function libEndRename(take, refocus) {
  var ed = _libEd;
  if (!ed) return;
  _libEd = null;
  var s = state.saved.find(function (x) {
      return x.id === ed.id;
    }),
    row = savedList.querySelector('.srow[data-id="' + ed.id + '"]'),
    inp = row && row.querySelector('.sname-in'),
    changed = false;
  if (take && s && inp) {
    var v = (inp.value || '').trim().slice(0, 120),
      was = s.name;
    if (v && v !== s.name) {
      s.name = v;
      changed = keep(function () {
        s.name = was;
      });
    }
  }
  if (changed) {
    if (s.type === 'guide' && window.SF && SF.renamed) SF.renamed(s.id, s.name);
    else palNameSync();
    renderRecent();
  }
  if (row && s) {
    if (changed && (libSort === 'name' || (libQuery || '').trim())) renderSaved();
    else {
      row.outerHTML = libRowHTML(s, false);
      libArt(savedList.querySelector('.srow[data-id="' + ed.id + '"]'));
    }
  }
  if (refocus) {
    var b = savedList.querySelector('.srow[data-id="' + ed.id + '"] .smore');
    if (b) b.focus();
  }
}
// an open guide saved itself: redraw its row (progress, picture) if the Library is showing, and Home's recent guides;
// only the row's name, line and picture change (the list isn't re-sorted under the user, focus stays put), and a row being renamed is left alone
function libRowChanged(id) {
  renderRecent();
  renderLibStat();
  if (!savedOverlay.classList.contains('on') || (_libEd && _libEd.id === id)) return;
  var s = state.saved.find(function (x) {
      return x.id === id;
    }),
    row = savedList.querySelector('.srow[data-id="' + id + '"]');
  if (!s || !row) return;
  var m = row.querySelector('.smeta'),
    nm = row.querySelector('.sname'),
    im = row.querySelector('img.sthumb'),
    t = safeThumb(s.thumb);
  if (m) m.innerHTML = libMeta(s);
  // (keeping the spacer that holds the first line clear of ⋯, v299)
  if (nm && s.name) nm.innerHTML = '<span class="snfl" aria-hidden="true"></span>' + esc(s.name);
  if (im && t && !im.dataset.ts) {
    im.src = t;
    im.hidden = false;
  }
  libArt(row);
}
// guides saved before the Library showed progress get their coloured count from the stored guide, one at a time
var _doneTried = {},
  _doneBusy = false;
function libBackfill() {
  if (_doneBusy) return;
  var g = state.saved.find(function (s) {
    return s.type === 'guide' && typeof s.done !== 'number' && !_doneTried[s.id];
  });
  if (!g) return;
  _doneTried[g.id] = 1;
  _doneBusy = true;
  var id = g.id;
  IDB.get('guide-' + id)
    .then(function (pl) {
      var s = state.saved.find(function (x) {
        return x.id === id;
      });
      if (!pl || !s || typeof s.done === 'number') return;
      var n = +s.n || (pl.assign && typeof pl.assign === 'object' ? Object.keys(pl.assign).length : 0),
        d = Array.isArray(pl.prog) ? pl.prog.length : 0;
      if (!s.n && n) s.n = n;
      s.done = n ? Math.min(d, n) : d;
      save(true);
      var m = savedList.querySelector('.srow[data-id="' + id + '"] .smeta');
      if (m) m.innerHTML = libMeta(s);
    })
    .catch(function () {})
    .then(function () {
      _doneBusy = false;
      libBackfill();
    });
}
// (v308) A saved palette opens as its own scheme, saved with it, as a new step in the palette history (Undo goes back
// to the one that was there); Custom's, a photo's (its photo isn't kept) and one saved before v308 open as Custom
// picks. Custom picks in progress that it would replace are asked about first (they had gone without a word).
function loadSaved(entry) {
  const idxs = entry.keys.map(keyIdx).filter((i) => i != null);
  if (!idxs.length) return;
  const h = typeof entry.h === 'string' && HARM[entry.h] ? entry.h : 'custom',
    gen = h !== 'custom' && h !== 'photo',
    n = Math.max(2, Math.min(16, idxs.length)),
    picks = (state.customPal || []).filter((x) => x != null);
  if (!gen && picks.length && picks.join() !== idxs.slice(0, n).join() && window.SF && SF.askBox) {
    SF.askBox(
      'Replace your Custom picks?',
      'Opening \u201c' +
        (entry.name || 'this palette') +
        '\u201d replaces the ' +
        (picks.length === 1 ? 'marker' : picks.length + ' markers') +
        ' you\u2019ve picked in Custom.',
      '<button type="button" class="sfghost" data-a="stay">Cancel</button><button type="button" class="btn-primary" data-a="go">Replace</button>',
    ).then(function (a) {
      if (a === 'go') loadSavedGo(idxs, h, n);
    });
    return;
  }
  loadSavedGo(idxs, h, n);
}
function loadSavedGo(idxs, h, n) {
  closeDialog(savedOverlay);
  disarm();
  unownDisarm();
  state.mode = 'palette';
  if (h !== 'custom' && h !== 'photo') {
    state.harmony = h;
    const R = HARM_RANGE[h] || [2, 6];
    if (idxs.length >= R[0] && idxs.length <= R[1] && (h !== 'rainbow' || sizeOffered(h, idxs.length)))
      state.palSize = idxs.length;
    else
      state.palSize = Math.max(
        R[0],
        Math.min(R[1], h === 'rainbow' ? rainbowSnap(state.palSize) : state.palSize),
      );
    palPvOff = true;
    palPush(idxs.slice(), 24);
    state.locked = state.locked.filter((i) => idxs.includes(i));
  } else {
    state.harmony = 'custom';
    state.palSize = n;
    state.customPal = idxs.slice(0, n);
  }
  save();
  fullRender();
}
function doSaveDraw() {
  if (!state.drawn.length) return;
  const st = {
    brands: [...state.brands],
    tones: [...state.tones],
    sats: [...state.sats],
    excluded: [...state.excluded],
    pool: state.pool ? state.pool.map(mkey) : null,
  };
  const entry = {
    id: Date.now(),
    type: 'draw',
    name: ('Random draw \u00b7 ' + shortDate()).trim(),
    keys: state.drawn.map(mkey),
    ts: Date.now(),
    st: st,
  };
  state.saved.unshift(entry);
  saveNew(entry);
}
function loadDraw(entry) {
  closeDialog(savedOverlay);
  disarm();
  unownDisarm();
  state.mode = 'random';
  const st = entry.st && typeof entry.st === 'object' ? entry.st : {},
    // (only what the app knows: a draw from an edited backup could filter out every marker, or not open at all, v299)
    known = (a, ok) => (Array.isArray(a) ? a.filter((x) => typeof x === 'string' && ok(x)) : null),
    brands = known(st.brands, (x) => BRAND_DEFS.some((d) => d.k === x)),
    tones = known(st.tones, (x) => TONE_DEFS.some((d) => d.k === x)),
    sats = known(st.sats, (x) => SAT_DEFS.some((d) => d.k === x)),
    exc = known(st.excluded, () => true),
    pool = known(st.pool, () => true);
  if (brands && brands.length) state.brands = new Set(brands);
  if (tones) state.tones = new Set(tones);
  if (sats) state.sats = new Set(sats);
  if (exc) state.excluded = new Set(exc);
  setPool(pool ? pool.map(keyIdx).filter((i) => i != null) : null);
  state.drawn = (Array.isArray(entry.keys) ? entry.keys : []).map(keyIdx).filter((i) => i != null);
  save();
  fullRender();
}
(function () {
  const b = $('libBin');
  if (b) b.addEventListener('click', libBinOpen);
})();
