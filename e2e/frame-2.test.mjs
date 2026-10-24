// The guide’s frame and layout: the picture’s sizes, text size, the header, phones and iPads.
// (v320) Tests organised by feature: each block below came from the file named above it, its tests unchanged.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ROOT,
  WK,
  buildGo,
  haveSet,
  idle,
  letterGuide,
  longPress,
  menuItem,
  notOnWebKit,
  openApp,
  openAtScale,
  openMenu,
  sampleGuide,
  saveGuide,
  scrollTop,
  sectionPoint,
  setup,
  teardown,
  welcome,
} from './helpers.mjs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

before(setup);
after(teardown);

// ---- from large-text-frame.test.mjs ----
// v318 review: with larger text on a phone the Plan's pinned picture shrinks to a lower floor (45% of the screen at the
// usual size, about 40% at 1.3×, 36% at 1.6×), so the tabs' panel keeps several rows of its larger controls; the usual
// size, an iPad and Colour along are as they were.
{
  const pinned = (page) =>
    page.evaluate(
      () =>
        new Promise((res) => {
          scrollTo(0, 600);
          requestAnimationFrame(() =>
            requestAnimationFrame(() => {
              // (v320: the pinned picture's frame, the page and the paper's gutter round it on an iPad)
              const pic = document.getElementById('sfPic').getBoundingClientRect(),
                tabs = document.querySelector('.sftabs').getBoundingClientRect(),
                bar = [...document.querySelectorAll('.sfbar')]
                  .find((b) => b.getClientRects().length)
                  .getBoundingClientRect();
              res({ pic: pic.height / innerHeight, panel: bar.top - tabs.bottom });
            }),
          );
        }),
    );
  for (const [scale, w, h, lo, hi] of [
    [1, 390, 844, 0.44, 0.46],
    [1.3, 390, 844, 0.38, 0.41],
    [1.6, 390, 844, 0.34, 0.37],
    [1.6, 820, 1180, 0.49, 0.51],
  ]) {
    test(
      `${w}×${h} at ${scale}× text: the Plan's picture pinned at ${Math.round(lo * 100)}–${Math.round(hi * 100)}% of the screen`,
      notOnWebKit(WK.font),
      async () => {
        const { page, errors } = await openAtScale(scale, { width: w, height: h });
        await sampleGuide(page);
        await idle(page);
        const r = await pinned(page);
        assert.ok(r.pic >= lo && r.pic <= hi, `the picture: ${(r.pic * 100).toFixed(1)}%`);
        // (314px before, at either size)
        if (scale > 1 && w < 700) assert.ok(r.panel >= 340, `the panel: ${Math.round(r.panel)}px`);
        // Colour along keeps its own size
        await page.click('#sfColor');
        await idle(page);
        const a = await page.evaluate(
          () => document.getElementById('sfCanvas').getBoundingClientRect().height / innerHeight,
        );
        assert.ok(a >= 0.44, `Colour along: ${(a * 100).toFixed(1)}%`);
        assert.deepEqual(errors, []);
      },
    );
  }
}

// ---- from text-size.test.mjs ----
// Text size follows the phone's text-size setting (src/css/01-base.css). The browser's default font size stands in
// for the phone setting here (it sets the same root size that <meta name="text-scale"> and iOS Dynamic Type do):
// at the default everything keeps its designed pixel size, apart from the raised 12px minimum; bigger settings grow
// the text (controls up to 1.3x, reading text up to 1.6x) without sideways scrolling or text cut off at the edge.
{
  const MIN = 12;
  const openAt = openAtScale;
  const px = (page, sel) => page.$eval(sel, (e) => parseFloat(getComputedStyle(e).fontSize));
  // every visible piece of text on the page: its font size and where it sits (SVG drawings are skipped)
  const texts = (page) =>
    page.evaluate(() => {
      const out = [],
        w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) {
        const el = n.parentElement;
        if (!n.nodeValue.trim() || !el || el.closest('svg,script,style,option,noscript')) continue;
        if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
        const r = el.getBoundingClientRect();
        if (r.width <= 1 || r.height <= 1) continue; // visually hidden (screen-reader only)
        // the text's own box, cut to its nearest clipping ancestor; `cut` = that ancestor hides part of it without an
        // ellipsis (scrolling boxes don't count: the rest is a scroll away)
        const rg = document.createRange();
        rg.selectNodeContents(n);
        const t = rg.getBoundingClientRect();
        let left = t.left,
          right = t.right,
          cut = false,
          ell = false,
          first = true;
        // (past the nearest clipping ancestor, only sideways scrollers further up count: v288's In this guide strip, whose
        // tiles clip their own codes and scroll sideways together)
        for (let a = el; a && a !== document.body; a = a.parentElement) {
          const cs = getComputedStyle(a);
          if (first && cs.textOverflow === 'ellipsis') ell = true;
          const clipX = /hidden|clip/.test(cs.overflowX),
            clipY = /hidden|clip/.test(cs.overflowY);
          const b = a.getBoundingClientRect();
          const scrollX = /auto|scroll/.test(cs.overflowX);
          if (!first) {
            if (scrollX) {
              left = Math.max(left, b.left);
              right = Math.min(right, b.right);
              break;
            }
            continue;
          }
          if (!clipX && !clipY && !scrollX) continue;
          if (clipX || scrollX) {
            left = Math.max(left, b.left);
            right = Math.min(right, b.right);
          }
          if (
            !ell &&
            ((clipX && (t.right > b.right + 1 || t.left < b.left - 1)) ||
              (clipY && (t.bottom > b.bottom + 1 || t.top < b.top - 1)))
          )
            cut = true;
          if (scrollX) break;
          first = false;
        }
        out.push({
          text: n.nodeValue.trim().slice(0, 40),
          cls:
            el.tagName +
            (el.id ? '#' + el.id : '') +
            (el.className && typeof el.className === 'string'
              ? '.' + el.className.trim().split(/\s+/).join('.')
              : ''),
          size: parseFloat(getComputedStyle(el).fontSize),
          left,
          right,
          cut,
        });
      }
      return out;
    });
  async function checkScreen(page, name, { edges = true } = {}) {
    const t = await texts(page);
    assert.ok(t.length > 3, `${name}: found text`);
    const small = t.filter((x) => x.size < MIN - 0.01);
    assert.deepEqual(small, [], `${name}: text below ${MIN}px`);
    const { sw, cw } = await page.evaluate(() => ({
      sw: document.documentElement.scrollWidth,
      cw: document.documentElement.clientWidth,
    }));
    assert.ok(sw <= cw, `${name}: no sideways scroll (${sw} > ${cw})`);
    if (edges) {
      const vw = await page.evaluate(() => innerWidth);
      const off = t.filter((x) => x.right > x.left && (x.right > vw + 1 || x.left < -1)); // (text scrolled out of a scroller is skipped)
      assert.deepEqual(off, [], `${name}: text runs off the screen`);
      assert.deepEqual(
        t.filter((x) => x.cut),
        [],
        `${name}: text cut off by its box`,
      );
    }
  }
  // Change colour's picker on the biggest section: checked like any screen, and no code of five characters or fewer
  // ends in an ellipsis (checkScreen accepts an ellipsis as meant; here it isn't)
  async function pickerCodes(page) {
    const l = await page.evaluate(() => {
      const t = __mstest;
      return t.assignData.order.slice().sort((a, b) => t.comps[b].area - t.comps[a].area)[0];
    });
    await page.evaluate(
      () =>
        new Promise((r) => {
          scrollTo(0, 0);
          requestAnimationFrame(() => requestAnimationFrame(r));
        }),
    );
    const p = await sectionPoint(page, l);
    await page.mouse.click(p.x, p.y);
    await idle(page);
    await page.click('.sftip [data-a="change"]');
    await page.waitForSelector('#sfSheet.sfpicksh');
    await idle(page);
    await checkScreen(page, 'guide: the marker picker');
    const cut = await page.$$eval('#sfPopSw .sfswt', (ts) =>
      ts
        .filter((t) => t.textContent.length <= 5 && t.offsetParent)
        .filter((t) => {
          const r = document.createRange();
          r.selectNodeContents(t);
          return r.getBoundingClientRect().width > t.clientWidth + 0.5;
        })
        .map((t) => t.textContent),
    );
    assert.deepEqual(cut, [], 'marker codes cut short in the picker');
    await page.click('#sfPopCancel');
    await idle(page);
  }
  // the main screens and sheets, each checked where it's shown
  async function walkScreens(page) {
    await checkScreen(page, 'welcome');
    await sampleGuide(page);
    await idle(page);
    await checkScreen(page, 'guide: Colours');
    // the marker picker: its codes are never cut short with an ellipsis (up to five characters)
    await pickerCodes(page);
    // Shading with shading on and its suggestions opened, Share, and the Print sheet
    await page.click('.sftabbtn[data-t="shading"]');
    await page.evaluate(() => __mstest.shadeTo('full'));
    await idle(page);
    if (await page.isVisible('#sfShNoteT')) await page.click('#sfShNoteT');
    await page.evaluate(() => document.getElementById('msToast')?.classList.remove('on'));
    await checkScreen(page, 'guide: Shading');
    await page.click('#sfShade [data-v="off"]');
    await idle(page);
    await page.click('.sftabbtn[data-t="share"]');
    await idle(page);
    await checkScreen(page, 'guide: Share');
    await page.click('#sfPrint');
    await idle(page);
    await checkScreen(page, 'guide: the Print sheet');
    await page.keyboard.press('Escape');
    await idle(page);
    await saveGuide(page);
    await idle(page);
    await page.evaluate(() => document.getElementById('msToast')?.classList.remove('on'));
    await page.click('.sftabbtn[data-t="pattern"]');
    await idle(page);
    await checkScreen(page, 'guide: Pattern');
    await page.click('#sfFam [data-v="manual"]');
    await idle(page);
    await page.click('#sfPaint');
    await idle(page);
    await checkScreen(page, 'guide: Manual with Paint on');
    await page.click('#sfPaint');
    await idle(page);
    await page.click('.sftabbtn[data-t="colours"]');
    await page.click('#sfColor');
    await idle(page);
    await checkScreen(page, 'guide: Colour along');
    await openMenu(page);
    await idle(page);
    await checkScreen(page, 'guide: the ⋯ menu');
    await page.keyboard.press('Escape');
    await idle(page);
    await page.click('#sfFocus');
    await idle(page);
    await checkScreen(page, 'Focus mode');
    await page.keyboard.press('Escape');
    await idle(page);
    await menuItem(page, 'Help');
    await idle(page);
    await checkScreen(page, 'Help');
    await page.click('#helpHiw');
    await idle(page);
    await checkScreen(page, 'How it works');
    await page.click('#hiwClose');
    await idle(page);
    await page.keyboard.press('Escape');
    await idle(page);
    await page.evaluate(() => document.getElementById('mHome').click());
    await idle(page);
    await checkScreen(page, 'Home');
    await page.click('#homeLibCard');
    await idle(page);
    await checkScreen(page, 'Library');
    await page.evaluate(() => {
      for (const o of document.querySelectorAll('.on[id$="Overlay"]')) o.classList.remove('on');
    });
    await page.click('#mCollection');
    await idle(page);
    await checkScreen(page, 'Markers');
    await page.locator('#results .cell').first().scrollIntoViewIfNeeded();
    const b = await page.locator('#results .cell').first().boundingBox();
    await longPress(page, b.x + b.width / 2, b.y + b.height / 2);
    await idle(page);
    assert.ok(await page.isVisible('#mkOverlay'));
    await checkScreen(page, 'marker details');
    await page.evaluate(() => {
      for (const o of document.querySelectorAll('.on[id$="Overlay"]')) o.classList.remove('on');
      scrollTo(0, 0);
    });
    await page.click('#swatchBtn');
    await page.waitForSelector('#swOverlay.on');
    await idle(page);
    await checkScreen(page, 'swatch chart');
    await page.click('#swClose');
    await idle(page);
    await page.click('#mPalette');
    await idle(page);
    await checkScreen(page, 'Palette');
  }
  // ---- From the fifth review (guide screen) ----
  const SHOTS = process.env.SHOTS || '';
  const shot = (page, name) => (SHOTS ? page.screenshot({ path: SHOTS + '/' + name + '.png' }) : null);
  const rect = (page, sel) =>
    page.evaluate((s) => {
      const e = document.querySelector(s);
      return e ? e.getBoundingClientRect().toJSON() : null;
    }, sel);
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
  test('at the default text size the app keeps its designed pixel sizes, with nothing under 12px', async () => {
    const { page, errors } = await openAt(1);
    await sampleGuide(page);
    await idle(page);
    assert.equal(await px(page, 'html'), 16);
    assert.equal(await px(page, 'body'), 16);
    assert.equal(await px(page, '.title'), 19);
    assert.equal(await px(page, '.set'), 12);
    assert.equal(await px(page, '#mHome'), 14);
    assert.equal(await px(page, '.sftabbtn'), 13);
    assert.equal(await px(page, '.sfcolorcta'), 14);
    await saveGuide(page);
    await idle(page);
    assert.equal(await px(page, '#sfSaveSt'), 12, 'save status line: raised from 11px');
    await page.evaluate(() => document.getElementById('mHome').click());
    await idle(page);
    assert.equal(await px(page, '.homesub'), 13);
    assert.equal(await px(page, '.hclabel'), 14);
    assert.equal(await px(page, '.hcsub'), 12, 'Home card line: raised from 11px');
    assert.equal(await px(page, '.homever'), 12, 'version: raised from 11px');
    assert.equal(await px(page, '.sfRecName'), 14);
    await page.click('#mCollection');
    await idle(page);
    assert.equal(await px(page, '.pile-head .lbl'), 16);
    assert.equal(await px(page, '.cell .cc'), 12, 'marker code: raised from 11px');
    assert.equal(await px(page, '.rghead'), 12, 'colour-family heading: raised from 11px');
    // the grid keeps its five columns at 390px wide
    const cols = await page.$$eval('#results .cell', (cs) => {
      const t = cs[0].getBoundingClientRect().top;
      return cs.filter((c) => c.getBoundingClientRect().top === t).length;
    });
    assert.equal(cols, 5);
    assert.deepEqual(errors, []);
  });
  test('at the default text size every screen has no text under 12px and nothing off the edge (390 and 360 wide)', async () => {
    for (const width of [390, 360]) {
      const { page, errors, ctx } = await openAt(1, { width, height: width === 360 ? 740 : 844 });
      await walkScreens(page);
      assert.deepEqual(errors, []);
      await ctx.close();
    }
  });
  test('with a 1.5x text size text grows (controls to 1.3x), with no sideways scroll or text cut off', async () => {
    const { page, errors } = await openAt(1.5);
    assert.equal(await px(page, 'html'), 24);
    await walkScreens(page);
    // reading text grows the full 1.5x, controls and the header stop at 1.3x
    await page.evaluate(() => document.getElementById('mHome').click());
    await idle(page);
    assert.equal(await px(page, '.homesub'), 13 * 1.5);
    assert.ok(Math.abs((await px(page, '.hcsub')) - 12 * 1.3) < 0.05, 'Home cards are buttons: 1.3x');
    assert.ok(Math.abs((await px(page, '#mHome')) - 14 * 1.3) < 0.05, 'tab label capped at 1.3x');
    assert.ok(Math.abs((await px(page, '.title')) - 19 * 1.3) < 0.05, 'header capped at 1.3x');
    // the Home cards become full-width rows rather than squeezing (none left alone on a line: review 5), and hold their text
    const cards = await page.$$eval('.homecard', (cs) =>
      cs.map((c) => {
        const r = c.getBoundingClientRect();
        return { top: Math.round(r.top), w: Math.round(r.width), fits: c.scrollHeight <= c.clientHeight + 1 };
      }),
    );
    assert.equal(new Set(cards.map((c) => c.top)).size, 3);
    assert.equal(new Set(cards.map((c) => c.w)).size, 1);
    assert.ok(
      cards.every((c) => c.fits),
      'nothing spills out of a Home card',
    );
    assert.deepEqual(errors, []);
  });
  test('the largest setting stops at 1.6x, and at 360 wide nothing runs off the screen', async () => {
    const { page, errors } = await openAt(2, { width: 360, height: 740 });
    assert.equal(await px(page, 'html'), 32);
    await walkScreens(page);
    await page.evaluate(() => document.getElementById('mHome').click());
    await idle(page);
    assert.ok(Math.abs((await px(page, '.homesub')) - 13 * 1.6) < 0.05, 'capped at 1.6x');
    assert.deepEqual(errors, []);
  });
  test('with no markers yet, the Home "Set up your markers" card holds its text (360 and 390 wide, default and 1.3x)', async () => {
    for (const [width, scale] of [
      [360, 1],
      [390, 1],
      [360, 1.3],
      [390, 1.3],
    ]) {
      const { page, ctx } = await openAt(scale, { width });
      await page.click('#wcSkip');
      await page.click('#wcLook');
      await idle(page);
      await page.evaluate(() => document.getElementById('mHome').click());
      await idle(page);
      const c = await page.$eval('.homecard.attn', (e) => {
        const r = e.getBoundingClientRect(),
          kids = [...e.children].map((k) => k.getBoundingClientRect());
        return {
          txt: e.querySelector('.hcsub').textContent,
          inside: kids.every(
            (k) => k.top >= r.top && k.bottom <= r.bottom && k.left >= r.left && k.right <= r.right,
          ),
        };
      });
      assert.equal(c.txt, 'Set up your markers');
      assert.ok(c.inside, `card content inside the card at ${width}px, ${scale}x`);
      await ctx.close();
    }
  });
  test('coming back to the app after the text size changed re-runs the layout, as a resize does', async () => {
    const { page, errors } = await openAt(1);
    const fired = await page.evaluate(() => {
      let n = 0;
      addEventListener('resize', () => n++);
      const back = () => document.dispatchEvent(new Event('visibilitychange'));
      back();
      const same = n; // nothing changed: no relayout
      document.documentElement.style.fontSize = '21px';
      back();
      return [same, n];
    });
    assert.deepEqual(fired, [0, 1]);
    assert.deepEqual(errors, []);
  });
  // ---- From the fourth review (outside the guide screen) ----
  test('large text: Match tabs and the You/Marker labels fit; the welcome shows several sets; Random’s buttons look enabled', async () => {
    const { page, errors } = await openAtScale(1.6, { width: 375, height: 667 });
    await page.waitForSelector('#welcome.on');
    await haveSet(page); // (v309: the set list is behind "I have a set")
    assert.ok(
      (await page.evaluate(() => document.getElementById('wcSets').clientHeight)) >= 140,
      'room for several sets',
    );
    await page.click('#wcStep1 .wcback');
    await page.click('#wcSkip');
    await page.click('#wcLook');
    await page.click('#mCollection');
    await page.click('#mkMatchBtn');
    await page.evaluate(() => window.msMatchHex('#3a7bd5'));
    await idle(page);
    const over = await page.evaluate(() =>
      [...document.querySelectorAll('.msrc button')]
        .filter((b) => b.offsetWidth && b.scrollWidth > b.clientWidth + 1)
        .map((b) => b.textContent),
    );
    assert.deepEqual(over, [], 'no tab runs out of its box');
    const clipped = await page.evaluate(() =>
      [...document.querySelectorAll('.mcmp i')]
        .filter((i) => i.scrollWidth > i.parentElement.clientWidth + 1)
        .map((i) => i.textContent),
    );
    assert.deepEqual(clipped, []);
    await page.click('#matchClose');
    await page.click('#mkDrawBtn');
    await page.click('#draw');
    await idle(page);
    assert.equal(
      await page.evaluate(() => getComputedStyle(document.getElementById('undo')).color),
      await page.evaluate(() => getComputedStyle(document.body).color),
      'Remove in the normal text colour',
    );
    assert.deepEqual(errors, []);
  });
  test('the marker picker never cuts a five-character code short, at any text size', async () => {
    for (const [sc, w, h] of [
      [2, 375, 667],
      [1.3, 375, 667],
      [1, 360, 740],
    ]) {
      const { page, errors, ctx } = await openAtScale(sc, { width: w, height: h });
      await sampleGuide(page);
      await idle(page);
      const [l] = await bigSections(page, 1);
      await changeColour(page, l);
      const cut = await page.$$eval('#sfPopSw .sfswt', (ts) =>
        ts
          .filter((t) => t.textContent.length <= 5)
          .filter((t) => {
            const r = document.createRange();
            r.selectNodeContents(t);
            return r.getBoundingClientRect().width > t.clientWidth + 0.5;
          })
          .map((t) => t.textContent),
      );
      assert.deepEqual(cut, [], `@${sc} ${w}px: codes cut short`);
      if (sc === 2) {
        await page.fill('#sfPopFilter', 'YR1');
        await idle(page);
        await shot(page, 'g1-4-after');
      }
      assert.deepEqual(errors, []);
      await ctx.close();
    }
  });
  test('Share: ✨ Reveal & share and Save image are each one line at every text size, stacked when they need to be', async () => {
    for (const [sc, w, h] of [
      [1, 375, 667],
      [1.3, 375, 667],
      [2, 375, 667],
      [2, 360, 740],
    ]) {
      const { page, errors, ctx } = await openAtScale(sc, { width: w, height: h });
      await sampleGuide(page);
      await idle(page);
      await page.click('.sftabbtn[data-t="share"]');
      await idle(page);
      await page.$eval('#sfReveal', (e) => e.scrollIntoView({ block: 'center' }));
      await idle(page);
      for (const id of ['sfReveal', 'sfExport', 'sfPlan', 'sfAsPal']) {
        // (the words' lines: an icon before them sits a little lower in the same line)
        const one = await page.$eval('#' + id, (b) => {
          const lines = new Set();
          b.childNodes.forEach((n) => {
            if (n.nodeType !== 3 || !n.textContent.trim()) return;
            const rg = document.createRange();
            rg.selectNodeContents(n);
            [...rg.getClientRects()].forEach((q) => lines.add(Math.round(q.top)));
          });
          return lines.size;
        });
        assert.equal(one, 1, `@${sc} ${w}px: #${id} is on one line`);
      }
      const a = await rect(page, '#sfReveal'),
        b = await rect(page, '#sfExport');
      if (Math.abs(a.top - b.top) < 1)
        assert.ok(Math.abs(a.height - b.height) < 1, 'side by side, the same height');
      else assert.ok(Math.abs(a.width - b.width) < 1 && b.top > a.bottom, 'stacked, both full width');
      if (sc === 1) assert.ok(Math.abs(a.top - b.top) < 1, 'side by side at the default size');
      if (sc !== 1 && w === 375) await shot(page, 'g1-13-' + sc);
      assert.deepEqual(errors, []);
      await ctx.close();
    }
  });
}

// ---- from v285-review.test.mjs ----
// v285's pre-release review: narrow landscape phones keep the whole controls column; an automatic first save leaves a
// name being typed alone; Put back while the Library's delete is still waiting keeps the guide's stored copy; Home's
// Continue card follows a rename and isn't redrawn while Home is hidden; the marker sets' caret stays an icon.
{
  test('narrow landscape phones (640–667 wide): side by side with the whole controls column on screen', async () => {
    for (const [w, h] of [
      [667, 375],
      [640, 360],
    ]) {
      const { page, errors, ctx } = await openApp({ width: w, height: h });
      await sampleGuide(page);
      await idle(page);
      const g = await page.evaluate(() => {
        const c = document.getElementById('sfCtl').getBoundingClientRect(),
          v = document.getElementById('sfCanvas').getBoundingClientRect(),
          b = document.querySelector('#sfWork>.sfbar').getBoundingClientRect();
        return {
          side: __mstest.geo.side,
          ctlR: c.right,
          ctlW: c.width,
          picR: v.right,
          ctlL: c.left,
          barR: b.right,
          vw: innerWidth,
        };
      });
      assert.equal(g.side, true, `${w}×${h}: side by side`);
      assert.ok(g.ctlR <= g.vw - 8, `${w}×${h}: the controls end on screen (${g.ctlR} of ${g.vw})`);
      assert.ok(g.barR <= g.vw, `${w}×${h}: the bar too (${g.barR})`);
      assert.ok(g.ctlW >= 300, `${w}×${h}: controls ${g.ctlW}px`);
      assert.ok(g.picR <= g.ctlL, 'the picture left of them');
      assert.deepEqual(errors, []);
      await ctx.close();
    }
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
  test('a very wide picture keeps its shape on a phone', async () => {
    const { page, errors } = await openApp({ width: 390, height: 844 });
    await welcome(page, 'look');
    await idle(page);
    const b64 = await page.evaluate(() => {
      const c = document.createElement('canvas');
      c.width = 3200;
      c.height = 800;
      const g = c.getContext('2d');
      g.fillStyle = '#fff';
      g.fillRect(0, 0, 3200, 800);
      g.strokeStyle = '#000';
      g.lineWidth = 14;
      for (let i = 0; i < 8; i++) {
        g.beginPath();
        g.arc(200 + i * 400, 400, 300, 0, Math.PI * 2);
        g.stroke();
      }
      g.strokeRect(7, 7, 3186, 786);
      return c.toDataURL('image/png').split(',')[1];
    });
    await pickPhoto(page, Buffer.from(b64, 'base64'), 'wide.png');
    await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 60000 });
    await idle(page);
    await buildGo(page);
    await page.waitForFunction(() => __mstest.assignData && __mstest.sfmode === 'guide', null, {
      timeout: 60000,
    });
    await idle(page);
    const r = await page.evaluate(() => {
      const c = document.getElementById('sfCanvas').getBoundingClientRect();
      return c.width / c.height;
    });
    assert.ok(Math.abs(r - 4) < 0.15, 'drawn 4:1, as it is (' + r + ')');
    assert.deepEqual(errors, []);
  });
  test('320×568 with large text: the tool row ends above the bar at the top of the page', async () => {
    for (const scale of [1.5, 2]) {
      const { page, errors, ctx } = await openAtScale(scale, { width: 320, height: 568 });
      await sampleGuide(page);
      await idle(page);
      await scrollTop(page);
      await idle(page);
      const g = await page.evaluate(() => ({
        tools: document.getElementById('sfZoomCtl').getBoundingClientRect().bottom,
        bar: document.querySelector('#sfWork>.sfbar').getBoundingClientRect().top,
      }));
      assert.ok(g.tools <= g.bar + 0.5, `×${scale}: tools end at ${g.tools}, bar at ${g.bar}`);
      assert.deepEqual(errors, []);
      await ctx.close();
    }
  });
}

// ---- from v288.test.mjs ----
// v288: the tool row's one-time names on a phone (the tip queue: one line at a time, after the first-time hints);
// Random's words without "pool"; Reset progress with one verb.
{
  const seen = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('ms-seen-hints') || '[]'));
  test('phone: once the first-time hints are seen, a one-time line names Codes, Greyscale and Full screen; not beside the sample’s line; ✕ closes it', async () => {
    const { page, errors } = await openApp({ storage: { 'ms-seen-hints': '["tap","along"]' } });
    await sampleGuide(page);
    assert.equal(await page.isVisible('#sfSampleNote'), true);
    assert.equal(await page.locator('#sfToolTip').count(), 0, 'one line at a time: the sample’s first');
    await letterGuide(page);
    assert.equal(await page.isVisible('#sfToolTip'), true);
    assert.equal(
      (await page.textContent('#sfToolTip > span')).trim(),
      'Under the picture: Codes shows the marker codes, Greyscale the picture in greys, and Full screen fills the screen.',
    );
    assert.ok((await seen(page)).includes('tools'));
    // it stays through the visit (other tabs and back), then ✕ closes it
    await page.click('#sfTab-pattern');
    await page.click('#sfTab-colours');
    await idle(page);
    assert.equal(await page.isVisible('#sfToolTip'), true);
    await page.click('#sfToolTipX');
    await idle(page);
    assert.equal(await page.locator('#sfToolTip').count(), 0);
    assert.equal(
      await page.evaluate(() => document.activeElement && document.activeElement.id),
      'sfTab-colours',
    );
    await page.click('#sfTab-pattern');
    await page.click('#sfTab-colours');
    await idle(page);
    assert.equal(await page.locator('#sfToolTip').count(), 0, 'closed stays closed');
    assert.deepEqual(errors, []);
  });
  test('a guide’s first visit says "Tap a section" first; and where the row has its words (iPad) there’s no tool line', async () => {
    {
      const { page, errors } = await openApp();
      await sampleGuide(page);
      await letterGuide(page);
      assert.equal(await page.locator('#sfToolTip').count(), 0, 'waits for a later visit');
      assert.ok(!(await seen(page)).includes('tools'));
      assert.deepEqual(errors, []);
    }
    {
      const { page, errors } = await openApp({
        width: 834,
        height: 1194,
        storage: { 'ms-seen-hints': '["tap","along"]' },
      });
      await sampleGuide(page);
      await letterGuide(page);
      assert.equal(await page.locator('#sfToolTip').count(), 0);
      assert.equal(await page.isVisible('#sfCodes .sfzw'), true, 'the words are on the row');
      assert.deepEqual(errors, []);
    }
  });
  test('Random says what is left to draw, and a drawn marker is put back (no "pool")', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await page.click('#mPalette');
    await page.evaluate(() => {
      state.mode = 'random';
      save();
      fullRender();
    });
    await idle(page);
    await page.click('#draw');
    await idle(page);
    const st = await page.textContent('#status');
    assert.match(st, /^1 drawn, \d+ left to draw$/);
    assert.match(await page.getAttribute('#pile .cell', 'aria-label'), /, put it back$/);
    // (the word, not a marker's name: Ohuhu B111 Pool Blue, when it's the one drawn, failed this on GitHub, v318.6; every
    // marker whose name has it is taken out first, so one added later can't fail it either)
    const text = await page.evaluate(() =>
      COLORS.reduce(
        (t, c) => (/pool/i.test(c.name || '') ? t.split(c.name).join('') : t),
        document.body.innerText,
      ),
    );
    assert.doesNotMatch(text, /pool/i);
    assert.deepEqual(errors, []);
  });
  test('Home’s New colouring guide: the first time, the Guide screen’s card; with guides made, the picker straight from Home, which stays until a photo is chosen', async () => {
    const { page, errors } = await openApp();
    await welcome(page, 'look');
    await page.click('#mHome');
    await idle(page);
    let opened = false;
    page.on('filechooser', () => {
      opened = true;
    });
    await page.click('#homeNew');
    await idle(page);
    assert.equal(opened, false, 'first time: no picker');
    assert.equal(await page.isVisible('#sfStart'), true, 'the card');
    // a guide made: the picker opens from Home
    await letterGuide(page);
    await page.waitForFunction(() => state.saved.some((s) => s.type === 'guide'));
    await page.click('#mHome');
    await idle(page);
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#homeNew')]);
    await idle(page);
    assert.equal(await page.isVisible('#homeView'), true, 'Home stays while the picker is open');
    const buf = await readFile(join(ROOT, 'e2e', 'fixtures', 'letter-page.png'));
    await fc.setFiles({ name: 'two.png', mimeType: 'image/png', buffer: buf });
    await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 60000 });
    assert.equal(await page.isVisible('#homeView'), false, 'then the Guide screen, reading the photo');
    assert.deepEqual(errors, []);
  });
  test('a saved palette chosen for the next guide shows under Home’s New colouring guide, and ✕ there stops using it', async () => {
    const { page, errors } = await openApp();
    await welcome(page, 'look');
    await page.click('#mPalette');
    await page.click('#draw');
    await idle(page);
    await page.click('#useInGuide');
    // (v308: held for the next guide as it is, not saved to the Library first)
    await page.waitForFunction(() => state.mode === 'sections');
    await page.click('#mHome');
    await idle(page);
    assert.match(await page.textContent('#homePalNote'), /^Using “.+”\d+ markers · for your next new guide$/);
    await page.click('#homePalNote [data-clearpal]');
    await idle(page);
    assert.equal((await page.textContent('#homePalNote')).trim(), '');
    assert.equal(await page.evaluate(() => __mstest.styleVars.paletteSource), 'owned');
    assert.deepEqual(errors, []);
  });
  test('the markers on this page: a list lightest first with a Done to close it by touch; a row lights up its sections', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    assert.match(await page.textContent('#sfMkList'), /^16 markers on this page/);
    await page.click('#sfMkList');
    await page.waitForSelector('#sfSheet', { state: 'visible' });
    await idle(page);
    assert.equal(await page.textContent('#sfSheetT'), '16 markers on this page');
    const rows = await page.$$eval('#sfSheet button.sfmlrow', (b) => b.map((x) => x.dataset.k));
    assert.equal(rows.length, 16);
    await page.click('#sfSheet button.sfmlrow');
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.hlKey), rows[0], 'its sections lit up');
    await page.click('#sfSheet [data-ml="done"]');
    await idle(page);
    assert.equal(await page.isVisible('#sfSheet'), false, 'Done closes it');
    assert.equal(await page.evaluate(() => __mstest.hlKey), null, 'and the plan shows as before');
    assert.deepEqual(errors, []);
  });
  test('Focus mode by keyboard: Tab goes through the top bar, Greyscale, −, + (and Fit when zoomed) and the bottom bar, in that order', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await page.click('#sfColor');
    await idle(page);
    await page.focus('#sfFocus');
    await page.keyboard.press('Enter');
    await idle(page);
    const seen = [];
    for (let i = 0; i < 14; i++) {
      await page.keyboard.press('Tab');
      seen.push(await page.evaluate(() => document.activeElement.id || document.activeElement.className));
    }
    for (const id of ['sfVals', 'sfZout', 'sfZin', 'sfFDone'])
      assert.ok(seen.includes(id), id + ' reached: ' + seen.join(' '));
    assert.ok(
      seen.indexOf('sfVals') < seen.indexOf('sfZin') && seen.indexOf('sfZin') < seen.indexOf('sfFDone'),
      'in order: ' + seen.join(' '),
    );
    assert.deepEqual(errors, []);
  });
}

// ---- from v293.test.mjs ----
// v293: zoomed in, the codes are drawn on a sharper canvas of their own over the picture (they were blurry, magnified
// from the picture's own pixels); it lines up with the picture, follows pan and zoom, and goes when zoomed out, in Edit
// sections and in focus mode.
{
  const hi = (page) =>
    page.evaluate(() => {
      const h = document.getElementById('sfLabHi'),
        c = document.getElementById('sfCanvas');
      if (!h || h.style.display === 'none') return null;
      const a = h.getBoundingClientRect(),
        b = c.getBoundingClientRect();
      return {
        w: h.width,
        cw: c.width,
        dx: a.left - b.left,
        dy: a.top - b.top,
        dw: a.width - b.width,
        dh: a.height - b.height,
      };
    });
  test('zoomed in, the codes are on a sharper canvas over the picture, lined up with it; gone zoomed out, in Edit sections and in focus mode', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    assert.equal(await hi(page), null, 'not at 1×');
    await page.click('#sfZin');
    await page.click('#sfZin');
    await idle(page);
    await page.waitForFunction(() => {
      const h = document.getElementById('sfLabHi');
      return h && h.style.display !== 'none' && h.width > 0;
    });
    const a = await hi(page);
    assert.ok(a.w > a.cw * 1.5, `more pixels than the picture's (${a.w} vs ${a.cw})`);
    for (const k of ['dx', 'dy', 'dw', 'dh']) assert.ok(Math.abs(a[k]) <= 1.5, `lined up: ${k} ${a[k]}`);
    // panned: still lined up
    const v = await page.locator('#sfView').boundingBox();
    await page.mouse.move(v.x + v.width / 2, v.y + 150);
    await page.mouse.down();
    await page.mouse.move(v.x + v.width / 2 - 60, v.y + 90, { steps: 4 });
    await page.mouse.up();
    await idle(page);
    const b = await hi(page);
    for (const k of ['dx', 'dy', 'dw', 'dh'])
      assert.ok(Math.abs(b[k]) <= 1.5, `lined up after a pan: ${k} ${b[k]}`);
    // zoomed out: gone
    await page.click('#sfZout');
    await page.click('#sfZout');
    await idle(page);
    await page.waitForFunction(() => {
      const h = document.getElementById('sfLabHi');
      return !h || h.style.display === 'none';
    });
    // Edit sections and focus mode: none
    await page.click('#sfZin');
    await page.click('#sfZin');
    await idle(page);
    await page.click('#sfBack2');
    await idle(page);
    assert.equal(await hi(page), null, 'not over Edit sections');
    await page.click('#sfToPlan');
    await idle(page);
    await page.click('#sfColor');
    await idle(page);
    await page.click('#sfFocus');
    await idle(page);
    assert.equal(await hi(page), null, 'not in focus mode');
    assert.deepEqual(errors, []);
  });
}
