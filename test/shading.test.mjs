// Shading: companion markers come only from your collection, the shadow side faces away from the sun,
// tones are layered (light < base < shadow), and settings save with the guide.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { app, core } from './harness.mjs';

const COLORS = app.__eval('COLORS'), lab = app.__eval('hexToLab');
const mk = (code, brand = 'Ohuhu') => { const c = COLORS.find((x) => x.brand === brand && x.code === code); assert.ok(c, code); return { mkey: brand + '|' + code, code, brand, hex: c.hex, name: c.name, fam: c.fam, lab: lab(c.hex) }; };

// a 120x120 picture: section 1 is a 48x48 square (with a 2px line around it), section 2 a tiny 6x6 one,
// section 3 the unassigned background
function scene(base) {
  const W = 120, H = 120, labels = new Int32Array(W * H).fill(3);
  const box = (x0, y0, x1, y1, l) => { for (let y = y0 - 2; y < y1 + 2; y++) for (let x = x0 - 2; x < x1 + 2; x++) labels[y * W + x] = (x < x0 || y < y0 || x >= x1 || y >= y1) ? -1 : l; };
  box(10, 10, 58, 58, 1); box(80, 80, 86, 86, 2);
  core.W = W; core.H = H; core.labels = labels; core.labelPts = null;
  core.comps = [null, { area: 2304, cx: 34, cy: 34 }, { area: 36, cx: 83, cy: 83 }, { area: 9000, cx: 60, cy: 60 }];
  core.assignData = { assign: { 1: base, 2: base }, order: [1, 2], N: 2 };
  return { W, at: (x, y) => core.shadeV[y * W + x] };
}

test('picks a clearly darker and a lighter marker of the same colour from your collection only', () => {
  const base = mk('B112');
  core.setCollection([base, mk('B114'), mk('B111'), mk('R16')]);
  core.shadeMode = 'full';
  assert.equal(core.shadePick(base, [mk('B114'), mk('B115')], 1).code, 'B114', 'the nearer step down wins');
  assert.equal(core.shadePick(base, [mk('B111')], -1).code, 'B111');
  const t = core.shadeTones(base);
  assert.equal(t.dark.code, 'B114'); assert.equal(t.light.code, 'B111'); assert.equal(t.coat, false);
});

test('a different hue never stands in as a shadow, even at the right lightness', () => {
  const base = mk('B112');
  const reds = COLORS.filter((c) => c.brand === 'Ohuhu' && /^R\d/.test(c.code)).map((c) => mk(c.code));
  assert.equal(core.shadePick(base, reds, 1), null);
  assert.equal(core.shadePick(base, reds, -1), null);
});

test('with no darker match you own, the shadow is a 2nd coat and a marker to buy is suggested', () => {
  app.__eval("state.owned.add('Ohuhu|B112')"); // not demo mode, so suggestions are made
  const base = mk('B112');
  core.setCollection([base]);
  core.shadeMode = 'shadow';
  const t = core.shadeTones(base);
  assert.equal(t.dark, null); assert.equal(t.coat, true);
  assert.ok(t.S.every((v, k) => v <= t.B[k]), '2nd coat is darker than one coat');
  assert.ok(t.wantDark && t.wantDark.brand === 'Ohuhu', 'suggests a same-brand darker marker');
  assert.equal(t.light, null, 'Shadows mode has no light tone');
  app.__eval("state.owned.delete('Ohuhu|B112')");
});

test('the shadow falls on the side away from the sun, and follows it', () => {
  const base = mk('B112'); core.setCollection([base, mk('B114')]); core.shadeMode = 'shadow';
  const s = scene(base);
  core.shadeSun = { x: 0, y: 0 }; core.shadeRound = 0; core.shadeField(1);
  assert.ok(s.at(14, 14) < s.at(54, 54), 'top-left lit, bottom-right in shadow');
  core.shadeSun = { x: 1, y: 1 }; core.shadeField(1);
  assert.ok(s.at(14, 14) > s.at(54, 54), 'moving the sun flips it');
  assert.equal(s.at(83, 83), 0, 'sections too small to shade stay one flat colour');
  assert.equal(s.at(100, 20), 0, 'unassigned background is left alone');
});

test('roundness darkens the edges of a section', () => {
  const base = mk('B112'); core.setCollection([base]); core.shadeMode = 'shadow';
  const s = scene(base);
  core.shadeSun = { x: 34 / 120, y: 0 }; core.shadeRound = 1; core.shadeField(1);
  assert.ok(s.at(11, 34) > s.at(34, 34), 'edge darker than the middle at the same height');
});

test('tones are layered: light < base < shadow as the shade value rises', () => {
  const t = { L: [250, 250, 250], B: [128, 128, 128], S: [40, 40, 40], T2: 0.34, T3: 0.6 }, t2 = { L: null, B: [128, 128, 128], S: [40, 40, 40], T2: 0.34, T3: 0.6 };
  const z = [0, 0.2, 0.5, 0.7, 1].map((v) => core.shadeZone(t, v));
  assert.deepEqual(z, [0, 0, 1, 2, 2]);
  assert.deepEqual([0, 0.5, 1].map((v) => core.shadeZone(t2, v)), [1, 1, 2], 'no light tone: the section starts at the base');
});

test('shading starts off and its settings save with the guide', () => {
  const base = mk('B112'); core.setCollection([base]);
  scene(base); core.secState = new Uint8Array(3); core.colored = new Uint8Array(3); core.curName = 'x';
  core.shadeMode = 'off';
  const off = core.currentDesignObj().payload.style.shade;
  assert.equal(off.mode, 'off');
  core.shadeMode = 'full'; core.shadeSun = { x: 0.8, y: 0.3 };
  const on = JSON.parse(JSON.stringify(core.currentDesignObj().payload.style.shade));
  assert.deepEqual({ mode: on.mode, x: on.x, y: on.y }, { mode: 'full', x: 0.8, y: 0.3 });
  core.shadeMode = 'off';
});

test('the printed page marks the highlight (H) and the shadow (S) of a big section', () => {
  const base = mk('B112'); core.setCollection([base, mk('B114'), mk('B111')]); core.shadeMode = 'full';
  scene(base); core.shadeSun = { x: 0, y: 0 }; core.shadeRound = 0.3; core.secState = new Uint8Array(4); core.colored = new Uint8Array(4);
  const sh = core.shadePrep(false);
  const zl = core.shadeZoneLabels(sh, 3);
  const big = JSON.parse(JSON.stringify(zl.filter((z) => z.l === 1).map((z) => z.tone).sort()));
  assert.deepEqual(big, ['H', 'S'], 'section 1 gets an H (highlight) and an S (shadow)');
  assert.ok(!zl.some((z) => z.l === 2), 'nothing on the tiny section');
  const s3 = zl.find((z) => z.l === 1 && z.tone === 'S'), h = zl.find((z) => z.l === 1 && z.tone === 'H');
  assert.ok(s3.x > 34 && s3.y > 34, 'the S sits on the side away from the sun');
  assert.ok(h.x < 34 && h.y < 34, 'the H sits on the side facing the sun');
  core.shadeMode = 'off';
});

// ---- colouring along with shading (stage 3) ----
// four 40x40 sections on a 200x200 page: 1 and 2 are B112 (lighter B111 and darker B114 owned),
// 3 and 4 are R16 with nothing darker owned (so its shadow is a 2nd coat)
function scene4(a, b) {
  const W = 200, H = 200, labels = new Int32Array(W * H).fill(5);
  const box = (x0, y0, l) => { for (let y = y0 - 2; y < y0 + 42; y++) for (let x = x0 - 2; x < x0 + 42; x++) labels[y * W + x] = (x < x0 || y < y0 || x >= x0 + 40 || y >= y0 + 40) ? -1 : l; };
  box(10, 10, 1); box(60, 10, 2); box(110, 110, 3); box(160, 110, 4);
  core.W = W; core.H = H; core.labels = labels; core.labelPts = null;
  core.comps = [null, ...[1, 2, 3, 4].map(() => ({ area: 1600, cx: 0, cy: 0 })), { area: 30000, cx: 100, cy: 100 }];
  core.assignData = { assign: { 1: a, 2: a, 3: b, 4: b }, order: [1, 2, 3, 4], N: 4 };
  core.colored = new Uint8Array(6); core.secState = new Uint8Array(6);
}

test('a section is done once all its tones are, and undo keeps the other tones', () => {
  const a = mk('B112'), b = mk('R16');
  core.setCollection([a, mk('B111'), mk('B114'), b]); core.shadeMode = 'full'; core.shadeSun = { x: 0, y: 0 };
  scene4(a, b);
  assert.equal(core.shadeReq(1), 7, 'lighter + base + darker');
  core.stepSet(1, 1, true); core.stepSet(1, 2, true);
  assert.equal(core.colored[1], 0);
  core.stepSet(1, 4, true);
  assert.equal(core.colored[1], 1, 'done after the shadow');
  core.stepSet(1, 4, false);
  assert.equal(core.colored[1], 0);
  assert.ok(core.stepDone(1, 1) && core.stepDone(1, 2) && !core.stepDone(1, 4), 'undoing the shadow keeps 1 and 2');
  core.shadeMode = 'off';
});

test('focus goes colour by colour, finishing each section; 2nd-coat shadows come as a later pass', () => {
  const a = mk('B112'), b = mk('R16');
  core.setCollection([a, mk('B111'), mk('B114'), b]); core.shadeMode = 'shadow'; core.shadeSun = { x: 0, y: 0 };
  scene4(a, b); core.toneSteps = false; core.buildFocusOrder();
  const steps = JSON.parse(JSON.stringify(core.focusOrd.map((l, i) => [l, core.focusStep[i]])));
  const secB = steps.filter((s) => s[0] >= 3), secA = steps.filter((s) => s[0] <= 2);
  assert.deepEqual(secA.map((s) => s[1]), [6, 6], 'B112: one tap per section (base + darker)');
  assert.deepEqual(secB.map((s) => s[1]), [2, 2, 4, 4], 'R16: base on both, then the 2nd coat on both');
  core.toneSteps = true; core.buildFocusOrder();
  const st = JSON.parse(JSON.stringify(core.focusOrd.map((l, i) => [l, core.focusStep[i]]))).filter((s) => s[0] <= 2);
  assert.deepEqual(st.map((s) => s[1]), [2, 4, 2, 4], 'step by step: each section 2 then 3 before the next');
  core.toneSteps = false; core.shadeMode = 'off';
});

test('near-black gets no shadow step (nothing darker to add)', () => {
  const k = mk('120'); core.setCollection([k]); core.shadeMode = 'shadow';
  const t = core.shadeTones(k);
  assert.equal(t.noShadow, true); assert.equal(t.coat, false); assert.equal(t.wantDark, null);
  core.shadeMode = 'off';
});

test('switching shading off after part-doing a section lets it finish (no stuck section)', () => {
  const a = mk('B112'), b = mk('R16');
  core.setCollection([a, mk('B111'), mk('B114'), b]); core.shadeMode = 'full'; core.shadeSun = { x: 0, y: 0 };
  scene4(a, b);
  core.stepSet(1, 2, true); // base done, highlight and shadow not yet
  assert.equal(core.colored[1], 0);
  core.shadeMode = 'off'; core.normalizeTones();
  assert.equal(core.colored[1], 1, 'with shading off the base was all it needed');
  core.shadeMode = 'off';
});

test('a colour’s highlight and shadow are never the same marker (a light cool marker can suit both); the shadow takes the next one', () => {
  const all = COLORS.filter((c) => c.brand === 'Ohuhu').map((c) => mk(c.code));
  core.setCollection(all);
  core.shadeMode = 'full';
  let clashed = 0;
  for (const shadow of ['cool', 'grey']) {
    const zs = { on: true, round: 0.5, hi: 0.5, lo: 0.5, shadow, hilite: 'same' };
    for (const base of all) {
      const t = core.shadeTones(base, zs);
      if (t.light && t.dark) assert.notEqual(t.light.mkey, t.dark.mkey, base.code + ' ' + shadow);
      // (the case it guards against: what the shadow would have been is the highlight)
      const was = core.shadeStylePick(base, all, shadow), hl = core.shadePick(base, all, -1);
      if (was && hl && was.mkey === hl.mkey) {
        clashed++;
        assert.ok(t.dark, base.code + ': still a shadow');
        if (t.glaze) assert.notEqual(t.dark.mkey, hl.mkey);
      }
    }
  }
  assert.ok(clashed > 0, 'the whole Ohuhu range has colours where the two would clash');
  core.shadeMode = 'off';
});

test('a cooler or grey shadow is laid over the base once it’s dry: focus mode comes back for it, as for a 2nd coat, and says so', () => {
  const all = COLORS.filter((c) => c.brand === 'Ohuhu').map((c) => mk(c.code));
  core.setCollection(all); core.shadeMode = 'shadow'; core.shadeSun = { x: 0, y: 0 };
  core.styleVars.shadeShadow = 'grey';
  // a colour whose grey shadow is laid over it
  const a = all.find((m) => core.shadeTones(m).glaze), b = all.find((m) => m !== a && m.lab[0] > 40);
  assert.ok(a && b);
  scene4(a, b);
  core.toneSteps = false; core.buildFocusOrder();
  const steps = JSON.parse(JSON.stringify(core.focusOrd.map((l, i) => [l, core.focusStep[i]]))).filter((s) => s[0] <= 2);
  assert.deepEqual(steps.map((s) => s[1]), [2, 2, 4, 4], 'the base on both, then the shadow over both');
  core.toneSteps = true; core.buildFocusOrder();
  const st = JSON.parse(JSON.stringify(core.focusOrd.map((l, i) => [l, core.focusStep[i]]))).filter((s) => s[0] <= 2);
  assert.deepEqual(st.map((s) => s[1]), [2, 2, 4, 4], 'step by step too');
  // the words: the shadow over the base once it's dry
  assert.match(core.stepText(1, 4).sub, /over the base once it’s dry/);
  assert.match(core.shadeHowto(), /dry/);
  core.toneSteps = false; core.styleVars.shadeShadow = 'same'; core.shadeMode = 'off';
});
