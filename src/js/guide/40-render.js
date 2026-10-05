// texture: distance to the nearest line (capped at 12, worked out directly in bytes) and a streaky paper field
// (both on the picture as it came: an enlarged picture's distances and streaks are srcK times as many pixels, v303)
function buildTexFields() {
  // (v307: kept for the session, as the label points are)
  const key = 'tex:' + labelsSig() + ':' + srcK,
    kept = lptsGet(key);
  if (kept) {
    edgeDist = kept.E;
    texField = kept.T;
    return;
  }
  const n = W * H,
    E = new Uint8Array(n),
    cap = Math.min(255, Math.round(12 * srcK));
  for (let y = 0; y < H; y++) {
    const ro = y * W;
    for (let x = 0; x < W; x++) {
      const q = ro + x;
      let d = labels[q] === -1 ? 0 : cap;
      if (d) {
        if (x > 0 && E[q - 1] + 1 < d) d = E[q - 1] + 1;
        if (y > 0 && E[q - W] + 1 < d) d = E[q - W] + 1;
      }
      E[q] = d;
    }
  }
  for (let y = H - 1; y >= 0; y--) {
    const ro = y * W;
    for (let x = W - 1; x >= 0; x--) {
      const q = ro + x;
      let d = E[q];
      if (!d) continue;
      if (x < W - 1 && E[q + 1] + 1 < d) d = E[q + 1] + 1;
      if (y < H - 1 && E[q + W] + 1 < d) d = E[q + W] + 1;
      E[q] = d;
    }
  }
  edgeDist = E;
  texField = new Uint8Array(n);
  const dirx = 0.92,
    diry = -0.39,
    SN = 4096,
    SIN = new Float32Array(SN),
    ph = ((0.07 / srcK) * SN) / 6.283185307179586;
  for (let i = 0; i < SN; i++) SIN[i] = Math.sin((i * 6.283185307179586) / SN) * 0.65 * 95;
  for (let y = 0; y < H; y++) {
    const ro = y * W,
      base = y * diry * ph + SN * 4096;
    for (let x = 0; x < W; x++) {
      const q = ro + x,
        streak = SIN[((base + x * dirx * ph) | 0) & (SN - 1)],
        hsh = ((((x * 374761393 + y * 668265263) >>> 13) & 255) / 255 - 0.5) * 0.35 * 95;
      const v = 128 + streak + hsh;
      texField[q] = v < 0 ? 0 : v > 255 ? 255 : v;
    }
  }
  lptsPut(key, { E: edgeDist, T: texField });
}
// label points: the roomiest spot in each section (largest distance to its edge). The same two passes also give
// each section's box, centre and area, and the distances shading needs, so nothing walks the picture again for them.
// (v307) Worked out by labelPtsCore, from the section map alone, so the worker (03-jobs) can run it too; kept for the
// session per section map (_lpts), so a guide opened again in the same session doesn't work them out again.
function buildLabelPts() {
  if (!labels || !comps) return;
  const K = comps.length,
    key = lptsKey(K),
    r = lptsGet(key) || labelPtsCore(labels, W, H, K);
  lptsUse(r);
  lptsPut(key, r);
}
// (runs in the worker too: nothing but its arguments)
function labelPtsCore(labels, W, H, K) {
  const n = W * H,
    D = new Float32Array(n),
    bv = new Float32Array(K).fill(-1),
    bi = new Int32Array(K).fill(-1),
    R2 = 1.4142,
    Q = new Uint16Array(n),
    x0 = new Int32Array(K).fill(1e9),
    y0 = new Int32Array(K).fill(1e9),
    x1 = new Int32Array(K).fill(-1),
    y1 = new Int32Array(K).fill(-1),
    sx = new Float64Array(K),
    sy = new Float64Array(K),
    ar = new Float64Array(K);
  for (let y = 0; y < H; y++) {
    const ro = y * W;
    for (let x = 0; x < W; x++) {
      const q = ro + x,
        L = labels[q];
      if (L < 1) {
        D[q] = 0;
        continue;
      }
      if (L < K) {
        if (x < x0[L]) x0[L] = x;
        if (x > x1[L]) x1[L] = x;
        if (y < y0[L]) y0[L] = y;
        if (y > y1[L]) y1[L] = y;
        sx[L] += x;
        sy[L] += y;
        ar[L]++;
      }
      let d = 1e9,
        v;
      if (x === 0 || y === 0 || x === W - 1 || y === H - 1) d = 1;
      if (x > 0) {
        v = labels[q - 1] === L ? D[q - 1] : 0;
        if (v + 1 < d) d = v + 1;
      }
      if (y > 0) {
        const u = q - W;
        v = labels[u] === L ? D[u] : 0;
        if (v + 1 < d) d = v + 1;
        if (x > 0) {
          v = labels[u - 1] === L ? D[u - 1] : 0;
          if (v + R2 < d) d = v + R2;
        }
        if (x < W - 1) {
          v = labels[u + 1] === L ? D[u + 1] : 0;
          if (v + R2 < d) d = v + R2;
        }
      }
      D[q] = d;
    }
  }
  for (let y = H - 1; y >= 0; y--) {
    const ro = y * W;
    for (let x = W - 1; x >= 0; x--) {
      const q = ro + x,
        L = labels[q];
      if (L < 1) continue;
      let d = D[q],
        v;
      if (x < W - 1) {
        v = labels[q + 1] === L ? D[q + 1] : 0;
        if (v + 1 < d) d = v + 1;
      }
      if (y < H - 1) {
        const u = q + W;
        v = labels[u] === L ? D[u] : 0;
        if (v + 1 < d) d = v + 1;
        if (x < W - 1) {
          v = labels[u + 1] === L ? D[u + 1] : 0;
          if (v + R2 < d) d = v + R2;
        }
        if (x > 0) {
          v = labels[u - 1] === L ? D[u - 1] : 0;
          if (v + R2 < d) d = v + R2;
        }
      }
      D[q] = d;
      const d8 = d * 8;
      Q[q] = d8 > 65535 ? 65535 : Math.round(d8);
      if (L < K && d > bv[L]) {
        bv[L] = d;
        bi[L] = q;
      }
    }
  }
  const lp = new Array(K);
  for (let l = 1; l < K; l++) {
    const q = bi[l];
    if (q < 0) continue;
    const x = q % W,
      y = (q / W) | 0;
    let a = x,
      b = x;
    while (a > 0 && labels[y * W + a - 1] === l) a--;
    while (b < W - 1 && labels[y * W + b + 1] === l) b++;
    lp[l] = { x: (a + b + 1) / 2, y: y + 0.5, r: bv[l], aw: b - a + 1 };
  }
  return { lp: lp, Q: Q, sx: sx, sy: sy, ar: ar, x0: x0, y0: y0, x1: x1, y1: y1 };
}
function lptsUse(r) {
  labelPts = r.lp;
  const Q = r.Q;
  Q._lp = labelPts;
  Q._sx = r.sx;
  Q._sy = r.sy;
  Q._ar = r.ar;
  _ldq = Q;
  _sb = { lp: labelPts, K: r.lp.length, x0: r.x0, y0: r.y0, x1: r.x1, y1: r.y1 };
}
// The session's label points and edge texture, per section map: those of the three most recent guides (about 4 bytes
// a pixel each).
// Keyed by the section map's signature (labelsSig) and its number of sections; the texture also by how much the
// picture was enlarged (srcK). Nothing here changes once made (v307)
const _lpts = [];
function lptsKey(K) {
  return labelsSig() + ':' + K;
}
function lptsGet(key) {
  for (let i = 0; i < _lpts.length; i++)
    if (_lpts[i].key === key) {
      const e = _lpts.splice(i, 1)[0];
      _lpts.unshift(e);
      return e.r;
    }
  return null;
}
// the label points of the sections as they are, worked out in the worker (03-jobs) and kept for buildLabelPts to
// find: resolves once they are (at once without a worker, or when they're kept already). Nothing waiting for them
// changes meanwhile: Build guide is off until it has run (v307)
function lptsReady() {
  if (!JOBS.on || !labels || !comps) return Promise.resolve();
  const K = comps.length,
    key = lptsKey(K);
  if (lptsHas(key)) return Promise.resolve();
  return JOBS.run('lpts', { buf: labels.slice().buffer, W: W, H: H, K: K }).then(
    function (r) {
      lptsPut(key, lptsFix(r, K));
    },
    function () {},
  );
}
// (what the worker sent, as an array made here: its empty places stay empty)
function lptsFix(r, K) {
  const lp = new Array(K);
  for (let l = 1; l < K; l++) if (r.lp[l]) lp[l] = r.lp[l];
  r.lp = lp;
  return r;
}
function lptsHas(key) {
  return _lpts.some(function (e) {
    return e.key === key;
  });
}
function lptsPut(key, r) {
  const i = _lpts.findIndex(function (e) {
    return e.key === key;
  });
  if (i >= 0) _lpts.splice(i, 1);
  _lpts.unshift({ key: key, r: r });
  _lpts.length = Math.min(_lpts.length, 6);
}
function labelPos(l) {
  if (!labelPts) buildLabelPts();
  const p = labelPts && labelPts[l];
  if (p) return p;
  const c = comps[l] || { cx: 0, cy: 0, area: 1 };
  return { x: c.cx, y: c.cy, r: Math.sqrt(c.area || 1) / 2, aw: Math.sqrt(c.area || 1) };
}
const _mw = new Map();
try {
  if (document.fonts && document.fonts.addEventListener)
    document.fonts.addEventListener('loadingdone', function () {
      _mw.clear();
      _fontGen++;
    });
} catch (e) {}
// The brand tag after a code, when the labels carry the brand: a small rounded box on the line, filled dark with a
// white letter (Ohuhu), or outlined with a pale grey fill and a dark letter (Copic), so markers kept sorted by brand
// are told apart at a glance (a raised letter read like a degree sign: "B112°"). Sizes are fractions of the code's
// font size (the corner radius, of the box's height). o.tag (optional) gives other colours, as {dark, pale}: the
// print's light labels.
// (v306) A code that is in the guide in both brands (sameOf) has its tag filled in amber with a dark letter, and a
// heavier edge, whichever brand: the letter is the thing to check before picking up the marker. On the screen, in
// the PDF (page 1 and the close-ups) and on the saved image; Reveal's card has no tags.
const TAG = {
  gap: 0.2,
  pad: 0.15,
  h: 0.8,
  r: 0.28,
  font: 0.62,
  line: 0.07,
  dark: '#26252b',
  pale: '#c4c1c9',
  same: '#ffb454',
  sameInk: '#1a1a1a',
};
// (v307) in print, a darker amber with a white letter: the screen's showed through pale yellow ink (Ohuhu Y26 Light
// Gold). For the PDF's tags (col.same / col.sameInk); the screen and the saved image keep the screen's.
const TAG_PRINT = { same: '#b45f06', sameInk: '#fff' };
function tagOutlined(brand) {
  return brand === 'Copic';
}
function drawTag(g, tg, outlined, x, y, w, fs, col, same) {
  const h = fs * TAG.h,
    top = y - h / 2,
    r = h * TAG.r;
  g.beginPath();
  g.moveTo(x + r, top);
  g.arcTo(x + w, top, x + w, top + h, r);
  g.arcTo(x + w, top + h, x, top + h, r);
  g.arcTo(x, top + h, x, top, r);
  g.arcTo(x, top, x + w, top, r);
  g.closePath();
  g.fillStyle = same ? col.same || TAG.same : outlined ? col.pale : col.dark;
  g.fill();
  g.lineWidth = Math.max(1, fs * TAG.line * (same ? 1.6 : 1));
  g.strokeStyle = col.dark;
  g.stroke();
  g.fillStyle = same ? col.sameInk || TAG.sameInk : outlined ? col.dark : '#fff';
  g.font = '700 ' + fs * TAG.font + 'px ' + LFONT;
  g.textAlign = 'center';
  g.fillText(tg, x + w / 2, y + fs * 0.02);
}
// where a code label goes and how big it is (no drawing). Font sizes snap to half pixels: the browser keeps a font
// object per size, so thousands of slightly different sizes made drawing the labels several times slower
// (o.bt: whether the code carries its brand tag; exports say so for what they hold, else brandsMixed(). The tag's
// width counts in fitting the label to its section and in the box it takes.)
function codeLayout(g, l, m, o) {
  const c = comps[l],
    p = labelPos(l),
    tg = (o.bt != null ? o.bt : brandsMixed()) ? bTag(m.brand) : '';
  let fs = Math.max(o.base, Math.min(Math.sqrt(c.area) * 0.5, o.max || 30));
  const meas = function (f) {
    const k1 = o.w + '|' + m.code,
      k2 = '700|' + tg;
    let a = _mw.get(k1),
      b = _mw.get(k2);
    if (a == null) {
      g.font = o.w + ' 100px ' + LFONT;
      a = g.measureText(m.code).width;
      _mw.set(k1, a);
    }
    if (b == null) {
      g.font = '700 100px ' + LFONT;
      b = g.measureText(tg).width;
      _mw.set(k2, b);
    }
    const cw = (a * f) / 100,
      gw = tg ? (b * TAG.font * f) / 100 + f * TAG.pad * 2 : 0;
    return { cw: cw, gw: gw, tw: tg ? cw + f * TAG.gap + gw : cw };
  };
  let mm = meas(fs);
  const sc = Math.min(1, (p.aw * 0.94) / mm.tw, (p.r * 2.4) / fs);
  if (sc < 1) fs = Math.max(o.min, fs * sc);
  fs = Math.max(o.min, Math.floor(fs * 2) / 2);
  mm = meas(fs);
  const x0 = p.x - mm.tw / 2,
    lw = Math.max(1, fs * o.swk);
  return {
    fs: fs,
    x0: x0,
    y: p.y,
    cw: mm.cw,
    tg: tg,
    gw: mm.gw,
    lw: lw,
    box: [x0 - lw - 2, p.y - fs * 0.9 - lw - 2, x0 + mm.tw + lw + 2, p.y + fs * 0.75 + lw + 2],
  };
}
let _lastBox = null;
function drawCode(g, l, m, o) {
  const L = codeLayout(g, l, m, o),
    fs = L.fs,
    x0 = L.x0,
    y = L.y;
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.lineWidth = L.lw;
  g.strokeStyle = o.stroke;
  g.fillStyle = o.fill;
  g.font = o.w + ' ' + fs + 'px ' + LFONT;
  g.strokeText(m.code, x0, y);
  g.fillText(m.code, x0, y);
  if (L.tg)
    drawTag(g, L.tg, tagOutlined(m.brand), x0 + L.cw + fs * TAG.gap, y, L.gw, fs, o.tag || TAG, !!sameOf(m));
  g.textAlign = 'center';
  _lastBox = L.box;
  return fs;
}
// The tip over a tapped section: its marker, and in the guide editor "Change colour" and "Pin". A tip with buttons
// stays until the next tap, Escape, a scroll of the page or a change of mode; one without goes after a moment. It
// sits outside the scaled picture (so it keeps its size while the picture shrinks), above the section or below it
// when there's no room, and never over it; it follows zoom and pan.
let tipL = -1,
  tipBtns = false,
  tipT = 0,
  tipEl = null,
  tipY = 0,
  _tipSc = false;
function hideTip() {
  clearTimeout(tipT);
  tipL = -1;
  if (tipEl) {
    tipEl.remove();
    tipEl = null;
  }
}
function showTip(l, btns, quiet) {
  const m = assignData && assignData.assign[l];
  if (!m || !cv || !sfView) {
    hideTip();
    return;
  }
  const ae = document.activeElement,
    fa = ae && ae.closest && ae.closest('.sftip') && ae.dataset ? ae.dataset.a : null;
  hideTip();
  btns = !!btns && sfmode === 'guide';
  const pin = locks[l] !== undefined,
    d = document.createElement('div');
  d.className = 'sftip' + (btns ? ' sftipb' : '');
  d.innerHTML =
    '<i style="background:' +
    esc(m.hex) +
    '"></i><b>' +
    esc(m.code) +
    '</b> ' +
    esc(m.name || '') +
    ' <span class="sftipbr">' +
    esc(m.brand) +
    '</span>' +
    (pin && btns ? '<span class="sftippin">Pinned</span>' : '') +
    shadeTipHTML(l) +
    photoTipHTML(l) +
    (btns ? zoneTipHTML(l) : '') +
    (btns
      ? '<div class="sftipbtns"><button type="button" class="sftipbtn" data-a="change">Change colour</button><button type="button" class="sftipbtn" data-a="pin" aria-pressed="' +
        pin +
        '">' +
        (pin ? 'Unpin' : 'Pin') +
        '</button></div>'
      : '');
  if (btns) {
    d.setAttribute('role', 'group');
    d.setAttribute('aria-label', 'Section marker ' + m.code);
    d.addEventListener('pointerdown', function (e) {
      e.stopPropagation();
    });
    d.addEventListener('click', function (e) {
      const b = e.target.closest('[data-a]');
      if (!b) return;
      if (b.dataset.a === 'change') openSectionPop(l);
      else if (b.dataset.a === 'zone') {
        // to the zone this section is in (85-zones-ui): on the tab that's open if it has the chips (Pattern, Colours,
        // Shading with shading on), else on Pattern
        // (the tab first, so the zone's chip is there to take the keyboard, v287)
        if (gTab !== 'pattern' && gTab !== 'colours' && !(gTab === 'shading' && shadeMode !== 'off'))
          planTab('pattern');
        zoneSwitch(+b.dataset.z);
      } else {
        togglePin(l);
        showTip(l, true, true);
      }
    });
  }
  // next to the picture in the page (so Tab reaches it straight after the picture), placed on the screen
  sfView.insertAdjacentElement('afterend', d);
  tipEl = d;
  tipL = l;
  tipBtns = btns;
  tipY = window.scrollY;
  positionTip();
  if (!_tipSc) {
    _tipSc = true;
    window.addEventListener(
      'scroll',
      function () {
        if (tipL >= 0 && Math.abs(window.scrollY - tipY) > 2) hideTip();
      },
      { passive: true },
    );
  }
  if (fa) {
    const nb = d.querySelector('[data-a="' + fa + '"]');
    if (nb)
      try {
        nb.focus({ preventScroll: true });
      } catch (_) {}
  }
  if (!quiet) sayLive(m.code + ' ' + (m.name || '') + ', ' + m.brand + (pin ? ', pinned' : ''));
  if (!btns) tipT = setTimeout(hideTip, shadeOn() ? 3600 : 2200);
}
// Where it goes on the screen: centred on the section's label point, on the picture's side of the screen; above the
// part of the section that shows when that fits inside the picture, else below it; for a section too tall for
// either, just clear of its label point
function positionTip() {
  if (tipL < 0 || !cv || !sfView) return;
  const d = tipEl;
  if (!d || !d.isConnected) {
    tipL = -1;
    tipEl = null;
    return;
  }
  if (!assignData || !assignData.assign[tipL] || !labels) {
    hideTip();
    return;
  }
  const B = secBoxes(),
    l = tipL,
    r = cv.getBoundingClientRect(),
    sx = r.width / W,
    sy = r.height / H,
    p = labelPos(l),
    px = r.left + p.x * sx,
    py = r.top + p.y * sy,
    ih = window.innerHeight || 0,
    iw = window.innerWidth || 0;
  const cr = (fixedView() || !picBox ? sfView : picBox).getBoundingClientRect(),
    vt = Math.max(cr.top, safeTop(), 0),
    vb = Math.min(cr.bottom, ih),
    hv = sfView.getBoundingClientRect(),
    g = 8;
  const top0 = Math.max(vt, r.top + B.y0[l] * sy),
    bot0 = Math.min(vb, r.top + (B.y1[l] + 1) * sy);
  d.style.left = '0px';
  d.style.top = '0px';
  const w = d.offsetWidth,
    h = d.offsetHeight;
  let top,
    // (which side of the tip its pointer is on: under it when it's above the section, over it when below; in the last
    // resort, the side towards the label)
    below = false;
  if (top0 - g - h >= vt) top = top0 - g - h;
  else if (bot0 + g + h <= ih - 6) {
    top = bot0 + g;
    below = true;
  } else {
    const gp = Math.max(10, Math.min(28, (p.r || 6) * sx * 0.5 + 6));
    top = py - gp - h >= vt ? py - gp - h : Math.min(py + gp, Math.max(6, ih - 6 - h));
    below = top > py;
  }
  let lo = Math.max(6, hv.left + 6),
    hi = Math.min(iw, hv.right) - 6 - w;
  if (hi < lo) {
    lo = 6;
    hi = Math.max(6, iw - 6 - w);
  }
  const left = Math.round(Math.max(lo, Math.min(hi, px - w / 2)));
  d.style.left = left + 'px';
  d.style.top = Math.round(top) + 'px';
  // (a pointer to the section, from the tip's edge nearest it: above the section, its foot; below, its top, v302)
  d.classList.toggle('sftipdn', below);
  d.style.setProperty('--tipx', Math.round(Math.max(14, Math.min(w - 14, px - left))) + 'px');
}
// said by screen readers (an aria-live region made in mount)
function sayLive(t) {
  const el = document.getElementById('sfLive');
  if (!el) return;
  sayLive.at = Date.now();
  sayLive.last = t;
  // said during the task that's running now (planCommit, called later in the same task, leaves it be however long
  // redrawing in between took)
  sayLive.now = true;
  setTimeout(function () {
    sayLive.now = false;
  }, 0);
  el.textContent = '';
  setTimeout(function () {
    el.textContent = t;
  }, 40);
}
/* renderGuide draws the whole picture once, then on later calls repaints only the sections whose look changed
    (a tick in colour along, the next section in focus mode). _rg keeps what the last full draw put on the canvas;
    anything else that draws on the canvas sets _rg=null so the next call redraws everything. */
const RG_GRID = 64;
function secBoxes() {
  if (!labelPts) buildLabelPts();
  if (_sb && _sb.lp === labelPts && _sb.K === comps.length) return _sb;
  const K = comps.length,
    x0 = new Int32Array(K).fill(1e9),
    y0 = new Int32Array(K).fill(1e9),
    x1 = new Int32Array(K).fill(-1),
    y1 = new Int32Array(K).fill(-1);
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      const l = labels[p];
      if (l > 0 && l < K) {
        if (x < x0[l]) x0[l] = x;
        if (x > x1[l]) x1[l] = x;
        if (y < y0[l]) y0[l] = y;
        if (y > y1[l]) y1[l] = y;
      }
    }
  _sb = { lp: labelPts, K: K, x0: x0, y0: y0, x1: x1, y1: y1 };
  return _sb;
}
// one section's label: a code (with lock marker) or, for a coloured section in colour along, a tick. Returns its box.
// stepping through tones: while on the highlight or shadow step, the base marker's code in the section is faded
function stepFaint(l) {
  if (!toneSteps || sfmode !== 'color' || l !== focusCur()) return false;
  const b = stepBits(focusPos);
  return b === 1 || b === 4;
}
// (tick: a section done shows a ✓: green on its pale colour, or with the codes off over its own colour, outlined)
function secLabel(l, m, tick, draw) {
  const c = comps[l],
    p = labelPos(l);
  if (tick && colored[l]) {
    // (sizes in the picture's pixels; an enlarged one's are srcK times as many, so its ticks look as they did, v303)
    const fs =
      Math.floor(Math.max(7 * srcK, Math.min(p.r * 1.7, Math.sqrt(c.area) * 0.5, 30 * srcK)) * 2) / 2;
    if (draw) {
      ctx.font = '700 ' + fs + 'px ' + LFONT;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (hideLabels) {
        const dk = darkText(m.hex);
        ctx.lineJoin = 'round';
        ctx.lineWidth = Math.max(2, fs * 0.22);
        ctx.strokeStyle = dk ? 'rgba(255,255,255,.9)' : 'rgba(0,0,0,.55)';
        ctx.strokeText('✓', p.x, p.y);
        ctx.fillStyle = dk ? '#141414' : '#fff';
      } else ctx.fillStyle = '#3f7d4e';
      // (v307: a fresh ✓ fading out)
      const a = tkAlpha(l);
      if (a < 1) {
        ctx.save();
        ctx.globalAlpha = a;
      }
      ctx.fillText('✓', p.x, p.y);
      if (a < 1) ctx.restore();
    }
    return [p.x - fs * 0.7 - 2, p.y - fs * 0.8 - 2, p.x + fs * 0.7 + 2, p.y + fs * 0.8 + 2];
  }
  const dark = darkText(m.hex),
    // (in the picture's pixels: an enlarged picture's codes as big on the screen as they were before, v303)
    o = {
      base: 9 * srcK,
      min: 5 * srcK,
      max: 30 * srcK,
      w: 600,
      swk: 0.27,
      stroke: dark ? 'rgba(255,255,255,.9)' : 'rgba(0,0,0,.55)',
      fill: dark ? '#141414' : '#fff',
    };
  let fs,
    b,
    dot = false;
  // a code that would come out under LAB_MIN_CSS on the screen, as zoomed now, is a dot until zoomed in (not in focus
  // mode, which zooms to its section by itself: labMinFor). A pinned one keeps its pin's mark round the dot.
  if (!(focus && sfmode === 'color')) {
    const L0 = codeLayout(ctx, l, m, o);
    if (L0.fs < _labMin) {
      const r = _labMin / 4;
      if (draw) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, 6.283);
        ctx.fillStyle = o.fill;
        ctx.fill();
        ctx.lineWidth = r * 0.5;
        ctx.strokeStyle = o.stroke;
        ctx.stroke();
      }
      dot = true;
      fs = r * 2.2;
      b = [p.x - r * 1.5 - 1, p.y - r * 1.5 - 1, p.x + r * 1.5 + 1, p.y + r * 1.5 + 1];
    }
  }
  if (!dot && draw) {
    const fa = stepFaint(l);
    if (fa) {
      ctx.save();
      ctx.globalAlpha = 0.3;
    }
    fs = drawCode(ctx, l, m, o);
    if (fa) ctx.restore();
    b = _lastBox.slice();
  } else if (!dot) {
    const L = codeLayout(ctx, l, m, o);
    fs = L.fs;
    b = L.box.slice();
  }
  if (locks[l] && sfmode !== 'color') {
    if (family === 'manual') {
      const dr = Math.max(2.5, fs * 0.26),
        cx = p.x + fs * 0.8,
        cy = p.y - fs * 0.8,
        e = dr + Math.max(1, fs * 0.08) + 2;
      if (draw) {
        ctx.beginPath();
        ctx.arc(cx, cy, dr, 0, 6.283);
        ctx.fillStyle = '#ffd84a';
        ctx.fill();
        ctx.lineWidth = Math.max(1, fs * 0.08);
        ctx.strokeStyle = 'rgba(0,0,0,.45)';
        ctx.stroke();
      }
      b[0] = Math.min(b[0], cx - e);
      b[1] = Math.min(b[1], cy - e);
      b[2] = Math.max(b[2], cx + e);
      b[3] = Math.max(b[3], cy + e);
    } else {
      const e = fs * 0.95 + Math.max(1.5, fs * 0.14) + 2;
      if (draw) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, fs * 0.95, 0, 6.283);
        ctx.strokeStyle = '#ffd84a';
        ctx.lineWidth = Math.max(1.5, fs * 0.14);
        ctx.stroke();
      }
      b[0] = Math.min(b[0], p.x - e);
      b[1] = Math.min(b[1], p.y - e);
      b[2] = Math.max(b[2], p.x + e);
      b[3] = Math.max(b[3], p.y + e);
    }
  }
  return b;
}
function rgGridAdd(G, l, b) {
  const gx0 = Math.max(0, (b[0] / RG_GRID) | 0),
    gy0 = Math.max(0, (b[1] / RG_GRID) | 0),
    gx1 = Math.min(G.nx - 1, (b[2] / RG_GRID) | 0),
    gy1 = Math.min(G.ny - 1, (b[3] / RG_GRID) | 0);
  for (let gy = gy0; gy <= gy1; gy++)
    for (let gx = gx0; gx <= gx1; gx++) {
      const k = gy * G.nx + gx,
        c = G.c[k] || (G.c[k] = []);
      // (once per cell: a section redrawn again and again in Paint or Colour along, v296)
      if (c.indexOf(l) < 0) c.push(l);
    }
}
// per-section colour and flags in typed arrays, so the per-pixel loop does no object lookups.
// flag 1 = coloured (gets texture), 2 = shaded (colour comes from the tone field)
function pixTables(colArr, sh, shOK, tex) {
  const K = comps.length,
    C = new Uint8Array(K * 3),
    F = new Uint8Array(K);
  for (let l = 0; l < K; l++) {
    const shown = colArr[l] && (revealF == null || (revOrder && revOrder[l] <= revealF)),
      c = shown ? colArr[l] : PAPER;
    C[l * 3] = c[0];
    C[l * 3 + 1] = c[1];
    C[l * 3 + 2] = c[2];
    if (shown) {
      F[l] = (tex ? 1 : 0) | (sh && shOK[l] && sh.tone[l] ? 2 : 0);
    }
  }
  return {
    C: C,
    F: F,
    ti: sh ? sh.ti : null,
    mix: sh ? sh.mix : null,
    V: sh ? sh.V : null,
    A: texAmt * 0.3,
    Bt: texAmt * 0.1 * 0.0078125,
  };
}
// fill rgbOut for the box x0..x1, y0..y1 (inclusive); only section `one` when one>=0
function paintPixels(PX, sh, x0, y0, x1, y1, one) {
  const C = PX.C,
    F = PX.F,
    V = PX.V,
    ti = PX.ti,
    mix = PX.mix,
    A = PX.A,
    Bt = PX.Bt,
    o = rgbOut,
    L0 = LINE[0],
    L1 = LINE[1],
    L2 = LINE[2];
  for (let y = y0; y <= y1; y++) {
    let p = y * W + x0,
      j = p * 4;
    for (let x = x0; x <= x1; x++, p++, j += 4) {
      const l = labels[p];
      if (one >= 0 && l !== one) continue;
      if (l < 0) {
        o[j] = L0;
        o[j + 1] = L1;
        o[j + 2] = L2;
        o[j + 3] = 255;
        continue;
      }
      const f = F[l];
      let r, g, b;
      if (f & 2 && V[p]) {
        const k = ti[l] * 768 + V[p] * 3;
        r = mix[k];
        g = mix[k + 1];
        b = mix[k + 2];
      } else {
        const k = l * 3;
        r = C[k];
        g = C[k + 1];
        b = C[k + 2];
      }
      if (f & 1) {
        const e = edgeDist[p],
          mul = (e >= 9 * srcK ? 1 : 1 - A * (1 - e / (9 * srcK))) * (1 + Bt * (texField[p] - 128));
        r *= mul;
        g *= mul;
        b *= mul;
      }
      o[j] = r;
      o[j + 1] = g;
      o[j + 2] = b;
      o[j + 3] = 255;
    }
  }
}
/* How small a code on the picture may be (v284). A code shrinks to fit its section; one that would come out under
   LAB_MIN_CSS pixels on the screen, at the zoom it's seen at, is drawn as a dot, and as a code once zoomed in enough
   (secLabel): before, sizes went by the picture's own pixels alone, so on a phone showing a big photo many codes came
   to two to four pixels, unreadable smudges. Worked out in steps of √2 of zoom (labBucket), so zooming redraws the
   codes only now and then (at the end of a zoom: applyXform); focus mode keeps the unzoomed size, so its steps don't
   redraw every code. _labMin: that size, in the picture's pixels, for the draw under way. */
const LAB_MIN_CSS = 6;
let _labMin = 5,
  _labB = 0,
  _labT = 0;
function labBucket() {
  const z = focus && sfmode === 'color' ? 1 : zoom || 1;
  return Math.pow(2, Math.round(Math.log2(Math.max(1, z)) * 2) / 2);
}
function labMinFor(b) {
  const s0 = cv && cv.offsetWidth ? cv.offsetWidth / W : 1;
  return Math.max(5, Math.round((LAB_MIN_CSS / (s0 * b)) * 2) / 2);
}
// Zoomed in, the codes are drawn on a canvas of their own over the picture (#sfLabHi), with more pixels than the
// picture's (its scale k), so they stay sharp: the picture's canvas has one pixel per pixel of the page, and zoomed it
// is only magnified (v293: the codes were "extremely blurry" once the dots became codes). Not in focus mode (it zooms
// its section by itself and draws no codes for the rest), nor over Edit sections, Crop or Straighten.
let labHi = null,
  _labHiRO = null;
function labHiK() {
  if (!labOn() || (focus && sfmode === 'color') || (zoom || 1) <= 1.01 || !cv || !cv.offsetWidth || !W || !H)
    return 0;
  const s0 = cv.offsetWidth / W,
    dpr = window.devicePixelRatio || 1,
    // (a step's codes stay sharp up to the next step; at most about 12 million pixels, under Safari's canvas limit)
    k = labBucket() * Math.SQRT2 * s0 * dpr;
  return Math.max(1, Math.min(k, Math.sqrt(12e6 / (W * H))));
}
function labHiEl() {
  if (labHi && labHi.isConnected) return labHi;
  if (!cv || !cv.parentNode) return null;
  labHi = document.createElement('canvas');
  labHi.id = 'sfLabHi';
  labHi.setAttribute('aria-hidden', 'true');
  cv.parentNode.insertBefore(labHi, cv.nextSibling);
  if (typeof ResizeObserver !== 'undefined') {
    if (_labHiRO) _labHiRO.disconnect();
    _labHiRO = new ResizeObserver(labHiSync);
    _labHiRO.observe(cv);
  }
  return labHi;
}
// the codes' canvas over the picture's: the same place, size and zoom
function labHiSync() {
  if (!labHi || labHi.style.display === 'none' || !cv) return;
  if (!labHiK()) {
    labHiOff();
    return;
  }
  const st = labHi.style;
  st.left = cv.offsetLeft + 'px';
  st.top = cv.offsetTop + 'px';
  st.width = cv.style.width;
  st.height = cv.style.height;
  st.transform = cv.style.transform;
  st.transition = cv.style.transition ? cv.style.transition : '';
}
function labHiOff() {
  if (!labHi) return;
  labHi.style.display = 'none';
  labHi.width = labHi.height = 0;
}
// after a zoom: the codes drawn again once it settles, if it crossed a step
// (only where the plan is drawn: not over Edit sections, Crop or Straighten, which draw the sections themselves)
function labOn() {
  return (sfmode === 'guide' || sfmode === 'color') && !cropMode && !pgMode;
}
function labZoomed() {
  if (!assignData || !labOn() || labBucket() === _labB) return;
  clearTimeout(_labT);
  _labT = setTimeout(function () {
    if (labOn() && labBucket() !== _labB) renderGuide();
  }, 160);
}
// every section of the guide ticked
function pageDone() {
  if (!assignData || !colored || !assignData.order.length) return false;
  for (let i = 0; i < assignData.order.length; i++) if (!colored[assignData.order[i]]) return false;
  return true;
}
// (v305) Colour along with the codes on: a section ticked shows its ✓ for about a second, then the ✓ goes (redrawn
// a section at a time, renderIncremental) and its own colour says it's done. With the codes off the ✓ stays: it's the
// only mark of a done section there. Sections already ticked when the list is shown have none.
const TICK_SHOW = 1000,
  // (v307) then it fades out over this long, in TICK_STEPS redraws of its section (at once with Reduce motion)
  TICK_FADE = 200,
  TICK_STEPS = 3;
let _tkSeen = null,
  _tkOf = null,
  _tkAt = {},
  _tkT = 0,
  // (Reduce motion, as it was at the last drawing)
  _tkRm = false;
function tkTrack(on) {
  if (!on || !colored) {
    _tkSeen = null;
    _tkOf = null;
    _tkAt = {};
    clearTimeout(_tkT);
    _tkT = 0;
    return;
  }
  const K = colored.length;
  if (!_tkSeen || _tkOf !== colored || _tkSeen.length !== K) {
    _tkSeen = Uint8Array.from(colored);
    _tkOf = colored;
    _tkAt = {};
    return;
  }
  _tkRm = reducedMotion();
  const now = performance.now(),
    end = tkEnd();
  for (let l = 1; l < K; l++) {
    if (colored[l] && !_tkSeen[l]) _tkAt[l] = now;
    else if (!colored[l]) delete _tkAt[l];
    _tkSeen[l] = colored[l];
  }
  let next = Infinity;
  for (const l in _tkAt) {
    const age = now - _tkAt[l];
    if (age >= end) delete _tkAt[l];
    else {
      // (the next step: the fade's start, each of its steps, its end)
      let at = TICK_SHOW;
      while (at <= age) at += TICK_FADE / TICK_STEPS;
      next = Math.min(next, _tkAt[l] + Math.min(at, end));
    }
  }
  clearTimeout(_tkT);
  _tkT = 0;
  if (next < Infinity)
    _tkT = setTimeout(
      function () {
        _tkT = 0;
        if (sfmode === 'color' && assignData) renderGuide();
      },
      Math.max(16, next - now + 4),
    );
}
function tkFresh(l) {
  return _tkAt[l] != null;
}
// how long a ✓ shows in all, its fade included (none with Reduce motion)
function tkEnd() {
  return TICK_SHOW + (_tkRm ? 0 : TICK_FADE);
}
// a fresh ✓'s step: TICK_STEPS + 1 while it shows in full, then one less at each step of its fade (0: gone)
function tkStep(l) {
  if (_tkAt[l] == null) return 0;
  const age = performance.now() - _tkAt[l];
  if (age < TICK_SHOW) return TICK_STEPS + 1;
  if (age >= tkEnd()) return 0;
  return Math.max(1, TICK_STEPS - Math.floor((age - TICK_SHOW) / (TICK_FADE / TICK_STEPS)));
}
// how strongly section l's ✓ is drawn (1 but while it fades: 0.75, 0.5, 0.25)
function tkAlpha(l) {
  const s = sfmode === 'color' && !hideLabels ? tkStep(l) : 0;
  // (v307.1: a ✓ drawn just as its fade ends, its step read a moment after the drawing chose to draw it, stays at the
  // last step: it came back at full strength for a frame. Not with Reduce motion, where there's no fade)
  if (!s && sfmode === 'color' && !hideLabels && !_tkRm && _tkAt[l] != null) return 1 / (TICK_STEPS + 1);
  return s && s <= TICK_STEPS ? s / (TICK_STEPS + 1) : 1;
}
function renderGuide() {
  if (!assignData) return;
  _mixKey = null;
  sameCodeReset();
  sizeCanvas();
  if (labHi && !labHiK()) labHiOff();
  if (sfmode !== 'guide') {
    if (popOpen()) closeSwatchPop(false);
    if (tipL >= 0) hideTip();
  }
  if (!labelPts) buildLabelPts();
  // Colour along (v288): what you've coloured (ticked, or some of its tones) in its colour, as on your paper, the rest
  // pale with its code (progMix, the same as Home's Continue card); with a marker's row open, its sections still to do
  // in full colour and what's coloured softened; Focus mode the same, with the section it's on in full colour. With
  // the codes off (the tool row's Codes) every section shows in its colour, those done keeping their ✓; the page
  // finished, or focus mode's last view, the picture as it is, no codes (v284)
  _labB = labBucket();
  _labMin = labMinFor(_labB);
  const assign = assignData.assign,
    n = W * H,
    K = comps.length,
    finView = sfmode === 'color' && ((focus && focusFin) || pageDone()),
    ticksOnly = sfmode === 'color' && hideLabels && !finView,
    dim = sfmode === 'color' && !finView && !hideLabels;
  const fade = {},
    // (v307: a code in both brands found by its code: both markers' sections shown, as an open row's are)
    two = finView ? null : findTwo(),
    twoB = {},
    sel = !!hlKey || !!two;
  if (two)
    two.forEach(function (g) {
      Object.assign(twoB, g.b);
    });
  if (zoneEditOn()) {
    // the zone editor: the zone's own sections in their colours, the rest faded
    for (const l in assign) if (zoneOf(+l) !== zoneCur) fade[l] = 1;
  } else if (hlKey && !finView) {
    // (v307: not on a page finished, which shows as it is, whatever row is open)
    for (const l in assign) {
      if (!hlMatch(+l)) fade[l] = 1;
    }
  } else if (two) {
    for (const l in assign) {
      if (!twoB[assign[l].mkey]) fade[l] = 1;
    }
  } else if (photoRoughOnly && revealF == null && sfmode === 'guide' && family === 'photo' && _phErr) {
    for (const l in assign) {
      if (!(_phErr[l] >= PH_ROUGH)) fade[l] = 1;
    }
  }
  const colArr = new Array(K),
    full = new Uint8Array(K);
  const fcur = focusCur();
  for (const l in assign) {
    const b = hexRgb(assign[l].hex);
    if (dim) {
      const ink = inkOn(+l),
        on = fcur > 0 ? +l === fcur : sel ? !fade[l] && !colored[l] : ink;
      colArr[l] = on ? b : progMix(b, ink ? (fcur > 0 || sel ? PROG_SOFT : 1) : PROG_PALE);
      if (on) full[l] = 1;
      continue;
    }
    // (Colour along with the codes off and a row open: the rest softened, not gone, so the plan still shows, v288)
    colArr[l] = fade[l]
      ? ticksOnly && sel
        ? progMix(b, PROG_SOFT)
        : [(b[0] * 0.12 + 224) | 0, (b[1] * 0.12 + 224) | 0, (b[2] * 0.12 + 224) | 0]
      : dim && colored[l]
        ? [(b[0] * 0.28 + 183) | 0, (b[1] * 0.28 + 183) | 0, (b[2] * 0.28 + 183) | 0]
        : fcur > 0 && +l !== fcur
          ? [(b[0] * 0.45 + 140) | 0, (b[1] * 0.45 + 140) | 0, (b[2] * 0.45 + 140) | 0]
          : b;
  }
  const tex = texAmt > 0;
  if (tex && !edgeDist) buildTexFields();
  const sh = sfmode === 'guide' || sfmode === 'color' ? shadePrep(dragPreview) : null,
    shV = sh ? sh.V : null,
    shC = [0, 0, 0],
    shOK = {};
  // (shading on what's in full colour: in Colour along that's what you've coloured too, as on your paper)
  if (sh) for (const l in assign) shOK[l] = dim ? !!full[l] : !fade[l] && !(fcur > 0 && +l !== fcur);
  if (dragPreview) {
    _rg = null;
    const f = sh ? sh.step : previewStep(),
      hw = Math.max(1, Math.floor(W / f)),
      hh = Math.max(1, Math.floor(H / f));
    if (!pvCanvas) pvCanvas = document.createElement('canvas');
    if (pvCanvas.width !== hw || pvCanvas.height !== hh) {
      pvCanvas.width = hw;
      pvCanvas.height = hh;
      pvCanvas._im = null;
    }
    const pctx = pvCanvas.getContext('2d'),
      pim = pvCanvas._im || (pvCanvas._im = pctx.createImageData(hw, hh)),
      pd = pim.data;
    for (let y = 0, jj = 0; y < hh; y++) {
      const row = y * f * W;
      for (let x = 0; x < hw; x++, jj += 4) {
        const p = row + x * f,
          l = labels[p];
        if (l === -1) {
          pd[jj] = LINE[0];
          pd[jj + 1] = LINE[1];
          pd[jj + 2] = LINE[2];
        } else {
          let c = colArr[l] || PAPER;
          if (shV && shV[p] && shOK[l] && sh.ti[l]) {
            const k = sh.ti[l] * 768 + shV[p] * 3;
            shC[0] = sh.mix[k];
            shC[1] = sh.mix[k + 1];
            shC[2] = sh.mix[k + 2];
            c = shC;
          }
          if (tex && colArr[l]) {
            const e = edgeDist[p],
              ef = e >= 9 * srcK ? 1 : e / (9 * srcK),
              mul = (1 - texAmt * 0.3 * (1 - ef)) * (1 + texAmt * 0.1 * ((texField[p] - 128) * 0.0078125));
            pd[jj] = c[0] * mul;
            pd[jj + 1] = c[1] * mul;
            pd[jj + 2] = c[2] * mul;
          } else {
            pd[jj] = c[0];
            pd[jj + 1] = c[1];
            pd[jj + 2] = c[2];
          }
        }
        pd[jj + 3] = 255;
      }
    }
    pctx.putImageData(pim, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(pvCanvas, 0, 0, hw, hh, 0, 0, W, H);
    positionSun();
    return;
  }
  tkTrack(dim && revealF == null);
  const labOn = revealF == null && !finView && !(hideLabels && sfmode === 'guide'),
    linesOn = !!(sh && shadeLines && revealF == null && !hideLabels && !finView),
    anch = sfmode === 'guide' && family === 'blend' && anchors.length > 0 && revealF == null;
  // what each section looks like now; a section whose key is unchanged since the last draw is left alone
  const skey = new Array(K),
    lkA = new Int8Array(K);
  for (const l in assign) {
    const shown = revealF == null || (revOrder && revOrder[l] <= revealF),
      lk = (lkA[l] =
        !labOn || fade[l] || (fcur > 0 && +l !== fcur && !colored[l])
          ? 0
          : ticksOnly
            ? colored[l]
              ? 1
              : 0
            : dim && colored[l]
              ? tkStep(l)
                ? 1
                : 0
              : 2);
    skey[l] =
      (shown ? colArr[l].join(',') : 'p') +
      '|' +
      (shown && sh && shOK[l] ? 1 : 0) +
      '|' +
      lk +
      '|' +
      assign[l].mkey +
      // (its tones: which markers and where they hand over, its zone's; 45-shading)
      '|' +
      (sh && shOK[l] && sh.tone[l] ? sh.tone[l].id : 0) +
      (lk === 2 && locks[l] && sfmode !== 'color' ? 'L' : '') +
      (lk === 2 && +l === fcur && stepFaint(+l) ? 'f' : '') +
      // (a ✓ fading out: each step drawn again, v307)
      (lk === 1 && dim ? 't' + tkStep(l) : '');
  }
  const gk = [
    W,
    H,
    K,
    labelPts,
    edgeDist,
    tex ? texAmt : -1,
    shV,
    sh ? shadeVKey : '',
    sh ? shadeMode : '',
    shadeToneColl,
    linesOn,
    labOn,
    // (Codes off draws a tick differently: a full draw, v296)
    hideLabels,
    anch,
    sfmode,
    family,
    brandsMixed(),
    _fontGen,
    _labMin,
    cv.width,
    cv.height,
  ];
  // (zoomed in, the codes are on their own sharper canvas; at the same zoom step, a change is drawn on both a part at
  // a time, as without it: a full draw each time made every Paint stroke and tick zoomed in redraw the lot, v296)
  const hiK = labOn ? labHiK() : 0;
  const ring =
    fcur > 0 && focusBox
      ? fcur + '|' + stepBits(focusPos) + '|' + (((cv.offsetWidth || W) / W) * focusZ).toFixed(4)
      : '';
  let inc = !!(
    _rg &&
    !anch &&
    hiK === (_rg.hiK || 0) &&
    (!hiK || (labHi && labHi.width === Math.round(W * hiK) && labHi.style.display !== 'none')) &&
    _rg.gk.length === gk.length &&
    gk.every(function (v, i) {
      return v === _rg.gk[i];
    })
  );
  const dirty = [];
  if (inc) {
    const old = _rg.skey;
    let area = 0;
    const B = secBoxes();
    for (let l = 1; l < K; l++) {
      if (skey[l] !== old[l]) {
        dirty.push(l);
        if (B.x1[l] >= 0) area += (B.x1[l] - B.x0[l] + 1) * (B.y1[l] - B.y0[l] + 1);
      }
    }
    if (dirty.length > 1500 || area > n * 0.35) inc = false;
  }
  if (inc) {
    if (dirty.length || ring !== _rg.ring)
      renderIncremental(dirty, skey, lkA, colArr, sh, shOK, tex, linesOn, dim || ticksOnly, fcur, ring);
  } else {
    const PX = pixTables(colArr, sh, shOK, tex);
    paintPixels(PX, sh, 0, 0, W - 1, H - 1, -2);
    if (linesOn) {
      const skip = {};
      for (const l in assign) if (!shOK[l]) skip[l] = 1;
      shadeLinesDraw(sh, skip);
    }
    ctx.putImageData(imgData, 0, 0);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const lb = new Array(K),
      G = { nx: Math.ceil(W / RG_GRID), ny: Math.ceil(H / RG_GRID), c: [] };
    // (zoomed in: on the codes' own canvas, at its scale, the picture's coordinates as they are)
    const hc = hiK ? labHiEl() : null,
      main = ctx;
    if (hc) {
      const w = Math.round(W * hiK),
        h = Math.round(H * hiK);
      hc.style.display = '';
      if (hc.width !== w || hc.height !== h) {
        hc.width = w;
        hc.height = h;
      }
      ctx = hc.getContext('2d');
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.setTransform(w / W, 0, 0, h / H, 0, 0);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      labHiSync();
    } else labHiOff();
    try {
      if (labOn)
        for (const l in assign) {
          if (!lkA[l]) continue;
          const b = secLabel(+l, assign[l], dim || ticksOnly, true);
          lb[l] = b;
          rgGridAdd(G, +l, b);
        }
    } finally {
      ctx = main;
    }
    if (anch) {
      const bk = {};
      coll.forEach(function (m) {
        bk[m.mkey] = m;
      });
      ctx.lineWidth = Math.max(2, W / 300);
      const rad = Math.max(9, W / 70);
      for (let i = 0; i < anchors.length; i++) {
        const a = anchors[i],
          m = bk[a.mkey],
          rgb = m ? hexRgb(m.hex) : [128, 128, 128],
          sel = i === selAnchor,
          rr = sel ? rad * 1.35 : rad,
          ring = Math.max(3, W / 200);
        ctx.beginPath();
        ctx.arc(a.x, a.y, rr + ring, 0, 6.283);
        ctx.fillStyle = 'rgba(0,0,0,.55)';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(a.x, a.y, rr, 0, 6.283);
        ctx.fillStyle = 'rgb(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ')';
        ctx.fill();
        ctx.strokeStyle = sel ? '#ffd84a' : '#fff';
        ctx.lineWidth = sel ? Math.max(4, W / 150) : Math.max(3.2, W / 200);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(a.x, a.y, rr + ring, 0, 6.283);
        ctx.strokeStyle = 'rgba(255,255,255,.5)';
        ctx.lineWidth = Math.max(1, W / 650);
        ctx.stroke();
      }
    }
    const rr = fcur > 0 ? drawFocusRing(fcur, stepBits(focusPos), sh) : null;
    _rg = { gk: gk, skey: skey, lb: lb, G: G, ring: ring, ringRect: rr, hiK: hiK };
  }
  positionSun();
  positionZones();
  positionRough();
  positionPhoto();
  if (tipL >= 0) positionTip();
  rowOutline();
  // (always: with nothing left to outline, e.g. a row's last section ticked or Mark all, this hides the outline, v305)
  positionOutline();
  if (!pickPending()) scheduleAutosave();
}
function renderIncremental(dirty, skey, lkA, colArr, sh, shOK, tex, linesOn, tick, fcur, ring) {
  const assign = assignData.assign,
    B = secBoxes(),
    PX = pixTables(colArr, sh, shOK, tex),
    rects = [],
    lb = _rg.lb;
  const addR = function (b) {
    if (!b) return;
    const x0 = Math.max(0, Math.floor(b[0])),
      y0 = Math.max(0, Math.floor(b[1])),
      x1 = Math.min(W, Math.ceil(b[2]) + 1),
      y1 = Math.min(H, Math.ceil(b[3]) + 1);
    if (x1 > x0 && y1 > y0) rects.push([x0, y0, x1, y1]);
  };
  for (let i = 0; i < dirty.length; i++) {
    const l = dirty[i];
    if (B.x1[l] < 0) continue;
    const bx0 = B.x0[l],
      by0 = B.y0[l],
      bx1 = B.x1[l],
      by1 = B.y1[l];
    paintPixels(PX, sh, bx0, by0, bx1, by1, l);
    if (linesOn && shOK[l]) shadeLinesDraw(sh, null, { l: l, box: [bx0, by0, bx1, by1] });
    addR([bx0, by0, bx1, by1]);
    addR(lb[l]);
    lb[l] = null;
    if (assign[l] && lkA[l]) {
      const b = secLabel(l, assign[l], tick, false);
      lb[l] = b;
      addR(b);
      rgGridAdd(_rg.G, l, b);
    }
  }
  addR(_rg.ringRect);
  // (v295) many rectangles: one around them all instead. Each putImageData costs Safari's engine about as much as
  // putting the whole picture (10–20 ms at 1200 × 1600, whatever the rectangle), so a Photo pattern lining up,
  // which re-colours thousands of small sections, took a minute there; the one rectangle redraws more codes, which is cheap.
  if (rects.length > 8) {
    const u = rects[0].slice();
    for (let i = 1; i < rects.length; i++) {
      const q = rects[i];
      if (q[0] < u[0]) u[0] = q[0];
      if (q[1] < u[1]) u[1] = q[1];
      if (q[2] > u[2]) u[2] = q[2];
      if (q[3] > u[3]) u[3] = q[3];
    }
    rects.length = 0;
    rects.push(u);
  }
  // one rectangle at a time: grow it until it holds every label it touches whole, restore its pixels, then redraw
  // those labels in the same order as a full draw. Nothing is clipped (a clip can change how curves are smoothed),
  // and a later rectangle that overlaps an earlier one restores and redraws the shared labels again, whole.
  const G = _rg.G;
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i].slice();
    let ids,
      guard = 0;
    for (;;) {
      ids = [];
      const seen = {},
        gx0 = (r[0] / RG_GRID) | 0,
        gy0 = (r[1] / RG_GRID) | 0,
        gx1 = Math.min(G.nx - 1, ((r[2] - 1) / RG_GRID) | 0),
        gy1 = Math.min(G.ny - 1, ((r[3] - 1) / RG_GRID) | 0);
      let grew = false;
      for (let gy = gy0; gy <= gy1; gy++)
        for (let gx = gx0; gx <= gx1; gx++) {
          const c = G.c[gy * G.nx + gx];
          if (!c) continue;
          for (let k = 0; k < c.length; k++) {
            const l = c[k],
              b = lb[l];
            if (!seen[l] && b && assign[l] && b[0] < r[2] && b[2] > r[0] && b[1] < r[3] && b[3] > r[1]) {
              seen[l] = 1;
              ids.push(l);
              const x0 = Math.max(0, Math.floor(b[0])),
                y0 = Math.max(0, Math.floor(b[1])),
                x1 = Math.min(W, Math.ceil(b[2]) + 1),
                y1 = Math.min(H, Math.ceil(b[3]) + 1);
              if (x0 < r[0]) {
                r[0] = x0;
                grew = true;
              }
              if (y0 < r[1]) {
                r[1] = y0;
                grew = true;
              }
              if (x1 > r[2]) {
                r[2] = x1;
                grew = true;
              }
              if (y1 > r[3]) {
                r[3] = y1;
                grew = true;
              }
            }
          }
        }
      if (!grew || ++guard > 50) break;
    }
    ctx.putImageData(imgData, 0, 0, r[0], r[1], r[2] - r[0], r[3] - r[1]);
    // zoomed in: the codes are on their own canvas, at its scale: its part of the rectangle cleared, and drawn there
    const main = ctx,
      hk = _rg.hiK;
    if (hk) {
      const hx = labHi.getContext('2d'),
        sx = labHi.width / W,
        sy = labHi.height / H;
      hx.setTransform(1, 0, 0, 1, 0, 0);
      hx.clearRect(
        Math.floor(r[0] * sx),
        Math.floor(r[1] * sy),
        Math.ceil(r[2] * sx) - Math.floor(r[0] * sx),
        Math.ceil(r[3] * sy) - Math.floor(r[1] * sy),
      );
      hx.setTransform(sx, 0, 0, sy, 0, 0);
      ctx = hx;
    }
    try {
      if (!ids.length) continue;
      ids.sort(function (a, b) {
        return a - b;
      });
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let k = 0; k < ids.length; k++) secLabel(ids[k], assign[ids[k]], tick, true);
    } finally {
      ctx = main;
    }
  }
  _rg.skey = skey;
  _rg.ring = ring;
  _rg.ringRect = fcur > 0 ? drawFocusRing(fcur, stepBits(focusPos), sh) : null;
}
function drawFocusRing(l, bits, sh) {
  if (!focusBox) return null;
  var k = ((cv.offsetWidth || W) / W) * focusZ,
    r = Math.max(1.5, 3.5 / k),
    r2 = r + Math.max(1, 2.5 / k),
    pad = Math.ceil(r2) + 2,
    x0 = Math.max(0, focusBox.x0[l] - pad),
    y0 = Math.max(0, focusBox.y0[l] - pad),
    x1 = Math.min(W - 1, focusBox.x1[l] + pad),
    y1 = Math.min(H - 1, focusBox.y1[l] + pad),
    w = x1 - x0 + 1,
    h = y1 - y0 + 1;
  if (w < 1 || h < 1) return null;
  var m = document.createElement('canvas');
  m.width = w;
  m.height = h;
  var mc = m.getContext('2d'),
    im = mc.createImageData(w, h),
    d = im.data;
  var part = !!(sh && sh.tone[l] && bits && !(bits & 1) && stepCovers);
  for (var y = 0; y < h; y++) {
    var row = (y + y0) * W + x0;
    for (var x = 0; x < w; x++) {
      var q = row + x;
      if (labels[q] === l && (!part || stepCovers(l, bits, q, sh))) d[(y * w + x) * 4 + 3] = 255;
    }
  }
  mc.putImageData(im, 0, 0);
  var ringOf = function (rad, col) {
    var o = document.createElement('canvas');
    o.width = w;
    o.height = h;
    var oc = o.getContext('2d');
    for (var a = 0; a < 16; a++) {
      var t = (a / 16) * 6.2832;
      oc.drawImage(m, Math.cos(t) * rad, Math.sin(t) * rad);
    }
    oc.globalCompositeOperation = 'source-in';
    oc.fillStyle = col;
    oc.fillRect(0, 0, w, h);
    oc.globalCompositeOperation = 'destination-out';
    oc.drawImage(m, 0, 0);
    return o;
  };
  // (v288: the same two-tone line as Find next's, white inside dark, so it shows on any colour)
  // (the three helper canvases handed back at once: Safari counts them until collected, v296)
  const o1 = ringOf(r2, 'rgba(0,0,0,.8)'),
    o2 = ringOf(r, '#fff');
  ctx.drawImage(o1, x0, y0);
  ctx.drawImage(o2, x0, y0);
  freeCanvas(o1);
  freeCanvas(o2);
  freeCanvas(m);
  return [x0, y0, x0 + w, y0 + h];
}
