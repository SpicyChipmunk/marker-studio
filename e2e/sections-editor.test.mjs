// Edit sections: merge, split, re-detect, Undo, Discard.
// (v320) Tests organised by feature: each block below came from the file named above it, its tests unchanged.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  ROOT,
  answerAsks,
  askAnswer,
  asked,
  buildGo,
  idle,
  openApp,
  sampleGuide,
  saveGuide,
  scrollTop,
  sectionPoint,
  setup,
  teardown,
  toolStatus,
} from './helpers.mjs';

before(setup);
after(teardown);

// ---- from rebuild-sections.test.mjs ----
// Going back to the sections of a built guide keeps its work: re-detecting and turning ask first and undo one step at
// a time; Build with no changes, or after leaving sections out, keeps every marker, pin and tick; section edits not
// built yet are said, asked about and kept; and a rebuilt guide never saves a scrambled copy.
{
  const colourSome = async (page, n) => {
    const ls = await page.evaluate((n) => __mstest.assignData.order.slice(0, n), n);
    await scrollTop(page);
    for (const l of ls) {
      const p = await sectionPoint(page, l);
      await page.mouse.click(p.x, p.y);
    }
    return ls;
  };
  const done = (page) => page.evaluate(() => [...__mstest.colored].reduce((a, b) => a + b, 0));
  // ---- From the third full review (v259) ----
  const saved = (page, id) =>
    page.evaluate(
      (id) =>
        IDB.get('guide-' + id).then((p) => ({
          lmap: p.lmap,
          assign: JSON.stringify(p.assign),
          prog: (p.prog || []).length,
        })),
      id,
    );
  const savedId = (page) => page.evaluate(() => state.saved.find((s) => s.type === 'guide').id);
  async function tickSome(page, n) {
    await page.evaluate((n) => {
      const t = __mstest;
      t.assignData.order.slice(0, n).forEach((l) => {
        t.colored[l] = 1;
      });
      t.guideDirty = true;
    }, n);
  }
  // ---- From the fourth review (data safety) ----
  // Save (a new guide into the Library), done once the header says so
  const saveNew = (page) => saveGuide(page);
  const AUTO = 2300;
  // idle(page, AUTO): until auto-save (1.5 s after the last change) has run
  const stored = (page, id) =>
    page.evaluate(
      (id) =>
        IDB.get('guide-' + id).then(
          (p) =>
            p && {
              prog: (p.prog || []).length,
              assign: p.assign,
              tones: p.tones || {},
              ref: p.ref || null,
              base: p.base || null,
              style: p.style,
            },
        ),
      id,
    );
  const doneN = (page) => page.evaluate(() => __mstest.colored.reduce((a, b) => a + b, 0));
  const assignMap = (page) =>
    page.evaluate(() => {
      const a = __mstest.assignData.assign,
        o = {};
      for (const k in a) o[k] = a[k].mkey;
      return o;
    });
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
  const tab = (page, t) => page.click(`.sftabbtn[data-t="${t}"]`);
  // ---- From the fifth review’s leftovers ----
  const toastText = (page) =>
    page.evaluate(() => {
      const t = document.getElementById('msToast');
      return t && t.classList.contains('on') ? t.textContent : '';
    });
  // Edit sections on a saved guide: exclude a big section by tapping it
  async function excludeOne(page) {
    await page.click('#sfBack2');
    await idle(page);
    await scrollTop(page);
    const l = await page.evaluate(() => {
      const t = __mstest;
      return t.assignData.order.slice().sort((a, b) => t.comps[b].area - t.comps[a].area)[2];
    });
    const p = await sectionPoint(page, l);
    await page.mouse.click(p.x, p.y);
    await page.waitForFunction((l) => !__mstest.counted(l), l);
    return l;
  }
  const hide = (page) =>
    page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
      delete document.visibilityState;
    });
  // ---- From the fifth review (data safety) ----
  const storedR5 = (page, id) =>
    page.evaluate(
      (id) =>
        IDB.get('guide-' + id).then(
          (p) =>
            p && {
              prog: (p.prog || []).length,
              progL: p.prog || [],
              assign: p.assign,
              tones: p.tones || {},
              ref: p.ref || null,
              photo: (p.style && p.style.photo) || null,
              out: p.out || null,
              secStates: p.secStates || {},
              lmap: p.lmap,
            },
        ),
      id,
    );
  const openSaved = async (page, id) => {
    await page.evaluate((id) => loadGuide({ id }), id);
    await page.waitForFunction((id) => __mstest.curId === id && __mstest.assignData, id, { timeout: 10000 });
    await idle(page);
  };
  // set a range or checkbox in the controls as a person would
  const setInput = (page, sel, v) =>
    page.$eval(
      sel,
      (e, v) => {
        if (e.type === 'checkbox') {
          e.checked = v;
          e.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
          e.value = v;
          e.dispatchEvent(new Event('input', { bubbles: true }));
          e.dispatchEvent(new Event('change', { bubbles: true }));
        }
      },
      v,
    );
  // Edit sections on a saved guide: exclude a big section by tapping it
  async function excludeOneChecked(page) {
    await page.click('#sfBack2');
    await idle(page);
    await scrollTop(page);
    const l = await page.evaluate(() => {
      const t = __mstest;
      return t.assignData.order.slice().sort((a, b) => t.comps[b].area - t.comps[a].area)[2];
    });
    const p = await sectionPoint(page, l);
    await page.mouse.click(p.x, p.y);
    await idle(page);
    assert.equal(await page.evaluate((l) => __mstest.counted(l), l), false, 'excluded');
    return l;
  }
  const status = (page) => page.textContent('#sfSaveSt');
  test('undo in the sections editor after building keeps colouring progress', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    // an edit before building, so there is something to undo later
    await page.click('#sfBack2');
    await idle(page);
    await page.evaluate(() => {
      const t = __mstest,
        o = t.assignData.order;
      t.mergeCellsSnap(o[0], o[1]);
      t.render();
    });
    await buildGo(page);
    await idle(page);
    await page.click('#sfColor');
    await colourSome(page, 4);
    assert.equal(await done(page), 4);
    await page.click('#sfDoneBtn');
    await page.click('#sfBack2');
    await idle(page);
    await page.evaluate(() => __mstest.doUndoSeg());
    await buildGo(page);
    await idle(page);
    assert.ok((await done(page)) >= 3, 'progress kept after undo + rebuild');
    assert.deepEqual(errors, []);
  });
  // ---- From the second full review ----
  test('re-detecting the sections drops pins and flat sections that pointed at old section numbers', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await answerAsks(page);
    await page.evaluate(() => {
      const t = __mstest,
        o = t.assignData.order;
      t.locks[o[3]] = t.assignData.assign[o[3]].mkey;
      t.shadeFlat[o[1]] = 1;
    });
    await page.click('#sfBack2');
    await idle(page);
    await page.click('#sfAdjToggle');
    await page.click('#sfRotR');
    await idle(page, 1200);
    await buildGo(page);
    await page.waitForFunction(() => __mstest.assignData && __mstest.assignData.N > 0);
    await idle(page);
    const r = await page.evaluate(() => ({
      locks: Object.keys(__mstest.locks).length,
      flat: Object.keys(__mstest.shadeFlat).length,
      done: __mstest.colored.reduce((a, b) => a + b, 0),
    }));
    assert.deepEqual(r, { locks: 0, flat: 0, done: 0 });
    assert.deepEqual(errors, []);
  });
  test('rebuilding the sections under an open guide never saves a scrambled copy of it', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await tickSome(page, 4);
    await saveGuide(page);
    await idle(page);
    const id = await savedId(page),
      before = await saved(page, id);
    // make a change, go back to the sections, turn the picture, then open something else
    await page.evaluate(() => {
      __mstest.colored[__mstest.assignData.order[5]] = 1;
      __mstest.guideDirty = true;
    });
    await answerAsks(page);
    await page.click('#sfBack2');
    await idle(page);
    await page.click('#sfAdjToggle');
    await page.click('#sfRotR');
    await idle(page, 1200);
    await page.evaluate(() => SF.loadSample());
    await idle(page, 1500);
    const after = await saved(page, id);
    assert.equal(after.lmap, before.lmap, 'the saved sections are untouched');
    assert.equal(after.assign, before.assign, 'and so are its colours');
    // the change made before going back was saved into its Library entry, not lost
    assert.equal(after.prog, 5);
    assert.deepEqual(errors, []);
  });
  test('undoing an accidental re-detect keeps progress and pins when the guide is built again', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await tickSome(page, 6);
    const pin = await page.evaluate(() => {
      const t = __mstest,
        l = t.assignData.order[8];
      t.locks[l] = t.assignData.assign[l].mkey;
      return l;
    });
    await answerAsks(page);
    await page.click('#sfBack2');
    await page.click('#sfAdjToggle');
    await page.click('#sfEnh');
    await idle(page);
    await page.click('#sfPlanUndo');
    await idle(page);
    await buildGo(page);
    await idle(page);
    const r = await page.evaluate(
      (pin) => ({ done: __mstest.colored.reduce((a, b) => a + b, 0), pin: !!__mstest.locks[pin] }),
      pin,
    );
    assert.deepEqual(r, { done: 6, pin: true });
    assert.deepEqual(errors, []);
  });
  test('Manual colours are not carried onto different shapes after re-detecting', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await page.click('.sftabbtn[data-t="pattern"]');
    await page.click('#sfFam [data-v="manual"]');
    await idle(page);
    const before = await page.evaluate(() => {
      const t = __mstest,
        a = {};
      for (const l in t.assignData.assign) a[l] = t.assignData.assign[l].mkey;
      return a;
    });
    await answerAsks(page);
    await page.click('#sfBack2');
    await page.click('#sfAdjToggle');
    await page.click('#sfRotR');
    await idle(page, 1200);
    await buildGo(page);
    await idle(page);
    const same = await page.evaluate((b) => {
      const t = __mstest;
      let n = 0,
        k = 0;
      for (const l in t.assignData.assign) {
        k++;
        if (b[l] === t.assignData.assign[l].mkey) n++;
      }
      return n / k;
    }, before);
    assert.ok(same < 0.9, `only ${(same * 100).toFixed(0)}% keep the old marker by number`);
    assert.deepEqual(errors, []);
  });
  test('turning a built guide asks first, and Undo brings back its ticks, pins and colours', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await saveNew(page);
    const id = await savedId(page);
    await tickN(page, 20);
    const pin = await page.evaluate(() => {
      const t = __mstest,
        l = t.assignData.order[30];
      t.locks[l] = t.assignData.assign[l].mkey;
      t.guideDirty = true;
      t.renderGuide();
      return l;
    });
    await idle(page, AUTO);
    const a0 = await assignMap(page);
    await answerAsks(page, true);
    await page.click('#sfBack2');
    await page.click('#sfAdjToggle');
    await page.click('#sfRotR');
    await idle(page);
    let q = await asked(page);
    assert.equal(q.length, 1);
    assert.match(q[0], /clears your colouring progress/);
    await page.click('#sfRotL');
    await idle(page);
    assert.equal((await asked(page)).length, 1, 'asked once: nothing left to lose the second time');
    await buildGo(page);
    await idle(page);
    assert.equal(await doneN(page), 0, 'the new sections start uncoloured');
    // ← Edit sections → Undo (once per turn: each is its own step): the picture, the sections and everything on them come back
    await page.click('#sfBack2');
    await idle(page);
    await page.click('#sfPlanUndo');
    await idle(page);
    await page.click('#sfPlanUndo');
    await idle(page);
    await buildGo(page);
    await idle(page);
    assert.equal(await doneN(page), 20);
    assert.ok(await page.evaluate((l) => !!__mstest.locks[l], pin), 'pin back');
    assert.deepEqual(await assignMap(page), a0, 'the same colours');
    await idle(page, AUTO);
    assert.equal((await stored(page, id)).prog, 20, 'and the Library entry has them again');
    assert.deepEqual(errors, []);
  });
  test('Random: back to the sections and Build again keeps every marker, the ticks and the undo steps', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await saveNew(page);
    await tab(page, 'pattern');
    await page.click('#sfFam [data-v="random"]');
    await idle(page);
    await tickN(page, 5);
    await idle(page, AUTO);
    const a0 = await assignMap(page),
      p0 = await page.evaluate(() => __mstest.planCount),
      ts0 = await page.evaluate(() => state.saved.find((s) => s.type === 'guide').ts);
    assert.ok(p0 >= 1);
    await page.click('#sfBack2');
    await idle(page);
    await buildGo(page);
    await idle(page);
    assert.deepEqual(await assignMap(page), a0, 'no section rolled again');
    assert.equal(await doneN(page), 5);
    assert.equal(await page.evaluate(() => __mstest.planCount), p0, 'the undo steps are kept');
    await idle(page, AUTO);
    assert.equal(
      await page.evaluate(() => state.saved.find((s) => s.type === 'guide').ts),
      ts0,
      'nothing changed, so nothing saved',
    );
    // a section brought in gets a marker of its own; the others keep theirs
    await page.click('#sfBack2');
    await idle(page);
    const l = await page.evaluate(() => {
      const t = __mstest;
      for (let l = 1; l < t.comps.length; l++)
        if (!t.counted(l) && t.comps[l] && !t.comps[l].merged && t.comps[l].area > 50) {
          t.secState[l] = 1;
          return l;
        }
      return 0;
    });
    await buildGo(page);
    await idle(page);
    const a1 = await assignMap(page);
    assert.ok(!l || a1[l], 'the new section has a marker');
    for (const k in a0) assert.equal(a1[k], a0[k]);
    assert.deepEqual(errors, []);
  });
  test('section edits of a Library guide left in the Resume slot are kept as a copy when a new guide takes the slot', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await saveGuide(page);
    await page.waitForFunction(() => state.saved.some((s) => s.type === 'guide'));
    const id = await page.evaluate(() => state.saved.find((s) => s.type === 'guide').id),
      name = await page.evaluate(() => __mstest.curName);
    const n0 = await page.evaluate(() => __mstest.assignData.N);
    const l = await excludeOne(page);
    await hide(page);
    await page.waitForFunction(() => {
      const m = JSON.parse(localStorage.getItem('ms-guide-auto') || 'null');
      return m && m.edits === 1;
    });
    // the tab is gone (reload): Home offers to resume them; then another guide's section edits take the slot
    await page.reload();
    await idle(page);
    await page.click('#mHome');
    await idle(page);
    assert.ok(await page.isVisible('#sfResume'), 'kept for Resume meanwhile');
    await page.evaluate(() => {
      setMode('sections');
      SF.loadSample();
    });
    await page.waitForFunction(() => __mstest.assignData);
    await idle(page);
    await excludeOne(page);
    await hide(page);
    await page.waitForFunction(
      () => {
        const m = JSON.parse(localStorage.getItem('ms-guide-auto') || 'null');
        return m && m.edits === 1 && m.savedId == null;
      },
      null,
      { timeout: AUTO + 3000 },
    );
    const gs = await page.evaluate(() =>
      state.saved.filter((s) => s.type === 'guide').map((s) => ({ id: s.id, name: s.name })),
    );
    assert.equal(gs.length, 2, 'the guide and a copy with its section edits');
    const copy = gs.find((g) => g.id !== id);
    assert.equal(copy.name, name + ' (section edits)');
    assert.match(await toastText(page), /Kept “.* \(section edits\)” in your Library/);
    const pl = await page.evaluate((id) => IDB.get('guide-' + id), copy.id);
    assert.equal(pl.edits, 1);
    assert.equal(pl.secStates[l], 2, 'with the edit');
    assert.equal(
      Object.keys((await page.evaluate((id) => IDB.get('guide-' + id), id)).assign).length,
      n0,
      'the guide itself is as built',
    );
    // the copy opens in Edit sections, ready to build (in a new tab: this one would ask about the sample's edits first)
    await page.reload();
    await idle(page);
    await page.evaluate((id) => loadGuide({ id }), copy.id);
    await page.waitForFunction((id) => __mstest.curId === id && __mstest.assignData, copy.id, {
      timeout: 10000,
    });
    assert.equal(await page.evaluate(() => __mstest.sfmode), 'review');
    assert.match(await page.textContent('#sfSaveSt'), /Section edits not saved/);
    assert.deepEqual(errors, []);
  });
  for (const trim of [0, 100]) {
    test(`reopen → Edit sections → Build with no changes keeps every section and tick (Background trim ${trim})`, async () => {
      const { page, errors } = await openApp();
      await sampleGuide(page);
      // a 4 × 4 grid of cells: the corner cells touch the edge twice as much as the others along it, so which edge
      // cells are background depends on the trim (at 0 only the corners, at 100 every cell along the edge)
      const id = await page.evaluate((trim) => {
        const S = 200,
          c = document.createElement('canvas');
        c.width = S;
        c.height = S;
        const g = c.getContext('2d'),
          im = g.createImageData(S, S),
          cell = (x, y) =>
            (x >= 2 && x % 50 < 2) || (y >= 2 && y % 50 < 2) ? -1 : ((y / 50) | 0) * 4 + ((x / 50) | 0);
        for (let y = 0; y < S; y++)
          for (let x = 0; x < S; x++) {
            const v = cell(x, y) + 1,
              j = (y * S + x) * 4;
            im.data[j] = v;
            im.data[j + 3] = 255;
          }
        g.putImageData(im, 0, 0);
        const keys = sfCollection().map((m) => m.mkey),
          edge = (i) => i % 4 === 0 || i % 4 === 3 || i < 4 || i > 11,
          corner = (i) => [0, 3, 12, 15].includes(i),
          assign = {};
        for (let i = 0; i < 16; i++)
          if (trim === 0 ? !corner(i) : !edge(i)) assign[i] = keys[(i * 7) % keys.length];
        const prog = Object.keys(assign).slice(0, 3).map(Number);
        return sfSaveDesign({
          name: 'Grid',
          W: S,
          H: S,
          keys: [...new Set(Object.values(assign))],
          n: Object.keys(assign).length,
          payload: {
            lmap: c.toDataURL('image/png'),
            assign,
            prog,
            minPos: 0,
            bgTrim: trim,
            secStates: {},
            style: { family: 'manual' },
          },
        });
      }, trim);
      const n0 = trim === 0 ? 12 : 4;
      // the guide open before has the other trim, so nothing of its trim may carry over
      await page.evaluate((t) => {
        __mstest.bgTrim = t;
      }, 100 - trim);
      await openSaved(page, id);
      assert.equal(await page.evaluate(() => __mstest.assignData.N), n0);
      await tickN(page, 0);
      assert.equal(await page.evaluate(() => __mstest.bgTrim), trim, 'its own trim');
      // (v284: part-way coloured, it opens in Colour along)
      if ((await page.evaluate(() => __mstest.sfmode)) === 'color') {
        await page.click('#sfDoneBtn');
        await idle(page);
      }
      await page.click('#sfBack2');
      await idle(page);
      await buildGo(page);
      await idle(page);
      assert.equal(await page.evaluate(() => __mstest.assignData.N), n0, 'the same sections');
      assert.equal(await doneN(page), 3, 'and ticks');
      assert.deepEqual(errors, []);
    });
  }
  test('Enhance and Sensitivity on a guide with progress ask first; No puts the control back, Yes can be undone', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await saveNew(page);
    await tickN(page, 5);
    await idle(page, AUTO);
    const adjust = async () => {
      await page.click('#sfBack2');
      await idle(page);
      if (!(await page.$('#sfEnh'))) await page.click('#sfAdjToggle');
      await idle(page);
    };
    await adjust();
    const enh0 = await page.evaluate(() => __mstest.enhance);
    await answerAsks(page, false);
    await setInput(page, '#sfEnh', !enh0);
    await idle(page);
    let q = await asked(page);
    assert.equal(q.length, 1);
    assert.match(q[0], /clears your colouring progress/);
    assert.equal(await page.evaluate(() => __mstest.enhance), enh0, 'Enhance is back as it was');
    assert.equal(await page.$eval('#sfEnh', (e) => e.checked), enh0);
    await setInput(page, '#sfSens', 2);
    await idle(page);
    assert.equal((await asked(page)).length, 2, 'Sensitivity asks too');
    await buildGo(page);
    await idle(page);
    assert.equal(await doneN(page), 5, 'nothing was cleared');
    // Yes: re-detected, and Undo brings it all back
    await askAnswer(page, true);
    await adjust();
    await setInput(page, '#sfSens', 2);
    await idle(page);
    await setInput(page, '#sfSens', 3);
    await idle(page);
    assert.equal((await asked(page)).length, 3, 'asked once for a run of changes');
    await page.click('#sfPlanUndo');
    await idle(page);
    await buildGo(page);
    await idle(page);
    assert.equal(await doneN(page), 5);
    assert.deepEqual(errors, []);
  });
  test('section edits not built: the status says so, and opening something else asks (Build keeps them, Discard doesn’t)', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await saveNew(page);
    const id = await savedId(page),
      n0 = await page.evaluate(() => __mstest.assignData.N);
    assert.match(await status(page), /Saved in your Library|Saves itself from now on/);
    await excludeOneChecked(page);
    assert.match(await status(page), /Section edits not saved — Build again to keep them/);
    // Cancel: nothing opens
    await page.evaluate(() => SF.loadSample());
    await page.waitForSelector('#sfEdAsk');
    await page.click('#sfEdAsk [data-a="stay"]');
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.curId), id);
    assert.equal(await page.evaluate(() => __mstest.sfmode), 'review');
    // Build: built and saved before the sample opens
    await page.evaluate(() => SF.loadSample());
    await page.waitForSelector('#sfEdAsk');
    await page.click('#sfEdAsk [data-a="build"]');
    await page.waitForFunction((id) => __mstest.assignData && __mstest.curId !== id, id);
    await idle(page);
    assert.equal(Object.keys((await storedR5(page, id)).assign).length, n0 - 1, 'the Library has the edit');
    // Discard: the Library keeps the guide as built
    await openSaved(page, id);
    await excludeOneChecked(page);
    await page.evaluate(() => SF.loadSample());
    await page.waitForSelector('#sfEdAsk');
    await page.click('#sfEdAsk [data-a="discard"]');
    await page.waitForFunction((id) => __mstest.assignData && __mstest.curId !== id, id);
    await idle(page);
    assert.equal(Object.keys((await storedR5(page, id)).assign).length, n0 - 1, 'unchanged');
    assert.deepEqual(errors, []);
  });
  test('section edits not built are kept when the page is hidden, and Resume brings them back to build', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await saveNew(page);
    const id = await savedId(page),
      n0 = await page.evaluate(() => __mstest.assignData.N);
    await tickN(page, 4);
    await idle(page, AUTO);
    const l = await excludeOneChecked(page);
    await hide(page);
    await idle(page);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('ms-guide-auto')).edits), 1);
    await page.reload();
    await page.waitForSelector('#sfResume', { state: 'visible' });
    await page.click('#sfResumeGo');
    await page.waitForFunction((id) => __mstest.curId === id && __mstest.assignData, id);
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.sfmode), 'review', 'back in Edit sections');
    assert.equal(await page.evaluate((l) => __mstest.counted(l), l), false, 'with the edit');
    assert.match(await status(page), /Section edits not saved/);
    assert.equal(await page.evaluate(() => __mstest.secEdPending()), true);
    await idle(page, AUTO);
    assert.equal(
      Object.keys((await storedR5(page, id)).assign).length,
      n0,
      'the Library keeps the guide as built until it is built again',
    );
    await buildGo(page);
    await idle(page);
    await idle(page, AUTO);
    const s = await storedR5(page, id);
    assert.equal(Object.keys(s.assign).length, n0 - 1, 'built and saved');
    assert.equal(s.prog, 4, 'with the ticks');
    assert.deepEqual(errors, []);
  });
  for (const fam of ['gradient', 'random']) {
    test(`a section left out and brought back keeps its marker, pin and tick, also after reopening (${fam})`, async () => {
      const { page, errors } = await openApp();
      await sampleGuide(page);
      if (fam !== 'gradient') {
        await page.click('.sftabbtn[data-t="pattern"]');
        await page.click(`#sfFam [data-v="${fam}"]`);
        await idle(page);
      }
      await saveNew(page);
      const id = await savedId(page);
      const [l, pin] = await page.evaluate(() => {
        const t = __mstest,
          l = t.assignData.order[6],
          p = t.assignData.order[7];
        t.locks[p] = t.assignData.assign[p].mkey;
        t.colored[l] = 1;
        t.colored[p] = 1;
        t.guideDirty = true;
        t.renderGuide();
        return [l, p];
      });
      const mk = await page.evaluate(
        ([l, p]) => [__mstest.assignData.assign[l].mkey, __mstest.assignData.assign[p].mkey],
        [l, pin],
      );
      await idle(page, AUTO);
      await page.click('#sfBack2');
      await idle(page);
      await page.evaluate(
        ([l, p]) => {
          __mstest.secState[l] = 2;
          __mstest.secState[p] = 2;
          __mstest.render();
        },
        [l, pin],
      );
      await buildGo(page);
      await idle(page);
      await idle(page, AUTO);
      assert.ok(!(await page.evaluate((l) => __mstest.assignData.assign[l], l)), 'left out');
      const s = await storedR5(page, id);
      assert.ok(s.out && s.out[l] && s.out[pin], 'kept with the guide');
      await page.reload();
      await idle(page);
      await openSaved(page, id);
      await page.click('#sfBack2');
      await idle(page);
      await page.evaluate(
        ([l, p]) => {
          __mstest.secState[l] = 1;
          __mstest.secState[p] = 1;
          __mstest.render();
        },
        [l, pin],
      );
      await buildGo(page);
      await idle(page);
      assert.deepEqual(
        await page.evaluate(
          ([l, p]) => [__mstest.assignData.assign[l].mkey, __mstest.assignData.assign[p].mkey],
          [l, pin],
        ),
        mk,
        'the same markers',
      );
      assert.equal(await page.evaluate((p) => __mstest.locks[p], pin), mk[1], 'the pin');
      assert.deepEqual(
        await page.evaluate(([l, p]) => [__mstest.colored[l], __mstest.colored[p]], [l, pin]),
        [1, 1],
        'the ticks',
      );
      assert.deepEqual(errors, []);
    });
  }
}

// ---- from sections-editor.test.mjs ----
// The sections editor (Edit sections), driven the way a person would: merge, split, add, include/exclude, undo, the
// size slider, crop and rotate; a Split that misses, Ctrl+Z, the tool row and sliders there, cropping's message, and
// nothing left over from the guide stages.
{
  // screen point for an image point
  const scr = (page, x, y) =>
    page.evaluate(
      ([x, y]) => {
        const c = document.getElementById('sfCanvas'),
          r = c.getBoundingClientRect();
        return { x: r.left + (x / c.width) * r.width, y: r.top + (y / c.height) * r.height };
      },
      [x, y],
    );
  const count = (page) => page.evaluate(() => (__mstest.countedList ? __mstest.countedList().length : null));
  const sig = (page) => page.evaluate(() => __mstest.labelsSig());
  async function editor(page) {
    await sampleGuide(page);
    await answerAsks(page);
    await page.click('#sfBack2');
    await idle(page);
    await scrollTop(page);
  }
  const tool = (page, m) => page.click(`#sfEdit [data-m="${m}"]`);
  // the biggest counted section and its middle row
  const biggest = (page) =>
    page.evaluate(() => {
      const t = __mstest,
        cl = t.countedList();
      let best = cl[0];
      for (const l of cl) if (t.comps[l].area > t.comps[best].area) best = l;
      const p = t.labelPos(best),
        c = t.comps[best];
      return { l: best, x: p.x, y: p.y, x0: c.x0, x1: c.x1 };
    });
  // ---- From the fourth review (v263 guide screen) ----
  const rect = (page, sel) =>
    page.evaluate((s) => {
      const e = document.querySelector(s);
      return e ? e.getBoundingClientRect().toJSON() : null;
    }, sel);
  // ---- From the fifth review (guide screen) ----
  const toastText = (page) =>
    page.evaluate(() => {
      const t = document.getElementById('msToast');
      return t && t.classList.contains('on') ? t.textContent : '';
    });
  const bigSections = (page, n = 6) =>
    page.evaluate((n) => {
      const t = __mstest;
      return t.assignData.order
        .slice()
        .sort((a, b) => t.comps[b].area - t.comps[a].area)
        .slice(0, n);
    }, n);
  async function tapSection(page, l) {
    const p = await sectionPoint(page, l);
    await page.mouse.click(p.x, p.y);
    await idle(page);
  }
  test('merge two sections, then undo', async () => {
    const { page, errors } = await openApp();
    await editor(page);
    const n0 = await count(page),
      s0 = await sig(page);
    const [a, b] = await page.evaluate(() => {
      const t = __mstest,
        cl = t.countedList();
      const adj = (x, y) => {
        const W = t.W,
          L = t.labels;
        for (let i = 0; i < L.length; i++) {
          if (L[i] !== x) continue;
          const X = i % W;
          for (const d of [-3, 3, -3 * W, 3 * W]) {
            const j = i + d;
            if (j >= 0 && j < L.length && L[j] === y && Math.abs((j % W) - X) <= 3) return true;
          }
        }
        return false;
      };
      for (const x of cl)
        for (const y of cl)
          if (x < y && t.comps[x].area > 400 && t.comps[y].area > 400 && adj(x, y)) return [x, y];
      return [cl[0], cl[1]];
    });
    await tool(page, 'merge');
    for (const l of [a, b]) {
      const p = await page.evaluate((l) => __mstest.labelPos(l), l);
      const q = await scr(page, p.x, p.y);
      await page.mouse.click(q.x, q.y);
      await idle(page);
    }
    assert.equal(await count(page), n0 - 1, 'one fewer section');
    // the section-edit undo is ↶ in the tool row under the picture
    assert.ok(await page.isVisible('#sfPlanUndo'), 'Undo in the tool row');
    await page.click('#sfPlanUndo');
    await idle(page);
    assert.equal(await count(page), n0);
    assert.equal(await sig(page), s0, 'undo restores the sections exactly');
    assert.deepEqual(errors, []);
  });
  test('split a section with a line, add one with a loop, undo both', async () => {
    const { page, errors } = await openApp();
    await editor(page);
    const n0 = await count(page),
      s0 = await sig(page),
      B = await biggest(page);
    await tool(page, 'split');
    const p0 = await scr(page, B.x, B.y),
      pl = await scr(page, B.x0 - 6, B.y),
      pr = await scr(page, B.x1 + 6, B.y);
    await page.mouse.move(p0.x, p0.y);
    await page.mouse.down();
    await page.mouse.move(pl.x, pl.y, { steps: 10 });
    await page.mouse.move(pr.x, pr.y, { steps: 20 });
    await page.mouse.up();
    await idle(page);
    assert.ok((await count(page)) > n0, 'the line divided the section');
    // add: a small closed loop inside the biggest remaining section
    const n1 = await count(page),
      C = await biggest(page),
      R = 10;
    await tool(page, 'add');
    await idle(page);
    if (!(await page.isChecked('#sfAutoClose'))) await page.check('#sfAutoClose');
    const pts = [];
    for (let i = 0; i <= 16; i++) {
      const t = (i / 16) * Math.PI * 2;
      pts.push(await scr(page, C.x + Math.cos(t) * R * 3, C.y + Math.sin(t) * R * 3));
    }
    await page.mouse.move(pts[0].x, pts[0].y);
    await page.mouse.down();
    for (const q of pts.slice(1)) await page.mouse.move(q.x, q.y, { steps: 2 });
    await page.mouse.up();
    await idle(page);
    assert.ok((await count(page)) > n1, 'the loop added a section');
    await page.click('#sfPlanUndo');
    await idle(page);
    await page.click('#sfPlanUndo');
    await idle(page);
    assert.equal(await sig(page), s0, 'two undos: back to the start');
    assert.deepEqual(errors, []);
  });
  test('include / exclude and the size slider change what the guide colours', async () => {
    const { page, errors } = await openApp();
    await editor(page);
    const n0 = await count(page),
      B = await biggest(page);
    await tool(page, 'toggle');
    await idle(page);
    const q = await scr(page, B.x, B.y);
    await page.mouse.click(q.x, q.y);
    await idle(page);
    assert.equal(await count(page), n0 - 1, 'tapped section excluded');
    await buildGo(page);
    await page.waitForFunction(() => __mstest.assignData && __mstest.assignData.N > 0);
    await idle(page);
    assert.equal(
      await page.evaluate((l) => __mstest.assignData.assign[l], B.l),
      undefined,
      'excluded section gets no marker',
    );
    await page.click('#sfBack2');
    await idle(page);
    await page.click('#sfPlanUndo');
    await idle(page);
    assert.equal(await count(page), n0, 'undo includes it again');
    await page.evaluate(() => {
      const el = document.getElementById('sfMin');
      el.value = 95;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await idle(page);
    assert.ok((await count(page)) < n0, 'a bigger minimum size drops small sections');
    assert.deepEqual(errors, []);
  });
  test('crop and rotate rebuild the picture at the new shape', async () => {
    const { page, errors } = await openApp();
    await editor(page);
    const d0 = await page.evaluate(() => [__mstest.W, __mstest.H]);
    await page.click('#sfAdjToggle');
    await idle(page);
    await page.click('#sfRotR');
    await idle(page, 1200);
    const d1 = await page.evaluate(() => [__mstest.W, __mstest.H]);
    assert.ok(d0[0] < d0[1] && d1[0] > d1[1], `rotated: ${d0} -> ${d1}`);
    await page.click('#sfCrop');
    await idle(page);
    const c = await page.locator('#sfCanvas').boundingBox();
    await page.mouse.move(c.x + c.width * 0.1, c.y + c.height * 0.1);
    await page.mouse.down();
    await page.mouse.move(c.x + c.width * 0.6, c.y + c.height * 0.7, { steps: 8 });
    await page.mouse.up();
    await page.click('#sfCropApply');
    await idle(page, 1200);
    const d2 = await page.evaluate(() => [__mstest.W, __mstest.H]);
    assert.ok(d2[0] < d1[0] * 0.7 && d2[1] < d1[1] * 0.8, `cropped: ${d1} -> ${d2}`);
    assert.ok((await count(page)) > 5, 'sections found in the crop');
    await buildGo(page);
    await page.waitForFunction(() => __mstest.assignData && __mstest.assignData.N > 0);
    assert.deepEqual(errors, []);
  });
  // ---- From the second full review ----
  test('back in the sections editor there is no sun or colour picker left over', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await page.click('.sftabbtn[data-t="shading"]');
    await page.evaluate(() => __mstest.shadeTo('full'));
    await idle(page);
    assert.ok(await page.isVisible('#sfSun'));
    await page.click('#sfBack2');
    await idle(page);
    assert.ok(!(await page.isVisible('#sfSun')), 'sun hidden');
    assert.ok(!(await page.isVisible('#sfSheet')), 'no picker');
    assert.deepEqual(errors, []);
  });
  // ---- From the fourth review (data safety) ----
  test('a Split stroke that does not divide the section leaves nothing behind', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await page.click('#sfBack2');
    await idle(page);
    const r = await page.evaluate(() => {
      const t = __mstest;
      let best = 0,
        ba = 0;
      for (let l = 1; l < t.comps.length; l++)
        if (t.counted(l) && t.comps[l].area > ba) {
          ba = t.comps[l].area;
          best = l;
        }
      const c = t.comps[best],
        x = Math.round(c.cx),
        y = Math.round(c.cy),
        u0 = t.undoCount,
        sig = t.labelsSig();
      // a short dab in the middle: it can't cut the section in two
      const made = t.splitAt(best, [
        { x, y },
        { x: x + 2, y },
      ]);
      return { made, undo: t.undoCount - u0, same: t.labelsSig() === sig };
    });
    assert.deepEqual(r, { made: 0, undo: 0, same: true });
    assert.match(await page.textContent('#sfHint'), /didn’t divide the section/);
    assert.deepEqual(errors, []);
  });
  test('Edit sections: the section count only in the tool row; the two sliders line up', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await answerAsks(page);
    await page.click('#sfBack2');
    await idle(page);
    assert.equal(await page.isVisible('#sfCount'), false);
    assert.match(await toolStatus(page), /^\d+ sections$/);
    const a = await rect(page, '#sfMin'),
      b = await rect(page, '#sfBg');
    assert.ok(Math.abs(a.left - b.left) < 1 && Math.abs(a.width - b.width) < 1, 'same left and width');
    assert.deepEqual(errors, []);
  });
  // ---- From the fifth review (data safety) ----
  test('turn then crop: each is its own Undo step', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await answerAsks(page);
    await page.click('#sfBack2');
    await page.click('#sfAdjToggle');
    await page.click('#sfRotR');
    await idle(page);
    const w1 = await page.evaluate(() => __mstest.W);
    // (v308: a crop chosen, as Crop › Apply does; Auto crop on the sample, which its drawing fills, has nothing to trim)
    await page.evaluate(() => __mstest.geoSet({ crop: { x: 0.1, y: 0.1, w: 0.8, h: 0.8 } }));
    await idle(page);
    assert.ok(await page.evaluate(() => !!__mstest.cropRect), 'cropped');
    await page.click('#sfPlanUndo');
    await idle(page);
    assert.deepEqual(
      await page.evaluate(() => [__mstest.rot90, !!__mstest.cropRect, __mstest.W]),
      [90, false, w1],
      'one Undo: turned, not cropped',
    );
    await page.click('#sfPlanUndo');
    await idle(page);
    assert.deepEqual(
      await page.evaluate(() => [__mstest.rot90, !!__mstest.cropRect]),
      [0, false],
      'two: as it was',
    );
    assert.deepEqual(errors, []);
  });
  test('cropping: no Full screen button, and the instruction is said once (in the pane, not again in a toast)', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    assert.equal(await page.isVisible('#sfFull'), true);
    await page.click('#sfBack2');
    await idle(page);
    await page.click('#sfAdjToggle');
    await page.click('#sfCrop');
    await idle(page);
    assert.equal(await page.isVisible('#sfFull'), false, 'Full screen is gone while cropping');
    assert.equal(await page.isVisible('#sfZin'), true, 'zoom stays');
    assert.doesNotMatch(await toastText(page), /Drag a box/, 'no toast repeating the pane');
    assert.match(await page.textContent('#sfCtl'), /Drag a box over the area to keep/);
    await page.click('#sfCropCancel');
    await idle(page);
    assert.equal(await page.isVisible('#sfFull'), true, 'back after cropping');
    assert.deepEqual(errors, []);
  });
  test('Ctrl+Z in Edit sections undoes the last section edit, as ↶ Undo does (not while typing or with a sheet open)', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await page.click('#sfBack2');
    await idle(page);
    await scrollTop(page);
    const n0 = await page.evaluate(() => __mstest.undoCount);
    const [l] = await bigSections(page, 1);
    await tapSection(page, l);
    await idle(page);
    const n1 = await page.evaluate(() => __mstest.undoCount);
    assert.equal(n1, n0 + 1, 'the tap is an edit');
    await page.focus('#sfMore');
    await page.click('#sfMore');
    await page.waitForSelector('#sfSheet');
    await page.keyboard.press('Control+z');
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.undoCount), n1, 'not behind a sheet');
    await page.keyboard.press('Escape');
    await idle(page);
    await page.keyboard.press('Control+z');
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.undoCount), n0, 'undone');
    assert.equal(await page.isVisible('#sfPlanUndo'), n0 > 0);
    assert.deepEqual(errors, []);
  });
}

// ---- v329: possible gaps in the lines (66-gaps) ----
// e2e/fixtures/gap-page.png: line art drawn for the tests, a grid of boxes where two lines stop 3 px short (of the
// frame's foot, and of its right side), and an open "C" whose opening is wider than the line (not a gap to close)
{
  const ONB = { 'ms-onboarded': '1', 'ms-setup-tip': '1', 'ms-photo-tips': '1' };
  async function gapPage(page) {
    const buf = await readFile(join(ROOT, 'e2e', 'fixtures', 'gap-page.png'));
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.evaluate(() => SF.pickPhoto())]);
    await fc.setFiles({ name: 'gap-page.png', mimeType: 'image/png', buffer: buf });
    await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 60000 });
    await page.waitForSelector('#sfGapLine:not([hidden])', { timeout: 30000 });
  }
  const count = (page) => page.evaluate(() => parseInt(document.getElementById('sfCount').textContent, 10));
  const line = (page) => page.evaluate(() => document.getElementById('sfGapLine').textContent.trim());
  test('v329 gaps: the quick step says 2 possible gaps · Review; Review shows them in Edit sections, zoomed to the first; Dismiss, Close, Undo', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180, storage: { ...ONB, 'ms-sec-tools': '0' } });
    await gapPage(page);
    assert.ok(await page.isVisible('#sfQuick'), 'the quick step');
    assert.equal(await line(page), '2 possible gaps in the lines, where a section may be two · Review');
    assert.match(await page.textContent('#sfLive'), /^2 possible gaps in the lines/);
    const n0 = await count(page);
    await page.click('#sfGapLine [data-gap="review"]');
    await idle(page);
    assert.equal(await page.isVisible('#sfQuick'), false, 'Edit sections');
    assert.match(
      await line(page),
      /^Gap 1 of 2: a line stops just short here\. Close it to make two sections\./,
    );
    assert.ok((await page.evaluate(() => __mstest.zoom)) >= 4, 'zoomed to it');
    assert.equal(
      await page.evaluate(() => document.activeElement.dataset.gap),
      'close',
      'the keyboard on Close',
    );
    // Dismiss: the other one shown, alone
    await page.click('#sfGapLine [data-gap="dismiss"]');
    await idle(page);
    assert.match(await line(page), /^Gap 1 of 1:/);
    assert.equal(await page.locator('#sfGapLine [data-gap="next"]').count(), 0);
    // Close: one more section, and the line goes
    await page.click('#sfGapLine [data-gap="close"]');
    await idle(page);
    assert.equal(await count(page), n0 + 1, 'the gap closed: two sections');
    assert.equal(await page.isVisible('#sfGapLine'), false);
    // Undo: the section as it was; checked again, the gap is back (the one dismissed stays dismissed)
    await page.keyboard.press('Control+z');
    await idle(page);
    assert.equal(await count(page), n0);
    await page.waitForSelector('#sfGapLine:not([hidden])', { timeout: 30000 });
    assert.equal(await line(page), '1 possible gap in the lines, where a section may be two · Show');
    assert.deepEqual(errors, []);
  });
  test('v329 gaps: Close all closes both as one Undo step; an edit checks again; none for the sample', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180, storage: ONB });
    await gapPage(page);
    assert.match(await line(page), /^2 possible gaps .* · Show$/, 'Edit sections: Show');
    const n0 = await count(page),
      g0 = await page.evaluate(() => __mstest.gapN.started);
    await page.click('#sfGapLine [data-gap="show"]');
    await idle(page);
    await page.click('#sfGapLine [data-gap="next"]');
    await idle(page);
    assert.match(await line(page), /^Gap 2 of 2:/);
    await page.click('#sfGapLine [data-gap="all"]');
    await idle(page);
    assert.equal(await count(page), n0 + 2);
    assert.equal(await page.isVisible('#sfGapLine'), false);
    await idle(page, 1200);
    assert.equal(
      await page.evaluate(() => __mstest.gapN.started),
      g0,
      'not checked again for its own closes',
    );
    await page.keyboard.press('Control+z');
    await idle(page);
    assert.equal(await count(page), n0, 'one Undo step');
    await page.waitForSelector('#sfGapLine:not([hidden])', { timeout: 30000 });
    assert.match(await line(page), /^2 possible gaps/);
    assert.deepEqual(errors, []);
  });
}
