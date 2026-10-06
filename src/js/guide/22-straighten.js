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
function pgFind(img) {
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
  const cands = [];
  [
    ['drawing', con, otsu(con, 40, 200)],
    ['paper', paperS, otsu(paperS, 90, 240)],
  ].forEach(function (M) {
    const m = new Uint8Array(N);
    for (let i = 0; i < N; i++) m[i] = M[1][i] > M[2] ? 1 : 0;
    const r = pgRegion(m, gw, gh);
    if (!r) return;
    const f = pgQuad(r, gw, gh, B, w, h);
    if (!f) return;
    f.kind = M[0];
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
    f.q = f.q.map(function (p) {
      return [p[0] / sc, p[1] / sc];
    });
    cands.push(f);
  });
  if (!cands.length) return { tier: 'none', why: 'nothing' };
  cands.forEach(function (f) {
    pgJudge(f, iw, ih);
  });
  // the drawing's own outline wins a tie: on a spiral pad or an open book the paper runs on past the drawing's sheet
  const rank = { sure: 3, unsure: 2, none: 1 };
  cands.sort(function (a, b) {
    return (
      rank[b.tier] - rank[a.tier] || (b.kind === 'drawing') - (a.kind === 'drawing') || b.score - a.score
    );
  });
  cands[0].others = cands.slice(1).map(function (f) {
    return { kind: f.kind, tier: f.tier, why: f.why };
  });
  return cands[0];
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
  const reg = new Uint8Array(N),
    ring = new Uint8Array(N);
  let area = 0;
  for (let i = 0; i < N; i++)
    if (!out[i]) {
      reg[i] = 1;
      area++;
    }
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
  return { m: reg, ring: ring, area: area };
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
// how sure we are, and why not
function pgJudge(f, iw, ih) {
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
let _pgT = 0;
function pgReset() {
  clearTimeout(_pgT);
  pgMode = false;
  pgEd = null;
  pgQ = null;
  pgShape = null;
  const z = document.getElementById('sfZoomCtl');
  if (z) z.style.display = '';
}
// a fresh photo: srcImg holds it at working size, f35 is its lens (0 if unknown)
function pgBegin(f35) {
  pgOrig = srcImg;
  pgF35 = f35 || 0;
  pgQ = null;
  pgShape = null;
  pgHint = null;
  let found = { tier: 'none', why: 'read' };
  try {
    found = pgFind(pgOrig);
  } catch (e) {}
  // sure: show the outline for a moment (flattening the page meanwhile), then build from the flat page
  if (found.tier === 'sure') {
    pgOpen(found.q, '', 'reveal');
    const t0 = Date.now();
    _pgT = setTimeout(function () {
      if (!(pgMode && pgEd && pgEd.how === 'reveal')) return;
      let flat = null;
      try {
        flat = pgFlat(found.q);
      } catch (e) {}
      _pgT = setTimeout(
        function () {
          if (pgMode && pgEd && pgEd.how === 'reveal') pgApply(found.q, true, flat);
        },
        Math.max(0, 750 - (Date.now() - t0)),
      );
    }, 60);
    return;
  }
  if (found.tier === 'unsure') {
    pgOpen(found.q, found.why, 'first');
    return;
  }
  // (v285) a photo from a camera (it says what lens took it) that the finder left as it was: Straighten is offered on
  // a line of its own, as after Keep as is. Not for a page already square to the camera, one that fills the photo,
  // or a picture too small or unreadable to look at; digital art and scans carry no lens, so stay quiet as before.
  if (pgF35 > 0 && ['square', 'fills', 'small', 'read'].indexOf(found.why) < 0) pgHint = 'kept';
  pgProceed(null);
}
// build the sections from srcImg as it is now
function pgProceed(msg) {
  pgMode = false;
  pgEd = null;
  const z = document.getElementById('sfZoomCtl');
  if (z) z.style.display = '';
  rot90 = 0;
  tilt = 0;
  cropRect = null;
  processSrc();
  sfmode = 'review';
  editMode = 'toggle';
  hasEdits = false;
  geoUndoOK();
  resetZoom();
  renderControls();
  render();
  note(msg || metaText());
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
}
function pgUndo() {
  if (!pgOrig || !pgQ) return;
  okGeom(function () {
    srcImg = pgOrig;
    pgQ = null;
    if (!sensUser) adaptC = 9;
    pgProceed('Back to the photo as taken.');
  });
}
// open the corner editor. how: 'reveal' (showing what's about to happen), 'first' (unsure, fresh photo), 'adjust'
function pgOpen(q, why, how) {
  if (!pgOrig) return;
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
    back: how === 'adjust' ? { src: srcImg, w: cv.width, h: cv.height } : null,
  };
  if (how !== 'adjust') labels = null;
  _rg = null;
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
    sh = pgShape || 'auto',
    chip = function (v, l) {
      return '<button data-v="' + v + '" class="' + (sh === v ? 'on' : '') + '">' + l + '</button>';
    };
  ctlEl.innerHTML =
    '<div class="sfpgnote">' +
    esc(PG_WHY[e.why] || PG_WHY.adjust) +
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
    '<div class="sfpgbtns"><button id="sfPgGo" class="btn-primary"' +
    (ok ? '' : ' disabled') +
    '>Straighten</button><button id="sfPgNo" class="btn-soft">' +
    (e.how === 'first' ? 'Keep as is' : 'Cancel') +
    '</button></div>';
  document.getElementById('sfPgShape').addEventListener('click', function (ev) {
    const b = ev.target.closest('button');
    if (!b) return;
    pgShape = b.dataset.v === 'auto' ? null : b.dataset.v;
    renderControls();
  });
  document.getElementById('sfPgGo').addEventListener('click', function () {
    if (!pgConvex(pgEd.q)) return;
    pgApply(pgOrder(pgEd.q), false);
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
  pgEd = null;
  if (b) {
    srcImg = b.src;
    cv.width = b.w;
    cv.height = b.h;
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
      if (f.tier === 'none' && (f.why === 'fills' || (f.why === 'plain' && f.kind === 'drawing'))) {
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
