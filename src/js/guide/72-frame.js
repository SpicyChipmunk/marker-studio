/* ---- the guide screen's frame (Release 3, docs/GUIDE-LAYOUT.md) ----
    One column: the picture and its tool row are pinned at the top, the tabs under them and the bar at the bottom.
    In Plan and Edit sections the picture starts at 55% of the screen height and shrinks as the page scrolls, down to
    a floor (45%, or 40% under 780px tall); Colour along keeps a fixed 55% (45%). The in-flow height stays full: the
    pinned block sticks at a negative top, and the wrapper holding the canvas and every overlay (#sfPic) is moved
    down and scaled from its top centre, so nothing below it moves. Side by side (landscape, or wide screens) the
    picture fills its column and the tools sit beside or under it. Full screen, focus mode and Reveal keep their own
    layouts: the wrapper has no box there and #sfView stands in for it. */
let picBox = null,
  picEl = null,
  headEl = null,
  geo = { full: 0, comp: 0, side: false, shrink: false },
  picS = 1,
  picD = 0,
  _psRaf = 0,
  _sat = -1,
  renaming = false,
  _hdB = 0;
const SIDEQ = '(min-width:900px),(orientation:landscape) and (min-width:640px)';
// side by side: the picture on the left, the header, tabs, controls and bar on the right
function sideBySide() {
  try {
    return matchMedia(SIDEQ).matches;
  } catch (_) {
    return (window.innerWidth || 0) >= 900;
  }
}
// full screen, focus mode and Reveal: none of the pinning or shrinking applies
function fixedView() {
  return (
    !!root &&
    (root.classList.contains('sffull') ||
      root.classList.contains('sffoc') ||
      root.classList.contains('sfrev'))
  );
}
// the box the picture's overlays are placed in, and how much it is scaled right now
function picHost() {
  return fixedView() || !picEl ? sfView : picEl;
}
function picK() {
  return fixedView() ? 1 : picS || 1;
}
// a point on the screen, in the picture frame's own (unscaled) pixels
function picLocal(x, y) {
  const r = picHost().getBoundingClientRect(),
    k = picK();
  return { x: (x - r.left) / k, y: (y - r.top) / k };
}
// the top safe-area inset (notch, status bar), measured once per screen size
function safeTop() {
  if (_sat < 0) {
    const p = document.createElement('div');
    p.style.cssText =
      'position:fixed;top:0;left:0;width:0;height:env(safe-area-inset-top,0px);visibility:hidden;pointer-events:none';
    document.body.appendChild(p);
    _sat = p.offsetHeight || 0;
    p.remove();
  }
  return _sat;
}
// the guide card is showing: the page ends at the card, so the sticky bar never lifts off the bottom
function workOn(on) {
  const w = root && root.parentElement;
  if (w) w.classList.toggle('sfworkon', !!on);
}
// the picture's sizes: full and floor heights, the pinned block's offset, --pinH, and the controls' min-height
function frameSize() {
  if (!cv || !sfView || !picBox || !cv.width || !cv.height || !workEl || workEl.offsetParent === null) return;
  const side = sideBySide(),
    ar = cv.height / cv.width,
    tools = document.getElementById('sfZoomCtl'),
    vh = baseVH();
  workEl.classList.toggle('sfside', side);
  workEl.classList.toggle('sfalong', sfmode === 'color');
  workOn(!!workEl && workEl.style.display !== 'none');
  let full, cw;
  if (side) {
    const avail = Math.max(160, vh - 16),
      colW = sfView.clientWidth;
    workEl.classList.add('sftoolsv');
    const tw = tools ? tools.offsetWidth : 52;
    // tools stacked beside the picture when the column leaves 52px at its side, otherwise in a row under it
    if (colW - avail / ar >= Math.max(52, tw)) {
      full = Math.round(avail);
      cw = full / ar;
    } else {
      workEl.classList.remove('sftoolsv');
      const th = tools ? tools.offsetHeight : 40;
      full = Math.round(Math.min(avail - th, colW * ar));
      cw = full / ar;
    }
    geo = { full: full, comp: full, side: true, shrink: false };
  } else {
    workEl.classList.remove('sftoolsv');
    const vw = picBox.clientWidth || sfView.clientWidth,
      small = vh < 780,
      along = sfmode === 'color';
    full = Math.max(120, Math.min(Math.round(vw * ar), Math.round(vh * (along && small ? 0.45 : 0.55))));
    const comp = along ? full : Math.min(full, Math.round(vh * (small ? 0.4 : 0.45)));
    // on short screens (or with larger text) the start size is capped so the tool row ends above the bar at the top of
    // the page; never below the floor
    if (!along && headEl) {
      const bar = barEl(),
        top = (_hdB = headFoot()),
        cap = Math.floor(vh - (bar ? bar.offsetHeight : 60) - (tools ? tools.offsetHeight : 40) - top);
      full = Math.max(comp, Math.min(full, cap));
    }
    cw = Math.min(vw, full / ar);
    geo = { full: full, comp: comp, side: false, shrink: false };
    geo.shrink = geo.full > geo.comp;
  }
  cvSize(Math.round(cw), full);
  picBox.style.height = full + 'px';
  sfView.style.setProperty('--picShift', geo.full - geo.comp + 'px');
  document.documentElement.style.setProperty(
    '--pinH',
    side ? '0px' : geo.comp + (tools ? tools.offsetHeight : 0) + 'px',
  );
  picScroll();
  paneMin();
  touchRule();
  planFit();
}
// the picture's size on the screen; when it changes while zoomed in (a turn, a resize, a stage with another size) the
// pan keeps the same spot in the middle and is held inside the picture again, so no blank strip shows
// (measured against the new size, not the one the picture is still easing from)
function cvSize(w, h) {
  const ow = parseFloat(cv.style.width) || 0,
    oh = parseFloat(cv.style.height) || 0;
  cv.style.width = w + 'px';
  cv.style.height = h + 'px';
  if (!ow || !oh || (ow === w && oh === h) || focus) return;
  if (zoom > 1) {
    panX = Math.min(0, Math.max(w - w * zoom, (panX * w) / ow));
    panY = Math.min(0, Math.max(h - h * zoom, (panY * h) / oh));
  } else {
    panX = 0;
    panY = 0;
  }
  applyXform();
}
// the foot of the header on the page (offsets: the page's switch animation moves it with a transform meanwhile)
function headFoot() {
  let y = headEl.offsetHeight;
  for (let n = headEl; n; n = n.offsetParent) y += n.offsetTop;
  return y;
}
// the shrink itself: d is how far the pinned block has gone past the top, at most full − floor
function picScroll() {
  _psRaf = 0;
  if (!picEl || !sfView) return;
  let d = 0;
  if (geo.shrink && !fixedView()) {
    const r = sfView.getBoundingClientRect();
    d = Math.max(0, Math.min(geo.full - geo.comp, safeTop() - r.top));
  }
  d = Math.round(d * 100) / 100;
  const s = geo.full ? Math.round(((geo.full - d) / geo.full) * 1e5) / 1e5 : 1;
  if (d === picD && s === picS) {
    // (the page scrolled but the picture kept its size: an open sheet still follows the picture's foot)
    if (sheetO) placeSheet();
    return;
  }
  picD = d;
  picS = s;
  picEl.style.transform = d ? 'translateY(' + d + 'px) scale(' + s + ')' : '';
  if (sheetO) placeSheet();
}
function onPageScroll() {
  if (!_psRaf) _psRaf = requestAnimationFrame(picScroll);
}
// full screen, focus mode and Reveal take the picture out of the page, which gets shorter meanwhile: coming back
// returns to the same place (and so the same picture size)
let _fixY = null;
function holdScroll() {
  _fixY = window.scrollY;
}
function backScroll() {
  if (_fixY == null) return;
  const y = _fixY;
  _fixY = null;
  window.scrollTo(0, y);
  picScroll();
}
// A change of stage (Edit sections ↔ Plan ↔ Colour along) starts at the top of the new stage: the header at the top
// of the screen when the stage's first row still shows above the bar that way, else that first row just under the
// pinned block; side by side, the picture pinned. The picture starts whole (zoom and pan reset). It clears the last
// stage's toast, and from the keyboard focus goes to the new stage's first control. Opening a guide side by side
// pins the picture (its foot is off a landscape phone's screen under the app header otherwise). Called by
// renderControls; stageGo() marks the change as the person's (Build guide, ← Edit sections, Colour along, Done
// colouring), not a guide being opened.
let _stg = null,
  _kbd = false,
  _stgGo = false;
function stageGo() {
  _stgGo = true;
}
function stageCheck() {
  if (!workEl || workEl.style.display === 'none') {
    _stg = null;
    return;
  }
  const was = _stg;
  _stg = { m: sfmode, g: loadGen };
  if (was && was.g === loadGen && was.m === sfmode) return;
  // every stage starts at the whole picture, as full screen and focus mode do
  if (was && was.g === loadGen) resetZoom();
  const chg = !!(was && was.g === loadGen && _stgGo);
  _stgGo = false;
  if (chg) hideToast();
  if (!chg && !sideBySide()) return;
  const kb = chg && _kbd;
  requestAnimationFrame(function () {
    if (chg) stageTop(kb);
    else pinPicture();
  });
}
function stageTop(kb) {
  if (!workEl || workEl.offsetParent === null || fixedView() || !headEl) return;
  sizeCanvas();
  const st = safeTop(),
    ih = window.innerHeight || 0,
    y = window.scrollY,
    hd = headEl.getBoundingClientRect().top + y;
  let S;
  if (geo.side) S = hd - (parseFloat(getComputedStyle(sfView).top) || 0);
  else {
    S = hd - st;
    const bar = barEl(),
      bh = bar ? bar.offsetHeight : 0,
      f = stageFirst();
    if (f) {
      const r = f.el.getBoundingClientRect(),
        F = r.top + y + f.mt;
      if (F + f.h - S > ih - bh - 4)
        S = F - st - (parseFloat(document.documentElement.style.getPropertyValue('--pinH')) || 0) - f.gap;
    }
  }
  S = Math.max(0, Math.min(Math.max(0, document.documentElement.scrollHeight - ih), Math.round(S)));
  if (Math.abs(S - y) > 0.5) window.scrollTo(0, S);
  picScroll();
  if (kb && ctlEl) {
    const c = [].slice
      .call(ctlEl.querySelectorAll('button,[href],input,select,textarea,[tabindex]'))
      .find(function (x) {
        return !x.disabled && x.tabIndex >= 0 && x.getClientRects().length > 0;
      });
    if (c)
      try {
        c.focus({ preventScroll: true });
      } catch (_) {}
  }
}
// the stage's first row: Plan's tabs (where they pin), else the first thing shown in the controls
function stageFirst() {
  if (!ctlEl) return null;
  const sen = ctlEl.querySelector('.sftabsen'),
    tb = ctlEl.querySelector('.sftabs');
  if (sen && tb)
    return { el: sen, mt: parseFloat(getComputedStyle(tb).marginTop) || 0, h: tb.offsetHeight, gap: 0 };
  const p = ctlEl.querySelector('.sfpane') || ctlEl;
  for (let i = 0; i < p.children.length; i++) {
    const c = p.children[i];
    if (c.offsetHeight > 0) return { el: c, mt: 0, h: Math.min(c.offsetHeight, 60), gap: 8 };
  }
  return null;
}
// Each tab (and the controls of Edit sections and Colour along) is at least as tall as the room between the pinned
// block and the bar, so a short tab can't make the page shorter than where the tabs pin
// the bottom bar lives in the controls' markup but is moved to the end of the whole guide card: a sticky element
// can't leave its container, so inside the controls it was held below the screen on short phones at the top of the page
function dockBar() {
  if (!ctlEl || !workEl) return;
  const nb = ctlEl.querySelector('.sfbar'),
    old = barEl();
  if (old && old !== nb) old.remove();
  if (nb) workEl.appendChild(nb);
}
function barEl() {
  return workEl ? workEl.querySelector(':scope>.sfbar') : null;
}
function paneMin() {
  if (!ctlEl || !workEl) return;
  const ih = window.innerHeight || 0,
    bar = barEl(),
    tabs = ctlEl.querySelector('.sftabs'),
    top =
      safeTop() + (geo.side ? 0 : parseFloat(document.documentElement.style.getPropertyValue('--pinH')) || 0);
  const bh = bar ? bar.offsetHeight + (parseFloat(getComputedStyle(bar).marginTop) || 0) : 0;
  workEl.style.setProperty('--paneMin', Math.max(0, Math.ceil(ih - top - bh)) + 'px');
  workEl.style.setProperty(
    '--tabMin',
    Math.max(0, Math.ceil(ih - top - (tabs ? tabs.offsetHeight : 0) - bh)) + 'px',
  );
}
// Switching tabs never moves anything: when the tabs are pinned, the new tab opens at its top with them still pinned
function switchTab(t) {
  if (!ctlEl) return;
  const tabs = ctlEl.querySelector('.sftabs'),
    sen = ctlEl.querySelector('.sftabsen');
  let th = null;
  if (tabs && sen) {
    const mt = parseFloat(getComputedStyle(tabs).marginTop) || 0,
      top = parseFloat(getComputedStyle(tabs).top) || 0,
      nat = sen.getBoundingClientRect().top + mt;
    if (nat <= top + 0.5) th = window.scrollY + (nat - top);
  }
  gTab = t;
  // leaving the Pattern tab finishes lining up the photo, and closes the zone editor (whose place it takes)
  if (t !== 'pattern') {
    photoEndAlign();
    if (zoneEdit) {
      zoneEditEnd();
      return switchTab(t);
    }
  }
  ctlEl.querySelectorAll('.sftabbtn').forEach(function (x) {
    const on = x.dataset.t === gTab;
    x.classList.toggle('on', on);
    x.setAttribute('aria-selected', on ? 'true' : 'false');
    x.tabIndex = on ? 0 : -1;
  });
  ctlEl.querySelectorAll('.sftab').forEach(function (pn) {
    pn.style.display = pn.dataset.tab === gTab ? '' : 'none';
  });
  if (th != null) window.scrollTo(0, Math.round(th));
  picScroll();
  fitPairs();
  // (Radial's centre shows on the Pattern tab only)
  positionRadC();
}
// does a button's label need more room than it has? A button that centres its label (as Share's do) overflows on
// both sides, and Safari's engine doesn't count that in scrollWidth (it stays equal to clientWidth), so the text is
// measured too
function labelTooWide(b) {
  if (b.scrollWidth > b.clientWidth + 1) return true;
  const cs = getComputedStyle(b),
    room = b.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0),
    r = document.createRange();
  r.selectNodeContents(b);
  return r.getBoundingClientRect().width > room + 1;
}
// Share's button pairs (✨ Reveal & share and Save image; Blend plan and Save as palette) stack full width when either
// label would take two lines (large text sizes, narrow phones)
function fitPairs() {
  if (!ctlEl) return;
  ctlEl.querySelectorAll('.sftab[data-tab="share"] .sfrow2').forEach(function (r) {
    if (r.offsetParent === null) return;
    r.classList.remove('sfstack');
    r.classList.add('sfmeas');
    const wide = [].some.call(r.children, labelTooWide);
    r.classList.remove('sfmeas');
    r.classList.toggle('sfstack', wide);
  });
  // Mood's six choices: one row where every label fits, else two rows of three
  const six = ctlEl.querySelector('.sfsix');
  if (six && six.offsetParent !== null) {
    six.classList.remove('sfsix3');
    six.classList.toggle('sfsix3', [].some.call(six.children, labelTooWide));
  }
}
// Drag to scroll: at zoom 1 a vertical drag on the picture scrolls the page, unless the picture needs one-finger drags
// (zoomed in, Paint, a sheet open, drawing in Edit sections, cropping or straightening, lining up a photo). The sun
// is its own element and never scrolls; in Blend a drag that starts on an anchor dot moves it (see frameInit).
// Tabs: the arrow keys (and Home, End) move between them; the chosen tab is the only stop for Tab
function tabKey(e) {
  const b = e.target.closest && e.target.closest('.sftabbtn');
  if (!b) return;
  const all = [].slice.call(ctlEl.querySelectorAll('.sftabbtn')),
    i = all.indexOf(b);
  let j = -1;
  if (e.key === 'ArrowRight') j = (i + 1) % all.length;
  else if (e.key === 'ArrowLeft') j = (i + all.length - 1) % all.length;
  else if (e.key === 'Home') j = 0;
  else if (e.key === 'End') j = all.length - 1;
  if (j < 0) return;
  e.preventDefault();
  const t = all[j].dataset.t;
  if (paintOn && t !== 'pattern') {
    setPaint(false);
    planTab(t);
    renderControls();
  } else planTab(t);
  const nb = ctlEl.querySelector('.sftabbtn[data-t="' + t + '"]');
  if (nb)
    try {
      nb.focus({ preventScroll: true });
    } catch (_) {}
}
function touchRule() {
  if (!picBox) return;
  const none =
    zoom > 1.001 ||
    paintOn ||
    zoneEditOn() ||
    !!sheetO ||
    cropMode ||
    pgMode ||
    (sfmode === 'review' && (editMode === 'split' || editMode === 'add')) ||
    (sfmode === 'guide' && photoAlign);
  const v = none ? 'none' : 'pan-y';
  if (picBox.style.touchAction !== v) picBox.style.touchAction = v;
}

/* ---- #5 the header row: name (✎ renames it in place) over where it's saved, ✨ Surprise in Plan, and ⋯ ---- */
function renderHead() {
  if (!headEl) return;
  const plan = sfmode === 'guide' && !!assignData && !pgMode && !cropMode,
    nm = (curName && curName.trim()) || 'New guide';
  const old = document.getElementById('sfGName'),
    val = old ? old.value : curName || '',
    ae = document.activeElement,
    fid = ae && ae.id && headEl.contains(ae) ? ae.id : null,
    sel = old && ae === old ? [old.selectionStart, old.selectionEnd] : null;
  let h = '<div class="sfhrow"><div class="sfgname">';
  if (renaming)
    h +=
      '<div class="sfrename"><input type="text" id="sfGName" aria-label="Guide name" placeholder="Guide name" maxlength="120" autocomplete="off" value="' +
      esc(val) +
      '"><button type="button" id="sfNameRoll" class="sfibtn" title="Suggest another name" aria-label="Suggest another name">⚄</button></div>';
  else
    h +=
      '<div class="sfgt"><strong id="sfGTitle" tabindex="-1">' +
      esc(nm) +
      '</strong><button type="button" id="sfRename" class="sfibtn" title="Rename" aria-label="Rename the guide"><span aria-hidden="true">✎</span></button></div>';
  // the status line keeps one height whatever it says (Safari has no scroll anchoring: a header that grew or shrank
  // would move everything under it): the longest states are laid out, unseen, in the same place
  h +=
    '<div class="sfgst"><div class="sfgsv"><span id="sfSaveSt" class="sfsavest"></span><button type="button" id="sfSave" class="sfsave" style="display:none">Save</button></div>' +
    HEADGHOST +
    '</div></div>';
  if (plan)
    h +=
      '<button type="button" id="sfSurprise" class="sfsurprise" title="New colours and style" aria-label="Surprise: new colours and style"><span aria-hidden="true">✨</span><span class="sfsl" aria-hidden="true"> Surprise</span></button>';
  h +=
    '<button type="button" id="sfMore" class="sfmore" aria-label="More" aria-haspopup="dialog">⋯</button></div>';
  headEl.innerHTML = h;
  saveStatus();
  fitHead();
  if (fid) {
    const el = document.getElementById(fid);
    if (el)
      try {
        el.focus({ preventScroll: true });
        if (sel && el.setSelectionRange) el.setSelectionRange(sel[0], sel[1]);
      } catch (_) {}
  }
  if (_focOpen) focusOpened();
}
// A guide opened from a dialog that closed (the welcome's Try the sample, boot.js) would leave focus on the page
// itself: once the guide shows, focus goes to its name (SF.focusOnOpen asks for this, for the next 15 seconds)
let _focOpen = 0;
function focusOnOpen() {
  _focOpen = Date.now();
}
function focusOpened() {
  if (Date.now() - _focOpen > 15000) {
    _focOpen = 0;
    return;
  }
  const t = document.getElementById('sfGTitle'),
    a = document.activeElement;
  if (!t || !workEl || workEl.offsetParent === null || (a && a !== document.body && a !== t)) return;
  _focOpen = 0;
  try {
    t.focus({ preventScroll: true });
  } catch (_) {}
}
const HEADGHOST =
  '<div class="sfgsg" aria-hidden="true"><span class="sfsavest">Saved in your Library ✓</span></div><div class="sfgsg" aria-hidden="true"><span class="sfsavest">Not saved yet</span><button type="button" class="sfsave" tabindex="-1">Save</button></div><div class="sfgsg" aria-hidden="true"><span class="sfsavest">Not saved — storage is full</span></div>';
// ✨ Surprise drops its word before the name gets squeezed below about 140px (large text sizes) or the status line
// would wrap, and while renaming: so the header is as tall renaming as not
function fitHead() {
  const sp = document.getElementById('sfSurprise'),
    g = headEl && headEl.querySelector('.sfgname');
  if (!sp || !g || g.offsetParent === null) return;
  sp.classList.remove('sfic');
  if (renaming || g.offsetWidth < 140 || headWraps()) sp.classList.add('sfic');
}
// the status line's longest state takes more than one line
function headWraps() {
  const g = headEl.querySelector('.sfgst'),
    t = g && g.querySelector('.sfgsg .sfsavest'),
    p = g && g.querySelector('.sfgsg .sfsave');
  if (!t) return false;
  const line = Math.max(p ? p.offsetHeight : 0, parseFloat(getComputedStyle(t).lineHeight) || 0);
  return !!line && g.offsetHeight > line * 1.5;
}
function startRename() {
  hideTip();
  renaming = true;
  renderHead();
  const i = document.getElementById('sfGName');
  if (i)
    try {
      i.focus({ preventScroll: true });
      i.select();
    } catch (_) {}
}
// Enter or leaving the field keeps the new name; Escape leaves it as it was (and does nothing else: layers.js leaves an
// Escape in this field to headKey)
function endRename(keep) {
  if (!renaming) return;
  const i = document.getElementById('sfGName'),
    v = i ? i.value.trim().slice(0, 120) : '',
    had = !!(i && headEl.contains(document.activeElement));
  renaming = false;
  if (keep && v && v !== curName) {
    curName = v;
    guideDirty = true;
    scheduleAutosave();
    sayLive('Renamed to ' + v);
  }
  renderHead();
  if (had) {
    const b = document.getElementById('sfRename');
    if (b)
      try {
        b.focus({ preventScroll: true });
      } catch (_) {}
  }
}
// any button but ⚄ first keeps a name being typed (so ⋯ shows the new name), then does its own thing
function headClick(e) {
  const b = e.target.closest('button');
  if (!b || !headEl.contains(b)) return;
  const id = b.id;
  if (renaming && id !== 'sfNameRoll' && id !== 'sfRename') {
    endRename(true);
    const nb = id && document.getElementById(id);
    if (nb)
      try {
        nb.focus({ preventScroll: true });
      } catch (_) {}
  }
  if (id === 'sfRename') startRename();
  else if (id === 'sfNameRoll') {
    const i = document.getElementById('sfGName');
    if (!i) return;
    const hx = [];
    if (assignData) for (const l in assignData.assign) hx.push(assignData.assign[l].hex);
    i.value = evoName(hx, Date.now(), usedGuideNames(curName));
    try {
      i.focus({ preventScroll: true });
    } catch (_) {}
  } else if (id === 'sfSave') saveGuide();
  else if (id === 'sfSurprise') surprise();
  else if (id === 'sfMore') openMenu();
}
function headKey(e) {
  if (e.target.id !== 'sfGName') return;
  if (e.key === 'Enter') {
    e.preventDefault();
    endRename(true);
  } else if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    endRename(false);
  }
}
function headBlur() {
  setTimeout(function () {
    const a = document.activeElement;
    if (renaming && !(a && a.closest && a.closest('.sfrename'))) endRename(true);
  }, 0);
}

/* ---- #4 the tool row under the picture ---- */
const TIC = {
  codes:
    '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="2.5" y="5" width="15" height="10" rx="2.5"/><path d="M6 12.2V7.8M6 7.8l2.2 4.4M8.2 7.8v4.4M11.5 10h3" stroke-linecap="round"/></svg>',
  values:
    '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="2.5" y="4" width="5" height="12" rx="1" fill="currentColor" fill-opacity=".95"/><rect x="7.5" y="4" width="5" height="12" fill="currentColor" fill-opacity=".55"/><rect x="12.5" y="4" width="5" height="12" rx="1" fill="currentColor" fill-opacity=".2"/><rect x="2.5" y="4" width="15" height="12" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>',
  minus:
    '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  plus: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h12M10 4v12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  fit: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 8V4h4M16 8V4h-4M4 12v4h4M16 12v4h-4"/></svg>',
  full: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M3 7V3h4M17 7V3h-4M3 13v4h4M17 13v4h-4"/><rect x="7" y="7" width="6" height="6" rx="1"/></svg>',
};
function toolsHTML() {
  return (
    '<div id="sfZoomCtl" class="sftools" role="toolbar" aria-label="Picture"><div class="sfprog" aria-hidden="true"><i id="sfToolProg"></i></div>' +
    '<button type="button" id="sfPlanUndo" class="sfz sfzundo" style="display:none" aria-label="Undo"><span aria-hidden="true">↶</span><span class="sfzul">Undo</span></button><span id="sfStat" class="sfstat"></span>' +
    '<button type="button" id="sfPhPeek" class="sfz" style="display:none" aria-pressed="false" aria-label="Show the photo on top" title="Photo"><span aria-hidden="true">◐</span></button>' +
    '<button type="button" id="sfCodes" class="sfz" aria-pressed="true" aria-label="Marker codes" title="Marker codes">' +
    TIC.codes +
    '</button><button type="button" id="sfVals" class="sfz" aria-pressed="false" aria-label="Values: the picture in greys, to judge its light and dark" title="Values (light and dark)">' +
    TIC.values +
    '</button><button type="button" id="sfZout" class="sfz" aria-label="Zoom out">' +
    TIC.minus +
    '</button><button type="button" id="sfZin" class="sfz" aria-label="Zoom in">' +
    TIC.plus +
    '</button><button type="button" id="sfZrst" class="sfz" aria-label="Fit the picture" style="display:none">' +
    TIC.fit +
    '</button><button type="button" id="sfFull" class="sfz sfzfull" aria-label="Full screen" title="Full screen">' +
    TIC.full +
    '</button></div>'
  );
}
// the status (sections and markers, or how much is done) and the buttons that come and go. The status is in parts
// that are dropped whole when the row is tight (planFit), never cut mid-number; side by side only the first shows.
function renderTools() {
  const st = document.getElementById('sfStat');
  if (!st) return;
  let t = '',
    pct = 0;
  const guide = !!assignData && !pgMode && !cropMode,
    n = function (v, one, many) {
      return '<b>' + v + '</b> ' + (v === 1 ? one : many);
    },
    part = function (a, b) {
      return '<span class="sfsp1">' + a + '</span>' + (b ? '<span class="sfsp2"> ' + b + '</span>' : '');
    };
  if (sfmode === 'color' && guide) {
    let d = 0;
    assignData.order.forEach(function (l) {
      if (colored[l]) d++;
    });
    pct = assignData.N ? Math.round((d / assignData.N) * 100) : 0;
    t = part('<b>' + d + '</b> of <b>' + assignData.N + '</b>', 'done');
  } else if (sfmode === 'guide' && guide) {
    const mk = {};
    for (const l in assignData.assign) mk[assignData.assign[l].mkey] = 1;
    t = part(n(assignData.N, 'section', 'sections'), '· ' + n(Object.keys(mk).length, 'marker', 'markers'));
  } else if (sfmode === 'review' && labels && !pgMode && !cropMode && countEl)
    t = part(n(parseInt(countEl.textContent, 10) || 0, 'section', 'sections'));
  if (workEl) workEl.classList.toggle('sfalong', sfmode === 'color');
  if (st.innerHTML !== t) st.innerHTML = t;
  const pr = document.getElementById('sfToolProg');
  if (pr) {
    pr.style.width = pct + '%';
    pr.style.setProperty('--prog', pct + '%');
  }
  const cb = document.getElementById('sfCodes'),
    onGuide = guide && (sfmode === 'guide' || sfmode === 'color');
  if (cb) {
    cb.style.display = onGuide ? '' : 'none';
    cb.setAttribute('aria-pressed', hideLabels ? 'false' : 'true');
  }
  // Values: greys over the guide only (the sections editor's colours are a map, not the guide)
  const vb = document.getElementById('sfVals');
  if (vb) {
    vb.style.display = onGuide ? '' : 'none';
    vb.setAttribute('aria-pressed', valuesOn ? 'true' : 'false');
  }
  if (root) root.classList.toggle('sfvals', valuesOn && onGuide);
  // the tool row stays while cropping (its zoom helps draw the box; the row going would move the pinned layout), but
  // without Full screen, which can't open there
  const zc = document.getElementById('sfZoomCtl');
  if (zc && cropMode && zc.style.display === 'none') zc.style.display = '';
  const fb = document.getElementById('sfFull');
  if (fb) fb.style.display = cropMode ? 'none' : '';
  fitBtn();
  planBtn();
}
// Fit only while zoomed in (focus mode keeps it: it frames the section again)
function fitBtn() {
  const b = document.getElementById('sfZrst');
  if (b) b.style.display = zoom > 1.001 || focus ? '' : 'none';
}

/* ---- #6 the bar: two buttons on one row; the back button reads "← Sections" when both don't fit ---- */
function fitBar() {
  const bar = barEl();
  if (!bar || bar.offsetParent === null) return;
  const sh = bar.querySelectorAll('[data-short]');
  sh.forEach(function (b) {
    b.textContent = b.dataset.long;
  });
  if (bar.scrollWidth > bar.clientWidth + 1)
    sh.forEach(function (b) {
      b.textContent = b.dataset.short;
    });
}

/* ---- sheets: one panel for menus and pickers ----
    Portrait: from the bottom of the pinned picture block to the bottom of the screen, so it covers the tabs, controls
    and bar but never the picture (the page first scrolls so the picture is pinned at its floor size, and scrolls
    back on close). Side by side: over the controls column. A header (title and an optional field), a scrolling body,
    and a footer. While it's open the page doesn't scroll (pinch and pan on the picture still work), Escape closes
    it, and focus goes into it and back to what opened it.
    o: {title, field (HTML), body (HTML), foot (HTML), label, pin (false: don't scroll), restore (false: stay), onClose,
    opener (what focus goes back to, when not what has it now), tipSec (the section whose tip opened it), fit (as tall
    as its content, up to the usual height: menus)} */
let sheetO = null;
// a toast still showing from before (its Undo would act on the sheet, not what it said) goes
function openSheet(o) {
  closeSheet();
  o = o || {};
  const op = o.opener || document.activeElement,
    y0 = window.scrollY;
  hideTip();
  hideToast();
  if (o.pin !== false) pinPicture();
  const el = document.createElement('div');
  el.className = 'sfsheet';
  el.id = 'sfSheet';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-labelledby', 'sfSheetT');
  el.innerHTML =
    '<div class="sfshhd"><h3 id="sfSheetT">' +
    esc(o.title || '') +
    '</h3>' +
    (o.field || '') +
    '</div><div class="sfshbody">' +
    (o.body || '') +
    '</div>' +
    (o.foot ? '<div class="sfshft">' + o.foot + '</div>' : '');
  root.appendChild(el);
  sheetO = { el: el, o: o, opener: op, y0: y0, y1: window.scrollY };
  document.documentElement.classList.add('sfsheeton');
  placeSheet();
  // (and again a frame later: Safari can settle the scroll that pinned the picture, and the page's overflow, after
  // this frame, leaving a gap of a few pixels between the picture and the sheet)
  requestAnimationFrame(function () {
    if (sheetO && sheetO.el === el) placeSheet();
  });
  touchRule();
  el.addEventListener('keydown', sheetTab);
  const f =
    el.querySelector('[autofocus]') ||
    el.querySelector('.sfshbody button,.sfshbody input,.sfshbody select,.sfshft button');
  try {
    (f || el).focus({ preventScroll: true });
  } catch (_) {}
  return el;
}
// Close the sheet (quietly: no onClose). Focus goes back to what opened it: the same control (found again by its id
// when the controls were redrawn meanwhile); for one that was in a section's tip, from the keyboard, the tip again;
// else ⋯. The page itself (<body>) never counts as the opener.
function closeSheet(quiet) {
  const S = sheetO;
  if (!S) return;
  sheetO = null;
  const had = S.el.contains(document.activeElement);
  S.el.remove();
  document.documentElement.classList.remove('sfsheeton', 'sfsheetsd');
  touchRule();
  if (S.o.restore !== false && S.y1 !== S.y0 && Math.abs(window.scrollY - S.y1) < 2) {
    window.scrollTo(0, S.y0);
    picScroll();
  }
  if (had || !document.activeElement || document.activeElement === document.body) {
    const ok = function (x) {
      return !!(x && x !== document.body && x.isConnected && x.getClientRects().length && !x.disabled);
    };
    let t = S.opener;
    if (!ok(t) && t && t.id) t = document.getElementById(t.id);
    if (
      !ok(t) &&
      S.o.tipSec > 0 &&
      _kbd &&
      sfmode === 'guide' &&
      assignData &&
      assignData.assign[S.o.tipSec] &&
      !popCtx
    ) {
      showTip(S.o.tipSec, true, true);
      t = tipEl && tipEl.querySelector('[data-a="change"]');
    }
    if (!ok(t)) t = document.getElementById('sfMore');
    if (!ok(t)) t = cv;
    if (t)
      try {
        t.focus({ preventScroll: true });
      } catch (_) {}
  }
  if (!quiet && S.o.onClose) S.o.onClose();
}
function sheetOpen() {
  return !!sheetO;
}
// scroll so the picture is pinned at its floor size (portrait), or at its pinned top side by side (where the app
// header above it would otherwise push its foot off a landscape phone's screen)
function pinPicture() {
  if (!sfView || fixedView() || !workEl || workEl.offsetParent === null) return;
  const r = sfView.getBoundingClientRect(),
    want = geo.side ? parseFloat(getComputedStyle(sfView).top) || 0 : safeTop() - (geo.full - geo.comp);
  if (r.top > want + 0.5) {
    window.scrollTo(0, Math.round(window.scrollY + r.top - want));
    picScroll();
  }
}
// Portrait it is as wide as the guide card and its side margins (the whole screen on a phone, the card's column on a
// tablet). Toasts raised while it is open sit over the picture, never over the sheet (--shTop, --shL: 06-guide-extra.css).
function placeSheet() {
  if (!sheetO) return;
  const el = sheetO.el,
    s = el.style,
    de = document.documentElement;
  if (geo.side && ctlEl) {
    const r = ctlEl.getBoundingClientRect(),
      v = sfView.getBoundingClientRect();
    s.top = '0px';
    s.maxHeight = '';
    s.width = '';
    s.right = '';
    s.left = Math.round(Math.max(v.right + 4, r.left - 10)) + 'px';
    el.classList.add('sfshside');
  } else {
    const vw = window.innerWidth || 0,
      wr = workEl ? workEl.getBoundingClientRect() : null;
    let L = 0,
      w = vw;
    if (wr && wr.width > 0) {
      const g = Math.min(18, Math.max(0, wr.left));
      L = Math.max(0, Math.round(wr.left - g));
      w = Math.min(vw - L, Math.round(wr.width + 2 * g));
    }
    s.left = L + 'px';
    s.width = w + 'px';
    s.right = 'auto';
    const t = Math.round(Math.max(0, sfView ? sfView.getBoundingClientRect().bottom : 0));
    if (sheetO.o.fit) {
      s.top = 'auto';
      s.maxHeight = Math.max(0, (window.innerHeight || 0) - t) + 'px';
    } else s.top = t + 'px';
    el.classList.remove('sfshside');
  }
  de.classList.toggle('sfsheetsd', el.classList.contains('sfshside'));
  de.style.setProperty(
    '--shTop',
    (el.classList.contains('sfshside') ? 0 : Math.round((window.innerHeight || 0) - el.offsetHeight)) + 'px',
  );
  de.style.setProperty('--shL', (parseFloat(s.left) || 0) + 'px');
}
// Tab stays inside the open sheet
function sheetTab(e) {
  if (e.key !== 'Tab' || !sheetO) return;
  const f = [].slice
    .call(sheetO.el.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])'))
    .filter(function (x) {
      return !x.disabled && x.getClientRects().length;
    });
  if (!f.length) return;
  const a = f[0],
    b = f[f.length - 1];
  if (e.shiftKey && document.activeElement === a) {
    e.preventDefault();
    b.focus();
  } else if (!e.shiftKey && document.activeElement === b) {
    e.preventDefault();
    a.focus();
  }
}

/* ---- the ⋯ menu: new or open something, this guide's copy and reset, help ---- */
function openMenu() {
  const plan = sfmode === 'guide' && !!assignData,
    along = sfmode === 'color' && !focus && !!assignData,
    it = function (m, label, id, off) {
      return (
        '<button type="button" class="sfmitem" data-m="' +
        m +
        '"' +
        (id ? ' id="' + id + '"' : '') +
        (off ? ' aria-disabled="true"' : '') +
        '>' +
        label +
        '</button>'
      );
    };
  let b =
    '<div class="sfmenu" role="group" aria-labelledby="sfMh1"><div class="sfmh" id="sfMh1">New</div>' +
    it('pick', 'Choose a photo') +
    it('sample', 'Try the sample') +
    it('lib', 'Open from Library') +
    it('import', 'Import a guide') +
    '</div>';
  const g =
    (plan && libEntry() ? it('copy', 'Save a copy', 'sfSaveCopy') : '') +
    (along ? it('reset', 'Reset progress', 'sfResetP', !progressCount()) : '');
  if (g)
    b +=
      '<div class="sfmenu" role="group" aria-labelledby="sfMh2"><div class="sfmh" id="sfMh2">This guide</div>' +
      g +
      '</div>';
  b +=
    '<div class="sfmenu" role="group" aria-labelledby="sfMh3"><div class="sfmh" id="sfMh3">Help</div>' +
    it('help', 'Help') +
    '</div>';
  const el = openSheet({
    title: (curName && curName.trim()) || 'New guide',
    body: b,
    foot: '<button type="button" class="sfghost" data-m="close">Close</button>',
    fit: true,
  });
  el.classList.add('sfmenush');
  el.addEventListener('click', function (e) {
    const x = e.target.closest('[data-m]');
    if (x && x.getAttribute('aria-disabled') !== 'true') menuDo(x.dataset.m);
  });
}
function menuDo(m) {
  closeSheet();
  const imp = document.getElementById('sfImpFile');
  if (m === 'pick') {
    if (fileEl) fileEl.click();
  } else if (m === 'sample') loadSample();
  else if (m === 'lib') {
    if (api.openLibrary) api.openLibrary();
  } else if (m === 'import') {
    if (imp) imp.click();
  } else if (m === 'copy') saveGuide();
  else if (m === 'reset') askResetProgress();
  else if (m === 'help') {
    if (typeof window.openHelpSheet === 'function') window.openHelpSheet();
  }
}

/* ---- #8 one-time hints ----
    Helper text shows in full the first time on this device, then as a one-line ⓘ that opens in place (hintSeen,
    markHint and infoLineHTML in core.js, shared with Markers' hint); a hint first shown in this visit stays in full
    until reload. */
const _hNow = {},
  _hOpen = {},
  _hTxt = {};
// short and long are HTML. once: a hint that is shown the first time only (it is in Help after that).
function infoLine(id, short, long, once) {
  if (!hintSeen(id)) {
    markHint(id);
    _hNow[id] = 1;
  }
  const first = !!_hNow[id];
  if (once) {
    return first
      ? '<div class="sfinfo sfonce" data-hint="' +
          esc(id) +
          '"><span class="sfi" aria-hidden="true">i</span><span class="sfit">' +
          long +
          '</span></div>'
      : '';
  }
  _hTxt[id] = { s: short, l: long };
  return infoLineHTML(_hOpen[id] !== undefined ? _hOpen[id] : first, short, long, id);
}
function toggleInfo(b) {
  const id = b.dataset.info,
    t = _hTxt[id];
  if (!t) return;
  const open = b.getAttribute('aria-expanded') !== 'true';
  _hOpen[id] = open;
  b.classList.toggle('open', open);
  b.setAttribute('aria-expanded', open ? 'true' : 'false');
  const s = b.querySelector('.sfit');
  if (s) s.innerHTML = open ? t.l : t.s;
}

// wiring that lives as long as the guide screen
function frameInit() {
  if (headEl) {
    headEl.addEventListener('click', headClick);
    headEl.addEventListener('keydown', headKey);
    headEl.addEventListener('focusout', headBlur);
    headEl.addEventListener('pointerdown', function (e) {
      if (e.target.closest('#sfNameRoll') || (renaming && e.target.closest('button'))) e.preventDefault();
    });
  }
  const cb = document.getElementById('sfCodes');
  if (cb)
    cb.addEventListener('click', function () {
      hideLabels = !hideLabels;
      renderGuide();
      renderTools();
    });
  const vb = document.getElementById('sfVals');
  if (vb)
    vb.addEventListener('click', function () {
      valuesOn = !valuesOn;
      renderTools();
      if (typeof sayLive === 'function') sayLive(valuesOn ? 'Values on: the picture in greys' : 'Values off');
    });
  root.addEventListener('click', function (e) {
    const b = e.target.closest('[data-info]');
    if (b && root.contains(b)) toggleInfo(b);
  });
  // two fingers on the picture always pinch and pan it, also where one finger would scroll the page; in Blend a finger
  // that starts on an anchor dot drags the dot instead
  if (picBox)
    ['touchstart', 'touchmove'].forEach(function (ev) {
      picBox.addEventListener(
        ev,
        function (e) {
          if (!e.cancelable || !e.touches) return;
          if (e.touches.length > 1) {
            e.preventDefault();
            return;
          }
          if (
            ev === 'touchstart' &&
            sfmode === 'guide' &&
            family === 'blend' &&
            !shadeFlatMode &&
            labels &&
            cv
          ) {
            const q = e.touches[0],
              r = cv.getBoundingClientRect(),
              P = {
                x: Math.floor(((q.clientX - r.left) / r.width) * W),
                y: Math.floor(((q.clientY - r.top) / r.height) * H),
              };
            if (anchorAt(P) >= 0) e.preventDefault();
          }
        },
        { passive: false },
      );
    });
  // which way the last input came (a stage change from the keyboard moves focus into the new stage)
  document.addEventListener(
    'keydown',
    function (e) {
      if (e.key !== 'Shift' && e.key !== 'Control' && e.key !== 'Alt' && e.key !== 'Meta') _kbd = true;
    },
    true,
  );
  document.addEventListener(
    'pointerdown',
    function () {
      _kbd = false;
    },
    true,
  );
  if (ctlEl) {
    ctlEl.addEventListener('keydown', tabKey);
    // a press and hold on the picture scrolls Colour along's list to its marker under the still finger: the click
    // that follows the lift must not open another row
    ctlEl.addEventListener(
      'click',
      function (e) {
        if (Date.now() - _holdAt < 400 && e.target.closest && e.target.closest('#sfAlist')) {
          e.stopPropagation();
          e.preventDefault();
        }
      },
      true,
    );
  }
  window.addEventListener('scroll', onPageScroll, { passive: true });
  // the capped start size depends on where the header is on the page: when something above it changes height, size
  // the picture again
  if (window.ResizeObserver)
    new ResizeObserver(function () {
      if (!headEl || !workEl || workEl.offsetParent === null || geo.side || sfmode === 'color' || fixedView())
        return;
      if (Math.abs(headFoot() - _hdB) > 0.5) requestAnimationFrame(sizeCanvas);
    }).observe(document.body);
  window.addEventListener('resize', function () {
    _sat = -1;
    requestAnimationFrame(function () {
      fitHead();
      fitBar();
      fitPairs();
      paneMin();
      placeSheet();
    });
  });
}
