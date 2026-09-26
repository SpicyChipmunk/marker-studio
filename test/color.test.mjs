// Tests for the pure colour / format helpers used throughout the app.
// These run against the real functions loaded from index.html via the harness.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { app } from './harness.mjs';

const close = (a, b, eps = 0.1) => Math.abs(a - b) <= eps;

test('rgb() parses hex to [r,g,b]', () => {
  assert.deepEqual([...app.rgb('#ff0000')], [255, 0, 0]);
  assert.deepEqual([...app.rgb('#00ff00')], [0, 255, 0]);
  assert.deepEqual([...app.rgb('#0000ff')], [0, 0, 255]);
  assert.deepEqual([...app.rgb('#ffffff')], [255, 255, 255]);
  assert.deepEqual([...app.rgb('#000000')], [0, 0, 0]);
});

test('rgba() formats an rgba() string', () => {
  assert.equal(app.rgba('#ff0000', 0.5), 'rgba(255,0,0,0.5)');
  assert.equal(app.rgba('#000000', 1), 'rgba(0,0,0,1)');
});

test('hexToLab() matches known CIELAB values', () => {
  const [Lw, aw, bw] = app.hexToLab('#ffffff');
  assert.ok(close(Lw, 100, 0.5), `white L=${Lw}`);
  assert.ok(close(aw, 0, 0.5) && close(bw, 0, 0.5), `white a,b=${aw},${bw}`);

  const [Lk] = app.hexToLab('#000000');
  assert.ok(close(Lk, 0, 0.5), `black L=${Lk}`);

  const [Lr, ar, br] = app.hexToLab('#ff0000');
  assert.ok(close(Lr, 53.24, 0.3), `red L=${Lr}`);
  assert.ok(ar > 70 && br > 60, `red a,b=${ar},${br}`); // strongly +a (red), +b (yellow)

  // mid-grey: L around 53, near-zero chroma
  const [Lg, ag, bg] = app.hexToLab('#808080');
  assert.ok(Lg > 50 && Lg < 56, `grey L=${Lg}`);
  assert.ok(close(ag, 0, 0.5) && close(bg, 0, 0.5), `grey chroma=${ag},${bg}`);
});

test('hexToLab() L is monotonic with lightness', () => {
  const L = (h) => app.hexToLab(h)[0];
  assert.ok(L('#000000') < L('#404040'));
  assert.ok(L('#404040') < L('#808080'));
  assert.ok(L('#808080') < L('#c0c0c0'));
  assert.ok(L('#c0c0c0') < L('#ffffff'));
});

test('hsl() reports the right hue and zero saturation for greys', () => {
  assert.ok(close(app.hsl('#ff0000').h, 0, 1) || close(app.hsl('#ff0000').h, 360, 1));
  assert.ok(close(app.hsl('#00ff00').h, 120, 1));
  assert.ok(close(app.hsl('#0000ff').h, 240, 1));
  assert.ok(close(app.hsl('#808080').s, 0, 0.001), 'grey has zero saturation');
});

test('mix() interpolates between two colours', () => {
  assert.equal(app.mix('#000000', '#ffffff', 0), 'rgb(0,0,0)');
  assert.equal(app.mix('#000000', '#ffffff', 1), 'rgb(255,255,255)');
  assert.equal(app.mix('#000000', '#ffffff', 0.5), 'rgb(128,128,128)');
});

test('hueDist() is a symmetric circular distance in [0,180]', () => {
  assert.equal(app.hueDist(0, 0), 0);
  assert.equal(app.hueDist(0, 180), 180);
  assert.equal(app.hueDist(0, 90), 90);
  assert.equal(app.hueDist(10, 350), 20);   // wraps the short way
  assert.equal(app.hueDist(350, 10), 20);   // symmetric
  assert.equal(app.hueDist(0, 270), 90);    // never exceeds 180
});

test('txt() picks readable text colour for a background', () => {
  assert.equal(app.txt('#ffffff'), '#141216'); // dark text on light bg
  assert.equal(app.txt('#000000'), '#fff');    // light text on dark bg
});

test('normCode() inserts the dash in Copic C/W codes only', () => {
  assert.equal(app.normCode('C1'), 'C-1');
  assert.equal(app.normCode('W5'), 'W-5');
  assert.equal(app.normCode('E49'), 'E49'); // untouched
  assert.equal(app.normCode('120'), '120'); // untouched
});
