// Zones.
// (v320) Tests organised by feature: each block below came from the file named above it, its tests unchanged.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ROOT,
  WK,
  addFromMarkers,
  answerAsks,
  buildGo,
  clearCollection,
  idle,
  notOnWebKit,
  openApp,
  pause,
  sampleGuide,
  saveGuide,
  scanFromMarkers,
  scrollTop,
  sectionPoint,
  setup,
  teardown,
  welcome,
} from './helpers.mjs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

before(setup);
after(teardown);

// ---- from zones-shading.test.mjs ----
// Shading per zone (v281): each zone has its own "Shade Bell", Roundness, and Highlights and Shadows (kind and amount);
// the mode, the light (the sun or the photo) and the tone lines are the whole picture's. A flat zone is as sections left
// flat are. One marker can have other companions in another zone: Colour along and the printed key show each.
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
  const shadingOn = async (page, mode = 'full') => {
    await page.click('.sftabbtn[data-t="shading"]');
    await idle(page);
    await page.evaluate((m) => __mstest.shadeTo(m), mode);
    await idle(page);
  };
  const shadeTab = async (page) => {
    await page.click('.sftabbtn[data-t="shading"]');
    await idle(page);
  };
  const chip = (page, id) => page.click(`#sfPanel-shading .sfzchip[data-z="${id}"]`).then(() => idle(page));
  const slide = (page, id, v) =>
    page.evaluate(
      ([id, v]) => {
        const el = document.getElementById(id);
        el.value = String(v);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      },
      [id, v],
    );
  const undoLabel = (page) => page.getAttribute('#sfPlanUndo', 'aria-label');
  // a section's tones (null: not shaded) and why not
  const sec = (page, l) =>
    page.evaluate((l) => {
      const t = __mstest.shadeSec(l);
      return {
        t: t && {
          T2: t.T2,
          T3: t.T3,
          paper: !!t.paper,
          light: t.light ? t.light.mkey : null,
          dark: t.dark ? t.dark.mkey : null,
          glaze: !!t.glaze,
        },
        why: __mstest.shadeWhy(l),
      };
    }, l);
  // Main's sections and a zone's
  const split = (page, zid) =>
    page.evaluate((zid) => {
      const t = __mstest,
        m = [],
        z = [];
      for (const l in t.assignData.assign) (t.zoneOf(+l) === zid ? z : t.zoneOf(+l) === 0 ? m : []).push(+l);
      return { main: m, zone: z };
    }, zid);
  const shadedIn = (page, secs) => page.evaluate((secs) => secs.filter((l) => !!__mstest.shadeSec(l)), secs);
  test('the Shading tab: the whole picture’s settings first; with zones, the chips, “Shade Bell” and the chosen zone’s own', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await shadingOn(page);
    // without zones: no chips, no Shade checkbox; the whole picture's settings above Roundness and the pair
    assert.equal(await page.$('#sfPanel-shading .sfzrow'), null);
    assert.equal(await page.$('#sfZoneShade'), null);
    const order = () =>
      page.evaluate(() =>
        [
          ...document.querySelectorAll(
            '#sfPanel-shading #sfShade, #sfPanel-shading .sfshnote, #sfPanel-shading .sfshrow, #sfPanel-shading .sfzrow, #sfPanel-shading .sfzshade, #sfPanel-shading #sfRound, #sfPanel-shading .sfshpair, #sfPanel-shading #sfTex',
          ),
        ].map(
          (e) =>
            e.id ||
            ['sfshnote', 'sfshrow', 'sfzrow', 'sfzshade', 'sfshpair'].find((c) => e.classList.contains(c)),
        ),
      );
    assert.deepEqual(await order(), ['sfShade', 'sfshnote', 'sfshrow', 'sfRound', 'sfshpair', 'sfTex']);
    await makeZone(page, await bigSecs(page, 4, 'top'), 'Bell');
    await shadeTab(page);
    assert.deepEqual(await order(), [
      'sfShade',
      'sfshnote',
      'sfshrow',
      'sfzrow',
      'sfzshade',
      'sfRound',
      'sfshpair',
      'sfTex',
    ]);
    assert.match(await page.textContent('#sfPanel-shading .sfzshade'), /Shade Bell/);
    // the chips choose the zone, here as in Pattern and Colours (one chosen zone for all three)
    await chip(page, 0);
    assert.match(await page.textContent('#sfPanel-shading .sfzshade'), /Shade Main/);
    assert.equal(await page.evaluate(() => __mstest.zoneCur), 0);
    assert.equal(await page.getAttribute('#sfPanel-pattern .sfzchip[data-z="0"]', 'aria-pressed'), 'true');
    // Off: none of it
    await page.click('#sfShade [data-v="off"]');
    await idle(page);
    assert.equal(await page.$('#sfPanel-shading .sfzrow'), null);
    assert.deepEqual(errors, []);
  });
  test('each zone’s Roundness, Highlights and Shadows change its own sections only; a new zone starts with the chosen zone’s', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await shadingOn(page);
    await makeZone(page, await bigSecs(page, 8, 'top'), 'Bell');
    const zid = await page.evaluate(() => __mstest.zoneCur),
      s = await split(page, zid);
    const mz = (await shadedIn(page, s.main))[0],
      bz = (await shadedIn(page, s.zone))[0];
    assert.ok(mz && bz, 'a shaded section in each');
    const m0 = await sec(page, mz),
      b0 = await sec(page, bz);
    assert.deepEqual([m0.t.T2, m0.t.T3], [b0.t.T2, b0.t.T3], "Bell started with Main's shading");
    await shadeTab(page);
    // Bell's highlight kind and amounts
    await page.selectOption('#sfHiStyle', 'paper');
    await idle(page);
    assert.equal(await undoLabel(page), 'Undo: Bell: Highlights: Paper white');
    await slide(page, 'sfShLo', 90);
    await idle(page);
    assert.equal(await undoLabel(page), 'Undo: Bell: Shadow amount: 90%'); // (v308: as the slider is named)
    const m1 = await sec(page, mz),
      b1 = await sec(page, bz);
    assert.deepEqual(m1, m0, "Main's section is as it was");
    assert.equal(b1.t.paper, true);
    assert.ok(b1.t.T3 < b0.t.T3, "more of Bell's section is shadow");
    // roundness: Bell's pixels change, Main's don't
    const V = () =>
      page.evaluate(
        ([a, b]) => {
          const t = __mstest;
          t.shadePrep(false);
          const V = t.shadeV,
            ra = [],
            rb = [];
          for (let i = 0; i < t.labels.length; i++) {
            if (t.labels[i] === a) ra.push(V[i]);
            else if (t.labels[i] === b) rb.push(V[i]);
          }
          return { a: ra.join(), b: rb.join() };
        },
        [mz, bz],
      );
    const v0 = await V(page);
    await slide(page, 'sfRound', 95);
    await idle(page);
    assert.equal(await undoLabel(page), 'Undo: Bell: Roundness changed');
    const v1 = await V(page);
    assert.equal(v1.a, v0.a, "Main's section is shaded as it was");
    assert.notEqual(v1.b, v0.b, "Bell's is rounder");
    // Main's own change says so
    await chip(page, 0);
    await slide(page, 'sfRound', 10);
    await idle(page);
    assert.equal(await undoLabel(page), 'Undo: Main: Roundness changed');
    assert.equal(await page.evaluate((id) => __mstest.zsh(id).round, zid), 0.95, 'Bell keeps its own');
    // Undo takes them back one at a time
    await page.click('#sfPlanUndo');
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.zsh(0).round), 0.5);
    // a new zone made while Bell is chosen has Bell's shading
    await chip(page, zid);
    await makeZone(page, await bigSecs(page, 2, 'bottom'), 'Foot');
    const fz = await page.evaluate(() => __mstest.zoneCur);
    assert.deepEqual(
      await page
        .evaluate(([a, b]) => [__mstest.zsh(a), __mstest.zsh(b)], [zid, fz])
        .then(([a, b]) => [a.hilite, a.lo, a.round].join() === [b.hilite, b.lo, b.round].join()),
      true,
    );
    assert.deepEqual(errors, []);
  });
  test('a flat zone: its sections one colour each, as sections left flat; tips, Colour along and the print follow; a new zone made from it is flat too', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await shadingOn(page);
    await makeZone(page, await bigSecs(page, 8, 'top'), 'Bell');
    const zid = await page.evaluate(() => __mstest.zoneCur),
      s = await split(page, zid);
    const bz = (await shadedIn(page, s.zone))[0];
    await shadeTab(page);
    await page.click('#sfZoneShade');
    await idle(page);
    assert.equal(await undoLabel(page), 'Undo: Bell: Shading: Flat');
    assert.match(await page.textContent('#sfPanel-shading .sfzflat'), /Bell is flat: one colour per section/);
    assert.equal(await page.$('#sfRound'), null, 'no Roundness or Highlights for a flat zone');
    assert.deepEqual(await sec(page, bz), { t: null, why: 'zone' });
    assert.equal((await shadedIn(page, s.zone)).length, 0);
    assert.ok((await shadedIn(page, s.main)).length > 0, 'Main is still shaded');
    // its tip says why
    await tapSec(page, bz);
    assert.match(await page.textContent('.sftip'), /Bell is flat — one colour/);
    await page.keyboard.press('Escape');
    // Leave sections flat: a tap in Bell says it's flat already
    await page.click('#sfShFlat');
    await idle(page);
    await tapSec(page, bz);
    assert.match(await page.textContent('#msToast'), /Bell is flat, so its sections already are/);
    assert.equal(await page.evaluate((l) => !!__mstest.styleVars.shadeFlat[l], bz), false);
    await page.click('#sfShFlat');
    await idle(page);
    // Colour along zone by zone: Bell's rows have no tones, Main's do
    await page.click('#sfColor');
    await idle(page);
    await page.click('#sfAlOrder [data-v="zones"]');
    await idle(page);
    const rows = await page.$$eval('#sfAlist .sfarow', (rs) =>
      rs.map((r) => [r.dataset.k, !!r.querySelector('.sfatones')]),
    );
    assert.ok(rows.length);
    for (const [k, tones] of rows) assert.equal(tones, !k.endsWith('@' + zid), k);
    await page.click('#sfAlOrder [data-v="whole"]');
    await idle(page);
    await page.click('#sfDoneBtn');
    await idle(page);
    // every zone flat: nothing is shaded, so no tone steps, how-to or tone columns
    await shadeTab(page);
    await chip(page, 0);
    await page.click('#sfZoneShade');
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.shadeUse().on), false);
    assert.match(
      await page.textContent('#sfPanel-shading .sfshnote'),
      /Every section is flat, so nothing is shaded: tick “Shade” for a zone/,
    );
    // (and the ⓘ line doesn't ask to drag a sun that isn't there)
    assert.doesNotMatch(await page.textContent('#sfPanel-shading'), /Drag the/);
    assert.ok((await page.evaluate(() => __mstest.buildPDFPages(true))) >= 1);
    await page.click('#sfColor');
    await idle(page);
    assert.equal(await page.$('#sfAlist .sfatones'), null);
    await page.click('#sfFocus');
    await idle(page);
    await page.click('#sfFocCols');
    await idle(page);
    assert.equal(await page.$('#sfToneSteps'), null, 'no "Step through each tone"');
    await page.click('#sfExitFoc');
    await idle(page);
    await page.click('#sfDoneBtn');
    await idle(page);
    // a new zone made while flat Main is chosen is flat too (as it copies the chosen zone's settings)
    await makeZone(page, await bigSecs(page, 2, 'bottom'), 'Foot');
    assert.equal(await page.evaluate(() => __mstest.zsh(__mstest.zoneCur).on), false);
    assert.deepEqual(errors, []);
  });
  test('the last zone deleted with Main flat: the whole guide is shaded again (Shade Main goes with the zones)', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await shadingOn(page);
    await makeZone(page, await bigSecs(page, 3, 'top'), 'Bell');
    const zid = await page.evaluate(() => __mstest.zoneCur);
    await shadeTab(page);
    await chip(page, 0);
    await page.click('#sfZoneShade');
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.styleVars.shadeMain), false);
    // Bell's editor (its chip, then its chip again), Delete zone
    await page.click('.sftabbtn[data-t="pattern"]');
    await idle(page);
    await page.click(`#sfPanel-pattern .sfzchip[data-z="${zid}"]`);
    await idle(page);
    await page.click(`#sfPanel-pattern .sfzchip[data-z="${zid}"]`);
    await idle(page);
    await page.click('#sfZoneDel');
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.zones.length), 0);
    assert.equal(await page.evaluate(() => __mstest.styleVars.shadeMain), true);
    assert.equal(await page.evaluate(() => __mstest.shadeUse().on), true);
    // Undo brings back the zone, and Main flat with it
    await page.click('#sfPlanUndo');
    await idle(page);
    assert.deepEqual(await page.evaluate(() => [__mstest.zones.length, __mstest.styleVars.shadeMain]), [
      1,
      false,
    ]);
    assert.deepEqual(errors, []);
  });
  test('one marker, other companions in another zone: Colour along shows both (and each zone’s when open), the printed key has a line for the zone', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await shadingOn(page);
    await makeZone(page, await bigSecs(page, 12, 'top'), 'Bell');
    const zid = await page.evaluate(() => __mstest.zoneCur);
    await shadeTab(page);
    await page.selectOption('#sfHiStyle', 'paper');
    await idle(page);
    await page.selectOption('#sfShStyle', 'grey');
    await idle(page);
    // a marker shaded in both Main and Bell
    const mk = await page.evaluate((zid) => {
      const t = __mstest,
        by = {};
      for (const l in t.assignData.assign) {
        if (!t.shadeSec(+l)) continue;
        const k = t.assignData.assign[l].mkey;
        (by[k] = by[k] || new Set()).add(t.zoneOf(+l));
      }
      return Object.keys(by).find((k) => by[k].has(0) && by[k].has(zid));
    }, zid);
    assert.ok(mk, 'a marker shaded in both zones');
    const rows = await page.evaluate((mk) => {
      const t = __mstest,
        secs = t.assignData.order.filter((l) => t.assignData.assign[l].mkey === mk);
      return t.toneRows(secs).map((r) => ({ paper: !!r.t.paper, z: Object.keys(r.z) }));
    }, mk);
    assert.equal(rows.length, 2);
    assert.deepEqual(rows.map((r) => r.paper).sort(), [false, true]);
    await page.click('#sfColor');
    await idle(page);
    const row = `#sfAlist .sfarow[data-k="${mk}"]`;
    const tones = await page.textContent(row + ' .sfatones .sftv');
    assert.match(tones, /H .+ \/ paper|H paper \/ /, 'both highlights: ' + tones);
    const said = await page.textContent(row + ' .sfatones .sfsr');
    assert.match(said, /highlight .+ or /);
    // (a grey shadow is laid over the base, and says so)
    if (
      await page.evaluate((mk) => {
        const t = __mstest;
        return t.assignData.order.some(
          (l) => t.assignData.assign[l].mkey === mk && t.shadeSec(l) && t.shadeSec(l).glaze,
        );
      }, mk)
    )
      assert.match(said, /over the base/);
    // (several options: the row's tones take the lines they need)
    assert.ok(await page.$(row + ' .sfatones.sfatm'));
    await page.click(row + ' .sfah');
    await idle(page);
    const byZone = await page.$$eval(row + ' .sfazones > div', (ds) =>
      ds.map((d) => d.querySelector('b').textContent),
    );
    assert.deepEqual(byZone.sort(), ['Bell', 'Main']);
    await page.click('#sfDoneBtn');
    await idle(page);
    // the print: a page count that allows for the lines, and the pages drawn without trouble
    const pages = await page.evaluate(() => __mstest.buildPDFPages(true));
    assert.ok(pages >= 2);
    assert.equal(await page.evaluate(() => __mstest.buildPDFPages(false).length), pages);
    // the how-to for a guide with both kinds of highlight
    assert.match(
      await page.evaluate(() => __mstest.shadeHowto()),
      /a lighter marker, or the paper left white where the key says so/,
    );
    assert.deepEqual(errors, []);
  });
  test('the tone circles follow the Highlight and Shadow amounts (they were kept from before a change)', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await shadingOn(page);
    const labs = () =>
      page.evaluate(() => {
        const t = __mstest,
          sh = t.shadePrep(false);
        return JSON.stringify(
          t.shadeZoneLabelsAll(sh, 3).map((z) => [z.l, z.tone, Math.round(z.x), Math.round(z.y)]),
        );
      });
    const a = await labs(page);
    await slide(page, 'sfShHi', 100);
    await idle(page);
    await slide(page, 'sfShLo', 100);
    await idle(page);
    const b = await labs(page);
    assert.notEqual(b, a);
    assert.deepEqual(errors, []);
  });
  test('zones’ shading is saved with the guide and opens as it was; a zone saved before v281 opens with Main’s', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await shadingOn(page);
    await makeZone(page, await bigSecs(page, 4, 'top'), 'Bell');
    const zid = await page.evaluate(() => __mstest.zoneCur);
    await shadeTab(page);
    await page.selectOption('#sfShStyle', 'cool');
    await idle(page);
    await slide(page, 'sfRound', 80);
    await idle(page);
    await chip(page, 0);
    await page.click('#sfZoneShade');
    await idle(page);
    const d = await page.evaluate(() => __mstest.currentDesignObj());
    assert.deepEqual(d.payload.zones[0].shade, {
      on: true,
      round: 0.8,
      hi: 0.5,
      lo: 0.5,
      shadow: 'cool',
      hilite: 'same',
    });
    assert.equal(d.payload.style.shade.main, false);
    await saveGuide(page);
    const id = await page.evaluate(() => __mstest.curId);
    await page.reload();
    await idle(page);
    await page.evaluate((id) => loadGuide({ id }), id);
    await page.waitForFunction((id) => __mstest.curId === id && __mstest.assignData, id);
    await idle(page);
    const z = await page.evaluate(() => {
      const t = __mstest,
        id = t.zones[0].id;
      return [t.zsh(id), t.styleVars.shadeMain];
    });
    assert.deepEqual([z[0].shadow, z[0].round, z[0].on, z[1]], ['cool', 0.8, true, false]);
    // a zone saved before v281 has no shading of its own: Main's, as it had then
    await page.evaluate(() => {
      const t = __mstest,
        d = t.currentDesignObj(),
        p = d.payload;
      delete p.zones[0].shade;
      p.style.shade.round = 0.3;
      p.style.shade.shadow = 'grey';
      p.style.shade.main = true;
      t.openDesignObj(Object.assign({}, p, { name: 'Old', W: d.W, H: d.H }), null);
    });
    await page.waitForFunction(() => __mstest.curName === 'Old' && __mstest.zones.length);
    await idle(page);
    const o = await page.evaluate(() => __mstest.zsh(__mstest.zones[0].id));
    assert.deepEqual([o.on, o.round, o.shadow], [true, 0.3, 'grey']);
    assert.deepEqual(errors, []);
  });
  test('a change waiting to be saved goes into its guide with its zones when another picture opens', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await saveGuide(page);
    const id = await page.evaluate(() => __mstest.curId);
    await makeZone(page, await bigSecs(page, 3, 'top'), 'Bell');
    // the sample again at once (the autosave hasn't run yet)
    await page.evaluate(() => SF.loadSample());
    await page.waitForFunction(
      (id) => __mstest.assignData && !__mstest.zones.length && __mstest.curId !== id,
      id,
    );
    await idle(page);
    await page.evaluate((id) => loadGuide({ id }), id);
    await page.waitForFunction((id) => __mstest.curId === id && __mstest.assignData, id);
    await idle(page);
    assert.deepEqual(await page.evaluate(() => __mstest.zones.map((z) => z.name)), ['Bell']);
    assert.deepEqual(errors, []);
  });
  test('Light from is one light for the whole picture, whichever zone is chosen; sections the photo doesn’t cover stay flat', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await shadingOn(page);
    await makeZone(page, await bigSecs(page, 6, 'bottom'), 'Foot');
    const zid = await page.evaluate(() => __mstest.zoneCur);
    await page.click('.sftabbtn[data-t="pattern"]');
    await idle(page);
    const b64 = await page.evaluate(async () => {
      const c = document.createElement('canvas');
      c.width = 600;
      c.height = 800;
      const g = c.getContext('2d');
      const gr = g.createLinearGradient(0, 0, 600, 0);
      gr.addColorStop(0, '#f0c0c0');
      gr.addColorStop(1, '#401010');
      g.fillStyle = gr;
      g.fillRect(0, 0, 600, 800);
      const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
      return await new Promise((r) => {
        const f = new FileReader();
        f.onload = () => r(f.result.split(',')[1]);
        f.readAsDataURL(blob);
      });
    });
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#sfFam [data-v="photo"]')]);
    await fc.setFiles({ name: 'ref.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
    await page.waitForFunction(() => !!__mstest.photoRef && !__mstest.photoChecking);
    await idle(page);
    // the photo over the bottom half of the picture only
    await page.evaluate(() => {
      const M = __mstest,
        r = M.photoRef;
      M.photoXf = { cx: M.W / 2, cy: M.H * 0.75, sx: M.W / r.w, sy: M.H / 2 / r.h, r: 0 };
      M.photoRecolour();
    });
    await idle(page);
    // Main isn't a Photo pattern: the sun, whichever zone is chosen (v280 flipped it with the chip)
    assert.equal(await page.evaluate(() => __mstest.shadeFromPhoto()), false);
    await shadeTab(page);
    assert.equal(await page.getAttribute('#sfShLight [data-v="sun"]', 'aria-pressed'), 'true');
    await chip(page, 0);
    assert.equal(await page.evaluate(() => __mstest.shadeFromPhoto()), false);
    // a top section half done (its base) while the sun shades it
    const half = await page.evaluate(() => {
      const t = __mstest;
      const l = Object.keys(t.assignData.assign)
        .map(Number)
        .find((l) => t.comps[l].cy < t.H * 0.3 && t.shadeSec(l) && !t.shadeSec(l).coat);
      t.normalizeTones();
      t.tonePart[l] = 2;
      return l;
    });
    assert.ok(half);
    // The photo: every zone lit from it, the top half (no photo there) flat, and a line says how many
    await page.click('#sfShLight [data-v="photo"]');
    await idle(page);
    assert.equal(
      await page.evaluate((l) => __mstest.colored[l], half),
      1,
      'flat now: its base was all it needed',
    );
    assert.equal(await undoLabel(page), 'Undo: Light from the photo');
    assert.equal(await page.evaluate(() => __mstest.shadeFromPhoto()), true);
    await chip(page, zid);
    assert.equal(
      await page.evaluate(() => __mstest.shadeFromPhoto()),
      true,
      'the same light with another zone chosen',
    );
    const r = await page.evaluate(() => {
      const t = __mstest,
        out = { top: 0, topShaded: 0 };
      for (const l in t.assignData.assign) {
        if (t.comps[l].cy < t.H * 0.4) {
          out.top++;
          if (t.shadeSec(+l)) out.topShaded++;
        }
      }
      return out;
    });
    assert.ok(r.top > 5 && r.topShaded === 0, JSON.stringify(r));
    assert.match(
      await page.textContent('#sfShOut'),
      /sections? (is|are) outside the photo, so (it stays|they stay) flat/,
    );
    const top = await page.evaluate(() => {
      const t = __mstest;
      return Object.keys(t.assignData.assign)
        .map(Number)
        .find((l) => t.comps[l].cy < t.H * 0.3 && t.shadeWhy(l) === 'photo');
    });
    assert.ok(top);
    // no sun handle with the light from the photo
    assert.equal(
      await page.evaluate(() => {
        const s = document.getElementById('sfSun');
        return !!s && s.style.display !== 'none';
      }),
      false,
    );
    // saved and opened again: once the photo is back, that section is still done
    await saveGuide(page);
    const id = await page.evaluate(() => __mstest.curId);
    await page.reload();
    await idle(page);
    await page.evaluate((id) => loadGuide({ id }), id);
    await page.waitForFunction(
      (id) => __mstest.curId === id && __mstest.assignData && !!__mstest.photoRef,
      id,
    );
    await idle(page);
    assert.equal(await page.evaluate((l) => __mstest.colored[l], half), 1);
    assert.deepEqual(errors, []);
  });
  test('Main flat, the picture turned (the zones cleared), then Undo in Edit sections: the zones and Main flat are back', async () => {
    const { page, errors } = await openApp();
    await answerAsks(page);
    await sampleGuide(page);
    await idle(page);
    await shadingOn(page);
    await makeZone(page, await bigSecs(page, 4, 'top'), 'Bell');
    await shadeTab(page);
    await chip(page, 0);
    await page.click('#sfZoneShade');
    await idle(page);
    await page.click('#sfBack2');
    await idle(page);
    await page.click('#sfAdjToggle');
    await idle(page);
    await page.click('#sfRotR');
    await idle(page, 3000);
    await buildGo(page);
    await idle(page);
    assert.deepEqual(await page.evaluate(() => [__mstest.zones.length, __mstest.styleVars.shadeMain]), [
      0,
      true,
    ]);
    await page.click('#sfBack2');
    await idle(page);
    await page.click('#sfPlanUndo');
    await idle(page, 3000);
    await buildGo(page);
    await idle(page);
    assert.deepEqual(
      await page.evaluate(() => [__mstest.zones.map((z) => z.name), __mstest.styleVars.shadeMain]),
      [['Bell'], false],
    );
    assert.deepEqual(errors, []);
  });
  test('by keyboard, the Shading row (Off and the styles, v318.16) keeps the focus on the one chosen', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await shadeTab(page);
    await page.focus('#sfShade [data-v="dramatic"]');
    await page.keyboard.press('Enter');
    await idle(page);
    assert.equal(
      await page.evaluate(() => {
        const a = document.activeElement;
        return a && a.closest('#sfShade') ? a.dataset.v : a && a.tagName;
      }),
      'dramatic',
    );
    assert.deepEqual(errors, []);
  });
  test('choosing a zone’s sections with shading on: the sun is out of the way (a drag where it was picks sections, not the light)', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await shadingOn(page);
    const sunShown = () =>
      page.evaluate(() => {
        const s = document.getElementById('sfSun');
        return !!s && s.style.display !== 'none';
      });
    assert.equal(await sunShown(page), true);
    await page.click('.sftabbtn[data-t="pattern"]');
    await idle(page);
    await page.click('#sfZoneAdd');
    await idle(page);
    assert.equal(await sunShown(page), false, 'no sun in the zone editor');
    const sun0 = await page.evaluate(() => JSON.stringify(__mstest.styleVars.shadeSun));
    // a tap where the sun sits (top left): the section there, if any, joins; the light stays put
    await scrollTop(page);
    const p = await page.evaluate(() => {
      const c = document.getElementById('sfCanvas').getBoundingClientRect(),
        s = __mstest.styleVars.shadeSun;
      return { x: c.left + c.width * s.x, y: c.top + c.height * s.y };
    });
    await page.mouse.click(p.x, p.y);
    await idle(page);
    assert.equal(await page.evaluate(() => JSON.stringify(__mstest.styleVars.shadeSun)), sun0);
    await page.click('#sfZoneDone');
    await idle(page);
    assert.equal(await sunShown(page), true, 'back after Done');
    assert.deepEqual(errors, []);
  });
}

// ---- from zones.test.mjs ----
// Zones (v279): parts of the picture with their own pattern and colours. ＋ Zone opens the zone editor (tap or drag
// across sections to add them, start on one in the zone to take them out); the chips at the top of Pattern and
// Colours choose which zone those tabs edit. Main holds the rest. Shading, texture and the photo are the whole
// guide's. Zones are saved with the guide, taken back by Undo, follow section edits, and Colour along can go zone by
// zone.
{
  const Z = (page) =>
    page.evaluate(() => ({
      cur: __mstest.zoneCur,
      edit: __mstest.zoneEdit,
      list: __mstest.zones.map((z) => ({ id: z.id, name: z.name, n: Object.keys(z.secs).length })),
    }));
  const assignOf = (page) =>
    page.evaluate(() => {
      const a = __mstest.assignData.assign,
        o = {};
      for (const l in a) o[l] = a[l].mkey;
      return o;
    });
  const zoneOfAll = (page) =>
    page.evaluate(() => {
      const o = {};
      for (const l in __mstest.assignData.assign) o[l] = __mstest.zoneOf(+l);
      return o;
    });
  const undoLabel = (page) => page.getAttribute('#sfPlanUndo', 'aria-label');
  // the n biggest sections whose middle is in the top (or bottom) part of the picture
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
  // ＋ Zone (or ＋ among the chips), then tap these sections, then Done
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
  test('＋ Zone: the editor, taps add and take out sections (one Undo step each), the picture shows the zone, Done shows the chips', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await page.click('.sftabbtn[data-t="pattern"]');
    await idle(page);
    assert.ok(await page.isVisible('#sfZoneAdd'), '＋ Zone beside Colour pattern');
    assert.equal(await page.$('.sfzrow'), null, 'no chips without zones');
    await page.click('#sfZoneAdd');
    await idle(page);
    let z = await Z(page);
    assert.equal(z.edit, true);
    assert.equal(z.list.length, 1);
    assert.equal(z.cur, z.list[0].id);
    assert.equal(z.list[0].name, 'Zone 1');
    assert.equal(await page.inputValue('#sfZoneName'), 'Zone 1');
    assert.match(await page.textContent('#sfZoneN'), /No sections yet/);
    assert.notEqual(
      await page.evaluate(() => document.activeElement.id),
      'sfZoneName',
      'a click leaves the name field alone',
    );
    assert.equal(await page.$('#sfFam'), null, "the editor takes the Pattern tab's place");
    assert.equal(await page.evaluate(() => __mstest.planCount), 0, 'opening the editor is no change yet');
    // a finger on the picture adds sections instead of scrolling the page (as Paint does)
    assert.equal(await page.evaluate(() => document.getElementById('sfPicBox').style.touchAction), 'none');
    // every section faded while the zone has none
    const faded = () =>
      page.evaluate(() => {
        const c = document.getElementById('sfCanvas'),
          g = c.getContext('2d'),
          t = __mstest;
        let f = 0,
          n = 0;
        for (const l in t.assignData.assign) {
          const p = t.labelPos(+l);
          const k = c.width / t.W,
            d = g.getImageData(Math.round(p.x * k), Math.round(p.y * k), 1, 1).data;
          n++;
          if (d[0] + d[1] + d[2] > 3 * 205) f++;
        }
        return f / n;
      });
    assert.ok((await faded(page)) > 0.9, 'the picture fades the sections not in the zone');
    const [a, b, c] = await bigSecs(page, 3, 'top');
    await tapSec(page, a);
    z = await Z(page);
    assert.equal(z.list[0].n, 1);
    assert.equal(await page.evaluate((a) => __mstest.zoneOf(a), a), z.cur);
    assert.match(await page.textContent('#sfZoneN'), /1 section in Zone 1/);
    assert.equal(await undoLabel(page), 'Undo: Zone 1: 1 section added');
    await tapSec(page, b);
    await tapSec(page, c);
    assert.equal((await Z(page)).list[0].n, 3);
    assert.equal(await undoLabel(page), 'Undo: Zone 1: 1 section added');
    // a tap on one already in it takes it out
    await tapSec(page, b);
    assert.equal((await Z(page)).list[0].n, 2);
    assert.equal(await page.evaluate((b) => __mstest.zoneOf(b), b), 0, 'back in Main');
    assert.equal(await undoLabel(page), 'Undo: Zone 1: 1 section taken out');
    await page.click('#sfPlanUndo');
    await idle(page);
    assert.equal((await Z(page)).list[0].n, 3, 'Undo puts it back in the zone');
    // Done: chips, the zone's on (with ✎), Main first
    await page.click('#sfZoneDone');
    await idle(page);
    z = await Z(page);
    assert.equal(z.edit, false);
    assert.equal(
      await page.evaluate(() => document.getElementById('sfPicBox').style.touchAction),
      'pan-y',
      'the page scrolls under a finger again',
    );
    const chips = await page.$$eval('#sfPanel-pattern .sfzchip', (bs) =>
      bs.map((b) => [b.dataset.z, b.textContent, b.getAttribute('aria-pressed')]),
    );
    assert.deepEqual(chips, [
      ['0', 'Main', 'false'],
      [String(z.cur), 'Zone 1', 'true'],
      ['new', '', null],
    ]);
    assert.ok(await page.isVisible('#sfFam'), 'the Pattern tab again, now for the zone');
    assert.ok(await page.$('#sfPanel-colours .sfzrow'), 'Colours has the chips too');
    assert.equal(
      await page.$('#sfPanel-shading .sfzrow'),
      null,
      'Shading is off here, so no chips there (with it on, each zone has its own shading: zones-shading.test.mjs)',
    );
    // Enter on the chip that's on opens the editor with the name field focused; by touch or mouse it isn't (a phone's
    // keyboard would come up over the picture)
    await page.focus('#sfPanel-pattern .sfzchip.on');
    await page.keyboard.press('Enter');
    await idle(page);
    assert.equal((await Z(page)).edit, true);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'sfZoneName');
    await page.click('#sfZoneDone');
    await idle(page);
    assert.equal(
      await page.evaluate(() => document.activeElement.classList.contains('sfzchip')),
      true,
      'Done puts the focus back on the chip',
    );
    await page.click('#sfPanel-pattern .sfzchip.on');
    await idle(page);
    assert.equal((await Z(page)).edit, true);
    assert.notEqual(await page.evaluate(() => document.activeElement.id), 'sfZoneName');
    assert.deepEqual(errors, []);
  });
  test("a zone's own pattern changes only its sections; Main (even Random) keeps its colours; the chips switch what the tabs edit", async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    // Main as Random first
    await page.click('.sftabbtn[data-t="pattern"]');
    await page.click('#sfFam [data-v="random"]');
    await idle(page);
    await makeZone(page, await bigSecs(page, 4, 'top'), 'Bell');
    const zid = (await Z(page)).cur,
      zo = await zoneOfAll(page),
      before = await assignOf(page);
    // the new zone starts with the settings Main had
    assert.equal(await page.getAttribute('#sfFam [data-v="random"]', 'aria-pressed'), 'true');
    await page.click('#sfFam [data-v="gradient"]');
    await idle(page);
    assert.equal(await undoLabel(page), 'Undo: Bell: Pattern: Gradient');
    const after1 = await assignOf(page);
    for (const l in before)
      if (zo[l] === 0) assert.equal(after1[l], before[l], `Main section ${l} kept its marker`);
    await page.click('#sfShape [data-v="radial"]');
    await idle(page);
    const after2 = await assignOf(page);
    for (const l in before)
      if (zo[l] === 0) assert.equal(after2[l], before[l], `Main section ${l} still kept its marker`);
    // Main's chip: the tabs show Main's settings (Random), and it's Main's pattern that changes
    const n0 = await page.evaluate(() => __mstest.planCount);
    await page.click('#sfPanel-pattern .sfzchip[data-z="0"]');
    await idle(page);
    assert.equal((await Z(page)).cur, 0);
    assert.equal(await page.getAttribute('#sfFam [data-v="random"]', 'aria-pressed'), 'true');
    assert.equal(await page.evaluate(() => __mstest.planCount), n0, 'switching zones is no change');
    assert.equal(
      await page.evaluate(() => {
        const a = document.activeElement;
        return a.dataset.z + ' ' + !!a.closest('#sfPanel-pattern');
      }),
      '0 true',
      'the focus stays on the chip chosen',
    );
    await page.click('#sfFam [data-v="blend"]');
    await idle(page);
    assert.equal(await undoLabel(page), 'Undo: Main: Pattern: Blend');
    const after3 = await assignOf(page);
    for (const l in before)
      if (zo[l] === zid) assert.equal(after3[l], after2[l], `Bell section ${l} kept its marker`);
    // back to Bell: its Radial gradient is there; Colours says "this zone"
    await page.click('#sfPanel-pattern .sfzchip[data-z="' + zid + '"]');
    await idle(page);
    assert.equal(await page.getAttribute('#sfShape [data-v="radial"]', 'aria-pressed'), 'true');
    await page.click('.sftabbtn[data-t="colours"]');
    await idle(page);
    assert.match(await page.textContent('#sfPanel-colours .sfmkcount'), /Markers in this zone/);
    assert.equal(await page.getAttribute('#sfPanel-colours .sfzchip.on', 'data-z'), String(zid));
    assert.deepEqual(errors, []);
  });
  test("a gradient in a zone runs over the zone itself (Radial starts from the zone's own middle)", async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    const secs = await bigSecs(page, 8, 'bottom');
    await makeZone(page, secs, 'Foot');
    await page.click('#sfShape [data-v="radial"]');
    await page.click('#sfLook [data-v="smooth"]');
    await idle(page);
    const r = await page.evaluate(() => {
      const t = __mstest,
        z = t.zoneCur,
        secs = t.zoneSecs(z);
      // the zone's flow, first section first (by distance from the middle of the zone's box)
      const first = t.assignData.order.filter((l) => t.zoneOf(l) === z)[0];
      return {
        first,
        firstKey: t.assignData.assign[first].mkey,
        start: t.gradStartInfo().cols[0].mkey,
        n: secs.length,
      };
    });
    assert.equal(r.n, secs.length);
    assert.equal(r.firstKey, r.start, "the zone's flow starts with its own start colour at its own middle");
    // and that first section is the one nearest the middle of the zone's box, not of the picture
    const near = await page.evaluate(() => {
      const t = __mstest,
        secs = t.zoneSecs(t.zoneCur);
      const B = (() => {
        const b = { x0: 1e9, y0: 1e9, x1: -1, y1: -1 };
        for (let p = 0; p < t.W * t.H; p++) {
          const l = t.labels[p];
          if (secs.indexOf(l) >= 0) {
            const x = p % t.W,
              y = (p / t.W) | 0;
            if (x < b.x0) b.x0 = x;
            if (x > b.x1) b.x1 = x;
            if (y < b.y0) b.y0 = y;
            if (y > b.y1) b.y1 = y;
          }
        }
        return b;
      })();
      const mx = (B.x0 + B.x1 + 1) / 2,
        my = (B.y0 + B.y1 + 1) / 2;
      return secs
        .slice()
        .sort(
          (a, b) =>
            Math.hypot(t.comps[a].cx - mx, t.comps[a].cy - my) -
            Math.hypot(t.comps[b].cx - mx, t.comps[b].cy - my),
        )[0];
    });
    assert.equal(r.first, near);
    assert.deepEqual(errors, []);
  });
  test('rename, delete (sections back to Main) and Undo; an empty new zone is dropped at Done; Escape closes the editor', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    const secs = await bigSecs(page, 2, 'top');
    await makeZone(page, secs);
    const zid = (await Z(page)).cur;
    await page.click('#sfPanel-pattern .sfzchip.on');
    await idle(page);
    assert.equal((await Z(page)).edit, true, "the chip that's on opens the editor");
    await page.fill('#sfZoneName', '  Bell  ');
    await page.press('#sfZoneName', 'Enter');
    await idle(page);
    assert.equal((await Z(page)).list[0].name, 'Bell');
    assert.equal(await undoLabel(page), 'Undo: Zone renamed: Bell');
    // Escape in the name field puts the name back; Escape outside it closes the editor
    await page.fill('#sfZoneName', 'Nope');
    await page.press('#sfZoneName', 'Escape');
    await idle(page);
    assert.equal(await page.inputValue('#sfZoneName'), 'Bell');
    assert.equal((await Z(page)).edit, true);
    await page.keyboard.press('Escape');
    await idle(page);
    assert.equal((await Z(page)).edit, false, 'Escape closes the editor');
    // delete: its sections go back to Main; Undo brings the zone back with them
    await page.click('#sfPanel-pattern .sfzchip.on');
    await idle(page);
    await page.click('#sfZoneDel');
    await idle(page);
    let z = await Z(page);
    assert.deepEqual(z.list, []);
    assert.equal(z.cur, 0);
    assert.equal(await page.$('.sfzrow'), null);
    assert.equal(await undoLabel(page), 'Undo: Zone deleted: Bell');
    await page.click('#sfPlanUndo');
    await idle(page);
    z = await Z(page);
    assert.deepEqual(
      z.list.map((x) => [x.id, x.name, x.n]),
      [[zid, 'Bell', 2]],
    );
    // a new zone given no sections goes at Done, and leaves no Undo step
    const steps = await page.evaluate(() => __mstest.planCount);
    await page.click('#sfPanel-pattern .sfzchip.sfzadd');
    await idle(page);
    assert.equal((await Z(page)).list.length, 2);
    await page.click('#sfZoneDone');
    await idle(page);
    assert.equal((await Z(page)).list.length, 1, 'the empty zone is dropped');
    assert.equal(await page.evaluate(() => __mstest.planCount), steps);
    // another tab closes the editor too
    await page.click('#sfPanel-pattern .sfzchip.on');
    await idle(page);
    await page.click('.sftabbtn[data-t="shading"]');
    await idle(page);
    assert.equal((await Z(page)).edit, false);
    assert.deepEqual(errors, []);
  });
  test('a drag across sections adds them all as one step; starting on one in the zone takes them out', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await page.click('.sftabbtn[data-t="pattern"]');
    await page.click('#sfZoneAdd');
    await idle(page);
    await scrollTop(page);
    const c = await page.evaluate(() => {
      const r = document.getElementById('sfCanvas').getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height };
    });
    const drag = async (y) => {
      await page.mouse.move(c.x + c.w * 0.1, c.y + c.h * y);
      await page.mouse.down();
      for (let i = 1; i <= 24; i++) await page.mouse.move(c.x + c.w * (0.1 + (0.8 * i) / 24), c.y + c.h * y);
      await page.mouse.up();
      await idle(page);
    };
    await drag(0.55);
    const n1 = (await Z(page)).list[0].n,
      steps = await page.evaluate(() => __mstest.planCount);
    assert.ok(n1 >= 3, `a drag across the picture added several (${n1})`);
    assert.equal(steps, 1, 'one step for the whole drag');
    // the same line again, starting on a section in the zone: all of them out
    await drag(0.55);
    assert.equal((await Z(page)).list[0].n, 0, 'taken out again');
    assert.deepEqual(errors, []);
  });
  test("zones are saved with the guide and open again as they were (Main's settings stay the guide's style, for older copies)", async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await makeZone(page, await bigSecs(page, 3, 'top'), 'Bell');
    await page.click('#sfFam [data-v="random"]');
    await idle(page);
    const zid = (await Z(page)).cur,
      before = await assignOf(page),
      zo = await zoneOfAll(page);
    const d = await page.evaluate(() => __mstest.currentDesignObj());
    assert.equal(
      d.payload.style.family,
      'gradient',
      "the guide's style is Main's, though Bell is being edited",
    );
    assert.equal(d.payload.zones.length, 1);
    assert.equal(d.payload.zones[0].name, 'Bell');
    assert.equal(d.payload.zones[0].style.family, 'random');
    assert.equal(d.payload.zones[0].secs.length, 3);
    // saved in the Library, reopened after a reload
    await saveGuide(page);
    const id = await page.evaluate(() => __mstest.curId);
    await page.reload();
    await idle(page);
    await page.evaluate((id) => loadGuide({ id }), id);
    await page.waitForFunction((id) => __mstest.curId === id && __mstest.assignData, id);
    await idle(page);
    const z = await Z(page);
    assert.equal(z.cur, 0, 'opens on Main');
    assert.deepEqual(
      z.list.map((x) => [x.name, x.n]),
      [['Bell', 3]],
    );
    assert.deepEqual(await assignOf(page), before, "every section's marker as saved");
    const zo2 = await zoneOfAll(page);
    for (const l in zo) assert.equal(zo2[l] !== 0, zo[l] !== 0, `section ${l} in the same zone`);
    assert.equal(await page.evaluate(() => __mstest.zoneRec(__mstest.zones[0].id).st.family), 'random');
    void zid;
    assert.deepEqual(errors, []);
  });
  test('a tapped section\'s tip says its zone, and "Edit this zone" goes to it', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    const secs = await bigSecs(page, 2, 'top');
    await makeZone(page, secs, 'Bell');
    await page.click('#sfPanel-pattern .sfzchip[data-z="0"]');
    await idle(page);
    await tapSec(page, secs[0]);
    assert.match(await page.textContent('.sftip'), /Zone: Bell/);
    await page.click('.sftip [data-a="zone"]');
    await idle(page);
    assert.equal((await Z(page)).cur, (await Z(page)).list[0].id);
    assert.equal(
      await page.getAttribute('#sfPanel-pattern .sfzchip.on', 'data-z'),
      String((await Z(page)).list[0].id),
    );
    assert.deepEqual(errors, []);
  });
  test('Blend in a zone: its anchors are its own, seeded inside it; a tap in another zone says where that is', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    const secs = await bigSecs(page, 6, 'bottom');
    await makeZone(page, secs, 'Foot');
    await page.click('#sfFam [data-v="blend"]');
    await idle(page);
    const r = await page.evaluate(() => {
      const t = __mstest,
        B = { y0: 1e9 };
      t.zoneSecs(t.zoneCur).forEach((l) => {
        B.y0 = Math.min(B.y0, t.comps[l].cy);
      });
      return {
        anchors: t.zoneRec(t.zoneCur).an.length,
        main: t.zoneRec(0).an.length,
        minY: B.y0,
        ay: t.zoneRec(t.zoneCur).an.map((a) => a.y),
      };
    });
    assert.equal(r.anchors, 3);
    assert.equal(r.main, 0, 'Main (a Gradient) has none');
    assert.ok(
      r.ay.every((y) => y > r.minY - 200),
      "the anchors are in the zone's part of the picture",
    );
    // a tap on a section in Main
    const [top] = await bigSecs(page, 1, 'top');
    await tapSec(page, top);
    assert.match(await page.textContent('#msToast'), /That section is in Main/);
    assert.equal(
      await page.evaluate(() => __mstest.zoneRec(__mstest.zoneCur).an.length),
      3,
      'no anchor added',
    );
    assert.deepEqual(errors, []);
  });
  test('Edit sections: a zone keeps its sections through leaving one out and bringing it back', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    const secs = await bigSecs(page, 3, 'top');
    await makeZone(page, secs, 'Bell');
    const zid = (await Z(page)).cur;
    await page.click('#sfBack2');
    await idle(page);
    // leave one out, build, then bring it back, build
    await page.evaluate((l) => {
      __mstest.secState[l] = 2;
    }, secs[1]);
    await buildGo(page);
    await idle(page);
    assert.equal(await page.evaluate((l) => !!__mstest.assignData.assign[l], secs[1]), false);
    assert.deepEqual(
      await page.evaluate(() => __mstest.zoneSecs(__mstest.zones[0].id)).then((a) => a.sort()),
      [secs[0], secs[2]].sort(),
    );
    await page.click('#sfBack2');
    await idle(page);
    await page.evaluate((l) => {
      __mstest.secState[l] = 0;
    }, secs[1]);
    await buildGo(page);
    await idle(page);
    assert.equal(await page.evaluate((l) => __mstest.zoneOf(l), secs[1]), zid, 'back in its zone');
    assert.deepEqual(errors, []);
  });
  test("Colour along zone by zone: each zone's markers under its name; a row lights, ticks and finds only its zone's sections; focus mode goes zone by zone", async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    const secs = await bigSecs(page, 5, 'top');
    await makeZone(page, secs, 'Bell');
    // the zone uses Main's markers too (same Gradient settings), so a marker is likely in both
    await page.click('#sfColor');
    await idle(page);
    assert.ok(await page.isVisible('#sfAlOrder'), 'the choice shows with zones');
    assert.equal(await page.getAttribute('#sfAlOrder [data-v="whole"]', 'aria-pressed'), 'true');
    const wholeRows = await page.$$eval('#sfAlist .sfarow', (r) => r.length);
    await page.click('#sfAlOrder [data-v="zones"]');
    await idle(page);
    const heads = await page.$$eval('#sfAlist .sfazh b', (b) => b.map((x) => x.textContent));
    assert.deepEqual(heads, ['Main', 'Bell']);
    const rows = await page.$$eval('#sfAlist .sfarow', (r) => r.map((x) => x.dataset.k));
    assert.ok(rows.length >= wholeRows, 'a marker in two zones has a row in each');
    assert.ok(rows.every((k) => /@\d+$/.test(k)));
    // open Bell's first row: only Bell's sections of that marker are lit, ticked by Mark all done
    const zid = await page.evaluate(() => __mstest.zones[0].id);
    const i = rows.findIndex((k) => k.endsWith('@' + zid));
    await page.locator('#sfAlist .sfarow .sfah').nth(i).click();
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.hlZone), zid);
    const k = rows[i].split('@')[0];
    const path = await page.evaluate(() => __mstest.hlPath());
    assert.ok(path.length >= 1);
    assert.ok(
      await page.evaluate(([p, zid]) => p.every((l) => __mstest.zoneOf(l) === zid), [path, zid]),
      'Find next stays in the zone',
    );
    await page.click('#sfMarkAll');
    await idle(page);
    const ticked = await page.evaluate(
      ([k, zid]) => {
        const t = __mstest,
          a = t.assignData.assign;
        let inZ = 0,
          out = 0;
        for (const l in a)
          if (a[l].mkey === k) {
            if (t.colored[l]) t.zoneOf(+l) === zid ? inZ++ : out++;
          }
        return { inZ, out };
      },
      [k, zid],
    );
    assert.ok(ticked.inZ >= 1);
    assert.equal(ticked.out, 0, "Mark all done ticks only the zone's sections");
    // focus mode: zone by zone, Main first
    await page.click('#sfFocus');
    await idle(page);
    const z1 = await page.evaluate(() => {
      const t = __mstest;
      return t.focusOrd.map((l) => t.zoneOf(l));
    });
    const firstBell = z1.indexOf(zid),
      lastMain = z1.lastIndexOf(0);
    assert.ok(firstBell > lastMain, 'all of Main before Bell');
    assert.deepEqual(errors, []);
  });
  test(
    'with zones, Pattern, Colours and Shading fit in about one and a half screens of room at 390×844 besides their row of chips (and Shading’s “Shade Bell”)',
    notOnWebKit(WK.font),
    async () => {
      // (v318.16: as the app comes on a phone, More options shut)
      const { page, errors } = await openApp({ moreShut: true });
      await sampleGuide(page);
      await idle(page);
      await page.click('.sftabbtn[data-t="shading"]');
      await page.evaluate(() => __mstest.shadeTo('full'));
      await idle(page);
      await makeZone(page, await bigSecs(page, 2, 'top'), 'Bell');
      // (as tabs.test.mjs measures: the helper lines already seen, the tabs pinned under the picture at its floor size)
      await page.evaluate(() => document.querySelectorAll('.sfinfo.open').forEach((b) => b.click()));
      for (const tb of ['colours', 'pattern', 'shading']) {
        await page.click(`.sftabbtn[data-t="${tb}"]`);
        await idle(page);
        await page.evaluate(
          () =>
            new Promise((r) => {
              const t = document.querySelector('.sftabs'),
                s = document.querySelector('.sftabsen'),
                cs = getComputedStyle(t);
              scrollTo(
                0,
                Math.round(
                  scrollY + s.getBoundingClientRect().top + parseFloat(cs.marginTop) - parseFloat(cs.top),
                ),
              );
              requestAnimationFrame(() => requestAnimationFrame(r));
            }),
        );
        await idle(page);
        // (the row of chips is extra room zones take, one 40px row of tap targets: the rest still fits as before)
        // (Shading's "Shade Bell" line is extra too: v281)
        const m = await page.evaluate((s) => {
          const h = (e) =>
              e
                ? e.getBoundingClientRect().height +
                  parseFloat(getComputedStyle(e).marginTop) +
                  parseFloat(getComputedStyle(e).marginBottom)
                : 0,
            r = document.querySelector(s + ' .sfzrow');
          return {
            h: document.querySelector(s).scrollHeight,
            chips: h(r),
            shade: h(document.querySelector(s + ' .sfzshade')),
            room: parseFloat(
              getComputedStyle(document.getElementById('sfWork')).getPropertyValue('--tabMin'),
            ),
            info: document.querySelectorAll(s + ' button.sfinfo:not(.open)').length,
          };
        }, `.sftab[data-tab="${tb}"]`);
        assert.ok(m.chips > 0 && m.chips <= 64, `${tb}: the chips take one row (${m.chips}px)`);
        assert.ok(
          tb !== 'shading' || (m.shade > 0 && m.shade <= 40),
          `shading: "Shade Bell" is one line (${m.shade}px)`,
        );
        // (v288: Colours has the "N markers on this page ›" button too, 44px and its margin)
        // (v308: Colours' 120px more, the marker count's 44px − and + and Include's row of chips)
        // (v318.16: Shading's rows under More options on a phone, so v318.15's 140px for them is gone; Pattern 20px more for
        // the 44px choices and 13px row names, as e2e/tabs allows)
        assert.ok(
          m.h - m.chips - m.shade <=
            m.room * 1.5 + 2 + 16 * m.info + (tb === 'colours' ? 54 + 120 : 0) + (tb === 'pattern' ? 20 : 0),
          `${tb}: ${m.h}px (${m.chips}px of chips, ${m.shade}px of Shade Bell) against ${m.room}px of room`,
        );
      }
      assert.deepEqual(errors, []);
    },
  );
  test('sections found again (Enhance in Edit sections): each joins the zone most of its pixels were in', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    const secs = await bigSecs(page, 4, 'top');
    await makeZone(page, secs, 'Bell');
    // where the zone's sections are (their middles), to find them again after the sections are found afresh
    const pts = await page.evaluate(
      (secs) =>
        secs.map((l) => {
          const p = __mstest.labelPos(l);
          return [Math.round(p.x), Math.round(p.y)];
        }),
      secs,
    );
    await page.click('#sfBack2');
    await idle(page);
    await answerAsks(page);
    await page.click('#sfAdjToggle');
    await idle(page);
    await page.click('#sfEnh');
    await idle(page, 2000);
    await buildGo(page);
    await idle(page);
    const r = await page.evaluate((pts) => {
      const t = __mstest;
      return pts.map(([x, y]) => {
        const l = t.labels[y * t.W + x];
        return l > 0 ? t.zoneOf(l) : -1;
      });
    }, pts);
    const zid = (await Z(page)).list[0] && (await Z(page)).list[0].id;
    assert.ok(zid, 'the zone is still there');
    assert.ok(r.filter((z) => z === zid).length >= 3, `the zone's parts are in it again (${r})`);
    assert.deepEqual(errors, []);
  });
  test('a zone with the Photo pattern takes its colours from the one photo; Main keeps its pattern; the photo is kept in a shared guide file', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await makeZone(page, await bigSecs(page, 6, 'bottom'), 'Foot');
    const zo = await zoneOfAll(page),
      before = await assignOf(page);
    // a two-colour photo: blue on top, red below
    const b64 = await page.evaluate(async () => {
      const c = document.createElement('canvas');
      c.width = 600;
      c.height = 800;
      const g = c.getContext('2d');
      g.fillStyle = '#2350c8';
      g.fillRect(0, 0, 600, 400);
      g.fillStyle = '#d0282c';
      g.fillRect(0, 400, 600, 400);
      const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
      return await new Promise((r) => {
        const f = new FileReader();
        f.onload = () => r(f.result.split(',')[1]);
        f.readAsDataURL(blob);
      });
    });
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#sfFam [data-v="photo"]')]);
    await fc.setFiles({ name: 'ref.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
    await page.waitForFunction(() => !!__mstest.photoRef && !__mstest.photoChecking);
    await idle(page);
    // stretched over the picture: the foot (the bottom of the picture) is under the red half
    await page.evaluate(() => {
      const M = __mstest,
        r = M.photoRef;
      M.photoXf = { cx: M.W / 2, cy: M.H / 2, sx: M.W / r.w, sy: M.H / r.h, r: 0 };
      M.photoRecolour();
    });
    await idle(page);
    const after = await assignOf(page);
    const reds = await page.evaluate((zo) => {
      const t = __mstest,
        a = t.assignData.assign;
      let red = 0,
        n = 0;
      for (const l in a)
        if (zo[l] !== 0) {
          n++;
          const L = a[l].lab;
          if (L && L[1] > 25) red++;
        }
      return { red, n };
    }, zo);
    assert.ok(reds.red >= reds.n - 1, `the foot's sections are red (${reds.red} of ${reds.n})`);
    for (const l in before)
      if (zo[l] === 0) assert.equal(after[l], before[l], `Main section ${l} kept its marker`);
    const d = await page.evaluate(() => __mstest.currentDesignObj(true));
    assert.ok(d.payload.ref, 'a shared guide file keeps the photo a zone uses');
    assert.equal(d.payload.style.family, 'gradient', 'Main is still a Gradient');
    assert.equal(d.payload.zones[0].style.family, 'photo');
    assert.deepEqual(errors, []);
  });
  test('a zone with no sections (Main, when every section is in a zone) says so, and every pattern still builds', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await makeZone(page, await bigSecs(page, 2, 'top'), 'Bell');
    const zid = (await Z(page)).cur;
    assert.equal(await page.$('#sfPanel-pattern .sfznone'), null, 'no note while the zone has sections');
    await page.evaluate((id) => {
      const t = __mstest;
      t.zoneMove(t.zoneSecs(0), id);
      t.reassign();
    }, zid);
    await idle(page);
    await page.click('#sfPanel-pattern .sfzchip[data-z="0"]');
    await idle(page);
    assert.match(
      await page.textContent('#sfPanel-pattern .sfznone'),
      /Every section is in a zone, so Main has none to colour/,
    );
    assert.match(await page.textContent('#sfPanel-colours .sfznone'), /Main has none/);
    for (const f of ['random', 'blend', 'manual', 'gradient']) {
      await page.click('#sfFam [data-v="' + f + '"]');
      await idle(page);
    }
    await page.click('#sfShape [data-v="radial"]');
    await idle(page);
    // Colour along zone by zone: no heading for Main
    await page.click('#sfColor');
    await idle(page);
    await page.click('#sfAlOrder [data-v="zones"]');
    await idle(page);
    assert.deepEqual(await page.$$eval('.sfazh', (hs) => hs.map((h) => h.firstChild.textContent)), ['Bell']);
    await page.click('#sfAlOrder [data-v="whole"]');
    await idle(page);
    await page.click('#sfDoneBtn');
    await idle(page);
    // the zone's sections all back in Main: now it's the zone that says so
    await page.evaluate((id) => {
      const t = __mstest;
      t.zoneMove(t.zoneSecs(id), 0);
      t.reassign();
    }, zid);
    await idle(page);
    await page.click('.sftabbtn[data-t="pattern"]');
    await idle(page);
    await page.click(`#sfPanel-pattern .sfzchip[data-z="${zid}"]`);
    await idle(page);
    assert.match(
      await page.textContent('#sfPanel-pattern .sfznone'),
      /No sections in Bell now: tap its chip to add some/,
    );
    assert.deepEqual(errors, []);
  });
}

// ---- from v298.test.mjs ----
// v298: fixes from the second fresh-eyes review of v297 — ticks follow merged and split sections; Focus mode says
// where it is up to; zones keep touching sections apart across their borders; a guide file with odd keys opens; the
// sets list follows Clear collection; and Scan's box: the same text again is still cleared, Enter then the same cap
// again is read, letters composed by an Android keyboard wait for Enter, and a card isn't repeated while held.
{
  test('zones: touching sections either side of a zone’s border don’t share a marker when the pattern keeps them apart', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await page.click('.sftabbtn[data-t="pattern"]');
    await idle(page);
    await page.click('#sfFam [data-v="random"]');
    await idle(page);
    await page.click('#sfBal [data-v="mixed"]');
    await idle(page);
    await page.evaluate(() => {
      __mstest.styleVars.noAdj = true;
    });
    await page.click('#sfZoneAdd');
    await idle(page);
    await page.evaluate(() => {
      const t = __mstest,
        cl = Object.keys(t.assignData.assign)
          .map(Number)
          .filter((l) => t.comps[l].cy > t.H * 0.5);
      t.zoneMove(cl, t.zoneCur);
      t.reassign([0, t.zoneCur]);
    });
    await page.click('#sfZoneDone');
    await idle(page);
    await page.evaluate(() => {
      __mstest.styleVars.noAdj = true;
    });
    const clash = await page.evaluate(() => {
      const t = __mstest,
        ids = [0].concat(t.zones.map((z) => z.id));
      let n = 0,
        pairs = 0;
      for (let r = 0; r < 8; r++) {
        t.reassign(ids);
        const A = t.assignData.assign,
          adj = t.adj;
        for (const l in A)
          if (adj[l])
            adj[l].forEach((q) => {
              if (+q > +l && A[q] && t.zoneOf(+l) !== t.zoneOf(+q)) {
                pairs++;
                if (A[q].mkey === A[l].mkey) n++;
              }
            });
      }
      return { n, pairs };
    });
    assert.ok(clash.pairs > 20, 'pairs across the border: ' + clash.pairs);
    assert.equal(clash.n, 0, `${clash.n} of ${clash.pairs} touching pairs across the border share a marker`);
    assert.deepEqual(errors, []);
  });
}

// ---- from v3091-d1.test.mjs ----
// v309.1 (debugging pass, making a guide): fixes found by reviewer 1, each failing before its fix.
{
  const focused = (page) =>
    page.evaluate(() => {
      const a = document.activeElement;
      return !a || a === document.body
        ? 'body'
        : a.id || (a.classList.contains('sfzchip') ? 'chip:' + a.dataset.z : a.tagName);
    });
  // The zone editor closed by Escape from one of its own controls (Done, Delete zone, "Choose sections with the keys", or
  // the name field once Escape there has put the name back) left the keyboard on the page itself: its controls are
  // drawn again as the editor closes. Now the keyboard goes to the zone's chip, or to ＋ Zone when the new zone is dropped.
  test('the zone editor closed by Escape from its own controls gives the keyboard to the zone’s chip (or ＋ Zone)', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await page.click('.sftabbtn[data-t="pattern"]');
    await idle(page);
    // a new zone, no sections: Escape from Done drops it, the keyboard on ＋ Zone
    await page.focus('#sfZoneAdd');
    await page.keyboard.press('Enter');
    await idle(page);
    assert.equal(await focused(page), 'sfZoneName');
    await page.focus('#sfZoneDone');
    await page.keyboard.press('Escape');
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.zones.length), 0, 'the empty zone is dropped');
    assert.equal(await focused(page), 'sfZoneAdd', 'the keyboard on ＋ Zone');
    // the name field: Escape puts the name back (the editor stays), a second Escape closes it
    await page.keyboard.press('Enter');
    await idle(page);
    assert.equal(await focused(page), 'sfZoneName');
    await page.keyboard.press('Escape');
    await idle(page);
    assert.ok(await page.isVisible('#sfZoneDone'), 'the editor is still open');
    await page.keyboard.press('Escape');
    await idle(page);
    assert.equal(await focused(page), 'sfZoneAdd');
    // a zone with a section: Escape from "Choose sections with the keys" leaves the keyboard on the zone's chip
    await page.keyboard.press('Enter');
    await idle(page);
    const l = await page.evaluate(
      () =>
        Object.keys(__mstest.assignData.assign)
          .map(Number)
          .sort((a, b) => __mstest.comps[b].area - __mstest.comps[a].area)[0],
    );
    await scrollTop(page);
    const p = await sectionPoint(page, l);
    await page.mouse.click(p.x, p.y);
    await idle(page);
    const z = await page.evaluate(() => __mstest.zoneCur);
    assert.ok(z > 0 && (await page.evaluate(() => __mstest.zones.length)) === 1, 'a zone with a section');
    await page.focus('#sfZoneKb');
    await page.keyboard.press('Escape');
    await idle(page);
    assert.ok(!(await page.isVisible('#sfZoneDone')), 'the editor closed');
    assert.equal(await focused(page), 'chip:' + z, 'the keyboard on the zone’s chip');
    assert.deepEqual(errors, []);
  });
}

// ---- from v318-review-ux.test.mjs ----
// v318 review (UI/UX pass), and its audit: Escape leaves the photo's editors in Check the sections (Adjust corners,
// Crop) as their Cancel does, only while the Guide screen shows; the browser's Back in the first-run welcome goes back
// a step; Colour along's tap on another marker's section is said, with Undo; Tester tasks' Send results with nothing
// answered sends nothing; on a phone, a PDF that won't open is said in view. Each fails on v318 as released.
{
  // (v318 audit) the tap that finishes the page isn't said as another marker's: the page's banner says it's done, with
  // the open row closed. And Colour along zone by zone: the open row's marker, tapped in another zone, is said as that
  // zone, not as another marker. Fail on the review branch before the audit
  test('a tap that finishes the page isn’t said as another marker’s; the same marker in another zone is said as that zone', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180, storage: { 'ms-along-zones': '1' } });
    await sampleGuide(page);
    await idle(page);
    // a zone of the bottom part, and one marker in both zones
    await page.click('.sftabbtn[data-t="pattern"]');
    await idle(page);
    if (await page.$('#sfZoneAdd')) await page.click('#sfZoneAdd');
    else await page.click('#sfPanel-pattern .sfzchip.sfzadd');
    await idle(page);
    await page.fill('#sfZoneName', 'Tail');
    await page.press('#sfZoneName', 'Enter');
    await page.evaluate(() => {
      const t = __mstest,
        cl = Object.keys(t.assignData.assign)
          .map(Number)
          .filter((l) => t.comps[l].cy > t.H * 0.6);
      t.zoneMove(cl, t.zoneCur);
      t.reassign([0, t.zoneCur]);
    });
    await page.click('#sfZoneDone');
    await idle(page);
    const k = await page.evaluate(() => {
      const t = __mstest,
        A = t.assignData.assign,
        ls = Object.keys(A).map(Number),
        main = ls.filter((l) => t.zoneOf(l) === 0).sort((a, b) => t.comps[b].area - t.comps[a].area),
        m = A[main[0]],
        tail = ls.filter((l) => t.zoneOf(l) !== 0).sort((a, b) => t.comps[b].area - t.comps[a].area)[0];
      A[tail] = m;
      t.renderGuide();
      return { mk: m.mkey, main: main[0], tail: tail };
    });
    await page.click('#sfColor');
    await idle(page);
    // the marker's row in the Tail opened, then a tap on its section in Main
    await page.evaluate((mk) => {
      const r = [...document.querySelectorAll('#sfAlist .sfarow')].find(
        (x) => x.dataset.k.startsWith(mk + '@') && !x.dataset.k.endsWith('@0'),
      );
      r.querySelector('button.sfah').click();
    }, k.mk);
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.hlKey), k.mk);
    await scrollTop(page);
    const p = await sectionPoint(page, k.main);
    await page.mouse.click(p.x, p.y);
    await idle(page);
    // (v318 review, second pass: asked first, the zones named)
    assert.match(await page.textContent('.sftipask'), /not \S+ in Tail.*Open \S+ in Main/);
    await page.click('.sftipask [data-a="tick"]');
    await idle(page);
    assert.equal(await page.evaluate((l) => __mstest.colored[l], k.main), 1, 'ticked');
    // every other section ticked but one of another marker: its tap finishes the page, and nothing says "not the marker"
    const last = await page.evaluate((mk) => {
      const t = __mstest,
        A = t.assignData.assign,
        ls = t.assignData.order,
        l = ls
          .filter((x) => A[x].mkey !== mk && !t.colored[x])
          .sort((a, b) => t.comps[b].area - t.comps[a].area)[0];
      ls.forEach((x) => x !== l && (t.colored[x] = 1));
      t.renderGuide();
      return l;
    }, k.mk);
    await page.evaluate(() => hideToast());
    // (asked first: Tick it)
    await scrollTop(page);
    const q = await sectionPoint(page, last);
    await page.mouse.click(q.x, q.y);
    await idle(page);
    await page.click('.sftipask [data-a="tick"]');
    await idle(page);
    assert.equal(await page.evaluate((l) => __mstest.colored[l], last), 1);
    assert.ok(
      !(await page.evaluate(() =>
        /not the marker/.test((document.querySelector('#msToast.on') || {}).textContent || ''),
      )),
      'no word of another marker over the finished page',
    );
    assert.deepEqual(errors, []);
  });
}
