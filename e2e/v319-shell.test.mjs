// v319, the shell (Fable Y4): Help › What's new from Home's "Updated to …" line on a device that used the app before
// the version last seen (ms-last-ver) was kept is headed plain "What's new" over the versions it lists, not "What's
// new in <this version>" (Y4-3: wnFill, help.js; fails on v318.37). The overlays' Close ✕ (.mclose: Library, Help,
// the swatch and colour charts) is 44 px to a tap at 390 and 320 px, as a finger finds it (Y4-2: measured by
// elementFromPoint, its ::after strip; it passed on v318.37 too, Y4's probe had measured the 36 px box).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, openAtScale, idle } from './helpers.mjs';

before(setup);
after(teardown);

const ONB = { 'ms-onboarded': '1', 'ms-setup-tip': '1' };

test('Home: What’s new with no version last seen (an install from before ms-last-ver) opens Help headed “What’s new”, each item with its version', async () => {
  const { page, errors } = await openApp({
    storage: ONB,
    init: () => {
      window.__MS_HELP_AUTO = true;
    },
  });
  await idle(page);
  const ver = (await page.textContent('#appVer')).trim();
  assert.equal(await page.evaluate(() => localStorage.getItem('ms-last-ver')), null, 'nothing seen yet');
  await page.waitForSelector('#whatsNew', { state: 'visible' });
  assert.equal((await page.textContent('#wnTitle')).trim(), `Updated to ${ver}`);
  await page.click('#wnOpen');
  await page.waitForSelector('#helpOverlay.on');
  await idle(page);
  assert.ok(await page.evaluate(() => document.getElementById('helpNews').open), 'Help opens at What’s new');
  assert.equal((await page.textContent('#helpNews .hlpwnt')).replace(/\s+/g, ' ').trim(), 'What’s new');
  const vs = await page.$$eval('#helpWnList li .hlpwnv', (l) => l.map((x) => x.textContent));
  assert.ok(
    vs.length >= 2 && vs[0] === ver && new Set(vs).size > 1,
    'each item headed with its version: ' + vs,
  );
  assert.equal(
    await page.evaluate(() => localStorage.getItem('ms-last-ver')),
    ver,
    'this version remembered',
  );
  // Help by itself after: this version's, headed with it
  await page.click('#helpClose');
  await idle(page);
  await page.click('#homeHelp');
  await page.waitForSelector('#helpOverlay.on');
  assert.equal(
    (await page.textContent('#helpNews .hlpwnt')).replace(/\s+/g, ' ').trim(),
    `What’s new in ${ver}`,
  );
  assert.deepEqual(errors, []);
});

// the tap area's width along the control's middle row and height along its middle column, 1px steps
const tapArea = (page, sel) =>
  page.evaluate((sel) => {
    const e = document.querySelector(sel),
      r = e.getBoundingClientRect(),
      cx = (r.left + r.right) / 2,
      cy = (r.top + r.bottom) / 2,
      mine = (h) => !!h && (h === e || e.contains(h));
    let w = 0,
      h = 0;
    for (let y = r.top - 30; y <= r.bottom + 30; y++) if (mine(document.elementFromPoint(cx, y))) h++;
    for (let x = r.left - 30; x <= r.right + 30; x++) if (mine(document.elementFromPoint(x, cy))) w++;
    return { w, h };
  }, sel);

for (const [name, scale, vp] of [
  ['390 phone', 1, { width: 390, height: 844 }],
  ['320 phone, Larger text', 1.6, { width: 320, height: 568 }],
]) {
  test(`${name}: the Close ✕ of Help, the Library and the swatch chart is 44 px to a tap`, async () => {
    const { page, errors } = await openAtScale(scale, { ...vp, touch: true, storage: ONB });
    await page.click('#homeHelp');
    await page.waitForSelector('#helpOverlay.on');
    await idle(page);
    let a = await tapArea(page, '#helpClose');
    assert.ok(a.w >= 44 && a.h >= 44, 'Help: ' + JSON.stringify(a));
    await page.click('#helpClose');
    await idle(page);
    await page.evaluate(() => openLibrary());
    await page.waitForSelector('#savedOverlay.on');
    await idle(page);
    a = await tapArea(page, '#savedOverlay .mclose');
    assert.ok(a.w >= 44 && a.h >= 44, 'Library: ' + JSON.stringify(a));
    await page.keyboard.press('Escape');
    await idle(page);
    await page.click('#mCollection');
    await idle(page);
    await page.click('#swatchBtn');
    await page.waitForSelector('#swOverlay.on');
    await idle(page);
    a = await tapArea(page, '#swOverlay .mclose');
    assert.ok(a.w >= 44 && a.h >= 44, 'swatch chart: ' + JSON.stringify(a));
    assert.deepEqual(errors, []);
  });
}
