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
  const p = (ocrReady = (async function () {
    const files = await ocrLoad(),
      src = $('ocrWorkerSrc').textContent,
      wurl = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
    // (v318.22 debug: ended while its files were read, Scan closed: no worker started for nobody, which had stayed,
    // its memory with it, beside the next one)
    if (ocrReady !== p) {
      URL.revokeObjectURL(files.ort);
      URL.revokeObjectURL(wurl);
      throw new Error('ended');
    }
    const w = new Worker(wurl);
    URL.revokeObjectURL(wurl);
    ocrW = w;
    w.onmessage = ocrMessage;
    w.onerror = function (e) {
      e.preventDefault();
      const m = { message: e.message || 'worker', memory: /memory/i.test(e.message || '') };
      if (!w._up && w._fail) return w._fail(Object.assign(new Error(m.message), { memory: m.memory }));
      // (v318.22 debug: Look closer waiting on a square ends with the worker, not left waiting for good)
      if (ocrCl && ocrCl.wait) {
        const wt = ocrCl.wait;
        ocrCl.wait = null;
        ocrEnd();
        return wt.rej(Object.assign(new Error(m.message), { memory: m.memory }));
      }
      ocrFailed(m);
    };
    await new Promise((res, rej) => {
      w._ready = res;
      w._fail = rej;
      w.postMessage(Object.assign({ t: 'init' }, files), [files.wasm, files.det, files.rec, files.cls]);
    });
    URL.revokeObjectURL(files.ort);
    if (ocrReady !== p) {
      w.terminate();
      throw new Error('ended');
    }
    return w;
  })());
  ocrReady.catch(function () {
    if (ocrReady === p) ocrEnd();
  });
  return ocrReady;
}
// the worker ended: its memory goes (on Scan's close, and after running out of memory)
function ocrEnd() {
  if (ocrW) ocrW.terminate();
  ocrW = null;
  ocrReady = null;
  // (v318.22 debug: a closer look waiting on the worker ended is told, not left waiting for good: terminate() says
  // nothing)
  if (typeof ocrCl !== 'undefined' && ocrCl && ocrCl.wait) {
    const wt = ocrCl.wait;
    ocrCl.wait = null;
    wt.rej(new Error('ended'));
  }
}
function ocrMessage(ev) {
  const m = ev.data || {},
    w = ev.target || ocrW;
  // (v318.22 debug: a worker ended or replaced meanwhile: nothing it says counts. A start left running when Scan closed
  // had its 'ready' taken for the next one's, before that one's files were in)
  if (ev.target && ev.target !== ocrW) return;
  if (m.t === 'ready') {
    if (w) w._up = true;
    return w && w._ready && w._ready();
  }
  // (v318.22) Look closer's squares: their lines come at the end, settled by it; the reader's questions answered here
  if (ocrCl && ocrCl.wait) {
    const wt = ocrCl.wait;
    if (m.t === 'codes')
      w.postMessage({ t: 'codes', ids: m.items.filter((x) => ocrCodes(x[1], '').length).map((x) => x[0]) });
    else if (m.t === 'done') {
      ocrCl.wait = null;
      wt.res(m);
    } else if (m.t === 'error') {
      ocrCl.wait = null;
      // (v318.22 debug: the worker that failed let go of: the next photo starts a fresh one)
      ocrEnd();
      wt.rej(Object.assign(new Error(m.message), { memory: m.memory }));
    }
    return;
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
    // (v318.12: nor a code that may be a longer one's tail: it waits for its read again, ocrWidenWait)
    !ocrWidenWait(cs[0].i) &&
    (!/[A-Za-z]/.test(it.text) || ocrAsRead(it.text, scanKey(COLORS[cs[0].i].code)))
  ) {
    const was = scanList.length;
    if (
      scanTake(cs[0].i, '', true, true, { with: { cv: capCvRead(cs[0].i, false, false) } }) &&
      scanList.length > was
    )
      scanList[0].photo = r.n;
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
      if (c) {
        e.crop = c;
        // (v318.21) where the cap is in the photo, for "Where in the photo?" (scan/15-answer.js): its place and the
        // close-up's size as fractions of the copy it was cut from (read at 2048, closer at 4096, or again: each its
        // own), and the codes printed on the two caps read nearest, as their caps say them
        ocrWhere(r, e, line, lines);
      }
    } catch (_) {}
  });
  // (and the photo, as shown, kept while its questions wait: scan/30-pictures.js)
  if (scanList.some((e) => e.ask && e.photo === r.n && e.where)) ocrKeepPhoto(r);
}
// (v318.21) a question's cap in its photo: e.pid (the photo's own id, kept across reloads, where its number isn't),
// e.where [x, y, r] (the cap's centre and the close-up's half-side, fractions of the photo's width and height), e.near
// (the two nearest caps read for sure, as printed)
function ocrWhere(r, e, line, lines) {
  const d = r.img.data,
    [cx, cy, w, h] = line.box,
    R = Math.ceil(Math.max(1.25 * Math.max(w, h), 3 * Math.min(w, h)) * 1.45);
  if (!d || !d.width || !d.height) return;
  if (!r.pid) r.pid = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  e.pid = r.pid;
  e.where = [+(cx / d.width).toFixed(4), +(cy / d.height).toFixed(4), +(R / d.width).toFixed(4)];
  const ix = scanIndex(),
    far = Math.max(w, h) * 6,
    seen = new Set([scanKey(line.text)]),
    near = lines
      .filter((x) => {
        if (x === line || x.nameOf || x.unsure || !x.box || !/\d/.test(x.text)) return false;
        const k = scanKey(x.text);
        return (
          (ix.byCode.has(k) || ix.byOld.has(k)) && Math.hypot(x.box[0] - cx, x.box[1] - cy) > Math.max(w, h)
        );
      })
      .map((x) => ({ t: x.text.trim().toUpperCase(), d: Math.hypot(x.box[0] - cx, x.box[1] - cy) }))
      .filter((x) => x.d < far)
      .sort((a, b) => a.d - b.d)
      .filter((x) => !seen.has(scanKey(x.t)) && seen.add(scanKey(x.t)));
  e.near = near.slice(0, 2).map((x) => x.t.slice(0, 10));
}
// the photo as shown (its copy up to 900 px), a small JPEG, kept for its questions by its id (scanPics)
function ocrKeepPhoto(r) {
  if (!r.pid || scanPics.photo(r.pid)) return;
  const sc = (r.img && r.img.show) || document.querySelector('#ocrPic canvas');
  if (!sc || !sc.width) return;
  try {
    const u = sc.toDataURL('image/jpeg', 0.6);
    if (/^data:image\/jpeg/.test(u)) scanPics.keepPhoto(r.pid, u);
  } catch (_) {}
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
  // (v318.22 debug: Look closer's dry run reads under the brand the photo's own read found, or none: it had switched a
  // photo to Ohuhu with Copic chosen, its own entries said again as new)
  if (r.brand0 !== undefined) return r.brand0;
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
      mine = own.length && own.some((i) => ocrNameAgrees(i, nm, x.text));
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
    if (!nm.length || !t.length || t.some((i) => ocrNameAgrees(i, nm, x.text))) return;
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
// (v318.21) A code misread by one character, put right by the name read beside it: "5110" with "Dark Suntan" is E110
// (YR312's older cap), "F400" with "Cocoa Brown" E400, "8114" with "Cerulean Blue" B114, "RVO70" with "Sakura Pink"
// RV070. Only a reading that is no code at all, of three characters or more; one character off by a look-alike (5 for
// E, S or G; F for E; 7 for 1; 8 for B; O for 0; A for 4…), or one dropped or added in a code of four or more; and only
// when exactly one marker of the brand fits, its whole name (as it is now, or on its older caps) read within about a
// cap of the code. The code decides as much as the name: "Cocoa Brown" is also Copic E74's name, "Sardonyx" Copic
// R21's. Listed with "read as “5110”" on its row. On the recorded reads of 101 photos: 26 caps, none wrong.
const OCR_LIKE = [
  ['5', 'E'],
  ['5', 'S'],
  ['5', 'G'],
  ['F', 'E'],
  ['7', '1'],
  ['L', '1'],
  ['I', '1'],
  ['O', '0'],
  ['A', '4'],
  ['8', 'B'],
  ['E', 'B'],
  ['S', 'B'],
  ['3', '8'],
  ['6', 'G'],
  ['2', 'Z'],
  ['V', 'Y'],
];
function ocrNearCode(a, b) {
  if (a === b) return false;
  const like = (p, q) => p === q || OCR_LIKE.some(([x, y]) => (p === x && q === y) || (p === y && q === x));
  if (a.length === b.length) {
    let d = 0;
    for (let i = 0; i < a.length; i++)
      if (a[i] !== b[i]) {
        if (!like(a[i], b[i])) return false;
        d++;
      }
    return d === 1;
  }
  const [s, l] = a.length < b.length ? [a, b] : [b, a];
  if (s.length < 4 || l.length - s.length !== 1) return false;
  for (let i = 0; i < l.length; i++) if (l.slice(0, i) + l.slice(i + 1) === s) return true;
  return false;
}
// (v318.22) a name read beside a code: every word of it read (exact); or, failing that, each misread by a letter (two
// in a word of seven or more: "Absinme" Absinthe, "Gorezon" Horizon), its plain colour words ("Brown" of Cocoa Brown)
// may go unread so long as a word of it that isn't one is read. Only where the code read is one character off the
// marker's (ocrNameFix)
function ocrNameRead(nm, words, exact) {
  const ws = scanWords(nm);
  if (exact) return ws.length > 0 && ws.every((w) => words.has(w));
  const plain = (w) => OCR_PLAIN.has(w.toLowerCase()) || /^\d+$/.test(w),
    near = (w) => {
      if (words.has(w)) return true;
      if (w.length < 5 || plain(w)) return false;
      const most = w.length >= 7 ? 2 : 1;
      for (const u of words)
        if (u.length >= 4 && Math.abs(u.length - w.length) <= most && ocrEdits(u, w) <= most) return true;
      return false;
    };
  return ws.length > 0 && ws.some((w) => !plain(w) && near(w)) && ws.every((w) => near(w) || plain(w));
}
// the letters to change, add or drop to make one word the other (Levenshtein)
function ocrEdits(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++)
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}
function ocrCodeLetterEnd(t) {
  // (three characters at least: a new rule never adds a two-character code, "RI", only Scan's own reading does)
  return /^[A-Z]{2,3}[SOILZB]$/.test(scanKey(t)) && scanWords(t).length === 1;
}
function ocrNameFix(r, lines, brand) {
  const ix = scanIndex(),
    codeLike = (t) => {
      const k = scanKey(t);
      return k.length >= 3 && k.length <= 6 && /\d/.test(k) && scanWords(t).length === 1;
    },
    done = new Set();
  lines.forEach((x) => {
    // (v318.22: or a code whose last digit was read as its look-alike letter, "GYS" for GY5 with "Absinthe" read)
    if (!x.box || r.taken.has(x.id) || !(codeLike(x.text) || ocrCodeLetterEnd(x.text))) return;
    const k = scanKey(x.text);
    if (ix.byCode.has(k) || ix.byOld.has(k)) return;
    const R = 2.5 * Math.max(x.box[2], x.box[3], 20),
      words = new Set();
    lines.forEach((y) => {
      if (y === x || !y.box || codeLike(y.text)) return;
      if (y.nameOf === x.id || Math.hypot(y.box[0] - x.box[0], y.box[1] - x.box[1]) < R)
        scanWords(y.text).forEach((w) => words.add(w));
    });
    if (!words.size) return;
    // (each name read whole first; v318.22: misread by a letter or two, or without its plain words, only when no
    // name is read whole: a name read whole had settled it, and stays the only one to)
    const near = [];
    COLORS.forEach((c, i) => {
      if (brand && c.brand !== brand) return;
      if (ocrNearCode(k, scanKey(c.code)) || (c.old && ocrNearCode(k, scanKey(c.old)))) near.push(i);
    });
    let exact = true,
      fit = near.filter((i) => scanNamesOf(i).some((nm) => ocrNameRead(nm, words, true)));
    if (!fit.length) {
      exact = false;
      fit = near.filter((i) => scanNamesOf(i).some((nm) => ocrNameRead(nm, words)));
    }
    if (fit.length !== 1 || done.has(fit[0]) || scanList.some((e) => !e.ask && e.i === fit[0])) return;
    done.add(fit[0]);
    // (v318.21: what its cap says, only when the name settles it: a name of its older cap's, not its own now, is an older
    // cap; its own name now, with a code one off its code now, its current cap; caps.js)
    const c = COLORS[fit[0]],
      whole = (nm) => ocrNameRead(nm, words, exact),
      byNow = whole(c.name || ''),
      byOld = (c.cap || []).some(whole) && !byNow,
      cv = !capHasOld(c) ? '' : byOld ? 'old' : byNow && ocrNearCode(k, scanKey(c.code)) ? 'new' : '';
    scanTake(fit[0], 'fixed', false, true, { with: cv ? { as: x.text, cv: cv } : { as: x.text } });
  });
}
// (v318.22) Ohuhu's older grey caps, "CGⅡ08", "BGⅡ05": the Ⅱ is read as anything ("CGé08", "CGWO8", "BG期05",
// "B6n05", "Cen07", "cclo8") and Scan's reading drops it, BG05 being a code now (Copic's and Ohuhu's) and CG08 none. A
// reading that is no code as read, of C or B, a G (or 6; for C an E or C too), one to three characters that aren't
// digits (but 1) nor Y (BGY13), and a number of two as only these caps have (CG: 00 04 07 08 09; BG: 03 05 09; O for
// 0, A for 4; a digit at least: "Cocoa" isn't CGⅡ04, nor "Coo107", Cool Grey 07's name, CGⅡ07): that cap.
// A CG one is no other cap, so it goes in at once; a BG one only with "Blue Grey" or its number after Grey read beside
// it (BG05 and BG09 are caps now too), else asked. Not on a photo of Copic's caps, nor a cap read otherwise already (a
// code taken within the reading's own size of it), nor one whose name beside it says another number. Listed with
// "read as …", an older cap (caps.js).
function ocrTwoLike(text) {
  const ix = scanIndex(),
    m = /^([CB])([G6EC])(.{1,3}?)([0O][0-9OA])$/.exec(
      String(text || '')
        .replace(/\s+/g, '')
        .toUpperCase(),
    );
  if (!m) return null;
  const [, fam, g, junk, num] = m;
  if (fam === 'B' && !/[G6]/.test(g)) return null;
  if (/[02-9Y]/.test(junk) || !/\d/.test(num)) return null;
  // (v318.22 debug: a stop or a dash isn't a Ⅱ, two upright strokes: "BG.05", "BG-05" are BG05 as read)
  if (/^[-.:·_,'’]+$/.test(junk)) return null;
  // (as read, no code at all; or one only by dropping what's between its letters and its number, "BG期05" as BG05:
  // that's what Scan's reading makes of it, so it isn't taken as read, ocrAsRead)
  const k0 = scanKey(text),
    plain = String(text).toUpperCase().replace(/\s+/g, '');
  if ((ix.byCode.has(k0) || ix.byOld.has(k0)) && plain === k0) return null;
  const n = num.replace(/O/g, '0').replace(/A/g, '4').padStart(2, '0'),
    hit = (ix.byOld.get(scanKey(fam + 'GⅡ' + n)) || []).filter((i) => COLORS[i].brand === 'Ohuhu');
  return hit.length === 1 ? { i: hit[0], fam: fam, n: n } : null;
}
function ocrTwoFix(r, lines, brand, before) {
  if (brand === 'Copic') return;
  const ix = scanIndex();
  lines.forEach((x) => {
    if (!x.box || x.nameOf || r.taken.has(x.id)) return;
    const two = ocrTwoLike(x.text);
    if (!two) return;
    const { fam, n } = two,
      i = two.i,
      own = 1.5 * Math.max(x.box[2], x.box[3]),
      gap = (y) => Math.hypot(y.box[0] - x.box[0], y.box[1] - x.box[1]);
    // (its cap read already: a code taken as sure within the reading's own size of it)
    if (
      lines.some((y) => y !== x && y.box && r.taken.has(y.id) && gap(y) < 1.2 * Math.max(x.box[2], x.box[3]))
    )
      return;
    // (its name: the lines read as its names, or beside it within half again its size; each said on its own)
    const names = lines
        .filter(
          (y) => y !== x && y.box && (y.nameOf === x.id || gap(y) < own) && !/^[CB][G6]/i.test(y.text.trim()),
        )
        .map((y) => y.text.toUpperCase().replace(/[^A-Z0-9]/g, '')),
      // (the number in its name, after the Ⅱ, read as II, ll, Il, 11…: only another number there, another cap)
      said = names
        .map((t) => /GR[AE]Y[IL1H]{0,2}0?(\d)/.exec(t))
        .filter(Boolean)
        .map((m) => m[1]),
      // (a BG one: "Blue Grey" read, or its number after Grey: BG05's cap now says Light Sea Blue)
      blue = names.some((t) => /BLUEGR[AE]Y/.test(t)) || said.indexOf(String(+n)) >= 0;
    if (said.length && said.indexOf(String(+n)) < 0) return;
    if (scanList.some((e) => !e.ask && e.i === i)) return;
    // (a question this line had raised, "“BG期05” read: is it this one?" about BG05, goes: this settles it)
    scanList = scanList.filter((e) => before.has(e) || !e.ask || e.ask.indexOf(x.text) < 0);
    const now = (ix.byCode.get(scanKey('BG' + n)) || []).filter((j) => COLORS[j].brand === 'Ohuhu');
    // (v318.22 debug: a BG cap of now with its own whole name read beside it, "Light Sea Blue": that cap, as it is now)
    if (fam === 'B' && !blue) {
      const got = new Set(
          [].concat(
            ...lines
              .filter((y) => y !== x && y.box && (y.nameOf === x.id || gap(y) < own))
              .map((y) => scanWords(y.text)),
          ),
        ),
        named = now.filter((j) => {
          const ws = scanWords(COLORS[j].name || '');
          return ws.length > 0 && ws.every((w) => got.has(w));
        });
      if (named.length === 1) {
        scanTake(named[0], 'fixed', false, true, { with: { as: x.text, cv: 'new' } });
        return;
      }
    }
    if (fam === 'C' || blue) {
      scanTake(i, 'fixed', false, true, { with: { as: x.text, cv: 'old' } });
      return;
    }
    scanAsk(
      'two ' + x.text,
      '“' + x.text + '” read: which is it?',
      [{ i: i, how: 'old' }].concat(now.map((j) => ({ i: j, how: 'chosen' }))),
      true,
      true,
    );
  });
}
// (v318.12) the codes that are the tail of a longer one of the same brand with a letter more at its head (Copic: G03 of
// YG03, R20 of YR20, V04 of BV04, RV04; v318.14 Ohuhu too: G24 of BG24, CG24, GG24, R25, V08, Y00…): short, read again
// by the engine with its box grown at the code's start (o.widen); long, what such a read may turn it into. Worked out
// once per brand from the markers; brand null: both brands' (each brand's pairs on their own, put together)
let _ocrWiden = {};
function ocrWidenSets(brand) {
  const bk = brand || 'both';
  if (_ocrWiden[bk]) return _ocrWiden[bk];
  const short = new Set(),
    long = new Set();
  ['Copic', 'Ohuhu'].forEach(function (b) {
    if (brand && brand !== b) return;
    const cc = new Set();
    COLORS.forEach(function (c) {
      if (c.brand === b) cc.add(scanKey(c.code));
    });
    cc.forEach(function (k) {
      let any = false;
      for (let L = 65; L <= 90; L++) {
        const w = String.fromCharCode(L) + k;
        if (cc.has(w)) {
          long.add(w);
          any = true;
        }
      }
      if (any) short.add(k);
    });
  });
  _ocrWiden[bk] = { short: [...short].sort(), long: [...long].sort() };
  return _ocrWiden[bk];
}
// (v318.14) whose lost first letters are looked for: the brand chosen, else the only brand you own, else both (a
// longer code of the other brand is then possible: a Copic G24 read again as Ohuhu's BG24 is asked about or added as
// that, as reading BG24 straight away would be)
function ocrWidenBrand() {
  if (scanBrand === 'Ohuhu' || scanBrand === 'Copic') return scanBrand;
  let o = false,
    c = false;
  state.owned.forEach(function (k) {
    if (k.indexOf('Ohuhu|') === 0) o = true;
    else if (k.indexOf('Copic|') === 0) c = true;
  });
  return o && !c ? 'Ohuhu' : c && !o ? 'Copic' : null;
}
// a code to hold back from going in at once, as the engine reads it again for a lost first letter: exactly the codes
// the engine is given to read again (ocrWidenSets(ocrWidenBrand()))
function ocrWidenWait(i) {
  const c = COLORS[i];
  return !!c && ocrWidenSets(ocrWidenBrand()).short.indexOf(scanKey(c.code)) >= 0;
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
  // (v318.22 debug) the boxes drawn again once the photo's own reading rules are off, as every later drawing is: drawn
  // under them, a code read on an older cap and listed by its old code was boxed amber with what was read ("R21"),
  // though its marker (R16) was in the list
  if (!r.dry && r.cv && ocrRun === r) ocrDraw(r);
}
function ocrSettle(r, m) {
  clearTimeout(r.soon);
  r.soon = 0;
  r.done = true;
  r.ms = m.ms;
  if (window.__MS_TEST && !r.dry) window.__ocrLast = m;
  r.aborted = m.aborted;
  // (v318.22: not by Look closer's dry run, which keeps its own busy mark)
  if (!r.dry)
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
        // (v318.19 debug: not a name line read unsure that is another code, "e020)" and "e030" beside "00", E400 Cocoa
        // Brown's turned cap: Scan's reading of the code and its names had listed E020 and E030 unasked)
        .filter(
          (y) =>
            !(
              y.unsure &&
              /\d/.test(y.text) &&
              /[A-Za-z]/.test(y.text) &&
              key(y.text) !== g.k &&
              codesIn(y.text).length
            ),
        )
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
      // (v318.22: the line taken for its code is a word of the name too, "Colorless" over "Blender": with its other
      // words, in either order. Its other words alone, "Blender", had been no name, and the blender went unread)
      const b = seen || scanBrand,
        nm = names.length ? names : [x.text],
        all = [x.text].concat(names),
        got = [nm, all, all.slice().reverse()].find((n) => ocrWholeName(n, b) >= 0);
      if (got) text.push(got.join(' '));
      return;
    }
    // (v318.22) an older grey cap's code with its Ⅱ misread, "BG期05", that Scan's reading makes another code of (BG05):
    // left to ocrTwoFix, which lists or asks about that cap, not asked here as BG05
    // (v318.22 debug: by the brand ocrTwoFix goes by, the photo's or else the one chosen: with Copic chosen and the photo
    // not plainly one brand's, it does nothing, and the line is Scan's to read as before)
    const two = (seen || scanBrand) !== 'Copic' ? ocrTwoLike(x.text) : null;
    if (two && !codesIn(x.text).some((c) => c.opts.indexOf(two.i) >= 0)) return;
    // (the code's markers whose name is read with it, by a word of it or whole, in either order: not read short, nor
    // misread by one look, nor cut by the edge, nor noise. v318.7: whole too, "V015" at the top edge with "Deep
    // Violet", its name of plain words only, had been left out of 30 reads)
    const named = [];
    codesIn(x.text).forEach((c) =>
      c.opts.forEach(
        (i) =>
          (ocrNameAgrees(i, names, x.text) ||
            ocrCapNamed(i, names, x.text) ||
            (names.length && ocrNamed(names, seen || scanBrand).indexOf(i) >= 0)) &&
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
    // (v318.22) a code only Look closer read, with no name of its own: asked about, not added, when every reading of it
    // was unsure, or the photo's own read had another code on that cap. On Ben's photos those were most of what it added
    // wrong ("Y415" where "Y411" had been read, "e13" unsure)
    if (g.lines.every((l) => l.closer) && !named.length) {
      const k = key(x.text),
        rival = read0.find((y) => {
          const ky = key(y.text);
          return (
            !y.closer &&
            !y.nameOf &&
            !!y.box &&
            ky !== k &&
            /\d/.test(ky) &&
            Math.hypot(y.box[0] - x.box[0], y.box[1] - x.box[1]) < Math.max(x.box[2], x.box[3]) &&
            !(ky.startsWith(k) || ky.endsWith(k) || k.startsWith(ky) || k.endsWith(ky)) &&
            codesIn(y.text).length > 0
          );
        });
      if (rival || g.lines.every((l) => l.unsure))
        return confirm.push({ t: x.text, names: names, lines: g.lines, also: rival ? rival.text : '' });
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
      // (v318.22: and the other code read on its cap, when that's why it's asked)
      [x.t, x.also || ''].forEach((t) =>
        (t ? scanRead(t, seen || scanBrand).codes || [] : []).forEach((c) =>
          c.opts.forEach((i) => os.indexOf(i) < 0 && os.push(i)),
        ),
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
  // (v318.21) a code misread by one character, put right by its whole name read beside it
  ocrNameFix(r, read0, seen || was);
  // (v318.22) Ohuhu's older grey caps, their Ⅱ misread
  ocrTwoFix(r, read0, seen || was, before);
  const auto = scanAuto();
  scanList.forEach((e) => {
    if (before.has(e)) return;
    e.photo = r.n;
    // (the brand the question names came from the photo, not from above the box)
    // (v318.22 debug: Look closer's dry run reads under the photo's brand; the one chosen is the one it set aside)
    if (e.ask && seen && seen !== (r.dry ? r.chose : was) && /^other /.test(e.ask))
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
  // (v318.22) kept for Look closer; and Look closer's own run ends here: no word, drawing, queue or brand switch
  ocrCloserKeep(r, read0);
  if (r.dry) return;
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

// --- (v318.22) Look closer: a photo's caps it didn't read, read again closer, when asked
// After a photo (or a batch) is read, Look closer reads again, from the photo decoded larger (OCR_CLOSER_SIDE on its
// long side, text about a third bigger than in the 2048 copy, the size the reader reads best: bigger still read worse
// on the bench), squares round the lines that didn't settle into a marker in the list: codes misread, names with no
// code. Their lines, put back in the 2048 copy's place, are settled with the photo's own, as one read, without a word
// (ocrSettle's dry run); what that adds is added, the photo's own number on it, a question the photo had asked, a
// marker taken off the list since, or a question about a marker already listed, left as they are. Undo look closer
// takes it back. Only when asked: on the lent bench photos it found 17 more caps on the four hardest and 5 more on four
// easy ones, for about three quarters as long again as the first read, too long to do for every photo. Not for a photo
// read closer already (4096), read gently, or no bigger than its copy read.
const OCR_CLOSER_SIDE = 2700,
  OCR_CLOSER_OFF = 'ms-ocr-closer-off';
// the photos Look closer can read: { n, pid, file, lines, w, h, ow, oh, brand, firstKeys, firstListed, done }
let ocrCloserList = [],
  // the reading under way: { stop, k, of, wait } ; the last one, for its Undo: { neu, gone, ans }
  ocrCl = null,
  ocrClLast = null;
// (a page that ended while it looked closer, its memory short: not offered again on this visit)
function ocrCloserOk() {
  try {
    if (sessionStorage.getItem(OCR_CLOSER_OFF)) return false;
  } catch (_) {}
  return true;
}
// a photo just settled: kept for Look closer if it can be read closer
function ocrCloserKeep(r, read0) {
  if (r.dry || r.failed || r.aborted || r.detail || r.low || r.gentle || !r.file || !r.img) return;
  if (Math.max(r.img.ow || 0, r.img.oh || 0) < OCR_CLOSER_SIDE * 0.9) return;
  ocrCloserList = ocrCloserList.filter((p) => p.n !== r.n);
  ocrCloserList.push({
    n: r.n,
    pid: r.pid,
    file: r.file,
    lines: read0,
    w: r.img.w,
    h: r.img.h,
    ow: r.img.ow,
    oh: r.img.oh,
    brand: r.brand || '',
    firstKeys: new Set(scanList.filter((e) => e.ask && e.photo === r.n).map((e) => e.ask)),
    firstListed: new Set(scanList.filter((e) => !e.ask && e.photo === r.n).map((e) => e.i)),
    done: false,
  });
}
// the photos it can still read, of the photo or batch shown
function ocrCloserTodo() {
  // (v318.22 debug: and something on it to look at)
  return ocrCloserOk() ? ocrCloserList.filter((p) => !p.done && ocrCloserSpots(p).length > 0) : [];
}
// a photo's lines that didn't settle into a marker in the list, nor stand beside one that did: where to look closer.
// Codes misread, and names with no code (a word of four letters or more)
function ocrCloserSpots(p) {
  const listed = new Set(scanList.filter((e) => !e.ask).map((e) => e.i)),
    codeLike = (t) => {
      const k = scanKey(t);
      return k.length >= 2 && k.length <= 7 && /\d/.test(k);
    },
    settled = (x) => !x.nameOf && ocrCodes(x.text, '').some((c) => listed.has(c.i)),
    ok = p.lines.filter((x) => x.box && settled(x)),
    beside = (x) =>
      ok.some(
        (y) => Math.hypot(y.box[0] - x.box[0], y.box[1] - x.box[1]) < 1.5 * Math.max(y.box[2], y.box[3]),
      );
  return p.lines.filter(
    (x) => x.box && !settled(x) && !beside(x) && (codeLike(x.text) || /[A-Za-z]{4}/.test(x.text)),
  );
}
// one square of the photo read by the worker: its lines
function ocrCloserReadOne(w, W, H, buf) {
  return new Promise((res, rej) => {
    ocrCl.wait = { res: res, rej: rej };
    const o = {
      maxSide: Math.max(W, H),
      detTiles: 1,
      detOverlap: 192,
      pairLate: true,
      halfBox: true,
      maxW: 160,
      minH: 16,
      quad: 1.6,
      retry: true,
      split: 2.5,
      zoom: 1.6,
      zoom2: 2.4,
      zoomPad: 0.08,
      zoomMargin: 8,
      longWord: true,
      minConf: 0.5,
      second: true,
      words: ocrWords(),
      widen: ocrWidenSets(ocrWidenBrand()),
    };
    w.postMessage({ t: 'read', img: { width: W, height: H, data: buf.buffer }, o: o }, [buf.buffer]);
  });
}
// a photo read closer round its spots: the lines read, in the 2048 copy's place; and that copy and a smaller one to
// show, made from the larger decode, for the pictures of any new question (null: nothing to look at)
async function ocrCloserRead(p, cl) {
  const spots = ocrCloserSpots(p);
  if (!spots.length) return { lines: [] };
  const big = await ocrPhoto(p.file, OCR_CLOSER_SIDE, true),
    k = big.w / p.w,
    sq = [];
  // (v318.22 debug: Stop or × while it decoded: nothing settled, no worker started again for nobody)
  if (cl.stop) return null;
  spots.forEach((x) => {
    const cx = x.box[0] * k,
      cy = x.box[1] * k,
      side = Math.max(320, 4 * Math.max(x.box[2], x.box[3]) * k);
    if (sq.some((c) => Math.abs(c.cx - cx) < c.side * 0.3 && Math.abs(c.cy - cy) < c.side * 0.3)) return;
    sq.push({ cx: cx, cy: cy, side: side });
  });
  // (the 2048 copy and the one shown, from the larger: the questions' pictures are cut from it)
  const c1 = document.createElement('canvas');
  c1.width = big.w;
  c1.height = big.h;
  c1.getContext('2d').putImageData(big.data, 0, 0);
  const c2 = document.createElement('canvas');
  c2.width = p.w;
  c2.height = p.h;
  const g2 = c2.getContext('2d', { willReadFrequently: true });
  g2.imageSmoothingQuality = 'high';
  g2.drawImage(c1, 0, 0, p.w, p.h);
  const data = g2.getImageData(0, 0, p.w, p.h),
    v = Math.min(1, 900 / Math.max(p.w, p.h)),
    show = document.createElement('canvas');
  show.width = Math.round(p.w * v);
  show.height = Math.round(p.h * v);
  show.getContext('2d').drawImage(c2, 0, 0, show.width, show.height);
  c1.width = c1.height = c2.width = c2.height = 0;
  // (the squares cut, the larger decode let go of before they're read)
  const cuts = sq.map((c) => {
    const x0 = Math.max(0, Math.round(c.cx - c.side / 2)),
      y0 = Math.max(0, Math.round(c.cy - c.side / 2)),
      x1 = Math.min(big.w, Math.round(c.cx + c.side / 2)),
      y1 = Math.min(big.h, Math.round(c.cy + c.side / 2)),
      W = x1 - x0,
      H = y1 - y0,
      px = new Uint8ClampedArray(W * H * 4);
    for (let y = 0; y < H; y++)
      px.set(big.data.data.subarray(((y0 + y) * big.w + x0) * 4, ((y0 + y) * big.w + x1) * 4), y * W * 4);
    return { x0: x0, y0: y0, W: W, H: H, px: px };
  });
  big.data = null;
  cl.all = cuts.length;
  if (cl.stop) return null;
  const w = await ocrStart();
  let nid = p.lines.reduce((m, x) => Math.max(m, x.id || 0), 0);
  // (fourth pass: past the lines a closer look before this one, stopped part way, read too: the same ids had kept
  // one cap's box off the photo)
  if (ocrRun && ocrRun.n === p.n && ocrRun.items)
    ocrRun.items.forEach((_, id) => (nid = Math.max(nid, id || 0)));
  const out = [];
  for (const c of cuts) {
    // (Stop: what's read so far is still settled)
    if (cl.stop) break;
    const m = await ocrCloserReadOne(w, c.W, c.H, c.px),
      ids = new Map();
    (m.lines || []).forEach((l) => ids.set(l.id, ++nid));
    (m.lines || []).forEach((l) => {
      const b = l.box.slice();
      b[0] = (b[0] + c.x0) / k;
      b[1] = (b[1] + c.y0) / k;
      b[2] /= k;
      b[3] /= k;
      out.push(
        Object.assign({}, l, {
          id: ids.get(l.id),
          nameOf: l.nameOf ? ids.get(l.nameOf) || 0 : 0,
          box: b,
          closer: true,
        }),
      );
    });
    cl.done++;
    ocrCloserSay(cl);
  }
  return { lines: out, data: data, show: show, all: !cl.stop };
}
// a photo's lines read closer, settled with its own as one read (dry: no word, no drawing, no queue); what that adds
// kept, as above. Returns the entries it added
function ocrCloserMerge(p, got) {
  const r = {
      n: p.n,
      pid: p.pid,
      items: new Map(),
      taken: new Set(),
      brands: {},
      sure: 0,
      p: null,
      done: false,
      note: '',
      dry: true,
      chose: scanBrand,
      brand0: p.brand || '',
      img: { w: p.w, h: p.h, data: got.data || null, show: got.show || null, ow: p.ow, oh: p.oh },
    },
    lines = p.lines.concat(got.lines),
    was = scanBrand,
    before = new Set(scanList),
    listed0 = new Set(scanList.filter((e) => !e.ask).map((e) => e.i));
  // (the photo's brand as its read found it: not swapped again from the one chosen)
  if (p.brand && was && p.brand !== was) scanBrand = p.brand;
  try {
    lines.forEach((it) => ocrLine(r, it));
    ocrDone(r, { lines: lines, stat: {}, ms: 0, aborted: false });
  } finally {
    clearTimeout(r.soon);
    scanBrand = was;
  }
  if (r.pid) p.pid = r.pid;
  scanList = scanList.filter(
    (e) =>
      before.has(e) ||
      (e.ask
        ? !p.firstKeys.has(e.ask) && !e.opts.some((o) => listed0.has(o.i))
        : !p.firstListed.has(e.i) || listed0.has(e.i)),
  );
  return scanList.filter((e) => !before.has(e));
}
// said while it looks: the photo's status line and bar, with Stop
function ocrCloserSay(cl) {
  const say = $('ocrSay'),
    bar = $('ocrBar');
  if (say) say.textContent = 'Looking closer' + (cl.of > 1 ? ' at photo ' + cl.k + ' of ' + cl.of : '') + '…';
  // (heard once each time it changes, not at every square)
  const live = $('ocrLive'),
    heard = say ? say.textContent : '';
  if (live && heard && live.textContent !== heard) live.textContent = heard;
  if (bar) bar.style.width = Math.round((100 * (cl.k - 1 + (cl.all ? cl.done / cl.all : 0))) / cl.of) + '%';
}
async function ocrCloserGo() {
  const todo = ocrCloserTodo();
  if (!todo.length || ocrCl || (ocrRun && !ocrRun.done)) return;
  // (a closer look's Undo is of the last one only)
  ocrClLast = null;
  const cl = (ocrCl = { stop: false, k: 0, of: todo.length, done: 0, all: 0, wait: null }),
    before = new Set(scanList),
    ans = ocrAnswered.slice();
  const b = $('ocrBtns');
  if (b) {
    b.innerHTML = '<button type="button" class="obGhost" id="ocrStop">Stop</button>';
    $('ocrStop').addEventListener('click', () => {
      cl.stop = true;
      // (v318.22 debug: the square being read stopped too, as a photo's read is; what it read still comes back)
      if (cl.wait && ocrW) ocrW.postMessage({ t: 'stop' });
    });
    $('ocrStop').focus({ preventScroll: true });
  }
  scanSay('', 'Looking closer', 'At the caps without a box', -1);
  let fail = '';
  try {
    localStorage.setItem(OCR_BUSY_KEY, '3');
  } catch (_) {}
  // (v318.22 debug: whatever happens, it ends: its busy mark gone, unless a newer read's; ocrCl let go of, or Look
  // closer was gone for the visit)
  try {
    for (const p of todo) {
      if (cl.stop) break;
      cl.k++;
      cl.done = cl.all = 0;
      ocrCloserSay(cl);
      let got = null;
      try {
        got = await ocrCloserRead(p, cl);
        if (got) {
          ocrCloserMerge(p, got);
          ocrCloserBoxes(p, got, cl);
        }
      } catch (e) {
        fail = cl.closed ? '' : e && e.memory ? 'memory' : 'error';
        break;
      }
      if (!got) break;
      // (a photo stopped part way is offered again: its squares not read are still to read)
      if (got.all !== false) p.done = true;
    }
  } finally {
    try {
      if (localStorage.getItem(OCR_BUSY_KEY) === '3') localStorage.removeItem(OCR_BUSY_KEY);
    } catch (_) {}
    if (ocrCl === cl) ocrCl = null;
  }
  if (fail === 'memory')
    try {
      sessionStorage.setItem(OCR_CLOSER_OFF, '1');
    } catch (_) {}
  if (cl.closed) {
    scanSaveList();
    return;
  }
  const neu = scanList.filter((e) => !before.has(e)),
    gone = [...before].filter((e) => scanList.indexOf(e) < 0);
  ocrClLast = neu.length || gone.length ? { neu: neu, gone: gone, ans: ans, boxes: cl.boxes || null } : null;
  // (v318.22 debug: what it read is boxed on the photo shown, as the photo's own read is)
  if (cl.boxes && ocrRun) ocrDraw(ocrRun);
  scanSaveList();
  scanRender();
  const added = neu.filter((e) => !e.ask).length,
    asked = neu.filter((e) => e.ask).length,
    t = fail
      ? fail === 'memory'
        ? 'Couldn’t look closer: this device’s memory is short'
        : 'Couldn’t look closer: the reader stopped with a problem'
      : added || asked
        ? (added ? added + ' more added' : '') +
          (added && asked ? ', ' : '') +
          (asked ? asked + ' to choose' : '')
        : cl.stop
          ? 'stopped before it read any more'
          : 'Nothing more read';
  const say = $('ocrSay'),
    bar = $('ocrBar');
  if (say) say.textContent = 'Looked closer: ' + t;
  if (bar) bar.style.width = '100%';
  // (v318.22 debug: heard: Scan's own status line is hidden under the photo's view)
  if ($('ocrLive')) $('ocrLive').textContent = 'Looked closer: ' + t;
  // (and counted in what Done and a batch's lines say; what it took off, questions it answered, no longer counted)
  ocrCloserTally(neu, 1);
  ocrCloserTally(gone, -1);
  // (v318.22 debug: the words under the photo said again, the counts and the hint as they are now; its own line kept)
  if (ocrRun) {
    const said = say ? say.textContent : '';
    ocrStatus(ocrRun);
    if (say) say.textContent = said;
    if ($('ocrLive')) $('ocrLive').textContent = said;
  }
  scanSay(added ? 'ok' : 'same', 'Looked closer', t, -1);
  if (ocrRun) ocrButtons(ocrRun);
}
// (v318.22 debug) the codes read closer that went in, drawn on the photo shown (the last of a batch) where they were
// read (ocrCloserRead maps them back, with ids after the photo's own), as the photo's own are; a spot it looked at
// again and placed is no longer drawn as the first read had it. cl.boxes: what was added and hidden, for Undo look
// closer
function ocrCloserBoxes(p, got, cl) {
  const r = ocrRun;
  if (!r || r.n !== p.n || !r.cv || !r.items || !got || !got.lines) return;
  // (only the lines that went in as a marker of the photo's: a scrap it read and couldn't place, "98" or "Y1", drawn
  // amber over a cap the photo had already read; its questions have their own place, Where in the photo?)
  const listed = new Set(scanList.filter((e) => !e.ask && e.photo === p.n).map((e) => e.i)),
    br = p.brand || scanBrand,
    b = cl.boxes || (cl.boxes = { add: [], hid: [], was: [...r.items] }),
    mine = got.lines.filter(
      (l) => !l.nameOf && l.text && l.box && ocrCodes(l.text, br).some((c) => listed.has(c.i)),
    ),
    // (fourth pass) one cap's: the two centres within a quarter of the boxes' lengths of each other along the code's
    // own line, and half the smaller height across it, the angle the code was read at counted (box: [x, y, w, h, deg]).
    // A test square to the photo had taken a neighbour 60–80 px away for the same cap when its code was read upright
    // or slanted, and drawn the cap read closer, or the neighbour the photo had read, with no box
    over = (a, c) => {
      const t = ((a[4] || 0) * Math.PI) / 180,
        dx = c[0] - a[0],
        dy = c[1] - a[1];
      return (
        Math.abs(dx * Math.cos(t) + dy * Math.sin(t)) < (a[2] + c[2]) / 4 &&
        Math.abs(-dx * Math.sin(t) + dy * Math.cos(t)) < Math.min(a[3], c[3]) / 2
      );
    },
    marks = (t) => ocrCodes(t, br).map((c) => c.i);
  // (the first read's box where a code read closer went in: that read is the one placed, and two boxes on one cap had
  // their codes drawn over each other, "R16" and "R16" as "R161"; never one the photo placed as another marker)
  [...r.items.values()].forEach((it) => {
    if (it.closer || it.nameOf || !it.box) return;
    const was = marks(it.text).filter((i) => listed.has(i));
    if (!mine.some((l) => over(l.box, it.box) && (!was.length || marks(l.text).some((i) => was.includes(i)))))
      return;
    r.items.delete(it.id);
    b.hid.push(it);
  });
  // (one box a cap: its code read both ways up, or by two squares, is drawn once)
  mine.forEach((l) => {
    if (r.items.has(l.id) || b.add.some((id) => over(r.items.get(id).box, l.box))) return;
    r.items.set(l.id, l);
    b.add.push(l.id);
  });
}
// (v318.22 debug) what Look closer added counted in its photo's tally, as Done and a batch's lines say them (s: 1 added,
// -1 taken back)
function ocrCloserTally(es, s) {
  es.forEach((e) => {
    const q = ocrQ,
      x = q && q.per.length > 1 ? q.per[e.photo - q.n0] : ocrRun;
    // (an earlier photo's, or a typed entry: not this photo's or batch's to count)
    if (!x || !e.photo || (x === ocrRun && e.photo !== ocrRun.n)) return;
    const k = e.ask ? 'asked' : 'added';
    x[k] = Math.max(0, (x[k] || 0) + s);
  });
}
// Undo look closer: what it added out, the questions it answered back
function ocrCloserUndo() {
  const u = ocrClLast;
  if (!u) return;
  ocrClLast = null;
  ocrCloserTally(u.neu, -1);
  ocrCloserTally(u.gone, 1);
  scanList = scanList.filter((e) => u.neu.indexOf(e) < 0);
  u.gone.forEach((e) => scanList.indexOf(e) < 0 && scanList.splice(ocrGroupAt(e), 0, e));
  ocrAnswered = u.ans;
  ocrCloserList.forEach((p) => (p.done = false));
  // (and its boxes off the photo, the first read's back)
  if (u.boxes && ocrRun && ocrRun.items) {
    // (as they were, in their order: boxes drawn over each other come out the same)
    ocrRun.items.clear();
    u.boxes.was.forEach((x) => ocrRun.items.set(x[0], x[1]));
    ocrDraw(ocrRun);
  }
  scanSaveList();
  scanRender();
  if (ocrRun) ocrStatus(ocrRun);
  const say = $('ocrSay');
  if (say) say.textContent = 'Look closer taken back';
  if ($('ocrLive')) $('ocrLive').textContent = 'Look closer taken back';
  scanSay('same', 'Look closer taken back', 'What it added is off the list', -1);
  if (ocrRun) ocrButtons(ocrRun);
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
        // (v318.22) Chrome: decoded whole into a bitmap of its own, let go by close(), and shrunk on the canvas below.
        // Its resize kept each photo's full-size decode in the page's image cache (~48 MB a 12 MP photo, never let go):
        // reading stopped or the page crashed after about 10 photos. Safari and others as before.
        const whole = ocrBmpWhole(),
          b = whole
            ? await createImageBitmap(file)
            : await createImageBitmap(file, { resizeWidth: w, resizeHeight: h, resizeQuality: 'high' });
        if (whole ? b.width === W0 && b.height === H0 : b.width === w && b.height === h) src = b;
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
    x.imageSmoothingQuality = 'high';
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
// (v318.22) Chrome (and the browsers built on it, which say so with navigator.userAgentData): createImageBitmap's resize
// keeps the photo's full-size decode in the page's image cache, so there the photo's decoded whole and shrunk on a canvas
function ocrBmpWhole() {
  return !!navigator.userAgentData;
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
    // (the call the reader makes: whole in Chrome, ocrBmpWhole)
    const whole = ocrBmpWhole(),
      jpg = new Blob([out], { type: 'image/jpeg' }),
      b = whole
        ? await createImageBitmap(jpg)
        : await createImageBitmap(jpg, { resizeWidth: 16, resizeHeight: 8, resizeQuality: 'high' });
    const k = document.createElement('canvas');
    k.width = 16;
    k.height = 8;
    const kx = k.getContext('2d'),
      bw = whole ? b.width / 2 : b.width;
    kx.drawImage(b, 0, 0, 16, 8);
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
  // (v318.22) the photo shown and its boxes let go of their pixels as they leave: Chrome held on to each photo's two
  // canvases (~5 MB, and as much again of graphics memory) long after, photo after photo
  v.querySelectorAll('#ocrPic canvas').forEach((c) => (c.width = c.height = 0));
  v.innerHTML = html;
  // (v318 review: one name for it everywhere, as the welcome's and Add markers' cards have it)
  $('scTitle').textContent = 'Photograph your caps';
}
function ocrHide() {
  const card = $('scanOverlay').querySelector('.sccard'),
    v = ocrV();
  card.classList.remove('ocron', 'ocrwide');
  v.hidden = true;
  // (v318.25) its canvases let go of their pixels here too, as ocrShow does (v318.22): Done, Back, Undo this photo and
  // closing Scan had dropped them whole, which Chrome held on to
  v.querySelectorAll('#ocrPic canvas').forEach((c) => (c.width = c.height = 0));
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
  // (v318.22 debug: Undo is of this batch only, so the questions earlier photos answered go: they were kept all visit,
  // with their pictures)
  ocrAnswered = [];
  // (v318.22: Look closer is of this batch's photos only)
  ocrCloserList = [];
  ocrClLast = null;
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
  // (v318.22 debug: Scan closed, or another photo started, while this one was opened: nothing more of it, its pixels let
  // go of. It had gone on into a view no longer there, or the next photo's)
  if (ocrRun !== r) {
    r.img.data = null;
    if (r.img.show) r.img.show.width = r.img.show.height = 0;
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
    let busy = r.detail ? '' : localStorage.getItem(OCR_BUSY_KEY);
    // (v318.22: a closer look that never finished: not offered again on this visit; the next photo read as ever)
    if (busy === '3') {
      busy = '';
      try {
        sessionStorage.setItem(OCR_CLOSER_OFF, '1');
      } catch (_) {}
      localStorage.removeItem(OCR_BUSY_KEY);
    }
    if (busy === '2' && !r.gentle) {
      localStorage.setItem(OCR_LOW_KEY, String(Date.now()));
      r.note = 'The last photo didn’t finish reading: reading more gently for a while…';
    }
    const at = +localStorage.getItem(OCR_LOW_KEY) || 0;
    low = low || Date.now() - at < OCR_LOW_DAYS * 864e5 || !!busy;
  } catch (_) {}
  r.low = low;
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
      // (v318.22 debug: Scan closed, or another photo started, while it decoded: not that one's failure)
      if (ocrRun !== r || r.done) return;
      // (not decoded larger, as a device short of memory may not: read as before)
      if (r.detail) {
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
      // (v318.12: a code that's a longer one's tail read again for its lost first letter; v318.14 Ohuhu's too)
      widen: ocrWidenSets(ocrWidenBrand()),
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
    // (v318.19: an older cap's names too)
    String((c.name || '') + ' ' + (c.cap || []).join(' '))
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
      // (v318.22: how to read them, said plainly: half a tray at a time, no glare)
      '<span class="ocrhint">The last photo is shown. ' +
      ocrMissedHint() +
      '</span>';
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
      '<span class="ocrhint">' +
      ocrMissedHint() +
      '</span>';
}
// (v318.22) the caps it missed, said under the photo: Look closer named while it's offered; after it, the caps it read
// have no box of their own
function ocrMissedHint() {
  return (
    'Caps without a box weren’t read' +
    (ocrCloserTodo().length ? ': Look closer reads them again.' : '.') +
    ' Half a tray at a time, with no glare on the caps, reads best.'
  );
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
    // (v318.22) Look closer, at the caps without a box; and its Undo
    (ocrCloserTodo().length && !ocrCl
      ? '<button type="button" class="obSecond" id="ocrCloser">Look closer</button>'
      : '') +
    (ocrClLast ? '<button type="button" class="obGhost" id="ocrCloserUndo">Undo look closer</button>' : '') +
    (undo ? '<button type="button" class="obGhost" id="ocrUndo">Undo ' + photos + '</button>' : '');
  $('ocrDone').addEventListener('click', ocrFinish);
  if ($('ocrCloser')) $('ocrCloser').addEventListener('click', ocrCloserGo);
  if ($('ocrCloserUndo')) $('ocrCloserUndo').addEventListener('click', ocrCloserUndo);
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
      ocrCloserList = [];
      ocrClLast = null;
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
  // (v318.22 debug: Undo this photo goes with the view, and so do the questions it could give back; and Look closer)
  ocrAnswered = [];
  ocrCloserList = [];
  ocrClLast = null;
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
  // (v318.22) a closer look under way ends: what it settled stays, the square being read is let go of
  if (ocrCl) {
    ocrCl.stop = ocrCl.closed = true;
    if (ocrCl.wait) ocrCl.wait.rej(new Error('closed'));
    ocrCl.wait = null;
  }
  ocrCloserList = [];
  ocrClLast = null;
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
    // (v318.22 debug: nor while Look closer reads: its worker is at work, though the photo's own read is done)
    if (document.hidden && ocrW && !(ocrRun && !ocrRun.done) && !ocrCl) ocrEnd();
  });
})();
