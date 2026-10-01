// The guide's header row (Release 3, docs/GUIDE-LAYOUT.md): the name with ✎ over where it is saved, ✨ Surprise and ⋯;
// renaming in place; the ⋯ menu sheet; a header that keeps its height; and large text.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { setup, teardown, openApp, sampleGuide, idle, openMenu, menuItem, ROOT, rename, sectionPoint, scrollTop, openAtScale, guideName, notOnWebKit, WK, until, saveGuide, answerAsks, buildGo } from './helpers.mjs';

before(setup);
after(teardown);

// ---- From Release 3 (docs/GUIDE-LAYOUT.md) ----
const rect = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return e ? e.getBoundingClientRect().toJSON() : null; }, sel);
const menuLabels = (page) => page.$$eval('#sfSheet .sfmitem', (b) => b.map((x) => x.textContent));
const head = (page) => page.evaluate(() => { const v = (id) => { const e = document.getElementById(id); return !!(e && e.offsetParent); }; return { name: document.getElementById('sfGTitle')?.textContent, status: document.getElementById('sfSaveSt').textContent, save: v('sfSave'), surprise: v('sfSurprise'), more: v('sfMore') }; });

test('header row: name ✎ over where it is saved, ✨ Surprise in Plan only, and ⋯; Plan has no Reset progress', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  let h = await head(page);
  assert.equal(h.name, await page.evaluate(() => __mstest.curName));
  assert.deepEqual([h.status, h.save, h.surprise, h.more], ['Sample', false, true, true], 'Plan: the sample, not in the Library yet (no Save: v285)');
  // Reset progress is only in Colour along's ⋯ menu (see the menu's test below), never a button in Plan
  assert.equal(await page.evaluate(() => [...document.querySelectorAll('#sfRoot button')].some((b) => /Reset progress/.test(b.textContent))), false, 'no Reset progress in Plan');
  const hr = await rect(page, '#sfHead'), cv = await rect(page, '#sfCanvas');
  assert.ok(hr.bottom <= cv.top + 1, 'the header row sits above the picture');
  // Colour along: no Surprise
  await page.click('#sfColor'); await idle(page);
  h = await head(page);
  assert.deepEqual([h.surprise, h.save, h.more], [false, false, true], 'Colour along');
  await page.click('#sfDoneBtn'); await idle(page);
  // Edit sections: no Surprise, no Save (the guide is built from here)
  await answerAsks(page);
  await page.click('#sfBack2'); await idle(page);
  h = await head(page);
  assert.deepEqual([h.surprise, h.save, h.status], [false, false, 'Sample'], 'Edit sections');
  // (v288: nothing edited, so the bar goes back to the Plan)
  await page.click('#sfToPlan'); await page.waitForFunction(() => __mstest.assignData && document.getElementById('sfColor')); await idle(page);
  // a change: into the Library by itself, and the status says so
  await page.click('.sftabbtn[data-t="pattern"]'); await page.click('#sfFam [data-v="random"]'); await idle(page, 2300);
  h = await head(page);
  assert.match(h.status, /^(Saved in your Library|Saves itself from now on) ✓$/); assert.equal(h.save, false);
  assert.equal(await page.evaluate(() => state.saved.filter((s) => s.type === 'guide').length), 1);
  assert.deepEqual(errors, []);
});

test('a new photo is "New guide" in Edit sections, and goes into the Library by itself once built', notOnWebKit(WK.photo), async () => {
  const { page, errors } = await openApp();
  await page.check('#wcSets input[data-i="3"]'); await page.click('#wcAdd');
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#wcPhoto')]);
  await fc.setFiles(join(ROOT, 'src', 'assets', 'sample-jellyfish.png'));
  await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 60000 }); await idle(page);
  const h = await head(page);
  assert.deepEqual([h.name, h.status, h.save, h.surprise, h.more], ['New guide', 'Not saved yet', false, false, true]);
  await buildGo(page); await page.waitForFunction(() => __mstest.assignData && document.getElementById('sfColor')); await idle(page);
  assert.notEqual((await head(page)).name, 'New guide', 'a name once built');
  // (v285: built, it goes into the Library by itself, with no Save to press)
  await page.waitForFunction(() => state.saved.some((s) => s.type === 'guide')); await idle(page);
  assert.equal((await head(page)).save, false);
  assert.match((await head(page)).status, /^(Saved in your Library|Saves itself from now on) ✓$/);
  assert.deepEqual(errors, []);
});

test('renaming in place: ✎ opens the field with ⚄ inside it; Enter keeps the name, Escape leaves it as it was', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  const name0 = await page.textContent('#sfGTitle');
  await page.click('#sfRename');
  assert.ok(await page.isVisible('.sfrename #sfGName'));
  assert.ok(await page.isVisible('.sfrename #sfNameRoll'), '⚄ inside the field');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'sfGName');
  await page.fill('#sfGName', 'Sea Glass'); await page.keyboard.press('Escape'); await idle(page);
  assert.equal(await page.textContent('#sfGTitle'), name0, 'Escape cancels');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'sfRename', 'focus back on ✎');
  assert.equal(await page.evaluate(() => document.getElementById('sfRoot').classList.contains('sffull')), false, 'Escape did nothing else');
  await page.click('#sfRename'); await page.fill('#sfGName', 'Sea Glass'); await page.keyboard.press('Enter'); await idle(page);
  assert.equal(await page.textContent('#sfGTitle'), 'Sea Glass');
  assert.equal(await page.evaluate(() => __mstest.curName), 'Sea Glass');
  // ⚄ suggests another name without leaving the field
  await page.click('#sfRename'); await page.click('#sfNameRoll'); await idle(page);
  const sug = await page.inputValue('#sfGName');
  assert.ok(sug && sug !== 'Sea Glass', 'a new suggestion: ' + sug);
  assert.ok(await page.isVisible('#sfGName'), 'still renaming');
  await page.keyboard.press('Enter'); await idle(page);
  assert.equal(await page.textContent('#sfGTitle'), sug);
  // leaving the field keeps what was typed
  await page.click('#sfRename'); await page.fill('#sfGName', 'Left By Blur'); await page.click('.sftabbtn[data-t="share"]'); await idle(page);
  assert.equal(await page.textContent('#sfGTitle'), 'Left By Blur');
  assert.deepEqual(errors, []);
});

test('⋯ opens a menu sheet: New, This guide (Save a copy once saved; Reset progress in Colour along), Help', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  assert.equal(await page.locator('#sfRoot [aria-label="More"]').count(), 1, 'the only ⋯ on the screen');
  await openMenu(page);
  assert.equal(await page.textContent('#sfSheetT'), await page.textContent('#sfGTitle'));
  assert.deepEqual(await page.$$eval('#sfSheet .sfmh', (h) => h.map((x) => x.textContent)), ['New', 'Help']);
  assert.deepEqual(await menuLabels(page), ['Choose a photo', 'Try the sample', 'Open from Library', 'Import a guide', 'Help']);
  await page.keyboard.press('Escape'); await idle(page);
  assert.equal(await page.locator('#sfSheet').count(), 0, 'Escape closes it');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'sfMore', 'focus back on ⋯');
  await saveGuide(page);
  await openMenu(page);
  assert.deepEqual(await menuLabels(page), ['Choose a photo', 'Try the sample', 'Open from Library', 'Import a guide', 'Save a copy', 'Help']);
  await page.click('#sfSheet [data-m="close"]'); await idle(page);
  assert.equal(await page.locator('#sfSheet').count(), 0, 'Close closes it');
  await page.click('#sfColor'); await idle(page);
  await openMenu(page);
  assert.deepEqual(await menuLabels(page), ['Choose a photo', 'Try the sample', 'Open from Library', 'Import a guide', 'Reset progress', 'Help']);
  await page.keyboard.press('Escape');
  // the items do what they say
  await menuItem(page, 'Open from Library'); await idle(page);
  assert.ok(await page.evaluate(() => document.getElementById('savedOverlay').classList.contains('on')), 'Library');
  await page.evaluate(() => document.getElementById('savedOverlay').classList.remove('on'));
  let [fc] = await Promise.all([page.waitForEvent('filechooser'), menuItem(page, 'Choose a photo')]);
  assert.equal(await fc.element().getAttribute('accept'), 'image/*', 'Choose a photo');
  [fc] = await Promise.all([page.waitForEvent('filechooser'), menuItem(page, 'Import a guide')]);
  assert.match(await fc.element().getAttribute('accept'), /json/, 'Import a guide');
  await menuItem(page, 'Help'); await idle(page);
  assert.ok(await page.evaluate(() => document.getElementById('helpOverlay').classList.contains('on')), 'Help');
  await page.keyboard.press('Escape'); await idle(page);
  await menuItem(page, 'Try the sample'); await page.waitForFunction(() => __mstest.assignData && __mstest.curId == null, null, { timeout: 15000 });
  assert.deepEqual(errors, []);
});

// ---- From the third full review (v259) ----
const savedId = (page) => page.evaluate(() => state.saved.find((s) => s.type === 'guide').id);

test('renaming a guide is kept when you open another guide and come back', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await saveGuide(page);
  const a = await savedId(page);
  await page.evaluate(() => SF.loadSample()); await page.waitForFunction(() => __mstest.assignData && !__mstest.curId, null, { timeout: 10000 }); await idle(page);
  await saveGuide(page);
  const b = await page.evaluate(() => __mstest.curId);
  await page.evaluate((a) => SF.openDesign(a), a); await page.waitForFunction((a) => __mstest.curId === a, a); await idle(page);
  await rename(page, 'My renamed guide');
  await page.evaluate((b) => SF.openDesign(b), b); await page.waitForFunction((b) => __mstest.curId === b, b); await idle(page);
  await page.evaluate((a) => SF.openDesign(a), a); await page.waitForFunction((a) => __mstest.curId === a, a); await idle(page);
  assert.equal(await page.evaluate(() => __mstest.curName), 'My renamed guide');
  assert.deepEqual(errors, []);
});

// ---- From the fourth review (v263 guide screen) ----
const bigSections = (page, n = 6) => page.evaluate((n) => { const t = __mstest; return t.assignData.order.slice().sort((a, b) => t.comps[b].area - t.comps[a].area).slice(0, n); }, n);
async function tapSection(page, l) { const p = await sectionPoint(page, l); await page.mouse.click(p.x, p.y); await idle(page); }

test('the header keeps its height: Surprise, renaming and saving move nothing under it', async () => {
  for (const sc of [1, 1.6]) {
    const { page, errors, ctx } = await openAtScale(sc, { width: 390, height: 844 });
    await sampleGuide(page); await idle(page);
    const hh = async () => Math.round((await rect(page, '#sfHead')).height * 10) / 10, h0 = await hh();
    await page.click('#sfSurprise'); await idle(page);
    assert.equal(await hh(), h0, `@${sc}: after Surprise`);
    assert.equal(await page.locator('.sfsnote').count(), 0, 'no note line over the picture');
    assert.match(await page.textContent('#msToast'), /Surprise: .+ palette .+ markers/, 'what it chose is in its toast (with Undo)');
    await page.click('#sfSurprise'); await idle(page);
    assert.equal(await hh(), h0);
    await page.click('#sfRename'); await idle(page);
    assert.equal(await hh(), h0, `@${sc}: renaming`);
    assert.equal(await page.evaluate(() => document.getElementById('sfSurprise').classList.contains('sfic')), true, '✨ alone while renaming');
    await page.keyboard.press('Escape'); await saveGuide(page);
    assert.match(await page.textContent('#sfSaveSt'), /Saved in your Library|Saves itself from now on/);
    assert.equal(await hh(), h0, `@${sc}: saved`);
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});

test('large text: ✨ Surprise goes to ✨ before the name gets under 140px, and the status line is never cut', async () => {
  for (const [w, sc] of [[375, 1.6], [360, 1.6], [390, 1.3]]) {
    const { page, errors, ctx } = await openAtScale(sc, { width: w, height: 800 });
    await sampleGuide(page); await idle(page);
    const r = await page.evaluate(() => { const st = document.getElementById('sfSaveSt'); return { ic: document.getElementById('sfSurprise').classList.contains('sfic'), name: document.querySelector('.sfgname').getBoundingClientRect().width, cut: st.scrollWidth > st.clientWidth + 1, label: document.getElementById('sfSurprise').getAttribute('aria-label') }; });
    assert.ok(r.name >= 140, `${w}@${sc}: name ${r.name}px`);
    assert.equal(r.cut, false, 'status not cut');
    assert.match(r.label, /^Surprise/);
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});

test('renaming: ✎ closes the section tip; Escape cancels; ⋯ straight after typing shows the new name', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  const [l] = await bigSections(page, 1), n0 = await guideName(page);
  await scrollTop(page); await tapSection(page, l);
  assert.equal(await page.locator('.sftip').count(), 1);
  await page.click('#sfRename');
  assert.equal(await page.locator('.sftip').count(), 0, 'the tip closed');
  await page.fill('#sfGName', 'Not this'); await page.keyboard.press('Escape'); await idle(page);
  assert.equal(await guideName(page), n0, 'Escape left the name as it was');
  // type a name and go straight to ⋯
  await page.click('#sfRename'); await page.fill('#sfGName', 'Tide Pool'); await page.click('#sfMore'); await page.waitForSelector('#sfSheet'); await idle(page);
  assert.equal(await page.textContent('#sfSheetT'), 'Tide Pool', 'the menu has the new name');
  await page.keyboard.press('Escape');
  assert.equal(await guideName(page), 'Tide Pool');
  assert.deepEqual(errors, []);
});

test('iPad portrait: the ⋯ menu is as tall as its items', async () => {
  const { page, errors } = await openApp({ width: 768, height: 1024 });
  await sampleGuide(page); await idle(page);
  await page.click('#sfMore'); await page.waitForSelector('#sfSheet'); await idle(page);
  // (waiting for the sheet to arrive rather than for its slide to end: GitHub's WebKit can leave it part-way a while)
  await until(page, () => Math.abs(document.getElementById('sfSheet').getBoundingClientRect().bottom - 1024) <= 1, null, 'the sheet at the bottom', 15000).catch(() => {});
  const s = await rect(page, '#sfSheet'), items = await page.evaluate(() => { const b = document.querySelector('#sfSheet .sfshbody'); return b.scrollHeight - b.clientHeight; });
  assert.ok(Math.abs(s.bottom - 1024) <= 1, 'at the bottom');
  assert.ok(items <= 1 && s.height < 520, `sized to its content (${s.height}px)`);
  assert.deepEqual(errors, []);
});
