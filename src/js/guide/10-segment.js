/* ---- colour ---- */
function hsl2rgb(h, s, l) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12,
    a = s * Math.min(l, 1 - l),
    f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}
/* ---- threshold ---- */
function otsu(g, n) {
  const h = new Uint32Array(256);
  for (let i = 0; i < n; i++) h[g[i]]++;
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * h[t];
  let sB = 0,
    wB = 0,
    mx = 0,
    thrLo = 127,
    thrHi = 127;
  for (let t = 0; t < 256; t++) {
    wB += h[t];
    if (!wB) continue;
    const wF = n - wB;
    if (!wF) break;
    sB += t * h[t];
    const mB = sB / wB,
      mF = (sum - sB) / wF,
      v = wB * wF * (mB - mF) * (mB - mF);
    if (v > mx) {
      mx = v;
      thrLo = thrHi = t;
    } else if (v === mx && mx > 0) thrHi = t;
  }
  return (thrLo + thrHi) >> 1;
}
function autoStretch(g, n) {
  const h = new Uint32Array(256);
  for (let i = 0; i < n; i++) h[g[i]]++;
  let lo = 0,
    hi = 255,
    acc = 0;
  const cut = n * 0.01;
  for (let t = 0; t < 256; t++) {
    acc += h[t];
    if (acc > cut) {
      lo = t;
      break;
    }
  }
  acc = 0;
  for (let t = 255; t >= 0; t--) {
    acc += h[t];
    if (acc > cut) {
      hi = t;
      break;
    }
  }
  if (hi - lo < 8) return g;
  const out = new Uint8Array(n),
    sc = 255 / (hi - lo);
  for (let i = 0; i < n; i++) {
    let v = (g[i] - lo) * sc;
    out[i] = v < 0 ? 0 : v > 255 ? 255 : v | 0;
  }
  return out;
}
function adaptiveInk(g, n) {
  const w1 = W + 1,
    ii = new Float64Array(w1 * (H + 1));
  for (let y = 0; y < H; y++) {
    let rs = 0;
    const o = (y + 1) * w1,
      po = y * w1;
    for (let x = 0; x < W; x++) {
      rs += g[y * W + x];
      ii[o + x + 1] = ii[po + x + 1] + rs;
    }
  }
  const r = Math.max(10, (Math.min(W, H) / 20) | 0),
    C = adaptC,
    ink = new Uint8Array(n);
  for (let y = 0; y < H; y++) {
    const y0 = y > r ? y - r : 0,
      y1 = y + r < H ? y + r : H - 1,
      a0 = y0 * w1,
      a1 = (y1 + 1) * w1,
      ry = y * W;
    for (let x = 0; x < W; x++) {
      const x0 = x > r ? x - r : 0,
        x1 = x + r < W ? x + r : W - 1;
      const mean =
        (ii[a1 + x1 + 1] - ii[a0 + x1 + 1] - ii[a1 + x0] + ii[a0 + x0]) / ((x1 - x0 + 1) * (y1 - y0 + 1));
      if (g[ry + x] < mean - C) ink[ry + x] = 1;
    }
  }
  return ink;
}
// camera noise and paper grain: measure how much pixels jitter against their neighbours, and smooth just
// enough to stop the jitter reading as ink. Clean line art measures near zero and is left untouched.
function noiseLevel(g) {
  const d = [],
    st = Math.max(1, Math.floor(Math.sqrt((W * H) / 60000)));
  for (let y = 1; y < H - 1; y += st)
    for (let x = 1; x < W - 1; x += st) {
      const p = y * W + x,
        m = (g[p - 1] + g[p + 1] + g[p - W] + g[p + W]) * 0.25,
        v = g[p];
      if (v < 160) continue;
      d.push(Math.abs(v - m));
    }
  if (d.length < 100) return 0;
  d.sort(function (a, b) {
    return a - b;
  });
  return d[(d.length * 0.5) | 0];
}
function boxBlur(g) {
  const out = new Uint8Array(g.length);
  for (let y = 0; y < H; y++) {
    const y0 = y > 0 ? y - 1 : 0,
      y1 = y < H - 1 ? y + 1 : H - 1;
    for (let x = 0; x < W; x++) {
      const x0 = x > 0 ? x - 1 : 0,
        x1 = x < W - 1 ? x + 1 : W - 1;
      let s = 0,
        c = 0;
      for (let yy = y0; yy <= y1; yy++) {
        const r = yy * W;
        for (let xx = x0; xx <= x1; xx++) {
          s += g[r + xx];
          c++;
        }
      }
      out[y * W + x] = (s / c + 0.5) | 0;
    }
  }
  return out;
}
function denoise(g) {
  const nl = noiseLevel(g);
  const passes = nl < 3 ? 0 : nl < 7 ? 1 : 2;
  for (let i = 0; i < passes; i++) g = boxBlur(g);
  return g;
}
// grainy paper and camera noise leave specks of 'ink' that chop the paper into crumbs: drop any ink blob too
// small to be part of a line (lines are long and connected; a dot eye is still far bigger than a speck)
function despeckle(L) {
  const n = W * H,
    sp = Math.max(4, Math.round(n / 500000) * 2),
    seen = new Uint8Array(n),
    st = new Int32Array(n),
    blob = new Int32Array(sp + 1);
  let gone = 0;
  for (let p = 0; p < n; p++) {
    if (L[p] !== -1 || seen[p]) continue;
    let sn = 0,
      bn = 0,
      big = false;
    st[sn++] = p;
    seen[p] = 1;
    while (sn > 0) {
      const q = st[--sn];
      if (!big) {
        if (bn <= sp) blob[bn++] = q;
        if (bn > sp) big = true;
      }
      const x = q % W,
        y = (q / W) | 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= H) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= W) continue;
          const r = yy * W + xx;
          if (L[r] === -1 && !seen[r]) {
            seen[r] = 1;
            st[sn++] = r;
          }
        }
      }
    }
    if (!big) {
      for (let k = 0; k < bn; k++) L[blob[k]] = 0;
      gone += bn;
    }
  }
  return gone;
}
/* ---- connected components ---- */
function applyBg(fresh) {
  const n = comps.length,
    bgRel = 0.6 - (bgTrim / 100) * 0.5;
  if (fresh || !(bgMaxB > 0)) {
    let mx = 0;
    for (let l = 1; l < n; l++) {
      const c = comps[l];
      if (c && !c.merged && c.bpx > mx) mx = c.bpx;
    }
    bgMaxB = mx;
  }
  for (let l = 1; l < n; l++) {
    const c = comps[l];
    if (!c || c.merged) continue;
    c.bg = bgMaxB > 0 && c.bpx >= bgRel * bgMaxB;
  }
  let pl = 0;
  for (let l = 1; l < n; l++) {
    const c = comps[l];
    if (c && c.page && !c.merged) {
      pl = l;
      break;
    }
  }
  const pg = pl ? comps[pl] : null;
  if (pg) {
    pg.bg = true;
    for (let l = 1; l < n; l++) {
      const c = comps[l];
      if (!c || c.merged || l === pl) continue;
      if (c.bpx > 0 || c.cx < pg.x0 || c.cx > pg.x1 || c.cy < pg.y0 || c.cy > pg.y1) c.bg = true;
    }
  }
}
// a phone photo that shows the table around the page: the paper's blank margin is one big region that rings
// the drawing on all four sides, brighter than what lies outside it. That margin (and the table) is background.
function findPage() {
  const n = comps.length,
    N = W * H;
  let best = 0,
    ba = 0;
  for (let l = 1; l < n; l++) {
    const c = comps[l];
    if (!c || c.merged || c.bg || c.bpx > 0) continue;
    if (c.area > ba) {
      ba = c.area;
      best = l;
    }
  }
  if (!best || ba < N * 0.08 || !gray || gray.length !== N) return;
  const c = comps[best];
  if (c.x1 - c.x0 < W * 0.5 || c.y1 - c.y0 < H * 0.5) return;
  const skip = function (q) {
    const v = labels[q];
    if (v === -1) return true;
    const k = comps[v];
    return !k || k.bg || k.area < Math.max(40, N * 0.00002);
  };
  const S = 24,
    side = function (fn) {
      let hit = 0,
        tot = 0;
      for (let i = 1; i <= S; i++) {
        const f = 0.2 + (0.6 * i) / (S + 1),
          r = fn(f);
        if (r < 0) continue;
        tot++;
        if (r === best) hit++;
      }
      return tot ? hit / tot : 0;
    };
  const walk = function (x, y, dx, dy) {
    while (x >= 0 && y >= 0 && x < W && y < H) {
      const q = y * W + x;
      if (!skip(q)) return labels[q];
      x += dx;
      y += dy;
    }
    return -1;
  };
  const sides = [
    side(function (f) {
      return walk(0, (f * H) | 0, 1, 0);
    }),
    side(function (f) {
      return walk(W - 1, (f * H) | 0, -1, 0);
    }),
    side(function (f) {
      return walk((f * W) | 0, 0, 0, 1);
    }),
    side(function (f) {
      return walk((f * W) | 0, H - 1, 0, -1);
    }),
  ];
  if (Math.min.apply(null, sides) < 0.7) return;
  // brighter than outside: the page, not a drawn frame on the same paper
  let si = 0,
    ni = 0,
    so = 0,
    no = 0;
  const st = Math.max(1, Math.floor(Math.sqrt(N / 200000)));
  for (let y = 0; y < H; y += st)
    for (let x = 0; x < W; x += st) {
      const q = y * W + x,
        v = labels[q];
      if (v === best) {
        si += gray[q];
        ni++;
      } else if (v > 0 && comps[v] && comps[v].bg) {
        so += gray[q];
        no++;
      }
    }
  if (!ni || !no || si / ni - so / no < 18) return;
  c.page = true;
}
function segQuality() {
  if (!labels || !comps) return { ok: true };
  var px = W * H,
    ink = 0;
  for (var i = 0; i < px; i++) if (labels[i] === -1) ink++;
  var inkFrac = px ? ink / px : 0,
    N = 0,
    tiny = 0,
    tc = Math.max(20, px * 0.00002);
  for (var l = 1; l < comps.length; l++) {
    var c = comps[l];
    if (!c || c.merged) continue;
    N++;
    if (c.area < tc && !c.bg) tiny++;
  }
  var tinyFrac = N ? tiny / N : 0;
  if (inkFrac < 0.02 && N < 5)
    return {
      ok: false,
      code: 'faint',
      msg: 'Barely any outlines were detected \u2014 the image may be blank, faint, or low-contrast.',
      tip: 'Use line art with dark outlines on a light background, or turn on Enhance (under Adjust photo).',
    };
  if (N < 2)
    return {
      ok: false,
      code: 'few',
      msg: 'Couldn\u2019t find distinct sections to colour.',
      tip: 'This works best with solid outlines separating white areas.',
    };
  if (inkFrac > 0.55)
    return {
      ok: false,
      code: 'dark',
      msg: 'Most of the image is dark \u2014 this looks like a photo or heavily shaded drawing rather than outlines.',
      tip: 'Try high-contrast line art on white, or crop to just the drawing.',
    };
  if (tinyFrac > 0.8)
    return {
      ok: false,
      code: 'noisy',
      msg: 'Found a lot of tiny fragments \u2014 usually a photo or textured image rather than clean line art.',
      tip: 'Use line art with solid outlines, or raise Min section size in Edit sections.',
    };
  return { ok: true };
}
function labelCells() {
  const n = W * H,
    stack = new Int32Array(n);
  comps = [null];
  let cur = 0;
  for (let p = 0; p < n; p++) {
    if (labels[p] !== 0) continue;
    cur++;
    let sp = 0;
    stack[sp++] = p;
    labels[p] = cur;
    let area = 0,
      bpx = 0,
      sx = 0,
      sy = 0,
      mny = 1e9,
      mxy = -1,
      mnx = 1e9,
      mxx = -1;
    while (sp > 0) {
      const q = stack[--sp];
      area++;
      const x = q % W,
        y = (q / W) | 0;
      sx += x;
      sy += y;
      if (y < mny) mny = y;
      if (y > mxy) mxy = y;
      if (x < mnx) mnx = x;
      if (x > mxx) mxx = x;
      if (x === 0 || y === 0 || x === W - 1 || y === H - 1) bpx++;
      if (x > 0) {
        const r = q - 1;
        if (labels[r] === 0) {
          labels[r] = cur;
          stack[sp++] = r;
        }
      }
      if (x < W - 1) {
        const r = q + 1;
        if (labels[r] === 0) {
          labels[r] = cur;
          stack[sp++] = r;
        }
      }
      if (y > 0) {
        const r = q - W;
        if (labels[r] === 0) {
          labels[r] = cur;
          stack[sp++] = r;
        }
      }
      if (y < H - 1) {
        const r = q + W;
        if (labels[r] === 0) {
          labels[r] = cur;
          stack[sp++] = r;
        }
      }
    }
    comps.push({
      area: area,
      bg: false,
      bpx: bpx,
      cx: sx / area,
      cy: sy / area,
      h: mxy - mny,
      x0: mnx,
      y0: mny,
      x1: mxx,
      y1: mxy,
    });
  }
  applyBg(true);
  findPage();
  applyBg(false);
  secColor = new Array(comps.length);
  for (let l = 1; l < comps.length; l++) {
    const hh = (l * 137.508) % 248,
      s = 22 + ((l * 37) % 14),
      li = 61 + ((l * 29) % 13);
    secColor[l] = hsl2rgb(hh, s, li);
  }
  secState = new Uint8Array(comps.length);
  colored = new Uint8Array(comps.length);
  heldSh = {};
  progAt = { s: 0, e: 0 };
  celebrated = false;
  rgbOut = new Uint8ClampedArray(n * 4);
  imgData = new ImageData(rgbOut, W, H);
}
function segment() {
  const n = W * H;
  // (where the zones were, pixel by pixel, to place them again on the new sections: 34-zones)
  zonePixCapture();
  labels = new Int32Array(n);
  if (enhance) {
    const src = denoise(autoStretch(gray, n)),
      ink = adaptiveInk(src, n);
    for (let i = 0; i < n; i++) labels[i] = ink[i] ? -1 : 0;
  } else {
    const thr = otsu(gray, n);
    for (let i = 0; i < n; i++) labels[i] = gray[i] < thr ? -1 : 0;
  }
  despeckle(labels);
  labelCells();
  adj = null;
  edgeDist = null;
  labelPts = null;
  texField = null;
  segWarn = segQuality();
  // sections were found afresh, so their numbers mean different shapes now: per-section choices can't carry over
  locks = {};
  shadeFlat = {};
  _flatVer++;
  _segFresh = true;
  _origKeys = {};
  _lostKeys = {};
  _gone = {};
}
function render() {
  _rg = null;
  positionPhoto();
  positionSun();
  if (zoneEl) zoneEl.innerHTML = '';
  if (sfmode === 'review' && popOpen()) closeSwatchPop(false);
  if (!labels) return;
  sizeCanvas();
  const n = W * H,
    mv = minPx(),
    cn = new Uint8Array(comps.length);
  let cnt = 0;
  for (let l = 1; l < comps.length; l++) {
    const c = comps[l];
    let ct = false;
    if (c && !c.merged) {
      const s = secState[l];
      ct = s === 1 ? true : s === 2 ? false : !c.bg && c.area >= mv;
    }
    if (ct) {
      cn[l] = 1;
      cnt++;
    }
  }
  const lite = new Array(comps.length);
  for (let p = 0, j = 0; p < n; p++, j += 4) {
    const l = labels[p];
    let col;
    if (l === -1) col = LINE;
    else if (l === mergeSel) col = HILITE;
    else {
      // (v288: paler tints, still one per section, so a gap that let two shapes run together shows, without looking
      // like a colour plan)
      if (cn[l]) {
        col = lite[l];
        if (!col) {
          const c0 = secColor[l];
          col = lite[l] = [(c0[0] + 357) / 2.4, (c0[1] + 357) / 2.4, (c0[2] + 357) / 2.4];
        }
      } else if (comps[l].bg) col = TEAL;
      else col = MAG;
    }
    rgbOut[j] = col[0];
    rgbOut[j + 1] = col[1];
    rgbOut[j + 2] = col[2];
    rgbOut[j + 3] = 255;
  }
  ctx.putImageData(imgData, 0, 0);
  countEl.textContent = cnt + ' section' + (cnt === 1 ? '' : 's');
  renderTools();
  {
    const bb = document.getElementById('sfBuild');
    if (bb && bb.textContent.indexOf('Building') < 0) bb.disabled = cnt < 2;
  }
  // an edit may have made (or undone) section edits still to be built: the line under the name says so, and the bar
  saveStatus();
  edBarSync();
  outlineMerge();
}
