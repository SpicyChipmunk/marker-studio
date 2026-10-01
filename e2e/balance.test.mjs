// Random's Balance (v283): Pattern › Random › Balance (Mixed | Main colour). With Main colour a bar of the three roles
// (tap one to choose its colour family, or Auto), ↻ Other pairings, and a line of what's used; with Mixed, No repeats.
// The engine itself is covered by test/balance.test.mjs.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, sampleGuide, idle, saveGuide } from './helpers.mjs';

before(setup);
after(teardown);

async function random(page) {
  await page.click('.sftabbtn[data-t="pattern"]'); await idle(page);
  await page.click('#sfFam [data-v="random"]'); await idle(page);
}
const plan = (page) => page.evaluate(() => { const p = __mstest.balPlan(); return p.ok ? { keys: ['m', 's', 'a'].map((r) => p.roles[r] ? p.roles[r].k : '-').join('/'), used: p.used } : null; });
// each role's share of the picture's area, in whole percent
const shares = (page) => page.evaluate(() => {
  const t = __mstest, p = t.balPlan(), a = t.assignData, role = {}, r = { m: 0, s: 0, a: 0, x: 0 };
  let tot = 0;
  ['m', 's', 'a'].forEach((k) => p.roles[k] && p.roles[k].markers.forEach((m) => { role[m.mkey] = k; }));
  a.order.forEach((l) => { const k = role[a.assign[l].mkey] || 'x', ar = t.comps[l].area; r[k] += ar; tot += ar; });
  for (const k in r) r[k] = Math.round((100 * r[k]) / tot);
  return r;
});
const undoLabel = (page) => page.getAttribute('#sfPlanUndo', 'aria-label');
// what the bar should say: each role's measured share (f, whole percent), to the nearest 5 (pc), and its name (n)
const measured = (page) => page.evaluate(() => {
  const t = __mstest, p = t.balPlan(), ms = t.balMeasure(p), o = { f: {}, pc: {}, n: {}, sliver: {} };
  ['m', 's', 'a'].forEach((r) => { if (!p.roles[r]) return; o.f[r] = Math.round(ms.f[r] * 100); o.pc[r] = Math.round(ms.f[r] * 20) * 5; o.n[r] = t.balShort(r); o.sliver[r] = ms.f[r] > 0 && ms.f[r] < 0.025; });
  return o;
});

test('Random starts on Main colour: a bar of three roles about 60/30/10 of the picture, a line of what it uses, and the picture laid that way', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  await random(page);
  assert.equal(await page.getAttribute('#sfBal [data-v="main"]', 'aria-pressed'), 'true');
  assert.equal(await undoLabel(page), 'Undo: Pattern: Random');
  const segs = await page.$$eval('#sfBalBar .sfbalseg', (b) => b.map((x) => ({ r: x.dataset.r, t: x.innerText.replace(/\n/g, ""), w: x.getBoundingClientRect().width, lab: x.getAttribute('aria-label') })));
  assert.deepEqual(segs.map((s) => s.r), ['m', 's', 'a']);
  // (v284: what's painted, to the nearest 5, within 5 of 60/30/10)
  const want = await measured(page);
  assert.equal(segs[0].t, want.n.m + ' · ' + want.pc.m + '%');
  assert.equal(segs[1].t, want.n.s + ' · ' + want.pc.s + '%');
  // (a name shows only where it fits whole)
  assert.ok([want.pc.a + '%', want.n.a + ' · ' + want.pc.a + '%'].includes(segs[2].t), segs[2].t);
  assert.ok(Math.abs(want.f.m - 60) <= 5 && Math.abs(want.f.s - 30) <= 5 && Math.abs(want.f.a - 10) <= 5, JSON.stringify(want.f));
  assert.ok(segs[0].w > segs[1].w * 1.5 && segs[1].w > segs[2].w * 1.4, 'widths follow the shares');
  assert.equal(segs[0].lab, 'Main colour: ' + (await page.evaluate(() => __mstest.balName('m', __mstest.balPlan()).toLowerCase())) + ', chosen for you, about ' + want.pc.m + '% of the picture. Change');
  assert.match(await page.textContent('#sfBalNote'), /^\d+ [a-z-]+s?(?:, with [^,]*)?, \d+ [a-z-]+s?(?:, with [^,]*)? and \d+ [a-z-]+s?(?:, with .*)? (?:of yours|from the catalogue)\./);
  const r = await shares(page);
  assert.ok(Math.abs(r.m - 60) <= 4 && Math.abs(r.s - 30) <= 4 && Math.abs(r.a - 10) <= 4 && r.x === 0, JSON.stringify(r));
  // Keep touching sections clearly different is still there; No repeats is Mixed's
  assert.ok(await page.$('#sfNoAdj'));
  assert.equal(await page.$('#sfNoRep'), null);
  assert.deepEqual(errors, []);
});

test('a part of the bar opens its colour families (Auto first); choosing one lays it again, one Undo step, Temperature greys out; a family another role has swaps them', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  await random(page);
  const before = await plan(page);
  await page.click('#sfBalM'); await page.waitForSelector('#sfSheet.sfbalsh'); await idle(page);
  assert.equal(await page.textContent('#sfSheetT'), 'Main colour: ' + (await page.evaluate(() => __mstest.balName('m', __mstest.balPlan()).toLowerCase())) + ' · about ' + (await measured(page)).pc.m + '%');
  const opts = await page.$$eval('#sfSheet .sfbalopt', (b) => b.map((x) => [x.dataset.k, x.getAttribute('aria-pressed')]));
  assert.deepEqual(opts[0], ['auto', 'true']);
  assert.ok(opts.length >= 8, 'the families there are');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.k), 'auto', 'the choice there is has the focus');
  // a family nobody has
  const [m0, s0] = before.keys.split('/');
  const pick = opts.map((o) => o[0]).find((k) => k !== 'auto' && k !== 'grey' && !before.keys.split('/').includes(k));
  await page.click(`#sfSheet .sfbalopt[data-k="${pick}"]`); await idle(page);
  assert.equal(await page.$('#sfSheet'), null);
  assert.equal((await plan(page)).keys.split('/')[0], pick);
  assert.match(await undoLabel(page), new RegExp('^Undo: Main colour: '));
  assert.equal(await page.evaluate(() => document.activeElement.id), 'sfBalM');
  assert.match(await page.getAttribute('#sfBalM', 'aria-label'), new RegExp('^Main colour: [a-z][a-z -]+, about ' + (await measured(page)).pc.m + '%'));
  // Temperature: the colours are chosen, so it greys out and says why
  await page.click('.sftabbtn[data-t="colours"]'); await idle(page);
  assert.equal(await page.isDisabled('#sfPal [data-v="cool"]'), true);
  assert.match(await page.textContent('#sfPanel-colours'), /Main colour sets this/);
  await page.click('.sftabbtn[data-t="pattern"]'); await idle(page);
  // the second's family chosen for the main colour: they swap (a second chosen by hand takes the main colour's)
  await page.click('#sfBalS'); await page.waitForSelector('#sfSheet.sfbalsh');
  await page.click(`#sfSheet .sfbalopt[data-k="${s0 === pick ? m0 : s0}"]`); await idle(page);
  const k1 = (await plan(page)).keys.split('/');
  await page.click('#sfBalM'); await page.waitForSelector('#sfSheet.sfbalsh');
  assert.match(await page.textContent(`#sfSheet .sfbalopt[data-k="${k1[1]}"]`), /now the second colour: they swap/);
  await page.click(`#sfSheet .sfbalopt[data-k="${k1[1]}"]`); await idle(page);
  const k2 = (await plan(page)).keys.split('/');
  assert.deepEqual([k2[0], k2[1]], [k1[1], k1[0]]);
  // Undo, step by step
  await page.click('#sfPlanUndo'); await idle(page);
  assert.deepEqual((await plan(page)).keys.split('/').slice(0, 2), k1.slice(0, 2));
  // Escape closes the sheet with nothing changed
  await page.click('#sfBalA'); await page.waitForSelector('#sfSheet.sfbalsh');
  assert.equal(await page.$('#sfSheet .sfbalopt[data-k="grey"]'), null, 'no grey accent');
  await page.keyboard.press('Escape'); await page.waitForSelector('#sfSheet', { state: 'detached' });
  assert.deepEqual((await plan(page)).keys.split('/').slice(0, 2), k1.slice(0, 2));
  assert.deepEqual(errors, []);
});

test('↻ Other pairings rolls the roles left on Auto for a different pairing; Shuffle keeps the colours and lays them again', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  await random(page);
  const a = await plan(page);
  await page.click('#sfBalPair'); await idle(page);
  const b = await plan(page);
  assert.notEqual(b.keys, a.keys);
  assert.equal(await undoLabel(page), 'Undo: Other pairings');
  const asg = () => page.evaluate(() => JSON.stringify(__mstest.assignData.order.slice().sort((a, b) => a - b).map((l) => l + ':' + __mstest.assignData.assign[l].mkey)));
  const x = await asg();
  await page.click('#sfShuffle'); await idle(page);
  assert.equal((await plan(page)).keys, b.keys, 'the same colours');
  assert.notEqual(await asg(), x, 'laid again');
  // every role chosen by hand: nothing left to roll
  await page.evaluate(() => { const v = __mstest.styleVars, p = __mstest.balPlan(); v.balM = p.roles.m.k; v.balS = p.roles.s.k; v.balA = p.roles.a.k; __mstest.reassign(); });
  await idle(page);
  assert.equal(await page.isDisabled('#sfBalPair'), true);
  assert.deepEqual(errors, []);
});

test('Mixed is Random as it was; No repeats gives every section its own marker, the count says "one per section"; both are one Undo step', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  await random(page);
  await page.click('#sfBal [data-v="mixed"]'); await idle(page);
  assert.equal(await undoLabel(page), 'Undo: Balance: Mixed');
  assert.equal(await page.$('#sfBalBar'), null);
  assert.equal(await page.isChecked('#sfNoRep'), false);
  const distinct = () => page.evaluate(() => { const a = __mstest.assignData; return [a.order.length, new Set(a.order.map((l) => a.assign[l].mkey)).size]; });
  const [n0, k0] = await distinct();
  assert.ok(k0 <= 16, 'Mixed: the marker count’s worth, repeated');
  await page.check('#sfNoRep'); await idle(page);
  assert.equal(await undoLabel(page), 'Undo: No repeats on');
  const [n, k] = await distinct();
  assert.equal(n, n0);
  const pool = await page.evaluate(() => __mstest.noRepPool(__mstest.countedList()).length);
  assert.equal(k, Math.min(n, pool));
  assert.match(await page.textContent('#sfNoRepNote'), k >= n ? /^Every section has its own marker: \d+\./ : /^\d+ sections, \d+ markers: (?:each used about \d+ times|\d+ used twice), every one before any again, kept apart\./);
  await page.click('.sftabbtn[data-t="colours"]'); await idle(page);
  assert.match(await page.textContent('#sfMkNlbl'), /one per section/);
  assert.equal(await page.isDisabled('#sfMkCount'), true);
  assert.match(await page.textContent('#sfPanel-colours .sfpoolct'), /one per section/);
  await page.click('.sftabbtn[data-t="pattern"]'); await idle(page);
  // (Main colour has no No repeats)
  await page.click('#sfBal [data-v="main"]'); await idle(page);
  assert.equal(await page.$('#sfNoRep'), null);
  assert.deepEqual(errors, []);
});

test('saved with the guide and opened as it was; a Random guide saved before Balance opens Mixed, as it looked', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  await random(page);
  await page.click('#sfBalM'); await page.waitForSelector('#sfSheet.sfbalsh');
  await page.click('#sfSheet .sfbalopt[data-k="blue"]'); await idle(page);
  const d = await page.evaluate(() => __mstest.currentDesignObj());
  assert.equal(d.payload.style.balance, 'main');
  assert.equal(d.payload.style.balM, 'blue');
  await saveGuide(page);
  const id = await page.evaluate(() => __mstest.curId);
  const asg = await page.evaluate(() => JSON.stringify(__mstest.assignData.order.slice().sort((a, b) => a - b).map((l) => l + ':' + __mstest.assignData.assign[l].mkey)));
  await page.reload(); await idle(page);
  await page.evaluate((id) => loadGuide({ id }), id);
  await page.waitForFunction((id) => __mstest.curId === id && __mstest.assignData, id); await idle(page);
  assert.equal(await page.evaluate(() => __mstest.styleVars.balM), 'blue');
  assert.equal(await page.evaluate(() => JSON.stringify(__mstest.assignData.order.slice().sort((a, b) => a - b).map((l) => l + ':' + __mstest.assignData.assign[l].mkey))), asg, 'its colours as they were');
  // a guide from before v283: no balance saved
  await page.evaluate(() => { const t = __mstest, d = t.currentDesignObj(), p = d.payload; ['balance', 'balM', 'balS', 'balA', 'balSeed', 'noRep'].forEach((k) => delete p.style[k]); t.openDesignObj(Object.assign({}, p, { name: 'Old', W: d.W, H: d.H }), null); });
  await page.waitForFunction(() => __mstest.curName === 'Old'); await idle(page);
  assert.equal(await page.evaluate(() => __mstest.styleVars.balance), 'mixed');
  await page.click('.sftabbtn[data-t="pattern"]'); await idle(page);
  assert.equal(await page.getAttribute('#sfBal [data-v="mixed"]', 'aria-pressed'), 'true');
  assert.deepEqual(errors, []);
});

test('zones: each has its own Balance; a zone of fewer than 10 sections has no accent of its own, and says so', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  await random(page);
  await page.click('#sfBal [data-v="mixed"]'); await idle(page);
  await page.click('#sfZoneAdd'); await idle(page);
  await page.evaluate(() => { const t = __mstest, cl = Object.keys(t.assignData.assign).map(Number).sort((a, b) => t.comps[b].area - t.comps[a].area).slice(0, 6); t.zoneMove(cl, t.zoneCur); t.reassign([0, t.zoneCur]); });
  await page.click('#sfZoneDone'); await idle(page);
  // the new zone copies Main's Balance; Main colour for it
  assert.equal(await page.evaluate(() => __mstest.styleVars.balance), 'mixed');
  await page.click('#sfBal [data-v="main"]'); await idle(page);
  assert.match(await page.textContent('#sfBalNote'), /Too few sections for an accent of their own\./);
  await page.click('#sfPanel-pattern .sfzchip[data-z="0"]'); await idle(page);
  assert.equal(await page.evaluate(() => __mstest.styleVars.balance), 'mixed', 'Main keeps its own');
  assert.deepEqual(errors, []);
});

test('the bar by keyboard: each part a button that opens its sheet; Surprise sometimes picks Random with a main colour, and says so', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  await random(page);
  await page.focus('#sfBalS'); await page.keyboard.press('Enter'); await page.waitForSelector('#sfSheet.sfbalsh'); await idle(page);
  assert.equal(await page.textContent('#sfSheetT'), 'Second colour: ' + (await page.evaluate(() => __mstest.balName('s', __mstest.balPlan()).toLowerCase())) + ' · about ' + (await measured(page)).pc.s + '%');
  await page.keyboard.press('Escape'); await page.waitForSelector('#sfSheet', { state: 'detached' });
  assert.equal(await page.evaluate(() => document.activeElement.id), 'sfBalS');
  // Surprise: Random with a main colour about one time in three
  let got = null;
  for (let i = 0; i < 30 && !got; i++) {
    await page.click('#sfSurprise'); await idle(page);
    if (await page.evaluate(() => __mstest.styleVars.family) === 'random') got = await undoLabel(page);
  }
  assert.ok(got, 'Random in 30 goes');
  assert.match(got, /Surprise: .+ palette · Random, main colour [a-z-]+s/);
  assert.equal(await page.evaluate(() => __mstest.styleVars.balance), 'main');
  assert.deepEqual(errors, []);
});

test('v284, a saved palette: a colour far from the others is an accent, the bar follows what Shuffle paints; a main colour of one marker says so, and Add shades turns Expand on', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  await random(page);
  await page.evaluate(() => {
    const t = __mstest, by = {};
    t.coll.forEach((m) => { const f = t.balFamOf(m); (by[f] = by[f] || []).push(m.mkey); });
    state.saved.unshift({ id: 884001, type: 'palette', name: 'Five', keys: [by.blue[0], by.blue[Math.floor(by.blue.length / 2)], by.teal[0], by.orange[0], by.pink[0]], ts: 884001 });
    state.saved.unshift({ id: 884002, type: 'palette', name: 'Two', keys: [by.blue[0], by.orange[0]], ts: 884002 });
    save();
    Object.assign(t.styleVars, { paletteSource: 'saved', savedPalId: 884001, expand: false });
    t.reassign();
  });
  await idle(page);
  const bar = () => page.$$eval('#sfBalBar .sfbalseg', (b) => b.map((x) => ({ t: x.innerText.replace(/\n/g, ""), cut: [...x.querySelectorAll('span')].some((s) => s.offsetParent && s.scrollWidth > s.clientWidth + 1) })));
  const check = async () => {
    const w = await measured(page), t = await bar(), rs = Object.keys(w.pc);
    rs.forEach((r, i) => {
      const pct = (w.sliver[r] ? '<5' : w.pc[r]) + '%';
      assert.ok(t[i].t === pct || t[i].t === w.n[r] + ' · ' + pct, t[i].t + ' vs ' + w.n[r] + ' ' + pct);
      assert.ok(!t[i].cut, 'nothing cut short: ' + t[i].t);
    });
    assert.equal(t[0].t.split(' · ')[0], w.n.m, 'the main colour named');
    return w;
  };
  const w = await check();
  assert.ok(w.f.a <= 25, 'the accent a pop of colour: ' + JSON.stringify(w.f));
  // (a share 8 points or more off what was asked says why)
  const miss = await page.evaluate(() => __mstest.balMeasure(__mstest.balPlan()).miss);
  assert.equal(!!(await page.$('#sfBalMiss')), miss >= 0.08, 'miss ' + miss);
  assert.match(await page.textContent('#sfBalNote'), /^The palette’s 5 markers: blues the main colour, /);
  await page.click('#sfShuffle'); await idle(page);
  await check();
  // two colours: one marker for the main colour
  await page.evaluate(() => { __mstest.styleVars.savedPalId = 884002; __mstest.reassign(); });
  await idle(page);
  assert.match(await page.textContent('#sfBalOne'), /^One [a-z-]+ marker for the main colour, so touching [a-z-]+ sections will merge\. Add shades$/);
  await check();
  await page.click('#sfBalShades'); await idle(page);
  assert.equal(await page.evaluate(() => __mstest.styleVars.expand), true);
  assert.ok(await page.evaluate(() => __mstest.styleVars.limitN) >= 6);
  assert.equal(await page.$('#sfBalShades'), null);
  assert.match(await undoLabel(page), /^Undo: /);
  assert.deepEqual(errors, []);
});
