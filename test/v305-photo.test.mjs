// v305 (Palette › From photo): the photo's colours come from clustering in L*a*b* rather than median cut, ranked by
// share and colourfulness, so bright colours on a dark or cream ground keep their own hues; a grey subject among
// colours keeps its grey, a small bold colour in a grey scene is kept, a grey photo gives greys, and the same photo
// always gives the same palette. All pictures are drawn here, against Ben's collection (defaultOwned).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp, memoryStorage } from './harness.mjs';

function appBen() {
  const a = createApp({ localStorage: memoryStorage() });
  a.__eval('state.owned = defaultOwned(); state.pool = null; state.ink = {}');
  return a;
}
// a seeded random number generator (mulberry32)
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// a picture for the harness's canvas (at most 9000 pixels, so extractPhotoPalette reads it as it is)
const W = 114,
  H = 76;
function img(a, fill) {
  const d = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      d.set([...fill(x, y).map((v) => Math.max(0, Math.min(255, Math.round(v)))), 255], (y * W + x) * 4);
  const im = new (a.__eval('Image'))();
  im.src = 'data:image/x-mslabels;' + W + ',' + H + ',' + Buffer.from(d.buffer).toString('base64');
  return im;
}
const hexRgb = (h) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16));
const SIX = ['#e53935', '#fb8c00', '#fdd835', '#43a047', '#1e88e5', '#8e24aa'];
// six discs over 30% of a plain ground
function discs(a, ground) {
  const r = Math.sqrt((0.3 * W * H) / 6 / Math.PI);
  return img(a, (x, y) => {
    for (let k = 0; k < 6; k++) {
      const cx = ((k % 3) + 0.5) * (W / 3),
        cy = (Math.floor(k / 3) + 0.5) * (H / 2);
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) return hexRgb(SIX[k]);
    }
    return hexRgb(ground);
  });
}
const hueGap = (p, q) => Math.min(Math.abs(p - q), 360 - Math.abs(p - q));
function palette(a, im, n) {
  return [...a.extractPhotoPalette(im, n).markers];
}
// every one of the six colours has a marker of its own hue (within 25°) that is clearly coloured
function sixHues(a, pal, what) {
  const LCH = a.__eval('LCH'),
    COLORS = a.__eval('COLORS');
  for (const hex of SIX) {
    const t = a.hexToLab(hex),
      h = (Math.atan2(t[2], t[1]) * 180) / Math.PI;
    assert.ok(
      pal.some((i) => LCH[i][1] >= 25 && hueGap(LCH[i][2], (h + 360) % 360) <= 25),
      `${what}: a marker for ${hex} among ${pal.map((i) => COLORS[i].code).join(' ')}`,
    );
  }
}

test('From photo: six bright blocks, and six discs on a dark or a cream ground, give all six hues at 6 colours', () => {
  const a = appBen(),
    LCH = a.__eval('LCH');
  sixHues(
    a,
    palette(
      a,
      img(a, (x) => hexRgb(SIX[Math.floor((x * 6) / W)])),
      6,
    ),
    'blocks',
  );
  for (const ground of ['#1b1c22', '#efe6d2']) {
    const pal = palette(a, discs(a, ground), 6);
    sixHues(a, pal, ground);
    // the ground takes no marker: all six are clearly coloured (v304 gave white, black and browns for the dark one)
    assert.ok(
      pal.every((i) => LCH[i][1] >= 25),
      ground + ': no grey, black or brown',
    );
  }
});

test('From photo: a grey cat on grass under a blue sky keeps a grey at 4 colours', () => {
  const a = appBen(),
    LCH = a.__eval('LCH'),
    r = seeded(3);
  const cat = img(a, (x, y) => {
    if (y < H * 0.19) {
      const v = r() * 12 - 6;
      return [155 + v, 190 + v, 235 + v];
    }
    const dx = (x - W / 2) / (W * 0.32),
      dy = (y - H * 0.58) / (H * 0.35);
    if (dx * dx + dy * dy <= 1) {
      const v = 40 + r() * 180;
      return [v, v, v];
    }
    const v = r() * 30 - 15;
    return [50 + v, 130 + v, 45 + v];
  });
  const pal = palette(a, cat, 4);
  assert.ok(
    pal.some((i) => LCH[i][1] < 12),
    'a grey for the cat',
  );
  assert.ok(
    pal.some((i) => LCH[i][1] >= 25 && hueGap(LCH[i][2], 140) <= 30),
    'a green for the grass',
  );
});

test('From photo: a small red umbrella (under 2% of the photo) in a grey street keeps its red at 4 colours', () => {
  const a = appBen(),
    LCH = a.__eval('LCH'),
    r = seeded(5);
  const street = img(a, (x, y) => {
    if (x >= 48 && x < 61 && y >= 28 && y < 39) return [200, 30, 38];
    const v = 80 + (110 * x) / W + r() * 10 - 5;
    return [v, v, v];
  });
  const pal = palette(a, street, 4),
    red = a.hexToLab('#c81e26'),
    h = (Math.atan2(red[2], red[1]) * 180) / Math.PI;
  assert.ok(
    pal.some((i) => LCH[i][1] >= 40 && hueGap(LCH[i][2], h) <= 20),
    'a red for the umbrella',
  );
  assert.ok(pal.filter((i) => LCH[i][1] < 12).length >= 2, 'and greys for the street');
});

test('From photo: a photo with no colour gives only greys', () => {
  const a = appBen(),
    LCH = a.__eval('LCH'),
    r = seeded(9);
  const grey = img(a, (x) => {
    const v = 30 + (200 * x) / W + r() * 10 - 5;
    return [v, v, v + 2];
  });
  for (const n of [4, 6, 8]) {
    const pal = palette(a, grey, n);
    assert.equal(pal.length, n);
    assert.ok(
      pal.every((i) => LCH[i][1] < 15),
      n + ': ' + pal.map((i) => Math.round(LCH[i][1])).join(' '),
    );
  }
});

test('From photo: the same photo always gives the same palette (in one app and in another)', () => {
  const a = appBen(),
    b = appBen(),
    r = seeded(11);
  const noise = Array.from({ length: W * H }, () => [r() * 255, r() * 255, r() * 255]),
    fill = (x, y) => noise[y * W + x];
  for (const n of [4, 8, 12]) {
    const first = palette(a, img(a, fill), n);
    assert.equal(first.length, n);
    assert.deepEqual(palette(a, img(a, fill), n), first, n + ': again in the same app');
    assert.deepEqual(palette(b, img(b, fill), n), first, n + ': in another app');
  }
});
