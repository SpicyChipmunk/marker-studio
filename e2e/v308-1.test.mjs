// v308.1: while the Library (or any dialog) is open, the page under it stays still — a swipe on a short Library had
// scrolled Home behind it, which on an iPad moved Safari's bars and showed a strip of Home's guides at the foot.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, sampleGuide, saveGuide, idle } from './helpers.mjs';

before(setup);
after(teardown);

test('All guides from Home: the Library covers the screen and Home under it does not scroll; closed, Home scrolls again', async () => {
  const { page, errors } = await openApp({ width: 390, height: 600 });
  await sampleGuide(page);
  await saveGuide(page);
  await page.click('#mHome');
  await idle(page);
  await page.evaluate(() => scrollTo(0, 120));
  await idle(page);
  const y0 = await page.evaluate(() => scrollY);
  assert.ok(y0 > 0, 'Home scrolls: ' + y0);
  await page.click('#sfRecent [data-lib]');
  await page.waitForSelector('#savedOverlay.on');
  await idle(page);
  assert.equal(await page.evaluate(() => document.documentElement.classList.contains('ms-ovl')), true, 'the page held');
  const ov = await page.evaluate(() => {
    const r = document.getElementById('savedOverlay').getBoundingClientRect();
    return [r.top, r.bottom, innerHeight];
  });
  assert.ok(ov[0] <= 0 && ov[1] >= ov[2], 'the Library covers the screen: ' + ov);
  // a swipe (here the wheel) on the Library: one guide, so the Library has nothing to scroll; Home stays where it was
  await page.mouse.move(195, 500);
  await page.mouse.wheel(0, 600);
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => scrollY), y0, 'Home did not scroll behind the Library');
  await page.keyboard.press('Escape');
  await idle(page);
  assert.equal(await page.evaluate(() => document.documentElement.classList.contains('ms-ovl')), false, 'let go');
  assert.equal(await page.evaluate(() => scrollY), y0, 'Home where it was');
  await page.mouse.wheel(0, -600);
  await page.waitForTimeout(300);
  assert.ok((await page.evaluate(() => scrollY)) < y0, 'and scrolls again');
  assert.deepEqual(errors, []);
});

test('a question added to the page (SF.askBox) holds the page too, and lets go when answered', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await idle(page);
  await page.evaluate(() => {
    window.__ask = SF.askBox('Test', 'A question', '<button class="btn-primary" data-a="go">OK</button>');
  });
  await page.waitForSelector('#sfEdAsk');
  assert.equal(await page.evaluate(() => document.documentElement.classList.contains('ms-ovl')), true);
  await page.click('#sfEdAsk [data-a="go"]');
  await page.waitForFunction(() => !document.getElementById('sfEdAsk'));
  await page.waitForFunction(() => !document.documentElement.classList.contains('ms-ovl'));
  assert.deepEqual(errors, []);
});
