// v308.2 (debugging pass, Colour along to outputs): contrast in Colour along and Focus mode, measured as the screen
// draws it (the text's colour, the opacity of it and everything it sits in, over the backgrounds under it).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, sampleGuide, idle, toolStatus } from './helpers.mjs';

before(setup);
after(teardown);

// the contrast of an element's text against what it's drawn on (WCAG's ratio)
const contrast = (page, sel) =>
  page.evaluate((sel) => {
    const el = document.querySelector(sel);
    const parse = (c) => {
      const p = c
        .match(/rgba?\(([^)]+)\)/)[1]
        .split(/[ ,/]+/)
        .filter(Boolean)
        .map(Number);
      return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
    };
    const over = (t, b) => ({
      r: t.r * t.a + b.r * (1 - t.a),
      g: t.g * t.a + b.g * (1 - t.a),
      b: t.b * t.a + b.b * (1 - t.a),
      a: 1,
    });
    const lum = (c) => {
      const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
    };
    const layers = [];
    let op = 1;
    for (let e = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e);
      op *= +cs.opacity;
      const c = parse(cs.backgroundColor);
      if (c.a > 0) layers.push(c);
    }
    let bg = { r: 0, g: 0, b: 0, a: 1 };
    for (let i = layers.length - 1; i >= 0; i--) bg = over(layers[i], bg);
    const c0 = parse(getComputedStyle(el).color),
      fg = over({ ...c0, a: c0.a * op }, bg),
      a = lum(fg),
      b = lum(bg);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  }, sel);

test('a finished page: Codes, off with nothing to show, has its words at 4.5:1 or better (it was faded to 1.8:1)', async () => {
  for (const [w, h] of [
    [820, 1180],
    [1180, 820],
  ]) {
    const { page, errors, ctx } = await openApp({ width: w, height: h, storage: { 'ms-wake-told': '1' } });
    await sampleGuide(page);
    await idle(page);
    await page.click('#sfColor');
    await idle(page);
    await page.evaluate(() => {
      const t = __mstest;
      t.assignData.order.forEach((l) => (t.colored[l] = 1));
      t.updateProgress();
    });
    await idle(page);
    assert.equal(
      await page.evaluate(() => document.getElementById('sfCodes').disabled),
      true,
      'Codes is off',
    );
    // (its words where the row has room for them, else its icon, drawn in the same colour)
    const sel = (await page.isVisible('#sfCodes .sfzw')) ? '#sfCodes .sfzw' : '#sfCodes';
    const r = await contrast(page, sel);
    assert.ok(r >= 4.5, `${w}×${h}: Codes off reads at ${r.toFixed(2)}:1`);
    // and it still looks off: greyer than Greyscale beside it
    const ink = await page.evaluate(() =>
      ['sfCodes', 'sfVals'].map((id) => getComputedStyle(document.getElementById(id)).color),
    );
    assert.notEqual(ink[0], ink[1], 'not in the same ink as an active button');
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});

test('Focus mode’s Colours sheet: each chip’s count is as clear as its code (it was faded under 4:1 on mid-tone markers)', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, storage: { 'ms-wake-told': '1' } });
  await sampleGuide(page);
  await idle(page);
  await page.click('#sfColor');
  await idle(page);
  await page.click('#sfFocus');
  await idle(page);
  await page.click('#sfFocCols');
  await idle(page);
  const n = await page.$$eval('#sfFocMk .focmk:not(.done)', (b) => b.length);
  assert.ok(n > 5);
  for (let i = 1; i <= n; i++) {
    const code = await contrast(page, `#sfFocMk .focmk:nth-child(${i}) .fmc`),
      count = await contrast(page, `#sfFocMk .focmk:nth-child(${i}) .fmn`);
    assert.ok(
      Math.abs(code - count) < 0.01,
      `chip ${i}: count ${count.toFixed(2)}:1, code ${code.toFixed(2)}:1`,
    );
  }
  assert.deepEqual(errors, []);
});

test('Focus mode’s Mark all … done, then ✕ while its Undo is still up: Undo puts the ticks back (it did nothing once Focus mode had closed)', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, storage: { 'ms-wake-told': '1' } });
  await sampleGuide(page);
  await idle(page);
  await page.click('#sfColor');
  await idle(page);
  await page.click('#sfFocus');
  await idle(page);
  const done = () => page.evaluate(() => __mstest.assignData.order.filter((l) => __mstest.colored[l]).length);
  await page.click('#sfFocCols');
  await idle(page);
  await page.click('#sfFocAll');
  await idle(page);
  const marked = await done();
  assert.ok(marked > 1, 'a marker’s sections marked done');
  assert.ok(await page.isVisible('#toastAct'), 'Undo offered');
  await page.click('#sfExitFoc');
  await idle(page);
  assert.equal(await page.evaluate(() => __mstest.focus), false, 'Focus mode closed');
  assert.ok(await page.isVisible('#toastAct'), 'its Undo still showing');
  await page.click('#toastAct');
  await idle(page);
  assert.equal(await done(), 0, 'the ticks as they were');
  // the list says so too
  assert.match(await toolStatus(page), /^0 of 166/);
  assert.deepEqual(errors, []);
});
