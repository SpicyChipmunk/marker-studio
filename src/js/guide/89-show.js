/* ---- Show (v305): the piece shown off ----
   Reveal's end: the art lifts onto its paper over a glow made from its own colours, a sheen sweeps across it, then its
   title, a line of what it took ("448 sections · 16 Ohuhu markers · finished 3 Oct 2026") and its markers as a ribbon
   (their codes under it up to 16 markers). Reveal & share's Share sends the same layout as a 1080 × 1350 image, and
   Save image without the codes saves it too: one layout (showLayout) and one way of drawing it (showDraw) for all of
   them. Made to work in Safari: no canvas filters (the glow is soft washes of the art's own colours, by how much of
   each part of the picture they cover), and the art drawn straight from the picture's canvas, never encoded first.
   The card's file is made while the celebration plays, so Share is ready at once (a share needs the tap's own moment
   in Safari). Close, Escape and Replay take it away; with reduced motion it comes as it ends, without moving. */
const SHOW_BG = '#0c0b0f',
  SHOW_INK = '#f4f2ec',
  SHOW_TITLE = '600 {}px Fraunces, Georgia, serif',
  SHOW_TEXT = '500 {}px "Hanken Grotesk", system-ui, sans-serif',
  // (codes under the ribbon up to this many markers; past it they couldn't be read)
  SHOW_CODES = 16,
  // (the ribbon's markers one by one up to this many; past it, smoothed into as many bands of colour)
  SHOW_BANDS = 24;
const showFont = (f, px) => f.replace('{}', String(Math.round(px * 10) / 10));
function showDate(t) {
  try {
    return new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch (_) {
    return '';
  }
}
// the markers in the order the ribbon shows them: round the colour wheel from the colour the picture starts with, the
// way it goes, the greys after them
function showMarkers() {
  const mk = distinctMk(),
    hs = {},
    lch = {};
  mk.forEach(function (m) {
    const L = (lch[m.mkey] = lchOf(m.lab && m.lab.length ? m.lab : hexToLab(m.hex)));
    hs[m.mkey] = { h: L[2], grey: L[1] < 12 };
  });
  const first = assignData.order.length ? assignData.assign[assignData.order[0]] : null,
    q = assignData.order.length
      ? assignData.assign[assignData.order[Math.floor(assignData.order.length / 4)]]
      : null,
    h0 = first && !hs[first.mkey].grey ? hs[first.mkey].h : 0,
    // (which way round: towards the colour a quarter of the way along)
    up = !(q && !hs[q.mkey].grey && (hs[q.mkey].h - h0 + 360) % 360 > 180);
  const at = function (m) {
    const d = (hs[m.mkey].h - h0 + 360) % 360;
    return up ? d : (360 - d) % 360;
  };
  return mk.slice().sort(function (a, b) {
    const ga = hs[a.mkey].grey,
      gb = hs[b.mkey].grey;
    if (ga !== gb) return ga ? 1 : -1;
    return ga ? lch[b.mkey][0] - lch[a.mkey][0] : at(a) - at(b);
  });
}
// the ribbon: each marker its own colour, or past SHOW_BANDS markers that many bands, each the colours in it mixed by
// how much of the picture they cover
function showBands(mk) {
  if (mk.length <= SHOW_BANDS) return mk.map((m) => hexRgb(m.hex));
  const area = {};
  assignData.order.forEach(function (l) {
    const k = assignData.assign[l].mkey;
    area[k] = (area[k] || 0) + Math.max(1, (comps[l] && comps[l].area) || 1);
  });
  const out = [];
  for (let b = 0; b < SHOW_BANDS; b++) {
    const i0 = Math.floor((b * mk.length) / SHOW_BANDS),
      i1 = Math.floor(((b + 1) * mk.length) / SHOW_BANDS);
    let r = 0,
      g = 0,
      bl = 0,
      w = 0;
    for (let i = i0; i < i1; i++) {
      const c = hexRgb(mk[i].hex),
        a = area[mk[i].mkey] || 1;
      r += c[0] * a;
      g += c[1] * a;
      bl += c[2] * a;
      w += a;
    }
    out.push([Math.round(r / w), Math.round(g / w), Math.round(bl / w)]);
  }
  return out;
}
// the part of the picture shown: the coloured sections' box, with a margin
function showCrop() {
  const B = secBoxes();
  let x0 = W,
    y0 = H,
    x1 = 0,
    y1 = 0;
  assignData.order.forEach(function (l) {
    if (B.x1[l] < 0) return;
    if (B.x0[l] < x0) x0 = B.x0[l];
    if (B.y0[l] < y0) y0 = B.y0[l];
    if (B.x1[l] + 1 > x1) x1 = B.x1[l] + 1;
    if (B.y1[l] + 1 > y1) y1 = B.y1[l] + 1;
  });
  if (x1 <= x0 || y1 <= y0) return { x: 0, y: 0, w: W, h: H };
  const mg = Math.round(Math.max(x1 - x0, y1 - y0) * 0.04);
  x0 = Math.max(0, x0 - mg);
  y0 = Math.max(0, y0 - mg);
  x1 = Math.min(W, x1 + mg);
  y1 = Math.min(H, y1 + mg);
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
// the glow's colours: the picture cut into a grid, each cell the mix of its sections' markers and how much of it they
// cover (paper and lines left out: a page mostly paper gave a grey glow)
function showGlow(cr) {
  const NX = 6,
    NY = Math.max(3, Math.min(10, Math.round((NX * cr.h) / cr.w))),
    acc = new Float64Array(NX * NY * 5),
    step = Math.max(1, Math.floor(Math.sqrt((cr.w * cr.h) / 40000))),
    asg = assignData.assign,
    rc = {};
  for (let y = cr.y; y < cr.y + cr.h; y += step) {
    const gy = Math.min(NY - 1, (((y - cr.y) / cr.h) * NY) | 0);
    for (let x = cr.x; x < cr.x + cr.w; x += step) {
      const k = (gy * NX + Math.min(NX - 1, (((x - cr.x) / cr.w) * NX) | 0)) * 5,
        l = labels[y * W + x],
        m = l > 0 ? asg[l] : null;
      acc[k + 4]++;
      if (!m) continue;
      const c = rc[l] || (rc[l] = hexRgb(m.hex));
      acc[k] += c[0];
      acc[k + 1] += c[1];
      acc[k + 2] += c[2];
      acc[k + 3]++;
    }
  }
  const cells = [];
  for (let gy = 0; gy < NY; gy++)
    for (let gx = 0; gx < NX; gx++) {
      const k = (gy * NX + gx) * 5,
        n = acc[k + 3],
        cov = acc[k + 4] ? n / acc[k + 4] : 0;
      if (cov < 0.04) continue;
      const r = acc[k] / n,
        g = acc[k + 1] / n,
        b = acc[k + 2] / n,
        // (a little more colourful, as light through it would be)
        gr = (r + g + b) / 3;
      cells.push({
        x: (gx + 0.5) / NX,
        y: (gy + 0.5) / NY,
        c: [r, g, b].map(function (v) {
          return Math.max(0, Math.min(255, Math.round(gr + (v - gr) * 1.35)));
        }),
        a: cov,
      });
    }
  return cells;
}
// everything the layouts and drawings need, worked out once
function showModel() {
  if (!assignData || !assignData.order.length) return null;
  const mk = showMarkers(),
    brands = [];
  mk.forEach(function (m) {
    if (brands.indexOf(m.brand) < 0) brands.push(m.brand);
  });
  const one = brands.length === 1 ? brands[0] : '',
    fin = pageDone(),
    cr = showCrop(),
    meta =
      nWord(assignData.N || assignData.order.length, 'section') +
      ' · ' +
      mkCount(mk.length, one) +
      // (a page not finished says nothing about finishing; one finished before the dates were kept, no date)
      (fin ? ' · finished' + (progAt && progAt.e ? ' ' + showDate(progAt.e) : '') : '');
  return {
    title: curName || 'My colouring',
    meta: meta,
    // (v307: without the brand's name, for a line that doesn't fit: shading's markers make it longer)
    metaS: one ? meta.replace(' ' + one + ' marker', ' marker') : meta,
    fin: fin,
    mk: mk,
    bands: showBands(mk),
    codes:
      mk.length <= SHOW_CODES
        ? mk.map(function (m) {
            return { t: m.code, tag: one ? '' : bTag(m.brand), c: m.hex };
          })
        : null,
    mixed: !one,
    crop: cr,
    glow: showGlow(cr),
  };
}
// a title: as big as it fits on one line, else a little smaller, else on two lines, the second cut short with "…"
function showTitleFit(g, text, maxW, fs0) {
  const fit = function (fs) {
    g.font = showFont(SHOW_TITLE, fs);
    return g.measureText(text).width <= maxW;
  };
  if (fit(fs0)) return { lines: [text], fs: fs0 };
  const fs = fs0 * 0.82;
  if (fit(fs)) return { lines: [text], fs: fs };
  g.font = showFont(SHOW_TITLE, fs);
  const cut = function (s) {
    if (g.measureText(s).width <= maxW) return s;
    while (s.length > 1 && g.measureText(s + '…').width > maxW) s = s.slice(0, -1);
    return s.replace(/\s+$/, '') + '…';
  };
  const words = text.split(/\s+/);
  let l1 = words[0],
    i = 1;
  while (i < words.length && g.measureText(l1 + ' ' + words[i]).width <= maxW) l1 += ' ' + words[i++];
  if (i >= words.length) return { lines: [cut(l1)], fs: fs };
  return { lines: [cut(l1), cut(words.slice(i).join(' '))], fs: fs };
}
// The layout, for a w × h space (the card, or the screen above Reveal's bar): where the paper, the art on it and the
// caption go, and the caption's parts. Tall spaces (and the card) put the caption under the art, centred; wide ones
// beside it, on the left of its column, with the codes as chips in two rows. o.top: room kept clear at the top (the
// ✕); o.card: the card's own margins and its line at the foot.
function showLayout(g, M, w, h, o) {
  o = o || {};
  const land = !o.card && w > h * 1.15,
    s = land ? Math.min(w / 1900, h / 1200) : Math.min(w / 1080, h / 1350),
    u = function (v, mn) {
      return Math.max(mn || 0, v * s);
    },
    cw = M.crop.w,
    ch = M.crop.h,
    n = M.mk.length,
    pp = u(22, 8),
    L = { land: land, s: s, w: w, h: h };
  const titleFs = u(58, 22),
    metaFs = u(24, 12.5),
    ribH = u(26, 12),
    codeFs = u(15, 9.5),
    capW = land ? Math.max(260, Math.min(440, w * 0.32)) : Math.min(w - 2 * u(70, 16), u(900)),
    T = showTitleFit(g, M.title, capW, titleFs),
    lh = T.fs * 1.14;
  let metaFs2 = metaFs,
    metaT = M.meta;
  // (the line of what it took: smaller rather than cut, down to 80%; then without the brand's name, v307)
  [M.meta, M.metaS].forEach(function (t, i) {
    if (i && (t === M.meta || g.measureText(metaT).width <= capW)) return;
    metaT = t;
    metaFs2 = metaFs;
    g.font = showFont(SHOW_TEXT, metaFs2);
    while (metaFs2 > metaFs * 0.8 && g.measureText(t).width > capW) {
      metaFs2 -= 0.5;
      g.font = showFont(SHOW_TEXT, metaFs2);
    }
  });
  // the codes: under each of the ribbon's markers (tall), or chips in one or two rows (wide)
  let codes = null,
    ribW = land ? capW : Math.min(capW, Math.max(u(260), n * u(66)), u(860));
  if (M.codes) {
    g.font = showFont(SHOW_TEXT, 100).replace('500', '600');
    let widest = 0;
    M.codes.forEach(function (c) {
      widest = Math.max(widest, g.measureText((c.tag ? c.tag + ' ' : '') + c.t).width / 100);
    });
    if (land) {
      const rows = n <= 6 ? 1 : 2,
        per = Math.ceil(n / rows),
        chipW = capW / per,
        sw = codeFs * 0.9,
        fs = Math.max(7.5, Math.min(codeFs, (chipW - sw - 8) / Math.max(1, widest))),
        rh = Math.max(fs, sw) + u(12, 8);
      codes = { land: true, rows: rows, per: per, chipW: chipW, fs: fs, sw: fs * 0.9, rh: rh, h: rows * rh };
    } else {
      const segW = ribW / n,
        fs = Math.max(7.5, Math.min(codeFs, (segW - 3) / Math.max(1, widest)));
      codes = { land: false, fs: fs, h: u(10) + fs * 1.3 };
    }
  }
  const capH =
    T.lines.length * lh + u(14) + metaFs2 + u(26, 10) + ribH + (codes ? (land ? u(16, 10) : 0) + codes.h : 0);
  const fitArt = function (aw, ah) {
    const k = Math.min(aw / cw, ah / ch);
    return { w: Math.max(1, cw * k), h: Math.max(1, ch * k) };
  };
  let capX, capY;
  if (land) {
    const pad = u(48, 20),
      top = Math.max(o.top || 0, u(48, 20)),
      gapX = u(64, 24),
      A = fitArt(w - 2 * pad - capW - gapX - 2 * pp, h - top - pad - 2 * pp),
      blockW = A.w + 2 * pp + gapX + capW,
      x0 = Math.max(pad, (w - blockW) / 2);
    L.paper = {
      x: x0,
      y: top + Math.max(0, (h - top - pad - (A.h + 2 * pp)) / 2),
      w: A.w + 2 * pp,
      h: A.h + 2 * pp,
    };
    capX = L.paper.x + L.paper.w + gapX;
    capY = Math.max(top, L.paper.y + L.paper.h / 2 - capH / 2);
    L.align = 'left';
  } else {
    const side = o.card ? u(80) : u(60, 16),
      top = o.card ? u(72) : Math.max(o.top || 0, u(40, 16)),
      bot = o.card ? u(110) : u(36, 16),
      gap = u(52, 18),
      A = fitArt(w - 2 * side - 2 * pp, h - top - bot - gap - capH - 2 * pp),
      blockH = A.h + 2 * pp + gap + capH;
    L.paper = {
      x: (w - A.w - 2 * pp) / 2,
      y: top + Math.max(0, (h - top - bot - blockH) / 2),
      w: A.w + 2 * pp,
      h: A.h + 2 * pp,
    };
    capX = (w - capW) / 2;
    capY = L.paper.y + L.paper.h + gap;
    L.align = 'center';
  }
  L.art = { x: L.paper.x + pp, y: L.paper.y + pp, w: L.paper.w - 2 * pp, h: L.paper.h - 2 * pp };
  L.r = u(10, 6);
  L.cap = { x: capX, y: capY, w: capW, h: capH };
  const tx = land ? capX : capX + capW / 2;
  L.title = { lines: T.lines, fs: T.fs, lh: lh, x: tx, y: capY + T.fs * 0.92 };
  const lastBase = L.title.y + (T.lines.length - 1) * lh;
  L.meta = { t: metaT, fs: metaFs2, x: tx, y: lastBase + u(14) + metaFs2 };
  const rx = land ? capX : capX + (capW - ribW) / 2;
  L.rib = { x: rx, y: L.meta.y + u(26, 10) - metaFs2 * 0.2, w: ribW, h: ribH };
  if (codes) {
    codes.y = L.rib.y + ribH + (land ? u(16, 10) : u(10));
    L.codes = codes;
  }
  if (o.card) L.foot = { fs: u(22), y: h - u(44) };
  return L;
}
function showRR(g, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
const _rgba = (c, a) => 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
// the room: dark, lit by the art's own colours round where the paper is, darker towards the caption
function showDrawGlow(g, M, L) {
  const w = L.w,
    h = L.h,
    P = L.paper;
  g.fillStyle = SHOW_BG;
  g.fillRect(0, 0, w, h);
  const ex = 0.3,
    ax = P.x - P.w * ex,
    ay = P.y - P.h * ex,
    aw = P.w * (1 + 2 * ex),
    ah = P.h * (1 + 2 * ex),
    R = Math.max(aw, ah) * 0.36;
  M.glow.forEach(function (c) {
    const x = ax + c.x * aw,
      y = ay + c.y * ah,
      gr = g.createRadialGradient(x, y, 0, x, y, R);
    gr.addColorStop(0, _rgba(c.c, (0.34 * c.a).toFixed(3)));
    gr.addColorStop(1, _rgba(c.c, 0));
    g.fillStyle = gr;
    g.fillRect(x - R, y - R, 2 * R, 2 * R);
  });
  const v = L.land ? g.createLinearGradient(0, 0, w, 0) : g.createLinearGradient(0, 0, 0, h);
  v.addColorStop(0, 'rgba(12,11,15,.2)');
  v.addColorStop(0.55, 'rgba(12,11,15,.5)');
  v.addColorStop(1, 'rgba(12,11,15,.94)');
  g.fillStyle = v;
  g.fillRect(0, 0, w, h);
}
// the paper and the art on it (src: the picture's canvas, k of its pixels to one of the picture's; at = where, when not
// the layout's own place: the screen draws the paper in an element of its own)
function showDrawPaper(g, M, L, src, k, at) {
  const P = at ? at.paper : L.paper,
    A = at ? at.art : L.art,
    cr = M.crop;
  g.save();
  if (!at) {
    g.shadowColor = 'rgba(0,0,0,.55)';
    g.shadowBlur = Math.max(18, 60 * L.s);
    g.shadowOffsetY = Math.max(8, 26 * L.s);
  }
  g.fillStyle = 'rgb(' + PAPER.join(',') + ')';
  showRR(g, P.x, P.y, P.w, P.h, L.r);
  g.fill();
  g.restore();
  g.save();
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.drawImage(src, cr.x * k, cr.y * k, cr.w * k, cr.h * k, A.x, A.y, A.w, A.h);
  g.restore();
}
// the title, the line of what it took, the ribbon and the codes (ox, oy: where the caption's own canvas starts)
function showDrawCap(g, M, L, ox, oy) {
  ox = ox || 0;
  oy = oy || 0;
  g.save();
  g.translate(-ox, -oy);
  g.textBaseline = 'alphabetic';
  g.textAlign = L.align;
  g.fillStyle = SHOW_INK;
  g.font = showFont(SHOW_TITLE, L.title.fs);
  L.title.lines.forEach(function (t, i) {
    g.fillText(t, L.title.x, L.title.y + i * L.title.lh);
  });
  g.font = showFont(SHOW_TEXT, L.meta.fs);
  g.fillStyle = 'rgba(244,242,236,.66)';
  g.fillText(L.meta.t, L.meta.x, L.meta.y);
  // the ribbon
  const R = L.rib,
    B = M.bands;
  g.save();
  g.shadowColor = 'rgba(0,0,0,.35)';
  g.shadowBlur = Math.max(6, 18 * L.s);
  g.shadowOffsetY = Math.max(2, 6 * L.s);
  showRR(g, R.x, R.y, R.w, R.h, R.h / 2);
  g.fillStyle = _rgba(B[0], 1);
  g.fill();
  g.restore();
  g.save();
  showRR(g, R.x, R.y, R.w, R.h, R.h / 2);
  g.clip();
  if (M.mk.length > SHOW_BANDS) {
    // (many markers: the bands blend into each other, a band of hue rather than a barcode)
    const lg = g.createLinearGradient(R.x, 0, R.x + R.w, 0);
    B.forEach(function (c, i) {
      lg.addColorStop((i + 0.5) / B.length, _rgba(c, 1));
    });
    g.fillStyle = lg;
    g.fillRect(R.x, R.y, R.w, R.h);
  } else {
    const sw = R.w / B.length;
    B.forEach(function (c, i) {
      g.fillStyle = _rgba(c, 1);
      g.fillRect(R.x + i * sw, R.y, sw + 1, R.h);
    });
  }
  g.restore();
  const C = L.codes;
  if (C && M.codes) {
    g.fillStyle = 'rgba(244,242,236,.62)';
    if (!C.land) {
      const sw = R.w / M.codes.length;
      g.textAlign = 'center';
      M.codes.forEach(function (c, i) {
        const x = R.x + i * sw + sw / 2,
          y = C.y + C.fs;
        if (c.tag) {
          // (mixed brands: the brand's letter before the code, a little fainter)
          g.font = '700 ' + C.fs * 0.8 + 'px ' + LFONT;
          const tw = g.measureText(c.tag + ' ').width;
          g.font = '600 ' + C.fs + 'px ' + LFONT;
          const cw = g.measureText(c.t).width;
          g.textAlign = 'left';
          g.font = '700 ' + C.fs * 0.8 + 'px ' + LFONT;
          g.fillStyle = 'rgba(244,242,236,.42)';
          g.fillText(c.tag, x - (tw + cw) / 2, y);
          g.font = '600 ' + C.fs + 'px ' + LFONT;
          g.fillStyle = 'rgba(244,242,236,.62)';
          g.fillText(c.t, x - (tw + cw) / 2 + tw, y);
          g.textAlign = 'center';
        } else {
          g.font = '600 ' + C.fs + 'px ' + LFONT;
          g.fillText(c.t, x, y);
        }
      });
    } else {
      g.textAlign = 'left';
      M.codes.forEach(function (c, i) {
        const r = Math.floor(i / C.per),
          j = i % C.per,
          x = L.cap.x + j * C.chipW,
          y = C.y + r * C.rh;
        g.fillStyle = c.c;
        showRR(g, x, y, C.sw, C.sw, C.sw * 0.25);
        g.fill();
        g.strokeStyle = 'rgba(255,255,255,.25)';
        g.lineWidth = 1;
        g.stroke();
        let tx = x + C.sw + 5;
        const ty = y + C.sw * 0.82;
        if (c.tag) {
          g.font = '700 ' + C.fs * 0.8 + 'px ' + LFONT;
          g.fillStyle = 'rgba(244,242,236,.42)';
          g.fillText(c.tag, tx, ty);
          tx += g.measureText(c.tag + ' ').width;
        }
        g.font = '600 ' + C.fs + 'px ' + LFONT;
        g.fillStyle = 'rgba(244,242,236,.7)';
        g.fillText(c.t, tx, ty);
      });
    }
  }
  if (L.foot) {
    g.textAlign = 'center';
    g.font = showFont(SHOW_TITLE, L.foot.fs);
    g.fillStyle = 'rgba(244,242,236,.42)';
    // (mixed brands with their letters shown: which letter is which)
    g.fillText('Made with Marker Studio', L.w / 2, L.foot.y - (M.mixed && M.codes ? L.foot.fs * 1.1 : 0));
    if (M.mixed && M.codes) {
      g.font = showFont(SHOW_TEXT, L.foot.fs * 0.8);
      g.fillText(brandKey().replace(/\s{2,}/g, '   '), L.w / 2, L.foot.y + L.foot.fs * 0.2);
    }
  }
  g.restore();
}
// the shared picture: w × h (1080 × 1350 unless asked), drawn from src (the picture's canvas, or Save image's)
function buildShowCard(src, k, w, h) {
  const M = showModel();
  if (!M) return null;
  w = w || 1080;
  h = h || 1350;
  src = src || cv;
  if (k == null) k = src.width / W;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d'),
    L = showLayout(g, M, w, h, { card: true });
  showDrawGlow(g, M, L);
  showDrawPaper(g, M, L, src, k);
  showDrawCap(g, M, L);
  return c;
}
// ---- Reveal's end, on screen ----
let _show = null;
// the fonts the caption is drawn in, loaded (they're in the app, so this is quick; a failure draws in the fallbacks)
function showFonts() {
  try {
    return Promise.all([
      document.fonts.load(showFont(SHOW_TITLE, 40)),
      document.fonts.load(showFont(SHOW_TEXT, 20)),
      document.fonts.load('600 15px "Hanken Grotesk"'),
    ]).catch(function () {});
  } catch (_) {
    return Promise.resolve();
  }
}
function showReduced() {
  return reducedMotion();
}
function showStart() {
  showEnd();
  const M = showModel();
  if (!M) return;
  const still = showReduced(),
    el = document.createElement('div');
  el.className = 'sfshow' + (still ? ' still' : '');
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', M.title + '. ' + M.meta);
  document.body.appendChild(el);
  const S = { el: el, M: M, blob: null, busy: null, gen: loadGen, anims: [] };
  _show = S;
  // where the art is on the screen now, for it to lift from (before the picture is covered)
  let from = null;
  try {
    const r = cv.getBoundingClientRect();
    if (r.width > 0) {
      const cr = M.crop;
      from = {
        x: r.left + (cr.x / W) * r.width,
        y: r.top + (cr.y / H) * r.height,
        w: (cr.w / W) * r.width,
        h: (cr.h / H) * r.height,
      };
    }
  } catch (_) {}
  showPaint(S, still ? null : from);
  // (the share card's file, made now: Share is then ready the moment it's tapped)
  S.busy = showFonts().then(function () {
    return new Promise(function (res) {
      setTimeout(function () {
        if (_show !== S) return res(null);
        let c = null;
        try {
          c = buildShowCard(cv);
        } catch (_) {}
        if (!c) return res(null);
        c.toBlob(function (b) {
          freeCanvas(c);
          if (_show === S) S.blob = b;
          res(b);
        }, 'image/png');
      }, 120);
    });
  });
  S.onResize = function () {
    if (_show === S) showPaint(S, null);
  };
  window.addEventListener('resize', S.onResize);
}
// lay the celebration out for the screen as it is (from: where the art lifts from, or null for its final state)
function showPaint(S, from) {
  const el = S.el,
    M = S.M,
    w = el.clientWidth,
    h = el.clientHeight,
    dpr = Math.min(2, window.devicePixelRatio || 1);
  S.anims.forEach(function (a) {
    try {
      a.cancel();
    } catch (_) {}
  });
  S.anims = [];
  el.innerHTML = '';
  if (w < 40 || h < 40) return;
  const mg = document.createElement('canvas').getContext('2d'),
    L = showLayout(mg, M, w, h, { top: 64 });
  const mk = function (cls, R) {
    const c = document.createElement('canvas');
    c.className = cls;
    c.width = Math.max(1, Math.round(R.w * dpr));
    c.height = Math.max(1, Math.round(R.h * dpr));
    c.style.left = R.x + 'px';
    c.style.top = R.y + 'px';
    c.style.width = R.w + 'px';
    c.style.height = R.h + 'px';
    return c;
  };
  // the room's light: drawn small (it's soft) and scaled up
  const bg = mk('sfsh-bg', { x: 0, y: 0, w: w, h: h });
  {
    const g = bg.getContext('2d');
    bg.width = Math.max(1, Math.round(w * 0.5));
    bg.height = Math.max(1, Math.round(h * 0.5));
    g.scale(0.5, 0.5);
    showDrawGlow(g, M, L);
  }
  el.appendChild(bg);
  // the paper, with the art on it and the sheen over it
  const P = L.paper,
    pa = document.createElement('div');
  pa.className = 'sfsh-paper';
  Object.assign(pa.style, {
    left: P.x + 'px',
    top: P.y + 'px',
    width: P.w + 'px',
    height: P.h + 'px',
    borderRadius: L.r + 'px',
  });
  const ac = document.createElement('canvas');
  ac.width = Math.max(1, Math.round(P.w * dpr));
  ac.height = Math.max(1, Math.round(P.h * dpr));
  {
    const g = ac.getContext('2d');
    g.scale(dpr, dpr);
    const pp = L.art.x - P.x;
    showDrawPaper(g, M, L, cv, cv.width / W, {
      paper: { x: 0, y: 0, w: P.w, h: P.h },
      art: { x: pp, y: pp, w: L.art.w, h: L.art.h },
    });
  }
  pa.appendChild(ac);
  const sh = document.createElement('i');
  sh.className = 'sfsh-sheen';
  pa.appendChild(sh);
  el.appendChild(pa);
  // the caption (its fonts loaded first; the card waits for them too)
  const cap = mk('sfsh-cap', L.cap);
  el.appendChild(cap);
  const drawCap = function () {
    if (_show !== S || !cap.isConnected) return;
    const g = cap.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, cap.width, cap.height);
    g.scale(dpr, dpr);
    showDrawCap(g, M, L, L.cap.x, L.cap.y);
    cap.dataset.drawn = '1';
  };
  showFonts().then(drawCap);
  if (!from || !el.animate) return;
  // the art lifts from where it was onto its paper and settles; the room takes its colours; one sheen; then the words
  const A = L.art,
    sx = from.w / A.w,
    dx = from.x + from.w / 2 - (A.x + A.w / 2),
    dy = from.y + from.h / 2 - (A.y + A.h / 2),
    ease = 'cubic-bezier(.2,.9,.25,1.12)',
    an = function (node, kf, o) {
      try {
        S.anims.push(node.animate(kf, Object.assign({ fill: 'both' }, o)));
      } catch (_) {}
    };
  an(el, [{ backgroundColor: 'rgba(12,11,15,0)' }, { backgroundColor: SHOW_BG }], { duration: 400 });
  an(
    pa,
    [
      {
        transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + sx + ')',
        boxShadow: '0 0 0 rgba(0,0,0,0)',
      },
      { transform: 'none', boxShadow: '0 30px 70px rgba(0,0,0,.6)' },
    ],
    { duration: 900, easing: ease },
  );
  an(
    bg,
    [
      { opacity: 0, transform: 'scale(1.12)' },
      { opacity: 1, transform: 'none' },
    ],
    {
      duration: 1300,
      easing: 'ease-out',
    },
  );
  an(sh, [{ transform: 'translateX(-120%)' }, { transform: 'translateX(120%)' }], {
    duration: 1100,
    delay: 650,
    easing: 'ease-in-out',
  });
  an(
    cap,
    [
      { opacity: 0, transform: 'translateY(14px)' },
      { opacity: 1, transform: 'none' },
    ],
    {
      duration: 600,
      delay: 850,
      easing: 'ease-out',
    },
  );
}
function showEnd() {
  const S = _show;
  if (!S) return;
  _show = null;
  window.removeEventListener('resize', S.onResize);
  S.anims.forEach(function (a) {
    try {
      a.cancel();
    } catch (_) {}
  });
  if (S.el.parentNode) S.el.parentNode.removeChild(S.el);
}
// Reveal's Share: the card made while it played, at once; else made now (then Safari may want a second tap: the
// "Your image is ready · Share" toast, handOver)
function shareCard() {
  const S = _show,
    send = function (blob) {
      if (!blob) {
        note('Couldn’t make the image.');
        return;
      }
      shareOrSave(blob, 'marker-studio-card.png', curName || 'My colouring', 'image', 'Image downloaded.');
    };
  if (S && S.blob) return send(S.blob);
  if (S && S.busy)
    return S.busy.then(function (b) {
      if (b) send(b);
      else shareCardNow(send);
    });
  shareCardNow(send);
}
function shareCardNow(send) {
  showFonts().then(function () {
    let c = null;
    try {
      c = buildShowCard(cv);
    } catch (_) {}
    if (!c) return send(null);
    c.toBlob(function (b) {
      freeCanvas(c);
      send(b);
    }, 'image/png');
  });
}
