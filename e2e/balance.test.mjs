// Random's Balance (v283): Pattern › Random › Balance (Mixed | Main colour). With Main colour a bar of the three roles
// (tap one to choose its colour family, or Auto), ↻ Other pairings, and a line of what's used; with Mixed, No repeats.
// The engine itself is covered by test/balance.test.mjs.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, sampleGuide, idle } from './helpers.mjs';

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

test('Random starts on Main colour: a bar of three roles about 60/30/10 of the picture, a line of what it uses, and the picture laid that way', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  await random(page);
  assert.equal(await page.getAttribute('#sfBal [data-v="main"]', 'aria-pressed'), 'true');
  assert.equal(await undoLabel(page), 'Undo: Pattern: Random');
  const segs = await page.$$eval('#sfBalBar .sfbalseg', (b) => b.map((x) => ({ r: x.dataset.r, t: x.textContent, w: x.getBoundingClientRect().width, lab: x.getAttribute('aria-label') })));
  assert.deepEqual(segs.map((s) => s.r), ['m', 's', 'a']);
  assert.match(segs[0].t, /^[A-Z][a-z-]+ · 60%$/);
  assert.match(segs[1].t, /^[A-Z][a-z-]+ · 30%$/);
  assert.equal(segs[2].t, '10%');
  assert.ok(segs[0].w > segs[1].w * 1.6 && segs[1].w > segs[2].w * 1.5, 'widths follow the shares');
  assert.match(segs[0].lab, /^Main colour: [A-Z][a-z-]+, chosen for you, about 60% of the picture\. Change$/);
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
  assert.equal(await page.textContent('#sfSheetT'), 'Main colour · about 60%');
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
  assert.match(await page.getAttribute('#sfBalM', 'aria-label'), /^Main colour: [A-Z][a-z-]+, about 60%/);
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
  await page.click('#sfSave'); await page.waitForFunction(() => /Saved in your Library/.test(document.getElementById('sfSaveSt').textContent));
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
  assert.equal(await page.textContent('#sfSheetT'), 'Second colour · about 30%');
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
