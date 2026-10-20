// v318.25 in the browser.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, openAtScale, idle, welcome, sampleGuide, saveGuide } from './helpers.mjs';

before(setup);
after(teardown);

// ==== X4: saving, versions, layout and access ====
const KEY = 'ohuhu-hb320-picker-v3',
  DAY = 864e5;
const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

// F1: ticks made while an earlier save runs, the page then put away and stopped: kept for the next start. Another
// tab's save after that still wins over the copy kept aside.
async function leaveRun(otherTab) {
  const { page, ctx, errors } = await openApp();
  await sampleGuide(page);
  await idle(page);
  await saveGuide(page);
  await idle(page, 2000);
  const id = await page.evaluate(() => __mstest.curId);
  const r = await page.evaluate(
    async ([KEY, otherTab]) => {
      const t = __mstest,
        o = t.assignData.order;
      const A = o.slice(10, 13),
        B = o.slice(20, 23);
      A.forEach((l) => (t.colored[l] = 1));
      t.guideDirty = true;
      t.renderGuide();
      const p = t.flushSave(); // A's save begins
      B.forEach((l) => (t.colored[l] = 1));
      t.guideDirty = true;
      t.renderGuide();
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
      await p; // A's save lands; then the page is stopped
      IDB.put = () => new Promise(() => {});
      const os = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k, v) {
        if (k === 'ms-guide-leave') return;
        return os.call(this, k, v);
      };
      if (otherTab) {
        // another tab saves the guide after that: its row has a new time
        const v = JSON.parse(localStorage.getItem(KEY));
        v.saved.find((s) => s.id === t.curId).ts = Date.now() + 5000;
        os.call(localStorage, KEY, JSON.stringify(v));
      }
      return { A, B };
    },
    [KEY, otherTab],
  );
  await page.reload();
  await idle(page, 2500);
  await page.evaluate((id) => SF.openDesign(id), id);
  await page.waitForFunction((id) => window.__mstest && __mstest.assignData && __mstest.curId === id, id, {
    timeout: 30000,
  });
  await idle(page, 1500);
  const got = await page.evaluate(
    ({ A, B }) => ({
      A: A.filter((l) => __mstest.colored[l]).length,
      B: B.filter((l) => __mstest.colored[l]).length,
      left: !!localStorage.getItem('ms-guide-leave'),
    }),
    r,
  );
  await ctx.close();
  return { got, errors };
}
test('X4 F1: ticks made while a save runs survive the page being stopped; another tab’s later save still wins', async () => {
  const a = await leaveRun(false);
  assert.deepEqual(a.got, { A: 3, B: 3, left: false }, 'B’s ticks kept (v318.24: B 0)');
  assert.deepEqual(a.errors, []);
  const b = await leaveRun(true);
  assert.equal(b.got.B, 0, 'the copy kept aside doesn’t go over another tab’s save');
  assert.equal(b.got.left, false);
});

// F2, F3: the update banner
const updated = (page) =>
  page.evaluate(() => {
    navigator.serviceWorker.dispatchEvent(new Event('controllerchange'));
    navigator.serviceWorker.dispatchEvent(new Event('controllerchange'));
  });
const back = (page) => page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
test('X4 F2: the update banner closed with ✕ stays closed through screen changes, back when the page comes back', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await welcome(page, 'look');
  await idle(page);
  await updated(page);
  await page.waitForSelector('#msUpd');
  await page.click('#msUpdX');
  await page.evaluate(() => setMode('collection'));
  await idle(page);
  assert.equal(await page.locator('#msUpd').count(), 0, 'not back on Markers (v318.24: it was)');
  await page.evaluate(() => setMode('palette'));
  await idle(page);
  assert.equal(await page.locator('#msUpd').count(), 0);
  await back(page);
  assert.equal(await page.locator('#msUpd').count(), 1, 'back when the page comes back to the screen');
  assert.deepEqual(errors, []);
});
test('X4 F3: a banner showing as a guide opens goes (the picture doesn’t move): a toast, and the banner back on leaving', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await welcome(page, 'look');
  await idle(page);
  await updated(page);
  await page.waitForSelector('#msUpd');
  await page.evaluate(() => homeStart('sample'));
  await page.waitForFunction(() => window.__mstest && __mstest.assignData, null, { timeout: 30000 });
  await idle(page);
  assert.equal(await page.locator('#msUpd').count(), 0, 'no banner over the guide (v318.24: 54 px)');
  assert.match(await page.textContent('#msToast'), /A new version of Marker Studio is ready/);
  await page.evaluate(() => setMode('home'));
  await page.waitForSelector('#msUpd');
  assert.deepEqual(errors, []);
});

// F4, F5: restoring a backup
async function withGuide(page, id, name) {
  const T0 = Date.now() - 3 * DAY;
  return page.evaluate(
    async ([PNG, id, name, T0]) => {
      window.PL = (k, extra) => Object.assign({ lmap: PNG, assign: { 0: k } }, extra || {});
      window.rows = () =>
        state.saved.filter((s) => s.type === 'guide').map((s) => ({ id: s.id, name: s.name }));
      window.restoreFile = (o) =>
        new Promise((r) => {
          const t = document.getElementById('msToast');
          if (t) t.classList.remove('on');
          restoreAny(new File([JSON.stringify(o)], 'b.json', { type: 'application/json' }), 'guidesRestore');
          setTimeout(
            () =>
              r({
                toast:
                  (t && t.classList.contains('on') && t.textContent) ||
                  document.getElementById('msToast').textContent,
              }),
            1500,
          );
        });
      await sfSaveDesign({
        id,
        name,
        W: 1,
        H: 1,
        keys: ['Ohuhu|R014'],
        n: 1,
        payload: PL('Ohuhu|R014'),
        ts: T0,
        keepTs: true,
        quiet: true,
      });
      state.saved.find((s) => s.id === id).bk = T0;
      save(true);
      localStorage.setItem('ms-guides-backup-ts', String(T0));
      const gs = await gatherGuides();
      return { v: 1, type: 'ms-guides', ts: T0, guides: gs.filter((g) => g.id === id) };
    },
    [PNG, id, name, T0],
  );
}
test('X4 F4: restoring a backup leaves a newer guide in Recently deleted as it is; the backup’s comes in beside it', async () => {
  const { page, errors } = await openApp();
  await welcome(page, 'look');
  await idle(page);
  const bk = await withGuide(page, 5101, 'Owl');
  const r = await page.evaluate(async (bk) => {
    await sfSaveDesign({
      id: 5101,
      name: 'Owl',
      W: 1,
      H: 1,
      keys: ['Ohuhu|Y111'],
      n: 1,
      payload: PL('Ohuhu|Y111', { prog: [0] }),
      quiet: true,
    });
    openLibrary();
    libDelete(5101);
    libFinish(); // the Undo's time is over: it waits in Recently deleted
    const r = await restoreFile(bk);
    return {
      ...r,
      rows: rows(),
      prog: (await IDB.get('guide-5101')).prog,
      bin: libPendList().map((x) => x.id),
    };
  }, bk);
  assert.deepEqual(r.prog, [0], 'its progress kept (v318.24: the backup’s older copy replaced it)');
  assert.deepEqual(r.bin, [5101], 'still in Recently deleted');
  assert.deepEqual(
    r.rows.map((x) => x.name),
    ['Owl (from backup)'],
  );
  assert.match(r.toast, /1 guide in Recently deleted was left there \(Put back brings it back as it was\)/);
  // the same backup again: nothing more
  const n2 = await page.evaluate((bk) => restoreFile(bk).then(() => rows().length), bk);
  assert.equal(n2, 1);
  // one the same as the backup's still comes back as itself
  const r3 = await page.evaluate(async (bk) => {
    state.saved = state.saved.filter((s) => s.type !== 'guide');
    save(true);
    libPendSet([]);
    await IDB.put('guide-5101', bk.guides[0].payload);
    libPendSet([{ id: 5101, t: Date.now() - 864e5, e: { id: 5101, type: 'guide', name: 'Owl' } }]);
    await restoreFile(bk);
    return { rows: rows(), bin: libPendList().map((x) => x.id) };
  }, bk);
  assert.deepEqual(r3.rows, [{ id: 5101, name: 'Owl' }]);
  assert.deepEqual(r3.bin, []);
  assert.deepEqual(errors, []);
});
test('X4 F5: a “(before restore)” copy taken out again isn’t brought back by another tab’s save', async () => {
  const { page, errors } = await openApp();
  await welcome(page, 'look');
  await idle(page);
  const r = await page.evaluate(
    async ([KEY, PNG]) => {
      const k = await sfSaveDesign({
        id: 5201,
        name: 'Cat (before restore)',
        W: 1,
        H: 1,
        keys: [],
        n: 1,
        payload: { lmap: PNG },
        quiet: true,
      });
      // another tab saves meanwhile (its Library, which has the copy too)
      const v = JSON.parse(localStorage.getItem(KEY));
      v.other = 1;
      localStorage.setItem(KEY, JSON.stringify(v));
      dropKept(k);
      await new Promise((res) => setTimeout(res, 300));
      return {
        here: state.saved.some((s) => s.id === 5201),
        stored: JSON.parse(localStorage.getItem(KEY)).saved.some((s) => s.id === 5201),
      };
    },
    [KEY, PNG],
  );
  assert.deepEqual(r, { here: false, stored: false }, 'v318.24: back as an empty row');
  assert.deepEqual(errors, []);
});

// H2: the Markers ⋯ menu on a phone
test('X4 H2: the Markers ⋯ menu stays on the screen of a phone, with large text too', async () => {
  for (const [w, h, s] of [
    [375, 667, 1],
    [390, 844, 1.3],
    [320, 568, 1.6],
  ]) {
    const { page, ctx, errors } = await openAtScale(s, { width: w, height: h });
    await welcome(page, 'look');
    await idle(page);
    await page.evaluate(() => setMode('collection'));
    await idle(page);
    await page.click('#mkMore');
    await idle(page);
    const m = await page.evaluate(() => {
      const r = mkMenu.getBoundingClientRect();
      return { l: r.left, r: r.right, vw: document.documentElement.clientWidth };
    });
    assert.ok(m.l >= 8 && m.r <= m.vw - 8, `${w} at ${s}×: ${m.l}..${m.r} (v318.24: from -12, -394, -158)`);
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});

// H3: How it works on the smallest phone with large text
test('X4 H3: How it works fits 320 wide with 1.6× text: no sideways scroll, Next inside the card', async () => {
  const { page, ctx, errors } = await openAtScale(1.6, { width: 320, height: 568 });
  await welcome(page, 'look');
  await idle(page);
  await page.evaluate(() => setMode('home'));
  await idle(page);
  await page.click('#homeHiw');
  await idle(page);
  const r = await page.evaluate(() => {
    const c = document.querySelector('.hiwcard'),
      cr = c.getBoundingClientRect(),
      n = document.getElementById('hiwNext').getBoundingClientRect();
    return { sw: c.scrollWidth, cw: c.clientWidth, in: n.right <= cr.right - 1 };
  });
  assert.equal(r.sw, r.cw, 'v318.24: 300 in 274');
  assert.equal(r.in, true);
  assert.deepEqual(errors, []);
  await ctx.close();
});

// H6: Library › Back up from the keyboard
test('X4 H6: Back up from the keyboard keeps focus on the button', async () => {
  const { page, errors } = await openApp();
  await welcome(page, 'look');
  await idle(page);
  await page.evaluate(() => openLibrary());
  await idle(page);
  await page.focus('#guidesBackup');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => !document.getElementById('guidesBackup').disabled, null, {
    timeout: 8000,
  });
  assert.equal(
    await page.evaluate(() => document.activeElement && document.activeElement.id),
    'guidesBackup',
    'v318.24: BODY',
  );
  assert.deepEqual(errors, []);
});

// H1: copying through the fallback
test('X4 H1: copying when the clipboard refuses keeps focus where it was', async () => {
  const { page, errors } = await openApp();
  await welcome(page, 'look');
  await idle(page);
  const r = await page.evaluate(async () => {
    navigator.clipboard.writeText = () => Promise.reject(new Error('no'));
    const b = document.getElementById('mCollection');
    b.focus();
    await copyText('R14, Y111');
    return {
      a: document.activeElement && document.activeElement.id,
      left: document.querySelectorAll('body > textarea').length,
    };
  });
  assert.deepEqual(r, { a: 'mCollection', left: 0 });
  assert.deepEqual(errors, []);
});

// H5: saved as the guide's screen is left by the main tabs
test('X4 H5: “Saved in your Library” as the guide is left by the main tabs is the app’s toast', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await idle(page);
  await page.click('#sfSurprise');
  await idle(page);
  await page.click('#mCollection');
  await page.waitForFunction(
    () => /Saved in your Library/.test(document.getElementById('msToast').textContent),
    null,
    { timeout: 8000 },
  );
  assert.ok(await page.evaluate(() => document.getElementById('msToast').classList.contains('on')));
  assert.deepEqual(errors, []);
});

// H4: the search's count, said
test('X4 H4: how many markers match a search is said once typing stops', async () => {
  const { page, errors } = await openApp();
  await welcome(page, 'look');
  await idle(page);
  await page.evaluate(() => setMode('collection'));
  await idle(page);
  await page.fill('#q', 'R');
  await page.fill('#q', 'R4');
  await page.waitForTimeout(1200);
  const said = await page.evaluate(() => (document.getElementById('msLive') || {}).textContent || '');
  assert.match(said, /^Matches \(\d+ markers?\)$/);
  assert.deepEqual(errors, []);
});
