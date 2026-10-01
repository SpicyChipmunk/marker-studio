// Colour along's focus mode: the bar at the top, the Colours sheet and the bottom row (filled in by renderFocusUI)
function ctlFocus() {
  ctlEl.innerHTML =
    '<div class="sffocbar"><div class="sffocrow"><button id="sfExitFoc" class="sfz" aria-label="Exit focus mode">' +
    ic('x') +
    '</button><span id="sfFocSw" class="sffocsw"></span><div class="sffocname"><b id="sfFocName"></b><span id="sfFocSub"></span></div><button id="sfFocCols" class="sffoccols" aria-expanded="false">Colours</button></div><div id="sfFocChips" class="sffocchips" aria-hidden="true"></div><div id="sfFocTip" class="sffoctip"></div><div class="sffocprog"><div id="sfProgBar"></div></div></div>' +
    '<div id="sfFocSheet" class="sffocsheet" style="display:none"><button id="sfFocAll" class="fsall"></button>' +
    (shadeUse().on
      ? '<label class="sfchk fsteps"><input type="checkbox" id="sfToneSteps"' +
        (toneSteps ? ' checked' : '') +
        '> Step through each tone (a tap per tone instead of per section)</label>'
      : '') +
    '<div class="fshead">Jump to a colour</div><div id="sfFocMk"></div></div>' +
    '<div id="sfFocBot" class="sffocbot"></div>';
  var _ef = document.getElementById('sfExitFoc');
  if (_ef) _ef.addEventListener('click', exitFocus);
  var _fcb = document.getElementById('sfFocCols');
  if (_fcb)
    _fcb.addEventListener('click', function () {
      focusSheet = !focusSheet;
      renderFocusUI();
    });
  var _fal = document.getElementById('sfFocAll');
  if (_fal) _fal.addEventListener('click', focusAllOfColour);
  var _tst = document.getElementById('sfToneSteps');
  if (_tst)
    _tst.addEventListener('change', function (e) {
      toneSteps = e.target.checked;
      try {
        localStorage.setItem('ms-tone-steps', toneSteps ? '1' : '0');
      } catch (_) {}
      var cur = focusCur();
      buildFocusOrder();
      var to = -1;
      for (var i = 0; i < focusOrd.length; i++) {
        if (focusOrd[i] !== cur) continue;
        if (to < 0) to = i;
        if (!stepDone(cur, stepBits(i))) {
          to = i;
          break;
        }
      }
      if (to < 0) to = nextUndone(-1);
      focusHist = [];
      focusSheet = false;
      if (to < 0) finishFocus();
      else {
        focusPos = to;
        goFocus(to, false, true);
      }
    });
  var _fm = document.getElementById('sfFocMk');
  if (_fm)
    _fm.addEventListener('click', function (ev) {
      var b = ev.target.closest('.focmk');
      if (b) focusColour(b.getAttribute('data-k'));
    });
}
// Crop: Apply, Reset, Cancel
function ctlCrop() {
  ctlEl.innerHTML =
    '<div class="sfpane"><div class="sfc-crophint">Drag a box over the area to keep, then Apply.</div><div class="sfcropb"><button type="button" id="sfCropApply" class="sfprimary">Apply crop</button><button type="button" id="sfCropReset" class="sfghost">Reset</button><button type="button" id="sfCropCancel" class="sfghost">Cancel</button></div></div>';
  var _ca = document.getElementById('sfCropApply');
  if (_ca) _ca.addEventListener('click', applyCrop);
  var _cc = document.getElementById('sfCropCancel');
  if (_cc) _cc.addEventListener('click', cancelCrop);
  var _cr = document.getElementById('sfCropReset');
  if (_cr)
    _cr.addEventListener('click', function () {
      cropPx = { x: 0, y: 0, w: cropFullW, h: cropFullH };
      drawCropOverlay();
    });
}
// Edit sections bar (v288): a new picture, Build guide; a guide already built and nothing edited, ← Plan (back to it
// as it is, nothing rebuilt); once something is edited, ← Plan (which asks: Build again, Discard, Cancel) and Build
// again, with a line that the colouring is kept when there is some
function edBarHTML() {
  return '<div class="sfbar sfedbar"><button id="sfToPlan" class="sfghost" style="display:none">\u2190 Plan</button><button id="sfBuild" class="sfprimary">Build guide \u2192</button></div>';
}
function edBarSync() {
  const tp = document.getElementById('sfToPlan'),
    bb = document.getElementById('sfBuild');
  if (!bb || sfmode !== 'review') return;
  const built = !!assignData,
    ed = built && secEdPending();
  if (tp) {
    tp.style.display = built ? '' : 'none';
    tp.className = ed ? 'sfghost' : 'sfprimary';
  }
  bb.style.display = built && !ed ? 'none' : '';
  if (bb.textContent.indexOf('Building') < 0)
    bb.textContent = built ? 'Build again \u2192' : 'Build guide \u2192';
  const kl = document.getElementById('sfKeepLine');
  if (kl) {
    const show = ed && hasProgress();
    kl.style.display = show ? '' : 'none';
    if (show)
      kl.textContent = 'Build again keeps your colouring; sections you merge or split start uncoloured.';
  }
}
// back to the plan from Edit sections: as it is when nothing was edited; otherwise asked first
function edToPlan() {
  if (!secEdPending()) {
    edGoPlan();
    return;
  }
  askEdits().then(function (a) {
    if (a === 'build') {
      const b = document.getElementById('sfBuild');
      if (b) b.click();
    } else if (a === 'discard') {
      // (edits brought back by Resume: the guide as built is opened again from the Library)
      if (_edResumed && curId != null) {
        edDropResumed();
        openDesign(curId);
      } else if (discardEdits()) edGoPlan();
      else note('Some edits couldn\u2019t be undone \u2014 Build again keeps them, or use Undo.');
    }
  });
}
function edGoPlan() {
  stageGo();
  sfmode = 'guide';
  renderControls();
  renderGuide();
}
// section edits since the guide was built, undone (Edit sections' Undo, step by step, back to the build), and the
// sliders as they were; true when nothing is left to build
function discardEdits() {
  let n = 0;
  while (secEdPending() && undoStack.length && !undoStack[undoStack.length - 1].sealed && n++ < 500) doUndo();
  if (secEdPending() && _built && _built.ss.length === secState.length) {
    secState.set(_built.ss);
    minPos = _built.min;
    bgTrim = _built.bg;
    applyBg();
    hasEdits = false;
  }
  return !secEdPending();
}
// Edit sections: Adjust photo (turn, straighten, crop, enhance, tilt), the warning when the sections look wrong, the
// section sliders, the edit tools and the key, and Build guide
function ctlSections() {
  const mv = minPos,
    // (v288) what this step is for, and the tools first; Adjust photo after the sliders
    head =
      '<h3 class="sfedhead">Check the sections</h3><div class="sfc-note sfedline">Tap a section to leave it out or bring it back. Merge, split or add where the lines didn\u2019t come out right.</div>',
    adjust =
      '<button id="sfAdjToggle" class="sfexp sfc-mt12" aria-expanded="' +
      !!showAdjust +
      '"' +
      (srcImg ? '' : ' style="display:none"') +
      '>' +
      ic(showAdjust ? 'chevron-down' : 'chevron-right') +
      ' Adjust photo</button>' +
      (showAdjust && srcImg
        ? '<div class="sfc-adjrow"><button id="sfRotL" class="sfghost" aria-label="Turn left 90\u00b0">' +
          ic('rotate-ccw') +
          ' 90\u00b0</button><button id="sfRotR" class="sfghost" aria-label="Turn right 90\u00b0">' +
          ic('rotate-cw') +
          ' 90\u00b0</button>' +
          (pgOrig && !pgQ ? '<button id="sfPgOpen" class="sfghost">Straighten page</button>' : '') +
          '<button id="sfCrop" class="sfghost">Crop</button><button id="sfAutoCrop" class="sfghost" aria-label="Auto crop">Auto</button><label class="sfchk sfc-enh">Enhance <input type="checkbox" id="sfEnh"' +
          (enhance ? ' checked' : '') +
          '></label></div><label class="sfc-slider sfc-mt10">Tilt <b id="sfTiltVal">' +
          (+tilt).toFixed(1) +
          '\u00b0</b><input type="range" id="sfTilt" min="-8" max="8" step="0.2" value="' +
          tilt +
          '" class="sfc-range"></label><div id="sfSensWrap" style="display:' +
          (enhance ? 'block' : 'none') +
          '"><label class="sfc-slider sfc-mt8">Sensitivity <b id="sfSensVal">' +
          Math.round((16 - adaptC) / 1.4) +
          '</b><input type="range" id="sfSens" min="1" max="9" step="1" value="' +
          Math.round((16 - adaptC) / 1.4) +
          '" class="sfc-range" aria-describedby="sfSensHint"></label><div id="sfSensHint" class="sfrnghint">Higher: fainter lines count as lines</div></div>'
        : '');
  ctlEl.innerHTML =
    '<div class="sfpane">' +
    (pgQ && pgOrig
      ? '<div class="sfpgline"><span aria-hidden="true">\u2713</span> Page straightened \u00b7 <button class="sflink" id="sfPgUndo">Undo</button> \u00b7 <button class="sflink" id="sfPgAdj">Adjust corners</button></div>'
      : pgHint && pgOrig && srcImg
        ? '<div class="sfpgline sfpghint">' +
          'Page kept as photographed' +
          ' \u00b7 <button class="sflink" id="sfPgAdj">Straighten</button></div>'
        : '') +
    head +
    (segWarn && !segWarn.ok
      ? '<div class="sfc-segwarn">' +
        ic('triangle-alert', 'icw') +
        ' <b>' +
        segWarn.msg +
        '</b><br><span class="sfc-sub">' +
        segWarn.tip +
        '</span></div>'
      : '') +
    '<div id="sfEdit" role="group" aria-label="Edit tool" class="sfc-segs sfc-mt8"><button type="button" id="sfEmToggle" data-m="toggle" class="sfedit">Leave out</button><button type="button" id="sfEmMerge" data-m="merge" class="sfedit">Merge</button><button type="button" id="sfEmSplit" data-m="split" class="sfedit">Split</button><button type="button" id="sfEmAdd" data-m="add" class="sfedit">Add</button></div><label id="sfAutoCloseWrap" class="sfc-autoclose" style="display:none"><input type="checkbox" id="sfAutoClose"> Autoclose loops</label><div id="sfHint" class="sfc-note sfc-mt8"></div><div class="sfc-key"><span><span class="sfc-sw sfc-sw-sec"></span>section</span><span><span class="sfc-sw sfc-sw-bg"></span>background</span><span><span class="sfc-sw sfc-sw-ex"></span>left out</span></div>' +
    '<label class="sfrng sfc-mt12">Min section size<input type="range" id="sfMin" min="0" max="100" value="' +
    mv +
    '" aria-describedby="sfMinHint"></label><div id="sfMinHint" class="sfrnghint">Higher: small specks left out of the guide</div><span id="sfCount" hidden>0 sections</span><label class="sfrng">Background trim<input type="range" id="sfBg" min="0" max="100" value="' +
    bgTrim +
    '" aria-describedby="sfBgHint"></label><div id="sfBgHint" class="sfrnghint">Higher: more of what touches the edges counts as background</div>' +
    adjust +
    '<div id="sfKeepLine" class="sfc-note sfc-mt10" style="display:none"></div></div>' +
    edBarHTML();
  minEl = document.getElementById('sfMin');
  countEl = document.getElementById('sfCount');
  minEl.addEventListener('input', function () {
    minPos = +minEl.value;
    if (labels && sfmode === 'review') {
      if (!texRaf)
        texRaf = requestAnimationFrame(function () {
          texRaf = 0;
          render();
        });
    }
  });
  var bgEl = document.getElementById('sfBg');
  if (bgEl)
    bgEl.addEventListener('input', function () {
      bgTrim = +bgEl.value;
      if (labels && sfmode === 'review') {
        applyBg();
        if (!texRaf)
          texRaf = requestAnimationFrame(function () {
            texRaf = 0;
            render();
          });
      }
    });
  var acEl = document.getElementById('sfAutoClose');
  if (acEl) {
    acEl.checked = addAutoClose;
    acEl.addEventListener('change', function () {
      addAutoClose = acEl.checked;
      var hh = document.getElementById('sfHint');
      if (hh && editMode === 'add')
        hh.textContent = addAutoClose
          ? 'Add: draw a loop to enclose a new section \u2014 the ends join automatically.'
          : 'Add: draw across a region to a line or the page edge to slice off a section.';
    });
  }
  document.getElementById('sfBuild').addEventListener('click', function () {
    const b = this;
    if (b.disabled) return;
    stageGo();
    b.disabled = true;
    b.textContent = 'Building\u2026';
    requestAnimationFrame(function () {
      setTimeout(function () {
        try {
          buildGuide();
        } finally {
          if (b.isConnected) {
            b.disabled = false;
            b.textContent = 'Build guide \u2192';
            edBarSync();
          }
        }
      }, 0);
    });
  }); // show "Building…" before the work starts
  var _tp = document.getElementById('sfToPlan');
  if (_tp) _tp.addEventListener('click', edToPlan);
  edBarSync();
  function wire(id, ev, fn) {
    const el = document.getElementById(id);
    if (el) el.addEventListener(ev, fn);
  }
  wire('sfAdjToggle', 'click', function () {
    showAdjust = !showAdjust;
    renderControls();
  });
  wire('sfCrop', 'click', enterCrop);
  wire('sfPgOpen', 'click', pgAdjust);
  wire('sfPgAdj', 'click', pgAdjust);
  wire('sfPgUndo', 'click', pgUndo);
  wire('sfAutoCrop', 'click', autoCrop);
  wire('sfRotL', 'click', function () {
    okGeom(function () {
      rot90 = (rot90 + 270) % 360;
      cropRect = null;
      reprocessImg();
    });
  });
  wire('sfRotR', 'click', function () {
    okGeom(function () {
      rot90 = (rot90 + 90) % 360;
      cropRect = null;
      reprocessImg();
    });
  });
  // (the first move of Tilt asks, when there's something to lose: the slider waits at its old place meanwhile, and on
  // Rebuild goes to where it was asked to)
  wire('sfTilt', 'input', function (e) {
    const el = e.target,
      go = function () {
        // (where the drag got to while the question was open, not only its first step)
        const want = el._want;
        el._ok = 1;
        el.value = want;
        tilt = want;
        var v = document.getElementById('sfTiltVal');
        if (v) v.textContent = tilt.toFixed(1) + '\u00b0';
        debImg();
      };
    el._want = +el.value;
    if (el._ok) {
      go();
      return;
    }
    if (geomAsks()) el.value = tilt;
    okGeom(go);
  });
  wire('sfEnh', 'change', function (e) {
    reFrom();
    enhance = e.target.checked;
    const w = document.getElementById('sfSensWrap');
    if (w) w.style.display = enhance ? 'block' : 'none';
    resegment();
  });
  wire('sfSens', 'input', function (e) {
    reFrom();
    adaptC = Math.round(16 - +e.target.value * 1.4);
    var v = document.getElementById('sfSensVal');
    if (v) v.textContent = e.target.value;
    debSeg();
  });
  ['sfEmToggle', 'sfEmMerge', 'sfEmSplit', 'sfEmAdd'].forEach(function (id) {
    const b = document.getElementById(id);
    if (b)
      b.addEventListener('click', function () {
        setEditMode(b.dataset.m);
        editPressed();
      });
  });
  setEditMode(editMode);
  editPressed();
  updateUndoUI();
}
