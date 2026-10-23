// v318.32 G1: Focus mode on the iPad — "Exit" in a word in the top bar, and the hand-off card always on the screen.
// Fails on v318.31: the top bar's way out was a bare ✕ (Ben didn't read it as one), the card ran under the bars and off
// the screen in a short window with large text, and a quick second tap on Done could zoom the whole page (Safari).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, openAtScale, idle, sampleGuide } from './helpers.mjs';

before(setup);
after(teardown);

async function focusOn(page) {
  await sampleGuide(page);
  await idle(page);
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
    if (await page.locator('#sfFReveal').count()) return false;
  }
  return false;
}
const rect = (page, sel) =>
  page.$eval(sel, (e) => {
    const b = e.getBoundingClientRect();
    return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height };
  });

test('G1 exit: "Exit" in a word, labelled, leaves Focus mode to Colour along as Escape does', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, touch: true });
  await focusOn(page);
  const b = await page.$eval('#sfExitFoc', (e) => ({
    text: e.textContent.trim(),
    label: e.getAttribute('aria-label'),
    touch: getComputedStyle(e.closest('.sffocbar')).touchAction,
  }));
  assert.equal(b.text, 'Exit', 'the word (v318.31: a bare ✕)');
  assert.equal(b.label, 'Exit focus mode');
  assert.equal(b.touch, 'manipulation', 'no double-tap zoom of the page from the bar (v318.31: auto)');
  assert.equal(
    await page.$eval('.sffocbot', (e) => getComputedStyle(e).touchAction),
    'manipulation',
    'nor from Done tapped twice in a row',
  );
  // a few sections on, Exit: back on Colour along with that marker's row open, as Escape and the back swipe do
  await page.click('#sfFSkip');
  await idle(page);
  await page.click('#sfFSkip');
  await idle(page);
  const k = await page.evaluate(() => __mstest.assignData.assign[__mstest.focusOrd[__mstest.focusPos]].mkey);
  await page.click('#sfExitFoc');
  await idle(page);
  assert.equal(await page.evaluate(() => __mstest.focus), false);
  assert.equal(await page.evaluate(() => __mstest.sfmode), 'color');
  assert.equal(await page.$eval('#sfAlist .sfarow.open', (r) => r.dataset.k), k, 'that marker’s row open');
  assert.deepEqual(errors, []);
});

test('G1 exit: at 320 px and 1.6× text the bar still fits: Exit, the swatch, two lines of name and Colours', async () => {
  const { page, errors } = await openAtScale(1.6, { width: 320, height: 568, touch: true });
  await focusOn(page);
  const ex = await rect(page, '#sfExitFoc'),
    nm = await rect(page, '.sffocname'),
    co = await rect(page, '#sfFocCols'),
    sw = await rect(page, '#sfFocSw');
  assert.ok(ex.l >= 0 && co.r <= 320, `in the screen: Exit at ${ex.l}, Colours ends at ${co.r}`);
  assert.ok(ex.r <= sw.l && sw.r <= nm.l && nm.r <= co.l, 'in a row, none over another');
  assert.ok(nm.w >= 70, `the name line has room: ${nm.w}px`);
  assert.ok(ex.h >= 40, 'tall enough to tap');
  assert.deepEqual(errors, []);
});

test('G1 card: a short wide window with large text: the card between the bars, on the screen, whole', async () => {
  // (an iPad's Stage Manager window, or Safari with its keyboard up: the room between the bars is shorter than the card)
  const { page, errors } = await openAtScale(2, { width: 1180, height: 460, touch: true });
  await focusOn(page);
  assert.ok(await toCard(page), 'a hand-off');
  const g = await page.evaluate(() => {
    const r = (s) => document.querySelector(s).getBoundingClientRect();
    const card = r('#sfHand .sfhcard'),
      bar = r('.sffocbar'),
      bot = r('.sffocbot');
    return {
      top: card.top,
      bottom: card.bottom,
      barB: bar.bottom,
      botT: bot.top,
      vh: innerHeight,
      scrolls: document.querySelector('#sfHand .sfhcard').scrollHeight > card.height + 1,
    };
  });
  assert.ok(
    g.top >= g.barB - 1,
    `the card starts below the top bar: ${g.top} vs ${g.barB} (v318.31: under it)`,
  );
  assert.ok(g.bottom <= g.botT + 1, `and ends above the bottom bar: ${g.bottom} vs ${g.botT}`);
  assert.ok(g.bottom <= g.vh, 'on the screen');
  // (v318.32 D3-1: a card taller than its room is tried again as the short card, which fits here; the full card had
  // scrolled inside, nothing saying so. Were the short one too tall for the room, it would scroll as before)
  assert.ok(!g.scrolls, 'nothing cut: the short card fits');
  await page.click('#sfFDone');
  await idle(page);
  assert.equal(await page.isVisible('#sfHand'), false, 'Done closes it');
  assert.deepEqual(errors, []);
});

test('G1 card: turned with the card up, the bars measured again before it is placed', async () => {
  const { page, errors } = await openApp({ width: 1180, height: 820, touch: true });
  await focusOn(page);
  assert.ok(await toCard(page), 'a hand-off');
  // (the vars the card's room is laid out from, made stale as a turn would leave them)
  await page.evaluate(() => document.documentElement.style.setProperty('--focTop', '300px'));
  await page.setViewportSize({ width: 820, height: 1180 });
  await idle(page);
  const g = await page.evaluate(() => ({
    v: document.documentElement.style.getPropertyValue('--focTop'),
    bar: document.querySelector('.sffocbar').offsetHeight + 'px',
    up: document.getElementById('sfHand').hidden === false,
  }));
  assert.ok(g.up, 'the card still up');
  assert.equal(
    g.v,
    g.bar,
    'the top bar’s height, measured as the card was placed again (v318.31: left as it was)',
  );
  assert.deepEqual(errors, []);
});
