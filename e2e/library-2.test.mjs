// The Library, saving and reopening guides, guide files.
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
  frames,
  haveSet,
  idle,
  letterGuide,
  notOnWebKit,
  openApp,
  openAtScale,
  rename,
  sampleGuide,
  saveGuide,
  scanFromMarkers,
  scrollTop,
  sectionPoint,
  setup,
  teardown,
  until,
  welcome,
} from './helpers.mjs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

before(setup);
after(teardown);

// ---- from v285-review.test.mjs ----
// v285's pre-release review: narrow landscape phones keep the whole controls column; an automatic first save leaves a
// name being typed alone; Put back while the Library's delete is still waiting keeps the guide's stored copy; Home's
// Continue card follows a rename and isn't redrawn while Home is hidden; the marker sets' caret stays an icon.
{
  const AUTO = 2300;
  // idle(page, AUTO): until auto-save (1.5 s after the last change) has run
  const guides = (page) =>
    page.evaluate(() =>
      state.saved.filter((s) => s.type === 'guide').map((s) => ({ id: s.id, name: s.name })),
    );
  const tickInCode = (page, i) =>
    page.evaluate((i) => {
      const t = __mstest;
      t.colored[t.assignData.order[i]] = 1;
      t.guideDirty = true;
      t.renderGuide();
    }, i);
  test('Put back while the Library is still to tidy the deleted guide away keeps its stored copy', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await saveGuide(page);
    const [g] = await guides(page);
    // deleted (the 6 s Undo still running), then Put back with the tidy-up landing at once
    await page.evaluate((id) => libDelete(id), g.id);
    await idle(page);
    assert.equal(await page.textContent('#sfSave'), 'Put back');
    // (the Undo window ends while the guide's record is being written)
    await page.evaluate((id) => {
      const put = IDB.put;
      IDB.put = function (k) {
        const p = put.apply(this, arguments);
        if (k === 'guide-' + id) {
          IDB.put = put;
          libFinish();
        }
        return p;
      };
      document.getElementById('sfSave').click();
    }, g.id);
    await page.waitForFunction(() => __mstest.inLibrary);
    await idle(page, 7000);
    assert.equal((await guides(page)).length, 1);
    assert.equal(
      await page.evaluate((id) => IDB.get('guide-' + id).then((p) => !!p), g.id),
      true,
      'its stored copy is there',
    );
    assert.equal(
      await page.evaluate((id) => libPendList().some((x) => x.id === id), g.id),
      false,
      'and nothing waits to delete it',
    );
    // it opens again
    await page.reload();
    await idle(page);
    await page.evaluate((id) => loadGuide({ id }), g.id);
    await page.waitForFunction((id) => __mstest.curId === id && __mstest.assignData, g.id, {
      timeout: 10000,
    });
    assert.deepEqual(errors, []);
  });
  test('Home’s Continue card follows a Library rename, and leaves its picture alone while Home is hidden', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await saveGuide(page);
    // (v313: the sample with ticks to try it isn't on Continue until it's printed or renamed: as if renamed)
    await page.evaluate(() => {
      __mstest.styleVars.smpTry = 0;
    });
    await page.click('#sfColor');
    await idle(page);
    for (const i of [0, 1, 2]) await tickInCode(page, i);
    await page.evaluate(() => __mstest.flushSave());
    await idle(page);
    await page.click('#mHome');
    await idle(page);
    assert.match(await page.textContent('#homeCont .hcname'), /Sample jellyfish/);
    await page.waitForFunction(() => /· next/.test(document.querySelector('#homeCont .hcmeta').textContent));
    await page.evaluate(() => {
      const g = state.saved.find((s) => s.type === 'guide');
      g.name = 'Blue sea';
      renderRecent();
    });
    assert.equal(await page.textContent('#homeCont .hcname'), 'Blue sea');
    // (the card is drawn again: its next marker comes once its picture is read, later on a slow machine)
    await page.waitForFunction(() => /· next/.test(document.querySelector('#homeCont .hcmeta').textContent));
    assert.equal(
      (await page.textContent('#homeCont .hcmeta')).match(/· next/g).length,
      1,
      'the next marker said once',
    );
    // back in the guide, a save doesn't redraw Home's card meanwhile
    await page.click('#mSections');
    await idle(page);
    const before = await page.evaluate(() => document.getElementById('homeCont').getAttribute('data-ts'));
    await tickInCode(page, 3);
    await page.evaluate(() => __mstest.flushSave());
    await idle(page);
    assert.equal(
      await page.evaluate(() => document.getElementById('homeCont').getAttribute('data-ts')),
      before,
      'not redrawn while hidden',
    );
    await page.click('#mHome');
    await idle(page);
    assert.notEqual(
      await page.evaluate(() => document.getElementById('homeCont').getAttribute('data-ts')),
      before,
      'redrawn on showing Home',
    );
    assert.match(await page.textContent('#homeCont .hcmeta'), /^4 of \d+ coloured/);
    assert.deepEqual(errors, []);
  });
}

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
  const stored = (page, id) =>
    page.evaluate(
      (id) =>
        IDB.get('guide-' + id).then(
          (p) =>
            p && {
              prog: (p.prog || []).length,
              n: Object.keys(p.assign || {}).length,
              shape: p.style && p.style.gradShape,
            },
        ),
      id,
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
  test('ticks and a pattern change made just before a reload are kept, and the guide opens with them', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await saveGuide(page);
    const id = await page.evaluate(() => __mstest.curId);
    await tickN(page, 2);
    await page.evaluate(() => __mstest.flushSave());
    await idle(page);
    // two more ticks and a pattern change, then the page goes at once
    await page.click('.sftabbtn[data-t="pattern"]');
    const shape = await page.getAttribute('#sfShape .sfedit:not(.on)', 'data-v');
    await page.click(`#sfShape [data-v="${shape}"]`);
    await tickN(page, 2, 2);
    await page.reload();
    await idle(page);
    assert.equal(
      await page.evaluate((id) => state.saved.find((s) => s.id === id).done, id),
      4,
      'the Library row',
    );
    const s = await stored(page, id);
    assert.equal(s.prog, 4, 'the stored guide');
    assert.equal(s.shape, shape, 'with the new pattern');
    assert.equal(
      await page.evaluate(() => localStorage.getItem('ms-guide-leave')),
      null,
      'put into the guide, then gone',
    );
    await page.evaluate((id) => loadGuide({ id }), id);
    await page.waitForFunction((id) => __mstest.curId === id && __mstest.assignData, id);
    assert.equal(await page.evaluate(() => __mstest.colored.reduce((a, b) => a + b, 0)), 4);
    assert.deepEqual(errors, []);
  });
  test('Resume brings back section edits; Discard edits then keeps the Library guide as it was built', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await saveGuide(page);
    const id = await page.evaluate(() => __mstest.curId),
      n0 = await page.evaluate(() => __mstest.assignData.N);
    await tickN(page, 3);
    await idle(page, AUTO);
    await excludeOne(page);
    await hide(page);
    await idle(page);
    await page.reload();
    await page.waitForSelector('#sfResume', { state: 'visible' });
    await page.click('#sfResumeGo');
    await page.waitForFunction((id) => __mstest.curId === id && __mstest.assignData, id);
    await idle(page);
    // something else opens: Discard edits
    await page.evaluate(() => SF.loadSample());
    await page.waitForSelector('#sfEdAsk');
    await page.click('#sfEdAsk [data-a="discard"]');
    await page.waitForFunction((id) => __mstest.curId !== id, id);
    await idle(page, AUTO);
    const s = await stored(page, id);
    assert.equal(s.n, n0, 'every section, as built');
    assert.equal(s.prog, 3, 'and its ticks');
    assert.equal(
      await page.evaluate(() => localStorage.getItem('ms-guide-auto')),
      null,
      'the edits kept for Resume are gone',
    );
    assert.deepEqual(errors, []);
  });
  test('a guide deleted while open with section edits doesn’t come back through Resume', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await saveGuide(page);
    const id = await page.evaluate(() => __mstest.curId);
    await excludeOne(page);
    await page.evaluate((id) => {
      libDelete(id);
      libFinish();
    }, id);
    await idle(page);
    await hide(page);
    await idle(page);
    assert.equal(
      await page.evaluate(() => localStorage.getItem('ms-guide-auto')),
      null,
      'nothing kept for Resume',
    );
    assert.deepEqual(errors, []);
  });
  test('the Library doesn’t say guides are backed up when none has been', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await saveGuide(page);
    await page.evaluate(() => {
      const g = state.saved.find((s) => s.type === 'guide');
      g.fresh = 1;
      renderLibStat();
    });
    assert.equal(await page.textContent('#libStat'), 'Not backed up yet');
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
  async function pickPhoto(page, buf, name = 'pic.png') {
    const [fc] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.evaluate(() => {
        setMode('sections');
        SF.pickPhoto();
      }),
    ]);
    await fc.setFiles({ name, mimeType: 'image/png', buffer: buf });
  }
  test('changes kept as the page goes leave the Library row as it is until they are in the guide', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await saveGuide(page);
    const id = await page.evaluate(() => __mstest.curId);
    const row0 = await page.evaluate((id) => {
      const e = state.saved.find((s) => s.id === id);
      return { ts: e.ts, done: e.done || 0 };
    }, id);
    await tickN(page, 3);
    await page.evaluate(() => {
      IDB.put = () => new Promise(() => {});
      window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false }));
    });
    const row1 = await page.evaluate((id) => {
      const e = state.saved.find((s) => s.id === id);
      return { ts: e.ts, done: e.done || 0 };
    }, id);
    assert.deepEqual(row1, row0, 'the row is untouched as the page goes');
    await page.reload();
    await idle(page);
    await page.waitForFunction((id) => (state.saved.find((s) => s.id === id).done || 0) === 3, id);
    assert.ok(
      await page.evaluate(([id, ts]) => state.saved.find((s) => s.id === id).ts > ts, [id, row0.ts]),
      'a new time, for other tabs',
    );
    assert.deepEqual(errors, []);
  });
  test('a colour only tried in the picker is never kept aside as the page is hidden', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await saveGuide(page);
    await scrollTop(page);
    const l = await page.evaluate(() => __mstest.assignData.order[0]);
    await page.evaluate((l) => (__mstest.openSectionPop ? __mstest.openSectionPop(l) : null), l);
    const opened = await page.evaluate(() => !!document.querySelector('#sfSheet .sfsw, #sfSheet [data-k]'));
    if (!opened) {
      const p = await sectionPoint(page, l);
      await page.mouse.click(p.x, p.y);
      await idle(page);
      await page.click('.sftip [data-a="change"]');
      await idle(page);
    }
    const sw = await page.$('#sfSheet [data-k]:not(.on)');
    await sw.click();
    await idle(page);
    await hide(page);
    assert.equal(await page.evaluate(() => localStorage.getItem('ms-guide-leave')), null);
    assert.deepEqual(errors, []);
  });
  test('a new guide from a photo is in the Library straight after Build (a reload a moment later keeps it)', async () => {
    const { page, errors } = await openApp();
    await welcome(page, 'look');
    await idle(page);
    await pickPhoto(
      page,
      await readFile(join(ROOT, 'e2e', 'fixtures', 'letter-page.png')),
      'letter-page.png',
    );
    await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 60000 });
    await idle(page);
    await buildGo(page);
    await page.waitForFunction(() => __mstest.assignData && __mstest.sfmode === 'guide', null, {
      timeout: 60000,
    });
    await page.waitForTimeout(250);
    await page.reload();
    await idle(page);
    assert.equal(await page.evaluate(() => state.saved.filter((s) => s.type === 'guide').length), 1);
    assert.deepEqual(errors, []);
  });
  test('a guide file whose sections have no markers is refused', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await saveGuide(page);
    const file = await page.evaluate(() =>
      IDB.get('guide-' + __mstest.curId).then((p) =>
        JSON.stringify({
          app: 'marker-studio',
          type: 'guide',
          name: 'Empty',
          W: __mstest.W,
          H: __mstest.H,
          keys: [],
          n: 0,
          payload: Object.assign({}, p, { assign: {} }),
        }),
      ),
    );
    const n0 = await page.evaluate(() => state.saved.length);
    await page.evaluate(
      (txt) => SF.importFile(new File([txt], 'empty.json', { type: 'application/json' })),
      file,
    );
    await idle(page, 1500);
    assert.match(await page.textContent('#sfMeta'), /isn’t a Marker Studio guide/);
    assert.equal(await page.evaluate(() => state.saved.length), n0);
    assert.deepEqual(errors, []);
  });
}

// ---- from v289.test.mjs ----
// v289: fixes from the fresh-eyes review of v288 — ← Plan › Discard of edits brought back by Resume, a palette held for
// the next guide and a photo that won't open, section edits beyond Undo, Use in a guide › Recolour from Colour along,
// Change colour after an iPad turns, a backup restored over a guide deleted while open, Generate keeping the keyboard,
// Edit sections' tools on a phone's first screen, the guide saved at once on leaving it, focus after Change colour.
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
  const stored = (page, id) =>
    page.evaluate(
      (id) =>
        IDB.get('guide-' + id).then(
          (p) => p && { prog: (p.prog || []).length, n: Object.keys(p.assign || {}).length },
        ),
      id,
    );
  const hide = (page) =>
    page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
      delete document.visibilityState;
    });
  const bigSec = (page, i = 2) =>
    page.evaluate((i) => {
      const t = __mstest;
      return t.assignData.order.slice().sort((a, b) => t.comps[b].area - t.comps[a].area)[i];
    }, i);
  async function excludeOne(page) {
    await page.click('#sfBack2');
    await idle(page);
    await scrollTop(page);
    const l = await bigSec(page);
    const p = await sectionPoint(page, l);
    await page.mouse.click(p.x, p.y);
    await page.waitForFunction((l) => !__mstest.counted(l), l);
    return l;
  }
  test('← Plan › Discard edits on section edits brought back by Resume opens the guide as built; a tick then saves it as built', async () => {
    const { page, errors } = await openApp();
    await answerAsks(page);
    await sampleGuide(page);
    await saveGuide(page);
    const id = await page.evaluate(() => __mstest.curId),
      n0 = await page.evaluate(() => __mstest.assignData.N);
    await tickN(page, 3);
    await idle(page, AUTO);
    const l = await excludeOne(page);
    await hide(page);
    await idle(page);
    await page.reload();
    await page.waitForSelector('#sfResume', { state: 'visible' });
    await page.click('#sfResumeGo');
    await page.waitForFunction((id) => __mstest.curId === id && __mstest.assignData, id);
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.sfmode), 'review');
    // ← Plan asks; Discard edits
    await page.evaluate(() => scrollTo(0, 99999));
    await idle(page);
    await page.click('#sfToPlan');
    await page.waitForSelector('#sfEdAsk');
    await page.click('#sfEdAsk [data-a="discard"]');
    await page.waitForFunction(() => __mstest.sfmode !== 'review' && __mstest.assignData);
    await idle(page);
    assert.equal(await page.evaluate((l) => __mstest.counted(l), l), true, 'the section left out is back');
    assert.equal(await page.evaluate(() => __mstest.assignData.N), n0, 'as built');
    await tickN(page, 1, 5);
    await page.evaluate(() => __mstest.flushSave());
    await idle(page, AUTO);
    assert.equal((await stored(page, id)).n, n0, 'the Library guide keeps every section');
    assert.deepEqual(errors, []);
  });
  test('Library: the line under the title fits what is there', async () => {
    const { page, errors } = await openApp();
    await page.evaluate(() => {
      state.saved = [];
      save();
      openLibrary();
    });
    assert.equal(await page.textContent('#libSub'), 'Your guides and palettes are kept here.');
    await page.evaluate(() => {
      state.saved.push({
        id: 9001,
        type: 'palette',
        name: 'P',
        keys: [...state.owned].slice(0, 3),
        ts: Date.now(),
      });
      save();
      renderSaved();
    });
    assert.equal(await page.textContent('#libSub'), 'Tap a palette to load it.');
    await page.evaluate(() => {
      state.saved = [
        {
          id: 9002,
          type: 'guide',
          name: 'G',
          keys: [...state.owned].slice(0, 3),
          ts: Date.now(),
          n: 10,
          done: 0,
        },
      ];
      save();
      renderSaved();
    });
    assert.equal(await page.textContent('#libSub'), 'Tap a guide to open it.');
    assert.deepEqual(errors, []);
  });
  test(
    'Back after a reload with something open, and after closing things in the app, still closes one thing at a time',
    notOnWebKit(WK.back),
    async () => {
      const { page, errors } = await openApp();
      await answerAsks(page);
      await sampleGuide(page);
      await saveGuide(page);
      await idle(page);
      const back = async () => {
        await page.goBack({ waitUntil: 'commit' }).catch(() => {});
        await page.waitForTimeout(150);
        await idle(page);
      };
      await page.evaluate(() => openLibrary());
      await page.waitForTimeout(100);
      await page.reload();
      await idle(page);
      assert.ok(
        await page.evaluate(() => history.state && history.state.msLayer),
        'an entry left from before the reload',
      );
      // the entry left from before the reload belongs to nothing: opened and closed things count from it
      await page.evaluate(() => openLibrary());
      await page.waitForTimeout(100);
      await back();
      assert.equal(await page.isVisible('#savedOverlay'), false, 'Back closes the Library');
      for (let i = 0; i < 3; i++) {
        await page.evaluate(() => openLibrary());
        await page.waitForTimeout(80);
        await page.click('#savedClose');
        await page.waitForTimeout(120);
      }
      await page.evaluate(() => openLibrary());
      await page.waitForTimeout(100);
      await page.click('#savedList .stile .sopen');
      await idle(page);
      await page.click('#sfColor');
      await idle(page);
      await page.waitForTimeout(100);
      await back();
      assert.equal(
        await page.evaluate(() => __mstest.sfmode),
        'guide',
        'Back from Colour along goes to the Plan',
      );
      assert.equal(await page.isVisible('#sfRoot'), true, 'still in the app');
      assert.deepEqual(errors, []);
    },
  );
}

// ---- from v298.test.mjs ----
// v298: fixes from the second fresh-eyes review of v297 — ticks follow merged and split sections; Focus mode says
// where it is up to; zones keep touching sections apart across their borders; a guide file with odd keys opens; the
// sets list follows Clear collection; and Scan's box: the same text again is still cleared, Enter then the same cap
// again is read, letters composed by an Android keyboard wait for Enter, and a card isn't repeated while held.
{
  test('a guide file whose keys include "constructor" or "toString" opens, the rest of it as it was', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await page.evaluate(() => {
      const t = __mstest,
        d = t.currentDesignObj(),
        p = Object.assign({}, d.payload, { name: 'Odd', W: d.W, H: d.H });
      p.assign = Object.assign({ constructor: 'Ohuhu|R14', toString: 'Ohuhu|R14' }, p.assign);
      p.locks = { constructor: 'Ohuhu|R14' };
      p.prog = (p.prog || []).concat(['constructor', 'hasOwnProperty']);
      t.openDesignObj(p, null);
    });
    await page.waitForFunction(() => __mstest.curName === 'Odd');
    await idle(page);
    const r = await page.evaluate(() => {
      const t = __mstest;
      return {
        N: t.assignData.N,
        ok: t.assignData.order.every(
          (l) => Number.isInteger(l) && t.assignData.assign[l] && t.assignData.assign[l].mkey,
        ),
      };
    });
    assert.ok(r.N > 20 && r.ok, JSON.stringify(r));
    assert.doesNotMatch(
      await page.evaluate(() =>
        [...document.querySelectorAll('#msToast, .mserr, #sfMeta')].map((e) => e.textContent).join(' '),
      ),
      /Couldn’t open that guide/,
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
  const hide = (page) =>
    page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
      delete document.visibilityState;
    });
  const slot = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('ms-guide-auto') || 'null'));
  const reopen = async (page, id) => {
    // (v307.1: page.reload waits for the new page. location.reload() from evaluate returned before the reload began, so
    // waitForLoadState answered for the old page, and what came next could run there and be cut off by the reload:
    // "Execution context was destroyed", seen once in CI. Not a reload of the app's own: checked, there's only this one)
    await page.reload();
    await idle(page);
    await page.evaluate((id) => SF.openDesign(id), id);
    await page.waitForFunction((id) => window.__mstest && __mstest.assignData && __mstest.curId === id, id);
    await idle(page, 1500);
  };
  test('section edits kept for Resume from an earlier visit survive opening the guide and leaving Edit sections unchanged', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await saveGuide(page);
    const id = await page.evaluate(() => __mstest.curId);
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
    await hide(page);
    await page.waitForFunction(() => {
      const m = JSON.parse(localStorage.getItem('ms-guide-auto') || 'null');
      return m && m.edits === 1;
    });
    await page.reload();
    await idle(page);
    // the same guide from the Library (not Resume), Edit sections, and back with nothing changed
    await page.evaluate((id) => {
      setMode('sections');
      SF.openDesign(id);
    }, id);
    await page.waitForFunction(() => __mstest.assignData);
    await idle(page);
    await page.click('#sfBack2');
    await idle(page);
    await page.click('#sfToPlan');
    await idle(page, 1500);
    const m = await slot(page);
    assert.ok(
      m && m.edits === 1 && m.savedId === id,
      'the earlier visit’s edits are still there: ' + JSON.stringify(m),
    );
    assert.deepEqual(errors, []);
  });
  test('a guide with merged sections keeps its section numbers when opened, so ticks kept as the page went away aren’t lost', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await page.click('#sfBack2');
    await idle(page);
    await page.evaluate(() => {
      const t = __mstest,
        o = t.assignData.order.filter((l) => t.counted(l));
      t.mergeCellsSnap(o[3], o[4]);
      t.render();
    });
    await buildGo(page);
    await idle(page);
    await saveGuide(page);
    await idle(page, 2000);
    const id = await page.evaluate(() => __mstest.curId);
    await reopen(page, id);
    assert.equal(
      await page.evaluate(() =>
        IDB.get('guide-' + __mstest.curId).then((p) => p.lmap === __mstest.lmapURL()),
      ),
      true,
      'the picture as stored',
    );
    // ticks, then the page is hidden and the database write never lands (a phone freezing the page)
    await page.evaluate(() => {
      const t = __mstest;
      t.assignData.order.slice(10, 13).forEach((l) => {
        t.colored[l] = 1;
      });
      t.guideDirty = true;
      t.renderGuide();
      const op = IDB.put;
      IDB.put = function (k, v) {
        if (/^guide-/.test(k)) return new Promise(() => {});
        return op(k, v);
      };
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await reopen(page, id);
    assert.equal(await page.evaluate(() => __mstest.colored.reduce((a, b) => a + b, 0)), 3);
    assert.deepEqual(errors, []);
  });
}

// ---- from v306-smalls.test.mjs ----
// v306 small changes: find by code for a code that's only a highlight or shadow in the guide; "Did any run low?" ›
// Another… says when a marker is already marked (and Escape clears, then closes, its box); the run-low chips follow
// a change to a marker made while they show; the shorter untick toast; a guide smoothed with shading on reopens as
// saved.
{
  // the sample at one marker per section from Ben's 451
  async function benGuide(page) {
    await sampleGuide(page);
    await idle(page);
    await page.evaluate(() => {
      state.owned = new Set(defaultOwned());
      save();
      SF.setCollection(sfCollection());
      __mstest.styleVars.limitN = 999;
      SF.reassign();
    });
    await idle(page);
  }
  // ---- a smoothed, shaded guide reopens as saved ----

  test('a guide smoothed with shading on reopens with its markers exactly as saved, one the fix now leaves out too', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await benGuide(page);
    const r = await page.evaluate(() => {
      const t = __mstest;
      t.shadeMode = 'full';
      t.styleVars.gradFix = true;
      SF.reassign();
      const d = t.currentDesignObj(),
        p = JSON.parse(JSON.stringify(d.payload)),
        A = t.assignData.assign;
      // as an earlier build may have smoothed it: a section given the other brand of a highlight's code
      let put = null;
      for (const l of t.assignData.order.slice(1)) {
        const s = t.shadeSec(l),
          x = s && s.light;
        if (!x) continue;
        const o = t.coll.find((m) => m.code === x.code && m.brand !== x.brand);
        if (o && !Object.values(A).some((m) => m.mkey === o.mkey)) {
          const l2 = t.assignData.order.find((q) => q !== l && q !== t.assignData.order[0]);
          p.assign[l2] = o.mkey;
          put = o.mkey;
          break;
        }
      }
      t.openDesignObj(Object.assign({}, p, { name: 'Smoothed', W: d.W, H: d.H }), null);
      return { want: p.assign, put };
    });
    await idle(page);
    assert.ok(r.put, 'a marker to put in');
    const got = await page.evaluate(() => {
      const A = __mstest.assignData.assign,
        o = {};
      for (const l in A) o[l] = A[l].mkey;
      return o;
    });
    assert.deepEqual(got, r.want);
    assert.equal(await page.evaluate(() => __mstest.styleVars.gradFix), true);
    assert.deepEqual(errors, []);
  });
}

// ---- from v308-1.test.mjs ----
// v308.1: while the Library (or any dialog) is open, the page under it stays still — a swipe on a short Library had
// scrolled Home behind it, which on an iPad moved Safari's bars and showed a strip of Home's guides at the foot.
{
  test('All guides from Home: the Library covers the screen and Home under it does not scroll; closed, Home scrolls again', async () => {
    const { page, errors } = await openApp({ width: 390, height: 600 });
    await sampleGuide(page);
    await saveGuide(page);
    await page.click('#mHome');
    await idle(page);
    await page.evaluate(() => scrollTo(0, 120));
    await idle(page);
    const y0 = await page.evaluate(() => scrollY);
    assert.ok(y0 > 0, 'Home scrolls: ' + y0);
    await page.click('#sfRecent [data-lib]');
    await page.waitForSelector('#savedOverlay.on');
    await idle(page);
    assert.equal(
      await page.evaluate(() => document.documentElement.classList.contains('ms-ovl')),
      true,
      'the page held',
    );
    const ov = await page.evaluate(() => {
      const r = document.getElementById('savedOverlay').getBoundingClientRect();
      return [r.top, r.bottom, innerHeight];
    });
    assert.ok(ov[0] <= 0 && ov[1] >= ov[2], 'the Library covers the screen: ' + ov);
    // a swipe (here the wheel) on the Library: one guide, so the Library has nothing to scroll; Home stays where it was
    await page.mouse.move(195, 500);
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => scrollY), y0, 'Home did not scroll behind the Library');
    await page.keyboard.press('Escape');
    await idle(page);
    assert.equal(
      await page.evaluate(() => document.documentElement.classList.contains('ms-ovl')),
      false,
      'let go',
    );
    assert.equal(await page.evaluate(() => scrollY), y0, 'Home where it was');
    await page.mouse.wheel(0, -600);
    await page.waitForTimeout(300);
    assert.ok((await page.evaluate(() => scrollY)) < y0, 'and scrolls again');
    assert.deepEqual(errors, []);
  });
  test('a question added to the page (SF.askBox) holds the page too, and lets go when answered', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await idle(page);
    await page.evaluate(() => {
      window.__ask = SF.askBox('Test', 'A question', '<button class="btn-primary" data-a="go">OK</button>');
    });
    await page.waitForSelector('#sfEdAsk');
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains('ms-ovl')), true);
    await page.click('#sfEdAsk [data-a="go"]');
    await page.waitForFunction(() => !document.getElementById('sfEdAsk'));
    await page.waitForFunction(() => !document.documentElement.classList.contains('ms-ovl'));
    assert.deepEqual(errors, []);
  });
}

// ---- from v308-library.test.mjs ----
// v308 Library: ⋯ › Duplicate; a guide file that's already here asks before making a twin; "… (n)" names; a damaged
// guide says so once, with Restore it from a backup and Delete it; a photo picked in Import a guide can become one;
// guide files carry the app's version and a name in any script.
{
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
  const flush = async (page) => {
    await page.evaluate(() => __mstest.flushSave());
    await idle(page);
  };
  const guides = (page) =>
    page.evaluate(() =>
      state.saved
        .filter((s) => s.type === 'guide')
        .map((s) => ({ id: s.id, name: s.name, done: s.done || 0 })),
    );
  const stored = (page, id) => page.evaluate((id) => IDB.get('guide-' + id), id);
  const openLib = async (page) => {
    if (!(await page.isVisible('#savedOverlay'))) {
      await page.evaluate(() => openLibrary());
      await page.waitForSelector('#savedOverlay.on');
    }
  };
  const toastText = (page) =>
    page.evaluate(() => {
      const t = document.getElementById('msToast');
      return t && t.classList.contains('on') ? t.textContent : '';
    });
  const row = (id) => `#savedList .srow[data-id="${id}"]`;
  // the open guide as Share › Guide file writes it
  const guideFile = (page) =>
    page.evaluate(() => {
      const d = __mstest.currentDesignObj(true);
      d.app = appVersion();
      return JSON.stringify(d);
    });
  const importFile = async (page, text, name = 'g.msguide.json') => {
    await openLib(page);
    await page.setInputFiles('#homeImpFile', {
      name,
      mimeType: 'application/json',
      buffer: Buffer.from(text),
    });
  };
  test('⋯ › Duplicate: “… (2)” with the same plan, ticks starting fresh; Open goes to it', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await saveGuide(page);
    await tickN(page, 4);
    const [g] = await guides(page);
    await openLib(page);
    await page.click(row(g.id) + ' .smore');
    assert.deepEqual(await page.$$eval(row(g.id) + ' .smenu button', (b) => b.map((x) => x.textContent)), [
      'Rename',
      'Duplicate',
      'Delete',
    ]);
    await page.click(row(g.id) + ' .sdup');
    await until(page, () => state.saved.filter((s) => s.type === 'guide').length === 2, null, 'the copy');
    await idle(page);
    const copy = (await guides(page)).find((x) => x.id !== g.id);
    assert.equal(copy.name, g.name + ' (2)');
    assert.equal(copy.done, 0);
    const a = await stored(page, g.id),
      b = await stored(page, copy.id);
    assert.equal(a.prog.length, 4, 'the open guide’s ticks were saved first');
    assert.ok(!b.prog || !b.prog.length, 'the copy’s start fresh');
    assert.equal(b.lmap, a.lmap);
    assert.deepEqual(b.assign, a.assign, 'the same plan');
    assert.deepEqual(b.style, a.style);
    assert.equal(await toastText(page), 'Duplicated as “' + copy.name + '”, ticks start fresh Open');
    await page.click('#toastAct');
    await until(page, (id) => __mstest.curId === id && __mstest.assignData, copy.id, 'the copy open');
    // a duplicate of the copy counts on
    await openLib(page);
    await page.click(row(copy.id) + ' .smore');
    await page.click(row(copy.id) + ' .sdup');
    await until(page, () => state.saved.filter((s) => s.type === 'guide').length === 3, null, 'the third');
    assert.ok((await guides(page)).some((x) => x.name === g.name + ' (3)'));
    assert.deepEqual(errors, []);
  });
  test('Import a guide that’s already here: Open it, or Add a copy named “… (2)”; a file with ticks this device lacks leads with Add a copy', async () => {
    const { page, errors } = await openApp({ width: 1180, height: 820 });
    await sampleGuide(page);
    await saveGuide(page);
    await tickN(page, 3);
    await flush(page);
    const [g] = await guides(page);
    const text = await guideFile(page);
    await importFile(page, text);
    await page.waitForSelector('#sfEdAsk');
    assert.equal(await page.textContent('#sfEdAskT'), 'Already in your Library');
    assert.match(
      await page.textContent('#sfEdAskD'),
      new RegExp('^“' + g.name + '” is here, 3 of \\d+ coloured \\(the file: 3\\)\\.$'),
    );
    assert.equal(await page.getAttribute('#sfEdAsk .btn-primary', 'data-a'), 'open');
    await page.click('#sfEdAsk [data-a="open"]');
    await until(page, (id) => __mstest.curId === id && __mstest.assignData, g.id, 'the guide here open');
    assert.equal((await guides(page)).length, 1, 'no twin');
    // Add a copy
    await importFile(page, text);
    await page.waitForSelector('#sfEdAsk');
    await page.click('#sfEdAsk [data-a="copy"]');
    await until(page, () => state.saved.filter((s) => s.type === 'guide').length === 2, null, 'the copy');
    assert.ok((await guides(page)).some((x) => x.name === g.name + ' (2)'));
    // a file further along than this device
    const more = JSON.parse(text);
    more.payload.prog = more.payload.prog.concat(Object.keys(more.payload.assign).slice(30, 33).map(Number));
    await importFile(page, JSON.stringify(more));
    await page.waitForSelector('#sfEdAsk');
    assert.match(
      await page.textContent('#sfEdAskD'),
      /\(the file: 6\)\. The file has ticks this one doesn’t\.$/,
    );
    assert.equal(await page.getAttribute('#sfEdAsk .btn-primary', 'data-a'), 'copy');
    await page.click('#sfEdAsk [data-a="stay"]');
    await idle(page);
    assert.equal((await guides(page)).length, 2, 'Cancel adds nothing');
    assert.deepEqual(errors, []);
  });
  test('a damaged guide: one message, with Delete it (and Undo) and Restore it from a backup, which puts the backup’s copy in its place', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await saveGuide(page);
    const [g] = await guides(page);
    await openLib(page);
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#guidesBackup')]);
    const backup = await readFile(await dl.path());
    await idle(page);
    // its stored section map damaged, then the guide opened from the Library
    await page.evaluate(async (id) => {
      const p = await IDB.get('guide-' + id);
      p.lmap = 'data:image/png;base64,' + 'iVBORw0KGgo' + 'A'.repeat(60);
      await IDB.put('guide-' + id, p);
    }, g.id);
    // (opened afresh, as after a reload: the guide open now is the one in memory)
    await page.reload();
    await idle(page);
    await openLib(page);
    await page.click(row(g.id) + ' .sopen');
    await page.waitForSelector('#sfEdAsk');
    assert.equal(await page.textContent('#sfEdAskT'), 'Can’t open this guide');
    assert.equal(
      await page.textContent('#sfEdAskD'),
      '“' + g.name + '” can’t be opened — its saved section map is damaged.',
    );
    assert.equal(await page.locator('.mserr').count(), 0, 'said once');
    await page.click('#sfEdAsk [data-a="del"]');
    await idle(page);
    assert.equal((await guides(page)).length, 0);
    assert.match(await toastText(page), /^Deleted “.+” Undo$/);
    await page.click('#toastAct');
    await idle(page);
    assert.equal((await guides(page)).length, 1, 'Undo');
    // Restore it from a backup: the file picker opens in the same tap, and the backup's copy replaces it
    await openLib(page);
    await page.click(row(g.id) + ' .sopen');
    await page.waitForSelector('#sfEdAsk');
    const [fc] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.click('#sfEdAsk [data-a="restore"]'),
    ]);
    await fc.setFiles({ name: 'backup.json', mimeType: 'application/json', buffer: backup });
    await until(
      page,
      () => /restored/.test((document.getElementById('msToast') || {}).textContent || ''),
      null,
      'the restore',
    );
    const gs = await guides(page);
    assert.deepEqual(
      gs.map((x) => x.id),
      [g.id],
      'in its place, no “(from backup)” copy',
    );
    await openLib(page);
    await page.click(row(g.id) + ' .sopen');
    await until(page, (id) => __mstest.curId === id && __mstest.assignData, g.id, 'it opens');
    assert.deepEqual(errors, []);
  });
  test('a photo picked in Import a guide can become a new guide; an empty or cut-short guide file says so', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await saveGuide(page);
    const text = await guideFile(page);
    await importFile(page, '', 'empty.msguide.json');
    await page.waitForSelector('#savedOverlay .mserr');
    assert.match(await page.textContent('#savedOverlay .mserr'), /That file is empty\./);
    await page.evaluate(() => document.querySelectorAll('.mserr').forEach((c) => c.remove()));
    await importFile(page, text.slice(0, Math.round(text.length / 2)));
    await page.waitForSelector('#savedOverlay .mserr');
    assert.match(
      await page.textContent('#savedOverlay .mserr'),
      /This guide file is incomplete or damaged — it may not have finished downloading\./,
    );
    const png = await readFile(join(ROOT, 'e2e', 'fixtures', 'letter-page.png'));
    await openLib(page);
    await page.setInputFiles('#homeImpFile', { name: 'IMG_0002.png', mimeType: 'image/png', buffer: png });
    await page.waitForSelector('#sfEdAsk');
    assert.equal(await page.textContent('#sfEdAskT'), 'Make a guide from this photo?');
    await page.click('#sfEdAsk [data-a="go"]');
    await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 60000 });
    assert.equal(await page.isVisible('#savedOverlay'), false);
    assert.deepEqual(errors, []);
  });
  test('a guide file carries the app’s version and a name in any script; one from a newer version asks first', async () => {
    const { page, errors } = await openApp({ width: 1180, height: 820 });
    await sampleGuide(page);
    await saveGuide(page);
    await rename(page, '紫陽花の庭 №2');
    await idle(page);
    // (the name the file is handed over with: a download's own name isn't kept by every browser under test)
    await page.evaluate(() => {
      window.__names = [];
      const h = handOver;
      window.handOver = function (b, n, o) {
        __names.push(n);
        return h(b, n, o);
      };
    });
    await page.click('.sftabbtn[data-t="share"]');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#sfShareGuide')]);
    assert.deepEqual(await page.evaluate(() => __names), ['紫陽花の庭 2.msguide.json']);
    const d = JSON.parse(await readFile(await dl.path(), 'utf8'));
    assert.equal(d.name, '紫陽花の庭 №2');
    assert.equal(d.app, await page.evaluate(() => appVersion()));
    const n0 = (await guides(page)).length;
    d.app = 'v999';
    d.payload.prog = [];
    d.payload.assign[Object.keys(d.payload.assign)[0]] = 'Ohuhu|R014';
    await importFile(page, JSON.stringify(d));
    await page.waitForSelector('#sfEdAsk');
    assert.equal(await page.textContent('#sfEdAskT'), 'Made by a newer Marker Studio');
    assert.deepEqual(await page.$$eval('#sfEdAsk [data-a]', (b) => b.map((x) => x.textContent)), [
      'Open anyway',
      'Cancel',
    ]);
    await page.click('#sfEdAsk [data-a="stay"]');
    await idle(page);
    assert.equal((await guides(page)).length, n0, 'nothing added');
    assert.deepEqual(errors, []);
  });
}

// ---- from v3081-d1.test.mjs ----
// v308.2 (review d1): Home, the Library, data safety and the page lock while dialogs are open.
{
  // v308.1's lock gave the body an overflow of its own, so the body became the scroller the pinned picture and the
  // guide's bar stick to: under any dialog the picture slid up out of place and the bar dropped off the screen
  test('a dialog over a scrolled guide leaves the pinned picture and the bar where they were', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await idle(page);
    await page.evaluate(() => scrollTo(0, 500));
    await idle(page);
    const at = () =>
      page.evaluate(() => {
        const v = document.getElementById('sfView').getBoundingClientRect();
        const b = document.querySelector('#sfRoot .sfbar').getBoundingClientRect();
        return { y: scrollY, view: Math.round(v.top), bar: Math.round(b.bottom) };
      });
    const was = await at();
    assert.ok(was.y > 0 && was.bar <= 1180, 'scrolled, the bar on the screen: ' + JSON.stringify(was));
    await page.evaluate(() => openDialog(document.getElementById('helpOverlay')));
    await frames(page);
    assert.equal(
      await page.evaluate(() => document.documentElement.classList.contains('ms-ovl')),
      true,
      'held',
    );
    assert.deepEqual(await at(), was, 'under Help');
    await page.keyboard.press('Escape');
    await idle(page);
    assert.deepEqual(await at(), was, 'Help closed');
    await page.evaluate(() => {
      window.__a = SF.askBox('Test', 'A question', '<button class="btn-primary" data-a="go">OK</button>');
    });
    await page.waitForSelector('#sfEdAsk');
    await frames(page);
    assert.deepEqual(await at(), was, 'under a question');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.documentElement.classList.contains('ms-ovl'));
    assert.deepEqual(await at(), was, 'question gone');
    assert.deepEqual(errors, []);
  });
}

// ---- from v3101-me.test.mjs ----
// v310.1, from the debugging pass: v310's first-start decision on the section step waits for data it can read; the
// Mood pictures in iPad landscape's column are three a row, the bigger ones (a phone on its side keeps one row of six).
{
  const KEY = 'ohuhu-hb320-picker-v3';
  test('unreadable saved data at v310’s first start: the section step isn’t decided from the empty Library', async () => {
    const { page, errors } = await openApp({
      width: 820,
      height: 1180,
      storage: {
        'ms-sec-tools': null,
        'ms-onboarded': '1',
        'ms-setup-tip': '1',
        [KEY]: '{"saved":[{"type":"gui',
      },
    });
    await idle(page);
    assert.equal(await page.evaluate(() => localStorage.getItem('ms-sec-tools')), null);
    assert.deepEqual(errors, []);
  });
}

// ---- from v313-plan.test.mjs ----
// v313 (the Plan): D3, a marker's family from its code for a guide made since v313 (famRule 1), and a guide saved before
// keeping v312's rule for good, its tones' markers and blend companions as they were. D7, a marker running low: a line
// under the tabs with Swap it, and "low" on its Colour along row and in the markers on the page. D4, the one-time
// "Screens and ink differ" line, whose link opens Print with Test strip, and the tab "Share & print" where it fits.
{
  const sv = (page, k) => page.evaluate((k) => __mstest.styleVars[k], k);
  async function reopen(page, id) {
    await page.reload();
    await idle(page);
    await page.evaluate((id) => loadGuide({ id }), id);
    await page.waitForFunction((id) => __mstest.curId === id && __mstest.assignData, id);
    await idle(page);
  }
  // a marker you own whose blend companion and whose shadow (Same colour) differ between the two rules, and both picks
  // under each
  const differing = (page) =>
    page.evaluate(() => {
      const t = __mstest,
        sv = t.styleVars,
        was = sv.famRule,
        coll = t.coll,
        at = (r, f) => {
          sv.famRule = r;
          const v = f();
          sv.famRule = was;
          return v ? v.mkey : null;
        };
      let comp = null,
        shade = null;
      for (const m of coll) {
        if (!comp) {
          const a = at(0, () => t.colour.companion(m.lab, m, coll, 1)),
            b = at(1, () => t.colour.companion(m.lab, m, coll, 1));
          if (a !== b) comp = { k: m.mkey, old: a, now: b };
        }
        if (!shade) {
          const a = at(0, () => t.shadePick(m, coll, 1)),
            b = at(1, () => t.shadePick(m, coll, 1));
          if (a && b && a !== b) shade = { k: m.mkey, old: a, now: b };
        }
        if (comp && shade) break;
      }
      return { comp, shade };
    });
  const darkCompanion = (page, k) =>
    page.evaluate((k) => {
      const m = __mstest.coll.find((x) => x.mkey === k),
        c = __mstest.colour.companions(m);
      return c.darkOwned && c.dark ? c.dark.mkey : null;
    }, k);
  const shadow = (page, k) =>
    page.evaluate((k) => {
      const m = __mstest.coll.find((x) => x.mkey === k),
        d = __mstest.shadeTones(m).dark;
      return d ? d.mkey : null;
    }, k);
  test('a new guide (the sample) takes the newest family rule (v318’s 4), saves it and opens with it', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    assert.equal(await sv(page, 'famRule'), 4);
    assert.equal(await page.evaluate(() => __mstest.currentDesignObj().payload.famRule), 4);
    await saveGuide(page);
    const id = await page.evaluate(() => __mstest.curId);
    await reopen(page, id);
    assert.equal(await sv(page, 'famRule'), 4);
    assert.deepEqual(errors, []);
  });
  test('a guide saved before v313 keeps v312’s rule: its shadows and blend companions are as they were, saved as it was; the tones aren’t mixed up between the two', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await page.click('.sftabbtn[data-t="shading"]');
    await page.evaluate(() => __mstest.shadeTo('full'));
    await idle(page);
    const d = await differing(page);
    assert.ok(d.comp && d.shade, JSON.stringify(d));
    assert.equal(await shadow(page, d.shade.k), d.shade.now, 'a new guide: the shadow by v313’s rule');
    // (a guide from v312: no famRule saved)
    await page.evaluate(() => {
      __mstest.styleVars.famRule = 0;
    });
    await saveGuide(page);
    const id = await page.evaluate(() => __mstest.curId);
    assert.equal(
      await page.evaluate(() => 'famRule' in __mstest.currentDesignObj().payload),
      false,
      'saved as v312 saved it',
    );
    await reopen(page, id);
    assert.equal(await sv(page, 'famRule'), 0);
    assert.equal(await darkCompanion(page, d.comp.k), d.comp.old, 'its blend companion as v312 had it');
    assert.equal(await shadow(page, d.shade.k), d.shade.old, 'its shadow as v312 had it');
    // the tones kept for one rule aren't the other's
    await page.evaluate(() => {
      __mstest.styleVars.famRule = 1;
    });
    assert.equal(await shadow(page, d.shade.k), d.shade.now);
    await page.evaluate(() => {
      __mstest.styleVars.famRule = 0;
    });
    assert.equal(await shadow(page, d.shade.k), d.shade.old);
    assert.deepEqual(errors, []);
  });
}

// ---- from v313-polish.test.mjs ----
// v313 polish (D11): Markers' line about the view under its row; Palette's Undo, Clear, Save and ⋯ on one row; the
// Library's empty state (what's kept there, Try the sample, no search box); the guide's start card in Home's words;
// Edit sections' shorter intro; the shimmer three times; the sample's ticks not on Home's Continue card until it's
// printed or renamed; Continue's "Last coloured N days ago". Each test fails on v312.
{
  const box = (page, s) => page.locator(s).boundingBox();
  test('the Library, empty: what gets kept there and Try the sample; no search box or sort with nothing to search', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await welcome(page, 'look');
    await page.click('#mHome');
    await page.click('#homeLibCard');
    await idle(page);
    assert.equal(await page.isVisible('#savedOverlay .libbar'), false);
    // (v320: the sample's two pages, "Your guides will live here", Choose a photo or the sample)
    assert.match(await page.textContent('#savedList .empty'), /Every guide you make is kept on this device/);
    assert.equal(await page.textContent('#savedList .libemh'), 'Your guides will live here');
    assert.equal(await page.locator('#savedList .libfan img').count(), 2);
    assert.ok(await page.isVisible('#libChoose'), 'Choose a photo');
    await page.click('#libTrySample');
    await page.waitForFunction(() => !!__mstest.assignData, null, { timeout: 60000 });
    await idle(page);
    assert.equal(await page.isVisible('#savedOverlay'), false);
    assert.deepEqual(errors, []);
  });
}

// ---- from v318-polish.test.mjs ----
// v318 polish sweep: smaller fixes found by the v318 reviews, and more of the same kind. Each test fails without its fix.
{
  const ONBOARDED = { 'ms-onboarded': '1', 'ms-setup-tip': '1' };
  // A guide goes into the Library by itself as it's built, once its first bloom is over; leaving before then saves it
  // as the page goes. In Chromium that database write, begun as the page went, was dropped by a reload (WebKit kept it):
  // the write is now committed at once.
  test('reloading just as a new guide appears keeps it in the Library', async () => {
    const buf = await readFile(new URL('./fixtures/letter-page.png', import.meta.url));
    // (the reload has to come before the save starts by itself, about a second on: on a busy machine the guide can be
    // seen only later, so up to three tries)
    let tried = 0;
    for (let i = 0; i < 3 && !tried; i++) {
      const { page, errors, ctx } = await openApp({ width: 820, height: 1180, storage: ONBOARDED });
      await page.click('#mSections');
      await idle(page);
      await page.setInputFiles('#sfFile', { name: 'letter-page.png', mimeType: 'image/png', buffer: buf });
      await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 60000 });
      await idle(page);
      await page.click('#sfBuild');
      await page.waitForFunction(() => __mstest.assignData && __mstest.sfmode === 'guide', null, {
        timeout: 60000,
        polling: 'raf',
      });
      const early = await page.evaluate(() => !state.saved.some((s) => s.type === 'guide'));
      await page.reload();
      if (!early) {
        await ctx.close();
        continue;
      }
      tried++;
      await page.waitForFunction(() => typeof state !== 'undefined' && document.readyState === 'complete');
      await idle(page);
      const r = await page.evaluate(async () => {
        const g = state.saved.filter((s) => s.type === 'guide');
        return { n: g.length, stored: g.length ? !!(await IDB.get('guide-' + g[0].id)) : false };
      });
      assert.deepEqual(r, { n: 1, stored: true });
      assert.deepEqual(errors, []);
    }
    assert.equal(tried, 1, 'reloaded before the save began by itself');
  });
  // The Photo pattern's lighting correction (white balance from the photo's paper) was saved rounded to 4 places, so a
  // reopened guide's corrected photo, and shading lit from it, came out a level or two off in a few pixels.
  test('a Photo pattern guide’s lighting correction reopens exactly as it was saved', async () => {
    const { page, errors } = await openApp();
    await haveSet(page);
    await page.check('#wcSets input[data-i="6"]');
    await page.click('#wcAdd');
    await page.click('#wcSample');
    await page.waitForFunction(() => !!(window.__mstest && __mstest.assignData));
    // a page photographed in dim, warm light: grey-brown paper, a dark red and a dull yellow, with noise
    const b64 = await page.evaluate(() => {
      const c = document.createElement('canvas');
      c.width = 600;
      c.height = 800;
      const g = c.getContext('2d'),
        px = (r, gg, b, x, y, w, h) => {
          g.fillStyle = 'rgb(' + r + ',' + gg + ',' + b + ')';
          g.fillRect(x, y, w, h);
        };
      px(182, 170, 152, 0, 0, 600, 800);
      px(128, 42, 36, 0, 400, 300, 400);
      px(186, 172, 98, 300, 400, 300, 400);
      const d = g.getImageData(0, 0, 600, 800);
      let sd = 12345;
      const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < d.data.length; i += 4) {
        const n = (rnd() - 0.5) * 10;
        d.data[i] += n;
        d.data[i + 1] += n;
        d.data[i + 2] += n;
      }
      g.putImageData(d, 0, 0);
      return c.toDataURL('image/png').split(',')[1];
    });
    await page.click('.sftabbtn[data-t="pattern"]');
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#sfFam [data-v="photo"]')]);
    await fc.setFiles({ name: 'ref.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
    await page.waitForFunction(() => !!__mstest.photoRef);
    await idle(page);
    const gain = await page.evaluate(() => __mstest.photoRef.lit && __mstest.photoRef.lit.fix.gain.slice());
    assert.ok(
      gain && gain.some((g) => Math.round(g * 1e4) / 1e4 !== g),
      'corrected, with gains that rounding changes',
    );
    await page.click('#sfPhAlign');
    await saveGuide(page);
    await idle(page);
    const id = await page.evaluate(() => __mstest.curId);
    await page.evaluate(() => SF.loadSample());
    await idle(page, 1200);
    await page.evaluate((id) => SF.openDesign(id), id);
    await idle(page, 1500);
    await page.waitForFunction(() => !!(__mstest.photoRef && __mstest.photoRef.lit));
    await idle(page);
    assert.deepEqual(await page.evaluate(() => __mstest.photoRef.lit.fix.gain.slice()), gain);
    assert.deepEqual(errors, []);
  });
}

// ---- from v3181-bin.test.mjs ----
// v318.1: Recently deleted. A guide or palette deleted from the Library waits there for a week after the Undo toast has
// gone, through reloads: Put back brings it back as it was (a guide's progress and picture with it); Delete them now,
// or the week up, removes it for good. Fails on v318 (the stored guide went 6 seconds after Delete).
{
  const stored = (page, id) => page.evaluate((id) => IDB.get('guide-' + id).then((v) => !!v), id);
  const shown = (page, id) =>
    page.evaluate((id) => {
      const e = document.getElementById(id);
      return !!e && !e.hidden && e.getClientRects().length > 0;
    }, id);
  test('Recently deleted: a guide deleted waits a week, through a reload; Put back brings it back as it was stored', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await saveGuide(page);
    const g = await page.evaluate(() => {
      const s = state.saved.find((x) => x.type === 'guide');
      return { id: s.id, name: s.name, n: s.n };
    });
    await page.evaluate(() => setMode('home'));
    await page.evaluate(() => openLibrary());
    await page.waitForSelector('#savedOverlay.on');
    assert.equal(await shown(page, 'libBin'), false, 'nothing deleted yet');
    await page.evaluate((id) => libDelete(id), g.id);
    await idle(page);
    // (the Undo toast's time up)
    await page.evaluate(() => libFinish());
    assert.equal(await page.textContent('#libBin'), 'Recently deleted (1)');
    assert.ok(await stored(page, g.id), 'its stored guide kept');
    await page.reload();
    await idle(page, 2500);
    assert.ok(await stored(page, g.id), 'kept through a reload');
    await page.evaluate(() => openLibrary());
    await page.waitForSelector('#savedOverlay.on');
    assert.ok(await shown(page, 'libBin'));
    await page.click('#libBin');
    await page.waitForSelector('#sfEdAsk');
    assert.match(await page.textContent('#sfEdAsk'), /Kept on this device for 7 days/);
    assert.match(
      await page.textContent('#sfEdAsk'),
      new RegExp('Put back “' + g.name + '” guide, deleted today'),
    );
    await page.click('#sfEdAsk [data-a="put:' + g.id + '"]');
    await idle(page);
    const back = await page.evaluate((id) => state.saved.find((s) => s.id === id), g.id);
    assert.ok(back, 'in the Library again');
    assert.equal(back.n, g.n);
    assert.equal(await shown(page, 'libBin'), false);
    assert.equal(await page.evaluate(() => localStorage.getItem('ms-lib-deleting')), null);
    // it opens
    const d = await page.evaluate((id) => sfLoadDesign(id).then((d) => !!(d && d.W && d.assign)), g.id);
    assert.ok(d);
    assert.deepEqual(errors, []);
  });
  test('Recently deleted: a week up, it goes for good at the next start; Delete them now at once; a palette too', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await saveGuide(page);
    const id = await page.evaluate(() => state.saved.find((x) => x.type === 'guide').id);
    await page.evaluate(() => setMode('home'));
    await page.evaluate((id) => (libDelete(id), libFinish()), id);
    // (deleted eight days ago)
    await page.evaluate(() => {
      const l = JSON.parse(localStorage.getItem('ms-lib-deleting'));
      l.forEach((x) => (x.t = Date.now() - 8 * 864e5));
      localStorage.setItem('ms-lib-deleting', JSON.stringify(l));
    });
    await page.reload();
    await idle(page, 2500);
    await page.waitForFunction(() => localStorage.getItem('ms-lib-deleting') === null);
    assert.equal(await stored(page, id), false, 'gone for good');
    // a palette: deleted, put back; deleted again, Delete them now
    const pid = await page.evaluate(() => {
      const e = { id: 4242, type: 'palette', name: 'Sea', keys: ['Ohuhu|B08', 'Ohuhu|G07'], ts: Date.now() };
      state.saved.unshift(e);
      save();
      libDelete(4242);
      libFinish();
      return e.id;
    });
    await page.evaluate(() => openLibrary());
    await page.waitForSelector('#savedOverlay.on');
    await page.click('#libBin');
    await page.waitForSelector('#sfEdAsk');
    assert.match(await page.textContent('#sfEdAsk'), /Put back “Sea” palette, deleted today/);
    await page.click('#sfEdAsk [data-a="put:' + pid + '"]');
    await idle(page);
    assert.ok(await page.evaluate((id) => state.saved.some((s) => s.id === id), pid));
    await page.evaluate((id) => (libDelete(id), libFinish()), pid);
    await page.click('#libBin');
    await page.waitForSelector('#sfEdAsk');
    await page.click('#sfEdAsk [data-a="purge"]');
    await idle(page);
    assert.equal(await page.evaluate(() => localStorage.getItem('ms-lib-deleting')), null);
    assert.equal(await shown(page, 'libBin'), false);
    assert.deepEqual(errors, []);
  });
}

// ---- from v31825-x4.test.mjs ----
// v318.25 in the browser.
{
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
}

// ---- from v31828-y3.test.mjs ----
// v318.28 in the browser: using a guide, saving, output (Y3).
{
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
}
