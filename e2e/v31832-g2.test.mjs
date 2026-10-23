// v318.32 (G2): Ben's iPad findings — Home features the guide worked on last, started or not; Edit sections after a
// guide is closed and opened again from the Library still offers the crop tools.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, idle, sampleGuide, saveGuide, letterGuide } from './helpers.mjs';

before(setup);
after(teardown);

// an iPad (11-inch class), portrait, with touch
const IPAD = { width: 820, height: 1180, touch: true };
const rect = (page, sel) =>
  page.evaluate((sel) => {
    const e = document.querySelector(sel);
    if (!e || !e.getClientRects().length) return null;
    const r = e.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height };
  }, sel);
// a copy of guide `a` in the Library: prog 'all', 'some' or 'none' ticked, dated `ago` ms back (as v306-home's)
const copyOf = (page, a, id, name, prog, ago) =>
  page.evaluate(
    ([a, id, name, prog, ago]) =>
      IDB.get('guide-' + a).then((pl) => {
        const e = state.saved.find((s) => s.id === a),
          order = Object.keys(pl.assign).map(Number);
        const p = {
          ...pl,
          smp: undefined,
          tones: undefined,
          prog: prog === 'all' ? order : prog === 'some' ? order.slice(0, 5) : [],
        };
        return sfSaveDesign({
          id,
          name,
          W: e.W,
          H: e.H,
          keys: e.keys,
          n: e.n,
          payload: p,
          quiet: true,
          keepTs: true,
          ts: Date.now() - ago,
        });
      }),
    [a, id, name, prog, ago],
  );
const goHome = async (page) => {
  await page.click('#mCollection');
  await idle(page);
  await page.click('#mHome');
  await idle(page);
};
const card = (page) =>
  page.evaluate(() => {
    const c = document.querySelector('#homeCont .hccard[data-gid]');
    if (!c || !c.getClientRects().length) return null;
    const t = (s) => (c.querySelector(s) ? c.querySelector(s).textContent : null);
    return {
      gid: +c.getAttribute('data-gid'),
      cont: c.hasAttribute('data-cont'),
      eb: t('.hceb'),
      name: t('.hcname'),
      meta: t('.hcmeta'),
      go: t('.hcgo'),
      bar: !!c.querySelector('.hcbar'),
      label: c.getAttribute('aria-label'),
    };
  });
const heroName = (page) =>
  page.evaluate(() => {
    const h = document.getElementById('homeHero');
    return h && h.offsetParent && h.querySelector('.hhname') ? h.querySelector('.hhname').textContent : null;
  });

test('1: Home features the guide worked on last, started or not: a guide just built is on the card ("not started", Open → the plan); a newer one beats an older one started; a finished newer one leads as the latest piece', async () => {
  const { page, errors } = await openApp(IPAD);
  await sampleGuide(page);
  await saveGuide(page);
  await letterGuide(page);
  await page.waitForFunction(() => __mstest.inLibrary);
  await idle(page);
  const lid = await page.evaluate(() => __mstest.curId);
  await page.click('#mHome');
  await idle(page);
  // the newest guide, nothing coloured yet, on the card (it was the start card, the guide in Your guides)
  let c = await card(page);
  assert.ok(c, 'a guide on the card');
  assert.equal(c.gid, lid, 'the guide just built');
  assert.equal(c.cont, false, 'not Continue colouring');
  assert.equal(c.eb, 'Your latest guide');
  assert.equal(c.meta, 'not started · today');
  assert.equal(c.go, 'Open');
  assert.equal(c.bar, false, 'no progress bar');
  assert.match(c.label, /^Open your latest guide, .+: not started, saved today$/);
  await page.waitForSelector('#homeCont .hcpic img');
  assert.equal(await page.$('#homeCont .hcstart'), null, 'no start card');
  assert.deepEqual(
    await page.$$eval('#sfRecent .sfRecCard:not([hidden]) .sfRecName', (l) => l.map((x) => x.textContent)),
    ['Sample jellyfish'],
    'Your guides: the others',
  );
  assert.equal(
    await page.evaluate(() => document.getElementById('homeNew').classList.contains('homenew2')),
    true,
    'New colouring guide is the second choice beside it',
  );
  // the card and its Open on screen in both orientations
  for (const [w, h] of [
    [820, 1180],
    [1180, 820],
  ]) {
    await page.setViewportSize({ width: w, height: h });
    await idle(page);
    const go = await rect(page, '#homeCont .hcgo'),
      pic = await rect(page, '#homeCont .hcpic');
    assert.ok(go && go.bottom <= h && go.height >= 44, `${w}: Open on screen: ${JSON.stringify(go)}`);
    assert.ok(pic && pic.width > 80, `${w}: its picture`);
  }
  await page.setViewportSize({ width: 820, height: 1180 });
  await idle(page);
  // tap: the guide opens in the plan, not Colour along
  await page.click('#homeCont .hccard');
  await page.waitForFunction((id) => __mstest.curId === id && !!__mstest.assignData, lid);
  await idle(page);
  assert.equal(await page.evaluate(() => __mstest.sfmode), 'guide', 'the plan');
  // the sample, coloured a little, is older: the newest (not started) still leads
  const sid = await page.evaluate((lid) => state.saved.find((s) => s.type === 'guide' && s.id !== lid).id, lid);
  await copyOf(page, sid, 9301, 'Older started', 'some', 3600e3);
  await goHome(page);
  c = await card(page);
  assert.equal(c.gid, lid, 'the newest guide, not the older one started');
  // the older one started becomes the newest: Continue colouring, as before
  await copyOf(page, sid, 9301, 'Older started', 'some', -1000);
  await goHome(page);
  c = await card(page);
  assert.equal(c.gid, 9301);
  assert.equal(c.cont, true);
  assert.equal(c.eb, 'Continue colouring');
  assert.equal(c.go, 'Continue');
  // a finished guide newer than all: Continue keeps to the one part-way coloured, and no latest piece (as v306 had it)
  await copyOf(page, sid, 9302, 'Newest finished', 'all', -2000);
  await goHome(page);
  assert.equal(await heroName(page), null);
  c = await card(page);
  assert.equal(c && c.gid, 9301, 'Continue keeps to the guide part-way coloured');
  // a finished guide newer than a not-started one, none started: the latest piece, and the start card (as v306 had it)
  await page.evaluate(() => libDelete(9301));
  await goHome(page);
  assert.equal(await heroName(page), 'Newest finished');
  assert.equal(await card(page), null, 'no Continue card');
  assert.ok(await page.isVisible('#homeCont .hcstart'), 'the start card');
  assert.deepEqual(errors, []);
});

// Edit sections' Adjust photo (turn, straighten, crop, enhance, tilt) works on the photo, which a saved guide didn't
// keep before v318.34: a guide opened again from the Library (after another guide, or a reload: the same guide opened
// again straight away is still in memory, with its photo) had lost the whole group without a word
test('2: Edit sections after a guide is opened again from the Library: Adjust photo stays, and says the photo isn’t kept, with the picker for a new guide', async () => {
  const { page, errors } = await openApp(IPAD);
  await sampleGuide(page);
  await saveGuide(page);
  await letterGuide(page);
  await page.waitForFunction(() => __mstest.inLibrary);
  await idle(page);
  const id = await page.evaluate(() => __mstest.curId),
    other = await page.evaluate((id) => state.saved.find((s) => s.type === 'guide' && s.id !== id).id, id),
    adj = () =>
      page.evaluate(() => {
        const t = document.getElementById('sfAdjToggle');
        return {
          toggle: !!t && t.getClientRects().length > 0,
          crop: !!document.getElementById('sfCrop'),
          note: (document.getElementById('sfAdjNone') || {}).textContent || '',
        };
      }),
    openFromLib = async (gid) => {
      await page.click('#mHome');
      await idle(page);
      await page.evaluate(() => openLibrary());
      await idle(page);
      await page.click(`.srow[data-id="${gid}"] button.sopen`);
      await page.waitForFunction((g) => __mstest.curId === g && !!__mstest.assignData && __mstest.sfmode === 'guide', gid);
      await idle(page);
    };
  // as built: the tools
  await page.click('#sfBack2');
  await idle(page);
  if (!(await page.$('#sfCrop'))) await page.click('#sfAdjToggle');
  await idle(page);
  assert.deepEqual(await adj(), { toggle: true, crop: true, note: '' });
  // another guide, then this one again from the Library: opened from its stored copy
  // (v318.34: a guide saved since keeps its picture, so the tools come back once it's read, e2e/v31834-source-photo;
  // this is the guide without one: saved before v318.34, or its picture couldn't be kept)
  await page.evaluate((id) => IDB.del('src-' + id), id);
  await openFromLib(other);
  await openFromLib(id);
  await page.click('#sfBack2');
  await idle(page);
  let a = await adj();
  assert.ok(a.toggle, 'Adjust photo still there');
  if (!a.note) await page.click('#sfAdjToggle');
  await idle(page);
  // (v318.34: the record is looked for first; the note once it's found missing)
  await page.waitForSelector('#sfAdjNone');
  a = await adj();
  assert.equal(a.crop, false, 'no Crop: there is no photo to crop');
  assert.match(a.note, /^The photo isn’t kept with a saved guide, so this one can’t be turned, straightened or cropped again\./);
  assert.ok((await rect(page, '#sfRetake')).height >= 44, 'Choose the photo again, a full tap, in the note');
  // its link opens the picker, in the tap
  const [fc] = await Promise.all([page.waitForEvent('filechooser', { timeout: 5000 }), page.click('#sfRetake')]);
  assert.ok(fc);
  // the sections are still editable and the guide as it was
  assert.ok(await page.isVisible('#sfEmMerge'));
  assert.equal(await page.evaluate(() => __mstest.curId), id);
  assert.deepEqual(errors, []);
});
