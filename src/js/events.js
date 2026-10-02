if (!reduce) {
  stage.addEventListener('pointermove', (e) => {
    const r = stage.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width,
      y = (e.clientY - r.top) / r.height;
    stage.classList.add('tilting');
    stage.style.transform =
      'perspective(1100px) rotateX(' +
      ((0.5 - y) * 12).toFixed(2) +
      'deg) rotateY(' +
      ((x - 0.5) * 12).toFixed(2) +
      'deg)';
    glare.style.setProperty('--gx', (x * 100).toFixed(1) + '%');
    glare.style.setProperty('--gy', (y * 100).toFixed(1) + '%');
    glare.style.opacity = '1';
  });
  const rest = () => {
    stage.classList.remove('tilting');
    stage.style.transform = '';
    glare.style.opacity = '0';
  };
  stage.addEventListener('pointerleave', rest);
  stage.addEventListener('pointerup', rest);
  stage.addEventListener('pointercancel', rest);
}

let armT = null;
function disarm() {
  if (armT) {
    clearTimeout(armT);
    armT = null;
  }
  resetBtn.dataset.arm = '0';
  resetBtn.textContent = 'Clear';
}
// Clear (it was Reset: what it does is empty the palettes, or Random's drawn markers), on a second tap
resetBtn.textContent = 'Clear';
resetBtn.addEventListener('click', () => {
  if (!clearable()) return;
  if (resetBtn.dataset.arm === '1') {
    disarm();
    if (state.mode === 'palette') {
      if (state.harmony === 'custom') state.customPal = state.customPal.map(() => null);
      else {
        state.palettes = [];
        state.palH = [];
        state.locked = [];
      }
    } else state.drawn = [];
    save();
    fullRender();
    return;
  }
  resetBtn.dataset.arm = '1';
  resetBtn.textContent = 'Clear all? Tap again';
  armT = setTimeout(disarm, 3000);
});
drawBtn.addEventListener('click', action);
swapBtn.addEventListener('click', doReDraw);
undoBtn.addEventListener('click', undo);
swatch.addEventListener('click', () => {
  if (state.mode === 'random' && !drawBtn.disabled && !rolling) doDraw();
});
palette.addEventListener('click', (e) => {
  if (state.mode !== 'palette' || rolling) return;
  if (state.harmony === 'custom') {
    const bb = e.target.closest('.band');
    if (bb) {
      const k = [...bands.children].indexOf(bb);
      if (k >= 0) openPicker({ type: 'slot', pos: k });
    }
    return;
  }
  const lk = e.target.closest('.blk');
  if (lk) {
    const bb = lk.closest('.band');
    const k = [...bands.children].indexOf(bb);
    if (k >= 0) toggleLock(k);
    return;
  }
  const b = e.target.closest('.band');
  if (b) {
    const k = [...bands.children].indexOf(b);
    const pal = state.palettes[state.palettes.length - 1];
    if (pal && state.locked.includes(pal[k])) return;
    if (k >= 0) {
      if (state.harmony === 'photo') swapPhotoBand(k);
      else doReRollBand(k);
    }
  } else if (state.harmony === 'photo') {
    // no photo yet: the empty card's tap chooses one, as it says
    if (!_photoImg) $('photoPick').click();
  } else if (!drawBtn.disabled) doGenerate();
});
pile.addEventListener('click', (e) => {
  const cell = e.target.closest('.cell');
  if (!cell) return;
  const idx = +cell.dataset.i;
  state.drawn = state.drawn.filter((x) => x !== idx);
  save();
  fullRender();
});
results.addEventListener('click', async (e) => {
  const cell = e.target.closest('.cell');
  if (!cell) return;
  if (mkHeld) {
    mkHeld = false;
    return;
  }
  const i = +cell.dataset.i;
  if (state.mode === 'collection') {
    const c = COLORS[i],
      had = setOwned(i, !isOwned(i));
    if (had == null) return;
    toastAction(
      (had ? 'Removed ' : 'Added ') +
        esc(c.brand + ' ' + c.code) +
        (had ? ' from' : ' to') +
        ' your collection',
      'Undo',
      function () {
        setOwned(i, had);
      },
    );
  } else {
    const c = COLORS[i];
    const ok = await copyText(c.code);
    flashCopy(ok ? 'Copied ' + c.code : 'Couldn\u2019t copy');
  }
});
// Tick or untick one marker. The swatch stays where it is (dimmed when unticked) until the list is next redrawn
// by a search, filter or view change, so the grid never shifts under your finger. Returns whether it was owned, or
// null when storage is full (nothing changed).
function setOwned(i, on) {
  const k = mkey(i),
    had = state.owned.has(k);
  if (on) state.owned.add(k);
  else state.owned.delete(k);
  if (
    !keep(function () {
      if (had) state.owned.add(k);
      else state.owned.delete(k);
    })
  ) {
    if (mkOpenIdx === i) mkFill(i);
    return null;
  }
  const el = results.querySelector('.cell[data-i="' + i + '"]');
  if (el) {
    const rb = el.querySelector('.rankb'),
      t = document.createElement('div');
    t.innerHTML = cellHtml(i, rb ? +rb.textContent : 0);
    const n = t.firstChild,
      f = el === document.activeElement;
    el.replaceWith(n);
    if (f) n.focus({ preventScroll: true });
  }
  chrome.keepGrid = true;
  try {
    chrome();
    headBrands();
  } finally {
    chrome.keepGrid = false;
  }
  if (mkOpenIdx === i) mkFill(i);
  return had;
}
// press and hold (or right-click) a marker for its details
let mkHeld = false,
  mkT = 0,
  mkOpenIdx = null;
results.addEventListener('pointerdown', (e) => {
  const cell = e.target.closest('.cell');
  if (!cell || e.button > 0) return;
  mkHeld = false;
  clearTimeout(mkT);
  const x = e.clientX,
    y = e.clientY;
  const mv = (ev) => {
    if (Math.abs(ev.clientX - x) + Math.abs(ev.clientY - y) > 10) {
      clearTimeout(mkT);
      off();
    }
  };
  const off = () => {
    clearTimeout(mkT);
    results.removeEventListener('pointermove', mv);
    document.removeEventListener('pointerup', off);
    document.removeEventListener('pointercancel', off);
  };
  results.addEventListener('pointermove', mv);
  document.addEventListener('pointerup', off);
  document.addEventListener('pointercancel', off);
  mkT = setTimeout(() => {
    mkT = 0;
    off();
    mkHeld = true;
    try {
      if (navigator.vibrate) navigator.vibrate(8);
    } catch (_) {}
    openMarkerSheet(+cell.dataset.i);
    // the finger lifting after the hold would land on the sheet that just opened: ignore that one click
    const t0 = Date.now(),
      eat = (ev) => {
        document.removeEventListener('click', eat, true);
        if (Date.now() - t0 < 1500 && $('mkOverlay').contains(ev.target)) {
          ev.stopPropagation();
          ev.preventDefault();
        }
      };
    document.addEventListener('click', eat, true);
  }, 480);
});
// the keyboard's way to a marker's details: Shift+F10 or the menu key on a focused marker. Most browsers turn those
// into a contextmenu event (below); Safari doesn't, so they're taken here, and the contextmenu they'd bring is dropped
results.addEventListener('keydown', (e) => {
  if (!(e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey))) return;
  const cell = e.target.closest && e.target.closest('.cell');
  if (!cell) return;
  e.preventDefault();
  clearTimeout(mkT);
  mkHeld = false;
  openMarkerSheet(+cell.dataset.i);
});
results.addEventListener('contextmenu', (e) => {
  const cell = e.target.closest('.cell');
  if (!cell) return;
  e.preventDefault();
  clearTimeout(mkT);
  if (!mkHeld) openMarkerSheet(+cell.dataset.i);
  mkHeld = false;
});
function mkFill(i) {
  const c = COLORS[i];
  $('mkSw').style.background = c.hex;
  $('mkCode').textContent = c.brand + ' ' + c.code;
  $('mkName').textContent = c.name || '';
  $('mkMeta').textContent = [
    c.fam || '',
    c.hex.toUpperCase(),
    c.old && c.old !== c.code ? 'old code ' + c.old : '',
  ]
    .filter(Boolean)
    .join(' \u00b7 ');
  $('mkOwn').checked = isOwned(i);
  mkWishFill(i);
}
function openMarkerSheet(i) {
  if (!COLORS[i]) return;
  mkOpenIdx = i;
  mkFill(i);
  openDialog($('mkOverlay'));
}
function closeMarkerSheet() {
  closeDialog($('mkOverlay'));
  mkOpenIdx = null;
}
$('mkClose').addEventListener('click', closeMarkerSheet);
$('mkOverlay').addEventListener('click', (e) => {
  if (e.target === $('mkOverlay')) closeMarkerSheet();
});
$('mkOwn').addEventListener('change', (e) => {
  if (mkOpenIdx == null) return;
  const i = mkOpenIdx,
    c = COLORS[i],
    had = setOwned(i, e.target.checked);
  if (had == null) return;
  toastAction(
    (had ? 'Removed ' : 'Added ') +
      esc(c.brand + ' ' + c.code) +
      (had ? ' from' : ' to') +
      ' your collection',
    'Undo',
    function () {
      setOwned(i, had);
      if (mkOpenIdx === i) $('mkOwn').focus({ preventScroll: true });
    },
  );
});
$('mkCopy').addEventListener('click', async () => {
  if (mkOpenIdx == null) return;
  const ok = await copyText(COLORS[mkOpenIdx].code);
  toast(
    ok
      ? 'Copied ' + esc(COLORS[mkOpenIdx].code)
      : 'Couldn\u2019t copy \u2014 select the code and copy it yourself.',
    ok ? 2200 : 5000,
  );
});
$('mkSimilar').addEventListener('click', () => {
  if (mkOpenIdx == null) return;
  const hex = COLORS[mkOpenIdx].hex;
  closeMarkerSheet();
  if (window.msMatchHex) window.msMatchHex(hex);
});
copyBtn.addEventListener('click', async () => {
  const m = finderMatches();
  if (!m.length) {
    flashCopy('Nothing to copy');
    return;
  }
  const _bs = new Set(m.map((i) => COLORS[i].brand));
  const ok = await copyText(
    m.map((i) => (_bs.size > 1 ? COLORS[i].brand + ' ' : '') + COLORS[i].code).join(', '),
  );
  flashCopy(ok ? 'Copied ' + m.length : 'Couldn\u2019t copy');
});
searchInput.addEventListener('input', () => {
  searchStr = (searchInput.value || '').trim().toLowerCase();
  if (state.mode === 'finder' || state.mode === 'collection') renderResults();
});
toPalette.addEventListener('click', () => handoff('palette'));
poolClear.addEventListener('click', () => {
  setPool(null);
  save();
  fullRender();
});
exportBtn.addEventListener('click', async () => {
  let idxs, fn;
  if (state.mode === 'palette') {
    if (state.harmony === 'custom') {
      idxs = state.customPal.filter((x) => x != null);
      if (!idxs.length) return;
    } else {
      const p = state.palettes[state.palettes.length - 1];
      if (!p) return;
      idxs = p;
    }
    fn = 'marker-studio-palette.png';
  } else if (state.mode === 'random') {
    if (!state.drawn.length) return;
    idxs = state.drawn.slice().reverse();
    fn = 'marker-studio-drawn.png';
  } else return;
  exportBtn.disabled = true;
  const old = exportBtn.textContent;
  exportBtn.textContent = 'Rendering…';
  try {
    const url = await makeCard(idxs, state.mode);
    showOverlay(url, fn);
  } catch (e) {}
  exportBtn.textContent = old;
  exportBtn.disabled = false;
});
ovClose.addEventListener('click', closeOverlay);
imgOverlay.addEventListener('click', (e) => {
  if (e.target === imgOverlay) closeOverlay();
});
segs.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  setSize(+b.dataset.n);
});
harm.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  setHarmony(b.dataset.h);
});
(function () {
  var pf = document.getElementById('photoFile'),
    pk = document.getElementById('photoPick'),
    ps = document.getElementById('photoSize');
  if (pk && pf)
    pk.addEventListener('click', function () {
      pf.value = '';
      pf.click();
    });
  if (pf)
    pf.addEventListener('change', function () {
      var f = pf.files && pf.files[0];
      if (!f) return;
      var fr = new FileReader();
      fr.onload = function () {
        var im = new Image();
        im.onload = function () {
          _photoImg = im;
          var t = document.getElementById('photoThumb');
          if (t) t.src = fr.result;
          paperReset();
          applyPhotoPalette();
        };
        im.onerror = function () {
          errCard(pk, 'Couldn\u2019t read that image. Try a JPEG or PNG photo.');
        };
        im.src = fr.result;
      };
      fr.onerror = function () {
        errCard(pk, 'Couldn\u2019t read that file.');
      };
      fr.readAsDataURL(f);
    });
  if (ps)
    ps.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      var n = Math.max(4, Math.min(16, +b.dataset.n));
      state.palSize = n;
      save();
      applyPhotoPalette();
      chrome();
    });
  /* Tap the white paper: while the button is pressed, a tap on the photo sets its paper; the palette is then taken
     from the photo with its lighting corrected (the photo shows the correction), until ✕ or a new photo. Never
     automatic: a sunset's cast is the picture. */
  var paperB = document.getElementById('photoPaper'),
    lightB = document.getElementById('photoLight'),
    note = document.getElementById('photoPaperNote'),
    thumb = document.getElementById('photoThumb'),
    paperMode = false,
    thumbSrc = null;
  function setNote(t) {
    if (note) note.textContent = t || '';
  }
  function setMode(on) {
    paperMode = !!on;
    if (paperB) paperB.setAttribute('aria-pressed', paperMode ? 'true' : 'false');
    if (thumb) thumb.classList.toggle('paperpick', paperMode);
    setNote(paperMode ? 'Now tap a plain white part of the paper in the photo.' : '');
  }
  // the photo at up to 800px across, for the paper spot and the corrected thumbnail
  function photoCanvas() {
    var s = Math.min(1, 800 / Math.max(_photoImg.width, _photoImg.height, 1)),
      c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(_photoImg.width * s));
    c.height = Math.max(1, Math.round(_photoImg.height * s));
    drawShrunk(c.getContext('2d'), _photoImg, c.width, c.height);
    return c;
  }
  function useFix(fix) {
    _photoFix = fix;
    if (lightB) lightB.style.display = fix ? '' : 'none';
    if (thumb) {
      if (fix) {
        if (thumbSrc == null) thumbSrc = thumb.src;
        var c = photoCanvas(),
          g = c.getContext('2d'),
          im = g.getImageData(0, 0, c.width, c.height);
        lightApplyData(fix, im.data);
        g.putImageData(im, 0, 0);
        thumb.src = c.toDataURL('image/jpeg', 0.9);
        freeCanvas(c);
      } else if (thumbSrc != null) {
        thumb.src = thumbSrc;
        thumbSrc = null;
      }
    }
    applyPhotoPalette();
  }
  // a new photo starts without a correction
  function paperReset() {
    setMode(false);
    _photoFix = null;
    thumbSrc = null;
    if (lightB) lightB.style.display = 'none';
  }
  if (paperB)
    paperB.addEventListener('click', function () {
      setMode(!paperMode);
    });
  if (lightB)
    lightB.addEventListener('click', function () {
      setNote('');
      useFix(null);
      if (paperB) paperB.focus();
    });
  if (thumb)
    thumb.addEventListener('click', function (e) {
      if (!paperMode || !_photoImg) return;
      var rr = thumb.getBoundingClientRect(),
        c = photoCanvas(),
        x = Math.max(0, Math.min(c.width - 1, Math.round(((e.clientX - rr.left) / rr.width) * c.width))),
        y = Math.max(0, Math.min(c.height - 1, Math.round(((e.clientY - rr.top) / rr.height) * c.height))),
        r;
      try {
        r = paperSpot(
          patchLin(
            c.getContext('2d').getImageData(0, 0, c.width, c.height).data,
            c.width,
            c.height,
            x,
            y,
            Math.max(2, Math.round(c.width / 100)),
          ),
        );
      } catch (err) {
        return;
      } finally {
        // (v296: Safari counts a canvas until it's collected)
        freeCanvas(c);
      }
      if (r.bad) {
        setNote(r.note); // stays in the mode for another try
        return;
      }
      setMode(false);
      useFix(r.fix);
      setNote(r.note);
    });
  // Escape leaves the mode (a dialog over the palette takes its Escape first)
  addLayer({
    name: 'Palette: tap the white paper',
    order: 5,
    isOpen: function () {
      return paperMode && state.mode === 'palette' && state.harmony === 'photo';
    },
    close: function () {
      setMode(false);
    },
  });
})();
function setSeed(key) {
  state.seed = key;
  save();
  chrome();
  regenReplace();
}
function renderSeedGrid() {
  const q = (seedSearch.value || '').trim().toLowerCase();
  const out = [];
  for (let i = 0; i < COLORS.length; i++) {
    if (!inPool(i)) continue;
    const c = COLORS[i];
    if (q && !(c.code + ' ' + c.name).toLowerCase().includes(q)) continue;
    out.push(i);
  }
  const shown = out.slice(0, 400),
    mix = brandsMixedIn(shown);
  seedGrid.innerHTML = out.length
    ? shown
        .map((i) => {
          const c = COLORS[i];
          return (
            '<div class="cell" data-i="' +
            i +
            '" role="button" tabindex="0" aria-label="' +
            esc(c.brand + ' ' + c.code + ' ' + c.name) +
            '" title="' +
            c.brand +
            ' ' +
            c.code +
            ' · ' +
            c.name +
            '">' +
            btHTML(c.brand, mix) +
            '<div class="sq" style="background:' +
            c.hex +
            '"></div><div class="cc">' +
            c.code +
            '</div></div>'
          );
        })
        .join('')
    : '<div class="empty">No ' +
      (state.owned.size && !state.pool ? 'owned ' : '') +
      'markers match your filters and search.</div>';
}
let pickTarget = { type: 'seed' };
function openPicker(t) {
  pickTarget = t;
  seedSearch.value = '';
  renderSeedGrid();
  pickTitle.textContent = t.type === 'seed' ? 'Start the palette from' : 'Choose a marker';
  pickCap.textContent =
    t.type === 'seed'
      ? 'Pick a marker to build the harmony around it.'
      : (state.pool ? 'Markers in your selection' : state.owned.size ? 'Your markers' : 'All markers') +
        ' matching your filters. Tap one to place it.';
  seedRandom.textContent = t.type === 'seed' ? 'Random base' : 'Clear slot';
  openDialog(seedOverlay);
}
function pickApply(idx) {
  closeDialog(seedOverlay);
  if (pickTarget.type === 'seed') {
    setSeed(idx == null ? null : mkey(idx));
  } else {
    ensureCustomSize();
    state.customPal[pickTarget.pos] = idx == null ? null : idx;
    save();
    showCustom();
    chrome();
  }
}
seedBtn.addEventListener('click', (e) => {
  if (e.target.closest('.sx') && state.seed) {
    setSeed(null);
    return;
  }
  openPicker({ type: 'seed' });
});
seedSearch.addEventListener('input', renderSeedGrid);
seedGrid.addEventListener('click', (e) => {
  const cell = e.target.closest('.cell');
  if (!cell) return;
  pickApply(+cell.dataset.i);
});
seedRandom.addEventListener('click', () => pickApply(null));
seedClose.addEventListener('click', () => closeDialog(seedOverlay));
saveBtn.addEventListener('click', () => {
  if (state.mode === 'palette') doSave();
  else if (state.mode === 'random') doSaveDraw();
});
var _uig = document.getElementById('useInGuide');
if (_uig)
  _uig.addEventListener('click', function () {
    var idxs = currentPaletteIdxs();
    if (!idxs.length) return;
    var keys = idxs.map(mkey);
    var ex = state.saved.filter(function (s) {
      return (
        s.type === 'palette' &&
        s.keys &&
        s.keys.length === keys.length &&
        s.keys.every(function (k, i) {
          return k === keys[i];
        })
      );
    })[0];
    // (v288) with a guide open, asked first: recolour it, or a new guide with this palette (a finished guide only the
    // second: its coloured sections keep their markers, so recolouring would change nothing)
    var g = window.SF && SF.guideBrief ? SF.guideBrief() : null;
    if (g && SF.askBox) {
      var btns =
        (g.done
          ? ''
          : '<button type="button" class="btn-primary" data-a="recolour">Recolour this guide</button>') +
        '<button type="button"' +
        (g.done ? ' class="btn-primary"' : '') +
        ' data-a="new">New guide with it</button><button type="button" class="sfghost" data-a="stay">Cancel</button>';
      SF.askBox(
        'Use this palette in a guide?',
        g.done
          ? '\u201c' +
              g.name +
              '\u201d is finished: its coloured sections keep their markers, so recolouring it would change nothing. Start a new guide with this palette?'
          : g.inked
            ? 'Recolour \u201c' +
              g.name +
              '\u201d (it keeps the ' +
              g.inked +
              ' section' +
              (g.inked === 1 ? '' : 's') +
              ' you\u2019ve coloured), or start a new guide with it?'
            : 'Recolour \u201c' + g.name + '\u201d with it, or start a new guide with it?',
        btns,
        false,
        // (a new guide opens the photo picker within the tap: iOS opens it only from one)
        function (a) {
          if (a === 'new') useInGuideGo(idxs, keys, ex, true);
        },
      ).then(function (a) {
        if (a === 'recolour') useInGuideGo(idxs, keys, ex, false);
      });
      return;
    }
    useInGuideGo(idxs, keys, ex, false);
  });
// Palette's Use in a guide, once it's decided: the palette saved (if it isn't), then the open guide recoloured with
// it, or (fresh) the photo picker for a new guide that will use it
function useInGuideGo(idxs, keys, ex, fresh) {
  {
    var id,
      entry = null;
    if (ex) {
      id = ex.id;
    } else {
      entry = { id: Date.now(), type: 'palette', name: nameForSave(idxs), keys: keys, ts: Date.now() };
      state.saved.push(entry);
      id = entry.id;
      // kept first: with storage full nothing changes and the message stays on this screen
      if (
        !keep(function () {
          state.saved.splice(state.saved.indexOf(entry), 1);
        })
      )
        return;
    }
    // a new guide: the palette is held for it, the open guide left as it is
    if (fresh) {
      if (window.SF && SF.setNextPal) SF.setNextPal(id);
      setMode('sections');
      if (window.SF && SF.pickPhoto) SF.pickPhoto();
      return;
    }
    // recolour: the open guide goes to its Plan first (from Colour along or Edit sections, v289) and is laid again with
    // it; section edits not yet built wait for Build again or Discard (the palette stays in the Library)
    const r = window.SF && SF.recolourWith ? SF.recolourWith(id) : true;
    setMode('sections');
    if (r === 'edits') {
      toast(
        'Build again or discard your section edits first, then Use in a guide. The palette is in your Library.',
        7000,
      );
      return;
    }
    // (unless the guide has just said, under its tabs, that sections you've coloured were kept)
    if (r !== false && window.SF && SF.hasGuide && SF.hasGuide() && !document.getElementById('sfHeldNote'))
      toast('Recoloured the guide with this palette.');
  }
}
savedBtn.addEventListener('click', () => openLibrary(true));
$('palSaved').addEventListener('click', () => openLibrary(true));
// Palette and Random: Save is the row's one button; the less-used Library and Save image sit in a ⋯ menu beside it
// (the same buttons, moved in, so everything that opens or tests them still finds them by id)
const libMore = document.createElement('button'),
  libMenu = document.createElement('div'),
  libMoreWrap = document.createElement('div');
libMoreWrap.className = 'libmore';
libMore.type = 'button';
libMore.id = 'libMore';
libMore.setAttribute('aria-label', 'More: Library, Save image');
libMore.setAttribute('aria-haspopup', 'menu');
libMore.setAttribute('aria-expanded', 'false');
libMore.setAttribute('aria-controls', 'libMenu');
libMore.innerHTML = ic('ellipsis');
libMenu.id = 'libMenu';
libMenu.className = 'libmenu';
libMenu.setAttribute('role', 'menu');
libMenu.setAttribute('aria-label', 'More');
libMenu.hidden = true;
[savedBtn, exportBtn].forEach((b) => {
  b.setAttribute('role', 'menuitem');
  b.tabIndex = -1;
  libMenu.appendChild(b);
});
libMoreWrap.append(libMore, libMenu);
libRow.appendChild(libMoreWrap);
const libItems = () =>
  [...libMenu.querySelectorAll('button')].filter((b) => b.style.display !== 'none' && !b.disabled);
function libMenuOpen(on, focusFirst) {
  libMenu.hidden = !on;
  libMore.setAttribute('aria-expanded', on ? 'true' : 'false');
  if (!on) return;
  const it = libItems();
  if (focusFirst && it[0]) it[0].focus({ preventScroll: true });
  libMenu.scrollIntoView({ block: 'nearest', behavior: 'instant' });
}
libMore.addEventListener('click', () => libMenuOpen(libMenu.hidden, true));
// an item: the menu closes and focus goes back to ⋯ before the item acts, so the dialog it opens returns focus there
libMenu.addEventListener(
  'click',
  (e) => {
    if (!e.target.closest('button')) return;
    libMenuOpen(false);
    libMore.focus({ preventScroll: true });
  },
  true,
);
libMenu.addEventListener('keydown', (e) => {
  const it = libItems(),
    k = it.indexOf(document.activeElement);
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    if (it.length) it[(k + (e.key === 'ArrowDown' ? 1 : it.length - 1)) % it.length].focus();
  } else if (e.key === 'Home' || e.key === 'End') {
    e.preventDefault();
    if (it.length) it[e.key === 'Home' ? 0 : it.length - 1].focus();
  } else if (e.key === 'Tab') libMenuOpen(false);
});
// a tap anywhere else closes it
document.addEventListener(
  'pointerdown',
  (e) => {
    if (!libMenu.hidden && !libMoreWrap.contains(e.target)) libMenuOpen(false);
  },
  true,
);
addLayer({
  name: 'Palette: the ⋯ menu',
  order: 6,
  isOpen: () => !libMenu.hidden,
  close: () => {
    const back = libMenu.contains(document.activeElement);
    libMenuOpen(false);
    if (back) libMore.focus({ preventScroll: true });
  },
});
savedClose.addEventListener('click', () => closeDialog(savedOverlay));
var _pC = document.getElementById('sfPlanClose');
if (_pC)
  _pC.addEventListener('click', function () {
    closeDialog(document.getElementById('sfPlanOverlay'));
  });
var _pO = document.getElementById('sfPlanOverlay');
if (_pO)
  _pO.addEventListener('click', function (e) {
    if (e.target === _pO) closeDialog(_pO);
  });
$('guidesBackup').addEventListener('click', () => {
  backupAll('guidesBackup');
});
{
  const _gf = $('guidesFile');
  $('guidesRestore').addEventListener('click', () => _gf.click());
  _gf.addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) restoreAny(f, 'guidesRestore');
    e.target.value = '';
  });
}
savedOverlay.addEventListener('click', (e) => {
  if (e.target === savedOverlay) closeDialog(savedOverlay);
});
savedList.addEventListener('click', (e) => {
  // (a tap anywhere else in the list while a tile's ⋯ menu is open only closes the menu)
  if (savedList.querySelector('.smenu:not([hidden])') && !e.target.closest('.smenu,.smore')) {
    tileMenuClose(false);
    return;
  }
  const row = e.target.closest('.srow');
  if (!row || row.classList.contains('editing')) return;
  const id = +row.dataset.id,
    mb = e.target.closest('.smore');
  if (mb) {
    tileMenuOpen(mb, e.detail === 0);
    return;
  }
  if (e.target.closest('.sren')) {
    tileMenuClose(true);
    libStartRename(id);
    return;
  }
  if (e.target.closest('.sdel')) {
    tileMenuClose(true);
    libDelete(id);
    return;
  }
  if (e.target.closest('.smenu')) return;
  tileMenuClose(false);
  const entry = state.saved.find((s) => s.id === id);
  if (entry) {
    if (entry.type === 'draw') loadDraw(entry);
    else if (entry.type === 'guide') loadGuide(entry);
    else loadSaved(entry);
  }
});
var _ls = document.getElementById('libSearch');
if (_ls)
  _ls.addEventListener('input', function (e) {
    libQuery = e.target.value;
    renderSaved();
  });
var _lo = document.getElementById('libSort');
if (_lo)
  _lo.addEventListener('change', function (e) {
    libSort = e.target.value;
    renderSaved();
  });
// Enter keeps a new name, Escape drops it (and only that: layers.js leaves an Escape in this field to it, so the Library
// stays open), leaving the field keeps it
// a tile's ⋯ menu by keyboard: arrows move between Rename and Delete, Tab leaves it closed
savedList.addEventListener('keydown', (e) => {
  const m = e.target.closest && e.target.closest('.smenu');
  if (!m) return;
  const it = [...m.querySelectorAll('button')],
    k = it.indexOf(document.activeElement);
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    it[(k + (e.key === 'ArrowDown' ? 1 : it.length - 1)) % it.length].focus();
  } else if (e.key === 'Home' || e.key === 'End') {
    e.preventDefault();
    it[e.key === 'Home' ? 0 : it.length - 1].focus();
  } else if (e.key === 'Tab') tileMenuClose(false);
});
document.addEventListener(
  'pointerdown',
  (e) => {
    const m = savedList.querySelector('.smenu:not([hidden])');
    if (m && !savedList.contains(e.target)) tileMenuClose(false);
  },
  true,
);
addLayer({
  name: 'Library: a tile’s ⋯ menu',
  // (over the Library's own dialog: Escape closes the menu first)
  order: 110,
  isOpen: () => topDialog() === savedOverlay && !!savedList.querySelector('.smenu:not([hidden])'),
  close: () => tileMenuClose(true),
});
savedList.addEventListener('keydown', (e) => {
  if (!e.target.closest || !e.target.closest('.sname-in')) return;
  if (e.key === 'Enter') {
    e.preventDefault();
    libEndRename(true, true);
  } else if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    libEndRename(false, true);
  }
});
savedList.addEventListener('focusout', (e) => {
  if (e.target.closest && e.target.closest('.sname-in')) libEndRename(true, false);
});
seedOverlay.addEventListener('click', (e) => {
  if (e.target === seedOverlay) closeDialog(seedOverlay);
});
function setMode(m) {
  if (state.mode === m || rolling) return;
  disarm();
  unownDisarm();
  state.mode = m;
  save(true);
  if (m === 'collection' && state.owned.size) {
    const _pb = $('presetBody'),
      _ph = $('presetHdr');
    if (_pb && _pb.style.display !== 'none' && _ph) _ph.click();
  }
  fullRender();
  if (!reduce) {
    const c = document.querySelector('.wrap');
    c.classList.remove('swap');
    void c.offsetWidth;
    c.classList.add('swap');
  }
}

mPalette.addEventListener('click', () => setMode('palette'));
{
  const eg = $('eoGo');
  if (eg) eg.addEventListener('click', () => goMarkers());
}
mCollection.addEventListener('click', () => setMode('collection'));

const WARM_FAMS = new Set([
  'Red-Violet',
  'Red',
  'Yellow-Red / Orange',
  'Yellow',
  'Yellow-Green',
  'Yellow-Green-Yellow',
  'Earth / Skin / Brown',
  'Warm Grey',
  'Toner Grey',
]);
const COOL_FAMS = new Set([
  'Green',
  'Blue-Green',
  'Blue-Green-Yellow',
  'Blue',
  'Blue-Violet',
  'Violet',
  'Cool Grey',
  'Green Grey',
]);
$('famWarm').addEventListener('click', () => {
  state.excluded = new Set(families.filter((f) => !WARM_FAMS.has(f.name)).map((f) => f.name));
  filterChanged();
});
$('famCool').addEventListener('click', () => {
  state.excluded = new Set(families.filter((f) => !COOL_FAMS.has(f.name)).map((f) => f.name));
  filterChanged();
});
$('all').addEventListener('click', () => {
  fgClear('fam');
  filterChanged();
});
$('toneAll').addEventListener('click', () => {
  fgClear('tone');
  filterChanged();
});
$('satAll').addEventListener('click', () => {
  fgClear('sat');
  filterChanged();
});
famsEl.addEventListener('click', (e) => {
  const b = e.target.closest('.chip');
  if (!b) return;
  fgTap('fam', b.dataset.fam);
  filterChanged();
});
tonesEl.addEventListener('click', (e) => {
  const b = e.target.closest('.chip');
  if (!b) return;
  fgTap('tone', b.dataset.tone);
  filterChanged();
});
satsEl.addEventListener('click', (e) => {
  const b = e.target.closest('.chip');
  if (!b) return;
  fgTap('sat', b.dataset.sat);
  filterChanged();
});
brandsEl.addEventListener('click', (e) => {
  const b = e.target.closest('.chip');
  if (!b) return;
  fgTap('brand', b.dataset.brand);
  filterChanged();
});
$('brandAll').addEventListener('click', () => {
  fgClear('brand');
  filterChanged();
});
filterBar.addEventListener('click', () => {
  state.filtersOpen = !state.filtersOpen;
  save();
  chrome();
});
gapSort.addEventListener('change', () => {
  const g = gapSort.value;
  if (g && g !== state.gapSort) {
    state.gapSort = g;
    save();
    renderResults();
    chrome();
  }
});
ownView.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  state.collView = b.dataset.v;
  save();
  fullRender();
});
var _mkd = document.getElementById('mkDrawBtn');
if (_mkd)
  _mkd.addEventListener('click', function () {
    setPool(null);
    setMode('random');
  });
ownAllBtn.addEventListener('click', () => {
  const add = finderMatches()
    .map((i) => mkey(i))
    .filter((k) => !state.owned.has(k));
  add.forEach((k) => state.owned.add(k));
  if (!keep(() => add.forEach((k) => state.owned.delete(k)))) return;
  fullRender();
  if (add.length)
    toastAction(
      'Added ' + add.length + ' marker' + (add.length === 1 ? '' : 's') + ' to your collection',
      'Undo',
      () => {
        add.forEach((k) => state.owned.delete(k));
        save();
        fullRender();
      },
    );
});
const OHUHU_SETS = {
  '24': 'Y111 Y26 Y216 YR313 R014 R210 R413 RV08 RV311 V010 V18 V416 BV310 B08 B111 BG114 BG311 G36 G310 G312 G410 CG18 BGY24 120',
  '48': 'Y06 Y111 Y26 Y213 Y216 YR07 YR112 YR39 YR313 YR515 E415 R014 R28 R210 R215 R412 R413 R514 RV08 RV212 RV311 RV314 V010 V13 V18 V416 BV38 BV310 B08 B111 B115 BG114 BG311 G114 G36 G310 G312 G315 G49 G410 YG012 YG211 YG510 CG18 BGY24 YGY11 WG10 120',
  '72': 'Y07 Y111 Y26 Y29 Y213 Y216 YR07 YR17 YR112 YR39 YR313 YR515 E22 E415 R013 R014 R28 R210 R215 R46 R412 R413 R514 RV08 RV111 RV212 RV311 RV314 V010 V13 V18 V416 BV29 BV31 BV38 BV310 B02 B08 B111 B114 B115 BG114 BG212 BG311 G013 G112 G113 G114 G36 G310 G312 G315 G43 G49 G410 YG06 YG012 YG211 YG212 YG510 CG17 CG18 BGY15 BGY24 YGY11 WG10 WG26 WG27 GG03 GG05 GG10 120',
  '120':
    'Y07 Y111 Y26 Y27 Y28 Y29 Y213 Y216 Y315 Y415 Y611 YR04 YR07 YR17 YR111 YR112 YR33 YR34 YR39 YR313 YR515 E22 E212 E415 E511 E515 R013 R014 R015 R16 R28 R210 R213 R215 R38 R46 R412 R413 R514 RV08 RV17 RV18 RV19 RV111 RV212 RV311 RV314 RV316 V010 V13 V18 V216 V38 V416 BV26 BV29 BV31 BV38 BV310 BV314 BV315 BV514 B02 B08 B111 B114 B115 B310 B315 B411 B415 BG05 BG114 BG212 BG215 BG311 BG314 BG315 G013 G112 G113 G114 G36 G310 G311 G312 G315 G316 G43 G49 G410 YG06 YG012 YG015 YG211 YG212 YG414 YG415 YG510 CG17 CG18 CG25 BGY02 BGY15 BGY18 BGY24 BGY25 BGY35 BGY38 YGY11 WG10 WG26 WG27 WG37 GG03 GG05 GG10 GG15 GG16 120',
  '168':
    'Y02 Y07 Y14 Y111 Y26 Y27 Y28 Y29 Y213 Y216 Y315 Y45 Y415 Y55 Y62 Y69 Y611 YR04 YR06 YR07 YR11 YR17 YR111 YR112 YR33 YR34 YR39 YR313 YR43 YR52 YR55 YR59 YR515 E05 E14 E22 E26 E212 E46 E415 E511 E515 E85 E92 R013 R014 R015 R15 R16 R22 R27 R28 R210 R213 R215 R38 R46 R412 R413 R54 R514 RV04 RV05 RV08 RV17 RV18 RV19 RV111 RV25 RV212 RV33 RV34 RV311 RV314 RV316 V010 V13 V14 V18 V22 V216 V38 V416 BV05 BV26 BV29 BV31 BV32 BV35 BV38 BV310 BV314 BV315 BV514 B02 B03 B05 B08 B111 B114 B115 B21 B28 B310 B315 B411 B415 BG05 BG114 BG24 BG212 BG215 BG310 BG311 BG314 BG315 G013 G112 G113 G114 G34 G36 G310 G311 G312 G315 G316 G43 G47 G49 G410 YG06 YG012 YG015 YG211 YG212 YG414 YG415 YG510 CG01 CG17 CG18 CG24 CG25 BGY00 BGY02 BGY15 BGY18 BGY24 BGY25 BGY35 BGY38 YGY02 YGY11 YGY13 WG01 WG04 WG10 WG26 WG27 WG37 GG03 GG05 GG10 GG15 GG16 GG24 120',
  '216':
    'Y02 Y07 Y09 Y14 Y111 Y26 Y27 Y28 Y29 Y213 Y216 Y39 Y311 Y315 Y45 Y46 Y410 Y412 Y413 Y415 Y55 Y62 Y69 Y611 YR04 YR06 YR07 YR11 YR17 YR19 YR111 YR112 YR33 YR34 YR39 YR312 YR313 YR43 YR52 YR55 YR59 YR513 YR515 E05 E14 E19 E22 E26 E211 E212 E311 E46 E413 E415 E58 E511 E515 E610 E85 E92 E97 R013 R014 R015 R15 R16 R22 R27 R28 R210 R213 R215 R23 R38 R46 R48 R410 R412 R413 R54 R57 R514 RV04 RV05 RV08 RV09 RV17 RV18 RV19 RV111 RV25 RV28 RV29 RV212 RV33 RV34 RV39 RV311 RV314 RV316 RV57 V010 V13 V14 V18 V22 V29 V216 V38 V46 V412 V416 BV05 BV08 BV013 BV26 BV28 BV29 BV31 BV32 BV35 BV38 BV310 BV314 BV315 BV48 BV415 BV58 BV514 B02 B03 B05 B08 B09 B111 B114 B115 B21 B28 B310 B311 B315 B411 B415 BG05 BG114 BG24 BG211 BG212 BG215 BG310 BG311 BG314 BG315 G013 G112 G113 G114 G34 G36 G310 G311 G312 G315 G316 G43 G44 G47 G49 G410 YG06 YG012 YG015 YG111 YG112 YG211 YG212 YG36 YG414 YG415 YG510 YG610 YG611 CG01 CG17 CG18 CG24 CG25 CG28 BGY00 BGY02 BGY13 BGY15 BGY18 BGY24 BGY25 BGY35 BGY38 YGY02 YGY11 YGY13 WG01 WG04 WG06 WG10 WG26 WG27 WG37 GG03 GG05 GG10 GG12 GG15 GG16 GG24 120',
  '320':
    'Y00 Y02 Y03 Y06 Y07 Y09 Y14 Y17 Y19 Y111 Y26 Y27 Y28 Y29 Y213 Y215 Y216 Y34 Y39 Y311 Y315 Y42 Y45 Y46 Y49 Y410 Y412 Y413 Y415 Y416 Y55 Y59 Y515 Y62 Y69 Y611 YR00 YR03 YR04 YR06 YR07 YR015 YR11 YR17 YR19 YR111 YR112 YR213 YR215 YR33 YR34 YR39 YR312 YR313 YR314 YR43 YR45 YR47 YR52 YR55 YR57 YR58 YR59 YR511 YR513 YR515 E05 E06 E011 E14 E17 E19 E22 E26 E211 E212 E311 E313 E314 E44 E46 E413 E415 E58 E511 E515 E69 E610 E614 E713 E85 E92 E97 E914 R012 R013 R014 R015 R016 R15 R16 R112 R22 R23 R25 R26 R27 R28 R210 R211 R212 R213 R215 R38 R310 R312 R46 R48 R410 R412 R413 R50 R54 R56 R57 R59 R513 R514 R69 R612 R615 RV01 RV04 RV05 RV08 RV09 RV17 RV18 RV19 RV111 RV23 RV25 RV28 RV29 RV212 RV33 RV34 RV35 RV39 RV310 RV311 RV314 RV316 RV57 RV514 RV515 V08 V010 V013 V015 V13 V14 V18 V112 V22 V29 V216 V32 V34 V38 V46 V412 V414 V416 BV05 BV08 BV013 BV015 BV15 BV115 BV26 BV28 BV29 BV210 BV31 BV32 BV35 BV38 BV310 BV311 BV312 BV314 BV315 BV48 BV414 BV415 BV58 BV514 B02 B03 B05 B06 B08 B09 B015 B111 B112 B114 B115 B21 B27 B28 B310 B311 B315 B411 B412 B415 BG04 BG05 BG09 BG011 BG19 BG114 BG21 BG24 BG211 BG212 BG215 BG310 BG311 BG314 BG315 G012 G013 G112 G113 G114 G24 G210 G34 G36 G310 G311 G312 G313 G315 G316 G41 G43 G44 G47 G49 G410 YG06 YG07 YG012 YG015 YG111 YG112 YG113 YG29 YG211 YG212 YG215 YG36 YG312 YG413 YG414 YG415 YG510 YG66 YG610 YG611 CG01 CG02 CG17 CG18 CG24 CG25 CG28 BGY00 BGY02 BGY13 BGY15 BGY18 BGY24 BGY25 BGY35 BGY38 YGY02 YGY05 YGY11 YGY13 YGY17 YGY18 WG01 WG04 WG06 WG08 WG10 WG26 WG27 WG37 WG38 GG03 GG05 GG07 GG10 GG11 GG12 GG15 GG16 GG24 GG25 FY00 FY01 FY02 FY04 120',
  '48mid':
    'Y09 Y39 Y311 Y46 Y410 Y412 Y413 YR19 YR312 YR513 E19 E211 E311 E413 E58 E610 E97 R23 R48 R410 R57 RV09 RV28 RV29 RV39 RV57 V29 V46 V412 BV08 BV013 BV28 BV48 BV415 BV58 B09 B311 BG211 G44 YG111 YG112 YG36 YG610 YG611 CG28 BGY13 WG06 GG12',
  '104':
    'Y00 Y03 Y06 Y17 Y19 Y215 Y34 Y42 Y49 Y416 Y59 Y515 YR00 YR03 YR015 YR213 YR215 YR314 YR45 YR47 YR57 YR58 YR511 E06 E011 E17 E313 E314 E44 E69 E614 E713 E914 R012 R016 R112 R25 R26 R211 R212 R310 R312 R50 R56 R59 R513 R69 R612 R615 RV01 RV23 RV35 RV310 RV514 RV515 V08 V013 V015 V112 V32 V34 V414 BV015 BV15 BV115 BV210 BV311 BV312 BV414 B06 B015 B112 B27 B412 BG04 BG09 BG011 BG19 BG21 G012 G24 G210 G313 G41 YG07 YG113 YG29 YG215 YG312 YG413 YG66 CG02 YGY05 YGY17 YGY18 WG08 WG38 GG07 GG11 GG25 FY00 FY01 FY02 FY04',
  '36skin':
    'Y216 Y210 Y34 Y43 Y48 Y415 YR02 YR04 YR09 YR17 YR25 YR29 YR33 YR34 YR37 YR38 YR39 YR313 YR47 YR57 YR515 E47 E49 E59 E511 E513 E514 E515 E66 E612 E615 E75 E711 E81 E814 R16',
  '36gray':
    'YR02 E14 E19 E111 B21 B310 B311 B411 B415 CG01 CG02 CG17 CG18 CG25 CG28 BGY00 BGY13 BGY15 BGY18 BGY24 BGY35 BGY38 YGY02 YGY11 YGY13 WG01 WG04 WG06 WG10 WG27 WG37 GG03 GG05 GG10 GG12 GG24',
  '48pastelS':
    'Y02 Y14 Y45 Y55 Y62 Y69 YR06 YR11 YR43 YR52 YR55 YR59 E05 E14 E26 E46 E85 E92 R15 R22 R27 R54 RV04 RV05 RV25 RV33 RV34 V14 V22 BV05 BV32 BV35 B03 B05 B21 B28 BG24 BG310 G34 G47 CG01 CG24 BGY00 YGY02 YGY13 WG01 WG04 GG24',
  '48pastelB':
    'Y00 Y03 Y06 Y07 Y26 Y42 YR00 YR03 YR05 YR06 YR33 YR45 YR47 YR56 YR57 YR58 E22 R25 R50 RV01 RV23 RV35 V32 V34 V38 BV26 BV31 BV38 B02 B06 B310 BG04 BG09 BG21 G24 G36 G41 G43 G49 YG06 YG07 YG66 CG02 BGY02 YGY11 WG10 GG03 GG10',
  '24portrait':
    'Y415 YR02 YR04 YR09 YR17 YR33 YR34 YR37 YR38 YR313 YR47 YR515 E47 E49 E511 E513 E66 E612 E615 E75 E711 E81 E814 R16',
};
/* v244: four set lists were one colour short (checked against Ohuhu's charts). If someone already added
   one of those sets - they own every other colour in it - add the colour they were missing. Runs once. */
if (state.setFix1 !== 1) {
  [
    ['120', 'BV38'],
    ['168', 'YR06'],
    ['216', 'R23'],
    ['36skin', 'Y210'],
  ].forEach(function (f) {
    var rest = OHUHU_SETS[f[0]].split(' ').filter(function (c) {
      return c !== f[1];
    });
    if (
      rest.every(function (c) {
        return state.owned.has('Ohuhu|' + c);
      })
    )
      state.owned.add('Ohuhu|' + f[1]);
  });
  state.setFix1 = 1;
  save();
}
const MARKER_SETS = [
  { b: 'Ohuhu', n: 'Honolulu 24', oh: '24' },
  { b: 'Ohuhu', n: 'Honolulu 48', oh: '48' },
  { b: 'Ohuhu', n: 'Honolulu 72', oh: '72' },
  { b: 'Ohuhu', n: 'Honolulu 120', oh: '120' },
  { b: 'Ohuhu', n: 'Honolulu 168', oh: '168' },
  { b: 'Ohuhu', n: 'Honolulu 216', oh: '216' },
  { b: 'Ohuhu', n: 'Honolulu 320 (complete set)', oh: '320' },
  { b: 'Ohuhu', n: '48 Mid-tone Set', oh: '48mid' },
  { b: 'Ohuhu', n: '104 Colors Set', oh: '104' },
  { b: 'Ohuhu', n: '36 Skin Tones', oh: '36skin' },
  { b: 'Ohuhu', n: '36 Gray Tones', oh: '36gray' },
  { b: 'Ohuhu', n: '48 Pastel - Sweetness', oh: '48pastelS' },
  { b: 'Ohuhu', n: '48 Pastel - Blossoming', oh: '48pastelB' },
  { b: 'Ohuhu', n: '24 Portrait', oh: '24portrait' },
  { b: 'Copic', n: 'Ciao 12', c: 'BV08 V09 RV04 R29 YR07 Y06 YG06 G17 BG09 B29 E29 100' },
  {
    b: 'Copic',
    n: 'Ciao 24',
    c: 'BV00 BV02 RV02 R20 R29 YR02 YR07 Y00 Y08 YG03 YG06 G00 G05 BG09 BG23 B00 B24 B29 E00 E21 E29 E37 C-3 100',
  },
  {
    b: 'Copic',
    n: 'Ciao 36 - Set A',
    c: 'C3 100 B00 B24 B29 BG01 BG09 BG23 BV00 BV02 BV08 E00 E21 E29 E37 G00 G05 G17 R20 R29 R32 RV02 RV04 RV10 V04 V09 V12 Y00 Y06 Y17 YG03 YG06 YG11 YR02 YR07 YR20',
  },
  {
    b: 'Copic',
    n: 'Ciao 36 - Set B',
    c: 'B05 B23 B32 B39 BG10 BG15 BG93 BV04 E02 E04 E08 E33 E35 E47 E51 G02 G21 G99 R02 R27 R59 RV21 RV23 RV29 RV42 V17 Y02 Y08 YG41 YG67 YR00 YR04 C1 C5 C7 0',
  },
  {
    b: 'Copic',
    n: 'Ciao 36 - Set C',
    c: 'B02 B12 B60 B63 BG05 BG34 BV13 BV23 BV31 E11 E31 E50 E53 E71 G000 G07 G14 R00 R05 R11 R22 RV000 RV06 RV13 V000 V06 Y11 Y15 Y21 YG00 YG23 YG63 YR16 YR23 YR31 YR61',
  },
  {
    b: 'Copic',
    n: 'Ciao 36 - Set D',
    c: 'B45 B93 B95 B97 BG49 BG96 BV17 BV29 E43 E49 E57 E77 E93 E95 G28 G85 G94 R17 R35 R37 R46 R85 RV34 RV95 V15 V91 V95 Y28 Y38 YG91 YG95 YR68 W1 W3 W5 W7',
  },
  {
    b: 'Copic',
    n: 'Ciao 36 - Set E',
    c: 'C0 C2 W0 W2 B000 B18 B28 B99 BG000 BG13 BG72 BV000 BV25 E000 E15 E18 E25 E40 E41 E59 E79 G29 G82 R000 R14 R81 RV14 RV69 V01 V05 Y000 Y35 YG09 YG17 YR000 YR15',
  },
  {
    b: 'Copic',
    n: 'Ciao 72 - Set A',
    c: 'BV00 BV02 BV04 BV08 V04 V09 V12 V17 RV02 RV04 RV10 RV21 RV23 RV29 RV42 R02 R20 R27 R29 R32 R59 YR00 YR02 YR04 YR07 YR20 Y00 Y02 Y06 Y08 Y17 YG03 YG06 YG11 YG41 YG67 G00 G02 G05 G17 G21 G99 BG01 BG09 BG10 BG15 BG23 BG93 B00 B05 B23 B24 B29 B32 B39 E00 E02 E04 E08 E21 E29 E33 E35 E37 E47 E51 C-1 C-3 C-5 C-7 0 100',
  },
  {
    b: 'Copic',
    n: 'Ciao 72 - Set B',
    c: 'BV13 BV17 BV23 BV29 BV31 V000 V06 V15 V91 V95 RV000 RV06 RV13 RV34 RV95 R00 R05 R11 R17 R22 R35 R37 R46 R85 YR16 YR23 YR31 YR61 YR68 Y11 Y15 Y21 Y28 Y38 YG00 YG23 YG63 YG91 YG95 G000 G07 G14 G28 G85 G94 BG05 BG34 BG49 BG96 B02 B12 B45 B60 B63 B93 B95 B97 E11 E31 E43 E49 E50 E53 E57 E71 E77 E93 E95 W-1 W-3 W-5 W-7',
  },
  { b: 'Copic', n: 'Sketch 12', c: 'V09 RV11 R08 YR04 Y13 YG03 G17 B14 B29 B39 E09 100' },
  {
    b: 'Copic',
    n: 'Sketch 24 - Manga',
    c: 'BV0000 BV000 BV13 BV20 RV52 R0000 R000 R17 R43 YR01 YR15 Y000 Y04 Y18 G03 BG000 BG53 B04 B41 B63 E84 N-2 N-4 N-6',
  },
  {
    b: 'Copic',
    n: 'Sketch 36',
    c: 'V09 RV11 RV29 R02 R08 YR04 YR24 Y11 Y13 Y15 YG03 G07 G17 G21 G28 B05 B06 B14 B29 B32 B39 E09 E29 E33 C-1 C-3 C-5 C-7 C-9 W-1 W-3 W-5 W-7 W-9 100 110',
  },
  {
    b: 'Copic',
    n: 'Sketch 72 - Set A',
    c: 'BV08 V04 V06 V09 RV04 RV09 RV11 RV19 RV29 R02 R08 R27 R32 R37 YR00 YR04 YR07 YR09 YR14 YR23 YR24 Y02 Y06 Y11 Y13 Y15 Y21 Y26 YG03 YG13 YG91 YG95 G07 G16 G17 G21 G28 G99 BG09 BG10 BG15 BG18 B01 B05 B06 B14 B23 B26 B29 B32 B34 B37 B39 E09 E15 E29 E33 E37 E44 E49 C-1 C-3 C-5 C-7 C-9 W-1 W-3 W-5 W-7 W-9 100 110',
  },
  {
    b: 'Copic',
    n: 'Sketch 72 - Set B',
    c: 'BV00 BV04 BV23 BV31 V12 V15 V17 RV06 RV21 RV34 R20 R24 R29 R39 R59 YR02 Y00 Y08 Y17 YG07 YG11 YG17 YG41 YG67 G00 G02 G05 G12 G14 G29 G85 BG02 BG11 BG13 BG32 BG45 BG49 B00 B02 B12 B18 B21 B24 B41 B45 E00 E02 E04 E07 E11 E13 E21 E31 E35 E39 E40 E41 E43 E51 E57 C-0 C-2 C-4 C-6 C-8 C-10 N-1 N-3 N-5 N-7 N-9 0',
  },
  {
    b: 'Copic',
    n: 'Sketch 72 - Set C',
    c: 'RV02 RV10 RV13 RV14 RV17 RV25 RV32 R00 R05 R11 R17 R35 YR16 YR18 YR21 Y19 Y23 Y38 YG01 YG05 YG09 YG21 YG23 YG25 YG45 YG63 YG97 YG99 G09 G19 G20 G24 G40 G82 BG05 BG34 BG99 B04 B16 E00 E19 E25 E27 E34 E53 E55 E59 E77 N-0 N-2 N-4 N-6 N-8 N-10 T-0 T-1 T-2 T-3 T-4 T-5 T-6 T-7 T-8 T-9 T-10 W-0 W-2 W-4 W-6 W-8 W-10 100',
  },
  {
    b: 'Copic',
    n: 'Sketch 72 - Set D',
    c: 'BV000 BV02 BV11 BV13 BV17 BV20 BV25 BV29 V01 V05 V91 V95 V99 RV23 RV42 R000 R12 R14 R22 R30 R43 R46 YR000 YR20 YR31 YR61 YR65 YR68 Y04 Y28 Y32 Y35 YG00 YG06 YG93 G94 BG01 BG07 BG23 BG93 BG96 B000 B28 B52 B60 B63 B79 B91 B93 B95 B97 B99 E000 E01 E08 E47 E50 E71 E74 E79 E93 E95 E97 E99 FV FRV FYR FY FYG FG FBG FB',
  },
  {
    b: 'Copic',
    n: 'Sketch 72 - Set E',
    c: 'BV0000 BV01 BV34 V0000 V000 V20 V22 V25 V28 V93 RV0000 RV000 RV00 RV52 RV55 RV63 RV66 RV69 RV91 RV93 RV95 RV99 R0000 R01 R21 R56 R81 R83 R85 R89 YR0000 YR01 YR12 YR15 YR27 YR30 YR82 Y0000 Y000 Y18 YG0000 YG61 G0000 G000 G03 G43 G46 BG0000 BG000 BG53 BG57 BG70 BG72 BG75 BG78 BG90 B0000 B66 B69 E0000 E17 E18 E23 E30 E42 E70 E81 E84 E87 E89 C-00 W-00',
  },
  { b: 'Copic', n: 'All Copic markers', allbrand: 'Copic' },
];
function normCode(x) {
  return x.replace(/^([CW])(\d)/, '$1-$2');
}
function presetMkeys(p) {
  var out = [];
  if (p.allbrand) {
    COLORS.forEach(function (c, i) {
      if (c.brand === p.allbrand) out.push(mkey(i));
    });
    return out;
  }
  if (p.oh) {
    var w = {};
    OHUHU_SETS[p.oh].split(' ').forEach(function (x) {
      w[x] = 1;
    });
    COLORS.forEach(function (c, i) {
      if (c.brand === 'Ohuhu' && w[c.code]) out.push(mkey(i));
    });
    return out;
  }
  var want = {};
  p.c.split(' ').forEach(function (x) {
    want[normCode(x)] = 1;
  });
  COLORS.forEach(function (c, i) {
    if (c.brand === p.b && want[c.code]) out.push(mkey(i));
  });
  return out;
}
function presetListHTML() {
  var html = '',
    lastB = '';
  MARKER_SETS.forEach(function (p, idx) {
    if (p.b !== lastB) {
      html += '<div class="presetbrand">' + p.b + '</div>';
      lastB = p.b;
    }
    var ks = presetMkeys(p),
      n = ks.length,
      own = 0;
    ks.forEach(function (k) {
      if (state.owned.has(k)) own++;
    });
    var have = n && own === n;
    html +=
      '<label class="presetrow' +
      (have ? ' have' : '') +
      '"><input type="checkbox" data-i="' +
      idx +
      '"><span class="presetnm">' +
      p.n +
      '</span><span class="presetn">' +
      (have ? '\u2713 ' + n : own ? own + '/' + n : n) +
      '</span></label>';
  });
  return html;
}
(function initPresets() {
  var list = document.getElementById('presetList');
  if (list) {
    list.innerHTML = presetListHTML();
  }
  var hdr = document.getElementById('presetHdr'),
    body = document.getElementById('presetBody'),
    add = document.getElementById('presetAdd'),
    rst = document.getElementById('presetReset');
  if (hdr && body)
    hdr.addEventListener('click', function () {
      var open = body.style.display !== 'none';
      if (!open && list) {
        list.innerHTML = presetListHTML();
        upd();
      }
      body.style.display = open ? 'none' : 'block';
      hdr.setAttribute('aria-expanded', open ? 'false' : 'true');
      var car = hdr.querySelector('.presetcar');
      if (car) car.innerHTML = ic(open ? 'chevron-right' : 'chevron-down');
    });
  function upd() {
    var n = list ? list.querySelectorAll('input:checked').length : 0;
    if (add) {
      add.disabled = !n;
      add.textContent = n ? 'Add ' + n + ' set' + (n > 1 ? 's' : '') : 'Add markers';
    }
  }
  function relist() {
    if (!list) return;
    list.innerHTML = presetListHTML();
    upd();
  }
  if (list) list.addEventListener('change', upd);
  if (add)
    add.addEventListener('click', function () {
      var ch = list.querySelectorAll('input:checked');
      if (!ch.length) return;
      const before = new Set(state.owned);
      ch.forEach(function (x) {
        presetMkeys(MARKER_SETS[+x.getAttribute('data-i')]).forEach(function (k) {
          state.owned.add(k);
        });
      });
      if (
        !keep(function () {
          state.owned = before;
        })
      )
        return;
      fullRender();
      list.innerHTML = presetListHTML();
      upd();
    });
  if (rst)
    rst.addEventListener('click', function () {
      if (rst.dataset.arm === '1') {
        rst.dataset.arm = '';
        rst.textContent = 'Clear collection';
        const prev = [...state.owned];
        state.owned = new Set();
        if (
          !keep(function () {
            state.owned = new Set(prev);
          })
        )
          return;
        fullRender();
        // (the sets' "in your collection" marks follow, v298)
        relist();
        if (prev.length)
          toastAction(
            'Cleared ' + prev.length + ' marker' + (prev.length === 1 ? '' : 's') + ' from your collection',
            'Undo',
            function () {
              prev.forEach(function (k) {
                state.owned.add(k);
              });
              save();
              fullRender();
              relist();
            },
          );
      } else {
        rst.dataset.arm = '1';
        rst.textContent =
          'Clear all ' + state.owned.size + (state.owned.size === 1 ? ' marker' : ' markers') + '? Tap again';
        setTimeout(function () {
          if (rst) {
            rst.dataset.arm = '';
            rst.textContent = 'Clear collection';
          }
        }, 2500);
      }
    });
})();
let unownT = null;
function unownDisarm() {
  if (unownT) {
    clearTimeout(unownT);
    unownT = null;
  }
  ownNoneBtn.dataset.arm = '0';
  ownNoneBtn.textContent = 'Untick all shown';
}
let unownAt = 0;
ownNoneBtn.addEventListener('click', () => {
  const m = finderMatches();
  if (!m.length) return;
  // (the second tap of a double tap isn't the confirming one: as Clear ticks, 400 ms)
  if (ownNoneBtn.dataset.arm === '1' && Date.now() - unownAt < 400) return;
  if (ownNoneBtn.dataset.arm === '1') {
    unownDisarm();
    const rem = m.map((i) => mkey(i)).filter((k) => state.owned.has(k));
    rem.forEach((k) => state.owned.delete(k));
    if (!keep(() => rem.forEach((k) => state.owned.add(k)))) return;
    fullRender();
    if (rem.length)
      toastAction(
        'Removed ' + rem.length + ' marker' + (rem.length === 1 ? '' : 's') + ' from your collection',
        'Undo',
        () => {
          rem.forEach((k) => state.owned.add(k));
          save();
          fullRender();
        },
      );
    return;
  }
  ownNoneBtn.dataset.arm = '1';
  unownAt = Date.now();
  ownNoneBtn.textContent = 'Untick ' + m.length + (m.length === 1 ? ' marker' : ' markers') + '? Tap again';
  unownT = setTimeout(unownDisarm, 3000);
});
// Markers' ⋯ (v288): the rarer and riskier actions out of the way: Untick all shown (asks with a second tap, then
// Undo) and Back up & restore, which lives in the Library (the item opens it there). The same buttons, moved in.
const mkMore = document.createElement('button'),
  mkMenu = document.createElement('div'),
  mkMoreWrap = document.createElement('div');
mkMoreWrap.className = 'libmore mkmore';
mkMore.type = 'button';
mkMore.id = 'mkMore';
mkMore.setAttribute('aria-label', 'More: Untick all shown, Back up & restore');
mkMore.setAttribute('aria-haspopup', 'menu');
mkMore.setAttribute('aria-expanded', 'false');
mkMore.setAttribute('aria-controls', 'mkMenu');
mkMore.innerHTML = ic('ellipsis');
mkMenu.id = 'mkMenu';
mkMenu.className = 'libmenu';
mkMenu.setAttribute('role', 'menu');
mkMenu.setAttribute('aria-label', 'More');
mkMenu.hidden = true;
backupBtn.innerHTML = 'Back up &amp; restore <span class="mkmsub">(in the Library)</span>';
[ownNoneBtn, backupBtn].forEach((b) => {
  b.setAttribute('role', 'menuitem');
  b.tabIndex = -1;
  mkMenu.appendChild(b);
});
mkMoreWrap.append(mkMore, mkMenu);
// (v289: beside "Showing 120 markers · Copy codes", where its menu covers nothing it acts on; shown on Markers only)
mkMoreWrap.style.display = 'none';
copyBtn.after(mkMoreWrap);
const mkItems = () =>
  [...mkMenu.querySelectorAll('button')].filter((b) => b.style.display !== 'none' && !b.disabled);
function mkMenuOpen(on, focusFirst) {
  mkMenu.hidden = !on;
  mkMore.setAttribute('aria-expanded', on ? 'true' : 'false');
  if (!on) {
    if (ownNoneBtn.dataset.arm === '1') unownDisarm();
    return;
  }
  const it = mkItems();
  if (focusFirst && it[0]) it[0].focus({ preventScroll: true });
  mkMenu.scrollIntoView({ block: 'nearest', behavior: 'instant' });
}
mkMore.addEventListener('click', () => mkMenuOpen(mkMenu.hidden, true));
// an item closes the menu (focus back to ⋯ first), except Untick's first tap, which asks in place for the second
mkMenu.addEventListener(
  'click',
  (e) => {
    const b = e.target.closest('button');
    // (Untick's first tap asks in place; a second within 400 ms is a double tap's, ignored there too, so it stays open)
    if (!b || (b === ownNoneBtn && (ownNoneBtn.dataset.arm !== '1' || Date.now() - unownAt < 400))) return;
    mkMenu.hidden = true;
    mkMore.setAttribute('aria-expanded', 'false');
    mkMore.focus({ preventScroll: true });
  },
  true,
);
mkMenu.addEventListener('keydown', (e) => {
  const it = mkItems(),
    k = it.indexOf(document.activeElement);
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    if (it.length) it[(k + (e.key === 'ArrowDown' ? 1 : it.length - 1)) % it.length].focus();
  } else if (e.key === 'Home' || e.key === 'End') {
    e.preventDefault();
    if (it.length) it[e.key === 'Home' ? 0 : it.length - 1].focus();
  } else if (e.key === 'Tab') mkMenuOpen(false);
});
document.addEventListener(
  'pointerdown',
  (e) => {
    if (!mkMenu.hidden && !mkMoreWrap.contains(e.target)) mkMenuOpen(false);
  },
  true,
);
addLayer({
  name: 'Markers: the ⋯ menu',
  order: 6,
  isOpen: () => !mkMenu.hidden,
  close: () => {
    const back = mkMenu.contains(document.activeElement);
    mkMenuOpen(false);
    if (back) mkMore.focus({ preventScroll: true });
  },
});
// Back up & restore is in the Library: it opens there, at its backup buttons
// (after the dialog has noted what opened it, ⋯, for focus to go back to, and put its own first focus)
function libBackupGo() {
  openLibrary();
  setTimeout(() => {
    const b = $('guidesBackup');
    if (!b || !savedOverlay.classList.contains('on')) return;
    b.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    b.focus({ preventScroll: true });
  }, 40);
}
function openSetsPanel() {
  const b = $('presetBody'),
    h = $('presetHdr');
  if (b && b.style.display === 'none' && h) h.click();
  const w = $('presetWrap');
  if (w && w.scrollIntoView)
    setTimeout(() => w.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }), 60);
}
function goMarkers() {
  if (state.mode !== 'collection') {
    state.collView = 'owned';
    setMode('collection');
  }
  openSetsPanel();
}
function openBackup() {
  backupText.value = JSON.stringify({
    v: 2,
    owned: [...state.owned],
    wish: state.wish,
    ink: state.ink,
    saved: state.saved.filter(function (s) {
      return s.type !== 'guide';
    }),
  });
  backupCap.textContent = '';
  openDialog(backupOverlay);
}
{
  const _bs = $('backupShow');
  if (_bs)
    _bs.addEventListener('click', () => {
      const w = $('backupTextWrap'),
        open = w.style.display !== 'none';
      w.style.display = open ? 'none' : 'flex';
      _bs.setAttribute('aria-expanded', open ? 'false' : 'true');
      _bs.textContent = open ? 'Markers & palettes as text (copy / paste)' : 'Hide text';
    });
}
backupBtn.addEventListener('click', libBackupGo);
// (the Library's line under Back up / Restore: the markers and palettes as text, to copy or paste)
$('libBkText').addEventListener('click', () => {
  openBackup();
  const w = $('backupTextWrap'),
    bs = $('backupShow');
  if (w && w.style.display === 'none' && bs) bs.click();
});
backupClose.addEventListener('click', () => closeDialog(backupOverlay));
backupOverlay.addEventListener('click', (e) => {
  if (e.target === backupOverlay) closeDialog(backupOverlay);
});
backupCopy.addEventListener('click', async () => {
  const ok = await copyText(backupText.value);
  backupCap.textContent = ok ? 'Copied to clipboard.' : 'Couldn’t copy — select the text and copy manually.';
});
backupDownload.addEventListener('click', () => {
  backupAll('backupDownload');
});
backupImport.addEventListener('click', () => backupFile.click());
backupFile.addEventListener('change', (e) => {
  const f = e.target.files && e.target.files[0];
  if (!f) return;
  restoreAny(f, 'backupImport');
  backupFile.value = '';
});
// the text box is for markers and palettes only (guides are too big to copy and paste)
backupRestore.addEventListener('click', () => {
  try {
    const o = JSON.parse(backupText.value.trim());
    const arr = Array.isArray(o) ? o : o && Array.isArray(o.owned) ? o.owned : null;
    if (!arr) throw 0;
    askReplaceMarkers(o).then(function (rep) {
      if (rep === null) {
        backupCap.textContent = 'Nothing restored.';
        return;
      }
      let r = null;
      try {
        r = applyCollectionBackup(o, undefined, rep);
      } catch (_) {
        r = null;
      }
      if (!r) {
        backupCap.textContent = 'That doesn\u2019t look like a valid backup. Paste the full text you copied.';
        return;
      }
      if (r.failed) {
        backupCap.textContent = RESTORE_FULL;
        return;
      }
      const said = restoredWords(r);
      if (!r.mk) {
        if (said) toast(said);
        return;
      }
      closeDialog(backupOverlay);
      toast(said);
    });
  } catch (e) {
    backupCap.textContent = 'That doesn\u2019t look like a valid backup. Paste the full text you copied.';
  }
});
