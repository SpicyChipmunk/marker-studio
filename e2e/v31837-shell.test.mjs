// v318.37, the shell (Fable X4): a tap on a sheet's dim closes the sheet and does nothing else (X4-1; a picker's dim
// still lets taps through to the picture); Home's "Updated to … · What's new" lists every version since the one last
// seen (X4-2); 44px tap areas on the checkbox rows, Colour along's More, the Library's search and Sort and the guide's
// selects (X4-3); Home's three cards aligned at 320px (X4-4).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  setup,
  teardown,
  openApp,
  openAtScale,
  sampleGuide,
  sectionPoint,
  idle,
  openMenu,
} from './helpers.mjs';

before(setup);
after(teardown);

const ONB = { 'ms-onboarded': '1', 'ms-setup-tip': '1' };
const rect = (page, sel) =>
  page.evaluate((s) => {
    const r = document.querySelector(s).getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height, r: r.right, b: r.bottom };
  }, sel);
// a section's label point on screen, in the picture's visible part above the sheet (not the one given)
const shownSec = (page, not) =>
  page.evaluate((not) => {
    const t = __mstest,
      c = document.getElementById('sfCanvas'),
      r = c.getBoundingClientRect(),
      sh = document.getElementById('sfSheet'),
      side = sh && sh.classList.contains('sfshside'),
      k = r.width / c.width;
    // (the sheet under the picture in portrait, beside it on an iPad sideways)
    const bot = Math.min(r.bottom, innerHeight, sh && !side ? sh.getBoundingClientRect().top : 1e9),
      right = Math.min(r.right, innerWidth, sh && side ? sh.getBoundingClientRect().left : 1e9),
      top = Math.max(r.top, 0);
    return t.assignData.order.find((l) => {
      if (l === not) return false;
      const q = t.labelPos(l),
        x = r.left + q.x * k,
        y = r.top + q.y * k;
      return y > top + 12 && y < bot - 12 && x > r.left + 12 && x < right - 12 && q.r * k > 5;
    });
  }, not);
const sheetState = (page) =>
  page.evaluate(() => ({
    sheet: !!document.getElementById('sfSheet'),
    scrims: document.querySelectorAll('#sfRoot .sfscrim').length,
    pe: (() => {
      const s = document.querySelector('#sfRoot .sfscrim');
      return s ? getComputedStyle(s).pointerEvents : null;
    })(),
    tip: !!document.querySelector('.sftip'),
    on: document.documentElement.classList.contains('sfsheeton'),
  }));

for (const [name, vp] of [
  ['phone', { width: 390, height: 844 }],
  ['iPad sideways', { width: 1180, height: 820 }],
]) {
  test(`Guide (${name}): a tap on the ⋯ menu's dim closes the menu and nothing else; a picker's dim lets the tap through to the picture`, async () => {
    const { page, errors } = await openApp({ ...vp, touch: true });
    await sampleGuide(page);
    await openMenu(page);
    await idle(page);
    let st = await sheetState(page);
    assert.equal(st.pe, 'auto', 'the menu’s dim takes the tap');
    // a tap on a section under the dim: the menu closes, and no tip opens for the section (X4-1: it opened bright
    // over the dim with the menu still open)
    const l1 = await shownSec(page, 0);
    assert.ok(l1 > 0, 'a section shows above the sheet');
    let p = await sectionPoint(page, l1);
    await page.touchscreen.tap(p.x, p.y);
    await idle(page);
    st = await sheetState(page);
    assert.deepEqual([st.sheet, st.scrims, st.tip, st.on], [false, 0, false, false], JSON.stringify(st));
    // the picture still takes taps afterwards: the same section's tip opens (its point found again: the page scrolled
    // back and the picture unpinned as the sheet closed)
    p = await sectionPoint(page, l1);
    await page.touchscreen.tap(p.x, p.y);
    await idle(page);
    assert.ok(await page.$('.sftip [data-a="change"]'), 'a tap after it opens the tip as ever');
    // the picker's dim: a tap on another section moves the picker, which stays open
    await page.click('.sftip [data-a="change"]');
    await page.waitForSelector('#sfSheet.sfpicksh');
    await idle(page);
    st = await sheetState(page);
    assert.equal(st.pe, 'none', 'a picker’s dim lets taps through');
    const l2 = await shownSec(page, l1);
    p = await sectionPoint(page, l2);
    await page.touchscreen.tap(p.x, p.y);
    await idle(page);
    assert.ok(await page.$('#sfSheet.sfpicksh'), 'the picker moved, still open');
    assert.equal((await sheetState(page)).scrims, 1, 'one backdrop');
    await page.click('#sfPopCancel');
    await idle(page);
    assert.equal((await sheetState(page)).scrims, 0);
    // Escape still closes the menu, and a tap on the dim closes the Print sheet too (every sheet but a picker's)
    await openMenu(page);
    await page.keyboard.press('Escape');
    await idle(page);
    assert.equal(await page.$('#sfSheet'), null, 'Escape closes it');
    await page.click('.sftabbtn[data-t="share"]');
    await idle(page);
    await page.click('#sfPrint');
    await page.waitForSelector('#sfSheet.sfprsh');
    await idle(page);
    assert.equal((await sheetState(page)).pe, 'auto', 'Print’s dim takes the tap');
    const sc = await rect(page, '#sfRoot .sfscrim'),
      sh = await rect(page, '#sfSheet');
    // a point on the dim outside the sheet (above it in portrait, beside it on the iPad)
    const q =
      sh.x > 20 ? { x: sh.x / 2, y: sc.y + sc.h / 2 } : { x: sc.x + sc.w / 2, y: Math.max(4, sh.y / 2) };
    await page.touchscreen.tap(q.x, q.y);
    await idle(page);
    st = await sheetState(page);
    assert.deepEqual(
      [st.sheet, st.scrims, st.on],
      [false, 0, false],
      'Print closed by its dim: ' + JSON.stringify(st),
    );
    assert.deepEqual(errors, []);
  });
}

test('Home: "Updated to … · What’s new" opens Help › What’s new with every version since the one last seen (newest first, up to 8); Help by itself shows this version’s', async () => {
  const { ctx, page, errors } = await openApp({ storage: { ...ONB, 'ms-last-ver': 'v318.30' } });
  await ctx.addInitScript(() => {
    window.__MS_HELP_AUTO = true;
  });
  await page.reload();
  await idle(page);
  const ver = (await page.textContent('#appVer')).trim();
  const num = (v) => {
    const m = /^v?(\d+)(?:\.(\d+))?/.exec(v);
    return m ? +m[1] + (+m[2] || 0) / 1000 : 0;
  };
  // (WHATS_NEW is the page's; the version numbers compared here)
  const list = await page.evaluate(() => WHATS_NEW.map((x) => ({ v: x.v, t: x.t })));
  const since = list.filter((x) => num(x.v) > num('v318.30') && num(x.v) <= num(ver)).slice(0, 8);
  assert.ok(since.length >= 2, 'several versions since v318.30: ' + since.length);
  assert.ok(await page.isVisible('#whatsNew'));
  await page.click('#wnOpen');
  await page.waitForSelector('#helpOverlay.on');
  assert.ok(await page.evaluate(() => document.getElementById('helpNews').open), 'Help opens at What’s new');
  assert.equal((await page.textContent('#helpNews .hlpwnt')).trim(), 'What’s new since v318.30');
  let items = await page.$$eval('#helpWnList li', (l) => l.map((x) => x.textContent));
  assert.deepEqual(
    items,
    since.map((x) => x.v + ' ' + x.t),
    'each version since, newest first, headed with its version',
  );
  assert.equal(await page.$eval('#helpWnList li b', (b) => b.textContent), since[0].v);
  assert.equal(await page.evaluate(() => localStorage.getItem('ms-last-ver')), ver, 'this version seen');
  assert.equal(await page.$('#whatsNew'), null, 'the line is gone');
  // Help opened by itself: this version's, as before
  await page.click('#helpClose');
  await idle(page);
  await page.click('#homeHelp');
  await page.waitForSelector('#helpOverlay.on');
  assert.equal((await page.textContent('#helpNews .hlpwnt')).trim(), `What’s new in ${ver}`);
  items = await page.$$eval('#helpWnList li', (l) => l.map((x) => x.textContent));
  assert.deepEqual(
    items,
    list.filter((x) => x.v === ver).map((x) => x.t),
  );
  assert.equal(await page.$('#helpWnList li b'), null, 'no version heads on one version’s');
  await page.click('#helpClose');
  await idle(page);
  // from much older: at most eight, newest first; the guide's ⋯ › Help (openHelpSheet) shows this version's
  await page.evaluate(() => localStorage.setItem('ms-last-ver', 'v200'));
  await page.reload();
  await idle(page);
  await page.click('#wnOpen');
  await page.waitForSelector('#helpOverlay.on');
  items = await page.$$eval('#helpWnList li', (l) => l.map((x) => x.textContent));
  assert.equal(items.length, Math.min(8, list.filter((x) => num(x.v) <= num(ver)).length));
  assert.equal(
    items[0],
    list.find((x) => num(x.v) <= num(ver)).v + ' ' + list.find((x) => num(x.v) <= num(ver)).t,
  );
  assert.equal((await page.textContent('#helpNews .hlpwnt')).trim(), 'What’s new since v200');
  await page.click('#helpClose');
  await idle(page);
  // a fresh install: no line (the version is just recorded)
  const fresh = await openApp({ storage: null });
  await fresh.ctx.addInitScript(() => {
    window.__MS_HELP_AUTO = true;
  });
  await fresh.page.reload();
  await idle(fresh.page);
  assert.equal(await fresh.page.$('#whatsNew'), null, 'nothing on a first install');
  assert.equal(await fresh.page.evaluate(() => localStorage.getItem('ms-last-ver')), ver);
  await fresh.ctx.close();
  assert.deepEqual(errors, []);
});

// the tap area a control answers to: its box, plus the strips an absolutely placed ::before (above) and ::after
// (below) add to it
const tapBox = (page, sel) =>
  page.evaluate((s) => {
    const el = document.querySelector(s),
      r = el.getBoundingClientRect();
    let h = r.height;
    for (const ps of ['::before', '::after']) {
      const cs = getComputedStyle(el, ps);
      if (cs.content !== 'none' && cs.position === 'absolute') h += parseFloat(cs.height) || 0;
    }
    return { w: Math.round(r.width), h: Math.round(h), box: Math.round(r.height) };
  }, sel);

test('320px phone: 44px tap areas on the checkbox rows, Colour along’s More, the Library’s search and Sort and Shading’s selects; the rows look the same', async () => {
  const { page, errors } = await openApp({ width: 320, height: 568, touch: true });
  await sampleGuide(page);
  await page.click('.sftabbtn[data-t="shading"]');
  await page.evaluate(() => __mstest.shadeTo('full'));
  await idle(page);
  let t = await tapBox(page, 'label.sfchk');
  assert.ok(t.h >= 44 && t.box < 40, 'Show tone lines: a 44px area round a short row: ' + JSON.stringify(t));
  for (const s of ['#sfHiStyle', '#sfShStyle']) {
    t = await tapBox(page, s);
    assert.ok(t.box >= 44, s + ' is 44px tall: ' + JSON.stringify(t));
  }
  await page.click('.sftabbtn[data-t="pattern"]');
  await idle(page);
  await page.click('#sfFam [data-v="random"]');
  await idle(page);
  t = await tapBox(page, 'label.sfchk:has(#sfNoAdj)');
  assert.ok(t.h >= 44 && t.box < 40, 'Keep touching sections clearly different: ' + JSON.stringify(t));
  await page.click('.sftabbtn[data-t="share"]');
  await idle(page);
  await page.click('#sfPrint');
  await page.waitForSelector('#sfSheet.sfprsh');
  await idle(page);
  t = await tapBox(page, '#sfSheet label.sfchk');
  assert.ok(t.h >= 44 && t.box < 40, 'Print’s Darker labels: ' + JSON.stringify(t));
  // a tap on the grown area, just under the last row's words (the rows above run into each other), ticks its box
  const last = await page.evaluate(() => {
    const l = [...document.querySelectorAll('#sfSheet label.sfchk')].pop();
    l.scrollIntoView({ block: 'center' });
    const r = l.getBoundingClientRect(),
      i = l.querySelector('input');
    return { id: i.id, was: i.checked, x: r.left + r.width / 2, y: r.bottom + 5 };
  });
  await page.touchscreen.tap(last.x, last.y);
  await idle(page);
  assert.equal(
    await page.evaluate((id) => document.getElementById(id).checked, last.id),
    !last.was,
    'ticked from 5px under the row: ' + JSON.stringify(last),
  );
  await page.keyboard.press('Escape');
  await idle(page);
  await page.click('.sftabbtn[data-t="colours"]');
  await idle(page);
  await page.click('#sfColor');
  await idle(page);
  await page.waitForSelector('#sfAlMore', { state: 'visible' });
  t = await tapBox(page, '#sfAlMore');
  assert.ok(t.h >= 44 && t.box < 40, 'Colour along’s More: ' + JSON.stringify(t));
  await page.evaluate(() => document.getElementById('mHome').click());
  await idle(page);
  await page.click('#homeLibCard');
  await page.waitForSelector('#savedOverlay.on');
  await idle(page);
  for (const s of ['#libSearch', '#libSort']) {
    t = await tapBox(page, s);
    assert.ok(t.box >= 44, s + ' is 44px tall: ' + JSON.stringify(t));
  }
  assert.deepEqual(errors, []);
});

test('Home at 320px: the three cards’ icons and names line up at the top, Library’s with the two whose lines wrap', async () => {
  const { page, errors } = await openAtScale(1, { width: 320, height: 568, touch: true, storage: ONB });
  const tops = await page.evaluate(() =>
    [...document.querySelectorAll('#homeView .homegrid .homecard')].map((c) => ({
      icon: Math.round(c.querySelector('.hcicon').getBoundingClientRect().top),
      label: Math.round(c.querySelector('.hclabel').getBoundingClientRect().top),
      subLines: Math.round(c.querySelector('.hcsub').getBoundingClientRect().height / 15),
    })),
  );
  assert.equal(tops.length, 3);
  assert.ok(
    tops.every((t) => Math.abs(t.icon - tops[0].icon) <= 1 && Math.abs(t.label - tops[0].label) <= 1),
    'aligned: ' + JSON.stringify(tops),
  );
  assert.ok(
    Math.max(...tops.map((t) => t.subLines)) > Math.min(...tops.map((t) => t.subLines)),
    'a line wraps at 320: ' + JSON.stringify(tops),
  );
  assert.deepEqual(errors, []);
});
