// Colour from a photo: sections take the photo's colour under them (matched to owned markers), the photo can be
// lined up by dragging or by itself, pins survive, "Markers in this guide" caps how many markers are used, and the
// photo and its placement are saved with the guide (also when it loads late, or the guide switched pattern).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, welcome, idle, scrollTop, sampleGuide, notOnWebKit, WK } from './helpers.mjs';

before(setup);
after(teardown);

// a photo: blue top half, red bottom half
const twoTone = (page) => page.evaluate(async () => {
  const c = document.createElement('canvas'); c.width = 600; c.height = 800; const g = c.getContext('2d');
  g.fillStyle = '#2350c8'; g.fillRect(0, 0, 600, 400); g.fillStyle = '#d0282c'; g.fillRect(0, 400, 600, 400);
  const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
  return await new Promise((r) => { const f = new FileReader(); f.onload = () => r(f.result.split(',')[1]); f.readAsDataURL(blob); });
});

async function photoGuide(page) {
  // a big collection (Honolulu 320) so there are clear blues and reds to match
  await page.check('#wcSets input[data-i="6"]'); await page.click('#wcAdd'); await page.click('#wcSample');
  await page.waitForFunction(() => !!(window.__mstest && __mstest.assignData));
  const b64 = await twoTone(page);
  await page.click('.sftabbtn[data-t="pattern"]');
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#sfFam [data-v="photo"]')]);
  await fc.setFiles({ name: 'ref.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
  await page.waitForFunction(() => !!__mstest.photoRef); await idle(page);
}

// share of sections lying clearly above / below the photo's split that got a blue / red marker
const sides = (page) => page.evaluate(() => {
  const t = __mstest, X = t.photoXf, split = X.cy, a = t.assignData.assign, comps = t.comps;
  let ok = 0, n = 0;
  for (const k in a) {
    const c = comps[k], m = a[k], lab = m.lab; if (!c || !lab) continue;
    const top = c.y1 < split - 4, bottom = c.y0 > split + 4; if (!top && !bottom) continue;
    n++; const blue = lab[2] < -15, red = lab[1] > 30 && lab[2] > 0;
    if ((top && blue) || (bottom && red)) ok++;
  }
  return { ok, n };
});

test('sections take the photo colour under them, matched to your markers', notOnWebKit(WK.photo), async () => {
  const { page, errors } = await openApp();
  await photoGuide(page);
  const s = await sides(page);
  assert.ok(s.n > 40, `enough sections on either side (${s.n})`);
  assert.ok(s.ok / s.n > 0.95, `${s.ok}/${s.n} sections match the photo above/below the split`);
  const r = await page.evaluate(() => ({ fam: __mstest.family, N: __mstest.limitN, used: new Set(Object.values(__mstest.assignData.assign).map((m) => m.mkey)).size, owned: Object.values(__mstest.assignData.assign).every((m) => state.owned.has(m.mkey)) }));
  assert.equal(r.fam, 'photo');
  assert.equal(r.N, 24, 'photo starts with more markers (24)');
  assert.ok(r.used <= r.N, 'never more markers than asked for');
  assert.ok(r.owned, 'only markers you own');
  assert.ok(await page.isVisible('.sfphov'), 'the see-through photo shows while lining up');
  assert.deepEqual(errors, []);
});

test('dragging the photo moves where the colours land; pins stay', notOnWebKit(WK.photo), async () => {
  const { page, errors } = await openApp();
  await photoGuide(page);
  // pin one section at the very top
  const pin = await page.evaluate(() => { const t = __mstest, o = t.assignData.order, l = o[0], m = t.assignData.assign[l]; t.locks[l] = m.mkey; return { l, key: m.mkey }; });
  const cy0 = await page.evaluate(() => __mstest.photoXf.cy);
  await scrollTop(page);
  const c = await page.locator('#sfCanvas').boundingBox();
  await page.mouse.move(c.x + c.width / 2, c.y + c.height * 0.3);
  await page.mouse.down(); await page.mouse.move(c.x + c.width / 2, c.y + c.height * 0.6, { steps: 6 }); await page.mouse.up();
  await idle(page);
  const cy1 = await page.evaluate(() => __mstest.photoXf.cy);
  assert.ok(cy1 > cy0 + 50, `photo moved down (${cy0.toFixed(0)} -> ${cy1.toFixed(0)})`);
  const s = await sides(page);
  assert.ok(s.ok / s.n > 0.95, `colours follow the moved photo: ${s.ok}/${s.n}`);
  assert.equal(await page.evaluate((l) => __mstest.assignData.assign[l].mkey, pin.l), pin.key, 'pinned section kept its marker');
  // Fit / Fill / Stretch re-place it
  await page.click('#sfPhFit [data-v="stretch"]'); await idle(page);
  const st = await page.evaluate(() => __mstest.photoXf);
  assert.ok(Math.abs(st.sx - st.sy) > 0.01, 'stretch scales width and height separately');
  assert.deepEqual(errors, []);
});

test('lining up on a wide screen: the photo is grabbed beside the drawing too; colours come after; leaving the Pattern tab finishes lining up', notOnWebKit(WK.photo), async () => {
  const { page, errors } = await openApp({ width: 1024, height: 768 });
  await photoGuide(page);
  await scrollTop(page);
  assert.equal(await page.evaluate(() => __mstest.photoAlign), true, 'lining up after choosing the photo');
  // a point in the picture's area but beside the drawing (with Fill the photo shows there)
  const p = await page.evaluate(() => {
    const c = document.getElementById('sfCanvas').getBoundingClientRect(), v = document.getElementById('sfView').getBoundingClientRect();
    const x = c.left - v.left > 40 ? (v.left + c.left) / 2 : v.right - c.right > 40 ? (c.right + v.right) / 2 : null;
    return x == null ? null : { x, y: c.top + c.height * 0.3, h: c.height };
  });
  assert.ok(p, 'the drawing is narrower than the picture area at 1024 × 768');
  // (the photo is blue above red: moved down, the sections just under the old split turn blue)
  const keys = () => page.evaluate(() => Object.values(__mstest.assignData.assign).map((m) => m.mkey).join());
  const y0 = await page.evaluate(() => __mstest.photoXf.cy), before = await keys();
  await page.mouse.move(p.x, p.y); await page.mouse.down(); await page.mouse.move(p.x, p.y + p.h * 0.25, { steps: 6 }); await page.mouse.up();
  await idle(page);
  assert.ok((await page.evaluate(() => __mstest.photoXf.cy)) > y0 + 20, 'the photo moved');
  assert.notEqual(await keys(), before, 'and the colours followed');
  assert.ok((await sides(page)).ok / (await sides(page)).n > 0.95, 'matching the moved photo');
  // one Undo step for the move (the quick colours straight after letting go aren't a step of their own)
  await page.click('#sfPlanUndo'); await idle(page);
  assert.equal(await page.evaluate(() => __mstest.photoXf.cy), y0, 'Undo puts the photo back');
  // another tab finishes lining up: no see-through photo, and a drag on the picture scrolls the page again
  await page.click('.sftabbtn[data-t="colours"]'); await idle(page);
  assert.equal(await page.evaluate(() => __mstest.photoAlign), false);
  assert.equal(await page.isVisible('.sfphov'), false);
  assert.equal(await page.evaluate(() => document.getElementById('sfPicBox').style.touchAction), 'pan-y');
  await page.click('.sftabbtn[data-t="pattern"]'); await idle(page);
  assert.equal(await page.evaluate(() => __mstest.photoAlign), false, 'coming back doesn’t start lining up again');
  assert.deepEqual(errors, []);
});

test('marker count caps the markers; the photo and its placement are saved and reopen', notOnWebKit(WK.photo), async () => {
  const { page, errors } = await openApp();
  await photoGuide(page);
  await page.evaluate(() => { __mstest.limitN = 2; __mstest.photoRecolour(); });
  const used2 = await page.evaluate(() => new Set(Object.values(__mstest.assignData.assign).map((m) => m.mkey)).size);
  assert.ok(used2 <= 2, `2 markers asked, ${used2} used`);
  assert.ok((await sides(page)).ok / (await sides(page)).n > 0.95, 'even with 2 markers: one blue, one red');
  await page.evaluate(() => { __mstest.limitN = 24; __mstest.photoRecolour(); });
  await page.click('#sfPhAlign'); // done lining up
  await page.click('#sfSave'); await idle(page);
  const before = await page.evaluate(() => ({ xf: __mstest.photoXf, keys: JSON.stringify(Object.entries(__mstest.assignData.assign).map(([l, m]) => m.mkey)) }));
  const id = await page.evaluate(() => state.saved.find((s) => s.type === 'guide').id);
  // open something else, then the saved guide again
  await page.evaluate(() => SF.loadSample()); await idle(page, 1200);
  assert.equal(await page.evaluate(() => __mstest.photoRef), null, 'a new picture starts without the photo');
  await page.evaluate((id) => SF.openDesign(id), id); await idle(page, 1500);
  await page.waitForFunction(() => !!__mstest.photoRef, null, { timeout: 5000 });
  const after = await page.evaluate(() => ({ fam: __mstest.family, xf: __mstest.photoXf, keys: JSON.stringify(Object.entries(__mstest.assignData.assign).map(([l, m]) => m.mkey)) }));
  assert.equal(after.fam, 'photo');
  assert.deepEqual(after.xf, before.xf);
  assert.equal(after.keys, before.keys, 'same colours after reopening');
  // re-colouring after reopening still comes from the photo
  await page.evaluate(() => { __mstest.limitN = 2; __mstest.photoRecolour(); });
  assert.ok((await sides(page)).ok / (await sides(page)).n > 0.95);
  assert.deepEqual(errors, []);
});

test('the marker choice covers the photo best, not just the closest one by one', notOnWebKit(WK.photo), async () => {
  const { page, errors } = await openApp();
  await welcome(page, 'look');
  const r = await page.evaluate(() => {
    const mk = (k, lab) => ({ mkey: k, lab });
    const pool = [mk('A', [50, 60, 40]), mk('A2', [52, 58, 42]), mk('B', [40, 10, -60]), mk('C', [85, -5, 70]), mk('far', [10, 0, 0])];
    const t = [];
    for (let i = 0; i < 10; i++) t.push({ l: i, lab: [51, 59, 41], w: 1 }); // lots of red
    for (let i = 10; i < 14; i++) t.push({ l: i, lab: [40, 10, -60], w: 1 }); // some blue
    for (let i = 14; i < 16; i++) t.push({ l: i, lab: [85, -5, 70], w: 1 }); // a little yellow
    const out = __mstest.photoPick(t, pool, 3);
    return { chosen: out.chosen.map((m) => m.mkey).sort(), pick: out.pick.map((m) => m.mkey) };
  });
  assert.equal(r.chosen.length, 3);
  assert.ok(r.chosen.includes('B') && r.chosen.includes('C'), 'blue and yellow each get a marker: ' + r.chosen);
  assert.ok(r.chosen.includes('A') || r.chosen.includes('A2'), 'and one red, not two near-identical reds');
  assert.equal(r.pick[12], 'B'); assert.equal(r.pick[15], 'C');
  assert.deepEqual(errors, []);
});

// phase 2 ---------------------------------------------------------------
const photoOf = (page, draw) => page.evaluate(async (draw) => {
  const c = document.createElement('canvas'); c.width = 600; c.height = 800; const g = c.getContext('2d');
  new Function('g', draw)(g);
  const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
  return await new Promise((r) => { const f = new FileReader(); f.onload = () => r(f.result.split(',')[1]); f.readAsDataURL(blob); });
}, draw);
async function guideWithPhoto(page, setIndex, draw) {
  await page.check(`#wcSets input[data-i="${setIndex}"]`); await page.click('#wcAdd'); await page.click('#wcSample');
  await page.waitForFunction(() => !!(window.__mstest && __mstest.assignData));
  const b64 = await photoOf(page, draw);
  await page.click('.sftabbtn[data-t="pattern"]');
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#sfFam [data-v="photo"]')]);
  await fc.setFiles({ name: 'ref.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
  await page.waitForFunction(() => !!__mstest.photoRef); await idle(page);
}

test('white areas of the photo are left white (and can be coloured instead)', notOnWebKit(WK.photo), async () => {
  const { page, errors } = await openApp();
  await guideWithPhoto(page, 6, "g.fillStyle='#fdfdfb';g.fillRect(0,0,600,400);g.fillStyle='#d0282c';g.fillRect(0,400,600,400);");
  const r = await page.evaluate(() => {
    const t = __mstest, a = t.assignData, split = t.photoXf.cy, paper = Object.keys(a.paper || {}).map(Number);
    const top = paper.filter((l) => t.comps[l].y1 < split).length, wrong = paper.filter((l) => t.comps[l].y0 > split + 4).length;
    const inOrder = a.order.some((l) => a.paper && a.paper[l]);
    return { paper: paper.length, top, wrong, inOrder, N: a.N, assigned: Object.keys(a.assign).length };
  });
  assert.ok(r.paper > 15 && r.top >= r.paper * 0.9 && r.wrong === 0, 'white only where the photo is white: ' + JSON.stringify(r));
  assert.equal(r.inOrder, false, 'white sections are not in the colouring order');
  assert.equal(r.N, r.assigned, 'the section count leaves them out');
  // a white section is painted paper and has no label; tapping it says to leave it white
  const px = await page.evaluate(() => { const t = __mstest, l = +Object.keys(t.assignData.paper)[0], p = t.labelPos(l), c = document.getElementById('sfCanvas'); const d = c.getContext('2d').getImageData(Math.floor(p.x), Math.floor(p.y), 1, 1).data; return [d[0], d[1], d[2]]; });
  assert.ok(px.every((v) => v > 225), 'white section drawn as paper: ' + px);
  // save and reopen keeps them white
  await page.click('#sfPhAlign'); await page.click('#sfSave'); await idle(page);
  const id = await page.evaluate(() => state.saved.find((s) => s.type === 'guide').id);
  await page.evaluate(() => SF.loadSample()); await idle(page, 1200);
  await page.evaluate((id) => SF.openDesign(id), id); await idle(page, 1500);
  assert.equal(await page.evaluate(() => Object.keys(__mstest.assignData.paper || {}).length), r.paper, 'still white after reopening');
  // switch it off: they get markers
  await page.waitForFunction(() => !!__mstest.photoRef);
  await page.click('.sftabbtn[data-t="pattern"]').catch(() => {});
  await page.evaluate(() => { document.getElementById('sfPhPaper').click(); });
  await idle(page);
  const off = await page.evaluate(() => ({ paper: __mstest.assignData.paper, n: __mstest.assignData.N }));
  assert.equal(off.paper, null); assert.equal(off.n, r.N + r.paper);
  assert.deepEqual(errors, []);
});

// a phone photo of a page in warm lamplight: the paper reads as a warm grey (about L* 70), everything else shifted the
// same way; top half paper, bottom left a red, bottom right a pale yellow (pale once the lighting is corrected); the
// camera noise is seeded, so every run photographs the same page (unseeded, a section on the edge of "white" could
// fall either side after the photo was saved as a JPEG and reopened)
const warmPage = "const px=(r,g,b,x,y,w,h)=>{g0.fillStyle='rgb('+r+','+g+','+b+')';g0.fillRect(x,y,w,h);};const g0=g;px(182,170,152,0,0,600,800);px(128,42,36,0,400,300,400);px(186,172,98,300,400,300,400);const d=g.getImageData(0,0,600,800);let sd=12345;const rnd=()=>(sd=(sd*16807)%2147483647)/2147483647;for(let i=0;i<d.data.length;i+=4){const n=(rnd()-0.5)*10;d.data[i]+=n;d.data[i+1]+=n;d.data[i+2]+=n;}g.putImageData(d,0,0);";
test('a photo of a page in dim, warm light is corrected from its paper; it can be switched off, undone and is saved; a sunset is left alone', notOnWebKit(WK.photo), async () => {
  const { page, errors } = await openApp();
  await guideWithPhoto(page, 6, warmPage);
  const lit = () => page.evaluate(() => { const r = __mstest.photoRef; return r.lit && { on: r.lit.on, from: r.lit.from, gain: r.lit.fix.gain.map((g) => +g.toFixed(4)), changed: r.data !== r.raw }; });
  const whites = () => page.evaluate(() => { const t = __mstest, a = t.assignData, split = t.photoXf.cy, w = Object.keys(a.paper || {}).map(Number);
    return { n: w.length, below: w.filter((l) => t.comps[l].y0 > split + 4).length }; });
  const l1 = await lit();
  assert.deepEqual([l1.on, l1.from, l1.changed], [true, 'page', true], 'corrected: ' + JSON.stringify(l1));
  assert.ok(l1.gain[2] > l1.gain[0] * 1.2, 'the warm cast is taken out (more blue gain than red): ' + l1.gain);
  // the photo as shown (thumbnail, and over the picture while lining up) is the corrected one
  assert.notEqual(await page.getAttribute('.sfphthumb', 'src'), await page.evaluate(() => __mstest.photoRef.url));
  assert.equal(await page.getAttribute('.sfphthumb', 'src'), await page.getAttribute('.sfphov', 'src'));
  assert.match(await page.textContent('.sfphtx'), /Lighting corrected from the paper/);
  assert.equal(await page.isChecked('#sfPhLight'), true);
  // the paper reads as white now, the pale yellow and the red stay coloured
  const on = await whites();
  assert.ok(on.n > 15 && on.below === 0, 'the paper is left white, nothing else: ' + JSON.stringify(on));
  const yellow = await page.evaluate(() => { const t = __mstest, C = t.photoColours(), X = t.photoXf, a = t.assignData, out = [];
    for (const k in a.assign) { const c = t.comps[k]; if (c.y0 > X.cy + 4 && c.x0 > X.cx + 4) out.push([C.lab[k * 3], C.lab[k * 3 + 1], C.lab[k * 3 + 2]]); } return out; });
  assert.ok(yellow.length > 3 && yellow.every((c) => c[0] > 85 && c[2] > 20), 'pale yellow, coloured: ' + JSON.stringify(yellow.slice(0, 3)));
  // switched off: the photo as it was taken, its grey paper coloured like before; Undo switches it back on
  await page.click('#sfPhLight'); await idle(page);
  assert.equal((await lit()).on, false);
  assert.equal((await lit()).changed, false);
  assert.equal((await whites()).n, 0, 'grey paper is not white');
  assert.doesNotMatch(await page.textContent('.sfphtx'), /Lighting corrected/);
  assert.equal(await page.getAttribute('.sfphthumb', 'src'), await page.evaluate(() => __mstest.photoRef.url));
  assert.match(await page.getAttribute('#sfPlanUndo', 'aria-label'), /Lighting correction off/);
  await page.click('#sfPlanUndo'); await idle(page);
  assert.equal((await lit()).on, true);
  assert.deepEqual(await whites(), on);
  // saved with the guide, as it is, and read the same when reopened (off too)
  await page.click('#sfPhLight'); await idle(page);
  await page.click('#sfPhAlign'); await page.click('#sfSave'); await idle(page);
  const id = await page.evaluate(() => state.saved.find((s) => s.type === 'guide').id);
  await page.evaluate(() => SF.loadSample()); await idle(page, 1200);
  await page.evaluate((id) => SF.openDesign(id), id); await idle(page, 1500);
  await page.waitForFunction(() => !!__mstest.photoRef); await idle(page);
  assert.deepEqual(await lit(), { ...l1, on: false, changed: false });
  await page.click('.sftabbtn[data-t="pattern"]').catch(() => {});
  await page.click('#sfPhLight'); await idle(page);
  assert.deepEqual(await lit(), l1);
  assert.deepEqual(await whites(), on);
  // a sunset's warm light is the picture: not corrected, and nothing to switch
  const b64 = await photoOf(page, "const gr=g.createLinearGradient(0,0,600,800);gr.addColorStop(0,'#1d3b8a');gr.addColorStop(0.6,'#f2a33a');gr.addColorStop(1,'#c9562a');g.fillStyle=gr;g.fillRect(0,0,600,800);g.fillStyle='#fff4c9';g.beginPath();g.arc(420,520,90,0,6.3);g.fill();");
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#sfPhPick')]);
  await fc.setFiles({ name: 'sunset.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
  await page.waitForFunction(() => __mstest.photoRef && !__mstest.photoRef.lit && !__mstest.photoChecking); await idle(page);
  assert.equal(await page.evaluate(() => __mstest.photoRef.data === __mstest.photoRef.raw), true);
  assert.equal(await page.$('#sfPhLight'), null);
  assert.deepEqual(errors, []);
});

test('rough matches are counted, can be shown, and markers you could buy are suggested', notOnWebKit(WK.photo), async () => {
  const { page, errors } = await openApp();
  // Honolulu 24 and a photo in colours it can't match well
  await guideWithPhoto(page, 1, "const gr=g.createLinearGradient(0,0,600,800);gr.addColorStop(0,'#0bd6c8');gr.addColorStop(0.5,'#8a2be2');gr.addColorStop(1,'#39ff14');g.fillStyle=gr;g.fillRect(0,0,600,800);");
  const txt = await page.textContent('.sfphstat');
  assert.match(txt, /\d+%.*close match/);
  assert.match(txt, /rough or loose match/);
  const want = await page.evaluate(() => [...document.querySelectorAll('.sfphwant span')].map((s) => s.textContent.trim()));
  assert.ok(want.length >= 1, 'suggests markers');
  const owned = await page.evaluate((codes) => codes.filter((c) => [...state.owned].some((k) => k.endsWith('|' + c.split(' ').pop()))), want);
  assert.deepEqual(owned, [], 'only markers you don’t own are suggested');
  // "show rough matches" fades the close ones
  await page.click('#sfPhAlign'); await idle(page);
  const before = await page.evaluate(() => { const c = document.getElementById('sfCanvas'); return c.getContext('2d').getImageData(0, 0, c.width, c.height).data.reduce((a, v) => a + v, 0); });
  await page.check('#sfPhRough'); await idle(page);
  const after = await page.evaluate(() => { const c = document.getElementById('sfCanvas'); return c.getContext('2d').getImageData(0, 0, c.width, c.height).data.reduce((a, v) => a + v, 0); });
  assert.ok(after > before, 'close matches are faded (lighter picture)');
  assert.deepEqual(errors, []);
});

test('the Photo button under the picture compares; Photo sits before Manual', notOnWebKit(WK.photo), async () => {
  const { page, errors } = await openApp();
  await photoGuide(page);
  const order = await page.evaluate(() => [...document.querySelectorAll('#sfFam button')].map((b) => b.dataset.v));
  assert.deepEqual(order, ['gradient', 'random', 'blend', 'photo', 'manual']);
  await page.click('#sfPhAlign'); await idle(page);
  assert.ok(!(await page.isVisible('.sfphov')), 'photo hidden after lining up');
  assert.ok(await page.isVisible('#sfZoomCtl #sfPhPeek'), '◐ in the tool row');
  await page.click('#sfPhPeek'); await idle(page);
  assert.equal(await page.getAttribute('#sfPhPeek', 'aria-pressed'), 'true');
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.sfphov')).opacity), '1', 'photo shown on top, not see-through');
  await page.click('#sfPhPeek'); await idle(page);
  assert.ok(!(await page.isVisible('.sfphov')));
  await page.click('#sfFam [data-v="gradient"]'); await idle(page);
  assert.ok(!(await page.isVisible('#sfPhPeek')), 'no Photo button for other patterns');
  assert.deepEqual(errors, []);
});

// automatic lining up ------------------------------------------------------
// the sections big enough to read in these "photos" of the guide, shrunk to 0.7 and through JPEG: 137 px and up (the
// smallest section before v277; the jellyfish's 23 smaller ones are a few pixels across by then, mostly line)
const READABLE = 137;
test('a coloured version of the page lines itself up (turned, shrunk, off-centre); an unrelated photo does not', notOnWebKit(WK.photo), async () => {
  const { page, errors } = await openApp();
  await page.check('#wcSets input[data-i="6"]'); await page.click('#wcAdd'); await page.click('#wcSample');
  await page.waitForFunction(() => !!(window.__mstest && __mstest.assignData));
  await page.click('#sfCodes'); // marker codes off (tool row)
  assert.equal(await page.getAttribute('#sfCodes', 'aria-pressed'), 'false');
  // "photograph" the coloured guide: smaller, turned 3 degrees, off-centre on a bigger sheet, with noise
  const made = await page.evaluate(async () => {
    const t = __mstest; t.forceFullRender(); t.renderGuide(); const g = document.getElementById('sfCanvas');
    const before = {}; for (const l in t.assignData.assign) before[l] = t.assignData.assign[l].mkey;
    const pw = 1400, ph = 1500, k = 0.7, th = 0.05, ox = 200, oy = 60, c = document.createElement('canvas'); c.width = pw; c.height = ph; const x = c.getContext('2d');
    x.fillStyle = '#ece6da'; x.fillRect(0, 0, pw, ph); x.translate(ox, oy); x.rotate(th); x.scale(k, k); x.drawImage(g, 0, 0); x.setTransform(1, 0, 0, 1, 0, 0);
    const id = x.getImageData(0, 0, pw, ph); for (let i = 0; i < id.data.length; i += 4) { const n = (Math.random() - 0.5) * 16; id.data[i] += n; id.data[i + 1] += n; id.data[i + 2] += n; } x.putImageData(id, 0, 0);
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9));
    const b64 = await new Promise((r) => { const f = new FileReader(); f.onload = () => r(f.result.split(',')[1]); f.readAsDataURL(blob); });
    return { b64, before, th };
  });
  await page.click('.sftabbtn[data-t="pattern"]');
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#sfFam [data-v="photo"]')]);
  await fc.setFiles({ name: 'coloured.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(made.b64, 'base64') });
  await page.waitForFunction(() => !!__mstest.photoRef);
  await page.waitForFunction(() => Math.abs(__mstest.photoXf.r) > 0.01, null, { timeout: 15000 });
  await idle(page);
  // each section's new marker should be the original or a near twin (the "photo" went through JPEG, noise and texture):
  // not clearly different, CIEDE2000 under 10 (a smooth gradient's neighbouring markers are near twins)
  const r = await page.evaluate(([before, READABLE]) => { const t = __mstest, a = t.assignData.assign, lab = {}; state.owned.forEach(() => {}); const byKey = {}; Object.values(a).forEach((m) => { byKey[m.mkey] = m; });
    const labOf = (k) => { const i = COLORS.findIndex((c) => c.brand + '|' + c.code === k); return i >= 0 ? LAB[i] : null; };
    let same = 0, n = 0; for (const l in before) { if (!a[l] || t.comps[l].area < READABLE) continue; n++; const p = labOf(before[l]), q = a[l].lab; if (p && q && de2000(p, q) < 10) same++; } return { same, n, xf: t.photoXf }; }, [made.before, READABLE]);
  assert.ok(Math.abs(r.xf.r + made.th) < 0.02, 'found the turn: ' + r.xf.r);
  assert.equal(r.n, 143, 'the sections big enough to read');
  assert.ok(r.same / r.n > 0.9, `${r.same}/${r.n} sections got their original colour back`);
  assert.match(await page.textContent('#msToast'), /Lined the photo up/);
  // lined up, the page's uncoloured parts say where its paper is: here already white (the sheet around it was
  // darker, which made the whole photo look like it needed correcting), so the photo is used as it is
  assert.equal(await page.evaluate(() => __mstest.photoRef.lit), null);
  // an unrelated photo stays where Fill put it
  const b64 = await page.evaluate(async () => { const c = document.createElement('canvas'); c.width = 600; c.height = 800; const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 600, 800); gr.addColorStop(0, '#1d3b8a'); gr.addColorStop(1, '#f2a33a'); g.fillStyle = gr; g.fillRect(0, 0, 600, 800); g.fillStyle = '#fff4c9'; g.beginPath(); g.arc(420, 520, 90, 0, 6.3); g.fill(); const blob = await new Promise((r) => c.toBlob(r, 'image/png')); return await new Promise((r) => { const f = new FileReader(); f.onload = () => r(f.result.split(',')[1]); f.readAsDataURL(blob); }); });
  const [fc2] = await Promise.all([page.waitForEvent('filechooser'), page.click('#sfPhPick')]);
  await fc2.setFiles({ name: 'sunset.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
  await page.waitForFunction(() => __mstest.photoRef && __mstest.photoRef.w === 600); await idle(page, 1500);
  assert.equal(await page.evaluate(() => __mstest.photoXf.r), 0, 'not moved');
  // the button says so when it can't match
  await page.click('#sfPhAuto'); await idle(page, 1500);
  assert.match(await page.textContent('#msToast'), /Couldn.t match this photo/);
  assert.deepEqual(errors, []);
});

test('a coloured version of the page photographed in warm, dim light lines up and is corrected from its own paper', notOnWebKit(WK.photo), async () => {
  const { page, errors } = await openApp();
  await page.check('#wcSets input[data-i="6"]'); await page.click('#wcAdd'); await page.click('#wcSample');
  await page.waitForFunction(() => !!(window.__mstest && __mstest.assignData));
  await page.click('#sfCodes');
  // the coloured guide on a sheet, then the whole "photo" darkened and warmed (in linear light, like a lamp would)
  const made = await page.evaluate(async () => {
    const t = __mstest; t.forceFullRender(); t.renderGuide(); const g = document.getElementById('sfCanvas');
    const before = {}; for (const l in t.assignData.assign) before[l] = t.assignData.assign[l].mkey;
    const pw = 1300, ph = 1500, c = document.createElement('canvas'); c.width = pw; c.height = ph; const x = c.getContext('2d');
    x.fillStyle = '#f7f4ee'; x.fillRect(0, 0, pw, ph); x.translate(120, 80); x.scale(0.75, 0.75); x.drawImage(g, 0, 0); x.setTransform(1, 0, 0, 1, 0, 0);
    const id = x.getImageData(0, 0, pw, ph), k = [0.55, 0.47, 0.38];
    for (let i = 0; i < id.data.length; i += 4) { const n = (Math.random() - 0.5) * 6; for (let j = 0; j < 3; j++) id.data[i + j] = linToSrgb(srgbToLin(id.data[i + j]) * k[j]) + n; }
    x.putImageData(id, 0, 0);
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9));
    return { b64: await new Promise((r) => { const f = new FileReader(); f.onload = () => r(f.result.split(',')[1]); f.readAsDataURL(blob); }), before };
  });
  await page.click('.sftabbtn[data-t="pattern"]');
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#sfFam [data-v="photo"]')]);
  await fc.setFiles({ name: 'lamp.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(made.b64, 'base64') });
  await page.waitForFunction(() => !!__mstest.photoRef && !__mstest.photoChecking, null, { timeout: 15000 }); await idle(page);
  assert.match(await page.textContent('#msToast'), /Lined the photo up/);
  const same = () => page.evaluate(([before, READABLE]) => { const a = __mstest.assignData.assign, labOf = (k) => LAB[COLORS.findIndex((c) => c.brand + '|' + c.code === k)];
    let s = 0, n = 0; for (const l in before) { if (!a[l] || __mstest.comps[l].area < READABLE) continue; n++; if (de2000(labOf(before[l]), a[l].lab) < 10) s++; } return s / n; }, [made.before, READABLE]);
  const lit = await page.evaluate(() => { const l = __mstest.photoRef.lit; return l && { from: l.from, on: l.on, gain: l.fix.gain }; });
  assert.deepEqual([lit.from, lit.on], ['lined', true], JSON.stringify(lit));
  // the gains undo the lamp (1/0.55, 1/0.47, 1/0.38 times paper white over the sheet's), within a few per cent
  const want = [0.55, 0.47, 0.38].map((k, j) => 0.88 / (k * [0.93, 0.905, 0.855][j]));
  assert.ok(lit.gain.every((g, j) => Math.abs(g / want[j] - 1) < 0.06), `gains ${lit.gain} vs ${want}`);
  const on = await same();
  await page.click('#sfPhLight'); await idle(page);
  const off = await same();
  assert.ok(on > 0.85 && on > off + 0.2, `sections back to their own colour: corrected ${on}, as taken ${off}`);
  assert.deepEqual(errors, []);
});

// ---- From the second full review ----
test('automatic lining-up turns away stripes and very sparse drawings', notOnWebKit(WK.photo), async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  const r = await page.evaluate(async () => {
    const t = __mstest, mk = async (draw) => { const c = document.createElement('canvas'); c.width = 900; c.height = 1100; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 900, 1100); g.fillStyle = '#222'; draw(g); const img = new Image(); await new Promise((r) => { img.onload = r; img.src = c.toDataURL('image/png'); }); return t.photoFromImage(img); };
    const out = {};
    t.setPhotoRef(await mk((g) => { for (let y = 0; y < 1100; y += 24) g.fillRect(0, y, 900, 8); }), true); out.stripes = t.photoTryAutoAlign(true);
    t.setPhotoRef(await mk((g) => { for (let y = 0; y < 1100; y += 40) for (let x = (y / 40 % 2) * 40; x < 900; x += 80) g.fillRect(x, y, 40, 40); }), true); out.checker = t.photoTryAutoAlign(true);
    return out;
  });
  assert.deepEqual(r, { stripes: false, checker: false });
  assert.deepEqual(errors, []);
});

// ---- From the fourth review (data safety) ----
// Save (a new guide into the Library), done once the header says so
const saveNew = async (page) => { await page.click('#sfSave'); await page.waitForFunction(() => /Saved in your Library/.test(document.getElementById('sfSaveSt').textContent)); };

const AUTO = 2300; // idle(page, AUTO): until auto-save (1.5 s after the last change) has run
const savedId = (page) => page.evaluate(() => state.saved.find((s) => s.type === 'guide').id);
const stored = (page, id) => page.evaluate((id) => IDB.get('guide-' + id).then((p) => p && { prog: (p.prog || []).length, assign: p.assign, tones: p.tones || {}, ref: p.ref || null, base: p.base || null, style: p.style }), id);
const tab = (page, t) => page.click(`.sftabbtn[data-t="${t}"]`);
// reopen a Library guide the way the Library does
const openSaved = async (page, id) => { await page.evaluate((id) => loadGuide({ id }), id); await page.waitForFunction((id) => __mstest.curId === id && __mstest.assignData, id, { timeout: 10000 }); await idle(page); };

test('a guide that switched away from Photo keeps its photo when reopened (a shared file leaves it out)', notOnWebKit(WK.photo), async () => {
  const { page, errors } = await openApp();
  await page.check('#wcSets input[data-i="6"]'); await page.click('#wcAdd'); await page.click('#wcSample');
  await page.waitForFunction(() => !!(window.__mstest && __mstest.assignData));
  const b64 = await page.evaluate(async () => { const c = document.createElement('canvas'); c.width = 600; c.height = 800; const g = c.getContext('2d'); g.fillStyle = '#2350c8'; g.fillRect(0, 0, 600, 400); g.fillStyle = '#d0282c'; g.fillRect(0, 400, 600, 400); const blob = await new Promise((r) => c.toBlob(r, 'image/png')); return await new Promise((r) => { const f = new FileReader(); f.onload = () => r(f.result.split(',')[1]); f.readAsDataURL(blob); }); });
  await tab(page, 'pattern');
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#sfFam [data-v="photo"]')]);
  await fc.setFiles({ name: 'ref.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
  await page.waitForFunction(() => !!__mstest.photoRef); await idle(page);
  await saveNew(page);
  const id = await savedId(page);
  await page.click('#sfFam [data-v="gradient"]'); await idle(page, AUTO);
  assert.ok((await stored(page, id)).ref, 'the photo is kept');
  assert.equal(await page.evaluate(() => __mstest.currentDesignObj(true).payload.ref), undefined, 'not in a shared file');
  await page.reload(); await idle(page); await openSaved(page, id); await idle(page);
  assert.ok(await page.evaluate(() => !!__mstest.photoRef), 'back after reopening');
  assert.deepEqual(errors, []);
});

// ---- From the fifth review (data safety) ----
const storedR5 = (page, id) => page.evaluate((id) => IDB.get('guide-' + id).then((p) => p && { prog: (p.prog || []).length, progL: p.prog || [], assign: p.assign, tones: p.tones || {}, ref: p.ref || null, photo: (p.style && p.style.photo) || null, out: p.out || null, secStates: p.secStates || {}, lmap: p.lmap }), id);
const tickN = (page, n, from = 0) => page.evaluate(([n, from]) => { const t = __mstest; t.assignData.order.slice(from, from + n).forEach((l) => { t.colored[l] = 1; }); t.guideDirty = true; t.renderGuide(); }, [n, from]);
// hold back the next new Image() whose src starts with `prefix` until release() is called
const holdImage = (page, prefix = '') => page.evaluate((prefix) => { const Real = window.Image, d = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src'); window.Image = function () { const im = new Real(); Object.defineProperty(im, 'src', { configurable: true, set(v) { if (String(v).startsWith(prefix) && !window.__release) { window.Image = Real; window.__release = () => d.set.call(im, v); } else d.set.call(im, v); }, get() { return d.get.call(im); } }); return im; }; }, prefix);
const release = (page) => page.evaluate(() => { const r = window.__release; window.__release = null; if (r) r(); return !!r; });
// a small coloured picture as a PNG file (for the Photo pattern)
const photoFile = (page) => page.evaluate(() => { const c = document.createElement('canvas'); c.width = 64; c.height = 48; const g = c.getContext('2d'); for (let i = 0; i < 4; i++) { g.fillStyle = ['#c33', '#3a6', '#36c', '#dc3'][i]; g.fillRect((i % 2) * 32, (i >> 1) * 24, 32, 24); } return c.toDataURL('image/png').split(',')[1]; }).then((b) => ({ name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from(b, 'base64') }));

test('a Photo pattern photo that finishes loading after another guide opened is dropped, not put on that guide', notOnWebKit(WK.photo), async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await saveNew(page);
  const idA = await savedId(page), f = await photoFile(page);
  await holdImage(page, 'blob:');
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.evaluate(() => __mstest.pickPhotoRef())]);
  await fc.setFiles(f);
  await page.waitForFunction(() => !!window.__release);
  // guide B opens while the photo is still decoding
  await page.evaluate(() => SF.loadSample());
  await page.waitForFunction((id) => __mstest.assignData && __mstest.curId !== id, idA); await idle(page);
  const fam = await page.evaluate(() => __mstest.family);
  await release(page); await idle(page);
  assert.equal(await page.evaluate(() => __mstest.family), fam, 'B keeps its pattern');
  assert.equal(await page.evaluate(() => !!__mstest.photoRef), false, 'and has no photo');
  await idle(page, AUTO);
  assert.equal((await storedR5(page, idA)).ref, null, 'A was not given it either');
  assert.deepEqual(errors, []);
});

test('a reopened Photo pattern guide keeps its photo when a change is saved before the photo decodes', notOnWebKit(WK.photo), async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await saveNew(page);
  const id = await savedId(page);
  await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 80; c.height = 60; const g = c.getContext('2d'); g.fillStyle = '#c33'; g.fillRect(0, 0, 40, 60); g.fillStyle = '#36c'; g.fillRect(40, 0, 40, 60); __mstest.setPhotoRef(__mstest.photoFromImage(c), true); });
  await idle(page, AUTO);
  const s0 = await storedR5(page, id);
  assert.ok(s0.ref && s0.photo, 'saved with its photo');
  await page.reload(); await idle(page);
  await holdImage(page, 'data:image/jpeg');
  await openSaved(page, id);
  assert.ok(await page.evaluate(() => !!window.__release && !__mstest.photoRef), 'the photo is still decoding');
  await tickN(page, 2); await idle(page, AUTO);
  const s1 = await storedR5(page, id);
  assert.equal(s1.prog, 2, 'the change is saved');
  assert.equal(s1.ref, s0.ref, 'with the photo');
  assert.deepEqual(s1.photo, s0.photo);
  await release(page); await idle(page);
  assert.ok(await page.evaluate(() => !!__mstest.photoRef), 'and it shows once decoded');
  assert.deepEqual(errors, []);
});
