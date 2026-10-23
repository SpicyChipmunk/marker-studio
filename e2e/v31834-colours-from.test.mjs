// v318.34 Stage 3 F: Colours from is Your markers | A palette. "A palette" is whatever palette the guide holds, shown
// on a card (swatches, name, count, scheme, where from: Made here / From Palette / From your Library) with ✕ back to
// your markers; under it New palette with the harmony select, Change it in Palette › (the Palette screen, and Use in
// a guide › Recolour brings it back), Choose a saved palette ▾ and Save to Library. Choosing a saved palette copies
// its keys into the guide (genPal, fromPal.from 'library') and keeps savedPalId as the link, so a palette deleted
// from the Library changes nothing; an older guide whose palette is gone reads "Palette deleted · Choose another".
// A palette used as it is caps the count: "A palette of 8: tick Expand for more". Surprise keeps a palette you
// chose and says "Kept your palette". Before: Owned | Saved palette | Generate palette, a handed-over palette lit
// "Generate palette" with no swatches, and Surprise set a saved palette aside without a word (G5, P2-10, U1-5).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, idle, until, sampleGuide, answerAsks } from './helpers.mjs';

before(setup);
after(teardown);

const sv = (page) =>
  page.evaluate(() => {
    const s = __mstest.styleVars;
    return {
      src: s.paletteSource,
      savedPalId: s.savedPalId,
      genPal: s.genPal.slice(),
      fromPal: s.fromPal && { ...s.fromPal },
      genHarmony: s.genHarmony,
      expand: s.expand,
      limitN: s.limitN,
    };
  });
const pageKeys = (page) =>
  page.evaluate(() => [...new Set(Object.values(__mstest.assignData.assign).map((a) => a.mkey))].sort());
const card = (page) =>
  page.evaluate(() => {
    const c = document.getElementById('sfPalCard');
    if (!c) return null;
    return {
      name: c.querySelector('.sfpntx b').textContent,
      line: c.querySelector('.sfpntx span').textContent,
      swatches: c.querySelectorAll('.sstrip span').length,
      gone: c.classList.contains('sfpalgone'),
    };
  });
const segs = (page) =>
  page.$$eval('#sfSrc button', (bs) =>
    bs.map((b) => [b.dataset.v, b.textContent.trim(), b.getAttribute('aria-pressed')]),
  );
const has = (page, sel) => page.evaluate((sel) => !!document.querySelector(sel), sel);
const text = (page, sel) =>
  page.evaluate((sel) => (document.querySelector(sel) || {}).textContent || '', sel);
const toastText = (page) =>
  page.evaluate(() => (document.querySelector('#msToast.on') || {}).textContent || '');
const undoLabel = (page) => page.evaluate(() => (document.getElementById('sfPlanUndo') || {}).title || '');
const addSaved = (page, id, name, n) =>
  page.evaluate(
    ([id, name, n]) => {
      state.saved.unshift({
        id,
        type: 'palette',
        name,
        h: 'triadic',
        keys: [...state.owned].slice(0, n),
        ts: id,
      });
      save();
    },
    [id, name, n],
  );

test('the two segments; A palette makes one here (the card: Made here, the harmony name, the cap note), ✕ goes back to your markers and A palette brings the same palette back', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  assert.deepEqual(await segs(page), [
    ['owned', 'Your markers', 'true'],
    ['palette', 'A palette', 'false'],
  ]);
  assert.equal(await card(page), null, 'no card under Your markers');
  await page.click('#sfSrc [data-v="palette"]');
  await idle(page);
  let s = await sv(page);
  assert.equal(s.src, 'generate');
  assert.ok(s.genPal.length >= 3, 'a palette was made: ' + s.genPal.length);
  assert.equal(s.fromPal, null);
  const c = await card(page);
  assert.equal(c.name, 'Analogous');
  assert.match(c.line, /^\d+ markers · Made here$/);
  assert.equal(c.swatches, s.genPal.length);
  assert.equal(await page.$eval('#sfSrc [data-v="palette"]', (b) => b.getAttribute('aria-pressed')), 'true');
  // the cap note: the guide had asked for more markers than the palette holds, Expand off
  assert.ok(s.limitN > s.genPal.length && !s.expand);
  assert.equal(await text(page, '#sfPalCap'), 'A palette of ' + s.genPal.length + ': tick Expand for more.');
  assert.equal(await page.$eval('#sfHarm', (el) => el.value), 'analogous');
  for (const id of ['sfGenNew', 'sfPalEdit', 'sfPalSave']) assert.ok(await has(page, '#' + id), id);
  assert.ok(!(await has(page, '#sfPalPick')), 'no saved palettes: no picker');
  assert.match(await text(page, '#sfPalNone'), /No saved palettes yet/);
  assert.match(await undoLabel(page), /Colours from: A palette/);
  const keys = s.genPal.slice();
  // Expand on: the cap note goes
  await page.click('#sfExpand');
  await idle(page);
  assert.ok(!(await has(page, '#sfPalCap')));
  await page.click('#sfPalOff');
  await idle(page);
  s = await sv(page);
  assert.equal(s.src, 'owned');
  assert.equal(await card(page), null);
  assert.deepEqual(s.genPal, keys, 'the palette is kept');
  assert.match(await undoLabel(page), /Colours from: Your markers/);
  await page.click('#sfSrc [data-v="palette"]');
  await idle(page);
  s = await sv(page);
  assert.equal(s.src, 'generate');
  assert.deepEqual(s.genPal, keys, 'the same palette again');
  // New palette: another, of the harmony chosen
  await page.selectOption('#sfHarm', 'triadic');
  await idle(page);
  s = await sv(page);
  assert.equal(s.genHarmony, 'triadic');
  assert.equal((await card(page)).name, 'Triadic');
  const tri = s.genPal.slice();
  await page.click('#sfGenNew');
  await idle(page);
  s = await sv(page);
  assert.equal(s.genHarmony, 'triadic');
  assert.notDeepEqual(s.genPal, tri, 'New palette made another');
  assert.deepEqual(errors, []);
  await page.context().close();
});

test('a saved palette chosen: its keys are copied into the guide (From your Library), the Library palette deleted changes nothing; Undo labels', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await addSaved(page, 777001, 'Clementine', 5);
  await page.click('#sfSrc [data-v="palette"]');
  await idle(page);
  assert.ok(await has(page, '#sfPalPick'));
  assert.equal(await page.$eval('#sfPalPick', (el) => el.value), '', 'the placeholder, none chosen');
  await page.selectOption('#sfPalPick', '777001');
  await idle(page);
  let s = await sv(page);
  const want = await page.evaluate(() => [...state.owned].slice(0, 5));
  assert.equal(s.src, 'saved');
  assert.equal(s.savedPalId, 777001);
  assert.deepEqual(s.genPal, want, 'the keys copied in');
  assert.deepEqual(s.fromPal, { name: 'Clementine', h: 'triadic', from: 'library' });
  let c = await card(page);
  assert.equal(c.name, 'Clementine');
  assert.equal(c.line, '5 markers · Triadic · From your Library');
  assert.ok(!(await has(page, '#sfPalSave')), 'in the Library already: no Save to Library');
  assert.match(await undoLabel(page), /Palette: Clementine/);
  const laid = await pageKeys(page);
  assert.ok(
    laid.every((k) => want.includes(k)),
    'laid from the palette: ' + laid.join(),
  );
  // the Library palette deleted: the guide keeps its colours and its card
  await page.evaluate(() => {
    state.saved = state.saved.filter((x) => x.id !== 777001);
    save();
  });
  await page.click('#sfExpand');
  await idle(page);
  await page.click('#sfExpand');
  await idle(page);
  s = await sv(page);
  assert.equal(s.src, 'saved');
  assert.deepEqual(s.genPal, want);
  c = await card(page);
  assert.equal(c.name, 'Clementine');
  assert.equal(c.gone, false);
  assert.deepEqual(await pageKeys(page), laid, 'laid the same');
  // saved and reopened after a reload: still so
  await page.evaluate(() => __mstest.saveNow());
  await page.waitForFunction(() => __mstest.inLibrary);
  const id = await page.evaluate(() => __mstest.curId);
  await page.reload();
  await idle(page);
  await page.evaluate((id) => loadGuide({ id }), id);
  await page.waitForFunction((id) => __mstest.curId === id && __mstest.assignData, id, { timeout: 10000 });
  await idle(page);
  s = await sv(page);
  assert.deepEqual(
    [s.src, s.savedPalId, s.genPal, s.fromPal],
    ['saved', 777001, want, { name: 'Clementine', h: 'triadic', from: 'library' }],
  );
  // (v318.37: the Library palette was deleted above, so the card says so and offers Save to Library again, X3-6)
  assert.equal((await card(page)).line, '5 markers · Triadic · From your Library (deleted)');
  assert.ok(await has(page, '#sfPalSave'), 'Save to Library offered again');
  // New palette in its place: an Undo step of its own
  await page.click('#sfGenNew');
  await idle(page);
  s = await sv(page);
  assert.equal(s.src, 'generate');
  assert.equal(s.fromPal, null);
  assert.match(await undoLabel(page), /New palette/);
  assert.deepEqual(errors, []);
  await page.context().close();
});

test('an older guide whose saved palette is gone: "Palette deleted · Choose another", your markers until one is chosen', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  // an older guide: paletteSource saved, savedPalId only (no keys copied in), the palette no longer in the Library
  await page.evaluate(() => {
    const d = __mstest.currentDesignObj(),
      p = d.payload;
    p.style.paletteSource = 'saved';
    p.style.savedPalId = 4242;
    delete p.style.fromPal;
    p.style.genPal = [];
    __mstest.openDesignObj(Object.assign({}, p, { name: 'Older', W: d.W, H: d.H }), null);
  });
  await page.waitForFunction(() => __mstest.curName === 'Older' && __mstest.assignData);
  await idle(page);
  let c = await card(page);
  assert.equal(c.gone, true);
  assert.equal(c.name, 'Palette deleted');
  assert.equal(c.line, 'Choose another');
  assert.equal(c.swatches, 0);
  assert.ok(
    !(await has(page, '#sfPalEdit')) && !(await has(page, '#sfPalSave')),
    'nothing to change or save',
  );
  assert.ok(await has(page, '#sfGenNew'));
  // a saved one chosen: copied in, as any
  await addSaved(page, 777002, 'Marigold', 4);
  await page.evaluate(() => __mstest.renderControls());
  await idle(page);
  await page.selectOption('#sfPalPick', '777002');
  await idle(page);
  const s = await sv(page);
  assert.equal(s.savedPalId, 777002);
  assert.equal(s.genPal.length, 4);
  assert.deepEqual(s.fromPal, { name: 'Marigold', h: 'triadic', from: 'library' });
  c = await card(page);
  assert.equal(c.gone, false);
  assert.equal(c.name, 'Marigold');
  assert.deepEqual(errors, []);
  await page.context().close();
});

test('Save to Library saves the palette on the card (named, with its scheme) and links the guide to it; Change it in Palette opens it on the Palette screen and Use in a guide › Recolour brings it back', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await page.click('#sfSrc [data-v="palette"]');
  await idle(page);
  await page.selectOption('#sfHarm', 'complementary');
  await idle(page);
  const made = (await sv(page)).genPal.slice();
  const laid = await pageKeys(page);
  await page.click('#sfPalSave');
  await idle(page);
  const lib = await page.evaluate(() =>
    state.saved
      .filter((x) => x.type === 'palette')
      .map((x) => ({ id: x.id, keys: x.keys, h: x.h, name: x.name })),
  );
  assert.equal(lib.length, 1);
  assert.deepEqual(lib[0].keys, made);
  assert.equal(lib[0].h, 'complementary');
  assert.ok(lib[0].name, 'named');
  let s = await sv(page);
  assert.equal(s.src, 'saved');
  assert.equal(s.savedPalId, lib[0].id);
  assert.deepEqual(s.fromPal, { name: lib[0].name, h: 'complementary', from: 'library' });
  assert.match(await toastText(page), /Saved to your Library as/);
  assert.deepEqual(await pageKeys(page), laid, 'the page is as it was');
  const c = await card(page);
  assert.equal(c.name, lib[0].name);
  assert.equal(c.line, made.length + ' markers · Complementary · From your Library');
  assert.ok(!(await has(page, '#sfPalSave')), 'saved: the button goes');
  // Change it in Palette: the Palette screen, this palette as its own scheme
  await page.click('#sfPalEdit');
  await idle(page);
  assert.equal(await page.evaluate(() => state.mode), 'palette');
  assert.equal(await page.evaluate(() => state.harmony), 'complementary');
  assert.deepEqual(await page.evaluate(() => currentPaletteIdxs().map(mkey)), made);
  // re-roll one band there, then Use in a guide › Recolour: the guide takes the changed palette, as handed over
  await page.click('#draw');
  await until(page, () => !rolling, null, 'the roll');
  await idle(page);
  const changed = await page.evaluate(() => currentPaletteIdxs().map(mkey));
  await page.click('#useInGuide');
  await page.click('#sfEdAsk [data-a="recolour"]');
  await page.waitForFunction((k) => __mstest.styleVars.genPal.join() === k, changed.join());
  await idle(page);
  s = await sv(page);
  assert.equal(await page.evaluate(() => state.mode), 'sections');
  assert.equal(s.src, 'generate');
  assert.equal(s.fromPal.from, undefined);
  assert.match((await card(page)).line, /From Palette$/);
  assert.deepEqual(errors, []);
  await page.context().close();
});

test('Surprise with a palette you chose keeps it and surprises the rest; the toast says so; Undo as today', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await addSaved(page, 777003, 'Rosehip', 4);
  await page.click('#sfSrc [data-v="palette"]');
  await idle(page);
  await page.selectOption('#sfPalPick', '777003');
  await idle(page);
  const before = await sv(page),
    laid = await pageKeys(page);
  const want = await page.evaluate(() => [...state.owned].slice(0, 4));
  assert.deepEqual(
    laid,
    want.filter((k) => laid.includes(k)),
  );
  await page.click('#sfSurprise');
  await answerAsks(page);
  await idle(page);
  const s = await sv(page);
  assert.equal(s.src, 'saved');
  assert.deepEqual(s.genPal, before.genPal);
  assert.deepEqual(s.fromPal, before.fromPal);
  assert.equal(s.expand, before.expand, 'Expand left');
  const after = await pageKeys(page);
  assert.ok(
    after.every((k) => want.includes(k)),
    'still the palette: ' + after.join(),
  );
  assert.match(await toastText(page), /^Surprise: Kept your palette · /);
  assert.match(await undoLabel(page), /Surprise: Kept your palette/);
  assert.equal((await card(page)).name, 'Rosehip');
  // a palette made here is Surprise's own, made again as before
  await page.click('#sfGenNew');
  await idle(page);
  const made = (await sv(page)).genPal.slice();
  await page.click('#sfSurprise');
  await answerAsks(page);
  await idle(page);
  const s2 = await sv(page);
  assert.equal(s2.src, 'generate');
  assert.notDeepEqual(s2.genPal, made);
  assert.doesNotMatch(await toastText(page), /Kept your palette/);
  assert.deepEqual(errors, []);
  await page.context().close();
});
