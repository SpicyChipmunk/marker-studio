// v327 (docs/PLAN-v327-photo-tones.md): photo tones on a photo-made page (Matched to the photo, the Photo style, Two
// tone sets, sections left flat, what's kept while colouring, saving), tone patches tidied, and Use up to 48 markers
// for a very colourful photo. Made-up photos only (the author's stay out of the repo).
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { answerAsks, idle, openApp, sampleGuide, setup, teardown, until } from './helpers.mjs';

before(setup);
after(teardown);

const ONBOARDED = { 'ms-onboarded': '1', 'ms-setup-tip': '1', 'ms-photo-tips': '1' };
const VIEW = { width: 820, height: 1180, storage: ONBOARDED };
// a made-up photo (JPEG): sky to ground, soft lit blobs (light in the middle, dark at the edge: light and shadow
// inside the sections) and hard shapes; with many, a hundred small patches of distinct colours as well
function photo(page, { w = 1200, h = 900, seed = 5, many = false } = {}) {
  return page.evaluate(
    ({ w, h, seed, many }) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const g = c.getContext('2d');
      let s = seed;
      const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
      const lg = g.createLinearGradient(0, 0, 0, h);
      lg.addColorStop(0, '#7fb2e0');
      lg.addColorStop(0.55, '#d8e4ec');
      lg.addColorStop(0.56, '#6c8a3c');
      lg.addColorStop(1, '#2d3f18');
      g.fillStyle = lg;
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 14; i++) {
        const x = rnd() * w,
          y = rnd() * h,
          r = 70 + rnd() * 150,
          hue = Math.round(rnd() * 360),
          rg = g.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.05, x, y, r);
        rg.addColorStop(0, `hsl(${hue},55%,78%)`);
        rg.addColorStop(0.6, `hsl(${hue},60%,48%)`);
        rg.addColorStop(1, `hsl(${hue},65%,22%)`);
        g.fillStyle = rg;
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI * 2);
        g.fill();
      }
      if (many)
        for (let i = 0; i < 100; i++) {
          g.fillStyle = `hsl(${(i * 37) % 360},${45 + (i % 4) * 15}%,${30 + (i % 5) * 12}%)`;
          g.fillRect(rnd() * w, rnd() * h, 18 + rnd() * 22, 18 + rnd() * 22);
        }
      const id = g.getImageData(0, 0, w, h),
        d = id.data;
      for (let i = 0; i < d.length; i += 4) {
        const n = (rnd() - 0.5) * 8;
        d[i] += n;
        d[i + 1] += n;
        d[i + 2] += n;
      }
      g.putImageData(id, 0, 0);
      return c.toDataURL('image/jpeg', 0.92).split(',')[1];
    },
    { w, h, seed, many },
  );
}
const file = (b64) => ({ name: 'photo.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(b64, 'base64') });
const own = (page, sets) =>
  page.evaluate((sets) => {
    state.owned = new Set();
    sets.forEach((n) => presetMkeys(MARKER_SETS.find((s) => s.n === n)).forEach((k) => state.owned.add(k)));
    SF.setCollection(sfCollection());
  }, sets);
const pageReady = (page) =>
  until(
    page,
    () =>
      !!__mstest.pp &&
      !__mstest.ppBusy &&
      /This page:/.test((document.getElementById('sfPpCount') || {}).textContent || ''),
    null,
    'the page step, its page made',
    90000,
  );
async function fromHome(page, opts) {
  const b64 = await photo(page, opts);
  const [fc] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.locator('[data-start="ppage"]:visible').first().click(),
  ]);
  await fc.setFiles(file(b64));
  await pageReady(page);
  await idle(page);
}
async function built(page) {
  await page.click('#sfBuild');
  await until(page, () => __mstest.sfmode === 'guide' && !!__mstest.assignData, null, 'built', 60000);
  await idle(page);
}
const shadingTab = async (page) => {
  await page.click('.sftabbtn[data-t="shading"]');
  await idle(page);
};
const rowKeys = (page) => page.$$eval('#sfShade button', (b) => b.map((x) => x.dataset.v));
// what the photo tones are now: sections with tones, flat, glazes, the markers added, the amounts
const tones = (page) =>
  page.evaluate(() => {
    const t = __mstest,
      r = t.ptGet();
    if (!r) return null;
    let toned = 0,
      flat = 0,
      glaze = 0,
      light = 0,
      set2 = 0;
    for (const l in r.tone) {
      const x = r.tone[l];
      if (!x) flat++;
      else {
        toned++;
        if (x.glaze) glaze++;
        if (x.light) light++;
        if (x.set === 1) set2++;
      }
    }
    return {
      toned,
      flat,
      glaze,
      light,
      set2,
      extras: r.extras.length,
      hi: t.styleVars.shadeHi,
      lo: t.styleVars.shadeLo,
      kinds: t.styleVars.shadeShadow + '/' + t.styleVars.shadeHilite,
      nFlat: r.nFlat,
    };
  });

test('photo tones: Photo in the Shading row in Rounded’s place, Matched to the photo by default, amounts the page’s own, sections left flat said, Undo', async () => {
  const { page, errors } = await openApp(VIEW);
  await idle(page);
  await own(page, ['Honolulu 120']);
  await fromHome(page);
  // (v327.1: the page made isn't said as a toast over Detail and Focus: the count line says it)
  assert.ok(
    !(await page.evaluate(() => {
      const t = document.getElementById('msToast');
      return !!t && t.classList.contains('on') && /Colouring page made/.test(t.textContent);
    })),
    'no toast for the page made',
  );
  assert.match(await page.textContent('#sfPpCount'), /This page: \d+ sections/);
  await built(page);
  await shadingTab(page);
  assert.deepEqual(await rowKeys(page), ['off', 'soft', 'dramatic', 'photo', 'neuro']);
  assert.equal(await page.getAttribute('#sfShade button.on', 'data-v'), 'off', 'shading off by default');
  // a new page's kinds: Matched to the photo
  assert.deepEqual(
    await page.evaluate(() => [__mstest.styleVars.shadeShadow, __mstest.styleVars.shadeHilite]),
    ['photo', 'photo'],
  );
  await page.click('#sfShade [data-v="photo"]');
  await idle(page, 1500);
  assert.equal(await page.getAttribute('#sfShade button.on', 'data-v'), 'photo');
  const t = await tones(page);
  assert.ok(t && t.toned > 0, 'some sections have photo tones: ' + JSON.stringify(t));
  assert.ok(t.glaze > 0, 'shadows laid over the base');
  assert.ok(
    [0.5, 0.65].includes(t.hi) && [0.65, 0.75, 0.85, 1].includes(t.lo),
    'amounts from the Photo style’s',
  );
  assert.ok(t.extras <= 4);
  assert.equal(await page.inputValue('#sfShStyle'), 'photo');
  assert.equal(await page.inputValue('#sfHiStyle'), 'photo');
  // (v327.1: named From the photo, which fits a phone's list)
  assert.equal(await page.$eval('#sfShStyle option:checked', (o) => o.textContent), 'From the photo');
  if (t.flat)
    assert.match(
      await page.textContent('#sfShEven'),
      /^Shaded from the photo: \d+ sections?\. \d+ stays? flat: tones wouldn’t make (them much closer to it|it much closer to the photo)\.$/,
    );
  // (a highlight left out as it wouldn't be closer isn't a lighter marker you lack)
  const note = () =>
    page.evaluate(() => [...document.querySelectorAll('.sfshnote')].map((e) => e.textContent).join(' '));
  assert.doesNotMatch(await note(), /no lighter marker/);
  // a flat section's tip says why
  const fl = await page.evaluate(() => {
    const r = __mstest.ptGet();
    for (const l in r.tone) if (r.tone[l] === null) return +l;
    return 0;
  });
  if (fl) assert.equal(await page.evaluate((l) => __mstest.shadeWhy(l), fl), 'even');
  // a slider moved: Custom, the Photo style no longer chosen
  await page.evaluate(() => {
    const e = document.getElementById('sfShLo');
    e.value = 40;
    e.dispatchEvent(new Event('input'));
    e.dispatchEvent(new Event('change'));
  });
  await idle(page);
  assert.equal(await page.$('#sfShade button.on'), null, 'Custom');
  // Undo twice: the Photo style, then Off
  await page.evaluate(() => __mstest.assign.planUndo());
  await idle(page);
  assert.equal(await page.getAttribute('#sfShade button.on', 'data-v'), 'photo');
  await page.evaluate(() => __mstest.assign.planUndo());
  await idle(page);
  assert.equal(await page.getAttribute('#sfShade button.on', 'data-v'), 'off');
  assert.deepEqual(errors, []);
});

test('photo tones need the photo’s light: the sun brings Rounded and Same colour back, the choice kept for the photo’s light; Neuro and the sun aren’t tidied thin', async () => {
  const { page, errors } = await openApp(VIEW);
  await idle(page);
  await own(page, ['Honolulu 120']);
  await fromHome(page);
  await built(page);
  await shadingTab(page);
  await page.click('#sfShade [data-v="photo"]');
  await idle(page, 1500);
  assert.equal(
    await page.evaluate(() => __mstest.shadeTidyThin()),
    true,
    'the thin rule with the photo’s light',
  );
  await page.click('#sfShLight [data-v="sun"]');
  await idle(page);
  assert.deepEqual(await rowKeys(page), ['off', 'soft', 'dramatic', 'rounded', 'neuro']);
  assert.equal(await page.inputValue('#sfShStyle'), 'same', 'shown as Same colour');
  assert.equal(await page.evaluate(() => __mstest.ptGet()), null, 'no photo tones with the sun');
  assert.equal(await page.evaluate(() => __mstest.shadeTidyThin()), false, 'no thin rule with the sun');
  assert.equal(await page.evaluate(() => __mstest.styleVars.shadeShadow), 'photo', 'the choice is kept');
  assert.doesNotMatch(
    await page.evaluate(() =>
      [...document.querySelectorAll('.sfshnote')].map((e) => e.textContent).join(' '),
    ),
    /matched to the photo/i,
    'the note says what’s drawn: Same colour',
  );
  await page.click('#sfShLight [data-v="photo"]');
  await idle(page);
  assert.equal(await page.inputValue('#sfShStyle'), 'photo');
  assert.ok((await tones(page)).toned > 0);
  assert.deepEqual(errors, []);
});

test('Two tone sets: a second pair for some markers, their sections’ labels primed, the key and Colour along say which, the PDF lays out', async () => {
  const { page, errors } = await openApp(VIEW);
  await idle(page);
  await own(page, ['Honolulu 72']);
  await fromHome(page, { seed: 9 });
  await built(page);
  await shadingTab(page);
  await page.click('#sfShade [data-v="photo"]');
  await idle(page, 1500);
  await page.check('#sfShSets');
  await idle(page, 1500);
  assert.equal(await page.evaluate(() => __mstest.styleVars.shadeSets), true);
  const t = await tones(page);
  assert.ok(t.set2 > 0, 'some sections on a second set: ' + JSON.stringify(t));
  const l2 = await page.evaluate(() => {
    const r = __mstest.ptGet();
    for (const l in r.tone) if (r.tone[l] && r.tone[l].set === 1) return +l;
    return 0;
  });
  assert.equal(await page.evaluate((l) => __mstest.ptSet2(l), l2), true);
  // the key's line for it, by its set
  const names = await page.evaluate((l) => {
    const t = __mstest,
      m = t.assignData.assign[l],
      secs = Object.keys(t.assignData.assign)
        .map(Number)
        .filter((k) => t.assignData.assign[k].mkey === m.mkey),
      rows = t.toneRows(secs);
    return rows.map((x) => t.toneRowName(x, rows, m));
  }, l2);
  assert.ok(
    names.some((n) => /′/.test(n)),
    'a line named by its second set: ' + names.join(' | '),
  );
  // the PDF lays out (its key with the lines under rows)
  assert.ok((await page.evaluate(() => __mstest.buildPDFPages(true))) >= 2);
  await page.evaluate(() => __mstest.buildPDFPages(false));
  assert.deepEqual(errors, []);
});

test('photo tones while colouring and after: a section with ink keeps its tones, saved and opened again with the Photo style and two sets', async () => {
  const { page, errors } = await openApp(VIEW);
  await idle(page);
  await own(page, ['Honolulu 120']);
  await fromHome(page);
  await built(page);
  await shadingTab(page);
  await page.click('#sfShade [data-v="photo"]');
  await idle(page, 1500);
  // a toned section given ink (its highlight step done)
  const l = await page.evaluate(() => {
    const r = __mstest.ptGet();
    for (const k in r.tone) if (r.tone[k] && r.tone[k].dark) return +k;
    return 0;
  });
  assert.ok(l > 0);
  const was = await page.evaluate((l) => {
    const t = __mstest.ptGet().tone[l];
    __mstest.stepSet(l, 2, true);
    return { L: t.light ? t.light.mkey : '', S: t.dark ? t.dark.mkey : '' };
  }, l);
  await page.evaluate(() => __mstest.renderGuide());
  await idle(page);
  assert.deepEqual(await page.evaluate((l) => __mstest.ptHeld[l], l), was, 'noted as coloured');
  // the shadow on the paper too: then both are kept whatever the amounts
  await page.evaluate((l) => {
    __mstest.stepSet(l, 4, true);
  }, l);
  await page.evaluate(() => {
    const e = document.getElementById('sfShLo');
    e.value = e.value > 70 ? 55 : 95;
    e.dispatchEvent(new Event('input'));
    e.dispatchEvent(new Event('change'));
  });
  await idle(page, 1500);
  const now = await page.evaluate((l) => {
    const t = __mstest.secTones(l);
    return t ? { L: t.light ? t.light.mkey : '', S: t.dark ? t.dark.mkey : '' } : null;
  }, l);
  assert.deepEqual(now, was, 'its tones as coloured');
  // saved and opened again
  await page.evaluate(() => {
    __mstest.shadeSets = true;
    __mstest.renderGuide();
  });
  await until(page, () => __mstest.inLibrary, null, 'saved', 30000);
  await idle(page, 2500);
  const id = await page.evaluate(() => __mstest.curId);
  await page.reload();
  await idle(page, 2500);
  await page.evaluate((id) => loadGuide({ id }), id);
  await page.waitForFunction((id) => __mstest.curId === id && __mstest.assignData, id, { timeout: 15000 });
  await idle(page, 2000);
  await until(page, () => !__mstest.shadeWaitsPhoto(), null, 'the photo read', 15000);
  await page.evaluate(() => __mstest.renderGuide());
  const re = await page.evaluate(
    (l) => ({
      sets: __mstest.styleVars.shadeSets,
      kinds: __mstest.styleVars.shadeShadow + '/' + __mstest.styleVars.shadeHilite,
      held: __mstest.ptHeld[l] || null,
      has: !!__mstest.ptGet(),
    }),
    l,
  );
  assert.equal(re.sets, true);
  assert.equal(re.kinds, 'photo/photo');
  assert.ok(re.has, 'photo tones again');
  assert.deepEqual(re.held, was, 'the coloured section’s tones kept');
  assert.deepEqual(errors, []);
});

test('tidied tone patches: the field drawn is a tidied copy, a tone none of a section keeps asks no step; the line-art sample tidied by size only', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await page.click('.sftabbtn[data-t="shading"]');
  await idle(page);
  await page.click('#sfShade [data-v="neuro"]');
  await idle(page, 1500);
  const r = await page.evaluate(() => {
    const t = __mstest,
      sh = t.shadePrep(false),
      V = t.shadeFieldRaw();
    let diff = 0;
    for (let i = 0; i < V.length; i++) if (V[i] !== sh.V[i]) diff++;
    return { copy: sh.V !== V, diff, thin: t.shadeTidyThin(), has: !!sh.has };
  });
  assert.ok(r.copy, 'drawn from a copy');
  assert.equal(r.thin, false, 'no thin rule with the edges');
  assert.ok(r.has);
  // tidied to nothing smaller than 1.5 mm, a Neuro picture still has its bands (the same tone lines, give or take)
  assert.ok(r.diff >= 0);
  // a section's steps: none for a tone it doesn't keep on the page
  const ok = await page.evaluate(() => {
    const t = __mstest;
    for (const k in t.assignData.assign) {
      const l = +k,
        tn = t.shadeSec(l);
      if (!tn) continue;
      const req = t.shadeReq(l),
        has = t.shadeHas(l);
      if (tn.light && !(has & 1) && req & 1) return 'light step for no light ' + l;
      if (!tn.noShadow && !(has & 4) && req & 4) return 'shadow step for no shadow ' + l;
    }
    return '';
  });
  assert.equal(ok, '');
  assert.deepEqual(errors, []);
});

test('Use up to 48 markers: offered for a very colourful photo with a big collection, made with up to 48, and Back to 24', async () => {
  const { page, errors } = await openApp(VIEW);
  await idle(page);
  await own(page, ['Honolulu 320 (complete set)', 'All Copic markers']);
  await fromHome(page, { many: true, seed: 3 });
  await until(page, () => !!(__mstest.ppFill && __mstest.ppFill.res), null, 'the numbers', 60000);
  await until(page, () => !!document.querySelector('#sfPpHelp [data-pp="more"]'), null, 'the offer', 30000);
  assert.match(
    await page.textContent('#sfPpMore'),
    /Some of this photo’s colours aren’t on the page: the page’s 24 markers can’t cover them all\. Use up to 48 markers/,
  );
  await page.click('#sfPpHelp [data-pp="more"]');
  await until(page, () => __mstest.pp.more && !__mstest.ppBusy, null, 'made with more', 90000);
  await pageReady(page);
  await idle(page);
  assert.ok((await page.evaluate(() => __mstest.pp.n)) > 24, 'more than 24 markers');
  assert.match(await page.textContent('#sfPpMore'), /Up to 48 markers · Back to 24/);
  await page.click('#sfPpHelp [data-pp="less"]');
  await until(page, () => !__mstest.pp.more && !__mstest.ppBusy, null, 'back', 90000);
  await pageReady(page);
  assert.ok((await page.evaluate(() => __mstest.pp.n)) <= 24);
  assert.deepEqual(errors, []);
});

test('v327.1: Shade it like the photo, once, after a photo-made page’s Build: Photo in one Undo step; closed, ticked or reopened, gone', async () => {
  const { page, errors } = await openApp(VIEW);
  await idle(page);
  await own(page, ['Honolulu 120']);
  await fromHome(page);
  await built(page);
  const line = () => page.$('#sfPpShLine');
  assert.ok(await line(), 'offered after Build');
  assert.match(await page.textContent('#sfPpShLine'), /^Shade it like the photo\? .* Shade it$/);
  // (the first-time tap line waits its turn; one line at a time)
  assert.doesNotMatch(
    await page.textContent('#sfCtl'),
    /a section on the picture to change or pin its colour/,
  );
  // on every tab: it's under the tabs
  await page.click('.sftabbtn[data-t="pattern"]');
  await idle(page);
  assert.ok(await line(), 'on Pattern too');
  // Shade it: the Photo style, Shading opened, said with Undo
  await page.click('#sfPpShGo');
  await idle(page, 1500);
  assert.equal(await page.evaluate(() => __mstest.styleVars.shadeMode), 'full');
  assert.equal(await page.getAttribute('#sfShade button.on', 'data-v'), 'photo');
  assert.equal(await page.getAttribute('.sftabbtn.on', 'data-t'), 'shading');
  assert.match(await page.textContent('#msToast'), /Shaded like the photo\./);
  assert.equal(await line(), null, 'gone once used');
  // one Undo step: shading off again, and the line stays gone
  await page.evaluate(() => __mstest.assign.planUndo());
  await idle(page);
  assert.equal(await page.evaluate(() => __mstest.styleVars.shadeMode), 'off');
  assert.equal(await line(), null, 'Undo doesn’t bring it back');
  // a new photo page: offered again; ✕ closes it for good
  await page.click('#mHome');
  await idle(page);
  await fromHome(page, { seed: 3 });
  await built(page);
  assert.ok(await line(), 'a new page is offered it');
  await page.click('#sfPpShX');
  await idle(page);
  assert.equal(await line(), null);
  await page.click('.sftabbtn[data-t="colours"]');
  await idle(page);
  assert.equal(await line(), null, 'closed stays closed');
  // a third: a section ticked makes it go (shading would change what's on the paper)
  await page.click('#mHome');
  await idle(page);
  await fromHome(page, { seed: 11 });
  await built(page);
  assert.ok(await line());
  await page.evaluate(() => {
    const t = __mstest;
    t.stepSet(t.assignData.order[0], 2, true);
    t.renderControls();
  });
  await idle(page);
  assert.equal(await line(), null, 'gone once colouring starts');
  // reopened (a reload): never
  await page.reload();
  await idle(page, 1500);
  await page.click('#mSections');
  await idle(page, 1500);
  assert.equal(await line(), null, 'not after a reload');
  assert.deepEqual(errors, []);
});

test('v329.1: Shade it’s toast Undo is its own step’s: after another change it does nothing', async () => {
  const { page, errors } = await openApp(VIEW);
  await idle(page);
  await own(page, ['Honolulu 120']);
  await fromHome(page);
  await built(page);
  const n0 = await page.evaluate(() => __mstest.planStack.length);
  await page.click('#sfPpShGo');
  await idle(page, 1500);
  assert.equal(await page.evaluate(() => __mstest.planStack.length), n0 + 1, 'one step');
  assert.match(await page.textContent('#msToast'), /Shaded like the photo\./);
  // another change, then the toast's Undo (by script: the later step may have put the toast away)
  await page.click('#sfShade button[data-v]:not(.on)');
  await idle(page, 1500);
  const n1 = await page.evaluate(() => __mstest.planStack.length);
  assert.equal(n1, n0 + 2, 'another style a step of its own');
  const mode1 = await page.evaluate(() => __mstest.styleVars.shadeMode);
  await page.evaluate(() => {
    const b = document.getElementById('toastAct');
    if (b) b.click();
  });
  await idle(page);
  assert.equal(await page.evaluate(() => __mstest.planStack.length), n1, 'nothing undone');
  assert.equal(await page.evaluate(() => __mstest.styleVars.shadeMode), mode1, 'the other style stands');
  assert.deepEqual(errors, []);
});

test('v329.1: after Photo the Shading sliders show the photo’s own amounts at once (checked: they did); reopened, the saved amounts stay', async () => {
  const { page, errors } = await openApp(VIEW);
  await idle(page);
  await own(page, ['Honolulu 120']);
  await fromHome(page);
  await built(page);
  await shadingTab(page);
  // (a style with other amounts first, so the panel had them to show)
  await page.click('#sfShade [data-v="dramatic"]');
  await idle(page);
  // (read in the same task as the tap: what the panel shows before anything later draws it again)
  const now = await page.evaluate(() => [
    document.querySelector('#sfShade [data-v="photo"]').click(),
    document.getElementById('sfShHi') && +document.getElementById('sfShHi').value,
    +document.getElementById('sfShLo').value,
    __mstest.styleVars.shadeHi,
    __mstest.styleVars.shadeLo,
  ]);
  now.shift();
  assert.equal(now[1], Math.round(now[3] * 100), 'shadow slider: ' + JSON.stringify(now));
  if (now[0] != null) assert.equal(now[0], Math.round(now[2] * 100), 'highlight slider');
  await idle(page, 1500);
  const amt = await page.evaluate(() => [__mstest.styleVars.shadeHi, __mstest.styleVars.shadeLo]);
  assert.deepEqual(amt, [now[2], now[3]], 'the draw kept them');
  // reopened: the saved amounts, not chosen again (once the photo is read and the picture drawn)
  await until(page, () => __mstest.inLibrary, null, 'saved', 30000);
  await idle(page, 2500);
  const id = await page.evaluate(() => __mstest.curId);
  await page.reload();
  await idle(page, 2500);
  await page.evaluate((id) => loadGuide({ id }), id);
  await page.waitForFunction((id) => __mstest.curId === id && __mstest.assignData, id, { timeout: 15000 });
  await idle(page, 2000);
  await until(page, () => !__mstest.shadeWaitsPhoto(), null, 'the photo read', 15000);
  await page.evaluate(() => __mstest.renderGuide());
  await idle(page);
  assert.deepEqual(
    await page.evaluate(() => [__mstest.styleVars.shadeHi, __mstest.styleVars.shadeLo]),
    amt,
    'saved amounts kept',
  );
  assert.equal(await page.evaluate(() => __mstest.ptAutoN), 0, 'taken as saved, not chosen again');
  // an amount moved, then Undo: the amounts as they were, not chosen again
  await shadingTab(page);
  const n0 = await page.evaluate(() => __mstest.ptAutoN);
  await page.evaluate(() => {
    const e = document.getElementById('sfShLo');
    e.value = 40;
    e.dispatchEvent(new Event('input'));
    e.dispatchEvent(new Event('change'));
  });
  await idle(page);
  await page.evaluate(() => __mstest.assign.planUndo());
  await idle(page);
  assert.deepEqual(await page.evaluate(() => [__mstest.styleVars.shadeHi, __mstest.styleVars.shadeLo]), amt);
  assert.equal(await page.evaluate(() => __mstest.ptAutoN), n0, 'Undo: not chosen again');
  assert.deepEqual(errors, []);
});
