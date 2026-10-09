// The Photo pattern's figures and marker count: how close each section is, graded by eye in Match's words (the
// summary, the tip on a tapped section, "Show the rough matches", "Closer with"), and the suggested marker count with
// its Use button. The marker choice itself is unit-tested (test/photo-choice.test.mjs).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, idle, sectionPoint, notOnWebKit, WK, haveSet } from './helpers.mjs';

before(setup);
after(teardown);

// the sample guide with marker set `set` (a welcome index), then the Photo pattern with a photo drawn by `code`
// (canvas drawing on g, 600 × 800)
async function photoGuide(page, set, code) {
  await haveSet(page); await page.check(`#wcSets input[data-i="${set}"]`); await page.click('#wcAdd'); await page.click('#wcSample');
  await page.waitForFunction(() => !!(window.__mstest && __mstest.assignData));
  const b64 = await page.evaluate(async (code) => {
    const c = document.createElement('canvas'); c.width = 600; c.height = 800; const g = c.getContext('2d');
    new Function('g', code)(g);
    const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
    return await new Promise((r) => { const f = new FileReader(); f.onload = () => r(f.result.split(',')[1]); f.readAsDataURL(blob); });
  }, code);
  await page.click('.sftabbtn[data-t="pattern"]');
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#sfFam [data-v="photo"]')]);
  await fc.setFiles({ name: 'ref.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
  await page.waitForFunction(() => __mstest.photoRef && !__mstest.photoChecking); await idle(page);
}

// per section: the photo colour, its marker, and how far apart they are by eye
const grades = (page) => page.evaluate(() => {
  const t = __mstest, C = t.photoColours(), a = t.assignData.assign, out = [];
  for (const k in a) {
    const l = +k, m = a[l];
    if (!C.has[l] || !m.lab || t.locks[l]) continue;
    const lab = [C.lab[l * 3], C.lab[l * 3 + 1], C.lab[l * 3 + 2]];
    out.push({ l, lab, mk: m.mkey, e: de2000(lab, m.lab), word: matchWord(de2000(lab, m.lab)).toLowerCase() });
  }
  return out;
});

test('graded by eye in Match’s words: the summary, a tapped section’s tip, and “Closer with” markers clearly closer', async () => {
  const { page, errors } = await openApp();
  // Honolulu 24 and a photo in colours it can't match well
  await photoGuide(page, 1, "const gr=g.createLinearGradient(0,0,600,800);gr.addColorStop(0,'#0bd6c8');gr.addColorStop(0.5,'#8a2be2');gr.addColorStop(1,'#39ff14');g.fillStyle=gr;g.fillRect(0,0,600,800);");
  const G = await grades(page);
  const close = G.filter((x) => x.e < 7).length, rough = G.length - close;
  assert.ok(close > 0 && rough > 0, `some of each (${close} close, ${rough} rough)`);
  const txt = await page.textContent('.sfphstat');
  assert.match(txt, new RegExp(`^${Math.round((close / G.length) * 100)}% of sections are a close match to the photo or better`));
  assert.match(txt, new RegExp(`${rough} are only a rough or loose match`));
  // the tip on the biggest sections says what Match would say for the same two colours (once lining up is done)
  if (await page.evaluate(() => __mstest.photoAlign)) { await page.click('#sfPhAlign'); await idle(page); }
  const big = await page.evaluate((ls) => ls.sort((a, b) => __mstest.comps[b].area - __mstest.comps[a].area).slice(0, 3), G.map((x) => x.l));
  for (const l of big) {
    const p = await sectionPoint(page, l);
    await page.mouse.click(p.x, p.y); await idle(page);
    assert.match(await page.textContent('.sftip .sftipsh'), new RegExp(`photo · ${G.find((x) => x.l === l).word} match`), 'section ' + l);
    await page.keyboard.press('Escape'); await idle(page);
  }
  // each "Closer with" marker is at least 2 closer by eye (Match's rule for markers to buy) than the best marker you
  // own, on some section where even that is a rough match
  const want = await page.$$eval('.sfphwant [data-wk]', (b) => b.map((x) => x.dataset.wk));
  assert.ok(want.length >= 1, 'suggests markers');
  const ok = await page.evaluate(([want, G]) => want.map((k) => {
    const i = COLORS.findIndex((_, j) => mkey(j) === k), lab = LAB[i];
    const pool = __mstest.colour.poolFor('all'), best = (x) => de2000(x.lab, __mstest.colour.nearest(x.lab, pool).lab);
    return !state.owned.has(k) && G.some((x) => { const b = Math.min(x.e, best(x)); return b >= 7 && de2000(x.lab, lab) <= b - 2; });
  }), [want, G]);
  assert.deepEqual(ok, want.map(() => true), want.join(' '));
  assert.deepEqual(errors, []);
});

test('a photo of the page coloured with 8 clearly different markers: “About 8 markers”, Use 8 gives back those 8, Undo goes back', notOnWebKit(WK.scale), async () => {
  const { page, errors } = await openApp();
  await haveSet(page); await page.check('#wcSets input[data-i="6"]'); await page.click('#wcAdd'); await page.click('#wcSample');
  await page.waitForFunction(() => !!(window.__mstest && __mstest.assignData));
  // the guide's own sections painted with 8 markers from the collection (at least 10 apart by eye, none near white)
  const { b64, truth } = await page.evaluate(async () => {
    const M = __mstest, pool = M.colour.poolFor('all').filter((m) => m.lab && m.lab[0] < 85), truth = [];
    let sd = 7; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    while (truth.length < 8) { const m = pool[Math.floor(rnd() * pool.length)]; if (!truth.some((o) => de2000(o.lab, m.lab) < 10)) truth.push(m); }
    const of = {}; M.countedList().forEach((l, i) => { of[l] = truth[i % 8]; });
    const W = M.W, H = M.H, lab = M.labels, gr = M.gray, c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'), id = g.createImageData(W, H), d = id.data;
    for (let p = 0; p < W * H; p++) {
      const m = lab[p] > 0 && of[lab[p]];
      const rgb = m ? [1, 3, 5].map((k) => parseInt(m.hex.slice(k, k + 2), 16)) : [gr[p], gr[p], gr[p]].map((v) => Math.min(255, v * 1.2));
      d[p * 4] = rgb[0]; d[p * 4 + 1] = rgb[1]; d[p * 4 + 2] = rgb[2]; d[p * 4 + 3] = 255;
    }
    g.putImageData(id, 0, 0);
    const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
    const b64 = await new Promise((r) => { const f = new FileReader(); f.onload = () => r(f.result.split(',')[1]); f.readAsDataURL(blob); });
    return { b64, truth: truth.map((m) => m.mkey).sort() };
  });
  await page.click('.sftabbtn[data-t="pattern"]');
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#sfFam [data-v="photo"]')]);
  await fc.setFiles({ name: 'page.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
  await page.waitForFunction(() => __mstest.photoRef && !__mstest.photoChecking); await idle(page);
  // exactly over the page
  await page.evaluate(() => { const M = __mstest, r = M.photoRef; M.photoXf = { cx: M.W / 2, cy: M.H / 2, sx: M.W / r.w, sy: M.H / r.h, r: 0 }; M.photoRecolour(); });
  await page.waitForFunction(() => __mstest.photoSug && !__mstest.photoSug.pending); await idle(page);
  // at 24 the guide uses just the 8 (no marker adds anything), so no suggestion; at 4 it suggests 8
  assert.equal(await page.evaluate(() => __mstest.limitN), 24);
  assert.equal((await page.textContent('#sfPhSug')).trim(), '', 'uses the 8 already');
  await page.evaluate(() => { __mstest.limitN = 4; __mstest.photoRecolour(); }); await idle(page);
  assert.equal((await page.textContent('#sfPhSug')).trim(), 'About 8 markers get as close as all your markers can. Use 8');
  await page.click('#sfPhUse'); await idle(page);
  const used = await page.evaluate(() => ({ N: __mstest.limitN, keys: [...new Set(Object.values(__mstest.assignData.assign).map((m) => m.mkey))].sort() }));
  assert.equal(used.N, 8);
  assert.deepEqual(used.keys, truth, 'the 8 markers the page was coloured with');
  assert.equal((await page.textContent('#sfPhSug')).trim(), '', 'no suggestion once it is used');
  await page.click('#sfPlanUndo'); await idle(page);
  assert.equal(await page.evaluate(() => __mstest.limitN), 4, 'Undo puts the count back');
  assert.deepEqual(errors, []);
});
