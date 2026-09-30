// The Gradient pattern (js/guide/30-palette-assign.js) and its two rows: Look (Pattern tab: Auto, Smooth, Light to
// dark) and Mood (Colours tab: Any, Bright, Soft, Pastel, Deep, Earthy, which replaced Intensity). Which markers a
// gradient uses and the line that says so, loop or ramp and what Shuffle does with each, sharing by area, shading's
// light side, old guides opening unchanged, and speed with a big guide. The engine's parts are unit-tested in
// test/gradient.test.mjs.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, sampleGuide, idle, notOnWebKit, WK } from './helpers.mjs';

before(setup);
after(teardown);

// Math.random from a seed: __seed(n) before anything random makes it repeatable
const SEEDED = () => {
  let a = 1;
  window.__seed = (n) => {
    a = n >>> 0;
  };
  Math.random = function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const click = (page, sel) => page.evaluate((sel) => document.querySelector(sel).click(), sel);
const tab = (page, t) => click(page, `.sftabbtn[data-t="${t}"]`);
const keys = (page) => page.evaluate(() => { const a = __mstest.assignData; return a.order.map((l) => a.assign[l].mkey); });
const assignMap = (page) => page.evaluate(() => { const a = __mstest.assignData.assign, o = {}; for (const k in a) o[k] = a[k].mkey; return o; });
const style = (page) => page.evaluate(() => __mstest.currentDesignObj().payload.style);
const pressed = (page, sel) => page.evaluate((sel) => [...document.querySelectorAll(sel + ' button')].filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.textContent), sel);
const poolLine = (page) => page.textContent('#sfPanel-colours .sfpoolct');
// the sample with the whole Honolulu 320 set owned (more markers than the sample's sections)
async function sample320(page) {
  await sampleGuide(page);
  await page.evaluate(() => {
    presetMkeys(MARKER_SETS.find((s) => s.n === 'Honolulu 320 (complete set)')).forEach((k) => state.owned.add(k));
    save();
    __mstest.coll = sfCollection();
    SF.reassign();
  });
  await idle(page);
}
// the open guide reopened (as `name`) with its payload changed by `edit`
async function reopenAs(page, name, edit) {
  await page.evaluate(([name, edit]) => {
    const d = __mstest.currentDesignObj(), p = d.payload;
    // eslint-disable-next-line no-new-func
    new Function('p', edit)(p);
    __mstest.openDesignObj(Object.assign({}, p, { name, W: d.W, H: d.H }), null);
  }, [name, edit]);
  await page.waitForFunction((name) => __mstest.curName === name && __mstest.assignData, name);
  await idle(page);
}

test('Look: three choices under Direction (Gradient only); each redraws the picture, is saved with the guide and taken back by Undo', async () => {
  const { page, errors } = await openApp();
  await sample320(page);
  await tab(page, 'pattern');
  await click(page, '#sfShape [data-v="diagonal"]'); await idle(page);
  await page.evaluate(() => { __mstest.styleVars.limitN = 60; SF.reassign(); }); await idle(page);
  assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('#sfLook button')].map((b) => [b.dataset.v, b.textContent])), [['auto', 'Auto'], ['smooth', 'Smooth'], ['ltd', 'Light to dark']]);
  assert.deepEqual(await pressed(page, '#sfLook'), ['Auto']);
  // the line under it says what Auto is doing
  assert.match(await page.textContent('#sfLookNote'), /^Auto: (smooth|bands of \d+ markers|light to dark)/);
  const pics = { auto: JSON.stringify(await assignMap(page)) };
  const n0 = await page.evaluate(() => __mstest.planCount);
  for (const [v, label] of [['smooth', 'Smooth'], ['ltd', 'Light to dark']]) {
    await click(page, `#sfLook [data-v="${v}"]`); await idle(page);
    pics[v] = JSON.stringify(await assignMap(page));
    assert.equal((await style(page)).look, v);
    assert.deepEqual(await pressed(page, '#sfLook'), [label]);
    assert.equal(await page.evaluate(() => __mstest.planLabel), 'Look: ' + label);
    assert.equal(await page.isVisible('#sfLookNote'), false, 'the note is Auto’s');
  }
  assert.equal(new Set(Object.values(pics)).size, 3, 'three different pictures');
  assert.equal(await page.evaluate(() => __mstest.planCount), n0 + 2, 'one step each');
  await page.keyboard.press('Control+z'); await idle(page);
  assert.equal((await style(page)).look, 'smooth');
  assert.equal(JSON.stringify(await assignMap(page)), pics.smooth);
  // saved and opened again
  await click(page, '#sfLook [data-v="ltd"]'); await idle(page);
  await page.click('#sfSave'); await page.waitForFunction(() => /Saved in your Library/.test(document.getElementById('sfSaveSt').textContent));
  const id = await page.evaluate(() => __mstest.curId), was = await assignMap(page);
  await page.reload(); await idle(page);
  await page.evaluate((id) => loadGuide({ id }), id);
  await page.waitForFunction((id) => __mstest.curId === id && __mstest.assignData, id); await idle(page);
  assert.equal((await style(page)).look, 'ltd');
  assert.deepEqual(await assignMap(page), was);
  // not for other patterns
  await tab(page, 'pattern');
  await click(page, '#sfFam [data-v="random"]'); await idle(page);
  assert.equal(await page.$('#sfLook'), null);
  assert.deepEqual(errors, []);
});

test('Auto’s note: smooth while each marker covers several sections, light to dark when every section has its own', async () => {
  const { page, errors } = await openApp();
  await sample320(page);
  await tab(page, 'pattern');
  assert.equal(await page.textContent('#sfLookNote'), 'Auto: smooth, as Serpentine runs in rows.');
  await click(page, '#sfShape [data-v="diagonal"]'); await idle(page);
  const n = await page.evaluate(() => __mstest.countedList().length);
  assert.equal(await page.textContent('#sfLookNote'), `Auto: smooth, as each marker covers about ${Math.round(n / 16)} sections.`);
  await page.evaluate(() => { __mstest.styleVars.limitN = 999; SF.reassign(); }); await idle(page);
  assert.equal(await page.textContent('#sfLookNote'), 'Auto: light to dark, as every section has its own marker.');
  assert.deepEqual(errors, []);
});

test('Mood: six choices in two rows, in order; filters your markers; old guides’ Vivid and Muted open as Bright and Soft', notOnWebKit(WK.font), async () => {
  const { page, errors } = await openApp();
  await sample320(page);
  await tab(page, 'colours');
  assert.equal(await page.$('#sfEmph'), null, 'Intensity is gone');
  assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('#sfMood button')].map((b) => b.textContent)), ['Any', 'Bright', 'Soft', 'Pastel', 'Deep', 'Earthy']);
  // one even row where every label fits, else two even rows of three
  const rows = () => page.evaluate(() => [...document.querySelectorAll('#sfMood button')].map((b) => [Math.round(b.getBoundingClientRect().top), Math.round(b.getBoundingClientRect().width), b.scrollWidth <= b.clientWidth + 1]));
  let r = await rows();
  assert.equal(new Set(r.map((x) => x[0])).size, 1, 'one row at 390 wide');
  assert.equal(new Set(r.map((x) => x[1])).size, 1, 'even widths');
  await page.setViewportSize({ width: 300, height: 844 }); await idle(page);
  r = await rows();
  assert.deepEqual([new Set(r.slice(0, 3).map((x) => x[0])).size, new Set(r.slice(3).map((x) => x[0])).size], [1, 1]);
  assert.ok(r[3][0] > r[0][0], 'two rows of three');
  assert.ok(r.every((x) => x[2]), 'every label fits');
  await page.setViewportSize({ width: 390, height: 844 }); await idle(page);
  assert.deepEqual(await pressed(page, '#sfMood'), ['Any']);
  // Pastel: every marker the gradient uses is light
  await click(page, '#sfMood [data-v="pastel"]'); await idle(page);
  assert.equal(await page.evaluate(() => __mstest.planLabel), 'Mood: Pastel');
  assert.equal((await style(page)).emphasis, 'pastel');
  const L = await page.evaluate(() => { const a = __mstest.assignData; return a.order.map((l) => a.assign[l].lab[0]); });
  assert.ok(Math.min(...L) >= 78, 'lightest ' + Math.min(...L).toFixed(1));
  // Deep, for Random too
  await click(page, '#sfMood [data-v="deep"]'); await idle(page);
  await tab(page, 'pattern'); await click(page, '#sfFam [data-v="random"]'); await idle(page);
  const pool = await page.evaluate(() => __mstest.activePool().map((m) => m.lab[0]));
  assert.ok(Math.max(...pool) <= 52, 'deep: ' + Math.max(...pool).toFixed(1));
  // more markers than fit a Mood: widened to the nearest, and the line says so
  await click(page, '#sfFam [data-v="gradient"]'); await idle(page);
  await tab(page, 'colours');
  await page.evaluate(() => { __mstest.styleVars.emphasis = 'earthy'; __mstest.styleVars.limitN = 999; SF.reassign(); }); await idle(page);
  assert.match(await poolLine(page), /^Earthy: \d+ of your markers are earthy; the rest are the nearest to earthy$/);
  // an old guide: vivid and muted are Bright and Soft; no look is Auto
  for (const [old, label] of [['vivid', 'Bright'], ['muted', 'Soft']]) {
    await reopenAs(page, 'Old ' + old, `p.style.emphasis = '${old}'; delete p.style.look;`);
    await tab(page, 'colours');
    assert.deepEqual(await pressed(page, '#sfMood'), [label]);
    assert.equal((await style(page)).look, 'auto');
  }
  assert.deepEqual(errors, []);
});

test('Mood with a saved palette is greyed out (used as it is); with Generate palette it goes to the generator', async () => {
  const { page, errors } = await openApp({ init: SEEDED });
  await sampleGuide(page);
  // what the guide asks the generator for
  await page.evaluate(() => {
    window.__genCalls = [];
    const g = window.genPalette;
    window.genPalette = function (n, h, opts) { window.__genCalls.push([n, h, opts && opts.mood]); return g(n, h, opts); };
  });
  await tab(page, 'colours');
  await page.evaluate(() => window.__seed(3));
  await click(page, '#sfSrc [data-v="generate"]'); await idle(page);
  await click(page, '#sfMood [data-v="vivid"]'); await idle(page);
  const calls = await page.evaluate(() => window.__genCalls);
  assert.ok(calls.length >= 2);
  assert.equal(calls[0][2], 'neutral');
  assert.equal(calls[calls.length - 1][2], 'vivid', 'a new palette for the Mood');
  assert.equal(await page.isEnabled('#sfMood [data-v="pastel"]'), true);
  assert.match(await poolLine(page), /^Using (all )?\d+ .*generated markers/);
  // a saved palette
  page.on('dialog', (d) => d.accept());
  await page.evaluate(() => { const id = 777001; state.saved.unshift({ id, type: 'palette', name: 'P', keys: [...state.owned].slice(0, 6), ts: id }); save(); SF.setSavedSource(id); });
  await click(page, '#sfSrc [data-v="saved"]'); await idle(page);
  assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('#sfMood button')].map((b) => b.disabled)), [true, true, true, true, true, true]);
  assert.equal(await poolLine(page), 'Using all 6 of the saved palette’s markers, as it is');
  const was = await keys(page);
  await page.evaluate(() => { __mstest.styleVars.emphasis = 'pastel'; SF.reassign(); }); await idle(page);
  assert.deepEqual(await keys(page), was, 'a saved palette’s markers whatever the Mood');
  assert.deepEqual(errors, []);
});

test('which markers: never more than sections, no greys while there are coloured ones, and the line says how many', async () => {
  const { page, errors } = await openApp();
  await sample320(page);
  await tab(page, 'colours');
  const n = await page.evaluate(() => __mstest.countedList().length);
  assert.equal(await poolLine(page), 'Using 16 of 320 markers');
  await page.evaluate(() => { __mstest.styleVars.limitN = 999; SF.reassign(); }); await idle(page);
  const k = await keys(page);
  assert.equal(k.length, n);
  assert.equal(new Set(k).size, n, 'one marker per section');
  assert.equal(await poolLine(page), `Using ${n} of 320 markers: one per section`);
  const greys = await page.evaluate(() => { const a = __mstest.assignData; return a.order.filter((l) => Math.hypot(a.assign[l].lab[1], a.assign[l].lab[2]) < 12).length; });
  assert.equal(greys, 0);
  // Random and Blend: the marker count's worth
  await tab(page, 'pattern'); await click(page, '#sfFam [data-v="blend"]'); await idle(page);
  await page.evaluate(() => { __mstest.styleVars.limitN = 20; SF.reassign(); }); await idle(page);
  await tab(page, 'colours');
  assert.equal(await poolLine(page), 'Using 20 of 320 markers');
  // demo mode: the catalogue
  await page.evaluate(() => { state.owned.clear(); save(); __mstest.coll = sfCollection(); SF.reassign(); }); await idle(page);
  assert.match(await poolLine(page), /^Using 20 of \d+ catalogue markers$/);
  assert.deepEqual(errors, []);
});

test('loop or ramp: your markers loop (Shuffle turns the start); a narrow generated palette runs end to end (Shuffle makes a new one); a saved one can’t shuffle', async () => {
  const { page, errors } = await openApp({ init: SEEDED });
  await sample320(page);
  await tab(page, 'pattern');
  await click(page, '#sfShape [data-v="vertical"]'); await idle(page);
  assert.equal(await page.evaluate(() => __mstest.grad.plan(__mstest.grad.poolSource(16), __mstest.countedList().length).loop), true);
  const k0 = await keys(page);
  await page.evaluate(() => window.__seed(4));
  await click(page, '#sfVary'); await idle(page);
  const k1 = await keys(page);
  assert.notDeepEqual(k1, k0);
  assert.deepEqual([...new Set(k1)].sort(), [...new Set(k0)].sort(), 'the same markers, starting elsewhere');
  assert.equal(await page.evaluate(() => __mstest.planLabel), 'Colours shuffled');
  // a one-hue generated palette: a ramp, lighter end first
  await tab(page, 'colours');
  await page.evaluate(() => window.__seed(5));
  await click(page, '#sfSrc [data-v="generate"]'); await idle(page);
  await page.selectOption('#sfHarm', 'mono'); await idle(page);
  const plan = await page.evaluate(() => { const p = __mstest.grad.plan(__mstest.grad.poolSource(16), __mstest.countedList().length); return { loop: p.loop, L: p.seq.map((m) => m.lab[0]) }; });
  assert.equal(plan.loop, false);
  assert.ok(plan.L[0] >= plan.L[plan.L.length - 1]);
  const g0 = await page.evaluate(() => [...__mstest.genPal]);
  await tab(page, 'pattern');
  await page.evaluate(() => window.__seed(6));
  await click(page, '#sfVary'); await idle(page);
  assert.notDeepEqual(await page.evaluate(() => [...__mstest.genPal]), g0, 'a new palette of the same scheme');
  assert.equal((await style(page)).genHarmony, 'mono');
  // Direction flips it
  const r0 = await keys(page);
  await click(page, '#sfDir [data-d="-1"]'); await idle(page);
  assert.notDeepEqual(await keys(page), r0);
  // a saved palette of one hue: Shuffle is greyed out, and says why
  page.on('dialog', (d) => d.accept());
  await page.evaluate(() => {
    const reds = __mstest.coll.filter((m) => { const x = lchOf(m.lab); return x[1] >= 12 && x[2] > 15 && x[2] < 45; }).slice(0, 7);
    state.saved.unshift({ id: 777005, type: 'palette', name: 'Reds', keys: reds.map((m) => m.mkey), ts: 777005 });
    save();
    SF.setSavedSource(777005);
    SF.reassign();
  });
  await idle(page);
  assert.equal(await page.isDisabled('#sfVary'), true);
  assert.equal(await page.textContent('#sfShWhy'), 'This palette runs from one end to the other: Direction flips it.');
  assert.equal(await page.getAttribute('#sfVary', 'aria-describedby'), 'sfShWhy');
  // one that goes round the wheel can
  await page.evaluate(() => {
    const all = __mstest.coll.filter((m) => lchOf(m.lab)[1] >= 30), pick = [];
    for (let h = 0; h < 360; h += 45) { let b = null, bd = 1e9; all.forEach((m) => { const x = lchOf(m.lab), d = Math.min(Math.abs(x[2] - h), 360 - Math.abs(x[2] - h)); if (d < bd) { bd = d; b = m; } }); pick.push(b.mkey); }
    state.saved.unshift({ id: 777006, type: 'palette', name: 'Wheel', keys: [...new Set(pick)], ts: 777006 });
    save();
    SF.setSavedSource(777006);
    SF.reassign();
  });
  await idle(page);
  assert.equal(await page.isDisabled('#sfVary'), false);
  assert.equal(await page.$('#sfShWhy'), null);
  assert.deepEqual(errors, []);
});

test('sharing by area: on the sample each marker’s share of the picture is more even than sharing by count would give', async () => {
  const { page, errors } = await openApp();
  await sample320(page);
  await tab(page, 'pattern');
  for (const shape of ['diagonal', 'radial', 'vertical']) {
    await click(page, `#sfShape [data-v="${shape}"]`); await idle(page);
    const r = await page.evaluate(() => {
      const a = __mstest.assignData, c = __mstest.comps, per = {}, M = new Set(a.order.map((l) => a.assign[l].mkey)).size;
      let tot = 0;
      a.order.forEach((l) => { const k = a.assign[l].mkey; per[k] = (per[k] || 0) + c[l].area; tot += c[l].area; });
      // by count: the same order cut into M equal runs of sections
      const byCount = new Array(M).fill(0), N = a.order.length;
      a.order.forEach((l, i) => { byCount[Math.floor((i * M) / N)] += c[l].area; });
      // how far the shares are from even, on average (a section bigger than a share can't be split, so not 0)
      const spread = (xs) => xs.reduce((d, x) => d + Math.abs(x / tot - 1 / M), 0) / M;
      return { M, area: spread(Object.values(per)), count: spread(byCount) };
    });
    assert.equal(r.M, 16);
    assert.ok(r.area < r.count * 0.8, `${shape}: off even by ${(100 * r.area).toFixed(2)} points by area, ${(100 * r.count).toFixed(2)} by count`);
  }
  assert.deepEqual(errors, []);
});

test('Light to dark: bands are light at the top, or on the sun’s side once there’s shading (and turn when it moves); Undo takes it back', async () => {
  const { page, errors } = await openApp();
  await sample320(page);
  await tab(page, 'pattern');
  await click(page, '#sfShape [data-v="vertical"]'); await idle(page);
  await page.evaluate(() => { __mstest.styleVars.limitN = 64; });
  await click(page, '#sfLook [data-v="ltd"]'); await idle(page);
  const topMinusBottom = () => page.evaluate(() => {
    const a = __mstest.assignData, c = __mstest.comps, H = __mstest.H, t = [], b = [];
    a.order.forEach((l) => { if (c[l].cy < H * 0.3) t.push(a.assign[l].lab[0]); else if (c[l].cy > H * 0.7) b.push(a.assign[l].lab[0]); });
    const m = (x) => x.reduce((s, v) => s + v, 0) / x.length;
    return m(t) - m(b);
  });
  assert.ok((await topMinusBottom()) > 5, 'light at the top');
  const before = await assignMap(page);
  await page.evaluate(() => { __mstest.styleVars.shadeSun = { x: 0.5, y: 0.95 }; });
  await tab(page, 'shading');
  await click(page, '#sfShade [data-v="shadow"]'); await idle(page);
  assert.ok((await topMinusBottom()) < -5, 'light at the bottom, by the sun');
  assert.equal(await page.evaluate(() => __mstest.planLabel), 'Shading: Shadows');
  await page.keyboard.press('Control+z'); await idle(page);
  assert.deepEqual(await assignMap(page), before);
  // an opened guide keeps its markers when the shading changes
  await reopenAs(page, 'Opened', '');
  const opened = await assignMap(page);
  await tab(page, 'shading');
  await click(page, '#sfShade [data-v="full"]'); await idle(page);
  assert.deepEqual(await assignMap(page), opened);
  assert.deepEqual(errors, []);
});

test('Surprise picks a Look and a Mood too (mostly Auto and Any)', async () => {
  const { page, errors } = await openApp({ init: SEEDED });
  await sampleGuide(page);
  const looks = new Set(), moods = new Set();
  for (let i = 1; i <= 14; i++) {
    await page.evaluate((i) => window.__seed(100 + i), i);
    await click(page, '#sfSurprise'); await idle(page);
    const s = await style(page);
    looks.add(s.look); moods.add(s.emphasis);
  }
  assert.ok(looks.has('auto') && looks.size >= 2, [...looks].join());
  assert.ok(moods.has('neutral') && moods.size >= 3, [...moods].join());
  assert.match(await page.evaluate(() => __mstest.planLabel), / look · \w+ mood · /);
  assert.deepEqual(errors, []);
});

test('old saved guides open with exactly their markers (no Look, Vivid or Muted), whatever the new engine would pick', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  // a gradient guide as the old engine saved it: its own markers (here scrambled, so nothing could lay them out again)
  for (const old of ['vivid', 'muted', 'neutral']) {
    await reopenAs(page, 'Old ' + old, `
      const ks = Object.values(p.assign).reverse(), ls = Object.keys(p.assign);
      ls.forEach((l, i) => { p.assign[l] = ks[i]; });
      p.style.emphasis = '${old}'; delete p.style.look; p.style.family = 'gradient';
      window.__want = JSON.stringify(p.assign);`);
    const got = await page.evaluate(() => JSON.stringify(__mstest.currentDesignObj().payload.assign));
    assert.equal(got, await page.evaluate(() => window.__want), old);
    assert.equal((await style(page)).emphasis, old);
  }
  assert.deepEqual(errors, []);
});

test('speed: a guide of 3,600 sections with the whole catalogue lays out a gradient without freezing', notOnWebKit(WK.speed), async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  const ms = await page.evaluate(() => {
    const t = __mstest, cols = 60, rows = 60, s = 12, W = cols * s, H = rows * s, labels = new Int32Array(W * H), comps = [null];
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const l = comps.length;
      comps.push({ cx: x * s + s / 2, cy: y * s + s / 2, area: s * s * (1 + ((x * 7 + y * 3) % 5)), merged: false, bg: false });
      for (let py = y * s; py < (y + 1) * s; py++) labels.fill(l, py * W + x * s, py * W + x * s + s);
    }
    state.owned.clear();
    t.coll = sfCollection();
    const cl = []; for (let l = 1; l < comps.length; l++) cl.push(l);
    t.W = W; t.H = H; t.labels = labels; t.comps = comps;
    const sv = t.styleVars, out = {};
    Object.assign(sv, { family: 'gradient', paletteSource: 'owned', palette: 'all', emphasis: 'neutral', limitN: 999, gradSeed: 0.3, dir: 1 });
    for (const [look, shape] of [['smooth', 'diagonal'], ['auto', 'radial'], ['ltd', 'vertical'], ['auto', 'serpentine']]) {
      Object.assign(sv, { look, gradShape: shape });
      const t0 = performance.now();
      t.grad.build(cl);
      out[look + ' ' + shape] = [Math.round(performance.now() - t0), new Set(Object.values(t.assignData.assign).map((m) => m.mkey)).size];
    }
    return { out, n: t.coll.length };
  });
  for (const [k, [t, used]] of Object.entries(ms.out)) {
    assert.equal(used, ms.n, k + ': every marker used');
    assert.ok(t < 1200, `${k}: ${t}ms`);
  }
  assert.deepEqual(errors, []);
});
