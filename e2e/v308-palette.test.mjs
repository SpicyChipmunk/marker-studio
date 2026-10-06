// v308 Palette in the browser: Undo after trying sizes; Undo into a photo's palette; the first visit's preview after
// adding markers; the empty card when the filters leave nothing; a saved palette opening as its scheme, and asking
// before it replaces Custom picks; Save image and the card after a Library rename; Use in a guide without saving;
// "This photo has about N colours"; "Photo looks dim" on a dim photo, not a starry sky; Brands I'd buy with nothing
// owned; From photo in portrait keeps the palette's name, Save and Use in a guide on the first screen.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, idle, until, welcome, sampleGuide, libItem, ENGINE } from './helpers.mjs';

before(setup);
after(teardown);

const top = (page) => page.evaluate(() => (state.palettes[state.palettes.length - 1] || []).slice());
async function palScreen(page, h, n) {
  await page.click('#mPalette');
  await idle(page);
  await page.click(`#harm [data-h="${h}"]`);
  await idle(page);
  if (n) {
    await page.click(`#segs [data-n="${n}"]`);
    await idle(page);
  }
}
async function generate(page) {
  await page.click('#draw');
  await until(page, () => !rolling, null, 'the roll');
  await idle(page);
}
// a picture drawn in the page, as a PNG file for #photoFile
const pngOf = (page, draw, w = 240, h = 160) =>
  page
    .evaluate(
      ([src, w, h]) => {
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        new Function('g', 'w', 'h', src)(c.getContext('2d'), w, h);
        return c.toDataURL('image/png').split(',')[1];
      },
      [draw, w, h],
    )
    .then((b) => ({ name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from(b, 'base64') }));
async function choosePhoto(page, draw, w, h) {
  const n = await page.evaluate(() => state.palettes.length);
  await page.setInputFiles('#photoFile', await pngOf(page, draw, w, h));
  await until(
    page,
    (n) => state.palettes.length > n || !!document.querySelector('#photoWrap .errcard'),
    n,
    'the photo palette',
  );
  await idle(page);
}
// a sunset: violet to orange sky, a pale sun, dark hills
const SUNSET = `const s = g.createLinearGradient(0, 0, 0, h * 0.7); s.addColorStop(0, '#4a2c78'); s.addColorStop(0.35, '#a0326e');
  s.addColorStop(0.7, '#dc3c3c'); s.addColorStop(1, '#f58c3c'); g.fillStyle = s; g.fillRect(0, 0, w, h);
  g.fillStyle = '#ffe28c'; g.beginPath(); g.arc(w * 0.55, h * 0.62, h * 0.08, 0, 7); g.fill();
  g.fillStyle = '#261630'; g.fillRect(0, h * 0.68, w, h);`;

test('trying other sizes keeps the palette you made: Undo brings it back (it had been lost)', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await welcome(page, 'look');
  await palScreen(page, 'triadic', 4);
  await generate(page);
  await generate(page);
  const B = await top(page);
  await page.click('#segs [data-n="6"]');
  await idle(page);
  await page.click('#segs [data-n="3"]');
  await idle(page);
  assert.equal((await top(page)).length, 3);
  await page.click('#undo');
  await idle(page);
  assert.deepEqual(await top(page), B, 'B is back');
  assert.equal(await page.getAttribute('#segs [data-n="4"]', 'aria-pressed'), 'true');
  assert.deepEqual(errors, []);
});

test('Undo after From photo goes back to From photo, not a photo palette under another scheme’s name', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await welcome(page, 'look');
  await palScreen(page, 'photo');
  await choosePhoto(page, SUNSET);
  const P = await top(page);
  await page.click('#harm [data-h="complementary"]');
  await idle(page);
  await page.click('#undo');
  await idle(page);
  assert.deepEqual(await top(page), P);
  assert.equal(
    await page.getAttribute('#harm [data-h="photo"]', 'aria-pressed'),
    'true',
    'From photo chosen',
  );
  assert.equal(await page.textContent('#readout .fam'), 'From photo');
  assert.equal(await page.isVisible('#palClose'), false, 'no “stray from the scheme” line');
  assert.deepEqual(errors, []);
});

test('the first visit’s preview follows the markers you add (it kept showing ones you don’t own)', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await page.click('#wcSkip');
  await page.click('#wcLook').catch(() => {});
  await idle(page);
  await page.click('#mPalette');
  await idle(page);
  assert.equal(await page.evaluate(() => state.palettes.length), 0, 'a preview, not a palette of yours');
  await page.click('#mCollection');
  await idle(page);
  await page.evaluate(() => {
    presetMkeys(MARKER_SETS.find((s) => s.n === 'Honolulu 24')).forEach((k) => state.owned.add(k));
    save();
    fullRender();
  });
  await page.click('#mPalette');
  await idle(page);
  const shown = await page.evaluate(() => currentPaletteIdxs());
  assert.ok(shown.length > 0);
  assert.ok(await page.evaluate((p) => p.every((i) => isOwned(i)), shown), 'only markers you own');
  assert.deepEqual(errors, []);
});

test('filters that leave no marker: an empty card with Clear filters; Save and Use in a guide off', async () => {
  const { page, errors } = await openApp({ width: 1180, height: 820 });
  await welcome(page, 'look');
  await palScreen(page, 'complementary', 4);
  await generate(page);
  // (Fluorescent and Dark: no fluorescent is dark)
  await page.evaluate(() => {
    fgTap('fam', 'Fluorescent');
    fgTap('tone', 'dark');
    filterChanged();
  });
  assert.equal(await page.evaluate(() => COLORS.some((c, i) => inPool(i))), false, 'none in play');
  await idle(page);
  await page.click('#harm [data-h="rainbow"]');
  await idle(page);
  assert.equal(await page.isVisible('#palNone'), true);
  assert.equal(
    (await page.textContent('#palNone')).replace(/\s+/g, ' '),
    'No markers match these filters · Clear filters',
  );
  assert.equal(await page.locator('#bands .band').count(), 0, 'not the last palette');
  assert.equal(await page.isDisabled('#saveBtn'), true);
  assert.equal(await page.isVisible('#useInGuide'), false);
  assert.equal(
    await page.evaluate(() => document.getElementById('msToast')?.classList.contains('on') || false),
    false,
    'no “try fewer colours”',
  );
  await page.click('#palNoneClear');
  await idle(page);
  assert.equal(await page.isVisible('#palNone'), false);
  assert.ok((await page.locator('#bands .band').count()) >= 6, 'a Rainbow');
  assert.equal(await page.isDisabled('#saveBtn'), false);
  assert.deepEqual(errors, []);
});

test('a saved palette opens as its own scheme; Undo goes back; Custom picks in progress are asked about first', async () => {
  const { page, errors } = await openApp({ width: 1180, height: 820 });
  await welcome(page, 'look');
  await palScreen(page, 'tetradic', 8);
  await generate(page);
  const T = await top(page);
  await page.click('#saveBtn');
  await idle(page, 1500);
  const id = await page.evaluate(() => state.saved[0].id);
  assert.equal(await page.evaluate(() => state.saved[0].h), 'tetradic');
  await palScreen(page, 'mono', 4);
  await generate(page);
  await page.click('#libMore');
  await page.click('#savedBtn');
  await page.click(`#savedList .srow[data-id="${id}"] .sopen`);
  await idle(page);
  assert.equal(
    await page.getAttribute('#harm [data-h="tetradic"]', 'aria-pressed'),
    'true',
    'opened as Tetradic',
  );
  assert.deepEqual(await top(page), T);
  assert.equal(await page.textContent('#readout .fam'), 'Tetradic');
  await page.click('#undo');
  await idle(page);
  assert.equal(
    await page.getAttribute('#harm [data-h="mono"]', 'aria-pressed'),
    'true',
    'Undo: the Monochrome',
  );
  // Custom picks in progress
  await page.click('#harm [data-h="custom"]');
  await idle(page);
  await page.evaluate(() => {
    state.customPal = COLORS.map((c, i) => i)
      .filter((i) => inPool(i))
      .slice(0, 2)
      .concat([null, null]);
    state.palSize = 4;
    save();
    fullRender();
  });
  const picks = await page.evaluate(() => state.customPal.slice());
  await page.evaluate(() => {
    state.saved.push({
      id: 42,
      type: 'palette',
      name: 'Old one',
      keys: COLORS.map((c, i) => i)
        .filter((i) => inPool(i))
        .slice(50, 55)
        .map(mkey),
      ts: 42,
    });
    save();
  });
  await page.click('#libMore');
  await page.click('#savedBtn');
  await page.click('#savedList .srow[data-id="42"] .sopen');
  await page.waitForSelector('#sfEdAsk');
  assert.equal(await page.textContent('#sfEdAskT'), 'Replace your Custom picks?');
  await page.click('#sfEdAsk [data-a="stay"]');
  await idle(page);
  assert.deepEqual(await page.evaluate(() => state.customPal.slice()), picks, 'kept');
  await page.click('#savedList .srow[data-id="42"] .sopen');
  await page.click('#sfEdAsk [data-a="go"]');
  await idle(page);
  assert.equal(await page.evaluate(() => state.customPal.filter((x) => x != null).length), 5);
  assert.deepEqual(errors, []);
});

test('Save image: the palette’s own name as its title and the scheme under it; a Library rename shows on the card', async () => {
  const { page, errors } = await openApp({
    width: 1180,
    height: 820,
    init: () => {
      window.__texts = [];
      const f = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function (t, ...r) {
        window.__texts.push(String(t));
        return f.call(this, t, ...r);
      };
    },
  });
  await welcome(page, 'look');
  await palScreen(page, 'triadic', 6);
  await generate(page);
  await page.click('#saveBtn');
  await idle(page, 1500);
  const id = await page.evaluate(() => state.saved[0].id);
  await page.click('#libMore');
  await page.click('#savedBtn');
  await libItem(page, `#savedList .srow[data-id="${id}"]`, 'sren');
  await page.fill('#savedList .sname-in', 'My flowers');
  await page.press('#savedList .sname-in', 'Enter');
  await idle(page);
  await page.click('#savedClose');
  await idle(page);
  assert.equal(await page.textContent('#readout .name'), 'My flowers', 'the card has the new name');
  await page.evaluate(() => (window.__texts = []));
  await page.click('#libMore');
  await page.click('#exportBtn');
  await until(page, () => window.__texts.includes('My flowers'), null, 'the card drawn');
  const texts = await page.evaluate(() => window.__texts);
  assert.ok(texts.includes('My flowers'), 'title');
  assert.ok(
    texts.some((t) => /^Triadic · 6 colours/.test(t)),
    'scheme beneath: ' + texts.slice(0, 4).join(' | '),
  );
  assert.ok(!texts.includes('Triadic palette'));
  assert.deepEqual(errors, []);
});

test('Use in a guide: the guide uses the palette and the Library stays as it was', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await palScreen(page, 'split', 5);
  await generate(page);
  const keys = await page.evaluate(() => currentPaletteIdxs().map(mkey));
  await page.click('#useInGuide');
  await page.click('#sfEdAsk [data-a="recolour"]');
  await page.waitForFunction(() => __mstest.styleVars.paletteSource === 'generate');
  await idle(page);
  assert.deepEqual(
    await page.evaluate(() => __mstest.styleVars.genPal.slice()),
    keys,
    'the palette’s markers',
  );
  assert.equal(await page.evaluate(() => __mstest.styleVars.genHarmony), 'split');
  assert.equal(
    await page.evaluate(() => state.saved.filter((s) => s.type === 'palette').length),
    0,
    'nothing saved',
  );
  // with no guide open: held for the next one, shown on Home, still not saved
  const b = await openApp();
  await welcome(b.page, 'look');
  await palScreen(b.page, 'analogous', 4);
  await generate(b.page);
  await b.page.click('#useInGuide');
  await b.page.click('#mHome');
  await idle(b.page);
  assert.match(await b.page.textContent('#homePalNote'), /^Using “.+”4 markers · for your next new guide$/);
  assert.equal(await b.page.evaluate(() => state.saved.filter((s) => s.type === 'palette').length), 0);
  assert.deepEqual(errors, []);
  assert.deepEqual(b.errors, []);
});

test('From photo: a photo of three colours says so instead of making colours up; its bands in hue order', async () => {
  const { page, errors } = await openApp({ width: 1180, height: 820 });
  await welcome(page, 'look');
  await page.evaluate(() => {
    state.owned = new Set(presetMkeys(MARKER_SETS.find((s) => s.n === 'Honolulu 24')));
    save();
  });
  await palScreen(page, 'photo');
  await choosePhoto(
    page,
    `g.fillStyle = '#c82832'; g.fillRect(0, 0, w / 3, h); g.fillStyle = '#3c9646'; g.fillRect(w / 3, 0, w / 3, h);
    g.fillStyle = '#2850b4'; g.fillRect(2 * w / 3, 0, w, h);`,
  );
  await page.click('#photoSize [data-n="16"]');
  await idle(page);
  const n = (await top(page)).length;
  assert.ok(n >= 3 && n < 16, n + '');
  assert.equal(await page.textContent('#photoNote'), `This photo has about ${n} colours`);
  assert.deepEqual(errors, []);
});

test('“Photo looks dim” is offered on a photo taken in the dark, not on a starry sky', async () => {
  const { page, errors } = await openApp({ width: 1180, height: 820 });
  await welcome(page, 'look');
  await palScreen(page, 'photo');
  await choosePhoto(
    page,
    `g.fillStyle = '#000003'; g.fillRect(0, 0, w, h); let s = 7; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
     for (let k = 0; k < 900; k++) { const v = 110 + Math.floor(r() * 70); g.fillStyle = 'rgb(' + v + ',' + v + ',' + (v + 6) + ')'; g.fillRect(Math.floor(r() * w), Math.floor(r() * h), 1, 1); }`,
  );
  assert.equal(await page.isVisible('#photoWarm'), false, 'not for space');
  await choosePhoto(
    page,
    `g.fillStyle = '#212329'; g.fillRect(0, 0, w, h * 0.42); g.fillStyle = '#1d2a19'; g.fillRect(0, h * 0.42, w, h);
     g.fillStyle = '#4b4b4a'; g.fillRect(w * 0.38, h * 0.33, w * 0.31, h * 0.42); g.fillStyle = '#331310'; g.fillRect(w * 0.47, h * 0.5, w * 0.12, h * 0.25);`,
  );
  assert.equal(await page.isVisible('#photoWarm'), true, 'offered');
  assert.equal(await page.textContent('#photoWarm'), 'Photo looks dim · Balance it');
  assert.deepEqual(errors, []);
});

test('Brands I’d buy “Only Copic” with nothing owned: Palette says so and uses only Copic', async () => {
  const { page, errors } = await openApp({ width: 1180, height: 820 });
  await page.click('#wcSkip');
  await page.click('#wcLook').catch(() => {});
  await idle(page);
  await page.evaluate(() => {
    state.buyBrands = ['Copic'];
    save();
  });
  await palScreen(page, 'complementary', 6);
  await generate(page);
  assert.match(await page.textContent('#emptyOwned'), /^Using every Copic marker\./);
  assert.deepEqual(
    await page.evaluate(() => [...new Set(currentPaletteIdxs().map((i) => COLORS[i].brand))]),
    ['Copic'],
  );
  assert.deepEqual(errors, []);
});

test('From photo held upright on an iPad: the palette’s name, Save and Use in a guide on the first screen', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await welcome(page, 'look');
  await palScreen(page, 'photo');
  await choosePhoto(page, SUNSET, 900, 600);
  await page.evaluate(() => scrollTo(0, 0));
  await idle(page);
  for (const sel of ['#readout .name', '#saveBtn', '#useInGuide']) {
    const b = await page.locator(sel).boundingBox();
    assert.ok(b && b.y + b.height <= 1180, sel + ' at ' + (b && Math.round(b.y + b.height)));
  }
  // the photo beside its controls
  const th = await page.locator('#photoThumb').boundingBox(),
    sz = await page.locator('#photoSize').boundingBox();
  assert.ok(sz.x > th.x + th.width, 'the Colours row beside the photo');
  // sideways, the photo still sits over its controls in the settings column
  await page.setViewportSize({ width: 1180, height: 820 });
  await idle(page);
  const th2 = await page.locator('#photoThumb').boundingBox(),
    sz2 = await page.locator('#photoSize').boundingBox();
  assert.ok(sz2.y > th2.y + th2.height - 1, 'under the photo beside the palette');
  assert.deepEqual(errors, [], ENGINE);
});
