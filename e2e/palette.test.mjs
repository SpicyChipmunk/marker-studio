// The Palette screen and palettes: it works before any markers are added, the sizes each scheme allows, Photo's
// sizes, Random's draw, the custom seed and the pool it picks from, Use in a guide, the readout at large text sizes,
// and the guide's Generate palette.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { setup, teardown, openApp, idle, until, welcome, sampleGuide, openAtScale } from './helpers.mjs';

before(setup);
after(teardown);

// ---- From UX release 1 (v260) ----
test('Palette works before any markers are added, with a line saying so', async () => {
  const { page, errors } = await openApp();
  await page.click('#wcSkip'); await page.click('#wcLook').catch(() => {}); await idle(page);
  await page.click('#mPalette'); await idle(page);
  assert.ok(await page.isVisible('#emptyOwned'));
  assert.match(await page.textContent('#emptyOwned'), /Using every Ohuhu \+ Copic marker/);
  assert.equal(await page.isDisabled('#draw'), false);
  await page.click('#draw'); await idle(page, 1300);
  assert.ok(await page.evaluate(() => state.palettes.length > 0), 'a palette was made');
  assert.deepEqual(errors, []);
});

// ---- From the review leftovers ----
test('palette sizes: only the sizes a scheme allows are shown', async () => {
  const { page, errors } = await openApp();
  await welcome(page, 'look');
  await page.click('#mPalette'); await idle(page);
  const shown = () => page.evaluate(() => [...document.querySelectorAll('#segs button')].filter((b) => b.offsetParent).map((b) => +b.dataset.n));
  const upTo = (a, b) => Array.from({ length: b - a + 1 }, (_, k) => a + k);
  await page.evaluate(() => setHarmony('complementary'));
  assert.deepEqual(await shown(), upTo(2, 8));
  await page.evaluate(() => setHarmony('analogous'));
  assert.deepEqual(await shown(), upTo(2, 8));
  await page.evaluate(() => setHarmony('triadic'));
  assert.deepEqual(await shown(), upTo(3, 10));
  await page.evaluate(() => setHarmony('split'));
  assert.deepEqual(await shown(), upTo(3, 10));
  await page.evaluate(() => setHarmony('tetradic'));
  assert.deepEqual(await shown(), upTo(4, 12));
  await page.evaluate(() => setHarmony('mono'));
  assert.deepEqual(await shown(), upTo(2, 10));
  // the largest sizes make real palettes of that many markers
  for (const [h, n] of [['complementary', 8], ['analogous', 8], ['tetradic', 12], ['triadic', 10], ['split', 10], ['mono', 10]]) {
    const len = await page.evaluate(([h, n]) => { setHarmony(h); setSize(n); return state.palettes[state.palettes.length - 1].length; }, [h, n]);
    assert.equal(len, n, `${h} at ${n}`);
  }
  // Photo keeps its own sizes, up to 16
  await page.evaluate(() => setHarmony('photo'));
  assert.ok(!(await page.isVisible('#segs')), 'the scheme sizes are hidden for Photo');
  assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('#photoSize button')].map((b) => +b.dataset.n)), [4, 6, 8, 10, 12, 16]);
  assert.deepEqual(errors, []);
});

// ---- From the third full review (v259) ----
test('palette screen: nothing to act on in Photo without a photo; too few markers says so; Save goes back to Save', async () => {
  const { page, errors } = await openApp();
  await welcome(page, 'look');
  await page.click('#mPalette'); await idle(page);
  await page.evaluate(() => setHarmony('complementary')); await page.click('#draw'); await idle(page, 1200);
  await page.evaluate(() => setHarmony('photo')); await idle(page);
  assert.equal(await page.isDisabled('#saveBtn'), true, 'Save off with no photo palette');
  assert.equal(await page.evaluate(() => currentPaletteIdxs().length), 0);
  // Save twice in a row
  await page.evaluate(() => setHarmony('triadic')); await page.click('#draw'); await idle(page, 1200);
  await page.click('#saveBtn'); await idle(page); await page.evaluate(() => { document.getElementById('saveBtn').disabled = false; }); await page.click('#saveBtn'); await idle(page, 1500);
  assert.equal(await page.textContent('#saveBtn'), 'Save');
  // only three markers in play
  await page.evaluate(() => { state.owned = new Set(['Ohuhu|R14', 'Ohuhu|B08', 'Ohuhu|Y26'].filter((k) => keyIdx(k) != null)); if (state.owned.size < 3) { state.owned = new Set(COLORS.slice(0, 3).map((c, i) => mkey(i))); } state.pool = null; save(); fullRender(); setHarmony('complementary'); setSize(4); });
  await idle(page);
  assert.match(await page.textContent('#draw'), /Only 3 markers to choose from/);
  assert.equal(await page.isDisabled('#draw'), true);
  assert.deepEqual(errors, []);
});

test('Swap during a marker removal replaces the right marker', async () => {
  const { page, errors } = await openApp();
  await welcome(page, 'look');
  await page.evaluate(() => { state.mode = 'random'; state.drawn = [11, 120, 280]; save(); fullRender(); });
  await idle(page);
  await page.evaluate(() => { doReDraw(); state.drawn.splice(1, 1); });
  await idle(page, 1500);
  const d = await page.evaluate(() => state.drawn);
  assert.equal(d.length, 2); assert.ok(d.includes(280), 'the other marker is still there: ' + d); assert.ok(!d.includes(11), 'the swapped one was replaced');
  assert.deepEqual(errors, []);
});

// ---- From the fourth review (outside the guide screen) ----
const KEY = 'ohuhu-hb320-picker-v3';

test('demo mode and dry markers: photo palette, custom slots and seed use the markers in play', async () => {
  const { page, errors } = await openApp();
  await page.click('#wcSkip'); await page.click('#wcLook');
  await page.click('#mPalette');
  await page.click('#harm [data-h="custom"]'); await idle(page);
  await page.click('#bands .band'); await page.waitForSelector('#seedOverlay.on');
  assert.ok(await page.locator('#seedGrid .cell').count() > 100, 'every marker to pick from with an empty collection');
  await page.click('#seedGrid .cell'); await idle(page);
  assert.equal(await page.locator('#bands .uwarn').count(), 0, 'no "not in your collection" warning in demo mode');
  // photo palette from a picture
  await page.click('#harm [data-h="photo"]'); await idle(page);
  await page.evaluate(() => new Promise((res) => { const c = document.createElement('canvas'); c.width = 40; c.height = 20; const x = c.getContext('2d'); x.fillStyle = '#d33'; x.fillRect(0, 0, 20, 20); x.fillStyle = '#39c'; x.fillRect(20, 0, 20, 20); const im = new Image(); im.onload = () => { _photoImg = im; applyPhotoPalette(); res(); }; im.src = c.toDataURL(); }));
  assert.ok(await page.evaluate(() => state.palettes[state.palettes.length - 1].length) >= 2, 'the photo gives markers with an empty collection');
  // with a collection: a dry marker is left out of the seed list, and a dry seed is shown struck through
  await page.evaluate(() => { ['Ohuhu|R014', 'Ohuhu|Y111', 'Ohuhu|B08', 'Ohuhu|G36'].forEach((k) => state.owned.add(k)); state.ink['Ohuhu|R014'] = 'dry'; state.seed = 'Ohuhu|R014'; setHarmony('complementary'); fullRender(); });
  assert.match(await page.innerHTML('#seedBtn'), /<s>Ohuhu R014<\/s>.*dry, not used/);
  await page.evaluate(() => openPicker({ type: 'seed' }));
  const codes = await page.$$eval('#seedGrid .cell .cc', (c) => c.map((x) => x.textContent));
  assert.ok(!codes.includes('R014') && codes.includes('Y111'), 'dry R014 not offered: ' + codes.join(' '));
  assert.deepEqual(errors, []);
});

// v288: with a guide open it asks (in the app's dialog): recolour it, or a new guide with this palette; Recolour saves
// the palette and the guide uses it at once; the guide's Undo goes back. With no guide open, nothing is asked.
test('Use in a guide asks: Recolour saves the palette and the guide uses it; the guide’s Undo goes back; New guide opens the picker', async () => {
  const { page, errors } = await openApp();
  const dialogs = [];
  page.on('dialog', (d) => { dialogs.push(d.message()); d.dismiss(); });
  await sampleGuide(page);
  const src0 = await page.evaluate(() => __mstest.styleVars.paletteSource);
  await page.click('#mPalette'); await page.click('#draw'); await idle(page);
  await page.click('#useInGuide');
  await page.waitForSelector('#sfEdAsk [data-a="recolour"]');
  assert.match(await page.textContent('#sfEdAsk .dsub'), /^Recolour “.+” with it, or start a new guide with it\?$/);
  assert.deepEqual(await page.$$eval('#sfEdAsk button[data-a]', (b) => b.map((x) => x.textContent)), [await page.textContent('#sfEdAsk [data-a="recolour"]'), 'New guide with it', 'Cancel']);
  // Cancel: nothing saved, nothing changed
  await page.click('#sfEdAsk [data-a="stay"]'); await idle(page);
  assert.equal(await page.evaluate(() => state.saved.filter((s) => s.type === 'palette').length), 0, 'Cancel saves nothing');
  await page.click('#useInGuide'); await page.click('#sfEdAsk [data-a="recolour"]');
  await page.waitForFunction(() => state.saved.some((s) => s.type === 'palette'));
  assert.equal(await page.evaluate(() => state.saved.filter((s) => s.type === 'palette').length), 1, 'saved');
  await page.waitForFunction(() => __mstest.styleVars.paletteSource === 'saved'); await idle(page);
  assert.deepEqual(dialogs, []);
  await page.click('#sfPlanUndo'); await idle(page);
  assert.equal(await page.evaluate(() => __mstest.styleVars.paletteSource), src0);
  // New guide with it: the photo picker opens, with the palette kept as the guide's choice
  await page.click('#mPalette'); await page.click('#draw'); await idle(page);
  await page.click('#useInGuide');
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('#sfEdAsk [data-a="new"]')]);
  assert.ok(chooser, 'picker opened');
  assert.equal(await page.evaluate(() => __mstest.styleVars.paletteSource), src0, 'the open guide is left as it was until a photo is chosen');
  assert.match(await page.textContent('#sfPalNote'), /for your next new guide|choose a photo/);
  assert.deepEqual(errors, []);
});

test('Use in a guide with no guide open asks nothing', async () => {
  const { page, errors } = await openApp();
  await welcome(page, 'look');
  const dialogs = [];
  page.on('dialog', (d) => { dialogs.push(d.message()); d.dismiss(); });
  await page.click('#mPalette'); await page.click('#draw'); await idle(page);
  await page.click('#useInGuide'); await page.waitForFunction(() => state.saved.some((s) => s.type === 'palette'));
  assert.equal(await page.locator('#sfEdAsk').count(), 0);
  assert.deepEqual(dialogs, []);
  assert.deepEqual(errors, []);
});

// ---- From the fifth review (outside the guide screen) ----
const SHOTS = process.env.SHOTS || '';// a folder: the layout tests save their screenshots there
const onboarded = (extra = {}) => ({ 'ms-onboarded': '1', 'ms-setup-tip': '1', 'ms-last-ver': 'v265', ...extra });
const OWN = ['Ohuhu|R014', 'Ohuhu|Y111', 'Ohuhu|B08', 'Ohuhu|G36', 'Ohuhu|BV310', 'Ohuhu|YR313', 'Ohuhu|RV08', 'Ohuhu|BG311'];
const appState = (extra = {}) => JSON.stringify({ mode: 'home', ownedSeedV: 2, copicAdd1: 1, libAdj1: 1, setFix1: 1, owned: OWN, saved: [], ...extra });
async function shot(page, name) { if (!SHOTS) return; await mkdir(SHOTS, { recursive: true }); await page.screenshot({ path: `${SHOTS}/g3-${name}.png` }); }

// indexes of markers by key, for a custom palette
const idxOf = (page, keys) => page.evaluate((ks) => ks.map((k) => keyIdx(k)), keys);

for (const [w, scale] of [[360, 1], [360, 1.3], [390, 1.6]]) {
  test(`palette readout at ${w}px, ${scale}x: the name and the codes don't overlap, no code alone on a line`, async () => {
    const { page, errors } = await openAtScale(scale, { width: w, height: 800, storage: onboarded({ [KEY]: appState({ owned: [...OWN, 'Copic|R29', 'Copic|B29'] }) }) });
    await page.click('#mPalette');
    await page.click('#harm [data-h="split"]'); await page.click('#segs [data-n="5"]'); await idle(page);
    const m = await page.evaluate(() => { const r = document.getElementById('readout'), n = r.firstElementChild.getBoundingClientRect(), h = r.querySelector('.hex').getBoundingClientRect(), tops = [...r.querySelectorAll('.hex > span')].map((s) => Math.round(s.getBoundingClientRect().top)), lines = {}; tops.forEach((t) => { lines[t] = (lines[t] || 0) + 1; }); return { n: [n.left, n.right, n.top, n.bottom], h: [h.left, h.right, h.top, h.bottom], per: Object.keys(lines).sort((a, b) => a - b).map((t) => lines[t]), sw: r.scrollWidth, cw: r.clientWidth }; });
    const overlap = m.n[0] < m.h[1] && m.h[0] < m.n[1] && m.n[2] < m.h[3] && m.h[2] < m.n[3];
    assert.equal(overlap, false, JSON.stringify(m));
    assert.ok(m.sw <= m.cw + 1, 'nothing runs off the card');
    if (m.per.length > 1) assert.ok(m.per[m.per.length - 1] >= 2, 'no orphan code: ' + JSON.stringify(m.per));
    await page.evaluate(() => document.getElementById('readout').scrollIntoView({ block: 'center' })); await shot(page, `palette-${w}-${scale}x`);
    // a palette that mixes brands shows the letters, as the bands do
    const ix = await idxOf(page, ['Ohuhu|R014', 'Copic|R29', 'Ohuhu|B08', 'Copic|B29']);
    await page.click('#harm [data-h="custom"]');
    await page.evaluate((ix) => { state.palSize = 4; state.customPal = ix; save(); fullRender(); }, ix);
    const t = await page.evaluate(() => { const h = document.querySelector('#readout .hex').cloneNode(true); h.querySelectorAll('.sfsr').forEach((x) => x.remove()); return h.textContent.replace(/\u00a0/g, ' '); });
    assert.equal(t, 'O R014 C R29 O B08 C B29');
    // (a screen reader hears the brand's name for the letter)
    assert.equal(await page.$$eval('#readout .hex .rbt', (b) => b.every((x) => x.getAttribute('aria-hidden') === 'true')), true);
    assert.equal((await page.textContent('#readout .hex .sfsr')).trim(), 'Ohuhu');
    await page.evaluate(() => document.getElementById('readout').scrollIntoView({ block: 'center' })); await shot(page, `palette-mixed-${w}-${scale}x`);
    assert.deepEqual(errors, []);
  });
}

test('Photo: a size it doesn’t offer moves to the nearest, which is highlighted', async () => {
  const { page, errors } = await openApp({ storage: onboarded({ [KEY]: appState() }) });
  await page.click('#mPalette'); await page.click('#segs [data-n="5"]'); await page.click('#harm [data-h="photo"]');
  assert.equal(await page.evaluate(() => state.palSize), 4);
  assert.deepEqual(await page.$$eval('#photoSize button.on', (l) => l.map((b) => b.dataset.n)), ['4']);
  assert.deepEqual(errors, []);
});

// ---- From v265 ----
test('Generate palette: the Palette screen’s harmonies in its order, each at a size its range allows', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await page.click('.sftabbtn[data-t="colours"]'); await idle(page);
  await page.click('#sfSrc button[data-v="generate"]'); await idle(page);
  const guide = await page.$$eval('#sfHarm option', (os) => os.map((o) => o.value + '=' + o.textContent));
  const palette = await page.$$eval('#harm button', (bs) => bs.filter((b) => !['custom', 'photo'].includes(b.dataset.h)).map((b) => b.dataset.h + '=' + b.textContent));
  assert.deepEqual(guide, palette);
  assert.deepEqual(guide.map((x) => x.split('=')[1]), ['Complementary', 'Analogous', 'Triadic', 'Split complementary', 'Tetradic', 'Monochrome']);
  for (const expand of [true, false]) {
    const got = await page.evaluate((expand) => __mstest.GEN_HARMS.map((h) => { const t = __mstest; t.genHarmony = h; t.limitN = 16; t.expand = expand; t.paletteSource = 'generate'; t.generatePalette(); return { h, n: t.genPal.length, pool: t.activePool().length, R: HARM_RANGE[h] }; }), expand);
    for (const g of got) {
      assert.ok(g.n >= g.R[0] && g.n <= g.R[1], `${g.h}: ${g.n} in ${g.R}`);
      assert.equal(g.n, g.R[1], `${g.h}: as many as its range allows for 16`);
      if (expand) assert.equal(g.pool, 16, `${g.h}: the rest from nearby markers`);
      else assert.ok(g.pool <= g.n, `${g.h}: just the palette with Expand off`);
    }
  }
  // choosing one in the select
  await page.selectOption('#sfHarm', 'complementary'); await idle(page);
  assert.ok(await page.evaluate(() => __mstest.genPal.length <= HARM_RANGE.complementary[1]));
  // Surprise picks a harmony and keeps to its range
  for (let k = 0; k < 8; k++) {
    const s = await page.evaluate(() => { __mstest.surprise(); const h = __mstest.genHarmony; return { h, n: __mstest.genPal.length, R: HARM_RANGE[h], ok: __mstest.GEN_HARMS.includes(h) }; });
    assert.ok(s.ok && s.n >= s.R[0] && s.n <= s.R[1], JSON.stringify(s));
  }
  assert.deepEqual(errors, []);
});

// ---- From the palette generator (clearly different colours, bigger sizes) ----
for (const [w, scale] of [[360, 1], [360, 1.3], [390, 1.6]]) {
  test(`palette sizes at ${w}px, ${scale}x: every size a scheme offers is on screen; more than 8 colours show as a grid`, async () => {
    const { page, errors } = await openAtScale(scale, { width: w, height: 800 });
    await welcome(page, 'look');
    await page.click('#mPalette'); await idle(page);
    for (const h of ['complementary', 'analogous', 'triadic', 'split', 'tetradic', 'mono', 'custom']) {
      await page.evaluate((h) => setHarmony(h), h); await idle(page);
      const m = await page.evaluate(() => { const bs = [...document.querySelectorAll('#segs button')].filter((b) => b.offsetParent).map((b) => b.getBoundingClientRect()); return { n: bs.length, left: Math.min(...bs.map((r) => r.left)), right: Math.max(...bs.map((r) => r.right)), minW: Math.min(...bs.map((r) => r.width)), vw: innerWidth, sw: document.documentElement.scrollWidth }; });
      assert.ok(m.left >= 0 && m.right <= m.vw, `${h}: its ${m.n} sizes are on screen ${JSON.stringify(m)}`);
      assert.ok(m.sw <= m.vw, `${h}: no sideways scrolling`);
      assert.ok(m.minW >= 30, `${h}: size buttons keep their width`);
    }
    await shot(page, `palette-sizes-${w}-${scale}x`);
    await page.evaluate(() => { setHarmony('tetradic'); setSize(12); }); await idle(page);
    assert.equal(await page.locator('#bands .band').count(), 12);
    assert.equal(await page.evaluate(() => document.getElementById('bands').classList.contains('grid')), true, '12 colours: a grid');
    await shot(page, `palette-grid12-${w}-${scale}x`);
    await page.evaluate(() => { setHarmony('analogous'); setSize(8); }); await idle(page);
    assert.equal(await page.locator('#bands .band').count(), 8);
    assert.equal(await page.evaluate(() => document.getElementById('bands').classList.contains('grid')), false, '8 colours: bands');
    assert.deepEqual(errors, []);
  });
}

// the palette's smallest colour difference, leaving out a locked pair (as the note does)
const palMin = (page) => page.evaluate(() => palMinDE(state.palettes[state.palettes.length - 1], new Set(state.locked)));
const visibleNotes = (page) => page.evaluate(() => ['palClose', 'photoNote'].filter((id) => { const e = document.getElementById(id); return e && e.offsetParent && e.textContent.trim(); }));

test('a palette whose colours are close says so in one line; a clean one says nothing', async () => {
  const { page, errors } = await openApp();
  await welcome(page, 'look');
  await page.click('#mPalette'); await idle(page);
  // the 120 set: clean palettes, no line
  for (const [h, n] of [['complementary', 8], ['tetradic', 12], ['analogous', 8]]) {
    await page.evaluate(([h, n]) => { setHarmony(h); setSize(n); }, [h, n]); await idle(page);
    for (let r = 0; r < 3; r++) {
      await page.click('#draw'); await idle(page, 1300);
      assert.ok(await palMin(page) >= 10, `${h} ${n}: clearly different colours`);
      // (the line follows the new palette once the draw has played: Safari's engine can be slower than the idle wait)
      await page.waitForFunction(() => getComputedStyle(document.getElementById('palClose')).display === 'none', null, { timeout: 4000 }).catch(() => {});
      assert.equal(await page.isVisible('#palClose'), false, `${h} ${n}: no line`);
    }
  }
  // four markers that look nearly the same: Monochrome of 4 has to use them all
  await page.evaluate(() => {
    const P = COLORS.map((_, i) => i).filter((i) => COLORS[i].brand === 'Ohuhu' && LCH[i][1] > 20);
    const x = P[0], near = P.filter((i) => i !== x).sort((a, b) => de2000(LAB[x], LAB[a]) - de2000(LAB[x], LAB[b])).slice(0, 3);
    state.owned = new Set([x, ...near].map(mkey)); state.seed = null; state.locked = []; save(); fullRender();
    setHarmony('mono'); setSize(4);
  });
  await idle(page);
  await page.click('#draw'); await idle(page, 1300);
  assert.ok(await palMin(page) < 6, 'the palette has a close pair');
  assert.equal(await page.textContent('#palClose'), 'Two colours are close: your markers don’t have 4 clearly different colours for this scheme.');
  assert.deepEqual(await visibleNotes(page), ['palClose'], 'one line');
  // it goes with the scheme: not in Custom or Photo, back with Monochrome
  await page.evaluate(() => setHarmony('custom')); await idle(page);
  assert.deepEqual(await visibleNotes(page), []);
  await page.evaluate(() => setHarmony('photo')); await idle(page);
  assert.deepEqual(await visibleNotes(page), []);
  await page.evaluate(() => setHarmony('mono')); await idle(page);
  assert.equal(await page.isVisible('#palClose'), true);
  // a locked close pair is the user's choice: locking all four clears it
  await page.evaluate(() => { state.locked = state.palettes[state.palettes.length - 1].slice(); save(); fullRender(); }); await idle(page);
  assert.equal(await page.isVisible('#palClose'), false);
  assert.deepEqual(errors, []);
});

test('tapping a band re-rolls that colour to one clearly different from the rest', async () => {
  const { page, errors } = await openApp();
  await welcome(page, 'look');
  await page.click('#mPalette'); await idle(page);
  for (const [h, n, need] of [['complementary', 6, 10], ['tetradic', 12, 10], ['mono', 6, 6]]) {
    await page.evaluate(([h, n]) => { setHarmony(h); setSize(n); }, [h, n]); await idle(page);
    for (let r = 0; r < 4; r++) {
      const k = (r * 5) % n;
      const before = await page.evaluate(() => state.palettes[state.palettes.length - 1].slice());
      const band = page.locator('#bands .band').nth(k), box = await band.boundingBox();
      await band.click({ position: { x: box.width / 2, y: box.height - 8 } }); // clear of the lock
      await until(page, () => !rolling, null, 'the re-roll finished'); await idle(page);
      const after = await page.evaluate(() => state.palettes[state.palettes.length - 1].slice());
      assert.notEqual(after[k], before[k], `${h}: band ${k} changed`);
      assert.deepEqual(after.filter((_, p) => p !== k), before.filter((_, p) => p !== k), 'the others stay');
      const d = await page.evaluate(([pal, k]) => Math.min(...pal.filter((_, p) => p !== k).map((i) => de2000(LAB[i], LAB[pal[k]]))), [after, k]);
      // clearly different from the others, or (when the markers near it are all close: a tight Monochrome) said so
      if (h !== 'mono') assert.ok(d >= need, `${h}: the new colour is clearly different from the others (${d.toFixed(1)})`);
      else if (d < need) assert.match(await page.textContent('#palClose'), /close/, `mono: a close re-roll says so (${d.toFixed(1)})`);
      if (h !== 'mono') assert.ok(await page.evaluate((i) => LCH[i][1] >= GREY_C, after[k]), 'not a near-grey');
    }
    // the line about close colours goes with the palette as it is now (a generated Monochrome may have started close)
    const close = /close/.test((await page.isVisible('#palClose')) ? await page.textContent('#palClose') : '');
    assert.equal(close, (await palMin(page)) < need, `${h}: the close line matches the palette`);
  }
  assert.deepEqual(errors, []);
});

// ---- Colour engines round 2 (v270): Palette › From photo ----
// A photo of a page as a PNG file: paper (white, or grey and warm as a phone takes it under a lamp) over most of it,
// and colour patches on the right, two of them nearly alike
const photoOf = (page, paper) => page.evaluate((paper) => {
  const c = document.createElement('canvas'); c.width = 200; c.height = 120; const g = c.getContext('2d');
  g.fillStyle = paper; g.fillRect(0, 0, 200, 120);
  ['#c0392b', '#c43d30', '#e67e22', '#f1c40f', '#27ae60', '#2980b9', '#8e44ad', '#6d4c41', '#1b1b1b'].forEach((f, k) => { g.fillStyle = f; g.fillRect(110 + (k % 3) * 30, (k / 3 | 0) * 40, 30, 40); });
  return c.toDataURL('image/png').split(',')[1];
}, paper).then((b) => ({ name: 'page.png', mimeType: 'image/png', buffer: Buffer.from(b, 'base64') }));
const photoPal = (page) => page.evaluate(() => state.palettes[state.palettes.length - 1].slice());
async function choosePhoto(page, paper) {
  const n = await page.evaluate(() => state.palettes.length);
  await page.setInputFiles('#photoFile', await photoOf(page, paper));
  await until(page, (n) => state.palettes.length > n, n, 'the photo palette'); await idle(page);
}

test('From photo: a full palette of clearly different markers, and never a near-white one for the paper', async () => {
  const { page, errors } = await openApp();
  await welcome(page, 'look');
  await page.click('#mPalette'); await page.click('#harm [data-h="photo"]'); await idle(page);
  await choosePhoto(page, '#fbfbf8');
  for (const n of [4, 8, 12]) {
    await page.click(`#photoSize [data-n="${n}"]`); await idle(page);
    const pal = await photoPal(page);
    assert.equal(pal.length, n, 'as many markers as asked for');
    const r = await page.evaluate((pal) => {
      let min = 1e9; for (let a = 0; a < pal.length; a++) for (let b = a + 1; b < pal.length; b++) min = Math.min(min, de2000(LAB[pal[a]], LAB[pal[b]]));
      return { min, white: pal.filter((i) => LAB[i][0] >= 90 && Math.hypot(LAB[i][1], LAB[i][2]) < GREY_C).map((i) => COLORS[i].code), inPlay: pal.every((i) => inPool(i)) };
    }, pal);
    assert.ok(r.min >= 6, `${n}: every two at least 6 apart (${r.min.toFixed(1)})`);
    assert.deepEqual(r.white, [], `${n}: no near-white marker`);
    assert.ok(r.inPlay, 'only markers in play');
    assert.equal(await page.textContent('#photoNote'), n + ' markers matched from your photo');
  }
  // the near-black line of the page is a colour like any other
  await page.click('#photoSize [data-n="12"]'); await idle(page);
  assert.ok(await page.evaluate(() => state.palettes[state.palettes.length - 1].some((i) => LAB[i][0] < 25)), 'a near-black');
  assert.deepEqual(errors, []);
});

test('From photo: Tap the white paper takes the palette from the photo with its lighting corrected; a bad spot says so; ✕ and a new photo take it away', async () => {
  const { page, errors } = await openApp();
  await welcome(page, 'look');
  await page.click('#mPalette'); await page.click('#harm [data-h="photo"]'); await idle(page);
  await choosePhoto(page, '#baafa0');
  await page.click('#photoSize [data-n="6"]'); await idle(page);
  const p0 = await photoPal(page), src0 = await page.getAttribute('#photoThumb', 'src');
  // the grey paper, as photographed, takes a grey marker
  assert.ok(await page.evaluate((p) => p.some((i) => LCH[i][1] < GREY_C && LAB[i][0] > 60), p0), 'a light grey for the paper before');
  assert.equal(await page.getAttribute('#photoPaper', 'aria-pressed'), 'false');
  await page.click('#photoPaper');
  assert.equal(await page.getAttribute('#photoPaper', 'aria-pressed'), 'true');
  assert.match(await page.textContent('#photoPaperNote'), /tap a plain white part of the paper/);
  // a tap on the photo while not in the mode does nothing; Escape leaves the mode
  await page.keyboard.press('Escape'); await idle(page);
  assert.equal(await page.getAttribute('#photoPaper', 'aria-pressed'), 'false');
  const thumb = async (fx, fy) => { const r = await page.locator('#photoThumb').boundingBox(); await page.mouse.click(r.x + r.width * fx, r.y + r.height * fy); await idle(page); };
  await thumb(0.2, 0.5);
  assert.deepEqual(await photoPal(page), p0, 'nothing changes outside the mode');
  // a coloured spot can't be paper: said, and the mode stays
  await page.click('#photoPaper'); await thumb(0.63, 0.15);
  assert.equal(await page.textContent('#photoPaperNote'), 'That spot is too dark or too coloured to be white paper. Tap a plain white part of the page.');
  assert.equal(await page.getAttribute('#photoPaper', 'aria-pressed'), 'true');
  assert.deepEqual(await photoPal(page), p0);
  // the paper: the palette comes again from the corrected photo, which the thumbnail shows
  await thumb(0.2, 0.5);
  assert.equal(await page.getAttribute('#photoPaper', 'aria-pressed'), 'false');
  assert.ok(await page.isVisible('#photoLight'));
  const p1 = await photoPal(page);
  assert.notDeepEqual(p1, p0, 'a new palette');
  assert.equal(p1.length, 6);
  assert.deepEqual(p1, await page.evaluate(() => extractPhotoPalette(_photoImg, 6, _photoFix).markers.slice()), 'from the corrected photo');
  assert.ok(await page.evaluate((p) => !p.some((i) => LCH[i][1] < GREY_C && LAB[i][0] > 60), p1), 'the paper, now white, takes no marker');
  assert.match(await page.getAttribute('#photoThumb', 'src'), /^data:image\/jpeg/);
  // ✕: the photo as it was, and its palette
  await page.click('#photoLight'); await idle(page);
  assert.equal(await page.isVisible('#photoLight'), false);
  assert.deepEqual(await photoPal(page), p0);
  assert.equal(await page.getAttribute('#photoThumb', 'src'), src0);
  // a new photo starts without a correction
  await page.click('#photoPaper'); await thumb(0.2, 0.5);
  assert.ok(await page.isVisible('#photoLight'));
  await choosePhoto(page, '#baafa0');
  assert.equal(await page.isVisible('#photoLight'), false);
  assert.equal(await page.evaluate(() => _photoFix), null);
  assert.deepEqual(await photoPal(page), p0, 'the same photo, uncorrected');
  assert.deepEqual(errors, []);
});

// ---- v284: the Palette card's name, Photo before a photo, what each harmony does, the ⋯ menu and Clear ----
const v284 = () => onboarded({ [KEY]: appState() });

test('Palette: the card’s title is the name the Library saves it under, with the scheme under it', async () => {
  const { page, errors } = await openApp({ storage: v284() });
  await page.click('#mPalette'); await page.click('#draw'); await idle(page, 1200);
  const title = (await page.textContent('#readout .name')).trim();
  assert.notEqual(title, 'Complementary', 'not the scheme');
  assert.match(await page.textContent('#readout .fam'), /^Complementary · Ohuhu .+ base$/);
  await page.click('#saveBtn'); await idle(page, 1500);
  assert.equal(await page.evaluate(() => state.saved[0].name), title, 'saved under the name shown');
  assert.equal((await page.textContent('#readout .name')).trim(), title, 'and the card still says it');
  // after a reload too (a new name would skip the one now in the Library)
  await page.reload(); await idle(page);
  assert.equal((await page.textContent('#readout .name')).trim(), title);
  // saved again: a second entry needs its own name, which the card then shows
  await page.click('#saveBtn'); await idle(page, 1500);
  const names = await page.evaluate(() => state.saved.map((s) => s.name));
  assert.equal(names.length, 2); assert.notEqual(names[0], names[1]);
  assert.equal((await page.textContent('#readout .name')).trim(), names[0]);
  // a new palette gets a new name; Custom is named once it has a marker
  // (the test collection is small: a draw can come up with the saved palette again, which rightly shows its Library
  // name, so draw until it's another)
  const sameAsSaved = () => page.evaluate(() => state.saved.some((s) => s.keys.join(',') === currentPaletteIdxs().map(mkey).join(',')));
  for (let i = 0; i < 8; i++) { await page.click('#draw'); await idle(page, 1200); if (!(await sameAsSaved())) break; }
  assert.equal(await sameAsSaved(), false, 'a different palette drawn');
  assert.ok(!names.includes((await page.textContent('#readout .name')).trim()));
  await page.click('#harm [data-h="custom"]'); await idle(page);
  assert.equal((await page.textContent('#readout .name')).trim(), 'Custom palette');
  await page.click('#bands .band'); await page.waitForSelector('#seedOverlay.on'); await page.click('#seedGrid .cell'); await idle(page);
  assert.notEqual((await page.textContent('#readout .name')).trim(), 'Custom palette');
  assert.match(await page.textContent('#readout .fam'), /^Custom · 1 of 4 chosen/);
  assert.deepEqual(errors, []);
});

test('Palette › Photo before a photo: its own empty card, no Save, Save image or Clear; a tap on the card chooses one', async () => {
  const { page, errors } = await openApp({ storage: v284() });
  await page.click('#mPalette'); await page.click('#draw'); await idle(page, 1200);
  // from Custom, which used to leave "Custom palette · 0 of 4 chosen" on the card
  await page.click('#harm [data-h="custom"]'); await page.click('#harm [data-h="photo"]'); await idle(page);
  assert.equal((await page.textContent('#readout')).trim(), '', 'no leftover title');
  assert.ok(await page.isVisible('#phint'));
  assert.equal(await page.textContent('#phint .ghtext'), 'Tap to choose a photo and pull its colours');
  for (const sel of ['#saveBtn', '#exportBtn', '#libMore', '#reset', '#useInGuide']) assert.equal(await page.isVisible(sel), false, sel + ' hidden');
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('#palette')]);
  assert.ok(chooser, 'the card’s tap opens the photo chooser');
  await choosePhoto(page, '#baafa0');
  assert.ok(await page.isVisible('#saveBtn') && !(await page.isDisabled('#saveBtn')), 'Save once there are colours');
  assert.ok(await page.isVisible('#libMore'));
  assert.ok(await page.isVisible('#reset'));
  assert.match(await page.textContent('#readout .fam'), /^From photo$/);
  assert.equal(await page.textContent('#phint .ghtext'), 'Tap to generate a palette', 'other schemes keep their wording');
  assert.deepEqual(errors, []);
});

test('Palette: a line under the Harmony choices says what the chosen one does', async () => {
  const { page, errors } = await openApp({ storage: v284() });
  await page.click('#mPalette'); await idle(page);
  const want = {
    complementary: 'Colours from opposite sides of the wheel',
    analogous: 'Neighbours on the wheel',
    triadic: 'Three colours evenly spaced round the wheel',
    split: 'One colour and the two either side of its opposite',
    tetradic: 'Two pairs of opposites',
    mono: 'One colour, light to dark',
    custom: 'Markers you choose: tap a slot to pick one',
    photo: 'A photo’s main colours, matched to markers',
  };
  assert.deepEqual((await page.$$eval('#harm button', (b) => b.map((x) => x.dataset.h))).sort(), Object.keys(want).sort(), 'every harmony has a line');
  for (const [h, t] of Object.entries(want)) {
    await page.click(`#harm [data-h="${h}"]`); await idle(page);
    assert.equal(await page.textContent('#harmDesc'), t, h);
  }
  const d = await page.locator('#harmDesc').boundingBox(), c = await page.locator('#harm').boundingBox();
  assert.ok(d.y >= c.y + c.height && Math.abs(d.x - c.x) < 8, 'under the choices, lined up with them');
  await page.click('#mCollection');
  assert.equal(await page.isVisible('#harmDesc'), false);
  assert.deepEqual(errors, []);
});

test('Palette: Library and Save image are in a ⋯ menu beside Save, by tap or keyboard; Reset is now Clear', async () => {
  const { page, errors } = await openApp({ storage: v284() });
  await page.click('#mPalette'); await page.click('#draw'); await idle(page, 1200);
  const shown = () => page.$$eval('#libRow > button, #libRow > .libmore > button', (b) => b.filter((x) => x.checkVisibility()).map((x) => x.id));
  assert.deepEqual(await shown(), ['saveBtn', 'libMore'], 'Save and ⋯ only');
  assert.equal(await page.isVisible('#savedBtn'), false);
  assert.equal(await page.isVisible('#draw'), true, 'Generate stays the main action');
  assert.equal(await page.isVisible('#useInGuide'), true, 'and Use in a guide as it was');
  // tap: opens, a tap elsewhere closes
  await page.click('#libMore');
  assert.equal(await page.getAttribute('#libMore', 'aria-expanded'), 'true');
  assert.deepEqual(await page.$$eval('#libMenu [role="menuitem"]', (b) => b.map((x) => x.textContent)), ['Library', 'Save image']);
  const menu = await page.locator('#libMenu').boundingBox();
  assert.ok(menu.x >= 0 && menu.x + menu.width <= 390, 'on screen');
  await page.click('#harmWrap .szlbl');
  assert.equal(await page.isVisible('#libMenu'), false);
  assert.equal(await page.getAttribute('#libMore', 'aria-expanded'), 'false');
  // keyboard: Enter opens on the first item, arrows move, Escape closes back on ⋯
  await page.focus('#libMore'); await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'savedBtn');
  await page.keyboard.press('ArrowDown');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'exportBtn');
  await page.keyboard.press('ArrowDown');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'savedBtn', 'round again');
  await page.keyboard.press('Escape');
  assert.equal(await page.isVisible('#libMenu'), false);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'libMore');
  // an item: the menu closes and does it
  await page.click('#libMore'); await page.click('#savedBtn'); await page.waitForSelector('#savedOverlay.on');
  assert.equal(await page.isVisible('#libMenu'), false);
  await page.keyboard.press('Escape'); await idle(page);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'libMore', 'focus back on ⋯');
  await page.click('#libMore'); await page.click('#exportBtn'); await page.waitForSelector('#imgOverlay.on');
  await page.keyboard.press('Escape'); await idle(page);
  // Clear: what it does is empty the palette, on a second tap
  assert.equal(await page.textContent('#reset'), 'Clear');
  await page.click('#reset');
  assert.equal(await page.textContent('#reset'), 'Clear all? Tap again');
  await page.click('#reset'); await idle(page);
  assert.equal(await page.evaluate(() => state.palettes.length), 0);
  assert.equal(await page.textContent('#reset'), 'Clear');
  assert.equal(await page.isDisabled('#reset'), true);
  assert.deepEqual(errors, []);
});

test('Palette at 320 wide and 1.6x text: the harmony line, Save and ⋯, and the menu fit', async () => {
  const { page, errors } = await openAtScale(1.6, { width: 320, height: 700, storage: v284() });
  await page.click('#mPalette'); await page.click('#draw'); await idle(page, 1200);
  await page.click('#harm [data-h="split"]'); await idle(page);
  await page.click('#libMore');
  const m = await page.evaluate(() => {
    const r = (id) => document.getElementById(id).getBoundingClientRect(), d = document.getElementById('harmDesc');
    return { sw: document.documentElement.scrollWidth <= innerWidth, desc: r('harmDesc').right <= innerWidth && d.scrollWidth <= d.clientWidth + 1, row: r('libMore').right <= innerWidth && r('saveBtn').right < r('libMore').left, menu: r('libMenu').left >= 0 && r('libMenu').right <= innerWidth, items: [...document.querySelectorAll('#libMenu button')].every((b) => b.scrollWidth <= b.clientWidth + 1) };
  });
  assert.deepEqual(m, { sw: true, desc: true, row: true, menu: true, items: true });
  assert.deepEqual(errors, []);
});
