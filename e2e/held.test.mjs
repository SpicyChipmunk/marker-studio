// v284: sections with ink on the paper (ticked, or some of their tones coloured) keep their markers through any change
// to the plan, and Undo leaves them too; a toast says so when it matters, with Recolour them too (one Undo step, which
// puts the ticks back). Their Shadows and Highlights keep as well, saved with the guide. Also: the Photo pattern chosen
// before a photo is picked keeps the pattern before it (laid and saved), and choosing a saved palette asks nothing.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, sampleGuide, idle } from './helpers.mjs';

before(setup);
after(teardown);

const asg = (page) => page.evaluate(() => { const a = __mstest.assignData, o = {}; a.order.forEach((l) => { o[l] = a.assign[l].mkey; }); return o; });
// tick n of the biggest sections done, and colour one step of the next few (as Colour along does)
async function colourSome(page, n, part) {
  await page.click('#sfColor'); await idle(page);
  const secs = await page.evaluate(([n, part]) => {
    const t = __mstest, a = t.assignData, big = a.order.slice().sort((x, y) => t.comps[y].area - t.comps[x].area);
    const done = big.slice(0, n), half = big.slice(n, n + part);
    done.forEach((l) => { t.colored[l] = 1; });
    half.forEach((l) => { t.stepSet(l, 1, true); });
    t.renderGuide();
    return { done, half };
  }, [n, part]);
  await page.click('#sfDoneBtn'); await idle(page);
  return secs;
}
// (the line under the Plan's tabs that says so: not a toast, which sits over Shuffle and Pin colours)
const noteText = (page) => page.evaluate(() => { const n = document.querySelectorAll('#sfHeldNote'); return n.length ? n.length + ':' + n[0].querySelector('span').textContent + ' · ' + document.getElementById('sfHeldGo').textContent : ''; });

test('ticked and part-done sections keep their markers through a change to the plan; a line under the tabs says so once, and they are never saved as pins', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  await page.click('.sftabbtn[data-t="pattern"]'); await page.click('#sfFam [data-v="random"]'); await idle(page);
  await page.click('#sfBal [data-v="mixed"]'); await idle(page);
  const { done, half } = await colourSome(page, 6, 2);
  const kept = done.concat(half), a0 = await asg(page);
  await page.click('#sfShuffle'); await idle(page);
  const a1 = await asg(page);
  kept.forEach((l) => assert.equal(a1[l], a0[l], 'section ' + l + ' kept its marker'));
  assert.ok(Object.keys(a0).some((l) => !kept.includes(+l) && a1[l] !== a0[l]), 'the rest laid again');
  assert.equal(await noteText(page), '1:Kept 8 coloured sections as they are · Recolour them too');
  assert.ok(!(await page.evaluate(() => document.getElementById('msToast')?.classList.contains('on') && /Kept/.test(document.getElementById('msToast').textContent))), 'no toast for it');
  assert.equal(await page.getAttribute('#sfPlanUndo', 'aria-label'), 'Undo: Colours shuffled');
  // (Undo takes the line away with the change it spoke of; the change again brings it back, as it's more than told)
  await page.click('#sfPlanUndo'); await idle(page);
  assert.equal(await noteText(page), '', 'gone with Undo');
  await page.evaluate(() => { __mstest.heldTold = 0; });
  await page.click('#sfShuffle'); await idle(page);
  // not pins: nothing in locks, nothing saved as one
  assert.deepEqual(await page.evaluate(() => Object.keys(__mstest.locks)), []);
  assert.deepEqual(await page.evaluate(() => __mstest.currentDesignObj().payload.locks), {});
  // a change while it shows: it stays, for this change's sections
  await page.click('#sfShuffle'); await idle(page);
  assert.equal(await noteText(page), '1:Kept 8 coloured sections as they are · Recolour them too');
  // closed, then a second change on this visit: kept again, not said again
  await page.click('#sfHeldX'); await idle(page);
  assert.equal(await noteText(page), '');
  await page.click('#sfShuffle'); await idle(page);
  const a2 = await asg(page);
  kept.forEach((l) => assert.equal(a2[l], a0[l]));
  assert.equal(await noteText(page), '');
  assert.deepEqual(errors, []);
});

test('Undo leaves coloured sections as they are; Recolour them too lays them again unticked, one Undo step that puts the ticks back', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  await page.click('.sftabbtn[data-t="pattern"]'); await page.click('#sfFam [data-v="random"]'); await idle(page);
  await page.click('#sfBal [data-v="mixed"]'); await idle(page);
  const a0 = await asg(page);
  await page.click('#sfShuffle'); await idle(page);
  // coloured after the Shuffle, with its markers
  const { done } = await colourSome(page, 5, 0), a1 = await asg(page);
  await page.click('#sfPlanUndo'); await idle(page);
  const a2 = await asg(page);
  done.forEach((l) => assert.equal(a2[l], a1[l], 'Undo left section ' + l + ' as coloured'));
  assert.ok(Object.keys(a0).some((l) => !done.includes(+l) && a2[l] === a0[l] && a1[l] !== a0[l]), 'the rest went back');
  // a change, then Recolour them too
  await page.click('#sfShuffle'); await idle(page);
  const a3 = await asg(page);
  await page.click('#sfHeldGo'); await idle(page);
  assert.equal(await noteText(page), '', 'the line goes once used');
  assert.match(await page.getAttribute('#sfPlanUndo', 'aria-label'), /^Undo: Recoloured 5 coloured sections$/);
  const st = await page.evaluate((d) => d.map((l) => __mstest.colored[l]), done);
  assert.deepEqual(st, [0, 0, 0, 0, 0], 'unticked');
  const a4 = await asg(page);
  assert.ok(done.some((l) => a4[l] !== a3[l]), 'laid again');
  await page.click('#sfPlanUndo'); await idle(page);
  assert.deepEqual(await page.evaluate((d) => d.map((l) => __mstest.colored[l]), done), [1, 1, 1, 1, 1], 'the ticks back');
  const a5 = await asg(page);
  done.forEach((l) => assert.equal(a5[l], a3[l], 'and their markers'));
  assert.deepEqual(errors, []);
});

test('every way the plan is laid again keeps them: Blend’s Spread too (v284 review)', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  await page.click('.sftabbtn[data-t="pattern"]'); await page.click('#sfFam [data-v="blend"]'); await idle(page);
  const { done } = await colourSome(page, 6, 0), a0 = await asg(page);
  await page.click('.sftabbtn[data-t="pattern"]'); await idle(page);
  await page.evaluate(() => { const s = document.getElementById('sfSpread'); s.value = s.value === '4' ? '0.6' : '4'; s.dispatchEvent(new Event('input', { bubbles: true })); s.dispatchEvent(new Event('change', { bubbles: true })); });
  await idle(page);
  const a1 = await asg(page);
  done.forEach((l) => assert.equal(a1[l], a0[l], 'section ' + l + ' kept its marker'));
  assert.ok(Object.keys(a0).some((l) => !done.includes(+l) && a1[l] !== a0[l]), 'the rest blended again');
  assert.deepEqual(await page.evaluate((d) => d.map((l) => __mstest.colored[l]), done), done.map(() => 1), 'still ticked');
  assert.deepEqual(errors, []);
});

test('a coloured section keeps its Shadows and Highlights when they change; saved with the guide, it opens the same', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  await page.click('.sftabbtn[data-t="shading"]'); await page.click('#sfShade [data-v="full"]'); await idle(page);
  const { done } = await colourSome(page, 4, 0);
  const tones = () => page.evaluate(() => { const o = {}; __mstest.assignData.order.forEach((l) => { const t = __mstest.shadeSec(l); if (t) o[l] = (t.dark ? t.dark.mkey : '-') + '/' + (t.light ? t.light.mkey : '-'); }); return o; });
  const t0 = await tones();
  const shaded = done.filter((l) => t0[l]);
  assert.ok(shaded.length >= 2, 'some coloured sections are shaded');
  await page.click('.sftabbtn[data-t="shading"]'); await idle(page);
  await page.selectOption('#sfShStyle', 'grey'); await idle(page);
  const t1 = await tones();
  shaded.forEach((l) => assert.equal(t1[l], t0[l], 'section ' + l + ' kept its tones'));
  assert.ok(Object.keys(t0).some((l) => !done.includes(+l) && t1[l] !== t0[l]), 'the rest follow Grey');
  const d = await page.evaluate(() => __mstest.currentDesignObj());
  shaded.forEach((l) => assert.deepEqual(d.payload.held[l], ['same', 'same', 0]));
  await page.evaluate((d) => { const p = d.payload; __mstest.openDesignObj(Object.assign({}, p, { name: 'Held', W: d.W, H: d.H }), null); }, d);
  await page.waitForFunction(() => __mstest.curName === 'Held'); await idle(page);
  const t2 = await tones();
  shaded.forEach((l) => assert.equal(t2[l], t0[l], 'reopened, section ' + l + ' still has its tones'));
  assert.deepEqual(errors, []);
});

test('v285: a section part-way coloured keeps its Highlights, its Shadows follow until its shadow is coloured; saved that way, and a v284 save keeps both', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  await page.click('.sftabbtn[data-t="shading"]'); await page.click('#sfShade [data-v="full"]'); await idle(page);
  await page.click('#sfColor'); await idle(page);
  // shaded sections with both a lighter and a darker tone: one with its base coloured, one with its shadow coloured too
  const [a, b] = await page.evaluate(() => {
    const t = __mstest, o = t.assignData.order.filter((l) => { const s = t.shadeSec(l); return s && s.light && s.dark; });
    t.stepSet(o[0], 2, true); t.stepSet(o[1], 2, true); t.stepSet(o[1], 4, true); t.renderGuide();
    return [o[0], o[1]];
  });
  await page.click('#sfDoneBtn'); await idle(page);
  const tones = (l) => page.evaluate((l) => { const s = __mstest.shadeSec(l); return { dark: s && s.dark ? s.dark.mkey : '-', light: s && s.light ? s.light.mkey : '-' }; }, l);
  const a0 = await tones(a), b0 = await tones(b);
  await page.click('.sftabbtn[data-t="shading"]'); await idle(page);
  await page.selectOption('#sfShStyle', 'grey'); await idle(page);
  await page.selectOption('#sfHiStyle', 'paper'); await idle(page);
  const a1 = await tones(a), b1 = await tones(b);
  assert.equal(a1.light, a0.light, 'highlight kept once anything is coloured');
  assert.notEqual(a1.dark, a0.dark, 'shadow not on the paper yet: it follows Grey');
  assert.deepEqual(b1, b0, 'shadow coloured: both kept');
  const d = await page.evaluate(() => __mstest.currentDesignObj());
  assert.equal(d.payload.held[a][2], 1, 'saved with its shadow free');
  assert.equal(d.payload.held[b][2], 0);
  // reopened: the same
  await page.evaluate((d) => { __mstest.openDesignObj(Object.assign({}, d.payload, { name: 'Held 2', W: d.W, H: d.H }), null); }, d);
  await page.waitForFunction(() => __mstest.curName === 'Held 2'); await idle(page);
  assert.deepEqual(await tones(a), a1); assert.deepEqual(await tones(b), b0);
  // a v284 save ([shadow, hilite]) keeps both, even for a section part-way coloured
  const d2 = JSON.parse(JSON.stringify(d));
  d2.payload.held[a] = [d.payload.style.shShadow || 'same', d.payload.held[a][1]];
  const legacy = await page.evaluate(([d, a]) => { const p = Object.assign({}, d.payload, { name: 'Held 3', W: d.W, H: d.H }); p.held = Object.assign({}, p.held); p.held[a] = ['same', p.held[a][1]]; __mstest.openDesignObj(p, null); return p.held[a]; }, [d2, a]);
  await page.waitForFunction(() => __mstest.curName === 'Held 3'); await idle(page);
  const a3 = await tones(a);
  await page.click('.sftabbtn[data-t="shading"]'); await idle(page);
  await page.selectOption('#sfShStyle', 'cool'); await idle(page);
  assert.deepEqual(await tones(a), a3, 'v284 hold: both kept: ' + legacy);
  assert.deepEqual(errors, []);
});

test('Photo chosen with no photo picked: the pattern before it stays laid and saved; choosing a saved palette asks nothing', async () => {
  const { page, errors } = await openApp();
  const dialogs = [];
  page.on('dialog', (dl) => { dialogs.push(dl.message()); dl.dismiss(); });
  await sampleGuide(page); await idle(page);
  await page.click('.sftabbtn[data-t="pattern"]'); await page.click('#sfFam [data-v="random"]'); await idle(page);
  const a0 = await asg(page);
  // (the file picker is left closed, as when it's cancelled)
  await page.evaluate(() => { HTMLInputElement.prototype.click = function () {}; });
  await page.click('#sfFam [data-v="photo"]'); await idle(page);
  assert.equal(await page.getAttribute('#sfFam [data-v="photo"]', 'aria-pressed'), 'true');
  assert.equal(await page.evaluate(() => __mstest.currentDesignObj().payload.style.family), 'random', 'saved as the pattern still laid');
  await page.click('.sftabbtn[data-t="colours"]'); await idle(page);
  await page.evaluate(() => { const s = document.getElementById('sfMkCount'); s.value = String(+s.value - 2); s.dispatchEvent(new Event('input', { bubbles: true })); s.dispatchEvent(new Event('change', { bubbles: true })); });
  await idle(page);
  const a1 = await asg(page);
  assert.notDeepEqual(a1, a0, 'laid again');
  assert.equal(await page.evaluate(() => __mstest.currentDesignObj().payload.style.family), 'random', 'as Random, not a Gradient under Photo');
  // a saved palette: no "are you sure"
  await page.evaluate(() => { state.saved.unshift({ id: 885001, type: 'palette', name: 'Mine', keys: [...state.owned].slice(0, 6), ts: 885001 }); save(); });
  await page.click('.sftabbtn[data-t="colours"]'); await idle(page);
  await page.click('#sfSrc [data-v="saved"]'); await idle(page);
  assert.equal(await page.evaluate(() => __mstest.styleVars.paletteSource), 'saved');
  assert.deepEqual(dialogs, []);
  assert.deepEqual(errors, []);
});
