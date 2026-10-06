// v303: a small picture (a page downloaded at 400-800 pixels) is enlarged before its sections are found, and the guide
// remembers it; the sample and big photos are left as they are. Polish: the Library's two-line meta, a marker's brand
// line across the card, the picture still between Plan and Colour along, and a palette's codes within their colours.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, welcome, sampleGuide, saveGuide, letterGuide, idle } from './helpers.mjs';

before(setup);
after(teardown);

// a page downloaded small: rings 1.2 pixels wide, 2.8 apart, drawn smoothly on a 400 x 300 picture (they run together
// at that size), and a box round them
async function smallPage(page) {
  const b64 = await page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 400; c.height = 300;
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 400, 300);
    g.strokeStyle = '#111'; g.lineWidth = 1.2;
    for (let r = 3; r < 120; r += 2.8) { g.beginPath(); g.arc(200, 150, r, 0, 6.2832); g.stroke(); }
    g.lineWidth = 2; g.strokeRect(20, 10, 360, 280);
    return c.toDataURL('image/png').split(',')[1];
  });
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.evaluate(() => SF.pickPhoto())]);
  await fc.setFiles({ name: 'page.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
  await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 60000 }); await idle(page);
}
const info = (page) => page.evaluate(() => { const t = __mstest; return { W: t.W, H: t.H, k: t.srcK, n: t.countedList().length, src: t.srcSize }; });

test('a small download is enlarged to 1600 pixels before its sections are found; saved and opened again it keeps them', async () => {
  const { page, errors } = await openApp({ width: 1180, height: 820 });
  await welcome(page, 'look'); await idle(page);
  await smallPage(page);
  const a = await info(page);
  assert.deepEqual(a.src, [400, 300], 'the picture is kept at its own size');
  assert.deepEqual([a.W, a.H], [1600, 1200], 'its sections are found on it enlarged');
  assert.equal(a.k, 4);
  // a section between each two rings (41 of them), the ones in the middle too small to colour left out
  assert.ok(a.n >= 30, 'the rings come apart: ' + a.n);
  await page.click('#sfBuild');
  await page.waitForFunction(() => __mstest.assignData && __mstest.sfmode === 'guide', null, { timeout: 60000 }); await idle(page);
  const built = await page.evaluate(() => __mstest.assignData.order.length);
  await saveGuide(page);
  const id = await page.evaluate(() => state.saved.find((s) => s.type === 'guide').id);
  // something else open, then the guide again from the Library
  await page.evaluate(() => SF.openSample ? SF.openSample() : document.getElementById('sfSample').click());
  await page.waitForFunction(() => __mstest.srcK === 1 && __mstest.W === 568, null, { timeout: 30000 }); await idle(page);
  await page.evaluate(() => openLibrary()); await idle(page);
  await page.click(`#savedList .srow[data-id="${id}"] .smeta`);
  await page.waitForFunction(() => __mstest.W === 1600 && __mstest.assignData, null, { timeout: 30000 }); await idle(page);
  const b = await info(page);
  assert.equal(b.k, 4, 'Min section size still measured on the picture as it came');
  assert.equal(await page.evaluate(() => __mstest.assignData.order.length), built, 'the same sections');
  assert.deepEqual(errors, []);
});

test('the sample and a photo the size of a page photo are not enlarged; a smaller page photo is', async () => {
  const { page, errors } = await openApp({ width: 1180, height: 820 });
  await sampleGuide(page);
  const s = await info(page);
  assert.deepEqual([s.W, s.H, s.k], [568, 1500, 1], 'the sample as it is (166 sections of its own)');
  // e2e/fixtures/letter-page.png, 850 x 1100: enlarged to 1600 tall
  await letterGuide(page);
  const l = await info(page);
  assert.deepEqual([l.W, l.H], [1236, 1600]);
  assert.ok(Math.abs(l.k - 1600 / 1100) < 0.01, 'k ' + l.k);
  assert.deepEqual(errors, []);
});

test('the Library: what an item is on one line, how far and when on the next, the dot between them for a screen reader', async () => {
  for (const [w, h] of [[1180, 820], [390, 844]]) {
    const { page, errors, ctx } = await openApp({ width: w, height: h });
    await sampleGuide(page); await saveGuide(page);
    await page.evaluate(() => openLibrary()); await idle(page);
    const m = await page.$eval('#savedList .stile .smeta', (e) => {
      const sp = [...e.querySelectorAll(':scope > span:not(.smsep)')].map((s) => Math.round(s.getBoundingClientRect().top));
      return { text: e.textContent, lines: [...new Set(sp)].length, first: e.querySelector('span').textContent };
    });
    assert.match(m.text, /^Guide · 16 markers · .+ · today$/, 'read as one line');
    assert.equal(m.lines, 2, w + ': two lines');
    assert.equal(m.first, 'Guide');
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});

test('a marker’s brand line ("Ohuhu · Yellow-Red / Orange — was YR4") is one line on a phone, the hex beside the last line', async () => {
  const { page, errors } = await openApp({ width: 390, height: 844 });
  await welcome(page, 'look'); await idle(page);
  await page.click('#mCollection'); await page.evaluate(() => setMode('random')); await idle(page);
  await page.click('#draw'); await idle(page);
  await page.evaluate(() => showColor(COLORS.findIndex((c) => c.code === 'YR07' && c.brand === 'Ohuhu'), false)); await idle(page);
  const r = await page.evaluate(() => { const q = (s) => document.querySelector('.readout ' + s).getBoundingClientRect(); const f = q('.fam'); return { fam: f.height, lh: parseFloat(getComputedStyle(document.querySelector('.readout .fam')).lineHeight) || 0, ts: q('.ts'), hex: q('.hex') }; });
  assert.ok(r.fam < 24, 'one line: ' + r.fam);
  assert.ok(Math.abs(r.ts.bottom - r.hex.bottom) < 3, 'the hex beside the last line');
  assert.deepEqual(errors, []);
});

test('the picture stays where it is between Plan and Colour along on an iPad held sideways', async () => {
  for (const h of [820, 740]) {
    const { page, errors, ctx } = await openApp({ width: 1180, height: h });
    await sampleGuide(page); await page.evaluate(() => scrollTo(0, 0)); await idle(page);
    const at = () => page.$eval('#sfCanvas', (c) => { const r = c.getBoundingClientRect(); return [r.left, r.width]; });
    const a = await at();
    await page.click('#sfColor'); await page.evaluate(() => scrollTo(0, 0)); await idle(page);
    const b = await at();
    assert.ok(Math.abs(a[0] - b[0]) < 0.6 && Math.abs(a[1] - b[1]) < 0.6, h + ': ' + a + ' / ' + b);
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});

test('a palette’s codes stay within their colours, 8 of them on a phone', async () => {
  const { page, errors } = await openApp({ width: 390, height: 844 });
  await welcome(page, 'look'); await idle(page);
  await page.click('#mPalette'); await page.click('#segs [data-n="8"]'); await page.click('#draw'); await idle(page);
  const r = await page.$$eval('.band', (bs) => bs.map((b) => { const c = b.querySelector('.bcode'), br = b.getBoundingClientRect(), cr = c.getBoundingClientRect(); return { t: c.textContent, room: br.width - cr.width, fs: parseFloat(getComputedStyle(c).fontSize) }; }));
  assert.equal(r.length, 8);
  for (const x of r) assert.ok(x.room >= 4, x.t + ' fits, room ' + x.room);
  assert.ok(r[0].fs >= 10, 'readable: ' + r[0].fs);
  assert.deepEqual(errors, []);
});

test('focus mode: Colours open frames the section above the sheet, the picture its own size; closed any way, framed again', async () => {
  for (const [w, h] of [[1180, 820], [390, 844]]) {
    const { page, errors, ctx } = await openApp({ width: w, height: h });
    await sampleGuide(page);
    await page.click('#sfColor'); await idle(page);
    await page.locator('#sfAlist .sfarow .sfah').nth(1).click(); await idle(page);
    await page.click('#sfFocus'); await idle(page);
    const size = () => page.$eval('#sfCanvas', (c) => [c.offsetWidth, c.offsetHeight]);
    const sec = () => page.evaluate(() => { const t = __mstest, l = t.focusCur(), c = document.getElementById('sfCanvas'), r = c.getBoundingClientRect(), q = t.labelPos(l); return r.top + (q.y / c.height) * r.height; });
    const s0 = await size();
    await page.click('#sfFocCols'); await idle(page); await page.waitForTimeout(450);
    const top = await page.$eval('#sfFocSheet', (e) => e.getBoundingClientRect().top);
    assert.ok(await sec() < top - 8, w + ': the section above the sheet');
    assert.deepEqual(await size(), s0, 'the picture keeps its size');
    // closed by a tap on the picture: the section in the middle of the whole room again
    await page.mouse.click(w / 2, 120); await idle(page); await page.waitForTimeout(450);
    assert.equal(await page.isVisible('#sfFocSheet'), false);
    const g = await page.evaluate(() => { const v = document.getElementById('sfView').getBoundingClientRect(), b = document.querySelector('.sffocbar').getBoundingClientRect(), f = document.querySelector('.sffocbot').getBoundingClientRect(); return (b.bottom + f.top) / 2; });
    assert.ok(Math.abs(await sec() - g) < h * 0.2, w + ': framed in the whole room: ' + (await sec()) + ' / ' + g);
    assert.deepEqual(await size(), s0);
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});

test('Markers › All: each family brand by brand, by code within a brand (Ohuhu’s R12 and R14 with the other Ohuhu reds)', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await welcome(page, 'look'); await idle(page);
  await page.click('#mCollection'); await page.click('#ownView [data-v="all"]'); await idle(page);
  const red = await page.evaluate(() => { const g = [...document.querySelectorAll('.rgroup')].find((x) => /^Red\b/.test(x.querySelector('.rghead').textContent.trim())); return [...g.querySelectorAll('.cell, [data-i]')].map((c) => +c.dataset.i).filter((i) => i >= 0).map((i) => COLORS[i].brand + ' ' + COLORS[i].code); });
  const firstCopic = red.findIndex((s) => s.startsWith('Copic'));
  assert.ok(firstCopic > 0, red.slice(0, 5).join());
  assert.ok(red.slice(firstCopic).every((s) => s.startsWith('Copic')), 'no Ohuhu after the Copic markers: ' + red.slice(-4).join());
  const oh = red.slice(0, firstCopic).map((s) => s.slice(6));
  assert.deepEqual(oh, oh.slice().sort(), 'Ohuhu by code');
  assert.ok(oh.includes('R12') && oh.includes('R14'));
  assert.deepEqual(errors, []);
});

test('Colour along, a finished page: a colour with one section says "Coloured ✓", not "All 1 coloured"', async () => {
  const { page, errors } = await openApp({ width: 1180, height: 820 });
  await sampleGuide(page);
  await page.click('#sfColor'); await idle(page);
  await page.evaluate(() => { const t = __mstest; t.assignData.order.forEach((l) => { t.colored[l] = 1; }); t.guideDirty = true; t.renderGuide(); t.checkComplete(); t.updateProgress && t.updateProgress(); });
  await idle(page);
  // (any marker with exactly one section: the sample used YG211 for one until v308's Include defaults changed its colours)
  const one = await page.evaluate(() => { const t = __mstest, n = {}; t.assignData.order.forEach((l) => { const k = t.assignData.assign[l].code; n[k] = (n[k] || 0) + 1; }); return Object.keys(n).filter((k) => n[k] === 1); });
  assert.ok(one.length, 'the sample has a marker with one section');
  const rows = await page.$$eval('#sfAlist .sfarow', (rs) => rs.map((r) => r.textContent.replace(/\s+/g, ' ')));
  const yg = rows.find((t) => one.some((k) => new RegExp('\\b' + k + '\\b').test(t)));
  assert.ok(yg, 'its row: ' + one.join(' '));
  assert.match(yg, /Coloured ✓/);
  assert.doesNotMatch(rows.join('|'), /All 1 coloured/);
  assert.deepEqual(errors, []);
});
