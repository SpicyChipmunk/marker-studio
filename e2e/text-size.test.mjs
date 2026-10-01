// Text size follows the phone's text-size setting (src/css/01-base.css). The browser's default font size stands in
// for the phone setting here (it sets the same root size that <meta name="text-scale"> and iOS Dynamic Type do):
// at the default everything keeps its designed pixel size, apart from the raised 12px minimum; bigger settings grow
// the text (controls up to 1.3x, reading text up to 1.6x) without sideways scrolling or text cut off at the edge.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, sampleGuide, idle, openAtScale, menuItem, openMenu, sectionPoint, longPress, scrollTop, saveGuide } from './helpers.mjs';

before(setup);
after(teardown);

const MIN = 12;

const openAt = openAtScale;

const px = (page, sel) => page.$eval(sel, (e) => parseFloat(getComputedStyle(e).fontSize));

// every visible piece of text on the page: its font size and where it sits (SVG drawings are skipped)
const texts = (page) => page.evaluate(() => {
  const out = [], w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const el = n.parentElement;
    if (!n.nodeValue.trim() || !el || el.closest('svg,script,style,option,noscript')) continue;
    if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
    const r = el.getBoundingClientRect();
    if (r.width <= 1 || r.height <= 1) continue; // visually hidden (screen-reader only)
    // the text's own box, cut to its nearest clipping ancestor; `cut` = that ancestor hides part of it without an
    // ellipsis (scrolling boxes don't count: the rest is a scroll away)
    const rg = document.createRange(); rg.selectNodeContents(n); const t = rg.getBoundingClientRect();
    let left = t.left, right = t.right, cut = false, ell = false, first = true;
    // (past the nearest clipping ancestor, only sideways scrollers further up count: v288's In this guide strip, whose
    // tiles clip their own codes and scroll sideways together)
    for (let a = el; a && a !== document.body; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (first && cs.textOverflow === 'ellipsis') ell = true;
      const clipX = /hidden|clip/.test(cs.overflowX), clipY = /hidden|clip/.test(cs.overflowY);
      const b = a.getBoundingClientRect();
      const scrollX = /auto|scroll/.test(cs.overflowX);
      if (!first) { if (scrollX) { left = Math.max(left, b.left); right = Math.min(right, b.right); break; } continue; }
      if (!clipX && !clipY && !scrollX) continue;
      if (clipX || scrollX) { left = Math.max(left, b.left); right = Math.min(right, b.right); }
      if (!ell && ((clipX && (t.right > b.right + 1 || t.left < b.left - 1)) || (clipY && (t.bottom > b.bottom + 1 || t.top < b.top - 1)))) cut = true;
      if (scrollX) break;
      first = false;
    }
    out.push({ text: n.nodeValue.trim().slice(0, 40), cls: el.tagName + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : ''), size: parseFloat(getComputedStyle(el).fontSize), left, right, cut });
  }
  return out;
});

async function checkScreen(page, name, { edges = true } = {}) {
  const t = await texts(page);
  assert.ok(t.length > 3, `${name}: found text`);
  const small = t.filter((x) => x.size < MIN - 0.01);
  assert.deepEqual(small, [], `${name}: text below ${MIN}px`);
  const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  assert.ok(sw <= cw, `${name}: no sideways scroll (${sw} > ${cw})`);
  if (edges) {
    const vw = await page.evaluate(() => innerWidth);
    const off = t.filter((x) => x.right > x.left && (x.right > vw + 1 || x.left < -1)); // (text scrolled out of a scroller is skipped)
    assert.deepEqual(off, [], `${name}: text runs off the screen`);
    assert.deepEqual(t.filter((x) => x.cut), [], `${name}: text cut off by its box`);
  }
}

// Change colour's picker on the biggest section: checked like any screen, and no code of five characters or fewer
// ends in an ellipsis (checkScreen accepts an ellipsis as meant; here it isn't)
async function pickerCodes(page) {
  const l = await page.evaluate(() => { const t = __mstest; return t.assignData.order.slice().sort((a, b) => t.comps[b].area - t.comps[a].area)[0]; });
  await page.evaluate(() => new Promise((r) => { scrollTo(0, 0); requestAnimationFrame(() => requestAnimationFrame(r)); }));
  const p = await sectionPoint(page, l); await page.mouse.click(p.x, p.y); await idle(page);
  await page.click('.sftip [data-a="change"]'); await page.waitForSelector('#sfSheet.sfpicksh'); await idle(page);
  await checkScreen(page, 'guide: the marker picker');
  const cut = await page.$$eval('#sfPopSw .sfswt', (ts) => ts.filter((t) => t.textContent.length <= 5 && t.offsetParent).filter((t) => { const r = document.createRange(); r.selectNodeContents(t); return r.getBoundingClientRect().width > t.clientWidth + 0.5; }).map((t) => t.textContent));
  assert.deepEqual(cut, [], 'marker codes cut short in the picker');
  await page.click('#sfPopCancel'); await idle(page);
}

// the main screens and sheets, each checked where it's shown
async function walkScreens(page) {
  await checkScreen(page, 'welcome');
  await sampleGuide(page); await idle(page);
  await checkScreen(page, 'guide: Colours');
  // the marker picker: its codes are never cut short with an ellipsis (up to five characters)
  await pickerCodes(page);
  // Shading with shading on and its suggestions opened, Share, and the Print sheet
  await page.click('.sftabbtn[data-t="shading"]'); await page.click('#sfShade [data-v="full"]'); await idle(page);
  if (await page.isVisible('#sfShNoteT')) await page.click('#sfShNoteT');
  await page.evaluate(() => document.getElementById('msToast')?.classList.remove('on'));
  await checkScreen(page, 'guide: Shading');
  await page.click('#sfShade [data-v="off"]'); await idle(page);
  await page.click('.sftabbtn[data-t="share"]'); await idle(page); await checkScreen(page, 'guide: Share');
  await page.click('#sfPrint'); await idle(page); await checkScreen(page, 'guide: the Print sheet');
  await page.keyboard.press('Escape'); await idle(page);
  await saveGuide(page); await idle(page);
  await page.evaluate(() => document.getElementById('msToast')?.classList.remove('on'));
  await page.click('.sftabbtn[data-t="pattern"]'); await idle(page);
  await checkScreen(page, 'guide: Pattern');
  await page.click('#sfFam [data-v="manual"]'); await idle(page);
  await page.click('#sfPaint'); await idle(page);
  await checkScreen(page, 'guide: Manual with Paint on');
  await page.click('#sfPaint'); await idle(page);
  await page.click('.sftabbtn[data-t="colours"]'); await page.click('#sfColor'); await idle(page);
  await checkScreen(page, 'guide: Colour along');
  await openMenu(page); await idle(page);
  await checkScreen(page, 'guide: the ⋯ menu');
  await page.keyboard.press('Escape'); await idle(page);
  await page.click('#sfFocus'); await idle(page);
  await checkScreen(page, 'Focus mode');
  await page.keyboard.press('Escape'); await idle(page);
  await menuItem(page, 'Help'); await idle(page);
  await checkScreen(page, 'Help');
  await page.click('#helpHiw'); await idle(page);
  await checkScreen(page, 'How it works');
  await page.click('#hiwClose'); await idle(page);
  await page.keyboard.press('Escape'); await idle(page);
  await page.evaluate(() => document.getElementById('mHome').click()); await idle(page);
  await checkScreen(page, 'Home');
  await page.click('#homeLibCard'); await idle(page);
  await checkScreen(page, 'Library');
  await page.evaluate(() => { for (const o of document.querySelectorAll('.on[id$="Overlay"]')) o.classList.remove('on'); });
  await page.click('#mCollection'); await idle(page);
  await checkScreen(page, 'Markers');
  await page.locator('#results .cell').first().scrollIntoViewIfNeeded();
  const b = await page.locator('#results .cell').first().boundingBox();
  await longPress(page, b.x + b.width / 2, b.y + b.height / 2); await idle(page);
  assert.ok(await page.isVisible('#mkOverlay'));
  await checkScreen(page, 'marker details');
  await page.evaluate(() => { for (const o of document.querySelectorAll('.on[id$="Overlay"]')) o.classList.remove('on'); scrollTo(0, 0); });
  await page.click('#swatchBtn'); await page.waitForSelector('#swOverlay.on'); await idle(page);
  await checkScreen(page, 'swatch chart');
  await page.click('#swClose'); await idle(page);
  await page.click('#mPalette'); await idle(page);
  await checkScreen(page, 'Palette');
}

test('at the default text size the app keeps its designed pixel sizes, with nothing under 12px', async () => {
  const { page, errors } = await openAt(1);
  await sampleGuide(page); await idle(page);
  assert.equal(await px(page, 'html'), 16);
  assert.equal(await px(page, 'body'), 16);
  assert.equal(await px(page, '.title'), 19);
  assert.equal(await px(page, '.set'), 12);
  assert.equal(await px(page, '#mHome'), 14);
  assert.equal(await px(page, '.sftabbtn'), 13);
  assert.equal(await px(page, '.sfcolorcta'), 14);
  await saveGuide(page); await idle(page);
  assert.equal(await px(page, '#sfSaveSt'), 12, 'save status line: raised from 11px');
  await page.evaluate(() => document.getElementById('mHome').click()); await idle(page);
  assert.equal(await px(page, '.homesub'), 13);
  assert.equal(await px(page, '.hclabel'), 14);
  assert.equal(await px(page, '.hcsub'), 12, 'Home card line: raised from 11px');
  assert.equal(await px(page, '.homever'), 12, 'version: raised from 11px');
  assert.equal(await px(page, '.sfRecName'), 14);
  await page.click('#mCollection'); await idle(page);
  assert.equal(await px(page, '.pile-head .lbl'), 16);
  assert.equal(await px(page, '.cell .cc'), 12, 'marker code: raised from 11px');
  assert.equal(await px(page, '.rghead'), 12, 'colour-family heading: raised from 11px');
  // the grid keeps its five columns at 390px wide
  const cols = await page.$$eval('#results .cell', (cs) => { const t = cs[0].getBoundingClientRect().top; return cs.filter((c) => c.getBoundingClientRect().top === t).length; });
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
  await page.evaluate(() => document.getElementById('mHome').click()); await idle(page);
  assert.equal(await px(page, '.homesub'), 13 * 1.5);
  assert.ok(Math.abs((await px(page, '.hcsub')) - 12 * 1.3) < 0.05, 'Home cards are buttons: 1.3x');
  assert.ok(Math.abs((await px(page, '#mHome')) - 14 * 1.3) < 0.05, 'tab label capped at 1.3x');
  assert.ok(Math.abs((await px(page, '.title')) - 19 * 1.3) < 0.05, 'header capped at 1.3x');
  // the Home cards become full-width rows rather than squeezing (none left alone on a line: review 5), and hold their text
  const cards = await page.$$eval('.homecard', (cs) => cs.map((c) => { const r = c.getBoundingClientRect(); return { top: Math.round(r.top), w: Math.round(r.width), fits: c.scrollHeight <= c.clientHeight + 1 }; }));
  assert.equal(new Set(cards.map((c) => c.top)).size, 3);
  assert.equal(new Set(cards.map((c) => c.w)).size, 1);
  assert.ok(cards.every((c) => c.fits), 'nothing spills out of a Home card');
  assert.deepEqual(errors, []);
});

test('the largest setting stops at 1.6x, and at 360 wide nothing runs off the screen', async () => {
  const { page, errors } = await openAt(2, { width: 360, height: 740 });
  assert.equal(await px(page, 'html'), 32);
  await walkScreens(page);
  await page.evaluate(() => document.getElementById('mHome').click()); await idle(page);
  assert.ok(Math.abs((await px(page, '.homesub')) - 13 * 1.6) < 0.05, 'capped at 1.6x');
  assert.deepEqual(errors, []);
});

test('with no markers yet, the Home "Set up your markers" card holds its text (360 and 390 wide, default and 1.3x)', async () => {
  for (const [width, scale] of [[360, 1], [390, 1], [360, 1.3], [390, 1.3]]) {
    const { page, ctx } = await openAt(scale, { width });
    await page.click('#wcSkip'); await page.click('#wcLook'); await idle(page);
    await page.evaluate(() => document.getElementById('mHome').click()); await idle(page);
    const c = await page.$eval('.homecard.attn', (e) => { const r = e.getBoundingClientRect(), kids = [...e.children].map((k) => k.getBoundingClientRect()); return { txt: e.querySelector('.hcsub').textContent, inside: kids.every((k) => k.top >= r.top && k.bottom <= r.bottom && k.left >= r.left && k.right <= r.right) }; });
    assert.equal(c.txt, 'Set up your markers');
    assert.ok(c.inside, `card content inside the card at ${width}px, ${scale}x`);
    await ctx.close();
  }
});

test('coming back to the app after the text size changed re-runs the layout, as a resize does', async () => {
  const { page, errors } = await openAt(1);
  const fired = await page.evaluate(() => {
    let n = 0; addEventListener('resize', () => n++);
    const back = () => document.dispatchEvent(new Event('visibilitychange'));
    back(); const same = n; // nothing changed: no relayout
    document.documentElement.style.fontSize = '21px'; back();
    return [same, n];
  });
  assert.deepEqual(fired, [0, 1]);
  assert.deepEqual(errors, []);
});

// ---- From the fourth review (outside the guide screen) ----
test('large text: Match tabs and the You/Marker labels fit; the welcome shows several sets; Random’s buttons look enabled', async () => {
  const { page, errors } = await openAtScale(1.6, { width: 375, height: 667 });
  await page.waitForSelector('#welcome.on');
  assert.ok(await page.evaluate(() => document.getElementById('wcSets').clientHeight) >= 140, 'room for several sets');
  await page.click('#wcSkip'); await page.click('#wcLook');
  await page.click('#mCollection'); await page.click('#mkMatchBtn');
  await page.evaluate(() => window.msMatchHex('#3a7bd5')); await idle(page);
  const over = await page.evaluate(() => [...document.querySelectorAll('.msrc button')].filter((b) => b.offsetWidth && b.scrollWidth > b.clientWidth + 1).map((b) => b.textContent));
  assert.deepEqual(over, [], 'no tab runs out of its box');
  const clipped = await page.evaluate(() => [...document.querySelectorAll('.mcmp i')].filter((i) => i.scrollWidth > i.parentElement.clientWidth + 1).map((i) => i.textContent));
  assert.deepEqual(clipped, []);
  await page.click('#matchClose');
  await page.click('#mkDrawBtn'); await page.click('#draw'); await idle(page);
  assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('undo')).color), await page.evaluate(() => getComputedStyle(document.body).color), 'Remove in the normal text colour');
  assert.deepEqual(errors, []);
});

// ---- From the fifth review (guide screen) ----
const SHOTS = process.env.SHOTS || '';
const shot = (page, name) => (SHOTS ? page.screenshot({ path: SHOTS + '/' + name + '.png' }) : null);
const rect = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return e ? e.getBoundingClientRect().toJSON() : null; }, sel);
const bigSections = (page, n = 6) => page.evaluate((n) => { const t = __mstest; return t.assignData.order.slice().sort((a, b) => t.comps[b].area - t.comps[a].area).slice(0, n); }, n);
async function tapSection(page, l) { const p = await sectionPoint(page, l); await page.mouse.click(p.x, p.y); await idle(page); }
async function changeColour(page, l) { await scrollTop(page); await tapSection(page, l); await page.click('.sftip [data-a="change"]'); await page.waitForSelector('#sfSheet.sfpicksh'); await idle(page); }

test('the marker picker never cuts a five-character code short, at any text size', async () => {
  for (const [sc, w, h] of [[2, 375, 667], [1.3, 375, 667], [1, 360, 740]]) {
    const { page, errors, ctx } = await openAtScale(sc, { width: w, height: h });
    await sampleGuide(page); await idle(page);
    const [l] = await bigSections(page, 1);
    await changeColour(page, l);
    const cut = await page.$$eval('#sfPopSw .sfswt', (ts) => ts.filter((t) => t.textContent.length <= 5).filter((t) => { const r = document.createRange(); r.selectNodeContents(t); return r.getBoundingClientRect().width > t.clientWidth + 0.5; }).map((t) => t.textContent));
    assert.deepEqual(cut, [], `@${sc} ${w}px: codes cut short`);
    if (sc === 2) { await page.fill('#sfPopFilter', 'YR1'); await idle(page); await shot(page, 'g1-4-after'); }
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});

test('Share: ✨ Reveal & share and Save image are each one line at every text size, stacked when they need to be', async () => {
  for (const [sc, w, h] of [[1, 375, 667], [1.3, 375, 667], [2, 375, 667], [2, 360, 740]]) {
    const { page, errors, ctx } = await openAtScale(sc, { width: w, height: h });
    await sampleGuide(page); await idle(page);
    await page.click('.sftabbtn[data-t="share"]'); await idle(page);
    await page.$eval('#sfReveal', (e) => e.scrollIntoView({ block: 'center' })); await idle(page);
    for (const id of ['sfReveal', 'sfExport', 'sfPlan', 'sfAsPal']) {
      // (the words' lines: an icon before them sits a little lower in the same line)
      const one = await page.$eval('#' + id, (b) => { const lines = new Set(); b.childNodes.forEach((n) => { if (n.nodeType !== 3 || !n.textContent.trim()) return; const rg = document.createRange(); rg.selectNodeContents(n); [...rg.getClientRects()].forEach((q) => lines.add(Math.round(q.top))); }); return lines.size; });
      assert.equal(one, 1, `@${sc} ${w}px: #${id} is on one line`);
    }
    const a = await rect(page, '#sfReveal'), b = await rect(page, '#sfExport');
    if (Math.abs(a.top - b.top) < 1) assert.ok(Math.abs(a.height - b.height) < 1, 'side by side, the same height');
    else assert.ok(Math.abs(a.width - b.width) < 1 && b.top > a.bottom, 'stacked, both full width');
    if (sc === 1) assert.ok(Math.abs(a.top - b.top) < 1, 'side by side at the default size');
    if (sc !== 1 && w === 375) await shot(page, 'g1-13-' + sc);
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});
