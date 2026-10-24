// The shell: tabs, sheets, buttons, Escape and Back, keyboard and screen readers, toasts, tap areas, installing.
// (v320) Tests organised by feature: each block below came from the file named above it, its tests unchanged.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ENGINE,
  addFromMarkers,
  idle,
  openApp,
  openAtScale,
  openMenu,
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

before(setup);
after(teardown);

// ---- from v308-merge-r2.test.mjs ----
// v308 merge (reviewer 2): the dialogs the data and beta branches added under the output branch's focus trap. Each
// opens with its highlighted answer on the keyboard, Tab and Shift+Tab stay in it, and Escape answers Cancel.
{
  const KEY = 'ohuhu-hb320-picker-v3';
  const OWN = ['Ohuhu|R014', 'Ohuhu|Y111', 'Ohuhu|B08', 'Ohuhu|G36'];
  const onboarded = (extra = {}) => ({
    'ms-onboarded': '1',
    'ms-setup-tip': '1',
    'ms-last-ver': 'v308',
    [KEY]: JSON.stringify({
      mode: 'home',
      ownedSeedV: 2,
      copicAdd1: 1,
      libAdj1: 1,
      setFix1: 1,
      owned: OWN,
      saved: [],
    }),
    ...extra,
  });
  const file = (o, name = 'b.json') => ({
    name,
    mimeType: 'application/json',
    buffer: Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)),
  });
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
  // what has the keyboard: a dialog answer's data-a, else its id
  const focused = (page) =>
    page.evaluate(() => {
      const a = document.activeElement;
      return a ? (a.dataset && a.dataset.a) || a.id || a.tagName : null;
    });
  // Tab round the dialog: every stop is inside it, and it comes back to where it started
  async function tabRound(page, keys = 'Tab') {
    const start = await focused(page),
      seen = [];
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press(keys);
      assert.ok(
        await page.evaluate(() => document.getElementById('sfEdAsk').contains(document.activeElement)),
        keys + ' stays in the dialog',
      );
      const f = await focused(page);
      if (f === start) return seen;
      seen.push(f);
    }
    assert.fail(keys + ' never came back to ' + start + ': ' + seen.join(','));
  }
  test('a backup from a newer version: Cancel, the highlighted answer, has the keyboard; Enter restores nothing', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180, storage: onboarded() });
    const newer = {
      v: 3,
      type: 'ms-backup',
      app: 'v999',
      ts: Date.now(),
      owned: OWN,
      saved: [{ id: 77, type: 'palette', name: 'Later', keys: ['Ohuhu|R014'], ts: 77 }],
      guides: [],
    };
    await openLib(page);
    await page.setInputFiles('#guidesFile', file(newer));
    await page.waitForSelector('#sfEdAsk');
    assert.equal(await page.getAttribute('#sfEdAsk .btn-primary', 'data-a'), 'stay');
    assert.equal(await focused(page), 'stay', 'Cancel has the keyboard, not Restore anyway');
    assert.deepEqual(await tabRound(page), ['go']);
    assert.deepEqual(await tabRound(page, 'Shift+Tab'), ['go']);
    await page.keyboard.press('Enter');
    await idle(page);
    assert.equal(await page.$('#sfEdAsk'), null);
    assert.equal(await toastText(page), 'Nothing restored.');
    assert.equal(await page.evaluate(() => state.saved.length), 0);
    // Escape is Cancel too
    await page.setInputFiles('#guidesFile', file(newer));
    await page.waitForSelector('#sfEdAsk');
    await page.keyboard.press('Escape');
    await idle(page);
    assert.equal(await page.$('#sfEdAsk'), null);
    assert.equal(await page.evaluate(() => state.saved.length), 0);
    assert.deepEqual(errors, []);
  });
  test('restore choices: Keep my markers has the keyboard, Tab goes round its four answers, Escape restores nothing', async () => {
    const { page, errors } = await openApp({ width: 390, height: 844, storage: onboarded() });
    await openLib(page);
    const bk = {
      v: 3,
      type: 'ms-backup',
      ts: Date.now(),
      owned: ['Ohuhu|R014', 'Copic|E09'],
      saved: [],
      guides: [],
    };
    await page.setInputFiles('#guidesFile', file(bk));
    await page.waitForSelector('#sfEdAsk');
    assert.equal(await focused(page), 'keep');
    assert.deepEqual(await tabRound(page), ['add', 'replace', 'stay']);
    await page.keyboard.press('Escape');
    await idle(page);
    assert.equal(await page.$('#sfEdAsk'), null);
    assert.equal(await page.evaluate(() => state.owned.size), OWN.length);
    assert.equal(await toastText(page), 'Nothing restored.');
    assert.deepEqual(errors, []);
  });
  // (v318.6: a CI run failed here when the question opened within the Library's first moments: the Library, a moment
  // after opening, gave the keyboard to its own Close, under the question, and Tab then left the question)
  test('a question opened just after the Library keeps the keyboard; the Library doesn’t take it back', async () => {
    const { page, errors } = await openApp({ width: 390, height: 844, storage: onboarded() });
    const f = await page.evaluate(async () => {
      openLibrary();
      // (a question as askBox makes it, at once)
      const o = document.createElement('div');
      o.className = 'overlay on';
      o.id = 'sfEdAsk';
      o.innerHTML =
        '<div class="ocard"><button type="button" data-a="stay">Cancel</button>' +
        '<button type="button" class="btn-primary" data-a="go">Go</button></div>';
      document.body.appendChild(o);
      o.querySelector('.btn-primary').focus();
      await new Promise((r) => setTimeout(r, 150));
      return document.activeElement.dataset.a || document.activeElement.id;
    });
    assert.equal(f, 'go');
    assert.deepEqual(await tabRound(page), ['stay']);
    assert.deepEqual(errors, []);
  });
  test('Import a guide already here with ticks this device lacks: Add a copy, the highlighted answer, has the keyboard', async () => {
    const { page, errors } = await openApp({ width: 1180, height: 820 });
    await sampleGuide(page);
    await saveGuide(page);
    const text = await page.evaluate(() => {
      const d = __mstest.currentDesignObj(true);
      d.payload.prog = Object.keys(d.payload.assign).slice(0, 3).map(Number);
      return JSON.stringify(d);
    });
    await openLib(page);
    await page.setInputFiles('#homeImpFile', file(text, 'g.msguide.json'));
    await page.waitForSelector('#sfEdAsk');
    assert.equal(await page.getAttribute('#sfEdAsk .btn-primary', 'data-a'), 'copy');
    assert.equal(await focused(page), 'copy', 'Add a copy has the keyboard, not Open it');
    assert.deepEqual(await tabRound(page), ['stay', 'open']);
    await page.keyboard.press('Escape');
    await idle(page);
    assert.equal(await page.$('#sfEdAsk'), null);
    assert.equal(
      await page.evaluate(() => state.saved.filter((s) => s.type === 'guide').length),
      1,
      'Escape adds nothing',
    );
    assert.deepEqual(errors, []);
  });
  test('a damaged guide and Delete all my data: the highlighted answer has the keyboard, Tab stays in, Escape closes', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await saveGuide(page);
    const id = await page.evaluate(() => state.saved.find((s) => s.type === 'guide').id);
    await page.evaluate(async (id) => {
      const p = await IDB.get('guide-' + id);
      p.lmap = 'data:image/png;base64,' + 'iVBORw0KGgo' + 'A'.repeat(60);
      await IDB.put('guide-' + id, p);
    }, id);
    await page.reload();
    await idle(page);
    await openLib(page);
    await page.click(`#savedList .srow[data-id="${id}"] .sopen`);
    await page.waitForSelector('#sfEdAsk');
    assert.equal(await focused(page), 'restore');
    assert.deepEqual(await tabRound(page), ['del', 'stay']);
    await page.keyboard.press('Escape');
    await idle(page);
    assert.equal(await page.$('#sfEdAsk'), null);
    assert.equal(await page.evaluate(() => state.saved.length), 1, 'Escape deletes nothing');
    // Delete all my data, over Help
    await page.evaluate(() => {
      for (const o of document.querySelectorAll('.overlay.on')) closeDialog(o);
      setMode('home');
    });
    await idle(page);
    await page.click('#homeHelp');
    await page.waitForSelector('#helpOverlay.on');
    await page.click('#helpData > summary');
    await page.click('#helpWipe');
    await page.waitForSelector('#sfEdAsk');
    assert.equal(await focused(page), 'backup');
    // (the box to type DELETE in is a stop too; Delete everything isn't until it's typed)
    assert.deepEqual(await tabRound(page), ['stay', 'wipeWord']);
    await page.keyboard.press('Escape');
    await idle(page);
    assert.equal(await page.$('#sfEdAsk'), null);
    assert.ok(await page.isVisible('#helpOverlay.on'), 'Help stays open under it');
    assert.equal(await page.evaluate(() => localStorage.getItem('ms-onboarded')), '1');
    assert.deepEqual(errors, []);
  });
}

// ---- from v3084.test.mjs ----
// v308.4: the page lock under an open dialog (v308.1) lets go while a box in the dialog is being typed in. On an
// iPad the keyboard, or Scan Text's camera in its place, needs the page free: held, Scan Text stopped after the first
// cap it read, until Scan was closed and opened again.
{
  const held = (page) => page.evaluate(() => document.documentElement.classList.contains('ms-ovl'));
  const scanText = (page, t) =>
    page.evaluate((t) => {
      const b = document.getElementById('scBox');
      b.value = t;
      b.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertReplacementText' }));
    }, t);
  test('Scan: the page is not held while its box has the keyboard, cap after cap; held again when the box is let go of', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180, storage: { 'ms-scan-brand': '' } });
    await welcome(page, 'look');
    await idle(page);
    await page.click('#mCollection');
    await idle(page);
    await scanFromMarkers(page);
    await idle(page);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'scBox', 'straight into the box');
    assert.equal(await held(page), false, 'not held while the box has the keyboard');
    await scanText(page, 'B015 Celadon Blue');
    await page.waitForTimeout(1200);
    assert.equal(await held(page), false, 'still free after the first cap');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'scBox');
    await scanText(page, 'E19 Dried Sage');
    await page.waitForTimeout(1200);
    assert.deepEqual(
      await page.$$eval('#scList .sccode', (l) => l.map((x) => x.textContent)),
      ['E19', 'B015'],
      'the second cap read too',
    );
    // the box let go of (a tap on the dialog's title): held, as any dialog is
    await page.evaluate(() => document.getElementById('scBox').blur());
    await page.waitForTimeout(50);
    assert.equal(await held(page), true, 'held once the box is let go of');
    await page.focus('#scBox');
    assert.equal(await held(page), false, 'free again in the box');
    await page.keyboard.press('Escape');
    await idle(page);
    assert.equal(await held(page), false, 'let go when Scan closes');
    assert.deepEqual(errors, []);
  });
  test('the Library still holds the page; its search box, while typed in, does not', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    // (v313: an empty Library has no search box, so a guide in it)
    await sampleGuide(page);
    await saveGuide(page);
    await page.evaluate(() => openLibrary());
    await page.waitForSelector('#savedOverlay.on');
    await idle(page);
    if (await page.evaluate(() => document.activeElement && document.activeElement.tagName === 'INPUT'))
      await page.evaluate(() => document.activeElement.blur());
    await page.waitForTimeout(50);
    assert.equal(await held(page), true);
    const search = await page.$('#savedOverlay input[type="search"], #savedOverlay input[type="text"]');
    assert.ok(search && (await search.isVisible()), 'the search box');
    await search.focus();
    assert.equal(await held(page), false);
    assert.deepEqual(errors, []);
  });
}

// ---- from v31825-x4.test.mjs ----
// v318.25 in the browser.
{
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
}

// ---- from v31826-w1.test.mjs ----
// v318.26 (W1) in the browser: the polish set (A2 a batch's photos not read, A3 Focus mode's Back in words, A6 the
// welcome's Undo link in place of its toast, A7 an older cap's name in Markers' search, A9 Print's paper a link to its
// choices, and Download PDF on one line) and Send feedback's waits in the form's Message (D). Each fails on v318.25.
{
  const toastOn = (page) =>
    page.evaluate(() => {
      const t = document.getElementById('msToast');
      return !!t && t.classList.contains('on') && getComputedStyle(t).visibility !== 'hidden';
    });
  test('A6 a small phone at 1.6× text: the link fits under the sentence, its tap area clear of the choices, no toast', async () => {
    const { page, errors } = await openAtScale(1.6, { width: 320, height: 568 });
    await page.click('#wcHaveSet');
    await page.check('#wcSets input[data-i="3"]');
    await page.click('#wcAdd');
    await idle(page);
    const g = await page.evaluate(() => {
      const r = (el) => el.getBoundingClientRect(),
        b = document.getElementById('wcUndoBtn'),
        a = getComputedStyle(b, '::after'),
        bb = r(b),
        mid = (bb.top + bb.bottom) / 2,
        more = r(document.getElementById('wcMore')),
        done = r(document.getElementById('wcDone'));
      return {
        h: bb.height,
        w: bb.width,
        tapTop: mid - parseFloat(a.height) / 2,
        tapBottom: mid + parseFloat(a.height) / 2,
        doneBottom: done.bottom,
        moreTop: more.top,
        sideways: document.documentElement.scrollWidth > innerWidth,
      };
    });
    assert.ok(g.h > 10 && g.h < 44, 'a line, not a 44px button: ' + g.h);
    assert.ok(g.tapBottom <= g.moreTop + 1, 'its tap area ends above the choices: ' + JSON.stringify(g));
    assert.equal(g.sideways, false);
    assert.equal(await toastOn(page), false);
    assert.deepEqual(errors, []);
  });
}

// ---- from v31828-y4.test.mjs ----
// v318.28 (Y4) layout, keyboard and screen readers: Palette's sizes and Markers' Order fit a narrow phone with larger
// text, Change colour's two choices say their words in full, the page's live regions are there before their words are
// (toasts, the search's count, the new-version banner), and the banner's ✕ leaves the keyboard on the open tab.
// Each fails on v318.27.
{
  // what runs past the column's own edge (.wrap clips sideways, so the document never scrolls: its scrollWidth can't tell)
  const pastEdge = (page, sel) =>
    page.evaluate((sel) => {
      const w = document.querySelector('.wrap'),
        cs = getComputedStyle(w),
        edge = Math.min(w.getBoundingClientRect().right - parseFloat(cs.paddingRight), innerWidth);
      return [...document.querySelectorAll(sel)]
        .filter((e) => e.getClientRects().length && e.getBoundingClientRect().right > edge + 0.5)
        .map((e) => e.textContent || e.id);
    }, sel);
  // the live region's state in the accessibility tree, as a screen reader is told it (Chromium's)
  const axLive = async (cdp, id) => {
    const { root } = await cdp.send('DOM.getDocument', { depth: 0 });
    const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '#' + id });
    if (!nodeId) return 'absent';
    const n = (await cdp.send('Accessibility.getPartialAXTree', { nodeId, fetchRelatives: false })).nodes[0];
    return n.ignored
      ? 'ignored'
      : (n.properties || []).find((q) => q.name === 'live')?.value?.value || 'not live';
  };
  test('Y4 H1: Palette’s Colours sizes all on the screen at 320 wide, with 1× and 1.6× text', async () => {
    for (const s of [1, 1.6]) {
      const { page, ctx, errors } = await openAtScale(s, { width: 320, height: 568 });
      await welcome(page, 'look');
      await idle(page);
      await page.evaluate(() => setMode('palette'));
      await idle(page);
      for (const h of ['complementary', 'analogous', 'rainbow', 'custom']) {
        await page.click(`#harm [data-h="${h}"]`);
        await idle(page);
        assert.ok(
          (await page.evaluate(() => document.querySelectorAll('#segs button:not(:disabled)').length)) >= 6,
        );
        assert.deepEqual(await pastEdge(page, '#segs button:not(:disabled)'), [], `${h} at ${s}×`);
      }
      assert.deepEqual(errors, []);
      await ctx.close();
    }
  });
  test('Y4 H3: Markers’ Order on the screen on a phone with larger text; as wide as before where there’s room', async () => {
    for (const [w, s] of [
      [320, 1],
      [360, 1.6],
      [820, 1],
    ]) {
      const { page, ctx, errors } = await openAtScale(s, { width: w, height: 800 });
      await welcome(page, 'look');
      await idle(page);
      await page.evaluate(() => setMode('collection'));
      await idle(page);
      await page.click('#ownView [data-v="unowned"]');
      await idle(page);
      assert.deepEqual(await pastEdge(page, '#gapSort'), [], `${w} at ${s}×`);
      if (w > 600)
        assert.ok(
          await page.evaluate(() => {
            const e = document.getElementById('gapSort');
            return e.getBoundingClientRect().width >= 17.8 * parseFloat(getComputedStyle(e).fontSize) - 0.5;
          }),
          'still 17.8em where it fits',
        );
      assert.deepEqual(errors, []);
      await ctx.close();
    }
  });
  test('Y4 H5: Change colour at 320 × 568 with 1.6× text: "Only this section" and "Everywhere (n sections)" in full', async () => {
    const { page, errors } = await openAtScale(1.6, { width: 320, height: 568 });
    await sampleGuide(page);
    await idle(page);
    // a big section in view whose marker is used in more than one section
    const l = await page.evaluate(() => {
      const t = __mstest,
        c = document.getElementById('sfCanvas'),
        r = c.getBoundingClientRect(),
        n = {};
      t.assignData.order.forEach((x) => (n[t.assignData.assign[x]] = (n[t.assignData.assign[x]] || 0) + 1));
      return t.assignData.order
        .filter((x) => {
          const q = t.labelPos(x),
            y = r.top + (q.y / c.height) * r.height,
            X = r.left + (q.x / c.width) * r.width;
          return (
            n[t.assignData.assign[x]] > 1 &&
            y > r.top + 40 &&
            y < Math.min(r.bottom, innerHeight) - 60 &&
            X > r.left + 30 &&
            X < r.right - 30
          );
        })
        .sort((a, b) => t.comps[b].area - t.comps[a].area)[0];
    });
    await scrollTop(page);
    const p = await sectionPoint(page, l);
    await page.mouse.click(p.x, p.y);
    await idle(page);
    await page.click('.sftip [data-a="change"]');
    await page.waitForSelector('#sfSheet .sfpopscope', { state: 'visible' });
    await idle(page);
    const b = await page.evaluate(() =>
      [...document.querySelectorAll('#sfSheet .sfpopscope button')].map((e) => {
        const r = e.getBoundingClientRect();
        return {
          text: e.textContent,
          cut: e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1,
          in: r.left >= 0 && r.right <= innerWidth,
          tall: r.height >= 44,
        };
      }),
    );
    assert.equal(b.length, 2);
    assert.match(b[1].text, /^Everywhere \(\d+ sections\)$/);
    for (const x of b)
      assert.deepEqual({ cut: x.cut, in: x.in, tall: x.tall }, { cut: false, in: true, tall: true }, x.text);
    assert.deepEqual(errors, []);
  });
  test('Y4 H2: the toasts’ and the search’s live regions are in the page, empty, before their first words, and stay', async () => {
    const { page, ctx, errors } = await openApp({ width: 820, height: 1180 });
    const cdp = ENGINE === 'chromium' ? await ctx.newCDPSession(page) : null;
    // at load, before anything is said: both there, empty, at the page's top level (so nothing made inert takes them)
    assert.deepEqual(
      await page.evaluate(() =>
        ['msSay', 'msLive'].map((id) => {
          const e = document.getElementById(id);
          return (
            e && [
              e.parentElement === document.body,
              e.getAttribute('role'),
              e.getAttribute('aria-live'),
              e.textContent,
            ]
          );
        }),
      ),
      [
        [true, 'status', 'polite', ''],
        [true, 'status', 'polite', ''],
      ],
    );
    if (cdp) assert.equal(await axLive(cdp, 'msSay'), 'polite');
    await welcome(page, 'look');
    await idle(page);
    // a toast's words are said from #msSay; the toast itself isn't a second live region saying them again
    await page.evaluate(() => toast('First toast.'));
    assert.equal(await page.textContent('#msSay'), 'First toast.');
    assert.equal(await page.getAttribute('#msToast', 'aria-live'), null);
    assert.equal(await page.getAttribute('#msToast', 'role'), null);
    // once it has gone (hidden, out of the accessibility tree), #msSay is still there for the next one
    await page.waitForFunction(() => !document.getElementById('msToast').classList.contains('on'), null, {
      timeout: 8000,
    });
    await page.waitForTimeout(400);
    if (cdp) {
      assert.equal(await axLive(cdp, 'msToast'), 'ignored');
      assert.equal(await axLive(cdp, 'msSay'), 'polite');
    }
    await page.evaluate(() => toastAction('Section cleared.', 'Undo', () => {}));
    assert.match(await page.textContent('#msSay'), /^Section cleared\.\s*Undo$/);
    // the search's count: the same #msLive that was there from the start
    await page.evaluate(() => {
      window.__added = [];
      new MutationObserver((ms) =>
        ms.forEach((m) => m.addedNodes.forEach((n) => n.id && window.__added.push(n.id))),
      ).observe(document.body, { childList: true });
    });
    await page.evaluate(() => setMode('collection'));
    await idle(page);
    await page.fill('#q', 'R4');
    await page.waitForTimeout(1200);
    assert.match(await page.textContent('#msLive'), /^Matches \(\d+ markers?\)$/);
    assert.ok(
      !(await page.evaluate(() => window.__added)).includes('msLive'),
      'not created holding its words',
    );
    assert.deepEqual(errors, []);
  });
  test('Y4 H2/H4: the new-version banner is said from #msSay; its ✕ by keyboard leaves focus on the open tab', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await welcome(page, 'look');
    await idle(page);
    await page.evaluate(() => {
      navigator.serviceWorker.dispatchEvent(new Event('controllerchange'));
      navigator.serviceWorker.dispatchEvent(new Event('controllerchange'));
    });
    await page.waitForSelector('#msUpd');
    assert.equal(await page.textContent('#msSay'), 'A new version of Marker Studio is ready.');
    assert.equal(
      await page.getAttribute('#msUpd', 'role'),
      null,
      'not a live region inserted holding its words',
    );
    await page.focus('#msUpdX');
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#msUpd').count(), 0);
    assert.equal(
      await page.evaluate(() => document.activeElement === document.querySelector('.modes button.on')),
      true,
    );
    assert.deepEqual(errors, []);
  });
}

// ---- from v31830-w2.test.mjs ----
// v318.30 (W2): 1. the overlays after a turn when the picture's transitionend never comes (Safari, v318.29 Q3): a
// settle pass after the last resize places them as transitionend would have. 2. Rainbow's base kept across a reload.
{
  // the picture's own transitionend held back (as Safari does as a phone turns): only a made one gets through
  const holdBack = (page) =>
    page.evaluate(() => {
      document.addEventListener(
        'transitionend',
        (e) => {
          if (e.isTrusted && e.target && e.target.id === 'sfCanvas') e.stopPropagation();
        },
        true,
      );
    });
  // where the picture and its overlays are on the screen (whole pixels), and the layout's classes
  const geo = (page) =>
    page.evaluate(() => {
      const r = (e) => {
        const b = e.getBoundingClientRect();
        return [b.x, b.y, b.width, b.height].map(Math.round);
      };
      const w = document.getElementById('sfWork'),
        ol = document.querySelector('.sfoutline');
      return {
        side: w.classList.contains('sfside'),
        toolsv: w.classList.contains('sftoolsv'),
        cv: r(document.getElementById('sfCanvas')),
        pic: document.querySelector('#sfView > div')
          ? document.querySelector('#sfView > div').style.transform
          : '',
        outline: ol && ol.style.display !== 'none' ? r(ol) : null,
        rings: [...document.querySelectorAll('.sfring')].map(r),
        zones: [...document.querySelectorAll('.sfzone')].map(r),
      };
    });
  // what the app's own settled pass (the picture's transitionend) would place: the truth to compare with
  const settled = async (page) => {
    await page.evaluate(() => {
      document
        .getElementById('sfCanvas')
        .dispatchEvent(new TransitionEvent('transitionend', { propertyName: 'width' }));
    });
    return geo(page);
  };
  async function turnAndCheck(page, w, h, what) {
    await page.setViewportSize({ width: w, height: h });
    // (the resize's own frame, the ease (0.18 s) and the settle pass (0.25 s after the last resize) all past)
    await page.waitForTimeout(900);
    await idle(page);
    const got = await geo(page),
      want = await settled(page);
    assert.deepEqual(
      got,
      want,
      what + ' at ' + w + 'x' + h + ': the overlays where a settled picture has them',
    );
    assert.ok(got.cv[2] > 50 && got.cv[3] > 50, what + ': the picture has a size');
    return got;
  }
  async function alongRow(page) {
    await page.click('#sfColor');
    await idle(page);
    await scrollTop(page);
    await page.locator('#sfAlist .sfarow .sfah').nth(1).click();
    await idle(page);
    await page.waitForFunction(() => {
      const o = document.querySelector('.sfoutline');
      return !!o && o.style.display !== 'none';
    });
  }
  // the Plan's "N rough spots" line and its rings: a Gradient zone over the top of the sample (e2e/rough-count)
  async function roughRings(page) {
    const top = await page.evaluate(() => {
      const t = __mstest;
      return t.assignData.order
        .map((l) => [l, t.comps[l].cy])
        .sort((a, b) => a[1] - b[1])
        .slice(0, 3)
        .map((x) => x[0]);
    });
    await page.click('.sftabbtn[data-t="pattern"]');
    await idle(page);
    await page.click('#sfZoneAdd');
    await idle(page);
    for (const l of top) {
      await scrollTop(page);
      const p = await sectionPoint(page, l);
      await page.mouse.click(p.x, p.y);
      await idle(page);
    }
    await page.click('#sfZoneDone');
    await idle(page);
    await page.click('#sfPanel-pattern .sfzchip[data-z="0"]');
    await idle(page);
    await page.waitForSelector('#sfRoughGo');
    await scrollTop(page);
    await page.waitForFunction(() => document.querySelectorAll('.sfring').length > 0);
  }
  // 2. Rainbow's base across a reload (v318.28 C4 kept it across band taps; the label was lost on reload as the base
  // wasn't saved beside the palette: state.palB now, in step with palH)
  const card = (page) =>
    page.evaluate(() => ({
      pal: state.palettes[state.palettes.length - 1].join(),
      palH: state.palH.slice(),
      sub: document.querySelector('#readout .fam').textContent,
    }));
  for (const [pw, ph] of [
    [375, 667],
    [820, 1180],
  ]) {
    test(`Colour along, a row open: its outline is placed after a turn without transitionend (${pw}x${ph})`, async () => {
      const { page, errors } = await openApp({ width: pw, height: ph });
      await sampleGuide(page);
      await alongRow(page);
      await holdBack(page);
      const a = await turnAndCheck(page, ph, pw, 'landscape');
      assert.ok(a.outline, 'the outline shows in landscape');
      const b = await turnAndCheck(page, pw, ph, 'back in portrait');
      assert.ok(b.outline, 'the outline shows again in portrait');
      assert.equal(b.side, false, 'one column again');
      assert.deepEqual(errors, []);
    });
    test(`Focus mode with shading: the picture and zones are placed after a turn without transitionend (${pw}x${ph})`, async () => {
      const { page, errors } = await openApp({ width: pw, height: ph });
      await sampleGuide(page);
      await page.click('.sftabbtn[data-t="shading"]');
      await page.evaluate(() => __mstest.shadeTo('full'));
      await idle(page);
      await page.click('#sfColor');
      await idle(page);
      await page.click('#sfFocus');
      await idle(page);
      await holdBack(page);
      await turnAndCheck(page, ph, pw, 'landscape');
      await turnAndCheck(page, pw, ph, 'back in portrait');
      assert.ok(
        await page.evaluate(() => document.getElementById('sfRoot').classList.contains('sffoc')),
        'still in Focus mode',
      );
      assert.deepEqual(errors, []);
    });
    test(`the Plan's rough rings are placed after a turn without transitionend (${pw}x${ph})`, async () => {
      const { page, errors } = await openApp({ width: pw, height: ph });
      await sampleGuide(page);
      await roughRings(page);
      await holdBack(page);
      const a = await turnAndCheck(page, ph, pw, 'landscape');
      assert.ok(a.rings.length > 0, 'rings in landscape');
      const b = await turnAndCheck(page, pw, ph, 'back in portrait');
      assert.ok(b.rings.length > 0, 'rings again in portrait');
      assert.deepEqual(errors, []);
    });
  }
  test('a Rainbow built from G310 on Honolulu 120 still says "· Ohuhu … base" after a reload', async () => {
    const { page, errors } = await openApp();
    await welcome(page, 'look');
    await idle(page);
    await page.evaluate(() => {
      state.owned = new Set(presetMkeys(MARKER_SETS.find((s) => s.n === 'Honolulu 120')));
      state.ink = {};
      save();
    });
    await page.click('#mPalette');
    await idle(page);
    await page.click('#harm button[data-h="rainbow"]');
    await idle(page, 800);
    const si = await page.evaluate(() => {
      const si = COLORS.findIndex((c, i) => inPool(i) && c.code === 'G310');
      state.palSize = 8;
      setSeed(mkey(si));
      return si;
    });
    await idle(page, 1500);
    const a = await card(page),
      // (the label names the marker: "Rainbow · Ohuhu Shamrock Green base")
      want = await page.evaluate((si) => 'Rainbow · Ohuhu ' + capName(si) + ' base', si);
    assert.equal(a.sub, want);
    // what was saved: the base beside its palette, null beside the others, nothing held on state itself
    const saved = await page.evaluate(() => {
      const v = JSON.parse(localStorage.getItem(KEY));
      return { palB: v.palB, n: v.palettes.length, onState: 'palB' in state };
    });
    assert.equal(saved.n, a.palH.length);
    assert.ok(Array.isArray(saved.palB), 'palB saved beside palH');
    assert.equal(
      saved.palB[saved.n - 1],
      si,
      'the base is saved beside its palette: ' + JSON.stringify(saved.palB),
    );
    assert.equal(saved.onState, false);
    await page.reload();
    await page.waitForSelector('#readout .fam');
    await idle(page, 1500);
    const b = await card(page);
    assert.equal(b.pal, a.pal, 'the same palette after the reload');
    assert.equal(b.sub, want, 'the base is still named');
    // another band re-rolled: still built from it (v318.28 C4), and Undo back to the palette before too
    const k = await page.evaluate(
      (si) => (state.palettes[state.palettes.length - 1].indexOf(si) === 0 ? 1 : 0),
      si,
    );
    await page.click(`#bands .band:nth-child(${k + 1}) .bhit`);
    await idle(page, 1500);
    assert.equal((await card(page)).sub, want, 'after a band tap');
    // a stored base that doesn't fit its palette (an older version carried it as the palette changed) is let go
    await page.evaluate(() => {
      const v = JSON.parse(localStorage.getItem(KEY));
      v.palB = v.palettes.map(() => 2);
      localStorage.setItem(KEY, JSON.stringify(v));
    });
    await page.reload();
    await page.waitForSelector('#readout .fam');
    await idle(page, 1500);
    assert.equal((await card(page)).sub, 'Rainbow', 'a base not in the palette is not named');
    assert.deepEqual(errors, []);
  });
}

// ---- from v31833-design.test.mjs ----
// v318.33 (Y1): the design system and the shared controls. Tokens for space, heights and line heights in 01-base.css;
// one corner rule (--r-md every standalone control, --r-lg cards, tracks and sheets, --r-sm a segment in a track);
// --h-ctl 44 for buttons and fields, --h-seg 40 in a 3px track; one "chosen" look (the white pill marks the main menu
// only, a setting is a teal segment in a track, cards only with pictures); Palette's Harmony as a 3-column grid with
// its label above on a phone; Focus' Exit pill with the 44px tap area. Fails on v318.32.
{
  const css = (page, sel, prop, pseudo) =>
    page.evaluate(
      ([s, p, ps]) => getComputedStyle(document.querySelector(s), ps || null)[p],
      [sel, prop, pseudo],
    );
  const height = (page, sel) => page.$eval(sel, (e) => Math.round(e.getBoundingClientRect().height));
  const token = (page, name) =>
    page.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), name);
  test('the tokens, heights and corners: a button is 12px-cornered and 44px, a segment 40px in a 16px track, the search 44px', async () => {
    const { page, errors } = await openApp();
    await welcome(page, 'look');
    await idle(page);
    for (const [n, v] of [
      ['--s3', '12px'],
      ['--s4', '16px'],
      ['--h-ctl', '44px'],
      ['--h-seg', '40px'],
      ['--h-sm', '36px'],
      ['--lh-tight', '1.2'],
      ['--lh', '1.45'],
    ])
      assert.equal(await token(page, n), v, n);
    await page.click('#mCollection');
    await idle(page);
    assert.equal(await css(page, '.search', 'borderRadius'), '12px', 'a field');
    assert.equal(await height(page, '.search'), 44, 'the search at --h-ctl');
    assert.equal(await height(page, '#gapSort'), 44, 'the Order drop-down at --h-ctl');
    assert.equal(await css(page, '#mkAddBtn', 'borderRadius'), '12px', 'the button default is --r-md');
    assert.equal(await css(page, '.modes', 'borderRadius'), '16px', 'the menu is a track');
    assert.equal(await height(page, '.modes button'), 40, 'a tab at --h-seg');
    assert.equal(
      await css(page, '.modes button.on', 'borderRadius'),
      '8px',
      'the pill in the track at --r-sm',
    );
    await page.click('#mPalette');
    await idle(page);
    assert.equal(await css(page, '#harm', 'borderRadius'), '16px', '.segs is a track');
    assert.equal(await css(page, '#segs button.on', 'borderRadius'), '8px');
    assert.equal(await height(page, '#segs button'), 40);
    assert.deepEqual(errors, []);
  });
  test('Harmony is a grid of three columns; on a phone its label sits above the grid, on an iPad beside it', async () => {
    const tops = (page) =>
      page.evaluate(() => {
        const t = (s) => Math.round(document.querySelector(s).getBoundingClientRect().top),
          l = (s) => Math.round(document.querySelector(s).getBoundingClientRect().left);
        return {
          row1: ['complementary', 'analogous', 'triadic'].map((h) => t(`#harm [data-h="${h}"]`)),
          row2: ['split', 'tetradic', 'mono'].map((h) => t(`#harm [data-h="${h}"]`)),
          // (v318.34: the three ramp schemes make a row of their own, so four rows)
          row3: ['shadow', 'accent', 'neutral'].map((h) => t(`#harm [data-h="${h}"]`)),
          row4: ['rainbow', 'custom', 'photo'].map((h) => t(`#harm [data-h="${h}"]`)),
          label: t('#harmLbl'),
          grid: t('#harm'),
          labelL: l('#harmLbl'),
          gridL: l('#harm'),
          cols: getComputedStyle(document.getElementById('harm')).gridTemplateColumns.split(' ').length,
        };
      });
    const phone = await openApp();
    await welcome(phone.page, 'look');
    await phone.page.click('#mPalette');
    await idle(phone.page);
    let r = await tops(phone.page);
    assert.equal(r.cols, 3, 'three columns');
    for (const k of ['row1', 'row2', 'row3', 'row4'])
      assert.ok(
        r[k].every((y) => y === r[k][0]),
        k + ' one row: ' + r[k],
      );
    assert.ok(r.row1[0] < r.row2[0] && r.row2[0] < r.row3[0] && r.row3[0] < r.row4[0], 'four rows');
    assert.ok(
      r.label < r.grid && Math.abs(r.labelL - r.gridL) < 4,
      'phone: the label above the grid, lined up ' + JSON.stringify(r),
    );
    assert.deepEqual(phone.errors, []);
    const ipad = await openApp({ width: 820, height: 1180, touch: true });
    await welcome(ipad.page, 'look');
    await ipad.page.click('#mPalette');
    await idle(ipad.page);
    r = await tops(ipad.page);
    assert.equal(r.cols, 3);
    assert.ok(
      r.labelL < r.gridL && r.label >= r.grid,
      'iPad: the label beside the grid ' + JSON.stringify(r),
    );
    assert.deepEqual(ipad.errors, []);
  });
  test('Larger text: the full harmony names wrap inside their cells, nothing runs past the track', async () => {
    const { page, errors } = await openAtScale(1.6, { width: 390, height: 844 });
    await welcome(page, 'look');
    await page.click('#mPalette');
    await idle(page);
    const fit = await page.evaluate(() => {
      const h = document.getElementById('harm').getBoundingClientRect();
      return [...document.querySelectorAll('#harm button')].map((b) => {
        const r = b.getBoundingClientRect();
        return {
          t: b.textContent,
          ok: r.right <= h.right + 1 && r.left >= h.left - 1 && b.scrollWidth <= b.clientWidth + 1,
        };
      });
    });
    assert.deepEqual(
      fit.filter((x) => !x.ok),
      [],
      JSON.stringify(fit),
    );
    // (v318.33) a one-word name is never broken mid-word: the grid goes to two columns before a third of the row is too
    // narrow for "Complementary" (as tall as Triadic, one line)
    const one = await page.evaluate(() =>
      ['complementary', 'mono', 'analogous', 'triadic'].map((h) => {
        const b = document.querySelector(`#harm [data-h="${h}"]`),
          r = document.createRange();
        r.selectNodeContents(b);
        return r.getClientRects().length;
      }),
    );
    assert.deepEqual(one, [1, 1, 1, 1], 'one line each: ' + one);
    assert.deepEqual(errors, []);
  });
  test('one chosen look: Colours from and Lean towards are teal segments in a track; Theme and Mood keep their cards', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180, touch: true, moreShut: true });
    await sampleGuide(page);
    await idle(page);
    const pick = await page.evaluate(() => {
      const d = document.createElement('div');
      d.style.background = 'var(--pick-bg)';
      document.body.appendChild(d);
      const c = getComputedStyle(d).backgroundColor;
      d.remove();
      return c;
    });
    for (const id of ['sfSrc', 'sfPal']) {
      assert.equal(await css(page, '#' + id, 'borderRadius'), '16px', id + ' is a track');
      assert.notEqual(
        await css(page, '#' + id, 'backgroundColor'),
        'rgba(0, 0, 0, 0)',
        id + ' has the track fill',
      );
      assert.equal(
        await css(page, '#' + id + ' .sfedit.on', 'backgroundColor'),
        pick,
        id + ' chosen in teal',
      );
      assert.equal(
        await css(page, '#' + id + ' .sfedit:not(.on)', 'backgroundColor'),
        'rgba(0, 0, 0, 0)',
        id + ' the others bare',
      );
      assert.equal(
        await css(page, '#' + id + ' .sfedit:not(.on)', 'borderTopColor'),
        'rgba(0, 0, 0, 0)',
        id + ' no card edges',
      );
      assert.equal(await height(page, '#' + id + ' .sfedit'), 40, id + ' segments at --h-seg');
      assert.ok(
        parseFloat(await css(page, '#' + id + ' .sfedit', 'height', '::after')) >= 44,
        id + ' 44px to tap',
      );
    }
    // the pictures keep their cards: Theme's strips, Mood's pictures
    assert.equal(await css(page, '#sfTheme', 'borderTopWidth'), '0px', 'Theme: no track');
    assert.notEqual(
      await css(page, '#sfTheme .sfedit:not(.on)', 'borderTopColor'),
      'rgba(0, 0, 0, 0)',
      'Theme cards keep their edges',
    );
    assert.ok(await page.$('.sfmoodpics .sfmp'), 'Mood pictures');
    // (v320, Ben's D3b: the tab you're on is tinted its own colour, Guide's violet at 22% with a 70% edge)
    assert.equal(await css(page, '.modes button.on', 'backgroundColor'), 'rgba(139, 108, 255, 0.22)');
    await page.click('.sftabbtn[data-t="pattern"]');
    await idle(page);
    assert.equal(await css(page, '#sfFam', 'borderRadius'), '16px', 'Pattern family: a track');
    assert.equal(await css(page, '#sfShape', 'borderTopWidth'), '0px', 'Flow (pictures): no track');
    assert.deepEqual(errors, []);
  });
  test('Focus: the 40px Exit pill has the 44px tap area', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await page.click('#sfColor');
    await idle(page);
    await page.click('#sfFocus');
    await idle(page);
    const hit = await page.evaluate(() => {
      const b = document.getElementById('sfExitFoc'),
        r = b.getBoundingClientRect(),
        cx = r.left + r.width / 2,
        cy = r.top + r.height / 2,
        at = (y) => {
          const e = document.elementFromPoint(cx, y);
          return !!e && (e === b || b.contains(e));
        };
      return { h: Math.round(r.height), up: at(cy - 21), down: at(cy + 21) };
    });
    assert.equal(hit.h, 40);
    assert.ok(hit.up && hit.down, JSON.stringify(hit));
    assert.deepEqual(errors, []);
  });
}

// ---- from v31833-polish.test.mjs ----
// v318.33 Stage 2 polish (docs/PLAN-v31832.md, Fable V1): Markers' one tools row, the guide's underline tabs (still
// pinned), the backdrop behind a sheet, the Library's empty state and the guide's name in the app's serif.
{
  const rect = (page, sel) =>
    page.evaluate((s) => {
      const e = document.querySelector(s);
      return e ? e.getBoundingClientRect().toJSON() : null;
    }, sel);
  // a small collection, as e2e/markers.test.mjs seeds it
  const KEY = 'ohuhu-hb320-picker-v3';
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
  const onboardedV265 = (extra = {}) => ({
    'ms-onboarded': '1',
    'ms-setup-tip': '1',
    'ms-last-ver': 'v265',
    ...extra,
  });
  const style = (page, sel, props) =>
    page.evaluate(
      ([s, ps]) => {
        const cs = getComputedStyle(document.querySelector(s));
        return Object.fromEntries(ps.map((p) => [p, cs[p]]));
      },
      [sel, props],
    );
  test('Markers: Random, Match a colour, Add markers and Swatch chart are one row of matching buttons; Filters sits 8px under Order', async () => {
    const { page, errors } = await openApp({
      storage: onboardedV265({ [KEY]: appState({ collView: 'all' }) }),
    });
    await page.click('#mCollection');
    await idle(page);
    assert.deepEqual(await page.$$eval('#mkDraw > button', (b) => b.map((x) => x.id)), [
      'mkDrawBtn',
      'mkMatchBtn',
      'mkAddBtn',
      'mkJump',
    ]);
    assert.equal((await page.textContent('#mkJump')).trim(), 'Swatch chart');
    assert.ok(await page.$('#mkJump svg.ic'), 'an icon like its neighbours, not an arrow');
    const looks = await page.$$eval('#mkDraw > button', (b) =>
      b.map((x) => {
        const cs = getComputedStyle(x);
        return [
          cs.borderTopWidth,
          cs.borderTopLeftRadius,
          cs.backgroundColor,
          cs.fontSize,
          cs.fontWeight,
          cs.textDecorationLine,
          Math.round(x.getBoundingClientRect().height),
        ].join('|');
      }),
    );
    assert.equal(new Set(looks).size, 1, 'one look: ' + looks.join(' / '));
    assert.match(looks[0], /^1px\|12px\|.*\|13px\|600\|none\|44$/);
    // the row wraps on a phone: two and two, the second pair under the first
    const r = await rect(page, '#mkDrawBtn'),
      a = await rect(page, '#mkAddBtn'),
      j = await rect(page, '#mkJump');
    assert.ok(
      a.top > r.bottom && Math.abs(a.top - j.top) < 0.5,
      'Add markers and Swatch chart on the second line',
    );
    // Filters' top margin 8px (22 before); Order is between the row and Filters
    assert.equal((await style(page, '#filterBar', ['marginTop'])).marginTop, '8px');
    const o = await rect(page, '#gapWrap'),
      f = await rect(page, '#filterBar');
    assert.ok(o.top > a.bottom && f.top > o.bottom, 'row, Order, Filters');
    const first = await page.$eval('#results .cell', (c) => c.getBoundingClientRect().top);
    // (about 740 before: Add markers and the link each on a line of their own, then the 40px gap)
    assert.ok(first < 700, 'the first swatch higher on the first screen: ' + first);
    // the jump still goes down to the swatch chart
    await page.click('#mkJump');
    await page.waitForFunction(
      () => {
        const r = document.getElementById('swatchBtn').getBoundingClientRect();
        return r.top >= 0 && r.bottom <= innerHeight;
      },
      null,
      { timeout: 5000 },
    );
    assert.deepEqual(errors, []);
  });
  test('Guide: the inner tabs are underline tabs (no track; a baseline; a 2px underline on the open one) and still pin', async () => {
    const { page, errors } = await openApp({ touch: true });
    await sampleGuide(page);
    const tabs = await style(page, '.sftabs', [
      'padding',
      'borderTopWidth',
      'borderBottomWidth',
      'borderTopLeftRadius',
      'backgroundColor',
    ]);
    assert.equal(tabs.padding, '0px');
    assert.equal(tabs.borderTopWidth, '0px');
    assert.equal(tabs.borderBottomWidth, '1px');
    assert.equal(tabs.borderTopLeftRadius, '0px');
    assert.notEqual(
      tabs.backgroundColor,
      'rgba(0, 0, 0, 0)',
      'a flat colour, so the controls never show through the pinned tabs',
    );
    const on = await style(page, '.sftabbtn.on', ['backgroundColor', 'boxShadow', 'borderTopLeftRadius']);
    assert.equal(on.backgroundColor, 'rgba(0, 0, 0, 0)', 'no white pill');
    assert.equal(on.borderTopLeftRadius, '0px');
    // (v320: one 2px underline that slides from tab to tab, under the open one, once it's placed: the tab's own
    // until then)
    await page.waitForFunction(() => document.querySelector('.sftabs').classList.contains('sful'));
    const ul = await page.evaluate(() => {
      const t = document.querySelector('.sftabs'),
        o = t.querySelector('.sftabbtn.on'),
        a = getComputedStyle(t, '::after');
      return {
        h: a.height,
        w: Math.abs(parseFloat(a.width) - o.offsetWidth),
        x: Math.abs(new DOMMatrix(a.transform).m41 - o.offsetLeft),
        own: getComputedStyle(o).boxShadow,
      };
    });
    assert.equal(ul.h, '2px');
    assert.ok(ul.w < 1 && ul.x < 1, 'under the open tab: ' + JSON.stringify(ul));
    assert.equal(ul.own, 'none', 'not the tab’s own as well');
    const off = await style(page, '.sftabbtn:not(.on)', ['boxShadow', 'backgroundColor']);
    assert.equal(off.boxShadow, 'none');
    assert.equal(off.backgroundColor, 'rgba(0, 0, 0, 0)');
    assert.ok((await rect(page, '.sftabbtn')).height >= 44, 'a finger-sized tab');
    // the pin: scrolled well past them, the tabs sit at their sticky top (the pinned picture's foot)
    await page.evaluate(() => window.scrollTo(0, 600));
    await page.waitForFunction(
      () => {
        const t = document.querySelector('.sftabs');
        return Math.abs(t.getBoundingClientRect().top - parseFloat(getComputedStyle(t).top)) < 1;
      },
      null,
      { timeout: 5000 },
    );
    const t = await rect(page, '.sftabs'),
      pin = await page.evaluate(() =>
        parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--pinH')),
      );
    assert.ok(Math.abs(t.top - pin) < 1, `pinned at --pinH ${pin}: ${t.top}`);
    assert.deepEqual(errors, []);
  });
  // (v318.37, X4-1: the menu's dim takes the tap and closes the menu, e2e/v31837-shell; only a picker's lets taps through)
  test('Guide: a dim backdrop behind a sheet, in the guide’s own stacking context; a picker’s takes no taps', async () => {
    const { page, errors } = await openApp({ touch: true });
    await sampleGuide(page);
    await page.click('#sfMore');
    await page.waitForSelector('#sfSheet .sfmitem');
    await idle(page);
    const sc = await page.evaluate(() => {
      const s = document.querySelector('#sfRoot .sfscrim'),
        cs = getComputedStyle(s);
      return {
        parent: s.parentElement.id,
        next: s.nextElementSibling && s.nextElementSibling.id,
        bg: cs.backgroundColor,
        pe: cs.pointerEvents,
        pos: cs.position,
        z: +cs.zIndex,
        zs: +getComputedStyle(document.getElementById('sfSheet')).zIndex,
        w: s.getBoundingClientRect().width,
        h: s.getBoundingClientRect().height,
        hidden: s.getAttribute('aria-hidden'),
      };
    });
    assert.equal(sc.parent, 'sfRoot');
    assert.equal(sc.next, 'sfSheet', 'just under the sheet');
    assert.equal(sc.bg, 'rgba(0, 0, 0, 0.5)');
    assert.equal(sc.pe, 'auto', 'v318.37: the menu’s dim takes the tap');
    assert.equal(sc.pos, 'fixed');
    assert.ok(sc.z < sc.zs, 'under the sheet');
    assert.deepEqual([sc.w, sc.h, sc.hidden], [390, 844, 'true']);
    await page.keyboard.press('Escape');
    await idle(page);
    assert.equal(await page.$('#sfRoot .sfscrim'), null, 'gone with the sheet');
    // the picture stays in use under it: a tap on another section moves the picker (one backdrop, not two)
    const shown = (not) =>
      page.evaluate((not) => {
        const t = __mstest,
          c = document.getElementById('sfCanvas'),
          r = c.getBoundingClientRect(),
          sh = document.getElementById('sfSheet'),
          k = r.width / c.width;
        const bot = Math.min(r.bottom, innerHeight, sh ? sh.getBoundingClientRect().top : 1e9),
          top = Math.max(r.top, 0);
        return t.assignData.order.find(
          (l) =>
            l !== not &&
            (() => {
              const q = t.labelPos(l),
                x = r.left + q.x * k,
                y = r.top + q.y * k;
              return y > top + 12 && y < bot - 12 && x > r.left + 12 && x < r.right - 12 && q.r * k > 5;
            })(),
        );
      }, not);
    const l1 = await shown(0);
    let p = await sectionPoint(page, l1);
    await page.mouse.click(p.x, p.y);
    await idle(page);
    await page.click('.sftip [data-a="change"]');
    await page.waitForSelector('#sfSheet.sfpicksh');
    await idle(page);
    assert.equal(await page.$$eval('#sfRoot .sfscrim', (s) => s.length), 1);
    assert.equal(
      await page.$eval('#sfRoot .sfscrim', (s) => getComputedStyle(s).pointerEvents),
      'none',
      'a picker’s dim lets the tap through',
    );
    const l2 = await shown(l1);
    p = await sectionPoint(page, l2);
    await page.mouse.click(p.x, p.y);
    await idle(page);
    assert.ok(await page.$('#sfSheet.sfpicksh'), 'the picker moved, still open');
    assert.equal(await page.$$eval('#sfRoot .sfscrim', (s) => s.length), 1, 'still one backdrop');
    await page.click('#sfPopCancel');
    await idle(page);
    assert.equal(await page.$('#sfRoot .sfscrim'), null);
    assert.deepEqual(errors, []);
  });
  test('Guide: the name is in Fraunces at --t-xl, like every other screen title', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    const t = await style(page, '#sfGTitle', ['fontFamily', 'fontSize', 'fontWeight']);
    assert.match(t.fontFamily, /^"?Fraunces/);
    assert.equal(
      t.fontSize,
      await page.evaluate(() => getComputedStyle(document.querySelector('.title')).fontSize),
    );
    assert.equal(t.fontWeight, '500');
    assert.deepEqual(errors, []);
  });
  // (v320, Ben's D8a: the sample page and its coloured page as two sheets, a heading, the words, Choose a photo, then
  // "or try the sample")
  test('Library, empty: the sample’s two pages, then the words, then Choose a photo and the sample', async () => {
    const { page, errors } = await openApp();
    await welcome(page, 'look');
    await idle(page);
    await page.click('#mHome');
    await page.click('#homeLibCard');
    await page.waitForSelector('#savedList .emptyhow');
    await idle(page);
    assert.deepEqual(
      await page.$$eval('#savedList .emptyhow > *', (c) => c.map((x) => x.className.split(' ')[0] || x.id)),
      ['libfan', 'libemh', 'empty', 'btn-primary', 'sflink'],
    );
    const fan = await rect(page, '#savedList .libfan'),
      head = await rect(page, '#savedList .libemh'),
      text = await rect(page, '#savedList .empty'),
      go = await rect(page, '#libChoose'),
      btn = await rect(page, '#libTrySample');
    assert.equal(await page.locator('#savedList .libfan img').count(), 2);
    assert.ok(
      fan.bottom <= head.top && head.bottom <= text.top && text.bottom <= go.top && go.bottom <= btn.top,
      'the pages, heading, words, Choose a photo, the sample, top to bottom',
    );
    assert.ok(Math.abs(fan.left + fan.width / 2 - (go.left + go.width / 2)) < 1, 'centred');
    assert.equal(await page.textContent('#savedList .libemh'), 'Your guides will live here');
    assert.equal(await page.textContent('#libTrySample'), 'or try the sample');
    assert.deepEqual(errors, []);
  });
}

// ---- from v31837-shell.test.mjs ----
// v318.37, the shell (Fable X4): a tap on a sheet's dim closes the sheet and does nothing else (X4-1; a picker's dim
// still lets taps through to the picture); Home's "Updated to … · What's new" lists every version since the one last
// seen (X4-2); 44px tap areas on the checkbox rows, Colour along's More, the Library's search and Sort and the guide's
// selects (X4-3); Home's three cards aligned at 320px (X4-4).
{
  const ONB = { 'ms-onboarded': '1', 'ms-setup-tip': '1' };
  const rect = (page, sel) =>
    page.evaluate((s) => {
      const r = document.querySelector(s).getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height, r: r.right, b: r.bottom };
    }, sel);
  // a section's label point on screen, in the picture's visible part above the sheet (not the one given)
  const shownSec = (page, not) =>
    page.evaluate((not) => {
      const t = __mstest,
        c = document.getElementById('sfCanvas'),
        r = c.getBoundingClientRect(),
        sh = document.getElementById('sfSheet'),
        side = sh && sh.classList.contains('sfshside'),
        k = r.width / c.width;
      // (the sheet under the picture in portrait, beside it on an iPad sideways)
      const bot = Math.min(r.bottom, innerHeight, sh && !side ? sh.getBoundingClientRect().top : 1e9),
        right = Math.min(r.right, innerWidth, sh && side ? sh.getBoundingClientRect().left : 1e9),
        top = Math.max(r.top, 0);
      return t.assignData.order.find((l) => {
        if (l === not) return false;
        const q = t.labelPos(l),
          x = r.left + q.x * k,
          y = r.top + q.y * k;
        return y > top + 12 && y < bot - 12 && x > r.left + 12 && x < right - 12 && q.r * k > 5;
      });
    }, not);
  const sheetState = (page) =>
    page.evaluate(() => ({
      sheet: !!document.getElementById('sfSheet'),
      scrims: document.querySelectorAll('#sfRoot .sfscrim').length,
      pe: (() => {
        const s = document.querySelector('#sfRoot .sfscrim');
        return s ? getComputedStyle(s).pointerEvents : null;
      })(),
      tip: !!document.querySelector('.sftip'),
      on: document.documentElement.classList.contains('sfsheeton'),
    }));
  // the tap area a control answers to: its box, plus the strips an absolutely placed ::before (above) and ::after
  // (below) add to it
  const tapBox = (page, sel) =>
    page.evaluate((s) => {
      const el = document.querySelector(s),
        r = el.getBoundingClientRect();
      let h = r.height;
      for (const ps of ['::before', '::after']) {
        const cs = getComputedStyle(el, ps);
        if (cs.content !== 'none' && cs.position === 'absolute') h += parseFloat(cs.height) || 0;
      }
      return { w: Math.round(r.width), h: Math.round(h), box: Math.round(r.height) };
    }, sel);
  for (const [name, vp] of [
    ['phone', { width: 390, height: 844 }],
    ['iPad sideways', { width: 1180, height: 820 }],
  ]) {
    test(`Guide (${name}): a tap on the ⋯ menu's dim closes the menu and nothing else; a picker's dim lets the tap through to the picture`, async () => {
      const { page, errors } = await openApp({ ...vp, touch: true });
      await sampleGuide(page);
      await openMenu(page);
      await idle(page);
      let st = await sheetState(page);
      assert.equal(st.pe, 'auto', 'the menu’s dim takes the tap');
      // a tap on a section under the dim: the menu closes, and no tip opens for the section (X4-1: it opened bright
      // over the dim with the menu still open)
      const l1 = await shownSec(page, 0);
      assert.ok(l1 > 0, 'a section shows above the sheet');
      let p = await sectionPoint(page, l1);
      await page.touchscreen.tap(p.x, p.y);
      await idle(page);
      st = await sheetState(page);
      assert.deepEqual([st.sheet, st.scrims, st.tip, st.on], [false, 0, false, false], JSON.stringify(st));
      // the picture still takes taps afterwards: the same section's tip opens (its point found again: the page scrolled
      // back and the picture unpinned as the sheet closed)
      p = await sectionPoint(page, l1);
      await page.touchscreen.tap(p.x, p.y);
      await idle(page);
      assert.ok(await page.$('.sftip [data-a="change"]'), 'a tap after it opens the tip as ever');
      // the picker's dim: a tap on another section moves the picker, which stays open
      await page.click('.sftip [data-a="change"]');
      await page.waitForSelector('#sfSheet.sfpicksh');
      await idle(page);
      st = await sheetState(page);
      assert.equal(st.pe, 'none', 'a picker’s dim lets taps through');
      const l2 = await shownSec(page, l1);
      p = await sectionPoint(page, l2);
      await page.touchscreen.tap(p.x, p.y);
      await idle(page);
      assert.ok(await page.$('#sfSheet.sfpicksh'), 'the picker moved, still open');
      assert.equal((await sheetState(page)).scrims, 1, 'one backdrop');
      await page.click('#sfPopCancel');
      await idle(page);
      assert.equal((await sheetState(page)).scrims, 0);
      // Escape still closes the menu, and a tap on the dim closes the Print sheet too (every sheet but a picker's)
      await openMenu(page);
      await page.keyboard.press('Escape');
      await idle(page);
      assert.equal(await page.$('#sfSheet'), null, 'Escape closes it');
      await page.click('.sftabbtn[data-t="share"]');
      await idle(page);
      await page.click('#sfPrint');
      await page.waitForSelector('#sfSheet.sfprsh');
      await idle(page);
      assert.equal((await sheetState(page)).pe, 'auto', 'Print’s dim takes the tap');
      const sc = await rect(page, '#sfRoot .sfscrim'),
        sh = await rect(page, '#sfSheet');
      // a point on the dim outside the sheet (above it in portrait, beside it on the iPad)
      const q =
        sh.x > 20 ? { x: sh.x / 2, y: sc.y + sc.h / 2 } : { x: sc.x + sc.w / 2, y: Math.max(4, sh.y / 2) };
      await page.touchscreen.tap(q.x, q.y);
      await idle(page);
      st = await sheetState(page);
      assert.deepEqual(
        [st.sheet, st.scrims, st.on],
        [false, 0, false],
        'Print closed by its dim: ' + JSON.stringify(st),
      );
      assert.deepEqual(errors, []);
    });
  }
  test('Home: "Updated to … · What’s new" opens Help › What’s new with every version since the one last seen (newest first, up to 8); Help by itself shows this version’s', async () => {
    const { ctx, page, errors } = await openApp({ storage: { ...ONB, 'ms-last-ver': 'v318.30' } });
    await ctx.addInitScript(() => {
      window.__MS_HELP_AUTO = true;
    });
    await page.reload();
    await idle(page);
    const ver = (await page.textContent('#appVer')).trim();
    const num = (v) => {
      const m = /^v?(\d+)(?:\.(\d+))?/.exec(v);
      return m ? +m[1] + (+m[2] || 0) / 1000 : 0;
    };
    // (WHATS_NEW is the page's; the version numbers compared here)
    const list = await page.evaluate(() => WHATS_NEW.map((x) => ({ v: x.v, t: x.t })));
    const since = list.filter((x) => num(x.v) > num('v318.30') && num(x.v) <= num(ver)).slice(0, 8);
    assert.ok(since.length >= 2, 'several versions since v318.30: ' + since.length);
    assert.ok(await page.isVisible('#whatsNew'));
    await page.click('#wnOpen');
    await page.waitForSelector('#helpOverlay.on');
    assert.ok(
      await page.evaluate(() => document.getElementById('helpNews').open),
      'Help opens at What’s new',
    );
    assert.equal((await page.textContent('#helpNews .hlpwnt')).trim(), 'What’s new since v318.30');
    let items = await page.$$eval('#helpWnList li', (l) => l.map((x) => x.textContent));
    assert.deepEqual(
      items,
      since.map((x) => x.v + ' ' + x.t),
      'each version since, newest first, headed with its version',
    );
    assert.equal(await page.$eval('#helpWnList li b', (b) => b.textContent), since[0].v);
    assert.equal(await page.evaluate(() => localStorage.getItem('ms-last-ver')), ver, 'this version seen');
    assert.equal(await page.$('#whatsNew'), null, 'the line is gone');
    // Help opened by itself: this version's, as before
    await page.click('#helpClose');
    await idle(page);
    await page.click('#homeHelp');
    await page.waitForSelector('#helpOverlay.on');
    assert.equal((await page.textContent('#helpNews .hlpwnt')).trim(), `What’s new in ${ver}`);
    items = await page.$$eval('#helpWnList li', (l) => l.map((x) => x.textContent));
    assert.deepEqual(
      items,
      list.filter((x) => x.v === ver).map((x) => x.t),
    );
    assert.equal(await page.$('#helpWnList li b'), null, 'no version heads on one version’s');
    await page.click('#helpClose');
    await idle(page);
    // from much older: at most eight, newest first; the guide's ⋯ › Help (openHelpSheet) shows this version's
    await page.evaluate(() => localStorage.setItem('ms-last-ver', 'v200'));
    await page.reload();
    await idle(page);
    await page.click('#wnOpen');
    await page.waitForSelector('#helpOverlay.on');
    items = await page.$$eval('#helpWnList li', (l) => l.map((x) => x.textContent));
    assert.equal(items.length, Math.min(8, list.filter((x) => num(x.v) <= num(ver)).length));
    assert.equal(
      items[0],
      list.find((x) => num(x.v) <= num(ver)).v + ' ' + list.find((x) => num(x.v) <= num(ver)).t,
    );
    assert.equal((await page.textContent('#helpNews .hlpwnt')).trim(), 'What’s new since v200');
    await page.click('#helpClose');
    await idle(page);
    // a fresh install: no line (the version is just recorded)
    const fresh = await openApp({ storage: null });
    await fresh.ctx.addInitScript(() => {
      window.__MS_HELP_AUTO = true;
    });
    await fresh.page.reload();
    await idle(fresh.page);
    assert.equal(await fresh.page.$('#whatsNew'), null, 'nothing on a first install');
    assert.equal(await fresh.page.evaluate(() => localStorage.getItem('ms-last-ver')), ver);
    await fresh.ctx.close();
    assert.deepEqual(errors, []);
  });
  test('320px phone: 44px tap areas on the checkbox rows, Colour along’s More, the Library’s search and Sort and Shading’s selects; the rows look the same', async () => {
    const { page, errors } = await openApp({ width: 320, height: 568, touch: true });
    await sampleGuide(page);
    await page.click('.sftabbtn[data-t="shading"]');
    await page.evaluate(() => __mstest.shadeTo('full'));
    await idle(page);
    let t = await tapBox(page, 'label.sfchk');
    assert.ok(
      t.h >= 44 && t.box < 40,
      'Show tone lines: a 44px area round a short row: ' + JSON.stringify(t),
    );
    for (const s of ['#sfHiStyle', '#sfShStyle']) {
      t = await tapBox(page, s);
      assert.ok(t.box >= 44, s + ' is 44px tall: ' + JSON.stringify(t));
    }
    await page.click('.sftabbtn[data-t="pattern"]');
    await idle(page);
    await page.click('#sfFam [data-v="random"]');
    await idle(page);
    t = await tapBox(page, 'label.sfchk:has(#sfNoAdj)');
    assert.ok(t.h >= 44 && t.box < 40, 'Keep touching sections clearly different: ' + JSON.stringify(t));
    await page.click('.sftabbtn[data-t="share"]');
    await idle(page);
    await page.click('#sfPrint');
    await page.waitForSelector('#sfSheet.sfprsh');
    await idle(page);
    t = await tapBox(page, '#sfSheet label.sfchk');
    assert.ok(t.h >= 44 && t.box < 40, 'Print’s Darker labels: ' + JSON.stringify(t));
    // a tap on the grown area, just under the last row's words (the rows above run into each other), ticks its box
    const last = await page.evaluate(() => {
      const l = [...document.querySelectorAll('#sfSheet label.sfchk')].pop();
      l.scrollIntoView({ block: 'center' });
      const r = l.getBoundingClientRect(),
        i = l.querySelector('input');
      return { id: i.id, was: i.checked, x: r.left + r.width / 2, y: r.bottom + 5 };
    });
    await page.touchscreen.tap(last.x, last.y);
    await idle(page);
    assert.equal(
      await page.evaluate((id) => document.getElementById(id).checked, last.id),
      !last.was,
      'ticked from 5px under the row: ' + JSON.stringify(last),
    );
    await page.keyboard.press('Escape');
    await idle(page);
    await page.click('.sftabbtn[data-t="colours"]');
    await idle(page);
    await page.click('#sfColor');
    await idle(page);
    await page.waitForSelector('#sfAlMore', { state: 'visible' });
    t = await tapBox(page, '#sfAlMore');
    assert.ok(t.h >= 44 && t.box < 40, 'Colour along’s More: ' + JSON.stringify(t));
    await page.evaluate(() => document.getElementById('mHome').click());
    await idle(page);
    await page.click('#homeLibCard');
    await page.waitForSelector('#savedOverlay.on');
    await idle(page);
    for (const s of ['#libSearch', '#libSort']) {
      t = await tapBox(page, s);
      assert.ok(t.box >= 44, s + ' is 44px tall: ' + JSON.stringify(t));
    }
    assert.deepEqual(errors, []);
  });
  test('Home at 320px: the three cards’ icons and names line up at the top, Library’s with the two whose lines wrap', async () => {
    const { page, errors } = await openAtScale(1, { width: 320, height: 568, touch: true, storage: ONB });
    const tops = await page.evaluate(() =>
      [...document.querySelectorAll('#homeView .homegrid .homecard')].map((c) => ({
        icon: Math.round(c.querySelector('.hcicon').getBoundingClientRect().top),
        label: Math.round(c.querySelector('.hclabel').getBoundingClientRect().top),
        subLines: Math.round(c.querySelector('.hcsub').getBoundingClientRect().height / 15),
      })),
    );
    assert.equal(tops.length, 3);
    assert.ok(
      tops.every((t) => Math.abs(t.icon - tops[0].icon) <= 1 && Math.abs(t.label - tops[0].label) <= 1),
      'aligned: ' + JSON.stringify(tops),
    );
    assert.ok(
      Math.max(...tops.map((t) => t.subLines)) > Math.min(...tops.map((t) => t.subLines)),
      'a line wraps at 320: ' + JSON.stringify(tops),
    );
    assert.deepEqual(errors, []);
  });
}

// ---- from v319-scrim-tap.test.mjs ----
// v319 (Fable Y4-1): a touch tap on a sheet's dim closes the sheet and nothing else. A touch's click is synthesized
// after its up and hit-tested afresh: with the dim gone at the up and the page scrolled back as the sheet closed, it
// landed on what had moved under the finger (the ⋯ menu opens with the page at the top, so the nav tabs: a tap on
// its dim switched to Markers). Now the up's click is stopped on the dim, which stays, unseen, until a click lands on
// it (a mouse) or 350 ms after the up (scrimDown, 72-frame.js). Each test fails on v318.37.
{
  const sheetState = (page) =>
    page.evaluate(() => ({
      mode: state.mode,
      sheet: !!document.getElementById('sfSheet'),
      scrims: document.querySelectorAll('#sfRoot .sfscrim').length,
      tip: !!document.querySelector('.sftip'),
      on: document.documentElement.classList.contains('sfsheeton'),
      layers: [...document.querySelectorAll('.overlay.on')].map((o) => o.id),
      // every click that reached the document since the tally was set (the dim's own don't count)
      clicks: (window.__clicks || []).filter((c) => !/sfscrim/.test(c)),
    }));
  // a tally of clicks, by target, from here on
  const tally = (page) =>
    page.evaluate(() => {
      window.__clicks = [];
      if (!window.__clicksOn) {
        window.__clicksOn = true;
        document.addEventListener(
          'click',
          (e) => {
            const t = e.target;
            window.__clicks.push(t.id || t.className || t.tagName);
          },
          true,
        );
      }
    });
  // a point on the dim outside the sheet: above it in portrait, beside it on an iPad sideways
  const dimPoint = (page) =>
    page.evaluate(() => {
      const sc = document.querySelector('#sfRoot .sfscrim').getBoundingClientRect(),
        sh = document.getElementById('sfSheet').getBoundingClientRect();
      return sh.left > 20
        ? { x: sh.left / 2, y: sc.top + sc.height / 2 }
        : { x: sc.left + sc.width / 2, y: Math.max(4, Math.min(sh.top, innerHeight) / 2) };
    });
  // a section's label point on screen in the picture's visible part (the picture is unpinned by then)
  const shownSec = (page) =>
    page.evaluate(() => {
      const t = __mstest,
        c = document.getElementById('sfCanvas'),
        r = c.getBoundingClientRect(),
        k = r.width / c.width,
        bot = Math.min(r.bottom, innerHeight),
        top = Math.max(r.top, 0);
      return t.assignData.order.find((l) => {
        const q = t.labelPos(l),
          x = r.left + q.x * k,
          y = r.top + q.y * k;
        return y > top + 12 && y < bot - 12 && x > r.left + 12 && x < r.right - 12 && q.r * k > 5;
      });
    });
  const closed = (st, what) =>
    assert.deepEqual(
      [st.mode, st.sheet, st.scrims, st.tip, st.on, st.layers, st.clicks],
      ['sections', false, 0, false, false, [], []],
      what + ': ' + JSON.stringify(st),
    );
  // the sheets that have a dim that takes taps (a picker's lets them through: e2e/v31837-shell), each opened its own way
  const SHEETS = {
    menu: async (page) => {
      await page.evaluate(() => scrollTo(0, 0));
      await idle(page);
      await openMenu(page);
    },
    Print: async (page) => {
      await page.click('.sftabbtn[data-t="share"]');
      await idle(page);
      await page.click('#sfPrint');
      await page.waitForSelector('#sfSheet.sfprsh');
    },
    'markers on this page': async (page) => {
      await page.click('.sftabbtn[data-t="colours"]');
      await idle(page);
      await page.click('#sfMkList');
      await page.waitForSelector('#sfSheet');
    },
    Balance: async (page) => {
      await page.click('.sftabbtn[data-t="pattern"]');
      await idle(page);
      await page.click('#sfFam [data-v="random"]');
      await idle(page);
      await page.click('#sfBalM');
      await page.waitForSelector('#sfSheet.sfbalsh');
    },
  };
  for (const [name, vp] of [
    ['phone', { width: 390, height: 844 }],
    ['iPad', { width: 820, height: 1180 }],
    ['iPad sideways', { width: 1180, height: 820 }],
  ]) {
    test(`Guide (${name}, touch): a tap on the dim of the ⋯ menu, Print, the markers on this page and Balance closes the sheet and clicks nothing else`, async () => {
      const { page, errors } = await openApp({ ...vp, touch: true });
      await sampleGuide(page);
      for (const k in SHEETS) {
        await SHEETS[k](page);
        await idle(page);
        assert.ok(await page.$('#sfRoot .sfscrim.sfscrimtap'), k + ': a dim that takes taps');
        const p = await dimPoint(page);
        const under = await page.evaluate((p) => {
          const e = document.elementFromPoint(p.x, p.y);
          return e ? e.className : '';
        }, p);
        assert.match(under, /sfscrim/, k + ': the dim is at the point tapped');
        await tally(page);
        await page.touchscreen.tap(p.x, p.y);
        await idle(page);
        await page.waitForTimeout(400);
        closed(await sheetState(page), k + ' tapped shut');
      }
      assert.deepEqual(errors, []);
    });
  }
  test('Guide (phone, touch): a tap on the menu’s dim where the Markers tab will be after it closes stays in the guide; a second tap on the dim’s area within 350 ms is swallowed, one after it opens a section’s tip', async () => {
    const { page, errors } = await openApp({ width: 390, height: 844, touch: true });
    await sampleGuide(page);
    await page.evaluate(() => scrollTo(0, 0));
    await idle(page);
    // where the Markers tab is with the page at the top (where it goes back to when the menu closes)
    const p = await page.evaluate(() => {
      const r = document.getElementById('mCollection').getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    await openMenu(page);
    await idle(page);
    const under = await page.evaluate((p) => {
      const e = document.elementFromPoint(p.x, p.y);
      return { el: e && e.className, y: scrollY };
    }, p);
    assert.ok(
      /sfscrim/.test(under.el) && under.y > 0,
      'the dim covers that point while the menu is open: ' + JSON.stringify(under),
    );
    await tally(page);
    await page.touchscreen.tap(p.x, p.y);
    await idle(page);
    await page.waitForTimeout(400);
    closed(await sheetState(page), 'the menu tapped shut over the Markers tab');
    // a second tap right after the first, on the dim's area over the picture: swallowed while the dim lingers
    await openMenu(page);
    await idle(page);
    const l = await shownSec(page);
    assert.ok(l > 0, 'a section in view');
    const q0 = await dimPoint(page);
    await page.touchscreen.tap(q0.x, q0.y);
    await page.waitForTimeout(120);
    const q1 = await sectionPoint(page, l);
    await page.touchscreen.tap(q1.x, q1.y);
    await idle(page);
    await page.waitForTimeout(400);
    let st = await sheetState(page);
    assert.deepEqual(
      [st.sheet, st.scrims, st.tip, st.mode],
      [false, 0, false, 'sections'],
      'swallowed: ' + JSON.stringify(st),
    );
    // and one after the 350 ms reaches the picture: the section's tip opens
    const q2 = await sectionPoint(page, l);
    await page.touchscreen.tap(q2.x, q2.y);
    await idle(page);
    assert.ok(await page.$('.sftip [data-a="change"]'), 'a tap after the dim has gone opens the tip');
    assert.deepEqual(errors, []);
  });
  test('Guide (phone): a mouse click on the menu’s dim, and Escape, close it with the dim gone at once', async () => {
    const { page, errors } = await openApp({ width: 390, height: 844 });
    await sampleGuide(page);
    await page.evaluate(() => scrollTo(0, 0));
    await idle(page);
    await openMenu(page);
    await idle(page);
    const p = await dimPoint(page);
    await tally(page);
    await page.mouse.click(p.x, p.y);
    let st = await sheetState(page);
    assert.deepEqual(
      [st.sheet, st.scrims, st.on],
      [false, 0, false],
      'closed, the dim gone with the click: ' + JSON.stringify(st),
    );
    await idle(page);
    closed(await sheetState(page), 'mouse');
    await openMenu(page);
    await idle(page);
    await page.keyboard.press('Escape');
    st = await sheetState(page);
    assert.deepEqual([st.sheet, st.scrims, st.on], [false, 0, false], 'Escape: ' + JSON.stringify(st));
    assert.equal(await page.evaluate(() => document.activeElement.id), 'sfMore', 'focus back on ⋯');
    assert.deepEqual(errors, []);
  });
}
