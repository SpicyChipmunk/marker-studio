// Test harness: loads the real application script from index.html into a
// sandboxed Node context, with lightweight shims for the browser APIs the
// script touches at load time. This lets tests exercise the ACTUAL shipped
// code (no copies, no drift) without a browser.
//
// Scope today: reaches the ~127 top-level functions of the collection /
// palette / matching subsystem. The section-finder core (segmentation,
// save/load) is sealed in a nested closure and is NOT reachable here yet;
// exposing it needs a small, additive test-export seam in index.html.
// NOTE: values returned from the app run in a separate realm, so objects and
// arrays carry that realm's prototypes. When asserting on a returned array/object
// with deepEqual, normalise first (e.g. [...arr] or JSON round-trip). Primitives
// (numbers, strings) compare fine directly.
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const INDEX = fileURLToPath(new URL('../index.html', import.meta.url));

function extractAppScript(html) {
  const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  if (!scripts.length) throw new Error('No <script> found in index.html');
  return scripts.sort((a, b) => b.length - a.length)[0]; // the app is the largest
}

// A universal no-op stub: any property access or call returns another stub, so
// unknown browser calls made at load time silently do nothing instead of throwing.
function makeStub() {
  return new Proxy(function () {}, {
    get: (t, k) => {
      if (k === 'then' || k === Symbol.iterator) return undefined;
      if (k === Symbol.toPrimitive) return () => 0;
      if (k === 'length') return 0;
      return stub;
    },
    apply: () => stub, construct: () => stub, set: () => true, has: () => true,
  });
}
let stub = makeStub();

// --- Minimal, lossless canvas + Image polyfill -------------------------------
// Enough for lmapURL() to encode the label map to a data URL and for that URL
// to be decoded back through Image + drawImage + getImageData. It stores raw
// RGBA bytes (no real PNG codec) so pixels round-trip exactly — which is all the
// label-map persistence logic depends on.
class FakeImageData { constructor(data, w, h) { this.data = data; this.width = w; this.height = h; } }
function makeCanvas() {
  let buf = null, cw = 0, ch = 0;
  const c2d = {
    createImageData: (w, h) => new FakeImageData(new Uint8ClampedArray(w * h * 4), w, h),
    putImageData: (im) => { buf = im.data; cw = im.width; ch = im.height; },
    getImageData: (x, y, w, h) => new FakeImageData((buf ? buf.slice() : new Uint8ClampedArray(w * h * 4)), w, h),
    drawImage: (img) => { if (img && img.__buf) { buf = img.__buf; cw = img.__w; ch = img.__h; } },
    setTransform: () => {}, fillRect: () => {}, clearRect: () => {}, save: () => {}, restore: () => {},
    translate: () => {}, scale: () => {}, rotate: () => {}, set fillStyle(v) {}, get fillStyle() { return '#000'; },
  };
  return {
    get width() { return cw; }, set width(v) { cw = v; },
    get height() { return ch; }, set height(v) { ch = v; },
    getContext: () => c2d,
    toDataURL: () => {
      const b64 = buf ? Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength).toString('base64') : '';
      return 'data:image/x-mslabels;' + cw + ',' + ch + ',' + b64;
    },
  };
}
class FakeImage {
  constructor() { this.__buf = null; this.__w = 0; this.__h = 0; this._onload = null; }
  set onload(fn) { this._onload = fn; } get onload() { return this._onload; }
  set src(v) {
    const m = /^data:image\/x-mslabels;(\d+),(\d+),(.*)$/.exec(String(v));
    if (m) { this.__w = +m[1]; this.__h = +m[2]; this.width = this.__w; this.height = this.__h;
      this.__buf = Uint8ClampedArray.from(Buffer.from(m[3], 'base64')); }
    if (this._onload) this._onload(); // app sets onload before src, so sync-fire is fine
  }
}
// document that returns a real canvas for createElement('canvas'), stub otherwise:
const fakeDocument = new Proxy({}, {
  get: (t, k) => (k === 'createElement' ? (tag) => (tag === 'canvas' ? makeCanvas() : stub) : stub),
});

let cached = null;
export function loadApp() {
  if (cached) return cached;
  const html = fs.readFileSync(INDEX, 'utf8');
  const js = extractAppScript(html);
  const ctx = {
    console, Math, Date, JSON, Array, Object, String, Number, Boolean, RegExp,
    Set, Map, Promise, parseInt, parseFloat, isNaN, isFinite,
    Uint8Array, Uint8ClampedArray, Int32Array, Int16Array, Float32Array, Float64Array,
    ImageData: function (a, w, h) { return { data: a, width: w, height: h }; },
    setTimeout: () => 0, clearTimeout: () => 0, setInterval: () => 0, clearInterval: () => 0,
    requestAnimationFrame: () => 0,
    document: fakeDocument, navigator: { userAgent: 'node' }, location: { href: '', search: '' },
    localStorage: stub, indexedDB: stub, Image: FakeImage,
    fetch: () => Promise.reject(new Error('no network in tests')),
    addEventListener: () => {}, removeEventListener: () => {},
    matchMedia: () => ({ matches: false, addEventListener: () => {} }),
    getComputedStyle: () => stub, alert: () => {}, confirm: () => true, prompt: () => null,
    atob: (s) => s, btoa: (s) => s, URL: stub, Blob: function () {}, File: function () {},
    FileReader: function () { return stub; },
    // Browser auto-creates globals for elements with these ids; shim them:
    SF: stub, mCollection: stub, savedOverlay: stub,
  };
  ctx.window = ctx; ctx.self = ctx; ctx.globalThis = ctx;
  ctx.__MS_TEST = true; // activates the (otherwise-inert) test-export seam in index.html
  vm.createContext(ctx);
  vm.runInContext(js, ctx, { timeout: 10000, filename: 'index.html#app' });
  cached = ctx;
  return ctx;
}

export const app = loadApp();
// Section-finder core (segmentation, undo, save/load) exposed via the seam:
export const core = app.__mstest;
