// v318.1: in a Safari tab, a markers-only collection changed since the last backup brings the reminder on a visit after
// five days away, as guides and palettes do (it had come only after two weeks). Fails on v318.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, idle } from './helpers.mjs';

before(setup);
after(teardown);

const DAY = 864e5,
  KEY = 'ohuhu-hb320-picker-v3',
  IPHONE =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  safariTab = () => {
    Object.defineProperty(Navigator.prototype, 'standalone', { configurable: true, get: () => false });
  },
  own = ['Ohuhu|R014', 'Ohuhu|Y111', 'Ohuhu|B08', 'Ohuhu|G07'],
  state = JSON.stringify({
    mode: 'home',
    ownedSeedV: 2,
    copicAdd1: 1,
    libAdj1: 1,
    setFix1: 1,
    owned: own,
    saved: [],
  }),
  storage = (extra) => ({
    'ms-onboarded': '1',
    'ms-setup-tip': '1',
    'ms-last-ver': 'v318',
    [KEY]: state,
    'ms-first-use': String(Date.now() - 6 * DAY),
    ...extra,
  });
const shown = (page, id) =>
  page.evaluate((id) => {
    const e = document.getElementById(id);
    return !!e && e.style.display !== 'none' && e.getClientRects().length > 0;
  }, id);

test('a Safari tab, markers only, never backed up: a visit after six days away brings Keep your work safe, Not now or not', async () => {
  const { page, errors } = await openApp({
    userAgent: IPHONE,
    init: safariTab,
    // (Add to Home Screen put off with Not now two days ago)
    storage: storage({
      'ms-last-visit': String(Date.now() - 6 * DAY),
      'ms-install-snooze': String(Date.now() + 5 * DAY),
    }),
  });
  await idle(page);
  assert.deepEqual(await page.evaluate(() => backupDue() && backupDue().why), 'gap');
  assert.ok(await shown(page, 'installCard'));
  assert.match(await page.textContent('#installCard'), /^Keep your work safe on this iPhone Safari deletes/);
  assert.equal(await page.textContent('#installCard .nb1'), 'Back up now');
  // a day away only: nothing from the backup
  const b = await openApp({
    userAgent: IPHONE,
    init: safariTab,
    storage: storage({ 'ms-last-visit': String(Date.now() - DAY) }),
  });
  await idle(b.page);
  assert.equal(await b.page.evaluate(() => !!backupDue()), false);
  // backed up since, nothing changed: nothing either
  const c = await openApp({
    userAgent: IPHONE,
    init: safariTab,
    storage: storage({ 'ms-last-visit': String(Date.now() - 6 * DAY) }),
  });
  await idle(c.page);
  await c.page.evaluate(() => {
    localStorage.setItem(BK_SIG, dataSig());
    localStorage.setItem('ms-guides-backup-ts', String(Date.now() - 2 * 864e5));
  });
  assert.equal(await c.page.evaluate(() => !!backupDue()), false);
  assert.deepEqual([...errors, ...b.errors, ...c.errors], []);
});
