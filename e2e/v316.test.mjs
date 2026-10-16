// v316's interface: Markers' families lightest first, with Order (Lightest first | Code order) in every grid view and a
// saved Code order moved to Lightest first once; an upright iPad's Plan starting a narrow picture at its floor, and
// Colour along's first row on the first screen; How it works on a new user's Home; one picked tint. Fails on v315.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, idle, welcome, sampleGuide, letterGuide, answerAsks } from './helpers.mjs';

before(setup);
after(teardown);

// the codes of a family's markers of one brand, as the grid shows them, with their lightness
const family = (page, fam, brand) =>
  page.evaluate(
    ([fam, brand]) => {
      const g = [...document.querySelectorAll('.rgroup')].find((x) =>
        new RegExp('^' + fam + '\\b').test(x.querySelector('.rghead').textContent.trim()),
      );
      return [...g.querySelectorAll('.cell, [data-i]')]
        .map((c) => +c.dataset.i)
        .filter((i) => i >= 0 && COLORS[i].brand === brand)
        .map((i) => ({ code: COLORS[i].code, L: LAB[i][0] }));
    },
    [fam, brand],
  );
const opts = (page) => page.$$eval('#gapSort option', (a) => a.map((o) => o.value));

test('Markers: families lightest first; Order in Owned, Unowned and All (two orders, five in Unowned), not To buy', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await welcome(page, 'look');
  await idle(page);
  await page.click('#mCollection');
  await page.click('#ownView [data-v="all"]');
  await idle(page);
  assert.equal(await page.inputValue('#gapSort'), 'light');
  const red = await family(page, 'Red', 'Ohuhu');
  assert.ok(red.length > 10);
  for (let i = 1; i < red.length; i++)
    assert.ok(red[i].L <= red[i - 1].L + 1e-9, 'lightest first: ' + red[i - 1].code + ' then ' + red[i].code);
  for (const v of ['owned', 'all']) {
    await page.click('#ownView [data-v="' + v + '"]');
    await idle(page);
    assert.ok(await page.isVisible('#gapSort'), v);
    assert.deepEqual(await opts(page), ['light', 'code'], v);
  }
  await page.click('#ownView [data-v="unowned"]');
  await idle(page);
  assert.deepEqual(await opts(page), ['light', 'code', 'gap', 'ramps', 'complete']);
  // a ranking chosen in Unowned shows as Lightest first in Owned
  await page.selectOption('#gapSort', 'gap');
  await idle(page);
  await page.click('#ownView [data-v="owned"]');
  await idle(page);
  assert.equal(await page.inputValue('#gapSort'), 'light');
  await page.click('#ownView [data-v="wish"]');
  await idle(page);
  assert.equal(await page.isVisible('#gapSort'), false, 'not on To buy');
  // Code order: by the code's text
  await page.click('#ownView [data-v="all"]');
  await idle(page);
  await page.selectOption('#gapSort', 'code');
  await idle(page);
  const byCode = (await family(page, 'Red', 'Ohuhu')).map((m) => m.code);
  assert.deepEqual(byCode, byCode.slice().sort());
  assert.deepEqual(errors, []);
});

test('a Code order saved before v316 becomes Lightest first once; Code order chosen after that stays', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await welcome(page, 'look');
  await idle(page);
  // as v315 saved it: Code order, and no note that the move was made
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem(KEY));
    s.gapSort = 'code';
    delete s.ordLight1;
    localStorage.setItem(KEY, JSON.stringify(s));
  });
  await page.reload();
  await idle(page);
  assert.equal(await page.evaluate(() => state.gapSort), 'light');
  await page.click('#mCollection');
  await page.click('#ownView [data-v="all"]');
  await idle(page);
  assert.equal(await page.inputValue('#gapSort'), 'light');
  await page.selectOption('#gapSort', 'code');
  await idle(page);
  await page.reload();
  await idle(page);
  assert.equal(await page.evaluate(() => state.gapSort), 'code', 'kept');
  assert.deepEqual(errors, []);
});

// the picture's height on the screen, and whether Colour along's first marker row is wholly above the bar
const picH = (page) =>
  page.evaluate(() => Math.round(document.getElementById('sfCanvas').getBoundingClientRect().height));
// (v318.7: waited for, up to 3 s, as the picture's height settles: a slow WebKit on GitHub measured it mid-change once,
// "Colour along: 708" — 708 by the time the message read it)
const picNear = async (page, want) => {
  await page
    .waitForFunction(
      (w) => Math.abs(Math.round(document.getElementById('sfCanvas').getBoundingClientRect().height) - w) <= 2,
      want,
      { timeout: 3000 },
    )
    .catch(() => {});
  return Math.abs((await picH(page)) - want) <= 2;
};
const firstRowShows = (page) =>
  page.evaluate(() => {
    scrollTo(0, 0);
    const bar = [...document.querySelectorAll('.sfbar')].find((b) => b.offsetParent),
      r = document.querySelector('#sfAlist .sfarow');
    return r.getBoundingClientRect().bottom <= bar.getBoundingClientRect().top;
  });

test('an upright iPad: a narrow picture starts the Plan at the 50% floor, a page-shaped one at 60%; Colour along 60%, its first row on the first screen', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await idle(page);
  assert.ok(await picNear(page, 590), 'the sample in the Plan: ' + (await picH(page)));
  await page.click('#sfColor');
  await idle(page);
  assert.ok(await picNear(page, 708), 'Colour along: ' + (await picH(page)));
  assert.ok(await firstRowShows(page), 'the first marker row above the bar');
  await page.click('#sfDoneBtn');
  await idle(page);
  await page.click('#mHome');
  await idle(page);
  await page.click('#mSections');
  await idle(page);
  await letterGuide(page);
  await answerAsks(page);
  assert.ok(await picNear(page, 708), 'the Letter page in the Plan: ' + (await picH(page)));
  await page.click('#sfColor');
  await idle(page);
  assert.ok(await firstRowShows(page), 'the Letter page: the first marker row above the bar');
  assert.deepEqual(errors, []);
});

test('Home: How it works under the cards on a wide screen until the first guide is made; not on a phone. Owned says no "Your collection."', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await welcome(page, 'look');
  await idle(page);
  await page.click('#mHome');
  await idle(page);
  assert.ok(await page.isVisible('#homeHow'), 'a new user');
  assert.deepEqual(await page.$$eval('#homeHow b', (a) => a.map((b) => b.textContent)), [
    'Photograph a page',
    'Get your guide',
    'Colour along',
  ]);
  await page.setViewportSize({ width: 390, height: 844 });
  await idle(page);
  assert.equal(await page.isVisible('#homeHow'), false, 'a phone');
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.click('#mCollection');
  await idle(page);
  assert.equal(await page.isVisible('#ownHint'), false, 'Owned: no line saying what the switch says');
  await page.click('#ownView [data-v="unowned"]');
  await idle(page);
  assert.ok(await page.isVisible('#ownHint'), 'Unowned keeps its line');
  await page.click('#mSections');
  await idle(page);
  await letterGuide(page);
  await answerAsks(page);
  await page.click('#mHome');
  await idle(page);
  assert.equal(await page.isVisible('#homeHow'), false, 'with a guide made');
  assert.deepEqual(errors, []);
});

test('a chosen option in the picked tint, not done’s green: Codes, a Plan choice and a segment alike', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await idle(page);
  const bg = (sel) => page.$eval(sel, (e) => getComputedStyle(e).backgroundColor);
  const pick = await page.evaluate(() => {
    const d = document.createElement('div');
    d.style.background = 'var(--pick-bg)';
    document.body.appendChild(d);
    const c = getComputedStyle(d).backgroundColor;
    d.remove();
    return c;
  });
  assert.match(pick, /rgba\(120, 200, 180, 0\.22\)/);
  assert.equal(await page.getAttribute('#sfCodes', 'aria-pressed'), 'true');
  assert.equal(await bg('#sfCodes'), pick, 'Codes');
  assert.equal(await bg('#sfCtl .sfedit.on'), pick, 'a Plan choice');
  assert.deepEqual(errors, []);
});
