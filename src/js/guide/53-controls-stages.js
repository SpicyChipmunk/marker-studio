// Colour along's focus mode: the bar at the top, the Colours sheet and the bottom row (filled in by renderFocusUI)
function ctlFocus() {
  ctlEl.innerHTML =
    '<div class="sffocbar"><div class="sffocrow"><button id="sfExitFoc" class="sfz" aria-label="Exit focus mode">' +
    ic('x') +
    '</button><span id="sfFocSw" class="sffocsw"></span><div class="sffocname"><b id="sfFocName"></b><span id="sfFocSub"></span></div><button id="sfFocCols" class="sffoccols" aria-expanded="false">Colours</button></div><div id="sfFocChips" class="sffocchips" aria-hidden="true"></div><div id="sfFocTip" class="sffoctip"></div><div class="sffocprog" id="sfFocProg" role="progressbar" aria-label="Page" aria-valuemin="0" aria-valuemax="100"><div id="sfProgBar"></div></div></div>' +
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
      focusSheetSet(!focusSheet);
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
  return '<div class="sfbar sfedbar"><button id="sfToPlan" class="sfghost" style="display:none" aria-label="Back to the Plan">\u2190 Plan</button><button id="sfBuild" class="sfprimary" aria-label="Build guide">Build guide \u2192</button></div>';
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
  // (the arrow isn't read out)
  bb.setAttribute('aria-label', built ? 'Build again' : 'Build guide');
  const kl = document.getElementById('sfKeepLine');
  if (kl) {
    const show = ed && hasProgress();
    kl.style.display = show ? '' : 'none';
    if (show)
      kl.textContent =
        'Build again keeps your colouring. Merged sections stay ticked only when every part was.';
  }
}
// back to the plan from Edit sections: as it is when nothing was edited; otherwise asked first
// newGuide (Home's New colouring guide, v289): Discard edits also opens the photo picker, within the tap (iOS)
function edToPlan(newGuide) {
  if (!secEdPending()) {
    // (edits undone by hand: a copy kept for Resume earlier is stale now, v298)
    edSlotDrop();
    edGoPlan();
    return;
  }
  askEdits(
    newGuide === true
      ? function (a) {
          if (a === 'discard') pickPhoto();
        }
      : null,
  ).then(function (a) {
    if (a === 'build') {
      const b = document.getElementById('sfBuild');
      if (b) b.click();
    } else if (a === 'discard') {
      // (edits brought back by Resume: the guide as built is opened again from the Library)
      // (straight from the Library: not through openDesign, whose shortcut for the open guide would keep the edited
      // map on screen, nor stashDirty, which could save it, v289)
      if (_edResumed && curId != null) {
        edDropResumed();
        const id = curId,
          g = ++loadGen;
        Promise.resolve(api.loadDesign ? api.loadDesign(id) : null)
          .then(function (d) {
            if (g === loadGen) openDesignObj(d, id);
          })
          .catch(function () {
            note('Couldn\u2019t open the guide as built \u2014 Build again keeps the edits.');
          });
      } else if (discardEdits()) {
        // (and the copy kept for Resume when the page was hidden, as Discard when something else opens does, v298)
        edSlotDrop();
        edGoPlan();
      } else note('Some edits couldn\u2019t be undone \u2014 Build again keeps them, or use Undo.');
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
  // (a section map still not the built one, merges or splits beyond what Undo keeps, isn't discarded: v289)
  return !secEdPending() && !guideStale();
}
// Edit sections: Adjust photo (turn, straighten, crop, enhance, tilt), the warning when the sections look wrong, the
// section sliders, the edit tools and the key, and Build guide
// the warning over Edit sections when the picture didn't come out as line art (segQuality), or nothing
function segWarnHTML() {
  return segWarn && !segWarn.ok
    ? '<div class="sfc-segwarn">' +
        ic('triangle-alert', 'icw') +
        ' <b>' +
        segWarn.msg +
        '</b><br><span class="sfc-sub">' +
        segWarn.tip +
        '</span></div>'
    : '';
}
// Very dense pages (v304). Above DENSE_ASK sections Build asks first, once for a picture (again only when there are
// twice as many): on a tablet each is a few pixels, to zoom in for. Above FOLDAT left after the specks are folded
// (60-persist) the guide couldn't be opened again, so it isn't built until Min section size is raised.
const DENSE_ASK = 3000;
let _denseAsked = 0;
// sections in the guide at Min section size pos, and those that would be saved (after the specks are folded)
function denseCount(pos) {
  const mp = minPx(pos),
    P = tonePart && tonePart._c === colored ? tonePart : null;
  let live = 0,
    cnt = 0,
    fold = 0;
  for (let l = 1; l < comps.length; l++) {
    const c = comps[l];
    if (!c || c.merged) continue;
    live++;
    const s = secState[l];
    if (s === 1 || (s !== 2 && !c.bg && c.area >= mp)) cnt++;
    if (foldable(l, mp, P)) fold++;
  }
  return { cnt: cnt, live: live, kept: live > FOLDAT ? Math.max(FOLDAT, live - fold) : live };
}
// true when Build can't go ahead (too many sections to keep), said in a note
function denseStop() {
  if (!labels || !comps || comps.length - 1 <= FOLDAT || denseCount(minPos).kept <= FOLDAT) return false;
  note(
    'Couldn\u2019t build \u2014 this page has too many sections to keep. Raise Min section size, then Build guide.',
  );
  return true;
}
// the Min section size that leaves at most DENSE_ASK sections (and few enough to keep), or the largest
function denseMin() {
  for (let pos = Math.min(100, minPos + 5); pos <= 100; pos += 5) {
    const d = denseCount(pos);
    if (d.cnt <= DENSE_ASK && d.kept <= FOLDAT) return { pos: pos, d: d };
  }
  return { pos: 100, d: denseCount(100) };
}
// asked first, then go() (true: the question is open, or Build can't go ahead)
function denseAsk(go) {
  if (!labels || !comps || sfmode !== 'review') return false;
  const d = denseCount(minPos),
    stop = d.kept > FOLDAT;
  if (!stop && (d.cnt <= DENSE_ASK || (_denseAsked && d.cnt < 2 * _denseAsked))) return false;
  const m = denseMin(),
    // (sizes as they look on this screen, the picture fitted to it)
    k = cv && cv.offsetWidth && W ? cv.offsetWidth / W : 1,
    each = Math.max(1, Math.round(Math.sqrt((W * H) / Math.max(1, d.cnt)) * k)),
    under = Math.max(1, Math.round(Math.sqrt(minPx(m.pos)) * k)),
    n = stop ? d.kept : d.cnt,
    // (a page of sections all much the same size: no Min section size leaves fewer, so it isn't offered)
    less = m.d.cnt < d.cnt,
    // (a size under 3 px on this screen means nothing to read: the smallest, then)
    keep = less
      ? under < 3
        ? ' Leaving out the smallest keeps ' + m.d.cnt.toLocaleString() + '.'
        : ' Leaving out sections smaller than ' + under + ' px keeps ' + m.d.cnt.toLocaleString() + '.'
      : '',
    folds = d.live > FOLDAT;
  askBox(
    'This page has ' + n.toLocaleString() + ' sections.',
    (stop
      ? 'That\u2019s more than a guide can keep.' + keep
      : 'About ' + each + ' px each on this screen, so you\u2019d zoom in for every one.' + keep) +
      (folds ? ' Tiny specks are joined to the lines when it\u2019s saved.' : ''),
    (stop
      ? '<button type="button" class="btn-primary" data-a="min">Raise Min section size</button>'
      : (less
          ? '<button type="button" class="btn-primary" data-a="min">Leave out the small ones</button><button type="button" class="sfghost" data-a="all">'
          : '<button type="button" class="btn-primary" data-a="all">') +
        'Build all ' +
        d.cnt.toLocaleString() +
        '</button>') + '<button type="button" class="sfghost" data-a="stay">Cancel</button>',
    true,
  ).then(function (a) {
    if (a === 'min') {
      minPos = m.pos;
      _denseAsked = m.d.cnt;
      renderControls();
      render();
      if (!stop) go();
    } else if (a === 'all') {
      _denseAsked = d.cnt;
      go();
    }
  });
  return true;
}
// the warning box as segWarn says now, in place (v304: also after Sensitivity, Enhance and Undo, which found or put
// back the sections without drawing the controls again, so a warning stayed or never showed)
function segWarnSync() {
  if (sfmode !== 'review' || !ctlEl) return;
  const el = ctlEl.querySelector('.sfc-segwarn'),
    h = segWarnHTML();
  if (el) el.outerHTML = h;
  else if (h) {
    const ed = document.getElementById('sfEdit');
    if (ed) ed.insertAdjacentHTML('beforebegin', h);
  }
}
// The paper inside a drawn frame, left white (findFrame, 10-segment, v305): a line on Edit sections and in the Plan
// with Colour it, which brings it back as a section (in the Plan, laid by the pattern, the rest keeping their
// markers, as Build again does; v306: one Undo step, the plan's earlier steps kept). v306: "round the drawing", the
// words for the paper a page without a frame leaves white too
const FRAME_STEP = 'Paper round the drawing coloured';
function frameLineHTML() {
  if (!frameLeft() || (sfmode !== 'review' && sfmode !== 'guide')) return '';
  return '<div id="sfFrameLine" class="sfframeline">Paper round the drawing is left white \u00b7 <button type="button" class="sflink" id="sfFrameColour">Colour it</button></div>';
}
function frameLineWire() {
  const b = document.getElementById('sfFrameColour');
  if (b) b.addEventListener('click', frameColour);
}
// (in step with the sections after a tap leaves the paper out or brings it back, on Edit sections)
function frameLineSync() {
  if (!ctlEl) return;
  const el = document.getElementById('sfFrameLine'),
    h = frameLineHTML();
  if (!h) {
    if (el) el.remove();
    return;
  }
  if (el) return;
  const at = ctlEl.querySelector(sfmode === 'review' ? '.sfedhead' : '.sftabs');
  if (!at) return;
  at.insertAdjacentHTML(sfmode === 'review' ? 'beforebegin' : 'afterend', h);
  frameLineWire();
}
// (v308) Faint grey marks (faintSplit, 10-segment): offered on Edit sections only when the ink splits clearly into dark
// outlines and pale grey marks. Ticked, the pale ink is ignored and the sections are found again (one Undo step, as
// Sensitivity is). Pale swirls can be part of the drawing, so the line says so.
function faintLineHTML() {
  if (sfmode !== 'review' || !srcImg || !(faintOffer || faintCut)) return '';
  return (
    '<div id="sfFaintLine" class="sffaint"><label class="sffaintchk"><input type="checkbox" id="sfFaint"' +
    (faintCut ? ' checked' : '') +
    '> Ignore faint grey marks</label><div class="sfc-sub">For pale grey marks, like a watermark. Swirls this pale can be part of the drawing.</div></div>'
  );
}
function faintWire() {
  const b = document.getElementById('sfFaint');
  if (!b) return;
  b.addEventListener('change', function () {
    reFrom();
    faintCut = b.checked ? faintOffer : 0;
    if (b.checked && !faintCut) {
      b.checked = false;
      return;
    }
    if (resegment() === false) return;
    sayLive(faintCut ? 'Faint grey marks ignored' : 'Faint grey marks kept');
  });
}
// (in step after the sections are found again without the controls being drawn again: Sensitivity, Enhance)
function faintLineSync() {
  if (sfmode !== 'review' || !ctlEl) return;
  const el = document.getElementById('sfFaintLine'),
    h = faintLineHTML();
  if (el) {
    if (!h) el.remove();
    else if (!!document.getElementById('sfFaint').checked === !!faintCut) return;
    else el.outerHTML = h;
  } else if (h) {
    const at = ctlEl.querySelector('.sfc-segwarn') || document.getElementById('sfEdit');
    if (!at) return;
    at.insertAdjacentHTML('beforebegin', h);
  }
  faintWire();
}
function frameColour() {
  const l = frameLeft();
  if (!l) return;
  const was = secState[l];
  pushUndo({ t: 'ov', d: secState.slice() });
  secState[l] = 1;
  if (sfmode === 'review') {
    hasEdits = true;
    render();
    frameLineSync();
    ctlRefocus('#sfEmToggle');
    sayLive('Paper round the drawing is a section');
    return;
  }
  // (the Plan: built again with it, as from Edit sections, its Undo steps kept; this is one more, which takes the
  // paper out of the guide again: planUndo)
  sfmode = 'review';
  buildGuide(true);
  if (sfmode !== 'guide') {
    secState[l] = was;
    sfmode = 'guide';
    renderControls();
    return;
  }
  // (v307: with Smooth them on, the rough spots the paper brings are smoothed in the same step, not after a second tap)
  if (gradFixHeld()) {
    renderGuide();
    renderControls();
  }
  planCommit(FRAME_STEP, false, { frame: { l: l, was: was } });
  ctlRefocus('#sfTab-' + gTab);
}
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
    frameLineHTML() +
    head +
    faintLineHTML() +
    segWarnHTML() +
    '<div id="sfEdit" role="group" aria-label="Edit tool" class="sfc-segs sfc-mt8"><button type="button" id="sfEmToggle" data-m="toggle" class="sfedit">Leave out</button><button type="button" id="sfEmMerge" data-m="merge" class="sfedit">Merge</button><button type="button" id="sfEmSplit" data-m="split" class="sfedit">Split</button><button type="button" id="sfEmAdd" data-m="add" class="sfedit">Add</button></div><label id="sfAutoCloseWrap" class="sfc-autoclose" style="display:none"><input type="checkbox" id="sfAutoClose"> Join the ends of a loop for me</label><div id="sfHint" class="sfc-note sfc-mt8"></div><div class="sfc-key"><span><span class="sfc-sw sfc-sw-sec"></span>section</span><span><span class="sfc-sw sfc-sw-bg"></span>background</span><span><span class="sfc-sw sfc-sw-ex"></span>left out</span></div>' +
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
  // (the warning about tiny fragments counts those in the guide, so it's checked again once the slider is let go, v303)
  minEl.addEventListener('change', function () {
    if (!labels || sfmode !== 'review') return;
    segWarn = segQuality();
    segWarnSync();
  });
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
    // (a very dense page is asked about first, v304)
    if (
      denseAsk(function () {
        // (the bar may have been drawn again meanwhile)
        const nb = document.getElementById('sfBuild');
        if (nb) nb.click();
      })
    )
      return;
    stageGo();
    b.disabled = true;
    b.textContent = 'Building\u2026';
    // (the picture Build was pressed on: another guide opened meanwhile isn't built over, v307 debug)
    const g = loadGen;
    requestAnimationFrame(function () {
      // (v307: the label points worked out in the worker first, while "Building…" shows: lptsReady, 40-render)
      lptsReady().then(function () {
        // (the first Build of a new picture blooms: 41-bloom.js)
        const first = !assignData;
        try {
          if (g !== loadGen) return;
          buildGuide();
          if (first && assignData && sfmode === 'guide') bloomStart();
        } finally {
          if (b.isConnected) {
            b.disabled = false;
            b.textContent = 'Build guide \u2192';
            b.setAttribute('aria-label', 'Build guide');
            edBarSync();
          }
        }
      });
    });
  }); // show "Building…" before the work starts
  var _tp = document.getElementById('sfToPlan');
  // (not edToPlan itself: the click would come in as newGuide, and Discard would open the photo picker, v296)
  if (_tp)
    _tp.addEventListener('click', function () {
      edToPlan(false);
    });
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
  frameLineWire();
  faintWire();
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
    sensUser = true;
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
