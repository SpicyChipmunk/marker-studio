// Markers: the grid, details, sets, To buy, the swatch chart, dry and running low.
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
  longPress,
  notOnWebKit,
  openApp,
  openAtScale,
  sampleGuide,
  saveArtifact,
  saveGuide,
  scanFromMarkers,
  scrollTop,
  sectionPoint,
  setup,
  shot,
  teardown,
  welcome,
} from './helpers.mjs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

before(setup);
after(teardown);

// ---- from markers.test.mjs ----
// The Markers screen: ticking markers in place, details on press and hold and by keyboard, the marker sheet, the tick
// wording, and the ⓘ hint above the grid.
{
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
  // ---- From the fifth review (outside the guide screen) ----
  const onboardedV265 = (extra = {}) => ({
    'ms-onboarded': '1',
    'ms-setup-tip': '1',
    'ms-last-ver': 'v265',
    ...extra,
  });
  // ---- From v265 ----
  const OWN3 = ['Ohuhu|R014', 'Ohuhu|Y111', 'Ohuhu|B08'];
  const appState3 = (extra = {}) =>
    JSON.stringify({
      mode: 'home',
      ownedSeedV: 2,
      copicAdd1: 1,
      libAdj1: 1,
      setFix1: 1,
      owned: OWN3,
      saved: [],
      ...extra,
    });
  const onboardedNoVer = (extra = {}) => ({ 'ms-onboarded': '1', 'ms-setup-tip': '1', ...extra });
  // ---- v284: search beyond the view, true colours in All, and the way down to the tools ----
  const inkOf = (page) =>
    page.evaluate(() => {
      const s = document.createElement('span');
      s.style.color = 'var(--ink)';
      document.body.appendChild(s);
      const c = getComputedStyle(s).color;
      s.remove();
      return c;
    });
  // a code that finds exactly one marker, which you don't own (for "isn’t in your collection")
  const loneUnowned = (page) =>
    page.evaluate(
      () =>
        COLORS.map((c, i) => [c.code, i]).find(
          ([code, i]) =>
            !isOwned(i) &&
            COLORS.filter((m) =>
              (m.code + ' ' + m.name + ' ' + (m.old || '')).toLowerCase().includes(code.toLowerCase()),
            ).length === 1,
        )[0],
    );
  // ---- From UX release 1 (v260) ----
  test('Markers: unticking keeps the marker in place until the list is redrawn; press and hold shows its details', async () => {
    const { page, errors } = await openApp();
    await welcome(page, 'look');
    await page.click('#mCollection');
    await idle(page);
    const order = () =>
      page.evaluate(() =>
        [...document.querySelectorAll('#results .cell')].slice(0, 6).map((c) => +c.dataset.i),
      );
    const before = await order();
    await page.click(`#results .cell[data-i="${before[1]}"]`);
    await idle(page);
    assert.deepEqual(await order(), before, 'nothing moved');
    // (the idle() after the tap has already let any long-press timer run out, so the details would be open by now)
    assert.ok(!(await page.isVisible('#mkOverlay')), 'a quick tap does not open the details');
    assert.ok(
      await page.evaluate(
        (i) => document.querySelector(`#results .cell[data-i="${i}"]`).classList.contains('notown'),
        before[1],
      ),
      'shown as unticked',
    );
    assert.equal(await page.evaluate((i) => isOwned(i), before[1]), false);
    // tapping it again ticks it back, still in place
    await page.click(`#results .cell[data-i="${before[1]}"]`);
    await idle(page);
    assert.equal(await page.evaluate((i) => isOwned(i), before[1]), true);
    // untick, then a search redraws the list without it
    await page.click(`#results .cell[data-i="${before[2]}"]`);
    await idle(page);
    await page.fill('#q', 'r');
    await page.fill('#q', '');
    await idle(page);
    assert.ok(!(await order()).includes(before[2]), 'gone after the list is redrawn');
    // press and hold opens the details sheet
    const box = await page.locator(`#results .cell[data-i="${before[0]}"]`).boundingBox();
    await longPress(page, box.x + box.width / 2, box.y + box.height / 2);
    await idle(page);
    assert.ok(await page.isVisible('#mkOverlay'), 'details open');
    assert.equal(await page.evaluate((i) => isOwned(i), before[0]), true, 'holding did not untick it');
    const code = await page.textContent('#mkCode');
    assert.match(code, /Ohuhu /);
    await page.click('#mkOwn');
    await idle(page);
    assert.equal(await page.evaluate((i) => isOwned(i), before[0]), false, 'the switch unticks it');
    await page.click('#mkSimilar');
    await idle(page);
    assert.ok(await page.isVisible('#matchOverlay'), 'Find similar opens Match a colour');
    assert.ok(
      await page.evaluate(() => document.getElementById('matchResult').textContent.length > 20),
      'with results for that colour',
    );
    assert.deepEqual(errors, []);
  });
  test('marker sheet: after ticking "In my collection", closing it returns focus to the marker', async () => {
    const { page, errors } = await openApp({
      storage: onboarded({ [KEY]: appState({ mode: 'collection' }) }),
    });
    const i = await page.evaluate(() => +document.querySelector('#results .cell').dataset.i);
    await page.focus(`#results .cell[data-i="${i}"]`);
    await page.evaluate((i) => openMarkerSheet(i), i);
    await page.waitForSelector('#mkOverlay.on');
    await page.click('#mkOwn');
    await idle(page);
    await page.keyboard.press('Escape');
    await idle(page);
    assert.equal(
      await page.evaluate(() => document.activeElement.dataset && document.activeElement.dataset.i),
      String(i),
    );
    assert.deepEqual(errors, []);
  });
  test('Markers: tick wording, "Showing" or "Matches", and the keyboard way to details', async () => {
    const { page, errors } = await openApp({
      storage: onboardedV265({ [KEY]: appState({ collView: 'all' }) }),
    });
    await page.click('#mCollection');
    await page.waitForSelector('#ownAll', { state: 'visible' });
    assert.equal(await page.textContent('#ownAll'), 'Tick all shown');
    await page.click('#mkMore');
    assert.equal(await page.textContent('#ownNone'), 'Untick all shown');
    await page.click('#ownNone');
    assert.equal(await page.isVisible('#mkMenu'), true, 'the first tap asks in the menu, which stays open');
    assert.match(await page.textContent('#ownNone'), /^Untick \d+ markers?\? Tap again$/);
    // (the heading's words: without Copy codes and the ⋯ menu beside it, v289)
    const head = async () =>
      page.$eval('#findResults .pile-head', (h) => {
        const c = h.cloneNode(true);
        c.querySelectorAll('.copybtn, .mkmore').forEach((e) => e.remove());
        return c.textContent.trim();
      });
    assert.match(await head(), /^Showing \d+ markers$/);
    await page.fill('#q', 'blue');
    await idle(page);
    assert.match(await head(), /^Matches\s*\(\d+ markers\)$/);
    await page.fill('#q', '');
    await page.evaluate(() => {
      fgTap('brand', 'Copic');
      filterChanged();
    });
    assert.match(await head(), /^Matches/);
    assert.equal(await page.getAttribute('#results .cell', 'aria-description'), 'Shift+F10 for details');
    assert.doesNotMatch(await page.textContent('#mkHint'), /Shift\+F10/);
    await page.keyboard.press('Tab');
    await idle(page);
    assert.match(await page.textContent('#mkHint'), /Shift\+F10/);
    // and Shift+F10 on a cell opens its details
    await page.focus('#results .cell');
    await page.keyboard.press('Shift+F10');
    await page.waitForSelector('#mkOverlay.on');
    assert.deepEqual(errors, []);
  });
  test('Markers: the ⓘ hint above the grid, in full the first time, then one line that opens; mouse and touch wording', async () => {
    const { page, errors } = await openApp({
      storage: onboardedNoVer({ [KEY]: appState3(), 'ms-seen-hints': '["along"]' }),
    });
    await page.click('#mCollection');
    await page.waitForSelector('#mkHint .sfinfo');
    const hint = '#mkHint .sfinfo';
    assert.equal(
      (await page.textContent(hint)).trim(),
      'iTap a marker to tick or untick it. Right-click for details.',
      'a mouse: right-click',
    );
    assert.equal(await page.getAttribute(hint, 'aria-expanded'), 'true');
    const r = await page.evaluate(() => [
      document.getElementById('mkHint').getBoundingClientRect().bottom,
      document.querySelector('#results .cell').getBoundingClientRect().top,
    ]);
    assert.ok(r[0] <= r[1], 'above the grid');
    assert.deepEqual(
      await page.evaluate(() => JSON.parse(localStorage.getItem('ms-seen-hints'))),
      ['along', 'mk-tick'],
      'one list with the guide’s',
    );
    // still in full for the rest of this visit
    await page.click('#mHome');
    await page.click('#mCollection');
    assert.equal(await page.getAttribute(hint, 'aria-expanded'), 'true');
    // the next visit: one line, which opens and closes
    await page.reload();
    await page.click('#mCollection');
    await page.waitForSelector(hint);
    assert.equal(await page.getAttribute(hint, 'aria-expanded'), 'false');
    assert.equal((await page.textContent(hint)).trim(), 'iTap to tick · right-click for details');
    await page.click(hint);
    assert.equal(await page.getAttribute(hint, 'aria-expanded'), 'true');
    assert.match(
      await page.textContent(hint),
      /Tap a marker to tick or untick it\. Right-click for details\./,
    );
    await page.click(hint);
    assert.equal(await page.getAttribute(hint, 'aria-expanded'), 'false');
    // a tap on the hint doesn't tick anything
    assert.equal(await page.evaluate(() => state.owned.size), OWN3.length);
    // not on other screens
    await page.click('#mPalette');
    assert.equal(await page.isVisible('#mkHint'), false);
    assert.deepEqual(errors, []);

    // a touch screen: press and hold
    const touch = () => {
      const mm = window.matchMedia.bind(window);
      window.matchMedia = (q) =>
        /pointer:\s*fine/.test(q)
          ? {
              matches: false,
              media: q,
              addEventListener() {},
              removeEventListener() {},
              addListener() {},
              removeListener() {},
            }
          : /pointer:\s*coarse/.test(q)
            ? {
                matches: true,
                media: q,
                addEventListener() {},
                removeEventListener() {},
                addListener() {},
                removeListener() {},
              }
            : mm(q);
    };
    const b = await openApp({ init: touch, storage: onboardedNoVer({ [KEY]: appState3() }) });
    await b.page.click('#mCollection');
    await b.page.waitForSelector(hint);
    assert.equal(
      (await b.page.textContent(hint)).trim(),
      'iTap a marker to tick or untick it. Press and hold (or right-click) for details.',
    );
    await b.page.reload();
    await b.page.click('#mCollection');
    await b.page.waitForSelector(hint);
    assert.equal((await b.page.textContent(hint)).trim(), 'iTap to tick · press and hold for details');
    assert.deepEqual(b.errors, []);
  });
  test('Markers: a search in Owned says how many more are in All, with Show; one that only All has says so', async () => {
    const { page, errors } = await openApp({
      storage: onboardedV265({ [KEY]: appState({ collView: 'owned' }) }),
    });
    await page.click('#mCollection');
    await idle(page);
    await page.fill('#q', 'r0');
    await idle(page);
    const outside = await page.evaluate(() => COLORS.filter((c, i) => avail(i) && !isOwned(i)).length);
    assert.ok(outside > 1 && (await page.locator('#results .cell').count()) > 0, 'some owned, more not');
    assert.equal(
      (await page.textContent('#results .moreall')).replace(/\s+/g, ' ').trim(),
      outside + ' more in All · Show',
    );
    const box = await page.locator('#results .moreall').boundingBox(),
      last = await page.locator('#results .cell').last().boundingBox();
    assert.ok(box.y >= last.y + last.height, 'under the results');
    // Show: All, with the same search
    await page.click('#results .moreshow');
    await idle(page);
    assert.equal(await page.evaluate(() => state.collView), 'all');
    assert.equal(await page.inputValue('#q'), 'r0', 'the search stays');
    assert.equal(await page.locator('#results .moreall').count(), 0, 'nothing more to show in All');
    assert.equal(
      await page.evaluate(() => document.activeElement.dataset.v),
      'all',
      'focus on All, which says it is chosen',
    );
    // a code only All has: said plainly, with the same Show
    await page.click('#ownView [data-v="owned"]');
    await idle(page);
    const code = await loneUnowned(page);
    await page.fill('#q', code);
    await idle(page);
    assert.equal(await page.locator('#results .cell').count(), 0);
    assert.equal(await page.textContent('#results .empty'), code + ' isn’t in your collection.');
    assert.equal(
      (await page.textContent('#results .moreall')).replace(/\s+/g, ' ').trim(),
      '1 in All · Show',
    );
    assert.equal(await page.getAttribute('#results .moreshow', 'aria-label'), 'Show it in All');
    await page.click('#results .moreshow');
    await idle(page);
    assert.equal(await page.locator('#results .cell').count(), 1, 'there it is');
    // Unowned: a marker you have says so
    await page.click('#ownView [data-v="unowned"]');
    await page.fill('#q', 'Y111');
    await idle(page);
    assert.equal(await page.textContent('#results .empty'), 'Y111 is already in your collection.');
    // nothing anywhere: as before, no Show
    await page.fill('#q', 'zzzz');
    await idle(page);
    assert.match(await page.textContent('#results .empty'), /^No markers match “zzzz”/);
    assert.equal(await page.locator('#results .moreall').count(), 0);
    assert.deepEqual(errors, []);
  });
  test('Markers: the search’s ✕ shows only with text, clears it and keeps the keyboard in the field', async () => {
    const { page, errors } = await openApp({
      storage: onboardedV265({ [KEY]: appState({ collView: 'all' }) }),
    });
    await page.click('#mCollection');
    await idle(page);
    assert.equal(await page.isVisible('#qClear'), false, 'nothing to clear');
    const all = await page.locator('#results .cell').count();
    await page.fill('#q', 'blue');
    await idle(page);
    assert.ok(await page.isVisible('#qClear'));
    assert.equal(await page.getAttribute('#qClear', 'aria-label'), 'Clear search');
    const b = await page.locator('#qClear').boundingBox(),
      q = await page.locator('#q').boundingBox();
    assert.ok(b.width >= 44 && b.height >= 44, 'a 44px tap area');
    assert.ok(
      b.x >= q.x && b.x + b.width <= q.x + q.width && b.y >= q.y && b.y + b.height <= q.y + q.height,
      'inside the field',
    );
    assert.ok((await page.locator('#results .cell').count()) < all);
    await page.click('#qClear');
    await idle(page);
    assert.equal(await page.inputValue('#q'), '');
    assert.equal(await page.locator('#results .cell').count(), all, 'every marker again');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'q');
    assert.equal(await page.isVisible('#qClear'), false);
    assert.deepEqual(errors, []);
  });
  // (v323) the tiles as swatches: the ink fills an owned tile and sits inset in an unowned one's dashed edge, a second
  // coat on its right; the code on the ink in dark or white, whichever reads better on that colour
  test('Markers › All: markers you don’t own keep their true colour, inset in a dashed edge; owned fill the tile and keep the tick; codes read on the ink', async () => {
    const { page, errors } = await openApp({
      storage: onboardedV265({ [KEY]: appState({ collView: 'all' }) }),
    });
    await page.click('#mCollection');
    await idle(page);
    const look = (sel) =>
      page.$eval(sel, (c) => {
        const cs = getComputedStyle(c),
          sq = c.querySelector('.sq'),
          cr = c.getBoundingClientRect(),
          sr = sq.getBoundingClientRect(),
          cc = getComputedStyle(c.querySelector('.cc'));
        return {
          op: +cs.opacity,
          edge: cs.borderTopStyle,
          sq: getComputedStyle(sq).backgroundColor,
          coat: getComputedStyle(sq, '::after').backgroundColor,
          hex: COLORS[+c.dataset.i].hex,
          want: txt(COLORS[+c.dataset.i].hex),
          code: cc.color,
          tick: !!c.querySelector('.owncheck'),
          inset: Math.round(sr.left - cr.left - parseFloat(cs.borderLeftWidth)),
        };
      });
    const rgb = (h) =>
      h === '#fff'
        ? 'rgb(255, 255, 255)'
        : 'rgb(' + [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16)).join(', ') + ')';
    const un = await look('#results .cell.notown'),
      own = await look('#results .cell.own');
    assert.equal(un.op, 1, 'not faded');
    assert.equal(un.sq, rgb(un.hex), 'its true colour');
    assert.equal(un.edge, 'dashed');
    assert.equal(un.tick, false);
    assert.equal(un.inset, 4, 'inset in its dashed edge');
    assert.equal(own.edge, 'solid');
    assert.equal(own.tick, true, 'the tick as before');
    assert.equal(own.inset, 0, 'an owned one fills its tile');
    assert.equal(own.code, rgb(own.want), 'dark or white, by contrast');
    assert.equal(un.code, rgb(un.want));
    assert.notEqual(own.coat, own.sq, 'a second coat, darker');
    // every code reads on its ink: 4.3:1 at worst (the few markers neither colour reads well on get a halo, swweak)
    const worst = await page.$$eval('#results .cell.sw2', (cs) =>
      Math.min(
        ...cs.map((c) => {
          const h = COLORS[+c.dataset.i].hex,
            y = relLum(h),
            t = relLum(txt(h) === '#fff' ? '#ffffff' : txt(h));
          return (Math.max(y, t) + 0.05) / (Math.min(y, t) + 0.05);
        }),
      ),
    );
    assert.ok(worst >= 4.3, 'contrast ' + worst.toFixed(2));
    assert.deepEqual(errors, []);
  });
  // (v311: Add markers at the top; the link goes down to Brands I'd buy and Print a swatch chart. v318.33: both buttons in
  // the tools row, Swatch chart without its arrow)
  test('Markers: Add markers and a link to the swatch chart near the top; the bulk buttons stand clear, Untick in ⋯ at full contrast', async () => {
    const { page, errors } = await openApp({
      storage: onboardedV265({ [KEY]: appState({ collView: 'all' }) }),
    });
    await page.click('#mCollection');
    await idle(page);
    assert.ok((await page.locator('#mkAddBtn').boundingBox()).y < 844, 'Add markers on the first screen');
    assert.equal((await page.textContent('#mkJump')).trim(), 'Swatch chart');
    assert.ok((await page.locator('#mkJump').boundingBox()).y < 844, 'on the first screen');
    assert.ok(
      await page.evaluate(() => document.getElementById('presetWrap').getBoundingClientRect().top > 3000),
      'the tools are far down',
    );
    await page.click('#mkJump');
    await idle(page);
    const inView = (sel) =>
      page.$eval(sel, (e) => {
        const r = e.getBoundingClientRect();
        return r.top >= 0 && r.bottom <= innerHeight;
      });
    // (the scroll is smooth: Safari's engine can still be on its way when the page is otherwise idle)
    await page
      .waitForFunction(
        () => {
          const r = document.getElementById('swatchBtn').getBoundingClientRect();
          return r.top >= 0 && r.bottom <= innerHeight;
        },
        null,
        { timeout: 5000 },
      )
      .catch(() => {});
    for (const sel of ['#buyOpen', '#swatchBtn']) assert.ok(await inView(sel), sel + ' in view');
    assert.equal(
      await page.evaluate(() => document.activeElement.id),
      'swatchBtn',
      'focus on Print a swatch chart',
    );
    // Tick / Untick all shown: clear of the last swatch, and Untick not faint
    const gap = await page.evaluate(() => {
      const c = [...document.querySelectorAll('#results .cell')].pop().getBoundingClientRect();
      return document.getElementById('ownStateWrap').getBoundingClientRect().top - c.bottom;
    });
    assert.ok(gap >= 20, 'space above the bulk buttons: ' + gap);
    await page.click('#mkMore');
    const un = await page.$eval('#ownNone', (b) => ({
      op: +getComputedStyle(b).opacity,
      c: getComputedStyle(b).color,
    }));
    assert.deepEqual(un, { op: 1, c: await inkOf(page) });
    // not on other screens; with no markers yet, the ways to add are in a card at the top, and no Add markers
    await page.click('#mPalette');
    assert.equal(await page.isVisible('#mkJump'), false);
    await page.evaluate(() => {
      state.owned.clear();
      save();
    });
    await page.click('#mCollection');
    await idle(page);
    assert.equal((await page.textContent('#mkJump')).trim(), 'Swatch chart');
    assert.equal(await page.isVisible('#mkAddBtn'), false);
    assert.ok(await page.isVisible('#mkAddCard'));
    await page.click('#mkJump');
    await idle(page);
    await page
      .waitForFunction(
        () => {
          const r = document.getElementById('swatchBtn').getBoundingClientRect();
          return r.top >= 0 && r.bottom <= innerHeight;
        },
        null,
        { timeout: 5000 },
      )
      .catch(() => {});
    assert.ok(await inView('#swatchBtn'));
    assert.deepEqual(errors, []);
  });
  test('Markers at 320 wide and 1.6x text: the search’s ✕, "more in All" and the link fit without sideways scroll', async () => {
    const { page, errors } = await openAtScale(1.6, {
      width: 320,
      height: 700,
      storage: onboardedV265({ [KEY]: appState({ collView: 'owned' }) }),
    });
    await page.click('#mCollection');
    await page.fill('#q', 'r0');
    await idle(page);
    const m = await page.evaluate(() => {
      const q = document.getElementById('q'),
        x = document.getElementById('qClear').getBoundingClientRect(),
        more = document.querySelector('#results .moreall').getBoundingClientRect(),
        j = document.getElementById('mkJump');
      return {
        sw: document.documentElement.scrollWidth,
        iw: innerWidth,
        clear: x.right <= q.getBoundingClientRect().right + 0.5,
        more: more.right <= innerWidth,
        jump: j.scrollWidth <= j.clientWidth + 1 && j.getBoundingClientRect().right <= innerWidth,
      };
    });
    assert.deepEqual(m, { sw: m.iw, iw: m.iw, clear: true, more: true, jump: true });
    assert.deepEqual(errors, []);
  });
}

// ---- from swatch-chart.test.mjs ----
// Markers › Print a swatch chart: the sheet (which markers, order, labels, paper) with its page count, and the PDF it
// makes with the guide's PDF writer — a box per marker beside a strip of its screen colour, numbered, grouped by brand,
// with a registration mark in each corner of every page.
{
  const IPHONE =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
  // every console error and uncaught error on the page
  function watch(page, errors) {
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    return errors;
  }
  async function openChart(page) {
    await page.click('#mCollection');
    await idle(page);
    await page.click('#swatchBtn');
    await page.waitForSelector('#swOverlay.on');
  }
  const pick = async (page, k, v) => {
    await page.click(`#swOpts [data-k="${k}"][data-v="${v}"]`);
    await idle(page);
  };
  const summary = async (page) => (await page.textContent('#swSum')).trim();
  // the PDF's pages and page size, straight from the file
  function pdfInfo(bytes) {
    const s = bytes.toString('latin1'),
      box = s.match(/\/MediaBox\s*\[\s*0 0 ([\d.]+) ([\d.]+)\s*\]/);
    return {
      head: s.slice(0, 5),
      pages: (s.match(/\/Type \/Page\b(?!s)/g) || []).length,
      count: +(s.match(/\/Type \/Pages [^>]*\/Count (\d+)/) || [])[1],
      w: box && +box[1],
      h: box && +box[2],
    };
  }
  async function download(page) {
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.click('#swGo')]);
    return { name: dl.suggestedFilename(), bytes: await readFile(await dl.path()) };
  }
  // draw the chart's pages as the download would, and report the text on each and the colour at each corner mark
  function probe(page) {
    return page.evaluate(() => {
      const P = CanvasRenderingContext2D.prototype,
        of = P.fillText,
        log = [];
      P.fillText = function (t) {
        log.push({ cv: this.canvas, t: String(t) });
        return of.apply(this, arguments);
      };
      const pk = SF.pdfKit,
        pap = pk.paper(),
        g = swGeom(pap, swOpt.labels),
        pages = swLayout(swGroups(swList(swOpt.what), swOpt.order), g),
        k = pk.DPI / 25.4,
        out = [];
      try {
        pages.forEach((pg, i) => {
          const c = swDraw(pg, i, pages.length, g, { paper: pap, title: 'Swatch chart · test' }),
            x = c.getContext('2d');
          const at = (mx, my) =>
            Array.from(x.getImageData(Math.round(mx * k), Math.round(my * k), 1, 1).data.slice(0, 3));
          const q = g.R / 2,
            marks = [
              [g.m + q, g.m + q],
              [g.pw - g.m - q, g.m + q],
              [g.m + q, g.ph - g.m - q],
              [g.pw - g.m - q, g.ph - g.m - q],
            ].map((p) => at(p[0], p[1]));
          out.push({
            w: c.width,
            h: c.height,
            texts: log.filter((e) => e.cv === c).map((e) => e.t),
            marks,
            corner: at(g.m + 0.4, g.ph - g.m - 0.4),
            cells: pg.items
              .filter((it) => !it.h)
              .map((it) => ({
                no: it.no,
                code: COLORS[it.i].code,
                brand: COLORS[it.i].brand,
                x: it.x,
                y: it.y,
              })),
            heads: pg.items.filter((it) => it.h).map((it) => it.h + (it.cont ? ' (continued)' : '')),
          });
          c.width = 0;
        });
      } finally {
        P.fillText = of;
      }
      return { pages: out, g };
    });
  }
  test('the sheet opens from Markers and previews pages and markers for the collection and for a brand', async () => {
    const { page, errors } = await openApp();
    watch(page, errors);
    await welcome(page, 'look');
    await openChart(page);
    assert.equal(await page.isVisible('#swOverlay .dcard'), true);
    assert.equal(
      await page.getAttribute('#swOpts [data-k="what"][data-v="owned"]', 'aria-pressed'),
      'true',
      'My collection by default',
    );
    assert.equal(
      await page.getAttribute('#swOpts [data-k="order"][data-v="fam"]', 'aria-pressed'),
      'true',
      'colour family order by default',
    );
    assert.equal(
      await page.getAttribute('#swOpts [data-k="labels"][data-v="name"]', 'aria-pressed'),
      'true',
      'code + name by default',
    );
    const paper = await page.evaluate(() => localStorage.getItem('ms-paper') || SF.pdfKit.paper());
    assert.equal(
      await page.getAttribute(`#swOpts [data-k="paper"][data-v="${paper}"]`, 'aria-pressed'),
      'true',
      'the app’s paper choice',
    );
    const owned = await page.evaluate(() => state.owned.size);
    // (v309.1: Honolulu 120 comes with its Colorless Blender, which has its box like any marker)
    assert.equal(owned, 121);
    // Letter and A4 take 5 columns × 8 rows of boxes with names, 9 rows with codes only
    await pick(page, 'paper', 'letter');
    assert.equal(await summary(page), '4 pages · 121 markers');
    await pick(page, 'what', 'Copic');
    assert.equal(await summary(page), '9 pages · 358 markers');
    await pick(page, 'what', 'Ohuhu');
    assert.equal(await summary(page), '10 pages · 364 markers');
    await pick(page, 'labels', 'code');
    assert.equal(await summary(page), '9 pages · 364 markers', 'codes only fit more rows');
    await pick(page, 'paper', 'a5');
    const a5 = await page.evaluate(() => {
      const g = swGeom('a5', 'code');
      return { cols: g.cols, box: g.box };
    });
    assert.ok(a5.cols >= 3 && a5.box >= 16, 'pocket paper still has nib-sized boxes');
    assert.match(await summary(page), /^\d+ pages · 364 markers$/);
    assert.equal(
      await page.evaluate(() => localStorage.getItem('ms-paper')),
      'a5',
      'paper is the app’s shared print option',
    );
    // the sheet's own choices are remembered, apart from which markers (always your collection when it opens)
    await page.keyboard.press('Escape');
    await idle(page);
    assert.equal(await page.isVisible('#swOverlay'), false, 'Escape closes it');
    await page.click('#swatchBtn');
    await page.waitForSelector('#swOverlay.on');
    assert.equal(await page.getAttribute('#swOpts [data-k="what"][data-v="owned"]', 'aria-pressed'), 'true');
    assert.equal(await page.getAttribute('#swOpts [data-k="labels"][data-v="code"]', 'aria-pressed'), 'true');
    assert.equal(await page.getAttribute('#swOpts [data-k="paper"][data-v="a5"]', 'aria-pressed'), 'true');
    await page.click('#swClose');
    assert.deepEqual(errors, []);
  });
  test('with no markers to print, Download is off and the sheet says why', async () => {
    const { page, errors } = await openApp();
    watch(page, errors);
    await page.click('#wcSkip');
    await page.click('#wcLook');
    await idle(page);
    assert.equal(await page.evaluate(() => state.owned.size), 0);
    await openChart(page);
    assert.equal(await page.isDisabled('#swGo'), true);
    assert.match(await summary(page), /collection is empty/);
    assert.equal(await page.getAttribute('#swGo', 'aria-describedby'), 'swSum');
    await pick(page, 'what', 'wish');
    assert.equal(await page.isDisabled('#swGo'), true);
    assert.match(await summary(page), /To buy list is empty/);
    await pick(page, 'what', 'Ohuhu');
    assert.equal(await page.isDisabled('#swGo'), false, 'a whole brand can still be printed');
    assert.match(await summary(page), /· 364 markers$/);
    assert.deepEqual(errors, []);
  });
  test('the download is a PDF with the pages the sheet promised, on the chosen paper', async () => {
    const { page, errors } = await openApp();
    watch(page, errors);
    await welcome(page, 'look');
    await openChart(page);
    await pick(page, 'paper', 'letter');
    let d = await download(page);
    let info = pdfInfo(d.bytes);
    assert.equal(info.head, '%PDF-');
    assert.equal(info.pages, 4);
    assert.equal(info.count, 4); // (with the blender, v309.1)
    assert.deepEqual([info.w, info.h], [612, 792], 'Letter');
    assert.match(d.name, /^swatch-chart-my-collection-\d{4}-\d{2}-\d{2}\.pdf$/);
    await saveArtifact('swatch-chart-letter.pdf', d.bytes);
    await page.waitForFunction(() =>
      /downloaded/.test(document.getElementById('msToast')?.textContent || ''),
    );
    // a large set on A4, quickly
    await pick(page, 'what', 'Copic');
    await pick(page, 'paper', 'a4');
    const want = +(await summary(page)).match(/^(\d+) pages/)[1];
    const t0 = Date.now();
    d = await download(page);
    const ms = Date.now() - t0;
    info = pdfInfo(d.bytes);
    assert.equal(info.head, '%PDF-');
    assert.equal(info.pages, want, 'as many pages as the sheet said');
    assert.deepEqual([info.w, info.h], [595.28, 841.89], 'A4');
    assert.ok(ms < 20000, `358 markers took ${ms} ms`);
    assert.equal(await page.isDisabled('#swGo'), false, 'ready for another');
    assert.equal((await page.textContent('#swGo')).trim(), 'Download PDF');
    await saveArtifact('swatch-chart-a4-copic.pdf', d.bytes);
    assert.deepEqual(errors, []);
  });
  test('each page: a numbered box and screen colour for every marker, brand headings, header, footer and corner marks', async () => {
    const { page, errors } = await openApp();
    watch(page, errors);
    await welcome(page, 'look');
    // a To buy list with both brands, in code order
    const keys = await page.evaluate(() => {
      const o = COLORS.filter((c, i) => c.brand === 'Ohuhu' && !isOwned(i)).slice(0, 44),
        c = COLORS.filter((c) => c.brand === 'Copic').slice(0, 3);
      const ks = [...o, ...c].map((m) => m.brand + '|' + m.code);
      ks.forEach((k) => addWish(k, 'test', true));
      save();
      return ks;
    });
    await openChart(page);
    await pick(page, 'what', 'wish');
    await pick(page, 'order', 'code');
    await pick(page, 'paper', 'letter');
    assert.equal(await summary(page), '2 pages · 47 markers');
    const r = await probe(page);
    assert.equal(r.pages.length, 2);
    const cells = r.pages.flatMap((p) => p.cells);
    assert.deepEqual(
      cells.map((c) => c.no),
      keys.map((_, i) => i + 1),
      'boxes numbered 1…N through the chart',
    );
    assert.deepEqual(cells.map((c) => c.brand + '|' + c.code).sort(), [...keys].sort(), 'every marker once');
    const oh = cells.filter((c) => c.brand === 'Ohuhu').map((c) => c.code);
    assert.deepEqual(
      oh,
      [...oh].sort((a, b) => a.localeCompare(b, 'en', { numeric: true })),
      'code order',
    );
    assert.ok(
      cells.findIndex((c) => c.brand === 'Copic') > cells.findLastIndex((c) => c.brand === 'Ohuhu'),
      'grouped by brand',
    );
    assert.deepEqual(
      r.pages.map((p) => p.heads),
      [['Ohuhu'], ['Ohuhu (continued)', 'Copic']],
    );
    r.pages.forEach((p, i) => {
      for (const c of p.cells) {
        assert.ok(p.texts.includes(c.code), `p${i + 1}: ${c.code}`);
        assert.ok(p.texts.includes(String(c.no)), `p${i + 1}: box ${c.no}`);
      }
      assert.ok(p.texts.includes('Page ' + (i + 1) + ' of 2'), 'page x of y');
      assert.ok(p.texts.includes('Swatch chart · test'), 'header');
      assert.ok(p.texts.includes('Made with Marker Studio'));
      // three solid marks and a hollow one at the bottom right, on white paper
      assert.deepEqual(
        p.marks.slice(0, 3),
        [
          [0, 0, 0],
          [0, 0, 0],
          [0, 0, 0],
        ],
        `p${i + 1}: solid corner marks`,
      );
      assert.deepEqual(p.marks[3], [255, 255, 255], `p${i + 1}: hollow bottom-right mark`);
      assert.deepEqual(p.corner, [0, 0, 0]);
      // a regular grid: the columns line up and every box fits between the marks
      const xs = [...new Set(p.cells.map((c) => c.x.toFixed(2)))];
      assert.ok(xs.length <= r.g.cols);
      for (const c of p.cells)
        assert.ok(
          c.x >= r.g.m && c.x + r.g.cw <= r.g.pw - r.g.m + 0.01 && c.y >= r.g.top && c.y + r.g.box <= r.g.bot,
          `box ${c.no} inside the page`,
        );
    });
    assert.ok(r.g.box >= 16 && r.g.box <= 20, 'boxes a nib can fill');
    // names go with Code + name, not with Code only
    const name = await page.evaluate((k) => COLORS.find((c) => c.brand + '|' + c.code === k).name, keys[0]);
    assert.ok(r.pages[0].texts.includes(name));
    await pick(page, 'labels', 'code');
    assert.ok(!(await probe(page)).pages[0].texts.includes(name));
    assert.deepEqual(errors, []);
  });
  test('on a phone the chart goes to the share sheet, with a Share button when the tap has expired', async () => {
    const init = () => {
      window.__shared = [];
      let n = 0;
      Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: (d) => {
          window.__shared.push(d.files[0].name + ' ' + d.files[0].type);
          return ++n === 1
            ? Promise.reject(new DOMException('no gesture', 'NotAllowedError'))
            : Promise.resolve();
        },
      });
    };
    const { page, errors } = await openApp({ init, userAgent: IPHONE });
    watch(page, errors);
    await welcome(page, 'look');
    await openChart(page);
    await page.click('#swGo');
    await page.waitForSelector('#msToast.on #toastAct');
    assert.match(await page.textContent('#msToast'), /Your swatch chart is ready/);
    await page.click('#toastAct');
    await idle(page);
    const shared = await page.evaluate(() => window.__shared);
    assert.equal(shared.length, 2);
    assert.match(shared[1], /^swatch-chart-my-collection-.*\.pdf application\/pdf$/);
    assert.deepEqual(errors, []);
  });
}

// ---- from to-buy.test.mjs ----
// One To buy list (Markers › To buy) fed from every "you could buy" suggestion, called To buy everywhere, and ink:
// running low / dry (dry markers kept by the guide).
{
  const SHOTS = process.env.SHOP_SHOTS || '';
  const snap = async (page, name) => {
    await shot(page, name);
    if (SHOTS) await page.screenshot({ path: SHOTS + '/' + name + '.png' });
  };
  const wish = (page) => page.evaluate(() => state.wish.map((w) => ({ k: w.k, why: w.why })));
  const firstUnowned = (page) =>
    page.evaluate(() => COLORS.findIndex((c, i) => c.brand === 'Ohuhu' && !isOwned(i)));
  const firstOwned = (page) =>
    page.evaluate(() => COLORS.findIndex((c, i) => c.brand === 'Ohuhu' && isOwned(i)));
  async function markers(page, view) {
    await page.click('#mCollection');
    await idle(page);
    if (view) {
      await page.click(`#ownView [data-v="${view}"]`);
      await idle(page);
    }
  }
  // Only the sample guide's own markers owned: its blends need shades you don't have. (With all of Honolulu 120, every
  // colour in the sample has a lighter and a darker shade you own, so the blend plan has nothing to suggest.)
  const onlyGuideMarkers = (page) =>
    page.evaluate(() => {
      const keys = new Set(Object.values(__mstest.assignData.assign).map((m) => m.mkey));
      state.owned = new Set([...state.owned].filter((k) => keys.has(k)));
      save();
      SF.setCollection(sfCollection());
    });
  // press and hold stands in as a right-click: it opens the marker's details
  async function openSheet(page, i) {
    await page.evaluate((i) => openMarkerSheet(i), i);
    await page.waitForSelector('#mkOverlay.on');
  }
  const SEEDED = (wish, ink) => ({
    'ohuhu-hb320-picker-v3': JSON.stringify({
      mode: 'collection',
      collView: 'wish',
      owned: ['Ohuhu|R16', 'Ohuhu|B08', 'Ohuhu|YR04'],
      ownedSeedV: 2,
      copicAdd1: 1,
      libAdj1: 1,
      setFix1: 1,
      wish,
      ink,
    }),
    'ms-onboarded': '1',
    'ms-setup-tip': '1',
  });
  const LIST = [
    { k: 'Ohuhu|R15', why: 'blend for R16', ts: 1 },
    { k: 'Copic|E09', why: 'from Match a colour', ts: 2 },
    { k: 'Ohuhu|B05', why: 'shading for B08', ts: 3 },
    { k: 'Ohuhu|YR04', why: 'running low', ts: 4 },
  ];
  const photoOf = (page, draw) =>
    page.evaluate(async (draw) => {
      const c = document.createElement('canvas');
      c.width = 600;
      c.height = 800;
      const g = c.getContext('2d');
      new Function('g', draw)(g);
      const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
      return await new Promise((r) => {
        const f = new FileReader();
        f.onload = () => r(f.result.split(',')[1]);
        f.readAsDataURL(blob);
      });
    }, draw);
  // ---- From the fourth review (data safety) ----
  // Save (a new guide into the Library), done once the header says so
  const saveNew = (page) => saveGuide(page);
  const AUTO = 2300;
  // idle(page, AUTO): until auto-save (1.5 s after the last change) has run
  const savedId = (page) => page.evaluate(() => state.saved.find((s) => s.type === 'guide').id);
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
  // reopen a Library guide the way the Library does
  const openSaved = async (page, id) => {
    await page.evaluate((id) => loadGuide({ id }), id);
    await page.waitForFunction((id) => __mstest.curId === id && __mstest.assignData, id, { timeout: 10000 });
    await idle(page);
  };
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
  const toastText = (page) =>
    page.evaluate(() => {
      const t = document.getElementById('msToast');
      return t && t.classList.contains('on') ? t.textContent : '';
    });
  // ---- From v265 ----
  // visible text that still says "shopping list" or a "List" button
  const OLD = /shopping list|\+ ?List\b|Add all to list|On your list|On list\b|Add to shopping list/i;
  const oldWords = (page) =>
    page.evaluate((src) => {
      const re = new RegExp(src, 'i'),
        out = [];
      if (re.test(document.body.innerText)) out.push(document.body.innerText.match(re)[0]);
      document.querySelectorAll('[aria-label],[title]').forEach((e) => {
        const t = (e.getAttribute('aria-label') || '') + ' ' + (e.getAttribute('title') || '');
        if (re.test(t)) out.push(t);
      });
      return out;
    }, OLD.source);
  test('Match a colour: closer ones you could buy go on the list', async () => {
    const { page, errors } = await openApp();
    await welcome(page, 'look');
    await markers(page);
    await page.click('#mkMatchBtn');
    await page.click('.msrc [data-src="hex"]');
    // a turquoise your markers match roughly (BG311, 9.2) and two Copic markers clearly better (4.8, 6.4): markers to buy
    // are listed only when at least 2 ΔE00 closer (#0bd6c8, used before, has none now). (v304: no Ohuhu marker is, so
    // the nearest Copic one, BG13, is listed alone under "Closer in Copic")
    await page.fill('#matchHex', '#40e0d0');
    await idle(page);
    const btns = page.locator('#matchResult .mrow .wishbtn');
    const closer = await page.evaluate(() => {
      const h = [...document.querySelectorAll('#matchResult .mlh')].find((x) =>
        /could buy|^Closer (still )?in /.test(x.textContent),
      );
      let n = 0,
        e = h && h.nextElementSibling;
      while (e && e.classList.contains('mrow')) {
        n++;
        e = e.nextElementSibling;
      }
      return n;
    });
    assert.ok(closer >= 1, 'there are closer ones to buy');
    assert.equal(await btns.count(), closer, 'each of those, and only those, has an add button');
    assert.equal((await btns.first().textContent()).trim(), '+ To buy');
    const k = await btns.first().getAttribute('data-wk');
    await btns.first().click();
    await idle(page);
    assert.equal((await btns.first().textContent()).trim(), '✓ To buy');
    assert.deepEqual(await wish(page), [{ k, why: 'from Match a colour' }]);
    await snap(page, 'shop-match');
    // tapping it again takes it off
    await btns.first().click();
    await idle(page);
    assert.deepEqual(await wish(page), []);
    await btns.first().click();
    await idle(page);
    await page.click('#matchClose');
    assert.equal((await page.textContent('#ownView [data-v="wish"]')).trim(), 'To buy (1)');
    assert.deepEqual(errors, []);
  });
  test('the marker sheet adds markers you don’t own; ink OK / running low / dry for ones you do', async () => {
    const { page, errors } = await openApp();
    await welcome(page, 'look');
    await markers(page, 'all');
    const u = await firstUnowned(page),
      o = await firstOwned(page);
    await openSheet(page, u);
    assert.ok(!(await page.isVisible('#mkInk')), 'no ink control for a marker you don’t own');
    assert.equal((await page.textContent('#mkWish .wishbtn')).trim(), '+ To buy');
    await page.click('#mkWish .wishbtn');
    await idle(page);
    assert.equal((await page.textContent('#mkWish .wishbtn')).trim(), '✓ To buy');
    await page.click('#mkClose');
    // an owned marker: ink control, no add button until it runs low
    await openSheet(page, o);
    assert.ok(await page.isVisible('#mkInk'));
    assert.equal(await page.getAttribute('#mkInk button.on', 'data-ink'), '');
    assert.ok(!(await page.isVisible('#mkWish')));
    await page.click('#mkInk [data-ink="low"]');
    await idle(page);
    assert.equal(await page.getAttribute('#mkInk button.on', 'data-ink'), 'low');
    assert.ok(await page.isVisible('#mkWish .wishbtn'), 'running low offers a replacement');
    await snap(page, 'shop-sheet');
    await page.click('#mkWish .wishbtn');
    await idle(page);
    const w = await wish(page);
    assert.equal(w.length, 2);
    assert.equal(w[0].why, 'from Markers');
    assert.equal(w[1].why, 'running low');
    await page.click('#mkClose');
    assert.equal(
      await page.textContent(`.cell[data-i="${o}"] .inkb`),
      'low',
      'running-low badge in the grid',
    );
    assert.deepEqual(errors, []);
  });
  test('the blend plan and the shading note add their suggestions', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await onlyGuideMarkers(page);
    await idle(page);
    await page.evaluate(() => document.getElementById('sfPlan').click());
    await page.waitForSelector('#sfPlanOverlay.on');
    const chips = page.locator('#sfPlanBuy .wishchip');
    const n = await chips.count();
    assert.ok(n >= 2, 'the plan’s “add N markers” are buttons');
    const base = await chips.first().getAttribute('data-why');
    assert.match(base, /^blend for \S+/);
    await chips.first().click();
    await idle(page);
    assert.equal(await chips.first().getAttribute('aria-pressed'), 'true');
    assert.equal(await page.textContent('#sfPlanBuy .wishchip.on .wmk'), '✓');
    await page.click('#sfPlanBuy .wishall');
    await idle(page);
    assert.equal((await wish(page)).length, n, 'add all adds the rest');
    assert.equal((await page.textContent('#sfPlanBuy .wishall')).trim(), '✓ All on your To buy list');
    // Undo on the toast takes back the ones "add all" added
    await page.click('#toastAct');
    await idle(page);
    assert.equal((await wish(page)).length, 1);
    await page.keyboard.press('Escape');
    await idle(page);
    // shading: "Richer with" markers, inside the one-line suggestions once it's opened
    await page.click('.sftabbtn[data-t="shading"]');
    await page.evaluate(() => __mstest.shadeTo('full'));
    await idle(page);
    assert.match(await page.textContent('.sfshnote .sfonelh'), /\d+ markers? would make the shading richer/);
    assert.equal(await page.isVisible('.sfshnote .wishchip'), false, 'collapsed at first');
    await page.click('#sfShNoteT');
    const sh = page.locator('.sfshnote .wishchip');
    assert.ok((await sh.count()) >= 1);
    const k = await sh.first().getAttribute('data-wk');
    await sh.first().click();
    await idle(page);
    const w = await wish(page);
    assert.equal(w.length, 2);
    assert.equal(w[1].k, k);
    assert.match(w[1].why, /^shading for \S+/);
    assert.deepEqual(errors, []);
  });
  test('To buy lists them with reasons; Bought ✓ (with Undo), remove, copy and share', async () => {
    const { page, errors } = await openApp({ storage: SEEDED(LIST, { 'Ohuhu|YR04': 'low' }) });
    await page.waitForSelector('#wishView .wrow');
    assert.equal((await page.textContent('#ownView [data-v="wish"]')).trim(), 'To buy (4)');
    assert.ok(!(await page.isVisible('#results')), 'the grid is hidden in this view');
    const rows = await page.evaluate(() =>
      [...document.querySelectorAll('#wishView .wrow')].map(
        (r) => r.querySelector('.wcode b').textContent + ' | ' + r.querySelector('.wwhy').textContent,
      ),
    );
    assert.deepEqual(rows, [
      'R15 | blend for R16',
      'B05 | shading for B08',
      'YR04 | running low',
      'E09 | from Match a colour',
    ]);
    assert.deepEqual(
      await page.evaluate(() =>
        [...document.querySelectorAll('#wishView .rghead')].map((h) => h.firstChild.textContent.trim()),
      ),
      ['Ohuhu', 'Copic'],
    );
    await snap(page, 'shop-tobuy');
    // copy: plain text grouped by brand
    await page.evaluate(() => {
      navigator.clipboard.writeText = async (t) => {
        window.__copied = t;
      };
    });
    await page.click('#wishCopy');
    await idle(page);
    assert.equal(await page.evaluate(() => window.__copied), 'Ohuhu: R15, B05, YR04 · Copic: E09');
    assert.equal((await page.textContent('#wishCopy')).trim(), 'Copied ✓');
    // share: only offered where the phone can share
    assert.equal(await page.$('#wishShare'), null);
    await page.evaluate(() => {
      navigator.share = async (d) => {
        window.__shared = d;
      };
      renderWish();
    });
    await page.click('#wishShare');
    await idle(page);
    assert.match(await page.evaluate(() => window.__shared.text), /Ohuhu: R15, B05, YR04 · Copic: E09/);
    // Bought ✓: into the collection, off the list, Undo puts it all back
    await page.click('#wishView .wrow[data-k="Ohuhu|R15"] .wbought');
    await idle(page);
    assert.ok(await page.evaluate(() => state.owned.has('Ohuhu|R15')));
    assert.equal((await wish(page)).length, 3);
    assert.match(await page.textContent('#msToast'), /Added Ohuhu R15 to your collection/);
    await page.click('#toastAct');
    await idle(page);
    assert.ok(await page.evaluate(() => !state.owned.has('Ohuhu|R15')), 'Undo un-owns it');
    assert.equal((await wish(page))[0].k, 'Ohuhu|R15', 'and puts it back in its place');
    // a running-low one: bought means fresh ink
    await page.click('#wishView .wrow[data-k="Ohuhu|YR04"] .wbought');
    await idle(page);
    assert.equal(await page.evaluate(() => state.ink['Ohuhu|YR04'] || ''), '');
    assert.match(await page.textContent('#msToast'), /fresh again/);
    // remove ✕
    await page.click('#wishView .wrow[data-k="Copic|E09"] .wrm');
    await idle(page);
    assert.deepEqual(
      (await wish(page)).map((w) => w.k),
      ['Ohuhu|R15', 'Ohuhu|B05'],
    );
    assert.equal((await page.textContent('#ownView [data-v="wish"]')).trim(), 'To buy (2)');
    // it all survives a reload
    await page.reload();
    await page.waitForSelector('#wishView .wrow');
    assert.deepEqual(
      (await wish(page)).map((w) => w.k),
      ['Ohuhu|R15', 'Ohuhu|B05'],
    );
    assert.ok(await page.evaluate(() => state.owned.has('Ohuhu|YR04') && !state.ink['Ohuhu|YR04']));
    // empty state explains how to add
    await page.click('#wishView .wrm');
    await page.click('#wishView .wrm');
    await idle(page);
    assert.match(await page.textContent('#wishView .wishempty'), /To buy list is empty.*\+ To buy/s);
    assert.equal((await page.textContent('#ownView [data-v="wish"]')).trim(), 'To buy');
    assert.deepEqual(errors, []);
  });
  test('the list and ink are in the backup, and come back on restore', async () => {
    const { page, errors } = await openApp({ storage: SEEDED(LIST.slice(0, 2), { 'Ohuhu|B08': 'dry' }) });
    await page.waitForSelector('#wishView .wrow');
    await page.click('#mHome');
    await page.click('#homeLibCard');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#guidesBackup')]);
    const file = await dl.path();
    const data = JSON.parse(await readFile(file, 'utf8'));
    assert.deepEqual(
      data.wish.map((w) => w.k),
      ['Ohuhu|R15', 'Copic|E09'],
    );
    assert.deepEqual(data.ink, { 'Ohuhu|B08': 'dry' });
    // same markers: the backup's list merges back in
    await page.evaluate(() => {
      state.wish = [];
      state.ink = {};
      save();
    });
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#guidesRestore')]);
    await fc.setFiles(file);
    await idle(page);
    assert.deepEqual(
      (await wish(page)).map((w) => w.k),
      ['Ohuhu|R15', 'Copic|E09'],
    );
    assert.equal(await page.evaluate(() => state.ink['Ohuhu|B08']), 'dry');
    // different markers, and you choose the backup's: its list and ink replace these
    await page.evaluate(() => {
      state.owned.add('Ohuhu|R22');
      state.wish = [{ k: 'Ohuhu|G43', why: 'x', ts: 1 }];
      state.ink = { 'Ohuhu|R16': 'low' };
      save();
    });
    await answerAsks(page, true);
    const [fc2] = await Promise.all([page.waitForEvent('filechooser'), page.click('#guidesRestore')]);
    await fc2.setFiles(file);
    await idle(page);
    assert.deepEqual(
      (await wish(page)).map((w) => w.k),
      ['Ohuhu|R15', 'Copic|E09'],
    );
    assert.deepEqual(await page.evaluate(() => state.ink), { 'Ohuhu|B08': 'dry' });
    assert.deepEqual(errors, []);
  });
  test('a dry marker is left out of palettes, Match and the guide’s markers, and has a badge', async () => {
    const { page, errors } = await openApp();
    await welcome(page, 'look');
    await markers(page);
    const o = await firstOwned(page);
    const k = await page.evaluate((o) => mkey(o), o);
    await openSheet(page, o);
    await page.click('#mkInk [data-ink="dry"]');
    await idle(page);
    assert.match(await page.textContent('#mkInk .mkinknote'), /Left out of new palettes and guides/);
    assert.equal((await page.textContent('#mkWish .wishbtn')).trim(), '+ To buy');
    await page.click('#mkWish .wishbtn');
    assert.equal((await wish(page))[0].why, 'ran dry');
    await page.click('#mkClose');
    assert.equal(await page.textContent(`.cell[data-i="${o}"] .inkb.dry`), 'dry', 'dry badge in the grid');
    await page.locator(`.cell[data-i="${o}"]`).scrollIntoViewIfNeeded();
    await snap(page, 'shop-dry-badge');
    const r = await page.evaluate(
      ({ o, k }) => {
        let seen = 0;
        for (let n = 0; n < 60; n++) {
          const p = genPalette(8, 'mono') || [];
          if (p.includes(o)) seen++;
        }
        return { pool: inPool(o), seen, coll: sfCollection().some((m) => m.mkey === k), still: isOwned(o) };
      },
      { o, k },
    );
    assert.equal(r.pool, false, 'not in the palette pool');
    assert.equal(r.seen, 0, 'never picked for a new palette');
    assert.equal(r.coll, false, 'not in the guide’s marker list');
    assert.equal(r.still, true, 'still counted as yours in Markers');
    // Match: its own colour no longer finds it among your markers
    const hex = await page.evaluate((o) => COLORS[o].hex, o),
      code = await page.evaluate((o) => COLORS[o].code, o);
    await page.click('#mkMatchBtn');
    await page.click('.msrc [data-src="hex"]');
    await page.fill('#matchHex', hex);
    await idle(page);
    assert.notEqual((await page.textContent('#matchResult .mbname b')).trim(), code);
    await page.click('#matchClose');
    // back to OK: used again
    await openSheet(page, o);
    await page.click('#mkInk [data-ink=""]');
    await idle(page);
    assert.equal(await page.evaluate((o) => inPool(o), o), true);
    assert.equal(await page.$(`.cell[data-i="${o}"] .inkb`), null);
    assert.deepEqual(errors, []);
  });
  test('the photo pattern’s “Closer with” markers can go on the list', async () => {
    const { page, errors } = await openApp();
    // Honolulu 24 and a photo in colours it can't match well
    await haveSet(page);
    await page.check('#wcSets input[data-i="0"]');
    await page.click('#wcAdd');
    await page.click('#wcSample');
    await page.waitForFunction(() => !!(window.__mstest && __mstest.assignData));
    const b64 = await photoOf(
      page,
      "const gr=g.createLinearGradient(0,0,600,800);gr.addColorStop(0,'#0bd6c8');gr.addColorStop(0.5,'#8a2be2');gr.addColorStop(1,'#39ff14');g.fillStyle=gr;g.fillRect(0,0,600,800);",
    );
    await page.click('.sftabbtn[data-t="pattern"]');
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#sfFam [data-v="photo"]')]);
    await fc.setFiles({ name: 'ref.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
    await page.waitForFunction(() => !!__mstest.photoRef);
    await idle(page);
    const chips = page.locator('.sfphwant .wishchip');
    assert.ok((await chips.count()) >= 1, 'the suggestions are buttons');
    const k = await chips.first().getAttribute('data-wk');
    await chips.first().click();
    await idle(page);
    assert.deepEqual(await wish(page), [{ k, why: 'closer to your photo' }]);
    assert.equal(await page.textContent('.sfphwant .wishchip.on .wmk'), '✓');
    assert.deepEqual(errors, []);
  });
  test('dry markers: the guide keeps them; sections still to colour show a stand-in, done ones the marker itself', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await tickN(page, 4);
    await saveNew(page);
    const id = await savedId(page),
      s0 = await stored(page, id);
    // the marker of a done section, which undone sections use too, runs dry (the gradient shares markers out by area,
    // so the first section, if it's a big one, can have a marker to itself)
    const k = await page.evaluate(() => {
      const a = __mstest.assignData,
        c = __mstest.colored;
      return a.order
        .filter((l) => c[l])
        .map((l) => a.assign[l].mkey)
        .find((k) => a.order.some((l) => !c[l] && a.assign[l].mkey === k));
    });
    assert.ok(k);
    await page.evaluate((k) => {
      state.ink[k] = 'dry';
      save();
    }, k);
    await page.reload();
    await idle(page);
    await openSaved(page, id);
    assert.match(await page.textContent('#sfMeta'), /dry/);
    const done = await page.evaluate(
      (k) =>
        __mstest.assignData.order.filter(
          (l) => __mstest.colored[l] && __mstest.assignData.assign[l].mkey === k,
        ).length,
      k,
    );
    assert.ok(done >= 1, 'a done section still shows the dry marker');
    assert.ok(
      await page.evaluate(
        (k) =>
          __mstest.assignData.order.some(
            (l) => !__mstest.colored[l] && __mstest.assignData.assign[l].mkey !== k,
          ),
        k,
      ),
    );
    // a tick elsewhere saves; the saved markers are unchanged (v318.22: elsewhere, a section showing the marker it's saved
    // with: one coloured with a stand-in is saved as the stand-in, the ink on the paper)
    const plain = await page.evaluate((sa) => {
      const t = __mstest;
      return t.assignData.order.find((l) => !t.colored[l] && sa[l] === t.assignData.assign[l].mkey);
    }, s0.assign);
    await page.evaluate((l) => {
      const t = __mstest;
      t.colored[l] = 1;
      t.guideDirty = true;
      t.renderGuide();
    }, plain);
    await idle(page, AUTO);
    const s1 = await stored(page, id);
    assert.deepEqual(s1.assign, s0.assign, 'the saved markers are kept');
    assert.equal(s1.prog, 5);
    // every owned marker dry: the guide still opens with all its sections, and a change saves the whole plan
    await page.evaluate(() => {
      for (const x of state.owned) state.ink[x] = 'dry';
      save();
    });
    await page.reload();
    await idle(page);
    await openSaved(page, id);
    assert.equal(await page.evaluate(() => __mstest.assignData.N), Object.keys(s0.assign).length);
    await tickN(page, 1, 12);
    await idle(page, AUTO);
    assert.deepEqual((await stored(page, id)).assign, s0.assign);
    assert.deepEqual(errors, []);
  });
  test('To buy › Bought ✓ on a marker you already own with no ink note says it was removed from To buy', async () => {
    const { page, errors } = await openApp({
      storage: onboarded({
        [KEY]: appState({ collView: 'wish', wish: [{ k: 'Ohuhu|R014', why: 'x', ts: 1 }] }),
      }),
    });
    await page.click('#mCollection');
    await page.click('#wishView [data-bought="Ohuhu|R014"]');
    assert.match(await toastText(page), /^Removed Ohuhu R014 from To buy\./);
    assert.deepEqual(errors, []);
  });
  test('To buy everywhere: Match, the marker sheet, the To buy view, the swatch sheet', async () => {
    const { page, errors } = await openApp();
    await welcome(page, 'look');
    await page.click('#mCollection');
    await idle(page);
    await page.click('#mkMatchBtn');
    await page.click('.msrc [data-src="hex"]');
    await page.fill('#matchHex', '#40e0d0');
    await idle(page); // (clearly closer markers to buy, as above)
    const b = page.locator('#matchResult .mrow .wishbtn').first();
    assert.equal((await b.textContent()).trim(), '+ To buy');
    assert.match(await b.getAttribute('aria-label'), /^Add to your To buy list: (Ohuhu|Copic) \S+$/);
    await b.click();
    await page.waitForSelector('#matchResult .mrow .wishbtn.on');
    assert.equal((await b.textContent()).trim(), '✓ To buy');
    assert.match(await b.getAttribute('aria-label'), /^On your To buy list: /);
    assert.match(await toastText(page), /^(Ohuhu|Copic) \S+ added to your To buy list/);
    assert.deepEqual(await oldWords(page), []);
    await b.click();
    await page.waitForFunction(() =>
      /^Took (Ohuhu|Copic) \S+ off To buy\.$/.test(document.getElementById('msToast').textContent),
    );
    await page.click('#matchClose');
    // the marker sheet
    const u = await page.evaluate(() => COLORS.findIndex((c, i) => c.brand === 'Ohuhu' && !isOwned(i)));
    await page.evaluate((i) => openMarkerSheet(i), u);
    await page.waitForSelector('#mkOverlay.on');
    assert.equal((await page.textContent('#mkWish .wishbtn')).trim(), '+ To buy');
    await page.click('#mkWish .wishbtn');
    await page.waitForSelector('#mkWish .wishbtn.on');
    assert.equal((await page.textContent('#mkWish .wishbtn')).trim(), '✓ To buy');
    assert.deepEqual(await oldWords(page), []);
    await page.click('#mkClose');
    // the To buy view: tab, heading, remove, empty
    await page.click('#ownView [data-v="wish"]');
    await idle(page);
    assert.equal((await page.textContent('#ownView [data-v="wish"]')).trim(), 'To buy (1)');
    assert.deepEqual(
      await page.$eval('#wishView .pile-head', (h) => [
        h.querySelector('.lbl').textContent,
        h.querySelector('.n').textContent,
      ]),
      ['To buy', '(1)'],
    );
    assert.match(await page.getAttribute('#wishView .wrm', 'aria-label'), /from your To buy list$/);
    assert.deepEqual(await oldWords(page), []);
    await page.click('#wishView .wrm');
    await page.waitForSelector('#wishView .wishempty');
    assert.match(await toastText(page), /from your To buy list\./);
    assert.match(
      await page.textContent('#wishView .wishempty'),
      /Your To buy list is empty\..*tap \+ To buy to add it here/s,
    );
    assert.deepEqual(await oldWords(page), []);
    // the swatch chart's choice
    await page.click('#ownView [data-v="owned"]');
    await idle(page);
    await page.click('#swatchBtn');
    await page.waitForSelector('#swOverlay.on');
    assert.ok(
      (await page.$$eval('#swOpts [data-k="what"]', (bs) => bs.map((x) => x.textContent))).includes('To buy'),
    );
    await page.click('#swOpts [data-k="what"][data-v="wish"]');
    assert.match(await page.textContent('#swSum'), /Your To buy list is empty/);
    assert.deepEqual(await oldWords(page), []);
    assert.deepEqual(errors, []);
  });
  test('To buy in the guide: the start card, blend plan, shading and photo notes', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    // (v313: the start card in Home's words, which leave To buy to the Plan)
    assert.match(
      await page.evaluate(() => document.getElementById('sfRoot').innerHTML),
      /a marker-by-number guide, built from the markers you own/,
    );
    await onlyGuideMarkers(page);
    await idle(page);
    await page.evaluate(() => document.getElementById('sfPlan').click());
    await page.waitForSelector('#sfPlanOverlay.on');
    assert.equal((await page.textContent('#sfPlanBuy .wishall')).trim(), 'Add all to To buy');
    assert.match(await page.getAttribute('#sfPlanBuy .wishchip', 'aria-label'), /^Add to your To buy list: /);
    assert.deepEqual(await oldWords(page), []);
    await page.click('#sfPlanBuy .wishall');
    await idle(page);
    assert.equal((await page.textContent('#sfPlanBuy .wishall')).trim(), '✓ All on your To buy list');
    assert.match(await toastText(page), /to your To buy list\./);
    await page.click('#sfPlanBuy .wishall');
    await idle(page);
    assert.match(await toastText(page), /They’re all on your To buy list already\./);
    await page.keyboard.press('Escape');
    await idle(page);
    await page.click('.sftabbtn[data-t="shading"]');
    await page.evaluate(() => __mstest.shadeTo('full'));
    await idle(page);
    await page.click('#sfShNoteT');
    await idle(page);
    if (await page.locator('.sfshnote .wishall').count())
      assert.match(
        (await page.textContent('.sfshnote .wishall')).trim(),
        /^(Add all to To buy|✓ All on your To buy list)$/,
      );
    assert.match(await page.getAttribute('.sfshnote .wishchip', 'aria-label'), /To buy list: /);
    assert.deepEqual(await oldWords(page), []);
    // the photo note's chips come from the same builders
    const chip = await page.evaluate(() => {
      const d = document.createElement('div');
      d.innerHTML =
        wishChipHTML('Copic|E09', 'closer to your photo', 'E09') +
        wishAllHTML([
          ['Copic|E09', 'x'],
          ['Copic|E07', 'x'],
        ]);
      return [d.firstChild.getAttribute('aria-label'), d.lastChild.textContent];
    });
    assert.deepEqual(chip, ['Add to your To buy list: Copic E09', 'Add all to To buy']);
    assert.deepEqual(errors, []);
  });
}

// ---- from v285-review.test.mjs ----
// v285's pre-release review: narrow landscape phones keep the whole controls column; an automatic first save leaves a
// name being typed alone; Put back while the Library's delete is still waiting keeps the guide's stored copy; Home's
// Continue card follows a rename and isn't redrawn while Home is hidden; the marker sets' caret stays an icon.
{
  test('the marker sets’ caret stays a line icon as the list opens and closes', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    // (v311: the sets list is in Add markers' sheet now; Brands I'd buy keeps its caret)
    const c = await page.evaluate(() => {
      const e = document.querySelector('#buyOpen .presetcar');
      return { svg: !!e.querySelector('svg.ic'), text: e.textContent.trim() };
    });
    assert.deepEqual(c, { svg: true, text: '' });
    assert.deepEqual(errors, []);
  });
}

// ---- from v289.test.mjs ----
// v289: fixes from the fresh-eyes review of v288 — ← Plan › Discard of edits brought back by Resume, a palette held for
// the next guide and a photo that won't open, section edits beyond Undo, Use in a guide › Recolour from Colour along,
// Change colour after an iPad turns, a backup restored over a guide deleted while open, Generate keeping the keyboard,
// Edit sections' tools on a phone's first screen, the guide saved at once on leaving it, focus after Change colour.
{
  test('Markers: ⋯ beside Copy codes in the heading, its menu clear of Palette from these; Random and Match are small', async () => {
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
    const st = {
      'ms-onboarded': '1',
      'ms-setup-tip': '1',
      'ms-last-ver': 'v289',
      'ohuhu-hb320-picker-v3': JSON.stringify({
        mode: 'collection',
        ownedSeedV: 2,
        copicAdd1: 1,
        libAdj1: 1,
        setFix1: 1,
        owned: OWN,
        saved: [],
      }),
    };
    const { page, errors } = await openApp({ storage: st });
    await idle(page);
    const r = (s) => page.$eval(s, (e) => e.getBoundingClientRect().toJSON());
    const more = await r('#mkMore'),
      copy = await r('#copyBtn');
    assert.ok(
      Math.abs(more.top - copy.top) < 2 && more.left > copy.right,
      'on the heading’s row, after Copy codes',
    );
    assert.equal(
      await page.isVisible('#ownStateWrap'),
      false,
      'no row of its own in Owned (Tick all shown is for the others)',
    );
    await page.click('#mkMore');
    const menu = await r('#mkMenu'),
      pal = await r('#toPalette');
    assert.ok(menu.bottom < pal.top, 'the menu covers nothing it acts on');
    await page.keyboard.press('Escape');
    const d = await r('#mkDrawBtn'),
      m = await r('#mkMatchBtn'),
      w = await page.evaluate(() => innerWidth);
    assert.ok(d.width + m.width < w * 0.75, `small buttons (${d.width}, ${m.width})`);
    // not on other screens
    await page.click('#mPalette');
    await idle(page);
    assert.equal(await page.isVisible('#mkMore'), false);
    assert.deepEqual(errors, []);
  });
}

// ---- from v298.test.mjs ----
// v298: fixes from the second fresh-eyes review of v297 — ticks follow merged and split sections; Focus mode says
// where it is up to; zones keep touching sections apart across their borders; a guide file with odd keys opens; the
// sets list follows Clear collection; and Scan's box: the same text again is still cleared, Enter then the same cap
// again is read, letters composed by an Android keyboard wait for Enter, and a card isn't repeated while held.
{
  const list = (page) =>
    page.$$eval('#scList .scrow', (rs) =>
      rs.map((r) => (r.querySelector('.sccode') || r.querySelector('b')).textContent),
    );
  test('Markers › Add a set: the sets you have are unmarked by Clear collection, and marked again by its Undo', async () => {
    const { page, errors } = await openApp();
    await welcome(page, 'look');
    await page.click('#mCollection');
    await idle(page);
    // (v311: the sets list is Add markers' sheet's; Clear collection is in ⋯)
    const have = async () => {
      await addFromMarkers(page, 'set');
      const n = await page.$$eval('#wcSets .presetrow.have', (r) => r.length);
      await page.keyboard.press('Escape');
      await page.keyboard.press('Escape');
      await idle(page);
      return n;
    };
    const n0 = await have();
    assert.ok(n0 >= 1);
    await clearCollection(page);
    assert.equal(await page.evaluate(() => (presetListHTML().match(/presetrow have/g) || []).length), 0);
    await page.click('#toastAct');
    await idle(page);
    assert.equal(await have(), n0);
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
  test('an older guide that used Copic 0 (owned) opens with it, not as a marker "no longer in your collection"', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await page.evaluate(() => {
      COLORS.forEach((c, i) => {
        state.owned.add(mkey(i));
      });
      save();
      SF.setCollection(sfCollection());
    });
    await page.evaluate(() => {
      const t = __mstest,
        d = t.currentDesignObj(),
        p = Object.assign({}, d.payload, { name: 'Blend', W: d.W, H: d.H }),
        k = Object.keys(p.assign);
      p.assign = Object.assign({}, p.assign);
      p.assign[k[0]] = 'Copic|0';
      p.prog = [];
      t.openDesignObj(p, null);
    });
    await page.waitForFunction(() => __mstest.curName === 'Blend');
    await idle(page);
    assert.doesNotMatch(
      await page.evaluate(() =>
        [...document.querySelectorAll('#sfMeta, #msToast')].map((e) => e.textContent).join(' '),
      ),
      /no longer in your collection/,
    );
    assert.ok(
      await page.evaluate(() => Object.values(__mstest.assignData.assign).some((m) => m.mkey === 'Copic|0')),
    );
    assert.deepEqual(errors, []);
  });
  test('Random with nothing in play says so, not "All drawn"', async () => {
    const { page, errors } = await openApp();
    await welcome(page, 'look');
    await idle(page);
    await page.evaluate(() => {
      setMode('random');
    });
    // (an Ohuhu set owned, Copic chosen)
    await page.evaluate(() => {
      state.brands = new Set(['Copic']);
      save();
      fullRender();
    });
    await idle(page);
    assert.equal(await page.textContent('#draw'), 'No markers to draw');
    assert.equal(await page.isDisabled('#draw'), true);
    assert.deepEqual(errors, []);
  });
}

// ---- from v304-buy.test.mjs ----
// v304, Brands I'd buy (Markers, under Add a set you own and Scan or type codes, and in To buy): which brands a
// marker to buy is suggested from in Match, a guide's shading and blend plan and the Photo pattern. Your brands first
// (as before) or only the brands ticked; kept, and said in Match's heading when it leaves a brand out.
{
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
  const storage = (extra = {}) => ({
    'ms-onboarded': '1',
    'ms-setup-tip': '1',
    'ms-last-ver': 'v304',
    [KEY]: JSON.stringify({
      mode: 'collection',
      collView: 'owned',
      ownedSeedV: 2,
      copicAdd1: 1,
      libAdj1: 1,
      setFix1: 1,
      owned: OWN,
      saved: [],
      ...extra,
    }),
  });
  const sum = (page) => page.textContent('#buySum');
  test('the row says what’s chosen; Only these starts from your brands; no brand ticked can’t be kept; Done keeps it through a reload; Escape keeps it too', async () => {
    for (const [w, h] of [
      [820, 1180],
      [390, 844],
    ]) {
      const { page, errors, ctx } = await openApp({ width: w, height: h, storage: storage() });
      await idle(page);
      assert.equal((await sum(page)).trim(), 'Your brands first');
      await page.click('#buyOpen');
      await idle(page);
      assert.equal(
        await page.isVisible('#buyChips'),
        false,
        'no brands to tick while it’s your brands first',
      );
      assert.match(await page.textContent('#buyNote'), /^Ohuhu first, as you have that brand\./);
      await page.click('#buyMode [data-m="pick"]');
      await idle(page);
      assert.deepEqual(
        await page.$$eval('#buyChips .chip[data-sel="1"]', (b) => b.map((x) => x.dataset.b)),
        ['Ohuhu'],
        'your brand',
      );
      await page.click('#buyChips [data-b="Ohuhu"]');
      await idle(page);
      assert.equal(await page.isDisabled('#buyDone'), true);
      assert.match(await page.textContent('#buyNote'), /Tick at least one brand/);
      await page.click('#buyChips [data-b="Copic"]');
      await idle(page);
      await page.click('#buyDone');
      await idle(page);
      assert.equal((await sum(page)).trim(), 'Copic');
      assert.equal(
        await page.evaluate(() => document.activeElement && document.activeElement.id),
        'buyOpen',
        'focus back on the row',
      );
      // no sideways scroll on a phone
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await page.reload();
      await idle(page);
      assert.equal((await sum(page)).trim(), 'Copic');
      // Escape closes and keeps what's chosen
      await page.click('#buyOpen');
      await idle(page);
      await page.click('#buyMode [data-m="auto"]');
      await idle(page);
      await page.keyboard.press('Escape');
      await idle(page);
      assert.equal(await page.isVisible('#buyOverlay'), false);
      assert.equal((await sum(page)).trim(), 'Your brands first');
      assert.equal(
        await page.evaluate(() => JSON.parse(localStorage.getItem('ohuhu-hb320-picker-v3')).buyBrands),
        null,
      );
      assert.deepEqual(errors, []);
      await ctx.close();
    }
  });
  test('Match: with only Copic ticked an Ohuhu collection is offered Copic markers to buy, under a heading that says so; To buy has the row too', async () => {
    const { page, errors } = await openApp({
      width: 820,
      height: 1180,
      storage: storage({ buyBrands: ['Copic'] }),
    });
    await idle(page);
    await page.click('#mkMatchBtn');
    await idle(page);
    await page.click('.msrc [data-src="hex"]');
    await page.fill('#matchHex', '#40e0d0');
    await idle(page);
    const heads = await page.$$eval('#matchResult .mlh', (l) => l.map((h) => h.textContent));
    assert.ok(heads.includes('Closer ones you could buy · Copic'), heads.join(' | '));
    const buy = await page.$$eval('#matchResult .mrow.buy', (r) => r.map((x) => x.textContent));
    assert.ok(buy.length >= 1);
    assert.equal(
      await page.evaluate(() =>
        matchNearest(hexToLab('#40e0d0')).buy.every((o) => COLORS[o.i].brand === 'Copic'),
      ),
      true,
    );
    await page.click('#matchClose');
    await idle(page);
    await page.click('#ownView [data-v="wish"]');
    await idle(page);
    assert.equal((await page.textContent('#wishView .buyopen .buysum')).trim(), 'Copic');
    await page.click('#wishView .buyopen');
    await idle(page);
    assert.equal(await page.isVisible('#buyOverlay'), true);
    assert.deepEqual(errors, []);
  });
  test('a guide: shading’s markers to buy and the blend plan’s come from the brands ticked, else the base marker’s own brand', async () => {
    const { page, errors } = await openApp({ width: 1180, height: 820 });
    await sampleGuide(page);
    // (an Ohuhu-only collection of 8)
    await page.evaluate((own) => {
      state.owned = new Set(own);
      state.buyBrands = null;
      save();
      SF.setCollection(sfCollection());
    }, OWN);
    const brands = () =>
      page.evaluate(() => {
        const t = __mstest,
          base = t.coll.find((m) => m.brand === 'Ohuhu' && m.code === 'B08') || t.coll[0];
        const out = new Set(),
          c = t.colour ? t.colour.companions(base) : null;
        const z = t.shadeTones(base, { hilite: 'lighter', shadow: 'darker', hi: 0.5, lo: 0.5 });
        if (z.wantDark) out.add('S:' + z.wantDark.brand);
        if (z.wantLight) out.add('H:' + z.wantLight.brand);
        if (c && c.light && !c.lightOwned) out.add('L:' + c.light.brand);
        if (c && c.dark && !c.darkOwned) out.add('D:' + c.dark.brand);
        return [...out].sort();
      });
    const auto = await brands();
    assert.ok(auto.length >= 1, 'something to buy for B08 with 8 markers');
    assert.ok(
      auto.filter((x) => /^[SH]:/.test(x)).every((x) => x.endsWith('Ohuhu')),
      'shading: the base’s brand ' + auto,
    );
    await page.evaluate(() => {
      state.buyBrands = ['Copic'];
      save();
      SF.setCollection(sfCollection());
    });
    const cop = await brands();
    assert.ok(cop.length >= 1 && cop.every((x) => x.endsWith('Copic')), cop.join());
    assert.deepEqual(errors, []);
  });
  test('closing with no brand ticked keeps what was kept before; a Colorless Blender alone doesn’t make a brand yours; Match’s heading follows a change made in another tab', async () => {
    const { page, errors } = await openApp({
      width: 820,
      height: 1180,
      storage: storage({ buyBrands: ['Copic'], owned: OWN.concat(['Copic|0']) }),
    });
    await idle(page);
    await page.click('#buyOpen');
    await idle(page);
    await page.click('#buyChips [data-b="Copic"]');
    await idle(page);
    await page.keyboard.press('Escape');
    await idle(page);
    assert.equal(
      await page.evaluate(() => JSON.stringify(state.buyBrands)),
      '["Copic"]',
      'not switched to automatic',
    );
    await page.click('#buyOpen');
    await idle(page);
    await page.click('#buyMode [data-m="auto"]');
    await idle(page);
    assert.match(
      await page.textContent('#buyNote'),
      /^Ohuhu first, as you have that brand\./,
      'the blender’s brand isn’t counted',
    );
    await page.click('#buyMode [data-m="pick"]');
    await idle(page);
    assert.deepEqual(await page.$$eval('#buyChips .chip[data-sel="1"]', (b) => b.map((x) => x.dataset.b)), [
      'Ohuhu',
    ]);
    await page.click('#buyClose');
    await idle(page);
    // Match open; another tab ticks only Ohuhu: the heading says so at the next colour, even with the same markers
    await page.click('#mkMatchBtn');
    await idle(page);
    await page.click('.msrc [data-src="hex"]');
    await page.fill('#matchHex', '#ff8800');
    await idle(page);
    await page.evaluate(() => {
      state.buyBrands = ['Ohuhu'];
    });
    await page.fill('#matchHex', '#ff8801');
    await idle(page);
    const heads = await page.$$eval('#matchResult .mlh', (l) => l.map((h) => h.textContent));
    assert.ok(heads.includes('Closer ones you could buy · Ohuhu'), heads.join(' | '));
    assert.deepEqual(errors, []);
  });
  test('a guide open while another tab changes Brands I’d buy: its shading’s markers to buy follow at once, without laying the guide again', async () => {
    const { page, errors } = await openApp({ width: 1180, height: 820 });
    await sampleGuide(page);
    await page.evaluate((own) => {
      state.owned = new Set(own);
      state.buyBrands = null;
      save();
      SF.setCollection(sfCollection());
    }, OWN);
    await page.click('.sftabbtn[data-t="shading"]');
    await page.evaluate(() => __mstest.shadeTo('full'));
    await idle(page);
    const panel = () => page.evaluate(() => document.getElementById('sfRoot').textContent);
    const lay = await page.evaluate(() => JSON.stringify(__mstest.assignData.assign));
    const before = await panel();
    // the other tab: only Copic, written to storage, and the storage event this tab gets
    await page.evaluate(() => {
      const k = 'ohuhu-hb320-picker-v3',
        v = JSON.parse(localStorage.getItem(k));
      v.buyBrands = ['Copic'];
      localStorage.setItem(k, JSON.stringify(v));
      dispatchEvent(new StorageEvent('storage', { key: k }));
    });
    await idle(page);
    assert.deepEqual(await page.evaluate(() => state.buyBrands), ['Copic']);
    const after = await panel();
    assert.notEqual(after, before, 'the shading panel was drawn again');
    // what it now offers to buy is Copic's
    const want = await page.evaluate(() => {
      const t = __mstest,
        out = new Set();
      [...new Map(Object.values(t.assignData.assign).map((m) => [m.mkey, m])).values()].forEach((m) => {
        const z = t.shadeTones(m, { hilite: 'lighter', shadow: 'darker', hi: 0.5, lo: 0.5 });
        [z.wantDark, z.wantLight].forEach((w) => w && out.add(w.brand + ' ' + w.code));
      });
      return [...out];
    });
    assert.ok(want.length && want.every((x) => x.startsWith('Copic ')), want.join());
    assert.ok(
      want.some((x) => after.includes(x.split(' ')[1])),
      'a Copic code in the panel',
    );
    assert.equal(
      await page.evaluate(() => JSON.stringify(__mstest.assignData.assign)),
      lay,
      'nothing laid again',
    );
    assert.deepEqual(errors, []);
  });
}

// ---- from v304-finder.test.mjs ----
// v304 (Markers): Tick all shown, Copy codes and Palette from these act on what the grid shows (Ramp gaps shows only
// some of the matches); an armed Untick all shown is disarmed by a search; a search puts the code searched for first
// ("Best match", then "Old code") without the groups' rise at each letter; Palette from these needs a colour, not only
// the Colorless Blender; a search that finds nothing says so, not "Your collection is empty". The custom slot picker
// shows every marker (it stopped at 400) and searches as Markers does; back in Custom the palette has its own size.
{
  const KEY = 'ohuhu-hb320-picker-v3';
  const onboarded = (extra = {}) => ({
    'ms-onboarded': '1',
    'ms-setup-tip': '1',
    'ms-last-ver': 'v304',
    ...extra,
  });
  const appState = (extra = {}) =>
    JSON.stringify({
      mode: 'home',
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
        value: {
          writeText: async (t) => {
            window.__clip.push(t);
          },
        },
        configurable: true,
      });
    } catch (e) {}
  };
  // the app's default collection (the sets most people start with), as keys
  async function defaultKeys() {
    const { page, ctx } = await openApp({ storage: onboarded() });
    const k = await page.evaluate(() => [...defaultOwned()]);
    await ctx.close();
    return k;
  }
  const shownCodes = (page) => page.$$eval('#results .cell', (l) => l.map((c) => COLORS[+c.dataset.i].code));
  test('Ramp gaps: Tick all shown ticks the gaps shown, Copy codes copies them in order, Palette from these uses them', async () => {
    const owned = await defaultKeys();
    const { page, errors } = await openApp({
      init: clip,
      storage: onboarded({
        [KEY]: appState({ mode: 'collection', collView: 'unowned', gapSort: 'ramps', owned }),
      }),
    });
    await idle(page);
    const shown = await shownCodes(page),
      all = await page.evaluate(() => finderMatches().length);
    assert.ok(shown.length > 0 && shown.length < all, shown.length + ' shown of ' + all);
    await page.click('#copyBtn');
    await idle(page);
    assert.deepEqual(
      (await page.evaluate(() => window.__clip[0])).split(', ').map((s) => s.replace(/^(Copic|Ohuhu) /, '')),
      shown,
    );
    const before = await page.evaluate(() => state.owned.size);
    await page.click('#ownAll');
    await idle(page);
    assert.equal(
      (await page.evaluate(() => state.owned.size)) - before,
      shown.length,
      'ticked only what was shown',
    );
    await page.click('#toastAct');
    await idle(page);
    assert.equal(await page.evaluate(() => state.owned.size), before, 'Undo');
    const again = await shownCodes(page);
    await page.click('#toPalette');
    await idle(page);
    assert.deepEqual((await page.evaluate(() => state.pool.map((i) => COLORS[i].code))).sort(), again.sort());
    assert.deepEqual(errors, []);
  });
  test('Untick all shown, armed, then a search: disarmed, and nothing is unticked', async () => {
    const owned = await defaultKeys();
    const { page, errors } = await openApp({
      storage: onboarded({ [KEY]: appState({ mode: 'collection', collView: 'owned', owned }) }),
    });
    await idle(page);
    await page.fill('#q', 'r2');
    await idle(page);
    await page.click('#mkMore');
    await page.click('#ownNone');
    assert.match(await page.textContent('#ownNone'), /^Untick \d+ markers\? Tap again$/);
    await page.fill('#q', '');
    await idle(page);
    assert.equal(await page.textContent('#ownNone'), 'Untick all shown');
    if (await page.isVisible('#ownNone')) await page.click('#ownNone', { delay: 0 });
    await idle(page);
    assert.equal(await page.evaluate(() => state.owned.size), owned.length, 'the next tap asks again');
    assert.deepEqual(errors, []);
  });
  test('a search for a code: "Best match" first, then "Old code"; no rise at each letter', async () => {
    const { page, errors } = await openApp({
      init: clip,
      storage: onboarded({ [KEY]: appState({ mode: 'collection', collView: 'all', owned: [] }) }),
    });
    await idle(page);
    await page.fill('#q', 'g410');
    await idle(page);
    const heads = await page.$$eval('#results .rghead', (l) =>
      l.map((h) => h.textContent.replace(/\s*\d+$/, '').trim()),
    );
    assert.deepEqual(heads.slice(0, 2), ['Best match', 'Old code']);
    assert.deepEqual((await shownCodes(page)).slice(0, 2), ['G410', 'G24']);
    assert.equal(await page.$eval('#results', (r) => r.classList.contains('noanim')), true);
    assert.equal(await page.$eval('#results .rgroup', (g) => getComputedStyle(g).animationName), 'none');
    await page.click('#copyBtn');
    await idle(page);
    assert.equal(await page.evaluate(() => window.__clip[0]), 'G410, G24');
    // "cool grey 3" and "c3" find Copic's C-3
    for (const q of ['cool grey 3', 'c3']) {
      await page.fill('#q', q);
      await idle(page);
      assert.deepEqual(await shownCodes(page), ['C-3'], q);
    }
    assert.deepEqual(errors, []);
  });
  test('Palette from these needs a colour; a search that finds nothing says so, collection empty or not', async () => {
    const { page, errors } = await openApp({
      storage: onboarded({ [KEY]: appState({ mode: 'collection', collView: 'all', owned: [] }) }),
    });
    await idle(page);
    await page.fill('#q', 'colorless');
    await idle(page);
    assert.equal((await shownCodes(page)).length, 2);
    assert.equal(await page.$eval('#toPalette', (b) => b.disabled), true, 'only the blenders');
    await page.evaluate(() => {
      state.collView = 'unowned';
      save();
      fullRender();
    });
    await page.fill('#q', 'zzzz');
    await idle(page);
    const t = await page.textContent('#results');
    assert.match(t, /No markers match/);
    assert.doesNotMatch(t, /Your collection is empty/);
    assert.deepEqual(errors, []);
  });
  test('custom slot picker: every marker, and the same search as Markers', async () => {
    const { page, errors } = await openApp({
      storage: onboarded({
        [KEY]: appState({ mode: 'palette', harmony: 'custom', palSize: 4, customPal: [], owned: [] }),
      }),
    });
    await idle(page);
    await page.click('#bands .band');
    await page.waitForSelector('#seedOverlay.on');
    await idle(page);
    const n = await page.$$eval('#seedGrid .cell', (l) => l.length),
      inPlay = await page.evaluate(() => COLORS.filter((c, i) => inPool(i)).length);
    assert.ok(inPlay > 400);
    assert.equal(n, inPlay, 'it had stopped at 400');
    await page.fill('#seedSearch', 'cool grey 3');
    await idle(page);
    assert.deepEqual(await page.$$eval('#seedGrid .cell', (l) => l.map((c) => COLORS[+c.dataset.i].code)), [
      'C-3',
    ]);
    await page.fill('#seedSearch', 'grey');
    await idle(page);
    const brands = await page.$$eval('#seedGrid .cell', (l) =>
      [...new Set(l.map((c) => COLORS[+c.dataset.i].brand))].sort(),
    );
    assert.deepEqual(brands, ['Copic', 'Ohuhu'], 'Copic’s Gray too');
    assert.deepEqual(errors, []);
  });
  test('Custom: another scheme and back keeps its markers; a smaller size chosen in Custom cuts them', async () => {
    const twelve = Array.from({ length: 12 }, (_, k) => k * 10);
    const { page, errors } = await openApp({
      storage: onboarded({
        [KEY]: appState({ mode: 'palette', harmony: 'custom', palSize: 12, customPal: twelve, owned: [] }),
      }),
    });
    await idle(page);
    const look = () =>
      page.evaluate(() => ({
        bands: document.querySelectorAll('#bands .band').length,
        filled: document.querySelectorAll('#bands .band:not(.empty)').length,
      }));
    assert.deepEqual(await look(), { bands: 12, filled: 12 });
    // Analogous goes up to 8: back in Custom, all 12 (it had come back with 8, the other 4 lost)
    await page.click('#harm [data-h="analogous"]');
    await idle(page);
    await page.click('#harm [data-h="custom"]');
    await idle(page);
    assert.deepEqual(await look(), { bands: 12, filled: 12 });
    // a smaller size chosen in Custom: the slots past it go, and stay gone after another scheme
    await page.evaluate(() => setSize(4));
    await idle(page);
    assert.deepEqual(await look(), { bands: 4, filled: 4 });
    await page.click('#harm [data-h="complementary"]');
    await idle(page);
    await page.click('#harm [data-h="custom"]');
    await idle(page);
    assert.deepEqual(await look(), { bands: 4, filled: 4 });
    assert.equal(
      await page.evaluate(() => JSON.parse(localStorage.getItem('ohuhu-hb320-picker-v3')).customPal.length),
      4,
    );
    assert.deepEqual(errors, []);
  });
}
