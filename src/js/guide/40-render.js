// texture: distance to the nearest line (capped at 12, worked out directly in bytes) and a streaky paper field
function buildTexFields() {
  const n = W * H,
    E = new Uint8Array(n);
  for (let y = 0; y < H; y++) {
    const ro = y * W;
    for (let x = 0; x < W; x++) {
      const q = ro + x;
      let d = labels[q] === -1 ? 0 : 12;
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
    ph = (0.07 * SN) / 6.283185307179586;
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
}
// label points: the roomiest spot in each section (largest distance to its edge). The same two passes also give
// each section's box, centre and area, and the distances shading needs, so nothing walks the picture again for them.
function buildLabelPts() {
  if (!labels || !comps) return;
  const n = W * H,
    K = comps.length,
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
  labelPts = new Array(K);
  for (let l = 1; l < K; l++) {
    const q = bi[l];
    if (q < 0) continue;
    const x = q % W,
      y = (q / W) | 0;
    let a = x,
      b = x;
    while (a > 0 && labels[y * W + a - 1] === l) a--;
    while (b < W - 1 && labels[y * W + b + 1] === l) b++;
    labelPts[l] = { x: (a + b + 1) / 2, y: y + 0.5, r: bv[l], aw: b - a + 1 };
  }
  Q._lp = labelPts;
  Q._sx = sx;
  Q._sy = sy;
  Q._ar = ar;
  _ldq = Q;
  _sb = { lp: labelPts, K: K, x0: x0, y0: y0, x1: x1, y1: y1 };
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
const TAG = {
  gap: 0.2,
  pad: 0.15,
  h: 0.8,
  r: 0.28,
  font: 0.62,
  line: 0.07,
  dark: '#26252b',
  pale: '#c4c1c9',
};
function tagOutlined(brand) {
  return brand === 'Copic';
}
function drawTag(g, tg, outlined, x, y, w, fs, col) {
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
  g.fillStyle = outlined ? col.pale : col.dark;
  g.fill();
  g.lineWidth = Math.max(1, fs * TAG.line);
  g.strokeStyle = col.dark;
  g.stroke();
  g.fillStyle = outlined ? col.dark : '#fff';
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
  if (L.tg) drawTag(g, L.tg, tagOutlined(m.brand), x0 + L.cw + fs * TAG.gap, y, L.gw, fs, o.tag || TAG);
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
        zoneSwitch(+b.dataset.z);
        if (gTab !== 'pattern' && gTab !== 'colours' && !(gTab === 'shading' && shadeMode !== 'off'))
          planTab('pattern');
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
  let top;
  if (top0 - g - h >= vt) top = top0 - g - h;
  else if (bot0 + g + h <= ih - 6) top = bot0 + g;
  else {
    const gp = Math.max(10, Math.min(28, (p.r || 6) * sx * 0.5 + 6));
    top = py - gp - h >= vt ? py - gp - h : Math.min(py + gp, Math.max(6, ih - 6 - h));
  }
  let lo = Math.max(6, hv.left + 6),
    hi = Math.min(iw, hv.right) - 6 - w;
  if (hi < lo) {
    lo = 6;
    hi = Math.max(6, iw - 6 - w);
  }
  d.style.left = Math.round(Math.max(lo, Math.min(hi, px - w / 2))) + 'px';
  d.style.top = Math.round(top) + 'px';
}
// said by screen readers (an aria-live region made in mount)
function sayLive(t) {
  const el = document.getElementById('sfLive');
  if (!el) return;
  sayLive.at = Date.now();
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
function secLabel(l, m, dim, draw) {
  const c = comps[l],
    p = labelPos(l);
  if (dim && colored[l]) {
    const fs = Math.floor(Math.max(7, Math.min(p.r * 1.7, Math.sqrt(c.area) * 0.5, 30)) * 2) / 2;
    if (draw) {
      ctx.font = '700 ' + fs + 'px ' + LFONT;
      ctx.fillStyle = '#3f7d4e';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('✓', p.x, p.y);
    }
    return [p.x - fs * 0.7 - 2, p.y - fs * 0.8 - 2, p.x + fs * 0.7 + 2, p.y + fs * 0.8 + 2];
  }
  const dark = darkText(m.hex),
    o = {
      base: 9,
      min: 5,
      w: 600,
      swk: 0.27,
      stroke: dark ? 'rgba(255,255,255,.9)' : 'rgba(0,0,0,.55)',
      fill: dark ? '#141414' : '#fff',
    };
  let fs, b;
  if (draw) {
    const fa = stepFaint(l);
    if (fa) {
      ctx.save();
      ctx.globalAlpha = 0.3;
    }
    fs = drawCode(ctx, l, m, o);
    if (fa) ctx.restore();
    b = _lastBox.slice();
  } else {
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
      const k = gy * G.nx + gx;
      (G.c[k] || (G.c[k] = [])).push(l);
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
          mul = (e >= 9 ? 1 : 1 - A * (1 - e * 0.1111)) * (1 + Bt * (texField[p] - 128));
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
function renderGuide() {
  if (!assignData) return;
  _mixKey = null;
  sizeCanvas();
  if (sfmode !== 'guide') {
    if (popOpen()) closeSwatchPop(false);
    if (tipL >= 0) hideTip();
  }
  if (!labelPts) buildLabelPts();
  const assign = assignData.assign,
    n = W * H,
    K = comps.length,
    finView = sfmode === 'color' && focus && focusFin,
    dim = sfmode === 'color' && !finView;
  const fade = {};
  if (zoneEditOn()) {
    // the zone editor: the zone's own sections in their colours, the rest faded
    for (const l in assign) if (zoneOf(+l) !== zoneCur) fade[l] = 1;
  } else if (hlKey) {
    for (const l in assign) {
      if (!hlMatch(+l)) fade[l] = 1;
    }
  } else if (photoRoughOnly && revealF == null && sfmode === 'guide' && family === 'photo' && _phErr) {
    for (const l in assign) {
      if (!(_phErr[l] >= PH_ROUGH)) fade[l] = 1;
    }
  }
  const colArr = new Array(K);
  const fcur = focusCur();
  for (const l in assign) {
    const b = hexRgb(assign[l].hex);
    colArr[l] = fade[l]
      ? [(b[0] * 0.12 + 224) | 0, (b[1] * 0.12 + 224) | 0, (b[2] * 0.12 + 224) | 0]
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
  if (sh) for (const l in assign) shOK[l] = !fade[l] && !(dim && colored[l]) && !(fcur > 0 && +l !== fcur);
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
              ef = e >= 9 ? 1 : e * 0.1111,
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
  const labOn = revealF == null && !finView && !(hideLabels && sfmode === 'guide'),
    linesOn = !!(sh && shadeLines && revealF == null && !hideLabels && !finView),
    anch = sfmode === 'guide' && family === 'blend' && anchors.length > 0 && revealF == null;
  // what each section looks like now; a section whose key is unchanged since the last draw is left alone
  const skey = new Array(K),
    lkA = new Int8Array(K);
  for (const l in assign) {
    const shown = revealF == null || (revOrder && revOrder[l] <= revealF),
      lk = (lkA[l] =
        !labOn || fade[l] || (fcur > 0 && +l !== fcur && !colored[l]) ? 0 : dim && colored[l] ? 1 : 2);
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
      (lk === 2 && +l === fcur && stepFaint(+l) ? 'f' : '');
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
    anch,
    sfmode,
    family,
    brandsMixed(),
    _fontGen,
    cv.width,
    cv.height,
  ];
  const ring =
    fcur > 0 && focusBox
      ? fcur + '|' + stepBits(focusPos) + '|' + (((cv.offsetWidth || W) / W) * focusZ).toFixed(4)
      : '';
  let inc = !!(
    _rg &&
    !anch &&
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
      renderIncremental(dirty, skey, lkA, colArr, sh, shOK, tex, linesOn, dim, fcur, ring);
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
    if (labOn)
      for (const l in assign) {
        if (!lkA[l]) continue;
        const b = secLabel(+l, assign[l], dim, true);
        lb[l] = b;
        rgGridAdd(G, +l, b);
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
    _rg = { gk: gk, skey: skey, lb: lb, G: G, ring: ring, ringRect: rr };
  }
  positionSun();
  positionZones();
  positionPhoto();
  if (tipL >= 0) positionTip();
  if (olSet) positionOutline();
  if (!pickPending()) scheduleAutosave();
}
function renderIncremental(dirty, skey, lkA, colArr, sh, shOK, tex, linesOn, dim, fcur, ring) {
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
      const b = secLabel(l, assign[l], dim, false);
      lb[l] = b;
      addR(b);
      rgGridAdd(_rg.G, l, b);
    }
  }
  addR(_rg.ringRect);
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
    if (!ids.length) continue;
    ids.sort(function (a, b) {
      return a - b;
    });
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let k = 0; k < ids.length; k++) secLabel(ids[k], assign[ids[k]], dim, true);
  }
  _rg.skey = skey;
  _rg.ring = ring;
  _rg.ringRect = fcur > 0 ? drawFocusRing(fcur, stepBits(focusPos), sh) : null;
}
function drawFocusRing(l, bits, sh) {
  if (!focusBox) return null;
  var k = ((cv.offsetWidth || W) / W) * focusZ,
    r = Math.max(1.5, 3 / k),
    r2 = r + Math.max(1, 2 / k),
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
  ctx.drawImage(ringOf(r2, 'rgba(0,0,0,.6)'), x0, y0);
  ctx.drawImage(ringOf(r, '#ffd84a'), x0, y0);
  return [x0, y0, x0 + w, y0 + h];
}
