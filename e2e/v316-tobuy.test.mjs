// v316: To buy's "From your guides" — the markers your saved guides' blend plans would ask you to buy, across the
// Library without opening a guide, each with the plan's reason and how many guides want it, and the markers a guide
// uses that are dry; a tap adds one, Add all the rest. After your own list, above Brands I'd buy. Fails on v315.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, idle, welcome, letterGuide, answerAsks } from './helpers.mjs';

before(setup);
after(teardown);

async function withGuide(page) {
  await welcome(page, 'look');
  await idle(page);
  await page.click('#mSections');
  await idle(page);
  await letterGuide(page);
  await answerAsks(page);
  await page.click('#mCollection');
  await idle(page);
}
// a collection, then To buy shown again
const own = (page, set) =>
  page.evaluate((set) => {
    state.owned = set === 'ben' ? defaultOwned() : new Set(presetMkeys(MARKER_SETS.find((p) => p.n === set)));
    save();
    fullRender();
  }, set);
const toBuy = async (page) => {
  await page.click('#ownView [data-v="wish"]');
  await idle(page);
};
const rows = (page) =>
  page.$$eval('.gbuy .gbrow', (a) =>
    a.map((r) => ({
      k: r.querySelector('[data-wk]').dataset.wk,
      why: r.querySelector('.gbwhy').textContent,
    })),
  );

test('no guides: no card; your markers with a guide: every blend complete, nothing to buy', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await welcome(page, 'look');
  await idle(page);
  await page.click('#mCollection');
  await toBuy(page);
  assert.equal(await page.$('.gbuy'), null, 'no guides');
  await page.click('#mSections');
  await idle(page);
  await letterGuide(page);
  await answerAsks(page);
  await page.click('#mCollection');
  await own(page, 'ben');
  await toBuy(page);
  assert.match(await page.textContent('.gbuy.ok'), /Every blend in your guide is complete/);
  assert.deepEqual(errors, []);
});

test('a 24-marker set: the blend plan’s markers to buy with its reasons; one added with its reason, then all; a dry marker the guide uses', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await withGuide(page);
  await own(page, 'Honolulu 24');
  await toBuy(page);
  // the rows are what the guide's own markers want, as its plan finds them
  const want = await page.evaluate(() => {
    const g = state.saved.find((s) => s.type === 'guide');
    return Object.keys(SF.guideWants(g.keys, g.fr, sfCollection(), {}).want).sort();
  });
  const r = await rows(page);
  assert.ok(want.length >= 2, 'wants: ' + want.length);
  assert.deepEqual(r.map((x) => x.k).sort(), want);
  for (const x of r) assert.match(x.why, /^(Lighter|Darker) than .+ · your guide$/);
  assert.match(
    await page.textContent('.gbsum'),
    new RegExp('^' + want.length + ' markers would complete every blend in your guide\\.$'),
  );
  // one added: on the list with the plan's reason, out of the card
  await page.click('.gbuy .gbrow [data-wk]');
  await idle(page);
  const w = await page.evaluate(() => state.wish.map((x) => x.why));
  assert.equal(w.length, 1);
  assert.match(w[0], /^blend for \S+$/);
  assert.equal((await rows(page)).length, want.length - 1);
  assert.match(await page.textContent('.gbsum'), /· 1 on your list\.$/);
  // the card after the list and Copy list, above Brands I'd buy
  const at = await page.evaluate(() => ({
    acts: document.querySelector('.wishacts').getBoundingClientRect().bottom,
    card: document.querySelector('.gbuy').getBoundingClientRect().top,
  }));
  assert.ok(at.card >= at.acts, 'after Copy list');
  await page.click('.gbuy .wishall');
  await idle(page);
  assert.equal(await page.evaluate(() => state.wish.length), want.length);
  assert.match(await page.textContent('.gbuy.ok'), /all on your list/);
  // a marker the guide uses, now marked dry (still yours, but left out of plans): offered for a refill
  const k = await page.evaluate(() => {
    const g = state.saved.find((s) => s.type === 'guide'),
      k = g.keys.find((x) => state.owned.has(x));
    state.ink[k] = 'dry';
    save();
    fullRender();
    return k;
  });
  await idle(page);
  const d = (await rows(page)).find((x) => x.k === k);
  assert.ok(d, 'the dry marker offered');
  assert.equal(d.why, 'Dry · your guide uses it');
  assert.deepEqual(errors, []);
});

test('a phone: the card after your list, every reason under its marker; a row saved before v316 (no rule) still read', async () => {
  const { page, errors } = await openApp({ width: 390, height: 844 });
  await withGuide(page);
  await page.evaluate(() => {
    const g = state.saved.find((s) => s.type === 'guide');
    delete g.fr;
    state.wish = [];
    save();
  });
  await own(page, 'Honolulu 24');
  await toBuy(page);
  assert.ok((await rows(page)).length >= 2);
  const lay = await page.$$eval('.gbuy .gbrow', (a) =>
    a.map(
      (r) =>
        r.querySelector('.gbwhy').getBoundingClientRect().top -
        r.querySelector('.gbwho').getBoundingClientRect().bottom,
    ),
  );
  for (const g of lay) assert.ok(g >= 0, 'reason under its chip: ' + g);
  assert.deepEqual(errors, []);
});

test('the card asks for what the guide’s own blend plan asks for, its stand-ins’ companions included (markers it was planned with that aren’t yours now)', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await withGuide(page);
  await own(page, 'Honolulu 24');
  await toBuy(page);
  const card = (await rows(page)).map((x) => x.k).sort();
  // the guide, open again with the smaller set: its plan's "To complete every blend, add …"
  await page.click('#mSections');
  await idle(page);
  await page.click('#sfTab-share');
  await idle(page);
  await page.click('#sfPlan');
  await idle(page);
  const plan = (await page.$$eval('#sfPlanBuy [data-wk]', (a) => a.map((b) => b.dataset.wk))).sort();
  assert.ok(plan.length >= 2, 'the plan asks for ' + plan.length);
  assert.deepEqual(card, plan);
  assert.deepEqual(errors, []);
});
