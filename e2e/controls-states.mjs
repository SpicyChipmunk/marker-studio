// A broad, repeatable set of guide states for checking the guide's controls (js/guide/50-controls.js) against an
// earlier version of themselves: every stage (Plan, Colour along and focus mode, Edit sections, crop, page
// straightening), every Plan tab with every colour pattern and its options, the palette sources, shading, pins, Paint,
// demo mode, a mixed Ohuhu + Copic collection and the one-line ⓘ hints. Used by scripts/controls-compare.mjs (which
// records the controls' markup, wiring and computed styles in each state) and e2e/controls-wiring.test.mjs.
//
// Each session is { name, storage, run(page, cap) }: open a fresh app with `storage` (and CTL_INIT installed), then
// run() drives it and calls cap(name) at each state. Everything random is seeded and the guide's made-up name pinned,
// so two runs of the same code give the same states.

// Math.random from a seed (window.__seed(n)), as in style-fields.test.mjs
export const SEEDED = () => {
  let a = 1;
  window.__seed = (n) => {
    a = n >>> 0;
  };
  Math.random = function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
// Records what is written into the controls (#sfCtl.innerHTML) and every listener added to an element inside them,
// in order, until the next __ctlTake(). A listener is recorded by where its element sits in the controls (its id,
// else its position), the event, the options and the handler's source with whitespace evened out (moving a function
// into another one changes only its indentation); listenAt says how many writes had been made when it was added.
export const RECORDER = () => {
  const log = { writes: [], listen: [], listenAt: [] };
  const ih = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
  Object.defineProperty(Element.prototype, 'innerHTML', {
    configurable: true,
    enumerable: ih.enumerable,
    get() {
      return ih.get.call(this);
    },
    set(v) {
      if (this.id === 'sfCtl') log.writes.push(String(v));
      ih.set.call(this, v);
    },
  });
  const where = (el, root) => {
    const p = [];
    for (let e = el; e && e !== root; e = e.parentElement) {
      if (e.id) {
        p.unshift('#' + e.id);
        break;
      }
      p.unshift(e.tagName.toLowerCase() + ':' + [].indexOf.call(e.parentElement ? e.parentElement.children : [], e));
    }
    return p.join('>') || '(controls)';
  };
  const ael = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function (type, fn, opt) {
    const root = document.getElementById('sfCtl');
    if (root && this instanceof Node && root.contains(this)) {
      log.listen.push([where(this, root), type, JSON.stringify(opt === undefined ? null : opt), String(fn).replace(/\s+/g, ' ')]);
      log.listenAt.push(log.writes.length);
    }
    return ael.call(this, type, fn, opt);
  };
  window.__ctlTake = () => {
    const out = { writes: log.writes, listen: log.listen, listenAt: log.listenAt };
    log.writes = [];
    log.listen = [];
    log.listenAt = [];
    return out;
  };
};
export const CTL_INIT = `(${SEEDED})();(${RECORDER})();`;

// ---- actions ----
// Buttons are clicked through the DOM (the state, not the tap, is under test: a hidden tab's button or one scrolled
// under the bar is reached the same at every screen size); sliders are set and let go (input, then change).
export const click = (page, sel) =>
  page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) throw new Error('no ' + sel);
    el.click();
  }, sel);
export const slide = (page, id, v) =>
  page.evaluate(
    ([id, v]) => {
      const el = document.getElementById(id);
      if (!el) throw new Error('no #' + id);
      el.value = String(v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    },
    [id, v],
  );
export const choose = (page, id, v) =>
  page.evaluate(
    ([id, v]) => {
      const el = document.getElementById(id);
      el.value = v;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    },
    [id, v],
  );
const seed = (page, n) => page.evaluate((n) => window.__seed(n), n);
const tab = (page, t) => click(page, `.sftabbtn[data-t="${t}"]`);

// the welcome's set 3 (Honolulu 120), then the sample guide or the photo button
async function start(page, next = 'sample') {
  await page.check('#wcSets input[data-i="3"]');
  await page.click('#wcAdd');
  if (next) await startGuide(page, next);
}
async function startGuide(page, next) {
  if (next === 'sample') {
    await page.click('#wcSample');
    await page.waitForFunction(() => !!(window.__mstest && __mstest.assignData));
  } else await page.click(next);
}

// a two-colour picture for the Photo pattern (as in style-fields.test.mjs)
async function photoFile(page) {
  const b64 = await page.evaluate(async () => {
    const c = document.createElement('canvas');
    c.width = 600;
    c.height = 800;
    const g = c.getContext('2d');
    g.fillStyle = '#2350c8';
    g.fillRect(0, 0, 600, 400);
    g.fillStyle = '#d0282c';
    g.fillRect(0, 400, 600, 800);
    const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
    return await new Promise((r) => {
      const f = new FileReader();
      f.onload = () => r(f.result.split(',')[1]);
      f.readAsDataURL(blob);
    });
  });
  return { name: 'ref.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') };
}

// A made-up phone photo of a page at an angle with one corner off the photo (so the corner editor opens), from
// straighten.test.mjs (trimmed to the options used here).
const PAGE_GEN = String.raw`
async function makePhoto(o) {
  const W = 1200, H = 1600;
  const art = new Image(); await new Promise((r) => { art.onload = r; art.src = '/src/assets/sample-jellyfish.png'; });
  const PW = 850, PH = 1100, pg = document.createElement('canvas'); pg.width = PW; pg.height = PH; const p = pg.getContext('2d');
  let sd = 7; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  p.fillStyle = '#f7f5ef'; p.fillRect(0, 0, PW, PH);
  { const s = Math.min((PW - 160) / art.width, (PH - 200) / art.height); p.drawImage(art, (PW - art.width * s) / 2, (PH - art.height * s) / 2, art.width * s, art.height * s); }
  const pd = p.getImageData(0, 0, PW, PH).data;
  const f = 25 / 43.27 * Math.hypot(W, H), tx = o.tilt * Math.PI / 180, sz = o.size;
  const hw = 0.5 * 8.5, hh = 0.5 * 11, Z = (11 / sz) * f / H;
  const proj = (X, Y) => { let x = X, y = Y * Math.cos(tx), z = Y * Math.sin(tx) + Z; return [W / 2 + o.dx * W + f * x / z, H / 2 + f * y / z]; };
  const C = [proj(-hw, -hh), proj(hw, -hh), proj(hw, hh), proj(-hw, hh)], Hm = __mstest.pgHomog(C, [[0, 0], [PW, 0], [PW, PH], [0, PH]]);
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'), im = g.createImageData(W, H), d = im.data;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const j = (y * W + x) * 4, den = Hm[6] * x + Hm[7] * y + 1, u = (Hm[0] * x + Hm[1] * y + Hm[2]) / den, v = (Hm[3] * x + Hm[4] * y + Hm[5]) / den; let r, gg, b;
    if (u >= 0 && v >= 0 && u < PW - 1 && v < PH - 1) { const k = ((v | 0) * PW + (u | 0)) * 4; r = pd[k]; gg = pd[k + 1]; b = pd[k + 2]; }
    else { const t = Math.sin(x * 0.02 + Math.sin(y * 0.005) * 3) * 0.5 + 0.5; r = 120 + 50 * t; gg = 80 + 35 * t; b = 50 + 20 * t; }
    const sh = 1 - 0.22 * (x / W * 0.6 + y / H * 0.4), nz = (rnd() - 0.5) * 12; d[j] = r * sh + nz; d[j + 1] = gg * sh + nz; d[j + 2] = b * sh + nz; d[j + 3] = 255; }
  g.putImageData(im, 0, 0);
  const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.88));
  return await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result.split(',')[1]); fr.readAsDataURL(blob); });
}`;

// every one-time hint already seen on this device (the ⓘ lines instead of the full text)
const ALL_HINTS = JSON.stringify(['tap', 'blend', 'photo', 'paint', 'manual', 'shade', 'along', 'tools']);

export const SESSIONS = [
  {
    // the sample guide through every Plan control, Colour along and focus mode, then Edit sections and crop
    name: 'sample',
    storage: null,
    async run(page, cap, idle) {
      const step = async (name, fn) => {
        await fn();
        await idle(page);
        await cap(name);
      };
      await cap('welcome');
      await start(page);
      await page.evaluate(() => {
        __mstest.curName = 'States';
      });
      await idle(page);
      await cap('plan-colours');
      await step('plan-colours-filters-open', () => click(page, '#sfFiltToggle'));
      // a filter that leaves some of the owned markers, then one that leaves none (only Ohuhu is owned)
      await step('plan-colours-filter-some', () => click(page, '#sf_tones [data-tone="pale"]'));
      await step('plan-colours-filter-none', () => click(page, '#sf_brands [data-brand="Copic"]'));
      await step('plan-colours-filter-cleared', async () => {
        await click(page, '#sf_brands [data-brand="Copic"]');
        await idle(page);
        await click(page, '#sf_tones [data-tone="pale"]');
      });
      await step('plan-colours-filters-closed', () => click(page, '#sfFiltToggle'));
      await step('plan-colours-warm', () => click(page, '#sfPal [data-v="warm"]'));
      await step('plan-colours-vivid', () => click(page, '#sfMood [data-v="vivid"]'));
      // a Mood with fewer markers than asked for: the line under it says it took the nearest others
      await step('plan-colours-pastel-widened', async () => {
        await click(page, '#sfMood [data-v="pastel"]');
        await idle(page);
        await slide(page, 'sfMkCount', await page.evaluate(() => +document.getElementById('sfMkCount').max));
      });
      await step('plan-colours-mood-any', () => click(page, '#sfMood [data-v="neutral"]'));
      await step('plan-colours-count-10', () => slide(page, 'sfMkCount', 10));
      await step('plan-colours-generate', async () => {
        await seed(page, 11);
        await click(page, '#sfSrc [data-v="generate"]');
      });
      await step('plan-colours-harmony', async () => {
        await seed(page, 12);
        await choose(page, 'sfHarm', 'triadic');
      });
      await step('plan-colours-expand', () => click(page, '#sfExpand'));
      await step('plan-colours-expand-few', async () => {
        await slide(page, 'sfExpChar', 0);
        await slide(page, 'sfMkCount', await page.evaluate(() => +document.getElementById('sfMkCount').max));
      });
      await step('plan-colours-expand-off', () => click(page, '#sfExpand'));
      await step('plan-colours-saved-none', () => click(page, '#sfSrc [data-v="saved"]'));
      await step('plan-colours-saved-one', async () => {
        await page.evaluate(() => {
          state.saved.unshift({ id: 777001, type: 'palette', name: 'P one', keys: [...state.owned].slice(0, 6), ts: 777001 });
          save();
        });
        await click(page, '#sfSrc [data-v="owned"]');
        await idle(page);
        await click(page, '#sfSrc [data-v="saved"]');
      });
      await step('plan-colours-saved-two', async () => {
        await page.evaluate(() => {
          state.saved.unshift({ id: 777002, type: 'palette', name: 'P <two> & "x"', keys: [...state.owned].slice(6, 14), ts: 777002 });
          save();
        });
        await choose(page, 'sfPalPick', '777002');
      });
      // a one-marker palette expanded as far as it goes: fewer markers are close enough than asked for
      await step('plan-colours-saved-expand-few', async () => {
        await page.evaluate(() => {
          const k = [...state.owned].sort((a, b) => hexToLab(COLORS[keyIdx(a)].hex)[0] - hexToLab(COLORS[keyIdx(b)].hex)[0])[0];
          state.saved.unshift({ id: 777003, type: 'palette', name: 'P three', keys: [k], ts: 777003 });
          save();
          // (v308: drawn again so the picker lists it: chosen from an older list, no palette was chosen, and Expand
          // shows only once one is)
          __mstest.renderControls();
        });
        await choose(page, 'sfPalPick', '777003');
        await idle(page);
        await click(page, '#sfExpand');
        await idle(page);
        await slide(page, 'sfExpChar', 0);
        await idle(page);
        await slide(page, 'sfMkCount', await page.evaluate(() => +document.getElementById('sfMkCount').max));
      });
      await step('plan-colours-saved-expand-off', () => click(page, '#sfExpand'));
      // a saved palette that doesn't go round the colour wheel: Shuffle is greyed out, with why
      await step('plan-pattern-saved-ramp', () => tab(page, 'pattern'));
      await step('plan-colours-saved-back', () => tab(page, 'colours'));
      await step('plan-colours-owned-again', () => click(page, '#sfSrc [data-v="owned"]'));
      await step('plan-pattern', () => tab(page, 'pattern'));
      await step('plan-pattern-radial-reversed', async () => {
        await click(page, '#sfShape [data-v="radial"]');
        await idle(page);
        await click(page, '#sfDir [data-d="-1"]');
      });
      await step('plan-pattern-shuffled', async () => {
        await seed(page, 13);
        await click(page, '#sfVary');
      });
      await step('plan-pattern-look-ltd', () => click(page, '#sfLook [data-v="ltd"]'));
      await step('plan-pattern-look-smooth', () => click(page, '#sfLook [data-v="smooth"]'));
      await step('plan-pattern-look-auto-diagonal', async () => {
        await click(page, '#sfLook [data-v="auto"]');
        await idle(page);
        await click(page, '#sfShape [data-v="diagonal"]');
      });
      await step('plan-pattern-pinning', () => click(page, '#sfLock'));
      await step('plan-pattern-pinning-done', () => click(page, '#sfLock'));
      await step('plan-pattern-random', async () => {
        await seed(page, 14);
        await click(page, '#sfFam [data-v="random"]');
      });
      await step('plan-pattern-random-noadj', async () => {
        await seed(page, 15);
        await click(page, '#sfNoAdj');
      });
      await step('plan-pattern-random-pinning', () => click(page, '#sfLock'));
      await step('plan-pattern-blend', () => click(page, '#sfFam [data-v="blend"]'));
      await step('plan-pattern-blend-anchor', async () => {
        const l = await page.evaluate(() => __mstest.assignData.order[0]);
        const p = await page.evaluate(
          (l) =>
            new Promise((res) =>
              requestAnimationFrame(() =>
                requestAnimationFrame(() => {
                  const c = document.getElementById('sfCanvas'),
                    r = c.getBoundingClientRect(),
                    q = __mstest.labelPos(l);
                  res({ x: r.left + (q.x / c.width) * r.width, y: r.top + (q.y / c.height) * r.height });
                }),
              ),
            ),
          l,
        );
        await page.mouse.click(p.x, p.y);
      });
      await step('plan-pattern-blend-spread', () => slide(page, 'sfSpread', 3));
      await step('plan-pattern-blend-vivid', () => click(page, '#sfMix [data-v="vivid"]'));
      await step('plan-pattern-blend-paint', () => click(page, '#sfMix [data-v="paint"]'));
      await step('plan-pattern-blend-reset', () => click(page, '#sfResetA'));
      await step('plan-pattern-manual', () => click(page, '#sfFam [data-v="manual"]'));
      await step('plan-pattern-manual-paint', () => click(page, '#sfPaint'));
      await step('plan-colours-after-paint', () => tab(page, 'colours'));
      await step('plan-pattern-manual-pins', async () => {
        await tab(page, 'pattern');
        await page.evaluate(() => {
          const t = __mstest,
            o = t.assignData.order;
          t.locks[o[3]] = t.assignData.assign[o[3]].mkey;
          t.locks[o[8]] = t.assignData.assign[o[8]].mkey;
          SF.reassign();
        });
      });
      await step('plan-colours-manual', () => tab(page, 'colours'));
      await step('plan-pattern-gradient-pins', async () => {
        await tab(page, 'pattern');
        await click(page, '#sfFam [data-v="gradient"]');
      });
      await step('plan-shading', () => tab(page, 'shading'));
      await step('plan-shading-shadow', () => click(page, '#sfShade [data-v="shadow"]'));
      await step('plan-shading-full', () => click(page, '#sfShade [data-v="full"]'));
      await step('plan-shading-flat', () => click(page, '#sfShFlat'));
      await step('plan-shading-flat-done', () => click(page, '#sfShFlat'));
      await step('plan-shading-lines-off', () => click(page, '#sfShLines'));
      await step('plan-shading-sliders', async () => {
        await slide(page, 'sfShHi', 30);
        await idle(page);
        await slide(page, 'sfShLo', 70);
        await idle(page);
        await slide(page, 'sfRound', 80);
      });
      await step('plan-shading-note', async () => {
        if (await page.$('#sfShNoteT')) await click(page, '#sfShNoteT');
      });
      await step('plan-shading-texture', () => slide(page, 'sfTex', 25));
      await step('plan-share', () => tab(page, 'share'));
      await step('plan-share-surprise', async () => {
        await seed(page, 16);
        await click(page, '#sfSurprise');
      });
      // Colour along, with shading on (tones on each row)
      await step('along', () => click(page, '#sfColor'));
      await step('along-row-open', () => click(page, '#sfAlist .sfarow .sfah'));
      await step('along-row-done', () => click(page, '#sfMarkAll'));
      await step('along-two-done', async () => {
        await click(page, '#sfAlist .sfarow:nth-child(3) .sfah');
        await idle(page);
        await click(page, '#sfMarkAll');
      });
      await step('along-blends', async () => {
        await click(page, '#sfAlist .sfarow:nth-child(4) .sfah');
        await idle(page);
        await click(page, '#sfBlends');
      });
      await step('plan-after-along', () => click(page, '#sfDoneBtn'));
      await step('along-done-group', () => click(page, '#sfColor'));
      await step('along-done-group-open', () => click(page, '#sfDoneGrp'));
      await step('focus', () => click(page, '#sfFocus'));
      await step('focus-sheet', () => click(page, '#sfFocCols'));
      await step('focus-tone-steps', () => click(page, '#sfToneSteps'));
      await step('focus-jump', async () => {
        await click(page, '#sfFocCols');
        await idle(page);
        await click(page, '#sfFocMk .focmk:nth-child(2)');
      });
      await step('along-after-focus', () => click(page, '#sfExitFoc'));
      await step('focus-no-shading', async () => {
        await click(page, '#sfDoneBtn');
        await idle(page);
        await tab(page, 'shading');
        await click(page, '#sfShade [data-v="off"]');
        await idle(page);
        await click(page, '#sfColor');
        await idle(page);
        await click(page, '#sfFocus');
        await idle(page);
        await click(page, '#sfFocCols');
      });
      await step('along-no-shading', () => click(page, '#sfExitFoc'));
      // Edit sections
      await step('plan-back', () => click(page, '#sfDoneBtn'));
      await step('review', () => click(page, '#sfBack2'));
      await step('review-adjust', () => click(page, '#sfAdjToggle'));
      await step('review-add', () => click(page, '#sfEmAdd'));
      await step('review-add-autoclose', () => click(page, '#sfAutoClose'));
      await step('review-merge', () => click(page, '#sfEmMerge'));
      await step('review-split', () => click(page, '#sfEmSplit'));
      await step('review-toggle', () => click(page, '#sfEmToggle'));
      await step('review-sliders', async () => {
        await slide(page, 'sfMin', 40);
        await idle(page);
        await slide(page, 'sfBg', 30);
      });
      await step('review-enhance', () => click(page, '#sfEnh'));
      await step('review-sensitivity', () => slide(page, 'sfSens', 7));
      await step('review-tilt', () => slide(page, 'sfTilt', 1.4));
      await step('review-warning', async () => {
        await page.evaluate(() => {
          __mstest.segWarn = { ok: false, msg: 'Few sections found', tip: 'Try a sharper photo <b>or</b> more light.' };
        });
        await click(page, '#sfAdjToggle');
      });
      await step('crop', async () => {
        await click(page, '#sfAdjToggle');
        await idle(page);
        await click(page, '#sfCrop');
      });
      await step('crop-reset', () => click(page, '#sfCropReset'));
      await step('review-crop-cancelled', () => click(page, '#sfCropCancel'));
      await step('review-rotated', () => click(page, '#sfRotR'));
      await step('plan-rebuilt', async () => {
        await click(page, '#sfBuild');
        await page.waitForFunction(() => __mstest.sfmode === 'guide');
      });
    },
  },
  {
    // the Photo pattern: no photo yet, a photo being lined up and placed, and shading lit by the photo or the sun
    name: 'photo',
    storage: null,
    async run(page, cap, idle) {
      const step = async (name, fn) => {
        await fn();
        await idle(page);
        await cap(name);
      };
      await start(page);
      await page.evaluate(() => {
        __mstest.curName = 'Photo states';
      });
      await tab(page, 'pattern');
      await idle(page);
      await cap('photo-pattern');
      await step('photo-none', async () => {
        // the file chooser opens and is left unanswered
        await Promise.all([page.waitForEvent('filechooser'), click(page, '#sfFam [data-v="photo"]')]);
      });
      await step('photo-picked', async () => {
        const [fc] = await Promise.all([page.waitForEvent('filechooser'), click(page, '#sfPhPick')]);
        await fc.setFiles(await photoFile(page));
        await page.waitForFunction(() => !!__mstest.photoRef && !__mstest.photoChecking);
      });
      await step('photo-align', async () => {
        if (!(await page.evaluate(() => __mstest.photoAlign))) await click(page, '#sfPhAlign');
      });
      await step('photo-fit', () => click(page, '#sfPhFit [data-v="fit"]'));
      await step('photo-see-through', () => slide(page, 'sfPhOp', 40));
      await step('photo-auto', () => click(page, '#sfPhAuto'));
      await step('photo-placed', async () => {
        if (await page.evaluate(() => __mstest.photoAlign)) await click(page, '#sfPhAlign');
      });
      await step('photo-paper', () => click(page, '#sfPhPaper'));
      await step('photo-shading', async () => {
        await tab(page, 'shading');
        await click(page, '#sfShade [data-v="shadow"]');
      });
      await step('photo-shading-sun', () => click(page, '#sfShLight [data-v="sun"]'));
      await step('photo-shading-full', () => click(page, '#sfShade [data-v="full"]'));
      await step('photo-shading-photo', () => click(page, '#sfShLight [data-v="photo"]'));
      await step('photo-colours', () => tab(page, 'colours'));
      await step('photo-share', () => tab(page, 'share'));
    },
  },
  {
    // no markers added yet: guides use the whole catalogue
    name: 'demo',
    storage: null,
    async run(page, cap, idle) {
      await page.click('#wcSkip');
      await startGuide(page, 'sample');
      await page.evaluate(() => {
        __mstest.curName = 'Demo states';
      });
      await idle(page);
      await cap('demo-colours');
      await click(page, '#sfFiltToggle');
      await idle(page);
      await cap('demo-colours-filters');
      await tab(page, 'pattern');
      await idle(page);
      await cap('demo-pattern');
      await click(page, '#sfColor');
      await idle(page);
      await cap('demo-along');
    },
  },
  {
    // Copic markers added to an Ohuhu collection: brand letters on the rows
    name: 'mixed',
    storage: null,
    async run(page, cap, idle) {
      await start(page);
      await page.evaluate(() => {
        __mstest.curName = 'Mixed states';
        let k = 0;
        COLORS.forEach((c, i) => {
          if (c.brand === 'Copic' && k < 12) {
            state.owned.add(mkey(i));
            k++;
          }
        });
        save();
        SF.setCollection(sfCollection());
      });
      await idle(page);
      await cap('mixed-colours');
      await click(page, '#sfColor');
      await idle(page);
      await cap('mixed-along');
      await click(page, '#sfAlist .sfarow .sfah');
      await idle(page);
      await cap('mixed-along-open');
    },
  },
  {
    // every hint seen before, and the Plan tab remembered from last time (Share)
    name: 'seen',
    storage: { 'ms-seen-hints': ALL_HINTS, 'ms-plan-tab': 'share' },
    async run(page, cap, idle) {
      const step = async (name, fn) => {
        await fn();
        await idle(page);
        await cap(name);
      };
      await start(page);
      await page.evaluate(() => {
        __mstest.curName = 'Seen states';
      });
      await idle(page);
      await cap('seen-share');
      await step('seen-colours', () => tab(page, 'colours'));
      await step('seen-blend', async () => {
        await tab(page, 'pattern');
        await click(page, '#sfFam [data-v="blend"]');
      });
      await step('seen-manual', () => click(page, '#sfFam [data-v="manual"]'));
      await step('seen-manual-paint', () => click(page, '#sfPaint'));
      await step('seen-manual-paint-off', () => click(page, '#sfPaint'));
      await step('seen-shading', async () => {
        await tab(page, 'shading');
        await click(page, '#sfShade [data-v="full"]');
      });
      await step('seen-along', () => click(page, '#sfColor'));
      await step('seen-along-open', () => click(page, '#sfAlist .sfarow .sfah'));
    },
  },
  {
    // a photographed page: the corner editor, then straightened (the line with Undo and Adjust corners)
    name: 'straighten',
    storage: null,
    async run(page, cap, idle) {
      await start(page, null);
      const b64 = await page.evaluate(
        async ([src, o]) => {
          eval(src); // eslint-disable-line no-eval
          return makePhoto(o); // eslint-disable-line no-undef
        },
        [PAGE_GEN, { tilt: 15, size: 0.9, dx: 0.2 }],
      );
      const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#wcPhoto')]);
      await fc.setFiles({ name: 'page.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(b64, 'base64') });
      await page.waitForSelector('#sfPgGo', { timeout: 30000 });
      await idle(page);
      await cap('pg-editor');
      await click(page, '#sfPgGo');
      await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 40000 });
      await idle(page);
      await cap('review-straightened');
      await click(page, '#sfAdjToggle');
      await idle(page);
      await cap('review-straightened-adjust');
      await click(page, '#sfPgAdj');
      await page.waitForSelector('#sfPgGo');
      await idle(page);
      await cap('pg-adjust');
      await click(page, '#sfPgNo');
      await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 40000 });
      await idle(page);
      await cap('review-adjust-cancelled');
      await click(page, '#sfPgUndo');
      await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 40000 });
      await idle(page);
      await cap('review-unstraightened');
      await click(page, '#sfBuild');
      await page.waitForFunction(() => __mstest.sfmode === 'guide');
      await idle(page);
      await cap('photo-guide-plan');
    },
  },
];
