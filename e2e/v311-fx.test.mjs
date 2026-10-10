// v311: six small items Ben approved. Redo in Edit sections, as the Plan has it.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  setup,
  teardown,
  openApp,
  sampleGuide,
  idle,
  scrollTop,
  sectionPoint,
  answerAsks,
  buildGo,
  welcome,
  ROOT,
} from './helpers.mjs';

before(setup);
after(teardown);

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
  assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.id), 'sfPlanRedo');
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

const ticked = (page, ls) => page.evaluate((ls) => ls.map((l) => __mstest.colored[l]), ls);

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

// ---- 7. Escape while renaming a zone ----
const focusedId = (page) =>
  page.evaluate(() => {
    const a = document.activeElement;
    return !a || a === document.body
      ? 'body'
      : a.id || (a.classList.contains('sfzchip') ? 'chip:' + a.dataset.z : a.tagName);
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

// ---- 8. The keyboard after picking a photo ----
async function pickLetter(page) {
  const buf = await readFile(join(ROOT, 'e2e', 'fixtures', 'letter-page.png'));
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.evaluate(() => SF.pickPhoto())]);
  await fc.setFiles({ name: 'letter-page.png', mimeType: 'image/png', buffer: buf });
  await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 60000 });
  await idle(page);
}

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
        ? 'Looks right? We found ' + n + ' to colour. Build guide, or Fix sections.'
        : 'Check the sections. We found ' + n + ' to colour. Build guide when they look right.',
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
      assert.match(await page.textContent('#sfLive'), /^Check the sections\./);
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
    /^Check the sections\. We found \d+ sections to colour\./,
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
  await page.click('#sfShade [data-v="full"]');
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
    assert.ok(at.grid > 0 && at.grid < h * 0.8, w + ': the first markers in view: ' + at.grid);
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
