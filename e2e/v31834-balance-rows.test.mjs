// v318.34 (Stage 3 E, decision 5a): Guide › Pattern › Random › Main colour shows its roles as rows under a thin share
// strip ("Main colour · pinks · about 60% · Auto ›", or "Your choice"), each 44 px and opening the role's sheet; a
// screen reader hears "Main colour: pinks, about 60%, Auto. Change". Random's own action row holds Shuffle and, with
// Main colour laid, ↻ Other pairings with a line telling the two apart; Pin colours stays below, shared by every pattern.
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
const rect = (page, sel) =>
  page.evaluate((s) => {
    const e = document.querySelector(s);
    return e ? e.getBoundingClientRect().toJSON() : null;
  }, sel);
const fam = (page, r) => page.evaluate((r) => __mstest.balName(r, __mstest.balPlan()).toLowerCase(), r);
// (the share as the row says it: measured, to the nearest 5, as e2e/balance's measured())
const pc = (page, r) =>
  page.evaluate((r) => {
    const t = __mstest,
      f = t.balMeasure(t.balPlan()).f[r];
    return Math.round(f * 20) * 5;
  }, r);
const rows = (page) =>
  page.$$eval('#sfBalRows .sfbalr', (b) =>
    b.map((x) => ({
      id: x.id,
      t: x.innerText.replace(/\s+/g, ' ').trim(),
      lab: x.getAttribute('aria-label'),
      h: x.getBoundingClientRect().height,
    })),
  );

for (const [name, vp] of [
  ['iPad upright', { width: 820, height: 1180, touch: true, moreShut: true }],
  ['phone', { width: 390, height: 844, touch: true, moreShut: true }],
]) {
  test(`${name}: a strip, then three 44 px rows that say role, family, share and Auto; each opens its sheet; a family picked by hand reads "Your choice"`, async () => {
    const { page, errors } = await openApp(vp);
    await sampleGuide(page);
    await idle(page);
    await random(page);
    assert.equal(await page.getAttribute('#sfBal [data-v="main"]', 'aria-pressed'), 'true');
    // the strip: one part a role, no words
    assert.equal(await page.getAttribute('.sfbalstrip', 'aria-hidden'), 'true');
    assert.equal(await page.$$eval('.sfbalstrip i', (b) => b.length), 3);
    assert.equal((await page.textContent('.sfbalstrip')).trim(), '');
    const r0 = await rows(page);
    assert.deepEqual(
      r0.map((x) => x.id),
      ['sfBalM', 'sfBalS', 'sfBalA'],
    );
    for (const [i, r, role] of [
      [0, 'm', 'Main colour'],
      [1, 's', 'Second colour'],
      [2, 'a', 'Accent'],
    ]) {
      const f = await fam(page, r),
        share = 'about ' + (await pc(page, r)) + '%';
      assert.equal(r0[i].t, role + ' · ' + f + ' · ' + share + ' · Auto');
      assert.equal(r0[i].lab, role + ': ' + f + ', ' + share + ', Auto. Change');
      assert.ok(r0[i].h >= 44, role + ' row ' + r0[i].h + 'px');
    }
    // (the old bar's parts are gone)
    assert.equal(await page.$('#sfBalBar, .sfbalseg'), null);
    // each row opens the role's sheet, titled for it
    for (const [r, role] of [
      ['m', 'Main colour'],
      ['s', 'Second colour'],
      ['a', 'Accent'],
    ]) {
      await page.click('#sfBal' + r.toUpperCase());
      await page.waitForSelector('#sfSheet.sfbalsh');
      await idle(page);
      assert.equal(
        await page.textContent('#sfSheetT'),
        role + ': ' + (await fam(page, r)) + ' · about ' + (await pc(page, r)) + '%',
      );
      assert.equal(await page.getAttribute('#sfSheet .sfbalopt[data-k="auto"]', 'aria-pressed'), 'true');
      await page.keyboard.press('Escape');
      await page.waitForSelector('#sfSheet', { state: 'detached' });
    }
    // the second colour picked by hand (a family no other role has: one that is would swap them): its row says
    // Your choice, the others stay Auto
    await page.click('#sfBalS');
    await page.waitForSelector('#sfSheet.sfbalsh');
    await idle(page);
    const pick = await page.$$eval('#sfSheet .sfbalopt', (b) =>
      b
        .filter(
          (x) =>
            x.dataset.k !== 'auto' &&
            !x.disabled &&
            x.getAttribute('aria-pressed') !== 'true' &&
            !/they swap/.test(x.textContent),
        )
        .map((x) => x.dataset.k),
    );
    assert.ok(pick.length, 'another family to pick');
    await page.click(`#sfSheet .sfbalopt[data-k="${pick[0]}"]`);
    await idle(page);
    const r1 = await rows(page);
    assert.equal(
      r1[1].t,
      'Second colour · ' + (await fam(page, 's')) + ' · about ' + (await pc(page, 's')) + '% · Your choice',
    );
    assert.equal(
      r1[1].lab,
      'Second colour: ' +
        (await fam(page, 's')) +
        ', about ' +
        (await pc(page, 's')) +
        '%, Your choice. Change',
    );
    assert.match(r1[0].t, / · Auto$/);
    assert.match(r1[2].t, / · Auto$/);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'sfBalS', 'focus back on the row');
    assert.deepEqual(errors, []);
  });
}

test('Random’s own action row: Shuffle, and with Main colour laid Other pairings with its line; Mixed has Shuffle alone; Pin colours stays below, shared', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, touch: true, moreShut: true });
  await sampleGuide(page);
  await idle(page);
  await random(page);
  const sh = await rect(page, '#sfShuffle'),
    pr = await rect(page, '#sfBalPair'),
    pin = await rect(page, '#sfLock');
  assert.ok(sh && pr && pin, 'all three there');
  assert.ok(Math.abs(sh.top - pr.top) < 1 && sh.right <= pr.left, 'Shuffle and Other pairings side by side');
  assert.ok(sh.bottom <= pin.top, 'Pin colours under them');
  assert.equal(
    (await page.textContent('#sfBalRollNote')).trim(),
    'Shuffle lays the same colours again · Other pairings picks new colours for the roles on Auto',
  );
  const note = await rect(page, '#sfBalRollNote');
  assert.ok(sh.bottom <= note.top && note.bottom <= pin.top, 'the line between the row and Pin colours');
  // (Shuffle in the row, not the shared block: the shared block holds Pin colours alone)
  assert.equal(await page.$('#sfShuffle + #sfLock'), null);
  assert.equal(await page.evaluate(() => document.getElementById('sfLock').parentElement.children.length), 1);
  assert.ok(sh.height >= 44 && pr.height >= 44 && pin.height >= 44, 'tap targets');
  // Mixed: no roles, so no Other pairings and no line; Shuffle and Pin colours stay
  await page.click('#sfBal [data-v="mixed"]');
  await idle(page);
  assert.equal(await page.$('#sfBalPair'), null);
  assert.equal(await page.$('#sfBalRollNote'), null);
  assert.equal(await page.$('#sfBalRows'), null);
  assert.ok((await rect(page, '#sfShuffle')) && (await rect(page, '#sfLock')));
  // Gradient and Manual keep theirs as they were
  await page.click('#sfFam [data-v="gradient"]');
  await idle(page);
  assert.ok(await page.$('#sfVary'));
  assert.equal(await page.$('#sfShuffle, #sfBalPair, #sfBalRollNote'), null);
  assert.deepEqual(errors, []);
});
