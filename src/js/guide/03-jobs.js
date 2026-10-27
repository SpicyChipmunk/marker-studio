/* ---- work off the main thread (v307) ----
    A small worker made from this page's own code (a Blob: the app is one offline file, so there is no other file to
    load, and nothing goes through the service worker). It runs the same functions the page would (their source is
    copied in), so what comes back is what the page would have worked out itself:
      'pdf'   a PDF page's pixels packed to RGB and compressed (canvasesToPDF, 90-export)
      'png'   the saved image encoded (exportImage, 90-export)
      'lmap'  the section map encoded, ahead of a new guide's first save (lmapWarm, 60-persist)
      'lpts'  the label points and edge distances (labelPtsCore, 40-render)
      'seg'   a picture's ink, specks and sections, the steps up to the flood fill (segWork, 10-segment; v318.36)
      'pgf'   a photographed page's corners, from a small copy of the photo (pgWork, 22-straighten; v318.36)
      'ppage' a photo made into a colouring page (ppWork, 47-photo-page; v325)
      'ppfill' the markers that would help that page most (ppFillCore, 47-photo-page; v326)
      'tick'  a later photo of the page lined up with the guide's picture, then read (tickWork, 26-tick; v328)
    Anywhere there's no worker (an old browser, a page that can't make one) or a job fails, JOBS.run rejects and the
    caller does the work itself, as before. So does a job with no answer in time (jobBudget): the worker is then given
    up on for the session, and anything it sends later is ignored. */
const JOBS = (function () {
  let wk = null,
    bad = false,
    seq = 0,
    // (when the last job waiting is due: jobs are timed one after another, as each may wait on those ahead of it.
    // v318.37: and timed again as those ahead answer, retime: an answered job's budget no longer pads the ones
    // behind it, nor a later one's, so a worker that then hangs is given up on after the waiting jobs' own budgets,
    // not every budget ever posted: a Sensitivity drag posts a seg job a step, each superseded one answering at its
    // next step, and the last was due many budgets out)
    tail = 0,
    // (for the tests: a worker that never answers, its jobs given this long; v318.36: only jobs of one kind, hangK)
    hang = 0,
    hangK = '';
  const waits = new Map(),
    // (how many of each kind the worker did, failed and didn't answer in time: for the tests)
    stats = { done: {}, failed: {}, timedOut: {}, dropped: {} };
  // (runs in the worker)
  function main() {
    // (each job's own work starts as it comes in; what waits on the browser, compressing or encoding, overlaps the
    // next, so answers may come back in another order: each is matched to its job)
    self.onmessage = function (e) {
      const m = e.data;
      if (m.hang) return;
      work(m).then(
        function (r) {
          self.postMessage({ id: m.id, r: r.v }, r.t || []);
        },
        function (err) {
          self.postMessage({ id: m.id, err: String((err && err.message) || err) });
        },
      );
    };
    async function work(m) {
      if (m.k === 'pdf') {
        // (compressed only where the page could have: z)
        const raw = rgbPack(new Uint8Array(m.buf), m.n),
          zc = m.z ? await _flate(raw) : null,
          b = zc || raw;
        return { v: { zc: !!zc, b: b }, t: [b.buffer] };
      }
      if (m.k === 'png') return { v: await png(m) };
      // (as the data: URL the page's toDataURL gives)
      if (m.k === 'lmap') return { v: new self.FileReaderSync().readAsDataURL(await png(m)) };
      // (v318.36: the finder's steps, with the thread free between them: a newer picture's job takes over, and the
      // older answers 'superseded')
      if (m.k === 'seg') return segWork(m);
      // (v318.36: a photographed page's corners, from the small copy sent, 22-straighten)
      if (m.k === 'pgf') return pgWork(m);
      // (v325: a photo made into a colouring page, 47-photo-page)
      if (m.k === 'ppage') return ppWork(m);
      // (v326: the markers that would help a photo-made page most, 47-photo-page)
      if (m.k === 'ppfill') return { v: ppFillCore(m) };
      // (v328: Tick off from a photo, 26-tick)
      if (m.k === 'tick') return tickWork(m);
      if (m.k === 'lpts') {
        const r = labelPtsCore(new Int32Array(m.buf), m.W, m.H, m.K);
        return {
          v: r,
          t: [
            r.Q.buffer,
            r.sx.buffer,
            r.sy.buffer,
            r.ar.buffer,
            r.x0.buffer,
            r.y0.buffer,
            r.x1.buffer,
            r.y1.buffer,
          ],
        };
      }
      throw new Error('unknown job');
    }
    // a picture's pixels as a PNG file: only an opaque picture, whose pixels go in and out unchanged, each checked
    // against what was sent, before and after encoding (a picture lost on the way is encoded on the page instead)
    async function png(m) {
      const d = new Uint8ClampedArray(m.buf),
        w = m.w,
        h = m.h;
      for (let i = 3; i < d.length; i += 4) if (d[i] !== 255) throw new Error('not opaque');
      const oc = new OffscreenCanvas(w, h),
        g = oc.getContext('2d'),
        same = function () {
          const e = g.getImageData(0, 0, w, h).data;
          for (let i = 0; i < e.length; i++) if (e[i] !== d[i]) return false;
          return true;
        };
      g.putImageData(new ImageData(d, w, h), 0, 0);
      if (!same()) throw new Error('not drawn');
      const b = await oc.convertToBlob({ type: 'image/png' });
      if (!same()) throw new Error('not kept');
      oc.width = oc.height = 0;
      return b;
    }
  }
  function start() {
    if (wk || bad) return wk;
    try {
      const src =
        [rgbPack, _flate, labelPtsCore]
          .map(function (f) {
            return f.toString();
          })
          .join('\n') +
        // (v318.36: the section finder's steps and their state, 10-segment)
        '\n' +
        segWorkerSrc() +
        '\n' +
        pgWorkerSrc() +
        '\n' +
        // (v325: the photo-to-page builder's steps, 47-photo-page)
        ppWorkerSrc() +
        '\n' +
        // (v328: Tick off from a photo's lining up and reading, 26-tick)
        tickWorkerSrc() +
        '\n(' +
        main.toString() +
        ')();';
      wk = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
      wk.onmessage = function (e) {
        const m = e.data,
          w = waits.get(m.id);
        // (an answer after its job was given up on is ignored)
        if (!w) return;
        waits.delete(m.id);
        clearTimeout(w.t);
        retime(Date.now());
        // (v318.36: a section-finding job a newer one took over from is neither: dropped, as the page meant)
        const st = m.err === 'superseded' ? stats.dropped : m.err ? stats.failed : stats.done;
        st[w.k] = (st[w.k] || 0) + 1;
        // (v308: kept for Copy details; a picture that isn't opaque is expected, and done on the page)
        if (m.err && m.err !== 'not opaque' && m.err !== 'superseded')
          errLog('Worker', w.k + ' job failed (done on the page): ' + m.err);
        if (m.err) w.rej(new Error(m.err));
        else w.res(m.r);
      };
      // (the worker couldn't start, or broke: every job waiting is done on the page instead, and so are later ones)
      wk.onerror = function (e) {
        if (e && e.preventDefault) e.preventDefault();
        errLog('Worker', 'stopped (work done on the page): ' + ((e && e.message) || 'error'));
        stop();
      };
    } catch (e) {
      errLog('Worker', 'couldn’t start (work done on the page): ' + ((e && e.message) || e));
      stop();
    }
    return wk;
  }
  function stop() {
    bad = true;
    try {
      if (wk) wk.terminate();
    } catch (_) {}
    wk = null;
    waits.forEach(function (w) {
      clearTimeout(w.t);
      w.rej(new Error('no worker'));
    });
    waits.clear();
    tail = 0;
  }
  // a job that hasn’t answered when it’s due: the worker is taken to be stuck (a browser fault, or a job it never
  // finishes), so it’s stopped for the session and this job, and every other one waiting, is done on the
  // page. Not while the page is hidden, when the browser may pause the worker: it's given its time again
  function due(id, ms) {
    const w = waits.get(id);
    if (!w) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      w.t = setTimeout(function () {
        due(id, ms);
      }, ms);
      // (v318.37: due that much later, and so are the jobs behind it, retime)
      w.d = Date.now() + ms;
      if (w.d > tail) tail = w.d;
      return;
    }
    waits.delete(id);
    stats.timedOut[w.k] = (stats.timedOut[w.k] || 0) + 1;
    errLog('Worker', w.k + ' job gave no answer in ' + ms + ' ms (done on the page from now on)');
    w.rej(new Error('timed out'));
    stop();
  }
  // (v318.37) a job answered or given up on: the jobs still waiting, in the order they were posted, are due one after
  // another from now (each from the later of its own posting and the one ahead of it being due, plus its budget), and
  // never later than they were: the budget of a job that answered early no longer holds up the timing of those
  // behind it. tail follows the last of them
  function retime(now) {
    let prev = now;
    tail = 0;
    waits.forEach(function (w, id) {
      const d = Math.max(w.at, prev) + w.ms;
      if (d < w.d) {
        w.d = d;
        clearTimeout(w.t);
        w.t = setTimeout(function () {
          due(id, w.ms);
        }, d - now);
      }
      prev = tail = w.d;
    });
  }
  // a job: resolves to what it gives back, or rejects (no worker, or the job failed) so the caller does it itself.
  // tr: what's handed over rather than copied (buffers, a picture)
  function run(k, data, tr) {
    const w = start();
    if (!w) return Promise.reject(new Error('no worker'));
    return new Promise(function (res, rej) {
      const id = ++seq,
        hg = hang && (!hangK || hangK === k) ? hang : 0,
        ms = hg || jobBudget(data, k),
        now = Date.now(),
        // (v318.37: when it was posted, its budget and when it's due, for retime)
        e0 = { res: res, rej: rej, k: k, t: 0, at: now, ms: ms, d: 0 };
      waits.set(id, e0);
      try {
        w.postMessage(Object.assign({ id: id, k: k }, data, hg ? { hang: true } : null), tr || []);
      } catch (e) {
        waits.delete(id);
        if (!waits.size) tail = 0;
        rej(e);
        return;
      }
      tail = Math.max(now, tail) + ms;
      e0.d = tail;
      e0.t = setTimeout(function () {
        due(id, ms);
      }, tail - now);
    });
  }
  return {
    run: run,
    stats: stats,
    budget: jobBudget,
    // (for the tests: as if there were no worker; off(false) back again)
    off: function (v) {
      if (v === false) bad = false;
      else stop();
    },
    // (for the tests: from now on the worker answers nothing, and each job is given ms; hang(0) as before. v318.36:
    // hang(ms, k), only jobs of kind k)
    hang: function (ms, k) {
      hang = ms > 0 ? ms : 0;
      hangK = (hang && k) || '';
    },
    get on() {
      return !bad && typeof Worker !== 'undefined';
    },
  };
})();
// How long a job may go unanswered before the worker is given up on (03-jobs): 4 s, and half a second more for each
// million pixels it's about (a PDF page, 1700 × 2200, about 6 s). In Safari's engine the worker takes well under a
// second per job (a page packed and compressed, the saved image encoded, a guide's label points), so this leaves a slow
// iPad several times what it needs; one that's slower still loses nothing but the worker, as the page then does the
// work itself, as it did before v307.
// (v318.36) A picture's sections (k 'seg'): 4 s and 2 s more for each million pixels (a 2400 × 2400 photo, 15.5 s): the
// steps take an iPad a second or two there, and a run superseded by a newer one answers at its next step
// (v325) A photo made into a page (k 'ppage'): 8 s and 2 s for each million pixels of the guide's size (a 2000 × 1500 page,
// 14 s), several times what a computer takes (about 1.5 s there)
function jobBudget(data, k) {
  if (k === 'ppage') return 8000 + Math.round((data.GW * data.GH) / 500);
  // (v328: Tick off from a photo, lining up or reading: about 2 and 4 s on a desktop for the author's 3.8-megapixel
  // guide, more on an iPad)
  if (k === 'tick') return 15000 + Math.round((data.W * data.H) / 150);
  // (v328 review: the markers to add, with Use up to 48's two marker choices: the photo's colours by the markers it
  // may use, 2-4 s on a desktop for 461 colours by 392-800 markers)
  if (k === 'ppfill' && data.tw && data.pl)
    return 4000 + Math.round((data.tw.length * (data.pl.length / 3) * (data.mcap ? 1 : 0.1)) / 25);
  const px = data.n || data.w * data.h || data.W * data.H || 0;
  return 4000 + Math.round(px / (k === 'seg' ? 500 : 2000));
}
// the RGB bytes of RGBA pixels (a PDF page's image; read through a Uint8Array view, about twice as fast in Safari's
// engine as the clamped array getImageData gives, and the same bytes)
function rgbPack(px, n) {
  const d = new Uint8Array(px.buffer, px.byteOffset, n * 4),
    o = new Uint8Array(n * 3);
  for (let i = 0, j = 0, e = n * 4; i < e; i += 4, j += 3) {
    o[j] = d[i];
    o[j + 1] = d[i + 1];
    o[j + 2] = d[i + 2];
  }
  return o;
}

// fn once the screen has been drawn: after the next frame. A status ("Detecting sections…", "Building…") set just before
// work that holds the page for a while only shows if the work waits for this: a frame's own callback runs before that
// frame is drawn (v318 polish). A page in the background draws no frames: there it goes on at once, and a second at
// most where frames stop otherwise (a busy machine can take a few hundred ms to draw the next one)
function afterPaint(fn) {
  let done = false;
  const go = function () {
    if (!done) {
      done = true;
      fn();
    }
  };
  if (document.hidden) {
    setTimeout(go, 0);
    return;
  }
  requestAnimationFrame(function () {
    setTimeout(go, 0);
  });
  setTimeout(go, 1000);
}
