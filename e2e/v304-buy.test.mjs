// v304, Brands I'd buy (Markers, under Add a set you own and Scan or type codes, and in To buy): which brands a
// marker to buy is suggested from in Match, a guide's shading and blend plan and the Photo pattern. Your brands first
// (as before) or only the brands ticked; kept, and said in Match's heading when it leaves a brand out.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, idle, sampleGuide } from './helpers.mjs';

before(setup);
after(teardown);

const KEY = 'ohuhu-hb320-picker-v3';
const OWN = ['Ohuhu|R014', 'Ohuhu|Y111', 'Ohuhu|B08', 'Ohuhu|G36', 'Ohuhu|BV310', 'Ohuhu|YR313', 'Ohuhu|RV08', 'Ohuhu|BG311'];
const storage = (extra = {}) => ({ 'ms-onboarded': '1', 'ms-setup-tip': '1', 'ms-last-ver': 'v304', [KEY]: JSON.stringify({ mode: 'collection', collView: 'owned', ownedSeedV: 2, copicAdd1: 1, libAdj1: 1, setFix1: 1, owned: OWN, saved: [], ...extra }) });
const sum = (page) => page.textContent('#buySum');

test('the row says what’s chosen; Only these starts from your brands; no brand ticked can’t be kept; Done keeps it through a reload; Escape keeps it too', async () => {
  for (const [w, h] of [[820, 1180], [390, 844]]) {
    const { page, errors, ctx } = await openApp({ width: w, height: h, storage: storage() });
    await idle(page);
    assert.equal((await sum(page)).trim(), 'Your brands first');
    await page.click('#buyOpen'); await idle(page);
    assert.equal(await page.isVisible('#buyChips'), false, 'no brands to tick while it’s your brands first');
    assert.match(await page.textContent('#buyNote'), /^Ohuhu first, as you have that brand\./);
    await page.click('#buyMode [data-m="pick"]'); await idle(page);
    assert.deepEqual(await page.$$eval('#buyChips .chip[data-sel="1"]', (b) => b.map((x) => x.dataset.b)), ['Ohuhu'], 'your brand');
    await page.click('#buyChips [data-b="Ohuhu"]'); await idle(page);
    assert.equal(await page.isDisabled('#buyDone'), true);
    assert.match(await page.textContent('#buyNote'), /Tick at least one brand/);
    await page.click('#buyChips [data-b="Copic"]'); await idle(page);
    await page.click('#buyDone'); await idle(page);
    assert.equal((await sum(page)).trim(), 'Copic');
    assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.id), 'buyOpen', 'focus back on the row');
    // no sideways scroll on a phone
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.reload(); await idle(page);
    assert.equal((await sum(page)).trim(), 'Copic');
    // Escape closes and keeps what's chosen
    await page.click('#buyOpen'); await idle(page);
    await page.click('#buyMode [data-m="auto"]'); await idle(page);
    await page.keyboard.press('Escape'); await idle(page);
    assert.equal(await page.isVisible('#buyOverlay'), false);
    assert.equal((await sum(page)).trim(), 'Your brands first');
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('ohuhu-hb320-picker-v3')).buyBrands), null);
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});

test('Match: with only Copic ticked an Ohuhu collection is offered Copic markers to buy, under a heading that says so; To buy has the row too', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, storage: storage({ buyBrands: ['Copic'] }) });
  await idle(page);
  await page.click('#mkMatchBtn'); await idle(page);
  await page.click('.msrc [data-src="hex"]'); await page.fill('#matchHex', '#40e0d0'); await idle(page);
  const heads = await page.$$eval('#matchResult .mlh', (l) => l.map((h) => h.textContent));
  assert.ok(heads.includes('Closer ones you could buy · Copic'), heads.join(' | '));
  const buy = await page.$$eval('#matchResult .mrow.buy', (r) => r.map((x) => x.textContent));
  assert.ok(buy.length >= 1);
  assert.equal(await page.evaluate(() => matchNearest(hexToLab('#40e0d0')).buy.every((o) => COLORS[o.i].brand === 'Copic')), true);
  await page.click('#matchClose'); await idle(page);
  await page.click('#ownView [data-v="wish"]'); await idle(page);
  assert.equal((await page.textContent('#wishView .buyopen .buysum')).trim(), 'Copic');
  await page.click('#wishView .buyopen'); await idle(page);
  assert.equal(await page.isVisible('#buyOverlay'), true);
  assert.deepEqual(errors, []);
});

test('a guide: shading’s markers to buy and the blend plan’s come from the brands ticked, else the base marker’s own brand', async () => {
  const { page, errors } = await openApp({ width: 1180, height: 820 });
  await sampleGuide(page);
  // (an Ohuhu-only collection of 8)
  await page.evaluate((own) => { state.owned = new Set(own); state.buyBrands = null; save(); SF.setCollection(sfCollection()); }, OWN);
  const brands = () => page.evaluate(() => {
    const t = __mstest, base = t.coll.find((m) => m.brand === 'Ohuhu' && m.code === 'B08') || t.coll[0];
    const out = new Set(), c = t.colour ? t.colour.companions(base) : null;
    const z = t.shadeTones(base, { hilite: 'lighter', shadow: 'darker', hi: 0.5, lo: 0.5 });
    if (z.wantDark) out.add('S:' + z.wantDark.brand);
    if (z.wantLight) out.add('H:' + z.wantLight.brand);
    if (c && c.light && !c.lightOwned) out.add('L:' + c.light.brand);
    if (c && c.dark && !c.darkOwned) out.add('D:' + c.dark.brand);
    return [...out].sort();
  });
  const auto = await brands();
  assert.ok(auto.length >= 1, 'something to buy for B08 with 8 markers');
  assert.ok(auto.filter((x) => /^[SH]:/.test(x)).every((x) => x.endsWith('Ohuhu')), 'shading: the base’s brand ' + auto);
  await page.evaluate(() => { state.buyBrands = ['Copic']; save(); SF.setCollection(sfCollection()); });
  const cop = await brands();
  assert.ok(cop.length >= 1 && cop.every((x) => x.endsWith('Copic')), cop.join());
  assert.deepEqual(errors, []);
});

test('closing with no brand ticked keeps what was kept before; a Colorless Blender alone doesn’t make a brand yours; Match’s heading follows a change made in another tab', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, storage: storage({ buyBrands: ['Copic'], owned: OWN.concat(['Copic|0']) }) });
  await idle(page);
  await page.click('#buyOpen'); await idle(page);
  await page.click('#buyChips [data-b="Copic"]'); await idle(page);
  await page.keyboard.press('Escape'); await idle(page);
  assert.equal(await page.evaluate(() => JSON.stringify(state.buyBrands)), '["Copic"]', 'not switched to automatic');
  await page.click('#buyOpen'); await idle(page);
  await page.click('#buyMode [data-m="auto"]'); await idle(page);
  assert.match(await page.textContent('#buyNote'), /^Ohuhu first, as you have that brand\./, 'the blender’s brand isn’t counted');
  await page.click('#buyMode [data-m="pick"]'); await idle(page);
  assert.deepEqual(await page.$$eval('#buyChips .chip[data-sel="1"]', (b) => b.map((x) => x.dataset.b)), ['Ohuhu']);
  await page.click('#buyClose'); await idle(page);
  // Match open; another tab ticks only Ohuhu: the heading says so at the next colour, even with the same markers
  await page.click('#mkMatchBtn'); await idle(page);
  await page.click('.msrc [data-src="hex"]'); await page.fill('#matchHex', '#ff8800'); await idle(page);
  await page.evaluate(() => { state.buyBrands = ['Ohuhu']; });
  await page.fill('#matchHex', '#ff8801'); await idle(page);
  const heads = await page.$$eval('#matchResult .mlh', (l) => l.map((h) => h.textContent));
  assert.ok(heads.includes('Closer ones you could buy · Ohuhu'), heads.join(' | '));
  assert.deepEqual(errors, []);
});

test('a guide open while another tab changes Brands I’d buy: its shading’s markers to buy follow at once, without laying the guide again', async () => {
  const { page, errors } = await openApp({ width: 1180, height: 820 });
  await sampleGuide(page);
  await page.evaluate((own) => { state.owned = new Set(own); state.buyBrands = null; save(); SF.setCollection(sfCollection()); }, OWN);
  await page.click('.sftabbtn[data-t="shading"]');
  await page.click('#sfShade [data-v="full"]'); await idle(page);
  const panel = () => page.evaluate(() => document.getElementById('sfRoot').textContent);
  const lay = await page.evaluate(() => JSON.stringify(__mstest.assignData.assign));
  const before = await panel();
  // the other tab: only Copic, written to storage, and the storage event this tab gets
  await page.evaluate(() => {
    const k = 'ohuhu-hb320-picker-v3', v = JSON.parse(localStorage.getItem(k));
    v.buyBrands = ['Copic'];
    localStorage.setItem(k, JSON.stringify(v));
    dispatchEvent(new StorageEvent('storage', { key: k }));
  });
  await idle(page);
  assert.deepEqual(await page.evaluate(() => state.buyBrands), ['Copic']);
  const after = await panel();
  assert.notEqual(after, before, 'the shading panel was drawn again');
  // what it now offers to buy is Copic's
  const want = await page.evaluate(() => { const t = __mstest, out = new Set(); [...new Map(Object.values(t.assignData.assign).map((m) => [m.mkey, m])).values()].forEach((m) => { const z = t.shadeTones(m, { hilite: 'lighter', shadow: 'darker', hi: 0.5, lo: 0.5 }); [z.wantDark, z.wantLight].forEach((w) => w && out.add(w.brand + ' ' + w.code)); }); return [...out]; });
  assert.ok(want.length && want.every((x) => x.startsWith('Copic ')), want.join());
  assert.ok(want.some((x) => after.includes(x.split(' ')[1])), 'a Copic code in the panel');
  assert.equal(await page.evaluate(() => JSON.stringify(__mstest.assignData.assign)), lay, 'nothing laid again');
  assert.deepEqual(errors, []);
});
