// A guide’s Pattern: Random, Blend, Gradient, Balance, Leave white.
// (v320) Tests organised by feature: each block below came from the file named above it, its tests unchanged.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  answerAsks,
  idle,
  letterGuide,
  longPress,
  openApp,
  openAtScale,
  sampleGuide,
  saveGuide,
  scrollTop,
  sectionPoint,
  setup,
  teardown,
  welcome,
} from './helpers.mjs';

before(setup);
after(teardown);

// ---- from v315-specks.test.mjs ----
// v315 (Q11): a Gradient's markers seen only on specks are named on the Pattern tab, last, with what spreads them and
// Show them, which rings their sections (Hide them, or the plan laid again, takes the rings away). Not when scattered,
// nor for a marker only on sections you pinned. Fails on v314.1, which said nothing.
{
  const lay = (page, o) =>
    page.evaluate((o) => {
      Object.assign(__mstest.styleVars, { family: 'gradient', gradShape: 'serpentine', gradScat: 0 }, o);
      __mstest.reassign();
    }, o);
  const line = (page) =>
    page.evaluate(() => {
      const e = document.getElementById('sfSpeck');
      return e ? e.textContent : null;
    });
  const rings = (page) => page.$$eval('.sfspecks .sfring', (a) => a.length);
  test('the Letter page at 24 markers: the speck marker named, its section ringed with Show them; gone when laid again, scattered or pinned', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await welcome(page, 'look');
    await idle(page);
    await page.click('#mSections');
    await idle(page);
    await letterGuide(page);
    await answerAsks(page);
    await page.click('#sfTab-pattern');
    await lay(page, { limitN: 8 });
    await idle(page);
    assert.equal(await line(page), null, 'none at 8');
    await lay(page, { limitN: 24 });
    await idle(page);
    assert.match(
      await line(page),
      /^\S+ only colours specks of this page\. Fewer markers would spread the colours further\. Show them$/,
    );
    await page.click('#sfSpeckShow');
    await idle(page);
    assert.ok((await rings(page)) >= 1, 'ringed');
    assert.equal(await page.textContent('#sfSpeckShow'), 'Hide them');
    // another tab: the rings go; back on Pattern, they're back
    await page.click('#sfTab-colours');
    await idle(page);
    assert.equal(await rings(page), 0, 'not on the Colours tab');
    await page.click('#sfTab-pattern');
    await idle(page);
    assert.ok((await rings(page)) >= 1, 'back on Pattern');
    await page.click('#sfSpeckShow');
    await idle(page);
    assert.equal(await rings(page), 0, 'Hide them');
    await page.click('#sfSpeckShow');
    await idle(page);
    await lay(page, { limitN: 24, gradShape: 'serpentine' });
    await idle(page);
    assert.equal(await rings(page), 0, 'laid again: the rings go');
    // Sparkle: specks are the look
    await lay(page, { limitN: 24, gradScat: 3 });
    await idle(page);
    assert.equal(await line(page), null, 'not when scattered');
    // the speck marker's sections pinned: not named
    await lay(page, { limitN: 24, gradScat: 0 });
    await idle(page);
    await page.evaluate(() => {
      const t = __mstest,
        A = t.assignData.assign,
        a = {};
      let all = 0;
      for (const l of t.assignData.order) {
        a[A[l].mkey] = (a[A[l].mkey] || 0) + t.comps[l].area;
        all += t.comps[l].area;
      }
      for (const l of t.assignData.order) if (a[A[l].mkey] < 0.003 * all) t.locks[l] = A[l].mkey;
      t.renderControls();
    });
    await idle(page);
    assert.equal(await line(page), null, 'only on pinned sections');
    assert.deepEqual(errors, []);
  });
}

// ---- from v31817.test.mjs ----
// v318.17 in the browser: Pattern's More options on a phone, ＋ Zone at the tab's end, the Flow pictures; Shadows only
// per zone; Blender highlights; Lean towards. Fails on v318.16.
{
  const tab = async (page, t) => {
    await page.click(`.sftabbtn[data-t="${t}"]`);
    await idle(page);
  };
  const bigSecs = (page, n) =>
    page.evaluate((n) => {
      const t = __mstest,
        H = t.H;
      return Object.keys(t.assignData.assign)
        .map(Number)
        .filter((l) => t.comps[l].cy < H * 0.3)
        .sort((a, b) => t.comps[b].area - t.comps[a].area)
        .slice(0, n);
    }, n);
  async function tapSec(page, l) {
    await scrollTop(page);
    const p = await sectionPoint(page, l);
    await page.mouse.click(p.x, p.y);
    await idle(page);
  }
  test('Pattern on a phone: More options for Gradient, Random and Blend, not Photo or Manual; ＋ Zone last; Flow pictures', async () => {
    const { page, errors } = await openApp({ width: 390, height: 844, moreShut: true });
    await sampleGuide(page);
    await tab(page, 'pattern');
    await page.click('#sfFam [data-v="gradient"]');
    await idle(page);
    assert.equal(await page.getAttribute('#sfMore-pattern', 'aria-expanded'), 'false');
    for (const id of ['#sfDir', '#sfGradScat']) assert.equal(await page.isVisible(id), false, id);
    for (const id of ['#sfShape', '#sfLook', '#sfVary', '#sfZoneAdd'])
      assert.equal(await page.isVisible(id), true, id);
    // the Flow buttons: a picture above each word, heard as the word
    const flow = await page.$$eval('#sfShape button', (b) =>
      b.map((x) => [
        x.textContent,
        x.querySelector('svg') && x.querySelector('svg').getAttribute('aria-hidden'),
      ]),
    );
    assert.deepEqual(flow, [
      ['Serpentine', 'true'],
      ['Vertical', 'true'],
      ['Diagonal', 'true'],
      ['Radial', 'true'],
      ['Around', 'true'],
    ]);
    // ＋ Zone after Shuffle and Pin; the heading heard first
    const order = await page.evaluate(() => {
      const p = document.getElementById('sfPanel-pattern'),
        all = [...p.querySelectorAll('h3, #sfFam, #sfLock, #sfZoneAdd')];
      return all.map((e) => e.id || e.textContent);
    });
    assert.deepEqual(order, ['Colour pattern', 'sfFam', 'sfLock', 'sfZoneAdd']);
    await page.click('#sfMore-pattern');
    assert.equal(await page.isVisible('#sfDir'), true);
    for (const [f, bar] of [
      ['random', true],
      ['blend', true],
      // (Photo keeps the pattern before until a photo is chosen: its bar too)
      ['manual', false],
    ]) {
      await page.click(`#sfFam [data-v="${f}"]`);
      await idle(page);
      assert.equal(!!(await page.$('#sfMore-pattern')), bar, f);
    }
    await page.setViewportSize({ width: 820, height: 1180 });
    await page.waitForTimeout(300);
    await page.click('#sfFam [data-v="gradient"]');
    await idle(page);
    assert.equal(await page.$('#sfMore-pattern'), null, 'an iPad: nothing folded');
    assert.deepEqual(errors, []);
  });
  test('Shadows only per zone: Bell None, Main keeps its highlights; Undo names it', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    // a zone
    await tab(page, 'pattern');
    await page.click('#sfZoneAdd');
    await idle(page);
    await page.fill('#sfZoneName', 'Bell');
    await page.press('#sfZoneName', 'Enter');
    await idle(page);
    for (const l of await bigSecs(page, 2)) await tapSec(page, l);
    await page.click('#sfZoneDone');
    await idle(page);
    await tab(page, 'shading');
    await page.click('#sfShade [data-v="soft"]');
    await idle(page);
    const bell = await page.evaluate(() => __mstest.zones[0].id);
    // (Bell is the zone chosen as it's made: a tap on its chip would open its editor)
    assert.equal(await page.evaluate(() => __mstest.zoneCur), bell);
    await page.selectOption('#sfHiStyle', 'none');
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.planLabel), 'Bell: Highlights: None (shadows only)');
    const r = await page.evaluate((bell) => {
      const t = __mstest,
        inBell = (l) => t.zoneOf(l) === bell,
        ls = t.countedList().filter((l) => t.shadeSec(l));
      return {
        mode: t.shadeMode,
        bellH: ls.filter(inBell).some((l) => t.shadeSec(l).light),
        mainH: ls.filter((l) => !inBell(l)).some((l) => t.shadeSec(l).light),
        any: t.shAnyHi(),
      };
    }, bell);
    assert.deepEqual(r, { mode: 'full', bellH: false, mainH: true, any: true });
    assert.match(await page.textContent('#sfPanel-shading'), /Bell is shadows only/);
    // Undo: Bell's highlights back
    await page.keyboard.press('Control+z');
    await idle(page);
    assert.equal(await page.evaluate((bell) => __mstest.zsh(bell).hilite, bell), 'same');
    assert.deepEqual(errors, []);
  });
  test('Blender highlights: offered with a Colorless Blender; the H is the 0; Colour along has its step', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await tab(page, 'shading');
    await page.click('#sfShade [data-v="soft"]');
    await idle(page);
    const opts = await page.$$eval('#sfHiStyle option', (o) => o.map((x) => x.value));
    assert.ok(opts.includes('blender'), opts.join());
    await page.selectOption('#sfHiStyle', 'blender');
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.planLabel), 'Highlights: Blender (0)');
    const r = await page.evaluate(() => {
      const t = __mstest,
        l = t.countedList().find((l) => t.shadeSec(l) && t.shadeSec(l).light),
        s = t.shadeSec(l);
      return { code: s.light.code, blender: s.blender, req: t.shadeReq(l) & 1, buy: !!s.wantLight };
    });
    assert.deepEqual(r, { code: '0', blender: true, req: 1, buy: false });
    assert.match(await page.textContent('#sfPanel-shading'), /The 0 on the highlight first/);
    assert.deepEqual(errors, []);
  });
  test('Lean towards: Any, Cool, Warm (v318.18: the themes are their own row, e2e/v31818); one Undo step', async () => {
    const { page, errors } = await openApp({ width: 390, height: 844 });
    await sampleGuide(page);
    await tab(page, 'colours');
    assert.deepEqual(await page.$$eval('#sfPal button', (b) => b.map((x) => x.textContent)), [
      'Any',
      'Cool',
      'Warm',
    ]);
    await page.click('#sfPal [data-v="cool"]');
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.styleVars.palette), 'cool');
    assert.equal(await page.evaluate(() => __mstest.planLabel), 'Lean towards: Cool');
    await page.keyboard.press('Control+z');
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.styleVars.palette), 'all');
    assert.deepEqual(errors, []);
  });
}

// ---- from v31826-w3.test.mjs ----
// v318.26 (W3): Leave white. A section's tip has a third button, Leave white: the section is the paper from then on,
// through Shuffle, Mood, every pattern and a zone laid again, out of the key, Colour along and the counts, and saved;
// its tip says Left white, with Colour it. Undo and Redo; Manual's Change colour has Leave white beside Unpin; Blend's
// press and hold. The tip's three buttons fit it at 320 px with large text. Fails on v318.25 (no Leave white).
{
  // big sections whose label points are well inside the picture (not under the zoom row), biggest first
  const bigSections = (page, n = 6) =>
    page.evaluate((n) => {
      const t = __mstest,
        c = document.getElementById('sfCanvas'),
        r = c.getBoundingClientRect(),
        z = document.getElementById('sfZoomCtl').getBoundingClientRect();
      return t.assignData.order
        .filter((l) => {
          const q = t.labelPos(l),
            y = r.top + (q.y / c.height) * r.height,
            x = r.left + (q.x / c.width) * r.width;
          return (
            y > r.top + 12 &&
            y < (z.top > r.top + 20 ? Math.min(r.bottom, z.top) : r.bottom) - 12 &&
            x > r.left + 12 &&
            x < r.right - 12
          );
        })
        .sort((a, b) => t.comps[b].area - t.comps[a].area)
        .slice(0, n);
    }, n);
  async function tap(page, l) {
    await scrollTop(page);
    const p = await sectionPoint(page, l);
    await page.mouse.click(p.x, p.y);
    await idle(page);
  }
  const tab = (page, t) => page.click(`.sftabbtn[data-t="${t}"]`);
  async function pattern(page, v) {
    await tab(page, 'pattern');
    await page.click(`#sfFam [data-v="${v}"]`);
    await idle(page);
  }
  // the state of section l: its marker, white pin, paper, place in the order; and the guide's count
  const sec = (page, l) =>
    page.evaluate((l) => {
      const t = __mstest,
        a = t.assignData;
      return {
        m: a.assign[l] ? a.assign[l].mkey : null,
        w: t.whitePins[l] ?? null,
        paper: !!(a.paper && a.paper[l]),
        inOrder: a.order.includes(l),
        N: a.N,
        lock: t.locks[l] ?? null,
        tick: t.colored[l],
      };
    }, l);
  // the canvas pixel at the section's label point
  const px = (page, l) =>
    page.evaluate((l) => {
      const c = document.getElementById('sfCanvas'),
        q = __mstest.labelPos(l);
      return [...c.getContext('2d').getImageData(Math.round(q.x), Math.round(q.y), 1, 1).data].slice(0, 3);
    }, l);
  const isPaper = (p) =>
    p[0] >= 240 && p[1] >= 237 && p[2] >= 230 && Math.abs(p[0] - 247) <= 6 && Math.abs(p[2] - 238) <= 8;
  const vsFull = (page) =>
    page.evaluate(() => {
      const c = document.getElementById('sfCanvas'),
        g = c.getContext('2d');
      __mstest.renderGuide();
      const a = g.getImageData(0, 0, c.width, c.height).data.slice();
      __mstest.forceFullRender();
      __mstest.renderGuide();
      const b = g.getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++;
      return n;
    });
  const photoFile = (page) =>
    page
      .evaluate(() => {
        const c = document.createElement('canvas');
        c.width = 64;
        c.height = 48;
        const g = c.getContext('2d');
        for (let i = 0; i < 4; i++) {
          g.fillStyle = ['#c33', '#3a6', '#36c', '#dc3'][i];
          g.fillRect((i % 2) * 32, (i >> 1) * 24, 32, 24);
        }
        return c.toDataURL('image/png').split(',')[1];
      })
      .then((b) => ({ name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from(b, 'base64') }));
  test('Leave white from the tip: white on the page, one section fewer, out of Colour along; kept through Shuffle, Mood, Random and Photo; Undo, Redo, Colour it', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    const [l] = await bigSections(page, 1),
      s0 = await sec(page, l);
    await tap(page, l);
    assert.deepEqual(await page.$$eval('.sftip [data-a]', (b) => b.map((x) => x.textContent)), [
      'Change colour',
      'Pin',
      'Leave white',
    ]);
    await page.click('.sftip [data-a="white"]');
    await idle(page);
    let s = await sec(page, l);
    assert.deepEqual([s.m, s.w, s.paper, s.inOrder, s.N], [null, s0.m, true, false, s0.N - 1]);
    assert.ok(isPaper(await px(page, l)), 'the paper at its label point: ' + (await px(page, l)));
    // the white tip: Left white, Colour it (the keyboard on it)
    assert.equal(await page.getAttribute('.sftip', 'aria-label'), 'Section left white');
    assert.match(await page.textContent('.sftip'), /Left white/);
    assert.deepEqual(await page.$$eval('.sftip [data-a]', (b) => b.map((x) => x.textContent)), ['Colour it']);
    assert.equal(await page.evaluate(() => document.activeElement.dataset.a), 'colour');
    assert.equal(
      await page.evaluate(() => document.getElementById('sfPlanUndo').getAttribute('aria-label')),
      'Undo: Section left white',
    );
    assert.equal(await vsFull(page), 0, 'partial redraw matches a full one');
    // laid again every way: still white
    await page.mouse.click(5, 5);
    await idle(page);
    await tab(page, 'pattern');
    await page.click('#sfVary');
    await idle(page);
    assert.equal((await sec(page, l)).w, s0.m, 'Shuffle');
    await tab(page, 'colours');
    await page.click('#sfMood [data-v="vivid"]');
    await idle(page);
    assert.equal((await sec(page, l)).m, null, 'Mood');
    await page.click('#sfSurprise');
    await idle(page);
    assert.equal((await sec(page, l)).m, null, 'Surprise');
    await pattern(page, 'random');
    assert.equal((await sec(page, l)).m, null, 'Random');
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#sfFam [data-v="photo"]')]);
    await fc.setFiles(await photoFile(page));
    await page.waitForFunction(() => !!__mstest.photoRef && !__mstest.photoChecking);
    await idle(page);
    if (await page.evaluate(() => __mstest.photoAlign)) {
      await page.click('#sfPhAlign');
      await idle(page);
    }
    s = await sec(page, l);
    assert.deepEqual([s.m, s.paper, s.N], [null, true, s0.N - 1], 'Photo');
    await pattern(page, 'gradient');
    assert.ok(isPaper(await px(page, l)));
    // Colour along: no row has it, the count is one fewer
    const along = await page.evaluate((l) => {
      const t = __mstest;
      return t.assignData.order.includes(l);
    }, l);
    assert.equal(along, false);
    // Colour it, then Undo (white again), Redo (coloured again)
    await tap(page, l);
    await page.click('.sftip [data-a="colour"]');
    await idle(page);
    s = await sec(page, l);
    assert.deepEqual([s.m, s.w, s.paper, s.inOrder, s.N, s.lock], [s0.m, null, false, true, s0.N, null]);
    assert.deepEqual(
      await page.$$eval('.sftip [data-a]', (b) => b.map((x) => x.textContent)),
      ['Change colour', 'Pin', 'Leave white'],
      'its usual tip',
    );
    await page.click('#sfPlanUndo');
    await idle(page);
    assert.equal((await sec(page, l)).w, s0.m, 'Undo: white again');
    await page.click('#sfPlanRedo');
    await idle(page);
    assert.equal((await sec(page, l)).m, s0.m, 'Redo: coloured again');
    assert.equal(await vsFull(page), 0);
    assert.deepEqual(errors, []);
  });
  test('a ticked section left white is unticked, and Undo brings back its marker, pin and tick; the white pin is saved and opens again', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await saveGuide(page);
    const [l, l2] = await bigSections(page, 2),
      s0 = await sec(page, l);
    await page.evaluate((l) => {
      __mstest.colored[l] = 1;
    }, l);
    await tap(page, l);
    await page.click('.sftip [data-a="pin"]');
    await idle(page);
    await page.click('.sftip [data-a="white"]');
    await idle(page);
    let s = await sec(page, l);
    assert.deepEqual([s.m, s.tick, s.lock], [null, 0, null]);
    await page.click('#sfPlanUndo');
    await idle(page);
    s = await sec(page, l);
    assert.deepEqual([s.m, s.tick, s.lock, s.w], [s0.m, 1, s0.m, null]);
    // left white again (another one too), saved, and the page reloaded: still white
    await page.click('#sfPlanRedo');
    await idle(page);
    await tap(page, l2);
    await page.click('.sftip [data-a="white"]');
    await idle(page);
    await page.evaluate(() => __mstest.flushSave());
    const id = await page.evaluate(() => __mstest.curId);
    const st = await page.evaluate(
      (id) => IDB.get('guide-' + id).then((p) => p && { white: p.white, paper: p.paper }),
      id,
    );
    assert.ok(st.white && st.white[l] === s0.m && st.paper.includes(l), 'saved: ' + JSON.stringify(st));
    await page.reload();
    await idle(page);
    await page.click('#mHome');
    await page.click('#homeLibCard');
    await idle(page);
    await page.click(`#savedList .srow[data-id="${id}"] .sname`);
    await page.waitForFunction((id) => __mstest.curId === id && __mstest.assignData, id);
    // (part-way coloured, it opens in Colour along)
    if (await page.evaluate(() => __mstest.sfmode === 'color')) await page.click('#sfDoneBtn');
    await idle(page);
    s = await sec(page, l);
    assert.deepEqual([s.m, s.w, s.paper, s.inOrder], [null, s0.m, true, false], 'reopened white');
    assert.ok((await sec(page, l2)).w, 'the other too');
    assert.equal(s.N, s0.N - 2);
    assert.ok(isPaper(await px(page, l)));
    assert.deepEqual(errors, []);
  });
  test('Manual: Change colour has Leave white beside Unpin; a tap on a white section shows Left white · Colour it', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await pattern(page, 'manual');
    const [l] = await bigSections(page, 1),
      s0 = await sec(page, l);
    await tap(page, l);
    await page.waitForSelector('#sfSheet', { state: 'visible' });
    assert.equal(await page.textContent('#sfPopWhite'), 'Leave white');
    // with a pin, Unpin (allow fill) is there too, both on the one line
    await page.click('#sfPopCancel');
    await idle(page);
    await page.evaluate(
      ([l, k]) => {
        __mstest.locks[l] = k;
      },
      [l, s0.m],
    );
    await tap(page, l);
    await page.waitForSelector('#sfPopExtra', { state: 'visible' });
    const r = await page.evaluate(() => {
      const a = document.getElementById('sfPopExtra').getBoundingClientRect(),
        b = document.getElementById('sfPopWhite').getBoundingClientRect(),
        sh = document.getElementById('sfSheet').getBoundingClientRect();
      return { same: Math.abs(a.top - b.top) < 4, inside: b.right <= sh.right + 1 && a.left >= sh.left - 1 };
    });
    assert.ok(r.same && r.inside, JSON.stringify(r));
    await page.click('#sfPopWhite');
    await idle(page);
    assert.ok(!(await page.isVisible('#sfSheet')), 'the picker closes');
    const s = await sec(page, l);
    assert.deepEqual([s.m, s.w, s.N, s.lock], [null, s0.m, s0.N - 1, null]);
    assert.equal(
      await page.evaluate(() => document.getElementById('sfPlanUndo').getAttribute('aria-label')),
      'Undo: Section left white',
    );
    await page.mouse.click(5, 5);
    await idle(page);
    await tap(page, l);
    assert.ok(!(await page.isVisible('#sfSheet')), 'no picker for a white section');
    assert.deepEqual(await page.$$eval('.sftip [data-a]', (b) => b.map((x) => x.textContent)), ['Colour it']);
    await page.click('.sftip [data-a="colour"]');
    await idle(page);
    assert.equal((await sec(page, l)).m, s0.m);
    assert.deepEqual(errors, []);
  });
  test('Blend: press and hold a white section shows its tip; anchors laid again keep it white', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    const [l] = await bigSections(page, 1);
    await tap(page, l);
    await page.click('.sftip [data-a="white"]');
    await idle(page);
    await pattern(page, 'blend');
    assert.equal((await sec(page, l)).m, null);
    await scrollTop(page);
    const p = await sectionPoint(page, l);
    await longPress(page, p.x, p.y);
    await idle(page);
    assert.deepEqual(await page.$$eval('.sftip [data-a]', (b) => b.map((x) => x.textContent)), ['Colour it']);
    await page.evaluate(() => __mstest.assign.blendNow());
    await idle(page);
    assert.equal((await sec(page, l)).m, null);
    assert.deepEqual(errors, []);
  });
  test('with a zone and shading: the zone laid again keeps it white; the three buttons fit the tip at 320 px with large text', async () => {
    const { page, errors } = await openAtScale(1.6, { width: 320, height: 568 });
    await sampleGuide(page);
    await idle(page);
    const [l, l2] = await page.evaluate(() => {
      const t = __mstest;
      return t.assignData.order
        .slice()
        .sort((a, b) => t.comps[b].area - t.comps[a].area)
        .slice(1, 3);
    });
    // a zone with l in it, and shading on
    await page.evaluate(
      ([l, l2]) => {
        const t = __mstest,
          A = t.assign,
          z = A.zoneNew();
        A.zoneSelect(z.id);
        t.reassign(t.zoneMove([l, l2], z.id));
        t.locks[l] = t.assignData.assign[l].mkey;
      },
      [l, l2],
    );
    await tab(page, 'shading');
    await page.click('#sfShade [data-v="soft"]');
    await idle(page);
    await tap(page, l);
    const fit = await page.evaluate(() => {
      const t = document.querySelector('.sftip'),
        r = t.getBoundingClientRect(),
        v = document.getElementById('sfView').getBoundingClientRect();
      const bs = [...t.querySelectorAll('.sftipbtn')].map((b) => b.getBoundingClientRect());
      return {
        r: [r.left, r.top, r.right, r.bottom].map(Math.round),
        v: [v.left, v.top, v.right, v.bottom].map(Math.round),
        n: bs.length,
        inTip: bs.every(
          (b) => b.left >= r.left - 0.5 && b.right <= r.right + 0.5 && b.bottom <= r.bottom + 0.5,
        ),
        inView: r.left >= v.left - 0.5 && r.right <= v.right + 0.5 && r.top >= 0 && r.bottom <= innerHeight,
        zone: !!t.querySelector('.sftipzone'),
        rows: new Set(bs.map((b) => Math.round(b.top))).size,
      };
    });
    assert.equal(fit.n, 3);
    assert.ok(fit.inTip, 'every button inside the tip');
    // (inside the picture's width, and on the screen: with shading's tones and the zone line at this text size the tip
    // is taller than the picture's frame here, as it was with two buttons in v318.25)
    assert.ok(fit.inView, 'the tip on the screen: ' + JSON.stringify(fit));
    assert.ok(fit.zone, 'with its zone line');
    assert.equal(fit.rows, 2, 'Leave white on a row of its own');
    await page.click('.sftip [data-a="white"]');
    await idle(page);
    assert.equal((await sec(page, l)).lock, null, 'its pin goes');
    // the zone laid again (Shuffle with the zone chosen), and all of them (Mood)
    await tab(page, 'pattern');
    await page.click('#sfVary');
    await idle(page);
    assert.equal((await sec(page, l)).m, null, 'the zone laid again');
    assert.ok((await sec(page, l2)).m, 'its other section has a marker');
    await page.evaluate(() => __mstest.layPlan(null));
    await idle(page);
    assert.equal((await sec(page, l)).m, null);
    assert.ok(isPaper(await px(page, l)) || (await px(page, l))[0] > 200, 'paper (shading leaves it white)');
    assert.equal(await vsFull(page), 0);
    assert.deepEqual(errors, []);
  });
  test('the last unticked section left white finishes the page', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    const [l] = await bigSections(page, 1);
    // every other section ticked, then the last one left white
    await page.evaluate((l) => {
      const t = __mstest;
      for (const x of t.assignData.order) if (x !== l) t.colored[x] = 1;
    }, l);
    await tap(page, l);
    await page.click('.sftip [data-a="white"]');
    await idle(page);
    const done = await page.evaluate(() => {
      const t = __mstest;
      return t.assignData.order.every((x) => t.colored[x]);
    });
    assert.ok(done, 'every section with a marker is ticked');
    await page.mouse.click(5, 5);
    await page.click('#sfColor');
    await idle(page);
    assert.equal(await page.isVisible('#sfDone'), true, 'Page finished');
    assert.match(await page.textContent('#sfDone'), /finished/i);
    assert.deepEqual(errors, []);
  });
}

// ---- from v31827-v2.test.mjs ----
// v318.27: Random's "Keep touching sections clearly different" on the sample, roll after roll. The test in
// random-and-blend.test.mjs rolls a few times from one seed (7), which happened to be a clean one: before v318.27, Main
// colour left touching sections alike on many rolls (by its pairing: up to 9 in 12 at the sample's 16 markers, every roll
// at 8), and No repeats on some. Here each roll is laid from a seed of its own, for Mixed, Main colour and No repeats;
// which sections touch is worked out here, the test's own way (as random-and-blend.test.mjs does). And where too few
// markers can't keep them apart, the note under the box says so (#sfNoAdjNote), and More options' bar doesn't claim it.
{
  const click = (page, sel) => page.evaluate((sel) => document.querySelector(sel).click(), sel);
  const tab = async (page, t) => {
    await page.click(`.sftabbtn[data-t="${t}"]`);
    await idle(page);
  };
  // the guide's touching pairs among its sections, found by walking right and down across the line from every pixel at a
  // section's edge, up to a 40th of the picture's longer side: two sections touch when they meet along 6 px or more
  const touching = (page) =>
    page.evaluate(() => {
      const t = __mstest,
        L = t.labels,
        W = t.W,
        H = t.H,
        D = Math.round(Math.max(W, H) / 40),
        cnt = new Map();
      const walk = (x, y, dx, dy, l) => {
        for (let k = 1; k <= D; k++) {
          const X = x + dx * k,
            Y = y + dy * k;
          if (X >= W || Y >= H) return;
          const r = L[Y * W + X];
          if (r === l) return;
          if (r >= 1) {
            const key = Math.min(l, r) + ',' + Math.max(l, r);
            cnt.set(key, (cnt.get(key) || 0) + 1);
            return;
          }
        }
      };
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          const l = L[y * W + x];
          if (l < 1) continue;
          if (x + 1 < W && L[y * W + x + 1] !== l) walk(x, y, 1, 0, l);
          if (y + 1 < H && L[(y + 1) * W + x] !== l) walk(x, y, 0, 1, l);
        }
      const inG = new Set(t.assignData.order);
      return [...cnt]
        .filter(([, n]) => n >= 6)
        .map(([k]) => k.split(',').map(Number))
        .filter(([a, b]) => inG.has(a) && inG.has(b));
    });
  // `rolls` layings of the plan (as Shuffle lays it), each from its own seed: the rolls with touching pairs on one marker
  // or on markers alike by eye (CIEDE2000 under 10), and the rolls the note under the box showed on
  const roll = (page, pairs, limitN, rolls) =>
    page.evaluate(
      ({ pairs, limitN, rolls }) => {
        const t = __mstest,
          R = Math.random,
          bad = [],
          noted = [];
        t.styleVars.limitN = limitN;
        for (let s = 1; s <= rolls; s++) {
          let a = s * 7919;
          Math.random = function () {
            a = (a + 0x6d2b79f5) | 0;
            let q = Math.imul(a ^ (a >>> 15), 1 | a);
            q = (q + Math.imul(q ^ (q >>> 7), 61 | q)) ^ q;
            return ((q ^ (q >>> 14)) >>> 0) / 4294967296;
          };
          try {
            t.reassign();
          } finally {
            Math.random = R;
          }
          const as = t.assignData.assign;
          let n = 0;
          for (const [p, q] of pairs)
            if (as[p] && as[q] && (as[p].mkey === as[q].mkey || de2000(as[p].lab, as[q].lab) < 10)) n++;
          if (n) bad.push('seed ' + s + ': ' + n);
          if (document.getElementById('sfNoAdjNote')) noted.push('seed ' + s);
        }
        return { bad, noted };
      },
      { pairs, limitN, rolls },
    );
  test('Random on the sample, 24 rolls each from its own seed: Mixed, Main colour and No repeats keep touching sections clearly different', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await tab(page, 'pattern');
    await click(page, '#sfFam [data-v="random"]');
    await idle(page);
    await click(page, '#sfBal [data-v="mixed"]');
    await idle(page);
    await click(page, '#sfNoAdj');
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.styleVars.noAdj), true);
    const pairs = await touching(page);
    assert.ok(pairs.length > 40, pairs.length + ' touching pairs');
    const out = {};
    for (const limitN of [8, 16]) out['Mixed ' + limitN] = await roll(page, pairs, limitN, 24);
    // (Main colour: its pairing (Other pairings) set, as choosing Main colour draws one at random. Before v318.27, of
    // these at 16 markers 0.15 left touching sections alike on 5 rolls in 12, 0.25 and 0.75 on 6 to 9; at 8, 0.85 on 4)
    await click(page, '#sfBal [data-v="main"]');
    await idle(page);
    const pairing = (bs) =>
      page.evaluate((bs) => {
        __mstest.styleVars.balSeed = bs;
      }, bs);
    for (const bs of [0.15, 0.25, 0.75]) {
      await pairing(bs);
      out['Main colour ' + bs + ' 16'] = await roll(page, pairs, 16, 24);
    }
    await pairing(0.85);
    out['Main colour 0.85 8'] = await roll(page, pairs, 8, 24);
    await click(page, '#sfBal [data-v="mixed"]');
    await idle(page);
    await click(page, '#sfNoRep');
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.styleVars.noRep), true);
    out['No repeats'] = await roll(page, pairs, 16, 24);
    for (const k in out) assert.deepEqual(out[k], { bad: [], noted: [] }, k);
    // (and Shuffle itself, tapped: still none)
    await click(page, '#sfNoRep');
    await idle(page);
    await click(page, '#sfBal [data-v="main"]');
    await idle(page);
    await pairing(0.25);
    // (v319: each tap from a seed of its own, as the rolls above are. Unseeded, about 1 tap in 100 leaves one touching
    // pair alike with the note under the box saying so, as v318.31 did too: 4 of 400 seeds measured; the test failed
    // now and then on GitHub when a tap hit one)
    for (let r = 0; r < 4; r++) {
      await page.evaluate((r) => {
        const R = Math.random;
        let a = (r + 1) * 104729 + 17;
        Math.random = function () {
          a = (a + 0x6d2b79f5) | 0;
          let q = Math.imul(a ^ (a >>> 15), 1 | a);
          q = (q + Math.imul(q ^ (q >>> 7), 61 | q)) ^ q;
          return ((q ^ (q >>> 14)) >>> 0) / 4294967296;
        };
        try {
          document.querySelector('#sfShuffle').click();
        } finally {
          Math.random = R;
        }
      }, r);
      await idle(page);
      const n = await page.evaluate((pairs) => {
        const as = __mstest.assignData.assign;
        return pairs.filter(([p, q]) => as[p].mkey === as[q].mkey || de2000(as[p].lab, as[q].lab) < 10)
          .length;
      }, pairs);
      assert.equal(n, 0, 'Shuffle ' + r);
    }
    assert.deepEqual(errors, []);
  });
  // (v320) the four Shuffle seeds that left two touching sections alike before: Main colour, pairing 0.25, 16
  // markers. The main colour's five markers are only two colours apart at ΔE 10, so a section touching both needs its
  // neighbours moved too: the repair now searches two rings deep (adjSearch), where it used to try one swap
  test('Main colour: the seeds that left touching sections alike before now keep them apart (v320)', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await tab(page, 'pattern');
    await click(page, '#sfFam [data-v="random"]');
    await idle(page);
    await click(page, '#sfBal [data-v="main"]');
    await idle(page);
    await click(page, '#sfNoAdj');
    await idle(page);
    const pairs = await touching(page);
    await page.evaluate(() => {
      __mstest.styleVars.balSeed = 0.25;
      __mstest.styleVars.limitN = 16;
    });
    for (const s of [76, 109, 274, 386]) {
      const n = await page.evaluate(
        ({ s, pairs }) => {
          const t = __mstest,
            R = Math.random;
          let a = s * 104729 + 17;
          Math.random = function () {
            a = (a + 0x6d2b79f5) | 0;
            let q = Math.imul(a ^ (a >>> 15), 1 | a);
            q = (q + Math.imul(q ^ (q >>> 7), 61 | q)) ^ q;
            return ((q ^ (q >>> 14)) >>> 0) / 4294967296;
          };
          try {
            t.reassign();
          } finally {
            Math.random = R;
          }
          const as = t.assignData.assign;
          return pairs.filter(([p, q]) => as[p].mkey === as[q].mkey || de2000(as[p].lab, as[q].lab) < 10)
            .length;
        },
        { s, pairs },
      );
      assert.equal(n, 0, 'seed ' + s);
    }
    assert.deepEqual(errors, []);
  });
  test('Main colour with a pairing whose colours have too few markers at 8: every roll that leaves touching sections alike says so under the box', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await tab(page, 'pattern');
    await click(page, '#sfFam [data-v="random"]');
    await idle(page);
    await click(page, '#sfBal [data-v="main"]');
    await idle(page);
    await click(page, '#sfNoAdj');
    await idle(page);
    const pairs = await touching(page);
    // (browns, reds and a teal: the accent's marker is never given to the others' sections, so a section touching
    // all of its role's few markers keeps one)
    await page.evaluate(() => {
      __mstest.styleVars.balSeed = 0.05;
    });
    const r = await roll(page, pairs, 8, 12);
    assert.ok(r.bad.length > 0, "some rolls can't");
    // (v320: every roll left with a pair alike says so. The note may also be up for a pair the app counts as
    // neighbours that this count misses, a short touch or one across a thick line (seed 12: sections 33 and 39);
    // v320's deeper repair, adjSearch, leaves fewer of the others)
    const bad = r.bad.map((b) => b.split(':')[0]);
    assert.deepEqual(
      bad.filter((s) => !r.noted.includes(s)),
      [],
      JSON.stringify(r),
    );
    assert.deepEqual(errors, []);
  });
  test('too few markers to keep touching sections apart: the note under the box says how many, and goes when there are enough', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await tab(page, 'pattern');
    await click(page, '#sfFam [data-v="random"]');
    await idle(page);
    await click(page, '#sfBal [data-v="mixed"]');
    await idle(page);
    await click(page, '#sfNoAdj');
    await idle(page);
    assert.equal(await page.locator('#sfNoAdjNote').count(), 0, 'none at 16 markers');
    // (on a phone the box is under More options, whose bar says what's on)
    const sum = () => page.textContent('#sfMore-pattern .fb-sum');
    assert.equal(await sum(), 'Kept apart');
    // (2 markers: three sections that all touch one another can't all be different)
    await page.evaluate(() => {
      __mstest.styleVars.limitN = 2;
    });
    await click(page, '#sfShuffle');
    await idle(page);
    const n = await page.evaluate(() => __mstest.assign.adjLeft['0']);
    assert.ok(n > 1, n + ' left');
    const note = page.locator('#sfNoAdjNote');
    assert.equal(
      (await note.textContent()).trim(),
      n + ' touching sections couldn’t be kept clearly different: too few different markers.',
    );
    assert.equal(await sum(), 'Mostly kept apart');
    // (it sits under the box)
    const box = await page.locator('label:has(#sfNoAdj)').boundingBox(),
      nb = await note.boundingBox();
    assert.ok(nb && box && nb.y >= box.y + box.height - 1, JSON.stringify([box, nb]));
    // (off: nothing's claimed, no note)
    await click(page, '#sfNoAdj');
    await idle(page);
    assert.equal(await page.locator('#sfNoAdjNote').count(), 0, 'off');
    await click(page, '#sfNoAdj');
    await idle(page);
    assert.equal(await page.locator('#sfNoAdjNote').count(), 1, 'on again');
    await page.evaluate(() => {
      __mstest.styleVars.limitN = 16;
    });
    await click(page, '#sfShuffle');
    await idle(page);
    assert.equal(await page.locator('#sfNoAdjNote').count(), 0, 'enough markers');
    assert.equal(await sum(), 'Kept apart');
    assert.deepEqual(errors, []);
  });
}

// ---- from v31832-g4.test.mjs ----
// v318.32 (G4): Random's Pattern panel, the small clear wins from Ben's iPad pass: Balance's row fills the width as
// Pattern's other rows do, a line under it says what Mixed and Main colour do, the role bar is a group screen readers
// hear, No repeats' note is said in full, and Colours' greyed count says why.
{
  async function random(page) {
    await page.click('.sftabbtn[data-t="pattern"]');
    await idle(page);
    await page.click('#sfFam [data-v="random"]');
    await idle(page);
  }
  test('iPad upright: Balance fills its row like Flow and Look, says what the chosen one does, and the role bar is a named group', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180, touch: true, moreShut: true });
    await sampleGuide(page);
    await idle(page);
    await random(page);
    // the row: both buttons about half the panel, as Direction's Forward and Reversed are
    const w = await page.evaluate(() => {
      const row = document.getElementById('sfFam').getBoundingClientRect().width,
        b = [...document.querySelectorAll('#sfBal .sfedit')].map((x) => x.getBoundingClientRect().width);
      return { row, b, cls: document.getElementById('sfBal').className };
    });
    assert.match(w.cls, /\bsffit\b/, w.cls);
    assert.ok(w.b.length === 2 && w.b.every((x) => x > w.row * 0.4), JSON.stringify(w));
    // the line under it, for each
    assert.equal(await page.getAttribute('#sfBal [data-v="main"]', 'aria-pressed'), 'true');
    assert.equal(
      (await page.textContent('#sfBalHint')).trim(),
      'One colour over most of the picture, a second with it and an accent.',
    );
    // (v318.34: the rows, #sfBalRows; the bar before)
    assert.equal(await page.getAttribute('#sfBalRows', 'role'), 'group');
    assert.equal(await page.getAttribute('#sfBalRows', 'aria-label'), 'Main, second and accent colours');
    await page.click('#sfBal [data-v="mixed"]');
    await idle(page);
    assert.equal(
      (await page.textContent('#sfBalHint')).trim(),
      'Any marker on any section, all mixed together.',
    );
    assert.equal(await page.$('#sfBalRows'), null);
    assert.deepEqual(errors, []);
  });
  test('No repeats: its note is said in full, and Colours’ greyed count says why (gone when No repeats is off)', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180, touch: true, moreShut: true });
    await sampleGuide(page);
    await idle(page);
    await random(page);
    await page.click('#sfBal [data-v="mixed"]');
    await idle(page);
    await page.click('.sftabbtn[data-t="colours"]');
    await idle(page);
    assert.equal(await page.$('#sfMkNrNote'), null, 'no note before No repeats');
    await page.click('.sftabbtn[data-t="pattern"]');
    await idle(page);
    await page.click('#sfNoRep');
    await idle(page);
    // (the sample's 166 sections on Honolulu 120's markers: fewer markers than sections, so the fuller line)
    const note = (await page.textContent('#sfNoRepNote')).trim();
    assert.match(
      note,
      /^\d+ sections, \d+ markers: (?:each used about \d+ times|\d+ used twice), each used once before any is used again, kept apart\./,
      note,
    );
    await page.click('.sftabbtn[data-t="colours"]');
    await idle(page);
    assert.match(await page.textContent('#sfMkNlbl'), /one per section/);
    assert.equal(
      (await page.textContent('#sfMkNrNote')).trim(),
      'No repeats is on (Pattern): every section its own marker.',
    );
    assert.ok(await page.isVisible('#sfMkNrNote'));
    // off again: the note goes with it
    await page.click('.sftabbtn[data-t="pattern"]');
    await idle(page);
    await page.click('#sfNoRep');
    await idle(page);
    await page.click('.sftabbtn[data-t="colours"]');
    await idle(page);
    assert.equal(await page.$('#sfMkNrNote'), null);
    assert.deepEqual(errors, []);
  });
}

// ---- from v31834-balance-rows.test.mjs ----
// v318.34 (Stage 3 E, decision 5a): Guide › Pattern › Random › Main colour shows its roles as rows under a thin share
// strip ("Main colour · pinks · about 60% · Auto ›", or "Your choice"), each 44 px and opening the role's sheet; a
// screen reader hears "Main colour: pinks, about 60%, Auto. Change". Random's own action row holds Shuffle and, with
// Main colour laid, ↻ Other pairings with a line telling the two apart; Pin colours stays below, shared by every pattern.
{
  async function random(page) {
    await page.click('.sftabbtn[data-t="pattern"]');
    await idle(page);
    await page.click('#sfFam [data-v="random"]');
    await idle(page);
  }
  const rect = (page, sel) =>
    page.evaluate((s) => {
      const e = document.querySelector(s);
      return e ? e.getBoundingClientRect().toJSON() : null;
    }, sel);
  const fam = (page, r) => page.evaluate((r) => __mstest.balName(r, __mstest.balPlan()).toLowerCase(), r);
  // (the share as the row says it: measured, to the nearest 5, as e2e/balance's measured())
  const pc = (page, r) =>
    page.evaluate((r) => {
      const t = __mstest,
        f = t.balMeasure(t.balPlan()).f[r];
      return Math.round(f * 20) * 5;
    }, r);
  const rows = (page) =>
    page.$$eval('#sfBalRows .sfbalr', (b) =>
      b.map((x) => ({
        id: x.id,
        t: x.innerText.replace(/\s+/g, ' ').trim(),
        lab: x.getAttribute('aria-label'),
        h: x.getBoundingClientRect().height,
      })),
    );
  for (const [name, vp] of [
    ['iPad upright', { width: 820, height: 1180, touch: true, moreShut: true }],
    ['phone', { width: 390, height: 844, touch: true, moreShut: true }],
  ]) {
    test(`${name}: a strip, then three 44 px rows that say role, family, share and Auto; each opens its sheet; a family picked by hand reads "Your choice"`, async () => {
      const { page, errors } = await openApp(vp);
      await sampleGuide(page);
      await idle(page);
      await random(page);
      assert.equal(await page.getAttribute('#sfBal [data-v="main"]', 'aria-pressed'), 'true');
      // the strip: one part a role, no words
      assert.equal(await page.getAttribute('.sfbalstrip', 'aria-hidden'), 'true');
      assert.equal(await page.$$eval('.sfbalstrip i', (b) => b.length), 3);
      assert.equal((await page.textContent('.sfbalstrip')).trim(), '');
      const r0 = await rows(page);
      assert.deepEqual(
        r0.map((x) => x.id),
        ['sfBalM', 'sfBalS', 'sfBalA'],
      );
      for (const [i, r, role] of [
        [0, 'm', 'Main colour'],
        [1, 's', 'Second colour'],
        [2, 'a', 'Accent'],
      ]) {
        const f = await fam(page, r),
          share = 'about ' + (await pc(page, r)) + '%';
        assert.equal(r0[i].t, role + ' · ' + f + ' · ' + share + ' · Auto');
        assert.equal(r0[i].lab, role + ': ' + f + ', ' + share + ', Auto. Change');
        assert.ok(r0[i].h >= 44, role + ' row ' + r0[i].h + 'px');
      }
      // (the old bar's parts are gone)
      assert.equal(await page.$('#sfBalBar, .sfbalseg'), null);
      // each row opens the role's sheet, titled for it
      for (const [r, role] of [
        ['m', 'Main colour'],
        ['s', 'Second colour'],
        ['a', 'Accent'],
      ]) {
        await page.click('#sfBal' + r.toUpperCase());
        await page.waitForSelector('#sfSheet.sfbalsh');
        await idle(page);
        assert.equal(
          await page.textContent('#sfSheetT'),
          role + ': ' + (await fam(page, r)) + ' · about ' + (await pc(page, r)) + '%',
        );
        assert.equal(await page.getAttribute('#sfSheet .sfbalopt[data-k="auto"]', 'aria-pressed'), 'true');
        await page.keyboard.press('Escape');
        await page.waitForSelector('#sfSheet', { state: 'detached' });
      }
      // the second colour picked by hand (a family no other role has: one that is would swap them): its row says
      // Your choice, the others stay Auto
      await page.click('#sfBalS');
      await page.waitForSelector('#sfSheet.sfbalsh');
      await idle(page);
      const pick = await page.$$eval('#sfSheet .sfbalopt', (b) =>
        b
          .filter(
            (x) =>
              x.dataset.k !== 'auto' &&
              !x.disabled &&
              x.getAttribute('aria-pressed') !== 'true' &&
              !/they swap/.test(x.textContent),
          )
          .map((x) => x.dataset.k),
      );
      assert.ok(pick.length, 'another family to pick');
      await page.click(`#sfSheet .sfbalopt[data-k="${pick[0]}"]`);
      await idle(page);
      const r1 = await rows(page);
      assert.equal(
        r1[1].t,
        'Second colour · ' + (await fam(page, 's')) + ' · about ' + (await pc(page, 's')) + '% · Your choice',
      );
      assert.equal(
        r1[1].lab,
        'Second colour: ' +
          (await fam(page, 's')) +
          ', about ' +
          (await pc(page, 's')) +
          '%, Your choice. Change',
      );
      assert.match(r1[0].t, / · Auto$/);
      assert.match(r1[2].t, / · Auto$/);
      assert.equal(await page.evaluate(() => document.activeElement.id), 'sfBalS', 'focus back on the row');
      assert.deepEqual(errors, []);
    });
  }
  test('Random’s own action row: Shuffle, and with Main colour laid Other pairings with its line; Mixed has Shuffle alone; Pin colours stays below, shared', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180, touch: true, moreShut: true });
    await sampleGuide(page);
    await idle(page);
    await random(page);
    const sh = await rect(page, '#sfShuffle'),
      pr = await rect(page, '#sfBalPair'),
      pin = await rect(page, '#sfLock');
    assert.ok(sh && pr && pin, 'all three there');
    assert.ok(
      Math.abs(sh.top - pr.top) < 1 && sh.right <= pr.left,
      'Shuffle and Other pairings side by side',
    );
    assert.ok(sh.bottom <= pin.top, 'Pin colours under them');
    assert.equal(
      (await page.textContent('#sfBalRollNote')).trim(),
      'Shuffle lays the same colours again · Other pairings picks new colours for the roles on Auto',
    );
    const note = await rect(page, '#sfBalRollNote');
    assert.ok(sh.bottom <= note.top && note.bottom <= pin.top, 'the line between the row and Pin colours');
    // (Shuffle in the row, not the shared block: the shared block holds Pin colours alone)
    assert.equal(await page.$('#sfShuffle + #sfLock'), null);
    assert.equal(
      await page.evaluate(() => document.getElementById('sfLock').parentElement.children.length),
      1,
    );
    assert.ok(sh.height >= 44 && pr.height >= 44 && pin.height >= 44, 'tap targets');
    // Mixed: no roles, so no Other pairings and no line; Shuffle and Pin colours stay
    await page.click('#sfBal [data-v="mixed"]');
    await idle(page);
    assert.equal(await page.$('#sfBalPair'), null);
    assert.equal(await page.$('#sfBalRollNote'), null);
    assert.equal(await page.$('#sfBalRows'), null);
    assert.ok((await rect(page, '#sfShuffle')) && (await rect(page, '#sfLock')));
    // Gradient and Manual keep theirs as they were
    await page.click('#sfFam [data-v="gradient"]');
    await idle(page);
    assert.ok(await page.$('#sfVary'));
    assert.equal(await page.$('#sfShuffle, #sfBalPair, #sfBalRollNote'), null);
    assert.deepEqual(errors, []);
  });
}
