// Match a colour's ranking (colour.js matchNearest, matchWord) and Palette › From photo's markers (picker.js
// extractPhotoPalette), and "Tap the white paper"'s spot (colour.js patchLin, paperSpot).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp, memoryStorage } from './harness.mjs';

function appWith(set) {
  const a = createApp({ localStorage: memoryStorage() });
  a.__eval('state.owned = new Set(); state.pool = null; state.ink = {}');
  if (set) a.__eval(`presetMkeys(MARKER_SETS.find((s) => s.n === ${JSON.stringify(set)})).forEach((k) => state.owned.add(k))`);
  return a;
}
// a seeded random number generator (mulberry32)
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('Match: the words for a match, on CIEDE2000 steps', () => {
  const a = appWith(null), w = a.__eval('matchWord');
  const cases = [[0, 'Near-exact'], [1.99, 'Near-exact'], [2, 'Very close'], [3.99, 'Very close'], [4, 'Close'], [6.99, 'Close'], [7, 'Rough'], [11.99, 'Rough'], [12, 'Loose'], [40, 'Loose']];
  for (const [d, word] of cases) assert.equal(w(d), word, String(d));
});

test('Match: nearest by eye among your markers (not dry); markers to buy only when at least 2 ΔE00 closer', () => {
  const a = appWith('Honolulu 48'), E = a.__eval, de = a.de2000;
  const LAB = E('LAB'), N = LAB.length;
  // one of your markers has run dry: it's listed with the ones you could buy, not as yours
  const dry = E('COLORS.findIndex((c, i) => isOwned(i))');
  E(`state.ink[mkey(${dry})] = 'dry'`);
  const usable = (i) => E(`isOwned(${i}) && !isDry(${i})`);
  const use = [];
  for (let i = 0; i < N; i++) if (usable(i)) use.push(i);
  const rnd = seeded(5), nearest = E('matchNearest');
  const targets = [LAB[dry]];
  for (let k = 0; k < 60; k++) targets.push([rnd() * 100, rnd() * 160 - 80, rnd() * 160 - 80]);
  let listed = 0, hidden = 0;
  for (const t of targets) {
    const all = [...Array(N).keys()].map((i) => ({ i, d: de(t, LAB[i]) })).sort((x, y) => x.d - y.d || x.i - y.i);
    // (v304: the markers to buy are of your brands, here Ohuhu; another brand's has its own place, test/v304-match)
    const mine = all.filter((o) => use.includes(o.i)).slice(0, 5), others = all.filter((o) => !use.includes(o.i) && E(`COLORS[${o.i}].brand`) === 'Ohuhu').slice(0, 3);
    const r = nearest(t);
    assert.deepEqual([...r.owned.map((o) => o.i)], mine.map((o) => o.i), 'your five nearest by eye');
    assert.deepEqual([...r.buy.map((o) => o.i)], others.filter((o) => o.d <= mine[0].d - 2).map((o) => o.i), 'to buy: clearly closer only');
    if (others[0].d < mine[0].d) (r.buy.length ? listed++ : hidden++);
  }
  assert.ok(listed > 0 && hidden > 0, `both cases seen: ${listed} listed, ${hidden} near-ties left out`);
  // the dry marker's own colour: it is the nearest to buy (0 away), and not among yours
  const r = nearest(LAB[dry]);
  assert.equal(r.buy[0].i, dry);
  assert.ok(!r.owned.some((o) => o.i === dry));
  // no markers: nothing of yours, the three nearest to buy
  const b = appWith(null), rb = b.__eval('matchNearest')([50, 20, -30]);
  assert.equal(rb.owned.length, 0);
  assert.equal(rb.buy.length, 3);
});

// an image for the harness's canvas: RGBA pixels as a data URL it reads back exactly (width × height ≤ 9000, so
// extractPhotoPalette doesn't scale it)
function img(a, w, h, fill) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) d.set([...fill(x, y), 255], (y * w + x) * 4);
  const im = new (a.__eval('Image'))();
  im.src = 'data:image/x-mslabels;' + w + ',' + h + ',' + Buffer.from(d.buffer).toString('base64');
  return im;
}
const hexRgb = (h) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16));
// a page: paper over the left 60%, colour patches in columns on the right
function page(a, paper, cols) {
  return img(a, 100, 60, (x, y) => (x < 60 ? hexRgb(paper) : hexRgb(cols[Math.min(cols.length - 1, Math.floor(((x - 60) / 40) * cols.length))])));
}
const COLS = ['#c0392b', '#c43d30', '#e67e22', '#f1c40f', '#27ae60', '#2980b9', '#8e44ad', '#6d4c41', '#1b1b1b', '#7f8c8d'];

test('From photo: n markers in play, every two at least 6 ΔE00 apart, no near-white for the paper, near-black and grey kept', () => {
  const a = appWith('Honolulu 120'), E = a.__eval, de = a.de2000, LAB = E('LAB'), LCH = E('LCH');
  const im = page(a, '#fbfbf8', COLS);
  for (const n of [4, 6, 8, 12, 16]) {
    const r = a.extractPhotoPalette(im, n), pal = [...r.markers];
    assert.equal(pal.length, n, `${n} markers`);
    assert.equal(r.labs.length, n);
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) assert.ok(de(LAB[pal[i]], LAB[pal[j]]) >= 6, `${n}: ${i},${j} apart`);
    assert.ok(pal.every((i) => E(`inPool(${i})`)), 'in play');
    assert.ok(!pal.some((i) => LAB[i][0] >= 90 && LCH[i][1] < 12), `${n}: no near-white`);
    if (n >= 12) {
      assert.ok(pal.some((i) => LAB[i][0] < 25), 'a near-black');
      assert.ok(pal.some((i) => LCH[i][1] < 12 && LAB[i][0] > 30 && LAB[i][0] < 75), 'a mid-grey');
    }
  }
});

test('From photo: a photo of few colours still gives n (a second marker each, as different as can be); the markers in play are the limit', () => {
  const a = appWith('Honolulu 120'), E = a.__eval, de = a.de2000, LAB = E('LAB');
  const two = img(a, 40, 20, (x) => (x < 20 ? [221, 51, 51] : [51, 153, 204]));
  const pal = [...a.extractPhotoPalette(two, 8).markers];
  assert.equal(pal.length, 8);
  assert.equal(new Set(pal).size, 8);
  // the first two are the photo's two colours
  const near = (hex) => { const t = a.hexToLab(hex); return E('COLORS.map((_, i) => i).filter((i) => inPool(i))').reduce((b, i) => (de(t, LAB[i]) < de(t, LAB[b]) ? i : b)); };
  assert.deepEqual(pal.slice(0, 2).sort(), [near('#dd3333'), near('#3399cc')].sort());
  // only three markers in play: three
  E("setPool(COLORS.map((_, i) => i).filter((i) => isOwned(i)).slice(0, 3))");
  assert.equal(a.extractPhotoPalette(two, 8).markers.length, 3);
  // a photo that is all white has nothing a marker can make
  E('setPool(null)');
  const white = a.extractPhotoPalette(img(a, 20, 20, () => [252, 252, 250]), 6);
  assert.equal(white.none, true);
  assert.equal(white.markers.length, 0);
});

test('From photo: with the paper tapped, the palette comes from the corrected photo (the grey paper becomes white and takes no marker)', () => {
  const a = appWith('Honolulu 120'), E = a.__eval, LAB = E('LAB'), LCH = E('LCH');
  const im = page(a, '#baafa0', COLS.slice(2, 8));
  const greyish = (pal) => pal.filter((i) => LCH[i][1] < 12 && LAB[i][0] > 55);
  const before = [...a.extractPhotoPalette(im, 6).markers];
  assert.ok(greyish(before).length >= 1, 'the grey paper as photographed takes a grey marker');
  const fix = E('lightFix([srgbToLin(0xba), srgbToLin(0xaf), srgbToLin(0xa0)])');
  const after = [...a.extractPhotoPalette(im, 6, fix).markers];
  assert.equal(after.length, 6);
  assert.deepEqual(greyish(after), [], 'the paper, now white, is skipped');
});

test('Tap the white paper: the spot is averaged in linear light; paper, white paper and a coloured or dark spot', () => {
  const a = appWith(null), E = a.__eval;
  // a 5 × 5 patch, half black and half white: the average in linear light is 0.5 (sRGB would say 0.21)
  const w = 5, h = 5, d = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) d.set(i % 2 ? [255, 255, 255, 255] : [0, 0, 0, 255], i * 4);
  const lin = [...E('patchLin')(d, w, h, 2, 2, 2)];
  assert.ok(Math.abs(lin[0] - 12 / 25) < 1e-9, String(lin));
  // see-through pixels don't count, and all see-through is nothing
  const t = new Uint8ClampedArray(4 * 4);
  assert.equal(E('patchLin')(t, 2, 2, 0, 0, 1), null);
  const spot = E('paperSpot'), lin8 = (r, g, b) => [r, g, b].map((v) => E(`srgbToLin(${v})`));
  const grey = spot(lin8(186, 176, 160));
  assert.ok(grey.fix && !grey.bad && grey.note === '');
  const white = spot(lin8(242, 242, 242));
  assert.equal(white.fix, null);
  assert.ok(!white.bad);
  assert.equal(white.note, 'That already looks white: nothing to correct.');
  for (const c of [[200, 50, 60], [15, 15, 15]]) {
    const r = spot(lin8(...c));
    assert.equal(r.bad, true, String(c));
    assert.equal(r.fix, null);
    assert.equal(r.note, 'That spot is too dark or too coloured to be white. Tap the paper or something else white.');
  }
});
