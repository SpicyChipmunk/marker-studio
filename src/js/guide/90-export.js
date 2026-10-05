// (noCodes: the picture as it is, for Save image with Codes on the saved image unticked)
function buildExportCanvas(outline, noCodes) {
  const assign = assignData.assign,
    map = {};
  assignData.order.forEach(function (l) {
    const m = assign[l],
      k = m.mkey;
    if (!map[k]) map[k] = { m: m, n: 0 };
    map[k].n++;
  });
  const uniq = Object.keys(map)
      .map(function (k) {
        return map[k];
      })
      // (v305: in colour-family order, lightest first in each family, as the PDF's key: it was by how many sections)
      .sort(function (a, b) {
        return famCmp(a.m, b.m);
      }),
    one = brandLine(
      uniq.map(function (u) {
        return u.m.brand;
      }),
    );
  const K = exportKeyLayout(uniq.length),
    // (one more line under the brand when some sections are too small for their code, v304)
    noteH = Math.max(18, W / 46),
    sizeOf = function (note) {
      const legH = K.per * K.rh + K.legTop + (note ? noteH : 0) + 16;
      // (no bigger than iPad Safari's canvas allows, 16.7 million pixels: a guide with hundreds of markers has a
      // legend taller than its picture; past that the whole image is drawn smaller, xs, v304)
      return { legH: legH, xs: Math.min(1, Math.sqrt(EXPORT_MAXPX / (W * (H + legH)))) };
    };
  // the codes placed first, as on the PDF's colouring page: none over another, each as big as its section allows or
  // smaller down to the least size, else left off; the least size kept on the image as saved, after any shrinking
  // (from the smaller size, the one with the extra line: without it the image is no smaller, v304)
  const pl = noCodes ? null : exportPlace(sizeOf(true).xs),
    note = !!(pl && pl.dropped.length),
    S = sizeOf(note),
    legH = S.legH,
    xs = S.xs;
  const ex = document.createElement('canvas');
  ex.width = Math.max(1, Math.round(W * xs));
  ex.height = Math.max(1, Math.round((H + legH) * xs));
  const g0 = ex.getContext('2d');
  g0.fillStyle = '#fff';
  g0.fillRect(0, 0, ex.width, ex.height);
  // (made smaller: the picture is drawn full size on a canvas of its own first, then shrunk onto the image)
  const pic = xs < 1 ? document.createElement('canvas') : null;
  if (pic) {
    pic.width = W;
    pic.height = H;
  }
  const g = pic ? pic.getContext('2d') : g0;
  const im = g.createImageData(W, H),
    d = im.data,
    n = W * H,
    tx = texAmt > 0,
    sh = outline ? null : shadePrep(false),
    sc = [0, 0, 0],
    bc = {};
  if (tx && !edgeDist) buildTexFields();
  for (let p = 0, j = 0; p < n; p++, j += 4) {
    const l = labels[p];
    if (l === -1) {
      d[j] = LINE[0];
      d[j + 1] = LINE[1];
      d[j + 2] = LINE[2];
    } else if (assign[l] && !outline) {
      const c = shadeRGB(sh, p, l, bc[l] || (bc[l] = hexRgb(assign[l].hex)), sc);
      if (tx) {
        const e = edgeDist[p],
          ef = e >= 9 * srcK ? 1 : e / (9 * srcK),
          mul = (1 - texAmt * 0.3 * (1 - ef)) * (1 + texAmt * 0.1 * ((texField[p] - 128) * 0.0078125));
        d[j] = c[0] * mul;
        d[j + 1] = c[1] * mul;
        d[j + 2] = c[2] * mul;
      } else {
        d[j] = c[0];
        d[j + 1] = c[1];
        d[j + 2] = c[2];
      }
    } else {
      d[j] = PAPER[0];
      d[j + 1] = PAPER[1];
      d[j + 2] = PAPER[2];
    }
    d[j + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  if (pl) exportPlaceDraw(g, pl, outline);
  return exportLegend(pic ? exportShrink(g0, pic, xs) : g, ex, uniq, one, K, note);
}
const EXPORT_MAXPX = 15e6;
// The saved image's key (v304): 3 columns (2 on a picture under 700 px wide, where the key's letters stop getting
// smaller and 3 would cut most names short), 4 when 3 would make the key taller than 60% of the picture (names still
// fit 4 across from 812 px), and past 150 markers 6 of just the brand letter and code (5 or 6 across cut most names)
function exportKeyLayout(nU) {
  const rh = Math.max(28, W / 40),
    legTop = Math.max(74, W / 14),
    fs = Math.max(14, W / 58),
    sw = Math.max(16, W / 50),
    codes = nU > 150;
  let cols = W < 700 ? 2 : 3;
  if (codes)
    // (as many as the codes fit, on a narrow picture: about 5.2 letter widths each)
    cols = Math.max(2, Math.min(6, Math.floor((W - 40) / (5.2 * fs + sw + 16))));
  else if (W >= 812 && Math.ceil(nU / cols) * rh > H * 0.6) cols = 4;
  return {
    cols: cols,
    per: Math.ceil(nU / cols),
    rh: rh,
    legTop: legTop,
    colw: (W - 40) / cols,
    codes: codes,
  };
}
// where each code goes on the saved image (pdfPlace): codes only, no numbers or dots; at least 6 picture px (more on a
// picture enlarged before its sections were found) and 6 px on the image as saved (xs: how much it is shrunk)
let _exPlaced = null;
function exportPlace(xs) {
  const mn = Math.max(6 * srcK, 6 / xs),
    o = {
      bt: guideMixed(),
      base: Math.max(mn, 10 * srcK),
      min: mn,
      max: Math.max(mn, 30 * srcK),
      w: 700,
      swk: 0.3,
    },
    g = document.createElement('canvas').getContext('2d'),
    pl = pdfPlace(g, Object.keys(assignData.assign).map(Number), o, 'codes', null, { noNum: true });
  _exPlaced = {
    boxes: pl.boxes.slice(0, pl.boxes.length - pl.dropped.length),
    dropped: pl.dropped.slice(),
    min: mn,
  };
  return pl;
}
function exportPlaceDraw(g, pl, outline) {
  const asg = assignData.assign;
  for (const l in pl.lays) {
    const m = asg[l],
      dark = darkText(m.hex);
    drawCode(
      g,
      +l,
      m,
      Object.assign({}, pl.lays[l].o, {
        stroke: outline || dark ? '#fff' : '#000',
        fill: outline || dark ? '#111' : '#fff',
      }),
    );
  }
}
function exportShrink(g0, pic, xs) {
  g0.imageSmoothingEnabled = true;
  g0.imageSmoothingQuality = 'high';
  g0.drawImage(pic, 0, 0, Math.round(W * xs), Math.round(H * xs));
  freeCanvas(pic);
  g0.setTransform(xs, 0, 0, xs, 0, 0);
  return g0;
}
function exportLegend(g, ex, uniq, one, K, note) {
  const cols = K.cols,
    rh = K.rh,
    colw = K.colw,
    legTop = K.legTop + (note ? Math.max(18, W / 46) : 0);
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  g.fillStyle = '#111';
  g.font = '700 ' + Math.max(20, W / 40) + 'px sans-serif';
  {
    const suf = ' · ' + nWord(uniq.length, 'marker');
    g.fillText(
      pdfTrunc(g, curName || 'Colouring guide', Math.max(40, W - 40 - g.measureText(suf).width)) + suf,
      20,
      H + Math.max(28, W / 34),
    );
  }
  g.font = '600 ' + Math.max(13, W / 70) + 'px sans-serif';
  g.fillStyle = '#777';
  g.fillText(one || brandKey(), 20, H + Math.max(28, W / 34) + Math.max(18, W / 46));
  if (note)
    g.fillText(
      pdfTrunc(g, 'Small sections unlabelled: see the guide or the PDF’s close-ups.', W - 40),
      20,
      H + Math.max(28, W / 34) + 2 * Math.max(18, W / 46),
    );
  g.fillStyle = '#111';
  const fs2 = Math.max(14, W / 58),
    sw = Math.max(16, W / 50);
  g.font = '500 ' + fs2 + 'px sans-serif';
  for (let k = 0; k < uniq.length; k++) {
    const mk = uniq[k].m,
      cc = k % cols,
      rr = (k / cols) | 0,
      x = 20 + cc * colw,
      y = H + legTop + rr * rh + rh / 2,
      rgb = hexRgb(mk.hex);
    g.fillStyle = 'rgb(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ')';
    g.fillRect(x, y - sw / 2, sw, sw);
    g.strokeStyle = '#bbb';
    g.strokeRect(x, y - sw / 2, sw, sw);
    g.fillStyle = '#111';
    g.fillText(
      trunc(
        g,
        (one ? '' : bTag(mk.brand) + '  ') + mk.code + (mk.name && !K.codes ? '   ' + mk.name : ''),
        colw - sw - 16,
      ),
      x + sw + 8,
      y,
    );
  }
  return ex;
}
// (null where the browser can't compress, before Safari 16.4: the page is then stored as it is, which a PDF allows,
// v304)
async function _flate(u8) {
  if (typeof CompressionStream === 'undefined') return null;
  const cs = new CompressionStream('deflate');
  const w = cs.writable.getWriter();
  w.write(u8);
  w.close();
  const ab = await new Response(cs.readable).arrayBuffer();
  return new Uint8Array(ab);
}
// a page's pixels as RGB, packed and compressed: in the worker (03-jobs), while the page draws the next one, or here
// where there is none (or it fails). Resolves to { w, h, b: the bytes, zc: compressed }. The same bytes either way
// (v307)
function pdfPagePack(cv) {
  const w = cv.width,
    h = cv.height,
    read = function () {
      return cv.getContext('2d').getImageData(0, 0, w, h).data;
    },
    here = function () {
      const raw = rgbPack(read(), w * h);
      // (the page's canvas handed back as soon as its pixels are out, v296)
      freeCanvas(cv);
      return _flate(raw).then(function (zc) {
        return { w: w, h: h, b: zc || raw, zc: !!zc };
      });
    };
  if (!JOBS.on) return here();
  // (the pixels handed to the worker; the canvas kept until it's done, in case it fails)
  const px = read();
  return JOBS.run('pdf', { buf: px.buffer, n: w * h, z: typeof CompressionStream !== 'undefined' }, [
    px.buffer,
  ]).then(function (r) {
    freeCanvas(cv);
    // (a worker without compression where the page has it: compressed here, as the page would have)
    if (r.zc || !r.b.length) return { w: w, h: h, b: r.b, zc: r.zc };
    return _flate(r.b).then(function (zc) {
      return { w: w, h: h, b: zc || r.b, zc: !!zc };
    });
  }, here);
}
// a moment for the screen between pages: the next frame (or a tenth of a second, where frames don't come)
function pdfBreath() {
  return new Promise(function (res) {
    let done = false;
    const go = function () {
      if (!done) {
        done = true;
        res();
      }
    };
    requestAnimationFrame(function () {
      setTimeout(go, 0);
    });
    setTimeout(go, 100);
  });
}
// one page per canvas; a page may also be a function that draws its canvas when its turn comes (so a long PDF
// holds one page in memory at a time). blob: the file as a Blob made from its parts, without first copying them into
// one array (pages stored uncompressed are about 11 MB each, v304). prog(i, n): called as page i (from 1) of n is
// drawn. (v307: one page at a time, the screen updated in between; each page packed and compressed in the worker
// while the next is drawn)
async function canvasesToPDF(cvs, PW, PH, blob, prog) {
  PW = PW || 612;
  PH = PH || 792;
  const M = 0,
    enc = new TextEncoder(),
    chunks = [];
  let len = 0;
  const push = (b) => {
    const u = typeof b === 'string' ? enc.encode(b) : b;
    chunks.push(u);
    len += u.length;
  };
  const off = [],
    so = () => off.push(len);
  push('%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n');
  const nP = cvs.length,
    imgNo = (i) => 3 + i * 3,
    cNo = (i) => 4 + i * 3,
    pNo = (i) => 5 + i * 3;
  so();
  push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  const kids = cvs.map((_, i) => pNo(i) + ' 0 R').join(' ');
  so();
  push('2 0 obj\n<< /Type /Pages /Kids [' + kids + '] /Count ' + nP + ' >>\nendobj\n');
  // (each page's packing started as soon as it's drawn; written in order, one behind)
  let pend = null;
  for (let i = 0; i <= nP; i++) {
    let job = null;
    if (i < nP) {
      if (prog) prog(i + 1, nP);
      if (prog || i) await pdfBreath();
      job = pdfPagePack(typeof cvs[i] === 'function' ? cvs[i]() : cvs[i]);
    }
    if (pend) put(i - 1, await pend);
    pend = job;
  }
  function put(i, pk) {
    const w = pk.w,
      h = pk.h,
      zc = pk.zc,
      comp = pk.b;
    so();
    push(
      imgNo(i) +
        ' 0 obj\n<< /Type /XObject /Subtype /Image /Width ' +
        w +
        ' /Height ' +
        h +
        ' /ColorSpace /DeviceRGB /BitsPerComponent 8' +
        (zc ? ' /Filter /FlateDecode' : '') +
        ' /Length ' +
        comp.length +
        ' >>\nstream\n',
    );
    push(comp);
    push('\nendstream\nendobj\n');
    const aw = PW - 2 * M,
      ah = PH - 2 * M,
      a = w / h;
    let dw = aw,
      dh = dw / a;
    if (dh > ah) {
      dh = ah;
      dw = dh * a;
    }
    const tx = (PW - dw) / 2,
      ty = (PH - dh) / 2,
      cs2 =
        'q ' +
        dw.toFixed(2) +
        ' 0 0 ' +
        dh.toFixed(2) +
        ' ' +
        tx.toFixed(2) +
        ' ' +
        ty.toFixed(2) +
        ' cm /Im' +
        i +
        ' Do Q\n',
      csb = enc.encode(cs2);
    so();
    push(cNo(i) + ' 0 obj\n<< /Length ' + csb.length + ' >>\nstream\n');
    push(csb);
    push('endstream\nendobj\n');
    so();
    push(
      pNo(i) +
        ' 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' +
        PW +
        ' ' +
        PH +
        '] /Resources << /XObject << /Im' +
        i +
        ' ' +
        imgNo(i) +
        ' 0 R >> >> /Contents ' +
        cNo(i) +
        ' 0 R >>\nendobj\n',
    );
  }
  const xo = len,
    nObj = off.length + 1;
  push('xref\n0 ' + nObj + '\n0000000000 65535 f \n');
  for (const o of off) push(String(o).padStart(10, '0') + ' 00000 n \n');
  push('trailer\n<< /Size ' + nObj + ' /Root 1 0 R >>\nstartxref\n' + xo + '\n%%EOF');
  if (blob) return new Blob(chunks, { type: 'application/pdf' });
  const out = new Uint8Array(len);
  let p = 0;
  for (const c of chunks) {
    out.set(c, p);
    p += c.length;
  }
  return out;
}
const PAPERS = { letter: [612, 792], a4: [595.28, 841.89], a5: [419.53, 595.28], half: [396, 612] },
  PDPI = 200;
// Print options (Share › Print…), remembered on this phone. Alcohol markers are see-through, so bold black codes show
// under pale colours: the colouring page gets small light-grey labels unless "Darker labels" is ticked, or numbers
// (one per marker, listed in the key), or none at all. "Key + reference" leaves out the colouring page for people
// colouring their original book page. The paper defaults to Letter where Letter is the everyday size, else A4.
let pdfLabels = 'codes',
  pdfDark = false,
  // (Tone lines: the dashed lines where one tone hands over to the next, on the colouring page with shading. Its own
  // choice here, not the screen's Show tone lines: on paper they're most sections' only mark, v304)
  pdfToneLines = true,
  pdfWhat = 'page',
  pdfS = 1;
const LETTER_LANDS = ['US', 'CA', 'MX', 'PH', 'CL', 'CO', 'VE', 'PR'];
function paperDefault() {
  let ls = [];
  try {
    ls = [].concat(navigator.languages || [], navigator.language || []);
  } catch (_) {}
  try {
    ls.push(Intl.DateTimeFormat().resolvedOptions().locale);
  } catch (_) {}
  for (let i = 0; i < ls.length; i++) {
    const r = /^[a-z]{2,3}(?:-[a-z]{4})?-([a-z]{2})(?:-|$)/i.exec(String(ls[i] || ''));
    if (r) return LETTER_LANDS.indexOf(r[1].toUpperCase()) >= 0 ? 'letter' : 'a4';
  }
  return 'a4';
}
try {
  const p = localStorage.getItem('ms-paper'),
    l = localStorage.getItem('ms-pdf-labels');
  paper = Object.prototype.hasOwnProperty.call(PAPERS, p) ? p : paperDefault();
  if (l === 'numbers' || l === 'none') pdfLabels = l;
  pdfDark = localStorage.getItem('ms-pdf-dark') === '1';
  pdfToneLines = localStorage.getItem('ms-pdf-lines') !== '0';
  pdfWhat = localStorage.getItem('ms-pdf-what') === 'ref' ? 'ref' : 'page';
} catch (_) {
  paper = paperDefault();
}
const PRINT_OPTS = [
  [
    'pwhat',
    'Pages',
    'What to print',
    [
      ['page', 'Page + key'],
      ['ref', 'Key + reference'],
      ['strip', 'Test strip'],
    ],
  ],
  [
    'plabels',
    'Labels',
    'Labels on the colouring page',
    [
      ['codes', 'Codes'],
      ['numbers', 'Numbers'],
      ['none', 'None'],
    ],
  ],
  [
    'paper',
    'Paper',
    'Paper size',
    [
      ['letter', 'Letter'],
      ['a4', 'A4'],
      ['a5', 'A5'],
      ['half', 'Half Letter'],
    ],
  ],
];
// (v288) a small drawing of each Pages and Labels choice: what the printed sheet looks like
const PRINT_PV = (function () {
  const pg = function (inner) {
      return (
        '<svg viewBox="0 0 30 38" width="30" height="38" aria-hidden="true" focusable="false"><rect x="1" y="1" width="28" height="36" rx="2" fill="none" stroke="currentColor" stroke-width="1.4" opacity=".7"/>' +
        inner +
        '</svg>'
      );
    },
    key = function (y, n) {
      let r = '';
      for (let i = 0; i < n; i++)
        r +=
          '<rect x="5" y="' +
          (y + i * 4) +
          '" width="3" height="2.4" fill="currentColor"/><rect x="10" y="' +
          (y + i * 4 + 0.6) +
          '" width="' +
          (12 - (i % 2) * 4) +
          '" height="1.2" fill="currentColor" opacity=".55"/>';
      return r;
    },
    shape =
      '<path d="M6 19 C5 11 11 6 16 7 C23 8 25 14 23 19 C21 24 9 25 6 19Z" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M15 7.2 C13 12 14 18 17 23.6" fill="none" stroke="currentColor" stroke-width="1.1"/>',
    lab = function (t) {
      return (
        '<svg viewBox="0 0 30 26" width="34" height="29" aria-hidden="true" focusable="false"><path d="M3 14 C2 5 10 1 16 2 C25 3 28 10 26 16 C24 23 7 25 3 14Z" fill="none" stroke="currentColor" stroke-width="1.4"/>' +
        (t
          ? '<text x="15" y="16.5" text-anchor="middle" font-size="' +
            (t.length > 1 ? 8 : 9.5) +
            '" font-family="system-ui,sans-serif" font-weight="700" fill="currentColor">' +
            t +
            '</text>'
          : '') +
        '</svg>'
      );
    };
  return {
    page: pg(shape + key(27, 2)),
    ref: pg(
      key(5, 4) + '<rect x="6" y="23" width="18" height="10" rx="1" fill="currentColor" opacity=".35"/>',
    ),
    strip: pg(
      [6, 13, 20, 27]
        .map(function (y) {
          return (
            '<rect x="5" y="' +
            y +
            '" width="20" height="4" rx="1" fill="none" stroke="currentColor" stroke-width="1"/><rect x="5" y="' +
            y +
            '" width="7" height="4" rx="1" fill="currentColor" opacity=".5"/>'
          );
        })
        .join(''),
    ),
    codes: lab('Y11'),
    numbers: lab('3'),
    none: lab(''),
  };
})();
function printOptVal(k) {
  return k === 'pwhat' ? pdfWhat : k === 'plabels' ? pdfLabels : paper;
}
// The Print sheet (Share › Print…), laid out like the swatch chart's: each option over its row of choices and the
// checkboxes, then a one-line summary that follows the choices over Cancel / Download PDF ("Save PDF" where the
// browser can share files, as on the swatch chart: swGoLabel() in swatch.js)
function openPrint() {
  if (!assignData) return;
  // (v307) the worker started, and its packing warmed up on a small page, while the options are looked at: the first
  // page of the PDF isn't kept waiting for it
  if (JOBS.on) {
    const px = new Uint8Array(256 * 256 * 4);
    JOBS.run('pdf', { buf: px.buffer, n: 256 * 256, z: false }, [px.buffer]).catch(function () {});
  }
  let b = '<div class="swopts">';
  PRINT_OPTS.forEach(function (o) {
    b +=
      '<div class="swrow"><span class="swlbl" aria-hidden="true">' +
      o[1] +
      '</span><div class="segs wide' +
      (o[0] === 'paper' ? ' sfpaper' : '') +
      '" role="group" aria-label="' +
      o[2] +
      '" style="grid-template-columns:repeat(' +
      o[3].length +
      (o[0] === 'paper' ? ',auto)">' : ',minmax(0,1fr))">');
    o[3].forEach(function (v) {
      const on = printOptVal(o[0]) === v[0];
      b +=
        '<button type="button" class="' +
        (on ? 'on' : '') +
        '" data-' +
        o[0] +
        '="' +
        v[0] +
        '" aria-pressed="' +
        on +
        '">' +
        (PRINT_PV[v[0]] && o[0] !== 'paper' ? '<span class="sfprpv">' + PRINT_PV[v[0]] + '</span>' : '') +
        v[1] +
        '</button>';
    });
    b += '</div></div>';
  });
  b +=
    '</div><div class="sfprchk"><label class="sfchk"><input type="checkbox" id="sfPdfDark"' +
    (pdfDark ? ' checked' : '') +
    '> Darker labels</label>' +
    (shadeUse().on
      ? '<label class="sfchk"><input type="checkbox" id="sfPdfLines"' +
        (pdfToneLines ? ' checked' : '') +
        '> Tone lines</label><div class="sfshhint" id="sfPrShNote">' +
        printShNote() +
        '</div>'
      : '<label class="sfchk"><input type="checkbox" id="sfPdfBlend"' +
        (pdfBlend ? ' checked' : '') +
        '> Include blend companions (a lighter and darker shade for each colour)</label>') +
    '</div>';
  const el = openSheet({
    title: 'Print',
    body: b,
    foot:
      '<div id="sfPrSum" class="swsum" role="status" aria-live="polite"></div><button type="button" class="sfghost" data-pr="cancel">Cancel</button><button type="button" id="sfPDF" class="sfprimary">' +
      swGoLabel() +
      '</button>',
  });
  el.classList.add('sfprsh');
  printWait();
  el.addEventListener('click', function (e) {
    const x = e.target.closest('[data-pwhat],[data-plabels],[data-paper]');
    if (x) {
      const k = x.dataset.pwhat ? 'pwhat' : x.dataset.plabels ? 'plabels' : 'paper';
      printOptSet(k, x.dataset[k]);
      return;
    }
    if (e.target.closest('[data-pr="cancel"]')) closeSheet();
    else if (e.target.closest('#sfPDF')) exportPDF();
  });
  el.addEventListener('change', function (e) {
    if (e.target.id === 'sfPdfDark') printOptSet('dark', e.target.checked);
    else if (e.target.id === 'sfPdfLines') printOptSet('lines', e.target.checked);
    else if (e.target.id === 'sfPdfBlend') {
      pdfBlend = e.target.checked;
      try {
        localStorage.setItem('ms-pdf-blend', pdfBlend ? '1' : '0');
      } catch (_) {}
      printOptsSync();
    }
  });
  printOptsSync();
}
// "2 pages · Letter · Numbers"
function printSummary() {
  const n = assignData ? buildPDFPages(true) : 0,
    pp = PRINT_OPTS[2][3].filter(function (o) {
      return o[0] === paper;
    })[0];
  return (
    '<b>' +
    n +
    ' page' +
    (n === 1 ? '' : 's') +
    '</b> · ' +
    (pp ? pp[1] : paper) +
    ' · ' +
    (pdfWhat === 'ref'
      ? 'Key + reference'
      : pdfWhat === 'strip'
        ? 'Test strip'
        : { codes: 'Codes', numbers: 'Numbers', none: 'No labels' }[pdfLabels]) +
    // (sections too small to label, in close-ups: with Codes, Numbers would fit more on the page itself)
    // (v289: the short form on a small phone, so the Paper choices start on the sheet's first screen)
    (pdfWhat === 'page' && (_pdfCloseN || _pdfLeft)
      ? '<br>' + printCloseNote((window.innerHeight || 0) < 700)
      : '')
  );
}
// what the close-ups hold, for the Print sheet: how many small sections on how many pages, and any too small even there
// (short: the counts only — "19 small sections on 2 close-up pages; 3 only as a dot")
function printCloseNote(short) {
  const pl = function (n, one, more) {
    return n + ' ' + (n === 1 ? one : more);
  };
  if (short)
    return (
      (_pdfCloseN
        ? pl(_pdfCloseN, 'small section', 'small sections') +
          ' on ' +
          pl(_pdfCloseP, 'close-up page', 'close-up pages')
        : '') +
      (_pdfLeft
        ? (_pdfCloseN ? '; ' + _pdfLeft : pl(_pdfLeft, 'small section', 'small sections')) + ' only as a dot'
        : '') +
      '.'
    );
  let t = _pdfCloseN
    ? pl(_pdfCloseN, 'small section is', 'small sections are') +
      ' on ' +
      pl(_pdfCloseP, 'close-up page.', 'close-up pages.') +
      (pdfLabels === 'codes'
        ? _pdfCloseN === 1
          ? ' Numbers might fit it on the colouring page.'
          : ' Numbers would fit more of them on the colouring page.'
        : '')
    : '';
  if (_pdfLeft)
    t +=
      (t ? ' ' : '') +
      (t ? pl(_pdfLeft, 'more has', 'more have') : pl(_pdfLeft, 'small section has', 'small sections have')) +
      ' only a dot on the colouring page: see ' +
      (_pdfLeft === 1 ? 'it' : 'them') +
      ' in the app' +
      (pdfLabels === 'codes' ? ', or print with Numbers.' : '.');
  return t;
}
// (the test strip has no picture: its rows are the tones to try)
function printShNote() {
  return pdfWhat === 'strip'
    ? 'Shading is on, so each colour’s row has a box for its tones, as the guide lays them.'
    : 'Shading is on, so the PDF shows where each tone goes and the key lists each colour’s tones.';
}
function printOptsSync() {
  const sc = document.getElementById('sfSheet');
  if (!sc || !sc.classList.contains('sfprsh')) return;
  sc.querySelectorAll('[data-pwhat],[data-plabels],[data-paper]').forEach(function (x) {
    const k = x.dataset.pwhat ? 'pwhat' : x.dataset.plabels ? 'plabels' : 'paper',
      on = printOptVal(k) === x.dataset[k];
    x.classList.toggle('on', on);
    x.setAttribute('aria-pressed', on ? 'true' : 'false');
    if (k === 'plabels') x.disabled = pdfWhat !== 'page';
  });
  const dk = document.getElementById('sfPdfDark');
  if (dk) {
    dk.disabled = pdfWhat !== 'page' || pdfLabels === 'none';
    dk.parentNode.classList.toggle('off', dk.disabled);
  }
  // (only the colouring page has tone lines)
  const tl = document.getElementById('sfPdfLines');
  if (tl) {
    tl.disabled = pdfWhat !== 'page';
    tl.parentNode.classList.toggle('off', tl.disabled);
  }
  const shn = document.getElementById('sfPrShNote');
  if (shn) shn.textContent = printShNote();
  const sm = document.getElementById('sfPrSum');
  if (sm) {
    sm.classList.remove('empty');
    sm.innerHTML = printSummary();
  }
}
function printOptSet(k, v) {
  let key, val;
  if (k === 'pwhat') {
    // (the test strip is printed once in a while, so it isn't stored: the app opens next time on the choice before it)
    pdfWhat = v === 'ref' || v === 'strip' ? v : 'page';
    if (pdfWhat !== 'strip') {
      key = 'ms-pdf-what';
      val = pdfWhat;
    }
  } else if (k === 'plabels') {
    pdfLabels = v === 'numbers' || v === 'none' ? v : 'codes';
    key = 'ms-pdf-labels';
    val = pdfLabels;
  } else if (k === 'dark') {
    pdfDark = !!v;
    key = 'ms-pdf-dark';
    val = pdfDark ? '1' : '0';
  } else if (k === 'lines') {
    pdfToneLines = !!v;
    key = 'ms-pdf-lines';
    val = pdfToneLines ? '1' : '0';
  } else {
    if (Object.prototype.hasOwnProperty.call(PAPERS, v)) paper = v;
    key = 'ms-paper';
    val = paper;
  }
  if (key)
    try {
      localStorage.setItem(key, val);
    } catch (_) {}
  printOptsSync();
}
// PDF layout is measured in points at the size of a Letter or A4 page; on the pocket sizes (A5, Half Letter)
// everything is drawn a little smaller (pdfS) with narrower margins, so the key still fits its columns
function PX(pt) {
  return Math.round(((pt * pdfS) / 72) * PDPI);
}
// (a dry run, which only counts the pages, lays them out on 1×1 canvases)
let _pdfDry = false;
// (v307) The PDF written a page at a time: as it's laid out, what's drawn on each page is noted down on a stand-in
// (a 1×1 canvas, as a dry run uses, which measures text and keeps the drawing state), and the page is drawn for real
// from those notes when the writer comes to it (pdfReplay): the same calls in the same order, so the same pixels, and
// one page's canvas at a time. Pictures drawn onto the pages (pdfFree) are kept until the last page that shows them.
let _pdfRec = null;
// (calls that only read: not noted down)
const PDF_READS = {
  measureText: 1,
  getTransform: 1,
  getLineDash: 1,
  getImageData: 1,
  isPointInPath: 1,
  isPointInStroke: 1,
  getContextAttributes: 1,
};
function pdfRecCtx() {
  const s = document.createElement('canvas');
  s.width = s.height = 1;
  const t = s.getContext('2d'),
    ops = [];
  const g = new Proxy(t, {
    get: function (o, k) {
      const v = o[k];
      if (typeof v !== 'function') return v;
      return function () {
        const a = Array.prototype.slice.call(arguments);
        if (!PDF_READS[k]) ops.push([k, a]);
        // (no pixels to draw on the stand-in)
        if (k === 'drawImage' || k === 'putImageData') return undefined;
        return v.apply(o, a);
      };
    },
    set: function (o, k, v) {
      ops.push([k, v, 1]);
      o[k] = v;
      return true;
    },
  });
  return { g: g, ops: ops };
}
function pdfReplay(ops, w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  for (let i = 0; i < ops.length; i++) {
    const o = ops[i];
    if (o[2]) g[o[0]] = o[1];
    else g[o[0]].apply(g, o[1]);
  }
  return c;
}
// a picture drawn onto pages, done with: handed back now, or (noted down) after the last page that shows it
function pdfFree(c) {
  if (_pdfRec) _pdfRec.keep.push(c);
  else freeCanvas(c);
}
// the pages as functions that each draw theirs (from what pdfPage noted down)
function pdfLazy(pages, keep) {
  const last = new Map();
  pages.forEach(function (P, i) {
    P.c.ops.forEach(function (o) {
      if (!o[2]) for (const a of o[1]) if (keep.indexOf(a) >= 0) last.set(a, i);
    });
  });
  keep.forEach(function (c) {
    if (!last.has(c)) freeCanvas(c);
  });
  return pages.map(function (P, i) {
    return function () {
      const c = pdfReplay(P.c.ops, P.w, P.h);
      P.c.ops = null;
      last.forEach(function (j, a) {
        if (j === i) freeCanvas(a);
      });
      return c;
    };
  });
}
// (pp: the paper the PDF was started on, for pages drawn while it is written: Paper can be changed meanwhile, v304)
function pdfPage(pp) {
  const P = PAPERS[pp || paper] || PAPERS.letter,
    w = Math.round((P[0] / 72) * PDPI),
    h = Math.round((P[1] / 72) * PDPI);
  if (_pdfRec) {
    const r = pdfRecCtx();
    r.g.fillStyle = '#fff';
    r.g.fillRect(0, 0, w, h);
    r.g.textBaseline = 'alphabetic';
    return { c: r, g: r.g, w: w, h: h, m: PX(pdfS < 1 ? 30 : 36) };
  }
  const c = document.createElement('canvas');
  c.width = _pdfDry ? 1 : w;
  c.height = _pdfDry ? 1 : h;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, c.width, c.height);
  g.textBaseline = 'alphabetic';
  return { c: c, g: g, w: w, h: h, m: PX(pdfS < 1 ? 30 : 36) };
}
function pdfArt(coloured, sh, lines) {
  const a = document.createElement('canvas');
  a.width = W;
  a.height = H;
  const g = a.getContext('2d'),
    im = g.createImageData(W, H),
    d = im.data,
    asg = assignData.assign,
    K = comps.length,
    C = new Uint8Array(K * 3).fill(255),
    V = sh ? sh.V : null,
    ti = sh ? sh.ti : null,
    mix = sh ? sh.mix : null;
  if (coloured)
    for (const l in asg) {
      const c = hexRgb(asg[l].hex);
      C[l * 3] = c[0];
      C[l * 3 + 1] = c[1];
      C[l * 3 + 2] = c[2];
    }
  for (let q = 0, j = 0, n = W * H; q < n; q++, j += 4) {
    const l = labels[q];
    if (l === -1) {
      d[j] = LINE[0];
      d[j + 1] = LINE[1];
      d[j + 2] = LINE[2];
    } else if (l < 0) {
      d[j] = d[j + 1] = d[j + 2] = 255;
    } else if (coloured && V && V[q] && ti[l]) {
      const k = ti[l] * 768 + V[q] * 3;
      d[j] = mix[k];
      d[j + 1] = mix[k + 1];
      d[j + 2] = mix[k + 2];
    } else {
      const k = l * 3;
      d[j] = C[k];
      d[j + 1] = C[k + 1];
      d[j + 2] = C[k + 2];
    }
    d[j + 3] = 255;
  }
  if (!coloured && sh && lines)
    shadeLinesDraw(sh, null, { buf: d, t: lines.t, dash: lines.dash, ink: [150, 150, 150] });
  g.putImageData(im, 0, 0);
  return a;
}
// ---- zones on the key's picture, when colours' tones differ by zone (the key's "in Bell" lines): each zone that has
// such a line outlined in its own colour, with its name, so the lines can be followed on paper (Main is the rest)
const PDF_ZCOL = ['#d4145a', '#1f6fd1', '#128a43', '#b86b00', '#7b3fc4', '#0f8a8a', '#c2410c', '#4b5563'];
function pdfZoneCol(id) {
  const i = zoneIds().indexOf(id);
  return i > 0 ? PDF_ZCOL[(i - 1) % PDF_ZCOL.length] : '#666';
}
// a square max filter of radius r over a W x H mask (two running passes)
function pdfDilate(M, r) {
  const T = new Uint8Array(W * H),
    O = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    const ro = y * W;
    let c = 0;
    for (let x = -r; x < W; x++) {
      if (x + r < W) c += M[ro + x + r];
      if (x - r - 1 >= 0) c -= M[ro + x - r - 1];
      if (x >= 0) T[ro + x] = c > 0 ? 1 : 0;
    }
  }
  for (let x = 0; x < W; x++) {
    let c = 0;
    for (let y = -r; y < H; y++) {
      if (y + r < H) c += T[(y + r) * W + x];
      if (y - r - 1 >= 0) c -= T[(y - r - 1) * W + x];
      if (y >= 0) O[y * W + x] = c > 0 ? 1 : 0;
    }
  }
  return O;
}
function pdfZoneOverlay(g, x0, y0, f, ids) {
  const n = W * H,
    a = document.createElement('canvas');
  a.width = W;
  a.height = H;
  const ga = a.getContext('2d'),
    im = ga.createImageData(W, H),
    d = im.data,
    // (across the lines between a zone's own sections, and about 2 page px thick on the picture as printed)
    r1 = Math.max(2, Math.round(Math.max(W, H) / 160)),
    t = Math.max(1, Math.ceil(1.6 / f.k)),
    names = [];
  ids.forEach(function (id) {
    const M = new Uint8Array(n);
    for (let q = 0; q < n; q++) {
      const l = labels[q];
      if (l > 0 && zoneOf(l) === id) M[q] = 1;
    }
    // closed over the lines inside it, then its edge
    const D = pdfDilate(M, r1),
      inv = new Uint8Array(n);
    for (let q = 0; q < n; q++) inv[q] = D[q] ? 0 : 1;
    const E = pdfDilate(inv, r1);
    for (let q = 0; q < n; q++) E[q] = E[q] ? 0 : 1;
    // (holes in it, where lines meet more thickly than that, filled: only its outer edge is drawn)
    // (each pixel marked as it goes on the stack, so the stack holds it once at most: a plain array of every
    // neighbour pushed reached 12.8 million entries on a 2400 × 2400 picture, v304)
    const out0 = new Uint8Array(n),
      st = new Int32Array(n),
      put = function (q) {
        if (!out0[q] && !E[q]) {
          out0[q] = 1;
          st[sp++] = q;
        }
      };
    let sp = 0;
    for (let x = 0; x < W; x++) {
      put(x);
      put((H - 1) * W + x);
    }
    for (let y = 0; y < H; y++) {
      put(y * W);
      put(y * W + W - 1);
    }
    while (sp) {
      const q = st[--sp],
        x = q % W;
      if (x > 0) put(q - 1);
      if (x < W - 1) put(q + 1);
      if (q >= W) put(q - W);
      if (q < n - W) put(q + W);
    }
    for (let q = 0; q < n; q++) {
      E[q] = out0[q] ? 0 : 1;
      inv[q] = out0[q];
    }
    const out = pdfDilate(inv, t),
      c = hexRgb(pdfZoneCol(id));
    for (let q = 0, j = 0; q < n; q++, j += 4)
      if (E[q] && out[q]) {
        d[j] = c[0];
        d[j + 1] = c[1];
        d[j + 2] = c[2];
        d[j + 3] = 255;
      }
    // its name on its biggest section
    let best = -1,
      ba = 0;
    zoneSecs(id).forEach(function (l) {
      if (comps[l] && comps[l].area > ba) {
        ba = comps[l].area;
        best = l;
      }
    });
    if (best > 0) names.push({ id: id, p: labelPos(best) });
  });
  ga.putImageData(im, 0, 0);
  g.imageSmoothingEnabled = true;
  g.drawImage(a, x0, y0, f.w, f.h);
  pdfFree(a);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '700 ' + PX(8) + 'px ' + LFONT;
  g.lineJoin = 'round';
  names.forEach(function (o) {
    const s = zoneName(o.id),
      hw = g.measureText(s).width / 2 + PX(2),
      // (kept on the picture)
      tx = Math.max(x0 + hw, Math.min(x0 + f.w - hw, x0 + o.p.x * f.k)),
      ty = Math.max(y0 + PX(6), Math.min(y0 + f.h - PX(6), y0 + o.p.y * f.k));
    g.lineWidth = PX(3);
    g.strokeStyle = '#fff';
    g.strokeText(s, tx, ty);
    g.fillStyle = pdfZoneCol(o.id);
    g.fillText(s, tx, ty);
  });
  g.textAlign = 'left';
  g.textBaseline = 'alphabetic';
}
function pdfFit(bw, bh) {
  const k = Math.min(bw / W, bh / H);
  return { k: k, w: W * k, h: H * k };
}
function pdfTrunc(g, t, max) {
  if (g.measureText(t).width <= max) return t;
  while (t.length > 1 && g.measureText(t + '…').width > max) t = t.slice(0, -1);
  return t + '…';
}
// join parts with " · " into at most n lines no wider than max (the last one cut short if need be)
function pdfLines(g, parts, max, n) {
  const out = [];
  let cur = '';
  parts.forEach(function (p) {
    const t = cur ? cur + ' · ' + p : p;
    if (cur && g.measureText(t).width > max && out.length < n - 1) {
      out.push(cur);
      cur = p;
    } else cur = t;
  });
  if (cur) out.push(cur);
  return out.map(function (t) {
    return pdfTrunc(g, t, max);
  });
}
function pdfSwatch(g, x, y, sz, hex, owned) {
  g.fillStyle = hex;
  g.fillRect(x, y, sz, sz);
  g.lineWidth = PX(0.6);
  if (owned === false) {
    g.setLineDash([PX(1.6), PX(1.2)]);
    g.strokeStyle = '#c98a1c';
  } else g.strokeStyle = 'rgba(0,0,0,.28)';
  g.strokeRect(x, y, sz, sz);
  g.setLineDash([]);
}
// a marker's colour family (COLORS' own), and the keys' order: the families round the colour wheel (FAM_ORDER),
// lightest first in each (the PDF's key and, v305, the saved image's)
function famOf(m) {
  const ix = keyIdx(m.mkey);
  return ix != null && COLORS[ix] ? COLORS[ix].fam : 'Other';
}
function famCmp(a, b) {
  const fa = famOf(a),
    fb = famOf(b),
    ia = FAM_ORDER.indexOf(fa),
    ib = FAM_ORDER.indexOf(fb),
    La = a.lab && a.lab.length ? a.lab[0] : hexToLab(a.hex)[0],
    Lb = b.lab && b.lab.length ? b.lab[0] : hexToLab(b.hex)[0];
  return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || fa.localeCompare(fb) || Lb - La;
}
// one row per marker: its sections (secs), and with shading its tones (tones: toneRows, the first for the row, the
// others, when zones shade it differently, as lines under it)
function pdfKeyRows() {
  const map = {};
  assignData.order.forEach(function (l) {
    const m = assignData.assign[l];
    if (!map[m.mkey]) map[m.mkey] = { m: m, n: 0, secs: [] };
    map[m.mkey].n++;
    map[m.mkey].secs.push(l);
  });
  const rows = Object.keys(map).map(function (k) {
    const e = map[k];
    e.fam = famOf(e.m);
    return e;
  });
  rows.sort(function (a, b) {
    return famCmp(a.m, b.m);
  });
  // (each marker's place in colouring order, lightest first as Colour along goes: the key's ORDER column, v284)
  rows
    .slice()
    .sort(function (a, b) {
      return _lum(b.m.hex) - _lum(a.m.hex) || b.n - a.n;
    })
    .forEach(function (r, i) {
      r.ord = i + 1;
    });
  return rows;
}
// ---- the colouring page's labels, placed so none covers another (v284) ----
// how many sections the last PDF built put in close-ups (the Print sheet's summary says so)
let _pdfCloseN = 0,
  // (on how many pages, and how many small sections none of them could label)
  _pdfCloseP = 0,
  _pdfLeft = 0,
  // (how many close-ups, lettered A, B …: for the tests)
  _pdfCloseL = 0,
  _pdfCU = [],
  // (and the colouring page's placing, for the tests)
  _pdfP1 = null;
// a number label's size and box at size s (picture pixels), or as big as its section allows when s is null
function pdfNumLay(g, l, t, o, s) {
  const c = comps[l],
    p = labelPos(l);
  let fs = s != null ? s : Math.max(o.base, Math.min(Math.sqrt(c.area) * 0.5, o.max));
  g.font = o.w + ' ' + fs + 'px ' + LFONT;
  let tw = g.measureText(t).width;
  if (s == null) {
    const sc = Math.min(1, (p.aw * 0.94) / tw, (p.r * 2.4) / fs);
    if (sc < 1) {
      fs = Math.max(o.min, Math.floor(fs * sc * 2) / 2);
      g.font = o.w + ' ' + fs + 'px ' + LFONT;
      tw = g.measureText(t).width;
    }
  }
  const lw = Math.max(1, fs * o.swk);
  return {
    kind: 'num',
    t: t,
    fs: fs,
    // (the box the ink takes: capitals and digits reach about 0.42 of the size either side of the middle)
    box: [p.x - tw / 2 - lw - 1, p.y - fs * 0.42 - lw - 1, p.x + tw / 2 + lw + 1, p.y + fs * 0.42 + lw + 1],
  };
}
function pdfNumPut(g, l, lay, o) {
  const p = labelPos(l),
    lw = Math.max(1, lay.fs * o.swk);
  g.font = o.w + ' ' + lay.fs + 'px ' + LFONT;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.lineWidth = lw;
  g.strokeStyle = o.stroke;
  g.fillStyle = o.fill;
  g.strokeText(lay.t, p.x, p.y);
  g.fillText(lay.t, p.x, p.y);
}
// a code's size and box at size s, or as big as its section allows when s is null
function pdfCodeLay(g, l, m, o, s) {
  const oo = s == null ? o : Object.assign({}, o, { base: s, max: s, min: s }),
    L = codeLayout(g, l, m, oo),
    h = L.fs * 0.42 + L.lw + 1;
  // (the ink's box, as for a number: codeLayout's own is the screen's, with room for its line above and below)
  return { kind: 'code', fs: L.fs, box: [L.box[0] + 1, L.y - h, L.box[2] - 1, L.y + h], o: oo };
}
// Place the labels of sections ids (biggest first; opt.first's before the rest): each as big as its section allows,
// else smaller (to the least size), else (with Codes) its key number, else none. opt.bnd: a box every label must keep
// inside (a close-up's). { lays: { l: layout }, dropped, boxes, usedNum }. The boxes placed are kept in a grid of
// cells, so each label is checked only against those near it.
function pdfPlace(g, ids, o, lab, numOf, opt) {
  opt = opt || {};
  const asg = assignData.assign,
    boxes = [],
    lays = {},
    dropped = [],
    first = {},
    bnd = opt.bnd,
    CS = Math.max(8, o.base * 4),
    grid = new Map(),
    cells = function (b, fn) {
      for (let gy = Math.floor(b[1] / CS); gy <= Math.floor(b[3] / CS); gy++)
        for (let gx = Math.floor(b[0] / CS); gx <= Math.floor(b[2] / CS); gx++) fn(gx + ',' + gy);
    },
    add = function (b) {
      boxes.push(b);
      cells(b, function (k) {
        let a = grid.get(k);
        if (!a) grid.set(k, (a = []));
        a.push(b);
      });
    },
    free = function (b) {
      if (bnd && (b[0] < bnd[0] || b[1] < bnd[1] || b[2] > bnd[2] || b[3] > bnd[3])) return false;
      let ok = true;
      cells(b, function (k) {
        const a = grid.get(k);
        if (!ok || !a) return;
        for (let i = 0; i < a.length; i++) {
          const q = a[i];
          if (b[0] < q[2] && q[0] < b[2] && b[1] < q[3] && q[1] < b[3]) {
            ok = false;
            return;
          }
        }
      });
      return ok;
    },
    sizes = function (s0) {
      const out = [s0];
      for (let s = s0 * 0.85; s > o.min; s *= 0.85) out.push(s);
      if (out[out.length - 1] > o.min) out.push(o.min);
      return out;
    };
  (opt.first || []).forEach(function (l) {
    first[l] = 1;
  });
  let usedNum = false;
  ids
    .filter(function (l) {
      return !!asg[l];
    })
    .sort(function (a, b) {
      return (first[b] || 0) - (first[a] || 0) || comps[b].area - comps[a].area;
    })
    .forEach(function (l) {
      const mm = asg[l],
        tries = [];
      if (lab === 'codes') {
        const L0 = pdfCodeLay(g, l, mm, o, null);
        sizes(L0.fs).forEach(function (s) {
          tries.push(function () {
            return pdfCodeLay(g, l, mm, o, s);
          });
        });
      }
      // (opt.noNum: codes only, for the saved image, v304)
      if (!opt.noNum) {
        const t = numOf(mm),
          N0 = pdfNumLay(g, l, t, o, null);
        sizes(N0.fs).forEach(function (s) {
          tries.push(function () {
            return pdfNumLay(g, l, t, o, s);
          });
        });
      }
      for (let i = 0; i < tries.length; i++) {
        const L = tries[i]();
        if (free(L.box)) {
          lays[l] = L;
          add(L.box);
          if (L.kind === 'num' && lab === 'codes') usedNum = true;
          return;
        }
      }
      dropped.push(l);
    });
  // (the dots of those left out count as taken, for the shading's marks and the close-ups' letters)
  dropped.forEach(function (l) {
    const p = labelPos(l),
      r = o.min * 0.4;
    add([p.x - r, p.y - r, p.x + r, p.y + r]);
  });
  return { lays: lays, dropped: dropped, boxes: boxes, usedNum: usedNum, free: free, add: add };
}
// draw what pdfPlace placed, and a small dot (radius dr) in each section left out (dotOk: only those it allows)
function pdfPlaceDraw(g, asg, pl, o, numOf, dr, dotOk) {
  for (const l in pl.lays) {
    const L = pl.lays[l];
    if (L.kind === 'code') drawCode(g, +l, asg[l], L.o);
    else pdfNumPut(g, +l, L, o);
  }
  g.fillStyle = o.fill;
  pl.dropped.forEach(function (l) {
    if (dotOk && !dotOk(l)) return;
    const p = labelPos(l);
    g.beginPath();
    g.arc(p.x, p.y, dr, 0, 6.283);
    g.fill();
  });
  g.textAlign = 'left';
  g.textBaseline = 'alphabetic';
}
// a close-up page's codes and how strong its magnified lines are (v305: grey lines, near-black codes)
const CU_INK = '#1a1a1a',
  CU_LINES = 0.5;
// 1st, 2nd, 3rd … (the key's colouring order, unlike its numbers: v284 review)
function pdfOrd(n) {
  const t = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th';
  return n + t;
}
// A, B, … Z, then AA, AB …
function pdfLetter(i) {
  return (i >= 26 ? String.fromCharCode(64 + Math.floor(i / 26)) : '') + String.fromCharCode(65 + (i % 26));
}
// a close-up's cell on its page (bw: the page's width inside its margins): two across, as many rows as fit
function pdfCell(bw) {
  const P = PAPERS[paper] || PAPERS.letter,
    gap = PX(16),
    w = (bw - gap) / 2,
    h = Math.round(w * 0.66),
    ph = Math.round((P[1] / 72) * PDPI) - 2 * PX(pdfS < 1 ? 30 : 36) - PX(40) - PX(18),
    rows = Math.max(1, Math.floor((ph + gap) / (h + gap + PX(14))));
  return { w: w, h: h, gap: gap, per: rows * 2 };
}
// the sections ids grouped into close-ups, near ones together: each a part of the picture that, magnified to k
// page pixels per picture pixel, fits a cell (with room round them). [{ ids, crop: [x0, y0, x1, y1] }]
function pdfClusters(ids, cell, k) {
  const B = secBoxes(),
    maxW = (cell.w / k) * 0.75,
    maxH = (cell.h / k) * 0.75,
    out = [];
  ids
    .slice()
    .sort(function (a, b) {
      return B.y0[a] - B.y0[b] || B.x0[a] - B.x0[b];
    })
    .forEach(function (l) {
      const b = [B.x0[l], B.y0[l], B.x1[l] + 1, B.y1[l] + 1];
      let best = null,
        bg = Infinity;
      out.forEach(function (c) {
        const u = [
          Math.min(c.box[0], b[0]),
          Math.min(c.box[1], b[1]),
          Math.max(c.box[2], b[2]),
          Math.max(c.box[3], b[3]),
        ];
        if (u[2] - u[0] > maxW || u[3] - u[1] > maxH) return;
        const grow = (u[2] - u[0]) * (u[3] - u[1]) - (c.box[2] - c.box[0]) * (c.box[3] - c.box[1]);
        if (grow < bg) {
          bg = grow;
          best = { c: c, u: u };
        }
      });
      if (best) {
        best.c.box = best.u;
        best.c.ids.push(l);
      } else out.push({ ids: [l], box: b });
    });
  // each crop: its box with room round it, in the cell's shape, inside the picture
  out.forEach(function (c) {
    const bw = c.box[2] - c.box[0],
      bh = c.box[3] - c.box[1],
      cxm = (c.box[0] + c.box[2]) / 2,
      cym = (c.box[1] + c.box[3]) / 2,
      a = cell.w / cell.h;
    let w = Math.max(bw / 0.75, maxW * 0.5),
      h = Math.max(bh / 0.75, maxH * 0.5);
    if (w / h < a) w = h * a;
    else h = w / a;
    w = Math.min(w, W);
    h = Math.min(h, H);
    const x0 = Math.max(0, Math.min(W - w, cxm - w / 2)),
      y0 = Math.max(0, Math.min(H - h, cym - h / 2));
    c.crop = [x0, y0, x0 + w, y0 + h];
  });
  return out;
}
// a close-up's place on the colouring page: a dashed box with its letter (drawn in picture pixels, k to the page),
// the letter as light as the labels (ink: their colour) so it doesn't show through pale marker. The letter goes in
// the first corner of the box with nothing placed there (pl: page 1's placing, which then keeps it clear), white
// round its strokes as the labels are; v284 review: a white tab under it used to rub out labels.
function pdfCloseMark(g, cr, letter, k, ink, pl) {
  g.save();
  g.setLineDash([PX(2) / k, PX(2) / k]);
  g.strokeStyle = '#b0b0b0';
  g.lineWidth = PX(0.5) / k;
  g.strokeRect(cr[0], cr[1], cr[2] - cr[0], cr[3] - cr[1]);
  g.setLineDash([]);
  g.font = '700 ' + PX(7.5) / k + 'px ' + LFONT;
  const tw = g.measureText(letter).width,
    pd = PX(1.5) / k,
    bw = tw + pd * 2,
    bh = PX(9) / k,
    at = [
      [cr[0], cr[1]],
      [cr[2] - bw, cr[1]],
      [cr[0], cr[3] - bh],
      [cr[2] - bw, cr[3] - bh],
      [cr[0], cr[1] - bh],
      [cr[0], cr[3]],
    ]
      .map(function (q) {
        return [q[0], q[1], q[0] + bw, q[1] + bh];
      })
      .filter(function (b) {
        return b[0] >= 0 && b[1] >= 0 && b[2] <= W && b[3] <= H;
      });
  const box = (pl &&
    at.find(function (b) {
      return pl.free(b);
    })) ||
    at[0] || [cr[0], cr[1], cr[0] + bw, cr[1] + bh];
  if (pl) pl.add(box);
  g.textAlign = 'left';
  g.textBaseline = 'top';
  g.lineJoin = 'round';
  g.lineWidth = PX(1.6) / k;
  g.strokeStyle = '#fff';
  g.strokeText(letter, box[0] + pd, box[1] + PX(1) / k);
  g.fillStyle = ink;
  g.fillText(letter, box[0] + pd, box[1] + PX(1) / k);
  g.restore();
}
// the PDF's pages as canvases; dry: just how many there will be (for the Print sheet's summary), from the same
// layout without drawing the pictures
// (lazy: the test strip's pages as functions that each draw one when the PDF writer comes to it, for exportPDF, v304)
// (v307: lazy, the guide's pages too, each noted down as it's laid out and drawn when the PDF writer comes to it)
function buildPDFPages(dry, lazy) {
  _pdfDry = !!dry;
  try {
    if (pdfWhat === 'strip') return testStripPages(!!dry, !!lazy);
    if (!lazy || dry) return _buildPDF(!!dry);
    _pdfRec = { keep: [] };
    const pages = _buildPDF(false);
    return pdfLazy(pages, _pdfRec.keep);
  } finally {
    _pdfDry = false;
    _pdfRec = null;
  }
}
function _buildPDF(dry) {
  sameCodeReset();
  // (shading that leaves every section flat has nothing to show: no tone marks, how-to or tone columns)
  const sh = shadeUse().on ? shadePrep(false) : null,
    withShade = !!sh,
    withBlend = !!pdfBlend || withShade,
    asg = assignData.assign,
    rows = pdfKeyRows(),
    nm = curName || 'Colouring guide',
    pages = [];
  pdfS = paper === 'a5' || paper === 'half' ? 0.84 : 1;
  // every brand printed (the key's markers and their lighter, darker and to-buy ones): one brand is named once in the
  // headers and the letters left out; mixed brands keep a letter on each code, with the letter key
  const _bs = {};
  // (with shading, each marker's tones in each zone that shades it: toneRows)
  // (a colour's tones in zone order, Main's first; zOut: the zones with a key line of their own, outlined on the
  // key's picture)
  const zOrd = zoneIds(),
    zFirst = function (x) {
      for (let i = 0; i < zOrd.length; i++) if (x.z[zOrd[i]]) return i;
      return 99;
    },
    zOut = {};
  if (withShade)
    rows.forEach(function (r) {
      r.tones = toneRows(r.secs).sort(function (a, b) {
        return zFirst(a) - zFirst(b);
      });
      if (r.tones.length > 1)
        r.tones.forEach(function (x) {
          for (const id in x.z) if (+id) zOut[id] = 1;
        });
    });
  const zIds = zOrd.filter(function (id) {
    return zOut[id];
  });
  rows.forEach(function (r) {
    _bs[r.m.brand] = 1;
    if (withShade) {
      r.tones.forEach(function (x) {
        const t = x.t;
        [t.light, t.dark, t.wantLight, t.wantDark].forEach(function (c) {
          if (c) _bs[c.brand] = 1;
        });
      });
    } else if (withBlend) {
      const c = blendCompanions(r.m);
      if (c.light) _bs[c.light.brand] = 1;
      if (c.dark) _bs[c.dark.brand] = 1;
    }
  });
  const oneB = Object.keys(_bs).length === 1 ? Object.keys(_bs)[0] : '',
    tagOf = function (c) {
      return oneB ? '' : bTag(c.brand) + ' ';
    },
    nMk = mkCount(rows.length, oneB, withShade ? null : 0);
  const ref = pdfWhat === 'ref',
    lab = ref ? 'none' : pdfLabels,
    nums = lab === 'numbers',
    num = {};
  rows.forEach(function (r, i) {
    num[r.m.mkey] = i + 1;
  });
  const P0 = PAPERS[paper] || PAPERS.letter,
    m = PX(pdfS < 1 ? 30 : 36),
    bw = Math.round((P0[0] / 72) * PDPI) - 2 * m;
  // ---- page 1: the colouring page (left out for "Key + reference"). Its labels are placed biggest section first,
  // never over one already placed: a code shrinks as far as the least size, then (with Codes) the marker's key
  // number is tried, and a section with room for neither gets a dot and a place in a close-up (pages after this one,
  // each close-up a part of the picture magnified with its labels, lettered A, B… here and there). v284: before,
  // labels in small sections printed on top of each other. A dry run works it all out too, for the page count.
  // labels: small and light grey by default so they don't show through pale marker ink; outlines stay dark
  const LS = pdfDark
      ? { base: 8, min: 6, max: 15, w: 700, swk: 0.28, fill: '#111' }
      : { base: 6.5, min: 5, max: 10, w: 600, swk: 0.22, fill: '#a0a0a0' },
    loAt = function (k) {
      return {
        base: PX(LS.base) / k,
        min: PX(LS.min) / k,
        max: PX(LS.max) / k,
        w: LS.w,
        swk: LS.swk,
        stroke: '#fff',
        fill: LS.fill,
        bt: guideMixed(),
        // the brand tags as light as the codes (outlined ones white inside)
        tag: Object.assign(
          pdfDark ? { dark: TAG.dark, pale: TAG.pale } : { dark: LS.fill, pale: '#fff' },
          TAG_PRINT,
        ),
      };
    };
  let keyNums = nums,
    closeups = [],
    closeP = 0;
  // (the sections with no room on page 1, and those of them a close-up labels)
  const small = {},
    shown = {};
  if (!ref) {
    const p1 = pdfPage(),
      g1 = p1.g;
    pages.push(dry ? null : p1);
    g1.font = '500 ' + PX(8.5) + 'px ' + LFONT;
    // (the picture's place, from the longest the lines under the title can be)
    // (long: the longest they can be, for the estimate; v284 review: the real lines could be longer than it)
    const subParts = function (cl, keyPg, long) {
        return [nWord(assignData.N, 'section'), nMk].concat(
          withShade ? ['shading: H highlight', 'B base', 'S shadow, see the key'] : [],
          cl
            ? (cl === 1 ? 'A: a close-up' : 'A–' + pdfLetter(cl - 1) + ': close-ups') +
                (keyPg > 3 ? ' on pages 2–' + (keyPg - 1) : ' on page 2')
            : [],
          nums || keyNums || long
            ? 'numbers: see the colour key on page ' + keyPg
            : 'colour key on page ' + keyPg,
          lab === 'codes' && !oneB && guideMixed() ? brandKey().replace(/\s{2,}/g, '  ') : [],
        );
      },
      sub0 = pdfLines(g1, subParts(54, 5, true), bw, 2),
      top = m + PX(36) + (sub0.length - 1) * PX(11),
      bot = p1.h - m - PX(14),
      f1 = pdfFit(bw, bot - top),
      ox = m + (bw - f1.w) / 2,
      lo = loAt(f1.k),
      numOf = function (mm) {
        return String(num[mm.mkey] || '');
      };
    let pl = { lays: {}, dropped: [], boxes: [] };
    if (lab !== 'none') {
      pl = pdfPlace(g1, Object.keys(asg).map(Number), lo, lab, numOf);
      _pdfP1 = pl;
      if (pl.usedNum) keyNums = true;
      pl.dropped.forEach(function (l) {
        small[l] = 1;
      });
      // close-ups for the sections left with a dot: as few as will hold them (a page's worth if it can be), 3 to
      // 1.75 times as big as here
      // At most 3 pages of them (more would bury the key): any sections past those, or too small to label even in
      // their close-up, are counted, and the close-ups and the Print sheet say so (v284 review: they were left out
      // without a word).
      if (pl.dropped.length) {
        const cell = pdfCell(bw);
        for (let mag = 3; mag >= 1.75; mag -= 0.25) {
          closeups = pdfClusters(pl.dropped, cell, f1.k * mag);
          if (closeups.length <= cell.per) break;
        }
        closeups = closeups.slice(0, cell.per * 3);
        closeP = Math.ceil(closeups.length / cell.per);
        // each close-up's labels: its own sections placed first, every label kept inside it
        closeups.forEach(function (c) {
          const cr = c.crop;
          c.k = Math.min(cell.w / (cr[2] - cr[0]), cell.h / (cr[3] - cr[1]));
          // (v305: a close-up's codes near-black over its lines in mid grey, so the labels lead; page 1's stay light
          // so they don't show through pale ink. v306: their brand tags in the same print colours, near-black and
          // white, not the screen's)
          c.lo = Object.assign(loAt(c.k), {
            fill: CU_INK,
            tag: Object.assign({ dark: CU_INK, pale: '#fff' }, TAG_PRINT),
          });
          c.pl = pdfPlace(
            g1,
            Object.keys(asg)
              .map(Number)
              .filter(function (l) {
                const q = labelPos(l);
                return q.x >= cr[0] && q.x <= cr[2] && q.y >= cr[1] && q.y <= cr[3];
              }),
            c.lo,
            lab,
            numOf,
            { first: c.ids, bnd: cr },
          );
          if (c.pl.usedNum) keyNums = true;
          for (const l in c.pl.lays) if (small[l]) shown[l] = 1;
        });
      }
    }
    if (!dry) {
      g1.font = '500 ' + PX(8.5) + 'px ' + LFONT;
      const keyPg = 2 + closeP,
        sub = pdfLines(g1, subParts(closeups.length, keyPg), bw, 2);
      g1.fillStyle = '#111';
      g1.font = '700 ' + PX(15) + 'px ' + LFONT;
      g1.fillText(pdfTrunc(g1, nm, bw), m, m + PX(12));
      g1.fillStyle = '#777';
      g1.font = '500 ' + PX(8.5) + 'px ' + LFONT;
      sub.forEach(function (t, i) {
        g1.fillText(t, m, m + PX(26) + i * PX(11));
      });
      g1.imageSmoothingEnabled = true;
      g1.imageSmoothingQuality = 'high';
      const art1 = pdfArt(
        false,
        sh,
        pdfToneLines && {
          t: Math.max(1, Math.round(PX(0.8) / f1.k)),
          dash: Math.max(3, Math.round(PX(4) / f1.k)),
        },
      );
      g1.drawImage(art1, ox, top, f1.w, f1.h);
      g1.save();
      g1.setTransform(f1.k, 0, 0, f1.k, ox, top);
      pdfPlaceDraw(g1, asg, pl, lo, numOf, PX(1.2) / f1.k);
      const lbox = pl.boxes;
      // where each close-up is, lettered
      closeups.forEach(function (c, i) {
        pdfCloseMark(g1, c.crop, pdfLetter(i), f1.k, LS.fill, pl);
      });
      if (withShade) {
        const zr = PX(5.2) / f1.k;
        g1.textAlign = 'center';
        g1.textBaseline = 'middle';
        g1.font = '700 ' + PX(6.5) / f1.k + 'px ' + LFONT;
        const blocked = function (x, y) {
          for (let i = 0; i < lbox.length; i++) {
            const b = lbox[i],
              cx = Math.max(b[0], Math.min(x, b[2])),
              cy = Math.max(b[1], Math.min(y, b[3]));
            if (Math.hypot(x - cx, y - cy) < zr * 1.25) return true;
          }
          return false;
        };
        const inZone = function (z, x, y) {
          for (let a = 0; a < 8; a++) {
            const t = (a * Math.PI) / 4,
              px = Math.round(x + Math.cos(t) * zr * 1.1),
              py = Math.round(y + Math.sin(t) * zr * 1.1);
            if (px < 0 || py < 0 || px >= W || py >= H) return false;
            const q = py * W + px;
            if (labels[q] !== z.l || !sh.V[q] || shadeZone(sh.tone[z.l], (sh.V[q] - 1) / 254) !== z.zone)
              return false;
          }
          return true;
        };
        shadeZoneLabelsAll(sh, zr * 1.3).forEach(function (z) {
          if (blocked(z.x, z.y)) {
            let ok = false;
            for (let rr = zr * 2.2; rr <= Math.max(zr * 2.2, z.r * 1.6) && !ok; rr += zr * 1.1)
              for (let a = 0; a < 12 && !ok; a++) {
                const t = (a * Math.PI) / 6,
                  x = z.x + Math.cos(t) * rr,
                  y = z.y + Math.sin(t) * rr;
                if (!blocked(x, y) && inZone(z, x, y)) {
                  z.x = x;
                  z.y = y;
                  ok = true;
                }
              }
            if (!ok) return;
          }
          g1.beginPath();
          g1.arc(z.x, z.y, zr, 0, 6.283);
          g1.fillStyle = '#fff';
          g1.fill();
          g1.lineWidth = PX(0.6) / f1.k;
          g1.strokeStyle = '#9a9a9a';
          g1.stroke();
          g1.fillStyle = '#555';
          g1.fillText(String(z.tone), z.x, z.y + zr * 0.06);
        });
        g1.textAlign = 'left';
        g1.textBaseline = 'alphabetic';
        if (shadeUse().sun) {
          const sr = PX(6) / f1.k,
            sx = Math.max(sr * 2, Math.min(W - sr * 2, shadeSun.x * W)),
            sy = Math.max(sr * 2, Math.min(H - sr * 2, shadeSun.y * H));
          g1.lineCap = 'round';
          g1.strokeStyle = '#fff';
          g1.lineWidth = PX(3.2) / f1.k;
          for (let a = 0; a < 8; a++) {
            const t = (a * Math.PI) / 4;
            g1.beginPath();
            g1.moveTo(sx + Math.cos(t) * sr * 1.45, sy + Math.sin(t) * sr * 1.45);
            g1.lineTo(sx + Math.cos(t) * sr * 2, sy + Math.sin(t) * sr * 2);
            g1.stroke();
          }
          g1.beginPath();
          g1.arc(sx, sy, sr + PX(1.2) / f1.k, 0, 6.283);
          g1.fillStyle = '#fff';
          g1.fill();
          g1.strokeStyle = '#666';
          g1.lineWidth = PX(1) / f1.k;
          for (let a = 0; a < 8; a++) {
            const t = (a * Math.PI) / 4;
            g1.beginPath();
            g1.moveTo(sx + Math.cos(t) * sr * 1.45, sy + Math.sin(t) * sr * 1.45);
            g1.lineTo(sx + Math.cos(t) * sr * 2, sy + Math.sin(t) * sr * 2);
            g1.stroke();
          }
          g1.beginPath();
          g1.arc(sx, sy, sr, 0, 6.283);
          g1.fillStyle = '#fff';
          g1.fill();
          g1.stroke();
        }
      }
      g1.restore();
      // ---- the close-ups: each its part of the picture, magnified, with its labels
      if (closeups.length) {
        const cell = pdfCell(bw);
        let cp = null,
          // (the foot of the last row drawn)
          lastBot = 0;
        closeups.forEach(function (c, i) {
          if (i % cell.per === 0) {
            cp = pdfPage();
            pages.push(cp);
            const gc = cp.g;
            gc.fillStyle = '#111';
            gc.font = '700 ' + PX(15) + 'px ' + LFONT;
            gc.fillText('Close-ups', m, m + PX(12));
            gc.fillStyle = '#777';
            gc.font = '500 ' + PX(8.5) + 'px ' + LFONT;
            gc.fillText(
              pdfTrunc(
                gc,
                'Sections too small to label on page 1, magnified. A dot there marks each one.',
                bw,
              ),
              m,
              m + PX(26),
            );
          }
          const gc = cp.g,
            j = i % cell.per,
            cx = m + (j % 2) * (cell.w + cell.gap),
            cy = m + PX(40) + Math.floor(j / 2) * (cell.h + cell.gap + PX(14)),
            cr = c.crop,
            kc = c.k,
            dw = (cr[2] - cr[0]) * kc,
            dh = (cr[3] - cr[1]) * kc;
          gc.fillStyle = '#111';
          gc.font = '700 ' + PX(10) + 'px ' + LFONT;
          gc.fillText(pdfLetter(i), cx, cy + PX(10));
          const iy = cy + PX(14);
          lastBot = Math.max(j ? lastBot : 0, iy + cell.h);
          gc.save();
          gc.beginPath();
          gc.rect(cx, iy, dw, dh);
          gc.clip();
          gc.imageSmoothingEnabled = true;
          gc.imageSmoothingQuality = 'high';
          // (the magnified lines at about half strength: about 50% grey on the white page, v305)
          gc.fillStyle = '#fff';
          gc.fillRect(cx, iy, dw, dh);
          gc.globalAlpha = CU_LINES;
          gc.drawImage(art1, cr[0], cr[1], cr[2] - cr[0], cr[3] - cr[1], cx, iy, dw, dh);
          gc.globalAlpha = 1;
          gc.setTransform(kc, 0, 0, kc, cx - cr[0] * kc, iy - cr[1] * kc);
          // (a dot only for a small section still without a label: one labelled on page 1 needs none here)
          pdfPlaceDraw(gc, asg, c.pl, c.lo, numOf, PX(1.2) / kc, function (l) {
            return small[l] && !shown[l];
          });
          gc.restore();
          gc.strokeStyle = '#bbb';
          gc.lineWidth = PX(0.6);
          gc.strokeRect(cx, iy, dw, dh);
        });
        // (under the last of them: how many small sections no close-up could label)
        const left = pl.dropped.length - Object.keys(shown).length;
        if (left) {
          const gc = cp.g;
          gc.fillStyle = '#777';
          gc.font = '500 ' + PX(8.5) + 'px ' + LFONT;
          gc.fillText(
            pdfTrunc(
              gc,
              left +
                (Object.keys(shown).length ? ' more' : '') +
                (left === 1 ? ' small section has' : ' small sections have') +
                ' only a dot on page 1: see ' +
                (left === 1 ? 'it' : 'them') +
                ' in the app' +
                (lab === 'codes' ? ', or print with Numbers.' : '.'),
              bw,
            ),
            m,
            Math.min(lastBot + PX(16), cp.h - m - PX(4)),
          );
        }
      }
      // (a whole-picture canvas: handed back now, not when the browser gets round to it — iPad's limit, v298)
      pdfFree(art1);
    } else for (let i = 0; i < closeP; i++) pages.push(null);
  }
  _pdfCloseN = Object.keys(shown).length;
  _pdfCloseP = closeP;
  _pdfCloseL = closeups.length;
  _pdfCU = closeups;
  _pdfLeft = Object.keys(small).length - _pdfCloseN;
  // ---- next: reference preview + colour key table (bigger preview for "Key + reference")
  let pg = pdfPage(),
    g = pg.g;
  pages.push(pg);
  g.fillStyle = '#111';
  g.font = '700 ' + PX(15) + 'px ' + LFONT;
  g.fillText(pdfTrunc(g, ref ? nm : 'Colour key', bw), m, m + PX(12));
  g.fillStyle = '#777';
  g.font = '500 ' + PX(8.5) + 'px ' + LFONT;
  g.fillText(
    pdfTrunc(
      g,
      (ref ? 'Colour key' : nm) +
        ' · ' +
        nMk +
        ' · ' +
        nWord(assignData.N, 'section') +
        (assignData.paper
          ? ' (' + Object.keys(assignData.paper).length + ' unlabelled ones stay white)'
          : '') +
        (oneB ? '' : ' · ' + brandKey().replace(/\s{2,}/g, '  ')),
      bw,
    ),
    m,
    m + PX(26),
  );
  const cols = withBlend ? 1 : 2,
    gap = PX(20),
    cw = (bw - gap * (cols - 1)) / cols;
  let rowH = PX(19);
  const famH = PX(20),
    hdrH = PX(16),
    sw = PX(11),
    pageBot0 = pg.h - m - PX(18);
  let pvTop = m + PX(38);
  if (withShade) {
    g.fillStyle = '#444';
    g.font = '500 ' + PX(8) + 'px ' + LFONT;
    // (tones that differ by zone: where the zones are)
    const words = (
      shadeHowto(!pdfToneLines) +
      (zIds.length
        ? ' Where a colour’s tones differ by zone, the key has a line for each: the zones are outlined below, and Main is the rest.'
        : '')
    ).split(' ');
    let line = '',
      ly = m + PX(40);
    words.forEach(function (w) {
      const t = line ? line + ' ' + w : w;
      if (line && g.measureText(t).width > bw) {
        g.fillText(line, m, ly);
        ly += PX(11);
        line = w;
      } else line = t;
    });
    if (line) {
      g.fillText(line, m, ly);
      ly += PX(11);
    }
    pvTop = ly + PX(4);
  }
  const _want = {};
  if (withShade)
    rows.forEach(function (r) {
      r.tones.forEach(function (x) {
        const t = x.t;
        if (t.wantLight) _want[t.wantLight.mkey] = t.wantLight;
        if (t.wantDark) _want[t.wantDark.mkey] = t.wantDark;
      });
    });
  else if (withBlend)
    rows.forEach(function (r) {
      const c = blendCompanions(r.m);
      if (c.light && !c.lightOwned) _want[c.light.mkey] = c.light;
      if (c.dark && !c.darkOwned) _want[c.dark.mkey] = c.dark;
    });
  g.font = '600 ' + PX(8.5) + 'px ' + LFONT;
  const _chipW = Object.keys(_want).map(function (k) {
    const mm = _want[k];
    return Math.min(
      bw,
      PX(14) + g.measureText(tagOf(mm) + mm.code + (mm.name ? ' ' + mm.name : '')).width + PX(14),
    );
  });
  // dry run: how many pages does the key need if the table starts at `start`?
  function simPages(start) {
    let pages = 1,
      col = 0,
      colTop = start,
      y = colTop + hdrH,
      bot = pageBot0,
      last = null;
    const need = function (h) {
      if (y + h <= bot) return;
      if (col < cols - 1) {
        col++;
        y = colTop + hdrH;
      } else {
        pages++;
        col = 0;
        colTop = m + PX(24);
        y = colTop + hdrH;
      }
    };
    rows.forEach(function (r) {
      if (r.fam !== last) {
        need(famH + rowH);
        y += famH;
        last = r.fam;
      }
      need(rowH);
      y += rowH;
      // (a line for each zone that shades it differently)
      for (let i = 0; withShade && r.tones.length > 1 && i < r.tones.length; i++) {
        need(rowH);
        y += rowH;
      }
    });
    if (_chipW.length) {
      col = 0;
      y += PX(14);
      need(PX(40), true);
      y += PX(18);
      let x = 0;
      _chipW.forEach(function (w) {
        if (x + w > bw) {
          x = 0;
          y += PX(16);
        }
        need(PX(16));
        x += w;
      });
      y += PX(16);
      need(0);
    }
    return pages;
  }
  // biggest preview that still lets the whole key fit on this page; otherwise a modest one
  // (then a smaller preview, then slightly tighter rows, before letting the key run onto another sheet)
  const avail = pg.h - 2 * m,
    hiF = ref ? 0.8 : 0.5,
    loH = Math.max(PX(60), ref ? Math.round(avail * 0.62) : 0);
  let pvH = 0;
  [PX(19), PX(16.5)].some(function (rh) {
    rowH = rh;
    for (let h = Math.round(avail * hiF); h >= loH; h -= PX(10)) {
      const fz = pdfFit(bw, h);
      if (simPages(pvTop + fz.h + PX(18)) === 1) {
        pvH = h;
        return true;
      }
    }
    return false;
  });
  if (!pvH) {
    rowH = PX(19);
    pvH = ref ? Math.round(avail * 0.62) : PX(190);
  }
  // a tall picture: the reference fills the left column and the key starts in the right one. "Key + reference" always;
  // "Page + key" too when the whole key fits that column (v284: a tall picture's reference was a sliver across the top)
  let famN = 0,
    famL = null;
  rows.forEach(function (r) {
    if (r.fam !== famL) famN++;
    famL = r.fam;
  });
  const side =
    cols === 2 &&
    pdfFit(cw, pageBot0 - pvTop).k > pdfFit(bw, pvH).k &&
    (ref || hdrH + famN * famH + rows.length * PX(19) <= pageBot0 - pvTop);
  if (side) rowH = PX(19);
  const f2 = side ? pdfFit(cw, pageBot0 - pvTop) : pdfFit(bw, pvH),
    pvx = m + ((side ? cw : bw) - f2.w) / 2,
    pvy = pvTop;
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  if (!dry) {
    const art2 = pdfArt(true, sh);
    g.drawImage(art2, pvx, pvy, f2.w, f2.h);
    pdfFree(art2);
  }
  if (!dry && zIds.length) pdfZoneOverlay(g, pvx, pvy, f2, zIds);
  g.strokeStyle = 'rgba(0,0,0,.15)';
  g.lineWidth = PX(0.6);
  g.strokeRect(pvx, pvy, f2.w, f2.h);
  // columns: [number] swatch, brand, code, name, sections, then (with blends or shading) the lighter and darker
  // marker, each as wide as its longest entry so the name keeps what's left, even on a small page
  // [☐ to tick off] [order] [number] swatch …: the box and the order come first (v284)
  // (v307: the order column as wide as its longest, "162nd", clear of the box: it touched it)
  g.font = '600 ' + PX(8) + 'px ' + LFONT;
  const ordR = rows.reduce(function (w, r) {
      return Math.max(w, PX(14) + g.measureText(pdfOrd(r.ord)).width);
    }, PX(32)),
    nw = keyNums ? PX(20) : 0,
    lead = ordR + PX(4),
    X = {
      box: 0,
      ord: ordR,
      sw: lead + nw,
      tag: lead + nw + PX(16),
      code: lead + nw + PX(28),
      name: lead + nw + PX(80),
      cnt: cw,
    };
  // (the code column as wide as the longest code, so the names keep the rest: v284 review)
  g.font = '700 ' + PX(9.5) + 'px ' + LFONT;
  const codeW = rows.reduce(function (w, r) {
    return Math.max(w, g.measureText(r.m.code).width);
  }, 0);
  X.name = X.code + Math.min(PX(60), Math.max(PX(30), codeW + PX(8)));
  // (t: the tones of a row or of one of its lines; none: a marker whose sections are all flat)
  const cellsOf = function (mm, t) {
    if (withShade) {
      if (!t) return [{ t: '— flat, no tones' }, null];
      return [
        t.light
          ? { c: t.light, o: true }
          : t.paper
            ? { t: '— leave the paper white' }
            : shadeMode === 'full'
              ? { t: '— base is the lightest' }
              : null,
        t.dark
          ? { c: t.dark, o: true }
          : t.noShadow
            ? { t: 'no shadow (already darkest)' }
            : { coat: mm, S: t.S },
      ];
    }
    const c = blendCompanions(mm);
    return [
      c.light ? { c: c.light, o: c.lightOwned } : { dash: 1 },
      c.dark ? { c: c.dark, o: c.darkOwned } : { dash: 1 },
    ];
  };
  const buyW = function () {
    g.font = '600 ' + PX(7) + 'px ' + LFONT;
    return PX(3) + g.measureText('buy').width;
  };
  const cellW = function (e) {
    if (!e) return 0;
    if (e.t) {
      g.font = '500 ' + PX(8) + 'px ' + LFONT;
      return g.measureText(e.t).width;
    }
    if (e.dash) {
      g.font = '500 ' + PX(8.5) + 'px ' + LFONT;
      return g.measureText('—').width;
    }
    g.font = '700 ' + PX(8.5) + 'px ' + LFONT;
    return (
      PX(14) +
      g.measureText(e.coat ? '2nd coat of ' + tagOf(e.coat) + e.coat.code : tagOf(e.c) + e.c.code).width +
      (e.c && !e.o ? buyW() : 0)
    );
  };
  const hdrLt = withShade ? 'H  HIGHLIGHT' : 'LIGHTER',
    hdrDk = withShade ? 'S  SHADOW' : 'DARKER';
  if (withBlend) {
    g.font = '700 ' + PX(7) + 'px ' + LFONT;
    let wl = g.measureText(hdrLt).width,
      wd = g.measureText(hdrDk).width;
    rows.forEach(function (r) {
      // (tones that differ by zone: none on the colour's own line, a line for each zone under it)
      const tl = r.tones || [];
      r.cells = tl.length > 1 ? [null, null] : cellsOf(r.m, tl.length ? tl[0].t : null);
      r.subs =
        tl.length > 1
          ? tl.map(function (x) {
              return { x: x, cells: cellsOf(r.m, x.t) };
            })
          : [];
      [r.cells]
        .concat(
          r.subs.map(function (q) {
            return q.cells;
          }),
        )
        .forEach(function (c) {
          wl = Math.max(wl, cellW(c[0]));
          wd = Math.max(wd, cellW(c[1]));
        });
    });
    const cl = function (v, a, b) {
        return Math.max(a, Math.min(b, v));
      },
      ltW = cl(wl + PX(12), PX(50), PX(112)),
      dkW = cl(wd + PX(4), PX(50), PX(110));
    X.dk = cw - dkW;
    X.lt = X.dk - ltW;
    X.cnt = X.lt - PX(18);
    X.ltW = ltW - PX(8);
    X.dkW = dkW;
  }
  let colTop = side ? pvTop : pvy + f2.h + PX(18),
    y = colTop,
    col = side ? 1 : 0,
    pageBot = pageBot0;
  const colX = () => m + col * (cw + gap);
  function header() {
    const x = colX();
    g.fillStyle = '#8a8a8a';
    g.font = '700 ' + PX(7) + 'px ' + LFONT;
    g.textAlign = 'right';
    g.fillText('ORDER', x + X.ord, y + PX(10));
    g.textAlign = 'left';
    if (keyNums) {
      g.textAlign = 'right';
      g.fillText('NO.', x + lead + nw - PX(6), y + PX(10));
      g.textAlign = 'left';
    }
    g.fillText(withShade ? 'B  MARKER' : 'MARKER', x + X.code - (withShade ? PX(9) : 0), y + PX(10));
    g.textAlign = 'right';
    g.fillText('SECTIONS', x + X.cnt, y + PX(10));
    g.textAlign = 'left';
    if (withBlend) {
      if (!withShade || shadeMode === 'full') g.fillText(hdrLt, x + X.lt, y + PX(10));
      g.fillText(hdrDk, x + X.dk, y + PX(10));
    }
    g.strokeStyle = '#ddd';
    g.lineWidth = PX(0.5);
    g.beginPath();
    g.moveTo(x, y + hdrH - PX(2));
    g.lineTo(x + cw, y + hdrH - PX(2));
    g.stroke();
    y += hdrH;
  }
  function newPage(noHdr) {
    pg = pdfPage();
    g = pg.g;
    pages.push(pg);
    g.fillStyle = '#111';
    g.font = '700 ' + PX(12) + 'px ' + LFONT;
    g.fillText('Colour key (continued)', m, m + PX(10));
    colTop = m + PX(24);
    y = colTop;
    col = 0;
    pageBot = pg.h - m - PX(18);
    if (!noHdr) header();
  }
  function need(h, noHdr) {
    if (y + h <= pageBot) return false;
    if (col < cols - 1) {
      col++;
      y = colTop;
      header();
    } else newPage(noHdr);
    return true;
  }
  header();
  // one lighter/darker cell, cut to its column
  function cell(e, x, w) {
    if (!e) return;
    const ty = y + PX(12.5);
    if (e.t) {
      g.fillStyle = '#999';
      g.font = '500 ' + PX(8) + 'px ' + LFONT;
      g.fillText(pdfTrunc(g, e.t, w), x, ty);
      return;
    }
    if (e.dash) {
      g.fillStyle = '#aaa';
      g.font = '500 ' + PX(8.5) + 'px ' + LFONT;
      g.fillText('—', x, ty);
      return;
    }
    pdfSwatch(g, x, y + PX(4), PX(10), e.coat ? 'rgb(' + e.S.join(',') + ')' : e.c.hex, e.coat ? true : e.o);
    if (e.coat) {
      g.fillStyle = '#111';
      g.font = '700 ' + PX(8.5) + 'px ' + LFONT;
      g.fillText(pdfTrunc(g, '2nd coat of ' + tagOf(e.coat) + e.coat.code, w - PX(14)), x + PX(14), ty);
      return;
    }
    const bu = e.o ? 0 : buyW();
    g.fillStyle = '#111';
    g.font = '700 ' + PX(8.5) + 'px ' + LFONT;
    const s = pdfTrunc(g, tagOf(e.c) + e.c.code, w - PX(14) - bu),
      tw = g.measureText(s).width;
    g.fillText(s, x + PX(14), ty);
    if (!e.o) {
      g.fillStyle = '#b7791f';
      g.font = '600 ' + PX(7) + 'px ' + LFONT;
      g.fillText('buy', x + PX(17) + tw, ty);
    }
  }
  const want = {};
  let lastFam = null;
  rows.forEach(function (r) {
    if (r.fam !== lastFam) {
      need(famH + rowH);
      const x = colX();
      g.fillStyle = '#555';
      g.font = '700 ' + PX(8) + 'px ' + LFONT;
      g.fillText(pdfTrunc(g, r.fam.toUpperCase(), cw), x, y + PX(14));
      y += famH;
      lastFam = r.fam;
    }
    need(rowH);
    const x = colX(),
      mm = r.m;
    // a box to tick, and where it comes in colouring order
    g.strokeStyle = '#9a9a9a';
    g.lineWidth = PX(0.7);
    g.strokeRect(x + PX(1), y + PX(4.5), PX(9), PX(9));
    g.fillStyle = '#8a8a8a';
    g.font = '600 ' + PX(8) + 'px ' + LFONT;
    g.textAlign = 'right';
    g.fillText(pdfOrd(r.ord), x + X.ord, y + PX(12.5));
    g.textAlign = 'left';
    if (keyNums) {
      // (v305: drawn as the numbers on the colouring page are, their weight, colour and white edge, so the two are
      // seen to go together; ORDER beside it stays a grey "5th")
      const fsN = PX(9.5);
      g.font = LS.w + ' ' + fsN + 'px ' + LFONT;
      g.textAlign = 'right';
      g.lineJoin = 'round';
      g.lineWidth = Math.max(1, fsN * LS.swk);
      g.strokeStyle = '#fff';
      g.strokeText(String(num[mm.mkey]), x + lead + nw - PX(6), y + PX(12.5));
      g.fillStyle = LS.fill;
      g.fillText(String(num[mm.mkey]), x + lead + nw - PX(6), y + PX(12.5));
      g.textAlign = 'left';
    }
    pdfSwatch(g, x + X.sw, y + PX(3.5), sw, mm.hex, true);
    if (!oneB) {
      // (v306: a code in the guide in both brands has its letter in a filled tag, as on the labels)
      if (sameOf(mm)) {
        const fsT = PX(9.5);
        g.font = '700 ' + fsT * TAG.font + 'px ' + LFONT;
        const gw = g.measureText(bTag(mm.brand)).width + fsT * TAG.pad * 2;
        g.textBaseline = 'middle';
        drawTag(
          g,
          bTag(mm.brand),
          false,
          x + X.tag - fsT * TAG.pad,
          y + PX(9.5),
          gw,
          fsT,
          Object.assign({}, TAG, TAG_PRINT),
          true,
        );
        g.textAlign = 'left';
        g.textBaseline = 'alphabetic';
      } else {
        g.fillStyle = '#888';
        g.font = '700 ' + PX(7) + 'px ' + LFONT;
        g.fillText(bTag(mm.brand), x + X.tag, y + PX(12.5));
      }
    }
    g.fillStyle = '#111';
    g.font = '700 ' + PX(9.5) + 'px ' + LFONT;
    g.fillText(pdfTrunc(g, mm.code, X.name - X.code - PX(4)), x + X.code, y + PX(12.5));
    const nmW = X.cnt - X.name - PX(30);
    if (nmW > PX(16)) {
      g.fillStyle = '#333';
      g.font = '400 ' + PX(9) + 'px ' + LFONT;
      g.fillText(pdfTrunc(g, mm.name || '', nmW), x + X.name, y + PX(12.5));
    }
    g.fillStyle = '#777';
    g.font = '500 ' + PX(8.5) + 'px ' + LFONT;
    g.textAlign = 'right';
    g.fillText(String(r.n), x + X.cnt, y + PX(12.5));
    g.textAlign = 'left';
    if (withBlend) {
      cell(r.cells[0], x + X.lt, X.ltW);
      cell(r.cells[1], x + X.dk, X.dkW);
    }
    if (withShade) {
      r.tones.forEach(function (q) {
        const t = q.t;
        if (t.wantLight) want[t.wantLight.mkey] = t.wantLight;
        if (t.wantDark) want[t.wantDark.mkey] = t.wantDark;
      });
    } else if (withBlend) {
      const c = blendCompanions(mm);
      if (c.light && !c.lightOwned) want[c.light.mkey] = c.light;
      if (c.dark && !c.darkOwned) want[c.dark.mkey] = c.dark;
    }
    // tones that differ by zone: a line under it for each zone, "in Main", "in Bell", with its highlight and shadow
    (r.subs || []).forEach(function (q) {
      y += rowH;
      if (need(rowH)) {
        // (a line that starts a column or a page says whose it is)
        g.fillStyle = '#111';
        g.font = '700 ' + PX(9.5) + 'px ' + LFONT;
        g.fillText(pdfTrunc(g, mm.code, X.name - X.code - PX(4)), colX() + X.code, y + PX(12.5));
      }
      const xs = colX(),
        ids = zoneIds().filter(function (id) {
          return q.x.z[id];
        });
      // (one zone: in its colour on the key's picture)
      g.fillStyle = ids.length === 1 ? pdfZoneCol(ids[0]) : '#666';
      g.font = 'italic 600 ' + PX(8.5) + 'px ' + LFONT;
      g.fillText(
        pdfTrunc(
          g,
          'in ' +
            ids
              .map(function (id) {
                return zoneName(id);
              })
              .join(', '),
          X.lt - X.name - PX(8),
        ),
        xs + X.name,
        y + PX(12.5),
      );
      cell(q.cells[0], xs + X.lt, X.ltW);
      cell(q.cells[1], xs + X.dk, X.dkW);
    });
    g.strokeStyle = '#f0f0f0';
    g.lineWidth = PX(0.4);
    g.beginPath();
    g.moveTo(colX(), y + rowH);
    g.lineTo(colX() + cw, y + rowH);
    g.stroke();
    y += rowH;
  });
  // ---- shopping list for missing blend shades
  const wk = Object.keys(want);
  if (withBlend && wk.length) {
    col = 0;
    y += PX(14);
    need(PX(40), true);
    const x0 = m;
    g.fillStyle = '#111';
    g.font = '700 ' + PX(10) + 'px ' + LFONT;
    g.fillText(
      pdfTrunc(
        g,
        (withShade ? 'For richer shading, add ' : 'To complete every blend, add ') +
          wk.length +
          ' marker' +
          (wk.length === 1 ? '' : 's') +
          ':',
        bw,
      ),
      x0,
      y + PX(10),
    );
    y += PX(18);
    let x = x0;
    wk.forEach(function (k) {
      const mm = want[k];
      g.font = '600 ' + PX(8.5) + 'px ' + LFONT;
      const t = pdfTrunc(g, tagOf(mm) + mm.code + (mm.name ? ' ' + mm.name : ''), bw - PX(28)),
        w = PX(14) + g.measureText(t).width + PX(14);
      if (x + w > m + bw) {
        x = x0;
        y += PX(16);
      }
      if (need(PX(16), true)) x = x0;
      pdfSwatch(g, x, y, PX(10), mm.hex, false);
      g.fillStyle = '#111';
      g.fillText(t, x + PX(14), y + PX(8.5));
      x += w;
    });
  }
  // ---- footers
  if (dry) return pages.length;
  pages.forEach(function (P, i) {
    const gg = P.g,
      fy = P.h - P.m + PX(6),
      mk = 'Made with Marker Studio',
      pn = '  ·  ' + (i + 1) + ' / ' + pages.length;
    gg.fillStyle = '#9a9a9a';
    gg.font = '500 ' + PX(7.5) + 'px ' + LFONT;
    gg.textAlign = 'left';
    gg.fillText(mk, P.m, fy);
    gg.textAlign = 'right';
    gg.fillText(
      pdfTrunc(
        gg,
        nm,
        Math.min(PX(260), P.w - 2 * P.m - gg.measureText(mk).width - gg.measureText(pn).width - PX(16)),
      ) + pn,
      P.w - P.m,
      fy,
    );
    gg.textAlign = 'left';
  });
  if (_pdfRec) return pages;
  return pages.map(function (P) {
    return P.c;
  });
}
// Hand a finished file over (handOver in core.js: the share sheet on a phone, a download on a computer, a toast with
// a Share button when building it took so long that the tap no longer counts). `say` reports the outcome: savedMsg
// once downloaded, null once shared or the share sheet was closed; by default in the guide's status line.
function shareOrSave(blob, fname, title, what, savedMsg, say) {
  say =
    say ||
    function (m) {
      note(m == null ? metaText() : m);
    };
  handOver(blob, fname, { title: title, what: what }).then(function (r) {
    say(
      r === 'download'
        ? savedMsg
        : r === false
          ? 'Couldn\u2019t save the ' + what + ' on this device.'
          : null,
    );
  });
}
// the PDF writer, paper sizes (shared with Print, remembered as ms-paper) and share-or-save, for the Markers
// screen's swatch chart (SF.pdfKit)
const pdfKit = {
  toPDF: canvasesToPDF,
  PAPERS: PAPERS,
  PAPER_OPTS: PRINT_OPTS[2][3],
  DPI: PDPI,
  FONT: LFONT,
  paper: function () {
    return paper;
  },
  setPaper: function (v) {
    printOptSet('paper', v);
  },
  share: shareOrSave,
};
async function exportPDF() {
  // (one at a time: the sheet can be closed and opened again while one is being written, v304)
  if (!assignData || exportPDF.busy) return;
  exportPDF.busy = 1;
  _pdfProg = '';
  try {
    await _exportPDF();
  } finally {
    exportPDF.busy = 0;
    _pdfProg = '';
    // (the button of a sheet opened again meanwhile, back as it was)
    const w = _pdfWait;
    _pdfWait = null;
    if (w && w.b.isConnected) {
      w.b.innerHTML = w.h;
      w.b.disabled = false;
    }
  }
}
// a Print sheet opened while a PDF is still being written: its button says so until it is done (v304), with the page
// it's on (v307.1: "Page 2 of 4…", as the sheet it was started from says; "Preparing…" before the first)
let _pdfWait = null,
  _pdfProg = '';
function printWait() {
  const b = document.getElementById('sfPDF');
  if (!exportPDF.busy || !b) return;
  _pdfWait = { b: b, h: b.innerHTML };
  b.textContent = _pdfProg || 'Preparing\u2026';
  b.disabled = true;
}
async function _exportPDF() {
  note('Preparing PDF…');
  var _b = document.getElementById('sfPDF'),
    // (its icon too: the words and the picture back as they were, v300)
    _o = _b ? _b.innerHTML : '';
  if (_b) {
    _b.textContent = 'Preparing…';
    _b.disabled = true;
  }
  // (a moment for "Preparing…" to show: the pages are laid out in one go, v287)
  await new Promise(function (r) {
    setTimeout(r, 30);
  });
  try {
    const P = PAPERS[paper] || PAPERS.letter,
      // (v307) each page drawn in turn, the button saying which (the Print sheet's, opened again meanwhile too)
      blob = await canvasesToPDF(buildPDFPages(false, true), P[0], P[1], true, function (i, n) {
        if (n > 1) _pdfProg = 'Page ' + i + ' of ' + n + '\u2026';
        const b = document.getElementById('sfPDF');
        if (b && b.disabled && _pdfProg) b.textContent = _pdfProg;
      });
    const fname =
      ((curName || 'colour-guide')
        .replace(/[^a-z0-9]+/gi, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase()
        .slice(0, 80) || 'colour-guide') +
      (pdfWhat === 'strip' ? '-test-strip' : '') +
      '.pdf';
    shareOrSave(blob, fname, curName || 'Colouring guide', 'PDF', 'PDF downloaded.');
  } catch (e) {
    const sm = sheetOpen() && document.getElementById('sfPrSum');
    if (sm) {
      sm.classList.add('empty');
      sm.textContent = 'Couldn’t build the PDF. Try again.';
    } else note('Couldn’t build the PDF.');
  }
  if (_b) {
    _b.innerHTML = _o;
    _b.disabled = false;
  }
}
// when colouring started and finished: the first tick's time, and the time the last section was ticked (unticking one
// takes the finish away)
function progStamp() {
  if (!assignData || !colored || progAt.u) return;
  const now = Date.now();
  if (!progAt.s && progressCount()) progAt.s = now;
  if (pageDone()) {
    if (!progAt.e) progAt.e = now;
  } else progAt.e = 0;
}
// (v307) how many markers a shaded guide's highlights and shadows take beyond its own colours: none with shading off.
// "16 markers" said only the colours when shading used 45, on Page finished, Reveal's card, Home and the PDF.
function shadeExtra() {
  if (!assignData || !shadeOn()) return 0;
  const base = {},
    ex = {};
  assignData.order.forEach(function (l) {
    base[assignData.assign[l].mkey] = 1;
  });
  assignData.order.forEach(function (l) {
    const t = shadeSec(l);
    if (!t) return;
    [t.light, t.dark].forEach(function (m) {
      if (m && m.mkey && !base[m.mkey]) ex[m.mkey] = 1;
    });
  });
  return Object.keys(ex).length;
}
// "16 markers", "16 Ohuhu markers", or with shading "16 markers + 29 for shading" (x: shadeExtra(), when known)
function mkCount(n, brand, x) {
  if (x == null) x = shadeExtra();
  return (
    n +
    ' ' +
    (brand ? brand + ' ' : '') +
    (n === 1 ? 'marker' : 'markers') +
    (x > 0 ? ' + ' + x + ' for shading' : '')
  );
}
// "166 sections · 24 markers · started 12 Sep, finished today", for the page finished
function finishLine() {
  const ord = assignData.order,
    mk = {};
  ord.forEach(function (l) {
    mk[assignData.assign[l].mkey] = 1;
  });
  const nm = Object.keys(mk).length,
    day = function (ms) {
      const d = new Date(ms),
        t = new Date(),
        y = new Date(t.getFullYear(), t.getMonth(), t.getDate() - 1);
      if (d.toDateString() === t.toDateString()) return 'today';
      if (d.toDateString() === y.toDateString()) return 'yesterday';
      return d.toLocaleDateString(
        'en-GB',
        d.getFullYear() === t.getFullYear()
          ? { day: 'numeric', month: 'short' }
          : { day: 'numeric', month: 'short', year: 'numeric' },
      );
    };
  let t = ord.length + ' section' + (ord.length === 1 ? '' : 's') + ' \u00b7 ' + mkCount(nm);
  if (progAt.s && progAt.e) {
    const a = day(progAt.s),
      b = day(progAt.e);
    t +=
      a === b
        ? ' \u00b7 coloured ' + (/^\d/.test(b) ? 'on ' : '') + b
        : ' \u00b7 started ' + a + ', finished ' + b;
  }
  return t;
}
// (v307) what a screen reader hears as the page is finished, in Focus mode and in the list alike (they differed)
function finishSay() {
  return 'Page finished. ' + finishLine() + '. Reveal & share is in the bar at the bottom.';
}
function checkComplete() {
  progStamp();
  if (celebrated || sfmode !== 'color' || !assignData) return;
  const ord = assignData.order;
  let d = 0;
  for (let i = 0; i < ord.length; i++) if (colored[ord[i]]) d++;
  if (ord.length && d >= ord.length) {
    celebrated = true;
    celebrate();
  }
}
// Finished: in focus mode Reveal & share is in its bottom bar, which says "Page finished" with what was coloured; in
// the list the "Page complete!" banner (with its Reveal & share) is brought into view just under the pinned block
// instead, with no toast over the open row. (v306: Focus mode's toast went, as it said what the bar says over the
// art; a screen reader hears it instead, and short marker strokes fly up from the progress bar, not confetti)
function celebrate() {
  try {
    if (navigator.vibrate) navigator.vibrate([12, 40, 12]);
  } catch (_) {}
  // (the whole page, in its colours: the marker row that was open closes, and a zoom from Find next goes back)
  if (!focus && sfmode === 'color') {
    hlKey = null;
    hlZone = null;
    // (any outline goes: Find next's, and an open row's, which could be left drawn after Focus mode, v300)
    _fnOl = false;
    outlineSecs(null);
    resetZoom();
    renderGuide();
    renderAlong();
  }
  const rm = reducedMotion();
  if (focus) {
    sayLive(finishSay());
    const pb = document.getElementById('sfFocProg');
    if (!rm) markerStrokes(pb && pb.offsetParent !== null ? pb.getBoundingClientRect() : null);
    return;
  }
  if (sfmode !== 'color')
    note(ic('sparkles') + ' Finished \u2014 every section coloured! Tap Reveal &amp; share to show it off.');
  else requestAnimationFrame(doneInView);
  if (!rm) confettiBurst();
}
// (v306) Focus mode's finish: up to STROKES_MAX short rounded strokes in the guide's own marker colours, flicked up
// from the progress bar (r: its box on the screen; the foot of the screen without one) and falling away, about 1.6 s.
// Plain strokes: no blend modes or shadows, which are slow in Safari.
const STROKES_MAX = 80;
function markerStrokes(r) {
  const W0 = window.innerWidth,
    H0 = window.innerHeight,
    dpr = Math.min(2, window.devicePixelRatio || 1),
    cv = document.createElement('canvas'),
    x0 = r ? r.left : W0 * 0.1,
    w0 = r ? r.width : W0 * 0.8,
    y0 = r ? r.top + r.height / 2 : H0 - 40;
  cv.width = W0 * dpr;
  cv.height = H0 * dpr;
  cv.className = 'sfconfetti sfstrokes';
  document.body.appendChild(cv);
  const g = cv.getContext('2d');
  g.scale(dpr, dpr);
  g.lineCap = 'round';
  const pal = [],
    seen = {};
  if (assignData)
    for (const l in assignData.assign) {
      const hx = assignData.assign[l].hex;
      if (!seen[hx]) {
        seen[hx] = 1;
        pal.push(hx);
      }
    }
  if (!pal.length) pal.push('#7c5cff', '#ffd84a', '#3f7d4e', '#ff5c8a');
  const N = Math.min(STROKES_MAX, Math.max(24, Math.round(w0 / 6))),
    ps = [];
  for (let i = 0; i < N; i++) {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.3,
      v = 8 + Math.random() * 9;
    ps.push({
      x: x0 + w0 * Math.random(),
      y: y0,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      len: 10 + Math.random() * 12,
      lw: 4 + Math.random() * 4,
      c: pal[(Math.random() * pal.length) | 0],
    });
  }
  markerStrokes.n = N;
  const start = performance.now();
  let last = start;
  (function frame(t) {
    const dt = Math.min(2.2, (t - last) / 16.67) || 1,
      age = (t - start) / 1600;
    last = t;
    g.clearRect(0, 0, W0, H0);
    g.globalAlpha = Math.max(0, Math.min(1, 1.6 - age * 1.6));
    let alive = false;
    for (const p of ps) {
      p.vy += 0.32 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.y < H0 + 30) alive = true;
      const sp = Math.hypot(p.vx, p.vy) || 1;
      g.strokeStyle = p.c;
      g.lineWidth = p.lw;
      g.beginPath();
      g.moveTo(p.x, p.y);
      g.lineTo(p.x - (p.vx / sp) * p.len, p.y - (p.vy / sp) * p.len);
      g.stroke();
    }
    if (alive && age < 1) requestAnimationFrame(frame);
    else cv.remove();
  })(start);
}
// (said after the tick that finished it, which the list announces first)
function doneInView() {
  const dn = document.getElementById('sfDone');
  if (!dn || dn.offsetParent === null || focus) return;
  // (the open row's second check would scroll back to it: 83-along.js)
  _revStop();
  sayLive(finishSay());
  const r = dn.getBoundingClientRect(),
    bar = barEl(),
    top =
      safeTop() +
      (geo.side ? 0 : parseFloat(document.documentElement.style.getPropertyValue('--pinH')) || 0) +
      6,
    bot = (bar ? bar.getBoundingClientRect().top : window.innerHeight) - 6;
  dn.classList.remove('flash');
  void dn.offsetWidth;
  dn.classList.add('flash');
  if (r.top >= top && r.bottom <= bot) return;
  const y = Math.max(0, Math.round(window.scrollY + r.top - top));
  try {
    window.scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
  } catch (_) {
    window.scrollTo(0, y);
  }
}
function confettiBurst() {
  const dpr = Math.min(2, window.devicePixelRatio || 1),
    W0 = window.innerWidth,
    H0 = window.innerHeight,
    cv = document.createElement('canvas');
  cv.width = W0 * dpr;
  cv.height = H0 * dpr;
  cv.className = 'sfconfetti';
  document.body.appendChild(cv);
  const g = cv.getContext('2d');
  g.scale(dpr, dpr);
  const pal = [];
  if (assignData) {
    const seen = {};
    for (const l in assignData.assign) {
      const hx = assignData.assign[l].hex;
      if (!seen[hx]) {
        seen[hx] = 1;
        pal.push(hx);
      }
    }
  }
  if (!pal.length) {
    pal.push('#7c5cff', '#b45cff', '#ffd84a', '#3f7d4e', '#ff5c8a');
  }
  const N = 150,
    ps = [];
  for (let i = 0; i < N; i++)
    ps.push({
      x: W0 * (0.15 + 0.7 * Math.random()),
      y: H0 * 0.5 + (Math.random() * 30 - 15),
      vx: (Math.random() - 0.5) * 11,
      vy: -9 - Math.random() * 10,
      gr: 0.3 + Math.random() * 0.12,
      r: 4 + Math.random() * 5,
      rot: Math.random() * 6.28,
      vr: (Math.random() - 0.5) * 0.45,
      c: pal[(Math.random() * pal.length) | 0],
      sq: Math.random() < 0.55,
    });
  const start = performance.now();
  let last = start;
  (function frame(t) {
    const dt = Math.min(2.2, (t - last) / 16.67) || 1;
    last = t;
    g.clearRect(0, 0, W0, H0);
    let alive = false;
    for (const p of ps) {
      p.vy += p.gr * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.995;
      p.rot += p.vr * dt;
      if (p.y < H0 + 24) alive = true;
      g.save();
      g.translate(p.x, p.y);
      g.rotate(p.rot);
      g.fillStyle = p.c;
      if (p.sq) g.fillRect(-p.r, -p.r * 0.6, p.r * 2, p.r * 1.2);
      else {
        g.beginPath();
        g.arc(0, 0, p.r, 0, 6.283);
        g.fill();
      }
      g.restore();
    }
    if (alive && t - start < 2800) requestAnimationFrame(frame);
    else cv.remove();
  })(start);
}
function exportImage() {
  if (!assignData || exportImage.busy) return;
  exportImage.busy = 1;
  note('Preparing image\u2026');
  const _b = document.getElementById('sfExport'),
    // (its icon too: the words and the picture back as they were, v300)
    _o = _b ? _b.innerHTML : '';
  if (_b) {
    _b.textContent = 'Preparing\u2026';
    _b.disabled = true;
  }
  const done = function () {
    exportImage.busy = 0;
    if (_b) {
      _b.innerHTML = _o;
      _b.disabled = false;
    }
  };
  setTimeout(function () {
    // (anything going wrong puts the button back: before, it stayed on Preparing… until the app was reloaded, v304)
    let xc = null;
    const codes = exCodesNow();
    try {
      if (!assignData) throw new Error('no guide');
      xc = buildExportCanvas(false, !codes);
    } catch (e) {
      freeCanvas(xc);
      done();
      note('Couldn’t export the image.');
      return;
    }
    // (v305) without the codes it's the picture to show, not a guide: framed as Reveal's card is (89-show.js), twice
    // its size so the art keeps its detail
    (codes ? Promise.resolve() : showFonts()).then(function () {
      if (!codes) {
        let card = null;
        try {
          card = buildShowCard(xc, xc.width / W, 2160, 2700);
        } catch (_) {}
        freeCanvas(xc);
        xc = card;
        if (!xc) {
          done();
          note('Couldn’t export the image.');
          return;
        }
      }
      exportBlob(xc, codes);
    });
  }, 30);
  function exportBlob(xc, codes) {
    pngBlob(xc).then(function (blob) {
      done();
      if (!blob) {
        note('Couldn’t export the image.');
        return;
      }
      shareOrSave(
        blob,
        codes ? 'colour-guide.png' : 'marker-studio-picture.png',
        curName || (codes ? 'Colouring guide' : 'My colouring'),
        'image',
        'Image downloaded.',
      );
    });
  }
}
// A canvas as a PNG file (a Blob, or null), its canvas then handed back (v296). v307: encoded in the worker (03-jobs)
// where it can be, as Safari's engine holds the page up for over a second encoding the saved image: its pixels are
// sent, and checked there, so the file has the same pixels. Where it can't, or that fails, encoded here as before.
function pngBlob(xc) {
  const here = function () {
    return new Promise(function (res) {
      try {
        xc.toBlob(function (b) {
          freeCanvas(xc);
          res(b);
        }, 'image/png');
      } catch (_) {
        freeCanvas(xc);
        res(null);
      }
    });
  };
  if (!JOBS.on || typeof OffscreenCanvas === 'undefined') return here();
  let px = null;
  try {
    px = xc.getContext('2d').getImageData(0, 0, xc.width, xc.height).data;
  } catch (_) {
    return here();
  }
  return JOBS.run('png', { buf: px.buffer, w: xc.width, h: xc.height }, [px.buffer]).then(function (b) {
    freeCanvas(xc);
    return b;
  }, here);
}
// ---- Test strip (v282): Share › Print › Pages › Test strip. A page of boxes to try this guide's markers on the
// paper you'll colour on, since paper changes a marker's colour a lot and the app only predicts a layered tone or a
// glaze: one row per line of the key, numbered as the key is (7a, 7b where zones shade a marker differently). Each
// row: a box for the base once and twice (once per marker), and with shading a long box in thirds for its highlight,
// base and shadow as the guide lays them (with blend companions: lighter, the colour, darker; only markers you own).
// Under each box a thin bar printed in the screen's colour, a little apart so ink doesn't creep into it. The swatch
// chart's corner marks (the bottom-right one hollow) and a fixed millimetre layout, so a photo of it could be read
// back later. dry: just how many pages.
function testStripPages(dry, lazy) {
  const sh = shadeUse().on ? shadePrep(false) : null,
    withShade = !!sh,
    withBlend = !withShade && !!pdfBlend,
    ramp = withShade || withBlend,
    rows = pdfKeyRows(),
    nm = curName || 'Colouring guide';
  pdfS = paper === 'a5' || paper === 'half' ? 0.84 : 1;
  const zOrd = zoneIds(),
    zFirst = function (x) {
      for (let i = 0; i < zOrd.length; i++) if (x.z[zOrd[i]]) return i;
      return 99;
    },
    rec = [];
  rows.forEach(function (r, i) {
    const no = String(i + 1);
    if (withShade) {
      const tr = toneRows(r.secs).sort(function (a, b) {
        return zFirst(a) - zFirst(b);
      });
      if (!tr.length) {
        rec.push({ m: r.m, no: no, coats: true, flat: true });
        return;
      }
      tr.forEach(function (x, j) {
        const t = x.t;
        rec.push({
          m: r.m,
          no: tr.length > 1 ? no + String.fromCharCode(97 + j) : no,
          coats: j === 0,
          zones:
            tr.length > 1
              ? zOrd.filter(function (id) {
                  return x.z[id];
                })
              : null,
          L: t.light ? { c: t.light } : t.paper ? { paper: true } : null,
          S: t.dark ? { c: t.dark, glaze: t.glaze } : t.noShadow ? null : { coat: true },
          gL: t.L,
          gB: t.B,
          gS: t.S,
        });
      });
    } else if (withBlend) {
      const c = blendCompanions(r.m);
      rec.push({
        m: r.m,
        no: no,
        coats: true,
        L: c.light && c.lightOwned ? { c: c.light } : null,
        S: c.dark && c.darkOwned ? { c: c.dark } : null,
        gL: c.light && c.lightOwned ? hexRgb(c.light.hex) : null,
        gB: hexRgb(r.m.hex),
        gS: c.dark && c.darkOwned ? hexRgb(c.dark.hex) : null,
      });
    } else rec.push({ m: r.m, no: no, coats: true });
  });
  // (brand letters only when the strip mixes brands)
  const bs = {};
  rec.forEach(function (x) {
    bs[x.m.brand] = 1;
    [x.L, x.S].forEach(function (e) {
      if (e && e.c) bs[e.c.brand] = 1;
    });
  });
  const oneB = Object.keys(bs).length === 1,
    tag = function (c) {
      return oneB ? c.code : bTag(c.brand) + ' ' + c.code;
    };
  // the page in millimetres
  const pap = paper,
    P0 = PAPERS[pap] || PAPERS.letter,
    pw = (P0[0] / 72) * 25.4,
    ph = (P0[1] / 72) * 25.4,
    small = pw < 160,
    mg = small ? 9 : 12,
    R = 4,
    cols = ramp ? (small ? 1 : 2) : small ? 2 : 3,
    gap = 6,
    cw = (pw - 2 * mg - gap * (cols - 1)) / cols,
    box = small ? 12 : 13,
    rowH = box + 8,
    bot = ph - mg - R - 3,
    K0 = Math.round((P0[0] / 72) * PDPI) / pw;
  const how = withShade
    ? 'Colour it on the paper you’ll colour the page on, and let it dry before you compare. Long box: H over all of it (nothing where it says paper or none), B over the right two thirds, S over the last third while wet, then soften the edges (S “over B”: once B is dry). Left box: B once, then again on its right half. The bars are the colours on screen, roughly.'
    : withBlend
      ? 'Colour it on the paper you’ll colour the page on, and let it dry before you compare. Long box: the lighter marker on the left, the colour in the middle, the darker on the right, blended while wet. Left box: once, then again on its right half. The bars are the colours on screen, roughly.'
      : 'Colour it on the paper you’ll colour the page on, and let it dry before you compare: each box once, then again on its right half. The bar under it is the colour on screen, roughly.';
  // the how-to, wrapped word by word to the page's width (measured as it will be drawn), and the room it takes
  const mg0 = document.createElement('canvas').getContext('2d'),
    lines = [];
  mg0.font = '500 ' + ((7 * PDPI) / 72).toFixed(1) + 'px ' + LFONT;
  let ln = '';
  how.split(' ').forEach(function (w) {
    const t = ln ? ln + ' ' + w : w;
    if (ln && mg0.measureText(t).width > (pw - 2 * mg) * K0) {
      lines.push(ln);
      ln = w;
    } else ln = t;
  });
  if (ln) lines.push(ln);
  const top = mg + R + 4.5 + lines.length * 3.3 + 8,
    perCol = Math.max(1, Math.floor((bot - top) / rowH));
  // where each row goes: a marker's rows (7a, 7b) kept in one column when they fit in one
  const at = [];
  let pc = 0,
    pr = 0;
  rec.forEach(function (x, i) {
    if (x.coats) {
      let n = 1;
      while (i + n < rec.length && !rec[i + n].coats) n++;
      if (pr && pr + n > perCol && n <= perCol) {
        pc++;
        pr = 0;
      }
    }
    if (pr >= perCol) {
      pc++;
      pr = 0;
    }
    at.push({ p: Math.floor(pc / cols), c: pc % cols, r: pr });
    pr++;
  });
  const np = Math.max(1, at.length ? at[at.length - 1].p + 1 : 1);
  if (dry) return np;
  const out = [];
  for (let pi = 0; pi < np; pi++) out.push(lazy ? stripPage.bind(null, pi) : stripPage(pi));
  return out;
  function stripPage(pi) {
    const pg = pdfPage(pap),
      g = pg.g,
      K = pg.w / pw,
      M = function (v) {
        return v * K;
      },
      F = function (w, pt) {
        g.font = w + ' ' + ((pt * PDPI) / 72).toFixed(1) + 'px ' + LFONT;
      },
      rgb = function (c) {
        return 'rgb(' + c.map(Math.round).join(',') + ')';
      };
    // corner marks, as the swatch chart's
    [
      [mg, mg],
      [pw - mg - R, mg],
      [mg, ph - mg - R],
      [pw - mg - R, ph - mg - R],
    ].forEach(function (p, j) {
      g.fillStyle = '#000';
      g.fillRect(M(p[0]), M(p[1]), M(R), M(R));
      if (j === 3) {
        g.fillStyle = '#fff';
        g.fillRect(M(p[0] + 1), M(p[1] + 1), M(R - 2), M(R - 2));
      }
    });
    g.fillStyle = '#111';
    F('700', 10.5);
    g.fillText(pdfTrunc(g, 'Test strip · ' + nm, M(pw - 2 * mg - 2 * R - 6)), M(mg + R + 3), M(mg + R - 0.3));
    g.fillStyle = '#555';
    F('500', 7);
    lines.forEach(function (t, i) {
      g.fillText(t, M(mg), M(mg + R + 4.5 + i * 3.3));
    });
    g.fillStyle = '#333';
    F('500', 7.5);
    g.fillText('Paper: ______________________     Date: ____________', M(mg), M(top - 4.5));
    g.fillStyle = '#888';
    F('500', 7);
    g.fillText('Made with Marker Studio', M(mg + R + 3), M(ph - mg - 0.5));
    g.textAlign = 'right';
    g.fillText('Page ' + (pi + 1) + ' of ' + np, M(pw - mg - R - 3), M(ph - mg - 0.5));
    g.textAlign = 'left';
    rec.forEach(function (x, k) {
      if (at[k].p !== pi) return;
      const c = at[k].c,
        X0 = mg + c * (cw + gap),
        Y0 = top + at[k].r * rowH,
        lw = ramp ? 19 : 0,
        cb = ramp ? box : Math.min(cw - 26, 26),
        bx = X0 + lw;
      // the label: its number in the key, the marker, and the zone(s) whose tones these are
      const lx = ramp ? X0 : bx + cb + 2,
        lwid = ramp ? lw - 1.5 : cw - cb - 3;
      g.fillStyle = '#8a8a8a';
      F('700', 6.5);
      g.fillText(x.no, M(lx), M(Y0 + 2.6));
      g.fillStyle = '#111';
      F('700', 8.5);
      g.fillText(pdfTrunc(g, tag(x.m), M(lwid)), M(lx), M(Y0 + 6.3));
      g.fillStyle = '#555';
      F('400', 6);
      g.fillText(pdfTrunc(g, x.m.name || '', M(lwid)), M(lx), M(Y0 + 9.1));
      if (x.zones) {
        g.fillStyle = x.zones.length === 1 ? pdfZoneCol(x.zones[0]) : '#666';
        F('italic 700', 6);
        g.fillText(
          pdfTrunc(
            g,
            'in ' +
              x.zones
                .map(function (id) {
                  return zoneName(id);
                })
                .join(', '),
            M(lwid),
          ),
          M(lx),
          M(Y0 + 11.9),
        );
      }
      if (x.flat && ramp) {
        g.fillStyle = '#999';
        F('500', 6.5);
        g.fillText('flat, no tones', M(bx + cb + 3), M(Y0 + 6.3));
      }
      // the base once and twice (once per marker)
      if (x.coats) {
        const b = hexRgb(x.m.hex),
          b2 = b.map(function (v) {
            return v * (0.52 + (0.48 * v) / 255);
          });
        g.strokeStyle = '#4a4a4a';
        g.lineWidth = M(0.25);
        g.strokeRect(M(bx), M(Y0), M(cb), M(box));
        g.strokeStyle = '#b0b0b0';
        g.lineWidth = M(0.15);
        g.setLineDash([M(0.6), M(0.6)]);
        g.beginPath();
        g.moveTo(M(bx + cb / 2), M(Y0));
        g.lineTo(M(bx + cb / 2), M(Y0 + box));
        g.stroke();
        g.setLineDash([]);
        g.fillStyle = rgb(b);
        g.fillRect(M(bx), M(Y0 + box + 1.5), M(cb / 2), M(1.6));
        g.fillStyle = rgb(b2);
        g.fillRect(M(bx + cb / 2), M(Y0 + box + 1.5), M(cb / 2), M(1.6));
        g.fillStyle = '#777';
        F('500', 5.5);
        g.fillText('×1', M(bx + 0.6), M(Y0 + 2.2));
        g.fillText('×2', M(bx + cb / 2 + 0.6), M(Y0 + 2.2));
      }
      if (!ramp || x.flat) return;
      // the tones in thirds: what the guide lays, left to right
      const rx = bx + cb + 3,
        rw = Math.min(60, X0 + cw - rx);
      g.strokeStyle = '#4a4a4a';
      g.lineWidth = M(0.25);
      g.strokeRect(M(rx), M(Y0), M(rw), M(box));
      g.strokeStyle = '#c8c8c8';
      g.lineWidth = M(0.15);
      [1, 2].forEach(function (i) {
        g.beginPath();
        g.moveTo(M(rx + (rw * i) / 3), M(Y0));
        g.lineTo(M(rx + (rw * i) / 3), M(Y0 + 1.6));
        g.moveTo(M(rx + (rw * i) / 3), M(Y0 + box - 1.6));
        g.lineTo(M(rx + (rw * i) / 3), M(Y0 + box));
        g.stroke();
      });
      const lab = function (e, role) {
        if (!e) return withShade ? role + ': none' : '—';
        if (e.paper) return 'H: paper';
        if (e.coat) return 'S: B again';
        return (withShade ? role + ' ' : '') + tag(e.c);
      };
      g.fillStyle = '#333';
      F('600', 6.3);
      g.fillText(pdfTrunc(g, lab(x.L, 'H'), M(rw / 3 - 1)), M(rx + 0.8), M(Y0 + 2.6));
      g.textAlign = 'center';
      g.fillText(pdfTrunc(g, (withShade ? 'B ' : '') + tag(x.m), M(rw / 3 - 1)), M(rx + rw / 2), M(Y0 + 2.6));
      g.textAlign = 'right';
      g.fillText(pdfTrunc(g, lab(x.S, 'S'), M(rw / 3 - 1)), M(rx + rw - 0.8), M(Y0 + 2.6));
      // (a glaze says so on a line of its own, so a long code isn't cut short)
      if (x.S && x.S.glaze) {
        F('600', 5.8);
        g.fillText('over B', M(rx + rw - 0.8), M(Y0 + 5.2));
      }
      g.textAlign = 'left';
      // the colours on screen under it, as the tones would run
      const gL = x.gL || x.gB,
        gS = x.gS || x.gB,
        gr = g.createLinearGradient(M(rx), 0, M(rx + rw), 0);
      gr.addColorStop(0, rgb(gL));
      gr.addColorStop(0.2, rgb(gL));
      gr.addColorStop(0.5, rgb(x.gB));
      gr.addColorStop(0.8, rgb(gS));
      gr.addColorStop(1, rgb(gS));
      g.fillStyle = gr;
      g.fillRect(M(rx), M(Y0 + box + 1.5), M(rw), M(1.6));
    });
    return pg.c;
  }
}
