/* ===== The photo reader's engine (v318), run in a Web Worker (src/js/ocr/worker.js; the page's side is
   src/js/photo-read.js). Not part of the page's script: the build puts it, with the worker, in a text block the page
   makes the worker from.
   PaddleOCR's three models through ONNX Runtime Web: a detector (DB) finds the lines of text, a classifier says which
   way up each is, a recogniser (CTC) reads it. The post-processing is our own (no OpenCV): the detector's map into
   rotated boxes (connected components, hull, smallest rectangle, grown by the usual unclip ratio).
   Tuned on photos of trays of Ohuhu and Copic caps (the codes of 471 markers, every one read), in these steps:
   - one look: the detector over the photo (in strips when memory is short), boxes cut level from the photo itself;
   - zoom: a tall box (a cap's code and name merged) detected again on its own, enlarged, so the lines come apart;
   - names: the smaller line under (or over) a code, level with it, read last, turned as its code was;
   - the codes read the way the classifier says, then the unsure turned over, a quarter turn, or in halves; a reading
     shaped like a code preferred; short letter-only and digits-then-letters readings ("EN", "9N": N3 and N6 upside
     down) not settled until read turned over;
   - a second look (o.second): the detector again over the photo turned a quarter, kept only where the first look read
     no code, or saw nothing (the detector misses text running across its grain, and a box read wrongly one way reads
     rightly when found the other way: 247 of 276 Copic caps in wide shots became 266);
   - a lone character is kept only with a name under it (a cap's "0" is the Colorless Blender's; a speck read "0" isn't).
   Streaming: hooks.line(item) as each box's reading settles, hooks.progress({ look, stage, done, total, ms }).
   o.signal (an AbortSignal) stops between runs; read() then resolves with what it has (aborted: true).
   img: { width, height, data: Uint8ClampedArray RGBA }. ort: the onnxruntime-web namespace. */
const OCR2 = (function () {
  const MEAN = [0.406, 0.456, 0.485],
    STD = [0.225, 0.224, 0.229]; // B, G, R (ImageNet, for the detector)

  // --- a level rectangle of the image sampled bilinearly into a W×H float tensor (3 planes, BGR), normalised either
  // the detector's way (det: ImageNet) or the recogniser's ((x-0.5)/0.5). Centre (cx, cy), size (w, h) in image pixels,
  // rotated by a (radians). Outside the image: mid grey.
  function sample(img, cx, cy, w, h, a, W, H, det, out) {
    out = out || new Float32Array(3 * W * H);
    if (a === 0) return sampleLevel(img, cx, cy, w, h, W, H, det, out);
    const n = W * H,
      ca = Math.cos(a),
      sa = Math.sin(a),
      d = img.data,
      iw = img.width,
      ih = img.height;
    for (let y = 0; y < H; y++) {
      const v = ((y + 0.5) / H - 0.5) * h;
      for (let x = 0; x < W; x++) {
        const u = ((x + 0.5) / W - 0.5) * w,
          fx = cx + u * ca - v * sa - 0.5,
          fy = cy + u * sa + v * ca - 0.5,
          x0 = Math.floor(fx),
          y0 = Math.floor(fy),
          wx = fx - x0,
          wy = fy - y0,
          o = y * W + x,
          inside = x0 >= 0 && y0 >= 0 && x0 + 1 < iw && y0 + 1 < ih;
        for (let ch = 0; ch < 3; ch++) {
          const src = 2 - ch; // B from R's slot 2
          let p;
          if (inside) {
            const i00 = (y0 * iw + x0) * 4 + src,
              i10 = i00 + 4,
              i01 = i00 + iw * 4,
              i11 = i01 + 4;
            p = (d[i00] * (1 - wx) + d[i10] * wx) * (1 - wy) + (d[i01] * (1 - wx) + d[i11] * wx) * wy;
          } else {
            const px = (xx, yy) =>
              xx < 0 || yy < 0 || xx >= iw || yy >= ih ? 128 : d[(yy * iw + xx) * 4 + src];
            p =
              (px(x0, y0) * (1 - wx) + px(x0 + 1, y0) * wx) * (1 - wy) +
              (px(x0, y0 + 1) * (1 - wx) + px(x0 + 1, y0 + 1) * wx) * wy;
          }
          out[ch * n + o] = det ? (p / 255 - MEAN[ch]) / STD[ch] : (p / 255 - 0.5) / 0.5;
        }
      }
    }
    return out;
  }

  // (the same for a level rectangle: the weights of each column worked out once)
  function sampleLevel(img, cx, cy, w, h, W, H, det, out) {
    const n = W * H,
      d = img.data,
      iw = img.width,
      ih = img.height,
      X0 = new Int32Array(W),
      X1 = new Int32Array(W),
      WX = new Float32Array(W);
    for (let x = 0; x < W; x++) {
      const fx = Math.min(iw - 1, Math.max(0, cx + ((x + 0.5) / W - 0.5) * w - 0.5)),
        x0 = Math.floor(fx);
      X0[x] = x0;
      X1[x] = Math.min(iw - 1, x0 + 1);
      WX[x] = fx - x0;
    }
    for (let y = 0; y < H; y++) {
      const fy = Math.min(ih - 1, Math.max(0, cy + ((y + 0.5) / H - 0.5) * h - 0.5)),
        y0 = Math.floor(fy),
        y1 = Math.min(ih - 1, y0 + 1),
        wy = fy - y0,
        r0 = y0 * iw * 4,
        r1 = y1 * iw * 4;
      for (let x = 0; x < W; x++) {
        const wx = WX[x],
          a0 = r0 + X0[x] * 4,
          b0 = r0 + X1[x] * 4,
          c0 = r1 + X0[x] * 4,
          e0 = r1 + X1[x] * 4,
          o = y * W + x;
        for (let ch = 0; ch < 3; ch++) {
          const src = 2 - ch,
            p =
              (d[a0 + src] * (1 - wx) + d[b0 + src] * wx) * (1 - wy) +
              (d[c0 + src] * (1 - wx) + d[e0 + src] * wx) * wy;
          out[ch * n + o] = det ? (p / 255 - MEAN[ch]) / STD[ch] : (p / 255 - 0.5) / 0.5;
        }
      }
    }
    return out;
  }

  // --- detection input: the whole image at most maxSide on its long side, each side a multiple of 32
  function detTensor(img, maxSide) {
    const s = Math.min(1, maxSide / Math.max(img.width, img.height));
    const W = Math.max(32, Math.round((img.width * s) / 32) * 32),
      H = Math.max(32, Math.round((img.height * s) / 32) * 32);
    const data = sample(img, img.width / 2, img.height / 2, img.width, img.height, 0, W, H, true);
    return { data: data, W: W, H: H, sx: img.width / W, sy: img.height / H };
  }

  // --- convex hull (monotone chain) of [x,y] points
  function hull(p) {
    p.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [],
      up = [];
    for (const q of p) {
      while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop();
      lo.push(q);
    }
    for (let i = p.length - 1; i >= 0; i--) {
      const q = p[i];
      while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop();
      up.push(q);
    }
    up.pop();
    lo.pop();
    return lo.concat(up);
  }
  // --- the smallest rectangle round a hull: centre, w along angle a, h across it
  function minRect(h) {
    if (h.length === 1) return { cx: h[0][0], cy: h[0][1], w: 0, h: 0, a: 0 };
    let best = null;
    for (let i = 0; i < h.length; i++) {
      const p = h[i],
        q = h[(i + 1) % h.length],
        dx = q[0] - p[0],
        dy = q[1] - p[1],
        L = Math.hypot(dx, dy);
      if (!L) continue;
      const ux = dx / L,
        uy = dy / L;
      let a0 = Infinity,
        a1 = -Infinity,
        b0 = Infinity,
        b1 = -Infinity;
      for (const r of h) {
        const u = r[0] * ux + r[1] * uy,
          v = -r[0] * uy + r[1] * ux;
        if (u < a0) a0 = u;
        if (u > a1) a1 = u;
        if (v < b0) b0 = v;
        if (v > b1) b1 = v;
      }
      const area = (a1 - a0) * (b1 - b0);
      if (!best || area < best.area) {
        const cu = (a0 + a1) / 2,
          cv = (b0 + b1) / 2;
        best = {
          area: area,
          cx: cu * ux - cv * uy,
          cy: cu * uy + cv * ux,
          w: a1 - a0,
          h: b1 - b0,
          a: Math.atan2(uy, ux),
        };
      }
    }
    return best;
  }

  // --- DB post-processing: the text regions of the probability map, as rotated boxes in the map's own pixels
  // (scaled by sx, sy). Reuses the label and stack arrays passed in buf when they fit.
  function boxes(prob, W, H, sx, sy, o, buf) {
    o = o || {};
    const thr = o.thresh || 0.3,
      boxThr = o.boxThresh || 0.6,
      ratio = o.unclip || 1.5,
      N = W * H;
    if (!buf || buf.lab.length < N) buf = { lab: new Int32Array(N), stack: new Int32Array(N) };
    const lab = buf.lab.subarray(0, N),
      stack = buf.stack.subarray(0, N),
      comps = [];
    lab.fill(0);
    let next = 0;
    for (let i = 0; i < N; i++) {
      if (lab[i] || prob[i] < thr) continue;
      next++;
      let sp = 0,
        cnt = 0,
        sum = 0;
      stack[sp++] = i;
      lab[i] = next;
      while (sp) {
        const j = stack[--sp],
          x = j % W,
          y = (j - x) / W;
        cnt++;
        sum += prob[j];
        if (x > 0 && !lab[j - 1] && prob[j - 1] >= thr) ((lab[j - 1] = next), (stack[sp++] = j - 1));
        if (x < W - 1 && !lab[j + 1] && prob[j + 1] >= thr) ((lab[j + 1] = next), (stack[sp++] = j + 1));
        if (y > 0 && !lab[j - W] && prob[j - W] >= thr) ((lab[j - W] = next), (stack[sp++] = j - W));
        if (y < H - 1 && !lab[j + W] && prob[j + W] >= thr) ((lab[j + W] = next), (stack[sp++] = j + W));
      }
      comps[next] = { cnt: cnt, score: sum / cnt, pts: [] };
    }
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const L = lab[y * W + x];
        if (!L) continue;
        const c = comps[L];
        if (c.cnt < 4 || c.score < boxThr) continue;
        if (x === 0 || lab[y * W + x - 1] !== L) c.pts.push([x, y], [x, y + 1]);
        if (x === W - 1 || lab[y * W + x + 1] !== L) c.pts.push([x + 1, y], [x + 1, y + 1]);
      }
    const out = [];
    for (let L = 1; L <= next; L++) {
      const c = comps[L];
      if (!c.pts.length) continue;
      const r = minRect(hull(c.pts));
      if (Math.min(r.w, r.h) < 3) continue;
      const d = (r.w * r.h * ratio) / (2 * (r.w + r.h));
      let w = r.w + 2 * d,
        h = r.h + 2 * d,
        a = r.a;
      if (h > w) {
        const t = w;
        w = h;
        h = t;
        a += Math.PI / 2;
      }
      while (a > Math.PI / 2) a -= Math.PI;
      while (a <= -Math.PI / 2) a += Math.PI;
      if (Math.min(w, h) < 5) continue;
      out.push({ cx: r.cx * sx, cy: r.cy * sy, w: w * sx, h: h * sy, a: a, score: c.score, core: r.h * sy });
    }
    return out;
  }

  // --- a box read turned rot (0, 90, 180, 270): its crop, 48 high, at most maxW wide
  function recTensor(img, b0, rot, maxW, into) {
    const q = rot % 180 !== 0,
      w = q ? b0.h : b0.w,
      h = q ? b0.w : b0.h,
      a = b0.a + (rot * Math.PI) / 180;
    const H = 48,
      W = Math.max(8, Math.min(maxW || 480, Math.round((H * w) / h)));
    return { data: sample(img, b0.cx, b0.cy, w, h, a, W, H, false, into), W: W, H: H };
  }

  // --- CTC greedy: index 0 blank, then the dictionary's characters (the last a space)
  function decode(p, T, C, dict) {
    let s = '',
      conf = 0,
      k = 0,
      last = 0,
      tA = -1,
      tB = -1;
    for (let t = 0; t < T; t++) {
      let bi = 0,
        bv = -1;
      const o = t * C;
      for (let c = 0; c < C; c++) {
        const v = p[o + c];
        if (v > bv) ((bv = v), (bi = c));
      }
      if (bi && bi !== last) {
        s += dict[bi - 1] === undefined ? ' ' : dict[bi - 1];
        conf += bv;
        k++;
        if (tA < 0) tA = t;
        tB = t;
      }
      last = bi;
    }
    // (span: where along the crop the first and last characters were emitted, 0..1: a reading that runs to the
    // crop's very end may be a code cut short by its box)
    return { text: s.trim(), conf: k ? conf / k : 0, span: [tA < 0 ? 0 : tA / T, tB < 0 ? 0 : (tB + 1) / T] };
  }

  // --- a breath: the worker's message queue let run now and then (every 60 ms of reading), so that the page's Stop
  // reaches it. ONNX Runtime's run settles in microtasks, which run before any message: without this, a 'stop' sent
  // during a look waited for the look's end (a whole first look, a minute on an iPad)
  let lastBreath = 0;
  const yieldNow = () =>
    new Promise((res) => {
      if (typeof MessageChannel !== 'function') return setTimeout(res, 0);
      const ch = new MessageChannel();
      ch.port1.onmessage = () => {
        ch.port1.close();
        res();
      };
      ch.port2.postMessage(0);
    });
  async function breathe() {
    const now = Date.now();
    if (now - lastBreath < 60) return;
    lastBreath = now;
    await yieldNow();
  }

  const median = (a) => {
    if (!a.length) return 0;
    const s = a.slice().sort((x, y) => x - y);
    return s[s.length >> 1];
  };

  async function create(ort, det, rec, dictText, cls, copt) {
    copt = copt || {};
    const opt = Object.assign(
      { executionProviders: ['wasm'], graphOptimizationLevel: 'all' },
      copt.session || {},
    );
    const ds = await ort.InferenceSession.create(det, opt),
      rs = await ort.InferenceSession.create(rec, opt),
      cs = cls ? await ort.InferenceSession.create(cls, opt) : null,
      // (a detector of its own for the zoomed tiles, when given: a smaller, quicker one will do there)
      zs = copt.zoomDet ? await ort.InferenceSession.create(copt.zoomDet, opt) : ds,
      dict = dictText.split(/\r?\n/).filter((l, i, a) => l.length || i < a.length - 1);
    let buf = null; // (label/stack arrays of the DB post-processing, reused)

    async function read(img, o, hooks) {
      o = o || {};
      hooks = hooks || {};
      const T0 = Date.now(),
        stat = { recs: {}, cls: 0, ms: {}, zoomTiles: 0, zoomBoxes: 0, tallBoxes: 0 },
        good = o.good || 0.9,
        maxW = o.maxW || 200,
        minH = o.minH || 0,
        words = o.words ? new Set(o.words.map((w) => w.toLowerCase())) : null,
        signal = o.signal,
        aborted = () => !!(signal && signal.aborted);
      let lookN = 1,
        nextId = 0;
      const progress = (stage, done, total) =>
        hooks.progress &&
        hooks.progress({ look: lookN, stage: stage, done: done, total: total, ms: Date.now() - T0 });
      const lap = (k, t) => (stat.ms[k] = (stat.ms[k] || 0) + (Date.now() - t));

      // 1. detection over the photo turned by angle (0, or a quarter turn for the second look) about its centre, at
      // most maxSide on its long side; in detTiles strips across its long side when asked (each strip a run of its
      // own, so the detector's working memory is a strip's; the strips overlap by detOverlap map pixels, more than a
      // line of text, and a box found in two is kept once). The boxes come back in the photo's own pixels.
      async function detect(angle) {
        const t = Date.now(),
          q = angle !== 0,
          FW = q ? img.height : img.width,
          FH = q ? img.width : img.height,
          ca = Math.cos(angle),
          sa = Math.sin(angle);
        progress('det', 0, 1);
        const s0 = Math.min(1, (o.maxSide || 1600) / Math.max(FW, FH)),
          DW = Math.max(32, Math.round((FW * s0) / 32) * 32),
          DH = Math.max(32, Math.round((FH * s0) / 32) * 32),
          sx = FW / DW,
          sy = FH / DH,
          nT = Math.max(1, o.detTiles || 1),
          ov = o.detOverlap || 64,
          tall = DH >= DW,
          L = tall ? DH : DW,
          // (strip length: the long side plus the overlaps, shared out, rounded up to 32)
          SL = nT === 1 ? L : Math.ceil((L + (nT - 1) * ov) / nT / 32) * 32,
          step = nT === 1 ? 0 : (L - SL) / (nT - 1);
        let bx = [];
        stat.detSize = [DW, DH];
        stat.detTiles = nT;
        for (let k = 0; k < nT; k++) {
          await breathe();
          if (aborted()) break;
          const off = Math.round(k * step),
            W = tall ? DW : SL,
            H = tall ? SL : DH,
            // (the strip's centre in the turned frame, then in the photo)
            fx = tall ? FW / 2 : (off + W / 2) * sx,
            fy = tall ? (off + H / 2) * sy : FH / 2,
            cx = img.width / 2 + (fx - FW / 2) * ca - (fy - FH / 2) * sa,
            cy = img.height / 2 + (fx - FW / 2) * sa + (fy - FH / 2) * ca,
            data = sample(img, cx, cy, W * sx, H * sy, angle, W, H, true);
          const dr = await ds.run({ [ds.inputNames[0]]: new ort.Tensor('float32', data, [1, 3, H, W]) });
          const pm = dr[ds.outputNames[0]];
          if (!buf || buf.lab.length < W * H)
            buf = { lab: new Int32Array(W * H), stack: new Int32Array(W * H) };
          const found = boxes(pm.data, W, H, sx, sy, o, buf).filter((b) => b.h >= minH);
          if (pm.dispose) pm.dispose();
          found.forEach((b) => {
            // (how far inside the strip the box lies, past the cuts: one cut by a strip's edge is dropped, the other
            // strip has it whole; of a box found whole in both, the copy nearer a strip's middle is kept)
            const c = tall ? b.cy / sy : b.cx / sx,
              half =
                (tall
                  ? Math.abs(b.w * Math.sin(b.a)) + Math.abs(b.h * Math.cos(b.a))
                  : Math.abs(b.w * Math.cos(b.a)) + Math.abs(b.h * Math.sin(b.a))) /
                2 /
                (tall ? sy : sx),
              edge = Math.min(k > 0 ? c - half : Infinity, k < nT - 1 ? SL - c - half : Infinity);
            if (nT > 1) {
              if (edge < 3) return;
              tall ? (b.cy += off * sy) : (b.cx += off * sx);
              b.edge = edge;
            }
            bx.push(b);
          });
          progress('det', k + 1, nT);
        }
        if (nT > 1) {
          const keep = [];
          bx.sort((a, b) => b.edge - a.edge);
          bx.forEach((b) => {
            const dup = keep.some(
              (k) =>
                Math.hypot(k.cx - b.cx, k.cy - b.cy) < 0.6 * Math.min(k.h, b.h) &&
                Math.abs(k.w - b.w) < 0.5 * Math.max(k.w, b.w),
            );
            if (!dup) keep.push(b);
          });
          stat.detDups = (stat.detDups || 0) + bx.length - keep.length;
          bx = keep;
        }
        // (from the turned frame to the photo: about the centres, the angle turned back)
        if (q)
          bx.forEach((b) => {
            const u = b.cx - FW / 2,
              v = b.cy - FH / 2;
            b.cx = img.width / 2 + u * ca - v * sa;
            b.cy = img.height / 2 + u * sa + v * ca;
            let a = b.a + angle;
            while (a > Math.PI / 2) a -= Math.PI;
            while (a <= -Math.PI / 2) a += Math.PI;
            b.a = a;
          });
        lap(q ? 'det2' : 'det', t);
        return bx;
      }

      // a look's readings in order, each code's names after it. Readings below minConf are left out (a speck read as
      // "0" would be the colourless blender); a lone character only with a name under it (the blender's 0 has its name
      // under it; a speck read "0", even surely, hasn't)
      function order(items) {
        const ordered = [],
          minConf = o.minConf == null ? 0.3 : o.minConf;
        items.forEach((it) => {
          if (it.nameOf || !it.best || it.best.conf < minConf) return;
          if (it.best.text.length === 1 && !it.names.length) return;
          ordered.push(it);
          it.names.forEach((n) => n.best && n.best.conf >= minConf && ordered.push(n));
        });
        return ordered;
      }
      // (v318 review) once read, a code with no name paired and a word read beside it, level with it, just under or over
      // it: that word is its name. The pairing before reading has to be strict, not knowing which box is the code ("BGY18"
      // under the taller "Graphite" would have been its name, never read as a code), so it left out a name overlapping its
      // code's box ("Sakura" 7 px into R23's), as boxes come grown by the unclip ratio; here the readings say which is which
      function latePair(items, lineH) {
        const word = (it) =>
            !it.nameOf &&
            !it.names.length &&
            !it.half &&
            it.best &&
            it.best.conf >= (o.wordConf || 0.5) &&
            /^[A-Za-z][A-Za-z .'-]{2,}$/.test(it.best.text),
          code = (it) =>
            !it.nameOf &&
            !it.names.length &&
            !it.zoomed &&
            it.best &&
            /^[A-Za-z]{0,3}[0-9Oo]{1,4}$/.test(it.best.text) &&
            /[0-9]/.test(it.best.text);
        items
          .filter(code)
          .sort((x, y) => y.best.conf - x.best.conf)
          .forEach((A) => {
            const a = A.box,
              ca = Math.cos(a.a),
              sa = Math.sin(a.a);
            items.forEach((B) => {
              if (B === A || !word(B) || B.box.from) return;
              const b = B.box;
              if (b.h >= a.h * (o.lateH || 1.3)) return;
              let da = Math.abs(a.a - b.a);
              while (da > Math.PI / 2) da = Math.abs(da - Math.PI);
              if (da > (o.pairAngle || 20) * (Math.PI / 180)) return;
              const dx = b.cx - a.cx,
                dy = b.cy - a.cy,
                u = dx * ca + dy * sa,
                v = -dx * sa + dy * ca,
                gap = Math.abs(v) - (a.h + b.h) / 2;
              if (Math.abs(u) > (a.w + b.w) / 4 + 4) return;
              if (gap < (-(o.lateOver || 0.5) * (a.h + b.h)) / 2 || gap > (o.pairGap || 0.8) * lineH) return;
              B.nameOf = A;
              A.names.push(B);
            });
          });
      }

      // (the zoom's one pass: each box's tile, z times enlarged, padW and pad of its size around it along and across
      // its text, detected again; its lines when it comes apart, else the box kept)
      async function zoomPass(tall, z, padW, pad) {
        // (one tile size for all, so they run as one batch: the largest, rounded to 32)
        const tiles = tall.map((b) => {
          // (wider along the text than across it: a line can run past the box's ends, and the tile costs little)
          const w = b.w * (1 + 2 * padW) + (o.zoomMargin == null ? 16 : o.zoomMargin),
            h = b.h * (1 + 2 * pad) + (o.zoomMargin == null ? 16 : o.zoomMargin);
          return { b: b, w: w, h: h, W: Math.ceil((w * z) / 32) * 32, H: Math.ceil((h * z) / 32) * 32 };
        });
        // (grouped by tile size so that most share one; a group is one run)
        const groups = new Map();
        tiles.forEach((tl) => {
          const W = Math.min(tl.W, 512),
            H = Math.min(tl.H, 512),
            k = W + 'x' + H;
          if (!groups.has(k)) groups.set(k, { W: W, H: H, list: [] });
          groups.get(k).list.push(tl);
        });
        const found = [],
          keep = [];
        for (const g of groups.values()) {
          if (aborted()) break;
          const bs = o.zoomBatch || 8;
          for (let i = 0; i < g.list.length; i += bs) {
            await breathe();
            if (aborted()) break;
            const grp = g.list.slice(i, i + bs),
              n = g.W * g.H,
              data = new Float32Array(grp.length * 3 * n);
            grp.forEach((tl, k) => {
              // (the tile covers W/z × H/z image pixels around the box, level with its text)
              sample(
                img,
                tl.b.cx,
                tl.b.cy,
                g.W / z,
                g.H / z,
                tl.b.a,
                g.W,
                g.H,
                true,
                data.subarray(k * 3 * n, (k + 1) * 3 * n),
              );
            });
            const rr = await zs.run({
              [zs.inputNames[0]]: new ort.Tensor('float32', data, [grp.length, 3, g.H, g.W]),
            });
            const out = rr[zs.outputNames[0]];
            stat.zoomTiles += grp.length;
            grp.forEach((tl, k) => {
              const sub = boxes(out.data.subarray(k * n, (k + 1) * n), g.W, g.H, 1, 1, o, buf),
                ca = Math.cos(tl.b.a),
                sa = Math.sin(tl.b.a),
                lines = [];
              sub.forEach((s) => {
                // (back to the image: unzoomed, turned by the box's angle, about its centre)
                const u = (s.cx - g.W / 2) / z,
                  v = (s.cy - g.H / 2) / z,
                  w = s.w / z,
                  h = s.h / z;
                if (h < Math.max(8, minH * 0.6)) return;
                let a = s.a + tl.b.a;
                while (a > Math.PI / 2) a -= Math.PI;
                while (a <= -Math.PI / 2) a += Math.PI;
                // (only lines inside the tall box, give or take; the tile may show a neighbour's text)
                if (Math.abs(u) > tl.b.w * 0.75 + 4 || Math.abs(v) > tl.b.h * 0.6 + 4) return;
                lines.push({
                  cx: tl.b.cx + u * ca - v * sa,
                  cy: tl.b.cy + u * sa + v * ca,
                  w: w,
                  h: h,
                  a: a,
                  score: s.score,
                  from: tl.b,
                });
              });
              // (two or more lines, none as tall as the box was: split. Else the box stays, to be read whole and split in halves)
              if (lines.length >= 2 && lines.every((l) => l.h < tl.b.h * 0.8)) {
                found.push(...lines);
                stat.zoomBoxes += lines.length;
              } else keep.push(tl.b);
            });
            if (out.dispose) out.dispose();
            progress('zoom', Math.min(g.list.length, i + bs), tiles.length);
          }
        }
        return { found: found, keep: keep };
      }

      // 2.–4. a look's boxes read (lineH0: the first look's line height, for the second)
      async function readBoxes(bx, lineH0) {
        // 2. zoom: tall boxes (lines merged) detected again, each on its own, enlarged
        let t;
        const lineH = lineH0 || median(bx.filter((b) => b.w / b.h >= 1.8).map((b) => b.h)) || 30,
          tallH = Math.max(o.tallMin || 44, (o.tall || 1.45) * lineH);
        stat.lineH = lineH;
        if (o.zoom && !aborted()) {
          t = Date.now();
          const tall = bx.filter((b) => b.h >= tallH),
            rest = bx.filter((b) => b.h < tallH),
            z = o.zoom === true ? 2 : o.zoom,
            pad = o.zoomPad || 0.15;
          stat.tallBoxes = tall.length;
          let { found, keep } = await zoomPass(tall, z, o.zoomPadW == null ? 0.25 : o.zoomPadW, pad);
          // (v318 review) a box that didn't come apart and is about as tall as it's wide: lines merged, and which way they
          // run unsure ("G49 / Sour / Apple" turned 55°, its box taken as turned the other way, read as junk). Again, the
          // tile square round it and turned a quarter: the detector parts lines that run across the tile, not down it
          if (o.zoom2 && keep.length && !aborted()) {
            const sq = keep.filter((b) => b.w / b.h < (o.zoom2Sq || 1.5)),
              // (each a copy, square, the side its longer, turned a quarter)
              sqs = sq.map((b) =>
                Object.assign({}, b, { w: Math.max(b.w, b.h), h: Math.max(b.w, b.h), a: b.a + Math.PI / 2 }),
              );
            if (sq.length) {
              const z2 = await zoomPass(sqs, o.zoom2, 0.1, 0.1);
              stat.zoom2 = { tried: sq.length, split: sq.length - z2.keep.length };
              found = found.concat(z2.found);
              keep = keep.filter((b) => sq.indexOf(b) < 0 || z2.keep.indexOf(sqs[sq.indexOf(b)]) >= 0);
            }
          }
          bx = rest.concat(found, keep);
          lap('zoom', t);
        }

        // 3. which boxes are a cap's name under its code: the smaller line right below (or above: the cap may be upside
        // down) a bigger one, level with it; of a zoomed box's lines, all but the tallest. Names are read after the codes
        // (phase 2), each turned the way its code was read, once, with no retries; or not at all (o.names === false).
        const items = bx.map((b) => ({
          id: ++nextId,
          look: lookN,
          box: b,
          all: [],
          best: null,
          done: false,
          zoomed: !!b.from,
          names: [],
          nameOf: null,
        }));
        if (o.pair !== false) {
          const byFrom = new Map();
          items.forEach((it) => {
            if (!it.box.from) return;
            if (!byFrom.has(it.box.from)) byFrom.set(it.box.from, []);
            byFrom.get(it.box.from).push(it);
          });
          byFrom.forEach((grp) => {
            grp.sort((x, y) => y.box.h - x.box.h);
            for (let i = 1; i < grp.length; i++) {
              grp[i].nameOf = grp[0];
              grp[0].names.push(grp[i]);
            }
          });
          const free = items.filter((it) => !it.box.from).sort((x, y) => y.box.h - x.box.h);
          for (const A of free) {
            if (A.nameOf) continue;
            const a = A.box,
              ca = Math.cos(a.a),
              sa = Math.sin(a.a);
            for (const B of free) {
              if (B === A || B.nameOf || B.names.length) continue;
              const b = B.box;
              if (b.h >= a.h * (o.pairH || 0.92)) continue;
              let da = Math.abs(a.a - b.a);
              while (da > Math.PI / 2) da = Math.abs(da - Math.PI);
              if (da > (o.pairAngle || 20) * (Math.PI / 180)) continue;
              const dx = b.cx - a.cx,
                dy = b.cy - a.cy,
                u = dx * ca + dy * sa,
                v = -dx * sa + dy * ca,
                gap = Math.abs(v) - (a.h + b.h) / 2;
              if (Math.abs(u) > (a.w + b.w) / 4 + 4) continue;
              if (gap < -6 || gap > (o.pairGap || 0.8) * lineH) continue;
              B.nameOf = A;
              A.names.push(B);
            }
          }
        }
        const codes = items.filter((it) => !it.nameOf),
          total = codes.length;
        stat.names = items.length - codes.length;
        let nRec = 0;
        // which way up each crop is, as it lies (base) or turned over: Paddle's 0/180 classifier, 48x192, in batches
        async function turn(list, base, key) {
          if (!cs) {
            list.forEach((it) => (it[key] = base));
            return;
          }
          const W = 192,
            H = 48;
          for (let i = 0; i < list.length; i += 16) {
            await breathe();
            if (aborted()) return;
            const grp = list.slice(i, i + 16),
              data = new Float32Array(grp.length * 3 * H * W);
            grp.forEach(function (it, k) {
              const tt = recTensor(img, it.box, base, W);
              for (let ch = 0; ch < 3; ch++)
                for (let y = 0; y < H; y++)
                  data.set(
                    tt.data.subarray(ch * H * tt.W + y * tt.W, ch * H * tt.W + y * tt.W + tt.W),
                    ((k * 3 + ch) * H + y) * W,
                  );
            });
            const rr = await cs.run({
              [cs.inputNames[0]]: new ort.Tensor('float32', data, [grp.length, 3, H, W]),
            });
            const out = rr[cs.outputNames[0]];
            grp.forEach(function (it, k) {
              it[key] = out.data[k * 2 + 1] > (o.clsThr || 0.9) ? base + 180 : base;
            });
            if (out.dispose) out.dispose();
            stat.cls += grp.length;
          }
        }
        const codeLike = (tx) => /^[A-Za-z]{0,3}[0-9Oo]{1,4}$/.test(tx) && /[0-9]/.test(tx) && tx.length >= 2,
          score = (r) => r.conf + (codeLike(r.text) ? (o.codeBonus == null ? 0.15 : o.codeBonus) : 0);
        // whether a reading is settled: sure, or a word that's no code (a colour's name, or any long word of letters)
        // (a short word of letters only, "EN", isn't: it may be a code upside down, N3)
        function settled(r) {
          if (
            o.shortLetters !== false &&
            /^[A-Za-z]{2,3}$/.test(r.text) &&
            !(words && words.has(r.text.toLowerCase())) &&
            !r.flipped
          )
            return false;
          // (v3: nor is one of digits then letters, "9N": no code is, but N6 upside down reads so, surely)
          if (
            o.backwards !== false &&
            /^[0-9Oo]{1,4}[A-Za-z]{1,3}$/.test(r.text) &&
            /[0-9]/.test(r.text) &&
            !r.flipped
          )
            return false;
          if (r.conf >= good) return true;
          const tx = r.text;
          if (
            words &&
            tx.length >= 3 &&
            /^[A-Za-z]+$/.test(tx) &&
            words.has(tx.toLowerCase()) &&
            r.conf >= (o.wordConf || 0.5)
          )
            return true;
          if (
            o.longWord &&
            tx.length >= (o.longWord === true ? 5 : o.longWord) &&
            /^[A-Za-z]+$/.test(tx) &&
            r.conf >= (o.wordConf || 0.5)
          )
            return true;
          return false;
        }
        // one pass: each item's crop read turned rot(it); readings kept, the best told to hooks.line when settled
        async function pass(list, rot, tag) {
          for (const it of list) {
            await breathe();
            if (aborted()) return;
            const r0 = typeof rot === 'function' ? rot(it) : rot,
              tt = recTensor(img, it.box, r0, maxW),
              ts = Date.now(),
              rr = await rs.run({
                [rs.inputNames[0]]: new ort.Tensor('float32', tt.data, [1, 3, tt.H, tt.W]),
              }),
              out = rr[rs.outputNames[0]],
              T = out.dims[1],
              C = out.dims[2],
              r = decode(out.data, T, C, dict);
            stat.ms.rec = (stat.ms.rec || 0) + (Date.now() - ts);
            if (out.dispose) out.dispose();
            r.flip = r0;
            r.pass = tag;
            it.all.push(r);
            // (the best reading: by confidence, with a bonus for one shaped like a code — letters then digits, an O
            // among them allowed — so that "vo00" read as it lies beats "000∧" read turned over)
            if (!it.best || score(r) > score(it.best)) it.best = r;
            nRec++;
            stat.recs[tag] = (stat.recs[tag] || 0) + 1;
            if (!it.done && settled(it.best)) {
              it.done = true;
              if (hooks.line && !it.quiet) hooks.line(it);
            }
            // (of the codes only: names and halves read later would take the count past the total)
            progress('rec', Math.min(total, codes.filter((x) => x.done).length), total);
          }
        }
        t = Date.now();
        await turn(codes, 0, 't0');
        lap('cls', t);
        t = Date.now();
        await pass(codes, (it) => it.t0, 'first');
        // the unsure: turned over (cls was wrong), the squarish ones a quarter turn too
        const unsure = () => codes.filter((it) => !it.done && !it.half);
        if (o.retry !== false) {
          const fl = unsure();
          await pass(fl, (it) => (it.t0 + 180) % 360, 'flip');
          fl.forEach((it) => {
            it.all.forEach((r) => (r.flipped = true));
            if (!it.done && it.best && settled(it.best)) {
              it.done = true;
              if (hooks.line) hooks.line(it);
            }
          });
        }
        const sq = unsure().filter((it) => !it.zoomed && it.box.w / it.box.h < (o.quad || 0));
        if (sq.length) {
          await turn(sq, 90, 't90');
          await pass(sq, (it) => it.t90, 'quarter');
          if (o.retry !== false)
            await pass(
              sq.filter((it) => !it.done),
              (it) => (it.t90 + 180) % 360,
              'quarterFlip',
            );
        }
        // two lines read as one box still (not split by zoom): each half on its own
        if (o.split && !aborted()) {
          const halves = [];
          codes
            // (v3: a tall box the zoom didn't split is split too, unless it already reads as a code: its halves would be
            // the same code again, half of it misread, "V26" beside "Y26")
            .filter(
              (it) =>
                it.best &&
                !it.half &&
                !it.zoomed &&
                ((it.box.w / it.box.h < o.split && !it.done) ||
                  (o.splitTall !== false &&
                    it.box.h >= tallH &&
                    !(it.done && it.best && codeLike(it.best.text)))),
            )
            .forEach(function (it) {
              const b = it.box,
                q = it.best.flip % 180 !== 0,
                nx = q ? Math.cos(b.a) : -Math.sin(b.a),
                ny = q ? Math.sin(b.a) : Math.cos(b.a),
                d = (q ? b.w : b.h) / 4;
              [-1, 1].forEach(function (sg) {
                const sb = q
                  ? { cx: b.cx + nx * d * sg, cy: b.cy + ny * d * sg, w: b.w / 2 + 4, h: b.h, a: b.a }
                  : { cx: b.cx + nx * d * sg, cy: b.cy + ny * d * sg, w: b.w, h: b.h / 2 + 4, a: b.a };
                halves.push({
                  id: ++nextId,
                  look: lookN,
                  box: sb,
                  all: [],
                  best: null,
                  of: it,
                  rot: it.best.flip,
                  half: true,
                  // (told to the page once the pair's been compared, below)
                  quiet: !!o.halfBox,
                  done: false,
                  names: [],
                  nameOf: null,
                });
              });
            });
          await pass(halves, (h) => h.rot, 'half');
          // (v318.1, o.halfBox) a box read whole as one of its halves reads ("BV29", its halves "BV29" and "RV29"): one
          // line, read in full; the other half is a part of it, or a scrap below it, and isn't a code of its own
          if (o.halfBox) {
            const k = (t) => t.toUpperCase().replace(/[^A-Z0-9]/g, '');
            for (let i = 0; i + 1 < halves.length; i += 2) {
              const w = halves[i].of,
                pair = [halves[i], halves[i + 1]];
              if (!w.best || !codeLike(w.best.text)) continue;
              pair.forEach((h, j) => {
                const o2 = pair[1 - j];
                if (h.best && o2.best && k(h.best.text) === k(w.best.text) && codeLike(o2.best.text))
                  o2.best = null;
              });
            }
          }
          halves.forEach(function (h) {
            // (a half that reads surely, or like a code, is a line of its own)
            // (v3: of three characters or more — a two-character half, "c2", is half of a longer code, G28)
            // (and never a single character, "0": a sliver of a line, however surely read)
            if (
              h.best &&
              h.best.text.length >= 2 &&
              (h.best.conf >= good ||
                (codeLike(h.best.text) &&
                  h.best.text.length >= (o.halfLen || 3) &&
                  h.best.conf >= (o.halfConf || 0.7)))
            ) {
              items.push(h);
              if (h.quiet && h.done && hooks.line) hooks.line(h);
            }
          });
        }
        // phase 2: the names, each turned as its code was read (cls'd when the code is unsure), once
        if (o.names !== false && !aborted()) {
          const nm = items.filter((it) => it.nameOf);
          const sure = nm.filter((it) => it.nameOf.best && it.nameOf.best.conf >= good),
            rest = nm.filter((it) => sure.indexOf(it) < 0);
          sure.forEach((it) => (it.t0 = it.nameOf.best.flip % 180 === 0 ? it.nameOf.best.flip : 0));
          await turn(rest, 0, 't0');
          await pass(nm, (it) => it.t0, 'name');
        }
        // (v318 review) a zoomed box's lines: the tallest was taken for the code, the rest its names, before reading. When
        // it reads as a word and one of the others surely as a code ("Apple" over "G49"), that one's the code
        items.forEach((A) => {
          if (!A.zoomed || A.nameOf || !A.names.length || !A.best || codeLike(A.best.text)) return;
          const N = A.names.find((n) => n.best && n.best.conf >= good && codeLike(n.best.text));
          if (!N) return;
          const rest = A.names.filter((n) => n !== N).concat([A]);
          A.names = [];
          N.nameOf = null;
          N.names = rest;
          rest.forEach((n) => (n.nameOf = N));
          N.done = true;
          if (hooks.line) hooks.line(N);
        });
        // (the unsettled, told last: amber)
        items.forEach((it) => {
          if (!it.done && it.best) {
            it.done = true;
            it.unsure = true;
            if (hooks.line) hooks.line(it);
          }
        });
        lap('recAll', t);
        stat.nRec = (stat.nRec || 0) + nRec;
        stat.lines = (stat.lines || 0) + items.length;
        return { items: items, ordered: order(items), lineH: lineH, tallH: tallH };
      }

      // the first look
      const first = await readBoxes(await detect(0), 0);
      let lines = first.ordered,
        second = null;
      // the second look: turned a quarter, only where the first read no code (not a name, not shaped like a code) or
      // saw nothing (no box of its lines there)
      if (o.second && !aborted()) {
        lookN = 2;
        const t2 = Date.now(),
          codeLike = (tx) => /^[A-Za-z]{0,3}[0-9Oo]{1,4}$/.test(tx) && /[0-9]/.test(tx) && tx.length >= 2,
          ins = (k, x, y) => {
            const dx = x - k.cx,
              dy = y - k.cy,
              u = dx * Math.cos(k.a) + dy * Math.sin(k.a),
              v = -dx * Math.sin(k.a) + dy * Math.cos(k.a),
              m = 0.25 * k.h;
            return Math.abs(u) <= k.w / 2 + m && Math.abs(v) <= k.h / 2 + m;
          },
          over = (k, b) => ins(k, b.cx, b.cy) || ins(b, k.cx, k.cy),
          seen = first.ordered.map((it) => it.box),
          // (which of the first look's readings hold no code: the page says, by its own reading of codes, when it can
          // (hooks.codes: a promise of the ids of those that do); else by their shape)
          has = hooks.codes ? await hooks.codes(first.ordered.filter((it) => !it.nameOf)) : null,
          failed = first.ordered
            .filter((it) => !it.nameOf && !(has ? has.has(it.id) : codeLike(it.best.text)))
            .map((it) => it.box),
          found = await detect(o.secondAngle == null ? Math.PI / 2 : o.secondAngle),
          kept = found.filter((b) => failed.some((k) => over(k, b)) || !seen.some((k) => over(k, b)));
        stat.look2 = { found: found.length, kept: kept.length, failed: failed.length, seen: seen.length };
        if (kept.length && !aborted()) second = await readBoxes(kept, first.lineH);
        if (second) lines = lines.concat(second.ordered);
        lap('look2', t2);
      }
      // (names paired once read: each look's own, after the second look, which looks again where the first read no code)
      if (o.pairLate && !aborted()) {
        latePair(first.items, first.lineH);
        if (second) latePair(second.items, first.lineH);
        lines = order(first.items).concat(second ? order(second.items) : []);
      }
      return {
        lines: lines,
        ms: Date.now() - T0,
        stat: stat,
        aborted: aborted(),
        lineH: first.lineH,
        tallH: first.tallH,
      };
    }
    return {
      read: read,
      release: () =>
        Promise.all([
          ds.release && ds.release(),
          rs.release && rs.release(),
          cs && cs.release && cs.release(),
          zs !== ds && zs.release && zs.release(),
        ]),
    };
  }
  return {
    create: create,
    detTensor: detTensor,
    boxes: boxes,
    recTensor: recTensor,
    decode: decode,
    hull: hull,
    minRect: minRect,
    sample: sample,
  };
})();
if (typeof self !== 'undefined') self.OCR2 = OCR2;
