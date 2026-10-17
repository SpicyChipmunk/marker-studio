// Headless Chromium (Playwright, a dev dependency) for the two things Node can't do here: drawing text in a real font
// and encoding/decoding JPEG. Launched once, on first use. Results are cached by the callers (outside the repo).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
let _br = null,
  _pg = null;

export async function page() {
  if (_pg) return _pg;
  if (!process.env.PLAYWRIGHT_BROWSERS_PATH && fs.existsSync('/opt/pw-browsers'))
    process.env.PLAYWRIGHT_BROWSERS_PATH = '/opt/pw-browsers';
  const { chromium } = await import('playwright');
  _br = await chromium.launch();
  _pg = await _br.newPage();
  await _pg.setContent('<!doctype html><html><body></body></html>');
  // the app's own two fonts (npm dev dependencies, so the same everywhere): Fraunces for titles, Hanken Grotesk for the
  // rest (a page's small print, URL, watermark)
  const font = (rel) => fs.readFileSync(path.join(ROOT, 'node_modules', rel)).toString('base64');
  await _pg.evaluate(
    async ([serif, sans]) => {
      const load = async (name, b64) => {
        const bin = atob(b64),
          a = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
        const f = new FontFace(name, a.buffer);
        await f.load();
        document.fonts.add(f);
      };
      await load('BenchSerif', serif);
      await load('BenchSans', sans);
    },
    [
      font('@fontsource-variable/fraunces/files/fraunces-latin-wght-normal.woff2'),
      font('@fontsource-variable/hanken-grotesk/files/hanken-grotesk-latin-wght-normal.woff2'),
    ],
  );
  return _pg;
}

export async function close() {
  if (_br) await _br.close();
  _br = null;
  _pg = null;
}

const b64of = (u8) => Buffer.from(u8.buffer, u8.byteOffset, u8.byteLength).toString('base64');
const u8of = (b64) => new Uint8Array(Buffer.from(b64, 'base64'));

// text drawn at scale k (page px -> canvas px): returns {w, h, alpha (Uint8, w*h), cx, cy} where (cx, cy) is the
// canvas position of the text's anchor (the alignment point on the text's vertical middle)
export async function textMask(spec, k) {
  const pg = await page();
  const r = await pg.evaluate(
    ([spec, k]) => {
      const fam = /bold/i.test(spec.font)
        ? '700 '
        : /serif|lora/i.test(spec.font) && !/sans/i.test(spec.font)
          ? '500 '
          : '400 ';
      const face =
        /lora|serif/i.test(spec.font) && !/sans|poppins/i.test(spec.font) ? 'BenchSerif' : 'BenchSans';
      const px = spec.size * k,
        fontStr = fam + px + 'px ' + face;
      const c0 = document.createElement('canvas').getContext('2d');
      c0.font = fontStr;
      const m = c0.measureText(spec.str),
        tw = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
      const th = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent,
        ang = ((spec.angle || 0) * Math.PI) / 180;
      const pad = Math.ceil(px * 0.1) + 2,
        diag = Math.ceil(Math.hypot(tw, th)) + 2 * pad;
      const w = ang ? diag : Math.ceil(tw) + 2 * pad,
        h = ang ? diag : Math.ceil(th) + 2 * pad;
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const g = c.getContext('2d');
      g.font = fontStr;
      g.fillStyle = '#000';
      g.translate(w / 2, h / 2);
      g.rotate(-ang);
      // (centred on the box: the anchor is worked out below from the alignment)
      g.fillText(spec.str, -tw / 2 + m.actualBoundingBoxLeft, -th / 2 + m.actualBoundingBoxAscent);
      const d = g.getImageData(0, 0, w, h).data,
        a = new Uint8Array(w * h);
      for (let i = 0; i < w * h; i++) a[i] = d[i * 4 + 3];
      let s = '';
      for (let i = 0; i < a.length; i += 0x8000)
        s += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000));
      return { w, h, tw, b64: btoa(s) };
    },
    [spec, k],
  );
  const alpha = u8of(r.b64);
  // the text's centre: its anchor (x, y) is the centre, the right edge or the left edge of the unrotated text, on its
  // vertical middle
  const cx =
    spec.x * k + (spec.angle || spec.align === 'center' ? 0 : spec.align === 'right' ? -r.tw / 2 : r.tw / 2);
  return { w: r.w, h: r.h, alpha, x0: Math.round(cx - r.w / 2), y0: Math.round(spec.y * k - r.h / 2) };
}

// JPEG round trip of an RGBA image at quality q: {d (RGBA), bytes}
export async function jpegRoundTrip(W, H, rgba, q) {
  const pg = await page();
  const out = await pg.evaluate(
    async ([W, H, b64, q]) => {
      const bin = atob(b64),
        arr = new Uint8ClampedArray(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      const c = document.createElement('canvas');
      c.width = W;
      c.height = H;
      const g = c.getContext('2d');
      g.putImageData(new ImageData(arr, W, H), 0, 0);
      const url = c.toDataURL('image/jpeg', q);
      const im = new Image();
      await new Promise((r) => {
        im.onload = r;
        im.src = url;
      });
      g.drawImage(im, 0, 0);
      const back = g.getImageData(0, 0, W, H).data;
      let s = '';
      for (let i = 0; i < back.length; i += 0x8000)
        s += String.fromCharCode.apply(null, back.subarray(i, i + 0x8000));
      return { b64: btoa(s), bytes: Math.round((url.length - 23) * 0.75) };
    },
    [W, H, b64of(rgba), q],
  );
  return { d: new Uint8ClampedArray(Buffer.from(out.b64, 'base64')), bytes: out.bytes };
}

// a photo file (JPEG/PNG bytes) decoded as the app's own loading does: turned by its EXIF orientation, then shrunk to
// at most maxSide on its long side with high-quality smoothing (fitSource, 20-image-input). {W, H, d (RGBA), ow, oh}
export async function decodeFit(bytes, maxSide = 2400) {
  const pg = await page();
  const r = await pg.evaluate(
    async ([b64, maxSide]) => {
      const bin = atob(b64),
        a = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
      const bm = await createImageBitmap(new Blob([a]), { imageOrientation: 'from-image' });
      const s = Math.min(1, maxSide / Math.max(bm.width, bm.height)),
        W = Math.max(1, Math.round(bm.width * s)),
        H = Math.max(1, Math.round(bm.height * s));
      const c = document.createElement('canvas');
      c.width = W;
      c.height = H;
      const g = c.getContext('2d');
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = 'high';
      g.fillStyle = '#fff';
      g.fillRect(0, 0, W, H);
      g.drawImage(bm, 0, 0, W, H);
      const d = g.getImageData(0, 0, W, H).data;
      let out = '';
      for (let i = 0; i < d.length; i += 0x8000)
        out += String.fromCharCode.apply(null, d.subarray(i, i + 0x8000));
      return { W, H, ow: bm.width, oh: bm.height, b64: btoa(out) };
    },
    [Buffer.from(bytes).toString('base64'), maxSide],
  );
  return { W: r.W, H: r.H, ow: r.ow, oh: r.oh, d: new Uint8ClampedArray(Buffer.from(r.b64, 'base64')) };
}

// an RGBA image as JPEG file bytes (for the self-test's stand-in photos)
export async function jpegBytes(W, H, rgba, q) {
  const pg = await page();
  const b64 = await pg.evaluate(
    async ([W, H, b64, q]) => {
      const bin = atob(b64),
        arr = new Uint8ClampedArray(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      const c = document.createElement('canvas');
      c.width = W;
      c.height = H;
      c.getContext('2d').putImageData(new ImageData(arr, W, H), 0, 0);
      return c.toDataURL('image/jpeg', q).split(',')[1];
    },
    [W, H, Buffer.from(rgba.buffer, rgba.byteOffset, rgba.byteLength).toString('base64'), q],
  );
  return Buffer.from(b64, 'base64');
}
