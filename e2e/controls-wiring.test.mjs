// The guide's controls (js/guide/50-53): every state of the broad set in e2e/controls-states.mjs renders without an
// error and wires each of its controls every time it is drawn, and the few controls no other test uses (the saved
// palette picker, Tilt, Sensitivity, Join the ends of a loop, focus mode's colour list) do what they say.
// (scripts/controls-compare.mjs uses the same states to compare the controls' markup, wiring and styles with an
// earlier version of the code.)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, sampleGuide, idle, saveGuide } from './helpers.mjs';
import { SESSIONS, CTL_INIT, click, slide, choose } from './controls-states.mjs';

before(setup);
after(teardown);

// each control and the events its handlers listen for
const WIRED = {
  // Plan: Colours
  sfSrc: ['click'], sfHarm: ['change'], sfPalPick: ['change'], sfPal: ['click'], sfMood: ['click'],
  sfMkCount: ['input', 'change'], sfExpand: ['change'], sfExpChar: ['input', 'change'], sfFiltToggle: ['click'],
  // Pattern
  sfFam: ['click'], sfShape: ['click'], sfDir: ['click'], sfGStart: ['input', 'change'], sfLook: ['click'], sfShuffle: ['click'], sfVary: ['click'], sfLock: ['click'],
  sfNoAdj: ['change'], sfResetA: ['click'], sfSpread: ['input', 'change'], sfMix: ['click'],
  sfPaint: ['click'], sfBrush: ['click'], sfFillAll: ['click'],
  sfPhPick: ['click'], sfPhAlign: ['click'], sfPhAuto: ['click'], sfPhFit: ['click'], sfPhOp: ['input'],
  sfPhRough: ['change'], sfPhPaper: ['change'],
  // Shading
  sfShade: ['click'], sfShLight: ['click'], sfHiStyle: ['change'], sfShStyle: ['change'], sfRound: ['input', 'change'], sfShHi: ['input', 'change'],
  sfShLo: ['input', 'change'], sfShLines: ['change'], sfShFlat: ['click'], sfShNoteT: ['click'], sfTex: ['change', 'input'],
  // Share and the bar
  sfReveal: ['click'], sfExport: ['click'], sfPrint: ['click'], sfPlan: ['click'], sfAsPal: ['click'],
  sfShareGuide: ['click'], sfBack2: ['click'], sfColor: ['click'],
  // focus mode
  sfExitFoc: ['click'], sfFocCols: ['click'], sfFocAll: ['click'], sfToneSteps: ['change'], sfFocMk: ['click'],
  // crop
  sfCropApply: ['click'], sfCropReset: ['click'], sfCropCancel: ['click'],
  // Edit sections
  sfPgUndo: ['click'], sfPgAdj: ['click'], sfAdjToggle: ['click'], sfRotL: ['click'], sfRotR: ['click'],
  sfPgOpen: ['click'], sfCrop: ['click'], sfAutoCrop: ['click'], sfEnh: ['change'], sfTilt: ['input'],
  sfSens: ['input'], sfMin: ['input'], sfBg: ['input'], sfEmToggle: ['click'], sfEmMerge: ['click'],
  sfEmSplit: ['click'], sfEmAdd: ['click'], sfAutoClose: ['change'], sfBuild: ['click'],
};

test('every state of the controls renders without an error, and each drawing of them wires every control in it', async () => {
  let states = 0,
    drawn = 0,
    checked = 0;
  const seen = new Set();
  for (const ses of SESSIONS) {
    const { page, errors } = await openApp({ init: CTL_INIT, storage: ses.storage });
    await idle(page);
    const cap = async (name) => {
      const r = await page.evaluate(() => window.__ctlTake());
      states++;
      if (!r.writes.length) return;
      drawn++;
      // the controls as last drawn, and the listeners added after that
      const n = r.writes.length,
        html = r.writes[n - 1],
        after = r.listen.filter((x, i) => r.listenAt[i] === n);
      for (const [id, evs] of Object.entries(WIRED)) {
        if (!html.includes(' id="' + id + '"')) continue;
        seen.add(id);
        for (const ev of evs) {
          checked++;
          assert.ok(after.some((x) => x[0] === '#' + id && x[1] === ev), `${ses.name}/${name}: #${id} has a ${ev} listener`);
        }
      }
    };
    await ses.run(page, cap, idle);
    assert.deepEqual(errors, [], ses.name);
    await page.context().close();
  }
  // the states reach every control in the list
  assert.deepEqual(Object.keys(WIRED).filter((id) => !seen.has(id)), [], 'controls never drawn');
  assert.ok(states >= 100 && drawn >= 80 && checked > 1000, `${states} states, ${drawn} drawn, ${checked} checks`);
});

test('the saved palette picker chooses which palette the guide uses', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await idle(page);
  const keys = await page.evaluate(() => {
    const own = [...state.owned];
    state.saved.unshift({ id: 881001, type: 'palette', name: 'First', keys: own.slice(0, 5), ts: 881001 });
    state.saved.unshift({ id: 881002, type: 'palette', name: 'Second', keys: own.slice(20, 26), ts: 881002 });
    save();
    return own.slice(20, 26);
  });
  await click(page, '#sfSrc [data-v="saved"]');
  await idle(page);
  const opts = await page.$$eval('#sfPalPick option', (o) => o.map((x) => [x.value, x.textContent, x.selected]));
  assert.deepEqual(opts.map((o) => o.slice(0, 2)), [['881002', 'Second (6)'], ['881001', 'First (5)']]);
  const first = await page.evaluate(() => __mstest.styleVars.savedPalId);
  assert.equal(String(first), opts.find((o) => o[2])[0], 'the palette chosen is the one shown');
  await choose(page, 'sfPalPick', first === 881001 ? '881002' : '881001');
  await idle(page);
  const now = await page.evaluate(() => __mstest.styleVars.savedPalId);
  assert.notEqual(now, first);
  assert.equal(await page.$eval('#sfPalPick', (s) => s.value), String(now), 'still shown after the redraw');
  if (now === 881002) {
    const used = await page.evaluate(() => [...new Set(__mstest.assignData.order.map((l) => __mstest.assignData.assign[l].mkey))]);
    assert.ok(used.every((k) => keys.includes(k)), 'the guide uses only the second palette’s markers');
  }
  assert.deepEqual(errors, []);
});

// found in the v268 review: drawing the controls (as opening a guide does) used to switch a guide whose saved palette
// had been deleted to the first palette in the list, without a word, so its next change recoloured it from that one
test('a guide whose saved palette was deleted reopens saying so, and keeps it until you choose another', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await idle(page);
  await page.evaluate(() => {
    const own = [...state.owned];
    state.saved.unshift({ id: 882001, type: 'palette', name: 'Keep', keys: own.slice(0, 5), ts: 882001 });
    state.saved.unshift({ id: 882002, type: 'palette', name: 'Gone', keys: own.slice(20, 26), ts: 882002 });
    save();
  });
  await click(page, '#sfSrc [data-v="saved"]');
  await idle(page);
  assert.equal(await page.evaluate(() => __mstest.styleVars.savedPalId), 882002);
  await saveGuide(page);
  await idle(page);
  const guide = await page.evaluate(() => state.saved.find((s) => s.type === 'guide').id);
  const used = () => page.evaluate(() => __mstest.assignData.order.map((l) => __mstest.assignData.assign[l].mkey).join());
  const before = await used();
  // the palette is deleted, then the guide is opened again from the Library
  await page.evaluate(() => {
    state.saved = state.saved.filter((x) => x.id !== 882002);
    save();
  });
  await page.click('#mHome');
  await page.click('#homeLibCard');
  await idle(page);
  await page.click(`#savedList .srow[data-id="${guide}"] .sname`);
  await page.waitForFunction(() => !!(window.__mstest && __mstest.assignData));
  await idle(page);
  assert.equal(await page.evaluate(() => __mstest.styleVars.savedPalId), 882002, 'not switched to another palette');
  assert.deepEqual(await page.$$eval('#sfPalPick option', (o) => o.map((x) => [x.value, x.textContent, x.selected])), [
    ['', 'Palette deleted \u2014 choose another', true],
    ['882001', 'Keep (5)', false],
  ]);
  assert.equal(await used(), before, 'the guide opens as it was saved');
  // choosing one uses it
  await choose(page, 'sfPalPick', '882001');
  await idle(page);
  assert.equal(await page.evaluate(() => __mstest.styleVars.savedPalId), 882001);
  assert.equal(await page.$eval('#sfPalPick', (s) => s.value), '882001');
  assert.deepEqual(errors, []);
});

test('Edit sections: Tilt and Sensitivity show their values, Join the ends of a loop changes the Add hint', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await idle(page);
  await click(page, '#sfBack2');
  await idle(page);
  await click(page, '#sfAdjToggle');
  await idle(page);
  await slide(page, 'sfTilt', 1.4);
  await idle(page);
  assert.equal(await page.textContent('#sfTiltVal'), '1.4°');
  // Sensitivity is there only with Enhance on
  const on = await page.evaluate(() => __mstest.enhance);
  assert.equal(await page.isVisible('#sfSensWrap'), on);
  await click(page, '#sfEnh');
  await idle(page);
  assert.equal(await page.isVisible('#sfSensWrap'), !on);
  if (on) {
    await click(page, '#sfEnh');
    await idle(page);
  }
  await slide(page, 'sfSens', 7);
  await idle(page);
  assert.equal(await page.textContent('#sfSensVal'), '7');
  await click(page, '#sfEmAdd');
  await idle(page);
  assert.equal(await page.isVisible('#sfAutoCloseWrap'), true, 'Join the ends of a loop is offered with Add');
  const h1 = await page.textContent('#sfHint');
  await click(page, '#sfAutoClose');
  await idle(page);
  const h2 = await page.textContent('#sfHint');
  assert.match(h1, /^Add: draw across a region/);
  assert.match(h2, /^Add: draw a loop to enclose a new section/);
  await click(page, '#sfEmMerge');
  await idle(page);
  assert.equal(await page.isVisible('#sfAutoCloseWrap'), false);
  assert.deepEqual(await page.$$eval('#sfEdit button', (b) => b.map((x) => x.getAttribute('aria-pressed'))), ['false', 'true', 'false', 'false']);
  assert.deepEqual(errors, []);
});

test('focus mode: a colour chosen in the Colours sheet is the one shown', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await idle(page);
  await click(page, '#sfColor');
  await idle(page);
  await click(page, '#sfFocus');
  await idle(page);
  await click(page, '#sfFocCols');
  await idle(page);
  assert.equal(await page.isVisible('#sfFocSheet'), true);
  const k = await page.$eval('#sfFocMk .focmk:nth-child(3)', (b) => b.getAttribute('data-k'));
  await click(page, '#sfFocMk .focmk:nth-child(3)');
  await idle(page);
  const cur = await page.evaluate(() => __mstest.assignData.assign[__mstest.focusOrd[__mstest.focusPos]].mkey);
  assert.equal(cur, k);
  assert.equal(await page.isVisible('#sfFocSheet'), false, 'the sheet closes');
  assert.deepEqual(errors, []);
});
