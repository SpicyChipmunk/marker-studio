// The Palette screen: harmonies, locks, sizes, saving, Use in a guide.
// (v320) Tests organised by feature: each block below came from the file named above it, its tests unchanged.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { frames, idle, openApp, sampleGuide, setup, teardown, until, welcome } from './helpers.mjs';

before(setup);
after(teardown);

// ---- from v31832-g3.test.mjs ----
// v318.32 (G3) in the browser: "Start the palette from" on an iPad shows its markers, not 2 px slivers under the
// search box. Safari's engine sized the auto rows of the scrolling marker grid (a flex item of the card) to nothing
// at 820 x 1180 and 1180 x 820 until something relaid the page (a screenshot, a turn); on the iPad itself nothing did.
// Fails on v318.31's HEAD in WebKit (the rows measure 0 before any relayout); Chromium never squashed them.
{
  // the first marker's height and the grid's rows as laid out now (no screenshot or scroll first: those relaid the page
  // and hid the fault)
  const rows = (page) =>
    page.evaluate(() => {
      const g = document.getElementById('seedGrid'),
        c = g.querySelector('.cell');
      return {
        cell: Math.round(c.getBoundingClientRect().height),
        row: parseFloat(getComputedStyle(g).gridTemplateRows.split(' ')[0]),
        n: g.querySelectorAll('.cell').length,
        scrolls: g.scrollHeight > g.clientHeight,
        randomIn: document.getElementById('seedRandom').getBoundingClientRect().bottom <= innerHeight,
      };
    });
  for (const [w, h, name] of [
    [820, 1180, 'iPad portrait'],
    [1180, 820, 'iPad landscape'],
  ]) {
    test(`Start the palette from on an ${name} (${w} x ${h}, touch): every marker its full height, the grid scrolling, Random base in view; still so after turning`, async () => {
      const { page, errors } = await openApp({ width: w, height: h, touch: true });
      await page.click('#wcSkip');
      await page.click('#wcLook');
      await page.click('#mPalette');
      await idle(page);
      await page.click('#seedBtn');
      await page.waitForSelector('#seedOverlay.on');
      await idle(page);
      let r = await rows(page);
      assert.ok(r.n > 100, 'every marker to pick from with an empty collection');
      assert.ok(
        r.cell >= 40,
        `a marker card ${r.cell} px tall (its swatch alone is 36): rows of ${r.row} px`,
      );
      assert.ok(r.scrolls, 'the grid scrolls');
      assert.ok(r.randomIn, 'Random base stays in view under the grid');
      // turning the iPad with the dialog open
      await page.setViewportSize({ width: h, height: w });
      await frames(page, 2);
      r = await rows(page);
      assert.ok(r.cell >= 40, `after turning: a marker card ${r.cell} px tall, rows of ${r.row} px`);
      assert.ok(r.randomIn, 'after turning: Random base in view');
      await page.setViewportSize({ width: w, height: h });
      await frames(page, 2);
      r = await rows(page);
      assert.ok(r.cell >= 40, `turned back: a marker card ${r.cell} px tall, rows of ${r.row} px`);
      // the same grid as "Choose a marker" for a Custom slot
      await page.click('#seedClose');
      await idle(page);
      await page.click('#harm [data-h="custom"]');
      await idle(page);
      await page.click('#bands .band');
      await page.waitForSelector('#seedOverlay.on');
      await idle(page);
      assert.equal(await page.textContent('#pickTitle'), 'Choose a marker');
      r = await rows(page);
      assert.ok(r.cell >= 40, `Choose a marker: a marker card ${r.cell} px tall, rows of ${r.row} px`);
      assert.deepEqual(errors, []);
    });
  }
}

// ---- from v31834-harmonies.test.mjs ----
// v318.34 (FD): three harmonies on evenly stepped ramps. Palette's Harmony grid holds 12 (Light to shadow, Analogous
// + accent and Greys + accent after Monochrome, still 3 columns); Greys + accent is greyed with its reason below 3
// greys in play (a tap says why; Generate says it when it's the scheme); its note never says "greys"; the guide's
// select greys the option, and a guide whose greys drop below 3 falls back to Analogous + accent with a note.
// Fails on v318.33 (the three aren't there).
{
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
          wide: bs.every(
            (b) =>
              b.getBoundingClientRect().right <=
              document.getElementById('harm').getBoundingClientRect().right + 1,
          ),
          tall: bs.every((b) => b.getBoundingClientRect().height >= 36),
        };
      });
      assert.deepEqual(grid.order, [
        'complementary',
        'analogous',
        'triadic',
        'split',
        'tetradic',
        'mono',
        'shadow',
        'accent',
        'neutral',
        'rainbow',
        'custom',
        'photo',
      ]);
      assert.equal(grid.cols, 3, 'three columns');
      assert.equal(grid.rows, 4, 'four rows of three');
      assert.ok(
        grid.wide && grid.tall,
        'every name inside the track, rows at least 36 px: ' + JSON.stringify(grid),
      );
      // Honolulu 120 (29 greys): the three make palettes; their sizes stop at 8
      await click(page, '#harm [data-h="shadow"]');
      await idle(page);
      let p = await palette(page);
      assert.equal(p.h, 'shadow');
      assert.ok(
        p.n >= 3 && p.n <= 8 && p.n === (await page.evaluate(() => state.palSize)),
        'Light to shadow made: ' + p.n,
      );
      assert.deepEqual(
        p.L,
        p.L.slice().sort((a, b) => b - a),
        'light to dark: ' + p.L,
      );
      assert.match(p.desc, /shadows/);
      assert.equal(
        await page.evaluate(() =>
          [...document.querySelectorAll('#segs button')]
            .filter((b) => !b.disabled)
            .map((b) => +b.dataset.n)
            .join(','),
        ),
        '3,4,5,6,7,8',
      );
      await click(page, '#harm [data-h="accent"]');
      await idle(page);
      p = await palette(page);
      assert.equal(p.h, 'accent');
      assert.ok(
        p.n === (await page.evaluate(() => state.palSize)) && p.greys.every((g) => !g),
        'Analogous + accent: clear colours',
      );
      await click(page, '#harm [data-h="neutral"]');
      await idle(page);
      p = await palette(page);
      assert.equal(p.h, 'neutral');
      assert.equal(p.greys[0], false, 'the accent first');
      assert.ok(
        p.greys.slice(1).every((g) => g),
        'then greys: ' + p.greys,
      );
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
    const opts = await page.evaluate(() =>
      [...document.querySelectorAll('#sfHarm option')].map((o) => o.value),
    );
    assert.deepEqual(
      opts.filter((v) => v),
      [
        'complementary',
        'analogous',
        'triadic',
        'split',
        'tetradic',
        'mono',
        'shadow',
        'accent',
        'neutral',
        'rainbow',
      ],
    );
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
    assert.ok(
      g.pal.length >= 3 && !g.pal[0] && g.pal.slice(1).every((x) => x),
      'a clear accent, then greys: ' + g.pal,
    );
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
      optText: ([...document.querySelectorAll('#sfHarm option')].find((o) => o.value === 'neutral') || {})
        .textContent,
      optOff: ([...document.querySelectorAll('#sfHarm option')].find((o) => o.value === 'neutral') || {})
        .disabled,
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
}

// ---- from v31837-palettes.test.mjs ----
// v318.37 — Fable's X3 fixes on the Palette screen, Markers › Random and the guide's palette card: a locked colour
// keeps its place under Analogous + accent and Light to shadow (X3-1); Greys + accent started from a grey marker, or
// on greys only (X3-2, X3-5); Random's Remove/Clear Undo can't undo across later draws (X3-3); the guide's fallback
// note goes on Undo (X3-4); a linked Library palette since deleted is said so and can be saved again (X3-6).
{
  const ONB = { 'ms-seen-hints': '["along","tap","mk-grid","markers"]' };
  const DEVICES = [
    { name: 'phone', w: 390, h: 844, touch: false },
    { name: 'iPad portrait', w: 820, h: 1180, touch: true },
  ];
  const rolled = (page) => until(page, () => !rolling, null, 'roll');
  const palInfo = (page, h) =>
    page.evaluate((h) => {
      const p = state.palettes[state.palettes.length - 1];
      return {
        p,
        hs: p.map((i) => LCH[i][2]),
        C: p.map((i) => LCH[i][1]),
        L: p.map((i) => LCH[i][0]),
        on: palOnScheme(p, h, new Set()),
        note: document.getElementById('palClose').textContent,
        locked: state.locked.slice(),
      };
    }, h);
  // the band's lock, by its own button (dispatched: on the iPad the band's entrance animation kept Playwright's hit test
  // on the card for a while; the lock's reach is v3102's and v31825-x2's to test)
  const lockBand = (page, k) =>
    page.evaluate((k) => document.querySelector('#bands .band:nth-child(' + k + ') .blk').click(), k);
  const hd = (x, y) => {
    const d = Math.abs(x - y) % 360;
    return Math.min(d, 360 - d);
  };
  async function toPalette(dev) {
    const app = await openApp({ storage: ONB, width: dev.w, height: dev.h, touch: dev.touch });
    await welcome(app.page, 'look');
    await idle(app.page);
    await app.page.click('#mPalette');
    await idle(app.page);
    return app;
  }
  const sv = (page) =>
    page.evaluate(() => {
      const s = __mstest.styleVars;
      return {
        src: s.paletteSource,
        savedPalId: s.savedPalId,
        genPal: s.genPal.slice(),
        fromPal: s.fromPal && { ...s.fromPal },
        genHarmony: s.genHarmony,
      };
    });
  const card = (page) =>
    page.evaluate(() => {
      const c = document.getElementById('sfPalCard');
      if (!c) return null;
      return {
        name: c.querySelector('.sfpntx b').textContent,
        line: c.querySelector('.sfpntx span').textContent,
        gone: c.classList.contains('sfpalgone'),
        note: (document.getElementById('sfGenNote') || {}).textContent || '',
        sel: (document.getElementById('sfHarm') || {}).value,
        save: !!document.getElementById('sfPalSave'),
      };
    });
  for (const dev of DEVICES) {
    test(`X3-1: a locked accent / shadow end keeps its place and the scheme on Generate (${dev.name})`, async () => {
      const { page, errors } = await toPalette(dev);
      await page.click('#harm [data-h="accent"]');
      await rolled(page);
      await idle(page);
      const n = await page.evaluate(() => state.palSize);
      // lock the accent band (the last) with its own lock button
      await lockBand(page, n);
      await idle(page);
      let info = await palInfo(page, 'accent');
      assert.equal(info.locked.length, 1);
      const acc = info.p[n - 1];
      assert.equal(info.locked[0], acc);
      for (let t = 0; t < 4; t++) {
        await page.click('#draw');
        await rolled(page);
        await idle(page, 600);
        info = await palInfo(page, 'accent');
        assert.equal(info.p[n - 1], acc, 'the locked accent stays last');
        assert.ok(info.on, 'on the scheme: ' + info.hs.map(Math.round).join('/'));
        // the fan sits across the wheel from the accent, not round it
        const accH = info.hs[n - 1];
        for (const h of info.hs.slice(0, n - 1))
          assert.ok(
            hd(h, accH) >= 100,
            'fan hue ' + Math.round(h) + ' against the accent ' + Math.round(accH),
          );
        assert.doesNotMatch(info.note, /stray from the scheme/, info.note);
      }
      // Light to shadow: the darkest (last) locked, the sweep still ends on it
      await lockBand(page, n);
      await idle(page);
      await page.click('#harm [data-h="shadow"]');
      await rolled(page);
      await idle(page);
      const n2 = await page.evaluate(() => state.palSize);
      await lockBand(page, n2);
      await idle(page);
      info = await palInfo(page, 'shadow');
      const end = info.p[n2 - 1];
      assert.deepEqual(info.locked, [end]);
      const win = await page.evaluate(() => genLevels('shadow')[0][1]);
      for (let t = 0; t < 3; t++) {
        await page.click('#draw');
        await rolled(page);
        await idle(page, 600);
        info = await palInfo(page, 'shadow');
        assert.equal(info.p[n2 - 1], end, 'the locked shadow end stays last');
        // the base's sweep ends on the locked hue (within its window), so the first colour is ~120° from it
        const D = n2 <= 3 ? 90 : 120;
        assert.ok(
          Math.abs(hd(info.hs[0], info.hs[n2 - 1]) - D) <= win + 1e-6,
          'first hue ' + Math.round(info.hs[0]) + ' is D from the locked ' + Math.round(info.hs[n2 - 1]),
        );
        assert.ok(info.on, 'on the scheme: ' + info.hs.map(Math.round).join('/'));
      }
      assert.deepEqual(errors, []);
      await page.context().close();
    });

    test(`X3-2/X3-5: Greys + accent from a grey marker: one clear accent, the grey on the ramp; on greys only the card says so (${dev.name})`, async () => {
      const { page, errors } = await toPalette(dev);
      const g = await page.evaluate(() => {
        const r = [];
        for (let i = 0; i < COLORS.length; i++) if (inPool(i) && LCH[i][1] < GREY_C) r.push(i);
        return r;
      });
      assert.ok(g.length >= 8, 'greys in the sample collection: ' + g.length);
      const seed = g[Math.floor(g.length / 2)];
      await page.evaluate((i) => {
        state.seed = mkey(i);
        setHarmony('neutral');
      }, seed);
      await rolled(page);
      await idle(page);
      const GREY_C = await page.evaluate(() => GREY_C);
      for (let t = 0; t < 3; t++) {
        if (t) {
          await page.click('#draw');
          await rolled(page);
          await idle(page, 600);
        }
        const info = await palInfo(page, 'neutral');
        assert.ok(info.p.includes(seed), 'the Start marker is in the palette');
        assert.ok(info.C[0] >= GREY_C, 'the accent first, a clear colour: ' + info.C.map(Math.round));
        assert.equal(info.C.filter((c) => c >= GREY_C).length, 1, 'one clear colour');
        const ramp = info.L.slice(1);
        for (let k = 1; k < ramp.length; k++)
          assert.ok(ramp[k - 1] >= ramp[k] - 1e-6, 'the greys light to dark: ' + ramp.map(Math.round));
        assert.equal(info.note, '');
        assert.match(await page.textContent('#readout'), /Greys \+ accent · (Ohuhu|Copic) .* base/);
      }
      // a selection of greys only: the accent is a grey, and the line under the card says so
      await page.evaluate(() => {
        state.seed = null;
        const r = [];
        for (let i = 0; i < COLORS.length; i++) if (inPool(i) && LCH[i][1] < GREY_C) r.push(i);
        setPool(r);
        filterChanged();
      });
      await rolled(page);
      await idle(page, 600);
      const info = await palInfo(page, 'neutral');
      assert.ok(
        info.C.every((c) => c < GREY_C),
        'all greys',
      );
      assert.equal(info.note, 'All greys: your markers in play don’t have a clear colour for the accent.');
      assert.deepEqual(errors, []);
      await page.context().close();
    });

    test(`X3-3: Random: the Undo toast of Remove / Clear all can't undo across a later draw (${dev.name})`, async () => {
      const { page, errors } = await openApp({ storage: ONB, width: dev.w, height: dev.h, touch: dev.touch });
      await welcome(page, 'look');
      await idle(page);
      await page.click('#mCollection');
      await idle(page);
      await page.click('#mkDrawBtn');
      await idle(page);
      const draw = async () => {
        await page.click('#draw');
        await rolled(page);
        await idle(page, 700);
      };
      const pile = () => page.evaluate(() => state.drawn.slice());
      const toastOn = () =>
        page.evaluate(() => {
          const t = document.getElementById('msToast');
          return t.classList.contains('on') ? t.textContent : '';
        });
      for (let i = 0; i < 3; i++) await draw();
      const three = await pile();
      await page.click('#undo');
      await idle(page);
      assert.deepEqual(await pile(), three.slice(1));
      assert.match(await toastOn(), /^Removed /);
      // a draw since: the Undo toast goes with it
      await draw();
      const four = await pile();
      assert.equal(four.length, 3);
      assert.equal(await toastOn(), '', 'the Undo toast is gone after a draw');
      // the same Undo fired late (its button kept): nothing put back, the new draw kept
      assert.deepEqual(await pile(), four);
      // Remove, then Undo straight away: back as it was
      await page.click('#undo');
      await idle(page);
      await page.click('#toastAct');
      await idle(page);
      assert.deepEqual(await pile(), four, 'Undo in time puts the pile back');
      // Clear all, a draw, and the Clear toast's Undo is no longer offered
      await page.click('#reset');
      await page.click('#reset');
      await idle(page);
      assert.deepEqual(await pile(), []);
      assert.match(await toastOn(), /^Cleared 3 drawn markers/);
      await draw();
      assert.equal((await pile()).length, 1);
      assert.equal(await toastOn(), '');
      // Swap this one hides it too
      await page.click('#undo');
      await idle(page);
      assert.match(await toastOn(), /^Removed /);
      await draw();
      await page.click('#swap');
      await rolled(page);
      await idle(page, 700);
      assert.equal(await toastOn(), '');
      assert.equal((await pile()).length, 1);
      assert.deepEqual(errors, []);
      await page.context().close();
    });
  }
  test('X3-3: drawnBack refuses a pile that has changed since (the toast fired late)', async () => {
    const { page, errors } = await openApp({ storage: ONB });
    await welcome(page, 'look');
    await idle(page);
    await page.click('#mCollection');
    await idle(page);
    await page.click('#mkDrawBtn');
    await idle(page);
    for (let i = 0; i < 3; i++) {
      await page.click('#draw');
      await rolled(page);
      await idle(page, 700);
    }
    const three = await page.evaluate(() => state.drawn.slice());
    await page.click('#undo');
    await idle(page);
    // the Undo's own function, as the toast's button would call it, after a new draw
    const fn = await page.evaluate(() => {
      const b = document.getElementById('toastAct');
      window.__lateUndo = b;
      return !!b;
    });
    assert.ok(fn);
    await page.click('#draw');
    await rolled(page);
    await idle(page, 700);
    const now = await page.evaluate(() => state.drawn.slice());
    assert.equal(now.length, 3);
    assert.notEqual(now[0], three[0]);
    await page.evaluate(() => window.__lateUndo.click());
    await idle(page);
    assert.deepEqual(await page.evaluate(() => state.drawn.slice()), now, 'the late Undo changed nothing');
    assert.match(await page.textContent('#msToast'), /pile has changed/);
    assert.deepEqual(errors, []);
    await page.context().close();
  });
  test('X3-4: the guide: Greys + accent falls back with a note; Undo puts Greys + accent back without the note', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await page.click('#sfSrc [data-v="palette"]');
    await idle(page);
    // (v319: Greys & black is off by default and greys Greys + accent (Y3-2): Expand shows the Include row, its chip on)
    await page.click('#sfExpand');
    await idle(page);
    await page.click('#sfIncl [data-v="greys"]');
    await idle(page);
    await page.selectOption('#sfHarm', 'neutral');
    await idle(page);
    assert.equal((await sv(page)).genHarmony, 'neutral');
    assert.equal((await card(page)).note, '');
    // the greys leave the collection: Shuffle makes a new palette, Analogous + accent instead
    await page.evaluate(() => {
      for (const k of [...state.owned]) if (LCH[keyIdx(k)][1] < GREY_C) state.owned.delete(k);
      save();
    });
    await page.click('.sftabbtn[data-t="pattern"]');
    await idle(page);
    await page.click('#sfVary');
    await idle(page);
    await page.click('.sftabbtn[data-t="colours"]');
    await idle(page);
    let c = await card(page);
    // (v319: the fallback is the call's alone: Greys + accent stays chosen, the card says what was made, Y3-3)
    assert.equal((await sv(page)).genHarmony, 'neutral');
    assert.equal(c.sel, 'neutral');
    assert.equal(c.name, 'Analogous + accent');
    assert.equal(c.note, 'Greys + accent needs 3 greys among your markers: Analogous + accent instead');
    // Undo: the step before had Greys + accent; the note about the fallback goes with the fallback
    await page.click('#sfPlanUndo');
    await idle(page);
    c = await card(page);
    assert.equal((await sv(page)).genHarmony, 'neutral');
    assert.equal(c.sel, 'neutral');
    assert.equal(c.note, '', 'no fallback note under Greys + accent');
    assert.deepEqual(errors, []);
    await page.context().close();
  });
  test('X3-6: a chosen Library palette since deleted: "From your Library (deleted)" and Save to Library again', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await page.evaluate(() => {
      state.saved.unshift({
        id: 777001,
        type: 'palette',
        name: 'Clementine',
        h: 'triadic',
        keys: [...state.owned].slice(0, 5),
        ts: 777001,
      });
      save();
    });
    await page.click('#sfSrc [data-v="palette"]');
    await idle(page);
    await page.selectOption('#sfPalPick', '777001');
    await idle(page);
    let c = await card(page);
    assert.equal(c.line, '5 markers · Triadic · From your Library');
    assert.equal(c.save, false, 'in the Library: no Save to Library');
    const keys = (await sv(page)).genPal;
    // deleted from the Library (Library › delete), the card re-drawn
    await page.evaluate(() => {
      state.saved = state.saved.filter((x) => x.id !== 777001);
      save();
      __mstest.renderControls();
    });
    await idle(page);
    c = await card(page);
    assert.equal(c.gone, false, 'the guide keeps the palette');
    assert.equal(c.name, 'Clementine');
    assert.equal(c.line, '5 markers · Triadic · From your Library (deleted)');
    assert.equal(c.save, true, 'Save to Library offered again');
    assert.deepEqual((await sv(page)).genPal, keys);
    // saved again: linked to the new one, as before
    await page.click('#sfPalSave');
    await idle(page);
    const s = await sv(page);
    assert.equal(s.src, 'saved');
    assert.notEqual(s.savedPalId, 777001);
    assert.ok(
      await page.evaluate(
        (id) => state.saved.some((x) => x.id === id && x.type === 'palette' && x.name === 'Clementine'),
        s.savedPalId,
      ),
      'in the Library under its name',
    );
    assert.deepEqual(s.fromPal, { name: 'Clementine', h: 'triadic', from: 'library' });
    c = await card(page);
    assert.equal(c.line, '5 markers · Triadic · From your Library');
    assert.equal(c.save, false);
    assert.deepEqual(errors, []);
    await page.context().close();
  });
}

// ---- from v319-palettes.test.mjs ----
// v319 — Fable's Y3 fixes: on the Palette screen, Greys + accent from a black with the accent locked keeps the lock,
// at the accent's place (Y3-1); in a guide, Include › Greys & black off greys Greys + accent with that reason, and a
// regeneration falls back to Analogous + accent per call, the chosen scheme kept on the select and the note shown each
// time, Greys + accent back once the greys are (Y3-2, Y3-3); Markers › Random: a tap on the pile has Undo, and takes the
// place of an earlier Remove/Clear toast (Y3-4).
{
  const ONB = { 'ms-seen-hints': '["along","tap","mk-grid","markers"]' };
  const DEVICES = [
    { name: 'phone', w: 390, h: 844, touch: false },
    { name: 'iPad portrait', w: 820, h: 1180, touch: true },
  ];
  const rolled = (page) => until(page, () => !rolling, null, 'roll');
  const lockBand = (page, k) =>
    page.evaluate((k) => document.querySelector('#bands .band:nth-child(' + k + ') .blk').click(), k);
  const palInfo = (page) =>
    page.evaluate(() => {
      const p = state.palettes[state.palettes.length - 1];
      return {
        p,
        C: p.map((i) => LCH[i][1]),
        locked: state.locked.slice(),
        lockIcons: [...document.querySelectorAll('#bands .band')].map((b) => b.classList.contains('locked')),
        readout: document.getElementById('readout').textContent,
      };
    });
  async function toPalette(dev) {
    const app = await openApp({ storage: ONB, width: dev.w, height: dev.h, touch: dev.touch });
    await welcome(app.page, 'look');
    await idle(app.page);
    await app.page.click('#mPalette');
    await idle(app.page);
    return app;
  }
  for (const dev of DEVICES) {
    test(`Y3-1: Greys + accent from a black with the accent locked: Generate keeps the lock, the accent first (${dev.name})`, async () => {
      const { page, errors } = await toPalette(dev);
      const GREY_C = await page.evaluate(() => GREY_C);
      // the darkest grey in play (a black: its ramp step is the last slot, where the locked accent had been put)
      const black = await page.evaluate(() => {
        let b = null;
        for (let i = 0; i < COLORS.length; i++)
          if (inPool(i) && LCH[i][1] < GREY_C && (b == null || LCH[i][0] < LCH[b][0])) b = i;
        return b;
      });
      await page.evaluate((i) => {
        state.seed = mkey(i);
        setHarmony('neutral');
      }, black);
      await rolled(page);
      await idle(page);
      let info = await palInfo(page);
      assert.ok(info.p.includes(black), 'the Start marker is in the palette');
      assert.ok(info.C[0] >= GREY_C, 'the accent first');
      const acc = info.p[0];
      await lockBand(page, 1);
      await idle(page);
      info = await palInfo(page);
      assert.deepEqual(info.locked, [acc]);
      for (let t = 0; t < 4; t++) {
        await page.click('#draw');
        await rolled(page);
        await idle(page, 600);
        info = await palInfo(page);
        assert.equal(info.p[0], acc, 'the locked accent stays first: ' + info.p);
        assert.deepEqual(info.locked, [acc], 'and stays locked');
        assert.equal(info.lockIcons[0], true, 'its lock shown');
        assert.ok(info.p.includes(black), 'the black on the ramp');
        assert.equal(
          info.C.filter((c) => c >= GREY_C).length,
          1,
          'one clear colour: ' + info.C.map(Math.round),
        );
        assert.match(info.readout, /Greys \+ accent · (Ohuhu|Copic) .* base/);
      }
      assert.deepEqual(errors, []);
      await page.context().close();
    });

    test(`Y3-2/Y3-3: the guide: choosing Greys + accent turns Greys & black on (Undo too); the fallback is per call and the scheme comes back with the greys (${dev.name})`, async () => {
      const { page, errors } = await openApp({ storage: ONB, width: dev.w, height: dev.h, touch: dev.touch });
      await sampleGuide(page);
      const sv = () =>
        page.evaluate(() => {
          const s = __mstest.styleVars,
            opt = [...document.querySelectorAll('#sfHarm option')].find((o) => o.value === 'neutral'),
            card = document.getElementById('sfPalCard');
          return {
            h: s.genHarmony,
            greys: s.genPal.map((k) => LCH[keyIdx(k)][1] < GREY_C),
            note: (document.getElementById('sfGenNote') || {}).textContent || '',
            sel: document.getElementById('sfHarm').value,
            optOff: opt.disabled,
            optText: opt.textContent,
            chip: (document.querySelector('#sfIncl [data-v="greys"]') || {}).getAttribute
              ? document.querySelector('#sfIncl [data-v="greys"]').getAttribute('aria-pressed')
              : null,
            card: card ? card.querySelector('.sfpntx b').textContent : null,
            line: card ? card.querySelector('.sfpntx span').textContent : null,
          };
        });
      await page.click('#sfSrc [data-v="palette"]');
      await idle(page);
      // the Include row (Expand on): Greys & black is off by default, and the option says what it needs
      await page.click('#sfExpand');
      await idle(page);
      let s = await sv();
      assert.equal(s.chip, 'false', 'Greys & black off by default');
      // (v319, Ben's choice) the option can still be chosen: choosing it turns Greys & black on, one Undo step
      assert.equal(s.optOff, false, 'Greys + accent not greyed for the chip alone');
      assert.equal(s.optText, 'Greys + accent');
      const h0 = s.h;
      await page.selectOption('#sfHarm', 'neutral');
      await idle(page);
      s = await sv();
      assert.equal(s.chip, 'true', 'choosing it turned Greys & black on');
      assert.equal(s.h, 'neutral');
      assert.equal(s.note, '');
      assert.match(
        (await page.getAttribute('#sfPlanUndo', 'aria-label')) || '',
        /Greys \+ accent: Greys & black turned on/,
        'Undo says what it takes back',
      );
      // Undo: the chip and the scheme both go back
      await page.click('#sfPlanUndo');
      await idle(page);
      s = await sv();
      assert.equal(s.chip, 'false', 'Undo turned Greys & black off again');
      assert.equal(s.h, h0, 'and put the scheme back');
      // greys on by hand: chosen, a clear accent and greys, no note
      await page.click('#sfIncl [data-v="greys"]');
      await idle(page);
      s = await sv();
      assert.equal(s.optOff, false);
      assert.equal(s.optText, 'Greys + accent');
      await page.selectOption('#sfHarm', 'neutral');
      await idle(page);
      s = await sv();
      assert.equal(s.h, 'neutral');
      assert.ok(
        s.greys.length >= 3 && !s.greys[0] && s.greys.slice(1).every((x) => x),
        'accent then greys: ' + s.greys,
      );
      assert.equal(s.note, '');
      assert.equal(s.card, 'Greys + accent');
      // greys off: the option greys, the scheme stays chosen (the palette isn't remade by the chip)
      await page.click('#sfIncl [data-v="greys"]');
      await idle(page);
      s = await sv();
      assert.equal(s.h, 'neutral');
      assert.equal(s.sel, 'neutral', 'still the one chosen');
      assert.equal(s.optOff, false, 'still choosable: choosing it again would turn the greys on');
      // a Mood tap remakes the palette: Analogous + accent instead, said under the select and on the card; the scheme
      // chosen is kept (it had become Analogous + accent for good)
      await page.click('#sfMood [data-v="vivid"]');
      await idle(page);
      s = await sv();
      assert.equal(s.h, 'neutral', 'genHarmony kept');
      assert.equal(s.sel, 'neutral');
      assert.equal(s.note, 'Greys + accent needs Include › Greys & black on: Analogous + accent instead');
      assert.ok(s.greys.length >= 3 && s.greys.every((x) => !x), 'no grey: ' + s.greys);
      assert.equal(s.card, 'Analogous + accent', 'the card says what was made');
      // and again: the note each time
      await page.click('#sfGenNew');
      await idle(page);
      s = await sv();
      assert.equal(s.h, 'neutral');
      assert.match(s.note, /Analogous \+ accent instead$/);
      // the greys back: the next remake is Greys + accent again, no note
      await page.click('#sfIncl [data-v="greys"]');
      await idle(page);
      s = await sv();
      assert.equal(s.optOff, false);
      assert.equal(s.card, 'Analogous + accent', 'the palette on the card is still the fallback’s');
      await page.click('#sfMood [data-v="muted"]');
      await idle(page);
      s = await sv();
      assert.equal(s.h, 'neutral');
      assert.equal(s.sel, 'neutral');
      assert.equal(s.note, '');
      assert.ok(
        s.greys.length >= 3 && !s.greys[0] && s.greys.slice(1).every((x) => x),
        'accent then greys: ' + s.greys,
      );
      assert.equal(s.card, 'Greys + accent');
      assert.deepEqual(errors, []);
      await page.context().close();
    });

    test(`Y3-4: Random: a tap on the pile has Undo, and takes the place of Remove this one’s toast (${dev.name})`, async () => {
      const { page, errors } = await openApp({ storage: ONB, width: dev.w, height: dev.h, touch: dev.touch });
      await welcome(page, 'look');
      await idle(page);
      await page.click('#mCollection');
      await idle(page);
      await page.click('#mkDrawBtn');
      await idle(page);
      const pile = () => page.evaluate(() => state.drawn.slice());
      const toastOn = () =>
        page.evaluate(() => {
          const t = document.getElementById('msToast');
          return t.classList.contains('on') ? t.textContent : '';
        });
      for (let i = 0; i < 3; i++) {
        await page.click('#draw');
        await idle(page, 1300);
      }
      const three = await pile();
      assert.equal(three.length, 3);
      // Remove this one, then a tap on the pile's last cell: its own toast, with Undo for that removal
      await page.click('#undo');
      await idle(page);
      assert.match(await toastOn(), /^Removed /);
      const two = await pile();
      const gone = two[1];
      await page.click('#pile .cell[data-i="' + gone + '"]');
      await idle(page);
      assert.deepEqual(await pile(), [two[0]]);
      const t = await toastOn();
      assert.match(t, /^Removed (Ohuhu|Copic) \S+/);
      assert.ok(t.indexOf(await page.evaluate((i) => capCode(i), gone)) >= 0, 'the tapped marker: ' + t);
      await page.click('#toastAct');
      await idle(page);
      assert.deepEqual(await pile(), two, 'Undo puts the tapped marker back');
      assert.equal(await toastOn(), '');
      assert.deepEqual(errors, []);
      await page.context().close();
    });
  }
}
