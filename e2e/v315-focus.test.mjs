// v315 (Q8): Focus mode's hand-off card goes above, below, left or right of the next marker's sections, wherever it
// covers least of them, then lets them be biggest, then hides least of the picture; while it's up the picture is
// centred in the room it leaves; never over the zoom buttons or the bars; placed again when the screen turns. Fails on
// v314.1, whose card went above or below only and, on a phone held sideways, over the picture.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, idle, letterGuide, welcome, answerAsks } from './helpers.mjs';

before(setup);
after(teardown);

async function letterFocus(page) {
  await welcome(page, 'look');
  await idle(page);
  await page.click('#mSections');
  await idle(page);
  await letterGuide(page);
  await answerAsks(page);
  await page.click('#sfColor');
  await idle(page);
  await page.click('#sfFocus');
  await idle(page);
}
// Done until the hand-off card shows
async function toCard(page) {
  for (let i = 0; i < 80; i++) {
    await page.click('#sfFDone');
    await idle(page);
    if (await page.isVisible('#sfHand')) return true;
  }
  return false;
}
// the card against the picture, the next marker's sections (their middles), the zoom buttons and the top bar
const geo = (page) =>
  page.evaluate(() => {
    const t = __mstest,
      inter = (a, b) =>
        Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
        Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)),
      card = document.querySelector('#sfHand .sfhcard').getBoundingClientRect(),
      cv = document.getElementById('sfCanvas').getBoundingClientRect(),
      zc = document.getElementById('sfZoomCtl').getBoundingClientRect(),
      bar = document.querySelector('.sffocbar').getBoundingClientRect(),
      k = cv.width / t.W,
      l0 = t.focusOrd[t.focusPos],
      mk = t.assignData.assign[l0].mkey,
      secs = t.assignData.order.filter((l) => t.assignData.assign[l].mkey === mk && !t.colored[l]),
      under = secs.filter((l) => {
        const c = t.comps[l],
          x = cv.left + c.cx * k,
          y = cv.top + c.cy * k;
        return x > card.left && x < card.right && y > card.top && y < card.bottom;
      }).length;
    return {
      side: document.getElementById('sfHand').className,
      overPic: inter(card, cv) / (card.width * card.height),
      under,
      overZoom: inter(card, zc) > 0,
      overBar: card.top < bar.bottom - 1,
    };
  });

test('an iPad held sideways: the card beside the picture, hiding none of it', async () => {
  const { page, errors } = await openApp({ width: 1180, height: 820 });
  await letterFocus(page);
  for (let n = 0; n < 3; n++) {
    assert.ok(await toCard(page), 'a hand-off');
    await page.waitForFunction(() => /sfhleft|sfhright/.test(document.getElementById('sfHand').className));
    const g = await geo(page);
    assert.ok(
      g.overPic < 0.01,
      `${n}: ${g.side} covers ${(g.overPic * 100).toFixed(1)}% of the card's area of picture`,
    );
    assert.equal(g.overZoom, false);
    await page.click('#sfFDone');
    await idle(page);
  }
  assert.deepEqual(errors, []);
});

test('a phone held sideways: no next section under the card, clear of the zoom buttons and the bar; turned, placed again', async () => {
  // (set up upright: the welcome's buttons are below the fold on a phone held sideways)
  const { page, errors } = await openApp({ width: 390, height: 844 });
  await letterFocus(page);
  await page.setViewportSize({ width: 844, height: 390 });
  await idle(page);
  for (let n = 0; n < 3; n++) {
    assert.ok(await toCard(page), 'a hand-off');
    const g = await geo(page);
    assert.equal(g.under, 0, `${n}: ${g.side}: sections under the card`);
    assert.equal(g.overZoom, false, 'over the zoom buttons');
    assert.equal(g.overBar, false, 'over the top bar');
    if (n < 2) {
      await page.click('#sfFDone');
      await idle(page);
    }
  }
  // turned with the card up
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => !/sfhleft|sfhright/.test(document.getElementById('sfHand').className));
  await idle(page);
  const g = await geo(page);
  assert.equal(g.under, 0, 'turned: no section under the card');
  assert.deepEqual(errors, []);
});
