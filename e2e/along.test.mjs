// Colour along: the list, ticks, codes, run low, finding a marker.
// (v320) Tests organised by feature: each block below came from the file named above it, its tests unchanged.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import {
  buildGo,
  haveSet,
  idle,
  letterGuide,
  longPress,
  menuItem,
  openApp,
  openMenu,
  pause,
  sampleGuide,
  saveGuide,
  scrollTop,
  sectionPoint,
  setup,
  teardown,
  toolStatus,
  until,
} from './helpers.mjs';

before(setup);
after(teardown);

// ---- from colour-along.test.mjs ----
// Colour along (Release 3, docs/GUIDE-LAYOUT.md #10): the marker list starts straight under the pinned picture, one
// 48px row per marker; tapping a row opens it in place (Mark all coloured ↔ Clear, Find next, ◐ Blends) and
// highlights the marker; the open row is always scrolled fully into view between the picture and the bar; markers
// finished earlier are gathered in a "Done (n)" group when Colour along is entered again. Also: Clear and
// Reset progress, press and hold on a section, the first-time instructions, finishing the page, and the wake lock.
{
  // the app with page errors and console errors collected
  async function open(opts) {
    const app = await openApp(opts);
    app.page.on('console', (m) => {
      if (m.type() === 'error') app.errors.push('console: ' + m.text());
    });
    return app;
  }
  async function along(page) {
    await sampleGuide(page);
    await idle(page);
    await page.click('#sfColor');
    await idle(page);
    await scrollTop(page);
  }
  const rows = (page) =>
    page.$$eval('#sfAlist .sfarow', (rs) =>
      rs.map((r) => ({
        k: r.dataset.k,
        open: r.classList.contains('open'),
        full: r.classList.contains('full'),
        exp: r.querySelector('.sfah').getAttribute('aria-expanded'),
        cnt: r.querySelector('.cnt').textContent,
        h: Math.round(r.querySelector('.sfah').getBoundingClientRect().height),
      })),
    );
  const clickRow = async (page, i) => {
    await page.locator('#sfAlist .sfarow .sfah').nth(i).click();
    await idle(page);
  };
  const hl = (page) => page.evaluate(() => __mstest.hlKey);
  // where the open row is, against the bottom of the pinned block and the top of the bar
  const openBox = (page) =>
    page.evaluate(() => {
      const r = document.querySelector('#sfAlist .sfarow.open').getBoundingClientRect(),
        bar = document.querySelector('#sfRoot .sfbar').getBoundingClientRect();
      const side = document.getElementById('sfWork').classList.contains('sfside'),
        pin = side ? 0 : document.getElementById('sfView').getBoundingClientRect().bottom;
      return { top: r.top, bottom: r.bottom, pin, bar: bar.top };
    });
  function assertInView(b, what) {
    assert.ok(
      b.top >= b.pin - 1,
      `${what}: the open row's top (${b.top}) is below the pinned block (${b.pin})`,
    );
    assert.ok(
      b.bottom <= b.bar + 1,
      `${what}: the open row's bottom (${b.bottom}) is above the bar (${b.bar})`,
    );
  }
  const secsOf = (page, k) =>
    page.evaluate(
      (k) => __mstest.assignData.order.filter((l) => __mstest.assignData.assign[l].mkey === k),
      k,
    );
  // a marker's biggest section (easy to hit on a small picture)
  const bigOf = (page, k) =>
    page.evaluate(
      (k) =>
        __mstest.assignData.order
          .filter((l) => __mstest.assignData.assign[l].mkey === k)
          .sort((a, b) => __mstest.comps[b].area - __mstest.comps[a].area)[0],
      k,
    );
  // scroll so the picture sits pinned at the top (the list scrolls under it)
  const pinPic = (page) =>
    page.evaluate(
      () =>
        new Promise((res) => {
          const v = document.getElementById('sfView'),
            side = document.getElementById('sfWork').classList.contains('sfside');
          scrollTo(0, Math.round(scrollY + v.getBoundingClientRect().top - (side ? 8 : 0)));
          requestAnimationFrame(() => requestAnimationFrame(res));
        }),
    );
  async function hold(page, l) {
    const p = await sectionPoint(page, l);
    await longPress(page, p.x, p.y);
    await idle(page);
  }
  // ---- From the fourth review (data safety) ----
  const doneN = (page) => page.evaluate(() => __mstest.colored.reduce((a, b) => a + b, 0));
  // ---- From the fourth review (v263 guide screen) ----
  const bigSections = (page, n = 6) =>
    page.evaluate((n) => {
      const t = __mstest;
      return t.assignData.order
        .slice()
        .sort((a, b) => t.comps[b].area - t.comps[a].area)
        .slice(0, n);
    }, n);
  // ---- From the fifth review (guide screen) ----
  const SHOTS = process.env.SHOTS || '';
  const shot = (page, name) => (SHOTS ? page.screenshot({ path: SHOTS + '/' + name + '.png' }) : null);
  const rect = (page, sel) =>
    page.evaluate((s) => {
      const e = document.querySelector(s);
      return e ? e.getBoundingClientRect().toJSON() : null;
    }, sel);
  const pinH = (page) =>
    page.evaluate(
      () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--pinH')) || 0,
    );
  const toastOn = (page) =>
    page.evaluate(() => {
      const t = document.getElementById('msToast');
      return !!(t && t.classList.contains('on'));
    });
  // ---- From v267 ----
  // V267_SHOTS=<dir> also saves the screenshots looked at by hand
  const SHOTS_V267 = process.env.V267_SHOTS || '';
  const snap = async (page, name) => {
    if (SHOTS_V267) {
      await mkdir(SHOTS_V267, { recursive: true });
      await page.screenshot({ path: SHOTS_V267 + '/' + name + '.png' });
    }
  };
  const toastOnText = (page) =>
    page.evaluate(() => {
      const t = document.getElementById('msToast');
      return t && t.classList.contains('on') ? t.textContent : '';
    });
  const ticks = (page) =>
    page.evaluate(() => {
      const c = __mstest.colored;
      let n = 0;
      for (let l = 1; l < c.length; l++) if (c[l]) n++;
      return n;
    });
  test('the list starts right under the pinned block: an ⓘ line, then one 48px row per marker, and nothing else', async () => {
    const { page, errors } = await open();
    await along(page);
    const g = await page.evaluate(() => {
      const pane = document.querySelector('#sfCtl .sfpane'),
        vis = [...pane.children].filter((e) => e.getClientRects().length);
      const tools = document.getElementById('sfZoomCtl').getBoundingClientRect(),
        info = document.querySelector('#sfCtl .sfinfo'),
        list = document.getElementById('sfAlist');
      return {
        first: vis[0] && vis[0].className,
        gap: Math.round(info.getBoundingClientRect().top - tools.bottom),
        infoOpen: info.classList.contains('open'),
        text: info.textContent,
        folded: !document.getElementById('sfFind').getClientRects().length,
        listGap: Math.round(
          list.getBoundingClientRect().top -
            document.getElementById('sfAlSort').getBoundingClientRect().bottom,
        ),
        sortGap: Math.round(
          document.getElementById('sfAlSort').getBoundingClientRect().top -
            info.getBoundingClientRect().bottom,
        ),
        inputs: [...document.querySelectorAll('#sfCtl input')].map((i) => i.id),
        kids: vis.map((e) => e.id || e.className.split(' ')[0]),
      };
    });
    assert.match(g.first, /sfinfo/, 'the ⓘ line comes first');
    assert.ok(g.gap >= 0 && g.gap <= 16, `straight under the tool row (${g.gap}px)`);
    assert.ok(
      g.infoOpen &&
        /^iTap a marker to see its sections, then tap each section on the picture as you colour it\. More$/.test(
          g.text.trim(),
        ),
      'the first line of the instructions and More, the first time (v316: More ends the sentence)',
    );
    // (v305: the list's order, Lightest first · Rainbow · By brand, between them)
    assert.ok(g.sortGap >= 0 && g.sortGap <= 16, `the list's order right after it (${g.sortGap}px)`);
    // (v306: the code box, "Marker in your hand? Type its code", folds behind ⌕ at the end of the order row on a phone,
    // so the list follows the order row; e2e/v306-smalls opens it)
    assert.ok(g.folded, 'the code box folded on a phone');
    assert.ok(g.listGap >= 0 && g.listGap <= 16, `the list right after it (${g.listGap}px)`);
    assert.deepEqual(g.inputs, ['sfFindIn'], 'no name box: only the code box');
    assert.deepEqual(
      g.kids,
      ['sfAlHint', 'sfAlSort', 'sfAlist'],
      'only the ⓘ line (the first time: its first line and More), the list’s order (with ⌕ for the code box) and the list: no progress bar or Mark all above it (progress is in the tool row and on each row)',
    );
    const rs = await rows(page),
      N = await page.evaluate(() => __mstest.assignData.N);
    assert.ok(rs.length > 5);
    assert.deepEqual([...new Set(rs.map((r) => r.h))], [48], 'every closed row is one 48px line');
    assert.ok(rs.every((r) => r.exp === 'false' && !r.open && /^0 of \d+ coloured$/.test(r.cnt)));
    assert.equal(
      await page.locator('#sfAlist .sfarow .sfah .nm b').first().textContent(),
      await page.evaluate(() => {
        const k = document.querySelector('#sfAlist .sfarow').dataset.k;
        return k.split('|').pop();
      }),
      'code first in the row',
    );
    assert.equal(await toolStatus(page), `0 of ${N} coloured`, 'progress lives in the tool row');
    assert.ok(
      await page.evaluate(() => {
        const n = document.querySelector('#sfAlist .sfah .nm');
        return getComputedStyle(n).textOverflow === 'ellipsis' && getComputedStyle(n).whiteSpace === 'nowrap';
      }),
      'the name is cut short with an ellipsis',
    );
    assert.deepEqual(errors, []);
  });
  test('after the first time the instructions are one ⓘ line that opens in place', async () => {
    const { page, errors } = await open({ storage: { 'ms-seen-hints': '["along"]' } });
    await along(page);
    const i = page.locator('#sfCtl .sfinfo[data-info="along"]');
    assert.equal(await i.getAttribute('aria-expanded'), 'false');
    assert.equal((await i.textContent()).trim(), 'iHow Colour along works');
    assert.ok((await i.locator('.sfit').boundingBox()).height <= 24, 'one line');
    assert.ok((await i.boundingBox()).height >= 44, 'a 44px tap height');
    await i.click();
    assert.equal(await i.getAttribute('aria-expanded'), 'true');
    assert.match(await i.textContent(), /Mark all done/);
    assert.deepEqual(errors, []);
  });
  test('a row opens in place, one at a time: Mark all coloured ↔ Clear, Find next, Blends; tapping it again closes it', async () => {
    const { page, errors } = await open();
    await along(page);
    const N = await page.evaluate(() => __mstest.assignData.N);
    const r0 = (await rows(page))[0];
    await clickRow(page, 0);
    let rs = await rows(page);
    assert.equal(rs[0].open, true);
    assert.equal(rs[0].exp, 'true');
    assert.equal(await hl(page), r0.k, 'the open row is the marker highlighted on the picture');
    assert.deepEqual(
      await page.$$eval('#sfAlist .sfarow.open .sfacts button', (bs) =>
        bs.map((b) => b.id + ':' + b.textContent.trim()),
      ),
      ['sfMarkAll:✓ Mark all done', 'sfFindNext:Find next', 'sfBlends:Blends'],
    );
    // another row: the first one closes
    await clickRow(page, 1);
    rs = await rows(page);
    assert.deepEqual(rs.map((r) => r.open).slice(0, 3), [false, true, false], 'one open at a time');
    assert.equal(await page.locator('#sfAlist .sfarow.open').count(), 1);
    const k = rs[1].k,
      n = (await secsOf(page, k)).length;
    // Mark all done: the tool row and the row count; the row stays open and in place, and the button becomes Clear ticks
    await page.click('#sfMarkAll');
    await idle(page);
    assert.equal(await toolStatus(page), `${n} of ${N} coloured`);
    assert.equal(
      await page.$eval('#sfToolProg', (e) => e.style.width),
      Math.round((n / N) * 100) + '%',
      'the progress line moves',
    );
    rs = await rows(page);
    assert.equal(rs[1].k, k, 'stays in place');
    assert.ok(rs[1].open && rs[1].full, 'open and dimmed');
    assert.equal(rs[1].cnt, `All ${n} coloured ✓`);
    assert.equal(await page.textContent('#sfMarkAll'), 'Clear');
    assert.equal(await hl(page), k, 'still highlighted');
    assert.equal(await page.locator('#sfFindNext').count(), 0, 'no Find next on a finished marker');
    // (a second tap within 400 ms of Mark all done is the rest of a double tap, not Clear ticks; see "Clear ticks can be undone…" below)
    await pause(page, 400, 'a tap after the double-tap window is a Clear ticks');
    await page.click('#sfMarkAll');
    await idle(page);
    assert.equal(await toolStatus(page), `0 of ${N} coloured`);
    assert.equal(await page.textContent('#sfMarkAll'), '✓ Mark all done');
    assert.match(await page.textContent('#msToast'), /Cleared .+Undo/, 'Clear ticks offers Undo');
    // a tick on the picture keeps the row open and updates its count
    const secs = await secsOf(page, k);
    await scrollTop(page);
    let p = await sectionPoint(page, secs[0]);
    await page.mouse.click(p.x, p.y);
    await idle(page);
    assert.equal(await page.evaluate((l) => __mstest.colored[l], secs[0]), 1);
    assert.equal(await toolStatus(page), `1 of ${N} coloured`);
    rs = await rows(page);
    assert.ok(rs[1].open, 'stays open across progress updates');
    assert.equal(rs[1].cnt, `1 of ${n} coloured`);
    // Find next zooms in on a section still to do: to fit it (v284: as focus mode does, 1× to 4×), its label's point in
    // view, and says how many are left
    await page.click('#sfFindNext');
    await idle(page);
    const f = await page.evaluate((secs) => {
      const t = __mstest,
        c = document.getElementById('sfCanvas').getBoundingClientRect(),
        v = document.querySelector('.sfpicbox').getBoundingClientRect();
      const l = t.fnLast,
        q = t.labelPos(l),
        x = c.left + (q.x / t.W) * c.width,
        y = c.top + (q.y / t.H) * c.height;
      return {
        zoom: t.zoom,
        inside: x > v.left && x < v.right && y > v.top && y < v.bottom,
        done: t.colored[l],
        ofRow: secs.includes(l),
        sz: t.secOnScreen(l),
        v: [v.width, v.height],
      };
    }, secs);
    // (v288: only as far as it needs: about 44px across, unless that would fill the view or pass 4×)
    assert.ok(f.zoom >= 1 && f.zoom <= 4, 'zoomed to fit: ' + f.zoom);
    assert.ok(
      Math.min(f.sz.w, f.sz.h) >= 43 || f.zoom === 4 || Math.max(f.sz.w / f.v[0], f.sz.h / f.v[1]) >= 0.75,
      'big enough to see: ' + JSON.stringify(f),
    );
    if (f.zoom > 1.05)
      assert.ok(
        Math.min(f.sz.w, f.sz.h) <= 46 || Math.max(f.sz.w / f.v[0], f.sz.h / f.v[1]) >= 0.75,
        'no further than it needs: ' + JSON.stringify(f),
      );
    assert.ok(f.inside, 'on the next section still to do');
    assert.equal(f.done, 0);
    assert.ok(f.ofRow, 'of the open marker');
    await page.waitForFunction(() =>
      /^Next section to colour: \d+ of \d+ left\.$/.test(document.getElementById('sfLive').textContent),
    );
    // (and outlined, which ticking it takes away)
    assert.ok(
      await page.evaluate(() => {
        const o = document.querySelector('.sfoutline');
        return !!o && o.style.display !== 'none';
      }),
      'the section found is outlined',
    );
    await page.click('#sfZrst');
    await idle(page);
    // Blends: the lighter and darker companions under the row
    await page.click('#sfBlends');
    await idle(page);
    assert.equal(await page.getAttribute('#sfBlends', 'aria-expanded'), 'true');
    const strip = await page.$$eval('#sfAlist .sfarow.open .blendstrip .bslot', (s) =>
      s.map((x) => x.textContent),
    );
    assert.equal(strip.length, 3);
    assert.match(strip[0], /lighter/);
    assert.match(strip[1], new RegExp(k.split('|').pop() + 'base'));
    assert.match(strip[2], /darker/);
    await page.click('#sfBlends');
    await idle(page);
    assert.equal(await page.locator('#sfAlist .blendstrip').count(), 0);
    // tapping the open row closes it: all colours again
    await clickRow(page, 1);
    assert.equal(await page.locator('#sfAlist .sfarow.open').count(), 0);
    assert.equal(await hl(page), null, 'nothing highlighted');
    assert.equal(await page.locator('#sfMarkAll').count(), 0);
    assert.deepEqual(errors, []);
  });
  test('the open row scrolls fully into view: a row near the bottom, and a press and hold on a marker far down', async () => {
    const { page, errors } = await open();
    await along(page);
    await pinPic(page);
    // the lowest row whose line shows above the bar: its actions would be under the bar
    const i = await page.evaluate(() => {
      const bar = document.querySelector('#sfRoot .sfbar').getBoundingClientRect().top;
      let i = -1;
      document.querySelectorAll('#sfAlist .sfarow').forEach((r, j) => {
        if (r.getBoundingClientRect().bottom <= bar) i = j;
      });
      return i;
    });
    assert.ok(i >= 0);
    const y0 = await page.evaluate(() => scrollY);
    await clickRow(page, i);
    assert.ok((await page.evaluate(() => scrollY)) > y0, 'the page scrolled');
    assertInView(await openBox(page), 'a row near the bottom');
    // Blends makes it taller: still in view
    await page.click('#sfBlends');
    await idle(page);
    assertInView(await openBox(page), 'with Blends open');
    // press and hold a section whose marker is at the bottom of the list
    await scrollTop(page);
    await pinPic(page);
    const k = await page.evaluate(() => {
      const r = document.querySelectorAll('#sfAlist .sfarow');
      return r[r.length - 1].dataset.k;
    });
    const l = await bigOf(page, k);
    await hold(page, l);
    assert.equal(await hl(page), k, 'its marker is open and highlighted');
    assert.equal(await page.evaluate((l) => __mstest.colored[l], l), 0, 'a press and hold does not tick it');
    assert.equal(await page.getAttribute(`#sfAlist .sfarow[data-k="${k}"] .sfah`, 'aria-expanded'), 'true');
    assertInView(await openBox(page), 'found by press and hold');
    assert.match(await page.textContent('#sfLive'), /^Found .+, 0 of \d+ coloured$/, 'announced');
    assert.deepEqual(errors, []);
  });
  test('finished markers stay in place while colouring; entering again gathers them in a collapsed Done (n) group', async () => {
    const { page, errors } = await open();
    await along(page);
    const before = await rows(page);
    await clickRow(page, 0);
    await page.click('#sfMarkAll');
    await idle(page);
    await clickRow(page, 2);
    await page.click('#sfMarkAll');
    await idle(page);
    let rs = await rows(page);
    assert.deepEqual(
      rs.map((r) => r.k),
      before.map((r) => r.k),
      'nothing moved',
    );
    assert.deepEqual(
      rs.filter((r) => r.full).map((r) => r.k),
      [before[0].k, before[2].k],
      'dimmed ✓',
    );
    assert.equal(await page.locator('#sfDoneGrp').count(), 0, 'no group while colouring');
    await page.click('#sfDoneBtn');
    await idle(page);
    await page.click('#sfColor');
    await idle(page);
    rs = await rows(page);
    assert.deepEqual(
      rs.map((r) => r.k),
      before.map((r) => r.k).filter((k, j) => j !== 0 && j !== 2),
      'the done ones are out of the list',
    );
    const g = page.locator('#sfDoneGrp');
    assert.equal((await g.textContent()).replace(/\s+/g, ' ').trim(), 'Done (2)');
    assert.equal(await g.locator('use').getAttribute('href'), '#i-chevron-right', 'closed: ›');
    assert.equal(await g.getAttribute('aria-expanded'), 'false', 'collapsed');
    assert.ok(
      await page.evaluate(() => {
        const g = document.getElementById('sfDoneGrp');
        return !g.nextElementSibling && g.previousElementSibling.classList.contains('sfarow');
      }),
      'at the bottom',
    );
    await g.click();
    await idle(page);
    assert.equal(await g.getAttribute('aria-expanded'), 'true');
    const grp = await page.evaluate(() => {
      const out = [];
      for (let e = document.getElementById('sfDoneGrp').nextElementSibling; e; e = e.nextElementSibling)
        out.push({ k: e.dataset.k, full: e.classList.contains('full') });
      return out;
    });
    assert.deepEqual(
      grp,
      [
        { k: before[0].k, full: true },
        { k: before[2].k, full: true },
      ],
      'expanded: the two done markers',
    );
    // clearing a done marker's ticks puts it back in the list, open and in view
    await page.locator(`#sfAlist .sfarow[data-k="${before[2].k}"] .sfah`).click();
    await idle(page);
    await page.click('#sfMarkAll');
    await idle(page);
    assert.equal((await g.textContent()).replace(/\s+/g, ' ').trim(), 'Done (1)', 'the count follows');
    assert.equal(await g.locator('use').getAttribute('href'), '#i-chevron-down', 'open: ⌄');
    assert.equal(await hl(page), before[2].k);
    assertInView(await openBox(page), 'back in the list');
    // Reset progress (⋯, then Clear in the sheet that asks) empties the group
    await menuItem(page, 'Reset progress');
    await page.click('#sfResetGo');
    await idle(page);
    assert.equal(await page.locator('#sfDoneGrp').count(), 0);
    assert.match(await toolStatus(page), /^0 of \d+ coloured$/);
    assert.deepEqual(errors, []);
  });
  test('keyboard and screen readers: rows are buttons with aria-expanded, the actions follow by Tab, changes are announced', async () => {
    const { page, errors } = await open();
    await along(page);
    const first = page.locator('#sfAlist .sfah').first();
    await first.focus();
    await page.keyboard.press('Enter');
    await idle(page);
    assert.equal(await first.getAttribute('aria-expanded'), 'true');
    assert.ok(
      await page.evaluate(() => document.activeElement.matches('#sfAlist .sfarow.open .sfah')),
      'focus stays on the row',
    );
    assert.match(await page.textContent('#sfLive'), /, 0 of \d+ coloured$/);
    const order = [];
    for (let j = 0; j < 3; j++) {
      await page.keyboard.press('Tab');
      order.push(await page.evaluate(() => document.activeElement.id));
    }
    assert.deepEqual(order, ['sfMarkAll', 'sfFindNext', 'sfBlends']);
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Enter');
    await idle(page);
    assert.equal(
      await page.evaluate(() => document.activeElement.id),
      'sfMarkAll',
      'focus kept after the list redraws',
    );
    assert.equal(await page.textContent('#sfMarkAll'), 'Clear');
    assert.match(await page.textContent('#sfLive'), /^(All \d+ .+ sections|The .+ section) coloured$/);
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Enter');
    await idle(page);
    assert.equal(await first.getAttribute('aria-expanded'), 'false', 'Enter on the open row closes it');
    assert.equal(await page.textContent('#sfLive'), 'Showing all colours');
    assert.deepEqual(errors, []);
  });
  test('with shading on, each row has its highlight › base › shadow line', async () => {
    const { page, errors } = await open();
    await sampleGuide(page);
    await idle(page);
    await page.evaluate(() => {
      __mstest.shadeMode = 'full';
      __mstest.normalizeTones();
      __mstest.renderGuide();
    });
    await page.click('#sfColor');
    await idle(page);
    const t = await page.$$eval('#sfAlist .sfarow', (rs) =>
      rs.map((r) => ({
        tones: (r.querySelector('.sfatones') || {}).textContent || '',
        h: r.querySelector('.sfah').getBoundingClientRect().height,
      })),
    );
    assert.ok(
      t.every((x) => /B .+›/.test(x.tones)),
      'every row lists its tones',
    );
    assert.ok(
      t.every((x) => x.h > 48 && x.h < 72),
      'one line more than a closed row',
    );
    assert.deepEqual(errors, []);
  });
  test('focus mode is still entered from the bar and comes back to the list', async () => {
    const { page, errors } = await open();
    await along(page);
    await clickRow(page, 1);
    const k = await hl(page);
    await page.click('#sfFocus');
    await idle(page);
    assert.ok(await page.evaluate(() => document.getElementById('sfRoot').classList.contains('sffoc')));
    assert.equal(
      await page.evaluate(() => __mstest.assignData.assign[__mstest.focusOrd[__mstest.focusPos]].mkey),
      k,
      'starts on the open marker',
    );
    await page.click('#sfFDone');
    await idle(page);
    await page.click('#sfExitFoc');
    await idle(page);
    assert.ok(!(await page.evaluate(() => document.getElementById('sfRoot').classList.contains('sffoc'))));
    assert.ok(await page.isVisible('#sfAlist'), 'the list is back');
    assert.match(await toolStatus(page), /^1 of \d+ coloured$/);
    assert.equal((await page.textContent('#sfDoneBtn')).trim(), 'Plan');
    assert.equal(await page.locator('#sfDoneBtn svg.icback').count(), 1, 'its way back a chevron (v321)');
    assert.equal(await page.getAttribute('#sfDoneBtn', 'aria-label'), 'Back to the Plan');
    assert.deepEqual(errors, []);
  });
  for (const [w, h] of [
    [375, 667],
    [844, 390],
  ]) {
    test(`${w}×${h}: 48px rows, the open row in view, nothing sideways`, async () => {
      const { page, errors } = await open({ width: w, height: h });
      await along(page);
      assert.deepEqual([...new Set((await rows(page)).map((r) => r.h))], [48]);
      const n = (await rows(page)).length;
      await page.evaluate(() => scrollTo(0, 1e6));
      await idle(page);
      await clickRow(page, n - 1);
      assertInView(await openBox(page), `${w}×${h} the last row`);
      await scrollTop(page);
      const k = await page.evaluate(() => {
        const r = document.querySelectorAll('#sfAlist .sfarow');
        return r[r.length - 2].dataset.k;
      });
      await pinPic(page);
      await hold(page, await bigOf(page, k));
      assert.equal(await hl(page), k);
      assertInView(await openBox(page), `${w}×${h} press and hold`);
      assert.ok(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        'no sideways scroll',
      );
      assert.deepEqual(errors, []);
    });
  }
  test('long-press a section while colouring along to find its colour in the list', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await page.click('#sfColor');
    await idle(page);
    await scrollTop(page);
    const l = await page.evaluate(() => __mstest.assignData.order[5]);
    const p = await sectionPoint(page, l);
    await longPress(page, p.x, p.y);
    await idle(page);
    const k = await page.evaluate((l) => __mstest.assignData.assign[l].mkey, l);
    assert.equal(await page.evaluate(() => __mstest.hlKey), k, 'its colour is highlighted');
    assert.equal(await page.evaluate((l) => __mstest.colored[l], l), 0, 'a long-press does not tick it');
    assert.ok(
      (await page.locator(`#sfAlist .sfarow[data-k="${k}"].open`).count()) === 1,
      'its row is open in the list',
    );
    // a normal tap still ticks
    await idle(page);
    const p2 = await sectionPoint(page, l);
    await page.mouse.click(p2.x, p2.y);
    assert.equal(await page.evaluate((l) => __mstest.colored[l], l), 1);
    assert.deepEqual(errors, []);
  });
  test('Clear ticks can be undone and a double tap on Mark all done does not clear; the open row’s buttons are 44px', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await page.click('#sfColor');
    await idle(page);
    await scrollTop(page);
    await page.locator('#sfAlist .sfarow .sfah').nth(0).click();
    await idle(page);
    const k = await page.evaluate(() => __mstest.hlKey),
      n = await page.evaluate(
        (k) => __mstest.assignData.order.filter((l) => __mstest.assignData.assign[l].mkey === k).length,
        k,
      );
    const h = await page.$$eval('#sfAlist .sfarow.open .sfacts button', (bs) =>
      bs.map((b) => Math.round(b.getBoundingClientRect().height)),
    );
    assert.ok(
      h.every((x) => x >= 44),
      'buttons at least 44px tall: ' + h,
    );
    await page.dblclick('#sfMarkAll');
    await idle(page);
    assert.equal(await doneN(page), n, 'the second tap of a double tap is not Clear ticks');
    await pause(page, 400, 'a tap after the 400 ms double-tap window is a Clear ticks');
    await page.click('#sfMarkAll');
    await idle(page);
    assert.equal(await doneN(page), 0);
    await page.click('#toastAct');
    await idle(page);
    assert.equal(await doneN(page), n, 'Undo puts the ticks back');
    assert.deepEqual(errors, []);
  });
  test('after a press and hold in Colour along, the click that follows the lift does not open another row', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await page.click('#sfColor');
    await idle(page);
    const [l] = await bigSections(page, 1),
      key = await page.evaluate((l) => __mstest.assignData.assign[l].mkey, l);
    const p = await sectionPoint(page, l);
    await longPress(page, p.x, p.y);
    assert.equal(await page.evaluate(() => __mstest.hlKey), key, 'the hold opened its marker');
    // a click on another row straight after is ignored...
    const other = await page.evaluate(
      (k) => [...document.querySelectorAll('#sfAlist .sfarow')].find((r) => r.dataset.k !== k).dataset.k,
      key,
    );
    await page.evaluate(
      (k) => document.querySelector(`#sfAlist .sfarow[data-k="${k}"] .sfah`).click(),
      other,
    );
    assert.equal(await page.evaluate(() => __mstest.hlKey), key, 'still the held marker');
    // ...but not for long
    await pause(page, 450, 'clicks are ignored for 400 ms after the lift');
    await page.evaluate(
      (k) => document.querySelector(`#sfAlist .sfarow[data-k="${k}"] .sfah`).click(),
      other,
    );
    assert.equal(await page.evaluate(() => __mstest.hlKey), other);
    assert.deepEqual(errors, []);
  });
  test('finishing the page in Colour along brings "Page finished!" and its Reveal & share into view, with no toast over the open row', async () => {
    for (const [w, h] of [
      [390, 844],
      [375, 667],
    ]) {
      // (the one-time "Your screen stays on" toast told already: Safari keeps the screen on, headless Chromium doesn't)
      const { page, errors, ctx } = await openApp({ width: w, height: h, storage: { 'ms-wake-told': '1' } });
      await sampleGuide(page);
      await idle(page);
      await page.click('#sfColor');
      await idle(page);
      // every marker but the last done at once; the last from its open row, far down the list
      await page.evaluate(() => {
        const t = __mstest,
          ks = [...document.querySelectorAll('#sfAlist .sfarow')].map((r) => r.dataset.k),
          last = ks[ks.length - 1];
        t.assignData.order.forEach((l) => {
          if (t.assignData.assign[l].mkey !== last) t.colored[l] = 1;
        });
      });
      const last = await page.evaluate(() => {
        const ks = [...document.querySelectorAll('#sfAlist .sfarow')].map((r) => r.dataset.k);
        return ks[ks.length - 1];
      });
      await page.click(`#sfAlist .sfarow[data-k="${last}"] .sfah`);
      await idle(page);
      await page.click('#sfMarkAll');
      await idle(page);
      // (v318 polish: its smooth scroll waited for to the end: on a slow WebKit, scroll events can come further apart than
      // idle() allows for a scroll still moving, and the banner was measured on its way, 1 run in 4)
      await page.waitForFunction(
        () =>
          new Promise((res) => {
            const y = scrollY;
            requestAnimationFrame(() =>
              requestAnimationFrame(() => setTimeout(() => res(scrollY === y), 150)),
            );
          }),
        null,
        { polling: 200, timeout: 15000 },
      );
      const dn = await rect(page, '#sfDone'),
        bar = await rect(page, '#sfWork>.sfbar'),
        top = await pinH(page);
      assert.ok(dn && dn.height > 0, 'the banner shows');
      assert.ok(
        dn.top >= top - 1 && dn.bottom <= bar.top + 1,
        `${w}×${h}: the banner is on the screen under the pinned block (${dn.top}–${dn.bottom}, pinned ${top}, bar ${bar.top})`,
      );
      const rv = await rect(page, '#sfDoneRev');
      assert.equal(
        await page.evaluate(
          ([x, y]) => document.elementFromPoint(x, y)?.id,
          [rv.x + rv.width / 2, rv.y + rv.height / 2],
        ),
        'sfDoneRev',
        'Reveal & share can be tapped',
      );
      assert.equal(
        await toastOn(page),
        false,
        'no toast over the list: ' +
          (await page.evaluate(() => document.getElementById('msToast')?.textContent)),
      );
      // (v307: the same words as Focus mode's finish, "Page finished. …")
      // (v320: waited for: the guide's save, a moment after, is said too, and the live region is emptied for 40 ms
      // before each thing it says; the finished card's strokes put the check right at that moment in WebKit)
      await page
        .waitForFunction(
          () => /^Page finished\. /.test(document.getElementById('sfLive').textContent),
          null,
          {
            timeout: 3000,
          },
        )
        .catch(() => {});
      assert.match(await page.textContent('#sfLive'), /^Page finished\. /, 'screen readers hear it');
      if (w === 390) await shot(page, 'g1-1-after');
      // in focus mode the toast stays: Reveal & share is in its own bottom bar
      await page.click('#sfDoneRev');
      await page.waitForSelector('#sfRoot.sfrev');
      assert.ok(
        await page.evaluate(() => document.getElementById('sfRoot').classList.contains('sfrev')),
        'Reveal starts',
      );
      assert.deepEqual(errors, []);
      await ctx.close();
    }
  });
  test('coming back to Colour along from another screen keeps the screen awake again', async () => {
    const init = () => {
      window.__wl = { req: 0, rel: 0 };
      Object.defineProperty(navigator, 'wakeLock', {
        configurable: true,
        value: {
          request: () => {
            window.__wl.req++;
            return Promise.resolve({
              release() {
                window.__wl.rel++;
                return Promise.resolve();
              },
              addEventListener() {},
            });
          },
        },
      });
    };
    const { page, errors } = await openApp({ init });
    await sampleGuide(page);
    await idle(page);
    await page.click('#sfColor');
    await page.waitForFunction(() => window.__wl.req === 1);
    await page.click('#mHome');
    await page.waitForFunction(() => window.__wl.rel === 1);
    await page.click('#mSections');
    await page.waitForFunction(() => window.__wl.req === 2); // asked for again on coming back
    // not in Plan
    await page.click('#sfDoneBtn');
    await idle(page);
    await page.click('#mHome');
    await idle(page);
    await page.click('#mSections');
    await idle(page);
    assert.equal(await page.evaluate(() => window.__wl.req), 2);
    assert.deepEqual(errors, []);
  });
  test('Reset progress asks in the guide’s sheet: Cancel keeps the ticks, Clear clears them (with Undo); greyed out with nothing ticked', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await page.click('#sfColor');
    await idle(page);
    await page.click('#sfAlist .sfarow .sfah');
    await idle(page);
    await page.click('#sfMarkAll');
    await idle(page);
    await page.click('#sfAlist .sfarow:not(.full) .sfah');
    await idle(page);
    await page.click('#sfMarkAll');
    await idle(page);
    const n = await ticks(page);
    assert.ok(n > 2);
    await openMenu(page);
    assert.equal(await page.getAttribute('#sfResetP', 'aria-disabled'), null);
    await page.click('#sfResetP');
    await idle(page);
    assert.equal(await page.textContent('#sfSheetT'), 'Reset progress?');
    assert.equal(
      (await page.textContent('#sfSheet .sfshbody')).trim(),
      `This clears what you’ve coloured on ${n} sections.`,
    );
    assert.deepEqual(
      await page.$$eval('#sfSheet .sfshft button', (b) =>
        b.map((x) => x.textContent + (x.classList.contains('sfprimary') ? '*' : '')),
      ),
      ['Cancel', 'Reset*'],
    );
    assert.equal(
      await page.evaluate(() => document.activeElement && document.activeElement.textContent),
      'Cancel',
      'focus in the sheet',
    );
    await snap(page, 'a-reset-sheet');
    await page.click('#sfSheet [data-rp="cancel"]');
    await idle(page);
    assert.equal(await page.isVisible('#sfSheet'), false);
    assert.equal(await ticks(page), n, 'Cancel keeps the ticks');
    await openMenu(page);
    await page.click('#sfResetP');
    await idle(page);
    await page.click('#sfResetGo');
    await idle(page);
    assert.equal(await page.isVisible('#sfSheet'), false);
    assert.equal(await ticks(page), 0, 'Clear clears them');
    assert.match(await toastOnText(page), /^Progress reset Undo$/);
    await page.click('#toastAct');
    await idle(page);
    assert.equal(await ticks(page), n, 'Undo puts them back');
    await openMenu(page);
    await page.click('#sfResetP');
    await page.click('#sfResetGo');
    await idle(page);
    assert.equal(await ticks(page), 0);
    // nothing ticked: the item is there, greyed, and does nothing
    await openMenu(page);
    assert.equal(await page.getAttribute('#sfResetP', 'aria-disabled'), 'true');
    assert.ok(+(await page.$eval('#sfResetP', (b) => getComputedStyle(b).opacity)) < 1, 'greyed');
    await page.click('#sfResetP', { force: true });
    await idle(page);
    assert.equal(await page.locator('#sfResetGo').count(), 0, 'no question');
    assert.ok(await page.isVisible('#sfSheet .sfmenu'), 'the menu stays open');
    assert.deepEqual(errors, []);
  });
  test('Colour along, the first time: its first line and More; opening a marker folds them into the ⓘ line, as later visits show', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await page.click('#sfColor');
    await idle(page);
    const h = '#sfAlHint';
    assert.ok(await page.isVisible(h));
    assert.equal(
      (await page.textContent(h + ' .sfit')).trim(),
      'Tap a marker to see its sections, then tap each section on the picture as you colour it. More',
    );
    assert.equal(await page.textContent('#sfAlMore'), 'More');
    const seen = () =>
      page.evaluate(() => JSON.parse(localStorage.getItem('ms-seen-hints') || '[]').includes('along'));
    assert.equal(await seen(), false, 'not seen yet');
    await snap(page, 'a-along-first');
    await page.click('#sfAlMore');
    await idle(page);
    assert.equal(
      (await page.textContent(h + ' .sfit')).trim(),
      'Tap a marker to see its sections, then tap each section on the picture as you colour it. Use ✓ Mark all done for a whole marker. Press and hold a section to find its marker here.',
    );
    assert.equal(await page.locator('#sfAlMore').count(), 0);
    // the first row opened: the ⓘ line, closed, and seen
    await page.click('#sfAlist .sfarow .sfah');
    await idle(page);
    assert.equal(await page.locator(h).count(), 0);
    const i = page.locator('#sfCtl button.sfinfo[data-info="along"]');
    assert.equal((await i.textContent()).trim(), 'iHow Colour along works');
    assert.equal(await i.getAttribute('aria-expanded'), 'false');
    assert.equal(await seen(), true);
    // it opens in place with all of it
    await i.click();
    assert.match(
      await i.textContent(),
      /Tap a marker to see its sections, then tap each section on the picture as you colour it\. Use ✓ Mark all done for a whole marker\./,
    );
    await i.click();
    // later visits: the ⓘ line
    await page.click('#sfDoneBtn');
    await idle(page);
    await page.click('#sfColor');
    await idle(page);
    assert.equal(await page.locator(h).count(), 0);
    assert.equal(
      (await page.locator('#sfCtl button.sfinfo[data-info="along"]').textContent()).trim(),
      'iHow Colour along works',
    );
    assert.deepEqual(errors, []);
  });
}

// ---- from finish-and-codes.test.mjs ----
// v284: Colour along's Codes button works (codes off: every section in its colour, those done keeping their ✓); a
// finished page shows as it is, with what was coloured and when; Save image can leave the codes off; a guide part-way
// coloured opens in Colour along, its Home card saying how far; the codes on the picture never come out tinier than
// 6 screen pixels where their section nearly holds them, redrawn as you zoom; the first time the screen is kept on,
// a toast says so.
{
  // the canvas colour a little way from a section's label (inside it), and the marker's own
  const colourAt = (page, l) =>
    page.evaluate((l) => {
      const t = __mstest,
        c = document.getElementById('sfCanvas'),
        g = c.getContext('2d'),
        m = t.assignData.assign[l];
      let best = null;
      for (let y = 0; y < t.H && !best; y += 2)
        for (let x = 0; x < t.W; x += 2)
          if (t.labels[y * t.W + x] === l) {
            const p = t.labelPos(l);
            if (Math.hypot(x - p.x, y - p.y) < 16) continue;
            best = [x, y];
            break;
          }
      const d = g.getImageData(best[0], best[1], 1, 1).data,
        h = m.hex;
      return { px: [d[0], d[1], d[2]], mk: [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) };
    }, l);
  const near = (a, b, tol) => a.every((v, i) => Math.abs(v - b[i]) <= tol);
  test('Colour along: done sections in their colour, the rest pale (v288, as your paper); Codes off shows every section in its colour', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await page.click('#sfColor');
    await idle(page);
    const [l, l2] = await page.evaluate(() => {
      const t = __mstest,
        a = t.assignData,
        s = a.order.slice().sort((x, y) => t.comps[y].area - t.comps[x].area);
      t.colored[s[1]] = 1;
      t.renderGuide();
      return [s[1], s[2]];
    });
    let c = await colourAt(page, l),
      c2 = await colourAt(page, l2);
    assert.ok(near(c.px, c.mk, 40), 'done: its own colour ' + c.px + ' vs ' + c.mk);
    assert.ok(!near(c2.px, c2.mk, 30), 'not done: pale ' + c2.px + ' vs ' + c2.mk);
    await page.click('#sfCodes');
    await idle(page);
    assert.equal(await page.getAttribute('#sfCodes', 'aria-pressed'), 'false');
    c = await colourAt(page, l);
    c2 = await colourAt(page, l2);
    assert.ok(near(c.px, c.mk, 40), 'codes off: its own colour ' + c.px + ' vs ' + c.mk);
    assert.ok(near(c2.px, c2.mk, 40), 'codes off: not done in its own colour too ' + c2.px + ' vs ' + c2.mk);
    await page.click('#sfCodes');
    await idle(page);
    c2 = await colourAt(page, l2);
    assert.ok(!near(c2.px, c2.mk, 30), 'codes on: not done pale again');
    assert.deepEqual(errors, []);
  });
  test('a finished page: the picture as it is, what was coloured and when (saved with the guide); Save image can leave the codes off', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await page.click('#sfColor');
    await idle(page);
    // all but one ticked, then the last by a tap on its row's Mark all done
    await page.evaluate(() => {
      const t = __mstest,
        o = t.assignData.order;
      o.slice(1).forEach((l) => {
        t.colored[l] = 1;
      });
      t.checkComplete();
      t.renderGuide();
    });
    await page.evaluate(() => {
      const t = __mstest;
      t.colored[t.assignData.order[0]] = 1;
    });
    await page.evaluate(() => __mstest.checkComplete());
    await page.evaluate(() => {
      __mstest.updateProgress();
      __mstest.renderGuide();
    });
    await idle(page);
    // (v320: the card's three numbers, sections, markers and days, and its date; heard as finishLine)
    assert.match(
      await page.getAttribute('#sfDoneSum', 'aria-label'),
      /^\d+ sections · \d+ markers · coloured today$/,
    );
    assert.equal(await page.locator('#sfDoneSum .sfpgst').count(), 3);
    assert.match(await page.textContent('#sfDoneKick'), /^Finished · \w+day \d+ \w+$/);
    const at = await page.evaluate(() => __mstest.progAt);
    assert.ok(at.s > 0 && at.e >= at.s);
    const l = await page.evaluate(() => __mstest.assignData.order[3]);
    const c = await colourAt(page, l);
    assert.ok(near(c.px, c.mk, 40), 'the finished picture in its colours');
    const d = await page.evaluate(() => __mstest.currentDesignObj().payload.dates);
    // (v313: and when it was last coloured, l)
    assert.deepEqual(d, { s: at.s, e: at.e, l: at.l });
    assert.ok(at.l >= at.e);
    // Save image, without the codes
    await page.click('#sfDoneBtn');
    await idle(page);
    await page.click('.sftabbtn[data-t="share"]');
    await idle(page);
    // (v305: the codes go off by themselves once the page is finished; ticking and unticking is still your choice)
    assert.equal(await page.isChecked('#sfExCodes'), false);
    await page.check('#sfExCodes');
    assert.equal(await page.evaluate(() => __mstest.exCodes), true);
    await page.uncheck('#sfExCodes');
    assert.equal(await page.evaluate(() => __mstest.exCodes), false);
    const diff = await page.evaluate(() => {
      const a = __mstest.buildExportCanvas(false, false),
        b = __mstest.buildExportCanvas(false, true),
        H = __mstest.H,
        W = __mstest.W;
      const da = a.getContext('2d').getImageData(0, 0, W, H).data,
        db = b.getContext('2d').getImageData(0, 0, W, H).data;
      let n = 0;
      for (let i = 0; i < da.length; i += 4) if (da[i] !== db[i]) n++;
      return n;
    });
    assert.ok(diff > 500, 'the codes left off: ' + diff);
    assert.deepEqual(errors, []);
  });
  test('a guide coloured before the dates were kept gets none (not today’s): finished, it says only what was coloured', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await page.evaluate(() => {
      const t = __mstest,
        d = t.currentDesignObj(),
        p = Object.assign({}, d.payload, {
          name: 'Old',
          W: d.W,
          H: d.H,
          prog: Object.keys(d.payload.assign).map(Number),
        });
      delete p.dates;
      t.openDesignObj(p, null);
    });
    await page.waitForFunction(() => __mstest.curName === 'Old' && __mstest.assignData);
    await idle(page);
    if ((await page.evaluate(() => __mstest.sfmode)) !== 'color') {
      await page.click('#sfColor');
      await idle(page);
    }
    await page.evaluate(() => {
      __mstest.checkComplete();
      __mstest.updateProgress();
    });
    assert.equal(await page.evaluate(() => __mstest.progAt.s), 0, 'no start date made up');
    // (v320: two numbers, no days, and no date over the title)
    assert.match(await page.getAttribute('#sfDoneSum', 'aria-label'), /^\d+ sections · \d+ markers$/);
    assert.equal(await page.locator('#sfDoneSum .sfpgst').count(), 2);
    assert.equal(await page.textContent('#sfDoneKick'), 'Finished');
    assert.equal(await page.evaluate(() => __mstest.currentDesignObj().payload.dates), undefined);
    assert.deepEqual(errors, []);
  });
  test('a guide part-way coloured opens in Colour along, its Home card saying how far (one not started opens in the plan, as the other tests find)', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await saveGuide(page);
    // (v313: the sample with ticks to try it isn't on Continue until it's printed or renamed: as if renamed)
    await page.evaluate(() => {
      __mstest.styleVars.smpTry = 0;
    });
    await page.click('#sfColor');
    await idle(page);
    await page.evaluate(() => {
      const t = __mstest;
      t.assignData.order.slice(0, 20).forEach((l) => {
        t.colored[l] = 1;
      });
      t.checkComplete();
      t.renderGuide();
    });
    await page.click('#sfDoneBtn');
    await idle(page);
    await page.evaluate(() => {
      __mstest.guideDirty = true;
      return SF.flushSave();
    });
    await page.waitForFunction(() => {
      const s = state.saved.find((x) => x.type === 'guide');
      return s && s.done === 20;
    });
    await page.reload();
    await idle(page);
    await page.click('#mHome');
    await idle(page);
    // (v285: it's Home's Continue card)
    assert.match(await page.textContent('#homeCont .hcmeta'), /^20 of \d+ coloured/);
    await page.click('#homeCont .hccard');
    await page.waitForFunction(() => __mstest.assignData && __mstest.sfmode === 'color');
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.sfmode), 'color');
    assert.deepEqual(errors, []);
  });
  test('codes on the picture: tinier than 6 screen pixels only where their section is far too small, redrawn in steps as you zoom', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    const m0 = await page.evaluate(() => __mstest.labMin),
      s0 = await page.evaluate(() => document.getElementById('sfCanvas').offsetWidth / __mstest.W);
    assert.ok(Math.abs(m0 * s0 - 6) < 0.5, '6 screen pixels at 1×: ' + m0 * s0);
    await page.click('#sfZin');
    await page.click('#sfZin');
    await idle(page);
    await page.waitForFunction((m0) => __mstest.labMin < m0, m0);
    const z = await page.evaluate(() => __mstest.zoom),
      m1 = await page.evaluate(() => __mstest.labMin);
    assert.ok(m1 * s0 * z >= 4.2 && m1 * s0 * z <= 8.5, 'about 6 screen pixels zoomed in: ' + m1 * s0 * z);
    assert.deepEqual(errors, []);
  });
  // (v308: said in the tool row's status for a few seconds, not a toast, which covered the rows)
  test('the first time Colour along keeps the screen on, the tool row says so (once)', async () => {
    const init = () => {
      Object.defineProperty(navigator, 'wakeLock', {
        value: { request: () => Promise.resolve({ addEventListener() {}, release() {} }) },
        configurable: true,
      });
    };
    // (an iPad held upright, where the tool row has room for it: on a phone or side by side a toast says it, v308-merge-r3)
    const { page, errors } = await openApp({ width: 820, height: 1180, init });
    await sampleGuide(page);
    await idle(page);
    await page.click('#sfColor');
    await idle(page);
    await page.waitForFunction(() =>
      /coloured · screen stays on/.test(document.getElementById('sfStat')?.textContent || ''),
    );
    assert.ok(
      !/screen stays on/.test(
        await page.evaluate(() => {
          const t = document.getElementById('msToast');
          return t && t.classList.contains('on') ? t.textContent : '';
        }),
      ),
      'no toast',
    );
    await page.click('#sfDoneBtn');
    await idle(page);
    await page.click('#sfColor');
    await idle(page);
    await page.waitForTimeout(300);
    assert.ok(!/screen stays on/.test(await page.textContent('#sfStat')), 'not again');
    assert.deepEqual(errors, []);
  });
}

// ---- from values-and-order.test.mjs ----
// v278: Values (the picture in greys, a view only), Colour along's list lightest first, Find next along the same
// path as focus mode, and the Sections screen asking for a rebuild only when the kept sections change.
{
  const vals = (page) =>
    page.evaluate(() => {
      const b = document.getElementById('sfVals');
      return {
        shown: !!b && b.style.display !== 'none' && b.getClientRects().length > 0,
        pressed: b && b.getAttribute('aria-pressed'),
        filter: getComputedStyle(document.getElementById('sfCanvas')).filter,
      };
    });
  test('Values shows the picture in greys, in the guide and Colour along; not in the sections editor, and not saved', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    const saved0 = await page.evaluate(() => JSON.stringify(__mstest.currentDesignObj().payload.style));
    assert.deepEqual(await vals(page), { shown: true, pressed: 'false', filter: 'none' });
    await page.click('#sfVals');
    await idle(page);
    assert.deepEqual(await vals(page), { shown: true, pressed: 'true', filter: 'grayscale(1)' });
    assert.equal(
      await page.evaluate(() => JSON.stringify(__mstest.currentDesignObj().payload.style)),
      saved0,
      'a view only: the guide is unchanged',
    );
    assert.equal(await page.evaluate(() => __mstest.planCount), 0, 'not an Undo step');
    // Colour along keeps it
    await page.click('#sfColor');
    await idle(page);
    assert.deepEqual(await vals(page), { shown: true, pressed: 'true', filter: 'grayscale(1)' });
    // the sections editor's colours are a map: no Values there, and its colours show
    await page.click('#sfDoneBtn');
    await idle(page);
    await page.click('#sfBack2');
    await idle(page);
    const r = await vals(page);
    assert.equal(r.shown, false);
    assert.equal(r.filter, 'none');
    // and back on the guide it's still on (until turned off)
    await buildGo(page);
    await idle(page);
    assert.deepEqual(await vals(page), { shown: true, pressed: 'true', filter: 'grayscale(1)' });
    await page.click('#sfVals');
    await idle(page);
    assert.deepEqual(await vals(page), { shown: true, pressed: 'false', filter: 'none' });
    assert.deepEqual(errors, []);
  });
  test('Colour along lists its markers lightest first; Find next goes through a marker the way focus mode does', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await page.click('#sfColor');
    await idle(page);
    await scrollTop(page);
    // (each row's marker, lightness by the same measure focus mode sorts by: Rec. 601 luma of its hex)
    const lums = await page.$$eval('#sfAlist .sfarow', (rs) =>
      rs.map((r) => {
        const m = Object.values(__mstest.assignData.assign).find((x) => x.mkey === r.dataset.k),
          h = m.hex;
        return [1, 3, 5]
          .map((i) => parseInt(h.slice(i, i + 2), 16))
          .reduce((s, v, i) => s + v * [0.299, 0.587, 0.114][i], 0);
      }),
    );
    assert.ok(lums.length > 5);
    for (let i = 1; i < lums.length; i++)
      assert.ok(lums[i] <= lums[i - 1] + 1e-9, `row ${i} is not lighter than row ${i - 1}`);
    // a marker with several sections: Find next goes along its path (topmost first, then the nearest), skipping ticked ones
    const i = await page.$$eval('#sfAlist .sfarow .cnt', (c) =>
      c.findIndex((x) => /of ([4-9]|\d\d)/.test(x.textContent)),
    );
    assert.ok(i >= 0);
    await page.locator('#sfAlist .sfarow .sfah').nth(i).click();
    await idle(page);
    const path = await page.evaluate(() => __mstest.hlPath());
    assert.ok(path.length >= 4);
    // (tick the second one: Find next passes over it)
    await page.evaluate((l) => {
      __mstest.colored[l] = 1;
    }, path[1]);
    const seen = [];
    for (let k = 0; k < path.length - 1; k++) {
      await page.click('#sfFindNext');
      await idle(page);
      seen.push(await page.evaluate(() => __mstest.fnLast));
    }
    assert.deepEqual(
      seen,
      path.filter((l, j) => j !== 1),
      'along the path, and round again',
    );
    assert.deepEqual(errors, []);
  });
  test('the Sections screen asks for a rebuild only when the smallest-section slider changes which sections are kept', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await page.click('#sfBack2');
    await idle(page);
    const warned = () =>
      page.evaluate(() => /Section edits not saved/.test(document.getElementById('sfRoot').textContent));
    const set = (v) =>
      page.evaluate((v) => {
        const el = document.getElementById('sfMin');
        el.value = String(v);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }, v);
    assert.equal(await warned(), false);
    // a notch either way keeps the same 166 sections
    await set(31);
    await idle(page);
    assert.equal(await warned(), false, 'a nudge that keeps the same sections');
    await set(29);
    await idle(page);
    assert.equal(await warned(), false);
    // far enough to drop some: that's an edit to build
    await set(60);
    await idle(page);
    assert.equal(await warned(), true, 'some sections dropped');
    await set(30);
    await idle(page);
    assert.equal(await warned(), false, 'back where it was built');
    assert.deepEqual(errors, []);
  });
}

// ---- from v285-review2.test.mjs ----
// v285's second review (after release prep): changes made just before the page goes away are kept; Resume's section
// edits, discarded, never overwrite the Library guide; edits left by an earlier visit are kept as a copy; a guide
// deleted while open stays out of the slot; blocked storage asks before a guide goes; Continue's row is on screen;
// Reveal gives the keyboard back; the Library's backup line; the welcome on a landscape phone; singular wording.
{
  test('Continue opens Colour along with the marker’s row on screen', async () => {
    const { page, errors } = await openApp({ width: 390, height: 844 });
    await sampleGuide(page);
    await saveGuide(page);
    // part-way through a marker far down the list (the darkest with more than one section)
    // (v313: the sample with ticks to try it isn't on Continue until it's printed or renamed: as if renamed)
    await page.evaluate(() => {
      const t = __mstest,
        by = {};
      t.styleVars.smpTry = 0;
      t.assignData.order.forEach((l) => {
        const m = t.assignData.assign[l];
        (by[m.mkey] = by[m.mkey] || { hex: m.hex, ls: [] }).ls.push(l);
      });
      const lum = (h) =>
        0.299 * parseInt(h.slice(1, 3), 16) +
        0.587 * parseInt(h.slice(3, 5), 16) +
        0.114 * parseInt(h.slice(5, 7), 16);
      const e = Object.values(by)
        .filter((e) => e.ls.length > 1)
        .sort((a, b) => lum(a.hex) - lum(b.hex))[0];
      t.colored[e.ls[0]] = 1;
      t.guideDirty = true;
      t.renderGuide();
    });
    await page.evaluate(() => __mstest.flushSave());
    await idle(page);
    await page.click('#mHome');
    await idle(page);
    await page.click('#homeCont .hccard');
    await page.waitForFunction(() => __mstest.sfmode === 'color');
    await idle(page);
    await idle(page);
    const r = await page.evaluate(() => {
      const row = document.querySelector('.sfarow.open').getBoundingClientRect(),
        bar = document.querySelector('#sfWork>.sfbar').getBoundingClientRect();
      return {
        top: row.top,
        bottom: row.bottom,
        barTop: bar.top,
        pin: parseFloat(document.documentElement.style.getPropertyValue('--pinH')) || 0,
      };
    });
    assert.ok(
      r.top >= r.pin - 2 && r.top < r.barTop - 20,
      `the open row is on screen (${JSON.stringify(r)})`,
    );
    assert.deepEqual(errors, []);
  });
}

// ---- from v296.test.mjs ----
// v296: fixes from the fresh-eyes review of v296 — ← Plan › Discard opening the photo picker, zoomed-in redraws a part
// at a time on the codes' own canvas, ticks after Codes off, the palette's Undo and locks, the scheme line.
{
  const tickN = (page, n, from = 0) =>
    page.evaluate(
      ([n, from]) => {
        const t = __mstest;
        t.assignData.order.slice(from, from + n).forEach((l) => {
          t.colored[l] = 1;
        });
        t.guideDirty = true;
        t.renderGuide();
      },
      [n, from],
    );
  // the picture and the codes' canvas as they are, against a from-scratch redraw of the same state
  const vsFull = (page) =>
    page.evaluate(() => {
      const grab = () =>
        ['sfCanvas', 'sfLabHi'].map((id) => {
          const c = document.getElementById(id);
          return c && c.width && c.style.display !== 'none'
            ? c.getContext('2d').getImageData(0, 0, c.width, c.height).data.slice()
            : null;
        });
      __mstest.renderGuide();
      const a = grab();
      __mstest.forceFullRender();
      __mstest.renderGuide();
      const b = grab();
      return a.map((x, k) => {
        if (!x || !b[k] || x.length !== b[k].length) return x || b[k] ? 'size' : 0;
        let n = 0;
        for (let i = 0; i < x.length; i++) if (x[i] !== b[k][i]) n++;
        return n;
      });
    });
  test('zoomed in, ticks are drawn a part at a time, the codes on their own canvas, exactly as a full draw', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await page.click('#sfColor');
    await idle(page);
    await page.click('#sfZin');
    await page.click('#sfZin');
    await idle(page);
    await page.waitForFunction(() => {
      const h = document.getElementById('sfLabHi');
      return h && h.style.display !== 'none' && h.width > 0;
    });
    // a part at a time: no whole-picture put while ticking
    await page.evaluate(() => {
      window.__whole = 0;
      const P = CanvasRenderingContext2D.prototype,
        o = P.putImageData;
      P.putImageData = function (im) {
        if (this.canvas.id === 'sfCanvas' && arguments.length < 7) window.__whole++;
        return o.apply(this, arguments);
      };
    });
    await tickN(page, 3);
    assert.equal(await page.evaluate(() => window.__whole), 0, 'drawn a part at a time');
    assert.deepEqual(await vsFull(page), [0, 0], 'the picture and the codes as a full draw');
    await tickN(page, 4, 3);
    assert.deepEqual(await vsFull(page), [0, 0], 'again');
    assert.deepEqual(errors, []);
  });
  test('Codes off in Colour along: the ticks are drawn the Codes-off way everywhere, as a full draw', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await page.click('#sfColor');
    await idle(page);
    // most of the page coloured: only a little left to draw a part at a time
    const n = await page.evaluate(() => __mstest.assignData.order.length);
    await tickN(page, n - 3);
    await page.click('#sfCodes');
    await idle(page);
    assert.deepEqual(await vsFull(page), [0, 0]);
    await page.click('#sfCodes');
    await idle(page);
    assert.deepEqual(await vsFull(page), [0, 0]);
    assert.deepEqual(errors, []);
  });
  test('zoomed in, leaving the guide hands the codes’ canvas back; coming back draws them again', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await page.click('#sfZin');
    await page.click('#sfZin');
    await idle(page);
    const on = () =>
      page.evaluate(() => {
        const h = document.getElementById('sfLabHi');
        return !!h && h.style.display !== 'none' && h.width > 0;
      });
    await page.waitForFunction(() => {
      const h = document.getElementById('sfLabHi');
      return h && h.style.display !== 'none' && h.width > 0;
    });
    await page.click('#mHome');
    await idle(page);
    assert.equal(await on(), false, 'handed back');
    await page.click('#mSections');
    await idle(page);
    await page.waitForFunction(
      () => {
        const h = document.getElementById('sfLabHi');
        return h && h.style.display !== 'none' && h.width > 0;
      },
      null,
      { timeout: 5000 },
    );
    assert.deepEqual(await vsFull(page), [0, 0], 'and drawn as a full draw would');
    assert.deepEqual(errors, []);
  });
}

// ---- from v305-guide.test.mjs ----
// v305 (guide): a Colour along row's outline goes once its marker is finished, and stays gone in Focus mode, the Plan
// and after zooming; Photo before its photo is chosen says the picture keeps the pattern before, with Back to it beside
// Choose a photo (and closing the picker without one goes back by itself); a new Blend's anchors sit on the drawing,
// not the paper round it, in vivid colours round the hue wheel, while a saved Blend guide reopens as it was; the
// Shading tab's drop-downs are readable in Safari's engine.
{
  const assignMap = (page) =>
    page.evaluate(() => {
      const a = __mstest.assignData.assign,
        o = {};
      for (const k in a) o[k] = a[k].mkey;
      return o;
    });
  const anchorsOf = (page) => page.evaluate(() => JSON.parse(JSON.stringify(__mstest.anchors)));
  // ---- B3 ----
  test('the open row’s outline is hidden once its marker is finished, in Colour along, Focus mode, after zooming and in the Plan', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await page.click('#sfColor');
    await idle(page);
    const outline = () =>
      page.evaluate(() => {
        const o = document.querySelector('.sfoutline');
        return o && o.style.display !== 'none' ? o.dataset.secs.split(' ').length : 0;
      });
    const i = await page.evaluate(() => {
      const t = __mstest;
      return [...document.querySelectorAll('#sfAlist .sfarow')].findIndex(
        (r) => t.assignData.order.filter((l) => t.assignData.assign[l].mkey === r.dataset.k).length >= 3,
      );
    });
    await page.locator('#sfAlist .sfarow .sfah').nth(i).click();
    await idle(page);
    const n = await outline();
    assert.ok(n >= 3, 'the open row’s sections are outlined');
    await page.click('#sfMarkAll');
    await idle(page);
    assert.equal(await outline(), 0, 'no outline once every section is ticked');
    await pause(page, 400, 'past the double-tap window');
    await page.click('#sfMarkAll');
    await idle(page);
    assert.equal(await outline(), n, 'Clear ticks outlines them again');
    await page.click('#sfMarkAll');
    await idle(page);
    await page.click('#sfZin');
    await idle(page);
    assert.equal(await outline(), 0, 'not after zooming');
    await page.click('#sfFocus');
    await idle(page);
    assert.equal(await outline(), 0, 'not in Focus mode');
    await page.keyboard.press('Escape');
    await idle(page);
    await page.click('#sfDoneBtn');
    await idle(page);
    assert.equal(await outline(), 0, 'not back in the Plan');
    assert.deepEqual(errors, []);
  });
  // ---- B7 ----
  test('Photo with no photo chosen: the picture keeps Blend’s colours, said so, with Back to Blend beside Choose a photo', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await page.click('.sftabbtn[data-t="pattern"]');
    await page.click('#sfFam [data-v="blend"]');
    await idle(page);
    const a0 = await assignMap(page),
      k0 = await anchorsOf(page);
    // (the file picker is left open, as while it's up or in a browser without its cancel event)
    await page.evaluate(() => {
      HTMLInputElement.prototype.click = function () {};
    });
    await page.click('#sfFam [data-v="photo"]');
    await idle(page);
    assert.equal(await page.getAttribute('#sfFam [data-v="photo"]', 'aria-pressed'), 'true');
    assert.equal(
      await page.textContent('#sfPhWait'),
      'Until you choose a photo, the picture keeps its Blend colours.',
    );
    assert.equal(await page.textContent('#sfPhBack'), 'Back to Blend');
    const [p, b] = [
      await page.locator('#sfPhPick').boundingBox(),
      await page.locator('#sfPhBack').boundingBox(),
    ];
    assert.ok(Math.abs(p.y - b.y) < 2 && b.x > p.x + p.width, 'side by side on one row');
    assert.deepEqual(await assignMap(page), a0, 'Blend’s colours still');
    await page.click('#sfPhBack');
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.family), 'blend');
    assert.deepEqual(await assignMap(page), a0, 'the same colours');
    assert.deepEqual(await anchorsOf(page), k0, 'and anchors');
    assert.equal(await page.locator('#sfPhWait').count(), 0);
    // (Photo straight from the start: nothing to go back to is offered for a pattern it never had)
    assert.deepEqual(errors, []);
  });
  test('closing the photo picker without a photo goes back to the pattern before; Choose a photo… closed again stays on Photo', async () => {
    const { page, errors } = await openApp({ width: 1180, height: 820 });
    await sampleGuide(page);
    await page.click('.sftabbtn[data-t="pattern"]');
    await page.click('#sfFam [data-v="random"]');
    await idle(page);
    const a0 = await assignMap(page);
    // (the picker closed without a photo: its cancel event)
    await page.evaluate(() => {
      window.__cancel = true;
      HTMLInputElement.prototype.click = function () {
        if (window.__cancel) setTimeout(() => this.dispatchEvent(new Event('cancel')), 50);
      };
    });
    await page.click('#sfFam [data-v="photo"]');
    await until(page, () => __mstest.family === 'random', null, 'back to Random');
    await idle(page);
    assert.equal(await page.getAttribute('#sfFam [data-v="random"]', 'aria-pressed'), 'true');
    assert.deepEqual(await assignMap(page), a0);
    assert.equal(await page.isVisible('#sfPlanUndo'), true, 'Random’s own step is still the one to undo');
    assert.notEqual(await page.getAttribute('#sfPlanUndo', 'aria-label'), 'Undo: Pattern: Photo');
    // the picker left open, then Choose a photo… and closed again: Photo stays, Back to Random still offered
    await page.evaluate(() => {
      window.__cancel = false;
    });
    await page.click('#sfFam [data-v="photo"]');
    await idle(page);
    await page.evaluate(() => {
      window.__cancel = true;
    });
    await page.click('#sfPhPick');
    await pause(page, 300, 'the cancel event comes and goes');
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.family), 'photo');
    assert.equal(await page.textContent('#sfPhBack'), 'Back to Random');
    // (Random's colours as they were, not shuffled afresh)
    await page.click('#sfPhBack');
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.family), 'random');
    assert.deepEqual(await assignMap(page), a0);
    assert.deepEqual(errors, []);
  });
  // ---- B8 ----
  test('a new Blend’s three anchors sit on sections of the drawing, not the paper round it, each on its own', async () => {
    const { page, errors } = await openApp({ width: 1180, height: 820 });
    await sampleGuide(page);
    await letterGuide(page);
    await page.click('.sftabbtn[data-t="pattern"]');
    await page.click('#sfFam [data-v="blend"]');
    await idle(page);
    const r = await page.evaluate(() => {
      const t = __mstest,
        inG = new Set(t.assignData.order);
      return t.anchors.map((a) => ({
        L: t.labels[Math.round(a.y) * t.W + Math.round(a.x)],
        on: inG.has(t.labels[Math.round(a.y) * t.W + Math.round(a.x)]),
      }));
    });
    assert.equal(r.length, 3);
    for (const a of r) assert.ok(a.on, 'section ' + a.L + ' is one coloured');
    assert.equal(new Set(r.map((a) => a.L)).size, 3, 'three sections');
    // Reset anchors: the same three places
    const k = await anchorsOf(page);
    await page.click('#sfResetA');
    await idle(page);
    assert.deepEqual(await anchorsOf(page), k);
    assert.deepEqual(errors, []);
  });
  test('a new Blend’s anchors are vivid markers round the hue wheel (with Ben’s 451, not the brown E713 first)', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await page.evaluate(() => {
      state.owned = defaultOwned();
      save();
      __mstest.setCollection(sfCollection());
    });
    await page.click('.sftabbtn[data-t="pattern"]');
    await page.click('#sfFam [data-v="blend"]');
    await idle(page);
    const m = await page.evaluate(() => {
      const t = __mstest,
        by = {};
      t.coll.forEach((m) => {
        by[m.mkey] = m;
      });
      const all = t.coll.map((m) => t.colour.lch(m)[1]).sort((a, b) => a - b),
        med = all[Math.floor(all.length / 2)];
      return {
        med,
        a: t.anchors.map((a) => {
          const x = t.colour.lch(by[a.mkey]);
          return { k: a.mkey, c: x[1], h: ((x[2] % 360) + 360) % 360 };
        }),
      };
    });
    assert.equal(m.a.length, 3);
    assert.ok(!m.a.some((a) => a.k === 'Ohuhu|E713'), JSON.stringify(m.a));
    for (const a of m.a) assert.ok(a.c >= m.med, a.k + ' vivid');
    for (let i = 0; i < 3; i++)
      for (let j = i + 1; j < 3; j++) {
        const d = Math.abs(m.a[i].h - m.a[j].h);
        assert.ok(Math.min(d, 360 - d) >= 60, `${m.a[i].k} and ${m.a[j].k} far apart in hue`);
      }
    assert.deepEqual(errors, []);
  });
  test('a saved Blend guide reopens with its own anchors and colours, even anchors on the paper', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await page.click('.sftabbtn[data-t="pattern"]');
    await page.click('#sfFam [data-v="blend"]');
    await idle(page);
    // (as an older version placed them: over the whole picture, one in its corner on blank paper)
    await page.evaluate(() => {
      const t = __mstest,
        k = t.anchors.map((a) => a.mkey);
      t.anchors.splice(
        0,
        3,
        { x: 3, y: 3, mkey: k[0] },
        { x: t.W * 0.75, y: t.H * 0.3, mkey: k[1] },
        { x: t.W * 0.5, y: t.H * 0.75, mkey: k[2] },
      );
      t.reassign();
    });
    await idle(page);
    await page.evaluate(() => __mstest.saveNow());
    await page.waitForFunction(() => __mstest.inLibrary);
    await idle(page);
    const id = await page.evaluate(() => __mstest.curId),
      a0 = await assignMap(page),
      k0 = await anchorsOf(page);
    await page.reload();
    await idle(page);
    await page.evaluate((id) => sfLoadDesign(id).then((d) => __mstest.openDesignObj(d, id)), id);
    await page.waitForFunction((id) => __mstest.curId === id && __mstest.assignData, id);
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.family), 'blend');
    assert.deepEqual(await anchorsOf(page), k0);
    assert.deepEqual(await assignMap(page), a0);
    assert.deepEqual(errors, []);
  });
  // ---- Shading's drop-downs in Safari's engine ----
  // (each drop-down's text against its box: the brightest or darkest pixel of its left part, away from the arrow, against
  // the box's own colour, as WCAG contrast)
  test('the Shading tab’s Highlights and Shadows drop-downs are readable (their text stands out from their box)', async () => {
    const { page, errors } = await openApp({ width: 1180, height: 820 });
    await sampleGuide(page);
    await page.click('.sftabbtn[data-t="shading"]');
    await page.evaluate(() => __mstest.shadeTo('full'));
    await idle(page);
    for (const id of ['sfHiStyle', 'sfShStyle']) {
      const el = page.locator('#' + id);
      await el.scrollIntoViewIfNeeded();
      const b = await el.boundingBox(),
        png = await page.screenshot({
          clip: { x: b.x + 4, y: b.y + 4, width: b.width * 0.5, height: b.height - 8 },
        });
      const c = await page.evaluate(
        async (src) => {
          const im = new Image();
          im.src = src;
          await im.decode();
          const cv = document.createElement('canvas');
          cv.width = im.naturalWidth;
          cv.height = im.naturalHeight;
          const g = cv.getContext('2d');
          g.drawImage(im, 0, 0);
          const d = g.getImageData(0, 0, cv.width, cv.height).data,
            n = {},
            lum = (r, gg, b) => {
              const f = (v) => {
                v /= 255;
                return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
              };
              return 0.2126 * f(r) + 0.7152 * f(gg) + 0.0722 * f(b);
            };
          let mode = null,
            mc = 0;
          for (let i = 0; i < d.length; i += 4) {
            const k = d[i] + ',' + d[i + 1] + ',' + d[i + 2];
            n[k] = (n[k] || 0) + 1;
            if (n[k] > mc) {
              mc = n[k];
              mode = [d[i], d[i + 1], d[i + 2]];
            }
          }
          const bg = lum(...mode);
          let best = 1;
          for (let i = 0; i < d.length; i += 4) {
            const l = lum(d[i], d[i + 1], d[i + 2]),
              r = (Math.max(l, bg) + 0.05) / (Math.min(l, bg) + 0.05);
            if (r > best) best = r;
          }
          return best;
        },
        'data:image/png;base64,' + png.toString('base64'),
      );
      assert.ok(c >= 4.5, `${id}: contrast ${c.toFixed(2)}`);
      assert.equal(await el.evaluate((s) => getComputedStyle(s).colorScheme), 'dark');
    }
    assert.deepEqual(errors, []);
  });
}
