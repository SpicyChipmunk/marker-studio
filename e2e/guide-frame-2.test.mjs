// The guide screen's frame (Release 3, docs/GUIDE-LAYOUT.md): the picture's sizes and its scroll-linked shrink, tabs
// that never move anything, where a change of stage lands, drag to scroll and gestures, side by side, one-time hints,
// overlays that stay on the scaled picture, and full screen, focus mode and Reveal after the picture has shrunk.
// (v296: the second half of guide-frame.test.mjs, split off because on GitHub's WebKit the one file came near node's
// 12-minute limit for a file)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, sampleGuide, sectionPoint, idle, openMenu, shot, scrollTop, ENGINE, notOnWebKit, WK, until, letterGuide, answerAsks } from './helpers.mjs';

before(setup);
after(teardown);

const picH = (page) => page.evaluate(() => Math.round(document.getElementById('sfCanvas').getBoundingClientRect().height));
const rect = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return e ? e.getBoundingClientRect().toJSON() : null; }, sel);
// scroll the page and let the shrink (a requestAnimationFrame after the scroll) catch up
const scrollAt = (page, y) => page.evaluate((y) => new Promise((r) => { window.scrollTo(0, y); requestAnimationFrame(() => requestAnimationFrame(() => r(window.scrollY))); }), y);
const overlaps = (a, b) => a.x < b.x + b.width - 0.5 && b.x < a.x + a.width - 0.5 && a.y < b.y + b.height - 0.5 && b.y < a.y + a.height - 0.5;
const touchAction = (page) => page.evaluate(() => getComputedStyle(document.getElementById('sfPicBox')).touchAction);
// where the tabs pin: the scroll position at which they reach their sticky top
const tabsPinAt = (page) => page.evaluate(() => { const t = document.querySelector('.sftabs'), s = document.querySelector('.sftabsen'), cs = getComputedStyle(t); return Math.round(scrollY + s.getBoundingClientRect().top + parseFloat(cs.marginTop) - parseFloat(cs.top)); });
// a real tap where the element is on screen (Playwright's own click would first scroll it into view, which the
// sticky tabs don't need)
async function tapAt(page, sel) { const r = await rect(page, sel); await page.mouse.click(r.x + r.width / 2, r.y + r.height / 2); }
const barGap = (page) => page.evaluate(() => innerHeight - document.querySelector('.sfbar').getBoundingClientRect().bottom);
async function sideBySide(page) { return page.evaluate(() => document.getElementById('sfWork').classList.contains('sfside')); }
// big sections whose label points are inside the picture, biggest first
const bigSections = (page, n = 6) => page.evaluate((n) => { const t = __mstest; return t.assignData.order.slice().sort((a, b) => t.comps[b].area - t.comps[a].area).slice(0, n); }, n);


const pinH = (page) => page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--pinH')));

test('coming back to the Guide tab measures the picture again: pinned tabs, pane heights, Colour along', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  const pin0 = await pinH(page), pane0 = await page.evaluate(() => getComputedStyle(document.getElementById('sfWork')).getPropertyValue('--tabMin'));
  assert.equal(pin0, 420);
  await scrollAt(page, 400);
  await page.click('#mHome'); await idle(page); await page.click('#mSections'); await idle(page);
  assert.equal(await pinH(page), pin0, '--pinH is back');
  assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('sfWork')).getPropertyValue('--tabMin')), pane0, 'the tabs keep their min-height');
  const th = await page.evaluate(() => { const t = document.querySelector('.sftabs'), s = document.querySelector('.sftabsen'); return Math.round(scrollY + s.getBoundingClientRect().top + parseFloat(getComputedStyle(t).marginTop) - pin0Top()); function pin0Top() { return parseFloat(getComputedStyle(t).top); } });
  await scrollAt(page, th + 200);
  assert.ok(Math.abs((await rect(page, '.sftabs')).top - pin0) <= 1, 'the tabs pin under the picture, not under the app header');
  // Colour along: its fixed picture and the list's scroll padding
  await page.click('#sfColor'); await idle(page);
  await page.click('#mHome'); await idle(page); await page.click('#mSections'); await idle(page);
  assert.equal(await pinH(page), 464 + 40, 'Colour along: the fixed picture plus the tool row');
  assert.match(await page.evaluate(() => getComputedStyle(document.documentElement).scrollPaddingTop), /^5\d\dpx$/);
  assert.deepEqual(errors, []);
});

test('a change of stage starts at its top: the header at the top when it fits, else the first row under the pinned block', async () => {
  for (const [w, h] of [[390, 844], [375, 667]]) {
    const { page, errors, ctx } = await openApp({ width: w, height: h });
    await sampleGuide(page); await idle(page); await scrollTop(page);
    // from the top of the page, a real tap: the list shows
    await tapAt(page, '#sfColor'); await idle(page);
    const bar = await rect(page, '#sfWork>.sfbar'), tools = await rect(page, '#sfZoomCtl'), row = await rect(page, '#sfAlist .sfarow'), hd = await rect(page, '#sfHead');
    assert.ok(Math.abs(hd.top) <= 1, `${w}×${h}: the header at the top (${hd.top})`);
    assert.ok(row.top >= tools.bottom - 0.5 && row.bottom <= bar.top + 0.5, `${w}×${h}: the first row shows (${row.top}–${row.bottom}, bar ${bar.top})`);
    // ← Plan from far down the list: Plan opens at its top, with its tabs
    await scrollAt(page, 5000); await tapAt(page, '#sfDoneBtn'); await idle(page);
    const t = await rect(page, '.sftabs');
    assert.ok(Math.abs((await rect(page, '#sfHead')).top) <= 1 && t.bottom <= (await rect(page, '#sfWork>.sfbar')).top, 'Plan: header and tabs on the screen');
    // from a tab scrolled far down: Colour along starts with its first rows, not under the pinned block
    await page.click('.sftabbtn[data-t="colours"]'); await scrollAt(page, 5000); await tapAt(page, '#sfColor'); await idle(page);
    const info = await rect(page, '#sfCtl .sfinfo'), pb = (await rect(page, '#sfZoomCtl')).bottom;
    assert.ok(info.top >= pb - 0.5, 'the instructions are under the pinned block');
    await tapAt(page, '#sfDoneBtn'); await idle(page);
    // Build guide from the bottom of Edit sections: the header shows, not the middle of the Colours tab
    await answerAsks(page);
    await page.click('#sfBack2'); await idle(page);
    // (v288: with nothing edited the bar goes back to the Plan; an edit brings Build again)
    await page.evaluate(() => { const t = __mstest, l = t.assignData.order[3]; t.secState[l] = 2; t.guideDirty = true; t.render(); }); await idle(page);
    await scrollAt(page, 5000);
    await tapAt(page, '#sfBuild'); await page.waitForSelector('#sfColor'); await idle(page);
    assert.ok(Math.abs((await rect(page, '#sfHead')).top) <= 1, 'Build guide lands on the header');
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});

test('the one-time "tap a section" hint is under the tabs, which start above the bar on first view', async () => {
  const { page, errors } = await openApp({ width: 390, height: 844 });
  await sampleGuide(page); await idle(page); await scrollTop(page);
  const hint = await rect(page, '.sfinfo.sfonce'), tabs = await rect(page, '.sftabs'), bar = await rect(page, '#sfWork>.sfbar');
  assert.ok(hint.top >= tabs.bottom, 'hint below the tabs');
  assert.ok(tabs.bottom <= bar.top + 0.5, `tab labels above the bar (${tabs.bottom} vs ${bar.top})`);
  assert.deepEqual(errors, []);
});

test('side by side: the picture is pinned whole on opening and on a change of stage; the bar is flush, edge to edge', async () => {
  const { page, errors } = await openApp({ width: 844, height: 390 });
  await sampleGuide(page); await idle(page);
  const whole = async (what) => { const c = await rect(page, '#sfCanvas'); assert.ok(c.top >= -0.5 && c.bottom <= 390.5, `${what}: picture ${c.top}–${c.bottom}`); };
  await whole('opened');
  await page.click('#sfColor'); await idle(page); await whole('Colour along');
  await scrollAt(page, 300);
  const bar = await rect(page, '#sfWork>.sfbar'), ctl = await rect(page, '#sfCtl'), pic = await rect(page, '#sfView');
  assert.ok(Math.abs(bar.bottom - 390) <= 0.5, 'flush with the bottom');
  assert.ok(bar.left <= ctl.left - 10 && bar.left >= pic.right - 0.5, 'its background reaches from the picture column');
  assert.equal(await page.evaluate(([x, y]) => !!document.elementFromPoint(x, y).closest('.sfbar'), [ctl.left + 2, 385]), true, 'nothing of the list shows beside it');
  await page.click('#sfDoneBtn'); await idle(page); await whole('Plan again');
  assert.deepEqual(errors, []);
});

test('Blend: the picture scrolls the page by drag, except a drag that starts on an anchor dot', notOnWebKit(WK.touch), async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  await page.click('.sftabbtn[data-t="pattern"]'); await page.click('#sfFam [data-v="blend"]'); await idle(page); await scrollTop(page);
  assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('sfPicBox')).touchAction), 'pan-y');
  const r = await page.evaluate(() => {
    const c = document.getElementById('sfCanvas'), b = c.getBoundingClientRect(), a = __mstest.anchors[0], at = (x, y) => { const t = new Touch({ identifier: 1, target: c, clientX: x, clientY: y }), e = new TouchEvent('touchstart', { touches: [t], targetTouches: [t], changedTouches: [t], cancelable: true, bubbles: true }); c.dispatchEvent(e); return e.defaultPrevented; };
    return { dot: at(b.left + a.x / c.width * b.width, b.top + a.y / c.height * b.height), off: at(b.left + 4, b.bottom - 4) };
  });
  assert.deepEqual(r, { dot: true, off: false });
  assert.deepEqual(errors, []);
});

// ---- From the fifth review (guide screen) ----
const frames = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

test('zoomed in, a change of the picture\'s size (turning, resizing, another stage) leaves no blank strip', async () => {
  const { page, errors } = await openApp({ width: 390, height: 844 });
  await sampleGuide(page); await idle(page); await scrollTop(page);
  for (let i = 0; i < 3; i++) { await page.click('#sfZin'); await idle(page); }
  // pan to the bottom-right corner
  await page.evaluate(() => { const cv = document.getElementById('sfCanvas'); cv.dispatchEvent(new WheelEvent('wheel', { deltaX: 5000, deltaY: 5000, bubbles: true, cancelable: true })); });
  await idle(page);
  const inside = () => page.evaluate(() => { const t = __mstest, cv = document.getElementById('sfCanvas'), w = parseFloat(cv.style.width), h = parseFloat(cv.style.height); return { ok: t.panX <= 0.5 && t.panY <= 0.5 && t.panX >= w - w * t.zoom - 0.5 && t.panY >= h - h * t.zoom - 0.5, w, h, px: t.panX, py: t.panY, z: t.zoom }; });
  const a = await inside(); assert.ok(a.ok && a.z > 1, JSON.stringify(a));
  for (const [w, h] of [[390, 640], [360, 900], [390, 844]]) {
    await page.setViewportSize({ width: w, height: h }); await idle(page);
    const b = await inside();
    assert.ok(b.ok, `${w}×${h}: the pan stays inside the picture ${JSON.stringify(b)}`);
  }
  // the same when the stage changes to one with another picture size (Colour along keeps a fixed size)
  await page.setViewportSize({ width: 375, height: 667 }); await idle(page); await page.evaluate(() => scrollTo(0, 400)); await frames(page);
  for (let i = 0; i < 2; i++) { await page.click('#sfZin'); await idle(page); }
  await page.evaluate(() => { const cv = document.getElementById('sfCanvas'); cv.dispatchEvent(new WheelEvent('wheel', { deltaX: 5000, deltaY: 5000, bubbles: true, cancelable: true })); });
  await page.click('#sfColor'); await idle(page);
  const c = await inside(); assert.ok(c.ok, 'Colour along: ' + JSON.stringify(c));
  assert.deepEqual(errors, []);
});

test('turning a phone into side by side pins the picture, as opening side by side does', async () => {
  const { page, errors } = await openApp({ width: 390, height: 844 });
  await sampleGuide(page); await idle(page); await scrollTop(page);
  await page.setViewportSize({ width: 844, height: 390 }); await idle(page);
  // (the resize reaches the page a frame or two later in GitHub's WebKit: wait for the new layout, up to 5 s)
  await until(page, () => { const s = document.getElementById('sfView'), c = document.getElementById('sfCanvas').getBoundingClientRect(); return __mstest.geo.side && Math.abs(s.getBoundingClientRect().top - (parseFloat(getComputedStyle(s).top) || 0)) <= 1 && c.bottom <= 391; }, null, 'side by side, pinned, foot on the screen', 5000).catch(() => {});
  const v = await page.evaluate(() => { const s = document.getElementById('sfView'); return { top: s.getBoundingClientRect().top, want: parseFloat(getComputedStyle(s).top) || 0, side: __mstest.geo.side }; });
  assert.equal(v.side, true);
  assert.ok(Math.abs(v.top - v.want) <= 1, `the picture is pinned at its top (${v.top}, want ${v.want})`);
  const r = await rect(page, '#sfCanvas');
  assert.ok(r.bottom <= 390 + 1, `the picture's foot is on the screen (${r.bottom})`);
  assert.deepEqual(errors, []);
});

// ---- From v267 ----
const zoomState = (page) => page.evaluate(() => [__mstest.zoom, __mstest.panX, __mstest.panY]);
const WHOLE = [1, 0, 0];

test('every change of stage starts at the whole picture; Find next still zooms', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  const zoomIn = async () => { await scrollTop(page); await page.click('#sfZin'); await page.click('#sfZin'); await idle(page); const z = await zoomState(page); assert.ok(z[0] > 1, 'zoomed in'); };
  // Plan → Colour along
  await zoomIn();
  await page.click('#sfColor'); await idle(page);
  assert.deepEqual(await zoomState(page), WHOLE, 'Colour along starts whole');
  // Find next zooms by itself
  // (v288: as far as the section needs, so the row of the marker with the smallest section)
  const ri = await page.evaluate(() => { const t = __mstest, ks = [...document.querySelectorAll('#sfAlist .sfarow')].map((r) => r.dataset.k); let best = 0, bs = 1e9; t.alongList().forEach((e) => { const i = ks.indexOf(e.key); e.secs.forEach((l) => { if (i >= 0 && t.comps[l].area < bs) { bs = t.comps[l].area; best = i; } }); }); return best; });
  await page.locator('#sfAlist .sfarow .sfah').nth(ri).click(); await idle(page);
  for (let i = 0; i < 40 && (await zoomState(page))[0] <= 1; i++) { await page.click('#sfFindNext'); await idle(page); }
  assert.ok((await zoomState(page))[0] > 1, 'Find next zooms');
  // Colour along → Plan (← Plan)
  await page.click('#sfDoneBtn'); await idle(page);
  assert.equal(await page.evaluate(() => __mstest.sfmode), 'guide');
  assert.deepEqual(await zoomState(page), WHOLE, 'Plan starts whole');
  // Plan → Edit sections
  await zoomIn();
  await page.click('#sfBack2'); await idle(page);
  assert.equal(await page.evaluate(() => __mstest.sfmode), 'review');
  assert.deepEqual(await zoomState(page), WHOLE, 'Edit sections starts whole');
  // Edit sections → Plan (v288: ← Plan, nothing edited)
  await zoomIn();
  await page.click('#sfToPlan');
  await page.waitForFunction(() => __mstest.sfmode === 'guide'); await idle(page);
  assert.deepEqual(await zoomState(page), WHOLE, 'the Plan starts whole');
  assert.deepEqual(errors, []);
});

// ---- From v285 (iPad) ----
const geom = (page) => page.evaluate(() => {
  const v = document.getElementById('sfCanvas').getBoundingClientRect(), t = document.getElementById('sfZoomCtl').getBoundingClientRect(), c = document.getElementById('sfCtl').getBoundingClientRect(), w = document.getElementById('sfWork');
  return { side: getComputedStyle(w).display === 'grid', picW: v.width, picH: v.height, picL: v.left, toolsBottom: t.bottom, toolsRight: t.right, ctlL: c.left, ctlW: c.width, maxScroll: document.documentElement.scrollHeight - innerHeight, vh: innerHeight, vw: innerWidth };
});

test('v285 iPad portrait: one column on the 11" and the 13", using the width; the picture 60% to start, 50% scrolled', async () => {
  for (const [w, h] of [[834, 1194], [1024, 1366]]) {
    const { page, errors, ctx } = await openApp({ width: w, height: h });
    await sampleGuide(page); await letterGuide(page);
    await page.evaluate(() => scrollTo(0, 0)); await idle(page);
    let g = await geom(page);
    assert.equal(g.side, false, `${w}×${h}: one column`);
    assert.ok(g.ctlW > 600, `${w}×${h}: the controls use the width (${g.ctlW})`);
    assert.ok(Math.abs(g.picH - h * 0.6) < 3 || g.picW > g.ctlW - 4, `${w}×${h}: 60% (${g.picH})`);
    await page.evaluate(() => scrollTo(0, 2000)); await idle(page);
    // (50%, or less shrunk where the page ends first: the tabs are only as tall as the tallest, so a big screen
    // doesn't scroll into empty space just to shrink the picture. The picture shrinks after the scroll: WebKit on
    // GitHub can still be at 60% when idle, so wait for it to settle)
    await page.waitForFunction((h) => {
      const v = document.getElementById('sfCanvas').getBoundingClientRect().height, end = Math.abs(scrollY - (document.documentElement.scrollHeight - innerHeight)) <= 1;
      return Math.abs(v - h * 0.5) < 3 || (end && v > h * 0.5 && v < h * 0.6);
    }, h, { timeout: 5000 }).catch(() => {});
    g = await geom(page);
    const end = await page.evaluate(() => Math.abs(scrollY - (document.documentElement.scrollHeight - innerHeight)) <= 1);
    assert.ok(Math.abs(g.picH - h * 0.5) < 3 || (end && g.picH > h * 0.5 && g.picH < h * 0.6), `${w}×${h}: 50% scrolled, or as far as the page goes (${g.picH})`);
    // Colour along: 60%
    await page.evaluate(() => scrollTo(0, 0)); await page.click('#sfColor'); await idle(page);
    assert.ok(Math.abs((await geom(page)).picH - h * 0.6) < 3, 'Colour along 60%');
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});

test('v285 iPad landscape: the picture and its tools fully on screen as the guide opens, its column fitted to it; tabs as tall as the tallest', async () => {
  for (const [w, h] of [[1194, 834], [1366, 1024]]) {
    const { page, errors, ctx } = await openApp({ width: w, height: h });
    await sampleGuide(page); await letterGuide(page);
    await page.evaluate(() => scrollTo(0, 0)); await idle(page);
    const g = await geom(page);
    assert.equal(g.side, true, `${w}×${h}: side by side`);
    assert.ok(g.toolsBottom <= h + 1, `${w}×${h}: tools on screen (${g.toolsBottom})`);
    assert.ok(g.picL + g.picW <= g.ctlL, 'picture left of the controls');
    assert.ok(g.ctlL - (g.picL + g.picW) < 120, `the picture's column fits it (gap ${g.ctlL - (g.picL + g.picW)})`);
    assert.ok(g.ctlW >= 340 && g.ctlW <= 561, `controls ${g.ctlW}`);
    // every tab: nothing to scroll into but the room the page needs, and switching moves nothing (once the first
    // visit's "tap a section" line has gone, at the first change of tab, v289)
    await page.evaluate(() => document.querySelector('.sftabbtn[data-t="pattern"]').click()); await idle(page);
    const heights = [];
    for (const t of ['colours', 'pattern', 'shading', 'share']) {
      await page.evaluate((t) => document.querySelector(`.sftabbtn[data-t="${t}"]`).click(), t); await idle(page);
      heights.push(await page.evaluate(() => document.documentElement.scrollHeight));
    }
    assert.ok(heights.every((x) => x === heights[0]), 'the same page height on every tab: ' + heights);
    // (v308: the Colours tab grew about 120px — the marker count's −/+ row and the Include row with its status line,
    // as Ben chose — so on the 11" the page now scrolls about 110px to reach Colour along. That scroll must be the
    // tallest tab's own content: the Colours panel filled to its end, and the page ending at the card's last button,
    // not empty space under it. It had been "within 40px of the screen", from before Colours was taller than it.)
    await page.evaluate(() => document.querySelector('.sftabbtn[data-t="colours"]').click()); await idle(page);
    await page.evaluate(() => scrollTo(0, 5000)); await idle(page);
    const fill = await page.evaluate(() => {
      const p = document.getElementById('sfPanel-colours'), pb = p.getBoundingClientRect().bottom;
      const last = [...p.querySelectorAll('*')].filter((x) => x.getClientRects().length).reduce((m, x) => Math.max(m, x.getBoundingClientRect().bottom), 0);
      // (Colour along's bar stays at the foot of the screen: scrolled to the end, the tab's last line sits just above it)
      return { slack: pb - last, end: document.getElementById('sfColor').getBoundingClientRect().top - last };
    });
    await page.evaluate(() => scrollTo(0, 0)); await idle(page);
    assert.ok(heights[0] - h <= 40 || fill.slack <= 12, `${w}×${h}: the scroll is the Colours tab's content, not empty space (${heights[0] - h}px, ${Math.round(fill.slack)}px unused)`);
    assert.ok(heights[0] - h <= 40 || (fill.end >= 0 && fill.end <= 60), `${w}×${h}: scrolled to the end, the Colours tab's last line just above the bar (${Math.round(fill.end)}px)`);
    assert.ok(heights[0] - h <= 160, `${w}×${h}: no long scroll (${heights[0] - h}px)`);
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});

test('v285: the side-by-side rule is the same in the CSS and the script', async () => {
  for (const [w, h] of [[390, 844], [844, 390], [834, 1194], [1024, 1366], [1180, 820], [1194, 834], [1099, 1300], [1100, 1300], [1440, 900]]) {
    const { page, errors, ctx } = await openApp({ width: w, height: h });
    await sampleGuide(page); await idle(page);
    const r = await page.evaluate(() => ({ css: getComputedStyle(document.getElementById('sfWork')).display === 'grid', js: __mstest.sideBySide() }));
    assert.equal(r.css, r.js, `${w}×${h}`);
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});
