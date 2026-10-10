// v309.1 (review 3): Tick colours on a chart. On a phone on its side the foot (Save) is in the card; the chosen
// family's chip is in view after a brand switch and when the chart opens again; each family's dot is a colour of its
// own, not a pale tint (Copic's Cool Grey was white, its Green cream).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, idle, chartFromMarkers } from './helpers.mjs';

before(setup);
after(teardown);

const ST = (owned) => ({
  'ms-onboarded': '1',
  'ms-setup-tip': '1',
  'ohuhu-hb320-picker-v3': JSON.stringify({
    mode: 'collection',
    ownedSeedV: 2,
    copicAdd1: 1,
    libAdj1: 1,
    setFix1: 1,
    owned,
    saved: [],
  }),
});

test('a phone on its side (844×390): Save stays in the card while the swatches scroll, and saves', async () => {
  const { page, errors } = await openApp({ width: 844, height: 390, storage: ST(['Ohuhu|R014']) });
  await idle(page);
  await chartFromMarkers(page);
  await idle(page);
  const inCard = () =>
    page.evaluate(() => {
      const c = document.querySelector('.chcard').getBoundingClientRect(),
        s = document.getElementById('chSave').getBoundingClientRect(),
        x = s.left + s.width / 2,
        y = s.top + s.height / 2,
        hit = document.elementFromPoint(x, y);
      return s.top >= c.top && s.bottom <= c.bottom && !!hit && !!hit.closest('#chSave');
    });
  assert.ok(await inCard(), 'Save in the card, nothing over it');
  for (const top of [200, 99999]) {
    await page.evaluate((t) => {
      document.querySelector('.chcard').scrollTop = t;
    }, top);
    await idle(page);
    assert.ok(await inCard(), 'Save in view, scrolled to ' + top);
  }
  await page.click('#chGrid .chsw >> nth=-1');
  assert.equal(await page.textContent('#chSave'), 'Add 1 marker');
  await page.click('#chSave');
  await idle(page);
  assert.equal(await page.evaluate(() => state.owned.size), 2);
  assert.deepEqual(errors, []);
});

test('the chosen family’s chip is in view after a brand switch and when the chart opens again', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, storage: ST(['Ohuhu|R014']) });
  await idle(page);
  await chartFromMarkers(page);
  await idle(page);
  const chip = () =>
    page.evaluate(() => {
      const row = document.getElementById('chFams'),
        c = row.querySelector('[aria-pressed="true"]'),
        r = row.getBoundingClientRect(),
        b = c.getBoundingClientRect();
      return { f: c.dataset.f, seen: b.left >= r.left && b.right <= r.right };
    });
  // the last family, the row scrolled to its end
  await page.evaluate(() => {
    document.getElementById('chFams').scrollLeft = 1e5;
  });
  await page.click('#chFams .chfam >> nth=-1');
  await idle(page);
  assert.deepEqual(await chip(), { f: 'Fluorescent', seen: true });
  await page.click('#chBrand [data-b="Copic"]');
  await idle(page);
  assert.deepEqual(await chip(), { f: 'Red', seen: true }, 'Copic: Red, in view');
  await page.click('#chFams .chfam >> nth=-1');
  await page.keyboard.press('Escape');
  await idle(page);
  await chartFromMarkers(page);
  await idle(page);
  assert.deepEqual(await chip(), { f: 'Red', seen: true }, 'opened again: Red, in view');
  assert.deepEqual(errors, []);
});

test('each family’s dot is one of its own markers, of middle lightness: no white or cream dots', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, storage: ST([]) });
  await idle(page);
  const dots = await page.evaluate(() => {
    const out = [];
    for (const b of ['Ohuhu', 'Copic'])
      chartFams(b).forEach((f) => {
        const i = f.idxs.find((j) => COLORS[j].hex === f.dot);
        out.push({ b, f: f.name, ok: i != null, l: i == null ? -1 : +HS[i].l.toFixed(2) });
      });
    return out;
  });
  for (const d of dots) {
    assert.ok(d.ok, d.b + ' ' + d.f + ': one of its markers');
    if (d.f === 'Neutral / Black') continue;
    assert.ok(d.l >= 0.3 && d.l <= 0.75, d.b + ' ' + d.f + ' dot of middle lightness, not ' + d.l);
  }
  assert.deepEqual(errors, []);
});
