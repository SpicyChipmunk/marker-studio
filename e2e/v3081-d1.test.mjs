// v308.2 (review d1): Home, the Library, data safety and the page lock while dialogs are open.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, sampleGuide, idle, frames } from './helpers.mjs';

before(setup);
after(teardown);

// v308.1's lock gave the body an overflow of its own, so the body became the scroller the pinned picture and the
// guide's bar stick to: under any dialog the picture slid up out of place and the bar dropped off the screen
test('a dialog over a scrolled guide leaves the pinned picture and the bar where they were', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await idle(page);
  await page.evaluate(() => scrollTo(0, 500));
  await idle(page);
  const at = () =>
    page.evaluate(() => {
      const v = document.getElementById('sfView').getBoundingClientRect();
      const b = document.querySelector('#sfRoot .sfbar').getBoundingClientRect();
      return { y: scrollY, view: Math.round(v.top), bar: Math.round(b.bottom) };
    });
  const was = await at();
  assert.ok(was.y > 0 && was.bar <= 1180, 'scrolled, the bar on the screen: ' + JSON.stringify(was));
  await page.evaluate(() => openDialog(document.getElementById('helpOverlay')));
  await frames(page);
  assert.equal(
    await page.evaluate(() => document.documentElement.classList.contains('ms-ovl')),
    true,
    'held',
  );
  assert.deepEqual(await at(), was, 'under Help');
  await page.keyboard.press('Escape');
  await idle(page);
  assert.deepEqual(await at(), was, 'Help closed');
  await page.evaluate(() => {
    window.__a = SF.askBox('Test', 'A question', '<button class="btn-primary" data-a="go">OK</button>');
  });
  await page.waitForSelector('#sfEdAsk');
  await frames(page);
  assert.deepEqual(await at(), was, 'under a question');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.documentElement.classList.contains('ms-ovl'));
  assert.deepEqual(await at(), was, 'question gone');
  assert.deepEqual(errors, []);
});
