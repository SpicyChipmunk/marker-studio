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

// Sharma, Wu & Dalal (2005), "The CIEDE2000 color-difference formula": reference pairs, to four decimals
test('de2000() matches the published CIEDE2000 test data', () => {
  const pairs = [
    [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425],
    [[50, 3.1571, -77.2803], [50, 0, -82.7485], 2.8615],
    [[50, 0, 0], [50, -1, 2], 2.3669],
    [[50, 2.49, -0.001], [50, -2.49, 0.0011], 7.2195],
    [[50, 2.5, 0], [73, 25, -18], 27.1492],
    [[60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387], 1.2644],
    [[22.7233, 20.0904, -46.694], [23.0331, 14.973, -42.5619], 2.0373],
    [[2.0776, 0.0795, -1.135], [0.9033, -0.0636, -0.5514], 0.9082],
  ];
  for (const [a, b, want] of pairs) {
    assert.ok(Math.abs(app.de2000(a, b) - want) < 1e-4, `${a} / ${b}: ${app.de2000(a, b)} vs ${want}`);
    assert.ok(Math.abs(app.de2000(b, a) - want) < 1e-4, 'symmetric');
  }
});

test('the six looks: each marker fits the regions it should, and widening takes the nearest first', () => {
  const E = app.__eval;
  assert.deepEqual([...E('MOOD_KEYS.map((k) => MOODS[k].label)')], ['Any', 'Bright', 'Soft', 'Pastel', 'Deep', 'Earthy']);
  assert.equal(app.moodOff('pastel', [85, 20, 0]), 0);
  assert.equal(app.moodOff('pastel', [70, 20, 0]), 8);
  assert.equal(app.moodOff('deep', [40, 30, 0]), 0);
  const list = [[90, 20], [60, 20], [80, 5], [75, 20]];
  const r = app.moodPick(list, 'pastel', 2, (x) => [x[0], x[1], 0]);
  assert.deepEqual(r.items.map((x) => [...x]), [[90, 20], [75, 20]]);
  assert.equal(r.widened, 1);
});

test('lighting correction: grey, tinted paper comes back to white, pale colours are not clipped, white paper is left alone', () => {
  const E = app.__eval;
  // paper photographed as a warm grey (about L* 72, like Ben's photos)
  const paper = [...E('[srgbToLin(186), srgbToLin(176), srgbToLin(160)]')];
  const fix = E(`lightFix(${JSON.stringify(paper)})`);
  assert.ok(fix && fix.gain.length === 3);
  const out = [...app.lightApply(fix, 186, 176, 160)], lab = app.hexToLab('#' + out.map((v) => v.toString(16).padStart(2, '0')).join(''));
  assert.ok(lab[0] > 92 && lab[0] < 97, 'paper back to about L* 95: ' + lab[0]);
  assert.ok(Math.hypot(lab[1], lab[2]) < 3, 'and neutral');
  // a pale yellow a little lighter than the paper stays yellow, not white
  const py = [...app.lightApply(fix, 200, 190, 120)];
  assert.ok(py[2] < py[0] - 20, 'pale yellow keeps its colour: ' + py);
  // white paper: nothing to correct; a dark or strongly coloured spot is not paper
  assert.equal(E('lightFix([0.88, 0.88, 0.88])'), null);
  assert.equal(E('lightFix([0.02, 0.02, 0.02])'), null);
  assert.equal(E('lightFix([0.6, 0.2, 0.1])'), null);
  // paperOf finds the paper in a buffer that is mostly paper with some ink and colour
  const n = 400, d = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) { const c = i % 10 === 0 ? [20, 20, 20] : i % 7 === 0 ? [200, 40, 60] : [186, 176, 160]; d.set([...c, 255], i * 4); }
  const p = E('(d) => paperOf(d)')(d);
  assert.ok(p && Math.abs(p[0] - paper[0]) < 0.01 && Math.abs(p[2] - paper[2]) < 0.01);
});

test('text on a marker colour is whichever of dark or white reads better: every marker at least 3:1', () => {
  const E = app.__eval, C = E('COLORS');
  const lin = (v) => { v /= 255; return v > 0.04045 ? ((v + 0.055) / 1.055) ** 2.4 : v / 12.92; };
  const long = (h) => (h.length === 4 ? '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3] : h);
  const Y = (h0) => { const h = long(h0); return 0.2126 * lin(parseInt(h.slice(1, 3), 16)) + 0.7152 * lin(parseInt(h.slice(3, 5), 16)) + 0.0722 * lin(parseInt(h.slice(5, 7), 16)); };
  const cr = (a, b) => { const x = Y(a), y = Y(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  // blue B111 had white text at 2.9:1 under the old brightness rule; dark text reads at 6.4:1
  const b111 = C.find((c) => c.brand === 'Ohuhu' && c.code === 'B111');
  assert.equal(app.txt(b111.hex), '#141216');
  for (const c of C) {
    const t = app.txt(c.hex), other = t === '#fff' ? '#141216' : '#fff';
    assert.ok(cr(c.hex, t) >= 3, `${c.brand} ${c.code}: ${cr(c.hex, t).toFixed(2)}`);
    assert.ok(cr(c.hex, t) >= cr(c.hex, other) - 1e-9, `${c.brand} ${c.code} has the better of the two`);
    assert.equal(E('darkText')(c.hex), t !== '#fff');
  }
});
