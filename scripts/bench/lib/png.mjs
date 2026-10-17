// A minimal PNG writer (RGB, 8-bit) and the benchmark's pictures: a page's truth, and the app's sections over it
// coloured by class (scripts/bench). Pictures go outside the repo with the rest of the outputs.
import fs from 'node:fs';
import zlib from 'node:zlib';

const CRC = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
const crc = (b) => {
  let c = -1;
  for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};
function chunk(type, data) {
  const len = Buffer.alloc(4),
    tc = Buffer.concat([Buffer.from(type), data]),
    c = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  c.writeUInt32BE(crc(tc));
  return Buffer.concat([len, tc, c]);
}
export function writePNG(file, W, H, rgb) {
  const raw = Buffer.alloc((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) {
    raw[y * (W * 3 + 1)] = 0;
    Buffer.from(rgb.buffer, rgb.byteOffset + y * W * 3, W * 3).copy(raw, y * (W * 3 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  fs.writeFileSync(
    file,
    Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk('IHDR', ihdr),
      chunk('IDAT', zlib.deflateSync(raw, { level: 6 })),
      chunk('IEND', Buffer.alloc(0)),
    ]),
  );
}
const hue = (l) => {
  const h = (l * 137.508) % 360,
    s = 0.55,
    v = 0.92,
    c = v * s,
    x = c * (1 - Math.abs(((h / 60) % 2) - 1)),
    m = v - c;
  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
};
// truth map: each section its own colour; margin light grey, frame interior pale yellow, ambiguous hatched pink, ink black
export function truthPicture(meta, truth) {
  const { W, H } = meta,
    out = new Uint8Array(W * H * 3),
    amb = new Set(meta.ambiguous || []),
    col = new Set(meta.coloured || []);
  for (let p = 0; p < W * H; p++) {
    const l = truth[p];
    let c = [0, 0, 0];
    if (l > 0) {
      const t = meta.tag[l];
      c =
        t === 'margin'
          ? [232, 232, 232]
          : t === 'frameInterior'
            ? [255, 244, 200]
            : t === 'surroundings'
              ? [200, 220, 235]
              : hue(l);
      if (amb.has(l) && ((p % W) + ((p / W) | 0)) % 8 < 2) c = [255, 60, 160];
      if (col.has(l) && ((p % W) - ((p / W) | 0) + 9999) % 10 < 2) c = [60, 60, 60];
    }
    out[p * 3] = c[0];
    out[p * 3 + 1] = c[1];
    out[p * 3 + 2] = c[2];
  }
  return out;
}
// found over truth: every truth section coloured by its class; the app's ink black; spurious counted sections red
// stripes; the app's own section borders a thin dark line
const CLS = {
  'correct:matched': [170, 225, 170],
  'correct:bg:margin': [235, 235, 235],
  'correct:bg:surroundings': [215, 230, 240],
  'expected:bg:frameInterior': [255, 244, 200],
  'info:split:nearTangent': [255, 200, 230],
  'info:tinyDropped': [200, 200, 255],
};
const DEF = {
  merged: [230, 40, 40],
  split: [255, 150, 0],
  shattered: [150, 60, 200],
  'bgDropped:edge': [40, 110, 255],
  'bgDropped:inner': [0, 60, 160],
  missed: [255, 0, 255],
  marginCounted: [120, 70, 20],
  'coloured:keptNotDone': [250, 220, 60],
};
export function classPicture(meta, truth, r, sc) {
  const { W, H } = meta,
    out = new Uint8Array(W * H * 3),
    per = sc._per,
    spur = new Set(sc._spurious || []);
  for (let p = 0; p < W * H; p++) {
    const f = r.labels[p],
      t = truth[p],
      x = p % W,
      y = (p / W) | 0;
    let c = [255, 255, 255];
    if (t > 0 && per.has(t)) {
      const k = per.get(t).cls || '';
      c =
        CLS[k] ||
        (k.startsWith('defect:')
          ? DEF[k.slice(7)] || (k.includes('coloured:lost') ? [255, 90, 120] : [255, 0, 0])
          : k.startsWith('info:')
            ? [210, 210, 255]
            : [220, 220, 220]);
    } else if (t === -1) c = [245, 245, 245];
    if (f >= 1 && spur.has(f) && (x + y) % 6 < 3) c = [200, 0, 0];
    if (f < 1) c = [c[0] * 0.25, c[1] * 0.25, c[2] * 0.25];
    else if (
      (x > 0 && r.labels[p - 1] >= 1 && r.labels[p - 1] !== f) ||
      (y > 0 && r.labels[p - W] >= 1 && r.labels[p - W] !== f)
    )
      c = [80, 80, 80];
    out[p * 3] = c[0];
    out[p * 3 + 1] = c[1];
    out[p * 3 + 2] = c[2];
  }
  return out;
}
export function greyToRGB(g, n) {
  const o = new Uint8Array(n * 3);
  for (let i = 0; i < n; i++) o[i * 3] = o[i * 3 + 1] = o[i * 3 + 2] = g[i];
  return o;
}
// side by side, scaled down by an integer factor (area average)
export function sideBySide(list, W, H, k = 1) {
  const w = Math.floor(W / k),
    h = Math.floor(H / k),
    gap = 8,
    out = new Uint8Array((w * list.length + gap * (list.length - 1)) * h * 3).fill(255),
    OW = w * list.length + gap * (list.length - 1);
  list.forEach((im, i) => {
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++)
        for (let c = 0; c < 3; c++) {
          let s = 0;
          for (let dy = 0; dy < k; dy++)
            for (let dx = 0; dx < k; dx++) s += im[((y * k + dy) * W + x * k + dx) * 3 + c];
          out[(y * OW + i * (w + gap) + x) * 3 + c] = s / (k * k);
        }
  });
  return { W: OW, H: h, rgb: out };
}
export function crop(rgb, W, H, x0, y0, w, h, zoom = 1) {
  const out = new Uint8Array(w * zoom * h * zoom * 3);
  for (let y = 0; y < h * zoom; y++)
    for (let x = 0; x < w * zoom; x++) {
      const sx = Math.min(W - 1, Math.max(0, x0 + Math.floor(x / zoom))),
        sy = Math.min(H - 1, Math.max(0, y0 + Math.floor(y / zoom)));
      for (let c = 0; c < 3; c++) out[(y * w * zoom + x) * 3 + c] = rgb[(sy * W + sx) * 3 + c];
    }
  return { W: w * zoom, H: h * zoom, rgb: out };
}
