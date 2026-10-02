// v300 (polish): Home on an iPad is two columns in every state — with no guide in progress, a start card in the
// Continue card's place — and guides' pictures on Home show the whole page. Until there's a guide of one's own, the
// start cards (Home's and the Guide tab's) show the sample page and its guide, tapped for the sample; then just words.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { setup, teardown, openApp, welcome, sampleGuide, saveGuide, letterGuide, openMenu, idle, ROOT } from './helpers.mjs';

before(setup);
after(teardown);

const rect = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return e ? e.getBoundingClientRect().toJSON() : null; }, sel);
// a picture inside its box, whole (not cut off at the top or bottom)
const whole = (page, sel) => page.evaluate((s) => [...document.querySelectorAll(s)].map((i) => { const b = i.parentElement.getBoundingClientRect(), r = i.getBoundingClientRect(); return i.complete && r.height > 20 && r.top >= b.top - 1 && r.bottom <= b.bottom + 1 && r.left >= b.left - 1 && r.right <= b.right + 1; }), sel);

test('iPad Home with no guide in progress: the start card — Choose a photo opens the picker in the tap, or try the sample', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await welcome(page, 'look'); await idle(page);
  assert.equal(await page.isVisible('#homeCont .hcstart'), true);
  assert.equal(await page.isVisible('#homeNew'), false, 'the card is New colouring guide');
  // the two columns start level, and Home's edges are the menu's (tour review)
  const sc = await rect(page, '#homeCont .hcstart'), mc = await rect(page, '.homegrid .homecard'), mn = await rect(page, '.wrap > .modes'), hs = await rect(page, '.homeside');
  assert.ok(Math.abs(sc.top - mc.top) < 2, 'level: ' + [sc.top, mc.top]);
  assert.ok(Math.abs(sc.left - mn.left) < 2 && Math.abs(hs.right - mn.right) < 2, 'the menu’s edges: ' + JSON.stringify([sc.left, hs.right, mn.left, mn.right]));
  // no guides yet: the sample page and its guide, whole
  await page.waitForFunction(() => [...document.querySelectorAll('#homeCont .hcba img')].every((i) => i.complete));
  assert.deepEqual(await whole(page, '#homeCont .hcba img'), [true, true]);
  // its buttons are 44px tall
  for (const s of ['[data-start="photo"]', '.hcalt[data-start="sample"]']) assert.ok((await rect(page, '#homeCont ' + s)).height >= 44, s);
  const [fc] = await Promise.all([page.waitForEvent('filechooser', { timeout: 5000 }), page.click('#homeCont [data-start="photo"]')]);
  assert.ok(fc, 'the photo picker');
  await page.click('#homeCont .hcalt[data-start="sample"]');
  await page.waitForFunction(() => window.__mstest && __mstest.assignData, null, { timeout: 30000 });
  assert.equal(await page.evaluate(() => state.mode), 'sections');
  assert.deepEqual(errors, []);
});

test('the start cards’ picture of the sample, until there’s a guide: tapped, it opens the sample; then just the words', async () => {
  for (const [w, h] of [[820, 1100], [390, 844]]) {
    const { page, errors } = await openApp({ width: w, height: h });
    await welcome(page, 'look'); await idle(page);
    if (w > 700) {
      // Home's picture is a button for the sample
      await page.click('#homeCont button.hcpic');
      await page.waitForFunction(() => window.__mstest && __mstest.assignData, null, { timeout: 30000 });
      await page.evaluate(() => SF.showHome());
    } else await page.click('#mSections');
    await idle(page);
    // the Guide tab's start card: the picture beside the words on an iPad, above them on a phone
    assert.equal(await page.isVisible('#sfStPic'), true, 'the picture ' + w);
    await page.waitForFunction(() => [...document.querySelectorAll('#sfStPic img')].every((i) => i.complete));
    assert.deepEqual(await whole(page, '#sfStPic img'), [true, true]);
    const pic = await rect(page, '#sfStPic'), hd = await rect(page, '#sfStart h2');
    if (w > 700) assert.ok(pic.right <= hd.left && pic.height >= 300, 'beside: ' + JSON.stringify([pic, hd]));
    else assert.ok(pic.bottom <= hd.top && Math.abs(pic.width - (await rect(page, '#sfStart')).width) < 4, 'above');
    // its buttons: Choose a photo the whole width, all 44px
    const pk = await rect(page, '#sfPick'), sm = await rect(page, '#sfSample');
    assert.ok(sm.top >= pk.bottom && pk.height >= 44 && sm.height >= 44, JSON.stringify([pk, sm]));
    if (w < 700) {
      await page.click('#sfStPic');
      await page.waitForFunction(() => window.__mstest && __mstest.assignData, null, { timeout: 30000 });
    }
    // a guide of one's own (the sample, saved): just the words, on both cards
    await page.evaluate(() => __mstest.saveNow()); await idle(page, 600);
    await page.evaluate(() => SF.showHome()); await idle(page);
    assert.equal(await page.isVisible('#sfStPic'), false, 'no picture once there is a guide');
    assert.equal(await page.$$eval('#sfStPic img', (a) => a.length), 0, 'and not kept');
    // ...and back on the Guide tab when that guide is deleted from the Library (it's only on Home that a redraw ran)
    await page.evaluate(() => { SF.showHome(); libDelete(state.saved.find((s) => s.type === 'guide').id); }); await idle(page);
    assert.equal(await page.isVisible('#sfStPic img'), true, 'the picture back on the Guide tab');
    // Undo puts the guide back: words only again
    await page.click('#toastAct'); await idle(page);
    assert.equal(await page.isVisible('#sfStPic'), false, 'Undo');
    if (w > 700) {
      await page.click('#mHome'); await idle(page);
      assert.equal(await page.isVisible('#homeCont .hcstart.compact'), true);
      assert.equal(await page.$('#homeCont .hcpic'), null);
      // ...back if every guide is deleted
      await page.evaluate(() => { state.saved = state.saved.filter((s) => s.type !== 'guide'); renderRecent(); });
      assert.equal(await page.isVisible('#homeCont .hcba'), true);
    }
    assert.deepEqual(errors, []);
  }
});

test('Home’s guide pictures show the whole page: the Continue card and Your guides', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page); await saveGuide(page);
  await page.evaluate(() => { const t = __mstest; t.assignData.order.slice(0, 20).forEach((l) => { t.colored[l] = 1; }); t.guideDirty = true; t.renderGuide(); return t.saveNow(); });
  await page.click('#mHome'); await idle(page);
  await page.waitForSelector('#homeCont .hccard[data-cont] img');
  // (polled: a picture can be swapped for a sharper one just after it first loads)
  const wholeNow = (sel) => page.waitForFunction((s) => { const a = [...document.querySelectorAll(s)]; return a.length && a.every((i) => { const b = i.parentElement.getBoundingClientRect(), r = i.getBoundingClientRect(); return i.complete && r.height > 20 && r.top >= b.top - 1 && r.bottom <= b.bottom + 1 && r.left >= b.left - 1 && r.right <= b.right + 1; }); }, sel, { timeout: 10000 }).then(() => true, () => false);
  assert.equal(await wholeNow('#homeCont .hcpic img'), true, 'the Continue card');
  // finished: no guide in progress, and it's under Your guides
  await page.click('#mSections'); await idle(page);
  await page.evaluate(() => { const t = __mstest; t.assignData.order.forEach((l) => { t.colored[l] = 1; }); t.guideDirty = true; t.renderGuide(); return t.saveNow(); });
  await page.click('#mHome'); await idle(page);
  await page.waitForSelector('#sfRecent .sfRecThumb');
  assert.equal(await wholeNow('#sfRecent .sfRecThumb'), true, 'Your guides');
  // Your guides lines up with the columns above it
  const a = await rect(page, '#homeCont'), b = await rect(page, '#sfRecent');
  assert.ok(Math.abs(a.left - b.left) < 6, JSON.stringify([a.left, b.left]));
  assert.deepEqual(errors, []);
});

test('Palette on an iPad held sideways: the settings beside the palette, Generate on the first screen; upright, the sizes on one row', async () => {
  const { page, errors } = await openApp({ width: 1180, height: 740 });
  await welcome(page, 'look'); await idle(page);
  await page.click('#mPalette'); await page.click('#draw'); await idle(page, 1300);
  await page.evaluate(() => scrollTo(0, 0));
  const h = await rect(page, '#harmWrap'), p = await rect(page, '#palette'), d = await rect(page, '#draw');
  assert.ok(h.right <= p.left && Math.abs(h.top - p.top) < 30, 'side by side: ' + JSON.stringify([h, p]));
  assert.ok(d.bottom <= 740, 'Generate on the first screen: ' + d.bottom);
  // Triadic's 8 sizes on one row in the column (they had made a 4×2 block); Custom's, more than 9, in two
  const rowsOf = () => page.$$eval('#segs button', (bs) => new Set(bs.filter((b) => b.offsetParent).map((b) => Math.round(b.getBoundingClientRect().top))).size);
  await page.evaluate(() => setHarmony('triadic')); await idle(page);
  assert.equal(await rowsOf(), 1, 'Triadic');
  // 10 colours are tiles: the card as tall as they are, no empty space under them
  await page.click('#segs [data-n="10"]'); await page.click('#draw'); await idle(page, 1300);
  const pg = await rect(page, '#palette'), lastTile = await page.$$eval('#palette .band', (b) => Math.max(...b.map((x) => x.getBoundingClientRect().bottom)));
  assert.ok(pg.bottom - lastTile < 12, 'tiles fill the card: ' + [pg.bottom, lastTile]);
  await page.evaluate(() => setHarmony('custom')); await idle(page);
  assert.equal(await rowsOf(), 2, 'Custom');
  await page.evaluate(() => setHarmony('complementary')); await idle(page);
  // Filters with the settings, on the first screen; open, its choices in that column
  const fb = await rect(page, '#filterBar'), hw = await rect(page, '#harmWrap');
  assert.ok(Math.abs(fb.left - hw.left) < 4 && fb.right <= p.left && fb.bottom <= 740, 'Filters with the settings: ' + JSON.stringify(fb));
  await page.click('#filterBar'); await idle(page);
  const fl = await rect(page, '#filters');
  assert.ok(fl.right <= p.left + 1 && fl.height > 100, 'the choices in the column: ' + JSON.stringify(fl));
  await page.click('#filterBar'); await idle(page);
  // upright: one column, the sizes on one row
  await page.setViewportSize({ width: 820, height: 1100 }); await idle(page);
  assert.equal(await page.evaluate(() => document.getElementById('filterBar').previousElementSibling.id), 'trackWrap', 'Filters back under the palette');
  const h2 = await rect(page, '#harmWrap'), p2 = await rect(page, '#palette');
  assert.ok(p2.top > h2.bottom, 'one column');
  const tops = await page.$$eval('#segs button', (bs) => [...new Set(bs.filter((b) => b.offsetParent).map((b) => Math.round(b.getBoundingClientRect().top)))]);
  assert.equal(tops.length, 1, 'one row');
  // sideways again, then Markers and Random: Filters where they always were there
  await page.setViewportSize({ width: 1180, height: 740 }); await idle(page);
  assert.equal(await page.evaluate(() => document.getElementById('filterBar').parentElement.classList.contains('palset')), true);
  await page.click('#mCollection'); await idle(page);
  assert.equal(await page.evaluate(() => document.getElementById('filterBar').previousElementSibling.id), 'trackWrap', 'Markers');
  await page.click('#mPalette'); await idle(page);
  await page.setViewportSize({ width: 820, height: 1100 }); await idle(page);
  // a phone: two rows for more than 7 sizes, as before
  await page.setViewportSize({ width: 390, height: 844 }); await idle(page);
  await page.evaluate(() => setHarmony('triadic')); await idle(page);
  const tops2 = await page.$$eval('#segs button', (bs) => [...new Set(bs.filter((b) => b.offsetParent).map((b) => Math.round(b.getBoundingClientRect().top)))]);
  assert.equal(tops2.length, 2);
  assert.deepEqual(errors, []);
});

test('Markers on an iPad: the search and Owned / Unowned / All / To buy on one row, then the tools; a phone as before', async () => {
  const { page, errors } = await openApp({ width: 1180, height: 740 });
  await welcome(page, 'look'); await idle(page);
  await page.click('#mCollection'); await idle(page);
  const q = await rect(page, '#q'), ov = await rect(page, '#ownView'), rnd = await rect(page, '#mkDrawBtn'), hint = await rect(page, '#ownHint'), jmp = await rect(page, '#mkJump');
  assert.ok(Math.abs(q.top + q.height / 2 - (ov.top + ov.height / 2)) < 4 && ov.left > q.right, 'one row: ' + JSON.stringify([q, ov]));
  assert.ok(rnd.top > q.bottom && hint.left > rnd.right && jmp.left > hint.left && Math.abs(jmp.top + jmp.height / 2 - (rnd.top + rnd.height / 2)) < 6, 'the tools on the next: ' + JSON.stringify([rnd, hint, jmp]));
  // the switch keeps its name for screen readers
  assert.equal(await page.evaluate(() => document.getElementById(document.getElementById('ownView').getAttribute('aria-labelledby')).textContent), 'Show');
  // the first markers within the first screen's top two thirds
  const sw = await page.evaluate(() => { const e = [...document.querySelectorAll('#findResults button, #findResults .tile')].find((b) => b.offsetParent); return e ? e.getBoundingClientRect().top : 9999; });
  assert.ok(sw < 500, 'the markers start at ' + sw);
  // To buy has no search: the switch stays where it was, at the right (it had jumped from under the finger)
  await page.click('#ownView [data-v="wish"]'); await idle(page);
  assert.ok(Math.abs((await rect(page, '#ownView')).right - ov.right) < 2, 'the switch stays put');
  assert.equal(await page.isVisible('#mkJump'), false, 'no Sets & swatch chart link in To buy: its sets aren’t there');
  await page.click('#ownView [data-v="owned"]'); await idle(page);
  // Unowned: Order on a row of its own, under the tools
  await page.click('#ownView [data-v="unowned"]'); await idle(page);
  const ord = await rect(page, '#gapSort'), r2 = await rect(page, '#mkDrawBtn');
  assert.ok(ord.top >= r2.bottom + 10, 'Order under, with room: ' + JSON.stringify([ord, r2]));
  // a phone: one column, as before (the search over the switch over Random)
  await page.setViewportSize({ width: 390, height: 844 }); await idle(page);
  await page.click('#ownView [data-v="owned"]'); await idle(page);
  const q2 = await rect(page, '#q'), ov2 = await rect(page, '#ownView'), rn2 = await rect(page, '#mkDrawBtn'), h2 = await rect(page, '#ownHint');
  assert.ok(ov2.top >= q2.bottom && rn2.top >= ov2.bottom && h2.top >= rn2.bottom, 'one column: ' + JSON.stringify([q2, ov2, rn2, h2]));
  // no markers yet: Add a set you own comes above the tools' row, not inside it (v300 review)
  await page.setViewportSize({ width: 1180, height: 740 });
  await page.evaluate(() => { state.owned.clear(); save(); chrome(); }); await idle(page);
  assert.equal(await page.evaluate(() => document.getElementById('presetWrap').parentElement.classList.contains('wrap')), true, 'Add a set in the page, not the row');
  const ps = await rect(page, '#presetWrap'), dr = await rect(page, '#mkDrawBtn');
  assert.ok(ps.bottom <= dr.top && ps.width > 900, 'above the row, the full width: ' + JSON.stringify([ps, dr]));
  // and Palette, Random, the Guide: no stray space from the rows
  await page.setViewportSize({ width: 1180, height: 740 });
  await page.click('#mPalette'); await idle(page);
  assert.equal(await page.evaluate(() => [...document.querySelectorAll('.mkh1, .mkh2')].map((e) => getComputedStyle(e).display).join()), 'contents,contents');
  assert.deepEqual(errors, []);
});

test('the guide card held sideways is as wide as the menu above it when the picture fits; a wide page keeps its picture', async () => {
  const { page, errors } = await openApp({ width: 1180, height: 740 });
  await sampleGuide(page); await idle(page);
  await page.evaluate(() => scrollTo(0, 0));
  const m = await rect(page, '.wrap > .modes'), c = await rect(page, '#sfWork'), ctl = await rect(page, '#sfCtl');
  // the start card too (it had kept the guide's wide page)
  await page.evaluate(() => SF.showHome()); await idle(page);
  const st = await rect(page, '#sfStart');
  assert.ok(Math.abs(st.left - m.left) < 2 && Math.abs(st.right - m.right) < 2, 'the start card: ' + JSON.stringify([m, st]));
  // its three smaller buttons even, no bigger than Choose a photo's words
  const fs = await page.$$eval('#sfPick, #sfSample, #sfLib, #sfImport', (b) => b.map((x) => [parseFloat(getComputedStyle(x).fontSize), x.getBoundingClientRect().width]));
  assert.ok(fs.slice(1).every(([f]) => f <= fs[0][0]), 'sizes: ' + fs);
  assert.ok(Math.max(...fs.slice(1).map((x) => x[1])) - Math.min(...fs.slice(1).map((x) => x[1])) < 2, 'even: ' + fs);
  await page.click('#sfSample'); await page.waitForFunction(() => __mstest.sfmode === 'guide' && document.getElementById('sfWork').offsetParent); await idle(page);
  assert.ok(Math.abs(c.left - m.left) < 2 && Math.abs(c.right - m.right) < 2, 'as wide as the menu: ' + JSON.stringify([m, c]));
  assert.ok(c.right - ctl.right < 16, 'the controls fill the card: ' + JSON.stringify([c, ctl]));
  // a Letter page too (the card had been wider than the menu for most pages); a sheet beside the picture ends at the
  // card's edge, not the screen's
  await letterGuide(page); await page.evaluate(() => scrollTo(0, 0)); await idle(page);
  const c3 = await rect(page, '#sfWork');
  assert.ok(Math.abs(c3.left - m.left) < 2 && Math.abs(c3.right - m.right) < 2, 'a Letter page: ' + JSON.stringify([m, c3]));
  await openMenu(page);
  const sh = await rect(page, '#sfSheet');
  assert.ok(await page.evaluate(() => document.getElementById('sfSheet').classList.contains('sfshside')), 'beside the picture');
  assert.ok(Math.abs(sh.right - c3.right) < 2, 'the sheet ends at the card: ' + JSON.stringify([sh, c3]));
  await page.keyboard.press('Escape'); await idle(page);
  // a landscape page on a 13-inch iPad: the picture as big as before (the card wider than the menu)
  const png = (await readFile(join(ROOT, 'e2e', 'fixtures', 'letter-page.png'))).toString('base64');
  const wide = await page.evaluate((b) => new Promise((res) => { const im = new Image(); im.onload = () => { const cv = document.createElement('canvas'); cv.width = im.height; cv.height = im.width; const x = cv.getContext('2d'); x.translate(cv.width, 0); x.rotate(Math.PI / 2); x.drawImage(im, 0, 0); res(cv.toDataURL('image/png').split(',')[1]); }; im.src = 'data:image/png;base64,' + b; }), png);
  await page.setViewportSize({ width: 1366, height: 950 }); await idle(page);
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.evaluate(() => SF.pickPhoto())]);
  await fc.setFiles({ name: 'wide.png', mimeType: 'image/png', buffer: Buffer.from(wide, 'base64') });
  await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 60000 }); await idle(page);
  await page.click('#sfBuild');
  await page.waitForFunction(() => __mstest.assignData && __mstest.sfmode === 'guide', null, { timeout: 60000 }); await idle(page);
  await page.evaluate(() => scrollTo(0, 0));
  const m2 = await rect(page, '.wrap > .modes'), c2 = await rect(page, '#sfWork'), pic = await rect(page, '#sfView'), root = await rect(page, '#sfRoot');
  assert.ok(c2.width > m2.width + 100, 'wider than the menu: ' + JSON.stringify([m2, c2]));
  assert.ok(pic.width >= (root.width - 36) * 0.58, 'the picture keeps its 60%: ' + JSON.stringify([pic, root]));
  assert.deepEqual(errors, []);
});

test('Edit sections’ tools: one even row, on a phone and an iPad', async () => {
  for (const [w, h] of [[390, 844], [1180, 740]]) {
    const { page, errors } = await openApp({ width: w, height: h });
    await sampleGuide(page);
    await page.click('#sfBack2'); await idle(page);
    const bs = await page.$$eval('#sfEdit button', (b) => b.map((x) => x.getBoundingClientRect().toJSON()));
    assert.equal(bs.length, 4);
    assert.equal(new Set(bs.map((r) => Math.round(r.top))).size, 1, 'one row');
    assert.ok(Math.max(...bs.map((r) => r.width)) - Math.min(...bs.map((r) => r.width)) < 2, 'even: ' + bs.map((r) => r.width));
    const row = await rect(page, '#sfEdit'), ctl = await rect(page, '#sfCtl');
    assert.ok(row.width > ctl.width - 40, 'the width of the controls');
    // every label whole
    assert.ok(await page.$$eval('#sfEdit button', (b) => b.every((x) => x.scrollWidth <= x.clientWidth + 1)), 'labels fit');
    assert.deepEqual(errors, []);
  }
});

test('a finished page keeps no outline from the marker row last open (after Focus mode); Page finished! reads clearly', async () => {
  const { page, errors } = await openApp({ width: 1180, height: 820 });
  await sampleGuide(page);
  await page.click('#sfColor'); await idle(page);
  await page.locator('#sfAlist .sfarow .sfah').nth(1).click(); await idle(page);
  const pic00 = await page.evaluate(() => document.getElementById('sfCanvas').getBoundingClientRect().height);
  await page.click('#sfFocus'); await idle(page);
  await page.click('#sfFDone'); await idle(page);
  const pic0 = pic00;
  await page.keyboard.press('Escape'); await idle(page);
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.sfoutline')).display), 'block', 'the open row is outlined');
  // the picture as big as before Focus mode (it was measured with the page scrolled, and came back smaller)
  const pic1 = await page.evaluate(() => document.getElementById('sfCanvas').getBoundingClientRect().height);
  assert.ok(Math.abs(pic1 - pic0) < 3, 'the picture’s size: ' + [pic0, pic1]);
  await page.evaluate(() => { const t = __mstest; t.assignData.order.forEach((l) => { t.colored[l] = 1; }); t.guideDirty = true; t.renderGuide(); t.checkComplete(); });
  await idle(page);
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.sfoutline')).display), 'none', 'no outline on the finished page');
  // dark words on the green, 4.5:1 at least
  const c = await page.evaluate(() => { const L = (r, g, b) => [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }).reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0); const p = (s) => s.match(/\d+/g).map(Number); const d = document.getElementById('sfDone'), fg = p(getComputedStyle(d).color), bg = p(getComputedStyle(document.documentElement).getPropertyValue('--ok-rgb')); const a = L(...fg), b = L(...bg); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); });
  assert.ok(c >= 4.5, 'contrast ' + c);
  assert.deepEqual(errors, []);
});

test('Share: every button has its icon, and Save image keeps it after saving', async () => {
  const { page, errors } = await openApp({ width: 390, height: 844 });
  await sampleGuide(page);
  await page.click('.sftabbtn[data-t="share"]'); await idle(page);
  for (const id of ['sfReveal', 'sfExport', 'sfPrint', 'sfPlan', 'sfAsPal', 'sfShareGuide']) assert.ok(await page.$('#' + id + ' svg.ic'), id);
  await page.click('#sfExport');
  await page.waitForFunction(() => !document.getElementById('sfExport').disabled, null, { timeout: 15000 }); await idle(page);
  assert.ok(await page.$('#sfExport svg.ic'), 'the icon back after Preparing…');
  assert.equal((await page.textContent('#sfExport')).trim(), 'Save image');
  assert.deepEqual(errors, []);
});

test('iPad sheets: Change colour as wide as the guide card, Cancel and Done sharing its width', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await page.click('.sftabbtn[data-t="pattern"]'); await page.evaluate(() => scrollTo(0, 0)); await idle(page);
  const p = await page.evaluate(() => { const t = __mstest, l = t.assignData.order.slice().sort((a, b) => t.comps[b].area - t.comps[a].area)[1], c = document.getElementById('sfCanvas'), r = c.getBoundingClientRect(), q = t.labelPos(l); return { x: r.left + (q.x / c.width) * r.width, y: r.top + (q.y / c.height) * r.height }; });
  await page.mouse.click(p.x, p.y); await idle(page);
  await page.click('.sftip [data-a="change"]'); await idle(page);
  const sh = await rect(page, '#sfSheet'), card = await rect(page, '#sfWork'), cn = await rect(page, '#sfPopCancel'), dn = await rect(page, '#sfPopConfirm'), hd = await rect(page, '#sfSheet .sfshhd');
  assert.ok(Math.abs(sh.left - card.left) < 2 && Math.abs(sh.right - card.right) < 2, 'the card’s width: ' + JSON.stringify([sh, card]));
  assert.ok(cn.left - sh.left < 20 && sh.right - dn.right < 20 && Math.abs(cn.width - dn.width) < 3, 'the buttons share the width: ' + JSON.stringify([cn, dn, sh]));
  assert.ok(hd.width > 0);
  assert.deepEqual(errors, []);
});
