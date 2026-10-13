/* ===== Read a photo of your caps (Scan, v318) =====
   A photo of a tray of caps, read on this device: every code it can read joins Scan's list as it's read, to check
   before Add, as a pasted list does. The reader (ONNX Runtime and three PaddleOCR models, vendor/ocr/<OCR_VER>/, about
   22 MB) is downloaded only after a consent card, into a cache of its own that an app update leaves alone; it runs in
   a worker (src/js/ocr/), ended when Scan closes so its memory goes with it.
   A code read for sure, of one marker of the brand chosen (or, with either brand, of the brand the photo's codes show
   so far), is added to the list at once; one both brands have, or unsure, or another brand's, waits for the end of the
   photo, then goes through Scan's reading, with its cap's name beside it, and the brand the photo's own codes show
   (codes only one brand has), so a two-brand code isn't a question when the tray is plainly one brand's. Each photo's
   additions are marked, for Undo this photo. The engine has a second look of its own (the photo turned a quarter, at
   what the first look didn't read); its codes come the same way. */
const OCR_VER = '1',
  OCR_DIR = 'vendor/ocr/' + OCR_VER + '/',
  OCR_CACHE = 'marker-studio-ocr-' + OCR_VER,
  // (each file's size and SHA-256, checked before it's kept: vendor/ocr/README.md)
  OCR_FILES = [
    {
      f: 'ort.wasm.bundle.min.mjs',
      n: 73054,
      h: '11e64bd8ffe11bd1a2a2f0d6275fdfbbba7262f0b76b99b53d228a8a22ef3d90',
    },
    {
      f: 'ort-wasm-simd-threaded.wasm',
      n: 14239897,
      h: '3398c10d07d229bd91b364548e130e0e51a8e5704b88c7c083ebbeb78842dee2',
    },
    { f: 'det.onnx', n: 2423224, h: 'aef1ed818b33a3bafacf9ca085ff52407f7903c5da4e65a3eef47cd23a3b46ea' },
    { f: 'rec.onnx', n: 4462639, h: '9ef676d6ed3c88256a2d92c640c44f25b0c40947e111b14b8be8f594091563e6' },
    { f: 'rec-dict.txt', n: 34060, h: '2af150bab777d86fa1ce821f6a37eabea90f1bb99ab9c41f031262e892a747bc' },
    { f: 'cls.onnx', n: 578966, h: '491843a3c65de46295864c6815e41127eaa812c4dac1e19c6850ec49da9d3640' },
  ],
  OCR_MB = Math.round(OCR_FILES.reduce((s, x) => s + x.n, 0) / 1e6),
  // (a read under way when the app last closed: it may have run out of memory, so the next reads go gently)
  OCR_BUSY_KEY = 'ms-ocr-busy',
  // (the photo read gently since running out of memory, for a fortnight: one shortfall, other apps open, isn't for ever)
  OCR_LOW_DAYS = 14,
  OCR_LOW_KEY = 'ms-ocr-low';
const ocrUrl = (f) => new URL(OCR_DIR + f, location.href).href;
let ocrW = null, // the worker
  ocrReady = null, // its start: a promise
  ocrRun = null, // the read under way: { n, img, lines, taken, held, ... }
  ocrPhotos = 0, // photos read since Scan opened (Undo this photo marks)
  ocrDown = null, // a download under way: { ctl }
  // (v318 prototype) several photos chosen at once: read in turn, one summary at the end
  // { files, k (the next to read), n0 (the first's photo number), per: [{ name, added, asked, failed }], stop }
  ocrQ = null,
  ocrOk = false; // the reader known to be stored: the card's tap opens the photo picker straight away

// whether this browser can run the reader: WebAssembly with SIMD (Safari 16.4), workers, the Cache API
function ocrCan() {
  try {
    if (typeof Worker !== 'function' || !self.caches || !window.crypto || !crypto.subtle) return false;
    if (typeof WebAssembly !== 'object' || !WebAssembly.validate) return false;
    // (a function using a SIMD instruction, as wasm-feature-detect checks)
    return WebAssembly.validate(
      new Uint8Array([
        0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253,
        98, 11,
      ]),
    );
  } catch (_) {
    return false;
  }
}
// the reader's files stored, every one (a download stopped part way through doesn't count)
async function ocrStored() {
  try {
    const c = await caches.open(OCR_CACHE),
      have = await Promise.all(OCR_FILES.map((x) => c.match(ocrUrl(x.f))));
    return have.every(Boolean);
  } catch (_) {
    return false;
  }
}
const ocrHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
// download what isn't stored yet, each file checked (size and hash) before it's kept; progress(bytes, total)
async function ocrDownload(progress, signal) {
  const c = await caches.open(OCR_CACHE),
    total = OCR_FILES.reduce((s, x) => s + x.n, 0);
  let done = 0;
  // (asked once: kept through Safari's clearing of a site's storage, when the browser agrees)
  try {
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
  } catch (_) {}
  for (const x of OCR_FILES) {
    const url = ocrUrl(x.f);
    if (await c.match(url)) {
      done += x.n;
      progress(done, total);
      continue;
    }
    const res = await fetch(url, { cache: 'no-store', signal: signal });
    if (!res.ok) throw new Error('http ' + res.status);
    // (read as it comes, for the progress bar)
    const parts = [];
    let got = 0;
    if (res.body && res.body.getReader) {
      const rd = res.body.getReader();
      for (;;) {
        const r = await rd.read();
        if (r.done) break;
        parts.push(r.value);
        got += r.value.length;
        progress(done + Math.min(got, x.n), total);
      }
    } else parts.push(new Uint8Array(await res.arrayBuffer()));
    const buf = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
    let at = 0;
    parts.forEach((p) => {
      buf.set(p, at);
      at += p.length;
    });
    if (buf.length !== x.n) throw new Error('size ' + x.f);
    if (ocrHex(await crypto.subtle.digest('SHA-256', buf)) !== x.h) throw new Error('hash ' + x.f);
    await c.put(url, new Response(buf, { headers: { 'Content-Type': 'application/octet-stream' } }));
    done += x.n;
    progress(done, total);
  }
}
// the stored files checked again, size and hash, after the reader failed to start: a damaged one (a write cut off, a
// disk fault) let go of, so the card's next tap downloads only it; how many were, or are missing
async function ocrDamaged() {
  let bad = 0;
  try {
    const c = await caches.open(OCR_CACHE);
    for (const x of OCR_FILES) {
      const r = await c.match(ocrUrl(x.f));
      if (!r) {
        bad++;
        continue;
      }
      const buf = await r.arrayBuffer();
      if (buf.byteLength === x.n && ocrHex(await crypto.subtle.digest('SHA-256', buf)) === x.h) continue;
      await c.delete(ocrUrl(x.f));
      bad++;
    }
  } catch (_) {}
  return bad;
}
// the stored files, as the worker wants them
async function ocrLoad() {
  const c = await caches.open(OCR_CACHE),
    get = async (f) => {
      const r = await c.match(ocrUrl(f));
      if (!r) throw new Error('missing ' + f);
      return r;
    };
  const [ort, wasm, det, rec, dict, cls] = await Promise.all(OCR_FILES.map((x) => get(x.f)));
  return {
    // (ONNX Runtime's module, from the cache, as a module the worker can import)
    ort: URL.createObjectURL(new Blob([await ort.arrayBuffer()], { type: 'text/javascript' })),
    wasm: await wasm.arrayBuffer(),
    det: await det.arrayBuffer(),
    rec: await rec.arrayBuffer(),
    dict: await dict.text(),
    cls: await cls.arrayBuffer(),
  };
}
// the worker, started (once) and ready
function ocrStart() {
  if (ocrReady) return ocrReady;
  ocrReady = (async function () {
    const files = await ocrLoad(),
      src = $('ocrWorkerSrc').textContent,
      wurl = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
    const w = new Worker(wurl);
    URL.revokeObjectURL(wurl);
    ocrW = w;
    w.onmessage = ocrMessage;
    w.onerror = function (e) {
      e.preventDefault();
      const m = { message: e.message || 'worker', memory: /memory/i.test(e.message || '') };
      if (!w._up && w._fail) return w._fail(Object.assign(new Error(m.message), { memory: m.memory }));
      ocrFailed(m);
    };
    await new Promise((res, rej) => {
      w._ready = res;
      w._fail = rej;
      w.postMessage(Object.assign({ t: 'init' }, files), [files.wasm, files.det, files.rec, files.cls]);
    });
    URL.revokeObjectURL(files.ort);
    return w;
  })();
  ocrReady.catch(function () {
    ocrEnd();
  });
  return ocrReady;
}
// the worker ended: its memory goes (on Scan's close, and after running out of memory)
function ocrEnd() {
  if (ocrW) ocrW.terminate();
  ocrW = null;
  ocrReady = null;
}
function ocrMessage(ev) {
  const m = ev.data || {},
    w = ocrW;
  if (m.t === 'ready') {
    if (w) w._up = true;
    return w && w._ready && w._ready();
  }
  if (m.t === 'error') {
    if (w && w._fail && !w._up) return w._fail(Object.assign(new Error(m.message), { memory: m.memory }));
    return ocrFailed(m);
  }
  const r = ocrRun;
  if (!r) return;
  if (m.t === 'line') ocrLine(r, m.item);
  else if (m.t === 'progress') ocrProgress(r, m.p);
  else if (m.t === 'codes')
    // (which of the first look's readings hold a code, by Scan's own reading: the second look reads again where not)
    w.postMessage({ t: 'codes', ids: m.items.filter((x) => ocrCodes(x[1], '').length).map((x) => x[0]) });
  else if (m.t === 'done') ocrDone(r, m);
}

// --- reading a line: the codes in it, as Scan reads them; [{ i (the marker), n: how many it could be }]
function ocrCodes(text, brand) {
  if (!text) return [];
  const r = scanRead(text, brand);
  return (r.codes || [])
    .filter((c) => c.opts.length)
    .map((c) => ({ i: c.opts[0], n: c.opts.length, asked: c.asked }));
}
// a line read: a code for sure, of one marker, into the list now; else kept for the end of the photo
function ocrLine(r, it) {
  r.items.set(it.id, it);
  if (it.nameOf) return;
  // (the brands the photo shows: codes only one brand has)
  const any = scanRead(it.text, '');
  (any.codes || []).forEach((c) => {
    const bs = [...new Set(c.opts.map((i) => COLORS[i].brand))];
    if (bs.length === 1) r.brands[bs[0]] = (r.brands[bs[0]] || 0) + 1;
  });
  const cs = ocrCodes(it.text, scanBrand),
    // (with either brand chosen, only a code of the brand the photo's codes show so far: another brand's code on a
    // tray of one brand's caps is more likely a misreading, E71 for E711, and waits to be asked about)
    seen = ocrBrandOf(r),
    // (and with a brand chosen, not once the photo plainly shows the other brand: an Ohuhu B04 isn't Copic's. The
    // photo's codes are then read at the end with the photo's brand, and the summary says so)
    mine = !!cs.length && (scanBrand ? !seen || seen === scanBrand : COLORS[cs[0].i].brand === seen);
  if (!it.unsure && it.text.length >= 2 && cs.length === 1 && cs[0].n === 1 && !cs[0].asked && mine) {
    const was = scanList.length;
    if (scanTake(cs[0].i, '', true, true) && scanList.length > was) scanList[0].photo = r.n;
    r.taken.add(it.id);
    r.sure++;
  }
  ocrSoon(r);
}
// the list and the photo drawn again, a few times a second at most (each code drawing the list again had cost a
// second over 300 codes, more on an iPad)
function ocrSoon(r) {
  if (r.soon) return;
  r.soon = setTimeout(function () {
    r.soon = 0;
    scanRender();
    ocrDraw(r);
  }, 250);
}
function ocrProgress(r, p) {
  r.p = p;
  ocrStatus(r);
}
// the brand the photo's caps show: one brand's codes at least four to one, five at least
function ocrBrandOf(r) {
  const o = r.brands.Ohuhu || 0,
    c = r.brands.Copic || 0;
  return o >= 5 && o >= 4 * c ? 'Ohuhu' : c >= 5 && c >= 4 * o ? 'Copic' : '';
}
// the end of the photo: what waited (the unsure, two-brand codes, the names) read by Scan with the photo's brand
function ocrDone(r, m) {
  clearTimeout(r.soon);
  r.soon = 0;
  r.done = true;
  r.ms = m.ms;
  if (window.__MS_TEST) window.__ocrLast = m;
  r.aborted = m.aborted;
  try {
    localStorage.removeItem(OCR_BUSY_KEY);
  } catch (_) {}
  // (each code's line with its names after it, the order Scan's reading of a list wants; a code already added
  // needs neither again)
  const items = new Map(m.lines.map((x) => [x.id, x])),
    text = [];
  r.taken.forEach((id) => !items.has(id) && r.items.has(id) && items.set(id, r.items.get(id)));
  r.items = items;
  // (on a tray plainly of one brand, another brand's code that's the start of a code of this one read in the photo
  // too, E71 beside E711, or one read unsure, is that cap read short, or a misreading: left out, not asked about)
  const seen = ocrBrandOf(r),
    // (a brand chosen, and the photo plainly the other brand's: what went in at once under the brand chosen, before
    // the photo's brand showed, comes out, and is read again with the rest under the photo's brand)
    swap = !!(seen && scanBrand && seen !== scanBrand),
    ownCodes = seen
      ? [].concat(
          ...m.lines.map((x) => ocrCodes(x.text, seen).map((c) => COLORS[c.i].code.replace(/-/g, ''))),
        )
      : [],
    short = (x) => {
      if (!seen) return false;
      const cs = ocrCodes(x.text, '');
      if (!cs.length || cs.some((c) => COLORS[c.i].brand === seen)) return false;
      const k = COLORS[cs[0].i].code.replace(/-/g, '');
      return x.unsure || ownCodes.some((o) => o !== k && o.indexOf(k) === 0);
    };
  m.lines.forEach((x) => {
    // (only lines with a digit, as every code has: a lone word, "Green", read as the other brand's colour's name, had
    // been a question about it)
    if (x.nameOf || (!swap && r.taken.has(x.id)) || !/\d/.test(x.text) || short(x)) return;
    // (a code and its name on one line, as on the cap: a word of the name settles a code two markers answer to, R16
    // Light Salmon and RV316, once R16; the name's lines come in any order, "Pink" then "Tender")
    text.push([x.text].concat(m.lines.filter((y) => y.nameOf === x.id).map((y) => y.text)).join(' '));
  });
  if (swap) {
    scanList = scanList.filter((e) => e.photo !== r.n);
    r.taken.clear();
    r.sure = 0;
  }
  const before = new Set(scanList),
    asks0 = scanAsks(),
    was = scanBrand;
  r.brand = seen;
  if (text.length) {
    // (the photo's brand, when its codes plainly show one; else the brand chosen)
    if (seen) scanBrand = seen;
    scanMute = scanNoFlip = true;
    try {
      scanHandleCodes(text.join('\n'), true, true);
    } finally {
      scanMute = scanNoFlip = false;
      scanBrand = was;
    }
  }
  scanList.forEach((e) => {
    if (before.has(e)) return;
    e.photo = r.n;
    // (the brand the question names came from the photo, not from above the box)
    if (e.ask && seen && seen !== was && /^other /.test(e.ask))
      e.title = e.title.replace('than the one chosen (' + seen + ')', 'than the photo’s (' + seen + ')');
  });
  r.asked = scanAsks() - asks0;
  r.added = scanList.filter((e) => e.photo === r.n && !e.ask).length;
  scanRender();
  ocrDraw(r);
  ocrStatus(r);
  ocrButtons(r);
  scanBeep(r.added ? 'ok' : 'same');
  ocrQueueOn(r);
}
// (a queue of photos: this one's tally kept, its pixels let go of, the next started; the last one's view stays)
function ocrQueueOn(r) {
  const q = ocrQ;
  if (!q) return;
  q.per.push({
    name: r.file && r.file.name,
    added: r.added || 0,
    asked: r.asked || 0,
    failed: !!r.failed,
    brand: r.brand || '',
  });
  if (r.aborted) q.stop = true;
  if (q.k < q.files.length && !q.stop) {
    r.img.data = null;
    ocrNext();
  } else {
    q.ms = Date.now() - q.t0;
    ocrStatus(r);
    ocrButtons(r);
  }
}
function ocrFailed(m) {
  const r = ocrRun;
  try {
    localStorage.removeItem(OCR_BUSY_KEY);
  } catch (_) {}
  ocrEnd();
  if (!r || r.done) return;
  // (out of memory: once more, gently, before giving up)
  if (m.memory && !r.gentle) {
    try {
      localStorage.setItem(OCR_LOW_KEY, String(Date.now()));
    } catch (_) {}
    r.gentle = true;
    r.note = 'That was a lot for this device’s memory: reading it again, more gently…';
    ocrStatus(r);
    return ocrGo(r);
  }
  r.done = true;
  r.failed = true;
  r.note = m.memory
    ? 'This photo is too much for this device. Try one of fewer caps, half a tray.'
    : 'The reader stopped with a problem. Try the photo again; if it happens again, send feedback.';
  ocrStatus(r);
  ocrButtons(r);
  ocrQueueOn(r);
}

// --- the photo: decoded (turned upright as taken), the copy read at most 2048 px on its long side, and a smaller one
// shown
async function ocrPhoto(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const W0 = img.naturalWidth,
      H0 = img.naturalHeight,
      s = Math.min(1, 2048 / Math.max(W0, H0)),
      w = Math.max(1, Math.round(W0 * s)),
      h = Math.max(1, Math.round(H0 * s));
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0, w, h);
    const data = x.getImageData(0, 0, w, h);
    // (the copy shown: up to 900 px, enough for a phone's or an iPad's view)
    const v = Math.min(1, 900 / Math.max(w, h)),
      show = document.createElement('canvas');
    show.width = Math.round(w * v);
    show.height = Math.round(h * v);
    show.getContext('2d').drawImage(c, 0, 0, show.width, show.height);
    c.width = c.height = 1;
    return { w: w, h: h, data: data, show: show };
  } finally {
    URL.revokeObjectURL(url);
  }
}

// --- the view, in Scan's card in place of its list while a photo is read
const ocrV = () => $('ocrView');
function ocrShow(html) {
  const card = $('scanOverlay').querySelector('.sccard'),
    v = ocrV();
  card.classList.add('ocron');
  v.hidden = false;
  v.innerHTML = html;
  $('scTitle').textContent = 'Read photos of your caps';
}
function ocrHide() {
  const card = $('scanOverlay').querySelector('.sccard'),
    v = ocrV();
  card.classList.remove('ocron');
  v.hidden = true;
  v.innerHTML = '';
  $('scTitle').textContent = scanFind ? 'Scan 3 caps' : 'Scan or type codes';
}
// the card in Scan: shown where the reader can run, not in Find mode
function ocrCard() {
  const b = $('ocrOpen');
  if (b) b.style.display = ocrCan() && !scanFind ? '' : 'none';
}
// (the consent card's words, once: what it is, where it runs, its size)
function ocrConsent(msg) {
  const off = navigator.onLine === false;
  ocrShow(
    '<div class="ocrh">Read your caps from photos</div>' +
      '<p class="ocrp">The reader works on this device: your photos never leave it. It’s a one-time download of about <b>' +
      OCR_MB +
      ' MB</b>, kept for offline use. Wi-Fi is best.</p>' +
      '<ul class="ocrul"><li>Caps up, in good light, the phone or iPad held flat above them.</li>' +
      '<li>About half a tray per photo: closer reads more.</li>' +
      '<li>Each code it reads joins the list, to check before you add it. A photo takes a few seconds to a minute; choose several and they’re read in turn.</li></ul>' +
      (msg || off
        ? '<p class="ocrp ocrwarn" role="alert">' +
          esc(msg || 'The reader needs the internet the first time: connect, then try again.') +
          '</p>'
        : '') +
      '<button type="button" class="btn-primary" id="ocrGet"' +
      (off ? ' disabled' : '') +
      '>Download the reader · ' +
      OCR_MB +
      ' MB</button><button type="button" class="obGhost" id="ocrNo">Not now</button>',
  );
  $('ocrGet').addEventListener('click', ocrGetIt);
  $('ocrNo').addEventListener('click', ocrBack);
  $('ocrGet').focus({ preventScroll: true });
}
async function ocrGetIt() {
  const ctl = new AbortController();
  ocrDown = { ctl: ctl };
  ocrShow(
    '<div class="ocrh">Downloading the reader</div><div class="ocrstat"><span id="ocrDl">Starting…</span></div>' +
      '<div class="ocrbar"><b id="ocrDlBar" style="width:0"></b></div>' +
      '<button type="button" class="obGhost" id="ocrDlStop">Cancel</button>',
  );
  $('ocrDlStop').addEventListener('click', function () {
    ctl.abort();
  });
  // (the keyboard's and a screen reader's place, not lost with the button tapped before)
  $('ocrDlStop').focus({ preventScroll: true });
  try {
    await ocrDownload(function (n, total) {
      const t = $('ocrDl'),
        b = $('ocrDlBar');
      if (t) t.textContent = Math.round(n / 1e6) + ' of ' + Math.round(total / 1e6) + ' MB';
      if (b) b.style.width = Math.round((100 * n) / total) + '%';
    }, ctl.signal);
    ocrDown = null;
    ocrOk = true;
    // (a photo can be chosen only from a tap: the download's took too long to count)
    ocrShow(
      '<div class="ocrh">The reader is ready</div><p class="ocrp">Stored on this device, for offline use. Now photos of your caps: take one, or choose one or several.</p>' +
        '<button type="button" class="btn-primary" id="ocrPick">Take or choose photos</button><button type="button" class="obGhost" id="ocrNo">Back to the list</button>',
    );
    $('ocrPick').addEventListener('click', ocrPick);
    $('ocrNo').addEventListener('click', ocrBack);
    $('ocrPick').focus({ preventScroll: true });
  } catch (e) {
    ocrDown = null;
    if (ctl.signal.aborted) return ocrBack();
    ocrConsent(
      navigator.onLine === false
        ? 'The connection went: what’s downloaded is kept. Connect, then try again.'
        : 'The download didn’t finish: what’s downloaded is kept. Try again.',
    );
  }
}
function ocrBack() {
  if (ocrDown) ocrDown.ctl.abort();
  ocrDown = null;
  ocrHide();
  scanRender();
  scanFocusBox();
}
// the card tapped: the photo picker straight away when the reader is stored (it opens only from a tap), else consent
async function ocrOpenTap() {
  if (!ocrCan()) return;
  // (the picker first, in the tap; whether the reader is stored is known by the time a photo's chosen)
  if (ocrOk) return ocrPick();
  if (await ocrStored()) {
    ocrOk = true;
    return ocrShowPick();
  }
  ocrConsent();
}
// (stored, found out after the tap: one more tap for the picker)
function ocrShowPick() {
  ocrShow(
    '<div class="ocrh">Read your caps from photos</div><p class="ocrp">Caps up, in good light, held flat above them. About half a tray per photo: closer reads more. Choose several and they’re read in turn.</p>' +
      '<button type="button" class="btn-primary" id="ocrPick">Take or choose photos</button><button type="button" class="obGhost" id="ocrNo">Back to the list</button>',
  );
  $('ocrPick').addEventListener('click', ocrPick);
  $('ocrNo').addEventListener('click', ocrBack);
  $('ocrPick').focus({ preventScroll: true });
}
function ocrPick() {
  const f = $('ocrFile');
  f.value = '';
  f.click();
}
function ocrChosen(files) {
  if (!files || !files.length) return;
  if (ocrRun && !ocrRun.done) return;
  ocrQ = { files: files, k: 0, n0: ocrPhotos + 1, per: [], stop: false, t0: Date.now() };
  ocrNext();
}
// the queue's next photo (or its end)
function ocrNext() {
  const q = ocrQ;
  if (!q) return;
  if (q.k >= q.files.length || q.stop) return;
  ocrOne(q.files[q.k++]);
}
async function ocrOne(file) {
  ocrPhotos++;
  const r = {
    n: ocrPhotos,
    file: file,
    items: new Map(),
    taken: new Set(),
    brands: {},
    sure: 0,
    p: null,
    done: false,
    note: '',
  };
  ocrRun = r;
  ocrShow(
    '<div class="ocrstat"><span id="ocrSay">Opening the photo…</span><span id="ocrLeft"></span></div>' +
      // (what a screen reader hears: each stage once, not the count as it climbs ten times a second)
      '<span class="sfsr" id="ocrLive" role="status" aria-live="polite"></span>' +
      '<div class="ocrbar"><b id="ocrBar" style="width:0"></b></div><div class="ocrpic" id="ocrPic"></div>' +
      '<div class="ocrsum" id="ocrSum"></div><div class="ocrrow" id="ocrBtns"></div>',
  );
  ocrButtons(r);
  try {
    r.img = await ocrPhoto(file);
  } catch (_) {
    r.done = true;
    r.failed = true;
    r.note = 'That photo couldn’t be opened. Try another, or a screenshot of it.';
    ocrStatus(r);
    ocrButtons(r);
    ocrQueueOn(r);
    return;
  }
  $('ocrPic').appendChild(r.img.show);
  r.cv = document.createElement('canvas');
  r.cv.className = 'ocrbox';
  $('ocrPic').appendChild(r.cv);
  ocrGo(r);
}
// read the photo (again, after running out of memory: gently)
async function ocrGo(r) {
  // (Stop tapped while the photo was opening, or the reader starting: nothing read, the queue ended)
  if (r.stop) return ocrDone(r, { lines: [], stat: {}, ms: 0, aborted: true });
  r.sent = false;
  let low = r.gentle;
  try {
    const at = +localStorage.getItem(OCR_LOW_KEY) || 0;
    low = low || Date.now() - at < OCR_LOW_DAYS * 864e5 || localStorage.getItem(OCR_BUSY_KEY) === '1';
  } catch (_) {}
  r.p = { look: 1, stage: 'load', done: 0, total: 1, ms: 0 };
  ocrStatus(r);
  try {
    await ocrStart();
  } catch (e) {
    if (ocrRun !== r || r.done) return;
    // (out of memory starting: once more, gently, as a read's; else a stored file may be damaged (their hashes were
    // checked only as they came): checked again, and a damaged one let go of, to be downloaded again. Not the whole
    // reader on a failure that isn't the files': offline, it couldn't come back)
    if (e && e.memory && !r.gentle) return ocrFailed({ message: e.message, memory: true });
    const bad = e && e.memory ? 0 : await ocrDamaged();
    if (ocrRun !== r || r.done) return;
    r.done = true;
    r.failed = true;
    if (bad) {
      ocrOk = false;
      // (a queue's other photos wait for it)
      r.note =
        'Part of the reader stored on this device was missing or damaged. Read another photo downloads that part again (Wi-Fi is best).';
    } else if (e && e.memory)
      r.note = 'The reader couldn’t start: this device’s memory is short. Close other apps and try again.';
    else
      r.note =
        'The reader couldn’t start (' +
        (e && e.message ? e.message : 'unknown') +
        '). Try again; if it happens again, send feedback.';
    // (a queue's other photos would fail the same way: it ends here, said)
    if (ocrQ) ocrQ.stop = ocrQ.halt = true;
    ocrStatus(r);
    ocrButtons(r);
    ocrQueueOn(r);
    return;
  }
  if (ocrRun !== r || r.done) return;
  if (r.stop) return ocrDone(r, { lines: [], stat: {}, ms: 0, aborted: true });
  try {
    localStorage.setItem(OCR_BUSY_KEY, '1');
  } catch (_) {}
  // (the photo's pixels go to the worker: copied, so a second try still has them; or decoded again when let go of)
  if (!r.img.data) {
    try {
      r.img = Object.assign(r.img, { data: (await ocrPhoto(r.file)).data });
    } catch (_) {
      return ocrFailed({ message: 'photo', memory: false });
    }
  }
  const px = r.img.data.data.slice().buffer,
    o = {
      maxSide: low ? 1280 : 1600,
      // (an iPad or iPhone: the detector in two strips, so its working memory is half: memory there is tight)
      detTiles: low || isIOSDevice() ? 2 : 1,
      maxW: 160,
      minH: 16,
      quad: 1.6,
      retry: true,
      split: 2.5,
      zoom: 1.6,
      zoomPad: 0.08,
      zoomMargin: 8,
      longWord: true,
      minConf: 0.5,
      second: true,
      words: ocrWords(),
    };
  // (Stop tapped while the photo was decoded again)
  if (r.stop) return ocrDone(r, { lines: [], stat: {}, ms: 0, aborted: true });
  ocrW.postMessage({ t: 'read', img: { width: r.img.w, height: r.img.h, data: px }, o: o }, [px]);
  r.sent = true;
}
// (the words of the colours' names: a box read as one is settled, not retried as a code)
let _ocrWords = null;
function ocrWords() {
  if (_ocrWords) return _ocrWords;
  const s = new Set();
  COLORS.forEach((c) =>
    String(c.name || '')
      .toLowerCase()
      .split(/[^a-z]+/)
      .forEach((w) => w.length >= 3 && s.add(w)),
  );
  [
    'ohuhu',
    'honolulu',
    'copic',
    'sketch',
    'ciao',
    'classic',
    'alcohol',
    'marker',
    'markers',
    'brush',
    'chisel',
  ].forEach((w) => s.add(w));
  return (_ocrWords = [...s]);
}
function ocrStatus(r) {
  const say = $('ocrSay'),
    left = $('ocrLeft'),
    bar = $('ocrBar');
  if (!say) return;
  const p = r.p || {};
  let t = '',
    pc = 0;
  if (r.failed) t = r.note;
  else if (r.done) {
    t =
      (r.added
        ? r.added + (r.added === 1 ? ' marker' : ' markers') + ' added to the list'
        : 'No new codes read') +
      (r.asked ? ' · ' + r.asked + ' to choose there' : '') +
      (r.aborted ? ' · stopped' : '');
    pc = 100;
  } else if (r.note && p.stage === 'load') t = r.note;
  else if (p.stage === 'load') t = 'Starting the reader…';
  else if (p.look === 2) {
    t = 'Looking again at what it couldn’t read…';
    pc = 85 + (p.stage === 'rec' && p.total ? (15 * p.done) / p.total : 0);
  } else if (p.stage === 'det' || p.stage === 'zoom') {
    t = 'Finding the caps…';
    pc = p.stage === 'zoom' ? 15 : 5;
  } else {
    t = 'Reading the caps… ' + r.sure + ' so far';
    pc = 20 + (p.total ? (65 * p.done) / p.total : 0);
  }
  const q = ocrQ,
    many = q && q.files.length > 1,
    k = q ? Math.max(1, Math.min(q.files.length, q.k)) : 1,
    over = many && r.done && (q.k >= q.files.length || q.stop);
  if (many && !over) {
    // (the queue's own words: this photo's place, and the bar over the whole queue)
    t = 'Photo ' + k + ' of ' + q.files.length + ' · ' + t;
    pc = (100 * (k - 1 + pc / 100)) / q.files.length;
  } else if (many && over) {
    const added = q.per.reduce((s, x) => s + x.added, 0),
      asked = q.per.reduce((s, x) => s + x.asked, 0),
      failed = q.per.filter((x) => x.failed).length;
    t =
      ocrNPhotos(q.per.length) +
      ': ' +
      (added ? added + (added === 1 ? ' marker' : ' markers') + ' added to the list' : 'no new codes read') +
      (asked ? ' · ' + asked + ' to choose there' : '') +
      (failed ? ' · ' + failed + ' not read' : '') +
      (q.stop && !q.halt ? ' · stopped' : '');
    pc = 100;
  }
  say.textContent = t;
  const live = $('ocrLive'),
    heard = t.replace(/ \d+ so far$/, '');
  if (live && live.textContent !== heard) live.textContent = heard;
  if (left) left.textContent = '';
  bar.style.width = Math.round(pc) + '%';
  const sum = $('ocrSum');
  if (sum && many && over) {
    const other = scanBrand && q.per.find((x) => x.brand && x.brand !== scanBrand);
    sum.innerHTML =
      '<span class="ocrleg"><span>Read</span><span class="am">To check</span></span>' +
      // (why the queue ended early, when a photo couldn't be read)
      (r.failed && r.note ? '<span class="ocrwarn">' + esc(r.note) + '</span>' : '') +
      (other
        ? '<span class="ocrwarn">Some photos look like ' +
          esc(other.brand) +
          ' caps, so theirs went in as ' +
          esc(other.brand) +
          ', though ' +
          esc(scanBrand) +
          ' is chosen above the box. Undo these photos takes them out.</span>'
        : '') +
      '<span class="ocrhint">' +
      q.per
        .map(
          (x, i) =>
            'Photo ' +
            (i + 1) +
            ': ' +
            (x.failed ? 'not read' : x.added + ' added' + (x.asked ? ', ' + x.asked + ' to choose' : '')),
        )
        .join(' · ') +
      '</span>' +
      '<span class="ocrhint">The last photo is shown. Caps without a box weren’t read: a closer photo of them reads them.</span>';
  } else if (sum && r.done && !r.failed)
    sum.innerHTML =
      '<span class="ocrleg"><span>Read</span><span class="am">To check</span></span>' +
      (r.brand && scanBrand && r.brand !== scanBrand
        ? '<span class="ocrwarn">These look like ' +
          esc(r.brand) +
          ' caps, so they went in as ' +
          esc(r.brand) +
          ', though ' +
          esc(scanBrand) +
          ' is chosen above the box. Undo this photo takes them out.</span>'
        : '') +
      '<span class="ocrhint">Caps without a box weren’t read: a closer photo of them reads them.</span>';
}
// the boxes over the photo: green for a code added, amber for one to check; names not drawn
function ocrDraw(r) {
  if (!r.cv || !r.img) return;
  const show = r.img.show,
    cv = r.cv,
    k = show.width / r.img.w;
  cv.width = show.width;
  cv.height = show.height;
  const x = cv.getContext('2d'),
    vw = ocrV().clientWidth || show.width,
    wide = vw >= 500,
    // (in the canvas's own pixels, for lines and labels the same size on the screen whatever the photo's shown at)
    px = show.width / Math.min(vw, show.width);
  x.lineWidth = 2.5 * px;
  x.font = '600 ' + Math.round(12 * px) + 'px system-ui, sans-serif';
  // (once the photo's done, a code that went in at its end, read as a pasted line, is read too: green, not amber)
  const added = r.done ? new Set(scanList.filter((e) => !e.ask && e.photo === r.n).map((e) => e.i)) : null,
    brand = (r.done && r.brand) || scanBrand;
  r.items.forEach((it) => {
    if (!it || it.nameOf || !it.text) return;
    let cs = r.taken.has(it.id) ? ocrCodes(it.text, scanBrand) : ocrCodes(it.text, brand);
    const sure = r.taken.has(it.id) || (added && cs.length === 1 && added.has(cs[0].i));
    if (!sure && !cs.length) cs = ocrCodes(it.text, '');
    if (!sure && !cs.length) return;
    const [cx, cy, w, h, a] = it.box;
    x.save();
    x.translate(cx * k, cy * k);
    x.rotate((a * Math.PI) / 180);
    x.strokeStyle = sure ? '#4cd39a' : '#ffb547';
    x.strokeRect((-w / 2) * k, (-h / 2) * k, w * k, h * k);
    x.restore();
    if (wide) {
      const label = sure && cs.length ? COLORS[cs[0].i].code : it.text.slice(0, 8);
      x.fillStyle = 'rgba(15,20,18,.85)';
      const tw = x.measureText(label).width + 6 * px;
      x.fillRect(cx * k - tw / 2, cy * k - (h * k) / 2 - 17 * px, tw, 15 * px);
      x.fillStyle = sure ? '#7ff0bf' : '#ffcf85';
      x.fillText(label, cx * k - tw / 2 + 3 * px, cy * k - (h * k) / 2 - 5 * px);
    }
  });
}
function ocrButtons(r) {
  const b = $('ocrBtns');
  if (!b) return;
  const q = ocrQ,
    many = q && q.files.length > 1,
    going = !r.done || (many && q.k < q.files.length && !q.stop);
  if (going) {
    if ($('ocrStop')) return;
    b.innerHTML = '<button type="button" class="obGhost" id="ocrStop">Stop</button>';
    $('ocrStop').addEventListener('click', function () {
      if (ocrQ) ocrQ.stop = true;
      const r = ocrRun;
      if (!r || r.done) return;
      // (the worker told, once it has the photo; else the photo's read ends before it's sent)
      r.stop = true;
      if (ocrW && r.sent) ocrW.postMessage({ t: 'stop' });
    });
    // (the keyboard's and a screen reader's place: on Stop, the only button, not lost with the one tapped before)
    $('ocrStop').focus({ preventScroll: true });
    return;
  }
  const undo = many ? q.per.some((x) => x.added || x.asked) : r.added || r.asked,
    photos = many && q.per.length > 1 ? 'these ' + q.per.length + ' photos' : 'this photo';
  b.innerHTML =
    '<button type="button" class="btn-primary" id="ocrDone">Done</button>' +
    '<button type="button" class="obSecond" id="ocrMore">' +
    (many ? 'Read more photos' : 'Read another photo') +
    '</button>' +
    (undo ? '<button type="button" class="obGhost" id="ocrUndo">Undo ' + photos + '</button>' : '');
  $('ocrDone').addEventListener('click', ocrFinish);
  $('ocrMore').addEventListener('click', function () {
    ocrRun = null;
    ocrQ = null;
    ocrOk ? ocrPick() : ocrOpenTap();
  });
  if ($('ocrUndo'))
    $('ocrUndo').addEventListener('click', function () {
      const n = scanList.length,
        n0 = many ? q.n0 : r.n;
      scanList = scanList.filter((e) => !(e.photo >= n0 && e.photo <= r.n));
      scanRender();
      ocrRun = null;
      ocrQ = null;
      ocrHide();
      scanSay(
        'same',
        (many ? 'Photos' : 'Photo') + ' taken back out',
        n - scanList.length + ' off the list',
        -1,
      );
      scanFocusBox();
    });
  $('ocrDone').focus({ preventScroll: true });
}
const ocrNPhotos = (n) => (n === 1 ? '1 photo' : n + ' photos');
// Done: back to the list, with what the photo added said on its card
function ocrFinish() {
  const r = ocrRun,
    q = ocrQ,
    many = q && q.files.length > 1;
  ocrRun = null;
  ocrQ = null;
  ocrHide();
  if (many) {
    const added = q.per.reduce((s, x) => s + x.added, 0),
      asked = q.per.reduce((s, x) => s + x.asked, 0);
    scanSay(
      added ? 'ok' : 'same',
      'From ' + ocrNPhotos(q.per.length) + ': ' + (added ? added + ' added to the list' : 'nothing new'),
      asked ? asked + ' to choose in the list below' : 'Check them below, then Add',
      -1,
    );
  } else if (r && r.done && !r.failed)
    scanSay(
      r.added ? 'ok' : 'same',
      r.added ? 'From the photo: ' + r.added + ' added to the list' : 'From the photo: nothing new',
      r.asked ? r.asked + ' to choose in the list below' : 'Check them below, then Add',
      -1,
    );
  scanRender();
  scanFocusBox();
}
// Scan closing: the read stopped, the worker ended (its memory with it)
function ocrClose() {
  if (ocrDown) ocrDown.ctl.abort();
  ocrDown = null;
  if (ocrRun && !ocrRun.done && ocrW) ocrW.postMessage({ t: 'stop' });
  ocrRun = null;
  ocrQ = null;
  // (the count goes on: the list keeps its marks while the app is open, and a photo read after Scan's reopened must
  // not share a number with one read before, or Undo this photo takes that one's codes out too, and Done counts them)
  ocrEnd();
  if (ocrV() && !ocrV().hidden) ocrHide();
}
(function () {
  const b = $('ocrOpen'),
    f = $('ocrFile');
  if (!b || !f) return;
  b.addEventListener('click', ocrOpenTap);
  f.addEventListener('change', function () {
    const files = f.files ? [...f.files] : [];
    if (files.length) ocrChosen(files);
  });
  // (the app put away while nothing's being read: the worker's memory given back)
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && ocrW && !(ocrRun && !ocrRun.done)) ocrEnd();
  });
})();
