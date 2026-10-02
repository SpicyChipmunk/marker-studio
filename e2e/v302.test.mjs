// v302 (polish): even rows of choices in the guide, Codes off with nothing to show, and a pointer from a section's
// box to the section.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, sampleGuide, idle } from './helpers.mjs';

before(setup);
after(teardown);

const rect = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return e ? e.getBoundingClientRect().toJSON() : null; }, sel);
const boxes = (page, sel) => page.$$eval(sel, (b) => b.filter((x) => x.offsetParent).map((x) => x.getBoundingClientRect().toJSON()));
const even = (bs) => Math.max(...bs.map((b) => b.width)) - Math.min(...bs.map((b) => b.width)) < 3;
const rows = (bs) => new Set(bs.map((b) => Math.round(b.top))).size;

test('Colours from is a row across the controls, as Temperature is: even on an iPad, filling the row on a phone', async () => {
  for (const [w, h] of [[820, 1180], [390, 844]]) {
    const { page, errors, ctx } = await openApp({ width: w, height: h });
    await sampleGuide(page);
    await page.click('.sftabbtn[data-t="colours"]'); await idle(page);
    const src = await boxes(page, '#sfSrc button'), pal = await rect(page, '#sfPal');
    assert.equal(src.length, 3);
    assert.equal(rows(src), 1, w + ': one row');
    // (even where there's room; on a phone each as wide as its words need, filling the row)
    if (w > 700) assert.ok(even(src), w + ': even ' + src.map((b) => b.width));
    assert.ok(Math.abs(src[0].left - pal.left) < 2 && Math.abs(src[2].right - pal.right) < 2, w + ': as wide as Temperature');
    assert.ok(await page.$$eval('#sfSrc button', (b) => b.every((x) => x.scrollWidth <= x.clientWidth + 1)), 'labels fit');
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});

test('Colour along: an open marker’s actions are even — on a phone two on a row and the third across under them', async () => {
  for (const [w, h, n] of [[1180, 820, 1], [390, 844, 2]]) {
    const { page, errors, ctx } = await openApp({ width: w, height: h });
    await sampleGuide(page);
    await page.click('#sfColor'); await idle(page);
    await page.locator('#sfAlist .sfarow .sfah').nth(1).click(); await idle(page);
    const bs = await boxes(page, '#sfAlist .sfacts button');
    assert.ok(bs.length >= 3, bs.length + ' actions');
    assert.equal(rows(bs), n, w + ': rows');
    const first = bs.filter((b) => Math.round(b.top) === Math.round(bs[0].top));
    assert.ok(even(first), w + ': even ' + first.map((b) => b.width));
    if (n === 2) {
      const last = bs[bs.length - 1];
      assert.ok(Math.abs(last.left - first[0].left) < 2 && Math.abs(last.right - first[first.length - 1].right) < 2, 'the third across under them');
    }
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});

test('Codes is off on a finished page in Colour along (no codes to show), and back once a section is unticked', async () => {
  const { page, errors } = await openApp({ width: 1180, height: 820 });
  await sampleGuide(page);
  await page.click('#sfColor'); await idle(page);
  assert.equal(await page.isDisabled('#sfCodes'), false);
  await page.evaluate(() => { const t = __mstest; t.assignData.order.forEach((l) => { t.colored[l] = 1; }); t.guideDirty = true; t.renderGuide(); t.checkComplete(); t.updateProgress && t.updateProgress(); });
  await idle(page);
  assert.equal(await page.isDisabled('#sfCodes'), true, 'off: nothing to show');
  assert.equal(await page.getAttribute('#sfCodes', 'aria-pressed'), 'false', 'and not pressed, for a screen reader');
  assert.match(await page.getAttribute('#sfCodes', 'title'), /Every section is coloured/);
  await page.evaluate(() => { const t = __mstest; t.colored[t.assignData.order[0]] = 0; t.guideDirty = true; t.renderGuide(); t.updateProgress && t.updateProgress(); });
  await idle(page);
  assert.equal(await page.isDisabled('#sfCodes'), false, 'back with a section to colour');
  assert.equal(await page.getAttribute('#sfCodes', 'aria-pressed'), 'true');
  assert.deepEqual(errors, []);
});

test('a tapped section’s box points to it: the pointer under the box (or over it) at the section’s label', async () => {
  for (const [w, h] of [[1180, 820], [390, 844]]) {
    const { page, errors, ctx } = await openApp({ width: w, height: h });
    await sampleGuide(page);
    await page.click('.sftabbtn[data-t="pattern"]'); await page.evaluate(() => scrollTo(0, 0)); await idle(page);
    const p = await page.evaluate(() => { const t = __mstest, l = t.assignData.order.slice().sort((a, b) => t.comps[b].area - t.comps[a].area)[1], c = document.getElementById('sfCanvas'), r = c.getBoundingClientRect(), q = t.labelPos(l); return { x: r.left + (q.x / c.width) * r.width, y: r.top + (q.y / c.height) * r.height }; });
    await page.mouse.click(p.x, p.y); await idle(page);
    const tip = await rect(page, '.sftip'), ptr = await page.$eval('.sftip', (d) => { const a = getComputedStyle(d, '::after'); return { content: a.content, x: parseFloat(getComputedStyle(d).getPropertyValue('--tipx')), dn: d.classList.contains('sftipdn') }; });
    assert.notEqual(ptr.content, 'none', 'a pointer');
    // over the label's x (or as near as the box's rounded corners allow), on the side towards it
    const want = Math.max(14, Math.min(tip.width - 14, p.x - tip.left));
    assert.ok(Math.abs(ptr.x - want) < 2, w + ': at the label: ' + JSON.stringify([tip, ptr, p]));
    if (tip.bottom <= p.y + 1) assert.equal(ptr.dn, false, 'the box above the section: the pointer under it');
    else if (tip.top >= p.y - 1) assert.equal(ptr.dn, true, 'the box below: the pointer over it');
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});
