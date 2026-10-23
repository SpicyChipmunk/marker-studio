// v318.33 (Y1): the design system and the shared controls. Tokens for space, heights and line heights in 01-base.css;
// one corner rule (--r-md every standalone control, --r-lg cards, tracks and sheets, --r-sm a segment in a track);
// --h-ctl 44 for buttons and fields, --h-seg 40 in a 3px track; one "chosen" look (the white pill marks the main menu
// only, a setting is a teal segment in a track, cards only with pictures); Palette's Harmony as a 3-column grid with
// its label above on a phone; Focus' Exit pill with the 44px tap area. Fails on v318.32.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, openAtScale, sampleGuide, welcome, idle } from './helpers.mjs';

before(setup);
after(teardown);

const css = (page, sel, prop, pseudo) =>
  page.evaluate(
    ([s, p, ps]) => getComputedStyle(document.querySelector(s), ps || null)[p],
    [sel, prop, pseudo],
  );
const height = (page, sel) => page.$eval(sel, (e) => Math.round(e.getBoundingClientRect().height));
const token = (page, name) =>
  page.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), name);

test('the tokens, heights and corners: a button is 12px-cornered and 44px, a segment 40px in a 16px track, the search 44px', async () => {
  const { page, errors } = await openApp();
  await welcome(page, 'look');
  await idle(page);
  for (const [n, v] of [
    ['--s3', '12px'],
    ['--s4', '16px'],
    ['--h-ctl', '44px'],
    ['--h-seg', '40px'],
    ['--h-sm', '36px'],
    ['--lh-tight', '1.2'],
    ['--lh', '1.45'],
  ])
    assert.equal(await token(page, n), v, n);
  await page.click('#mCollection');
  await idle(page);
  assert.equal(await css(page, '.search', 'borderRadius'), '12px', 'a field');
  assert.equal(await height(page, '.search'), 44, 'the search at --h-ctl');
  assert.equal(await height(page, '#gapSort'), 44, 'the Order drop-down at --h-ctl');
  assert.equal(await css(page, '#mkAddBtn', 'borderRadius'), '12px', 'the button default is --r-md');
  assert.equal(await css(page, '.modes', 'borderRadius'), '16px', 'the menu is a track');
  assert.equal(await height(page, '.modes button'), 40, 'a tab at --h-seg');
  assert.equal(await css(page, '.modes button.on', 'borderRadius'), '8px', 'the pill in the track at --r-sm');
  await page.click('#mPalette');
  await idle(page);
  assert.equal(await css(page, '#harm', 'borderRadius'), '16px', '.segs is a track');
  assert.equal(await css(page, '#segs button.on', 'borderRadius'), '8px');
  assert.equal(await height(page, '#segs button'), 40);
  assert.deepEqual(errors, []);
});

test('Harmony is a grid of three columns; on a phone its label sits above the grid, on an iPad beside it', async () => {
  const tops = (page) =>
    page.evaluate(() => {
      const t = (s) => Math.round(document.querySelector(s).getBoundingClientRect().top),
        l = (s) => Math.round(document.querySelector(s).getBoundingClientRect().left);
      return {
        row1: ['complementary', 'analogous', 'triadic'].map((h) => t(`#harm [data-h="${h}"]`)),
        row2: ['split', 'tetradic', 'mono'].map((h) => t(`#harm [data-h="${h}"]`)),
        // (v318.34: the three ramp schemes make a row of their own, so four rows)
        row3: ['shadow', 'accent', 'neutral'].map((h) => t(`#harm [data-h="${h}"]`)),
        row4: ['rainbow', 'custom', 'photo'].map((h) => t(`#harm [data-h="${h}"]`)),
        label: t('#harmLbl'),
        grid: t('#harm'),
        labelL: l('#harmLbl'),
        gridL: l('#harm'),
        cols: getComputedStyle(document.getElementById('harm')).gridTemplateColumns.split(' ').length,
      };
    });
  const phone = await openApp();
  await welcome(phone.page, 'look');
  await phone.page.click('#mPalette');
  await idle(phone.page);
  let r = await tops(phone.page);
  assert.equal(r.cols, 3, 'three columns');
  for (const k of ['row1', 'row2', 'row3', 'row4'])
    assert.ok(
      r[k].every((y) => y === r[k][0]),
      k + ' one row: ' + r[k],
    );
  assert.ok(r.row1[0] < r.row2[0] && r.row2[0] < r.row3[0] && r.row3[0] < r.row4[0], 'four rows');
  assert.ok(
    r.label < r.grid && Math.abs(r.labelL - r.gridL) < 4,
    'phone: the label above the grid, lined up ' + JSON.stringify(r),
  );
  assert.deepEqual(phone.errors, []);
  const ipad = await openApp({ width: 820, height: 1180, touch: true });
  await welcome(ipad.page, 'look');
  await ipad.page.click('#mPalette');
  await idle(ipad.page);
  r = await tops(ipad.page);
  assert.equal(r.cols, 3);
  assert.ok(r.labelL < r.gridL && r.label >= r.grid, 'iPad: the label beside the grid ' + JSON.stringify(r));
  assert.deepEqual(ipad.errors, []);
});

test('Larger text: the full harmony names wrap inside their cells, nothing runs past the track', async () => {
  const { page, errors } = await openAtScale(1.6, { width: 390, height: 844 });
  await welcome(page, 'look');
  await page.click('#mPalette');
  await idle(page);
  const fit = await page.evaluate(() => {
    const h = document.getElementById('harm').getBoundingClientRect();
    return [...document.querySelectorAll('#harm button')].map((b) => {
      const r = b.getBoundingClientRect();
      return {
        t: b.textContent,
        ok: r.right <= h.right + 1 && r.left >= h.left - 1 && b.scrollWidth <= b.clientWidth + 1,
      };
    });
  });
  assert.deepEqual(
    fit.filter((x) => !x.ok),
    [],
    JSON.stringify(fit),
  );
  // (v318.33) a one-word name is never broken mid-word: the grid goes to two columns before a third of the row is too
  // narrow for "Complementary" (as tall as Triadic, one line)
  const one = await page.evaluate(() =>
    ['complementary', 'mono', 'analogous', 'triadic'].map((h) => {
      const b = document.querySelector(`#harm [data-h="${h}"]`),
        r = document.createRange();
      r.selectNodeContents(b);
      return r.getClientRects().length;
    }),
  );
  assert.deepEqual(one, [1, 1, 1, 1], 'one line each: ' + one);
  assert.deepEqual(errors, []);
});

test('one chosen look: Colours from and Lean towards are teal segments in a track; Theme and Mood keep their cards', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, touch: true, moreShut: true });
  await sampleGuide(page);
  await idle(page);
  const pick = await page.evaluate(() => {
    const d = document.createElement('div');
    d.style.background = 'var(--pick-bg)';
    document.body.appendChild(d);
    const c = getComputedStyle(d).backgroundColor;
    d.remove();
    return c;
  });
  for (const id of ['sfSrc', 'sfPal']) {
    assert.equal(await css(page, '#' + id, 'borderRadius'), '16px', id + ' is a track');
    assert.notEqual(
      await css(page, '#' + id, 'backgroundColor'),
      'rgba(0, 0, 0, 0)',
      id + ' has the track fill',
    );
    assert.equal(await css(page, '#' + id + ' .sfedit.on', 'backgroundColor'), pick, id + ' chosen in teal');
    assert.equal(
      await css(page, '#' + id + ' .sfedit:not(.on)', 'backgroundColor'),
      'rgba(0, 0, 0, 0)',
      id + ' the others bare',
    );
    assert.equal(
      await css(page, '#' + id + ' .sfedit:not(.on)', 'borderTopColor'),
      'rgba(0, 0, 0, 0)',
      id + ' no card edges',
    );
    assert.equal(await height(page, '#' + id + ' .sfedit'), 40, id + ' segments at --h-seg');
    assert.ok(
      parseFloat(await css(page, '#' + id + ' .sfedit', 'height', '::after')) >= 44,
      id + ' 44px to tap',
    );
  }
  // the pictures keep their cards: Theme's strips, Mood's pictures
  assert.equal(await css(page, '#sfTheme', 'borderTopWidth'), '0px', 'Theme: no track');
  assert.notEqual(
    await css(page, '#sfTheme .sfedit:not(.on)', 'borderTopColor'),
    'rgba(0, 0, 0, 0)',
    'Theme cards keep their edges',
  );
  assert.ok(await page.$('.sfmoodpics .sfmp'), 'Mood pictures');
  // the white pill is the main menu's only
  assert.equal(await css(page, '.modes button.on', 'backgroundColor'), 'rgb(244, 242, 236)');
  await page.click('.sftabbtn[data-t="pattern"]');
  await idle(page);
  assert.equal(await css(page, '#sfFam', 'borderRadius'), '16px', 'Pattern family: a track');
  assert.equal(await css(page, '#sfShape', 'borderTopWidth'), '0px', 'Flow (pictures): no track');
  assert.deepEqual(errors, []);
});

test('Focus: the 40px Exit pill has the 44px tap area', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await page.click('#sfColor');
  await idle(page);
  await page.click('#sfFocus');
  await idle(page);
  const hit = await page.evaluate(() => {
    const b = document.getElementById('sfExitFoc'),
      r = b.getBoundingClientRect(),
      cx = r.left + r.width / 2,
      cy = r.top + r.height / 2,
      at = (y) => {
        const e = document.elementFromPoint(cx, y);
        return !!e && (e === b || b.contains(e));
      };
    return { h: Math.round(r.height), up: at(cy - 21), down: at(cy + 21) };
  });
  assert.equal(hit.h, 40);
  assert.ok(hit.up && hit.down, JSON.stringify(hit));
  assert.deepEqual(errors, []);
});
