// v318 review (adding markers, 1a): while the keyboard or Scan Text's camera is up (the box has focus, and what's seen
// of the page is shorter than the page: visualViewport), Scan's paste line and photo card go, and its steps once the
// list has a marker, so what was just read and the count stay above it. Fails on v318.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, idle } from './helpers.mjs';

before(setup);
after(teardown);

const kbUp = (page, v) =>
  page.evaluate((v) => {
    if (v == null) delete visualViewport.height;
    else Object.defineProperty(visualViewport, 'height', { get: () => v, configurable: true });
    visualViewport.dispatchEvent(new Event('resize'));
  }, v);
const shown = (page, id) => page.evaluate((id) => document.getElementById(id).getClientRects().length > 0, id);

for (const [W, H, panel] of [
  [390, 844, 330],
  [1180, 820, 400],
]) {
  test(`${W}×${H}: with a ${panel} px keyboard up, what was read and the count stay above it`, async () => {
    const { page, errors } = await openApp({ width: W, height: H, storage: { 'ms-onboarded': '1', 'ms-setup-tip': '1', 'ms-scan-brand': '' } });
    await page.evaluate(() => openScan());
    await idle(page);
    await page.focus('#scBox');
    await page.keyboard.type('R014');
    await page.keyboard.press('Enter');
    await idle(page);
    assert.ok(await shown(page, 'scLens'), 'the paste line, with no keyboard');
    await kbUp(page, H - panel);
    assert.ok(!(await shown(page, 'scLens')) && !(await shown(page, 'ocrOpen')), 'paste line and photo card gone');
    const r = await page.evaluate(() => ({
      stat: document.getElementById('scStat').getBoundingClientRect().bottom,
      head: document.querySelector('.schead').getBoundingClientRect().bottom,
    }));
    assert.ok(r.stat <= H - panel && r.head <= H - panel, JSON.stringify(r));
    // the keyboard put away: all back
    await kbUp(page, null);
    assert.ok(await shown(page, 'scLens'));
    // the box let go of, the keyboard still reported up for a moment: back too
    await kbUp(page, H - panel);
    await page.evaluate(() => document.getElementById('scBox').blur());
    await idle(page);
    assert.ok(await shown(page, 'scLens'));
    assert.deepEqual(errors, []);
  });
}
