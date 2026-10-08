// v308.2, from the v308.1 debugging pass: a hex code pasted with a space still matches; the restore's Undo marker
// change leaves the keyboard in the Library.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, welcome, idle } from './helpers.mjs';

before(setup);
after(teardown);

test('Match: a hex code pasted with spaces round it is read (the box had cut it at 7 characters)', async () => {
  const { page, errors } = await openApp();
  await welcome(page, 'look');
  await page.click('#mCollection');
  await page.click('#mkMatchBtn');
  await idle(page);
  await page.click('.msrc [data-src="hex"]');
  await page.fill('#matchHex', ' #3a7bd5 ');
  await idle(page);
  assert.notEqual(
    await page.evaluate(() => document.querySelector('#matchResult .mbname')?.textContent.trim() || ''),
    '',
  );
  assert.equal(
    await page.evaluate(() => document.getElementById('matchHexHint')?.textContent || ''),
    '',
    'no complaint',
  );
  assert.deepEqual(errors, []);
});

test('Restore, then Undo marker change from its toast: the keyboard is back on the Library’s Restore', async () => {
  const KEY = 'ohuhu-hb320-picker-v3';
  const { page, errors } = await openApp({
    width: 820,
    height: 1180,
    storage: {
      'ms-onboarded': '1',
      'ms-setup-tip': '1',
      'ms-last-ver': 'v308',
      [KEY]: JSON.stringify({
        mode: 'home',
        ownedSeedV: 2,
        copicAdd1: 1,
        libAdj1: 1,
        setFix1: 1,
        owned: ['Ohuhu|R014', 'Ohuhu|B08'],
        saved: [],
      }),
    },
  });
  await page.evaluate(() => openLibrary());
  await page.waitForSelector('#savedOverlay.on');
  const bk = {
    v: 3,
    type: 'ms-backup',
    app: 'v308',
    ts: Date.now(),
    owned: ['Copic|E19', 'Copic|G09'],
    wish: [],
    ink: {},
    saved: [],
    guides: [],
  };
  await page.setInputFiles('#guidesFile', {
    name: 'b.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(bk)),
  });
  await page.waitForSelector('#sfEdAsk');
  await page.click('#sfEdAsk [data-a="add"]');
  await idle(page);
  assert.equal(await page.evaluate(() => state.owned.size), 4);
  await page.click('#toastAct');
  await idle(page);
  assert.equal(await page.evaluate(() => state.owned.size), 2, 'put back');
  assert.equal(
    await page.evaluate(() => document.activeElement && document.activeElement.id),
    'guidesRestore',
  );
  assert.deepEqual(errors, []);
});
