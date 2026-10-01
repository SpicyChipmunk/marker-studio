// Lost guides (from v267): guides stored on this device but missing from the Library are found and offered back (on
// Home at start, in the unreadable-data note when that is about guides, and from Help › Your data).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { setup, teardown, openApp, idle, ARTIFACTS } from './helpers.mjs';

before(setup);
after(teardown);

// ---- From v267 ----
const KEY = 'ohuhu-hb320-picker-v3';
const DAY = 864e5;
const OWN = ['Ohuhu|R014', 'Ohuhu|Y111', 'Ohuhu|B08'];
const appState = (extra = {}) => JSON.stringify({ mode: 'home', ownedSeedV: 2, copicAdd1: 1, libAdj1: 1, setFix1: 1, owned: OWN, saved: [], ...extra });
const onboarded = (extra = {}) => ({ 'ms-onboarded': '1', 'ms-setup-tip': '1', ...extra });
const shown = (page, id) => page.evaluate((id) => { const e = document.getElementById(id); return !!e && e.style.display !== 'none' && e.getClientRects().length > 0; }, id);
const toastText = (page) => page.evaluate(() => { const t = document.getElementById('msToast'); return t && t.classList.contains('on') ? t.textContent : ''; });
const top = (page, sel) => page.evaluate((s) => document.querySelector(s).getBoundingClientRect().top, sel);
const SHOTS = ARTIFACTS; // screenshots for a person to look at, with the other tests' (not checked in)
const snap = async (page, name) => { await mkdir(SHOTS, { recursive: true }); await page.screenshot({ path: `${SHOTS}/b-${name}.png` }); };

// --- lost guides ---
// a tiny label map is enough for a guide to be read back
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const payload = (extra = {}) => ({ lmap: PNG, assign: { 0: 'Ohuhu|R014' }, prog: [], ...extra });
const T0 = Date.now() - 10 * DAY;
const ORPHAN = T0 + 1, NAMED = T0 + 2, PENDING = T0 + 3, KEPT = T0 + 4;
const kept = { id: KEPT, type: 'guide', name: 'Kept', ts: T0, keys: ['Ohuhu|R014'], W: 1, H: 1, n: 1 };
// write stored guides straight into IndexedDB (as an earlier visit would have), then start again
async function seed(page, guides, extra = {}) {
  await page.evaluate(async ({ guides, extra }) => {
    for (const [k, v] of Object.entries(guides)) await IDB.put(k, v);
    for (const [k, v] of Object.entries(extra)) localStorage.setItem(k, v);
  }, { guides, extra });
  await page.reload();
}
const lostCard = (page) => page.waitForSelector('#lostNote', { state: 'visible' });
const noLostCard = async (page) => { await idle(page, 2600); return !(await shown(page, 'lostNote')); };

test('lost guides: found at start (not the Resume slot, a delete still finishing or what’s in the Library), and added back', async () => {
  const { page, errors } = await openApp({ storage: onboarded({ [KEY]: appState({ saved: [kept] }), 'ms-seen-hints': '["along"]' }) });
  await seed(page, {
    ['guide-' + ORPHAN]: payload(),
    ['guide-' + NAMED]: payload({ name: 'Owl', prog: [0] }),
    ['guide-' + PENDING]: payload({ name: 'Deleted' }),
    ['guide-' + KEPT]: payload(),
    'guide-autosave': { name: 'Slot', W: 1, H: 1, keys: [], payload: payload() },
  }, { 'ms-lib-deleting': JSON.stringify([{ id: PENDING, t: Date.now(), tab: 'another-tab' }]) });
  await lostCard(page);
  assert.equal((await page.textContent('#lostNote .ntxt')).trim(), 'Found 2 guides that aren’t in your Library. They’re still stored on this device.');
  assert.equal(await shown(page, 'loadNote'), false);
  // above the tiles, under Resume and the unreadable-data note's place, not one of the cards under the tiles
  assert.ok(await top(page, '#loadNote') <= await top(page, '#lostNote'));
  assert.ok(await top(page, '#lostNote') < await top(page, '#homeNew'));
  await snap(page, 'lost-card');

  await page.click('#lostAdd');
  await page.waitForSelector('#lostNote', { state: 'hidden' });
  assert.equal(await toastText(page), 'Added 2 guides back to your Library');
  const got = await page.evaluate(() => state.saved.filter((s) => s.type === 'guide').map((s) => ({ id: s.id, name: s.name, W: s.W, H: s.H, keys: s.keys, n: s.n, bk: s.bk || 0 })));
  assert.deepEqual(got.map((g) => g.name).sort(), ['Kept', 'Owl', 'Recovered guide']);
  const owl = got.find((g) => g.name === 'Owl');
  assert.deepEqual({ id: owl.id, W: owl.W, H: owl.H, keys: owl.keys, n: owl.n, bk: owl.bk }, { id: NAMED, W: 1, H: 1, keys: ['Ohuhu|R014'], n: 1, bk: 0 });
  assert.equal(got.find((g) => g.name === 'Recovered guide').id, ORPHAN);
  assert.equal(await page.evaluate((id) => state.saved.find((s) => s.id === id).done, NAMED), 1, 'progress from the guide');
  // not backed up: the backup reminder counts them
  assert.equal(await page.evaluate(() => guidesAtRisk()), 3);
  // a picture drawn from each
  await page.waitForFunction(({ a, b }) => [a, b].every((id) => /^data:image\/jpeg;base64,/.test((state.saved.find((s) => s.id === id) || {}).thumb || '')), { a: ORPHAN, b: NAMED });
  // kept, in the Library and on Home, and not offered again
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('ohuhu-hb320-picker-v3')).saved.map((s) => s.name));
  assert.ok(stored.includes('Owl') && stored.includes('Recovered guide'));
  await page.click('#homeLibCard'); await page.waitForSelector('#savedOverlay.on');
  const rows = await page.$$eval('#savedList .srow .sname', (l) => l.map((x) => x.textContent));
  assert.ok(rows.includes('Owl') && rows.includes('Recovered guide'), rows.join());
  assert.equal(await page.evaluate((id) => !!document.querySelector(`.srow[data-id="${id}"] img.sthumb`), ORPHAN), true, 'with its picture');
  await page.reload();
  assert.ok(await noLostCard(page), 'nothing left to find');
  // the deleted one is gone, never brought back
  assert.equal(await page.evaluate((id) => state.saved.some((s) => s.id === id), PENDING), false);
  // a second one found later is "Recovered guide 2"
  await seed(page, { ['guide-' + (T0 + 5)]: payload() });
  await lostCard(page);
  assert.equal((await page.textContent('#lostNote .ntxt')).trim(), 'Found 1 guide that isn’t in your Library. It’s still stored on this device.');
  assert.equal(await page.textContent('#lostAdd'), 'Add it back');
  await page.click('#lostAdd'); await page.waitForSelector('#lostNote', { state: 'hidden' });
  assert.equal(await toastText(page), 'Added 1 guide back to your Library');
  assert.equal(await page.evaluate((id) => state.saved.find((s) => s.id === id).name, T0 + 5), 'Recovered guide 2');
  assert.deepEqual(errors, []);
});

test('lost guides: Not now hides the card until the next start; one that can’t be read isn’t offered again', async () => {
  const { page, errors } = await openApp({ storage: onboarded({ [KEY]: appState() }) });
  await seed(page, { ['guide-' + ORPHAN]: payload() });
  await lostCard(page);
  await page.focus('#lostLater'); await page.keyboard.press('Enter');
  await page.waitForSelector('#lostNote', { state: 'hidden' });
  assert.equal(await page.evaluate(() => document.activeElement.id), 'homeNew', 'focus goes to New colouring guide');
  await page.click('#mCollection'); await page.click('#mHome');
  assert.equal(await shown(page, 'lostNote'), false, 'not back this visit');
  await page.reload();
  await lostCard(page);
  assert.match(await page.textContent('#lostNote'), /Found 1 guide/, 'back at the next start');

  // a stored guide that can't be read: said once, then left alone
  await seed(page, { ['guide-' + (T0 + 9)]: { lmap: 'nope' } });
  await lostCard(page);
  assert.match(await page.textContent('#lostNote'), /Found 2 guides/);
  await page.click('#lostAdd'); await page.waitForSelector('#lostNote', { state: 'hidden' });
  assert.equal(await toastText(page), 'Added 1 guide back to your Library. 1 guide couldn’t be read and was left out.');
  await page.reload();
  assert.ok(await noLostCard(page));
  assert.deepEqual(errors, []);
});

test('lost guides: a guide another tab is saving right now is never offered', async () => {
  const { ctx, page, errors } = await openApp({ storage: onboarded({ [KEY]: appState() }) });
  await idle(page);
  // the other tab writes the stored guide first and its Library entry a moment later (as sfSaveDesign does)
  const other = await ctx.newPage();
  await other.goto(page.url());
  await other.evaluate((T0) => IDB.put('guide-' + T0, { lmap: 'x' }), T0 + 7);
  await page.click('#homeHelp'); await page.waitForSelector('#helpOverlay.on');
  await page.click('#helpData > summary');
  await page.click('#helpLost'); await idle(page); // the first look has seen it
  await other.evaluate((T0) => { state.saved.unshift({ id: T0, type: 'guide', name: 'Busy', ts: Date.now(), keys: [], W: 1, H: 1, n: 1 }); save(); }, T0 + 7);
  await page.waitForFunction(() => /No lost guides found|Found/.test(document.getElementById('helpLostRes').textContent) && !document.getElementById('helpLost').disabled);
  assert.equal(await page.textContent('#helpLostRes'), 'No lost guides found.');
  // the same for a guide being deleted: its entry goes first, then the stored guide
  await other.evaluate((T0) => sfDeleteDesign(T0), T0 + 7);
  await page.click('#helpLost');
  await page.waitForFunction(() => !document.getElementById('helpLost').disabled && !/Looking/.test(document.getElementById('helpLostRes').textContent));
  assert.equal(await page.textContent('#helpLostRes'), 'No lost guides found.');
  assert.equal(await other.evaluate((T0) => IDB.get('guide-' + T0), T0 + 7), undefined, 'deleted');
  assert.equal(await other.evaluate(() => localStorage.getItem('ms-lib-deleting')), null, 'and the delete finished');
  assert.deepEqual(errors, []);
});

test('lost guides: one card with the unreadable-data note when that is about guides', async () => {
  const bad = [{ id: 'x', type: 'guide' }, { id: -2, type: 'guide' }];
  const { page, errors } = await openApp({ storage: onboarded({ [KEY]: appState({ saved: bad }) }) });
  await seed(page, { ['guide-' + ORPHAN]: payload(), ['guide-' + NAMED]: payload({ name: 'Owl' }) });
  await page.waitForSelector('#lnAdd');
  assert.equal(await shown(page, 'lostNote'), false, 'one card, not two');
  assert.equal((await page.textContent('#loadNote .ntxt')).trim(), '2 guides couldn’t be read — found 2 on this device. Add them back to your Library. A copy of the original was kept.');
  assert.deepEqual(await page.$$eval('#loadNote .nrow button', (l) => l.map((b) => b.textContent)), ['Add them back', 'Download the original', 'OK']);
  await snap(page, 'lost-combined');
  await page.click('#lnAdd');
  await page.waitForFunction(() => !document.getElementById('lnAdd'));
  assert.equal(await toastText(page), 'Added 2 guides back to your Library');
  assert.equal((await page.textContent('#loadNote .ntxt')).trim(), '2 guides couldn’t be read and were left out. A copy of the original was kept.', 'the note stays, as it was');
  assert.deepEqual(await page.$$eval('#loadNote .nrow button', (l) => l.map((b) => b.textContent)), ['Download the original', 'OK']);
  assert.equal(await shown(page, 'lostNote'), false);
  assert.deepEqual(errors, []);

  // OK puts away both: the note for good, the lost guides until the next start (then in a card of their own)
  const b = await openApp({ storage: onboarded({ [KEY]: appState({ saved: bad }) }) });
  await seed(b.page, { ['guide-' + ORPHAN]: payload() });
  await b.page.waitForSelector('#lnAdd');
  assert.match(await b.page.textContent('#loadNote .ntxt'), /^2 guides couldn’t be read — found 1 on this device\. Add it back/);
  await b.page.click('#lnOk');
  await b.page.waitForSelector('#loadNote', { state: 'hidden' });
  assert.equal(await shown(b.page, 'lostNote'), false);
  await b.page.reload();
  await lostCard(b.page);
  assert.equal(await shown(b.page, 'loadNote'), false);
  assert.deepEqual(b.errors, []);

  // Download the original deals with the note; the lost guides are then offered in their own card
  const c = await openApp({ storage: onboarded({ [KEY]: appState({ saved: bad }) }) });
  await seed(c.page, { ['guide-' + ORPHAN]: payload() });
  await c.page.waitForSelector('#lnAdd');
  await Promise.all([c.page.waitForEvent('download'), c.page.click('#lnSave')]);
  await c.page.waitForSelector('#loadNote', { state: 'hidden' });
  await lostCard(c.page);
  assert.match(await c.page.textContent('#lostNote'), /Found 1 guide that isn’t in your Library/);

  // a note about markers only: two cards, each saying its own
  const d = await openApp({ storage: onboarded({ [KEY]: appState({ owned: [...OWN, 42] }) }) });
  await seed(d.page, { ['guide-' + ORPHAN]: payload() });
  await lostCard(d.page);
  assert.ok(await shown(d.page, 'loadNote'));
  assert.equal((await d.page.textContent('#loadNote .ntxt')).trim(), '1 marker couldn’t be read and was left out. A copy of the original was kept.');
  assert.ok(await top(d.page, '#loadNote') < await top(d.page, '#lostNote'));
  assert.deepEqual([...c.errors, ...d.errors], []);
});

test('lost guides: the whole Library unreadable — every stored guide is offered in the note', async () => {
  const { page, errors } = await openApp({ storage: onboarded({ [KEY]: appState({ saved: 'oops' }) }) });
  await seed(page, { ['guide-' + ORPHAN]: payload(), ['guide-' + NAMED]: payload({ name: 'Owl' }), 'guide-autosave': { payload: payload() } });
  await page.waitForSelector('#lnAdd');
  assert.equal((await page.textContent('#loadNote .ntxt')).trim(), 'Your Library couldn’t be read and was left out. Found 2 guides stored on this device. Add them back to your Library. A copy of the original was kept.');
  await page.click('#lnAdd'); await page.waitForFunction(() => !document.getElementById('lnAdd'));
  assert.equal(await page.evaluate(() => state.saved.length), 2);
  assert.deepEqual(errors, []);
});

test('Help › Your data › Find lost guides: none, or some to add back', async () => {
  const { page, errors } = await openApp({ storage: onboarded({ [KEY]: appState({ saved: [kept] }) }) });
  await seed(page, { ['guide-' + KEPT]: payload(), 'guide-autosave': { payload: payload() } });
  await page.click('#homeHelp'); await page.waitForSelector('#helpOverlay.on');
  await page.click('#helpData > summary');
  assert.match(await page.textContent('#helpData'), /A guide missing from your Library may still be stored on this device\. Find lost guides looks for any and can add them back\./);
  await page.click('#helpLost');
  await page.waitForFunction(() => /No lost guides found/.test(document.getElementById('helpLostRes').textContent));
  assert.equal(await page.textContent('#helpLostRes'), 'No lost guides found.');

  // one appears (another tab's Library lost it, say): found, and added back from Help
  await page.evaluate(async (id) => { await IDB.put('guide-' + id, { lmap: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', assign: { 0: 'Ohuhu|Y111' }, name: 'Cat' }); }, ORPHAN);
  await page.click('#helpLost');
  await page.waitForSelector('#helpLostAdd');
  assert.equal((await page.textContent('#helpLostRes')).trim(), 'Found 1 guide that isn’t in your Library.Add it back');
  // Home offers it too
  assert.ok(await page.evaluate(() => document.getElementById('lostNote').style.display !== 'none'));
  await page.evaluate(() => document.getElementById('helpLostAdd').scrollIntoView({ block: 'center' }));
  await snap(page, 'help-lost-found');
  await page.click('#helpLostAdd');
  await page.waitForFunction(() => /Added/.test(document.getElementById('helpLostRes').textContent));
  assert.equal(await page.textContent('#helpLostRes'), 'Added 1 guide back to your Library.');
  assert.equal(await toastText(page), 'Added 1 guide back to your Library');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'helpLost');
  assert.equal(await page.evaluate((id) => state.saved.find((s) => s.id === id).name, ORPHAN), 'Cat');
  assert.deepEqual(await page.evaluate((id) => state.saved.find((s) => s.id === id).keys, ORPHAN), ['Ohuhu|Y111']);
  await page.click('#helpClose');
  assert.equal(await shown(page, 'lostNote'), false, 'and Home’s card went with it');
  await page.click('#homeHelp'); await page.click('#helpLost');
  await page.waitForFunction(() => /No lost guides found/.test(document.getElementById('helpLostRes').textContent));
  assert.deepEqual(errors, []);
});
