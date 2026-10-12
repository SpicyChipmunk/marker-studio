// v313 (the Plan): D3, a marker's family from its code for a guide made since v313 (famRule 1), and a guide saved before
// keeping v312's rule for good, its tones' markers and blend companions as they were. D7, a marker running low: a line
// under the tabs with Swap it, and "low" on its Colour along row and in the markers on the page. D4, the one-time
// "Screens and ink differ" line, whose link opens Print with Test strip, and the tab "Share & print" where it fits.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, openAtScale, sampleGuide, idle, saveGuide } from './helpers.mjs';

before(setup);
after(teardown);

const sv = (page, k) => page.evaluate((k) => __mstest.styleVars[k], k);
async function reopen(page, id) {
  await page.reload();
  await idle(page);
  await page.evaluate((id) => loadGuide({ id }), id);
  await page.waitForFunction((id) => __mstest.curId === id && __mstest.assignData, id);
  await idle(page);
}
// a marker you own whose blend companion and whose shadow (Same colour) differ between the two rules, and both picks
// under each
const differing = (page) =>
  page.evaluate(() => {
    const t = __mstest,
      sv = t.styleVars,
      was = sv.famRule,
      coll = t.coll,
      at = (r, f) => {
        sv.famRule = r;
        const v = f();
        sv.famRule = was;
        return v ? v.mkey : null;
      };
    let comp = null,
      shade = null;
    for (const m of coll) {
      if (!comp) {
        const a = at(0, () => t.colour.companion(m.lab, m, coll, 1)),
          b = at(1, () => t.colour.companion(m.lab, m, coll, 1));
        if (a !== b) comp = { k: m.mkey, old: a, now: b };
      }
      if (!shade) {
        const a = at(0, () => t.shadePick(m, coll, 1)),
          b = at(1, () => t.shadePick(m, coll, 1));
        if (a && b && a !== b) shade = { k: m.mkey, old: a, now: b };
      }
      if (comp && shade) break;
    }
    return { comp, shade };
  });
const darkCompanion = (page, k) =>
  page.evaluate((k) => {
    const m = __mstest.coll.find((x) => x.mkey === k),
      c = __mstest.colour.companions(m);
    return c.darkOwned && c.dark ? c.dark.mkey : null;
  }, k);
const shadow = (page, k) =>
  page.evaluate((k) => {
    const m = __mstest.coll.find((x) => x.mkey === k),
      d = __mstest.shadeTones(m).dark;
    return d ? d.mkey : null;
  }, k);

test('a new guide (the sample) takes the newest family rule (v316’s 3), saves it and opens with it', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  assert.equal(await sv(page, 'famRule'), 3);
  assert.equal(await page.evaluate(() => __mstest.currentDesignObj().payload.famRule), 3);
  await saveGuide(page);
  const id = await page.evaluate(() => __mstest.curId);
  await reopen(page, id);
  assert.equal(await sv(page, 'famRule'), 3);
  assert.deepEqual(errors, []);
});

test('a guide saved before v313 keeps v312’s rule: its shadows and blend companions are as they were, saved as it was; the tones aren’t mixed up between the two', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await page.click('.sftabbtn[data-t="shading"]');
  await page.click('#sfShade [data-v="full"]');
  await idle(page);
  const d = await differing(page);
  assert.ok(d.comp && d.shade, JSON.stringify(d));
  assert.equal(await shadow(page, d.shade.k), d.shade.now, 'a new guide: the shadow by v313’s rule');
  // (a guide from v312: no famRule saved)
  await page.evaluate(() => {
    __mstest.styleVars.famRule = 0;
  });
  await saveGuide(page);
  const id = await page.evaluate(() => __mstest.curId);
  assert.equal(
    await page.evaluate(() => 'famRule' in __mstest.currentDesignObj().payload),
    false,
    'saved as v312 saved it',
  );
  await reopen(page, id);
  assert.equal(await sv(page, 'famRule'), 0);
  assert.equal(await darkCompanion(page, d.comp.k), d.comp.old, 'its blend companion as v312 had it');
  assert.equal(await shadow(page, d.shade.k), d.shade.old, 'its shadow as v312 had it');
  // the tones kept for one rule aren't the other's
  await page.evaluate(() => {
    __mstest.styleVars.famRule = 1;
  });
  assert.equal(await shadow(page, d.shade.k), d.shade.now);
  await page.evaluate(() => {
    __mstest.styleVars.famRule = 0;
  });
  assert.equal(await shadow(page, d.shade.k), d.shade.old);
  assert.deepEqual(errors, []);
});

async function markLow(page, k, low = true) {
  await page.click('#mCollection');
  await idle(page);
  await page.evaluate(
    ([k, low]) => {
      if (low) state.ink[k] = 'low';
      else delete state.ink[k];
      save();
      chrome();
    },
    [k, low],
  );
  await page.click('#mSections');
  await idle(page);
}
// the markers on the page by how many sections still to colour, most first
const byCount = (page) =>
  page.evaluate(() => {
    const t = __mstest,
      n = {};
    for (const l of t.assignData.order) {
      const k = t.assignData.assign[l].mkey;
      if (!t.colored[l]) n[k] = (n[k] || 0) + 1;
    }
    return Object.entries(n).sort((a, b) => b[1] - a[1]);
  });

test('a marker running low: the line under the tabs, Swap it gives its sections still to colour the nearest marker (pinned, one Undo step), coloured ones keep it; “low” on its Colour along row and in the markers on the page', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  const [[k, n]] = await byCount(page);
  // one of its sections coloured: it keeps the marker
  const done = await page.evaluate((k) => {
    const t = __mstest,
      l = t.assignData.order.find((q) => t.assignData.assign[q].mkey === k);
    t.colored[l] = 1;
    return l;
  }, k);
  await markLow(page, k);
  const line = await page.textContent('#sfLowLine');
  assert.match(line, new RegExp(k.split('|')[1] + ' is running low · used on ' + (n - 1) + ' sections'));
  // the markers on the page say so
  await page.click('#sfMkList');
  await idle(page);
  assert.match(await page.textContent(`#sfSheet .sfmlrow[data-k="${k}"]`), /Running low/);
  await page.keyboard.press('Escape');
  await idle(page);
  await page.click('#sfLowSwap');
  await idle(page);
  const after = await page.evaluate(
    ([k, done]) => {
      const t = __mstest,
        A = t.assignData.assign;
      const to = new Set(),
        pinned = [];
      for (const l of t.assignData.order) if (A[l].mkey !== k && t.locks[l] !== undefined) pinned.push(l);
      for (const l of pinned) to.add(A[l].mkey);
      return {
        kept: A[done].mkey,
        left: t.assignData.order.filter((q) => A[q].mkey === k).length,
        to: [...to],
        label: t.planLabel,
      };
    },
    [k, done],
  );
  assert.equal(after.kept, k, 'the coloured one keeps it');
  assert.equal(after.left, 1, 'only that one');
  assert.equal(after.to.length, 1, 'one marker swapped in, pinned');
  assert.notEqual(await page.evaluate((m) => state.ink[m], after.to[0]), 'low');
  assert.match(
    after.label,
    new RegExp('^Swapped ' + k.split('|')[1] + ' for .+ in ' + (n - 1) + ' sections$'),
  );
  assert.equal(await page.isVisible('#sfLowLine'), false, 'the line goes');
  // one Undo step puts them back
  await page.click('#sfPlanUndo');
  await idle(page);
  assert.equal(
    await page.evaluate(
      (k) => __mstest.assignData.order.filter((q) => __mstest.assignData.assign[q].mkey === k).length,
      k,
    ),
    n,
  );
  // Colour along: "low" on its row
  await page.click('#sfColor');
  await idle(page);
  assert.match(await page.textContent(`#sfAlist .sfarow[data-k="${k}"] .sfah`), /low/);
  assert.deepEqual(errors, []);
});

test('the running-low line’s ✕ is remembered for that guide and marker; the next marker running low has its turn', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  const [[k1], [k2]] = await byCount(page);
  await markLow(page, k1);
  await markLow(page, k2);
  assert.match(await page.textContent('#sfLowLine'), new RegExp(k1.split('|')[1]));
  await page.click('#sfLowX');
  await idle(page);
  assert.match(await page.textContent('#sfLowLine'), new RegExp(k2.split('|')[1]), 'the next one');
  await page.click('#sfLowX');
  await idle(page);
  assert.equal(await page.isVisible('#sfLowLine'), false);
  await saveGuide(page);
  const id = await page.evaluate(() => __mstest.curId);
  await reopen(page, id);
  assert.equal(await page.isVisible('#sfLowLine'), false, 'still closed when it opens again');
  assert.deepEqual(errors, []);
});

test('“Screens and ink differ”: once, after the first-time lines; its link opens Print with Test strip; the tab says Share & print where it fits', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  assert.equal(await page.textContent('.sftabbtn[data-t="share"]'), 'Share & print');
  assert.equal(
    await page.isVisible('#sfStripLine'),
    false,
    'not on the sample, nor beside the first-time line',
  );
  await page.evaluate(() => {
    markHint('tap');
    __mstest.curName = 'Strip test';
  });
  await saveGuide(page);
  const id = await page.evaluate(() => __mstest.curId);
  await reopen(page, id);
  const n = await page.evaluate(
    () => new Set(Object.values(__mstest.assignData.assign).map((m) => m.mkey)).size,
  );
  assert.equal(
    await page.textContent('#sfStripLine span'),
    `Screens and ink differ. Print a test strip of these ${n} markers to see them on your paper.`,
  );
  await page.click('#sfStripGo');
  await page.waitForSelector('#sfSheet.sfprsh');
  await idle(page);
  assert.equal(await page.getAttribute('[data-pwhat="strip"]', 'aria-pressed'), 'true');
  await page.click('#sfSheet [data-pr="cancel"]');
  await idle(page);
  // once only
  await reopen(page, id);
  assert.equal(await page.isVisible('#sfStripLine'), false, 'once');
  assert.deepEqual(errors, []);
});

test('the Share & print tab says Share where its words don’t fit (a small phone at larger text)', async () => {
  const { page, errors } = await openAtScale(1.5, { width: 320, height: 640 });
  await sampleGuide(page);
  const t = await page.textContent('.sftabbtn[data-t="share"]');
  assert.ok(t === 'Share' || t === 'Share & print');
  const fits = await page.evaluate(() => {
    const b = document.querySelector('.sftabbtn[data-t="share"]');
    return b.scrollWidth <= b.clientWidth + 1;
  });
  assert.ok(fits, 'never cut off: ' + t);
  assert.deepEqual(errors, []);
});
