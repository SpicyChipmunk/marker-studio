// v304 shading: Print has its own Tone lines option (app-wide, remembered like the other print choices, on unless
// unticked, shown only with shading): off, the colouring page has no dashed tone lines and the key's how-to points to
// the H and S circles alone. The screen's Show tone lines is the screen's only. Also: the sample's shaded sections are
// as they were (v304 put the smallest shaded section back to v302's rule, which the sample was always on).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, sampleGuide, idle } from './helpers.mjs';

before(setup);
after(teardown);

async function shadeOn(page) {
  await page.click('.sftabbtn[data-t="shading"]');
  await page.click('#sfShade [data-v="full"]');
  await idle(page);
}
async function sharePrint(page) {
  await page.click('.sftabbtn[data-t="share"]');
  await page.click('#sfPrint');
  await page.waitForSelector('#sfSheet.sfprsh');
  await idle(page);
}
async function closePrint(page) {
  await page.click('#sfSheet [data-pr="cancel"]');
  await page.waitForSelector('#sfSheet', { state: 'detached' });
}
// the colouring page and the key page, and how many of the colouring page's pixels are the tone lines' grey
const pdf = (page) =>
  page.evaluate(() => {
    const c = __mstest.buildPDFPages();
    const d = c[0].getContext('2d').getImageData(0, 0, c[0].width, c[0].height).data;
    let grey = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] === 150 && d[i + 1] === 150 && d[i + 2] === 150) grey++;
    return { page: c[0].toDataURL(), key: c[1].toDataURL(), grey };
  });

test('Print’s Tone lines: only with shading, on to start with, off leaves the dashes out and the how-to says so', async () => {
  let { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await sharePrint(page);
  assert.equal(await page.locator('#sfPdfLines').count(), 0, 'no shading: no Tone lines');
  await closePrint(page);
  await shadeOn(page);
  // the sample's shaded sections, as before v304
  assert.equal(
    await page.evaluate(
      () => Object.keys(__mstest.assignData.assign).filter((l) => __mstest.shadeWhy(+l) === '').length,
    ),
    134,
  );
  await sharePrint(page);
  assert.ok(await page.isVisible('#sfPdfLines'));
  assert.equal(await page.isChecked('#sfPdfLines'), true, 'on to start with');
  const on = await pdf(page);
  assert.ok(on.grey > 300, 'tone lines on the colouring page: ' + on.grey);
  await page.uncheck('#sfPdfLines');
  await idle(page);
  const off = await pdf(page);
  assert.notEqual(off.page, on.page, 'the colouring page changes');
  // (the grey the lines are drawn in, less the picture's own: smoothed onto the page, some of it is other greys)
  assert.ok(
    off.grey < on.grey * 0.6,
    'fewer of the lines’ grey pixels: ' + off.grey + ' (with them ' + on.grey + ')',
  );
  assert.notEqual(off.key, on.key, 'the how-to on the key page changes');
  assert.equal(
    await page.evaluate(() => __mstest.styleVars.shadeLines),
    true,
    'the screen’s tone lines stay on',
  );
  // Key + reference has no colouring page: nothing for it to do
  await page.click('[data-pwhat="ref"]');
  assert.equal(await page.isDisabled('#sfPdfLines'), true);
  await page.click('[data-pwhat="page"]');
  assert.equal(await page.isDisabled('#sfPdfLines'), false);
  await closePrint(page);
  // remembered on this device, as the other print choices are
  assert.equal(await page.evaluate(() => localStorage.getItem('ms-pdf-lines')), '0');
  // (a fresh visit on this device: the choice is read back)
  const v = await openApp({ width: 820, height: 1180, storage: { 'ms-pdf-lines': '0' } });
  page = v.page;
  await sampleGuide(page);
  await shadeOn(page);
  await sharePrint(page);
  assert.equal(await page.isChecked('#sfPdfLines'), false, 'still off after a reload');
  await page.check('#sfPdfLines');
  await idle(page);
  assert.equal((await pdf(page)).page, on.page, 'back on: as before');
  assert.deepEqual(errors, []);
  assert.deepEqual(v.errors, []);
});

test('the screen’s Show tone lines doesn’t change the PDF', async () => {
  const { page, errors } = await openApp({ width: 390, height: 844 });
  await sampleGuide(page);
  await shadeOn(page);
  const a = await pdf(page);
  await page.uncheck('#sfShLines');
  await idle(page);
  const b = await pdf(page);
  assert.equal(b.page, a.page);
  assert.equal(b.key, a.key);
  // and on a phone the Print sheet shows the option without scrolling sideways
  await sharePrint(page);
  const box = await page.locator('#sfPdfLines').boundingBox();
  assert.ok(box && box.x >= 0 && box.x + box.width <= 390, JSON.stringify(box));
  assert.deepEqual(errors, []);
});
