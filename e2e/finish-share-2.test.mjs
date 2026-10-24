// A finished page, Reveal, Save image, share, the photo of your page.
// (v320) Tests organised by feature: each block below came from the file named above it, its tests unchanged.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  haveSet,
  idle,
  letterGuide,
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
import { GEN_PAGE_PHOTO } from './photo-gens.mjs';
import { readFile } from 'node:fs/promises';

before(setup);
after(teardown);

// ---- from v3141.test.mjs ----
// v314.1: fixes from fable's review of v314. A photo record from a backup is checked whole (it goes into the page as an
// <img>'s src); a PDF of many pages keeps its page pictures; Reveal's end lays the piece out again above its taller bar
// on a phone; Home's latest piece keeps one shape for Your page | Plan, its pill on the picture; the photo's corners
// put Keep as is first when the page wasn't found; Focus mode's Undo of Mark all takes the hand-off card away; "Last
// coloured" moves only when the ticks do; Swap it says what it swapped, with Undo. Each test fails on v314.
{
  // the made-up phone photos of e2e/v314-page-photo (a Letter page, the sample on it, on wood or a white table)
  const GEN = GEN_PAGE_PHOTO;
  const photo = (page, o) =>
    page.evaluate(
      ([src, o]) => {
        eval(src);
        return makePhoto(o);
      },
      [GEN, o],
    );
  // eslint-disable-line no-eval
  const FOUND = { tilt: 25, roll: 8, size: 0.6 },
    PALE = { tilt: 20, roll: 4, size: 0.6, bg: 'white' };
  async function finished(page) {
    await sampleGuide(page);
    await page.evaluate(() => {
      const t = __mstest;
      t.styleVars.smpTry = 0;
      t.curName = 'Finished jellyfish';
      t.assignData.order.forEach((l) => {
        t.colored[l] = 1;
      });
      t.guideDirty = true;
      t.saveNow();
    });
    await page.waitForFunction(() => __mstest.inLibrary);
    await page.click('#sfColor');
    await idle(page);
    await page.waitForSelector('#sfFin [data-fin="add"]');
    return page.evaluate(() => __mstest.curId);
  }
  async function choose(page, ph, sel) {
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click(sel)]);
    await fc.setFiles({ name: 'my-page.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(ph.b64, 'base64') });
  }
  const box = (page, s) =>
    page.evaluate((s) => {
      const e = document.querySelector(s);
      return e ? e.getBoundingClientRect().toJSON() : null;
    }, s);
  // a PDF of Letter pages, each a grid of boxes (as e2e/v313-pdf makes them)
  function mkPdf(n) {
    const objs = [];
    const add = (s) => objs.push(s) && objs.length;
    const cat = add('<< /Type /Catalog /Pages 2 0 R >>');
    add('');
    const kids = [];
    for (let i = 0; i < n; i++) {
      const c = `3 w\n${60 + (i % 5) * 20} 90 400 500 re S\n`;
      const st = add(`<< /Length ${Buffer.byteLength(c)} >>\nstream\n${c}\nendstream`);
      kids.push(add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${st} 0 R >>`));
    }
    objs[1] = `<< /Type /Pages /Kids [${kids.map((k) => k + ' 0 R').join(' ')}] /Count ${kids.length} >>`;
    let out = '%PDF-1.4\n';
    const at = [];
    objs.forEach((o, i) => {
      at.push(Buffer.byteLength(out));
      out += `${i + 1} 0 obj\n${o}\nendobj\n`;
    });
    const x = Buffer.byteLength(out);
    out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
    for (const a of at) out += String(a).padStart(10, '0') + ' 00000 n \n';
    out += `trailer\n<< /Size ${objs.length + 1} /Root ${cat} 0 R >>\nstartxref\n${x}\n%%EOF\n`;
    return Buffer.from(out, 'latin1');
  }
  test('a photo record whose data URL carries more than base64 is left out: it never reaches the page', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await welcome(page, 'look');
    const r = await page.evaluate(() => {
      const ok = { u: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==', w: 10, h: 10, ts: 1, flat: 1 };
      return [
        finRecOk(ok),
        finRecOk(Object.assign({}, ok, { u: ok.u + '"><img src=x onerror="window.__bad=1">' })),
      ];
    });
    assert.deepEqual(r, [true, false]);
    assert.deepEqual(errors, []);
  });
  test('a PDF of 30 pages: each page’s picture keeps its size, and the list scrolls', async () => {
    for (const [w, h] of [
      [820, 1180],
      [1180, 820],
    ]) {
      const { page, errors } = await openApp({ width: w, height: h });
      await welcome(page, 'look');
      await page.click('#mSections');
      await idle(page);
      const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#sfPdf')]);
      await fc.setFiles({ name: 'book.pdf', mimeType: 'application/pdf', buffer: mkPdf(30) });
      await page.waitForSelector('#sfEdAsk .sfpdfpg');
      const r = await page.evaluate(() => {
        const g = document.querySelector('#sfEdAsk .sfpdfpgs'),
          t = [...document.querySelectorAll('#sfEdAsk .sfpdfth')].map(
            (e) => e.getBoundingClientRect().height,
          );
        return { min: Math.min(...t), scrolls: g.scrollHeight > g.clientHeight + 10 };
      });
      assert.ok(r.min > 80, `${w}: page pictures ${Math.round(r.min)} px tall`);
      assert.ok(r.scrolls, `${w}: the list scrolls`);
      await page.click('#sfEdAsk [data-a="cancel"]');
      assert.deepEqual(errors, []);
      await page.context().close();
    }
  });
  test('a phone: Reveal’s end with Plan and your page lays the piece and its caption out above its taller bar', async () => {
    const { page, errors } = await openApp({ width: 390, height: 844 });
    await finished(page);
    await page.evaluate(() => document.getElementById('sfDone').scrollIntoView({ block: 'center' }));
    await choose(page, await photo(page, FOUND), '#sfFin [data-fin="add"]');
    await page.waitForFunction(() => !!__mstest.fin.rec, null, { timeout: 30000 });
    await page.click('#sfDoneRev');
    await page.waitForSelector('#revFin', { timeout: 30000 });
    // (laid out again once the lift has finished)
    await page.waitForFunction(
      () => {
        const c = document.querySelector('.sfshow .sfsh-cap'),
          b = document.getElementById('sfRevealBar');
        return !!c && !!b && c.getBoundingClientRect().bottom <= b.getBoundingClientRect().top + 1;
      },
      null,
      { timeout: 10000 },
    );
    assert.deepEqual(errors, []);
  });
  test('Home’s latest piece on an iPad: Your page | Plan don’t move the card, the pill sits on the picture; the box takes the photo’s shape from the start', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await finished(page);
    await choose(page, await photo(page, FOUND), '#sfFin [data-fin="add"]');
    await page.waitForFunction(() => !!__mstest.fin.rec, null, { timeout: 30000 });
    const rec = await page.evaluate(() => __mstest.fin.rec);
    await page.click('#mHome');
    await idle(page);
    await page.waitForSelector('#homeHero .hhbox.ph img');
    const at = async () => ({
      card: await box(page, '#homeHero .hhcard'),
      pic: await box(page, '#homeHero .hhbox'),
      pill: await box(page, '#homeHero .hhseg'),
    });
    const a = await at();
    await page.click('#homeHero .hhseg [data-v="plan"]');
    const b = await at();
    assert.equal(b.card.height, a.card.height, 'the card stays');
    assert.equal(b.pic.width, a.pic.width, 'the picture stays');
    assert.ok(Math.abs(a.pic.width / a.pic.height - rec.w / rec.h) < 0.02, 'the photo’s shape');
    // the pill on the picture's foot, centred on it
    assert.ok(a.pill.bottom <= a.pic.bottom && a.pill.top >= a.pic.top, 'inside the picture');
    assert.ok(Math.abs(a.pill.x + a.pill.width / 2 - (a.pic.x + a.pic.width / 2)) < 2, 'centred');
    // the Library row knows the photo's shape, so a fresh Home starts the box in it (no change when the photo comes)
    const fa = await page.evaluate(() => state.saved.find((s) => s.type === 'guide').fa);
    assert.ok(Math.abs(fa - rec.w / rec.h) < 0.001, 'the row’s photo shape ' + fa);
    await page.reload();
    await idle(page);
    await page.click('#mHome');
    const ar0 = await page.evaluate(() =>
      parseFloat(document.querySelector('#homeHero .hhbox').style.getPropertyValue('--ar')),
    );
    assert.ok(Math.abs(ar0 - rec.w / rec.h) < 0.001, 'the first box is the photo’s shape');
    assert.deepEqual(errors, []);
  });
  test('Home’s latest piece: a page narrower than the Add photo pill puts the pill under it (iPad on its side)', async () => {
    const { page, errors } = await openApp({ width: 1180, height: 820 });
    await finished(page);
    await page.click('#mHome');
    await idle(page);
    await page.waitForSelector('#homeHero .hhfin:not([hidden])');
    const pic = await box(page, '#homeHero .hhbox'),
      pill = await box(page, '#homeHero .hhfin');
    assert.ok(pill.width <= pic.width || pill.top >= pic.bottom, 'not hanging off the picture');
    assert.deepEqual(errors, []);
  });
  test('the photo’s corners, the page not found: Keep as is is the main button and has the keyboard', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await finished(page);
    await choose(page, await photo(page, PALE), '#sfFin [data-fin="add"]');
    await page.waitForSelector('#sfFinEd #sfFinCv');
    assert.equal(await page.getAttribute('#sfFinEd [data-a="keep"]', 'class'), 'btn-primary');
    assert.equal(await page.evaluate(() => document.activeElement.dataset.a), 'keep');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => !!__mstest.fin.rec, null, { timeout: 30000 });
    assert.equal(await page.evaluate(() => __mstest.fin.rec.flat), 0, 'kept as taken');
    assert.deepEqual(errors, []);
  });
  test('Focus mode: Undo of Mark all takes the hand-off card away with the ticks', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await page.click('#sfColor');
    await idle(page);
    await page.click('#sfFocus');
    await idle(page);
    await page.click('#sfFocCols');
    await page.click('#sfFocAll');
    await idle(page);
    assert.equal(await page.isVisible('#sfHand'), true, 'the card');
    await page.click('#toastAct');
    await idle(page);
    assert.equal(await page.isVisible('#sfHand'), false, 'gone with the Undo');
    assert.deepEqual(errors, []);
  });
  test('“Last coloured” moves only when the ticks do: opening a guide in Colour along leaves it', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await page.evaluate(() => {
      const t = __mstest;
      t.styleVars.smpTry = 0;
      t.curName = 'Days test';
    });
    await saveGuide(page);
    await page.click('#sfColor');
    await idle(page);
    const id = await page.evaluate(() => __mstest.curId);
    // a tick: stamped
    await page.evaluate(() => {
      const t = __mstest;
      t.colored[t.assignData.order[0]] = 1;
      t.updateProgress();
    });
    assert.ok((await page.evaluate(() => __mstest.currentDesignObj().payload.dates.l)) > Date.now() - 60000);
    await page.evaluate(() => __mstest.flushSave());
    await idle(page);
    // three days ago, as stored; opened again, nothing ticked
    const old = Date.now() - 3 * 864e5;
    await page.evaluate(
      ([id, old]) =>
        IDB.get('guide-' + id).then((p) => {
          p.dates.l = old;
          return IDB.put('guide-' + id, p);
        }),
      [id, old],
    );
    await page.reload();
    await idle(page);
    await page.evaluate((id) => loadGuide({ id }), id);
    await page.waitForFunction((id) => __mstest.curId === id && __mstest.assignData, id);
    await idle(page);
    // (a started guide opens in Colour along)
    if (await page.isVisible('#sfColor')) await page.click('#sfColor');
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.sfmode), 'color');
    assert.equal(await page.evaluate(() => __mstest.currentDesignObj().payload.dates.l), old, 'as it was');
    // a tick: now
    await page.evaluate(() => {
      const t = __mstest;
      t.colored[t.assignData.order[1]] = 1;
      t.updateProgress();
    });
    assert.ok((await page.evaluate(() => __mstest.currentDesignObj().payload.dates.l)) > old + 864e5);
    assert.deepEqual(errors, []);
  });
  test('Swap it says which marker took the low one’s place, with an Undo', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    const k = await page.evaluate(() => {
      const t = __mstest,
        n = {};
      for (const l of t.assignData.order)
        n[t.assignData.assign[l].mkey] = (n[t.assignData.assign[l].mkey] || 0) + 1;
      return Object.entries(n).sort((a, b) => b[1] - a[1])[0][0];
    });
    await page.click('#mCollection');
    await idle(page);
    await page.evaluate((k) => {
      state.ink[k] = 'low';
      save();
      chrome();
    }, k);
    await page.click('#mSections');
    await idle(page);
    assert.doesNotMatch(await page.textContent('#sfLowLine span'), /·\s*$/, 'no dot left hanging');
    await page.click('#sfLowSwap');
    await idle(page);
    const t = await page.textContent('#msToast');
    assert.match(t, new RegExp('Swapped ' + k.split('|')[1] + ' for [A-Z]+\\d+ in \\d+ sections, pinned'));
    await page.click('#toastAct');
    await idle(page);
    assert.ok(
      await page.evaluate(
        (k) => __mstest.assignData.order.some((l) => __mstest.assignData.assign[l].mkey === k),
        k,
      ),
      'Undo put it back',
    );
    assert.deepEqual(errors, []);
  });
}

// ---- from v315-card.test.mjs ----
// v315 (Q7): the plan-and-your-page card stays 1080 × 1350, and lays the two side by side or one over the other,
// whichever shows both pictures bigger (v314: side by side only for a tall plan, whatever the photo); THE PLAN and MY
// PAGE are never under 2% of its width; on a phone held sideways its dialog's Share is on the screen. Fails on v314.1.
{
  // the card for a grey photo w × h: { w, h, side, lab, plan, page }
  const card = (page, w, h) =>
    page.evaluate(
      ([w, h]) => {
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const g = c.getContext('2d');
        g.fillStyle = '#ddd';
        g.fillRect(0, 0, w, h);
        const k = __mstest.fin.cardOf(c);
        return {
          w: k.width,
          h: k.height,
          side: k.finAt.side,
          lab: k.finAt.lab,
          plan: k.finAt.plan,
          page: k.finAt.page,
        };
      },
      [w, h],
    );
  const area = (r) => Math.min(r.plan.w * r.plan.h, r.page.w * r.page.h);
  test('a tall plan: side by side for a page-shaped photo, one over the other for a panorama; labels at least 2% of the width', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await idle(page);
    const a = await card(page, 900, 1200);
    assert.deepEqual([a.w, a.h, a.side], [1080, 1350, true]);
    const pano = await card(page, 1800, 600);
    assert.deepEqual([pano.w, pano.h, pano.side], [1080, 1350, false], 'a panorama under the plan');
    for (const r of [a, pano]) assert.ok(r.lab >= 0.02 * 1080 - 0.01, 'label ' + r.lab);
    // the one chosen shows the smaller picture bigger than the other would
    const other = await page.evaluate(() => {
      const c = document.createElement('canvas');
      c.width = 1800;
      c.height = 600;
      const k = __mstest.fin.cardOf(c, true);
      return { plan: k.finAt.plan, page: k.finAt.page };
    });
    assert.ok(area(pano) > area(other), 'stacked shows them bigger');
    assert.deepEqual(errors, []);
  });
  test('a wide plan beside a tall photo (v314 stacked them, both small)', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await welcome(page, 'look');
    await idle(page);
    await page.click('#mSections');
    await idle(page);
    // a wide page of boxes, drawn here
    const png = await page.evaluate(() => {
      const c = document.createElement('canvas');
      c.width = 1200;
      c.height = 800;
      const g = c.getContext('2d');
      g.fillStyle = '#fff';
      g.fillRect(0, 0, 1200, 800);
      g.lineWidth = 6;
      for (let i = 0; i < 6; i++)
        for (let j = 0; j < 4; j++) g.strokeRect(60 + i * 180, 60 + j * 170, 160, 150);
      return c.toDataURL('image/png').split(',')[1];
    });
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.evaluate(() => SF.pickPhoto())]);
    await fc.setFiles({ name: 'wide.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
    await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 60000 });
    await idle(page);
    await page.click('#sfBuild');
    await page.waitForFunction(() => __mstest.assignData && __mstest.sfmode === 'guide', null, {
      timeout: 60000,
    });
    await idle(page);
    const r = await card(page, 900, 1200);
    assert.equal(r.side, true, 'side by side');
    const v314 = await page.evaluate(() => {
      const c = document.createElement('canvas');
      c.width = 900;
      c.height = 1200;
      const k = __mstest.fin.cardOf(c, false);
      return { plan: k.finAt.plan, page: k.finAt.page };
    });
    assert.ok(area(r) > area(v314), `bigger than v314’s stack: ${area(r)} > ${area(v314)}`);
    assert.deepEqual(errors, []);
  });
  test('a phone held sideways: the card’s Share is on the screen', async () => {
    const { page, errors } = await openApp({ width: 844, height: 390 });
    await sampleGuide(page);
    await page.evaluate(() => {
      const t = __mstest;
      t.styleVars.smpTry = 0;
      t.curName = 'Finished jellyfish';
      t.assignData.order.forEach((l) => {
        t.colored[l] = 1;
      });
      t.guideDirty = true;
      t.saveNow();
    });
    await page.waitForFunction(() => __mstest.inLibrary);
    const id = await page.evaluate(() => __mstest.curId);
    await page.evaluate((id) => {
      const c = document.createElement('canvas');
      c.width = 850;
      c.height = 1100;
      const g = c.getContext('2d');
      g.fillStyle = '#c33';
      g.fillRect(0, 0, 850, 1100);
      return IDB.put('fin-' + id, {
        u: c.toDataURL('image/jpeg', 0.8),
        w: 850,
        h: 1100,
        ts: Date.now(),
        flat: 1,
      });
    }, id);
    await page.click('#sfColor');
    await idle(page);
    await page.waitForSelector('#sfFin [data-fin="show"]');
    await page.click('#sfFin .sflink[data-fin="show"]');
    await page.waitForSelector('#sfFinCard img');
    await page.waitForFunction(() => document.querySelector('#sfFinCard img').complete);
    const b = await page.evaluate(
      () => document.querySelector('#sfFinCard [data-a="share"]').getBoundingClientRect().bottom,
    );
    assert.ok(b <= 390, 'Share’s bottom ' + b + ' on a 390 px screen');
    assert.deepEqual(errors, []);
  });
}

// ---- from v315-fixes.test.mjs ----
// v315 (Q10): small fixes. A photo of the finished page changed elsewhere (another tab, a restore) is shown when the
// tab comes back into view; a restore brings the backup's photo in when it's newer than the one here; the photo's
// record is read as a guide opens (so Put back always has it), without decoding the picture; and opening a PDF
// offline, before the PDF reader was ever fetched, says it needs the internet once. Each test fails on v314.1.
{
  // the sample, every section coloured, in the Library and open in Colour along
  async function finished(page) {
    await sampleGuide(page);
    await page.evaluate(() => {
      const t = __mstest;
      t.styleVars.smpTry = 0;
      t.curName = 'Finished jellyfish';
      t.assignData.order.forEach((l) => {
        t.colored[l] = 1;
      });
      t.guideDirty = true;
      t.saveNow();
    });
    await page.waitForFunction(() => __mstest.inLibrary);
    await page.click('#sfColor');
    await idle(page);
    await page.waitForSelector('#sfFin [data-fin="add"]');
    return page.evaluate(() => __mstest.curId);
  }
  // a photo record put straight in (a plain JPEG of one colour, as another tab or a restore would leave it)
  const putRec = (page, id, ts, col) =>
    page.evaluate(
      ([id, ts, col]) => {
        const c = document.createElement('canvas');
        c.width = 170;
        c.height = 220;
        const g = c.getContext('2d');
        g.fillStyle = col;
        g.fillRect(0, 0, 170, 220);
        const r = { u: c.toDataURL('image/jpeg', 0.8), w: 170, h: 220, ts, flat: 1 };
        return IDB.put('fin-' + id, r).then(() => r.u);
      },
      [id, ts, col],
    );
  const stored = (page, id) => page.evaluate((id) => IDB.get('fin-' + id).then((r) => r || null), id);
  // (in the page: waitForFunction doesn't wait for a promise) until the stored photo is u
  const storedIs = (page, id, u) =>
    page.evaluate(
      ([id, u]) =>
        new Promise((res, rej) => {
          const t0 = Date.now(),
            go = () =>
              IDB.get('fin-' + id).then((r) => {
                if (r && r.u === u) res();
                else if (Date.now() - t0 > 30000) rej(new Error('not the photo expected'));
                else setTimeout(go, 100);
              });
          go();
        }),
      [id, u],
    );
  // a restore of the Library's backup file, to its end (it reads the open guide's photo again last)
  async function restore(page, file) {
    await page.evaluate(() => {
      window.__fr = 0;
      const o = SF.finRefresh;
      SF.finRefresh = function () {
        window.__fr++;
        return o.apply(this, arguments);
      };
    });
    await page.setInputFiles('#guidesFile', file);
    await page.waitForFunction(() => window.__fr > 0, null, { timeout: 30000 });
    await idle(page);
  }
  const backInView = (page) => page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  test('a photo added, changed or removed in another tab shows when this tab comes back into view', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    const id = await finished(page);
    // added elsewhere
    const u1 = await putRec(page, id, Date.now(), '#c33');
    await backInView(page);
    await page.waitForSelector('#sfFin .sffinpic img');
    assert.equal(await page.evaluate(() => __mstest.fin.rec.u), u1);
    // changed elsewhere
    const u2 = await putRec(page, id, Date.now() + 1000, '#36c');
    await backInView(page);
    await page.waitForFunction((u) => document.querySelector('#sfFin .sffinpic img').src === u, u2);
    // removed elsewhere
    await page.evaluate((id) => IDB.del('fin-' + id), id);
    await backInView(page);
    await page.waitForSelector('#sfFin [data-fin="add"]');
    assert.equal(await page.evaluate(() => __mstest.fin.rec), null);
    assert.deepEqual(errors, []);
  });
  test('restoring a backup: its photo comes in when newer than the one here, not when older', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    const id = await finished(page);
    const t0 = Date.now();
    const uOld = await putRec(page, id, t0, '#c33');
    await page.evaluate(() => openLibrary());
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#guidesBackup')]);
    const file = await dl.path();
    await page.keyboard.press('Escape');
    await idle(page);
    // a newer photo here: the backup's older one doesn't replace it
    const uNew = await putRec(page, id, t0 + 5000, '#36c');
    await restore(page, file);
    assert.equal((await stored(page, id)).u, uNew, 'the newer one here kept');
    // an older photo here: the backup's newer one comes in, and the open guide shows it
    const fs = await import('node:fs/promises');
    const bk = JSON.parse(await fs.readFile(file, 'utf8'));
    bk.guides.find((g) => g.id === id).fin.ts = t0 + 9000;
    await fs.writeFile(file, JSON.stringify(bk));
    await restore(page, file);
    await storedIs(page, id, uOld);
    await page.waitForFunction((u) => __mstest.fin.rec && __mstest.fin.rec.u === u, uOld, { timeout: 15000 });
    assert.deepEqual(errors, []);
  });
  test('the photo’s record is read as a guide opens, without decoding the picture', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    const id = await finished(page);
    const u = await putRec(page, id, Date.now(), '#c33');
    // not finished any more (Reset progress keeps the photo): it opens on its plan, with no Page finished panel
    await page.evaluate(() => {
      const t = __mstest;
      t.assignData.order.forEach((l) => {
        t.colored[l] = 0;
      });
      t.guideDirty = true;
      t.saveNow();
    });
    await idle(page);
    await page.reload();
    await idle(page);
    await page.evaluate((id) => SF.openDesign(id), id);
    await page.waitForFunction((id) => __mstest.curId === id && __mstest.fin.read, id, { timeout: 15000 });
    assert.equal(await page.evaluate(() => __mstest.fin.rec && __mstest.fin.rec.u), u, 'read');
    assert.equal(await page.evaluate(() => __mstest.fin.decoded), false, 'not decoded');
    assert.deepEqual(errors, []);
  });
  test('offline, before the PDF reader was ever fetched: opening a PDF says it needs the internet once', async () => {
    const { page, ctx, errors } = await openApp({ width: 820, height: 1180 });
    await page.waitForFunction(() => window.SF && SF.pickPhoto);
    await ctx.setOffline(true);
    const pdf = Buffer.from(
      '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n',
      'latin1',
    );
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.evaluate(() => SF.pickPhoto())]);
    await fc.setFiles({ name: 'page.pdf', mimeType: 'application/pdf', buffer: pdf });
    await page.waitForFunction(
      () =>
        /Opening a PDF needs the internet the first time/.test(document.getElementById('sfRoot').textContent),
      null,
      { timeout: 30000 },
    );
    await ctx.setOffline(false);
    assert.deepEqual(errors, []);
  });
}

// ---- from v315.test.mjs ----
// v315: a photo of the finished page is of a COLOURED page. The page finder's paper view split the photo at the drawing's
// colours, so a coloured page on a light grey or light wood table was never found (the corners opened) where the same
// page uncoloured was. For a finished page the finder now splits again when the first split leaves nearly everything
// above it, keeping that split only where the brightness histogram has a clear valley (a white table's lighting has
// none). Building a guide from a photo is unchanged. And a photo taken with the phone turned, or upside down, is turned
// the right way up by comparing it with the plan; the panel's Turn turns it a quarter turn; the page takes the paper
// Print uses when it measures within 6% of it. Straightened by itself, its toast offers Adjust corners; on a patterned
// cloth the corners are shown to check; Turn keeps the day it was added and loses nothing. Tests 1–3, 5 and 6 fail on
// v314.1; 4 guards a photo already upright.
{
  // a made-up phone photo of a Letter page with `art` on it (a data: URL), turned and tilted in front of a 25 mm lens, on a
  // plain table of brightness `L`, or a red and white check cloth of `check` px squares (shaded a little, with noise and
  // JPEG); and where its corners really are
  const GEN = String.raw`
async function makePhoto(o) {
  const W = 1200, H = 1600;
  const art = new Image(); await new Promise((r) => { art.onload = r; art.src = o.art; });
  const PW = 850, PH = 1100, pg = document.createElement('canvas'); pg.width = PW; pg.height = PH; const p = pg.getContext('2d');
  let sd = 7; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  p.fillStyle = '#f7f5ef'; p.fillRect(0, 0, PW, PH);
  const s = Math.min((PW - 160) / art.width, (PH - 200) / art.height); p.drawImage(art, (PW - art.width * s) / 2, (PH - art.height * s) / 2, art.width * s, art.height * s);
  const pd = p.getImageData(0, 0, PW, PH).data;
  const f = 25 / 43.27 * Math.hypot(W, H), tx = (o.tilt || 0) * Math.PI / 180, rz = (o.roll || 0) * Math.PI / 180, sz = o.size || 0.8;
  const hw = 0.5 * 8.5, hh = 0.5 * 11, Z = (11 / sz) * f / H;
  const proj = (X, Y) => { let x = X, y = Y * Math.cos(tx), z = Y * Math.sin(tx); const x1 = x * Math.cos(rz) - y * Math.sin(rz), y1 = x * Math.sin(rz) + y * Math.cos(rz); return [W / 2 + f * x1 / (z + Z), H / 2 + f * y1 / (z + Z)]; };
  const C = [proj(-hw, -hh), proj(hw, -hh), proj(hw, hh), proj(-hw, hh)], Hm = __mstest.pgHomog(C, [[0, 0], [PW, 0], [PW, PH], [0, PH]]);
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'), im = g.createImageData(W, H), d = im.data;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const j = (y * W + x) * 4, den = Hm[6] * x + Hm[7] * y + 1, u = (Hm[0] * x + Hm[1] * y + Hm[2]) / den, v = (Hm[3] * x + Hm[4] * y + Hm[5]) / den; let r, gg, b;
    if (u >= 0 && v >= 0 && u < PW - 1 && v < PH - 1) { const k = ((v | 0) * PW + (u | 0)) * 4; r = pd[k]; gg = pd[k + 1]; b = pd[k + 2]; }
    else if (o.check) { const on = (Math.floor(x / o.check) + Math.floor(y / o.check)) % 2 === 0; r = on ? 200 : 240; gg = b = on ? 40 : 240; }
    else { r = gg = b = o.L; }
    const sh = 1 - 0.22 * (x / W * 0.6 + y / H * 0.4), nz = (rnd() - 0.5) * 12; d[j] = r * sh + nz; d[j + 1] = gg * sh + nz; d[j + 2] = b * sh + nz; d[j + 3] = 255; }
  g.putImageData(im, 0, 0);
  const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.88));
  const b64 = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result.split(',')[1]); fr.readAsDataURL(blob); });
  return { b64, C };
}`;
  const photo = (page, o) =>
    page.evaluate(
      ([src, o]) => {
        eval(src);
        return makePhoto(o);
      },
      [GEN, o],
    );
  // eslint-disable-line no-eval
  // the finder on a photo, as the finished-page path (coloured) and as guide building calls it
  const find = (page, b64) =>
    page.evaluate(async (b64) => {
      const im = new Image();
      im.src = 'data:image/jpeg;base64,' + b64;
      await im.decode();
      const t = __mstest,
        q = (f) => ({ tier: f.tier, why: f.why || '', q: f.q ? f.q.map((p) => p.map(Math.round)) : null });
      return { fin: q(t.pgFind(im, { coloured: true })), guide: q(t.pgFind(im)) };
    }, b64);
  const err = (q, C) => Math.max(...q.map((p, i) => Math.hypot(p[0] - C[i][0], p[1] - C[i][1]))) / 1600;
  // (Q4) the sample, every section coloured, in the Library and open in Colour along; its plan without a key, as a
  // coloured page is
  async function finishedArt(page) {
    await sampleGuide(page);
    await page.evaluate(() => {
      const t = __mstest;
      t.styleVars.smpTry = 0;
      t.curName = 'Finished jellyfish';
      t.assignData.order.forEach((l) => {
        t.colored[l] = 1;
      });
      t.guideDirty = true;
      t.saveNow();
    });
    await page.waitForFunction(() => __mstest.inLibrary);
    const art = await page.evaluate(() => document.getElementById('sfCanvas').toDataURL('image/png'));
    await page.click('#sfColor');
    await idle(page);
    await page.waitForSelector('#sfFin [data-fin="add"]');
    return art;
  }
  // which way up the stored photo is: compared with the plan as the app compares them, the turn that matches best
  const upright = (page) =>
    page.evaluate(async () => {
      const r = __mstest.fin.rec,
        im = new Image();
      im.src = r.u;
      await im.decode();
      const c = document.createElement('canvas');
      c.width = im.width;
      c.height = im.height;
      c.getContext('2d').drawImage(im, 0, 0);
      return { w: r.w, h: r.h, o: await __mstest.fin.orient(__mstest.curId, c) };
    });
  test('a coloured page on a grey table is found and straightened by itself; on a white table the corners still open; guide building finds as before', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    // the sample coloured as planned
    const art = await page.evaluate(() => __mstest.buildExportCanvas(false, true).toDataURL('image/png'));
    // a grey table at 70% of the paper's brightness: found now, not before (guide building still as before)
    const grey = await photo(page, { art, L: 170, tilt: 15, roll: 5, size: 0.7 });
    let r = await find(page, grey.b64);
    assert.equal(r.fin.tier, 'sure', JSON.stringify(r.fin));
    assert.ok(err(r.fin.q, grey.C) < 0.01, 'its corners: ' + err(r.fin.q, grey.C).toFixed(4));
    // (v318.35: guide building's edge fallback finds it too now; where it does, its corners are the page's)
    if (r.guide.tier === 'sure')
      assert.ok(
        err(r.guide.q, grey.C) < 0.01,
        'guide building\u2019s corners: ' + err(r.guide.q, grey.C).toFixed(4),
      );
    // a white table: no page offered with wrong corners
    const white = await photo(page, { art, L: 236, tilt: 15, roll: 5, size: 0.7 });
    r = await find(page, white.b64);
    assert.equal(r.fin.tier, 'none', 'white table: ' + JSON.stringify(r.fin));
    // a wood-dark table: found either way, the same corners
    const dark = await photo(page, { art, L: 90, tilt: 15, roll: 5, size: 0.7 });
    r = await find(page, dark.b64);
    assert.equal(r.fin.tier, 'sure');
    assert.deepEqual(r.fin.q, r.guide.q, 'the second split never runs where the first works');
    assert.deepEqual(errors, []);
  });
  test('the Page finished panel: a coloured page on a grey table, chosen as its photo, is straightened with no corners to drag; the note says how', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await page.evaluate(() => {
      const t = __mstest;
      t.styleVars.smpTry = 0;
      t.curName = 'Finished jellyfish';
      t.assignData.order.forEach((l) => {
        t.colored[l] = 1;
      });
      t.guideDirty = true;
      t.saveNow();
    });
    await page.waitForFunction(() => __mstest.inLibrary);
    await page.click('#sfColor');
    await idle(page);
    await page.waitForSelector('#sfFin [data-fin="add"]');
    assert.match(
      await page.textContent('#sfFin .sffinnote'),
      /On a plain table darker than the paper, it straightens by itself\./,
    );
    const art = await page.evaluate(() => __mstest.buildExportCanvas(false, true).toDataURL('image/png'));
    const ph = await photo(page, { art, L: 170, tilt: 15, roll: 5, size: 0.7 });
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#sfFin [data-fin="add"]')]);
    await fc.setFiles({ name: 'my-page.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(ph.b64, 'base64') });
    await page.waitForFunction(() => !!__mstest.fin.rec, null, { timeout: 30000 });
    assert.equal(await page.evaluate(() => __mstest.fin.rec.flat), 1, 'straightened');
    assert.equal(await page.locator('#sfFinEd').count(), 0, 'no corners asked for');
    // (Q9) its toast offers Adjust corners: the corners as found, to check
    await page.waitForSelector('#msToast #toastAct');
    assert.equal(await page.textContent('#toastAct'), 'Adjust corners');
    await page.click('#toastAct');
    await page.waitForFunction(() => !!__mstest.fin.editing);
    assert.ok(await page.evaluate(() => !!__mstest.fin.editing.q), 'the corners found');
    await page.keyboard.press('Escape');
    await idle(page);
    assert.equal(await page.locator('#sfFinEd').count(), 0);
    assert.deepEqual(errors, []);
  });
  test('a photo taken with the phone turned, or upside down, is kept the right way up; Turn turns it a quarter turn', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    const art = await finishedArt(page);
    let ts = 0;
    for (const roll of [88, 180, 268]) {
      const ph = await photo(page, { art, L: 90, tilt: 0, roll, size: 0.7 });
      const sel = ts ? '#sfFin [data-fin="change"]' : '#sfFin [data-fin="add"]';
      const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click(sel)]);
      await fc.setFiles({
        name: 'my-page.jpg',
        mimeType: 'image/jpeg',
        buffer: Buffer.from(ph.b64, 'base64'),
      });
      await page.waitForFunction((t) => __mstest.fin.rec && __mstest.fin.rec.ts > t, ts, { timeout: 30000 });
      ts = await page.evaluate(() => __mstest.fin.rec.ts);
      const u = await upright(page);
      assert.ok(u.h > u.w, `roll ${roll}: upright, not on its side (${u.w}×${u.h})`);
      assert.equal(u.o.turns, 0, `roll ${roll}: needs no more turning (scores ${u.o.sc})`);
      assert.match(await page.textContent('#msToast'), /turned upright/);
    }
    // Turn: a quarter turn clockwise, then back with three more
    await page.click('#sfFin [data-fin="turn"]');
    await page.waitForFunction((t) => __mstest.fin.rec.ts > t, ts);
    const t1 = await page.evaluate(() => __mstest.fin.rec);
    assert.ok(t1.w > t1.h, 'on its side after a quarter turn');
    assert.match(await page.textContent('#msToast'), /Photo turned\./);
    assert.equal(
      await page.evaluate(
        (id) => state.saved.find((s) => s.id === id).fa,
        await page.evaluate(() => __mstest.curId),
      ),
      Math.round((t1.w / t1.h) * 10000) / 10000,
      'Home’s shape follows',
    );
    assert.deepEqual(errors, []);
  });
  test('a page photographed upright stays as it is; the page’s shape is the paper Print uses when it’s within 6%', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    const art = await finishedArt(page);
    const ph = await photo(page, { art, L: 90, tilt: 20, roll: 4, size: 0.7 });
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#sfFin [data-fin="add"]')]);
    await fc.setFiles({ name: 'my-page.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(ph.b64, 'base64') });
    await page.waitForFunction(() => !!__mstest.fin.rec, null, { timeout: 30000 });
    assert.doesNotMatch(await page.textContent('#msToast'), /turned/);
    const r = await page.evaluate(() => __mstest.fin.rec);
    // Letter (the paper here), as Print has it
    assert.ok(Math.abs(r.w / r.h - 8.5 / 11) < 0.004, 'Letter: ' + (r.w / r.h).toFixed(4));
    assert.deepEqual(errors, []);
  });
  test('(Q9) a finished page on a check cloth: found, but the corners shown to check, not trusted; on a plain table, trusted', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await idle(page);
    const art = await page.evaluate(() => __mstest.buildExportCanvas(false, true).toDataURL('image/png'));
    const cloth = await find(
      page,
      (await photo(page, { art, check: 12, tilt: 15, roll: 0, size: 0.75 })).b64,
    );
    assert.equal(cloth.fin.tier, 'unsure');
    assert.equal(cloth.fin.why, 'cloth');
    const plain = await find(page, (await photo(page, { art, L: 120, tilt: 15, roll: 0, size: 0.75 })).b64);
    assert.equal(plain.fin.tier, 'sure', 'a plain table as before');
    assert.deepEqual(errors, []);
  });
  test('(Q9) Turn keeps the day the photo was added, loses nothing turned right round, and Adjust corners keeps the turn', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    const art = await finishedArt(page);
    const id = await page.evaluate(() => __mstest.curId);
    const ph = await photo(page, { art, L: 120, tilt: 10, roll: 3, size: 0.7 });
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#sfFin [data-fin="add"]')]);
    await fc.setFiles({ name: 'my-page.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(ph.b64, 'base64') });
    await page.waitForFunction(() => !!__mstest.fin.rec && __mstest.fin.rec.flat === 1, null, {
      timeout: 30000,
    });
    const r0 = await page.evaluate(() => __mstest.fin.rec);
    // added five days ago
    const old = Date.now() - 5 * 864e5;
    await page.evaluate(
      ([id, r, old]) =>
        IDB.put('fin-' + id, Object.assign({}, r, { ts: old, added: old })).then(() =>
          __mstest.fin.refresh(),
        ),
      [id, r0, old],
    );
    await page.waitForFunction((old) => __mstest.fin.rec.ts === old, old);
    const turned = (n) => page.waitForFunction((n) => __mstest.fin.rec.ts > n, n, { timeout: 30000 });
    let t = old;
    for (let i = 0; i < 4; i++) {
      await page.click('#sfFin [data-fin="turn"]');
      await turned(t);
      t = await page.evaluate(() => __mstest.fin.rec.ts);
      assert.equal(await page.evaluate(() => __mstest.fin.rec.added), old, 'still added five days ago');
      assert.doesNotMatch(await page.textContent('#sfFin .sffinwhen'), /today/);
    }
    assert.equal(await page.evaluate(() => __mstest.fin.rec.u), r0.u, 'turned right round: the same photo');
    // one turn, then Adjust corners › Straighten: still turned
    await page.click('#sfFin [data-fin="turn"]');
    await turned(t);
    t = await page.evaluate(() => __mstest.fin.rec.ts);
    const w1 = await page.evaluate(() => __mstest.fin.rec.w);
    await page.click('#sfFin [data-fin="adjust"]');
    await page.waitForSelector('#sfFinEd [data-a="go"]');
    await page.click('#sfFinEd [data-a="go"]');
    await turned(t);
    assert.equal(await page.evaluate(() => __mstest.fin.rec.w), w1, 'the turn kept');
    assert.equal(await page.evaluate(() => __mstest.fin.rec.added), old);
    assert.deepEqual(errors, []);
  });
}

// ---- from v318-polish.test.mjs ----
// v318 polish sweep: smaller fixes found by the v318 reviews, and more of the same kind. Each test fails without its fix.
{
  // The sample, finished in Colour along, is first saved a moment later: "Saved in your Library…" replaced "Page
  // finished." in what a screen reader is told, before it could be read. Both are said now, Page finished first.
  test('the page finished as the guide is first saved: screen readers are told both, Page finished first', async () => {
    const { page, errors } = await openApp({ width: 390, height: 844, storage: { 'ms-wake-told': '1' } });
    await sampleGuide(page);
    await idle(page);
    await page.click('#sfColor');
    await idle(page);
    const last = await page.evaluate(() => {
      const t = __mstest,
        ks = [...document.querySelectorAll('#sfAlist .sfarow')].map((r) => r.dataset.k),
        k = ks[ks.length - 1];
      t.assignData.order.forEach((l) => {
        if (t.assignData.assign[l].mkey !== k) t.colored[l] = 1;
      });
      return k;
    });
    await page.click(`#sfAlist .sfarow[data-k="${last}"] .sfah`);
    await idle(page);
    await page.click('#sfMarkAll');
    await until(page, () => __mstest.inLibrary, null, 'the guide saved', 15000);
    await idle(page);
    const said = await page.textContent('#sfLive');
    assert.match(said, /^Page finished\. .*Saved in your Library\. Changes now save automatically\.$/);
    assert.deepEqual(errors, []);
  });
}

// ---- from v318-review-guide.test.mjs ----
// v318 review (the guide's workflow, end to end). Each test fails on v318 as released.
{
  // the sample's sections, biggest first
  const biggest = (page) =>
    page.evaluate(() => {
      const t = __mstest;
      return t.assignData.order.slice().sort((a, b) => t.comps[b].area - t.comps[a].area);
    });
  // The sample isn't in the Library until something changes it: finished by its last tick, it was saved then, but the
  // Page finished panel had no "Add a photo of your page" until Colour along was left and opened again.
  test('a page finished as its guide is first saved offers Add a photo of your page at once', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.inLibrary), false, 'the sample isn’t in the Library yet');
    await page.click('#sfColor');
    await idle(page);
    const order = await biggest(page);
    await page.evaluate((rest) => {
      const t = __mstest;
      rest.forEach((l) => (t.colored[l] = 1));
      t.renderGuide();
    }, order.slice(1));
    await scrollTop(page);
    const p = await sectionPoint(page, order[0]);
    await page.mouse.click(p.x, p.y);
    await page.waitForFunction(() => __mstest.inLibrary, null, { timeout: 10000 });
    await idle(page);
    assert.ok(await page.isVisible('#sfFin .sffinadd'), 'Add a photo of your page is offered');
    assert.deepEqual(errors, []);
  });
}
