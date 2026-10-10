// v310.1, from the debugging pass: v310's first-start decision on the section step waits for data it can read; the
// Mood pictures in iPad landscape's column are three a row, the bigger ones (a phone on its side keeps one row of six).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, idle, sampleGuide, letterGuide } from './helpers.mjs';

before(setup);
after(teardown);

const KEY = 'ohuhu-hb320-picker-v3';

test('unreadable saved data at v310’s first start: the section step isn’t decided from the empty Library', async () => {
  const { page, errors } = await openApp({
    width: 820,
    height: 1180,
    storage: {
      'ms-sec-tools': null,
      'ms-onboarded': '1',
      'ms-setup-tip': '1',
      [KEY]: '{"saved":[{"type":"gui',
    },
  });
  await idle(page);
  assert.equal(await page.evaluate(() => localStorage.getItem('ms-sec-tools')), null);
  assert.deepEqual(errors, []);
});

test('Mood pictures: three a row in iPad landscape’s column; one row of six on a phone on its side', async () => {
  for (const [w, h, rows, tall] of [
    [1180, 820, 2, 112],
    [932, 430, 1, 60],
  ]) {
    const { page, errors, ctx } = await openApp({ width: w, height: h });
    await sampleGuide(page);
    if (w === 1180) await letterGuide(page);
    await page.click('#sfTab-colours');
    await idle(page);
    const r = await page.evaluate(() => {
      const b = [...document.querySelectorAll('#sfMood .sfmp')];
      return {
        rows: new Set(b.map((x) => Math.round(x.getBoundingClientRect().top))).size,
        h: Math.round(b[0].querySelector('canvas').getBoundingClientRect().height),
      };
    });
    assert.deepEqual(r, { rows: rows, h: tall }, w + '×' + h);
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});
