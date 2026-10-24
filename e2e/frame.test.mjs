// The guide’s frame and layout: the picture’s sizes, text size, the header, phones and iPads.
// (v320) Tests organised by feature: each block below came from the file named above it, its tests unchanged.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ENGINE,
  ROOT,
  WK,
  answerAsks,
  buildGo,
  guideName,
  haveSet,
  idle,
  letterGuide,
  menuItem,
  notOnWebKit,
  openApp,
  openAtScale,
  openMenu,
  rename,
  sampleGuide,
  saveGuide,
  scrollTop,
  sectionPoint,
  setup,
  shot,
  teardown,
  until,
} from './helpers.mjs';
import { join } from 'node:path';

before(setup);
after(teardown);

// ---- from guide-frame-2.test.mjs ----
// The guide screen's frame (Release 3, docs/GUIDE-LAYOUT.md): the picture's sizes and its scroll-linked shrink, tabs
// that never move anything, where a change of stage lands, drag to scroll and gestures, side by side, one-time hints,
// overlays that stay on the scaled picture, and full screen, focus mode and Reveal after the picture has shrunk.
// (v296: the second half of guide-frame.test.mjs, split off because on GitHub's WebKit the one file came near node's
// 12-minute limit for a file)
{
  const picH = (page) =>
    page.evaluate(() => Math.round(document.getElementById('sfCanvas').getBoundingClientRect().height));
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
  const overlaps = (a, b) =>
    a.x < b.x + b.width - 0.5 &&
    b.x < a.x + a.width - 0.5 &&
    a.y < b.y + b.height - 0.5 &&
    b.y < a.y + a.height - 0.5;
  const touchAction = (page) =>
    page.evaluate(() => getComputedStyle(document.getElementById('sfPicBox')).touchAction);
  // where the tabs pin: the scroll position at which they reach their sticky top
  const tabsPinAt = (page) =>
    page.evaluate(() => {
      const t = document.querySelector('.sftabs'),
        s = document.querySelector('.sftabsen'),
        cs = getComputedStyle(t);
      return Math.round(
        scrollY + s.getBoundingClientRect().top + parseFloat(cs.marginTop) - parseFloat(cs.top),
      );
    });
  // a real tap where the element is on screen (Playwright's own click would first scroll it into view, which the
  // sticky tabs don't need)
  async function tapAt(page, sel) {
    const r = await rect(page, sel);
    await page.mouse.click(r.x + r.width / 2, r.y + r.height / 2);
  }
  const barGap = (page) =>
    page.evaluate(() => innerHeight - document.querySelector('.sfbar').getBoundingClientRect().bottom);
  async function sideBySide(page) {
    return page.evaluate(() => document.getElementById('sfWork').classList.contains('sfside'));
  }
  // big sections whose label points are inside the picture, biggest first
  const bigSections = (page, n = 6) =>
    page.evaluate((n) => {
      const t = __mstest;
      return t.assignData.order
        .slice()
        .sort((a, b) => t.comps[b].area - t.comps[a].area)
        .slice(0, n);
    }, n);
  const pinH = (page) =>
    page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--pinH')));
  // ---- From the fifth review (guide screen) ----
  const frames = (page) =>
    page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  // ---- From v267 ----
  const zoomState = (page) => page.evaluate(() => [__mstest.zoom, __mstest.panX, __mstest.panY]);
  const WHOLE = [1, 0, 0];
  // ---- From v285 (iPad) ----
  const geom = (page) =>
    page.evaluate(() => {
      const v = document.getElementById('sfCanvas').getBoundingClientRect(),
        t = document.getElementById('sfZoomCtl').getBoundingClientRect(),
        c = document.getElementById('sfCtl').getBoundingClientRect(),
        w = document.getElementById('sfWork');
      // (v320: on an iPad the page sits in its frame with the paper's gutter round it, --paperG, shrunk with it when
      // pinned: the picture's height is the page's and its gutter's, as the fit maths has it)
      const cvEl = document.getElementById('sfCanvas'),
        gut =
          parseFloat(getComputedStyle(document.getElementById('sfView')).getPropertyValue('--paperG')) || 0,
        sc = cvEl.offsetHeight ? v.height / cvEl.offsetHeight : 1;
      return {
        side: getComputedStyle(w).display === 'grid',
        picW: v.width,
        picH: v.height + 2 * gut * sc,
        picL: v.left,
        toolsBottom: t.bottom,
        toolsRight: t.right,
        ctlL: c.left,
        ctlW: c.width,
        maxScroll: document.documentElement.scrollHeight - innerHeight,
        vh: innerHeight,
        vw: innerWidth,
      };
    });
  test('coming back to the Guide tab measures the picture again: pinned tabs, pane heights, Colour along', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    const pin0 = await pinH(page),
      pane0 = await page.evaluate(() =>
        getComputedStyle(document.getElementById('sfWork')).getPropertyValue('--tabMin'),
      );
    assert.equal(pin0, 420);
    await scrollAt(page, 400);
    await page.click('#mHome');
    await idle(page);
    await page.click('#mSections');
    await idle(page);
    assert.equal(await pinH(page), pin0, '--pinH is back');
    assert.equal(
      await page.evaluate(() =>
        getComputedStyle(document.getElementById('sfWork')).getPropertyValue('--tabMin'),
      ),
      pane0,
      'the tabs keep their min-height',
    );
    const th = await page.evaluate(() => {
      const t = document.querySelector('.sftabs'),
        s = document.querySelector('.sftabsen');
      return Math.round(
        scrollY + s.getBoundingClientRect().top + parseFloat(getComputedStyle(t).marginTop) - pin0Top(),
      );
      function pin0Top() {
        return parseFloat(getComputedStyle(t).top);
      }
    });
    await scrollAt(page, th + 200);
    assert.ok(
      Math.abs((await rect(page, '.sftabs')).top - pin0) <= 1,
      'the tabs pin under the picture, not under the app header',
    );
    // Colour along: its fixed picture and the list's scroll padding
    await page.click('#sfColor');
    await idle(page);
    await page.click('#mHome');
    await idle(page);
    await page.click('#mSections');
    await idle(page);
    assert.equal(await pinH(page), 464 + 40, 'Colour along: the fixed picture plus the tool row');
    assert.match(
      await page.evaluate(() => getComputedStyle(document.documentElement).scrollPaddingTop),
      /^5\d\dpx$/,
    );
    assert.deepEqual(errors, []);
  });
  test('a change of stage starts at its top: the header at the top when it fits, else the first row under the pinned block', async () => {
    for (const [w, h] of [
      [390, 844],
      [375, 667],
    ]) {
      const { page, errors, ctx } = await openApp({ width: w, height: h });
      await sampleGuide(page);
      await idle(page);
      await scrollTop(page);
      // from the top of the page, a real tap: the list shows
      await tapAt(page, '#sfColor');
      await idle(page);
      const bar = await rect(page, '#sfWork>.sfbar'),
        tools = await rect(page, '#sfZoomCtl'),
        row = await rect(page, '#sfAlist .sfarow'),
        hd = await rect(page, '#sfHead');
      assert.ok(Math.abs(hd.top) <= 1, `${w}×${h}: the header at the top (${hd.top})`);
      assert.ok(
        row.top >= tools.bottom - 0.5 && row.bottom <= bar.top + 0.5,
        `${w}×${h}: the first row shows (${row.top}–${row.bottom}, bar ${bar.top})`,
      );
      // ← Plan from far down the list: Plan opens at its top, with its tabs
      await scrollAt(page, 5000);
      await tapAt(page, '#sfDoneBtn');
      await idle(page);
      const t = await rect(page, '.sftabs');
      assert.ok(
        Math.abs((await rect(page, '#sfHead')).top) <= 1 &&
          t.bottom <= (await rect(page, '#sfWork>.sfbar')).top,
        'Plan: header and tabs on the screen',
      );
      // from a tab scrolled far down: Colour along starts with its first rows, not under the pinned block
      await page.click('.sftabbtn[data-t="colours"]');
      await scrollAt(page, 5000);
      await tapAt(page, '#sfColor');
      await idle(page);
      const info = await rect(page, '#sfCtl .sfinfo'),
        pb = (await rect(page, '#sfZoomCtl')).bottom;
      assert.ok(info.top >= pb - 0.5, 'the instructions are under the pinned block');
      await tapAt(page, '#sfDoneBtn');
      await idle(page);
      // Build guide from the bottom of Edit sections: the header shows, not the middle of the Colours tab
      await answerAsks(page);
      await page.click('#sfBack2');
      await idle(page);
      // (v288: with nothing edited the bar goes back to the Plan; an edit brings Build again)
      await page.evaluate(() => {
        const t = __mstest,
          l = t.assignData.order[3];
        t.secState[l] = 2;
        t.guideDirty = true;
        t.render();
      });
      await idle(page);
      await scrollAt(page, 5000);
      await tapAt(page, '#sfBuild');
      await page.waitForSelector('#sfColor');
      await idle(page);
      assert.ok(Math.abs((await rect(page, '#sfHead')).top) <= 1, 'Build guide lands on the header');
      assert.deepEqual(errors, []);
      await ctx.close();
    }
  });
  test('the one-time "tap a section" hint is under the tabs, which start above the bar on first view', async () => {
    const { page, errors } = await openApp({ width: 390, height: 844 });
    await sampleGuide(page);
    await idle(page);
    await scrollTop(page);
    const hint = await rect(page, '.sfinfo.sfonce'),
      tabs = await rect(page, '.sftabs'),
      bar = await rect(page, '#sfWork>.sfbar');
    assert.ok(hint.top >= tabs.bottom, 'hint below the tabs');
    assert.ok(tabs.bottom <= bar.top + 0.5, `tab labels above the bar (${tabs.bottom} vs ${bar.top})`);
    assert.deepEqual(errors, []);
  });
  test('side by side: the picture is pinned whole on opening and on a change of stage; the bar is flush, edge to edge', async () => {
    const { page, errors } = await openApp({ width: 844, height: 390 });
    await sampleGuide(page);
    await idle(page);
    const whole = async (what) => {
      const c = await rect(page, '#sfCanvas');
      assert.ok(c.top >= -0.5 && c.bottom <= 390.5, `${what}: picture ${c.top}–${c.bottom}`);
    };
    await whole('opened');
    await page.click('#sfColor');
    await idle(page);
    await whole('Colour along');
    await scrollAt(page, 300);
    const bar = await rect(page, '#sfWork>.sfbar'),
      ctl = await rect(page, '#sfCtl'),
      pic = await rect(page, '#sfView');
    assert.ok(Math.abs(bar.bottom - 390) <= 0.5, 'flush with the bottom');
    assert.ok(
      bar.left <= ctl.left - 10 && bar.left >= pic.right - 0.5,
      'its background reaches from the picture column',
    );
    assert.equal(
      await page.evaluate(
        ([x, y]) => !!document.elementFromPoint(x, y).closest('.sfbar'),
        [ctl.left + 2, 385],
      ),
      true,
      'nothing of the list shows beside it',
    );
    await page.click('#sfDoneBtn');
    await idle(page);
    await whole('Plan again');
    assert.deepEqual(errors, []);
  });
  test(
    'Blend: the picture scrolls the page by drag, except a drag that starts on an anchor dot',
    notOnWebKit(WK.touch),
    async () => {
      const { page, errors } = await openApp();
      await sampleGuide(page);
      await idle(page);
      await page.click('.sftabbtn[data-t="pattern"]');
      await page.click('#sfFam [data-v="blend"]');
      await idle(page);
      await scrollTop(page);
      assert.equal(
        await page.evaluate(() => getComputedStyle(document.getElementById('sfPicBox')).touchAction),
        'pan-y',
      );
      const r = await page.evaluate(() => {
        const c = document.getElementById('sfCanvas'),
          b = c.getBoundingClientRect(),
          a = __mstest.anchors[0],
          at = (x, y) => {
            const t = new Touch({ identifier: 1, target: c, clientX: x, clientY: y }),
              e = new TouchEvent('touchstart', {
                touches: [t],
                targetTouches: [t],
                changedTouches: [t],
                cancelable: true,
                bubbles: true,
              });
            c.dispatchEvent(e);
            return e.defaultPrevented;
          };
        return {
          dot: at(b.left + (a.x / c.width) * b.width, b.top + (a.y / c.height) * b.height),
          off: at(b.left + 4, b.bottom - 4),
        };
      });
      assert.deepEqual(r, { dot: true, off: false });
      assert.deepEqual(errors, []);
    },
  );
  test("zoomed in, a change of the picture's size (turning, resizing, another stage) leaves no blank strip", async () => {
    const { page, errors } = await openApp({ width: 390, height: 844 });
    await sampleGuide(page);
    await idle(page);
    await scrollTop(page);
    for (let i = 0; i < 3; i++) {
      await page.click('#sfZin');
      await idle(page);
    }
    // pan to the bottom-right corner
    await page.evaluate(() => {
      const cv = document.getElementById('sfCanvas');
      cv.dispatchEvent(
        new WheelEvent('wheel', { deltaX: 5000, deltaY: 5000, bubbles: true, cancelable: true }),
      );
    });
    await idle(page);
    const inside = () =>
      page.evaluate(() => {
        const t = __mstest,
          cv = document.getElementById('sfCanvas'),
          w = parseFloat(cv.style.width),
          h = parseFloat(cv.style.height);
        return {
          ok:
            t.panX <= 0.5 &&
            t.panY <= 0.5 &&
            t.panX >= w - w * t.zoom - 0.5 &&
            t.panY >= h - h * t.zoom - 0.5,
          w,
          h,
          px: t.panX,
          py: t.panY,
          z: t.zoom,
        };
      });
    const a = await inside();
    assert.ok(a.ok && a.z > 1, JSON.stringify(a));
    for (const [w, h] of [
      [390, 640],
      [360, 900],
      [390, 844],
    ]) {
      await page.setViewportSize({ width: w, height: h });
      await idle(page);
      const b = await inside();
      assert.ok(b.ok, `${w}×${h}: the pan stays inside the picture ${JSON.stringify(b)}`);
    }
    // the same when the stage changes to one with another picture size (Colour along keeps a fixed size)
    await page.setViewportSize({ width: 375, height: 667 });
    await idle(page);
    await page.evaluate(() => scrollTo(0, 400));
    await frames(page);
    for (let i = 0; i < 2; i++) {
      await page.click('#sfZin');
      await idle(page);
    }
    await page.evaluate(() => {
      const cv = document.getElementById('sfCanvas');
      cv.dispatchEvent(
        new WheelEvent('wheel', { deltaX: 5000, deltaY: 5000, bubbles: true, cancelable: true }),
      );
    });
    await page.click('#sfColor');
    await idle(page);
    const c = await inside();
    assert.ok(c.ok, 'Colour along: ' + JSON.stringify(c));
    assert.deepEqual(errors, []);
  });
  test('turning a phone into side by side pins the picture, as opening side by side does', async () => {
    const { page, errors } = await openApp({ width: 390, height: 844 });
    await sampleGuide(page);
    await idle(page);
    await scrollTop(page);
    await page.setViewportSize({ width: 844, height: 390 });
    await idle(page);
    // (the resize reaches the page a frame or two later in GitHub's WebKit: wait for the new layout, up to 5 s)
    await until(
      page,
      () => {
        const s = document.getElementById('sfView'),
          c = document.getElementById('sfCanvas').getBoundingClientRect();
        return (
          __mstest.geo.side &&
          Math.abs(s.getBoundingClientRect().top - (parseFloat(getComputedStyle(s).top) || 0)) <= 1 &&
          c.bottom <= 391
        );
      },
      null,
      'side by side, pinned, foot on the screen',
      5000,
    ).catch(() => {});
    const v = await page.evaluate(() => {
      const s = document.getElementById('sfView');
      return {
        top: s.getBoundingClientRect().top,
        want: parseFloat(getComputedStyle(s).top) || 0,
        side: __mstest.geo.side,
      };
    });
    assert.equal(v.side, true);
    assert.ok(Math.abs(v.top - v.want) <= 1, `the picture is pinned at its top (${v.top}, want ${v.want})`);
    const r = await rect(page, '#sfCanvas');
    assert.ok(r.bottom <= 390 + 1, `the picture's foot is on the screen (${r.bottom})`);
    assert.deepEqual(errors, []);
  });
  test('every change of stage starts at the whole picture; Find next still zooms', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    const zoomIn = async () => {
      await scrollTop(page);
      await page.click('#sfZin');
      await page.click('#sfZin');
      await idle(page);
      const z = await zoomState(page);
      assert.ok(z[0] > 1, 'zoomed in');
    };
    // Plan → Colour along
    await zoomIn();
    await page.click('#sfColor');
    await idle(page);
    assert.deepEqual(await zoomState(page), WHOLE, 'Colour along starts whole');
    // Find next zooms by itself
    // (v288: as far as the section needs, so the row of the marker with the smallest section)
    const ri = await page.evaluate(() => {
      const t = __mstest,
        ks = [...document.querySelectorAll('#sfAlist .sfarow')].map((r) => r.dataset.k);
      let best = 0,
        bs = 1e9;
      t.alongList().forEach((e) => {
        const i = ks.indexOf(e.key);
        e.secs.forEach((l) => {
          if (i >= 0 && t.comps[l].area < bs) {
            bs = t.comps[l].area;
            best = i;
          }
        });
      });
      return best;
    });
    await page.locator('#sfAlist .sfarow .sfah').nth(ri).click();
    await idle(page);
    for (let i = 0; i < 40 && (await zoomState(page))[0] <= 1; i++) {
      await page.click('#sfFindNext');
      await idle(page);
    }
    assert.ok((await zoomState(page))[0] > 1, 'Find next zooms');
    // Colour along → Plan (← Plan)
    await page.click('#sfDoneBtn');
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.sfmode), 'guide');
    assert.deepEqual(await zoomState(page), WHOLE, 'Plan starts whole');
    // Plan → Edit sections
    await zoomIn();
    await page.click('#sfBack2');
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.sfmode), 'review');
    assert.deepEqual(await zoomState(page), WHOLE, 'Edit sections starts whole');
    // Edit sections → Plan (v288: ← Plan, nothing edited)
    await zoomIn();
    await page.click('#sfToPlan');
    await page.waitForFunction(() => __mstest.sfmode === 'guide');
    await idle(page);
    assert.deepEqual(await zoomState(page), WHOLE, 'the Plan starts whole');
    assert.deepEqual(errors, []);
  });
  test('v285 iPad portrait: one column on the 11" and the 13", using the width; the picture 60% to start, 50% scrolled', async () => {
    for (const [w, h] of [
      [834, 1194],
      [1024, 1366],
    ]) {
      const { page, errors, ctx } = await openApp({ width: w, height: h });
      await sampleGuide(page);
      await letterGuide(page);
      await page.evaluate(() => scrollTo(0, 0));
      await idle(page);
      let g = await geom(page);
      assert.equal(g.side, false, `${w}×${h}: one column`);
      assert.ok(g.ctlW > 600, `${w}×${h}: the controls use the width (${g.ctlW})`);
      assert.ok(Math.abs(g.picH - h * 0.6) < 3 || g.picW > g.ctlW - 4, `${w}×${h}: 60% (${g.picH})`);
      await page.evaluate(() => scrollTo(0, 2000));
      await idle(page);
      // (50%, or less shrunk where the page ends first: the tabs are only as tall as the tallest, so a big screen
      // doesn't scroll into empty space just to shrink the picture. The picture shrinks after the scroll: WebKit on
      // GitHub can still be at 60% when idle, so wait for it to settle)
      await page
        .waitForFunction(
          (h) => {
            const cvEl = document.getElementById('sfCanvas'),
              v0 = cvEl.getBoundingClientRect().height,
              gut =
                parseFloat(
                  getComputedStyle(document.getElementById('sfView')).getPropertyValue('--paperG'),
                ) || 0,
              v = v0 + 2 * gut * (cvEl.offsetHeight ? v0 / cvEl.offsetHeight : 1),
              end = Math.abs(scrollY - (document.documentElement.scrollHeight - innerHeight)) <= 1;
            return Math.abs(v - h * 0.5) < 3 || (end && v > h * 0.5 && v < h * 0.6);
          },
          h,
          { timeout: 5000 },
        )
        .catch(() => {});
      g = await geom(page);
      const end = await page.evaluate(
        () => Math.abs(scrollY - (document.documentElement.scrollHeight - innerHeight)) <= 1,
      );
      assert.ok(
        Math.abs(g.picH - h * 0.5) < 3 || (end && g.picH > h * 0.5 && g.picH < h * 0.6),
        `${w}×${h}: 50% scrolled, or as far as the page goes (${g.picH})`,
      );
      // Colour along: 60%
      await page.evaluate(() => scrollTo(0, 0));
      await page.click('#sfColor');
      await idle(page);
      assert.ok(Math.abs((await geom(page)).picH - h * 0.6) < 3, 'Colour along 60%');
      assert.deepEqual(errors, []);
      await ctx.close();
    }
  });
  test('v285 iPad landscape: the picture and its tools fully on screen as the guide opens, its column fitted to it; tabs as tall as the tallest', async () => {
    for (const [w, h] of [
      [1194, 834],
      [1366, 1024],
    ]) {
      // (v318.18: More options as it starts, shut: Colours folds where the column beside the picture is narrow)
      const { page, errors, ctx } = await openApp({ width: w, height: h, moreShut: true });
      await sampleGuide(page);
      await letterGuide(page);
      await page.evaluate(() => scrollTo(0, 0));
      await idle(page);
      const g = await geom(page);
      assert.equal(g.side, true, `${w}×${h}: side by side`);
      assert.ok(g.toolsBottom <= h + 1, `${w}×${h}: tools on screen (${g.toolsBottom})`);
      assert.ok(g.picL + g.picW <= g.ctlL, 'picture left of the controls');
      assert.ok(
        g.ctlL - (g.picL + g.picW) < 120,
        `the picture's column fits it (gap ${g.ctlL - (g.picL + g.picW)})`,
      );
      assert.ok(g.ctlW >= 340 && g.ctlW <= 561, `controls ${g.ctlW}`);
      // (v318.18: Colours folds under More options where the column is under 420px, as on a phone; not wider)
      assert.equal(
        !!(await page.$('#sfMore-colours')),
        g.ctlW < 420,
        `${w}×${h}: Colours folded at ${g.ctlW}px`,
      );
      // every tab: nothing to scroll into but the room the page needs, and switching moves nothing (once the first
      // visit's "tap a section" line has gone, at the first change of tab, v289)
      await page.evaluate(() => document.querySelector('.sftabbtn[data-t="pattern"]').click());
      await idle(page);
      const heights = [];
      for (const t of ['colours', 'pattern', 'shading', 'share']) {
        await page.evaluate((t) => document.querySelector(`.sftabbtn[data-t="${t}"]`).click(), t);
        await idle(page);
        heights.push(await page.evaluate(() => document.documentElement.scrollHeight));
      }
      assert.ok(
        heights.every((x) => x === heights[0]),
        'the same page height on every tab: ' + heights,
      );
      // (v308: the Colours tab grew about 120px — the marker count's −/+ row and the Include row with its status line,
      // as Ben chose — so on the 11" the page now scrolls about 110px to reach Colour along. That scroll must be the
      // tallest tab's own content: its panel filled to its end, and the page ending at the card's last button, not empty
      // space under it. It had been "within 40px of the screen", from before Colours was taller than it. v318.18: the
      // tallest tab's, whichever it is: Colours folds on the 11" now, which can leave Pattern the tallest.)
      const content = {};
      for (const t of ['colours', 'pattern', 'shading', 'share']) {
        await page.evaluate((t) => document.querySelector(`.sftabbtn[data-t="${t}"]`).click(), t);
        await idle(page);
        content[t] = await page.evaluate((t) => {
          const p = document.getElementById('sfPanel-' + t),
            top = p.getBoundingClientRect().top;
          return (
            [...p.querySelectorAll('*')]
              .filter((x) => x.getClientRects().length)
              .reduce((m, x) => Math.max(m, x.getBoundingClientRect().bottom), 0) - top
          );
        }, t);
      }
      const tallest = Object.keys(content).sort((a, b) => content[b] - content[a])[0];
      await page.evaluate((t) => document.querySelector(`.sftabbtn[data-t="${t}"]`).click(), tallest);
      await idle(page);
      await page.evaluate(() => scrollTo(0, 5000));
      await idle(page);
      const fill = await page.evaluate((t) => {
        const p = document.getElementById('sfPanel-' + t),
          pb = p.getBoundingClientRect().bottom;
        const last = [...p.querySelectorAll('*')]
          .filter((x) => x.getClientRects().length)
          .reduce((m, x) => Math.max(m, x.getBoundingClientRect().bottom), 0);
        // (Colour along's bar stays at the foot of the screen: scrolled to the end, the tab's last line sits just above it)
        return {
          slack: pb - last,
          end: document.getElementById('sfColor').getBoundingClientRect().top - last,
        };
      }, tallest);
      await page.evaluate(() => scrollTo(0, 0));
      await idle(page);
      assert.ok(
        heights[0] - h <= 40 || fill.slack <= 12,
        `${w}×${h}: the scroll is the ${tallest} tab's content, not empty space (${heights[0] - h}px, ${Math.round(fill.slack)}px unused)`,
      );
      assert.ok(
        heights[0] - h <= 40 || (fill.end >= 0 && fill.end <= 60),
        `${w}×${h}: scrolled to the end, the ${tallest} tab's last line just above the bar (${Math.round(fill.end)}px)`,
      );
      assert.ok(heights[0] - h <= 160, `${w}×${h}: no long scroll (${heights[0] - h}px)`);
      assert.deepEqual(errors, []);
      await ctx.close();
    }
  });
  test('v285: the side-by-side rule is the same in the CSS and the script', async () => {
    for (const [w, h] of [
      [390, 844],
      [844, 390],
      [834, 1194],
      [1024, 1366],
      [1180, 820],
      [1194, 834],
      [1099, 1300],
      [1100, 1300],
      [1440, 900],
    ]) {
      const { page, errors, ctx } = await openApp({ width: w, height: h });
      await sampleGuide(page);
      await idle(page);
      const r = await page.evaluate(() => ({
        css: getComputedStyle(document.getElementById('sfWork')).display === 'grid',
        js: __mstest.sideBySide(),
      }));
      assert.equal(r.css, r.js, `${w}×${h}`);
      assert.deepEqual(errors, []);
      await ctx.close();
    }
  });
}

// ---- from guide-frame.test.mjs ----
// The guide screen's frame (Release 3, docs/GUIDE-LAYOUT.md): the picture's sizes and its scroll-linked shrink, tabs
// that never move anything, where a change of stage lands, drag to scroll and gestures, side by side, one-time hints,
// overlays that stay on the scaled picture, and full screen, focus mode and Reveal after the picture has shrunk.
// (v296: in two files, this and guide-frame-2: on GitHub's WebKit the one file came near node's 12-minute limit for a
// file, and once gave no results until its retry)
{
  const picH = (page) =>
    page.evaluate(() => Math.round(document.getElementById('sfCanvas').getBoundingClientRect().height));
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
  const overlaps = (a, b) =>
    a.x < b.x + b.width - 0.5 &&
    b.x < a.x + a.width - 0.5 &&
    a.y < b.y + b.height - 0.5 &&
    b.y < a.y + a.height - 0.5;
  const touchAction = (page) =>
    page.evaluate(() => getComputedStyle(document.getElementById('sfPicBox')).touchAction);
  // where the tabs pin: the scroll position at which they reach their sticky top
  const tabsPinAt = (page) =>
    page.evaluate(() => {
      const t = document.querySelector('.sftabs'),
        s = document.querySelector('.sftabsen'),
        cs = getComputedStyle(t);
      return Math.round(
        scrollY + s.getBoundingClientRect().top + parseFloat(cs.marginTop) - parseFloat(cs.top),
      );
    });
  // a real tap where the element is on screen (Playwright's own click would first scroll it into view, which the
  // sticky tabs don't need)
  async function tapAt(page, sel) {
    const r = await rect(page, sel);
    await page.mouse.click(r.x + r.width / 2, r.y + r.height / 2);
  }
  const barGap = (page) =>
    page.evaluate(() => innerHeight - document.querySelector('.sfbar').getBoundingClientRect().bottom);
  async function sideBySide(page) {
    return page.evaluate(() => document.getElementById('sfWork').classList.contains('sfside'));
  }
  // big sections whose label points are inside the picture, biggest first
  const bigSections = (page, n = 6) =>
    page.evaluate((n) => {
      const t = __mstest;
      return t.assignData.order
        .slice()
        .sort((a, b) => t.comps[b].area - t.comps[a].area)
        .slice(0, n);
    }, n);
  test('picture size: 55% shrinking with the scroll to 45% (40% under 780px tall); Colour along a fixed 55% (45%)', async () => {
    // (on a short screen the start size is capped so the tool row ends above the bar at the top of the page: 367 would
    // be 55% of 667)
    for (const [w, h, full55, floor, along] of [
      [390, 844, 464, 380, 464],
      [375, 667, 367, 267, 300],
    ]) {
      const { page, errors, ctx } = await openApp({ width: w, height: h });
      await sampleGuide(page);
      await idle(page);
      const cap = await page.evaluate(() =>
        Math.floor(
          innerHeight -
            document.querySelector('#sfWork>.sfbar').offsetHeight -
            40 -
            (document.getElementById('sfHead').getBoundingClientRect().bottom + scrollY),
        ),
      );
      let full = Math.max(floor, Math.min(full55, cap));
      if (h === 667) assert.ok(full < full55, 'capped on the short screen: ' + full);
      // (within a pixel: the app measures the header's foot and the rows' heights with their fractions; v289: smaller
      // still where that lets the tabs and their first row show, down to the floor)
      const full0 = await picH(page),
        tabsB = (await rect(page, '.sftabs')).bottom,
        barT = (await rect(page, '#sfWork>.sfbar')).top;
      assert.ok(full0 <= full + 1 && full0 >= floor, `${w}×${h}: full size at the top (${full0}, ${full})`);
      if (full0 < full - 1)
        assert.ok(
          full0 === floor || Math.abs(tabsB + 76 - barT) <= 2,
          `the tabs and a row above the bar: ${tabsB}, ${barT}`,
        );
      else assert.ok(tabsB + 76 <= barT + 1, 'room for the tabs and a row');
      assert.ok(tabsB <= barT, 'the tabs on the first screen');
      full = full0;
      // (the measured picture within a pixel of the size the app worked out: a fraction can round either way, v308 run)
      const geo = await page.evaluate(() => [__mstest.geo.full, __mstest.geo.comp]);
      assert.ok(
        Math.abs(geo[0] - full) <= 1 && geo[1] === floor,
        `${w}×${h}: the app's sizes ${geo}, measured ${full}`,
      );
      const top0 = await page.evaluate(
        () => document.getElementById('sfView').getBoundingClientRect().top + scrollY,
      );
      // in step with the scroll: 30px past the block's top takes 30px off, with the picture's top kept at the screen top
      await scrollAt(page, Math.round(top0) + 30);
      assert.ok(
        Math.abs((await picH(page)) - Math.max(floor, full - 30)) <= 1,
        `${w}×${h}: 30px scrolled, ${await picH(page)}`,
      );
      assert.ok(
        Math.abs((await rect(page, '#sfCanvas')).top) <= 1,
        'the picture stays at the top of the screen',
      );
      // never below the floor, however far the page goes
      for (const y of [top0 + (full - floor), top0 + (full - floor) + 60, 5000]) {
        await scrollAt(page, Math.round(y));
        assert.equal(await picH(page), floor, `${w}×${h} at ${Math.round(y)}: floor`);
      }
      const pin = await page.evaluate(() =>
        parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--pinH')),
      );
      assert.equal(pin, floor + 40, '--pinH is the floor-size picture plus the 40px tool row');
      assert.ok(Math.abs((await rect(page, '#sfZoomCtl')).bottom - pin) <= 1, 'the tool row ends at --pinH');
      await scrollAt(page, 0);
      assert.equal(await picH(page), full, 'back to full size at the top');
      // Colour along: fixed, the list scrolls under it
      await page.click('#sfColor');
      await idle(page);
      await scrollAt(page, 0);
      await idle(page);
      assert.equal(await picH(page), along, `${w}×${h}: Colour along`);
      await scrollAt(page, 5000);
      assert.equal(await picH(page), along, 'Colour along never shrinks');
      assert.ok(Math.abs((await rect(page, '#sfCanvas')).top) <= 1, 'pinned at the top');
      assert.deepEqual(errors, []);
      await ctx.close();
    }
  });
  test('a picture whose width holds it under the floor does not shrink', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await answerAsks(page);
    await page.click('#sfBack2');
    await page.click('#sfAdjToggle');
    await page.click('#sfRotR');
    await idle(page, 1500);
    const g = await page.evaluate(() => __mstest.geo);
    assert.ok(g.full < 380 && g.full === g.comp && !g.shrink, 'a wide picture: ' + JSON.stringify(g));
    const h0 = await picH(page);
    await scrollAt(page, 300);
    assert.equal(await picH(page), h0);
    assert.deepEqual(errors, []);
  });
  test('switching tabs never moves anything: not pinned, pinned at the threshold, and scrolled into a tab', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    // not pinned yet (the tabs 100px under where they pin): nothing moves, however short the tab
    const th = await tabsPinAt(page);
    await scrollAt(page, th - 100);
    const h0 = await picH(page),
      t0 = (await rect(page, '.sftabs')).top;
    for (const t of ['shading', 'share', 'pattern', 'colours']) {
      await tapAt(page, `.sftabbtn[data-t="${t}"]`);
      await idle(page);
      assert.equal(await page.evaluate(() => scrollY), th - 100, t);
      assert.equal(await picH(page), h0, t);
      assert.ok(Math.abs((await rect(page, '.sftabs')).top - t0) <= 0.5, t);
    }
    // pinned: the tabs stay put and the new tab opens at its top, right under them
    await scrollAt(page, th);
    const tabs0 = await rect(page, '.sftabs'),
      pin = await page.evaluate(() =>
        parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--pinH')),
      );
    assert.ok(Math.abs(tabs0.top - pin) <= 1, 'tabs pinned under the picture and tool row');
    for (const t of ['shading', 'share', 'colours', 'pattern', 'shading']) {
      await tapAt(page, `.sftabbtn[data-t="${t}"]`);
      await idle(page);
      assert.equal(await page.evaluate(() => scrollY), th, `${t}: same scroll`);
      assert.equal(await picH(page), 380, `${t}: same picture size`);
      assert.ok(Math.abs((await rect(page, '.sftabs')).top - tabs0.top) <= 0.5, `${t}: tabs where they were`);
      // (under the line under the tabs: the sample's, which takes the place of the first visit's "tap a section" hint at
      // the first change of tab, v289)
      const pane = await rect(page, `.sftab[data-tab="${t}"]`),
        hint = await rect(page, '.sfinfo.sfonce');
      assert.ok(Math.abs(pane.top - (hint ? hint.bottom : tabs0.bottom)) <= 2, `${t}: opens at its top`);
    }
    // scrolled into a long tab: the next one opens at its top with the tabs still pinned
    await tapAt(page, '.sftabbtn[data-t="colours"]');
    await scrollAt(page, th + 100);
    assert.ok((await page.evaluate(() => scrollY)) > th + 60, 'scrolled into Colours');
    await tapAt(page, '.sftabbtn[data-t="share"]');
    await idle(page);
    assert.equal(await page.evaluate(() => scrollY), th);
    assert.ok(Math.abs((await rect(page, '.sftabs')).top - tabs0.top) <= 0.5);
    assert.equal(await picH(page), 380);
    assert.deepEqual(errors, []);
  });
  test('the page ends at the guide card: no gap under the bar at the end of any tab or stage', async () => {
    for (const [w, h] of [
      [390, 844],
      [375, 667],
      [844, 390],
    ]) {
      const { page, errors, ctx } = await openApp({ width: w, height: h });
      await sampleGuide(page);
      await idle(page);
      for (const t of ['colours', 'pattern', 'shading', 'share']) {
        await page.click(`.sftabbtn[data-t="${t}"]`);
        await scrollAt(page, 1e6);
        await idle(page);
        const g = await barGap(page);
        assert.ok(g >= -0.5 && g <= 2, `${w}×${h} ${t}: ${g}px under the bar`);
      }
      await page.click('#sfColor');
      await idle(page);
      await scrollAt(page, 1e6);
      await idle(page);
      assert.ok(Math.abs(await barGap(page)) <= 2, `${w}×${h} Colour along: ${await barGap(page)}px`);
      await answerAsks(page);
      await page.click('#sfDoneBtn');
      await page.click('#sfBack2');
      await idle(page);
      await scrollAt(page, 1e6);
      await idle(page);
      assert.ok(Math.abs(await barGap(page)) <= 2, `${w}×${h} Edit sections: ${await barGap(page)}px`);
      assert.deepEqual(errors, []);
      await ctx.close();
    }
  });
  test('drag to scroll: pan-y at zoom 1; none when zoomed, painting, a sheet is open, drawing, or on the sun', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    assert.equal(await touchAction(page), 'pan-y', 'Plan at zoom 1');
    await page.click('#sfZin');
    assert.equal(await touchAction(page), 'none', 'zoomed in');
    await page.click('#sfZrst');
    assert.equal(await touchAction(page), 'pan-y');
    await openMenu(page);
    assert.equal(await touchAction(page), 'none', 'a sheet is open');
    await page.keyboard.press('Escape');
    assert.equal(await touchAction(page), 'pan-y');
    await page.click('.sftabbtn[data-t="pattern"]');
    await page.click('#sfFam [data-v="manual"]');
    await idle(page);
    assert.equal(await touchAction(page), 'pan-y', 'Manual, Paint off');
    await page.click('#sfPaint');
    assert.equal(await touchAction(page), 'none', 'Paint on');
    await page.click('#sfPaint');
    await page.click('#sfFam [data-v="gradient"]');
    await idle(page);
    await page.click('.sftabbtn[data-t="shading"]');
    await page.evaluate(() => __mstest.shadeTo('full'));
    await idle(page);
    assert.equal(
      await page.evaluate(() => getComputedStyle(document.getElementById('sfSun')).touchAction),
      'none',
      'a drag on the sun never scrolls',
    );
    // a finger dragged up the picture scrolls the page; two fingers still pinch it (touch is driven through Chromium's
    // own protocol, so Safari's engine skips this part)
    if (ENGINE === 'chromium') {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
      const T = (type, pts) =>
        cdp.send('Input.dispatchTouchEvent', {
          type,
          touchPoints: pts.map((p, i) => ({ x: p.x, y: p.y, id: i + 1 })),
        });
      await scrollAt(page, 0);
      const c = await rect(page, '#sfCanvas'),
        x = c.x + c.width / 2,
        y = c.y + c.height * 0.8;
      await T('touchStart', [{ x, y }]);
      for (let i = 1; i <= 8; i++) await T('touchMove', [{ x, y: y - i * 25 }]);
      await T('touchEnd', []);
      await idle(page, 1500);
      assert.ok((await page.evaluate(() => scrollY)) > 40, 'the page scrolled');
      assert.equal(await page.evaluate(() => __mstest.zoom), 1);
      const c2 = await rect(page, '#sfCanvas'),
        cx = c2.x + c2.width / 2,
        cy = c2.y + c2.height / 2,
        sy = await page.evaluate(() => scrollY);
      await T('touchStart', [
        { x: cx - 20, y: cy },
        { x: cx + 20, y: cy },
      ]);
      for (let i = 1; i <= 6; i++)
        await T('touchMove', [
          { x: cx - 20 - i * 12, y: cy + i * 3 },
          { x: cx + 20 + i * 12, y: cy + i * 3 },
        ]);
      await T('touchEnd', []);
      await idle(page);
      assert.ok((await page.evaluate(() => __mstest.zoom)) > 1.5, 'a pinch at zoom 1 zooms the picture');
      assert.equal(await page.evaluate(() => scrollY), sy, 'and does not scroll the page');
      assert.equal(await touchAction(page), 'none', 'zoomed in');
      await page.click('#sfZrst');
    }
    // Edit sections: the tools that draw
    await answerAsks(page);
    await page.click('#sfBack2');
    await idle(page);
    for (const [m, want] of [
      ['toggle', 'pan-y'],
      ['merge', 'pan-y'],
      ['split', 'none'],
      ['add', 'none'],
      ['toggle', 'pan-y'],
    ]) {
      await page.click(`#sfEdit [data-m="${m}"]`);
      assert.equal(await touchAction(page), want, 'Edit sections: ' + m);
    }
    assert.deepEqual(errors, []);
  });
  test('side by side (landscape phones and wide screens): the picture fills its column, tools beside it, nothing on it', async () => {
    for (const [w, h] of [
      [844, 390],
      [667, 375],
      [1280, 800],
    ]) {
      const { page, errors, ctx } = await openApp({ width: w, height: h });
      await sampleGuide(page);
      await idle(page);
      assert.ok(await sideBySide(page), `${w}×${h} is side by side`);
      await scrollAt(page, 400);
      await idle(page);
      const c = await rect(page, '#sfCanvas'),
        hd = await rect(page, '#sfHead'),
        ctl = await rect(page, '#sfCtl');
      assert.ok(
        c.right <= hd.left && c.right <= ctl.left,
        `${w}×${h}: the header and controls are to the right of the picture`,
      );
      // (landscape phones: the screen's height; 600px tall and more, v285: what's left below the header at rest)
      if (h < 600)
        assert.ok(Math.abs(c.height - (h - 16)) <= 2, `${w}×${h}: fills the column's height (${c.height})`);
      else
        assert.ok(
          c.height >= h * 0.7 - 14 && c.height <= h - 14,
          `${w}×${h}: fits below the header (${c.height})`,
        );
      assert.ok(c.top >= 7 && c.bottom <= h - 7, `${w}×${h}: whole picture in view while scrolled`);
      assert.ok(
        await page.evaluate(() => document.getElementById('sfWork').classList.contains('sftoolsv')),
        'tools stacked beside it',
      );
      const btns = await page.$$eval('#sfZoomCtl .sfz', (b) =>
        b.filter((x) => x.offsetParent).map((x) => x.getBoundingClientRect().toJSON()),
      );
      assert.ok(btns.length >= 4);
      for (const b of btns) assert.ok(!overlaps(b, c), `${w}×${h}: a tool button is on the picture`);
      assert.ok(
        btns.every((b) => b.x >= c.right),
        'beside, to the right',
      );
      assert.equal(await picH(page), Math.round(c.height), 'no shrink side by side');
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        ),
        true,
        'no sideways scroll',
      );
      // the ⋯ sheet covers the controls column, not the picture
      // (waiting for it to arrive, not for its slide to end: GitHub's WebKit can leave a transition unfinished for a while)
      await openMenu(page);
      await idle(page);
      const onCol = ([cr, h]) => {
        const s = document.getElementById('sfSheet').getBoundingClientRect();
        return s.left >= cr && Math.round(s.top) === 0 && Math.abs(s.bottom - h) <= 1;
      };
      await until(page, onCol, [c.right, h], 'the sheet in place', 15000).catch(() => {});
      const s = await rect(page, '#sfSheet');
      assert.ok(
        s.left >= c.right && Math.round(s.top) === 0 && Math.abs(s.bottom - h) <= 1,
        `${w}×${h}: sheet over the controls column (${JSON.stringify(s)})`,
      );
      await page.keyboard.press('Escape');
      assert.deepEqual(errors, []);
      await ctx.close();
    }
    // iPad portrait stays one column
    const { page, ctx } = await openApp({ width: 768, height: 1024 });
    await sampleGuide(page);
    await idle(page);
    assert.equal(await sideBySide(page), false, 'iPad portrait: one column');
    await ctx.close();
  });
  test('overlays stay on the shrunk picture: the sun, the tip over a tapped section, and taps in Blend', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await page.click('.sftabbtn[data-t="shading"]');
    await page.evaluate(() => __mstest.shadeTo('full'));
    await idle(page);
    await page.evaluate(() => {
      __mstest.shadeSun = { x: 0.5, y: 0.45 };
      __mstest.renderGuide();
    });
    const top0 = await page.evaluate(
      () => document.getElementById('sfView').getBoundingClientRect().top + scrollY,
    );
    for (const d of [0, 40, 84]) {
      await scrollAt(page, Math.round(top0) + d);
      await idle(page);
      const off = await page.evaluate(() => {
        const s = document.getElementById('sfSun').getBoundingClientRect(),
          c = document.getElementById('sfCanvas').getBoundingClientRect();
        return [
          s.left + s.width / 2 - (c.left + 0.5 * c.width),
          s.top + s.height / 2 - (c.top + 0.45 * c.height),
        ];
      });
      assert.ok(Math.hypot(off[0], off[1]) < 1.5, `sun on its point with the picture ${d}px shrunk: ${off}`);
    }
    assert.ok(
      await page.evaluate(
        () =>
          __mstest.picScale < 1 && Math.abs(__mstest.picScale - __mstest.geo.comp / __mstest.geo.full) < 0.01,
      ),
      'measured shrunk',
    );
    // the tip sits by the tapped section, above or below it
    await page.click('#sfShade [data-v="off"]');
    await idle(page);
    await scrollAt(page, Math.round(top0) + 84);
    const ls = await bigSections(page, 8);
    const l = await page.evaluate(
      (ls) =>
        ls.find((l) => {
          const t = __mstest,
            p = t.labelPos(l);
          return p.y / t.H > 0.3 && p.y / t.H < 0.7;
        }),
      ls,
    );
    const p = await sectionPoint(page, l);
    await page.mouse.click(p.x, p.y);
    await page.waitForSelector('.sftip');
    await idle(page);
    // (outside the scaled wrapper: it keeps its size, and stays inside the picture's column)
    const tip = await rect(page, '.sftip'),
      fr = await rect(page, '#sfView');
    assert.ok(
      Math.abs(tip.x + tip.width / 2 - p.x) < 3 || tip.x <= fr.left + 8 || tip.right >= fr.right - 8,
      `centred on the section, or kept inside the picture's frame (${tip.x + tip.width / 2} vs ${p.x})`,
    );
    assert.ok(tip.x >= fr.left && tip.right <= fr.right, 'inside the frame');
    assert.equal(
      await page.evaluate(() => {
        const t = document.querySelector('.sftip');
        return Math.round(t.getBoundingClientRect().height - t.offsetHeight);
      }),
      0,
      'not scaled with the picture',
    );
    assert.ok(tip.bottom <= p.y + 1 || tip.top >= p.y - 1, 'above or below the section, not over it');
    // Blend: a tap on the shrunk picture adds an anchor exactly where it landed
    await page.click('.sftabbtn[data-t="pattern"]');
    await page.click('#sfFam [data-v="blend"]');
    await idle(page);
    await scrollAt(page, Math.round(top0) + 84);
    const n0 = await page.evaluate(() => __mstest.anchors.length);
    const far = await page.evaluate(
      (ls) =>
        ls.find((l) => {
          const t = __mstest,
            c = t.comps[l],
            tol = Math.max(t.W, t.H) * 0.06;
          return t.anchors.every((a) => Math.hypot(a.x - c.cx, a.y - c.cy) > tol);
        }),
      ls,
    );
    const q = await sectionPoint(page, far),
      want = await page.evaluate((l) => __mstest.labelPos(l), far);
    await page.mouse.click(q.x, q.y);
    await idle(page);
    const a = await page.evaluate(() => __mstest.anchors[__mstest.anchors.length - 1]);
    assert.equal(await page.evaluate(() => __mstest.anchors.length), n0 + 1);
    assert.ok(
      Math.hypot(a.x - want.x, a.y - want.y) <= 3,
      `anchor at the tapped point (${a.x},${a.y} vs ${want.x},${want.y})`,
    );
    assert.deepEqual(errors, []);
  });
  test('one-time hints: "tap a section" in full the first time only; helper text is full once, then a one-line ⓘ', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    assert.match(
      await page.textContent('#sfCtl .sfinfo.sfonce'),
      /Tap a section on the picture to change or pin its colour/,
    );
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('ms-seen-hints'))), ['tap']);
    // helper text through the same helper: open the first time, closed (the short line) after a reload; ⓘ toggles it
    await page.evaluate(() => {
      const d = document.createElement('div');
      d.id = 'hintProbe';
      d.innerHTML = __mstest.infoLine('probe', 'Short', 'The long explanation');
      document.getElementById('sfCtl').prepend(d);
    });
    assert.equal(await page.getAttribute('#hintProbe .sfinfo', 'aria-expanded'), 'true');
    assert.equal(await page.textContent('#hintProbe .sfit'), 'The long explanation');
    await page.reload();
    await page.evaluate(() => {
      setMode('sections');
      SF.loadSample();
    });
    await page.waitForFunction(() => !!(window.__mstest && __mstest.assignData));
    await idle(page);
    assert.equal(
      await page.locator('#sfCtl .sfinfo.sfonce').count(),
      0,
      'the tap hint is not shown again (it is in Help)',
    );
    await page.evaluate(() => {
      const d = document.createElement('div');
      d.id = 'hintProbe';
      d.innerHTML = __mstest.infoLine('probe', 'Short', 'The long explanation');
      document.getElementById('sfCtl').prepend(d);
    });
    assert.equal(await page.getAttribute('#hintProbe .sfinfo', 'aria-expanded'), 'false');
    assert.equal(await page.textContent('#hintProbe .sfit'), 'Short');
    await page.click('#hintProbe .sfinfo');
    assert.equal(await page.getAttribute('#hintProbe .sfinfo', 'aria-expanded'), 'true');
    assert.equal(await page.textContent('#hintProbe .sfit'), 'The long explanation');
    assert.deepEqual(errors, []);
  });
  test('full screen, focus mode and Reveal keep their own layouts after the picture has shrunk', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await scrollAt(page, 2000);
    await idle(page);
    const y0 = await page.evaluate(() => scrollY);
    await tapAt(page, '#sfFull');
    await idle(page);
    // (the picture eases to its full-screen size: GitHub's WebKit can still be on its way, run 36933545500, 493 px)
    await until(
      page,
      () => document.getElementById('sfCanvas').getBoundingClientRect().height > 600,
      null,
      'full screen grown',
      15000,
    ).catch(() => {});
    const f = await rect(page, '#sfCanvas');
    assert.ok(f.height > 600, 'full screen is big: ' + f.height);
    assert.equal(
      await page.evaluate(() => getComputedStyle(document.getElementById('sfView')).position),
      'fixed',
    );
    await page.click('#sfFullX');
    await idle(page);
    assert.equal(await page.evaluate(() => scrollY), y0, 'back where the page was');
    // (the picture eases back to its size: GitHub's WebKit can hold that back, run 24, measured at 389 px mid-way)
    const settled = (h, what) =>
      until(
        page,
        (h) => Math.round(document.getElementById('sfCanvas').getBoundingClientRect().height) === h,
        h,
        what,
        15000,
      ).catch(() => {});
    await settled(380, 'the picture back at its pinned floor size');
    assert.equal(await picH(page), 380, 'back to the pinned floor size');
    await page.click('#sfColor');
    await idle(page);
    await page.click('#sfFocus');
    await idle(page);
    const g = await rect(page, '#sfCanvas');
    assert.ok(g.height > 380, 'focus mode fills the screen: ' + g.height);
    assert.equal(
      await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--pinH').trim()),
      '0px',
    );
    await page.keyboard.press('Escape');
    await idle(page);
    await settled(464, 'the picture at its Colour along size');
    assert.equal(await picH(page), 464, 'Colour along again');
    assert.deepEqual(errors, []);
  });
  test('the sample becomes a guide with a name, tabs and a pinned picture that shrinks to its floor as the page scrolls', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    const g = await page.evaluate(() => ({ N: __mstest.assignData.N, name: __mstest.curName }));
    assert.ok(g.N > 50, `${g.N} sections`);
    assert.ok(g.name && g.name.length <= 24, `name "${g.name}"`);
    for (const t of ['pattern', 'shading', 'share', 'colours']) {
      await page.click(`.sftabbtn[data-t="${t}"]`);
      assert.ok(await page.isVisible(`.sftab[data-tab="${t}"]`), `${t} tab shows`);
    }
    // the picture starts at 55% of the screen, shrinks as the page scrolls down to 45% and stays pinned at the top
    const sizes = [],
      tops = [];
    for (const y of [0, 300, 900, 1800, 900, 0]) {
      await page.evaluate((y) => scrollTo(0, y), y);
      await idle(page);
      const r = await page.evaluate(() => {
        const c = document.getElementById('sfCanvas').getBoundingClientRect();
        return [Math.round(c.height), Math.round(c.top)];
      });
      sizes.push(r[0]);
      tops.push(r[1]);
    }
    // (v289: under 55% where the tabs and their first row need the room)
    const full = await page.evaluate(() => __mstest.geo.full);
    assert.ok(
      full > 380 && full <= 464 && sizes[0] === full,
      `full size at the top (at most 55% of 844): ${sizes[0]}`,
    );
    assert.equal(sizes[3], 380, 'floor size once scrolled (45% of 844)');
    assert.deepEqual(
      [sizes[2], sizes[4], sizes[5]],
      [380, 380, full],
      'the same size for the same place, both ways',
    );
    assert.ok(tops[3] >= -1 && tops[3] <= 1, 'picture stays pinned at the top');
    await shot(page, 'guide');
    assert.deepEqual(errors, []);
  });
  // ---- From the third full review (v259) ----
  test('gestures: a drag in Blend pans instead of adding an anchor; right-click never ticks a section', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await page.click('.sftabbtn[data-t="pattern"]');
    await page.click('#sfFam [data-v="blend"]');
    await idle(page);
    await page.click('#sfZin');
    await page.click('#sfZin');
    await idle(page);
    await scrollTop(page);
    const n0 = await page.evaluate(() => __mstest.anchors.length),
      pan0 = await page.evaluate(() => [__mstest.panX, __mstest.panY]);
    const box = await page.locator('#sfView').boundingBox(),
      cx = box.x + box.width / 2,
      cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 90, cy + 40, { steps: 6 });
    await page.mouse.up();
    await idle(page);
    const r = await page.evaluate(() => ({
      n: __mstest.anchors.length,
      pan: [__mstest.panX, __mstest.panY],
    }));
    assert.equal(r.n, n0, 'no anchor added');
    assert.notDeepEqual(r.pan, pan0, 'the picture moved');
    // right-click in colour along
    await page.click('#sfZrst');
    await page.click('.sftabbtn[data-t="colours"]');
    await page.click('#sfColor');
    await idle(page);
    const l = await page.evaluate(() => __mstest.assignData.order[3]);
    await scrollTop(page);
    const p = await sectionPoint(page, l);
    await page.mouse.click(p.x, p.y, { button: 'right' });
    await idle(page);
    assert.equal(await page.evaluate((l) => __mstest.colored[l], l), 0, 'not ticked');
    assert.deepEqual(errors, []);
  });
}

// ---- from guide-header.test.mjs ----
// The guide's header row (Release 3, docs/GUIDE-LAYOUT.md): the name with ✎ over where it is saved, ✨ Surprise and ⋯;
// renaming in place; the ⋯ menu sheet; a header that keeps its height; and large text.
{
  // ---- From Release 3 (docs/GUIDE-LAYOUT.md) ----
  const rect = (page, sel) =>
    page.evaluate((s) => {
      const e = document.querySelector(s);
      return e ? e.getBoundingClientRect().toJSON() : null;
    }, sel);
  const menuLabels = (page) => page.$$eval('#sfSheet .sfmitem', (b) => b.map((x) => x.textContent));
  const head = (page) =>
    page.evaluate(() => {
      const v = (id) => {
        const e = document.getElementById(id);
        return !!(e && e.offsetParent);
      };
      return {
        name: document.getElementById('sfGTitle')?.textContent,
        status: document.getElementById('sfSaveSt').textContent,
        save: v('sfSave'),
        surprise: v('sfSurprise'),
        more: v('sfMore'),
      };
    });
  // ---- From the third full review (v259) ----
  const savedId = (page) => page.evaluate(() => state.saved.find((s) => s.type === 'guide').id);
  // ---- From the fourth review (v263 guide screen) ----
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
  test('header row: name ✎ over where it is saved, ✨ Surprise in Plan only, and ⋯; Plan has no Reset progress', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    let h = await head(page);
    assert.equal(h.name, await page.evaluate(() => __mstest.curName));
    assert.deepEqual(
      [h.status, h.save, h.surprise, h.more],
      ['Sample · change anything to keep it', false, true, true],
      'Plan: the sample, not in the Library yet (no Save: v285)',
    );
    // Reset progress is only in Colour along's ⋯ menu (see the menu's test below), never a button in Plan
    assert.equal(
      await page.evaluate(() =>
        [...document.querySelectorAll('#sfRoot button')].some((b) => /Reset progress/.test(b.textContent)),
      ),
      false,
      'no Reset progress in Plan',
    );
    const hr = await rect(page, '#sfHead'),
      cv = await rect(page, '#sfCanvas');
    assert.ok(hr.bottom <= cv.top + 1, 'the header row sits above the picture');
    // Colour along: no Surprise
    await page.click('#sfColor');
    await idle(page);
    h = await head(page);
    assert.deepEqual([h.surprise, h.save, h.more], [false, false, true], 'Colour along');
    await page.click('#sfDoneBtn');
    await idle(page);
    // Edit sections: no Surprise, no Save (the guide is built from here)
    await answerAsks(page);
    await page.click('#sfBack2');
    await idle(page);
    h = await head(page);
    assert.deepEqual(
      [h.surprise, h.save, h.status],
      [false, false, 'Sample · change anything to keep it'],
      'Edit sections',
    );
    // (v288: nothing edited, so the bar goes back to the Plan)
    await page.click('#sfToPlan');
    await page.waitForFunction(() => __mstest.assignData && document.getElementById('sfColor'));
    await idle(page);
    // a change: into the Library by itself, and the status says so
    await page.click('.sftabbtn[data-t="pattern"]');
    await page.click('#sfFam [data-v="random"]');
    await idle(page, 2300);
    h = await head(page);
    assert.match(h.status, /^(Saved in your Library|Saves itself from now on) ✓$/);
    assert.equal(h.save, false);
    assert.equal(await page.evaluate(() => state.saved.filter((s) => s.type === 'guide').length), 1);
    assert.deepEqual(errors, []);
  });
  test('a new photo is "New guide" in Edit sections, and goes into the Library by itself once built', async () => {
    const { page, errors } = await openApp();
    await haveSet(page);
    await page.check('#wcSets input[data-i="3"]');
    await page.click('#wcAdd');
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#wcPhoto')]);
    await fc.setFiles(join(ROOT, 'src', 'assets', 'sample-jellyfish.png'));
    await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 60000 });
    await idle(page);
    const h = await head(page);
    assert.deepEqual(
      [h.name, h.status, h.save, h.surprise, h.more],
      ['New guide', 'Not saved yet', false, false, true],
    );
    await buildGo(page);
    await page.waitForFunction(() => __mstest.assignData && document.getElementById('sfColor'));
    await idle(page);
    assert.notEqual((await head(page)).name, 'New guide', 'a name once built');
    // (v285: built, it goes into the Library by itself, with no Save to press)
    await page.waitForFunction(() => state.saved.some((s) => s.type === 'guide'));
    await idle(page);
    assert.equal((await head(page)).save, false);
    assert.match((await head(page)).status, /^(Saved in your Library|Saves itself from now on) ✓$/);
    assert.deepEqual(errors, []);
  });
  test('renaming in place: ✎ opens the field with ⚄ inside it; Enter keeps the name, Escape leaves it as it was', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    const name0 = await page.textContent('#sfGTitle');
    await page.click('#sfRename');
    assert.ok(await page.isVisible('.sfrename #sfGName'));
    assert.ok(await page.isVisible('.sfrename #sfNameRoll'), '⚄ inside the field');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'sfGName');
    await page.fill('#sfGName', 'Sea Glass');
    await page.keyboard.press('Escape');
    await idle(page);
    assert.equal(await page.textContent('#sfGTitle'), name0, 'Escape cancels');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'sfRename', 'focus back on ✎');
    assert.equal(
      await page.evaluate(() => document.getElementById('sfRoot').classList.contains('sffull')),
      false,
      'Escape did nothing else',
    );
    await page.click('#sfRename');
    await page.fill('#sfGName', 'Sea Glass');
    await page.keyboard.press('Enter');
    await idle(page);
    assert.equal(await page.textContent('#sfGTitle'), 'Sea Glass');
    assert.equal(await page.evaluate(() => __mstest.curName), 'Sea Glass');
    // ⚄ suggests another name without leaving the field
    await page.click('#sfRename');
    await page.click('#sfNameRoll');
    await idle(page);
    const sug = await page.inputValue('#sfGName');
    assert.ok(sug && sug !== 'Sea Glass', 'a new suggestion: ' + sug);
    assert.ok(await page.isVisible('#sfGName'), 'still renaming');
    await page.keyboard.press('Enter');
    await idle(page);
    assert.equal(await page.textContent('#sfGTitle'), sug);
    // leaving the field keeps what was typed
    await page.click('#sfRename');
    await page.fill('#sfGName', 'Left By Blur');
    await page.click('.sftabbtn[data-t="share"]');
    await idle(page);
    assert.equal(await page.textContent('#sfGTitle'), 'Left By Blur');
    assert.deepEqual(errors, []);
  });
  test('⋯ opens a menu sheet: New, This guide (Save a copy once saved; Reset progress in Colour along), Help', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    assert.equal(await page.locator('#sfRoot [aria-label="More"]').count(), 1, 'the only ⋯ on the screen');
    await openMenu(page);
    assert.equal(await page.textContent('#sfSheetT'), await page.textContent('#sfGTitle'));
    // (v308: the Help group has no heading of its own, which keeps the menu within a phone's room; it is named for screen
    // readers)
    assert.deepEqual(await page.$$eval('#sfSheet .sfmh', (h) => h.map((x) => x.textContent)), ['New']);
    assert.equal(await page.locator('#sfSheet .sfmenu[aria-label="Help"]').count(), 1, 'the Help group');
    // (v308: Send feedback under Help)
    assert.deepEqual(await menuLabels(page), [
      'Choose a photo',
      'Open a PDF',
      'Try the sample',
      'Open from Library',
      'Import a guide',
      'Help',
      'Send feedback',
    ]);
    await page.keyboard.press('Escape');
    await idle(page);
    assert.equal(await page.locator('#sfSheet').count(), 0, 'Escape closes it');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'sfMore', 'focus back on ⋯');
    await saveGuide(page);
    await openMenu(page);
    assert.deepEqual(await menuLabels(page), [
      'Choose a photo',
      'Open a PDF',
      'Try the sample',
      'Open from Library',
      'Import a guide',
      'Save a copy',
      'Help',
      'Send feedback',
    ]);
    await page.click('#sfSheet [data-m="close"]');
    await idle(page);
    assert.equal(await page.locator('#sfSheet').count(), 0, 'Close closes it');
    await page.click('#sfColor');
    await idle(page);
    await openMenu(page);
    assert.deepEqual(await menuLabels(page), [
      'Choose a photo',
      'Open a PDF',
      'Try the sample',
      'Open from Library',
      'Import a guide',
      'Reset progress',
      'Help',
      'Send feedback',
    ]);
    await page.keyboard.press('Escape');
    // the items do what they say
    await menuItem(page, 'Open from Library');
    await idle(page);
    assert.ok(
      await page.evaluate(() => document.getElementById('savedOverlay').classList.contains('on')),
      'Library',
    );
    await page.evaluate(() => document.getElementById('savedOverlay').classList.remove('on'));
    let [fc] = await Promise.all([page.waitForEvent('filechooser'), menuItem(page, 'Choose a photo')]);
    assert.equal(await fc.element().getAttribute('accept'), 'image/*', 'Choose a photo');
    [fc] = await Promise.all([page.waitForEvent('filechooser'), menuItem(page, 'Import a guide')]);
    assert.match(await fc.element().getAttribute('accept'), /json/, 'Import a guide');
    await menuItem(page, 'Help');
    await idle(page);
    assert.ok(
      await page.evaluate(() => document.getElementById('helpOverlay').classList.contains('on')),
      'Help',
    );
    await page.keyboard.press('Escape');
    await idle(page);
    await menuItem(page, 'Try the sample');
    await page.waitForFunction(() => __mstest.assignData && __mstest.curId == null, null, { timeout: 15000 });
    assert.deepEqual(errors, []);
  });
  test('renaming a guide is kept when you open another guide and come back', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await saveGuide(page);
    const a = await savedId(page);
    await page.evaluate(() => SF.loadSample());
    await page.waitForFunction(() => __mstest.assignData && !__mstest.curId, null, { timeout: 10000 });
    await idle(page);
    await saveGuide(page);
    const b = await page.evaluate(() => __mstest.curId);
    await page.evaluate((a) => SF.openDesign(a), a);
    await page.waitForFunction((a) => __mstest.curId === a, a);
    await idle(page);
    await rename(page, 'My renamed guide');
    await page.evaluate((b) => SF.openDesign(b), b);
    await page.waitForFunction((b) => __mstest.curId === b, b);
    await idle(page);
    await page.evaluate((a) => SF.openDesign(a), a);
    await page.waitForFunction((a) => __mstest.curId === a, a);
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.curName), 'My renamed guide');
    assert.deepEqual(errors, []);
  });
  test('the header keeps its height: Surprise, renaming and saving move nothing under it', async () => {
    for (const sc of [1, 1.6]) {
      const { page, errors, ctx } = await openAtScale(sc, { width: 390, height: 844 });
      await sampleGuide(page);
      await idle(page);
      const hh = async () => Math.round((await rect(page, '#sfHead')).height * 10) / 10,
        h0 = await hh();
      await page.click('#sfSurprise');
      await idle(page);
      assert.equal(await hh(), h0, `@${sc}: after Surprise`);
      assert.equal(await page.locator('.sfsnote').count(), 0, 'no note line over the picture');
      assert.match(
        await page.textContent('#msToast'),
        /Surprise: .+ · .+ markers/,
        'what it chose is in its toast (with Undo)',
      );
      await page.click('#sfSurprise');
      await idle(page);
      assert.equal(await hh(), h0);
      await page.click('#sfRename');
      await idle(page);
      assert.equal(await hh(), h0, `@${sc}: renaming`);
      assert.equal(
        await page.evaluate(() => document.getElementById('sfSurprise').classList.contains('sfic')),
        true,
        '✨ alone while renaming',
      );
      await page.keyboard.press('Escape');
      await saveGuide(page);
      assert.match(await page.textContent('#sfSaveSt'), /Saved in your Library|Saves itself from now on/);
      assert.equal(await hh(), h0, `@${sc}: saved`);
      assert.deepEqual(errors, []);
      await ctx.close();
    }
  });
  test('large text: ✨ Surprise goes to ✨ before the name gets under 140px, and the status line is never cut', async () => {
    for (const [w, sc] of [
      [375, 1.6],
      [360, 1.6],
      [390, 1.3],
    ]) {
      const { page, errors, ctx } = await openAtScale(sc, { width: w, height: 800 });
      await sampleGuide(page);
      await idle(page);
      const r = await page.evaluate(() => {
        const st = document.getElementById('sfSaveSt');
        return {
          ic: document.getElementById('sfSurprise').classList.contains('sfic'),
          name: document.querySelector('.sfgname').getBoundingClientRect().width,
          cut: st.scrollWidth > st.clientWidth + 1,
          label: document.getElementById('sfSurprise').getAttribute('aria-label'),
        };
      });
      assert.ok(r.name >= 140, `${w}@${sc}: name ${r.name}px`);
      assert.equal(r.cut, false, 'status not cut');
      assert.match(r.label, /^Surprise/);
      assert.deepEqual(errors, []);
      await ctx.close();
    }
  });
  test('renaming: ✎ closes the section tip; Escape cancels; ⋯ straight after typing shows the new name', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    const [l] = await bigSections(page, 1),
      n0 = await guideName(page);
    await scrollTop(page);
    await tapSection(page, l);
    assert.equal(await page.locator('.sftip').count(), 1);
    await page.click('#sfRename');
    assert.equal(await page.locator('.sftip').count(), 0, 'the tip closed');
    await page.fill('#sfGName', 'Not this');
    await page.keyboard.press('Escape');
    await idle(page);
    assert.equal(await guideName(page), n0, 'Escape left the name as it was');
    // type a name and go straight to ⋯
    await page.click('#sfRename');
    await page.fill('#sfGName', 'Tide Pool');
    await page.click('#sfMore');
    await page.waitForSelector('#sfSheet');
    await idle(page);
    assert.equal(await page.textContent('#sfSheetT'), 'Tide Pool', 'the menu has the new name');
    await page.keyboard.press('Escape');
    assert.equal(await guideName(page), 'Tide Pool');
    assert.deepEqual(errors, []);
  });
  test('iPad portrait: the ⋯ menu is as tall as its items', async () => {
    const { page, errors } = await openApp({ width: 768, height: 1024 });
    await sampleGuide(page);
    await idle(page);
    await page.click('#sfMore');
    await page.waitForSelector('#sfSheet');
    await idle(page);
    // (waiting for the sheet to arrive rather than for its slide to end: GitHub's WebKit can leave it part-way a while)
    await until(
      page,
      () => Math.abs(document.getElementById('sfSheet').getBoundingClientRect().bottom - 1024) <= 1,
      null,
      'the sheet at the bottom',
      15000,
    ).catch(() => {});
    const s = await rect(page, '#sfSheet'),
      items = await page.evaluate(() => {
        const b = document.querySelector('#sfSheet .sfshbody');
        return b.scrollHeight - b.clientHeight;
      });
    assert.ok(Math.abs(s.bottom - 1024) <= 1, 'at the bottom');
    assert.ok(items <= 1 && s.height < 520, `sized to its content (${s.height}px)`);
    assert.deepEqual(errors, []);
  });
}
