// The Palette screen: harmonies, locks, sizes, saving, Use in a guide.
// (v320) Tests organised by feature: each block below came from the file named above it, its tests unchanged.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ENGINE,
  ROOT,
  WK,
  answerAsks,
  buildGo,
  haveSet,
  idle,
  letterGuide,
  libItem,
  notOnWebKit,
  openApp,
  sampleGuide,
  saveGuide,
  scanFromMarkers,
  scrollTop,
  sectionPoint,
  setup,
  teardown,
  until,
  welcome,
} from './helpers.mjs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

before(setup);
after(teardown);

// ---- from v289.test.mjs ----
// v289: fixes from the fresh-eyes review of v288 — ← Plan › Discard of edits brought back by Resume, a palette held for
// the next guide and a photo that won't open, section edits beyond Undo, Use in a guide › Recolour from Colour along,
// Change colour after an iPad turns, a backup restored over a guide deleted while open, Generate keeping the keyboard,
// Edit sections' tools on a phone's first screen, the guide saved at once on leaving it, focus after Change colour.
{
  const tickN = (page, n, from = 0) =>
    page.evaluate(
      ([n, from]) => {
        const t = __mstest;
        t.assignData.order.slice(from, from + n).forEach((l) => {
          t.colored[l] = 1;
        });
        t.guideDirty = true;
        t.renderGuide();
      },
      [n, from],
    );
  test('Use in a guide › New guide with it, then a file that won’t open: the open guide keeps its own palette', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    const src0 = await page.evaluate(() => __mstest.styleVars.paletteSource);
    await page.click('#mPalette');
    await page.click('#draw');
    await idle(page);
    await page.click('#useInGuide');
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#sfEdAsk [data-a="new"]')]);
    await fc.setFiles({ name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('not a picture') });
    await idle(page, 1500);
    assert.equal(await page.evaluate(() => __mstest.styleVars.paletteSource), src0, 'still its own');
    // and the palette still waits for the next new guide, shown on Home
    await page.click('#mHome');
    await idle(page);
    assert.match(await page.textContent('#homePalNote'), /for your next new guide/);
    assert.deepEqual(errors, []);
  });
  test('Palette › Use in a guide › Recolour from Colour along: back to the Plan and laid with the palette; with section edits it waits', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await page.click('#sfColor');
    await idle(page);
    await tickN(page, 3);
    await page.click('#mPalette');
    await page.click('#draw');
    await idle(page);
    const pal = await page.evaluate(() => currentPaletteIdxs().map(mkey));
    await page.click('#useInGuide');
    await page.click('#sfEdAsk [data-a="recolour"]');
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.sfmode), 'guide', 'in the Plan');
    const used = await page.evaluate(() => [
      ...new Set(Object.values(__mstest.assignData.assign).map((m) => m.mkey)),
    ]);
    assert.ok(
      used.some((k) => pal.includes(k)),
      'laid with the palette',
    );
    // (v308: the palette isn't saved to the Library for it; the plan keeps it as handed over, and the toast offers Undo)
    assert.match(
      await page.textContent('#msToast'),
      /Recoloured the guide with this palette|Palette: .+Undo/,
    );
    // with section edits not built: nothing changes, and it says why
    await page.click('#sfBack2');
    await idle(page);
    await page.evaluate(() => {
      const t = __mstest,
        l = t.assignData.order[4];
      t.secState[l] = 2;
      t.render();
    });
    await idle(page);
    const src = await page.evaluate(() => [__mstest.styleVars.paletteSource, __mstest.sfmode]);
    await page.click('#mPalette');
    await page.click('#draw');
    await idle(page);
    await page.click('#useInGuide');
    await page.click('#sfEdAsk [data-a="recolour"]');
    await idle(page);
    assert.match(await page.textContent('#msToast'), /Build again or discard your section edits first/);
    assert.deepEqual(await page.evaluate(() => [__mstest.styleVars.paletteSource, __mstest.sfmode]), src);
    assert.deepEqual(errors, []);
  });
  test('Generate palette and Draw a marker by keyboard: the focus stays on the button', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await page.click('#mPalette');
    await idle(page);
    await page.focus('#draw');
    await page.keyboard.press('Enter');
    await idle(page, 1200);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'draw');
    await page.keyboard.press(' ');
    await idle(page, 1200);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'draw');
    assert.deepEqual(errors, []);
  });
  test('Palette: a Saved palettes link at the top opens the Library with palettes first; Custom and Photo on a row of their own', async () => {
    const { page, errors } = await openApp();
    await welcome(page, 'look');
    await idle(page);
    await page.click('#mPalette');
    await idle(page);
    assert.equal(await page.isVisible('#palSaved'), false, 'nothing saved: no link');
    assert.equal((await page.textContent('#seedWrap .szlbl')).trim(), 'Start from');
    const row = (h) => page.$eval(`#harm [data-h="${h}"]`, (b) => b.getBoundingClientRect().top);
    assert.ok((await row('custom')) > (await row('mono')), 'Custom starts a row');
    assert.equal(await row('custom'), await row('photo'), 'Photo beside it');
    await page.click('#draw');
    await idle(page);
    await page.click('#saveBtn');
    await idle(page);
    assert.equal(await page.isVisible('#palSaved'), true);
    assert.match(await page.textContent('#palSaved'), /^Saved palettes \(1\)/);
    assert.ok((await page.$eval('#palSaved', (b) => b.getBoundingClientRect().height)) >= 44, '44px to tap');
    await page.click('#palSaved');
    await idle(page);
    assert.equal(await page.isVisible('#savedOverlay'), true);
    assert.equal(
      await page.getAttribute('#savedList .stile', 'class').then((c) => /spalette|sdraw/.test(c)),
      true,
      'a palette first',
    );
    assert.deepEqual(errors, []);
  });
}

// ---- from v299.test.mjs ----
// v299: fixes from the third fresh-eyes review — two of v298's own fixes put right (section edits from an earlier visit
// kept; Undo of a merge after a build gives the ticks back); a split-off coloured part keeps its marker and zone; the
// copy kept as the page goes works for edited guides; changes that couldn't be saved open instead of the older copy;
// Undo for Mark all coloured, Focus's Mark all done and a palette colour re-rolled; an old guide using Copic 0; and
// Scan's paste, typing and Clear list, Match's announcements, Random with nothing to draw.
{
  test('re-rolling one palette colour can be undone', async () => {
    const { page, errors } = await openApp();
    await welcome(page, 'look');
    await idle(page);
    await page.click('#mPalette');
    await page.click('#draw');
    await idle(page, 1300);
    const p0 = await page.evaluate(() => state.palettes[state.palettes.length - 1].slice());
    await page.evaluate(() => doReRollBand(1));
    await page.waitForFunction((n) => state.palettes[state.palettes.length - 1].join() !== n, p0.join(), {
      timeout: 5000,
    });
    const p1 = await page.evaluate(() => state.palettes[state.palettes.length - 1].slice());
    assert.equal(p1.filter((x, i) => x !== p0[i]).length, 1, 'one colour changed');
    await page.click('#undo');
    await idle(page);
    assert.deepEqual(
      await page.evaluate(() => state.palettes[state.palettes.length - 1].slice()),
      p0,
      'Undo brings it back',
    );
    assert.deepEqual(errors, []);
  });
}

// ---- from v308-handover.test.mjs ----
// v308 Palette's Use in a guide hands the palette over without saving it to the Library. The guide holds it as its
// Generate palette's markers, and marks it (style.fromPal: its name and scheme) so it is used as it is, as a saved
// palette is: Mood greyed out, Shuffle reshuffling only, the line under the Colours tab naming it, until a new palette
// is asked for (a harmony chosen, Generate palette tapped, Surprise). Before, a Mood tap or Shuffle made a new palette
// in its place (a 6-colour Rainbow became 16 other colours after Soft). The mark is kept through Undo, a reload, a
// guide file and a backup.
{
  async function handOver(page, h, n) {
    await page.click('#mPalette');
    await idle(page);
    await page.click(`#harm [data-h="${h}"]`);
    await idle(page);
    await page.click(`#segs [data-n="${n}"]`);
    await idle(page);
    await page.click('#draw');
    await until(page, () => !rolling, null, 'the roll');
    await idle(page);
    const keys = await page.evaluate(() => currentPaletteIdxs().map(mkey));
    const name = (await page.textContent('#readout .name')).trim();
    await page.click('#useInGuide');
    await page.click('#sfEdAsk [data-a="recolour"]');
    await page.waitForFunction(
      (k) => __mstest.styleVars.paletteSource === 'generate' && __mstest.styleVars.genPal.join() === k,
      keys.join(),
    );
    await idle(page);
    return { keys, name };
  }
  const sv = (page) =>
    page.evaluate(() => {
      const s = __mstest.styleVars;
      return {
        src: s.paletteSource,
        genPal: s.genPal.slice(),
        fromPal: s.fromPal && { ...s.fromPal },
        emphasis: s.emphasis,
      };
    });
  const pageKeys = (page) =>
    page.evaluate(() => [...new Set(Object.values(__mstest.assignData.assign).map((a) => a.mkey))]);
  const moodOff = (page) =>
    page.evaluate(() => [...document.querySelectorAll('#sfMood button')].every((b) => b.disabled));
  const poolLine = (page) => page.evaluate(() => document.getElementById('sfPoolCt').textContent);
  const harmShown = (page) =>
    page.evaluate(() => {
      const s = document.getElementById('sfHarm');
      return s.options[s.selectedIndex].textContent;
    });
  // (v318.34) the palette's card on the Colours tab: its name and line (count · scheme · where from)
  const cardShown = (page) =>
    page.evaluate(() => {
      const c = document.getElementById('sfPalCard');
      return c.querySelector('.sfpntx b').textContent + ' · ' + c.querySelector('.sfpntx span').textContent;
    });
  test('Use in a guide: Mood and Shuffle keep the palette’s markers; a harmony or Generate palette makes a new one; Undo goes back to it', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    const { keys, name } = await handOver(page, 'rainbow', 6);
    assert.equal(
      await page.evaluate(() => state.saved.filter((x) => x.type === 'palette').length),
      0,
      'not saved',
    );
    // a Mood tap (it had made a new 16-colour palette, Soft from a 6-colour Rainbow) changes nothing
    await page.evaluate(() => document.querySelector('#sfMood [data-v="muted"]').click());
    await idle(page);
    let s = await sv(page);
    assert.deepEqual(s.genPal, keys, 'the palette’s markers after a Mood tap');
    assert.deepEqual(s.fromPal, { name, h: 'rainbow' });
    // used as it is, as a saved palette is: Mood greyed out, the line says so, the card shows the palette (v318.34:
    // the card, with its swatches, in place of a greyed option in the harmony select)
    assert.equal(await moodOff(page), true, 'Mood greyed out');
    assert.equal(await poolLine(page), 'All 6 of your palette’s markers, as it is');
    assert.equal(await cardShown(page), name + ' · 6 markers · Rainbow · From Palette');
    assert.equal(await harmShown(page), 'Rainbow');
    assert.ok(
      (await pageKeys(page)).every((k) => keys.includes(k)),
      'the page uses only the palette',
    );
    // Shuffle: the same markers, in another order
    const before = await page.evaluate(() => JSON.stringify(__mstest.assignData.assign));
    await page.evaluate(() => document.getElementById('sfVary').click());
    await idle(page);
    s = await sv(page);
    assert.deepEqual(s.genPal, keys, 'Shuffle kept the palette');
    assert.deepEqual(s.fromPal, { name, h: 'rainbow' });
    assert.ok((await pageKeys(page)).every((k) => keys.includes(k)));
    assert.notEqual(
      await page.evaluate(() => JSON.stringify(__mstest.assignData.assign)),
      before,
      'reshuffled',
    );
    // choosing a harmony asks for a new palette: the guide's own from then on, its Mood back
    await page.evaluate(() => {
      const el = document.getElementById('sfHarm');
      el.value = 'triadic';
      el.dispatchEvent(new Event('change'));
    });
    await idle(page);
    s = await sv(page);
    assert.equal(s.fromPal, null);
    assert.notDeepEqual(s.genPal, keys);
    assert.equal(await moodOff(page), false);
    assert.match(await poolLine(page), /generated markers/);
    assert.equal(await harmShown(page), 'Triadic');
    // Undo brings the handed-over palette back, as it was
    await page.evaluate(() => __mstest.assign.planUndo());
    await idle(page);
    s = await sv(page);
    assert.deepEqual(s.genPal, keys);
    assert.deepEqual(s.fromPal, { name, h: 'rainbow' });
    assert.equal(await moodOff(page), true);
    // New palette, tapped while the card shows the handed-over palette, makes a new one (one Undo step, so named)
    // (v318.34: the A palette segment, lit for it, leaves it as it is: New palette asks for another)
    await page.evaluate(() => document.querySelector('#sfSrc [data-v="palette"]').click());
    await idle(page);
    assert.deepEqual((await sv(page)).genPal, keys, 'A palette tapped again: kept');
    await page.evaluate(() => document.querySelector('#sfGenNew').click());
    await idle(page);
    s = await sv(page);
    assert.equal(s.fromPal, null);
    assert.notDeepEqual(s.genPal, keys);
    assert.equal(await page.evaluate(() => __mstest.planLabel), 'New palette');
    // a generated palette follows the Mood as before: made again for it
    const g = s.genPal;
    await page.evaluate(() => document.querySelector('#sfMood [data-v="pastel"]').click());
    await idle(page);
    assert.notDeepEqual((await sv(page)).genPal, g, 'made again for the Mood');
    // (v318.34) Surprise keeps a handed-over palette (a palette you chose) and surprises the rest; before, it made a
    // new palette in its place
    await page.evaluate(() => __mstest.assign.planUndo());
    await page.evaluate(() => __mstest.assign.planUndo());
    await idle(page);
    assert.deepEqual((await sv(page)).fromPal, { name, h: 'rainbow' });
    await page.evaluate(() => __mstest.surprise());
    await idle(page);
    assert.deepEqual((await sv(page)).fromPal, { name, h: 'rainbow' }, 'Surprise: the palette kept');
    assert.deepEqual((await sv(page)).genPal, keys);
    assert.deepEqual(errors, []);
  });
  test('the handed-over palette stays itself after a reload, in a guide file and in a backup', async () => {
    const a = await openApp();
    await sampleGuide(a.page);
    const { keys, name } = await handOver(a.page, 'rainbow', 6);
    await saveGuide(a.page);
    const id = await a.page.evaluate(() => __mstest.curId);
    const want = { src: 'generate', genPal: keys, fromPal: { name, h: 'rainbow' } };
    const check = async (page, what) => {
      const s = await sv(page);
      assert.deepEqual({ src: s.src, genPal: s.genPal, fromPal: s.fromPal }, want, what);
      assert.equal(await moodOff(page), true, what + ': Mood greyed out');
      // (and Shuffle still keeps it)
      await page.evaluate(() => document.getElementById('sfVary').click());
      await idle(page);
      assert.deepEqual((await sv(page)).genPal, keys, what + ': Shuffle');
    };
    // reload
    await a.page.reload();
    await idle(a.page);
    await a.page.evaluate((id) => loadGuide({ id }), id);
    await a.page.waitForFunction((id) => __mstest.curId === id && __mstest.assignData, id, {
      timeout: 10000,
    });
    await idle(a.page);
    await check(a.page, 'reloaded');
    // a guide file, opened in a fresh copy of the app
    const file = await a.page.evaluate(() => __mstest.currentDesignObj(true));
    assert.deepEqual(file.payload.style.fromPal, { name, h: 'rainbow' });
    const b = await openApp();
    await welcome(b.page, 'look');
    await b.page.evaluate(
      (d) => SF.importFile(new File([JSON.stringify(d)], 'g.msguide.json', { type: 'application/json' })),
      file,
    );
    await b.page.waitForFunction(() => __mstest.assignData && __mstest.sfmode === 'guide', null, {
      timeout: 15000,
    });
    await idle(b.page);
    await check(b.page, 'guide file');
    // a backup, restored into a fresh copy of the app
    await a.page.click('#mHome');
    await a.page.click('#homeLibCard');
    const [dl] = await Promise.all([a.page.waitForEvent('download'), a.page.click('#guidesBackup')]);
    const bk = JSON.parse(await readFile(await dl.path(), 'utf8'));
    assert.deepEqual(bk.guides[0].payload.style.fromPal, { name, h: 'rainbow' });
    const c = await openApp();
    await answerAsks(c.page);
    const [fc] = await Promise.all([c.page.waitForEvent('filechooser'), c.page.click('#wcRestore')]);
    await fc.setFiles(await dl.path());
    await idle(c.page, 1500);
    const gid = await c.page.evaluate(() => state.saved.find((s) => s.type === 'guide').id);
    await c.page.evaluate((id) => loadGuide({ id }), gid);
    await c.page.waitForFunction((id) => __mstest.curId === id && __mstest.assignData, gid, {
      timeout: 10000,
    });
    await idle(c.page);
    await check(c.page, 'backup');
    assert.deepEqual([...a.errors, ...b.errors, ...c.errors], []);
  });
}

// ---- from v308-palette.test.mjs ----
// v308 Palette in the browser: Undo after trying sizes; Undo into a photo's palette; the first visit's preview after
// adding markers; the empty card when the filters leave nothing; a saved palette opening as its scheme, and asking
// before it replaces Custom picks; Save image and the card after a Library rename; Use in a guide without saving;
// "This photo has about N colours"; "Photo looks dim" on a dim photo, not a starry sky; Brands I'd buy with nothing
// owned; From photo in portrait keeps the palette's name, Save and Use in a guide on the first screen.
{
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
}

// ---- from v3102.test.mjs ----
// v310.2: Ben's decisions from the v310.1 pass. An open guide follows a marker marked dry or unticked in Markers as
// opening it again would (sections still to colour show the closest you own; coloured ones keep theirs; the guide
// keeps the marker; back when it's yours again; not an Undo step); a locked Palette colour that can't be used is
// unlocked on Generate, with a word; Undo on "Page straightened" leaves "Page kept as photographed · Straighten";
// Home's guide card counts the colours guides use, saying how many marked dry are left out.
{
  test('Palette: a locked colour marked dry is unlocked on Generate, with a word', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await welcome(page, 'look');
    await idle(page);
    await page.click('#mPalette');
    await page.click('#draw');
    await idle(page);
    await page.click('#bands .band:nth-child(1) .blk');
    const i = await page.evaluate(() => state.locked[0]);
    // marked dry: unlocked on Generate, said so
    await page.evaluate((i) => {
      state.ink[mkey(i)] = 'dry';
      save();
    }, i);
    await page.click('#draw');
    await idle(page);
    assert.deepEqual(await page.evaluate(() => state.locked), []);
    assert.match(
      await page.textContent('#msToast'),
      new RegExp('^Unlocked ' + (await page.evaluate((i) => COLORS[i].code, i)) + ': it’s marked dry\\.'),
    );
    assert.equal(await page.evaluate((i) => state.palettes[state.palettes.length - 1].includes(i), i), false);
    assert.deepEqual(errors, []);
  });
  test('Palette: a lock is kept on Generate while its marker is yours and has ink', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await welcome(page, 'look');
    await idle(page);
    await page.click('#mPalette');
    await page.click('#draw');
    await idle(page);
    await page.click('#bands .band:nth-child(1) .blk');
    const i = await page.evaluate(() => state.locked[0]);
    await page.click('#draw');
    await idle(page);
    assert.deepEqual(await page.evaluate(() => state.locked), [i]);
    assert.ok(await page.evaluate((i) => state.palettes[state.palettes.length - 1].includes(i), i));
    assert.deepEqual(errors, []);
  });
}

// ---- from v313-polish.test.mjs ----
// v313 polish (D11): Markers' line about the view under its row; Palette's Undo, Clear, Save and ⋯ on one row; the
// Library's empty state (what's kept there, Try the sample, no search box); the guide's start card in Home's words;
// Edit sections' shorter intro; the shimmer three times; the sample's ticks not on Home's Continue card until it's
// printed or renamed; Continue's "Last coloured N days ago". Each test fails on v312.
{
  const box = (page, s) => page.locator(s).boundingBox();
  test('Palette: Undo, Clear, Save and ⋯ on one row', async () => {
    for (const width of [390, 820]) {
      const { page, errors } = await openApp({ width, height: 900 });
      await welcome(page, 'look');
      await page.click('#mPalette');
      await idle(page);
      await page.click('#draw');
      await idle(page);
      const u = await box(page, '#undo'),
        s = await box(page, '#saveBtn');
      assert.ok(Math.abs(u.y - s.y) < 2, `${width}: one row`);
      assert.deepEqual(errors, []);
      await page.context().close();
    }
  });
}

// ---- from v31825-x2.test.mjs ----
// v318.25 in the browser (deep debugging pass, step 2).
{
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
    assert.equal(
      await page.evaluate(() => !!document.querySelector('#bands .band:first-child .uwarn')),
      false,
    );
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
}
