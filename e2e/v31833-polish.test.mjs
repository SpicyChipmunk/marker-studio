// v318.33 Stage 2 polish (docs/PLAN-v31832.md, Fable V1): Markers' one tools row, the guide's underline tabs (still
// pinned), the backdrop behind a sheet, the Library's empty state and the guide's name in the app's serif.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, sampleGuide, sectionPoint, idle, welcome } from './helpers.mjs';

before(setup);
after(teardown);

const rect = (page, sel) =>
  page.evaluate((s) => {
    const e = document.querySelector(s);
    return e ? e.getBoundingClientRect().toJSON() : null;
  }, sel);
// a small collection, as e2e/markers.test.mjs seeds it
const KEY = 'ohuhu-hb320-picker-v3';
const OWN = [
  'Ohuhu|R014',
  'Ohuhu|Y111',
  'Ohuhu|B08',
  'Ohuhu|G36',
  'Ohuhu|BV310',
  'Ohuhu|YR313',
  'Ohuhu|RV08',
  'Ohuhu|BG311',
];
const appState = (extra = {}) =>
  JSON.stringify({
    mode: 'home',
    ownedSeedV: 2,
    copicAdd1: 1,
    libAdj1: 1,
    setFix1: 1,
    owned: OWN,
    saved: [],
    ...extra,
  });
const onboardedV265 = (extra = {}) => ({
  'ms-onboarded': '1',
  'ms-setup-tip': '1',
  'ms-last-ver': 'v265',
  ...extra,
});
const style = (page, sel, props) =>
  page.evaluate(
    ([s, ps]) => {
      const cs = getComputedStyle(document.querySelector(s));
      return Object.fromEntries(ps.map((p) => [p, cs[p]]));
    },
    [sel, props],
  );

test('Markers: Random, Match a colour, Add markers and Swatch chart are one row of matching buttons; Filters sits 8px under Order', async () => {
  const { page, errors } = await openApp({
    storage: onboardedV265({ [KEY]: appState({ collView: 'all' }) }),
  });
  await page.click('#mCollection');
  await idle(page);
  assert.deepEqual(await page.$$eval('#mkDraw > button', (b) => b.map((x) => x.id)), [
    'mkDrawBtn',
    'mkMatchBtn',
    'mkAddBtn',
    'mkJump',
  ]);
  assert.equal((await page.textContent('#mkJump')).trim(), 'Swatch chart');
  assert.ok(await page.$('#mkJump svg.ic'), 'an icon like its neighbours, not an arrow');
  const looks = await page.$$eval('#mkDraw > button', (b) =>
    b.map((x) => {
      const cs = getComputedStyle(x);
      return [
        cs.borderTopWidth,
        cs.borderTopLeftRadius,
        cs.backgroundColor,
        cs.fontSize,
        cs.fontWeight,
        cs.textDecorationLine,
        Math.round(x.getBoundingClientRect().height),
      ].join('|');
    }),
  );
  assert.equal(new Set(looks).size, 1, 'one look: ' + looks.join(' / '));
  assert.match(looks[0], /^1px\|12px\|.*\|13px\|600\|none\|44$/);
  // the row wraps on a phone: two and two, the second pair under the first
  const r = await rect(page, '#mkDrawBtn'),
    a = await rect(page, '#mkAddBtn'),
    j = await rect(page, '#mkJump');
  assert.ok(
    a.top > r.bottom && Math.abs(a.top - j.top) < 0.5,
    'Add markers and Swatch chart on the second line',
  );
  // Filters' top margin 8px (22 before); Order is between the row and Filters
  assert.equal((await style(page, '#filterBar', ['marginTop'])).marginTop, '8px');
  const o = await rect(page, '#gapWrap'),
    f = await rect(page, '#filterBar');
  assert.ok(o.top > a.bottom && f.top > o.bottom, 'row, Order, Filters');
  const first = await page.$eval('#results .cell', (c) => c.getBoundingClientRect().top);
  // (about 740 before: Add markers and the link each on a line of their own, then the 40px gap)
  assert.ok(first < 700, 'the first swatch higher on the first screen: ' + first);
  // the jump still goes down to the swatch chart
  await page.click('#mkJump');
  await page.waitForFunction(
    () => {
      const r = document.getElementById('swatchBtn').getBoundingClientRect();
      return r.top >= 0 && r.bottom <= innerHeight;
    },
    null,
    { timeout: 5000 },
  );
  assert.deepEqual(errors, []);
});

test('Guide: the inner tabs are underline tabs (no track; a baseline; a 2px underline on the open one) and still pin', async () => {
  const { page, errors } = await openApp({ touch: true });
  await sampleGuide(page);
  const tabs = await style(page, '.sftabs', [
    'padding',
    'borderTopWidth',
    'borderBottomWidth',
    'borderTopLeftRadius',
    'backgroundColor',
  ]);
  assert.equal(tabs.padding, '0px');
  assert.equal(tabs.borderTopWidth, '0px');
  assert.equal(tabs.borderBottomWidth, '1px');
  assert.equal(tabs.borderTopLeftRadius, '0px');
  assert.notEqual(
    tabs.backgroundColor,
    'rgba(0, 0, 0, 0)',
    'a flat colour, so the controls never show through the pinned tabs',
  );
  const on = await style(page, '.sftabbtn.on', ['backgroundColor', 'boxShadow', 'borderTopLeftRadius']);
  assert.equal(on.backgroundColor, 'rgba(0, 0, 0, 0)', 'no white pill');
  assert.match(on.boxShadow, /inset/);
  assert.equal(on.borderTopLeftRadius, '0px');
  const off = await style(page, '.sftabbtn:not(.on)', ['boxShadow', 'backgroundColor']);
  assert.equal(off.boxShadow, 'none');
  assert.equal(off.backgroundColor, 'rgba(0, 0, 0, 0)');
  assert.ok((await rect(page, '.sftabbtn')).height >= 44, 'a finger-sized tab');
  // the pin: scrolled well past them, the tabs sit at their sticky top (the pinned picture's foot)
  await page.evaluate(() => window.scrollTo(0, 600));
  await page.waitForFunction(
    () => {
      const t = document.querySelector('.sftabs');
      return Math.abs(t.getBoundingClientRect().top - parseFloat(getComputedStyle(t).top)) < 1;
    },
    null,
    { timeout: 5000 },
  );
  const t = await rect(page, '.sftabs'),
    pin = await page.evaluate(() =>
      parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--pinH')),
    );
  assert.ok(Math.abs(t.top - pin) < 1, `pinned at --pinH ${pin}: ${t.top}`);
  assert.deepEqual(errors, []);
});

// (v318.37, X4-1: the menu's dim takes the tap and closes the menu, e2e/v31837-shell; only a picker's lets taps through)
test('Guide: a dim backdrop behind a sheet, in the guide’s own stacking context; a picker’s takes no taps', async () => {
  const { page, errors } = await openApp({ touch: true });
  await sampleGuide(page);
  await page.click('#sfMore');
  await page.waitForSelector('#sfSheet .sfmitem');
  await idle(page);
  const sc = await page.evaluate(() => {
    const s = document.querySelector('#sfRoot .sfscrim'),
      cs = getComputedStyle(s);
    return {
      parent: s.parentElement.id,
      next: s.nextElementSibling && s.nextElementSibling.id,
      bg: cs.backgroundColor,
      pe: cs.pointerEvents,
      pos: cs.position,
      z: +cs.zIndex,
      zs: +getComputedStyle(document.getElementById('sfSheet')).zIndex,
      w: s.getBoundingClientRect().width,
      h: s.getBoundingClientRect().height,
      hidden: s.getAttribute('aria-hidden'),
    };
  });
  assert.equal(sc.parent, 'sfRoot');
  assert.equal(sc.next, 'sfSheet', 'just under the sheet');
  assert.equal(sc.bg, 'rgba(0, 0, 0, 0.5)');
  assert.equal(sc.pe, 'auto', 'v318.37: the menu’s dim takes the tap');
  assert.equal(sc.pos, 'fixed');
  assert.ok(sc.z < sc.zs, 'under the sheet');
  assert.deepEqual([sc.w, sc.h, sc.hidden], [390, 844, 'true']);
  await page.keyboard.press('Escape');
  await idle(page);
  assert.equal(await page.$('#sfRoot .sfscrim'), null, 'gone with the sheet');
  // the picture stays in use under it: a tap on another section moves the picker (one backdrop, not two)
  const shown = (not) =>
    page.evaluate((not) => {
      const t = __mstest,
        c = document.getElementById('sfCanvas'),
        r = c.getBoundingClientRect(),
        sh = document.getElementById('sfSheet'),
        k = r.width / c.width;
      const bot = Math.min(r.bottom, innerHeight, sh ? sh.getBoundingClientRect().top : 1e9),
        top = Math.max(r.top, 0);
      return t.assignData.order.find(
        (l) =>
          l !== not &&
          (() => {
            const q = t.labelPos(l),
              x = r.left + q.x * k,
              y = r.top + q.y * k;
            return y > top + 12 && y < bot - 12 && x > r.left + 12 && x < r.right - 12 && q.r * k > 5;
          })(),
      );
    }, not);
  const l1 = await shown(0);
  let p = await sectionPoint(page, l1);
  await page.mouse.click(p.x, p.y);
  await idle(page);
  await page.click('.sftip [data-a="change"]');
  await page.waitForSelector('#sfSheet.sfpicksh');
  await idle(page);
  assert.equal(await page.$$eval('#sfRoot .sfscrim', (s) => s.length), 1);
  assert.equal(
    await page.$eval('#sfRoot .sfscrim', (s) => getComputedStyle(s).pointerEvents),
    'none',
    'a picker’s dim lets the tap through',
  );
  const l2 = await shown(l1);
  p = await sectionPoint(page, l2);
  await page.mouse.click(p.x, p.y);
  await idle(page);
  assert.ok(await page.$('#sfSheet.sfpicksh'), 'the picker moved, still open');
  assert.equal(await page.$$eval('#sfRoot .sfscrim', (s) => s.length), 1, 'still one backdrop');
  await page.click('#sfPopCancel');
  await idle(page);
  assert.equal(await page.$('#sfRoot .sfscrim'), null);
  assert.deepEqual(errors, []);
});

test('Guide: the name is in Fraunces at --t-xl, like every other screen title', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  const t = await style(page, '#sfGTitle', ['fontFamily', 'fontSize', 'fontWeight']);
  assert.match(t.fontFamily, /^"?Fraunces/);
  assert.equal(
    t.fontSize,
    await page.evaluate(() => getComputedStyle(document.querySelector('.title')).fontSize),
  );
  assert.equal(t.fontWeight, '500');
  assert.deepEqual(errors, []);
});

test('Library, empty: the icon in a tinted ring, then the words, then Try the sample', async () => {
  const { page, errors } = await openApp();
  await welcome(page, 'look');
  await idle(page);
  await page.click('#mHome');
  await page.click('#homeLibCard');
  await page.waitForSelector('#savedList .emptyhow');
  await idle(page);
  assert.deepEqual(
    await page.$$eval('#savedList .emptyhow > *', (c) => c.map((x) => x.className.split(' ')[0] || x.id)),
    ['emptyring', 'empty', 'btn-soft'],
  );
  const ring = await rect(page, '#savedList .emptyring'),
    text = await rect(page, '#savedList .empty'),
    btn = await rect(page, '#libTrySample');
  assert.deepEqual([Math.round(ring.width), Math.round(ring.height)], [72, 72]);
  assert.equal(
    (await style(page, '#savedList .emptyring', ['borderTopLeftRadius'])).borderTopLeftRadius,
    '50%',
  );
  assert.ok(ring.bottom <= text.top && text.bottom <= btn.top, 'ring, words, button, top to bottom');
  assert.ok(Math.abs(ring.left + ring.width / 2 - (btn.left + btn.width / 2)) < 1, 'centred');
  assert.equal(
    await page.textContent('#savedList .empty'),
    'Nothing yet. A guide saves itself here once it’s built; a palette is kept with Save.',
  );
  assert.deepEqual(errors, []);
});
