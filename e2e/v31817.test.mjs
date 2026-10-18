// v318.17 in the browser: Pattern's More options on a phone, ＋ Zone at the tab's end, the Flow pictures; Shadows only
// per zone; Blender highlights; Lean towards with its themes. Fails on v318.16.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, sampleGuide, sectionPoint, idle, scrollTop } from './helpers.mjs';

before(setup);
after(teardown);

const tab = async (page, t) => {
  await page.click(`.sftabbtn[data-t="${t}"]`);
  await idle(page);
};
const bigSecs = (page, n) =>
  page.evaluate((n) => {
    const t = __mstest,
      H = t.H;
    return Object.keys(t.assignData.assign)
      .map(Number)
      .filter((l) => t.comps[l].cy < H * 0.3)
      .sort((a, b) => t.comps[b].area - t.comps[a].area)
      .slice(0, n);
  }, n);
async function tapSec(page, l) {
  await scrollTop(page);
  const p = await sectionPoint(page, l);
  await page.mouse.click(p.x, p.y);
  await idle(page);
}

test('Pattern on a phone: More options for Gradient, Random and Blend, not Photo or Manual; ＋ Zone last; Flow pictures', async () => {
  const { page, errors } = await openApp({ width: 390, height: 844, moreShut: true });
  await sampleGuide(page);
  await tab(page, 'pattern');
  await page.click('#sfFam [data-v="gradient"]');
  await idle(page);
  assert.equal(await page.getAttribute('#sfMore-pattern', 'aria-expanded'), 'false');
  for (const id of ['#sfDir', '#sfGradScat']) assert.equal(await page.isVisible(id), false, id);
  for (const id of ['#sfShape', '#sfLook', '#sfVary', '#sfZoneAdd'])
    assert.equal(await page.isVisible(id), true, id);
  // the Flow buttons: a picture above each word, heard as the word
  const flow = await page.$$eval('#sfShape button', (b) =>
    b.map((x) => [
      x.textContent,
      x.querySelector('svg') && x.querySelector('svg').getAttribute('aria-hidden'),
    ]),
  );
  assert.deepEqual(flow, [
    ['Serpentine', 'true'],
    ['Vertical', 'true'],
    ['Diagonal', 'true'],
    ['Radial', 'true'],
    ['Around', 'true'],
  ]);
  // ＋ Zone after Shuffle and Pin; the heading heard first
  const order = await page.evaluate(() => {
    const p = document.getElementById('sfPanel-pattern'),
      all = [...p.querySelectorAll('h3, #sfFam, #sfLock, #sfZoneAdd')];
    return all.map((e) => e.id || e.textContent);
  });
  assert.deepEqual(order, ['Colour pattern', 'sfFam', 'sfLock', 'sfZoneAdd']);
  await page.click('#sfMore-pattern');
  assert.equal(await page.isVisible('#sfDir'), true);
  for (const [f, bar] of [
    ['random', true],
    ['blend', true],
    // (Photo keeps the pattern before until a photo is chosen: its bar too)
    ['manual', false],
  ]) {
    await page.click(`#sfFam [data-v="${f}"]`);
    await idle(page);
    assert.equal(!!(await page.$('#sfMore-pattern')), bar, f);
  }
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.waitForTimeout(300);
  await page.click('#sfFam [data-v="gradient"]');
  await idle(page);
  assert.equal(await page.$('#sfMore-pattern'), null, 'an iPad: nothing folded');
  assert.deepEqual(errors, []);
});

test('Shadows only per zone: Bell None, Main keeps its highlights; Undo names it', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  // a zone
  await tab(page, 'pattern');
  await page.click('#sfZoneAdd');
  await idle(page);
  await page.fill('#sfZoneName', 'Bell');
  await page.press('#sfZoneName', 'Enter');
  await idle(page);
  for (const l of await bigSecs(page, 2)) await tapSec(page, l);
  await page.click('#sfZoneDone');
  await idle(page);
  await tab(page, 'shading');
  await page.click('#sfShade [data-v="soft"]');
  await idle(page);
  const bell = await page.evaluate(() => __mstest.zones[0].id);
  // (Bell is the zone chosen as it's made: a tap on its chip would open its editor)
  assert.equal(await page.evaluate(() => __mstest.zoneCur), bell);
  await page.selectOption('#sfHiStyle', 'none');
  await idle(page);
  assert.equal(await page.evaluate(() => __mstest.planLabel), 'Bell: Highlights: None (shadows only)');
  const r = await page.evaluate((bell) => {
    const t = __mstest,
      inBell = (l) => t.zoneOf(l) === bell,
      ls = t.countedList().filter((l) => t.shadeSec(l));
    return {
      mode: t.shadeMode,
      bellH: ls.filter(inBell).some((l) => t.shadeSec(l).light),
      mainH: ls.filter((l) => !inBell(l)).some((l) => t.shadeSec(l).light),
      any: t.shAnyHi(),
    };
  }, bell);
  assert.deepEqual(r, { mode: 'full', bellH: false, mainH: true, any: true });
  assert.match(await page.textContent('#sfPanel-shading'), /Bell is shadows only/);
  // Undo: Bell's highlights back
  await page.keyboard.press('Control+z');
  await idle(page);
  assert.equal(await page.evaluate((bell) => __mstest.zsh(bell).hilite, bell), 'same');
  assert.deepEqual(errors, []);
});

test('Blender highlights: offered with a Colorless Blender; the H is the 0; Colour along has its step', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await tab(page, 'shading');
  await page.click('#sfShade [data-v="soft"]');
  await idle(page);
  const opts = await page.$$eval('#sfHiStyle option', (o) => o.map((x) => x.value));
  assert.ok(opts.includes('blender'), opts.join());
  await page.selectOption('#sfHiStyle', 'blender');
  await idle(page);
  assert.equal(await page.evaluate(() => __mstest.planLabel), 'Highlights: Blender (0)');
  const r = await page.evaluate(() => {
    const t = __mstest,
      l = t.countedList().find((l) => t.shadeSec(l) && t.shadeSec(l).light),
      s = t.shadeSec(l);
    return { code: s.light.code, blender: s.blender, req: t.shadeReq(l) & 1, buy: !!s.wantLight };
  });
  assert.deepEqual(r, { code: '0', blender: true, req: 1, buy: false });
  assert.match(await page.textContent('#sfPanel-shading'), /The 0 on the highlight first/);
  assert.deepEqual(errors, []);
});

test('Lean towards: Any, Cool, Warm and three themes; a theme is one Undo step', async () => {
  const { page, errors } = await openApp({ width: 390, height: 844 });
  await sampleGuide(page);
  await tab(page, 'colours');
  assert.deepEqual(await page.$$eval('#sfPal button', (b) => b.map((x) => x.textContent)), [
    'Any',
    'Cool',
    'Warm',
    'Sunset',
    'Forest',
    'Candy',
  ]);
  await page.click('#sfPal [data-v="forest"]');
  await idle(page);
  assert.equal(await page.evaluate(() => __mstest.styleVars.palette), 'forest');
  assert.equal(await page.evaluate(() => __mstest.planLabel), 'Lean towards: Forest');
  // the row fits: one row of six or two of three, nothing cut off, no sideways scroll
  const fit = await page.evaluate(() => {
    const r = document.getElementById('sfPal');
    return {
      over: r.scrollWidth > r.clientWidth + 1,
      clipped: [...r.children].filter((b) => b.scrollWidth > b.clientWidth + 1).length,
      page: document.documentElement.scrollWidth > innerWidth,
    };
  });
  assert.deepEqual(fit, { over: false, clipped: 0, page: false });
  await page.keyboard.press('Control+z');
  await idle(page);
  assert.equal(await page.evaluate(() => __mstest.styleVars.palette), 'all');
  assert.deepEqual(errors, []);
});
