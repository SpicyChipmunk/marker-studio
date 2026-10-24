// A guide’s Pattern: Random, Blend, Gradient, Balance, Leave white.
// (v320) Tests organised by feature: each block below came from the file named above it, its tests unchanged.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ROOT,
  answerAsks,
  idle,
  letterGuide,
  openApp,
  pause,
  sampleGuide,
  saveGuide,
  scrollTop,
  setup,
  teardown,
  toolStatus,
  welcome,
} from './helpers.mjs';
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

before(setup);
after(teardown);

// ---- from v307-guide.test.mjs ----
// v307 (the guide's Plan): a big page at "all · 268, some twice" has no two touching sections sharing a marker, and a
// guide saved before reopens exactly as saved; Undo and Redo keep the Start colour line right with shading on;
// Colour it on the paper round the drawing smooths its rough spots in the same step when Smooth them is on, and the
// rough line shows with the first-time tip; a photo with no colour says "N sections · left white" with Colour along
// off; Scatter's name sits over its slider as Flow's and Look's do; Undo's room in the tool row is kept; smaller
// rough-spot rings on a phone. Pages drawn here in code.
{
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
    await page.evaluate(() => __mstest.shadeTo('shadow'));
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
}

// ---- from v308-colour.test.mjs ----
// v308, the Gradient's colours in the Plan: the marker count (− and +, held down; the count typed; the slider's end
// at the smaller of the sections and the markers left: "all · 130"), the Include row (per guide and per zone, one
// Undo step, its line), guides saved before v308 opening and re-laying as they were, Saved palette with none saved,
// Surprise keeping the count and never bringing greys, Around for a mandala, the Photo pattern's Place it, Blend's
// anchors drawn in the marker they give, and the status line's shading markers.
{
  const tab = async (page, t) => {
    await page.click(`.sftabbtn[data-t="${t}"]`);
    await idle(page);
  };
  // each section's marker, by section number
  const keys = (page) =>
    page.evaluate(() => {
      const a = __mstest.assignData.assign;
      return Object.keys(a)
        .sort((x, y) => x - y)
        .map((l) => l + ':' + a[l].mkey);
    });
  const used = (page) =>
    page.evaluate(() => {
      const a = __mstest.assignData;
      return [...new Set(a.order.map((l) => a.assign[l].mkey))].length;
    });
  const label = (page) => page.textContent('#sfMkNlbl');
  const undoLabel = (page) => page.evaluate(() => __mstest.planLabel);
  const sv = (page, k) => page.evaluate((k) => __mstest.styleVars[k], k);
  // Ben's own 451 markers
  const bens = async (page) => {
    await page.evaluate(() => {
      const t = __mstest;
      state.owned = new Set(defaultOwned());
      save();
      t.coll = sfCollection();
      t.reassign();
    });
    await idle(page);
  };
  async function reopen(page, id) {
    await page.reload();
    await idle(page);
    await page.evaluate((id) => loadGuide({ id }), id);
    await page.waitForFunction((id) => __mstest.curId === id && __mstest.assignData, id);
    await idle(page);
  }
  // the markers in the Include groups that are off, used on the page
  const offUsed = (page) =>
    page.evaluate(() => {
      const t = __mstest,
        on = t.grad.inclOn(t.styleVars.gradIncl, t.styleVars.emphasis),
        A = t.assignData.assign;
      return [...new Set(t.assignData.order.map((l) => A[l]))].filter((m) => {
        const g = t.grad.inclGroup(m);
        return g && !on[g];
      }).length;
    });
  const sfmodeIsGuide = (page) => page.evaluate(() => __mstest.sfmode === 'guide');
  // a mandala drawn in the page (a middle, 4 rings of 12 petals), built as a new guide
  async function mandalaGuide(page) {
    const b64 = await page.evaluate(() => {
      const S = 600,
        c = document.createElement('canvas');
      c.width = c.height = S;
      const g = c.getContext('2d');
      g.fillStyle = '#fff';
      g.fillRect(0, 0, S, S);
      g.strokeStyle = '#000';
      g.lineWidth = 4;
      const R = [30, 90, 150, 210, 270];
      R.forEach((r) => {
        g.beginPath();
        g.arc(S / 2, S / 2, r, 0, Math.PI * 2);
        g.stroke();
      });
      for (let k = 0; k < 12; k++) {
        const a = (k * Math.PI) / 6;
        g.beginPath();
        g.moveTo(S / 2 + 30 * Math.cos(a), S / 2 + 30 * Math.sin(a));
        g.lineTo(S / 2 + 270 * Math.cos(a), S / 2 + 270 * Math.sin(a));
        g.stroke();
      }
      return c.toDataURL('image/png').split(',')[1];
    });
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.evaluate(() => SF.pickPhoto())]);
    await fc.setFiles({ name: 'mandala.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
    await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 60000 });
    await idle(page);
    await page.click('#sfBuild');
    await page.waitForFunction(() => __mstest.assignData && __mstest.sfmode === 'guide', null, {
      timeout: 60000,
    });
    await idle(page);
  }
  test('the marker count: − and + a step each (one Undo step), held down they keep going and lay the guide once; the count typed; the slider ends at “all · 130”', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await bens(page);
    await tab(page, 'colours');
    assert.equal(await label(page), '16');
    // the slider runs to the smaller of the sections (166) and the markers left (130)
    assert.equal(await page.getAttribute('#sfMkCount', 'max'), '130');
    for (const id of ['#sfMkMinus', '#sfMkPlus']) {
      const b = await page.locator(id).boundingBox();
      assert.ok(b.width >= 44 && b.height >= 44, id + ' 44 px');
    }
    await page.click('#sfMkPlus');
    await idle(page);
    assert.equal(await label(page), '17');
    assert.equal(await undoLabel(page), 'Markers: 17');
    assert.equal(await used(page), 17);
    await page.click('#sfMkMinus');
    await page.click('#sfMkMinus');
    await idle(page);
    assert.equal(await label(page), '15');
    // from the keyboard: a step each, focus kept on the button
    await page.focus('#sfMkPlus');
    await page.keyboard.press('Enter');
    await idle(page);
    assert.equal(await label(page), '16');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'sfMkPlus');
    await page.keyboard.press('Space');
    await idle(page);
    assert.equal(await label(page), '17');
    await page.click('#sfMkMinus');
    await page.click('#sfMkMinus');
    await idle(page);
    assert.equal(await label(page), '15');
    // held down: it keeps going, and the guide is laid once, when let go
    const b = await page.locator('#sfMkPlus').boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await pause(page, 1500, 'held down long enough to repeat');
    const mid = await label(page);
    await page.mouse.up();
    await idle(page);
    assert.ok(+mid >= 18, 'kept going while held: ' + mid);
    assert.equal(await label(page), String(await sv(page, 'limitN')));
    assert.equal(await used(page), await sv(page, 'limitN'));
    // Undo takes the whole hold back at once
    await page.evaluate(() => __mstest.assign.planUndo());
    await idle(page);
    assert.equal(await label(page), '15');
    // the count typed: the number pad (inputmode numeric); Enter sets it, Escape puts it back, over the end is all
    await page.click('#sfMkNum');
    assert.equal(await page.getAttribute('#sfMkType', 'inputmode'), 'numeric');
    await page.fill('#sfMkType', '24');
    await page.press('#sfMkType', 'Enter');
    await idle(page);
    assert.equal(await label(page), '24');
    assert.equal(await undoLabel(page), 'Markers: 24');
    await page.click('#sfMkNum');
    await page.fill('#sfMkType', '40');
    await page.press('#sfMkType', 'Escape');
    await idle(page);
    assert.equal(await label(page), '24');
    assert.equal(await sfmodeIsGuide(page), true, 'Escape left the guide where it was');
    await page.click('#sfMkNum');
    await page.fill('#sfMkType', '500');
    await page.press('#sfMkType', 'Enter');
    await idle(page);
    assert.equal(await label(page), 'all · 130');
    assert.equal(await sv(page, 'limitN'), 999);
    assert.equal(await undoLabel(page), 'Markers: all');
    assert.equal(await page.isDisabled('#sfMkPlus'), true, 'nothing past all');
    // the slider's end is all; one short of it is a count
    await page.evaluate(() => {
      const s = document.getElementById('sfMkCount');
      s.value = '129';
      s.dispatchEvent(new Event('input', { bubbles: true }));
      s.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await idle(page);
    assert.equal(await label(page), '129');
    assert.deepEqual(errors, []);
  });
  test('Include: Browns · Greys & black · Fluorescents under Mood, off but Earthy’s Browns; a chip is one Undo step; the line says what’s left; kept per guide and per zone', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await bens(page);
    await tab(page, 'colours');
    const chips = () =>
      page.evaluate(() =>
        [...document.querySelectorAll('#sfIncl button')].map(
          (b) => b.textContent + (b.classList.contains('on') ? ' on' : ''),
        ),
      );
    assert.deepEqual(await chips(), ['Browns', 'Greys & black', 'Fluorescents']);
    // under Mood, the line after it
    assert.ok(
      await page.evaluate(
        () =>
          !!(
            document.getElementById('sfMood').compareDocumentPosition(document.getElementById('sfIncl')) & 4
          ),
      ),
    );
    assert.equal(
      await page.textContent('#sfPoolCt'),
      '130 of your markers · browns, greys, fluorescents off',
    );
    // at all on the sample (166 sections): the 130, some twice; none from a group that's off
    await page.evaluate(() => {
      __mstest.styleVars.limitN = 999;
      __mstest.reassign();
    });
    await idle(page);
    assert.equal(await label(page), 'all · 130');
    assert.equal(await offUsed(page), 0);
    await page.click('#sfIncl [data-v="browns"]');
    await idle(page);
    assert.deepEqual(await chips(), ['Browns on', 'Greys & black', 'Fluorescents']);
    assert.equal(await undoLabel(page), 'Browns on');
    assert.equal(await page.textContent('#sfPoolCt'), '199 of your markers · greys, fluorescents off');
    assert.equal(await label(page), 'all · 166');
    await page.evaluate(() => __mstest.assign.planUndo());
    await idle(page);
    assert.deepEqual(await chips(), ['Browns', 'Greys & black', 'Fluorescents']);
    // Earthy turns Browns on; Deep leaves greys off
    await page.click('#sfMood [data-v="earthy"]');
    await idle(page);
    assert.deepEqual(await chips(), ['Browns on', 'Greys & black', 'Fluorescents']);
    await page.click('#sfMood [data-v="deep"]');
    await idle(page);
    assert.deepEqual(await chips(), ['Browns', 'Greys & black', 'Fluorescents']);
    assert.equal(await offUsed(page), 0, 'Deep: no greys or black');
    // a tapped choice is saved with the guide
    await page.click('#sfIncl [data-v="greys"]');
    await idle(page);
    const k = await keys(page);
    await saveGuide(page);
    const id = await page.evaluate(() => __mstest.curId);
    await reopen(page, id);
    assert.deepEqual(await sv(page, 'gradIncl'), { greys: true });
    assert.deepEqual(await keys(page), k, 'opens as saved');
    // Random has no Include row
    await tab(page, 'pattern');
    await page.click('#sfFam [data-v="random"]');
    await idle(page);
    await tab(page, 'colours');
    assert.equal(await page.isVisible('#sfIncl'), false);
    assert.deepEqual(errors, []);
  });
  test('a guide saved before v308 (no Include) opens with no Include row, exactly as saved, and is laid again as v307 laid it', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await bens(page);
    // laid as v307 lays it: everything included (all 166 sections one each, browns among them)
    await page.evaluate(() => {
      const t = __mstest;
      t.styleVars.gradIncl = null;
      t.styleVars.limitN = 451;
      t.reassign();
    });
    await idle(page);
    const k = await keys(page);
    assert.equal(await used(page), 166);
    await saveGuide(page);
    const id = await page.evaluate(() => __mstest.curId);
    const style = await page.evaluate(() => __mstest.currentDesignObj().payload.style);
    assert.equal('incl' in style, false, 'saved without Include');
    await reopen(page, id);
    await tab(page, 'colours');
    assert.equal(await sv(page, 'gradIncl'), null);
    assert.equal(await page.isVisible('#sfIncl'), false);
    assert.deepEqual(await keys(page), k, 'opens exactly as saved');
    // its 451 reads as all on a 166-section page; laid again (Mood away and back), the same markers
    assert.equal(await label(page), 'all · 166');
    await page.click('#sfMood [data-v="vivid"]');
    await idle(page);
    await page.click('#sfMood [data-v="neutral"]');
    await idle(page);
    assert.deepEqual(await keys(page), k, 'laid again as v307 laid it');
    assert.deepEqual(errors, []);
  });
  test('an opened guide’s count says its own markers until it’s laid again; Saved palette with none saved says the count in use, Expand only once a palette is chosen', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    // Honolulu 48 at all: its vivid ones
    await page.evaluate(() => {
      state.owned = new Set(presetMkeys(MARKER_SETS.find((s) => s.n === 'Honolulu 48')));
      save();
      __mstest.coll = sfCollection();
      __mstest.styleVars.limitN = 999;
      __mstest.reassign();
    });
    await idle(page);
    const n48 = await used(page);
    await tab(page, 'colours');
    assert.equal(await label(page), 'all · ' + n48);
    await saveGuide(page);
    const id = await page.evaluate(() => __mstest.curId);
    // more markers now (Ben's 451): the guide opens with its own, and says so until it's laid again
    await page.evaluate(() => {
      state.owned = new Set(defaultOwned());
      save();
    });
    await reopen(page, id);
    await tab(page, 'colours');
    assert.equal(await label(page), 'all · ' + n48);
    await page.click('#sfMkMinus');
    await idle(page);
    assert.equal(await label(page), '129');
    await page.click('#sfMkPlus');
    await idle(page);
    assert.equal(await label(page), 'all · 130');
    // (v318.34) A palette with none saved: one is made here, which caps the count at its size (the cap note says so),
    // and Expand is offered. (Before: Saved palette with none saved used your markers at the count as it was, no Expand)
    await page.evaluate(() => {
      __mstest.styleVars.limitN = 16;
      __mstest.reassign();
    });
    await idle(page);
    await page.click('#sfSrc [data-v="palette"]');
    await idle(page);
    const gn = await page.evaluate(() => __mstest.styleVars.genPal.length);
    assert.ok(gn >= 3 && gn <= 8, 'a palette made: ' + gn);
    assert.match(await label(page), new RegExp('(^|· )' + gn + '$'));
    assert.equal(await page.isDisabled('#sfMkCount'), false);
    assert.equal(await page.isVisible('#sfExpand'), true);
    assert.equal(await page.textContent('#sfPalCap'), 'A palette of ' + gn + ': tick Expand for more.');
    assert.deepEqual(errors, []);
  });
  test('Surprise keeps a count of 9 or more (all too) and, at all, brings no greys, browns or fluorescents; 8 or fewer it picks one', async () => {
    const { page, errors } = await openApp({
      width: 820,
      height: 1180,
      init: () => {
        let a = 7;
        Math.random = function () {
          a = (a + 0x6d2b79f5) | 0;
          let t = Math.imul(a ^ (a >>> 15), 1 | a);
          t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
          return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
      },
    });
    await sampleGuide(page);
    await bens(page);
    for (const n of [30, 999]) {
      for (let i = 0; i < 4; i++) {
        await page.evaluate((n) => {
          __mstest.styleVars.limitN = n;
          __mstest.reassign();
        }, n);
        await idle(page);
        await page.click('#sfSurprise');
        await idle(page);
        assert.equal(await sv(page, 'limitN'), n, 'kept ' + n);
        if (n === 999 && (await sv(page, 'family')) === 'gradient')
          assert.equal(
            await offUsed(page),
            0,
            'none from a group that is off: ' + (await sv(page, 'genHarmony')),
          );
        const greys = await page.evaluate(() => {
          const t = __mstest,
            A = t.assignData.assign;
          return [
            ...new Set(
              t.assignData.order.filter((l) => t.grad.inclGroup(A[l]) === 'greys').map((l) => A[l].code),
            ),
          ];
        });
        assert.deepEqual(
          greys,
          [],
          `no greys (${await sv(page, 'family')}, ${await sv(page, 'genHarmony')})`,
        );
      }
    }
    await page.evaluate(() => {
      __mstest.styleVars.limitN = 6;
      __mstest.reassign();
    });
    await idle(page);
    await page.click('#sfSurprise');
    await idle(page);
    const n = await sv(page, 'limitN');
    assert.ok(n >= 8 && n <= 23, n);
    assert.deepEqual(errors, []);
  });
  test('a mandala-like page: Radial offers “Use Around”; Surprise goes Around, never Radial', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await mandalaGuide(page);
    assert.ok((await page.evaluate(() => __mstest.countedList().length)) >= 40);
    assert.equal(await page.evaluate(() => __mstest.grad.mandala()), true);
    await tab(page, 'pattern');
    assert.equal(await page.isVisible('#sfAroundTip'), false);
    await page.click('#sfShape [data-v="radial"]');
    await idle(page);
    assert.match(await page.textContent('#sfAroundTip'), /Try Around/); // (v318.17: beside Matching shapes alike, under Looks like a mandala)
    await page.click('#sfUseAround');
    await idle(page);
    assert.equal(await sv(page, 'gradShape'), 'around');
    assert.equal(await undoLabel(page), 'Flow: Around');
    const shapes = new Set();
    for (let i = 0; i < 10; i++) {
      await page.click('#sfSurprise');
      await idle(page);
      if ((await sv(page, 'family')) === 'gradient') shapes.add(await sv(page, 'gradShape'));
    }
    assert.equal(shapes.has('radial'), false, [...shapes].join());
    assert.deepEqual(errors, []);
  });
  test('the status line counts the shading markers (“+ N for shading”); Blend’s anchors are drawn in the marker they give', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    assert.match(await toolStatus(page), /^166 sections · 16 markers$/);
    await page.evaluate(() => {
      __mstest.styleVars.shadeMode = 'full';
      __mstest.reassign();
    });
    await idle(page);
    const x = await page.evaluate(() => __mstest.assign.shadeExtra());
    assert.ok(x > 0);
    assert.equal(await toolStatus(page), `166 sections · 16 markers + ${x} for shading`);
    // Blend, Warm and Pastel: a vivid anchor gives a pale marker, and its dot is that marker
    await page.evaluate(() => {
      const t = __mstest;
      t.styleVars.shadeMode = 'off';
      t.styleVars.family = 'blend';
      t.styleVars.palette = 'warm';
      t.styleVars.emphasis = 'pastel';
      t.reassign();
    });
    await idle(page);
    const r = await page.evaluate(() => {
      const t = __mstest,
        a = t.anchors[0],
        own = t.coll.find((m) => m.mkey === a.mkey),
        out = t.assign.anchorOut(own),
        l = t.labels[Math.round(a.y) * t.W + Math.round(a.x)];
      return {
        own: own.mkey,
        out: out.mkey,
        there: l > 0 && t.assignData.assign[l] ? t.assignData.assign[l].mkey : null,
      };
    });
    assert.notEqual(r.out, r.own, 'the anchor’s own marker isn’t Pastel');
    if (r.there) assert.equal(r.out, r.there, 'the dot is the marker under it');
    assert.deepEqual(errors, []);
  });
  test('the Photo pattern’s Place it says how the photo is placed (“Lined up automatically”, or the chip that is on)', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    // a photo (the Letter page's line art): not the sample, so it's placed as Fill, or lined up as near as it can
    const b64 = (await readFile(join(ROOT, 'e2e', 'fixtures', 'letter-page.png'))).toString('base64');
    await tab(page, 'pattern');
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#sfFam [data-v="photo"]')]);
    await fc.setFiles({ name: 'p.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
    await page.waitForFunction(() => __mstest.photoRef, null, { timeout: 30000 });
    await idle(page);
    if (!(await page.isVisible('#sfPhFit'))) await page.click('#sfPhAlign');
    await idle(page);
    const lbl = await page.textContent('#sfPhFitLbl');
    assert.match(lbl, /^Place it: (Lined up automatically|Lined up|Fill)$/);
    await page.click('#sfPhFit [data-v="fit"]');
    await idle(page);
    assert.equal(await page.textContent('#sfPhFitLbl'), 'Place it: Fit');
    assert.equal(await page.getAttribute('#sfPhFit [data-v="fit"]', 'aria-pressed'), 'true');
    // and no grey suggested to buy
    const want = await page.evaluate(() => (document.querySelector('.sfphwant') || {}).textContent || '');
    assert.doesNotMatch(want, /\b(C|N|W|T)-\d|\b(CG|WG|GG)\d/);
    assert.deepEqual(errors, []);
  });
}

// ---- from v3083-blend.test.mjs ----
// v308.3 Blend picks its markers from the blend itself. The marker count is the most markers the blend may use: each
// section's mixed colour is found first, with the marker it gets with every allowed marker (its ideal); then the
// count's worth that best cover those (the anchors' own always among them), and each section takes the nearest of
// those. Before, the count was spread round the colour wheel first and the blend put onto that: on the sample with
// Ben's 451 markers, 16 used 8 markers, each section about 27 (L*a*b*) from its ideal, and − and + often changed
// nothing. Saved Blend guides open as saved; a change in the Plan lays them by the new rule.
{
  const tab = async (page, t) => {
    await page.click(`.sftabbtn[data-t="${t}"]`);
    await idle(page);
  };
  // the sample, Ben's 451 markers, Blend with its three first anchors, laid at count n
  async function benBlend(page, n = 16) {
    await sampleGuide(page);
    await page.evaluate((n) => {
      state.owned = new Set(defaultOwned());
      save();
      const t = __mstest;
      t.coll = sfCollection();
      t.styleVars.family = 'blend';
      t.anchors = [];
      t.styleVars.limitN = n;
      t.reassign();
    }, n);
    await idle(page);
  }
  // lay at count n (in the page): { section: marker key }
  const layAt = (page, n) =>
    page.evaluate((n) => {
      const t = __mstest;
      t.styleVars.limitN = n;
      t.reassign();
      return Object.fromEntries(t.assignData.order.map((l) => [l, t.assignData.assign[l].mkey]));
    }, n);
  const keysNow = (page) =>
    page.evaluate(() =>
      Object.fromEntries(__mstest.assignData.order.map((l) => [l, __mstest.assignData.assign[l].mkey])),
    );
  // how many markers, leaving out pinned sections
  const distinct = (page) =>
    page.evaluate(() => {
      const t = __mstest;
      return new Set(
        t.assignData.order.filter((l) => t.locks[l] === undefined).map((l) => t.assignData.assign[l].mkey),
      ).size;
    });
  // each section's mean L*a*b* distance from the marker it has at "all"
  const meanErr = (page, a, ref) =>
    page.evaluate(
      ([a, ref]) => {
        const lab = Object.fromEntries(__mstest.coll.map((m) => [m.mkey, m.lab]));
        let s = 0,
          n = 0;
        for (const l in ref) {
          const p = lab[a[l]],
            q = lab[ref[l]];
          s += Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
          n++;
        }
        return s / n;
      },
      [a, ref],
    );
  test('the count is the most markers the blend uses; each step closer to the blend at all; at 16 well within 27 of it', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await benBlend(page);
    const ref = await layAt(page, 999);
    const all = new Set(Object.values(ref)).size;
    assert.ok(all >= 20, 'the blend at all: ' + all);
    const errs = [];
    for (const n of [2, 3, 5, 8, 12, 16, 24]) {
      await layAt(page, n);
      const k = await distinct(page);
      assert.ok(k <= n, `at ${n}: ${k} markers`);
      assert.equal(k, Math.min(n, all), `at ${n}, the blend uses as many as it may`);
      errs.push([n, await meanErr(page, await keysNow(page), ref)]);
    }
    for (let i = 1; i < errs.length; i++)
      assert.ok(errs[i][1] < errs[i - 1][1], 'closer at ' + errs[i][0] + ': ' + JSON.stringify(errs));
    const e16 = errs.find((e) => e[0] === 16)[1];
    assert.ok(e16 < 8, 'at 16, ' + e16.toFixed(1) + ' from the blend at all (it was 27)');
    // fewer needed than asked: as many as the blend has (48 and all are the same)
    const a48 = await layAt(page, 48);
    assert.deepEqual(a48, ref);
    await idle(page);
    assert.equal(await toolStatus(page), `166 sections · ${all} markers`);
    // a pinned section keeps its marker, and the count is of the rest
    const pin = await page.evaluate(() => {
      const t = __mstest,
        l = t.assignData.order[5],
        y = t.coll.find((m) => m.code === 'Y17' || /Yellow/.test(m.name || '')) || t.coll[0];
      t.locks[l] = y.mkey;
      return { l, k: y.mkey };
    });
    const a8 = await layAt(page, 8);
    assert.equal(a8[pin.l], pin.k, 'the pin kept');
    assert.ok((await distinct(page)) <= 8);
    assert.deepEqual(errors, []);
  });
  test('the same blend picks the same markers: laid again, in another tab, and through Undo and Redo of the count', async () => {
    const one = await openApp({ width: 820, height: 1180 });
    await benBlend(one.page);
    const a = await keysNow(one.page);
    assert.deepEqual(await layAt(one.page, 16), a, 'laid again');
    const two = await openApp({ width: 820, height: 1180 });
    await benBlend(two.page);
    assert.deepEqual(await keysNow(two.page), a, 'another tab');
    // − on the count: one Undo step, as before
    const page = one.page;
    await tab(page, 'colours');
    await page.click('#sfMkMinus');
    await idle(page);
    assert.equal(await page.textContent('#sfMkNlbl'), '15');
    const b = await keysNow(page);
    assert.equal(new Set(Object.values(b)).size, 15);
    assert.match(await page.getAttribute('#sfPlanUndo', 'aria-label'), /Undo: Markers: 15/);
    await page.click('#sfPlanUndo');
    await idle(page);
    assert.deepEqual(await keysNow(page), a, 'Undo');
    await page.click('#sfPlanRedo');
    await idle(page);
    assert.deepEqual(await keysNow(page), b, 'Redo');
    assert.deepEqual(await layAt(page, 15), b, 'Redo is what 15 lays');
    assert.deepEqual(one.errors, []);
    assert.deepEqual(two.errors, []);
  });
  test('each anchor’s own marker is among those used, and its dot is that marker (red, green and blue, not the brown E713)', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await benBlend(page);
    for (const n of [16, 4, 3, 2]) {
      await layAt(page, n);
      const r = await page.evaluate(() => {
        const t = __mstest,
          used = new Set(t.assignData.order.map((l) => t.assignData.assign[l].mkey));
        return t.anchors.map((a) => {
          const own = t.coll.find((m) => m.mkey === a.mkey),
            // (anchorDot from v308.3; anchorOut drew the dot before)
            dot = t.assign.anchorDot ? t.assign.anchorDot(a, own) : t.assign.anchorOut(own),
            l = t.labels[Math.round(a.y) * t.W + Math.round(a.x)];
          return {
            own: own.mkey,
            dot: dot.mkey,
            used: used.has(dot.mkey),
            under: t.assignData.assign[l].mkey,
          };
        });
      });
      for (const x of r) {
        assert.ok(x.used, `at ${n}: the dot’s marker is on the page: ` + JSON.stringify(r));
        assert.equal(x.dot, x.under, `at ${n}: the dot is the marker under it`);
        // (the anchors' markers are your own, allowed, so with room for them they are used as they are)
        if (n >= 3) assert.equal(x.dot, x.own, `at ${n}: the anchor’s own marker`);
      }
    }
    assert.deepEqual(errors, []);
  });
  test('a saved palette, or one handed over from Palette, still keeps Blend to its markers; the choice is made within them', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await benBlend(page);
    const pal = await page.evaluate(() => {
      // 20 markers round the wheel, from Ben's
      const c = __mstest.coll.filter((m) => m.lab && Math.hypot(m.lab[1], m.lab[2]) > 30);
      const k = [];
      for (let i = 0; i < 20; i++) k.push(c[Math.floor((i * c.length) / 20)].mkey);
      state.saved.push({ id: 'pv3083', type: 'palette', name: 'Test 20', keys: k, ts: Date.now() });
      return k;
    });
    for (const how of ['saved', 'handed']) {
      await page.evaluate(
        ([how, pal]) => {
          const s = __mstest.styleVars;
          s.expand = false;
          if (how === 'saved') {
            s.paletteSource = 'saved';
            s.savedPalId = 'pv3083';
          } else {
            s.paletteSource = 'generate';
            s.genPal = pal.slice();
            s.fromPal = { name: 'Test 20', h: 'rainbow' };
          }
        },
        [how, pal],
      );
      const ref = await layAt(page, 999);
      const allN = new Set(Object.values(ref)).size;
      for (const n of [4, 8, 999]) {
        const a = await layAt(page, n);
        const used = new Set(Object.values(a));
        assert.ok(
          [...used].every((k) => pal.includes(k)),
          `${how} at ${n}: only the palette’s markers`,
        );
        assert.ok(used.size <= Math.min(n, allN), `${how} at ${n}: ${used.size}`);
      }
      // (the choice within the palette: at 4, four of those the blend at all uses)
      const a4 = await layAt(page, 4);
      assert.ok(
        Object.values(a4).every((k) => Object.values(ref).includes(k)),
        how + ': within the blend’s own',
      );
    }
    assert.deepEqual(errors, []);
  });
  test('the count’s slider ends where all does, and each step along it changes the picture', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await benBlend(page, 999);
    const all = new Set(Object.values(await keysNow(page))).size;
    await tab(page, 'colours');
    assert.equal(await page.getAttribute('#sfMkCount', 'max'), String(all));
    assert.equal(await page.textContent('#sfMkNlbl'), 'all · ' + all);
    assert.equal(await page.isDisabled('#sfMkPlus'), true);
    // − from all: one fewer
    await page.click('#sfMkMinus');
    await idle(page);
    assert.equal(await page.textContent('#sfMkNlbl'), String(all - 1));
    assert.equal(new Set(Object.values(await keysNow(page))).size, all - 1);
    // every step from all down to 2 lays something different (laid in the page: quicker than a tap each)
    const same = await page.evaluate((all) => {
      const t = __mstest,
        keys = () => JSON.stringify(t.assignData.order.map((l) => t.assignData.assign[l].mkey)),
        out = [];
      let prev = null;
      for (let n = all; n >= 2; n--) {
        t.styleVars.limitN = n;
        t.reassign();
        const k = keys();
        if (k === prev) out.push(n);
        prev = k;
      }
      return out;
    }, all);
    assert.deepEqual(same, [], 'steps that changed nothing');
    assert.equal(await page.textContent('#sfMkNlbl'), '2');
    assert.equal(await page.isDisabled('#sfMkMinus'), true);
    // back up to the end: all
    await page.fill('#sfMkCount', String(all));
    await page.dispatchEvent('#sfMkCount', 'change');
    await idle(page);
    assert.equal(await page.textContent('#sfMkNlbl'), 'all · ' + all);
    assert.deepEqual(errors, []);
  });
  // a Blend guide saved by v308.2 (e2e/fixtures/v3082-blend-guide.json: the sample, Ben's 451 markers, 16, laid by
  // v308.2's rule, which used 8): opened, it is exactly as saved, its dots the markers under them; a Plan change lays it
  // by the new rule
  test('a Blend guide saved by v308.2 opens exactly as saved; a change of count lays it by the new rule', async () => {
    const fx = JSON.parse(await readFile(join(ROOT, 'e2e', 'fixtures', 'v3082-blend-guide.json'), 'utf8'));
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await page.evaluate(() => {
      state.owned = new Set(defaultOwned());
      save();
      __mstest.coll = sfCollection();
    });
    await page.evaluate(
      (d) =>
        SF.importFile(new File([JSON.stringify(d.file)], 'old.msguide.json', { type: 'application/json' })),
      fx,
    );
    await page.waitForFunction(
      () =>
        __mstest.assignData && __mstest.sfmode === 'guide' && __mstest.curName === 'Blend saved by v308.2',
      null,
      { timeout: 20000 },
    );
    await idle(page);
    const now = await page.evaluate(() => ({
      sig: __mstest.labelsSig(),
      family: __mstest.styleVars.family,
      assign: Object.fromEntries(Object.entries(__mstest.assignData.assign).map(([k, v]) => [k, v.mkey])),
      dots: __mstest.anchors.map((a) => {
        const t = __mstest,
          m = t.coll.find((x) => x.mkey === a.mkey),
          l = t.labels[Math.round(a.y) * t.W + Math.round(a.x)];
        return [
          (t.assign.anchorDot ? t.assign.anchorDot(a, m) : t.assign.anchorOut(m)).mkey,
          t.assignData.assign[l].mkey,
        ];
      }),
    }));
    assert.equal(now.sig, fx.sig);
    assert.equal(now.family, 'blend');
    assert.deepEqual(now.assign, fx.assign, 'the same markers');
    assert.equal(new Set(Object.values(now.assign)).size, 8);
    for (const [dot, under] of now.dots) assert.equal(dot, under, 'the dot is the marker under it');
    await tab(page, 'colours');
    assert.equal(await page.textContent('#sfMkNlbl'), '16 · 8', 'it counts its own markers');
    assert.equal(await toolStatus(page), '166 sections · 8 markers');
    await page.click('#sfMkPlus');
    await idle(page);
    assert.equal(await page.textContent('#sfMkNlbl'), '17');
    const k = await keysNow(page);
    assert.equal(new Set(Object.values(k)).size, 17, 'laid by the new rule');
    assert.notDeepEqual(k, fx.assign);
    assert.deepEqual(errors, []);
  });
}

// ---- from v3083-colour.test.mjs ----
// v308.3 (colour): the Gradient's vivid set keeps every colour family (Honolulu 24 keeps its violets, V010 and V416:
// the count, the slider's end, "all" and the line under Include all say 14), a guide saved before opens as it was
// saved; Focus mode's colour chips on a colour neither text reads on at 4.5:1 get a soft halo round their words.
{
  const SHOTS = process.env.V3083_SHOTS || '';
  const tab = async (page, t) => {
    await page.click(`.sftabbtn[data-t="${t}"]`);
    await idle(page);
  };
  const keys = (page) =>
    page.evaluate(() => {
      const a = __mstest.assignData.assign;
      return Object.keys(a)
        .sort((x, y) => x - y)
        .map((l) => l + ':' + a[l].mkey);
    });
  const usedKeys = (page) =>
    page.evaluate(() => {
      const a = __mstest.assignData;
      return [...new Set(a.order.map((l) => a.assign[l].mkey))].sort();
    });
  const label = (page) => page.textContent('#sfMkNlbl');
  async function reopen(page, id) {
    await page.reload();
    await idle(page);
    await page.evaluate((id) => loadGuide({ id }), id);
    await page.waitForFunction((id) => __mstest.curId === id && __mstest.assignData, id);
    await idle(page);
  }
  // every marker of the catalogue on the sample page's sections, so many at a time, Focus mode's chips drawn for each lot
  async function chipsFor(page, mkeys) {
    return page.evaluate((mk) => {
      const t = __mstest,
        by = new Map(t.coll.map((m) => [m.mkey, m])),
        o = t.assignData.order;
      o.forEach((l, i) => (t.assignData.assign[l] = by.get(mk[i % mk.length])));
      t.focusChips();
      document.getElementById('sfFocMk').scrollLeft = 0;
      return [...document.querySelectorAll('#sfFocMk .focmk')].map((b) => ({
        k: b.dataset.k,
        halo: b.classList.contains('fmhalo'),
        lt: b.classList.contains('fmhalo-lt'),
        color: getComputedStyle(b).color,
        shadow: getComputedStyle(b).textShadow,
        // (drawn as any chip is: in the row, not faded)
        shown:
          getComputedStyle(b).position === 'static' &&
          getComputedStyle(b).opacity === '1' &&
          b.offsetWidth > 40,
      }));
    }, mkeys);
  }
  test('Honolulu 24 at all: its violets V010 and V416 come back, and the count, the slider’s end and the line under Include all say 14; a guide saved before opens as saved', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await page.evaluate(() => {
      state.owned = new Set(presetMkeys(MARKER_SETS.find((s) => s.n === 'Honolulu 24')));
      save();
      __mstest.coll = sfCollection();
      Object.assign(__mstest.styleVars, { family: 'gradient', emphasis: 'neutral', limitN: 999 });
      __mstest.reassign();
    });
    await idle(page);
    await tab(page, 'colours');
    const used = await usedKeys(page);
    assert.equal(used.length, 14, 'all lays 14');
    assert.ok(used.includes('Ohuhu|V010') && used.includes('Ohuhu|V416'), 'its violets');
    assert.equal(await label(page), 'all · 14');
    assert.equal(await page.getAttribute('#sfMkCount', 'max'), '14');
    assert.match(await page.textContent('#sfPoolCt'), /^14 of your markers/);
    // one less is a count, and + is all again
    await page.click('#sfMkMinus');
    await idle(page);
    assert.equal(await label(page), '13');
    await page.click('#sfMkPlus');
    await idle(page);
    assert.equal(await label(page), 'all · 14');

    // a guide laid before v308.3 (no violets: their sections had the marker next in the run) opens as it was saved
    await page.evaluate(() => {
      const t = __mstest,
        A = t.assignData.assign,
        o = t.assignData.order,
        v = (m) => m.mkey === 'Ohuhu|V010' || m.mkey === 'Ohuhu|V416',
        other = o.map((l) => A[l]).find((m) => !v(m));
      o.forEach((l) => {
        if (v(A[l])) A[l] = other;
      });
      t.assignData.base = Object.assign({}, A);
    });
    const old = await keys(page);
    assert.equal((await usedKeys(page)).length, 12);
    await saveGuide(page);
    const id = await page.evaluate(() => __mstest.curId);
    await reopen(page, id);
    assert.deepEqual(await keys(page), old, 'opens exactly as saved');
    assert.equal((await usedKeys(page)).length, 12);
    // laid again (a Plan change): today's 14
    await tab(page, 'colours');
    await page.click('#sfMkMinus');
    await idle(page);
    await page.click('#sfMkPlus');
    await idle(page);
    assert.equal(await label(page), 'all · 14');
    assert.equal((await usedKeys(page)).length, 14);
    assert.deepEqual(errors, []);
  });
  test('Focus mode’s colour chips: a halo round the words on exactly the 21 of the 722 colours neither text reads on at 4.5:1 (R413 has it, Y28 not), dark under white words, light under dark; the rest as they were', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180, storage: { 'ms-wake-told': '1' } });
    await sampleGuide(page);
    await page.evaluate(() => {
      state.owned = new Set(COLORS.map((c, i) => mkey(i)));
      save();
      __mstest.coll = sfCollection();
    });
    await idle(page);
    await page.click('#sfColor');
    await idle(page);
    await page.click('#sfFocus');
    await idle(page);
    await page.click('#sfFocCols');
    await idle(page);
    // the colours under 4.5:1 either way, worked out here from WCAG's ratio
    const { all, weak } = await page.evaluate(() => {
      const lum = (hex) => {
          const f = (v) => ((v /= 255) > 0.04045 ? ((v + 0.055) / 1.055) ** 2.4 : v / 12.92);
          const n = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
          return 0.2126 * f(n[0]) + 0.7152 * f(n[1]) + 0.0722 * f(n[2]);
        },
        d = lum('#141216');
      const all = __mstest.coll.map((m) => m.mkey),
        weak = __mstest.coll
          .filter((m) => {
            const y = lum(m.hex);
            return Math.max((y + 0.05) / (d + 0.05), 1.05 / (y + 0.05)) < 4.5;
          })
          .map((m) => m.mkey);
      return { all, weak };
    });
    // (every marker but the two colourless blenders, which no guide lays)
    assert.equal(all.length, 720);
    assert.equal(weak.length, 21);
    for (const k of ['Ohuhu|R413', 'Ohuhu|B315', 'Ohuhu|V015', 'Ohuhu|R014']) assert.ok(weak.includes(k), k);
    assert.ok(!weak.includes('Ohuhu|Y28'));
    const n = await page.evaluate(() => __mstest.assignData.order.length),
      seen = new Map();
    for (let i = 0; i < all.length; i += n)
      for (const c of await chipsFor(page, all.slice(i, i + n))) seen.set(c.k, c);
    assert.equal(seen.size, 720, 'a chip for every marker');
    const halo = [...seen.values()].filter((c) => c.halo).map((c) => c.k);
    assert.deepEqual(halo.sort(), weak.slice().sort(), 'the halo on exactly those');
    for (const c of seen.values()) {
      assert.ok(c.shown, c.k + ' drawn in the row like any chip');
      const white = c.color === 'rgb(255, 255, 255)';
      if (c.halo) {
        // (v320, G1-11: white words with a firmer dark halo on every one of them; dark words with a light halo had
        // read as pink on pink on RV212)
        assert.ok(white, c.k + ': white words');
        assert.equal(c.lt, false, c.k + ': no light halo');
        assert.match(c.shadow, /rgba\(0, 0, 0, 0\.85\) 0px 0px 3px/, c.k + ' ' + c.shadow);
      } else assert.equal(c.shadow, 'none', c.k + ': no halo');
    }
    assert.equal(seen.get('Ohuhu|R413').halo, true);
    assert.equal(seen.get('Ohuhu|Y28').halo, false);
    // a strip to look at: the weakest first, with Y28 and two plain ones beside them
    const strip = await chipsFor(page, [
      'Ohuhu|R014',
      'Ohuhu|V015',
      'Ohuhu|B315',
      'Ohuhu|R413',
      'Ohuhu|R412',
      'Copic|B06',
      'Ohuhu|Y28',
      'Ohuhu|B111',
      'Copic|R29',
    ]);
    assert.equal(strip.filter((c) => c.shown).length, 9, 'all nine chips in the row');
    if (SHOTS) {
      await mkdir(SHOTS, { recursive: true });
      await page
        .locator('#sfFocMk')
        .screenshot({ path: join(SHOTS, 'focus-chips-' + (process.env.E2E_BROWSER || 'chromium') + '.png') });
      await page.screenshot({
        path: join(SHOTS, 'focus-sheet-' + (process.env.E2E_BROWSER || 'chromium') + '.png'),
      });
    }
    assert.deepEqual(errors, []);
  });
}

// ---- from v314-gradient.test.mjs ----
// v314 (D8): a Gradient made since v314 shares its run out by area softened (gradArea), laid Polished or Natural: on a
// page with big sections, fewer markers are seen only on specks. A guide saved before, and Textured, Sparkle and
// Confetti, are laid as v313 laid them. Fails on v313.
{
  // lay it with this rule and Scatter; the markers' keys by section, and how many markers are on under 1% of the page
  const lay = (page, rule, scat) =>
    page.evaluate(
      ([rule, scat]) => {
        const t = __mstest;
        Object.assign(t.styleVars, {
          family: 'gradient',
          gradShape: 'serpentine',
          limitN: 16,
          gradScat: scat,
          gradArea: rule,
        });
        t.reassign();
        const A = t.assignData.assign,
          area = {};
        let all = 0;
        for (const l of t.assignData.order) {
          area[A[l].mkey] = (area[A[l].mkey] || 0) + t.comps[l].area;
          all += t.comps[l].area;
        }
        return {
          keys: t.assignData.order.map((l) => A[l].mkey).join(','),
          specks: Object.values(area).filter((a) => a < 0.01 * all).length,
        };
      },
      [rule, scat],
    );
  test('a page with big sections: a new guide takes the softened rule, with fewer markers on specks; a guide saved before, and Sparkle, as before', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await welcome(page, 'look');
    await idle(page);
    await page.click('#mSections');
    await idle(page);
    await letterGuide(page);
    await answerAsks(page);
    // (v315: a new guide takes the newer rule, 2, v318's 3, v318.10's 4 and v318.11's 5; v314's, 1, is still laid as it was)
    assert.equal(await page.evaluate(() => __mstest.styleVars.gradArea), 5, 'a new guide');
    assert.equal(await page.evaluate(() => __mstest.currentDesignObj().payload.gradArea), 5, 'saved with it');
    const soft = await lay(page, 1, 0),
      plain = await lay(page, 0, 0);
    assert.notEqual(soft.keys, plain.keys, 'laid differently');
    assert.ok(soft.specks < plain.specks, `fewer on specks: ${soft.specks} < ${plain.specks}`);
    // Sparkle: as v313 laid it
    const s1 = await lay(page, 1, 3),
      s0 = await lay(page, 0, 3);
    assert.equal(s1.keys, s0.keys, 'Sparkle as before');
    assert.deepEqual(errors, []);
  });
}

// ---- from v315-gradient.test.mjs ----
// v315 (Q5, Q11): a Gradient made since v315 (gradArea 2): the adapting area rule, a pinned section bigger than one
// marker's share counting for nothing (not a coloured one the re-lay holds), and no two markers too alike in the run.
// Saved with the guide and opened as saved; a v314 guide (1) keeps its rule. Fails on v314.1.
{
  // the Letter page laid as a Gradient of 16 with this rule; the markers by section, each one's share of the page
  const lay = (page, rule) =>
    page.evaluate((rule) => {
      const t = __mstest;
      Object.assign(t.styleVars, {
        family: 'gradient',
        gradShape: 'serpentine',
        limitN: 16,
        gradScat: 0,
        gradArea: rule,
      });
      t.reassign();
      return info();
      function info() {
        const A = t.assignData.assign,
          area = {};
        let all = 0;
        for (const l of t.assignData.order) {
          area[A[l].mkey] = (area[A[l].mkey] || 0) + t.comps[l].area;
          all += t.comps[l].area;
        }
        const big = t.assignData.order.reduce((b, l) => (t.comps[l].area > t.comps[b].area ? l : b));
        return {
          big,
          others: t.assignData.order
            .filter((l) => l !== big)
            .map((l) => A[l].mkey)
            .join(','),
          specks: Object.values(area).filter((a) => a < 0.003 * all).length,
        };
      }
    }, rule);
  test('a new guide takes rule 3 (v318; laid by rule 2’s area), saves 2 and opens with it; pinning the big section spreads the others, colouring it doesn’t', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await welcome(page, 'look');
    await idle(page);
    await page.click('#mSections');
    await idle(page);
    await letterGuide(page);
    await answerAsks(page);
    assert.equal(await page.evaluate(() => __mstest.styleVars.gradArea), 5, 'a new guide (5 since v318.11)');
    const a = await lay(page, 2);
    // coloured, then laid again: as before
    await page.evaluate((l) => {
      __mstest.colored[l] = 1;
    }, a.big);
    const held = await lay(page, 2);
    assert.equal(held.others, a.others, 'a coloured section isn’t a pin');
    await page.evaluate((l) => {
      __mstest.colored[l] = 0;
      __mstest.locks[l] = __mstest.assignData.assign[l].mkey;
    }, a.big);
    const pinned = await lay(page, 2);
    assert.notEqual(pinned.others, a.others, 'the run shared out again');
    assert.ok(pinned.specks <= a.specks, `no more on specks: ${pinned.specks} ≤ ${a.specks}`);
    // saved and opened again: rule 2
    await saveGuide(page);
    const id = await page.evaluate(() => __mstest.curId);
    assert.equal(await page.evaluate(() => __mstest.currentDesignObj().payload.gradArea), 2);
    await page.reload();
    await idle(page);
    await page.evaluate((id) => SF.openDesign(id), id);
    await page.waitForFunction((id) => __mstest.curId === id, id);
    assert.equal(await page.evaluate(() => __mstest.styleVars.gradArea), 2);
    assert.deepEqual(errors, []);
  });
}
