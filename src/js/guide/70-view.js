function evPt(e) {
  const r = cv.getBoundingClientRect();
  return {
    x: Math.floor(((e.clientX - r.left) / r.width) * W),
    y: Math.floor(((e.clientY - r.top) / r.height) * H),
  };
}
function viewDims() {
  const vw = cv ? cv.offsetWidth : 0,
    dh = cv ? cv.offsetHeight : 0;
  return { vw: vw || 1, dh: dh || 1 };
}
let _vhB = 0,
  _vwB = 0;
function baseVH() {
  const w = window.innerWidth || 0,
    h = window.innerHeight || 800,
    coarse = !!(window.matchMedia && matchMedia('(pointer:coarse)').matches);
  if (!_vhB || Math.abs(w - _vwB) > 2 || (!coarse && Math.abs(h - _vhB) > 2)) {
    let sv = 0;
    if (coarse) {
      try {
        const pr = document.createElement('div');
        pr.style.cssText =
          'position:fixed;top:0;left:0;width:0;height:100svh;visibility:hidden;pointer-events:none';
        document.body.appendChild(pr);
        sv = pr.offsetHeight;
        pr.remove();
      } catch (e) {}
    }
    _vhB = sv > 0 ? Math.min(sv, h) : h;
    _vwB = w;
  }
  return _vhB;
}
// full screen: the picture fills the screen (above the tool row) until closed with the X or Escape
function enterFull() {
  if (!cv || focus || root.classList.contains('sfrev') || cropMode) return;
  closeSheet();
  hideToast();
  holdScroll();
  root.classList.add('sffull');
  resetZoom();
  sizeCanvas();
  applyXform();
}
function exitFull() {
  if (!root || !root.classList.contains('sffull')) return;
  root.classList.remove('sffull');
  resetZoom();
  sizeCanvas();
  applyXform();
  backScroll();
}
function sizeCanvas() {
  if (!cv || !sfView) return;
  if (root.classList.contains('sffull')) {
    const cs = getComputedStyle(sfView),
      aw = sfView.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight),
      ah = sfView.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom),
      k = Math.min(aw / (cv.width || 1), ah / (cv.height || 1));
    if (k > 0) cvSize(Math.round(cv.width * k), Math.round(cv.height * k));
    return;
  }
  if (root.classList.contains('sffoc') && !root.classList.contains('sfrev')) {
    const g = focusGeo(),
      k = Math.min(g.aw / (cv.width || 1), (g.ah - 6) / (cv.height || 1));
    if (k > 0) {
      cv.style.width = Math.round(cv.width * k) + 'px';
      cv.style.height = Math.round(cv.height * k) + 'px';
    }
    document.documentElement.style.setProperty('--pinH', '0px');
    return;
  }
  if (root.classList.contains('sfrev')) {
    cv.style.width = '';
    cv.style.height = '';
    document.documentElement.style.setProperty('--pinH', '0px');
    return;
  }
  frameSize();
}
function applyXform() {
  if (cv) cv.style.transform = 'translate(' + panX + 'px,' + panY + 'px) scale(' + zoom + ')';
  labHiSync();
  labZoomed();
  fitBtn();
  touchRule();
  if (sunEl || radEl) positionSun();
  if (zoneEl) positionZones();
  if (photoEl) positionPhoto();
  if (tipL >= 0) positionTip();
  if (olSet) positionOutline();
}
function clampPan() {
  const d = viewDims(),
    sw = d.vw * zoom,
    sh = d.dh * zoom;
  // focus mode: the picture fills the space between its bars wherever it's big enough to (so a section near an edge
  // sits off-centre rather than beside blank space), and where it isn't, it sits in the middle of it, all of it seen
  if (focus && !focusFin && sfmode === 'color' && sfView) {
    const g = focusGeo(),
      ol = cv.offsetLeft,
      ot = cv.offsetTop;
    panX = sw >= g.aw ? Math.min(-ol, Math.max(g.aw - ol - sw, panX)) : g.cx - ol - sw / 2;
    panY = sh >= g.ah ? Math.min(g.t - ot, Math.max(g.t + g.ah - ot - sh, panY)) : g.cy - ot - sh / 2;
    return;
  }
  if (zoom <= 1) {
    panX = 0;
    panY = 0;
    return;
  }
  panX = Math.min(0, Math.max(d.vw - sw, panX));
  panY = Math.min(0, Math.max(d.dh - sh, panY));
}
function setZoom(z, cx, cy) {
  const d = viewDims();
  z = Math.max(1, Math.min(8, z));
  if (cx == null) {
    cx = d.vw / 2;
    cy = d.dh / 2;
  }
  const ix = (cx - panX) / zoom,
    iy = (cy - panY) / zoom;
  zoom = z;
  panX = cx - ix * zoom;
  panY = cy - iy * zoom;
  clampPan();
  applyXform();
}
function resetZoom() {
  zoom = 1;
  panX = 0;
  panY = 0;
  applyXform();
}
// how far in to zoom for section l (box: its extent in picture pixels), focus mode and Find next alike (v288): only as
// far as it takes for the section to be about 44px across (easy to see and tap), and no further than keeps about a
// quarter of the page in view (2×) so its neighbours say where you are, unless the section needs more to reach 44px
// (then up to FIT_MAX). keep: zoomed in already, stay so while the section is 44px or more there.
const FIT_MAX = 4,
  FIT_PX = 44,
  FIT_CTX = 2;
function fitZoom(box, l, aw, ah, keep) {
  const DW = (cv && cv.offsetWidth) || 1,
    DH = (cv && cv.offsetHeight) || 1,
    bw = Math.max(1, ((box.x1[l] - box.x0[l] + 1) / W) * DW),
    bh = Math.max(1, ((box.y1[l] - box.y0[l] + 1) / H) * DH),
    // (44px on the screen: the frame may be drawn smaller as the page scrolls, picK)
    need = FIT_PX / picK() / Math.min(bw, bh),
    // (never so far in that the section is wider or taller than most of the view)
    most = Math.min((aw * 0.8) / bw, (ah * 0.8) / bh);
  let z = need <= FIT_CTX ? need : Math.min(FIT_MAX, need);
  z = Math.max(1, Math.min(z, Math.max(1, most)));
  if (
    keep &&
    zoom > z &&
    zoom <= FIT_MAX &&
    Math.min(bw, bh) * zoom * picK() >= FIT_PX &&
    Math.max(bw / aw, bh / ah) * zoom <= 0.8
  )
    z = zoom;
  return z;
}
function centerOn(px, py, z) {
  const d = viewDims();
  zoom = Math.max(1, Math.min(8, z || zoom));
  panX = d.vw / 2 - (px / W) * d.vw * zoom;
  panY = d.dh / 2 - (py / H) * d.dh * zoom;
  clampPan();
  applyXform();
}
