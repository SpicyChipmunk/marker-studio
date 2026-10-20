// v318.28 (Y4) layout, keyboard and screen readers: Palette's sizes and Markers' Order fit a narrow phone with larger
// text, Change colour's two choices say their words in full, the page's live regions are there before their words are
// (toasts, the search's count, the new-version banner), and the banner's ✕ leaves the keyboard on the open tab.
// Each fails on v318.27.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  setup,
  teardown,
  ENGINE,
  openApp,
  openAtScale,
  idle,
  welcome,
  sampleGuide,
  scrollTop,
  sectionPoint,
} from './helpers.mjs';

before(setup);
after(teardown);

// what runs past the column's own edge (.wrap clips sideways, so the document never scrolls: its scrollWidth can't tell)
const pastEdge = (page, sel) =>
  page.evaluate((sel) => {
    const w = document.querySelector('.wrap'),
      cs = getComputedStyle(w),
      edge = Math.min(w.getBoundingClientRect().right - parseFloat(cs.paddingRight), innerWidth);
    return [...document.querySelectorAll(sel)]
      .filter((e) => e.getClientRects().length && e.getBoundingClientRect().right > edge + 0.5)
      .map((e) => e.textContent || e.id);
  }, sel);

test('Y4 H1: Palette’s Colours sizes all on the screen at 320 wide, with 1× and 1.6× text', async () => {
  for (const s of [1, 1.6]) {
    const { page, ctx, errors } = await openAtScale(s, { width: 320, height: 568 });
    await welcome(page, 'look');
    await idle(page);
    await page.evaluate(() => setMode('palette'));
    await idle(page);
    for (const h of ['complementary', 'analogous', 'rainbow', 'custom']) {
      await page.click(`#harm [data-h="${h}"]`);
      await idle(page);
      assert.ok(
        (await page.evaluate(() => document.querySelectorAll('#segs button:not(:disabled)').length)) >= 6,
      );
      assert.deepEqual(await pastEdge(page, '#segs button:not(:disabled)'), [], `${h} at ${s}×`);
    }
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});

test('Y4 H3: Markers’ Order on the screen on a phone with larger text; as wide as before where there’s room', async () => {
  for (const [w, s] of [
    [320, 1],
    [360, 1.6],
    [820, 1],
  ]) {
    const { page, ctx, errors } = await openAtScale(s, { width: w, height: 800 });
    await welcome(page, 'look');
    await idle(page);
    await page.evaluate(() => setMode('collection'));
    await idle(page);
    await page.click('#ownView [data-v="unowned"]');
    await idle(page);
    assert.deepEqual(await pastEdge(page, '#gapSort'), [], `${w} at ${s}×`);
    if (w > 600)
      assert.ok(
        await page.evaluate(() => {
          const e = document.getElementById('gapSort');
          return e.getBoundingClientRect().width >= 17.8 * parseFloat(getComputedStyle(e).fontSize) - 0.5;
        }),
        'still 17.8em where it fits',
      );
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});

test('Y4 H5: Change colour at 320 × 568 with 1.6× text: "Only this section" and "Everywhere (n sections)" in full', async () => {
  const { page, errors } = await openAtScale(1.6, { width: 320, height: 568 });
  await sampleGuide(page);
  await idle(page);
  // a big section in view whose marker is used in more than one section
  const l = await page.evaluate(() => {
    const t = __mstest,
      c = document.getElementById('sfCanvas'),
      r = c.getBoundingClientRect(),
      n = {};
    t.assignData.order.forEach((x) => (n[t.assignData.assign[x]] = (n[t.assignData.assign[x]] || 0) + 1));
    return t.assignData.order
      .filter((x) => {
        const q = t.labelPos(x),
          y = r.top + (q.y / c.height) * r.height,
          X = r.left + (q.x / c.width) * r.width;
        return (
          n[t.assignData.assign[x]] > 1 &&
          y > r.top + 40 &&
          y < Math.min(r.bottom, innerHeight) - 60 &&
          X > r.left + 30 &&
          X < r.right - 30
        );
      })
      .sort((a, b) => t.comps[b].area - t.comps[a].area)[0];
  });
  await scrollTop(page);
  const p = await sectionPoint(page, l);
  await page.mouse.click(p.x, p.y);
  await idle(page);
  await page.click('.sftip [data-a="change"]');
  await page.waitForSelector('#sfSheet .sfpopscope', { state: 'visible' });
  await idle(page);
  const b = await page.evaluate(() =>
    [...document.querySelectorAll('#sfSheet .sfpopscope button')].map((e) => {
      const r = e.getBoundingClientRect();
      return {
        text: e.textContent,
        cut: e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1,
        in: r.left >= 0 && r.right <= innerWidth,
        tall: r.height >= 44,
      };
    }),
  );
  assert.equal(b.length, 2);
  assert.match(b[1].text, /^Everywhere \(\d+ sections\)$/);
  for (const x of b)
    assert.deepEqual({ cut: x.cut, in: x.in, tall: x.tall }, { cut: false, in: true, tall: true }, x.text);
  assert.deepEqual(errors, []);
});

// the live region's state in the accessibility tree, as a screen reader is told it (Chromium's)
const axLive = async (cdp, id) => {
  const { root } = await cdp.send('DOM.getDocument', { depth: 0 });
  const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '#' + id });
  if (!nodeId) return 'absent';
  const n = (await cdp.send('Accessibility.getPartialAXTree', { nodeId, fetchRelatives: false })).nodes[0];
  return n.ignored
    ? 'ignored'
    : (n.properties || []).find((q) => q.name === 'live')?.value?.value || 'not live';
};

test('Y4 H2: the toasts’ and the search’s live regions are in the page, empty, before their first words, and stay', async () => {
  const { page, ctx, errors } = await openApp({ width: 820, height: 1180 });
  const cdp = ENGINE === 'chromium' ? await ctx.newCDPSession(page) : null;
  // at load, before anything is said: both there, empty, at the page's top level (so nothing made inert takes them)
  assert.deepEqual(
    await page.evaluate(() =>
      ['msSay', 'msLive'].map((id) => {
        const e = document.getElementById(id);
        return (
          e && [
            e.parentElement === document.body,
            e.getAttribute('role'),
            e.getAttribute('aria-live'),
            e.textContent,
          ]
        );
      }),
    ),
    [
      [true, 'status', 'polite', ''],
      [true, 'status', 'polite', ''],
    ],
  );
  if (cdp) assert.equal(await axLive(cdp, 'msSay'), 'polite');
  await welcome(page, 'look');
  await idle(page);
  // a toast's words are said from #msSay; the toast itself isn't a second live region saying them again
  await page.evaluate(() => toast('First toast.'));
  assert.equal(await page.textContent('#msSay'), 'First toast.');
  assert.equal(await page.getAttribute('#msToast', 'aria-live'), null);
  assert.equal(await page.getAttribute('#msToast', 'role'), null);
  // once it has gone (hidden, out of the accessibility tree), #msSay is still there for the next one
  await page.waitForFunction(() => !document.getElementById('msToast').classList.contains('on'), null, {
    timeout: 8000,
  });
  await page.waitForTimeout(400);
  if (cdp) {
    assert.equal(await axLive(cdp, 'msToast'), 'ignored');
    assert.equal(await axLive(cdp, 'msSay'), 'polite');
  }
  await page.evaluate(() => toastAction('Section cleared.', 'Undo', () => {}));
  assert.match(await page.textContent('#msSay'), /^Section cleared\.\s*Undo$/);
  // the search's count: the same #msLive that was there from the start
  await page.evaluate(() => {
    window.__added = [];
    new MutationObserver((ms) =>
      ms.forEach((m) => m.addedNodes.forEach((n) => n.id && window.__added.push(n.id))),
    ).observe(document.body, { childList: true });
  });
  await page.evaluate(() => setMode('collection'));
  await idle(page);
  await page.fill('#q', 'R4');
  await page.waitForTimeout(1200);
  assert.match(await page.textContent('#msLive'), /^Matches \(\d+ markers?\)$/);
  assert.ok(!(await page.evaluate(() => window.__added)).includes('msLive'), 'not created holding its words');
  assert.deepEqual(errors, []);
});

test('Y4 H2/H4: the new-version banner is said from #msSay; its ✕ by keyboard leaves focus on the open tab', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await welcome(page, 'look');
  await idle(page);
  await page.evaluate(() => {
    navigator.serviceWorker.dispatchEvent(new Event('controllerchange'));
    navigator.serviceWorker.dispatchEvent(new Event('controllerchange'));
  });
  await page.waitForSelector('#msUpd');
  assert.equal(await page.textContent('#msSay'), 'A new version of Marker Studio is ready.');
  assert.equal(
    await page.getAttribute('#msUpd', 'role'),
    null,
    'not a live region inserted holding its words',
  );
  await page.focus('#msUpdX');
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('#msUpd').count(), 0);
  assert.equal(
    await page.evaluate(() => document.activeElement === document.querySelector('.modes button.on')),
    true,
  );
  assert.deepEqual(errors, []);
});
