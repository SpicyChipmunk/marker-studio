// v319 (Fable Y4-1): a touch tap on a sheet's dim closes the sheet and nothing else. A touch's click is synthesized
// after its up and hit-tested afresh: with the dim gone at the up and the page scrolled back as the sheet closed, it
// landed on what had moved under the finger (the ⋯ menu opens with the page at the top, so the nav tabs: a tap on
// its dim switched to Markers). Now the up's click is stopped on the dim, which stays, unseen, until a click lands on
// it (a mouse) or 350 ms after the up (scrimDown, 72-frame.js). Each test fails on v318.37.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, sampleGuide, sectionPoint, idle, openMenu } from './helpers.mjs';

before(setup);
after(teardown);

const sheetState = (page) =>
  page.evaluate(() => ({
    mode: state.mode,
    sheet: !!document.getElementById('sfSheet'),
    scrims: document.querySelectorAll('#sfRoot .sfscrim').length,
    tip: !!document.querySelector('.sftip'),
    on: document.documentElement.classList.contains('sfsheeton'),
    layers: [...document.querySelectorAll('.overlay.on')].map((o) => o.id),
    // every click that reached the document since the tally was set (the dim's own don't count)
    clicks: (window.__clicks || []).filter((c) => !/sfscrim/.test(c)),
  }));
// a tally of clicks, by target, from here on
const tally = (page) =>
  page.evaluate(() => {
    window.__clicks = [];
    if (!window.__clicksOn) {
      window.__clicksOn = true;
      document.addEventListener(
        'click',
        (e) => {
          const t = e.target;
          window.__clicks.push(t.id || t.className || t.tagName);
        },
        true,
      );
    }
  });
// a point on the dim outside the sheet: above it in portrait, beside it on an iPad sideways
const dimPoint = (page) =>
  page.evaluate(() => {
    const sc = document.querySelector('#sfRoot .sfscrim').getBoundingClientRect(),
      sh = document.getElementById('sfSheet').getBoundingClientRect();
    return sh.left > 20
      ? { x: sh.left / 2, y: sc.top + sc.height / 2 }
      : { x: sc.left + sc.width / 2, y: Math.max(4, Math.min(sh.top, innerHeight) / 2) };
  });
// a section's label point on screen in the picture's visible part (the picture is unpinned by then)
const shownSec = (page) =>
  page.evaluate(() => {
    const t = __mstest,
      c = document.getElementById('sfCanvas'),
      r = c.getBoundingClientRect(),
      k = r.width / c.width,
      bot = Math.min(r.bottom, innerHeight),
      top = Math.max(r.top, 0);
    return t.assignData.order.find((l) => {
      const q = t.labelPos(l),
        x = r.left + q.x * k,
        y = r.top + q.y * k;
      return y > top + 12 && y < bot - 12 && x > r.left + 12 && x < r.right - 12 && q.r * k > 5;
    });
  });
const closed = (st, what) =>
  assert.deepEqual(
    [st.mode, st.sheet, st.scrims, st.tip, st.on, st.layers, st.clicks],
    ['sections', false, 0, false, false, [], []],
    what + ': ' + JSON.stringify(st),
  );

// the sheets that have a dim that takes taps (a picker's lets them through: e2e/v31837-shell), each opened its own way
const SHEETS = {
  menu: async (page) => {
    await page.evaluate(() => scrollTo(0, 0));
    await idle(page);
    await openMenu(page);
  },
  Print: async (page) => {
    await page.click('.sftabbtn[data-t="share"]');
    await idle(page);
    await page.click('#sfPrint');
    await page.waitForSelector('#sfSheet.sfprsh');
  },
  'markers on this page': async (page) => {
    await page.click('.sftabbtn[data-t="colours"]');
    await idle(page);
    await page.click('#sfMkList');
    await page.waitForSelector('#sfSheet');
  },
  Balance: async (page) => {
    await page.click('.sftabbtn[data-t="pattern"]');
    await idle(page);
    await page.click('#sfFam [data-v="random"]');
    await idle(page);
    await page.click('#sfBalM');
    await page.waitForSelector('#sfSheet.sfbalsh');
  },
};

for (const [name, vp] of [
  ['phone', { width: 390, height: 844 }],
  ['iPad', { width: 820, height: 1180 }],
  ['iPad sideways', { width: 1180, height: 820 }],
]) {
  test(`Guide (${name}, touch): a tap on the dim of the ⋯ menu, Print, the markers on this page and Balance closes the sheet and clicks nothing else`, async () => {
    const { page, errors } = await openApp({ ...vp, touch: true });
    await sampleGuide(page);
    for (const k in SHEETS) {
      await SHEETS[k](page);
      await idle(page);
      assert.ok(await page.$('#sfRoot .sfscrim.sfscrimtap'), k + ': a dim that takes taps');
      const p = await dimPoint(page);
      const under = await page.evaluate((p) => {
        const e = document.elementFromPoint(p.x, p.y);
        return e ? e.className : '';
      }, p);
      assert.match(under, /sfscrim/, k + ': the dim is at the point tapped');
      await tally(page);
      await page.touchscreen.tap(p.x, p.y);
      await idle(page);
      await page.waitForTimeout(400);
      closed(await sheetState(page), k + ' tapped shut');
    }
    assert.deepEqual(errors, []);
  });
}

test('Guide (phone, touch): a tap on the menu’s dim where the Markers tab will be after it closes stays in the guide; a second tap on the dim’s area within 350 ms is swallowed, one after it opens a section’s tip', async () => {
  const { page, errors } = await openApp({ width: 390, height: 844, touch: true });
  await sampleGuide(page);
  await page.evaluate(() => scrollTo(0, 0));
  await idle(page);
  // where the Markers tab is with the page at the top (where it goes back to when the menu closes)
  const p = await page.evaluate(() => {
    const r = document.getElementById('mCollection').getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  await openMenu(page);
  await idle(page);
  const under = await page.evaluate((p) => {
    const e = document.elementFromPoint(p.x, p.y);
    return { el: e && e.className, y: scrollY };
  }, p);
  assert.ok(
    /sfscrim/.test(under.el) && under.y > 0,
    'the dim covers that point while the menu is open: ' + JSON.stringify(under),
  );
  await tally(page);
  await page.touchscreen.tap(p.x, p.y);
  await idle(page);
  await page.waitForTimeout(400);
  closed(await sheetState(page), 'the menu tapped shut over the Markers tab');
  // a second tap right after the first, on the dim's area over the picture: swallowed while the dim lingers
  await openMenu(page);
  await idle(page);
  const l = await shownSec(page);
  assert.ok(l > 0, 'a section in view');
  const q0 = await dimPoint(page);
  await page.touchscreen.tap(q0.x, q0.y);
  await page.waitForTimeout(120);
  const q1 = await sectionPoint(page, l);
  await page.touchscreen.tap(q1.x, q1.y);
  await idle(page);
  await page.waitForTimeout(400);
  let st = await sheetState(page);
  assert.deepEqual(
    [st.sheet, st.scrims, st.tip, st.mode],
    [false, 0, false, 'sections'],
    'swallowed: ' + JSON.stringify(st),
  );
  // and one after the 350 ms reaches the picture: the section's tip opens
  const q2 = await sectionPoint(page, l);
  await page.touchscreen.tap(q2.x, q2.y);
  await idle(page);
  assert.ok(await page.$('.sftip [data-a="change"]'), 'a tap after the dim has gone opens the tip');
  assert.deepEqual(errors, []);
});

test('Guide (phone): a mouse click on the menu’s dim, and Escape, close it with the dim gone at once', async () => {
  const { page, errors } = await openApp({ width: 390, height: 844 });
  await sampleGuide(page);
  await page.evaluate(() => scrollTo(0, 0));
  await idle(page);
  await openMenu(page);
  await idle(page);
  const p = await dimPoint(page);
  await tally(page);
  await page.mouse.click(p.x, p.y);
  let st = await sheetState(page);
  assert.deepEqual(
    [st.sheet, st.scrims, st.on],
    [false, 0, false],
    'closed, the dim gone with the click: ' + JSON.stringify(st),
  );
  await idle(page);
  closed(await sheetState(page), 'mouse');
  await openMenu(page);
  await idle(page);
  await page.keyboard.press('Escape');
  st = await sheetState(page);
  assert.deepEqual([st.sheet, st.scrims, st.on], [false, 0, false], 'Escape: ' + JSON.stringify(st));
  assert.equal(await page.evaluate(() => document.activeElement.id), 'sfMore', 'focus back on ⋯');
  assert.deepEqual(errors, []);
});
