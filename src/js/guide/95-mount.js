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
      ' markers). <button class="sflink" data-gomk="1">Add markers</button> to match what you own.'
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
    'Choose a page photo to detect its colourable sections.'
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
        .catch(function () {
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
            var tw = 140,
              tth = Math.max(1, Math.round((tw * dh) / dw)),
              t = document.createElement('canvas');
            t.width = tw;
            t.height = tth;
            var tg = t.getContext('2d');
            tg.imageSmoothingEnabled = true;
            tg.drawImage(c, 0, 0, tw, tth);
            freeCanvas(c);
            var url = t.toDataURL('image/jpeg', 0.62);
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
function enterWork() {
  workEl.style.display = '';
  workOn(true);
  var s = document.getElementById('sfStart');
  if (s) s.style.display = 'none';
  if (state.mode !== 'sections') setMode('sections');
}
function mount() {
  root.innerHTML =
    '<div class="sfcard" id="sfStart"><button id="sfHelpQ0" class="hlpq" data-help="sheet" aria-label="Help"><span aria-hidden="true">?</span></button><h2>New colouring guide</h2><div class="sftag">Turn a line-art photo into a marker-by-number guide built from the markers you own \u2014 complete with blend companions and a To buy list for shades you still need.</div><div id="sfPalNote"></div><div class="sfmeta" id="sfMeta"></div>' +
    '<div class="sfstrow"><button id="sfPick" class="btn-primary sfstpick">Choose a photo</button><button id="sfSample" class="sfstbtn">Try the sample</button><button id="sfLib" class="sfstbtn">Library</button><button id="sfImport" class="sfstbtn">Import a guide</button></div></div>' +
    '<div class="sfcard" id="sfWork" style="display:none"><div id="sfHead" class="sfhead"></div><div id="sfView"><div id="sfPicBox" class="sfpicbox"><div id="sfPic" class="sfpic"><canvas id="sfCanvas" role="img" aria-label="Colouring page"></canvas></div></div>' +
    toolsHTML() +
    '<button id="sfFullX" class="sfz sffullx" aria-label="Close full screen">' +
    ic('x') +
    '</button></div>' +
    '<div id="sfCtl"></div></div>' +
    '<div id="sfLive" class="sfsr" aria-live="polite"></div><input type="file" id="sfFile" class="fileinput" accept="image/*"><input type="file" id="sfImpFile" class="fileinput" accept="application/json,.json">';
  metaEl = document.getElementById('sfMeta');
  root.addEventListener('click', function (e) {
    if (e.target.closest('[data-gomk]') && api.goMarkers) api.goMarkers();
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
    _pickCb = null;
    fileEl.click();
  });
  var _smp = document.getElementById('sfSample');
  if (_smp) _smp.addEventListener('click', loadSample);
  document.getElementById('sfLib').addEventListener('click', function () {
    if (api.openLibrary) api.openLibrary();
  });
  fileEl.addEventListener('change', function (e) {
    const f = e.target.files && e.target.files[0],
      cb = _pickCb;
    _pickCb = null;
    if (f && cb) cb();
    if (f) loadImage(f);
    e.target.value = '';
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
      if (l > 0 && assignData.assign[l]) {
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
  addLayer({
    name: 'zone editor',
    order: 35,
    isOpen: function () {
      return zoneEditOn();
    },
    close: function () {
      zoneNameCommit();
      zoneEditEnd();
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
  addLayer({
    name: 'focus sheet',
    back: true,
    order: 30,
    isOpen: function () {
      return focus && sfmode === 'color' && focusSheet;
    },
    close: function (e) {
      if (inField(e)) return false;
      focusSheet = false;
      renderFocusUI();
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
      exitFocus();
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
      endReveal();
    },
  });
  // (Back only, v289: Escape doesn't leave Colour along)
  addLayer({
    name: 'Colour along',
    order: 4,
    back: true,
    escape: false,
    isOpen: function () {
      return sfmode === 'color' && !!root && root.style.display !== 'none' && !!root.offsetParent;
    },
    close: function () {
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
  if (cv)
    cv.addEventListener('transitionend', function (e) {
      if (e.propertyName !== 'width' && e.propertyName !== 'height') return;
      sizeCanvas();
      if (sunEl || radEl) positionSun();
      if (photoEl) positionPhoto();
      if (zoneEl) positionZones();
      if (tipL >= 0) positionTip();
      if (olSet) positionOutline();
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
  var _zc = function () {
    if (!focus || !sfView) return [];
    var g = focusGeo();
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
  document.getElementById('sfFullX').addEventListener('click', exitFull);
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
    if (rt && rt.classList.contains('sffoc'))
      requestAnimationFrame(function () {
        fitFocus();
        if (focusCur() >= 0) {
          focusZ = focusZoomFor(focusCur());
          frameFocus(false);
          renderGuide();
        } else {
          zoom = 1;
          panX = 0;
          panY = 0;
          applyXform();
        }
      });
  });
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
