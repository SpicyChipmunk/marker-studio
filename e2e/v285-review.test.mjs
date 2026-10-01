// v285's pre-release review: narrow landscape phones keep the whole controls column; an automatic first save leaves a
// name being typed alone; Put back while the Library's delete is still waiting keeps the guide's stored copy; Home's
// Continue card follows a rename and isn't redrawn while Home is hidden; the marker sets' caret stays an icon.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, sampleGuide, idle, saveGuide } from './helpers.mjs';

before(setup);
after(teardown);

const AUTO = 2300; // idle(page, AUTO): until auto-save (1.5 s after the last change) has run
const guides = (page) => page.evaluate(() => state.saved.filter((s) => s.type === 'guide').map((s) => ({ id: s.id, name: s.name })));
const tickInCode = (page, i) => page.evaluate((i) => { const t = __mstest; t.colored[t.assignData.order[i]] = 1; t.guideDirty = true; t.renderGuide(); }, i);

test('narrow landscape phones (640–667 wide): side by side with the whole controls column on screen', async () => {
  for (const [w, h] of [[667, 375], [640, 360]]) {
    const { page, errors, ctx } = await openApp({ width: w, height: h });
    await sampleGuide(page); await idle(page);
    const g = await page.evaluate(() => {
      const c = document.getElementById('sfCtl').getBoundingClientRect(), v = document.getElementById('sfCanvas').getBoundingClientRect(), b = document.querySelector('#sfWork>.sfbar').getBoundingClientRect();
      return { side: __mstest.geo.side, ctlR: c.right, ctlW: c.width, picR: v.right, ctlL: c.left, barR: b.right, vw: innerWidth };
    });
    assert.equal(g.side, true, `${w}×${h}: side by side`);
    assert.ok(g.ctlR <= g.vw - 8, `${w}×${h}: the controls end on screen (${g.ctlR} of ${g.vw})`);
    assert.ok(g.barR <= g.vw, `${w}×${h}: the bar too (${g.barR})`);
    assert.ok(g.ctlW >= 300, `${w}×${h}: controls ${g.ctlW}px`);
    assert.ok(g.picR <= g.ctlL, 'the picture left of them');
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});

test('the automatic first save leaves a name being typed alone: Escape keeps the name it had', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  await page.click('#sfRename'); await page.fill('#sfGName', 'Fl');
  await tickInCode(page, 0); // a change: the sample is kept now
  await page.waitForFunction(() => __mstest.inLibrary, null, { timeout: AUTO + 5000 });
  const [g] = await guides(page);
  assert.equal(g.name, 'Sample jellyfish', 'saved under its own name, not the half-typed one');
  await page.press('#sfGName', 'Escape'); await idle(page);
  assert.equal(await page.textContent('#sfGTitle'), 'Sample jellyfish');
  assert.equal((await guides(page))[0].name, 'Sample jellyfish');
  assert.deepEqual(errors, []);
});

test('Put back while the Library is still to tidy the deleted guide away keeps its stored copy', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await saveGuide(page);
  const [g] = await guides(page);
  // deleted (the 6 s Undo still running), then Put back with the tidy-up landing at once
  await page.evaluate((id) => libDelete(id), g.id); await idle(page);
  assert.equal(await page.textContent('#sfSave'), 'Put back');
  // (the Undo window ends while the guide's record is being written)
  await page.evaluate((id) => {
    const put = IDB.put;
    IDB.put = function (k) { const p = put.apply(this, arguments); if (k === 'guide-' + id) { IDB.put = put; libFinish(); } return p; };
    document.getElementById('sfSave').click();
  }, g.id);
  await page.waitForFunction(() => __mstest.inLibrary); await idle(page, 7000);
  assert.equal((await guides(page)).length, 1);
  assert.equal(await page.evaluate((id) => IDB.get('guide-' + id).then((p) => !!p), g.id), true, 'its stored copy is there');
  assert.equal(await page.evaluate((id) => libPendList().some((x) => x.id === id), g.id), false, 'and nothing waits to delete it');
  // it opens again
  await page.reload(); await idle(page);
  await page.evaluate((id) => loadGuide({ id }), g.id);
  await page.waitForFunction((id) => __mstest.curId === id && __mstest.assignData, g.id, { timeout: 10000 });
  assert.deepEqual(errors, []);
});

test('Home’s Continue card follows a Library rename, and leaves its picture alone while Home is hidden', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await saveGuide(page);
  await page.click('#sfColor'); await idle(page);
  for (const i of [0, 1, 2]) await tickInCode(page, i);
  await page.evaluate(() => __mstest.flushSave()); await idle(page);
  await page.click('#mHome'); await idle(page);
  assert.match(await page.textContent('#homeCont .hcname'), /Sample jellyfish/);
  await page.waitForFunction(() => /· next/.test(document.querySelector('#homeCont .hcmeta').textContent));
  await page.evaluate(() => { const g = state.saved.find((s) => s.type === 'guide'); g.name = 'Blue sea'; renderRecent(); });
  assert.equal(await page.textContent('#homeCont .hcname'), 'Blue sea');
  // (the card is drawn again: its next marker comes once its picture is read, later on a slow machine)
  await page.waitForFunction(() => /· next/.test(document.querySelector('#homeCont .hcmeta').textContent));
  assert.equal((await page.textContent('#homeCont .hcmeta')).match(/· next/g).length, 1, 'the next marker said once');
  // back in the guide, a save doesn't redraw Home's card meanwhile
  await page.click('#mSections'); await idle(page);
  const before = await page.evaluate(() => document.getElementById('homeCont').getAttribute('data-ts'));
  await tickInCode(page, 3); await page.evaluate(() => __mstest.flushSave()); await idle(page);
  assert.equal(await page.evaluate(() => document.getElementById('homeCont').getAttribute('data-ts')), before, 'not redrawn while hidden');
  await page.click('#mHome'); await idle(page);
  assert.notEqual(await page.evaluate(() => document.getElementById('homeCont').getAttribute('data-ts')), before, 'redrawn on showing Home');
  assert.match(await page.textContent('#homeCont .hcmeta'), /^4 of \d+ coloured/);
  assert.deepEqual(errors, []);
});

test('the marker sets’ caret stays a line icon as the list opens and closes', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  for (let i = 0; i < 2; i++) {
    await page.evaluate(() => document.getElementById('presetHdr').click());
    const c = await page.evaluate(() => { const e = document.querySelector('.presetcar'); return { svg: !!e.querySelector('svg.ic'), text: e.textContent.trim() }; });
    assert.deepEqual(c, { svg: true, text: '' });
  }
  assert.deepEqual(errors, []);
});

test('on an iPad Home uses the width: the Continue card and the cards side by side, not the phone’s 440px column', async () => {
  for (const [w, h] of [[1194, 834], [834, 1194]]) {
    const { page, errors, ctx } = await openApp({ width: w, height: h });
    await sampleGuide(page); await saveGuide(page);
    await tickInCode(page, 0); await page.evaluate(() => __mstest.flushSave()); await idle(page);
    await page.click('#mHome'); await idle(page);
    const g = await page.evaluate(() => { const r = (s) => document.querySelector(s).getBoundingClientRect(); return { hub: r('.homehub').width, cont: r('#homeCont').width, side: r('.homeside').left, contR: r('#homeCont').right }; });
    assert.ok(g.hub > 700, `${w}×${h}: Home is ${g.hub}px wide`);
    assert.ok(g.cont > 380 && g.side >= g.contR, `${w}×${h}: the Continue card (${g.cont}px) with the cards beside it`);
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});
