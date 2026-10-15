/* ===== The photo reader's worker (v318): runs the engine (engine.js, before this in the same worker) off the page, so
   the page stays responsive and the reader's memory (some hundreds of MB while it reads; WebAssembly's never shrinks)
   goes when the page ends the worker (photo-read.js, as Scan closes). Messages:
   page → worker  { t: 'init', ort: blob URL of onnxruntime's module, wasm, det, rec, cls: ArrayBuffers, dict: text }
                  { t: 'read', img: { width, height, data: ArrayBuffer RGBA }, o: options }
                  { t: 'codes', ids: [...] }   (the answer to a 'codes' question)
                  { t: 'stop' }
   worker → page  { t: 'ready', ms } · { t: 'line', item } · { t: 'progress', p } · { t: 'codes', items: [[id, text]] }
                  { t: 'done', lines, stat, ms, aborted } · { t: 'error', message, memory } */
let reader = null,
  running = null,
  askCodes = null;
// an item as the page sees it: its reading, and the box it was read from (photo pixels; angle in degrees)
const ser = (it) => ({
  id: it.id,
  look: it.look,
  text: it.best ? it.best.text : '',
  conf: it.best ? +it.best.conf.toFixed(3) : 0,
  unsure: !!it.unsure,
  nameOf: it.nameOf ? it.nameOf.id : 0,
  // (v318.3) every reading tried, in the order read: the page may take another when the best holds no code
  alts: (it.all || []).map((r) => [r.text, +r.conf.toFixed(3), r.flip || 0]),
  // (v318.3) the turn its best reading was read at (180: upside down), for the cap's picture beside a question
  turn: it.best ? it.best.flip || 0 : 0,
  box: [
    Math.round(it.box.cx),
    Math.round(it.box.cy),
    Math.round(it.box.w),
    Math.round(it.box.h),
    Math.round((it.box.a * 180) / Math.PI),
  ],
});
// (out of memory: WebAssembly's "Aborted()", a RangeError, or an allocation that failed; not a Stop's AbortError)
const memory = (e) =>
  /memory|Aborted\(|allocat|RangeError|bad_alloc/i.test(String((e && (e.message || e)) || ''));
const fail = (e) =>
  postMessage({ t: 'error', message: String((e && (e.message || e)) || 'error'), memory: memory(e) });
self.onmessage = async function (ev) {
  const m = ev.data || {};
  try {
    if (m.t === 'init') {
      const t0 = Date.now(),
        ort = await import(m.ort);
      ort.env.wasm.numThreads = 1;
      ort.env.wasm.wasmBinary = m.wasm;
      reader = await OCR2.create(
        ort,
        new Uint8Array(m.det),
        new Uint8Array(m.rec),
        m.dict,
        m.cls ? new Uint8Array(m.cls) : null,
      );
      postMessage({ t: 'ready', ms: Date.now() - t0 });
    } else if (m.t === 'read') {
      if (!reader) throw new Error('not ready');
      const ctl = new AbortController(),
        img = { width: m.img.width, height: m.img.height, data: new Uint8ClampedArray(m.img.data) };
      running = ctl;
      let lastP = 0;
      const r = await reader.read(img, Object.assign({}, m.o, { signal: ctl.signal }), {
        line: (it) => postMessage({ t: 'line', item: ser(it) }),
        progress: (p) => {
          // (at most ten a second)
          const now = Date.now();
          if (now - lastP < 100 && p.done !== p.total) return;
          lastP = now;
          postMessage({ t: 'progress', p: p });
        },
        // (which of the first look's readings hold a code, by the page's own reading of codes)
        codes: (items) =>
          new Promise((res) => {
            askCodes = res;
            postMessage({ t: 'codes', items: items.map((it) => [it.id, it.best ? it.best.text : '']) });
          }),
      });
      running = null;
      postMessage({ t: 'done', lines: r.lines.map(ser), stat: r.stat, ms: r.ms, aborted: r.aborted });
    } else if (m.t === 'codes') {
      if (askCodes) askCodes(new Set(m.ids || []));
      askCodes = null;
    } else if (m.t === 'stop') {
      if (running) running.abort();
      if (askCodes) askCodes(new Set());
      askCodes = null;
    }
  } catch (e) {
    running = null;
    fail(e);
  }
};
