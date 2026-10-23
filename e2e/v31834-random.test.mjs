// v318.34 — Markers › Random tidied (Stage 3 G): what it's for, a shorter card, buttons that say what they act on, the
// Drawn pile under them, the markers left to draw folded by family, two columns held sideways, every drawn marker
// counted, Use in a guide and Undo, Draw from these on Markers, and Prefer markers you haven't used yet.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, openAtScale, welcome, sampleGuide, letterGuide, saveGuide, idle } from './helpers.mjs';

before(setup);
after(teardown);

const ONB = { 'ms-seen-hints': '["along","tap","mk-grid","markers"]' };
const rect = (page, sel) =>
  page.evaluate((s) => {
    const e = document.querySelector(s);
    return e ? e.getBoundingClientRect().toJSON() : null;
  }, sel);
// Markers with a collection, then Random
async function toRandom(opts = {}) {
  const app = await openApp({ storage: ONB, ...opts });
  await welcome(app.page, 'look');
  await idle(app.page);
  await app.page.click('#mCollection');
  await idle(app.page);
  await app.page.click('#mkDrawBtn');
  await idle(app.page);
  return app;
}
const draw = async (page, n = 1) => {
  for (let i = 0; i < n; i++) {
    await page.click('#draw');
    await idle(page, 1300);
  }
};

test('G1–G4: the purpose line, a 160/200 card with no empty band, the buttons’ words, the pile under them, Remaining folded by family lightest first', async () => {
  const { page, errors } = await toRandom({ width: 820, height: 1180, touch: true });
  assert.equal(await page.isVisible('#rndWhy'), true);
  assert.match(await page.textContent('#rndWhy'), /^A marker you wouldn’t have picked: draw one at random, as a prompt or a challenge\.$/);
  // the back control at the left, the card about 200 tall on an iPad held upright, no readout band under an empty card
  const back = await rect(page, '#rndBack'),
    sw = await rect(page, '#swatch');
  assert.ok(back.x < 60, 'back at the left: ' + back.x);
  assert.ok(back.height >= 44, '44px tap area');
  assert.ok(sw.height >= 190 && sw.height <= 210, 'swatch ' + sw.height);
  assert.equal(await page.isVisible('#readout'), false, 'no empty band');
  assert.equal(await page.textContent('#swap'), 'Swap this one');
  assert.equal(await page.textContent('#undo'), 'Remove this one');
  assert.equal(await page.textContent('#reset'), 'Clear all');
  // the pile right under the buttons, the rail and count after it, Remaining folded after Filters
  const order = await page.evaluate(() =>
    [...document.querySelectorAll('#primaryRow, #drawnWrap, #trackWrap, #filterBar, #remFold')].map((e) => e.id),
  );
  assert.deepEqual(order, ['primaryRow', 'drawnWrap', 'trackWrap', 'filterBar', 'remFold']);
  const pr = await rect(page, '#primaryRow'),
    dw = await rect(page, '#drawnWrap'),
    tw = await rect(page, '#trackWrap');
  assert.ok(pr.y < dw.y && dw.y < tw.y, 'buttons, pile, count');
  assert.equal(await page.evaluate(() => document.getElementById('remFold').open), false, 'folded');
  assert.match(await page.textContent('#remSumT'), /^Show the \d+ left to draw$/);
  assert.equal(await page.$$eval('#poolGrid .rghead', (l) => l.length > 3), true, 'families');
  // lightest first within a family, and only families with something left
  const ok = await page.evaluate(() => {
    const gs = [...document.querySelectorAll('#poolGrid .rgroup')];
    return gs.every((g) => {
      const cells = [...g.querySelectorAll('.cell')];
      if (!cells.length) return false;
      const ls = cells.map((c) => {
        const code = c.querySelector('.cc').textContent,
          lbl = c.getAttribute('aria-label');
        const i = COLORS.findIndex((x, j) => lbl.startsWith(x.brand + ' ' + capCode(j) + ' '));
        return LAB[i][0];
      });
      return ls.every((l, i) => !i || l <= ls[i - 1] + 1e-9);
    });
  });
  assert.equal(ok, true, 'lightest first in every family');
  await page.click('#remSum');
  await idle(page);
  assert.equal(await page.evaluate(() => document.getElementById('remFold').open), true);
  assert.equal(await page.isVisible('#poolGrid .cell'), true);
  // the Help bullet
  assert.match(await page.evaluate(() => document.querySelector('#helpMore').textContent), /Random.*Prefer markers you haven’t used yet.*Draw from these/);
  // a phone: a 160 card
  await page.setViewportSize({ width: 390, height: 844 });
  await idle(page);
  const sw2 = await rect(page, '#swatch');
  assert.ok(sw2.height >= 150 && sw2.height <= 170, 'phone swatch ' + sw2.height);
  assert.deepEqual(errors, []);
});
test('G5: held sideways on an iPad, the card and its buttons left and the pile, count, Filters and Remaining in a column beside; back in one column upright', async () => {
  const { page, errors } = await toRandom({ width: 1180, height: 820, touch: true });
  await draw(page, 2);
  const side = await page.evaluate(() => {
    const s = document.getElementById('rndSide');
    return s && s.parentNode.classList.contains('palsplit') && [...s.children].map((e) => e.id);
  });
  assert.deepEqual(side, ['drawnWrap', 'trackWrap', 'filterBar', 'filters', 'remFold']);
  const card = await rect(page, '#stage'),
    pile = await rect(page, '#drawnWrap'),
    fb = await rect(page, '#filterBar');
  assert.ok(pile.x > card.x + card.width, 'the pile beside the card');
  assert.ok(fb.x > card.x + card.width, 'Filters beside it too');
  assert.ok(pile.y < card.y + 60, 'at the top of the column');
  // Filters open there too
  await page.click('#filterBar');
  await idle(page);
  assert.equal(await page.isVisible('#filters'), true);
  assert.ok((await rect(page, '#filters')).x > card.x + card.width);
  // upright: one column, in order under the card
  await page.setViewportSize({ width: 820, height: 1180 });
  // (the media query's change comes a moment after the resize on WebKit)
  await page.waitForFunction(() => !document.getElementById('rndSide').children.length, null, { timeout: 5000 });
  await idle(page);
  const order = await page.evaluate(() => {
    const ids = [...document.querySelectorAll('.palsplit ~ *')].map((e) => e.id).filter(Boolean);
    return ids.slice(0, 5);
  });
  assert.deepEqual(order, ['drawnWrap', 'trackWrap', 'filterBar', 'filters', 'remFold']);
  assert.ok((await rect(page, '#drawnWrap')).y > (await rect(page, '#stage')).y + 100, 'under the card');
  // Palette held sideways after it: Filters go with its settings, as before, and back when Random is opened again
  await page.setViewportSize({ width: 1180, height: 820 });
  await page.click('#mPalette');
  await idle(page);
  assert.equal(await page.evaluate(() => document.getElementById('filterBar').parentNode.className), 'palset');
  await page.click('#mCollection');
  await page.click('#mkDrawBtn');
  await page.waitForFunction(() => document.getElementById('rndSide').children.length === 5, null, { timeout: 5000 });
  await idle(page);
  assert.deepEqual(
    await page.evaluate(() => [...document.getElementById('rndSide').children].map((e) => e.id)),
    ['drawnWrap', 'trackWrap', 'filterBar', 'filters', 'remFold'],
  );
  assert.deepEqual(errors, []);
});

test('G6: every drawn marker is counted, the ones a filter leaves out said beside; G7: Use in a guide from two, Undo after Remove this one and Clear all', async () => {
  const { page, errors } = await toRandom();
  await draw(page, 1);
  assert.match(await page.textContent('#status'), /^1 drawn, \d+ left to draw$/);
  assert.equal(await page.isVisible('#useGuideWrap'), false, 'one marker is no palette');
  await draw(page, 1);
  assert.equal(await page.isVisible('#useGuideWrap'), true);
  assert.equal(await page.isVisible('#useInGuide'), true);
  // the first drawn marker's family turned off: still "2 drawn", one of them not in the filter
  const fam = await page.evaluate(() => COLORS[state.drawn[0]].fam);
  const other = await page.evaluate(() => COLORS[state.drawn[1]].fam);
  await page.evaluate((f) => {
    state.excluded.add(f);
    filterChanged();
  }, fam);
  await idle(page);
  const st = await page.textContent('#status');
  assert.match(st, fam === other ? /^2 drawn, \d+ left to draw · 2 not in the filter$/ : /^2 drawn, \d+ left to draw · 1 not in the filter$/, st);
  assert.equal(await page.textContent('#pilen'), '(2)');
  await page.evaluate((f) => {
    state.excluded.delete(f);
    filterChanged();
  }, fam);
  await idle(page);
  assert.match(await page.textContent('#status'), /^2 drawn, \d+ left to draw$/);
  // Remove this one: the latest goes, Undo brings it back
  const was = await page.evaluate(() => state.drawn.slice());
  await page.click('#undo');
  await idle(page);
  assert.deepEqual(await page.evaluate(() => state.drawn), was.slice(1));
  assert.match(await page.textContent('#msToast'), /^Removed (Ohuhu|Copic) \S+/);
  await page.click('#toastAct');
  await idle(page);
  assert.deepEqual(await page.evaluate(() => state.drawn), was, 'back as it was');
  // Clear all, armed, then Undo
  await page.click('#reset');
  assert.equal(await page.textContent('#reset'), 'Clear all? Tap again');
  await page.click('#reset');
  await idle(page);
  assert.deepEqual(await page.evaluate(() => state.drawn), []);
  assert.equal(await page.textContent('#reset'), 'Clear all');
  assert.match(await page.textContent('#msToast'), /^Cleared 2 drawn markers/);
  await page.click('#toastAct');
  await idle(page);
  assert.deepEqual(await page.evaluate(() => state.drawn), was);
  // Use in a guide hands the draw over as a palette of chosen markers, as Palette's does (no guide open:
  // recolourWith takes it to the Guide screen)
  const held = await page.evaluate(() => {
    const calls = [];
    SF.guideBrief = () => null;
    SF.recolourWith = (p) => {
      calls.push(p);
      return false;
    };
    document.getElementById('useInGuide').click();
    return { calls, mode: state.mode };
  });
  assert.equal(held.calls.length, 1);
  assert.deepEqual(held.calls[0].keys, await page.evaluate((w) => w.map(mkey), was));
  assert.equal(held.calls[0].h, 'custom');
  assert.equal(held.mode, 'sections');
  assert.deepEqual(errors, []);
});

test('G8: Draw from these on Markers opens Random from the markers shown', async () => {
  const { page, errors } = await openApp({ storage: ONB });
  await welcome(page, 'look');
  await idle(page);
  await page.click('#mCollection');
  await idle(page);
  const tr = await rect(page, '#toRandom'),
    tp = await rect(page, '#toPalette');
  assert.ok(tr && tr.height >= 44 && Math.abs(tr.y - tp.y) < 2, 'beside Palette from these');
  assert.equal(await page.textContent('#toRandom'), 'Draw from these');
  await page.fill('#q', 'R2');
  await idle(page);
  const shown = await page.evaluate(() => shownMatches().filter((i) => !NOINK.has(i)));
  assert.ok(shown.length > 1 && shown.length < 40, 'a search narrows it: ' + shown.length);
  await page.click('#toRandom');
  await idle(page);
  assert.equal(await page.evaluate(() => state.mode), 'random');
  assert.deepEqual(await page.evaluate(() => state.pool), shown);
  assert.equal(await page.isVisible('#poolBar'), true);
  assert.equal(await page.textContent('#poolN'), String(shown.length));
  await draw(page, 1);
  assert.ok(shown.includes(await page.evaluate(() => state.drawn[0])), 'drawn from the selection');
  // and the drawn marker is counted among the selection
  assert.match(await page.textContent('#status'), new RegExp('^1 drawn, ' + (shown.length - 1) + ' left to draw$'));
  assert.deepEqual(errors, []);
});

test('G9: Prefer markers you haven’t used yet leaves out the markers of guides you’ve worked with, says when all are used, and is remembered', async () => {
  const { page, errors } = await toRandom();
  assert.equal(await page.isVisible('#rndFreshWrap'), true);
  assert.equal(await page.isChecked('#rndFresh'), false);
  assert.equal(await page.isVisible('#rndFreshNote'), false);
  // five markers in play; three of them in guides: one with the worked flag, one ticked (done), one toned (tn); a
  // fourth's guide was only built (not used), a fifth's is a saved palette, not a guide
  const K = await page.evaluate(() => {
    const own = [];
    for (let i = 0; i < COLORS.length && own.length < 5; i++) if (inPool(i)) own.push(i);
    state.owned = new Set(own.map(mkey));
    state.drawn = [];
    const k = own.map(mkey);
    state.saved = [
      { id: 1, type: 'guide', name: 'A', keys: [k[0]], wk: 1 },
      { id: 2, type: 'guide', name: 'B', keys: [k[1]], done: 2 },
      { id: 3, type: 'guide', name: 'C', keys: [k[2]], tn: 1 },
      { id: 4, type: 'guide', name: 'D', keys: [k[3]] },
      { id: 5, type: 'palette', name: 'E', keys: [k[4]] },
    ];
    save();
    fullRender();
    return { own, k };
  });
  await page.click('#rndFresh');
  await idle(page);
  assert.equal(await page.evaluate(() => state.rndFresh), 1);
  assert.equal(await page.textContent('#rndFreshNote'), '2 of the 5 left to draw haven’t been used yet');
  assert.deepEqual(await page.evaluate(() => drawPool().list), [K.own[3], K.own[4]]);
  await draw(page, 1);
  assert.ok([K.own[3], K.own[4]].includes(await page.evaluate(() => state.drawn[0])), 'an unused one');
  assert.equal(await page.textContent('#rndFreshNote'), '1 of the 4 left to draw hasn’t been used yet');
  await draw(page, 1);
  assert.deepEqual((await page.evaluate(() => state.drawn.slice().sort())).sort(), [K.own[3], K.own[4]].sort());
  // all the rest have been used: it says so and draws from all of them
  assert.equal(await page.textContent('#rndFreshNote'), 'Every marker left to draw has been used: drawing from all of them');
  assert.equal(await page.evaluate(() => drawPool().allUsed), true);
  assert.equal(await page.isDisabled('#draw'), false);
  await draw(page, 1);
  assert.equal(await page.evaluate(() => state.drawn.length), 3);
  // remembered
  await page.reload();
  await idle(page);
  assert.equal(await page.isChecked('#rndFresh'), true);
  assert.equal(await page.evaluate(() => state.rndFresh), 1);
  await page.click('#rndFresh');
  await idle(page);
  assert.equal(await page.isVisible('#rndFreshNote'), false);
  assert.equal(await page.evaluate(() => drawPool().list.length), 2, 'off: every marker left');
  // a guide with a photo of its finished page counts too (fn)
  assert.equal(
    await page.evaluate(() => {
      state.saved[3].fn = 5;
      return usedKeys().size;
    }),
    4,
  );
  assert.deepEqual(errors, []);
});

test('G9: the worked flag is set when Colour along opens, and kept from save to save; a ticked section sets it at the save', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  // (the sample isn't in the Library: a guide of your own, saved)
  await letterGuide(page);
  await saveGuide(page);
  const row = () => page.evaluate(() => (state.saved.find((s) => s.type === 'guide' && s.id === __mstest.curId) || {}).wk);
  assert.equal(await page.evaluate(() => __mstest.curId != null), true);
  assert.equal(await row(), undefined, 'built, not worked with');
  await page.click('#sfColor');
  await idle(page);
  assert.equal(await row(), 1, 'Colour along opened');
  // kept by the guide's next save
  assert.equal(await page.evaluate(() => guideMeta({ name: 'x', keys: [], payload: {} }, __mstest.curId).wk), 1);
  // another guide: ticked sections set it at the save, without the flag
  assert.equal(await page.evaluate(() => guideMeta({ name: 'y', keys: [], n: 4, payload: { prog: [1] } }, 99).wk), 1);
  assert.equal(await page.evaluate(() => guideMeta({ name: 'y', keys: [], n: 4, payload: { tones: { 1: 2 } } }, 99).wk), 1);
  assert.equal(await page.evaluate(() => guideMeta({ name: 'y', keys: [], n: 4, payload: { prog: [] } }, 99).wk), undefined);
  assert.deepEqual(errors, []);
});

test('Larger text: Random’s rows keep their 44px and nothing runs off the screen', async () => {
  const { page, errors } = await openAtScale(1.3, { storage: ONB });
  await welcome(page, 'look');
  await idle(page);
  await page.click('#mCollection');
  await idle(page);
  await page.click('#mkDrawBtn');
  await idle(page);
  await draw(page, 2);
  for (const s of ['#rndBack', '#draw', '#swap', '#undo', '#reset', '#rndFreshWrap', '#remSum', '#useInGuide'])
    assert.ok((await rect(page, s)).height >= 44, s + ' ' + (await rect(page, s)).height);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'no sideways scroll');
  assert.deepEqual(errors, []);
});
