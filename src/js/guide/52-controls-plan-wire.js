// Plan's handlers, after ctlPlan has written the markup. They are wired in the order they always were (before the
// panels had functions of their own), which is why a tab's controls aren't all together: the tabs, the pattern
// chooser and the Photo pattern, Colours, the pattern's options, Share, the bar, Shading, Pin colours, texture.
function ctlPlanWire() {
  ctlWirePlanTabs();
  ctlWirePatternFamily();
  ctlWireColours();
  ctlWirePatternOptions();
  ctlWireShare();
  ctlWirePlanBar();
  ctlWireShading();
  ctlWirePin();
  ctlWireTexture();
  zoneWire();
}
function ctlWirePlanTabs() {
  var _tb = ctlEl.querySelector('.sftabs');
  if (_tb)
    _tb.addEventListener('click', function (e) {
      var b = e.target.closest('[data-t]');
      if (!b) return;
      if (paintOn && b.dataset.t !== 'pattern') {
        setPaint(false);
        planTab(b.dataset.t);
        renderControls();
        return;
      }
      planTab(b.dataset.t);
    });
}
// the pattern chooser, and the Photo pattern's photo, lining up, placing and white areas
function ctlWirePatternFamily() {
  var _fam = document.getElementById('sfFam');
  if (_fam)
    _fam.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (b) {
        family = b.dataset.v;
        if (family === 'blend' || family === 'manual') lockMode = false;
        if (family !== 'manual') setPaint(false);
        hideTip();
        closeSwatchPop(false);
        if (family === 'photo' && !photoRef) {
          renderControls();
          pickPhotoRef();
          return;
        }
        if (family !== 'photo') photoAlign = false;
        else if (!_phBumped) {
          _phBumped = true;
          if (limitN < 24) limitN = Math.min(24, sliderMax());
        }
        reassign();
        positionPhoto();
      }
    });
  // colour from a photo
  var _php = document.getElementById('sfPhPick');
  if (_php) _php.addEventListener('click', pickPhotoRef);
  var _phu = document.getElementById('sfPhAuto');
  if (_phu)
    _phu.addEventListener('click', function () {
      _phu.textContent = 'Lining up\u2026';
      _phu.disabled = true;
      setTimeout(function () {
        photoTryAutoAlign(false);
        renderControls();
      }, 30);
    });
  var _pha = document.getElementById('sfPhAlign');
  if (_pha)
    _pha.addEventListener('click', function () {
      if (photoAlign) photoEndAlign();
      else {
        photoAlign = true;
        hideTip();
        lockMode = false;
        shadeFlatMode = false;
        closeSwatchPop(false);
      }
      renderControls();
      positionPhoto();
    });
  var _phf = document.getElementById('sfPhFit');
  if (_phf)
    _phf.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      photoFit(b.dataset.v);
      guideDirty = true;
      positionPhoto();
      photoRecolour();
    });
  var _phr = document.getElementById('sfPhRough');
  if (_phr)
    _phr.addEventListener('change', function (e) {
      photoRoughOnly = e.target.checked;
      renderGuide();
    });
  var _phsu = document.getElementById('sfPhUse');
  if (_phsu) _phsu.addEventListener('click', photoSugUse);
  var _phw = document.getElementById('sfPhPaper');
  if (_phw)
    _phw.addEventListener('change', function (e) {
      photoPaper = e.target.checked;
      photoRecolour();
    });
  var _phl = document.getElementById('sfPhLight');
  if (_phl)
    _phl.addEventListener('change', function (e) {
      photoLitToggle(e.target.checked);
    });
  var _pho = document.getElementById('sfPhOp');
  if (_pho)
    _pho.addEventListener('input', function (e) {
      photoOp = +e.target.value / 100;
      positionPhoto();
    });
}
// Temperature, where the colours come from, the harmony or saved palette, Mood, how many markers, the nearby
// markers and the filters
function ctlWireColours() {
  var _pal = document.getElementById('sfPal');
  if (_pal)
    _pal.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (b) {
        palette = b.dataset.v;
        reassign();
      }
    });
  var _src = document.getElementById('sfSrc');
  if (_src)
    _src.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (b) {
        paletteSource = b.dataset.v;
        if (paletteSource === 'saved' && savedPalId == null) {
          var pl = api.listPalettes ? api.listPalettes() : [];
          if (pl.length) savedPalId = pl[0].id;
        }
        if (paletteSource === 'generate' && !genPal.length) generatePalette();
        reassign();
      }
    });
  var _hm = document.getElementById('sfHarm');
  if (_hm)
    _hm.addEventListener('change', function (e) {
      genHarmony = e.target.value;
      generatePalette();
      reassign();
    });
  var _pp = document.getElementById('sfPalPick');
  if (_pp) {
    _pp.addEventListener('change', function (e) {
      savedPalId = +e.target.value;
      reassign();
    });
  }
  // Mood: a generated palette is made again to suit it
  var _mood = document.getElementById('sfMood');
  if (_mood)
    _mood.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (b && !b.disabled && b.dataset.v !== emphasis) {
        emphasis = b.dataset.v;
        if (paletteSource === 'generate') generatePalette();
        reassign();
      }
    });
  var _mkc = document.getElementById('sfMkCount');
  if (_mkc)
    _mkc.addEventListener('input', function (e) {
      limitN = +e.target.value;
      var lb = document.getElementById('sfMkNlbl');
      if (lb) {
        var psz2 = sliderMax();
        lb.textContent = limitN >= psz2 ? 'all (' + psz2 + ')' : limitN;
      }
      clearTimeout(reTimer);
      reTimer = setTimeout(reassign, 90);
    });
  if (_mkc)
    _mkc.addEventListener('change', function () {
      planDrag = false;
      clearTimeout(reTimer);
      reassign();
    });
  var _exp = document.getElementById('sfExpand');
  if (_exp)
    _exp.addEventListener('change', function (e) {
      expand = e.target.checked;
      reassign();
    });
  var _ec = document.getElementById('sfExpChar');
  if (_ec)
    _ec.addEventListener('input', function (e) {
      expandChar = +e.target.value / 100;
      clearTimeout(reTimer);
      reTimer = setTimeout(reassign, 90);
    });
  if (_ec)
    _ec.addEventListener('change', function () {
      planDrag = false;
      clearTimeout(reTimer);
      reassign();
    });
  var _ft = document.getElementById('sfFiltToggle');
  if (_ft)
    _ft.addEventListener('click', function () {
      state.filtersOpen = !state.filtersOpen;
      save();
      renderControls();
    });
  var _fs = document.getElementById('sfFiltSlot');
  if (_fs && api.renderFilters) api.renderFilters(_fs);
}
// Flow, Direction and Look, Shuffle, Fill, Paint and the brush, Random's and Blend's options
function ctlWirePatternOptions() {
  var _shp = document.getElementById('sfShape');
  if (_shp)
    _shp.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (b) {
        gradShape = b.dataset.v;
        reassign();
      }
    });
  var _rr = document.getElementById('sfRadReset');
  if (_rr)
    _rr.addEventListener('click', function () {
      radC = null;
      reassign();
      positionRadC();
      ctlRefocus('#sfShape [data-v="radial"]');
    });
  var _fl = document.getElementById('sfDir');
  if (_fl)
    _fl.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (b) {
        var nd = +b.dataset.d;
        if (nd !== dir) {
          dir = nd;
          reassign();
        }
      }
    });
  // Start colour: the label follows the slider at once, the picture a moment later (as the marker count does)
  var _gs = document.getElementById('sfGStart');
  if (_gs) {
    _gs.addEventListener('input', function (e) {
      var gs = gradStartInfo();
      if (!gs) return;
      var k = Math.max(0, Math.min(gs.n - 1, +e.target.value));
      gradStartSet(k, gs.n);
      e.target.setAttribute('aria-valuetext', gradStartSay(gs, k));
      var lb = document.getElementById('sfGStartLbl'),
        nm = document.getElementById('sfGStartC');
      if (lb) lb.innerHTML = gradStartNote(gs, k);
      if (nm) nm.innerHTML = gradStartName(gs, k);
      clearTimeout(reTimer);
      reTimer = setTimeout(function () {
        planWhy = 'Start colour: ' + gradStartSay(gs, k);
        reassign();
      }, 60);
    });
    _gs.addEventListener('change', function (e) {
      planDrag = false;
      clearTimeout(reTimer);
      var gs = gradStartInfo();
      if (gs) planWhy = 'Start colour: ' + gradStartSay(gs, Math.max(0, Math.min(gs.n - 1, +e.target.value)));
      reassign();
    });
  }
  var _lk = document.getElementById('sfLook');
  if (_lk)
    _lk.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (b && b.dataset.v !== look) {
        look = b.dataset.v;
        reassign();
      }
    });
  // Shuffle: a Gradient that loops round the colour wheel turns its start by 10–90% (never almost where it was, which
  // changed only a few sections); a ramp of your markers picks others where there is a near choice (gradPlan); a
  // generated palette is made again
  function shuffleNow() {
    if (paletteSource === 'generate') generatePalette();
    if (family === 'gradient') gradSeed = (((gradSeed || 0) % 1) + 1.1 + Math.random() * 0.8) % 1;
    reassign();
  }
  var _sh = document.getElementById('sfShuffle');
  if (_sh) _sh.addEventListener('click', shuffleNow);
  var _vy = document.getElementById('sfVary');
  if (_vy) _vy.addEventListener('click', shuffleNow);
  var _fa = document.getElementById('sfFillAll');
  if (_fa) _fa.addEventListener('click', openFillPop);
  var _pt = document.getElementById('sfPaint');
  if (_pt)
    _pt.addEventListener('click', function () {
      setPaint(!paintOn);
      renderControls();
    });
  var _br = document.getElementById('sfBrush');
  if (_br) _br.addEventListener('click', openBrushPop);
  var _na = document.getElementById('sfNoAdj');
  if (_na)
    _na.addEventListener('change', function (e) {
      noAdj = e.target.checked;
      reassign();
    });
  var _sp = document.getElementById('sfSpread');
  if (_sp) {
    _sp.addEventListener('input', function (e) {
      dragPreview = true;
      blendFall = +e.target.value;
      blendNow();
      renderGuide();
    });
    _sp.addEventListener('change', function () {
      dragPreview = false;
      blendNow();
      renderGuide();
    });
  }
  // Blend's Mix
  var _mx = document.getElementById('sfMix');
  if (_mx)
    _mx.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (b && b.dataset.v !== blendMix) {
        blendMix = b.dataset.v;
        reassign();
      }
    });
  var _ra = document.getElementById('sfResetA');
  if (_ra)
    _ra.addEventListener('click', function () {
      anchors = [];
      planWhy = 'Anchors reset';
      reassign();
    });
}
function ctlWireShare() {
  var _rv = document.getElementById('sfReveal');
  if (_rv) _rv.addEventListener('click', startReveal);
  var _pl = document.getElementById('sfPlan');
  if (_pl)
    _pl.addEventListener('click', function () {
      renderBlendPlan();
      var _po = document.getElementById('sfPlanOverlay');
      if (_po) openDialog(_po);
    });
  var _ex = document.getElementById('sfExport');
  if (_ex) _ex.addEventListener('click', exportImage);
  var _prt = document.getElementById('sfPrint');
  if (_prt) _prt.addEventListener('click', openPrint);
  var _sg = document.getElementById('sfShareGuide');
  if (_sg) _sg.addEventListener('click', shareGuideFile);
  var _ap = document.getElementById('sfAsPal');
  if (_ap) _ap.addEventListener('click', saveAsPalette);
}
function ctlWirePlanBar() {
  var cbtn = document.getElementById('sfColor');
  if (cbtn) cbtn.addEventListener('click', enterColor);
  var bb = document.getElementById('sfBack2');
  if (bb)
    bb.addEventListener('click', function () {
      stageGo();
      backToReview();
    });
}
// the shading mode, the light, the sliders, sections left flat, the tone lines and the suggestions line
// a button of a row that was just drawn again keeps the keyboard's focus (renderControls keeps it by id; these have
// none), when it had it
function ctlRefocus(sel) {
  if (document.activeElement && document.activeElement !== document.body) return;
  const b = document.querySelector(sel);
  if (b)
    try {
      b.focus({ preventScroll: true });
    } catch (_) {}
}
// the whole picture's shading, then the chosen zone's own (zshSet: Main's are the variables, a zone's its record)
function ctlWireShading() {
  var _shd = document.getElementById('sfShade');
  if (_shd)
    _shd.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b || b.dataset.v === shadeMode) return;
      shadeMode = b.dataset.v;
      if (shadeMode === 'off') shadeFlatMode = false;
      guideDirty = true;
      gradFollowLight();
      normalizeTones();
      renderControls();
      renderGuide();
      ctlRefocus('#sfShade [data-v="' + shadeMode + '"]');
    });
  // Highlights and Shadows: what kind of companion marker (a highlight left as paper has no step of its own, so
  // part-done sections are brought in line)
  [
    ['sfHiStyle', 'hilite'],
    ['sfShStyle', 'shadow'],
  ].forEach(function (x) {
    var el = document.getElementById(x[0]);
    if (!el) return;
    el.addEventListener('change', function () {
      if (el.value === zsh(zoneCur)[x[1]]) return;
      zshSet(zoneCur, x[1], el.value);
      guideDirty = true;
      normalizeTones();
      renderControls();
      renderGuide();
    });
  });
  // one light for the whole picture (the sections the photo doesn't cover stay flat, and Gradient bands that faced
  // the sun face the top instead)
  var _shl = document.getElementById('sfShLight');
  if (_shl)
    _shl.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b || b.getAttribute('aria-pressed') === 'true') return;
      shadeLight = b.dataset.v;
      guideDirty = true;
      gradFollowLight();
      normalizeTones();
      renderControls();
      renderGuide();
      ctlRefocus('#sfShLight [data-v="' + shadeLight + '"]');
    });
  ['sfShHi', 'sfShLo'].forEach(function (id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', function (e) {
      zshSet(zoneCur, id === 'sfShHi' ? 'hi' : 'lo', +e.target.value / 100);
      guideDirty = true;
      dragPreview = true;
      if (!texRaf)
        texRaf = requestAnimationFrame(function () {
          texRaf = 0;
          renderGuide();
        });
    });
    el.addEventListener('change', function () {
      dragPreview = false;
      renderGuide();
      renderControls();
    });
  });
  var _shf = document.getElementById('sfShFlat');
  if (_shf)
    _shf.addEventListener('click', function () {
      shadeFlatMode = !shadeFlatMode;
      hideTip();
      if (shadeFlatMode) {
        setPaint(false);
        lockMode = false;
        photoAlign = false;
        positionPhoto();
      }
      renderControls();
    });
  var _rnd = document.getElementById('sfRound');
  if (_rnd) {
    _rnd.addEventListener('input', function (e) {
      zshSet(zoneCur, 'round', +e.target.value / 100);
      guideDirty = true;
      dragPreview = true;
      if (!texRaf)
        texRaf = requestAnimationFrame(function () {
          texRaf = 0;
          renderGuide();
        });
    });
    _rnd.addEventListener('change', function () {
      dragPreview = false;
      renderGuide();
    });
  }
  // "Shade Bell": the chosen zone shaded, or flat (its sections one colour each, as sections left flat are)
  var _zsh = document.getElementById('sfZoneShade');
  if (_zsh)
    _zsh.addEventListener('change', function (e) {
      zshSet(zoneCur, 'on', !!e.target.checked);
      guideDirty = true;
      gradFollowLight();
      normalizeTones();
      renderControls();
      renderGuide();
      sayLive(zoneName(zoneCur) + (e.target.checked ? ' is shaded' : ' is flat'));
    });
  var _shln = document.getElementById('sfShLines');
  if (_shln)
    _shln.addEventListener('change', function (e) {
      shadeLines = e.target.checked;
      guideDirty = true;
      renderGuide();
    });
  var _snt = document.getElementById('sfShNoteT');
  if (_snt) _snt.addEventListener('click', shadeNoteToggle);
}
function ctlWirePin() {
  var _lk = document.getElementById('sfLock');
  if (_lk)
    _lk.addEventListener('click', function () {
      lockMode = !lockMode;
      hideTip();
      if (lockMode) {
        shadeFlatMode = false;
        photoAlign = false;
        positionPhoto();
      }
      if (!lockMode) closeSwatchPop(false);
      renderControls();
      renderGuide();
    });
}
function ctlWireTexture() {
  var _tx = document.getElementById('sfTex');
  if (_tx)
    _tx.addEventListener('change', function () {
      dragPreview = false;
      renderGuide();
    });
  if (_tx)
    _tx.addEventListener('input', function (e) {
      dragPreview = true;
      guideDirty = true;
      texAmt = +e.target.value / 100;
      var _tv = document.getElementById('sfTexVal');
      if (_tv) _tv.textContent = e.target.value + '%';
      if (!texRaf)
        texRaf = requestAnimationFrame(function () {
          texRaf = 0;
          renderGuide();
        });
    });
}
