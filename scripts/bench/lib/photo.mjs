// Photo-like versions of a page (scripts/bench): the page on a table seen through a phone camera (25 mm equivalent),
// with the preview set's look (tables, paper tint and grain, light gradient, a hand's shadow and arm, vignette, colour
// temperature, blur, noise, sharpening halo) plus motion blur and a curled edge; JPEG through Chromium. A photo knows
// exactly where every one of its pixels came from on the page (toPage), so truth can follow the app's own quad.
import { rng } from './raster.mjs';

export function homog(src, dst) {
  // 8x8 solve: dst ~ H src
  const A = [],
    b = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i],
      [u, v] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }
  for (let c = 0; c < 8; c++) {
    let p = c;
    for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]];
    [b[c], b[p]] = [b[p], b[c]];
    for (let r = 0; r < 8; r++) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      for (let k = c; k < 8; k++) A[r][k] -= f * A[c][k];
      b[r] -= f * b[c];
    }
  }
  return b.map((v, i) => v / A[i][i]);
}
export function apply(Hm, x, y) {
  const den = Hm[6] * x + Hm[7] * y + 1;
  return [(Hm[0] * x + Hm[1] * y + Hm[2]) / den, (Hm[3] * x + Hm[4] * y + Hm[5]) / den];
}

// the page's corners in a W x H photo: tilt (top away), yaw, roll in degrees; size = page height share of the photo
export function corners(W, H, o, aspect) {
  const f = (25 / 43.27) * Math.hypot(W, H),
    tx = ((o.tilt || 0) * Math.PI) / 180,
    ry = ((o.yaw || 0) * Math.PI) / 180,
    rz = ((o.roll || 0) * Math.PI) / 180;
  const hh = 5.5,
    hw = hh * aspect,
    Z = ((2 * hh) / (o.size || 0.75)) * (f / H);
  const proj = (X, Y) => {
    let x = X,
      y = Y * Math.cos(tx),
      z = -Y * Math.sin(tx);
    [x, z] = [x * Math.cos(ry) + z * Math.sin(ry), -x * Math.sin(ry) + z * Math.cos(ry)];
    [x, y] = [x * Math.cos(rz) - y * Math.sin(rz), x * Math.sin(rz) + y * Math.cos(rz)];
    z += Z;
    return [W / 2 + (o.dx || 0) * W + (f * x) / z, H / 2 + (o.dy || 0) * H + (f * y) / z];
  };
  return [proj(-hw, -hh), proj(hw, -hh), proj(hw, hh), proj(-hw, hh)];
}

function smoothNoise(W, H, scale, r) {
  const gw = Math.max(2, Math.ceil(W / scale) + 2),
    gh = Math.max(2, Math.ceil(H / scale) + 2),
    g = new Float32Array(gw * gh);
  for (let i = 0; i < g.length; i++) g[i] = r();
  const out = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    const fy = y / scale,
      y0 = Math.floor(fy),
      ty = fy - y0,
      sy = ty * ty * (3 - 2 * ty);
    for (let x = 0; x < W; x++) {
      const fx = x / scale,
        x0 = Math.floor(fx),
        tx = fx - x0,
        sx = tx * tx * (3 - 2 * tx);
      const a = g[y0 * gw + x0],
        b = g[y0 * gw + x0 + 1],
        c = g[(y0 + 1) * gw + x0],
        d = g[(y0 + 1) * gw + x0 + 1];
      out[y * W + x] = a + (b - a) * sx + (c - a + (a - b - c + d) * sx) * sy;
    }
  }
  return out;
}
function background(kind, W, H, r) {
  const img = new Float32Array(W * H * 3);
  if (kind === 'wood' || kind === 'darkwood') {
    const base = kind === 'wood' ? [178, 136, 92] : [96, 62, 38],
      w1 = smoothNoise(W, H, 220, r),
      w2 = smoothNoise(W, H, 60, r),
      w3 = smoothNoise(W, H, 400, r),
      fine = smoothNoise(W, H, 3, r);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = y * W + x,
          warp = w1[i] * 60 + w2[i] * 12,
          grain = Math.sin((x + warp) * 0.045 + w3[i] * 4) * 0.5 + 0.5;
        let k = 0.82 + 0.18 * grain + 0.05 * (fine[i] - 0.5);
        if (Math.abs(((x * 0.996 + y * 0.09) % 700) - 350) < 3) k *= 0.65;
        for (let c = 0; c < 3; c++) img[i * 3 + c] = base[c] * k;
      }
  } else if (kind === 'cloth') {
    const base = [64, 70, 92],
      n1 = smoothNoise(W, H, 90, r),
      n2 = smoothNoise(W, H, 4, r);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = y * W + x,
          k =
            Math.sin(x * 1.6) * Math.sin(y * 1.6) * 0.08 + 0.92 + 0.15 * (n1[i] - 0.5) + 0.06 * (n2[i] - 0.5);
        for (let c = 0; c < 3; c++) img[i * 3 + c] = base[c] * k;
      }
  } else {
    const base = [226, 222, 214],
      n1 = smoothNoise(W, H, 150, r),
      n2 = smoothNoise(W, H, 5, r);
    for (let i = 0; i < W * H; i++) {
      const k = 1 + 0.05 * (n1[i] - 0.5) + 0.03 * (n2[i] - 0.5);
      for (let c = 0; c < 3; c++) img[i * 3 + c] = base[c] * k;
    }
  }
  return img;
}
function gaussBlur(img, W, H, ch, sigma) {
  const rad = Math.max(1, Math.ceil(sigma * 3)),
    k = [];
  let s = 0;
  for (let i = -rad; i <= rad; i++) {
    const v = Math.exp((-i * i) / (2 * sigma * sigma));
    k.push(v);
    s += v;
  }
  for (let i = 0; i < k.length; i++) k[i] /= s;
  const tmp = new Float32Array(img.length);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      for (let c = 0; c < ch; c++) {
        let a = 0;
        for (let i = -rad; i <= rad; i++) {
          const xx = Math.min(W - 1, Math.max(0, x + i));
          a += img[(y * W + xx) * ch + c] * k[i + rad];
        }
        tmp[(y * W + x) * ch + c] = a;
      }
  const out = new Float32Array(img.length);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      for (let c = 0; c < ch; c++) {
        let a = 0;
        for (let i = -rad; i <= rad; i++) {
          const yy = Math.min(H - 1, Math.max(0, y + i));
          a += tmp[(yy * W + x) * ch + c] * k[i + rad];
        }
        out[(y * W + x) * ch + c] = a;
      }
  return out;
}
const gauss = (r) => {
  let u = 0,
    v = 0;
  while (u === 0) u = r();
  while (v === 0) v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

// where the page lies in a W x H photo: true corners C, and toPage(x, y) -> [u, v] page px (or null off the page)
export function photoGeom(PW, PH, o) {
  const W = o.W || 1800,
    H = o.H || 2400,
    C = corners(W, H, o, PW / PH),
    Hi2p = homog(C, [
      [0, 0],
      [PW, 0],
      [PW, PH],
      [0, PH],
    ]);
  // a curled edge: page content near one edge is pulled towards it (the paper lifts away), most in the middle
  const curl = o.curl || null;
  const toPage = (x, y) => {
    let [u, v] = apply(Hi2p, x, y);
    if (curl) {
      const band = curl.band * (curl.edge === 'bottom' ? PH : PW);
      if (curl.edge === 'bottom' && v > PH - band) {
        const s = Math.sin((Math.PI * Math.min(PW, Math.max(0, u))) / PW),
          t = (v - (PH - band)) / band;
        v += curl.px * s * t * t;
      } else if (curl.edge === 'right' && u > PW - band) {
        const s = Math.sin((Math.PI * Math.min(PH, Math.max(0, v))) / PH),
          t = (u - (PW - band)) / band;
        u += curl.px * s * t * t;
      }
    }
    return u >= 0 && v >= 0 && u < PW && v < PH ? [u, v] : null;
  };
  return { W, H, C, toPage, Hi2p };
}

// page: {W, H, input (grey W*H or RGB W*H*3), rgb}; o: the photo's spec. Returns photoGeom's fields and d (RGBA)
export function makePhoto(page, o) {
  const PW = page.W,
    PH = page.H,
    G = photoGeom(PW, PH, o),
    { W, H, C, toPage } = G,
    r = rng(o.seed || 11);
  const src = page.input,
    ch = page.rgb ? 3 : 1,
    tint = [0.985, 0.975, 0.93];
  // pre-blur the page against aliasing when it shrinks
  const scale = Math.hypot(C[1][0] - C[0][0], C[1][1] - C[0][1]) / PW;
  let pg = new Float32Array(src.length);
  for (let i = 0; i < src.length; i++) pg[i] = src[i];
  if (scale < 1) pg = gaussBlur(pg, PW, PH, ch, 0.5 / scale);
  const bg = background(o.bg || 'wood', W, H, r);
  const img = new Float32Array(W * H * 3),
    alpha = new Float32Array(W * H);
  const grainA = smoothNoise(W, H, 2, r),
    grainB = smoothNoise(W, H, 40, r);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x,
        q = toPage(x + 0.5, y + 0.5);
      if (!q) continue;
      alpha[i] = 1;
      const u = Math.min(PW - 1.001, Math.max(0, q[0] - 0.5)),
        v = Math.min(PH - 1.001, Math.max(0, q[1] - 0.5)),
        x0 = u | 0,
        y0 = v | 0,
        fx = u - x0,
        fy = v - y0;
      const grain = 1 + 0.02 * (grainA[i] - 0.5) + 0.01 * (grainB[i] - 0.5);
      for (let c = 0; c < 3; c++) {
        const cc = ch === 3 ? c : 0,
          at = (yy, xx) => pg[(yy * PW + xx) * ch + cc];
        const top = at(y0, x0) * (1 - fx) + at(y0, x0 + 1) * fx,
          bot = at(y0 + 1, x0) * (1 - fx) + at(y0 + 1, x0 + 1) * fx;
        img[i * 3 + c] = (top * (1 - fy) + bot * fy) * tint[c] * grain;
      }
    }
  // soften the page's own edge (one pixel), drop shadow on the table
  const sh = gaussBlur(shift(alpha, W, H, 7, 10), W, H, 1, 9),
    al = gaussBlur(alpha, W, H, 1, 0.6);
  for (let i = 0; i < W * H; i++) {
    const a = al[i],
      k = 1 - 0.35 * sh[i];
    for (let c = 0; c < 3; c++) img[i * 3 + c] = img[i * 3 + c] * a + bg[i * 3 + c] * k * (1 - a);
  }
  // lighting: gradient, a hand's shadow (and arm), vignette, colour temperature
  let blob = null;
  if (o.shadow) {
    const [sx, sy, sr, sa] = o.shadow;
    blob = new Float32Array(W * H);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const d = Math.hypot(x - sx * W, y - sy * H) / (sr * Math.min(W, H));
        let b = Math.pow(Math.max(0, 1 - d), 1.5);
        if (o.arm != null && y > sy * H) {
          const cx = sx * W + (o.arm - sx) * W * Math.min(1, Math.max(0, (y - sy * H) / (H * 0.6)));
          if (Math.abs(x - cx) < 0.13 * W) b = Math.max(b, 0.9);
        }
        blob[y * W + x] = b;
      }
    blob = gaussBlur(blob, W, H, 1, 25);
    for (let i = 0; i < W * H; i++) blob[i] *= sa;
  }
  const temp = o.temp || [1, 1, 1],
    light = o.light == null ? 0.2 : o.light,
    lx = o.lightX == null ? 0.6 : o.lightX,
    ly = o.lightY == null ? 0.4 : o.lightY,
    vg = o.vig == null ? 0.12 : o.vig;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x,
        d2 = Math.pow(Math.hypot((x - W / 2) / W, (y - H / 2) / H) * 2, 2);
      const k = (1 - light * ((x / W) * lx + (y / H) * ly)) * (blob ? 1 - blob[i] : 1) * (1 - vg * d2);
      for (let c = 0; c < 3; c++) img[i * 3 + c] *= k * temp[c];
    }
  let out = img;
  if (o.blur) out = gaussBlur(out, W, H, 3, o.blur);
  if (o.motion) out = motionBlur(out, W, H, o.motion, ((o.motionAngle || 20) * Math.PI) / 180);
  if (o.noise)
    for (let i = 0; i < W * H; i++) {
      const g = gauss(r) * o.noise * 0.6;
      for (let c = 0; c < 3; c++) out[i * 3 + c] += gauss(r) * o.noise + g;
    }
  if (o.sharpen) {
    const bl = gaussBlur(out, W, H, 3, 1.6);
    for (let i = 0; i < out.length; i++) out[i] += o.sharpen * (out[i] - bl[i]);
  }
  const d = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    for (let c = 0; c < 3; c++) d[i * 4 + c] = out[i * 3 + c];
    d[i * 4 + 3] = 255;
  }
  return { ...G, d };
}
function shift(a, W, H, dx, dy) {
  const o = new Float32Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const xx = x - dx,
        yy = y - dy;
      if (xx >= 0 && yy >= 0 && xx < W && yy < H) o[y * W + x] = a[yy * W + xx];
    }
  return o;
}
function motionBlur(img, W, H, L, ang) {
  const out = new Float32Array(img.length),
    n = Math.max(2, Math.round(L * 2)),
    ca = Math.cos(ang),
    sa = Math.sin(ang);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      for (let c = 0; c < 3; c++) {
        let a = 0;
        for (let k = 0; k < n; k++) {
          const t = (k / (n - 1) - 0.5) * L,
            xx = Math.min(W - 1, Math.max(0, Math.round(x + t * ca))),
            yy = Math.min(H - 1, Math.max(0, Math.round(y + t * sa)));
          a += img[(yy * W + xx) * 3 + c];
        }
        out[(y * W + x) * 3 + c] = a / n;
      }
  return out;
}

// area-average shrink of an RGBA image to `side` on its long side (the finder's own copy is 720 px)
export function shrink(W, H, d, side) {
  const sc = Math.min(1, side / Math.max(W, H)),
    w = Math.max(1, Math.round(W * sc)),
    h = Math.max(1, Math.round(H * sc)),
    out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor((x * W) / w),
        x1 = Math.max(x0 + 1, Math.floor(((x + 1) * W) / w)),
        y0 = Math.floor((y * H) / h),
        y1 = Math.max(y0 + 1, Math.floor(((y + 1) * H) / h));
      let r = 0,
        g = 0,
        b = 0,
        n = 0;
      for (let yy = y0; yy < y1; yy++)
        for (let xx = x0; xx < x1; xx++) {
          const j = (yy * W + xx) * 4;
          r += d[j];
          g += d[j + 1];
          b += d[j + 2];
          n++;
        }
      const j = (y * w + x) * 4;
      out[j] = r / n;
      out[j + 1] = g / n;
      out[j + 2] = b / n;
      out[j + 3] = 255;
    }
  return { w, h, d: out, sc: w / W };
}
