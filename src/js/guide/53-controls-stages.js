// Colour along's focus mode: the bar at the top, the Colours sheet and the bottom row (filled in by renderFocusUI)
function ctlFocus() {
  ctlEl.innerHTML =
    '<div class="sffocbar"><div class="sffocrow"><button id="sfExitFoc" class="sfz" aria-label="Exit focus mode">✕</button><span id="sfFocSw" class="sffocsw"></span><div class="sffocname"><b id="sfFocName"></b><span id="sfFocSub"></span></div><button id="sfFocCols" class="sffoccols" aria-expanded="false">Colours</button></div><div class="sffocprog"><div id="sfProgBar"></div></div></div>' +
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
// Edit sections: Adjust photo (turn, straighten, crop, enhance, tilt), the warning when the sections look wrong, the
// section sliders, the edit tools and the key, and Build guide
function ctlSections() {
  const mv = minPos;
  ctlEl.innerHTML =
    '<div class="sfpane">' +
    (pgQ && pgOrig
      ? '<div class="sfpgline"><span aria-hidden="true">\u2713</span> Page straightened \u00b7 <button class="sflink" id="sfPgUndo">Undo</button> \u00b7 <button class="sflink" id="sfPgAdj">Adjust corners</button></div>'
      : '') +
    '<button id="sfAdjToggle" class="sfexp sfc-mt12"' +
    (srcImg ? '' : ' style="display:none"') +
    '>' +
    '<span aria-hidden="true">' +
    (showAdjust ? '\u25be' : '\u25b8') +
    '</span> Adjust photo</button>' +
    (showAdjust && srcImg
      ? '<div class="sfc-adjrow"><button id="sfRotL" class="sfghost" aria-label="Turn left 90\u00b0">\u21ba 90\u00b0</button><button id="sfRotR" class="sfghost" aria-label="Turn right 90\u00b0">\u21bb 90\u00b0</button>' +
        (pgOrig && !pgQ ? '<button id="sfPgOpen" class="sfghost">Straighten page</button>' : '') +
        '<button id="sfCrop" class="sfghost">Crop</button><button id="sfAutoCrop" class="sfghost">Auto</button><label class="sfchk sfc-enh">Enhance <input type="checkbox" id="sfEnh"' +
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
        '" class="sfc-range"></label></div>'
      : '') +
    '' +
    (segWarn && !segWarn.ok
      ? '<div class="sfc-segwarn">\u26a0\ufe0f <b>' +
        segWarn.msg +
        '</b><br><span class="sfc-sub">' +
        segWarn.tip +
        '</span></div>'
      : '') +
    '<label class="sfrng">Min section size<input type="range" id="sfMin" min="0" max="100" value="' +
    mv +
    '"></label><span id="sfCount" hidden>0 sections</span><label class="sfrng">Background trim<input type="range" id="sfBg" min="0" max="100" value="' +
    bgTrim +
    '"></label><div class="sfc-note sfc-mt12 sfc-mb4">Edit tool</div><div id="sfEdit" role="group" aria-label="Edit tool" class="sfc-segs"><button type="button" id="sfEmToggle" data-m="toggle" class="sfedit">Include / exclude</button><button type="button" id="sfEmMerge" data-m="merge" class="sfedit">Merge</button><button type="button" id="sfEmSplit" data-m="split" class="sfedit">Split</button><button type="button" id="sfEmAdd" data-m="add" class="sfedit">Add</button></div><label id="sfAutoCloseWrap" class="sfc-autoclose" style="display:none"><input type="checkbox" id="sfAutoClose"> Autoclose loops</label><div id="sfHint" class="sfc-note sfc-mt8"></div><div class="sfc-key"><span><span class="sfc-sw sfc-sw-sec"></span>section</span><span><span class="sfc-sw sfc-sw-bg"></span>background</span><span><span class="sfc-sw sfc-sw-ex"></span>excluded</span></div></div><div class="sfbar"><button id="sfBuild" class="sfprimary">Build guide \u2192</button></div>';
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
          }
        }
      }, 0);
    });
  }); // show "Building…" before the work starts
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
    if (!okGeom()) return;
    rot90 = (rot90 + 270) % 360;
    cropRect = null;
    reprocessImg();
  });
  wire('sfRotR', 'click', function () {
    if (!okGeom()) return;
    rot90 = (rot90 + 90) % 360;
    cropRect = null;
    reprocessImg();
  });
  wire('sfTilt', 'input', function (e) {
    if (!e.target._ok) {
      if (!okGeom()) {
        e.target.value = tilt;
        return;
      }
      e.target._ok = 1;
    }
    tilt = +e.target.value;
    var v = document.getElementById('sfTiltVal');
    if (v) v.textContent = tilt.toFixed(1) + '\u00b0';
    debImg();
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
