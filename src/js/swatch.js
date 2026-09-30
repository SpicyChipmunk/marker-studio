/* ===== Swatch chart (Markers › Print a swatch chart) =====
   A PDF with a box for every marker, to colour in with the real marker and pin up; beside each box is a strip of the
   colour shown on screen, which is only an approximation. It is made with the guide's PDF writer, paper sizes and
   share-or-save (SF.pdfKit). The page is laid out in millimetres as a regular grid of same-size cells, with a
   registration mark in each corner (the bottom-right one hollow, to tell which way up) and a number by every box,
   so that a later version can photograph a coloured chart and read each marker's real colour back. */
const SW_KEY = 'ms-swatch';
let swOpt = { what: 'owned', order: 'fam', labels: 'name' },
  swBusy = false,
  swOpener = null;
try {
  const o = JSON.parse(localStorage.getItem(SW_KEY) || 'null');
  if (o && typeof o === 'object') {
    if (o.order === 'code') swOpt.order = 'code';
    if (o.labels === 'code') swOpt.labels = 'code';
  }
} catch (_) {}
function swWhatOpts() {
  return [
    ['owned', 'My collection'],
    ['wish', 'To buy'],
  ].concat(
    BRAND_DEFS.map(function (b) {
      return [b.k, 'All ' + b.t];
    }),
  );
}
// the markers for a choice: your collection, the To buy list, or every marker of one brand
function swList(what) {
  const out = [];
  if (what === 'wish') {
    const seen = {};
    state.wish.forEach(function (w) {
      const i = keyIdx(w.k);
      if (i != null && !seen[i]) {
        seen[i] = 1;
        out.push(i);
      }
    });
    return out;
  }
  for (let i = 0; i < COLORS.length; i++)
    if (what === 'owned' ? isOwned(i) : COLORS[i].brand === what) out.push(i);
  return out;
}
// by brand, then in colour families the way the Markers grid shows them, or by code (R2 before R10)
function swGroups(idxs, order) {
  const fp = {},
    by = {};
  families.forEach(function (f, k) {
    fp[f.name] = k;
  });
  idxs.forEach(function (i) {
    (by[COLORS[i].brand] = by[COLORS[i].brand] || []).push(i);
  });
  const cmp =
    order === 'code'
      ? function (a, b) {
          return COLORS[a].code.localeCompare(COLORS[b].code, 'en', { numeric: true }) || a - b;
        }
      : function (a, b) {
          return (fp[COLORS[a].fam] || 0) - (fp[COLORS[b].fam] || 0) || a - b;
        };
  return BRAND_DEFS.map(function (b) {
    return b.k;
  })
    .concat(
      Object.keys(by).filter(function (b) {
        return !BRAND_DEFS.some(function (d) {
          return d.k === b;
        });
      }),
    )
    .filter(function (b) {
      return by[b];
    })
    .map(function (b) {
      return { brand: b, idxs: by[b].sort(cmp) };
    });
}
// page geometry in mm: margins, corner marks (R), the grid's cells (a box big enough for a brush or chisel nib, the
// screen-colour strip beside it, code and name below) and the band a brand heading takes
function swGeom(pap, labels) {
  const pk = SF.pdfKit,
    P = pk.PAPERS[pap] || pk.PAPERS.letter,
    pw = (P[0] / 72) * 25.4,
    ph = (P[1] / 72) * 25.4,
    sm = pw < 160,
    m = sm ? 9 : 12,
    R = 4,
    gap = 3,
    box = sm ? 16 : 18,
    cols = Math.max(2, Math.floor((pw - 2 * m + gap) / ((sm ? 30 : 34) + gap))),
    cw = (pw - 2 * m - gap * (cols - 1)) / cols,
    top = m + R + 7,
    bot = ph - m - R - 2,
    hh = 7,
    ch = box + (labels === 'code' ? 4.4 : 7.6) + 2.8;
  return {
    pw: pw,
    ph: ph,
    m: m,
    R: R,
    gap: gap,
    box: box,
    sw: Math.min(10, cw - box - 5.8),
    cols: cols,
    cw: cw,
    ch: ch,
    top: top,
    bot: bot,
    hh: hh,
    labels: labels,
  };
}
// where every heading and box goes, page by page (mm); boxes are numbered 1…N through the chart. Each brand starts on
// a new row under its heading (on a new page if the heading and one row don't fit), and a page it runs onto repeats it.
function swLayout(groups, g) {
  const pages = [];
  let pg = null,
    y = 0,
    col = 0,
    no = 0;
  const fits = function (h) {
    return y + h <= g.bot + 0.01;
  };
  const newPage = function () {
    pg = { items: [] };
    pages.push(pg);
    y = g.top;
  };
  groups.forEach(function (gr) {
    if (pg) y += 2;
    if (!pg || !fits(g.hh + g.ch)) newPage();
    pg.items.push({ h: gr.brand, n: gr.idxs.length, y: y });
    y += g.hh;
    col = 0;
    gr.idxs.forEach(function (i) {
      if (col === g.cols) {
        col = 0;
        y += g.ch;
      }
      if (!fits(g.ch)) {
        newPage();
        pg.items.push({ h: gr.brand, n: gr.idxs.length, y: y, cont: true });
        y += g.hh;
        col = 0;
      }
      pg.items.push({ i: i, no: ++no, x: g.m + col * (g.cw + g.gap), y: y });
      col++;
    });
    y += g.ch;
    col = 0;
  });
  return pages;
}
function swTrunc(x, t, max) {
  if (x.measureText(t).width <= max) return t;
  while (t.length > 1 && x.measureText(t + '…').width > max) t = t.slice(0, -1);
  return t + '…';
}
// one page of the chart, drawn on a white canvas at the PDF's resolution
function swDraw(pg, pi, np, g, info) {
  const pk = SF.pdfKit,
    P = pk.PAPERS[info.paper] || pk.PAPERS.letter,
    k = pk.DPI / 25.4,
    M = function (v) {
      return v * k;
    },
    c = document.createElement('canvas');
  c.width = Math.round((P[0] / 72) * pk.DPI);
  c.height = Math.round((P[1] / 72) * pk.DPI);
  const x = c.getContext('2d'),
    F = function (w, pt) {
      x.font = w + ' ' + ((pt * pk.DPI) / 72).toFixed(1) + 'px ' + pk.FONT;
    };
  x.fillStyle = '#fff';
  x.fillRect(0, 0, c.width, c.height);
  x.textBaseline = 'alphabetic';
  x.textAlign = 'left';
  [
    [g.m, g.m],
    [g.pw - g.m - g.R, g.m],
    [g.m, g.ph - g.m - g.R],
    [g.pw - g.m - g.R, g.ph - g.m - g.R],
  ].forEach(function (p, j) {
    x.fillStyle = '#000';
    x.fillRect(M(p[0]), M(p[1]), M(g.R), M(g.R));
    if (j === 3) {
      x.fillStyle = '#fff';
      x.fillRect(M(p[0] + 1), M(p[1] + 1), M(g.R - 2), M(g.R - 2));
    }
  });
  const t0 = g.m + g.R + 3,
    t1 = g.pw - g.m - g.R - 3,
    first = pg.items.find(function (it) {
      return !it.h;
    }),
    last = pg.items
      .slice()
      .reverse()
      .find(function (it) {
        return !it.h;
      });
  x.fillStyle = '#111';
  F('700', 10.5);
  x.fillText(swTrunc(x, info.title, M(t1 - t0)), M(t0), M(g.m + g.R - 0.3));
  x.fillStyle = '#555';
  F('500', 7);
  x.fillText(
    swTrunc(
      x,
      'Colour each box with its marker. Beside it is the colour on screen, only an approximation.',
      M(g.pw - 2 * g.m),
    ),
    M(g.m),
    M(g.m + g.R + 3.6),
  );
  x.fillStyle = '#888';
  F('500', 7);
  const fy = M(g.ph - g.m - 0.5);
  x.fillText('Made with Marker Studio', M(t0), fy);
  x.textAlign = 'center';
  if (first) x.fillText('Boxes ' + first.no + (last.no !== first.no ? '–' + last.no : ''), M(g.pw / 2), fy);
  x.textAlign = 'right';
  x.fillText('Page ' + (pi + 1) + ' of ' + np, M(t1), fy);
  x.textAlign = 'left';
  pg.items.forEach(function (it) {
    if (it.h) {
      const t = it.h + (it.cont ? ' (continued)' : '');
      x.fillStyle = '#111';
      F('700', 9);
      x.fillText(t, M(g.m), M(it.y + 4.2));
      const w = x.measureText(t).width;
      x.fillStyle = '#777';
      F('500', 7.5);
      x.fillText('  ·  ' + it.n + ' marker' + (it.n === 1 ? '' : 's'), M(g.m) + w, M(it.y + 4.2));
      x.strokeStyle = '#c8c8c8';
      x.lineWidth = M(0.2);
      x.beginPath();
      x.moveTo(M(g.m), M(it.y + 5.6));
      x.lineTo(M(g.pw - g.m), M(it.y + 5.6));
      x.stroke();
      return;
    }
    const cc = COLORS[it.i],
      bx = it.x,
      by = it.y,
      sx = bx + g.box + 0.8;
    x.strokeStyle = '#4a4a4a';
    x.lineWidth = M(0.25);
    x.strokeRect(M(bx), M(by), M(g.box), M(g.box));
    x.fillStyle = cc.hex;
    x.fillRect(M(sx), M(by), M(g.sw), M(g.box));
    x.strokeStyle = 'rgba(0,0,0,.3)';
    x.lineWidth = M(0.15);
    x.strokeRect(M(sx), M(by), M(g.sw), M(g.box));
    x.fillStyle = '#8a8a8a';
    F('600', 6.5);
    x.textAlign = 'right';
    x.fillText(String(it.no), M(sx + g.sw), M(by + g.box + 3.5));
    const nw = x.measureText(String(it.no)).width;
    x.textAlign = 'left';
    x.fillStyle = '#111';
    F('700', 8.5);
    x.fillText(swTrunc(x, cc.code, M(g.box + 0.8 + g.sw - 1.5) - nw), M(bx), M(by + g.box + 3.5));
    if (g.labels !== 'code') {
      x.fillStyle = '#444';
      F('400', 6.5);
      x.fillText(swTrunc(x, cc.name || '', M(g.cw)), M(bx), M(by + g.box + 6.5));
    }
  });
  return c;
}
function swTitle(what) {
  return what === 'owned' ? 'My markers' : what === 'wish' ? 'To buy' : 'All ' + what + ' markers';
}
// build the PDF a page at a time and hand it to the share sheet, or download it
async function swDownload() {
  const go = $('swGo'),
    idxs = swList(swOpt.what);
  if (swBusy || !go || !idxs.length || !window.SF || !SF.pdfKit) return;
  swBusy = true;
  const pk = SF.pdfKit,
    pap = pk.paper(),
    P = pk.PAPERS[pap] || pk.PAPERS.letter,
    g = swGeom(pap, swOpt.labels),
    pages = swLayout(swGroups(idxs, swOpt.order), g),
    d = new Date(),
    day =
      d.getFullYear() +
      '-' +
      String(d.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(d.getDate()).padStart(2, '0'),
    nm = swTitle(swOpt.what);
  const info = {
      paper: pap,
      title:
        'Swatch chart · ' +
        nm +
        ' · ' +
        (d.getDate() +
          ' ' +
          ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()] +
          ' ' +
          d.getFullYear()),
    },
    fname = 'swatch-chart-' + nm.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + day + '.pdf',
    lbl = go.textContent;
  go.textContent = 'Preparing…';
  go.disabled = true;
  try {
    try {
      if (document.fonts && document.fonts.load)
        await Promise.race([
          document.fonts.load('700 12px "Hanken Grotesk"'),
          new Promise(function (r) {
            setTimeout(r, 1500);
          }),
        ]);
    } catch (_) {}
    const bytes = await pk.toPDF(
      pages.map(function (pg, pi) {
        return function () {
          return swDraw(pg, pi, pages.length, g, info);
        };
      }),
      P[0],
      P[1],
    );
    pk.share(
      new Blob([bytes], { type: 'application/pdf' }),
      fname,
      'Swatch chart',
      'swatch chart',
      'Swatch chart downloaded.',
      function (m) {
        if (m) toast(m);
      },
    );
  } catch (e) {
    toast('Could not make the swatch chart. Try again, or choose fewer markers.', 6000);
  }
  swBusy = false;
  go.textContent = lbl;
  swSync();
}
// the sheet: which markers, order, labels and paper, with the number of pages it comes to
function swRender() {
  const el = $('swOpts');
  if (!el) return;
  const row = function (k, lbl, opts) {
    return (
      '<div class="swrow"><span class="swlbl" id="swL_' +
      k +
      '">' +
      lbl +
      '</span><div class="segs wide" role="group" aria-labelledby="swL_' +
      k +
      '" style="grid-template-columns:repeat(' +
      (k === 'what' ? 2 : opts.length) +
      ',auto)">' +
      opts
        .map(function (o) {
          return (
            '<button type="button" data-k="' + k + '" data-v="' + esc(o[0]) + '">' + esc(o[1]) + '</button>'
          );
        })
        .join('') +
      '</div></div>'
    );
  };
  el.innerHTML =
    row('what', 'Markers', swWhatOpts()) +
    row('order', 'Order', [
      ['fam', 'Colour family'],
      ['code', 'Code'],
    ]) +
    row('labels', 'Labels', [
      ['name', 'Code + name'],
      ['code', 'Code only'],
    ]) +
    row('paper', 'Paper', SF.pdfKit.PAPER_OPTS);
  swSync();
}
function swSync() {
  const el = $('swOpts'),
    sum = $('swSum'),
    go = $('swGo');
  if (!el || !sum || !window.SF || !SF.pdfKit) return;
  const pap = SF.pdfKit.paper();
  el.querySelectorAll('button[data-k]').forEach(function (b) {
    const on = b.dataset.v === (b.dataset.k === 'paper' ? pap : swOpt[b.dataset.k]);
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  const idxs = swList(swOpt.what),
    n = idxs.length,
    np = n ? swLayout(swGroups(idxs, swOpt.order), swGeom(pap, swOpt.labels)).length : 0;
  sum.classList.toggle('empty', !n);
  sum.innerHTML = n
    ? '<b>' + np + ' page' + (np === 1 ? '' : 's') + '</b> · ' + n + ' marker' + (n === 1 ? '' : 's')
    : swOpt.what === 'owned'
      ? 'Your collection is empty. Add the markers you own first, or choose a brand to print all of its markers.'
      : swOpt.what === 'wish'
        ? 'Your To buy list is empty. Add markers to it, or print your collection.'
        : 'No markers to print.';
  if (go) {
    go.disabled = !n || swBusy;
    if (n) go.removeAttribute('aria-describedby');
    else go.setAttribute('aria-describedby', 'swSum');
  }
}
// the button says what it will do: on a phone or tablet that can share files the PDF goes to the share sheet, which
// saves it (handOver in core.js); on a computer it downloads
function swGoLabel() {
  try {
    return shareFirst() && canShareFile(new File([''], 'a.pdf', { type: 'application/pdf' }))
      ? 'Save PDF'
      : 'Download PDF';
  } catch (e) {
    return 'Download PDF';
  }
}
function openSwatch() {
  const ov = $('swOverlay');
  if (!ov || !window.SF || !SF.pdfKit) return;
  swOpt.what = 'owned';
  swOpener = document.activeElement;
  const g = $('swGo');
  if (g && !swBusy) g.textContent = swGoLabel();
  swRender();
  openDialog(ov);
  const c = $('swClose');
  if (c) c.focus({ preventScroll: true });
}
function closeSwatch() {
  const ov = $('swOverlay');
  if (!ov || !ov.classList.contains('on')) return;
  closeDialog(ov);
  if (swOpener && swOpener.isConnected) swOpener.focus({ preventScroll: true });
  swOpener = null;
}
(function () {
  const b = $('swatchBtn'),
    ov = $('swOverlay');
  if (!b || !ov) return;
  b.addEventListener('click', openSwatch);
  $('swClose').addEventListener('click', closeSwatch);
  $('swGo').addEventListener('click', swDownload);
  ov.addEventListener('click', function (e) {
    if (e.target === ov) {
      closeSwatch();
      return;
    }
    const t = e.target.closest && e.target.closest('button[data-k]');
    if (!t) return;
    const k = t.dataset.k,
      v = t.dataset.v;
    if (k === 'paper') SF.pdfKit.setPaper(v);
    else {
      swOpt[k] = v;
      if (k !== 'what')
        try {
          localStorage.setItem(SW_KEY, JSON.stringify({ order: swOpt.order, labels: swOpt.labels }));
        } catch (_) {}
    }
    swSync();
  });
})();
