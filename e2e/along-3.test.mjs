// Colour along: the list, ticks, codes, run low, finding a marker.
// (v320) Tests organised by feature: each block below came from the file named above it, its tests unchanged.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ROOT,
  WK,
  haveSet,
  idle,
  letterGuide,
  notOnWebKit,
  openApp,
  openAtScale,
  pause,
  sampleGuide,
  saveGuide,
  scrollTop,
  sectionPoint,
  setup,
  teardown,
  until,
  welcome,
} from './helpers.mjs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { GEN_STRAIGHTEN } from './photo-gens.mjs';

before(setup);
after(teardown);

// ---- from v3091-d2.test.mjs ----
// v309.1 (review 2): colouring and output, and the Library. "Did any run low?" › Another… with the code of your
// Colorless Blender (the Ohuhu sets come with one since v309) said it wasn't one of your markers.
{
  // the sample, every section ticked but the first marker's, then that marker's Mark all: Page finished
  async function finished(page) {
    await sampleGuide(page);
    await idle(page);
    await page.click('#sfColor');
    await idle(page);
    const k = await page.evaluate(() => {
      const t = __mstest,
        k = t.assignData.assign[t.assignData.order[0]].mkey;
      t.assignData.order.forEach((l) => {
        if (t.assignData.assign[l].mkey !== k) t.colored[l] = 1;
      });
      t.updateProgress();
      return k;
    });
    await page.click(`#sfAlist .sfarow[data-k="${k}"] .sfah`);
    await idle(page);
    await page.click('#sfMarkAll');
    await idle(page);
  }
  test('run low › Another…: your Colorless Blender’s code says what it is, not “isn’t one of your markers”', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180, storage: { 'ms-wake-told': '1' } });
    await finished(page);
    // (Honolulu 120 from the welcome brings its blender)
    assert.ok(await page.evaluate(() => state.owned.has('Ohuhu|0')));
    await page.click('#sfLowA [data-lmore]');
    await idle(page);
    await page.fill('#sfLowInA', '0');
    await page.press('#sfLowInA', 'Enter');
    await idle(page);
    assert.equal(await page.textContent('#sfLowLA'), '0 is your Colorless Blender: mark it in Markers');
    assert.equal(await page.evaluate(() => state.ink['Ohuhu|0']), undefined, 'not marked');
    // not yours: as before
    await page.evaluate(() => {
      state.owned.delete('Ohuhu|0');
      save();
    });
    await page.fill('#sfLowInA', '0');
    await page.press('#sfLowInA', 'Enter');
    await idle(page);
    assert.equal(await page.textContent('#sfLowLA'), '0 isn’t one of your markers');
    assert.deepEqual(errors, []);
  });
}

// ---- from v313-along.test.mjs ----
// v313 (Colour along): D1, more of the marker list on the first screen. On an iPad held upright the order chips and the
// code box share one row; on a phone, once the first-time instructions have been seen, Colour along opens with the
// order chips just under the picture's tool row (the picture keeps its size). Each test fails on v312.
{
  const along = async (page) => {
    await page.click('#sfColor');
    await idle(page);
    await page.waitForTimeout(150);
  };
  const back = async (page) => {
    await page.click('#sfDoneBtn');
    await idle(page);
  };
  // where things are on the screen
  const rects = (page) =>
    page.evaluate(() => {
      const r = (s) => {
        const e = document.querySelector(s);
        if (!e) return null;
        const b = e.getBoundingClientRect();
        return { top: b.top, bottom: b.bottom, left: b.left, right: b.right, h: b.height };
      };
      const bar = document.querySelector('#sfRoot .sfbar');
      const barTop = bar.getBoundingClientRect().top;
      const rows = [...document.querySelectorAll('#sfAlist .sfarow .sfah')].filter((x) => {
        const b = x.getBoundingClientRect();
        return b.height > 20 && b.top >= 0 && b.bottom <= barTop + 1;
      }).length;
      return {
        sort: r('#sfAlSort'),
        find: r('#sfFind .sffindf'),
        pic: r('#sfView'),
        pinH: parseFloat(document.documentElement.style.getPropertyValue('--pinH')) || 0,
        barTop,
        rows,
        y: scrollY,
      };
    });
  test('an iPad held upright: the order chips and the code box on one row, and the picture as big as before', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await along(page);
    const r = await rects(page);
    assert.ok(r.find && r.sort, JSON.stringify(r));
    assert.ok(r.find.left > r.sort.right, 'the code box beside the chips');
    assert.ok(Math.abs(r.find.bottom - r.sort.bottom) < 6, 'on one row: ' + JSON.stringify([r.find, r.sort]));
    assert.deepEqual(errors, []);
  });
  test('a phone: Colour along opens with the order chips just under the picture’s tool row once its instructions are seen (the first time, as before)', async () => {
    for (const [w, h] of [
      [390, 844],
      [430, 932],
    ]) {
      const { page, errors } = await openApp({ width: w, height: h });
      await sampleGuide(page);
      await along(page);
      // the first time: the instructions show, as before
      assert.ok(await page.isVisible('#sfAlHint'), 'the first-time instructions');
      const r0 = await rects(page);
      assert.ok(r0.sort.top > r0.pinH + 30, 'not scrolled past them');
      // a row opened: seen
      await page.locator('#sfAlist .sfarow .sfah').first().click();
      await idle(page);
      await back(page);
      await along(page);
      const r = await rects(page);
      assert.ok(
        Math.abs(r.sort.top - (r.pinH + 8)) <= 4,
        `${w}: chips under the tool row: ${JSON.stringify(r)}`,
      );
      assert.ok(r.rows >= 3, `${w}: ${r.rows} marker rows above the bar`);
      // the ⓘ line is a scroll up
      await page.evaluate(() => scrollBy(0, -200));
      await page.waitForTimeout(100);
      assert.ok(await page.isVisible('#sfCtl .sfinfo'), 'the ⓘ line above');
      assert.deepEqual(errors, []);
      await page.context().close();
    }
  });
  test('a marker just finished: its row’s “All N coloured ✓” lights up for a moment; not on opening the list again', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await along(page);
    await page.locator('#sfAlist .sfarow .sfah').first().click();
    await idle(page);
    const k = await page.getAttribute('#sfAlist .sfarow.open', 'data-k');
    await page.click('#sfMarkAll');
    await idle(page);
    const row = `#sfAlist .sfarow[data-k="${k}"]`;
    assert.match(await page.textContent(row + ' .cnt'), /^All \d+ coloured/);
    assert.ok(
      await page.evaluate((s) => document.querySelector(s).classList.contains('sfaflash'), row),
      'lit up',
    );
    // the others don't
    assert.equal(await page.locator('#sfAlist .sfaflash').count(), 1);
    // opening the list again: it's in Done, not lit
    await back(page);
    await along(page);
    assert.equal(await page.locator('#sfAlist .sfaflash').count(), 0);
    assert.deepEqual(errors, []);
  });
}

// ---- from v313-plan.test.mjs ----
// v313 (the Plan): D3, a marker's family from its code for a guide made since v313 (famRule 1), and a guide saved before
// keeping v312's rule for good, its tones' markers and blend companions as they were. D7, a marker running low: a line
// under the tabs with Swap it, and "low" on its Colour along row and in the markers on the page. D4, the one-time
// "Screens and ink differ" line, whose link opens Print with Test strip, and the tab "Share & print" where it fits.
{
  async function markLow(page, k, low = true) {
    await page.click('#mCollection');
    await idle(page);
    await page.evaluate(
      ([k, low]) => {
        if (low) state.ink[k] = 'low';
        else delete state.ink[k];
        save();
        chrome();
      },
      [k, low],
    );
    await page.click('#mSections');
    await idle(page);
  }
  // the markers on the page by how many sections still to colour, most first
  const byCount = (page) =>
    page.evaluate(() => {
      const t = __mstest,
        n = {};
      for (const l of t.assignData.order) {
        const k = t.assignData.assign[l].mkey;
        if (!t.colored[l]) n[k] = (n[k] || 0) + 1;
      }
      return Object.entries(n).sort((a, b) => b[1] - a[1]);
    });
  test('a marker running low: the line under the tabs, Swap it gives its sections still to colour the nearest marker (pinned, one Undo step), coloured ones keep it; “low” on its Colour along row and in the markers on the page', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    const [[k, n]] = await byCount(page);
    // one of its sections coloured: it keeps the marker
    const done = await page.evaluate((k) => {
      const t = __mstest,
        l = t.assignData.order.find((q) => t.assignData.assign[q].mkey === k);
      t.colored[l] = 1;
      return l;
    }, k);
    await markLow(page, k);
    const line = await page.textContent('#sfLowLine');
    assert.match(line, new RegExp(k.split('|')[1] + ' is running low · used on ' + (n - 1) + ' sections'));
    // the markers on the page say so
    await page.click('#sfMkList');
    await idle(page);
    assert.match(await page.textContent(`#sfSheet .sfmlrow[data-k="${k}"]`), /Running low/);
    await page.keyboard.press('Escape');
    await idle(page);
    await page.click('#sfLowSwap');
    await idle(page);
    const after = await page.evaluate(
      ([k, done]) => {
        const t = __mstest,
          A = t.assignData.assign;
        const to = new Set(),
          pinned = [];
        for (const l of t.assignData.order) if (A[l].mkey !== k && t.locks[l] !== undefined) pinned.push(l);
        for (const l of pinned) to.add(A[l].mkey);
        return {
          kept: A[done].mkey,
          left: t.assignData.order.filter((q) => A[q].mkey === k).length,
          to: [...to],
          label: t.planLabel,
        };
      },
      [k, done],
    );
    assert.equal(after.kept, k, 'the coloured one keeps it');
    assert.equal(after.left, 1, 'only that one');
    assert.equal(after.to.length, 1, 'one marker swapped in, pinned');
    assert.notEqual(await page.evaluate((m) => state.ink[m], after.to[0]), 'low');
    assert.match(
      after.label,
      new RegExp('^Swapped ' + k.split('|')[1] + ' for .+ in ' + (n - 1) + ' sections$'),
    );
    assert.equal(await page.isVisible('#sfLowLine'), false, 'the line goes');
    // one Undo step puts them back
    await page.click('#sfPlanUndo');
    await idle(page);
    assert.equal(
      await page.evaluate(
        (k) => __mstest.assignData.order.filter((q) => __mstest.assignData.assign[q].mkey === k).length,
        k,
      ),
      n,
    );
    // Colour along: "low" on its row
    await page.click('#sfColor');
    await idle(page);
    assert.match(await page.textContent(`#sfAlist .sfarow[data-k="${k}"] .sfah`), /low/);
    assert.deepEqual(errors, []);
  });
}

// ---- from v318-polish.test.mjs ----
// v318 polish sweep: smaller fixes found by the v318 reviews, and more of the same kind. Each test fails without its fix.
{
  // Colour along with a marker's row open: a tap on another marker's section, done before, unticked it without a word.
  // Since the review's second pass such a tap asks first, beside the section; a done one is unticked only by Untick it.
  test('another marker’s done section, tapped while one is open: asked, Untick it, nothing changed before', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await idle(page);
    await page.click('#sfColor');
    await idle(page);
    await page.click('#sfAlist .sfarow button.sfah');
    await idle(page);
    await scrollTop(page);
    const l = await page.evaluate(() => {
      const t = __mstest;
      const l = t.assignData.order
        .filter((x) => t.assignData.assign[x].mkey !== t.hlKey)
        .sort((a, b) => t.comps[b].area - t.comps[a].area)[0];
      t.colored[l] = 1;
      t.renderGuide();
      return l;
    });
    const p = await sectionPoint(page, l);
    await page.mouse.click(p.x, p.y);
    await idle(page);
    assert.equal(await page.evaluate((l) => __mstest.colored[l], l), 1, 'still ticked: asked first');
    assert.match(await page.textContent('.sftipask [data-a="tick"]'), /^Untick it$/);
    await page.click('.sftipask [data-a="tick"]');
    await idle(page);
    assert.ok(!(await page.evaluate((l) => __mstest.colored[l], l)), 'unticked by Untick it');
    assert.deepEqual(errors, []);
  });
  // (v318.6 debug) The test above failed once on GitHub, in WebKit, with the Plan still showing: the photo's colours follow
  // a drag 60 ms after it, the controls drawn again with them, and a click whose press and release fall either side of
  // that redraw lands on a Colour along button that's gone by the release, so the browser drops it (a mouse or a
  // trackpad; a finger's tap on an iPad is one piece). The Plan's bar drawn again as it is keeps its buttons.
  test('the Plan’s bar drawn again between a press and its release: Colour along still opens', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await idle(page);
    await scrollTop(page);
    const b = await page.locator('#sfColor').boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.evaluate(() => __mstest.renderControls());
    await page.mouse.up();
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.sfmode), 'color');
    assert.equal(await page.locator('#sfRoot .sfbar').count(), 1, 'one bar');
    // (and back to the Plan, with its bar drawn anew for the stage: still one, still working)
    await page.click('#sfDoneBtn');
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.sfmode), 'guide');
    assert.equal(await page.locator('#sfRoot .sfbar').count(), 1, 'one bar');
    assert.equal(await page.locator('#sfColor').count(), 1);
    await page.click('#sfColor');
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.sfmode), 'color');
    assert.deepEqual(errors, []);
  });
}

// ---- from v318-review-guide.test.mjs ----
// v318 review (the guide's workflow, end to end). Each test fails on v318 as released.
{
  // the sample's sections, biggest first
  const biggest = (page) =>
    page.evaluate(() => {
      const t = __mstest;
      return t.assignData.order.slice().sort((a, b) => t.comps[b].area - t.comps[a].area);
    });
  // A tap on a faded section (another marker's) asks first, beside it (the review's second pass; a toast's Undo before
  // it, still on screen after another guide was opened, had unticked that guide's section of the same number). The
  // question goes as another guide opens, and that guide's ticks are as they were.
  test('the question over a faded section goes as another guide opens, which keeps its ticks', async () => {
    const { page, errors } = await openApp({
      width: 820,
      height: 1180,
      storage: { 'ms-onboarded': '1', 'ms-setup-tip': '1' },
    });
    await page.click('#mSections');
    await idle(page);
    // guide B (the letter page) with every section ticked, in the Library
    await letterGuide(page);
    await page.evaluate(() => {
      const t = __mstest;
      t.assignData.order.forEach((l) => (t.colored[l] = 1));
      t.guideDirty = true;
      t.renderGuide();
    });
    await saveGuide(page);
    await idle(page, 2300);
    const idB = await page.evaluate(() => __mstest.curId);
    // guide A (the sample): a marker's row open, a tap on another marker's section
    await page.evaluate(() => SF.loadSample());
    await idle(page, 1500);
    await page.click('#sfColor');
    await idle(page);
    await page.click('#sfAlist .sfarow button.sfah');
    await idle(page);
    await scrollTop(page);
    const l = await page.evaluate(() => {
      const t = __mstest;
      return t.assignData.order
        .filter((x) => t.assignData.assign[x].mkey !== t.hlKey)
        .sort((a, b) => t.comps[b].area - t.comps[a].area)[0];
    });
    const p = await sectionPoint(page, l);
    await page.mouse.click(p.x, p.y);
    await idle(page);
    assert.ok(await page.isVisible('.sftip.sftipask'), 'asked');
    // B opened from the Library while the question is up
    await page.evaluate(() => openLibrary());
    await page.waitForSelector('#savedOverlay.on');
    await page.click(`#savedList .srow[data-id="${idB}"] .smeta`);
    await page.waitForFunction((id) => __mstest.curId === id && !!__mstest.assignData, idB, {
      timeout: 15000,
    });
    const before = await page.evaluate(() => Array.from(__mstest.colored).join(''));
    await idle(page);
    assert.equal(await page.isVisible('.sftip.sftipask'), false, 'the question gone');
    await page.evaluate(() => {
      const b = document.querySelector('.sftipask [data-a="tick"]');
      if (b) b.click();
    });
    await idle(page);
    assert.equal(
      await page.evaluate(() => Array.from(__mstest.colored).join('')),
      before,
      'B’s ticks as they were',
    );
    assert.deepEqual(errors, []);
  });
  // A finger drifts a few pixels as it taps. The picture took any move over 4 px (across and down added) as a drag, so
  // a tap that rolled 3 across and 2 down ticked nothing.
  test('a finger’s tap that drifts a few pixels still ticks its section; a drag doesn’t', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await idle(page);
    await page.click('#sfColor');
    await idle(page);
    await scrollTop(page);
    const [a, b] = await biggest(page);
    const touchTap = async (l, dx, dy, type = 'touch') => {
      const p = await sectionPoint(page, l);
      await page.evaluate(
        ({ x, y, dx, dy, type }) => {
          const c = document.getElementById('sfCanvas'),
            o = {
              bubbles: true,
              cancelable: true,
              pointerId: 11,
              pointerType: type,
              isPrimary: true,
              button: 0,
            };
          c.dispatchEvent(new PointerEvent('pointerdown', { ...o, buttons: 1, clientX: x, clientY: y }));
          c.dispatchEvent(
            new PointerEvent('pointermove', { ...o, buttons: 1, clientX: x + dx / 2, clientY: y + dy / 2 }),
          );
          c.dispatchEvent(
            new PointerEvent('pointermove', { ...o, buttons: 1, clientX: x + dx, clientY: y + dy }),
          );
          c.dispatchEvent(
            new PointerEvent('pointerup', { ...o, buttons: 0, clientX: x + dx, clientY: y + dy }),
          );
        },
        { x: p.x, y: p.y, dx, dy, type },
      );
      await idle(page);
      return page.evaluate((l) => __mstest.colored[l], l);
    };
    assert.equal(await touchTap(a, 4, 3), 1, 'a finger’s tap that rolled 4 across and 3 down ticks');
    assert.equal(await touchTap(b, 18, 12), 0, 'a drag ticks nothing');
    assert.equal(await touchTap(b, 4, 3, 'mouse'), 0, 'a mouse that moved as far is still a drag, as before');
    assert.deepEqual(errors, []);
  });
  // Colour along with a row open: its sections still to do are outlined. A tick drew the outline again whole (32 copies
  // of a mask over the box round them all), most of a tick's time on a big page; now only round the section ticked. The
  // outline must come out exactly as drawn whole.
  test('a tick redraws the open row’s outline only round its section, exactly as a whole redraw', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await idle(page);
    await page.click('#sfColor');
    await idle(page);
    // the marker with the most sections, and three of them well inside the box round the rest
    const k = await page.evaluate(() => {
      const t = __mstest,
        n = {};
      t.assignData.order.forEach((l) => {
        const m = t.assignData.assign[l].mkey;
        n[m] = (n[m] || 0) + 1;
      });
      return Object.keys(n).sort((a, b) => n[b] - n[a])[0];
    });
    await page.click(`#sfAlist .sfarow[data-k="${k}"] .sfah`);
    await idle(page);
    await scrollTop(page);
    const pick = await page.evaluate((k) => {
      const t = __mstest,
        W = t.W,
        box = {};
      t.labels.forEach((v, p) => {
        if (v < 1) return;
        const x = p % W,
          y = (p / W) | 0,
          b = box[v] || (box[v] = [x, y, x, y]);
        b[0] = Math.min(b[0], x);
        b[1] = Math.min(b[1], y);
        b[2] = Math.max(b[2], x);
        b[3] = Math.max(b[3], y);
      });
      const secs = t.assignData.order.filter((l) => t.assignData.assign[l].mkey === k),
        e = [0, 1, 2, 3].map((i) => (i < 2 ? Math.min : Math.max)(...secs.map((l) => box[l][i])));
      return secs
        .filter(
          (l) =>
            box[l][0] > e[0] + 20 && box[l][1] > e[1] + 20 && box[l][2] < e[2] - 20 && box[l][3] < e[3] - 20,
        )
        .slice(0, 3);
    }, k);
    assert.equal(pick.length, 3);
    const outline = () =>
      page.evaluate(() => {
        const c = document.querySelector('.sfoutline'),
          d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        return { w: c.width, h: c.height, left: c.style.left, top: c.style.top, px: Array.from(d).join() };
      });
    const before = await outline();
    // (the outline's working canvases drawn during the ticks: none as big as the outline itself)
    await page.evaluate(() => {
      const P = CanvasRenderingContext2D.prototype,
        od = P.drawImage;
      window.__olBig = 0;
      P.drawImage = function (img) {
        const c = document.querySelector('.sfoutline');
        if (c && img instanceof HTMLCanvasElement && img.width === c.width && img.height === c.height)
          window.__olBig++;
        return od.apply(this, arguments);
      };
    });
    for (const l of pick) {
      const p = await sectionPoint(page, l);
      await page.mouse.click(p.x, p.y);
      await idle(page);
    }
    assert.equal(await page.evaluate(() => window.__olBig), 0, 'no whole-outline drawing for a tick');
    assert.deepEqual(await page.evaluate((s) => s.map((l) => __mstest.colored[l]), pick), [1, 1, 1]);
    const part = await outline();
    assert.notEqual(part.px, before.px, 'the outline changed');
    // the row closed and opened again: drawn whole
    await page.click(`#sfAlist .sfarow[data-k="${k}"] .sfah`);
    await idle(page);
    await page.click(`#sfAlist .sfarow[data-k="${k}"] .sfah`);
    await idle(page);
    await scrollTop(page);
    const whole = await outline();
    assert.deepEqual([part.w, part.h, part.left, part.top], [whole.w, whole.h, whole.left, whole.top]);
    assert.ok(part.px === whole.px, 'the same pixels');
    assert.deepEqual(errors, []);
  });
  // The tool row was fitted to its width (each try a layout of the page) twice at every tick; now only when something it
  // depends on changes. A figure gaining a digit still fits it again, and it still fits.
  test('a tick doesn’t fit the tool row again unless its status changes shape; it still fits', async () => {
    const { page, errors } = await openApp({ width: 390, height: 844 });
    await sampleGuide(page);
    await idle(page);
    await page.click('#sfColor');
    await idle(page);
    await scrollTop(page);
    await page.evaluate(() => {
      const z = document.getElementById('sfZoomCtl'),
        rm = DOMTokenList.prototype.remove;
      window.__fits = 0;
      DOMTokenList.prototype.remove = function () {
        if (this === z.classList && arguments[0] === 'sfzc1') window.__fits++;
        return rm.apply(this, arguments);
      };
    });
    const order = await biggest(page);
    const tap = async (l) => {
      const p = await sectionPoint(page, l);
      await page.mouse.click(p.x, p.y);
      await idle(page);
    };
    // 1 to 2 coloured: the same shape
    await tap(order[0]);
    const n1 = await page.evaluate(() => window.__fits);
    await tap(order[1]);
    assert.equal(await page.evaluate(() => window.__fits), n1, 'not fitted again for 2 of 166');
    // 9 to 10: one more digit, fitted again
    await page.evaluate(
      (s) => {
        const t = __mstest;
        s.forEach((l) => (t.colored[l] = 1));
      },
      order.slice(2, 9),
    );
    await tap(order[9]);
    assert.match(await page.textContent('#sfStat'), /10\sof\s166/);
    assert.ok((await page.evaluate(() => window.__fits)) > n1, 'fitted again for 10 of 166');
    const fit = await page.evaluate(() => {
      const z = document.getElementById('sfZoomCtl'),
        st = document.getElementById('sfStat');
      return z.scrollWidth <= z.clientWidth + 1 && st.scrollWidth <= st.clientWidth + 1;
    });
    assert.ok(fit, 'the row fits');
    assert.deepEqual(errors, []);
  });
  // Each save asked whether the sections had been edited since the guide was built, by reading every pixel of the
  // section map: a hitch a moment after every tick on a big page. Out of Edit sections the answer is kept; an edit there
  // is still noticed.
  test('saving after ticks doesn’t read the whole section map each time; a section edit is still noticed', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await idle(page);
    await page.click('#sfColor');
    await idle(page);
    await scrollTop(page);
    const order = await biggest(page);
    const p0 = await sectionPoint(page, order[0]);
    await page.mouse.click(p0.x, p0.y);
    await idle(page, 2300);
    const n0 = await page.evaluate(() => __mstest.labelsSigN);
    assert.equal(typeof n0, 'number', 'the reads are counted');
    for (const l of order.slice(1, 4)) {
      const p = await sectionPoint(page, l);
      await page.mouse.click(p.x, p.y);
      // (auto-save 1.5 s later)
      await idle(page, 2300);
    }
    assert.equal(await page.evaluate(() => __mstest.saveErr), false);
    assert.equal(await page.evaluate(() => __mstest.labelsSigN), n0, 'three saves, no reading of the map');
    // Edit sections: a merge, and the guide knows its sections are edited and not built
    await page.click('#sfDoneBtn');
    await idle(page);
    await page.click('#sfBack2');
    await idle(page);
    await scrollTop(page);
    const [a, b] = await page.evaluate(() => {
      const t = __mstest,
        cl = t.countedList(),
        W = t.W,
        L = t.labels;
      for (const x of cl)
        for (let i = 0; i < L.length; i++)
          if (L[i] === x)
            for (const d of [3, 3 * W]) {
              const y = L[i + d];
              if (y > 0 && y !== x && cl.includes(y) && t.comps[x].area > 400 && t.comps[y].area > 400)
                return [x, y];
            }
      return [cl[0], cl[1]];
    });
    await page.click('#sfEdit [data-m="merge"]');
    for (const l of [a, b]) {
      const p = await sectionPoint(page, l);
      await page.mouse.click(p.x, p.y);
      await idle(page);
    }
    assert.equal(await page.evaluate(() => __mstest.secEdPending()), true, 'the merge is an edit not built');
    assert.equal(
      await page.evaluate(() => __mstest.currentDesignObj()),
      null,
      'not saved as the guide as built',
    );
    assert.deepEqual(errors, []);
  });
}

// ---- from v318-review-ux.test.mjs ----
// v318 review (UI/UX pass), and its audit: Escape leaves the photo's editors in Check the sections (Adjust corners,
// Crop) as their Cancel does, only while the Guide screen shows; the browser's Back in the first-run welcome goes back
// a step; Colour along's tap on another marker's section is said, with Undo; Tester tasks' Send results with nothing
// answered sends nothing; on a phone, a PDF that won't open is said in view. Each fails on v318 as released.
{
  // Colour along with a marker's row open: a tap on a faded section (another marker's) asks first, beside it: Open that
  // marker or Tick it (Untick it when ticked). (Wave one ticked it and said so, with Undo; v318 as released ticked it
  // silently.)
  test('a tap on another marker’s section while one is open asks first: Open it, or Tick it / Untick it', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await idle(page);
    await page.click('#sfColor');
    await idle(page);
    await page.click('#sfAlist .sfarow button.sfah');
    await idle(page);
    await scrollTop(page);
    const l = await page.evaluate(() => {
      const t = __mstest;
      return t.assignData.order
        .filter((x) => t.assignData.assign[x].mkey !== t.hlKey)
        .sort((a, b) => t.comps[b].area - t.comps[a].area)[0];
    });
    const p = await sectionPoint(page, l),
      hk = await page.evaluate(() => __mstest.hlKey),
      code = await page.evaluate((l) => __mstest.assignData.assign[l].code, l);
    await page.mouse.click(p.x, p.y);
    await idle(page);
    assert.ok(!(await page.evaluate((l) => __mstest.colored[l], l)), 'nothing ticked yet');
    assert.ok(await page.isVisible('.sftip.sftipask'), 'the question, beside the section');
    assert.match(await page.textContent('.sftipask'), new RegExp(`not \\S+Open ${code}Tick it$`));
    // a second tap on it closes the question, ticking nothing
    await page.mouse.click(p.x, p.y);
    await idle(page);
    assert.equal(await page.isVisible('.sftip.sftipask'), false);
    assert.ok(!(await page.evaluate((l) => __mstest.colored[l], l)));
    // Tick it
    await page.mouse.click(p.x, p.y);
    await idle(page);
    await page.click('.sftipask [data-a="tick"]');
    await idle(page);
    assert.equal(await page.evaluate((l) => __mstest.colored[l], l), 1, 'ticked');
    assert.equal(await page.evaluate(() => __mstest.hlKey), hk, 'the open row stays');
    // ticked, it asks Untick it; and the question stays while the tick's fade draws the picture again
    await page.mouse.click(p.x, p.y);
    await pause(
      page,
      800,
      'the tick just made fades in over the next moments, each step drawing the picture again',
    );
    await idle(page);
    assert.ok(await page.isVisible('.sftip.sftipask'), 'still asked');
    assert.match(await page.textContent('.sftipask [data-a="tick"]'), /^Untick it$/);
    await page.click('.sftipask [data-a="tick"]');
    await idle(page);
    assert.ok(!(await page.evaluate((l) => __mstest.colored[l], l)), 'unticked');
    // Open: that marker's row, as a press and hold does
    await page.mouse.click(p.x, p.y);
    await idle(page);
    await page.click('.sftipask [data-a="open"]');
    await idle(page);
    assert.equal(
      await page.evaluate((l) => __mstest.hlKey === __mstest.assignData.assign[l].mkey, l),
      true,
      'its row open',
    );
    assert.ok(!(await page.evaluate((l) => __mstest.colored[l], l)), 'and nothing ticked');
    await scrollTop(page);
    // its own marker's section: no word
    const own = await page.evaluate(
      () =>
        __mstest.assignData.order
          .filter((x) => __mstest.assignData.assign[x].mkey === __mstest.hlKey)
          .sort((a, b) => __mstest.comps[b].area - __mstest.comps[a].area)[0],
    );
    const q = await sectionPoint(page, own);
    await page.mouse.click(q.x, q.y);
    await idle(page);
    assert.equal(await page.evaluate((l) => __mstest.colored[l], own), 1);
    assert.ok(
      !(await page.evaluate(() =>
        /not the marker/.test((document.querySelector('#msToast.on') || {}).textContent || ''),
      )),
    );
    assert.deepEqual(errors, []);
  });
}

// ---- from v31822-third.test.mjs ----
// v318.22, the third debugging pass, in the browser: Colour along keeps the open row clear of Mark all's toast;
// Tick colours on a chart asks before its ticks are thrown away; Undo of a zone's first sections in its editor keeps
// the editor, and after Done takes the empty zone away; a section coloured with a dry marker's stand-in, or pinned to a
// marker gone dry, is saved as it is on the paper; the keyboard kept off the page (To buy, Full screen); the Also: line
// of a family; Tester answers given in two tabs. Each fails on v318.22's first build (68199d0).
{
  const R = (b) => ({ l: b.left, t: b.top, r: b.right, b: b.bottom });
  const over = (a, b) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
  async function tapSec(page, l) {
    const p = await sectionPoint(page, l);
    await page.mouse.click(p.x, p.y);
    await idle(page);
  }
  for (const [w, h] of [
    [820, 1180],
    [390, 844],
  ]) {
    test(`${w}×${h}: Mark all on the last marker of Colour along: its toast’s Undo is not over the row’s own buttons`, async () => {
      const { page, errors } = await openApp({ width: w, height: h });
      await sampleGuide(page);
      await idle(page);
      await page.click('#sfColor');
      await idle(page);
      await page.$$eval('#sfAlist .sfarow .sfah', (bs) => bs[bs.length - 1].click());
      await idle(page, 600);
      await page.click('#sfMarkAll');
      await page.waitForSelector('#msToast.on');
      await idle(page, 200);
      const g = await page.evaluate(() => ({
        undo: document.querySelector('#msToast button').getBoundingClientRect().toJSON(),
        btns: [...document.querySelectorAll('#sfAlist .sfarow.open .sfacts button')].map((b) =>
          b.getBoundingClientRect().toJSON(),
        ),
      }));
      assert.ok(g.btns.length >= 2);
      assert.ok(!g.btns.some((b) => over(R(g.undo), R(b))), JSON.stringify(g));
      assert.deepEqual(errors, []);
    });
  }
  test('Tick colours on a chart: a tap beside the card, or Escape, with ticks not saved asks first; Keep ticking keeps them', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await welcome(page, 'look');
    const n0 = await page.evaluate(() => state.owned.size);
    await page.evaluate(() => openChart());
    await page.waitForSelector('#chartOverlay.on');
    await page.click('#chGrid .chsw[aria-pressed="false"]');
    await page.mouse.click(30, 600);
    await idle(page);
    assert.ok(await page.$('#sfEdAsk'), 'asked');
    await page.click('#sfEdAsk [data-a="stay"]');
    await idle(page);
    assert.ok(await page.isVisible('#chartOverlay.on'));
    assert.match(await page.textContent('#chSave'), /^Add 1 marker$/);
    await page.keyboard.press('Escape');
    await idle(page);
    assert.ok(await page.$('#sfEdAsk'), 'Escape asks too');
    await page.click('#sfEdAsk [data-a="drop"]');
    await idle(page);
    assert.equal(await page.isVisible('#chartOverlay.on'), false);
    assert.equal(await page.evaluate(() => state.owned.size), n0, 'nothing added');
    // (with nothing changed it closes at once)
    await page.evaluate(() => openChart());
    await page.waitForSelector('#chartOverlay.on');
    await page.mouse.click(30, 600);
    await idle(page);
    assert.equal(await page.$('#sfEdAsk'), null);
    assert.equal(await page.isVisible('#chartOverlay.on'), false);
    assert.deepEqual(errors, []);
  });
  test('a zone: Undo of a mis-tap in its editor keeps the editor; after Done, Undo of its first sections takes the empty zone away, Redo brings it back', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await page.click('.sftabbtn[data-t="pattern"]');
    await idle(page);
    const Z = () =>
      page.evaluate(() => ({
        edit: __mstest.zoneEdit,
        n: __mstest.zones.map((z) => Object.keys(z.secs).length),
      }));
    await page.click('#sfZoneAdd');
    await idle(page);
    const [a, b] = await page.evaluate(() => {
      const t = __mstest;
      return t.assignData.order
        .slice()
        .sort((x, y) => t.comps[y].area - t.comps[x].area)
        .slice(0, 2);
    });
    await scrollTop(page);
    await tapSec(page, a);
    await page.click('#sfPlanUndo');
    await idle(page);
    assert.deepEqual(await Z(), { edit: true, n: [0] }, 'the editor stays on the zone being made');
    await tapSec(page, a);
    await tapSec(page, b);
    await page.click('#sfZoneDone');
    await idle(page);
    await page.click('#sfPlanUndo');
    await idle(page);
    await page.click('#sfPlanUndo');
    await idle(page);
    assert.deepEqual(await Z(), { edit: false, n: [] }, 'no empty zone left');
    await page.click('#sfPlanRedo');
    await idle(page);
    await page.click('#sfPlanRedo');
    await idle(page);
    assert.deepEqual(await Z(), { edit: false, n: [2] });
    assert.deepEqual(errors, []);
  });
  test('a marker gone dry: a section coloured with its stand-in is saved as the stand-in; one pinned to it keeps its pin’s marker', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await saveGuide(page);
    const K = 'Ohuhu|R413';
    const secs = await page.evaluate((k) => {
      const t = __mstest;
      return t.assignData.order
        .filter((l) => t.assignData.assign[l].mkey === k)
        .sort((a, b) => t.comps[b].area - t.comps[a].area);
    }, K);
    assert.ok(secs.length >= 2);
    const [P, L] = secs;
    // (pinned to R413 first)
    await scrollTop(page);
    await tapSec(page, P);
    await page.click('.sftip [data-a="pin"]');
    await idle(page);
    await page.mouse.click(5, 5);
    await idle(page);
    await page.evaluate((k) => setInk(keyIdx(k), 'dry'), K);
    await idle(page);
    const shown = await page.evaluate((l) => __mstest.assignData.assign[l].mkey, L);
    assert.notEqual(shown, K, 'a stand-in shown');
    await page.click('#sfColor');
    await idle(page);
    await scrollTop(page);
    await tapSec(page, L);
    assert.equal(await page.evaluate((l) => !!__mstest.colored[l], L), true);
    const d = await page.evaluate(() => JSON.parse(JSON.stringify(__mstest.currentDesignObj().payload)));
    assert.equal(d.assign[L], shown, 'coloured with the stand-in: saved as it');
    assert.equal(d.assign[P], K, 'pinned: saved as the marker pinned');
    assert.deepEqual(errors, []);
  });
  test('a zone emptied by another zone’s editor and kept stays through Undo and Redo of other steps', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await page.click('.sftabbtn[data-t="pattern"]');
    await idle(page);
    const [a, b] = await page.evaluate(() => {
      const t = __mstest;
      return t.assignData.order
        .slice()
        .sort((x, y) => t.comps[y].area - t.comps[x].area)
        .slice(0, 2);
    });
    await scrollTop(page);
    // (Zone 1 with a; Zone 2 takes a from it; Done keeps Zone 1, now empty)
    await page.click('#sfZoneAdd');
    await idle(page);
    await tapSec(page, a);
    await page.click('#sfZoneDone');
    await idle(page);
    // (with a zone, ＋ is a chip of its own)
    await page.click('#sfPanel-pattern .sfzchip[data-z="new"]');
    await idle(page);
    await tapSec(page, b);
    await tapSec(page, a);
    await page.click('#sfZoneDone');
    await idle(page);
    const z = () => page.evaluate(() => __mstest.zones.map((x) => x.name + ':' + Object.keys(x.secs).length));
    assert.deepEqual(await z(), ['Zone 1:0', 'Zone 2:2']);
    await page.click('#sfPlanUndo');
    await idle(page);
    await page.click('#sfPlanRedo');
    await idle(page);
    assert.deepEqual(await z(), ['Zone 1:0', 'Zone 2:2'], 'kept');
    assert.deepEqual(errors, []);
  });
  test('a section pinned to a dry marker’s stand-in keeps it when the marker is refilled', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    const K = 'Ohuhu|R413';
    const P = await page.evaluate((k) => {
      const t = __mstest;
      return t.assignData.order
        .filter((l) => t.assignData.assign[l].mkey === k)
        .sort((a, b) => t.comps[b].area - t.comps[a].area)[0];
    }, K);
    await page.evaluate((k) => setInk(keyIdx(k), 'dry'), K);
    await idle(page);
    const stand = await page.evaluate((l) => __mstest.assignData.assign[l].mkey, P);
    assert.notEqual(stand, K);
    await scrollTop(page);
    await tapSec(page, P);
    await page.click('.sftip [data-a="pin"]');
    await idle(page);
    await page.mouse.click(5, 5);
    await idle(page);
    await page.evaluate((k) => setInk(keyIdx(k), null), K);
    await idle(page);
    assert.equal(
      await page.evaluate((l) => __mstest.assignData.assign[l].mkey, P),
      stand,
      'the pinned stand-in stays',
    );
    assert.deepEqual(errors, []);
  });
  test('Tick colours on a chart: two swatches of a family with one code, the older cap’s marked *', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await welcome(page, 'look');
    await page.evaluate(() => {
      state.capDef = 'old';
      state.owned = new Set(['Ohuhu|R23']);
      state.cap = { 'Ohuhu|R23': 'new' };
      save();
      openChart();
    });
    await page.waitForSelector('#chartOverlay.on');
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('#chFams button')].find((x) => x.dataset.f === 'Red');
      if (b) b.click();
    });
    await idle(page);
    const labs = await page.$$eval('#chGrid .chsw span', (s) =>
      s.map((x) => x.textContent).filter((t) => /^R23\*?$/.test(t)),
    );
    assert.deepEqual(labs.sort(), ['R23', 'R23*']);
    assert.deepEqual(errors, []);
  });
  test('the keyboard: Full screen keeps to the picture and gives the keyboard back; To buy’s Bought ✓ leaves it on the next row', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await idle(page);
    await page.focus('#sfFull');
    await page.keyboard.press('Enter');
    await idle(page);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'sfFullX');
    // (Tab goes round what full screen shows: the guide's header, reached behind it as before, and the picture's own
    // controls; never the Plan's hidden under it, nor nowhere)
    const seen = new Set();
    for (let k = 0; k < 12; k++) {
      await page.keyboard.press('Tab');
      const w = await page.evaluate(() => {
        const a = document.activeElement;
        return {
          id: a.id,
          ok: document.getElementById('sfView').contains(a) || document.getElementById('sfHead').contains(a),
        };
      });
      assert.ok(w.ok && w.id, 'Tab ' + k + ' on ' + JSON.stringify(w));
      seen.add(w.id);
    }
    assert.ok(seen.size >= 5, [...seen].join(' '));
    assert.ok(seen.has('sfFullX') && seen.has('sfZin'), [...seen].join(' '));
    await page.keyboard.press('Escape');
    await idle(page);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'sfFull');
    // To buy
    await page.evaluate(() => {
      state.wish = ['Ohuhu|Y26', 'Ohuhu|G36', 'Ohuhu|B115'].map((k) => ({ k: k, t: 1 }));
      save();
    });
    await page.click('#mCollection');
    await idle(page);
    await page.click('#ownView [data-v="wish"]');
    await idle(page);
    await page.focus('#wishView [data-bought]');
    await page.keyboard.press('Enter');
    await idle(page);
    const f = await page.evaluate(() => [
      document.activeElement.tagName,
      document.activeElement.dataset.bought || '',
    ]);
    assert.notEqual(f[0], 'BODY');
    assert.ok(f[1], 'on a Bought ✓: ' + f.join(' '));
    assert.deepEqual(errors, []);
  });
  test('Markers: “Also: the … family” shows that family only, though another was chosen before', async () => {
    const { page, errors } = await openApp();
    await welcome(page, 'look');
    await page.click('#mCollection');
    await idle(page);
    await page.click('#ownView [data-v="all"]');
    await idle(page);
    await page.evaluate(() => {
      fgTap('fam', 'Red');
      fgTap('fam', 'Blue');
      filterChanged();
    });
    await page.fill('#q', 'red');
    await idle(page);
    const go = await page.$('.mkfamgo');
    assert.ok(go, 'the line is offered');
    const fams = await go.getAttribute('data-fams');
    await go.click();
    await idle(page);
    const on = await page.evaluate(() => [...FG.fam.get()]);
    assert.deepEqual(on.sort(), fams.split('|').sort());
    assert.deepEqual(errors, []);
  });
  test('Tester answers given in two tabs: neither tab’s write loses the other’s', async () => {
    const { page, ctx, errors } = await openApp();
    const t1 = { id: 'TABC', name: '', t: { add: { r: 'easy', n: '', v: '' } }, q: {}, sends: 0, sig: '' };
    await page.evaluate((o) => localStorage.setItem('ms-tester', JSON.stringify(o)), t1);
    await page.reload();
    await idle(page);
    const p2 = await ctx.newPage();
    await p2.goto(page.url());
    await idle(p2);
    // (each tab has read the answers: as when the tasks were shown in each)
    await page.evaluate(() => testerBackup());
    await p2.evaluate(() => testerBackup());
    await page.evaluate(() =>
      testerRestore({ id: 'TABC', t: { guide: { r: 'hard', n: 'lost my place', v: '' } } }),
    );
    await idle(p2);
    await p2.evaluate(() => testerRestore({ id: 'TABC', t: { plan: { r: 'ok', n: '', v: '' } } }));
    const t = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('ms-tester')).t).sort());
    assert.deepEqual(t, ['add', 'guide', 'plan']);
    assert.deepEqual(errors, []);
  });
}

// ---- from v31825-x3.test.mjs ----
// v318.25 in the browser.
{
  test('X3 E2: finishing the page again after a tick taken back says so again', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await page.click('#sfColor');
    await idle(page);
    const last = await page.evaluate(() => {
      const t = __mstest,
        o = t.assignData.order;
      for (const l of o) t.colored[l] = 1;
      t.colored[o[o.length - 1]] = 0;
      // (v320: the finish is the finished card's strokes, counted as they start; it was the list's confetti)
      window.__fin0 = t.finishStrokesRuns;
      t.renderGuide();
      return o[o.length - 1];
    });
    const tap = async () => {
      const p = await sectionPoint(page, last);
      await page.mouse.click(p.x, p.y);
      await idle(page);
      await pause(page, 450, 'the next tap on the same section is not a double tap');
    };
    await tap();
    const fin = () => page.evaluate(() => __mstest.finishStrokesRuns - __fin0);
    await page.waitForFunction(() => __mstest.finishStrokesRuns - __fin0 >= 1).catch(() => {});
    assert.equal(await fin(), 1, 'finished');
    await tap();
    assert.equal(await page.evaluate((l) => __mstest.colored[l], last), 0, 'taken back');
    await tap();
    await page.waitForFunction(() => __mstest.finishStrokesRuns - __fin0 >= 2).catch(() => {});
    assert.equal(await fin(), 2, 'finished again, celebrated and said again');
    assert.deepEqual(errors, []);
  });
}

// (v323.1) Colour along zoomed in: the outlines drawn sharp over the part of the picture on the screen, moving with
// the picture (its transform), gone for Reveal and back at the fit (where its pixels don't show on a 2× screen)
{
  test('Colour along, zoomed in: a sharp copy over the picture that moves with it; none for Reveal or at the fit', async () => {
    const { page, errors } = await openApp({ width: 390, height: 844 });
    await sampleGuide(page);
    await page.click('#sfColor');
    await idle(page);
    const sh = () =>
      page.evaluate(() => {
        const e = document.getElementById('sfSharp'),
          c = document.getElementById('sfCanvas');
        return e
          ? {
              on: !e.hidden,
              follows: e.style.transform.startsWith(c.style.transform),
              next: e.previousSibling === c,
            }
          : { on: false };
      });
    await pause(page, 600, 'the sharp copy’s moment');
    assert.equal((await sh()).on, false, 'none at the fit');
    for (let i = 0; i < 3; i++) {
      await page.click('#sfZin');
      await idle(page);
    }
    await until(
      page,
      () => !!document.getElementById('sfSharp') && !document.getElementById('sfSharp').hidden,
      null,
      'drawn sharp',
    );
    assert.deepEqual(await sh(), { on: true, follows: true, next: true });
    await page.click('#sfZrst');
    await idle(page);
    await pause(page, 600, 'the sharp copy’s moment');
    assert.equal((await sh()).on, false, 'gone at the fit again');
    assert.deepEqual(errors, []);
  });
}
