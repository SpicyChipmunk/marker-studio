// v307 (the guide's Plan): a big page at "all · 268, some twice" has no two touching sections sharing a marker, and a
// guide saved before reopens exactly as saved; Undo and Redo keep the Start colour line right with shading on;
// Colour it on the paper round the drawing smooths its rough spots in the same step when Smooth them is on, and the
// rough line shows with the first-time tip; a photo with no colour says "N sections · left white" with Colour along
// off; Scatter's name sits over its slider as Flow's and Look's do; Undo's room in the tool row is kept; smaller
// rough-spot rings on a phone. Pages drawn here in code.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, sampleGuide, idle, saveGuide, toolStatus, scrollTop } from './helpers.mjs';

before(setup);
after(teardown);

// a 1200 × 1500 page: a frame 90 px in, and inside it a grid of cells `step` px across with a ring in every third
const draw = (step) => `
g.fillStyle='#fff';g.fillRect(0,0,W,H);g.strokeStyle='#111';g.lineWidth=5;
g.strokeRect(90,90,W-180,H-180);
g.beginPath();
for(let x=150;x<W-150;x+=${step}){g.moveTo(x,150);g.lineTo(x,H-150);}
for(let y=150;y<H-150;y+=${step}){g.moveTo(150,y);g.lineTo(W-150,y);}
g.moveTo(150,150);g.lineTo(150,H-150);g.lineTo(W-150,H-150);g.lineTo(W-150,150);g.closePath();g.stroke();
let k=0;for(let x=150;x+${step}<=W-150;x+=${step})for(let y=150;y+${step}<=H-150;y+=${step}){if(k++%3)continue;g.beginPath();g.arc(x+${step}/2,y+${step}/2,${step}*0.3,0,6.283);g.stroke();}`;
async function fresh(page, step) {
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
  }, draw(step));
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.evaluate(() => SF.pickPhoto())]);
  await fc.setFiles({ name: 'page.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
  await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 60000 });
  await idle(page);
}
// Ben's own 451 markers, the marker count at all of them (before Build: the guide is laid with them). (v308: as a
// guide from before v308 is laid, all 451 in play: a new guide's "all" is his 130 vivid markers, in bands on a page
// of more than twice as many sections, which test/v308-colour.test.mjs covers)
const bensOwned = (page) =>
  page.evaluate(() => {
    state.owned = new Set(defaultOwned());
    save();
    __mstest.coll = sfCollection();
    __mstest.styleVars.limitN = 999;
    __mstest.styleVars.gradIncl = null;
  });
async function built(page, step) {
  await sampleGuide(page);
  await fresh(page, step);
  await bensOwned(page);
  await page.click('#sfBuild');
  await page.waitForFunction(() => __mstest.sfmode === 'guide', null, { timeout: 60000 });
  await idle(page);
}
const markers = (page) =>
  page.evaluate(() => {
    const a = __mstest.assignData.assign,
      o = {};
    for (const k in a) o[k] = a[k].mkey;
    return o;
  });
// touching sections sharing a marker: [l, q] pairs
const sharing = (page) =>
  page.evaluate(() => {
    const t = __mstest,
      a = t.colour.adj(),
      A = t.assignData.assign,
      out = [];
    for (const k in a)
      a[k].forEach((q) => {
        if (q > +k && A[k] && A[q] && A[k].mkey === A[q].mkey) out.push([+k, q]);
      });
    return out;
  });
async function reopen(page, id) {
  await page.reload();
  await idle(page);
  await page.evaluate((id) => loadGuide({ id }), id);
  await page.waitForFunction((id) => __mstest.curId === id && __mstest.assignData, id);
  await idle(page);
}
const tab = async (page, t) => {
  await page.click(`.sftabbtn[data-t="${t}"]`);
  await idle(page);
};

test('a big page at “all · 268, some twice”: no touching sections share a marker; a guide saved with some sharing opens as it was saved', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await built(page, 40);
  const N = await page.evaluate(() => __mstest.assignData.N);
  assert.ok(N > 500, N + ' sections');
  // (v308: the count no longer says ", some twice")
  assert.equal(await page.textContent('#sfMkNlbl'), 'all · 268');
  assert.deepEqual(await sharing(page), [], 'no touching sections share a marker');
  for (const shape of ['radial', 'around']) {
    await tab(page, 'pattern');
    await page.click(`#sfShape [data-v="${shape}"]`);
    await idle(page);
    assert.deepEqual(await sharing(page), [], shape);
  }
  // a guide laid before v307, with touching sections sharing a marker: opened again, exactly as it was saved
  await page.evaluate(() => {
    const t = __mstest,
      a = t.colour.adj(),
      A = t.assignData.assign;
    let n = 0;
    for (const l of t.assignData.order) {
      if (n >= 6 || l === t.assignData.order[0]) continue;
      const q = [...(a[l] || [])].find((q) => A[q]);
      if (q === undefined) continue;
      A[l] = A[q];
      t.assignData.base[l] = A[q];
      n++;
    }
  });
  const was = await markers(page),
    pairs = await sharing(page);
  assert.ok(pairs.length >= 6, pairs.length + ' pairs');
  await saveGuide(page);
  const id = await page.evaluate(() => __mstest.curId);
  await reopen(page, id);
  assert.deepEqual(await markers(page), was, 'opens as it was saved');
  assert.deepEqual(await sharing(page), pairs);
  assert.deepEqual(errors, []);
});

test('Undo and Redo with shading on: the Start colour line still names the marker the picture starts with', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await page.evaluate(() => {
    const t = __mstest;
    state.owned = new Set(defaultOwned());
    save();
    t.coll = sfCollection();
    t.styleVars.limitN = 16;
    t.reassign();
  });
  await idle(page);
  await tab(page, 'shading');
  await page.click('#sfShade [data-v="shadow"]');
  await idle(page);
  await tab(page, 'pattern');
  // laid with shading on (Shuffle), then another change
  await page.click('#sfVary');
  await idle(page);
  const first = () =>
    page.evaluate(() => {
      const t = __mstest;
      return { mk: t.assignData.assign[t.assignData.order[0]].mkey, shp: !!t.assignData.shp };
    });
  const start = async () => (await page.textContent('#sfGStartC')).trim();
  const f1 = await first(),
    s1 = await start();
  assert.ok(f1.shp, 'picked with shading in mind');
  await page.click('#sfDir [data-d="-1"]');
  await idle(page);
  const s2 = await start();
  await page.click('#sfPlanUndo');
  await idle(page);
  assert.deepEqual(await first(), f1);
  assert.equal(await start(), s1, 'after Undo');
  assert.ok(
    await page.evaluate(() => {
      const g = __mstest.gradStartInfo(),
        t = __mstest;
      return g.cols[g.r].mkey === t.assignData.assign[t.assignData.order[0]].mkey;
    }),
    'the Start colour is the first section’s marker',
  );
  await page.click('#sfPlanRedo');
  await idle(page);
  assert.equal(await start(), s2, 'after Redo');
  assert.deepEqual(errors, []);
});

test('Colour it with Smooth them on: the paper’s rough spots are smoothed in the same step; one Undo step takes it all back', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await built(page, 110);
  const p = await page.evaluate(() => __mstest.comps.findIndex((c) => c && !c.merged && c.framed));
  assert.ok(p > 0, 'the frame is found');
  await tab(page, 'pattern');
  await page.evaluate(() => __mstest.renderControls());
  await idle(page);
  // Smooth them first
  if (await page.isVisible('#sfRoughGo')) {
    await page.click('#sfRoughGo');
    await idle(page);
  } else {
    await page.evaluate(() => {
      __mstest.styleVars.gradFix = true;
      __mstest.reassign();
    });
    await idle(page);
  }
  assert.equal(await page.evaluate(() => __mstest.styleVars.gradFix), true);
  const was = await markers(page),
    n0 = await page.evaluate(() => __mstest.planCount);
  // (what the paper brings without the fix: as v306 left it)
  await page.click('#sfFrameColour');
  await idle(page);
  assert.equal(
    await page.evaluate((l) => !!__mstest.assignData.assign[l], p),
    true,
    'the paper has a marker',
  );
  const r = await page.evaluate(() => {
    const x = __mstest.grad.roughNow();
    return { ids: x.ids.length, pairs: x.pairs.length };
  });
  assert.deepEqual(r.ids, 0, 'nothing left for Smooth them: ' + JSON.stringify(r));
  assert.equal(await page.locator('#sfRough').count(), 0, 'no rough-spot line');
  assert.equal(await page.evaluate(() => __mstest.planCount), n0 + 1, 'one step');
  assert.equal(await page.evaluate(() => __mstest.planLabel), 'Paper round the drawing coloured');
  await page.click('#sfPlanUndo');
  await idle(page);
  assert.deepEqual(await markers(page), was, 'Undo: as it was');
  assert.deepEqual(errors, []);
});

test('the rough-spot line shows with the first-time “Tap a section” line, not after it', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await built(page, 110);
  await page.evaluate(() => __mstest.renderControls());
  await idle(page);
  assert.ok(await page.isVisible('.sfinfo[data-hint="tap"]'), 'the first-time line');
  const n = await page.evaluate(() => __mstest.grad.roughNow().pairs.length);
  assert.ok(n > 0, n + ' rough spots');
  assert.ok(await page.isVisible('#sfRough'), 'and the rough-spot line with it');
  assert.equal(await page.textContent('#sfRough span'), n + ' rough spot' + (n === 1 ? '' : 's') + ' ·');
  assert.deepEqual(errors, []);
});

// a photo of the page before it was coloured: plain paper (as e2e/v304-photo)
test('a photo with no colour: “N sections · left white”, and Colour along is off', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  const N = await page.evaluate(() => __mstest.assignData.N);
  await tab(page, 'pattern');
  await page.evaluate(() => {
    const t = __mstest,
      s = Math.min(1, 1000 / Math.max(t.W, t.H)),
      pw = Math.round(t.W * s),
      ph = Math.round(t.H * s),
      c = document.createElement('canvas');
    c.width = pw;
    c.height = ph;
    const g = c.getContext('2d');
    g.fillStyle = 'rgb(240,232,214)';
    g.fillRect(0, 0, pw, ph);
    t.setPhotoRef(t.photoFromImage(c), true);
    t.photoXf = { cx: t.W / 2, cy: t.H / 2, sx: t.W / pw, sy: t.H / ph, r: 0 };
    t.photoRecolour();
    t.renderControls();
  });
  await idle(page);
  const white = await page.evaluate(() => Object.keys(__mstest.assignData.paper).length);
  assert.equal(await page.evaluate(() => __mstest.assignData.N), 0, 'every section left white');
  // (all of them but a sliver or two too thin to read in the photo)
  assert.ok(white > N - 5, `${white} of ${N}`);
  assert.equal(await toolStatus(page), `${white} sections · left white`);
  assert.ok(await page.isDisabled('#sfColor'), 'Colour along is off');
  // white areas coloured after all: as before
  await page.click('#sfPhPaper');
  await idle(page);
  assert.match(await toolStatus(page), /^\d+ sections · \d+ markers?$/);
  assert.ok(!(await page.isDisabled('#sfColor')));
  assert.deepEqual(errors, []);
});

test('polish: Scatter’s name over its slider as Look’s is; Undo’s room kept in the tool row; smaller rough-spot rings on a phone', async () => {
  for (const [w, h] of [
    [820, 1180],
    [1180, 820],
  ]) {
    const { page, errors, ctx } = await openApp({ width: w, height: h });
    await sampleGuide(page);
    await tab(page, 'pattern');
    // Scatter: "Scatter: Polished", the same style as Look's label, the slider under it
    const sc = await page.evaluate(() => {
      const l = document.getElementById('sfGradScatLbl'),
        look = [...document.querySelectorAll('#sfPanel-pattern .sfsublbl')].find(
          (e) => e.textContent === 'Look',
        ),
        cs = (e) => {
          const s = getComputedStyle(e);
          return [s.fontSize, s.color, s.fontWeight];
        },
        r = document.getElementById('sfGradScat');
      return {
        text: l.textContent,
        cls: l.className,
        same: JSON.stringify(cs(l)) === JSON.stringify(cs(look)),
        under: r.getBoundingClientRect().top >= l.getBoundingClientRect().bottom - 1,
        name: r.getAttribute('aria-label'),
      };
    });
    assert.deepEqual(sc, {
      text: 'Scatter: Polished',
      cls: 'sfsublbl',
      same: true,
      under: true,
      name: 'Scatter',
    });
    // the status doesn't move when Undo comes
    await scrollTop(page);
    const x0 = await page.evaluate(() => document.getElementById('sfStat').getBoundingClientRect().left);
    assert.equal(await page.isVisible('#sfPlanUndo'), false, 'no Undo yet');
    await page.click('#sfVary');
    await idle(page);
    await scrollTop(page);
    assert.equal(await page.isVisible('#sfPlanUndo'), true);
    const x1 = await page.evaluate(() => document.getElementById('sfStat').getBoundingClientRect().left);
    assert.ok(Math.abs(x1 - x0) < 1, `the status stays put: ${x0} -> ${x1}`);
    // back to nothing to undo: hidden, its room kept
    await page.click('#sfPlanUndo');
    await idle(page);
    assert.equal(await page.isVisible('#sfPlanUndo'), false);
    assert.equal(await page.isVisible('#sfPlanRedo'), true, 'Redo beside it');
    // Colour along: no Undo, no room for it
    await page.click('#sfColor');
    await idle(page);
    assert.equal(
      await page.evaluate(() => getComputedStyle(document.getElementById('sfPlanUndo')).display),
      'none',
    );
    assert.deepEqual(errors, []);
    await ctx.close();
  }
  // rings: 26px on an iPad, 16px on a phone
  for (const [w, h, px] of [
    [820, 1180, 26],
    [390, 844, 16],
  ]) {
    const { page, errors, ctx } = await openApp({ width: w, height: h });
    await sampleGuide(page);
    // (v308: rough spots need markers to spare: as a guide from before v308, all 451 in play)
    await page.evaluate(() => {
      const t = __mstest;
      state.owned = new Set(defaultOwned());
      save();
      t.coll = sfCollection();
      t.styleVars.limitN = 999;
      t.styleVars.gradIncl = null;
      t.reassign();
    });
    await idle(page);
    await tab(page, 'pattern');
    await page.evaluate(() => __mstest.renderControls());
    await idle(page);
    const ring = await page.evaluate(() => {
      const r = document.querySelector('.sfroughs .sfring');
      return r ? Math.round(r.getBoundingClientRect().width) : 0;
    });
    assert.equal(ring, px, `${w}: rings ${ring}px`);
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});
