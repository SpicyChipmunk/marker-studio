// Zones.
// (v320) Tests organised by feature: each block below came from the file named above it, its tests unchanged.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  answerAsks,
  buildGo,
  idle,
  openApp,
  sampleGuide,
  saveGuide,
  scrollTop,
  sectionPoint,
  setup,
  teardown,
} from './helpers.mjs';

before(setup);
after(teardown);

// ---- from zones-colouring.test.mjs ----
// Zones (v282): Paint and Manual change only the zone the tabs are editing; focus mode's Colours sheet has a chip for
// each marker in each zone when Colour along goes zone by zone; and a zone's sections can be chosen by keyboard.
{
  // a zone of the sections in the picture's bottom part (cy past `from` of its height), made in the editor and the
  // sections moved in one go
  async function bottomZone(page, name, from = 0.6) {
    await page.click('.sftabbtn[data-t="pattern"]');
    await idle(page);
    if (await page.$('#sfZoneAdd')) await page.click('#sfZoneAdd');
    else await page.click('#sfPanel-pattern .sfzchip.sfzadd');
    await idle(page);
    await page.fill('#sfZoneName', name);
    await page.press('#sfZoneName', 'Enter');
    await page.evaluate((from) => {
      const t = __mstest,
        cl = Object.keys(t.assignData.assign)
          .map(Number)
          .filter((l) => t.comps[l].cy > t.H * from);
      t.zoneMove(cl, t.zoneCur);
      t.reassign([0, t.zoneCur]);
    }, from);
    await page.click('#sfZoneDone');
    await idle(page);
    return page.evaluate(() => __mstest.zoneCur);
  }
  const assigns = (page) =>
    page.evaluate(() => {
      const t = __mstest,
        o = {};
      for (const l in t.assignData.assign) o[l] = t.assignData.assign[l].mkey;
      return o;
    });
  const toastText = (page) =>
    page.evaluate(() => {
      const t = document.getElementById('msToast');
      return t ? t.textContent : '';
    });
  test('Paint in a zone colours only its sections, and says how many in other zones it left; Manual’s tap on another zone’s section gives its tip', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    const zid = await bottomZone(page, 'Tail');
    await page.click('#sfFam [data-v="manual"]');
    await idle(page);
    const before = await assigns(page);
    await page.click('#sfPaint');
    await idle(page);
    const k = await page.evaluate(() => __mstest.paintKey);
    assert.ok(k);
    await scrollTop(page);
    // down the middle of the whole picture: through Main and Tail
    const c = await page.evaluate(() => document.getElementById('sfCanvas').getBoundingClientRect().toJSON());
    await page.mouse.move(c.x + c.width * 0.5, c.y + c.height * 0.05);
    await page.mouse.down();
    await page.mouse.move(c.x + c.width * 0.55, c.y + c.height * 0.95, { steps: 30 });
    await page.mouse.up();
    await idle(page);
    const after = await assigns(page);
    const zoneOf = await page.evaluate(() => {
      const t = __mstest,
        o = {};
      for (const l in t.assignData.assign) o[l] = t.zoneOf(+l);
      return o;
    });
    const changed = Object.keys(after).filter((l) => after[l] !== before[l]);
    assert.ok(changed.length > 0, 'Tail’s sections painted');
    for (const l of changed) assert.equal(zoneOf[l], zid, 'section ' + l + ' is Tail’s');
    for (const l in before)
      if (zoneOf[l] === 0) assert.equal(after[l], before[l], 'Main’s section ' + l + ' left as it was');
    assert.match(
      await toastText(page),
      /^Painted Tail’s sections only: (one in another zone was left as it was|\d+ in other zones were left as they were)\.$/,
    );
    assert.match(await page.getAttribute('#sfPlanUndo', 'aria-label'), /^Undo: Painted \d+ sections? with /);
    // a stroke only over Main's sections paints nothing, and says why
    await page.mouse.move(c.x + c.width * 0.5, c.y + c.height * 0.1);
    await page.mouse.down();
    await page.mouse.move(c.x + c.width * 0.5, c.y + c.height * 0.3, { steps: 10 });
    await page.mouse.up();
    await idle(page);
    assert.match(
      await toastText(page),
      /^Paint only colours Tail’s sections: (that one is in another zone|the \d+ you went over are in other zones)\.$/,
    );
    await page.click('#sfPaint');
    await idle(page);
    // Manual: a tap on one of Main's sections opens its tip (whose zone it is, and a way there), not Tail's picker
    const mainSec = await page.evaluate(() => {
      const t = __mstest;
      return Object.keys(t.assignData.assign)
        .map(Number)
        .filter((l) => t.zoneOf(l) === 0)
        .sort((a, b) => t.comps[b].area - t.comps[a].area)[0];
    });
    const p = await sectionPoint(page, mainSec);
    await page.mouse.click(p.x, p.y);
    await idle(page);
    assert.equal(await page.$('#sfSheet'), null, 'no marker picker');
    assert.match(await page.textContent('.sftipzone'), /Zone: Main/);
    assert.ok(await page.$('.sftipzb'), 'Edit this zone');
    // and one of Tail's opens the picker, as Manual does
    const tailSec = await page.evaluate((zid) => {
      const t = __mstest;
      return Object.keys(t.assignData.assign)
        .map(Number)
        .filter((l) => t.zoneOf(l) === zid)
        .sort((a, b) => t.comps[b].area - t.comps[a].area)[0];
    }, zid);
    await page.keyboard.press('Escape');
    await idle(page);
    const q = await sectionPoint(page, tailSec);
    await page.mouse.click(q.x, q.y);
    await idle(page);
    assert.ok(await page.$('#sfSheet'), 'the marker picker');
    assert.deepEqual(errors, []);
  });
  test('focus mode zone by zone: the Colours sheet has a chip for each marker in each zone, naming it; a chip goes to that zone’s sections', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    const zid = await bottomZone(page, 'Tail', 0.5);
    // a marker in both zones
    const mk = await page.evaluate(() => {
      const t = __mstest,
        by = {};
      t.assignData.order.forEach((l) => {
        const k = t.assignData.assign[l].mkey;
        (by[k] = by[k] || new Set()).add(t.zoneOf(l));
      });
      return Object.keys(by).find((k) => by[k].size > 1);
    });
    assert.ok(mk, 'a marker in Main and Tail');
    const pairs = await page.evaluate(() => {
      const t = __mstest,
        s = new Set();
      t.assignData.order.forEach((l) => s.add(t.assignData.assign[l].mkey + '@' + t.zoneOf(l)));
      return s.size;
    });
    await page.click('#sfColor');
    await idle(page);
    await page.click('#sfAlOrder [data-v="zones"]');
    await idle(page);
    await page.click('#sfFocus');
    await idle(page);
    await page.click('#sfFocCols');
    await idle(page);
    const chips = await page.$$eval('#sfFocMk .focmk', (bs) =>
      bs.map((b) => ({
        k: b.dataset.k,
        z: b.querySelector('.fmz') ? b.querySelector('.fmz').textContent : null,
      })),
    );
    assert.equal(chips.length, pairs, 'one per marker per zone');
    assert.ok(chips.every((c) => c.z === 'Main' || c.z === 'Tail'));
    // Main's first, then Tail's
    const firstTail = chips.findIndex((c) => c.z === 'Tail');
    assert.ok(firstTail > 0 && chips.slice(firstTail).every((c) => c.z === 'Tail'));
    await page.click(`#sfFocMk .focmk[data-k="${mk}@${zid}"]`);
    await idle(page);
    const cur = await page.evaluate(() => {
      const t = __mstest,
        l = t.focusOrd[t.focusPos];
      return { mk: t.assignData.assign[l].mkey, z: t.zoneOf(l) };
    });
    assert.deepEqual(cur, { mk, z: zid });
    // the chip now open is the one lit
    await page.click('#sfFocCols');
    await idle(page);
    assert.deepEqual(await page.$$eval('#sfFocMk .focmk.on', (bs) => bs.map((b) => b.dataset.k)), [
      mk + '@' + zid,
    ]);
    // the whole picture's order: one chip a marker, no zone names
    await page.click('#sfExitFoc');
    await idle(page);
    await page.click('#sfAlOrder [data-v="whole"]');
    await idle(page);
    await page.click('#sfFocus');
    await idle(page);
    await page.click('#sfFocCols');
    await idle(page);
    const whole = await page.$$eval('#sfFocMk .focmk', (bs) =>
      bs.map((b) => [b.dataset.k, !!b.querySelector('.fmz')]),
    );
    assert.equal(
      whole.length,
      await page.evaluate(() => new Set(Object.values(__mstest.assignData.assign).map((m) => m.mkey)).size),
    );
    assert.ok(whole.every((w) => !w[0].includes('@') && !w[1]));
    assert.deepEqual(errors, []);
  });
  test('a zone’s sections by keyboard: Tab to “Choose sections with the keys”, arrows move the ring, Space adds and takes out (one Undo step each), Escape back to the chip', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await page.click('.sftabbtn[data-t="pattern"]');
    await idle(page);
    assert.equal(
      await page.getAttribute('#sfCanvas', 'tabindex'),
      null,
      'the picture takes no focus outside the editor',
    );
    await page.focus('#sfZoneAdd');
    await page.keyboard.press('Enter');
    await idle(page);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'sfZoneName');
    await page.keyboard.type('Bell');
    // (out of sight until Tab reaches it)
    assert.ok((await page.$eval('#sfZoneKb', (b) => b.getBoundingClientRect().width)) <= 1);
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'sfZoneKb');
    assert.ok((await page.$eval('#sfZoneKb', (b) => b.getBoundingClientRect().width)) > 100);
    await page.keyboard.press('Enter');
    await idle(page);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'sfCanvas');
    assert.equal(await page.getAttribute('#sfCanvas', 'role'), 'application');
    assert.match(
      await page.getAttribute('#sfCanvas', 'aria-label'),
      /arrow keys go from section to section, Space adds one to Bell/,
    );
    const live = () => page.textContent('#sfLive');
    const ring = () =>
      page.evaluate(() => {
        const o = document.querySelector('.sfoutline');
        return !!o && o.style.display !== 'none';
      });
    assert.match(await live(page), /^[A-Z]+\d+ .+, in Main$/, 'what’s under the ring is said');
    assert.equal(await ring(), true);
    const y0 = await page.evaluate(() => {
      const t = __mstest;
      return t.comps[t.zKbL].cy;
    });
    await page.keyboard.press('ArrowUp');
    await idle(page);
    assert.ok(
      (await page.evaluate(() => {
        const t = __mstest;
        return t.comps[t.zKbL].cy;
      })) < y0,
      'up is up',
    );
    await page.keyboard.press(' ');
    await idle(page);
    assert.equal(await live(page), 'Added to Bell: 1 section');
    assert.match(await page.textContent('#sfZoneN'), /^1 section in Bell$/);
    assert.equal(await page.getAttribute('#sfPlanUndo', 'aria-label'), 'Undo: Bell: 1 section added');
    await page.keyboard.press('ArrowLeft');
    await idle(page);
    await page.keyboard.press('Enter');
    await idle(page);
    assert.match(await page.textContent('#sfZoneN'), /^2 sections in Bell$/);
    // Space on one in the zone takes it out
    await page.keyboard.press(' ');
    await idle(page);
    assert.equal(await live(page), 'Taken out of Bell: 1 section');
    await page.keyboard.press(' ');
    await idle(page);
    // the edge of the picture: said, and the ring stays
    let edge = false;
    for (let i = 0; i < 60 && !edge; i++) {
      await page.keyboard.press('ArrowRight');
      edge = /No more sections that way/.test(await live(page));
    }
    assert.ok(edge);
    // Ctrl+Z still undoes, the focus kept
    await page.keyboard.down('Control');
    await page.keyboard.press('z');
    await page.keyboard.up('Control');
    await idle(page);
    assert.match(await page.textContent('#sfZoneN'), /^1 section in Bell$/);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'sfCanvas');
    // Escape: the editor closes, the picture gives up the focus to the zone's chip
    await page.keyboard.press('Escape');
    await idle(page);
    assert.equal(await page.$('#sfZoneDone'), null);
    assert.equal(
      await page.evaluate(
        () => document.activeElement.classList.contains('sfzchip') && document.activeElement.dataset.z,
      ),
      String(await page.evaluate(() => __mstest.zoneCur)),
    );
    assert.equal(await page.getAttribute('#sfCanvas', 'tabindex'), null);
    assert.equal(await page.getAttribute('#sfCanvas', 'role'), 'img');
    assert.equal(await ring(), false);
    // by touch or mouse: a tap in the editor adds the section and shows no ring
    await page.click('#sfPanel-pattern .sfzchip.on');
    await idle(page);
    const big = await page.evaluate(() => {
      const t = __mstest;
      return Object.keys(t.assignData.assign)
        .map(Number)
        .filter((l) => t.zoneOf(l) === 0)
        .sort((a, b) => t.comps[b].area - t.comps[a].area)[0];
    });
    await scrollTop(page);
    const pt = await sectionPoint(page, big);
    await page.mouse.click(pt.x, pt.y);
    await idle(page);
    assert.equal(await page.evaluate((l) => __mstest.zoneOf(l) === __mstest.zoneCur, big), true);
    assert.equal(await ring(), false, 'no ring after a click');
    assert.deepEqual(errors, []);
  });
  test('Undo back past a zone’s making while the picture has the keyboard’s focus: the editor closes and the picture leaves keyboard mode', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await page.click('.sftabbtn[data-t="pattern"]');
    await idle(page);
    await page.click('#sfShape [data-v="radial"]');
    await idle(page);
    await page.click('#sfZoneAdd');
    await idle(page);
    await page.focus('#sfZoneKb');
    await page.keyboard.press('Enter');
    await idle(page);
    await page.keyboard.press(' ');
    await idle(page);
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press(' ');
    await idle(page);
    for (let i = 0; i < 6 && (await page.evaluate(() => __mstest.zones.length)); i++) {
      await page.keyboard.down('Control');
      await page.keyboard.press('z');
      await page.keyboard.up('Control');
      await idle(page);
    }
    assert.equal(await page.evaluate(() => __mstest.zones.length), 0);
    assert.equal(await page.$('#sfZoneDone'), null);
    assert.equal(await page.getAttribute('#sfCanvas', 'tabindex'), null);
    assert.equal(await page.getAttribute('#sfCanvas', 'role'), 'img');
    assert.equal(
      await page.evaluate(() => {
        const o = document.querySelector('.sfoutline');
        return !!o && o.style.display !== 'none';
      }),
      false,
      'no ring left',
    );
    // (the arrow keys no longer move a ring, nor does Space scroll the page)
    await page.keyboard.press(' ');
    assert.deepEqual(errors, []);
  });
}

// ---- from zones-edits.test.mjs ----
// Zones (v280): what the v279 review found. Zones follow the sections through re-detection, turning and Undo in Edit
// sections; a tap in the zone editor doesn't roll a Random zone again; the markers-changed check; focus mode and the
// Done group zone by zone; Undo labels and an empty zone.
{
  const bigSecs = (page, n, part) =>
    page.evaluate(
      ([n, part]) => {
        const t = __mstest,
          H = t.H;
        return Object.keys(t.assignData.assign)
          .map(Number)
          .filter((l) => (part === 'top' ? t.comps[l].cy < H * 0.3 : t.comps[l].cy > H * 0.7))
          .sort((a, b) => t.comps[b].area - t.comps[a].area)
          .slice(0, n);
      },
      [n, part],
    );
  async function tapSec(page, l) {
    await scrollTop(page);
    const p = await sectionPoint(page, l);
    await page.mouse.click(p.x, p.y);
    await idle(page);
  }
  async function makeZone(page, secs, name) {
    await page.click('.sftabbtn[data-t="pattern"]');
    await idle(page);
    if (await page.$('#sfZoneAdd')) await page.click('#sfZoneAdd');
    else await page.click('#sfPanel-pattern .sfzchip.sfzadd');
    await idle(page);
    if (name) {
      await page.fill('#sfZoneName', name);
      await page.press('#sfZoneName', 'Enter');
      await idle(page);
    }
    for (const l of secs) await tapSec(page, l);
    await page.click('#sfZoneDone');
    await idle(page);
  }
  const zoneSecsAll = (page) =>
    page.evaluate(() =>
      __mstest.zones.map((z) =>
        Object.keys(z.secs)
          .map(Number)
          .sort((a, b) => a - b),
      ),
    );
  // the picture flipped left to right (the same size), its sections found again `times` times (as Sensitivity does)
  const flipAndDetect = (page, times) =>
    page.evaluate((times) => {
      const t = __mstest,
        W = t.W,
        H = t.H,
        g = t.gray,
        o = new Uint8Array(g.length);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) o[y * W + x] = g[y * W + (W - 1 - x)];
      t.gray = o;
      for (let i = 0; i < times; i++) t.segment();
      t.render();
    }, times);
  const markers = (page, zone) =>
    page.evaluate((zone) => {
      const t = __mstest,
        o = {};
      for (const l in t.assignData.assign)
        if (zone == null || t.zoneOf(+l) === zone) o[l] = t.assignData.assign[l].mkey;
      return o;
    }, zone);
  const changed = (a, b) => Object.keys(a).filter((l) => a[l] !== b[l]).length;
  test('sections found again twice before Build guide: the zones land where once puts them', async () => {
    const runs = [];
    for (const times of [1, 2]) {
      const { page, errors } = await openApp();
      await sampleGuide(page);
      await idle(page);
      await makeZone(page, await bigSecs(page, 4, 'top'), 'Bell');
      await page.click('#sfBack2');
      await idle(page);
      await flipAndDetect(page, times);
      await buildGo(page);
      await idle(page);
      const placed = await zoneSecsAll(page);
      assert.equal(placed.length, 1);
      assert.ok(placed[0].length, 'the zone kept sections');
      runs.push(placed);
      assert.deepEqual(errors, []);
      await page.close();
    }
    assert.deepEqual(runs[1], runs[0], 'twice places the zone as once does');
  });
  test('Undo in Edit sections after sections were found again brings back the zones as they were', async () => {
    const { page, errors } = await openApp();
    await answerAsks(page);
    await sampleGuide(page);
    await idle(page);
    await makeZone(page, await bigSecs(page, 4, 'top'), 'Bell');
    const orig = await zoneSecsAll(page);
    await page.click('#sfBack2');
    await idle(page);
    // the greys flipped, then Enhance finds the sections again the usual way (an Undo step kept first)
    await flipAndDetect(page, 0);
    await page.click('#sfAdjToggle');
    await idle(page);
    await page.click('#sfEnh');
    await idle(page, 2000);
    await buildGo(page);
    await idle(page);
    assert.notDeepEqual(await zoneSecsAll(page), orig, 'the zone is on the new sections');
    await page.click('#sfBack2');
    await idle(page);
    await page.click('#sfPlanUndo');
    await idle(page, 2000);
    await buildGo(page);
    await idle(page);
    assert.deepEqual(await zoneSecsAll(page), orig);
    assert.deepEqual(errors, []);
  });
  test('turning the picture clears the zones and says so; Undo in Edit sections brings them back', async () => {
    const { page, errors } = await openApp();
    await answerAsks(page);
    await sampleGuide(page);
    await idle(page);
    await makeZone(page, await bigSecs(page, 4, 'top'), 'Bell');
    const orig = await zoneSecsAll(page);
    await page.click('#sfBack2');
    await idle(page);
    await page.click('#sfAdjToggle');
    await idle(page);
    await page.click('#sfRotR');
    await idle(page, 3000);
    await buildGo(page);
    await idle(page);
    assert.match(
      await page.textContent('#msToast'),
      /zones were cleared: turning, straightening or cropping/,
    );
    assert.equal((await zoneSecsAll(page)).length, 0);
    await page.click('#sfBack2');
    await idle(page);
    await page.click('#sfPlanUndo');
    await idle(page, 3000);
    await buildGo(page);
    await idle(page);
    assert.deepEqual(await zoneSecsAll(page), orig);
    assert.deepEqual(await page.evaluate(() => __mstest.zones.map((z) => z.name)), ['Bell']);
    assert.deepEqual(errors, []);
  });
  test('section edits kept while the page is hidden, after sections were found again: the zones are saved on the new sections', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await makeZone(page, await bigSecs(page, 4, 'top'), 'Bell');
    await page.click('#sfBack2');
    await idle(page);
    await flipAndDetect(page, 1);
    const saved = await page.evaluate(() => {
      const d = __mstest.currentDesignObj(false, true);
      window.__d = Object.assign({}, d.payload, { name: d.name, W: d.W, H: d.H });
      return d.payload.zones[0].secs;
    });
    // where Build guide puts them
    await buildGo(page);
    await idle(page);
    assert.deepEqual(saved, (await zoneSecsAll(page))[0]);
    // and opened again (Resume), then built: the same
    await page.evaluate(() => __mstest.openDesignObj(window.__d, null, true));
    await page.waitForFunction(() => __mstest.labels && __mstest.zones.length);
    await idle(page);
    await buildGo(page);
    await idle(page);
    assert.deepEqual((await zoneSecsAll(page))[0], saved);
    assert.deepEqual(errors, []);
  });
  test('Build guide with no section edits leaves a white section of Main in Main', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await page.click('.sftabbtn[data-t="pattern"]');
    await page.click('#sfZoneAdd');
    await idle(page);
    // a zone round one section, which the pattern left white (as the Photo pattern's white areas are)
    const r = await page.evaluate(() => {
      const t = __mstest,
        zid = t.zoneCur,
        l = Object.keys(t.assignData.assign)
          .map(Number)
          .sort((a, b) => t.comps[b].area - t.comps[a].area)[20];
      const around = t
        .countedList()
        .filter(
          (x) =>
            x !== l && Math.hypot(t.comps[x].cx - t.comps[l].cx, t.comps[x].cy - t.comps[l].cy) < t.W * 0.4,
        );
      t.zoneMove(around, zid);
      t.reassign([0, zid]);
      const a = t.assignData;
      delete a.assign[l];
      delete a.base[l];
      a.order = a.order.filter((x) => x !== l);
      a.N = a.order.length;
      a.paper = { [l]: 1 };
      return { l };
    });
    await page.click('#sfZoneDone');
    await idle(page);
    await page.click('#sfBack2');
    await idle(page);
    await buildGo(page);
    await idle(page);
    assert.equal(await page.evaluate((l) => __mstest.zoneOf(l), r.l), 0);
    assert.deepEqual(errors, []);
  });
  test("a tap in the zone editor doesn't roll a Random Main (or the Random zone) again", async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await page.click('.sftabbtn[data-t="pattern"]');
    await page.click('#sfFam [data-v="random"]');
    await idle(page);
    const [a, b, c] = await bigSecs(page, 3, 'top');
    await makeZone(page, [a, b], 'Bell');
    const m0 = await markers(page, 0),
      z0 = await markers(page, await page.evaluate(() => __mstest.zoneCur));
    await page.click('#sfPanel-pattern .sfzchip.on');
    await idle(page);
    await tapSec(page, c);
    await page.click('#sfZoneDone');
    await idle(page);
    const m1 = await markers(page, 0),
      z1 = await markers(page, await page.evaluate(() => __mstest.zoneCur));
    assert.equal(changed(m1, m0), 0, "Main's sections keep their markers");
    assert.equal(
      changed(z0, z1),
      0,
      "the zone's own sections keep theirs (Random, as it was: a copy of Main's settings)",
    );
    assert.ok(z1[c], 'the section added has a marker');
    assert.deepEqual(errors, []);
  });
  test('the markers you can use: after reopening, a filter change lays every zone again; after Undo of one, a change to one zone keeps the others', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await page.click('.sftabbtn[data-t="pattern"]');
    await page.click('#sfFam [data-v="random"]');
    await idle(page);
    await makeZone(page, await bigSecs(page, 6, 'top'), 'Bell');
    await page.click('#sfShape [data-v="radial"]').catch(() => {});
    await page.click('#sfFam [data-v="gradient"]');
    await idle(page);
    await saveGuide(page);
    const id = await page.evaluate(() => __mstest.curId);
    await page.reload();
    await idle(page);
    await page.evaluate((id) => loadGuide({ id }), id);
    await page.waitForFunction((id) => __mstest.curId === id && __mstest.assignData, id);
    await idle(page);
    await page.click('.sftabbtn[data-t="pattern"]');
    await idle(page);
    await page.click('#sfPanel-pattern .sfzchip[data-z="0"]');
    await idle(page);
    // leave out the family of a marker Bell uses, with Main chosen: Bell's sections don't keep it
    const r = await page.evaluate(() => {
      const t = __mstest,
        zid = t.zones[0].id,
        a = t.assignData.assign;
      const k = Object.keys(a)
        .filter((l) => t.zoneOf(+l) === zid)
        .map((l) => a[l].mkey)[0];
      const i = COLORS.findIndex((c, i) => mkey(i) === k);
      state.excluded.add(COLORS[i].fam);
      save();
      SF.setCollection(sfCollection());
      t.reassign();
      const b = t.assignData.assign;
      return { k, still: Object.keys(b).filter((l) => b[l].mkey === k).length };
    });
    assert.equal(r.still, 0, 'no section keeps a marker left out');
    // Undo that, then a change to Bell only: Main (Random) keeps its markers
    await page.click('#sfPlanUndo');
    await idle(page);
    const m0 = await markers(page, 0);
    await page.click(
      `#sfPanel-pattern .sfzchip[data-z="${await page.evaluate(() => __mstest.zones[0].id)}"]`,
    );
    await idle(page);
    await page.click('#sfShape [data-v="vertical"]');
    await idle(page);
    assert.equal(changed(await markers(page, 0), m0), 0, 'Main keeps its colours');
    assert.deepEqual(errors, []);
  });
  test("zone by zone: focus mode's Mark all done and Section x of y are the zone's; the Done group keeps its rows, naming their zone", async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await makeZone(page, await bigSecs(page, 12, 'top'), 'Bell');
    const zid = await page.evaluate(() => __mstest.zoneCur);
    // a marker in both Main and Bell
    const mk = await page.evaluate(() => {
      const t = __mstest,
        by = {};
      t.assignData.order.forEach((l) => {
        const k = t.assignData.assign[l].mkey;
        (by[k] = by[k] || new Set()).add(t.zoneOf(l));
      });
      return Object.keys(by).find((k) => by[k].size > 1);
    });
    assert.ok(mk, 'a marker in both zones');
    const nMain = await page.evaluate(
      (mk) =>
        __mstest.assignData.order.filter(
          (l) => __mstest.assignData.assign[l].mkey === mk && __mstest.zoneOf(l) === 0,
        ).length,
      mk,
    );
    await page.click('#sfColor');
    await idle(page);
    await page.click('#sfAlOrder [data-v="zones"]');
    await idle(page);
    await page.locator(`#sfAlist .sfarow[data-k="${mk}@0"] .sfah`).click();
    await idle(page);
    await page.click('#sfFocus');
    await idle(page);
    assert.match(await page.textContent('#sfFocSub'), new RegExp('Section 1 of ' + nMain + '\\b'));
    await page.click('#sfFocCols');
    await idle(page);
    await page.click('#sfFocAll');
    await idle(page);
    const t = await page.evaluate(
      ([mk, zid]) => {
        const s = __mstest,
          r = { main: 0, bell: 0 };
        s.assignData.order.forEach((l) => {
          if (s.assignData.assign[l].mkey === mk && s.colored[l]) r[s.zoneOf(l) === zid ? 'bell' : 'main']++;
        });
        return r;
      },
      [mk, zid],
    );
    assert.deepEqual(t, { main: nMain, bell: 0 }, "only Main's are ticked");
    await page.click('#sfExitFoc');
    await idle(page);
    // Whole picture and back: the Done group is still there, and its rows say their zone
    await page.click('#sfAlOrder [data-v="whole"]');
    await idle(page);
    await page.click('#sfAlOrder [data-v="zones"]');
    await idle(page);
    assert.ok(await page.$('#sfDoneGrp'), 'the Done group');
    await page.click('#sfDoneGrp');
    await idle(page);
    assert.match(await page.textContent(`#sfAlist .sfarow[data-k="${mk}@0"]`), /· Main/);
    assert.deepEqual(errors, []);
  });
  test('Undo labels: a section taken from another zone is "added" to the one being edited; an empty zone renamed and dropped leaves no step', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    const [a, b] = await bigSecs(page, 2, 'top');
    await makeZone(page, [a], 'Bell');
    await makeZone(page, [b], 'Foot');
    const n0 = await page.evaluate(() => __mstest.planCount);
    await page.click('#sfPanel-pattern .sfzchip.on');
    await idle(page);
    await tapSec(page, a);
    assert.equal(await page.getAttribute('#sfPlanUndo', 'aria-label'), 'Undo: Foot: 1 section added');
    await page.click('#sfZoneDone');
    await idle(page);
    const n1 = await page.evaluate(() => __mstest.planCount),
      lab = await page.getAttribute('#sfPlanUndo', 'aria-label');
    // ＋, a name, Done: dropped, and no step for it
    await page.click('#sfPanel-pattern .sfzchip.sfzadd');
    await idle(page);
    await page.fill('#sfZoneName', 'Hat');
    await page.press('#sfZoneName', 'Enter');
    await idle(page);
    await page.click('#sfZoneDone');
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.planCount), n1);
    assert.equal(await page.getAttribute('#sfPlanUndo', 'aria-label'), lab);
    assert.deepEqual(await page.evaluate(() => __mstest.zones.map((z) => z.name)), ['Bell', 'Foot']);
    assert.ok(n1 > n0);
    assert.deepEqual(errors, []);
  });
}
