// (v318.13) the photo tips again (60-persist.js photoTips)
const PT_LINK = '<button type="button" class="sflink" data-pttips="1">Photo tips</button>';
function isDemo() {
  return !!(api.isDemo && api.isDemo());
}
function metaText() {
  const ny = coll.filter((m) => m.brand === 'Ohuhu').length,
    nc = coll.filter((m) => m.brand === 'Copic').length;
  if (isDemo())
    return (
      'You haven\u2019t added your markers yet, so guides use the full Ohuhu + Copic range (' +
      coll.length +
      ' markers). <button class="sflink" data-gomk="1">Add markers</button> to match what you own. ' +
      PT_LINK
    );
  // (only the brands you have: "120 Ohuhu", not "120 Ohuhu, 0 Copic", v287)
  const br =
    (ny && nc ? ': ' + ny + ' Ohuhu, ' + nc + ' Copic' : nc ? ' (Copic)' : ny ? ' (Ohuhu)' : '') + '. ';
  return (
    '<b>' +
    coll.length +
    (coll.length === 1 ? '</b> marker' : '</b> markers') +
    ' from your collection' +
    br +
    'Lay the page flat in even light, and get all of it in the frame. ' +
    PT_LINK
  );
}
// The Resume card offers the new guide kept in the autosave slot. Dismiss only hides it for this visit (the slot
// stays, and the next new guide adds it to the Library first); Resume puts the open guide away first, as opening
// anything does, unless the slot is that guide.
let _resumeHid = false;
function maybeShowResume() {
  let meta = null;
  try {
    meta = JSON.parse(localStorage.getItem('ms-guide-auto') || 'null');
  } catch (_) {}
  const el = document.getElementById('sfResume');
  if (!el) return;
  if (!meta || _resumeHid) {
    el.style.display = 'none';
    return;
  }
  if (!meta.dirty) {
    el.style.display = 'none';
    return;
  }
  var nm =
    typeof meta.name === 'string' && meta.name && !/^(Guide|Colour guide)$/.test(meta.name)
      ? meta.name
      : evoName(
          (Array.isArray(meta.keys) ? meta.keys : []).map(function (k) {
            var _i = keyIdx(k);
            return _i != null && COLORS[_i] ? COLORS[_i].hex : null;
          }),
        ) || 'Colouring guide';
  nm = esc(nm || 'Guide');
  var _t = new Date(meta.ts || Date.now()),
    _tm = _t.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
    _yd = _t.toDateString() === new Date(Date.now() - 86400000).toDateString(),
    _sd = _t.toDateString() === new Date().toDateString(),
    when = _sd
      ? 'Today at ' + _tm
      : _yd
        ? 'Yesterday at ' + _tm
        : _t.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' at ' + _tm;
  el.style.display = '';
  el.innerHTML =
    '<div class="resumecard"><div class="rsq">Resume your last session?</div><div class="rsnm">' +
    nm +
    '</div><div class="rswhen">Last edited ' +
    when +
    '</div><div class="rsrow"><button id="sfResumeGo" class="btn-primary">Resume</button><button id="sfResumeNo">Dismiss</button></div></div>';
  var go = document.getElementById('sfResumeGo');
  if (go)
    go.addEventListener('click', function () {
      el.style.display = 'none';
      const mine = !!assignData && _slotTok === _gTok;
      (mine
        ? (flushAutosave(), slotOp(function () {})).then(function () {
            return true;
          })
        : stashDirty()
      )
        .then(function (ok) {
          if (ok === false) return;
          return IDB.get('guide-autosave').then(function (d) {
            if (d) {
              setMode('sections');
              openDesignObj(
                Object.assign({}, d.payload || {}, { name: d.name, W: d.W, H: d.H }),
                d.savedId || null,
                true,
              );
            } else note('Nothing to resume.');
          });
        })
        .catch(function (e) {
          errLog('Resuming', e);
          note('Couldn’t resume.');
        });
    });
  var no = document.getElementById('sfResumeNo');
  if (no)
    no.addEventListener('click', function () {
      _resumeHid = true;
      el.style.display = 'none';
      el.innerHTML = '';
    });
}
function thumbFor(id) {
  return Promise.resolve(api.loadDesign ? api.loadDesign(id) : null)
    .then(function (d) {
      if (!d || !d.lmap) return '';
      return new Promise(function (res) {
        var im = new Image();
        im.onload = function () {
          try {
            var dw = d.W || im.width,
              dh = d.H || im.height,
              c = document.createElement('canvas');
            c.width = dw;
            c.height = dh;
            var g = c.getContext('2d');
            g.drawImage(im, 0, 0);
            var id2 = g.getImageData(0, 0, dw, dh),
              p = id2.data,
              sa = d.assign || {},
              cache = {};
            for (var j = 0; j < p.length; j += 4) {
              var v = p[j] | (p[j + 1] << 8) | (p[j + 2] << 16),
                col;
              if (v === 0) col = LINE;
              else {
                var k = v - 1;
                col = cache[k];
                if (!col) {
                  var info = sa[k] && api.markerInfo ? api.markerInfo(sa[k]) : null;
                  col = cache[k] = info ? hexRgb(info.hex) : PAPER;
                }
              }
              p[j] = col[0];
              p[j + 1] = col[1];
              p[j + 2] = col[2];
              p[j + 3] = 255;
            }
            g.putImageData(id2, 0, 0);
            var ts = thumbSize(dw, dh),
              tw = ts[0],
              tth = ts[1],
              t = document.createElement('canvas');
            t.width = tw;
            t.height = tth;
            var tg = t.getContext('2d');
            tg.imageSmoothingEnabled = true;
            tg.imageSmoothingQuality = 'high';
            tg.drawImage(c, 0, 0, tw, tth);
            freeCanvas(c);
            var url = t.toDataURL('image/jpeg', 0.6);
            freeCanvas(t);
            res(url);
          } catch (e) {
            res('');
          }
        };
        im.onerror = function () {
          res('');
        };
        im.src = d.lmap;
      });
    })
    .catch(function () {
      return '';
    });
}
function hasGuide() {
  return !!assignData;
}
// the open guide, for the shell's questions (Palette's Use in a guide, v288): its name, how many sections have ink on
// the paper, and whether every one is ticked
function guideBrief() {
  if (!assignData) return null;
  return {
    id: curId,
    name: curName || 'this guide',
    inked: progressCount(),
    done: pageDone(),
    n: assignData.N,
  };
}
function showHome() {
  closeSheet();
  var w = document.getElementById('sfWork');
  if (w) w.style.display = 'none';
  workOn(false);
  var s = document.getElementById('sfStart');
  if (s) s.style.display = '';
  renderRecent();
  var rz = document.getElementById('sfResume');
  if (rz && rz.innerHTML.trim()) rz.style.display = '';
}
// (v300) the start card's picture, the sample page and its guide, until there's a guide of one's own: then just the
// words (Home's renderRecent says which, as guides are saved and deleted)
function startPic(on) {
  var s = document.getElementById('sfStart'),
    p = document.getElementById('sfStPic');
  if (!s || !p) return;
  if (on === undefined)
    on = !state.saved.some(function (g) {
      return g.type === 'guide';
    });
  s.classList.toggle('compact', !on);
  if (on && !p.firstChild) p.innerHTML = sampleBA();
  else if (!on && p.firstChild) p.innerHTML = '';
}
function enterWork() {
  workEl.style.display = '';
  workOn(true);
  var s = document.getElementById('sfStart');
  if (s) s.style.display = 'none';
  if (state.mode !== 'sections') setMode('sections');
}
function mount() {
  root.innerHTML =
    '<div class="sfcard compact" id="sfStart"><button type="button" id="sfStPic" class="sfstpic" tabindex="-1" aria-hidden="true"></button><div class="sfstbody"><button id="sfHelpQ0" class="hlpq" data-help="sheet" aria-label="Help"><span aria-hidden="true">?</span></button><h2>New colouring guide</h2><div class="sftag">Turn a photo of a colouring page into a marker-by-number guide, built from the markers you own.</div><div id="sfPalNote"></div><div class="sfmeta" id="sfMeta"></div>' +
    '<div class="sfstrow"><button id="sfPick" class="btn-primary sfstpick">Choose a colouring page</button><button id="sfSample" class="sfstbtn">Try the sample</button><button id="sfLib" class="sfstbtn">Library</button><button id="sfImport" class="sfstbtn">Import a guide</button></div>' +
    // (v313) a colouring page that came as a PDF: opened on its own (the photo picker takes pictures only)
    '<div class="sfstpdf">Colouring page in a PDF? <button type="button" id="sfPdf" class="sflink">Open the PDF</button></div>' +
    // (v325) any other photo, made into a colouring page (47-photo-page)
    '<div class="sfstpdf" id="sfStPp">Any other photo? <button type="button" id="sfPpPick" class="sflink">Make a colouring page from it</button></div></div></div>' +
    '<div class="sfcard" id="sfWork" style="display:none"><div id="sfHead" class="sfhead"></div><div id="sfView"><div id="sfPicBox" class="sfpicbox"><div id="sfPic" class="sfpic"><canvas id="sfCanvas" role="img" aria-label="Colouring page"></canvas></div></div>' +
    toolsHTML() +
    '<button id="sfFullX" class="sfz sffullx" aria-label="Close full screen">' +
    ic('x') +
    '</button></div>' +
    '<div id="sfCtl"></div></div>' +
    '<div id="sfLive" class="sfsr" aria-live="polite"></div><input type="file" id="sfFile" class="fileinput" accept="image/*"><input type="file" id="sfPdfFile" class="fileinput" accept="application/pdf,.pdf"><input type="file" id="sfImpFile" class="fileinput" accept="application/json,.json"><input type="file" id="sfPpFile" class="fileinput" accept="image/*">';
  metaEl = document.getElementById('sfMeta');
  root.addEventListener('click', function (e) {
    if (e.target.closest('[data-gomk]') && api.goMarkers) api.goMarkers();
    if (e.target.closest('[data-pttips]')) photoTips(null, true);
    if (e.target.closest('[data-clearpal]')) clearPal();
  });
  workEl = document.getElementById('sfWork');
  sfView = document.getElementById('sfView');
  picBox = document.getElementById('sfPicBox');
  picEl = document.getElementById('sfPic');
  headEl = document.getElementById('sfHead');
  cv = document.getElementById('sfCanvas');
  ctx = cv.getContext('2d');
  ctlEl = document.getElementById('sfCtl');
  fileEl = document.getElementById('sfFile');
  metaEl.innerHTML = metaText();
  renderControls();
  document.getElementById('sfPick').addEventListener('click', function () {
    if (photoTips(null)) return;
    _pickCb = null;
    fileEl.click();
  });
  // (v318.13) the warning box's Choose another photo: the picker opened in the tap itself, as Home's is (iOS)
  ctlEl.addEventListener('click', function (e) {
    if (!e.target.closest) return;
    // (v325: the warning's Make a colouring page from it instead, 47-photo-page)
    if (e.target.closest('#sfPpFrom')) {
      ppFromPicture();
      return;
    }
    if (!e.target.closest('#sfRetake')) return;
    _pickCb = null;
    fileEl.click();
  });
  var _smp = document.getElementById('sfSample');
  if (_smp) _smp.addEventListener('click', loadSample);
  document.getElementById('sfStPic').addEventListener('click', loadSample);
  startPic();
  document.getElementById('sfLib').addEventListener('click', function () {
    if (api.openLibrary) api.openLibrary();
  });
  const onFile = function (e) {
    const f = e.target.files && e.target.files[0],
      cb = _pickCb;
    _pickCb = null;
    if (f && cb) cb();
    if (f) loadImage(f);
    e.target.value = '';
  };
  fileEl.addEventListener('change', onFile);
  // (v313) Open the PDF: its own picker, for PDFs (21-pdf)
  const pdfEl = document.getElementById('sfPdfFile'),
    pdfB = document.getElementById('sfPdf');
  if (pdfEl) pdfEl.addEventListener('change', onFile);
  if (pdfB && pdfEl)
    pdfB.addEventListener('click', function () {
      _pickCb = null;
      pdfEl.click();
    });
  // (v325) a photo to make a colouring page from: its own picker (47-photo-page)
  const ppEl = document.getElementById('sfPpFile'),
    ppB = document.getElementById('sfPpPick');
  if (ppEl)
    ppEl.addEventListener('change', function (e) {
      const f = e.target.files && e.target.files[0];
      e.target.value = '';
      if (f) ppPicked(f);
      else _ppPickCb = null;
    });
  if (ppB)
    ppB.addEventListener('click', function () {
      ppPick(null);
    });
  var _imp = document.getElementById('sfImport'),
    _impF = document.getElementById('sfImpFile');
  if (_imp && _impF) {
    _imp.addEventListener('click', function () {
      _impF.click();
    });
    _impF.addEventListener('change', function (e) {
      const f = e.target.files && e.target.files[0];
      if (f) importGuideFile(f);
      e.target.value = '';
    });
  }
  cv.addEventListener(
    'wheel',
    function (e) {
      if (cropMode || pgMode || !labels) return;
      if (photoAlign && sfmode === 'guide' && family === 'photo' && photoRef) {
        photoWheel(e);
        return;
      }
      const q = picLocal(e.clientX, e.clientY),
        cx = q.x - cv.offsetLeft,
        cy = q.y - cv.offsetTop;
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        setZoom(zoom * Math.exp(-e.deltaY * 0.01), cx, cy);
      } else if (zoom > 1 || focus) {
        e.preventDefault();
        panX -= e.deltaX;
        panY -= e.deltaY;
        clampPan();
        applyXform();
      }
    },
    { passive: false },
  );
  cv.addEventListener('pointerdown', onDown);
  // while lining up, the photo can be grabbed anywhere it shows, not only over the drawing: with Fill it reaches past
  // the drawing's sides (the canvas then takes the pointer: photoPtr captures it)
  sfView.addEventListener('pointerdown', function (e) {
    if (e.target === cv || !photoAlign || sfmode !== 'guide' || family !== 'photo' || !photoRef) return;
    if ((e.pointerType === 'mouse' && e.button !== 0) || (e.target.closest && e.target.closest('button')))
      return;
    photoPtr(e, 'down');
  });
  cv.addEventListener('contextmenu', function (e) {
    if (sfmode === 'guide' && family === 'blend' && !shadeFlatMode && labels && assignData) {
      e.preventDefault();
      const P = evPt(e);
      if (P.x < 0 || P.y < 0 || P.x >= W || P.y >= H) return;
      const l = labels[P.y * W + P.x];
      if (l > 0 && (assignData.assign[l] || whitePins[l] !== undefined)) {
        clearTimeout(lpT);
        lpFired = ptrs.size > 0;
        holdSec(l);
      }
      return;
    }
    if (sfmode !== 'color' || focus) return;
    e.preventDefault();
    const P = evPt(e);
    if (P.x < 0 || P.y < 0 || P.x >= W || P.y >= H) return;
    const l = labels[P.y * W + P.x];
    if (l > 0) {
      _holdAt = Date.now();
      findInList(l);
    }
  });
  cv.addEventListener('pointermove', onMove);
  cv.addEventListener('pointerup', onUp);
  cv.addEventListener('pointercancel', onUp);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && sfmode === 'color') reqWake();
    if (document.visibilityState === 'hidden') flushAutosave();
    // the browser may drop the picture's pixels while the app is in the background: redraw it whole on return
    if (document.visibilityState === 'visible') {
      _rg = null;
      if (assignData && (sfmode === 'guide' || sfmode === 'color') && !dragPreview) renderGuide();
    }
  });
  if (ctlEl) {
    ctlEl.addEventListener('pointerdown', function (e) {
      if (e.target && e.target.type === 'range') holdControls(true);
    });
    ['pointerup', 'pointercancel'].forEach(function (ev) {
      document.addEventListener(ev, function () {
        if (_rcHeld)
          setTimeout(function () {
            holdControls(false);
          }, 0);
      });
    });
  }
  // Escape (layers.js): the marker picker's sheet the same way as its Cancel button, any other sheet, then the tip over
  // a tapped section; focus mode's Colours sheet, then focus mode itself; Reveal, then full screen. A dialog open over
  // them has Escape first, and the name field keeps its own (it cancels the rename).
  addLayer({
    name: 'marker picker',
    back: true,
    order: 60,
    isOpen: popOpen,
    close: function () {
      const c = document.getElementById('sfPopCancel');
      if (c) c.click();
      else closeSwatchPop();
    },
  });
  addLayer({
    name: 'sheet',
    back: true,
    order: 50,
    isOpen: sheetOpen,
    close: function () {
      closeSheet();
    },
  });
  // (v318 review) the photo's editors in Check the sections: Escape leaves Adjust corners and Crop as their Cancel
  // does (a keyboard on an iPad, or a computer), as it leaves the zone editor; not the first corners, when the page
  // wasn't found (Keep as is is a choice, not a cancel). Escape only: Back is left as it was (no entry is made).
  // (v318 audit) Only while the Guide screen shows: they stay open when another tab is chosen, and an Escape on
  // Markers had cancelled a crop out of sight instead of closing Markers' ⋯ menu
  const shown = function () {
    return !!root && root.style.display !== 'none' && !!root.offsetParent;
  };
  addLayer({
    name: 'Adjust corners',
    order: 36,
    isOpen: function () {
      return shown() && !!(pgMode && pgEd && pgEd.how === 'adjust');
    },
    close: function () {
      pgCancelAdjust();
    },
  });
  addLayer({
    name: 'crop',
    order: 36,
    isOpen: function () {
      return shown() && !!cropMode;
    },
    close: function () {
      cancelCrop();
    },
  });
  addLayer({
    name: 'zone editor',
    order: 35,
    isOpen: function () {
      return shown() && zoneEditOn();
    },
    close: function () {
      zoneNameCommit();
      zoneEditEnd();
    },
  });
  // (v306) Colour along's code box: a code in it, or a search run, is cleared first
  addLayer({
    name: 'code box',
    order: 45,
    isOpen: findOpen,
    close: function () {
      findClear();
    },
  });
  // (v306) "Did any run low?" › Another…'s box: a code in it is cleared, then it closes
  addLayer({
    name: 'run-low box',
    order: 46,
    isOpen: function () {
      // (Escape in Colour along's own code box is that box's)
      const ae = document.activeElement;
      return !(ae && ae.id === 'sfFindIn') && !!lowBoxOpen();
    },
    close: function () {
      lowBoxEsc();
    },
  });
  addLayer({
    name: 'section tip',
    order: 40,
    isOpen: function () {
      return tipL >= 0 && !!tipEl;
    },
    close: function () {
      hideTip();
    },
  });
  // focus mode leaves an Escape from a form field in it alone, as it does its other keys
  const inField = function (e) {
    const tn = e.target && e.target.tagName;
    return tn === 'INPUT' || tn === 'TEXTAREA' || tn === 'SELECT';
  };
  // (v313) the hand-off card in Focus mode: Escape closes it, as a tap does (not Back: it makes no entry)
  addLayer({
    name: 'focus hand-off',
    order: 32,
    isOpen: function () {
      return focus && sfmode === 'color' && handOn();
    },
    close: function (e) {
      if (inField(e)) return false;
      handClose(true);
    },
  });
  addLayer({
    name: 'focus sheet',
    back: true,
    order: 30,
    isOpen: function () {
      return focus && sfmode === 'color' && focusSheet;
    },
    close: function (e) {
      if (inField(e)) return false;
      focusSheetSet(false);
    },
  });
  addLayer({
    name: 'focus mode',
    back: true,
    order: 20,
    isOpen: function () {
      return focus && sfmode === 'color';
    },
    close: function (e) {
      if (inField(e)) return false;
      exitFocus(true);
    },
  });
  addLayer({
    name: 'Reveal',
    back: true,
    order: 12,
    isOpen: function () {
      return root.classList.contains('sfrev');
    },
    close: function () {
      revClose();
    },
  });
  // (v308: Escape leaves Colour along as Back does, once nothing is open over it; v289 left it to Back only. Not from
  // a box being typed in: the code box's own Escape empties it and keeps it, a second one stays too)
  addLayer({
    name: 'Colour along',
    order: 4,
    back: true,
    isOpen: function () {
      return sfmode === 'color' && !!root && root.style.display !== 'none' && !!root.offsetParent;
    },
    close: function (e) {
      if (e && e.key === 'Escape' && inField(e)) return false;
      exitColor();
    },
  });
  addLayer({
    name: 'full screen',
    back: true,
    order: 10,
    isOpen: function () {
      return root.classList.contains('sffull');
    },
    close: function () {
      exitFull();
    },
  });
  // the picture eases to a new size: overlays and the sticky offset measured at the start of that would be off,
  // so measure again once it has settled
  // (v318.30: the overlays' pass is settleNow's too, when transitionend never comes)
  function placeOverlays() {
    if (sunEl || radEl) positionSun();
    if (photoEl) positionPhoto();
    if (zoneEl) positionZones();
    if (roughEl) positionRough();
    if (speckEl) positionSpecks();
    if (tipL >= 0) positionTip();
    if (olSet) positionOutline();
  }
  if (cv)
    cv.addEventListener('transitionend', function (e) {
      if (e.propertyName !== 'width' && e.propertyName !== 'height') return;
      sizeCanvas();
      placeOverlays();
    });
  if (cv)
    ['contextlost', 'contextrestored'].forEach(function (ev) {
      cv.addEventListener(ev, function () {
        _rg = null;
        if (ev === 'contextrestored' && pgMode) {
          pgDraw();
          return;
        }
        if (ev === 'contextrestored' && assignData && (sfmode === 'guide' || sfmode === 'color'))
          renderGuide();
      });
    });
  window.addEventListener('pagehide', function () {
    flushAutosave();
    saveOnLeave();
  });
  // (v318 polish) a reload or a tab closed: the save waiting to happen starts as the page is asked to go, before the
  // next page is fetched (pagehide comes only as that one replaces it: in Chromium a new guide's first save begun then
  // was lost, its database write dropped with the page). Nothing is asked of the person.
  window.addEventListener('beforeunload', function () {
    flushAutosave();
  });
  [sfView, picBox].forEach(function (el) {
    el.addEventListener('scroll', function () {
      if (el.scrollTop || el.scrollLeft) {
        el.scrollTop = 0;
        el.scrollLeft = 0;
      }
    });
  });
  frameInit();
  // focus mode's keys: → skips, ← goes back, Enter or Space ticks; Tab stays inside it (its Escape is a layer, above).
  // A dialog open over it (Help) has the keys first.
  document.addEventListener(
    'keydown',
    function (e) {
      if (!focus || sfmode !== 'color' || e.defaultPrevented || dialogOpen()) return;
      if (e.key === 'Tab') {
        focusTab(e);
        return;
      }
      var tg = e.target,
        tn = tg && tg.tagName;
      if (tn === 'INPUT' || tn === 'TEXTAREA' || tn === 'SELECT') return;
      if (focusFin) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        focusSkip();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        focusBack();
      } else if ((e.key === 'Enter' || e.key === ' ') && tn !== 'BUTTON') {
        e.preventDefault();
        focusDone();
      }
    },
    true,
  );
  // (in Focus mode, + and − zoom about the section it's on while that shows, else the middle of the view: v308, the
  // section at the top went off the screen as it zoomed about the middle)
  var _zc = function () {
    if (!focus || !sfView) return [];
    var g = focusGeo(true),
      l = focusCur();
    if (l >= 0) {
      var sx = panX + ((focusBox.x0[l] + focusBox.x1[l] + 1) / 2 / W) * cv.offsetWidth * zoom,
        sy = panY + ((focusBox.y0[l] + focusBox.y1[l] + 1) / 2 / H) * cv.offsetHeight * zoom,
        vx = sx + cv.offsetLeft,
        vy = sy + cv.offsetTop;
      if (vx >= 0 && vx <= g.aw && vy >= g.t && vy <= g.t + g.ah) return [sx, sy];
    }
    return [g.cx - cv.offsetLeft, g.cy - cv.offsetTop];
  };
  cv.style.transition = '';
  document.getElementById('sfZin').addEventListener('click', function () {
    var c = _zc();
    setZoom(zoom * 1.5, c[0], c[1]);
  });
  document.getElementById('sfZout').addEventListener('click', function () {
    var c = _zc();
    setZoom(zoom / 1.5, c[0], c[1]);
  });
  document.getElementById('sfZrst').addEventListener('click', function () {
    if (focus && focusCur() >= 0) {
      frameFocus(true);
      return;
    }
    resetZoom();
  });
  document.getElementById('sfFull').addEventListener('click', enterFull);
  // (v320) Focus mode's Colours sheet open: a tap on the frame round the page closes it too, as one on the page does
  // (held sideways the page is narrower than its column, beside the rail)
  sfView.addEventListener('click', function (e) {
    if (focus && focusSheet && e.target === sfView) focusSheetSet(false);
  });
  document.getElementById('sfFullX').addEventListener('click', exitFull);
  // focus mode, the screen another shape: the picture fitted and framed again for it
  // (v318.30: from the resize handler, and from settleNow when the settled size differs)
  function resizeFocus() {
    fitFocus();
    if (focusCur() >= 0) {
      focusZ = focusZoomFor(focusCur());
      // (v315: the hand-off card up: placed again for the new shape)
      if (handOn()) handReframe();
      else frameFocus(false);
      renderGuide();
    } else {
      zoom = 1;
      panX = 0;
      panY = 0;
      applyXform();
    }
  }
  // turning into side by side pins the picture, as opening a guide that way does
  window.addEventListener('resize', function () {
    const _sd = geo.side;
    sizeCanvas();
    if (geo.side && !_sd) requestAnimationFrame(pinPicture);
    if (sunEl || radEl) requestAnimationFrame(positionSun);
    if (tipL >= 0) requestAnimationFrame(positionTip);
    if (olSet) requestAnimationFrame(positionOutline);
    if (photoEl) requestAnimationFrame(positionPhoto);
    var rt = document.getElementById('sfRoot');
    if (rt && rt.classList.contains('sffoc')) requestAnimationFrame(resizeFocus);
    settleSoon();
  });
  // (v318.30) A settle pass a moment after the last resize (and a turn: orientationchange, the visual viewport's
  // resize). Above, the overlays are placed a frame after the resize, while the picture is still easing to its size
  // (04-guide.css: 0.18 s), and the picture's transitionend puts them right; but Safari doesn't always send it as a
  // phone turns, or sends resize before the screen has its final size, and then the outlines, rings and zones stayed
  // where the easing picture had been, the rough rings not placed at all, once the layout itself stale (side by side's
  // sftoolsv, a landscape-size picture in portrait; v318.29 Q3). Cheap: the sizes measured again, the picture laid
  // again only when its size or the layout differs, then the overlays as transitionend has them. Not with a finger
  // down (a Paint stroke, a pinch) or the iPad's keyboard up over the code box (findKbd sizes it as that goes): a
  // moment later. Still easing (the size on the screen isn't the one set): the next pass, a few at most.
  // (v318.30, from GitHub's run: with the keyboard up it had armed itself again every 250 ms for as long as the
  // keyboard stayed, a timer that never ended (the page never idle). Now it waits without a timer: the finger lifted
  // (pointerup) or the keyboard going down (focusout, and the visual viewport's resize) brings it back.)
  let _stlT = 0,
    _stlN = 0,
    _stlWait = false;
  function settleSoon() {
    clearTimeout(_stlT);
    _stlT = setTimeout(settleNow, 250);
  }
  function settleNow() {
    _stlT = 0;
    if (!cv || !workEl || workEl.style.display === 'none' || root.style.display === 'none') {
      _stlN = 0;
      return;
    }
    if (ptrs.size || workEl.classList.contains('sfkbd')) {
      _stlWait = true;
      return;
    }
    _stlWait = false;
    const ow = cv.style.width,
      oh = cv.style.height,
      sd = geo.side,
      tv = workEl.classList.contains('sftoolsv');
    sizeCanvas();
    const changed =
      cv.style.width !== ow ||
      cv.style.height !== oh ||
      geo.side !== sd ||
      tv !== workEl.classList.contains('sftoolsv');
    if (changed) {
      if (geo.side && !sd) pinPicture();
      if (root.classList.contains('sffoc')) resizeFocus();
    }
    const want = parseFloat(cv.style.width);
    if (want > 0 && Math.abs(cv.offsetWidth - want) > 1 && _stlN < 4) {
      _stlN++;
      settleSoon();
      return;
    }
    _stlN = 0;
    placeOverlays();
  }
  window.addEventListener('orientationchange', settleSoon);
  ['pointerup', 'pointercancel', 'focusout'].forEach(function (ev) {
    window.addEventListener(ev, function () {
      if (_stlWait) settleSoon();
    });
  });
  try {
    if (window.visualViewport) window.visualViewport.addEventListener('resize', settleSoon);
  } catch (_) {}
  planInit();
  maybeShowResume();
  renderRecent();
}
// coming back to the guide screen: leave() took the picture's sizes away (--pinH 0) while it was hidden, so they are
// measured again once it shows (and side by side the picture is pinned); Colour along keeps the screen on again
function enter() {
  root.style.display = '';
  if (!document.getElementById('sfPick')) mount();
  else {
    if (metaEl) metaEl.innerHTML = metaText();
    renderControls();
    // (v310.2: markers marked dry or unticked meanwhile, their sections' stand-ins drawn and said: 97-open)
    if (_standDraw || _standSay) standInsShow();
  }
  palNote();
  if (planLast) planLast.filt = planFilt();
  if (sfmode === 'color' && assignData && workEl && workEl.style.display !== 'none') reqWake();
  requestAnimationFrame(function () {
    if (!workEl || workEl.style.display === 'none' || root.style.display === 'none') return;
    sizeCanvas();
    picScroll();
    paneMin();
    fitHead();
    fitBar();
    planFit();
    if (sideBySide()) pinPicture();
    // (the codes were on their own canvas, zoomed in, and leave() handed it back: drawn again, v296)
    if (assignData && _rg && _rg.hiK && (!labHi || !labHi.width)) {
      _rg = null;
      renderGuide();
    }
  });
}
// the collection or Brands I'd buy changed in another tab while the guide is showing: what it suggests follows at
// once (shading's and the blend plan's markers to buy, the Photo pattern's, the header's count), as entering it again
// would have it; nothing is laid again (v304)
function collRefresh() {
  if (!document.getElementById('sfPick') || root.style.display === 'none') return;
  if (metaEl) metaEl.innerHTML = metaText();
  renderControls();
  if (sfmode === 'color') renderAlong();
}
function leave() {
  exitFull();
  hideTip();
  if (focus) exitFocus();
  // (Reveal open, or its animation running: its bar stays in the page, hidden, after it closes)
  if (revealF != null || root.classList.contains('sfrev')) endReveal();
  // (a colour only being tried in Change colour isn't kept by going elsewhere: as Cancel, as a reload, v289)
  if (popCtx) {
    const pc = popCtx;
    pc._cancel = true;
    if (pc.onCancel) pc.onCancel();
    closeSwatchPop();
  }
  closeSheet();
  // (the sharp codes' canvas, up to 12 million pixels when zoomed in, isn't kept while elsewhere: enter() draws it
  // again on return, v296)
  labHiOff();
  // (a save waiting its moment is made now: Home, which may be next, then shows the guide as it is, v289)
  if (autoT && !pickPending()) doAutosave(true);
  relWake();
  workOn(false);
  document.documentElement.style.setProperty('--pinH', '0px');
  focus = false;
  if (sfView) sfView.style.paddingTop = sfView.style.paddingBottom = '';
  root.classList.remove('sffoc');
  root.style.display = 'none';
}
