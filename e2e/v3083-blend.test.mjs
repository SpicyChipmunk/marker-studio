// v308.3 Blend picks its markers from the blend itself. The marker count is the most markers the blend may use: each
// section's mixed colour is found first, with the marker it gets with every allowed marker (its ideal); then the
// count's worth that best cover those (the anchors' own always among them), and each section takes the nearest of
// those. Before, the count was spread round the colour wheel first and the blend put onto that: on the sample with
// Ben's 451 markers, 16 used 8 markers, each section about 27 (L*a*b*) from its ideal, and − and + often changed
// nothing. Saved Blend guides open as saved; a change in the Plan lays them by the new rule.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { setup, teardown, openApp, sampleGuide, idle, toolStatus, ROOT } from './helpers.mjs';

before(setup);
after(teardown);

const tab = async (page, t) => {
  await page.click(`.sftabbtn[data-t="${t}"]`);
  await idle(page);
};
// the sample, Ben's 451 markers, Blend with its three first anchors, laid at count n
async function benBlend(page, n = 16) {
  await sampleGuide(page);
  await page.evaluate((n) => {
    state.owned = new Set(defaultOwned());
    save();
    const t = __mstest;
    t.coll = sfCollection();
    t.styleVars.family = 'blend';
    t.anchors = [];
    t.styleVars.limitN = n;
    t.reassign();
  }, n);
  await idle(page);
}
// lay at count n (in the page): { section: marker key }
const layAt = (page, n) =>
  page.evaluate((n) => {
    const t = __mstest;
    t.styleVars.limitN = n;
    t.reassign();
    return Object.fromEntries(t.assignData.order.map((l) => [l, t.assignData.assign[l].mkey]));
  }, n);
const keysNow = (page) =>
  page.evaluate(() =>
    Object.fromEntries(__mstest.assignData.order.map((l) => [l, __mstest.assignData.assign[l].mkey])),
  );
// how many markers, leaving out pinned sections
const distinct = (page) =>
  page.evaluate(() => {
    const t = __mstest;
    return new Set(
      t.assignData.order.filter((l) => t.locks[l] === undefined).map((l) => t.assignData.assign[l].mkey),
    ).size;
  });
// each section's mean L*a*b* distance from the marker it has at "all"
const meanErr = (page, a, ref) =>
  page.evaluate(
    ([a, ref]) => {
      const lab = Object.fromEntries(__mstest.coll.map((m) => [m.mkey, m.lab]));
      let s = 0,
        n = 0;
      for (const l in ref) {
        const p = lab[a[l]],
          q = lab[ref[l]];
        s += Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
        n++;
      }
      return s / n;
    },
    [a, ref],
  );

test('the count is the most markers the blend uses; each step closer to the blend at all; at 16 well within 27 of it', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await benBlend(page);
  const ref = await layAt(page, 999);
  const all = new Set(Object.values(ref)).size;
  assert.ok(all >= 20, 'the blend at all: ' + all);
  const errs = [];
  for (const n of [2, 3, 5, 8, 12, 16, 24]) {
    await layAt(page, n);
    const k = await distinct(page);
    assert.ok(k <= n, `at ${n}: ${k} markers`);
    assert.equal(k, Math.min(n, all), `at ${n}, the blend uses as many as it may`);
    errs.push([n, await meanErr(page, await keysNow(page), ref)]);
  }
  for (let i = 1; i < errs.length; i++)
    assert.ok(errs[i][1] < errs[i - 1][1], 'closer at ' + errs[i][0] + ': ' + JSON.stringify(errs));
  const e16 = errs.find((e) => e[0] === 16)[1];
  assert.ok(e16 < 8, 'at 16, ' + e16.toFixed(1) + ' from the blend at all (it was 27)');
  // fewer needed than asked: as many as the blend has (48 and all are the same)
  const a48 = await layAt(page, 48);
  assert.deepEqual(a48, ref);
  await idle(page);
  assert.equal(await toolStatus(page), `166 sections · ${all} markers`);
  // a pinned section keeps its marker, and the count is of the rest
  const pin = await page.evaluate(() => {
    const t = __mstest,
      l = t.assignData.order[5],
      y = t.coll.find((m) => m.code === 'Y17' || /Yellow/.test(m.name || '')) || t.coll[0];
    t.locks[l] = y.mkey;
    return { l, k: y.mkey };
  });
  const a8 = await layAt(page, 8);
  assert.equal(a8[pin.l], pin.k, 'the pin kept');
  assert.ok((await distinct(page)) <= 8);
  assert.deepEqual(errors, []);
});

test('the same blend picks the same markers: laid again, in another tab, and through Undo and Redo of the count', async () => {
  const one = await openApp({ width: 820, height: 1180 });
  await benBlend(one.page);
  const a = await keysNow(one.page);
  assert.deepEqual(await layAt(one.page, 16), a, 'laid again');
  const two = await openApp({ width: 820, height: 1180 });
  await benBlend(two.page);
  assert.deepEqual(await keysNow(two.page), a, 'another tab');
  // − on the count: one Undo step, as before
  const page = one.page;
  await tab(page, 'colours');
  await page.click('#sfMkMinus');
  await idle(page);
  assert.equal(await page.textContent('#sfMkNlbl'), '15');
  const b = await keysNow(page);
  assert.equal(new Set(Object.values(b)).size, 15);
  assert.match(await page.getAttribute('#sfPlanUndo', 'aria-label'), /Undo: Markers: 15/);
  await page.click('#sfPlanUndo');
  await idle(page);
  assert.deepEqual(await keysNow(page), a, 'Undo');
  await page.click('#sfPlanRedo');
  await idle(page);
  assert.deepEqual(await keysNow(page), b, 'Redo');
  assert.deepEqual(await layAt(page, 15), b, 'Redo is what 15 lays');
  assert.deepEqual(one.errors, []);
  assert.deepEqual(two.errors, []);
});

test('each anchor’s own marker is among those used, and its dot is that marker (red, green and blue, not the brown E713)', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await benBlend(page);
  for (const n of [16, 4, 3, 2]) {
    await layAt(page, n);
    const r = await page.evaluate(() => {
      const t = __mstest,
        used = new Set(t.assignData.order.map((l) => t.assignData.assign[l].mkey));
      return t.anchors.map((a) => {
        const own = t.coll.find((m) => m.mkey === a.mkey),
          // (anchorDot from v308.3; anchorOut drew the dot before)
          dot = t.assign.anchorDot ? t.assign.anchorDot(a, own) : t.assign.anchorOut(own),
          l = t.labels[Math.round(a.y) * t.W + Math.round(a.x)];
        return { own: own.mkey, dot: dot.mkey, used: used.has(dot.mkey), under: t.assignData.assign[l].mkey };
      });
    });
    for (const x of r) {
      assert.ok(x.used, `at ${n}: the dot’s marker is on the page: ` + JSON.stringify(r));
      assert.equal(x.dot, x.under, `at ${n}: the dot is the marker under it`);
      // (the anchors' markers are your own, allowed, so with room for them they are used as they are)
      if (n >= 3) assert.equal(x.dot, x.own, `at ${n}: the anchor’s own marker`);
    }
  }
  assert.deepEqual(errors, []);
});

test('a saved palette, or one handed over from Palette, still keeps Blend to its markers; the choice is made within them', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await benBlend(page);
  const pal = await page.evaluate(() => {
    // 20 markers round the wheel, from Ben's
    const c = __mstest.coll.filter((m) => m.lab && Math.hypot(m.lab[1], m.lab[2]) > 30);
    const k = [];
    for (let i = 0; i < 20; i++) k.push(c[Math.floor((i * c.length) / 20)].mkey);
    state.saved.push({ id: 'pv3083', type: 'palette', name: 'Test 20', keys: k, ts: Date.now() });
    return k;
  });
  for (const how of ['saved', 'handed']) {
    await page.evaluate(
      ([how, pal]) => {
        const s = __mstest.styleVars;
        s.expand = false;
        if (how === 'saved') {
          s.paletteSource = 'saved';
          s.savedPalId = 'pv3083';
        } else {
          s.paletteSource = 'generate';
          s.genPal = pal.slice();
          s.fromPal = { name: 'Test 20', h: 'rainbow' };
        }
      },
      [how, pal],
    );
    const ref = await layAt(page, 999);
    const allN = new Set(Object.values(ref)).size;
    for (const n of [4, 8, 999]) {
      const a = await layAt(page, n);
      const used = new Set(Object.values(a));
      assert.ok(
        [...used].every((k) => pal.includes(k)),
        `${how} at ${n}: only the palette’s markers`,
      );
      assert.ok(used.size <= Math.min(n, allN), `${how} at ${n}: ${used.size}`);
    }
    // (the choice within the palette: at 4, four of those the blend at all uses)
    const a4 = await layAt(page, 4);
    assert.ok(
      Object.values(a4).every((k) => Object.values(ref).includes(k)),
      how + ': within the blend’s own',
    );
  }
  assert.deepEqual(errors, []);
});

test('the count’s slider ends where all does, and each step along it changes the picture', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await benBlend(page, 999);
  const all = new Set(Object.values(await keysNow(page))).size;
  await tab(page, 'colours');
  assert.equal(await page.getAttribute('#sfMkCount', 'max'), String(all));
  assert.equal(await page.textContent('#sfMkNlbl'), 'all · ' + all);
  assert.equal(await page.isDisabled('#sfMkPlus'), true);
  // − from all: one fewer
  await page.click('#sfMkMinus');
  await idle(page);
  assert.equal(await page.textContent('#sfMkNlbl'), String(all - 1));
  assert.equal(new Set(Object.values(await keysNow(page))).size, all - 1);
  // every step from all down to 2 lays something different (laid in the page: quicker than a tap each)
  const same = await page.evaluate((all) => {
    const t = __mstest,
      keys = () => JSON.stringify(t.assignData.order.map((l) => t.assignData.assign[l].mkey)),
      out = [];
    let prev = null;
    for (let n = all; n >= 2; n--) {
      t.styleVars.limitN = n;
      t.reassign();
      const k = keys();
      if (k === prev) out.push(n);
      prev = k;
    }
    return out;
  }, all);
  assert.deepEqual(same, [], 'steps that changed nothing');
  assert.equal(await page.textContent('#sfMkNlbl'), '2');
  assert.equal(await page.isDisabled('#sfMkMinus'), true);
  // back up to the end: all
  await page.fill('#sfMkCount', String(all));
  await page.dispatchEvent('#sfMkCount', 'change');
  await idle(page);
  assert.equal(await page.textContent('#sfMkNlbl'), 'all · ' + all);
  assert.deepEqual(errors, []);
});

// a Blend guide saved by v308.2 (e2e/fixtures/v3082-blend-guide.json: the sample, Ben's 451 markers, 16, laid by
// v308.2's rule, which used 8): opened, it is exactly as saved, its dots the markers under them; a Plan change lays it
// by the new rule
test('a Blend guide saved by v308.2 opens exactly as saved; a change of count lays it by the new rule', async () => {
  const fx = JSON.parse(await readFile(join(ROOT, 'e2e', 'fixtures', 'v3082-blend-guide.json'), 'utf8'));
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await page.evaluate(() => {
    state.owned = new Set(defaultOwned());
    save();
    __mstest.coll = sfCollection();
  });
  await page.evaluate(
    (d) =>
      SF.importFile(new File([JSON.stringify(d.file)], 'old.msguide.json', { type: 'application/json' })),
    fx,
  );
  await page.waitForFunction(
    () => __mstest.assignData && __mstest.sfmode === 'guide' && __mstest.curName === 'Blend saved by v308.2',
    null,
    { timeout: 20000 },
  );
  await idle(page);
  const now = await page.evaluate(() => ({
    sig: __mstest.labelsSig(),
    family: __mstest.styleVars.family,
    assign: Object.fromEntries(Object.entries(__mstest.assignData.assign).map(([k, v]) => [k, v.mkey])),
    dots: __mstest.anchors.map((a) => {
      const t = __mstest,
        m = t.coll.find((x) => x.mkey === a.mkey),
        l = t.labels[Math.round(a.y) * t.W + Math.round(a.x)];
      return [
        (t.assign.anchorDot ? t.assign.anchorDot(a, m) : t.assign.anchorOut(m)).mkey,
        t.assignData.assign[l].mkey,
      ];
    }),
  }));
  assert.equal(now.sig, fx.sig);
  assert.equal(now.family, 'blend');
  assert.deepEqual(now.assign, fx.assign, 'the same markers');
  assert.equal(new Set(Object.values(now.assign)).size, 8);
  for (const [dot, under] of now.dots) assert.equal(dot, under, 'the dot is the marker under it');
  await tab(page, 'colours');
  assert.equal(await page.textContent('#sfMkNlbl'), '16 · 8', 'it counts its own markers');
  assert.equal(await toolStatus(page), '166 sections · 8 markers');
  await page.click('#sfMkPlus');
  await idle(page);
  assert.equal(await page.textContent('#sfMkNlbl'), '17');
  const k = await keysNow(page);
  assert.equal(new Set(Object.values(k)).size, 17, 'laid by the new rule');
  assert.notDeepEqual(k, fx.assign);
  assert.deepEqual(errors, []);
});
