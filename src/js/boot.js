mHome.addEventListener('click', () => setMode('home'));
var _rbk = document.getElementById('rndBack');
if (_rbk)
  _rbk.addEventListener('click', function () {
    setMode('collection');
  });
var _hn = document.getElementById('homeNew');
if (_hn)
  _hn.addEventListener('click', function () {
    // (v288) with guides already made (or one open), straight to the photo picker; Home stays until a photo is chosen. The first
    // time, the Guide screen's card (choose a photo or try the sample, what a guide is).
    // (v289) section edits not built: the Guide screen first, with its question (Build again, Discard edits, Cancel),
    // rather than after a photo is chosen, when Cancel would throw the photo away. Discard edits then opens the photo
    // picker within its tap (iOS opens it only from a tap); Build again builds, and New colouring guide is there after.
    if (window.SF && SF.secEdPending && SF.secEdPending() && SF.edToPlan) {
      setMode('sections');
      SF.edToPlan(true);
      return;
    }
    var some = state.saved.some(function (s) {
      return s.type === 'guide';
    });
    if ((some || (window.SF && SF.hasGuide && SF.hasGuide())) && window.SF && SF.pickPhotoHome) {
      SF.pickPhotoHome(function () {
        setMode('sections');
      });
      return;
    }
    setMode('sections');
    if (window.SF && SF.showHome && !SF.hasGuide()) SF.showHome();
  });
var _hv = document.getElementById('homeView');
if (_hv)
  _hv.addEventListener('click', function (e) {
    if (e.target.closest('#homePalNote [data-clearpal]')) {
      if (window.SF && SF.clearPal) SF.clearPal();
      return;
    }
    var c = e.target.closest('.homecard');
    if (!c) return;
    if (c.id === 'homeLibCard') {
      openLibrary();
    } else if (c.id === 'homeSetup') {
      state.collView = 'unowned';
      setMode('collection');
    } else if (c.dataset.go) {
      setMode(c.dataset.go);
    }
  });
{
  const _bn = $('backupNudge');
  if (_bn)
    _bn.addEventListener('click', function (e) {
      const b = e.target.closest('[data-bk]');
      if (!b) return;
      if (b.dataset.bk === 'go') backupAll('bkGo');
      else {
        // (with the once-only reminder after a first coloured section, v304)
        backupLater();
        homeCardGone(_bn);
      }
    });
}
var _hi = document.getElementById('homeImport'),
  _hif = document.getElementById('homeImpFile');
if (_hi && _hif) {
  _hi.addEventListener('click', function () {
    _hif.click();
  });
  _hif.addEventListener('change', function (e) {
    var f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (f) importPicked(f, _hi);
  });
}
mSections.addEventListener('click', () => setMode('sections'));
SF.setCollection(sfCollection());
SF.configure({
  renderFilters: sfRenderFilters,
  saveDesign: sfSaveDesign,
  saveDesignNow: sfSaveDesignNow,
  loadDesign: sfLoadDesign,
  listDesigns: sfListDesigns,
  deleteDesign: sfDeleteDesign,
  refreshSaved: function () {
    renderSaved();
    renderRecent();
  },
  savedChanged: libRowChanged,
  openLibrary: openLibrary,
  listPalettes: function () {
    return state.saved.filter(function (s) {
      return s.type === 'palette';
    });
  },
  // opts goes to the Palette screen's generator as it is ({ mood }: the guide's Mood, a MOOD_KEYS key)
  // (from the guide's own markers: yours that aren't dry, or any with none, in the filters; never the Palette
  // screen's selection, which can hold markers you don't own and outlives the Finder hand-off it came from, v304)
  genPalette: function (n, harm, opts) {
    const sel = state.pool;
    state.pool = null;
    try {
      return (genPalette(n, harm, opts) || []).map(mkey);
    } finally {
      state.pool = sel;
    }
  },
  isDemo: function () {
    return state.owned.size === 0;
  },
  // Brands I'd buy (v304): null for automatic, else the brands ticked
  buyBrands: function () {
    return state.buyBrands ? state.buyBrands.slice() : null;
  },
  goMarkers: function () {
    goMarkers();
  },
  markerInfo: function (k) {
    const i = keyIdx(k);
    return i != null ? { lab: hexToLab(COLORS[i].hex), code: COLORS[i].code, hex: COLORS[i].hex } : null;
  },
  savePalette: function (keys, name) {
    const entry = {
      id: Date.now(),
      type: 'palette',
      name:
        name ||
        paletteName(
          keys.map(keyIdx).filter(function (i) {
            return i != null;
          }),
        ),
      keys: keys,
      ts: Date.now(),
    };
    state.saved.unshift(entry);
    if (!save()) {
      state.saved.shift();
      return null;
    }
    return entry.id;
  },
});

// a screen that can't be drawn mustn't stop the rest of the app starting: the error still reaches the error net
try {
  fullRender();
} catch (e) {
  setTimeout(function () {
    throw e;
  }, 0);
}
document.addEventListener('keydown', function (e) {
  if (
    (e.key === 'Enter' || e.key === ' ') &&
    e.target &&
    e.target.getAttribute &&
    e.target.getAttribute('role') === 'button' &&
    !/^(BUTTON|INPUT|SELECT|TEXTAREA|A)$/.test(e.target.tagName)
  ) {
    e.preventDefault();
    e.target.click();
  }
});
(function () {
  var ov = $('welcome');
  if (!ov) return;
  var done = false;
  try {
    done = !!(localStorage.getItem('ms-setup-tip') || localStorage.getItem('ms-onboarded'));
  } catch (e) {
    done = false;
  }
  function markDone() {
    try {
      localStorage.setItem('ms-setup-tip', '1');
      localStorage.setItem('ms-onboarded', '1');
    } catch (e) {}
  }
  if (!done && (state.owned.size || state.saved.length)) {
    done = true;
    markDone();
  }
  var sets = $('wcSets'),
    add = $('wcAdd');
  // (v309.2) storage blocked: the page's banner is under the welcome, so it's said here too, before anything is added
  if (typeof STORE_BLOCKED !== 'undefined' && STORE_BLOCKED) {
    var sub0 = ov.querySelector('#wcStep0 .wcsub');
    if (sub0)
      sub0.insertAdjacentHTML(
        'afterend',
        '<div class="msblocked wcblocked" role="alert"><b>This browser isn\u2019t letting Marker Studio save \u2014 nothing will be kept.</b> <span>Allow this site to store data (or leave private browsing), then reload.</span></div>',
      );
  }
  sets.innerHTML = presetListHTML();
  // (v306) the first step's picture (v309: on the three ways in): the sample page, its colour flooding down it from the bell, held, then back to the
  // page; three times (11 s), then it stays coloured (07-home-onboarding.css: all of it CSS, nothing on a timer). On a
  // portrait screen it lies on its side above the heading; on a landscape iPad it stands beside the list. Not on a short
  // screen (under 761 px), and only built for a first run. WC_ANIM 'fade' cross-fades instead: less to draw each frame,
  // if the flood stutters on an iPad.
  var WC_ANIM = 'flood';
  if (!done && window.SF && SF.samplePics) {
    var sp = SF.samplePics(),
      pic = document.createElement('div'),
      pin = document.createElement('div'),
      pfl = document.createElement('div'),
      pim = new Image();
    pic.className = 'wcpic';
    pic.setAttribute('aria-hidden', 'true');
    pin.className = 'wcpicin';
    pfl.className = 'wcfl ' + WC_ANIM;
    pim.alt = '';
    pim.src = sp.plain;
    pfl.appendChild(pim);
    pin.appendChild(sp.line);
    pin.appendChild(pfl);
    pic.appendChild(pin);
    $('wcStep0').insertBefore(pic, $('wcStep0').firstChild);
    ov.querySelector('.wcard').classList.add('haspic');
    // (not blurring the page behind while it moves: Safari's engine blurred it afresh every frame, ~1 s a frame
    // headless, whichever way the picture moved)
    ov.classList.add('wcplain');
  }
  function upd() {
    var ch = sets.querySelectorAll('input:checked'),
      ks = new Set();
    ch.forEach(function (x) {
      presetMkeys(MARKER_SETS[+x.dataset.i]).forEach(function (k) {
        ks.add(k);
      });
    });
    add.disabled = !ch.length;
    // (v309.1: the colours; a set's blender comes with it, uncounted)
    var n = setKeys([...ks]).length;
    add.textContent = ch.length ? 'Add ' + n + ' marker' + (n === 1 ? '' : 's') : 'Tick a set above';
  }
  sets.addEventListener('change', upd);
  // Ohuhu / Copic: jump the list to that brand's sets (Copic's are below the fold otherwise), and show which is in view
  var wb = document.querySelector('.wcbrands');
  if (wb) {
    wb.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      var h = [].find.call(sets.querySelectorAll('.presetbrand'), function (x) {
        return x.textContent === b.dataset.b;
      });
      if (h) sets.scrollTop = h.offsetTop - sets.offsetTop;
    });
    sets.addEventListener('scroll', function () {
      var cur = 'Ohuhu';
      sets.querySelectorAll('.presetbrand').forEach(function (x) {
        if (x.offsetTop - sets.offsetTop <= sets.scrollTop + 8) cur = x.textContent;
      });
      wb.querySelectorAll('button').forEach(function (b) {
        b.classList.toggle('on', b.dataset.b === cur);
      });
    });
  }
  // (v306) "You're all set": up to 28 of the markers just added (or, skipped, of the whole range) fanned out like
  // swatches, in hue order. Open as it stands: the opening is only a short animation onto that (none with reduced motion)
  function fan(keys) {
    var ix = [];
    keys.forEach(function (k) {
      var i = keyIdx(k);
      if (i != null && HS[i].c >= 0.12) ix.push(i);
    });
    if (ix.length < 6)
      keys.forEach(function (k) {
        var i = keyIdx(k);
        if (i != null && HS[i].c < 0.12) ix.push(i);
      });
    ix.sort(function (a, b) {
      return HS[a].h - HS[b].h || HS[b].l - HS[a].l;
    });
    var n = Math.min(28, ix.length),
      h = '';
    for (var j = 0; j < n; j++) {
      var i = ix[n === 1 ? 0 : Math.round((j * (ix.length - 1)) / (n - 1))];
      h +=
        '<i style="--a:' +
        (n === 1 ? 0 : Math.round(-78 + (156 * j) / (n - 1))) +
        'deg;background:' +
        COLORS[i].hex +
        '"></i>';
    }
    var f = $('wcFan');
    if (!f) {
      f = document.createElement('div');
      f.id = 'wcFan';
      f.className = 'wcfan';
      f.setAttribute('aria-hidden', 'true');
      $('wcStep2').insertBefore(f, $('wcStep2').firstChild);
    }
    f.innerHTML = h;
  }
  // (v309) The steps: 0, three ways in (I have a set, one by one, not sure which); 1, the set list; Find, brand and
  // about how many, then Scan reads a few caps over the welcome; Res, the set they fit; One, the ways to add markers
  // one by one (Scan, the colour chart, typing), each over the welcome; 2, what was added, and anything else (extra
  // markers, another set), or what Skip gives. Back (and Escape, a tap on the backdrop) goes to the step before.
  var trail = [],
    cur = 'wcStep0';
  ov.querySelector('.wcard').dataset.step = cur;
  // (v309.1: each step in the trail with what led on from it — the button, else what had the keyboard — so Back puts
  // the keyboard back there, wherever the step was reached from; Safari doesn't focus a button that's tapped)
  function show(id, back, from) {
    if (id === cur) return;
    if (!back) trail.push({ id: cur, el: from || document.activeElement });
    $(cur).style.display = 'none';
    $(id).style.display = '';
    cur = id;
    ov.querySelector('.wcard').dataset.step = id;
    // (the picture's flood stops being drawn once its step is left: the page behind blurs as other dialogs do)
    if (id !== 'wcStep0') ov.classList.remove('wcplain');
    var sc = $(id).querySelector('.wcscroll');
    if (sc) sc.scrollTop = 0;
    $(id).scrollTop = 0;
  }
  function back() {
    if (!trail.length) {
      // (v311: Markers' Add markers sheet: Back, Escape or the backdrop from where it opened closes it)
      if (mk) mkClose();
      return mk;
    }
    var t = trail.pop();
    show(t.id, true);
    // (the keyboard back on what led to the step just left, else the step's heading or its first button)
    var step = $(cur),
      ok = function (el) {
        return !!el && step.contains(el) && el.getClientRects().length > 0;
      },
      el = [
        t.el,
        step.querySelector('.wctitle[tabindex]'),
        step.querySelector('button:not([disabled])'),
      ].find(ok);
    if (el) el.focus({ preventScroll: true });
    return true;
  }
  ov.addEventListener('click', function (e) {
    if (e.target === ov) back();
    else if (e.target.closest && e.target.closest('.wcback')) back();
  });
  // (v306) the fan of markers on step 2
  function step2(msg, title, keys, more) {
    if (keys) fan(keys);
    $('wcT2').textContent = title || 'You’re all set';
    $('wcDone').textContent = msg;
    $('wcMore').style.display = more ? '' : 'none';
    // (v309.2: Back only after "I'll do this later", below)
    $('wcBack2').style.display = 'none';
    $('wcSample').textContent = more ? 'That’s all: try the sample' : 'Try the sample';
    trail = [];
    show('wcStep2', true);
    var b = $('wcSample');
    if (b) b.focus();
  }
  function close() {
    closeDialog(ov);
    markDone();
  }
  // a list of set names: "Honolulu 120", "Honolulu 120 and 36 Skin Tones", "3 sets"
  function setNames(ns) {
    return ns.length === 1 ? ns[0] : ns.length === 2 ? ns[0] + ' and ' + ns[1] : ns.length + ' sets';
  }
  // markers added: step 2 says how many, and asks if there's anything else
  // (v309.1: none new, a set or caps already yours, says so, not "0 more markers added")
  function added(n, names, del) {
    var all = state.owned.size,
      // (the first markers: all the colours owned are these; a set's blender aside)
      first = setKeys([...state.owned]).length === n;
    // (v309.1: added on "Anything else?" itself (Scan's toast Open): what it said, for Undo to put back)
    snap =
      cur === 'wcStep2'
        ? { id: cur, t2: $('wcT2').textContent, msg: $('wcDone').textContent, was: snap }
        : { id: cur, trail: trail.slice() };
    // (v309.2: the Colorless Blender a set brought is said, so Home's count, which includes it, adds up)
    var bl = names && ownBlender;
    step2(
      (names
        ? bl && !n
          ? setNames(names) +
            (names.length === 1 ? ' was' : ' were') +
            ' already in your collection; its Colorless Blender is now too.'
          : bl && names.length === 1
            ? names[0] + ' and its Colorless Blender are in your collection.'
            : setNames(names) +
              (names.length === 1 ? (n ? ' is' : ' was already') : n ? ' are' : ' were already') +
              ' in your collection' +
              (bl ? ', with a Colorless Blender.' : '.')
        : n || del
          ? all + ' marker' + (all === 1 ? ' is' : 's are') + ' in your collection.'
          : 'They were already in your collection.') + ' Anything else?',
      // (v309.1: the chart can untick too)
      n
        ? n +
            (first ? '' : ' more') +
            ' marker' +
            (n === 1 ? '' : 's') +
            ' added' +
            (del ? ', ' + del + ' removed' : '')
        : del
          ? del + ' marker' + (del === 1 ? '' : 's') + ' removed'
          : bl
            ? 'Colorless Blender added'
            : 'Nothing new to add',
      [...state.owned],
      true,
    );
  }
  // add markers (a set, a set found, the caps read) with Undo through keep; how many were new
  // (v309.1: the colours new to the collection are counted, a set's blender not; and the toast's Undo, as Markers' Add
  // a set has, takes them back out and the welcome back to where they were added from)
  // (v309.2: as Markers' Add a set: what's added comes off To buy and loses a Running low or Dry mark; Undo gives
  // both back. And whether an Ohuhu set's Colorless Blender came with it, ownBlender, for step 2 to say so)
  var ownBlender = false,
    ownFresh = 0;
  function own(keys) {
    var before = new Set(state.owned),
      wishWas = state.wish.slice(),
      fresh = [];
    keys.forEach(function (k) {
      if (!state.owned.has(k) && fresh.indexOf(k) < 0) fresh.push(k);
      state.owned.add(k);
    });
    var ink = inkAddedOff(fresh),
      off = wishOwnedOff(fresh);
    if (
      !keep(function () {
        state.owned = before;
        state.wish = wishWas;
        inkPutBack(ink);
      })
    )
      return -1;
    fullRender();
    if (typeof presetRelist === 'function') presetRelist();
    if (off.length || Object.keys(ink).length) wishChanged();
    ownBlender = fresh.indexOf('Ohuhu|0') >= 0;
    ownFresh = fresh.length;
    var n = setKeys(fresh).length;
    // (v311: the Colorless Blender a set brought, said as Markers' Add a set says it, v310.1)
    if (fresh.length)
      toastAction(addedManyLine(n || fresh.length, off.length, ownBlender && n > 0), 'Undo', function () {
        fresh.forEach(function (k) {
          state.owned.delete(k);
        });
        inkPutBack(ink);
        wishPutBack(off);
        if (off.length || Object.keys(ink).length) wishChanged();
        save();
        fullRender();
        if (typeof presetRelist === 'function') presetRelist();
        sets.innerHTML = presetListHTML();
        upd();
        undoneBack();
      });
    return n;
  }
  // where the markers were added from (the step, and the steps before it), for the toast's Undo
  var snap = null;
  function undoneBack() {
    if (!snap) return;
    if (snap.id === 'wcStep2') {
      // (added on "Anything else?" itself: it says again what it said before, wherever the welcome is now)
      $('wcT2').textContent = snap.t2;
      $('wcDone').textContent = snap.msg;
      fan([...state.owned]);
      snap = snap.was;
      if (cur !== 'wcStep2') return;
    } else if (cur === 'wcStep2') {
      trail = snap.trail;
      show(snap.id, true);
    } else {
      // (v309.1: the welcome had gone on from "N markers added" (another set, extra markers) before the toast's Undo:
      // it stays where it is, but Back no longer leads to that step, which would still say they were added)
      var at = trail.findIndex(function (t) {
        return t.id === 'wcStep2';
      });
      if (at < 0) return;
      trail = snap.trail.concat(trail.slice(at + 1));
    }
    // (the toast's Undo has gone: the keyboard to the step's heading)
    var h = $(cur).querySelector('.wctitle[tabindex]');
    if (h) h.focus({ preventScroll: true });
  }
  $('wcHaveSet').addEventListener('click', function () {
    show('wcStep1', false, this);
    $('wcT1').focus({ preventScroll: true });
  });
  add.addEventListener('click', function () {
    var keys = [],
      names = [];
    sets.querySelectorAll('input:checked').forEach(function (x) {
      var p = MARKER_SETS[+x.dataset.i];
      names.push(p.n);
      keys = keys.concat(presetMkeys(p));
    });
    var n = own(keys);
    if (n < 0) return;
    sets.querySelectorAll('input:checked').forEach(function (x) {
      x.checked = false;
    });
    upd();
    if (mk) mkAdded(names);
    else added(n, names);
  });
  $('wcSkip').addEventListener('click', function () {
    step2(
      'No problem — add your markers any time from Markers. Until then, guides use the full Ohuhu + Copic range so you can try things out.',
      'Explore with the full range',
      COLORS.map(function (c, i) {
        return mkey(i);
      }),
      false,
    );
    // (v309.2) Back to the three ways in: a tap on "later" by mistake had no way back, and "I'm not sure which set"
    // is only here
    trail = [{ id: 'wcStep0', el: $('wcSkip') }];
    $('wcBack2').style.display = '';
  });
  // --- "I'm not sure which set": the brand, about how many, then Scan reads a few caps (findSets, events.js) ---
  var fBrand = 'Ohuhu',
    fBucket = -1,
    fKeys = [],
    fRes = [],
    fAt = 0;
  $('wcFCount').innerHTML = FIND_BUCKETS.map(function (b, i) {
    return '<button type="button" data-n="' + i + '" aria-pressed="false">' + b.t + '</button>';
  }).join('');
  function press(group, el) {
    group.querySelectorAll('button').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b === el));
    });
  }
  function toFind() {
    show('wcStepFind', false, this);
    $('wcTF').focus({ preventScroll: true });
  }
  $('wcNotSure').addEventListener('click', toFind);
  $('wcToFind').addEventListener('click', toFind);
  $('wcFBrand').addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    fBrand = b.dataset.b;
    press($('wcFBrand'), b);
  });
  $('wcFCount').addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    fBucket = +b.dataset.n;
    press($('wcFCount'), b);
    $('wcFindNext').disabled = false;
  });
  $('wcFindNext').addEventListener('click', function () {
    if (fBucket < 0 || typeof openScan !== 'function') return;
    openScan({
      find: {
        brand: fBrand,
        bucket: fBucket,
        done: function (keys) {
          // (in the order read: Scan's list has the latest first)
          fKeys = keys.slice().reverse();
          fRes = findSets(fBrand, fBucket, keys);
          fAt = 0;
          result();
          show('wcStepRes', false, $('wcFindNext'));
          var y = $('wcFindYes');
          if (y) y.focus({ preventScroll: true });
        },
      },
    });
  });
  function codes(keys) {
    return keys
      .map(function (k) {
        return k.split('|')[1];
      })
      .join(', ');
  }
  // the set found (fRes[fAt]), its colours in a strip, and which caps it has
  function result() {
    var list = findList(fRes),
      r = list[fAt],
      box = $('wcRes'),
      yes = $('wcFindYes'),
      other = $('wcFindOther');
    if (!r) {
      $('wcTR').textContent = 'No set found';
      box.innerHTML =
        '<div class="wcsub">None of the ' +
        esc(fBrand) +
        ' sets has ' +
        (fKeys.length === 1 ? 'that cap' : 'these caps') +
        ': ' +
        esc(codes(fKeys)) +
        '.</div>';
      yes.textContent =
        'Add the ' + (fKeys.length === 1 ? 'marker' : fKeys.length + ' markers') + ' you scanned';
      other.style.display = 'none';
      return;
    }
    var p = MARKER_SETS[r.i],
      ks = presetMkeys(p),
      ix = inkKeys(ks)
        .map(function (k) {
          return keyIdx(k);
        })
        .filter(function (i) {
          return i != null;
        })
        .sort(function (a, b) {
          var na = HS[a].c < 0.12,
            nb = HS[b].c < 0.12;
          // (v309.1: the greys light to dark; by hue, near-greys' noisy hue jumbled a Gray Tones set's strip)
          return na - nb || (na ? HS[b].l - HS[a].l : HS[a].h - HS[b].h || HS[b].l - HS[a].l);
        }),
      step = Math.max(1, Math.ceil(ix.length / 40)),
      strip = '';
    for (var j = 0; j < ix.length; j += step) strip += '<i style="background:' + COLORS[ix[j]].hex + '"></i>';
    $('wcTR').textContent = r.all ? 'Is this your set?' : 'The closest set';
    box.innerHTML =
      '<div class="wcrest">' +
      // (v309.1: a set further down with only some of the caps had said "Also matches")
      (!r.all ? 'Has ' + r.hits + ' of the ' + r.of + ' caps' : fAt ? 'Also matches' : 'Best match') +
      '</div><div class="wcresn">' +
      // ("All Copic markers", not "Copic All Copic markers")
      esc(p.allbrand ? p.n : p.b + ' ' + p.n) +
      '</div><div class="wcress">' +
      presetSize(p) +
      ' markers' +
      (ks.length > presetSize(p) ? ' and a Colorless Blender' : '') +
      '</div><div class="wcstrip" aria-hidden="true">' +
      strip +
      '</div><div class="wcress">' +
      (r.all
        ? 'Has ' + (r.of === 1 ? 'the cap' : 'all ' + r.of + ' caps') + ' you scanned: '
        : 'Of the caps you scanned, it has ' + r.hits + ': ') +
      '<b>' +
      esc(
        codes(
          fKeys.filter(function (k) {
            return ks.indexOf(k) >= 0;
          }),
        ),
      ) +
      '</b>.</div>';
    // (v309.1) the caps it hasn't (a cap in no set, a colour from another set) are added too: said, on the button
    var extra = fKeys.filter(function (k) {
      return ks.indexOf(k) < 0;
    }).length;
    if (extra)
      box.innerHTML +=
        '<div class="wcress">' +
        esc(
          codes(
            fKeys.filter(function (k) {
              return ks.indexOf(k) < 0;
            }),
          ),
        ) +
        (extra === 1 ? ' isn’t' : ' aren’t') +
        ' in it: added as well.</div>';
    yes.textContent =
      'Yes, add these ' +
      presetSize(p) +
      ' markers' +
      (extra ? ' and ' + (extra === 1 ? 'the other cap' : 'the ' + extra + ' other caps') : '');
    var nx = list[fAt + 1] || (fAt ? list[0] : null);
    other.style.display = nx ? '' : 'none';
    if (nx)
      other.textContent =
        (fAt + 1 < list.length ? 'No: show ' : 'Back to ') +
        MARKER_SETS[nx.i].n +
        (fAt + 1 < list.length && nx.all ? ' (also matches)' : '');
  }
  $('wcFindOther').addEventListener('click', function () {
    var list = findList(fRes);
    fAt = fAt + 1 < list.length ? fAt + 1 : 0;
    result();
  });
  $('wcFindYes').addEventListener('click', function () {
    var list = findList(fRes),
      r = list[fAt],
      keys = fKeys.slice(),
      names = null;
    if (r) {
      keys = presetMkeys(MARKER_SETS[r.i]).concat(keys);
      names = [MARKER_SETS[r.i].n];
    }
    var n = own(keys);
    if (n < 0) return;
    if (mk) mkAdded(names);
    else added(n, names);
  });
  // --- one by one: Scan, the colour chart (chart.js), typing (Scan's box takes typing and pastes too) ---
  function toOne() {
    show('wcStepOne', false, this);
    $('wcTO').focus({ preventScroll: true });
  }
  $('wcOneByOne').addEventListener('click', toOne);
  $('wcFindNone').addEventListener('click', function () {
    // (v311: in Markers' sheet, its ways to add: back to them, or to them afresh when Find was opened on its own)
    if (!mk) return toOne.call(this);
    var at = trail.findIndex(function (t) {
      return t.id === 'wcStepAdd';
    });
    if (at >= 0) {
      trail = trail.slice(0, at + 1);
      back();
    } else {
      trail = [];
      show('wcStepAdd', true);
      $('wcTA').focus({ preventScroll: true });
    }
  });
  $('wcMoreExtra').addEventListener('click', toOne);
  $('wcMoreSet').addEventListener('click', function () {
    sets.innerHTML = presetListHTML();
    upd();
    show('wcStep1', false, this);
    $('wcT1').focus({ preventScroll: true });
  });
  function oneAdded(n, del) {
    if (n > 0 || del > 0) added(n, null, del || 0);
  }
  // (v309.1) Scan's or the chart's Undo took them back out: the welcome back where they were added from (it had gone
  // on saying "2 markers added")
  function oneUndone() {
    undoneBack();
  }
  ['wcOneScan', 'wcOneType'].forEach(function (id) {
    $(id).addEventListener('click', function () {
      if (typeof openScan === 'function') openScan({ added: oneAdded, undone: oneUndone });
    });
  });
  $('wcOneChart').addEventListener('click', function () {
    if (typeof openChart === 'function') openChart({ added: oneAdded, undone: oneUndone });
  });
  // Restore a backup: the file picker opens in the same tap (an iPhone allows it only then). The welcome stays until a
  // restore worked; a problem is said just above the buttons (pinned to the card's bottom edge) until the next file is
  // chosen (not gone at the next touch, which would move things under the finger). Then Home says what came back. The
  // restore is Back up & restore's.
  const wr = $('wcRestore'),
    wf = $('wcFile'),
    we = $('wcErr');
  const wcErr = function (m) {
    we.innerHTML = m ? '<span>' + ic('triangle-alert', 'icw') + ' ' + m + '</span>' : '';
    we.className = m ? 'mserr' : '';
    we.style.display = m ? '' : 'none';
  };
  wr.addEventListener('click', function () {
    wf.click();
  });
  wf.addEventListener('change', function (e) {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    wcErr('');
    restoreAny(f, 'wcRestore', function (r, why) {
      if (!r) {
        if (why) wcErr(restoreWhy(why));
        return;
      }
      // (and what was kept beside the backup's guides, v304; each guide in the file said once, and Undo for a change
      // to your markers, v308)
      const sm = restoreSummary(r);
      if (sm.err) {
        wcErr(sm.err);
        return;
      }
      close();
      if (state.mode !== 'home') setMode('home');
      else fullRender();
      restoreToast(sm.text, sm.long ? 7000 : 4000, r);
    });
  });
  /* (v311) Markers' Add markers: this card as a sheet over Markers, from its + Add markers (or, with no markers yet,
     the card at its top: finder.js, chrome.js). Its own first step (wcStepAdd: a set, Scan, the chart, Find), or the
     sets list or Find straight away; the welcome's picture and first-run lines aren't shown (.wcmk). Adding a set, or
     a set found, closes it with the usual message and Undo (no "Anything else?"); Scan and the chart open as they
     always have, the sheet closed first. Back from the step it opened at closes it. */
  var mk = false,
    mkFrom = null;
  function mkOpen(step) {
    mk = true;
    mkFrom = document.activeElement;
    snap = null;
    trail = [];
    ov.classList.add('wcmk');
    ov.classList.remove('wcplain');
    sets.innerHTML = presetListHTML();
    upd();
    $('wcAddWays').innerHTML = addWaysHTML('mka');
    $('wcFindNone').textContent = 'None of these: other ways to add';
    ov.querySelectorAll('.wcstep').forEach(function (e) {
      e.style.display = 'none';
    });
    cur = step === 'set' ? 'wcStep1' : step === 'find' ? 'wcStepFind' : 'wcStepAdd';
    $(cur).style.display = '';
    ov.querySelector('.wcard').dataset.step = cur;
    openDialog(ov);
    var h = $(cur).querySelector('.wctitle[tabindex]');
    if (h) h.focus({ preventScroll: true });
  }
  // (handing on: Scan or the chart opens next and takes the keyboard from where the sheet was opened)
  function mkClose(handing) {
    if (!mk) return;
    mk = false;
    trail = [];
    closeDialog(ov);
    ov.classList.remove('wcmk');
    $('wcFindNone').textContent = 'None of these: I\u2019ll add them one by one';
    // (the keyboard back where the sheet was opened from; the card at the top goes once there are markers, so then on
    // Add markers, at the top of the collection)
    var from = mkFrom;
    mkFrom = null;
    if (handing) return;
    setTimeout(function () {
      var to = from && from.isConnected && from.getClientRects().length ? from : $('mkAddBtn');
      if (to && to.getClientRects().length) {
        if (to !== from) window.scrollTo(0, 0);
        to.focus({ preventScroll: true });
      }
    }, 0);
  }
  // a set added (or found) from the sheet: closed, the message with Undo said by own(); nothing new, said so
  function mkAdded(names) {
    mkClose();
    if (!ownFresh)
      toast(
        names && names.length
          ? setNames(names) + (names.length === 1 ? ' is' : ' are') + ' already in your collection.'
          : 'They were already in your collection.',
        3200,
      );
  }
  $('wcAddWays').addEventListener('click', function (e) {
    var b = e.target.closest('[data-add]');
    if (!b) return;
    var a = b.dataset.add;
    if (a === 'set') {
      sets.innerHTML = presetListHTML();
      upd();
      show('wcStep1', false, b);
      $('wcT1').focus({ preventScroll: true });
    } else if (a === 'find') toFind.call(b);
    else {
      var from = mkFrom;
      mkClose(true);
      addWay(a, from && from.isConnected && from.getClientRects().length ? from : $('mkAddBtn'));
    }
  });
  window.openAddMarkers = mkOpen;
  // (the sets' ticks and counts, while the list is open: Scan's toast, another tab; the boxes ticked stay ticked)
  presetRelist = function () {
    var on = [].map.call(sets.querySelectorAll('input:checked'), function (x) {
      return x.getAttribute('data-i');
    });
    var h = presetListHTML();
    if (sets.innerHTML === h && !on.length) return;
    sets.innerHTML = h;
    on.forEach(function (i) {
      var x = sets.querySelector('input[data-i="' + i + '"]');
      if (x) x.checked = true;
    });
    upd();
  };
  $('wcSample').addEventListener('click', function () {
    close();
    setMode('sections');
    if (SF.loadSample) SF.loadSample();
    if (SF.focusOnOpen) SF.focusOnOpen();
  });
  $('wcPhoto').addEventListener('click', function () {
    close();
    setMode('sections');
    if (SF.pickPhoto) SF.pickPhoto();
  });
  $('wcLook').addEventListener('click', close);
  if (!done) openDialog(ov);
})();
// The phone's text size can change while the app is in the background (iOS Dynamic Type, Android font size). The
// text follows by itself (src/css/01-base.css); this re-runs the layout code that measures it, as a resize would.
(function () {
  var root = document.documentElement,
    last = getComputedStyle(root).fontSize;
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'visible') return;
    var now = getComputedStyle(root).fontSize;
    if (now !== last) {
      last = now;
      dispatchEvent(new Event('resize'));
    }
  });
})();

// Storage the browser blocks (see STORE_BLOCKED): one banner under the title on every screen, instead of a
// "storage is full" toast at every step
if (STORE_BLOCKED) {
  const h = document.querySelector('.head');
  if (h)
    h.insertAdjacentHTML(
      'beforeend',
      '<div class="msblocked" role="alert"><b>This browser isn\u2019t letting Marker Studio save \u2014 nothing will be kept.</b> <span>Allow this site to store data (or leave private browsing), then reload.</span></div>',
    );
}
// Library › Import a guide: a guide file opens; a backup is offered as a restore; anything else is said once, by the button
function importPicked(f, btn) {
  const fr = new FileReader();
  fr.onload = function () {
    let d = null;
    try {
      d = JSON.parse(fr.result);
    } catch (_) {}
    if (
      d &&
      typeof d === 'object' &&
      (d.type === 'ms-backup' || d.type === 'ms-guides' || Array.isArray(d) || Array.isArray(d.owned))
    ) {
      // (asked in the app's own dialog, v288)
      (window.SF && SF.askBox
        ? SF.askBox(
            'This is a backup',
            'This file is a Marker Studio backup, not a single guide. Restore it?',
            '<button type="button" class="btn-primary" data-a="go">Restore it</button><button type="button" class="sfghost" data-a="stay">Cancel</button>',
            true,
          )
        : Promise.resolve(
            confirm('This is a Marker Studio backup, not a single guide. Restore it?') ? 'go' : 'stay',
          )
      ).then(function (a) {
        if (a === 'go') restoreAny(f, btn.id);
      });
      return;
    }
    if (
      d &&
      d.payload &&
      typeof d.payload.lmap === 'string' &&
      /^data:image\/png;base64,[A-Za-z0-9+/=]{16,}$/.test(d.payload.lmap) &&
      window.SF &&
      SF.importFile
    ) {
      closeDialog(savedOverlay);
      SF.importFile(f);
      return;
    }
    // (v308) a photo: offered as a new guide; an empty file, or a guide file or backup cut short, said as such
    const why = d ? 'bad' : fileTrouble(f, fr.result);
    if (why === 'picture' && window.SF && SF.photoFile) {
      SF.askBox(
        'Make a guide from this photo?',
        'That\u2019s a photo, not a guide file. Its sections can be found for a new guide.',
        '<button type="button" class="btn-primary" data-a="go">Make a guide</button><button type="button" class="sfghost" data-a="stay">Cancel</button>',
        true,
      ).then(function (a) {
        if (a !== 'go') return;
        closeDialog(savedOverlay);
        SF.photoFile(f);
      });
      return;
    }
    errCard(btn, importWhy(why, fr.result));
  };
  fr.onerror = function () {
    errCard(btn, 'Couldn\u2019t read that file.');
  };
  fr.readAsText(f);
}
// (v308) why a file picked in Import a guide can't be opened, in words
function importWhy(why, text) {
  if (why === 'empty') return 'That file is empty. Choose a guide\u2019s <b>.json</b> file.';
  if (why === 'damaged')
    return /"type"\s*:\s*"ms-(backup|guides)"/.test(String(text || '').slice(0, 400))
      ? RESTORE_DAMAGED
      : 'This guide file is incomplete or damaged \u2014 it may not have finished downloading. Download it again, or ask for it to be sent again.';
  if (why === 'picture')
    return 'That\u2019s a picture, not a guide file. Use <b>Make a guide from my photo</b> for it.';
  return 'That file isn\u2019t a Marker Studio guide. Choose a guide\u2019s <b>.json</b> file, or use <b>Restore</b> for a backup.';
}

// what LOAD_NOTE held at start (null: nothing to say); cleared when the note is dealt with
let _loadN = null;
try {
  _loadN = JSON.parse(localStorage.getItem(LOAD_NOTE) || 'null');
} catch (e) {}
if (!_loadN || typeof _loadN !== 'object') {
  _loadN = null;
  try {
    localStorage.removeItem(STATE_BK);
  } catch (e) {}
}
// Lost guides: a guide stored on this device ('guide-<id>' in IndexedDB) that no Library entry points to, as when the
// Library's list couldn't be read. Looked for at start (only the store's keys are listed; no guide is read) and from
// Help › Your data › Find lost guides. Home offers them back in a card of its own above the tiles, or inside the note
// about unreadable data when that note is about guides. Never offered: the Resume slot (guide-autosave), a guide whose
// delete is still finishing (LIBDEL_KEY), anything in the Library here or in what another tab last saved, a guide
// made in the last few seconds, one seen in only one of two looks a moment apart (another tab saving or deleting it
// right then), and one that turned out unreadable (LOST_SKIP). Not now hides the card until the next start.
const LOST_WAIT = 1500,
  LOST_SKIP = 'ms-lost-skip';
let _lostIds = [],
  _lostHid = false;
function lostSkip() {
  try {
    const a = JSON.parse(localStorage.getItem(LOST_SKIP) || '[]');
    return Array.isArray(a) ? a.map(Number) : [];
  } catch (e) {
    return [];
  }
}
function lostKnown() {
  const ids = new Set(
    state.saved.map(function (s) {
      return +s.id;
    }),
  );
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (v && Array.isArray(v.saved))
      v.saved.forEach(function (e) {
        if (e && typeof e === 'object') ids.add(Number(e.id));
      });
  } catch (e) {}
  libPendList().forEach(function (x) {
    ids.add(x.id);
  });
  lostSkip().forEach(function (x) {
    ids.add(x);
  });
  return ids;
}
function lostFilter(ids) {
  const known = lostKnown(),
    now = Date.now();
  return ids.filter(function (id) {
    return !known.has(id) && Math.abs(now - id) > 10000;
  });
}
function lostScan() {
  if (STORE_BLOCKED) return Promise.resolve([]);
  return IDB.keys()
    .then(function (ks) {
      const ids = [];
      ks.forEach(function (k) {
        const m = /^guide-(\d+)$/.exec(String(k));
        if (m) ids.push(+m[1]);
      });
      return lostFilter(ids);
    })
    .catch(function () {
      return [];
    });
}
function findLost() {
  return lostScan().then(function (a) {
    if (!a.length) return a;
    return new Promise(function (r) {
      setTimeout(r, LOST_WAIT);
    })
      .then(lostScan)
      .then(function (b) {
        return a.filter(function (id) {
          return b.indexOf(id) >= 0;
        });
      });
  });
}
function lostNow() {
  return _lostHid ? [] : lostFilter(_lostIds);
}
function lostWord(k) {
  return nWord(k, 'guide') + ' that ' + (k === 1 ? 'isn’t' : 'aren’t') + ' in your Library';
}
// Add them back: a Library entry for each (the name kept in the stored guide, if any, else "Recovered guide",
// "Recovered guide 2"…; size, markers and sections from the guide itself; its picture drawn from it as for restored
// guides), not backed up yet, so the backup reminder counts it. A guide that can't be read is left where it is and not
// offered again. Resolves to what the toast says ('' when storage was full: that has its own message).
function addLost(ids) {
  const added = [],
    bad = [];
  function recName() {
    const used = new Set(
      state.saved.map(function (s) {
        return s.name;
      }),
    );
    for (let k = 1; ; k++) {
      const n = 'Recovered guide' + (k > 1 ? ' ' + k : '');
      if (!used.has(n)) return n;
    }
  }
  function one(id) {
    return IDB.get('guide-' + id)
      .then(function (pl) {
        if (!pl || typeof pl !== 'object' || lostKnown().has(id)) return;
        return Promise.resolve(
          window.SF && SF.checkGuide ? SF.checkGuide(pl) : { ok: typeof pl.lmap === 'string' },
        ).then(function (c) {
          if (!c || !c.ok) {
            bad.push(id);
            return;
          }
          if (lostKnown().has(id)) return;
          const as = pl.assign && typeof pl.assign === 'object' ? pl.assign : {},
            ks = (Array.isArray(pl.keys) ? pl.keys : Object.values(as)).filter(function (k) {
              return typeof k === 'string';
            }),
            n = +pl.n || Object.keys(as).length,
            m = {
              id: id,
              type: 'guide',
              name: typeof pl.name === 'string' && pl.name.trim() ? pl.name.trim().slice(0, 120) : recName(),
              ts: Date.now(),
              keys: [...new Set(ks)].slice(0, COLORS.length),
              W: +c.w || +pl.W || 0,
              H: +c.h || +pl.H || 0,
              n: n,
              thumb: '',
            };
          if (Array.isArray(pl.prog)) m.done = Math.min(pl.prog.length, n || pl.prog.length);
          state.saved.unshift(m);
          added.push(m);
        });
      })
      .catch(function () {});
  }
  return ids
    .reduce(function (p, id) {
      return p.then(function () {
        return one(id);
      });
    }, Promise.resolve())
    .then(function () {
      if (bad.length)
        try {
          localStorage.setItem(LOST_SKIP, JSON.stringify(lostSkip().concat(bad).slice(-200)));
        } catch (e) {}
      if (
        added.length &&
        !keep(function () {
          state.saved = state.saved.filter(function (s) {
            return added.indexOf(s) < 0;
          });
        })
      ) {
        renderHomeNotes();
        return '';
      }
      renderSaved();
      renderRecent();
      renderLibStat();
      renderBackupNudge();
      renderHomeNotes();
      // each one's picture, drawn from the guide (renderRecent starts the first few; this is for the rest)
      added.forEach(function (m) {
        if (window.SF && SF.thumbFor)
          SF.thumbFor(m.id).then(function (t) {
            const s = state.saved.find(function (x) {
              return x.id === m.id;
            });
            if (!t || !s || safeThumb(s.thumb)) return;
            s.thumb = t;
            if (!save(true)) s.thumb = '';
            libRowChanged(m.id);
          });
      });
      const nb = bad.length
        ? nWord(bad.length, 'guide') +
          ' couldn’t be read and ' +
          (bad.length === 1 ? 'was' : 'were') +
          ' left out.'
        : '';
      return added.length
        ? 'Added ' + nWord(added.length, 'guide') + ' back to your Library' + (nb ? '. ' + nb : '')
        : nb ||
            'Nothing to add — ' +
              (ids.length === 1 ? 'that guide is' : 'those guides are') +
              ' back already.';
    });
}
// (v304) look for lost guides again (a restore left one beside the backup's copy) and offer them on Home
function lostRefresh() {
  findLost().then(function (ids) {
    _lostIds = ids;
    _lostHid = false;
    renderHomeNotes();
  });
}
function lostAddTap(b, ids, after) {
  const was = b.textContent;
  b.disabled = true;
  b.textContent = 'Adding…';
  addLost(ids).then(function (msg) {
    b.disabled = false;
    b.textContent = was;
    if (msg) toast(msg, /couldn/.test(msg) ? 7000 : 4000);
    if (after) after(msg);
  });
}

// Saved data that couldn't be read (see noteLoss in state.js): said on Home, above the tiles, with what was lost (the
// counts noteLoss stored), until OK is tapped, the original (kept in STATE_BK) is saved as a file, or a backup is
// restored (offered when the markers, or everything, went). Then the copy is deleted and what could be read is saved,
// so the next start has nothing to say. With no note waiting, a copy left from an older version is deleted.
function lossWords(n) {
  if (n.all || (n.markers === -1 && n.palettes === -1))
    return 'Your saved markers and Library couldn’t be read and were left out.';
  const lib = n.palettes === -1 || n.guides === -1,
    p = [
      n.markers === -1 ? 'your saved markers' : n.markers > 0 ? nWord(n.markers, 'marker') : '',
      lib ? 'your Library' : n.palettes > 0 ? nWord(n.palettes, 'palette') : '',
      !lib && n.guides > 0 ? nWord(n.guides, 'guide') : '',
    ].filter(Boolean);
  if (!p.length) return 'Some saved data couldn’t be read and was left out.';
  const t = p.length > 1 ? p.slice(0, -1).join(', ') + ' and ' + p[p.length - 1] : p[0],
    one = p.length === 1 && (/^1 /.test(t) || t === 'your Library');
  return (
    t.charAt(0).toUpperCase() + t.slice(1) + ' couldn’t be read and ' + (one ? 'was' : 'were') + ' left out.'
  );
}
// k: lost guides found on this device, offered in the same note (Add them back) when what was lost included guides
function loadNoteHTML(n, k) {
  // (no copy, and the original no longer here either (the app was opened again): nothing to download)
  const dl = !n.nocopy || typeof _lossRaw === 'string',
    rs = !!n.all || n.markers === -1,
    only = !n.all && n.guides > 0 && !n.markers && !n.palettes,
    it = k === 1 ? 'it' : 'them',
    head = !k
      ? lossWords(n)
      : only
        ? nWord(n.guides, 'guide') + ' couldn’t be read — found ' + k + ' on this device.'
        : lossWords(n) + ' Found ' + nWord(k, 'guide') + ' stored on this device.';
  return (
    '<div class="ntxt">' +
    head +
    ' <span>' +
    (k ? 'Add ' + it + ' back to your Library. ' : '') +
    (!n.nocopy
      ? 'A copy of the original was kept.'
      : typeof _lossRaw === 'string'
        ? 'There wasn’t room to keep a copy of the original: download it now, before you close the app.'
        : 'There wasn’t room to keep a copy of the original.') +
    (rs ? ' If you have a backup file, restore it.' : '') +
    '</span></div><div class="nrow">' +
    (k
      ? '<button class="nb1" id="lnAdd" data-ln="add">Add ' +
        it +
        ' back</button>' +
        (rs ? '<button id="lnRestore" data-ln="restore">Restore a backup</button>' : '') +
        (dl ? '<button id="lnSave" data-ln="save">Download the original</button>' : '')
      : rs
        ? '<button class="nb1" id="lnRestore" data-ln="restore">Restore a backup</button>' +
          (dl ? '<button id="lnSave" data-ln="save">Download the original</button>' : '')
        : dl
          ? '<button class="nb1" id="lnSave" data-ln="save">Download the original</button>'
          : '') +
    '<button ' +
    (!k && !rs && !dl ? 'class="nb1" ' : '') +
    'id="lnOk" data-ln="ok">OK</button></div>' +
    (rs
      ? '<input type="file" id="lnFile" class="fileinput" accept=".json,.txt,application/json,text/plain">'
      : '')
  );
}
function lostNoteHTML(k) {
  return (
    '<div class="ntxt">Found ' +
    lostWord(k) +
    '. <span>' +
    (k === 1 ? 'It’s' : 'They’re') +
    ' still stored on this device.</span></div><div class="nrow"><button class="nb1" id="lostAdd" data-lost="add">Add ' +
    (k === 1 ? 'it' : 'them') +
    ' back</button><button id="lostLater" data-lost="later">Not now</button></div>'
  );
}
// Draws both notes above the tiles; a note that is unchanged is left alone (with any message shown in it). Focus that
// was on a note that went moves to the other note's first button, or to New colouring guide.
function renderHomeNotes() {
  const el = $('loadNote'),
    ll = $('lostNote');
  if (!el || !ll) return;
  const k = lostNow().length,
    combo = !!_loadN && k > 0 && (!!_loadN.all || !!_loadN.guides),
    fa = document.activeElement,
    had = !!fa && (el.contains(fa) || ll.contains(fa)),
    fid = had ? fa.id : '',
    paint = function (x, h) {
      if (x._h === h) return;
      x._h = h;
      x.innerHTML = h;
      x.style.display = h ? '' : 'none';
    },
    vis = function (b) {
      return b && b.isConnected && b.getClientRects().length ? b : null;
    };
  paint(el, _loadN ? loadNoteHTML(_loadN, combo ? k : 0) : '');
  paint(ll, k && !combo ? lostNoteHTML(k) : '');
  if (had && !vis(fa)) {
    const t =
      vis(fid && $(fid)) ||
      vis(el.querySelector('button')) ||
      vis(ll.querySelector('button')) ||
      homeStartBtn();
    if (t) t.focus({ preventScroll: true });
  }
}
(function () {
  const el = $('loadNote'),
    ll = $('lostNote');
  if (!el || !ll) return;
  // the note is dealt with (OK, Download the original, a restore): the copy goes and what could be read is saved
  function gone() {
    try {
      localStorage.removeItem(LOAD_NOTE);
      localStorage.removeItem(STATE_BK);
    } catch (e) {}
    save(true);
    _loadN = null;
    renderHomeNotes();
  }
  // Restore a backup: like the Welcome's (the file picker opens in the same tap); once something came back the note goes
  el.addEventListener('change', function (e) {
    if (e.target.id !== 'lnFile') return;
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    const b = $('lnRestore');
    restoreAny(f, 'lnRestore', function (r, why) {
      if (!r) {
        if (why) errCard(b && b.parentNode, restoreWhy(why));
        return;
      }
      const sm = restoreSummary(r);
      if (sm.err) {
        errCard(b && b.parentNode, sm.err);
        return;
      }
      gone();
      fullRender();
      restoreToast(sm.text, sm.long ? 7000 : 4000, r);
    });
  });
  el.addEventListener('click', function (e) {
    const b = e.target.closest('[data-ln]');
    if (!b) return;
    if (b.dataset.ln === 'ok') {
      // the lost guides it offered are put away too, until the next start
      if ($('lnAdd')) _lostHid = true;
      gone();
      return;
    }
    if (b.dataset.ln === 'add') {
      lostAddTap(b, lostNow());
      return;
    }
    if (b.dataset.ln === 'restore') {
      const lf = $('lnFile');
      if (lf) lf.click();
      return;
    }
    let raw = null;
    try {
      raw = localStorage.getItem(STATE_BK);
    } catch (_) {}
    // (this time's original first: one from an earlier note can still be in the copy)
    if (typeof _lossRaw === 'string') raw = _lossRaw;
    if (typeof raw !== 'string' || !raw) {
      errCard(b.parentNode, 'The copy couldn’t be read on this device.');
      return;
    }
    // the text exactly as it was: a .json file when it still reads as JSON, otherwise plain text
    let json = true;
    try {
      JSON.parse(raw);
    } catch (_) {
      json = false;
    }
    const d = new Date(),
      day =
        d.getFullYear() +
        '-' +
        String(d.getMonth() + 1).padStart(2, '0') +
        '-' +
        String(d.getDate()).padStart(2, '0');
    handOver(
      new Blob([raw], { type: json ? 'application/json' : 'text/plain' }),
      'marker-studio-original-' + day + (json ? '.json' : '.txt'),
      { title: 'Marker Studio saved data', retry: false },
    ).then(function (r) {
      if (r === 'share' || r === 'download') {
        gone();
        toast(r === 'share' ? 'Copy saved.' : 'Copy downloaded.');
      } else if (r === false) errCard(b.parentNode, 'The copy couldn’t be saved on this device.');
    });
  });
  ll.addEventListener('click', function (e) {
    const b = e.target.closest('[data-lost]');
    if (!b) return;
    if (b.dataset.lost === 'add') lostAddTap(b, lostNow());
    else {
      _lostHid = true;
      renderHomeNotes();
    }
  });
  renderHomeNotes();
  findLost().then(function (ids) {
    _lostIds = ids;
    renderHomeNotes();
  });
})();
// Help › Your data › Find lost guides: the same look, any time; what it finds is offered on Home too
(function () {
  const hb = $('helpLost'),
    out = $('helpLostRes');
  if (!hb || !out) return;
  hb.addEventListener('click', function () {
    hb.disabled = true;
    out.textContent = 'Looking…';
    findLost().then(function (ids) {
      hb.disabled = false;
      _lostIds = ids;
      _lostHid = false;
      renderHomeNotes();
      const k = lostNow().length;
      out.innerHTML = k
        ? '<p>Found ' +
          lostWord(k) +
          '.</p><button type="button" class="btn-soft" id="helpLostAdd">Add ' +
          (k === 1 ? 'it' : 'them') +
          ' back</button>'
        : '<p>No lost guides found.</p>';
    });
  });
  out.addEventListener('click', function (e) {
    const b = e.target.closest('#helpLostAdd');
    if (!b) return;
    lostAddTap(b, lostNow(), function (msg) {
      if (!msg) return;
      out.innerHTML = '<p>' + esc(msg) + (/[.]$/.test(msg) ? '' : '.') + '</p>';
      hb.focus({ preventScroll: true });
    });
  });
})();
