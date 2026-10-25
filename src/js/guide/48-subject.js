/* ---- (v325.1) Focus on a photo-made page: the photo's subject, found on this device ----
    U²-Net's small model (vendor/subject/<SUB_VER>/, 4.6 MB) says how much each part of the photo is its subject; the
    page builder then keeps more detail there (Sharper subject) and, with Simpler background, less behind it (Focus,
    docs/PLAN-photo-to-page.md: it moves detail within Detail's limits, never under the step's smallest width, and
    doesn't hold the section count). It runs on ONNX Runtime Web, the photo reader's own copy (photo-read.js:
    OCR_FILES' two ort files, in the reader's cache), in a worker of its own, ended once the map is made so its memory
    goes with it. Downloaded only after a consent card, into a cache of its own (and the reader's, for ONNX Runtime,
    when the reader hasn't brought it); each file checked, size and hash, before it's kept. The map is kept with the
    photo as it's made into a page (_ppPrep.sal), so a Detail change doesn't find it again. */
const SUB_VER = '1',
  SUB_DIR = 'vendor/subject/' + SUB_VER + '/',
  SUB_CACHE = 'marker-studio-subject-' + SUB_VER,
  // (its size and SHA-256: vendor/subject/README.md)
  SUB_FILES = [
    { f: 'u2netp.onnx', n: 4574861, h: '309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8' },
  ],
  // (the model's input: 320 × 320, RGB, ImageNet's mean and spread)
  SUB_SIDE = 320,
  // (how long the finder's worker may take to answer, to start or to make the map: several times an iPad's few seconds)
  SUB_WAIT = 60000,
  SUB_MEAN = [0.485, 0.456, 0.406],
  SUB_STD = [0.229, 0.224, 0.225],
  // Focus's sizes: [the subject's, the rest's] smallest area, as a share of Detail's (Sharper subject: the subject at
  // 0.3, still never under the step's smallest width; Simpler background: the rest at 1.6 too). Measured in the spike
  // at Medium: Sharper subject 0 to +33% sections, Simpler background −40% to +10%
  SUB_AREA = { even: [1, 1], sharp: [0.3, 1], calm: [0.3, 1.6], subject: [1, 1] },
  SUB_NAMES = { even: 'Even', sharp: 'Sharper subject', calm: 'Simpler background', subject: 'Subject only' },
  // (v326) Subject only (docs/PLAN-v326-photo-page.md, 4): the photo's background where the map is under SUB_CUT,
  // left white; a map that calls under SUB_FEW of the photo its subject has none clear enough (measured on 17
  // photos: the sunset, a landscape, trees, a flower bed under 5%; a bird 7%); the crop offered when the subject's
  // box is under SUB_CROP of the photo, with SUB_MARGIN round it
  SUB_CUT = 0.5,
  SUB_FEW = 0.05,
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
      buf = new Uint8Array(await res.arrayBuffer());
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
        ort.env.wasm.numThreads = 1;
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
        // (from 0 to 1 over this picture, as the model's own examples do)
        let lo = Infinity,
          hi = -Infinity;
        for (let i = 0; i < y.length; i++) {
          if (y[i] < lo) lo = y[i];
          if (y[i] > hi) hi = y[i];
        }
        const k = 1 / Math.max(1e-6, hi - lo);
        for (let i = 0; i < y.length; i++) y[i] = (y[i] - lo) * k;
        postMessage({ t: 'map', y: y }, [y.buffer]);
      }
    } catch (e) {
      postMessage({ t: 'error', message: String((e && (e.message || e)) || 'error') });
    }
  };
}
// The subject map for the photo as it's made into a page (prep: _ppPrep): its working size, 0–1 a pixel. Kept on
// prep; one at a time. Rejects when the files aren't stored or it can't run (Focus goes back to Even: ppMake)
let _subRun = null;
function subMap(prep) {
  if (prep.sal) return Promise.resolve(prep.sal);
  if (_subRun && _subRun.prep === prep) return _subRun.p;
  const p = (async function () {
    const t0 = Date.now(),
      oc = await caches.open(OCR_CACHE),
      sc = await caches.open(SUB_CACHE),
      [ort, wasm] = await Promise.all(OCR_FILES.slice(0, 2).map((x) => oc.match(ocrUrl(x.f)))),
      model = await sc.match(subUrl(SUB_FILES[0].f));
    if (!ort || !wasm || !model) throw new Error('not stored');
    const ortUrl = URL.createObjectURL(new Blob([await ort.arrayBuffer()], { type: 'text/javascript' })),
      src = '(' + subWorkerMain.toString() + ')();',
      wurl = URL.createObjectURL(new Blob([src], { type: 'text/javascript' })),
      w = new Worker(wurl);
    try {
      // (each answer within SUB_WAIT: a worker that never answers, ONNX Runtime stuck starting on an old device, mustn't
      // keep the page step waiting for good; the page is made Even then, ppMake)
      const ask = function (msg, tr) {
        return new Promise(function (res, rej) {
          const t = setTimeout(function () {
            rej(new Error('timed out'));
          }, SUB_WAIT);
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
      await ask({ t: 'init', ort: ortUrl, wasm: wb, model: mb }, [wb, mb]);
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
      const r = await ask({ t: 'run', x: x.buffer, S: S }, [x.buffer]),
        m = r.y,
        sal = new Float32Array(w0 * h0);
      // back at the working size, smoothly
      for (let y = 0; y < h0; y++)
        for (let xx = 0; xx < w0; xx++) {
          const fx = Math.min(S - 1, Math.max(0, ((xx + 0.5) * S) / w0 - 0.5)),
            fy = Math.min(S - 1, Math.max(0, ((y + 0.5) * S) / h0 - 0.5)),
            ix = Math.floor(fx),
            iy = Math.floor(fy),
            tx = fx - ix,
            ty = fy - iy,
            ix1 = Math.min(S - 1, ix + 1),
            iy1 = Math.min(S - 1, iy + 1);
          sal[y * w0 + xx] =
            m[iy * S + ix] * (1 - tx) * (1 - ty) +
            m[iy * S + ix1] * tx * (1 - ty) +
            m[iy1 * S + ix] * (1 - tx) * ty +
            m[iy1 * S + ix1] * tx * ty;
        }
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
  })();
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
  if (f !== 'even') {
    const need = await subMissing();
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
      if (a !== 'go' || !pp) {
        renderControls();
        return;
      }
      note('Downloading the subject finder…');
      _subDl = true;
      try {
        await subDownload(need, function (n, total) {
          note(
            'Downloading the subject finder… ' +
              Math.round(n / 1e6) +
              ' of ' +
              Math.round(total / 1e6) +
              ' MB',
          );
        });
      } catch (e) {
        _subDl = false;
        note(
          navigator.onLine === false
            ? 'The connection went, so Focus stays on Even. Connect, then try again.'
            : errNote('The subject finder didn’t download, so Focus stays on Even. Try again.', 'Focus', e),
        );
        renderControls();
        return;
      }
      _subDl = false;
      if (!pp) return;
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
      sharp: 'More detail on the photo’s subject, the rest as Even.',
      calm: 'More detail on the photo’s subject, less behind it.',
      subject: 'Leaves the background white, like a colouring book.',
    };
  return (
    '<div class="sfsublbl" id="sfPpFocLbl">Focus</div><div id="sfPpFoc" role="group" aria-labelledby="sfPpFocLbl" class="sfc-segs">' +
    ['even', 'sharp', 'calm', 'subject']
      .map(function (k) {
        return ctlSeg(k, SUB_NAMES[k], f === k, !srcImg);
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
  prep._bgm = { sal: prep.sal, m: m };
  return m;
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
function ppCropOfferHTML() {
  if (!pp || pp.f !== 'subject' || !_ppPrep || !_ppPrep.sal || !srcImg || cropMode) return '';
  const b = ppSubjectBox(_ppPrep);
  if (!b || b.w * b.h >= SUB_CROP) return '';
  return (
    '<div class="sfc-note sfc-mt8" id="sfPpCropSub">The subject is a small part of the photo. ' +
    '<button type="button" class="sflink" id="sfPpCropGo">Crop to the subject</button></div>'
  );
}
// Crop to the subject: the photo's crop set to the subject's box (one Undo step, as a crop is), and the page made
// again; its map cropped with it (ppPrepare's _subKeep), not found again
function ppCropSubject() {
  if (!pp || _ppBusy || !_ppPrep || !_ppPrep.sal || !srcImg) return;
  const b = ppSubjectBox(_ppPrep);
  if (!b) return;
  const cr = cropRect || { x: 0, y: 0, w: 1, h: 1 };
  okGeom(function () {
    cropRect = { x: cr.x + b.x * cr.w, y: cr.y + b.y * cr.h, w: b.w * cr.w, h: b.h * cr.h };
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
