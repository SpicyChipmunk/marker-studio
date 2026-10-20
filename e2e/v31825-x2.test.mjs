// v318.25 in the browser (deep debugging pass, step 2).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, idle, welcome } from './helpers.mjs';

before(setup);
after(teardown);

// ---- X2: Palette (reviewer C's C2, C3, C8) ----

async function palettePage(owned) {
  const { page, errors } = await openApp();
  await welcome(page, 'look');
  await page.evaluate((o) => {
    state.owned = new Set(o);
    state.ink = {};
    save();
  }, owned);
  await page.click('#mPalette');
  await idle(page);
  return { page, errors };
}

test('X2 C3: a scheme’s palette marks a marker since marked dry, as Custom does', async () => {
  const { page, errors } = await palettePage([]);
  await page.evaluate(() => {
    presetMkeys(MARKER_SETS.find((s) => s.n === 'Honolulu 120')).forEach((k) => state.owned.add(k));
    save();
    fullRender();
  });
  await page.click('#harm button[data-h="complementary"]');
  await idle(page);
  await page.click('#draw');
  await idle(page, 1500);
  // the first colour marked dry (in Markers), then back on the Palette screen: the palette stays (v310.2)
  const k = await page.evaluate(() => {
    const k = mkey(state.palettes[state.palettes.length - 1][0]);
    state.ink[k] = 'dry';
    save();
    fullRender();
    return k;
  });
  await idle(page);
  const r = await page.evaluate(() => {
    const b = [...document.querySelectorAll('#bands .band')];
    return {
      warn: b.map((x) => !!x.querySelector('.uwarn')),
      title: b[0].title,
      sub: document.querySelector('#readout .fam').textContent,
      // the sign clear of the lock
      apart: (() => {
        const w = b[0].querySelector('.uwarn').getBoundingClientRect(),
          l = b[0].querySelector('.blk').getBoundingClientRect();
        return w.bottom <= l.top || w.top >= l.bottom || w.right <= l.left || w.left >= l.right;
      })(),
    };
  });
  assert.deepEqual(
    r.warn,
    r.warn.map((_, i) => i === 0),
    'only the dry one: ' + k,
  );
  assert.match(r.title, /^Marked dry · /);
  assert.match(r.sub, / · 1 not in play$/);
  assert.ok(r.apart, 'the sign and the lock don’t overlap');
  // a tap on the band for another like it takes the sign off with the marker
  await page.click('#bands .band:first-child .bhit');
  await idle(page, 1500);
  assert.equal(await page.evaluate(() => !!document.querySelector('#bands .band:first-child .uwarn')), false);
  assert.deepEqual(errors, []);
  await page.close();
});

test('X2 C2: Undo shows in From photo while a scheme’s palette is before it', async () => {
  const { page, errors } = await palettePage([
    'Copic|R27',
    'Copic|G07',
    'Copic|B29',
    'Copic|Y08',
    'Copic|V09',
  ]);
  await page.click('#harm button[data-h="complementary"]');
  await idle(page);
  await page.click('#draw');
  await idle(page, 1500);
  const before = await page.evaluate(() => state.palettes[state.palettes.length - 1].map(mkey).join());
  // a photo's palette on top, as From photo leaves it
  await page.evaluate(() => {
    _photoImg = { width: 10, height: 10 };
    state.harmony = 'photo';
    palPush(state.palettes[state.palettes.length - 1].slice().reverse(), 20);
    save();
    fullRender();
  });
  await idle(page);
  assert.equal(await page.isVisible('#undo'), true);
  assert.equal(await page.isEnabled('#undo'), true);
  await page.click('#undo');
  await idle(page);
  assert.deepEqual(
    await page.evaluate(() => [state.harmony, state.palettes[state.palettes.length - 1].map(mkey).join()]),
    ['complementary', before],
  );
  assert.deepEqual(errors, []);
  await page.close();
});

test('X2 C8: Monochrome from a base says the base comes first', async () => {
  const { page, errors } = await palettePage([]);
  await page.evaluate(() => {
    presetMkeys(MARKER_SETS.find((s) => s.n === 'Honolulu 120')).forEach((k) => state.owned.add(k));
    save();
    fullRender();
  });
  await page.click('#harm button[data-h="mono"]');
  await idle(page);
  await page.click('#draw');
  await idle(page, 1500);
  assert.equal(await page.textContent('#harmDesc'), 'One colour, light to dark');
  // from a mid-light marker of its own: it's first, the rest light to dark
  await page.evaluate(() => {
    const p = state.palettes[state.palettes.length - 1];
    state.seed = mkey(p[Math.floor(p.length / 2)]);
    save();
    doGenerate();
  });
  await idle(page, 1500);
  const r = await page.evaluate(() => {
    const p = state.palettes[state.palettes.length - 1];
    return {
      first: mkey(p[0]) === state.seed,
      rest: p.slice(1).map((i) => LCH[i][0]),
      desc: harmDesc.textContent,
    };
  });
  assert.ok(r.first);
  assert.deepEqual(
    r.rest,
    r.rest.slice().sort((a, b) => b - a),
  );
  assert.equal(r.desc, 'One colour: your base first, then light to dark');
  assert.deepEqual(errors, []);
  await page.close();
});
