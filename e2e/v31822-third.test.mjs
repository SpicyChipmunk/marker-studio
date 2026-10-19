// v318.22, the third debugging pass, in the browser: Colour along keeps the open row clear of Mark all's toast;
// Tick colours on a chart asks before its ticks are thrown away; Undo of a zone's first sections in its editor keeps
// the editor, and after Done takes the empty zone away; a section coloured with a dry marker's stand-in, or pinned to a
// marker gone dry, is saved as it is on the paper; the keyboard kept off the page (To buy, Full screen); the Also: line
// of a family; Tester answers given in two tabs. Each fails on v318.22's first build (68199d0).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  setup,
  teardown,
  openApp,
  idle,
  sampleGuide,
  saveGuide,
  sectionPoint,
  scrollTop,
  welcome,
} from './helpers.mjs';

before(setup);
after(teardown);

const R = (b) => ({ l: b.left, t: b.top, r: b.right, b: b.bottom });
const over = (a, b) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
async function tapSec(page, l) {
  const p = await sectionPoint(page, l);
  await page.mouse.click(p.x, p.y);
  await idle(page);
}

for (const [w, h] of [
  [820, 1180],
  [390, 844],
]) {
  test(`${w}×${h}: Mark all on the last marker of Colour along: its toast’s Undo is not over the row’s own buttons`, async () => {
    const { page, errors } = await openApp({ width: w, height: h });
    await sampleGuide(page);
    await idle(page);
    await page.click('#sfColor');
    await idle(page);
    await page.$$eval('#sfAlist .sfarow .sfah', (bs) => bs[bs.length - 1].click());
    await idle(page, 600);
    await page.click('#sfMarkAll');
    await page.waitForSelector('#msToast.on');
    await idle(page, 200);
    const g = await page.evaluate(() => ({
      undo: document.querySelector('#msToast button').getBoundingClientRect().toJSON(),
      btns: [...document.querySelectorAll('#sfAlist .sfarow.open .sfacts button')].map((b) =>
        b.getBoundingClientRect().toJSON(),
      ),
    }));
    assert.ok(g.btns.length >= 2);
    assert.ok(!g.btns.some((b) => over(R(g.undo), R(b))), JSON.stringify(g));
    assert.deepEqual(errors, []);
  });
}

test('Tick colours on a chart: a tap beside the card, or Escape, with ticks not saved asks first; Keep ticking keeps them', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await welcome(page, 'look');
  const n0 = await page.evaluate(() => state.owned.size);
  await page.evaluate(() => openChart());
  await page.waitForSelector('#chartOverlay.on');
  await page.click('#chGrid .chsw[aria-pressed="false"]');
  await page.mouse.click(30, 600);
  await idle(page);
  assert.ok(await page.$('#sfEdAsk'), 'asked');
  await page.click('#sfEdAsk [data-a="stay"]');
  await idle(page);
  assert.ok(await page.isVisible('#chartOverlay.on'));
  assert.match(await page.textContent('#chSave'), /^Add 1 marker$/);
  await page.keyboard.press('Escape');
  await idle(page);
  assert.ok(await page.$('#sfEdAsk'), 'Escape asks too');
  await page.click('#sfEdAsk [data-a="drop"]');
  await idle(page);
  assert.equal(await page.isVisible('#chartOverlay.on'), false);
  assert.equal(await page.evaluate(() => state.owned.size), n0, 'nothing added');
  // (with nothing changed it closes at once)
  await page.evaluate(() => openChart());
  await page.waitForSelector('#chartOverlay.on');
  await page.mouse.click(30, 600);
  await idle(page);
  assert.equal(await page.$('#sfEdAsk'), null);
  assert.equal(await page.isVisible('#chartOverlay.on'), false);
  assert.deepEqual(errors, []);
});

test('a zone: Undo of a mis-tap in its editor keeps the editor; after Done, Undo of its first sections takes the empty zone away, Redo brings it back', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await idle(page);
  await page.click('.sftabbtn[data-t="pattern"]');
  await idle(page);
  const Z = () =>
    page.evaluate(() => ({
      edit: __mstest.zoneEdit,
      n: __mstest.zones.map((z) => Object.keys(z.secs).length),
    }));
  await page.click('#sfZoneAdd');
  await idle(page);
  const [a, b] = await page.evaluate(() => {
    const t = __mstest;
    return t.assignData.order
      .slice()
      .sort((x, y) => t.comps[y].area - t.comps[x].area)
      .slice(0, 2);
  });
  await scrollTop(page);
  await tapSec(page, a);
  await page.click('#sfPlanUndo');
  await idle(page);
  assert.deepEqual(await Z(), { edit: true, n: [0] }, 'the editor stays on the zone being made');
  await tapSec(page, a);
  await tapSec(page, b);
  await page.click('#sfZoneDone');
  await idle(page);
  await page.click('#sfPlanUndo');
  await idle(page);
  await page.click('#sfPlanUndo');
  await idle(page);
  assert.deepEqual(await Z(), { edit: false, n: [] }, 'no empty zone left');
  await page.click('#sfPlanRedo');
  await idle(page);
  await page.click('#sfPlanRedo');
  await idle(page);
  assert.deepEqual(await Z(), { edit: false, n: [2] });
  assert.deepEqual(errors, []);
});

test('a marker gone dry: a section coloured with its stand-in is saved as the stand-in; one pinned to it keeps its pin’s marker', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await idle(page);
  await saveGuide(page);
  const K = 'Ohuhu|R413';
  const secs = await page.evaluate((k) => {
    const t = __mstest;
    return t.assignData.order
      .filter((l) => t.assignData.assign[l].mkey === k)
      .sort((a, b) => t.comps[b].area - t.comps[a].area);
  }, K);
  assert.ok(secs.length >= 2);
  const [P, L] = secs;
  // (pinned to R413 first)
  await scrollTop(page);
  await tapSec(page, P);
  await page.click('.sftip [data-a="pin"]');
  await idle(page);
  await page.mouse.click(5, 5);
  await idle(page);
  await page.evaluate((k) => setInk(keyIdx(k), 'dry'), K);
  await idle(page);
  const shown = await page.evaluate((l) => __mstest.assignData.assign[l].mkey, L);
  assert.notEqual(shown, K, 'a stand-in shown');
  await page.click('#sfColor');
  await idle(page);
  await scrollTop(page);
  await tapSec(page, L);
  assert.equal(await page.evaluate((l) => !!__mstest.colored[l], L), true);
  const d = await page.evaluate(() => JSON.parse(JSON.stringify(__mstest.currentDesignObj().payload)));
  assert.equal(d.assign[L], shown, 'coloured with the stand-in: saved as it');
  assert.equal(d.assign[P], K, 'pinned: saved as the marker pinned');
  assert.deepEqual(errors, []);
});

test('a zone emptied by another zone’s editor and kept stays through Undo and Redo of other steps', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await idle(page);
  await page.click('.sftabbtn[data-t="pattern"]');
  await idle(page);
  const [a, b] = await page.evaluate(() => {
    const t = __mstest;
    return t.assignData.order
      .slice()
      .sort((x, y) => t.comps[y].area - t.comps[x].area)
      .slice(0, 2);
  });
  await scrollTop(page);
  // (Zone 1 with a; Zone 2 takes a from it; Done keeps Zone 1, now empty)
  await page.click('#sfZoneAdd');
  await idle(page);
  await tapSec(page, a);
  await page.click('#sfZoneDone');
  await idle(page);
  // (with a zone, ＋ is a chip of its own)
  await page.click('#sfPanel-pattern .sfzchip[data-z="new"]');
  await idle(page);
  await tapSec(page, b);
  await tapSec(page, a);
  await page.click('#sfZoneDone');
  await idle(page);
  const z = () => page.evaluate(() => __mstest.zones.map((x) => x.name + ':' + Object.keys(x.secs).length));
  assert.deepEqual(await z(), ['Zone 1:0', 'Zone 2:2']);
  await page.click('#sfPlanUndo');
  await idle(page);
  await page.click('#sfPlanRedo');
  await idle(page);
  assert.deepEqual(await z(), ['Zone 1:0', 'Zone 2:2'], 'kept');
  assert.deepEqual(errors, []);
});

test('a section pinned to a dry marker’s stand-in keeps it when the marker is refilled', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await idle(page);
  const K = 'Ohuhu|R413';
  const P = await page.evaluate((k) => {
    const t = __mstest;
    return t.assignData.order
      .filter((l) => t.assignData.assign[l].mkey === k)
      .sort((a, b) => t.comps[b].area - t.comps[a].area)[0];
  }, K);
  await page.evaluate((k) => setInk(keyIdx(k), 'dry'), K);
  await idle(page);
  const stand = await page.evaluate((l) => __mstest.assignData.assign[l].mkey, P);
  assert.notEqual(stand, K);
  await scrollTop(page);
  await tapSec(page, P);
  await page.click('.sftip [data-a="pin"]');
  await idle(page);
  await page.mouse.click(5, 5);
  await idle(page);
  await page.evaluate((k) => setInk(keyIdx(k), null), K);
  await idle(page);
  assert.equal(
    await page.evaluate((l) => __mstest.assignData.assign[l].mkey, P),
    stand,
    'the pinned stand-in stays',
  );
  assert.deepEqual(errors, []);
});

test('Tick colours on a chart: two swatches of a family with one code, the older cap’s marked *', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await welcome(page, 'look');
  await page.evaluate(() => {
    state.capDef = 'old';
    state.owned = new Set(['Ohuhu|R23']);
    state.cap = { 'Ohuhu|R23': 'new' };
    save();
    openChart();
  });
  await page.waitForSelector('#chartOverlay.on');
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('#chFams button')].find((x) => x.dataset.f === 'Red');
    if (b) b.click();
  });
  await idle(page);
  const labs = await page.$$eval('#chGrid .chsw span', (s) =>
    s.map((x) => x.textContent).filter((t) => /^R23\*?$/.test(t)),
  );
  assert.deepEqual(labs.sort(), ['R23', 'R23*']);
  assert.deepEqual(errors, []);
});

test('the keyboard: Full screen keeps to the picture and gives the keyboard back; To buy’s Bought ✓ leaves it on the next row', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await idle(page);
  await page.focus('#sfFull');
  await page.keyboard.press('Enter');
  await idle(page);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'sfFullX');
  // (Tab goes round what full screen shows: the guide's header, reached behind it as before, and the picture's own
  // controls; never the Plan's hidden under it, nor nowhere)
  const seen = new Set();
  for (let k = 0; k < 12; k++) {
    await page.keyboard.press('Tab');
    const w = await page.evaluate(() => {
      const a = document.activeElement;
      return {
        id: a.id,
        ok: document.getElementById('sfView').contains(a) || document.getElementById('sfHead').contains(a),
      };
    });
    assert.ok(w.ok && w.id, 'Tab ' + k + ' on ' + JSON.stringify(w));
    seen.add(w.id);
  }
  assert.ok(seen.size >= 5, [...seen].join(' '));
  assert.ok(seen.has('sfFullX') && seen.has('sfZin'), [...seen].join(' '));
  await page.keyboard.press('Escape');
  await idle(page);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'sfFull');
  // To buy
  await page.evaluate(() => {
    state.wish = ['Ohuhu|Y26', 'Ohuhu|G36', 'Ohuhu|B115'].map((k) => ({ k: k, t: 1 }));
    save();
  });
  await page.click('#mCollection');
  await idle(page);
  await page.click('#ownView [data-v="wish"]');
  await idle(page);
  await page.focus('#wishView [data-bought]');
  await page.keyboard.press('Enter');
  await idle(page);
  const f = await page.evaluate(() => [
    document.activeElement.tagName,
    document.activeElement.dataset.bought || '',
  ]);
  assert.notEqual(f[0], 'BODY');
  assert.ok(f[1], 'on a Bought ✓: ' + f.join(' '));
  assert.deepEqual(errors, []);
});

test('Markers: “Also: the … family” shows that family only, though another was chosen before', async () => {
  const { page, errors } = await openApp();
  await welcome(page, 'look');
  await page.click('#mCollection');
  await idle(page);
  await page.click('#ownView [data-v="all"]');
  await idle(page);
  await page.evaluate(() => {
    fgTap('fam', 'Red');
    fgTap('fam', 'Blue');
    filterChanged();
  });
  await page.fill('#q', 'red');
  await idle(page);
  const go = await page.$('.mkfamgo');
  assert.ok(go, 'the line is offered');
  const fams = await go.getAttribute('data-fams');
  await go.click();
  await idle(page);
  const on = await page.evaluate(() => [...FG.fam.get()]);
  assert.deepEqual(on.sort(), fams.split('|').sort());
  assert.deepEqual(errors, []);
});

test('Tester answers given in two tabs: neither tab’s write loses the other’s', async () => {
  const { page, ctx, errors } = await openApp();
  const t1 = { id: 'TABC', name: '', t: { add: { r: 'easy', n: '', v: '' } }, q: {}, sends: 0, sig: '' };
  await page.evaluate((o) => localStorage.setItem('ms-tester', JSON.stringify(o)), t1);
  await page.reload();
  await idle(page);
  const p2 = await ctx.newPage();
  await p2.goto(page.url());
  await idle(p2);
  // (each tab has read the answers: as when the tasks were shown in each)
  await page.evaluate(() => testerBackup());
  await p2.evaluate(() => testerBackup());
  await page.evaluate(() =>
    testerRestore({ id: 'TABC', t: { guide: { r: 'hard', n: 'lost my place', v: '' } } }),
  );
  await idle(p2);
  await p2.evaluate(() => testerRestore({ id: 'TABC', t: { plan: { r: 'ok', n: '', v: '' } } }));
  const t = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('ms-tester')).t).sort());
  assert.deepEqual(t, ['add', 'guide', 'plan']);
  assert.deepEqual(errors, []);
});
