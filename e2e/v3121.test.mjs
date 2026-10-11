// v312.1: from fable's two reviews of v312 (Ben's decisions D1–D3). Undo back past a marker marked dry keeps the
// guide's marker; a pinned, coloured section keeps a marker since marked dry; Back closes Markers' Add markers sheet a
// step at a time and the sheet is named "Add markers"; the guide's ⋯ › Send feedback opens the form's dialog; Send
// results sends once, and gives up on a stalled connection; Edit sections says the new count and outlines a merge;
// the wording fixes. Each test fails on v312.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  setup,
  teardown,
  openApp,
  idle,
  sampleGuide,
  welcome,
  answerAsks,
  sectionPoint,
  notOnWebKit,
  WK,
} from './helpers.mjs';

before(setup);
after(teardown);

const FIELDS = 27;
const FORM =
  'https://docs.google.com/forms/d/e/1FAIpQLSdTEST/viewform?usp=pp_url&' +
  Array.from({ length: FIELDS }, (_, i) => 'entry.' + (2000 + i) + '=x').join('&');
const withForm = `window.__MS_RESULTS_FORM = ${JSON.stringify(FORM)};`;
const keyOf = (page, l) => page.evaluate((l) => __mstest.assignData.assign[l].mkey, l);
async function markDry(page, k, dry = true) {
  await page.click('#mCollection');
  await idle(page);
  await page.evaluate(
    ([k, dry]) => {
      if (dry) state.ink[k] = 'dry';
      else delete state.ink[k];
      save();
      chrome();
    },
    [k, dry],
  );
  await page.click('#mSections');
  await idle(page);
}

test('Undo back past a marker marked dry: its sections show a stand-in, the guide keeps the marker, and it comes back', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await page.click('#sfMood [data-v="vivid"]');
  await idle(page);
  // a marker with sections both now and in the plan before the Mood step
  const pick = await page.evaluate(() => {
    const t = __mstest,
      by = {},
      byPrev = {},
      prev = t.assign.planStack[t.assign.planStack.length - 1].s.a;
    for (const l in t.assignData.assign) (by[t.assignData.assign[l].mkey] ||= []).push(+l);
    for (const l in prev) (byPrev[prev[l]] ||= []).push(+l);
    const k = Object.keys(by).find((x) => by[x].length >= 2 && byPrev[x] && byPrev[x].length >= 2);
    return { k, prev: byPrev[k] };
  });
  assert.ok(pick.k);
  await markDry(page, pick.k);
  await page.click('#sfPlanUndo');
  await idle(page);
  const shown = await page.evaluate((s) => s.map((l) => __mstest.assignData.assign[l].mkey), pick.prev);
  assert.ok(
    shown.every((k) => k !== pick.k),
    'a stand-in shows',
  );
  const kept = await page.evaluate(
    ([k, s]) => {
      const d = __mstest.currentDesignObj();
      return s.filter((l) => d.payload.assign[l] === k).length;
    },
    [pick.k, pick.prev],
  );
  assert.equal(kept, pick.prev.length, 'the guide keeps the marker, as saved');
  await markDry(page, pick.k, false);
  const back = await page.evaluate((s) => s.map((l) => __mstest.assignData.assign[l].mkey), pick.prev);
  assert.ok(
    back.every((k) => k === pick.k),
    'back in its sections: ' + back.join(' '),
  );
  assert.deepEqual(errors, []);
});

test('a pinned, coloured section keeps a marker since marked dry through a plan change, as an unpinned one does', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  const p = await page.evaluate(() => {
    const t = __mstest,
      by = {};
    for (const l in t.assignData.assign) (by[t.assignData.assign[l].mkey] ||= []).push(+l);
    const k = Object.keys(by).find((x) => by[x].length >= 3),
      [l, l2] = by[k];
    t.locks[l] = k;
    t.colored[l] = 1;
    t.colored[l2] = 1;
    return { k, l, l2 };
  });
  await markDry(page, p.k);
  await page.click('#sfMood [data-v="vivid"]');
  await idle(page);
  assert.deepEqual([await keyOf(page, p.l), await keyOf(page, p.l2)], [p.k, p.k]);
  assert.deepEqual(errors, []);
});

test('the Add markers sheet is named Add markers for a screen reader, and the welcome its own name again after', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await welcome(page, 'look');
  await idle(page);
  await page.click('#mCollection');
  await idle(page);
  await page.click('#mkAddBtn');
  await idle(page);
  assert.equal(await page.getAttribute('#welcome', 'aria-labelledby'), 'wcTA');
  assert.equal(await page.textContent('#wcTA'), 'Add markers');
  await page.keyboard.press('Escape');
  await idle(page);
  assert.equal(await page.getAttribute('#welcome', 'aria-labelledby'), 'wcTitle');
  assert.deepEqual(errors, []);
});

// (Back is left to the browser under test automation in Safari's engine: helpers' WK.back)
test(
  'Back closes the Add markers sheet a step at a time; the welcome still has no entry',
  notOnWebKit(WK.back),
  async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    // (the welcome: no Back entry of its own, as before)
    await page.waitForSelector('#welcome.on');
    const h0 = await page.evaluate(() => history.length);
    await page.waitForTimeout(150);
    assert.equal(await page.evaluate(() => history.length), h0, 'the welcome makes no entry');
    await welcome(page, 'look');
    await idle(page);
    await page.click('#mCollection');
    await idle(page);
    await page.click('#mkAddBtn');
    await idle(page);
    assert.equal(await page.getAttribute('#welcome', 'aria-labelledby'), 'wcTA');
    assert.equal(await page.textContent('#wcTA'), 'Add markers');
    await page.waitForFunction(() => history.state && history.state.msLayer >= 1);
    await page.click('#mkaSet');
    await idle(page);
    await page.goBack();
    await idle(page);
    assert.ok(await page.isVisible('#wcStepAdd'), 'Back: from the sets to the ways');
    assert.ok(await page.isVisible('#welcome'));
    await page.waitForFunction(() => history.state && history.state.msLayer >= 1);
    await page.goBack();
    await idle(page);
    assert.equal(await page.isVisible('#welcome'), false, 'Back again: closed');
    assert.equal(
      await page.getAttribute('#welcome', 'aria-labelledby'),
      'wcTitle',
      'the welcome’s name back',
    );
    assert.ok(await page.isVisible('#mkAddBtn'), 'still on Markers');
    assert.deepEqual(errors, []);
  },
);

test('the guide’s ⋯ › Send feedback opens the form’s dialog, as every other Send feedback does', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, init: withForm });
  await sampleGuide(page);
  await page.click('#sfMore');
  await page.click('#sfSheet [data-m="feedback"]');
  await idle(page);
  assert.ok(await page.isVisible('#fbOverlay'));
  assert.deepEqual(errors, []);
});

test('Send results: one send at a time (both buttons off meanwhile); a stalled connection gives up and says so', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, init: withForm });
  await welcome(page, 'look');
  await idle(page);
  let n = 0,
    hold = null;
  await page.route(/docs\.google\.com\/forms\/d\/e\/1FAIpQLSdTEST\/formResponse/, (r) => {
    n++;
    hold = r; // never answered: a stalled connection
  });
  await page.clock.install();
  await page.click('#homeTasks');
  await page.click('.ttrow[data-k="add"] [data-r="easy"]');
  await page.click('#ttSend');
  assert.equal(await page.isDisabled('#ttSendTop'), true);
  assert.equal(await page.isDisabled('#ttSend'), true);
  await page.click('#ttSendTop', { force: true });
  await page.clock.runFor(21000);
  await page.waitForFunction(() => /^Couldn’t send/.test(document.getElementById('ttSaid').textContent));
  assert.equal(n, 1, 'sent once');
  assert.equal(await page.isDisabled('#ttSend'), false);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('ms-tester')).sends), 0);
  if (hold) await hold.abort().catch(() => {});
  assert.deepEqual(errors, []);
});

test('Edit sections: a merge outlines the section they became for a moment and says the new count; leave out says it too', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await answerAsks(page);
  await page.click('#sfBack2');
  await idle(page);
  await page.evaluate(() => scrollTo(0, 0));
  const tap = async (l) => {
    const p = await sectionPoint(page, l);
    await page.mouse.click(p.x, p.y);
    await idle(page);
  };
  const said = () => page.evaluate(() => document.getElementById('sfLive').textContent);
  const ol = () =>
    page.evaluate(() => {
      const o = document.querySelector('#sfRoot .sfoutline');
      return !!o && o.style.display !== 'none';
    });
  const [a, b] = await page.evaluate(() => {
    const t = __mstest,
      cl = t.countedList().filter((l) => t.comps[l].area > 400),
      adj = t.adj;
    for (const x of cl) for (const y of cl) if (x < y && adj[x] && adj[x].has(y)) return [x, y];
    return [];
  });
  await page.click('#sfEdit [data-m="merge"]');
  await tap(a);
  await tap(b);
  const n1 = await page.textContent('#sfCount');
  assert.equal(await said(), 'Merged into one section: ' + n1);
  assert.equal(await ol(), true, 'the merged section outlined');
  await page.waitForTimeout(1700);
  assert.equal(await ol(), false, 'for a moment only');
  // leave out
  await page.click('#sfEdit [data-m="toggle"]');
  const big = await page.evaluate(() => {
    const t = __mstest;
    return t.countedList().sort((x, y) => t.comps[y].area - t.comps[x].area)[0];
  });
  await tap(big);
  assert.equal(await said(), 'Left out: ' + (await page.textContent('#sfCount')));
  await tap(big);
  assert.equal(await said(), 'Brought back: ' + n1);
  assert.deepEqual(errors, []);
});

test('wording: Scan’s line on the sheet, To buy’s empty list, tester task 3; Print says Close once there’s a PDF', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await page.click('.sftabbtn[data-t="share"]');
  await page.click('#sfPrint');
  await page.waitForSelector('#sfSheet [data-pr="cancel"]');
  assert.equal((await page.textContent('#sfSheet [data-pr="cancel"]')).trim(), 'Cancel');
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.click('#sfPDF')]);
  await dl.path();
  assert.equal((await page.textContent('#sfSheet [data-pr="cancel"]')).trim(), 'Close');
  await page.click('#sfSheet [data-pr="cancel"]');
  await page.click('#mCollection');
  await idle(page);
  await page.click('#mkAddBtn');
  assert.match(
    await page.textContent('#mkaScan'),
    /Type codes from a receipt, or scan caps with Scan Text on an iPad or iPhone\./,
  );
  await page.keyboard.press('Escape');
  await page.click('#ownView [data-v="wish"]');
  await idle(page);
  assert.match(await page.textContent('#wishView'), /in its details, then tap \+ To buy for a replacement/);
  await page.click('#mHome');
  await idle(page);
  await page.click('#homeTasks');
  await page.click('.ttrow[data-k="plan"] .tttop');
  assert.match(await page.textContent('#ttBody-plan'), /or Shuffle \(Other pairings in Random\)/);
  assert.deepEqual(errors, []);
});
