// v304 shading: the smallest shaded section is SH_MINR in the guide's own pixels again (v303 took it on the picture as
// it came, so an enlarged download shaded about half what the same page photographed did), and the tone lines are as
// thick as on any picture that size; a big shape inside the page is shaded, and only the page's background at a
// quarter of the picture or more is left flat ("Background-sized"); tone lines are dashed along the line (by x + y, a
// line at 45° was drawn whole or not at all); the Colorless Blenders are never a marker to buy; the Highlights and
// Shadows sliders don't work the light out again; the caches that go by a coloured section's held shading see every
// change to it; Print's own Tone lines option, and the how-to without them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { app, core } from './harness.mjs';

const COLORS = app.__eval('COLORS'),
  lab = app.__eval('hexToLab');
const mk = (c) => ({
  mkey: c.brand + '|' + c.code,
  code: c.code,
  brand: c.brand,
  hex: c.hex,
  name: c.name,
  fam: c.fam,
  lab: lab(c.hex),
});
const by = (code, brand = 'Ohuhu') => mk(COLORS.find((c) => c.brand === brand && c.code === code));
const ALL = COLORS.filter((c) => !/colou?rless blender/i.test(c.name)).map(mk);

// a W x H white picture with ink where ink(x, y), its sections found as a picture enlarged k times (srcK), each in the
// guide with one mid-tone marker, shading on
function page(W, H, ink, k = 1) {
  const g = new Uint8Array(W * H).fill(255);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (ink(x, y)) g[y * W + x] = 0;
  core.srcK = k;
  core.W = W;
  core.H = H;
  core.gray = g;
  core.segment();
  core.applyBg(true);
  const cl = Array.from(core.countedList()),
    m = by('R16'),
    assign = {};
  cl.forEach((l) => (assign[l] = m));
  core.assignData = { assign, order: cl.slice(), N: cl.length, base: { ...assign } };
  core.labelPts = null;
  core.colored = new Uint8Array(core.comps.length);
  core.setCollection(ALL);
  core.shadeMode = 'full';
  core.shadeSun = { x: 0.2, y: 0.12 };
  core.shadeRound = 0.5;
  return cl;
}
const areaOf = (l) => core.labels.reduce((n, v) => n + (v === l), 0);
const biggest = (cl) => cl.slice().sort((a, b) => areaOf(b) - areaOf(a))[0];
const ring = (cx, cy, r) => (x, y) => Math.abs(Math.hypot(x - cx, y - cy) - r) < 2;

test('enlarged 3 times, a section 6 pixels across on the picture as it came (18 enlarged) is shaded, as photographed', () => {
  // squares 18 px inside on a 600 px picture enlarged from 200: v303 wanted 5 x 3 = 15 px from the middle to the edge
  const cl = page(600, 600, (x, y) => x % 24 < 3 || y % 24 < 3, 3);
  const small = cl.filter((l) => areaOf(l) < 30 * 30);
  assert.ok(small.length > 100, 'squares found: ' + small.length);
  assert.ok(
    small.every((l) => core.shadeWhy(l) === ''),
    'all shaded: ' + small.map((l) => core.shadeWhy(l)).join(','),
  );
  // and one under SH_MINR (5 px from the middle to the edge) stays flat, whatever the picture
  page(300, 300, (x, y) => x % 9 < 2 || y % 9 < 2, 1);
  assert.equal(core.shadeWhy(core.countedList()[5]), 'small');
  core.srcK = 1;
});

test('a big shape inside the page is shaded; the background, a section at the edge and the paper inside a frame (brought back) are not', () => {
  // an apple a third of the page across: about 27% of the picture
  let cl = page(800, 1000, ring(400, 500, 264));
  assert.ok(areaOf(biggest(cl)) >= 0.25 * 800 * 1000);
  assert.equal(core.shadeWhy(biggest(cl)), '');
  // the same apple cut by a tight crop: it touches the picture's edge
  cl = page(800, 1000, ring(400, 640, 400));
  assert.equal(core.shadeWhy(biggest(cl)), 'bg');
  assert.match(core.shadeTipHTML(biggest(cl)), /Background-sized — one flat colour/);
  // a frame round the page with a drawing inside: the paper between them spans the page but fills under half its box
  const inFrame = (x, y) => {
    const e = Math.min(x, y, 799 - x, 999 - y);
    return e > 22 && e < 26;
  };
  cl = page(
    800,
    1000,
    (x, y) =>
      inFrame(x, y) ||
      ring(400, 500, 360)(x, y) ||
      ring(400, 500, 270)(x, y) ||
      ring(400, 500, 180)(x, y) ||
      (Math.abs(x - 400) < 2 && Math.hypot(x - 400, y - 500) < 360) ||
      (Math.abs(y - 500) < 2 && Math.hypot(x - 400, y - 500) < 360),
  );
  // (v305: on a fresh scan the paper inside the frame is left white; brought back with Colour it, it's flat)
  const paper = core.comps.findIndex((k) => k && k.framed),
    c = core.comps[paper];
  assert.ok(paper > 0 && !cl.includes(paper), 'the frame’s paper is left white');
  core.secState[paper] = 1;
  core.assignData.assign[paper] = by('R16');
  core.assignData.order.push(paper);
  assert.ok(areaOf(paper) >= 0.25 * 800 * 1000 && !c.bpx, 'the frame’s paper: ' + areaOf(paper));
  assert.equal(core.shadeWhy(paper), 'bg');
  // a section too small says so as before
  assert.match(core.shadeTipHTML(cl.find((l) => core.shadeWhy(l) === '')) || '', /sftipsh/);
});

// how much of each tone line (each section's boundary between two tones) the dashes ink, from 0 to 1
function inked(sh) {
  const W = core.W,
    H = core.H,
    V = sh.V,
    lb = core.labels,
    buf = new Uint8ClampedArray(W * H * 4).fill(200);
  core.shadeLinesDraw(sh, null, { buf, t: 1, dash: 6, ink: [255, 0, 0] });
  const all = {},
    on = {};
  for (let y = 0; y < H - 1; y++)
    for (let x = 0; x < W - 1; x++) {
      const q = y * W + x,
        l = lb[q];
      if (l < 1 || !V[q] || !sh.ti[l]) continue;
      const zb = sh.ti[l] * 256,
        z = sh.zn[zb + V[q]],
        a = q + 1,
        b = q + W;
      const za = lb[a] === l && V[a] ? sh.zn[zb + V[a]] : z,
        zc = lb[b] === l && V[b] ? sh.zn[zb + V[b]] : z;
      if (za === z && zc === z) continue;
      const k = l + ':' + Math.min(z, za !== z ? za : zc);
      all[k] = (all[k] || 0) + 1;
      if (buf[q * 4 + 1] === 0) on[k] = (on[k] || 0) + 1;
    }
  return Object.keys(all)
    .filter((k) => all[k] > 20)
    .map((k) => (on[k] || 0) / all[k]);
}
test('tone lines are dashed along the line: none drawn whole or left out, with the sun in a corner', () => {
  page(800, 800, (x, y) => x % 200 < 3 || y % 200 < 3 || x > 796 || y > 796);
  core.shadeRound = 0;
  for (const sun of [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 0.5, y: 0 },
  ]) {
    core.shadeSun = sun;
    const f = inked(core.shadePrep(false));
    assert.ok(f.length >= 24, 'lines: ' + f.length);
    assert.ok(
      f.every((v) => v > 0.3 && v < 0.7),
      JSON.stringify(sun) + ': ' + f.map((v) => v.toFixed(2)).join(' '),
    );
  }
});

test('the Colorless Blender is never a marker to buy, for a highlight or a shadow', () => {
  core.shadeMode = 'full';
  const bad = [];
  for (const base of ALL.filter((m) => m.lab[0] > 70)) {
    core.setCollection([base]);
    const t = core.shadeTones(base);
    for (const w of [t.wantLight, t.wantDark])
      if (w && w.code === '0') bad.push(base.brand + ' ' + base.code);
  }
  assert.deepEqual(bad, []);
  core.setCollection(ALL);
});

test('Highlights and Shadows keep the light as it was; Roundness works it out again; a preview takes the full one', () => {
  const cl = page(400, 400, (x, y) => x % 100 < 3 || y % 100 < 3 || x > 396 || y > 396);
  const V = core.shadeField(1),
    q = 150 * 400 + 150;
  assert.ok(V[q] > 0);
  V[q] = V[q] === 7 ? 8 : 7;
  const mark = V[q];
  core.zshSet(0, 'hi', 0.8);
  core.zshSet(0, 'lo', 0.2);
  core.zshSet(0, 'shadow', 'grey');
  assert.equal(core.shadeField(1), V);
  assert.equal(V[q], mark, 'not worked out again');
  assert.equal(core.shadeField(2), V, 'the preview is the full field');
  assert.equal(V[q], mark);
  core.zshSet(0, 'round', 0.9);
  core.shadeField(1);
  assert.notEqual(core.shadeV[q], mark, 'Roundness: worked out again');
  core.zshSet(0, 'round', 0.5);
  core.zshSet(0, 'hi', 0.5);
  core.zshSet(0, 'lo', 0.5);
  core.zshSet(0, 'shadow', 'same');
  assert.ok(cl.length >= 16);
});

test('what shading asks for follows a coloured section’s held shading as it is noted, let go and put back', () => {
  const cl = page(400, 400, (x, y) => x % 100 < 3 || y % 100 < 3 || x > 396 || y > 396),
    l = cl[3];
  core.colored[l] = 1;
  assert.deepEqual(Object.keys(core.shadeUse().kS), ['same']);
  core.zshSet(0, 'shadow', 'grey');
  assert.deepEqual(
    Object.keys(core.shadeUse().kS).sort(),
    ['grey', 'same'],
    'the ticked one keeps its shadow',
  );
  // unticked: its held shadow is let go as the picture is drawn
  core.colored[l] = 0;
  core.zshOf(l);
  assert.deepEqual(Object.keys(core.shadeUse().kS), ['grey']);
  // ticked again by an Undo, with the shading it was coloured with put back
  core.colored[l] = 1;
  core.heldSet(l, { shadow: 'same', hilite: 'same', free: false });
  assert.deepEqual(Object.keys(core.shadeUse().kS).sort(), ['grey', 'same']);
  core.colored[l] = 0;
  core.zshOf(l);
  core.zshSet(0, 'shadow', 'same');
});

test('the brand letters go by a coloured section’s held shadow: let go, they go too', () => {
  const cl = page(400, 400, (x, y) => x % 100 < 3 || y % 100 < 3 || x > 396 || y > 396),
    l = cl[3];
  // an Ohuhu marker, and a Copic grey that glazes it (the only grey owned)
  const base = by('R16');
  core.zshSet(0, 'shadow', 'grey');
  const grey = COLORS.filter((c) => c.brand === 'Copic' && /Gr[ae]y/.test(c.fam || ''))
    .map(mk)
    .find((g) => {
      core.setCollection([base, g]);
      const t = core.shadeTones(base);
      return t.dark && t.dark.mkey === g.mkey;
    });
  assert.ok(grey, 'a Copic grey glazes ' + base.code);
  const assign = {};
  cl.forEach((s) => (assign[s] = base));
  core.assignData = { assign, order: cl.slice(), N: cl.length, base: { ...assign } };
  core.setCollection([base, grey]);
  core.colored[l] = 1;
  core.zshOf(l);
  core.zshSet(0, 'shadow', 'same');
  assert.equal(core.guideMixed(), true, 'coloured with the Copic grey');
  core.colored[l] = 0;
  core.zshOf(l);
  assert.equal(core.guideMixed(), false, 'unticked: Ohuhu only');
  core.setCollection(ALL);
});

test('printed without tone lines, the how-to points to the circles alone', () => {
  page(400, 400, (x, y) => x % 100 < 3 || y % 100 < 3 || x > 396 || y > 396);
  for (const mode of ['full', 'shadow']) {
    core.shadeMode = mode;
    const on = core.shadeHowto(),
      off = core.shadeHowto(true);
    assert.match(on, /[Dd]ashed lines/);
    assert.doesNotMatch(off, /[Dd]ashed lines/);
    assert.match(
      off,
      mode === 'full'
        ? /The small H and S circles show where each goes, where there’s room/
        : /The small S circles show where the shadow starts, where there’s room/,
    );
  }
  core.shadeMode = 'full';
});
