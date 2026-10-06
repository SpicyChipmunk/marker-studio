// v308, the Gradient's colours in the Plan: the marker count (− and +, held down; the count typed; the slider's end
// at the smaller of the sections and the markers left: "all · 130"), the Include row (per guide and per zone, one
// Undo step, its line), guides saved before v308 opening and re-laying as they were, Saved palette with none saved,
// Surprise keeping the count and never bringing greys, Around for a mandala, the Photo pattern's Place it, Blend's
// anchors drawn in the marker they give, and the status line's shading markers.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  setup,
  teardown,
  openApp,
  sampleGuide,
  idle,
  saveGuide,
  toolStatus,
  pause,
  ROOT,
} from './helpers.mjs';

before(setup);
after(teardown);

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
const sfmodeIsGuide = (page) => page.evaluate(() => __mstest.sfmode === 'guide');

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
        !!(document.getElementById('sfMood').compareDocumentPosition(document.getElementById('sfIncl')) & 4),
    ),
  );
  assert.equal(await page.textContent('#sfPoolCt'), '130 of your markers · browns, greys, fluorescents off');
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
  // Saved palette, none saved: your markers, the count as it is (it said "all (1)"), no Expand
  await page.evaluate(() => {
    __mstest.styleVars.limitN = 16;
    __mstest.reassign();
  });
  await idle(page);
  const pals = await page.evaluate(() => (state.palettes || []).length);
  if (!pals) {
    await page.click('#sfSrc [data-v="saved"]');
    await idle(page);
    assert.equal(await label(page), '16');
    assert.equal(await page.isDisabled('#sfMkCount'), false);
    assert.equal(await page.isVisible('#sfExpand'), false);
  }
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
      assert.deepEqual(greys, [], `no greys (${await sv(page, 'family')}, ${await sv(page, 'genHarmony')})`);
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
  assert.match(await page.textContent('#sfAroundTip'), /looks like a mandala/);
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
