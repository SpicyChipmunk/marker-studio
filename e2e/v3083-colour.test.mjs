// v308.3 (colour): the Gradient's vivid set keeps every colour family (Honolulu 24 keeps its violets, V010 and V416:
// the count, the slider's end, "all" and the line under Include all say 14), a guide saved before opens as it was
// saved; Focus mode's colour chips on a colour neither text reads on at 4.5:1 get a soft halo round their words.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { setup, teardown, openApp, sampleGuide, idle, saveGuide } from './helpers.mjs';

before(setup);
after(teardown);

const SHOTS = process.env.V3083_SHOTS || '';
const tab = async (page, t) => {
  await page.click(`.sftabbtn[data-t="${t}"]`);
  await idle(page);
};
const keys = (page) =>
  page.evaluate(() => {
    const a = __mstest.assignData.assign;
    return Object.keys(a)
      .sort((x, y) => x - y)
      .map((l) => l + ':' + a[l].mkey);
  });
const usedKeys = (page) =>
  page.evaluate(() => {
    const a = __mstest.assignData;
    return [...new Set(a.order.map((l) => a.assign[l].mkey))].sort();
  });
const label = (page) => page.textContent('#sfMkNlbl');
async function reopen(page, id) {
  await page.reload();
  await idle(page);
  await page.evaluate((id) => loadGuide({ id }), id);
  await page.waitForFunction((id) => __mstest.curId === id && __mstest.assignData, id);
  await idle(page);
}

test('Honolulu 24 at all: its violets V010 and V416 come back, and the count, the slider’s end and the line under Include all say 14; a guide saved before opens as saved', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await page.evaluate(() => {
    state.owned = new Set(presetMkeys(MARKER_SETS.find((s) => s.n === 'Honolulu 24')));
    save();
    __mstest.coll = sfCollection();
    Object.assign(__mstest.styleVars, { family: 'gradient', emphasis: 'neutral', limitN: 999 });
    __mstest.reassign();
  });
  await idle(page);
  await tab(page, 'colours');
  const used = await usedKeys(page);
  assert.equal(used.length, 14, 'all lays 14');
  assert.ok(used.includes('Ohuhu|V010') && used.includes('Ohuhu|V416'), 'its violets');
  assert.equal(await label(page), 'all · 14');
  assert.equal(await page.getAttribute('#sfMkCount', 'max'), '14');
  assert.match(await page.textContent('#sfPoolCt'), /^14 of your markers/);
  // one less is a count, and + is all again
  await page.click('#sfMkMinus');
  await idle(page);
  assert.equal(await label(page), '13');
  await page.click('#sfMkPlus');
  await idle(page);
  assert.equal(await label(page), 'all · 14');

  // a guide laid before v308.3 (no violets: their sections had the marker next in the run) opens as it was saved
  await page.evaluate(() => {
    const t = __mstest,
      A = t.assignData.assign,
      o = t.assignData.order,
      v = (m) => m.mkey === 'Ohuhu|V010' || m.mkey === 'Ohuhu|V416',
      other = o.map((l) => A[l]).find((m) => !v(m));
    o.forEach((l) => {
      if (v(A[l])) A[l] = other;
    });
    t.assignData.base = Object.assign({}, A);
  });
  const old = await keys(page);
  assert.equal((await usedKeys(page)).length, 12);
  await saveGuide(page);
  const id = await page.evaluate(() => __mstest.curId);
  await reopen(page, id);
  assert.deepEqual(await keys(page), old, 'opens exactly as saved');
  assert.equal((await usedKeys(page)).length, 12);
  // laid again (a Plan change): today's 14
  await tab(page, 'colours');
  await page.click('#sfMkMinus');
  await idle(page);
  await page.click('#sfMkPlus');
  await idle(page);
  assert.equal(await label(page), 'all · 14');
  assert.equal((await usedKeys(page)).length, 14);
  assert.deepEqual(errors, []);
});

// every marker of the catalogue on the sample page's sections, so many at a time, Focus mode's chips drawn for each lot
async function chipsFor(page, mkeys) {
  return page.evaluate((mk) => {
    const t = __mstest,
      by = new Map(t.coll.map((m) => [m.mkey, m])),
      o = t.assignData.order;
    o.forEach((l, i) => (t.assignData.assign[l] = by.get(mk[i % mk.length])));
    t.focusChips();
    document.getElementById('sfFocMk').scrollLeft = 0;
    return [...document.querySelectorAll('#sfFocMk .focmk')].map((b) => ({
      k: b.dataset.k,
      halo: b.classList.contains('fmhalo'),
      lt: b.classList.contains('fmhalo-lt'),
      color: getComputedStyle(b).color,
      shadow: getComputedStyle(b).textShadow,
      // (drawn as any chip is: in the row, not faded)
      shown:
        getComputedStyle(b).position === 'static' &&
        getComputedStyle(b).opacity === '1' &&
        b.offsetWidth > 40,
    }));
  }, mkeys);
}

test('Focus mode’s colour chips: a halo round the words on exactly the 21 of the 722 colours neither text reads on at 4.5:1 (R413 has it, Y28 not), dark under white words, light under dark; the rest as they were', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, storage: { 'ms-wake-told': '1' } });
  await sampleGuide(page);
  await page.evaluate(() => {
    state.owned = new Set(COLORS.map((c, i) => mkey(i)));
    save();
    __mstest.coll = sfCollection();
  });
  await idle(page);
  await page.click('#sfColor');
  await idle(page);
  await page.click('#sfFocus');
  await idle(page);
  await page.click('#sfFocCols');
  await idle(page);
  // the colours under 4.5:1 either way, worked out here from WCAG's ratio
  const { all, weak } = await page.evaluate(() => {
    const lum = (hex) => {
        const f = (v) => ((v /= 255) > 0.04045 ? ((v + 0.055) / 1.055) ** 2.4 : v / 12.92);
        const n = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
        return 0.2126 * f(n[0]) + 0.7152 * f(n[1]) + 0.0722 * f(n[2]);
      },
      d = lum('#141216');
    const all = __mstest.coll.map((m) => m.mkey),
      weak = __mstest.coll
        .filter((m) => {
          const y = lum(m.hex);
          return Math.max((y + 0.05) / (d + 0.05), 1.05 / (y + 0.05)) < 4.5;
        })
        .map((m) => m.mkey);
    return { all, weak };
  });
  // (every marker but the two colourless blenders, which no guide lays)
  assert.equal(all.length, 720);
  assert.equal(weak.length, 21);
  for (const k of ['Ohuhu|R413', 'Ohuhu|B315', 'Ohuhu|V015', 'Ohuhu|R014']) assert.ok(weak.includes(k), k);
  assert.ok(!weak.includes('Ohuhu|Y28'));
  const n = await page.evaluate(() => __mstest.assignData.order.length),
    seen = new Map();
  for (let i = 0; i < all.length; i += n)
    for (const c of await chipsFor(page, all.slice(i, i + n))) seen.set(c.k, c);
  assert.equal(seen.size, 720, 'a chip for every marker');
  const halo = [...seen.values()].filter((c) => c.halo).map((c) => c.k);
  assert.deepEqual(halo.sort(), weak.slice().sort(), 'the halo on exactly those');
  for (const c of seen.values()) {
    assert.ok(c.shown, c.k + ' drawn in the row like any chip');
    const white = c.color === 'rgb(255, 255, 255)';
    if (c.halo) {
      assert.equal(c.lt, !white, c.k + ': light halo under dark words only');
      assert.match(
        c.shadow,
        white ? /rgba\(0, 0, 0, 0\.75\) 0px 0px 2px/ : /rgba\(255, 255, 255, 0\.75\) 0px 0px 2px/,
        c.k + ' ' + c.shadow,
      );
    } else assert.equal(c.shadow, 'none', c.k + ': no halo');
  }
  assert.equal(seen.get('Ohuhu|R413').halo, true);
  assert.equal(seen.get('Ohuhu|Y28').halo, false);
  // a strip to look at: the weakest first, with Y28 and two plain ones beside them
  const strip = await chipsFor(page, [
    'Ohuhu|R014',
    'Ohuhu|V015',
    'Ohuhu|B315',
    'Ohuhu|R413',
    'Ohuhu|R412',
    'Copic|B06',
    'Ohuhu|Y28',
    'Ohuhu|B111',
    'Copic|R29',
  ]);
  assert.equal(strip.filter((c) => c.shown).length, 9, 'all nine chips in the row');
  if (SHOTS) {
    await mkdir(SHOTS, { recursive: true });
    await page
      .locator('#sfFocMk')
      .screenshot({ path: join(SHOTS, 'focus-chips-' + (process.env.E2E_BROWSER || 'chromium') + '.png') });
    await page.screenshot({
      path: join(SHOTS, 'focus-sheet-' + (process.env.E2E_BROWSER || 'chromium') + '.png'),
    });
  }
  assert.deepEqual(errors, []);
});
