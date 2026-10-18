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
  // (the photo read gently since running out of memory, for a fortnight: one shortfall, other apps open, isn't for ever.
  // v318.1: gently is the detector in four strips, as an iPad's or iPhone's always is, not at 1280 px: in Safari's engine
  // a 12 MP tray's peak was the same within the noise, 1016 MB at 1600 px in four strips, 1028 at 1280 (three runs
  // each), and 1280 px added wrong codes: Ben's Copic set 6, his wide trays 1, close-ups 1, none at 1600)
  OCR_LOW_DAYS = 14,
  OCR_LOW_KEY = 'ms-ocr-low',
  // (v318.9) a photo whose codes are small in it is read again closer: decoded up to 4096 px instead of 2048 and the
  // detector at 3200 in 16 strips, when the first look's line height (in the 2048 copy) is under 25 px and the photo is
  // more than 2560 px. On Ben's 42 photos of a whole bag and a Copic case, by scene, those not tuned on: Ohuhu 70 → 93%
  // of the caps read, Copic 85 → 88%; 23 wrong → 19, read off another cap 20 → 12; his 39 earlier photos as before. Twice
  // as long for a whole bag, three or four times for a Copic case; the page's peak +22–35% in Safari's engine
  OCR_DETAIL_LINE = 25,
  OCR_DETAIL_SIDE = 4096,
  OCR_DETAIL_MIN = 2560;
const ocrUrl = (f) => new URL(OCR_DIR + f, location.href).href;
let ocrW = null, // the worker
  ocrReady = null, // its start: a promise
  ocrRun = null, // the read under way: { n, img, lines, taken, held, ... }
  // photos read since Scan opened (Undo this photo marks; v318.7: numbered on from the list's, kept through a reload)
  ocrPhotos = typeof scanPhotoMax === 'function' ? scanPhotoMax() : 0,
  ocrDown = null, // a download under way: { ctl }
  // (v318 prototype) several photos chosen at once: read in turn, one summary at the end
  // { files, k (the next to read), n0 (the first's photo number), per: [{ name, added, asked, failed }], stop }
  ocrQ = null,
  ocrOk = false, // the reader known to be stored: the card's tap opens the photo picker straight away
  // (questions in the list answered by a photo's codes: [{ e, by: its photo }], for Undo)
  ocrAnswered = [];

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
  else if (m.t === 'done') {
    if (m.detail) ocrDetail(r, m);
    else ocrDone(r, m);
  }
}
// (v318.9) the first look found the codes small: the photo read again, larger and closer. Not the photo's end: the read
// goes on (r.sent and the busy mark as they are, Stop as it is), its pixels let go of and decoded again larger by ocrGo
function ocrDetail(r, m) {
  if (r.done) return;
  r.detail = true;
  r.lineH = m.stat && m.stat.detail ? m.stat.detail.lineH : 0;
  r.img.data = null;
  ocrGo(r);
}

// --- reading a line: the codes in it, as Scan reads them; [{ i (the marker), n: how many it could be }]
function ocrCodes(text, brand) {
  if (!text) return [];
  const r = scanRead(text, brand);
  return (r.codes || [])
    .filter((c) => c.opts.length)
    .map((c) => ({ i: c.opts[0], n: c.opts.length, asked: c.asked, old: (c.oldOf || []).length > 0 }));
}
// a line read: a code for sure, of one marker, into the list now; else kept for the end of the photo
function ocrLine(r, it) {
  r.items.set(it.id, it);
  if (it.nameOf) return;
  scanPhoto = true;
  try {
    ocrLineRead(r, it);
  } finally {
    scanPhoto = false;
  }
  ocrSoon(r);
}
function ocrLineRead(r, it) {
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
  // (v318.2) digits alone read as a code with letters ("808", B08): asked at the end of the photo, as they are read here
  // (read again at the end with the words beside them, they'd be no code at all)
  if (cs.length === 1 && cs[0].asked === 'confirm' && !ocrCut(r, it, ''))
    (r.bent = r.bent || []).push({ t: it.text, i: cs[0].i, id: it.id });
  // (a lone character, the blender's 0, never at once: only at the end, with its name)
  // (v318.4 e2e: nor a code at the photo's edge that may be its cap's cut short, ocrCut)
  if (
    !it.unsure &&
    !ocrCut(r, it, '') &&
    it.text.length >= 2 &&
    cs.length === 1 &&
    cs[0].n === 1 &&
    !cs[0].asked &&
    mine &&
    COLORS[cs[0].i].code.length >= 2 &&
    // (v318.2: nor by an old code, nor a reading with letters that isn't the code as it's printed, give or take a
    // letter for a digit: they wait for the end of the photo, its generation and its names. "W60g" had gone in at once as
    // WG06)
    !cs[0].old &&
    // (v318.12: nor a Copic code that may be a longer one's tail: it waits for its read again, ocrWidenWait)
    !ocrWidenWait(cs[0].i) &&
    (!/[A-Za-z]/.test(it.text) || ocrAsRead(it.text, scanKey(COLORS[cs[0].i].code)))
  ) {
    const was = scanList.length;
    if (scanTake(cs[0].i, '', true, true) && scanList.length > was) scanList[0].photo = r.n;
    r.taken.add(it.id);
    r.sure++;
  }
}
// (v318.7) a cap this photo read for sure (at once and still so at its end, or settled at its end as one marker) that
// was in the list already, from an earlier photo or a sweep: a tray photographed again, to see that nothing was missed,
// had said "No new codes read" and drawn the caps its end settled (codes both brands have, unsure lines) amber, to
// check, with no question in the list. Those caps are drawn as read and counted, "69 already in the list" (r.listed,
// worked out at the photo's end). Not an unsure reading, nor one the settling throws out (a scrap read short, a cap
// cut by the edge): a B05 read unsure over a B06 cap, with B05 listed, stays amber
function ocrListed(r, i) {
  const e = scanList.find((e) => !e.ask && e.i === i);
  if (e && e.photo !== r.n) r.listed.add(i);
}
// (v318.3) a code's line read as no code: its first other reading (letters and digits, 3 characters or more, at least
// 0.75 sure and 0.8 times as sure as the best) that's one code of one marker, as an unsure line
function ocrAlt(r, x) {
  if (x.nameOf || !x.alts || !x.alts.length) return x;
  const brand = ocrBrandOf(r) || scanBrand,
    as = scanRead(x.text, brand),
    // (v318.3 debug: another brand's code read as it is holds a code: only a reading that's more of it is taken. Ohuhu's
    // E711 with Copic chosen, read next as "E71", had gone in as Copic E71, and R014 as Copic R14, where they're asked
    // about as another brand's; Copic's E51 read off Ohuhu's E515, next read whole, is still E515)
    other = (as.other || []).length ? scanKey(x.text) : '';
  // (v318.7: digits alone, bent into a code to ask about, hold none for this: "879" by one look is "G28" by the other,
  // read nearly as surely, and was asked about as B79)
  if ((as.codes || []).some((c) => c.opts.length) && /[A-Za-z]/.test(x.text)) return x;
  for (const [t, cf, turn] of x.alts) {
    if (t === x.text || !/[A-Za-z]/.test(t) || scanKey(t).length < 3 || cf < 0.75 || cf < 0.8 * x.conf)
      continue;
    if (other && scanKey(t).indexOf(other) < 0) continue;
    const cs = ocrCodes(t, brand);
    if (cs.length === 1 && cs[0].n === 1 && !cs[0].asked)
      return Object.assign({}, x, { text: t, conf: cf, unsure: true, turn: turn || 0 });
  }
  return x;
}
// (v318.4 e2e) a code's line reaching the photo's edge, its cap cut by it, whose reading may be the cap's code cut short:
// the start or end of another code of the brand ('' either), or not the code as printed. On synthetic trays "/R312" of
// YR312 had gone in at once as R312, and "G1 Dusty" of G113, "G3" of G316, "Eg9" of Egg Yellow were asked about with no
// right answer; a cap the edge cuts is read whole in the next photo
function ocrCut(r, x, brand) {
  if (!r.img || !r.img.w || x.nameOf || !/\d/.test(x.text) || !x.box) return false;
  const [cx, cy, w, h, a0] = x.box,
    a = (a0 * Math.PI) / 180;
  let d = Infinity;
  for (const sx of [-1, 1])
    for (const sy of [-1, 1]) {
      const px = cx + (sx * w * Math.cos(a) - sy * h * Math.sin(a)) / 2,
        py = cy + (sx * w * Math.sin(a) + sy * h * Math.cos(a)) / 2;
      d = Math.min(d, px, py, r.img.w - px, r.img.h - py);
    }
  if (d > 2) return false;
  return (scanRead(x.text, '').codes || []).some((c) => {
    if (!c.opts.length) return false;
    const k = scanKey(c.code);
    return (
      !ocrAsRead(x.text, k) ||
      COLORS.some((o) => {
        const ko = scanKey(o.code);
        return (!brand || o.brand === brand) && ko !== k && (ko.startsWith(k) || ko.endsWith(k));
      })
    );
  });
}
// (v318.3) the photo's questions, each with the cap it's about from the photo: the line asked about (its reading, a
// code of one of its answers, or a name that is one), cut from the photo's pixels while they're still here, turned as
// the reader read it, so it's the right way up
function ocrCropQuestions(r, lines) {
  if (!r.img || !r.img.data) return;
  // (a code that's one of the answers as it is now: not by its old code, YR33 for Y29 Melon Yellow once YR33)
  const codeOf = (x, opts) =>
    (scanRead(x.text, '').codes || []).some((c) =>
      c.opts.some((i) => opts.has(i) && (c.oldOf || []).indexOf(i) < 0),
    );
  // (v318.4 review: a line that went in for sure first, as it's no question: "YR11 Orange" asked, YR11 Peachy Blush's own
  // cap, read before it and added, had been the picture)
  const find = (f) => lines.find((x) => !r.taken.has(x.id) && f(x)) || lines.find(f),
    words = (t) =>
      String(t)
        .normalize('NFKC')
        .toUpperCase()
        .split(/[^A-Z0-9-]+/)
        .map((w) => w.replace(/-/g, ''));
  scanList.forEach((e) => {
    if (!e.ask || e.photo !== r.n || e.crop) return;
    const opts = new Set(e.opts.map((o) => o.i)),
      // (a name read is its brand's: Yellow Green is Ohuhu's YG012 and Copic's own)
      brand = COLORS[e.opts[0].i].brand,
      // (v318.4 review: or as Scan read it, "p3" asked as P3, or put right more than one way, "E1T: E11 or E17?")
      m = /^(?:confirm|fix) (.+)$/.exec(e.ask);
    let line = m
      ? find((x) => !x.nameOf && x.text === m[1]) ||
        find((x) => !x.nameOf && words(x.text).indexOf(m[1]) >= 0)
      : null;
    // (v318.3 debug: a question about a code, "Which G410?", is about the line read as that code first: the first line
    // of any of its answers had been taken, and with G24's cap read before it, G24's was the picture, a cap already added)
    const k = /^(?:name|old|brands|num|hint|turned) (\S+)/.exec(e.ask),
      is = (x) =>
        !x.nameOf &&
        (scanRead(x.text, '').codes || []).some((c) => c.code === k[1] && c.opts.some((i) => opts.has(i))),
      // (v318.4 review: the code and the name not matching, the line whose own names don't: "R29 Lipstick Red" and
      // "R29 Crimson" read, the first, added, had been the picture)
      odd = (x) => {
        scanGen = r.gen || '';
        try {
          const nm = lines.filter((y) => y.nameOf === x.id).map((y) => y.text);
          return (scanRead([x.text].concat(nm).join(' '), r.brand || scanBrand).codes || []).some(
            (c) => c.asked === 'name',
          );
        } finally {
          scanGen = '';
        }
      };
    if (!line && k && /^name /.test(e.ask)) line = find((x) => is(x) && odd(x));
    if (!line && k) line = find(is);
    if (!line && !/^byname/.test(e.ask))
      line = find((x) => !x.nameOf && /\d/.test(x.text) && codeOf(x, opts));
    // (a name read: a line that's the name itself, the one read on the cap; else a cap's line with its names, or those
    // names alone)
    // (v318.4 e2e: in either order, as the photo's end reads a cap's names in reading order: BV00's "Shadow" then
    // "Mauve" had found no line, and its question had no picture)
    const names = (nm) =>
      nm.length &&
      (opts.has(scanRead(nm.join(' '), brand).byName) ||
        opts.has(scanRead(nm.slice().reverse().join(' '), brand).byName));
    if (!line) line = find((x) => !/\d/.test(x.text) && names([x.text]));
    if (!line)
      line = find((x) => {
        if (x.nameOf) return false;
        const ns = lines.filter((y) => y.nameOf === x.id).map((y) => y.text);
        return names((/\d/.test(x.text) ? [] : [x.text]).concat(ns)) || names(ns);
      });
    if (!line) return;
    try {
      const c = ocrCrop(r.img.data, line.box, line.turn || 0);
      if (c) e.crop = c;
    } catch (_) {}
  });
}
// a square of the photo round a box (a cap's code or name and some of the cap round it), upright, as a small JPEG
function ocrCrop(img, box, turn) {
  const [cx, cy, w, h, a] = box,
    // (a short reading's box is a scrap of its cap: at least three times its height round it)
    R = Math.max(1.25 * Math.max(w, h), 3 * Math.min(w, h)),
    // (the corners of the square turned: a little more of the photo round it)
    Q = Math.ceil(R * 1.45),
    x0 = Math.max(0, Math.round(cx - Q)),
    y0 = Math.max(0, Math.round(cy - Q)),
    x1 = Math.min(img.width, Math.round(cx + Q)),
    y1 = Math.min(img.height, Math.round(cy + Q));
  if (x1 - x0 < 4 || y1 - y0 < 4) return '';
  const part = document.createElement('canvas');
  part.width = x1 - x0;
  part.height = y1 - y0;
  part.getContext('2d').putImageData(img, -x0, -y0, x0, y0, x1 - x0, y1 - y0);
  // (sharp enough for the larger view on a 3× screen at about 160 points)
  const OUT = 360,
    out = document.createElement('canvas'),
    g = out.getContext('2d');
  out.width = out.height = OUT;
  g.fillStyle = '#111';
  g.fillRect(0, 0, OUT, OUT);
  g.translate(OUT / 2, OUT / 2);
  g.scale(OUT / (2 * R), OUT / (2 * R));
  g.rotate((-(a + turn) * Math.PI) / 180);
  g.drawImage(part, x0 - cx, y0 - cy);
  const url = out.toDataURL('image/jpeg', 0.82);
  // (v318.3 debug: both canvases' memory given back now, as ocrPhoto's is, not when they're collected: Safari counts
  // canvases waiting for that against its limit, and a busy photo's questions left a megabyte or more each)
  part.width = part.height = out.width = out.height = 1;
  return url;
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
// (v318.1) a photo's lines without the parts of caps read as codes of their own; what went in at once for one of them
// is taken back out of the list:
// - a code inside a longer one read in the same place, by either look ("V91" of RV91, "Y00" of BGY00, "G3" of G316,
//   read as Ohuhu's old G3, now G311), unless the names read with it are its own;
// - a code that went in at once, read for sure, whose names Scan takes for another marker's ("V91" with "Grayish
//   Cherry", RV91's name): asked about, as Scan asks about a typed code and name that don't match.
function ocrParts(r, lines) {
  // (v318.9: an O read for a 0, as no code has the letter: "VO15" of BV015, read at the photo's edge, its B cut off,
  // had stayed in beside it as V015)
  const key = (t) =>
      String(t)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .replace(/O/g, '0'),
    markers = (t) =>
      (scanRead(t, '').codes || []).filter((c) => c.opts.length).reduce((a, c) => a.concat(c.opts), []),
    names = (x) => lines.filter((y) => y.nameOf === x.id).map((y) => y.text),
    ins = (b, x, y) => {
      const a = (b[4] * Math.PI) / 180,
        dx = x - b[0],
        dy = y - b[1],
        m4 = 0.25 * b[3];
      return (
        Math.abs(dx * Math.cos(a) + dy * Math.sin(a)) <= b[2] / 2 + m4 &&
        Math.abs(-dx * Math.sin(a) + dy * Math.cos(a)) <= b[3] / 2 + m4
      );
    },
    over = (p, q) => ins(p.box, q.box[0], q.box[1]) || ins(q.box, p.box[0], p.box[1]),
    codes = lines.filter((x) => !x.nameOf && /\d/.test(x.text)),
    // (the photo's brand, as its other questions are asked: not another brand's marker of the same code)
    brand = ocrBrandOf(r) || scanBrand,
    drop = new Set(),
    // (v318.4 review: a code taken at once whose names make it another brand's marker of that code, as Scan reads them:
    // taken back out and read again with them below, as when it's unsure. "RV29 Crimson", Copic's cap with Ohuhu chosen,
    // had stayed in as Ohuhu's RV29 Plum Pink, the names agreeing with a marker of the code, though not the one added)
    again = new Set(),
    asked = new Set(),
    ask = [];
  codes.forEach((x) => {
    const k = key(x.text),
      own = markers(x.text),
      nm = names(x),
      mine = own.length && own.some((i) => ocrNameAgrees(i, nm));
    if (r.taken.has(x.id) && nm.length) {
      const o = scanRead([x.text].concat(nm).join(' '), brand);
      if (!(o.codes || []).some((c) => c.opts.length) && (o.other || []).length) return again.add(x.id);
    }
    if (!own.length || mine) return;
    if (
      k.length >= 2 &&
      codes.some((y) => {
        const ky = key(y.text);
        return y !== x && ky.length > k.length && ky.indexOf(k) >= 0 && over(x, y) && markers(y.text).length;
      })
    )
      return drop.add(x.id);
    // (only Scan's own "the code and the name don't match": a scrap of a name read as a code, "R|ush", isn't one)
    if (r.taken.has(x.id) && nm.length) {
      const a = (scanRead([x.text].concat(nm).join(' '), brand).codes || []).find(
        (c) => c.asked === 'name' && c.opts.some((i) => own.indexOf(i) >= 0),
      );
      if (a) {
        ask.push({ k: 'name ' + a.code + ' ' + a.opts.map(mkey).join(','), opts: a.opts });
        drop.add(x.id);
        asked.add(x.id);
      } else if (ocrForeign(x.text, nm, brand)) {
        // (v318.2) a word of another marker's name, none of its own: asked (v318.3 debug: of the photo's brand, or the
        // one chosen, as the questions below are: "B21 Peacock" on a tray of Ohuhu caps had offered Copic's B21 too)
        const of = own.filter((i) => !brand || COLORS[i].brand === brand);
        ask.push({
          k: 'confirm ' + x.text,
          opts: of.length ? of : own,
          t: '“' + [x.text].concat(nm).join(' ') + '” read: is it this one?',
        });
        drop.add(x.id);
        asked.add(x.id);
      }
    }
  });
  // (v318.4 review: and the same cap read again in the same place without names, by the other look or as a line of its
  // box, goes with the reading asked about or read again: it had kept what their names asked about in, unasked. One
  // with names of its own was looked at on its own above; nor with a part of a longer code left out)
  [asked, again].forEach((s) =>
    codes.forEach((y) => {
      if (
        s.has(y.id) ||
        names(y).length ||
        !codes.some((x) => s.has(x.id) && key(x.text) === key(y.text) && over(x, y))
      )
        return;
      s.add(y.id);
      if (s === asked) drop.add(y.id);
    }),
  );
  // (what went in at once for a line left out or read again, unless another line kept took the same marker)
  const back = new Set();
  r.taken.forEach((id) => {
    if (!drop.has(id) && !again.has(id)) return;
    const x = lines.find((y) => y.id === id) || r.items.get(id);
    r.taken.delete(id);
    r.sure = Math.max(0, r.sure - 1);
    if (x) ocrCodes(x.text, scanBrand).forEach((c) => back.add(c.i));
  });
  r.taken.forEach((id) => {
    const x = lines.find((y) => y.id === id) || r.items.get(id);
    if (x) ocrCodes(x.text, scanBrand).forEach((c) => back.delete(c.i));
  });
  if (back.size) scanList = scanList.filter((e) => e.ask || e.photo !== r.n || !back.has(e.i));
  ask.forEach((x) => {
    const asked = scanAsk(
      x.k,
      x.t || 'The code and the name read don’t match: which one?',
      x.opts.map((i) => ({ i: i, how: 'chosen' })),
      true,
      true,
    );
    // (this photo's question: counted for it, and taken out by Undo this photo)
    if (asked === true) scanList[0].photo = r.n;
  });
  return lines.filter((x) => !drop.has(x.id) && !(x.nameOf && drop.has(x.nameOf)));
}
// (v318.4 e2e) a code taken at once with a brand chosen whose names read are another brand's marker of the same code, and
// not the one taken: taken back out of the list and asked about, as Scan asks about "E81 Ivory" typed with Ohuhu chosen;
// its lines left out of the rest. On a drawn tray of both brands with Ohuhu chosen, Copic's E81 Ivory and E97 Deep
// Orange had gone in as Ohuhu's E81 and E97 (with Copic chosen, Ohuhu's Y00 Lemon Mist and Y06 Butter as Copic's). Not
// on a photo plainly the other brand's, read again whole under its brand (ocrSettle)
function ocrNamedOther(r, lines) {
  const seen = ocrBrandOf(r);
  if (!scanBrand || (seen && seen !== scanBrand)) return lines;
  const out = new Set();
  lines.forEach((x) => {
    if (!r.taken.has(x.id)) return;
    const nm = lines.filter((y) => y.nameOf === x.id).map((y) => y.text),
      t = ocrCodes(x.text, scanBrand).map((c) => c.i);
    if (!nm.length || !t.length || t.some((i) => ocrNameAgrees(i, nm))) return;
    // (by a word of its name, or by Scan's own reading of the code and the names: "Deep Orange" is all plain words)
    const other = scanRead([x.text].concat(nm).join(' '), scanBrand).other || [],
      o = [...new Set([].concat(...(scanRead(x.text, '').codes || []).map((c) => c.opts)))].filter(
        (i) => COLORS[i].brand !== scanBrand && (ocrNameAgrees(i, nm) || other.indexOf(i) >= 0),
      );
    if (o.length !== 1) return;
    // (and the same cap read again in the same place without names goes with it, as in ocrParts: it had kept the
    // marker in, the question dropped as answered)
    const k = scanKey(x.text),
      near = (p, q) =>
        Math.abs(p.box[0] - q.box[0]) <= Math.max(p.box[2], p.box[3]) / 2 &&
        Math.abs(p.box[1] - q.box[1]) <= Math.max(p.box[2], p.box[3]) / 2;
    lines.forEach((y) => {
      if (
        y !== x &&
        !y.nameOf &&
        r.taken.has(y.id) &&
        scanKey(y.text) === k &&
        near(x, y) &&
        !lines.some((z) => z.nameOf === y.id)
      ) {
        r.taken.delete(y.id);
        r.sure = Math.max(0, r.sure - 1);
        out.add(y.id);
      }
    });
    r.taken.delete(x.id);
    r.sure = Math.max(0, r.sure - 1);
    out.add(x.id);
    // (unless another line taken at once took the same marker)
    const still = [...r.taken].some((id) => {
      const y = r.items.get(id);
      return y && ocrCodes(y.text, scanBrand).some((c) => t.indexOf(c.i) >= 0);
    });
    if (!still) scanList = scanList.filter((e) => e.ask || e.photo !== r.n || t.indexOf(e.i) < 0);
    if (
      scanAsk(
        'other ' + mkey(o[0]),
        'Another brand than the one chosen (' + scanBrand + '): add it?',
        [{ i: o[0], how: 'name' }],
        true,
        true,
      ) === true
    )
      scanList[0].photo = r.n;
  });
  return out.size ? lines.filter((x) => !out.has(x.id) && !out.has(x.nameOf)) : lines;
}
// (v318.12) the Copic codes that are the tail of a longer one with a letter more at its head (G03 of YG03, R20 of
// YR20, V04 of BV04, RV04): short, read again by the engine with its box grown at the code's start (o.widen); long,
// what such a read may turn it into. Worked out once from the markers
let _ocrWiden = null;
function ocrWidenSets() {
  if (_ocrWiden) return _ocrWiden;
  const cc = new Set();
  COLORS.forEach(function (c) {
    if (c.brand === 'Copic') cc.add(scanKey(c.code));
  });
  const short = [],
    long = [];
  cc.forEach(function (k) {
    let any = false;
    for (let L = 65; L <= 90; L++) {
      const w = String.fromCharCode(L) + k;
      if (cc.has(w)) {
        long.push(w);
        any = true;
      }
    }
    if (any) short.push(k);
  });
  _ocrWiden = { short: short.sort(), long: long.sort() };
  return _ocrWiden;
}
// a code to hold back from going in at once, as the engine reads it again for a lost first letter (not when the brand
// chosen is Ohuhu: no read again then)
function ocrWidenWait(i) {
  const c = COLORS[i];
  return (
    !!c && c.brand === 'Copic' && scanBrand !== 'Ohuhu' && ocrWidenSets().short.indexOf(scanKey(c.code)) >= 0
  );
}
// (v318.4 e2e) a line of words read with a "|" for an l, "R|ush" of Blush cut by the photo's edge: the l it is, not a 1
// (read as R1, Ohuhu's old code for R210, it had been asked about with no right answer and no picture)
function ocrNoPipes(m) {
  const fix = (t) => (/\d/.test(t) ? t : t.replace(/\|/g, 'l'));
  return Object.assign({}, m, {
    lines: (m.lines || []).map((x) =>
      /\|/.test(x.text) && !/\d/.test(x.text)
        ? Object.assign({}, x, {
            text: fix(x.text),
            alts: x.alts && x.alts.map((a) => [fix(a[0])].concat(a.slice(1))),
          })
        : x,
    ),
  });
}
// the end of the photo: what waited (the unsure, two-brand codes, the names) read by Scan with the photo's brand
function ocrDone(r, m) {
  scanPhoto = true;
  try {
    ocrSettle(r, ocrNoPipes(m));
  } finally {
    scanPhoto = false;
    scanGen = '';
  }
}
function ocrSettle(r, m) {
  clearTimeout(r.soon);
  r.soon = 0;
  r.done = true;
  r.ms = m.ms;
  if (window.__MS_TEST) window.__ocrLast = m;
  r.aborted = m.aborted;
  try {
    localStorage.removeItem(OCR_BUSY_KEY);
  } catch (_) {}
  // (v318.2) the photo's generation: its caps read by the codes as they are now, eight at least and an old code at most
  // one in eight, and the photo is of them ('new': scanGen)
  let cur = 0,
    old = 0;
  const b0 = ocrBrandOf(r) || scanBrand;
  m.lines.forEach((x) => {
    if (x.nameOf || !/\d/.test(x.text)) return;
    (scanRead(x.text, b0).codes || []).forEach((c) => {
      if (!c.opts.length) return;
      const o = (c.oldOf || []).length;
      if (!o) cur++;
      else if (o === c.opts.length) old++;
    });
  });
  r.gen = cur >= 8 && old * 8 <= cur ? 'new' : '';
  // (v318.3) a code's line whose reading holds no code: its next reading that does, read nearly as surely ("E19" over
  // "61", "V000" over "000A"), as unsure (settled at the end, with its names)
  scanGen = r.gen;
  try {
    m = Object.assign({}, m, { lines: m.lines.map((x) => ocrAlt(r, x)) });
  } finally {
    scanGen = '';
  }
  // (a part of a cap read as a code: left out, and taken back out of the list when it went in at once)
  // (every line, as read, for the questions' pictures: a part of a cap left out below may be what's asked about)
  const read0 = m.lines;
  m = Object.assign({}, m, { lines: ocrParts(r, ocrNamedOther(r, m.lines)) });
  // (each code's line with its names after it, the order Scan's reading of a list wants; a code already added
  // needs neither again)
  const items = new Map(m.lines.map((x) => [x.id, x])),
    text = [],
    // (v318.2) a code whose every reading was unsure, read apart: only an old code dropped by the photo's generation,
    // no current one chosen over another's old one; and readings to confirm, asked)
    textU = [],
    confirm = [];
  r.taken.forEach((id) => !items.has(id) && r.items.has(id) && items.set(id, r.items.get(id)));
  r.items = items;
  // (on a tray plainly of one brand, another brand's code that's the start or the end of a code of this one read in
  // the photo too, E71 beside E711 or Y13 beside BGY13, or one read unsure, is that cap read short, or a misreading:
  // left out, not asked about. A code both brands have now is the photo's brand's, never left out: E81 beside E814
  // had been, as Copic's E81 comes first)
  const seen = ocrBrandOf(r),
    // (a brand chosen, and the photo plainly the other brand's: what went in at once under the brand chosen, before
    // the photo's brand showed, comes out, and is read again with the rest under the photo's brand)
    swap = !!(seen && scanBrand && seen !== scanBrand),
    ownCodes = seen
      ? [].concat(
          ...m.lines.map((x) => ocrCodes(x.text, seen).map((c) => COLORS[c.i].code.replace(/-/g, ''))),
        )
      : [],
    codesIn = (t) => (scanRead(t, '').codes || []).filter((c) => c.opts.length),
    // (a marker the code is now, not one it was: Ohuhu's E515 was Y13)
    now = (c, i) => (c.oldOf || []).indexOf(i) < 0,
    short = (x) => {
      if (!seen) return false;
      const cs = codesIn(x.text),
        other = [];
      cs.forEach((c) => c.opts.forEach((i) => COLORS[i].brand !== seen && now(c, i) && other.push(i)));
      // (the photo's brand has the code now, or only another brand's old code is it, P3 an Ohuhu V18's: not short)
      if (!other.length || cs.some((c) => c.opts.some((i) => COLORS[i].brand === seen && now(c, i))))
        return false;
      const k = COLORS[other[0]].code.replace(/-/g, '');
      return x.unsure || ownCodes.some((o) => o !== k && (o.indexOf(k) === 0 || o.slice(-k.length) === k));
    },
    // (the same cap read twice, by each look or as a whole box and a line of it: one line, with the names read by
    // either, so a name read once settles it; "R23" with no name beside "R23 Sakura" had been asked about)
    key = (t) => t.toUpperCase().replace(/[^A-Z0-9]/g, ''),
    inBox = (b, x, y, m) => {
      const a = (b[4] * Math.PI) / 180,
        dx = x - b[0],
        dy = y - b[1],
        m4 = (m === undefined ? 0.25 : m) * b[3];
      return (
        Math.abs(dx * Math.cos(a) + dy * Math.sin(a)) <= b[2] / 2 + m4 &&
        Math.abs(-dx * Math.sin(a) + dy * Math.cos(a)) <= b[3] / 2 + m4
      );
    },
    groups = [],
    // (v318.6 debug) the markers whose name was read with their code: another brand's cap read whole on a tray plainly of
    // one brand is asked about, not left out as that brand's code read short. "E71 Brick Beige", Copic's, on a tray of
    // Ohuhu caps had gone without a word as E711's start, "BG11 Moon White" as BG114's, "Y13 Lemon Yellow" as BGY13's
    // end (a cap whose name alone was read is asked about; one read whole was dropped)
    agreed = new Set(),
    // (v318.7) a reading that would be asked about whose centre is inside (no margin) a line read for sure as a word, not
    // its own name ("663" and "Eg9" read off Egg Yellow's "Eggnog" and "Egg" had been asked as GG05 and E69), or, digits
    // alone, inside a line read as a code with letters ("804" over "BG04", asked as B04): that line misread, not asked
    word = (x, nm) =>
      !!x &&
      !!x.box &&
      read0.some(
        (y) =>
          y !== x &&
          y.nameOf !== x.id &&
          !(nm || []).some((n) => key(n) === key(y.text)) &&
          !y.unsure &&
          !/\d/.test(y.text) &&
          /[A-Za-z]{3}/.test(y.text) &&
          inBox(y.box, x.box[0], x.box[1], 0),
      ),
    coded = (x) =>
      !!x &&
      !!x.box &&
      read0.some(
        (y) =>
          y !== x &&
          !y.nameOf &&
          /[A-Za-z]/.test(y.text) &&
          codesIn(y.text).length &&
          inBox(y.box, x.box[0], x.box[1], 0),
      );
  m.lines.forEach((x) => {
    if (x.nameOf) return;
    const k = key(x.text),
      g = groups.find(
        (g) =>
          g.k === k &&
          g.lines.some((y) => inBox(y.box, x.box[0], x.box[1]) || inBox(x.box, y.box[0], y.box[1])),
      );
    if (g) g.lines.push(x);
    else groups.push({ k: k, lines: [x] });
  });
  groups.forEach((g) => {
    const x = g.lines[0],
      names = [];
    // (v318.2: in reading order, the line nearest the code first, so "Ballet" then "Pink" comes out "Ballet Pink")
    g.lines.forEach((l) => {
      const a = (l.box[4] * Math.PI) / 180,
        off = (y) => Math.abs(-(y.box[0] - l.box[0]) * Math.sin(a) + (y.box[1] - l.box[1]) * Math.cos(a));
      m.lines
        .filter((y) => y.nameOf === l.id)
        .sort((p, q) => off(p) - off(q))
        .forEach((y) => {
          if (names.every((n) => key(n) !== key(y.text))) names.push(y.text);
        });
    });
    // (only lines with a digit, as every code has: a lone word, "Green", read as the other brand's colour's name, had
    // been a question about it)
    if (!swap && g.lines.some((l) => r.taken.has(l.id))) return;
    if (!/\d/.test(x.text)) {
      // (v318.3) a cap whose name was read but not its code: asked about by its whole name ("Only its name was read"),
      // never added unasked; not a name that's a part of another's ("Light Apricot" of Light Apricot Pink), nor one
      // word that's a word of another's
      const nm = names.length ? names : [x.text];
      if (ocrWholeName(nm, seen || scanBrand) >= 0) text.push(nm.join(' '));
      return;
    }
    // (the code's markers whose name is read with it, by a word of it or whole, in either order: not read short, nor
    // misread by one look, nor cut by the edge, nor noise. v318.7: whole too, "V015" at the top edge with "Deep
    // Violet", its name of plain words only, had been left out of 30 reads)
    const named = [];
    codesIn(x.text).forEach((c) =>
      c.opts.forEach(
        (i) =>
          (ocrNameAgrees(i, names) || (names.length && ocrNamed(names, seen || scanBrand).indexOf(i) >= 0)) &&
          named.indexOf(i) < 0 &&
          named.push(i),
      ),
    );
    named.forEach((i) => agreed.add(i));
    if (!named.length && short({ text: x.text, unsure: g.lines.every((l) => l.unsure) })) return;
    // (v318.7) a code every reading of which was unsure, read in the same place (half a line's height either way: a
    // look's slices of one cap) as a line read for sure as another code, as printed: that cap misread by one look ("G12"
    // by one look where "G14" was read for sure, "BV25" over RV25, "YR0o" over YR09, "B000" over R000): left out, unless
    // a name read with it is one of its own markers'. Of the 53 markers added from another cap over the captured reads
    // of Ben's photos, 39 were these. Not a sure reading that's digits alone ("8411", B411's cap, beside "B411" unsure)
    if (
      !named.length &&
      g.lines.every((l) => l.unsure) &&
      groups.some(
        (h) =>
          h.k !== g.k &&
          h.lines.some(
            (y) =>
              !y.unsure &&
              /\d/.test(y.text) &&
              codesIn(y.text).some((c) => ocrAsRead(y.text, scanKey(c.code))) &&
              g.lines.some(
                (l) => inBox(l.box, y.box[0], y.box[1], 0.5) || inBox(y.box, l.box[0], l.box[1], 0.5),
              ),
          ),
      )
    )
      return;
    // (v318.4 e2e) a cap cut by the photo's edge, its code maybe read short: left out, unless a name read with it is
    // one of its code's markers'
    if (!named.length && g.lines.every((l) => ocrCut(r, l, seen || scanBrand))) return;
    // (a lone character, the blender's 0, only with its name: a seam read "0,3,5" had added Copic's 0)
    const lone = (scanRead(x.text, seen || scanBrand).codes || []).filter((c) => c.opts.length);
    if (!names.length && !/[A-Za-z]{3}/.test(x.text) && lone.length && lone.every((c) => c.code.length < 2))
      return;
    // (v318.7) digits alone that would be asked about as a code, read where a word or a code with letters was: not
    // asked (word, coded)
    if (
      !/[A-Za-z]/.test(x.text) &&
      lone.length &&
      lone.every((c) => c.asked === 'confirm' || c.asked === 'turned') &&
      g.lines.some((l) => word(l, names) || coded(l))
    )
      return;
    // (a code and its name on one line, as on the cap: a word of the name settles a code two markers answer to, R16
    // Light Salmon and RV316, once R16; the name's lines come in any order, "Pink" then "Tender")
    // (v318.2) a reading with letters that isn't the code as printed, nor with a name of its own, is asked about; so is a
    // code read with a word of another marker's name and none of its own
    // (v318.3 debug: not when Scan asks of its own which of the code and the name it is, the marker named offered too:
    // "R29 Crimson", Copic RV29's cap read short, had been asked as R29 alone, and "V91 Grayish Cherry" as V91 alone
    // when unsure, though asked V91 or RV91 when it went in at once)
    if (
      (/[A-Za-z]/.test(x.text) && !ocrExact(x.text, names, seen || scanBrand)) ||
      (names.length && ocrForeign(x.text, names, seen || scanBrand))
    ) {
      // (v318.4 review: nor when the names make it another brand's marker of the code, as Scan reads it: "RV29 Crimson"
      // with Ohuhu chosen is asked about as Copic's, not as Ohuhu's RV29 Plum Pink alone)
      const rr = scanRead([x.text].concat(names).join(' '), seen || scanBrand),
        cs = (rr.codes || []).filter((c) => c.opts.length);
      if ((!cs.length && !(rr.other || []).length) || cs.some((c) => c.asked !== 'name'))
        return confirm.push({ t: x.text, names: names, lines: g.lines });
    }
    (g.lines.every((l) => l.unsure) ? textU : text).push([x.text].concat(names).join(' '));
  });
  if (swap) {
    // (v318.4 review: not the photo's questions about a code taken at once, its line left out above: asked by the
    // photo's brand already. "B21 Peacock" with Copic chosen, on a tray of Ohuhu caps, had been missed without a word)
    scanList = scanList.filter((e) => e.photo !== r.n || e.ask);
    r.taken.clear();
    r.sure = 0;
  }
  const before = new Set(scanList),
    was = scanBrand;
  r.brand = seen;
  [
    [text, r.gen],
    [textU, r.gen ? 'strict' : ''],
  ].forEach(([t, gen]) => {
    if (!t.length) return;
    // (the photo's brand, when its codes plainly show one; else the brand chosen)
    if (seen) scanBrand = seen;
    scanMute = scanNoFlip = true;
    scanGen = gen;
    try {
      scanHandleCodes(t.join('\n'), true, true, true);
    } finally {
      scanMute = scanNoFlip = false;
      scanBrand = was;
      scanGen = '';
    }
  });
  (r.bent || []).forEach((x) => {
    const l = read0.find((y) => y.id === x.id);
    // (v318.7: nor one read again as a code with letters, ocrAlt, or read where a word or such a code was)
    if (l && (l.text !== x.t || word(l) || coded(l))) return;
    if ((!seen || COLORS[x.i].brand === seen) && !scanList.some((e) => !e.ask && e.i === x.i))
      scanAsk(
        'confirm ' + x.t,
        '“' + x.t + '” read: is it this one?',
        [{ i: x.i, how: 'chosen' }],
        true,
        true,
      );
  });
  confirm.forEach((x) => {
    if ((x.lines || []).some((l) => word(l, x.names))) return;
    scanGen = r.gen;
    const os = [];
    try {
      (scanRead(x.t, seen || scanBrand).codes || []).forEach((c) =>
        c.opts.forEach((i) => os.indexOf(i) < 0 && os.push(i)),
      );
    } finally {
      scanGen = '';
    }
    if (os.length)
      scanAsk(
        'confirm ' + x.t,
        '“' + [x.t].concat(x.names).join(' ') + '” read: is it this one?',
        os.map((i) => ({ i: i, how: 'chosen' })),
        true,
        true,
      );
  });
  // (on a tray plainly of one brand, another brand's marker offered only by its name, its code not read, isn't asked
  // about: "R47 Peach" had offered Copic's R32 Peach on a tray of Ohuhu caps)
  const read = new Set(),
    // (what this photo added: "Which R15?", R15 or the old R15 that's RV19 now, from a scrap read "RT5" beside "R15
    // Lychee Juice" that added R15, is that cap read again, or a scrap of it: not asked. Not when the marker added is the
    // one the code was: "Which WG01?" beside YGY11, once WG01, is still asked)
    got = new Set(scanList.filter((e) => !e.ask && (e.photo === r.n || !before.has(e))).map((e) => e.i));
  m.lines.forEach((x) => !x.nameOf && codesIn(x.text).forEach((c) => c.opts.forEach((i) => read.add(i))));
  scanList = scanList.filter(
    (e) =>
      before.has(e) ||
      !e.ask ||
      ((!seen || !/^other /.test(e.ask) || e.opts.some((o) => read.has(o.i))) &&
        !(/^old /.test(e.ask) && e.opts.some((o) => o.how === 'chosen' && got.has(o.i))) &&
        // (v318.3 debug: by the photo's brand, not the one chosen: a few Copic caps read with Ohuhu chosen, E71 among
        // them, are asked about, not taken for Ohuhu's E711 read short; v318.6 debug: nor one whose name was read)
        (!ocrNoise(e, seen) || e.opts.some((o) => agreed.has(o.i)))),
  );
  const auto = scanAuto();
  scanList.forEach((e) => {
    if (before.has(e)) return;
    e.photo = r.n;
    // (the brand the question names came from the photo, not from above the box)
    if (e.ask && seen && seen !== was && /^other /.test(e.ask))
      e.title = e.title.replace('than the one chosen (' + seen + ')', 'than the photo’s (' + seen + ')');
    // (v318.7 debug: with the brand set for you, and the photo not plainly one brand's, said as Scan's own reads say
    // it, "Copic E71 Champagne: add it? Ohuhu was set for you", not "than the one chosen": nothing was chosen)
    else if (e.ask && !seen && auto && /^other /.test(e.ask) && e.opts.length === 1)
      e.title =
        COLORS[e.opts[0].i].brand + ' ' + scanName(e.opts[0].i) + ': add it? ' + auto + ' was set for you';
    // (v318.7) another brand's code asked about that's an old code of the photo's brand, or the one chosen (R29, Copic's
    // and Ohuhu YR47's old code): that marker is an answer too, first, "Which R29?" (as Scan asks it typed); the
    // question had offered Copic's alone. Only a question the photo's own rules kept: a scrap read short is still none;
    // not a cap whose name was read with it, that marker's
    if (e.ask && /^other /.test(e.ask) && e.opts.length === 1 && !agreed.has(e.opts[0].i)) {
      const b = seen || was,
        k = scanKey(COLORS[e.opts[0].i].code),
        mine = b ? (scanIndex().byOld.get(k) || []).filter((i) => COLORS[i].brand === b) : [];
      if (mine.length) {
        e.opts = mine.map((i) => ({ i: i, how: 'old' })).concat(e.opts);
        e.title = 'Which ' + COLORS[e.opts[e.opts.length - 1].i].code + '?';
        e.ask = 'old ' + k;
      }
    }
  });
  // (v318.7) the caps read for sure, at once (and kept so: not a part of a cap, ocrParts, nor taken back at a swap) or
  // settled at the end as one marker, that were in the list already (ocrListed); and, with the brand set for you and
  // the photo not plainly one brand's, codes both brands use that went in as its (e.auto, for the switch to both
  // brands should the sweep show the other brand, scan.js scanSw)
  r.listed = new Set();
  r.taken.forEach((id) => {
    const x = r.items.get(id),
      cs = x ? ocrCodes(x.text, was) : [];
    if (cs.length === 1) ocrListed(r, cs[0].i);
  });
  scanGen = r.gen;
  try {
    text.forEach((t) => {
      const cs = ocrCodes(t, seen || was);
      if (cs.length === 1 && cs[0].n === 1 && !cs[0].asked) ocrListed(r, cs[0].i);
    });
  } finally {
    scanGen = '';
  }
  if (auto && !seen && !scanSw.on)
    scanList.forEach((e) => {
      if (!e.ask && e.photo === r.n && COLORS[e.i].brand === auto && scanShared(e.i)) {
        e.auto = true;
        e.autoAt = scanSw.autoOnly;
      }
    });
  // (a question every answer of which is in the list now, this photo's or an earlier one's, is answered: it goes, kept
  // to come back with Undo. "Which G410?" had stayed with G410 and G24 both in the list, from later photos)
  const listed = new Set(scanList.filter((e) => !e.ask).map((e) => e.i));
  scanList = scanList.filter((e) => {
    if (!e.ask || !e.opts.every((o) => listed.has(o.i))) return true;
    ocrAnswered.push({ e: e, by: r.n });
    return false;
  });
  ocrCropQuestions(r, read0);
  // (v318.9: the pixels let go of once the questions' pictures are cut, 49 MB for a photo read closer, not kept while
  // the questions are answered)
  if (r.img) r.img.data = null;
  r.asked = scanList.filter((e) => e.ask && e.photo === r.n).length;
  r.added = scanList.filter((e) => e.photo === r.n && !e.ask).length;
  r.same = r.listed ? r.listed.size : 0;
  // (v318.7) a photo plainly of the other brand than the one set for you: both brands are read from now on (scanSw)
  if (auto && seen && seen !== auto && !scanSw.on) {
    scanSwitchOn('photo');
    r.switched = true;
  }
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
    same: r.same || 0,
    failed: !!r.failed,
    brand: r.brand || '',
    switched: !!r.switched,
  });
  if (r.aborted) q.stop = true;
  if (q.k < q.files.length && !q.stop) {
    // (v318.4 e2e: a photo that couldn't be opened has none: a batch whose first photo was one had stopped there with an
    // error, Stop doing nothing)
    if (r.img) r.img.data = null;
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
  // (v318.7) what the photo added at once is taken back out, as closing Scan mid-photo does: its end never checked it
  // (caps cut by the edge, one look's misreading, the photo's brand). Read gently, what's read again goes in again,
  // checked; given up, the photo's to be taken again. A memory failure's first try had kept them, unchecked
  const n0 = scanList.length;
  scanList = scanList.filter((e) => e.photo !== r.n);
  r.bent = [];
  if (scanList.length !== n0) scanRender();
  // (out of memory: once more, gently, before giving up)
  if (m.memory && !r.gentle) {
    try {
      localStorage.setItem(OCR_LOW_KEY, String(Date.now()));
    } catch (_) {}
    r.gentle = true;
    // (v318.9) the closer read was too much: read as before, its 2048 copy decoded again (not the larger one at 1600)
    if (r.detail) {
      r.detail = false;
      r.img.data = null;
    }
    // (what the first try read is let go of, what it added with it, above: the second's lines are numbered from 1 again,
    // and a line taken by the first had kept the second's of the same number out of the list)
    r.items = new Map();
    r.taken = new Set();
    r.brands = {};
    r.sure = 0;
    r.note = 'That was a lot for this device’s memory: reading it again…';
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
// shown. (v318 polish) A big photo is decoded straight to that size where the browser can (createImageBitmap's resize,
// checked once to turn a photo upright as a picture does, below): decoded whole first, a 24 MP photo took about 98 MB
// and a 48 MP one 190 MB before it was shrunk. Elsewhere, or if that fails, as before.
// (v318.9) cap: the long side's most (2048; 4096 for a photo read closer); noShow: no copy to show (it has one); ow/oh:
// the photo's own size
async function ocrPhoto(file, cap, noShow) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    // (its size, upright, is known once it loads: its pixels needn't be decoded for that)
    await new Promise(function (res, rej) {
      img.onload = res;
      img.onerror = function () {
        rej(new Error('the photo couldn’t be decoded'));
      };
      img.src = url;
    });
    const W0 = img.naturalWidth,
      H0 = img.naturalHeight,
      s = Math.min(1, (cap || 2048) / Math.max(W0, H0)),
      w = Math.max(1, Math.round(W0 * s)),
      h = Math.max(1, Math.round(H0 * s));
    let src = null;
    if (s < 1 && (await ocrBitmapOk()))
      try {
        const b = await createImageBitmap(file, { resizeWidth: w, resizeHeight: h, resizeQuality: 'high' });
        if (b.width === w && b.height === h) src = b;
        else b.close();
      } catch (_) {}
    if (!src) {
      await img.decode();
      src = img;
    }
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const x = c.getContext('2d');
    x.drawImage(src, 0, 0, w, h);
    if (src.close) src.close();
    const data = x.getImageData(0, 0, w, h);
    if (noShow) {
      c.width = c.height = 1;
      return { w: w, h: h, data: data, show: null, ow: W0, oh: H0 };
    }
    // (the copy shown: up to 900 px, enough for a phone's or an iPad's view)
    const v = Math.min(1, 900 / Math.max(w, h)),
      show = document.createElement('canvas');
    show.width = Math.round(w * v);
    show.height = Math.round(h * v);
    show.getContext('2d').drawImage(c, 0, 0, show.width, show.height);
    c.width = c.height = 1;
    return { w: w, h: h, data: data, show: show, ow: W0, oh: H0 };
  } finally {
    URL.revokeObjectURL(url);
  }
}
// whether createImageBitmap makes a photo the size asked and turned upright from its camera data (EXIF), as a picture
// in the page is: tried once, on a tiny JPEG made here, turned half round (orientation 3), left half red
let _ocrBmp = null;
function ocrBitmapOk() {
  if (_ocrBmp) return _ocrBmp;
  _ocrBmp = (async function () {
    if (typeof createImageBitmap !== 'function') return false;
    const c = document.createElement('canvas');
    c.width = 32;
    c.height = 16;
    const g = c.getContext('2d');
    g.fillStyle = '#00f';
    g.fillRect(0, 0, 32, 16);
    g.fillStyle = '#f00';
    g.fillRect(0, 0, 16, 16);
    const jb = await new Promise(function (r) {
      c.toBlob(r, 'image/jpeg', 0.95);
    });
    if (!jb) return false;
    const j = new Uint8Array(await jb.arrayBuffer()),
      // (an APP1 segment with one tag: Orientation = 3)
      ex = [
        0xff, 0xe1, 0, 34, 0x45, 0x78, 0x69, 0x66, 0, 0, 0x4d, 0x4d, 0, 0x2a, 0, 0, 0, 8, 0, 1, 1, 0x12, 0, 3,
        0, 0, 0, 1, 0, 3, 0, 0, 0, 0, 0, 0,
      ],
      out = new Uint8Array(j.length + ex.length);
    out.set(j.subarray(0, 2));
    out.set(ex, 2);
    out.set(j.subarray(2), 2 + ex.length);
    const b = await createImageBitmap(new Blob([out], { type: 'image/jpeg' }), {
      resizeWidth: 16,
      resizeHeight: 8,
      resizeQuality: 'high',
    });
    const k = document.createElement('canvas');
    k.width = 16;
    k.height = 8;
    const kx = k.getContext('2d'),
      bw = b.width;
    kx.drawImage(b, 0, 0);
    b.close();
    const L = kx.getImageData(2, 4, 1, 1).data,
      R = kx.getImageData(13, 4, 1, 1).data;
    // (turned: blue on the left now, red on the right)
    return bw === 16 && L[2] > 160 && L[0] < 100 && R[0] > 160 && R[2] < 100;
  })().catch(function () {
    return false;
  });
  return _ocrBmp;
}

// --- the view, in Scan's card in place of its list while a photo is read
const ocrV = () => $('ocrView');
function ocrShow(html) {
  const card = $('scanOverlay').querySelector('.sccard'),
    v = ocrV();
  card.classList.add('ocron');
  // (wide only for a photo: the next of a batch keeps the last's width until it's open, ocrWide)
  if (html.indexOf('id="ocrPic"') < 0) card.classList.remove('ocrwide');
  v.hidden = false;
  v.innerHTML = html;
  // (v318 review: one name for it everywhere, as the welcome's and Add markers' cards have it)
  $('scTitle').textContent = 'Photograph your caps';
}
function ocrHide() {
  const card = $('scanOverlay').querySelector('.sccard'),
    v = ocrV();
  card.classList.remove('ocron', 'ocrwide');
  v.hidden = true;
  v.innerHTML = '';
  if ($('ocrLive')) $('ocrLive').textContent = '';
  $('scTitle').textContent = scanFind ? 'Scan 3 caps' : 'Scan or type codes';
}
// (v318 review) the card widened for a photo only when that shows it 500 px wide, for its codes over the boxes (ocrDraw):
// the card's 760 px less its padding, and the photo at most 62% of the window's height (11-scan.css)
function ocrWide(r) {
  const card = $('scanOverlay').querySelector('.sccard');
  if (!r || !r.img || !r.img.show) return card.classList.remove('ocrwide');
  const s = r.img.show,
    room = Math.min(760, window.innerWidth - 24) - 34,
    w = Math.min(room, s.width, ((0.62 * window.innerHeight) / s.height) * s.width);
  card.classList.toggle('ocrwide', w >= 500);
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
    // (no heading of its own: the sheet's title says what it is, and on a phone the two were stacked)
    '<p class="ocrp">The reader works on this device: your photos never leave it. It’s a one-time download of about <b>' +
      OCR_MB +
      ' MB</b>, kept for offline use. Wi-Fi is best.</p>' +
      '<ul class="ocrul"><li>Caps up, in good light, the phone or iPad held flat above them.</li>' +
      '<li>About half a tray per photo: closer reads more.</li>' +
      '<li>Each code it reads joins the list, to check before you add it. A photo takes a few seconds to a minute or two (a whole bag the longest); choose several and they’re read in turn.</li></ul>' +
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
  ocrFocusList(false);
}
// (v318 review) back from the reader to the list: the keyboard's place on Add (after Done) or on the card that reads
// photos, not in the box: in a tap, focus there opens an iPad's or iPhone's keyboard over the list just read, the way
// Photograph your caps opened Scan without it
function ocrFocusList(add) {
  const a = $('scAdd'),
    o = $('ocrOpen'),
    to = add && a && !a.disabled ? a : o && o.getClientRects().length ? o : null;
  if (to) to.focus({ preventScroll: true });
  else scanFocusBox();
}
// the card tapped: the photo picker straight away when the reader is stored (it opens only from a tap), else consent.
// how: 'entry', from Photograph your caps elsewhere (Scan opened for it)
async function ocrOpenTap(how) {
  if (!ocrCan()) return;
  // (the picker first, in the tap; whether the reader is stored is known by the time a photo's chosen)
  // (v318 review: from Photograph your caps, the reader's own view under the picker: the picker put away, that's
  // where you are, Take or choose photos again a tap away, not Scan's list and box that weren't asked for)
  if (ocrOk) {
    if (how === 'entry') ocrShowPick();
    return ocrPick();
  }
  const stored = await ocrStored();
  // (Scan closed meanwhile: its card not left on the reader, to be found there when Scan opens again)
  if (!$('scanOverlay').classList.contains('on')) return;
  if (stored) {
    ocrOk = true;
    return ocrShowPick();
  }
  ocrConsent();
}
// (stored, found out after the tap: one more tap for the picker)
function ocrShowPick() {
  ocrShow(
    '<p class="ocrp">Caps up, in good light, held flat above them. About half a tray per photo: closer reads more. Choose several and they’re read in turn.</p>' +
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
  // (v318.4 e2e: a batch's next photo said as its place in the batch, the bar where the batch is, as once it's open:
  // "Opening the photo…" and an empty bar had shown between "Photo 1 of 3" and "Photo 2 of 3", a second or more for a
  // 12 MP photo)
  const q = ocrQ && ocrQ.files.length > 1 ? ocrQ : null;
  ocrShow(
    '<div class="ocrstat"><span id="ocrSay">' +
      (q ? 'Photo ' + q.k + ' of ' + q.files.length + ' · ' : '') +
      'Opening the photo…</span><span id="ocrLeft"></span></div>' +
      '<div class="ocrbar"><b id="ocrBar" style="width:' +
      (q ? Math.round((100 * (q.k - 1)) / q.files.length) + '%' : '0') +
      '"></b></div><div class="ocrpic" id="ocrPic"></div>' +
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
  // (what it shows is said in words above and below it)
  r.img.show.setAttribute('aria-hidden', 'true');
  ocrWide(r);
  $('ocrPic').appendChild(r.img.show);
  r.cv = document.createElement('canvas');
  r.cv.className = 'ocrbox';
  r.cv.setAttribute('aria-hidden', 'true');
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
    // (a read that never finished, the page put away or ended by the system for its memory: this photo read gently.
    // v318.9: a closer read that never finished ('2'), gently for a fortnight, as after a memory failure caught: on a
    // device short of memory every other photo of a whole bag would have ended the page)
    const busy = r.detail ? '' : localStorage.getItem(OCR_BUSY_KEY);
    if (busy === '2' && !r.gentle) {
      localStorage.setItem(OCR_LOW_KEY, String(Date.now()));
      r.note = 'The last photo didn’t finish reading: reading more gently for a while…';
    }
    const at = +localStorage.getItem(OCR_LOW_KEY) || 0;
    low = low || Date.now() - at < OCR_LOW_DAYS * 864e5 || !!busy;
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
    localStorage.setItem(OCR_BUSY_KEY, r.detail ? '2' : '1');
  } catch (_) {}
  // (the photo's pixels go to the worker: copied, so a second try still has them; or decoded again when let go of:
  // v318.9, larger to be read closer, and its size with them)
  if (!r.img.data) {
    try {
      const p = await ocrPhoto(r.file, r.detail ? OCR_DETAIL_SIDE : 0, true);
      r.img = Object.assign(r.img, { w: p.w, h: p.h, data: p.data, ow: p.ow, oh: p.oh });
    } catch (_) {
      // (not decoded larger, as a device short of memory may not: read as before)
      if (r.detail && ocrRun === r && !r.done) {
        r.detail = false;
        r.noDetail = true;
        return ocrGo(r);
      }
      return ocrFailed({ message: 'photo', memory: false });
    }
  }
  if (ocrRun !== r || r.done) return;
  const px = r.img.data.data.slice().buffer,
    o = {
      // (v318.9: read closer, 3200, in 16 strips on every device: their working memory a sixteenth's)
      maxSide: r.detail ? 3200 : 1600,
      // (an iPad or iPhone, or read gently: the detector in four strips, so its working memory is a quarter's: memory
      // there is tight.
      // v318 review: four, not two, as they overlap by more than a cap's code is long (below): the page's peak in
      // Chromium 576 MB in two strips overlapping by 64, 513–535 in four by 192 (1280 in two, the gentle read's, 525),
      // reading as well as one strip: Ben's wide Ohuhu trays 329 of 334, as on a desktop, not 326; 4% slower)
      detTiles: r.detail ? 16 : low || isIOSDevice() ? 4 : 1,
      // (v318 review: the strips overlapping by more than a cap's code is long, so one across a cut is whole in one of
      // them; by 64 map pixels, a code across it was cut in both and dropped from both, by each look: YGY13, YG415, R54,
      // RV57 and E511 on Ben's close-ups)
      detOverlap: 192,
      // (names paired again once read, a word level with a code just under or over it: Sakura beside R23)
      pairLate: true,
      // (v318.1: a box read whole as one of its halves: the other half isn't a code of its own)
      halfBox: true,
      maxW: 160,
      minH: 16,
      quad: 1.6,
      retry: true,
      split: 2.5,
      zoom: 1.6,
      // (v318 review: a squarish box the zoom didn't part, its lines turned the other way, again closer and turned a
      // quarter: G49 Sour Apple, Y43, YG66 on the wide trays, 329 → 332 of 334, nothing wrong)
      zoom2: 2.4,
      zoomPad: 0.08,
      zoomMargin: 8,
      longWord: true,
      minConf: 0.5,
      second: true,
      words: ocrWords(),
      // (v318.12: a Copic code that's a longer one's tail read again for its lost first letter; not when the brand is
      // Ohuhu)
      widen: scanBrand === 'Ohuhu' ? null : ocrWidenSets(),
    };
  // (v318.9) a photo bigger than its 2048 copy, not read gently: the first look tells whether its codes are small
  if (!r.detail && !r.noDetail && !low && Math.max(r.img.ow || 0, r.img.oh || 0) > OCR_DETAIL_MIN)
    o.detailCheck = OCR_DETAIL_LINE;
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
  const q = ocrQ,
    k = q ? Math.max(1, Math.min(q.files.length, q.k)) : 1,
    // (v318 review: a batch stopped at its first photo is said as that photo, with the others not read: "1 photo:", "Photo
    // 1: 0 added" and "The last photo is shown" had said a batch of one)
    one = !!q && q.files.length > 1 && r.done && q.stop && q.k <= 1,
    many = q && q.files.length > 1 && !one,
    over = many && r.done && (q.k >= q.files.length || q.stop);
  const p = r.p || {};
  let t = '',
    pc = 0;
  if (r.failed) t = r.note;
  else if (r.done) {
    t =
      (r.added
        ? r.added + (r.added === 1 ? ' marker' : ' markers') + ' added to the list'
        : 'No new codes read') +
      // (v318.7: a tray photographed again: what it read that's in the list already)
      (r.same ? ' · ' + r.same + ' already in the list' : '') +
      (r.asked ? ' · ' + r.asked + ' to choose there' : '') +
      (r.aborted ? ' · stopped' : '') +
      (one
        ? q.files.length === 2
          ? ' · the other photo not read'
          : ' · the other ' + (q.files.length - 1) + ' photos not read'
        : '');
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
  // (v318.9) a photo read again closer: said so, so the longer wait isn't a surprise
  if (r.detail && !r.done && !r.failed)
    t = p.stage === 'load' ? 'The codes are small: reading the photo closer…' : 'Reading closer · ' + t;
  if (many && !over) {
    // (the queue's own words: this photo's place, and the bar over the whole queue)
    t = 'Photo ' + k + ' of ' + q.files.length + ' · ' + t;
    pc = (100 * (k - 1 + pc / 100)) / q.files.length;
  } else if (many && over) {
    const added = q.per.reduce((s, x) => s + x.added, 0),
      asked = q.per.reduce((s, x) => s + x.asked, 0),
      same = q.per.reduce((s, x) => s + (x.same || 0), 0),
      failed = q.per.filter((x) => x.failed).length;
    t =
      ocrNPhotos(q.per.length) +
      ': ' +
      (added ? added + (added === 1 ? ' marker' : ' markers') + ' added to the list' : 'no new codes read') +
      (same ? ' · ' + same + ' already in the list' : '') +
      (asked ? ' · ' + asked + ' to choose there' : '') +
      (failed ? ' · ' + failed + ' not read' : '') +
      (q.stop && !q.halt ? ' · stopped' : '');
    pc = 100;
  }
  say.textContent = t;
  // (what a screen reader hears: each stage once, not the count as it climbs ten times a second. v318 review: in Scan's
  // card, not in the view rebuilt for each photo, as a live region made with its words isn't heard, "Photo 2 of 19")
  const live = $('ocrLive'),
    heard = t.replace(/ \d+ so far$/, '');
  if (live && live.textContent !== heard) live.textContent = heard;
  // (read again after running out of memory: said while it's read, not only while the reader starts again)
  if (left) left.textContent = r.gentle && !r.done && p.stage !== 'load' ? 'Second try' : '';
  bar.style.width = Math.round(pc) + '%';
  const sum = $('ocrSum');
  if (sum && many && over) {
    // (v318.7: or, with the brand set for you, the photos that switched the reading to both brands)
    const sw = q.per.find((x) => x.switched),
      other = sw || (scanBrand && q.per.find((x) => x.brand && x.brand !== scanBrand));
    sum.innerHTML =
      '<span class="ocrleg"><span>Read</span><span class="am">To check</span></span>' +
      // (why the queue ended early, when a photo couldn't be read)
      (r.failed && r.note ? '<span class="ocrwarn">' + esc(r.note) + '</span>' : '') +
      (other
        ? '<span class="ocrwarn">Some photos look like ' +
          esc(other.brand) +
          ' caps, so theirs went in as ' +
          esc(other.brand) +
          (sw
            ? ', and both brands are read from now on. Undo these photos takes them out.</span>'
            : ', though ' +
              esc(scanBrand) +
              ' is chosen above the box. Undo these photos takes them out.</span>')
        : '') +
      '<span class="ocrhint">' +
      q.per
        // (v318.7: numbered as the list's headings number them, on from the photos before this batch)
        .map(
          (x, i) =>
            'Photo ' +
            (q.n0 + i) +
            ': ' +
            (x.failed
              ? 'not read'
              : x.added +
                ' added' +
                (x.same ? ', ' + x.same + ' already in the list' : '') +
                (x.asked ? ', ' + x.asked + ' to choose' : '')),
        )
        .join(' · ') +
      '</span>' +
      '<span class="ocrhint">The last photo is shown. Caps without a box weren’t read: a closer photo of them reads them.</span>';
  } else if (sum && r.done && !r.failed)
    sum.innerHTML =
      '<span class="ocrleg"><span>Read</span><span class="am">To check</span></span>' +
      (r.switched
        ? '<span class="ocrwarn">These look like ' +
          esc(r.brand) +
          ' caps, so they went in as ' +
          esc(r.brand) +
          ', and both brands are read from now on. Undo this photo takes them out.</span>'
        : r.brand && scanBrand && r.brand !== scanBrand
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
  // (the photo's width on the screen: the view's, or less when its height is what limits it, as on an iPad held
  // sideways. v318 review: the view's width had been taken, and in Scan's card, 446 px wide, labels never showed)
  const dw = show.getBoundingClientRect().width || Math.min(ocrV().clientWidth || show.width, show.width),
    x = cv.getContext('2d'),
    // (each box's code over it where the photo's shown big enough for them)
    wide = dw >= 500,
    // (in the canvas's own pixels, for lines and labels the same size on the screen whatever the photo's shown at)
    px = show.width / dw;
  x.lineWidth = 2.5 * px;
  x.font = '600 ' + Math.round(12 * px) + 'px system-ui, sans-serif';
  // (once the photo's done, a code that went in at its end, read as a pasted line, is read too: green, not amber)
  // (v318.7: and one read for sure that's in the list from an earlier photo or a sweep, a tray photographed again)
  const added = r.done ? new Set(scanList.filter((e) => !e.ask && e.photo === r.n).map((e) => e.i)) : null,
    listed = (r.done && r.listed) || null,
    brand = (r.done && r.brand) || scanBrand;
  r.items.forEach((it) => {
    if (!it || it.nameOf || !it.text) return;
    let cs = r.taken.has(it.id) ? ocrCodes(it.text, scanBrand) : ocrCodes(it.text, brand);
    const sure =
      r.taken.has(it.id) ||
      (cs.length === 1 && ((added && added.has(cs[0].i)) || (listed && listed.has(cs[0].i))));
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
      const tw = x.measureText(label).width + 6 * px,
        // (kept on the photo: a cap at its edge had its label cut off)
        lx = Math.max(0, Math.min(cv.width - tw, cx * k - tw / 2)),
        ly = Math.max(0, cy * k - (h * k) / 2 - 17 * px);
      x.fillRect(lx, ly, tw, 15 * px);
      x.fillStyle = sure ? '#7ff0bf' : '#ffcf85';
      x.fillText(label, lx + 3 * px, ly + 12 * px);
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
  // (the photo's or the batch's results kept until others are chosen: the picker put away, Done still says them)
  $('ocrMore').addEventListener('click', function () {
    ocrOk ? ocrPick() : ocrOpenTap();
  });
  if ($('ocrUndo'))
    $('ocrUndo').addEventListener('click', function () {
      const n = scanList.length,
        n0 = many ? q.n0 : r.n;
      const mine = (e) => e.photo >= n0 && e.photo <= r.n;
      scanList = scanList.filter((e) => !mine(e));
      const off = n - scanList.length;
      // (the questions these photos answered, asked before them, back)
      ocrAnswered = ocrAnswered.filter((a) => {
        if (a.by < n0 || a.by > r.n) return true;
        if (!mine(a.e)) scanList.splice(ocrGroupAt(a.e), 0, a.e);
        return false;
      });
      scanRender();
      ocrRun = null;
      ocrQ = null;
      ocrHide();
      scanSay('same', (many ? 'Photos' : 'Photo') + ' taken back out', off + ' off the list', -1);
      ocrFocusList(false);
    });
  $('ocrDone').focus({ preventScroll: true });
}
// (v318.7) where an entry of a photo goes back into the list: at the top of its photo's group (the list is newest first,
// a photo's entries together), else where its photo would sit among the others; one of no photo at the top. A question
// of photo 1 given back by Undo this photo had been put at the top, above photo 2's, and the headings said Photo 1 twice
function ocrGroupAt(e) {
  if (!e.photo) return 0;
  let k = scanList.findIndex((x) => x.photo === e.photo);
  if (k < 0) k = scanList.findIndex((x) => x.photo && x.photo < e.photo);
  if (k < 0) {
    k = 0;
    scanList.forEach((x, j) => x.photo > e.photo && (k = j + 1));
  }
  return k;
}
const ocrNPhotos = (n) => (n === 1 ? '1 photo' : n + ' photos'),
  // (v318.7) Done's card after a photo that switched the reading to both brands
  ocrSwitchNote = (b) =>
    'Read as ' + b + ': these look like ' + b + ' caps, so both brands are read from now on';
// Done: back to the list, with what the photo added said on its card
function ocrFinish() {
  const r = ocrRun,
    q = ocrQ,
    // (a batch stopped at its first photo: said as that photo, as ocrStatus does)
    many = q && q.files.length > 1 && !(q.stop && q.k <= 1);
  ocrRun = null;
  ocrQ = null;
  ocrHide();
  if (many) {
    // (v318.7: what was in the list already, a tray photographed again; and the switch to both brands)
    const added = q.per.reduce((s, x) => s + x.added, 0),
      asked = q.per.reduce((s, x) => s + x.asked, 0),
      same = q.per.reduce((s, x) => s + (x.same || 0), 0),
      sw = q.per.find((x) => x.switched);
    scanSay(
      added ? 'ok' : 'same',
      'From ' + ocrNPhotos(q.per.length) + ': ' + (added ? added + ' added to the list' : 'nothing new'),
      [
        same ? same + ' already in the list' : '',
        asked ? asked + ' to choose in the list below' : '',
        sw ? ocrSwitchNote(sw.brand) : '',
      ]
        .filter(Boolean)
        .join(' · ') || 'Check them below, then Add',
      -1,
      // (v318.7: the set nearly all here, with what's missing: "Honolulu 120: all but 2 are here", scan.js)
      scanGapChoices(),
    );
  } else if (r && r.done && !r.failed)
    scanSay(
      r.added ? 'ok' : 'same',
      r.added ? 'From the photo: ' + r.added + ' added to the list' : 'From the photo: nothing new',
      [
        r.same ? r.same + ' already in the list' : '',
        r.asked ? r.asked + ' to choose in the list below' : '',
        r.switched ? ocrSwitchNote(r.brand) : '',
      ]
        .filter(Boolean)
        .join(' · ') || 'Check them below, then Add',
      -1,
      scanGapChoices(),
    );
  scanRender();
  ocrFocusList(true);
}
// Scan closing: the read stopped, the worker ended (its memory with it)
function ocrClose() {
  if (ocrDown) ocrDown.ctl.abort();
  ocrDown = null;
  if (ocrRun && !ocrRun.done && ocrW) ocrW.postMessage({ t: 'stop' });
  // (v318.4 e2e) a photo whose reading closing cut short: what it added at once taken back out, as its end never checked
  // it (parts of caps, the photo's brand). With Copic chosen, an Ohuhu tray's first codes had stayed in the list as
  // Copic's, without a word, and the photo's questions were lost
  if (ocrRun && !ocrRun.done) scanList = scanList.filter((e) => e.photo !== ocrRun.n);
  // (a read stopped by closing Scan didn't run out of memory: the next photo isn't read gently for it)
  try {
    localStorage.removeItem(OCR_BUSY_KEY);
  } catch (_) {}
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
  // (the screen turned, or the window made wider: the boxes and their labels drawn for the photo's new size)
  window.addEventListener('resize', function () {
    if (ocrRun && ocrRun.cv && ocrV() && !ocrV().hidden) {
      ocrWide(ocrRun);
      ocrDraw(ocrRun);
    }
  });
  // (the app put away while nothing's being read: the worker's memory given back)
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && ocrW && !(ocrRun && !ocrRun.done)) ocrEnd();
  });
})();
