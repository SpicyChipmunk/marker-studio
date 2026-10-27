// The shell: tabs, sheets, buttons, Escape and Back, keyboard and screen readers, toasts, tap areas, installing.
// (v320) Tests organised by feature: each block below came from the file named above it, its tests unchanged.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  WK,
  answerAsks,
  chartFromMarkers,
  haveSet,
  idle,
  libItem,
  menuItem,
  notOnWebKit,
  openApp,
  openAtScale,
  openMenu,
  pause,
  sampleGuide,
  saveGuide,
  scrollTop,
  sectionPoint,
  setup,
  teardown,
  toolStatus,
  welcome,
} from './helpers.mjs';

before(setup);
after(teardown);

// ---- from back-tabs.test.mjs ----
// v318 review: Back across the main tabs. Guide, Markers and Palette sit one Back step above Home (the way a phone's
// apps with tabs go back): Back from any of them is Home, however many tabs were visited; from Home it leaves the app as
// before. What is open on top closes first, one each; Random goes back to Markers first; Escape never changes tabs.
{
  const ONB = { 'ms-onboarded': '1', 'ms-setup-tip': '1' };
  const mode = (page) => page.evaluate(() => state.mode);
  const layer = (page) => page.evaluate(() => (history.state && history.state.msLayer) || 0);
  const back = async (page) => {
    await page.goBack({ waitUntil: 'commit' }).catch(() => {});
    await page.waitForTimeout(150);
    await idle(page);
  };
  // (the entries are made a frame after a change)
  const settled = (page) =>
    page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  test(
    'Back from Markers, Palette or Guide is Home, one step whatever was visited; then nothing left',
    notOnWebKit(WK.back),
    async () => {
      const { page, errors } = await openApp({ storage: ONB });
      const url = page.url();
      assert.equal(await mode(page), 'home');
      for (const go of [['#mCollection'], ['#mPalette'], ['#mCollection', '#mPalette', '#mSections']]) {
        for (const s of go) {
          await page.click(s);
          await idle(page);
        }
        await settled(page);
        assert.equal(await layer(page), 1, go.join(' › ') + ': one entry');
        await back(page);
        assert.equal(await mode(page), 'home', go.join(' › ') + ' then Back: Home');
        assert.equal(page.url(), url, 'still in the app');
        assert.equal(await layer(page), 0, 'nothing left for Back');
      }
      assert.deepEqual(errors, []);
    },
  );
  test(
    'what is open on a tab closes first: a dialog over Palette, Colour along over the Plan; Random goes to Markers',
    notOnWebKit(WK.back),
    async () => {
      const { page, errors } = await openApp({ width: 820, height: 1180, storage: ONB });
      // the Library over Palette
      await page.click('#mPalette');
      await idle(page);
      await page.evaluate(() => openLibrary());
      await idle(page);
      await settled(page);
      assert.equal(await layer(page), 2);
      await back(page);
      assert.equal(await page.isVisible('#savedOverlay'), false, 'the Library first');
      assert.equal(await mode(page), 'palette');
      await back(page);
      assert.equal(await mode(page), 'home', 'then Home');
      // Colour along, then the Plan, then Home
      await page.click('#mSections');
      await idle(page);
      await page.evaluate(() => SF.loadSample());
      await page.waitForFunction(() => window.__mstest && __mstest.assignData && __mstest.sfmode === 'guide');
      await idle(page);
      await page.click('#sfColor');
      await idle(page);
      await settled(page);
      await back(page);
      assert.equal(await page.evaluate(() => __mstest.sfmode), 'guide', 'Colour along first, to the Plan');
      assert.equal(await mode(page), 'sections');
      await back(page);
      assert.equal(await mode(page), 'home');
      // Random, opened from Markers
      await page.click('#mCollection');
      await idle(page);
      await page.click('#mkDrawBtn');
      await idle(page);
      assert.equal(await mode(page), 'random');
      await back(page);
      assert.equal(await mode(page), 'collection', 'Random goes back to Markers');
      await back(page);
      assert.equal(await mode(page), 'home');
      assert.deepEqual(errors, []);
    },
  );
  test('Escape never changes tabs', async () => {
    const { page, errors } = await openApp({ storage: ONB });
    await page.click('#mCollection');
    await idle(page);
    await page.keyboard.press('Escape');
    await idle(page);
    assert.equal(await mode(page), 'collection');
    assert.deepEqual(errors, []);
  });
  test(
    'reloaded on Markers (which the app opens on again): Back is Home, and then nothing is left, with no step that does nothing',
    notOnWebKit(WK.back),
    async () => {
      const { page, errors } = await openApp({ storage: ONB });
      const url = page.url();
      await page.click('#mCollection');
      await idle(page);
      await settled(page);
      await page.reload();
      await idle(page);
      await settled(page);
      assert.equal(await mode(page), 'collection');
      assert.equal(await layer(page), 1, 'the entry it was on is Markers’, not one more on top');
      await back(page);
      assert.equal(await mode(page), 'home');
      assert.equal(page.url(), url);
      assert.equal(await layer(page), 0, 'nothing left for Back');
      assert.deepEqual(errors, []);
    },
  );
}

// ---- from bar-and-tool-row.test.mjs ----
// The bottom bar and the tool row under the picture: the bar on the bottom edge (short phones, the end of the page,
// the largest text size), the tool row's contents and wording, and its place under the picture and above the bar.
{
  // ---- From Release 3 (docs/GUIDE-LAYOUT.md) ----
  const rect = (page, sel) =>
    page.evaluate((s) => {
      const e = document.querySelector(s);
      return e ? e.getBoundingClientRect().toJSON() : null;
    }, sel);
  // scroll the page and let the shrink (a requestAnimationFrame after the scroll) catch up
  const scrollAt = (page, y) =>
    page.evaluate(
      (y) =>
        new Promise((r) => {
          window.scrollTo(0, y);
          requestAnimationFrame(() => requestAnimationFrame(() => r(window.scrollY)));
        }),
      y,
    );
  // big sections whose label points are inside the picture, biggest first
  const bigSections = (page, n = 6) =>
    page.evaluate((n) => {
      const t = __mstest;
      return t.assignData.order
        .slice()
        .sort((a, b) => t.comps[b].area - t.comps[a].area)
        .slice(0, n);
    }, n);
  // ---- From the UX polish pass ----
  const box = (page, sel) => page.locator(sel).boundingBox();
  const overlaps = (a, b) =>
    a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
  test('tool row: Undo when there is something to undo, the stage status, ◐ in Photo only, codes, −/+, Fit only zoomed in, full screen', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    // (v307: Undo's room is kept while there's nothing to undo, hidden: not shown)
    const vis = (ids) =>
      page.evaluate(
        (ids) =>
          ids.filter((id) => {
            const e = document.getElementById(id);
            return e && e.offsetParent && getComputedStyle(e).visibility !== 'hidden';
          }),
        ids,
      );
    const ALL = ['sfPlanUndo', 'sfStat', 'sfPhPeek', 'sfCodes', 'sfZout', 'sfZin', 'sfZrst', 'sfFull'];
    const N = await page.evaluate(() => __mstest.assignData.N),
      mk = await page.evaluate(
        () => new Set(Object.values(__mstest.assignData.assign).map((m) => m.mkey)).size,
      );
    assert.equal(await toolStatus(page), `${N} sections · ${mk} markers`);
    assert.deepEqual(await vis(ALL), ['sfStat', 'sfCodes', 'sfZout', 'sfZin', 'sfFull'], 'Plan at the start');
    const row = await rect(page, '#sfZoomCtl'),
      box = await rect(page, '#sfPicBox');
    assert.equal(Math.round(row.height), 40, 'a 40px row');
    assert.ok(Math.abs(row.top - box.bottom) <= 1, 'directly under the picture');
    assert.ok(
      await page.evaluate(() =>
        [...document.querySelectorAll('#sfZoomCtl .sfz')].every(
          (b) => b.offsetParent === null || Math.round(b.getBoundingClientRect().height) === 34,
        ),
      ),
      'buttons 34px high',
    );
    // Fit only while zoomed in
    await page.click('#sfZin');
    await idle(page);
    assert.ok((await vis(['sfZrst'])).length, 'Fit while zoomed in');
    await page.click('#sfZrst');
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.zoom), 1);
    assert.equal((await vis(['sfZrst'])).length, 0, 'no Fit at the whole picture');
    // codes on/off (aria-pressed)
    assert.equal(await page.getAttribute('#sfCodes', 'aria-pressed'), 'true');
    await page.click('#sfCodes');
    assert.equal(await page.getAttribute('#sfCodes', 'aria-pressed'), 'false');
    assert.equal(await page.evaluate(() => __mstest.hideLabels), true);
    await page.click('#sfCodes');
    assert.equal(await page.evaluate(() => __mstest.hideLabels), false);
    // Undo after a change; it takes it back
    await page.click('.sftabbtn[data-t="pattern"]');
    await page.click('#sfVary');
    await idle(page);
    assert.ok((await vis(['sfPlanUndo'])).length, 'Undo after a change');
    await page.click('#sfPlanUndo');
    await idle(page);
    assert.equal((await vis(['sfPlanUndo'])).length, 0);
    // Colour along: "n of N done" and the progress line; no Undo
    await page.click('#sfColor');
    await idle(page);
    await scrollAt(page, 0);
    assert.equal(await toolStatus(page), `0 of ${N} coloured`);
    const [l] = await bigSections(page, 1),
      p = await sectionPoint(page, l);
    await page.mouse.click(p.x, p.y);
    await idle(page);
    assert.equal(await toolStatus(page), `1 of ${N} coloured`);
    const prog = await page.evaluate(() => {
      const i = document.getElementById('sfToolProg');
      return [getComputedStyle(i.parentElement).display, i.style.width];
    });
    assert.deepEqual(prog, ['block', Math.round(100 / N) + '%'], 'a thin progress line along the row');
    assert.deepEqual(await vis(ALL), ['sfStat', 'sfCodes', 'sfZout', 'sfZin', 'sfFull'], 'Colour along');
    // Edit sections: "N sections", no codes; the section-edit undo is here too
    await answerAsks(page);
    await page.click('#sfDoneBtn');
    await page.click('#sfBack2');
    await idle(page);
    await scrollAt(page, 0);
    assert.match(await toolStatus(page), /^\d+ sections$/);
    assert.deepEqual(await vis(ALL), ['sfStat', 'sfZout', 'sfZin', 'sfFull'], 'Edit sections');
    const n0 = await page.evaluate(() => __mstest.countedList().length),
      q = await sectionPoint(page, l);
    await page.mouse.click(q.x, q.y);
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.countedList().length), n0 - 1, 'excluded');
    assert.equal(await toolStatus(page), `${n0 - 1} sections`);
    assert.equal(await page.getAttribute('#sfPlanUndo', 'aria-label'), 'Undo the last section edit');
    await page.click('#sfPlanUndo');
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.countedList().length), n0, 'undone from the tool row');
    assert.equal((await vis(['sfPlanUndo'])).length, 0);
    assert.deepEqual(errors, []);
  });
  test('the bar keeps two 44px buttons on one row at the largest text size, shortening labels only when it must (and ✨ drops its word)', async () => {
    const row = (page, a, b) =>
      page.evaluate(
        ([a, b]) => {
          const x = document.getElementById(a).getBoundingClientRect(),
            y = document.getElementById(b).getBoundingClientRect(),
            bar = document.querySelector('.sfbar');
          return {
            same: Math.abs(x.top - y.top) < 1,
            h: [Math.round(x.height), Math.round(y.height)],
            fits: bar.scrollWidth <= bar.clientWidth + 1,
            inside: x.left >= 0 && y.right <= innerWidth,
          };
        },
        [a, b],
      );
    const all = [];
    for (const [w, back, done, foc] of [
      [360, 'Edit sections', 'Plan', 'Focus mode'],
      [320, 'Sections', 'Plan', 'Focus mode'],
    ]) {
      const { page, errors, ctx } = await openAtScale(2, { width: w, height: 740 });
      await sampleGuide(page);
      await idle(page);
      assert.deepEqual(
        await row(page, 'sfBack2', 'sfColor'),
        { same: true, h: [44, 44], fits: true, inside: true },
        `${w}px Plan`,
      );
      assert.equal((await page.textContent('#sfBack2')).trim(), back);
      assert.equal(
        await page.locator('#sfBack2 svg.icback').count(),
        1,
        'the chevron kept as the words shorten (v321)',
      );
      assert.equal(await page.getAttribute('#sfBack2', 'aria-label'), 'Back to Edit sections');
      // the header: ✨ Surprise drops its word before the name gets squeezed under about 140px (and keeps its label)
      const hdr = () =>
        page.evaluate(() => ({
          ic: document.getElementById('sfSurprise').classList.contains('sfic'),
          name: document.querySelector('.sfgname').getBoundingClientRect().width,
          label: document.getElementById('sfSurprise').getAttribute('aria-label'),
        }));
      let hd = await hdr();
      assert.deepEqual(
        [hd.ic, hd.name >= 140],
        [true, true],
        `${w}px: ✨ alone at the largest text size, the name ${hd.name}px`,
      );
      if (w === 320) {
        await page.setViewportSize({ width: 300, height: 740 });
        await idle(page);
        hd = await hdr();
        assert.equal(hd.ic, true, '300px: ✨ alone');
        assert.ok(hd.name >= 90, `300px: the name keeps ${hd.name}px`);
        assert.match(hd.label, /^Surprise/, 'still "Surprise" for screen readers');
        await page.setViewportSize({ width: 320, height: 740 });
        await idle(page);
      }
      await page.click('#sfColor');
      await idle(page);
      assert.deepEqual(
        await row(page, 'sfDoneBtn', 'sfFocus'),
        { same: true, h: [44, 44], fits: true, inside: true },
        `${w}px Colour along`,
      );
      assert.deepEqual(
        [(await page.textContent('#sfDoneBtn')).trim(), (await page.textContent('#sfFocus')).trim()],
        [done, foc],
      );
      all.push(...errors);
      await ctx.close();
    }
    // at the default size: the full labels (✨ Surprise with its word), 8px padding
    const d = await openApp({ width: 390 });
    await sampleGuide(d.page);
    await idle(d.page);
    assert.equal((await d.page.textContent('#sfBack2')).trim(), 'Edit sections');
    assert.equal(
      await d.page.evaluate(() => document.getElementById('sfSurprise').classList.contains('sfic')),
      false,
    );
    const pad = await d.page.evaluate(() => {
      const cs = getComputedStyle(document.querySelector('.sfbar'));
      return [cs.paddingTop, cs.paddingBottom];
    });
    assert.deepEqual(pad, ['8px', '8px']);
    assert.deepEqual([...all, ...d.errors], []);
  });
  test('the bottom bar sits on the bottom edge at the top of the page on short phones, in every stage', async () => {
    for (const [w, h] of [
      [375, 667],
      [360, 740],
    ]) {
      const { page, errors } = await openApp({ width: w, height: h });
      await sampleGuide(page);
      await idle(page);
      const gap = () =>
        page.evaluate(() => {
          scrollTo(0, 0);
          const b = document.querySelector('#sfRoot .sfbar').getBoundingClientRect();
          return Math.round(innerHeight - b.bottom);
        });
      assert.equal(await gap(), 0, `plan ${w}×${h}`);
      await page.click('#sfColor');
      await idle(page);
      assert.equal(await gap(), 0, `colour along ${w}×${h}`);
      await page.click('#sfDoneBtn');
      await idle(page);
      await page.evaluate(() => scrollTo(0, 0));
      await page.click('#sfBack2');
      await idle(page);
      assert.equal(await gap(), 0, `edit sections ${w}×${h}`);
      assert.equal(await page.locator('#sfRoot .sfbar').count(), 1, 'one bar');
      assert.deepEqual(errors, []);
    }
  });
  test('sample opens built; the tool row is under the picture; full screen opens and closes', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    assert.equal(
      await page.evaluate(() => document.getElementById('sfBuild')),
      null,
      'no sections editor for the sample',
    );
    // let the layout settle (fonts, the pinned block's size) before measuring
    await page
      .waitForFunction(
        () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--pinH')) > 0,
        null,
        { timeout: 5000 },
      )
      .catch(() => {});
    await idle(page);
    const cv = await box(page, '#sfCanvas'),
      zr = await box(page, '#sfZoomCtl');
    assert.ok(!overlaps(cv, zr) && zr.y >= cv.y + cv.height - 1, 'the tool row does not cover the picture');
    // the tabs stick below the pinned block: the picture at its floor size (45% of 844) and the tool row
    const pin = await page.evaluate(() =>
      parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--pinH')),
    );
    assert.ok(
      Math.abs(pin - (380 + zr.height)) <= 2,
      `--pinH ${pin} covers the floor-size picture + tool row`,
    );

    await page.click('#sfFull');
    await page
      .waitForFunction(
        (h) => document.getElementById('sfCanvas').getBoundingClientRect().height > h * 1.5,
        cv.height,
        { timeout: 5000 },
      )
      .catch(() => {});
    const big = await box(page, '#sfCanvas');
    assert.ok(big.height > cv.height * 1.5, 'picture is much bigger full screen');
    assert.ok(await page.isVisible('#sfFullX'));
    await page.keyboard.press('Escape');
    await idle(page);
    assert.ok(
      !(await page.evaluate(() => document.getElementById('sfRoot').classList.contains('sffull'))),
      'Escape closes',
    );
    await page.click('#sfFull');
    await idle(page);
    await page.click('#sfFullX');
    await page
      .waitForFunction(
        (h) => Math.abs(document.getElementById('sfCanvas').getBoundingClientRect().height - h) <= 2,
        cv.height,
        { timeout: 5000 },
      )
      .catch(() => {});
    const back = await box(page, '#sfCanvas');
    assert.ok(Math.abs(back.height - cv.height) <= 2, 'back to the pinned size');
    assert.deepEqual(errors, []);
  });
  // ---- From the fourth review (v263 guide screen) ----
  test('short screens and larger text: at the top of the page the tool row ends above the bar (never under the floor)', async () => {
    for (const [w, h, sc] of [
      [375, 667, 1.6],
      [375, 667, 1],
      [360, 740, 1.3],
      [390, 844, 1],
    ]) {
      const { page, errors, ctx } = await openAtScale(sc, { width: w, height: h });
      await sampleGuide(page);
      await idle(page);
      await scrollTop(page);
      const tools = await rect(page, '#sfZoomCtl'),
        bar = await rect(page, '#sfWork>.sfbar'),
        g = await page.evaluate(() => __mstest.geo);
      assert.ok(
        tools.bottom <= bar.top + 0.5,
        `${w}×${h} @${sc}: tools end at ${tools.bottom}, the bar starts at ${bar.top}`,
      );
      assert.ok(g.full >= g.comp, 'never below the floor');
      // (v289: the tabs on the first screen too, the picture under 55% where they need the room)
      if (g.full > g.comp)
        assert.ok(
          (await rect(page, '.sftabs')).bottom <= bar.top + 0.5,
          `${w}×${h} @${sc}: the tabs above the bar`,
        );
      if (w === 390 && sc === 1)
        assert.ok(g.full > 380 && g.full <= 464, 'between the floor and 55%: ' + g.full);
      // the bar's buttons are all on the screen and can be tapped
      for (const id of ['sfBack2', 'sfColor']) {
        const r = await rect(page, '#' + id);
        assert.equal(
          await page.evaluate(
            ([x, y]) => document.elementFromPoint(x, y).closest('button')?.id,
            [r.x + r.width / 2, r.y + r.height / 2],
          ),
          id,
        );
      }
      assert.deepEqual(errors, []);
      await ctx.close();
    }
  });
  test(
    'tool row: singular words, parts dropped whole when tight, one part side by side',
    notOnWebKit(WK.font),
    async () => {
      const { page, errors } = await openApp();
      await sampleGuide(page);
      await idle(page);
      // every section one marker: "1 marker"
      await page.click('.sftabbtn[data-t="pattern"]');
      await page.click('#sfFam [data-v="manual"]');
      await idle(page);
      await page.click('#sfFillAll');
      await page.waitForSelector('#sfSheet.sfpicksh');
      await page.click('#sfPopSw .sfswg:not(.sfswrec) .sfsw');
      await page.click('#sfPopConfirm');
      await idle(page);
      assert.match(await toolStatus(page), /^\d+ sections · 1 marker$/);
      // a narrow row with Undo: "· 1 marker" goes first, whole; nothing is cut mid-word
      await page.setViewportSize({ width: 300, height: 844 });
      await idle(page);
      const s = await page.evaluate(() => {
        const st = document.getElementById('sfStat'),
          p2 = st.querySelector('.sfsp2');
        return {
          cut: st.scrollWidth > st.clientWidth + 1,
          p2: !!p2 && p2.offsetParent !== null,
          undo: document.getElementById('sfPlanUndo').offsetParent !== null,
        };
      });
      assert.deepEqual(s, { cut: false, p2: false, undo: true });
      assert.equal(
        await page.evaluate(() => getComputedStyle(document.getElementById('sfStat')).textOverflow),
        'clip',
      );
      await page.setViewportSize({ width: 390, height: 844 });
      await idle(page);
      assert.deepEqual(errors, []);
      // side by side: one part, never two to four lines, never a leading "·"
      const sb = await openApp({ width: 844, height: 390 });
      await sampleGuide(sb.page);
      await idle(sb.page);
      for (const stage of ['plan', 'along']) {
        if (stage === 'along') {
          await sb.page.click('#sfColor');
          await idle(sb.page);
        }
        const t = await sb.page.evaluate(() => {
          const st = document.getElementById('sfStat');
          return {
            text: st.innerText,
            h: st.getBoundingClientRect().height,
            w: st.scrollWidth <= st.parentElement.clientWidth,
          };
        });
        assert.ok(!t.text.includes('·') && t.h <= 40 && t.w, `${stage}: ${JSON.stringify(t)}`);
      }
      assert.deepEqual(sb.errors, []);
    },
  );
  test('the bar sits on the bottom edge at the end of the page; Crop keeps the page where it was, with the tool row', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await scrollAt(page, 99999);
    assert.ok(
      Math.abs(
        await page.evaluate(
          () => innerHeight - document.querySelector('#sfWork>.sfbar').getBoundingClientRect().bottom,
        ),
      ) <= 0.5,
      'flush at the end',
    );
    await answerAsks(page);
    await page.click('#sfBack2');
    await idle(page);
    await page.click('#sfAdjToggle');
    await idle(page);
    // (v288: Adjust photo is under the tools and sliders, below the screen here: pressed from where the page is, as a
    // keyboard does, so the click itself doesn't scroll)
    const y0 = await scrollAt(page, 200);
    await page.$eval('#sfCrop', (b) => b.click());
    await idle(page);
    assert.ok(Math.abs((await page.evaluate(() => scrollY)) - y0) <= 2, 'Crop keeps the scroll');
    assert.equal(await page.isVisible('#sfZin'), true, 'zoom buttons stay');
    await page.click('#sfCropCancel');
    await idle(page);
    assert.ok(
      Math.abs((await page.evaluate(() => scrollY)) - y0) <= 2,
      'Cancel comes back to the same place',
    );
    assert.deepEqual(errors, []);
  });
}

// ---- from buttons.test.mjs ----
// One button height across the app (src/css/02-picker.css): an action button is 44px tall, a choice (one of several)
// 40px with a 44px tap area, the tab bars keep their own heights, and a small icon or pill button keeps its size with a
// 44px tap area. At a large text size buttons grow with their text (min-height) and never cut their label. Also: tap
// areas of small controls, and disabled buttons that look disabled.
{
  const KEY = 'ohuhu-hb320-picker-v3';
  const IPHONE =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
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
  // markers, a shopping list, a backup that's due, What's new and the Add to Home Screen card
  const storage = () => ({
    'ms-onboarded': '1',
    'ms-setup-tip': '1',
    'ms-last-ver': 'v200',
    'ms-first-use': String(Date.now() - 15 * 864e5),
    [KEY]: JSON.stringify({
      mode: 'home',
      ownedSeedV: 2,
      copicAdd1: 1,
      libAdj1: 1,
      setFix1: 1,
      owned: OWN,
      saved: [],
      wish: [{ k: 'Ohuhu|R16', why: 'blend for R14', ts: 1 }],
    }),
  });
  const init = () => {
    Object.defineProperty(Navigator.prototype, 'standalone', { configurable: true, get: () => false });
    window.__MS_HELP_AUTO = true;
  };
  // kinds of button that aren't actions or choices: tab bars, cards and list rows (bigger), small icons and pills
  const TAB = '.modes button,.sftabbtn';
  // (v288: a palette band's own button fills the band; the Print sheet's choices with a drawing over the word)
  // (v306: Home's latest piece's picture; v320: a phone's first Home's before-and-after strip)
  // (v309: the welcome's ways in and its two-line choices, the colour chart's swatches; v310: Mood's pictures)
  const BIG =
    '.homecard,#homeTaskCard,.sopen,.mdrop,.hlphiw,.sfRecCard,.sfah,.sfinfo,.focmk,.bhit,.sfprsh .segs button:has(.sfprpv),.hhpic,.wcc,.wcseg button,.wccount button,.chsw,.sfmp,.homeba,#sfPrThumb';
  const CHOICE = '.segs button,.chip,.msrc button,.wcbrands button,#sfRoot .sfedit';
  // a link inside a sentence; the guide's tool-row icons and Save pill, whose tap areas stop at the picture's edge,
  // and ✎, whose lower edge the Save pill under it shares
  const INLINE = '.instnote .sflink,.sfmeta .sflink,#sfRoot .sftools .sfz,#sfSave,#sfRename';
  // every visible button in the top dialog (or the page): its height, whether a tap 21px above and below its centre
  // still reaches it (44px, give or take a pixel), and whether its label sits inside it (and, on one line, centred)
  function buttons(page) {
    return page.evaluate(
      ([TAB, BIG, CHOICE, INLINE]) => {
        const ovs = [...document.querySelectorAll('.overlay.on')],
          scope = ovs[ovs.length - 1] || document,
          out = [];
        for (const b of scope.querySelectorAll('button')) {
          if (
            !b.checkVisibility({ visibilityProperty: true }) ||
            b.closest('.sfSheet,#sfSheet')?.style.display === 'none'
          )
            continue;
          // from the top of the page (the guide's pinned picture covers what scrolls under it), then into view
          if (!ovs.length) scrollTo({ top: 0, behavior: 'instant' });
          let r = b.getBoundingClientRect();
          if (r.width < 2 || r.height < 2) continue;
          if (r.top < 30 || r.bottom > innerHeight - 30) {
            b.scrollIntoView({ block: 'center', behavior: 'instant' });
            r = b.getBoundingClientRect();
          }
          const cx = r.left + r.width / 2,
            cy = r.top + r.height / 2;
          const hits = (y) => {
            const e = document.elementFromPoint(cx, y);
            return !!e && (e === b || b.contains(e));
          };
          if (!hits(cy)) continue; // covered (the page under Focus mode)
          const tap = hits(cy - 21) && hits(cy + 21),
            who = tap
              ? ''
              : [cy - 21, cy + 21]
                  .map((y) => {
                    const e = document.elementFromPoint(cx, y);
                    return e ? e.id || e.className || e.tagName : '-';
                  })
                  .join(' / '); // (21, not 22: hit testing snaps to whole pixels)
          const rg = document.createRange();
          rg.selectNodeContents(b);
          const t = rg.getBoundingClientRect(),
            lines = rg.getClientRects().length;
          const inside = !t.height || (t.top >= r.top - 1 && t.bottom <= r.bottom + 1);
          const centred = !t.height || Math.abs((t.top + t.bottom) / 2 - cy) <= 2.5;
          const kind = b.matches(TAB)
            ? 'tab'
            : b.matches(BIG)
              ? 'big'
              : b.matches(INLINE)
                ? 'inline'
                : b.matches(CHOICE)
                  ? 'choice'
                  : 'other';
          out.push({
            b: b.id ? '#' + b.id : (b.className || 'button') + ' "' + b.textContent.trim().slice(0, 20) + '"',
            h: Math.round(r.height * 10) / 10,
            kind,
            tap,
            who,
            inside,
            centred,
            oneLine: lines <= 1,
          });
        }
        return out;
      },
      [TAB, BIG, CHOICE, INLINE],
    );
  }
  // at the default text size: actions are exactly 44px, choices 40px, anything smaller has a 44px tap area; labels fit
  async function check(page, screen, big) {
    await idle(page);
    const bs = await buttons(page),
      bad = [];
    assert.ok(bs.length > 0, `${screen}: buttons found`);
    for (const x of bs) {
      const why = [];
      if (!x.inside) why.push('label cut off');
      if (!big) {
        if (x.kind === 'choice' && x.h !== 40 && x.h !== 44) why.push('choice not 40px');
        if (x.kind === 'other' && x.h > 44) why.push('action taller than 44px');
        if (x.kind === 'other' && x.h === 44 && x.oneLine && !x.centred) why.push('label off centre');
      } else if (x.kind === 'choice' && x.h < 40) why.push('choice under 40px');
      if ((x.kind === 'choice' || x.kind === 'other') && x.h < 44 && !x.tap)
        why.push('tap area under 44px (' + x.who + ')');
      if (why.length) bad.push(`${x.b} ${x.h}px: ${why.join(', ')}`);
    }
    assert.deepEqual(bad, [], screen);
    return bs;
  }
  const close = (page) =>
    page.evaluate(() => {
      for (const o of document.querySelectorAll('.overlay.on')) o.classList.remove('on');
      scrollTo(0, 0);
    });
  const h = (bs, id) => bs.find((x) => x.b === id)?.h;
  async function walk(page, big) {
    const home = await check(page, 'Home (the backup card, first when due)', big);
    if (!big) {
      assert.equal(h(home, '#homeNew'), 44, 'New colouring guide: 44px, not 52');
    }
    // one Home card at a time (v265): with a backup due its card comes first (v267); Later brings up the install card
    if (!big) assert.equal(h(home, '#bkGo'), 44, 'the backup card’s button: 44px, not 38');
    if (await page.isVisible('[data-bk="later"]')) {
      await page.click('[data-bk="later"]');
      await idle(page);
    }
    await check(page, 'Home (install card)', big);
    await page.click('#mCollection');
    await idle(page);
    const mk = await check(page, 'Markers', big);
    if (!big) {
      for (const id of ['#mkDrawBtn', '#mkMatchBtn', '#toPalette', '#mkAddBtn', '#mkMore', '#swatchBtn'])
        assert.equal(h(mk, id), 44, id);
      assert.deepEqual(
        [...new Set(mk.filter((x) => /ownView|segs/.test(x.b) || x.kind === 'choice').map((x) => x.h))],
        [40],
        'Owned / Unowned / All / To buy: 40px',
      );
    }
    await page.click('#ownView [data-v="wish"]');
    await check(page, 'Markers: To buy', big);
    await page.click('#ownView [data-v="all"]');
    await check(page, 'Markers: All', big);
    await page.click('#ownView [data-v="owned"]');
    await idle(page);
    // (v311) Add markers' sheet, and its sets list
    await page.click('#mkAddBtn');
    await check(page, 'Markers: Add markers', big);
    await page.click('#mkaSet');
    await check(page, 'Markers: Add a set you own', big);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await idle(page);
    await page.click('#filterBar');
    await check(page, 'Markers: filters', big);
    await page.click('#filterBar');
    await page.click('#mkMore');
    await check(page, 'Markers: ⋯ menu', big);
    await page.click('#mkMore');
    await page.evaluate(() => openBackup());
    await page.waitForSelector('#backupOverlay.on');
    await check(page, 'Back up & restore', big);
    await close(page);
    await page.click('#swatchBtn');
    await page.waitForSelector('#swOverlay.on');
    await check(page, 'swatch chart', big);
    await close(page);
    // (v309) Tick colours on a chart
    await chartFromMarkers(page);
    await page.waitForSelector('#chartOverlay.on');
    await check(page, 'colour chart', big);
    await close(page);
    await page.click('#mkMatchBtn');
    await check(page, 'Match: Photo', big);
    await page.click('#matchOverlay .msrc [data-src="hex"]');
    await page.fill('#matchHex', '#3a7bd5');
    await check(page, 'Match: Hex code', big);
    await close(page);
    await page.click('#mkDrawBtn');
    await idle(page);
    await check(page, 'Markers: Random', big);
    if (await page.isVisible('#rndBack')) await page.click('#rndBack');
    await page.click('#mPalette');
    await idle(page);
    await check(page, 'Palette', big);
    await page.click('#draw');
    await idle(page);
    const pal = await check(page, 'Palette after Generate', big);
    if (!big)
      for (const id of ['#draw', '#undo', '#reset', '#saveBtn', '#libMore', '#useInGuide'])
        assert.equal(h(pal, id), 44, id);
    // Library and Save image, in the ⋯ menu beside Save
    await page.click('#libMore');
    const more = await check(page, 'Palette: the ⋯ menu', big);
    if (!big) for (const id of ['#savedBtn', '#exportBtn']) assert.equal(h(more, id), 44, id);
    await page.keyboard.press('Escape');
    await page.click('#harm [data-h="photo"]');
    await check(page, 'Palette: Photo', big);
    await page.click('#harm [data-h="complementary"]');
    await page.click('#saveBtn');
    await idle(page);
    await page.click('#libMore');
    await page.click('#savedBtn');
    await check(page, 'Library', big);
    await close(page);
  }
  // ---- From the fourth review (outside the guide screen) ----
  const onboarded = (extra = {}) => ({
    'ms-onboarded': '1',
    'ms-setup-tip': '1',
    'ms-last-ver': 'v263',
    ...extra,
  });
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
  // ---- From the fifth review (guide screen) ----
  const rect = (page, sel) =>
    page.evaluate((s) => {
      const e = document.querySelector(s);
      return e ? e.getBoundingClientRect().toJSON() : null;
    }, sel);
  // ---- From the fifth review (outside the guide screen) ----
  const onboardedV265 = (extra = {}) => ({
    'ms-onboarded': '1',
    'ms-setup-tip': '1',
    'ms-last-ver': 'v265',
    ...extra,
  });
  test('one button height: 44px actions, 40px choices, 44px tap areas, on every screen at 390×844', async () => {
    const { page, errors } = await openApp({ userAgent: IPHONE, init, storage: storage() });
    await idle(page);
    await walk(page, false);
    assert.deepEqual(errors, []);
  });
  test('Welcome and the guide keep the rule: 44px actions, 40px choices, a 44px Focus bar', async () => {
    const { page, errors } = await openApp();
    // (v309: the three ways in, then the set list, the find step and one by one, each a step of its own)
    const w0 = await check(page, 'Welcome', false);
    assert.deepEqual([h(w0, '#wcSkip'), h(w0, '#wcRestore')], [44, 44]);
    await page.click('#wcNotSure');
    await check(page, 'Welcome: find my set', false);
    await page.click('#wcStepFind .wcback');
    await page.click('#wcOneByOne');
    await check(page, 'Welcome: one by one', false);
    await page.click('#wcStepOne .wcback');
    await haveSet(page);
    const w = await check(page, 'Welcome: the set list', false);
    assert.deepEqual([h(w, '#wcAdd')], [44]);
    assert.deepEqual(
      [...new Set(w.filter((x) => x.kind === 'choice').map((x) => x.h))],
      [40],
      'brand tabs: 40px',
    );
    await page.check('#wcSets input[data-i="3"]');
    await page.click('#wcAdd');
    await idle(page);
    await check(page, 'Welcome: next steps', false);
    await page.click('#wcSample');
    await page.waitForFunction(() => !!(window.__mstest && __mstest.assignData));
    await idle(page);
    await page.evaluate(() => scrollTo(0, 0));
    const g = await check(page, 'guide: Colours', false);
    assert.deepEqual([h(g, '#sfColor'), h(g, '#sfBack2')], [44, 44], 'the bar');
    assert.equal(h(g, '#sfZin'), 34, 'the tool row’s icons keep their size');
    // (v318.33: underline tabs, 44 px as every action; 42 before)
    assert.equal(h(g, '#sfTab-colours'), 44, 'the tabs keep theirs');
    await page.click('.sftabbtn[data-t="share"]');
    await check(page, 'guide: Share', false);
    await page.click('#sfPrint');
    await check(page, 'guide: the Print sheet', false);
    await page.keyboard.press('Escape');
    await idle(page);
    await openMenu(page);
    await check(page, 'guide: the ⋯ menu', false);
    await page.keyboard.press('Escape');
    await page.click('.sftabbtn[data-t="colours"]');
    await page.click('#sfColor');
    await idle(page);
    await page.click('#sfFocus');
    await idle(page);
    const f = await check(page, 'Focus', false);
    assert.deepEqual(
      ['#sfFBack', '#sfFDone', '#sfFSkip'].map((id) => h(f, id)),
      [44, 44, 44],
      'Focus bar: 44px, not 52',
    );
    assert.deepEqual(errors, []);
  });
  // v306: Home's latest piece, Reveal & share and Print…: 44px actions, on a phone and an iPad
  test('Home’s latest piece keeps the rule: Reveal & share and Print… are 44px', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await saveGuide(page);
    await page.evaluate(() => {
      const t = __mstest;
      t.assignData.order.forEach((l) => {
        t.colored[l] = 1;
      });
      t.guideDirty = true;
      t.updateProgress();
      t.renderGuide();
    });
    await page.evaluate(() => __mstest.flushSave());
    await idle(page, 1500);
    await page.click('#mHome');
    await page.waitForSelector('#homeHero .hhbox img');
    for (const [w, hh] of [
      [390, 844],
      [820, 1180],
      [1180, 820],
    ]) {
      await page.setViewportSize({ width: w, height: hh });
      await idle(page);
      const bs = await check(page, `Home (latest piece) at ${w}`, false);
      assert.deepEqual(
        [h(bs, '#homeHeroGo'), h(bs, '#homeHeroPrint')],
        [44, 44],
        `${w}: Reveal & share, Print…`,
      );
    }
    assert.deepEqual(errors, []);
  });
  test('at 1.6x text, buttons grow with their labels rather than cutting them', async () => {
    const { page, errors } = await openAtScale(1.6, { userAgent: IPHONE, init, storage: storage() });
    await idle(page);
    await walk(page, true);
    assert.deepEqual(errors, []);
  });
  // ---- From the fourth review (v263 guide screen) ----
  // (v318.16: the guide's choices 44px too, from 40)
  test("buttons in the guide are 44px (choices and actions), never the app's 54px", async () => {
    const { page, errors } = await openApp();
    await welcome(page, 'look');
    await page.click('#mSections');
    await idle(page);
    const hs = (sel) =>
      page.$$eval(sel, (b) =>
        b
          .filter((x) => x.getClientRects().length)
          .map((x) => (x.id || x.textContent.trim()) + ':' + Math.round(x.getBoundingClientRect().height)),
      );
    assert.deepEqual(await hs('#sfPick,#sfSample,#sfLib,#sfImport'), [
      'sfPick:44',
      'sfSample:44',
      'sfLib:44',
      'sfImport:44',
    ]);
    await page.click('#sfSample');
    await page.waitForFunction(() => !!(window.__mstest && __mstest.assignData));
    await idle(page);
    const none54 = async (what) => {
      const all = await hs('#sfRoot button');
      assert.deepEqual(
        all.filter((x) => x.endsWith(':54')),
        [],
        what,
      );
    };
    for (const t of ['colours', 'pattern', 'shading', 'share']) {
      await page.click(`.sftabbtn[data-t="${t}"]`);
      await none54(t);
    }
    await page.click('.sftabbtn[data-t="pattern"]');
    await page.click('#sfFam [data-v="manual"]');
    await idle(page);
    await page.click('#sfPaint');
    await idle(page);
    assert.deepEqual(await hs('#sfPaint,#sfBrush'), ['sfPaint:44', 'sfBrush:44']);
    await page.click('#sfBrush');
    await page.waitForSelector('#sfSheet.sfpicksh');
    assert.deepEqual(
      await hs('#sfSheet .sfshft button'),
      ['sfPopCancel:44', 'sfPopConfirm:44'],
      'sheet footers match the bar',
    );
    await page.click('#sfPopCancel');
    await page.click('#sfPaint');
    await answerAsks(page);
    await page.click('#sfBack2');
    await idle(page);
    await page.click('#sfAdjToggle');
    await idle(page);
    assert.deepEqual(await hs('#sfRotL,#sfRotR,#sfCrop,#sfAutoCrop'), [
      'sfRotL:44',
      'sfRotR:44',
      'sfCrop:44',
      'sfAutoCrop:44',
    ]);
    // (v318.33: the edit tools are segments in a track, 40px (--h-seg) with the 44px tap area, as Palette's)
    assert.deepEqual(await hs('#sfEdit button'), [
      'sfEmToggle:40',
      'sfEmMerge:40',
      'sfEmSplit:40',
      'sfEmAdd:40',
    ]);
    await none54('Edit sections');
    await page.click('#sfCrop');
    await idle(page);
    assert.deepEqual(await hs('#sfCropApply,#sfCropReset,#sfCropCancel'), [
      'sfCropApply:44',
      'sfCropReset:44',
      'sfCropCancel:44',
    ]);
    assert.deepEqual(errors, []);
  });
  test('small controls have 44px tap areas; long palette codes wrap; the To buy view is tidy', async () => {
    // (v318.33: two guides. Since v318.32 Home features the newest guide whether or not it's started, so with one guide
    // "Your guides" and its All guides link didn't show, and this test timed out)
    const { page, errors } = await openApp({
      storage: onboarded({
        [KEY]: appState({
          saved: [
            { id: 5, type: 'guide', name: 'G', keys: [], ts: Date.now() },
            { id: 6, type: 'guide', name: 'H', keys: [], ts: Date.now() - 1000 },
          ],
        }),
      }),
    });
    // a tap 4px outside a control still reaches it
    const hit = (sel) =>
      page.evaluate((sel) => {
        const b = document.querySelector(sel),
          r = b.getBoundingClientRect(),
          el = document.elementFromPoint(r.left + r.width / 2, r.top - 4);
        return !!el && (el === b || b.contains(el));
      }, sel);
    await page.waitForSelector('#sfRecent .sfSeeAll');
    assert.ok(await hit('#sfRecent .sfSeeAll'), 'See all');
    await page.click('#homeLibCard');
    assert.ok(await hit('#savedClose'), 'dialog ✕');
    await page.keyboard.press('Escape');
    // (v308: eight markers, one of each colour, can't fill a Complementary of 6, so it isn't offered; a Rainbow of 6 is)
    await page.click('#mPalette');
    await page.click('#harm [data-h="rainbow"]');
    await page.click('#segs [data-n="6"]');
    await page.click('#draw');
    await idle(page);
    assert.ok(
      await page.evaluate(() => {
        const h = document.querySelector('.readout .hex');
        return (
          h.scrollWidth <= h.clientWidth + 1 &&
          h.getBoundingClientRect().right <=
            document.getElementById('stage').getBoundingClientRect().right + 1
        );
      }),
      'codes stay on the card',
    );
    await page.click('#mCollection');
    await page.click('#ownView [data-v="wish"]');
    await idle(page);
    assert.equal(await page.isVisible('#mkDraw'), false, 'no Random / Match in To buy');
    assert.equal(await page.getAttribute('#filterBar', 'aria-expanded'), 'false');
    await page.click('#ownView [data-v="owned"]');
    await page.click('#filterBar');
    assert.equal(await page.getAttribute('#filterBar', 'aria-expanded'), 'true');
    assert.equal(await page.getAttribute('#q', 'aria-label'), 'Search markers');
    assert.equal(
      await page.evaluate(() => getComputedStyle(document.querySelector('.rgn')).opacity),
      '1',
      'family counts not faded further',
    );
    assert.deepEqual(errors, []);
  });
  test("tap areas: the header's Save pill and the ⓘ lines (guide and Markers) are 44px tall to tap", async () => {
    const { page, errors } = await openApp({
      storage: { 'ms-seen-hints': '["along","tap","mk-grid","markers"]' },
    });
    await sampleGuide(page);
    await idle(page);
    // (v285: the pill shows as Put back, after the open guide was deleted in the Library, or Save after a failed save)
    await saveGuide(page);
    await page.evaluate(() => {
      const g = state.saved.find((s) => s.type === 'guide');
      sfDeleteDesign(g.id);
      SF.libChanged(g.id, false);
    });
    await idle(page);
    const sv = await page.evaluate(() => {
      const b = document.getElementById('sfSave'),
        r = b.getBoundingClientRect(),
        a = getComputedStyle(b, '::after');
      return { h: r.height, tap: parseFloat(a.height), w: r.width };
    });
    assert.ok(sv.h < 44 && sv.tap >= 44, `Save looks ${sv.h}px, taps ${sv.tap}px`);
    // the tap area is centred on the pill: a tap 20px above its middle still saves
    const r = await rect(page, '#sfSave');
    assert.equal(
      await page.evaluate(
        ([x, y]) => document.elementFromPoint(x, y)?.id,
        [r.x + r.width / 2, r.y + r.height / 2 - 20],
      ),
      'sfSave',
    );
    await page.click('#sfColor');
    await idle(page);
    const info = await page.$$eval('#sfCtl button.sfinfo', (bs) =>
      bs.map((b) => b.getBoundingClientRect().height),
    );
    assert.ok(info.length && info.every((h) => h >= 44), 'collapsed ⓘ lines: ' + info);
    await page.click('#sfCtl button.sfinfo');
    await idle(page);
    assert.ok(
      (await page.$eval('#sfCtl button.sfinfo', (b) => b.getBoundingClientRect().height)) >= 44,
      'open too',
    );
    await page.click('#mCollection');
    await idle(page);
    const mk = await page.$$eval('.mkhint .sfinfo', (bs) =>
      bs.filter((b) => b.offsetParent).map((b) => b.getBoundingClientRect().height),
    );
    assert.ok(
      mk.every((h) => h >= 44),
      "Markers' hint: " + mk,
    );
    assert.deepEqual(errors, []);
  });
  test('disabled buttons look disabled; Clear only when there is something to clear; choices announced', async () => {
    const { page, errors } = await openApp({ storage: onboardedV265({ [KEY]: appState() }) });
    await page.click('#mPalette');
    await idle(page);
    const look = (sel) =>
      page.evaluate((s) => {
        const e = document.querySelector(s),
          c = getComputedStyle(e);
        return { dis: e.disabled, op: +c.opacity, cur: c.cursor, edge: c.borderTopStyle };
      }, sel);
    // (Palette opens on a preview palette since v305: it can be saved, but there's none of yours to clear yet)
    assert.equal((await look('#saveBtn')).dis, false, 'the preview can be saved');
    // (v320, Ben's D2e: off, but readable where it stands: its words at half strength, a dashed edge, not the whole
    // button faded to 40%)
    assert.deepEqual(
      await look('#reset'),
      { dis: true, op: 1, cur: 'not-allowed', edge: 'dashed' },
      'nothing to clear',
    );
    assert.equal(await page.textContent('#reset'), 'Clear');
    await page.click('#draw');
    await idle(page);
    // (the fade back in can still be under way when idle on GitHub's WebKit)
    await page
      .waitForFunction(() => getComputedStyle(document.getElementById('saveBtn')).opacity === '1', null, {
        timeout: 3000,
      })
      .catch(() => {});
    assert.equal((await look('#saveBtn')).op, 1);
    assert.equal((await look('#reset')).dis, false);
    await page.click('#saveBtn');
    assert.equal((await look('#saveBtn')).op, 1, '"Saved ✓" is not faint');
    // announced choices: Harmony, Colours, and Markers › Show
    const pressed = (sel) =>
      page.$$eval(sel + ' button', (l) =>
        l.filter((b) => b.style.display !== 'none').map((b) => b.getAttribute('aria-pressed')),
      );
    assert.equal((await pressed('#harm')).filter((x) => x === 'true').length, 1);
    assert.ok((await pressed('#harm')).every((x) => x === 'true' || x === 'false'));
    assert.equal(await page.getAttribute('#segs [data-n="4"]', 'aria-pressed'), 'true');
    await page.click('#segs [data-n="5"]');
    assert.equal(await page.getAttribute('#segs [data-n="5"]', 'aria-pressed'), 'true');
    assert.equal(await page.getAttribute('#segs [data-n="4"]', 'aria-pressed'), 'false');
    await page.click('#mCollection');
    assert.deepEqual(await pressed('#ownView'), ['true', 'false', 'false', 'false']);
    // the top tabs: 40px to look at (--h-seg since v318.33; 38 before), 44px to tap
    const tab = await page.evaluate(() => {
      const b = document.getElementById('mHome'),
        r = b.getBoundingClientRect(),
        a = getComputedStyle(b, '::after');
      return {
        h: r.height,
        after: parseFloat(a.height),
        hit: document.elementFromPoint(r.left + r.width / 2, r.top - 2) === b,
      };
    });
    assert.equal(Math.round(tab.h), 40);
    assert.ok(tab.after >= 44);
    assert.ok(tab.hit, 'a tap just above the tab reaches it');
    assert.deepEqual(errors, []);
  });
}

// ---- from escape-stack-guide.test.mjs ----
// Escape and the guide's layers, one press at a time: the marker picker, any other sheet (the ⋯ menu, Reset
// progress's question, Print), the tip over a tapped section, focus mode and its Colours sheet, Reveal and full
// screen, each alone and with a dialog open over them; the rename field and the Section edits question; Ctrl+Z
// behind an open sheet or dialog. Written against v267 before Escape was brought into one place (src/js/layers.js),
// so each test says what the app did then: every Escape closes one thing, the top one, and focus lands where it did.
{
  // everything that can be open, in one object, so each step says exactly what is still open
  const layers = (page) =>
    page.evaluate(() => {
      const rt = document.getElementById('sfRoot'),
        fs = document.getElementById('sfFocSheet'),
        sh = document.getElementById('sfSheet');
      return {
        dialogs: [...document.querySelectorAll('.overlay.on')].map((o) => o.id),
        sheet: sh
          ? sh.classList.contains('sfpicksh')
            ? 'picker'
            : sh.classList.contains('sfmenush')
              ? 'menu'
              : sh.classList.contains('sfasksh')
                ? 'ask'
                : 'other'
          : null,
        tip: !!document.querySelector('.sftip'),
        renaming: !!document.getElementById('sfGName'),
        full: rt.classList.contains('sffull'),
        reveal: rt.classList.contains('sfrev'),
        focus: rt.classList.contains('sffoc'),
        focusSheet: !!(fs && fs.style.display !== 'none' && rt.classList.contains('sffoc')),
      };
    });
  const NONE = {
    dialogs: [],
    sheet: null,
    tip: false,
    renaming: false,
    full: false,
    reveal: false,
    focus: false,
    focusSheet: false,
  };
  const open = (o) => ({ ...NONE, ...o });
  const esc = async (page) => {
    await page.keyboard.press('Escape');
    await idle(page);
  };
  const active = (page) =>
    page.evaluate(() => {
      const a = document.activeElement;
      return a
        ? a.id || (a.dataset && a.dataset.a && 'tip:' + a.dataset.a) || a.className || a.tagName
        : null;
    });
  const bigSections = (page, n = 3) =>
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
  const mk = (page, l) => page.evaluate((l) => __mstest.assignData.assign[l].mkey, l);
  const tickN = (page, n) =>
    page.evaluate((n) => {
      const t = __mstest;
      t.assignData.order.slice(0, n).forEach((l) => {
        t.colored[l] = 1;
      });
      t.guideDirty = true;
      t.renderGuide();
    }, n);
  const ticks = (page) => page.evaluate(() => __mstest.colored.reduce((a, b) => a + b, 0));
  test('the ⋯ menu alone: Escape closes it and focus goes back to ⋯; a second Escape does nothing', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await page.focus('#sfMore');
    await page.keyboard.press('Enter');
    await page.waitForSelector('#sfSheet .sfmitem');
    assert.deepEqual(await layers(page), open({ sheet: 'menu' }));
    await esc(page);
    assert.deepEqual(await layers(page), NONE);
    assert.equal(await active(page), 'sfMore');
    await esc(page);
    assert.deepEqual(await layers(page), NONE);
    assert.equal(await active(page), 'sfMore');
    assert.deepEqual(errors, []);
  });
  test('the tip alone (by mouse): Escape hides it; the picker from it: Escape undoes the pick, closes it, and focus goes to the open tab', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    const [l] = await bigSections(page, 1),
      m0 = await mk(page, l);
    await scrollTop(page);
    await tapSection(page, l);
    assert.deepEqual(await layers(page), open({ tip: true }));
    await esc(page);
    assert.deepEqual(await layers(page), NONE);
    // Change colour: a pick previews, Escape takes it back
    await scrollTop(page);
    await tapSection(page, l);
    await page.click('.sftip [data-a="change"]');
    await page.waitForSelector('#sfSheet.sfpicksh');
    assert.deepEqual(await layers(page), open({ sheet: 'picker' }));
    await page.click(`#sfPopSw .sfsw:not(.on):not([data-k="${m0}"])`);
    await idle(page);
    assert.notEqual(await mk(page, l), m0, 'previewed');
    await esc(page);
    assert.deepEqual(
      await layers(page),
      NONE,
      'the picker closed, and with the mouse the tip does not come back',
    );
    assert.equal(await mk(page, l), m0, 'Escape is Cancel: the pick is undone');
    // (v289: the open tab, on screen under the picture, not ⋯ scrolled away at the top)
    assert.equal(await active(page), 'sfTab-colours');
    assert.deepEqual(errors, []);
  });
  test('picker over the tip, by keyboard: Escape closes the picker and brings the tip back focused; the next closes the tip', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    const [l] = await bigSections(page, 1);
    await scrollTop(page);
    await tapSection(page, l);
    await page.focus('.sftip [data-a="change"]');
    await page.keyboard.press('Enter');
    await page.waitForSelector('#sfSheet.sfpicksh');
    await idle(page);
    assert.deepEqual(await layers(page), open({ sheet: 'picker' }));
    // Escape on the code filter is the picker's Escape too (the field doesn't keep it)
    await page.focus('#sfPopFilter');
    await page.keyboard.type('R');
    await esc(page);
    assert.deepEqual(await layers(page), open({ tip: true }));
    assert.equal(await active(page), 'tip:change');
    await esc(page);
    assert.deepEqual(await layers(page), NONE);
    assert.deepEqual(errors, []);
  });
  test('renaming: Escape in the name field only cancels the rename, even with the tip showing; the next Escape closes the tip', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    const n0 = await page.textContent('#sfGTitle'),
      [l] = await bigSections(page, 1);
    await scrollTop(page);
    await page.click('#sfRename');
    await page.fill('#sfGName', 'Not this');
    // a tap on a section that doesn't take focus from the field (a synthetic press): the tip shows while renaming
    const p = await sectionPoint(page, l);
    await page.evaluate(({ x, y }) => {
      const c = document.getElementById('sfCanvas'),
        o = {
          bubbles: true,
          cancelable: true,
          clientX: x,
          clientY: y,
          pointerId: 7,
          pointerType: 'mouse',
          isPrimary: true,
          button: 0,
          buttons: 1,
        };
      c.dispatchEvent(new PointerEvent('pointerdown', o));
      c.dispatchEvent(new PointerEvent('pointerup', { ...o, buttons: 0 }));
      c.dispatchEvent(new MouseEvent('click', o));
    }, p);
    await idle(page);
    assert.deepEqual(await layers(page), open({ tip: true, renaming: true }));
    assert.equal(await active(page), 'sfGName');
    await esc(page);
    assert.deepEqual(await layers(page), open({ tip: true }), 'the rename was cancelled, the tip stays');
    assert.equal(await page.textContent('#sfGTitle'), n0);
    assert.equal(await active(page), 'sfRename');
    await esc(page);
    assert.deepEqual(await layers(page), NONE);
    assert.deepEqual(errors, []);
  });
  test('full screen: the tip or a sheet in it closes first, then full screen; a dialog over full screen closes alone', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    const [l] = await bigSections(page, 1);
    await page.click('#sfFull');
    await idle(page);
    assert.deepEqual(await layers(page), open({ full: true }));
    await tapSection(page, l);
    assert.deepEqual(
      await layers(page),
      open({ full: true, tip: true }),
      'a tap shows the tip in full screen',
    );
    await esc(page);
    assert.deepEqual(await layers(page), open({ full: true }));
    // the ⋯ menu, reached by keyboard behind full screen: it leaves full screen as it opens, as a marker picker does
    // (v328 review: it had opened under the full-screen picture, unseen, with the keyboard in it)
    await page.focus('#sfMore');
    await page.keyboard.press('Enter');
    await page.waitForSelector('#sfSheet .sfmitem');
    assert.deepEqual(await layers(page), open({ sheet: 'menu' }));
    await esc(page);
    assert.deepEqual(await layers(page), NONE);
    assert.equal(await active(page), 'sfMore');
    await page.click('#sfFull');
    await idle(page);
    // Help over full screen
    await page.focus('#sfFullX');
    await page.evaluate(() => openHelpSheet());
    await idle(page);
    assert.deepEqual(await layers(page), open({ full: true, dialogs: ['helpOverlay'] }));
    await esc(page);
    assert.deepEqual(await layers(page), open({ full: true }));
    assert.equal(await active(page), 'sfFullX', 'focus back where it was');
    await esc(page);
    assert.deepEqual(await layers(page), NONE);
    assert.deepEqual(errors, []);
  });
  test('Reveal: a dialog over it closes alone, then Escape ends Reveal', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await page.click('.sftabbtn[data-t="share"]');
    await page.click('#sfReveal');
    await page.waitForSelector('#sfRevX', { timeout: 15000 });
    assert.deepEqual(await layers(page), open({ reveal: true }));
    await page.focus('#sfRevX');
    await page.evaluate(() => openLibrary());
    await idle(page);
    assert.deepEqual(await layers(page), open({ reveal: true, dialogs: ['savedOverlay'] }));
    await esc(page);
    assert.deepEqual(await layers(page), open({ reveal: true }));
    assert.equal(await active(page), 'sfRevX');
    await esc(page);
    assert.deepEqual(await layers(page), NONE);
    assert.deepEqual(errors, []);
  });
  test('a dialog over the ⋯ menu closes alone; then the menu; Help from ⋯ gives focus back to ⋯', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await openMenu(page);
    await page.evaluate(() => openLibrary());
    await idle(page);
    assert.deepEqual(await layers(page), open({ sheet: 'menu', dialogs: ['savedOverlay'] }));
    await esc(page);
    assert.deepEqual(await layers(page), open({ sheet: 'menu' }));
    assert.ok(
      await page.evaluate(() => document.getElementById('sfSheet').contains(document.activeElement)),
      'focus back in the menu: ' + (await active(page)),
    );
    await esc(page);
    assert.deepEqual(await layers(page), NONE);
    // Help from the menu (the menu closes as Help opens)
    await menuItem(page, 'Help');
    await idle(page);
    assert.deepEqual(await layers(page), open({ dialogs: ['helpOverlay'] }));
    await esc(page);
    assert.deepEqual(await layers(page), NONE);
    assert.equal(await active(page), 'sfMore');
    // How it works from Help: one Escape each
    await menuItem(page, 'Help');
    await idle(page);
    await page.focus('#helpHiw');
    await page.keyboard.press('Enter');
    await idle(page);
    assert.deepEqual(await layers(page), open({ dialogs: ['helpOverlay', 'hiwOverlay'] }));
    await esc(page);
    assert.deepEqual(await layers(page), open({ dialogs: ['helpOverlay'] }));
    assert.equal(await active(page), 'helpHiw');
    await esc(page);
    assert.deepEqual(await layers(page), NONE);
    assert.equal(await active(page), 'sfMore');
    assert.deepEqual(errors, []);
  });
  test('Colour along: Reset progress’s question closes with Escape and clears nothing; Ctrl+Z does nothing behind a sheet or dialog', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    // Ctrl+Z in the guide editor: one Shuffle to undo
    await page.click('.sftabbtn[data-t="pattern"]');
    await page.click('#sfVary');
    await idle(page);
    const n = await page.evaluate(() => __mstest.planCount);
    await page.evaluate(() => openLibrary());
    await idle(page);
    await page.keyboard.press('Control+z');
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.planCount), n, 'nothing undone behind the Library');
    await esc(page);
    await openMenu(page);
    await page.keyboard.press('Control+z');
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.planCount), n, 'nothing undone behind the menu');
    await esc(page);
    assert.deepEqual(await layers(page), NONE);
    // Colour along
    await page.click('#sfColor');
    await idle(page);
    await tickN(page, 3);
    await menuItem(page, 'Reset progress');
    await page.waitForSelector('#sfSheet.sfasksh');
    assert.match(await page.textContent('#sfSheetT'), /Reset progress\?/);
    assert.deepEqual(await layers(page), open({ sheet: 'ask' }));
    await esc(page);
    assert.deepEqual(await layers(page), NONE);
    assert.equal(await ticks(page), 3, 'nothing cleared');
    assert.equal(await active(page), 'sfMore');
    assert.equal(await page.evaluate(() => __mstest.sfmode), 'color');
    assert.deepEqual(errors, []);
  });
  test('focus mode: Escape closes its Colours sheet, then leaves it (focus back on ⛶ Focus mode); a dialog over it closes first', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await page.click('#sfColor');
    await idle(page);
    await page.focus('#sfFocus');
    await page.keyboard.press('Enter');
    await idle(page);
    assert.deepEqual(await layers(page), open({ focus: true }));
    await page.click('#sfFocCols');
    await idle(page);
    assert.deepEqual(await layers(page), open({ focus: true, focusSheet: true }));
    // Help over focus mode has the keys
    await page.evaluate(() => openHelpSheet());
    await idle(page);
    assert.deepEqual(await layers(page), open({ focus: true, focusSheet: true, dialogs: ['helpOverlay'] }));
    await esc(page);
    assert.deepEqual(await layers(page), open({ focus: true, focusSheet: true }));
    await esc(page);
    assert.deepEqual(await layers(page), open({ focus: true }));
    assert.equal(await page.evaluate(() => __mstest.focus), true);
    await esc(page);
    assert.deepEqual(await layers(page), NONE);
    assert.equal(await active(page), 'sfFocus');
    assert.equal(await page.evaluate(() => __mstest.sfmode), 'color');
    assert.deepEqual(errors, []);
  });
  test('focus mode: Escape from a form field in it (the tone-steps box) does nothing', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await page.click('.sftabbtn[data-t="shading"]');
    await idle(page);
    await page.evaluate(() => __mstest.shadeTo('full'));
    await idle(page);
    await page.click('#sfColor');
    await idle(page);
    await page.click('#sfFocus');
    await idle(page);
    await page.click('#sfFocCols');
    await idle(page);
    await page.focus('#sfToneSteps');
    await esc(page);
    assert.deepEqual(
      await layers(page),
      open({ focus: true, focusSheet: true }),
      'Escape on a checkbox in focus mode is left alone',
    );
    assert.deepEqual(errors, []);
  });
  test('Section edits question: Escape is Cancel (nothing opens), focus goes back, and it leaves no Escape behind', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await saveGuide(page);
    const id = await page.evaluate(() => __mstest.curId);
    await page.click('#sfBack2');
    await idle(page);
    await scrollTop(page);
    const [, , l] = await bigSections(page, 3);
    await tapSection(page, l);
    assert.equal(await page.evaluate((l) => __mstest.counted(l), l), false, 'excluded');
    await page.focus('#sfBuild');
    await page.evaluate(() => {
      SF.loadSample();
    });
    await page.waitForSelector('#sfEdAsk');
    assert.deepEqual(await layers(page), open({ dialogs: ['sfEdAsk'] }));
    assert.equal(
      await page.evaluate(() => document.activeElement.dataset.a),
      'build',
      'focus on Build guide',
    );
    await esc(page);
    assert.deepEqual(await layers(page), NONE);
    assert.equal(await page.locator('#sfEdAsk').count(), 0, 'removed');
    assert.equal(await page.evaluate(() => __mstest.curId), id, 'nothing else opened');
    assert.equal(await page.evaluate(() => __mstest.sfmode), 'review');
    assert.equal(await active(page), 'sfBuild');
    // a later Escape reaches the guide's own layers as usual (the question's key handling went with it)
    await page.focus('#sfMore');
    await page.keyboard.press('Enter');
    await page.waitForSelector('#sfSheet .sfmitem');
    await esc(page);
    assert.deepEqual(await layers(page), NONE);
    assert.equal(await active(page), 'sfMore');
    // asked again: the new question takes Escape the same way
    await page.evaluate(() => {
      SF.loadSample();
    });
    await page.waitForSelector('#sfEdAsk');
    await esc(page);
    assert.equal(await page.locator('#sfEdAsk').count(), 0);
    assert.equal(await page.evaluate(() => __mstest.curId), id);
    assert.deepEqual(errors, []);
  });
  // Changed with layers.js (a bug unified): the rename field is reachable by keyboard behind full screen (full screen
  // doesn't hold focus). In v267 Escape there left full screen and kept the rename open, as full screen's Escape didn't
  // leave the name field alone the way the tip's and the sheets' did. Now the field keeps its Escape wherever it is.
  // (v328 review: Rename leaves full screen first, its field was typed into unseen under the picture)
  test('renaming from full screen: it leaves full screen; Escape cancels the rename', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    const n0 = await page.textContent('#sfGTitle');
    await page.click('#sfFull');
    await idle(page);
    await page.focus('#sfRename');
    await page.keyboard.press('Enter');
    await idle(page);
    assert.equal(await active(page), 'sfGName');
    await page.keyboard.type('x');
    assert.deepEqual(await layers(page), open({ renaming: true }));
    await esc(page);
    assert.deepEqual(await layers(page), NONE);
    assert.equal(await page.textContent('#sfGTitle'), n0, 'the name as it was');
    assert.equal(await active(page), 'sfRename');
    assert.deepEqual(errors, []);
  });
}

// ---- from escape-stack-shell.test.mjs ----
// Escape and the app's dialogs (.overlay), one press at a time: every dialog alone (one Escape closes exactly it,
// and focus goes back to what opened it), two at once, a text field inside one, the Library's rename field, the
// welcome, Tab held inside the top dialog (and reaching a toast's Undo), a toast from before a dialog opened, and
// where focus lands when what opened the dialog has gone. Written against v267 before Escape and the dialogs were
// brought into one place (src/js/layers.js), so each test says what the app did then.
{
  const KEY = 'ohuhu-hb320-picker-v3';
  const onboarded = (extra = {}) => ({
    'ms-onboarded': '1',
    'ms-setup-tip': '1',
    'ms-last-ver': 'v267',
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
  const at = (mode, extra = {}) => ({ storage: onboarded({ [KEY]: appState({ mode, ...extra }) }) });
  // (v288) by keyboard: Markers' ⋯ › Back up & restore opens the Library; its text line opens the backup dialog over it
  async function openBackupKb(page) {
    await page.focus('#mkMore');
    await page.keyboard.press('Enter');
    await page.focus('#backupBtn');
    await page.keyboard.press('Enter');
    await page.waitForSelector('#savedOverlay.on');
    // (the Library then puts the keyboard on its Back up button, a moment later: wait for that, or an Enter meant for the
    // text link can land on Back up instead — GitHub run 36936732088)
    await page
      .waitForFunction(() => document.activeElement && document.activeElement.id === 'guidesBackup', null, {
        timeout: 5000,
      })
      .catch(() => {});
    await page.focus('#libBkText');
    await page.keyboard.press('Enter');
    await page.waitForSelector('#backupOverlay.on');
  }
  const dialogs = (page) =>
    page.evaluate(() => [...document.querySelectorAll('.overlay.on')].map((o) => o.id));
  const esc = async (page) => {
    await page.keyboard.press('Escape');
    await idle(page);
  };
  const active = (page) =>
    page.evaluate(() => {
      const a = document.activeElement;
      return a
        ? a.id || (a.dataset && a.dataset.i != null ? 'cell:' + a.dataset.i : '') || a.className || a.tagName
        : null;
    });
  const inside = (page, id) =>
    page.evaluate((id) => document.getElementById(id).contains(document.activeElement), id);
  const toastOn = (page) =>
    page.evaluate(() => {
      const t = document.getElementById('msToast');
      return !!(t && t.classList.contains('on'));
    });
  // each: where it opens from, the key that opens it on the focused opener, the dialog
  const ALONE = [
    ['home', '#homeLibCard', 'Enter', 'savedOverlay'],
    ['home', '#homeHelp', 'Enter', 'helpOverlay'],
    ['home', '#homeHiw', 'Enter', 'hiwOverlay'],
    // (v288) Back up & restore, in Markers' ⋯: chosen there, the Library opens at its backup buttons; focus back on ⋯
    [
      'collection',
      '#mkMore',
      () => {
        document.getElementById('mkMore').click();
        document.getElementById('backupBtn').click();
      },
      'savedOverlay',
    ],
    ['collection', '#mkMatchBtn', 'Enter', 'matchOverlay'],
    ['collection', '#swatchBtn', 'Enter', 'swOverlay'],
    ['collection', '#results .cell', 'Shift+F10', 'mkOverlay'],
    ['palette', '#seedBtn', 'Enter', 'seedOverlay'],
    // Library and Save image are in the ⋯ menu: chosen there, the menu closes and focus comes back to ⋯
    [
      'palette',
      '#libMore',
      () => {
        document.getElementById('libMore').click();
        document.getElementById('savedBtn').click();
      },
      'savedOverlay',
    ],
    // the swatch card itself takes a palette to draw: shown straight away here, as the button shows it
    [
      'palette',
      '#libMore',
      () =>
        showOverlay(
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
          'x.png',
        ),
      'imgOverlay',
    ],
  ];
  for (const [mode, sel, key, id] of ALONE) {
    test(`${id} alone (from ${sel} in ${mode}): focus moves in, one Escape closes it and focus goes back`, async () => {
      const { page, errors } = await openApp(at(mode));
      await idle(page);
      await page.focus(sel);
      const opener = await active(page);
      if (typeof key === 'function') await page.evaluate(key);
      else await page.keyboard.press(key);
      await page.waitForSelector('#' + id + '.on', { timeout: 10000 });
      await idle(page);
      assert.deepEqual(await dialogs(page), [id]);
      assert.ok(await inside(page, id), 'focus is in the dialog: ' + (await active(page)));
      await esc(page);
      assert.deepEqual(await dialogs(page), [], 'closed');
      assert.equal(await active(page), opener, 'focus back on what opened it');
      if (id === 'imgOverlay')
        assert.equal(await page.getAttribute('#cardImg', 'src'), '', 'the card image is let go');
      await esc(page);
      assert.deepEqual(await dialogs(page), []);
      assert.equal(await active(page), opener, 'a second Escape does nothing');
      assert.deepEqual(errors, []);
    });
  }
  test('the guide’s dialogs: Blend plan closes with Escape, back on its button; Print’s sheet too', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await page.click('.sftabbtn[data-t="share"]');
    await page.focus('#sfPlan');
    await page.keyboard.press('Enter');
    await page.waitForSelector('#sfPlanOverlay.on');
    await idle(page);
    assert.ok(await inside(page, 'sfPlanOverlay'));
    await esc(page);
    assert.deepEqual(await dialogs(page), []);
    assert.equal(await active(page), 'sfPlan');
    await page.focus('#sfPrint');
    await page.keyboard.press('Enter');
    await page.waitForSelector('#sfSheet.sfprsh');
    await esc(page);
    assert.equal(await page.locator('#sfSheet').count(), 0);
    assert.equal(await active(page), 'sfPrint');
    assert.deepEqual(errors, []);
  });
  test('two dialogs: How it works over Help closes first (focus back on its button), then Help', async () => {
    const { page, errors } = await openApp(at('home'));
    await page.focus('#homeHelp');
    await page.keyboard.press('Enter');
    await page.waitForSelector('#helpOverlay.on');
    await page.focus('#helpHiw');
    await page.keyboard.press('Enter');
    await page.waitForSelector('#hiwOverlay.on');
    await idle(page);
    assert.deepEqual(await dialogs(page), ['helpOverlay', 'hiwOverlay']);
    assert.equal(await active(page), 'hiwNext');
    await esc(page);
    assert.deepEqual(await dialogs(page), ['helpOverlay']);
    assert.equal(await active(page), 'helpHiw');
    await esc(page);
    assert.deepEqual(await dialogs(page), []);
    assert.equal(await active(page), 'homeHelp');
    // opened the other way round in the page (How it works first, then the Library by code): the one later in the
    // page is the one Escape closes, whichever opened last
    await page.evaluate(() => {
      openLibrary();
      document.getElementById('homeHiw').click();
    });
    await idle(page);
    assert.deepEqual(await dialogs(page), ['savedOverlay', 'hiwOverlay']);
    await esc(page);
    assert.deepEqual(await dialogs(page), ['savedOverlay']);
    await page.evaluate(() => {
      document.getElementById('savedOverlay').classList.remove('on');
      document.getElementById('homeHiw').click();
      openLibrary();
    });
    await idle(page);
    assert.deepEqual(await dialogs(page), ['savedOverlay', 'hiwOverlay']);
    await esc(page);
    assert.deepEqual(
      await dialogs(page),
      ['savedOverlay'],
      'How it works (later in the page) closed first, though the Library opened last',
    );
    assert.deepEqual(errors, []);
  });
  test('Escape in a dialog’s text field closes the dialog (search, hex code, backup text)', async () => {
    // (v313: a palette saved, so the Library has its search box: an empty one has none)
    const { page, errors } = await openApp(at('collection', { saved: [pal(['Ohuhu|R014'], 2, 'Two')] }));
    await openBackupKb(page);
    await page.focus('#backupText');
    await esc(page);
    assert.deepEqual(await dialogs(page), ['savedOverlay'], 'the backup dialog closes, over the Library');
    assert.equal(await active(page), 'libBkText');
    await esc(page);
    assert.deepEqual(await dialogs(page), []);
    assert.equal(await active(page), 'mkMore');
    await page.focus('#mkMatchBtn');
    await page.keyboard.press('Enter');
    await page.waitForSelector('#matchOverlay.on');
    await page.click('.msrc [data-src="hex"]');
    await page.fill('#matchHex', '#ff0000');
    await esc(page);
    assert.deepEqual(await dialogs(page), []);
    assert.equal(await active(page), 'mkMatchBtn');
    await page.evaluate(() => openLibrary());
    await page.fill('#libSearch', 'x');
    await esc(page);
    assert.deepEqual(await dialogs(page), []);
    assert.deepEqual(errors, []);
  });
  test('the Library’s rename field: Escape cancels the rename only (focus on its ⋯); the next Escape closes the Library', async () => {
    const { page, errors } = await openApp(
      at('home', { saved: [pal(['Ohuhu|R014'], 2, 'Two'), pal(['Ohuhu|B08'], 1, 'One')] }),
    );
    await page.focus('#homeLibCard');
    await page.keyboard.press('Enter');
    await page.waitForSelector('#savedOverlay.on');
    await libItem(page, '#savedList .srow[data-id="2"]', 'sren');
    assert.ok(await page.evaluate(() => document.activeElement.classList.contains('sname-in')));
    await page.keyboard.type('New name');
    await esc(page);
    assert.deepEqual(await dialogs(page), ['savedOverlay'], 'the Library stays');
    assert.equal(
      await page.evaluate(() => state.saved.find((s) => s.id === 2).name),
      'Two',
      'name as it was',
    );
    assert.equal(await page.locator('#savedList .sname-in').count(), 0);
    assert.equal(
      await page.evaluate(
        () =>
          document.activeElement.classList.contains('smore') &&
          document.activeElement.closest('.srow').dataset.id,
      ),
      '2',
      'on its ⋯ (v288)',
    );
    await esc(page);
    assert.deepEqual(await dialogs(page), []);
    assert.equal(await active(page), 'homeLibCard');
    assert.deepEqual(errors, []);
  });
  test('the welcome: Escape leaves it open', async () => {
    const { page, errors } = await openApp();
    await idle(page);
    assert.deepEqual(await dialogs(page), ['welcome']);
    await esc(page);
    assert.deepEqual(await dialogs(page), ['welcome']);
    await haveSet(page);
    await page.check('#wcSets input[data-i="3"]');
    await page.click('#wcAdd');
    await idle(page);
    await esc(page);
    assert.deepEqual(await dialogs(page), ['welcome'], 'nor on its second step');
    await page.click('#wcLook');
    await idle(page);
    assert.deepEqual(await dialogs(page), []);
    assert.deepEqual(errors, []);
  });
  test('Tab stays in the top dialog and reaches a toast’s Undo after the last control', async () => {
    const { page, errors } = await openApp(at('collection'));
    await openBackupKb(page);
    await idle(page);
    const first = 'backupClose',
      last = 'backupRestore';
    assert.equal(await active(page), first, 'with a keyboard, the first control has focus');
    await page.focus('#' + last);
    await page.keyboard.press('Tab');
    assert.equal(await active(page), first, 'Tab from the last wraps to the first');
    await page.keyboard.press('Shift+Tab');
    assert.equal(await active(page), last, 'Shift+Tab from the first wraps to the last');
    // focus outside the dialog: Tab brings it to the first control, Shift+Tab to the last
    await page.evaluate(() => document.getElementById('mCollection').focus());
    await page.keyboard.press('Tab');
    assert.equal(await active(page), first);
    await page.evaluate(() => document.getElementById('mCollection').focus());
    await page.keyboard.press('Shift+Tab');
    assert.equal(await active(page), last);
    // a toast with Undo raised while the dialog is open
    await page.evaluate(() => toastAction('Removed.', 'Undo', () => {}));
    await page.focus('#' + last);
    await page.keyboard.press('Tab');
    assert.equal(await active(page), 'toastAct', 'Tab from the last control reaches Undo');
    await page.keyboard.press('Tab');
    assert.equal(await active(page), first, 'then wraps to the first');
    await page.keyboard.press('Shift+Tab');
    assert.equal(await active(page), 'toastAct', 'Shift+Tab from the first goes to Undo');
    await page.keyboard.press('Shift+Tab');
    assert.equal(await active(page), last, 'and from Undo back to the last control');
    // two dialogs: Tab stays in the top one
    await page.evaluate(() => {
      document.getElementById('msToast').classList.remove('on');
      openHelpSheet();
      document.getElementById('helpHiw').click();
    });
    await idle(page);
    assert.deepEqual(await dialogs(page), ['savedOverlay', 'backupOverlay', 'helpOverlay', 'hiwOverlay']);
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press(i % 3 === 2 ? 'Shift+Tab' : 'Tab');
      assert.ok(await inside(page, 'hiwOverlay'), 'in How it works: ' + (await active(page)));
    }
    assert.deepEqual(errors, []);
  });
  test('a toast from before a dialog opened goes; one raised as it opens stays', async () => {
    const { page, errors } = await openApp(at('collection'));
    await page.evaluate(() => toast('Earlier', 8000));
    await idle(page);
    assert.equal(await toastOn(page), true);
    await pause(
      page,
      200,
      'a toast under 150 ms old is kept by a dialog opening (it came with it); this one is older',
    );
    await page.evaluate(() => openBackup());
    await idle(page);
    assert.equal(await toastOn(page), false, 'hidden when the dialog opened');
    await esc(page);
    await page.evaluate(() => {
      toast('Just now', 8000);
      openBackup();
    });
    await idle(page);
    assert.equal(await toastOn(page), true, 'a toast about the dialog itself stays');
    await esc(page);
    // Help hides any toast itself
    await page.evaluate(() => {
      toast('Just now', 8000);
      openHelpSheet();
    });
    await idle(page);
    assert.equal(await toastOn(page), false);
    assert.deepEqual(errors, []);
  });
  test('focus after closing: a redrawn marker is found again by its number; with the opener gone, the open mode tab; focus moved elsewhere stays', async () => {
    const { page, errors } = await openApp(at('collection'));
    const i = await page.evaluate(() => +document.querySelector('#results .cell').dataset.i);
    await page.focus(`#results .cell[data-i="${i}"]`);
    await page.keyboard.press('Shift+F10');
    await page.waitForSelector('#mkOverlay.on');
    await page.click('#mkOwn');
    await idle(page);
    assert.equal(
      await page.evaluate(
        (i) =>
          document.querySelector(`#results .cell[data-i="${i}"]`) === null ||
          !document.querySelector(`#results .cell[data-i="${i}"]`).isConnected,
        i,
      ),
      false,
    );
    await esc(page);
    assert.equal(await active(page), 'cell:' + i, 'the marker redrawn while its sheet was open');
    // the opener removed while the dialog is open: the open mode tab
    await page.evaluate(() => {
      const b = document.createElement('button');
      b.id = 'tmpOpener';
      b.textContent = 'x';
      document.body.appendChild(b);
      b.focus();
      openBackup();
    });
    await idle(page);
    await page.evaluate(() => document.getElementById('tmpOpener').remove());
    await esc(page);
    assert.equal(
      await page.evaluate(() => document.activeElement === document.querySelector('.modes button.on')),
      true,
      'on the open mode tab: ' + (await active(page)),
    );
    // focus moved outside the dialog before it closed: left there
    await page.focus('#mkMore');
    await page.keyboard.press('Enter');
    await page.evaluate(() => {
      document.getElementById('mkMenu').hidden = true;
      openBackup();
    });
    await page.waitForSelector('#backupOverlay.on');
    await idle(page);
    await page.evaluate(() => document.getElementById('mkMatchBtn').focus());
    await esc(page);
    assert.deepEqual(await dialogs(page), []);
    assert.equal(await active(page), 'mkMatchBtn');
    assert.deepEqual(errors, []);
  });
  test('on a touch screen the dialog’s card takes focus, not its first button', async () => {
    const coarse = `(function () { const mm = window.matchMedia.bind(window); window.matchMedia = function (q) { if (String(q).replace(/\\s/g, '') === '(pointer:coarse)') return { matches: true, media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }; return mm(q); }; })()`;
    const { page, errors } = await openApp({ ...at('home'), init: coarse });
    await page.focus('#homeLibCard');
    await page.keyboard.press('Enter');
    await page.waitForSelector('#savedOverlay.on');
    await idle(page);
    assert.equal(
      await page.evaluate(() => document.activeElement === document.querySelector('#savedOverlay > .ocard')),
      true,
      'the card: ' + (await active(page)),
    );
    await esc(page);
    assert.equal(await active(page), 'homeLibCard');
    assert.deepEqual(errors, []);
  });
}

// ---- from install-and-offline.test.mjs ----
// Installing and keeping work on the device: the Add to Home Screen card (iPhone Safari) and install prompt (Chrome),
// asking for persistent storage, and fonts served from the app itself.
{
  const IPHONE =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
  const KEY = 'ohuhu-hb320-picker-v3';
  const DAY = 864e5;
  // Safari in a tab says navigator.standalone === false; from the Home Screen it's true
  const safariTab = () => {
    Object.defineProperty(Navigator.prototype, 'standalone', { configurable: true, get: () => false });
  };
  const safariHomeScreen = () => {
    Object.defineProperty(Navigator.prototype, 'standalone', { configurable: true, get: () => true });
  };
  const displayStandalone = () => {
    Object.defineProperty(Navigator.prototype, 'standalone', { configurable: true, get: () => false });
    const mm = window.matchMedia.bind(window);
    window.matchMedia = (q) =>
      /display-mode:\s*standalone/.test(q)
        ? {
            matches: true,
            media: q,
            onchange: null,
            addEventListener() {},
            removeEventListener() {},
            addListener() {},
            removeListener() {},
          }
        : mm(q);
  };
  const onboarded = (extra = {}) => ({ 'ms-onboarded': '1', 'ms-setup-tip': '1', ...extra });
  // saved app state as the app writes it (the flags stop the one-off marker additions for older collections)
  const appState = (owned) =>
    JSON.stringify({ mode: 'home', ownedSeedV: 2, copicAdd1: 1, libAdj1: 1, setFix1: 1, owned, saved: [] });
  const collection = (extra = {}) =>
    onboarded({ [KEY]: appState(['Ohuhu|R014', 'Ohuhu|Y111', 'Ohuhu|B08']), ...extra });
  const stubPersist = () => {
    window.__persist = 0;
    const st = navigator.storage;
    st.persisted = () => Promise.resolve(false);
    st.persist = () => {
      window.__persist++;
      return Promise.resolve(true);
    };
  };
  test('iPhone Safari (not installed): Home suggests Add to Home Screen, and Not now hides it for a week', async () => {
    const { page, errors } = await openApp({ userAgent: IPHONE, init: safariTab, storage: onboarded() });
    await page.waitForSelector('#installCard', { state: 'visible' });
    const txt = await page.textContent('#installCard');
    assert.match(txt, /Add Marker Studio to your Home Screen/);
    assert.match(txt, /so your iPhone keeps your markers and guides/);
    assert.match(txt, /Tap the Share button/);
    assert.match(txt, /Add to Home Screen/);
    assert.doesNotMatch(txt, /Back up first/, 'nothing to carry over yet');
    assert.equal(await page.isVisible('#installCard [data-inst="go"]'), false, 'no install button on iPhone');
    await page.click('#installCard [data-inst="later"]');
    assert.equal(await page.isVisible('#installCard'), false);
    const until = await page.evaluate(() => +localStorage.getItem('ms-install-snooze'));
    assert.ok(Math.abs(until - (Date.now() + 7 * DAY)) < 60000, 'snoozed for 7 days');
    await page.reload();
    await idle(page);
    assert.equal(await page.isVisible('#installCard'), false, 'still hidden after a reload');
    // a week later it comes back
    await page.evaluate(() => {
      localStorage.setItem('ms-install-snooze', String(Date.now() - 1000));
      setMode('collection');
      setMode('home');
    });
    assert.ok(await page.isVisible('#installCard'));
    assert.deepEqual(errors, []);
  });
  test('iPhone Safari with work already made: the card suggests backing up first', async () => {
    const { page, errors } = await openApp({ userAgent: IPHONE, init: safariTab, storage: collection() });
    await page.waitForSelector('#installCard', { state: 'visible' });
    assert.match(await page.textContent('#installCard'), /Back up first/);
    assert.deepEqual(errors, []);
  });
  test('never shown once installed: Home Screen app on iPhone, or display-mode standalone', async () => {
    for (const init of [safariHomeScreen, displayStandalone]) {
      const { page, errors } = await openApp({ userAgent: IPHONE, init, storage: onboarded() });
      await idle(page);
      assert.equal(await page.isVisible('#installCard'), false, init.name);
      // an install prompt can't show it either
      await page.evaluate(() => {
        const e = new Event('beforeinstallprompt', { cancelable: true });
        e.prompt = () => Promise.resolve();
        e.userChoice = Promise.resolve({ outcome: 'accepted' });
        dispatchEvent(e);
      });
      assert.equal(await page.isVisible('#installCard'), false, init.name + ' + beforeinstallprompt');
      assert.deepEqual(errors, []);
    }
  });
  test('Chrome: beforeinstallprompt shows Install app, which opens the browser prompt', async () => {
    const { page, errors } = await openApp({ storage: onboarded() });
    await idle(page);
    assert.equal(await page.isVisible('#installCard'), false, 'nothing without an install prompt');
    const prevented = await page.evaluate(() => {
      window.__prompted = 0;
      const e = new Event('beforeinstallprompt', { cancelable: true });
      e.prompt = () => {
        window.__prompted++;
        return Promise.resolve();
      };
      e.userChoice = Promise.resolve({ outcome: 'accepted', platform: 'web' });
      dispatchEvent(e);
      return e.defaultPrevented;
    });
    assert.equal(prevented, true, 'the mini-infobar is held back so the card can offer it');
    await page.waitForSelector('#installCard', { state: 'visible' });
    assert.match(await page.textContent('#installCard'), /Install Marker Studio/);
    await page.click('#installCard [data-inst="go"]');
    assert.equal(await page.evaluate(() => window.__prompted), 1);
    await idle(page);
    assert.equal(await page.isVisible('#installCard'), false, 'a used prompt is gone');
    assert.equal(
      await page.evaluate(() => localStorage.getItem('ms-install-snooze')),
      null,
      'accepted: no snooze needed',
    );
    assert.deepEqual(errors, []);
  });
  test(
    'persistent storage is asked for when the collection is set up in the welcome, and on a first palette save',
    notOnWebKit(WK.storage),
    async () => {
      const { page, errors } = await openApp({ init: stubPersist });
      await haveSet(page);
      await page.check('#wcSets input[data-i="3"]');
      await idle(page);
      assert.equal(await page.evaluate(() => window.__persist), 0, 'not for ticking a set');
      assert.equal(await page.evaluate(() => localStorage.getItem('ms-first-use')), null);
      await page.click('#wcAdd');
      await idle(page);
      assert.equal(await page.evaluate(() => window.__persist), 1, 'asked after Add');
      assert.ok(
        +(await page.evaluate(() => localStorage.getItem('ms-first-use'))) > Date.now() - 60000,
        'first use noted',
      );
      await page.click('#wcLook');
      assert.equal(await page.isVisible('#backupNudge'), false, 'no reminder on day one');

      // someone who skipped the markers and saves a palette
      const b = await openApp({ init: stubPersist, storage: onboarded({ [KEY]: appState([]) }) });
      assert.equal(await b.page.evaluate(() => state.owned.size), 0);
      await b.page.click('#mPalette');
      await idle(b.page);
      await b.page.click('#draw');
      await idle(b.page, 1300);
      assert.equal(await b.page.evaluate(() => window.__persist), 0);
      await b.page.click('#saveBtn');
      await idle(b.page);
      assert.equal(await b.page.evaluate(() => state.saved.filter((s) => s.type === 'palette').length), 1);
      assert.equal(await b.page.evaluate(() => window.__persist), 1, 'asked after the palette save');
      assert.deepEqual([...errors, ...b.errors], []);
    },
  );
  test('fonts come from the app itself, not Google', async () => {
    const { page, errors } = await openApp();
    const reqs = [];
    page.on('request', (r) => reqs.push(r.url()));
    await page.reload();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() =>
      [...document.fonts].some((f) => f.family.replace(/"/g, '') === 'Fraunces' && f.status === 'loaded'),
    );
    const st = await page.evaluate(() => ({
      fraunces: document.fonts.check('500 22px Fraunces'),
      hanken: document.fonts.check('600 13px "Hanken Grotesk"'),
      title: getComputedStyle(document.querySelector('.title')).fontFamily,
    }));
    assert.ok(st.fraunces && st.hanken, JSON.stringify(st));
    assert.ok(
      reqs.some((u) => /\/src\/assets\/fonts\/fraunces-latin-opsz-normal\.woff2$/.test(u)),
      'Fraunces from the same origin',
    );
    assert.ok(
      reqs.some((u) => /\/src\/assets\/fonts\/hanken-grotesk-latin-wght-normal\.woff2$/.test(u)),
      'Hanken Grotesk from the same origin',
    );
    assert.ok(!reqs.some((u) => /fonts\.(googleapis|gstatic)\.com/.test(u)), 'nothing from Google Fonts');
    assert.ok(
      reqs.every(
        (u) => u.startsWith(new URL(page.url()).origin) || u.startsWith('data:') || u.startsWith('blob:'),
      ),
      'no off-origin requests at all: ' +
        reqs.filter((u) => !u.startsWith(new URL(page.url()).origin)).join(', '),
    );
    assert.deepEqual(errors, []);
  });
}

// ---- from keyboard-and-screen-readers.test.mjs ----
// Keyboard and screen readers in the guide and the shell: where focus goes after a dialog, a marker picker or a change
// of stage, Ctrl+Z and Escape behind sheets, tabs and segments, and what screen readers hear (no glyphs, emoji or
// arrows read out). Escape one layer at a time is in escape-stack-guide and escape-stack-shell.
{
  // ---- From the fourth review (v263 guide screen) ----
  const rect = (page, sel) =>
    page.evaluate((s) => {
      const e = document.querySelector(s);
      return e ? e.getBoundingClientRect().toJSON() : null;
    }, sel);
  // a real mouse tap where the element is on the screen now (no scrolling it into view first)
  async function tapAt(page, sel) {
    const r = await rect(page, sel);
    await page.mouse.click(r.x + r.width / 2, r.y + r.height / 2);
  }
  const active = (page) =>
    page.evaluate(() => {
      const a = document.activeElement;
      return a ? a.id || a.className || a.tagName : null;
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
  // ---- From the fifth review (outside the guide screen) ----
  const KEY = 'ohuhu-hb320-picker-v3';
  const onboarded = (extra = {}) => ({
    'ms-onboarded': '1',
    'ms-setup-tip': '1',
    'ms-last-ver': 'v265',
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
  // ---- From the third full review (v259) ----
  test('the marker picker closes with Escape and starts with focus inside it', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await page.click('.sftabbtn[data-t="pattern"]');
    await page.click('#sfFam [data-v="manual"]');
    await idle(page);
    const l = await page.evaluate(() => __mstest.assignData.order[4]);
    await scrollTop(page);
    const p = await sectionPoint(page, l);
    await page.mouse.click(p.x, p.y);
    await page.waitForSelector('#sfSheet', { state: 'visible' });
    await idle(page);
    assert.ok(
      await page.evaluate(() => document.getElementById('sfSheet').contains(document.activeElement)),
      'focus is in the picker',
    );
    await page.keyboard.press('Escape');
    await idle(page);
    assert.ok(!(await page.isVisible('#sfSheet')));
    assert.deepEqual(errors, []);
  });
  test('closing a dialog with Escape gives focus back to what opened it', async () => {
    const { page, errors } = await openApp();
    await welcome(page, 'look');
    await page.focus('#homeLibCard');
    await page.keyboard.press('Enter');
    await idle(page);
    assert.ok(
      await page.evaluate(() => savedOverlay.contains(document.activeElement)),
      'focus moved into the Library',
    );
    await page.keyboard.press('Escape');
    await idle(page);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'homeLibCard');
    assert.deepEqual(errors, []);
  });
  test("from the keyboard a change of stage moves focus to the new stage's first control", async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await page.focus('#sfColor');
    await page.keyboard.press('Enter');
    await idle(page);
    assert.ok(
      await page.evaluate(() => document.getElementById('sfCtl').contains(document.activeElement)),
      'focus in Colour along: ' + (await active(page)),
    );
    await page.focus('#sfDoneBtn');
    await page.keyboard.press('Enter');
    await idle(page);
    assert.ok(
      await page.evaluate(
        () =>
          document.activeElement.classList.contains('sftabbtn') &&
          document.activeElement.getAttribute('aria-selected') === 'true',
      ),
      'focus on the chosen tab: ' + (await active(page)),
    );
    // a tap doesn't move focus anywhere
    await tapAt(page, '#sfColor');
    await idle(page);
    assert.equal(
      await page.evaluate(() => document.getElementById('sfCtl').contains(document.activeElement)),
      false,
    );
    assert.deepEqual(errors, []);
  });
  test('closing a marker picker puts focus back, never on the page itself', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    const [l, l2] = await bigSections(page, 2);
    // Change colour from the tip with the keyboard: Escape brings the tip back with Change colour focused
    await scrollTop(page);
    await tapSection(page, l);
    await page.focus('.sftip [data-a="change"]');
    await page.keyboard.press('Enter');
    await page.waitForSelector('#sfSheet.sfpicksh');
    await idle(page);
    await page.keyboard.press('Escape');
    await idle(page);
    assert.equal(
      await page.evaluate(() => document.activeElement.dataset.a),
      'change',
      'Change colour in the tip again: ' + (await active(page)),
    );
    // with the mouse: Done, then focus on ⋯ rather than <body>
    await page.keyboard.press('Escape');
    await scrollTop(page);
    await tapSection(page, l2);
    await page.click('.sftip [data-a="change"]');
    await page.waitForSelector('#sfSheet.sfpicksh');
    await page.click('#sfPopConfirm');
    await idle(page);
    assert.notEqual(await active(page), 'BODY');
    // the Paint brush picker: back on the brush
    await page.click('.sftabbtn[data-t="pattern"]');
    await page.click('#sfFam [data-v="manual"]');
    await idle(page);
    await page.click('#sfPaint');
    await page.click('#sfBrush');
    await page.waitForSelector('#sfSheet.sfpicksh');
    await page.click('#sfPopCancel');
    await idle(page);
    assert.equal(await active(page), 'sfBrush');
    // Manual: a tap on a section opens the picker straight away
    await page.click('#sfPaint');
    await scrollTop(page);
    await tapSection(page, l);
    await page.waitForSelector('#sfSheet.sfpicksh');
    await page.click('#sfPopCancel');
    await idle(page);
    assert.notEqual(await active(page), 'BODY');
    // Blend's anchor menu
    await page.click('.sftabbtn[data-t="pattern"]');
    await page.click('#sfFam [data-v="blend"]');
    await idle(page);
    await scrollTop(page);
    const a = await page.evaluate(() => {
      const c = document.getElementById('sfCanvas'),
        r = c.getBoundingClientRect(),
        p = __mstest.anchors[0];
      return { x: r.left + (p.x / c.width) * r.width, y: r.top + (p.y / c.height) * r.height };
    });
    await page.mouse.click(a.x, a.y);
    await page.waitForSelector('#sfSheet.sfpicksh');
    await page.keyboard.press('Escape');
    await idle(page);
    assert.notEqual(await active(page), 'BODY');
    assert.deepEqual(errors, []);
  });
  test('Escape closes only a dialog open over full screen; Ctrl+Z does nothing behind an open sheet', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await page.click('#sfFull');
    await idle(page);
    await page.evaluate(() => document.getElementById('savedOverlay').classList.add('on'));
    await idle(page);
    await page.keyboard.press('Escape');
    await idle(page);
    assert.equal(
      await page.evaluate(() => document.getElementById('savedOverlay').classList.contains('on')),
      false,
      'the dialog closed',
    );
    assert.equal(
      await page.evaluate(() => document.getElementById('sfRoot').classList.contains('sffull')),
      true,
      'still full screen',
    );
    await page.keyboard.press('Escape');
    await idle(page);
    assert.equal(
      await page.evaluate(() => document.getElementById('sfRoot').classList.contains('sffull')),
      false,
    );
    // Ctrl+Z with the ⋯ menu open
    await page.click('.sftabbtn[data-t="pattern"]');
    await page.click('#sfVary');
    await idle(page);
    const n = await page.evaluate(() => __mstest.planCount);
    assert.ok(n > 0);
    await page.click('#sfMore');
    await page.waitForSelector('#sfSheet');
    await page.keyboard.press('Control+z');
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.planCount), n, 'nothing undone behind the sheet');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Control+z');
    await idle(page);
    assert.equal(
      await page.evaluate(() => __mstest.planCount),
      n - 1,
      'and it undoes once the sheet is closed',
    );
    assert.deepEqual(errors, []);
  });
  test('tabs: arrow keys move between them, one tab stop, panels labelled by their tab; segments say which is on', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await page.focus('.sftabbtn[aria-selected="true"]');
    const t0 = await page.evaluate(() => document.activeElement.dataset.t);
    await page.keyboard.press('ArrowRight');
    await idle(page);
    const st = await page.evaluate(() => ({
      f: document.activeElement.dataset.t,
      sel: document.querySelector('.sftabbtn[aria-selected="true"]').dataset.t,
      stops: [...document.querySelectorAll('.sftabbtn')].map((b) => b.tabIndex),
    }));
    assert.notEqual(st.f, t0);
    assert.equal(st.sel, st.f, 'the focused tab is chosen');
    assert.deepEqual(st.stops.filter((x) => x === 0).length, 1, 'one tab stop');
    await page.keyboard.press('End');
    assert.equal(await page.evaluate(() => document.activeElement.dataset.t), 'share');
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.evaluate(() => document.activeElement.dataset.t), 'colours', 'wraps round');
    await page.keyboard.press('ArrowLeft');
    assert.equal(await page.evaluate(() => document.activeElement.dataset.t), 'share');
    const panels = await page.$$eval('.sftab', (p) =>
      p.map((x) => [
        x.getAttribute('role'),
        document.getElementById(x.getAttribute('aria-labelledby'))?.dataset.t === x.dataset.tab,
      ]),
    );
    assert.deepEqual(panels, [
      ['tabpanel', true],
      ['tabpanel', true],
      ['tabpanel', true],
      ['tabpanel', true],
    ]);
    // every chosen segment in every tab says so; the rest say they're not
    for (const t of ['colours', 'pattern', 'shading']) {
      await page.click(`.sftabbtn[data-t="${t}"]`);
      const seg = await page.$$eval(`#sfPanel-${t} [role="group"] .sfedit`, (b) =>
        b.map((x) => [x.classList.contains('on'), x.getAttribute('aria-pressed')]),
      );
      assert.ok(seg.length >= 3 && seg.every(([on, p]) => p === String(on)), `${t}: ${JSON.stringify(seg)}`);
    }
    await answerAsks(page);
    await page.click('#sfBack2');
    await idle(page);
    await page.click('#sfEmMerge');
    assert.deepEqual(
      await page.$$eval('#sfEdit button', (b) => b.map((x) => x.getAttribute('aria-pressed'))),
      ['false', 'true', 'false', 'false'],
    );
    assert.deepEqual(errors, []);
  });
  // ---- From the fifth review (guide screen) ----
  test('screen readers: glyphs are not read out, and a tone line says base and shadow in words', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await page.click('.sftabbtn[data-t="share"]');
    await idle(page);
    for (const name of ['Reveal & share', 'Blend plan'])
      assert.equal(await page.getByRole('button', { name, exact: true }).count(), 1, name);
    await page.click('.sftabbtn[data-t="pattern"]');
    await idle(page);
    assert.equal(await page.getByRole('button', { name: 'Shuffle', exact: true }).count(), 1, 'Shuffle');
    // shading on: the tone line of each row in Colour along
    await page.click('.sftabbtn[data-t="shading"]');
    await page.evaluate(() => __mstest.shadeTo('full'));
    await idle(page);
    await page.click('#sfColor');
    await idle(page);
    const t = await page.$eval('#sfAlist .sfarow .sfatones', (e) => ({
      vis: e.querySelector('[aria-hidden="true"]')?.textContent,
      sr: e.querySelector('.sfsr')?.textContent,
    }));
    assert.match(t.vis, /B \S+/);
    assert.match(t.sr, /base \S+, shadow/);
    const k = await page.$eval('#sfAlist .sfarow', (r) => r.dataset.k);
    await page.click(`#sfAlist .sfarow[data-k="${k}"] .sfah`);
    await idle(page);
    assert.equal(
      await page.getByRole('button', { name: 'Mark all done', exact: true }).count(),
      1,
      'Mark all done',
    );
    // focus mode's buttons and its tone line
    await page.click('#sfFocus');
    await idle(page);
    assert.equal(await page.getByRole('button', { name: 'Done', exact: true }).count(), 1, 'Done');
    assert.equal(await page.getByRole('button', { name: 'Skip', exact: true }).count(), 1, 'Skip');
    const fs = await page.$eval('#sfFocSub', (e) => ({
      txt: e.textContent,
      sr: e.querySelector('.sfsr')?.textContent || '',
    }));
    assert.match(fs.sr + fs.txt, /base \S+/);
    const sub = await rect(page, '#sfFocSub');
    assert.ok(sub.height > 0 && sub.height < 80, 'the second line keeps its size');
    assert.deepEqual(errors, []);
  });
  test('Home, Markers and the shell: emoji and arrows are not read out', async () => {
    const { page, errors } = await openApp({ storage: onboarded({ [KEY]: appState() }) });
    assert.equal(
      await page.$$eval('.hcicon', (l) => l.every((x) => x.getAttribute('aria-hidden') === 'true')),
      true,
    );
    await page.click('#mCollection');
    assert.equal(await page.getByRole('button', { name: 'Match a colour', exact: true }).count(), 1);
    // (v311: + Add markers, its + not read out)
    assert.equal(await page.getByRole('button', { name: 'Add markers', exact: true }).count(), 1);
    await page.click('#mkDrawBtn');
    assert.equal(
      await page.getByRole('button', { name: 'Markers', exact: true }).count(),
      2,
      'the tab and ← Markers',
    );
    assert.deepEqual(errors, []);
  });
}
