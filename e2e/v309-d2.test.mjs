// v309.1 (review 2): finding a set from a few caps. Copic caps from two sets offered "All Copic markers" (358) as "Is
// this your set?" whatever about how many said; a set further down with only some of the caps said "Also matches"; a
// Gray Tones set's strip was in no order of lightness.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, idle } from './helpers.mjs';

before(setup);
after(teardown);

const type = async (page, codes) => {
  for (const c of codes) {
    await page.fill('#scBox', c);
    await page.press('#scBox', 'Enter');
  }
};
async function find(page, brand, n, caps) {
  await page.click('#wcNotSure');
  await page.click(`#wcFBrand [data-b="${brand}"]`);
  await page.click(`#wcFCount [data-n="${n}"]`);
  await page.click('#wcFindNext');
  await idle(page);
  await type(page, caps);
}

test('Copic caps from two sets, up to 30: the closest set, not all 358; All Copic markers last, a tap away', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  // R29 and E00 are in Ciao 24, B000 isn't
  await find(page, 'Copic', 0, ['R29', 'E00', 'B000']);
  assert.match(await page.textContent('#scFind'), /^No set has all of these\./);
  await page.click('#scAdd');
  await idle(page);
  assert.equal(await page.textContent('#wcTR'), 'The closest set');
  assert.match(await page.textContent('#wcRes'), /^Has 2 of the 3 caps/);
  assert.doesNotMatch(await page.textContent('#wcFindYes'), /358/);
  const seen = [];
  for (let n = 0; n < 40; n++) {
    await page.click('#wcFindOther');
    const t = await page.innerText('#wcRes');
    seen.push(t.split('\n')[0] + ' / ' + t.split('\n')[1]);
    if (/Back to/.test(await page.textContent('#wcFindOther'))) break;
  }
  // further down, with only some of the caps: said so, not "Also matches"
  assert.ok(
    seen.slice(0, -1).every((s) => /^HAS [12] OF THE 3 CAPS/i.test(s)),
    seen.join('\n'),
  );
  assert.match(seen.at(-1), /^ALSO MATCHES \/ All Copic markers$/i, 'last, by its own name');
  // (v309.1: a set's size is its colours: Copic's Colorless Blender 0 is said beside them)
  assert.equal(await page.textContent('#wcFindYes'), 'Yes, add these 357 markers');
  assert.deepEqual(errors, []);
});

test('Copic, more than 250: All Copic markers is the best match', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await find(page, 'Copic', 5, ['R29', 'E00', 'B000']);
  assert.match(await page.textContent('#scFind'), /^Fits so far: All Copic markers\./);
  await page.click('#scAdd');
  await idle(page);
  assert.equal(await page.textContent('#wcTR'), 'Is this your set?');
  assert.match(await page.innerText('#wcRes'), /^BEST MATCH\nAll Copic markers\n357 markers and a Colorless Blender/i);
  assert.deepEqual(errors, []);
});

test('the strip: colours by hue, then the greys light to dark (a Gray Tones set reads as a ramp)', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  const caps = await page.evaluate(() =>
    presetMkeys(MARKER_SETS.find((p) => p.n === '36 Gray Tones'))
      .slice(0, 3)
      .map((k) => k.split('|')[1]),
  );
  await find(page, 'Ohuhu', 1, caps);
  await page.click('#scAdd');
  await idle(page);
  assert.match(await page.textContent('#wcRes'), /36 Gray Tones/);
  const greys = await page.$$eval('#wcRes .wcstrip i', (l) => {
    // (the swatch's colour back to its marker in the set)
    const set = presetMkeys(MARKER_SETS.find((p) => p.n === '36 Gray Tones')).map(keyIdx);
    const hex = (s) =>
      '#' +
      s
        .match(/\d+/g)
        .slice(0, 3)
        .map((n) => (+n).toString(16).padStart(2, '0'))
        .join('');
    return l
      .map((i) => set.find((k) => COLORS[k].hex.toLowerCase() === hex(i.style.backgroundColor)))
      .filter((i) => i != null && HS[i].c < 0.12)
      .map((i) => HS[i].l);
  });
  assert.ok(greys.length > 10, 'most of it grey: ' + greys.length);
  for (let j = 1; j < greys.length; j++) assert.ok(greys[j] <= greys[j - 1], 'light to dark at ' + j);
  assert.deepEqual(errors, []);
});
