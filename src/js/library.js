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
function doSave() {
  const idxs = currentPaletteIdxs();
  if (!idxs.length) return;
  const entry = {
    id: Date.now(),
    type: 'palette',
    name: nameForSave(idxs),
    keys: idxs.map(mkey),
    ts: Date.now(),
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
  return { hex: pick.c.hex, code: pick.c.code, name: pick.c.name || '' };
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
function homeStarted(g) {
  return (+g.done > 0 || +g.tn > 0) && !(+g.n > 0 && +g.done >= +g.n);
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
    ar = Math.max(0.2, Math.min(5, W / H));
  el.innerHTML =
    '<div class="hhcard" style="background-image:' +
    heroGlow(hx) +
    '"><button type="button" class="hhpic" data-hero="open" aria-label="Open ' +
    nm +
    '"><span class="hhbox" style="--ar:' +
    ar.toFixed(4) +
    '"></span></button><div class="hhbody"><span class="hheb"><i class="hhdone" aria-hidden="true"></i><span class="hhwhen">Finished</span></span><h2 class="hhname">' +
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
      ]).then(function (res) {
        if (!same()) return;
        if (!res[0]) {
          // (its picture can't be read: no latest piece, and Home as it would be without it)
          _heroBad[g.id + '|' + (g.ts || 0)] = 1;
          renderRecent();
          return;
        }
        var b = el.querySelector('.hhbox');
        if (b) b.innerHTML = '<img alt="" src="' + res[0] + '"' + (reduce ? '' : ' class="hhfade"') + '>';
        var e = res[1] && res[1].dates && +res[1].dates.e,
          wh = el.querySelector('.hhwhen');
        if (e && wh) wh.textContent = 'Finished · ' + heroDate(e);
      });
    }, 0);
  });
  el.onclick = function (e) {
    var b = e.target.closest('[data-hero]');
    if (!b || !window.SF) return;
    var what = b.getAttribute('data-hero');
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
          '<div class="hcbody"><span class="hceb">New colouring guide</span><h2 class="hcname">Turn a photo of a colouring page into a <span class="hcnw">marker-by-number</span> guide</h2><span class="hcmeta hcown"></span><button type="button" class="btn-primary hcgo" data-start="photo">Choose a photo</button><button type="button" class="homelink hcalt" data-start="sample">or try the sample</button></div></div>';
      }
      var own = cel.querySelector('.hcown'),
        nOwn = state.owned.size;
      if (own)
        own.textContent =
          (nOwn
            ? 'Built from the ' + nOwn + ' marker' + (nOwn === 1 ? '' : 's') + ' you own. '
            : 'Built from the markers you own: add yours in Markers. ') +
          'Lay the page flat in even light, and get all of it in the frame.';
      cel.style.display = '';
    } else if (
      cel.getAttribute('data-cid') !== String(cont.id) ||
      cel.getAttribute('data-ts') !== String(cont.ts) ||
      cel.getAttribute('data-nm') !== homeName(cont)
    ) {
      var nm = esc(homeName(cont)),
        n = +cont.n || 0,
        d = +cont.done || 0,
        pc = n ? Math.max(1, Math.min(100, Math.round((d * 100) / n))) : 0;
      cel.setAttribute('data-cid', String(cont.id));
      cel.setAttribute('data-ts', String(cont.ts));
      cel.setAttribute('data-nm', homeName(cont));
      cel.innerHTML =
        '<button type="button" class="hccard" data-gid="' +
        esc(cont.id) +
        '" data-cont="1" aria-label="Continue colouring ' +
        nm +
        ': ' +
        progressText(d, n, true) +
        '"><span class="hcpic"><span class="hcph"></span></span><span class="hcbody"><span class="hceb" aria-hidden="true">Continue colouring</span><span class="hcname" aria-hidden="true">' +
        nm +
        '</span><span class="hcbar" aria-hidden="true"><i style="width:' +
        pc +
        '%"></i></span><span class="hcmeta" aria-hidden="true">' +
        progressText(d, n) +
        '</span><span class="btn-primary hcgo" aria-hidden="true">Continue</span></span></button>';
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
            if (cb)
              cb.setAttribute(
                'aria-label',
                cb.getAttribute('aria-label') + ', next ' + nx.code + (nx.name ? ' ' + nx.name : ''),
              );
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
  var nb = document.getElementById('homeNew');
  // (beside the Continue card, a new guide is the second choice)
  if (nb) nb.classList.toggle('homenew2', !!cont);
  // (v289: on an iPad, once Your guides shows with its All guides link, the Library card would be a third way there)
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
        if (!save(true)) g.thumb = '';
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
        : 'Palettes and guides you save are kept here.';
}
function renderSaved() {
  if (_libEd) libEndRename(true, false);
  renderLibStat();
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
      : '<div class="empty">No saved palettes or guides yet.</div>';
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
  var strip = (s.keys || [])
    .slice(0, 12)
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
        '<span>Rename</span></button><button type="button" class="sdel" role="menuitem" tabindex="-1" aria-label="Delete ' +
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
// Deleting: the row goes at once and a toast offers Undo for 6 seconds. A guide's stored picture and progress (its
// 'guide-<id>' record) are only removed when that time is up or the next delete comes; the ids still waiting are kept
// in localStorage, so after a reload in between the next start tidies them away (unless the guide is back in the list).
var libPend = null;
const LIBDEL_KEY = 'ms-lib-deleting';
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
              : { id: x && +x.id, t: (x && +x.t) || 0, tab: x && x.tab },
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
  IDB.del('guide-' + id)
    .then(function () {
      libPendDrop(id);
    })
    .catch(function () {});
}
// a guide being put back (the guide's Put back, v285): its stored record mustn't be tidied away behind the save
function libUnpend(id) {
  if (libPend && libPend.entry.id === id) {
    clearTimeout(libPend.t);
    libPend = null;
  }
  libPendDrop(id);
}
function libFinish() {
  const p = libPend;
  if (!p) return;
  libPend = null;
  clearTimeout(p.t);
  if (p.entry.type === 'guide') libPurge(p.entry.id);
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
  if (entry.type === 'guide') {
    libPendSet(
      libPendList()
        .filter((x) => x.id !== id)
        .concat([{ id: id, t: Date.now(), tab: LIB_TAB }]),
    );
    if (window.SF && SF.libChanged) SF.libChanged(id, false);
  }
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
      esc(
        entry.name || (entry.type === 'guide' ? 'Guide' : entry.type === 'draw' ? 'Random draw' : 'Palette'),
      ) +
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
function libFocus(at) {
  if (!savedOverlay.classList.contains('on')) return;
  const rows = savedList.querySelectorAll('.srow'),
    r = rows[Math.min(Math.max(at, 0), rows.length - 1)],
    b = r && r.querySelector('.smore');
  (b || savedList).focus({ preventScroll: true });
}
setTimeout(function tidy() {
  const mine = (x) => !!LIB_TAB && x.tab === LIB_TAB;
  libPendList().forEach(function (x) {
    if ((!libPend || libPend.entry.id !== x.id) && (mine(x) || Date.now() - x.t > 7000)) libPurge(x.id);
  });
  if (
    libPendList().some(function (x) {
      return !mine(x) && Date.now() - x.t <= 7000;
    })
  )
    setTimeout(tidy, 7500);
}, 1500);
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
function loadSaved(entry) {
  const idxs = entry.keys.map(keyIdx).filter((i) => i != null);
  if (!idxs.length) return;
  closeDialog(savedOverlay);
  disarm();
  unownDisarm();
  state.harmony = 'custom';
  state.mode = 'palette';
  const n = Math.max(2, Math.min(16, idxs.length));
  state.palSize = n;
  state.customPal = idxs.slice(0, n);
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
