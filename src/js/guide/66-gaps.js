/* ---- Possible gaps in the pen lines (v329) ----
    After the sections are found, a check for places where a line stops just short: of another line (a gap inside the
    drawing) or of the paper's edge (a line that doesn't quite reach it). Where a short stroke there would split one
    section into two good-sized parts, it's offered as a suggestion; nothing is changed until the person closes it.
    The check runs in a worker of its own, made for it and ended after it (it can take seconds on a big photo, and the
    shared one, JOBS, would hold up the codes and the first save meanwhile): no worker, no suggestions. Its result is
    kept only while the picture, its section map and its edits are those it was worked out for (gapKey).
    gapFind is copied into the worker as it stands: everything it uses is inside it. */
function gapFind(L, W, H, minPart) {
  const n = W * H;
  // ink (1), and its skeleton, a line one pixel wide down its middle (Zhang-Suen)
  const M = new Uint8Array(n);
  for (let i = 0; i < n; i++) M[i] = L[i] < 0 ? 1 : 0;
  const Sk = Uint8Array.from(M);
  {
    // (v329 CI: only the pixels that can change are looked at, each sub-pass: those at the ink's edge to begin with, then
    // the neighbours of each pixel taken off. A pixel's answer for a sub-pass changes only when a neighbour does, so the
    // skeleton is the same as looking at every pixel each time, which took 15 s on a picture whose dark side was read
    // as ink, a wide patch thinned a pixel a pass. need: bit 1, to look at in the first sub-pass; bit 2, the second)
    const need = new Uint8Array(n),
      Q = [[], []],
      del = [];
    const mark = function (j) {
      if (!(need[j] & 1)) {
        need[j] |= 1;
        Q[0].push(j);
      }
      if (!(need[j] & 2)) {
        need[j] |= 2;
        Q[1].push(j);
      }
    };
    for (let y = 1; y < H - 1; y++)
      for (let x = 1; x < W - 1; x++) {
        const i = y * W + x;
        if (
          Sk[i] &&
          !(
            Sk[i - W] &&
            Sk[i - W + 1] &&
            Sk[i + 1] &&
            Sk[i + W + 1] &&
            Sk[i + W] &&
            Sk[i + W - 1] &&
            Sk[i - 1] &&
            Sk[i - W - 1]
          )
        )
          mark(i);
      }
    let changed = true;
    while (changed) {
      changed = false;
      for (let pass = 0; pass < 2; pass++) {
        const bit = pass + 1,
          q = Q[pass];
        Q[pass] = [];
        del.length = 0;
        for (let k = 0; k < q.length; k++) {
          const i = q[k];
          if (!(need[i] & bit)) continue;
          need[i] &= ~bit;
          if (!Sk[i]) continue;
          const p2 = Sk[i - W],
            p3 = Sk[i - W + 1],
            p4 = Sk[i + 1],
            p5 = Sk[i + W + 1],
            p6 = Sk[i + W],
            p7 = Sk[i + W - 1],
            p8 = Sk[i - 1],
            p9 = Sk[i - W - 1];
          const b = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
          if (b < 2 || b > 6) continue;
          const a =
            (!p2 && p3) +
            (!p3 && p4) +
            (!p4 && p5) +
            (!p5 && p6) +
            (!p6 && p7) +
            (!p7 && p8) +
            (!p8 && p9) +
            (!p9 && p2);
          if (a !== 1) continue;
          if (pass === 0 ? p2 * p4 * p6 || p4 * p6 * p8 : p2 * p4 * p8 || p2 * p6 * p8) continue;
          del.push(i);
        }
        if (del.length) changed = true;
        for (let k = 0; k < del.length; k++) Sk[del[k]] = 0;
        for (let k = 0; k < del.length; k++) {
          const i = del[k],
            x = i % W,
            y = (i / W) | 0;
          for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++) {
              const xx = x + dx,
                yy = y + dy;
              if (xx < 1 || yy < 1 || xx >= W - 1 || yy >= H - 1) continue;
              const j = yy * W + xx;
              if (Sk[j]) mark(j);
            }
        }
      }
    }
  }
  // the line's width: twice the median distance from the skeleton to the paper (runs across the ink are fooled by a
  // coloured page)
  let lw = 3;
  {
    const D = new Uint16Array(n);
    for (let i = 0; i < n; i++) D[i] = M[i] ? 9999 : 0;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (!D[i]) continue;
        let v = D[i];
        if (x) v = Math.min(v, D[i - 1] + 1);
        if (y) v = Math.min(v, D[i - W] + 1);
        D[i] = v;
      }
    for (let y = H - 1; y >= 0; y--)
      for (let x = W - 1; x >= 0; x--) {
        const i = y * W + x;
        if (!D[i]) continue;
        let v = D[i];
        if (x < W - 1) v = Math.min(v, D[i + 1] + 1);
        if (y < H - 1) v = Math.min(v, D[i + W] + 1);
        D[i] = v;
      }
    const ds = [];
    for (let i = 0; i < n; i += 3) if (Sk[i]) ds.push(D[i]);
    ds.sort(function (a, b) {
      return a - b;
    });
    if (ds.length) lw = Math.max(1, 2 * ds[(ds.length / 2) | 0] - 1);
  }
  // how far a line may stop short: of other ink inside the drawing (gmax), of the dark beyond the paper (emax), of the
  // picture's own edge, for a page cropped to the paper or a scan (bmax)
  const gmax = Math.max(6, Math.round(lw * 3)),
    emax = Math.max(gmax, Math.round(lw * 6)),
    bmax = Math.max(6, 2 * lw);
  // the dark beyond the paper: ink joined to the picture's border and at least 0.5% of it. C, its pieces' ids, is
  // used again below as the floods' stamps
  const OUT = new Uint8Array(n),
    C = new Int32Array(n);
  {
    const st = new Int32Array(n),
      sizes = [0],
      touches = [0];
    let cid = 0;
    for (let s0 = 0; s0 < n; s0++) {
      if (!M[s0] || C[s0]) continue;
      cid++;
      let size = 0,
        touch = false,
        sp = 0;
      st[sp++] = s0;
      C[s0] = cid;
      while (sp) {
        const q = st[--sp],
          qx = q % W,
          qy = (q / W) | 0;
        size++;
        if (qx === 0 || qy === 0 || qx === W - 1 || qy === H - 1) touch = true;
        if (qy > 0 && M[q - W] && !C[q - W]) {
          C[q - W] = cid;
          st[sp++] = q - W;
        }
        if (qy < H - 1 && M[q + W] && !C[q + W]) {
          C[q + W] = cid;
          st[sp++] = q + W;
        }
        if (qx > 0 && M[q - 1] && !C[q - 1]) {
          C[q - 1] = cid;
          st[sp++] = q - 1;
        }
        if (qx < W - 1 && M[q + 1] && !C[q + 1]) {
          C[q + 1] = cid;
          st[sp++] = q + 1;
        }
      }
      sizes.push(size);
      touches.push(touch ? 1 : 0);
    }
    const lim = n * 0.005;
    for (let i = 0; i < n; i++) {
      const c = C[i];
      if (c && touches[c] && sizes[c] > lim) OUT[i] = 1;
    }
  }
  // each line's end: a skeleton pixel with one neighbour, not within 3 px of the picture's edge
  const nb8 = [-W - 1, -W, -W + 1, -1, 1, W - 1, W, W + 1],
    back = Math.max(6, Math.round(lw * 3)),
    cands = [];
  // (the skeleton's one next pixel from cur, not prev: -1 at a junction or an end; cnt the count)
  let cnt = 0;
  const step = function (prev, cur) {
    let next = -1;
    cnt = 0;
    for (let k = 0; k < 8; k++) {
      const j = cur + nb8[k];
      if (j !== prev && Sk[j] && Math.abs((j % W) - (cur % W)) <= 1) {
        cnt++;
        next = j;
      }
    }
    return next;
  };
  for (let y = 3; y < H - 3; y++)
    for (let x = 3; x < W - 3; x++) {
      const i = y * W + x;
      if (!Sk[i]) continue;
      let c = 0,
        nx = -1;
      for (let k = 0; k < 8; k++)
        if (Sk[i + nb8[k]]) {
          c++;
          nx = i + nb8[k];
        }
      if (c !== 1) continue;
      // back along the skeleton, for the line's direction (a junction close by: only if the end's arm is long enough)
      let prev = i,
        cur = nx,
        steps = 1,
        ok = true;
      while (steps < back) {
        const nxt = step(prev, cur);
        if (cnt !== 1) {
          ok = cnt > 1 && steps >= lw * 1.5;
          break;
        }
        prev = cur;
        cur = nxt;
        steps++;
      }
      if (!ok) continue;
      let dx = x - (cur % W),
        dy = y - ((cur / W) | 0);
      const dl = Math.hypot(dx, dy);
      if (dl < 2) continue;
      dx /= dl;
      dy /= dl;
      // rays in a narrow cone ahead: out of this ink, across paper, into other ink (or off the picture)
      let best = null;
      const angs = [0, -0.2, 0.2, -0.4, 0.4];
      for (let a = 0; a < angs.length; a++) {
        const cs = Math.cos(angs[a]),
          sn = Math.sin(angs[a]),
          ux = dx * cs - dy * sn,
          uy = dx * sn + dy * cs;
        let t = 0,
          inInk = true,
          start = null,
          hit = null;
        while (t < emax + lw * 2 + 2) {
          t += 0.5;
          const px = Math.round(x + ux * t),
            py = Math.round(y + uy * t);
          if (px < 0 || py < 0 || px >= W || py >= H) {
            if (start && !inInk)
              hit = [Math.min(W - 1, Math.max(0, px)), Math.min(H - 1, Math.max(0, py)), t, 1];
            break;
          }
          const v = L[py * W + px];
          if (inInk) {
            if (v >= 0) {
              inInk = false;
              start = [px, py, t];
              if (v === 0) break;
            }
          } else if (v < 0) {
            hit = [px, py, t, 0];
            break;
          } else if (v === 0) break;
          if (start && t - start[2] > emax) break;
        }
        if (!(start && hit)) continue;
        const gap = hit[2] - start[2],
          edge = !!hit[3] || !!OUT[hit[1] * W + hit[0]];
        if (gap > 0.5 && gap <= (hit[3] ? bmax : edge ? emax : gmax) && (!best || gap < best.gap))
          best = { x0: start[0], y0: start[1], x1: hit[0], y1: hit[1], gap: gap, edge: edge };
      }
      if (best) cands.push(best);
    }
  // one per place, the narrowest
  cands.sort(function (a, b) {
    return a.gap - b.gap;
  });
  const out = [];
  for (let k = 0; k < cands.length; k++) {
    const c = cands[k],
      mx = (c.x0 + c.x1) / 2,
      my = (c.y0 + c.y1) / 2;
    if (
      !out.some(function (d) {
        return Math.hypot((d.x0 + d.x1) / 2 - mx, (d.y0 + d.y1) / 2 - my) < lw * 3 + 4;
      })
    )
      out.push(c);
  }
  // the stroke must cut one section into two parts, each at least 10 line widths across and the smaller at least
  // minPart pixels and 3% of the section. Its sides are flooded a step at a time: a side that runs dry is a part of its
  // own, sized; sides meeting are one; when one side is left, it's the rest
  const res = [],
    R = Math.max(1, Math.round(lw / 2)),
    secSize = new Map(),
    stamp = C.fill(0);
  for (let i = 0; i < n; i++) if (L[i] > 0) secSize.set(L[i], (secSize.get(L[i]) || 0) + 1);
  let stampN = 0;
  for (let k = 0; k < out.length; k++) {
    const c = out[k],
      secs = new Map(),
      bridge = new Set();
    // (inside the drawing, only a gap narrower than the line: a vein's end or a letter's opening is wider)
    if (!c.edge && c.gap > 0.9 * lw) continue;
    let off = false;
    const len = Math.max(1, Math.ceil(Math.hypot(c.x1 - c.x0, c.y1 - c.y0) * 2));
    for (let s = 0; s <= len; s++) {
      const px = Math.round(c.x0 + ((c.x1 - c.x0) * s) / len),
        py = Math.round(c.y0 + ((c.y1 - c.y0) * s) / len);
      for (let oy = -R; oy <= R; oy++)
        for (let ox = -R; ox <= R; ox++) {
          if (ox * ox + oy * oy > R * R + 1) continue;
          const qx = px + ox,
            qy = py + oy;
          if (qx < 0 || qy < 0 || qx >= W || qy >= H) continue;
          const q = qy * W + qx;
          if (L[q] > 0) {
            bridge.add(q);
            secs.set(L[q], (secs.get(L[q]) || 0) + 1);
          } else if (L[q] === 0) off = true;
        }
    }
    if (secs.size !== 1 || off) continue;
    const sec = secs.keys().next().value,
      sides = [];
    bridge.forEach(function (q) {
      const ds = [-W, W, -1, 1];
      for (let d = 0; d < 4; d++) {
        const r = q + ds[d];
        if (r >= 0 && r < n && L[r] === sec && !bridge.has(r)) sides.push(r);
      }
    });
    const base = stampN,
      qs = [],
      sz = [];
    for (let s = 0; s < sides.length; s++) {
      const s0 = sides[s];
      if (stamp[s0] > base) continue;
      stamp[s0] = base + 1 + qs.length;
      qs.push([s0]);
      sz.push(0);
    }
    const par = qs.map(function (_, i) {
        return i;
      }),
      find = function (i) {
        while (par[i] !== i) i = par[i] = par[par[i]];
        return i;
      },
      dried = [],
      isDry = new Uint8Array(qs.length);
    let one = false;
    for (;;) {
      let live = 0,
        moved = false;
      for (let j = 0; j < qs.length; j++) if (!isDry[j] && find(j) === j) live++;
      if (live <= 1) {
        one = dried.length === 0;
        break;
      }
      for (let j = 0; j < qs.length; j++) {
        const Q = qs[j];
        if (!Q.length) continue;
        moved = true;
        for (let st = 0; st < 256 && Q.length; st++) {
          const q = Q.pop(),
            qx = q % W;
          sz[j]++;
          const ds = [-W, W, -1, 1];
          for (let d = 0; d < 4; d++) {
            if ((d === 2 && qx === 0) || (d === 3 && qx === W - 1)) continue;
            const r = q + ds[d];
            if (r < 0 || r >= n || bridge.has(r) || L[r] !== sec) continue;
            if (stamp[r] > base) {
              const a2 = find(stamp[r] - base - 1),
                b2 = find(j);
              if (a2 !== b2) par[a2] = b2;
              continue;
            }
            stamp[r] = base + 1 + j;
            Q.push(r);
          }
        }
      }
      for (let j = 0; j < qs.length; j++) {
        const g0 = find(j);
        if (g0 !== j || isDry[j]) continue;
        let dry = true,
          gs = 0;
        for (let h = 0; h < qs.length; h++)
          if (find(h) === g0) {
            if (qs[h].length) dry = false;
            gs += sz[h];
          }
        if (dry) {
          isDry[j] = 1;
          dried.push(gs);
        }
      }
      if (!moved) break;
    }
    stampN = base + qs.length + 1;
    if (one || !dried.length) continue;
    const total = secSize.get(sec) - bridge.size,
      parts = dried.slice(),
      rest =
        total -
        parts.reduce(function (a, b) {
          return a + b;
        }, 0);
    if (rest > 0) parts.push(rest);
    if (parts.length < 2) continue;
    parts.sort(function (a, b) {
      return b - a;
    });
    const s1 = parts[1];
    if (s1 < minPart || s1 < total * 0.03 || Math.sqrt(s1) < 10 * lw) continue;
    res.push({
      x0: c.x0,
      y0: c.y0,
      x1: c.x1,
      y1: c.y1,
      gap: c.gap,
      edge: c.edge,
      sec: sec,
      parts: [parts[0], s1],
    });
  }
  return { res: res, lw: lw };
}

// ---- the check, in its own worker ----
// _gapR: the latest result, { k: its key, res, lw }; _gapRun: the check under way, { k, wk, t }. Dismissed suggestions
// (_gapDis: where they were, in picture pixels) stay dismissed for the picture, through edits and checks again
let _gapR = null,
  _gapRun = null,
  _gapT = 0,
  _gapDis = [],
  _gapDisG = -1,
  // (how many checks were started and finished: for the tests)
  _gapN = { started: 0, done: 0 };
// (no answer in this long: given up, no suggestions; a 12-megapixel photo takes about 5 s on a computer)
const GAP_BUDGET = 90000;
// what a result is for: the picture (loadGen), its section map (the array, replaced when the sections are found
// again), the edits made to it (secEdN) and its size
function gapKey() {
  return { g: loadGen, l: labels, e: secEdN, W: W, H: H };
}
function gapSame(a, b) {
  return !!a && !!b && a.g === b.g && a.l === b.l && a.e === b.e && a.W === b.W && a.H === b.H;
}
// the suggestions for the sections as they are now, less those dismissed: [] while none are known
function gapList() {
  if (!_gapR || !gapSame(_gapR.k, gapKey())) return [];
  if (_gapDisG !== loadGen) {
    _gapDis = [];
    _gapDisG = loadGen;
  }
  const near = Math.max(8, _gapR.lw * 3);
  return _gapR.res.filter(function (s) {
    const mx = (s.x0 + s.x1) / 2,
      my = (s.y0 + s.y1) / 2;
    return !_gapDis.some(function (d) {
      return Math.hypot(d[0] - mx, d[1] - my) < near;
    });
  });
}
function gapDismiss(s) {
  if (_gapDisG !== loadGen) {
    _gapDis = [];
    _gapDisG = loadGen;
  }
  _gapDis.push([(s.x0 + s.x1) / 2, (s.y0 + s.y1) / 2]);
}
function gapStop() {
  clearTimeout(_gapT);
  _gapT = 0;
  if (!_gapRun) return;
  clearTimeout(_gapRun.t);
  try {
    _gapRun.wk.terminate();
  } catch (_) {}
  URL.revokeObjectURL(_gapRun.url);
  _gapRun = null;
}
// Called where the sections are shown to be checked (the quick step, Edit sections): the check started for them if
// it hasn't been, and isn't under way. Not for a photo made into a page (its lines are the borders between its
// regions, not pen lines), nor while sections are being found
function gapWant() {
  if (!labels || !W || !H || segBusy || ppOn()) return;
  const k = gapKey();
  if ((_gapR && gapSame(_gapR.k, k)) || (_gapRun && gapSame(_gapRun.k, k))) return;
  gapStop();
  if (typeof Worker !== 'function' || typeof Blob !== 'function' || typeof URL === 'undefined') return;
  let wk = null,
    url = null;
  try {
    url = URL.createObjectURL(
      new Blob(
        [
          gapFind.toString() +
            '\nself.onmessage = function (e) { const m = e.data; self.postMessage(gapFind(new Int32Array(m.buf), m.W, m.H, m.mp)); };',
        ],
        { type: 'text/javascript' },
      ),
    );
    wk = new Worker(url);
  } catch (e) {
    if (url) URL.revokeObjectURL(url);
    return;
  }
  const run = { k: k, wk: wk, t: 0, url: url },
    end = function () {
      if (_gapRun !== run) return;
      clearTimeout(run.t);
      try {
        wk.terminate();
      } catch (_) {}
      // (the worker's source let go once it's done with: not before, as it may still be loading)
      URL.revokeObjectURL(url);
      _gapRun = null;
    };
  _gapRun = run;
  _gapN.started++;
  run.t = setTimeout(end, GAP_BUDGET);
  wk.onmessage = function (e) {
    if (_gapRun !== run) return;
    end();
    _gapN.done++;
    // (kept only if nothing changed meanwhile)
    if (!gapSame(k, gapKey())) return;
    _gapR = { k: k, res: (e.data && e.data.res) || [], lw: (e.data && e.data.lw) || 3 };
    gapShown();
  };
  wk.onerror = function (e) {
    if (e && e.preventDefault) e.preventDefault();
    end();
  };
  const buf = labels.slice().buffer;
  try {
    wk.postMessage({ buf: buf, W: W, H: H, mp: Math.max(4 * minPx(), 120) }, [buf]);
  } catch (e) {
    end();
  }
}
// the sections were edited (labelsEdited): a check under way is of the map as it was; checked again once the edits
// stop for a moment, if the sections are still being looked at
function gapEdited() {
  gapStop();
  _gapT = setTimeout(function () {
    _gapT = 0;
    if (sfmode === 'review') gapWant();
  }, 800);
}

// ---- shown: a line on the quick step (Review) and in Edit sections (Show); then each gap marked on the picture ----
// _gapShow: the one shown (its place in gapList), -1 when they aren't; _gapSaid: the result last said aloud
let _gapShow = -1,
  _gapSaid = null;
// a new picture: no check under way for the old one, none shown
function gapReset() {
  gapStop();
  _gapShow = -1;
}
// a result has come in: its line, and said once (politely, the keyboard left where it is)
function gapShown() {
  if (sfmode !== 'review') return;
  gapLineSync();
  const n = gapList().length;
  if (n && _gapSaid !== _gapR) {
    _gapSaid = _gapR;
    // (not over what was said just before, the step's own "Looks right? We found…": a result that came in quickly
    // took its place half-said, or had its own taken; said a moment after it instead)
    const r = _gapR,
      say = function () {
        const m = gapList().length;
        if (sfmode !== 'review' || _gapR !== r || !m) return;
        sayLive(
          m +
            ' possible gap' +
            (m === 1 ? '' : 's') +
            ' in the lines, where a section may be two. ' +
            (document.getElementById('sfQuick') ? 'Review to see them.' : 'Show to see them.'),
        );
      },
      wait = (sayLive.at || 0) + 1500 - Date.now();
    if (wait > 0) setTimeout(say, wait);
    else say();
  }
}
// the line, as things are (#sfGapLine, in ctlSections: the quick step's or Edit sections'); the keyboard kept on the
// same choice when it's drawn again
function gapLineSync() {
  const el = document.getElementById('sfGapLine');
  if (!el) return;
  const L = gapList(),
    n = L.length,
    quick = !!el.closest('#sfQuick');
  if (_gapShow >= n) _gapShow = n - 1;
  if (quick) _gapShow = -1;
  const had = el.contains(document.activeElement) ? document.activeElement.getAttribute('data-gap') : null;
  el.hidden = !n;
  if (!n) {
    el.innerHTML = '';
    return;
  }
  const b = function (a, t, cls) {
    return '<button type="button" class="' + (cls || 'sfghost') + '" data-gap="' + a + '">' + t + '</button>';
  };
  el.innerHTML =
    _gapShow < 0
      ? '<b>' +
        n +
        ' possible gap' +
        (n === 1 ? '' : 's') +
        '</b> in the lines, where a section may be two \u00b7 ' +
        b(quick ? 'review' : 'show', quick ? 'Review' : 'Show', 'sflink')
      : '<b>Gap ' +
        (_gapShow + 1) +
        ' of ' +
        n +
        '</b>: a line stops just short here. Close it to make two sections.<div class="sfgapbtns">' +
        b('close', 'Close', 'btn-primary') +
        b('dismiss', 'Dismiss') +
        (n > 1 ? b('next', 'Next') + b('all', 'Close all') : '') +
        '</div>';
  if (had) {
    const f = el.querySelector('[data-gap="' + had + '"]') || el.querySelector('[data-gap]');
    try {
      if (f) f.focus({ preventScroll: true });
    } catch (_) {}
  }
}
// gap i shown: the picture zoomed to it (at least ×4), every gap marked
function gapGo(i) {
  const L = gapList();
  if (!L.length) {
    _gapShow = -1;
    gapLineSync();
    return;
  }
  _gapShow = ((i % L.length) + L.length) % L.length;
  const s = L[_gapShow];
  centerOn((s.x0 + s.x1) / 2, (s.y0 + s.y1) / 2, Math.max(zoom, 4));
  render();
  gapLineSync();
  sayLive('Gap ' + (_gapShow + 1) + ' of ' + L.length + '.');
}
// the sections drawn in Edit sections or the quick step (render, 10-segment): the gaps marked; and if the map has
// changed since the check (an Undo, a Redo, an edit), its line put away and the check made again once things settle
function gapRendered() {
  if (sfmode !== 'review') return;
  gapDraw();
  if (_gapR && gapSame(_gapR.k, gapKey())) return;
  if (_gapRun && gapSame(_gapRun.k, gapKey())) return;
  const el = document.getElementById('sfGapLine');
  if (el && !el.hidden) gapLineSync();
  if (!_gapT) gapEdited();
}
// the gaps marked on the picture (render, 10-segment): a dashed stroke where each would be closed, the one shown
// ringed
function gapDraw() {
  if (_gapShow < 0 || sfmode !== 'review' || !ctx) return;
  const L = gapList();
  if (!L.length) return;
  const lw = Math.max(3, _gapR.lw),
    r = Math.max(16, lw * 5);
  ctx.save();
  ctx.lineCap = 'round';
  L.forEach(function (s, i) {
    const on = i === _gapShow;
    ctx.strokeStyle = on ? '#d1361f' : '#e08a1e';
    ctx.lineWidth = lw;
    ctx.setLineDash([lw * 1.2, lw]);
    ctx.beginPath();
    ctx.moveTo(s.x0, s.y0);
    ctx.lineTo(s.x1, s.y1);
    ctx.stroke();
    if (on) {
      ctx.setLineDash([]);
      ctx.lineWidth = Math.max(2, lw * 0.6);
      ctx.beginPath();
      ctx.arc((s.x0 + s.x1) / 2, (s.y0 + s.y1) / 2, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  });
  ctx.restore();
}
// a gap closed in the map: a stroke as thick as the pen's line (at least Split's) from just inside the ink at one end
// to just inside it at the other, through the section it's in. Returns 1 if it made two sections; if not, the map is
// as it was
function gapCut(s) {
  const lw = _gapR ? _gapR.lw : 3,
    rad = Math.max(cutRad(), Math.round(lw / 2)),
    dx = s.x1 - s.x0,
    dy = s.y1 - s.y0,
    dl = Math.hypot(dx, dy) || 1,
    ux = dx / dl,
    uy = dy / dl,
    ax = s.x0 - ux * rad,
    ay = s.y0 - uy * rad,
    bx = s.x1 + ux * rad,
    by = s.y1 + uy * rad;
  // (the section it's in now: the one most of the stroke crosses, as a gap closed before may have renumbered it)
  const tally = new Map(),
    steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay)));
  for (let k = 0; k <= steps; k++) {
    const x = Math.round(ax + ((bx - ax) * k) / steps),
      y = Math.round(ay + ((by - ay) * k) / steps);
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    const v = labels[y * W + x];
    if (v > 0) tally.set(v, (tally.get(v) || 0) + 1);
  }
  let sec = 0,
    best = 0;
  tally.forEach(function (c, v) {
    if (c > best) {
      best = c;
      sec = v;
    }
  });
  if (!sec || ppBgSec(sec)) return 0;
  labelsEdited();
  const done = [];
  for (let k = 0; k <= steps; k++) {
    const cx = Math.round(ax + ((bx - ax) * k) / steps),
      cy = Math.round(ay + ((by - ay) * k) / steps);
    for (let oy = -rad; oy <= rad; oy++)
      for (let ox = -rad; ox <= rad; ox++) {
        if (ox * ox + oy * oy > rad * rad + 1) continue;
        const x = cx + ox,
          y = cy + oy;
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const q = y * W + x;
        if (labels[q] === sec) {
          labels[q] = -1;
          done.push(q);
        }
      }
  }
  if (relabelRegion(sec) >= 1) return 1;
  for (let k = 0; k < done.length; k++) labels[done[k]] = sec;
  labelsEdited();
  return 0;
}
// Close (one gap) or Close all: one Undo step either way. The suggestions left are kept for the map as it now is, so
// the check isn't made again for them
function gapClose(all) {
  const L = gapList();
  if (!L.length || segBusy) return;
  const which = all ? L : [L[Math.max(0, _gapShow)]],
    res = _gapR.res;
  snapshotSeg();
  let made = 0;
  which.forEach(function (s) {
    if (gapCut(s)) {
      made++;
      res.splice(res.indexOf(s), 1);
    } else gapDismiss(s);
  });
  if (!made) {
    restoreSnap();
    note('That gap didn\u2019t divide the section.');
  } else hasEdits = true;
  // (its result, less what was closed, for the map now: no new check)
  gapStop();
  _gapR.k = gapKey();
  if (all || !gapList().length) _gapShow = -1;
  _secSayNext = made > 1 ? made + ' gaps closed: ' : made ? 'Gap closed: ' : '';
  render();
  updateUndoUI();
  gapLineSync();
  if (_gapShow >= 0) gapGo(_gapShow);
}
document.addEventListener('click', function (e) {
  const b = e.target && e.target.closest ? e.target.closest('#sfGapLine [data-gap]') : null;
  if (!b || sfmode !== 'review') return;
  const a = b.getAttribute('data-gap');
  if (a === 'review') {
    // (Edit sections opened, with the gaps shown)
    secFix();
    gapGo(0);
    const f = document.querySelector('#sfGapLine [data-gap="close"]');
    try {
      if (f) f.focus({ preventScroll: true });
    } catch (_) {}
  } else if (a === 'show') gapGo(0);
  else if (a === 'next') gapGo(_gapShow + 1);
  else if (a === 'dismiss') {
    const L = gapList();
    if (L[_gapShow]) gapDismiss(L[_gapShow]);
    if (gapList().length) gapGo(_gapShow);
    else {
      _gapShow = -1;
      render();
      gapLineSync();
    }
  } else if (a === 'close') gapClose(false);
  else if (a === 'all') gapClose(true);
});
