// The shell: tabs, sheets, buttons, Escape and Back, keyboard and screen readers, toasts, tap areas, installing.
// (v320) Tests organised by feature: each block below came from the file named above it, its tests unchanged.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ENGINE,
  ROOT,
  WK,
  answerAsks,
  idle,
  letterGuide,
  notOnWebKit,
  openApp,
  openBackupDialog,
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

before(setup);
after(teardown);

// ---- from sheet.test.mjs ----
// The section tip and the shared sheet (Release 3, #2, docs/GUIDE-LAYOUT.md): the tip sits outside the shrinking
// picture, above or below the tapped section and never over it, and closes on scroll; Change colour, Manual's picker,
// the Paint brush picker and Blend's anchor menu are the shared sheet under the picture pinned at its floor size, with
// a pulsing outline on the section(s) being changed; a tap on another section keeps the pick (one Undo step) and
// moves the sheet there. Also: sheets in portrait (the page locked while open) and on a tablet.
{
  // the app with console errors collected alongside page errors
  async function open(opts) {
    const app = await openApp(opts);
    app.page.on('console', (m) => {
      if (m.type() === 'error') app.errors.push('console: ' + m.text());
    });
    await sampleGuide(app.page);
    return app;
  }
  const rect = (page, sel) =>
    page.evaluate((s) => {
      const e = document.querySelector(s);
      return e ? e.getBoundingClientRect().toJSON() : null;
    }, sel);
  // big sections whose label points show on the picture (above an open sheet and the tool row), biggest first
  const shownSecs = (page, n = 8, not = []) =>
    page.evaluate(
      ([n, not]) => {
        const t = __mstest,
          c = document.getElementById('sfCanvas'),
          r = c.getBoundingClientRect(),
          sh = document.getElementById('sfSheet'),
          z = document.getElementById('sfZoomCtl').getBoundingClientRect(),
          k = r.width / c.width;
        const bot = Math.min(
            r.bottom,
            innerHeight,
            sh && !sh.classList.contains('sfshside') ? sh.getBoundingClientRect().top : 1e9,
            z.top > r.top + 20 ? z.top : 1e9,
          ),
          top = Math.max(r.top, 0);
        return t.assignData.order
          .filter((l) => !not.includes(l))
          .filter((l) => {
            const q = t.labelPos(l),
              x = r.left + q.x * k,
              y = r.top + q.y * k;
            return y > top + 12 && y < bot - 12 && x > r.left + 12 && x < r.right - 12 && q.r * k > 5;
          })
          .sort((a, b) => t.comps[b].area - t.comps[a].area)
          .slice(0, n);
      },
      [n, not],
    );
  const mk = (page, l) => page.evaluate((l) => __mstest.assignData.assign[l].mkey, l);
  const lock = (page, l) => page.evaluate((l) => __mstest.locks[l] ?? null, l);
  const plans = (page) => page.evaluate(() => __mstest.planCount);
  const outlined = (page) =>
    page.evaluate(() => {
      const o = document.querySelector('.sfoutline');
      return o && o.style.display !== 'none' && o.dataset.secs ? o.dataset.secs.split(' ').map(Number) : [];
    });
  const pickerOpen = (page) => page.evaluate(() => !!document.querySelector('#sfSheet.sfpicksh'));
  // a click on a section's label point where it is on the screen now (no scrolling)
  async function click(page, l) {
    const p = await sectionPoint(page, l);
    await page.mouse.click(p.x, p.y);
    await idle(page);
  }
  // a marker from a family other than `not`'s
  const otherKey = (page, not) =>
    page.evaluate((not) => {
      const b = [...document.querySelectorAll('#sfPopSw .sfswg:not(.sfswrec) .sfsw')];
      const cur = b.find((x) => x.dataset.k === not);
      const g = cur && cur.closest('.sfswg');
      return b.find((x) => x.dataset.k !== not && x.closest('.sfswg') !== g).dataset.k;
    }, not);
  const pickTile = (page, k) => page.click(`#sfPopSw .sfswg:not(.sfswrec) .sfsw[data-k="${k}"]`);
  async function changeColour(page, l) {
    await scrollTop(page);
    await click(page, l);
    await page.click('.sftip [data-a="change"]');
    await page.waitForSelector('#sfSheet.sfpicksh');
    await idle(page);
  }
  async function pattern(page, v) {
    await page.click('.sftabbtn[data-t="pattern"]');
    await page.click(`#sfFam [data-v="${v}"]`);
    await idle(page);
  }
  // the section's box on the screen (from its pixels)
  const secBox = (page, l) =>
    page.evaluate((l) => {
      const t = __mstest,
        c = document.getElementById('sfCanvas'),
        r = c.getBoundingClientRect(),
        k = r.width / t.W;
      let x0 = 1e9,
        y0 = 1e9,
        x1 = -1,
        y1 = -1;
      for (let y = 0; y < t.H; y++)
        for (let x = 0; x < t.W; x++)
          if (t.labels[y * t.W + x] === l) {
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
            if (y < y0) y0 = y;
            if (y > y1) y1 = y;
          }
      return {
        left: r.left + x0 * k,
        top: r.top + y0 * k,
        right: r.left + (x1 + 1) * k,
        bottom: r.top + (y1 + 1) * k,
      };
    }, l);
  // ---- From Release 3 (docs/GUIDE-LAYOUT.md) ----
  const picH = (page) =>
    page.evaluate(() => Math.round(document.getElementById('sfCanvas').getBoundingClientRect().height));
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
  // ---- From the fifth review (guide screen) ----
  const SHOTS = process.env.SHOTS || '';
  const shot = (page, name) => (SHOTS ? page.screenshot({ path: SHOTS + '/' + name + '.png' }) : null);
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
  async function openChangeColour(page, l) {
    await scrollTop(page);
    await tapSection(page, l);
    await page.click('.sftip [data-a="change"]');
    await page.waitForSelector('#sfSheet.sfpicksh');
    await idle(page);
  }
  for (const [w, h, avail] of [
    [390, 844, 420],
    [375, 667, 356],
  ]) {
    test(`${w}×${h}: Change colour opens as a sheet under the picture pinned at its floor size, never over it`, async () => {
      const { page, errors } = await open({ width: w, height: h });
      const [l] = await shownSecs(page, 1);
      await changeColour(page, l);
      // (waiting for the sheet to arrive, not for its slide to end: GitHub's WebKit can leave a transition unfinished)
      await until(
        page,
        ([w, h]) => {
          const s = document.getElementById('sfSheet').getBoundingClientRect();
          return Math.abs(s.bottom - h) < 1 && s.left === 0 && s.width === w;
        },
        [w, h],
        'the sheet in place',
        15000,
      ).catch(() => {});
      const g = await page.evaluate(() => ({
        s: __mstest.picScale,
        geo: __mstest.geo,
        y: scrollY,
        lock: getComputedStyle(document.documentElement).overflow,
      }));
      // (v289: on a short phone the Plan's picture may start at its floor already, so that the tabs show)
      assert.ok(
        Math.abs(g.s - g.geo.comp / g.geo.full) < 0.003,
        `picture at its floor size (${g.s} vs ${g.geo.comp / g.geo.full})`,
      );
      const sh = await rect(page, '#sfSheet'),
        cv = await rect(page, '#sfCanvas'),
        v = await rect(page, '#sfView');
      assert.ok(
        sh.top >= v.bottom - 0.5 && sh.top >= cv.bottom - 0.5,
        `the sheet starts under the picture (${sh.top} vs ${v.bottom})`,
      );
      assert.ok(
        Math.abs(sh.bottom - h) < 1 && sh.left === 0 && sh.width === w,
        'to the bottom of the screen, across it',
      );
      assert.ok(Math.abs(sh.height - avail) < 12, `about ${avail}px of room: ${sh.height}`);
      // header: title and the code field, never focused by itself; footer Cancel / Done
      assert.equal(await page.textContent('#sfSheetT'), 'Change colour');
      assert.ok(
        await page.evaluate(
          () => document.getElementById('sfSheet').querySelector('.sfshhd #sfPopFilter') !== null,
        ),
      );
      assert.deepEqual(
        await page.$$eval('#sfSheet .sfshft button', (b) => b.map((x) => x.id + ':' + x.textContent)),
        ['sfPopCancel:Cancel', 'sfPopConfirm:Done'],
      );
      assert.ok(
        await page.evaluate(
          () =>
            document.activeElement.id !== 'sfPopFilter' &&
            document.getElementById('sfSheet').contains(document.activeElement),
        ),
        'focus in the sheet, not in the code field',
      );
      // the outline on the tapped section, pulsing
      assert.deepEqual(await outlined(page), [l]);
      assert.equal(
        await page.evaluate(() => getComputedStyle(document.querySelector('.sfoutline')).animationName),
        'sfolpulse',
      );
      const ol = await rect(page, '.sfoutline'),
        bx = await secBox(page, l);
      assert.ok(
        ol.left <= bx.left &&
          ol.top <= bx.top &&
          ol.right >= bx.right &&
          ol.bottom >= bx.bottom &&
          ol.width < bx.right - bx.left + 20,
        'the outline is round that section',
      );
      // the page doesn't scroll under the sheet
      assert.equal(g.lock, 'hidden');
      await page.mouse.move(cv.left + cv.width / 2, cv.top + 30);
      await page.mouse.wheel(0, 300);
      await idle(page);
      assert.equal(await page.evaluate(() => scrollY), g.y, 'page scroll locked');
      // Done: nothing picked, nothing saved; the page stays where the sheet put it
      const n0 = await plans(page);
      await page.click('#sfPopConfirm');
      await idle(page);
      assert.equal(await pickerOpen(page), false);
      assert.equal(await plans(page), n0);
      assert.deepEqual(await outlined(page), [], 'outline gone');
      assert.equal(await page.evaluate(() => scrollY), g.y);
      assert.deepEqual(errors, []);
    });
  }
  test('the tip keeps its size outside the shrunk picture, never covers its section, and closes on scroll', async () => {
    const { page, errors } = await open({ width: 390, height: 844 });
    // shrink the picture to its floor
    const top0 = await page.evaluate(
      () => document.getElementById('sfView').getBoundingClientRect().top + scrollY,
    );
    await page.evaluate(
      (y) =>
        new Promise((r) => {
          scrollTo(0, y);
          requestAnimationFrame(() => requestAnimationFrame(r));
        }),
      Math.round(top0) + 120,
    );
    assert.ok(
      await page.evaluate(
        () =>
          __mstest.picScale < 1 &&
          Math.abs(__mstest.picScale - __mstest.geo.comp / __mstest.geo.full) < 0.003,
      ),
      'picture shrunk',
    );
    const ls = await shownSecs(page, 40),
      tried = [];
    // sections from the top, middle and bottom of the picture, big and small
    const pick = await page.evaluate((ls) => {
      const t = __mstest,
        f = (l) => t.labelPos(l).y / t.H;
      return [
        ls.find((l) => f(l) < 0.25),
        ls.find((l) => f(l) > 0.4 && f(l) < 0.6),
        ls.find((l) => f(l) > 0.75),
        ls[ls.length - 1],
      ].filter((l) => l != null);
    }, ls);
    for (const l of pick) {
      // (the last section's tip closed first: it can cover the next one's label, and the tap landed on it, v314)
      if (await page.locator('.sftip').count()) {
        await page.keyboard.press('Escape');
        await idle(page);
      }
      await click(page, l);
      await page.waitForSelector('.sftip');
      assert.equal(
        await page.textContent('.sftip b'),
        await page.evaluate((l) => __mstest.assignData.assign[l].code, l),
        `section ${l}'s own tip`,
      );
      const t = await rect(page, '.sftip'),
        b = await secBox(page, l),
        v = await rect(page, '#sfView');
      const unscaled = await page.evaluate(() => {
        const e = document.querySelector('.sftip');
        return Math.abs(e.getBoundingClientRect().height - e.offsetHeight) < 0.5 && !e.closest('#sfPic');
      });
      assert.ok(unscaled, 'not in the scaled wrapper');
      const clear =
        t.bottom <= Math.max(b.top, v.top) + 0.5 ||
        t.top >= Math.min(b.bottom, v.bottom) - 0.5 ||
        t.right <= b.left ||
        t.left >= b.right;
      assert.ok(clear, `tip clear of section ${l}: tip ${JSON.stringify(t)} section ${JSON.stringify(b)}`);
      assert.ok(t.left >= 0 && t.right <= 390 && t.top >= 0 && t.bottom <= 844, 'on the screen');
      tried.push(t.bottom <= b.top + 0.5 ? 'above' : 'below');
    }
    assert.ok(tried.includes('above'), 'above where there is room: ' + tried);
    // a section at the top of the pinned picture has no room above: the tip goes below it
    const topL = await page.evaluate(() => {
      const t = __mstest,
        c = document.getElementById('sfCanvas'),
        r = c.getBoundingClientRect(),
        k = r.width / t.W;
      return t.assignData.order
        .filter((l) => {
          const q = t.labelPos(l),
            y = r.top + q.y * k;
          return y > r.top + 8 && y < r.top + 60 && q.r * k > 5;
        })
        .sort((a, b) => t.comps[b].area - t.comps[a].area)[0];
    });
    if (topL != null) {
      await click(page, topL);
      const t = await rect(page, '.sftip'),
        b = await secBox(page, topL);
      assert.ok(
        t.top >= Math.min(b.bottom, (await rect(page, '#sfView')).bottom) - 0.5,
        'below a section at the top',
      );
    }
    // scrolling closes it
    await page.evaluate(() => scrollBy(0, -40));
    await idle(page);
    assert.equal(await page.locator('.sftip').count(), 0, 'closed on scroll');
    assert.deepEqual(errors, []);
  });
  test('Everywhere outlines every section it changes; the scope starts at Only this section each time; steady with reduced motion', async () => {
    const { page, errors } = await open({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const ls = await shownSecs(page, 20);
    const l = await page.evaluate((ls) => {
      const a = __mstest.assignData.assign;
      return ls.find((l) => Object.keys(a).filter((x) => a[x].mkey === a[l].mkey).length > 2);
    }, ls);
    await changeColour(page, l);
    assert.equal(
      await page.evaluate(() => getComputedStyle(document.querySelector('.sfoutline')).animationName),
      'none',
      'a steady outline',
    );
    const n = +(await page.textContent('.sfpopscope [data-sc="all"]')).match(/\((\d+) sections\)/)[1];
    const same = await page.evaluate((l) => {
      const a = __mstest.assignData.assign;
      return Object.keys(a)
        .filter((x) => a[x].mkey === a[l].mkey)
        .map(Number);
    }, l);
    await pickTile(page, await otherKey(page, await mk(page, l)));
    await page.click('.sfpopscope [data-sc="all"]');
    await idle(page);
    const o = await outlined(page);
    assert.equal(o.length, n, `${n} outlined`);
    assert.deepEqual(
      o.slice().sort((a, b) => a - b),
      same.slice().sort((a, b) => a - b),
    );
    // a tap on one of them changes nothing
    const other = (await shownSecs(page, 60)).find((x) => x !== l && same.includes(x));
    if (other != null) {
      await click(page, other);
      assert.equal((await outlined(page)).length, n, 'still the same sheet');
    }
    await page.click('.sfpopscope [data-sc="one"]');
    await idle(page);
    assert.deepEqual(await outlined(page), [l]);
    await page.click('.sfpopscope [data-sc="all"]');
    await page.click('#sfPopCancel');
    await idle(page);
    // opened again: Only this section
    await changeColour(page, l);
    assert.deepEqual(
      await page.$$eval('.sfpopscope [data-sc]', (b) => b.map((x) => x.getAttribute('aria-pressed'))),
      ['true', 'false'],
    );
    assert.deepEqual(await outlined(page), [l]);
    assert.deepEqual(errors, []);
  });
  test('a tap on another section keeps the pick as one Undo step and moves the sheet; nothing saved when nothing was picked', async () => {
    const { page, errors } = await open({ width: 390, height: 844 });
    const [l1] = await shownSecs(page, 1),
      o1 = await mk(page, l1);
    await changeColour(page, l1);
    await page.evaluate(() => {
      document.getElementById('sfSheet').__mark = 1;
    });
    const n0 = await plans(page),
      y0 = await page.evaluate(() => scrollY);
    const k1 = await otherKey(page, o1);
    await pickTile(page, k1);
    await idle(page);
    assert.equal(await plans(page), n0, 'a preview is no step yet');
    const [l2, l3, l4] = await shownSecs(page, 3, [l1]),
      o2 = await mk(page, l2),
      o3 = await mk(page, l3);
    await click(page, l2);
    assert.equal(await mk(page, l1), k1);
    assert.equal(await lock(page, l1), k1, 'first pick kept, pinned');
    assert.equal(await plans(page), n0 + 1, 'one Undo step');
    assert.ok(
      await page.evaluate(() => document.getElementById('sfSheet').__mark === 1),
      'the same sheet, moved',
    );
    assert.equal(await page.evaluate(() => scrollY), y0, 'nothing moved on the page');
    const c2 = await page.evaluate((l) => __mstest.assignData.assign[l].code, l2);
    assert.match(
      await page.textContent('#sfSheet .sfpops'),
      new RegExp('Now ' + c2.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      'the sheet is for the new section',
    );
    assert.deepEqual(await outlined(page), [l2]);
    const sc = await page.$$eval('.sfpopscope [data-sc]', (b) =>
      b.map((x) => x.getAttribute('aria-pressed')),
    );
    assert.ok(!sc.length || sc[0] === 'true', 'scope back to Only this section');
    await idle(page);
    assert.match(
      await page.textContent('#sfLive'),
      new RegExp('Now changing the section with ' + c2.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    );
    // nothing picked for this one: moving on saves nothing
    await click(page, l3);
    assert.equal(await plans(page), n0 + 1, 'no step for a section left as it was');
    assert.equal(await mk(page, l2), o2);
    assert.equal(await lock(page, l2), null);
    assert.deepEqual(await outlined(page), [l3]);
    // tapping the same section again changes nothing
    await click(page, l3);
    assert.deepEqual(await outlined(page), [l3]);
    assert.ok(await pickerOpen(page));
    // pick for this one, then Cancel: only this section's preview goes
    const k3 = await otherKey(page, o3);
    await pickTile(page, k3);
    await idle(page);
    assert.equal(await mk(page, l3), k3);
    await page.click('#sfPopCancel');
    await idle(page);
    assert.equal(await pickerOpen(page), false);
    assert.equal(await mk(page, l3), o3, 'Cancel undid this section');
    assert.equal(await mk(page, l1), k1, 'and kept the earlier one');
    assert.equal(await plans(page), n0 + 1);
    // Escape is Cancel
    await changeColour(page, l4);
    const before4 = await mk(page, l4);
    await pickTile(page, await otherKey(page, before4));
    await idle(page);
    await page.keyboard.press('Escape');
    await idle(page);
    assert.equal(await pickerOpen(page), false);
    assert.equal(await mk(page, l4), before4, 'Escape undid it');
    // two kept picks are two Undo steps
    await changeColour(page, l2);
    await pickTile(page, await otherKey(page, o2));
    await click(page, l3);
    await pickTile(page, await otherKey(page, o3));
    await page.click('#sfPopConfirm');
    await idle(page);
    assert.equal(await plans(page), n0 + 3);
    await page.click('#sfPlanUndo');
    await idle(page);
    assert.equal(await mk(page, l3), o3);
    assert.notEqual(await mk(page, l2), o2);
    await page.click('#sfPlanUndo');
    await idle(page);
    assert.equal(await mk(page, l2), o2);
    assert.equal(await mk(page, l1), k1);
    assert.deepEqual(errors, []);
  });
  test('Manual picker and the Paint brush picker are the same sheet', async () => {
    const { page, errors } = await open({ width: 390, height: 844 });
    await pattern(page, 'manual');
    const [l] = await shownSecs(page, 1);
    await scrollTop(page);
    await click(page, l);
    assert.ok(await pickerOpen(page), 'a tap in Manual opens the sheet');
    assert.equal(await page.textContent('#sfSheetT'), 'Change colour');
    assert.ok(
      (await rect(page, '#sfSheet')).top >= (await rect(page, '#sfView')).bottom - 0.5,
      'under the picture',
    );
    assert.deepEqual(await outlined(page), [l]);
    const k1 = await otherKey(page, await mk(page, l));
    await pickTile(page, k1);
    const [l2] = await shownSecs(page, 1, [l]);
    const n0 = await plans(page);
    await click(page, l2);
    assert.equal(await mk(page, l), k1);
    assert.equal(await plans(page), n0 + 1);
    assert.deepEqual(await outlined(page), [l2], 'moved to the next section');
    await page.click('#sfPopCancel');
    await idle(page);
    // the brush
    await scrollTop(page);
    await page.click('#sfPaint');
    await idle(page);
    await page.click('#sfBrush');
    await page.waitForSelector('#sfSheet.sfpicksh');
    await idle(page);
    assert.equal(await page.textContent('#sfSheetT'), 'Paint with');
    assert.ok(
      (await rect(page, '#sfSheet')).top >= (await rect(page, '#sfView')).bottom - 0.5,
      'under the picture',
    );
    assert.deepEqual(await page.$$eval('#sfSheet .sfshft button', (b) => b.map((x) => x.textContent)), [
      'Cancel',
      'Done',
    ]);
    const k2 = await page.evaluate(
      () =>
        [...document.querySelectorAll('#sfPopSw .sfswg:not(.sfswrec) .sfsw')].find(
          (b) => b.dataset.k !== __mstest.paintKey,
        ).dataset.k,
    );
    await pickTile(page, k2);
    await page.click('#sfPopConfirm');
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.paintKey), k2);
    assert.equal(await pickerOpen(page), false);
    assert.deepEqual(errors, []);
  });
  test('Blend: the section and anchor menus are the sheet; a tap while it is open moves it and adds no anchor', async () => {
    const { page, errors } = await open({ width: 390, height: 844 });
    await pattern(page, 'blend');
    await scrollTop(page);
    const n0 = await page.evaluate(() => __mstest.anchors.length);
    const far = (ls) =>
      page.evaluate(
        (ls) =>
          ls.filter((l) => {
            const t = __mstest,
              c = t.comps[l],
              tol = Math.max(t.W, t.H) * 0.06;
            return t.anchors.every(
              (a) =>
                Math.hypot(a.x - c.cx, a.y - c.cy) > tol &&
                Math.hypot(a.x - t.labelPos(l).x, a.y - t.labelPos(l).y) > tol,
            );
          }),
        ls,
      );
    const [l1] = await far(await shownSecs(page, 12));
    // press and hold: the tip; Change colour: the sheet
    const p = await sectionPoint(page, l1);
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await idle(page);
    await page.mouse.up();
    await idle(page);
    await page.click('.sftip [data-a="change"]');
    await page.waitForSelector('#sfSheet.sfpicksh');
    await idle(page);
    assert.deepEqual(await outlined(page), [l1]);
    // a tap on another section moves it there, and adds no anchor
    const [l2] = await far(await shownSecs(page, 12, [l1]));
    await click(page, l2);
    assert.equal(await page.evaluate(() => __mstest.anchors.length), n0, 'no anchor added');
    assert.ok(await pickerOpen(page));
    assert.deepEqual(await outlined(page), [l2], 'moved to the tapped section');
    // a tap on an anchor: its menu, in the same sheet
    const ap = await page.evaluate(() => {
      const c = document.getElementById('sfCanvas'),
        r = c.getBoundingClientRect(),
        sh = document.getElementById('sfSheet').getBoundingClientRect(),
        t = __mstest;
      const i = t.anchors.findIndex((a) => {
        const y = r.top + (a.y / t.H) * r.height;
        return y > Math.max(r.top, 0) + 10 && y < sh.top - 10;
      });
      if (i < 0) return null;
      const a = t.anchors[i];
      return { i, x: r.left + (a.x / t.W) * r.width, y: r.top + (a.y / t.H) * r.height };
    });
    assert.ok(ap, 'an anchor above the sheet');
    await page.mouse.click(ap.x, ap.y);
    await idle(page);
    assert.equal(await page.textContent('#sfSheetT'), 'Anchor ' + (ap.i + 1));
    assert.equal(await page.textContent('#sfPopExtra'), 'Remove anchor');
    assert.deepEqual(await outlined(page), []);
    // and from the anchor menu, a tap on a section moves to that section
    await click(page, l1);
    assert.equal(await page.textContent('#sfSheetT'), 'Change colour');
    assert.deepEqual(await outlined(page), [l1]);
    assert.equal(await page.evaluate(() => __mstest.anchors.length), n0, 'still no anchor added');
    await page.click('#sfPopConfirm');
    await idle(page);
    // with the sheet closed, a tap adds an anchor again
    await click(page, l2);
    assert.equal(await page.evaluate(() => __mstest.anchors.length), n0 + 1);
    assert.deepEqual(errors, []);
  });
  test('side by side (844×390): the sheet covers the controls column, beside the picture', async () => {
    const { page, errors } = await open({ width: 844, height: 390 });
    const [l] = await shownSecs(page, 1);
    await changeColour(page, l);
    // (GitHub's WebKit can still be sliding it in when idle: once it measured 7 px down)
    await page
      .waitForFunction(
        () => Math.abs(document.getElementById('sfSheet').getBoundingClientRect().top) < 0.5,
        null,
        { timeout: 3000 },
      )
      .catch(() => {});
    const sh = await rect(page, '#sfSheet'),
      v = await rect(page, '#sfView'),
      cv = await rect(page, '#sfCanvas'),
      ctl = await rect(page, '#sfCtl'),
      wk = await rect(page, '#sfWork');
    assert.ok(await page.evaluate(() => document.getElementById('sfSheet').classList.contains('sfshside')));
    assert.ok(sh.left >= v.right - 0.5 && sh.left >= cv.right - 0.5, 'beside the picture, not over it');
    // (v300: to the guide card's right edge, which is the menu's, as on an iPad; it had run to the screen's)
    assert.ok(
      sh.left <= ctl.left + 0.5 &&
        Math.abs(sh.right - wk.right) < 1.5 &&
        sh.top === 0 &&
        Math.abs(sh.height - 390) < 1,
      'over the whole controls column: ' + JSON.stringify([sh, ctl, wk]),
    );
    // a tap on the picture moves it here too
    const [l2] = await shownSecs(page, 1, [l]);
    await click(page, l2);
    assert.deepEqual(await outlined(page), [l2]);
    await page.keyboard.press('Escape');
    await idle(page);
    assert.equal(await pickerOpen(page), false);
    assert.deepEqual(errors, []);
  });
  test('sheets: portrait from under the pinned picture to the bottom; the page is locked while open; Escape and focus', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await scrollAt(page, 0);
    await page.focus('#sfMore');
    await page.keyboard.press('Enter');
    await page.waitForSelector('#sfSheet');
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.sheetOpen()), true);
    // (waiting for the sheet to arrive, not for its slide to end: GitHub's WebKit can leave a transition unfinished, run 23)
    await until(
      page,
      () => Math.abs(document.getElementById('sfSheet').getBoundingClientRect().bottom - innerHeight) <= 1,
      null,
      'the sheet at the bottom',
      15000,
    ).catch(() => {});
    // the page moved so the picture is pinned at its floor size; the menu is as tall as its items, at the bottom, never
    // over the pinned block (pickers take all the room under it: sheet.test.mjs)
    const v = await rect(page, '#sfView'),
      s = await rect(page, '#sfSheet'),
      c = await rect(page, '#sfCanvas');
    assert.equal(await picH(page), 380, 'picture at its floor size');
    assert.ok(
      s.top >= v.bottom - 1 && s.top >= c.bottom,
      `sheet under the pinned block (${s.top} vs ${v.bottom})`,
    );
    // (v308 added Send feedback to the menu: on this 844px phone it is now 27px taller than the room under the pinned
    // picture, so it takes all that room and its body scrolls to the last item — as menus already did on shorter phones.
    // It had been "sized to its content", which the five items fitted.)
    const fit = await page.evaluate(() => {
      const b = document.querySelector('#sfSheet .sfshbody');
      return b.scrollHeight <= b.clientHeight + 1;
    });
    assert.ok(
      fit || Math.abs(s.top - v.bottom) <= 1,
      `sized to its content, or all the room under the picture (${s.top} vs ${v.bottom})`,
    );
    const lastSeen = await page.evaluate(() => {
      const b = document.querySelector('#sfSheet .sfshbody'),
        it = [...b.querySelectorAll('.sfmitem')].pop();
      b.scrollTop = b.scrollHeight;
      const r = it.getBoundingClientRect(),
        q = b.getBoundingClientRect();
      const ok = r.top >= q.top - 1 && r.bottom <= q.bottom + 1;
      b.scrollTop = 0;
      return ok;
    });
    assert.ok(lastSeen, 'the last item scrolls into view');
    assert.ok(Math.abs(s.bottom - 844) <= 1, 'to the bottom of the screen');
    assert.ok(
      await page.evaluate(() => document.getElementById('sfSheet').contains(document.activeElement)),
      'focus moved into the sheet',
    );
    assert.equal(
      await page.evaluate(() =>
        [
          document.getElementById('sfSheet').getAttribute('role'),
          document.getElementById('sfSheet').getAttribute('aria-modal'),
        ].join(),
      ),
      'dialog,true',
    );
    // header, a scrolling body, a footer
    assert.deepEqual(await page.$$eval('#sfSheet > *', (k) => k.map((x) => x.className)), [
      'sfshhd',
      'sfshbody',
      'sfshft',
    ]);
    // locked: a wheel over the page doesn't scroll it. (v318.37, X4-1: the menu's dim is modal and takes the pointer, so
    // a pinch (ctrl + wheel) over the dimmed picture no longer zooms it either; it did before, under a dim that took
    // no taps. A picker's dim still lets the picture through: e2e/v31837-shell)
    const y0 = await page.evaluate(() => scrollY);
    await page.mouse.move(195, s.top - 30 > 0 ? 100 : 100);
    await page.mouse.wheel(0, 400);
    await idle(page);
    await page.mouse.move(195, s.top + 40);
    await page.mouse.wheel(0, 400);
    await idle(page);
    assert.equal(await page.evaluate(() => scrollY), y0, 'the page does not scroll');
    await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2);
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -120);
    await page.keyboard.up('Control');
    await idle(page);
    assert.equal(
      await page.evaluate(() => __mstest.zoom),
      1,
      'a pinch (ctrl + wheel) over the dim leaves the picture as it is',
    );
    assert.ok(await page.$('#sfSheet .sfmitem'), 'and the menu stays open');
    // Tab stays inside
    for (let i = 0; i < 9; i++) await page.keyboard.press('Tab');
    assert.ok(
      await page.evaluate(() => document.getElementById('sfSheet').contains(document.activeElement)),
      'Tab stays in the sheet',
    );
    await page.keyboard.press('Escape');
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.sheetOpen()), false);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'sfMore', 'focus back on ⋯');
    assert.equal(await page.evaluate(() => scrollY), 0, 'the page is back where it was');
    assert.equal(
      await page.evaluate(() => getComputedStyle(document.documentElement).overflowY),
      'visible',
      'unlocked',
    );
    assert.deepEqual(errors, []);
  });
  test('on a tablet in portrait sheets are as wide as the guide card, centred over it; on a phone the whole width', async () => {
    for (const [w, h] of [
      [820, 1180],
      [768, 1024],
      [390, 844],
    ]) {
      const { page, errors, ctx } = await openApp({ width: w, height: h });
      await sampleGuide(page);
      await idle(page);
      await page.click('#sfMore');
      await page.waitForSelector('#sfSheet');
      await idle(page);
      const s = await rect(page, '#sfSheet'),
        c = await rect(page, '#sfWork');
      if (w === 390) assert.ok(s.left <= 0.5 && s.right >= w - 0.5, 'phone: the whole width');
      else {
        // (v285: the card is up to 92% of a tablet's width in portrait)
        assert.ok(
          s.width <= c.width + 36 + 1 && s.width <= w * 0.92 + 1,
          `${w}: the sheet (${s.width}) keeps to the card (${c.width})`,
        );
        assert.ok(Math.abs((s.left + s.right) / 2 - (c.left + c.right) / 2) <= 1, 'centred over the card');
      }
      if (w === 820) await shot(page, 'g1-10-menu');
      await page.keyboard.press('Escape');
      await idle(page);
      // the picker too, with its Cancel and Done
      const [l] = await bigSections(page, 1);
      await openChangeColour(page, l);
      const p = await rect(page, '#sfSheet'),
        cn = await rect(page, '#sfPopCancel'),
        dn = await rect(page, '#sfPopConfirm');
      assert.ok(p.left >= c.left - 19 && p.right <= c.right + 19, 'the picker keeps to the card');
      // (v300: Cancel and Done share the sheet's width, on an iPad too: they had been 280px each at the right)
      assert.ok(
        Math.abs(cn.width - dn.width) < 3 && cn.width > p.width / 2 - 40,
        `Cancel is ${cn.width}px wide, Done ${dn.width}`,
      );
      if (w === 820) await shot(page, 'g1-10-picker');
      assert.deepEqual(errors, []);
      await ctx.close();
    }
  });
}

// ---- from tabs.test.mjs ----
// The Plan tabs (Release 3, docs/GUIDE-LAYOUT.md #7-#9): Colours · Pattern · Shading · Share, opening on the last one
// used on this device; what each tab holds; helper text in full the first time, then a one-line ⓘ; Shading's
// suggestions as one line that opens; the Share tab and its Print sheet; and each tab kept short.
{
  // errors, and console errors too
  async function app(opts) {
    const a = await openApp(opts);
    a.page.on('console', (m) => {
      if (m.type() === 'error') a.errors.push('console: ' + m.text());
    });
    return a;
  }
  const tab = (page, t) => page.click(`.sftabbtn[data-t="${t}"]`);
  const pane = (t) => `.sftab[data-tab="${t}"]`;
  const rect = (page, sel) =>
    page.evaluate((s) => {
      const e = document.querySelector(s);
      return e ? e.getBoundingClientRect().toJSON() : null;
    }, sel);
  const ids = (page, sel) => page.$$eval(sel, (b) => b.map((x) => x.id || x.dataset.v));
  // the tops of the visible buttons in a row (one value = one row)
  const rows = (page, sel) =>
    page.$$eval(sel, (b) => [
      ...new Set(b.filter((x) => x.offsetParent).map((x) => Math.round(x.getBoundingClientRect().top))),
    ]);
  // scroll so the tabs are pinned under the picture (at its floor size)
  const pinTabs = (page) =>
    page.evaluate(
      () =>
        new Promise((r) => {
          const t = document.querySelector('.sftabs'),
            s = document.querySelector('.sftabsen'),
            cs = getComputedStyle(t);
          scrollTo(
            0,
            Math.round(
              scrollY + s.getBoundingClientRect().top + parseFloat(cs.marginTop) - parseFloat(cs.top),
            ),
          );
          requestAnimationFrame(() => requestAnimationFrame(r));
        }),
    );
  // save the guide, reload, and open it again from Home (localStorage, and so what has been seen, is kept)
  async function reopen(page) {
    if (!(await page.evaluate(() => __mstest.inLibrary))) await saveGuide(page);
    await page.reload();
    await page.waitForFunction(() => !!window.__mstest);
    await page.click('#mHome');
    await page.click('#sfRecent [data-gid]');
    await page.waitForFunction(() => !!__mstest.assignData);
    await idle(page);
  }
  test('Colours · Pattern · Shading · Share & print, one pane each: Colours the first time, then the last one used, also after a reload', async () => {
    const { page, errors } = await app();
    await sampleGuide(page);
    assert.deepEqual(await page.$$eval('.sftabbtn', (b) => b.map((x) => [x.dataset.t, x.textContent])), [
      ['colours', 'Colours'],
      ['pattern', 'Pattern'],
      ['shading', 'Shading'],
      ['share', 'Share & print'],
    ]);
    assert.equal(await page.getAttribute('.sftabbtn.on', 'data-t'), 'colours', 'Colours the first time');
    assert.equal(await page.getAttribute('.sftabbtn[data-t="colours"]', 'aria-selected'), 'true');
    assert.deepEqual(
      await page.$$eval('#sfCtl [data-tab]', (p) => p.map((x) => x.dataset.tab)),
      ['colours', 'pattern', 'shading', 'share'],
      'one pane per tab, and no others',
    );
    await tab(page, 'shading');
    assert.equal(await page.evaluate(() => localStorage.getItem('ms-plan-tab')), 'shading');
    assert.ok((await page.isVisible(pane('shading'))) && !(await page.isVisible(pane('colours'))));
    // a rebuild of the controls keeps the tab
    await page.evaluate(() => __mstest.shadeTo('shadow'));
    await idle(page);
    assert.equal(await page.getAttribute('.sftabbtn.on', 'data-t'), 'shading');
    await reopen(page);
    assert.equal(
      await page.getAttribute('.sftabbtn.on', 'data-t'),
      'shading',
      'the last tab used, after a reload',
    );
    assert.ok(await page.isVisible(pane('shading')));
    await tab(page, 'share');
    await reopen(page);
    assert.equal(await page.getAttribute('.sftabbtn.on', 'data-t'), 'share');
    assert.deepEqual(errors, []);
  });
  test("Pattern: the chooser on one row, that pattern's options, then Shuffle and Pin side by side", async () => {
    const { page, errors } = await app();
    await sampleGuide(page);
    // (settled first: under load, the row of Shuffle and Pin was once measured mid-layout)
    await tab(page, 'pattern');
    await idle(page);
    assert.deepEqual(await ids(page, '#sfFam button'), ['gradient', 'random', 'blend', 'photo', 'manual']);
    assert.equal((await rows(page, '#sfFam button')).length, 1, 'the chooser fits on one row at 390 wide');
    // Gradient: flow (one row) and direction, then ↻ Shuffle and Pin colours on one row, Shuffle first
    assert.equal((await rows(page, '#sfShape button')).length, 1);
    assert.ok(await page.isVisible('#sfDir'));
    const sh = await rect(page, '#sfVary'),
      pin = await rect(page, '#sfLock');
    assert.equal((await page.textContent('#sfVary')).trim(), 'Shuffle');
    assert.match(
      await page.textContent('#sfLock'),
      /^Pin colours$/,
      '(v318.16: no count until one is pinned)',
    );
    assert.ok(Math.abs(sh.top - pin.top) < 1 && sh.right <= pin.left, 'Shuffle and Pin side by side');
    // (v318.17: then ＋ Zone, the tab's last line)
    const last = await page.evaluate((s) => {
      const p = document.querySelector(s),
        z = p.lastElementChild;
      return (
        z.contains(document.getElementById('sfZoneAdd')) &&
        z.previousElementSibling.contains(document.getElementById('sfLock'))
      );
    }, pane('pattern'));
    assert.ok(last, 'Shuffle and Pin come last, then ＋ Zone');
    // nothing from Shading or Display in here
    for (const sel of ['#sfShade', '#sfTex', '#sfShLines', '#sfPrint'])
      assert.equal(await page.locator(`${pane('pattern')} ${sel}`).count(), 0, sel);
    // Random: its option, and Shuffle (v318.34: in Random's own row with Other pairings, above Pin)
    await page.click('#sfFam [data-v="random"]');
    await idle(page);
    assert.ok(await page.isVisible('#sfNoAdj'));
    const s2 = await rect(page, '#sfShuffle'),
      o2 = await rect(page, '#sfBalPair'),
      p2 = await rect(page, '#sfLock');
    assert.ok(
      Math.abs(s2.top - o2.top) < 1 && s2.right <= o2.left,
      'Random: Shuffle and Other pairings side by side',
    );
    assert.ok(s2.bottom <= p2.top, 'Random: Pin colours under them');
    // Blend: the anchors hint, Reset anchors, spread; no Shuffle or Pin
    await page.click('#sfFam [data-v="blend"]');
    await idle(page);
    assert.ok(await page.isVisible(`${pane('pattern')} .sfinfo[data-info="blend"]`));
    for (const id of ['#sfResetA', '#sfSpread', '#sfMix']) assert.ok(await page.isVisible(id), id);
    assert.equal(await page.locator('#sfLock, #sfVary, #sfShuffle').count(), 0);
    // Manual: Paint and (while painting) the brush chip, its hint, and Fill
    await page.click('#sfFam [data-v="manual"]');
    await idle(page);
    assert.ok(await page.isVisible(`${pane('pattern')} .sfinfo[data-info="manual"]`));
    assert.ok(await page.isVisible('#sfFillAll'));
    await page.click('#sfPaint');
    await idle(page);
    assert.ok(await page.isVisible(`${pane('pattern')} #sfBrush`), 'the brush chip sits in Pattern');
    assert.equal(await page.getAttribute('#sfPaint', 'aria-pressed'), 'true');
    // leaving the tab ends painting
    await tab(page, 'colours');
    await idle(page);
    assert.equal(
      await page.evaluate(
        () => __mstest.assignData && document.getElementById('sfPaint').getAttribute('aria-pressed'),
      ),
      'false',
    );
    // Photo: the photo's own controls
    await tab(page, 'pattern');
    const b64 = await page.evaluate(async () => {
      const c = document.createElement('canvas');
      c.width = 300;
      c.height = 400;
      const g = c.getContext('2d');
      const gr = g.createLinearGradient(0, 0, 300, 400);
      gr.addColorStop(0, '#e33');
      gr.addColorStop(1, '#33e');
      g.fillStyle = gr;
      g.fillRect(0, 0, 300, 400);
      const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
      return await new Promise((r) => {
        const f = new FileReader();
        f.onload = () => r(f.result.split(',')[1]);
        f.readAsDataURL(blob);
      });
    });
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#sfFam [data-v="photo"]')]);
    await fc.setFiles({ name: 'ref.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
    await page.waitForFunction(() => !!__mstest.photoRef && !__mstest.photoChecking);
    await idle(page);
    if (await page.isVisible('#sfPhAlign.on')) {
      await page.click('#sfPhAlign');
      await idle(page);
    }
    for (const id of ['.sfphrow', '#sfPhAlign', '#sfPhPick', '#sfPhPaper', '#sfLock'])
      assert.ok(await page.isVisible(`${pane('pattern')} ${id}`), id);
    assert.deepEqual(errors, []);
  });
  test('Shading: the modes, sliders, tone guides, Leave sections flat, the suggestions line, and texture at the bottom, always', async () => {
    const { page, errors } = await app();
    await sampleGuide(page);
    await tab(page, 'shading');
    const lastIsTexture = () =>
      page.evaluate(
        (s) => document.querySelector(s).lastElementChild.querySelector('#sfTex') !== null,
        pane('shading'),
      );
    assert.ok(
      (await page.isVisible('#sfShade')) && (await page.isVisible('#sfTex')),
      'texture shows with shading off',
    );
    assert.ok(await lastIsTexture(), 'texture at the bottom');
    assert.equal(await page.locator('#sfRound, #sfShLo, .sfshnote').count(), 0);
    await page.evaluate(() => __mstest.shadeTo('full'));
    await idle(page);
    for (const id of ['#sfRound', '#sfShHi', '#sfShLo', '#sfShLines', '#sfShFlat', '.sfshnote', '#sfTex'])
      assert.ok(await page.isVisible(`${pane('shading')} ${id}`), id);
    assert.ok(await lastIsTexture(), 'still at the bottom');
    // texture still works from here
    await page.$eval('#sfTex', (e) => {
      e.value = 80;
      e.dispatchEvent(new Event('input', { bubbles: true }));
      e.dispatchEvent(new Event('change', { bubbles: true }));
    });
    assert.equal(await page.textContent('#sfTexVal'), '80%');
    // the tone guides (were in Display)
    await page.uncheck('#sfShLines');
    assert.match(await page.evaluate(() => JSON.stringify(__mstest.currentDesignObj())), /"lines":false/);
    await page.check('#sfShLines');
    // the suggestions: one line, "N markers would make the shading richer · Show"
    // (v306, deliberately: led by "13 of 16 can be shaded · Pick shadeable ones" while the Gradient's markers were picked
    // before shading was on: U7)
    const head = await page.textContent('.sfshnote .sfonelh');
    assert.match(head, /^\d+ of 16 can be shaded · Pick shadeable onesShow$/);
    assert.equal(await page.getAttribute('#sfShNoteT', 'aria-expanded'), 'false');
    assert.equal(await page.isVisible('#sfShNoteMore'), false, 'details hidden');
    await page.click('#sfShNoteT');
    assert.equal(await page.getAttribute('#sfShNoteT', 'aria-expanded'), 'true');
    assert.equal(await page.textContent('#sfShNoteT'), 'Hide');
    assert.match(await page.textContent('#sfShNoteMore'), /Richer with:/);
    // its Add buttons still work
    const chip = page.locator('#sfShNoteMore .wishchip').first(),
      k = await chip.getAttribute('data-wk');
    await chip.click();
    await idle(page);
    assert.ok(await page.evaluate((k) => state.wish.some((w) => w.k === k), k), 'added to the shopping list');
    assert.equal(await page.getAttribute(`#sfShNoteMore .wishchip[data-wk="${k}"]`, 'aria-pressed'), 'true');
    // it stays open when the controls are drawn again, and Hide closes it
    await page.$eval('#sfShLo', (e) => {
      e.value = 70;
      e.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await idle(page);
    assert.ok(await page.isVisible('#sfShNoteMore .wishchip'));
    await page.click('#sfShNoteT');
    assert.equal(await page.isVisible('#sfShNoteMore'), false);
    assert.deepEqual(errors, []);
  });
  test('helper text: in full the first time on this device, then a one-line ⓘ that opens; what has been seen is kept', async () => {
    const { page, errors } = await app();
    await sampleGuide(page);
    const info = (id) =>
      page.evaluate((id) => {
        const b = document.querySelector(`.sftab:not([style*="none"]) .sfinfo[data-info="${id}"]`);
        return b && { open: b.getAttribute('aria-expanded'), text: b.textContent };
      }, id);
    await tab(page, 'shading');
    await page.evaluate(() => __mstest.shadeTo('full'));
    await idle(page);
    let s = await info('shade');
    assert.equal(s.open, 'true', 'the shading explanation in full the first time');
    assert.match(s.text, /Drag the .* on the picture to move the light/);
    await tab(page, 'pattern');
    await page.click('#sfFam [data-v="blend"]');
    await idle(page);
    assert.equal((await info('blend')).open, 'true');
    assert.match((await info('blend')).text, /Press and hold a section to change or pin its colour/);
    await page.click('#sfFam [data-v="manual"]');
    await idle(page);
    assert.match((await info('manual')).text, /or turn on Paint to fill sections by dragging across them/);
    const seen = await page.evaluate(() => JSON.parse(localStorage.getItem('ms-seen-hints')));
    for (const id of ['shade', 'blend', 'manual']) assert.ok(seen.includes(id), id + ' seen');
    // the next visit: one line each, that opens in place on a tap
    await reopen(page);
    await tab(page, 'shading');
    s = await info('shade');
    assert.equal(s.open, 'false');
    assert.equal(s.text.trim(), 'iH › B › S, laid light to dark');
    // one line of text, in a button 44px tall to tap
    const h1 = (await rect(page, `${pane('shading')} .sfinfo[data-info="shade"] .sfit`)).height,
      hb = (await rect(page, `${pane('shading')} .sfinfo[data-info="shade"]`)).height;
    assert.ok(h1 <= 26, `one line (${h1}px)`);
    assert.ok(hb >= 44 && hb <= 46, `a 44px tap height (${hb}px)`);
    await page.click(`${pane('shading')} .sfinfo[data-info="shade"]`);
    s = await info('shade');
    assert.equal(s.open, 'true');
    assert.match(s.text, /H highlight › B base › S shadow/);
    await tab(page, 'pattern');
    assert.equal((await info('manual')).open, 'false', 'Manual (the pattern kept) is one line');
    assert.match((await info('manual')).text, /^iTap a section to set its colour$/);
    // warnings stay in full: choosing sections to leave flat explains itself every time
    await tab(page, 'shading');
    await page.click('#sfShFlat');
    assert.match(await page.textContent(pane('shading')), /Tap sections to stop them being shaded/);
    assert.deepEqual(errors, []);
  });
  test('Share: Show it off, Print…, Plan & keep; the Print sheet opens under the pinned picture, sums up the choices, keeps them, and downloads a PDF', async () => {
    const { page, errors } = await app();
    await sampleGuide(page);
    await tab(page, 'share');
    assert.deepEqual(await page.$$eval(`${pane('share')} .sfglbl`, (e) => e.map((x) => x.textContent)), [
      'Show it off',
      'Print',
      'Plan & keep',
    ]);
    assert.deepEqual(await ids(page, `${pane('share')} button`), [
      'sfReveal',
      'sfExport',
      'sfPrint',
      'sfPlan',
      'sfAsPal',
      'sfShareGuide',
    ]);
    assert.equal((await page.textContent('#sfReveal')).trim(), 'Reveal & share');
    assert.equal((await page.textContent('#sfPrint')).trim(), 'Print…');
    assert.equal(
      await page.locator(`${pane('share')} #sfPDF, ${pane('share')} [data-paper]`).count(),
      0,
      'the print options live in the sheet',
    );
    await page.click('#sfPrint');
    await page.waitForSelector('#sfSheet.sfprsh');
    await idle(page);
    // under the picture, pinned at its floor size (waiting for the sheet to arrive: GitHub's WebKit can leave its slide
    // a moment behind the idle wait)
    await page
      .waitForFunction(
        () =>
          Math.abs(
            document.getElementById('sfSheet').getBoundingClientRect().top -
              document.getElementById('sfView').getBoundingClientRect().bottom,
          ) <= 1,
        null,
        { timeout: 5000 },
      )
      .catch(() => {});
    const sheet = await rect(page, '#sfSheet'),
      view = await rect(page, '#sfView'),
      cv = await rect(page, '#sfCanvas');
    assert.ok(
      Math.abs(sheet.top - view.bottom) <= 1,
      `the sheet starts under the picture block (${sheet.top} vs ${view.bottom})`,
    );
    assert.equal(Math.round(cv.height), 380, 'the picture at its floor size');
    assert.ok(cv.top >= -1, 'the picture stays on screen');
    assert.equal(await page.textContent('#sfSheetT'), 'Print');
    assert.deepEqual(
      await page.$$eval('#sfSheet [role="group"]', (g) => g.map((x) => x.getAttribute('aria-label'))),
      ['What to print', 'Paper size', 'Labels on the picture'],
    );
    // (v318.26: the foot's own buttons; the summary's paper is a link to the Paper choices)
    assert.deepEqual(await page.$$eval('#sfSheet .sfshft > button', (b) => b.map((x) => x.textContent)), [
      'Cancel',
      'Download PDF',
    ]);
    // the summary follows the choices, and its page count matches the PDF's
    const sum = () => page.textContent('#sfPrSum'),
      what = () => page.textContent('#sfPrWhat');
    const count = async () => {
      const n = await page.evaluate(() => __mstest.buildPDFPages().length);
      const m = /^(\d+) pages?/.exec(await sum());
      return [+m[1], n];
    };
    // (v284: with any close-ups of small sections, how many and on how many pages; v318.27: said under Pages, #sfPrWhat)
    const CL =
      '(\\d+ small sections? (is|are) on \\d+ close-up pages?\\.( Numbers would fit more of (it|them) on page [12]\\.)?)?$';
    // (v328) Page to colour to start with: just its labels in the summary, Darker labels hidden
    assert.equal(await page.getAttribute('[data-pwhat="colour"]', 'aria-pressed'), 'true');
    assert.ok(!(await page.isVisible('#sfPdfDark')) && (await page.isVisible('#sfPdfBlend')));
    assert.match(await sum(), /^\d+ pages · Letter · Codes$/);
    assert.match(
      await what(),
      new RegExp(
        '^The page to colour, unlabelled; then your picture in colour with dark codes to read beside it, and the colour key\\.' +
          CL,
      ),
    );
    let [said, real] = await count();
    assert.equal(said, real, 'Page to colour');
    await page.click('[data-pwhat="page"]');
    assert.ok((await page.isVisible('#sfPdfDark')) && (await page.isVisible('#sfPdfBlend')));
    assert.match(await sum(), /^\d+ pages · Letter · Labelled page · Codes$/);
    assert.match(await what(), new RegExp('to colour on, then the colour key\\.' + CL));
    [said, real] = await count();
    assert.equal(said, real, 'Letter, codes');
    await page.click('[data-plabels="numbers"]');
    assert.match(await sum(), /^\d+ pages · Letter · Labelled page · Numbers$/);
    await page.click('[data-paper="a4"]');
    assert.match(await sum(), /^\d+ pages · A4 · Labelled page · Numbers$/);
    await page.check('#sfPdfBlend');
    [said, real] = await count();
    assert.equal(said, real, 'A4 with blend companions');
    await page.click('[data-paper="a5"]');
    [said, real] = await count();
    assert.equal(said, real, 'A5 with blend companions');
    await page.click('[data-pwhat="ref"]');
    // (v318.1: with labels, the picture in colour with them, then the key)
    assert.match(await sum(), /^\d+ pages? · A5 · For your own page · Numbers in colour$/);
    assert.match(
      await what(),
      new RegExp('the colour key: to read beside the page you’re colouring\\.' + CL),
    );
    [said, real] = await count();
    assert.equal(said, real, 'For your own page');
    assert.deepEqual(
      await page.evaluate(() =>
        ['ms-pdf-labels', 'ms-paper', 'ms-pdf-what', 'ms-pdf-blend'].map((k) => localStorage.getItem(k)),
      ),
      ['numbers', 'a5', 'ref', '1'],
    );
    // Cancel closes it, focus goes back to Print…, and the choices are there next time
    await page.click('#sfSheet [data-pr="cancel"]');
    await page.waitForSelector('#sfSheet', { state: 'detached' });
    assert.equal(await page.evaluate(() => document.activeElement.id), 'sfPrint');
    await page.click('#sfPrint');
    await page.waitForSelector('#sfSheet.sfprsh');
    for (const sel of ['[data-plabels="numbers"]', '[data-paper="a5"]', '[data-pwhat="ref"]'])
      assert.equal(await page.getAttribute(sel, 'aria-pressed'), 'true', sel);
    assert.equal(await page.isChecked('#sfPdfBlend'), true);
    // Download PDF from inside the sheet
    await page.click('[data-pwhat="page"]');
    await page.click('[data-paper="letter"]');
    const want = +/^(\d+)/.exec(await sum())[1];
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click('#sfPDF')]);
    const s = (await readFile(await dl.path())).toString('latin1');
    assert.equal(s.slice(0, 5), '%PDF-');
    assert.equal((s.match(/\/Type\s*\/Page[^s]/g) || []).length, want, 'as many pages as the summary said');
    await page.keyboard.press('Escape');
    await page.waitForSelector('#sfSheet', { state: 'detached' });
    assert.deepEqual(errors, []);
  });
  test(
    'each tab stays within about one and a half screens of room at 390×844, with the picture at its floor size',
    notOnWebKit(WK.font),
    async (t) => {
      // (v318.16: as the app comes on a phone, More options shut)
      const { page, errors } = await app({ moreShut: true });
      await sampleGuide(page);
      // the steady state: shading on, and the helper text already seen (one line each)
      await tab(page, 'shading');
      await page.evaluate(() => __mstest.shadeTo('full'));
      await idle(page);
      const out = {};
      for (const pass of ['first', 'later']) {
        if (pass === 'later') await reopen(page);
        for (const tb of ['colours', 'pattern', 'shading', 'share']) {
          await tab(page, tb);
          await pinTabs(page);
          await idle(page);
          // (each one-line ⓘ is a 44px tap target: 16px taller than its line and margin, which the room allows for)
          const m = await page.evaluate(
            (s) => ({
              h: document.querySelector(s).scrollHeight,
              room: parseFloat(
                getComputedStyle(document.getElementById('sfWork')).getPropertyValue('--tabMin'),
              ),
              pic: Math.round(document.getElementById('sfCanvas').getBoundingClientRect().height),
              info: document.querySelectorAll(s + ' button.sfinfo:not(.open)').length,
            }),
            pane(tb),
          );
          assert.equal(m.pic, 380, `${tb}: the picture at its floor size`);
          out[pass + ' ' + tb] =
            `${m.h}px (${(m.h / m.room).toFixed(2)} × the ${m.room}px under the pinned tabs)`;
          // (v288: Colours has the "N markers on this page ›" button too, 44px and its margin)
          // (v306, deliberately: Pattern has the Gradient's Scatter slider too, one compact line, 49px and its margin)
          // (v308, deliberately: Scatter's line at Polished, "Neat bands in flow order", 24px with its margin;
          //  and Colours' 120px more, the marker count's 44px − and + and Include's row of chips, which Ben asked for)
          // (v310, deliberately: Mood as pictures of the page, one row of six small ones on a phone, 51px more than its
          //  buttons; 56 allowed)
          // (v316, deliberately: the Gradient's Start colour and Scatter sliders 36px tall each, a 22px ring riding on the
          //  strip or line, easier to catch with a finger: 26px more; 30 allowed)
          // (v318 review, deliberately: + Zone beside Colour pattern 32px tall with a 44px tap area, its row 13px taller)
          // (v318.15 allowed Shading 140px more for its Style row and Light from; v318.16 takes it back: one row, the rest
          //  under More options on a phone, 589 to 309px. Deliberately, v318.16's 44px choices and 13px row names make
          //  Pattern about 15px taller: 20 allowed)
          if (pass === 'later')
            assert.ok(
              m.h <=
                m.room * 1.5 +
                  2 +
                  16 * m.info +
                  (tb === 'colours' ? 54 + 120 + 56 : 0) +
                  (tb === 'pattern' ? 74 + 30 + 14 + 20 : 0),
              `${tb}: ${out[pass + ' ' + tb]}`,
            );
        }
      }
      t.diagnostic(JSON.stringify(out));
      assert.deepEqual(errors, []);
    },
  );
  // ---- From the UX polish pass ----
  test('Shading leads its tab, Mood’s pictures then the marker count lead Colours, and filters say what they do', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    // (v310: Mood as pictures first, e2e/v310-moodpics; the marker count next)
    const firstColours = await page.evaluate(() =>
      [...document.querySelector('.sftab[data-tab="colours"]').children]
        .slice(0, 3)
        .map((e) => e.id || e.className),
    );
    assert.deepEqual(
      firstColours.map((c) => (/sfMoodLbl|sfmpwrap|sfmkcount/.exec(c) || [c])[0]),
      ['sfMoodLbl', 'sfmpwrap', 'sfmkcount'],
    );
    await page.click('.sftabbtn[data-t="shading"]');
    const firstStyle = await page.evaluate(
      () => document.querySelector('.sftab[data-tab="shading"]').firstElementChild.className,
    );
    assert.match(firstStyle, /sfshade/);
    assert.deepEqual(errors, []);
  });
}

// ---- from tap-areas.test.mjs ----
// v318 review: small tap areas found on a touch walk-through, each now 44px where the layout has room: Pattern's + Zone,
// Codes on the saved image, Markers' Swatch chart ↓ under Add markers, and Palette's colour counts (44px wide on an
// iPad; on a phone, where seven of them and the label fill the row, their tap areas meet with no gap between).
// Measured the way a finger finds them: the points where the page hands a tap to the control.
{
  // the tap area's width along the control's middle row and height along its middle column (1px steps, 30px round it);
  // a checkbox counts its label
  const tapArea = (page, sel) =>
    page.evaluate((sel) => {
      const e = document.querySelector(sel);
      e.scrollIntoView({ block: 'center', behavior: 'instant' });
      const r = e.getBoundingClientRect(),
        cx = (r.left + r.right) / 2,
        cy = (r.top + r.bottom) / 2,
        mine = (h) => !!h && (h === e || e.contains(h) || [...(e.labels || [])].some((l) => l.contains(h)));
      let w = 0,
        h = 0;
      for (let y = r.top - 30; y <= r.bottom + 30; y++) if (mine(document.elementFromPoint(cx, y))) h++;
      for (let x = r.left - 30; x <= r.right + 30; x++) if (mine(document.elementFromPoint(x, cy))) w++;
      return { w, h };
    }, sel);
  test('the guide: + Zone and Codes on the saved image are 44px tall to a tap', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await page.click('#sfTab-pattern');
    await idle(page);
    const z = await tapArea(page, '#sfZoneAdd');
    assert.ok(z.h >= 44, `+ Zone: ${z.h}px tall to a tap (35 before)`);
    // (and the first pattern choice under it keeps its own: the zone's area doesn't reach into it)
    const g = await tapArea(page, '#sfPanel-pattern .sfedit');
    assert.ok(g.h >= 40, `the pattern choice under it: ${g.h}px`);
    await page.click('#sfTab-share');
    await idle(page);
    const c = await tapArea(page, '#sfExCodes');
    assert.ok(c.h >= 44, `Codes on the saved image: ${c.h}px tall to a tap (24 before)`);
    assert.deepEqual(errors, []);
  });
  test('Markers: Swatch chart ↓ under Add markers is a 44px tap area, not tucked under the button', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await page.click('#mCollection');
    await idle(page);
    assert.ok(await page.isVisible('#mkAddBtn'), 'Add markers shows (a set is owned)');
    const j = await tapArea(page, '#mkJump');
    assert.ok(j.h >= 44, `Swatch chart: ${j.h}px tall to a tap (32 before)`);
    const a = await tapArea(page, '#mkAddBtn');
    assert.ok(a.h >= 44, `Add markers keeps its own: ${a.h}px`);
    assert.deepEqual(errors, []);
  });
  for (const [width, height, wide] of [
    [390, 844, false],
    [820, 1180, true],
  ]) {
    test(`Palette's colour counts at ${width}px: ${wide ? '44px wide' : 'tap areas that meet'}`, async () => {
      const { page, errors } = await openApp({
        width,
        height,
        storage: { 'ms-onboarded': '1', 'ms-setup-tip': '1' },
      });
      await page.click('#mPalette');
      await idle(page);
      const r = await page.evaluate(() => {
        const bs = [...document.querySelectorAll('#segs button')].filter((b) => b.getClientRects().length);
        bs[0].scrollIntoView({ block: 'center', behavior: 'instant' });
        const a = bs[0].getBoundingClientRect(),
          z = bs[bs.length - 1].getBoundingClientRect(),
          y = (a.top + a.bottom) / 2;
        let miss = 0;
        for (let x = a.left; x < z.right; x++) if (!bs.includes(document.elementFromPoint(x, y))) miss++;
        return { n: bs.length, w: Math.min(...bs.map((b) => b.getBoundingClientRect().width)), miss };
      });
      assert.equal(r.n, 7);
      assert.equal(r.miss, 0, 'every point along the row is one of the counts');
      if (wide) assert.ok(r.w >= 44, `each is ${r.w}px wide`);
      const fits = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
      assert.ok(fits, 'the page is no wider than the screen');
      assert.deepEqual(errors, []);
    });
  }
}

// ---- from toast-spot.test.mjs ----
// v318 review: in the Plan a toast (Surprise's, 8 seconds with its Undo) sits over the foot of the picture, just above
// its tool row, not over the tabs and their controls: on a phone it had covered the whole tab bar, on an iPad held
// sideways Colours from. Held sideways, it stays inside the picture's own column.
{
  const overlaps = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
  const where = (page) =>
    page.evaluate(() => {
      const R = (e) => (e ? e.getBoundingClientRect().toJSON() : null);
      return {
        toast: R(document.getElementById('msToast')),
        tabs: R(document.querySelector('.sftabs')),
        tools: R(document.getElementById('sfZoomCtl')),
        pic: R(document.getElementById('sfPicBox')),
        ctl: [...document.querySelectorAll('#sfCtl button, #sfCtl input, #sfCtl select')]
          .filter((b) => b.getClientRects().length && !b.closest('.sftab:not(.on)'))
          .map(R),
      };
    });
  for (const [w, h, side] of [
    [390, 844, false],
    [820, 1180, false],
    [1180, 820, true],
  ]) {
    test(`${w}×${h}: Surprise's toast is over the picture's foot, clear of the tabs and the controls`, async () => {
      const { page, errors } = await openApp({ width: w, height: h });
      await sampleGuide(page);
      await idle(page);
      await page.click('#sfSurprise');
      await page.waitForSelector('#msToast.on');
      await idle(page, 100);
      const r = await where(page);
      assert.match(await page.textContent('#msToast'), /^Surprise: /);
      assert.ok(!overlaps(r.toast, r.tabs), 'not over the tabs');
      assert.ok(!r.ctl.some((c) => overlaps(r.toast, c)), 'not over any control of the Plan');
      assert.ok(
        r.toast.bottom <= (side ? r.pic.bottom : r.tools.top) + 1,
        'above the tool row (sideways: the picture’s foot)',
      );
      assert.ok(r.toast.top >= r.pic.top, 'within the picture');
      if (side)
        assert.ok(
          r.toast.left >= r.pic.left - 1 && r.toast.right <= r.pic.right + 1,
          'inside the picture’s column',
        );
      assert.deepEqual(errors, []);
    });
  }
}

// ---- from toasts-and-errors.test.mjs ----
// Toasts and error messages: toasts sit above the bottom bar, let taps through, stay with their screen and stage,
// never over an open sheet, centred on their own width, and can't be reached hidden; errors appear where they
// happened, error cards stay until the tap that dismisses them is over, and unexpected errors get a calm message.
{
  const onboarded = (extra = {}) => ({ 'ms-onboarded': '1', 'ms-setup-tip': '1', ...extra });
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
  const toastOn = (page) =>
    page.evaluate(() => {
      const t = document.getElementById('msToast');
      return !!(t && t.classList.contains('on'));
    });
  // ---- From the fourth review (outside the guide screen) ----
  const KEY = 'ohuhu-hb320-picker-v3';
  const onboardedV263 = (extra = {}) => ({
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
  const toastText = (page) =>
    page.evaluate(() => {
      const t = document.getElementById('msToast');
      return t && t.classList.contains('on') ? t.textContent : '';
    });
  // ---- From the fifth review’s leftovers ----
  const OWN4 = ['Ohuhu|R014', 'Ohuhu|Y111', 'Ohuhu|B08', 'Ohuhu|G36'];
  const onboardedV265 = (extra = {}) => ({
    'ms-onboarded': '1',
    'ms-setup-tip': '1',
    'ms-last-ver': 'v265',
    ...extra,
  });
  const appState4 = (extra = {}) =>
    JSON.stringify({
      mode: 'home',
      ownedSeedV: 2,
      copicAdd1: 1,
      libAdj1: 1,
      setFix1: 1,
      owned: OWN4,
      saved: [],
      ...extra,
    });
  const file = (o) => ({
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(o)),
  });
  // ---- From the fifth review (guide screen) ----
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
  async function changeColour(page, l) {
    await scrollTop(page);
    await tapSection(page, l);
    await page.click('.sftip [data-a="change"]');
    await page.waitForSelector('#sfSheet.sfpicksh');
    await idle(page);
  }
  test('an unexpected error shows a calm message with Copy details; noise is ignored', async () => {
    const { page, errors } = await openApp({ storage: onboarded() });
    await page.evaluate(() => {
      window.__copied = null;
      navigator.clipboard.writeText = (t) => {
        window.__copied = t;
        return Promise.resolve();
      };
    });
    // noise: a ResizeObserver loop notice, a cancelled request, an error from another origin (no file)
    await page.evaluate(() => {
      dispatchEvent(
        new ErrorEvent('error', {
          message: 'ResizeObserver loop completed with undelivered notifications.',
          filename: location.href,
        }),
      );
      dispatchEvent(new ErrorEvent('error', { message: 'Script error.', filename: '' }));
      dispatchEvent(new ErrorEvent('error', { message: 'x', filename: 'chrome-extension://abc/content.js' }));
      Promise.reject(new DOMException('The user aborted a request.', 'AbortError'));
    });
    await idle(page);
    assert.equal(await page.isVisible('#msToast.on'), false, 'noise shows nothing');
    // a real error in the app's own code (it reads the collection, which is briefly broken)
    const breakOnce = () =>
      page.evaluate(() => {
        const o = state.owned;
        state.owned = null;
        setTimeout(backupDue, 0);
        setTimeout(() => {
          state.owned = o;
        }, 50);
      });
    await breakOnce();
    await page.waitForSelector('#msToast.on #errCopy');
    assert.match(
      await page.textContent('#msToast'),
      /Something went wrong\. Your saved work is safe — reload if anything looks odd\./,
    );
    // (Safari's engine words and reports it differently: there, at least once)
    const nulls = () => errors.filter((m) => /null/.test(m)).length;
    if (ENGINE === 'chromium') assert.equal(nulls(), 1, 'the error still reaches the page error log');
    else assert.ok(nulls() >= 1, 'the error still reaches the page error log');
    await page.click('#errCopy');
    await idle(page);
    const copied = await page.evaluate(() => window.__copied);
    assert.match(copied, /null/);
    assert.match(copied, /Marker Studio v\d+/);
    assert.match(copied, /Source: http:\/\/127\.0\.0\.1:\d+\/:\d+/);
    assert.ok(copied.includes(await page.evaluate(() => navigator.userAgent)), 'user agent included');
    assert.match(await page.textContent('#msToast'), /Details copied/);
    // rate-limited: another error straight away doesn't bring the message back
    await page.evaluate(() => document.getElementById('msToast').classList.remove('on'));
    await breakOnce();
    await idle(page);
    assert.equal(await page.isVisible('#msToast.on'), false);
    if (ENGINE === 'chromium') assert.equal(nulls(), 2);
    else assert.ok(nulls() >= 1);
    assert.deepEqual(
      errors.filter((m) => !/null|aborted a request/.test(m)),
      [],
    );
  });
  // ---- From UX release 1 (v260) ----
  test('toasts sit above the bottom bar and let taps through; progress is not a toast', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await page.evaluate(() => toast('Hello there', 4000));
    await idle(page);
    // (v318 review: in the Plan, over the foot of the picture, just above its tool row, not over the tabs)
    const r = await page.evaluate(() => {
      const t = document.getElementById('msToast').getBoundingClientRect(),
        b = document.getElementById('sfZoomCtl').getBoundingClientRect();
      return {
        gap: b.top - t.bottom,
        pe: getComputedStyle(document.getElementById('msToast')).pointerEvents,
      };
    });
    assert.ok(r.gap >= 0 && r.gap < 30, `just above the picture's tool row (${r.gap})`);
    assert.equal(r.pe, 'none');
    await page.evaluate(() => {
      document.getElementById('msToast').classList.remove('on');
    });
    await idle(page);
    // Colour along: just above the bottom bar, as before
    await page.click('#sfColor');
    await idle(page);
    await page.evaluate(() => toast('Hello there', 4000));
    await idle(page);
    const c = await page.evaluate(() => {
      const t = document.getElementById('msToast').getBoundingClientRect(),
        b = [...document.querySelectorAll('.sfbar')]
          .find((x) => x.getClientRects().length)
          .getBoundingClientRect();
      return b.top - t.bottom;
    });
    assert.ok(c >= 0 && c < 30, `Colour along: just above the bar (${c})`);
    await page.evaluate(() => {
      document.getElementById('msToast').classList.remove('on');
    });
    await page.click('#sfDoneBtn');
    await idle(page);
    await page.click('.sftabbtn[data-t="share"]');
    await page.click('#sfPrint');
    await page.evaluate(() => {
      navigator.canShare = () => false;
    });
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click('#sfPDF')]);
    assert.ok(dl);
    assert.doesNotMatch(await page.textContent('#msToast'), /Preparing/, 'no "Preparing PDF…" toast');
    assert.deepEqual(errors, []);
  });
  test('errors appear where they happened, in the warning style, and clear on the next tap', async () => {
    const { page, errors } = await openApp();
    await welcome(page, 'look');
    await page.click('#homeLibCard');
    await idle(page);
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#guidesRestore')]);
    await fc.setFiles({
      name: 'nope.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{"hello":1}'),
    });
    await page.waitForSelector('#savedOverlay .mserr', { timeout: 5000 });
    assert.match(await page.textContent('#savedOverlay .mserr'), /isn’t a Marker Studio backup/);
    await page.click('#savedOverlay .mtitle');
    await idle(page);
    assert.equal(await page.locator('#savedOverlay .mserr').count(), 0, 'cleared by the next tap');
    // Match a colour: an impossible hex says what's expected
    await page.evaluate(() => {
      savedOverlay.classList.remove('on');
    });
    await page.click('#mCollection');
    await page.click('#mkMatchBtn');
    await idle(page);
    if (!(await page.isVisible('#matchOverlay'))) await page.evaluate(() => window.msMatchHex('#3a7bd5'));
    await page.click('#matchOverlay [data-src="hex"]');
    await page.fill('#matchHex', '#zz');
    await idle(page);
    assert.match(await page.textContent('#matchHexHint'), /6 hex digits/);
    assert.deepEqual(errors, []);
  });
  // ---- From the third full review (v259) ----
  test('a hidden toast can’t be reached with the keyboard', async () => {
    const { page, errors } = await openApp();
    await welcome(page, 'look');
    await page.evaluate(() => toastAction('Removed.', 'Undo', () => {}));
    await page.evaluate(() => document.getElementById('msToast').classList.remove('on'));
    await idle(page);
    assert.equal(
      await page.evaluate(() => getComputedStyle(document.getElementById('msToast')).visibility),
      'hidden',
    );
    assert.deepEqual(errors, []);
  });
  test('toasts end with their stage, and give way to full screen, focus mode and Reveal', async () => {
    // (the one-time "Your screen stays on" toast told already: Safari keeps the screen on, headless Chromium doesn't)
    const { page, errors } = await openApp({ storage: { 'ms-wake-told': '1' } });
    await sampleGuide(page);
    await idle(page);
    // (✨ Surprise: Plan's one step with a toast, since it says what it chose)
    const shuffle = async () => {
      await scrollTop(page);
      await page.click('#sfSurprise');
      await idle(page);
      assert.equal(await toastOn(page), true);
    };
    await shuffle();
    await tapAt(page, '#sfColor');
    await idle(page);
    assert.equal(
      await toastOn(page),
      false,
      'Colour along: ' + (await page.evaluate(() => document.getElementById('msToast')?.textContent)),
    );
    await page.click('#sfDoneBtn');
    await idle(page);
    await shuffle();
    await page.click('#sfFull');
    await idle(page);
    assert.equal(await toastOn(page), false, 'full screen');
    await page.keyboard.press('Escape');
    await idle(page);
    await shuffle();
    await page.click('.sftabbtn[data-t="share"]');
    await page.click('#sfReveal');
    await idle(page);
    assert.equal(await toastOn(page), false, 'Reveal');
    assert.deepEqual(errors, []);
  });
  test('a start-up screen that fails to draw is reported, and the welcome, Match and Help still start', async () => {
    // the first look-up of the page frame (the first screen drawn at start-up) throws
    const boom = () => {
      const q = Document.prototype.querySelector;
      let n = 0;
      Document.prototype.querySelector = function (s) {
        if (s === '.wrap' && !n++) throw new Error('boom');
        return q.call(this, s);
      };
    };
    const { page, errors } = await openApp({ init: boom });
    await page.waitForSelector('#welcome.on');
    assert.deepEqual(errors, ['boom'], 'the error still reaches the page (and the error net)');
    await page.click('#wcSkip');
    await page.click('#wcLook');
    await page.keyboard.press('Tab');
    await page.click('#mCollection');
    await page.click('#mkMatchBtn');
    await page.waitForSelector('#matchOverlay.on');
    await page.keyboard.press('Escape');
    await page.click('#mHome');
    await page.click('#homeHelp');
    await page.waitForSelector('#helpOverlay.on');
    assert.equal(
      await page.evaluate(() => document.querySelectorAll('body > script').length >= 4),
      true,
      'start-up, Match and Help each have a script',
    );
  });
  test('toasts stay with their screen, and go when a dialog opens', async () => {
    const { page, errors } = await openApp({
      storage: onboardedV263({ [KEY]: appState({ mode: 'collection' }) }),
    });
    await page.click('#results .cell');
    await page.waitForSelector('#msToast.on');
    assert.match(await toastText(page), /unticked/); // (v318.32: "… unticked · Undo")
    await page.click('#mPalette');
    await idle(page);
    assert.equal(await toastText(page), '', 'gone on Palette');
    await page.click('#mCollection');
    await page.click('#results .cell');
    await idle(page);
    await pause(
      page,
      200,
      'a toast under 150 ms old is kept by a dialog opening (it came with it); this one is older',
    );
    assert.match(await toastText(page), /Added|Removed|unticked/);
    await page.click('#mkMatchBtn');
    await idle(page);
    assert.equal(await toastText(page), '', 'gone when Match opens');
    assert.deepEqual(errors, []);
  });
  test('the toast is centred on its own width, up to the whole width of a phone, not squeezed into half of it', async () => {
    const { page, errors } = await openApp({ storage: onboardedV265({ [KEY]: appState4() }) });
    await page.evaluate(() =>
      toast(
        'Couldn’t save — this browser’s storage is full. Back up your guides and delete a few from the Library.',
        8000,
      ),
    );
    await page.waitForFunction(() => {
      const t = document.getElementById('msToast');
      return t && getComputedStyle(t).opacity === '1';
    });
    const r = await page.evaluate(() => {
      const b = document.getElementById('msToast').getBoundingClientRect();
      return { l: b.left, w: b.width, h: b.height };
    });
    assert.ok(r.w > 340 && r.w <= 360, `92% of the screen (${r.w}px)`);
    assert.ok(Math.abs(r.l + r.w / 2 - 195) < 1.5, 'centred');
    assert.ok(r.h < 110, `a few lines, not a tall column (${r.h}px)`);
    await page.evaluate(() => toast('Saved ✓'));
    const s = await page.evaluate(() => document.getElementById('msToast').getBoundingClientRect().width);
    assert.ok(s < 150, `a short one stays small (${s}px)`);
    assert.deepEqual(errors, []);
  });
  test('an error card stays while the finger is down, so the tap that dismisses it can’t land on the backdrop', async () => {
    const { page, errors } = await openApp({ storage: onboardedV265({ [KEY]: appState4() }) });
    await openBackupDialog(page);
    await page.setInputFiles('#backupFile', file({ hello: 1 }));
    await page.waitForSelector('#backupOverlay .mserr');
    // near the bottom of the dialog: once the card goes the dialog is shorter, and this point is the backdrop
    const p = await page.evaluate(() => {
      const r = document.querySelector('#backupOverlay .ocard').getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.bottom - 4 };
    });
    const under = () =>
      page.evaluate(({ x, y }) => {
        const e = document.elementFromPoint(x, y);
        return e ? e.id || e.className : '';
      }, p);
    const was = await under();
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await idle(page);
    assert.equal(
      await page.locator('#backupOverlay .mserr').count(),
      1,
      'still there while the finger is down',
    );
    assert.equal(await under(), was, 'the same thing under the finger');
    await page.mouse.up();
    await page.waitForFunction(() => !document.querySelector('#backupOverlay .mserr'));
    assert.ok(
      await page.evaluate(() => document.getElementById('backupOverlay').classList.contains('on')),
      'the dialog stays open',
    );
    // its ✕ still puts it away at once
    await page.setInputFiles('#backupFile', file({ hello: 1 }));
    await page.waitForSelector('#backupOverlay .mserr');
    await page.click('#backupOverlay .mserrx');
    assert.equal(await page.locator('#backupOverlay .mserr').count(), 0);
    assert.deepEqual(errors, []);
  });
  test('a toast never sits over an open sheet: one showing goes when the sheet opens, one raised meanwhile sits above it', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    const [l, l2] = await bigSections(page, 2);
    // a toast is showing (a colour change no longer makes one: ↶ Undo says it), then another section's picker opens
    await changeColour(page, l);
    await page.click('#sfPopSw .sfsw:not(.on)');
    await page.click('#sfPopConfirm');
    await idle(page);
    assert.equal(await toastOn(page), false, 'no toast for the step');
    await page.evaluate(() => toastAction('Something to undo', 'Undo', () => {}));
    await page.waitForSelector('#msToast.on');
    assert.equal(await toastOn(page), true);
    await changeColour(page, l2);
    assert.equal(await toastOn(page), false, 'the toast went when the sheet opened');
    // a toast raised while the sheet is open: above the sheet, over the picture
    await page.evaluate(() => toast('Something happened'));
    await idle(page);
    const t = await rect(page, '#msToast'),
      s = await rect(page, '#sfSheet');
    assert.ok(t.bottom <= s.top + 0.5, `the toast (${t.top}–${t.bottom}) ends above the sheet (${s.top})`);
    // side by side: over the picture's column, not the sheet's
    await page.setViewportSize({ width: 1024, height: 700 });
    await idle(page);
    // (the sheet moves beside the picture once the page has its new width: on a slow machine a moment after the idle wait)
    // (waited for as its side-by-side class: since v300 an upright sheet on a wide screen is at the card's edge, not 0,
    // so "left > 0" could pass before it moved, and did once on GitHub's WebKit, v301's run)
    await page
      .waitForFunction(() => document.getElementById('sfSheet').classList.contains('sfshside'), null, {
        timeout: 5000,
      })
      .catch(() => {});
    await idle(page);
    await page.evaluate(() => toast('Something else'));
    await idle(page);
    const t2 = await rect(page, '#msToast'),
      s2 = await rect(page, '#sfSheet');
    assert.ok(
      t2.right <= s2.left + 0.5,
      `side by side: the toast (${t2.left}–${t2.right}) is left of the sheet (${s2.left})`,
    );
    assert.deepEqual(errors, []);
  });
}

// ---- from v284-polish.test.mjs ----
// v284 polish: headings and landmarks for screen readers; Edit sections' sliders say what turning them up does, and
// Straighten is offered when the page's edges looked uneven; the tool row fits at 375px in the busiest case (Photo,
// zoomed in, with Undo); toasts stay while you're reading or reaching them; the first Save says in the header that
// the guide saves itself from then on.
{
  test('one h1, a Main nav, a main landmark, the screen named as an h2; dialog and sheet titles are h2s, the guide’s group labels h3s', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    assert.deepEqual(await page.$$eval('h1', (h) => h.map((x) => x.textContent)), ['Marker Studio']);
    assert.equal(await page.locator('nav[aria-label="Main"] button').count(), 4);
    assert.equal(await page.locator('[role="main"]').count(), 1);
    assert.equal(await page.textContent('#screenH'), 'Guide');
    await page.click('#mCollection');
    await idle(page);
    assert.equal(await page.textContent('#screenH'), 'Markers');
    await page.click('#mSections');
    await idle(page);
    await page.click('.sftabbtn[data-t="share"]');
    await idle(page);
    assert.deepEqual(
      await page.$$eval('#sfCtl h3.sfglbl', (h) => h.filter((x) => x.offsetParent).map((x) => x.textContent)),
      ['Show it off', 'Print', 'Plan & keep'],
    );
    await page.click('#sfMore');
    await page.waitForSelector('#sfSheet');
    await idle(page);
    assert.equal(await page.evaluate(() => document.getElementById('sfSheetT').tagName), 'H2');
    await page.keyboard.press('Escape');
    await idle(page);
    assert.equal(await page.evaluate(() => document.querySelector('#savedOverlay .mtitle').tagName), 'H2');
    assert.deepEqual(errors, []);
  });
  test('Edit sections: each slider says what turning it up does; Straighten is offered on a line of its own after Keep as is', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    // a photo of circles (no page in it to straighten: the finder stays quiet)
    const b64 = await page.evaluate(() => {
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
    assert.equal(await page.locator('.sfpghint').count(), 0, 'nothing said when there was no page to find');
    assert.equal(await page.textContent('#sfMinHint'), 'Higher: small specks left out of the guide');
    assert.equal(await page.getAttribute('#sfMin', 'aria-describedby'), 'sfMinHint');
    assert.match(await page.textContent('#sfBgHint'), /^Higher: /);
    // (as after a photo whose outline the finder couldn't trust, kept as it was)
    await page.evaluate(() => {
      __mstest.pgHint = 'kept';
      __mstest.renderControls();
    });
    await idle(page);
    assert.match(await page.textContent('.sfpghint'), /^Page kept as photographed · Straighten$/);
    assert.deepEqual(errors, []);
  });
  test('the tool row fits at 375px with Photo, zoomed in and Undo showing', async () => {
    const { page, errors } = await openApp({ width: 375, height: 812 });
    await sampleGuide(page);
    await idle(page);
    await page.evaluate(() => {
      const c = document.createElement('canvas');
      c.width = 80;
      c.height = 60;
      const g = c.getContext('2d');
      g.fillStyle = '#c33';
      g.fillRect(0, 0, 40, 60);
      g.fillStyle = '#36c';
      g.fillRect(40, 0, 40, 60);
      __mstest.setPhotoRef(__mstest.photoFromImage(c), true);
      __mstest.reassign();
    });
    await idle(page);
    await page.click('.sftabbtn[data-t="pattern"]');
    await idle(page);
    if (await page.isVisible('#sfPhDone')) {
      await page.click('#sfPhDone');
      await idle(page);
    }
    await page.click('#sfShuffle').catch(() => {});
    await page.click('#sfZin');
    await page.click('#sfZin');
    await idle(page);
    const r = await page.evaluate(() => {
      const z = document.getElementById('sfZoomCtl'),
        b = [...z.querySelectorAll('button')].filter((x) => x.offsetParent);
      return {
        sw: z.scrollWidth,
        cw: z.clientWidth,
        right: Math.max(...b.map((x) => x.getBoundingClientRect().right)),
        undo: !!document.getElementById('sfPlanUndo').offsetParent,
        h: Math.min(...b.map((x) => x.getBoundingClientRect().height)),
      };
    });
    assert.ok(r.undo, 'Undo showing');
    assert.ok(r.sw <= r.cw + 1, `the row fits: ${r.sw} in ${r.cw}`);
    assert.ok(r.right <= 375, 'no button off the screen: ' + r.right);
    assert.ok(r.h >= 34, 'buttons keep their height');
    assert.deepEqual(errors, []);
  });
  test('a toast with a button stays while the pointer is on it, and the first Save says in the header that it saves itself now', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await page.evaluate(() => toastAction('Something happened', 'Undo', () => {}, 1200));
    // (the toast lets taps through to the page; its button takes them)
    const box = await page.locator('#toastAct').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(1800);
    assert.equal(
      await page.evaluate(() => document.getElementById('msToast').classList.contains('on')),
      true,
      'kept while pointed at',
    );
    await page.mouse.move(5, 5);
    await page.waitForFunction(() => !document.getElementById('msToast').classList.contains('on'), null, {
      timeout: 4000,
    });
    // (v285: the sample, once changed, goes into the Library by itself)
    await page.click('.sftabbtn[data-t="pattern"]');
    await page.click('#sfFam [data-v="random"]');
    await page.waitForFunction(() =>
      /^Saves itself from now on ✓$/.test(document.getElementById('sfSaveSt').textContent),
    );
    assert.ok(
      !(await page.evaluate(
        () =>
          document.getElementById('msToast').classList.contains('on') &&
          /Saved to your Library/.test(document.getElementById('msToast').textContent),
      )),
      'no toast over the tabs for it',
    );
    assert.deepEqual(errors, []);
  });
}

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
  test('the automatic first save leaves a name being typed alone: Escape keeps the name it had', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await page.click('#sfRename');
    await page.fill('#sfGName', 'Fl');
    await tickInCode(page, 0); // a change: the sample is kept now
    await page.waitForFunction(() => __mstest.inLibrary, null, { timeout: AUTO + 5000 });
    const [g] = await guides(page);
    assert.equal(g.name, 'Sample jellyfish', 'saved under its own name, not the half-typed one');
    await page.press('#sfGName', 'Escape');
    await idle(page);
    assert.equal(await page.textContent('#sfGTitle'), 'Sample jellyfish');
    assert.equal((await guides(page))[0].name, 'Sample jellyfish');
    assert.deepEqual(errors, []);
  });
}

// ---- from v289.test.mjs ----
// v289: fixes from the fresh-eyes review of v288 — ← Plan › Discard of edits brought back by Resume, a palette held for
// the next guide and a photo that won't open, section edits beyond Undo, Use in a guide › Recolour from Colour along,
// Change colour after an iPad turns, a backup restored over a guide deleted while open, Generate keeping the keyboard,
// Edit sections' tools on a phone's first screen, the guide saved at once on leaving it, focus after Change colour.
{
  test(
    'Back closes what is open first: the Library, a sheet, Focus mode, then Colour along; then it would leave',
    notOnWebKit(WK.back),
    async () => {
      const { page, errors } = await openApp();
      await sampleGuide(page);
      await idle(page);
      const back = async () => {
        await page.goBack({ waitUntil: 'commit' }).catch(() => {});
        await page.waitForTimeout(150);
        await idle(page);
      };
      const url = page.url();
      // the Library (a dialog)
      await page.evaluate(() => openLibrary());
      await idle(page);
      await page.waitForTimeout(100);
      await back();
      assert.equal(await page.isVisible('#savedOverlay'), false, 'Library closed');
      assert.equal(page.url(), url, 'still in the app');
      // a sheet (⋯)
      await page.click('#sfMore');
      await idle(page);
      await page.waitForTimeout(100);
      await page.waitForSelector('#sfSheet .sfmitem');
      assert.equal(await page.evaluate(() => __mstest.sheetOpen()), true);
      await back();
      assert.equal(await page.evaluate(() => __mstest.sheetOpen()), false, 'sheet closed');
      // Colour along, Focus mode
      await page.click('#sfColor');
      await idle(page);
      await page.click('#sfFocus');
      await idle(page);
      await page.waitForTimeout(100);
      await back();
      assert.deepEqual(
        await page.evaluate(() => [__mstest.focus, __mstest.sfmode]),
        [false, 'color'],
        'Focus mode first',
      );
      await back();
      assert.equal(
        await page.evaluate(() => __mstest.sfmode),
        'guide',
        'then Colour along, back to the Plan',
      );
      assert.equal(page.url(), url);
      // closed in the app, its entry goes too: only the Guide tab's own is left (v318 review: the tabs sit one Back step
      // above Home), and Back from the Plan goes Home; then nothing is left for Back to close
      await page.evaluate(() => openLibrary());
      await idle(page);
      await page.waitForTimeout(100);
      await page.click('#savedClose');
      await idle(page);
      await page.waitForTimeout(200);
      assert.equal(await page.evaluate(() => history.state && history.state.msLayer), 1);
      await back();
      assert.equal(await page.evaluate(() => state.mode), 'home', 'then the Guide tab, back to Home');
      assert.equal(page.url(), url);
      assert.equal(await page.evaluate(() => history.state && history.state.msLayer), null);
      assert.deepEqual(errors, []);
    },
  );
}

// ---- from v302.test.mjs ----
// v302 (polish): even rows of choices in the guide, Codes off with nothing to show, and a pointer from a section's
// box to the section.
{
  const rect = (page, sel) =>
    page.evaluate((s) => {
      const e = document.querySelector(s);
      return e ? e.getBoundingClientRect().toJSON() : null;
    }, sel);
  const boxes = (page, sel) =>
    page.$$eval(sel, (b) => b.filter((x) => x.offsetParent).map((x) => x.getBoundingClientRect().toJSON()));
  const even = (bs) => Math.max(...bs.map((b) => b.width)) - Math.min(...bs.map((b) => b.width)) < 3;
  const rows = (bs) => new Set(bs.map((b) => Math.round(b.top))).size;
  test('Colours from is a row across the controls, as Temperature is: even on an iPad, filling the row on a phone', async () => {
    for (const [w, h] of [
      [820, 1180],
      [390, 844],
    ]) {
      const { page, errors, ctx } = await openApp({ width: w, height: h });
      await sampleGuide(page);
      await page.click('.sftabbtn[data-t="colours"]');
      await idle(page);
      const src = await boxes(page, '#sfSrc button'),
        pal = await rect(page, '#sfPal');
      // (v318.34: two, Your markers | A palette)
      assert.equal(src.length, 2);
      assert.equal(rows(src), 1, w + ': one row');
      // (even where there's room; on a phone each as wide as its words need, filling the row)
      if (w > 700) assert.ok(even(src), w + ': even ' + src.map((b) => b.width));
      // (v318.33: Colours from is a track, its buttons inside it: the track is as wide as Temperature)
      const row = await rect(page, '#sfSrc');
      assert.ok(
        Math.abs(row.left - pal.left) < 2 && Math.abs(row.right - pal.right) < 2,
        w + ': as wide as Temperature ' + JSON.stringify([row.left, row.right, pal.left, pal.right]),
      );
      assert.ok(
        await page.$$eval('#sfSrc button', (b) => b.every((x) => x.scrollWidth <= x.clientWidth + 1)),
        'labels fit',
      );
      assert.deepEqual(errors, []);
      await ctx.close();
    }
  });
  test('Colour along: an open marker’s actions are even — on a phone two on a row and the third across under them', async () => {
    // (v324.1: and a narrow phone and a big one, laid as they fit by actsLay: "✓ Mark all done" had made three just
    // fit a 390 row with flex, ragged)
    for (const [w, h, n] of [
      [1180, 820, 1],
      [390, 844, 2],
      [320, 568, 2],
      [430, 932, 2],
    ]) {
      const { page, errors, ctx } = await openApp({ width: w, height: h });
      await sampleGuide(page);
      await page.click('#sfColor');
      await idle(page);
      await page.locator('#sfAlist .sfarow .sfah').nth(1).click();
      await idle(page);
      const bs = await boxes(page, '#sfAlist .sfacts button');
      assert.ok(bs.length >= 3, bs.length + ' actions');
      assert.equal(rows(bs), n, w + ': rows');
      const first = bs.filter((b) => Math.round(b.top) === Math.round(bs[0].top));
      assert.ok(even(first), w + ': even ' + first.map((b) => b.width));
      if (n === 2) {
        const last = bs[bs.length - 1];
        assert.ok(
          Math.abs(last.left - first[0].left) < 2 && Math.abs(last.right - first[first.length - 1].right) < 2,
          'the third across under them',
        );
      }
      assert.deepEqual(errors, []);
      await ctx.close();
    }
  });
  test('Codes is off on a finished page in Colour along (no codes to show), and back once a section is unticked', async () => {
    const { page, errors } = await openApp({ width: 1180, height: 820 });
    await sampleGuide(page);
    await page.click('#sfColor');
    await idle(page);
    assert.equal(await page.isDisabled('#sfCodes'), false);
    await page.evaluate(() => {
      const t = __mstest;
      t.assignData.order.forEach((l) => {
        t.colored[l] = 1;
      });
      t.guideDirty = true;
      t.renderGuide();
      t.checkComplete();
      t.updateProgress && t.updateProgress();
    });
    await idle(page);
    assert.equal(await page.isDisabled('#sfCodes'), true, 'off: nothing to show');
    assert.equal(
      await page.getAttribute('#sfCodes', 'aria-pressed'),
      'false',
      'and not pressed, for a screen reader',
    );
    assert.match(await page.getAttribute('#sfCodes', 'title'), /Every section is coloured/);
    await page.evaluate(() => {
      const t = __mstest;
      t.colored[t.assignData.order[0]] = 0;
      t.guideDirty = true;
      t.renderGuide();
      t.updateProgress && t.updateProgress();
    });
    await idle(page);
    assert.equal(await page.isDisabled('#sfCodes'), false, 'back with a section to colour');
    assert.equal(await page.getAttribute('#sfCodes', 'aria-pressed'), 'true');
    assert.deepEqual(errors, []);
  });
  test('a tapped section’s box points to it: the pointer under the box (or over it) at the section’s label', async () => {
    for (const [w, h] of [
      [1180, 820],
      [390, 844],
    ]) {
      const { page, errors, ctx } = await openApp({ width: w, height: h });
      await sampleGuide(page);
      await page.click('.sftabbtn[data-t="pattern"]');
      await page.evaluate(() => scrollTo(0, 0));
      await idle(page);
      const p = await page.evaluate(() => {
        const t = __mstest,
          l = t.assignData.order.slice().sort((a, b) => t.comps[b].area - t.comps[a].area)[1],
          c = document.getElementById('sfCanvas'),
          r = c.getBoundingClientRect(),
          q = t.labelPos(l);
        return { x: r.left + (q.x / c.width) * r.width, y: r.top + (q.y / c.height) * r.height };
      });
      await page.mouse.click(p.x, p.y);
      await idle(page);
      const tip = await rect(page, '.sftip'),
        ptr = await page.$eval('.sftip', (d) => {
          const a = getComputedStyle(d, '::after');
          return {
            content: a.content,
            x: parseFloat(getComputedStyle(d).getPropertyValue('--tipx')),
            dn: d.classList.contains('sftipdn'),
          };
        });
      assert.notEqual(ptr.content, 'none', 'a pointer');
      // over the label's x (or as near as the box's rounded corners allow), on the side towards it
      const want = Math.max(14, Math.min(tip.width - 14, p.x - tip.left));
      assert.ok(Math.abs(ptr.x - want) < 2, w + ': at the label: ' + JSON.stringify([tip, ptr, p]));
      if (tip.bottom <= p.y + 1)
        assert.equal(ptr.dn, false, 'the box above the section: the pointer under it');
      else if (tip.top >= p.y - 1) assert.equal(ptr.dn, true, 'the box below: the pointer over it');
      assert.deepEqual(errors, []);
      await ctx.close();
    }
  });
}

// ---- from v307-dbg-ui.test.mjs ----
// v307 debugging pass (the UI where the guide, along and markers branches meet): the guide's main button while it
// works ("Page 2 of 3…" on the Print sheet's PDF button, "Building…") is read at 4.5:1 with the app's disabled primary
// look (the markers branch's), as Colour along is while every section is left white (the guide branch's).
{
  // the text's contrast with what is behind it, as seen: colours and opacities composited down from the page
  // (as e2e/v307-markers.test.mjs)
  const contrastOf = (page, sel) =>
    page.evaluate(async (sel) => {
      const el = document.querySelector(sel);
      // (v318.23: a colour or fade still running on it, or on what's behind it, finished first: measured part-way
      // through the Print sheet's 250 ms fade-in, WebKit on GitHub read 4.32:1 for an 8.1:1 icon)
      const up = [];
      for (let n = el; n; n = n.parentElement) up.push(n);
      const runs = document
        .getAnimations()
        .filter(
          (a) => up.includes(a.effect && a.effect.target) && isFinite(a.effect.getComputedTiming().endTime),
        );
      await Promise.race([
        Promise.all(runs.map((a) => a.finished.catch(() => {}))),
        new Promise((r) => setTimeout(r, 3000)),
      ]);
      const P = (s) => {
        const m = /rgba?\(([^)]+)\)/.exec(s);
        if (!m) return [0, 0, 0, 0];
        const v = m[1]
          .split(/[ ,/]+/)
          .filter(Boolean)
          .map(Number);
        return [v[0], v[1], v[2], v.length > 3 ? v[3] : 1];
      };
      const over = (c, b) => [0, 1, 2].map((k) => c[k] * c[3] + b[k] * (1 - c[3]));
      const mix = (a, b, o) => [0, 1, 2].map((k) => a[k] * o + b[k] * (1 - o));
      const chain = [];
      for (let n = el; n && n.nodeType === 1; n = n.parentElement) chain.unshift(n);
      function walk(i, behind) {
        const n = chain[i],
          cs = getComputedStyle(n),
          svg = n instanceof SVGElement,
          inner = over(svg ? [0, 0, 0, 0] : P(cs.backgroundColor), behind);
        let fg, b;
        if (i === chain.length - 1) {
          fg = over(svg && n.tagName !== 'svg' ? P(cs.fill) : P(cs.color), inner);
          b = inner;
        } else [fg, b] = walk(i + 1, inner);
        return [mix(fg, behind, +cs.opacity), mix(b, behind, +cs.opacity)];
      }
      const [fg, bg] = walk(0, [255, 255, 255]);
      const L = (c) => {
        const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
        return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
      };
      const a = L(fg),
        b = L(bg);
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    }, sel);
  // the same from the screen's pixels: the button's commonest colour (its fill, as composited over whatever is behind
  // it, a gradient included) against the pixel of its text farthest from it
  async function seenContrast(page, sel) {
    const png = (await page.locator(sel).screenshot()).toString('base64');
    return page.evaluate(async (b64) => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + b64;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height).data,
        y0 = Math.round(c.height * 0.2),
        y1 = Math.round(c.height * 0.8),
        x0 = Math.round(c.width * 0.05),
        x1 = Math.round(c.width * 0.95),
        n = new Map();
      for (let y = y0; y < y1; y++)
        for (let x = x0; x < x1; x++) {
          const i = (y * c.width + x) * 4,
            k = d[i] + ',' + d[i + 1] + ',' + d[i + 2];
          n.set(k, (n.get(k) || 0) + 1);
        }
      const bg = [...n.entries()]
        .sort((a, b) => b[1] - a[1])[0][0]
        .split(',')
        .map(Number);
      const L = (r, g, b) => {
        const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
      };
      const lb = L(...bg);
      let best = 1;
      for (let y = y0; y < y1; y++)
        for (let x = x0; x < x1; x++) {
          const i = (y * c.width + x) * 4,
            l = L(d[i], d[i + 1], d[i + 2]);
          best = Math.max(best, (Math.max(l, lb) + 0.05) / (Math.min(l, lb) + 0.05));
        }
      return best;
    }, png);
  }
  const look = (page, sel) =>
    page.evaluate((s) => {
      const c = getComputedStyle(document.querySelector(s));
      return { bg: c.backgroundColor, shadow: c.boxShadow, op: c.opacity, cur: c.cursor };
    }, sel);
  // once the button's transitions (its fill, text and fade) have run
  const settled = (page, sel) =>
    page.waitForFunction((s) => document.querySelector(s).getAnimations().length === 0, sel);
  // the button as the app sets it while it works (90-export's _exportPDF and printWait, 53-controls-stages' Build)
  const busy = (page, sel, t) =>
    page.evaluate(
      ([s, t]) => {
        const b = document.querySelector(s);
        b.textContent = t;
        b.disabled = true;
      },
      [sel, t],
    );
  test('the guide’s main button while it works (“Page 2 of 3…”, “Building…”) reads at 4.5:1 and still looks off; Colour along off for a photo with no colour too', async () => {
    for (const [w, h] of [
      [820, 1180],
      [1180, 820],
    ]) {
      const { page, errors, ctx } = await openApp({ width: w, height: h });
      await sampleGuide(page);
      await page.click('.sftabbtn[data-t="share"]');
      await page.click('#sfPrint');
      await page.waitForSelector('#sfSheet.sfprsh');
      await idle(page);
      const on = await look(page, '#sfPDF');
      await busy(page, '#sfPDF', 'Page 2 of 3\u2026');
      await settled(page, '#sfPDF');
      const r1 = Math.min(await contrastOf(page, '#sfPDF'), await seenContrast(page, '#sfPDF'));
      assert.ok(r1 >= 4.5, `“Page 2 of 3…”: ${r1.toFixed(2)}:1 at ${w}×${h} (2.3 before)`);
      const off = await look(page, '#sfPDF');
      assert.notEqual(off.bg, on.bg, 'a fill of its own while it works');
      assert.equal(off.shadow, 'none');
      assert.notEqual(off.cur, 'pointer');
      // the same look as the app's other disabled primary buttons (Tick a set above, Scan's Add)
      const wc = await page.evaluate(() => {
        const b = document.createElement('button');
        b.className = 'btn-primary';
        b.disabled = true;
        document.body.appendChild(b);
        const c = getComputedStyle(b),
          o = { bg: c.backgroundColor, color: c.color };
        b.remove();
        return o;
      });
      assert.deepEqual(
        await page.evaluate(() => {
          const c = getComputedStyle(document.getElementById('sfPDF'));
          return { bg: c.backgroundColor, color: c.color };
        }),
        wc,
      );
      await page.keyboard.press('Escape');
      await idle(page);
      // Edit sections' Build while it builds (a new picture: e2e/fixtures/letter-page.png)
      const pg = await readFile(join(ROOT, 'e2e', 'fixtures', 'letter-page.png'));
      const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.evaluate(() => SF.pickPhoto())]);
      await fc.setFiles({ name: 'letter-page.png', mimeType: 'image/png', buffer: pg });
      await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 60000 });
      await idle(page);
      await busy(page, '#sfBuild', 'Building\u2026');
      await settled(page, '#sfBuild');
      const r2 = await contrastOf(page, '#sfBuild');
      assert.ok(r2 >= 4.5, `“Building…”: ${r2.toFixed(2)}:1`);
      // Colour along while every section is left white (a photo with no colour): no fill, its word readable
      const b = await openApp({ width: w, height: h });
      await sampleGuide(b.page);
      await b.page.click('.sftabbtn[data-t="pattern"]');
      await idle(b.page);
      await b.page.evaluate(() => {
        const t = __mstest,
          s = Math.min(1, 1000 / Math.max(t.W, t.H)),
          pw = Math.round(t.W * s),
          ph = Math.round(t.H * s),
          c = document.createElement('canvas');
        c.width = pw;
        c.height = ph;
        const g = c.getContext('2d');
        g.fillStyle = 'rgb(240,232,214)';
        g.fillRect(0, 0, pw, ph);
        t.setPhotoRef(t.photoFromImage(c), true);
        t.photoXf = { cx: t.W / 2, cy: t.H / 2, sx: t.W / pw, sy: t.H / ph, r: 0 };
        t.photoRecolour();
        t.renderControls();
      });
      await idle(b.page);
      assert.ok(await b.page.isDisabled('#sfColor'));
      await settled(b.page, '#sfColor');
      // (seen on screen: the bar's fade behind it is a gradient, which the computed colours leave out)
      const r3 = await seenContrast(b.page, '#sfColor');
      assert.ok(r3 >= 4.5, `Colour along off: ${r3.toFixed(2)}:1`);
      const ca = await look(b.page, '#sfColor');
      assert.equal(ca.shadow, 'none', 'no glow');
      assert.equal(ca.cur, 'not-allowed');
      assert.deepEqual([...errors, ...b.errors], []);
      await Promise.all([ctx.close(), b.ctx.close()]);
    }
  });
}
