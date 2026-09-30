// Rebuilding the panel replaces every control: never do it under a finger that is dragging a slider (wait for
// the release), and put keyboard focus back on the same control afterwards.
let _rcHeld = false,
  _rcPending = false;
// the Plan tabs (#7): they open on the last one used on this device, or on Colours the first time
const PTABS = [
    ['colours', 'Colours'],
    ['pattern', 'Pattern'],
    ['shading', 'Shading'],
    ['share', 'Share'],
  ],
  PTAB_KEY = 'ms-plan-tab';
function isPlanTab(t) {
  return PTABS.some(function (x) {
    return x[0] === t;
  });
}
try {
  const _t0 = localStorage.getItem(PTAB_KEY);
  if (isPlanTab(_t0)) gTab = _t0;
} catch (_) {}
// a tab chosen by hand is remembered (switchTab keeps pinned tabs pinned)
function planTab(t) {
  if (!isPlanTab(t)) return;
  switchTab(t);
  try {
    localStorage.setItem(PTAB_KEY, t);
  } catch (_) {}
}
function renderControls() {
  if (!ctlEl) return;
  if (_rcHeld) {
    _rcPending = true;
    return;
  }
  const ae = document.activeElement,
    fid = ae && ae.id && ctlEl.contains(ae) ? ae.id : null;
  _renderControls();
  dockBar();
  renderHead();
  renderTools();
  fitBar();
  fitPairs();
  paneMin();
  touchRule();
  stageCheck();
  if (fid) {
    const el = document.getElementById(fid);
    if (el && el !== document.activeElement && ctlEl.contains(el))
      try {
        el.focus({ preventScroll: true });
      } catch (_) {}
  }
}
function holdControls(on) {
  if (on) {
    _rcHeld = true;
    return;
  }
  _rcHeld = false;
  if (_rcPending) {
    _rcPending = false;
    renderControls();
  }
}
// Which controls to show: the stage's own function writes them into ctlEl and wires them (the page-straightening
// editor's are in js/guide/22-straighten.js, Colour along's marker list in 83-along.js, the rest in 51-53)
function _renderControls() {
  if (!ctlEl) return;
  dragPreview = false;
  if (paintOn && (sfmode !== 'guide' || family !== 'manual' || gTab !== 'pattern' || pgMode || cropMode))
    setPaint(false);
  if (pgMode) {
    pgControls();
    return;
  }
  if (sfmode === 'guide') ctlPlan();
  else if (sfmode === 'color') {
    if (focus) ctlFocus();
    else alongControls(); // the marker list: js/guide/83-along.js
  } else if (cropMode) ctlCrop();
  else ctlSections();
}
// a button in a one-choice group (data-v, pressed when on; greyed out when off)
function ctlSeg(v, label, on, off) {
  return (
    '<button class="sfedit' +
    (on ? ' on' : '') +
    '" data-v="' +
    v +
    '" aria-pressed="' +
    !!on +
    '"' +
    (off ? ' disabled' : '') +
    '>' +
    label +
    '</button>'
  );
}
// the edit tools are one choice: screen readers hear which is on
function editPressed() {
  ['sfEmToggle', 'sfEmMerge', 'sfEmSplit', 'sfEmAdd'].forEach(function (id) {
    const b = document.getElementById(id);
    if (b) b.setAttribute('aria-pressed', b.classList.contains('on') ? 'true' : 'false');
  });
}
