// The guide screen's frame (Release 3, docs/GUIDE-LAYOUT.md): the picture's sizes and its scroll-linked shrink, tabs
// that never move anything, where a change of stage lands, drag to scroll and gestures, side by side, one-time hints,
// overlays that stay on the scaled picture, and full screen, focus mode and Reveal after the picture has shrunk.
// (v296: in two files, this and guide-frame-2: on GitHub's WebKit the one file came near node's 12-minute limit for a
// file, and once gave no results until its retry)
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

test('picture size: 55% shrinking with the scroll to 45% (40% under 780px tall); Colour along a fixed 55% (45%)', async () => {
  // (on a short screen the start size is capped so the tool row ends above the bar at the top of the page: 367 would
  // be 55% of 667)
  for (const [w, h, full55, floor, along] of [[390, 844, 464, 380, 464], [375, 667, 367, 267, 300]]) {
    const { page, errors, ctx } = await openApp({ width: w, height: h });
    await sampleGuide(page); await idle(page);
    const cap = await page.evaluate(() => Math.floor(innerHeight - document.querySelector('#sfWork>.sfbar').offsetHeight - 40 - (document.getElementById('sfHead').getBoundingClientRect().bottom + scrollY)));
    let full = Math.max(floor, Math.min(full55, cap));
    if (h === 667) assert.ok(full < full55, 'capped on the short screen: ' + full);
    // (within a pixel: the app measures the header's foot and the rows' heights with their fractions; v289: smaller
    // still where that lets the tabs and their first row show, down to the floor)
    const full0 = await picH(page), tabsB = (await rect(page, '.sftabs')).bottom, barT = (await rect(page, '#sfWork>.sfbar')).top;
    assert.ok(full0 <= full + 1 && full0 >= floor, `${w}×${h}: full size at the top (${full0}, ${full})`);
    if (full0 < full - 1) assert.ok(full0 === floor || Math.abs(tabsB + 76 - barT) <= 2, `the tabs and a row above the bar: ${tabsB}, ${barT}`);
    else assert.ok(tabsB + 76 <= barT + 1, 'room for the tabs and a row');
    assert.ok(tabsB <= barT, 'the tabs on the first screen');
    full = full0;
    assert.deepEqual(await page.evaluate(() => [__mstest.geo.full, __mstest.geo.comp]), [full, floor]);
    const top0 = await page.evaluate(() => document.getElementById('sfView').getBoundingClientRect().top + scrollY);
    // in step with the scroll: 30px past the block's top takes 30px off, with the picture's top kept at the screen top
    await scrollAt(page, Math.round(top0) + 30);
    assert.ok(Math.abs((await picH(page)) - Math.max(floor, full - 30)) <= 1, `${w}×${h}: 30px scrolled, ${await picH(page)}`);
    assert.ok(Math.abs((await rect(page, '#sfCanvas')).top) <= 1, 'the picture stays at the top of the screen');
    // never below the floor, however far the page goes
    for (const y of [top0 + (full - floor), top0 + (full - floor) + 60, 5000]) { await scrollAt(page, Math.round(y)); assert.equal(await picH(page), floor, `${w}×${h} at ${Math.round(y)}: floor`); }
    const pin = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--pinH')));
    assert.equal(pin, floor + 40, '--pinH is the floor-size picture plus the 40px tool row');
    assert.ok(Math.abs((await rect(page, '#sfZoomCtl')).bottom - pin) <= 1, 'the tool row ends at --pinH');
    await scrollAt(page, 0);
    assert.equal(await picH(page), full, 'back to full size at the top');
    // Colour along: fixed, the list scrolls under it
    await page.click('#sfColor'); await idle(page); await scrollAt(page, 0); await idle(page);
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
  await page.click('#sfBack2'); await page.click('#sfAdjToggle'); await page.click('#sfRotR'); await idle(page, 1500);
  const g = await page.evaluate(() => __mstest.geo);
  assert.ok(g.full < 380 && g.full === g.comp && !g.shrink, 'a wide picture: ' + JSON.stringify(g));
  const h0 = await picH(page);
  await scrollAt(page, 300);
  assert.equal(await picH(page), h0);
  assert.deepEqual(errors, []);
});

test('switching tabs never moves anything: not pinned, pinned at the threshold, and scrolled into a tab', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  // not pinned yet (the tabs 100px under where they pin): nothing moves, however short the tab
  const th = await tabsPinAt(page);
  await scrollAt(page, th - 100);
  const h0 = await picH(page), t0 = (await rect(page, '.sftabs')).top;
  for (const t of ['shading', 'share', 'pattern', 'colours']) {
    await tapAt(page, `.sftabbtn[data-t="${t}"]`); await idle(page);
    assert.equal(await page.evaluate(() => scrollY), th - 100, t);
    assert.equal(await picH(page), h0, t);
    assert.ok(Math.abs((await rect(page, '.sftabs')).top - t0) <= 0.5, t);
  }
  // pinned: the tabs stay put and the new tab opens at its top, right under them
  await scrollAt(page, th);
  const tabs0 = await rect(page, '.sftabs'), pin = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--pinH')));
  assert.ok(Math.abs(tabs0.top - pin) <= 1, 'tabs pinned under the picture and tool row');
  for (const t of ['shading', 'share', 'colours', 'pattern', 'shading']) {
    await tapAt(page, `.sftabbtn[data-t="${t}"]`); await idle(page);
    assert.equal(await page.evaluate(() => scrollY), th, `${t}: same scroll`);
    assert.equal(await picH(page), 380, `${t}: same picture size`);
    assert.ok(Math.abs((await rect(page, '.sftabs')).top - tabs0.top) <= 0.5, `${t}: tabs where they were`);
    // (under the line under the tabs: the sample's, which takes the place of the first visit's "tap a section" hint at
    // the first change of tab, v289)
    const pane = await rect(page, `.sftab[data-tab="${t}"]`), hint = (await rect(page, '#sfSampleNote')) || (await rect(page, '.sfinfo.sfonce'));
    assert.ok(Math.abs(pane.top - (hint ? hint.bottom : tabs0.bottom)) <= 2, `${t}: opens at its top`);
  }
  // scrolled into a long tab: the next one opens at its top with the tabs still pinned
  await tapAt(page, '.sftabbtn[data-t="colours"]'); await scrollAt(page, th + 100);
  assert.ok(await page.evaluate(() => scrollY) > th + 60, 'scrolled into Colours');
  await tapAt(page, '.sftabbtn[data-t="share"]'); await idle(page);
  assert.equal(await page.evaluate(() => scrollY), th);
  assert.ok(Math.abs((await rect(page, '.sftabs')).top - tabs0.top) <= 0.5);
  assert.equal(await picH(page), 380);
  assert.deepEqual(errors, []);
});

test('the page ends at the guide card: no gap under the bar at the end of any tab or stage', async () => {
  for (const [w, h] of [[390, 844], [375, 667], [844, 390]]) {
    const { page, errors, ctx } = await openApp({ width: w, height: h });
    await sampleGuide(page); await idle(page);
    for (const t of ['colours', 'pattern', 'shading', 'share']) {
      await page.click(`.sftabbtn[data-t="${t}"]`); await scrollAt(page, 1e6); await idle(page);
      const g = await barGap(page);
      assert.ok(g >= -0.5 && g <= 2, `${w}×${h} ${t}: ${g}px under the bar`);
    }
    await page.click('#sfColor'); await idle(page); await scrollAt(page, 1e6); await idle(page);
    assert.ok(Math.abs(await barGap(page)) <= 2, `${w}×${h} Colour along: ${await barGap(page)}px`);
    await answerAsks(page);
    await page.click('#sfDoneBtn'); await page.click('#sfBack2'); await idle(page); await scrollAt(page, 1e6); await idle(page);
    assert.ok(Math.abs(await barGap(page)) <= 2, `${w}×${h} Edit sections: ${await barGap(page)}px`);
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});

test('drag to scroll: pan-y at zoom 1; none when zoomed, painting, a sheet is open, drawing, or on the sun', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  assert.equal(await touchAction(page), 'pan-y', 'Plan at zoom 1');
  await page.click('#sfZin'); assert.equal(await touchAction(page), 'none', 'zoomed in');
  await page.click('#sfZrst'); assert.equal(await touchAction(page), 'pan-y');
  await openMenu(page); assert.equal(await touchAction(page), 'none', 'a sheet is open');
  await page.keyboard.press('Escape'); assert.equal(await touchAction(page), 'pan-y');
  await page.click('.sftabbtn[data-t="pattern"]'); await page.click('#sfFam [data-v="manual"]'); await idle(page);
  assert.equal(await touchAction(page), 'pan-y', 'Manual, Paint off');
  await page.click('#sfPaint'); assert.equal(await touchAction(page), 'none', 'Paint on');
  await page.click('#sfPaint'); await page.click('#sfFam [data-v="gradient"]'); await idle(page);
  await page.click('.sftabbtn[data-t="shading"]'); await page.click('#sfShade [data-v="full"]'); await idle(page);
  assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('sfSun')).touchAction), 'none', 'a drag on the sun never scrolls');
  // a finger dragged up the picture scrolls the page; two fingers still pinch it (touch is driven through Chromium's
  // own protocol, so Safari's engine skips this part)
  if (ENGINE === 'chromium') {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    const T = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p, i) => ({ x: p.x, y: p.y, id: i + 1 })) });
    await scrollAt(page, 0);
    const c = await rect(page, '#sfCanvas'), x = c.x + c.width / 2, y = c.y + c.height * 0.8;
    await T('touchStart', [{ x, y }]); for (let i = 1; i <= 8; i++) await T('touchMove', [{ x, y: y - i * 25 }]); await T('touchEnd', []); await idle(page, 1500);
    assert.ok(await page.evaluate(() => scrollY) > 40, 'the page scrolled');
    assert.equal(await page.evaluate(() => __mstest.zoom), 1);
    const c2 = await rect(page, '#sfCanvas'), cx = c2.x + c2.width / 2, cy = c2.y + c2.height / 2, sy = await page.evaluate(() => scrollY);
    await T('touchStart', [{ x: cx - 20, y: cy }, { x: cx + 20, y: cy }]);
    for (let i = 1; i <= 6; i++) await T('touchMove', [{ x: cx - 20 - i * 12, y: cy + i * 3 }, { x: cx + 20 + i * 12, y: cy + i * 3 }]);
    await T('touchEnd', []); await idle(page);
    assert.ok(await page.evaluate(() => __mstest.zoom) > 1.5, 'a pinch at zoom 1 zooms the picture');
    assert.equal(await page.evaluate(() => scrollY), sy, 'and does not scroll the page');
    assert.equal(await touchAction(page), 'none', 'zoomed in');
    await page.click('#sfZrst');
  }
  // Edit sections: the tools that draw
  await answerAsks(page);
  await page.click('#sfBack2'); await idle(page);
  for (const [m, want] of [['toggle', 'pan-y'], ['merge', 'pan-y'], ['split', 'none'], ['add', 'none'], ['toggle', 'pan-y']]) {
    await page.click(`#sfEdit [data-m="${m}"]`);
    assert.equal(await touchAction(page), want, 'Edit sections: ' + m);
  }
  assert.deepEqual(errors, []);
});

test('side by side (landscape phones and wide screens): the picture fills its column, tools beside it, nothing on it', async () => {
  for (const [w, h] of [[844, 390], [667, 375], [1280, 800]]) {
    const { page, errors, ctx } = await openApp({ width: w, height: h });
    await sampleGuide(page); await idle(page);
    assert.ok(await sideBySide(page), `${w}×${h} is side by side`);
    await scrollAt(page, 400); await idle(page);
    const c = await rect(page, '#sfCanvas'), hd = await rect(page, '#sfHead'), ctl = await rect(page, '#sfCtl');
    assert.ok(c.right <= hd.left && c.right <= ctl.left, `${w}×${h}: the header and controls are to the right of the picture`);
    // (landscape phones: the screen's height; 600px tall and more, v285: what's left below the header at rest)
    if (h < 600) assert.ok(Math.abs(c.height - (h - 16)) <= 2, `${w}×${h}: fills the column's height (${c.height})`);
    else assert.ok(c.height >= h * 0.7 - 14 && c.height <= h - 14, `${w}×${h}: fits below the header (${c.height})`);
    assert.ok(c.top >= 7 && c.bottom <= h - 7, `${w}×${h}: whole picture in view while scrolled`);
    assert.ok(await page.evaluate(() => document.getElementById('sfWork').classList.contains('sftoolsv')), 'tools stacked beside it');
    const btns = await page.$$eval('#sfZoomCtl .sfz', (b) => b.filter((x) => x.offsetParent).map((x) => x.getBoundingClientRect().toJSON()));
    assert.ok(btns.length >= 4);
    for (const b of btns) assert.ok(!overlaps(b, c), `${w}×${h}: a tool button is on the picture`);
    assert.ok(btns.every((b) => b.x >= c.right), 'beside, to the right');
    assert.equal(await picH(page), Math.round(c.height), 'no shrink side by side');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true, 'no sideways scroll');
    // the ⋯ sheet covers the controls column, not the picture
    // (waiting for it to arrive, not for its slide to end: GitHub's WebKit can leave a transition unfinished for a while)
    await openMenu(page); await idle(page);
    const onCol = ([cr, h]) => { const s = document.getElementById('sfSheet').getBoundingClientRect(); return s.left >= cr && Math.round(s.top) === 0 && Math.abs(s.bottom - h) <= 1; };
    await until(page, onCol, [c.right, h], 'the sheet in place', 15000).catch(() => {});
    const s = await rect(page, '#sfSheet');
    assert.ok(s.left >= c.right && Math.round(s.top) === 0 && Math.abs(s.bottom - h) <= 1, `${w}×${h}: sheet over the controls column (${JSON.stringify(s)})`);
    await page.keyboard.press('Escape');
    assert.deepEqual(errors, []);
    await ctx.close();
  }
  // iPad portrait stays one column
  const { page, ctx } = await openApp({ width: 768, height: 1024 });
  await sampleGuide(page); await idle(page);
  assert.equal(await sideBySide(page), false, 'iPad portrait: one column');
  await ctx.close();
});

test('overlays stay on the shrunk picture: the sun, the tip over a tapped section, and taps in Blend', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  await page.click('.sftabbtn[data-t="shading"]'); await page.click('#sfShade [data-v="full"]'); await idle(page);
  await page.evaluate(() => { __mstest.shadeSun = { x: 0.5, y: 0.45 }; __mstest.renderGuide(); });
  const top0 = await page.evaluate(() => document.getElementById('sfView').getBoundingClientRect().top + scrollY);
  for (const d of [0, 40, 84]) {
    await scrollAt(page, Math.round(top0) + d); await idle(page);
    const off = await page.evaluate(() => { const s = document.getElementById('sfSun').getBoundingClientRect(), c = document.getElementById('sfCanvas').getBoundingClientRect(); return [s.left + s.width / 2 - (c.left + 0.5 * c.width), s.top + s.height / 2 - (c.top + 0.45 * c.height)]; });
    assert.ok(Math.hypot(off[0], off[1]) < 1.5, `sun on its point with the picture ${d}px shrunk: ${off}`);
  }
  assert.ok(await page.evaluate(() => __mstest.picScale < 1 && Math.abs(__mstest.picScale - __mstest.geo.comp / __mstest.geo.full) < 0.01), 'measured shrunk');
  // the tip sits by the tapped section, above or below it
  await page.click('#sfShade [data-v="off"]'); await idle(page);
  await scrollAt(page, Math.round(top0) + 84);
  const ls = await bigSections(page, 8);
  const l = await page.evaluate((ls) => ls.find((l) => { const t = __mstest, p = t.labelPos(l); return p.y / t.H > 0.3 && p.y / t.H < 0.7; }), ls);
  const p = await sectionPoint(page, l);
  await page.mouse.click(p.x, p.y); await page.waitForSelector('.sftip'); await idle(page);
  // (outside the scaled wrapper: it keeps its size, and stays inside the picture's column)
  const tip = await rect(page, '.sftip'), fr = await rect(page, '#sfView');
  assert.ok(Math.abs(tip.x + tip.width / 2 - p.x) < 3 || tip.x <= fr.left + 8 || tip.right >= fr.right - 8, `centred on the section, or kept inside the picture's frame (${tip.x + tip.width / 2} vs ${p.x})`);
  assert.ok(tip.x >= fr.left && tip.right <= fr.right, 'inside the frame');
  assert.equal(await page.evaluate(() => { const t = document.querySelector('.sftip'); return Math.round(t.getBoundingClientRect().height - t.offsetHeight); }), 0, 'not scaled with the picture');
  assert.ok(tip.bottom <= p.y + 1 || tip.top >= p.y - 1, 'above or below the section, not over it');
  // Blend: a tap on the shrunk picture adds an anchor exactly where it landed
  await page.click('.sftabbtn[data-t="pattern"]'); await page.click('#sfFam [data-v="blend"]'); await idle(page);
  await scrollAt(page, Math.round(top0) + 84);
  const n0 = await page.evaluate(() => __mstest.anchors.length);
  const far = await page.evaluate((ls) => ls.find((l) => { const t = __mstest, c = t.comps[l], tol = Math.max(t.W, t.H) * 0.06; return t.anchors.every((a) => Math.hypot(a.x - c.cx, a.y - c.cy) > tol); }), ls);
  const q = await sectionPoint(page, far), want = await page.evaluate((l) => __mstest.labelPos(l), far);
  await page.mouse.click(q.x, q.y); await idle(page);
  const a = await page.evaluate(() => __mstest.anchors[__mstest.anchors.length - 1]);
  assert.equal(await page.evaluate(() => __mstest.anchors.length), n0 + 1);
  assert.ok(Math.hypot(a.x - want.x, a.y - want.y) <= 3, `anchor at the tapped point (${a.x},${a.y} vs ${want.x},${want.y})`);
  assert.deepEqual(errors, []);
});

test('one-time hints: "tap a section" in full the first time only; helper text is full once, then a one-line ⓘ', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  assert.match(await page.textContent('#sfCtl .sfinfo.sfonce'), /Tap a section on the picture to change or pin its colour/);
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('ms-seen-hints'))), ['tap']);
  // helper text through the same helper: open the first time, closed (the short line) after a reload; ⓘ toggles it
  await page.evaluate(() => { const d = document.createElement('div'); d.id = 'hintProbe'; d.innerHTML = __mstest.infoLine('probe', 'Short', 'The long explanation'); document.getElementById('sfCtl').prepend(d); });
  assert.equal(await page.getAttribute('#hintProbe .sfinfo', 'aria-expanded'), 'true');
  assert.equal(await page.textContent('#hintProbe .sfit'), 'The long explanation');
  await page.reload(); await page.evaluate(() => { setMode('sections'); SF.loadSample(); }); await page.waitForFunction(() => !!(window.__mstest && __mstest.assignData)); await idle(page);
  assert.equal(await page.locator('#sfCtl .sfinfo.sfonce').count(), 0, 'the tap hint is not shown again (it is in Help)');
  await page.evaluate(() => { const d = document.createElement('div'); d.id = 'hintProbe'; d.innerHTML = __mstest.infoLine('probe', 'Short', 'The long explanation'); document.getElementById('sfCtl').prepend(d); });
  assert.equal(await page.getAttribute('#hintProbe .sfinfo', 'aria-expanded'), 'false');
  assert.equal(await page.textContent('#hintProbe .sfit'), 'Short');
  await page.click('#hintProbe .sfinfo');
  assert.equal(await page.getAttribute('#hintProbe .sfinfo', 'aria-expanded'), 'true');
  assert.equal(await page.textContent('#hintProbe .sfit'), 'The long explanation');
  assert.deepEqual(errors, []);
});

test('full screen, focus mode and Reveal keep their own layouts after the picture has shrunk', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  await scrollAt(page, 2000); await idle(page);
  const y0 = await page.evaluate(() => scrollY);
  await tapAt(page, '#sfFull'); await idle(page);
  // (the picture eases to its full-screen size: GitHub's WebKit can still be on its way, run 36933545500, 493 px)
  await until(page, () => document.getElementById('sfCanvas').getBoundingClientRect().height > 600, null, 'full screen grown', 15000).catch(() => {});
  const f = await rect(page, '#sfCanvas');
  assert.ok(f.height > 600, 'full screen is big: ' + f.height);
  assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('sfView')).position), 'fixed');
  await page.click('#sfFullX'); await idle(page);
  assert.equal(await page.evaluate(() => scrollY), y0, 'back where the page was');
  // (the picture eases back to its size: GitHub's WebKit can hold that back, run 24, measured at 389 px mid-way)
  const settled = (h, what) => until(page, (h) => Math.round(document.getElementById('sfCanvas').getBoundingClientRect().height) === h, h, what, 15000).catch(() => {});
  await settled(380, 'the picture back at its pinned floor size');
  assert.equal(await picH(page), 380, 'back to the pinned floor size');
  await page.click('#sfColor'); await idle(page); await page.click('#sfFocus'); await idle(page);
  const g = await rect(page, '#sfCanvas');
  assert.ok(g.height > 380, 'focus mode fills the screen: ' + g.height);
  assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--pinH').trim()), '0px');
  await page.keyboard.press('Escape'); await idle(page);
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
  const sizes = [], tops = [];
  for (const y of [0, 300, 900, 1800, 900, 0]) {
    await page.evaluate((y) => scrollTo(0, y), y); await idle(page);
    const r = await page.evaluate(() => { const c = document.getElementById('sfCanvas').getBoundingClientRect(); return [Math.round(c.height), Math.round(c.top)]; });
    sizes.push(r[0]); tops.push(r[1]);
  }
  // (v289: under 55% where the tabs and their first row need the room)
  const full = await page.evaluate(() => __mstest.geo.full);
  assert.ok(full > 380 && full <= 464 && sizes[0] === full, `full size at the top (at most 55% of 844): ${sizes[0]}`);
  assert.equal(sizes[3], 380, 'floor size once scrolled (45% of 844)');
  assert.deepEqual([sizes[2], sizes[4], sizes[5]], [380, 380, full], 'the same size for the same place, both ways');
  assert.ok(tops[3] >= -1 && tops[3] <= 1, 'picture stays pinned at the top');
  await shot(page, 'guide');
  assert.deepEqual(errors, []);
});

// ---- From the third full review (v259) ----
test('gestures: a drag in Blend pans instead of adding an anchor; right-click never ticks a section', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await page.click('.sftabbtn[data-t="pattern"]'); await page.click('#sfFam [data-v="blend"]'); await idle(page);
  await page.click('#sfZin'); await page.click('#sfZin'); await idle(page);
  await scrollTop(page);
  const n0 = await page.evaluate(() => __mstest.anchors.length), pan0 = await page.evaluate(() => [__mstest.panX, __mstest.panY]);
  const box = await page.locator('#sfView').boundingBox(), cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx + 90, cy + 40, { steps: 6 }); await page.mouse.up(); await idle(page);
  const r = await page.evaluate(() => ({ n: __mstest.anchors.length, pan: [__mstest.panX, __mstest.panY] }));
  assert.equal(r.n, n0, 'no anchor added');
  assert.notDeepEqual(r.pan, pan0, 'the picture moved');
  // right-click in colour along
  await page.click('#sfZrst'); await page.click('.sftabbtn[data-t="colours"]'); await page.click('#sfColor'); await idle(page);
  const l = await page.evaluate(() => __mstest.assignData.order[3]); await scrollTop(page); const p = await sectionPoint(page, l);
  await page.mouse.click(p.x, p.y, { button: 'right' }); await idle(page);
  assert.equal(await page.evaluate((l) => __mstest.colored[l], l), 0, 'not ticked');
  assert.deepEqual(errors, []);
});

// ---- From the fourth review (v263 guide screen) ----
