// The Library, saving and reopening guides, guide files.
// (v320) Tests organised by feature: each block below came from the file named above it, its tests unchanged.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ARTIFACTS,
  answerAsks,
  asked,
  buildGo,
  guideName,
  idle,
  letterGuide,
  libItem,
  openApp,
  openMenu,
  rename,
  sampleGuide,
  saveCopy,
  saveGuide,
  scrollTop,
  sectionPoint,
  setup,
  teardown,
  toolStatus,
  welcome,
} from './helpers.mjs';
import { mkdir } from 'node:fs/promises';

before(setup);
after(teardown);

// ---- from autosave.test.mjs ----
// One save model for guides (v285): a guide from your own photo goes into the Library by itself once it's built, and
// from then on every change saves itself into that same Library entry. The sample joins the Library only once it's
// changed ("Sample jellyfish", numbered after the first). "Save a copy" makes a second entry and carries on with the
// copy. A stale guide is never saved; a guide deleted in the Library while open stays out (and out of the autosave
// slot) unless Put back; a full storage says so once, offers Save to try again, and keeps the guide for Resume.
{
  const AUTO = 2300;
  // idle(page, AUTO): until auto-save (1.5 s after the last change) has run
  // Save now instead of waiting for the auto-save timer, where a test isn't about the timer itself: the Library save
  // (resolves once it is stored), or SF.flushSave() for a guide not in the Library yet (waits for the Resume slot too)
  const flushSave = (page) => page.evaluate(() => __mstest.flushSave());
  const flushSlot = (page) => page.evaluate(() => SF.flushSave());
  const guides = (page) =>
    page.evaluate(() =>
      state.saved
        .filter((s) => s.type === 'guide')
        .map((s) => ({ id: s.id, name: s.name, done: s.done, n: s.n })),
    );
  const stored = (page, id) =>
    page.evaluate(
      (id) =>
        IDB.get('guide-' + id).then(
          (p) =>
            p && {
              shape: p.style.gradShape,
              prog: (p.prog || []).length,
              lmap: p.lmap,
              assign: JSON.stringify(p.assign),
            },
        ),
      id,
    );
  const status = (page) =>
    page.evaluate(() => {
      const el = document.getElementById('sfSaveSt');
      return el && el.style.display !== 'none' ? el.textContent : '';
    });
  // the header's button: Put back (deleted while open) or Save (after a failed save); Save a copy is in the ⋯ menu
  const saveShown = (page) => page.isVisible('#sfSave');
  async function copyOffered(page) {
    await openMenu(page);
    const on = await page.isVisible('#sfSaveCopy');
    await page.keyboard.press('Escape');
    return on;
  }
  const row = (id) => `#savedList .srow[data-id="${id}"]`;
  async function openLibrary(page) {
    await page.click('#mHome');
    await page.click('#homeLibCard');
    await idle(page);
  }
  async function tick(page, ls) {
    await scrollTop(page);
    for (const l of ls) {
      const p = await sectionPoint(page, l);
      await page.mouse.click(p.x, p.y);
    }
  }
  // a change the way the app makes one (ticked in code, then drawn, which schedules the save)
  const tickInCode = (page, i) =>
    page.evaluate((i) => {
      const t = __mstest;
      t.colored[t.assignData.order[i]] = 1;
      t.guideDirty = true;
      t.renderGuide();
    }, i);
  // ---- From the fourth review (data safety) ----
  const guidesR4 = (page) =>
    page.evaluate(() =>
      state.saved
        .filter((s) => s.type === 'guide')
        .map((s) => ({ id: s.id, name: s.name, thumb: s.thumb, W: s.W, H: s.H })),
    );
  const storedR4 = (page, id) =>
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
  test('a guide from your photo goes into the Library once built; then a pattern change, ticks and a rename save themselves into the same entry', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await letterGuide(page);
    await page.waitForFunction(() => __mstest.inLibrary);
    await idle(page);
    const [g] = await guides(page);
    assert.ok(g, 'in the Library without pressing anything');
    assert.equal(await page.evaluate(() => __mstest.curId), g.id);
    assert.equal(await saveShown(page), false, 'no Save button');
    assert.equal(await copyOffered(page), true, '⋯ offers Save a copy');
    assert.match(await status(page), /^(Saved in your Library|Saves itself from now on) ✓$/);
    assert.equal(
      await page.evaluate(() => localStorage.getItem('ms-guide-auto')),
      null,
      'nothing in the autosave slot',
    );
    assert.match(await page.textContent('#sfLive'), /Saved in your Library/, 'announced for screen readers');
    assert.equal(await page.evaluate(() => guidesAtRisk()), 0, 'as built, the backup reminder leaves it out');

    // a pattern change: saved without pressing anything (v307: "Saving…" only while it's being written, not at once)
    const shape0 = (await stored(page, g.id)).shape;
    await page.click('.sftabbtn[data-t="pattern"]');
    const shape = await page.getAttribute('#sfShape .sfedit:not(.on)', 'data-v');
    await page.click(`#sfShape [data-v="${shape}"]`);
    assert.notEqual(await status(page), 'Saving…');
    await idle(page, AUTO);
    assert.match(await status(page), /^(Saved in your Library|Saves itself from now on) ✓$/);
    assert.notEqual(shape, shape0);
    assert.equal((await stored(page, g.id)).shape, shape, 'the new pattern is in the Library entry');
    assert.equal(await page.evaluate(() => guidesAtRisk()), 1, 'changed: the backup reminder counts it now');

    // ticks while colouring along
    await page.click('#sfColor');
    await idle(page);
    const ls = await page.evaluate(() => __mstest.assignData.order.slice(0, 3));
    await tick(page, ls);
    await idle(page, AUTO);
    assert.equal((await stored(page, g.id)).prog, 3);
    assert.equal((await guides(page))[0].done, 3, 'the Library knows how much is coloured');

    // a new name, renamed in the header
    await rename(page, 'Autosaved Garden');
    await idle(page, AUTO);
    assert.equal((await guides(page))[0].name, 'Autosaved Garden');
    assert.equal((await guides(page)).length, 1, 'always the same entry');

    // after a reload, the Library shows the progress and the guide opens as it was left
    await page.reload();
    await idle(page);
    await openLibrary(page);
    assert.match(await page.textContent(row(g.id) + ' .smeta'), new RegExp(`3 of ${g.n} coloured`));
    assert.match(await page.textContent(row(g.id) + ' .sname'), /Autosaved Garden/);
    await page.click(row(g.id) + ' .sname');
    await page.waitForFunction((id) => __mstest.curId === id && __mstest.assignData, g.id);
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.colored.reduce((a, b) => a + b, 0)), 3);
    // (v284: part-way coloured, it opens in Colour along)
    assert.equal(await page.evaluate(() => __mstest.sfmode), 'color');
    await page.click('#sfDoneBtn');
    await idle(page);
    await page.click('.sftabbtn[data-t="pattern"]');
    await idle(page);
    assert.equal(await page.getAttribute('#sfShape .sfedit.on', 'data-v'), shape);
    assert.equal(await guideName(page), 'Autosaved Garden');
    assert.match(await status(page), /^(Saved in your Library|Saves itself from now on) ✓$/);
    // just opening it changes nothing in the Library (no new date, no save)
    const ts = await page.evaluate((id) => state.saved.find((s) => s.id === id).ts, g.id);
    await idle(page, AUTO);
    assert.equal(
      await page.evaluate((id) => state.saved.find((s) => s.id === id).ts, g.id),
      ts,
      'opening is not a change',
    );
    assert.deepEqual(errors, []);
  });
  test('the sample joins the Library only once it is changed: "Sample", a line under the tabs, nothing kept; looking around is no change', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page, AUTO);
    assert.equal(await status(page), 'Sample');
    assert.equal(await guideName(page), 'Sample jellyfish');
    assert.equal(await saveShown(page), false);
    // (v289) one line at a time: the first-time "Tap a section" first, the sample's line at the next tab
    assert.equal(await page.isVisible('.sfinfo[data-hint="tap"]'), true);
    assert.equal(await page.locator('#sfSampleNote').count(), 0, 'Tap a section first');
    await page.click('.sftabbtn[data-t="pattern"]');
    assert.equal(await page.locator('.sfinfo[data-hint="tap"]').count(), 0);
    assert.match(
      await page.textContent('#sfSampleNote'),
      /^This sample isn’t in your Library yet\. Change anything to keep it\./,
    );
    await page.click('.sftabbtn[data-t="colours"]');
    assert.equal(await page.locator('.sfinfo[data-hint="tap"]').count(), 0, 'gone for good');
    assert.equal((await guides(page)).length, 0, 'not in the Library');
    assert.equal(
      await page.evaluate(() => localStorage.getItem('ms-guide-auto')),
      null,
      'nor kept for Resume',
    );
    // looking around: codes, zoom, tabs, Colour along and back, the menu
    await page.click('#sfCodes');
    await page.click('#sfZin');
    await page.click('.sftabbtn[data-t="share"]');
    await page.click('#sfColor');
    await idle(page);
    await page.click('#sfDoneBtn');
    await idle(page);
    await openMenu(page);
    await page.keyboard.press('Escape');
    await page.evaluate(() => __mstest.flushSave());
    await idle(page, AUTO);
    assert.equal((await guides(page)).length, 0, 'none of that is a change');
    assert.equal(await status(page), 'Sample');
    // the line closes
    await page.click('.sftabbtn[data-t="colours"]');
    await idle(page);
    await page.click('#sfSampleX');
    await idle(page);
    assert.equal(await page.locator('#sfSampleNote').count(), 0);
    // a change keeps it, as "Sample jellyfish"
    await page.click('.sftabbtn[data-t="pattern"]');
    await page.click('#sfFam [data-v="random"]');
    await idle(page, AUTO);
    let gs = await guides(page);
    assert.deepEqual(
      gs.map((x) => x.name),
      ['Sample jellyfish'],
    );
    assert.match(await status(page), /^(Saved in your Library|Saves itself from now on) ✓$/);
    // the sample again: a fresh copy; changed, it's "Sample jellyfish 2"
    await page.evaluate(() => SF.loadSample());
    await page.waitForFunction(() => document.getElementById('sfSaveSt').textContent === 'Sample');
    await idle(page);
    assert.equal((await guides(page)).length, 1);
    await rename(page, 'My jellyfish');
    await idle(page, AUTO);
    assert.deepEqual(
      (await guides(page)).map((x) => x.name).sort(),
      ['My jellyfish', 'Sample jellyfish'],
      'a rename alone keeps it',
    );
    await page.evaluate(() => SF.loadSample());
    await page.waitForFunction(() => document.getElementById('sfSaveSt').textContent === 'Sample');
    await idle(page);
    await page.click('#sfColor');
    await tickInCode(page, 0);
    await idle(page, AUTO);
    assert.ok(
      (await guides(page)).some((x) => x.name === 'Sample jellyfish 2' && x.done === 1),
      'a tick keeps it too, numbered',
    );
    assert.deepEqual(errors, []);
  });
  test('Save a copy makes a second entry, and the open guide becomes the copy', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await saveGuide(page);
    const [orig] = await guides(page);
    await tickInCode(page, 0); // a change not saved yet: it belongs to the original
    await saveCopy(page);
    await idle(page);
    const gs = await guides(page);
    assert.equal(gs.length, 2);
    const copy = gs.find((x) => x.id !== orig.id);
    assert.equal(copy.name, orig.name + ' (2)'); // (v308: “(2)”, as for every name clash; was “(copy)”)
    assert.equal(await page.evaluate(() => __mstest.curId), copy.id, 'the copy is what is open');
    assert.equal(await guideName(page), copy.name);
    assert.match(
      await page.textContent('#msToast'),
      /Saved a copy, “.+ \(2\)”\. You’re now working on the copy/,
    );
    assert.equal((await stored(page, orig.id)).prog, 1, 'the original kept the change made before copying');
    // changes now go into the copy only
    await tickInCode(page, 1);
    await flushSave(page);
    assert.equal((await stored(page, copy.id)).prog, 2);
    assert.equal((await stored(page, orig.id)).prog, 1);
    // a copy of the copy is numbered
    await saveCopy(page);
    await idle(page);
    assert.ok((await guides(page)).some((x) => x.name === orig.name + ' (3)'));
    assert.deepEqual(errors, []);
  });
  test('the Library row shows progress as the open guide saves itself', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await saveGuide(page);
    const [g] = await guides(page);
    await openLibrary(page);
    assert.match(await page.textContent(row(g.id) + ' .smeta'), /not started/);
    // while the Library is showing, the open guide gets ticks and saves itself
    const d = await page.evaluate(() => {
      const t = __mstest,
        N = t.assignData.N;
      let d = 1;
      while (Math.floor((d * 100) / N) < 30) d++;
      t.assignData.order.slice(0, d).forEach((l) => {
        t.colored[l] = 1;
      });
      t.guideDirty = true;
      t.renderGuide();
      return d;
    });
    await flushSave(page);
    assert.match(await page.textContent(row(g.id) + ' .smeta'), new RegExp(`${d} of ${g.n} coloured`));
    assert.deepEqual(errors, []);
  });
  test('a guide whose sections were rebuilt under it is never saved', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await saveGuide(page);
    const [g] = await guides(page),
      before = await stored(page, g.id);
    await answerAsks(page);
    await page.click('#sfBack2');
    await idle(page);
    await page.click('#sfAdjToggle');
    await page.click('#sfRotR');
    await idle(page, 1200);
    assert.equal(await page.evaluate(() => __mstest.currentDesignObj()), null, 'stale');
    await page.evaluate(() => {
      __mstest.guideDirty = true;
      return __mstest.flushSave();
    });
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await idle(page, AUTO);
    const now = await stored(page, g.id);
    assert.equal(now.lmap, before.lmap, 'the saved sections are untouched');
    assert.equal(now.assign, before.assign);
    assert.equal((await guides(page)).length, 1);
    assert.deepEqual(errors, []);
  });
  test('deleting the open guide in the Library stops its auto-save; Undo brings it back and saving carries on', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await saveGuide(page);
    const [g] = await guides(page);
    await openLibrary(page);
    await libItem(page, row(g.id), 'sdel');
    await idle(page);
    // a change while it is deleted: not saved into the Library, nothing brought back
    await tickInCode(page, 0);
    await flushSave(page);
    assert.equal((await guides(page)).length, 0, 'not brought back by an auto-save');
    assert.equal(await page.evaluate(() => __mstest.guideDirty), true);
    assert.equal((await stored(page, g.id)).prog, 0, 'its stored copy (kept for Undo) is untouched');
    // Undo: it is back and the change made meanwhile is saved into it
    await page.click('#toastAct');
    await flushSave(page);
    assert.equal((await guides(page)).length, 1);
    assert.equal((await stored(page, g.id)).prog, 1);
    await page.click('#savedClose');
    await page.click('#mSections');
    await idle(page);
    assert.match(await status(page), /^(Saved in your Library|Saves itself from now on) ✓$/);
    assert.equal(await saveShown(page), false);
    assert.deepEqual(errors, []);
  });
  test('a guide deleted while open (no Undo) stays out of the Library and the slot until Put back, which puts it back as it is now', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await saveGuide(page);
    const [g] = await guides(page);
    await openLibrary(page);
    await libItem(page, row(g.id), 'sdel');
    await idle(page, 6500); // until the 6 s Undo window has run out
    await page.click('#savedClose');
    await page.click('#mSections');
    await idle(page);
    assert.equal(await page.textContent('#sfSave'), 'Put back');
    assert.equal(await status(page), 'Removed from your Library');
    assert.equal(
      await page.evaluate(() => document.getElementById('sfSaveSt').classList.contains('warn')),
      true,
    );
    await tickInCode(page, 0);
    await flushSave(page);
    await idle(page, AUTO);
    assert.equal((await guides(page)).length, 0, 'a change doesn’t bring it back');
    assert.equal(
      await page.evaluate(() => localStorage.getItem('ms-guide-auto')),
      null,
      'nor into the autosave slot',
    );
    // (v318.1: kept a week for Recently deleted, as it was when deleted: the change made meanwhile isn't saved into it)
    assert.equal((await stored(page, g.id)).prog, 0, 'its stored copy as it was when deleted');
    await page.click('#sfSave');
    await idle(page);
    const gs = await guides(page);
    assert.equal(gs.length, 1);
    assert.equal(gs[0].id, g.id, 'put back as the same entry');
    assert.equal((await stored(page, g.id)).prog, 1, 'with the change made meanwhile');
    assert.equal(await saveShown(page), false);
    assert.match(await status(page), /^(Saved in your Library|Saves itself from now on) ✓$/);
    assert.match(await page.textContent('#sfLive'), /Put back in your Library/);
    assert.deepEqual(errors, []);
  });
  test('when storage is full, a failed auto-save says so once and the guide stays open with its changes', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await saveGuide(page);
    const [g] = await guides(page);
    await page.evaluate(() => {
      window.__toasts = [];
      const t = window.toast;
      window.toast = function (m, ms) {
        window.__toasts.push(String(m));
        return t(m, ms);
      };
      window.__put = IDB.put;
      IDB.put = () => Promise.reject(new DOMException('full', 'QuotaExceededError'));
    });
    for (let i = 0; i < 3; i++) {
      await tickInCode(page, i);
      await flushSave(page);
    }
    const full = await page.evaluate(() => window.__toasts.filter((m) => /storage is full/.test(m)).length);
    assert.equal(full, 1, 'one message, not one per try');
    assert.equal(await status(page), 'Not saved — storage is full');
    assert.equal(
      await page.evaluate(() => document.getElementById('sfSaveSt').classList.contains('warn')),
      true,
    );
    assert.equal(await page.evaluate(() => __mstest.guideDirty), true, 'still marked unsaved');
    assert.equal(
      await page.evaluate(() => __mstest.colored.reduce((a, b) => a + b, 0)),
      3,
      'the guide is still open with its ticks',
    );
    assert.equal((await stored(page, g.id)).prog, 0);
    // space again: the next change saves everything
    await page.evaluate(() => {
      IDB.put = window.__put;
    });
    await tickInCode(page, 3);
    await flushSave(page);
    assert.equal((await stored(page, g.id)).prog, 4);
    assert.match(await status(page), /^(Saved in your Library|Saves itself from now on) ✓$/);
    assert.equal(await page.evaluate(() => __mstest.saveErr), false);
    assert.deepEqual(errors, []);
  });
  test('Save puts the guide in the Library and Home counts it', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await saveGuide(page);
    await page.click('#mHome');
    assert.match(await page.textContent('#homeLibSub'), /^1 saved$/);
    assert.ok(await page.isVisible('#sfRecent'));
    await page.click('.sfSeeAll');
    assert.ok(await page.evaluate(() => savedOverlay.classList.contains('on')));
    assert.equal(await page.locator('#savedList .srow').count(), 1);
    assert.deepEqual(errors, []);
  });
  test('colouring the sample keeps it: after a reload it’s in the Library with its ticks', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await page.click('#sfColor');
    const ls = await page.evaluate(() => __mstest.assignData.order.slice(0, 3));
    await scrollTop(page);
    for (const l of ls) {
      const p = await sectionPoint(page, l);
      await page.mouse.click(p.x, p.y);
    }
    assert.match(await toolStatus(page), /^3 of \d+ coloured$/);
    await idle(page, AUTO);
    await page.reload();
    await idle(page);
    const gs = await guides(page);
    assert.equal(gs.length, 1);
    assert.equal(gs[0].done, 3, 'progress kept');
    assert.deepEqual(errors, []);
  });
  // ---- From the second full review ----
  test('a failed auto-save leaves the saved guide exactly as it was', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await saveGuide(page);
    const id = await page.evaluate(() => state.saved.find((s) => s.type === 'guide').id);
    const before = await page.evaluate((id) => IDB.get('guide-' + id).then((p) => p.style.family), id);
    await page.evaluate(() => {
      const o = Storage.prototype.setItem;
      window.__o = o;
      Storage.prototype.setItem = function (k, v) {
        if (k === 'ohuhu-hb320-picker-v3') throw new DOMException('full', 'QuotaExceededError');
        return o.call(this, k, v);
      };
    });
    await page.click('.sftabbtn[data-t="pattern"]');
    await page.click('#sfFam [data-v="random"]');
    await page.evaluate(() => __mstest.flushSave());
    await idle(page);
    await page.evaluate(() => {
      Storage.prototype.setItem = window.__o;
    });
    assert.equal(
      await page.evaluate((id) => IDB.get('guide-' + id).then((p) => p.style.family), id),
      before,
      'stored data rolled back',
    );
    assert.equal(await page.evaluate(() => __mstest.guideDirty), true);
    assert.deepEqual(errors, []);
  });
  test('a first save that fails (storage full) says so once, offers Save, keeps the guide for Resume, and saves once there is room', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await page.evaluate(() => {
      window.__toasts = [];
      const t = window.toast;
      window.toast = function (m, ms) {
        window.__toasts.push(String(m));
        return t(m, ms);
      };
      window.__put = IDB.put;
      IDB.put = function (k, v) {
        return /^guide-\d/.test(k)
          ? Promise.reject(new DOMException('full', 'QuotaExceededError'))
          : window.__put.call(IDB, k, v);
      };
    });
    for (let i = 0; i < 3; i++) {
      await tickN(page, 1, i);
      await flushSave(page);
    }
    assert.equal(
      await page.evaluate(() => window.__toasts.filter((m) => /storage is full/.test(m)).length),
      1,
      'one message',
    );
    assert.match(
      await page.evaluate(() => window.__toasts.find((m) => /storage is full/.test(m))),
      /Share & print › Guide file/,
    );
    assert.equal(await status(page), 'Not saved — storage is full');
    assert.equal(await page.textContent('#sfSave'), 'Save');
    assert.equal((await guidesR4(page)).length, 0);
    assert.equal(
      await page.evaluate(() => IDB.get('guide-autosave').then((d) => ((d && d.payload.prog) || []).length)),
      3,
      'kept for Resume meanwhile',
    );
    // room again: the next change (or Save) puts it in the Library
    await page.evaluate(() => {
      IDB.put = window.__put;
    });
    await page.click('#sfSave');
    await idle(page);
    const gs = await guidesR4(page);
    assert.equal(gs.length, 1);
    assert.equal((await storedR4(page, gs[0].id)).prog, 3);
    assert.match(await status(page), /^(Saved in your Library|Saves itself from now on) ✓$/);
    assert.deepEqual(errors, []);
  });
  test('a first save that fails is waited for and tried again before anything else opens', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await tickN(page, 3);
    // the first Library write fails (slowly)
    await page.evaluate(() => {
      const o = IDB.put;
      let n = 0;
      IDB.put = function (k, v) {
        if (/^guide-\d/.test(k) && !n++)
          return new Promise((_, rej) => setTimeout(() => rej(new Error('full')), 400));
        return o.call(IDB, k, v);
      };
    });
    await page.evaluate(() => {
      __mstest.flushSave();
      SF.loadSample();
    });
    await idle(page, 2500);
    const gs = await guidesR4(page);
    assert.equal(gs.length, 1, 'the guide went into the Library before the sample opened');
    assert.equal((await storedR4(page, gs[0].id)).prog, 3);
    assert.deepEqual(errors, []);
  });
}

// ---- from guide-files.test.mjs ----
// Opening guide files (Library › Import a guide): a broken file, a map that doesn't decode or is too big, a guide
// with too many sections, or a backup instead of a guide is turned away before anything is added.
{
  // ---- From the fourth review (data safety) ----
  const guides = (page) =>
    page.evaluate(() =>
      state.saved
        .filter((s) => s.type === 'guide')
        .map((s) => ({ id: s.id, name: s.name, thumb: s.thumb, W: s.W, H: s.H })),
    );
  // ---- From the fourth review (outside the guide screen) ----
  const KEY = 'ohuhu-hb320-picker-v3';
  const onboarded = (extra = {}) => ({
    'ms-onboarded': '1',
    'ms-setup-tip': '1',
    'ms-last-ver': 'v263',
    ...extra,
  });
  const OWN = [
    'Ohuhu|R014',
    'Ohuhu|Y111',
    'Ohuhu|B08',
    'Ohuhu|G36',
    'Ohuhu|BV310',
    'Ohuhu|YR313',
    'Ohuhu|RV08',
    'Ohuhu|BG311',
  ];
  const appState = (extra = {}) =>
    JSON.stringify({
      mode: 'home',
      ownedSeedV: 2,
      copicAdd1: 1,
      libAdj1: 1,
      setFix1: 1,
      owned: OWN,
      saved: [],
      ...extra,
    });
  // ---- From the fifth review (data safety) ----
  // Save (a new guide into the Library), done once the header says so
  const saveNew = (page) => saveGuide(page);
  const savedId = (page) => page.evaluate(() => state.saved.find((s) => s.type === 'guide').id);
  const guidesR5 = (page) =>
    page.evaluate(() =>
      state.saved.filter((s) => s.type === 'guide').map((s) => ({ id: s.id, name: s.name, thumb: s.thumb })),
    );
  // a guide whose section map has a different section on every pixel
  const hostile = (page, w) =>
    page.evaluate((w) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = w;
      const g = c.getContext('2d'),
        im = g.createImageData(w, w);
      for (let i = 0; i < w * w; i++) {
        const v = i + 1;
        im.data[i * 4] = v & 255;
        im.data[i * 4 + 1] = (v >> 8) & 255;
        im.data[i * 4 + 2] = (v >> 16) & 255;
        im.data[i * 4 + 3] = 255;
      }
      g.putImageData(im, 0, 0);
      return {
        v: 1,
        type: 'guide',
        name: 'Hostile',
        W: w,
        H: w,
        keys: [],
        payload: { lmap: c.toDataURL('image/png'), assign: {} },
      };
    }, w);
  // ---- From the third full review (v259) ----
  test('a broken guide file is refused before anything is added to the Library', async () => {
    const { page, errors } = await openApp();
    await welcome(page, 'look');
    const [fc] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.evaluate(() => {
        const i = document.createElement('input');
        i.type = 'file';
        i.onchange = () => SF.importFile(i.files[0]);
        document.body.appendChild(i);
        i.click();
      }),
    ]);
    await fc.setFiles({
      name: 'broken.msguide.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({ name: 'Broken', payload: { lmap: 'hello' } })),
    });
    await idle(page);
    assert.equal(await page.evaluate(() => state.saved.filter((s) => s.name === 'Broken').length), 0);
    assert.deepEqual(errors, []);
  });
  test('imports: a map that doesn’t decode or is too big adds nothing; odd settings are kept in range', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    const good = await page.evaluate(() => __mstest.currentDesignObj());
    const imp = (d, name) =>
      page.evaluate(
        ([d, name]) => {
          const f = new File([JSON.stringify(d)], name + '.msguide.json', { type: 'application/json' });
          SF.importFile(f);
        },
        [d, name],
      );
    const n0 = (await guides(page)).length;
    await imp(
      { ...good, payload: { ...good.payload, lmap: 'data:image/png;base64,' + 'A'.repeat(64) } },
      'bad',
    );
    await idle(page);
    const big = await page.evaluate(() => {
      const c = document.createElement('canvas');
      c.width = 4801;
      c.height = 8;
      return c.toDataURL('image/png');
    });
    await imp({ ...good, payload: { ...good.payload, lmap: big } }, 'big');
    await idle(page);
    assert.equal((await guides(page)).length, n0, 'nothing added');
    await imp(
      {
        ...good,
        name: 'Odd',
        W: 99999,
        H: -3,
        payload: {
          ...good.payload,
          style: { ...good.payload.style, limitN: 1e9, blendFall: 'abc', texAmt: -5, dir: 7 },
        },
      },
      'odd',
    );
    await page.waitForFunction(() => __mstest.curName === 'Odd' && __mstest.assignData, null, {
      timeout: 10000,
    });
    await idle(page);
    const g = (await guides(page)).find((x) => x.name === 'Odd');
    assert.deepEqual(
      [g.W, g.H],
      await page.evaluate(() => [__mstest.W, __mstest.H]),
      'the size is the map’s',
    );
    const st = await page.evaluate(() => __mstest.currentDesignObj().payload.style);
    assert.ok(st.limitN >= 2 && st.limitN <= 999);
    assert.equal(st.blendFall, 2);
    assert.equal(st.texAmt, 0);
    assert.equal(st.dir, 1);
    assert.deepEqual(errors, []);
  });
  test('Library › Import a guide: a wrong file is said once, compactly; a backup is offered as a restore', async () => {
    const { page, errors } = await openApp({ storage: onboarded({ [KEY]: appState() }) });
    await page.click('#homeLibCard');
    await page.setInputFiles('#homeImpFile', {
      name: 'x.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{"hello":1}'),
    });
    await idle(page);
    assert.equal(await page.locator('.mserr').count(), 1, 'said once');
    assert.ok((await page.locator('.mserr').boundingBox()).height < 90, 'compact');
    assert.ok(await page.isVisible('#savedOverlay'), 'the Library stays open');
    await answerAsks(page, false);
    await page.setInputFiles('#homeImpFile', {
      name: 'b.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({ v: 3, type: 'ms-backup', owned: [], saved: [], guides: [] })),
    });
    await idle(page);
    assert.match((await asked(page))[0] || '', /This file is a Marker Studio backup.*Restore it\?/);
    assert.deepEqual(errors, []);
  });
  test('a guide file with too many sections is turned away on import and from the Library, without a crash', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await saveNew(page);
    const id = await savedId(page),
      d = await hostile(page, 1200);
    await page.evaluate(
      (d) => SF.importFile(new File([JSON.stringify(d)], 'x.msguide.json', { type: 'application/json' })),
      d,
    );
    await page.waitForFunction(() => /too many sections/.test(document.body.textContent), null, {
      timeout: 15000,
    });
    assert.equal((await guidesR5(page)).length, 1, 'not added to the Library');
    // one that got into the Library some other way
    const hid = await page.evaluate(
      (d) => sfSaveDesign({ name: d.name, W: d.W, H: d.H, keys: [], n: 0, payload: d.payload }),
      d,
    );
    await page.evaluate(() => document.querySelectorAll('.mserr').forEach((e) => e.remove()));
    await page.evaluate((hid) => loadGuide({ id: hid }), hid);
    await page.waitForFunction(() => /too many sections/.test(document.body.textContent), null, {
      timeout: 15000,
    });
    assert.equal(await page.evaluate(() => __mstest.curId), id, 'the open guide stays open');
    assert.ok(await page.evaluate(() => !!__mstest.assignData));
    assert.deepEqual(errors, []);
  });
}

// ---- from library.test.mjs ----
// The Library (from UX release 2, part A). A whole row opens its item, the pencil renames in place, names show on two
// lines, the line under a name says what it is (and how much of a guide is coloured), new palettes get names from
// their colours, the list uses the dialog's full height, delete by keyboard, and the Library picture.
{
  const libOpen = (page) => page.evaluate(() => savedOverlay.classList.contains('on'));
  async function openLibrary(page) {
    await page.click('#mHome');
    await page.click('#homeLibCard');
    await idle(page);
    assert.ok(await libOpen(page), 'the Library is open');
  }
  // a palette straight into the Library (no generated name), for tests about rows rather than names
  function addPalette(page, name, idxs = [11, 120, 280], ts = Date.now()) {
    return page.evaluate(
      ({ name, idxs, ts }) => {
        const id = Date.now() + Math.floor(Math.random() * 1e6);
        state.saved.unshift({ id, type: 'palette', name, keys: idxs.map(mkey), ts });
        save();
        return id;
      },
      { name, idxs, ts },
    );
  }
  async function savedGuide(page) {
    await sampleGuide(page);
    await saveGuide(page);
    await idle(page);
    return page.evaluate(() => state.saved.find((s) => s.type === 'guide').id);
  }
  const row = (page, id) => `#savedList .srow[data-id="${id}"]`;
  const nameOf = (page, id) => page.evaluate((id) => state.saved.find((s) => s.id === id).name, id);
  // ---- From the fourth review (data safety) ----
  // Save (a new guide into the Library), done once the header says so
  const saveNew = (page) => saveGuide(page);
  const guides = (page) =>
    page.evaluate(() =>
      state.saved
        .filter((s) => s.type === 'guide')
        .map((s) => ({ id: s.id, name: s.name, thumb: s.thumb, W: s.W, H: s.H })),
    );
  // ---- From the fourth review (outside the guide screen) ----
  const KEY = 'ohuhu-hb320-picker-v3';
  const onboarded = (extra = {}) => ({
    'ms-onboarded': '1',
    'ms-setup-tip': '1',
    'ms-last-ver': 'v263',
    ...extra,
  });
  const OWN = [
    'Ohuhu|R014',
    'Ohuhu|Y111',
    'Ohuhu|B08',
    'Ohuhu|G36',
    'Ohuhu|BV310',
    'Ohuhu|YR313',
    'Ohuhu|RV08',
    'Ohuhu|BG311',
  ];
  const appState = (extra = {}) =>
    JSON.stringify({
      mode: 'home',
      ownedSeedV: 2,
      copicAdd1: 1,
      libAdj1: 1,
      setFix1: 1,
      owned: OWN,
      saved: [],
      ...extra,
    });
  const pal = (keys, id, name) => ({ id, type: 'palette', name: name || 'Pal ' + id, keys, ts: id });
  // (v288) by keyboard: ⋯ opens its menu at Rename, Down to Delete
  async function kbDel(page, id) {
    await page.focus(`#savedList .srow[data-id="${id}"] .smore`);
    await page.keyboard.press('Enter');
    assert.equal(
      await page.evaluate(() => document.activeElement.className),
      'sren',
      'the menu opens at its first item',
    );
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await idle(page);
  }
  // ---- From the fifth review (data safety) ----
  const AUTO = 2300;
  // idle(page, AUTO): until auto-save (1.5 s after the last change) has run
  const guidesR5 = (page) =>
    page.evaluate(() =>
      state.saved.filter((s) => s.type === 'guide').map((s) => ({ id: s.id, name: s.name, thumb: s.thumb })),
    );
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
  test('tapping a palette row’s name opens the palette and closes the Library', async () => {
    const { page, errors } = await openApp();
    await welcome(page, 'look');
    const id = await addPalette(page, 'Row test');
    await openLibrary(page);
    await page.click(row(page, id) + ' .sname');
    await idle(page);
    assert.equal(await libOpen(page), false, 'the Library closed');
    assert.equal(await page.evaluate(() => state.mode), 'palette');
    assert.deepEqual(await page.evaluate(() => state.customPal.slice(0, 3)), [11, 120, 280]);
    assert.equal(await page.locator('#savedList .savename').count(), 0, 'no name input in the rows');
    assert.deepEqual(errors, []);
  });
  test('tapping a guide row opens the guide', async () => {
    const { page, errors } = await openApp();
    const id = await savedGuide(page);
    await page.evaluate(() => SF.loadSample());
    await idle(page, 1500);
    await openLibrary(page);
    await page.click(row(page, id) + ' .smeta');
    await page.waitForFunction((id) => __mstest.curId === id && !!__mstest.assignData, id, {
      timeout: 10000,
    });
    assert.equal(await libOpen(page), false);
    assert.equal(await page.evaluate(() => state.mode), 'sections');
    assert.deepEqual(errors, []);
  });
  test('the pencil renames in place: Enter keeps, Escape cancels, leaving the field keeps, an empty name keeps the old one', async () => {
    const { page, errors } = await openApp();
    const id = await savedGuide(page);
    const first = await nameOf(page, id);
    await openLibrary(page);
    assert.equal(await page.getAttribute(row(page, id) + ' .sren', 'aria-label'), 'Rename ' + first);

    // pencil -> a focused input holding the name
    await libItem(page, row(page, id), 'sren');
    const inp = row(page, id) + ' .sname-in';
    assert.ok(
      await page.evaluate((s) => document.activeElement === document.querySelector(s), inp),
      'the input is focused',
    );
    assert.equal(await page.inputValue(inp), first);
    assert.equal(
      await page.locator(row(page, id) + ' button.sopen').count(),
      0,
      'no button around the input',
    );

    // Enter saves; nothing opens, the Library stays, Home shows the new name
    await page.fill(inp, 'Harbour Lights');
    await page.keyboard.press('Enter');
    await idle(page);
    assert.equal(await nameOf(page, id), 'Harbour Lights');
    assert.ok(await libOpen(page), 'Enter keeps the Library open');
    assert.equal(await page.evaluate(() => state.mode), 'home', 'nothing was loaded');
    assert.equal(await page.textContent(row(page, id) + ' .sname'), 'Harbour Lights');
    assert.match(await page.textContent('#sfRecent'), /Harbour Lights/);
    assert.ok(
      await page.evaluate(() => document.activeElement.classList.contains('smore')),
      'focus goes back to its ⋯ (v288)',
    );

    // Escape cancels and leaves the Library open
    await libItem(page, row(page, id), 'sren');
    await page.fill(inp, 'Not this');
    await page.keyboard.press('Escape');
    await idle(page);
    assert.ok(await libOpen(page), 'Escape only cancels the rename');
    assert.equal(await nameOf(page, id), 'Harbour Lights');
    assert.equal(await page.textContent(row(page, id) + ' .sname'), 'Harbour Lights');

    // leaving the field saves
    await libItem(page, row(page, id), 'sren');
    await page.fill(inp, 'Tidal Glow');
    await page.click('#libTitle');
    await idle(page);
    assert.equal(await nameOf(page, id), 'Tidal Glow');
    assert.equal(await page.locator('#savedList .sname-in').count(), 0);
    assert.equal(
      await page.locator('#savedList .srow').count(),
      1,
      'the blur and the redraw save once, no duplicate row',
    );

    // an empty name keeps the old one
    await libItem(page, row(page, id), 'sren');
    await page.fill(inp, '   ');
    await page.keyboard.press('Enter');
    await idle(page);
    assert.equal(await nameOf(page, id), 'Tidal Glow');
    assert.equal(
      await page.evaluate(() => JSON.parse(localStorage.getItem('ohuhu-hb320-picker-v3')).saved[0].name),
      'Tidal Glow',
      'the rename is stored',
    );
    assert.deepEqual(errors, []);
  });
  test('a long name shows in full on at most three lines on a 390 px tile (v288)', async () => {
    const { page, errors } = await openApp({ width: 390, height: 844 });
    await welcome(page, 'look');
    const long = 'Smoldering Garnet and Midnight Velvet Tryst!';
    assert.equal(long.length, 44);
    const id = await addPalette(page, long);
    await openLibrary(page);
    const m = await page.evaluate(
      (s) => {
        const n = document.querySelector(s);
        const r = n.getBoundingClientRect(),
          lh = parseFloat(getComputedStyle(n).lineHeight);
        return {
          w: r.width,
          lines: Math.round(n.scrollHeight / lh),
          clipped: n.scrollHeight > n.clientHeight + 1,
          text: n.textContent,
        };
      },
      row(page, id) + ' .sname',
    );
    assert.equal(m.text, long);
    assert.ok(m.w >= 140, 'the name box is at least 140 px wide: ' + m.w);
    assert.ok(m.lines <= 3, 'three lines at most: ' + m.lines);
    assert.ok(!m.clipped, 'nothing is cut off');
    assert.deepEqual(errors, []);
  });
  test('the line under a name: type, markers, when (Home’s words: yesterday, then the date); no type badge', async () => {
    const { page, errors } = await openApp();
    await welcome(page, 'look');
    const ts = Date.now() - 20 * 86400000;
    const pid = await addPalette(page, 'Meta palette', [11, 120, 280, 300, 12], ts);
    const did = await page.evaluate((ts) => {
      const id = 777001;
      state.saved.unshift({ id, type: 'draw', name: 'Draw · Sep 27', keys: [mkey(11)], ts, st: {} });
      save();
      return id;
    }, ts);
    await openLibrary(page);
    const when = await page.evaluate((ts) => evoWhen(ts), ts);
    assert.equal(await page.textContent(row(page, pid) + ' .smeta'), 'Palette · 5 markers · ' + when);
    assert.equal(await page.textContent(row(page, did) + ' .smeta'), 'Random draw · 1 marker · ' + when);
    assert.equal(await page.locator('#savedList .sbadge').count(), 0);
    // (v289) within the week, as Home says it
    await page.evaluate((id) => {
      state.saved.find((s) => s.id === id).ts = Date.now() - 86400000 - 3600000;
      renderSaved();
    }, pid);
    assert.equal(await page.textContent(row(page, pid) + ' .smeta'), 'Palette · 5 markers · yesterday');
    assert.deepEqual(errors, []);
  });
  test('a guide with about 40% of its sections ticked shows how much is coloured', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    const { N, d } = await page.evaluate(() => {
      const t = __mstest,
        N = t.assignData.N;
      let d = 1;
      while (Math.floor((d * 100) / N) < 40) d++;
      t.assignData.order.slice(0, d).forEach((l) => {
        t.colored[l] = 1;
      });
      t.guideDirty = true;
      return { N, d };
    });
    await saveGuide(page);
    await idle(page);
    const g = await page.evaluate(() => state.saved.find((s) => s.type === 'guide'));
    assert.equal(g.done, d);
    assert.equal(g.n, N);
    await openLibrary(page);
    const meta = await page.textContent(`#savedList .srow[data-id="${g.id}"] .smeta`);
    // (v320: a guide's kind isn't said, its grid is; a ring on its cover says how far too)
    assert.match(meta, new RegExp(`^${g.keys.length} markers? · ${d} of ${N} coloured · today$`));
    assert.ok(
      await page.isVisible(`#savedList .srow[data-id="${g.id}"] .sring:not(.done)`),
      'the ring part-way',
    );
    // untouched guide: "not started", as on Home (v289)
    await page.evaluate((id) => {
      state.saved.find((s) => s.id === id).done = 0;
      renderSaved();
    }, g.id);
    assert.match(
      await page.textContent(`#savedList .srow[data-id="${g.id}"] .smeta`),
      /^\d+ markers? · not started · today$/,
    );
    assert.equal(await page.locator(`#savedList .srow[data-id="${g.id}"] .sring`).count(), 0, 'no ring');
    assert.deepEqual(errors, []);
  });
  test('a guide saved without a coloured count gets one when the Library opens', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await page.evaluate(() => {
      const t = __mstest;
      t.assignData.order.slice(0, 3).forEach((l) => {
        t.colored[l] = 1;
      });
      t.guideDirty = true;
    });
    await saveGuide(page);
    await idle(page);
    const id = await page.evaluate(() => {
      const g = state.saved.find((s) => s.type === 'guide');
      delete g.done;
      save();
      return g.id;
    });
    await page.reload();
    await idle(page);
    assert.equal(await page.evaluate((id) => 'done' in state.saved.find((s) => s.id === id), id), false);
    await openLibrary(page);
    await page.waitForFunction(
      (id) =>
        / of \d+ coloured/.test(
          document.querySelector(`#savedList .srow[data-id="${id}"] .smeta`).textContent,
        ),
      id,
      { timeout: 5000 },
    );
    assert.equal(await page.evaluate((id) => state.saved.find((s) => s.id === id).done, id), 3);
    assert.equal(
      await page.evaluate(
        (id) => JSON.parse(localStorage.getItem('ohuhu-hb320-picker-v3')).saved.find((s) => s.id === id).done,
        id,
      ),
      3,
      'and it is stored',
    );
    assert.deepEqual(errors, []);
  });
  test('new palettes are named from their colours, never twice the same; old names stay', async () => {
    const { page, errors } = await openApp();
    await welcome(page, 'look');
    await page.evaluate(() => {
      state.saved.push({
        id: 5,
        type: 'palette',
        name: 'Complementary · Sep 3',
        keys: [mkey(11), mkey(120)],
        ts: 5,
      });
      save();
    });
    await page.click('#mPalette');
    await idle(page);
    await page.click('#draw');
    await idle(page, 1300);
    const expected = await page.evaluate(() => paletteName(currentPaletteIdxs()));
    await page.click('#saveBtn');
    await idle(page, 1300);
    const n1 = await page.evaluate(() => state.saved[0].name);
    assert.equal(n1, expected);
    assert.doesNotMatch(n1, /·|\d/, 'no date in the name: ' + n1);
    assert.notEqual(n1, 'Palette');
    await page.click('#saveBtn');
    await idle(page);
    const n2 = await page.evaluate(() => state.saved[0].name);
    assert.notEqual(
      n2.toLowerCase(),
      n1.toLowerCase(),
      'the second save of the same palette gets another name',
    );
    await page.reload();
    await idle(page);
    assert.equal(
      await page.evaluate(() => state.saved.find((s) => s.id === 5).name),
      'Complementary · Sep 3',
      'an existing name is never changed',
    );
    assert.deepEqual(errors, []);
  });
  // v288: the Library fills the screen and scrolls as one page (the heading pinned): tiles first, Import and Back up after
  test('with 20 items the Library is a grid filling the screen, scrolling as one page with its heading pinned; Back up after the last tile', async () => {
    const { page, errors } = await openApp({ width: 390, height: 844 });
    await welcome(page, 'look');
    await page.evaluate(() => {
      for (let i = 0; i < 20; i++)
        state.saved.push({
          id: 1000 + i,
          type: 'palette',
          name: 'Palette number ' + i,
          keys: [mkey(i), mkey(i + 40), mkey(i + 90)],
          ts: Date.now() - i * 1000,
        });
      save();
    });
    await openLibrary(page);
    const m = await page.evaluate(() => {
      const c = document.querySelector('#savedOverlay .dcard'),
        cr = c.getBoundingClientRect(),
        rows = [...document.querySelectorAll('#savedList .srow')];
      const cols = new Set(rows.map((r) => Math.round(r.getBoundingClientRect().left))).size;
      c.scrollTop = c.scrollHeight;
      const last = rows[rows.length - 1].getBoundingClientRect(),
        bk = document.getElementById('guidesBackup').getBoundingClientRect(),
        hd = document.getElementById('libTitle').getBoundingClientRect();
      return {
        w: cr.width,
        h: cr.height,
        vw: innerWidth,
        vh: innerHeight,
        rows: rows.length,
        cols,
        scrolls: c.scrollHeight > c.clientHeight,
        after: bk.top > last.bottom,
        head: hd.top,
        bkIn: bk.bottom <= innerHeight,
      };
    });
    assert.equal(m.rows, 20);
    assert.equal(m.cols, 2, 'two columns on a phone');
    assert.ok(m.w >= m.vw - 1 && m.h >= m.vh - 1, 'the whole screen');
    assert.ok(m.scrolls, 'it scrolls');
    assert.ok(m.after && m.bkIn, 'Back up after the last tile, reached at the end');
    assert.ok(m.head >= 0 && m.head <= 40, 'the heading stays at the top: ' + m.head);
    assert.deepEqual(errors, []);
  });
  test('keyboard: Tab to a row and Enter opens it', async () => {
    const { page, errors } = await openApp();
    await welcome(page, 'look');
    const id = await addPalette(page, 'Keyboard palette');
    await openLibrary(page);
    await page.focus('#libSort');
    for (let i = 0; i < 6; i++) {
      if (await page.evaluate(() => document.activeElement.classList.contains('sopen'))) break;
      await page.keyboard.press('Tab');
    }
    assert.ok(
      await page.evaluate((id) => document.activeElement.matches(`.srow[data-id="${id}"] button.sopen`), id),
      'the row’s open button has focus',
    );
    assert.match(await page.evaluate(() => document.activeElement.textContent), /Keyboard palette/);
    await page.keyboard.press('Enter');
    await idle(page);
    assert.equal(await libOpen(page), false);
    assert.equal(await page.evaluate(() => state.mode), 'palette');
    assert.equal(
      await page.locator('#savedList [role="button"]').count(),
      0,
      'no role=button stand-ins left',
    );
    assert.deepEqual(errors, []);
  });
  test('renaming the open guide in the Library survives its next auto-save', async () => {
    const { page, errors } = await openApp();
    const id = await savedGuide(page);
    await openLibrary(page);
    await libItem(page, row(page, id), 'sren');
    await page.fill(row(page, id) + ' .sname-in', 'Renamed While Open');
    await page.keyboard.press('Enter');
    await idle(page);
    await page.click('#savedClose');
    await page.click('#mSections');
    await idle(page);
    assert.equal(await guideName(page), 'Renamed While Open');
    await page.evaluate(() => {
      __mstest.colored[__mstest.assignData.order[0]] = 1;
      __mstest.guideDirty = true;
    });
    await page.evaluate(() => __mstest.flushSave());
    await idle(page);
    assert.equal(await nameOf(page, id), 'Renamed While Open');
    assert.equal(
      await page.evaluate((id) => state.saved.find((s) => s.id === id).done, id),
      1,
      'the change was saved',
    );
    assert.deepEqual(errors, []);
  });
  test('delete is one tap with Undo, and the bin never opens the item', async () => {
    const { page, errors } = await openApp();
    await welcome(page, 'look');
    const keep = await addPalette(page, 'Keep me');
    const id = await addPalette(page, 'Delete me', [30, 31, 32]);
    await openLibrary(page);
    const del = row(page, id) + ' .sdel';
    assert.equal(await page.getAttribute(del, 'aria-label'), 'Delete Delete me');
    // (v288) in the tile's ⋯ menu: a bin and the word, not the ✕ every dialog's Close uses, a full 44px to tap
    assert.equal(await page.getAttribute(row(page, id) + ' .smore', 'aria-label'), 'More: Delete me');
    await page.click(row(page, id) + ' .smore');
    assert.equal(await page.getAttribute(row(page, id) + ' .smore', 'aria-expanded'), 'true');
    assert.equal((await page.textContent(del)).trim(), 'Delete');
    assert.equal(await page.locator(del + ' svg').count(), 1, 'an inline bin icon');
    const box = await page.locator(del).boundingBox();
    assert.ok(box.width >= 44 && box.height >= 44, 'tap target ' + box.width + '×' + box.height);
    await page.click(del);
    await idle(page);
    assert.ok(await libOpen(page), 'the Library stays open');
    assert.equal(await page.evaluate(() => state.mode), 'home', 'nothing was loaded');
    assert.deepEqual(await page.evaluate(() => state.saved.map((s) => s.id)), [keep]);
    assert.equal(await page.locator('#savedList .srow').count(), 1);
    assert.match(await page.textContent('#msToast'), /Deleted “Delete me”/);
    await page.click('#toastAct');
    await idle(page);
    assert.deepEqual(
      await page.evaluate(() => state.saved.map((s) => s.id)).then((a) => a.sort()),
      [keep, id].sort(),
      'Undo puts it back',
    );
    assert.equal(await page.locator('#savedList .srow').count(), 2);
    assert.deepEqual(errors, []);
  });
  test('the Library picture is not replaced by the sections editor’s tints', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await saveNew(page);
    const t0 = (await guides(page))[0].thumb;
    assert.ok(t0);
    await page.click('#sfBack2');
    await idle(page);
    await page.evaluate(() => {
      const t = __mstest,
        l = t.assignData.order[3];
      t.secState[l] = 2;
      t.guideDirty = true;
      t.render();
    });
    // (opening something else asks about the section edits first: discarded here)
    await page.evaluate(() => SF.loadSample());
    await page.click('#sfEdAsk [data-a="discard"]');
    await page.waitForFunction(() => __mstest.assignData && __mstest.curId == null);
    await idle(page);
    assert.equal((await guides(page))[0].thumb, t0);
    assert.deepEqual(errors, []);
  });
  test('Library delete by keyboard: focus moves to the next row, Tab reaches Undo, Undo puts focus back', async () => {
    const { page, errors } = await openApp({
      storage: onboarded({
        [KEY]: appState({
          saved: [
            pal(['Ohuhu|R014'], 3, 'Three'),
            pal(['Ohuhu|Y111'], 2, 'Two'),
            pal(['Ohuhu|B08'], 1, 'One'),
          ],
        }),
      }),
    });
    await page.click('#homeLibCard');
    await page.waitForSelector('#savedOverlay.on');
    await kbDel(page, 3);
    assert.equal(
      await page.evaluate(
        () => document.activeElement.closest('.srow') && document.activeElement.closest('.srow').dataset.id,
      ),
      '2',
      'on the next tile’s ⋯',
    );
    assert.equal(await page.evaluate(() => document.activeElement.className), 'smore');
    // Tab from the dialog's last control goes to the toast's Undo
    await page.focus('#libBkText');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'toastAct');
    await page.keyboard.press('Enter');
    await idle(page);
    assert.equal(await page.evaluate(() => state.saved.some((s) => s.id === 3)), true);
    assert.equal(
      await page.evaluate(
        () => document.activeElement.closest('.srow') && document.activeElement.closest('.srow').dataset.id,
      ),
      '3',
      'back on the restored row',
    );
    // deleting the last row lands on the one before; the last of all on the list
    for (const id of [1, 2, 3]) await kbDel(page, id);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'savedList');
    assert.deepEqual(errors, []);
  });
  test('Colour along with a marker highlighted leaves the Library picture as it was', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await saveNew(page);
    const th0 = (await guidesR5(page))[0].thumb;
    assert.ok(th0);
    await page.click('#sfColor');
    await idle(page);
    await scrollTop(page);
    await page.locator('#sfAlist .sfarow .sfah').nth(0).click();
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.makeThumb()), '', 'no picture from the highlight view');
    await tickN(page, 2);
    await idle(page, AUTO);
    assert.equal((await guidesR5(page))[0].thumb, th0);
    assert.deepEqual(errors, []);
  });
}

// ---- from lost-guides.test.mjs ----
// Lost guides (from v267): guides stored on this device but missing from the Library are found and offered back (on
// Home at start, in the unreadable-data note when that is about guides, and from Help › Your data).
{
  // ---- From v267 ----
  const KEY = 'ohuhu-hb320-picker-v3';
  const DAY = 864e5;
  const OWN = ['Ohuhu|R014', 'Ohuhu|Y111', 'Ohuhu|B08'];
  const appState = (extra = {}) =>
    JSON.stringify({
      mode: 'home',
      ownedSeedV: 2,
      copicAdd1: 1,
      libAdj1: 1,
      setFix1: 1,
      owned: OWN,
      saved: [],
      ...extra,
    });
  const onboarded = (extra = {}) => ({ 'ms-onboarded': '1', 'ms-setup-tip': '1', ...extra });
  const shown = (page, id) =>
    page.evaluate((id) => {
      const e = document.getElementById(id);
      return !!e && e.style.display !== 'none' && e.getClientRects().length > 0;
    }, id);
  const toastText = (page) =>
    page.evaluate(() => {
      const t = document.getElementById('msToast');
      return t && t.classList.contains('on') ? t.textContent : '';
    });
  const top = (page, sel) => page.evaluate((s) => document.querySelector(s).getBoundingClientRect().top, sel);
  const SHOTS = ARTIFACTS;
  // screenshots for a person to look at, with the other tests' (not checked in)
  const snap = async (page, name) => {
    await mkdir(SHOTS, { recursive: true });
    await page.screenshot({ path: `${SHOTS}/b-${name}.png` });
  };
  // --- lost guides ---
  // a tiny label map is enough for a guide to be read back
  const PNG =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const payload = (extra = {}) => ({ lmap: PNG, assign: { 0: 'Ohuhu|R014' }, prog: [], ...extra });
  const T0 = Date.now() - 10 * DAY;
  const ORPHAN = T0 + 1,
    NAMED = T0 + 2,
    PENDING = T0 + 3,
    KEPT = T0 + 4;
  const kept = { id: KEPT, type: 'guide', name: 'Kept', ts: T0, keys: ['Ohuhu|R014'], W: 1, H: 1, n: 1 };
  // write stored guides straight into IndexedDB (as an earlier visit would have), then start again
  async function seed(page, guides, extra = {}) {
    await page.evaluate(
      async ({ guides, extra }) => {
        for (const [k, v] of Object.entries(guides)) await IDB.put(k, v);
        for (const [k, v] of Object.entries(extra)) localStorage.setItem(k, v);
      },
      { guides, extra },
    );
    await page.reload();
  }
  const lostCard = (page) => page.waitForSelector('#lostNote', { state: 'visible' });
  const noLostCard = async (page) => {
    await idle(page, 2600);
    return !(await shown(page, 'lostNote'));
  };
  test('lost guides: found at start (not the Resume slot, a delete still finishing or what’s in the Library), and added back', async () => {
    const { page, errors } = await openApp({
      storage: onboarded({ [KEY]: appState({ saved: [kept] }), 'ms-seen-hints': '["along"]' }),
    });
    await seed(
      page,
      {
        ['guide-' + ORPHAN]: payload(),
        ['guide-' + NAMED]: payload({ name: 'Owl', prog: [0] }),
        ['guide-' + PENDING]: payload({ name: 'Deleted' }),
        ['guide-' + KEPT]: payload(),
        'guide-autosave': { name: 'Slot', W: 1, H: 1, keys: [], payload: payload() },
      },
      { 'ms-lib-deleting': JSON.stringify([{ id: PENDING, t: Date.now(), tab: 'another-tab' }]) },
    );
    await lostCard(page);
    assert.equal(
      (await page.textContent('#lostNote .ntxt')).trim(),
      'Found 2 guides that aren’t in your Library. They’re still stored on this device.',
    );
    assert.equal(await shown(page, 'loadNote'), false);
    // above the tiles, under Resume and the unreadable-data note's place, not one of the cards under the tiles
    assert.ok((await top(page, '#loadNote')) <= (await top(page, '#lostNote')));
    assert.ok((await top(page, '#lostNote')) < (await top(page, '#homeNew')));
    await snap(page, 'lost-card');

    await page.click('#lostAdd');
    await page.waitForSelector('#lostNote', { state: 'hidden' });
    assert.equal(await toastText(page), 'Added 2 guides back to your Library');
    const got = await page.evaluate(() =>
      state.saved
        .filter((s) => s.type === 'guide')
        .map((s) => ({ id: s.id, name: s.name, W: s.W, H: s.H, keys: s.keys, n: s.n, bk: s.bk || 0 })),
    );
    assert.deepEqual(got.map((g) => g.name).sort(), ['Kept', 'Owl', 'Recovered guide']);
    const owl = got.find((g) => g.name === 'Owl');
    assert.deepEqual(
      { id: owl.id, W: owl.W, H: owl.H, keys: owl.keys, n: owl.n, bk: owl.bk },
      { id: NAMED, W: 1, H: 1, keys: ['Ohuhu|R014'], n: 1, bk: 0 },
    );
    assert.equal(got.find((g) => g.name === 'Recovered guide').id, ORPHAN);
    assert.equal(
      await page.evaluate((id) => state.saved.find((s) => s.id === id).done, NAMED),
      1,
      'progress from the guide',
    );
    // not backed up: the backup reminder counts them
    assert.equal(await page.evaluate(() => guidesAtRisk()), 3);
    // a picture drawn from each
    await page.waitForFunction(
      ({ a, b }) =>
        [a, b].every((id) =>
          /^data:image\/jpeg;base64,/.test((state.saved.find((s) => s.id === id) || {}).thumb || ''),
        ),
      { a: ORPHAN, b: NAMED },
    );
    // kept, in the Library and on Home, and not offered again
    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('ohuhu-hb320-picker-v3')).saved.map((s) => s.name),
    );
    assert.ok(stored.includes('Owl') && stored.includes('Recovered guide'));
    await page.click('#homeLibCard');
    await page.waitForSelector('#savedOverlay.on');
    const rows = await page.$$eval('#savedList .srow .sname', (l) => l.map((x) => x.textContent));
    assert.ok(rows.includes('Owl') && rows.includes('Recovered guide'), rows.join());
    assert.equal(
      await page.evaluate((id) => !!document.querySelector(`.srow[data-id="${id}"] img.sthumb`), ORPHAN),
      true,
      'with its picture',
    );
    await page.reload();
    assert.ok(await noLostCard(page), 'nothing left to find');
    // the deleted one is gone, never brought back
    assert.equal(await page.evaluate((id) => state.saved.some((s) => s.id === id), PENDING), false);
    // a second one found later is "Recovered guide 2"
    await seed(page, { ['guide-' + (T0 + 5)]: payload() });
    await lostCard(page);
    assert.equal(
      (await page.textContent('#lostNote .ntxt')).trim(),
      'Found 1 guide that isn’t in your Library. It’s still stored on this device.',
    );
    assert.equal(await page.textContent('#lostAdd'), 'Add it back');
    await page.click('#lostAdd');
    await page.waitForSelector('#lostNote', { state: 'hidden' });
    assert.equal(await toastText(page), 'Added 1 guide back to your Library');
    assert.equal(
      await page.evaluate((id) => state.saved.find((s) => s.id === id).name, T0 + 5),
      'Recovered guide 2',
    );
    assert.deepEqual(errors, []);
  });
  test('lost guides: Not now hides the card until the next start; one that can’t be read isn’t offered again', async () => {
    const { page, errors } = await openApp({ storage: onboarded({ [KEY]: appState() }) });
    await seed(page, { ['guide-' + ORPHAN]: payload() });
    await lostCard(page);
    await page.focus('#lostLater');
    await page.keyboard.press('Enter');
    await page.waitForSelector('#lostNote', { state: 'hidden' });
    assert.equal(
      await page.evaluate(() => document.activeElement.id),
      'homeNew',
      'focus goes to New colouring guide',
    );
    await page.click('#mCollection');
    await page.click('#mHome');
    assert.equal(await shown(page, 'lostNote'), false, 'not back this visit');
    await page.reload();
    await lostCard(page);
    assert.match(await page.textContent('#lostNote'), /Found 1 guide/, 'back at the next start');

    // a stored guide that can't be read: said once, then left alone
    await seed(page, { ['guide-' + (T0 + 9)]: { lmap: 'nope' } });
    await lostCard(page);
    assert.match(await page.textContent('#lostNote'), /Found 2 guides/);
    await page.click('#lostAdd');
    await page.waitForSelector('#lostNote', { state: 'hidden' });
    assert.equal(
      await toastText(page),
      'Added 1 guide back to your Library. 1 guide couldn’t be read and was left out.',
    );
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
    await page.click('#homeHelp');
    await page.waitForSelector('#helpOverlay.on');
    await page.click('#helpData > summary');
    await page.click('#helpLost');
    await idle(page); // the first look has seen it
    await other.evaluate((T0) => {
      state.saved.unshift({
        id: T0,
        type: 'guide',
        name: 'Busy',
        ts: Date.now(),
        keys: [],
        W: 1,
        H: 1,
        n: 1,
      });
      save();
    }, T0 + 7);
    await page.waitForFunction(
      () =>
        /No lost guides found|Found/.test(document.getElementById('helpLostRes').textContent) &&
        !document.getElementById('helpLost').disabled,
    );
    assert.equal(await page.textContent('#helpLostRes'), 'No lost guides found.');
    // the same for a guide being deleted: its entry goes first, then the stored guide
    await other.evaluate((T0) => sfDeleteDesign(T0), T0 + 7);
    await page.click('#helpLost');
    await page.waitForFunction(
      () =>
        !document.getElementById('helpLost').disabled &&
        !/Looking/.test(document.getElementById('helpLostRes').textContent),
    );
    assert.equal(await page.textContent('#helpLostRes'), 'No lost guides found.');
    assert.equal(await other.evaluate((T0) => IDB.get('guide-' + T0), T0 + 7), undefined, 'deleted');
    assert.equal(
      await other.evaluate(() => localStorage.getItem('ms-lib-deleting')),
      null,
      'and the delete finished',
    );
    assert.deepEqual(errors, []);
  });
  test('lost guides: one card with the unreadable-data note when that is about guides', async () => {
    const bad = [
      { id: 'x', type: 'guide' },
      { id: -2, type: 'guide' },
    ];
    const { page, errors } = await openApp({ storage: onboarded({ [KEY]: appState({ saved: bad }) }) });
    await seed(page, { ['guide-' + ORPHAN]: payload(), ['guide-' + NAMED]: payload({ name: 'Owl' }) });
    await page.waitForSelector('#lnAdd');
    assert.equal(await shown(page, 'lostNote'), false, 'one card, not two');
    assert.equal(
      (await page.textContent('#loadNote .ntxt')).trim(),
      '2 guides couldn’t be read — found 2 on this device. Add them back to your Library. A copy of the original was kept.',
    );
    assert.deepEqual(await page.$$eval('#loadNote .nrow button', (l) => l.map((b) => b.textContent)), [
      'Add them back',
      'Download the original',
      'OK',
    ]);
    await snap(page, 'lost-combined');
    await page.click('#lnAdd');
    await page.waitForFunction(() => !document.getElementById('lnAdd'));
    assert.equal(await toastText(page), 'Added 2 guides back to your Library');
    assert.equal(
      (await page.textContent('#loadNote .ntxt')).trim(),
      '2 guides couldn’t be read and were left out. A copy of the original was kept.',
      'the note stays, as it was',
    );
    assert.deepEqual(await page.$$eval('#loadNote .nrow button', (l) => l.map((b) => b.textContent)), [
      'Download the original',
      'OK',
    ]);
    assert.equal(await shown(page, 'lostNote'), false);
    assert.deepEqual(errors, []);

    // OK puts away both: the note for good, the lost guides until the next start (then in a card of their own)
    const b = await openApp({ storage: onboarded({ [KEY]: appState({ saved: bad }) }) });
    await seed(b.page, { ['guide-' + ORPHAN]: payload() });
    await b.page.waitForSelector('#lnAdd');
    assert.match(
      await b.page.textContent('#loadNote .ntxt'),
      /^2 guides couldn’t be read — found 1 on this device\. Add it back/,
    );
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
    assert.equal(
      (await d.page.textContent('#loadNote .ntxt')).trim(),
      '1 marker couldn’t be read and was left out. A copy of the original was kept.',
    );
    assert.ok((await top(d.page, '#loadNote')) < (await top(d.page, '#lostNote')));
    assert.deepEqual([...c.errors, ...d.errors], []);
  });
  test('lost guides: the whole Library unreadable — every stored guide is offered in the note', async () => {
    const { page, errors } = await openApp({ storage: onboarded({ [KEY]: appState({ saved: 'oops' }) }) });
    await seed(page, {
      ['guide-' + ORPHAN]: payload(),
      ['guide-' + NAMED]: payload({ name: 'Owl' }),
      'guide-autosave': { payload: payload() },
    });
    await page.waitForSelector('#lnAdd');
    assert.equal(
      (await page.textContent('#loadNote .ntxt')).trim(),
      'Your Library couldn’t be read and was left out. Found 2 guides stored on this device. Add them back to your Library. A copy of the original was kept.',
    );
    await page.click('#lnAdd');
    await page.waitForFunction(() => !document.getElementById('lnAdd'));
    assert.equal(await page.evaluate(() => state.saved.length), 2);
    assert.deepEqual(errors, []);
  });
  test('Help › Your data › Find lost guides: none, or some to add back', async () => {
    const { page, errors } = await openApp({ storage: onboarded({ [KEY]: appState({ saved: [kept] }) }) });
    await seed(page, { ['guide-' + KEPT]: payload(), 'guide-autosave': { payload: payload() } });
    await page.click('#homeHelp');
    await page.waitForSelector('#helpOverlay.on');
    await page.click('#helpData > summary');
    assert.match(
      await page.textContent('#helpData'),
      /A guide missing from your Library may still be stored on this device\. Find lost guides looks for any and can add them back\./,
    );
    await page.click('#helpLost');
    await page.waitForFunction(() =>
      /No lost guides found/.test(document.getElementById('helpLostRes').textContent),
    );
    assert.equal(await page.textContent('#helpLostRes'), 'No lost guides found.');

    // one appears (another tab's Library lost it, say): found, and added back from Help
    await page.evaluate(async (id) => {
      await IDB.put('guide-' + id, {
        lmap: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        assign: { 0: 'Ohuhu|Y111' },
        name: 'Cat',
      });
    }, ORPHAN);
    await page.click('#helpLost');
    await page.waitForSelector('#helpLostAdd');
    assert.equal(
      (await page.textContent('#helpLostRes')).trim(),
      'Found 1 guide that isn’t in your Library.Add it back',
    );
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
    assert.deepEqual(await page.evaluate((id) => state.saved.find((s) => s.id === id).keys, ORPHAN), [
      'Ohuhu|Y111',
    ]);
    await page.click('#helpClose');
    assert.equal(await shown(page, 'lostNote'), false, 'and Home’s card went with it');
    await page.click('#homeHelp');
    await page.click('#helpLost');
    await page.waitForFunction(() =>
      /No lost guides found/.test(document.getElementById('helpLostRes').textContent),
    );
    assert.deepEqual(errors, []);
  });
}

// ---- from switching-guides.test.mjs ----
// Opening another guide or picture: nothing carries over from the one before (crop mode, flat sections, settings,
// paint, the wake lock), nothing is lost (progress, a change made while the next picture loads, a rename), a late
// failure says nothing over the new guide, and a guide that can't be saved stops the switch.
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
  // reopen a Library guide the way the Library does
  const openSaved = async (page, id) => {
    await page.evaluate((id) => loadGuide({ id }), id);
    await page.waitForFunction((id) => __mstest.curId === id && __mstest.assignData, id, { timeout: 10000 });
    await idle(page);
  };
  // hold back the next picture load (new Image()) until release() is called
  const holdNextImage = (page) =>
    page.evaluate(() => {
      const Real = window.Image;
      window.Image = function () {
        const im = new Real();
        window.Image = Real;
        const d = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
        Object.defineProperty(im, 'src', {
          configurable: true,
          set(v) {
            window.__release = () => d.set.call(im, v);
          },
          get() {
            return d.get.call(im);
          },
        });
        return im;
      };
    });
  const release = (page) =>
    page.evaluate(() => {
      const r = window.__release;
      window.__release = null;
      if (r) r();
      return !!r;
    });
  test('if the current guide cannot be saved, opening another one is stopped', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await page.click('#sfColor');
    await colourSome(page, 2);
    const name = await page.evaluate(() => __mstest.curName);
    await page.evaluate(() => {
      IDB.put = () => Promise.reject(new Error('QuotaExceededError'));
    });
    await page.evaluate(() => SF.loadSample());
    await idle(page, 1200);
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
    await page.evaluate(() => {
      __mstest.shadeFlat[__mstest.assignData.order[0]] = 1;
    });
    await page.evaluate(() => SF.loadSample());
    await idle(page, 1200);
    assert.equal(await page.evaluate(() => Object.keys(__mstest.shadeFlat).length), 0);
    assert.deepEqual(errors, []);
  });
  test('reopening the open guide from the Library while cropping reloads it cleanly', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await saveGuide(page);
    await idle(page);
    const id = await savedId(page);
    await page.click('#sfBack2');
    await page.click('#sfAdjToggle');
    await page.click('#sfCrop');
    await idle(page);
    await page.evaluate((id) => SF.openDesign(id), id);
    await page.waitForFunction(() => __mstest.assignData && !__mstest.cropMode, null, { timeout: 10000 });
    await idle(page);
    await page.click('#sfColor');
    await idle(page);
    const l = await page.evaluate(() => __mstest.assignData.order[2]);
    const p = await sectionPoint(page, l);
    await scrollTop(page);
    const p2 = await sectionPoint(page, l);
    await page.mouse.click(p2.x, p2.y);
    await idle(page);
    assert.equal(await page.evaluate((l) => __mstest.colored[l], l), 1, 'taps colour sections again');
    assert.deepEqual(errors, []);
  });
  test('crop mode does not leak into the next picture', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await page.click('#sfBack2');
    await page.click('#sfAdjToggle');
    await page.click('#sfCrop');
    await idle(page);
    await page.evaluate(() => SF.loadSample());
    await page.waitForFunction(() => __mstest.assignData, null, { timeout: 10000 });
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.cropMode), false);
    assert.deepEqual(errors, []);
  });
  test('a picture left unbuilt does not wipe the progress of a guide opened afterwards', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await tickSome(page, 6);
    await saveGuide(page);
    await idle(page);
    const id = await savedId(page);
    // a new photo goes to the sections editor; leave it unbuilt and open the saved guide
    const b64 = await page.evaluate(async () => {
      const c = document.createElement('canvas');
      c.width = 500;
      c.height = 700;
      const g = c.getContext('2d');
      g.fillStyle = '#fff';
      g.fillRect(0, 0, 500, 700);
      g.strokeStyle = '#111';
      g.lineWidth = 6;
      for (let i = 0; i < 6; i++) {
        g.beginPath();
        g.arc(100 + i * 60, 200 + (i % 2) * 200, 70, 0, 6.283);
        g.stroke();
      }
      return c.toDataURL('image/png').split(',')[1];
    });
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.evaluate(() => SF.pickPhoto())]);
    await fc.setFiles({ name: 'p.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
    await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 20000 });
    await idle(page);
    await page.evaluate((id) => SF.openDesign(id), id);
    await page.waitForFunction(() => __mstest.assignData && __mstest.curId, null, { timeout: 10000 });
    await idle(page);
    // (v284: part-way coloured, it opens in Colour along: back to the plan, then to its sections)
    assert.equal(await page.evaluate(() => __mstest.sfmode), 'color');
    await page.click('#sfDoneBtn');
    await idle(page);
    await page.click('#sfBack2');
    await idle(page);
    await buildGo(page);
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.colored.reduce((a, b) => a + b, 0)), 6);
    assert.deepEqual(errors, []);
  });
  test('a change made while the next picture loads is saved into the guide it was made in', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await saveNew(page);
    const id = await savedId(page);
    await holdNextImage(page);
    await page.evaluate(() => SF.loadSample());
    await page.waitForFunction(() => !!window.__release);
    await tickN(page, 2); // while "Loading sample…"
    await release(page);
    await page.waitForFunction((id) => __mstest.assignData && __mstest.curId !== id, id);
    await idle(page);
    assert.equal((await stored(page, id)).prog, 2);
    assert.deepEqual(errors, []);
  });
  test('a guide opens with its own settings, not those of the guide before', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    const plain = await page.evaluate(() => {
      const d = __mstest.currentDesignObj();
      delete d.payload.style.expand;
      delete d.payload.style.savedPalId;
      return Object.assign({}, d.payload, { name: 'Plain', W: d.W, H: d.H });
    });
    const pid = await page.evaluate(() => {
      const id = Date.now();
      state.saved.unshift({ id, type: 'palette', name: 'P', keys: [...state.owned].slice(0, 6), ts: id });
      save();
      return id;
    });
    await answerAsks(page);
    await page.evaluate((pid) => SF.setSavedSource(pid), pid);
    assert.equal(await page.evaluate(() => __mstest.currentDesignObj().payload.style.savedPalId), pid);
    await page.evaluate((d) => __mstest.openDesignObj(d, null), plain);
    await page.waitForFunction(() => __mstest.curName === 'Plain');
    await idle(page);
    const st = await page.evaluate(() => __mstest.currentDesignObj().payload.style);
    assert.equal(st.savedPalId, null);
    assert.equal(st.expand, false);
    assert.equal(st.paletteSource, 'owned');
    assert.deepEqual(errors, []);
  });
  test('a photo that fails after something else opened says nothing over the new guide', async () => {
    const { page, errors } = await openApp();
    await welcome(page, 'look');
    await idle(page);
    await holdNextImage(page);
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.evaluate(() => SF.pickPhoto())]);
    await fc.setFiles({
      name: 'bad.png',
      mimeType: 'image/png',
      buffer: Buffer.from('not a picture at all'),
    });
    await page.waitForFunction(() => !!window.__release);
    await page.evaluate(() => SF.loadSample());
    await page.waitForFunction(() => __mstest.assignData);
    await idle(page);
    await release(page);
    await idle(page);
    assert.doesNotMatch(await page.textContent('#sfMeta'), /couldn’t be opened as a picture/);
    assert.equal(await page.locator('#sfRoot .errcard').count(), 0);
    assert.deepEqual(errors, []);
  });
  test('a new picture: the screen may sleep again, paint is off, and Unpin still works after reopening', async () => {
    const init = () => {
      window.__wl = { req: 0, rel: 0 };
      Object.defineProperty(navigator, 'wakeLock', {
        configurable: true,
        value: {
          request: () => {
            window.__wl.req++;
            return Promise.resolve({
              release() {
                window.__wl.rel++;
                return Promise.resolve();
              },
              addEventListener() {},
            });
          },
        },
      });
    };
    const { page, errors } = await openApp({ init });
    await sampleGuide(page);
    await page.click('#sfColor');
    await idle(page);
    assert.equal(await page.evaluate(() => window.__wl.req), 1);
    await page.evaluate(() => SF.loadSample());
    await page.waitForFunction(() => __mstest.assignData && __mstest.hlKey == null);
    await idle(page);
    assert.equal(await page.evaluate(() => window.__wl.rel), 1, 'the wake lock is let go');
    // paint on in Manual, then a Library guide opens: paint is off
    await saveNew(page);
    const id = await savedId(page);
    await tab(page, 'pattern');
    await page.click('#sfFam [data-v="manual"]');
    await idle(page);
    await page.click('#sfPaint');
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.paintOn), true);
    await page.evaluate(() => SF.loadSample());
    await page.waitForFunction((id) => __mstest.assignData && __mstest.curId !== id, id);
    await idle(page);
    await openSaved(page, id);
    assert.equal(await page.evaluate(() => __mstest.paintOn), false);
    // pin a section, Shuffle (its pattern colour changes under the pin), reopen: Unpin gives the pattern's colour
    await tab(page, 'pattern');
    await page.click('#sfFam [data-v="gradient"]');
    await idle(page);
    const l = await page.evaluate(() => {
      const t = __mstest,
        c = document.getElementById('sfCanvas'),
        r = c.getBoundingClientRect();
      return t.assignData.order
        .filter((l) => {
          const q = t.labelPos(l),
            y = r.top + (q.y / c.height) * r.height;
          return y > r.top + 20 && y < r.bottom - 60;
        })
        .sort((a, b) => t.comps[b].area - t.comps[a].area)[0];
    });
    const tapL = async () => {
      await scrollTop(page);
      const p = await sectionPoint(page, l);
      await page.mouse.click(p.x, p.y);
      await idle(page);
    };
    await tapL();
    await page.click('.sftip [data-a="pin"]');
    await idle(page);
    await tab(page, 'pattern');
    await page.click('#sfVary');
    await idle(page);
    const base = await page.evaluate((l) => __mstest.assignData.base[l].mkey, l),
      pinned = await page.evaluate((l) => __mstest.assignData.assign[l].mkey, l);
    if (base === pinned) {
      await page.click('#sfVary');
      await idle(page);
    }
    const base2 = await page.evaluate((l) => __mstest.assignData.base[l].mkey, l);
    await idle(page, AUTO);
    await page.reload();
    await idle(page);
    await openSaved(page, id);
    await tapL();
    await page.click('.sftip [data-a="pin"]');
    await idle(page);
    assert.equal(await page.evaluate((l) => __mstest.locks[l] ?? null, l), null);
    assert.equal(
      await page.evaluate((l) => __mstest.assignData.assign[l].mkey, l),
      base2,
      'Unpin goes back to the pattern’s colour',
    );
    assert.deepEqual(errors, []);
  });
}
