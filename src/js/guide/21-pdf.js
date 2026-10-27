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
// (v315) whether PDF.js is stored for offline use (its own cache, which the service worker fills)
function pdfStored() {
  try {
    if (!self.caches) return Promise.resolve(false);
    return caches
      .open('marker-studio-pdfjs-' + PDFJS_VER)
      .then(function (c) {
        return c.match(pdfUrl('pdf.min.mjs'));
      })
      .then(
        function (r) {
          return !!r;
        },
        function () {
          return false;
        },
      );
  } catch (_) {
    return Promise.resolve(false);
  }
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
const PDF_SHOT = ' Take a screenshot of the colouring page, then choose the screenshot.',
  // (v315) offline, and the PDF reader never stored (it's fetched once, the first time it's needed or as the app
  // installs, then kept)
  PDF_OFFLINE =
    'Opening a PDF needs the internet the first time, to fetch the PDF reader. Connect, then open it again.';
function loadPdf(file, gen) {
  if (!pdfCan()) {
    note('This browser can’t open PDFs here.' + PDF_SHOT);
    return;
  }
  note('Opening the PDF…');
  let doc = null;
  const fail = function (e, what) {
    if (gen !== loadGen) return;
    if (doc)
      try {
        doc.destroy();
      } catch (_) {}
    if (e && e.name === 'PasswordException') {
      note('That PDF is locked with a password, so it can’t be opened here.' + PDF_SHOT);
      return;
    }
    const said = function () {
      note(errNote((what || 'Couldn’t open that PDF.') + PDF_SHOT, 'Opening a PDF', e));
    };
    // (v315) offline, with the PDF reader never stored: it needs the internet once. (Told by its cache, not by the
    // error, which differs from browser to browser)
    if (navigator.onLine !== false) return said();
    pdfStored().then(function (has) {
      if (gen !== loadGen) return;
      if (has) said();
      else note(PDF_OFFLINE);
    });
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
      if (!d) return null;
      // (v315: a PDF that opened after another picture was chosen is let go too)
      if (gen !== loadGen) {
        try {
          d.destroy();
        } catch (_) {}
        return null;
      }
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
      if (!c) return;
      try {
        doc.destroy();
      } catch (_) {}
      doc = null;
      // (v315: and a page drawn after another picture was chosen, or blank, handed back)
      if (gen !== loadGen) {
        freeCanvas(c);
        return;
      }
      if (pdfBlank(c)) {
        freeCanvas(c);
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
    // (v318.25) anything that isn't paper white counts as drawn, not only what's darker than mid grey: a page drawn in
    // grey lines (light-line pages for alcohol markers) had been refused as blank, though it opens as a picture
    let dark = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] < 720) dark++;
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
    // (v318.34: the page kept with the guide once it's saved, 25-source-photo)
    srcFrom = 'pdf';
    // (v324.1: its record for the first save, begun now: 25-source-photo)
    srcPrewarm(c, true);
    enterWork();
    const rs = document.getElementById('sfResume');
    if (rs) rs.style.display = 'none';
    pgProceed(null);
  } catch (err) {
    note(errNote('Couldn’t process that PDF page.' + PDF_SHOT, 'Opening a PDF', err));
  }
}
// several pages: which one? A small picture of each (drawn one after another), up to PDF_PAGES_MAX at a time from
// page `from` (1). Resolves to the page's number, or 0 for Cancel. (v318.28) A longer PDF has a step to the next
// pages and back: past page 60 of a colouring book there had been no way to choose one.
function pdfChoose(doc, gen, from) {
  from = from || 1;
  const N = doc.numPages,
    n = Math.min(N, from + PDF_PAGES_MAX - 1),
    span = function (a) {
      const b = Math.min(N, a + PDF_PAGES_MAX - 1);
      return a === b ? 'Page ' + a : 'Pages ' + a + '\u2013' + b;
    };
  let btns = '<div class="sfpdfpgs">';
  for (let i = from; i <= n; i++)
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
  btns += '</div>';
  if (from > 1)
    btns +=
      '<button type="button" class="btn-soft" data-a="prev">' +
      span(Math.max(1, from - PDF_PAGES_MAX)) +
      '</button>';
  if (n < N) btns += '<button type="button" class="btn-soft" data-a="next">' + span(n + 1) + '</button>';
  btns += '<button type="button" class="btn-soft" data-a="cancel">Cancel</button>';
  let open = true;
  const p = askBox(
    'Which page?',
    'This PDF has ' +
      N +
      ' pages.' +
      (N > PDF_PAGES_MAX ? ' ' + span(from) + (from === n ? ' is' : ' are') + ' shown here.' : '') +
      ' Choose the colouring page.',
    btns,
  ).then(function (a) {
    open = false;
    if (gen !== loadGen) return 0;
    if (a === 'next' && n < N) return pdfChoose(doc, gen, n + 1);
    if (a === 'prev' && from > 1) return pdfChoose(doc, gen, Math.max(1, from - PDF_PAGES_MAX));
    const k = parseInt(a, 10);
    return k >= from && k <= n ? k : 0;
  });
  // the small pictures, one after another, while it's open
  let i = from;
  const next = function () {
    if (!open || i > n || gen !== loadGen) return;
    const at = i++;
    doc
      .getPage(at)
      .then(function (pg) {
        // (v328 review 2: the page's decoded pictures let go once its small picture is drawn: a scanned book's 50
        // pages had all been held while choosing)
        return pdfDraw(pg, PDF_THUMB).then(
          function (c) {
            try {
              pg.cleanup();
            } catch (_) {}
            return c;
          },
          function (e) {
            try {
              pg.cleanup();
            } catch (_) {}
            throw e;
          },
        );
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
