// Shading.
// (v320) Tests organised by feature: each block below came from the file named above it, its tests unchanged.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { app, core, createApp } from './harness.mjs';

// ---- from shading.test.mjs ----
// Shading: companion markers come only from your collection, the shadow side faces away from the sun,
// tones are layered (light < base < shadow), and settings save with the guide.
{
  // (v320: an app of its own, as when this was a file of its own)
  const _app = createApp(),
    app = _app,
    core = _app.__mstest;
  const COLORS = app.__eval('COLORS'),
    lab = app.__eval('hexToLab');
  const mk = (code, brand = 'Ohuhu') => {
    const c = COLORS.find((x) => x.brand === brand && x.code === code);
    assert.ok(c, code);
    return { mkey: brand + '|' + code, code, brand, hex: c.hex, name: c.name, fam: c.fam, lab: lab(c.hex) };
  };
  // a 120x120 picture: section 1 is a 48x48 square (with a 2px line around it), section 2 a tiny 6x6 one,
  // section 3 the unassigned background
  function scene(base) {
    const W = 120,
      H = 120,
      labels = new Int32Array(W * H).fill(3);
    const box = (x0, y0, x1, y1, l) => {
      for (let y = y0 - 2; y < y1 + 2; y++)
        for (let x = x0 - 2; x < x1 + 2; x++)
          labels[y * W + x] = x < x0 || y < y0 || x >= x1 || y >= y1 ? -1 : l;
    };
    box(10, 10, 58, 58, 1);
    box(80, 80, 86, 86, 2);
    core.W = W;
    core.H = H;
    core.labels = labels;
    core.labelPts = null;
    core.comps = [
      null,
      { area: 2304, cx: 34, cy: 34 },
      { area: 36, cx: 83, cy: 83 },
      { area: 9000, cx: 60, cy: 60 },
    ];
    core.assignData = { assign: { 1: base, 2: base }, order: [1, 2], N: 2 };
    return { W, at: (x, y) => core.shadeV[y * W + x] };
  }
  // ---- colouring along with shading (stage 3) ----
  // four 40x40 sections on a 200x200 page: 1 and 2 are B112 (lighter B111 and darker B114 owned),
  // 3 and 4 are R16 with nothing darker owned (so its shadow is a 2nd coat)
  function scene4(a, b) {
    const W = 200,
      H = 200,
      labels = new Int32Array(W * H).fill(5);
    const box = (x0, y0, l) => {
      for (let y = y0 - 2; y < y0 + 42; y++)
        for (let x = x0 - 2; x < x0 + 42; x++)
          labels[y * W + x] = x < x0 || y < y0 || x >= x0 + 40 || y >= y0 + 40 ? -1 : l;
    };
    box(10, 10, 1);
    box(60, 10, 2);
    box(110, 110, 3);
    box(160, 110, 4);
    core.W = W;
    core.H = H;
    core.labels = labels;
    core.labelPts = null;
    core.comps = [
      null,
      ...[1, 2, 3, 4].map(() => ({ area: 1600, cx: 0, cy: 0 })),
      { area: 30000, cx: 100, cy: 100 },
    ];
    core.assignData = { assign: { 1: a, 2: a, 3: b, 4: b }, order: [1, 2, 3, 4], N: 4 };
    core.colored = new Uint8Array(6);
    core.secState = new Uint8Array(6);
  }
  test('picks a clearly darker and a lighter marker of the same colour from your collection only', () => {
    const base = mk('B112');
    core.setCollection([base, mk('B114'), mk('B111'), mk('R16')]);
    core.shadeMode = 'full';
    assert.equal(core.shadePick(base, [mk('B114'), mk('B115')], 1).code, 'B114', 'the nearer step down wins');
    assert.equal(core.shadePick(base, [mk('B111')], -1).code, 'B111');
    const t = core.shadeTones(base);
    assert.equal(t.dark.code, 'B114');
    assert.equal(t.light.code, 'B111');
    assert.equal(t.coat, false);
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
    assert.equal(t.dark, null);
    assert.equal(t.coat, true);
    assert.ok(
      t.S.every((v, k) => v <= t.B[k]),
      '2nd coat is darker than one coat',
    );
    assert.ok(t.wantDark && t.wantDark.brand === 'Ohuhu', 'suggests a same-brand darker marker');
    assert.equal(t.light, null, 'Shadows mode has no light tone');
    app.__eval("state.owned.delete('Ohuhu|B112')");
  });
  test('the shadow falls on the side away from the sun, and follows it', () => {
    const base = mk('B112');
    core.setCollection([base, mk('B114')]);
    core.shadeMode = 'shadow';
    const s = scene(base);
    core.shadeSun = { x: 0, y: 0 };
    core.shadeRound = 0;
    core.shadeField(1);
    assert.ok(s.at(14, 14) < s.at(54, 54), 'top-left lit, bottom-right in shadow');
    core.shadeSun = { x: 1, y: 1 };
    core.shadeField(1);
    assert.ok(s.at(14, 14) > s.at(54, 54), 'moving the sun flips it');
    assert.equal(s.at(83, 83), 0, 'sections too small to shade stay one flat colour');
    assert.equal(s.at(100, 20), 0, 'unassigned background is left alone');
  });
  test('roundness darkens the edges of a section', () => {
    const base = mk('B112');
    core.setCollection([base]);
    core.shadeMode = 'shadow';
    const s = scene(base);
    core.shadeSun = { x: 34 / 120, y: 0 };
    core.shadeRound = 1;
    core.shadeField(1);
    assert.ok(s.at(11, 34) > s.at(34, 34), 'edge darker than the middle at the same height');
  });
  test('tones are layered: light < base < shadow as the shade value rises', () => {
    const t = { L: [250, 250, 250], B: [128, 128, 128], S: [40, 40, 40], T2: 0.34, T3: 0.6 },
      t2 = { L: null, B: [128, 128, 128], S: [40, 40, 40], T2: 0.34, T3: 0.6 };
    const z = [0, 0.2, 0.5, 0.7, 1].map((v) => core.shadeZone(t, v));
    assert.deepEqual(z, [0, 0, 1, 2, 2]);
    assert.deepEqual(
      [0, 0.5, 1].map((v) => core.shadeZone(t2, v)),
      [1, 1, 2],
      'no light tone: the section starts at the base',
    );
  });
  test('shading starts off and its settings save with the guide', () => {
    const base = mk('B112');
    core.setCollection([base]);
    scene(base);
    core.secState = new Uint8Array(3);
    core.colored = new Uint8Array(3);
    core.curName = 'x';
    core.shadeMode = 'off';
    const off = core.currentDesignObj().payload.style.shade;
    assert.equal(off.mode, 'off');
    core.shadeMode = 'full';
    core.shadeSun = { x: 0.8, y: 0.3 };
    const on = JSON.parse(JSON.stringify(core.currentDesignObj().payload.style.shade));
    assert.deepEqual({ mode: on.mode, x: on.x, y: on.y }, { mode: 'full', x: 0.8, y: 0.3 });
    core.shadeMode = 'off';
  });
  test('the printed page marks the highlight (H) and the shadow (S) of a big section', () => {
    const base = mk('B112');
    core.setCollection([base, mk('B114'), mk('B111')]);
    core.shadeMode = 'full';
    scene(base);
    core.shadeSun = { x: 0, y: 0 };
    core.shadeRound = 0.3;
    core.secState = new Uint8Array(4);
    core.colored = new Uint8Array(4);
    const sh = core.shadePrep(false);
    const zl = core.shadeZoneLabels(sh, 3);
    const big = JSON.parse(
      JSON.stringify(
        zl
          .filter((z) => z.l === 1)
          .map((z) => z.tone)
          .sort(),
      ),
    );
    assert.deepEqual(big, ['H', 'S'], 'section 1 gets an H (highlight) and an S (shadow)');
    assert.ok(!zl.some((z) => z.l === 2), 'nothing on the tiny section');
    const s3 = zl.find((z) => z.l === 1 && z.tone === 'S'),
      h = zl.find((z) => z.l === 1 && z.tone === 'H');
    assert.ok(s3.x > 34 && s3.y > 34, 'the S sits on the side away from the sun');
    assert.ok(h.x < 34 && h.y < 34, 'the H sits on the side facing the sun');
    core.shadeMode = 'off';
  });
  test('a section is done once all its tones are, and undo keeps the other tones', () => {
    const a = mk('B112'),
      b = mk('R16');
    core.setCollection([a, mk('B111'), mk('B114'), b]);
    core.shadeMode = 'full';
    core.shadeSun = { x: 0, y: 0 };
    scene4(a, b);
    assert.equal(core.shadeReq(1), 7, 'lighter + base + darker');
    core.stepSet(1, 1, true);
    core.stepSet(1, 2, true);
    assert.equal(core.colored[1], 0);
    core.stepSet(1, 4, true);
    assert.equal(core.colored[1], 1, 'done after the shadow');
    core.stepSet(1, 4, false);
    assert.equal(core.colored[1], 0);
    assert.ok(
      core.stepDone(1, 1) && core.stepDone(1, 2) && !core.stepDone(1, 4),
      'undoing the shadow keeps 1 and 2',
    );
    core.shadeMode = 'off';
  });
  test('focus goes colour by colour, finishing each section; 2nd-coat shadows come as a later pass', () => {
    const a = mk('B112'),
      b = mk('R16');
    core.setCollection([a, mk('B111'), mk('B114'), b]);
    core.shadeMode = 'shadow';
    core.shadeSun = { x: 0, y: 0 };
    scene4(a, b);
    core.toneSteps = false;
    core.buildFocusOrder();
    const steps = JSON.parse(JSON.stringify(core.focusOrd.map((l, i) => [l, core.focusStep[i]])));
    const secB = steps.filter((s) => s[0] >= 3),
      secA = steps.filter((s) => s[0] <= 2);
    assert.deepEqual(
      secA.map((s) => s[1]),
      [6, 6],
      'B112: one tap per section (base + darker)',
    );
    assert.deepEqual(
      secB.map((s) => s[1]),
      [2, 2, 4, 4],
      'R16: base on both, then the 2nd coat on both',
    );
    core.toneSteps = true;
    core.buildFocusOrder();
    const st = JSON.parse(JSON.stringify(core.focusOrd.map((l, i) => [l, core.focusStep[i]]))).filter(
      (s) => s[0] <= 2,
    );
    assert.deepEqual(
      st.map((s) => s[1]),
      [2, 4, 2, 4],
      'step by step: each section 2 then 3 before the next',
    );
    core.toneSteps = false;
    core.shadeMode = 'off';
  });
  test('near-black gets no shadow step (nothing darker to add)', () => {
    const k = mk('120');
    core.setCollection([k]);
    core.shadeMode = 'shadow';
    const t = core.shadeTones(k);
    assert.equal(t.noShadow, true);
    assert.equal(t.coat, false);
    assert.equal(t.wantDark, null);
    core.shadeMode = 'off';
  });
  test('switching shading off after part-doing a section lets it finish (no stuck section)', () => {
    const a = mk('B112'),
      b = mk('R16');
    core.setCollection([a, mk('B111'), mk('B114'), b]);
    core.shadeMode = 'full';
    core.shadeSun = { x: 0, y: 0 };
    scene4(a, b);
    core.stepSet(1, 2, true); // base done, highlight and shadow not yet
    assert.equal(core.colored[1], 0);
    core.shadeMode = 'off';
    core.normalizeTones();
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
        const was = core.shadeStylePick(base, all, shadow),
          hl = core.shadePick(base, all, -1);
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
    core.setCollection(all);
    core.shadeMode = 'shadow';
    core.shadeSun = { x: 0, y: 0 };
    core.styleVars.shadeShadow = 'grey';
    // a colour whose grey shadow is laid over it
    const a = all.find((m) => core.shadeTones(m).glaze),
      b = all.find((m) => m !== a && m.lab[0] > 40);
    assert.ok(a && b);
    scene4(a, b);
    core.toneSteps = false;
    core.buildFocusOrder();
    const steps = JSON.parse(JSON.stringify(core.focusOrd.map((l, i) => [l, core.focusStep[i]]))).filter(
      (s) => s[0] <= 2,
    );
    assert.deepEqual(
      steps.map((s) => s[1]),
      [2, 2, 4, 4],
      'the base on both, then the shadow over both',
    );
    core.toneSteps = true;
    core.buildFocusOrder();
    const st = JSON.parse(JSON.stringify(core.focusOrd.map((l, i) => [l, core.focusStep[i]]))).filter(
      (s) => s[0] <= 2,
    );
    assert.deepEqual(
      st.map((s) => s[1]),
      [2, 2, 4, 4],
      'step by step too',
    );
    // the words: the shadow over the base once it's dry
    assert.match(core.stepText(1, 4).sub, /over the dry base, away from the light/);
    assert.match(core.shadeHowto(), /dry/);
    core.toneSteps = false;
    core.styleVars.shadeShadow = 'same';
    core.shadeMode = 'off';
  });
}

// ---- from v304-shading.test.mjs ----
// v304 shading: the smallest shaded section is SH_MINR in the guide's own pixels again (v303 took it on the picture as
// it came, so an enlarged download shaded about half what the same page photographed did), and the tone lines are as
// thick as on any picture that size; a big shape inside the page is shaded, and only the page's background at a
// quarter of the picture or more is left flat ("Background-sized"); tone lines are dashed along the line (by x + y, a
// line at 45° was drawn whole or not at all); the Colorless Blenders are never a marker to buy; the Highlights and
// Shadows sliders don't work the light out again; the caches that go by a coloured section's held shading see every
// change to it; Print's own Tone lines option, and the how-to without them.
{
  // (v320: an app of its own, as when this was a file of its own)
  const _app = createApp(),
    app = _app,
    core = _app.__mstest;
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
}

// ---- from v31815-shading-flow.test.mjs ----
// v318.15: Light from › The edges (each section darker along its lines, lighter in its middle; saved as the sun to an
// older copy); the shading presets (set the mode, Light from and the three amounts; chosen while they still match);
// Flow › Rings (out from the section under the centre through touching sections; islands next to their nearest);
// Matching shapes alike (each ring's matching shapes one marker, pins and coloured sections kept). Fails on v318.14.
{
  // a picture of sections found from ink where ink(x, y), each in the guide with one marker, shading on
  function built(W, H, ink) {
    const app = createApp(),
      t = app.__mstest,
      E = app.__eval;
    t.assign.quiet();
    t.assign.resetForNewPicture();
    const g = new Uint8Array(W * H).fill(255);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (ink(x, y)) g[y * W + x] = 0;
    t.srcK = 1;
    t.W = W;
    t.H = H;
    t.gray = g;
    t.segment();
    t.applyBg(true);
    const COLORS = E('COLORS'),
      lab = E('hexToLab'),
      mk = (c) => ({
        mkey: c.brand + '|' + c.code,
        code: c.code,
        brand: c.brand,
        hex: c.hex,
        name: c.name,
        fam: c.fam,
        lab: lab(c.hex),
      }),
      all = COLORS.filter((c) => c.brand === 'Ohuhu' && !/blender/i.test(c.name)).map(mk),
      cl = Array.from(t.countedList()),
      assign = {};
    cl.forEach((l, i) => (assign[l] = all[(i * 7) % all.length]));
    t.assignData = { assign, order: cl.slice(), N: cl.length, base: { ...assign } };
    t.labelPts = null;
    t.colored = new Uint8Array(t.comps.length);
    t.setCollection(all);
    t.shadeMode = 'full';
    t.shadeRound = 0.5;
    return { t, E, cl, all };
  }
  const sq = (x0, y0, s) => (x, y) =>
    (x >= x0 && x < x0 + s && (y === y0 || y === y0 + 1 || y === y0 + s - 1 || y === y0 + s - 2)) ||
    (y >= y0 && y < y0 + s && (x === x0 || x === x0 + 1 || x === x0 + s - 1 || x === x0 + s - 2));
  // a picture of cols × rows sections touching (no lines), each rw × rh
  function grid(cols, rows, rw = 40, rh = 40) {
    const app = createApp(),
      t = app.__mstest,
      W = cols * rw,
      H = rows * rh,
      labels = new Int32Array(W * H),
      comps = [null];
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++) {
        const l = comps.length;
        comps.push({
          cx: x * rw + rw / 2,
          cy: y * rh + rh / 2,
          area: rw * rh,
          merged: false,
          bg: false,
          x0: x * rw,
          y0: y * rh,
          x1: x * rw + rw - 1,
          y1: y * rh + rh - 1,
        });
        for (let py = y * rh; py < (y + 1) * rh; py++) labels.fill(l, py * W + x * rw, py * W + x * rw + rw);
      }
    t.W = W;
    t.H = H;
    t.labels = labels;
    t.comps = comps;
    t.secState = new Uint8Array(comps.length).fill(1);
    t.assignData = null;
    return { t, cl: Array.from(t.countedList()), at: (x, y) => 1 + y * cols + x };
  }
  // a mandala: a disc in the middle and rings of 8, 16 and 24 cells round it
  const mandala = (cx, cy) => (x, y) => {
    const r = Math.hypot(x - cx, y - cy),
      a = ((Math.atan2(y - cy, x - cx) * 180) / Math.PI + 360) % 360,
      spoke = (r0, r1, k) =>
        r > r0 && r < r1 && Math.min(a % (360 / k), 360 / k - (a % (360 / k))) * (Math.PI / 180) * r < 1.5;
    return (
      [30, 80, 140, 200].some((R) => Math.abs(r - R) < 2) ||
      spoke(30, 80, 8) ||
      spoke(80, 140, 16) ||
      spoke(140, 200, 24)
    );
  };
  test('Light from the edges: darker along the lines and into the corners, lighter in the middle, the same each side', () => {
    // (a square 120 px across: not so big it's taken for a frame round the picture)
    const { t } = built(300, 300, sq(90, 90, 120));
    t.styleVars.shadeLight = 'edges';
    // (a copy: the field is worked out again in place)
    const V = t.shadeField(1).slice(),
      at = (x, y) => V[y * 300 + x];
    const mid = at(150, 150),
      near = at(150, 96),
      corner = at(95, 95);
    assert.ok(near > mid + 100, `by the line ${near}, middle ${mid}`);
    assert.ok(corner >= near, `corner ${corner}`);
    // the same on each side, whatever the sun
    for (const [a, b] of [
      [at(96, 150), at(203, 150)],
      [at(150, 96), at(150, 203)],
      [at(120, 150), at(179, 150)],
    ])
      assert.ok(Math.abs(a - b) <= 2, `${a} ${b}`);
    t.shadeSun = { x: 0.9, y: 0.9 };
    const V2 = t.shadeField(1);
    assert.equal(V2[96 * 300 + 150], near);
    // rounder: the shadow reaches further in
    t.zshSet(t.zoneCur, 'round', 0.9);
    const V3 = t.shadeField(1);
    assert.ok(V3[150 * 300 + 120] > at(120, 150), `${V3[150 * 300 + 120]} > ${at(120, 150)}`);
  });
  test('Light from the sun is as it was; the edges are saved as the sun to an older copy, and read back', () => {
    const { t } = built(300, 300, sq(90, 90, 120));
    t.styleVars.shadeLight = 'sun';
    t.shadeSun = { x: 0.1, y: 0.1 };
    const V = t.shadeField(1);
    // with the sun at the top left, the top left of the square is lighter than its bottom right
    assert.ok(V[100 * 300 + 100] < V[200 * 300 + 200]);
    const fields = [...t.styleFields],
      src = fields.find((f) => f.key === 'lightSrc'),
      legacy = fields.find((f) => f.key === 'light');
    t.styleVars.shadeLight = 'edges';
    assert.equal(legacy.save(), 'sun');
    assert.equal(src.check('edges', src.def), 'edges');
    // an older copy's unknown value falls back to the sun it wrote alongside
    assert.equal(src.check('glow', src.def, { light: 'sun' }), 'sun');
  });
  test('presets: each sets the mode, Light from and the three amounts; chosen while all still match', () => {
    const { t } = built(300, 300, sq(50, 50, 200));
    const P = [...t.SH_PRESETS];
    assert.deepEqual(
      P.map((p) => p.k),
      ['soft', 'dramatic', 'rounded', 'neuro'],
    );
    for (const p of P) {
      assert.equal(t.shPresetApply(p.k), true);
      assert.equal(t.shadeMode, p.mode);
      // (v318.16: a sun style leaves Light from as it was unless it was the edges: auto here, the sun with no photo)
      assert.ok(
        t.styleVars.shadeLight === p.light || (p.light === 'sun' && t.styleVars.shadeLight === 'auto'),
        p.k,
      );
      const z = t.zsh(t.zoneCur);
      assert.equal(z.round, p.round);
      assert.equal(z.hi, p.hi);
      assert.equal(z.lo, p.lo);
      assert.deepEqual(
        P.filter((q) => t.shPresetOn(q)).map((q) => q.k),
        [p.k],
      );
    }
    // a slider moved: none chosen
    t.zshSet(t.zoneCur, 'hi', 0.47);
    assert.equal(
      P.some((q) => t.shPresetOn(q)),
      false,
    );
    assert.equal(t.shPresetApply('nope'), false);
  });
  test('Rings: steps through touching sections from the one under the centre; islands next to the nearest reached', () => {
    const { t, cl, at } = grid(5, 5);
    t.styleVars.radC = { x: 0.5, y: 0.5 };
    const d = t.ringDepths(cl);
    for (let y = 0; y < 5; y++)
      for (let x = 0; x < 5; x++) assert.equal(d[at(x, y)], Math.abs(x - 2) + Math.abs(y - 2), `${x},${y}`);
    // from a corner
    t.styleVars.radC = { x: 0.05, y: 0.05 };
    assert.equal(t.ringDepths(cl)[at(4, 4)], 8);
    // a zone of rows 0 and 2 only, the centre in row 2: row 0 is cut off, each next to the one below it
    t.styleVars.radC = { x: 0.5, y: 0.5 };
    const z = cl.filter((l) => [0, 2].includes(Math.floor((l - 1) / 5))),
      dz = t.ringDepths(z);
    assert.equal(dz[at(2, 2)], 0);
    assert.equal(dz[at(0, 2)], 2);
    assert.equal(dz[at(2, 0)], 1);
    assert.equal(dz[at(0, 0)], 3);
    assert.equal(dz[at(2, 1)], undefined, 'not in the zone');
    // the centre over a section not in the zone: the zone's nearest
    t.styleVars.radC = { x: 0.5, y: 0.38 };
    assert.equal(t.ringDepths(z)[at(2, 2)], 0);
    // ordered ring by ring
    t.styleVars.radC = { x: 0.5, y: 0.5 };
    t.styleVars.gradShape = 'rings';
    const o = t.grad.order(cl),
      dd = t.ringDepths(cl);
    assert.equal(o[0], at(2, 2));
    for (let i = 1; i < o.length; i++) assert.ok(dd[o[i]] >= dd[o[i - 1]]);
  });
  test('Matching shapes alike: each ring’s matching shapes are a group, laid in one marker; pins and coloured kept', () => {
    const { t, cl, all } = built(440, 440, mandala(220, 220));
    assert.ok(t.grad.mandala(cl), 'looks like a mandala');
    const groups = [...t.mandalaGroups(cl)].map((g) => [...g]).sort((a, b) => a.length - b.length);
    assert.deepEqual(
      groups.map((g) => g.length),
      [8, 16, 24],
    );
    const A = t.assignData.assign,
      [g8, g16, g24] = groups;
    // the ring of 8 takes its pinned member's marker; the ring of 16 a coloured member's (which isn't changed); the
    // ring of 24 the marker most of it has
    const pin = g8[3],
      col = g16[5],
      pm = A[pin],
      cm = A[col],
      most = all.find((m) => m !== pm && m !== cm);
    g24.slice(0, 13).forEach((l) => (A[l] = most));
    t.locks[pin] = pm.mkey;
    t.colored[col] = 1;
    const n = t.matchUnify(cl);
    assert.equal(n, 7 + 15 + 11);
    assert.ok(g8.every((l) => A[l] === pm));
    assert.ok(g16.every((l) => A[l] === cm));
    assert.ok(g24.every((l) => A[l] === most));
    // the pattern's own marker follows for each one changed (what Unpin brings back; the 13 above were set by hand)
    assert.ok([...g8, ...g16, ...g24.slice(13)].every((l) => t.assignData.base[l] === A[l]));
    // the disc in the middle keeps its own
    const rest = cl.filter((l) => !g8.includes(l) && !g16.includes(l) && !g24.includes(l));
    assert.equal(rest.length, 1);
    assert.ok(rest.every((l) => A[l] === t.assignData.base[l]));
    // again: nothing more to do
    assert.equal(t.matchUnify(cl), 0);
    // a page that isn't a mandala has no groups
    const g = built(300, 300, sq(90, 90, 120));
    assert.equal(g.t.mandalaGroups(g.cl).length, 0);
  });
  test('Matching shapes alike is saved only when on, and a guide saved before reads it as off', () => {
    const t = createApp().__mstest,
      f = [...t.styleFields].find((x) => x.key === 'matchAlike');
    assert.equal(f.def, false);
    t.styleVars.matchAlike = false;
    assert.equal(f.save(), undefined);
    t.styleVars.matchAlike = true;
    assert.equal(f.save(), true);
    assert.equal(f.check(undefined, f.def), false);
    const s = [...t.styleFields].find((x) => x.key === 'gradShape');
    assert.equal(s.check('rings', s.def), 'rings');
  });
}

// ---- from v31816-shading-row.test.mjs ----
// v318.16: the Shading row's styles are the whole picture's look: each sets the mode, Main's and every zone's
// Roundness, Highlights and Shadows amounts, and Light from only between the sun and the edges (a photo's light is
// kept, Neuro is the edges); a style is chosen while Main and every shaded zone match it, else Custom (none chosen).
// Fails on v318.15 (its presets set only the chosen zone's, and the photo's light went).
{
  function withZones() {
    const t = createApp().__mstest;
    t.W = 10;
    t.H = 10;
    t.zoneOpen(
      [
        { name: 'Bell', secs: [1] },
        { name: 'Foot', secs: [2] },
      ],
      { 1: 11, 2: 12 },
    );
    return t;
  }
  const amounts = (t, id) => {
    const z = t.zsh(id);
    return [z.round, z.hi, z.lo];
  };
  test('a style sets Main and every zone, and is chosen while they all match', () => {
    const t = withZones(),
      ids = Array.from(t.zones, (z) => z.id);
    assert.equal(ids.length, 2);
    // a zone with amounts of its own first
    t.zshSet(ids[0], 'round', 0.2);
    assert.equal(t.shPresetApply('dramatic'), true);
    assert.equal(t.shadeMode, 'full');
    for (const id of [0, ...ids]) assert.deepEqual(amounts(t, id), [0.6, 0.6, 0.65], 'zone ' + id);
    assert.equal(t.shStyleCur().k, 'dramatic');
    // one zone's Roundness moved: Custom
    t.zshSet(ids[1], 'round', 0.3);
    assert.equal(t.shStyleCur(), null);
    // Shadows only is never a style
    t.shPresetApply('soft');
    assert.equal(t.shStyleCur().k, 'soft');
    t.shadeMode = 'shadow';
    assert.equal(t.shStyleCur(), null);
    assert.equal(t.shPresetApply('nope'), false);
  });
  test('Light from: the sun and the edges follow the style; a photo’s light is kept (Neuro is the edges)', () => {
    const t = createApp().__mstest;
    t.styleVars.shadeLight = 'edges';
    t.shPresetApply('soft');
    assert.equal(t.styleVars.shadeLight, 'sun', 'from the edges to the sun');
    t.shPresetApply('neuro');
    assert.equal(t.styleVars.shadeLight, 'edges');
    t.styleVars.shadeLight = 'photo';
    t.shPresetApply('rounded');
    assert.equal(t.styleVars.shadeLight, 'photo', 'the photo’s light kept');
    t.styleVars.shadeLight = 'auto';
    t.shPresetApply('soft');
    assert.equal(t.styleVars.shadeLight, 'auto', 'as it was');
  });
  test('Shadows only (Highlights › None) is saved as it always was: mode shadow', () => {
    const t = createApp().__mstest,
      f = [...t.styleFields].find((x) => x.key === 'mode' && x.in === 'shade');
    assert.equal(f.check('shadow', f.def), 'shadow');
  });
}

// ---- from v31817.test.mjs ----
// v318.17: Shadows only per zone (a record's Highlights None: no H for its sections, the rest as they were; leaving the
// whole picture's Shadows only from one zone keeps the others and every coloured section as they are); Blender
// highlights (the Colorless Blender you own as the H, the base lifted, never a lighter marker to buy); themes in Lean
// towards (Sunset, Forest, Candy from your markers; v318.18: their own Theme, v31818, widened to the nearest when too few). Fails on v318.16.
{
  function appWith(sets) {
    const app = createApp(),
      E = app.__eval,
      t = app.__mstest;
    E('state.owned = new Set()');
    for (const n of sets)
      E(
        `presetMkeys(MARKER_SETS.find((s) => s.n === ${JSON.stringify(n)})).forEach((k) => state.owned.add(k))`,
      );
    t.coll = E('sfCollection()');
    t.setCollection(t.coll);
    return { t, E };
  }
  const by = (t, code) => [...t.coll].find((m) => m.code === code);
  test('Highlights None in a record: no highlight for its sections, others keep theirs', () => {
    const { t } = appWith(['Honolulu 120']);
    t.shadeMode = 'full';
    const zsS = { shadow: 'same', hilite: 'same', hi: 0.5, lo: 0.5, round: 0.5, on: true },
      // (a colour of the set with a lighter marker of its own)
      base = [...t.coll].find((m) => t.shadeTones(m, zsS).light && t.shadeTones(m, zsS).dark),
      on = t.shadeTones(base, zsS),
      off = t.shadeTones(base, { shadow: 'same', hilite: 'none', hi: 0.5, lo: 0.5, round: 0.5, on: true });
    assert.ok(on.light, 'a lighter marker with Same colour');
    assert.equal(off.light, null);
    assert.equal(off.noHi, true);
    assert.equal(off.wantLight, null, 'nothing to buy for a highlight that isn’t there');
    assert.equal(off.dark, on.dark, 'the shadow as before');
    assert.equal(t.hiOn({ hilite: 'none' }), false);
    assert.equal(t.hiOn({ hilite: 'same' }), true);
    t.shadeMode = 'shadow';
    assert.equal(t.hiOn({ hilite: 'same' }), false, 'the whole picture’s Shadows only, as before');
  });
  test('leaving whole-picture Shadows only from one zone: the other zones and Main None', () => {
    const t = createApp().__mstest;
    t.W = 10;
    t.H = 10;
    t.zoneOpen(
      [
        { name: 'Bell', secs: [1] },
        { name: 'Foot', secs: [2] },
      ],
      { 1: 11, 2: 12 },
    );
    const [a, b] = Array.from(t.zones, (z) => z.id);
    t.zshSet(a, 'hilite', 'same');
    t.shZonesNone(a);
    assert.equal(t.zsh(a).hilite, 'same', 'the chosen zone as it was');
    assert.equal(t.zsh(b).hilite, 'none');
    assert.equal(t.zsh(0).hilite, 'none', 'Main too');
  });
  test('a section coloured under Shadows only is held as None; with shading off, as before', () => {
    const t = createApp().__mstest;
    t.W = 10;
    t.H = 10;
    t.colored = new Uint8Array(20);
    t.colored[5] = 1;
    t.colored[6] = 1;
    t.shadeMode = 'shadow';
    t.zshOf(5);
    assert.equal(t.heldSh[5].hilite, 'none', 'coloured without a highlight');
    t.shadeMode = 'off';
    t.zshOf(6);
    assert.equal(t.heldSh[6].hilite, 'same', 'shading off: the kind as it is');
    // highlights on after: the one held as None stays without
    t.shadeMode = 'full';
    assert.equal(t.hiOn(t.zshOf(5)), false);
    assert.equal(t.hiOn(t.zshOf(6)), true);
  });
  test('the last zone deleted with Main’s Highlights None: the whole picture is Shadows only, as it’s saved', () => {
    const t = createApp().__mstest;
    t.W = 10;
    t.H = 10;
    t.zoneOpen([{ name: 'Bell', secs: [1] }], { 1: 11 });
    t.shadeMode = 'full';
    t.zshSet(0, 'hilite', 'none');
    t.zoneDelete(t.zones[0].id);
    assert.equal(t.zones.length, 0);
    assert.equal(t.shadeMode, 'shadow');
    assert.equal(t.zsh(0).hilite, 'same');
  });
  test('Blender: the Colorless Blender you own is the H (its own brand’s), the base lifted; no lighter marker to buy', () => {
    const { t } = appWith(['Honolulu 120']);
    t.shadeMode = 'full';
    const base = by(t, 'R16') || t.coll[40],
      zs = { shadow: 'same', hilite: 'blender', hi: 0.5, lo: 0.5, round: 0.5, on: true },
      b = t.shadeTones(base, zs);
    assert.ok(b.light, 'the blender');
    assert.equal(b.blender, true);
    assert.match(b.light.name, /colou?rless blender/i);
    assert.equal(b.light.brand, base.brand);
    assert.equal(b.wantLight, null);
    // lighter than the base, not white
    const hx = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)),
      sum = (c) => c[0] + c[1] + c[2];
    assert.ok(sum(hx(b.light.hex)) > sum(hx(base.hex)), b.light.hex + ' over ' + base.hex);
    assert.notEqual(b.light.hex.toLowerCase(), '#ffffff');
    // a smaller lit part, as the paper's
    const same = t.shadeTones(base, { ...zs, hilite: 'same' });
    assert.ok(b.T2 < same.T2);
  });
  test('the highlight kinds saved: blender and none are values; an older value still reads', () => {
    const t = createApp().__mstest,
      f = [...t.styleFields].find((x) => x.key === 'hilite' && x.in === 'shade');
    for (const v of ['same', 'warm', 'paper', 'blender', 'none']) assert.equal(f.check(v, f.def), v);
    assert.equal(f.check('glitter', f.def), 'same');
    // (v318.18: the themes are their own setting, theme; palette is Any, Cool or Warm again: see v31818)
    const p = [...t.styleFields].find((x) => x.key === 'palette');
    for (const v of ['all', 'cool', 'warm']) assert.equal(p.check(v, p.def), v);
    assert.equal(p.check('sunset', p.def), 'all');
  });
  test('themes: each finds its own colours in a full set, and widens to the nearest in a small one, saying so', () => {
    for (const set of ['Honolulu 320 (complete set)', 'Honolulu 120', 'All Copic markers']) {
      const { t } = appWith([set]);
      for (const k of ['sunset', 'forest', 'blossom']) {
        const pool = [...t.colour.poolFor('all', k)],
          w = t.themeEntry('all', k).wide;
        assert.ok(pool.length >= 8, `${set} ${k}: ${pool.length}`);
        assert.ok(w.inside >= 6, `${set} ${k}: ${w.inside} inside`);
      }
    }
    const { t } = appWith(['Honolulu 24']);
    const pool = [...t.colour.poolFor('all', 'blossom')];
    assert.ok(pool.length >= 8, 'widened to 8: ' + pool.length);
    assert.ok(t.themeEntry('all', 'blossom').wide.added > 0);
    t.styleVars.theme = 'blossom';
    assert.match(t.themeNote(), /^(Few|No) blossom colours in your markers: the nearest \d+ (added|used)\.$/);
  });
}
