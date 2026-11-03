/* ---- (v325.1) Focus on a photo-made page: the photo's subject, found on this device ----
    A salient object detection model (vendor/subject/<SUB_VER>/: from v329.3 TRACER-TE4 trained for Marker Studio,
    22.3 MB, 448 × 448; in v329.2 TRACER-TE0, before it U²-Net's small model; vendor/subject/README.md) says how much each part of the photo is its subject; the
    page builder then keeps more detail there (Sharper subject) and, with Simpler background, less behind it (Focus,
    docs/PLAN-photo-to-page.md: it moves detail within Detail's limits, never under the step's smallest width, and
    doesn't hold the section count). It runs on ONNX Runtime Web, the photo reader's own copy (photo-read.js:
    OCR_FILES' two ort files, in the reader's cache), in a worker of its own, ended once the map is made so its memory
    goes with it. Downloaded only after a consent card, into a cache of its own (and the reader's, for ONNX Runtime,
    when the reader hasn't brought it); each file checked, size and hash, before it's kept. The map is kept with the
    photo as it's made into a page (_ppPrep.sal), so a Detail change doesn't find it again. */
const SUB_VER = '4',
  SUB_DIR = 'vendor/subject/' + SUB_VER + '/',
  SUB_CACHE = 'marker-studio-subject-' + SUB_VER,
  // (its size and SHA-256: vendor/subject/README.md)
  SUB_FILES = [
    {
      f: 'subject-te4.onnx',
      n: 22281030,
      h: 'aa2f16acec6dafad9cdc9489447dc7ba4f993ba9421496ecb7b3b1779ad65a84',
    },
  ],
  // (the model's input: 448 × 448 from version 4, TRACER-TE4; 320 before; RGB, ImageNet's mean and spread)
  SUB_SIDE = 448,
  // (v329.3) a crop smaller than this share of the part of the photo whose map is kept is found again (subFromKept)
  SUB_REFIND = 0.5,
  // (how long the finder's worker may take to answer, to start or to make the map: several times an iPad's few seconds)
  SUB_WAIT = 60000,
  SUB_MEAN = [0.485, 0.456, 0.406],
  SUB_STD = [0.229, 0.224, 0.225],
  // Focus's sizes: [the subject's, the rest's] smallest area, as a share of Detail's (Sharper subject: the subject at
  // 0.3, still never under the step's smallest width; Simpler background: the rest at 1.6 too). Measured in the spike
  // at Medium: Sharper subject 0 to +33% sections, Simpler background −40% to +10%. (v329.2: Simpler background's
  // rest at 2.5: on the bench its sections there 28% fewer than at 1.6, nearly all the slivers gone, for about 2% of
  // the background's likeness; the cormorant's water 57 sections → 37)
  SUB_AREA = { even: [1, 1], sharp: [0.3, 1], calm: [0.3, 2.5], subject: [1, 1] },
  SUB_NAMES = { even: 'Even', sharp: 'Sharper subject', calm: 'Simpler background', subject: 'Subject only' },
  // (v326) Subject only (docs/PLAN-v326-photo-page.md, 4): the photo's background where the map is under SUB_CUT,
  // left white; a map that calls under SUB_FEW of the photo its subject has none clear enough (measured on 17
  // photos: the sunset, a landscape, trees, a flower bed under 5%; a bird 7%); the crop offered when the subject's
  // box is under SUB_CROP of the photo, with SUB_MARGIN round it
  SUB_CUT = 0.5,
  SUB_FEW = 0.05,
  // (v329.2) under SUB_NONE of the photo its subject, Sharper subject makes the Even page, said (the beach, the sea);
  // between that and SUB_FEW, Subject only offers the crop instead, when the subject's box is no longer than
  // SUB_SHAPE times its other side (a sunset's horizon band isn't a subject to crop to); a separate part of the
  // subject under SUB_STRAY of the largest and SUB_NONE of the photo is a stray (the flower bed's leaves)
  SUB_NONE = 0.01,
  SUB_SHAPE = 2.5,
  SUB_STRAY = 0.1,
  // (v329.2: the guided filter that puts the map's edges on the photo's, its radius in working pixels and its
  // smoothing: on the bench the cut-out's outline moved onto the photo's edges, +55% edge strength under it, the
  // shapes kept; a larger radius went ragged)
  SUB_GF_R = 8,
  SUB_GF_EPS = 0.004,
  SUB_CROP = 0.5,
  SUB_MARGIN = 0.08;
const subUrl = (f) => new URL(SUB_DIR + f, location.href).href;
// whether this browser can run it: as the photo reader (WebAssembly with SIMD, workers, the Cache API)
function subCan() {
  return typeof ocrCan === 'function' && ocrCan();
}
// the files still to download: [{ x, url, cache }] (ONNX Runtime's in the reader's cache), null when the caches can't
// be opened
async function subMissing() {
  const need = [];
  try {
    const oc = await caches.open(OCR_CACHE),
      sc = await caches.open(SUB_CACHE);
    for (const x of OCR_FILES.slice(0, 2))
      if (!(await oc.match(ocrUrl(x.f)))) need.push({ x: x, url: ocrUrl(x.f), cache: OCR_CACHE });
    for (const x of SUB_FILES)
      if (!(await sc.match(subUrl(x.f)))) need.push({ x: x, url: subUrl(x.f), cache: SUB_CACHE });
  } catch (_) {
    return null;
  }
  return need;
}
// (the download's size, in MB, for the card)
function subMB(need) {
  return Math.max(1, Math.round(need.reduce((s, o) => s + o.x.n, 0) / 1e6));
}
// those files downloaded, each checked before it's kept; progress(bytes, total)
async function subDownload(need, progress) {
  const total = need.reduce((s, o) => s + o.x.n, 0);
  let done = 0;
  try {
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
  } catch (_) {}
  for (const o of need) {
    // (a file that hasn't come in SUB_WAIT × 3 is given up on: said, and Focus stays on Even)
    const ctl = typeof AbortController === 'function' ? new AbortController() : null,
      t = ctl
        ? setTimeout(function () {
            ctl.abort();
          }, SUB_WAIT * 3)
        : 0;
    let buf;
    try {
      const res = await fetch(o.url, { cache: 'no-store', signal: ctl ? ctl.signal : undefined });
      if (!res.ok) throw new Error('http ' + res.status);
      // (v329.3 review: read as it comes, as the reader's ocrDownload, so the line counts up: read whole, it said "0 of
      // 22 MB" for the whole download)
      const parts = [];
      let got = 0;
      if (res.body && res.body.getReader) {
        const rd = res.body.getReader();
        for (;;) {
          const r = await rd.read();
          if (r.done) break;
          parts.push(r.value);
          got += r.value.length;
          progress(done + Math.min(got, o.x.n), total);
        }
      } else parts.push(new Uint8Array(await res.arrayBuffer()));
      buf = new Uint8Array(parts.reduce((s, q) => s + q.length, 0));
      let at = 0;
      parts.forEach((q) => {
        buf.set(q, at);
        at += q.length;
      });
    } finally {
      clearTimeout(t);
    }
    if (buf.length !== o.x.n) throw new Error('size ' + o.x.f);
    if (ocrHex(await crypto.subtle.digest('SHA-256', buf)) !== o.x.h) throw new Error('hash ' + o.x.f);
    const c = await caches.open(o.cache);
    await c.put(o.url, new Response(buf, { headers: { 'Content-Type': 'application/octet-stream' } }));
    done += o.x.n;
    progress(done, total);
  }
}
// (runs in the worker) the model started from the page's files, then a map for each picture it's sent
function subWorkerMain() {
  let ort = null,
    s = null;
  self.onmessage = async function (ev) {
    const m = ev.data || {};
    try {
      if (m.t === 'init') {
        ort = await import(m.ort);
        // (v329.4) one thread unless the page is cross-origin isolated (GitHub Pages can't make it so: a test folder's
        // service worker does): then up to four, or as many as asked (the threads test's timing)
        ort.env.wasm.numThreads =
          m.threads ||
          (self.crossOriginIsolated ? Math.max(1, Math.min(4, navigator.hardwareConcurrency || 1)) : 1);
        ort.env.wasm.wasmBinary = m.wasm;
        s = await ort.InferenceSession.create(new Uint8Array(m.model), {
          executionProviders: ['wasm'],
          graphOptimizationLevel: 'all',
        });
        postMessage({ t: 'ready' });
      } else if (m.t === 'run') {
        const x = new ort.Tensor('float32', new Float32Array(m.x), [1, 3, m.S, m.S]),
          out = await s.run({ [s.inputNames[0]]: x }),
          y = Float32Array.from(out[s.outputNames[0]].data);
        // (v329.2: TRACER's map as it is, a sigmoid: u2netp's had been stretched from 0 to 1, which made a subject
        // of nothing on a photo with none; then at the working size, its edges on the photo's, subMapUp)
        const sal = subMapUp(y, m.S, new Uint8Array(m.rgb), m.w, m.h, m.r, m.eps);
        postMessage({ t: 'map', y: sal }, [sal.buffer]);
      }
    } catch (e) {
      postMessage({ t: 'error', message: String((e && (e.message || e)) || 'error') });
    }
  };
}
// (runs in the worker) the model's map (S × S) at the working size (w × h), smoothly, then (v329.2) a guided filter
// steered by the photo's lightness (He, Sun and Tang's, radius r, smoothing eps), which puts its edges on the photo's:
// the model's own are at a quarter of its size and rounder than the subject (the iris's petals, the cats' ears, a
// crust). 0–1 a pixel
function subMapUp(m, S, rgb, w, h, r, eps) {
  const n = w * h,
    p = new Float32Array(n),
    I = new Float32Array(n);
  for (let y = 0; y < h; y++)
    for (let xx = 0; xx < w; xx++) {
      const fx = Math.min(S - 1, Math.max(0, ((xx + 0.5) * S) / w - 0.5)),
        fy = Math.min(S - 1, Math.max(0, ((y + 0.5) * S) / h - 0.5)),
        ix = Math.floor(fx),
        iy = Math.floor(fy),
        tx = fx - ix,
        ty = fy - iy,
        ix1 = Math.min(S - 1, ix + 1),
        iy1 = Math.min(S - 1, iy + 1);
      p[y * w + xx] =
        m[iy * S + ix] * (1 - tx) * (1 - ty) +
        m[iy * S + ix1] * tx * (1 - ty) +
        m[iy1 * S + ix] * (1 - tx) * ty +
        m[iy1 * S + ix1] * tx * ty;
    }
  if (!r) return p;
  for (let i = 0; i < n; i++)
    I[i] = (0.299 * rgb[i * 3] + 0.587 * rgb[i * 3 + 1] + 0.114 * rgb[i * 3 + 2]) / 255;
  const tmp = new Float32Array(n),
    mI = subBoxMean(I, w, h, r, null, tmp),
    mp = subBoxMean(p, w, h, r, null, tmp),
    II = new Float32Array(n),
    Ip = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    II[i] = I[i] * I[i];
    Ip[i] = I[i] * p[i];
  }
  const cI = subBoxMean(II, w, h, r, II, tmp),
    cIp = subBoxMean(Ip, w, h, r, Ip, tmp),
    a = new Float32Array(n),
    b = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const v = cI[i] - mI[i] * mI[i],
      c = cIp[i] - mI[i] * mp[i];
    a[i] = c / (v + eps);
    b[i] = mp[i] - a[i] * mI[i];
  }
  const ma = subBoxMean(a, w, h, r, null, tmp),
    mb = subBoxMean(b, w, h, r, null, tmp);
  for (let i = 0; i < n; i++) p[i] = Math.min(1, Math.max(0, ma[i] * I[i] + mb[i]));
  return p;
}
// (runs in the worker) the mean over a (2r + 1)² box, fewer at the picture's edges: running sums, rows then columns
function subBoxMean(src, w, h, r, out, tmp) {
  out = out || new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const o = y * w;
    let s = 0,
      k = 0;
    for (let x = 0; x < Math.min(w, r); x++) {
      s += src[o + x];
      k++;
    }
    for (let x = 0; x < w; x++) {
      if (x + r < w) {
        s += src[o + x + r];
        k++;
      }
      if (x - r - 1 >= 0) {
        s -= src[o + x - r - 1];
        k--;
      }
      tmp[o + x] = s / k;
    }
  }
  const col = new Float64Array(w);
  for (let y = 0; y < Math.min(h, r); y++) for (let x = 0; x < w; x++) col[x] += tmp[y * w + x];
  let k = Math.min(h, r);
  for (let y = 0; y < h; y++) {
    if (y + r < h) {
      const o = (y + r) * w;
      for (let x = 0; x < w; x++) col[x] += tmp[o + x];
      k++;
    }
    if (y - r - 1 >= 0) {
      const o = (y - r - 1) * w;
      for (let x = 0; x < w; x++) col[x] -= tmp[o + x];
      k--;
    }
    const o = y * w;
    for (let x = 0; x < w; x++) out[o + x] = col[x] / k;
  }
  return out;
}
// (v329.3 review) the stored files checked again, size and hash, after the finder failed to start, as the reader's
// ocrDamaged: a damaged one (a write cut off, a disk fault) let go of, so choosing Focus downloads it again; it had
// failed every time, the file there, so the download was never offered. How many were, or are missing
async function subDamaged() {
  let bad = 0;
  try {
    const oc = await caches.open(OCR_CACHE),
      sc = await caches.open(SUB_CACHE),
      list = OCR_FILES.slice(0, 2)
        .map((x) => ({ x: x, c: oc, url: ocrUrl(x.f) }))
        .concat(SUB_FILES.map((x) => ({ x: x, c: sc, url: subUrl(x.f) })));
    for (const o of list) {
      const r = await o.c.match(o.url);
      if (!r) {
        bad++;
        continue;
      }
      const buf = await r.arrayBuffer();
      if (buf.byteLength === o.x.n && ocrHex(await crypto.subtle.digest('SHA-256', buf)) === o.x.h) continue;
      await o.c.delete(o.url);
      bad++;
    }
  } catch (_) {}
  return bad;
}
// (v329.3 review) a find that failed for want of memory (iOS: "Out of memory", a RangeError from WebAssembly.Memory,
// ONNX Runtime's failed allocation) or time (SUB_WAIT, an old device): 'memory', 'slow', else ''. Either is kept for
// this launch (sessionStorage, as 41-bloom's BLOOM_SLOW_KEY), so Sharper subject isn't chosen again only to wait
// for the same failure: the page step offers only Even meanwhile (ppFocusHTML)
const SUB_OFF_KEY = 'ms-subject-off',
  // (what a make says when it happens, ppMake, and the Focus row's hint after, ppFocusHTML)
  SUB_OFF_SAID = {
    memory:
      'This device ran out of memory finding the subject, so the page is made Even. Close other apps and reopen Marker Studio to try Focus again.',
    slow: 'The subject finder took too long on this device, so the page is made Even.',
  },
  SUB_OFF_HINT = {
    memory:
      'Only Even until Marker Studio is next opened: this device ran out of memory finding the subject. Close other apps before you try again.',
    slow: 'Only Even until Marker Studio is next opened: the subject finder took too long on this device.',
  };
function subFailKind(e) {
  const m = String((e && (e.sub || e.message || e)) || '');
  if (/memory|\bOOM\b|allocat/i.test(m)) return 'memory';
  if (/timed out|slow/.test(m)) return 'slow';
  return '';
}
function subOff() {
  try {
    const v = sessionStorage.getItem(SUB_OFF_KEY);
    return v === 'memory' || v === 'slow' ? v : '';
  } catch (_) {
    return '';
  }
}
function subOffSet(k) {
  try {
    sessionStorage.setItem(SUB_OFF_KEY, k);
  } catch (_) {}
}
// The subject map for the photo as it's made into a page (prep: _ppPrep): its working size, 0–1 a pixel. Kept on
// prep; one at a time. Rejects when the files aren't stored or it can't run (Focus goes back to Even: ppMake)
// (v329.3 review: one at a time for any photo, not only the same one: a find for another prep, a turn or crop made
// meanwhile, waits for the one running, so there are never two models and their memory at once on an iPad)
let _subRun = null;
function subMap(prep) {
  if (prep.sal) return Promise.resolve(prep.sal);
  if (_subRun && _subRun.prep === prep) return _subRun.p;
  const prev = _subRun ? _subRun.p.catch(function () {}) : Promise.resolve();
  const p = prev.then(async function () {
    if (prep.sal) return prep.sal;
    // (out of memory or too slow already this launch: not tried again, ppMake says why)
    const off = subOff();
    if (off) throw Object.assign(new Error('off this launch (' + off + ')'), { sub: off });
    try {
      return await subFind(prep);
    } catch (e) {
      const k = subFailKind(e);
      if (k) {
        subOffSet(k);
        e.sub = k;
      }
      throw e;
    }
  });
  _subRun = { prep: prep, p: p };
  p.then(
    function () {
      if (_subRun && _subRun.p === p) _subRun = null;
    },
    function () {
      if (_subRun && _subRun.p === p) _subRun = null;
    },
  );
  return p;
}
// (subMap's find itself)
async function subFind(prep) {
  const t0 = Date.now(),
    oc = await caches.open(OCR_CACHE),
    sc = await caches.open(SUB_CACHE),
    [ort, wasm] = await Promise.all(OCR_FILES.slice(0, 2).map((x) => oc.match(ocrUrl(x.f)))),
    model = await sc.match(subUrl(SUB_FILES[0].f));
  if (!ort || !wasm || !model) throw new Error('not stored');
  const ortUrl = URL.createObjectURL(new Blob([await ort.arrayBuffer()], { type: 'text/javascript' })),
    src = subMapUp.toString() + '\n' + subBoxMean.toString() + '\n(' + subWorkerMain.toString() + ')();',
    wurl = URL.createObjectURL(new Blob([src], { type: 'text/javascript' })),
    w = new Worker(wurl);
  try {
    // (each answer within SUB_WAIT: a worker that never answers, ONNX Runtime stuck starting on an old device, mustn't
    // keep the page step waiting for good; the page is made Even then, ppMake)
    const ask = function (msg, tr) {
      return new Promise(function (res, rej) {
        let t = 0;
        // (v329.3 review: a time that ran out while the page was paused, the app in the background, is given again:
        // the worker was paused too, and a time-out now keeps Focus on Even for the launch, subFailKind)
        const arm = function () {
          const due = Date.now() + SUB_WAIT;
          t = setTimeout(function () {
            if (document.hidden || Date.now() - due > 1500) arm();
            else rej(new Error('timed out'));
          }, SUB_WAIT);
        };
        arm();
        w.onmessage = function (e) {
          clearTimeout(t);
          if (e.data && e.data.t === 'error') rej(new Error(e.data.message));
          else res(e.data);
        };
        w.onerror = function (e) {
          clearTimeout(t);
          e.preventDefault();
          rej(new Error(e.message || 'worker'));
        };
        w.postMessage(msg, tr || []);
      });
    };
    const wb = await wasm.arrayBuffer(),
      mb = await model.arrayBuffer();
    try {
      await ask({ t: 'init', ort: ortUrl, wasm: wb, model: mb }, [wb, mb]);
    } catch (e) {
      // (v329.3 review: a start that failed for anything but memory or time: the stored files checked again, and a
      // damaged one let go of, said as not stored so choosing Focus offers the download again, ppMake)
      if (subFailKind(e)) throw e;
      w.terminate();
      if (await subDamaged()) throw new Error('not stored (damaged)');
      throw e;
    }
    // the photo at the model's size, as it wants it
    const S = SUB_SIDE,
      x = new Float32Array(3 * S * S),
      w0 = prep.w,
      h0 = prep.h,
      rgb = prep.rgb;
    for (let y = 0; y < S; y++)
      for (let xx = 0; xx < S; xx++) {
        const fx = Math.min(w0 - 1, ((xx + 0.5) * w0) / S - 0.5),
          fy = Math.min(h0 - 1, ((y + 0.5) * h0) / S - 0.5),
          ix = Math.max(0, Math.floor(fx)),
          iy = Math.max(0, Math.floor(fy)),
          tx = Math.max(0, fx - ix),
          ty = Math.max(0, fy - iy),
          ix1 = Math.min(w0 - 1, ix + 1),
          iy1 = Math.min(h0 - 1, iy + 1);
        for (let c = 0; c < 3; c++) {
          const v =
            rgb[(iy * w0 + ix) * 3 + c] * (1 - tx) * (1 - ty) +
            rgb[(iy * w0 + ix1) * 3 + c] * tx * (1 - ty) +
            rgb[(iy1 * w0 + ix) * 3 + c] * (1 - tx) * ty +
            rgb[(iy1 * w0 + ix1) * 3 + c] * tx * ty;
          x[c * S * S + y * S + xx] = (v / 255 - SUB_MEAN[c]) / SUB_STD[c];
        }
      }
    // (the working picture sent too: the map is made at its size in the worker, off the page's thread)
    const rb = rgb.slice().buffer,
      r = await ask({ t: 'run', x: x.buffer, S: S, rgb: rb, w: w0, h: h0, r: SUB_GF_R, eps: SUB_GF_EPS }, [
        x.buffer,
        rb,
      ]),
      sal = r.y;
    prep.sal = sal;
    // (v326: kept for a crop, an Undo of one or a quarter turn, subFromKept)
    subKeepAdd(prep);
    // (for Copy diagnostics: how long finding the subject took here)
    holdAdd('Subject found in the background', Date.now() - t0, w0 + ' × ' + h0);
    return sal;
  } finally {
    w.terminate();
    // (let go only once it's done: Safari's engine reads a worker's script after new Worker returns, and one let go
    // at once had failed to start, with no message)
    URL.revokeObjectURL(wurl);
    URL.revokeObjectURL(ortUrl);
  }
}
// Focus chosen on the page step: Sharper subject or Simpler background ask to download the subject finder the first
// time (the consent card), then the page is made again (asked first when there's something to lose); Even, straight to
// the remake
// (a download under way: Focus waits for it)
let _subDl = false;
async function ppSetFocus(f) {
  if (!pp || f === pp.f || _ppBusy || _subDl || !srcImg || !SUB_AREA[f]) {
    renderControls();
    return;
  }
  // (v328: a guide opened while the download was asked about or under way keeps its own Focus)
  const g0 = loadGen;
  if (f !== 'even') {
    const need = await subMissing();
    if (g0 !== loadGen) return;
    if (!need) {
      note('This browser can’t keep the subject finder, so Focus stays on Even.');
      renderControls();
      return;
    }
    if (need.length) {
      if (navigator.onLine === false) {
        note('The subject finder needs the internet the first time: connect, then try again.');
        renderControls();
        return;
      }
      const mb = subMB(need),
        a = await askBox(
          'Find the photo’s subject?',
          SUB_NAMES[f] +
            ' finds what your photo is of, on this device: your photo never leaves it. It’s a one-time download of about ' +
            mb +
            ' MB, kept for offline use.',
          '<button type="button" class="btn-primary" data-a="go">Download · ' +
            mb +
            ' MB</button><button type="button" class="sfghost" data-a="stay">Not now</button>',
          true,
        );
      if (g0 !== loadGen) return;
      if (a !== 'go' || !pp) {
        renderControls();
        return;
      }
      note('Downloading the subject finder…');
      _subDl = true;
      // (v329.3 review: the line said again only when its MB changes, as the download now counts up as it comes)
      let said = -1;
      try {
        await subDownload(need, function (n, total) {
          const got = Math.round(n / 1e6);
          if (got === said || g0 !== loadGen) return;
          said = got;
          // (in the line under the picture only: not a toast for each MB)
          note('Downloading the subject finder… ' + got + ' of ' + Math.round(total / 1e6) + ' MB', true);
        });
      } catch (e) {
        _subDl = false;
        if (g0 !== loadGen) return;
        // (v329.3 review: a full device said so, as the reader's download: Try again failed the same way every time)
        const full =
          e && (e.name === 'QuotaExceededError' || /quota|storage/i.test(String((e && e.message) || '')));
        note(
          navigator.onLine === false
            ? 'The connection went, so Focus stays on Even. Connect, then try again.'
            : full
              ? 'This device’s storage is full, so the subject finder couldn’t be kept and Focus stays on Even. Free some space, then try again.'
              : errNote('The subject finder didn’t download, so Focus stays on Even. Try again.', 'Focus', e),
        );
        renderControls();
        return;
      }
      _subDl = false;
      if (!pp || g0 !== loadGen) {
        if (g0 !== loadGen) note('The subject finder is downloaded.');
        return;
      }
      // (v328 review: a page being made meanwhile, a Detail chosen, isn't overtaken: Focus is chosen again after)
      // (v328 review 2: or the page built, or being coloured, meanwhile: not taken back to the page step)
      if (_ppBusy || sfmode !== 'review' || cropMode || pgMode) {
        note('The subject finder is downloaded: choose ' + SUB_NAMES[f] + ' again.');
        renderControls();
        return;
      }
    }
  }
  okGeom(
    function () {
      pp.f = f;
      ppRemade(false);
    },
    true,
    function () {
      renderControls();
    },
  );
}
// (the page step's Focus row, 47-photo-page ctlPhotoPage): none where the subject finder can't run
function ppFocusHTML() {
  if (!subCan()) return '';
  const f = pp.f || 'even',
    hint = {
      even: 'The same detail all over the photo.',
      sharp:
        'More detail and colour on the photo’s subject, the rest as Even. Best when the photo has one clear subject.',
      calm: 'More detail and colour on the photo’s subject, less behind it. Best when the photo has one clear subject.',
      subject: 'Leaves the background white, like a colouring book.',
    };
  // (v329.2: no subject found, said: Sharper subject is then the Even page, Simpler background a simpler one)
  if (
    (f === 'sharp' || f === 'calm') &&
    _ppPrep &&
    _ppPrep.sal &&
    _ppPrep.key === ppPrepKey() &&
    ppSubjectShare(_ppPrep) < SUB_NONE
  )
    hint[f] =
      f === 'sharp'
        ? 'No clear subject found in this photo, so this looks the same as Even.'
        : 'No clear subject found in this photo, so this makes the whole page simpler.';
  // (v329.3 review: the finder out of memory or too slow this launch, subOff: the choices that need it greyed, and
  // said why, unless this photo's subject is found already)
  const off = subOff() && !(_ppPrep && _ppPrep.sal && _ppPrep.key === ppPrepKey()) ? subOff() : '';
  if (off) hint[f] = SUB_OFF_HINT[off];
  return (
    '<div class="sfsublbl" id="sfPpFocLbl">Focus</div><div id="sfPpFoc" role="group" aria-labelledby="sfPpFocLbl" class="sfc-segs">' +
    ['even', 'sharp', 'calm', 'subject']
      .map(function (k) {
        return ctlSeg(k, SUB_NAMES[k], f === k, !srcImg || (!!off && k !== 'even'));
      })
      .join('') +
    '</div><div class="sfrnghint" id="sfPpFocHint">' +
    hint[f] +
    '</div>'
  );
}

// ---- (v326) Subject only ----
// the photo's background, from its subject map: 1 where it's under SUB_CUT (kept with the photo prepared)
function ppSubjectMask(prep) {
  if (!prep.sal) return null;
  if (prep._bgm && prep._bgm.sal === prep.sal) return prep._bgm.m;
  const n = prep.w * prep.h,
    m = new Uint8Array(n);
  for (let i = 0; i < n; i++) m[i] = prep.sal[i] < SUB_CUT ? 1 : 0;
  subStrays(m, prep.w, prep.h);
  prep._bgm = { sal: prep.sal, m: m };
  return m;
}
// (v329.2) the subject's stray parts made background: a separate part under SUB_STRAY of the largest and under
// SUB_NONE of the photo (on the bench: the flower bed's three leaves and a sliver of lily, and nothing real). m: 1 the
// background, changed in place
function subStrays(m, w, h) {
  const n = w * h,
    lab = new Int32Array(n).fill(-1),
    st = new Int32Array(n),
    area = [];
  for (let p = 0; p < n; p++) {
    if (m[p] || lab[p] >= 0) continue;
    const id = area.length;
    let sp = 0,
      a = 0;
    st[sp++] = p;
    lab[p] = id;
    while (sp) {
      const q = st[--sp],
        x = q % w;
      a++;
      const nb = [x > 0 ? q - 1 : -1, x < w - 1 ? q + 1 : -1, q >= w ? q - w : -1, q < n - w ? q + w : -1];
      for (let j = 0; j < 4; j++) {
        const r = nb[j];
        if (r >= 0 && !m[r] && lab[r] < 0) {
          lab[r] = id;
          st[sp++] = r;
        }
      }
    }
    area.push(a);
  }
  if (area.length < 2) return;
  const big = Math.max.apply(null, area),
    drop = area.map(function (a) {
      return a < SUB_STRAY * big && a < SUB_NONE * n;
    });
  for (let p = 0; p < n; p++) if (lab[p] >= 0 && drop[lab[p]]) m[p] = 1;
}
// how much of the photo its subject is (0-1)
function ppSubjectShare(prep) {
  const m = ppSubjectMask(prep);
  if (!m) return 0;
  let k = 0;
  for (let i = 0; i < m.length; i++) if (!m[i]) k++;
  return k / m.length;
}
// the colours the markers are chosen for with Subject only: the subject's pixels', binned as ppPrepare bins the
// photo's (47-photo-page ppTargets), so no marker is chosen for a background that's left white
function ppSubjectTargets(prep) {
  const bg = ppSubjectMask(prep);
  if (!bg) return { l: prep.tl, w: prep.tw };
  if (prep._sTg && prep._sTg.sal === prep.sal) return prep._sTg.t;
  const w = prep.w,
    h = prep.h,
    n = w * h,
    rgb = prep.rgb,
    st = Math.max(1, Math.floor(Math.sqrt(n / 20000))),
    px = [];
  for (let y = 0; y < h; y += st)
    for (let x = 0; x < w; x += st) {
      const p = y * w + x;
      if (bg[p]) continue;
      px.push(rgbLab(rgb[p * 3], rgb[p * 3 + 1], rgb[p * 3 + 2]));
    }
  let bins = new Map();
  for (let q = 3; q <= 12; q++) {
    bins = new Map();
    for (let i = 0; i < px.length; i++) {
      const L = px[i],
        bk = Math.round(L[0] / q) * 1000000 + Math.round(L[1] / q + 200) * 1000 + Math.round(L[2] / q + 200),
        b = bins.get(bk);
      if (b) {
        b.w++;
        b.s[0] += L[0];
        b.s[1] += L[1];
        b.s[2] += L[2];
      } else bins.set(bk, { w: 1, s: [L[0], L[1], L[2]] });
    }
    if (bins.size <= PP_TARGETS) break;
  }
  if (!bins.size) return { l: prep.tl, w: prep.tw };
  const tl = new Float32Array(bins.size * 3),
    tw = new Float32Array(bins.size);
  let ti = 0;
  bins.forEach(function (b) {
    tl[ti * 3] = b.s[0] / b.w;
    tl[ti * 3 + 1] = b.s[1] / b.w;
    tl[ti * 3 + 2] = b.s[2] / b.w;
    tw[ti++] = b.w;
  });
  const t = { l: tl, w: tw };
  prep._sTg = { sal: prep.sal, t: t };
  return t;
}
// (v329.2) the colours the markers are chosen for with Sharper subject and Simpler background: the photo's, binned as
// ppPrepare bins them, each pixel counted 1 + SUB_TW × its map value, so the suggestion spends more of its markers on
// the subject's colours (on the bench: the cormorant's wing and branch a brown and a grey, the subject's likeness about
// 1% better over 15 photos, the background's the same; about one marker more)
const SUB_TW = 3;
function ppFocusTargets(prep) {
  if (!prep.sal) return { l: prep.tl, w: prep.tw };
  if (prep._fTg && prep._fTg.sal === prep.sal) return prep._fTg.t;
  const w = prep.w,
    h = prep.h,
    n = w * h,
    rgb = prep.rgb,
    sal = prep.sal,
    st = Math.max(1, Math.floor(Math.sqrt(n / 20000))),
    px = [],
    pw = [];
  for (let y = 0; y < h; y += st)
    for (let x = 0; x < w; x += st) {
      const p = y * w + x;
      px.push(rgbLab(rgb[p * 3], rgb[p * 3 + 1], rgb[p * 3 + 2]));
      pw.push(1 + SUB_TW * sal[p]);
    }
  let bins = new Map();
  for (let q = 3; q <= 12; q++) {
    bins = new Map();
    for (let i = 0; i < px.length; i++) {
      const L = px[i],
        k = pw[i],
        bk = Math.round(L[0] / q) * 1000000 + Math.round(L[1] / q + 200) * 1000 + Math.round(L[2] / q + 200),
        b = bins.get(bk);
      if (b) {
        b.w += k;
        b.s[0] += L[0] * k;
        b.s[1] += L[1] * k;
        b.s[2] += L[2] * k;
      } else bins.set(bk, { w: k, s: [L[0] * k, L[1] * k, L[2] * k] });
    }
    if (bins.size <= PP_TARGETS) break;
  }
  const tl = new Float32Array(bins.size * 3),
    tw = new Float32Array(bins.size);
  let ti = 0;
  bins.forEach(function (b) {
    tl[ti * 3] = b.s[0] / b.w;
    tl[ti * 3 + 1] = b.s[1] / b.w;
    tl[ti * 3 + 2] = b.s[2] / b.w;
    tw[ti++] = b.w;
  });
  const t = { l: tl, w: tw };
  prep._fTg = { sal: sal, t: t };
  return t;
}
// the subject's box in the photo prepared (its parts of any size, specks aside: a part under 2% of the largest),
// with SUB_MARGIN round it, as fractions of the photo prepared: { x, y, w, h }, or null
function ppSubjectBox(prep) {
  const bg = ppSubjectMask(prep);
  if (!bg) return null;
  // (on a quarter-size grid: the parts, 4-connected)
  const k = 4,
    gw = Math.ceil(prep.w / k),
    gh = Math.ceil(prep.h / k),
    g = new Uint8Array(gw * gh);
  for (let y = 0; y < prep.h; y += k)
    for (let x = 0; x < prep.w; x += k) if (!bg[y * prep.w + x]) g[(y / k) * gw + x / k] = 1;
  const lab = new Int32Array(gw * gh).fill(-1),
    parts = [],
    st = new Int32Array(gw * gh);
  for (let p = 0; p < gw * gh; p++) {
    if (!g[p] || lab[p] >= 0) continue;
    const id = parts.length,
      o = { a: 0, x0: gw, y0: gh, x1: 0, y1: 0 };
    let sp = 0;
    st[sp++] = p;
    lab[p] = id;
    while (sp) {
      const q = st[--sp],
        x = q % gw,
        y = (q / gw) | 0;
      o.a++;
      if (x < o.x0) o.x0 = x;
      if (x > o.x1) o.x1 = x;
      if (y < o.y0) o.y0 = y;
      if (y > o.y1) o.y1 = y;
      const nb = [x > 0 ? q - 1 : -1, x < gw - 1 ? q + 1 : -1, y > 0 ? q - gw : -1, y < gh - 1 ? q + gw : -1];
      for (let i = 0; i < 4; i++) {
        const r = nb[i];
        if (r >= 0 && g[r] && lab[r] < 0) {
          lab[r] = id;
          st[sp++] = r;
        }
      }
    }
    parts.push(o);
  }
  if (!parts.length) return null;
  const big = Math.max.apply(
    null,
    parts.map(function (o) {
      return o.a;
    }),
  );
  let x0 = gw,
    y0 = gh,
    x1 = 0,
    y1 = 0;
  parts.forEach(function (o) {
    if (o.a < big * 0.02) return;
    x0 = Math.min(x0, o.x0);
    y0 = Math.min(y0, o.y0);
    x1 = Math.max(x1, o.x1 + 1);
    y1 = Math.max(y1, o.y1 + 1);
  });
  const mx = (x1 - x0) * SUB_MARGIN,
    my = (y1 - y0) * SUB_MARGIN,
    X0 = Math.max(0, (x0 - mx) / gw),
    Y0 = Math.max(0, (y0 - my) / gh),
    X1 = Math.min(1, (x1 + mx) / gw),
    Y1 = Math.min(1, (y1 + my) / gh);
  return { x: X0, y: Y0, w: X1 - X0, h: Y1 - Y0 };
}
// the offer, on the page step: the subject's box under SUB_CROP of the photo (not after a crop to it: under 0.95 of
// what's left is still offered)
// (v329.2) Subject only on a photo whose subject is under SUB_FEW of it but there, in a box the right shape: the page
// made Even, and the crop offered (ppMake sets it: the prepared photo's key)
let _ppSmallSub = '';
function ppSmallSubOK(prep) {
  const sh = ppSubjectShare(prep);
  if (sh < SUB_NONE || sh >= SUB_FEW) return false;
  const b = ppSubjectBox(prep);
  if (!b) return false;
  const a = (b.w * prep.w) / (b.h * prep.h);
  return a <= SUB_SHAPE && a >= 1 / SUB_SHAPE;
}
function ppCropOfferHTML() {
  // (v329.2: the small subject's offer, the page made Even)
  if (
    pp &&
    pp.f === 'even' &&
    _ppPrep &&
    _ppPrep.sal &&
    srcImg &&
    !cropMode &&
    _ppPrep.key === ppPrepKey() &&
    _ppSmallSub === _ppPrep.key
  )
    return (
      '<div class="sfc-note sfc-mt8" id="sfPpCropSub">The subject is too small a part of this photo for Subject only. ' +
      '<button type="button" class="sflink" id="sfPpCropGo">Crop to the subject</button></div>'
    );
  // (v328: only from the photo as it's turned and cropped now; a prep from before an Undo is another part of it)
  if (
    !pp ||
    pp.f !== 'subject' ||
    !_ppPrep ||
    !_ppPrep.sal ||
    !srcImg ||
    cropMode ||
    _ppPrep.key !== ppPrepKey()
  )
    return '';
  const b = ppSubjectBox(_ppPrep);
  if (!b || b.w * b.h >= SUB_CROP) return '';
  return (
    '<div class="sfc-note sfc-mt8" id="sfPpCropSub">The subject is a small part of the photo. ' +
    '<button type="button" class="sflink" id="sfPpCropGo">Crop to the subject</button></div>'
  );
}
// Crop to the subject: the photo's crop set to the subject's box (one Undo step, as a crop is), and the page made
// again; its map cropped with it (ppPrepare's _subKeep), or found again on the crop when the crop is under half the
// photo (v329.3, SUB_REFIND)
function ppCropSubject() {
  if (!pp || _ppBusy || !srcImg) return;
  const pr = ppPrepare();
  if (!pr || !pr.sal) return;
  const b = ppSubjectBox(pr);
  if (!b) return;
  const cr = cropRect || { x: 0, y: 0, w: 1, h: 1 },
    // (v329.2: the small subject's crop makes the page Subject only, as was asked for)
    small = pp.f === 'even' && _ppSmallSub === pr.key;
  okGeom(function () {
    cropRect = { x: cr.x + b.x * cr.w, y: cr.y + b.y * cr.h, w: b.w * cr.w, h: b.h * cr.h };
    if (small) pp.f = 'subject';
    _ppSmallSub = '';
    ppRemade(true);
  }, true);
}
// (v326) the subject maps of the last two photos prepared, so a crop, or an Undo of one, or a quarter turn, takes
// the map from what was found already: { key: the source, its turn and tilt; rot; rect: the part of the turned
// photo it covers (fractions); w, h; sal }
let _subKeep = [];
function subKeepAdd(prep) {
  if (!prep.sal || !prep.keep) return;
  _subKeep = _subKeep.filter(function (k) {
    return k.sal !== prep.sal;
  });
  _subKeep.unshift({
    src: prep.keep.src,
    rot: prep.keep.rot,
    tilt: prep.keep.tilt,
    rect: prep.keep.rect,
    w: prep.w,
    h: prep.h,
    sal: prep.sal,
  });
  _subKeep = _subKeep.slice(0, 2);
}
// a map for a new photo prepared, from one kept: the same source and tilt, and its rect inside the kept one's (in the
// same turn), or the whole photo in another quarter turn of a kept whole one. null when none fits
function subFromKept(prep) {
  if (!prep.keep) return null;
  const K = prep.keep;
  for (let i = 0; i < _subKeep.length; i++) {
    const k = _subKeep[i];
    if (k.src !== K.src || k.tilt !== K.tilt) continue;
    const r0 = k.rect,
      r1 = K.rect;
    if (k.rot === K.rot) {
      if (
        r1.x < r0.x - 1e-6 ||
        r1.y < r0.y - 1e-6 ||
        r1.x + r1.w > r0.x + r0.w + 1e-6 ||
        r1.y + r1.h > r0.y + r0.h + 1e-6
      )
        continue;
      // (v329.3, decision 103: a crop under half of the photo is found again, on the crop itself: the kept map,
      // enlarged two to ten times, is a blur round a small subject's edges; the model sees the crop at its own size. An
      // Undo back to the whole, or a crop of half or more, still takes the kept map. Review: measured against the whole
      // photo, not the kept map's part of it: a resampled crop is kept too, so a crop made in steps had never got there)
      if (r1.w * r1.h < SUB_REFIND) continue;
      return subResample(k, prep.w, prep.h, function (u, v) {
        // (u, v: fractions of the new photo prepared; to the kept map's)
        return [(r1.x + u * r1.w - r0.x) / r0.w, (r1.y + v * r1.h - r0.y) / r0.h];
      });
    }
    // (a quarter turn of a whole photo, untilted: the kept whole map turned)
    if (!K.tilt && isWhole(r0) && isWhole(r1)) {
      const t = (((K.rot - k.rot) % 360) + 360) % 360;
      return subResample(k, prep.w, prep.h, function (u, v) {
        if (t === 90) return [v, 1 - u];
        if (t === 180) return [1 - u, 1 - v];
        return [1 - v, u];
      });
    }
  }
  return null;
}
function isWhole(r) {
  return r.x <= 1e-6 && r.y <= 1e-6 && r.w >= 1 - 1e-6 && r.h >= 1 - 1e-6;
}
// a kept map resampled to w × h (bilinear), f giving each new pixel's place in it as fractions
function subResample(k, w, h, f) {
  const out = new Float32Array(w * h),
    W0 = k.w,
    H0 = k.h,
    m = k.sal;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const p = f((x + 0.5) / w, (y + 0.5) / h),
        fx = Math.min(W0 - 1, Math.max(0, p[0] * W0 - 0.5)),
        fy = Math.min(H0 - 1, Math.max(0, p[1] * H0 - 0.5)),
        ix = Math.floor(fx),
        iy = Math.floor(fy),
        tx = fx - ix,
        ty = fy - iy,
        ix1 = Math.min(W0 - 1, ix + 1),
        iy1 = Math.min(H0 - 1, iy + 1);
      out[y * w + x] =
        m[iy * W0 + ix] * (1 - tx) * (1 - ty) +
        m[iy * W0 + ix1] * tx * (1 - ty) +
        m[iy1 * W0 + ix] * (1 - tx) * ty +
        m[iy1 * W0 + ix1] * tx * ty;
    }
  return out;
}
