// v318.32 (G4): Random's Pattern panel, the small clear wins from Ben's iPad pass: Balance's row fills the width as
// Pattern's other rows do, a line under it says what Mixed and Main colour do, the role bar is a group screen readers
// hear, No repeats' note is said in full, and Colours' greyed count says why.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, sampleGuide, idle } from './helpers.mjs';

before(setup);
after(teardown);

async function random(page) {
  await page.click('.sftabbtn[data-t="pattern"]');
  await idle(page);
  await page.click('#sfFam [data-v="random"]');
  await idle(page);
}

test('iPad upright: Balance fills its row like Flow and Look, says what the chosen one does, and the role bar is a named group', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, touch: true, moreShut: true });
  await sampleGuide(page);
  await idle(page);
  await random(page);
  // the row: both buttons about half the panel, as Direction's Forward and Reversed are
  const w = await page.evaluate(() => {
    const row = document.getElementById('sfFam').getBoundingClientRect().width,
      b = [...document.querySelectorAll('#sfBal .sfedit')].map((x) => x.getBoundingClientRect().width);
    return { row, b, cls: document.getElementById('sfBal').className };
  });
  assert.match(w.cls, /\bsffit\b/, w.cls);
  assert.ok(w.b.length === 2 && w.b.every((x) => x > w.row * 0.4), JSON.stringify(w));
  // the line under it, for each
  assert.equal(await page.getAttribute('#sfBal [data-v="main"]', 'aria-pressed'), 'true');
  assert.equal(
    (await page.textContent('#sfBalHint')).trim(),
    'One colour over most of the picture, a second with it and an accent.',
  );
  // (v318.34: the rows, #sfBalRows; the bar before)
  assert.equal(await page.getAttribute('#sfBalRows', 'role'), 'group');
  assert.equal(await page.getAttribute('#sfBalRows', 'aria-label'), 'Main, second and accent colours');
  await page.click('#sfBal [data-v="mixed"]');
  await idle(page);
  assert.equal((await page.textContent('#sfBalHint')).trim(), 'Any marker on any section, all mixed together.');
  assert.equal(await page.$('#sfBalRows'), null);
  assert.deepEqual(errors, []);
});

test('No repeats: its note is said in full, and Colours’ greyed count says why (gone when No repeats is off)', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, touch: true, moreShut: true });
  await sampleGuide(page);
  await idle(page);
  await random(page);
  await page.click('#sfBal [data-v="mixed"]');
  await idle(page);
  await page.click('.sftabbtn[data-t="colours"]');
  await idle(page);
  assert.equal(await page.$('#sfMkNrNote'), null, 'no note before No repeats');
  await page.click('.sftabbtn[data-t="pattern"]');
  await idle(page);
  await page.click('#sfNoRep');
  await idle(page);
  // (the sample's 166 sections on Honolulu 120's markers: fewer markers than sections, so the fuller line)
  const note = (await page.textContent('#sfNoRepNote')).trim();
  assert.match(
    note,
    /^\d+ sections, \d+ markers: (?:each used about \d+ times|\d+ used twice), each used once before any is used again, kept apart\./,
    note,
  );
  await page.click('.sftabbtn[data-t="colours"]');
  await idle(page);
  assert.match(await page.textContent('#sfMkNlbl'), /one per section/);
  assert.equal(
    (await page.textContent('#sfMkNrNote')).trim(),
    'No repeats is on (Pattern): every section its own marker.',
  );
  assert.ok(await page.isVisible('#sfMkNrNote'));
  // off again: the note goes with it
  await page.click('.sftabbtn[data-t="pattern"]');
  await idle(page);
  await page.click('#sfNoRep');
  await idle(page);
  await page.click('.sftabbtn[data-t="colours"]');
  await idle(page);
  assert.equal(await page.$('#sfMkNrNote'), null);
  assert.deepEqual(errors, []);
});
