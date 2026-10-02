// The Plan tabs (Release 3, docs/GUIDE-LAYOUT.md #7-#9): Colours · Pattern · Shading · Share, opening on the last one
// used on this device; what each tab holds; helper text in full the first time, then a one-line ⓘ; Shading's
// suggestions as one line that opens; the Share tab and its Print sheet; and each tab kept short.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setup, teardown, openApp, sampleGuide, idle, notOnWebKit, WK, saveGuide } from './helpers.mjs';

before(setup);
after(teardown);

// errors, and console errors too
async function app(opts) { const a = await openApp(opts); a.page.on('console', (m) => { if (m.type() === 'error') a.errors.push('console: ' + m.text()); }); return a; }
const tab = (page, t) => page.click(`.sftabbtn[data-t="${t}"]`);
const pane = (t) => `.sftab[data-tab="${t}"]`;
const rect = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return e ? e.getBoundingClientRect().toJSON() : null; }, sel);
const ids = (page, sel) => page.$$eval(sel, (b) => b.map((x) => x.id || x.dataset.v));
// the tops of the visible buttons in a row (one value = one row)
const rows = (page, sel) => page.$$eval(sel, (b) => [...new Set(b.filter((x) => x.offsetParent).map((x) => Math.round(x.getBoundingClientRect().top)))]);
// scroll so the tabs are pinned under the picture (at its floor size)
const pinTabs = (page) => page.evaluate(() => new Promise((r) => { const t = document.querySelector('.sftabs'), s = document.querySelector('.sftabsen'), cs = getComputedStyle(t); scrollTo(0, Math.round(scrollY + s.getBoundingClientRect().top + parseFloat(cs.marginTop) - parseFloat(cs.top))); requestAnimationFrame(() => requestAnimationFrame(r)); }));
// save the guide, reload, and open it again from Home (localStorage, and so what has been seen, is kept)
async function reopen(page) {
  if (!(await page.evaluate(() => __mstest.inLibrary))) await saveGuide(page);
  await page.reload(); await page.waitForFunction(() => !!window.__mstest);
  await page.click('#mHome'); await page.click('#sfRecent [data-gid]');
  await page.waitForFunction(() => !!__mstest.assignData); await idle(page);
}

test('Colours · Pattern · Shading · Share, one pane each: Colours the first time, then the last one used, also after a reload', async () => {
  const { page, errors } = await app();
  await sampleGuide(page);
  assert.deepEqual(await page.$$eval('.sftabbtn', (b) => b.map((x) => [x.dataset.t, x.textContent])), [['colours', 'Colours'], ['pattern', 'Pattern'], ['shading', 'Shading'], ['share', 'Share']]);
  assert.equal(await page.getAttribute('.sftabbtn.on', 'data-t'), 'colours', 'Colours the first time');
  assert.equal(await page.getAttribute('.sftabbtn[data-t="colours"]', 'aria-selected'), 'true');
  assert.deepEqual(await page.$$eval('#sfCtl [data-tab]', (p) => p.map((x) => x.dataset.tab)), ['colours', 'pattern', 'shading', 'share'], 'one pane per tab, and no others');
  await tab(page, 'shading');
  assert.equal(await page.evaluate(() => localStorage.getItem('ms-plan-tab')), 'shading');
  assert.ok(await page.isVisible(pane('shading')) && !(await page.isVisible(pane('colours'))));
  // a rebuild of the controls keeps the tab
  await page.click('#sfShade [data-v="shadow"]'); await idle(page);
  assert.equal(await page.getAttribute('.sftabbtn.on', 'data-t'), 'shading');
  await reopen(page);
  assert.equal(await page.getAttribute('.sftabbtn.on', 'data-t'), 'shading', 'the last tab used, after a reload');
  assert.ok(await page.isVisible(pane('shading')));
  await tab(page, 'share'); await reopen(page);
  assert.equal(await page.getAttribute('.sftabbtn.on', 'data-t'), 'share');
  assert.deepEqual(errors, []);
});

test('Pattern: the chooser on one row, that pattern\'s options, then Shuffle and Pin side by side', async () => {
  const { page, errors } = await app();
  await sampleGuide(page);
  // (settled first: under load, the row of Shuffle and Pin was once measured mid-layout)
  await tab(page, 'pattern'); await idle(page);
  assert.deepEqual(await ids(page, '#sfFam button'), ['gradient', 'random', 'blend', 'photo', 'manual']);
  assert.equal((await rows(page, '#sfFam button')).length, 1, 'the chooser fits on one row at 390 wide');
  // Gradient: flow (one row) and direction, then ↻ Shuffle and Pin colours on one row, Shuffle first
  assert.equal((await rows(page, '#sfShape button')).length, 1);
  assert.ok(await page.isVisible('#sfDir'));
  const sh = await rect(page, '#sfVary'), pin = await rect(page, '#sfLock');
  assert.equal((await page.textContent('#sfVary')).trim(), 'Shuffle');
  assert.match(await page.textContent('#sfLock'), /^Pin colours · 0$/);
  assert.ok(Math.abs(sh.top - pin.top) < 1 && sh.right <= pin.left, 'Shuffle and Pin side by side');
  const last = await page.evaluate((s) => document.querySelector(s).lastElementChild.contains(document.getElementById('sfLock')), pane('pattern'));
  assert.ok(last, 'Shuffle and Pin come last');
  // nothing from Shading or Display in here
  for (const sel of ['#sfShade', '#sfTex', '#sfShLines', '#sfPrint']) assert.equal(await page.locator(`${pane('pattern')} ${sel}`).count(), 0, sel);
  // Random: its option, and Shuffle + Pin
  await page.click('#sfFam [data-v="random"]'); await idle(page);
  assert.ok(await page.isVisible('#sfNoAdj'));
  const s2 = await rect(page, '#sfShuffle'), p2 = await rect(page, '#sfLock');
  assert.ok(Math.abs(s2.top - p2.top) < 1, 'Random: Shuffle and Pin side by side');
  // Blend: the anchors hint, Reset anchors, spread; no Shuffle or Pin
  await page.click('#sfFam [data-v="blend"]'); await idle(page);
  assert.ok(await page.isVisible(`${pane('pattern')} .sfinfo[data-info="blend"]`));
  for (const id of ['#sfResetA', '#sfSpread', '#sfMix']) assert.ok(await page.isVisible(id), id);
  assert.equal(await page.locator('#sfLock, #sfVary, #sfShuffle').count(), 0);
  // Manual: Paint and (while painting) the brush chip, its hint, and Fill
  await page.click('#sfFam [data-v="manual"]'); await idle(page);
  assert.ok(await page.isVisible(`${pane('pattern')} .sfinfo[data-info="manual"]`));
  assert.ok(await page.isVisible('#sfFillAll'));
  await page.click('#sfPaint'); await idle(page);
  assert.ok(await page.isVisible(`${pane('pattern')} #sfBrush`), 'the brush chip sits in Pattern');
  assert.equal(await page.getAttribute('#sfPaint', 'aria-pressed'), 'true');
  // leaving the tab ends painting
  await tab(page, 'colours'); await idle(page);
  assert.equal(await page.evaluate(() => __mstest.assignData && document.getElementById('sfPaint').getAttribute('aria-pressed')), 'false');
  // Photo: the photo's own controls
  await tab(page, 'pattern');
  const b64 = await page.evaluate(async () => { const c = document.createElement('canvas'); c.width = 300; c.height = 400; const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 300, 400); gr.addColorStop(0, '#e33'); gr.addColorStop(1, '#33e'); g.fillStyle = gr; g.fillRect(0, 0, 300, 400);
    const blob = await new Promise((r) => c.toBlob(r, 'image/png')); return await new Promise((r) => { const f = new FileReader(); f.onload = () => r(f.result.split(',')[1]); f.readAsDataURL(blob); }); });
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#sfFam [data-v="photo"]')]);
  await fc.setFiles({ name: 'ref.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
  await page.waitForFunction(() => !!__mstest.photoRef && !__mstest.photoChecking); await idle(page);
  if (await page.isVisible('#sfPhAlign.on')) { await page.click('#sfPhAlign'); await idle(page); }
  for (const id of ['.sfphrow', '#sfPhAlign', '#sfPhPick', '#sfPhPaper', '#sfLock']) assert.ok(await page.isVisible(`${pane('pattern')} ${id}`), id);
  assert.deepEqual(errors, []);
});

test('Shading: the modes, sliders, tone guides, Leave sections flat, the suggestions line, and texture at the bottom, always', async () => {
  const { page, errors } = await app();
  await sampleGuide(page);
  await tab(page, 'shading');
  const lastIsTexture = () => page.evaluate((s) => document.querySelector(s).lastElementChild.querySelector('#sfTex') !== null, pane('shading'));
  assert.ok(await page.isVisible('#sfShade') && await page.isVisible('#sfTex'), 'texture shows with shading off');
  assert.ok(await lastIsTexture(), 'texture at the bottom');
  assert.equal(await page.locator('#sfRound, #sfShLo, .sfshnote').count(), 0);
  await page.click('#sfShade [data-v="full"]'); await idle(page);
  for (const id of ['#sfRound', '#sfShHi', '#sfShLo', '#sfShLines', '#sfShFlat', '.sfshnote', '#sfTex']) assert.ok(await page.isVisible(`${pane('shading')} ${id}`), id);
  assert.ok(await lastIsTexture(), 'still at the bottom');
  // texture still works from here
  await page.$eval('#sfTex', (e) => { e.value = 80; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); });
  assert.equal(await page.textContent('#sfTexVal'), '80%');
  // the tone guides (were in Display)
  await page.uncheck('#sfShLines'); assert.match(await page.evaluate(() => JSON.stringify(__mstest.currentDesignObj())), /"lines":false/);
  await page.check('#sfShLines');
  // the suggestions: one line, "N markers would make the shading richer · Show"
  const head = await page.textContent('.sfshnote .sfonelh');
  assert.match(head, /^\d+ markers? would make the shading richerShow$/);
  assert.equal(await page.getAttribute('#sfShNoteT', 'aria-expanded'), 'false');
  assert.equal(await page.isVisible('#sfShNoteMore'), false, 'details hidden');
  await page.click('#sfShNoteT');
  assert.equal(await page.getAttribute('#sfShNoteT', 'aria-expanded'), 'true');
  assert.equal(await page.textContent('#sfShNoteT'), 'Hide');
  assert.match(await page.textContent('#sfShNoteMore'), /Richer with:/);
  // its Add buttons still work
  const chip = page.locator('#sfShNoteMore .wishchip').first(), k = await chip.getAttribute('data-wk');
  await chip.click(); await idle(page);
  assert.ok(await page.evaluate((k) => state.wish.some((w) => w.k === k), k), 'added to the shopping list');
  assert.equal(await page.getAttribute(`#sfShNoteMore .wishchip[data-wk="${k}"]`, 'aria-pressed'), 'true');
  // it stays open when the controls are drawn again, and Hide closes it
  await page.$eval('#sfShLo', (e) => { e.value = 70; e.dispatchEvent(new Event('change', { bubbles: true })); }); await idle(page);
  assert.ok(await page.isVisible('#sfShNoteMore .wishchip'));
  await page.click('#sfShNoteT'); assert.equal(await page.isVisible('#sfShNoteMore'), false);
  assert.deepEqual(errors, []);
});

test('helper text: in full the first time on this device, then a one-line ⓘ that opens; what has been seen is kept', async () => {
  const { page, errors } = await app();
  await sampleGuide(page);
  const info = (id) => page.evaluate((id) => { const b = document.querySelector(`.sftab:not([style*="none"]) .sfinfo[data-info="${id}"]`); return b && { open: b.getAttribute('aria-expanded'), text: b.textContent }; }, id);
  await tab(page, 'shading'); await page.click('#sfShade [data-v="full"]'); await idle(page);
  let s = await info('shade');
  assert.equal(s.open, 'true', 'the shading explanation in full the first time');
  assert.match(s.text, /Drag the .* on the picture to move the light/);
  await tab(page, 'pattern'); await page.click('#sfFam [data-v="blend"]'); await idle(page);
  assert.equal((await info('blend')).open, 'true');
  assert.match((await info('blend')).text, /Press and hold a section to change or pin its colour/);
  await page.click('#sfFam [data-v="manual"]'); await idle(page);
  assert.match((await info('manual')).text, /or turn on Paint to fill sections by dragging across them/);
  const seen = await page.evaluate(() => JSON.parse(localStorage.getItem('ms-seen-hints')));
  for (const id of ['shade', 'blend', 'manual']) assert.ok(seen.includes(id), id + ' seen');
  // the next visit: one line each, that opens in place on a tap
  await reopen(page);
  await tab(page, 'shading');
  s = await info('shade');
  assert.equal(s.open, 'false');
  assert.equal(s.text.trim(), 'iH › B › S, laid light to dark');
  // one line of text, in a button 44px tall to tap
  const h1 = (await rect(page, `${pane('shading')} .sfinfo[data-info="shade"] .sfit`)).height, hb = (await rect(page, `${pane('shading')} .sfinfo[data-info="shade"]`)).height;
  assert.ok(h1 <= 26, `one line (${h1}px)`);
  assert.ok(hb >= 44 && hb <= 46, `a 44px tap height (${hb}px)`);
  await page.click(`${pane('shading')} .sfinfo[data-info="shade"]`);
  s = await info('shade');
  assert.equal(s.open, 'true'); assert.match(s.text, /H highlight › B base › S shadow/);
  await tab(page, 'pattern');
  assert.equal((await info('manual')).open, 'false', 'Manual (the pattern kept) is one line');
  assert.match((await info('manual')).text, /^iTap a section to set its colour$/);
  // warnings stay in full: choosing sections to leave flat explains itself every time
  await tab(page, 'shading'); await page.click('#sfShFlat');
  assert.match(await page.textContent(pane('shading')), /Tap sections to stop them being shaded/);
  assert.deepEqual(errors, []);
});

test('Share: Show it off, Print…, Plan & keep; the Print sheet opens under the pinned picture, sums up the choices, keeps them, and downloads a PDF', async () => {
  const { page, errors } = await app();
  await sampleGuide(page);
  await tab(page, 'share');
  assert.deepEqual(await page.$$eval(`${pane('share')} .sfglbl`, (e) => e.map((x) => x.textContent)), ['Show it off', 'Print', 'Plan & keep']);
  assert.deepEqual(await ids(page, `${pane('share')} button`), ['sfReveal', 'sfExport', 'sfPrint', 'sfPlan', 'sfAsPal', 'sfShareGuide']);
  assert.equal((await page.textContent('#sfReveal')).trim(), 'Reveal & share');
  assert.equal((await page.textContent('#sfPrint')).trim(), 'Print…');
  assert.equal(await page.locator(`${pane('share')} #sfPDF, ${pane('share')} [data-paper]`).count(), 0, 'the print options live in the sheet');
  await page.click('#sfPrint'); await page.waitForSelector('#sfSheet.sfprsh'); await idle(page);
  // under the picture, pinned at its floor size (waiting for the sheet to arrive: GitHub's WebKit can leave its slide
  // a moment behind the idle wait)
  await page.waitForFunction(() => Math.abs(document.getElementById('sfSheet').getBoundingClientRect().top - document.getElementById('sfView').getBoundingClientRect().bottom) <= 1, null, { timeout: 5000 }).catch(() => {});
  const sheet = await rect(page, '#sfSheet'), view = await rect(page, '#sfView'), cv = await rect(page, '#sfCanvas');
  assert.ok(Math.abs(sheet.top - view.bottom) <= 1, `the sheet starts under the picture block (${sheet.top} vs ${view.bottom})`);
  assert.equal(Math.round(cv.height), 380, 'the picture at its floor size');
  assert.ok(cv.top >= -1, 'the picture stays on screen');
  assert.equal(await page.textContent('#sfSheetT'), 'Print');
  assert.deepEqual(await page.$$eval('#sfSheet [role="group"]', (g) => g.map((x) => x.getAttribute('aria-label'))), ['What to print', 'Labels on the colouring page', 'Paper size']);
  assert.ok(await page.isVisible('#sfPdfDark') && await page.isVisible('#sfPdfBlend'));
  assert.deepEqual(await page.$$eval('#sfSheet .sfshft button', (b) => b.map((x) => x.textContent)), ['Cancel', 'Download PDF']);
  // the summary follows the choices, and its page count matches the PDF's
  const sum = () => page.textContent('#sfPrSum');
  const count = async () => { const n = await page.evaluate(() => __mstest.buildPDFPages().length); const m = /^(\d+) pages?/.exec(await sum()); return [+m[1], n]; };
  // (v284: with any close-ups of small sections, how many and on how many pages)
  const CL = '(\\d+ small sections? (is|are) on \\d+ close-up pages?\\.( Numbers would fit more of (it|them) on the colouring page\\.)?)?$';
  assert.match(await sum(), new RegExp('^\\d+ pages · Letter · Codes' + CL));
  let [said, real] = await count(); assert.equal(said, real, 'Letter, codes');
  await page.click('[data-plabels="numbers"]');
  assert.match(await sum(), new RegExp('^\\d+ pages · Letter · Numbers' + CL));
  await page.click('[data-paper="a4"]');
  assert.match(await sum(), new RegExp('^\\d+ pages · A4 · Numbers' + CL));
  await page.check('#sfPdfBlend');
  [said, real] = await count(); assert.equal(said, real, 'A4 with blend companions');
  await page.click('[data-paper="a5"]');
  [said, real] = await count(); assert.equal(said, real, 'A5 with blend companions');
  await page.click('[data-pwhat="ref"]');
  assert.match(await sum(), /^\d+ pages? · A5 · Key \+ reference$/);
  [said, real] = await count(); assert.equal(said, real, 'Key + reference');
  assert.deepEqual(await page.evaluate(() => ['ms-pdf-labels', 'ms-paper', 'ms-pdf-what', 'ms-pdf-blend'].map((k) => localStorage.getItem(k))), ['numbers', 'a5', 'ref', '1']);
  // Cancel closes it, focus goes back to Print…, and the choices are there next time
  await page.click('#sfSheet [data-pr="cancel"]'); await page.waitForSelector('#sfSheet', { state: 'detached' });
  assert.equal(await page.evaluate(() => document.activeElement.id), 'sfPrint');
  await page.click('#sfPrint'); await page.waitForSelector('#sfSheet.sfprsh');
  for (const sel of ['[data-plabels="numbers"]', '[data-paper="a5"]', '[data-pwhat="ref"]']) assert.equal(await page.getAttribute(sel, 'aria-pressed'), 'true', sel);
  assert.equal(await page.isChecked('#sfPdfBlend'), true);
  // Download PDF from inside the sheet
  await page.click('[data-pwhat="page"]'); await page.click('[data-paper="letter"]');
  const want = +/^(\d+)/.exec(await sum())[1];
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click('#sfPDF')]);
  const s = (await readFile(await dl.path())).toString('latin1');
  assert.equal(s.slice(0, 5), '%PDF-');
  assert.equal((s.match(/\/Type\s*\/Page[^s]/g) || []).length, want, 'as many pages as the summary said');
  await page.keyboard.press('Escape'); await page.waitForSelector('#sfSheet', { state: 'detached' });
  assert.deepEqual(errors, []);
});

test('each tab stays within about one and a half screens of room at 390×844, with the picture at its floor size', notOnWebKit(WK.font), async (t) => {
  const { page, errors } = await app();
  await sampleGuide(page);
  // the steady state: shading on, and the helper text already seen (one line each)
  await tab(page, 'shading'); await page.click('#sfShade [data-v="full"]'); await idle(page);
  const out = {};
  for (const pass of ['first', 'later']) {
    if (pass === 'later') await reopen(page);
    for (const tb of ['colours', 'pattern', 'shading', 'share']) {
      await tab(page, tb); await pinTabs(page); await idle(page);
      // (each one-line ⓘ is a 44px tap target: 16px taller than its line and margin, which the room allows for)
      const m = await page.evaluate((s) => ({ h: document.querySelector(s).scrollHeight, room: parseFloat(getComputedStyle(document.getElementById('sfWork')).getPropertyValue('--tabMin')), pic: Math.round(document.getElementById('sfCanvas').getBoundingClientRect().height), info: document.querySelectorAll(s + ' button.sfinfo:not(.open)').length }), pane(tb));
      assert.equal(m.pic, 380, `${tb}: the picture at its floor size`);
      out[pass + ' ' + tb] = `${m.h}px (${(m.h / m.room).toFixed(2)} × the ${m.room}px under the pinned tabs)`;
      // (v288: Colours has the "N markers on this page ›" button too, 44px and its margin)
      if (pass === 'later') assert.ok(m.h <= m.room * 1.5 + 2 + 16 * m.info + (tb === 'colours' ? 54 : 0), `${tb}: ${out[pass + ' ' + tb]}`);
    }
  }
  t.diagnostic(JSON.stringify(out));
  assert.deepEqual(errors, []);
});

// ---- From the UX polish pass ----
test('Shading leads its tab, the marker count leads Colours, and filters say what they do', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  const firstColours = await page.evaluate(() => document.querySelector('.sftab[data-tab="colours"]').firstElementChild.className);
  assert.match(firstColours, /sfmkcount/);
  await page.click('.sftabbtn[data-t="shading"]');
  const firstStyle = await page.evaluate(() => document.querySelector('.sftab[data-tab="shading"]').firstElementChild.className);
  assert.match(firstStyle, /sfshade/);
  assert.deepEqual(errors, []);
});
