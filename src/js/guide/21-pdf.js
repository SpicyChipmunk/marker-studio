/* ---- (v313) a colouring page that came as a PDF ----
    Opened with Mozilla's PDF.js (vendor/pdfjs/<version>/, Apache-2.0; its own cache in the service worker, kept from
    one release to the next). A PDF of several pages asks which (a small picture of each); the page is drawn at the
    working size (MAXSIDE on its long side, on white) and goes on as a scan does: a PDF page is already flat, so the
    page finder is skipped. Where PDF.js can't run (an older Safari: its legacy build wants Safari 18) or the page
    comes out blank (a scanned format it can't draw), it says to screenshot the page instead, as before. */
const PDFJS_VER = '6.3.289',
  PDFJS_DIR = 'vendor/pdfjs/' + PDFJS_VER + '/',
  PDF_PAGES_MAX = 60,
  PDF_THUMB = 160;
let _pdfjs = null;
function pdfUrl(f) {
  return new URL(PDFJS_DIR + f, document.baseURI).href;
}
// PDF.js itself, loaded the first time (null where it can't run)
function pdfLib() {
  if (_pdfjs) return _pdfjs;
  _pdfjs = import(pdfUrl('pdf.min.mjs'))
    .then(function (m) {
      if (!m || typeof m.getDocument !== 'function') throw new Error('PDF.js has no getDocument');
      m.GlobalWorkerOptions.workerSrc = pdfUrl('pdf.worker.min.mjs');
      return m;
    })
    .catch(function (e) {
      _pdfjs = null;
      throw e;
    });
  return _pdfjs;
}
// (the module workers and dynamic import PDF.js needs; Safari before 15 has neither)
function pdfCan() {
  try {
    return (
      typeof Worker === 'function' &&
      typeof WebAssembly === 'object' &&
      'noModule' in HTMLScriptElement.prototype
    );
  } catch (_) {
    return false;
  }
}
const PDF_SHOT = ' Take a screenshot of the colouring page, then choose the screenshot.';
function loadPdf(file, gen) {
  if (!pdfCan()) {
    note('This browser can’t open PDFs here.' + PDF_SHOT);
    return;
  }
  note('Opening the PDF…');
  let doc = null;
  const fail = function (e, what) {
    if (gen !== loadGen) return;
    if (e && e.name === 'PasswordException')
      note('That PDF is locked with a password, so it can’t be opened here.' + PDF_SHOT);
    else note(errNote((what || 'Couldn’t open that PDF.') + PDF_SHOT, 'Opening a PDF', e));
    if (doc)
      try {
        doc.destroy();
      } catch (_) {}
  };
  Promise.all([pdfLib(), file.arrayBuffer()])
    .then(function (r) {
      if (gen !== loadGen) return null;
      return r[0].getDocument({
        data: new Uint8Array(r[1]),
        wasmUrl: pdfUrl('wasm/'),
        isEvalSupported: false,
        // (no password box: a locked PDF says so)
        password: '',
      }).promise;
    })
    .then(function (d) {
      if (!d || gen !== loadGen) return null;
      doc = d;
      if (d.numPages === 1) return 1;
      return pdfChoose(d, gen);
    })
    .then(function (n) {
      if (!n || gen !== loadGen) {
        // (Cancel: as it was)
        if (doc)
          try {
            doc.destroy();
          } catch (_) {}
        doc = null;
        if (gen === loadGen) note(metaText());
        return null;
      }
      note('Drawing page ' + n + '…');
      return doc.getPage(n).then(function (pg) {
        return pdfDraw(pg, MAXSIDE);
      });
    })
    .then(function (c) {
      if (!c || gen !== loadGen) return;
      try {
        doc.destroy();
      } catch (_) {}
      doc = null;
      if (pdfBlank(c)) {
        note('That PDF page came out blank here.' + PDF_SHOT);
        return;
      }
      pdfUse(c);
    })
    .catch(function (e) {
      fail(e);
    });
}
// the page drawn on white, its long side `side` px
function pdfDraw(pg, side) {
  const v0 = pg.getViewport({ scale: 1 }),
    k = side / Math.max(v0.width, v0.height),
    vp = pg.getViewport({ scale: k }),
    c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(vp.width));
  c.height = Math.max(1, Math.round(vp.height));
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, c.width, c.height);
  return pg.render({ canvasContext: g, viewport: vp, background: '#ffffff' }).promise.then(function () {
    return c;
  });
}
// nothing drawn but paper (a scanned format PDF.js can't draw comes out white)
function pdfBlank(c) {
  try {
    const w = Math.min(400, c.width),
      h = Math.round((c.height * w) / c.width),
      t = document.createElement('canvas');
    t.width = w;
    t.height = h;
    const g = t.getContext('2d');
    g.drawImage(c, 0, 0, w, h);
    const d = g.getImageData(0, 0, w, h).data;
    let dark = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] < 384) dark++;
    freeCanvas(t);
    return dark < (w * h) / 2000;
  } catch (_) {
    return false;
  }
}
// the page, as a picture: on as a scan goes (not straightened: a PDF page is flat already)
function pdfUse(c) {
  try {
    resetForNewPicture();
    takeNextPal();
    srcImg = c;
    srcUp = false;
    pgOrig = null;
    pgQ = null;
    pgHint = null;
    enterWork();
    const rs = document.getElementById('sfResume');
    if (rs) rs.style.display = 'none';
    pgProceed(null);
  } catch (err) {
    note(errNote('Couldn’t process that PDF page.' + PDF_SHOT, 'Opening a PDF', err));
  }
}
// several pages: which one? A small picture of each (drawn one after another), up to PDF_PAGES_MAX. Resolves to the
// page's number, or 0 for Cancel.
function pdfChoose(doc, gen) {
  const n = Math.min(doc.numPages, PDF_PAGES_MAX);
  let btns = '<div class="sfpdfpgs">';
  for (let i = 1; i <= n; i++)
    btns +=
      '<button type="button" class="sfpdfpg" data-a="' +
      i +
      '" aria-label="Page ' +
      i +
      '"><span class="sfpdfth" data-p="' +
      i +
      '"></span><span aria-hidden="true">' +
      i +
      '</span></button>';
  btns += '</div><button type="button" class="btn-soft" data-a="cancel">Cancel</button>';
  let open = true;
  const p = askBox(
    'Which page?',
    'This PDF has ' +
      doc.numPages +
      ' pages.' +
      (doc.numPages > n ? ' The first ' + n + ' are shown here.' : '') +
      ' Choose the colouring page.',
    btns,
  ).then(function (a) {
    open = false;
    const k = parseInt(a, 10);
    return k >= 1 && k <= n && gen === loadGen ? k : 0;
  });
  // the small pictures, one after another, while it's open
  let i = 1;
  const next = function () {
    if (!open || i > n || gen !== loadGen) return;
    const at = i++;
    doc
      .getPage(at)
      .then(function (pg) {
        return pdfDraw(pg, PDF_THUMB);
      })
      .then(function (c) {
        const el = open && document.querySelector('#sfEdAsk .sfpdfth[data-p="' + at + '"]');
        if (el) el.appendChild(c);
        next();
      })
      .catch(next);
  };
  next();
  return p;
}
