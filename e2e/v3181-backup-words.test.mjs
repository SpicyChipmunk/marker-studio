// v318.1: Back up & restore says the file holds the Tester tasks answers and name too (they went into backups in the
// v318 review), and that one guide is shared by its Guide file, which holds no answers. Fails on v318.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, idle } from './helpers.mjs';

before(setup);
after(teardown);

test('Back up & restore: the file holds the Tester tasks answers and name; one guide goes by its Guide file', async () => {
  const { page, errors } = await openApp({
    width: 820,
    height: 1180,
    storage: { 'ms-onboarded': '1', 'ms-setup-tip': '1' },
  });
  await page.evaluate(() => openBackup());
  await idle(page);
  const t = await page.textContent('#backupOverlay .dsub');
  assert.match(t, /and your Tester tasks answers and name\./);
  assert.match(t, /To share one guide, use its Share & print › Guide file instead\./);
  assert.deepEqual(errors, []);
});
