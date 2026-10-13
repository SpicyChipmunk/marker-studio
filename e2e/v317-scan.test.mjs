// v317: Scan on Android. The steps say Gboard's Scan text; text arriving two or more characters at once (Gboard's
// Insert, as a composition after its key 229 or committed) is read without Enter, while a code composed a letter at a
// time, a suggestion tapped or a correction still waits for Enter; text read during a composition that the keyboard
// leaves in the box goes when the composition ends. The Lens / Live Text line is on every device. The iPad's steps and
// box are as they were (v3086.test.mjs, v298.test.mjs).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, welcome, idle, scanFromMarkers, pause } from './helpers.mjs';

before(setup);
after(teardown);

const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
const IPAD_UA =
  'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

async function opened(userAgent, width = 390, height = 844) {
  const a = await openApp({ width, height, storage: { 'ms-scan-brand': '' }, userAgent });
  await welcome(a.page, 'look');
  await idle(a.page);
  await a.page.click('#mCollection');
  await idle(a.page);
  await scanFromMarkers(a.page);
  await idle(a.page);
  return a;
}
// Android Chrome sends keydown 229 before what the keyboard puts in
const key229 = (page) =>
  page.evaluate(() => {
    const b = document.getElementById('scBox');
    b.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Unidentified', keyCode: 229 }));
    b.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Unidentified', keyCode: 229 }));
  });
// a composition: started, or the whole of it so far (Gboard composes a word a letter at a time)
const compIn = (page, t, start) =>
  page.evaluate(
    ([t, start]) => {
      const b = document.getElementById('scBox');
      if (start) b.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: '' }));
      b.dispatchEvent(new CompositionEvent('compositionupdate', { bubbles: true, data: t }));
      b.value = t;
      b.dispatchEvent(
        new InputEvent('input', {
          bubbles: true,
          inputType: 'insertCompositionText',
          isComposing: true,
          data: t,
        }),
      );
    },
    [t, start],
  );
// the composition committed as Chrome does it: a last insertCompositionText with the whole text, then compositionend
const compEnd = (page, t) =>
  page.evaluate((t) => {
    const b = document.getElementById('scBox');
    b.value = t;
    b.dispatchEvent(
      new InputEvent('input', {
        bubbles: true,
        inputType: 'insertCompositionText',
        isComposing: true,
        data: t,
      }),
    );
    b.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: t }));
  }, t);
// committed outright (commitText: insertText with the whole string)
const commitIn = (page, t) =>
  page.evaluate((t) => {
    const b = document.getElementById('scBox');
    b.value += t;
    b.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: t }));
  }, t);
const list = (page) =>
  page.$$eval('#scList .scrow', (rs) =>
    rs.map((r) => (r.querySelector('.sccode') || r.querySelector('b')).textContent),
  );
const steps = (page) => page.$$eval('#scHow li b', (l) => l.map((b) => b.textContent));

test('Android: the steps say Gboard’s Scan text, and the Lens line; an iPad keeps AutoFill › Scan Text and Live Text', async () => {
  const a = await opened(ANDROID_UA);
  assert.deepEqual(await steps(a.page), ['Tap the box', 'Gboard › Scan text', 'Snap, then Insert']);
  assert.match(
    await a.page.textContent('#scHow'),
    /tap ✓ after it[\s\S]*With Gboard \(free on Google Play\)[\s\S]*four squares[\s\S]*tap Scan text[\s\S]*Photograph one cap and tap Insert: its code is read, with a beep\. Then ← for the next cap\./,
  );
  // (v318: the set's box or an order email too)
  assert.match(
    await a.page.textContent('#scLensT'),
    /^A whole tray, the set’s box or an order email: copy its text with Google Lens, then long-press the box › Paste\. A set’s name adds the whole set, asked first\.$/,
  );
  const b = await opened(IPAD_UA);
  assert.deepEqual(await steps(b.page), ['Tap the box', 'AutoFill › Scan Text', 'Cap after cap']);
  assert.match(
    await b.page.textContent('#scLensT'),
    /copy its text \(Live Text in Photos, or Google Lens\) and paste it here/,
  );
  assert.deepEqual(a.errors.concat(b.errors), []);
});

test('Android: a cap’s text put in at once, as a composition after key 229 or committed, is read and the box cleared; the next cap too', async () => {
  const { page, errors } = await opened(ANDROID_UA);
  // committed over an open composition (Chrome: the whole text once more, then compositionend)
  await key229(page);
  await compIn(page, 'E75 Light Rose Taupe', true);
  await compEnd(page, 'E75 Light Rose Taupe');
  await page.waitForFunction(() => document.querySelector('#scList .scrow'), null, { timeout: 3000 });
  assert.deepEqual(await list(page), ['E75']);
  await page.waitForFunction(() => document.getElementById('scBox').value === '', null, { timeout: 3000 });
  // committed outright
  await key229(page);
  await commitIn(page, 'CG17 Cool Grey');
  await page.waitForFunction(() => document.querySelectorAll('#scList .scrow').length === 2, null, {
    timeout: 3000,
  });
  assert.deepEqual(await list(page), ['CG17', 'E75']);
  await page.waitForFunction(() => document.getElementById('scBox').value === '', null, { timeout: 3000 });
  // a composition left open: read, left in the box (never cleared mid-composition, v308.6), replaced by the next cap,
  // and cleared once the composition ends
  await key229(page);
  await compIn(page, 'B015 Celadon Blue', true);
  await page.waitForFunction(() => document.querySelectorAll('#scList .scrow').length === 3, null, {
    timeout: 3000,
  });
  await pause(page, 500, 'the box is cleared 250 ms after a read: not during a composition');
  assert.equal(await page.inputValue('#scBox'), 'B015 Celadon Blue');
  await key229(page);
  await compIn(page, 'YG06 Sugarcane', false);
  await page.waitForFunction(() => document.querySelectorAll('#scList .scrow').length === 4, null, {
    timeout: 3000,
  });
  assert.deepEqual(await list(page), ['YG06', 'B015', 'CG17', 'E75']);
  await pause(page, 500, 'the box is cleared 250 ms after a read: not during a composition');
  assert.equal(await page.inputValue('#scBox'), 'YG06 Sugarcane');
  await compEnd(page, 'YG06 Sugarcane');
  assert.equal(await page.inputValue('#scBox'), '');
  assert.deepEqual(errors, []);
});

test('Android: a code composed a letter at a time, a correction on space and a suggestion tapped are typing: nothing read until Enter', async () => {
  const { page, errors } = await opened(ANDROID_UA);
  for (const v of ['e', 'e7', 'e75']) {
    await key229(page);
    await compIn(page, v, v === 'e');
  }
  await key229(page);
  await compEnd(page, 'E75 '); // autocorrect on space
  await pause(page, 1000, 'longer than the box waits for text to hold still: nothing may be read');
  assert.deepEqual(await list(page), []);
  assert.equal(await page.inputValue('#scBox'), 'E75 ');
  await page.keyboard.press('Enter');
  await idle(page);
  assert.deepEqual(await list(page), ['E75']);
  // a name typed with suggestions: "Ta" to "Taupe "
  for (const v of ['L', 'Li', 'Lig', 'Ligh', 'Light']) {
    await key229(page);
    await compIn(page, v, v === 'L');
  }
  await key229(page);
  await compEnd(page, 'Light ');
  for (const v of ['Light T', 'Light Ta']) {
    await key229(page);
    await compIn(page, v, v === 'Light T');
  }
  await key229(page);
  await compEnd(page, 'Light Taupe ');
  await pause(page, 2200, 'longer than the box waits to clear text with nothing in it: typing must stay');
  assert.equal(await page.inputValue('#scBox'), 'Light Taupe ');
  assert.deepEqual(await list(page), ['E75']);
  assert.deepEqual(errors, []);
});

test('a pasted tray photo’s text: names on lines of their own under their codes aren’t asked about, plain words aren’t "not read"', async () => {
  const { page, errors } = await opened(IPAD_UA, 820, 1180);
  await page.evaluate((t) => {
    const d = new DataTransfer();
    d.setData('text/plain', t);
    document
      .getElementById('scBox')
      .dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: d }));
  }, 'CG17\nAbalone\nBGY02\nPigeon\nGrey\nE75\nLight Rose\nTaupe\nSWE\nFY01\nFluorescent\nOrange\nn6ea\nCool Grey');
  await idle(page);
  assert.deepEqual(await list(page), ['FY01', 'E75', 'BGY02', 'CG17']);
  const stat = (await page.textContent('#scStat')).replace(/\s+/g, ' ');
  assert.match(stat, /4 added to the list/);
  assert.match(stat, /1 line not read/, stat); // n6ea: a digit in it
  assert.doesNotMatch(stat, /to choose/);
  assert.deepEqual(errors, []);
});
