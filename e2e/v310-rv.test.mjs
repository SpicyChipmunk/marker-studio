// v310 review: fixes found in the review of the quick section check and the Mood pictures (32-mood-pics)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { setup, teardown, openApp, idle, welcome, ROOT } from './helpers.mjs';

before(setup);
after(teardown);

const MOODS = ['neutral', 'vivid', 'muted', 'pastel', 'deep', 'earthy'];

async function pickLetter(page) {
  const buf = await readFile(join(ROOT, 'e2e', 'fixtures', 'letter-page.png'));
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.evaluate(() => SF.pickPhoto())]);
  await fc.setFiles({ name: 'letter-page.png', mimeType: 'image/png', buffer: buf });
  await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 60000 });
  await idle(page);
}

test('the first Build’s bloom: no Mood picture is made while it shows (its frames kept clear), all of them after', async () => {
  const { page, errors } = await openApp({
    width: 1180,
    height: 820,
    storage: { 'ms-test-moodpics': '1' },
    init: () => {
      window.__MS_BLOOM = true;
    },
  });
  await welcome(page, 'look');
  await idle(page);
  await pickLetter(page);
  // (every 20 ms while the bloom shows: whether a picture was made meanwhile)
  await page.evaluate(() => {
    window.__mpDuring = [];
    let last = null;
    setInterval(() => {
      const t = window.__mstest;
      if (t && t.bloomOn) {
        const s = t.mp.key + '#' + Object.keys(t.mp.pics).join(',');
        if (last !== null && s !== last) __mpDuring.push(Object.keys(t.mp.pics).join(','));
        last = s;
      } else last = null;
    }, 20);
  });
  await page.click('#sfBuild');
  await page.waitForFunction(() => __mstest.bloomOn, null, { timeout: 60000 });
  // (a new guide opens on the Colours tab, Mood's pictures first in it)
  assert.ok(await page.isVisible('#sfMood.sfmoodpics'));
  // (over by itself; or, where frames come slowly (WebKit here), after 2 s, by a key, as a person's tap ends it)
  await page
    .waitForFunction(() => !__mstest.bloomOn, null, { timeout: 2000 })
    .catch(() => page.keyboard.press('Shift'));
  await page.waitForFunction(() => !__mstest.bloomOn, null, { timeout: 5000 });
  assert.deepEqual(await page.evaluate(() => __mpDuring), [], 'made while the bloom showed');
  // and once it's over, every picture
  await page.evaluate(() => document.getElementById('sfMood').scrollIntoView({ block: 'center' }));
  await page.waitForFunction(
    (M) => {
      const t = __mstest;
      return t.mp.key === t.mpKey() && M.every((k) => k === t.emphasis || k in t.mp.pics);
    },
    MOODS,
    { timeout: 30000 },
  );
  assert.deepEqual(errors, []);
});

const shown = (page, sel) =>
  page.evaluate((s) => {
    const e = document.querySelector(s);
    return !!e && e.getClientRects().length > 0;
  }, sel);

test('the quick check: once a warning has brought the full step, it stays for that picture when the warning goes', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, storage: { 'ms-sec-tools': '0' } });
  await welcome(page, 'look');
  await idle(page);
  await pickLetter(page);
  assert.ok(await shown(page, '#sfQuick'));
  // a warning about the sections (as segQuality gives one): the full step, the tools in hand
  await page.evaluate(() => {
    __mstest.segWarn = { ok: false, msg: 'Lots of tiny sections', tip: 'Raise Min section size.' };
    __mstest.renderControls();
  });
  await idle(page);
  assert.ok(await shown(page, '.sfc-segwarn'));
  assert.ok(await shown(page, '#sfEdit'));
  // Min section size let go: the warning checked again, and gone
  await page.evaluate(() => {
    const s = document.getElementById('sfMin');
    s.value = String(+s.value + 1);
    s.dispatchEvent(new Event('input', { bubbles: true }));
    s.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await idle(page);
  assert.equal(await shown(page, '.sfc-segwarn'), false);
  assert.ok(await shown(page, '#sfEdit'));
  // Adjust photo opened (the step drawn again): still the full step, not "Looks right?" with the tools put away
  await page.click('#sfAdjToggle');
  await idle(page);
  assert.ok(await shown(page, '#sfEdit'), 'the tools still there');
  assert.equal(await shown(page, '#sfQuick'), false);
  assert.equal(await page.getAttribute('#sfAdjToggle', 'aria-expanded'), 'true');
  assert.deepEqual(errors, []);
});
