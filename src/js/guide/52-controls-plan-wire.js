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
        photoSettleNow();
        const was = family;
        family = b.dataset.v;
        if (family !== 'photo') delete photoWait[pwKey()];
        if (family === 'blend' || family === 'manual') lockMode = false;
        if (family !== 'manual') setPaint(false);
        hideTip();
        closeSwatchPop(false);
        if (family === 'photo' && !photoRef) {
          if (was !== 'photo') photoWait[pwKey()] = was;
          renderControls();
          pickPhotoRef(true);
          return;
        }
        // (Random's first main colour is anyone's guess, not the same pairing on every guide: 31-balance)
        if (
          family === 'random' &&
          balance === 'main' &&
          !balSeed &&
          balM === 'auto' &&
          balS === 'auto' &&
          balA === 'auto'
        )
          balSeed = Math.random() * 0.998 + 0.001;
        if (family !== 'photo') photoAlign = false;
        else if (!_phBumped) {
          _phBumped = true;
          if (limitN < 24) limitN = Math.min(24, sliderMax());
        }
        // (v328 review 2: a pattern that can't be laid, every marker dry, leaves the one before chosen: the controls
        // had shown its options over the plan as it was, and Undo had a step that changed nothing)
        if (reassign() === false) {
          family = was;
          renderControls();
        }
        positionPhoto();
      }
    });
  // colour from a photo
  // (v305: Photo's photo not chosen yet, back to the pattern before it)
  var _phb = document.getElementById('sfPhBack');
  if (_phb) _phb.addEventListener('click', photoWaitBack);
  var _php = document.getElementById('sfPhPick');
  if (_php)
    _php.addEventListener('click', function () {
      pickPhotoRef();
    });
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
      // (v308: the chip chosen shows as on)
      renderControls();
      ctlRefocus('#sfPhFit [data-v="' + b.dataset.v + '"]');
    });
  var _phr = document.getElementById('sfPhRough');
  if (_phr)
    _phr.addEventListener('change', function (e) {
      photoRoughOnly = e.target.checked;
      renderGuide();
    });
  // (no colour in the photo: its grey shading coloured after all, v304)
  var _phg = document.getElementById('sfPhGreys');
  if (_phg)
    _phg.addEventListener('click', function () {
      photoGreys = true;
      photoRecolour();
    });
  var _phsu = document.getElementById('sfPhUse');
  if (_phsu) _phsu.addEventListener('click', photoSugUse);
  var _phw = document.getElementById('sfPhPaper');
  if (_phw)
    _phw.addEventListener('change', function (e) {
      photoPaper = e.target.checked;
      photoRecolour();
    });
  // (v325: a photo-made page whose plan isn't as made any more: made again for the markers as they are, 47-photo-page)
  var _ppr = document.getElementById('sfPpRemakeGo');
  if (_ppr) _ppr.addEventListener('click', ppRemakeGo);
  // (v326: and its markers-to-add line, the page step's, 47-photo-page)
  ppHelpWire();
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
  var _ml = document.getElementById('sfMkList');
  if (_ml) _ml.addEventListener('click', markerListSheet);
  var _pal = document.getElementById('sfPal');
  if (_pal)
    _pal.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (b) {
        // (no markers of that temperature: the note says so, and the choice stays as it was, so Build guide never
        // meets a temperature it can't use, v287)
        var was = palette,
          wasTh = theme;
        palette = b.dataset.v;
        themeDrop = null;
        // (v318.18: a temperature that leaves the theme with next to none of its colours turns it off, in the same
        // step, and says so under the themes)
        if (THEMES[theme] && themeStrip(theme).off) {
          themeDrop = { n: THEMES[theme].n, t: palette };
          theme = '';
        }
        if (reassign() === false) {
          palette = was;
          theme = wasTh;
          themeDrop = null;
          renderControls();
        }
      }
    });
  // (v318.18) Theme: one at a time, the chosen one tapped again for none
  var _th = document.getElementById('sfTheme');
  if (_th)
    _th.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      var k = b.dataset.v,
        was = theme;
      if (b.getAttribute('aria-disabled') === 'true') {
        note(
          'Next to none of your ' +
            palette +
            ' markers are ' +
            THEMES[k].n.toLowerCase() +
            ' colours \u2014 choose Any in Lean towards for this theme.',
        );
        return;
      }
      themeDrop = null;
      theme = theme === k ? '' : k;
      if (reassign() === false) {
        theme = was;
        renderControls();
      }
    });
  // (v318.34) Colours from: Your markers | A palette. A palette brings back the palette the guide holds (one from
  // the Library, one made here or handed over from Palette; an older guide's saved one by its id), or makes one
  var _src = document.getElementById('sfSrc');
  if (_src)
    _src.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (b) {
        var wasSrc = paletteSource;
        // (the lit segment tapped again lays the plan again, as before)
        if (b.dataset.v === 'palette' && wasSrc === 'owned') {
          if (fromPal && fromPal.from === 'library' && savedPalId != null) paletteSource = 'saved';
          else if (genPal.length) paletteSource = 'generate';
          else if (savedPalId != null) paletteSource = 'saved';
          else {
            paletteSource = 'generate';
            generatePalette();
          }
        } else if (b.dataset.v === 'owned') paletteSource = 'owned';
        if (reassign() === false) {
          paletteSource = wasSrc;
          renderControls();
        }
      }
    });
  // the card's ✕: your markers (the palette is kept for A palette to bring back)
  var _poff = document.getElementById('sfPalOff');
  if (_poff)
    _poff.addEventListener('click', function () {
      var wasSrc = paletteSource;
      paletteSource = 'owned';
      if (reassign() === false) {
        paletteSource = wasSrc;
        renderControls();
      }
      ctlRefocus('#sfSrc [data-v="owned"]');
    });
  // New palette: one made here, of the harmony chosen (in place of one handed over or from the Library)
  var _gn = document.getElementById('sfGenNew');
  if (_gn)
    _gn.addEventListener('click', function () {
      paletteSource = 'generate';
      generatePalette(true);
      reassign();
      ctlRefocus('#sfGenNew');
    });
  var _hm = document.getElementById('sfHarm');
  if (_hm)
    _hm.addEventListener('change', function (e) {
      paletteSource = 'generate';
      genHarmony = e.target.value;
      // (v319, Ben's choice) Greys + accent wants greys: chosen while Include › Greys & black is off, it turns them on,
      // in the same Undo step, and the step says so
      if (genHarmony === 'neutral' && genNeutralChipOff()) {
        var _o = inclCopy(gradIncl || {});
        _o.greys = true;
        gradIncl = _o;
        generatePalette();
        planWhy = 'Greys + accent: ' + INCL_LABEL.greys + ' turned on';
      } else generatePalette();
      reassign();
    });
  // Choose a saved palette: its keys are copied into the guide (setSavedSource)
  var _pp = document.getElementById('sfPalPick');
  if (_pp) {
    _pp.addEventListener('change', function (e) {
      if (!e.target.value) return;
      setSavedSource(+e.target.value);
      reassign();
    });
  }
  // Change it in Palette: the palette opens on the Palette screen (locks, re-rolls, size, a start marker); Use in a
  // guide › Recolour brings it back
  var _pe = document.getElementById('sfPalEdit');
  if (_pe)
    _pe.addEventListener('click', function () {
      var info = palCardInfo();
      if (!info.keys.length || !api.editPalette) return;
      api.editPalette({ keys: genPalKeys(info.keys), h: info.h, name: info.name });
    });
  // Save to Library: the palette on the card, under its name; the guide then links to it, as a chosen one
  var _ps = document.getElementById('sfPalSave');
  if (_ps)
    _ps.addEventListener('click', function () {
      var info = palCardInfo(),
        keys = genPalKeys(info.keys);
      if (!keys.length || !api.savePalette) return;
      // (a palette made here is named by its colours, as Palette's Save names one; its scheme goes with it)
      // (v319: the scheme it was made with, genHarmUsed: Analogous + accent while Greys + accent falls back, Y3-3)
      var id = api.savePalette(keys, fromPal ? info.name : '', fromPal ? info.h : genHarmUsed());
      if (id == null) {
        toast('Couldn\u2019t save the palette: storage is full.', 6000);
        return;
      }
      var pl = (api.listPalettes ? api.listPalettes() : []).filter(function (x) {
        return x.id === id;
      })[0];
      savedPalId = id;
      genPal = keys;
      fromPal = { name: (pl && pl.name) || info.name, h: fromPal ? info.h : genHarmUsed(), from: 'library' };
      paletteSource = 'saved';
      guideDirty = true;
      renderControls();
      planCommit('Saved to Library');
      scheduleAutosave();
      toast('Saved to your Library as \u201c' + fromPal.name + '\u201d.');
      ctlRefocus('#sfPalEdit');
    });
  // Mood: a generated palette is made again to suit it (not one handed over from Palette, whose Mood is greyed out)
  var _mood = document.getElementById('sfMood');
  if (_mood)
    _mood.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      // (v310: laid as its picture showed, when there is one: 32-mood-pics)
      if (b && !b.disabled && b.dataset.v !== emphasis) {
        mpTap(b.dataset.v);
        ctlRefocus('#sfMood [data-v="' + b.dataset.v + '"]');
      }
    });
  // (v308) Include: a chip turns its group on or off (one Undo step)
  var _incl = document.getElementById('sfIncl');
  if (_incl)
    _incl.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b || b.disabled) return;
      var k = b.dataset.v,
        o = inclCopy(gradIncl || {});
      o[k] = !inclOn(gradIncl, emphasis)[k];
      gradIncl = o;
      planWhy = INCL_LABEL[k] + (o[k] ? ' on' : ' off');
      reassign();
      ctlRefocus('#sfIncl [data-v="' + k + '"]');
    });
  mkCountWire();
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
  // (v318.16) More options on a phone: open or shut, for the session; the bar keeps the keyboard (a disclosure)
  ['shading', 'colours', 'pattern'].forEach(function (t) {
    var mb = document.getElementById('sfMore-' + t);
    if (!mb) return;
    mb.addEventListener('click', function () {
      var shut = moreShut(t);
      moreOpen[t] = shut;
      var open = !moreShut(t);
      mb.setAttribute('aria-expanded', String(open));
      mb.classList.toggle('open', open);
      document.querySelectorAll('[id^="sfMoreIn-' + t + '"]').forEach(function (d) {
        d.hidden = !open;
      });
      // (rows fitted only where shown: the Theme grid's columns, v318.18)
      if (open) fitPairs();
    });
  });
  var _ft = document.getElementById('sfFiltToggle');
  if (_ft)
    _ft.addEventListener('click', function () {
      state.filtersOpen = !state.filtersOpen;
      // (v318.16: More options stays open under your finger as the Filters panel shuts)
      if (moreFold('colours')) moreOpen.colours = true;
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
      // (Radial while its rings follow the drawing: chosen already)
      if (b && !(b.dataset.v === 'radial' && gradShape === 'rings')) {
        gradShape = b.dataset.v;
        reassign();
      }
    });
  // (v318.15) Radial's rings: Circles or Follow the drawing
  var _rk = document.getElementById('sfRingKind');
  if (_rk)
    _rk.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b || b.dataset.v === gradShape) return;
      gradShape = b.dataset.v;
      reassign();
      ctlRefocus('#sfRingKind [data-v="' + gradShape + '"]');
    });
  var _ua = document.getElementById('sfUseAround');
  if (_ua)
    _ua.addEventListener('click', function () {
      gradShape = 'around';
      reassign();
      ctlRefocus('#sfShape [data-v="around"]');
    });
  var _rr = document.getElementById('sfRadReset');
  if (_rr)
    _rr.addEventListener('click', function () {
      radC = null;
      reassign();
      positionRadC();
      ctlRefocus('#sfShape [data-v="' + gradShape + '"]');
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
  // Shuffle: a Gradient that loops round the colour wheel starts at another of its markers (never where it was); a ramp of your markers picks others where there is a near choice (gradPlan); a
  // generated palette is made again
  // Scatter (v306): the name and its line follow the drag; the guide is laid again when it's let go
  var _gsc = document.getElementById('sfGradScat');
  if (_gsc) {
    _gsc.addEventListener('input', function (e) {
      var v = Math.max(0, Math.min(4, Math.round(+e.target.value)));
      var nm = document.getElementById('sfGradScatName'),
        nt = document.getElementById('sfGradScatNote');
      if (nm) nm.textContent = GRAD_SCAT_LABEL[v];
      if (nt) nt.textContent = GRAD_SCAT_DESC[v];
      e.target.setAttribute('aria-valuetext', GRAD_SCAT_LABEL[v]);
    });
    _gsc.addEventListener('change', function (e) {
      var v = Math.max(0, Math.min(4, Math.round(+e.target.value)));
      if (v === gradScat) return;
      gradScat = v;
      reassign();
    });
  }
  function shuffleNow() {
    // Textured and up: new draws for the scatter only, the same markers and Start colour (v306)
    if (family === 'gradient' && gradScatAt(gradCountNow().M) >= 2) {
      gradJit = (((gradJit || 0) % 1) + 1.1 + Math.random() * 0.8) % 1;
      reassign();
      return;
    }
    // (v308: not a palette handed over from Palette: its order or start changes, as a saved one's does)
    if (genMade()) generatePalette(true);
    if (family === 'gradient') {
      // (v311: a loop starts at another of its markers, picked at random. Turning it 10–90% of the way round could
      // land on the same one: with 6 markers from the smoothest start, 1 Shuffle in 12 changed nothing)
      var gs = gradStartInfo();
      if (gs) gradStartSet((gs.r + 1 + Math.floor(Math.random() * (gs.n - 1))) % gs.n, gs.n);
      // (v318.11: a ramp's step at least a fifth of the way, either way round: its handovers move at least a fifth of a
      // band, gradPhased)
      else gradSeed = (((gradSeed || 0) % 1) + 1.2 + Math.random() * 0.6) % 1;
    }
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
  balWire();
  // (v318.15) Matching shapes alike
  var _ma = document.getElementById('sfMatchAlike');
  if (_ma)
    _ma.addEventListener('change', function (e) {
      matchAlike = e.target.checked;
      reassign();
    });
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
  var _exc = document.getElementById('sfExCodes');
  if (_exc)
    _exc.addEventListener('change', function (e) {
      exCodes = e.target.checked;
    });
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
      // (v318.16) Off, or a style: the mode, the light and every zone's amounts at once (45-shading shPresetApply)
      var b = e.target.closest('button');
      if (!b || b.getAttribute('aria-pressed') === 'true') return;
      var v = b.dataset.v;
      if (v === 'off') {
        shadeMode = 'off';
        planWhy = 'Shading: Off';
      } else {
        if (!shPresetApply(v)) return;
        planWhy = 'Shading: ' + b.textContent.trim();
      }
      shadeFlatMode = false;
      guideDirty = true;
      gradFollowLight();
      normalizeTones();
      renderControls();
      renderGuide();
      ctlRefocus('#sfShade [data-v="' + v + '"]');
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
      // (v318.16) Highlights › None: Shadows only, the whole picture's mode; another highlight from there turns the
      // highlights back on, with that kind
      // (v318.17) Highlights › None: without zones, Shadows only for the whole picture (shadeMode 'shadow', as saved
      // before); with zones, the chosen zone's own (its record's 'none'). A highlight chosen in a zone while the whole
      // picture is shadows only turns highlights on for that zone alone: the others, and every section already
      // coloured, are kept as they are (None)
      var zn = zones.length ? zoneName(zoneCur) + ': ' : '';
      if (x[1] === 'hilite' && el.value === 'none') {
        if (shadeMode === 'shadow' || zsh(zoneCur).hilite === 'none') return;
        if (!zones.length) shadeMode = 'shadow';
        else zshSet(zoneCur, 'hilite', 'none');
        planWhy = zn + 'Highlights: None (shadows only)';
        guideDirty = true;
        gradFollowLight();
        normalizeTones();
        renderControls();
        renderGuide();
        ctlRefocus('#sfHiStyle');
        return;
      }
      var back = x[1] === 'hilite' && shadeMode === 'shadow';
      if (!back && el.value === zsh(zoneCur)[x[1]]) return;
      if (back) {
        shadeMode = 'full';
        if (zones.length) shZonesNone(zoneCur);
        planWhy = zn + 'Highlights: ' + (SHADE_HILITE_LABEL_ALL[el.value] || el.value);
        gradFollowLight();
      } else if (x[1] === 'hilite')
        planWhy = zn + 'Highlights: ' + (SHADE_HILITE_LABEL_ALL[el.value] || el.value);
      zshSet(zoneCur, x[1], el.value);
      // (v327: the Photo style is both kinds Matched to the photo: another kind is Custom)
      if (el.value !== 'photo') shadePStyle = false;
      guideDirty = true;
      normalizeTones();
      renderControls();
      renderGuide();
      if (back) ctlRefocus('#sfHiStyle');
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
      // (v327: an amount of your own: Custom, no longer the Photo style's)
      shadePStyle = false;
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
  // (v327) Two tone sets per marker, with photo tones
  var _sts = document.getElementById('sfShSets');
  if (_sts)
    _sts.addEventListener('change', function () {
      shadeSets = !!_sts.checked;
      planWhy = 'Shading: two tone sets ' + (shadeSets ? 'on' : 'off');
      guideDirty = true;
      normalizeTones();
      renderControls();
      renderGuide();
      ctlRefocus('#sfShSets');
    });
  var _shf = document.getElementById('sfShFlat');
  if (_shf)
    _shf.addEventListener('click', function () {
      shadeFlatMode = !shadeFlatMode;
      if (moreFold('shading')) moreOpen.shading = true;
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
      shRowSync();
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
  var _spk = document.getElementById('sfShPickGo');
  if (_spk) _spk.addEventListener('click', gradShadePick);
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

/* (v308) The marker count: the slider (its label follows the drag, the guide is laid a moment later), − and + (a step
   each; held down they keep going, 4 a second at first, then faster, and the guide is laid when let go), and the count,
   which a tap turns into a box to type a number in (the number pad on an iPad): Enter or leaving it sets it, Escape
   puts it back. A count at or over the slider's end is "all" (MK_ALL). */
function mkCountSet(n) {
  const cap = mkCap();
  limitN = n >= cap ? MK_ALL : Math.max(2, Math.round(n));
  // (v325: on a photo-made page, a count set by hand is the one it's made again for, 47-photo-page)
  if (pp) pp.hand = true;
}
// the label, the slider and the buttons as the count now is, without laying the guide
function mkCountShow() {
  const cap = mkCap(),
    v = Math.max(2, Math.min(limitN, cap)),
    lb = document.getElementById('sfMkNlbl'),
    sl = document.getElementById('sfMkCount'),
    mi = document.getElementById('sfMkMinus'),
    pl = document.getElementById('sfMkPlus'),
    nb = document.getElementById('sfMkNum');
  if (lb) lb.textContent = mkCountLabel();
  if (sl) {
    sl.value = v;
    sl.setAttribute('aria-valuetext', mkCountSay());
  }
  if (nb) nb.setAttribute('aria-label', mkCountSay() + ', type a number');
  if (mi) mi.disabled = v <= 2;
  if (pl) pl.disabled = limitN >= cap;
}
let _mkHold = null;
function mkHoldStop(lay) {
  if (!_mkHold) return;
  clearTimeout(_mkHold.t);
  const moved = _mkHold.moved,
    id = _mkHold.id;
  _mkHold = null;
  if (lay && moved) {
    clearTimeout(reTimer);
    reassign();
    ctlRefocus('#' + id);
  }
}
function mkCountWire() {
  const sl = document.getElementById('sfMkCount');
  if (sl) {
    sl.addEventListener('input', function (e) {
      mkCountSet(+e.target.value);
      mkCountShow();
      clearTimeout(reTimer);
      reTimer = setTimeout(reassign, 90);
    });
    sl.addEventListener('change', function () {
      planDrag = false;
      clearTimeout(reTimer);
      reassign();
    });
  }
  ['sfMkMinus', 'sfMkPlus'].forEach(function (id) {
    const b = document.getElementById(id);
    if (!b) return;
    const d = id === 'sfMkPlus' ? 1 : -1,
      step = function () {
        const cap = mkCap(),
          v = Math.min(limitN, cap);
        if ((d < 0 && v <= 2) || (d > 0 && limitN >= cap)) return false;
        mkCountSet(v + d);
        mkCountShow();
        return true;
      };
    // (a press: one step now, more while it's held; the guide is laid once, when it's let go)
    b.addEventListener('pointerdown', function (e) {
      if (e.button > 0 || b.disabled) return;
      mkHoldStop(false);
      _mkHold = { id: id, moved: step(), t: 0, n: 0 };
      const again = function () {
        if (!_mkHold) return;
        if (step()) _mkHold.moved = true;
        else return;
        _mkHold.n++;
        _mkHold.t = setTimeout(again, _mkHold.n < 6 ? 250 : 70);
      };
      _mkHold.t = setTimeout(again, 450);
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) {
      b.addEventListener(ev, function () {
        if (_mkHold) b._mkUp = Date.now();
        mkHoldStop(true);
      });
    });
    // (the keyboard's Enter or Space, or a screen reader's activation: a click with no press before it)
    b.addEventListener('click', function () {
      if (b._mkUp && Date.now() - b._mkUp < 800) return;
      if (step()) {
        clearTimeout(reTimer);
        reassign();
        ctlRefocus('#' + id);
      }
    });
    b.addEventListener('contextmenu', function (e) {
      e.preventDefault();
    });
  });
  const nb = document.getElementById('sfMkNum');
  if (nb)
    nb.addEventListener('click', function () {
      const cap = mkCap(),
        inp = document.createElement('input');
      inp.type = 'number';
      inp.id = 'sfMkType';
      inp.className = 'sfmktype';
      inp.min = 2;
      inp.max = cap;
      inp.step = 1;
      inp.setAttribute('inputmode', 'numeric');
      inp.setAttribute('enterkeyhint', 'done');
      inp.setAttribute('aria-label', 'Markers: 2 to ' + cap + ' (' + cap + ' is all)');
      inp.value = Math.min(limitN, cap);
      let done = false;
      const fin = function (ok) {
        if (done) return;
        done = true;
        const n = parseInt(inp.value, 10);
        if (ok && isFinite(n) && n !== Math.min(limitN, cap)) {
          mkCountSet(n);
          reassign();
        } else renderControls();
        ctlRefocus('#sfMkNum');
      };
      inp.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          fin(true);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          fin(false);
        }
      });
      inp.addEventListener('blur', function () {
        fin(true);
      });
      nb.replaceWith(inp);
      inp.focus();
      inp.select();
    });
}
