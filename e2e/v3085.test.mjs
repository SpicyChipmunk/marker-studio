// v308.5: Copy diagnostics carries a trace of what Scan's box was sent this visit (Scan Text on an iPad stopped after
// the first cap; the trace shows what the iPad sends).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, welcome, idle, scanFromMarkers } from './helpers.mjs';

before(setup);
after(teardown);

test('Scan’s box events are kept for Copy diagnostics: input, the read and the clear', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, storage: { 'ms-scan-brand': '' } });
  await welcome(page, 'look');
  await idle(page);
  await page.click('#mCollection');
  await idle(page);
  await scanFromMarkers(page);
  await idle(page);
  await page.evaluate(() => {
    const b = document.getElementById('scBox');
    b.value = 'B015 Celadon Blue';
    b.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertReplacementText' }));
  });
  await page.waitForTimeout(1200);
  const d = await page.evaluate(() => errDetails());
  assert.match(d, /Scan box, this visit:/);
  assert.match(d, /input insertReplacementText value:17 "B015 Celadon Blue"/);
  assert.match(d, /read: 1 found/);
  assert.match(d, /cleared by the app/);
  assert.deepEqual(errors, []);
});
