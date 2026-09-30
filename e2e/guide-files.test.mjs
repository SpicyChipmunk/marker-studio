// Opening guide files (Library › Import a guide): a broken file, a map that doesn't decode or is too big, a guide
// with too many sections, or a backup instead of a guide is turned away before anything is added.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, welcome, idle, sampleGuide } from './helpers.mjs';

before(setup);
after(teardown);

// ---- From the third full review (v259) ----
test('a broken guide file is refused before anything is added to the Library', async () => {
  const { page, errors } = await openApp();
  await welcome(page, 'look');
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.evaluate(() => { const i = document.createElement('input'); i.type = 'file'; i.onchange = () => SF.importFile(i.files[0]); document.body.appendChild(i); i.click(); })]);
  await fc.setFiles({ name: 'broken.msguide.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ name: 'Broken', payload: { lmap: 'hello' } })) });
  await idle(page);
  assert.equal(await page.evaluate(() => state.saved.filter((s) => s.name === 'Broken').length), 0);
  assert.deepEqual(errors, []);
});

// ---- From the fourth review (data safety) ----
const guides = (page) => page.evaluate(() => state.saved.filter((s) => s.type === 'guide').map((s) => ({ id: s.id, name: s.name, thumb: s.thumb, W: s.W, H: s.H })));

test('imports: a map that doesn’t decode or is too big adds nothing; odd settings are kept in range', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  const good = await page.evaluate(() => __mstest.currentDesignObj());
  const imp = (d, name) => page.evaluate(([d, name]) => { const f = new File([JSON.stringify(d)], name + '.msguide.json', { type: 'application/json' }); SF.importFile(f); }, [d, name]);
  const n0 = (await guides(page)).length;
  await imp({ ...good, payload: { ...good.payload, lmap: 'data:image/png;base64,' + 'A'.repeat(64) } }, 'bad'); await idle(page);
  const big = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 4801; c.height = 8; return c.toDataURL('image/png'); });
  await imp({ ...good, payload: { ...good.payload, lmap: big } }, 'big'); await idle(page);
  assert.equal((await guides(page)).length, n0, 'nothing added');
  await imp({ ...good, name: 'Odd', W: 99999, H: -3, payload: { ...good.payload, style: { ...good.payload.style, limitN: 1e9, blendFall: 'abc', texAmt: -5, dir: 7 } } }, 'odd');
  await page.waitForFunction(() => __mstest.curName === 'Odd' && __mstest.assignData, null, { timeout: 10000 }); await idle(page);
  const g = (await guides(page)).find((x) => x.name === 'Odd');
  assert.deepEqual([g.W, g.H], await page.evaluate(() => [__mstest.W, __mstest.H]), 'the size is the map’s');
  const st = await page.evaluate(() => __mstest.currentDesignObj().payload.style);
  assert.ok(st.limitN >= 2 && st.limitN <= 999); assert.equal(st.blendFall, 2); assert.equal(st.texAmt, 0); assert.equal(st.dir, 1);
  assert.deepEqual(errors, []);
});

// ---- From the fourth review (outside the guide screen) ----
const KEY = 'ohuhu-hb320-picker-v3';
const onboarded = (extra = {}) => ({ 'ms-onboarded': '1', 'ms-setup-tip': '1', 'ms-last-ver': 'v263', ...extra });
const OWN = ['Ohuhu|R014', 'Ohuhu|Y111', 'Ohuhu|B08', 'Ohuhu|G36', 'Ohuhu|BV310', 'Ohuhu|YR313', 'Ohuhu|RV08', 'Ohuhu|BG311'];
const appState = (extra = {}) => JSON.stringify({ mode: 'home', ownedSeedV: 2, copicAdd1: 1, libAdj1: 1, setFix1: 1, owned: OWN, saved: [], ...extra });

test('Library › Import a guide: a wrong file is said once, compactly; a backup is offered as a restore', async () => {
  const { page, errors } = await openApp({ storage: onboarded({ [KEY]: appState() }) });
  await page.click('#homeLibCard');
  await page.setInputFiles('#homeImpFile', { name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"hello":1}') }); await idle(page);
  assert.equal(await page.locator('.mserr').count(), 1, 'said once');
  assert.ok((await page.locator('.mserr').boundingBox()).height < 90, 'compact');
  assert.ok(await page.isVisible('#savedOverlay'), 'the Library stays open');
  let msg = '';
  page.once('dialog', (d) => { msg = d.message(); d.dismiss(); });
  await page.setInputFiles('#homeImpFile', { name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ v: 3, type: 'ms-backup', owned: [], saved: [], guides: [] })) }); await idle(page);
  assert.match(msg, /This is a Marker Studio backup.*Restore it\?/);
  assert.deepEqual(errors, []);
});

// ---- From the fifth review (data safety) ----
// Save (a new guide into the Library), done once the header says so
const saveNew = async (page) => { await page.click('#sfSave'); await page.waitForFunction(() => /Saved in your Library/.test(document.getElementById('sfSaveSt').textContent)); };
const savedId = (page) => page.evaluate(() => state.saved.find((s) => s.type === 'guide').id);
const guidesR5 = (page) => page.evaluate(() => state.saved.filter((s) => s.type === 'guide').map((s) => ({ id: s.id, name: s.name, thumb: s.thumb })));

// a guide whose section map has a different section on every pixel
const hostile = (page, w) => page.evaluate((w) => { const c = document.createElement('canvas'); c.width = w; c.height = w; const g = c.getContext('2d'), im = g.createImageData(w, w); for (let i = 0; i < w * w; i++) { const v = i + 1; im.data[i * 4] = v & 255; im.data[i * 4 + 1] = (v >> 8) & 255; im.data[i * 4 + 2] = (v >> 16) & 255; im.data[i * 4 + 3] = 255; } g.putImageData(im, 0, 0); return { v: 1, type: 'guide', name: 'Hostile', W: w, H: w, keys: [], payload: { lmap: c.toDataURL('image/png'), assign: {} } }; }, w);

test('a guide file with too many sections is turned away on import and from the Library, without a crash', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await saveNew(page);
  const id = await savedId(page), d = await hostile(page, 1200);
  await page.evaluate((d) => SF.importFile(new File([JSON.stringify(d)], 'x.msguide.json', { type: 'application/json' })), d);
  await page.waitForFunction(() => /too many sections/.test(document.body.textContent), null, { timeout: 15000 });
  assert.equal((await guidesR5(page)).length, 1, 'not added to the Library');
  // one that got into the Library some other way
  const hid = await page.evaluate((d) => sfSaveDesign({ name: d.name, W: d.W, H: d.H, keys: [], n: 0, payload: d.payload }), d);
  await page.evaluate(() => document.querySelectorAll('.mserr').forEach((e) => e.remove()));
  await page.evaluate((hid) => loadGuide({ id: hid }), hid);
  await page.waitForFunction(() => /too many sections/.test(document.body.textContent), null, { timeout: 15000 });
  assert.equal(await page.evaluate(() => __mstest.curId), id, 'the open guide stays open');
  assert.ok(await page.evaluate(() => !!__mstest.assignData));
  assert.deepEqual(errors, []);
});
