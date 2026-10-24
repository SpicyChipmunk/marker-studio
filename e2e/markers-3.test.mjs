// Markers: the grid, details, sets, To buy, the swatch chart, dry and running low.
// (v320) Tests organised by feature: each block below came from the file named above it, its tests unchanged.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addFromMarkers,
  answerAsks,
  idle,
  letterGuide,
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

before(setup);
after(teardown);

// ---- from v316.test.mjs ----
// v316's interface: Markers' families lightest first, with Order (Lightest first | Code order) in every grid view and a
// saved Code order moved to Lightest first once; an upright iPad's Plan starting a narrow picture at its floor, and
// Colour along's first row on the first screen; How it works on a new user's Home; one picked tint. Fails on v315.
{
  // the codes of a family's markers of one brand, as the grid shows them, with their lightness
  const family = (page, fam, brand) =>
    page.evaluate(
      ([fam, brand]) => {
        const g = [...document.querySelectorAll('.rgroup')].find((x) =>
          new RegExp('^' + fam + '\\b').test(x.querySelector('.rghead').textContent.trim()),
        );
        return [...g.querySelectorAll('.cell, [data-i]')]
          .map((c) => +c.dataset.i)
          .filter((i) => i >= 0 && COLORS[i].brand === brand)
          .map((i) => ({ code: COLORS[i].code, L: LAB[i][0] }));
      },
      [fam, brand],
    );
  const opts = (page) => page.$$eval('#gapSort option', (a) => a.map((o) => o.value));
  // the picture's height on the screen, and whether Colour along's first marker row is wholly above the bar
  // (v320: the picture's frame on an iPad, the page and the paper's gutter round it: #sfPic)
  const picH = (page) =>
    page.evaluate(() => Math.round(document.getElementById('sfPic').getBoundingClientRect().height));
  // (v318.7: waited for, up to 3 s, as the picture's height settles: a slow WebKit on GitHub measured it mid-change once,
  // "Colour along: 708" — 708 by the time the message read it)
  const picNear = async (page, want) => {
    await page
      .waitForFunction(
        (w) => Math.abs(Math.round(document.getElementById('sfPic').getBoundingClientRect().height) - w) <= 2,
        want,
        { timeout: 3000 },
      )
      .catch(() => {});
    return Math.abs((await picH(page)) - want) <= 2;
  };
  const firstRowShows = (page) =>
    page.evaluate(() => {
      scrollTo(0, 0);
      const bar = [...document.querySelectorAll('.sfbar')].find((b) => b.offsetParent),
        r = document.querySelector('#sfAlist .sfarow');
      return r.getBoundingClientRect().bottom <= bar.getBoundingClientRect().top;
    });
  test('Markers: families lightest first; Order in Owned, Unowned and All (two orders, five in Unowned), not To buy', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await welcome(page, 'look');
    await idle(page);
    await page.click('#mCollection');
    await page.click('#ownView [data-v="all"]');
    await idle(page);
    assert.equal(await page.inputValue('#gapSort'), 'light');
    const red = await family(page, 'Red', 'Ohuhu');
    assert.ok(red.length > 10);
    for (let i = 1; i < red.length; i++)
      assert.ok(
        red[i].L <= red[i - 1].L + 1e-9,
        'lightest first: ' + red[i - 1].code + ' then ' + red[i].code,
      );
    for (const v of ['owned', 'all']) {
      await page.click('#ownView [data-v="' + v + '"]');
      await idle(page);
      assert.ok(await page.isVisible('#gapSort'), v);
      assert.deepEqual(await opts(page), ['light', 'code'], v);
    }
    await page.click('#ownView [data-v="unowned"]');
    await idle(page);
    assert.deepEqual(await opts(page), ['light', 'code', 'gap', 'ramps', 'complete']);
    // a ranking chosen in Unowned shows as Lightest first in Owned
    await page.selectOption('#gapSort', 'gap');
    await idle(page);
    await page.click('#ownView [data-v="owned"]');
    await idle(page);
    assert.equal(await page.inputValue('#gapSort'), 'light');
    await page.click('#ownView [data-v="wish"]');
    await idle(page);
    assert.equal(await page.isVisible('#gapSort'), false, 'not on To buy');
    // Code order: by the code's text
    await page.click('#ownView [data-v="all"]');
    await idle(page);
    await page.selectOption('#gapSort', 'code');
    await idle(page);
    const byCode = (await family(page, 'Red', 'Ohuhu')).map((m) => m.code);
    assert.deepEqual(byCode, byCode.slice().sort());
    assert.deepEqual(errors, []);
  });
  test('a Code order saved before v316 becomes Lightest first once; Code order chosen after that stays', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await welcome(page, 'look');
    await idle(page);
    // as v315 saved it: Code order, and no note that the move was made
    await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem(KEY));
      s.gapSort = 'code';
      delete s.ordLight1;
      localStorage.setItem(KEY, JSON.stringify(s));
    });
    await page.reload();
    await idle(page);
    assert.equal(await page.evaluate(() => state.gapSort), 'light');
    await page.click('#mCollection');
    await page.click('#ownView [data-v="all"]');
    await idle(page);
    assert.equal(await page.inputValue('#gapSort'), 'light');
    await page.selectOption('#gapSort', 'code');
    await idle(page);
    await page.reload();
    await idle(page);
    assert.equal(await page.evaluate(() => state.gapSort), 'code', 'kept');
    assert.deepEqual(errors, []);
  });
  test('an upright iPad: a narrow picture starts the Plan at the 50% floor, a page-shaped one at 60%; Colour along 60%, its first row on the first screen', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await idle(page);
    assert.ok(await picNear(page, 590), 'the sample in the Plan: ' + (await picH(page)));
    await page.click('#sfColor');
    await idle(page);
    assert.ok(await picNear(page, 708), 'Colour along: ' + (await picH(page)));
    assert.ok(await firstRowShows(page), 'the first marker row above the bar');
    await page.click('#sfDoneBtn');
    await idle(page);
    await page.click('#mHome');
    await idle(page);
    await page.click('#mSections');
    await idle(page);
    await letterGuide(page);
    await answerAsks(page);
    assert.ok(await picNear(page, 708), 'the Letter page in the Plan: ' + (await picH(page)));
    await page.click('#sfColor');
    await idle(page);
    assert.ok(await firstRowShows(page), 'the Letter page: the first marker row above the bar');
    assert.deepEqual(errors, []);
  });
  test('Home: How it works under the cards on a wide screen until the first guide is made; not on a phone. Owned says no "Your collection."', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await welcome(page, 'look');
    await idle(page);
    await page.click('#mHome');
    await idle(page);
    assert.ok(await page.isVisible('#homeHow'), 'a new user');
    assert.deepEqual(await page.$$eval('#homeHow b', (a) => a.map((b) => b.textContent)), [
      'Photograph a page',
      'Get your guide',
      'Colour along',
    ]);
    await page.setViewportSize({ width: 390, height: 844 });
    await idle(page);
    assert.equal(await page.isVisible('#homeHow'), false, 'a phone');
    await page.setViewportSize({ width: 820, height: 1180 });
    await page.click('#mCollection');
    await idle(page);
    assert.equal(await page.isVisible('#ownHint'), false, 'Owned: no line saying what the switch says');
    await page.click('#ownView [data-v="unowned"]');
    await idle(page);
    assert.ok(await page.isVisible('#ownHint'), 'Unowned keeps its line');
    await page.click('#mSections');
    await idle(page);
    await letterGuide(page);
    await answerAsks(page);
    await page.click('#mHome');
    await idle(page);
    assert.equal(await page.isVisible('#homeHow'), false, 'with a guide made');
    assert.deepEqual(errors, []);
  });
  test('a chosen option in the picked tint, not done’s green: Codes, a Plan choice and a segment alike', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await idle(page);
    const bg = (sel) => page.$eval(sel, (e) => getComputedStyle(e).backgroundColor);
    const pick = await page.evaluate(() => {
      const d = document.createElement('div');
      d.style.background = 'var(--pick-bg)';
      document.body.appendChild(d);
      const c = getComputedStyle(d).backgroundColor;
      d.remove();
      return c;
    });
    // (v320, Ben's D3a: a raised neutral, the ink at 13%, not teal: green is for done)
    assert.match(pick, /rgba\(244, 242, 236, 0\.13\)/);
    assert.equal(await page.getAttribute('#sfCodes', 'aria-pressed'), 'true');
    assert.equal(await bg('#sfCodes'), pick, 'Codes');
    assert.equal(await bg('#sfCtl .sfedit.on'), pick, 'a Plan choice');
    assert.deepEqual(errors, []);
  });
}

// ---- from v31821-caps.test.mjs ----
// v318.21 in the browser, the code on your cap: Markers shows an older cap's code and name ("R6 Rose Red", now R213),
// the marker's details have "My cap says" to switch it, Markers' ⋯ switches the rest; Scan's Add notes what the caps
// read say and, once, offers the rest; Colour along asks once which codes your caps show. Fails on v318.20.
{
  const KEY = 'ohuhu-hb320-picker-v3';
  const stored = (extra) => ({
    'ms-onboarded': '1',
    'ms-setup-tip': '1',
    'ms-last-ver': 'v318',
    'ms-scan-brand': '',
    [KEY]: JSON.stringify(
      Object.assign(
        {
          mode: 'collection',
          ownedSeedV: 2,
          copicAdd1: 1,
          libAdj1: 1,
          setFix1: 1,
          owned: ['Ohuhu|R213', 'Ohuhu|B115', 'Ohuhu|CG18'],
          saved: [],
        },
        extra,
      ),
    ),
  });
  const cellText = (page, k) =>
    page.evaluate((k) => {
      const el = document.querySelector('#results .cell[data-i="' + keyIdx(k) + '"] .cc');
      return el ? el.textContent : null;
    }, k);
  // a photo's reading made up (nothing of anyone's): older Ohuhu caps
  function read(page, caps) {
    return page.evaluate((caps) => {
      scanList = [];
      ocrAnswered = [];
      ocrPhotos = 0;
      scanBrand = '';
      const r = {
        n: ++ocrPhotos,
        items: new Map(),
        taken: new Set(),
        brands: {},
        sure: 0,
        p: null,
        done: false,
        note: '',
      };
      ocrRun = r;
      const lines = caps.map((t, k) => ({
        id: k + 1,
        look: 1,
        text: t,
        conf: 0.97,
        unsure: false,
        nameOf: 0,
        box: [300 * (k % 6), 400 * Math.floor(k / 6), 60, 30, 0],
      }));
      lines.forEach((it) => ocrLine(r, it));
      ocrDone(r, { lines: lines, stat: {}, ms: 1, aborted: false });
      clearTimeout(r.soon);
      ocrRun = null;
      scanSaveList();
      scanRender();
      scanAddState();
    }, caps);
  }
  test('Markers: an older cap’s code; its details say "now R213" and switch it; ⋯ switches the rest, with Undo', async () => {
    const { page, errors } = await openApp({
      width: 820,
      height: 1180,
      storage: stored({ cap: { 'Ohuhu|R213': 'old' } }),
    });
    await idle(page);
    await page.evaluate(() => {
      state.collView = 'owned';
      fullRender();
    });
    await idle(page);
    assert.equal(await cellText(page, 'Ohuhu|R213'), 'R6');
    assert.equal(await cellText(page, 'Ohuhu|CG18'), 'CG18');
    await page.evaluate(() => openMarkerSheet(keyIdx('Ohuhu|R213')));
    await page.waitForSelector('#mkOverlay.on');
    assert.equal(await page.textContent('#mkCode'), 'Ohuhu R6');
    assert.equal(await page.textContent('#mkName'), 'Rose Red');
    assert.match(await page.textContent('#mkMeta'), /now R213/);
    assert.match(await page.textContent('#mkCap'), /My cap says\s*R213 Pomegranate\s*R6 Rose Red/);
    await page.click('#mkCap button[data-cap="new"]');
    await idle(page);
    assert.equal(await page.textContent('#mkCode'), 'Ohuhu R213');
    assert.equal(await page.evaluate(() => state.cap['Ohuhu|R213']), 'new');
    await page.click('#mkClose');
    await idle(page);
    // (⋯: the rest show older caps' codes; Undo puts it back)
    await page.click('#mkMore');
    assert.match(await page.textContent('#mkCapDef'), /Show the codes on older Ohuhu caps/);
    await page.click('#mkCapDef');
    await idle(page);
    assert.equal(await cellText(page, 'Ohuhu|CG18'), 'CGII04');
    assert.equal(await cellText(page, 'Ohuhu|R213'), 'R213', 'its own switch wins');
    await page.click('#msToast button:has-text("Undo")');
    await idle(page);
    assert.equal(await cellText(page, 'Ohuhu|CG18'), 'CG18');
    assert.deepEqual(errors, []);
  });
  test('Scan: Add notes what the caps read say, and once offers the rest; a cap already yours is noted with nothing new to add', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180, storage: stored() });
    await idle(page);
    await scanFromMarkers(page);
    await idle(page);
    await read(page, ['YR170', 'RP6', 'BR3', 'YR030', 'G420', 'CG050', 'NG03', 'PB1', 'Y7', 'R10', 'YR2']);
    await idle(page);
    // (the rows say the caps as read: "RP6", now its code)
    assert.match(await page.textContent('#scList'), /now /);
    await page.click('#scAdd');
    await idle(page);
    const t = await page.textContent('#msToast');
    assert.match(t, /Most caps read have Ohuhu’s older codes/);
    assert.equal(await page.evaluate(() => state.cap[mkey(scanIndex().byOld.get('RP6')[0])]), 'old');
    await page.click('#msToast button:has-text("Show older codes for the rest")');
    await idle(page);
    assert.equal(
      await page.evaluate(() => [state.capDef, state.capOffer, capCode('Ohuhu|CG18')].join(' ')),
      'old 1 CGII04',
    );
    // (R213, yours, read as R6 again: nothing new, Add notes it)
    await page.evaluate(() => {
      state.cap = {};
      save();
    });
    await scanFromMarkers(page);
    await idle(page);
    await read(page, ['R6']);
    await idle(page);
    assert.equal(await page.isDisabled('#scAdd'), false, 'Add: what the cap says, to note');
    await page.click('#scAdd');
    await idle(page);
    assert.match(await page.textContent('#msToast'), /Noted what 1 cap of yours says/);
    assert.equal(await page.evaluate(() => state.cap['Ohuhu|R213']), 'old');
    assert.deepEqual(errors, []);
  });
  test('Colour along asks once which codes your Ohuhu caps show; the answer shows them everywhere, with Undo', async () => {
    const { page, errors } = await openApp({
      width: 820,
      height: 1180,
      init: () => {
        window.__MS_CAPQ = true;
      },
    });
    await sampleGuide(page);
    await idle(page);
    await page.evaluate(() => {
      state.owned = new Set(defaultOwned());
      state.cap = {};
      state.capQ = 0;
      save();
      SF.setCollection(sfCollection());
    });
    await page.click('#sfColor');
    await idle(page);
    await page.waitForSelector('#sfAlist .sfcapq');
    const q = await page.textContent('#sfAlist .sfcapq');
    assert.match(q, /Ohuhu changed its codes in 2025\. Does this cap say .+ or .+\?/);
    const i = await page.getAttribute('#sfAlist .sfcapq', 'data-i');
    // (what the picture's labels draw from here on)
    await page.evaluate(() => {
      const P = CanvasRenderingContext2D.prototype,
        ft = P.fillText;
      window.__drawn = [];
      P.fillText = function (t) {
        window.__drawn.push(String(t));
        return ft.apply(this, arguments);
      };
    });
    await page.click('#sfAlist .sfcapq button[data-capq="old"]');
    await idle(page);
    // (the picture's labels too, drawn again whole: the older cap's code of the marker asked about)
    const drawnOld = await page.evaluate((i) => window.__drawn.includes(oldCode(COLORS[+i])), i);
    assert.ok(drawnOld, 'the labels show the older caps’ codes');
    assert.equal(await page.evaluate(() => [state.capDef, state.capQ].join(' ')), 'old 1');
    assert.equal(await page.locator('#sfAlist .sfcapq').count(), 0, 'asked once');
    // (the rows show the older caps' codes, "now …" beside)
    const old = await page.evaluate((i) => oldCode(COLORS[+i]), i);
    assert.match(await page.textContent('#sfAlist'), new RegExp(old.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    await page.click('#msToast button:has-text("Undo")');
    await idle(page);
    assert.equal(await page.evaluate(() => [state.capDef, state.capQ].join(' ')), ' 0');
    assert.deepEqual(errors, []);
  });
  // (v318.21 debugging pass) the * on a section left as it was, when another section's change gives it one; another
  // tab's change of what caps say reaching an open guide
  test('the * follows a change elsewhere in the guide; another tab’s setting redraws an open guide', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await idle(page);
    await page.click('#sfColor');
    await idle(page);
    const r = await page.evaluate(() => {
      const t = __mstest;
      state.owned = new Set([...defaultOwned()].concat(['Ohuhu|RV17', 'Ohuhu|R22']));
      state.cap = { 'Ohuhu|RV17': 'old' };
      state.capQ = 1;
      save();
      SF.setCollection(sfCollection());
      const by = {};
      sfCollection().forEach((m) => (by[m.mkey] = m));
      const A = t.assignData.assign,
        comps = t.comps,
        ls = Object.keys(A)
          .map(Number)
          .filter((l) => comps[l])
          .sort((a, b) => comps[b].area - comps[a].area);
      A[ls[0]] = by['Ohuhu|RV17'];
      SF.capChanged();
      const P = CanvasRenderingContext2D.prototype,
        ft = P.fillText;
      let drawn = [];
      P.fillText = function (s) {
        drawn.push(String(s));
        return ft.apply(this, arguments);
      };
      // (as Change colour does: the picture drawn again where it changed)
      A[ls[1]] = by['Ohuhu|R22'];
      t.renderGuide();
      const star = drawn.includes('R22*');
      drawn = [];
      const v = JSON.parse(localStorage.getItem('ohuhu-hb320-picker-v3'));
      v.capDef = 'old';
      localStorage.setItem('ohuhu-hb320-picker-v3', JSON.stringify(v));
      syncFromStorage();
      // (any older cap's code drawn: a small section's label is a dot)
      const synced = Object.values(A).some(
        (m) => m.brand === 'Ohuhu' && m.mkey !== 'Ohuhu|RV17' && capIsOld(m) && drawn.includes(capCode(m)),
      );
      P.fillText = ft;
      return { star, synced };
    });
    assert.deepEqual(r, { star: true, synced: true });
    assert.deepEqual(errors, []);
  });
  test('Add’s Undo takes back what the caps said and the offer; Add with a question just raised keeps Scan open', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180, storage: stored() });
    await idle(page);
    await scanFromMarkers(page);
    await idle(page);
    await read(page, ['YR170', 'RP6', 'BR3', 'YR030', 'G420', 'CG050', 'NG03', 'PB1', 'Y7', 'R10', 'YR2']);
    await idle(page);
    await page.click('#scAdd');
    await idle(page);
    assert.equal(await page.evaluate(() => state.capOffer), 1);
    await page.click('#msToast button:has-text("Undo")');
    await idle(page);
    assert.deepEqual(await page.evaluate(() => [Object.keys(state.cap).length, state.capOffer]), [0, 0]);
    // (R6 read for R213, yours: nothing new but the cap; R22 typed in the box raises a question: Scan stays open)
    await scanFromMarkers(page);
    await idle(page);
    await read(page, ['R6']);
    await idle(page);
    // (left in the box, read at Add: set without an input event, which WebKit's fill reads at once)
    await page.evaluate(() => {
      document.getElementById('scBox').value = 'R22';
    });
    await page.click('#scAdd');
    await idle(page);
    assert.ok(await page.isVisible('#scanOverlay.on'), 'Scan stays open over the question');
    assert.equal(await page.evaluate(() => state.cap['Ohuhu|R213'] || ''), '');
    assert.deepEqual(errors, []);
  });
  test('"I don’t have it" asks about another of your markers, the keyboard on its question; three such and it’s asked no more', async () => {
    const { page, errors } = await openApp({
      width: 820,
      height: 1180,
      init: () => {
        window.__MS_CAPQ = true;
      },
    });
    await sampleGuide(page);
    await idle(page);
    await page.evaluate(() => {
      state.owned = new Set(defaultOwned());
      state.cap = {};
      state.capQ = 0;
      save();
      SF.setCollection(sfCollection());
    });
    await page.click('#sfColor');
    await idle(page);
    const seen = [];
    for (let n = 0; n < 3; n++) {
      await page.waitForSelector('#sfAlist .sfcapq');
      seen.push(await page.getAttribute('#sfAlist .sfcapq', 'data-i'));
      await page.click('#sfAlist .sfcapq button[data-capq="none"]');
      await idle(page);
      if (n < 2)
        assert.equal(
          await page.evaluate(() => document.activeElement && document.activeElement.dataset.capq),
          'new',
          'the keyboard on the next question',
        );
    }
    assert.equal(new Set(seen).size, 3, seen.join(' '));
    assert.equal(await page.locator('#sfAlist .sfcapq').count(), 0);
    assert.equal(await page.evaluate(() => state.capQ), 1);
    assert.deepEqual(errors, []);
  });
}

// ---- from v31825-x1.test.mjs ----
// v318.25: fixes from the fifth deep debugging pass, in the browser. Fail on v318.24.
{
  const KEY = 'ohuhu-hb320-picker-v3';
  const onboarded = (extra = {}) => ({
    'ms-onboarded': '1',
    'ms-setup-tip': '1',
    'ms-last-ver': 'v318',
    ...extra,
  });
  const appState = (extra = {}) =>
    JSON.stringify({
      mode: 'collection',
      ownedSeedV: 2,
      copicAdd1: 1,
      libAdj1: 1,
      setFix1: 1,
      saved: [],
      ...extra,
    });
  const clip = () => {
    window.__clip = [];
    try {
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: async (t) => void window.__clip.push(t) },
        configurable: true,
      });
    } catch (e) {}
  };
  // ---- X1: Markers and Scan ----

  test('X1 a marker’s details: Copy copies the code its sheet shows, your older cap’s', async () => {
    const { page, errors } = await openApp({
      init: clip,
      width: 820,
      height: 1180,
      storage: onboarded({ [KEY]: appState({ collView: 'owned', owned: ['Ohuhu|R213', 'Ohuhu|R014'] }) }),
    });
    await idle(page);
    await page.evaluate(() => {
      state.capDef = 'old';
      fullRender();
      openMarkerSheet(keyIdx('Ohuhu|R213'));
    });
    await idle(page);
    assert.equal(await page.textContent('#mkCode'), 'Ohuhu R6');
    await page.click('#mkCopy');
    await idle(page);
    assert.deepEqual(await page.evaluate(() => window.__clip), ['R6']);
    assert.deepEqual(errors, []);
    await page.context().close();
  });
  test('X1 Untick all shown counts your markers among those shown, and is off with none of yours shown', async () => {
    const { page, errors } = await openApp({
      width: 820,
      height: 1180,
      storage: onboarded({
        [KEY]: appState({ collView: 'all', owned: ['Ohuhu|R014', 'Ohuhu|Y27', 'Copic|E00'] }),
      }),
    });
    await idle(page);
    await page.click('#mkMore');
    await page.click('#ownNone');
    assert.equal(await page.textContent('#ownNone'), 'Untick 3 markers? Tap again');
    await pause(page, 450, 'past a double tap');
    await page.click('#ownNone');
    await idle(page);
    assert.equal(await page.evaluate(() => state.owned.size), 0);
    // (none of yours shown now: nothing to untick, so it's off rather than arming)
    assert.equal(await page.evaluate(() => document.getElementById('ownNone').disabled), true);
    // (one ticked by its swatch, the grid not redrawn: on again when the ⋯ menu next opens)
    await page.evaluate(() => setOwned(keyIdx('Ohuhu|R014'), true));
    if (!(await page.locator('#ownNone').isVisible())) await page.click('#mkMore');
    else {
      await page.click('#mkMore');
      await page.click('#mkMore');
    }
    assert.equal(await page.evaluate(() => document.getElementById('ownNone').disabled), false);
    assert.deepEqual(errors, []);
    await page.context().close();
  });
  test('X1 Unowned’s “biggest gaps” and “complete” orders: the heading counts the markers shown', async () => {
    const owned = ['Ohuhu|R014', 'Ohuhu|R210', 'Ohuhu|Y27', 'Ohuhu|B000', 'Ohuhu|G020', 'Ohuhu|E47'];
    for (const gapSort of ['gap', 'complete']) {
      const { page, errors } = await openApp({
        width: 820,
        height: 1180,
        storage: onboarded({ [KEY]: appState({ collView: 'unowned', gapSort, owned }) }),
      });
      await idle(page);
      const r = await page.evaluate(() => ({
        head: document.getElementById('matchLbl').textContent,
        cells: document.querySelectorAll('#results .cell').length,
        shown: shownMatches().length,
      }));
      assert.equal(r.cells, r.shown, gapSort);
      assert.equal(r.head, 'Showing ' + r.cells + ' markers', gapSort);
      assert.deepEqual(errors, []);
      await page.context().close();
    }
  });
}

// ---- from v31825-x4.test.mjs ----
// v318.25 in the browser.
{
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
}

// ---- from v31826-w1.test.mjs ----
// v318.26 (W1) in the browser: the polish set (A2 a batch's photos not read, A3 Focus mode's Back in words, A6 the
// welcome's Undo link in place of its toast, A7 an older cap's name in Markers' search, A9 Print's paper a link to its
// choices, and Download PDF on one line) and Send feedback's waits in the form's Message (D). Each fails on v318.25.
{
  // ---- A7: an older cap's name in Markers' search ----
  test('A7 Markers’ search: an older cap’s name finds its marker, the cell named for that cap', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await page.click('#wcHaveSet');
    await page.check('#wcSets input[data-i="3"]');
    await page.click('#wcAdd');
    await page.click('#wcLook');
    await idle(page);
    await page.click('#mCollection');
    await idle(page);
    await page.fill('#q', 'rose red');
    await idle(page);
    const cell = await page.evaluate(() => {
      const el = document.querySelector('#results .cell[data-i="' + keyIdx('Ohuhu|R213') + '"]');
      return el && { label: el.getAttribute('aria-label'), code: el.querySelector('.cc').textContent };
    });
    assert.ok(cell, 'R213 found by its older cap’s name');
    assert.equal(cell.code, 'R213', 'the code shown as the setting says');
    assert.match(cell.label, /^Ohuhu R213 Pomegranate, older cap R6 Rose Red, /);
    assert.deepEqual(errors, []);
  });
}

// ---- from v31826-w2.test.mjs ----
// v318.26 in the browser (builder W2): Blends with in a marker's details, the Tester questions (two new ones, and a
// form of 27 fields or 29), and the skin tones (Change colour's row; Markers' search is in e2e/v3083-data).
{
  // ---- Blends with ----

  async function markers(o = {}) {
    const a = await openApp(o.width ? o : { width: 390, height: 844, ...o });
    await welcome(a.page, 'look');
    await idle(a.page);
    await a.page.click('#mCollection');
    await idle(a.page);
    return a;
  }
  const openSheet = (page, k) =>
    page.evaluate((k) => {
      openMarkerSheet(keyIdx(k));
    }, k);
  const blend = (page) =>
    page.evaluate(() => {
      const g = document.getElementById('mkBlend');
      return {
        hidden: g.hidden,
        label: g.getAttribute('aria-label'),
        head: ((g.querySelector('.mkblh, .mkblback') || {}).textContent || '').trim(),
        slots: [...g.querySelectorAll('.mkbl')].map((b) => ({
          i: +b.dataset.mkbl,
          k: mkey(+b.dataset.mkbl),
          code: b.querySelector('b').textContent,
          word: b.querySelector('.mkbls').textContent,
          aria: b.getAttribute('aria-label'),
        })),
      };
    });
  // ---- Skin tones in Change colour ----

  const bigSection = (page) =>
    page.evaluate(() => {
      const t = __mstest,
        c = document.getElementById('sfCanvas'),
        r = c.getBoundingClientRect();
      return t.assignData.order.find((l) => {
        const q = t.labelPos(l),
          y = r.top + (q.y / c.height) * r.height,
          x = r.left + (q.x / c.width) * r.width;
        return y > r.top + 40 && y < r.bottom - 80 && x > r.left + 20 && x < r.right - 20;
      });
    });
  async function changeColour(page) {
    const l = await bigSection(page);
    await scrollTop(page);
    const p = await sectionPoint(page, l);
    await page.mouse.click(p.x, p.y);
    await idle(page);
    await page.click('.sftip [data-a="change"]');
    await page.waitForSelector('#sfSheet', { state: 'visible' });
  }
  const rows = (page) =>
    page.evaluate(() =>
      [...document.querySelectorAll('#sfPopSw .sfswrec')].map((g) => ({
        h: g.querySelector('.sfswh').textContent,
        ks: [...g.querySelectorAll('.sfsw')].map((b) => b.dataset.k),
      })),
    );
  test('Blends with: the lighter and darker markers, each opening its own details, with a way back', async () => {
    const { page, errors } = await markers();
    await openSheet(page, 'Ohuhu|R28');
    await page.waitForSelector('#mkOverlay.on');
    const b = await blend(page);
    assert.equal(b.hidden, false);
    assert.equal(b.label, 'Blends with');
    assert.equal(b.head, 'Blends with');
    assert.ok(b.slots.length >= 1, JSON.stringify(b));
    // as a guide made now would pick them, from your markers
    const want = await page.evaluate(() => {
      const c = SF.blendFor('Ohuhu|R28');
      return [c.light, c.dark].filter(Boolean).map((m) => m.mkey);
    });
    assert.deepEqual(
      b.slots.map((s) => s.k),
      want,
    );
    for (const s of b.slots) {
      const own = await page.evaluate((k) => state.owned.has(k), s.k);
      assert.equal(s.word, own ? 'you have it' : 'not yours');
      assert.match(s.aria, /^(Lighter|Darker): Ohuhu \S+ .+, (you have it|not yours|dry)$/);
    }
    // tapped: that marker's details, in the same sheet, with the focus on its code and a way back
    const to = b.slots[0];
    await page.click('#mkBlend .mkbl >> nth=0');
    await idle(page);
    assert.equal(await page.evaluate(() => mkOpenIdx), to.i);
    assert.match(await page.textContent('#mkCode'), new RegExp(to.code + '$'));
    assert.equal(await page.evaluate(() => document.activeElement.id), 'mkCode');
    const b2 = await blend(page);
    assert.equal(b2.head, 'Back to Ohuhu R28');
    await page.click('#mkBlend .mkblback');
    await idle(page);
    assert.equal(await page.evaluate(() => mkey(mkOpenIdx)), 'Ohuhu|R28');
    assert.equal((await blend(page)).head, 'Blends with', 'one level back: the heading again');
    // closed and opened again: no way back
    await page.click('#mkClose');
    await openSheet(page, 'Ohuhu|R27');
    assert.equal((await blend(page)).head, 'Blends with');
    // a Colorless Blender has none
    await openSheet(page, 'Ohuhu|0');
    assert.equal((await blend(page)).hidden, true);
    assert.deepEqual(errors, []);
  });
  test('Blends with: another brand’s named with its brand; a dry one says so; with nothing owned, “not yours”', async () => {
    const { page, errors } = await markers();
    // a Copic marker's companions from your Ohuhu markers
    await openSheet(page, 'Copic|E00');
    const b = await blend(page);
    assert.ok(b.slots.length, JSON.stringify(b));
    for (const s of b.slots) {
      const br = s.k.split('|')[0];
      if (br !== 'Copic') assert.ok(s.code.startsWith(br + ' '), 'the brand shown: ' + s.code);
      else assert.ok(!/^Copic /.test(s.code));
    }
    // a companion of yours marked dry: no longer one you have. Owning only R28 and R210 (its darker), with R210 dry the
    // darker is still R210, to buy again: "dry"
    await openSheet(page, 'Ohuhu|R28');
    await page.evaluate(() => {
      state.owned = new Set(['Ohuhu|R28', 'Ohuhu|R210']);
      mkFill(mkOpenIdx);
    });
    const s0 = (await blend(page)).slots.find((s) => s.k === 'Ohuhu|R210');
    assert.equal(s0 && s0.word, 'you have it');
    await page.evaluate(() => {
      state.ink['Ohuhu|R210'] = 'dry';
      mkFill(mkOpenIdx);
    });
    const s1 = (await blend(page)).slots.find((s) => s.k === 'Ohuhu|R210');
    assert.equal(s1 && s1.word, 'dry');
    assert.match(s1.aria, /^Darker: Ohuhu R210 .+, dry$/);
    // nothing owned: the catalogue's, none of them yours
    await page.evaluate(() => {
      state.owned = new Set();
      mkFill(mkOpenIdx);
    });
    const b3 = await blend(page);
    assert.ok(b3.slots.length);
    assert.ok(
      b3.slots.every((s) => s.word === 'not yours'),
      JSON.stringify(b3.slots),
    );
    assert.deepEqual(errors, []);
  });
  test('Blends with: with an older guide open, its collection and rule are left as they were', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await idle(page);
    const was = await page.evaluate(() => {
      __mstest.styleVars.famRule = 2;
      return { n: __mstest.coll.length, rule: __mstest.styleVars.famRule };
    });
    // (the sheet over the guide: what matters is the guide module's state)
    await openSheet(page, 'Ohuhu|R28');
    await page.waitForSelector('#mkOverlay.on');
    const b = await blend(page);
    assert.ok(b.slots.length);
    // the rule a guide made now uses (4), not the open guide's (2)
    const r4 = await page.evaluate(() => {
      const t = __mstest,
        c0 = t.coll;
      t.coll = sfCollection();
      t.styleVars.famRule = 4;
      const i = keyIdx('Ohuhu|R28'),
        c = t.colour.companions({
          mkey: 'Ohuhu|R28',
          code: 'R28',
          brand: 'Ohuhu',
          hex: COLORS[i].hex,
          lab: LAB[i],
          fam: COLORS[i].fam,
        });
      t.coll = c0;
      t.styleVars.famRule = 2;
      return [c.light, c.dark].filter(Boolean).map((m) => m.mkey);
    });
    assert.deepEqual(
      b.slots.map((s) => s.k),
      r4,
    );
    assert.deepEqual(
      await page.evaluate(() => ({ n: __mstest.coll.length, rule: __mstest.styleVars.famRule })),
      was,
    );
    assert.deepEqual(errors, []);
  });
  test('Blends with: at 320 wide and the largest text, nothing runs off the sheet', async () => {
    const { page, errors } = await openAtScale(1.6, { width: 320, height: 568 });
    await welcome(page, 'look');
    await idle(page);
    await page.click('#mCollection');
    await idle(page);
    await openSheet(page, 'Copic|E00');
    await page.waitForSelector('#mkOverlay.on');
    await page.evaluate(() => document.getElementById('mkBlend').scrollIntoView());
    const fit = await page.evaluate(() => {
      const card = document.querySelector('#mkOverlay .mkcard'),
        r = card.getBoundingClientRect(),
        out = [...card.querySelectorAll('#mkBlend .mkbl, #mkBlend .mkbl *')].filter((e) => {
          const q = e.getBoundingClientRect();
          return q.width && (q.left < r.left - 0.5 || q.right > r.right + 0.5);
        });
      return {
        sideways: card.scrollWidth - card.clientWidth,
        page: document.documentElement.scrollWidth - innerWidth,
        out: out.length,
        h: [...card.querySelectorAll('#mkBlend .mkbl')].map((b) =>
          Math.round(b.getBoundingClientRect().height),
        ),
      };
    });
    assert.ok(fit.sideways <= 0, 'no sideways scroll in the sheet: ' + JSON.stringify(fit));
    assert.ok(fit.page <= 0, 'nor on the page');
    assert.equal(fit.out, 0, 'every slot within the sheet');
    assert.ok(
      fit.h.every((h) => h >= 44),
      'a tap target each: ' + fit.h,
    );
    assert.deepEqual(errors, []);
  });
  test('Change colour: a Skin tones row after the shortcuts, with 3 or more of them; not with fewer', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await idle(page);
    await changeColour(page);
    const r = await rows(page),
      sk = r.find((x) => x.h === 'Skin tones');
    assert.ok(sk, JSON.stringify(r.map((x) => x.h)));
    assert.equal(r[r.length - 1].h, 'Skin tones', 'after Closest, In this guide and Recently used');
    // the skin tones you have here, lightest first
    const want = await page.evaluate(() => {
      const here = new Set(__mstest.coll.map((m) => m.mkey));
      return skinIdx()
        .map((i) => mkey(i))
        .filter((k) => here.has(k));
    });
    assert.ok(want.length >= 3);
    assert.deepEqual(sk.ks, want);
    // hidden while a code is typed in the filter, as the other shortcut rows are
    await page.fill('#sfPopFilter', 'YR');
    assert.equal(
      await page.evaluate(() => [...document.querySelectorAll('#sfPopSw .sfswrec')].every((g) => g.hidden)),
      true,
    );
    await page.click('#sfPopCancel');
    await idle(page);
    // two skin tones left in the guide's markers: no row
    await page.evaluate(() => {
      const sk = new Set(skinIdx().map((i) => mkey(i)));
      let n = 0;
      __mstest.coll = __mstest.coll.filter((m) => !sk.has(m.mkey) || n++ < 2);
    });
    await changeColour(page);
    assert.ok(!(await rows(page)).some((x) => x.h === 'Skin tones'));
    assert.deepEqual(errors, []);
  });
}

// ---- from v31828-y1.test.mjs ----
// v318.28 (fixer Y1) in the browser: Home's Markers card counts Copic's 0 as its set does; Markers' "skin" says the
// skin tones in All, and with none yours names them, not "No markers match"; Tick all shown off with every one shown
// yours; Scan's set card counts a set's colours, the blender said apart; a photo that fails to open after Scan was closed
// leaves the next photo's view alone; a batch that ended early says the photos not read. Each fails on v318.27.
{
  const KEY = 'ohuhu-hb320-picker-v3';
  const storage = (extra = {}) => ({
    'ms-onboarded': '1',
    'ms-setup-tip': '1',
    'ms-last-ver': 'v318.27',
    [KEY]: JSON.stringify({
      mode: 'home',
      ownedSeedV: 2,
      copicAdd1: 1,
      libAdj1: 1,
      setFix1: 1,
      owned: [],
      saved: [],
      ...extra,
    }),
  });
  test('Home’s Markers card: All Copic markers 358 and Ciao 36 Set B 36, as the set list says; Honolulu 120 still 120', async () => {
    const { page, errors } = await openApp({ storage: storage() });
    await idle(page);
    const r = await page.evaluate(() => {
      const out = {};
      for (const n of ['All Copic markers', 'Ciao 36 - Set B', 'Honolulu 120']) {
        state.owned = new Set(presetMkeys(MARKER_SETS.find((p) => p.n === n)));
        save();
        document.getElementById('mCollection').click();
        document.getElementById('mHome').click();
        out[n] = document.querySelector('.homecard[data-go="collection"] .hcsub').textContent;
      }
      return out;
    });
    assert.deepEqual(r, {
      'All Copic markers': '358 markers',
      'Ciao 36 - Set B': '36 markers',
      // (v320, Ben's count rule: its Colorless Blender is a marker too)
      'Honolulu 120': '121 markers',
    });
    assert.deepEqual(errors, []);
  });
  test('Markers’ "skin": Owned says the skin tones in All; none of them yours names them, with Show', async () => {
    const { page, errors } = await openApp({ storage: storage({ mode: 'collection', collView: 'owned' }) });
    await idle(page);
    const look = async (q) => {
      await page.fill('#q', '');
      await page.fill('#q', q);
      await idle(page);
      return page.evaluate(() => ({
        line: (results.querySelector('.famline') || {}).textContent || '',
        more: (results.querySelector('.moreall') || {}).textContent || '',
        empty: (results.querySelector('.empty') || {}).textContent || '',
        cells: results.querySelectorAll('.cell').length,
      }));
    };
    await page.evaluate(() => {
      state.owned = new Set(presetMkeys(MARKER_SETS.find((p) => p.n === 'Honolulu 120')));
      save();
      fullRender();
    });
    const a = await look('skin');
    assert.match(a.line, /^Skin tones \(12\)/);
    assert.equal(a.cells, 12);
    assert.match(a.more, /^60 more in All · Show/);
    await page.evaluate(() => {
      state.owned = new Set(['Ohuhu|B08', 'Ohuhu|B111']);
      save();
      fullRender();
    });
    const b = await look('skin tones');
    assert.match(b.empty, /None of the markers matching “skin tones” are in your collection/);
    assert.match(b.more, /^72 in All · Show/);
    // (Show: All, the 72 skin tones, the search kept)
    await page.click('.moreall .moreshow');
    await idle(page);
    assert.equal(await page.evaluate(() => state.collView), 'all');
    assert.equal(await page.evaluate(() => results.querySelectorAll('.cell').length), 72);
    assert.deepEqual(errors, []);
  });
  test('Tick all shown is off when every marker shown is yours, and follows a single tick', async () => {
    const { page, errors } = await openApp({ storage: storage({ mode: 'collection', collView: 'all' }) });
    await idle(page);
    await page.evaluate(() => {
      state.owned = new Set(['Ohuhu|R014']);
      save();
      fullRender();
    });
    await page.fill('#q', 'r014');
    await idle(page);
    const r = await page.evaluate(() => {
      const out = { shown: shownMatches().map((i) => COLORS[i].code), off: ownAllBtn.disabled };
      setOwned(keyIdx('Ohuhu|R014'), false);
      out.afterUntick = ownAllBtn.disabled;
      setOwned(keyIdx('Ohuhu|R014'), true);
      out.afterTick = ownAllBtn.disabled;
      return out;
    });
    assert.deepEqual(r, { shown: ['R014'], off: true, afterUntick: false, afterTick: true });
    assert.deepEqual(errors, []);
  });
  test('Scan’s set card: "Add all 24", then "24 and a Colorless Blender added to the list"', async () => {
    const { page, errors } = await openApp({ storage: storage() });
    await idle(page);
    const r = await page.evaluate(() => {
      openScan();
      scanHandle('Ohuhu Alcohol Markers 24 Skin Tone Colors Portrait', true);
      const add = [...document.querySelectorAll('#scStat button')].find((b) => /Add all/.test(b.textContent));
      const label = add && add.textContent;
      add.click();
      return { label, stat: document.getElementById('scStat').textContent, list: scanList.length };
    });
    assert.equal(r.label, 'Add all 24 to the list');
    assert.match(r.stat, /24 and a Colorless Blender added to the list/);
    assert.equal(r.list, 25);
    assert.deepEqual(errors, []);
  });
  test('A photo that fails to open after Scan was closed leaves the next photo’s view as it is', async () => {
    const { page, errors } = await openApp({ storage: storage() });
    await idle(page);
    const r = await page.evaluate(async () => {
      const wait = (ms) => new Promise((res) => setTimeout(res, ms));
      openScan();
      ocrOk = true;
      // (photo A fails to open after 400 ms; photo B is still opening)
      ocrPhoto = (file) =>
        file.name === 'a.jpg'
          ? new Promise((res, rej) => setTimeout(() => rej(new Error('bad')), 400))
          : new Promise(() => {});
      ocrChosen([new File([new Uint8Array(8)], 'a.jpg', { type: 'image/jpeg' })]);
      await wait(50);
      closeScan();
      openScan();
      ocrChosen([new File([new Uint8Array(8)], 'b.jpg', { type: 'image/jpeg' })]);
      await wait(700);
      return {
        say: document.getElementById('ocrSay').textContent,
        run: ocrRun && ocrRun.file.name,
        done: ocrRun && ocrRun.done,
        done_btn: !!document.getElementById('ocrDone'),
      };
    });
    assert.deepEqual(r, { say: 'Opening the photo…', run: 'b.jpg', done: false, done_btn: false });
    assert.deepEqual(errors, []);
  });
  test('A batch that ended early: Done says "From 2 of 5 photos"; one stopped at its first, the others not read', async () => {
    const { page, errors } = await openApp({ storage: storage() });
    await idle(page);
    const r = await page.evaluate(() => {
      openScan();
      const f = (n) => new File([new Uint8Array(8)], n + '.jpg', { type: 'image/jpeg' });
      const files = [1, 2, 3, 4, 5].map(f);
      ocrQ = {
        files,
        k: 3,
        stop: true,
        per: [
          { added: 2, asked: 0 },
          { added: 1, asked: 0 },
        ],
        n0: 1,
      };
      ocrRun = { n: 2, done: true, added: 1, asked: 0, file: files[1] };
      ocrFinish();
      const early = document.getElementById('scStat').textContent;
      ocrQ = { files: files.slice(0, 3), k: 1, stop: true, per: [{ added: 2, asked: 0 }], n0: 1 };
      ocrRun = { n: 3, done: true, added: 2, asked: 0, file: files[0] };
      ocrFinish();
      return { early, first: document.getElementById('scStat').textContent };
    });
    assert.match(r.early, /From 2 of 5 photos: 3 added to the list/);
    assert.match(r.first, /From the photo: 2 added to the list/);
    assert.match(r.first, /the other 2 photos not read/);
    assert.deepEqual(errors, []);
  });
}

// ---- from v31834-random.test.mjs ----
// v318.34 — Markers › Random tidied (Stage 3 G): what it's for, a shorter card, buttons that say what they act on, the
// Drawn pile under them, the markers left to draw folded by family, two columns held sideways, every drawn marker
// counted, Use in a guide and Undo, Draw from these on Markers, and Prefer markers you haven't used yet.
{
  const ONB = { 'ms-seen-hints': '["along","tap","mk-grid","markers"]' };
  const rect = (page, sel) =>
    page.evaluate((s) => {
      const e = document.querySelector(s);
      return e ? e.getBoundingClientRect().toJSON() : null;
    }, sel);
  // Markers with a collection, then Random
  async function toRandom(opts = {}) {
    const app = await openApp({ storage: ONB, ...opts });
    await welcome(app.page, 'look');
    await idle(app.page);
    await app.page.click('#mCollection');
    await idle(app.page);
    await app.page.click('#mkDrawBtn');
    await idle(app.page);
    return app;
  }
  const draw = async (page, n = 1) => {
    for (let i = 0; i < n; i++) {
      await page.click('#draw');
      await idle(page, 1300);
    }
  };
  test('G1–G4: the purpose line, a 160/200 card with no empty band, the buttons’ words, the pile under them, Remaining folded by family lightest first', async () => {
    const { page, errors } = await toRandom({ width: 820, height: 1180, touch: true });
    assert.equal(await page.isVisible('#rndWhy'), true);
    assert.match(
      await page.textContent('#rndWhy'),
      /^A marker you wouldn’t have picked: draw one at random, as a prompt or a challenge\.$/,
    );
    // the back control at the left, the card about 200 tall on an iPad held upright, no readout band under an empty card
    const back = await rect(page, '#rndBack'),
      sw = await rect(page, '#swatch');
    assert.ok(back.x < 60, 'back at the left: ' + back.x);
    assert.ok(back.height >= 44, '44px tap area');
    assert.ok(sw.height >= 190 && sw.height <= 210, 'swatch ' + sw.height);
    assert.equal(await page.isVisible('#readout'), false, 'no empty band');
    assert.equal(await page.textContent('#swap'), 'Swap this one');
    // (v320: "Remove", short enough not to wrap; its label says the rest)
    assert.equal(await page.textContent('#undo'), 'Remove');
    assert.equal(await page.textContent('#reset'), 'Clear all');
    // the pile right under the buttons, the rail and count after it, Remaining folded after Filters
    const order = await page.evaluate(() =>
      [...document.querySelectorAll('#primaryRow, #drawnWrap, #trackWrap, #filterBar, #remFold')].map(
        (e) => e.id,
      ),
    );
    assert.deepEqual(order, ['primaryRow', 'drawnWrap', 'trackWrap', 'filterBar', 'remFold']);
    const pr = await rect(page, '#primaryRow'),
      dw = await rect(page, '#drawnWrap'),
      tw = await rect(page, '#trackWrap');
    assert.ok(pr.y < dw.y && dw.y < tw.y, 'buttons, pile, count');
    assert.equal(await page.evaluate(() => document.getElementById('remFold').open), false, 'folded');
    assert.match(await page.textContent('#remSumT'), /^Show the \d+ left to draw$/);
    assert.equal(await page.$$eval('#poolGrid .rghead', (l) => l.length > 3), true, 'families');
    // lightest first within a family, and only families with something left
    const ok = await page.evaluate(() => {
      const gs = [...document.querySelectorAll('#poolGrid .rgroup')];
      return gs.every((g) => {
        const cells = [...g.querySelectorAll('.cell')];
        if (!cells.length) return false;
        const ls = cells.map((c) => {
          const code = c.querySelector('.cc').textContent,
            lbl = c.getAttribute('aria-label');
          const i = COLORS.findIndex((x, j) => lbl.startsWith(x.brand + ' ' + capCode(j) + ' '));
          return LAB[i][0];
        });
        return ls.every((l, i) => !i || l <= ls[i - 1] + 1e-9);
      });
    });
    assert.equal(ok, true, 'lightest first in every family');
    await page.click('#remSum');
    await idle(page);
    assert.equal(await page.evaluate(() => document.getElementById('remFold').open), true);
    assert.equal(await page.isVisible('#poolGrid .cell'), true);
    // the Help bullet
    assert.match(
      await page.evaluate(() => document.querySelector('#helpMore').textContent),
      /Random.*Prefer markers you haven’t used yet.*Draw from these/,
    );
    // a phone: a 160 card
    await page.setViewportSize({ width: 390, height: 844 });
    await idle(page);
    const sw2 = await rect(page, '#swatch');
    assert.ok(sw2.height >= 150 && sw2.height <= 170, 'phone swatch ' + sw2.height);
    assert.deepEqual(errors, []);
  });
  test('G5: held sideways on an iPad, the card and its buttons left and the pile, count, Filters and Remaining in a column beside; back in one column upright', async () => {
    const { page, errors } = await toRandom({ width: 1180, height: 820, touch: true });
    await draw(page, 2);
    const side = await page.evaluate(() => {
      const s = document.getElementById('rndSide');
      return s && s.parentNode.classList.contains('palsplit') && [...s.children].map((e) => e.id);
    });
    assert.deepEqual(side, ['drawnWrap', 'trackWrap', 'filterBar', 'filters', 'remFold']);
    const card = await rect(page, '#stage'),
      pile = await rect(page, '#drawnWrap'),
      fb = await rect(page, '#filterBar');
    assert.ok(pile.x > card.x + card.width, 'the pile beside the card');
    assert.ok(fb.x > card.x + card.width, 'Filters beside it too');
    assert.ok(pile.y < card.y + 60, 'at the top of the column');
    // Filters open there too
    await page.click('#filterBar');
    await idle(page);
    assert.equal(await page.isVisible('#filters'), true);
    assert.ok((await rect(page, '#filters')).x > card.x + card.width);
    // upright: one column, in order under the card
    await page.setViewportSize({ width: 820, height: 1180 });
    // (the media query's change comes a moment after the resize on WebKit)
    await page.waitForFunction(() => !document.getElementById('rndSide').children.length, null, {
      timeout: 5000,
    });
    await idle(page);
    const order = await page.evaluate(() => {
      const ids = [...document.querySelectorAll('.palsplit ~ *')].map((e) => e.id).filter(Boolean);
      return ids.slice(0, 5);
    });
    assert.deepEqual(order, ['drawnWrap', 'trackWrap', 'filterBar', 'filters', 'remFold']);
    assert.ok((await rect(page, '#drawnWrap')).y > (await rect(page, '#stage')).y + 100, 'under the card');
    // Palette held sideways after it: Filters go with its settings, as before, and back when Random is opened again
    await page.setViewportSize({ width: 1180, height: 820 });
    await page.click('#mPalette');
    await idle(page);
    assert.equal(
      await page.evaluate(() => document.getElementById('filterBar').parentNode.className),
      'palset',
    );
    await page.click('#mCollection');
    await page.click('#mkDrawBtn');
    await page.waitForFunction(() => document.getElementById('rndSide').children.length === 5, null, {
      timeout: 5000,
    });
    await idle(page);
    assert.deepEqual(
      await page.evaluate(() => [...document.getElementById('rndSide').children].map((e) => e.id)),
      ['drawnWrap', 'trackWrap', 'filterBar', 'filters', 'remFold'],
    );
    assert.deepEqual(errors, []);
  });
  test('G6: every drawn marker is counted, the ones a filter leaves out said beside; G7: Use in a guide from two, Undo after Remove this one and Clear all', async () => {
    const { page, errors } = await toRandom();
    await draw(page, 1);
    assert.match(await page.textContent('#status'), /^1 drawn, \d+ left to draw$/);
    assert.equal(await page.isVisible('#useGuideWrap'), false, 'one marker is no palette');
    await draw(page, 1);
    assert.equal(await page.isVisible('#useGuideWrap'), true);
    assert.equal(await page.isVisible('#useInGuide'), true);
    // the first drawn marker's family turned off: still "2 drawn", one of them not in the filter
    const fam = await page.evaluate(() => COLORS[state.drawn[0]].fam);
    const other = await page.evaluate(() => COLORS[state.drawn[1]].fam);
    await page.evaluate((f) => {
      state.excluded.add(f);
      filterChanged();
    }, fam);
    await idle(page);
    const st = await page.textContent('#status');
    assert.match(
      st,
      fam === other
        ? /^2 drawn, \d+ left to draw · 2 not in the filter$/
        : /^2 drawn, \d+ left to draw · 1 not in the filter$/,
      st,
    );
    assert.equal(await page.textContent('#pilen'), '(2)');
    await page.evaluate((f) => {
      state.excluded.delete(f);
      filterChanged();
    }, fam);
    await idle(page);
    assert.match(await page.textContent('#status'), /^2 drawn, \d+ left to draw$/);
    // Remove this one: the latest goes, Undo brings it back
    const was = await page.evaluate(() => state.drawn.slice());
    await page.click('#undo');
    await idle(page);
    assert.deepEqual(await page.evaluate(() => state.drawn), was.slice(1));
    assert.match(await page.textContent('#msToast'), /^Removed (Ohuhu|Copic) \S+/);
    await page.click('#toastAct');
    await idle(page);
    assert.deepEqual(await page.evaluate(() => state.drawn), was, 'back as it was');
    // Clear all, armed, then Undo
    await page.click('#reset');
    assert.equal(await page.textContent('#reset'), 'Clear all? Tap again');
    await page.click('#reset');
    await idle(page);
    assert.deepEqual(await page.evaluate(() => state.drawn), []);
    assert.equal(await page.textContent('#reset'), 'Clear all');
    assert.match(await page.textContent('#msToast'), /^Cleared 2 drawn markers/);
    await page.click('#toastAct');
    await idle(page);
    assert.deepEqual(await page.evaluate(() => state.drawn), was);
    // Use in a guide hands the draw over as a palette of chosen markers, as Palette's does (no guide open:
    // recolourWith takes it to the Guide screen)
    const held = await page.evaluate(() => {
      const calls = [];
      SF.guideBrief = () => null;
      SF.recolourWith = (p) => {
        calls.push(p);
        return false;
      };
      document.getElementById('useInGuide').click();
      return { calls, mode: state.mode };
    });
    assert.equal(held.calls.length, 1);
    assert.deepEqual(held.calls[0].keys, await page.evaluate((w) => w.map(mkey), was));
    assert.equal(held.calls[0].h, 'custom');
    assert.equal(held.mode, 'sections');
    assert.deepEqual(errors, []);
  });
  test('G8: Draw from these on Markers opens Random from the markers shown', async () => {
    const { page, errors } = await openApp({ storage: ONB });
    await welcome(page, 'look');
    await idle(page);
    await page.click('#mCollection');
    await idle(page);
    const tr = await rect(page, '#toRandom'),
      tp = await rect(page, '#toPalette');
    assert.ok(tr && tr.height >= 44 && Math.abs(tr.y - tp.y) < 2, 'beside Palette from these');
    assert.equal(await page.textContent('#toRandom'), 'Draw from these');
    await page.fill('#q', 'R2');
    await idle(page);
    const shown = await page.evaluate(() => shownMatches().filter((i) => !NOINK.has(i)));
    assert.ok(shown.length > 1 && shown.length < 40, 'a search narrows it: ' + shown.length);
    await page.click('#toRandom');
    await idle(page);
    assert.equal(await page.evaluate(() => state.mode), 'random');
    assert.deepEqual(await page.evaluate(() => state.pool), shown);
    assert.equal(await page.isVisible('#poolBar'), true);
    assert.equal(await page.textContent('#poolN'), String(shown.length));
    await draw(page, 1);
    assert.ok(shown.includes(await page.evaluate(() => state.drawn[0])), 'drawn from the selection');
    // and the drawn marker is counted among the selection
    assert.match(
      await page.textContent('#status'),
      new RegExp('^1 drawn, ' + (shown.length - 1) + ' left to draw$'),
    );
    assert.deepEqual(errors, []);
  });
  test('G9: Prefer markers you haven’t used yet leaves out the markers of guides you’ve worked with, says when all are used, and is remembered', async () => {
    const { page, errors } = await toRandom();
    assert.equal(await page.isVisible('#rndFreshWrap'), true);
    assert.equal(await page.isChecked('#rndFresh'), false);
    assert.equal(await page.isVisible('#rndFreshNote'), false);
    // five markers in play; three of them in guides: one with the worked flag, one ticked (done), one toned (tn); a
    // fourth's guide was only built (not used), a fifth's is a saved palette, not a guide
    const K = await page.evaluate(() => {
      const own = [];
      for (let i = 0; i < COLORS.length && own.length < 5; i++) if (inPool(i)) own.push(i);
      state.owned = new Set(own.map(mkey));
      state.drawn = [];
      const k = own.map(mkey);
      state.saved = [
        { id: 1, type: 'guide', name: 'A', keys: [k[0]], wk: 1 },
        { id: 2, type: 'guide', name: 'B', keys: [k[1]], done: 2 },
        { id: 3, type: 'guide', name: 'C', keys: [k[2]], tn: 1 },
        { id: 4, type: 'guide', name: 'D', keys: [k[3]] },
        { id: 5, type: 'palette', name: 'E', keys: [k[4]] },
      ];
      save();
      fullRender();
      return { own, k };
    });
    await page.click('#rndFresh');
    await idle(page);
    assert.equal(await page.evaluate(() => state.rndFresh), 1);
    assert.equal(await page.textContent('#rndFreshNote'), '2 of the 5 left to draw haven’t been used yet');
    assert.deepEqual(await page.evaluate(() => drawPool().list), [K.own[3], K.own[4]]);
    await draw(page, 1);
    assert.ok([K.own[3], K.own[4]].includes(await page.evaluate(() => state.drawn[0])), 'an unused one');
    assert.equal(await page.textContent('#rndFreshNote'), '1 of the 4 left to draw hasn’t been used yet');
    await draw(page, 1);
    assert.deepEqual(
      (await page.evaluate(() => state.drawn.slice().sort())).sort(),
      [K.own[3], K.own[4]].sort(),
    );
    // all the rest have been used: it says so and draws from all of them
    assert.equal(
      await page.textContent('#rndFreshNote'),
      'Every marker left to draw has been used: drawing from all of them',
    );
    assert.equal(await page.evaluate(() => drawPool().allUsed), true);
    assert.equal(await page.isDisabled('#draw'), false);
    await draw(page, 1);
    assert.equal(await page.evaluate(() => state.drawn.length), 3);
    // remembered
    await page.reload();
    await idle(page);
    assert.equal(await page.isChecked('#rndFresh'), true);
    assert.equal(await page.evaluate(() => state.rndFresh), 1);
    await page.click('#rndFresh');
    await idle(page);
    assert.equal(await page.isVisible('#rndFreshNote'), false);
    assert.equal(await page.evaluate(() => drawPool().list.length), 2, 'off: every marker left');
    // a guide with a photo of its finished page counts too (fn)
    assert.equal(
      await page.evaluate(() => {
        state.saved[3].fn = 5;
        return usedKeys().size;
      }),
      4,
    );
    assert.deepEqual(errors, []);
  });
  test('G9: the worked flag is set when Colour along opens, and kept from save to save; a ticked section sets it at the save', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    // (the sample isn't in the Library: a guide of your own, saved)
    await letterGuide(page);
    await saveGuide(page);
    const row = () =>
      page.evaluate(() => (state.saved.find((s) => s.type === 'guide' && s.id === __mstest.curId) || {}).wk);
    assert.equal(await page.evaluate(() => __mstest.curId != null), true);
    assert.equal(await row(), undefined, 'built, not worked with');
    await page.click('#sfColor');
    await idle(page);
    assert.equal(await row(), 1, 'Colour along opened');
    // kept by the guide's next save
    assert.equal(
      await page.evaluate(() => guideMeta({ name: 'x', keys: [], payload: {} }, __mstest.curId).wk),
      1,
    );
    // another guide: ticked sections set it at the save, without the flag
    assert.equal(
      await page.evaluate(() => guideMeta({ name: 'y', keys: [], n: 4, payload: { prog: [1] } }, 99).wk),
      1,
    );
    assert.equal(
      await page.evaluate(
        () => guideMeta({ name: 'y', keys: [], n: 4, payload: { tones: { 1: 2 } } }, 99).wk,
      ),
      1,
    );
    assert.equal(
      await page.evaluate(() => guideMeta({ name: 'y', keys: [], n: 4, payload: { prog: [] } }, 99).wk),
      undefined,
    );
    assert.deepEqual(errors, []);
  });
  test('Larger text: Random’s rows keep their 44px and nothing runs off the screen', async () => {
    const { page, errors } = await openAtScale(1.3, { storage: ONB });
    await welcome(page, 'look');
    await idle(page);
    await page.click('#mCollection');
    await idle(page);
    await page.click('#mkDrawBtn');
    await idle(page);
    await draw(page, 2);
    for (const s of [
      '#rndBack',
      '#draw',
      '#swap',
      '#undo',
      '#reset',
      '#rndFreshWrap',
      '#remSum',
      '#useInGuide',
    ])
      assert.ok((await rect(page, s)).height >= 44, s + ' ' + (await rect(page, s)).height);
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
      'no sideways scroll',
    );
    assert.deepEqual(errors, []);
  });
}
