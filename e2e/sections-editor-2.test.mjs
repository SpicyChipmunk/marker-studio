// Edit sections: merge, split, re-detect, Undo, Discard.
// (v320) Tests organised by feature: each block below came from the file named above it, its tests unchanged.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ROOT,
  WK,
  addFromMarkers,
  answerAsks,
  buildGo,
  clearCollection,
  haveSet,
  idle,
  letterGuide,
  notOnWebKit,
  openApp,
  openAtScale,
  pause,
  sampleGuide,
  saveGuide,
  scanFromMarkers,
  scrollTop,
  sectionPoint,
  setup,
  teardown,
  welcome,
} from './helpers.mjs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { GEN_STRAIGHTEN } from './photo-gens.mjs';

before(setup);
after(teardown);

// ---- from v285-review2.test.mjs ----
// v285's second review (after release prep): changes made just before the page goes away are kept; Resume's section
// edits, discarded, never overwrite the Library guide; edits left by an earlier visit are kept as a copy; a guide
// deleted while open stays out of the slot; blocked storage asks before a guide goes; Continue's row is on screen;
// Reveal gives the keyboard back; the Library's backup line; the welcome on a landscape phone; singular wording.
{
  const AUTO = 2300;
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
  const hide = (page) =>
    page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
      delete document.visibilityState;
    });
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
  test('section edits left by an earlier visit are kept as a copy when the guide is opened and changed another way', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await saveGuide(page);
    const id = await page.evaluate(() => __mstest.curId);
    await excludeOne(page);
    await hide(page);
    await idle(page);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('ms-guide-auto')).edits), 1);
    // the app was closed; now the guide is opened from the Library (not Resume) and ticked
    await page.reload();
    await idle(page);
    await page.evaluate((id) => loadGuide({ id }), id);
    await page.waitForFunction((id) => __mstest.curId === id && __mstest.assignData, id);
    await idle(page);
    await tickN(page, 1);
    await page.evaluate(() => __mstest.flushSave());
    await idle(page, AUTO);
    const names = await page.evaluate(() => state.saved.filter((s) => s.type === 'guide').map((s) => s.name));
    assert.equal(names.length, 2, 'the guide and its section edits: ' + names);
    assert.ok(names.some((n) => / \(section edits\)$/.test(n)));
    assert.deepEqual(errors, []);
  });
}

// ---- from v287-review.test.mjs ----
// v287's fresh-eyes review: changes kept as the page goes leave the Library row alone until they're in the guide, and
// never a colour only tried in the picker; a new guide saves straight after Build; zooming doesn't paint the plan over
// Edit sections, nor does a visit elsewhere after Reveal; a Temperature with no markers stays as it was; Focus mode
// stamps the start date and hands back its marker's row; very wide pictures keep their shape; the tool row stays
// above the bar on a tiny screen with large text; clearer no-markers words; guide files with no markers refused;
// Blend plan groups and the ink choice for the keyboard and screen readers.
{
  test('every marker dry: Build says so and points to Markers', async () => {
    const { page, errors } = await openApp();
    await welcome(page, 'look');
    await idle(page);
    await page.evaluate(() => {
      COLORS.forEach((c, i) => {
        if (isOwned(i)) state.ink[mkey(i)] = 'dry';
      });
      save();
      SF.setCollection(sfCollection());
    });
    await page.evaluate(() => {
      setMode('sections');
      SF.loadSample();
    });
    await idle(page, 1500);
    assert.match(await page.textContent('#sfMeta'), /Every marker you own is marked dry/);
    assert.deepEqual(errors, []);
  });
}

// ---- from v289.test.mjs ----
// v289: fixes from the fresh-eyes review of v288 — ← Plan › Discard of edits brought back by Resume, a palette held for
// the next guide and a photo that won't open, section edits beyond Undo, Use in a guide › Recolour from Colour along,
// Change colour after an iPad turns, a backup restored over a guide deleted while open, Generate keeping the keyboard,
// Edit sections' tools on a phone's first screen, the guide saved at once on leaving it, focus after Change colour.
{
  test('Discard edits with more section edits than Undo keeps: it says so and stays in Edit sections, nothing lost', async () => {
    const { page, errors } = await openApp();
    await answerAsks(page);
    await sampleGuide(page);
    await saveGuide(page);
    await page.click('#sfBack2');
    await idle(page);
    // 30 merges, more than the 25 steps Undo keeps
    await page.evaluate(() => {
      const t = __mstest;
      for (let i = 0; i < 30; i++) {
        const o = t.assignData.order.filter((l) => t.counted(l) && t.comps[l] && !t.comps[l].merged);
        t.mergeCellsSnap(o[(2 * i) % o.length], o[(2 * i + 1) % o.length]);
      }
      t.render();
    });
    await idle(page);
    await page.evaluate(() => scrollTo(0, 99999));
    await idle(page);
    await page.click('#sfToPlan');
    await page.waitForSelector('#sfEdAsk');
    await page.click('#sfEdAsk [data-a="discard"]');
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.sfmode), 'review', 'stays');
    assert.match(await page.textContent('#sfMeta'), /couldn’t be undone/);
    assert.deepEqual(errors, []);
  });
  test('phone: a new photo’s Edit sections shows its tools above the bar on the first screen', async () => {
    const { page, errors } = await openApp({ width: 390, height: 844 });
    await sampleGuide(page);
    const buf = await readFile(join(ROOT, 'e2e', 'fixtures', 'letter-page.png'));
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.evaluate(() => SF.pickPhoto())]);
    await fc.setFiles({ name: 'p.png', mimeType: 'image/png', buffer: buf });
    await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 60000 });
    await idle(page);
    await page.evaluate(() => scrollTo(0, 0));
    await idle(page);
    const m = await page.evaluate(() => ({
      ed: document.getElementById('sfEdit').getBoundingClientRect().bottom,
      bar: document.querySelector('#sfWork>.sfbar').getBoundingClientRect().top,
    }));
    assert.ok(m.ed <= m.bar, JSON.stringify(m));
    assert.deepEqual(errors, []);
  });
}

// ---- from v296.test.mjs ----
// v296: fixes from the fresh-eyes review of v296 — ← Plan › Discard opening the photo picker, zoomed-in redraws a part
// at a time on the codes' own canvas, ticks after Codes off, the palette's Undo and locks, the scheme line.
{
  test('← Plan › Discard edits goes back to the Plan and opens no photo picker (only Home’s New guide does that)', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
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
    let chooser = false;
    page.on('filechooser', () => {
      chooser = true;
    });
    await page.evaluate(() => scrollTo(0, 99999));
    await idle(page);
    await page.click('#sfToPlan');
    await page.waitForSelector('#sfEdAsk');
    await page.click('#sfEdAsk [data-a="discard"]');
    await page.waitForFunction(() => __mstest.sfmode === 'guide');
    await idle(page, 1500);
    assert.equal(chooser, false, 'no photo picker');
    assert.equal(await page.evaluate((l) => __mstest.counted(l), l), true, 'the edit discarded');
    assert.deepEqual(errors, []);
  });
}

// ---- from v298.test.mjs ----
// v298: fixes from the second fresh-eyes review of v297 — ticks follow merged and split sections; Focus mode says
// where it is up to; zones keep touching sections apart across their borders; a guide file with odd keys opens; the
// sets list follows Clear collection; and Scan's box: the same text again is still cleared, Enter then the same cap
// again is read, letters composed by an Android keyboard wait for Enter, and a card isn't repeated while held.
{
  const ticked = (page, ls) => page.evaluate((ls) => ls.map((l) => __mstest.colored[l]), ls);
  test('building again after merging: a merged section stays ticked only when every part was; a split one keeps its tick in each part', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    // a and b: only a ticked; c and d: both ticked
    const [a, b, c, d] = await page.evaluate(() => {
      const t = __mstest,
        o = t.assignData.order.filter((l) => t.counted(l));
      const ls = [o[3], o[4], o[5], o[6]];
      t.colored[ls[0]] = 1;
      t.colored[ls[2]] = 1;
      t.colored[ls[3]] = 1;
      t.guideDirty = true;
      t.renderGuide();
      return ls;
    });
    await page.click('#sfBack2');
    await idle(page);
    await page.evaluate(
      ([a, b, c, d]) => {
        const t = __mstest;
        t.mergeCellsSnap(a, b);
        t.mergeCellsSnap(c, d);
        t.render();
        t.renderControls();
      },
      [a, b, c, d],
    );
    assert.match(
      await page.textContent('#sfKeepLine'),
      /Merged sections stay ticked only when every part was/,
    );
    await buildGo(page);
    await idle(page);
    assert.deepEqual(
      await ticked(page, [a, b, c, d]),
      [0, 0, 1, 0],
      'a half-coloured merge is to colour; a whole one is done; the merged-away ones count for nothing',
    );
    // a big coloured section cut in two: both parts coloured
    const big = await page.evaluate(() => {
      const t = __mstest;
      let best = 0,
        ba = 0;
      for (const l of t.assignData.order)
        if (t.counted(l) && t.comps[l].area > ba) {
          ba = t.comps[l].area;
          best = l;
        }
      t.colored[best] = 1;
      t.guideDirty = true;
      t.renderGuide();
      return best;
    });
    await page.click('#sfBack2');
    await idle(page);
    const made = await page.evaluate((l) => {
      const t = __mstest,
        c = t.comps[l],
        n0 = t.comps.length,
        y = Math.round(c.cy);
      t.snapshotSeg();
      const m = t.splitAt(l, [
        { x: c.x0 - 3, y },
        { x: c.x1 + 3, y },
      ]);
      t.render();
      const out = [];
      for (let k = n0; k < t.comps.length; k++)
        if (t.comps[k] && !t.comps[k].merged && t.comps[k].area > 0) out.push(k);
      return { m, out };
    }, big);
    assert.ok(made.m >= 1 && made.out.length >= 1, 'cut in two');
    await buildGo(page);
    await idle(page);
    const parts = await ticked(page, [big, ...made.out]);
    assert.ok(
      parts.every((x) => x === 1),
      'each part coloured: ' + parts.join(','),
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
  const ticked = (page, ls) => page.evaluate((ls) => ls.map((l) => __mstest.colored[l]), ls);
  test('Undo of merges after building gives back the ticks the build took off', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    const ls = await page.evaluate(() => {
      const t = __mstest,
        o = t.assignData.order.filter((l) => t.counted(l)),
        ls = [o[3], o[4], o[5], o[6]];
      t.colored[ls[0]] = 1;
      t.colored[ls[2]] = 1;
      t.colored[ls[3]] = 1;
      t.guideDirty = true;
      t.renderGuide();
      return ls;
    });
    await page.click('#sfBack2');
    await idle(page);
    await page.evaluate(([a, b, c, d]) => {
      const t = __mstest;
      t.mergeCellsSnap(a, b);
      t.mergeCellsSnap(c, d);
      t.render();
    }, ls);
    await buildGo(page);
    await idle(page);
    assert.deepEqual(await ticked(page, ls), [0, 0, 1, 0]);
    await page.click('#sfBack2');
    await idle(page);
    await page.evaluate(() => {
      __mstest.doUndoSeg();
      __mstest.doUndoSeg();
    });
    await buildGo(page);
    await idle(page);
    assert.deepEqual(await ticked(page, ls), [1, 0, 1, 1], 'as they were before the merges');
    assert.deepEqual(errors, []);
  });
  test('a part split off a coloured section keeps its marker, its tick and its zone', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    // the biggest section, in a zone of its own, coloured
    await page.click('.sftabbtn[data-t="pattern"]');
    await idle(page);
    await page.click('#sfZoneAdd');
    await idle(page);
    const big = await page.evaluate(() => {
      const t = __mstest;
      let best = 0,
        ba = 0;
      for (const l of t.assignData.order)
        if (t.comps[l].area > ba) {
          ba = t.comps[l].area;
          best = l;
        }
      t.zoneMove([best], t.zoneCur);
      t.reassign([0, t.zoneCur]);
      return best;
    });
    await page.click('#sfZoneDone');
    await idle(page);
    const [mk, z] = await page.evaluate((l) => {
      const t = __mstest;
      t.colored[l] = 1;
      t.guideDirty = true;
      t.renderGuide();
      return [t.assignData.assign[l].mkey, t.zoneOf(l)];
    }, big);
    assert.ok(z > 0);
    await page.click('#sfBack2');
    await idle(page);
    const parts = await page.evaluate((l) => {
      const t = __mstest,
        c = t.comps[l],
        n0 = t.comps.length,
        y = Math.round(c.cy);
      t.snapshotSeg();
      t.splitAt(l, [
        { x: c.x0 - 3, y },
        { x: c.x1 + 3, y },
      ]);
      t.render();
      const out = [];
      for (let k = n0; k < t.comps.length; k++)
        if (t.comps[k] && !t.comps[k].merged && t.comps[k].area > 0) out.push(k);
      return out;
    }, big);
    assert.ok(parts.length >= 1, 'cut in two');
    await buildGo(page);
    await idle(page);
    const r = await page.evaluate(
      (ls) => ls.map((l) => [__mstest.assignData.assign[l].mkey, __mstest.colored[l], __mstest.zoneOf(l)]),
      [big, ...parts],
    );
    for (const x of r) assert.deepEqual(x, [mk, 1, z]);
    assert.deepEqual(errors, []);
  });
}

// ---- from v311-fx.test.mjs ----
// v311: six small items Ben approved. Redo in Edit sections, as the Plan has it.
{
  // ---- 6. Redo in Edit sections ----
  // the sections as they stand: the map, what's in or out, how many to colour
  const secs = (page) =>
    page.evaluate(() => {
      const t = __mstest;
      return { sig: t.labelsSig(), ss: Array.from(t.secState).join(''), n: t.countedList().length };
    });
  const redoOn = (page) =>
    page.evaluate(() => {
      const b = document.getElementById('sfPlanRedo');
      return !!b && getComputedStyle(b).display !== 'none';
    });
  // two counted sections that touch, both big enough to tap
  const twoTouching = (page) =>
    page.evaluate(() => {
      const t = __mstest,
        cl = t.countedList().filter((l) => t.comps[l].area > 400),
        a = t.adj;
      for (const x of cl) for (const y of cl) if (x < y && a[x] && a[x].has(y)) return [x, y];
      return null;
    });
  async function editSections(page) {
    await page.click('#sfBack2');
    await idle(page);
    await scrollTop(page);
  }
  async function tapSec(page, l) {
    const p = await sectionPoint(page, l);
    await page.mouse.click(p.x, p.y);
    await idle(page);
  }
  const ticked = (page, ls) => page.evaluate((ls) => ls.map((l) => __mstest.colored[l]), ls);
  // ---- 7. Escape while renaming a zone ----
  const focusedId = (page) =>
    page.evaluate(() => {
      const a = document.activeElement;
      return !a || a === document.body
        ? 'body'
        : a.id || (a.classList.contains('sfzchip') ? 'chip:' + a.dataset.z : a.tagName);
    });
  // ---- 8. The keyboard after picking a photo ----
  async function pickLetter(page) {
    const buf = await readFile(join(ROOT, 'e2e', 'fixtures', 'letter-page.png'));
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.evaluate(() => SF.pickPhoto())]);
    await fc.setFiles({ name: 'letter-page.png', mimeType: 'image/png', buffer: buf });
    await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 60000 });
    await idle(page);
  }
  // ---- 10. Add a set to an empty collection, on a phone ----
  const KEY = 'ohuhu-hb320-picker-v3';
  const emptyColl = () => ({
    'ms-onboarded': '1',
    'ms-setup-tip': '1',
    'ms-last-ver': 'v310.2',
    'ms-scan-brand': '',
    [KEY]: JSON.stringify({
      mode: 'collection',
      collView: 'owned',
      ownedSeedV: 2,
      copicAdd1: 1,
      libAdj1: 1,
      setFix1: 1,
      owned: [],
      saved: [],
    }),
  });
  test('6 Redo in Edit sections: ↷ beside ↶, Ctrl+Shift+Z and Ctrl+Y take each Undo back exactly; a new edit clears it', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await answerAsks(page);
    await editSections(page);
    assert.equal(await redoOn(page), false, 'nothing to redo yet');
    const s0 = await secs(page);
    // Leave out a section (a tap), then merge two
    const big = await page.evaluate(() => {
      const t = __mstest;
      return t.countedList().sort((a, b) => t.comps[b].area - t.comps[a].area)[0];
    });
    await page.click('#sfEdit [data-m="toggle"]');
    await tapSec(page, big);
    const s1 = await secs(page);
    assert.equal(s1.n, s0.n - 1, 'left out');
    const [a, b] = await twoTouching(page);
    await page.click('#sfEdit [data-m="merge"]');
    await tapSec(page, a);
    await tapSec(page, b);
    const s2 = await secs(page);
    assert.equal(s2.n, s1.n - 1, 'merged');
    await page.click('#sfPlanUndo');
    await idle(page);
    await page.click('#sfPlanUndo');
    await idle(page);
    assert.deepEqual(await secs(page), s0, 'two Undos: as it was');
    assert.equal(await redoOn(page), true, 'Redo shows');
    assert.equal(await page.getAttribute('#sfPlanRedo', 'aria-label'), 'Redo the section edit');
    await page.click('#sfPlanRedo');
    await idle(page);
    assert.deepEqual(await secs(page), s1, 'Redo: left out again');
    assert.equal(
      await page.evaluate(() => document.activeElement && document.activeElement.id),
      'sfPlanRedo',
    );
    await page.keyboard.press('Control+Shift+Z');
    await idle(page);
    assert.deepEqual(await secs(page), s2, 'Ctrl+Shift+Z: merged again');
    assert.equal(await redoOn(page), false, 'nothing left to redo');
    assert.equal(
      await page.evaluate(() => document.activeElement.id),
      'sfPlanUndo',
      'the keyboard on Undo, not the page',
    );
    await page.keyboard.press('Control+z');
    await idle(page);
    assert.deepEqual(await secs(page), s1);
    await page.keyboard.press('Control+y');
    await idle(page);
    assert.deepEqual(await secs(page), s2, 'Ctrl+Y');
    await page.keyboard.press('Control+z');
    await idle(page);
    // a new edit: Redo is gone
    await page.click('#sfEdit [data-m="toggle"]');
    const other = await page.evaluate(
      ([a, b, big]) => {
        const t = __mstest;
        return t
          .countedList()
          .filter((l) => l !== a && l !== b && l !== big)
          .sort((x, y) => t.comps[y].area - t.comps[x].area)[0];
      },
      [a, b, big],
    );
    await tapSec(page, other);
    assert.equal(await redoOn(page), false, 'a new edit clears Redo');
    const s3 = await secs(page);
    await page.keyboard.press('Control+Shift+Z');
    await idle(page);
    assert.deepEqual(await secs(page), s3, 'and Ctrl+Shift+Z does nothing');
    assert.deepEqual(errors, []);
  });
  test('6 Redo in Edit sections: Sensitivity and a turn come back as they were made; a Split that misses keeps Redo', async () => {
    const { page, errors } = await openApp({ width: 1180, height: 820 });
    await sampleGuide(page);
    await answerAsks(page);
    // some colouring, which finding the sections again clears (asked first)
    await page.evaluate(() => {
      const t = __mstest;
      t.assignData.order.slice(0, 4).forEach((l) => (t.colored[l] = 1));
      t.guideDirty = true;
      t.renderGuide();
    });
    await editSections(page);
    await page.click('#sfAdjToggle');
    const det = () =>
      page.evaluate(() => [
        __mstest.adaptC,
        __mstest.labelsSig(),
        document.getElementById('sfSens').value,
        document.getElementById('sfSensVal').textContent,
        Array.from(__mstest.colored).filter(Boolean).length,
      ]);
    const d0 = await det();
    assert.equal(d0[4], 4);
    await page.evaluate(() => {
      const el = document.getElementById('sfSens');
      el.value = 9;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.waitForFunction(() => __mstest.undoCount > 0);
    await idle(page);
    const d1 = await det();
    assert.deepEqual([d1[0], d1[2], d1[4]], [3, '9', 0], 'found again: the colouring cleared');
    await page.click('#sfPlanUndo');
    await idle(page);
    assert.deepEqual(await det(), d0, 'Undo: all back');
    await page.click('#sfPlanRedo');
    await idle(page);
    assert.deepEqual(await det(), d1, 'Redo: Sensitivity 9 and its sections, the colouring cleared again');
    await page.click('#sfPlanUndo');
    await idle(page);
    assert.deepEqual(await det(), d0, 'and Undo once more');
    await page.click('#sfPlanRedo');
    await idle(page);
    // a turn
    await page.click('#sfRotR');
    await idle(page);
    const g = () => page.evaluate(() => [__mstest.rot90, __mstest.W, __mstest.H, __mstest.labelsSig()]);
    const g1 = await g();
    await page.click('#sfPlanUndo');
    await idle(page);
    assert.equal((await g())[0], 0);
    // a Split stroke that divides nothing is no edit: Redo stays
    const r0 = await page.evaluate(() => __mstest.redoCount);
    assert.equal(r0, 1);
    const made = await page.evaluate(() => {
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
        y = Math.round(c.cy);
      return t.splitAt(best, [
        { x, y },
        { x: x + 2, y },
      ]);
    });
    assert.equal(made, 0);
    assert.equal(await page.evaluate(() => __mstest.redoCount), r0, 'a stroke that does nothing leaves Redo');
    await page.keyboard.press('Control+Shift+Z');
    await idle(page);
    assert.deepEqual(await g(), g1, 'Redo: turned again, the same sections');
    assert.equal(await page.evaluate(() => __mstest.adaptC), d1[0], 'Sensitivity kept');
    assert.deepEqual(errors, []);
  });
  test('6 Redo in Edit sections, then Build again: the ticks follow the paper as for the edit itself; Discard and ← Plan end Redo', async () => {
    const { page, errors } = await openApp({ width: 390, height: 844 });
    await sampleGuide(page);
    await answerAsks(page);
    // a and b touch, only a ticked
    const [a, b] = await twoTouching(page);
    await page.evaluate((a) => {
      const t = __mstest;
      t.colored[a] = 1;
      t.guideDirty = true;
      t.renderGuide();
    }, a);
    await editSections(page);
    await page.evaluate(
      ([a, b]) => {
        const t = __mstest;
        t.mergeCellsSnap(a, b);
        t.render();
        t.renderControls();
      },
      [a, b],
    );
    await buildGo(page);
    await idle(page);
    assert.deepEqual(await ticked(page, [a, b]), [0, 0], 'a half-ticked merge is to colour');
    const built = await page.evaluate(() => ({
      order: __mstest.assignData.order.join(),
      col: Array.from(__mstest.colored).join(''),
    }));
    // back past the build: Undo takes the merge apart and gives a its tick back; Redo merges again and takes it off
    await editSections(page);
    await page.click('#sfPlanUndo');
    await idle(page);
    assert.deepEqual(await ticked(page, [a, b]), [1, 0], 'Undo: a ticked again');
    await page.click('#sfPlanRedo');
    await idle(page);
    assert.deepEqual(await ticked(page, [a, b]), [0, 0], 'Redo: as after the merge');
    await buildGo(page);
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.sfmode), 'guide');
    assert.deepEqual(
      await page.evaluate(() => ({
        order: __mstest.assignData.order.join(),
        col: Array.from(__mstest.colored).join(''),
      })),
      built,
      'built as before',
    );
    assert.equal(await redoOn(page), false, 'no Redo in the Plan for section edits');
    // Discard edits after Undo and Redo: the guide as built, and nothing to redo
    const s0 = await (async () => {
      await editSections(page);
      return secs(page);
    })();
    const big = await page.evaluate(() => {
      const t = __mstest;
      return t.countedList().sort((x, y) => t.comps[y].area - t.comps[x].area)[0];
    });
    await page.click('#sfEdit [data-m="toggle"]');
    await tapSec(page, big);
    await page.click('#sfPlanUndo');
    await idle(page);
    await page.click('#sfPlanRedo');
    await idle(page);
    assert.equal((await secs(page)).n, s0.n - 1);
    await page.click('#sfToPlan');
    await page.click('[data-a="discard"]');
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.sfmode), 'guide');
    await editSections(page);
    assert.deepEqual(await secs(page), s0, 'discarded');
    assert.equal(await redoOn(page), false, 'and nothing to redo after Discard');
    // ← Plan with nothing left to build (the edit undone): Redo goes with the step
    await tapSec(page, big);
    await page.click('#sfPlanUndo');
    await idle(page);
    assert.equal(await redoOn(page), true);
    await page.click('#sfToPlan');
    await idle(page);
    await editSections(page);
    assert.equal(await redoOn(page), false, 'not after leaving the step');
    assert.deepEqual(errors, []);
  });
  test('7 Escape in a zone’s name field puts the name back and keeps the keyboard there; a second closes the editor, to the chip', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await page.click('.sftabbtn[data-t="pattern"]');
    await idle(page);
    await page.focus('#sfZoneAdd');
    await page.keyboard.press('Enter');
    await idle(page);
    assert.equal(await focusedId(page), 'sfZoneName');
    // a section in it, so the zone is kept
    const l = await page.evaluate(
      () =>
        Object.keys(__mstest.assignData.assign)
          .map(Number)
          .sort((a, b) => __mstest.comps[b].area - __mstest.comps[a].area)[0],
    );
    await scrollTop(page);
    const p = await sectionPoint(page, l);
    await page.mouse.click(p.x, p.y);
    await idle(page);
    const z = await page.evaluate(() => __mstest.zoneCur);
    await page.focus('#sfZoneName');
    await page.keyboard.press('Control+a');
    await page.keyboard.type('Nope');
    await page.keyboard.press('Escape');
    await idle(page);
    assert.equal(await page.inputValue('#sfZoneName'), 'Zone 1', 'the name back');
    assert.equal(await page.evaluate(() => __mstest.zones[0].name), 'Zone 1');
    assert.ok(await page.isVisible('#sfZoneDone'), 'the editor stays open');
    assert.equal(await focusedId(page), 'sfZoneName', 'the keyboard still in the field');
    assert.deepEqual(
      await page.evaluate(() => {
        const i = document.getElementById('sfZoneName');
        return [i.selectionStart, i.selectionEnd];
      }),
      [0, 6],
      'its text chosen, to type over',
    );
    assert.equal(await page.evaluate(() => __mstest.sfmode), 'guide', 'still in the Plan');
    // typing again: Escape puts the name back again first
    await page.keyboard.type('Bell');
    await page.keyboard.press('Escape');
    await idle(page);
    assert.equal(await page.inputValue('#sfZoneName'), 'Zone 1');
    assert.ok(await page.isVisible('#sfZoneDone'));
    // a rename kept with Enter
    await page.keyboard.type('Bell');
    await page.keyboard.press('Enter');
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.zones[0].name), 'Bell');
    // a second Escape in a row: the editor closes, the keyboard on the zone's chip
    await page.focus('#sfZoneName');
    await page.keyboard.press('Escape');
    await idle(page);
    assert.ok(await page.isVisible('#sfZoneDone'), 'one Escape: still open');
    await page.keyboard.press('Escape');
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.zoneEdit), false, 'two: closed');
    assert.equal(await focusedId(page), 'chip:' + z);
    assert.equal(await page.evaluate(() => __mstest.zones[0].name), 'Bell', 'the name kept');
    assert.deepEqual(errors, []);
  });
  test('8 a picture’s sections found: the step’s heading gets the keyboard, and the full step is said once, as the quick check is', async () => {
    for (const tools of ['0', '1']) {
      const { page, errors, ctx } = await openApp({
        width: 390,
        height: 844,
        storage: { 'ms-sec-tools': tools },
      });
      await welcome(page, 'look');
      await idle(page);
      await page.evaluate(() => document.activeElement && document.activeElement.blur());
      await pickLetter(page);
      const n = await page.textContent('#sfCount');
      assert.equal(
        await focusedId(page),
        tools === '0' ? 'sfQuickHead' : 'sfSecHead',
        'the heading has the keyboard',
      );
      assert.equal(await page.evaluate(() => scrollY), 0, 'not scrolled to it');
      assert.equal(
        await page.textContent('#sfLive'),
        tools === '0'
          ? 'Looks right? We found ' + n + ' to colour. Build guide, or Edit sections.'
          : 'Edit sections. We found ' + n + ' to colour. Build guide when they look right.',
      );
      // once: Min section size moved, the keyboard stays on it and nothing more is said
      if (tools === '1') {
        await page.focus('#sfMin');
        await page.evaluate(() => {
          const el = document.getElementById('sfMin');
          el.value = 60;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        });
        await idle(page);
        assert.equal(await focusedId(page), 'sfMin');
        assert.match(await page.textContent('#sfLive'), /^Edit sections\./);
      }
      assert.deepEqual(errors, []);
      await ctx.close();
    }
  });
  test('8 the keyboard moved somewhere by the person stays there when the sections are found', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await welcome(page, 'look');
    await idle(page);
    await page.focus('#mCollection');
    await pickLetter(page);
    assert.equal(await focusedId(page), 'mCollection');
    assert.match(
      await page.textContent('#sfLive'),
      /^Edit sections\. We found \d+ sections to colour\./,
      'still said',
    );
    // a built guide's ← Edit sections isn't a new picture: nothing said or moved
    await page.click('#sfBuild');
    await page.waitForFunction(() => __mstest.assignData && __mstest.sfmode === 'guide');
    await idle(page);
    await page.evaluate(() => {
      document.getElementById('sfLive').textContent = '';
    });
    await page.click('#sfBack2');
    await idle(page);
    assert.equal(await page.textContent('#sfLive'), '');
    assert.deepEqual(errors, []);
  });
  // ---- 9. Focus mode's Mark all of this colour done: its Undo as the list's ----
  test('9 Focus mode’s Mark all … done, undone, puts back the kept shading as the list’s Undo does', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await idle(page);
    await page.click('.sftabbtn[data-t="shading"]');
    await page.evaluate(() => __mstest.shadeTo('full'));
    await idle(page);
    await page.click('#sfColor');
    await idle(page);
    await scrollTop(page);
    const { k, secs } = await page.evaluate(() => {
      const t = __mstest,
        n = {},
        g = t.shadeGeom();
      t.assignData.order.forEach((l) => {
        if (!t.shadeable(l, g)) return;
        const k = t.assignData.assign[l].mkey;
        (n[k] = n[k] || []).push(l);
      });
      const k = Object.keys(n).sort((a, b) => n[b].length - n[a].length)[0];
      return { k, secs: n[k] };
    });
    const b = secs[1];
    // b part-done (a tone, not its shadow): its shading kept, the shadow still following the setting
    await page.evaluate((b) => {
      __mstest.stepSet(b, 1, true);
      __mstest.renderGuide();
    }, b);
    const held = () => page.evaluate((b) => JSON.stringify(__mstest.heldSh[b] || null), b);
    // the Shadows setting changed since (in the Plan): b's shadow follows it
    await page.click('#sfDoneBtn');
    await idle(page);
    await page.click('.sftabbtn[data-t="shading"]');
    await page.selectOption('#sfShStyle', 'cool');
    await idle(page);
    await page.click('#sfColor');
    await idle(page);
    const h0 = await held();
    assert.match(h0, /"free":true/);
    await page.click('#sfFocus');
    await idle(page);
    await page.click('#sfFocCols');
    await page.click(`#sfFocMk .focmk[data-k="${k}"]`);
    await idle(page);
    await page.click('#sfFocCols');
    await page.click('#sfFocAll');
    await idle(page);
    assert.ok((await page.evaluate((s) => s.map((l) => __mstest.colored[l]), secs)).every(Boolean));
    assert.notEqual(await held(), h0, 'ticked: its shadow is on the paper');
    await page.click('#toastAct');
    await idle(page);
    assert.equal(await held(), h0, 'Undo: the shading kept as it was');
    assert.equal(await page.evaluate((b) => __mstest.tonePart[b], b), 1);
    assert.deepEqual(errors, []);
  });
  test('10 the first set added to an empty collection: the top of the collection in view, not the middle of the grid', async () => {
    for (const [w, h] of [
      [390, 844],
      [820, 1180],
      [1180, 820],
    ]) {
      const { page, errors, ctx } = await openApp({ width: w, height: h, storage: emptyColl() });
      await idle(page);
      // (v311: from the card of ways to add at the top, into Add markers' sets list)
      assert.equal(await page.isVisible('#mkAddCard'), true, 'the ways to add at the top');
      await page.click('#mkcSet');
      await idle(page);
      await page.check('#wcSets input[data-i="3"]');
      await page.focus('#wcAdd');
      await page.keyboard.press('Enter');
      await idle(page);
      const at = await page.evaluate(() => {
        const r = (id) => document.getElementById(id).getBoundingClientRect();
        return {
          y: scrollY,
          grid: Math.round(r('results').top),
          sets: document.getElementById('presetWrap').classList.contains('bottom'),
        };
      });
      assert.ok(at.sets, 'Brands I’d buy went below the grid');
      assert.equal(await page.isVisible('#mkAddCard'), false);
      assert.equal(at.y, 0, w + ': the top of the collection');
      // (a row of markers at least on the first screen; v318 review's Swatch chart link, no longer under Add markers'
      // bottom 12px, put the grid that much lower on a phone: 685 of 844)
      assert.ok(at.grid > 0 && at.grid < h - 120, w + ': the first markers in view: ' + at.grid);
      assert.match(await page.textContent('#msToast'), /^Added 120 markers/);
      assert.equal(await focusedId(page), 'mkAddBtn', 'the keyboard on Add markers');
      // Undo: an empty collection again, the sets back at the top
      await page.click('#toastAct');
      await idle(page);
      assert.equal(await page.evaluate(() => state.owned.size), 0);
      assert.deepEqual(errors, []);
      await ctx.close();
    }
  });
}

// ---- from v318-review-ux.test.mjs ----
// v318 review (UI/UX pass), and its audit: Escape leaves the photo's editors in Check the sections (Adjust corners,
// Crop) as their Cancel does, only while the Guide screen shows; the browser's Back in the first-run welcome goes back
// a step; Colour along's tap on another marker's section is said, with Undo; Tester tasks' Send results with nothing
// answered sends nothing; on a phone, a PDF that won't open is said in view. Each fails on v318 as released.
{
  const shown = (page, id) =>
    page.evaluate((id) => {
      const e = document.getElementById(id);
      return !!e && e.getClientRects().length > 0;
    }, id);
  test('Escape leaves Crop (as Cancel) and then Adjust corners (as Cancel)', async () => {
    const { page, errors } = await openApp({
      width: 820,
      height: 1180,
      storage: { 'ms-onboarded': '1', 'ms-setup-tip': '1' },
    });
    await page.click('#mSections');
    await idle(page);
    const buf = await readFile(join(ROOT, 'e2e', 'fixtures', 'letter-page.png'));
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#sfPick')]);
    await fc.setFiles({ name: 'letter-page.png', mimeType: 'image/png', buffer: buf });
    await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 60000 });
    await idle(page);
    // Crop, then Escape: back to Check the sections with nothing cropped
    await page.click('#sfAdjToggle');
    await idle(page);
    await page.click('#sfCrop');
    await idle(page);
    assert.ok(await shown(page, 'sfCropApply'), 'the crop editor is open');
    const size = await page.evaluate(() => [__mstest.W, __mstest.H]);
    await page.keyboard.press('Escape');
    await idle(page);
    assert.ok(!(await shown(page, 'sfCropApply')), 'Escape closed the crop editor');
    assert.ok(await shown(page, 'sfBuild'), 'Check the sections is back');
    assert.deepEqual(await page.evaluate(() => [__mstest.W, __mstest.H]), size, 'nothing cropped');
    // Adjust corners (the scan has no corners of its own: the editor opens on starting corners), then Escape
    if (
      !(await shown(page, 'sfAdjToggle')) ||
      (await page.getAttribute('#sfAdjToggle', 'aria-expanded')) !== 'true'
    ) {
      await page.click('#sfAdjToggle');
      await idle(page);
    }
    const adj = await page.evaluate(() => {
      const b = [...document.querySelectorAll('#sfCtl button')].find(
        (x) => x.offsetParent && /Adjust corners|Straighten page/.test(x.textContent),
      );
      if (b) {
        b.click();
        return b.textContent.trim();
      }
      return null;
    });
    assert.ok(adj, 'a way into the corners');
    await idle(page);
    assert.ok(await shown(page, 'sfPgGo'), 'the corners editor is open');
    assert.equal(await page.textContent('#sfPgNo'), 'Cancel', 'as an adjustment, not the first corners');
    const was = await page.evaluate(() => [__mstest.W, __mstest.H]);
    await page.keyboard.press('Escape');
    await idle(page);
    assert.ok(!(await shown(page, 'sfPgGo')), 'Escape closed the corners editor');
    assert.ok(await shown(page, 'sfBuild'), 'Check the sections is back');
    assert.deepEqual(await page.evaluate(() => [__mstest.W, __mstest.H]), was, 'the picture as it was');
    assert.deepEqual(errors, []);
  });
  // (v318 audit) Crop left open on the Guide screen, then Markers: an Escape there is Markers' own (it closes its ⋯ menu),
  // not a crop cancelled out of sight. Fails on the review branch before the audit
  test('Crop left open, then Markers: Escape closes Markers’ ⋯ menu, and the crop is still open back on the Guide screen', async () => {
    const { page, errors } = await openApp({
      width: 1180,
      height: 820,
      storage: { 'ms-onboarded': '1', 'ms-setup-tip': '1' },
    });
    await page.click('#mSections');
    await idle(page);
    const buf = await readFile(join(ROOT, 'e2e', 'fixtures', 'letter-page.png'));
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#sfPick')]);
    await fc.setFiles({ name: 'letter-page.png', mimeType: 'image/png', buffer: buf });
    await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 60000 });
    await idle(page);
    await page.click('#sfAdjToggle');
    await idle(page);
    await page.click('#sfCrop');
    await idle(page);
    assert.ok(await shown(page, 'sfCropApply'), 'the crop editor is open');
    await page.click('#mCollection');
    await idle(page);
    await page.click('#mkMore');
    await idle(page);
    const menu = () => page.evaluate(() => !document.getElementById('mkMenu').hidden);
    assert.ok(await menu(), 'Markers’ ⋯ menu is open');
    await page.keyboard.press('Escape');
    await idle(page);
    assert.ok(!(await menu()), 'Escape closed the menu');
    await page.click('#mSections');
    await idle(page);
    assert.ok(await shown(page, 'sfCropApply'), 'the crop is as it was left');
    assert.deepEqual(errors, []);
  });
}

// ---- from v31825-x3.test.mjs ----
// v318.25 in the browser.
{
  // ---------------------------------------------------------------------------------------------------------------------
  // X3: making a guide (Undo through a turn while sections are found again; a PDF drawn in grey lines), Focus mode's
  // hand-off card on a small phone, finishing a page again, the PDF's name, What's new and the tester card in two tabs
  // ---------------------------------------------------------------------------------------------------------------------

  // a 1800 x 2400 photo of rings (some faint) with grain, as a JPEG
  async function ringPhoto(page) {
    const b64 = await page.evaluate(async () => {
      const c = document.createElement('canvas');
      c.width = 1800;
      c.height = 2400;
      const g = c.getContext('2d');
      g.fillStyle = '#f4f1ea';
      g.fillRect(0, 0, 1800, 2400);
      let k = 0;
      for (let y = 200; y < 2400; y += 300)
        for (let x = 200; x < 1800; x += 300) {
          g.strokeStyle = k % 3 === 0 ? '#b8b4ac' : '#1a1a1a';
          g.lineWidth = k % 2 ? 3 : 6;
          g.beginPath();
          g.arc(x, y, 120, 0, 6.283);
          g.stroke();
          g.beginPath();
          g.moveTo(x - 120, y);
          g.lineTo(x + 120, y);
          g.stroke();
          k++;
        }
      const im = g.getImageData(0, 0, 1800, 2400),
        d = im.data;
      let s = 7;
      for (let i = 0; i < d.length; i += 4) {
        s = (s * 16807) % 2147483647;
        const n = (s / 2147483647 - 0.5) * 30;
        d[i] += n;
        d[i + 1] += n;
        d[i + 2] += n;
      }
      g.putImageData(im, 0, 0);
      const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.92));
      return await new Promise((r) => {
        const f = new FileReader();
        f.onload = () => r(f.result.split(',')[1]);
        f.readAsDataURL(blob);
      });
    });
    return { name: 'page.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(b64, 'base64') };
  }
  const free = (page) =>
    page.waitForFunction(
      () =>
        !__mstest.segBusy &&
        !/Detecting|Reading/.test((document.getElementById('sfStat') || {}).textContent || ''),
      null,
      { timeout: 40000 },
    );
  const secState = (page) =>
    page.evaluate(() => ({
      sig: __mstest.labelsSig(),
      c: __mstest.adaptC,
      sens: document.getElementById('sfSens').value,
      rot: __mstest.rot90,
    }));
  // the Sensitivity slider moved, as a drag does
  const sens = (page, v) =>
    page.evaluate((v) => {
      const s = document.getElementById('sfSens');
      s.value = String(v);
      s.dispatchEvent(new Event('input', { bubbles: true }));
    }, v);
  // (straighten.test.mjs's made-up phone photo of a page on a table)
  const GEN = GEN_STRAIGHTEN;
  test('X3 D1: turned while a new Sensitivity’s sections are found: one Undo, back to the sections and Sensitivity before both', async () => {
    const { page, errors } = await openApp({ width: 1180, height: 820 });
    await sampleGuide(page);
    await page.setInputFiles('#sfFile', await ringPhoto(page));
    await page.waitForFunction(() => __mstest.W === 1800 && !__mstest.segBusy, null, { timeout: 40000 });
    await free(page);
    await page.click('#sfAdjToggle');
    await idle(page);
    const r0 = await secState(page);
    await sens(page, 9);
    // (the turn before those sections are in place: the slider's change waits a moment for the next)
    await page.waitForFunction(() => __mstest.segBusy, null, { polling: 10 });
    await page.evaluate(() => document.getElementById('sfRotR').click());
    await free(page);
    await idle(page);
    assert.equal((await secState(page)).rot, 90);
    await page.evaluate(() => __mstest.doUndoSeg());
    await free(page);
    await idle(page);
    // (it had brought back the old sections with Sensitivity 9's setting, then a second Undo changed only the slider)
    assert.deepEqual(await secState(page), r0, 'the sections, setting and slider as they were before both');
    assert.equal(await page.evaluate(() => __mstest.undoCount), 0, 'no Undo step left that changes nothing');
    assert.deepEqual(errors, []);
  });
  test('X3 D1: Adjust corners while a new Sensitivity’s sections are found, then Cancel: Undo still goes back from them', async () => {
    const { page, errors } = await openApp({ width: 1180, height: 820 });
    await sampleGuide(page);
    const ph = await page.evaluate(
      async ([src, o]) => (eval(src), makePhoto(o)),
      [GEN, { tilt: 25, roll: 8, size: 0.6 }],
    );
    await page.setInputFiles('#sfFile', {
      name: 'page.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from(ph.b64, 'base64'),
    });
    await page.waitForSelector('#sfPgAdj', { state: 'attached', timeout: 40000 });
    await free(page);
    await page.click('#sfAdjToggle');
    await idle(page);
    const r0 = await secState(page);
    await sens(page, 9);
    await page.waitForFunction(() => __mstest.segBusy, null, { polling: 10 });
    await page.evaluate(() => document.getElementById('sfPgAdj').click());
    await page.waitForSelector('#sfPgNo', { state: 'visible' });
    await page.click('#sfPgNo');
    await free(page);
    await idle(page);
    assert.equal((await secState(page)).sens, '9');
    await page.evaluate(() => __mstest.doUndoSeg());
    await free(page);
    await idle(page);
    assert.deepEqual(await secState(page), r0);
    assert.deepEqual(errors, []);
  });
}
