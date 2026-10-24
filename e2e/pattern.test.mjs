// A guide’s Pattern: Random, Blend, Gradient, Balance, Leave white.
// (v320) Tests organised by feature: each block below came from the file named above it, its tests unchanged.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  WK,
  answerAsks,
  buildGo,
  haveSet,
  idle,
  letterGuide,
  notOnWebKit,
  openApp,
  sampleGuide,
  saveGuide,
  scrollTop,
  setup,
  shot,
  teardown,
  until,
} from './helpers.mjs';

before(setup);
after(teardown);

// ---- from balance.test.mjs ----
// Random's Balance (v283): Pattern › Random › Balance (Mixed | Main colour). With Main colour the three roles (v318.34:
// a strip of their shares and a row each, "Main colour · pinks · about 60% · Auto"; a bar of three coloured buttons
// before; tap one to choose its colour family, or Auto), ↻ Other pairings, and a line of what's used; with Mixed, No
// repeats.
// The engine itself is covered by test/balance.test.mjs.
{
  async function random(page) {
    await page.click('.sftabbtn[data-t="pattern"]');
    await idle(page);
    await page.click('#sfFam [data-v="random"]');
    await idle(page);
  }
  const plan = (page) =>
    page.evaluate(() => {
      const p = __mstest.balPlan();
      return p.ok
        ? { keys: ['m', 's', 'a'].map((r) => (p.roles[r] ? p.roles[r].k : '-')).join('/'), used: p.used }
        : null;
    });
  // each role's share of the picture's area, in whole percent
  const shares = (page) =>
    page.evaluate(() => {
      const t = __mstest,
        p = t.balPlan(),
        a = t.assignData,
        role = {},
        r = { m: 0, s: 0, a: 0, x: 0 };
      let tot = 0;
      ['m', 's', 'a'].forEach(
        (k) =>
          p.roles[k] &&
          p.roles[k].markers.forEach((m) => {
            role[m.mkey] = k;
          }),
      );
      a.order.forEach((l) => {
        const k = role[a.assign[l].mkey] || 'x',
          ar = t.comps[l].area;
        r[k] += ar;
        tot += ar;
      });
      for (const k in r) r[k] = Math.round((100 * r[k]) / tot);
      return r;
    });
  const undoLabel = (page) => page.getAttribute('#sfPlanUndo', 'aria-label');
  // what the rows should say: each role's measured share (f, whole percent), to the nearest 5 (pc), and its short name (n)
  const measured = (page) =>
    page.evaluate(() => {
      const t = __mstest,
        p = t.balPlan(),
        ms = t.balMeasure(p),
        o = { f: {}, pc: {}, n: {}, sliver: {} };
      ['m', 's', 'a'].forEach((r) => {
        if (!p.roles[r]) return;
        o.f[r] = Math.round(ms.f[r] * 100);
        o.pc[r] = Math.round(ms.f[r] * 20) * 5;
        o.n[r] = t.balShort(r);
        o.sliver[r] = ms.f[r] > 0 && ms.f[r] < 0.025;
      });
      return o;
    });
  test('Random starts on Main colour: three role rows about 60/30/10 of the picture, a line of what it uses, and the picture laid that way', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await random(page);
    assert.equal(await page.getAttribute('#sfBal [data-v="main"]', 'aria-pressed'), 'true');
    assert.equal(await undoLabel(page), 'Undo: Pattern: Random');
    // (v318.34: a row each, its words in full; the strip above them as wide as each share)
    const rows = await page.$$eval('#sfBalRows .sfbalr', (b) =>
      b.map((x) => ({
        r: x.dataset.r,
        t: x.innerText.replace(/\s+/g, ' ').trim(),
        lab: x.getAttribute('aria-label'),
      })),
    );
    assert.deepEqual(
      rows.map((s) => s.r),
      ['m', 's', 'a'],
    );
    const segs = await page.$$eval('.sfbalstrip i', (b) =>
      b.map((x) => ({ w: x.getBoundingClientRect().width })),
    );
    // (v284: what's painted, to the nearest 5, within 5 of 60/30/10)
    const want = await measured(page);
    const fam = (r) => page.evaluate((r) => __mstest.balName(r, __mstest.balPlan()).toLowerCase(), r);
    assert.equal(rows[0].t, 'Main colour · ' + (await fam('m')) + ' · about ' + want.pc.m + '% · Auto');
    assert.equal(rows[1].t, 'Second colour · ' + (await fam('s')) + ' · about ' + want.pc.s + '% · Auto');
    assert.equal(rows[2].t, 'Accent · ' + (await fam('a')) + ' · about ' + want.pc.a + '% · Auto');
    assert.ok(
      Math.abs(want.f.m - 60) <= 5 && Math.abs(want.f.s - 30) <= 5 && Math.abs(want.f.a - 10) <= 5,
      JSON.stringify(want.f),
    );
    assert.ok(
      segs[0].w > segs[1].w * 1.5 && segs[1].w > segs[2].w * 1.4,
      'the strip’s widths follow the shares',
    );
    assert.equal(
      rows[0].lab,
      'Main colour: ' + (await fam('m')) + ', about ' + want.pc.m + '%, Auto. Change',
    );
    assert.match(
      await page.textContent('#sfBalNote'),
      /^\d+ [a-z-]+s?(?:, with [^,]*)?, \d+ [a-z-]+s?(?:, with [^,]*)? and \d+ [a-z-]+s?(?:, with .*)? (?:of yours|from the catalogue)\./,
    );
    const r = await shares(page);
    assert.ok(
      Math.abs(r.m - 60) <= 4 && Math.abs(r.s - 30) <= 4 && Math.abs(r.a - 10) <= 4 && r.x === 0,
      JSON.stringify(r),
    );
    // Keep touching sections clearly different is still there; No repeats is Mixed's
    assert.ok(await page.$('#sfNoAdj'));
    assert.equal(await page.$('#sfNoRep'), null);
    assert.deepEqual(errors, []);
  });
  test('a part of the bar opens its colour families (Auto first); choosing one lays it again, one Undo step, Temperature greys out; a family another role has swaps them', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await random(page);
    const before = await plan(page);
    await page.click('#sfBalM');
    await page.waitForSelector('#sfSheet.sfbalsh');
    await idle(page);
    assert.equal(
      await page.textContent('#sfSheetT'),
      'Main colour: ' +
        (await page.evaluate(() => __mstest.balName('m', __mstest.balPlan()).toLowerCase())) +
        ' · about ' +
        (await measured(page)).pc.m +
        '%',
    );
    const opts = await page.$$eval('#sfSheet .sfbalopt', (b) =>
      b.map((x) => [x.dataset.k, x.getAttribute('aria-pressed')]),
    );
    assert.deepEqual(opts[0], ['auto', 'true']);
    assert.ok(opts.length >= 8, 'the families there are');
    assert.equal(
      await page.evaluate(() => document.activeElement.dataset.k),
      'auto',
      'the choice there is has the focus',
    );
    // a family nobody has
    const [m0, s0] = before.keys.split('/');
    const pick = opts
      .map((o) => o[0])
      .find((k) => k !== 'auto' && k !== 'grey' && !before.keys.split('/').includes(k));
    await page.click(`#sfSheet .sfbalopt[data-k="${pick}"]`);
    await idle(page);
    assert.equal(await page.$('#sfSheet'), null);
    assert.equal((await plan(page)).keys.split('/')[0], pick);
    assert.match(await undoLabel(page), new RegExp('^Undo: Main colour: '));
    assert.equal(await page.evaluate(() => document.activeElement.id), 'sfBalM');
    assert.match(
      await page.getAttribute('#sfBalM', 'aria-label'),
      new RegExp(
        '^Main colour: [a-z][a-z -]+, about ' + (await measured(page)).pc.m + '%, Your choice\\. Change$',
      ),
    );
    // Temperature: the colours are chosen, so it greys out and says why
    await page.click('.sftabbtn[data-t="colours"]');
    await idle(page);
    assert.equal(await page.isDisabled('#sfPal [data-v="cool"]'), true);
    assert.match(await page.textContent('#sfPanel-colours'), /Main colour sets this/);
    await page.click('.sftabbtn[data-t="pattern"]');
    await idle(page);
    // the second's family chosen for the main colour: they swap (a second chosen by hand takes the main colour's)
    await page.click('#sfBalS');
    await page.waitForSelector('#sfSheet.sfbalsh');
    await page.click(`#sfSheet .sfbalopt[data-k="${s0 === pick ? m0 : s0}"]`);
    await idle(page);
    const k1 = (await plan(page)).keys.split('/');
    await page.click('#sfBalM');
    await page.waitForSelector('#sfSheet.sfbalsh');
    assert.match(
      await page.textContent(`#sfSheet .sfbalopt[data-k="${k1[1]}"]`),
      /now the second colour: they swap/,
    );
    await page.click(`#sfSheet .sfbalopt[data-k="${k1[1]}"]`);
    await idle(page);
    const k2 = (await plan(page)).keys.split('/');
    assert.deepEqual([k2[0], k2[1]], [k1[1], k1[0]]);
    // Undo, step by step
    await page.click('#sfPlanUndo');
    await idle(page);
    assert.deepEqual((await plan(page)).keys.split('/').slice(0, 2), k1.slice(0, 2));
    // Escape closes the sheet with nothing changed
    await page.click('#sfBalA');
    await page.waitForSelector('#sfSheet.sfbalsh');
    assert.equal(await page.$('#sfSheet .sfbalopt[data-k="grey"]'), null, 'no grey accent');
    await page.keyboard.press('Escape');
    await page.waitForSelector('#sfSheet', { state: 'detached' });
    assert.deepEqual((await plan(page)).keys.split('/').slice(0, 2), k1.slice(0, 2));
    assert.deepEqual(errors, []);
  });
  test('↻ Other pairings rolls the roles left on Auto for a different pairing; Shuffle keeps the colours and lays them again', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await random(page);
    const a = await plan(page);
    await page.click('#sfBalPair');
    await idle(page);
    const b = await plan(page);
    assert.notEqual(b.keys, a.keys);
    assert.equal(await undoLabel(page), 'Undo: Other pairings');
    const asg = () =>
      page.evaluate(() =>
        JSON.stringify(
          __mstest.assignData.order
            .slice()
            .sort((a, b) => a - b)
            .map((l) => l + ':' + __mstest.assignData.assign[l].mkey),
        ),
      );
    const x = await asg();
    await page.click('#sfShuffle');
    await idle(page);
    assert.equal((await plan(page)).keys, b.keys, 'the same colours');
    assert.notEqual(await asg(), x, 'laid again');
    // every role chosen by hand: nothing left to roll
    await page.evaluate(() => {
      const v = __mstest.styleVars,
        p = __mstest.balPlan();
      v.balM = p.roles.m.k;
      v.balS = p.roles.s.k;
      v.balA = p.roles.a.k;
      __mstest.reassign();
    });
    await idle(page);
    assert.equal(await page.isDisabled('#sfBalPair'), true);
    assert.deepEqual(errors, []);
  });
  test('Mixed is Random as it was; No repeats gives every section its own marker, the count says "one per section"; both are one Undo step', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await random(page);
    await page.click('#sfBal [data-v="mixed"]');
    await idle(page);
    assert.equal(await undoLabel(page), 'Undo: Balance: Mixed');
    assert.equal(await page.$('#sfBalRows'), null);
    assert.equal(await page.isChecked('#sfNoRep'), false);
    const distinct = () =>
      page.evaluate(() => {
        const a = __mstest.assignData;
        return [a.order.length, new Set(a.order.map((l) => a.assign[l].mkey)).size];
      });
    const [n0, k0] = await distinct();
    assert.ok(k0 <= 16, 'Mixed: the marker count’s worth, repeated');
    await page.check('#sfNoRep');
    await idle(page);
    assert.equal(await undoLabel(page), 'Undo: No repeats on');
    const [n, k] = await distinct();
    assert.equal(n, n0);
    const pool = await page.evaluate(() => __mstest.noRepPool(__mstest.countedList()).length);
    assert.equal(k, Math.min(n, pool));
    assert.match(
      await page.textContent('#sfNoRepNote'),
      k >= n
        ? /^Every section has its own marker: \d+\./
        : /^\d+ sections, \d+ markers: (?:each used about \d+ times|\d+ used twice), each used once before any is used again, kept apart\./,
    );
    await page.click('.sftabbtn[data-t="colours"]');
    await idle(page);
    assert.match(await page.textContent('#sfMkNlbl'), /one per section/);
    assert.equal(await page.isDisabled('#sfMkCount'), true);
    assert.match(await page.textContent('#sfPanel-colours .sfpoolct'), /one per section/);
    await page.click('.sftabbtn[data-t="pattern"]');
    await idle(page);
    // (Main colour has no No repeats)
    await page.click('#sfBal [data-v="main"]');
    await idle(page);
    assert.equal(await page.$('#sfNoRep'), null);
    assert.deepEqual(errors, []);
  });
  test('saved with the guide and opened as it was; a Random guide saved before Balance opens Mixed, as it looked', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await random(page);
    await page.click('#sfBalM');
    await page.waitForSelector('#sfSheet.sfbalsh');
    await page.click('#sfSheet .sfbalopt[data-k="blue"]');
    await idle(page);
    const d = await page.evaluate(() => __mstest.currentDesignObj());
    assert.equal(d.payload.style.balance, 'main');
    assert.equal(d.payload.style.balM, 'blue');
    await saveGuide(page);
    const id = await page.evaluate(() => __mstest.curId);
    const asg = await page.evaluate(() =>
      JSON.stringify(
        __mstest.assignData.order
          .slice()
          .sort((a, b) => a - b)
          .map((l) => l + ':' + __mstest.assignData.assign[l].mkey),
      ),
    );
    await page.reload();
    await idle(page);
    await page.evaluate((id) => loadGuide({ id }), id);
    await page.waitForFunction((id) => __mstest.curId === id && __mstest.assignData, id);
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.styleVars.balM), 'blue');
    assert.equal(
      await page.evaluate(() =>
        JSON.stringify(
          __mstest.assignData.order
            .slice()
            .sort((a, b) => a - b)
            .map((l) => l + ':' + __mstest.assignData.assign[l].mkey),
        ),
      ),
      asg,
      'its colours as they were',
    );
    // a guide from before v283: no balance saved
    await page.evaluate(() => {
      const t = __mstest,
        d = t.currentDesignObj(),
        p = d.payload;
      ['balance', 'balM', 'balS', 'balA', 'balSeed', 'noRep'].forEach((k) => delete p.style[k]);
      t.openDesignObj(Object.assign({}, p, { name: 'Old', W: d.W, H: d.H }), null);
    });
    await page.waitForFunction(() => __mstest.curName === 'Old');
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.styleVars.balance), 'mixed');
    await page.click('.sftabbtn[data-t="pattern"]');
    await idle(page);
    assert.equal(await page.getAttribute('#sfBal [data-v="mixed"]', 'aria-pressed'), 'true');
    assert.deepEqual(errors, []);
  });
  test('zones: each has its own Balance; a zone of fewer than 10 sections has no accent of its own, and says so', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await random(page);
    await page.click('#sfBal [data-v="mixed"]');
    await idle(page);
    await page.click('#sfZoneAdd');
    await idle(page);
    await page.evaluate(() => {
      const t = __mstest,
        cl = Object.keys(t.assignData.assign)
          .map(Number)
          .sort((a, b) => t.comps[b].area - t.comps[a].area)
          .slice(0, 6);
      t.zoneMove(cl, t.zoneCur);
      t.reassign([0, t.zoneCur]);
    });
    await page.click('#sfZoneDone');
    await idle(page);
    // the new zone copies Main's Balance; Main colour for it
    assert.equal(await page.evaluate(() => __mstest.styleVars.balance), 'mixed');
    await page.click('#sfBal [data-v="main"]');
    await idle(page);
    assert.match(await page.textContent('#sfBalNote'), /Too few sections for an accent of their own\./);
    await page.click('#sfPanel-pattern .sfzchip[data-z="0"]');
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.styleVars.balance), 'mixed', 'Main keeps its own');
    assert.deepEqual(errors, []);
  });
  test('the rows by keyboard: each a button that opens its sheet; Surprise sometimes picks Random with a main colour, and says so', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await random(page);
    await page.focus('#sfBalS');
    await page.keyboard.press('Enter');
    await page.waitForSelector('#sfSheet.sfbalsh');
    await idle(page);
    assert.equal(
      await page.textContent('#sfSheetT'),
      'Second colour: ' +
        (await page.evaluate(() => __mstest.balName('s', __mstest.balPlan()).toLowerCase())) +
        ' · about ' +
        (await measured(page)).pc.s +
        '%',
    );
    await page.keyboard.press('Escape');
    await page.waitForSelector('#sfSheet', { state: 'detached' });
    assert.equal(await page.evaluate(() => document.activeElement.id), 'sfBalS');
    // Surprise: Random with a main colour about one time in three
    let got = null;
    for (let i = 0; i < 30 && !got; i++) {
      await page.click('#sfSurprise');
      await idle(page);
      if ((await page.evaluate(() => __mstest.styleVars.family)) === 'random') got = await undoLabel(page);
    }
    assert.ok(got, 'Random in 30 goes');
    assert.match(got, /Surprise: .+ · Random: [a-z-]+s/);
    assert.equal(await page.evaluate(() => __mstest.styleVars.balance), 'main');
    assert.deepEqual(errors, []);
  });
  test('v284, a saved palette: a colour far from the others is an accent, the rows follow what Shuffle paints; a main colour of one marker says so, and Add shades turns Expand on', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await random(page);
    await page.evaluate(() => {
      const t = __mstest,
        by = {};
      t.coll.forEach((m) => {
        const f = t.balFamOf(m);
        (by[f] = by[f] || []).push(m.mkey);
      });
      state.saved.unshift({
        id: 884001,
        type: 'palette',
        name: 'Five',
        keys: [by.blue[0], by.blue[Math.floor(by.blue.length / 2)], by.teal[0], by.orange[0], by.pink[0]],
        ts: 884001,
      });
      state.saved.unshift({
        id: 884002,
        type: 'palette',
        name: 'Two',
        keys: [by.blue[0], by.orange[0]],
        ts: 884002,
      });
      save();
      Object.assign(t.styleVars, { paletteSource: 'saved', savedPalId: 884001, expand: false });
      t.reassign();
    });
    await idle(page);
    // (v318.34: the rows say the family and the share in full; nothing to cut short)
    const bar = () =>
      page.$$eval('#sfBalRows .sfbalr', (b) =>
        b.map((x) => ({ t: x.innerText.replace(/\s+/g, ' ').trim() })),
      );
    const check = async () => {
      const w = await measured(page),
        t = await bar(),
        rs = Object.keys(w.pc);
      const full = { m: 'Main colour', s: 'Second colour', a: 'Accent' };
      for (let i = 0; i < rs.length; i++) {
        const r = rs[i],
          pct = (w.sliver[r] ? 'under 5' : 'about ' + w.pc[r]) + '%';
        const nm = await page.evaluate((r) => __mstest.balName(r, __mstest.balPlan()).toLowerCase(), r);
        assert.equal(t[i].t, full[r] + ' · ' + nm + ' · ' + pct + ' · Auto');
      }
      return w;
    };
    const w = await check();
    assert.ok(w.f.a <= 25, 'the accent a pop of colour: ' + JSON.stringify(w.f));
    // (a share 8 points or more off what was asked says why)
    const miss = await page.evaluate(() => __mstest.balMeasure(__mstest.balPlan()).miss);
    assert.equal(!!(await page.$('#sfBalMiss')), miss >= 0.08, 'miss ' + miss);
    assert.match(await page.textContent('#sfBalNote'), /^The palette’s 5 markers: blues the main colour, /);
    await page.click('#sfShuffle');
    await idle(page);
    await check();
    // two colours: one marker for the main colour
    await page.evaluate(() => {
      __mstest.styleVars.savedPalId = 884002;
      __mstest.reassign();
    });
    await idle(page);
    assert.match(
      await page.textContent('#sfBalOne'),
      /^One [a-z-]+ marker for the main colour, so touching [a-z-]+ sections will merge\. Add shades$/,
    );
    await check();
    await page.click('#sfBalShades');
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.styleVars.expand), true);
    assert.ok((await page.evaluate(() => __mstest.styleVars.limitN)) >= 6);
    assert.equal(await page.$('#sfBalShades'), null);
    assert.match(await undoLabel(page), /^Undo: /);
    assert.deepEqual(errors, []);
  });
}

// ---- from gradient-start.test.mjs ----
// The Gradient's Start colour (v277): when the gradient goes right round the colour wheel, a slider over the loop's
// colours chooses which one the flow starts with; it's hidden for an open ramp. It's the same setting Shuffle turns
// (gradSeed), so it's saved with the guide and taken back by Undo.
{
  const slider = (page) =>
    page.evaluate(() => {
      const g = document.getElementById('sfGStart');
      return g
        ? {
            v: +g.value,
            max: +g.max,
            vt: g.getAttribute('aria-valuetext'),
            note: document.getElementById('sfGStartLbl').textContent,
            name: document.getElementById('sfGStartC').textContent,
          }
        : null;
    });
  const setStart = (page, k) =>
    page.evaluate((k) => {
      const g = document.getElementById('sfGStart');
      g.value = k;
      g.dispatchEvent(new Event('input', { bubbles: true }));
      g.dispatchEvent(new Event('change', { bubbles: true }));
    }, k);
  // the marker where the flow starts (the first section in flow order) and the loop's k-th marker from its smoothest start
  const first = (page) => page.evaluate(() => __mstest.assignData.assign[__mstest.assignData.order[0]].mkey);
  const loopAt = (page, k) => page.evaluate((k) => __mstest.gradStartInfo().cols[k].mkey, k);
  test('Start colour: the flow starts with the colour chosen, either way round; the note says where the biggest step went', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await page.click('.sftabbtn[data-t="pattern"]');
    await idle(page);
    const s0 = await slider(page);
    assert.ok(s0, 'shown: the sample runs right round the colour wheel');
    assert.equal(s0.v, 0, 'the smoothest start to begin with');
    assert.equal(s0.note, '', 'nothing to say about the biggest step at the smoothest start');
    assert.equal(s0.name, s0.vt, 'the colour is named beside the label');
    assert.equal(await first(page), await loopAt(page, 0));
    const k = Math.min(5, s0.max);
    await setStart(page, k);
    await idle(page);
    const s1 = await slider(page);
    assert.equal(s1.v, k, 'the slider stays where it was put');
    assert.equal(await first(page), await loopAt(page, k), 'the flow starts with that colour');
    assert.equal(s1.name, s1.vt, 'the name follows the slider');
    assert.match(s1.note, /biggest colour step .* is now inside the picture/);
    assert.equal(
      s1.vt,
      await page.evaluate((k) => __mstest.gradStartSay(__mstest.gradStartInfo(), k), k),
      'a screen reader hears the colour, not a number',
    );
    // Reversed: the same colour is where the reversed flow starts
    await page.click('#sfDir [data-d="-1"]');
    await idle(page);
    assert.equal((await slider(page)).v, k);
    assert.equal(
      await first(page),
      await loopAt(page, k),
      'Direction turns the flow round, the start colour goes with it',
    );
    assert.deepEqual(errors, []);
  });
  test('Start colour: by keyboard, one colour a step; Undo takes it back; Shuffle moves the slider too', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await page.click('.sftabbtn[data-t="pattern"]');
    await idle(page);
    await page.focus('#sfGStart');
    await page.keyboard.press('ArrowRight');
    await idle(page);
    assert.equal((await slider(page)).v, 1);
    assert.equal(await first(page), await loopAt(page, 1));
    assert.equal(
      await page.evaluate(() => document.activeElement.id),
      'sfGStart',
      'focus stays on the slider',
    );
    assert.match(
      await page.getAttribute('#sfPlanUndo', 'aria-label'),
      /^Undo: Start colour: /,
      'Undo says what it takes back',
    );
    await page.click('#sfPlanUndo');
    await idle(page);
    assert.equal((await slider(page)).v, 0, 'Undo puts the start back');
    assert.equal(await first(page), await loopAt(page, 0));
    await page.click('#sfVary');
    await idle(page);
    const s = await slider(page);
    assert.notEqual(s.v, 0, 'Shuffle turns the start (never almost where it was)');
    assert.equal(await first(page), await loopAt(page, s.v), 'and the slider shows where to');
    assert.deepEqual(errors, []);
  });
  test("Start colour: hidden for an open ramp (Warm doesn't go round the wheel); saved with the guide", async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await page.click('.sftabbtn[data-t="pattern"]');
    await idle(page);
    await setStart(page, 3);
    await idle(page);
    const seed = await page.evaluate(() => __mstest.styleVars.gradSeed);
    assert.ok(seed > 0);
    assert.equal(
      await page.evaluate(() => __mstest.styleSave('style').gradSeed),
      seed,
      "kept in the guide's style (saved with it)",
    );
    await page.click('.sftabbtn[data-t="colours"]');
    await page.click('#sfPal [data-v="warm"]');
    await idle(page);
    await page.click('.sftabbtn[data-t="pattern"]');
    await idle(page);
    assert.equal(await slider(page), null, 'no Start colour for a ramp');
    assert.deepEqual(errors, []);
  });
}

// ---- from gradient.test.mjs ----
// The Gradient pattern (js/guide/30-palette-assign.js) and its two rows: Look (Pattern tab: Auto, Smooth, Light to
// dark) and Mood (Colours tab: Any, Bright, Soft, Pastel, Deep, Earthy, which replaced Intensity). Which markers a
// gradient uses and the line that says so, loop or ramp and what Shuffle does with each, sharing by area, shading's
// light side, old guides opening unchanged, and speed with a big guide. The engine's parts are unit-tested in
// test/gradient.test.mjs.
{
  // Math.random from a seed: __seed(n) before anything random makes it repeatable
  const SEEDED = () => {
    let a = 1;
    window.__seed = (n) => {
      a = n >>> 0;
    };
    Math.random = function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  const click = (page, sel) => page.evaluate((sel) => document.querySelector(sel).click(), sel);
  const tab = (page, t) => click(page, `.sftabbtn[data-t="${t}"]`);
  const keys = (page) =>
    page.evaluate(() => {
      const a = __mstest.assignData;
      return a.order.map((l) => a.assign[l].mkey);
    });
  const assignMap = (page) =>
    page.evaluate(() => {
      const a = __mstest.assignData.assign,
        o = {};
      for (const k in a) o[k] = a[k].mkey;
      return o;
    });
  const style = (page) => page.evaluate(() => __mstest.currentDesignObj().payload.style);
  const pressed = (page, sel) =>
    page.evaluate(
      (sel) =>
        [...document.querySelectorAll(sel + ' button')]
          .filter((b) => b.getAttribute('aria-pressed') === 'true')
          .map((b) => b.textContent),
      sel,
    );
  const poolLine = (page) => page.textContent('#sfPanel-colours .sfpoolct');
  // the sample with the whole Honolulu 320 set owned (more markers than the sample's sections)
  async function sample320(page) {
    await sampleGuide(page);
    await page.evaluate(() => {
      presetMkeys(MARKER_SETS.find((s) => s.n === 'Honolulu 320 (complete set)')).forEach((k) =>
        state.owned.add(k),
      );
      save();
      __mstest.coll = sfCollection();
      SF.reassign();
    });
    await idle(page);
  }
  // the open guide reopened (as `name`) with its payload changed by `edit`
  async function reopenAs(page, name, edit) {
    await page.evaluate(
      ([name, edit]) => {
        const d = __mstest.currentDesignObj(),
          p = d.payload;
        // eslint-disable-next-line no-new-func
        new Function('p', edit)(p);
        __mstest.openDesignObj(Object.assign({}, p, { name, W: d.W, H: d.H }), null);
      },
      [name, edit],
    );
    await page.waitForFunction((name) => __mstest.curName === name && __mstest.assignData, name);
    await idle(page);
  }
  test('Look: three choices under Direction (Gradient only); each redraws the picture, is saved with the guide and taken back by Undo', async () => {
    const { page, errors } = await openApp();
    await sample320(page);
    await tab(page, 'pattern');
    await click(page, '#sfShape [data-v="diagonal"]');
    await idle(page);
    await page.evaluate(() => {
      __mstest.styleVars.limitN = 60;
      SF.reassign();
    });
    await idle(page);
    assert.deepEqual(
      await page.evaluate(() =>
        [...document.querySelectorAll('#sfLook button')].map((b) => [b.dataset.v, b.textContent]),
      ),
      [
        ['auto', 'Auto'],
        ['smooth', 'Smooth'],
        ['ltd', 'Light to dark'],
      ],
    );
    assert.deepEqual(await pressed(page, '#sfLook'), ['Auto']);
    // the line under it says what Auto is doing
    assert.match(await page.textContent('#sfLookNote'), /^Auto: (smooth|bands of \d+ markers|light to dark)/);
    const pics = { auto: JSON.stringify(await assignMap(page)) };
    const n0 = await page.evaluate(() => __mstest.planCount);
    for (const [v, label] of [
      ['smooth', 'Smooth'],
      ['ltd', 'Light to dark'],
    ]) {
      await click(page, `#sfLook [data-v="${v}"]`);
      await idle(page);
      pics[v] = JSON.stringify(await assignMap(page));
      assert.equal((await style(page)).look, v);
      assert.deepEqual(await pressed(page, '#sfLook'), [label]);
      assert.equal(await page.evaluate(() => __mstest.planLabel), 'Look: ' + label);
      assert.equal(await page.isVisible('#sfLookNote'), false, 'the note is Auto’s');
    }
    assert.equal(new Set(Object.values(pics)).size, 3, 'three different pictures');
    assert.equal(await page.evaluate(() => __mstest.planCount), n0 + 2, 'one step each');
    await page.keyboard.press('Control+z');
    await idle(page);
    assert.equal((await style(page)).look, 'smooth');
    assert.equal(JSON.stringify(await assignMap(page)), pics.smooth);
    // saved and opened again
    await click(page, '#sfLook [data-v="ltd"]');
    await idle(page);
    await saveGuide(page);
    const id = await page.evaluate(() => __mstest.curId),
      was = await assignMap(page);
    await page.reload();
    await idle(page);
    await page.evaluate((id) => loadGuide({ id }), id);
    await page.waitForFunction((id) => __mstest.curId === id && __mstest.assignData, id);
    await idle(page);
    assert.equal((await style(page)).look, 'ltd');
    assert.deepEqual(await assignMap(page), was);
    // not for other patterns
    await tab(page, 'pattern');
    await click(page, '#sfFam [data-v="random"]');
    await idle(page);
    assert.equal(await page.$('#sfLook'), null);
    assert.deepEqual(errors, []);
  });
  test('Auto’s note: smooth while each marker covers several sections, light to dark when every section has its own', async () => {
    const { page, errors } = await openApp();
    await sample320(page);
    await tab(page, 'pattern');
    assert.equal(await page.textContent('#sfLookNote'), 'Auto: smooth, as Serpentine runs in rows.');
    await click(page, '#sfShape [data-v="diagonal"]');
    await idle(page);
    const n = await page.evaluate(() => __mstest.countedList().length);
    assert.equal(
      await page.textContent('#sfLookNote'),
      `Auto: smooth, as each marker covers about ${Math.round(n / 16)} sections.`,
    );
    // (v308: a new guide's "all" is its 73 vivid markers here, more sections than that: a guide from before v308, with
    // all 320 in play, has one marker to every section)
    await page.evaluate(() => {
      __mstest.styleVars.gradIncl = null;
      __mstest.styleVars.limitN = 999;
      SF.reassign();
    });
    await idle(page);
    assert.equal(
      await page.textContent('#sfLookNote'),
      'Auto: light to dark, as every section has its own marker.',
    );
    assert.deepEqual(errors, []);
  });
  test(
    'Mood: six choices in two rows, in order; filters your markers; old guides’ Vivid and Muted open as Bright and Soft',
    notOnWebKit(WK.font),
    async () => {
      const { page, errors } = await openApp();
      await sample320(page);
      await tab(page, 'colours');
      assert.equal(await page.$('#sfEmph'), null, 'Intensity is gone');
      assert.deepEqual(
        await page.evaluate(() => [...document.querySelectorAll('#sfMood button')].map((b) => b.textContent)),
        ['Any', 'Bright', 'Soft', 'Pastel', 'Deep', 'Earthy'],
      );
      // one even row where every label fits, else two even rows of three (v310: Mood is pictures, e2e/v310-moodpics: also
      // one row of six on an iPad)
      // (a picture's label is its name: the chosen one's ✓ sits over the edge on purpose)
      const rows = () =>
        page.evaluate(() =>
          [...document.querySelectorAll('#sfMood button')].map((b) => {
            const n = b.querySelector('.sfmpname') || b;
            return [
              Math.round(b.getBoundingClientRect().top),
              Math.round(b.getBoundingClientRect().width),
              n.scrollWidth <= n.clientWidth + 1,
            ];
          }),
        );
      let r = await rows();
      assert.equal(new Set(r.map((x) => x[0])).size, 1, 'one row at 390 wide');
      assert.equal(new Set(r.map((x) => x[1])).size, 1, 'even widths');
      await page.setViewportSize({ width: 820, height: 1180 });
      await idle(page);
      assert.equal(new Set((await rows()).map((x) => x[0])).size, 1, 'one row of six on an iPad');
      await page.setViewportSize({ width: 300, height: 844 });
      await idle(page);
      r = await rows();
      assert.deepEqual(
        [new Set(r.slice(0, 3).map((x) => x[0])).size, new Set(r.slice(3).map((x) => x[0])).size],
        [1, 1],
      );
      assert.ok(r[3][0] > r[0][0], 'two rows of three');
      assert.ok(
        r.every((x) => x[2]),
        'every label fits',
      );
      await page.setViewportSize({ width: 390, height: 844 });
      await idle(page);
      assert.deepEqual(await pressed(page, '#sfMood'), ['Any']);
      // Pastel: every marker the gradient uses is light
      await click(page, '#sfMood [data-v="pastel"]');
      await idle(page);
      assert.equal(await page.evaluate(() => __mstest.planLabel), 'Mood: Pastel');
      assert.equal((await style(page)).emphasis, 'pastel');
      const L = await page.evaluate(() => {
        const a = __mstest.assignData;
        return a.order.map((l) => a.assign[l].lab[0]);
      });
      assert.ok(Math.min(...L) >= 78, 'lightest ' + Math.min(...L).toFixed(1));
      // Deep, for Random too
      await click(page, '#sfMood [data-v="deep"]');
      await idle(page);
      await tab(page, 'pattern');
      await click(page, '#sfFam [data-v="random"]');
      await idle(page);
      const pool = await page.evaluate(() => __mstest.activePool().map((m) => m.lab[0]));
      assert.ok(Math.max(...pool) <= 52, 'deep: ' + Math.max(...pool).toFixed(1));
      // more markers than fit a Mood: widened to the nearest, and the line says so
      await click(page, '#sfFam [data-v="gradient"]');
      await idle(page);
      await tab(page, 'colours');
      await page.evaluate(() => {
        __mstest.styleVars.emphasis = 'earthy';
        __mstest.styleVars.limitN = 999;
        SF.reassign();
      });
      await idle(page);
      // (v308: a new guide's "all" is the Mood's own markers, no more, and the line says how many are left)
      assert.match(await poolLine(page), /^\d+ of your markers · greys, fluorescents off$/);
      // (a guide from before v308 takes in the nearest from outside the Mood, as it did)
      await page.evaluate(() => {
        __mstest.styleVars.gradIncl = null;
        SF.reassign();
      });
      await idle(page);
      assert.match(
        await poolLine(page),
        /^Earthy: \d+ of your markers are earthy; the rest are the nearest to earthy$/,
      );
      // an old guide: vivid and muted are Bright and Soft; no look is Auto
      for (const [old, label] of [
        ['vivid', 'Bright'],
        ['muted', 'Soft'],
      ]) {
        await reopenAs(page, 'Old ' + old, `p.style.emphasis = '${old}'; delete p.style.look;`);
        await tab(page, 'colours');
        assert.deepEqual(await pressed(page, '#sfMood'), [label]);
        assert.equal((await style(page)).look, 'auto');
      }
      assert.deepEqual(errors, []);
    },
  );
  test('Mood with a saved palette is greyed out (used as it is); with a palette made here it goes to the generator', async () => {
    const { page, errors } = await openApp({ init: SEEDED });
    await sampleGuide(page);
    // what the guide asks the generator for
    await page.evaluate(() => {
      window.__genCalls = [];
      const g = window.genPalette;
      window.genPalette = function (n, h, opts) {
        window.__genCalls.push([n, h, opts && opts.mood]);
        return g(n, h, opts);
      };
    });
    await tab(page, 'colours');
    await page.evaluate(() => window.__seed(3));
    await click(page, '#sfSrc [data-v="palette"]');
    await idle(page);
    await click(page, '#sfMood [data-v="vivid"]');
    await idle(page);
    const calls = await page.evaluate(() => window.__genCalls);
    assert.ok(calls.length >= 2);
    assert.equal(calls[0][2], 'neutral');
    assert.equal(calls[calls.length - 1][2], 'vivid', 'a new palette for the Mood');
    assert.equal(await page.isEnabled('#sfMood [data-v="pastel"]'), true);
    assert.match(await poolLine(page), /^(All|From the) \d+ generated markers/);
    // a saved palette
    await answerAsks(page);
    await page.evaluate(() => {
      const id = 777001;
      state.saved.unshift({ id, type: 'palette', name: 'P', keys: [...state.owned].slice(0, 6), ts: id });
      save();
      SF.setSavedSource(id);
    });
    // (v318.34: A palette is lit already for it; tapped again it lays the plan again)
    await click(page, '#sfSrc [data-v="palette"]');
    await idle(page);
    assert.deepEqual(
      await page.evaluate(() => [...document.querySelectorAll('#sfMood button')].map((b) => b.disabled)),
      [true, true, true, true, true, true],
    );
    assert.equal(await poolLine(page), 'All 6 of the saved palette’s markers, as it is');
    const was = await keys(page);
    await page.evaluate(() => {
      __mstest.styleVars.emphasis = 'pastel';
      SF.reassign();
    });
    await idle(page);
    assert.deepEqual(await keys(page), was, 'a saved palette’s markers whatever the Mood');
    assert.deepEqual(errors, []);
  });
  test('which markers: never more than sections, no greys while there are coloured ones, and the line says where they come from', async () => {
    const { page, errors } = await openApp();
    await sample320(page);
    await tab(page, 'colours');
    const n = await page.evaluate(() => __mstest.countedList().length);
    // (v308: the line says how many of your markers the Include row and Mood leave)
    const left = await page.evaluate(() => __mstest.grad.inclPool(16).items.length);
    assert.ok(left > 40 && left < n, left + ' left');
    assert.equal(await poolLine(page), left + ' of your markers · browns, greys, fluorescents off');
    await page.evaluate(() => {
      __mstest.styleVars.limitN = 999;
      SF.reassign();
    });
    await idle(page);
    const k = await keys(page);
    assert.equal(k.length, n);
    assert.equal(new Set(k).size, left, 'all of them, some twice (fewer than the sections)');
    assert.equal(await poolLine(page), left + ' of your markers · browns, greys, fluorescents off');
    // (a guide from before v308: one per section, as it was)
    await page.evaluate(() => {
      __mstest.styleVars.gradIncl = null;
      SF.reassign();
    });
    await idle(page);
    assert.equal(new Set(await keys(page)).size, n, 'one marker per section');
    assert.equal(await poolLine(page), 'From your 320 markers: one per section');
    const greys = await page.evaluate(() => {
      const a = __mstest.assignData;
      return a.order.filter((l) => Math.hypot(a.assign[l].lab[1], a.assign[l].lab[2]) < 12).length;
    });
    assert.equal(greys, 0);
    // Random and Blend: the marker count's worth
    await tab(page, 'pattern');
    await click(page, '#sfFam [data-v="blend"]');
    await idle(page);
    await page.evaluate(() => {
      __mstest.styleVars.limitN = 20;
      SF.reassign();
    });
    await idle(page);
    await tab(page, 'colours');
    assert.equal(await poolLine(page), 'From your 320 markers');
    // demo mode: the catalogue
    await page.evaluate(() => {
      state.owned.clear();
      save();
      __mstest.coll = sfCollection();
      SF.reassign();
    });
    await idle(page);
    assert.match(await poolLine(page), /^From the \d+ catalogue markers$/);
    assert.deepEqual(errors, []);
  });
  test('loop or ramp: your markers loop (Shuffle turns the start); a narrow generated palette runs end to end (Shuffle makes a new one); a saved one can’t shuffle', async () => {
    const { page, errors } = await openApp({ init: SEEDED });
    await sample320(page);
    await tab(page, 'pattern');
    await click(page, '#sfShape [data-v="vertical"]');
    await idle(page);
    assert.equal(
      await page.evaluate(
        () => __mstest.grad.plan(__mstest.grad.poolSource(16), __mstest.countedList().length).loop,
      ),
      true,
    );
    const k0 = await keys(page);
    await page.evaluate(() => window.__seed(4));
    await click(page, '#sfVary');
    await idle(page);
    const k1 = await keys(page);
    assert.notDeepEqual(k1, k0);
    assert.deepEqual(
      [...new Set(k1)].sort(),
      [...new Set(k0)].sort(),
      'the same markers, starting elsewhere',
    );
    assert.equal(await page.evaluate(() => __mstest.planLabel), 'Colours shuffled');
    // a one-hue generated palette: a ramp, lighter end first
    await tab(page, 'colours');
    await page.evaluate(() => window.__seed(5));
    await click(page, '#sfSrc [data-v="palette"]');
    await idle(page);
    await page.selectOption('#sfHarm', 'mono');
    await idle(page);
    const plan = await page.evaluate(() => {
      const p = __mstest.grad.plan(__mstest.grad.poolSource(16), __mstest.countedList().length);
      return { loop: p.loop, L: p.seq.map((m) => m.lab[0]) };
    });
    assert.equal(plan.loop, false);
    assert.ok(plan.L[0] >= plan.L[plan.L.length - 1]);
    const g0 = await page.evaluate(() => [...__mstest.genPal]);
    await tab(page, 'pattern');
    await page.evaluate(() => window.__seed(6));
    await click(page, '#sfVary');
    await idle(page);
    assert.notDeepEqual(
      await page.evaluate(() => [...__mstest.genPal]),
      g0,
      'a new palette of the same scheme',
    );
    assert.equal((await style(page)).genHarmony, 'mono');
    // Direction flips it
    const r0 = await keys(page);
    await click(page, '#sfDir [data-d="-1"]');
    await idle(page);
    assert.notDeepEqual(await keys(page), r0);
    // a saved palette of one hue: Shuffle is greyed out, and says why
    await answerAsks(page);
    await page.evaluate(() => {
      const reds = __mstest.coll
        .filter((m) => {
          const x = lchOf(m.lab);
          return x[1] >= 12 && x[2] > 15 && x[2] < 45;
        })
        .slice(0, 7);
      state.saved.unshift({
        id: 777005,
        type: 'palette',
        name: 'Reds',
        keys: reds.map((m) => m.mkey),
        ts: 777005,
      });
      save();
      SF.setSavedSource(777005);
      SF.reassign();
    });
    await idle(page);
    assert.equal(await page.isDisabled('#sfVary'), true);
    assert.equal(
      await page.textContent('#sfShWhy'),
      'This palette runs from one end to the other: Direction flips it.',
    );
    assert.equal(await page.getAttribute('#sfVary', 'aria-describedby'), 'sfShWhy');
    // one that goes round the wheel can
    await page.evaluate(() => {
      const all = __mstest.coll.filter((m) => lchOf(m.lab)[1] >= 30),
        pick = [];
      for (let h = 0; h < 360; h += 45) {
        let b = null,
          bd = 1e9;
        all.forEach((m) => {
          const x = lchOf(m.lab),
            d = Math.min(Math.abs(x[2] - h), 360 - Math.abs(x[2] - h));
          if (d < bd) {
            bd = d;
            b = m;
          }
        });
        pick.push(b.mkey);
      }
      state.saved.unshift({
        id: 777006,
        type: 'palette',
        name: 'Wheel',
        keys: [...new Set(pick)],
        ts: 777006,
      });
      save();
      SF.setSavedSource(777006);
      SF.reassign();
    });
    await idle(page);
    assert.equal(await page.isDisabled('#sfVary'), false);
    assert.equal(await page.$('#sfShWhy'), null);
    assert.deepEqual(errors, []);
  });
  test('sharing by area: on the sample each marker’s share of the picture is more even than sharing by count would give', async () => {
    const { page, errors } = await openApp();
    await sample320(page);
    await tab(page, 'pattern');
    for (const shape of ['diagonal', 'radial', 'vertical']) {
      await click(page, `#sfShape [data-v="${shape}"]`);
      await idle(page);
      const r = await page.evaluate(() => {
        const a = __mstest.assignData,
          c = __mstest.comps,
          per = {},
          M = new Set(a.order.map((l) => a.assign[l].mkey)).size;
        let tot = 0;
        a.order.forEach((l) => {
          const k = a.assign[l].mkey;
          per[k] = (per[k] || 0) + c[l].area;
          tot += c[l].area;
        });
        // by count: the same order cut into M equal runs of sections
        const byCount = new Array(M).fill(0),
          N = a.order.length;
        a.order.forEach((l, i) => {
          byCount[Math.floor((i * M) / N)] += c[l].area;
        });
        // how far the shares are from even, on average (a section bigger than a share can't be split, so not 0)
        const spread = (xs) => xs.reduce((d, x) => d + Math.abs(x / tot - 1 / M), 0) / M;
        return { M, area: spread(Object.values(per)), count: spread(byCount) };
      });
      assert.equal(r.M, 16);
      assert.ok(
        r.area < r.count * 0.8,
        `${shape}: off even by ${(100 * r.area).toFixed(2)} points by area, ${(100 * r.count).toFixed(2)} by count`,
      );
    }
    assert.deepEqual(errors, []);
  });
  test('Light to dark: bands are light at the top, or on the sun’s side once there’s shading (and turn when it moves); Undo takes it back', async () => {
    const { page, errors } = await openApp();
    await sample320(page);
    await tab(page, 'pattern');
    await click(page, '#sfShape [data-v="vertical"]');
    await idle(page);
    await page.evaluate(() => {
      __mstest.styleVars.limitN = 64;
    });
    await click(page, '#sfLook [data-v="ltd"]');
    await idle(page);
    const topMinusBottom = () =>
      page.evaluate(() => {
        const a = __mstest.assignData,
          c = __mstest.comps,
          H = __mstest.H,
          t = [],
          b = [];
        a.order.forEach((l) => {
          if (c[l].cy < H * 0.3) t.push(a.assign[l].lab[0]);
          else if (c[l].cy > H * 0.7) b.push(a.assign[l].lab[0]);
        });
        const m = (x) => x.reduce((s, v) => s + v, 0) / x.length;
        return m(t) - m(b);
      });
    assert.ok((await topMinusBottom()) > 5, 'light at the top');
    const before = await assignMap(page);
    await page.evaluate(() => {
      __mstest.styleVars.shadeSun = { x: 0.5, y: 0.95 };
    });
    await tab(page, 'shading');
    await page.evaluate(() => __mstest.shadeTo('shadow'));
    await idle(page);
    assert.ok((await topMinusBottom()) < -5, 'light at the bottom, by the sun');
    assert.equal(await page.evaluate(() => __mstest.planLabel), 'Highlights: None (shadows only)');
    await page.keyboard.press('Control+z');
    await idle(page);
    assert.deepEqual(await assignMap(page), before);
    // an opened guide keeps its markers when the shading changes
    await reopenAs(page, 'Opened', '');
    const opened = await assignMap(page);
    await tab(page, 'shading');
    await page.evaluate(() => __mstest.shadeTo('full'));
    await idle(page);
    assert.deepEqual(await assignMap(page), opened);
    assert.deepEqual(errors, []);
  });
  test('Surprise picks a Look and a Mood too (mostly Auto and Any)', async () => {
    const { page, errors } = await openApp({ init: SEEDED });
    await sampleGuide(page);
    const looks = new Set(),
      moods = new Set();
    for (let i = 1; i <= 14; i++) {
      await page.evaluate((i) => window.__seed(100 + i), i);
      await click(page, '#sfSurprise');
      await idle(page);
      const s = await style(page);
      looks.add(s.look);
      moods.add(s.emphasis);
    }
    assert.ok(looks.has('auto') && looks.size >= 2, [...looks].join());
    assert.ok(moods.has('neutral') && moods.size >= 3, [...moods].join());
    // (a Gradient says its Look; since v283 one Surprise in three is Random with a main colour, which says that instead)
    assert.match(
      await page.evaluate(() => __mstest.planLabel),
      /(?: look|Random: [^·]+) · \w+ · \d+ markers/,
    );
    assert.deepEqual(errors, []);
  });
  test('old saved guides open with exactly their markers (no Look, Vivid or Muted), whatever the new engine would pick', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    // a gradient guide as the old engine saved it: its own markers (here scrambled, so nothing could lay them out again)
    for (const old of ['vivid', 'muted', 'neutral']) {
      await reopenAs(
        page,
        'Old ' + old,
        `
      const ks = Object.values(p.assign).reverse(), ls = Object.keys(p.assign);
      ls.forEach((l, i) => { p.assign[l] = ks[i]; });
      p.style.emphasis = '${old}'; delete p.style.look; p.style.family = 'gradient';
      window.__want = JSON.stringify(p.assign);`,
      );
      const got = await page.evaluate(() => JSON.stringify(__mstest.currentDesignObj().payload.assign));
      assert.equal(got, await page.evaluate(() => window.__want), old);
      assert.equal((await style(page)).emphasis, old);
    }
    assert.deepEqual(errors, []);
  });
  test(
    'speed: a guide of 3,600 sections with the whole catalogue lays out a gradient without freezing',
    notOnWebKit(WK.speed),
    async () => {
      const { page, errors } = await openApp();
      await sampleGuide(page);
      const ms = await page.evaluate(() => {
        const t = __mstest,
          cols = 60,
          rows = 60,
          s = 12,
          W = cols * s,
          H = rows * s,
          labels = new Int32Array(W * H),
          comps = [null];
        for (let y = 0; y < rows; y++)
          for (let x = 0; x < cols; x++) {
            const l = comps.length;
            comps.push({
              cx: x * s + s / 2,
              cy: y * s + s / 2,
              area: s * s * (1 + ((x * 7 + y * 3) % 5)),
              merged: false,
              bg: false,
            });
            for (let py = y * s; py < (y + 1) * s; py++) labels.fill(l, py * W + x * s, py * W + x * s + s);
          }
        state.owned.clear();
        t.coll = sfCollection();
        const cl = [];
        for (let l = 1; l < comps.length; l++) cl.push(l);
        t.W = W;
        t.H = H;
        t.labels = labels;
        t.comps = comps;
        const sv = t.styleVars,
          out = {};
        Object.assign(sv, {
          family: 'gradient',
          paletteSource: 'owned',
          palette: 'all',
          emphasis: 'neutral',
          limitN: 999,
          gradSeed: 0.3,
          dir: 1,
        });
        for (const [look, shape] of [
          ['smooth', 'diagonal'],
          ['auto', 'radial'],
          ['ltd', 'vertical'],
          ['auto', 'serpentine'],
        ]) {
          Object.assign(sv, { look, gradShape: shape });
          const t0 = performance.now();
          t.grad.build(cl);
          out[look + ' ' + shape] = [
            Math.round(performance.now() - t0),
            new Set(Object.values(t.assignData.assign).map((m) => m.mkey)).size,
          ];
        }
        // (v306: more sections than clear markers, so every clear one, some used twice, rather than greys)
        return { out, n: t.grad.count(t.grad.poolSource(cl.length, true), cl.length).M };
      });
      for (const [k, [t, used]] of Object.entries(ms.out)) {
        assert.equal(used, ms.n, k + ': every clear marker used');
        assert.ok(t < 1200, `${k}: ${t}ms`);
      }
      assert.deepEqual(errors, []);
    },
  );
}

// ---- from radial-centre.test.mjs ----
// Radial's centre (v282): with Gradient › Radial, a ⊕ on the picture (Pattern tab only) marks where the rings start.
// Drag it, or move it with the arrow keys; the whole drag is one Undo step. "Back to the middle" puts it back. Each
// zone has its own (a new zone's rings start in its own middle), and it is saved with the guide.
{
  const vis = (page) =>
    page.evaluate(() => {
      const e = document.getElementById('sfRadC');
      return !!e && e.style.display !== 'none' && e.offsetParent !== null;
    });
  const radC = (page) => page.evaluate(() => __mstest.styleVars.radC);
  const first = (page) => page.evaluate(() => __mstest.assignData.order.slice(0, 6).join(','));
  // the handle's middle on the screen, and the picture's box
  const handle = (page) =>
    page.$eval('#sfRadC', (e) => {
      const r = e.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
  const picBox = (page) =>
    page.$eval('#sfCanvas', (e) => {
      const r = e.getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height };
    });
  test('the ⊕ shows with Radial on the Pattern tab only; a drag moves the rings’ centre, one Undo step; the keys move it too; Back to the middle', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await page.click('.sftabbtn[data-t="pattern"]');
    await idle(page);
    assert.equal(await vis(page), false, 'not with Serpentine');
    assert.equal(await page.$('#sfRadNote'), null);
    await page.click('#sfShape [data-v="radial"]');
    await idle(page);
    assert.equal(await vis(page), true);
    assert.match(
      await page.textContent('#sfRadNote'),
      /Centre: in the middle · drag the centre mark on the picture to move it/,
    );
    assert.equal(await page.$('#sfRadReset'), null);
    assert.equal(await radC(page), null);
    // it sits in the middle of the picture
    await scrollTop(page);
    let h = await handle(page),
      b = await picBox(page);
    assert.ok(Math.abs(h.x - (b.x + b.w / 2)) < 3 && Math.abs(h.y - (b.y + b.h / 2)) < 3, 'in the middle');
    const o1 = await first(page),
      undo0 = await page.getAttribute('#sfPlanUndo', 'aria-label');
    await page.mouse.move(h.x, h.y);
    await page.mouse.down();
    await page.mouse.move(b.x + b.w * 0.5, b.y + b.h * 0.3, { steps: 4 });
    await page.mouse.move(b.x + b.w * 0.2, b.y + b.h * 0.15, { steps: 8 });
    await page.mouse.up();
    await idle(page);
    const c = await radC(page);
    assert.ok(Math.abs(c.x - 0.2) < 0.02 && Math.abs(c.y - 0.15) < 0.02, JSON.stringify(c));
    assert.notEqual(await first(page), o1, 'the rings start there now');
    assert.equal(await page.getAttribute('#sfPlanUndo', 'aria-label'), 'Undo: Radial centre moved');
    h = await handle(page);
    assert.ok(
      Math.abs(h.x - (b.x + b.w * 0.2)) < 3 && Math.abs(h.y - (b.y + b.h * 0.15)) < 3,
      'the ⊕ where it was let go',
    );
    assert.match(await page.textContent('#sfRadNote'), /Centre: moved/);
    // one Undo step for the whole drag
    await page.click('#sfPlanUndo');
    await idle(page);
    assert.equal(await radC(page), null);
    assert.equal(await first(page), o1);
    assert.equal(await page.getAttribute('#sfPlanUndo', 'aria-label'), undo0);
    // the keys: a twentieth of the picture a press
    await page.focus('#sfRadC');
    await page.keyboard.press('ArrowRight');
    await idle(page);
    await page.keyboard.press('ArrowUp');
    await idle(page);
    assert.deepEqual(await radC(page), { x: 0.55, y: 0.45 });
    assert.equal(await page.evaluate(() => document.activeElement.id), 'sfRadC', 'the ⊕ keeps the focus');
    // Back to the middle
    await page.click('#sfRadReset');
    await idle(page);
    assert.equal(await radC(page), null);
    assert.equal(
      await page.getAttribute('#sfPlanUndo', 'aria-label'),
      'Undo: Radial centre back to the middle',
    );
    assert.match(await page.textContent('#sfRadNote'), /Centre: in the middle/);
    // the other tabs, Colour along and Reveal have no ⊕
    await page.click('.sftabbtn[data-t="colours"]');
    await idle(page);
    assert.equal(await vis(page), false);
    await page.click('.sftabbtn[data-t="pattern"]');
    await idle(page);
    assert.equal(await vis(page), true);
    await page.click('#sfColor');
    await idle(page);
    assert.equal(await vis(page), false);
    await page.click('#sfDoneBtn');
    await idle(page);
    assert.equal(await vis(page), true);
    // it keeps to its place on the picture as the picture zooms (shading off: there's no sun to move it along)
    await page.focus('#sfRadC');
    await page.keyboard.press('ArrowLeft');
    await idle(page);
    await page.click('#sfZin');
    await idle(page, 400);
    const c2 = await radC(page),
      h2 = await handle(page),
      b2 = await picBox(page);
    assert.ok(
      Math.abs(h2.x - (b2.x + b2.w * c2.x)) < 3 && Math.abs(h2.y - (b2.y + b2.h * c2.y)) < 3,
      'on its place after zooming in',
    );
    await page.click('#sfZrst');
    await idle(page, 400);
    // a new picture: the middle again (a place on the old one means nothing there)
    assert.ok(await radC(page));
    await page.evaluate(() => SF.loadSample());
    await page.waitForFunction(() => __mstest.assignData, null, { timeout: 10000 });
    await idle(page, 1200);
    await page.click('.sftabbtn[data-t="pattern"]');
    await idle(page);
    assert.equal(await radC(page), null);
    // (another flow: gone)
    await page.click('#sfShape [data-v="diagonal"]');
    await idle(page);
    assert.equal(await vis(page), false);
    assert.deepEqual(errors, []);
  });
  test('each zone has its own centre (a new one starts in its middle), hidden while choosing sections; saved with the guide', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await page.click('.sftabbtn[data-t="pattern"]');
    await idle(page);
    await page.click('#sfShape [data-v="radial"]');
    await idle(page);
    await page.focus('#sfRadC');
    for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowLeft');
    await idle(page);
    const mainC = await radC(page);
    assert.ok(Math.abs(mainC.x - 0.3) < 1e-9);
    await page.click('#sfZoneAdd');
    await idle(page);
    assert.equal(await vis(page), false, 'not while choosing the zone’s sections');
    await page.evaluate(() => {
      const t = __mstest,
        cl = Object.keys(t.assignData.assign)
          .map(Number)
          .filter((l) => t.comps[l].cy > t.H * 0.6);
      t.zoneMove(cl, t.zoneCur);
      t.reassign([0, t.zoneCur]);
    });
    await page.click('#sfZoneDone');
    await idle(page);
    assert.equal(
      await page.evaluate(() => __mstest.styleVars.gradShape),
      'radial',
      'the new zone’s flow is Main’s',
    );
    assert.equal(await radC(page), null, 'but its rings start in its own middle');
    await scrollTop(page);
    const h = await handle(page),
      b = await picBox(page);
    const box = await page.evaluate(() => {
      const t = __mstest,
        bx = t.zoneBoxOf(t.zoneSecs(t.zoneCur));
      return { x: (bx.x0 + bx.x1) / 2 / t.W, y: (bx.y0 + bx.y1) / 2 / t.H };
    });
    assert.ok(
      Math.abs(h.x - (b.x + b.w * box.x)) < 3 && Math.abs(h.y - (b.y + b.h * box.y)) < 3,
      'the ⊕ in the zone’s middle',
    );
    await page.focus('#sfRadC');
    await page.keyboard.press('ArrowDown');
    await idle(page);
    const zC = await radC(page);
    // Main keeps its own
    await page.click('#sfPanel-pattern .sfzchip[data-z="0"]');
    await idle(page);
    assert.deepEqual(await radC(page), mainC);
    // saved and opened again
    const d = await page.evaluate(() => __mstest.currentDesignObj());
    assert.deepEqual(d.payload.style.radC, mainC);
    assert.deepEqual(d.payload.zones[0].style.radC, zC);
    await saveGuide(page);
    const id = await page.evaluate(() => __mstest.curId);
    await page.reload();
    await idle(page);
    await page.evaluate((id) => loadGuide({ id }), id);
    await page.waitForFunction((id) => __mstest.curId === id && __mstest.assignData, id);
    await idle(page);
    assert.deepEqual(await radC(page), mainC);
    assert.deepEqual(await page.evaluate(() => __mstest.zones[0].st.radC), zC);
    assert.deepEqual(errors, []);
  });
}

// ---- from random-and-blend.test.mjs ----
// Random's "Keep touching sections clearly different" and Blend's Mix row, in the browser. Which sections touch is
// worked out here in the test, its own way (walking across the lines from every pixel at a section's edge), so the
// app's own adjacency (js/guide/30-palette-assign.js, buildAdj) isn't measured with itself. The rules themselves
// (the lookups, the mixes, the adjacency on made-up pictures) are unit-tested in test/colour-engines.test.mjs.
{
  // Math.random from a seed, so the rolls repeat
  const SEEDED = () => {
    let a = 7;
    Math.random = function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  const click = (page, sel) => page.evaluate((sel) => document.querySelector(sel).click(), sel);
  const tab = async (page, t) => {
    await page.click(`.sftabbtn[data-t="${t}"]`);
    await idle(page);
  };
  // the guide's touching pairs among its sections, found by walking right and down across the line from every pixel
  // at a section's edge, up to a 40th of the picture's longer side: two sections touch when they meet along 6 px or
  // more (seen from 6 pixels; the app looks from every other row and column and counts 3), so where lines cross and
  // two sections only meet corner to corner, they don't
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
        .filter(([k, n]) => n >= 6)
        .map(([k]) => k.split(',').map(Number))
        .filter(([a, b]) => inG.has(a) && inG.has(b));
    });
  // touching pairs with the same marker, and with markers that look alike (CIEDE2000 under 10)
  const clashes = (page, pairs) =>
    page.evaluate((pairs) => {
      const as = __mstest.assignData.assign;
      let same = 0,
        alike = 0;
      for (const [a, b] of pairs) {
        if (as[a].mkey === as[b].mkey) same++;
        else if (de2000(as[a].lab, as[b].lab) < 10) alike++;
      }
      return { same, alike };
    }, pairs);
  test('Random on the sample: with “Keep touching sections clearly different”, no touching sections share a marker or look alike, roll after roll', async () => {
    const { page, errors } = await openApp({ init: SEEDED });
    await sampleGuide(page);
    await tab(page, 'pattern');
    await click(page, '#sfFam [data-v="random"]');
    await idle(page);
    // (Mixed: Random as it always was; Main colour below)
    await click(page, '#sfBal [data-v="mixed"]');
    await idle(page);
    assert.equal(
      (await page.textContent('label:has(#sfNoAdj)')).trim(),
      'Keep touching sections clearly different',
    );
    const pairs = await touching(page);
    assert.ok(pairs.length > 40, pairs.length + ' touching pairs');
    // off: markers fall where they may (with 16 markers, some touching sections clash)
    let off = { same: 0, alike: 0 };
    for (let r = 0; r < 4; r++) {
      await click(page, '#sfShuffle');
      await idle(page);
      const c = await clashes(page, pairs);
      off = { same: off.same + c.same, alike: off.alike + c.alike };
    }
    assert.ok(off.same + off.alike > 0, 'with it off, some clash');
    await click(page, '#sfNoAdj');
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.planLabel), 'Touching sections different on');
    for (let r = 0; r < 5; r++) {
      assert.deepEqual(await clashes(page, pairs), { same: 0, alike: 0 }, 'roll ' + r);
      await click(page, '#sfShuffle');
      await idle(page);
    }
    // Main colour keeps it too (taking another role's marker where the role's own all look alike)
    await click(page, '#sfBal [data-v="main"]');
    await idle(page);
    for (let r = 0; r < 5; r++) {
      assert.deepEqual(await clashes(page, pairs), { same: 0, alike: 0 }, 'Main colour, roll ' + r);
      await click(page, '#sfShuffle');
      await idle(page);
    }
    assert.deepEqual(errors, []);
  });
  test('Random on a drawing with thick lines: every touching pair is found, and kept clearly different (a fixed step across missed them all)', async () => {
    const { page, errors } = await openApp({ init: SEEDED });
    await haveSet(page);
    await page.check('#wcSets input[data-i="3"]');
    await page.click('#wcAdd');
    // 8 × 6 boxes, 150 px, drawn with 24 px lines (a 50th of the picture across)
    const b64 = await page.evaluate(async () => {
      const c = document.createElement('canvas'),
        g = c.getContext('2d');
      c.width = 1300;
      c.height = 1000;
      g.fillStyle = '#fff';
      g.fillRect(0, 0, c.width, c.height);
      g.fillStyle = '#111';
      for (let i = 0; i <= 8; i++) g.fillRect(50 + i * 150 - 12, 38, 24, 6 * 150 + 24);
      for (let j = 0; j <= 6; j++) g.fillRect(38, 50 + j * 150 - 12, 8 * 150 + 24, 24);
      const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
      return await new Promise((r) => {
        const f = new FileReader();
        f.onload = () => r(f.result.split(',')[1]);
        f.readAsDataURL(blob);
      });
    });
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#wcPhoto')]);
    await fc.setFiles({ name: 'boxes.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
    await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 60000 });
    await idle(page);
    await buildGo(page);
    await until(page, () => __mstest.assignData && document.getElementById('sfColor'), null, 'the guide');
    await idle(page);
    const n = await page.evaluate(() => __mstest.assignData.order.length);
    assert.equal(n, 48, 'the 48 boxes');
    const pairs = await touching(page);
    assert.equal(pairs.length, 8 * 5 + 7 * 6, 'side by side, not corner to corner');
    // the app's own list of touching sections has every one
    const found = await page.evaluate((pairs) => {
      const a = __mstest.colour.adj();
      return pairs.filter(([x, y]) => a[x] && a[x].has(y)).length;
    }, pairs);
    assert.equal(found, pairs.length);
    // (looking a fixed 250th of the picture across, as it used to, sees none of them)
    const old = await page.evaluate(() => {
      const t = __mstest,
        L = t.labels,
        W = t.W,
        H = t.H,
        B = Math.max(2, Math.round(Math.max(W, H) / 250)),
        s = new Set();
      for (let y = 0; y + B < H; y++)
        for (let x = 0; x + B < W; x++) {
          const l = L[y * W + x];
          if (l < 1) continue;
          for (const r of [L[y * W + x + B], L[(y + B) * W + x]])
            if (r >= 1 && r !== l) s.add(Math.min(l, r) + ',' + Math.max(l, r));
        }
      return s.size;
    });
    assert.equal(old, 0);
    await tab(page, 'pattern');
    await click(page, '#sfFam [data-v="random"]');
    await idle(page);
    await click(page, '#sfNoAdj');
    await idle(page);
    for (let r = 0; r < 5; r++) {
      assert.deepEqual(await clashes(page, pairs), { same: 0, alike: 0 }, 'roll ' + r);
      await click(page, '#sfShuffle');
      await idle(page);
    }
    assert.deepEqual(errors, []);
  });
  test('Blend’s Mix: Muted, Vivid and Like paint each colour the picture their own way; the choice is saved, is one Undo step, and an older guide’s “Keep colours vivid” opens as Vivid', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await tab(page, 'pattern');
    await click(page, '#sfFam [data-v="blend"]');
    await idle(page);
    const pressed = () =>
      page.evaluate(() =>
        [...document.querySelectorAll('#sfMix button')]
          .filter((b) => b.getAttribute('aria-pressed') === 'true')
          .map((b) => b.textContent),
      );
    assert.deepEqual(
      await page.evaluate(() =>
        [...document.querySelectorAll('#sfMix button')].map((b) => [b.dataset.v, b.textContent]),
      ),
      [
        ['soft', 'Muted'],
        ['vivid', 'Vivid'],
        ['paint', 'Like paint'],
      ],
    );
    assert.equal(
      await page.evaluate(() => document.getElementById('sfMix').getAttribute('aria-label')),
      'Mix',
    );
    assert.deepEqual(await pressed(), ['Muted']);
    // four anchors in the corners: red, blue, yellow and green, so the mixes differ
    await page.evaluate(() => {
      const t = __mstest,
        W = t.W,
        H = t.H,
        want = [
          [55, 70, 45],
          [45, 20, -60],
          [88, -5, 80],
          [55, -55, 35],
        ];
      const pts = [
        [0.15, 0.15],
        [0.85, 0.15],
        [0.15, 0.85],
        [0.85, 0.85],
      ];
      t.anchors.length = 0;
      want.forEach((lab, i) =>
        t.anchors.push({ x: W * pts[i][0], y: H * pts[i][1], mkey: t.colour.nearest(lab, t.coll).mkey }),
      );
      t.reassign();
    });
    await idle(page);
    const keys = () =>
      page.evaluate(() => {
        const a = __mstest.assignData;
        return a.order.map((l) => a.assign[l].mkey);
      });
    const soft = await keys();
    const got = {};
    for (const [v, label] of [
      ['vivid', 'Vivid'],
      ['paint', 'Like paint'],
    ]) {
      await click(page, `#sfMix [data-v="${v}"]`);
      await idle(page);
      assert.deepEqual(await pressed(), [label]);
      assert.equal(await page.evaluate(() => __mstest.planLabel), 'Mix: ' + label);
      got[v] = await keys();
      const st = await page.evaluate(() => __mstest.currentDesignObj().payload.style);
      assert.equal(st.blendMix, v);
      assert.equal(st.blendVivid, v === 'vivid', 'the old tick box is written for older copies of the app');
    }
    const differ = (a, b) => a.filter((k, i) => k !== b[i]).length;
    assert.ok(
      differ(soft, got.vivid) > 3 && differ(soft, got.paint) > 3 && differ(got.vivid, got.paint) > 3,
      `${differ(soft, got.vivid)} ${differ(soft, got.paint)} ${differ(got.vivid, got.paint)}`,
    );
    // Undo: back to Vivid, its picture as it was
    await page.keyboard.press('Control+z');
    await idle(page);
    assert.deepEqual(await pressed(), ['Vivid']);
    assert.deepEqual(await keys(), got.vivid);
    await click(page, '#sfMix [data-v="paint"]');
    await idle(page);
    // saved and opened again
    await page.evaluate(() => {
      const d = __mstest.currentDesignObj(),
        p = d.payload;
      __mstest.openDesignObj(Object.assign({}, p, { name: 'Painted', W: d.W, H: d.H }), null);
    });
    await until(page, () => __mstest.curName === 'Painted' && __mstest.assignData, null, 'reopened');
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.styleVars.blendMix), 'paint');
    // a guide saved before Mix: only blendVivid, ticked, opens as Vivid (unticked, Soft), and colours the same way
    for (const [vivid, want, label] of [
      [true, 'vivid', 'Vivid'],
      [false, 'soft', 'Muted'],
    ]) {
      await page.evaluate((vivid) => {
        const d = __mstest.currentDesignObj(),
          p = d.payload;
        delete p.style.blendMix;
        p.style.blendVivid = vivid;
        __mstest.openDesignObj(Object.assign({}, p, { name: 'Old ' + vivid, W: d.W, H: d.H }), null);
      }, vivid);
      await until(
        page,
        (n) => __mstest.curName === n && __mstest.assignData,
        'Old ' + vivid,
        'the old guide',
      );
      await idle(page);
      assert.equal(await page.evaluate(() => __mstest.styleVars.blendMix), want);
      await tab(page, 'pattern');
      assert.deepEqual(await pressed(), [label]);
      // (it keeps the markers it was saved with until the Mix is changed; choosing it again gives the same)
      await page.evaluate(() => __mstest.reassign());
      await idle(page);
      assert.deepEqual(await keys(), want === 'vivid' ? got.vivid : soft);
    }
    assert.deepEqual(errors, []);
  });
}

// ---- from v304-assign.test.mjs ----
// v304 (plan patterns): removing Blend's last anchor brings back three (Blend never colours everything with one
// marker), and its Undo step says so, "Last anchor removed: Blend starts again from 3"; Undo puts the anchor back.
{
  test('Blend: the last anchor removed brings three back, named so for Undo, and Undo puts it back', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await page.click('.sftabbtn[data-t="pattern"]');
    await page.click('#sfFam [data-v="blend"]');
    await idle(page);
    await scrollTop(page);
    // one anchor left, where it shows on the picture
    const ap = await page.evaluate(() => {
      const t = __mstest,
        c = document.getElementById('sfCanvas'),
        r = c.getBoundingClientRect();
      const i = t.anchors.findIndex((a) => {
        const y = r.top + (a.y / t.H) * r.height;
        return y > Math.max(r.top, 0) + 20 && y < innerHeight - 20;
      });
      const a = t.anchors[i];
      t.anchors.splice(0, t.anchors.length, a);
      // (laid with it, a step of its own, as removing the others one by one would be)
      t.reassign();
      return {
        x: r.left + (a.x / t.W) * r.width,
        y: r.top + (a.y / t.H) * r.height,
        a: { x: a.x, y: a.y, mkey: a.mkey },
      };
    });
    await page.mouse.click(ap.x, ap.y);
    await idle(page);
    assert.equal(await page.textContent('#sfPopExtra'), 'Remove anchor');
    await page.click('#sfPopExtra');
    await idle(page);
    const after1 = await page.evaluate(() => ({
      n: __mstest.anchors.length,
      label: __mstest.planLabel,
      mk: new Set(Object.values(__mstest.assignData.assign).map((m) => m.mkey)).size,
    }));
    assert.equal(after1.n, 3, 'three anchors again');
    assert.ok(after1.mk > 1, 'not one marker everywhere');
    assert.equal(after1.label, 'Last anchor removed: Blend starts again from 3');
    await page.click('#sfPlanUndo');
    await idle(page);
    assert.deepEqual(
      await page.evaluate(() => JSON.parse(JSON.stringify(__mstest.anchors))),
      [ap.a],
      'Undo: the anchor that was removed',
    );
    assert.deepEqual(errors, []);
  });
}

// ---- from v305-gradient.test.mjs ----
// v305 (the Gradient): the smoothing pass after it's laid, in the app (a guide laid with it opens again with exactly
// its markers; the Start colour still starts the flow), and Around, the fifth Flow: round Radial's centre, with its ⊕
// and the line under Flow, saved with the guide and taken back by Undo; the Flow row on an iPad either way round and
// a phone. The engine is unit-tested in test/v305-gradient.test.mjs.
{
  const click = (page, sel) => page.evaluate((sel) => document.querySelector(sel).click(), sel);
  const tab = (page, t) => click(page, `.sftabbtn[data-t="${t}"]`);
  const assignMap = (page) =>
    page.evaluate(() => {
      const a = __mstest.assignData.assign,
        o = {};
      for (const k in a) o[k] = a[k].mkey;
      return JSON.stringify(o);
    });
  async function reopen(page) {
    await saveGuide(page);
    const id = await page.evaluate(() => __mstest.curId);
    await page.reload();
    await idle(page);
    await page.evaluate((id) => loadGuide({ id }), id);
    await page.waitForFunction((id) => __mstest.curId === id && __mstest.assignData, id);
    await idle(page);
  }
  test('smoothing: a new guide from a photo is smoothed; it opens again with exactly its markers, the Start colour first', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    // Ben's own markers, one to each section
    await page.evaluate(() => {
      state.owned = new Set(defaultOwned());
      save();
    });
    await letterGuide(page);
    await tab(page, 'pattern');
    await page.evaluate(() => {
      __mstest.styleVars.limitN = 999;
      SF.reassign();
    });
    await idle(page);
    const s = await page.evaluate(() => __mstest.grad.smoothed);
    assert.ok(s && s.swaps > 0, 'smoothed: ' + JSON.stringify(s));
    // the flow's first section has the marker it has unsmoothed (the Photo pattern before its photo lays the Gradient
    // without smoothing), so the Start colour still starts the flow
    const firsts = await page.evaluate(() => {
      const t = __mstest,
        cl = t.assignData.order.slice(),
        f = () => t.assignData.assign[t.assignData.order[0]].mkey,
        a = f();
      t.styleVars.family = 'photo';
      t.grad.build(cl);
      const b = f();
      t.styleVars.family = 'gradient';
      t.grad.build(cl);
      return [a, b, f()];
    });
    assert.equal(firsts[0], firsts[1]);
    assert.equal(firsts[2], firsts[0], 'laid the same again');
    const was = await assignMap(page);
    await reopen(page);
    assert.equal(await assignMap(page), was, 'exactly its markers');
    assert.equal(await page.evaluate(() => __mstest.styleVars.limitN), 999);
    assert.deepEqual(errors, []);
  });
  test('Around: a fifth Flow; colours go round the centre, with the ⊕ and its line; one Undo step; saved with the guide', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await tab(page, 'pattern');
    await idle(page);
    const flows = await page.evaluate(() =>
      [...document.querySelectorAll('#sfShape button')].map((b) => b.textContent),
    );
    assert.deepEqual(flows, ['Serpentine', 'Vertical', 'Diagonal', 'Radial', 'Around']);
    assert.equal(await page.isVisible('#sfRadC'), false, 'no ⊕ for Serpentine');
    await page.click('#sfShape [data-v="around"]');
    await idle(page);
    assert.equal(await page.getAttribute('#sfShape [data-v="around"]', 'aria-pressed'), 'true');
    assert.equal(await page.evaluate(() => __mstest.styleVars.gradShape), 'around');
    assert.equal(await page.getAttribute('#sfPlanUndo', 'aria-label'), 'Undo: Flow: Around');
    assert.ok(await page.isVisible('#sfRadC'), 'the ⊕ shows');
    assert.match(await page.getAttribute('#sfRadC', 'aria-label'), /what the colours go round/);
    assert.match(await page.textContent('#sfRadNote'), /Centre: in the middle/);
    // the flow goes round the middle, clockwise from the top
    const angles = await page.evaluate(() => {
      const t = __mstest,
        c = t.comps,
        o = t.assignData.order;
      return o.map((l) => {
        let a = Math.atan2(c[l].cy - t.H / 2, c[l].cx - t.W / 2) + Math.PI / 2;
        return a < 0 ? a + 2 * Math.PI : a;
      });
    });
    for (let i = 1; i < angles.length; i++)
      assert.ok(angles[i] >= angles[i - 1] - 1e-9, 'round in turn at ' + i);
    // the ⊕ moved by the keys: the flow starts somewhere else; one Undo step says so
    const was = await assignMap(page);
    await page.focus('#sfRadC');
    await page.keyboard.press('ArrowLeft');
    await idle(page);
    assert.notEqual(await assignMap(page), was);
    assert.equal(await page.getAttribute('#sfPlanUndo', 'aria-label'), 'Undo: Centre moved');
    await page.click('#sfPlanUndo');
    await idle(page);
    assert.equal(await assignMap(page), was);
    // saved with the guide, opened again as it was
    await reopen(page);
    assert.equal(await page.evaluate(() => __mstest.styleVars.gradShape), 'around');
    assert.equal(await assignMap(page), was);
    await tab(page, 'pattern');
    assert.equal(await page.getAttribute('#sfShape [data-v="around"]', 'aria-pressed'), 'true');
    // Undo back to Radial: its own words again
    await page.click('#sfShape [data-v="radial"]');
    await idle(page);
    assert.match(await page.getAttribute('#sfRadC', 'aria-label'), /where the rings start/);
    assert.deepEqual(errors, []);
  });
  test('the Flow row with five: one row on an iPad either way round and a phone 390 wide; narrower, each choice whole', async () => {
    for (const [w, h, one] of [
      [820, 1180, true],
      [1180, 820, true],
      [390, 844, true],
      [360, 780, false],
    ]) {
      const { page, errors, ctx } = await openApp({ width: w, height: h });
      await sampleGuide(page);
      await tab(page, 'pattern');
      await page.click('#sfShape [data-v="around"]');
      await idle(page);
      const r = await page.evaluate(() => {
        const row = document.getElementById('sfShape'),
          bs = [...row.querySelectorAll('button')];
        return {
          tops: [...new Set(bs.map((b) => Math.round(b.getBoundingClientRect().top)))].length,
          clipped: bs.filter((b) => b.scrollWidth > b.clientWidth + 1).map((b) => b.textContent),
          over: row.scrollWidth > row.clientWidth + 1,
          page: document.documentElement.scrollWidth > innerWidth,
        };
      });
      if (one) assert.equal(r.tops, 1, `${w}×${h}: one row`);
      assert.deepEqual(r.clipped, [], `${w}×${h}: no choice cut off`);
      assert.equal(r.over, false, `${w}×${h}: the row fits`);
      assert.equal(r.page, false, `${w}×${h}: no sideways scroll`);
      await page.evaluate(() => document.getElementById('sfShape').scrollIntoView({ block: 'center' }));
      await shot(page, `v305-flow-${w}x${h}`);
      assert.deepEqual(errors, []);
      await ctx.close();
    }
  });
}

// ---- from v306-colour.test.mjs ----
// v306, the Gradient's colours: the Scatter slider (Polished, Natural, Textured, Sparkle, Confetti), "all" on a page
// with more sections than clear markers (U6's label), shading-aware picks offered in the Shading tab (U7), and rough
// spots with "Smooth them".
{
  const keys = (page) =>
    page.evaluate(() => {
      const a = __mstest.assignData;
      return a.order.map((l) => a.assign[l].mkey);
    });
  // each section's marker, by section number; the markers used
  const bySec = (page) =>
    page.evaluate(() => {
      const A = __mstest.assignData.assign;
      return Object.keys(A)
        .sort((a, b) => a - b)
        .map((l) => l + ':' + A[l].mkey);
    });
  const used = (k) => [...new Set(k)].sort();
  const tab = async (page, t) => {
    await page.click(`.sftabbtn[data-t="${t}"]`);
    await idle(page);
  };
  const slide = (page, id, v) =>
    page.evaluate(
      ([id, v]) => {
        const el = document.getElementById(id);
        el.value = String(v);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      },
      [id, v],
    );
  const undoLabel = () => __mstest.planLabel;
  // Ben's own 451 markers, the count at all of them (the sample has 166 sections: one marker each)
  const bens = async (page) => {
    await page.evaluate(() => {
      const t = __mstest;
      state.owned = new Set(defaultOwned());
      save();
      t.coll = sfCollection();
      t.styleVars.limitN = 999;
      t.reassign();
    });
    await idle(page);
  };
  test('Scatter: five stops under Look, each one Undo step that says which; its line says what it does; below 9 markers it is off and says why', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await tab(page, 'pattern');
    // (Radial, so Auto's note shows under Look)
    await page.click('#sfShape [data-v="radial"]');
    await idle(page);
    const order = await page.evaluate(() =>
      [...document.querySelectorAll('#sfLook, #sfLookNote, #sfGradScat')].map((e) => e.id),
    );
    assert.deepEqual(
      order,
      ['sfLook', 'sfLookNote', 'sfGradScat'],
      'the Look note stays under Look, Scatter after it',
    );
    assert.equal(await page.textContent('#sfGradScatName'), 'Polished');
    // (v308: Polished has its line too)
    assert.equal(await page.textContent('#sfGradScatNote'), 'Neat bands in flow order');
    const names = ['Polished', 'Natural', 'Textured', 'Sparkle', 'Confetti'];
    let prev = await keys(page);
    for (let v = 1; v <= 4; v++) {
      const n = await page.evaluate(() => __mstest.planCount);
      await slide(page, 'sfGradScat', v);
      await idle(page);
      assert.equal(await page.textContent('#sfGradScatName'), names[v]);
      assert.equal(await page.getAttribute('#sfGradScat', 'aria-valuetext'), names[v]);
      assert.ok(await page.isVisible('#sfGradScatNote'), names[v] + ': its line');
      assert.equal(await page.evaluate(() => __mstest.planCount), n + 1, names[v] + ': one step');
      assert.equal(await page.evaluate(undoLabel), 'Scatter: ' + names[v]);
      const k = await keys(page);
      assert.notDeepEqual(k, prev, names[v] + ': laid again');
      prev = k;
      if (v >= 2)
        assert.match(
          await page.textContent('#sfLookNote'),
          /Scatter places them\.$/,
          names[v] + ': the Look note',
        );
    }
    assert.equal(
      await page.textContent('#sfGradScatNote'),
      'Colours stray further: confetti close up, a rainbow from afar',
    );
    // Undo goes back a stop
    await page.keyboard.press('Control+z');
    await idle(page);
    assert.equal(await page.textContent('#sfGradScatName'), 'Sparkle');
    // 8 markers: off, Polished, and why
    await tab(page, 'colours');
    await slide(page, 'sfMkCount', 8);
    await idle(page);
    await tab(page, 'pattern');
    assert.equal(await page.isDisabled('#sfGradScat'), true);
    assert.equal(await page.textContent('#sfGradScatName'), 'Polished');
    assert.equal(await page.textContent('#sfGradScatNote'), 'Scatter needs 9 or more markers in this guide.');
    assert.equal(await page.evaluate(() => __mstest.grad.scattered), null, 'laid as Polished');
    assert.deepEqual(errors, []);
  });
  test('Scatter: Shuffle at Textured and up mixes again but keeps the Start colour; at Polished it turns the start as before', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await tab(page, 'pattern');
    const state = () =>
      page.evaluate(() => ({
        seed: __mstest.styleVars.gradSeed,
        jit: __mstest.styleVars.gradJit,
        start: document.getElementById('sfGStart') && document.getElementById('sfGStart').value,
      }));
    // Polished: Shuffle turns the start (gradSeed)
    const p0 = await state();
    await page.click('#sfVary');
    await idle(page);
    const p1 = await state();
    assert.notEqual(p1.seed, p0.seed, 'Polished: a new start');
    assert.equal(p1.jit, p0.jit);
    // Sparkle: only the scatter's seed
    await slide(page, 'sfGradScat', 3);
    await idle(page);
    const s0 = await state(),
      k0 = await keys(page);
    for (let i = 0; i < 3; i++) {
      await page.click('#sfVary');
      await idle(page);
      const s1 = await state(),
        k1 = await keys(page);
      assert.equal(s1.seed, s0.seed, 'the Start colour’s seed kept');
      assert.equal(s1.start, s0.start, 'the Start colour slider where it was');
      assert.notEqual(s1.jit, s0.jit);
      assert.notDeepEqual(k1, k0, 'mixed again');
      assert.equal(k1[0], k0[0], 'the first section keeps the Start colour');
      assert.deepEqual(used(k1), used(k0), 'the same markers');
      assert.equal(await page.evaluate(undoLabel), 'Colours shuffled');
    }
    assert.deepEqual(errors, []);
  });
  test('Scatter: a guide saved at each stop reopens exactly as it was saved, after a reload; a new picture starts at Polished', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await tab(page, 'pattern');
    const saved = [];
    for (let v = 0; v <= 4; v++) {
      if (v) {
        await slide(page, 'sfGradScat', v);
        await idle(page);
      }
      await page.evaluate((v) => {
        __mstest.curName = 'Scatter ' + v;
      }, v);
      await saveGuide(page);
      saved.push({
        id: await page.evaluate(() => __mstest.curId),
        keys: await bySec(page),
        style: await page.evaluate(() => __mstest.currentDesignObj().payload.style),
      });
      // (each stop a guide of its own)
      if (v < 4) {
        await page.evaluate(() => {
          const d = __mstest.currentDesignObj();
          __mstest.openDesignObj(Object.assign({}, d.payload, { name: 'next', W: d.W, H: d.H }), null);
        });
        await page.waitForFunction(() => __mstest.curName === 'next' && __mstest.assignData);
        await idle(page);
        await tab(page, 'pattern');
      }
    }
    // what is written: nothing at Polished, then the stop, and its seed from Textured
    assert.deepEqual(
      saved.map((s) => [s.style.gradScat, s.style.gradJit]),
      [
        [undefined, undefined],
        [1, undefined],
        [2, 0],
        [3, 0],
        [4, 0],
      ],
    );
    await page.reload();
    await idle(page);
    for (const s of saved) {
      await page.evaluate((id) => loadGuide({ id }), s.id);
      await page.waitForFunction((id) => __mstest.curId === id && __mstest.assignData, s.id, {
        timeout: 10000,
      });
      await idle(page);
      assert.deepEqual(await bySec(page), s.keys, 'reopened as saved: ' + s.id);
      assert.equal(await page.evaluate(() => __mstest.styleVars.gradScat), s.style.gradScat || 0);
    }
    // a new picture: Polished
    await page.evaluate(() => SF.loadSample());
    await page.waitForFunction(() => __mstest.assignData && __mstest.curId == null);
    await idle(page);
    assert.deepEqual(
      await page.evaluate(() => [
        __mstest.styleVars.gradScat,
        __mstest.styleVars.gradJit,
        __mstest.styleVars.gradFix,
      ]),
      [0, 0, false],
    );
    await tab(page, 'pattern');
    assert.equal(await page.textContent('#sfGradScatName'), 'Polished');
    assert.deepEqual(errors, []);
  });
  test('Scatter: moving the sun never lays a scattered guide again (a Polished one in bands still turns to face it)', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await tab(page, 'pattern');
    await page.click('#sfShape [data-v="vertical"]');
    await idle(page);
    await page.click('#sfLook [data-v="ltd"]');
    await idle(page);
    const sunMoved = async () => {
      await tab(page, 'shading');
      await page.evaluate(() => __mstest.shadeTo('full'));
      await idle(page);
      const k0 = await keys(page);
      // the sun to the other side, and the shading turned off and on, which faces the bands to it
      await page.evaluate(() => {
        __mstest.shadeSun = { x: 0.5, y: 0.95 };
      });
      await page.click('#sfShade [data-v="off"]');
      await idle(page);
      await page.evaluate(() => __mstest.shadeTo('full'));
      await idle(page);
      const k1 = await keys(page);
      await page.click('#sfShade [data-v="off"]');
      await idle(page);
      await page.evaluate(() => {
        __mstest.shadeSun = { x: 0.2, y: 0.12 };
      });
      await tab(page, 'pattern');
      return [k0, k1];
    };
    const [p0, p1] = await sunMoved();
    assert.notDeepEqual(p1, p0, 'Polished: its bands turned to face the light');
    await slide(page, 'sfGradScat', 3);
    await idle(page);
    const [s0, s1] = await sunMoved();
    assert.deepEqual(s1, s0, 'Sparkle: kept as it was');
    assert.deepEqual(errors, []);
  });
  test('U6: the marker count says how many the Gradient lays (v308: “all · 130”, Ben’s vivid markers); more sections than markers left: “all · N”, no greys', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await bens(page);
    await page.evaluate(() => __mstest.renderControls());
    await idle(page);
    assert.equal(await page.textContent('#sfMkNlbl'), 'all · 130');
    // (v308: the slider ends at the 130 left: 300 is all)
    await slide(page, 'sfMkCount', 300);
    await idle(page);
    assert.equal(await page.textContent('#sfMkNlbl'), 'all · 130');
    // Honolulu 120's clear markers: fewer than the sample's sections
    await page.evaluate(() => {
      const t = __mstest;
      state.owned = new Set(presetMkeys(MARKER_SETS.find((s) => s.n === 'Honolulu 120')));
      save();
      t.coll = sfCollection();
      t.styleVars.limitN = 999;
      t.reassign();
    });
    await idle(page);
    const r = await page.evaluate(() => {
      const t = __mstest,
        A = t.assignData.assign,
        ks = new Set(t.assignData.order.map((l) => A[l].mkey));
      return {
        lbl: document.getElementById('sfMkNlbl').textContent,
        n: ks.size,
        dull: t.assignData.order.filter((l) => t.colour.lch(A[l])[1] < 20).length,
        cnt: t.grad.countNow(),
      };
    });
    assert.ok(r.cnt.all && r.cnt.M < 166, JSON.stringify(r.cnt));
    assert.equal(r.lbl, 'all · ' + r.cnt.M);
    assert.equal(r.n, r.cnt.M);
    assert.equal(r.dull, 0, 'no greys or dull browns');
    assert.deepEqual(errors, []);
  });
  test('U7: turning shading on doesn’t pick other markers; the note offers “Pick shadeable ones”, one Undo step, then it’s gone', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    // (Honolulu 120 at 16 markers: 13 of the sample's 16 shade)
    const k0 = await keys(page);
    await tab(page, 'shading');
    await page.evaluate(() => __mstest.shadeTo('full'));
    await idle(page);
    assert.deepEqual(await keys(page), k0, 'shading on: the same markers');
    // (v308: 11 of the new guide's 16 vivid markers; 13 of v307's)
    assert.match(
      await page.textContent('.sfshnote .sfonelh'),
      /^11 of 16 can be shaded · Pick shadeable onesShow$/,
    );
    await page.click('#sfShPickGo');
    await idle(page);
    const k1 = await keys(page);
    assert.notDeepEqual(k1, k0);
    assert.equal(await page.evaluate(undoLabel), 'Shadeable markers picked');
    assert.equal(await page.locator('#sfShPickGo').count(), 0, 'gone once picked');
    const ok = await page.evaluate(() => {
      const t = __mstest,
        A = t.assignData.assign,
        ms = [...new Set(t.assignData.order.map((l) => A[l]))];
      return ms.filter((m) => t.grad.shadeOK(m)).length;
    });
    // (v308: 14 of the 16, picked from Honolulu 120's vivid markers; 16 from v307's wider pool. v315's Gradient keeps
    // near-identical markers apart, gradArea 2: Y111, which can't be shaded, in place of Y28, too like Y27: 13)
    assert.equal(ok, 13);
    // Undo: back as it was, and the offer with it
    await page.keyboard.press('Control+z');
    await idle(page);
    assert.deepEqual(await keys(page), k0);
    // a gradient in bands that turns to face the light when shading goes on keeps the markers it had
    await tab(page, 'shading');
    await page.click('#sfShade [data-v="off"]');
    await idle(page);
    await tab(page, 'pattern');
    await page.click('#sfShape [data-v="vertical"]');
    await idle(page);
    await page.click('#sfLook [data-v="ltd"]');
    await idle(page);
    const b0 = await keys(page);
    await page.evaluate(() => {
      __mstest.shadeSun = { x: 0.5, y: 0.95 };
    });
    await tab(page, 'shading');
    await page.evaluate(() => __mstest.shadeTo('full'));
    await idle(page);
    const b1 = await keys(page);
    assert.notDeepEqual(b1, b0, 'turned to face the light');
    assert.deepEqual(used(b1), used(b0), 'with the same markers');
    assert.deepEqual(errors, []);
  });
  test('rough spots: at Polished with markers to spare, rings and “N rough spots · Smooth them”; one Undo step; never a grey or a second of a code; kept by Shuffle', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    // (v308: a new guide's "all" from Ben's 451 is his 130 vivid markers, fewer than the sample's 166 sections, so none
    // to spare: a guide from before v308, with all 451 in play, has them)
    await page.evaluate(() => {
      __mstest.styleVars.gradIncl = null;
    });
    await bens(page);
    // (the first-time "Tap a section" line has the slot under the tabs first)
    await tab(page, 'pattern');
    await page.evaluate(() => __mstest.renderControls());
    await idle(page);
    const n0 = await page.evaluate(() => __mstest.grad.roughNow().pairs.length);
    assert.ok(n0 >= 10, n0 + ' rough spots');
    assert.equal(await page.textContent('#sfRough span'), n0 + ' rough spots ·');
    assert.equal(await page.locator('.sfroughs .sfring').count(), n0);
    const A0 = await page.evaluate(() => {
      const A = __mstest.assignData.assign;
      return Object.fromEntries(Object.keys(A).map((l) => [l, A[l].mkey]));
    });
    await page.click('#sfRoughGo');
    await idle(page);
    assert.equal(await page.evaluate(undoLabel), 'Rough spots smoothed');
    const r = await page.evaluate((A0) => {
      const t = __mstest,
        A = t.assignData.assign,
        changed = Object.keys(A).filter((l) => A[l].mkey !== A0[l]),
        by = {};
      for (const l in A) (by[A[l].code] = by[A[l].code] || new Set()).add(A[l].mkey);
      return {
        changed: changed.length,
        added: changed.map((l) => {
          const x = t.colour.lch(A[l]);
          return [A[l].code, x[0], x[1]];
        }),
        twins: Object.keys(by).filter((c) => by[c].size > 1),
        left: t.grad.roughNow().pairs.length,
        first: A[t.assignData.order[0]].mkey === A0[t.assignData.order[0]],
      };
    }, A0);
    assert.ok(r.changed > 0 && r.left < n0 / 2, `${n0} -> ${r.left}`);
    for (const [code, L, C] of r.added) assert.ok(C >= 20 && L >= 34 && L <= 90, code + ' is a clear colour');
    assert.ok(r.first, 'the Start colour kept');
    const tw0 = await page.evaluate((A0) => {
      const by = {};
      for (const l in A0) {
        const m = __mstest.coll.find((x) => x.mkey === A0[l]);
        (by[m.code] = by[m.code] || new Set()).add(m.mkey);
      }
      return Object.keys(by).filter((c) => by[c].size > 1);
    }, A0);
    assert.deepEqual(
      r.twins.filter((c) => !tw0.includes(c)),
      [],
      'no second of a code',
    );
    // nothing left it can do: no line, no rings
    assert.equal(await page.locator('#sfRough').count(), 0);
    assert.equal(await page.locator('.sfroughs .sfring').count(), 0);
    // saved with the guide, and kept through Shuffle
    assert.equal((await page.evaluate(() => __mstest.currentDesignObj().payload.style)).gradFix, true);
    await page.click('#sfVary');
    await idle(page);
    assert.ok(
      await page.evaluate(() => __mstest.grad.fixed && __mstest.grad.fixed.swaps.length > 0),
      'smoothed again after Shuffle',
    );
    await page.keyboard.press('Control+z');
    await idle(page);
    // Undo the smoothing: the rings come back
    await page.keyboard.press('Control+z');
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.styleVars.gradFix), false);
    assert.equal(await page.locator('.sfroughs .sfring').count(), n0);
    // at Natural: none
    await slide(page, 'sfGradScat', 1);
    await idle(page);
    assert.equal(await page.locator('#sfRough').count(), 0);
    assert.equal(await page.locator('.sfroughs .sfring').count(), 0);
    // ✕ closes the line and the rings until the guide changes
    await slide(page, 'sfGradScat', 0);
    await idle(page);
    await page.click('#sfRoughX');
    await idle(page);
    assert.equal(await page.locator('#sfRough').count(), 0);
    assert.equal(await page.locator('.sfroughs .sfring').count(), 0);
    assert.deepEqual(errors, []);
  });
  test('rough spots: none with the marker count below all your markers (a guide of 16 stays 16)', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await tab(page, 'pattern');
    await page.evaluate(() => __mstest.renderControls());
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.grad.roughNow().ids.length), 0);
    assert.equal(await page.locator('#sfRough').count(), 0);
    assert.deepEqual(errors, []);
  });
}

// ---- from v306-dbg-e2e.test.mjs ----
// v306 debugging pass, end to end as Ben (his 451 markers, one marker per section): Colour it on the paper round the
// drawing brings it back as a section of its own colour, so a Gradient with a marker for every section still has one
// for every section (it took a marker another section kept, and the count's label said one more than there were).
// Pages drawn here in code, as in e2e/v306-frame.
{
  // a 1200 × 1500 page: a frame 90 px in, a flower in the middle
  const DRAW = `
g.fillStyle='#fff';g.fillRect(0,0,W,H);g.strokeStyle='#111';g.lineWidth=6;
const ring=(x,y,r)=>{g.beginPath();g.arc(x,y,r,0,6.283);g.stroke();};
g.strokeRect(90,90,W-180,H-180);
ring(600,700,300);ring(600,700,180);g.beginPath();g.moveTo(300,700);g.lineTo(900,700);g.moveTo(600,400);g.lineTo(600,1000);g.stroke();`;
  async function fresh(page) {
    const b64 = await page.evaluate(async (src) => {
      const W = 1200,
        H = 1500,
        c = document.createElement('canvas');
      c.width = W;
      c.height = H;
      new Function('g', 'W', 'H', src)(c.getContext('2d'), W, H);
      const blob = await new Promise((res) => c.toBlob(res, 'image/png'));
      return await new Promise((res) => {
        const f = new FileReader();
        f.onload = () => res(f.result.split(',')[1]);
        f.readAsDataURL(blob);
      });
    }, DRAW);
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.evaluate(() => SF.pickPhoto())]);
    await fc.setFiles({ name: 'page.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
    await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 60000 });
    await idle(page);
  }
  async function built(page) {
    await sampleGuide(page);
    await fresh(page);
    await page.click('#sfBuild');
    await page.waitForFunction(() => __mstest.sfmode === 'guide');
    await idle(page);
    return paper(page);
  }
  const paper = (page) => page.evaluate(() => __mstest.comps.findIndex((c) => c && !c.merged && c.framed));
  const used = (page) =>
    page.evaluate(() => {
      const a = __mstest.assignData,
        ks = a.order.map((l) => a.assign[l].mkey);
      return { n: ks.length, m: new Set(ks).size, label: document.getElementById('sfMkNlbl').textContent };
    });
  for (const scat of [0, 2]) {
    test(`Colour it with a marker for every section (Scatter ${scat}): the paper gets one no other section has, and the count says so; Undo and Redo as before`, async () => {
      const { page, errors } = await openApp({ width: 1180, height: 820 });
      await built(page);
      await page.evaluate((scat) => {
        const t = __mstest;
        state.owned = new Set(defaultOwned());
        save();
        t.coll = sfCollection();
        t.styleVars.limitN = 999;
        t.styleVars.gradScat = scat;
        t.reassign();
      }, scat);
      await idle(page);
      await page.click('.sftabbtn[data-t="colours"]');
      await idle(page);
      const u0 = await used(page);
      assert.equal(u0.m, u0.n, 'one marker per section to start with');
      const before = await page.evaluate(() => {
        const a = __mstest.assignData.assign,
          o = {};
        for (const k in a) o[k] = a[k].mkey;
        return o;
      });
      const p = await paper(page);
      await page.click('#sfFrameColour');
      await idle(page);
      const u1 = await used(page);
      assert.equal(u1.n, u0.n + 1, 'the paper is a section');
      assert.equal(u1.m, u1.n, 'and has a marker of its own: ' + JSON.stringify(u1));
      assert.equal(u1.label, 'all · ' + u1.n); // (v308: "all · 9", not "all · 9 used")
      const after1 = await page.evaluate(() => {
        const a = __mstest.assignData.assign,
          o = {};
        for (const k in a) o[k] = a[k].mkey;
        return o;
      });
      for (const l in before) assert.equal(after1[l], before[l], 'section ' + l + ' keeps its marker');
      assert.ok(after1[p]);
      await page.click('#sfPlanUndo');
      await idle(page);
      assert.deepEqual(await used(page), u0);
      await page.click('#sfPlanRedo');
      await idle(page);
      assert.deepEqual(await used(page), u1);
      assert.deepEqual(errors, []);
    });
  }
}
