// The Gradient's Start colour (v277): when the gradient goes right round the colour wheel, a slider over the loop's
// colours chooses which one the flow starts with; it's hidden for an open ramp. It's the same setting Shuffle turns
// (gradSeed), so it's saved with the guide and taken back by Undo.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, sampleGuide, idle } from './helpers.mjs';

before(setup);
after(teardown);

const slider = (page) => page.evaluate(() => { const g = document.getElementById('sfGStart'); return g ? { v: +g.value, max: +g.max, vt: g.getAttribute('aria-valuetext'), note: document.getElementById('sfGStartLbl').textContent, name: document.getElementById('sfGStartC').textContent } : null; });
const setStart = (page, k) => page.evaluate((k) => { const g = document.getElementById('sfGStart'); g.value = k; g.dispatchEvent(new Event('input', { bubbles: true })); g.dispatchEvent(new Event('change', { bubbles: true })); }, k);
// the marker where the flow starts (the first section in flow order) and the loop's k-th marker from its smoothest start
const first = (page) => page.evaluate(() => __mstest.assignData.assign[__mstest.assignData.order[0]].mkey);
const loopAt = (page, k) => page.evaluate((k) => __mstest.gradStartInfo().cols[k].mkey, k);

test('Start colour: the flow starts with the colour chosen, either way round; the note says where the biggest step went', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await page.click('.sftabbtn[data-t="pattern"]'); await idle(page);
  const s0 = await slider(page);
  assert.ok(s0, 'shown: the sample runs right round the colour wheel');
  assert.equal(s0.v, 0, 'the smoothest start to begin with');
  assert.equal(s0.note, '', 'nothing to say about the biggest step at the smoothest start');
  assert.equal(s0.name, s0.vt, 'the colour is named beside the label');
  assert.equal(await first(page), await loopAt(page, 0));
  const k = Math.min(5, s0.max);
  await setStart(page, k); await idle(page);
  const s1 = await slider(page);
  assert.equal(s1.v, k, 'the slider stays where it was put');
  assert.equal(await first(page), await loopAt(page, k), 'the flow starts with that colour');
  assert.equal(s1.name, s1.vt, 'the name follows the slider');
  assert.match(s1.note, /biggest colour step .* is now inside the picture/);
  assert.equal(s1.vt, await page.evaluate((k) => __mstest.gradStartSay(__mstest.gradStartInfo(), k), k), 'a screen reader hears the colour, not a number');
  // Reversed: the same colour is where the reversed flow starts
  await page.click('#sfDir [data-d="-1"]'); await idle(page);
  assert.equal((await slider(page)).v, k);
  assert.equal(await first(page), await loopAt(page, k), 'Direction turns the flow round, the start colour goes with it');
  assert.deepEqual(errors, []);
});

test('Start colour: by keyboard, one colour a step; Undo takes it back; Shuffle moves the slider too', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await page.click('.sftabbtn[data-t="pattern"]'); await idle(page);
  await page.focus('#sfGStart');
  await page.keyboard.press('ArrowRight'); await idle(page);
  assert.equal((await slider(page)).v, 1);
  assert.equal(await first(page), await loopAt(page, 1));
  assert.equal(await page.evaluate(() => document.activeElement.id), 'sfGStart', 'focus stays on the slider');
  assert.match(await page.getAttribute('#sfPlanUndo', 'aria-label'), /^Undo: Start colour: /, 'Undo says what it takes back');
  await page.click('#sfPlanUndo'); await idle(page);
  assert.equal((await slider(page)).v, 0, 'Undo puts the start back');
  assert.equal(await first(page), await loopAt(page, 0));
  await page.click('#sfVary'); await idle(page);
  const s = await slider(page);
  assert.notEqual(s.v, 0, 'Shuffle turns the start (never almost where it was)');
  assert.equal(await first(page), await loopAt(page, s.v), 'and the slider shows where to');
  assert.deepEqual(errors, []);
});

test('Start colour: hidden for an open ramp (Warm doesn\'t go round the wheel); saved with the guide', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await page.click('.sftabbtn[data-t="pattern"]'); await idle(page);
  await setStart(page, 3); await idle(page);
  const seed = await page.evaluate(() => __mstest.styleVars.gradSeed);
  assert.ok(seed > 0);
  assert.equal(await page.evaluate(() => __mstest.styleSave('style').gradSeed), seed, 'kept in the guide\'s style (saved with it)');
  await page.click('.sftabbtn[data-t="colours"]'); await page.click('#sfPal [data-v="warm"]'); await idle(page);
  await page.click('.sftabbtn[data-t="pattern"]'); await idle(page);
  assert.equal(await slider(page), null, 'no Start colour for a ramp');
  assert.deepEqual(errors, []);
});
