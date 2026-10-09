// Random's "Keep touching sections clearly different" and Blend's Mix row, in the browser. Which sections touch is
// worked out here in the test, its own way (walking across the lines from every pixel at a section's edge), so the
// app's own adjacency (js/guide/30-palette-assign.js, buildAdj) isn't measured with itself. The rules themselves
// (the lookups, the mixes, the adjacency on made-up pictures) are unit-tested in test/colour-engines.test.mjs.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, sampleGuide, idle, until, buildGo, haveSet } from './helpers.mjs';

before(setup);
after(teardown);

// Math.random from a seed, so the rolls repeat
const SEEDED = () => {
  let a = 7;
  Math.random = function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const click = (page, sel) => page.evaluate((sel) => document.querySelector(sel).click(), sel);
const tab = async (page, t) => { await page.click(`.sftabbtn[data-t="${t}"]`); await idle(page); };

// the guide's touching pairs among its sections, found by walking right and down across the line from every pixel
// at a section's edge, up to a 40th of the picture's longer side: two sections touch when they meet along 6 px or
// more (seen from 6 pixels; the app looks from every other row and column and counts 3), so where lines cross and
// two sections only meet corner to corner, they don't
const touching = (page) => page.evaluate(() => {
  const t = __mstest, L = t.labels, W = t.W, H = t.H, D = Math.round(Math.max(W, H) / 40), cnt = new Map();
  const walk = (x, y, dx, dy, l) => {
    for (let k = 1; k <= D; k++) {
      const X = x + dx * k, Y = y + dy * k;
      if (X >= W || Y >= H) return;
      const r = L[Y * W + X];
      if (r === l) return;
      if (r >= 1) { const key = Math.min(l, r) + ',' + Math.max(l, r); cnt.set(key, (cnt.get(key) || 0) + 1); return; }
    }
  };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const l = L[y * W + x];
      if (l < 1) continue;
      if (x + 1 < W && L[y * W + x + 1] !== l) walk(x, y, 1, 0, l);
      if (y + 1 < H && L[(y + 1) * W + x] !== l) walk(x, y, 0, 1, l);
    }
  const inG = new Set(t.assignData.order);
  return [...cnt].filter(([k, n]) => n >= 6).map(([k]) => k.split(',').map(Number)).filter(([a, b]) => inG.has(a) && inG.has(b));
});
// touching pairs with the same marker, and with markers that look alike (CIEDE2000 under 10)
const clashes = (page, pairs) => page.evaluate((pairs) => {
  const as = __mstest.assignData.assign;
  let same = 0, alike = 0;
  for (const [a, b] of pairs) {
    if (as[a].mkey === as[b].mkey) same++;
    else if (de2000(as[a].lab, as[b].lab) < 10) alike++;
  }
  return { same, alike };
}, pairs);

test('Random on the sample: with “Keep touching sections clearly different”, no touching sections share a marker or look alike, roll after roll', async () => {
  const { page, errors } = await openApp({ init: SEEDED });
  await sampleGuide(page);
  await tab(page, 'pattern');
  await click(page, '#sfFam [data-v="random"]'); await idle(page);
  // (Mixed: Random as it always was; Main colour below)
  await click(page, '#sfBal [data-v="mixed"]'); await idle(page);
  assert.equal((await page.textContent('label:has(#sfNoAdj)')).trim(), 'Keep touching sections clearly different');
  const pairs = await touching(page);
  assert.ok(pairs.length > 40, pairs.length + ' touching pairs');
  // off: markers fall where they may (with 16 markers, some touching sections clash)
  let off = { same: 0, alike: 0 };
  for (let r = 0; r < 4; r++) {
    await click(page, '#sfShuffle'); await idle(page);
    const c = await clashes(page, pairs);
    off = { same: off.same + c.same, alike: off.alike + c.alike };
  }
  assert.ok(off.same + off.alike > 0, 'with it off, some clash');
  await click(page, '#sfNoAdj'); await idle(page);
  assert.equal(await page.evaluate(() => __mstest.planLabel), 'Touching sections different on');
  for (let r = 0; r < 5; r++) {
    assert.deepEqual(await clashes(page, pairs), { same: 0, alike: 0 }, 'roll ' + r);
    await click(page, '#sfShuffle'); await idle(page);
  }
  // Main colour keeps it too (taking another role's marker where the role's own all look alike)
  await click(page, '#sfBal [data-v="main"]'); await idle(page);
  for (let r = 0; r < 5; r++) {
    assert.deepEqual(await clashes(page, pairs), { same: 0, alike: 0 }, 'Main colour, roll ' + r);
    await click(page, '#sfShuffle'); await idle(page);
  }
  assert.deepEqual(errors, []);
});

test('Random on a drawing with thick lines: every touching pair is found, and kept clearly different (a fixed step across missed them all)', async () => {
  const { page, errors } = await openApp({ init: SEEDED });
  await haveSet(page); await page.check('#wcSets input[data-i="3"]'); await page.click('#wcAdd');
  // 8 × 6 boxes, 150 px, drawn with 24 px lines (a 50th of the picture across)
  const b64 = await page.evaluate(async () => {
    const c = document.createElement('canvas'), g = c.getContext('2d');
    c.width = 1300; c.height = 1000;
    g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#111';
    for (let i = 0; i <= 8; i++) g.fillRect(50 + i * 150 - 12, 38, 24, 6 * 150 + 24);
    for (let j = 0; j <= 6; j++) g.fillRect(38, 50 + j * 150 - 12, 8 * 150 + 24, 24);
    const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
    return await new Promise((r) => { const f = new FileReader(); f.onload = () => r(f.result.split(',')[1]); f.readAsDataURL(blob); });
  });
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#wcPhoto')]);
  await fc.setFiles({ name: 'boxes.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
  await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 60000 }); await idle(page);
  await buildGo(page);
  await until(page, () => __mstest.assignData && document.getElementById('sfColor'), null, 'the guide');
  await idle(page);
  const n = await page.evaluate(() => __mstest.assignData.order.length);
  assert.equal(n, 48, 'the 48 boxes');
  const pairs = await touching(page);
  assert.equal(pairs.length, 8 * 5 + 7 * 6, 'side by side, not corner to corner');
  // the app's own list of touching sections has every one
  const found = await page.evaluate((pairs) => { const a = __mstest.colour.adj(); return pairs.filter(([x, y]) => a[x] && a[x].has(y)).length; }, pairs);
  assert.equal(found, pairs.length);
  // (looking a fixed 250th of the picture across, as it used to, sees none of them)
  const old = await page.evaluate(() => {
    const t = __mstest, L = t.labels, W = t.W, H = t.H, B = Math.max(2, Math.round(Math.max(W, H) / 250)), s = new Set();
    for (let y = 0; y + B < H; y++)
      for (let x = 0; x + B < W; x++) {
        const l = L[y * W + x];
        if (l < 1) continue;
        for (const r of [L[y * W + x + B], L[(y + B) * W + x]]) if (r >= 1 && r !== l) s.add(Math.min(l, r) + ',' + Math.max(l, r));
      }
    return s.size;
  });
  assert.equal(old, 0);
  await tab(page, 'pattern');
  await click(page, '#sfFam [data-v="random"]'); await idle(page);
  await click(page, '#sfNoAdj'); await idle(page);
  for (let r = 0; r < 5; r++) {
    assert.deepEqual(await clashes(page, pairs), { same: 0, alike: 0 }, 'roll ' + r);
    await click(page, '#sfShuffle'); await idle(page);
  }
  assert.deepEqual(errors, []);
});

test('Blend’s Mix: Muted, Vivid and Like paint each colour the picture their own way; the choice is saved, is one Undo step, and an older guide’s “Keep colours vivid” opens as Vivid', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await tab(page, 'pattern');
  await click(page, '#sfFam [data-v="blend"]'); await idle(page);
  const pressed = () => page.evaluate(() => [...document.querySelectorAll('#sfMix button')].filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.textContent));
  assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('#sfMix button')].map((b) => [b.dataset.v, b.textContent])), [['soft', 'Muted'], ['vivid', 'Vivid'], ['paint', 'Like paint']]);
  assert.equal(await page.evaluate(() => document.getElementById('sfMix').getAttribute('aria-label')), 'Mix');
  assert.deepEqual(await pressed(), ['Muted']);
  // four anchors in the corners: red, blue, yellow and green, so the mixes differ
  await page.evaluate(() => {
    const t = __mstest, W = t.W, H = t.H, want = [[55, 70, 45], [45, 20, -60], [88, -5, 80], [55, -55, 35]];
    const pts = [[0.15, 0.15], [0.85, 0.15], [0.15, 0.85], [0.85, 0.85]];
    t.anchors.length = 0;
    want.forEach((lab, i) => t.anchors.push({ x: W * pts[i][0], y: H * pts[i][1], mkey: t.colour.nearest(lab, t.coll).mkey }));
    t.reassign();
  });
  await idle(page);
  const keys = () => page.evaluate(() => { const a = __mstest.assignData; return a.order.map((l) => a.assign[l].mkey); });
  const soft = await keys();
  const got = {};
  for (const [v, label] of [['vivid', 'Vivid'], ['paint', 'Like paint']]) {
    await click(page, `#sfMix [data-v="${v}"]`); await idle(page);
    assert.deepEqual(await pressed(), [label]);
    assert.equal(await page.evaluate(() => __mstest.planLabel), 'Mix: ' + label);
    got[v] = await keys();
    const st = await page.evaluate(() => __mstest.currentDesignObj().payload.style);
    assert.equal(st.blendMix, v);
    assert.equal(st.blendVivid, v === 'vivid', 'the old tick box is written for older copies of the app');
  }
  const differ = (a, b) => a.filter((k, i) => k !== b[i]).length;
  assert.ok(differ(soft, got.vivid) > 3 && differ(soft, got.paint) > 3 && differ(got.vivid, got.paint) > 3, `${differ(soft, got.vivid)} ${differ(soft, got.paint)} ${differ(got.vivid, got.paint)}`);
  // Undo: back to Vivid, its picture as it was
  await page.keyboard.press('Control+z'); await idle(page);
  assert.deepEqual(await pressed(), ['Vivid']);
  assert.deepEqual(await keys(), got.vivid);
  await click(page, '#sfMix [data-v="paint"]'); await idle(page);
  // saved and opened again
  await page.evaluate(() => { const d = __mstest.currentDesignObj(), p = d.payload; __mstest.openDesignObj(Object.assign({}, p, { name: 'Painted', W: d.W, H: d.H }), null); });
  await until(page, () => __mstest.curName === 'Painted' && __mstest.assignData, null, 'reopened'); await idle(page);
  assert.equal(await page.evaluate(() => __mstest.styleVars.blendMix), 'paint');
  // a guide saved before Mix: only blendVivid, ticked, opens as Vivid (unticked, Soft), and colours the same way
  for (const [vivid, want, label] of [[true, 'vivid', 'Vivid'], [false, 'soft', 'Muted']]) {
    await page.evaluate((vivid) => {
      const d = __mstest.currentDesignObj(), p = d.payload;
      delete p.style.blendMix;
      p.style.blendVivid = vivid;
      __mstest.openDesignObj(Object.assign({}, p, { name: 'Old ' + vivid, W: d.W, H: d.H }), null);
    }, vivid);
    await until(page, (n) => __mstest.curName === n && __mstest.assignData, 'Old ' + vivid, 'the old guide'); await idle(page);
    assert.equal(await page.evaluate(() => __mstest.styleVars.blendMix), want);
    await tab(page, 'pattern');
    assert.deepEqual(await pressed(), [label]);
    // (it keeps the markers it was saved with until the Mix is changed; choosing it again gives the same)
    await page.evaluate(() => __mstest.reassign()); await idle(page);
    assert.deepEqual(await keys(), want === 'vivid' ? got.vivid : soft);
  }
  assert.deepEqual(errors, []);
});
