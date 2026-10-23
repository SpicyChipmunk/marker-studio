// v318.37 — Fable's X3 fixes on the Palette screen, Markers › Random and the guide's palette card: a locked colour
// keeps its place under Analogous + accent and Light to shadow (X3-1); Greys + accent started from a grey marker, or
// on greys only (X3-2, X3-5); Random's Remove/Clear Undo can't undo across later draws (X3-3); the guide's fallback
// note goes on Undo (X3-4); a linked Library palette since deleted is said so and can be saved again (X3-6).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, welcome, idle, until, sampleGuide } from './helpers.mjs';

before(setup);
after(teardown);

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
        assert.ok(hd(h, accH) >= 100, 'fan hue ' + Math.round(h) + ' against the accent ' + Math.round(accH));
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
