// v304 (sections): a tilt followed at once by a Sensitivity change, or by Undo, is no longer lost or allowed to clear
// the Undo steps; Undo of a Sensitivity change puts the slider back; the picture's warning follows Enhance; a Split
// stroke begun on the outline works, one the system takes over cuts nothing, and the line drawn is as wide as the cut;
// a very dense page asks before it's built (more than 3,000 sections), can't be built when a guide couldn't keep it,
// and has its specks saved as part of the lines so it opens again. The warning also follows an Undo of a merge or
// split; the dense page's question never names a size under 3 px on the screen (a phone: "the smallest" instead).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, welcome, sampleGuide, idle, buildGo } from './helpers.mjs';

before(setup);
after(teardown);

// the sample, back in Edit sections with Adjust photo open
async function sampleSections(page) {
  await sampleGuide(page); await idle(page);
  await page.click('#sfBack2'); await idle(page);
  if (!(await page.isVisible('#sfTilt'))) { await page.click('#sfAdjToggle'); await idle(page); }
}
const input = (page, id, v) => page.evaluate(([id, v]) => {
  const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true }));
}, [id, v]);
// a picture drawn in the page (draw: the body of a function of (g, W, H) on a W x H canvas), opened as a photo
async function openPicture(page, W, H, draw) {
  const b64 = await page.evaluate(([W, H, draw]) => {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    new Function('g', 'W', 'H', draw)(g, W, H);
    return c.toDataURL('image/png').split(',')[1];
  }, [W, H, draw]);
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.evaluate(() => SF.pickPhoto())]);
  await fc.setFiles({ name: 'page.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
  // (a picture the page finder isn't sure of: kept as it is)
  const first = await Promise.race([
    page.waitForSelector('#sfBuild', { state: 'visible', timeout: 120000 }).then(() => 'build'),
    page.waitForSelector('#sfPgNo', { state: 'visible', timeout: 120000 }).then(() => 'corners'),
  ]);
  if (first === 'corners') { await page.click('#sfPgNo'); await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 120000 }); }
  await idle(page);
}
const dialog = (page) => page.evaluate(() => {
  const o = document.getElementById('sfEdAsk');
  return o ? { title: o.querySelector('.mtitle').textContent, text: o.querySelector('.dsub').textContent, buttons: [...o.querySelectorAll('[data-a]')].map((b) => b.textContent) } : null;
});
const counted = (page) => page.evaluate(() => __mstest.countedList().length);

test('a tilt with a Sensitivity change straight after: the picture is turned (it was dropped)', async () => {
  const { page, errors } = await openApp({ width: 1180, height: 820 });
  await sampleSections(page);
  const w0 = await page.evaluate(() => __mstest.W);
  await page.evaluate(() => {
    for (const [id, v] of [['sfTilt', '3'], ['sfSens', '7']]) { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }
  });
  await page.waitForTimeout(600); await idle(page);
  assert.notEqual(await page.evaluate(() => __mstest.W), w0, 'the picture was turned');
  assert.equal(await page.inputValue('#sfTilt'), '3');
  assert.deepEqual(errors, []);
});

test('Undo of a Sensitivity change puts the slider back as it was', async () => {
  const { page, errors } = await openApp({ width: 1180, height: 820 });
  await sampleSections(page);
  assert.equal(await page.inputValue('#sfSens'), '5');
  await input(page, 'sfSens', '9');
  await page.waitForTimeout(400); await idle(page);
  await page.click('#sfPlanUndo'); await idle(page);
  assert.equal(await page.inputValue('#sfSens'), '5');
  assert.deepEqual(errors, []);
});

test('Undo straight after a tilt: the tilt waiting is dropped, and the Undo steps before it stay', async () => {
  const { page, errors } = await openApp({ width: 1180, height: 820 });
  await sampleSections(page);
  // (an Undo step first: the sections found again at another Sensitivity)
  await input(page, 'sfSens', '7');
  await page.waitForTimeout(400); await idle(page);
  assert.equal(await page.evaluate(() => __mstest.undoCount), 1);
  const w0 = await page.evaluate(() => __mstest.W);
  await input(page, 'sfTilt', '2');
  await page.evaluate(() => __mstest.doUndoSeg());
  await page.waitForTimeout(500); await idle(page);
  const r = await page.evaluate(() => ({ W: __mstest.W, undo: __mstest.undoCount }));
  assert.equal(r.W, w0, 'the picture as it was');
  assert.equal(r.undo, 1, 'the Sensitivity change can still be undone');
  assert.deepEqual(errors, []);
});

test('the warning about the picture follows Enhance', async () => {
  const { page, errors } = await openApp({ width: 1180, height: 820 });
  await welcome(page, 'look'); await idle(page);
  // a page lit from one side: Enhance copes; without it the dark side reads as ink
  await openPicture(page, 1600, 1200, `const gr = g.createLinearGradient(0, 0, W, 0); gr.addColorStop(0, '#303030'); gr.addColorStop(0.6, '#606060'); gr.addColorStop(0.75, '#f0f0f0'); gr.addColorStop(1, '#f8f8f8'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.strokeStyle = '#000'; g.lineWidth = 6; for (let i = 0; i < 8; i++) { g.beginPath(); g.arc(200 + i * 180, 600, 80, 0, 6.3); g.stroke(); }`);
  if (!(await page.isVisible('#sfEnh'))) { await page.click('#sfAdjToggle'); await idle(page); }
  assert.equal(await page.isVisible('.sfc-segwarn'), false);
  await page.click('#sfEnh'); await page.waitForTimeout(300); await idle(page);
  assert.equal(await page.evaluate(() => __mstest.segWarn.code), 'dark');
  assert.equal(await page.isVisible('.sfc-segwarn'), true, 'shown');
  await page.click('#sfEnh'); await page.waitForTimeout(300); await idle(page);
  assert.equal(await page.isVisible('.sfc-segwarn'), false, 'gone again');
  assert.deepEqual(errors, []);
});

test('the warning about the picture follows an Undo of a merge', async () => {
  const { page, errors } = await openApp({ width: 1180, height: 820 });
  await welcome(page, 'look'); await idle(page);
  // a page in two halves, a thick bar between them
  await openPicture(page, 1600, 1200, `g.fillStyle = '#000'; g.fillRect(780, 0, 40, H);`);
  assert.equal(await page.evaluate(() => __mstest.comps.filter((c) => c && !c.merged).length), 2);
  assert.equal(await page.isVisible('.sfc-segwarn'), false);
  // the two merged: one section is too few, said once the warning is checked again (Min section size let go)
  await page.evaluate(() => {
    const t = __mstest, ls = t.comps.map((c, l) => (c && !c.merged ? l : 0)).filter(Boolean);
    t.mergeCellsSnap(ls[0], ls[1]); t.render();
    document.getElementById('sfMin').dispatchEvent(new Event('change', { bubbles: true }));
  });
  await idle(page);
  assert.equal(await page.evaluate(() => __mstest.segWarn.code), 'few');
  assert.equal(await page.isVisible('.sfc-segwarn'), true, 'shown');
  await page.click('#sfPlanUndo'); await idle(page);
  assert.equal(await page.evaluate(() => __mstest.segWarn.ok), true);
  assert.equal(await page.isVisible('.sfc-segwarn'), false, 'gone with the Undo');
  assert.deepEqual(errors, []);
});

// the biggest section of the sample, and screen points along a row through its middle: from just outside its left
// edge (on the outline) to just past its right one, and from just inside to just inside
async function across(page) {
  return page.evaluate(() => {
    const t = __mstest, W = t.W, H = t.H, L = t.labels, cs = t.comps;
    let best = 0;
    for (let l = 1; l < cs.length; l++) { const c = cs[l]; if (c && !c.merged && !c.bg && (!best || c.area > cs[best].area)) best = l; }
    const y = Math.round(cs[best].cy); let x0 = -1, x1 = -1;
    for (let x = 0; x < W; x++) if (L[y * W + x] === best) { if (x0 < 0) x0 = x; x1 = x; }
    const r = document.getElementById('sfCanvas').getBoundingClientRect(),
      s = (x) => ({ x: r.left + ((x + 0.5) / W) * r.width, y: r.top + ((y + 0.5) / H) * r.height });
    return { onLine: L[y * W + x0 - 4], out: [s(x0 - 4), s(x1 + 4)], in: [s(x0 + 2), s(x1 - 2)] };
  });
}
const drag = async (page, a, b) => { await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps: 20 }); await page.mouse.up(); await idle(page); };
const sections = (page) => page.evaluate(() => __mstest.comps.filter((c) => c && !c.merged).length);

test('Split: a stroke begun on the outline divides the section it runs across', async () => {
  const { page, errors } = await openApp({ width: 1180, height: 820 });
  await sampleSections(page);
  await page.click('#sfEmSplit'); await idle(page);
  const a = await across(page), n0 = await sections(page);
  assert.equal(a.onLine, -1, 'the stroke starts on a line');
  await drag(page, a.out[0], a.out[1]);
  assert.equal(await sections(page), n0 + 1);
  assert.deepEqual(errors, []);
});

test('Split: the line drawn is as wide as the cut, and a stroke the system takes over cuts nothing', async () => {
  const { page, errors } = await openApp({ width: 1180, height: 820 });
  await sampleSections(page);
  await page.click('#sfEmSplit'); await idle(page);
  const a = await across(page), n0 = await sections(page);
  // a stroke right across, cancelled by the system (a palm, a gesture) as it ends
  await page.evaluate(([p, q]) => {
    const cv = document.getElementById('sfCanvas'), ev = (type, pt) => cv.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 7, pointerType: 'pen', isPrimary: true, button: 0, buttons: 1, clientX: pt.x, clientY: pt.y }));
    ev('pointerdown', p);
    for (let i = 1; i <= 10; i++) ev('pointermove', { x: p.x + ((q.x - p.x) * i) / 10, y: p.y });
    ev('pointercancel', q);
  }, a.in);
  await idle(page);
  assert.equal(await sections(page), n0, 'nothing cut');
  // the same stroke let go
  await page.mouse.move(a.in[0].x, a.in[0].y); await page.mouse.down(); await page.mouse.move(a.in[1].x, a.in[1].y, { steps: 10 });
  assert.equal(await page.evaluate(() => document.getElementById('sfCanvas').getContext('2d').lineWidth), 7, 'a cut 3 pixels each way');
  await page.mouse.up(); await idle(page);
  assert.equal(await sections(page), n0 + 1, 'the stroke let go cuts');
  assert.deepEqual(errors, []);
});

// 2400 x 1800: a grid of 300 big boxes, and in one corner a block of 4,800 small 7 x 7 boxes
const MIXED = `g.fillStyle = '#000';
  for (let x = 0; x <= W; x += 120) g.fillRect(Math.min(x, W - 3), 0, 3, H);
  for (let y = 0; y <= H; y += 120) g.fillRect(0, Math.min(y, H - 3), W, 3);
  for (let x = 0; x <= 640; x += 8) g.fillRect(x, 0, 1, 480);
  for (let y = 0; y <= 480; y += 8) g.fillRect(0, y, 640, 1);`;

test('a page of more than 3,000 sections asks first; Leave out the small ones builds it with fewer', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await welcome(page, 'look'); await idle(page);
  await openPicture(page, 2400, 1800, MIXED);
  const n = await counted(page);
  assert.ok(n > 3000, 'sections: ' + n);
  await page.click('#sfBuild');
  await page.waitForSelector('#sfEdAsk');
  const d = await dialog(page);
  assert.equal(d.title, 'This page has ' + n.toLocaleString('en-US') + ' sections.');
  assert.match(d.text, /^About \d+ px each on this screen, so you’d zoom in for every one\. Leaving out (?:the smallest|sections smaller than (?:[3-9]|\d{2,}) px) keeps [\d,]+\.$/);
  assert.deepEqual(d.buttons, ['Leave out the small ones', 'Build all ' + n.toLocaleString('en-US'), 'Cancel']);
  await page.click('#sfEdAsk [data-a="min"]');
  await page.waitForFunction(() => __mstest.assignData && __mstest.sfmode === 'guide', null, { timeout: 120000 }); await idle(page);
  const after = await page.evaluate(() => __mstest.assignData.order.length);
  assert.ok(after <= 3000 && after >= 150, 'built with ' + after);
  assert.deepEqual(errors, []);
});

test('Build all builds them all, and Build again for the same picture doesn’t ask again', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await welcome(page, 'look'); await idle(page);
  await openPicture(page, 2400, 1800, MIXED);
  const n = await counted(page);
  await page.click('#sfBuild');
  await page.waitForSelector('#sfEdAsk');
  await page.click('#sfEdAsk [data-a="all"]');
  await page.waitForFunction(() => __mstest.assignData && __mstest.sfmode === 'guide', null, { timeout: 120000 }); await idle(page);
  assert.equal(await page.evaluate(() => __mstest.assignData.order.length), n);
  await page.click('#sfBack2'); await idle(page);
  await page.evaluate(() => { const t = __mstest, o = t.countedList(); t.mergeCellsSnap(o[0], o[1]); t.render(); });
  await buildGo(page);
  await page.waitForFunction(() => __mstest.sfmode === 'guide', null, { timeout: 120000 }); await idle(page);
  assert.equal(await page.isVisible('#sfEdAsk'), false, 'not asked again');
  assert.deepEqual(errors, []);
});

test('on a phone the dense page’s question says “the smallest”, not a size under 3 px', async () => {
  const { page, errors } = await openApp({ width: 390, height: 844 });
  await welcome(page, 'look'); await idle(page);
  await openPicture(page, 2400, 1800, MIXED);
  // (the size Leave out the small ones would leave out, as wide as it looks on this screen)
  await page.click('#sfBuild');
  await page.waitForSelector('#sfEdAsk');
  const d = await dialog(page), n = await counted(page);
  assert.match(d.text, /^About \d+ px each on this screen, so you’d zoom in for every one\. Leaving out the smallest keeps [\d,]+\.$/);
  assert.doesNotMatch(d.text, /smaller than/);
  assert.deepEqual(d.buttons, ['Leave out the small ones', 'Build all ' + n.toLocaleString('en-US'), 'Cancel']);
  assert.deepEqual(errors, []);
});

// fine cross-hatching over the middle half of a 2400 x 1800 page, every `per` pixels
const hatch = (per) => `const im = g.getImageData(0, 0, W, H), d = im.data;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let v = 240; const j = (y * W + x) * 4;
    if (x === 597 || x === 1803) v = 20; else if (x > 600 && x < 1800 && ((x + y) % ${per} === 0 || (x - y + 9000) % ${per} === 0)) v = 20;
    d[j] = d[j + 1] = d[j + 2] = v; d[j + 3] = 255; }
  g.putImageData(im, 0, 0);
  g.strokeStyle = '#000'; g.lineWidth = 4; g.strokeRect(100, 100, 300, 300); g.strokeRect(1950, 1200, 300, 300);`;

test('a very dense page is saved with its specks as part of the lines, and opens again', async () => {
  const { page, errors } = await openApp({ width: 1180, height: 820 });
  await welcome(page, 'look'); await idle(page);
  await openPicture(page, 2400, 1800, hatch(5));
  const s = await page.evaluate(() => ({ all: __mstest.comps.filter((c) => c && !c.merged).length, n: __mstest.countedList().length }));
  assert.ok(s.all > 150000 && s.n < 3000, JSON.stringify(s));
  await page.click('#sfBuild');
  await page.waitForFunction(() => __mstest.assignData && __mstest.sfmode === 'guide', null, { timeout: 120000 }); await idle(page);
  await page.evaluate(() => __mstest.saveNow()); await page.waitForFunction(() => __mstest.inLibrary, null, { timeout: 60000 }); await idle(page);
  const id = await page.evaluate(() => __mstest.curId), order = await page.evaluate(() => __mstest.assignData.order.slice());
  const r = await page.evaluate(async (id) => {
    const d = await IDB.get('guide-' + id), ck = await SF.checkGuide(d);
    __mstest.openDesignObj(d, id);
    await new Promise((res) => setTimeout(res, 3000));
    return { ck, W: __mstest.W, all: __mstest.comps.filter((c) => c && !c.merged).length, order: __mstest.assignData.order.slice() };
  }, id);
  assert.equal(r.ck.ok, true, 'a guide that can be opened');
  assert.equal(r.W, 2400);
  assert.equal(r.all, 90000);
  assert.deepEqual(r.order.sort(), order.sort(), 'its sections, as they were');
  assert.deepEqual(errors, []);
});

test('a page with more sections than a guide can keep is not built until Min section size is raised', async () => {
  const { page, errors } = await openApp({ width: 1180, height: 820 });
  await welcome(page, 'look'); await idle(page);
  await openPicture(page, 2400, 1800, hatch(6));
  const m0 = await page.inputValue('#sfMin');
  await page.click('#sfBuild');
  await page.waitForSelector('#sfEdAsk');
  const d = await dialog(page);
  assert.match(d.title, /^This page has [\d,]+ sections\.$/);
  assert.match(d.text, /^That’s more than a guide can keep\. Leaving out (?:the smallest|sections smaller than (?:[3-9]|\d{2,}) px) keeps [\d,]+\. Tiny specks are joined to the lines when it’s saved\.$/);
  assert.deepEqual(d.buttons, ['Raise Min section size', 'Cancel']);
  await page.click('#sfEdAsk [data-a="min"]'); await idle(page);
  assert.equal(await page.evaluate(() => !!__mstest.assignData), false, 'not built');
  assert.ok(+(await page.inputValue('#sfMin')) > +m0, 'Min section size raised');
  await page.click('#sfBuild');
  await page.waitForFunction(() => __mstest.assignData && __mstest.sfmode === 'guide', null, { timeout: 120000 });
  assert.ok((await page.evaluate(() => __mstest.assignData.order.length)) <= 3000);
  assert.deepEqual(errors, []);
});
