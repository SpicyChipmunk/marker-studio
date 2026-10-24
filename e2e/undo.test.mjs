// Undo.
// (v320) Tests organised by feature: each block below came from the file named above it, its tests unchanged.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  WK,
  answerAsks,
  buildGo,
  idle,
  libItem,
  menuItem,
  notOnWebKit,
  openApp,
  pause,
  sampleGuide,
  saveGuide,
  scanFromMarkers,
  scrollTop,
  sectionPoint,
  setup,
  teardown,
  toolStatus,
  welcome,
} from './helpers.mjs';

before(setup);
after(teardown);

// ---- from undo.test.mjs ----
// Undo everywhere it matters. In the guide editor every change to the plan (Shuffle, Surprise, pattern, marker
// count, pins, section colours...) can be undone: with the ↶ Undo button under the picture (which says what it takes
// back; no toast covers the picture, except ✨ Surprise's, which says what it chose), or Ctrl/Cmd+Z. Shell actions that throw work away (own/un-own all shown, clear collection, Library delete, Reset
// progress) offer Undo in a toast too.
{
  const assignMap = (page) =>
    page.evaluate(() => {
      const a = __mstest.assignData.assign,
        o = {};
      for (const k in a) o[k] = a[k].mkey;
      return o;
    });
  const style = (page) => page.evaluate(() => __mstest.currentDesignObj().payload.style);
  const plan = (page) => page.evaluate(() => __mstest.planCount);
  const undoShown = (page) => page.isVisible('#sfPlanUndo');
  // compare the canvas with a from-scratch redraw of the same state
  const vsFull = (page) =>
    page.evaluate(() => {
      const c = document.getElementById('sfCanvas'),
        g = c.getContext('2d');
      __mstest.renderGuide();
      const a = g.getImageData(0, 0, c.width, c.height).data.slice();
      __mstest.forceFullRender();
      __mstest.renderGuide();
      const b = g.getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++;
      return n;
    });
  const bigSections = (page, n = 6) =>
    page.evaluate((n) => {
      const t = __mstest,
        c = document.getElementById('sfCanvas'),
        r = c.getBoundingClientRect(),
        z = document.getElementById('sfZoomCtl').getBoundingClientRect();
      return t.assignData.order
        .filter((l) => {
          const q = t.labelPos(l),
            y = r.top + (q.y / c.height) * r.height,
            x = r.left + (q.x / c.width) * r.width;
          return (
            y > r.top + 12 &&
            y < (z.top > r.top + 20 ? Math.min(r.bottom, z.top) : r.bottom) - 12 &&
            x > r.left + 12 &&
            x < r.right - 12
          );
        })
        .sort((a, b) => t.comps[b].area - t.comps[a].area)
        .slice(0, n);
    }, n);
  async function tap(page, l) {
    await scrollTop(page);
    const p = await sectionPoint(page, l);
    await page.mouse.click(p.x, p.y);
    await idle(page);
  }
  const tab = (page, t) => page.click(`.sftabbtn[data-t="${t}"]`);
  const toastText = (page) => page.textContent('#msToast');
  const toastOn = (page) =>
    page.evaluate(() => {
      const t = document.getElementById('msToast');
      return !!(t && t.classList.contains('on'));
    });
  const libOpen = (page) => page.evaluate(() => savedOverlay.classList.contains('on'));
  async function openLibrary(page) {
    await page.click('#mHome');
    await page.click('#homeLibCard');
    await idle(page);
    assert.ok(await libOpen(page));
  }
  const row = (id) => `#savedList .srow[data-id="${id}"]`;
  const hasPayload = (page, id) => page.evaluate((id) => IDB.get('guide-' + id).then((p) => !!p), id);
  // ---- From v267 ----
  const toastOnText = (page) =>
    page.evaluate(() => {
      const t = document.getElementById('msToast');
      return t && t.classList.contains('on') ? t.textContent : '';
    });
  const undoLabel = (page) => page.getAttribute('#sfPlanUndo', 'aria-label');
  const live = (page) =>
    page
      .waitForFunction(() => document.getElementById('sfLive').textContent)
      .then(() => page.textContent('#sfLive'));
  test('Shuffle, then Undo: every section gets its marker back and the picture is redrawn exactly', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    assert.equal(await undoShown(page), false, 'nothing to undo yet');
    const before = await assignMap(page),
      st = await style(page);
    await tab(page, 'pattern');
    await page.click('#sfVary');
    await idle(page);
    assert.notDeepEqual(await assignMap(page), before, 'Shuffle changed the colours');
    assert.equal(await plan(page), 1);
    assert.equal(await toastOn(page), false, 'no toast: ↶ Undo is right there');
    assert.ok(await undoShown(page), 'the Undo button shows under the picture');
    assert.match(await page.getAttribute('#sfPlanUndo', 'aria-label'), /Undo: Colours shuffled/);
    await page.click('#sfPlanUndo');
    await idle(page);
    assert.deepEqual(await assignMap(page), before, 'every section is back to its marker');
    assert.deepEqual(await style(page), st);
    assert.equal(await vsFull(page), 0, 'the canvas matches a full redraw');
    assert.equal(await plan(page), 0);
    assert.equal(await undoShown(page), false);
    assert.deepEqual(errors, []);
  });
  test('Surprise, then Undo in its toast: style and colours come back', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    const before = await assignMap(page),
      st = await style(page);
    await page.click('#sfSurprise');
    await idle(page);
    assert.notDeepEqual(await style(page), st);
    assert.match(await toastText(page), /Surprise/);
    await page.click('#toastAct');
    await idle(page);
    assert.deepEqual(await style(page), st);
    assert.deepEqual(await assignMap(page), before);
    assert.equal(await vsFull(page), 0);
    assert.deepEqual(errors, []);
  });
  test('a pattern change is one step', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    const before = await assignMap(page);
    await tab(page, 'pattern');
    await page.click('#sfFam [data-v="random"]');
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.family), 'random');
    assert.equal(await page.evaluate(() => __mstest.planLabel), 'Pattern: Random');
    assert.equal(await toastOn(page), false);
    await scrollTop(page);
    await page.click('#sfPlanUndo');
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.family), 'gradient');
    assert.deepEqual(await assignMap(page), before);
    assert.equal(
      await page.getAttribute('#sfFam [data-v="gradient"]', 'class'),
      'sfedit on',
      'the controls show the restored pattern',
    );
    assert.deepEqual(errors, []);
  });
  test('dragging the marker count is a single Undo step', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    const before = await assignMap(page),
      n0 = await page.evaluate(() => __mstest.limitN);
    const sl = page.locator('#sfMkCount');
    await sl.scrollIntoViewIfNeeded();
    const b = await sl.boundingBox(),
      mn = +(await sl.getAttribute('min')),
      mx = +(await sl.getAttribute('max')),
      v = +(await sl.inputValue());
    const x0 = b.x + 8 + ((v - mn) / (mx - mn)) * (b.width - 16),
      y = b.y + b.height / 2;
    await page.mouse.move(x0, y);
    await page.mouse.down();
    for (let i = 1; i <= 6; i++) {
      await page.mouse.move(x0 - i * (b.width / 14), y);
      await idle(page);
    }
    await page.mouse.up();
    await idle(page);
    const n1 = await page.evaluate(() => __mstest.limitN);
    assert.ok(n1 < n0, `fewer markers (${n0} -> ${n1})`);
    assert.equal(await plan(page), 1, 'one step for the whole drag');
    assert.match(await page.evaluate(() => __mstest.planLabel), /^Markers: \d+$/);
    await scrollTop(page);
    await page.click('#sfPlanUndo');
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.limitN), n0);
    assert.deepEqual(await assignMap(page), before);
    assert.equal(+(await page.inputValue('#sfMkCount')), Math.min(n0, mx));
    assert.equal(await plan(page), 0);
    assert.deepEqual(errors, []);
  });
  test('Change colour and Pin from the section tip can be undone', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    const [l] = await bigSections(page, 1),
      before = await assignMap(page);
    await tap(page, l);
    await page.click('.sftip [data-a="pin"]');
    await idle(page);
    assert.equal(await page.evaluate((l) => __mstest.locks[l], l), before[l]);
    assert.equal(await page.evaluate(() => __mstest.planLabel), 'Section pinned');
    // change its colour in the picker
    await tap(page, l);
    await page.click('.sftip [data-a="change"]');
    await idle(page);
    const k = await page.evaluate((not) => {
      const b = [...document.querySelectorAll('#sfPopSw .sfswg:not(.sfswrec) .sfsw')];
      return b.find((x) => x.dataset.k !== not).dataset.k;
    }, before[l]);
    await page.click(`#sfPopSw .sfswg:not(.sfswrec) .sfsw[data-k="${k}"]`);
    await idle(page);
    assert.equal(await plan(page), 1, 'a preview in the open picker is not a step yet');
    await page.click('#sfPopConfirm');
    await idle(page);
    assert.equal((await assignMap(page))[l], k);
    assert.equal(await plan(page), 2);
    assert.equal(await page.evaluate(() => __mstest.planLabel), 'Section colour changed');
    await scrollTop(page);
    await page.click('#sfPlanUndo');
    await idle(page);
    assert.equal((await assignMap(page))[l], before[l], 'colour back');
    assert.equal(
      await page.evaluate((l) => __mstest.locks[l], l),
      before[l],
      'still pinned (that was the step before)',
    );
    await page.click('#sfPlanUndo');
    await idle(page);
    assert.equal(await page.evaluate((l) => __mstest.locks[l] ?? null, l), null, 'unpinned');
    assert.deepEqual(await assignMap(page), before);
    assert.equal(await vsFull(page), 0);
    assert.deepEqual(errors, []);
  });
  test('several changes undo one at a time, newest first; Ctrl+Z works but not while typing a name', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    const s0 = await style(page),
      a0 = await assignMap(page);
    await tab(page, 'pattern');
    await page.click('#sfShape [data-v="radial"]');
    await idle(page);
    const s1 = await style(page),
      a1 = await assignMap(page);
    await page.click('#sfDir [data-d="-1"]');
    await idle(page);
    const s2 = await style(page),
      a2 = await assignMap(page);
    await tab(page, 'colours');
    await page.click('#sfMood [data-v="vivid"]');
    await idle(page);
    assert.equal(await plan(page), 3);
    assert.equal(await page.evaluate(() => __mstest.planLabel), 'Mood: Bright');
    // typing in the name field: Ctrl+Z is the text box's own
    await page.click('#sfRename');
    await page.click('#sfGName');
    await page.keyboard.press('Control+z');
    await idle(page);
    assert.equal(await plan(page), 3, 'not while typing');
    await page.evaluate(() => document.activeElement.blur());
    await page.keyboard.press('Control+z');
    await idle(page);
    assert.deepEqual([await style(page), await assignMap(page)], [s2, a2]);
    assert.equal(await page.evaluate(() => __mstest.planLabel), 'Direction: Reversed');
    await page.keyboard.press('Meta+z');
    await idle(page);
    assert.deepEqual([await style(page), await assignMap(page)], [s1, a1]);
    await scrollTop(page);
    await page.click('#sfPlanUndo');
    await idle(page);
    assert.deepEqual([await style(page), await assignMap(page)], [s0, a0]);
    assert.equal(await plan(page), 0);
    await page.keyboard.press('Control+z');
    await idle(page);
    assert.deepEqual(await assignMap(page), a0, 'nothing more to undo');
    assert.deepEqual(errors, []);
  });
  test('the Undo steps are cleared when another guide or picture opens', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await saveGuide(page);
    await idle(page);
    const id = await page.evaluate(() => state.saved.find((s) => s.type === 'guide').id);
    await tab(page, 'pattern');
    await page.click('#sfVary');
    await idle(page);
    assert.equal(await plan(page), 1);
    // the sample again (a new picture)
    await scrollTop(page);
    await menuItem(page, 'Try the sample');
    await page.waitForFunction(() => __mstest.assignData && __mstest.curId == null);
    await idle(page);
    assert.equal(await plan(page), 0, 'a new picture starts with nothing to undo');
    assert.equal(await undoShown(page), false);
    await tab(page, 'pattern');
    await page.click('#sfVary');
    await idle(page);
    assert.equal(await plan(page), 1);
    // a saved guide from the Library
    await openLibrary(page);
    await page.click(row(id) + ' .sname');
    await page.waitForFunction((id) => __mstest.curId === id && __mstest.assignData, id);
    await idle(page);
    assert.equal(await plan(page), 0, 'an opened guide starts with nothing to undo');
    assert.equal(await undoShown(page), false);
    assert.deepEqual(errors, []);
  });
  test('Own all shown and Un-own all shown can be undone', async () => {
    const { page, errors } = await openApp();
    await welcome(page, 'look');
    await page.click('#mCollection');
    await idle(page);
    const own0 = await page.evaluate(() => [...state.owned].sort());
    await page.click('#ownView [data-v="unowned"]');
    await idle(page);
    await page.click('#ownAll');
    await idle(page);
    const n1 = await page.evaluate(() => state.owned.size);
    assert.ok(n1 > own0.length);
    assert.match(await toastText(page), new RegExp(`Added ${n1 - own0.length} markers to your collection`));
    await page.click('#toastAct');
    await idle(page);
    assert.deepEqual(await page.evaluate(() => [...state.owned].sort()), own0);
    // un-own: two taps, then Undo
    await page.click('#ownView [data-v="owned"]');
    await idle(page);
    await page.click('#mkMore');
    await page.click('#ownNone');
    await page.waitForTimeout(450);
    await page.click('#ownNone');
    await idle(page); // (v288: a second tap within 400 ms is a double tap's)
    assert.equal(await page.evaluate(() => state.owned.size), 0);
    assert.match(await toastText(page), /Removed \d+ markers from your collection/);
    await page.click('#toastAct');
    await idle(page);
    assert.deepEqual(await page.evaluate(() => [...state.owned].sort()), own0);
    assert.deepEqual(errors, []);
  });
  test('Clear collection keeps its second tap and then offers Undo', async () => {
    const { page, errors } = await openApp();
    await welcome(page, 'look');
    await page.click('#mCollection');
    await idle(page);
    const own0 = await page.evaluate(() => [...state.owned].sort());
    // (v311: in Markers' ⋯)
    await page.click('#mkMore');
    await page.click('#mkClear');
    await idle(page);
    assert.equal(await page.evaluate(() => state.owned.size), own0.length, 'the first tap only asks');
    assert.equal(await page.isVisible('#mkMenu'), true, 'the menu stays open for the second');
    await pause(page, 450, 'not a double tap');
    await page.click('#mkClear');
    await idle(page);
    assert.equal(await page.evaluate(() => state.owned.size), 0);
    assert.match(await toastText(page), new RegExp(`Cleared ${own0.length} markers`));
    await page.click('#toastAct');
    await idle(page);
    assert.deepEqual(await page.evaluate(() => [...state.owned].sort()), own0);
    assert.deepEqual(errors, []);
  });
  test('Library delete: Undo brings the guide back, and it opens with its progress', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await page.evaluate(() => {
      const o = __mstest.assignData.order;
      [0, 1, 2].forEach((i) => {
        __mstest.colored[o[i]] = 1;
      });
      __mstest.guideDirty = true;
    });
    await saveGuide(page);
    await idle(page);
    const id = await page.evaluate(() => state.saved.find((s) => s.type === 'guide').id);
    await openLibrary(page);
    // (no wait for the page to settle here: the Undo lasts 6 s, and on a slow machine drawing the Library's pictures can
    // take that long)
    await libItem(page, row(id), 'sdel');
    await page.waitForSelector(row(id), { state: 'detached', timeout: 3000 }).catch(() => {});
    assert.equal(await page.locator(row(id)).count(), 0, 'gone from the list at once');
    assert.equal(await page.evaluate((id) => state.saved.some((s) => s.id === id), id), false);
    assert.ok(await hasPayload(page, id), 'its stored picture is kept for now');
    assert.match(await toastText(page), /Deleted “.+”/);
    // (force: once on GitHub's WebKit, Playwright waited 30 s for the Undo to hold still while the Library drew its
    // pictures; the toast is on screen, and the tap is what's being tested)
    await page.click('#toastAct', { force: true });
    await idle(page);
    assert.equal(await page.locator(row(id)).count(), 1, 'back in the list');
    await idle(page, 6300); // until the 6 s Undo window has run out
    assert.ok(await hasPayload(page, id), 'still stored after the Undo window');
    // a fresh start: open it from the Library
    await page.reload();
    await idle(page);
    await openLibrary(page);
    await page.click(row(id) + ' .sname');
    await page.waitForFunction((id) => __mstest.curId === id && __mstest.assignData, id);
    await idle(page);
    assert.equal(
      await page.evaluate(() => __mstest.assignData.order.filter((l) => __mstest.colored[l]).length),
      3,
      'its progress came back too',
    );
    assert.deepEqual(errors, []);
  });
  // (v318.1: Recently deleted keeps it a week after the Undo window, e2e/v3181-bin; it had gone when the window was over)
  test('Library delete without Undo: the stored guide waits in Recently deleted, then goes at the first start a week on', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await saveGuide(page);
    await idle(page);
    const id = await page.evaluate(() => state.saved.find((s) => s.type === 'guide').id);
    await openLibrary(page);
    await libItem(page, row(id), 'sdel');
    await idle(page);
    assert.ok(await hasPayload(page, id));
    await idle(page, 6200); // until the 6 s Undo window has run out
    assert.ok(await hasPayload(page, id), 'kept once the Undo window is over');
    assert.equal(await page.textContent('#libBin'), 'Recently deleted (1)');
    // another guide deleted, then the app reloaded before the window ends
    await page.click('#savedClose');
    await page.evaluate(() => {
      const o = __mstest.assignData.order;
      __mstest.colored[o[0]] = 1;
      __mstest.guideDirty = true;
    });
    await page.click('#mSections');
    await idle(page);
    await saveGuide(page);
    await idle(page);
    const id2 = await page.evaluate(() => {
      const g = state.saved.filter((s) => s.type === 'guide');
      return g.length ? g[0].id : null;
    });
    assert.ok(id2 != null, 'saved again as a new Library guide');
    await openLibrary(page);
    await libItem(page, row(id2), 'sdel');
    await idle(page);
    assert.ok(await hasPayload(page, id2));
    await page.reload();
    await idle(page, 2500);
    assert.equal(await page.evaluate((id) => state.saved.some((s) => s.id === id), id2), false);
    assert.ok(await hasPayload(page, id2), 'kept through the next start');
    // a week on: both go at the next start
    await page.evaluate(() => {
      const l = JSON.parse(localStorage.getItem('ms-lib-deleting'));
      l.forEach((x) => (x.t -= 8 * 864e5));
      localStorage.setItem('ms-lib-deleting', JSON.stringify(l));
    });
    await page.reload();
    await idle(page, 2500);
    await page.waitForFunction(() => localStorage.getItem('ms-lib-deleting') === null);
    assert.equal(await hasPayload(page, id), false);
    assert.equal(await hasPayload(page, id2), false, 'tidied away at the first start a week on');
    assert.deepEqual(errors, []);
  });
  test('Reset progress in colour along can be undone', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    const ls = await bigSections(page, 3);
    await page.click('#sfColor');
    await idle(page);
    for (const l of ls) await tap(page, l);
    const done = () =>
      page.evaluate(() => __mstest.assignData.order.filter((l) => __mstest.colored[l]).sort((a, b) => a - b));
    const d0 = await done();
    assert.equal(d0.length, 3);
    await menuItem(page, 'Reset progress');
    await idle(page);
    assert.equal(await page.textContent('#sfSheetT'), 'Reset progress?', 'it asks first');
    await page.click('#sfResetGo');
    await idle(page);
    assert.deepEqual(await done(), []);
    assert.match(await toastText(page), /Progress reset/);
    await page.click('#toastAct');
    await idle(page);
    assert.deepEqual(await done(), d0, 'the ticks are back');
    assert.match(await toolStatus(page), /^3 of \d+ coloured$/);
    assert.equal(await vsFull(page), 0);
    assert.deepEqual(errors, []);
  });
  test('Blend anchors, shading and filters are undone too', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await tab(page, 'pattern');
    await page.click('#sfFam [data-v="blend"]');
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.planLabel), 'Pattern: Blend');
    const n0 = await page.evaluate(() => __mstest.anchors.length),
      a0 = await assignMap(page);
    // a tap on the picture adds an anchor
    const [l] = await bigSections(page, 1);
    await tap(page, l);
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.anchors.length), n0 + 1);
    assert.equal(await page.evaluate(() => __mstest.planLabel), 'Anchor added');
    await page.keyboard.press('Control+z');
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.anchors.length), n0);
    assert.deepEqual(await assignMap(page), a0);
    // shading
    await tab(page, 'shading');
    await page.evaluate(() => __mstest.shadeTo('shadow'));
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.shadeMode), 'shadow');
    assert.equal(await page.evaluate(() => __mstest.planLabel), 'Highlights: None (shadows only)');
    await page.keyboard.press('Control+z');
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.shadeMode), 'off');
    // filters (they belong to the whole app, and come back with the step)
    await page.keyboard.press('Control+z');
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.family), 'gradient');
    const f0 = await page.evaluate(() => [...state.excluded].sort()),
      b0 = await assignMap(page);
    await tab(page, 'colours');
    await page.click('#sfFiltToggle');
    await idle(page);
    await page.click('#sf_fams .chip');
    await idle(page);
    assert.notDeepEqual(await page.evaluate(() => [...state.excluded].sort()), f0);
    assert.equal(await page.evaluate(() => __mstest.planLabel), 'Filters changed');
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    await page.keyboard.press('Control+z');
    await idle(page);
    assert.deepEqual(await page.evaluate(() => [...state.excluded].sort()), f0, 'filters back');
    assert.deepEqual(await assignMap(page), b0);
    assert.equal(await plan(page), 0);
    assert.equal(await vsFull(page), 0);
    assert.deepEqual(errors, []);
  });
  // ---- From the fifth review (data safety) ----
  test('Undo after Change colour, Unpin and Paint brings back part-done tones', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await page.click('.sftabbtn[data-t="shading"]');
    await page.evaluate(() => __mstest.shadeTo('full'));
    await idle(page);
    await page.click('.sftabbtn[data-t="colours"]').catch(() => {});
    await scrollTop(page);
    const l = await page.evaluate(() => {
      const t = __mstest,
        g = t.shadeGeom();
      return t.assignData.order
        .filter((l) => t.shadeable(l, g))
        .sort((a, b) => t.comps[b].area - t.comps[a].area)[0];
    });
    const part = () => page.evaluate((l) => [__mstest.colored[l], __mstest.tonePart[l]], l);
    await page.evaluate((l) => {
      __mstest.stepSet(l, 1, true);
      __mstest.renderGuide();
    }, l);
    const t0 = await part();
    assert.equal(t0[0], 0);
    assert.ok(t0[1] > 0, 'part-done');
    // Change colour
    const k = await page.evaluate((l) => {
      const used = __mstest.assignData.assign[l].mkey;
      return sfCollection().find((m) => m.mkey !== used).mkey;
    }, l);
    const p = await sectionPoint(page, l);
    await page.mouse.click(p.x, p.y);
    await idle(page);
    await page.click('.sftip [data-a="change"]');
    await page.click(`#sfPopSw .sfswg:not(.sfswrec) .sfsw[data-k="${k}"]`);
    await page.click('#sfPopConfirm');
    await idle(page);
    assert.deepEqual(await part(), [0, 0], 'a new marker starts its tones afresh');
    await page.click('#sfPlanUndo');
    await idle(page);
    assert.deepEqual(await part(), t0, 'Undo brings them back');
    // Unpin: the section goes back to the pattern's marker
    await scrollTop(page);
    await page.mouse.click(p.x, p.y);
    await idle(page);
    await page.click('.sftip [data-a="change"]');
    await page.click(`#sfPopSw .sfswg:not(.sfswrec) .sfsw[data-k="${k}"]`);
    await page.click('#sfPopConfirm');
    await idle(page);
    await page.evaluate((l) => {
      __mstest.stepSet(l, 1, true);
      __mstest.renderGuide();
    }, l);
    const t1 = await part();
    assert.ok(t1[1] > 0);
    await scrollTop(page);
    await page.mouse.click(p.x, p.y);
    await idle(page);
    await page.click('.sftip [data-a="pin"]');
    await idle(page);
    assert.deepEqual(await part(), [0, 0], 'unpinned: tones afresh');
    await page.click('#sfPlanUndo');
    await idle(page);
    assert.deepEqual(await part(), t1, 'Undo brings them back');
    // Paint (Manual) over it
    await page.click('.sftabbtn[data-t="pattern"]');
    await page.click('#sfFam [data-v="manual"]');
    await idle(page);
    const k2 = await page.evaluate(
      ([l, k]) =>
        sfCollection().find((m) => m.mkey !== k && m.mkey !== __mstest.assignData.assign[l].mkey).mkey,
      [l, k],
    );
    await page.evaluate((k2) => localStorage.setItem('ms-recent-mk', JSON.stringify([k2])), k2);
    const t2 = await part();
    assert.ok(t2[1] > 0);
    await page.click('#sfPaint');
    await idle(page);
    await scrollTop(page);
    const p2 = await sectionPoint(page, l);
    await page.mouse.click(p2.x, p2.y);
    await idle(page);
    assert.equal(await page.evaluate((l) => __mstest.assignData.assign[l].mkey, l), k2, 'painted');
    assert.deepEqual(await part(), [0, 0]);
    await page.click('#sfPaint');
    await idle(page);
    await page.click('#sfPlanUndo');
    await idle(page);
    assert.deepEqual(await part(), t2, 'Undo brings them back');
    assert.deepEqual(errors, []);
  });
  test('Plan: pattern, shading and colour changes make no toast (↶ Undo says what it takes back, a screen reader hears it); ✨ Surprise keeps its toast', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    const map = () =>
      page.evaluate(() => {
        const a = __mstest.assignData.assign,
          o = {};
        for (const k in a) o[k] = a[k].mkey;
        return o;
      });
    const a0 = await map();
    await tab(page, 'pattern');
    await page.click('#sfFam [data-v="random"]');
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.family), 'random');
    assert.equal(await toastOnText(page), '', 'no toast');
    assert.equal(await undoLabel(page), 'Undo: Pattern: Random');
    assert.equal(await live(page), 'Pattern: Random');
    await pause(page, 100, 'a step within 100 ms of an announcement keeps the earlier words');
    await tab(page, 'shading');
    await page.evaluate(() => __mstest.shadeTo('shadow'));
    await idle(page);
    assert.equal(await toastOnText(page), '');
    assert.equal(await undoLabel(page), 'Undo: Highlights: None (shadows only)');
    assert.equal(await live(page), 'Highlights: None (shadows only)');
    // a section's colour, from its tip and the picker
    await scrollTop(page);
    const l = await page.evaluate(
      () =>
        __mstest.assignData.order.slice().sort((a, b) => __mstest.comps[b].area - __mstest.comps[a].area)[0],
    );
    const p = await sectionPoint(page, l);
    await page.mouse.click(p.x, p.y);
    await idle(page);
    await page.click('.sftip [data-a="change"]');
    await idle(page);
    const k = await page.evaluate((l) => {
      const cur = __mstest.assignData.assign[l].mkey;
      return [...document.querySelectorAll('#sfPopSw .sfswg:not(.sfswrec) .sfsw')].find(
        (x) => x.dataset.k !== cur,
      ).dataset.k;
    }, l);
    await page.click(`#sfPopSw .sfswg:not(.sfswrec) .sfsw[data-k="${k}"]`);
    await page.click('#sfPopConfirm');
    await idle(page);
    assert.equal(await toastOnText(page), '');
    assert.equal(await undoLabel(page), 'Undo: Section colour changed');
    // ↶ Undo takes all three back
    await scrollTop(page);
    for (let i = 0; i < 3; i++) {
      await page.click('#sfPlanUndo');
      await idle(page);
    }
    assert.equal(await page.evaluate(() => __mstest.family), 'gradient');
    assert.equal(await page.evaluate(() => __mstest.shadeMode), 'off');
    assert.deepEqual(await map(), a0);
    // Surprise: its toast says what it chose, with Undo
    const st = await page.evaluate(() => JSON.stringify(__mstest.currentDesignObj().payload.style));
    await page.click('#sfSurprise');
    await idle(page);
    assert.match(await toastOnText(page), /^Surprise: .+ markers Undo$/);
    assert.match(await undoLabel(page), /^Undo: Surprise: /);
    await scrollTop(page);
    await page.click('#sfPlanUndo');
    await idle(page);
    assert.equal(
      await page.evaluate(() => JSON.stringify(__mstest.currentDesignObj().payload.style)),
      st,
      '↶ Undo takes Surprise back',
    );
    assert.deepEqual(await map(), a0);
    assert.deepEqual(errors, []);
  });
  // ---- v305: Redo ----
  test('Redo takes the plan forward again step by step (↷ beside ↶, Ctrl+Shift+Z, Ctrl+Y); a new step clears it', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    const redoShown = () =>
      page.evaluate(() => getComputedStyle(document.getElementById('sfPlanRedo')).display !== 'none');
    assert.equal(await redoShown(), false);
    const a0 = await assignMap(page);
    await tab(page, 'pattern');
    await page.click('#sfFam [data-v="random"]');
    await idle(page);
    const a1 = await assignMap(page);
    await page.click('#sfShuffle');
    await idle(page);
    const a2 = await assignMap(page);
    await page.click('#sfPlanUndo');
    await idle(page);
    await page.click('#sfPlanUndo');
    await idle(page);
    assert.deepEqual(await assignMap(page), a0);
    assert.equal(await page.getAttribute('#sfPlanRedo', 'aria-label'), 'Redo: Pattern: Random');
    // (the plan's: not in Colour along or its Focus mode, and still there back in the plan)
    await page.click('#sfColor');
    await idle(page);
    assert.equal(await redoShown(), false, 'not in Colour along');
    await page.click('#sfFocus');
    await idle(page);
    assert.equal(await redoShown(), false, 'not in Focus mode');
    await page.keyboard.press('Escape');
    await idle(page);
    await page.click('#sfDoneBtn');
    await idle(page);
    assert.equal(await redoShown(), true, 'back in the plan');
    await page.click('#sfPlanRedo');
    await idle(page);
    assert.deepEqual(await assignMap(page), a1);
    await page.keyboard.press('Control+Shift+Z');
    await idle(page);
    assert.deepEqual(await assignMap(page), a2);
    assert.equal(await redoShown(), false, 'nothing left to redo');
    await page.keyboard.press('Control+z');
    await idle(page);
    await page.keyboard.press('Control+y');
    await idle(page);
    assert.deepEqual(await assignMap(page), a2);
    await page.keyboard.press('Control+z');
    await idle(page);
    await page.click('#sfShuffle');
    await idle(page);
    assert.equal(await redoShown(), false, 'a new step clears Redo');
    assert.deepEqual(errors, []);
  });
  test('Redo of Change colour clears the part-done tones its Undo brought back', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await page.click('.sftabbtn[data-t="shading"]');
    await page.evaluate(() => __mstest.shadeTo('full'));
    await idle(page);
    await scrollTop(page);
    const l = await page.evaluate(() => {
      const t = __mstest,
        g = t.shadeGeom();
      return t.assignData.order
        .filter((l) => t.shadeable(l, g))
        .sort((a, b) => t.comps[b].area - t.comps[a].area)[0];
    });
    const part = () =>
      page.evaluate(
        (l) => [__mstest.colored[l], __mstest.tonePart[l], __mstest.assignData.assign[l].mkey],
        l,
      );
    await page.evaluate((l) => {
      __mstest.stepSet(l, 1, true);
      __mstest.renderGuide();
    }, l);
    const t0 = await part();
    const k = await page.evaluate((l) => {
      const used = __mstest.assignData.assign[l].mkey;
      return sfCollection().find((m) => m.mkey !== used).mkey;
    }, l);
    const p = await sectionPoint(page, l);
    await page.mouse.click(p.x, p.y);
    await idle(page);
    await page.click('.sftip [data-a="change"]');
    await page.click(`#sfPopSw .sfswg:not(.sfswrec) .sfsw[data-k="${k}"]`);
    await page.click('#sfPopConfirm');
    await idle(page);
    const t1 = await part();
    assert.deepEqual(t1, [0, 0, k]);
    await page.click('#sfPlanUndo');
    await idle(page);
    assert.deepEqual(await part(), t0);
    await page.click('#sfPlanRedo');
    await idle(page);
    assert.deepEqual(await part(), t1, 'the new marker, its tones afresh');
    await page.click('#sfPlanUndo');
    await idle(page);
    assert.deepEqual(await part(), t0, 'and Undo once more brings them back');
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
  test('Mark all coloured in Colour along, and Focus mode’s Mark all done, can be undone', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await page.click('#sfColor');
    await idle(page);
    await scrollTop(page);
    const k0 = await page.evaluate(() => {
      const t = __mstest,
        n = {};
      t.assignData.order.forEach((l) => {
        const k = t.assignData.assign[l].mkey;
        n[k] = (n[k] || 0) + 1;
      });
      return Object.keys(n).sort((a, b) => n[b] - n[a])[0];
    });
    await page.locator(`#sfAlist .sfarow[data-k="${k0}"] .sfah`).click();
    await idle(page);
    const k = await page.evaluate(() => __mstest.hlKey);
    const secs = await page.evaluate(
      (k) => __mstest.assignData.order.filter((l) => __mstest.assignData.assign[l].mkey === k),
      k,
    );
    assert.ok(secs.length >= 2);
    await page.evaluate((l) => {
      __mstest.colored[l] = 1;
      __mstest.renderGuide();
    }, secs[0]);
    await page.click('#sfMarkAll');
    await idle(page);
    assert.ok((await ticked(page, secs)).every((x) => x === 1));
    assert.match(await page.textContent('#msToast'), /Marked all .+ coloured/);
    await page.click('#toastAct');
    await idle(page);
    assert.deepEqual(
      await ticked(page, secs),
      secs.map((_, i) => (i === 0 ? 1 : 0)),
      'back to the one that was done',
    );
    // Focus mode: Colours › Mark all … done, then Undo
    await page.click('#sfFocus');
    await idle(page);
    const fk = await page.evaluate(
      () => __mstest.assignData.assign[__mstest.focusOrd[__mstest.focusPos]].mkey,
    );
    const fs = await page.evaluate(
      (k) => __mstest.assignData.order.filter((l) => __mstest.assignData.assign[l].mkey === k),
      fk,
    );
    const f0 = await ticked(page, fs);
    await page.click('#sfFocCols');
    await idle(page);
    await page.click('#sfFocAll');
    await idle(page);
    assert.ok((await ticked(page, fs)).every((x) => x === 1));
    assert.match(await page.textContent('#msToast'), /Marked all .+ done/);
    await page.click('#toastAct');
    await idle(page);
    assert.deepEqual(await ticked(page, fs), f0, 'as they were');
    assert.deepEqual(errors, []);
  });
}

// ---- from v3121.test.mjs ----
// v312.1: from fable's two reviews of v312 (Ben's decisions D1–D3). Undo back past a marker marked dry keeps the
// guide's marker; a pinned, coloured section keeps a marker since marked dry; Back closes Markers' Add markers sheet a
// step at a time and the sheet is named "Add markers"; the guide's ⋯ › Send feedback opens the form's dialog; Send
// results sends once, and gives up on a stalled connection; Edit sections says the new count and outlines a merge;
// the wording fixes. Each test fails on v312.
{
  const FIELDS = 27;
  const FORM =
    'https://docs.google.com/forms/d/e/1FAIpQLSdTEST/viewform?usp=pp_url&' +
    Array.from({ length: FIELDS }, (_, i) => 'entry.' + (2000 + i) + '=x').join('&');
  const withForm = `window.__MS_RESULTS_FORM = ${JSON.stringify(FORM)};`;
  const keyOf = (page, l) => page.evaluate((l) => __mstest.assignData.assign[l].mkey, l);
  async function markDry(page, k, dry = true) {
    await page.click('#mCollection');
    await idle(page);
    await page.evaluate(
      ([k, dry]) => {
        if (dry) state.ink[k] = 'dry';
        else delete state.ink[k];
        save();
        chrome();
      },
      [k, dry],
    );
    await page.click('#mSections');
    await idle(page);
  }
  test('Undo back past a marker marked dry: its sections show a stand-in, the guide keeps the marker, and it comes back', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await page.click('#sfMood [data-v="vivid"]');
    await idle(page);
    // a marker with sections both now and in the plan before the Mood step
    const pick = await page.evaluate(() => {
      const t = __mstest,
        by = {},
        byPrev = {},
        prev = t.assign.planStack[t.assign.planStack.length - 1].s.a;
      for (const l in t.assignData.assign) (by[t.assignData.assign[l].mkey] ||= []).push(+l);
      for (const l in prev) (byPrev[prev[l]] ||= []).push(+l);
      const k = Object.keys(by).find((x) => by[x].length >= 2 && byPrev[x] && byPrev[x].length >= 2);
      return { k, prev: byPrev[k] };
    });
    assert.ok(pick.k);
    await markDry(page, pick.k);
    await page.click('#sfPlanUndo');
    await idle(page);
    const shown = await page.evaluate((s) => s.map((l) => __mstest.assignData.assign[l].mkey), pick.prev);
    assert.ok(
      shown.every((k) => k !== pick.k),
      'a stand-in shows',
    );
    const kept = await page.evaluate(
      ([k, s]) => {
        const d = __mstest.currentDesignObj();
        return s.filter((l) => d.payload.assign[l] === k).length;
      },
      [pick.k, pick.prev],
    );
    assert.equal(kept, pick.prev.length, 'the guide keeps the marker, as saved');
    await markDry(page, pick.k, false);
    const back = await page.evaluate((s) => s.map((l) => __mstest.assignData.assign[l].mkey), pick.prev);
    assert.ok(
      back.every((k) => k === pick.k),
      'back in its sections: ' + back.join(' '),
    );
    assert.deepEqual(errors, []);
  });
  test('a pinned, coloured section keeps a marker since marked dry through a plan change, as an unpinned one does', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    const p = await page.evaluate(() => {
      const t = __mstest,
        by = {};
      for (const l in t.assignData.assign) (by[t.assignData.assign[l].mkey] ||= []).push(+l);
      const k = Object.keys(by).find((x) => by[x].length >= 3),
        [l, l2] = by[k];
      t.locks[l] = k;
      t.colored[l] = 1;
      t.colored[l2] = 1;
      return { k, l, l2 };
    });
    await markDry(page, p.k);
    await page.click('#sfMood [data-v="vivid"]');
    await idle(page);
    assert.deepEqual([await keyOf(page, p.l), await keyOf(page, p.l2)], [p.k, p.k]);
    assert.deepEqual(errors, []);
  });
  test('the Add markers sheet is named Add markers for a screen reader, and the welcome its own name again after', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await welcome(page, 'look');
    await idle(page);
    await page.click('#mCollection');
    await idle(page);
    await page.click('#mkAddBtn');
    await idle(page);
    assert.equal(await page.getAttribute('#welcome', 'aria-labelledby'), 'wcTA');
    assert.equal(await page.textContent('#wcTA'), 'Add markers');
    await page.keyboard.press('Escape');
    await idle(page);
    assert.equal(await page.getAttribute('#welcome', 'aria-labelledby'), 'wcTitle');
    assert.deepEqual(errors, []);
  });
  // (Back is left to the browser under test automation in Safari's engine: helpers' WK.back)
  test(
    'Back closes the Add markers sheet a step at a time; the welcome still has no entry',
    notOnWebKit(WK.back),
    async () => {
      const { page, errors } = await openApp({ width: 820, height: 1180 });
      // (the welcome: no Back entry of its own, as before)
      await page.waitForSelector('#welcome.on');
      const h0 = await page.evaluate(() => history.length);
      await page.waitForTimeout(150);
      assert.equal(await page.evaluate(() => history.length), h0, 'the welcome makes no entry');
      await welcome(page, 'look');
      await idle(page);
      await page.click('#mCollection');
      await idle(page);
      await page.click('#mkAddBtn');
      await idle(page);
      assert.equal(await page.getAttribute('#welcome', 'aria-labelledby'), 'wcTA');
      assert.equal(await page.textContent('#wcTA'), 'Add markers');
      await page.waitForFunction(() => history.state && history.state.msLayer >= 1);
      await page.click('#mkaSet');
      await idle(page);
      await page.goBack();
      await idle(page);
      assert.ok(await page.isVisible('#wcStepAdd'), 'Back: from the sets to the ways');
      assert.ok(await page.isVisible('#welcome'));
      await page.waitForFunction(() => history.state && history.state.msLayer >= 1);
      await page.goBack();
      await idle(page);
      assert.equal(await page.isVisible('#welcome'), false, 'Back again: closed');
      assert.equal(
        await page.getAttribute('#welcome', 'aria-labelledby'),
        'wcTitle',
        'the welcome’s name back',
      );
      assert.ok(await page.isVisible('#mkAddBtn'), 'still on Markers');
      assert.deepEqual(errors, []);
    },
  );
  test('the guide’s ⋯ › Send feedback opens the form’s dialog, as every other Send feedback does', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180, init: withForm });
    await sampleGuide(page);
    await page.click('#sfMore');
    await page.click('#sfSheet [data-m="feedback"]');
    await idle(page);
    assert.ok(await page.isVisible('#fbOverlay'));
    assert.deepEqual(errors, []);
  });
  test('Send results: one send at a time (both buttons off meanwhile); a stalled connection gives up and says so', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180, init: withForm });
    await welcome(page, 'look');
    await idle(page);
    let n = 0,
      hold = null;
    await page.route(/docs\.google\.com\/forms\/d\/e\/1FAIpQLSdTEST\/formResponse/, (r) => {
      n++;
      hold = r; // never answered: a stalled connection
    });
    await page.clock.install();
    await page.click('#homeTasks');
    await page.click('.ttrow[data-k="add"] [data-r="easy"]');
    await page.click('#ttSend');
    assert.equal(await page.isDisabled('#ttSendTop'), true);
    assert.equal(await page.isDisabled('#ttSend'), true);
    await page.click('#ttSendTop', { force: true });
    await page.clock.runFor(21000);
    await page.waitForFunction(() => /^Couldn’t send/.test(document.getElementById('ttSaid').textContent));
    assert.equal(n, 1, 'sent once');
    assert.equal(await page.isDisabled('#ttSend'), false);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('ms-tester')).sends), 0);
    if (hold) await hold.abort().catch(() => {});
    assert.deepEqual(errors, []);
  });
  test('Edit sections: a merge outlines the section they became for a moment and says the new count; leave out says it too', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await answerAsks(page);
    await page.click('#sfBack2');
    await idle(page);
    await page.evaluate(() => scrollTo(0, 0));
    const tap = async (l) => {
      const p = await sectionPoint(page, l);
      await page.mouse.click(p.x, p.y);
      await idle(page);
    };
    const said = () => page.evaluate(() => document.getElementById('sfLive').textContent);
    const ol = () =>
      page.evaluate(() => {
        const o = document.querySelector('#sfRoot .sfoutline');
        return !!o && o.style.display !== 'none';
      });
    const [a, b] = await page.evaluate(() => {
      const t = __mstest,
        cl = t.countedList().filter((l) => t.comps[l].area > 400),
        adj = t.adj;
      for (const x of cl) for (const y of cl) if (x < y && adj[x] && adj[x].has(y)) return [x, y];
      return [];
    });
    await page.click('#sfEdit [data-m="merge"]');
    await tap(a);
    await tap(b);
    const n1 = await page.textContent('#sfCount');
    assert.equal(await said(), 'Merged into one section: ' + n1);
    assert.equal(await ol(), true, 'the merged section outlined');
    await page.waitForTimeout(1700);
    assert.equal(await ol(), false, 'for a moment only');
    // leave out
    await page.click('#sfEdit [data-m="toggle"]');
    const big = await page.evaluate(() => {
      const t = __mstest;
      return t.countedList().sort((x, y) => t.comps[y].area - t.comps[x].area)[0];
    });
    await tap(big);
    assert.equal(await said(), 'Left out: ' + (await page.textContent('#sfCount')));
    await tap(big);
    assert.equal(await said(), 'Brought back: ' + n1);
    assert.deepEqual(errors, []);
  });
  test('wording: Scan’s line on the sheet, To buy’s empty list, tester task 3; Print says Close once there’s a PDF', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await page.click('.sftabbtn[data-t="share"]');
    await page.click('#sfPrint');
    await page.waitForSelector('#sfSheet [data-pr="cancel"]');
    assert.equal((await page.textContent('#sfSheet [data-pr="cancel"]')).trim(), 'Cancel');
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.click('#sfPDF')]);
    await dl.path();
    assert.equal((await page.textContent('#sfSheet [data-pr="cancel"]')).trim(), 'Close');
    await page.click('#sfSheet [data-pr="cancel"]');
    await page.click('#mCollection');
    await idle(page);
    await page.click('#mkAddBtn');
    assert.match(
      await page.textContent('#mkaScan'),
      /Type codes from a receipt, or scan caps with Scan Text on an iPad or iPhone\./,
    );
    await page.keyboard.press('Escape');
    await page.click('#ownView [data-v="wish"]');
    await idle(page);
    assert.match(await page.textContent('#wishView'), /in its details, then tap \+ To buy for a replacement/);
    await page.click('#mHome');
    await idle(page);
    await page.click('#homeTasks');
    await page.click('.ttrow[data-k="plan"] .tttop');
    assert.match(await page.textContent('#ttBody-plan'), /or Shuffle \(Other pairings in Random\)/);
    assert.deepEqual(errors, []);
  });
}
