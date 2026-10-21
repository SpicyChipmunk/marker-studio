// v318.30 (W2): 1. the overlays after a turn when the picture's transitionend never comes (Safari, v318.29 Q3): a
// settle pass after the last resize places them as transitionend would have. 2. Rainbow's base kept across a reload.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, idle, welcome, sampleGuide, sectionPoint, scrollTop } from './helpers.mjs';

before(setup);
after(teardown);

// the picture's own transitionend held back (as Safari does as a phone turns): only a made one gets through
const holdBack = (page) =>
  page.evaluate(() => {
    document.addEventListener(
      'transitionend',
      (e) => {
        if (e.isTrusted && e.target && e.target.id === 'sfCanvas') e.stopPropagation();
      },
      true,
    );
  });
// where the picture and its overlays are on the screen (whole pixels), and the layout's classes
const geo = (page) =>
  page.evaluate(() => {
    const r = (e) => {
      const b = e.getBoundingClientRect();
      return [b.x, b.y, b.width, b.height].map(Math.round);
    };
    const w = document.getElementById('sfWork'),
      ol = document.querySelector('.sfoutline');
    return {
      side: w.classList.contains('sfside'),
      toolsv: w.classList.contains('sftoolsv'),
      cv: r(document.getElementById('sfCanvas')),
      pic: document.querySelector('#sfView > div')
        ? document.querySelector('#sfView > div').style.transform
        : '',
      outline: ol && ol.style.display !== 'none' ? r(ol) : null,
      rings: [...document.querySelectorAll('.sfring')].map(r),
      zones: [...document.querySelectorAll('.sfzone')].map(r),
    };
  });
// what the app's own settled pass (the picture's transitionend) would place: the truth to compare with
const settled = async (page) => {
  await page.evaluate(() => {
    document
      .getElementById('sfCanvas')
      .dispatchEvent(new TransitionEvent('transitionend', { propertyName: 'width' }));
  });
  return geo(page);
};
async function turnAndCheck(page, w, h, what) {
  await page.setViewportSize({ width: w, height: h });
  // (the resize's own frame, the ease (0.18 s) and the settle pass (0.25 s after the last resize) all past)
  await page.waitForTimeout(900);
  await idle(page);
  const got = await geo(page),
    want = await settled(page);
  assert.deepEqual(
    got,
    want,
    what + ' at ' + w + 'x' + h + ': the overlays where a settled picture has them',
  );
  assert.ok(got.cv[2] > 50 && got.cv[3] > 50, what + ': the picture has a size');
  return got;
}
async function alongRow(page) {
  await page.click('#sfColor');
  await idle(page);
  await scrollTop(page);
  await page.locator('#sfAlist .sfarow .sfah').nth(1).click();
  await idle(page);
  await page.waitForFunction(() => {
    const o = document.querySelector('.sfoutline');
    return !!o && o.style.display !== 'none';
  });
}
// the Plan's "N rough spots" line and its rings: a Gradient zone over the top of the sample (e2e/rough-count)
async function roughRings(page) {
  const top = await page.evaluate(() => {
    const t = __mstest;
    return t.assignData.order
      .map((l) => [l, t.comps[l].cy])
      .sort((a, b) => a[1] - b[1])
      .slice(0, 3)
      .map((x) => x[0]);
  });
  await page.click('.sftabbtn[data-t="pattern"]');
  await idle(page);
  await page.click('#sfZoneAdd');
  await idle(page);
  for (const l of top) {
    await scrollTop(page);
    const p = await sectionPoint(page, l);
    await page.mouse.click(p.x, p.y);
    await idle(page);
  }
  await page.click('#sfZoneDone');
  await idle(page);
  await page.click('#sfPanel-pattern .sfzchip[data-z="0"]');
  await idle(page);
  await page.waitForSelector('#sfRoughGo');
  await scrollTop(page);
  await page.waitForFunction(() => document.querySelectorAll('.sfring').length > 0);
}

for (const [pw, ph] of [
  [375, 667],
  [820, 1180],
]) {
  test(`Colour along, a row open: its outline is placed after a turn without transitionend (${pw}x${ph})`, async () => {
    const { page, errors } = await openApp({ width: pw, height: ph });
    await sampleGuide(page);
    await alongRow(page);
    await holdBack(page);
    const a = await turnAndCheck(page, ph, pw, 'landscape');
    assert.ok(a.outline, 'the outline shows in landscape');
    const b = await turnAndCheck(page, pw, ph, 'back in portrait');
    assert.ok(b.outline, 'the outline shows again in portrait');
    assert.equal(b.side, false, 'one column again');
    assert.deepEqual(errors, []);
  });
  test(`Focus mode with shading: the picture and zones are placed after a turn without transitionend (${pw}x${ph})`, async () => {
    const { page, errors } = await openApp({ width: pw, height: ph });
    await sampleGuide(page);
    await page.click('.sftabbtn[data-t="shading"]');
    await page.evaluate(() => __mstest.shadeTo('full'));
    await idle(page);
    await page.click('#sfColor');
    await idle(page);
    await page.click('#sfFocus');
    await idle(page);
    await holdBack(page);
    await turnAndCheck(page, ph, pw, 'landscape');
    await turnAndCheck(page, pw, ph, 'back in portrait');
    assert.ok(
      await page.evaluate(() => document.getElementById('sfRoot').classList.contains('sffoc')),
      'still in Focus mode',
    );
    assert.deepEqual(errors, []);
  });
  test(`the Plan's rough rings are placed after a turn without transitionend (${pw}x${ph})`, async () => {
    const { page, errors } = await openApp({ width: pw, height: ph });
    await sampleGuide(page);
    await roughRings(page);
    await holdBack(page);
    const a = await turnAndCheck(page, ph, pw, 'landscape');
    assert.ok(a.rings.length > 0, 'rings in landscape');
    const b = await turnAndCheck(page, pw, ph, 'back in portrait');
    assert.ok(b.rings.length > 0, 'rings again in portrait');
    assert.deepEqual(errors, []);
  });
}

// 2. Rainbow's base across a reload (v318.28 C4 kept it across band taps; the label was lost on reload as the base
// wasn't saved beside the palette: state.palB now, in step with palH)
const card = (page) =>
  page.evaluate(() => ({
    pal: state.palettes[state.palettes.length - 1].join(),
    palH: state.palH.slice(),
    sub: document.querySelector('#readout .fam').textContent,
  }));
test('a Rainbow built from G310 on Honolulu 120 still says "· Ohuhu … base" after a reload', async () => {
  const { page, errors } = await openApp();
  await welcome(page, 'look');
  await idle(page);
  await page.evaluate(() => {
    state.owned = new Set(presetMkeys(MARKER_SETS.find((s) => s.n === 'Honolulu 120')));
    state.ink = {};
    save();
  });
  await page.click('#mPalette');
  await idle(page);
  await page.click('#harm button[data-h="rainbow"]');
  await idle(page, 800);
  const si = await page.evaluate(() => {
    const si = COLORS.findIndex((c, i) => inPool(i) && c.code === 'G310');
    state.palSize = 8;
    setSeed(mkey(si));
    return si;
  });
  await idle(page, 1500);
  const a = await card(page),
    // (the label names the marker: "Rainbow · Ohuhu Shamrock Green base")
    want = await page.evaluate((si) => 'Rainbow · Ohuhu ' + capName(si) + ' base', si);
  assert.equal(a.sub, want);
  // what was saved: the base beside its palette, null beside the others, nothing held on state itself
  const saved = await page.evaluate(() => {
    const v = JSON.parse(localStorage.getItem(KEY));
    return { palB: v.palB, n: v.palettes.length, onState: 'palB' in state };
  });
  assert.equal(saved.n, a.palH.length);
  assert.ok(Array.isArray(saved.palB), 'palB saved beside palH');
  assert.equal(
    saved.palB[saved.n - 1],
    si,
    'the base is saved beside its palette: ' + JSON.stringify(saved.palB),
  );
  assert.equal(saved.onState, false);
  await page.reload();
  await page.waitForSelector('#readout .fam');
  await idle(page, 1500);
  const b = await card(page);
  assert.equal(b.pal, a.pal, 'the same palette after the reload');
  assert.equal(b.sub, want, 'the base is still named');
  // another band re-rolled: still built from it (v318.28 C4), and Undo back to the palette before too
  const k = await page.evaluate(
    (si) => (state.palettes[state.palettes.length - 1].indexOf(si) === 0 ? 1 : 0),
    si,
  );
  await page.click(`#bands .band:nth-child(${k + 1}) .bhit`);
  await idle(page, 1500);
  assert.equal((await card(page)).sub, want, 'after a band tap');
  // a stored base that doesn't fit its palette (an older version carried it as the palette changed) is let go
  await page.evaluate(() => {
    const v = JSON.parse(localStorage.getItem(KEY));
    v.palB = v.palettes.map(() => 2);
    localStorage.setItem(KEY, JSON.stringify(v));
  });
  await page.reload();
  await page.waitForSelector('#readout .fam');
  await idle(page, 1500);
  assert.equal((await card(page)).sub, 'Rainbow', 'a base not in the palette is not named');
  assert.deepEqual(errors, []);
});
