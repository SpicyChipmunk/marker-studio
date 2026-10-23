// v319 — Fable's Y3 fixes: on the Palette screen, Greys + accent from a black with the accent locked keeps the lock,
// at the accent's place (Y3-1); in a guide, Include › Greys & black off greys Greys + accent with that reason, and a
// regeneration falls back to Analogous + accent per call, the chosen scheme kept on the select and the note shown each
// time, Greys + accent back once the greys are (Y3-2, Y3-3); Markers › Random: a tap on the pile has Undo, and takes the
// place of an earlier Remove/Clear toast (Y3-4).
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
