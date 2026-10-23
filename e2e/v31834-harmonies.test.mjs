// v318.34 (FD): three harmonies on evenly stepped ramps. Palette's Harmony grid holds 12 (Light to shadow, Analogous
// + accent and Greys + accent after Monochrome, still 3 columns); Greys + accent is greyed with its reason below 3
// greys in play (a tap says why; Generate says it when it's the scheme); its note never says "greys"; the guide's
// select greys the option, and a guide whose greys drop below 3 falls back to Analogous + accent with a note.
// Fails on v318.33 (the three aren't there).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, welcome, sampleGuide, idle } from './helpers.mjs';

before(setup);
after(teardown);

const click = (page, sel) => page.evaluate((sel) => document.querySelector(sel).click(), sel);
const toastText = (page) =>
  page.evaluate(() => {
    const t = document.getElementById('msToast');
    return (t && t.classList.contains('on') && t.textContent) || '';
  });
const neutralBtn = (page) =>
  page.evaluate(() => {
    const b = document.querySelector('#harm [data-h="neutral"]');
    return { dis: b.getAttribute('aria-disabled'), title: b.title, opacity: getComputedStyle(b).opacity };
  });
const palette = (page) =>
  page.evaluate(() => {
    const p = state.palettes[state.palettes.length - 1] || [];
    return {
      n: p.length,
      greys: p.map((i) => LCH[i][1] < GREY_C),
      L: p.map((i) => Math.round(LCH[i][0])),
      note: document.getElementById('palClose').textContent,
      desc: document.getElementById('harmDesc').textContent,
      gen: document.getElementById('draw').textContent,
      genOff: document.getElementById('draw').disabled,
      h: state.harmony,
    };
  });

for (const dev of [
  { name: 'phone', w: 390, h: 844, touch: false },
  { name: 'iPad portrait', w: 820, h: 1180, touch: true },
]) {
  test(`Palette: the twelve harmonies in a 3-column grid; the three new ones make their palettes; Greys + accent greyed below 3 greys (${dev.name})`, async () => {
    const { page, errors } = await openApp({ width: dev.w, height: dev.h, touch: dev.touch });
    await welcome(page, 'look');
    await page.click('#mPalette');
    await idle(page);
    const grid = await page.evaluate(() => {
      const bs = [...document.querySelectorAll('#harm button')];
      const top = (b) => Math.round(b.getBoundingClientRect().top);
      return {
        order: bs.map((b) => b.dataset.h),
        rows: [...new Set(bs.map(top))].length,
        cols: getComputedStyle(document.getElementById('harm')).gridTemplateColumns.split(' ').length,
        wide: bs.every((b) => b.getBoundingClientRect().right <= document.getElementById('harm').getBoundingClientRect().right + 1),
        tall: bs.every((b) => b.getBoundingClientRect().height >= 36),
      };
    });
    assert.deepEqual(grid.order, [
      'complementary', 'analogous', 'triadic', 'split', 'tetradic', 'mono', 'shadow', 'accent', 'neutral', 'rainbow', 'custom', 'photo',
    ]);
    assert.equal(grid.cols, 3, 'three columns');
    assert.equal(grid.rows, 4, 'four rows of three');
    assert.ok(grid.wide && grid.tall, 'every name inside the track, rows at least 36 px: ' + JSON.stringify(grid));
    // Honolulu 120 (29 greys): the three make palettes; their sizes stop at 8
    await click(page, '#harm [data-h="shadow"]');
    await idle(page);
    let p = await palette(page);
    assert.equal(p.h, 'shadow');
    assert.ok(p.n >= 3 && p.n <= 8 && p.n === (await page.evaluate(() => state.palSize)), 'Light to shadow made: ' + p.n);
    assert.deepEqual(p.L, p.L.slice().sort((a, b) => b - a), 'light to dark: ' + p.L);
    assert.match(p.desc, /shadows/);
    assert.equal(
      await page.evaluate(() => [...document.querySelectorAll('#segs button')].filter((b) => !b.disabled).map((b) => +b.dataset.n).join(',')),
      '3,4,5,6,7,8',
    );
    await click(page, '#harm [data-h="accent"]');
    await idle(page);
    p = await palette(page);
    assert.equal(p.h, 'accent');
    assert.ok(p.n === (await page.evaluate(() => state.palSize)) && p.greys.every((g) => !g), 'Analogous + accent: clear colours');
    await click(page, '#harm [data-h="neutral"]');
    await idle(page);
    p = await palette(page);
    assert.equal(p.h, 'neutral');
    assert.equal(p.greys[0], false, 'the accent first');
    assert.ok(p.greys.slice(1).every((g) => g), 'then greys: ' + p.greys);
    assert.doesNotMatch(p.note, /greys/, 'its greys are not "Some colours are greys": ' + p.note);
    assert.equal((await neutralBtn(page)).dis, 'false');
    // the greys leave the markers in play (a selection of clear markers): the button greys with its reason, a tap
    // says why and changes nothing; chosen already, Generate says it
    await page.evaluate(() => {
      setPool(COLORS.map((c, i) => i).filter((i) => inPool(i) && LCH[i][1] >= GREY_C));
      setHarmony('complementary');
    });
    await idle(page);
    let nb = await neutralBtn(page);
    assert.equal(nb.dis, 'true');
    assert.equal(nb.title, 'Needs 3 greys among your markers');
    assert.ok(+nb.opacity < 0.5, 'greyed: ' + nb.opacity);
    // (a click from the page: Playwright's own click waits for aria-disabled to clear)
    await click(page, '#harm [data-h="neutral"]');
    await idle(page);
    assert.equal(await page.evaluate(() => state.harmony), 'complementary', 'the tap changes nothing');
    assert.equal(await toastText(page), 'Needs 3 greys among your markers');
    await page.evaluate(() => {
      state.harmony = 'neutral';
      chrome();
    });
    p = await palette(page);
    assert.equal(p.gen, 'Needs 3 greys among your markers');
    assert.equal(p.genOff, true);
    // the greys back: offered again
    await page.evaluate(() => {
      setPool(null);
      chrome();
    });
    nb = await neutralBtn(page);
    assert.equal(nb.dis, 'false');
    assert.equal(nb.title, '');
    assert.deepEqual(errors, []);
  });
}

test('the guide: the harmony select offers the three; Greys + accent greys its option and falls back to Analogous + accent with a note when the greys go', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await click(page, '#sfSrc [data-v="palette"]');
  await idle(page);
  const opts = await page.evaluate(() => [...document.querySelectorAll('#sfHarm option')].map((o) => o.value));
  assert.deepEqual(opts.filter((v) => v), [
    'complementary', 'analogous', 'triadic', 'split', 'tetradic', 'mono', 'shadow', 'accent', 'neutral', 'rainbow',
  ]);
  // (v319: Greys & black is off by default and greys Greys + accent (Y3-2): Expand shows the Include row, its chip on)
  await click(page, '#sfExpand');
  await idle(page);
  await click(page, '#sfIncl [data-v="greys"]');
  await idle(page);
  await page.selectOption('#sfHarm', 'neutral');
  await idle(page);
  let g = await page.evaluate(() => ({
    h: __mstest.genHarmony,
    pal: __mstest.genPal.map((k) => LCH[keyIdx(k)][1] < GREY_C),
    note: (document.getElementById('sfGenNote') || {}).textContent || '',
  }));
  assert.equal(g.h, 'neutral');
  assert.ok(g.pal.length >= 3 && !g.pal[0] && g.pal.slice(1).every((x) => x), 'a clear accent, then greys: ' + g.pal);
  assert.equal(g.note, '');
  // the greys leave the collection (a saved guide opened on a smaller collection): Shuffle makes a new palette
  await page.evaluate(() => {
    for (const k of [...state.owned]) if (LCH[keyIdx(k)][1] < GREY_C) state.owned.delete(k);
    save();
  });
  await click(page, '.sftabbtn[data-t="pattern"]');
  await idle(page);
  await click(page, '#sfVary');
  await idle(page);
  await click(page, '.sftabbtn[data-t="colours"]');
  await idle(page);
  g = await page.evaluate(() => ({
    h: __mstest.genHarmony,
    pal: __mstest.genPal.map((k) => LCH[keyIdx(k)][1] < GREY_C),
    note: (document.getElementById('sfGenNote') || {}).textContent || '',
    option: [...document.querySelectorAll('#sfHarm option')].find((o) => o.value === 'neutral'),
    optText: ([...document.querySelectorAll('#sfHarm option')].find((o) => o.value === 'neutral') || {}).textContent,
    optOff: ([...document.querySelectorAll('#sfHarm option')].find((o) => o.value === 'neutral') || {}).disabled,
    sel: document.getElementById('sfHarm').value,
  }));
  // (v319: the fallback is the call's alone: the scheme chosen stays on the select, greyed with its why, Y3-3)
  assert.equal(g.h, 'neutral', 'Greys + accent stays chosen');
  assert.equal(g.sel, 'neutral');
  assert.ok(g.pal.length >= 3 && g.pal.every((x) => !x), 'clear colours: ' + g.pal);
  assert.equal(g.note, 'Greys + accent needs 3 greys among your markers: Analogous + accent instead');
  assert.equal(g.optOff, true);
  assert.equal(g.optText, 'Greys + accent — needs 3 greys among your markers');
  assert.deepEqual(errors, []);
});
