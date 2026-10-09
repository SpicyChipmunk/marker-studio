// One To buy list (Markers › To buy) fed from every "you could buy" suggestion, called To buy everywhere, and ink:
// running low / dry (dry markers kept by the guide).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setup, teardown, openApp, welcome, sampleGuide, idle, shot, saveGuide, answerAsks, haveSet } from './helpers.mjs';

before(setup);
after(teardown);

const SHOTS = process.env.SHOP_SHOTS || '';
const snap = async (page, name) => { await shot(page, name); if (SHOTS) await page.screenshot({ path: SHOTS + '/' + name + '.png' }); };
const wish = (page) => page.evaluate(() => state.wish.map((w) => ({ k: w.k, why: w.why })));
const firstUnowned = (page) => page.evaluate(() => COLORS.findIndex((c, i) => c.brand === 'Ohuhu' && !isOwned(i)));
const firstOwned = (page) => page.evaluate(() => COLORS.findIndex((c, i) => c.brand === 'Ohuhu' && isOwned(i)));
async function markers(page, view) {
  await page.click('#mCollection'); await idle(page);
  if (view) { await page.click(`#ownView [data-v="${view}"]`); await idle(page); }
}
// Only the sample guide's own markers owned: its blends need shades you don't have. (With all of Honolulu 120, every
// colour in the sample has a lighter and a darker shade you own, so the blend plan has nothing to suggest.)
const onlyGuideMarkers = (page) => page.evaluate(() => {
  const keys = new Set(Object.values(__mstest.assignData.assign).map((m) => m.mkey));
  state.owned = new Set([...state.owned].filter((k) => keys.has(k)));
  save();
  SF.setCollection(sfCollection());
});
// press and hold stands in as a right-click: it opens the marker's details
async function openSheet(page, i) {
  await page.evaluate((i) => openMarkerSheet(i), i);
  await page.waitForSelector('#mkOverlay.on');
}

test('Match a colour: closer ones you could buy go on the list', async () => {
  const { page, errors } = await openApp();
  await welcome(page, 'look');
  await markers(page);
  await page.click('#mkMatchBtn');
  await page.click('.msrc [data-src="hex"]');
  // a turquoise your markers match roughly (BG311, 9.2) and two Copic markers clearly better (4.8, 6.4): markers to buy
  // are listed only when at least 2 ΔE00 closer (#0bd6c8, used before, has none now). (v304: no Ohuhu marker is, so
  // the nearest Copic one, BG13, is listed alone under "Closer in Copic")
  await page.fill('#matchHex', '#40e0d0'); await idle(page);
  const btns = page.locator('#matchResult .mrow .wishbtn');
  const closer = await page.evaluate(() => { const h = [...document.querySelectorAll('#matchResult .mlh')].find((x) => /could buy|^Closer (still )?in /.test(x.textContent)); let n = 0, e = h && h.nextElementSibling; while (e && e.classList.contains('mrow')) { n++; e = e.nextElementSibling; } return n; });
  assert.ok(closer >= 1, 'there are closer ones to buy');
  assert.equal(await btns.count(), closer, 'each of those, and only those, has an add button');
  assert.equal((await btns.first().textContent()).trim(), '+ To buy');
  const k = await btns.first().getAttribute('data-wk');
  await btns.first().click(); await idle(page);
  assert.equal((await btns.first().textContent()).trim(), '✓ To buy');
  assert.deepEqual(await wish(page), [{ k, why: 'from Match a colour' }]);
  await snap(page, 'shop-match');
  // tapping it again takes it off
  await btns.first().click(); await idle(page);
  assert.deepEqual(await wish(page), []);
  await btns.first().click(); await idle(page);
  await page.click('#matchClose');
  assert.equal((await page.textContent('#ownView [data-v="wish"]')).trim(), 'To buy (1)');
  assert.deepEqual(errors, []);
});

test('the marker sheet adds markers you don’t own; ink OK / running low / dry for ones you do', async () => {
  const { page, errors } = await openApp();
  await welcome(page, 'look');
  await markers(page, 'all');
  const u = await firstUnowned(page), o = await firstOwned(page);
  await openSheet(page, u);
  assert.ok(!(await page.isVisible('#mkInk')), 'no ink control for a marker you don’t own');
  assert.equal((await page.textContent('#mkWish .wishbtn')).trim(), '+ To buy');
  await page.click('#mkWish .wishbtn'); await idle(page);
  assert.equal((await page.textContent('#mkWish .wishbtn')).trim(), '✓ To buy');
  await page.click('#mkClose');
  // an owned marker: ink control, no add button until it runs low
  await openSheet(page, o);
  assert.ok(await page.isVisible('#mkInk'));
  assert.equal(await page.getAttribute('#mkInk button.on', 'data-ink'), '');
  assert.ok(!(await page.isVisible('#mkWish')));
  await page.click('#mkInk [data-ink="low"]'); await idle(page);
  assert.equal(await page.getAttribute('#mkInk button.on', 'data-ink'), 'low');
  assert.ok(await page.isVisible('#mkWish .wishbtn'), 'running low offers a replacement');
  await snap(page, 'shop-sheet');
  await page.click('#mkWish .wishbtn'); await idle(page);
  const w = await wish(page);
  assert.equal(w.length, 2);
  assert.equal(w[0].why, 'from Markers');
  assert.equal(w[1].why, 'running low');
  await page.click('#mkClose');
  assert.equal(await page.textContent(`.cell[data-i="${o}"] .inkb`), 'low', 'running-low badge in the grid');
  assert.deepEqual(errors, []);
});

test('the blend plan and the shading note add their suggestions', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await onlyGuideMarkers(page); await idle(page);
  await page.evaluate(() => document.getElementById('sfPlan').click());
  await page.waitForSelector('#sfPlanOverlay.on');
  const chips = page.locator('#sfPlanBuy .wishchip');
  const n = await chips.count();
  assert.ok(n >= 2, 'the plan’s “add N markers” are buttons');
  const base = await chips.first().getAttribute('data-why');
  assert.match(base, /^blend for \S+/);
  await chips.first().click(); await idle(page);
  assert.equal(await chips.first().getAttribute('aria-pressed'), 'true');
  assert.equal(await page.textContent('#sfPlanBuy .wishchip.on .wmk'), '✓');
  await page.click('#sfPlanBuy .wishall'); await idle(page);
  assert.equal((await wish(page)).length, n, 'add all adds the rest');
  assert.equal((await page.textContent('#sfPlanBuy .wishall')).trim(), '✓ All on your To buy list');
  // Undo on the toast takes back the ones "add all" added
  await page.click('#toastAct'); await idle(page);
  assert.equal((await wish(page)).length, 1);
  await page.keyboard.press('Escape'); await idle(page);
  // shading: "Richer with" markers, inside the one-line suggestions once it's opened
  await page.click('.sftabbtn[data-t="shading"]'); await page.click('#sfShade [data-v="full"]'); await idle(page);
  assert.match(await page.textContent('.sfshnote .sfonelh'), /\d+ markers? would make the shading richer/);
  assert.equal(await page.isVisible('.sfshnote .wishchip'), false, 'collapsed at first');
  await page.click('#sfShNoteT');
  const sh = page.locator('.sfshnote .wishchip');
  assert.ok(await sh.count() >= 1);
  const k = await sh.first().getAttribute('data-wk');
  await sh.first().click(); await idle(page);
  const w = await wish(page);
  assert.equal(w.length, 2);
  assert.equal(w[1].k, k);
  assert.match(w[1].why, /^shading for \S+/);
  assert.deepEqual(errors, []);
});

const SEEDED = (wish, ink) => ({ 'ohuhu-hb320-picker-v3': JSON.stringify({ mode: 'collection', collView: 'wish', owned: ['Ohuhu|R16', 'Ohuhu|B08', 'Ohuhu|YR04'], ownedSeedV: 2, copicAdd1: 1, libAdj1: 1, setFix1: 1, wish, ink }), 'ms-onboarded': '1', 'ms-setup-tip': '1' });
const LIST = [{ k: 'Ohuhu|R15', why: 'blend for R16', ts: 1 }, { k: 'Copic|E09', why: 'from Match a colour', ts: 2 }, { k: 'Ohuhu|B05', why: 'shading for B08', ts: 3 }, { k: 'Ohuhu|YR04', why: 'running low', ts: 4 }];

test('To buy lists them with reasons; Bought ✓ (with Undo), remove, copy and share', async () => {
  const { page, errors } = await openApp({ storage: SEEDED(LIST, { 'Ohuhu|YR04': 'low' }) });
  await page.waitForSelector('#wishView .wrow');
  assert.equal((await page.textContent('#ownView [data-v="wish"]')).trim(), 'To buy (4)');
  assert.ok(!(await page.isVisible('#results')), 'the grid is hidden in this view');
  const rows = await page.evaluate(() => [...document.querySelectorAll('#wishView .wrow')].map((r) => r.querySelector('.wcode b').textContent + ' | ' + r.querySelector('.wwhy').textContent));
  assert.deepEqual(rows, ['R15 | blend for R16', 'B05 | shading for B08', 'YR04 | running low', 'E09 | from Match a colour']);
  assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('#wishView .rghead')].map((h) => h.firstChild.textContent.trim())), ['Ohuhu', 'Copic']);
  await snap(page, 'shop-tobuy');
  // copy: plain text grouped by brand
  await page.evaluate(() => { navigator.clipboard.writeText = async (t) => { window.__copied = t; }; });
  await page.click('#wishCopy'); await idle(page);
  assert.equal(await page.evaluate(() => window.__copied), 'Ohuhu: R15, B05, YR04 · Copic: E09');
  assert.equal((await page.textContent('#wishCopy')).trim(), 'Copied ✓');
  // share: only offered where the phone can share
  assert.equal(await page.$('#wishShare'), null);
  await page.evaluate(() => { navigator.share = async (d) => { window.__shared = d; }; renderWish(); });
  await page.click('#wishShare'); await idle(page);
  assert.match(await page.evaluate(() => window.__shared.text), /Ohuhu: R15, B05, YR04 · Copic: E09/);
  // Bought ✓: into the collection, off the list, Undo puts it all back
  await page.click('#wishView .wrow[data-k="Ohuhu|R15"] .wbought'); await idle(page);
  assert.ok(await page.evaluate(() => state.owned.has('Ohuhu|R15')));
  assert.equal((await wish(page)).length, 3);
  assert.match(await page.textContent('#msToast'), /Added Ohuhu R15 to your collection/);
  await page.click('#toastAct'); await idle(page);
  assert.ok(await page.evaluate(() => !state.owned.has('Ohuhu|R15')), 'Undo un-owns it');
  assert.equal((await wish(page))[0].k, 'Ohuhu|R15', 'and puts it back in its place');
  // a running-low one: bought means fresh ink
  await page.click('#wishView .wrow[data-k="Ohuhu|YR04"] .wbought'); await idle(page);
  assert.equal(await page.evaluate(() => state.ink['Ohuhu|YR04'] || ''), '');
  assert.match(await page.textContent('#msToast'), /fresh again/);
  // remove ✕
  await page.click('#wishView .wrow[data-k="Copic|E09"] .wrm'); await idle(page);
  assert.deepEqual((await wish(page)).map((w) => w.k), ['Ohuhu|R15', 'Ohuhu|B05']);
  assert.equal((await page.textContent('#ownView [data-v="wish"]')).trim(), 'To buy (2)');
  // it all survives a reload
  await page.reload(); await page.waitForSelector('#wishView .wrow');
  assert.deepEqual((await wish(page)).map((w) => w.k), ['Ohuhu|R15', 'Ohuhu|B05']);
  assert.ok(await page.evaluate(() => state.owned.has('Ohuhu|YR04') && !state.ink['Ohuhu|YR04']));
  // empty state explains how to add
  await page.click('#wishView .wrm'); await page.click('#wishView .wrm'); await idle(page);
  assert.match(await page.textContent('#wishView .wishempty'), /To buy list is empty.*\+ To buy/s);
  assert.equal((await page.textContent('#ownView [data-v="wish"]')).trim(), 'To buy');
  assert.deepEqual(errors, []);
});

test('the list and ink are in the backup, and come back on restore', async () => {
  const { page, errors } = await openApp({ storage: SEEDED(LIST.slice(0, 2), { 'Ohuhu|B08': 'dry' }) });
  await page.waitForSelector('#wishView .wrow');
  await page.click('#mHome'); await page.click('#homeLibCard');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#guidesBackup')]);
  const file = await dl.path();
  const data = JSON.parse(await readFile(file, 'utf8'));
  assert.deepEqual(data.wish.map((w) => w.k), ['Ohuhu|R15', 'Copic|E09']);
  assert.deepEqual(data.ink, { 'Ohuhu|B08': 'dry' });
  // same markers: the backup's list merges back in
  await page.evaluate(() => { state.wish = []; state.ink = {}; save(); });
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#guidesRestore')]);
  await fc.setFiles(file); await idle(page);
  assert.deepEqual((await wish(page)).map((w) => w.k), ['Ohuhu|R15', 'Copic|E09']);
  assert.equal(await page.evaluate(() => state.ink['Ohuhu|B08']), 'dry');
  // different markers, and you choose the backup's: its list and ink replace these
  await page.evaluate(() => { state.owned.add('Ohuhu|R22'); state.wish = [{ k: 'Ohuhu|G43', why: 'x', ts: 1 }]; state.ink = { 'Ohuhu|R16': 'low' }; save(); });
  await answerAsks(page, true);
  const [fc2] = await Promise.all([page.waitForEvent('filechooser'), page.click('#guidesRestore')]);
  await fc2.setFiles(file); await idle(page);
  assert.deepEqual((await wish(page)).map((w) => w.k), ['Ohuhu|R15', 'Copic|E09']);
  assert.deepEqual(await page.evaluate(() => state.ink), { 'Ohuhu|B08': 'dry' });
  assert.deepEqual(errors, []);
});

test('a dry marker is left out of palettes, Match and the guide’s markers, and has a badge', async () => {
  const { page, errors } = await openApp();
  await welcome(page, 'look');
  await markers(page);
  const o = await firstOwned(page);
  const k = await page.evaluate((o) => mkey(o), o);
  await openSheet(page, o);
  await page.click('#mkInk [data-ink="dry"]'); await idle(page);
  assert.match(await page.textContent('#mkInk .mkinknote'), /Left out of new palettes and guides/);
  assert.equal((await page.textContent('#mkWish .wishbtn')).trim(), '+ To buy');
  await page.click('#mkWish .wishbtn');
  assert.equal((await wish(page))[0].why, 'ran dry');
  await page.click('#mkClose');
  assert.equal(await page.textContent(`.cell[data-i="${o}"] .inkb.dry`), 'dry', 'dry badge in the grid');
  await page.locator(`.cell[data-i="${o}"]`).scrollIntoViewIfNeeded(); await snap(page, 'shop-dry-badge');
  const r = await page.evaluate(({ o, k }) => {
    let seen = 0; for (let n = 0; n < 60; n++) { const p = genPalette(8, 'mono') || []; if (p.includes(o)) seen++; }
    return { pool: inPool(o), seen, coll: sfCollection().some((m) => m.mkey === k), still: isOwned(o) };
  }, { o, k });
  assert.equal(r.pool, false, 'not in the palette pool');
  assert.equal(r.seen, 0, 'never picked for a new palette');
  assert.equal(r.coll, false, 'not in the guide’s marker list');
  assert.equal(r.still, true, 'still counted as yours in Markers');
  // Match: its own colour no longer finds it among your markers
  const hex = await page.evaluate((o) => COLORS[o].hex, o), code = await page.evaluate((o) => COLORS[o].code, o);
  await page.click('#mkMatchBtn'); await page.click('.msrc [data-src="hex"]');
  await page.fill('#matchHex', hex); await idle(page);
  assert.notEqual((await page.textContent('#matchResult .mbname b')).trim(), code);
  await page.click('#matchClose');
  // back to OK: used again
  await openSheet(page, o);
  await page.click('#mkInk [data-ink=""]'); await idle(page);
  assert.equal(await page.evaluate((o) => inPool(o), o), true);
  assert.equal(await page.$(`.cell[data-i="${o}"] .inkb`), null);
  assert.deepEqual(errors, []);
});

const photoOf = (page, draw) => page.evaluate(async (draw) => {
  const c = document.createElement('canvas'); c.width = 600; c.height = 800; const g = c.getContext('2d');
  new Function('g', draw)(g);
  const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
  return await new Promise((r) => { const f = new FileReader(); f.onload = () => r(f.result.split(',')[1]); f.readAsDataURL(blob); });
}, draw);

test('the photo pattern’s “Closer with” markers can go on the list', async () => {
  const { page, errors } = await openApp();
  // Honolulu 24 and a photo in colours it can't match well
  await haveSet(page); await page.check('#wcSets input[data-i="0"]'); await page.click('#wcAdd'); await page.click('#wcSample');
  await page.waitForFunction(() => !!(window.__mstest && __mstest.assignData));
  const b64 = await photoOf(page, "const gr=g.createLinearGradient(0,0,600,800);gr.addColorStop(0,'#0bd6c8');gr.addColorStop(0.5,'#8a2be2');gr.addColorStop(1,'#39ff14');g.fillStyle=gr;g.fillRect(0,0,600,800);");
  await page.click('.sftabbtn[data-t="pattern"]');
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#sfFam [data-v="photo"]')]);
  await fc.setFiles({ name: 'ref.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
  await page.waitForFunction(() => !!__mstest.photoRef); await idle(page);
  const chips = page.locator('.sfphwant .wishchip');
  assert.ok(await chips.count() >= 1, 'the suggestions are buttons');
  const k = await chips.first().getAttribute('data-wk');
  await chips.first().click(); await idle(page);
  assert.deepEqual(await wish(page), [{ k, why: 'closer to your photo' }]);
  assert.equal(await page.textContent('.sfphwant .wishchip.on .wmk'), '✓');
  assert.deepEqual(errors, []);
});

// ---- From the fourth review (data safety) ----
// Save (a new guide into the Library), done once the header says so
const saveNew = (page) => saveGuide(page);

const AUTO = 2300; // idle(page, AUTO): until auto-save (1.5 s after the last change) has run
const savedId = (page) => page.evaluate(() => state.saved.find((s) => s.type === 'guide').id);
const stored = (page, id) => page.evaluate((id) => IDB.get('guide-' + id).then((p) => p && { prog: (p.prog || []).length, assign: p.assign, tones: p.tones || {}, ref: p.ref || null, base: p.base || null, style: p.style }), id);
const tickN = (page, n, from = 0) => page.evaluate(([n, from]) => { const t = __mstest; t.assignData.order.slice(from, from + n).forEach((l) => { t.colored[l] = 1; }); t.guideDirty = true; t.renderGuide(); }, [n, from]);
// reopen a Library guide the way the Library does
const openSaved = async (page, id) => { await page.evaluate((id) => loadGuide({ id }), id); await page.waitForFunction((id) => __mstest.curId === id && __mstest.assignData, id, { timeout: 10000 }); await idle(page); };

test('dry markers: the guide keeps them; sections still to colour show a stand-in, done ones the marker itself', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await tickN(page, 4); await saveNew(page);
  const id = await savedId(page), s0 = await stored(page, id);
  // the marker of a done section, which undone sections use too, runs dry (the gradient shares markers out by area,
  // so the first section, if it's a big one, can have a marker to itself)
  const k = await page.evaluate(() => {
    const a = __mstest.assignData, c = __mstest.colored;
    return a.order.filter((l) => c[l]).map((l) => a.assign[l].mkey).find((k) => a.order.some((l) => !c[l] && a.assign[l].mkey === k));
  });
  assert.ok(k);
  await page.evaluate((k) => { state.ink[k] = 'dry'; save(); }, k);
  await page.reload(); await idle(page); await openSaved(page, id);
  assert.match(await page.textContent('#sfMeta'), /dry/);
  const done = await page.evaluate((k) => __mstest.assignData.order.filter((l) => __mstest.colored[l] && __mstest.assignData.assign[l].mkey === k).length, k);
  assert.ok(done >= 1, 'a done section still shows the dry marker');
  assert.ok(await page.evaluate((k) => __mstest.assignData.order.some((l) => !__mstest.colored[l] && __mstest.assignData.assign[l].mkey !== k), k));
  // a tick elsewhere saves; the saved markers are unchanged
  await tickN(page, 1, 10); await idle(page, AUTO);
  const s1 = await stored(page, id);
  assert.deepEqual(s1.assign, s0.assign, 'the saved markers are kept');
  assert.equal(s1.prog, 5);
  // every owned marker dry: the guide still opens with all its sections, and a change saves the whole plan
  await page.evaluate(() => { for (const x of state.owned) state.ink[x] = 'dry'; save(); });
  await page.reload(); await idle(page); await openSaved(page, id);
  assert.equal(await page.evaluate(() => __mstest.assignData.N), Object.keys(s0.assign).length);
  await tickN(page, 1, 12); await idle(page, AUTO);
  assert.deepEqual((await stored(page, id)).assign, s0.assign);
  assert.deepEqual(errors, []);
});

// ---- From the fifth review (outside the guide screen) ----
const KEY = 'ohuhu-hb320-picker-v3';
const onboarded = (extra = {}) => ({ 'ms-onboarded': '1', 'ms-setup-tip': '1', 'ms-last-ver': 'v265', ...extra });
const OWN = ['Ohuhu|R014', 'Ohuhu|Y111', 'Ohuhu|B08', 'Ohuhu|G36', 'Ohuhu|BV310', 'Ohuhu|YR313', 'Ohuhu|RV08', 'Ohuhu|BG311'];
const appState = (extra = {}) => JSON.stringify({ mode: 'home', ownedSeedV: 2, copicAdd1: 1, libAdj1: 1, setFix1: 1, owned: OWN, saved: [], ...extra });
const toastText = (page) => page.evaluate(() => { const t = document.getElementById('msToast'); return t && t.classList.contains('on') ? t.textContent : ''; });

test('To buy › Bought ✓ on a marker you already own with no ink note says it was removed from To buy', async () => {
  const { page, errors } = await openApp({ storage: onboarded({ [KEY]: appState({ collView: 'wish', wish: [{ k: 'Ohuhu|R014', why: 'x', ts: 1 }] }) }) });
  await page.click('#mCollection'); await page.click('#wishView [data-bought="Ohuhu|R014"]');
  assert.match(await toastText(page), /^Removed Ohuhu R014 from To buy\./);
  assert.deepEqual(errors, []);
});

// ---- From v265 ----
// visible text that still says "shopping list" or a "List" button
const OLD = /shopping list|\+ ?List\b|Add all to list|On your list|On list\b|Add to shopping list/i;
const oldWords = (page) => page.evaluate((src) => { const re = new RegExp(src, 'i'), out = []; if (re.test(document.body.innerText)) out.push(document.body.innerText.match(re)[0]); document.querySelectorAll('[aria-label],[title]').forEach((e) => { const t = (e.getAttribute('aria-label') || '') + ' ' + (e.getAttribute('title') || ''); if (re.test(t)) out.push(t); }); return out; }, OLD.source);

test('To buy everywhere: Match, the marker sheet, the To buy view, the swatch sheet', async () => {
  const { page, errors } = await openApp();
  await welcome(page, 'look');
  await page.click('#mCollection'); await idle(page);
  await page.click('#mkMatchBtn');
  await page.click('.msrc [data-src="hex"]');
  await page.fill('#matchHex', '#40e0d0'); await idle(page); // (clearly closer markers to buy, as above)
  const b = page.locator('#matchResult .mrow .wishbtn').first();
  assert.equal((await b.textContent()).trim(), '+ To buy');
  assert.match(await b.getAttribute('aria-label'), /^Add to your To buy list: (Ohuhu|Copic) \S+$/);
  await b.click(); await page.waitForSelector('#matchResult .mrow .wishbtn.on');
  assert.equal((await b.textContent()).trim(), '✓ To buy');
  assert.match(await b.getAttribute('aria-label'), /^On your To buy list: /);
  assert.match(await toastText(page), /^(Ohuhu|Copic) \S+ added to your To buy list/);
  assert.deepEqual(await oldWords(page), []);
  await b.click(); await page.waitForFunction(() => /^Took (Ohuhu|Copic) \S+ off To buy\.$/.test(document.getElementById('msToast').textContent));
  await page.click('#matchClose');
  // the marker sheet
  const u = await page.evaluate(() => COLORS.findIndex((c, i) => c.brand === 'Ohuhu' && !isOwned(i)));
  await page.evaluate((i) => openMarkerSheet(i), u); await page.waitForSelector('#mkOverlay.on');
  assert.equal((await page.textContent('#mkWish .wishbtn')).trim(), '+ To buy');
  await page.click('#mkWish .wishbtn'); await page.waitForSelector('#mkWish .wishbtn.on');
  assert.equal((await page.textContent('#mkWish .wishbtn')).trim(), '✓ To buy');
  assert.deepEqual(await oldWords(page), []);
  await page.click('#mkClose');
  // the To buy view: tab, heading, remove, empty
  await page.click('#ownView [data-v="wish"]'); await idle(page);
  assert.equal((await page.textContent('#ownView [data-v="wish"]')).trim(), 'To buy (1)');
  assert.deepEqual(await page.$eval('#wishView .pile-head', (h) => [h.querySelector('.lbl').textContent, h.querySelector('.n').textContent]), ['To buy', '(1)']);
  assert.match(await page.getAttribute('#wishView .wrm', 'aria-label'), /from your To buy list$/);
  assert.deepEqual(await oldWords(page), []);
  await page.click('#wishView .wrm'); await page.waitForSelector('#wishView .wishempty');
  assert.match(await toastText(page), /from your To buy list\./);
  assert.match(await page.textContent('#wishView .wishempty'), /Your To buy list is empty\..*tap \+ To buy to add it here/s);
  assert.deepEqual(await oldWords(page), []);
  // the swatch chart's choice
  await page.click('#ownView [data-v="owned"]'); await idle(page);
  await page.click('#swatchBtn'); await page.waitForSelector('#swOverlay.on');
  assert.ok((await page.$$eval('#swOpts [data-k="what"]', (bs) => bs.map((x) => x.textContent))).includes('To buy'));
  await page.click('#swOpts [data-k="what"][data-v="wish"]');
  assert.match(await page.textContent('#swSum'), /Your To buy list is empty/);
  assert.deepEqual(await oldWords(page), []);
  assert.deepEqual(errors, []);
});

test('To buy in the guide: the start card, blend plan, shading and photo notes', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  assert.match(await page.evaluate(() => document.getElementById('sfRoot').innerHTML), /a To buy list for shades you still need/);
  await onlyGuideMarkers(page); await idle(page);
  await page.evaluate(() => document.getElementById('sfPlan').click());
  await page.waitForSelector('#sfPlanOverlay.on');
  assert.equal((await page.textContent('#sfPlanBuy .wishall')).trim(), 'Add all to To buy');
  assert.match(await page.getAttribute('#sfPlanBuy .wishchip', 'aria-label'), /^Add to your To buy list: /);
  assert.deepEqual(await oldWords(page), []);
  await page.click('#sfPlanBuy .wishall'); await idle(page);
  assert.equal((await page.textContent('#sfPlanBuy .wishall')).trim(), '✓ All on your To buy list');
  assert.match(await toastText(page), /to your To buy list\./);
  await page.click('#sfPlanBuy .wishall'); await idle(page);
  assert.match(await toastText(page), /They’re all on your To buy list already\./);
  await page.keyboard.press('Escape'); await idle(page);
  await page.click('.sftabbtn[data-t="shading"]'); await page.click('#sfShade [data-v="full"]'); await idle(page);
  await page.click('#sfShNoteT'); await idle(page);
  if (await page.locator('.sfshnote .wishall').count()) assert.match((await page.textContent('.sfshnote .wishall')).trim(), /^(Add all to To buy|✓ All on your To buy list)$/);
  assert.match(await page.getAttribute('.sfshnote .wishchip', 'aria-label'), /To buy list: /);
  assert.deepEqual(await oldWords(page), []);
  // the photo note's chips come from the same builders
  const chip = await page.evaluate(() => { const d = document.createElement('div'); d.innerHTML = wishChipHTML('Copic|E09', 'closer to your photo', 'E09') + wishAllHTML([['Copic|E09', 'x'], ['Copic|E07', 'x']]); return [d.firstChild.getAttribute('aria-label'), d.lastChild.textContent]; });
  assert.deepEqual(chip, ['Add to your To buy list: Copic E09', 'Add all to To buy']);
  assert.deepEqual(errors, []);
});
