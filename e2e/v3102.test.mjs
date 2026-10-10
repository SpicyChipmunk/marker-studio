// v310.2: Ben's decisions from the v310.1 pass. An open guide follows a marker marked dry or unticked in Markers as
// opening it again would (sections still to colour show the closest you own; coloured ones keep theirs; the guide
// keeps the marker; back when it's yours again; not an Undo step); a locked Palette colour that can't be used is
// unlocked on Generate, with a word; Undo on "Page straightened" leaves "Page kept as photographed · Straighten";
// Home's guide card counts the colours guides use, saying how many marked dry are left out.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { setup, teardown, openApp, idle, sampleGuide, welcome, haveSet, ROOT } from './helpers.mjs';

before(setup);
after(teardown);

// a marker the guide uses in at least 3 sections, one of them coloured
async function pickMarker(page) {
  return page.evaluate(() => {
    const t = __mstest,
      by = {};
    for (const l in t.assignData.assign)
      (by[t.assignData.assign[l].mkey] = by[t.assignData.assign[l].mkey] || []).push(+l);
    const k = Object.keys(by).find((x) => by[x].length >= 3);
    t.colored[by[k][0]] = 1;
    return { k, secs: by[k] };
  });
}
const keysOf = (page, secs) => page.evaluate((s) => s.map((l) => __mstest.assignData.assign[l].mkey), secs);
// to Markers, a change there, and back to the guide (as a tester would)
async function viaMarkers(page, fn, arg) {
  await page.click('#mCollection');
  await idle(page);
  await page.evaluate(fn, arg);
  await page.click('#mSections');
  await idle(page);
}

test('a marker marked dry in Markers: the open guide’s sections still to colour show the closest you own, as reopening would; back when it isn’t', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  const { k, secs } = await pickMarker(page);
  const n0 = await page.evaluate(() => __mstest.assign.planStack.length);
  await viaMarkers(
    page,
    (k) => {
      state.ink[k] = 'dry';
      save();
      chrome();
    },
    k,
  );
  const after = await keysOf(page, secs);
  assert.equal(after[0], k, 'the coloured section keeps its marker');
  assert.ok(
    after.slice(1).every((x) => x !== k),
    'the others show a stand-in',
  );
  assert.match(
    await page.evaluate(() => document.body.innerText),
    /1 marker is dry — sections still to colour show the closest you own\. The guide keeps it until you change those sections\./,
  );
  // the guide still keeps the marker; the swap isn't an Undo step
  const kept = await page.evaluate(
    ([k, secs]) => {
      const d = __mstest.currentDesignObj();
      return secs.filter((l) => d.payload.assign[l] === k).length;
    },
    [k, secs],
  );
  assert.equal(kept, secs.length);
  assert.equal(await page.evaluate(() => __mstest.assign.planStack.length), n0);
  // marked as having ink again: back in its sections
  await viaMarkers(
    page,
    (k) => {
      delete state.ink[k];
      save();
      chrome();
    },
    k,
  );
  assert.ok((await keysOf(page, secs)).every((x) => x === k));
  assert.deepEqual(errors, []);
});

test('a marker unticked in Markers: "no longer in your collection"; ticked again, it’s back', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  const { k, secs } = await pickMarker(page);
  await viaMarkers(
    page,
    (k) => {
      state.owned.delete(k);
      save();
      chrome();
    },
    k,
  );
  assert.ok((await keysOf(page, secs)).slice(1).every((x) => x !== k));
  assert.match(
    await page.evaluate(() => document.body.innerText),
    /1 marker is no longer in your collection — sections still to colour/,
  );
  // a change after it is one Undo step, its own
  await page.click('#sfMood [data-v="vivid"]');
  await idle(page);
  const st = await page.evaluate(() => __mstest.assign.planStack.map((e) => e.label));
  assert.equal(st[st.length - 1], 'Mood: Bright');
  // the coloured section keeps the marker it's coloured with, through the change
  assert.equal((await keysOf(page, secs))[0], k);
  await page.click('#sfPlanUndo');
  await idle(page);
  await viaMarkers(
    page,
    (k) => {
      state.owned.add(k);
      save();
      chrome();
    },
    k,
  );
  assert.ok((await keysOf(page, secs)).every((x) => x === k));
  assert.deepEqual(errors, []);
});

test('Palette: a locked colour marked dry is unlocked on Generate, with a word', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await welcome(page, 'look');
  await idle(page);
  await page.click('#mPalette');
  await page.click('#draw');
  await idle(page);
  await page.click('#bands .band:nth-child(1) .blk');
  const i = await page.evaluate(() => state.locked[0]);
  // marked dry: unlocked on Generate, said so
  await page.evaluate((i) => {
    state.ink[mkey(i)] = 'dry';
    save();
  }, i);
  await page.click('#draw');
  await idle(page);
  assert.deepEqual(await page.evaluate(() => state.locked), []);
  assert.match(
    await page.textContent('#msToast'),
    new RegExp('^Unlocked ' + (await page.evaluate((i) => COLORS[i].code, i)) + ': it’s marked dry\\.'),
  );
  assert.equal(await page.evaluate((i) => state.palettes[state.palettes.length - 1].includes(i), i), false);
  assert.deepEqual(errors, []);
});

test('Palette: a lock is kept on Generate while its marker is yours and has ink', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await welcome(page, 'look');
  await idle(page);
  await page.click('#mPalette');
  await page.click('#draw');
  await idle(page);
  await page.click('#bands .band:nth-child(1) .blk');
  const i = await page.evaluate(() => state.locked[0]);
  await page.click('#draw');
  await idle(page);
  assert.deepEqual(await page.evaluate(() => state.locked), [i]);
  assert.ok(await page.evaluate((i) => state.palettes[state.palettes.length - 1].includes(i), i));
  assert.deepEqual(errors, []);
});

test('Undo on "Page straightened": "Page kept as photographed · Straighten", on the quick check and the full step', async () => {
  const src = await readFile(join(ROOT, 'e2e', 'straighten.test.mjs'), 'utf8');
  const GEN = src.match(/const GEN = String\.raw`([\s\S]*?)`;/)[1];
  for (const tools of ['0', '1']) {
    const { page, errors, ctx } = await openApp({ storage: { 'ms-sec-tools': tools } });
    await haveSet(page);
    await page.check('#wcSets input[data-i="3"]');
    await page.click('#wcAdd');
    const ph = await page.evaluate(
      async ([g, o]) => {
        eval(g);
        return makePhoto(o);
      },
      [GEN, { tilt: 25, roll: 8, size: 0.6 }],
    );
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#wcPhoto')]);
    await fc.setFiles({ name: 'page.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(ph.b64, 'base64') });
    await page.waitForSelector('#sfPgUndo', { timeout: 40000 });
    await idle(page);
    await page.click('#sfPgUndo');
    await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 40000 });
    await idle(page);
    assert.match(
      await page.textContent('.sfpgline'),
      /Page kept as photographed · Straighten/,
      'tools ' + tools,
    );
    assert.equal(await page.isVisible('#sfPgAdj'), true);
    // (the photo as taken may bring a warning, and with it the full step)
    const warn = await page.evaluate(() => !!(__mstest.segWarn && !__mstest.segWarn.ok));
    assert.equal(!!(await page.$('#sfQuick')), tools === '0' && !warn);
    // Straighten opens the corners again
    await page.click('#sfPgAdj');
    await page.waitForSelector('#sfPgGo');
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});

test('Home’s guide card: the colours guides use, with how many marked dry are left out', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await welcome(page, 'look');
  await idle(page);
  await page.evaluate(() => {
    const ks = [...state.owned].filter((k) => k !== 'Ohuhu|0').slice(0, 2);
    ks.forEach((k) => (state.ink[k] = 'dry'));
    save();
  });
  await page.click('#mCollection');
  await idle(page);
  await page.click('#mHome');
  await idle(page);
  assert.match(
    await page.textContent('#homeCont .hcstart'),
    /Built from your 118 colours \(2 marked dry are left out\)\./,
  );
  assert.deepEqual(errors, []);
});
