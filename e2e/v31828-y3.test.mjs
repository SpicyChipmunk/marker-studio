// v318.28 in the browser: using a guide, saving, output (Y3).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, idle, welcome, sampleGuide, saveGuide, sectionPoint } from './helpers.mjs';

before(setup);
after(teardown);

const DAY = 864e5;
const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const toastOn = (page) =>
  page.evaluate(() => {
    const t = document.getElementById('msToast');
    return t && t.classList.contains('on') ? t.textContent : null;
  });
const biggest = (page, n = 1) =>
  page.evaluate(
    (n) =>
      __mstest.assignData.order
        .slice()
        .sort((a, b) => __mstest.comps[b].area - __mstest.comps[a].area)
        .slice(0, n),
    n,
  );
async function scrollTop(page) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await idle(page);
}

// E1: a plan step's toast Undo undoes that step, not a later one that said nothing of its own
test('Y3 E1: Surprise’s toast goes when a pin follows (its Undo had undone the pin); alone, it undoes the Surprise', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await page.click('.sftabbtn[data-t="colours"]');
  await idle(page);
  await page.click('#sfSurprise');
  await idle(page);
  assert.match((await toastOn(page)) || '', /^Surprise\b.*Undo$/);
  // its Undo, while it's the last step: the Surprise
  await page.click('#toastAct');
  await idle(page);
  assert.deepEqual(await page.evaluate(() => __mstest.assign.planStack.length), 0);
  assert.match(await page.textContent('#msToast'), /^Undone: Surprise/);
  // again, then a pin within the toast's 8 s (↶ Undo showing: the pin says nothing in a toast of its own)
  await page.click('#sfSurprise');
  await idle(page);
  assert.ok(await toastOn(page), 'Surprise toasts');
  const [l] = await biggest(page);
  await scrollTop(page);
  const p = await sectionPoint(page, l);
  await page.mouse.click(p.x, p.y);
  await idle(page);
  await page.click('.sftip [data-a="pin"]');
  await idle(page);
  assert.ok(await page.evaluate((l) => !!__mstest.locks[l], l), 'pinned');
  assert.equal(await toastOn(page), null, 'the Surprise’s toast is gone: its Undo would have undone the pin');
  assert.deepEqual(errors, []);
});

// E2: Paint over a section left white says so
test('Y3 E2: Paint on a section left white keeps it white and says how to colour it', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await page.click('.sftabbtn[data-t="pattern"]');
  await page.click('#sfFam [data-v="manual"]');
  await idle(page);
  const [l] = await biggest(page);
  await page.evaluate((l) => __mstest.leaveWhite(l), l);
  await idle(page);
  await page.mouse.click(3, 3);
  await idle(page);
  await page.click('#sfPaint');
  await idle(page);
  await scrollTop(page);
  const p = await sectionPoint(page, l);
  await page.mouse.click(p.x, p.y);
  await idle(page);
  assert.ok(
    await page.evaluate((l) => __mstest.whitePins[l] !== undefined && !__mstest.assignData.assign[l], l),
  );
  assert.equal(await toastOn(page), 'That section is left white. To colour it: Done painting, then tap it.');
  assert.deepEqual(errors, []);
});

// F1: a guide only put away (its save landed) isn't written again at the next start
test('Y3 F1: after a restart, a guide put away and backed up since is still in the backup', async () => {
  const { page, ctx, errors } = await openApp();
  await sampleGuide(page);
  await idle(page);
  await saveGuide(page);
  await idle(page, 2000);
  const a = await page.evaluate(async () => {
    const t = __mstest,
      id = t.curId;
    t.assignData.order.slice(5, 8).forEach((l) => (t.colored[l] = 1));
    t.guideDirty = true;
    t.renderGuide();
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
    await t.flushSave();
    await new Promise((r) => setTimeout(r, 500));
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
    const row = state.saved.find((s) => s.id === id),
      lv = JSON.parse(localStorage.getItem('ms-guide-leave') || 'null');
    // a backup made now, as backupAll's made() records it
    const now = Date.now();
    localStorage.setItem('ms-guides-backup-ts', String(now));
    row.bk = now;
    save();
    return { id, ts: row.ts, kept: !!lv && lv.base === row.ts, risk: guidesAtRisk() };
  });
  assert.ok(a.kept, 'the copy kept aside stays, based on the row the save wrote (v318.25)');
  assert.equal(a.risk, 0);
  await page.waitForTimeout(300);
  await page.reload();
  await page.waitForFunction(
    () => typeof state !== 'undefined' && !localStorage.getItem('ms-guide-leave'),
    null,
    {
      timeout: 15000,
    },
  );
  await idle(page, 2000);
  const b = await page.evaluate(async (id) => {
    const row = state.saved.find((s) => s.id === id);
    return { ts: row.ts, risk: guidesAtRisk(), prog: ((await IDB.get('guide-' + id)) || {}).prog };
  }, a.id);
  assert.equal(b.ts, a.ts, 'the row’s time is the save’s: nothing new was written');
  assert.equal(b.risk, 0, 'not “not in a backup”');
  assert.equal(b.prog.length, 3, 'the ticks are there');
  assert.deepEqual(errors, []);
  await ctx.close();
});

// F2: Duplicate keeps "+ N for shading"
test('Y3 F2: Duplicate keeps the row’s shading count', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await idle(page);
  await saveGuide(page);
  await idle(page, 2000);
  const r = await page.evaluate(async () => {
    const id = __mstest.curId,
      row = state.saved.find((s) => s.id === id);
    row.sk = 29; // as a guide with shading has it
    save();
    const nid = await libDuplicate(id);
    return state.saved.find((s) => s.id === nid).sk;
  });
  assert.equal(r, 29);
  assert.deepEqual(errors, []);
});

// F3: a delete still finishing with no row kept isn't in Recently deleted, and isn't said to be
test('Y3 F3: restoring a guide whose unfinished delete kept no row: the backup’s copy takes its place', async () => {
  const { page, errors } = await openApp();
  await welcome(page, 'look');
  await idle(page);
  const T0 = Date.now() - 3 * DAY;
  const r = await page.evaluate(
    async ([PNG, T0]) => {
      const id = 5201,
        PL = (k, extra) => Object.assign({ lmap: PNG, assign: { 0: k } }, extra || {});
      await sfSaveDesign({
        id,
        name: 'Owl',
        W: 1,
        H: 1,
        keys: ['Ohuhu|R014'],
        n: 1,
        payload: PL('Ohuhu|R014'),
        ts: T0,
        keepTs: true,
        quiet: true,
      });
      const gs = await gatherGuides(),
        bk = { v: 1, type: 'ms-guides', ts: T0, guides: gs.filter((g) => g.id === id) };
      await sfSaveDesign({
        id,
        name: 'Owl',
        W: 1,
        H: 1,
        keys: ['Ohuhu|Y111'],
        n: 1,
        payload: PL('Ohuhu|Y111', { prog: [0] }),
        quiet: true,
      });
      // as sfDeleteDesign leaves it until the stored guide is gone (an import that never opened): no row kept
      state.saved = state.saved.filter((s) => s.id !== id);
      save(true);
      libPendSet([{ id, t: 0 }]);
      const t = document.getElementById('msToast');
      if (t) t.classList.remove('on');
      restoreAny(new File([JSON.stringify(bk)], 'b.json', { type: 'application/json' }), 'guidesRestore');
      await new Promise((res) => setTimeout(res, 1500));
      return {
        toast: document.getElementById('msToast').textContent,
        rows: state.saved.filter((s) => s.type === 'guide').map((s) => ({ id: s.id, name: s.name })),
        key: ((await IDB.get('guide-' + id)) || {}).assign,
        bin: libBinList().length,
      };
    },
    [PNG, T0],
  );
  assert.deepEqual(r.rows, [{ id: 5201, name: 'Owl' }]);
  assert.deepEqual(r.key, { 0: 'Ohuhu|R014' }, 'the backup’s');
  assert.equal(r.bin, 0);
  assert.doesNotMatch(r.toast, /Recently deleted/);
  assert.deepEqual(errors, []);
});

// G1: Key + reference's PDF named apart from Page + key's
test('Y3 G1: the Key + reference PDF is “…-reference.pdf”', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await page.click('.sftabbtn[data-t="share"]');
  await page.click('#sfPrint');
  await page.waitForSelector('#sfSheet.sfprsh');
  await page.click('[data-pwhat="ref"]');
  await idle(page);
  const dl = page.waitForEvent('download', { timeout: 60000 });
  await page.click('#sfPDF');
  assert.equal((await dl).suggestedFilename(), 'sample-jellyfish-reference.pdf');
  assert.deepEqual(errors, []);
});

// G2: Tester tasks says what is shared without a form as it says what a form is sent
test('Y3 G2: Tester tasks with no form names every detail the shared text carries', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await welcome(page, 'look');
  await idle(page);
  await page.click('#homeTasks');
  const w = await page.textContent('#ttWhat');
  assert.match(w, /opens the share sheet/);
  assert.match(
    w,
    /tester number.*version.*device.*Home Screen app or browser tab.*markers of each brand.*guides and palettes/,
  );
  assert.deepEqual(errors, []);
});
