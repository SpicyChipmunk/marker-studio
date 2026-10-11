// v313 (Focus mode): D2, the hand-off card between one marker and the next, and each marker starting on its largest
// section (D11). The card says how the last marker went (all coloured, or how many of them) and which to pick up, with
// the picture zoomed out to the new one's sections; Done, a tap anywhere (which ticks nothing) or Escape closes it and
// goes in to the first section. Each test fails on v312.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, sampleGuide, idle } from './helpers.mjs';

before(setup);
after(teardown);

const st = (page) =>
  page.evaluate(() => {
    const t = __mstest,
      l = t.focusOrd[t.focusPos];
    return {
      pos: t.focusPos,
      l,
      mk: l != null ? t.assignData.assign[l].mkey : null,
      zoom: t.zoom,
      done: [...t.colored].reduce((a, b) => a + b, 0),
      hand: !document.getElementById('sfHand').hidden,
    };
  });
async function enterFocus(page) {
  await page.click('#sfColor');
  await idle(page);
  await page.click('#sfFocus');
  await idle(page);
}
// Done until the card shows (or n presses)
async function doneToCard(page, n = 60) {
  for (let i = 0; i < n; i++) {
    await page.click('#sfFDone');
    await idle(page);
    if ((await st(page)).hand) return true;
  }
  return false;
}
const card = (page) =>
  page.evaluate(() => {
    const e = document.getElementById('sfHand');
    return {
      head: e.querySelector('.sfhhead').textContent,
      lbl: e.querySelector('.sfhlbl').textContent,
      name: e.querySelector('.sfhname').textContent,
      sub: e.querySelector('.sfhsub').textContent,
    };
  });

test('each marker starts on its largest section; finishing one shows the hand-off card, zoomed out to the next one’s sections; a tap on the picture closes it and ticks nothing', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await enterFocus(page);
  // the first section is the first marker's largest
  const big = await page.evaluate(() => {
    const t = __mstest,
      l = t.focusOrd[t.focusPos],
      k = t.assignData.assign[l].mkey,
      secs = t.assignData.order.filter((q) => t.assignData.assign[q].mkey === k);
    return { l, max: secs.reduce((a, b) => (t.comps[b].area > t.comps[a].area ? b : a)), k, n: secs.length };
  });
  assert.equal(big.l, big.max, 'the largest section first');
  const first = (await st(page)).mk;
  assert.ok(await doneToCard(page), 'the card');
  const s1 = await st(page);
  assert.notEqual(s1.mk, first, 'on the next marker');
  const c = await card(page);
  assert.match(c.head, new RegExp(first.split('|')[1] + ' · all ' + big.n + ' coloured'));
  assert.equal(c.lbl, 'Pick up');
  assert.match(c.name, new RegExp(s1.mk.split('|')[1]));
  assert.match(c.sub, /sections?, shown on the picture\. Tap Done when it’s in your hand\./);
  // zoomed out (no further in than its first section's own zoom)
  const zIn = await page.evaluate(() => __mstest.focusZoomFor(__mstest.focusOrd[__mstest.focusPos]));
  assert.ok(s1.zoom <= zIn + 1e-6, `zoomed out: ${s1.zoom} ≤ ${zIn}`);
  // a tap on the picture: closes it, ticks nothing
  const box = await page.locator('#sfCanvas').boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await idle(page);
  const s2 = await st(page);
  assert.equal(s2.hand, false, 'closed');
  assert.equal(s2.done, s1.done, 'nothing ticked');
  assert.equal(s2.pos, s1.pos, 'still on the same section');
  assert.ok(Math.abs(s2.zoom - zIn) < 1e-6, 'in to its section');
  assert.deepEqual(errors, []);
});

test('a marker with sections skipped: the card says how many were coloured; Done closes it without a tick; Escape closes it too', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await enterFocus(page);
  const first = (await st(page)).mk;
  const n = await page.evaluate(
    (k) => __mstest.assignData.order.filter((q) => __mstest.assignData.assign[q].mkey === k).length,
    first,
  );
  assert.ok(n >= 2);
  await page.click('#sfFSkip');
  await idle(page);
  assert.equal((await st(page)).hand, false, 'no card between one marker’s sections');
  assert.ok(await doneToCard(page), 'the card');
  assert.match((await card(page)).head, new RegExp(': ' + (n - 1) + ' of ' + n + ' coloured'));
  const s1 = await st(page);
  await page.click('#sfFDone');
  await idle(page);
  const s2 = await st(page);
  assert.equal(s2.hand, false);
  assert.equal(s2.done, s1.done, 'Done closed it, no tick');
  // the next marker change, and Escape
  assert.ok(await doneToCard(page), 'the next card');
  await page.keyboard.press('Escape');
  await idle(page);
  const s3 = await st(page);
  assert.equal(s3.hand, false);
  assert.ok(await page.evaluate(() => __mstest.focus), 'still in Focus mode');
  assert.deepEqual(errors, []);
});
