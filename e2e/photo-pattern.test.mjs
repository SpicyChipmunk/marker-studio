// The Photo pattern.
// (v320) Tests organised by feature: each block below came from the file named above it, its tests unchanged.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  WK,
  haveSet,
  idle,
  letterGuide,
  notOnWebKit,
  openApp,
  sampleGuide,
  saveGuide,
  scrollTop,
  sectionPoint,
  setup,
  teardown,
  until,
  welcome,
} from './helpers.mjs';
import { readFile } from 'node:fs/promises';

before(setup);
after(teardown);

// ---- from photo-choice.test.mjs ----
// The Photo pattern's figures and marker count: how close each section is, graded by eye in Match's words (the
// summary, the tip on a tapped section, "Show the rough matches", "Closer with"), and the suggested marker count with
// its Use button. The marker choice itself is unit-tested (test/photo-choice.test.mjs).
{
  // the sample guide with marker set `set` (a welcome index), then the Photo pattern with a photo drawn by `code`
  // (canvas drawing on g, 600 × 800)
  async function photoGuide(page, set, code) {
    await haveSet(page);
    await page.check(`#wcSets input[data-i="${set}"]`);
    await page.click('#wcAdd');
    await page.click('#wcSample');
    await page.waitForFunction(() => !!(window.__mstest && __mstest.assignData));
    const b64 = await page.evaluate(async (code) => {
      const c = document.createElement('canvas');
      c.width = 600;
      c.height = 800;
      const g = c.getContext('2d');
      new Function('g', code)(g);
      const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
      return await new Promise((r) => {
        const f = new FileReader();
        f.onload = () => r(f.result.split(',')[1]);
        f.readAsDataURL(blob);
      });
    }, code);
    await page.click('.sftabbtn[data-t="pattern"]');
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#sfFam [data-v="photo"]')]);
    await fc.setFiles({ name: 'ref.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
    await page.waitForFunction(() => __mstest.photoRef && !__mstest.photoChecking);
    await idle(page);
  }
  // per section: the photo colour, its marker, and how far apart they are by eye
  const grades = (page) =>
    page.evaluate(() => {
      const t = __mstest,
        C = t.photoColours(),
        a = t.assignData.assign,
        out = [];
      for (const k in a) {
        const l = +k,
          m = a[l];
        if (!C.has[l] || !m.lab || t.locks[l]) continue;
        const lab = [C.lab[l * 3], C.lab[l * 3 + 1], C.lab[l * 3 + 2]];
        out.push({
          l,
          lab,
          mk: m.mkey,
          e: de2000(lab, m.lab),
          word: matchWord(de2000(lab, m.lab)).toLowerCase(),
        });
      }
      return out;
    });
  test('graded by eye in Match’s words: the summary, a tapped section’s tip, and “Closer with” markers clearly closer', async () => {
    const { page, errors } = await openApp();
    // Honolulu 24 and a photo in colours it can't match well
    await photoGuide(
      page,
      1,
      "const gr=g.createLinearGradient(0,0,600,800);gr.addColorStop(0,'#0bd6c8');gr.addColorStop(0.5,'#8a2be2');gr.addColorStop(1,'#39ff14');g.fillStyle=gr;g.fillRect(0,0,600,800);",
    );
    const G = await grades(page);
    const close = G.filter((x) => x.e < 7).length,
      rough = G.length - close;
    assert.ok(close > 0 && rough > 0, `some of each (${close} close, ${rough} rough)`);
    const txt = await page.textContent('.sfphstat');
    assert.match(
      txt,
      new RegExp(
        `^${Math.round((close / G.length) * 100)}% of sections are a close match to the photo or better`,
      ),
    );
    assert.match(txt, new RegExp(`${rough} are only a rough or loose match`));
    // the tip on the biggest sections says what Match would say for the same two colours (once lining up is done)
    if (await page.evaluate(() => __mstest.photoAlign)) {
      await page.click('#sfPhAlign');
      await idle(page);
    }
    const big = await page.evaluate(
      (ls) => ls.sort((a, b) => __mstest.comps[b].area - __mstest.comps[a].area).slice(0, 3),
      G.map((x) => x.l),
    );
    for (const l of big) {
      const p = await sectionPoint(page, l);
      await page.mouse.click(p.x, p.y);
      await idle(page);
      assert.match(
        await page.textContent('.sftip .sftipsh'),
        new RegExp(`photo · ${G.find((x) => x.l === l).word} match`),
        'section ' + l,
      );
      await page.keyboard.press('Escape');
      await idle(page);
    }
    // each "Closer with" marker is at least 2 closer by eye (Match's rule for markers to buy) than the best marker you
    // own, on some section where even that is a rough match
    const want = await page.$$eval('.sfphwant [data-wk]', (b) => b.map((x) => x.dataset.wk));
    assert.ok(want.length >= 1, 'suggests markers');
    const ok = await page.evaluate(
      ([want, G]) =>
        want.map((k) => {
          const i = COLORS.findIndex((_, j) => mkey(j) === k),
            lab = LAB[i];
          const pool = __mstest.colour.poolFor('all'),
            best = (x) => de2000(x.lab, __mstest.colour.nearest(x.lab, pool).lab);
          return (
            !state.owned.has(k) &&
            G.some((x) => {
              const b = Math.min(x.e, best(x));
              return b >= 7 && de2000(x.lab, lab) <= b - 2;
            })
          );
        }),
      [want, G],
    );
    assert.deepEqual(
      ok,
      want.map(() => true),
      want.join(' '),
    );
    assert.deepEqual(errors, []);
  });
  test(
    'a photo of the page coloured with 8 clearly different markers: “About 8 markers”, Use 8 gives back those 8, Undo goes back',
    notOnWebKit(WK.scale),
    async () => {
      const { page, errors } = await openApp();
      await haveSet(page);
      await page.check('#wcSets input[data-i="6"]');
      await page.click('#wcAdd');
      await page.click('#wcSample');
      await page.waitForFunction(() => !!(window.__mstest && __mstest.assignData));
      // the guide's own sections painted with 8 markers from the collection (at least 10 apart by eye, none near white)
      const { b64, truth } = await page.evaluate(async () => {
        const M = __mstest,
          pool = M.colour.poolFor('all').filter((m) => m.lab && m.lab[0] < 85),
          truth = [];
        let sd = 7;
        const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
        while (truth.length < 8) {
          const m = pool[Math.floor(rnd() * pool.length)];
          if (!truth.some((o) => de2000(o.lab, m.lab) < 10)) truth.push(m);
        }
        const of = {};
        M.countedList().forEach((l, i) => {
          of[l] = truth[i % 8];
        });
        const W = M.W,
          H = M.H,
          lab = M.labels,
          gr = M.gray,
          c = document.createElement('canvas');
        c.width = W;
        c.height = H;
        const g = c.getContext('2d'),
          id = g.createImageData(W, H),
          d = id.data;
        for (let p = 0; p < W * H; p++) {
          const m = lab[p] > 0 && of[lab[p]];
          const rgb = m
            ? [1, 3, 5].map((k) => parseInt(m.hex.slice(k, k + 2), 16))
            : [gr[p], gr[p], gr[p]].map((v) => Math.min(255, v * 1.2));
          d[p * 4] = rgb[0];
          d[p * 4 + 1] = rgb[1];
          d[p * 4 + 2] = rgb[2];
          d[p * 4 + 3] = 255;
        }
        g.putImageData(id, 0, 0);
        const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
        const b64 = await new Promise((r) => {
          const f = new FileReader();
          f.onload = () => r(f.result.split(',')[1]);
          f.readAsDataURL(blob);
        });
        return { b64, truth: truth.map((m) => m.mkey).sort() };
      });
      await page.click('.sftabbtn[data-t="pattern"]');
      const [fc] = await Promise.all([
        page.waitForEvent('filechooser'),
        page.click('#sfFam [data-v="photo"]'),
      ]);
      await fc.setFiles({ name: 'page.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
      await page.waitForFunction(() => __mstest.photoRef && !__mstest.photoChecking);
      await idle(page);
      // exactly over the page
      await page.evaluate(() => {
        const M = __mstest,
          r = M.photoRef;
        M.photoXf = { cx: M.W / 2, cy: M.H / 2, sx: M.W / r.w, sy: M.H / r.h, r: 0 };
        M.photoRecolour();
      });
      await page.waitForFunction(() => __mstest.photoSug && !__mstest.photoSug.pending);
      await idle(page);
      // at 24 the guide uses just the 8 (no marker adds anything), so no suggestion; at 4 it suggests 8
      assert.equal(await page.evaluate(() => __mstest.limitN), 24);
      assert.equal((await page.textContent('#sfPhSug')).trim(), '', 'uses the 8 already');
      await page.evaluate(() => {
        __mstest.limitN = 4;
        __mstest.photoRecolour();
      });
      await idle(page);
      assert.equal(
        (await page.textContent('#sfPhSug')).trim(),
        'About 8 markers get as close as all your markers can. Use 8',
      );
      await page.click('#sfPhUse');
      await idle(page);
      const used = await page.evaluate(() => ({
        N: __mstest.limitN,
        keys: [...new Set(Object.values(__mstest.assignData.assign).map((m) => m.mkey))].sort(),
      }));
      assert.equal(used.N, 8);
      assert.deepEqual(used.keys, truth, 'the 8 markers the page was coloured with');
      assert.equal((await page.textContent('#sfPhSug')).trim(), '', 'no suggestion once it is used');
      await page.click('#sfPlanUndo');
      await idle(page);
      assert.equal(await page.evaluate(() => __mstest.limitN), 4, 'Undo puts the count back');
      assert.deepEqual(errors, []);
    },
  );
}

// ---- from photo.test.mjs ----
// Colour from a photo: sections take the photo's colour under them (matched to owned markers), the photo can be
// lined up by dragging or by itself, pins survive, "Markers in this guide" caps how many markers are used, and the
// photo and its placement are saved with the guide (also when it loads late, or the guide switched pattern).
{
  // a photo: blue top half, red bottom half
  const twoTone = (page) =>
    page.evaluate(async () => {
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
  async function photoGuide(page) {
    // a big collection (Honolulu 320) so there are clear blues and reds to match
    await haveSet(page);
    await page.check('#wcSets input[data-i="6"]');
    await page.click('#wcAdd');
    await page.click('#wcSample');
    await page.waitForFunction(() => !!(window.__mstest && __mstest.assignData));
    const b64 = await twoTone(page);
    await page.click('.sftabbtn[data-t="pattern"]');
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#sfFam [data-v="photo"]')]);
    await fc.setFiles({ name: 'ref.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
    await page.waitForFunction(() => !!__mstest.photoRef);
    await idle(page);
  }
  // share of sections lying clearly above / below the photo's split that got a blue / red marker
  const sides = (page) =>
    page.evaluate(() => {
      const t = __mstest,
        X = t.photoXf,
        split = X.cy,
        a = t.assignData.assign,
        comps = t.comps;
      let ok = 0,
        n = 0;
      for (const k in a) {
        const c = comps[k],
          m = a[k],
          lab = m.lab;
        if (!c || !lab) continue;
        const top = c.y1 < split - 4,
          bottom = c.y0 > split + 4;
        if (!top && !bottom) continue;
        n++;
        const blue = lab[2] < -15,
          red = lab[1] > 30 && lab[2] > 0;
        if ((top && blue) || (bottom && red)) ok++;
      }
      return { ok, n };
    });
  // phase 2 ---------------------------------------------------------------
  const photoOf = (page, draw) =>
    page.evaluate(async (draw) => {
      const c = document.createElement('canvas');
      c.width = 600;
      c.height = 800;
      const g = c.getContext('2d');
      new Function('g', draw)(g);
      const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
      return await new Promise((r) => {
        const f = new FileReader();
        f.onload = () => r(f.result.split(',')[1]);
        f.readAsDataURL(blob);
      });
    }, draw);
  async function guideWithPhoto(page, setIndex, draw) {
    await haveSet(page);
    await page.check(`#wcSets input[data-i="${setIndex}"]`);
    await page.click('#wcAdd');
    await page.click('#wcSample');
    await page.waitForFunction(() => !!(window.__mstest && __mstest.assignData));
    const b64 = await photoOf(page, draw);
    await page.click('.sftabbtn[data-t="pattern"]');
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#sfFam [data-v="photo"]')]);
    await fc.setFiles({ name: 'ref.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
    await page.waitForFunction(() => !!__mstest.photoRef);
    await idle(page);
  }
  // a phone photo of a page in warm lamplight: the paper reads as a warm grey (about L* 70), everything else shifted the
  // same way; top half paper, bottom left a red, bottom right a pale yellow (pale once the lighting is corrected); the
  // camera noise is seeded, so every run photographs the same page (unseeded, a section on the edge of "white" could
  // fall either side after the photo was saved as a JPEG and reopened)
  const warmPage =
    "const px=(r,g,b,x,y,w,h)=>{g0.fillStyle='rgb('+r+','+g+','+b+')';g0.fillRect(x,y,w,h);};const g0=g;px(182,170,152,0,0,600,800);px(128,42,36,0,400,300,400);px(186,172,98,300,400,300,400);const d=g.getImageData(0,0,600,800);let sd=12345;const rnd=()=>(sd=(sd*16807)%2147483647)/2147483647;for(let i=0;i<d.data.length;i+=4){const n=(rnd()-0.5)*10;d.data[i]+=n;d.data[i+1]+=n;d.data[i+2]+=n;}g.putImageData(d,0,0);";
  // automatic lining up ------------------------------------------------------
  // the sections big enough to read in these "photos" of the guide, shrunk to 0.7 and through JPEG: 137 px and up (the
  // smallest section before v277; the jellyfish's 23 smaller ones are a few pixels across by then, mostly line)
  const READABLE = 137;
  // ---- From the fourth review (data safety) ----
  // Save (a new guide into the Library), done once the header says so
  const saveNew = (page) => saveGuide(page);
  const AUTO = 2300;
  // idle(page, AUTO): until auto-save (1.5 s after the last change) has run
  const savedId = (page) => page.evaluate(() => state.saved.find((s) => s.type === 'guide').id);
  const stored = (page, id) =>
    page.evaluate(
      (id) =>
        IDB.get('guide-' + id).then(
          (p) =>
            p && {
              prog: (p.prog || []).length,
              assign: p.assign,
              tones: p.tones || {},
              ref: p.ref || null,
              base: p.base || null,
              style: p.style,
            },
        ),
      id,
    );
  const tab = (page, t) => page.click(`.sftabbtn[data-t="${t}"]`);
  // reopen a Library guide the way the Library does
  const openSaved = async (page, id) => {
    await page.evaluate((id) => loadGuide({ id }), id);
    await page.waitForFunction((id) => __mstest.curId === id && __mstest.assignData, id, { timeout: 10000 });
    await idle(page);
  };
  // ---- From the fifth review (data safety) ----
  const storedR5 = (page, id) =>
    page.evaluate(
      (id) =>
        IDB.get('guide-' + id).then(
          (p) =>
            p && {
              prog: (p.prog || []).length,
              progL: p.prog || [],
              assign: p.assign,
              tones: p.tones || {},
              ref: p.ref || null,
              photo: (p.style && p.style.photo) || null,
              out: p.out || null,
              secStates: p.secStates || {},
              lmap: p.lmap,
            },
        ),
      id,
    );
  const tickN = (page, n, from = 0) =>
    page.evaluate(
      ([n, from]) => {
        const t = __mstest;
        t.assignData.order.slice(from, from + n).forEach((l) => {
          t.colored[l] = 1;
        });
        t.guideDirty = true;
        t.renderGuide();
      },
      [n, from],
    );
  // hold back the next new Image() whose src starts with `prefix` until release() is called
  const holdImage = (page, prefix = '') =>
    page.evaluate((prefix) => {
      const Real = window.Image,
        d = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
      window.Image = function () {
        const im = new Real();
        Object.defineProperty(im, 'src', {
          configurable: true,
          set(v) {
            if (String(v).startsWith(prefix) && !window.__release) {
              window.Image = Real;
              window.__release = () => d.set.call(im, v);
            } else d.set.call(im, v);
          },
          get() {
            return d.get.call(im);
          },
        });
        return im;
      };
    }, prefix);
  const release = (page) =>
    page.evaluate(() => {
      const r = window.__release;
      window.__release = null;
      if (r) r();
      return !!r;
    });
  // a small coloured picture as a PNG file (for the Photo pattern)
  const photoFile = (page) =>
    page
      .evaluate(() => {
        const c = document.createElement('canvas');
        c.width = 64;
        c.height = 48;
        const g = c.getContext('2d');
        for (let i = 0; i < 4; i++) {
          g.fillStyle = ['#c33', '#3a6', '#36c', '#dc3'][i];
          g.fillRect((i % 2) * 32, (i >> 1) * 24, 32, 24);
        }
        return c.toDataURL('image/png').split(',')[1];
      })
      .then((b) => ({ name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from(b, 'base64') }));
  test('sections take the photo colour under them, matched to your markers', async () => {
    const { page, errors } = await openApp();
    await photoGuide(page);
    const s = await sides(page);
    assert.ok(s.n > 40, `enough sections on either side (${s.n})`);
    assert.ok(s.ok / s.n > 0.95, `${s.ok}/${s.n} sections match the photo above/below the split`);
    const r = await page.evaluate(() => ({
      fam: __mstest.family,
      N: __mstest.limitN,
      used: new Set(Object.values(__mstest.assignData.assign).map((m) => m.mkey)).size,
      owned: Object.values(__mstest.assignData.assign).every((m) => state.owned.has(m.mkey)),
    }));
    assert.equal(r.fam, 'photo');
    assert.equal(r.N, 24, 'photo starts with more markers (24)');
    assert.ok(r.used <= r.N, 'never more markers than asked for');
    assert.ok(r.owned, 'only markers you own');
    assert.ok(await page.isVisible('.sfphov'), 'the see-through photo shows while lining up');
    assert.deepEqual(errors, []);
  });
  test('dragging the photo moves where the colours land; pins stay', async () => {
    const { page, errors } = await openApp();
    await photoGuide(page);
    // pin one section at the very top
    const pin = await page.evaluate(() => {
      const t = __mstest,
        o = t.assignData.order,
        l = o[0],
        m = t.assignData.assign[l];
      t.locks[l] = m.mkey;
      return { l, key: m.mkey };
    });
    const cy0 = await page.evaluate(() => __mstest.photoXf.cy);
    await scrollTop(page);
    const c = await page.locator('#sfCanvas').boundingBox();
    await page.mouse.move(c.x + c.width / 2, c.y + c.height * 0.3);
    await page.mouse.down();
    await page.mouse.move(c.x + c.width / 2, c.y + c.height * 0.6, { steps: 6 });
    await page.mouse.up();
    await idle(page);
    const cy1 = await page.evaluate(() => __mstest.photoXf.cy);
    assert.ok(cy1 > cy0 + 50, `photo moved down (${cy0.toFixed(0)} -> ${cy1.toFixed(0)})`);
    const s = await sides(page);
    assert.ok(s.ok / s.n > 0.95, `colours follow the moved photo: ${s.ok}/${s.n}`);
    assert.equal(
      await page.evaluate((l) => __mstest.assignData.assign[l].mkey, pin.l),
      pin.key,
      'pinned section kept its marker',
    );
    // Fit / Fill / Stretch re-place it
    await page.click('#sfPhFit [data-v="stretch"]');
    await idle(page);
    const st = await page.evaluate(() => __mstest.photoXf);
    assert.ok(Math.abs(st.sx - st.sy) > 0.01, 'stretch scales width and height separately');
    assert.deepEqual(errors, []);
  });
  test('lining up on a wide screen: the photo is grabbed beside the drawing too; colours come after; leaving the Pattern tab finishes lining up', async () => {
    // (v285: an iPad in portrait; side by side, the picture's column is now fitted to the drawing and its tools)
    const { page, errors } = await openApp({ width: 834, height: 1194 });
    await photoGuide(page);
    await scrollTop(page);
    assert.equal(await page.evaluate(() => __mstest.photoAlign), true, 'lining up after choosing the photo');
    // a point in the picture's area but beside the drawing (with Fill the photo shows there)
    const p = await page.evaluate(() => {
      const c = document.getElementById('sfCanvas').getBoundingClientRect(),
        v = document.getElementById('sfView').getBoundingClientRect();
      const x =
        c.left - v.left > 40
          ? (v.left + c.left) / 2
          : v.right - c.right > 40
            ? (c.right + v.right) / 2
            : null;
      return x == null ? null : { x, y: c.top + c.height * 0.3, h: c.height };
    });
    assert.ok(p, 'the drawing is narrower than the picture area at 834 × 1194');
    // (the photo is blue above red: moved down, the sections just under the old split turn blue)
    const keys = () =>
      page.evaluate(() =>
        Object.values(__mstest.assignData.assign)
          .map((m) => m.mkey)
          .join(),
      );
    const y0 = await page.evaluate(() => __mstest.photoXf.cy),
      before = await keys();
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.mouse.move(p.x, p.y + p.h * 0.25, { steps: 6 });
    await page.mouse.up();
    await idle(page);
    assert.ok((await page.evaluate(() => __mstest.photoXf.cy)) > y0 + 20, 'the photo moved');
    assert.notEqual(await keys(), before, 'and the colours followed');
    assert.ok((await sides(page)).ok / (await sides(page)).n > 0.95, 'matching the moved photo');
    // one Undo step for the move (the quick colours straight after letting go aren't a step of their own)
    await page.click('#sfPlanUndo');
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.photoXf.cy), y0, 'Undo puts the photo back');
    // another tab finishes lining up: no see-through photo, and a drag on the picture scrolls the page again
    await page.click('.sftabbtn[data-t="colours"]');
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.photoAlign), false);
    assert.equal(await page.isVisible('.sfphov'), false);
    assert.equal(await page.evaluate(() => document.getElementById('sfPicBox').style.touchAction), 'pan-y');
    await page.click('.sftabbtn[data-t="pattern"]');
    await idle(page);
    assert.equal(
      await page.evaluate(() => __mstest.photoAlign),
      false,
      'coming back doesn’t start lining up again',
    );
    assert.deepEqual(errors, []);
  });
  test('marker count caps the markers; the photo and its placement are saved and reopen', async () => {
    const { page, errors } = await openApp();
    await photoGuide(page);
    await page.evaluate(() => {
      __mstest.limitN = 2;
      __mstest.photoRecolour();
    });
    const used2 = await page.evaluate(
      () => new Set(Object.values(__mstest.assignData.assign).map((m) => m.mkey)).size,
    );
    assert.ok(used2 <= 2, `2 markers asked, ${used2} used`);
    assert.ok(
      (await sides(page)).ok / (await sides(page)).n > 0.95,
      'even with 2 markers: one blue, one red',
    );
    await page.evaluate(() => {
      __mstest.limitN = 24;
      __mstest.photoRecolour();
    });
    await page.click('#sfPhAlign'); // done lining up
    await saveGuide(page);
    await idle(page);
    const before = await page.evaluate(() => ({
      xf: __mstest.photoXf,
      keys: JSON.stringify(Object.entries(__mstest.assignData.assign).map(([l, m]) => m.mkey)),
    }));
    const id = await page.evaluate(() => state.saved.find((s) => s.type === 'guide').id);
    // open something else, then the saved guide again
    await page.evaluate(() => SF.loadSample());
    await idle(page, 1200);
    assert.equal(
      await page.evaluate(() => __mstest.photoRef),
      null,
      'a new picture starts without the photo',
    );
    await page.evaluate((id) => SF.openDesign(id), id);
    await idle(page, 1500);
    await page.waitForFunction(() => !!__mstest.photoRef, null, { timeout: 5000 });
    const after = await page.evaluate(() => ({
      fam: __mstest.family,
      xf: __mstest.photoXf,
      keys: JSON.stringify(Object.entries(__mstest.assignData.assign).map(([l, m]) => m.mkey)),
    }));
    assert.equal(after.fam, 'photo');
    assert.deepEqual(after.xf, before.xf);
    assert.equal(after.keys, before.keys, 'same colours after reopening');
    // re-colouring after reopening still comes from the photo
    await page.evaluate(() => {
      __mstest.limitN = 2;
      __mstest.photoRecolour();
    });
    assert.ok((await sides(page)).ok / (await sides(page)).n > 0.95);
    assert.deepEqual(errors, []);
  });
  test('the marker choice covers the photo best, not just the closest one by one', async () => {
    const { page, errors } = await openApp();
    await welcome(page, 'look');
    const r = await page.evaluate(() => {
      const mk = (k, lab) => ({ mkey: k, lab });
      const pool = [
        mk('A', [50, 60, 40]),
        mk('A2', [52, 58, 42]),
        mk('B', [40, 10, -60]),
        mk('C', [85, -5, 70]),
        mk('far', [10, 0, 0]),
      ];
      const t = [];
      for (let i = 0; i < 10; i++) t.push({ l: i, lab: [51, 59, 41], w: 1 }); // lots of red
      for (let i = 10; i < 14; i++) t.push({ l: i, lab: [40, 10, -60], w: 1 }); // some blue
      for (let i = 14; i < 16; i++) t.push({ l: i, lab: [85, -5, 70], w: 1 }); // a little yellow
      const out = __mstest.photoPick(t, pool, 3);
      return { chosen: out.chosen.map((m) => m.mkey).sort(), pick: out.pick.map((m) => m.mkey) };
    });
    assert.equal(r.chosen.length, 3);
    assert.ok(
      r.chosen.includes('B') && r.chosen.includes('C'),
      'blue and yellow each get a marker: ' + r.chosen,
    );
    assert.ok(r.chosen.includes('A') || r.chosen.includes('A2'), 'and one red, not two near-identical reds');
    assert.equal(r.pick[12], 'B');
    assert.equal(r.pick[15], 'C');
    assert.deepEqual(errors, []);
  });
  test('white areas of the photo are left white (and can be coloured instead)', async () => {
    const { page, errors } = await openApp();
    await guideWithPhoto(
      page,
      6,
      "g.fillStyle='#fdfdfb';g.fillRect(0,0,600,400);g.fillStyle='#d0282c';g.fillRect(0,400,600,400);",
    );
    const r = await page.evaluate(() => {
      const t = __mstest,
        a = t.assignData,
        split = t.photoXf.cy,
        paper = Object.keys(a.paper || {}).map(Number);
      const top = paper.filter((l) => t.comps[l].y1 < split).length,
        wrong = paper.filter((l) => t.comps[l].y0 > split + 4).length;
      const inOrder = a.order.some((l) => a.paper && a.paper[l]);
      return { paper: paper.length, top, wrong, inOrder, N: a.N, assigned: Object.keys(a.assign).length };
    });
    assert.ok(
      r.paper > 15 && r.top >= r.paper * 0.9 && r.wrong === 0,
      'white only where the photo is white: ' + JSON.stringify(r),
    );
    assert.equal(r.inOrder, false, 'white sections are not in the colouring order');
    assert.equal(r.N, r.assigned, 'the section count leaves them out');
    // a white section is painted paper and has no label; tapping it says to leave it white
    const px = await page.evaluate(() => {
      const t = __mstest,
        l = +Object.keys(t.assignData.paper)[0],
        p = t.labelPos(l),
        c = document.getElementById('sfCanvas');
      const d = c.getContext('2d').getImageData(Math.floor(p.x), Math.floor(p.y), 1, 1).data;
      return [d[0], d[1], d[2]];
    });
    assert.ok(
      px.every((v) => v > 225),
      'white section drawn as paper: ' + px,
    );
    // save and reopen keeps them white
    await page.click('#sfPhAlign');
    await saveGuide(page);
    await idle(page);
    const id = await page.evaluate(() => state.saved.find((s) => s.type === 'guide').id);
    await page.evaluate(() => SF.loadSample());
    await idle(page, 1200);
    await page.evaluate((id) => SF.openDesign(id), id);
    await idle(page, 1500);
    assert.equal(
      await page.evaluate(() => Object.keys(__mstest.assignData.paper || {}).length),
      r.paper,
      'still white after reopening',
    );
    // switch it off: they get markers
    await page.waitForFunction(() => !!__mstest.photoRef);
    await page.click('.sftabbtn[data-t="pattern"]').catch(() => {});
    await page.evaluate(() => {
      document.getElementById('sfPhPaper').click();
    });
    await idle(page);
    const off = await page.evaluate(() => ({ paper: __mstest.assignData.paper, n: __mstest.assignData.N }));
    assert.equal(off.paper, null);
    assert.equal(off.n, r.N + r.paper);
    assert.deepEqual(errors, []);
  });
  test('a photo of a page in dim, warm light is corrected from its paper; it can be switched off, undone and is saved; a sunset is left alone', async () => {
    const { page, errors } = await openApp();
    await guideWithPhoto(page, 6, warmPage);
    const lit = () =>
      page.evaluate(() => {
        const r = __mstest.photoRef;
        return (
          r.lit && {
            on: r.lit.on,
            from: r.lit.from,
            gain: r.lit.fix.gain.map((g) => +g.toFixed(4)),
            changed: r.data !== r.raw,
          }
        );
      });
    const whites = () =>
      page.evaluate(() => {
        const t = __mstest,
          a = t.assignData,
          split = t.photoXf.cy,
          w = Object.keys(a.paper || {}).map(Number);
        return { n: w.length, below: w.filter((l) => t.comps[l].y0 > split + 4).length };
      });
    const l1 = await lit();
    assert.deepEqual([l1.on, l1.from, l1.changed], [true, 'page', true], 'corrected: ' + JSON.stringify(l1));
    assert.ok(
      l1.gain[2] > l1.gain[0] * 1.2,
      'the warm cast is taken out (more blue gain than red): ' + l1.gain,
    );
    // the photo as shown (thumbnail, and over the picture while lining up) is the corrected one
    assert.notEqual(
      await page.getAttribute('.sfphthumb', 'src'),
      await page.evaluate(() => __mstest.photoRef.url),
    );
    assert.equal(await page.getAttribute('.sfphthumb', 'src'), await page.getAttribute('.sfphov', 'src'));
    assert.match(await page.textContent('.sfphtx'), /Lighting corrected from the paper/);
    assert.equal(await page.isChecked('#sfPhLight'), true);
    // the paper reads as white now, the pale yellow and the red stay coloured
    const on = await whites();
    assert.ok(on.n > 15 && on.below === 0, 'the paper is left white, nothing else: ' + JSON.stringify(on));
    const yellow = await page.evaluate(() => {
      const t = __mstest,
        C = t.photoColours(),
        X = t.photoXf,
        a = t.assignData,
        out = [];
      for (const k in a.assign) {
        const c = t.comps[k];
        if (c.y0 > X.cy + 4 && c.x0 > X.cx + 4) out.push([C.lab[k * 3], C.lab[k * 3 + 1], C.lab[k * 3 + 2]]);
      }
      return out;
    });
    assert.ok(
      yellow.length > 3 && yellow.every((c) => c[0] > 85 && c[2] > 20),
      'pale yellow, coloured: ' + JSON.stringify(yellow.slice(0, 3)),
    );
    // switched off: the photo as it was taken, its grey paper coloured like before; Undo switches it back on
    await page.click('#sfPhLight');
    await idle(page);
    assert.equal((await lit()).on, false);
    assert.equal((await lit()).changed, false);
    assert.equal((await whites()).n, 0, 'grey paper is not white');
    assert.doesNotMatch(await page.textContent('.sfphtx'), /Lighting corrected/);
    assert.equal(
      await page.getAttribute('.sfphthumb', 'src'),
      await page.evaluate(() => __mstest.photoRef.url),
    );
    assert.match(await page.getAttribute('#sfPlanUndo', 'aria-label'), /Lighting correction off/);
    await page.click('#sfPlanUndo');
    await idle(page);
    assert.equal((await lit()).on, true);
    assert.deepEqual(await whites(), on);
    // saved with the guide, as it is, and read the same when reopened (off too)
    await page.click('#sfPhLight');
    await idle(page);
    await page.click('#sfPhAlign');
    await saveGuide(page);
    await idle(page);
    const id = await page.evaluate(() => state.saved.find((s) => s.type === 'guide').id);
    await page.evaluate(() => SF.loadSample());
    await idle(page, 1200);
    await page.evaluate((id) => SF.openDesign(id), id);
    await idle(page, 1500);
    await page.waitForFunction(() => !!__mstest.photoRef);
    await idle(page);
    assert.deepEqual(await lit(), { ...l1, on: false, changed: false });
    await page.click('.sftabbtn[data-t="pattern"]').catch(() => {});
    await page.click('#sfPhLight');
    await idle(page);
    assert.deepEqual(await lit(), l1);
    assert.deepEqual(await whites(), on);
    // a sunset's warm light is the picture: not corrected, and nothing to switch
    const b64 = await photoOf(
      page,
      "const gr=g.createLinearGradient(0,0,600,800);gr.addColorStop(0,'#1d3b8a');gr.addColorStop(0.6,'#f2a33a');gr.addColorStop(1,'#c9562a');g.fillStyle=gr;g.fillRect(0,0,600,800);g.fillStyle='#fff4c9';g.beginPath();g.arc(420,520,90,0,6.3);g.fill();",
    );
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#sfPhPick')]);
    await fc.setFiles({ name: 'sunset.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
    await page.waitForFunction(() => __mstest.photoRef && !__mstest.photoRef.lit && !__mstest.photoChecking);
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.photoRef.data === __mstest.photoRef.raw), true);
    assert.equal(await page.$('#sfPhLight'), null);
    assert.deepEqual(errors, []);
  });
  test('rough matches are counted, can be shown, and markers you could buy are suggested', async () => {
    const { page, errors } = await openApp();
    // Honolulu 24 and a photo in colours it can't match well
    await guideWithPhoto(
      page,
      1,
      "const gr=g.createLinearGradient(0,0,600,800);gr.addColorStop(0,'#0bd6c8');gr.addColorStop(0.5,'#8a2be2');gr.addColorStop(1,'#39ff14');g.fillStyle=gr;g.fillRect(0,0,600,800);",
    );
    const txt = await page.textContent('.sfphstat');
    assert.match(txt, /\d+%.*close match/);
    assert.match(txt, /rough or loose match/);
    const want = await page.evaluate(() =>
      [...document.querySelectorAll('.sfphwant span')].map((s) => s.textContent.trim()),
    );
    assert.ok(want.length >= 1, 'suggests markers');
    const owned = await page.evaluate(
      (codes) => codes.filter((c) => [...state.owned].some((k) => k.endsWith('|' + c.split(' ').pop()))),
      want,
    );
    assert.deepEqual(owned, [], 'only markers you don’t own are suggested');
    // "show rough matches" fades the close ones
    await page.click('#sfPhAlign');
    await idle(page);
    const before = await page.evaluate(() => {
      const c = document.getElementById('sfCanvas');
      return c
        .getContext('2d')
        .getImageData(0, 0, c.width, c.height)
        .data.reduce((a, v) => a + v, 0);
    });
    await page.check('#sfPhRough');
    await idle(page);
    const after = await page.evaluate(() => {
      const c = document.getElementById('sfCanvas');
      return c
        .getContext('2d')
        .getImageData(0, 0, c.width, c.height)
        .data.reduce((a, v) => a + v, 0);
    });
    assert.ok(after > before, 'close matches are faded (lighter picture)');
    assert.deepEqual(errors, []);
  });
  test('the Photo button under the picture compares; Photo sits before Manual', async () => {
    const { page, errors } = await openApp();
    await photoGuide(page);
    const order = await page.evaluate(() =>
      [...document.querySelectorAll('#sfFam button')].map((b) => b.dataset.v),
    );
    assert.deepEqual(order, ['gradient', 'random', 'blend', 'photo', 'manual']);
    await page.click('#sfPhAlign');
    await idle(page);
    assert.ok(!(await page.isVisible('.sfphov')), 'photo hidden after lining up');
    assert.ok(await page.isVisible('#sfZoomCtl #sfPhPeek'), '◐ in the tool row');
    await page.click('#sfPhPeek');
    await idle(page);
    assert.equal(await page.getAttribute('#sfPhPeek', 'aria-pressed'), 'true');
    assert.equal(
      await page.evaluate(() => getComputedStyle(document.querySelector('.sfphov')).opacity),
      '1',
      'photo shown on top, not see-through',
    );
    await page.click('#sfPhPeek');
    await idle(page);
    assert.ok(!(await page.isVisible('.sfphov')));
    await page.click('#sfFam [data-v="gradient"]');
    await idle(page);
    assert.ok(!(await page.isVisible('#sfPhPeek')), 'no Photo button for other patterns');
    assert.deepEqual(errors, []);
  });
  test('a coloured version of the page lines itself up (turned, shrunk, off-centre); an unrelated photo does not', async () => {
    const { page, errors } = await openApp();
    await haveSet(page);
    await page.check('#wcSets input[data-i="6"]');
    await page.click('#wcAdd');
    await page.click('#wcSample');
    await page.waitForFunction(() => !!(window.__mstest && __mstest.assignData));
    await page.click('#sfCodes'); // marker codes off (tool row)
    assert.equal(await page.getAttribute('#sfCodes', 'aria-pressed'), 'false');
    // "photograph" the coloured guide: smaller, turned 3 degrees, off-centre on a bigger sheet, with noise
    const made = await page.evaluate(async () => {
      const t = __mstest;
      t.forceFullRender();
      t.renderGuide();
      const g = document.getElementById('sfCanvas');
      const before = {};
      for (const l in t.assignData.assign) before[l] = t.assignData.assign[l].mkey;
      const pw = 1400,
        ph = 1500,
        k = 0.7,
        th = 0.05,
        ox = 200,
        oy = 60,
        c = document.createElement('canvas');
      c.width = pw;
      c.height = ph;
      const x = c.getContext('2d');
      x.fillStyle = '#ece6da';
      x.fillRect(0, 0, pw, ph);
      x.translate(ox, oy);
      x.rotate(th);
      x.scale(k, k);
      x.drawImage(g, 0, 0);
      x.setTransform(1, 0, 0, 1, 0, 0);
      const id = x.getImageData(0, 0, pw, ph);
      for (let i = 0; i < id.data.length; i += 4) {
        const n = (Math.random() - 0.5) * 16;
        id.data[i] += n;
        id.data[i + 1] += n;
        id.data[i + 2] += n;
      }
      x.putImageData(id, 0, 0);
      const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9));
      const b64 = await new Promise((r) => {
        const f = new FileReader();
        f.onload = () => r(f.result.split(',')[1]);
        f.readAsDataURL(blob);
      });
      return { b64, before, th };
    });
    await page.click('.sftabbtn[data-t="pattern"]');
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#sfFam [data-v="photo"]')]);
    await fc.setFiles({
      name: 'coloured.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from(made.b64, 'base64'),
    });
    await page.waitForFunction(() => !!__mstest.photoRef);
    await page.waitForFunction(() => Math.abs(__mstest.photoXf.r) > 0.01, null, { timeout: 15000 });
    await idle(page);
    // each section's new marker should be the original or a near twin (the "photo" went through JPEG, noise and texture):
    // not clearly different, CIEDE2000 under 10 (a smooth gradient's neighbouring markers are near twins)
    const r = await page.evaluate(
      ([before, READABLE]) => {
        const t = __mstest,
          a = t.assignData.assign,
          lab = {};
        state.owned.forEach(() => {});
        const byKey = {};
        Object.values(a).forEach((m) => {
          byKey[m.mkey] = m;
        });
        const labOf = (k) => {
          const i = COLORS.findIndex((c) => c.brand + '|' + c.code === k);
          return i >= 0 ? LAB[i] : null;
        };
        let same = 0,
          n = 0;
        for (const l in before) {
          if (!a[l] || t.comps[l].area < READABLE) continue;
          n++;
          const p = labOf(before[l]),
            q = a[l].lab;
          if (p && q && de2000(p, q) < 10) same++;
        }
        return { same, n, xf: t.photoXf };
      },
      [made.before, READABLE],
    );
    assert.ok(Math.abs(r.xf.r + made.th) < 0.02, 'found the turn: ' + r.xf.r);
    assert.equal(r.n, 143, 'the sections big enough to read');
    assert.ok(r.same / r.n > 0.9, `${r.same}/${r.n} sections got their original colour back`);
    assert.match(await page.textContent('#msToast'), /Lined the photo up/);
    // lined up, the page's uncoloured parts say where its paper is: here already white (the sheet around it was
    // darker, which made the whole photo look like it needed correcting), so the photo is used as it is
    assert.equal(await page.evaluate(() => __mstest.photoRef.lit), null);
    // an unrelated photo stays where Fill put it
    const b64 = await page.evaluate(async () => {
      const c = document.createElement('canvas');
      c.width = 600;
      c.height = 800;
      const g = c.getContext('2d');
      const gr = g.createLinearGradient(0, 0, 600, 800);
      gr.addColorStop(0, '#1d3b8a');
      gr.addColorStop(1, '#f2a33a');
      g.fillStyle = gr;
      g.fillRect(0, 0, 600, 800);
      g.fillStyle = '#fff4c9';
      g.beginPath();
      g.arc(420, 520, 90, 0, 6.3);
      g.fill();
      const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
      return await new Promise((r) => {
        const f = new FileReader();
        f.onload = () => r(f.result.split(',')[1]);
        f.readAsDataURL(blob);
      });
    });
    const [fc2] = await Promise.all([page.waitForEvent('filechooser'), page.click('#sfPhPick')]);
    await fc2.setFiles({ name: 'sunset.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
    await page.waitForFunction(() => __mstest.photoRef && __mstest.photoRef.w === 600);
    await idle(page, 1500);
    assert.equal(await page.evaluate(() => __mstest.photoXf.r), 0, 'not moved');
    // the button says so when it can't match
    await page.click('#sfPhAuto');
    await idle(page, 1500);
    assert.match(await page.textContent('#msToast'), /Couldn.t match this photo/);
    assert.deepEqual(errors, []);
  });
  test('a coloured version of the page photographed in warm, dim light lines up and is corrected from its own paper', async () => {
    const { page, errors } = await openApp();
    await haveSet(page);
    await page.check('#wcSets input[data-i="6"]');
    await page.click('#wcAdd');
    await page.click('#wcSample');
    await page.waitForFunction(() => !!(window.__mstest && __mstest.assignData));
    await page.click('#sfCodes');
    // the coloured guide on a sheet, then the whole "photo" darkened and warmed (in linear light, like a lamp would)
    const made = await page.evaluate(async () => {
      const t = __mstest;
      t.forceFullRender();
      t.renderGuide();
      const g = document.getElementById('sfCanvas');
      const before = {};
      for (const l in t.assignData.assign) before[l] = t.assignData.assign[l].mkey;
      const pw = 1300,
        ph = 1500,
        c = document.createElement('canvas');
      c.width = pw;
      c.height = ph;
      const x = c.getContext('2d');
      x.fillStyle = '#f7f4ee';
      x.fillRect(0, 0, pw, ph);
      x.translate(120, 80);
      x.scale(0.75, 0.75);
      x.drawImage(g, 0, 0);
      x.setTransform(1, 0, 0, 1, 0, 0);
      const id = x.getImageData(0, 0, pw, ph),
        k = [0.55, 0.47, 0.38];
      for (let i = 0; i < id.data.length; i += 4) {
        const n = (Math.random() - 0.5) * 6;
        for (let j = 0; j < 3; j++) id.data[i + j] = linToSrgb(srgbToLin(id.data[i + j]) * k[j]) + n;
      }
      x.putImageData(id, 0, 0);
      const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9));
      return {
        b64: await new Promise((r) => {
          const f = new FileReader();
          f.onload = () => r(f.result.split(',')[1]);
          f.readAsDataURL(blob);
        }),
        before,
      };
    });
    await page.click('.sftabbtn[data-t="pattern"]');
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#sfFam [data-v="photo"]')]);
    await fc.setFiles({ name: 'lamp.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(made.b64, 'base64') });
    await page.waitForFunction(() => !!__mstest.photoRef && !__mstest.photoChecking, null, {
      timeout: 15000,
    });
    await idle(page);
    assert.match(await page.textContent('#msToast'), /Lined the photo up/);
    const same = () =>
      page.evaluate(
        ([before, READABLE]) => {
          const a = __mstest.assignData.assign,
            labOf = (k) => LAB[COLORS.findIndex((c) => c.brand + '|' + c.code === k)];
          let s = 0,
            n = 0;
          for (const l in before) {
            if (!a[l] || __mstest.comps[l].area < READABLE) continue;
            n++;
            if (de2000(labOf(before[l]), a[l].lab) < 10) s++;
          }
          return s / n;
        },
        [made.before, READABLE],
      );
    const lit = await page.evaluate(() => {
      const l = __mstest.photoRef.lit;
      return l && { from: l.from, on: l.on, gain: l.fix.gain };
    });
    assert.deepEqual([lit.from, lit.on], ['lined', true], JSON.stringify(lit));
    // the gains undo the lamp (1/0.55, 1/0.47, 1/0.38 times paper white over the sheet's), within a few per cent
    const want = [0.55, 0.47, 0.38].map((k, j) => 0.88 / (k * [0.93, 0.905, 0.855][j]));
    assert.ok(
      lit.gain.every((g, j) => Math.abs(g / want[j] - 1) < 0.06),
      `gains ${lit.gain} vs ${want}`,
    );
    const on = await same();
    await page.click('#sfPhLight');
    await idle(page);
    const off = await same();
    assert.ok(
      on > 0.85 && on > off + 0.2,
      `sections back to their own colour: corrected ${on}, as taken ${off}`,
    );
    assert.deepEqual(errors, []);
  });
  // ---- From the second full review ----
  test('automatic lining-up turns away stripes and very sparse drawings', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    const r = await page.evaluate(async () => {
      const t = __mstest,
        mk = async (draw) => {
          const c = document.createElement('canvas');
          c.width = 900;
          c.height = 1100;
          const g = c.getContext('2d');
          g.fillStyle = '#fff';
          g.fillRect(0, 0, 900, 1100);
          g.fillStyle = '#222';
          draw(g);
          const img = new Image();
          await new Promise((r) => {
            img.onload = r;
            img.src = c.toDataURL('image/png');
          });
          return t.photoFromImage(img);
        };
      const out = {};
      t.setPhotoRef(
        await mk((g) => {
          for (let y = 0; y < 1100; y += 24) g.fillRect(0, y, 900, 8);
        }),
        true,
      );
      out.stripes = t.photoTryAutoAlign(true);
      t.setPhotoRef(
        await mk((g) => {
          for (let y = 0; y < 1100; y += 40)
            for (let x = ((y / 40) % 2) * 40; x < 900; x += 80) g.fillRect(x, y, 40, 40);
        }),
        true,
      );
      out.checker = t.photoTryAutoAlign(true);
      return out;
    });
    assert.deepEqual(r, { stripes: false, checker: false });
    assert.deepEqual(errors, []);
  });
  test('a guide that switched away from Photo keeps its photo when reopened (a shared file leaves it out)', async () => {
    const { page, errors } = await openApp();
    await haveSet(page);
    await page.check('#wcSets input[data-i="6"]');
    await page.click('#wcAdd');
    await page.click('#wcSample');
    await page.waitForFunction(() => !!(window.__mstest && __mstest.assignData));
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
    await tab(page, 'pattern');
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#sfFam [data-v="photo"]')]);
    await fc.setFiles({ name: 'ref.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
    await page.waitForFunction(() => !!__mstest.photoRef);
    await idle(page);
    await saveNew(page);
    const id = await savedId(page);
    await page.click('#sfFam [data-v="gradient"]');
    await idle(page, AUTO);
    assert.ok((await stored(page, id)).ref, 'the photo is kept');
    assert.equal(
      await page.evaluate(() => __mstest.currentDesignObj(true).payload.ref),
      undefined,
      'not in a shared file',
    );
    await page.reload();
    await idle(page);
    await openSaved(page, id);
    await idle(page);
    assert.ok(await page.evaluate(() => !!__mstest.photoRef), 'back after reopening');
    assert.deepEqual(errors, []);
  });
  test('a Photo pattern photo that finishes loading after another guide opened is dropped, not put on that guide', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await saveNew(page);
    const idA = await savedId(page),
      f = await photoFile(page);
    await holdImage(page, 'blob:');
    const [fc] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.evaluate(() => __mstest.pickPhotoRef()),
    ]);
    await fc.setFiles(f);
    await page.waitForFunction(() => !!window.__release);
    // guide B opens while the photo is still decoding
    await page.evaluate(() => SF.loadSample());
    await page.waitForFunction((id) => __mstest.assignData && __mstest.curId !== id, idA);
    await idle(page);
    const fam = await page.evaluate(() => __mstest.family);
    await release(page);
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.family), fam, 'B keeps its pattern');
    assert.equal(await page.evaluate(() => !!__mstest.photoRef), false, 'and has no photo');
    await idle(page, AUTO);
    assert.equal((await storedR5(page, idA)).ref, null, 'A was not given it either');
    assert.deepEqual(errors, []);
  });
  test('a reopened Photo pattern guide keeps its photo when a change is saved before the photo decodes', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await saveNew(page);
    const id = await savedId(page);
    await page.evaluate(() => {
      const c = document.createElement('canvas');
      c.width = 80;
      c.height = 60;
      const g = c.getContext('2d');
      g.fillStyle = '#c33';
      g.fillRect(0, 0, 40, 60);
      g.fillStyle = '#36c';
      g.fillRect(40, 0, 40, 60);
      __mstest.setPhotoRef(__mstest.photoFromImage(c), true);
    });
    await idle(page, AUTO);
    const s0 = await storedR5(page, id);
    assert.ok(s0.ref && s0.photo, 'saved with its photo');
    await page.reload();
    await idle(page);
    await holdImage(page, 'data:image/jpeg');
    await openSaved(page, id);
    assert.ok(
      await page.evaluate(() => !!window.__release && !__mstest.photoRef),
      'the photo is still decoding',
    );
    await tickN(page, 2);
    await idle(page, AUTO);
    const s1 = await storedR5(page, id);
    assert.equal(s1.prog, 2, 'the change is saved');
    assert.equal(s1.ref, s0.ref, 'with the photo');
    assert.deepEqual(s1.photo, s0.photo);
    await release(page);
    await idle(page);
    assert.ok(await page.evaluate(() => !!__mstest.photoRef), 'and it shows once decoded');
    assert.deepEqual(errors, []);
  });
}

// ---- from v304-photo.test.mjs ----
// v304 (Photo pattern): the photo stays on the picture when it is turned, cropped (by hand or Auto), tilted or
// straightened, and Undo puts it back exactly (also a placement made by hand); a straightened guide saved before the
// Photo pattern was laid again places its photo afresh when reopened; the photo's size is kept within limits set by
// its Fill size, and only while it's being sized; a photo still loading when another is picked, or after another
// pattern was chosen, is dropped; with zones the match summary counts only the Photo zones; Palette › From photo
// keeps the newest of two quick picks; a photo with no colour in it leaves every section white and says so (with
// a way to colour its grey parts), and a photo off the drawing is said to be; the no-colour line and the suggested
// marker count follow Undo.
{
  // in the page: a coloured copy of the guide as it is (a smooth colour field over the picture, lines dark), laid over
  // it exactly; and how far each section's photo colour is from that field (CIE76, mean), through turn and crop
  const lib = () => {
    const t = __mstest;
    window.__truth = (u, v) => [35 + 45 * v, 45 * Math.cos(u * 2 * Math.PI), 45 * Math.sin(u * 2 * Math.PI)];
    window.__lab2rgb = (lab) => {
      const fy = (lab[0] + 16) / 116,
        fx = fy + lab[1] / 500,
        fz = fy - lab[2] / 200;
      const f = (x) => (x > 0.206893 ? x * x * x : (x - 16 / 116) / 7.787),
        X = f(fx) * 0.95047,
        Y = f(fy),
        Z = f(fz) * 1.08883;
      const g = (c) => {
        c = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
        return Math.max(0, Math.min(255, Math.round(c * 255)));
      };
      return [
        g(X * 3.2406 - Y * 1.5372 - Z * 0.4986),
        g(-X * 0.9689 + Y * 1.8758 + Z * 0.0415),
        g(X * 0.0557 - Y * 0.204 + Z * 1.057),
      ];
    };
    // a photo of the guide as it is now, each section painted by fn(l, u, v) (rgb, or null for the paper)
    window.__paint = (fn, paper, noLines) => {
      const s = Math.min(1, 1000 / Math.max(t.W, t.H)),
        pw = Math.round(t.W * s),
        ph = Math.round(t.H * s);
      const c = document.createElement('canvas');
      c.width = pw;
      c.height = ph;
      const g = c.getContext('2d'),
        im = g.createImageData(pw, ph),
        L = t.labels;
      for (let j = 0; j < ph; j++)
        for (let i = 0; i < pw; i++) {
          const gx = Math.floor(((i + 0.5) / pw) * t.W),
            gy = Math.floor(((j + 0.5) / ph) * t.H),
            q = (j * pw + i) * 4,
            l = L[gy * t.W + gx];
          const rgb =
            l === -1 && !noLines
              ? [40, 36, 34]
              : (l > 0 && fn(l, (gx + 0.5) / t.W, (gy + 0.5) / t.H)) || paper || [252, 252, 250];
          im.data[q] = rgb[0];
          im.data[q + 1] = rgb[1];
          im.data[q + 2] = rgb[2];
          im.data[q + 3] = 255;
        }
      g.putImageData(im, 0, 0);
      return { c, pw, ph };
    };
    window.__place = (fn, paper, noLines) => {
      const p = __paint(fn, paper, noLines);
      t.setPhotoRef(t.photoFromImage(p.c), true);
      t.photoXf = { cx: t.W / 2, cy: t.H / 2, sx: t.W / p.pw, sy: t.H / p.ph, r: 0 };
      t.photoRecolour();
    };
    // the guide point (normalised) back to the picture as it was when the photo was made (turned 0 or 90, cropped)
    window.__src = (gx, gy) => {
      const c = t.cropRect || { x: 0, y: 0, w: 1, h: 1 },
        X = c.x + gx * c.w,
        Y = c.y + gy * c.h;
      return t.rot90 === 90 ? [Y, 1 - X] : [X, Y];
    };
    window.__err = () => {
      const C = t.photoColours(),
        lp = t.labelPts;
      let s = 0,
        n = 0;
      for (const l of t.assignData.order) {
        if (!C.has[l] || !lp[l]) continue;
        const uv = __src(lp[l].x / t.W, lp[l].y / t.H),
          T = __truth(uv[0], uv[1]);
        s += Math.hypot(T[0] - C.lab[l * 3], T[1] - C.lab[l * 3 + 1], T[2] - C.lab[l * 3 + 2]);
        n++;
      }
      return s / n;
    };
    window.__xf = () => {
      const X = t.photoXf;
      return [X.cx, X.cy, X.sx, X.sy, X.r];
    };
  };
  async function letter(page) {
    // Honolulu 320, a page downloaded at 850 x 1100 (enlarged before its sections are found)
    await haveSet(page);
    await page.check('#wcSets input[data-i="6"]');
    await page.click('#wcAdd');
    await page.click('#wcLook');
    await idle(page);
    await letterGuide(page);
    await page.evaluate(lib);
  }
  async function sample(page) {
    await haveSet(page);
    await page.check('#wcSets input[data-i="6"]');
    await page.click('#wcAdd');
    await page.click('#wcSample');
    await page.waitForFunction(() => !!(window.__mstest && __mstest.assignData));
    await idle(page);
    await page.evaluate(lib);
  }
  const field = (l, u, v) => __lab2rgb(__truth(u, v));
  // the next photo picked stays undecoded until window.__release() is called
  const holdNext = (page) =>
    page.evaluate(() => {
      const Real = window.Image,
        d = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
      window.__release = null;
      window.Image = function () {
        const im = new Real();
        Object.defineProperty(im, 'src', {
          configurable: true,
          set(v) {
            if (String(v).startsWith('blob:') && !window.__release) {
              window.Image = Real;
              window.__release = () => d.set.call(im, v);
            } else d.set.call(im, v);
          },
          get() {
            return d.get.call(im);
          },
        });
        return im;
      };
    });
  const png = (page, w, h, col) =>
    page.evaluate(
      async ([w, h, col]) => {
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const g = c.getContext('2d');
        g.fillStyle = col;
        g.fillRect(0, 0, w, h);
        const b = await new Promise((r) => c.toBlob(r, 'image/png'));
        return await new Promise((r) => {
          const f = new FileReader();
          f.onload = () => r(f.result.split(',')[1]);
          f.readAsDataURL(b);
        });
      },
      [w, h, col],
    );
  async function pickRef(page, b64) {
    const [fc] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.evaluate(() => __mstest.pickPhotoRef()),
    ]);
    await fc.setFiles({ name: 'p.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
  }
  // a photo of a page before it was coloured (here a blank sheet): warm paper, a little shading
  const uncoloured = (l) => (l % 25 === 0 ? [228, 220, 204] : null);
  const cream = [240, 232, 214];
  test('the photo stays on the picture through Turn, Crop, Auto crop and Tilt; Undo puts it back exactly', async () => {
    const { page, errors, ctx } = await openApp({ width: 1180, height: 820 });
    await letter(page);
    const r = await page.evaluate((fieldSrc) => {
      const t = __mstest,
        f = eval('(' + fieldSrc + ')'),
        out = {};
      __place(f);
      out.k = t.srcK;
      out.e0 = __err();
      out.x0 = __xf();
      t.geoSet({ rot90: 90, crop: null });
      t.buildGuide();
      out.eRot = __err();
      t.geoSet({ crop: { x: 0.1, y: 0.15, w: 0.6, h: 0.65 } });
      t.buildGuide();
      out.eCrop = __err();
      out.kCrop = t.srcK;
      t.autoCrop();
      t.buildGuide();
      out.eAuto = __err();
      const r0 = t.photoXf.r;
      t.geoSet({ tilt: 3 });
      t.buildGuide();
      out.turn = ((t.photoXf.r - r0) * 180) / Math.PI;
      for (let i = 0; i < 4; i++) t.doUndoSeg();
      t.buildGuide();
      out.e1 = __err();
      out.x1 = __xf();
      out.geo = [t.rot90, t.cropRect];
      return out;
    }, field.toString());
    assert.ok(r.k > 1, 'the page was enlarged: ' + r.k);
    assert.ok(r.e0 < 8, 'placed: ' + r.e0);
    // (v303: 40 or more after each)
    assert.ok(r.eRot < r.e0 + 3, 'turned: ' + r.eRot);
    assert.ok(r.eCrop < r.e0 + 3, 'cropped: ' + r.eCrop + ' (enlarged ' + r.kCrop + ')');
    assert.ok(r.eAuto < r.e0 + 3, 'Auto crop: ' + r.eAuto);
    assert.ok(Math.abs(r.turn - 3) < 1e-6, 'tilted 3°: the photo turns 3° with it: ' + r.turn);
    assert.deepEqual(r.geo, [0, null]);
    r.x1.forEach((v, i) => assert.ok(Math.abs(v - r.x0[i]) < 1e-9, 'Undo: placed exactly as before'));
    assert.ok(Math.abs(r.e1 - r.e0) < 1e-6);
    assert.deepEqual(errors, []);
    await ctx.close();
  });
  test('a photo placed by hand: Straighten, then Undo, keeps it where it was (not placed afresh at Build)', async () => {
    const { page, errors, ctx } = await openApp({ width: 1180, height: 820 });
    await letter(page);
    await page.evaluate((fieldSrc) => {
      __place(eval('(' + fieldSrc + ')'));
      __mstest.photoXf = { cx: __mstest.W * 0.4, cy: __mstest.H * 0.55, sx: 0.9, sy: 0.9, r: 0.35 };
      __mstest.photoRecolour();
    }, field.toString());
    // Done lining up
    await page.click('.sftabbtn[data-t="pattern"]');
    await page.click('#sfPhAlign');
    await idle(page);
    const r = await page.evaluate(() => {
      const t = __mstest;
      const x0 = __xf(),
        a0 = t.photoAlign,
        w = t.pgOrig.width,
        h = t.pgOrig.height;
      t.geoSet({
        q: [
          [w * 0.03, h * 0.02],
          [w * 0.98, h * 0.04],
          [w * 0.97, h * 0.97],
          [w * 0.02, h * 0.99],
        ],
      });
      const waiting = t.phRefit;
      t.doUndoSeg();
      t.buildGuide();
      return { x0, x1: __xf(), waiting, after: t.phRefit, align: t.photoAlign, a0 };
    });
    assert.equal(r.waiting, true, 'straightened: to be placed again');
    assert.deepEqual(r.x1, r.x0);
    assert.equal(r.after, false);
    assert.equal(r.a0, false);
    assert.equal(r.align, false, 'lining up not switched on');
    assert.deepEqual(errors, []);
    await ctx.close();
  });
  test('straightened while another pattern was used, saved and reopened: choosing Photo places the photo afresh', async () => {
    const { page, errors, ctx } = await openApp({ width: 1180, height: 820 });
    await letter(page);
    await page.evaluate((fieldSrc) => __place(eval('(' + fieldSrc + ')')), field.toString());
    await page.click('.sftabbtn[data-t="pattern"]');
    await page.click('#sfFam [data-v="gradient"]');
    await idle(page);
    const d = await page.evaluate(() => {
      const t = __mstest,
        w = t.pgOrig.width,
        h = t.pgOrig.height;
      t.geoSet({
        q: [
          [w * 0.03, h * 0.02],
          [w * 0.98, h * 0.04],
          [w * 0.97, h * 0.97],
          [w * 0.02, h * 0.99],
        ],
      });
      t.buildGuide();
      return { d: t.currentDesignObj(), x: __xf(), fam: t.family };
    });
    assert.equal(d.fam, 'gradient');
    assert.equal(d.d.payload.style.photo.refit, true, 'saved as still to be placed again');
    await page.evaluate(
      (d) =>
        __mstest.openDesignObj(Object.assign({}, d.payload, { name: 'Straightened', W: d.W, H: d.H }), null),
      d.d,
    );
    await page.waitForFunction(() => !!__mstest.photoRef && __mstest.phRefit);
    await idle(page);
    await page.click('.sftabbtn[data-t="pattern"]');
    await page.click('#sfFam [data-v="photo"]');
    await idle(page);
    const after = await page.evaluate(() => ({ x: __xf(), refit: __mstest.phRefit, fam: __mstest.family }));
    assert.equal(after.fam, 'photo');
    assert.equal(after.refit, false);
    // (v303: still where it was on the picture before it was straightened)
    assert.notDeepEqual(after.x, d.x);
    assert.deepEqual(errors, []);
    await ctx.close();
  });
  test('a new photo placed by hand is not placed afresh later because the picture was straightened before', async () => {
    const { page, errors, ctx } = await openApp({ width: 1180, height: 820 });
    await letter(page);
    const r = await page.evaluate((fieldSrc) => {
      const t = __mstest,
        f = eval('(' + fieldSrc + ')'),
        w = t.pgOrig.width,
        h = t.pgOrig.height;
      __place(f);
      t.geoSet({
        q: [
          [w * 0.03, h * 0.02],
          [w * 0.98, h * 0.04],
          [w * 0.97, h * 0.97],
          [w * 0.02, h * 0.99],
        ],
      });
      const waiting = t.phRefit;
      __place(f);
      t.photoXf = { cx: t.W * 0.3, cy: t.H * 0.3, sx: 0.5, sy: 0.5, r: -0.2 };
      const x0 = __xf();
      t.buildGuide();
      return { waiting, x0, x1: __xf() };
    }, field.toString());
    assert.equal(r.waiting, true);
    assert.deepEqual(r.x1, r.x0);
    assert.deepEqual(errors, []);
    await ctx.close();
  });
  test('a small photo keeps its size when dragged; sizing it stops at 1/50 and 30 times its Fill size', async () => {
    const { page, errors, ctx } = await openApp({ width: 1180, height: 820 });
    await sample(page);
    const r = await page.evaluate(() => {
      const t = __mstest,
        c = document.createElement('canvas');
      c.width = 20;
      c.height = 15;
      const g = c.getContext('2d');
      g.fillStyle = '#2350c8';
      g.fillRect(0, 0, 20, 15);
      t.setPhotoRef(t.photoFromImage(c), true);
      t.photoFit('fill');
      const fill = t.photoXf.sx;
      t.photoMove({ x: 100, y: 100 }, { x: 140, y: 120 }, 1, 0);
      const dragged = t.photoXf.sx;
      t.photoMove({ x: 100, y: 100 }, { x: 100, y: 100 }, 1e-6, 0);
      const small = t.photoXf.sx;
      t.photoMove({ x: 100, y: 100 }, { x: 100, y: 100 }, 1e9, 0);
      return { fill, dragged, small, big: t.photoXf.sx };
    });
    assert.ok(r.fill > 50, 'Fill is past the old fixed limit: ' + r.fill);
    // (v303: shrunk to 50 by a drag)
    assert.equal(r.dragged, r.fill);
    assert.ok(Math.abs(r.small - r.fill / 50) < 1e-6, 'smallest: ' + r.small);
    assert.ok(Math.abs(r.big - r.fill * 30) < 1e-6, 'largest: ' + r.big);
    assert.deepEqual(errors, []);
    await ctx.close();
  });
  test('a Photo pattern photo that loads after another pattern was chosen, or after a newer pick, is dropped', async () => {
    const { page, errors, ctx } = await openApp({ width: 1180, height: 820 });
    await sample(page);
    await page.click('.sftabbtn[data-t="pattern"]');
    const red = await png(page, 300, 200, '#c8281e'),
      blue = await png(page, 200, 300, '#2350c8');
    // picked, then Gradient chosen while it decodes
    await holdNext(page);
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#sfFam [data-v="photo"]')]);
    await fc.setFiles({ name: 'r.png', mimeType: 'image/png', buffer: Buffer.from(red, 'base64') });
    await page.waitForFunction(() => !!window.__release);
    await page.click('#sfFam [data-v="gradient"]');
    await idle(page);
    await page.evaluate(() => window.__release());
    await page.waitForFunction(() => new Promise((r) => setTimeout(() => r(true), 400)));
    await idle(page);
    // (v303: the pattern went back to Photo)
    assert.equal(await page.evaluate(() => __mstest.family), 'gradient');
    assert.equal(await page.evaluate(() => !!__mstest.photoRef), false);
    // two picks: the first still decoding when the second arrives
    await holdNext(page);
    const [fc2] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.click('#sfFam [data-v="photo"]'),
    ]);
    await fc2.setFiles({ name: 'r.png', mimeType: 'image/png', buffer: Buffer.from(red, 'base64') });
    await page.waitForFunction(() => !!window.__release);
    await pickRef(page, blue);
    await page.waitForFunction(() => !!__mstest.photoRef && __mstest.photoRef.w === 200);
    await idle(page);
    await page.evaluate(() => window.__release());
    await page.waitForFunction(() => new Promise((r) => setTimeout(() => r(true), 400)));
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.photoRef.w), 200, 'the newer photo stays');
    assert.deepEqual(errors, []);
    await ctx.close();
  });
  test('with zones, the match summary counts only the sections of zones with the Photo pattern', async () => {
    const { page, errors, ctx } = await openApp({ width: 1180, height: 820 });
    await sample(page);
    await page.evaluate((fieldSrc) => __place(eval('(' + fieldSrc + ')')), field.toString());
    const all = await page.evaluate(() => __mstest.assignData.order.length);
    await page.click('.sftabbtn[data-t="pattern"]');
    const half = await page.evaluate(() => {
      const t = __mstest,
        ls = t.assignData.order.filter((l) => t.comps[l].cy > t.H / 2),
        z = t.zoneNew();
      t.zoneMove(ls, z.id);
      t.zoneSelect(z.id);
      t.renderControls();
      return { n: ls.length, id: z.id };
    });
    await page.click('#sfFam [data-v="gradient"]');
    await idle(page);
    const r = await page.evaluate((id) => {
      const t = __mstest;
      t.zoneSelect(0);
      t.photoRecolour();
      t.photoStatsHTML();
      return { tot: t.phStats.tot, fams: [t.family], zoneFam: id };
    }, half.id);
    // (v303: every section, the Gradient zone's too)
    assert.ok(r.tot <= all - half.n, r.tot + ' counted of ' + all + ', ' + half.n + ' in the Gradient zone');
    assert.ok(r.tot > 0);
    assert.deepEqual(errors, []);
    await ctx.close();
  });
  test('Palette › From photo: of two quick picks, the newer one is used even when the older is read last', async () => {
    const { page, errors, ctx } = await openApp({
      width: 1180,
      height: 820,
      // the first photo read is slow
      init: () => {
        const real = FileReader.prototype.readAsDataURL;
        let first = true;
        FileReader.prototype.readAsDataURL = function (f) {
          if (first && f && f.name === 'slow.png') {
            first = false;
            setTimeout(() => real.call(this, f), 600);
          } else real.call(this, f);
        };
      },
    });
    await haveSet(page);
    await page.check('#wcSets input[data-i="6"]');
    await page.click('#wcAdd');
    await page.click('#wcSample');
    await page.waitForFunction(() => !!(window.__mstest && __mstest.assignData));
    await idle(page);
    const red = await png(page, 60, 40, '#c8281e'),
      blue = await png(page, 60, 40, '#2350c8');
    await page.setInputFiles('#photoFile', {
      name: 'slow.png',
      mimeType: 'image/png',
      buffer: Buffer.from(red, 'base64'),
    });
    await page.setInputFiles('#photoFile', {
      name: 'fast.png',
      mimeType: 'image/png',
      buffer: Buffer.from(blue, 'base64'),
    });
    await page.waitForFunction(() => new Promise((r) => setTimeout(() => r(true), 1000)));
    const src = await page.evaluate(() => document.getElementById('photoThumb').src);
    // (v303: the slow red one, read last, replaced the blue)
    assert.ok(src.endsWith(blue.slice(-40)), 'the thumbnail is the newer photo');
    assert.deepEqual(errors, []);
    await ctx.close();
  });
  test('a photo with no colour leaves every section white and says so; the guide saves and reopens with none coloured', async () => {
    const { page, errors, ctx } = await openApp({ width: 820, height: 1180 });
    await sample(page);
    await page.click('.sftabbtn[data-t="pattern"]');
    const r = await page.evaluate(
      ([fSrc, paper]) => {
        const t = __mstest;
        __place(eval('(' + fSrc + ')'), paper, true);
        // (it can't be lined up: no lines in it)
        t.photoTryAutoAlign(true);
        t.photoRecolour();
        t.renderControls();
        const d = t.currentDesignObj();
        return {
          N: t.assignData.N,
          paper: Object.keys(t.assignData.paper || {}).length,
          none: t.phNone[0],
          text: (document.querySelector('.sfphstat') || {}).textContent,
          n: d.n,
          keys: d.keys.length,
          d,
        };
      },
      [uncoloured.toString(), cream],
    );
    // (v303: every section coloured in near-white greys)
    assert.equal(r.N, 0);
    assert.ok(r.paper > 100);
    assert.ok(r.none && !r.none.off && r.none.grey < 0.05, JSON.stringify(r.none));
    assert.match(
      r.text,
      /^No colour in this photo, so every section is left white\. Choose a photo of the page once it’s coloured in\./,
    );
    assert.match(r.text, /If it’s a coloured page, line it up first\./);
    assert.ok(!/grey markers/.test(r.text));
    assert.equal(r.n, 0);
    assert.equal(r.keys, 0);
    await page.evaluate(
      (d) =>
        __mstest.openDesignObj(Object.assign({}, d.payload, { name: 'Uncoloured', W: d.W, H: d.H }), null),
      r.d,
    );
    await page.waitForFunction(() => !!__mstest.photoRef && __mstest.assignData);
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.assignData.N), 0);
    await page.evaluate(() => __mstest.saveNow());
    await page.waitForFunction(() => __mstest.inLibrary);
    await idle(page);
    // white areas coloured after all: laid as before
    await page.click('.sftabbtn[data-t="pattern"]');
    await page.click('#sfPhPaper');
    await idle(page);
    assert.ok((await page.evaluate(() => __mstest.assignData.N)) > 100);
    assert.deepEqual(errors, []);
    await ctx.close();
  });
  test('pale colouring, or a few coloured sections, is laid as before', async () => {
    const { page, errors, ctx } = await openApp({ width: 1180, height: 820 });
    await sample(page);
    const r = await page.evaluate(() => {
      const t = __mstest,
        hsl = (h, s, l) => {
          const a = s * Math.min(l, 1 - l),
            f = (n) => {
              const k = (n + h / 30) % 12;
              return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
            };
          return [f(0), f(8), f(4)];
        };
      __place((l) => hsl((l * 47) % 360, 0.6, 0.9));
      const pale = { N: t.assignData.N, none: !!t.phNone[0] };
      __place((l) => (l % 12 === 0 ? hsl((l * 47) % 360, 0.7, 0.5) : null));
      return { pale, few: { N: t.assignData.N, none: !!t.phNone[0] } };
    });
    assert.ok(r.pale.N > 100 && !r.pale.none, JSON.stringify(r.pale));
    assert.ok(r.few.N > 3 && !r.few.none, JSON.stringify(r.few));
    assert.deepEqual(errors, []);
    await ctx.close();
  });
  test('grey shading with no colour: Use grey markers for the grey parts colours it, and is saved with the photo', async () => {
    const { page, errors, ctx } = await openApp({ width: 390, height: 844 });
    await sample(page);
    await page.click('.sftabbtn[data-t="pattern"]');
    await page.evaluate(() => {
      __place((l) => (l % 2 ? [175, 175, 172] : null));
      __mstest.renderControls();
    });
    assert.equal(await page.evaluate(() => __mstest.assignData.N), 0);
    await page.click('#sfPhGreys');
    await idle(page);
    const r = await page.evaluate(() => ({
      N: __mstest.assignData.N,
      greys: __mstest.photoGreys,
      d: __mstest.currentDesignObj(),
    }));
    assert.ok(r.N > 30, 'the grey sections coloured: ' + r.N);
    assert.equal(r.greys, true);
    assert.equal(r.d.payload.style.photo.greys, true);
    await page.evaluate(
      (d) => __mstest.openDesignObj(Object.assign({}, d.payload, { name: 'Grey', W: d.W, H: d.H }), null),
      r.d,
    );
    await page.waitForFunction(() => !!__mstest.photoRef);
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.photoGreys), true);
    assert.deepEqual(errors, []);
    await ctx.close();
  });
  test('a photo dragged off the drawing is said to be, and the sections are laid as before', async () => {
    const { page, errors, ctx } = await openApp({ width: 1180, height: 820 });
    await sample(page);
    await page.click('.sftabbtn[data-t="pattern"]');
    const r = await page.evaluate((fSrc) => {
      const t = __mstest;
      __place(eval('(' + fSrc + ')'));
      t.photoXf = Object.assign({}, t.photoXf, { cx: t.W * 3 });
      t.photoRecolour();
      t.renderControls();
      return {
        N: t.assignData.N,
        none: t.phNone[0],
        text: (document.querySelector('.sfphstat') || {}).textContent,
      };
    }, field.toString());
    assert.ok(r.none && r.none.off);
    assert.ok(r.N > 100);
    assert.match(
      r.text,
      /^The photo isn’t over the picture\. Drag it onto the drawing, or tap Line up photo\./,
    );
    assert.deepEqual(errors, []);
    await ctx.close();
  });
  test('with zones, a photo with no colour says so of the zone', async () => {
    const { page, errors, ctx } = await openApp({ width: 1180, height: 820 });
    await sample(page);
    await page.click('.sftabbtn[data-t="pattern"]');
    const r = await page.evaluate(
      ([fSrc, paper]) => {
        const t = __mstest;
        __place(eval('(' + fSrc + ')'), paper, true);
        const ls = t.assignData.paper
          ? Object.keys(t.assignData.paper)
              .map(Number)
              .filter((l) => t.comps[l].cy > t.H / 2)
          : [];
        const z = t.zoneNew();
        t.zoneMove(ls, z.id);
        t.zoneSelect(z.id);
        t.photoRecolour();
        t.renderControls();
        return {
          fam: t.family,
          n: ls.length,
          none: t.phNone[z.id],
          text: (document.querySelector('.sfphstat') || {}).textContent,
        };
      },
      [uncoloured.toString(), cream],
    );
    assert.equal(r.fam, 'photo');
    assert.ok(r.n > 10);
    assert.ok(r.none && !r.none.off);
    assert.match(r.text, /^No colour in the photo over this zone, so every section is left white\./);
    assert.deepEqual(errors, []);
    await ctx.close();
  });
  test('Undo from a photo with no colour back to a coloured one takes the no-colour line away', async () => {
    const { page, errors, ctx } = await openApp({ width: 1180, height: 820 });
    await sample(page);
    await page.click('.sftabbtn[data-t="pattern"]');
    await page.evaluate(
      ([fSrc, uSrc, paper]) => {
        __place(eval('(' + fSrc + ')'));
        window.__coloured = __mstest.photoRef;
        __place(eval('(' + uSrc + ')'), paper, true);
        __mstest.renderControls();
      },
      [field.toString(), uncoloured.toString(), cream],
    );
    assert.match(await page.textContent('.sfphstat'), /^No colour in this photo/);
    // Undo back to the coloured photo (choosing a photo and placing it are steps of their own)
    for (let i = 0; i < 4 && !(await page.evaluate(() => __mstest.photoRef === window.__coloured)); i++) {
      await page.click('#sfPlanUndo');
      await idle(page);
    }
    assert.equal(await page.evaluate(() => __mstest.photoRef === window.__coloured), true);
    const r = await page.evaluate(() => ({
      N: __mstest.assignData.N,
      none: __mstest.phNone[0] || null,
      text: (document.querySelector('.sfphstat') || {}).textContent || '',
    }));
    assert.ok(r.N > 100, 'the coloured photo’s laying is back: ' + r.N);
    // (before the fix: the line stayed after Undo)
    assert.equal(r.none, null);
    assert.ok(!/No colour/.test(r.text), r.text);
    assert.deepEqual(errors, []);
    await ctx.close();
  });
  test(
    'Use N, a change of marker count, then Undo: the suggestion to use N doesn’t come back',
    notOnWebKit(WK.scale),
    async () => {
      const { page, errors, ctx } = await openApp({ width: 1180, height: 820 });
      await haveSet(page);
      await page.check('#wcSets input[data-i="6"]');
      await page.click('#wcAdd');
      await page.click('#wcSample');
      await page.waitForFunction(() => !!(window.__mstest && __mstest.assignData));
      await idle(page);
      // the guide's own sections painted with 8 markers from the collection (as e2e/photo-choice.test.mjs)
      const b64 = await page.evaluate(async () => {
        const M = __mstest,
          pool = M.colour.poolFor('all').filter((m) => m.lab && m.lab[0] < 85),
          truth = [];
        let sd = 7;
        const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
        while (truth.length < 8) {
          const m = pool[Math.floor(rnd() * pool.length)];
          if (!truth.some((o) => de2000(o.lab, m.lab) < 10)) truth.push(m);
        }
        const of = {};
        M.countedList().forEach((l, i) => {
          of[l] = truth[i % 8];
        });
        const W = M.W,
          H = M.H,
          lab = M.labels,
          gr = M.gray,
          c = document.createElement('canvas');
        c.width = W;
        c.height = H;
        const g = c.getContext('2d'),
          id = g.createImageData(W, H),
          d = id.data;
        for (let p = 0; p < W * H; p++) {
          const m = lab[p] > 0 && of[lab[p]];
          const rgb = m
            ? [1, 3, 5].map((k) => parseInt(m.hex.slice(k, k + 2), 16))
            : [gr[p], gr[p], gr[p]].map((v) => Math.min(255, v * 1.2));
          d[p * 4] = rgb[0];
          d[p * 4 + 1] = rgb[1];
          d[p * 4 + 2] = rgb[2];
          d[p * 4 + 3] = 255;
        }
        g.putImageData(id, 0, 0);
        const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
        return await new Promise((r) => {
          const f = new FileReader();
          f.onload = () => r(f.result.split(',')[1]);
          f.readAsDataURL(blob);
        });
      });
      await page.click('.sftabbtn[data-t="pattern"]');
      const [fc] = await Promise.all([
        page.waitForEvent('filechooser'),
        page.click('#sfFam [data-v="photo"]'),
      ]);
      await fc.setFiles({ name: 'page.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
      await page.waitForFunction(() => __mstest.photoRef && !__mstest.photoChecking);
      await idle(page);
      await page.evaluate(() => {
        const M = __mstest,
          r = M.photoRef;
        M.photoXf = { cx: M.W / 2, cy: M.H / 2, sx: M.W / r.w, sy: M.H / r.h, r: 0 };
        M.limitN = 4;
        M.photoRecolour();
      });
      await page.waitForFunction(() => __mstest.photoSug && !__mstest.photoSug.pending);
      await idle(page);
      assert.match((await page.textContent('#sfPhSug')).trim(), /^About 8 markers .* Use 8$/);
      await page.click('#sfPhUse');
      await idle(page);
      assert.equal(await page.evaluate(() => __mstest.limitN), 8);
      assert.equal((await page.textContent('#sfPhSug')).trim(), '');
      // a nudge of the marker count, then Undo back to the 8
      await page.evaluate(() => {
        __mstest.limitN = 9;
        __mstest.photoRecolour();
      });
      await idle(page);
      await page.click('#sfPlanUndo');
      await idle(page);
      assert.equal(await page.evaluate(() => __mstest.limitN), 8);
      // (before the fix: “About 8 markers … Use 8” again, with 8 already in use)
      assert.equal((await page.textContent('#sfPhSug')).trim(), '');
      assert.deepEqual(errors, []);
      await ctx.close();
    },
  );
}

// ---- from v318-polish.test.mjs ----
// v318 polish sweep: smaller fixes found by the v318 reviews, and more of the same kind. Each test fails without its fix.
{
  // The Photo pattern: the colours for where the photo was left come in two goes, a quick choice at once and the full one
  // half a second later, with its Undo step. Colour along opened in between kept the quick choice, with no Undo step.
  test('the photo dragged and the Plan left at once: its colours are finished, with their Undo step', async () => {
    const { page, errors } = await openApp();
    await haveSet(page);
    await page.check('#wcSets input[data-i="6"]');
    await page.click('#wcAdd');
    await page.click('#wcSample');
    await page.waitForFunction(() => !!(window.__mstest && __mstest.assignData));
    // a photo: blue top half, red bottom half
    const b64 = await page.evaluate(async () => {
      const c = document.createElement('canvas');
      c.width = 600;
      c.height = 800;
      const g = c.getContext('2d');
      g.fillStyle = '#2350c8';
      g.fillRect(0, 0, 600, 400);
      g.fillStyle = '#d0282c';
      g.fillRect(0, 400, 600, 400);
      return c.toDataURL('image/png').split(',')[1];
    });
    await page.click('.sftabbtn[data-t="pattern"]');
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#sfFam [data-v="photo"]')]);
    await fc.setFiles({ name: 'ref.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
    await page.waitForFunction(() => !!__mstest.photoRef);
    await idle(page);
    const n0 = await page.evaluate(() => __mstest.planCount);
    await scrollTop(page);
    const c = await page.locator('#sfCanvas').boundingBox();
    await page.mouse.move(c.x + c.width / 2, c.y + c.height * 0.3);
    await page.mouse.down();
    await page.mouse.move(c.x + c.width / 2, c.y + c.height * 0.6, { steps: 6 });
    await page.mouse.up();
    await page.click('#sfColor');
    await idle(page);
    const r = await page.evaluate(() => ({
      mode: __mstest.sfmode,
      n: __mstest.planCount,
      label: __mstest.planLabel,
    }));
    assert.equal(r.mode, 'color');
    assert.equal(r.n, n0 + 1, 'an Undo step for the move');
    assert.equal(r.label, 'Photo moved');
    assert.deepEqual(errors, []);
  });
}
