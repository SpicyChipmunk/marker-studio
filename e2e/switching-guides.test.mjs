// Opening another guide or picture: nothing carries over from the one before (crop mode, flat sections, settings,
// paint, the wake lock), nothing is lost (progress, a change made while the next picture loads, a rename), a late
// failure says nothing over the new guide, and a guide that can't be saved stops the switch.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, sampleGuide, sectionPoint, idle, scrollTop, welcome, notOnWebKit, WK, saveGuide, answerAsks, buildGo } from './helpers.mjs';

before(setup);
after(teardown);

const colourSome = async (page, n) => {
  const ls = await page.evaluate((n) => __mstest.assignData.order.slice(0, n), n);
  await scrollTop(page);
  for (const l of ls) { const p = await sectionPoint(page, l); await page.mouse.click(p.x, p.y); }
  return ls;
};
const done = (page) => page.evaluate(() => [...__mstest.colored].reduce((a, b) => a + b, 0));

test('if the current guide cannot be saved, opening another one is stopped', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await page.click('#sfColor'); await colourSome(page, 2);
  const name = await page.evaluate(() => __mstest.curName);
  await page.evaluate(() => { IDB.put = () => Promise.reject(new Error('QuotaExceededError')); });
  await page.evaluate(() => SF.loadSample()); await idle(page, 1200);
  assert.equal(await page.evaluate(() => __mstest.curName), name, 'still on the unsaved guide');
  assert.equal(await done(page), 2, 'its progress is still there');
  assert.match(await page.textContent('#msToast'), /Couldn.t save/);
  assert.equal(await page.evaluate(() => __mstest.guideDirty), true, 'still marked unsaved');
  assert.deepEqual(errors, []);
});

// ---- From the second full review ----
test('flat sections do not carry into the next sample', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await page.evaluate(() => { __mstest.shadeFlat[__mstest.assignData.order[0]] = 1; });
  await page.evaluate(() => SF.loadSample()); await idle(page, 1200);
  assert.equal(await page.evaluate(() => Object.keys(__mstest.shadeFlat).length), 0);
  assert.deepEqual(errors, []);
});

// ---- From the third full review (v259) ----
const savedId = (page) => page.evaluate(() => state.saved.find((s) => s.type === 'guide').id);
async function tickSome(page, n) { await page.evaluate((n) => { const t = __mstest; t.assignData.order.slice(0, n).forEach((l) => { t.colored[l] = 1; }); t.guideDirty = true; }, n); }

test('reopening the open guide from the Library while cropping reloads it cleanly', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await saveGuide(page); await idle(page);
  const id = await savedId(page);
  await page.click('#sfBack2'); await page.click('#sfAdjToggle'); await page.click('#sfCrop'); await idle(page);
  await page.evaluate((id) => SF.openDesign(id), id); await page.waitForFunction(() => __mstest.assignData && !__mstest.cropMode, null, { timeout: 10000 }); await idle(page);
  await page.click('#sfColor'); await idle(page);
  const l = await page.evaluate(() => __mstest.assignData.order[2]);
  const p = await sectionPoint(page, l); await scrollTop(page); const p2 = await sectionPoint(page, l);
  await page.mouse.click(p2.x, p2.y); await idle(page);
  assert.equal(await page.evaluate((l) => __mstest.colored[l], l), 1, 'taps colour sections again');
  assert.deepEqual(errors, []);
});

test('crop mode does not leak into the next picture', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await page.click('#sfBack2'); await page.click('#sfAdjToggle'); await page.click('#sfCrop'); await idle(page);
  await page.evaluate(() => SF.loadSample()); await page.waitForFunction(() => __mstest.assignData, null, { timeout: 10000 }); await idle(page);
  assert.equal(await page.evaluate(() => __mstest.cropMode), false);
  assert.deepEqual(errors, []);
});

test('a picture left unbuilt does not wipe the progress of a guide opened afterwards', notOnWebKit(WK.photo), async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await tickSome(page, 6); await saveGuide(page); await idle(page);
  const id = await savedId(page);
  // a new photo goes to the sections editor; leave it unbuilt and open the saved guide
  const b64 = await page.evaluate(async () => { const c = document.createElement('canvas'); c.width = 500; c.height = 700; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 500, 700); g.strokeStyle = '#111'; g.lineWidth = 6; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(100 + i * 60, 200 + (i % 2) * 200, 70, 0, 6.283); g.stroke(); } return c.toDataURL('image/png').split(',')[1]; });
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.evaluate(() => SF.pickPhoto())]);
  await fc.setFiles({ name: 'p.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
  await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 20000 }); await idle(page);
  await page.evaluate((id) => SF.openDesign(id), id); await page.waitForFunction(() => __mstest.assignData && __mstest.curId, null, { timeout: 10000 }); await idle(page);
  // (v284: part-way coloured, it opens in Colour along: back to the plan, then to its sections)
  assert.equal(await page.evaluate(() => __mstest.sfmode), 'color');
  await page.click('#sfDoneBtn'); await idle(page);
  await page.click('#sfBack2'); await idle(page); await buildGo(page); await idle(page);
  assert.equal(await page.evaluate(() => __mstest.colored.reduce((a, b) => a + b, 0)), 6);
  assert.deepEqual(errors, []);
});

// ---- From the fourth review (data safety) ----
// Save (a new guide into the Library), done once the header says so
const saveNew = (page) => saveGuide(page);

const AUTO = 2300; // idle(page, AUTO): until auto-save (1.5 s after the last change) has run
const stored = (page, id) => page.evaluate((id) => IDB.get('guide-' + id).then((p) => p && { prog: (p.prog || []).length, assign: p.assign, tones: p.tones || {}, ref: p.ref || null, base: p.base || null, style: p.style }), id);
const tickN = (page, n, from = 0) => page.evaluate(([n, from]) => { const t = __mstest; t.assignData.order.slice(from, from + n).forEach((l) => { t.colored[l] = 1; }); t.guideDirty = true; t.renderGuide(); }, [n, from]);
const tab = (page, t) => page.click(`.sftabbtn[data-t="${t}"]`);
// reopen a Library guide the way the Library does
const openSaved = async (page, id) => { await page.evaluate((id) => loadGuide({ id }), id); await page.waitForFunction((id) => __mstest.curId === id && __mstest.assignData, id, { timeout: 10000 }); await idle(page); };
// hold back the next picture load (new Image()) until release() is called
const holdNextImage = (page) => page.evaluate(() => { const Real = window.Image; window.Image = function () { const im = new Real(); window.Image = Real; const d = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src'); Object.defineProperty(im, 'src', { configurable: true, set(v) { window.__release = () => d.set.call(im, v); }, get() { return d.get.call(im); } }); return im; }; });
const release = (page) => page.evaluate(() => { const r = window.__release; window.__release = null; if (r) r(); return !!r; });

test('a change made while the next picture loads is saved into the guide it was made in', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await saveNew(page);
  const id = await savedId(page);
  await holdNextImage(page);
  await page.evaluate(() => SF.loadSample());
  await page.waitForFunction(() => !!window.__release);
  await tickN(page, 2); // while "Loading sample…"
  await release(page);
  await page.waitForFunction((id) => __mstest.assignData && __mstest.curId !== id, id); await idle(page);
  assert.equal((await stored(page, id)).prog, 2);
  assert.deepEqual(errors, []);
});

test('a guide opens with its own settings, not those of the guide before', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  const plain = await page.evaluate(() => { const d = __mstest.currentDesignObj(); delete d.payload.style.expand; delete d.payload.style.savedPalId; return Object.assign({}, d.payload, { name: 'Plain', W: d.W, H: d.H }); });
  const pid = await page.evaluate(() => { const id = Date.now(); state.saved.unshift({ id, type: 'palette', name: 'P', keys: [...state.owned].slice(0, 6), ts: id }); save(); return id; });
  await answerAsks(page);
  await page.evaluate((pid) => SF.setSavedSource(pid), pid);
  assert.equal(await page.evaluate(() => __mstest.currentDesignObj().payload.style.savedPalId), pid);
  await page.evaluate((d) => __mstest.openDesignObj(d, null), plain); await page.waitForFunction(() => __mstest.curName === 'Plain'); await idle(page);
  const st = await page.evaluate(() => __mstest.currentDesignObj().payload.style);
  assert.equal(st.savedPalId, null); assert.equal(st.expand, false); assert.equal(st.paletteSource, 'owned');
  assert.deepEqual(errors, []);
});

test('a photo that fails after something else opened says nothing over the new guide', async () => {
  const { page, errors } = await openApp();
  await welcome(page, 'look'); await idle(page);
  await holdNextImage(page);
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.evaluate(() => SF.pickPhoto())]);
  await fc.setFiles({ name: 'bad.png', mimeType: 'image/png', buffer: Buffer.from('not a picture at all') });
  await page.waitForFunction(() => !!window.__release);
  await page.evaluate(() => SF.loadSample()); await page.waitForFunction(() => __mstest.assignData); await idle(page);
  await release(page); await idle(page);
  assert.doesNotMatch(await page.textContent('#sfMeta'), /couldn’t be opened as a picture/);
  assert.equal(await page.locator('#sfRoot .errcard').count(), 0);
  assert.deepEqual(errors, []);
});

test('a new picture: the screen may sleep again, paint is off, and Unpin still works after reopening', async () => {
  const init = () => { window.__wl = { req: 0, rel: 0 }; Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request: () => { window.__wl.req++; return Promise.resolve({ release() { window.__wl.rel++; return Promise.resolve(); }, addEventListener() {} }); } } }); };
  const { page, errors } = await openApp({ init });
  await sampleGuide(page);
  await page.click('#sfColor'); await idle(page);
  assert.equal(await page.evaluate(() => window.__wl.req), 1);
  await page.evaluate(() => SF.loadSample()); await page.waitForFunction(() => __mstest.assignData && __mstest.hlKey == null); await idle(page);
  assert.equal(await page.evaluate(() => window.__wl.rel), 1, 'the wake lock is let go');
  // paint on in Manual, then a Library guide opens: paint is off
  await saveNew(page);
  const id = await savedId(page);
  await tab(page, 'pattern'); await page.click('#sfFam [data-v="manual"]'); await idle(page);
  await page.click('#sfPaint'); await idle(page);
  assert.equal(await page.evaluate(() => __mstest.paintOn), true);
  await page.evaluate(() => SF.loadSample()); await page.waitForFunction((id) => __mstest.assignData && __mstest.curId !== id, id); await idle(page);
  await openSaved(page, id);
  assert.equal(await page.evaluate(() => __mstest.paintOn), false);
  // pin a section, Shuffle (its pattern colour changes under the pin), reopen: Unpin gives the pattern's colour
  await tab(page, 'pattern'); await page.click('#sfFam [data-v="gradient"]'); await idle(page);
  const l = await page.evaluate(() => { const t = __mstest, c = document.getElementById('sfCanvas'), r = c.getBoundingClientRect(); return t.assignData.order.filter((l) => { const q = t.labelPos(l), y = r.top + (q.y / c.height) * r.height; return y > r.top + 20 && y < r.bottom - 60; }).sort((a, b) => t.comps[b].area - t.comps[a].area)[0]; });
  const tapL = async () => { await scrollTop(page); const p = await sectionPoint(page, l); await page.mouse.click(p.x, p.y); await idle(page); };
  await tapL(); await page.click('.sftip [data-a="pin"]'); await idle(page);
  await tab(page, 'pattern'); await page.click('#sfVary'); await idle(page);
  const base = await page.evaluate((l) => __mstest.assignData.base[l].mkey, l), pinned = await page.evaluate((l) => __mstest.assignData.assign[l].mkey, l);
  if (base === pinned) { await page.click('#sfVary'); await idle(page); }
  const base2 = await page.evaluate((l) => __mstest.assignData.base[l].mkey, l);
  await idle(page, AUTO);
  await page.reload(); await idle(page); await openSaved(page, id);
  await tapL(); await page.click('.sftip [data-a="pin"]'); await idle(page);
  assert.equal(await page.evaluate((l) => __mstest.locks[l] ?? null, l), null);
  assert.equal(await page.evaluate((l) => __mstest.assignData.assign[l].mkey, l), base2, 'Unpin goes back to the pattern’s colour');
  assert.deepEqual(errors, []);
});
