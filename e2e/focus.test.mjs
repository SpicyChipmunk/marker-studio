// Focus mode.
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
  idle,
  letterGuide,
  notOnWebKit,
  openApp,
  openAtScale,
  sampleGuide,
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

// ---- from focus-mode.test.mjs ----
// Focus mode: one section at a time, light -> dark, tick off and move on; its zoom chips and keyboard focus, and
// leaving it back to Colour along.
{
  const state = (page) =>
    page.evaluate(() => {
      const t = __mstest,
        l = t.focusOrd[t.focusPos];
      return {
        pos: t.focusPos,
        l,
        mk: t.hlKey,
        zoom: t.zoom,
        fin: t.focusFin,
        done: [...t.colored].reduce((a, b) => a + b, 0),
      };
    });
  // is the current section centred in the space between the two bars (on a phone, above the tool strip, v289)? (v284: or as near as the picture allows: off
  // centre only where the picture's edge is at the edge of that space, so there's no blank beside it)
  async function centred(page) {
    const s = await state(page),
      p = await sectionPoint(page, s.l);
    const g = await page.evaluate(() => {
      const c = document.getElementById('sfCanvas').getBoundingClientRect(),
        de = document.documentElement;
      // (on the side rail the picture has the screen's height beside it; measured from its own left edge)
      if (de.classList.contains('sfrailon')) {
        const rw = document.querySelector('.sffocbar').offsetWidth,
          x0 = de.classList.contains('sfrailL') ? rw : 0;
        return {
          w: innerWidth - rw,
          top: 0,
          bot: innerHeight,
          c: { l: c.left - x0, r: c.right - x0, t: c.top, b: c.bottom },
          x0,
        };
      }
      return {
        w: innerWidth,
        top: document.querySelector('.sffocbar').offsetHeight,
        bot:
          innerHeight -
          document.querySelector('.sffocbot').offsetHeight -
          (innerWidth < 700 ? document.getElementById('sfZoomCtl').offsetHeight : 0),
        c: { l: c.left, r: c.right, t: c.top, b: c.bottom },
        x0: 0,
      };
    });
    p.x -= g.x0;
    // (or all the picture fits that way, and it's in the middle)
    const fitX = g.c.r - g.c.l <= g.w + 1 && Math.abs((g.c.l + g.c.r) / 2 - g.w / 2) < 2,
      fitY = g.c.b - g.c.t <= g.bot - g.top + 1 && Math.abs((g.c.t + g.c.b) / 2 - (g.top + g.bot) / 2) < 2;
    const inX =
      fitX ||
      Math.abs(p.x - g.w / 2) < 40 ||
      (g.c.l <= 1 && p.x < g.w / 2) ||
      (g.c.r >= g.w - 1 && p.x > g.w / 2);
    const inY =
      fitY ||
      Math.abs(p.y - (g.top + g.bot) / 2) < 40 ||
      (g.c.t <= g.top + 1 && p.y < (g.top + g.bot) / 2) ||
      (g.c.b >= g.bot - 1 && p.y > (g.top + g.bot) / 2);
    return inX && inY && p.x > 0 && p.x < g.w && p.y > g.top && p.y < g.bot;
  }
  async function enterFocus(page) {
    await page.click('#sfColor');
    await page.click('#sfFocus');
    await idle(page);
  }
  // ---- From the fourth review (v263 guide screen) ----
  const active = (page) =>
    page.evaluate(() => {
      const a = document.activeElement;
      return a ? a.id || a.className || a.tagName : null;
    });
  test('walks every section once, one marker at a time, light to dark', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await enterFocus(page);
    const o = await page.evaluate(() => {
      const t = __mstest,
        keys = t.focusOrd.map((l) => t.assignData.assign[l].mkey),
        runs = [];
      keys.forEach((k) => {
        if (runs[runs.length - 1] !== k) runs.push(k);
      });
      const hex = (k) => t.assignData.assign[t.focusOrd[keys.indexOf(k)]].hex;
      const lum = (h) => {
        const n = parseInt(h.slice(1), 16);
        return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
      };
      return {
        n: t.focusOrd.length,
        uniq: new Set(t.focusOrd).size,
        N: t.assignData.N,
        runs: runs.length,
        markers: new Set(keys).size,
        lums: runs.map((k) => lum(hex(k))),
      };
    });
    assert.equal(o.n, o.N);
    assert.equal(o.uniq, o.N);
    assert.equal(o.runs, o.markers, 'each marker is one run');
    for (let i = 1; i < o.lums.length; i++)
      assert.ok(o.lums[i] <= o.lums[i - 1] + 1e-9, 'lighter markers first');
    assert.ok(await centred(page), 'first section is centred');
    await shot(page, 'focus-start');
    assert.deepEqual(errors, []);
  });
  test('Done ticks one section and moves on; tapping another section only selects it', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await enterFocus(page);
    const s0 = await state(page);
    await page.click('#sfFDone');
    await idle(page);
    const s1 = await state(page);
    assert.equal(s1.done, 1);
    assert.equal(s1.pos, 1);
    // the same marker next while it has sections left (the gradient shares markers out by area, so a big section can
    // have a marker to itself: then it's the next marker's lightest)
    const n0 = await page.evaluate(
      (k) => __mstest.focusOrd.filter((l) => __mstest.assignData.assign[l].mkey === k).length,
      s0.mk,
    );
    if (n0 > 1) assert.equal(s1.mk, s0.mk, 'same marker next');
    else assert.notEqual(s1.mk, s0.mk, 'the next marker');
    assert.ok(await centred(page), 'next section is centred');
    // tap the outlined section itself -> ticks it
    const p = await sectionPoint(page, s1.l);
    await page.mouse.click(p.x, p.y);
    await idle(page);
    assert.equal((await state(page)).done, 2);
    // tap a section of another colour -> selected, not ticked
    const other = await page.evaluate(() => {
      const t = __mstest,
        c = document.getElementById('sfCanvas'),
        r = c.getBoundingClientRect(),
        top = document.querySelector('.sffocbar').offsetHeight + 20,
        bot = innerHeight - document.querySelector('.sffocbot').offsetHeight - 70;
      for (const l of t.focusOrd) {
        if (t.assignData.assign[l].mkey === t.hlKey || t.colored[l]) continue;
        const q = t.labelPos(l),
          x = r.left + (q.x / c.width) * r.width,
          y = r.top + (q.y / c.height) * r.height;
        if (x > 20 && x < innerWidth - 80 && y > top && y < bot) return l;
      }
      return null;
    });
    assert.ok(other, 'found a visible section of another colour');
    const before = await state(page),
      op = await sectionPoint(page, other);
    await page.mouse.click(op.x, op.y);
    await idle(page);
    const after = await state(page);
    assert.equal(after.done, before.done, 'nothing ticked');
    assert.equal(after.l, other, 'it became the current section');
    // Back returns to where we were
    await page.click('#sfFBack');
    await idle(page);
    assert.equal((await state(page)).pos, before.pos);
    assert.deepEqual(errors, []);
  });
  test('panning is free and the re-centre button brings the section back', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await enterFocus(page);
    // (v284: a picture that fits in view stays in the middle: zoomed in, there's somewhere to pan to)
    await page.click('#sfZin');
    await page.click('#sfZin');
    await idle(page);
    const p0 = await page.evaluate(() => [__mstest.panX, __mstest.panY]);
    await page.mouse.move(200, 430);
    await page.mouse.down();
    await page.mouse.move(210, 438, { steps: 3 });
    await page.mouse.up();
    const p1 = await page.evaluate(() => [__mstest.panX, __mstest.panY]);
    assert.equal(Math.round(p1[0] - p0[0]), 10);
    assert.equal(Math.round(p1[1] - p0[1]), 8);
    await page.click('#sfZrst');
    await idle(page);
    assert.ok(await centred(page));
    assert.deepEqual(errors, []);
  });
  test('colour list jumps and marks a whole marker; finishing shows the whole picture', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await enterFocus(page);
    await page.click('#sfFocCols');
    assert.ok(await page.isVisible('#sfFocSheet'));
    const lastK = await page.evaluate(() => {
      const t = __mstest;
      return t.assignData.assign[t.focusOrd[t.focusOrd.length - 1]].mkey;
    });
    await page.click(`.focmk[data-k="${lastK}"]`);
    await idle(page);
    assert.equal((await state(page)).mk, lastK);
    await page.click('#sfFocCols');
    await page.click('#sfFocAll');
    await idle(page);
    const n = await page.evaluate(
      (k) =>
        __mstest.focusOrd.filter((l) => __mstest.assignData.assign[l].mkey === k && __mstest.colored[l])
          .length,
      lastK,
    );
    const tot = await page.evaluate(
      (k) => __mstest.focusOrd.filter((l) => __mstest.assignData.assign[l].mkey === k).length,
      lastK,
    );
    assert.equal(n, tot, 'whole marker marked');
    for (let i = 0; i < 400 && !(await state(page)).fin; i++)
      await page.evaluate(() => document.getElementById('sfFDone').click());
    await idle(page);
    const s = await state(page);
    assert.ok(s.fin);
    assert.equal(s.zoom, 1);
    assert.match(await page.textContent('#sfFocName'), /Page finished/);
    await shot(page, 'focus-finished');
    const last = s.pos;
    await page.click('#sfFBack');
    await idle(page);
    assert.equal((await state(page)).pos, last, 'Back goes to the last section');
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => __mstest.focus), false);
    assert.deepEqual(errors, []);
  });
  test('landscape keeps the section centred; leaving the screen mid-focus resets cleanly', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await enterFocus(page);
    await page.setViewportSize({ width: 844, height: 390 });
    await idle(page);
    assert.ok(await centred(page), 'centred after rotating');
    // (v323: a phone on its side has the side rail, a compact one: the picture has the screen's whole height beside it)
    const side = await page.evaluate(() => ({
      rail: document.documentElement.classList.contains('sfrailon'),
      short: document.documentElement.classList.contains('sfrailshort'),
      barLeft: Math.round(document.querySelector('.sffocbar').getBoundingClientRect().left),
      doneBottom: Math.round(document.getElementById('sfFDone').getBoundingClientRect().bottom),
    }));
    assert.deepEqual([side.rail, side.short], [true, true], 'the compact side rail');
    assert.ok(side.barLeft >= 844 - 300 - 1, 'the bar at the side: ' + side.barLeft);
    assert.ok(side.doneBottom <= 390, 'Done on the screen: ' + side.doneBottom);
    // (v324) its markers strip, room for it above Done: no heading, never over Done; no map
    const strip = await page.evaluate(() => {
      const st = document.getElementById('sfFocStrip'),
        m = document.getElementById('sfFocMap');
      return {
        shown: !!st && !st.hidden && st.getClientRects().length > 0,
        head: !!st && st.querySelector('.sffshead').getClientRects().length > 0,
        gap: st
          ? document.querySelector('.sffocbot').getBoundingClientRect().top -
            st.getBoundingClientRect().bottom
          : 0,
        cur: st ? st.querySelectorAll('.sffs.cur').length : 0,
        map: !!m && !m.hidden,
      };
    });
    assert.deepEqual(
      [strip.shown, strip.head, strip.cur, strip.map],
      [true, false, 1, false],
      JSON.stringify(strip),
    );
    assert.ok(strip.gap >= 8, 'the strip above Done: ' + strip.gap);
    await page.setViewportSize({ width: 390, height: 844 });
    await idle(page);
    await page.evaluate(() => document.getElementById('mHome').click());
    await page.click('#mSections');
    await idle(page);
    const s = await page.evaluate(() => ({
      focus: __mstest.focus,
      zoom: __mstest.zoom,
      // (v320: sfonpaper, the Plan's paper look, stays: it's the Plan's own)
      cls: document
        .getElementById('sfRoot')
        .className.replace(/\bsfonpaper\b/, '')
        .trim(),
    }));
    assert.deepEqual(s, { focus: false, zoom: 1, cls: '' });
    assert.deepEqual(errors, []);
  });
  // (v324) an iPhone SE on its side, 568 by 320: the compact rail too, everything in it on the screen and apart, and
  // the zoom buttons in the rail alone (a phone's strip rule had laid a dark band across the picture)
  test('a small phone on its side (568×320): the compact rail, nothing overlapping, no band over the picture', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await enterFocus(page);
    await page.setViewportSize({ width: 568, height: 320 });
    await idle(page);
    const g = await page.evaluate(() => {
      const r = (s) => document.querySelector(s).getBoundingClientRect();
      const de = document.documentElement;
      return {
        rail: de.classList.contains('sfrailon') && de.classList.contains('sfrailshort'),
        bar: r('.sffocbar').left,
        prog: r('#sfFocProg').bottom,
        bot: [r('.sffocbot').top, r('.sffocbot').bottom],
        zoom: [r('#sfZoomCtl').left, r('#sfZoomCtl').top, r('#sfZoomCtl').bottom],
      };
    });
    assert.ok(g.rail, 'the compact side rail');
    assert.ok(g.bar >= 568 - 300 - 1, 'the bar at the side: ' + g.bar);
    assert.ok(g.prog <= g.bot[0], `the progress bar above Done: ${g.prog} / ${g.bot[0]}`);
    assert.ok(g.bot[1] <= g.zoom[1], `Back and Skip above the zoom buttons: ${g.bot[1]} / ${g.zoom[1]}`);
    assert.ok(g.zoom[2] <= 320, 'the zoom buttons on the screen');
    assert.ok(g.zoom[0] >= 568 - 300, 'the zoom buttons in the rail, not across the picture: ' + g.zoom[0]);
    // (no room for the markers strip above Done here: it stays away)
    assert.equal(
      await page.evaluate(() => {
        const st = document.getElementById('sfFocStrip');
        return !!st && !st.hidden;
      }),
      false,
      'no strip',
    );
    assert.ok(await centred(page), 'the section centred beside the rail');
    assert.deepEqual(errors, []);
  });
  test('focus mode: solid zoom chips; focus moves in, Tab stays in, the page behind is inert, and focus returns to ⛶ Focus mode', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await page.click('#sfColor');
    await idle(page);
    await page.focus('#sfFocus');
    await page.keyboard.press('Enter');
    await idle(page);
    assert.equal(await active(page), 'sfFDone', 'focus on ✓ Done');
    const bg = await page.evaluate(() => getComputedStyle(document.getElementById('sfZin')).backgroundColor);
    const alpha = +(bg.match(/rgba?\(([^)]+)\)/)[1].split(',')[3] ?? 1);
    assert.ok(alpha >= 0.9, 'a solid chip: ' + bg);
    assert.equal(
      await page.evaluate(
        () => document.getElementById('sfHead').inert && document.querySelector('.modes').inert,
      ),
      true,
      'the page behind is inert',
    );
    for (let i = 0; i < 14; i++) {
      await page.keyboard.press(i % 5 === 4 ? 'Shift+Tab' : 'Tab');
      assert.ok(
        await page.evaluate(
          () => !!document.activeElement.closest('.sffocbar,#sfFocSheet,#sfZoomCtl,#sfFocBot'),
        ),
        'Tab stays in focus mode: ' + (await active(page)),
      );
    }
    // Done keeps focus on the bottom buttons as they are redrawn
    await page.focus('#sfFDone');
    await page.keyboard.press('Enter');
    await idle(page);
    assert.equal(await active(page), 'sfFDone');
    await page.keyboard.press('Escape');
    await idle(page);
    assert.equal(await active(page), 'sfFocus', 'back on ⛶ Focus mode');
    assert.equal(
      await page.evaluate(() => document.querySelectorAll('[inert]').length),
      0,
      'nothing left inert',
    );
    assert.deepEqual(errors, []);
  });
  // ---- From the fifth review (guide screen) ----
  test('leaving focus mode keeps the marker row that was open', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await page.click('#sfColor');
    await idle(page);
    const k = await page.$eval('#sfAlist .sfarow:nth-child(2)', (r) => r.dataset.k);
    await page.click(`#sfAlist .sfarow[data-k="${k}"] .sfah`);
    await idle(page);
    await page.click('#sfFocus');
    await idle(page);
    await page.click('#sfFSkip');
    await idle(page);
    await page.click('#sfFSkip');
    await idle(page);
    await page.click('#sfExitFoc');
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.hlKey), k);
    assert.equal(await page.$eval('#sfAlist .sfarow.open', (r) => r.dataset.k), k, 'the row is still open');
    // with no row open, none opens
    await page.click(`#sfAlist .sfarow[data-k="${k}"] .sfah`);
    await idle(page);
    await page.click('#sfFocus');
    await idle(page);
    await page.keyboard.press('Escape');
    await idle(page);
    assert.equal(await page.locator('#sfAlist .sfarow.open').count(), 0);
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
  test('Focus mode: ticks stamp when colouring started; leaving opens the marker it was on', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await saveGuide(page);
    await page.click('#sfColor');
    await idle(page);
    await page.click('#sfFocus');
    await idle(page);
    await page.click('#sfFDone');
    await idle(page);
    assert.ok(await page.evaluate(() => __mstest.progAt.s > 0), 'start date stamped in Focus mode');
    const l = await page.evaluate(() => __mstest.focusOrd[__mstest.focusPos]);
    const k = await page.evaluate((l) => __mstest.assignData.assign[l].mkey, l);
    await page.click('#sfExitFoc');
    await idle(page);
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.hlKey), k, 'the row of the marker Focus mode was on');
    const r = await page.evaluate(() => {
      const o = document.querySelector('.sfarow.open');
      return o ? o.getBoundingClientRect().top : -1;
    });
    assert.ok(r > 0 && r < (await page.evaluate(() => innerHeight)), 'on screen');
    assert.deepEqual(errors, []);
  });
}

// ---- from v289.test.mjs ----
// v289: fixes from the fresh-eyes review of v288 — ← Plan › Discard of edits brought back by Resume, a palette held for
// the next guide and a photo that won't open, section edits beyond Undo, Use in a guide › Recolour from Colour along,
// Change colour after an iPad turns, a backup restored over a guide deleted while open, Generate keeping the keyboard,
// Edit sections' tools on a phone's first screen, the guide saved at once on leaving it, focus after Change colour.
{
  // v289 decisions
  // (v323) the zoom buttons float at the picture's right edge, one above another, over the picture (as on an iPad
  // upright), rather than in a strip of their own: the picture has that room
  test('Focus mode on a phone: Greyscale, zoom and Fit float in a column at the picture’s edge, solid, above the bottom bar', async () => {
    for (const [w, h] of [
      [390, 844],
      [320, 568],
    ]) {
      const { page, errors, ctx } = await openApp({ width: w, height: h });
      await sampleGuide(page);
      await idle(page);
      await page.click('#sfColor');
      await idle(page);
      await page.click('#sfFocus');
      await idle(page);
      const g = await page.evaluate(() => {
        const r = (s) => document.querySelector(s).getBoundingClientRect().toJSON(),
          bs = [...document.querySelectorAll('#sfZoomCtl .sfz')]
            .filter((b) => b.offsetWidth)
            .map((b) => b.getBoundingClientRect());
        return {
          z: r('#sfZoomCtl'),
          b: r('#sfFocBot'),
          col: bs.every((q, i) => !i || (Math.abs(q.left - bs[0].left) < 1 && q.top > bs[i - 1].top)),
          n: bs.length,
          chip: getComputedStyle(document.getElementById('sfZin')).backgroundColor,
        };
      });
      assert.ok(g.n >= 3 && g.col, `${w}×${h}: one above another`);
      assert.ok(g.z.right <= w - 8 && g.z.right >= w - 16, `${w}×${h}: at the right edge (${g.z.right})`);
      assert.ok(g.z.bottom <= g.b.top - 6, `${w}×${h}: above the bottom bar`);
      const alpha = +(g.chip.match(/rgba?\(([^)]+)\)/)[1].split(',')[3] ?? 1);
      assert.ok(alpha >= 0.9, 'solid chips: ' + g.chip);
      // the picture runs down to the bottom bar beside them
      const below = await page.evaluate(
        (y) => document.elementFromPoint(8, y) === document.getElementById('sfCanvas'),
        g.b.top - 3,
      );
      for (let i = 0; i < 8 && (await page.evaluate(() => __mstest.zoom)) > 1.001 && !below; i++) {
        await page.click('#sfZin');
        await idle(page);
      }
      assert.ok(
        await page.evaluate(
          (y) => document.elementFromPoint(8, y) === document.getElementById('sfCanvas'),
          g.b.top - 3,
        ),
        `${w}×${h}: the picture down to the bottom bar`,
      );
      assert.deepEqual(errors, []);
      await ctx.close();
    }
  });
}

// ---- from v298.test.mjs ----
// v298: fixes from the second fresh-eyes review of v297 — ticks follow merged and split sections; Focus mode says
// where it is up to; zones keep touching sections apart across their borders; a guide file with odd keys opens; the
// sets list follows Clear collection; and Scan's box: the same text again is still cleared, Enter then the same cap
// again is read, letters composed by an Android keyboard wait for Enter, and a card isn't repeated while held.
{
  test('Focus mode says each section as it comes, and that the page is finished', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await page.click('#sfColor');
    await page.click('#sfFocus');
    await idle(page);
    const live = () =>
      page.evaluate(
        () => new Promise((r) => setTimeout(() => r(document.getElementById('sfLive').textContent), 120)),
      );
    const name = await page.textContent('#sfFocName');
    let s = await live();
    assert.ok(s.startsWith(name + '. Section 1 of '), s);
    await page.click('#sfFDone');
    await idle(page);
    s = await live();
    assert.match(s, /\. Section \d+ of \d+/);
    assert.ok(s.startsWith(await page.textContent('#sfFocName')));
    assert.deepEqual(errors, []);
  });
}

// ---- from v313-focus.test.mjs ----
// v313 (Focus mode): D2, the hand-off card between one marker and the next, and each marker starting on its largest
// section (D11). The card says how the last marker went (all coloured, or how many of them) and which to pick up, with
// the picture zoomed out to the new one's sections; Done, a tap anywhere (which ticks nothing) or Escape closes it and
// goes in to the first section. Each test fails on v312.
{
  const st = (page) =>
    page.evaluate(() => {
      const t = __mstest,
        l = t.focusOrd[t.focusPos];
      return {
        pos: t.focusPos,
        l,
        mk: l != null ? t.assignData.assign[l].mkey : null,
        zoom: t.zoom,
        done: [...t.colored].reduce((a, b) => a + b, 0),
        hand: !document.getElementById('sfHand').hidden,
      };
    });
  async function enterFocus(page) {
    await page.click('#sfColor');
    await idle(page);
    await page.click('#sfFocus');
    await idle(page);
  }
  // Done until the card shows (or n presses)
  async function doneToCard(page, n = 60) {
    for (let i = 0; i < n; i++) {
      await page.click('#sfFDone');
      await idle(page);
      if ((await st(page)).hand) return true;
    }
    return false;
  }
  const card = (page) =>
    page.evaluate(() => {
      const e = document.getElementById('sfHand');
      return {
        head: e.querySelector('.sfhhead').textContent,
        lbl: e.querySelector('.sfhlbl').textContent,
        name: e.querySelector('.sfhname').textContent,
        sub: e.querySelector('.sfhsub').textContent,
      };
    });
  test('each marker starts on its largest section; finishing one shows the hand-off card, zoomed out to the next one’s sections; a tap on the picture closes it and ticks nothing', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await enterFocus(page);
    // the first section is the first marker's largest
    const big = await page.evaluate(() => {
      const t = __mstest,
        l = t.focusOrd[t.focusPos],
        k = t.assignData.assign[l].mkey,
        secs = t.assignData.order.filter((q) => t.assignData.assign[q].mkey === k);
      return {
        l,
        max: secs.reduce((a, b) => (t.comps[b].area > t.comps[a].area ? b : a)),
        k,
        n: secs.length,
      };
    });
    assert.equal(big.l, big.max, 'the largest section first');
    const first = (await st(page)).mk;
    assert.ok(await doneToCard(page), 'the card');
    const s1 = await st(page);
    assert.notEqual(s1.mk, first, 'on the next marker');
    const c = await card(page);
    assert.match(c.head, new RegExp(first.split('|')[1] + ' · all ' + big.n + ' coloured'));
    assert.equal(c.lbl, 'Pick up');
    assert.match(c.name, new RegExp(s1.mk.split('|')[1]));
    assert.match(c.sub, /sections?, shown on the picture\. Tap Done when it’s in your hand\./);
    // zoomed out (no further in than its first section's own zoom)
    const zIn = await page.evaluate(() => __mstest.focusZoomFor(__mstest.focusOrd[__mstest.focusPos]));
    assert.ok(s1.zoom <= zIn + 1e-6, `zoomed out: ${s1.zoom} ≤ ${zIn}`);
    // a tap on the picture: closes it, ticks nothing
    const box = await page.locator('#sfCanvas').boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await idle(page);
    const s2 = await st(page);
    assert.equal(s2.hand, false, 'closed');
    assert.equal(s2.done, s1.done, 'nothing ticked');
    assert.equal(s2.pos, s1.pos, 'still on the same section');
    assert.ok(Math.abs(s2.zoom - zIn) < 1e-6, 'in to its section');
    assert.deepEqual(errors, []);
  });
  test('a marker with sections skipped: the card says how many were coloured; Done closes it without a tick; Escape closes it too', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await enterFocus(page);
    const first = (await st(page)).mk;
    const n = await page.evaluate(
      (k) => __mstest.assignData.order.filter((q) => __mstest.assignData.assign[q].mkey === k).length,
      first,
    );
    assert.ok(n >= 2);
    await page.click('#sfFSkip');
    await idle(page);
    assert.equal((await st(page)).hand, false, 'no card between one marker’s sections');
    assert.ok(await doneToCard(page), 'the card');
    assert.match((await card(page)).head, new RegExp(': ' + (n - 1) + ' of ' + n + ' coloured'));
    const s1 = await st(page);
    await page.click('#sfFDone');
    await idle(page);
    const s2 = await st(page);
    assert.equal(s2.hand, false);
    assert.equal(s2.done, s1.done, 'Done closed it, no tick');
    // the next marker change, and Escape
    assert.ok(await doneToCard(page), 'the next card');
    await page.keyboard.press('Escape');
    await idle(page);
    const s3 = await st(page);
    assert.equal(s3.hand, false);
    assert.ok(await page.evaluate(() => __mstest.focus), 'still in Focus mode');
    assert.deepEqual(errors, []);
  });
}
