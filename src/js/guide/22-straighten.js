/* ---- page straightening: find a photographed page's four corners and flatten it ---- */
// 3x3 homography taking four src points to four dst points
function pgHomog(src, dst) {
  const A = [],
    b = [];
  for (let i = 0; i < 4; i++) {
    const x = src[i][0],
      y = src[i][1],
      u = dst[i][0],
      v = dst[i][1];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }
  for (let c = 0; c < 8; c++) {
    let p = c;
    for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    let t = A[c];
    A[c] = A[p];
    A[p] = t;
    t = b[c];
    b[c] = b[p];
    b[p] = t;
    if (Math.abs(A[c][c]) < 1e-12) return null;
    for (let r = 0; r < 8; r++) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      if (!f) continue;
      for (let k = c; k < 8; k++) A[r][k] -= f * A[c][k];
      b[r] -= f * b[c];
    }
  }
  const h = b.map(function (v, i) {
    return v / A[i][i];
  });
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
}
const _cr = function (o, a, b) {
  return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
};
function pgArea(q) {
  return Math.abs(_cr(q[0], q[1], q[2])) / 2 + Math.abs(_cr(q[0], q[2], q[3])) / 2;
}
// corners in reading order: top-left, top-right, bottom-right, bottom-left
// (the side chosen as the top is the one nearest level, so the page comes out turned as little as possible)
function pgOrder(q) {
  const cx = (q[0][0] + q[1][0] + q[2][0] + q[3][0]) / 4,
    cy = (q[0][1] + q[1][1] + q[2][1] + q[3][1]) / 4,
    s = q.slice().sort(function (a, b) {
      return Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx);
    });
  let tl = 0,
    ba = 9;
  for (let i = 0; i < 4; i++) {
    const p = s[i],
      n = s[(i + 1) % 4],
      an = Math.abs(Math.atan2(n[1] - p[1], n[0] - p[0]));
    if (an < ba - 1e-9) {
      ba = an;
      tl = i;
    }
  }
  return [0, 1, 2, 3].map(function (i) {
    return s[(tl + i) % 4].slice();
  });
}
function pgConvex(q) {
  let sg = 0;
  for (let i = 0; i < 4; i++) {
    const c = _cr(q[i], q[(i + 1) % 4], q[(i + 2) % 4]);
    if (!c) return false;
    if (!sg) sg = Math.sign(c);
    else if (Math.sign(c) !== sg) return false;
  }
  return true;
}
function pgAngles(q) {
  let mn = 180,
    mx = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[(i + 3) % 4],
      b = q[i],
      c = q[(i + 1) % 4],
      u = [a[0] - b[0], a[1] - b[1]],
      v = [c[0] - b[0], c[1] - b[1]],
      d =
        (Math.acos(
          Math.max(
            -1,
            Math.min(1, (u[0] * v[0] + u[1] * v[1]) / (Math.hypot(u[0], u[1]) * Math.hypot(v[0], v[1]) || 1)),
          ),
        ) *
          180) /
        Math.PI;
    if (d < mn) mn = d;
    if (d > mx) mx = d;
  }
  return [mn, mx];
}

// Look for the page. Two views of a small copy of the photo, each cut into 6-pixel blocks:
//  - "drawing": blocks holding both paper white and ink black (a busy drawing that fills its page)
//  - "paper": bright, colourless blocks (a page with white margins on a darker or coloured table)
// Each gives a region; its outline's four straight sides make the page. Returns
// {tier:'sure'|'unsure'|'none', q (corners, photo pixels), why, ...details}.
// (v315) opt.coloured: the page is coloured in (a photo of the finished page, 24-page-photo): see pgPaperT
// (v318.36) In two: the small copy's pixels read on the page (pgShrink: a canvas), then the finding itself on them
// (pgFindCore), which reads nothing of the page, so the JOBS worker can do it (pgFindOff) for a new photo, where it
// held the page longest (0.2 s on a computer); pgFind does both here, for a page already open (pgAdjust, pgRefFlat,
// the finished page's photo), the same code.
function pgFind(img, opt) {
  const s = pgShrink(img);
  return s.why ? s : pgFindCore(s, opt);
}
// the small copy of the photo: its pixels (d, w × h), its scale (sc) and the photo's own size; or {tier: 'none', why}
function pgShrink(img) {
  const iw = img.naturalWidth || img.width,
    ih = img.naturalHeight || img.height;
  if (!(iw > 40 && ih > 40)) return { tier: 'none', why: 'small' };
  const S = 720,
    sc = Math.min(1, S / Math.max(iw, ih)),
    w = Math.max(24, Math.round(iw * sc)),
    h = Math.max(24, Math.round(ih * sc)),
    c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'medium';
  // (on white, as the picture itself is drawn: a see-through PNG's clear parts read as black otherwise, v298)
  g.fillStyle = '#fff';
  g.fillRect(0, 0, w, h);
  drawShrunk(g, img, w, h);
  let d;
  try {
    d = g.getImageData(0, 0, w, h).data;
  } catch (e) {
    return { tier: 'none', why: 'read' };
  }
  freeCanvas(c);
  return { d: d, w: w, h: h, sc: sc, iw: iw, ih: ih };
}
// the page found in the JOBS worker from the small copy (its pixels handed over), or on the page where there's no
// worker or the job fails (the copy made again); an error finding it reads as no page, as pgBegin took it (why 'read')
function pgFindOff(img, opt) {
  let s;
  try {
    s = pgShrink(img);
  } catch (e) {
    return Promise.resolve({ tier: 'none', why: 'read' });
  }
  if (s.why) return Promise.resolve(s);
  const here = function () {
    try {
      // (timed for Copy diagnostics as the find was before v318.36, holdTime in safety.js)
      return holdTime('New photo: find the page', function () {
        const s2 = pgShrink(img);
        return s2.why ? s2 : pgFindCore(s2, opt);
      });
    } catch (e) {
      return { tier: 'none', why: 'read' };
    }
  };
  if (!JOBS.on) return Promise.resolve(here());
  return JOBS.run('pgf', { d: s.d, w: s.w, h: s.h, sc: s.sc, iw: s.iw, ih: s.ih, opt: opt || null }, [
    s.d.buffer,
  ]).then(function (f) {
    return f;
  }, here);
}
// (runs in the worker) the page found from the small copy sent
function pgWork(m) {
  return { v: pgFindCore(m, m.opt), t: [] };
}
// the finder's code for the worker: pgFindCore and what it calls, and their constants as this page has them
function pgWorkerSrc() {
  const K = {
    PG_CLOTH: PG_CLOTH,
    PG_BUSY: PG_BUSY,
    PG_PAPER_ALL: PG_PAPER_ALL,
    PG_PAPER_VALLEY: PG_PAPER_VALLEY,
    PG_CROSS_IN: PG_CROSS_IN,
    PG_SHARP_FAR: PG_SHARP_FAR,
    PG_CROSS_MAX: PG_CROSS_MAX,
    PG_SHARP_MIN: PG_SHARP_MIN,
    PG_EDGE_MIN: PG_EDGE_MIN,
    PG_EDGE_TILT: PG_EDGE_TILT,
    PG_EDGE_SPREAD: PG_EDGE_SPREAD,
    PG_EDGE_K: PG_EDGE_K,
    PG_EDGE_COVER: PG_EDGE_COVER,
    PG_EDGE_QUADS: PG_EDGE_QUADS,
    PG_EDGE_FAR: PG_EDGE_FAR,
    PG_EDGE_STEP: PG_EDGE_STEP,
    PG_EDGE_IN: PG_EDGE_IN,
  };
  return (
    [
      pgHomog,
      pgArea,
      pgOrder,
      pgConvex,
      pgAngles,
      pgPaperT,
      pgFlicker,
      pgRegion,
      pgRing,
      pgQuad,
      pgCross,
      pgInset,
      pgEdges,
      pgJudge,
      pgAspectAt,
      paperGains,
      pgFindCore,
      pgWork,
    ]
      .map(function (f) {
        return f.toString();
      })
      .join('\n') +
    '\nconst _cr = ' +
    _cr.toString() +
    ';\nconst ' +
    Object.keys(K)
      .map(function (k) {
        return k + ' = ' + K[k];
      })
      .join(', ') +
    ';\n'
  );
}
// the finding itself, on the small copy (s: pgShrink's)
function pgFindCore(s, opt) {
  const d = s.d,
    w = s.w,
    h = s.h,
    sc = s.sc,
    iw = s.iw,
    ih = s.ih;
  // (v308) a page photographed under a warm lamp: the paper's tint taken out first (each channel scaled so the
  // brightest 5% come out white, at most x2, only when they're tinted), so the paper isn't taken for something
  // colourful like the wooden table under it
  const wb = paperGains(d, w * h, 1);
  if (wb)
    for (let j = 0; j < d.length; j += 4) {
      d[j] = d[j] * wb[0];
      d[j + 1] = d[j + 1] * wb[1];
      d[j + 2] = d[j + 2] * wb[2];
    }
  // per block: its second-brightest and second-darkest pixel (about the 95th and 5th percentiles of 36), mean
  // brightness and mean colourfulness
  const B = 6,
    gw = Math.floor(w / B),
    gh = Math.floor(h / B),
    N = gw * gh,
    con = new Float32Array(N),
    hi = new Float32Array(N),
    sat = new Float32Array(N),
    mean = new Float32Array(N);
  for (let by = 0; by < gh; by++)
    for (let bx = 0; bx < gw; bx++) {
      let a1 = -1,
        a2 = -1,
        z1 = 999,
        z2 = 999,
        sm = 0,
        ss = 0;
      for (let y = by * B; y < by * B + B; y++) {
        let j = (y * w + bx * B) * 4;
        for (let x = 0; x < B; x++, j += 4) {
          const r = d[j],
            gg = d[j + 1],
            bb = d[j + 2],
            L = (r * 77 + gg * 150 + bb * 29) >> 8;
          sm += L;
          ss +=
            (r > gg ? (r > bb ? r : bb) : gg > bb ? gg : bb) -
            (r < gg ? (r < bb ? r : bb) : gg < bb ? gg : bb);
          if (L > a1) {
            a2 = a1;
            a1 = L;
          } else if (L > a2) a2 = L;
          if (L < z1) {
            z2 = z1;
            z1 = L;
          } else if (L < z2) z2 = L;
        }
      }
      const i = by * gw + bx;
      hi[i] = a2;
      con[i] = a2 - z2;
      sat[i] = ss / (B * B);
      mean[i] = sm / (B * B);
    }
  const otsu = function (a, lo, hi2) {
    const hs = new Float64Array(256);
    for (let i = 0; i < a.length; i++) hs[Math.max(0, Math.min(255, Math.round(a[i])))]++;
    let sum = 0;
    for (let t = 0; t < 256; t++) sum += t * hs[t];
    let sB = 0,
      wB = 0,
      bv = -1,
      th = 128;
    for (let t = 0; t < 256; t++) {
      wB += hs[t];
      if (!wB) continue;
      const wF = a.length - wB;
      if (!wF) break;
      sB += t * hs[t];
      const mB = sB / wB,
        mF = (sum - sB) / wF,
        v = wB * wF * (mB - mF) * (mB - mF);
      if (v > bv) {
        bv = v;
        th = t;
      }
    }
    return Math.max(lo, Math.min(hi2, th));
  };
  const paperS = new Float32Array(N);
  for (let i = 0; i < N; i++) paperS[i] = hi[i] - 1.5 * sat[i];
  const cands = [],
    conT = otsu(con, 40, 200),
    // (v313) the drawing's blocks, for pgCross: a page's edge can't have the drawing running across it
    dm = new Uint8Array(N);
  for (let i = 0; i < N; i++) dm[i] = con[i] > conT ? 1 : 0;
  [
    ['drawing', con, conT],
    ['paper', paperS, pgPaperT(paperS, N, otsu, opt)],
  ].forEach(function (M) {
    const m = new Uint8Array(N);
    for (let i = 0; i < N; i++) m[i] = M[1][i] > M[2] ? 1 : 0;
    const r = pgRegion(m, gw, gh);
    if (!r) return;
    const f = pgQuad(r, gw, gh, B, w, h);
    if (!f) return;
    f.kind = M[0];
    const xc = pgCross(f.q, dm, hi, gw, gh, B);
    f.cross = xc.cross;
    f.sharp = xc.sharp;
    f.sharpN = xc.n;
    // how the page compares with what is just outside it (a scan has the same white paper all round)
    let inS = 0,
      inN = 0,
      outS = 0,
      outN = 0;
    for (let i = 0; i < N; i++) {
      if (r.m[i]) {
        inS += hi[i];
        inN++;
      } else if (r.ring[i]) {
        outS += mean[i];
        outN++;
      }
    }
    f.step = inN && outN ? inS / inN - outS / outN : 0;
    // (v315) how much the table just outside the page flickers from block to block: a patterned cloth (a check, stripes)
    // where a plain table or wood is even (pgFlicker)
    f.flick = pgFlicker(r.ring, mean, gw, gh);
    f.q = f.q.map(function (p) {
      return [p[0] / sc, p[1] / sc];
    });
    cands.push(f);
  });
  cands.forEach(function (f) {
    pgJudge(f, iw, ih, opt);
  });
  // (v318.35) nothing sure (the paper "fills", or no outline at all): the edge fallback's quads, judged the same way;
  // kept only where they come out better than nothing (an outline judged 'none' there would only change the reason)
  let edges = '';
  if (
    !cands.some(function (f) {
      return f.tier === 'sure';
    })
  ) {
    const eq = pgEdges(d, w, h, B, gw, gh, dm, hi, mean);
    edges = eq.length ? '' : 'nothing';
    eq.forEach(function (f) {
      f.q = f.q.map(function (p) {
        return [p[0] / sc, p[1] / sc];
      });
      pgJudge(f, iw, ih, opt);
      if (f.tier !== 'none') cands.push(f);
      else if (!edges) edges = f.why;
    });
  }
  if (!cands.length) return { tier: 'none', why: 'nothing' };
  // the drawing's own outline wins a tie: on a spiral pad or an open book the paper runs on past the drawing's sheet.
  // (v313) Only when its four sides fit the drawing (its region fills its box as a page would): a diamond drawn round a
  // mandala under a lamp (fill 1.33, a side 21% covered) had won over the paper's own outline, found right beside it
  const rank = { sure: 3, unsure: 2, none: 1 };
  const fits = function (f) {
    return f.kind === 'drawing' && f.fill >= 0.8 && f.fill <= 1.25 && f.minCov >= 0.3;
  };
  cands.sort(function (a, b) {
    return rank[b.tier] - rank[a.tier] || fits(b) - fits(a) || b.score - a.score;
  });
  cands[0].others = cands.slice(1).map(function (f) {
    return { kind: f.kind, tier: f.tier, why: f.why };
  });
  // (v318.35) why the edge fallback's quads were turned down, when they were tried and none was kept
  if (edges) cands[0].edges = edges;
  // (v315) a finished page on a patterned cloth (a check, stripes): the pattern can pass for the page's edge, so a find
  // there is checked rather than trusted (the corners shown). Only for a photo of a finished page, and only the page found
  if (opt && opt.coloured && cands[0].tier === 'sure' && cands[0].flick > PG_CLOTH) {
    cands[0].tier = 'unsure';
    cands[0].why = 'cloth';
  }
  return cands[0];
}
// (v315) how much the table may flicker round a page found 'sure' on a finished-page photo (pgFlicker, the mean step in
// brightness between neighbouring blocks just outside it). Measured: plain tables 0.3-0.9, wood 1-3.2, Ben's and
// the 14 real photos found 'sure' 1.5-2.8; patterned cloths a page was found 'sure' on 15.6-22.6 (one of those 7
// wrong by 3%), the others not found at all.
const PG_CLOTH = 10;
// (v318.13) a surface busy enough round an unsure outline that the outline isn't worth starting from: pgBegin
const PG_BUSY = 5;
// The paper view's threshold: Otsu's over every block. (v315) On a coloured page the drawing's blocks (dark, or
// colourful: a low paperS) are a third mode under the table's and the paper's, and the one split can fall between
// them and everything else, so the whole photo passes as paper (judged 'fills': a finished page on a light wood, grey
// or beige table was never found, where the same page uncoloured was). With opt.coloured, when that split leaves
// nearly all the blocks above it (PG_PAPER_ALL), the blocks above are split again, and that split is kept only where
// the blocks' histogram has a clear valley at it (PG_PAPER_VALLEY: the split's bin against the smaller of the peaks
// either side), as table and paper make one and a white table's lighting gradient doesn't (that split cut the page in
// half and offered the bright half as the page). Measured on 531 made-up photos of three coloured pages: found on
// grey tables up to 75% of the paper's brightness (none before), nothing lost, no wrong page found that wasn't before.
const PG_PAPER_ALL = 0.85,
  PG_PAPER_VALLEY = 0.35;
function pgPaperT(paperS, N, otsu, opt) {
  const t = otsu(paperS, 90, 240);
  if (!opt || !opt.coloured) return t;
  let n = 0;
  for (let i = 0; i < N; i++) if (paperS[i] > t) n++;
  if (n <= PG_PAPER_ALL * N) return t;
  const up = new Float32Array(n);
  n = 0;
  for (let i = 0; i < N; i++) if (paperS[i] > t) up[n++] = paperS[i];
  const t2 = otsu(up, 90, 240),
    BW = 4,
    nb = Math.ceil(256 / BW),
    h0 = new Float32Array(nb),
    h1 = new Float32Array(nb);
  for (let i = 0; i < n; i++) h0[Math.max(0, Math.min(nb - 1, Math.floor(up[i] / BW)))]++;
  for (let b = 0; b < nb; b++) h1[b] = (h0[Math.max(0, b - 1)] + h0[b] + h0[Math.min(nb - 1, b + 1)]) / 3;
  const bt = Math.max(0, Math.min(nb - 1, Math.floor(t2 / BW)));
  let pLo = 0,
    pHi = 0;
  for (let b = 0; b < bt; b++) if (h1[b] > pLo) pLo = h1[b];
  for (let b = bt + 1; b < nb; b++) if (h1[b] > pHi) pHi = h1[b];
  const p = Math.min(pLo, pHi);
  return p > 0 && h1[bt] <= PG_PAPER_VALLEY * p ? t2 : t;
}
// the mean brightness step between neighbouring blocks of the ring just outside the page, along and across it
function pgFlicker(ring, mean, gw, gh) {
  let s = 0,
    n = 0;
  for (let y = 0; y < gh; y++)
    for (let x = 0; x < gw; x++) {
      const i = y * gw + x;
      if (!ring[i]) continue;
      if (x + 1 < gw && ring[i + 1]) {
        s += Math.abs(mean[i] - mean[i + 1]);
        n++;
      }
      if (y + 1 < gh && ring[i + gw]) {
        s += Math.abs(mean[i] - mean[i + gw]);
        n++;
      }
    }
  return n ? s / n : 0;
}
// the region nearest the middle, with its holes (the drawing's lines, a hand resting on it) filled
function pgRegion(m0, gw, gh) {
  const N = gw * gh,
    nb = function (src, dst, keep) {
      for (let y = 0; y < gh; y++)
        for (let x = 0; x < gw; x++) {
          let v = keep;
          for (let dy = -1; dy <= 1 && v === keep; dy++)
            for (let dx = -1; dx <= 1; dx++) {
              const xx = x + dx,
                yy = y + dy;
              const s = xx < 0 || yy < 0 || xx >= gw || yy >= gh ? keep : src[yy * gw + xx];
              if (s !== keep) {
                v = 1 - keep;
                break;
              }
            }
          dst[y * gw + x] = v;
        }
    };
  // close small gaps inside the drawing, then open to cut thin bridges (a neighbouring page's edge, a cable)
  const a = new Uint8Array(N),
    b = new Uint8Array(N);
  nb(m0, a, 0);
  nb(a, b, 1);
  nb(b, a, 1);
  nb(a, b, 0);
  const m = b;
  const lab = new Int32Array(N).fill(-1),
    st = new Int32Array(N);
  let best = -1,
    bs = -1,
    id = 0;
  for (let p = 0; p < N; p++) {
    if (!m[p] || lab[p] >= 0) continue;
    let n = 0,
      sp = 0,
      sx = 0,
      sy = 0;
    st[sp++] = p;
    lab[p] = id;
    while (sp) {
      const q = st[--sp],
        x = q % gw,
        y = (q / gw) | 0;
      n++;
      sx += x;
      sy += y;
      if (x > 0 && m[q - 1] && lab[q - 1] < 0) {
        lab[q - 1] = id;
        st[sp++] = q - 1;
      }
      if (x < gw - 1 && m[q + 1] && lab[q + 1] < 0) {
        lab[q + 1] = id;
        st[sp++] = q + 1;
      }
      if (y > 0 && m[q - gw] && lab[q - gw] < 0) {
        lab[q - gw] = id;
        st[sp++] = q - gw;
      }
      if (y < gh - 1 && m[q + gw] && lab[q + gw] < 0) {
        lab[q + gw] = id;
        st[sp++] = q + gw;
      }
    }
    const s = n * (1 - Math.hypot(sx / n / gw - 0.5, sy / n / gh - 0.5));
    if (s > bs) {
      bs = s;
      best = id;
    }
    id++;
  }
  if (best < 0) return null;
  const out = new Uint8Array(N);
  let sp = 0;
  const push = function (p) {
    if (lab[p] !== best && !out[p]) {
      out[p] = 1;
      st[sp++] = p;
    }
  };
  for (let x = 0; x < gw; x++) {
    push(x);
    push((gh - 1) * gw + x);
  }
  for (let y = 0; y < gh; y++) {
    push(y * gw);
    push(y * gw + gw - 1);
  }
  while (sp) {
    const q = st[--sp],
      x = q % gw,
      y = (q / gw) | 0;
    if (x > 0) push(q - 1);
    if (x < gw - 1) push(q + 1);
    if (y > 0) push(q - gw);
    if (y < gh - 1) push(q + gw);
  }
  const reg = new Uint8Array(N);
  let area = 0;
  for (let i = 0; i < N; i++)
    if (!out[i]) {
      reg[i] = 1;
      area++;
    }
  return { m: reg, ring: pgRing(reg, gw, gh), area: area };
}
// the blocks within 2 of a region, outside it (v318.35: shared with the edge fallback's quads)
function pgRing(reg, gw, gh) {
  const ring = new Uint8Array(gw * gh);
  for (let y = 0; y < gh; y++)
    for (let x = 0; x < gw; x++) {
      const i = y * gw + x;
      if (reg[i]) continue;
      for (let dy = -2; dy <= 2 && !ring[i]; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          const xx = x + dx,
            yy = y + dy;
          if (xx >= 0 && yy >= 0 && xx < gw && yy < gh && reg[yy * gw + xx]) {
            ring[i] = 1;
            break;
          }
        }
    }
  return ring;
}
// four straight sides round the region: the biggest quadrilateral on its hull, then each side re-fitted to the
// outline points along it, ignoring bumps (a hand, the spiral) and the photo's own edges
function pgQuad(r, gw, gh, B, w, h) {
  const m = r.m,
    pts = [],
    fitP = [];
  for (let y = 0; y < gh; y++)
    for (let x = 0; x < gw; x++) {
      const i = y * gw + x;
      if (!m[i]) continue;
      const edge = x === 0 || y === 0 || x === gw - 1 || y === gh - 1;
      if (edge || !m[i - 1] || !m[i + 1] || !m[i - gw] || !m[i + gw]) {
        const p = [(x + 0.5) * B, (y + 0.5) * B];
        pts.push(p);
        if (!edge) fitP.push(p);
      }
    }
  if (pts.length < 12) return null;
  pts.sort(function (a, b) {
    return a[0] - b[0] || a[1] - b[1];
  });
  const lo = [],
    up = [];
  for (const p of pts) {
    while (lo.length >= 2 && _cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop();
    lo.push(p);
  }
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (up.length >= 2 && _cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop();
    up.push(p);
  }
  const hull = lo.slice(0, -1).concat(up.slice(0, -1)),
    H = hull.length;
  if (H < 4) return null;
  const tri = function (a, b, c) {
    return Math.abs(_cr(a, b, c)) / 2;
  };
  let bq = null,
    ba = -1;
  for (let i = 0; i < H; i++)
    for (let k = i + 2; k < H; k++) {
      let bj = -1,
        bjA = -1,
        bl = -1,
        blA = -1;
      for (let j = i + 1; j < k; j++) {
        const a = tri(hull[i], hull[j], hull[k]);
        if (a > bjA) {
          bjA = a;
          bj = j;
        }
      }
      for (let l = k + 1; l < H + i; l++) {
        const a = tri(hull[k], hull[l % H], hull[i]);
        if (a > blA) {
          blA = a;
          bl = l % H;
        }
      }
      if (bj >= 0 && bl >= 0 && bjA + blA > ba) {
        ba = bjA + blA;
        bq = [i, bj, k, bl];
      }
    }
  if (!bq) return null;
  const q0 = bq.map(function (i) {
    return hull[i];
  });
  const lines = [],
    cover = [];
  let seed = 12345;
  const rnd = function () {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let e = 0; e < 4; e++) {
    const a = q0[e],
      b = q0[(e + 1) % 4],
      L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1,
      ux = (b[0] - a[0]) / L,
      uy = (b[1] - a[1]) / L,
      band = Math.max(3 * B, 0.07 * L),
      cand = [];
    for (const p of fitP) {
      const t = ((p[0] - a[0]) * ux + (p[1] - a[1]) * uy) / L,
        dd = Math.abs((p[0] - a[0]) * uy - (p[1] - a[1]) * ux);
      if (t > -0.03 && t < 1.03 && dd < band) cand.push(p);
    }
    if (cand.length < 6) {
      lines.push(null);
      cover.push(0);
      continue;
    }
    // RANSAC: the line through two outline points that the most points lie on
    let bestL = null,
      bn = -1;
    const tol = 1.3 * B;
    for (let it = 0; it < 160; it++) {
      const p = cand[(rnd() * cand.length) | 0],
        q = cand[(rnd() * cand.length) | 0],
        ll = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (ll < L * 0.2) continue;
      const nx = (q[1] - p[1]) / ll,
        ny = -(q[0] - p[0]) / ll;
      if (Math.abs(nx * uy - ny * ux) < 0.9) continue;
      let n = 0;
      for (const s of cand) if (Math.abs((s[0] - p[0]) * nx + (s[1] - p[1]) * ny) < tol) n++;
      if (n > bn) {
        bn = n;
        bestL = [p, nx, ny];
      }
    }
    if (!bestL) {
      lines.push(null);
      cover.push(0);
      continue;
    }
    let sx = 0,
      sy = 0,
      sxx = 0,
      syy = 0,
      sxy = 0,
      n = 0;
    const bins = new Uint8Array(24);
    for (const s of cand) {
      if (Math.abs((s[0] - bestL[0][0]) * bestL[1] + (s[1] - bestL[0][1]) * bestL[2]) >= tol) continue;
      sx += s[0];
      sy += s[1];
      sxx += s[0] * s[0];
      syy += s[1] * s[1];
      sxy += s[0] * s[1];
      n++;
      const t = ((s[0] - a[0]) * ux + (s[1] - a[1]) * uy) / L;
      bins[Math.max(0, Math.min(23, Math.floor(t * 24)))] = 1;
    }
    const mx = sx / n,
      my = sy / n,
      cxx = sxx / n - mx * mx,
      cyy = syy / n - my * my,
      cxy = sxy / n - mx * my,
      th = 0.5 * Math.atan2(2 * cxy, cxx - cyy);
    lines.push({ mx: mx, my: my, dx: Math.cos(th), dy: Math.sin(th) });
    let cv2 = 0;
    for (let i = 0; i < 24; i++) cv2 += bins[i];
    cover.push(cv2 / 24);
  }
  const q = [];
  for (let e = 0; e < 4; e++) {
    const l1 = lines[(e + 3) % 4],
      l2 = lines[e];
    if (!l1 || !l2) {
      q.push(q0[e].slice());
      continue;
    }
    const det = l1.dx * -l2.dy - l1.dy * -l2.dx;
    if (Math.abs(det) < 1e-6) {
      q.push(q0[e].slice());
      continue;
    }
    const t = ((l2.mx - l1.mx) * -l2.dy - (l2.my - l1.my) * -l2.dx) / det;
    q.push([l1.mx + t * l1.dx, l1.my + t * l1.dy]);
  }
  let touch = 0;
  for (let x = 0; x < gw; x++) {
    touch += m[x] + m[(gh - 1) * gw + x];
  }
  for (let y = 0; y < gh; y++) {
    touch += m[y * gw] + m[y * gw + gw - 1];
  }
  return {
    q: pgOrder(q),
    cover: cover,
    fill: (r.area * B * B) / Math.max(1, pgArea(q)),
    frac: r.area / (gw * gh),
    touch: touch / (2 * (gw + gh)),
    w: w,
    h: h,
  };
}
// (v313) how much of the quad's outline the drawing runs across: at points along each side (every block), the
// block 2 in from the side and the block 2 out from it (both inside the small copy) are both the drawing's. A page's
// edge has paper, table or nothing outside it; the bright half of a page under a lamp has the drawing on both sides.
// Only the sides' parts inside the picture count (a side along the photo's edge can't be looked across).
const PG_CROSS_IN = 2,
  PG_SHARP_FAR = 5;
function pgCross(q, dm, hi, gw, gh, B) {
  let cx = 0,
    cy = 0;
  for (let e = 0; e < 4; e++) {
    cx += q[e][0] / 4;
    cy += q[e][1] / 4;
  }
  let hit = 0,
    tot = 0,
    near = 0,
    far = 0,
    nf = 0;
  const at = function (px, py, ux, uy, k) {
    const x = Math.floor((px + ux * k) / B),
      y = Math.floor((py + uy * k) / B);
    return x < 0 || y < 0 || x >= gw || y >= gh ? -1 : y * gw + x;
  };
  for (let e = 0; e < 4; e++) {
    const a = q[e],
      b = q[(e + 1) % 4],
      L = Math.hypot(b[0] - a[0], b[1] - a[1]),
      n = Math.max(1, Math.round(L / B));
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n,
        px = a[0] + (b[0] - a[0]) * t,
        py = a[1] + (b[1] - a[1]) * t,
        dx = cx - px,
        dy = cy - py,
        dl = Math.hypot(dx, dy) || 1,
        ux = (dx / dl) * B,
        uy = (dy / dl) * B,
        i2 = at(px, py, ux, uy, PG_CROSS_IN),
        o2 = at(px, py, ux, uy, -PG_CROSS_IN);
      if (i2 < 0 || o2 < 0) continue;
      tot++;
      if (dm[i2] && dm[o2]) hit++;
      // the step in brightness across the side: just across it (1 block each way) against well across it
      const i1 = at(px, py, ux, uy, 1),
        o1 = at(px, py, ux, uy, -1),
        i5 = at(px, py, ux, uy, PG_SHARP_FAR),
        o5 = at(px, py, ux, uy, -PG_SHARP_FAR);
      if (i5 < 0 || o5 < 0) continue;
      nf++;
      near += hi[i1] - hi[o1];
      far += hi[i5] - hi[o5];
    }
  }
  return { cross: tot ? hit / tot : 0, sharp: nf && far > 0 ? near / far : 1, n: nf };
}
const PG_CROSS_MAX = 0.2,
  PG_SHARP_MIN = 0.5;
// (v318.35) The edge fallback (Fable E1-1): a page on a desk nearly as bright as the paper (a light grey or white
// table, a page lit unevenly) has no paper/table split the block views can find (the paper candidate "fills" or
// nothing is sure), yet its edge is still a sharp local step everywhere. So: the gradient of the white-balanced grey
// on the 720 px copy, thinned to its ridges (non-maximum suppression), each ridge pixel voting for the lines through
// it with its own gradient direction (a Hough accumulator over direction x offset, so only pixels whose step runs
// the same way add up: a page edge, not a texture); per side the strongest few lines whose step goes bright inward
// (paper brighter than what is round it); every top/right/bottom/left combination makes a quad, kept when each
// side has a ridge along at least PG_EDGE_COVER of its length (a page cut off by the photo's edge has no line
// there and gets no quad: no fourth side is invented); the best few go to pgJudge as any other candidate, with the
// region, ring, step, flicker and crossing measures taken from the blocks inside the quad.
const PG_EDGE_MIN = 6, // the gradient step (grey levels per pixel) a ridge must have
  PG_EDGE_TILT = 40, // degrees a side may turn from the picture's axes
  PG_EDGE_SPREAD = 4, // degrees either side of a pixel's own gradient direction its vote covers
  PG_EDGE_K = 5, // lines kept per side
  PG_EDGE_COVER = 0.5, // the least a side may be covered by ridge pixels
  PG_EDGE_QUADS = 3, // quads offered to pgJudge
  PG_EDGE_FAR = 4, // pixels past a ridge where the step must still hold
  PG_EDGE_STEP = 0.3, // ...by this share of the ridge's own gradient
  PG_EDGE_IN = 3; // pixels the quad is moved inside its ridges, onto the paper
// a convex quad with each side moved d px towards its inside (the corners where the moved sides meet); the quad as it
// was if a corner can't be found
function pgInset(q, d) {
  const cx = (q[0][0] + q[1][0] + q[2][0] + q[3][0]) / 4,
    cy = (q[0][1] + q[1][1] + q[2][1] + q[3][1]) / 4,
    L = [];
  for (let e = 0; e < 4; e++) {
    const a = q[e],
      b = q[(e + 1) % 4],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    let nx = -(b[1] - a[1]) / len,
      ny = (b[0] - a[0]) / len;
    if ((cx - a[0]) * nx + (cy - a[1]) * ny < 0) {
      nx = -nx;
      ny = -ny;
    }
    L.push({ nx: nx, ny: ny, c: a[0] * nx + a[1] * ny + d });
  }
  const out = [];
  for (let e = 0; e < 4; e++) {
    const A = L[(e + 3) % 4],
      Bl = L[e],
      det = A.nx * Bl.ny - A.ny * Bl.nx;
    if (Math.abs(det) < 1e-9) return q;
    out.push([(A.c * Bl.ny - A.ny * Bl.c) / det, (A.nx * Bl.c - A.c * Bl.nx) / det]);
  }
  return out;
}
function pgEdges(d, w, h, B, gw, gh, dm, hi, mean) {
  const n = w * h,
    L = new Float32Array(n);
  for (let i = 0, j = 0; i < n; i++, j += 4) L[i] = (d[j] * 77 + d[j + 1] * 150 + d[j + 2] * 29) >> 8;
  // smoothed 3 x 3 (the noise turns a step's direction by a few degrees; the votes below need it steady), then
  // Sobel (/4: a step of one grey level reads as 1) and its direction in whole degrees (the way brightness rises)
  const Lb = new Float32Array(n);
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      Lb[i] =
        (L[i - w - 1] +
          L[i - w] +
          L[i - w + 1] +
          L[i - 1] +
          L[i] +
          L[i + 1] +
          L[i + w - 1] +
          L[i + w] +
          L[i + w + 1]) /
        9;
    }
  const GX = new Float32Array(n),
    GY = new Float32Array(n),
    mag = new Float32Array(n);
  for (let y = 2; y < h - 2; y++)
    for (let x = 2; x < w - 2; x++) {
      const i = y * w + x,
        gx =
          (Lb[i - w + 1] + 2 * Lb[i + 1] + Lb[i + w + 1] - Lb[i - w - 1] - 2 * Lb[i - 1] - Lb[i + w - 1]) / 4,
        gy =
          (Lb[i + w - 1] + 2 * Lb[i + w] + Lb[i + w + 1] - Lb[i - w - 1] - 2 * Lb[i - w] - Lb[i - w + 1]) / 4;
      GX[i] = gx;
      GY[i] = gy;
      mag[i] = gx * gx + gy * gy;
    }
  // non-maximum suppression along the gradient: only the ridge of each step remains, each voting (acc: direction in
  // whole degrees x offset) for the lines through it that run its own way
  const ridge = new Uint8Array(n),
    dir = new Int16Array(n).fill(-1),
    diag = Math.ceil(Math.hypot(w, h)),
    NR = 2 * diag + 1,
    acc = new Uint16Array(360 * NR),
    cs = new Float32Array(360),
    sn = new Float32Array(360),
    m2 = PG_EDGE_MIN * PG_EDGE_MIN,
    T22 = Math.tan(Math.PI / 8);
  for (let t = 0; t < 360; t++) {
    cs[t] = Math.cos((t * Math.PI) / 180);
    sn[t] = Math.sin((t * Math.PI) / 180);
  }
  let nr = 0;
  for (let y = PG_EDGE_FAR; y < h - PG_EDGE_FAR; y++)
    for (let x = PG_EDGE_FAR; x < w - PG_EDGE_FAR; x++) {
      const i = y * w + x,
        m = mag[i];
      if (m < m2) continue;
      // the neighbour pair nearest the gradient's direction
      const gx = GX[i],
        gy = GY[i],
        ax = Math.abs(gx),
        ay = Math.abs(gy),
        o = ay < T22 * ax ? 1 : ax < T22 * ay ? w : gx > 0 === gy > 0 ? w + 1 : w - 1;
      if (m < mag[i - o] || m < mag[i + o]) continue;
      // a step, not a drawn line: well past it either way (PG_EDGE_FAR) the dark side stays dark. A line's two edges
      // are both bright beyond (so a frame drawn round a mandala, or a tessellation's grid, can't pass as the page).
      // A share of the ridge's own step only: the desk just outside a page is often darker still (its contact shadow)
      const ml = Math.sqrt(m),
        fx = Math.round((PG_EDGE_FAR * gx) / ml),
        fy = Math.round((PG_EDGE_FAR * gy) / ml),
        li = L[i + fy * w + fx],
        lo = L[i - fy * w - fx];
      if (!(li - lo >= PG_EDGE_MIN && li - lo >= PG_EDGE_STEP * ml)) continue;
      // (v318.36) and the step lasts: a desk stays darker than the paper well beyond the edge, a drawn line ends and
      // the paper comes back. A thick line (a grid's 24 px border on a 1,300 px download, 13 px on this copy) still
      // had its far side dark 4 px past its edge, and the grid's inner lines were taken for a page (e2e random-and-
      // blend: 16 of 48 boxes kept). Samples past the picture's edge are left out.
      let gone = false;
      for (let k = 3; k <= 6 && !gone; k += 3) {
        const ox = Math.round((k * PG_EDGE_FAR * gx) / ml),
          oy = Math.round((k * PG_EDGE_FAR * gy) / ml),
          xx = (i % w) - ox,
          yy = ((i / w) | 0) - oy;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        if (li - L[yy * w + xx] < PG_EDGE_MIN) gone = true;
      }
      if (gone) continue;
      const a = ((Math.round((Math.atan2(gy, gx) * 180) / Math.PI) % 360) + 360) % 360;
      ridge[i] = 1;
      dir[i] = a;
      nr++;
      for (let t = a - PG_EDGE_SPREAD; t <= a + PG_EDGE_SPREAD; t++) {
        const tt = (t + 360) % 360,
          r = Math.round(x * cs[tt] + y * sn[tt]) + diag;
        acc[tt * NR + r]++;
      }
    }
  if (nr < 4 * B) return [];
  // per side, the strongest distinct lines whose step rises inward: top (down), right (left), bottom (up), left (right)
  const centre = [90, 180, 270, 0],
    vmin = Math.max(3 * B, 0.2 * Math.min(w, h)),
    sides = [];
  for (let s = 0; s < 4; s++) {
    const found = [];
    for (let dt = -PG_EDGE_TILT; dt <= PG_EDGE_TILT; dt++) {
      const t = (centre[s] + dt + 360) % 360,
        row = t * NR;
      // (the sum of three neighbouring offsets, slid along the row; most of it is empty)
      let v = acc[row] + acc[row + 1];
      for (let r = 1; r < NR - 1; r++) {
        v += acc[row + r + 1];
        if (v >= vmin) found.push([v, t, r - diag]);
        v -= acc[row + r - 1];
      }
    }
    found.sort(function (a, b) {
      return b[0] - a[0];
    });
    const keep = [];
    for (const c of found) {
      if (keep.length >= PG_EDGE_K) break;
      let near = false;
      for (const k of keep) {
        const da = Math.abs(((c[1] - k.t + 540) % 360) - 180);
        if (da <= 4 && Math.abs(c[2] - k.r) <= 2 * B) {
          near = true;
          break;
        }
      }
      if (!near) keep.push({ v: c[0], t: c[1], r: c[2] });
    }
    // the ridge pixels along each line (within a pixel either side, their step within 12 degrees of the line's),
    // as a running count by position along it, for the cover of any stretch of it
    for (const k of keep) {
      const nx = cs[k.t],
        ny = sn[k.t],
        t0 = -diag,
        len = 2 * diag,
        run = new Uint16Array(len + 1);
      for (let p = 0; p < len; p++) {
        const px = k.r * nx - (t0 + p) * ny,
          py = k.r * ny + (t0 + p) * nx;
        let hit = 0;
        for (let o = -1; o <= 1 && !hit; o++) {
          const x = Math.round(px + o * nx),
            y = Math.round(py + o * ny);
          if (x < 0 || y < 0 || x >= w || y >= h) continue;
          const i = y * w + x;
          if (ridge[i] && Math.abs(((dir[i] - k.t + 540) % 360) - 180) <= 12) hit = 1;
        }
        run[p + 1] = run[p] + hit;
      }
      k.nx = nx;
      k.ny = ny;
      k.t0 = t0;
      k.run = run;
    }
    sides.push(keep);
  }
  if (sides.some((k) => !k.length)) return [];
  const meet = function (a, b) {
    const det = a.nx * b.ny - a.ny * b.nx;
    if (Math.abs(det) < 1e-6) return null;
    return [(a.r * b.ny - b.r * a.ny) / det, (a.nx * b.r - b.nx * a.r) / det];
  };
  // the cover of a side between two corners: of 24 equal stretches, the share holding a ridge pixel
  const coverOf = function (k, p, q) {
    const ta = -(p[0] - k.r * k.nx) * k.ny + (p[1] - k.r * k.ny) * k.nx - k.t0,
      tb = -(q[0] - k.r * k.nx) * k.ny + (q[1] - k.r * k.ny) * k.nx - k.t0,
      lo = Math.max(0, Math.min(ta, tb)),
      hi2 = Math.min(k.run.length - 1, Math.max(ta, tb));
    if (hi2 - lo < 2 * B) return 0;
    let c = 0;
    for (let b = 0; b < 24; b++) {
      const a0 = Math.floor(lo + ((hi2 - lo) * b) / 24),
        a1 = Math.floor(lo + ((hi2 - lo) * (b + 1)) / 24);
      if (k.run[a1] > k.run[a0]) c++;
    }
    return c / 24;
  };
  const quads = [];
  for (const T of sides[0])
    for (const R of sides[1])
      for (const Bt of sides[2])
        for (const Lf of sides[3]) {
          const tl = meet(T, Lf),
            tr = meet(T, R),
            br = meet(Bt, R),
            bl = meet(Bt, Lf);
          if (!tl || !tr || !br || !bl) continue;
          const q = [tl, tr, br, bl];
          if (tl[0] >= tr[0] || bl[0] >= br[0] || tl[1] >= bl[1] || tr[1] >= br[1]) continue;
          if (
            q.some(function (p) {
              return p[0] < -0.1 * w || p[1] < -0.1 * h || p[0] > 1.1 * w || p[1] > 1.1 * h;
            })
          )
            continue;
          if (!pgConvex(q) || pgArea(q) < 0.1 * w * h) continue;
          const cover = [coverOf(T, tl, tr), coverOf(R, tr, br), coverOf(Bt, br, bl), coverOf(Lf, bl, tl)],
            mc = Math.min.apply(null, cover);
          if (mc < PG_EDGE_COVER) continue;
          quads.push({ q: q, cover: cover, score: cover[0] + cover[1] + cover[2] + cover[3] + 0.5 * mc });
        }
  quads.sort(function (a, b) {
    return b.score - a.score;
  });
  const out = [];
  for (const c of quads) {
    if (out.length >= PG_EDGE_QUADS) break;
    if (
      out.some(function (o) {
        return o.q.every(function (p, i) {
          return Math.hypot(p[0] - c.q[i][0], p[1] - c.q[i][1]) < 0.02 * diag;
        });
      })
    )
      continue;
    // the blocks inside the quad stand for its region: pgJudge's fill, touch, step and flicker as for the others
    const reg = new Uint8Array(gw * gh);
    let area = 0,
      touch = 0;
    for (let by = 0; by < gh; by++)
      for (let bx = 0; bx < gw; bx++) {
        const x = (bx + 0.5) * B,
          y = (by + 0.5) * B;
        let inside = true;
        for (let e = 0; e < 4 && inside; e++) {
          const a = c.q[e],
            b = c.q[(e + 1) % 4];
          if ((b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]) < 0) inside = false;
        }
        if (!inside) continue;
        reg[by * gw + bx] = 1;
        area++;
        if (bx === 0 || by === 0 || bx === gw - 1 || by === gh - 1) touch++;
      }
    const ring = pgRing(reg, gw, gh),
      xc = pgCross(c.q, dm, hi, gw, gh, B);
    // the step from inside to out, measured at the edge itself (PG_EDGE_FAR either side, every 2 px along each
    // side) rather than between the whole page and the ring round it: on a desk nearly as bright as the paper the
    // page as a whole stands out by little (pgJudge would call it 'plain'), its edge by a clear step
    let stS = 0,
      stN = 0;
    for (let e = 0; e < 4; e++) {
      const a = c.q[e],
        b = c.q[(e + 1) % 4],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]),
        nx = -(b[1] - a[1]) / len,
        ny = (b[0] - a[0]) / len;
      for (let t = 1; t < len; t += 2) {
        const px = a[0] + ((b[0] - a[0]) * t) / len,
          py = a[1] + ((b[1] - a[1]) * t) / len,
          xi = Math.round(px + PG_EDGE_FAR * nx),
          yi = Math.round(py + PG_EDGE_FAR * ny),
          xo = Math.round(px - PG_EDGE_FAR * nx),
          yo = Math.round(py - PG_EDGE_FAR * ny);
        if (xi < 1 || yi < 1 || xo < 1 || yo < 1 || xi >= w - 1 || yi >= h - 1 || xo >= w - 1 || yo >= h - 1)
          continue;
        stS += Lb[yi * w + xi] - Lb[yo * w + xo];
        stN++;
      }
    }
    out.push({
      kind: 'edges',
      // (inset PG_EDGE_IN px from the ridges, which sit midway down the step: the warped page had kept a frame of the
      // desk's shadow round it, as ink, so its margins were closed in and counted as sections — the owner's photo)
      q: pgOrder(pgInset(c.q, PG_EDGE_IN)),
      cover: c.cover,
      fill: (area * B * B) / Math.max(1, pgArea(c.q)),
      frac: area / (gw * gh),
      touch: touch / (2 * (gw + gh)),
      w: w,
      h: h,
      cross: xc.cross,
      sharp: xc.sharp,
      sharpN: xc.n,
      step: stN ? stS / stN : 0,
      flick: pgFlicker(ring, mean, gw, gh),
    });
  }
  return out;
}
// how sure we are, and why not
function pgJudge(f, iw, ih, opt) {
  // (v313) the drawing runs across this outline, or the light changes gently across it rather than in a step: uneven
  // light on a page (its bright half under a lamp), not a page's edge. Nothing is offered to straighten.
  // (v318.35: the edge fallback's outlines too, a shadow's edge across the drawing being a straight line)
  if (
    (f.kind === 'paper' || f.kind === 'edges') &&
    (f.cross > PG_CROSS_MAX || (f.sharpN >= 8 && f.sharp < PG_SHARP_MIN))
  ) {
    f.tier = 'none';
    f.why = 'lit';
    f.score = 0;
    f.minCov = Math.min.apply(null, f.cover);
    return;
  }
  const q = f.q,
    diag = Math.hypot(iw, ih),
    tolIn = 0.01 * diag,
    ang = pgAngles(q),
    out = q.some(function (p) {
      return p[0] < -tolIn || p[1] < -tolIn || p[0] > iw + tolIn || p[1] > ih + tolIn;
    }),
    far = q.some(function (p) {
      return p[0] < -0.6 * iw || p[1] < -0.6 * ih || p[0] > 1.6 * iw || p[1] > 1.6 * ih;
    }),
    minCov = Math.min.apply(null, f.cover),
    area = pgArea(q) / (iw * ih);
  f.minCov = minCov;
  f.score =
    f.cover.reduce(function (s, v) {
      return s + v;
    }, 0) /
      4 -
    Math.abs(1 - f.fill);
  if (!pgConvex(q) || far || ang[0] < 35 || ang[1] > 145 || area < 0.1) {
    f.tier = 'none';
    f.why = 'shape';
    return;
  }
  if (f.touch > 0.55 || area > 1.6) {
    f.tier = 'none';
    f.why = 'fills';
    return;
  }
  // a page that is already square to the camera with nothing round it worth trimming: leave it be
  const bx = [
      Math.min(q[0][0], q[3][0]),
      Math.min(q[0][1], q[1][1]),
      Math.max(q[1][0], q[2][0]),
      Math.max(q[2][1], q[3][1]),
    ],
    rect = [
      [bx[0], bx[1]],
      [bx[2], bx[1]],
      [bx[2], bx[3]],
      [bx[0], bx[3]],
    ];
  const square = q.every(function (p, i) {
    return Math.hypot(p[0] - rect[i][0], p[1] - rect[i][1]) < 0.012 * diag;
  });
  if (square && (f.step < 35 || area > 0.9)) {
    f.tier = 'none';
    f.why = 'square';
    return;
  }
  // no step from inside to out: a drawing on plain paper (or a white page on a white table), not a page's outline
  if (f.step < 25) {
    f.tier = 'none';
    f.why = 'plain';
    return;
  }
  // (v318.12) not sure of an outline that is the drawing's, not the paper's: a page photographed from above that fills
  // the photo (Ben's sketchbook pages, drawn to the edge: 2 of his 3 line-only ones opened the corner handles on the
  // drawing's own shape). Built as taken, with Straighten offered on its line; nothing the benchmark's photos found changes (their
  // unsure finds are all the paper's)
  // (not for a photo of a finished page, opt.coloured: its corner handles start from the drawing's outline as before)
  if (
    f.kind === 'drawing' &&
    !(opt && opt.coloured) &&
    (out || (f.touch > 0.04 && minCov < 0.3) || minCov < 0.6 || f.fill < 0.85 || f.fill > 1.12)
  ) {
    f.tier = 'none';
    f.why = 'drawing';
    return;
  }
  // a corner beyond the photo's edge, or a side lying along it (the page runs off the photo there)
  if (out || (f.touch > 0.04 && minCov < 0.3)) {
    f.tier = 'unsure';
    f.why = 'off';
    return;
  }
  if (minCov < 0.6 || f.fill < 0.85 || f.fill > 1.12) {
    f.tier = 'unsure';
    f.why = 'unclear';
    return;
  }
  f.tier = 'sure';
  f.why = '';
}

// width : height of the flat page. With the lens's focal length (in pixels at this photo's size) the page's
// true shape follows from the corners; the principal point is taken as the photo's middle.
function pgAspectAt(q, iw, ih, f) {
  const Hm = pgHomog(
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
    q,
  );
  if (!Hm) return null;
  const u0 = iw / 2,
    v0 = ih / 2,
    col = function (k) {
      return [(Hm[k] - u0 * Hm[6 + k]) / f, (Hm[3 + k] - v0 * Hm[6 + k]) / f, Hm[6 + k]];
    },
    a = col(0),
    b = col(1),
    r = Math.hypot(a[0], a[1], a[2]) / Math.hypot(b[0], b[1], b[2]);
  return isFinite(r) && r > 0 ? r : null;
}
const PG_SHAPES = { letter: 8.5 / 11, a4: 1 / Math.SQRT2, square: 1 };
function pgShapeOf(q, iw, ih, f35, shape) {
  const lens = f35 || 25,
    f = (lens / 43.27) * Math.hypot(iw, ih);
  let a = pgAspectAt(q, iw, ih, f);
  if (!a) {
    const L = function (i, j) {
      return Math.hypot(q[j][0] - q[i][0], q[j][1] - q[i][1]);
    };
    a = (L(0, 1) + L(3, 2)) / (L(0, 3) + L(1, 2));
  }
  const land = a > 1;
  if (shape && PG_SHAPES[shape])
    return { aspect: land ? 1 / PG_SHAPES[shape] : PG_SHAPES[shape], shape: shape, measured: a };
  // without the camera's lens information the measurement can be a few percent out: settle on a common page
  // shape when it's that close
  if (!f35) {
    for (const k in PG_SHAPES) {
      const s = land ? 1 / PG_SHAPES[k] : PG_SHAPES[k];
      if (Math.abs(a / s - 1) < 0.03) return { aspect: s, shape: k, measured: a };
    }
  }
  return { aspect: a, shape: 'auto', measured: a };
}
// the 35 mm-equivalent focal length a phone writes into its photos (EXIF tag 0xA405), or 0
function pgExifFocal(buf) {
  try {
    const v = new DataView(buf);
    if (v.getUint16(0) !== 0xffd8) return 0;
    let o = 2;
    while (o + 4 < v.byteLength) {
      const mk = v.getUint16(o),
        len = v.getUint16(o + 2);
      if (mk === 0xffe1 && v.getUint32(o + 4) === 0x45786966) {
        const t = o + 10,
          le = v.getUint16(t) === 0x4949,
          u16 = function (p) {
            return v.getUint16(t + p, le);
          },
          u32 = function (p) {
            return v.getUint32(t + p, le);
          };
        const ifd = function (p, want) {
          const n = u16(p);
          for (let i = 0; i < n; i++) {
            const e = p + 2 + i * 12;
            if (t + e + 12 > v.byteLength) return null;
            if (u16(e) === want) return e;
          }
          return null;
        };
        const e0 = ifd(u32(4), 0x8769);
        if (e0 == null) return 0;
        const e1 = ifd(u32(e0 + 8), 0xa405);
        if (e1 == null) return 0;
        const val = u16(e1 + 8);
        return val >= 8 && val <= 300 ? val : 0;
      }
      if ((mk & 0xff00) !== 0xff00 || mk === 0xffda) break;
      o += 2 + len;
    }
  } catch (e) {}
  return 0;
}
// the flat page, drawn from the photo through the corners (bilinear)
function pgWarp(img, q, aspect) {
  const iw = img.naturalWidth || img.width,
    ih = img.naturalHeight || img.height,
    L = function (i, j) {
      return Math.hypot(q[j][0] - q[i][0], q[j][1] - q[i][1]);
    };
  const longPx = Math.max(L(0, 1), L(3, 2), L(0, 3), L(1, 2)),
    side = Math.max(64, Math.min(MAXSIDE, Math.round(longPx * 1.05))),
    ow = aspect >= 1 ? side : Math.max(16, Math.round(side * aspect)),
    oh = aspect >= 1 ? Math.max(16, Math.round(side / aspect)) : side;
  const sc = document.createElement('canvas');
  sc.width = iw;
  sc.height = ih;
  const sg = sc.getContext('2d');
  sg.fillStyle = '#fff';
  sg.fillRect(0, 0, iw, ih);
  sg.drawImage(img, 0, 0);
  const s = sg.getImageData(0, 0, iw, ih).data;
  freeCanvas(sc);
  const Hm = pgHomog(
      [
        [0, 0],
        [ow, 0],
        [ow, oh],
        [0, oh],
      ],
      q,
    ),
    oc = document.createElement('canvas');
  oc.width = ow;
  oc.height = oh;
  const og = oc.getContext('2d'),
    im = og.createImageData(ow, oh),
    o = im.data;
  for (let y = 0; y < oh; y++) {
    const yy = y + 0.5;
    for (let x = 0; x < ow; x++) {
      const xx = x + 0.5,
        den = Hm[6] * xx + Hm[7] * yy + 1,
        u = (Hm[0] * xx + Hm[1] * yy + Hm[2]) / den - 0.5,
        v = (Hm[3] * xx + Hm[4] * yy + Hm[5]) / den - 0.5,
        j = (y * ow + x) * 4;
      if (u < 0 || v < 0 || u > iw - 1 || v > ih - 1) {
        o[j] = o[j + 1] = o[j + 2] = 255;
        o[j + 3] = 255;
        continue;
      }
      const x0 = u | 0,
        y0 = v | 0,
        x1 = Math.min(iw - 1, x0 + 1),
        y1 = Math.min(ih - 1, y0 + 1),
        fx = u - x0,
        fy = v - y0,
        a = (y0 * iw + x0) * 4,
        b = (y0 * iw + x1) * 4,
        c = (y1 * iw + x0) * 4,
        e = (y1 * iw + x1) * 4;
      for (let k = 0; k < 3; k++) {
        const top = s[a + k] + (s[b + k] - s[a + k]) * fx,
          bot = s[c + k] + (s[e + k] - s[c + k]) * fx;
        o[j + k] = top + (bot - top) * fy;
      }
      o[j + 3] = 255;
    }
  }
  og.putImageData(im, 0, 0);
  return oc;
}

/* ---- the straightening flow: automatic when sure, corner handles when unsure, nothing for a scan ---- */
const PG_WHY = {
  off: 'Part of the page is outside the photo, so check the corners before straightening.',
  unclear: 'One edge of the page is hidden or bent, so check the corners before straightening.',
  none: 'Drag the four corners onto the corners of the page.',
  adjust: 'Drag a corner to move it.',
};
// (v318.32) said after the reason on a fresh photo's corner step: how to put the corners right (U1-3)
const PG_DRAG = 'Drag the yellow corners onto the page\u2019s corners, then Straighten.';
// (v318.32) whether the corners sit inside the photo and cover most of it (over half): then Straighten is the main
// button on a fresh photo the finder was unsure of. A quad with a corner off the photo, or a small one (a page's
// bright half under a lamp), keeps Keep as is first
function pgCovers(q) {
  if (!pgOrig) return false;
  const iw = pgOrig.naturalWidth || pgOrig.width,
    ih = pgOrig.naturalHeight || pgOrig.height,
    m = 0.005;
  for (let i = 0; i < 4; i++)
    if (q[i][0] < -iw * m || q[i][0] > iw * (1 + m) || q[i][1] < -ih * m || q[i][1] > ih * (1 + m))
      return false;
  return pgArea(q) > 0.5 * iw * ih;
}
let _pgT = 0;
// (v318.11; v318.13 in the warning box, segQuality) a page photographed at a steep angle: the far end of the page has few of the photo's pixels, and half its
// sections were lost (the guide benchmark's printed set: flat on the desk 94-97% of the sections found, at about 45°
// 52%). Found by how much shorter the page's far edge is than its near edge in the finder's corners (pgKeystone): on
// the maintainer's photos the finder sure, flat ones 0.92-0.99, steep ones 0.57-0.62; a made-up photo tilted 25° in
// front of a wide lens, close, 0.71, which stays quiet. Only when the finder is sure (an unsure outline is a guess that
// can look slanted), said once, after the page is straightened by itself.
const PG_STEEP = 0.67;
let pgSteep = false;
function pgKeystone(q) {
  if (!q || q.length !== 4) return 1;
  const L = function (a, b) {
      return Math.hypot(q[a][0] - q[b][0], q[a][1] - q[b][1]);
    },
    a = L(0, 1),
    b = L(1, 2),
    c = L(2, 3),
    d = L(3, 0);
  if (!(a > 0 && b > 0 && c > 0 && d > 0)) return 1;
  return Math.min(Math.min(a, c) / Math.max(a, c), Math.min(b, d) / Math.max(b, d));
}
function pgReset() {
  clearTimeout(_pgT);
  pgMode = false;
  pgKeyOn(false);
  pgEd = null;
  pgQ = null;
  pgShape = null;
  const z = document.getElementById('sfZoomCtl');
  if (z) z.style.display = '';
}
// (v318.13) where an unsure find's corner handles start, in a photo iw x ih: its outline, or on a busy surface the
// photo's own rectangle 3% in
function pgStartQ(found, iw, ih) {
  if (!(found.flick > PG_BUSY)) return found.q;
  const m = 0.03;
  return [
    [iw * m, ih * m],
    [iw * (1 - m), ih * m],
    [iw * (1 - m), ih * (1 - m)],
    [iw * m, ih * (1 - m)],
  ];
}
// a fresh photo: srcImg holds it at working size, f35 is its lens (0 if unknown)
// (v318.36: the page found in the JOBS worker, pgFindOff, the busy state and the photo's preview kept meanwhile;
// resolves true once it has gone on, false when the photo is stale by then (stale(): a newer picture, 20-image-input).
// What follows the find, pgFound, is as it was)
function pgBegin(f35, stale) {
  pgOrig = srcImg;
  pgF35 = f35 || 0;
  pgQ = null;
  pgShape = null;
  pgHint = null;
  const img = pgOrig;
  return pgFindOff(img).then(function (found) {
    if ((stale && stale()) || pgOrig !== img || srcImg !== img) return false;
    // (v320: the wait's first step done, the page found; the sections next, or the corner handles first: pgOpen)
    waitAt(2);
    segBusySet(false);
    holdTime('New photo: find the page', function () {
      pgFound(found);
    });
    return true;
  });
}
function pgFound(found) {
  pgSteep = found.tier === 'sure' && pgKeystone(found.q) < PG_STEEP;
  if (found.tier === 'sure') {
    pgReveal(found.q, true);
    return;
  }
  if (found.tier === 'unsure') {
    // (v318.13) on a busy surface (marble, a grained or patterned table: the finder's pgFlicker just outside its
    // outline over PG_BUSY) its unsure outline was 17–30% of the photo's diagonal off on all 6 of the maintainer's
    // marble photos, where the photo's own rectangle 3% in was 5–7% off: the handles start there. Its good unsure
    // finds (the benchmark's zentangle, 0.7% off) sit on tables flickering 3.8–4.3
    pgOpen(
      pgStartQ(found, pgOrig.naturalWidth || pgOrig.width, pgOrig.naturalHeight || pgOrig.height),
      found.why,
      'first',
    );
    return;
  }
  // (v285) a photo from a camera (it says what lens took it) that the finder left as it was: Straighten is offered on
  // a line of its own, as after Keep as is. Not for a page already square to the camera, one that fills the photo,
  // or a picture too small or unreadable to look at; digital art and scans carry no lens, so stay quiet as before.
  if (pgF35 > 0 && ['square', 'fills', 'small', 'read'].indexOf(found.why) < 0) pgHint = 'kept';
  pgProceed(null);
}
// show the outline for a moment, "Straightening the page…" (flattening the page meanwhile, after a frame so it shows
// first), then build from the flat page: by itself when the finder is sure (auto), and after Straighten when it wasn't
// (v313: what's about to happen shows before it does, as when it's sure)
function pgReveal(q, auto) {
  pgOpen(q, '', 'reveal');
  const t0 = Date.now(),
    ed = pgEd,
    g = loadGen,
    live = function () {
      return pgMode && pgEd === ed && g === loadGen;
    };
  clearTimeout(_pgT);
  afterPaint(function () {
    if (!live()) return;
    let flat = null;
    try {
      flat = holdTime('New photo: straighten', function () {
        return pgFlat(q);
      });
    } catch (e) {}
    clearTimeout(_pgT);
    _pgT = setTimeout(
      function () {
        if (live()) pgApply(q, auto, flat);
      },
      Math.max(0, 750 - (Date.now() - t0)),
    );
  });
}
// build the sections from srcImg as it is now
function pgProceed(msg) {
  pgMode = false;
  pgKeyOn(false);
  pgEd = null;
  const z = document.getElementById('sfZoomCtl');
  if (z) z.style.display = '';
  rot90 = 0;
  tilt = 0;
  cropRect = null;
  // (v318.35) Treat hatching as one section starts off for a camera photo (straightened, lens known, or kept as
  // photographed) and on for a scan, a download or a PDF page, unless it was set for this picture (hatchSet)
  if (!hatchSet) hatchOne = !(pgQ || pgF35 > 0 || pgHint === 'kept');
  // (v318.14: with a paint between its steps, segRun; a newer photo takes over from it)
  note('Detecting sections\u2026');
  segThen(
    function () {
      return processSrcAsync(true);
    },
    processSrc,
    function (ok) {
      if (!ok) return;
      sfmode = 'review';
      editMode = 'toggle';
      hasEdits = false;
      geoUndoOK();
      resetZoom();
      renderControls();
      render();
      note(msg || metaText());
    },
    function (err) {
      note(
        errNote('Couldn’t process that photo. Try it again, or another photo.', 'Processing a photo', err),
      );
    },
  );
}
function pgFlat(q) {
  const iw = pgOrig.naturalWidth || pgOrig.width,
    ih = pgOrig.naturalHeight || pgOrig.height,
    sh = pgShapeOf(q, iw, ih, pgF35, pgShape);
  return { img: pgWarp(pgOrig, q, sh.aspect), shape: sh.shape };
}
// straightened: the controls say so on their own line (with Undo and Adjust corners), so no toast covers it
function pgApply(q, auto, flat) {
  if (!flat) {
    try {
      flat = pgFlat(q);
    } catch (e) {
      pgProceed('Couldn\u2019t straighten that photo, so it\u2019s used as taken.');
      return;
    }
  }
  srcImg = flat.img;
  pgQ = q.map(function (p) {
    return p.slice();
  });
  // (v308) a straightened photo is found at Sensitivity 7: thin gaps between shapes are kept (the otter's hand and
  // body ran together at 5), unless Sensitivity was set by hand for this photo
  if (!sensUser) adaptC = SENS_PHOTO;
  pgProceed(pgOrig ? null : 'Page straightened.');
  sayLive(auto ? 'Straightened the page so the drawing is flat and square.' : 'Page straightened.');
  // (v318.13: a steep photo's note is the warning box's now, segQuality 'steep', with Choose another photo: no toast
  // to stack with it)
}
function pgUndo() {
  if (!pgOrig || !pgQ) return;
  okGeom(function () {
    srcImg = pgOrig;
    pgQ = null;
    // (v310.2: "Page kept as photographed · Straighten", as after Cancel: the way back to it is one tap, also on the
    // quick check, whose Adjust photo is behind Fix sections)
    pgHint = 'kept';
    if (!sensUser) adaptC = 9;
    pgProceed('Back to the photo as taken.');
  });
}
// open the corner editor. how: 'reveal' (showing what's about to happen), 'first' (unsure, fresh photo), 'adjust'
function pgOpen(q, why, how) {
  if (!pgOrig) return;
  // (v320: the wait's list steps aside while the handles wait for the person; segRun brings it back)
  waitPause(true);
  const iw = pgOrig.naturalWidth || pgOrig.width,
    ih = pgOrig.naturalHeight || pgOrig.height;
  if (!q) {
    const m = 0.08;
    q = [
      [iw * m, ih * m],
      [iw * (1 - m), ih * m],
      [iw * (1 - m), ih * (1 - m)],
      [iw * m, ih * (1 - m)],
    ];
  }
  pgMode = true;
  pgEd = {
    q: q.map(function (p) {
      return p.slice();
    }),
    why: why,
    how: how,
    drag: -1,
    k: 1,
    pad: 0,
    // (v328 review: and the page's shape as it was: a shape chip tapped, then Cancel, had kept the new shape, and the
    // guide's photo no longer fitted its sections on reopening)
    back: how === 'adjust' ? { src: srcImg, w: cv.width, h: cv.height, shape: pgShape } : null,
  };
  if (how !== 'adjust') labels = null;
  _rg = null;
  pgKeyOn(how !== 'reveal');
  resetZoom();
  const z = document.getElementById('sfZoomCtl');
  if (z) z.style.display = 'none';
  const sc = Math.min(1, 1400 / Math.max(iw, ih)),
    dw = Math.round(iw * sc),
    dh = Math.round(ih * sc),
    pad = Math.round(Math.max(dw, dh) * 0.08);
  pgEd.k = sc;
  pgEd.pad = pad;
  cv.width = dw + 2 * pad;
  cv.height = dh + 2 * pad;
  renderControls();
  pgDraw();
}
function pgDraw() {
  if (!pgMode || !pgEd || !cv) return;
  sizeCanvas();
  const e = pgEd,
    k = e.k,
    pad = e.pad,
    iw = pgOrig.naturalWidth || pgOrig.width,
    ih = pgOrig.naturalHeight || pgOrig.height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#202124';
  ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(pgOrig, pad, pad, iw * k, ih * k);
  const P = e.q.map(function (p) {
    return [pad + p[0] * k, pad + p[1] * k];
  });
  ctx.fillStyle = 'rgba(0,0,0,.45)';
  ctx.beginPath();
  ctx.rect(0, 0, cv.width, cv.height);
  ctx.moveTo(P[0][0], P[0][1]);
  for (let i = 3; i >= 0; i--) ctx.lineTo(P[i][0], P[i][1]);
  ctx.closePath();
  ctx.fill('evenodd');
  const lw = Math.max(2, cv.width / 300);
  ctx.lineJoin = 'round';
  ctx.beginPath();
  P.forEach(function (p, i) {
    i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]);
  });
  ctx.closePath();
  ctx.strokeStyle = 'rgba(0,0,0,.6)';
  ctx.lineWidth = lw * 2.6;
  ctx.stroke();
  ctx.strokeStyle = '#ffd84a';
  ctx.lineWidth = lw;
  ctx.stroke();
  if (e.how !== 'reveal') {
    const r = Math.max(9, cv.width / 55);
    P.forEach(function (p, i) {
      ctx.beginPath();
      ctx.arc(p[0], p[1], r, 0, 6.283);
      ctx.fillStyle = i === e.drag ? 'rgba(255,216,74,.45)' : 'rgba(255,255,255,.25)';
      ctx.fill();
      ctx.lineWidth = lw * 1.3;
      ctx.strokeStyle = '#ffd84a';
      ctx.stroke();
      // (the corner the keys move, while the picture has the keyboard: a second ring)
      if (e.kb && i === (e.sel || 0) && document.activeElement === cv) {
        ctx.beginPath();
        ctx.arc(p[0], p[1], r * 1.6, 0, 6.283);
        ctx.lineWidth = lw;
        ctx.strokeStyle = '#fff';
        ctx.stroke();
      }
    });
  }
  // a magnifier beside the finger while a corner is dragged (the finger hides the corner itself)
  if (e.drag >= 0) {
    const c = P[e.drag],
      R = Math.round(cv.width * 0.13),
      Z = 3;
    let lx = c[0],
      ly = c[1] - 2.3 * R;
    if (ly < R + 4) ly = c[1] + 2.3 * R;
    lx = Math.max(R + 4, Math.min(cv.width - R - 4, lx));
    ly = Math.max(R + 4, Math.min(cv.height - R - 4, ly));
    ctx.save();
    ctx.beginPath();
    ctx.arc(lx, ly, R, 0, 6.283);
    ctx.clip();
    ctx.fillStyle = '#202124';
    ctx.fillRect(lx - R, ly - R, 2 * R, 2 * R);
    const sx = (c[0] - pad) / k,
      sy = (c[1] - pad) / k,
      half = R / (Z * k);
    ctx.drawImage(pgOrig, sx - half, sy - half, 2 * half, 2 * half, lx - R, ly - R, 2 * R, 2 * R);
    ctx.strokeStyle = '#ffd84a';
    ctx.lineWidth = Math.max(1.5, lw * 0.8);
    ctx.beginPath();
    ctx.moveTo(lx - R, ly);
    ctx.lineTo(lx + R, ly);
    ctx.moveTo(lx, ly - R);
    ctx.lineTo(lx, ly + R);
    ctx.stroke();
    ctx.restore();
    ctx.beginPath();
    ctx.arc(lx, ly, R, 0, 6.283);
    ctx.lineWidth = lw * 1.5;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
  }
}
// (v328 review) the corners by keyboard, as the finished-page photo's (24-page-photo finEdKey): the picture takes the
// keyboard while they show; the arrow keys move the ringed corner (Shift for bigger steps), Space or Enter the next
function pgKeyOn(on) {
  if (!cv) return;
  if (on) {
    cv.tabIndex = 0;
    // (v328 review 2: an application, so a screen reader passes the arrow keys on, as the zones' keyboard does)
    cv.setAttribute('role', 'application');
    cv.setAttribute(
      'aria-label',
      'The page’s corners: arrow keys move the ringed corner, Space moves to the next',
    );
    if (!cv._pgKey) {
      cv._pgKey = true;
      cv.addEventListener('keydown', pgKey);
      cv.addEventListener('focus', function () {
        if (pgMode && pgEd) pgDraw();
      });
      cv.addEventListener('blur', function () {
        if (pgMode && pgEd) pgDraw();
      });
    }
  } else if (cv.getAttribute('role') === 'application' && !zoneEditOn()) {
    // (the picture's own name back: it had gone for the rest of the visit)
    cv.removeAttribute('tabindex');
    cv.setAttribute('role', 'img');
    cv.setAttribute('aria-label', 'Colouring page');
  }
}
function pgKey(e) {
  const E = pgEd;
  if (!pgMode || !E || E.how === 'reveal' || !pgOrig) return;
  const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key],
    iw = pgOrig.naturalWidth || pgOrig.width,
    ih = pgOrig.naturalHeight || pgOrig.height;
  E.kb = true;
  if (d) {
    e.preventDefault();
    const st = Math.max(iw, ih) * (e.shiftKey ? 0.05 : 0.01),
      i = E.sel || 0,
      p = E.q[i];
    E.q[i] = [Math.max(0, Math.min(iw, p[0] + d[0] * st)), Math.max(0, Math.min(ih, p[1] + d[1] * st))];
    pgDraw();
    clearTimeout(E.kt);
    E.kt = setTimeout(function () {
      if (pgEd === E) renderControls();
    }, 250);
  } else if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault();
    E.sel = ((E.sel || 0) + 1) % 4;
    pgDraw();
    sayLive(['Top left', 'Top right', 'Bottom right', 'Bottom left'][E.sel] + ' corner');
  }
}
function pgPtr(e, kind) {
  if (!pgEd || pgEd.how === 'reveal') return;
  const P = evCanvas(e),
    k = pgEd.k,
    pad = pgEd.pad;
  if (kind === 'down') {
    let bi = -1,
      bd = Math.max(30, cv.width * 0.08);
    pgEd.q.forEach(function (p, i) {
      const d = Math.hypot(pad + p[0] * k - P.x, pad + p[1] * k - P.y);
      if (d < bd) {
        bd = d;
        bi = i;
      }
    });
    if (bi < 0) return;
    try {
      cv.setPointerCapture(e.pointerId);
    } catch (_) {}
    const p = pgEd.q[bi];
    pgEd.drag = bi;
    pgEd.off = [pad + p[0] * k - P.x, pad + p[1] * k - P.y];
    pgDraw();
    return;
  }
  if (pgEd.drag < 0) return;
  if (kind === 'move') {
    pgEd.q[pgEd.drag] = [(P.x + pgEd.off[0] - pad) / k, (P.y + pgEd.off[1] - pad) / k];
    pgDraw();
    return;
  }
  pgEd.drag = -1;
  try {
    cv.releasePointerCapture(e.pointerId);
  } catch (_) {}
  pgDraw();
  renderControls();
}
function pgControls() {
  const e = pgEd;
  if (!e) return;
  if (e.how === 'reveal') {
    ctlEl.innerHTML = '<div class="sfpgnote">Straightening the page…</div>';
    return;
  }
  const ok = pgConvex(e.q) && pgAngles(e.q)[0] > 20,
    // (v318.32) a fresh photo the finder was unsure of: Straighten is the main button once the corners are a convex
    // quad inside the photo covering most of it (over half); else Keep as is stays first, as v313 had it (U1-3: a
    // tester tapped the big button on a right outline and kept a skewed page)
    sure = e.how === 'first' && ok && pgCovers(e.q),
    sh = pgShape || 'auto',
    chip = function (v, l) {
      return '<button data-v="' + v + '" class="' + (sh === v ? 'on' : '') + '">' + l + '</button>';
    };
  ctlEl.innerHTML =
    '<div class="sfpgnote">' +
    esc(PG_WHY[e.why] || PG_WHY.adjust) +
    // (v318.32) and that the yellow corners can be dragged, which only Adjust corners had said (U1-3)
    (e.how === 'first' && e.why !== 'none' ? ' ' + PG_DRAG : '') +
    '</div>' +
    '<div class="sfpgshape"><span>Page shape</span><div class="segs" id="sfPgShape">' +
    chip('auto', 'Auto') +
    chip('letter', 'Letter') +
    chip('a4', 'A4') +
    chip('square', 'Square') +
    '</div></div>' +
    (ok
      ? ''
      : '<div class="sfpgnote warn">Those corners cross over. Drag them back to the page’s four corners.</div>') +
    // (v313) a fresh photo the finder wasn't sure of: Keep as is first, as what it found may not be the page (a page
    // under a lamp, its bright half taken for it); Straighten shows what it's about to do, then does it
    (e.how === 'first' && !sure
      ? '<div class="sfpgbtns first"><button id="sfPgNo" class="btn-primary">Keep as is</button>' +
        '<button id="sfPgGo" class="btn-soft"' +
        (ok ? '' : ' disabled') +
        '>Straighten</button></div>'
      : e.how === 'first'
        ? '<div class="sfpgbtns first"><button id="sfPgGo" class="btn-primary">Straighten</button>' +
          '<button id="sfPgNo" class="btn-soft">Keep as is</button></div>'
        : '<div class="sfpgbtns"><button id="sfPgGo" class="btn-primary"' +
          (ok ? '' : ' disabled') +
          '>Straighten</button><button id="sfPgNo" class="btn-soft">Cancel</button></div>');
  document.getElementById('sfPgShape').addEventListener('click', function (ev) {
    const b = ev.target.closest('button');
    if (!b) return;
    pgShape = b.dataset.v === 'auto' ? null : b.dataset.v;
    renderControls();
  });
  document.getElementById('sfPgGo').addEventListener('click', function () {
    if (!pgConvex(pgEd.q)) return;
    if (pgEd.how === 'first') {
      pgReveal(pgOrder(pgEd.q), false);
      return;
    }
    // (v318 polish: said, and drawn, before the page is flattened and its sections found again)
    const ed = pgEd,
      q = pgOrder(ed.q);
    this.disabled = true;
    this.textContent = 'Straightening\u2026';
    afterPaint(function () {
      if (pgMode && pgEd === ed) pgApply(q, false);
    });
  });
  document.getElementById('sfPgNo').addEventListener('click', function () {
    if (pgEd.how === 'first') {
      srcImg = pgOrig;
      pgQ = null;
      pgHint = 'kept';
      pgProceed(null);
    } else pgCancelAdjust();
  });
}
function pgCancelAdjust() {
  geoCancel();
  const b = pgEd && pgEd.back;
  pgMode = false;
  pgKeyOn(false);
  pgEd = null;
  if (b) {
    srcImg = b.src;
    cv.width = b.w;
    cv.height = b.h;
    if (b.shape !== undefined) pgShape = b.shape;
  }
  const z = document.getElementById('sfZoomCtl');
  if (z) z.style.display = '';
  _rg = null;
  renderControls();
  if (labels) render();
}
// Adjust photo -> Straighten page / Adjust corners
function pgAdjust() {
  if (!pgOrig || !labels) return;
  okGeom(function () {
    let q = pgQ,
      why = 'adjust';
    if (!q) {
      let f = { tier: 'none' };
      try {
        f = pgFind(pgOrig);
      } catch (e) {}
      // (v308) the photo's own rectangle, 3% in, when the finder's guess is the drawing rather than a page: a photo
      // the page fills, or plain paper whose outline came from the drawing (Ben's pages: the drawing's diagonal band,
      // which Straighten stretched into a strip)
      if (
        f.tier === 'none' &&
        (f.why === 'fills' || f.why === 'drawing' || (f.why === 'plain' && f.kind === 'drawing'))
      ) {
        const iw = pgOrig.naturalWidth || pgOrig.width,
          ih = pgOrig.naturalHeight || pgOrig.height,
          m = 0.03;
        q = [
          [iw * m, ih * m],
          [iw * (1 - m), ih * m],
          [iw * (1 - m), ih * (1 - m)],
          [iw * m, ih * (1 - m)],
        ];
        why = 'none';
      }
      // (the finder's best guess at the corners, when it has one worth starting from: v285)
      else if (f.q && (f.tier !== 'none' || ['plain', 'fills', 'square'].indexOf(f.why) >= 0)) {
        q = f.q;
        why = f.tier === 'sure' ? 'adjust' : f.tier === 'unsure' ? f.why : 'none';
      } else why = 'none';
    }
    pgOpen(q, why, 'adjust');
  });
}

// a coloured version photographed at an angle (Photo colour pattern): flatten its page first, so lining it up
// with the picture is only a matter of place and size. Returns the flat page, or null to use the photo as it is.
function pgRefFlat(img, f35) {
  try {
    const w0 = img.naturalWidth || img.width,
      h0 = img.naturalHeight || img.height,
      s = Math.min(1, 1600 / Math.max(w0, h0));
    let src = img;
    if (s < 1) {
      src = document.createElement('canvas');
      src.width = Math.round(w0 * s);
      src.height = Math.round(h0 * s);
      const g = src.getContext('2d');
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = 'high';
      // (in halving steps: a phone photo's noise evened out in Safari too, as when a photo is read, v296)
      drawShrunk(g, img, src.width, src.height);
    }
    const f = pgFind(src),
      out =
        f.tier === 'sure' ? pgWarp(src, f.q, pgShapeOf(f.q, src.width, src.height, f35, null).aspect) : null;
    if (src !== img) freeCanvas(src);
    if (!out) return null;
    out._pgFlat = true;
    return out;
  } catch (e) {
    return null;
  }
}
