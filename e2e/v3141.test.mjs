// v314.1: fixes from fable's review of v314. A photo record from a backup is checked whole (it goes into the page as an
// <img>'s src); a PDF of many pages keeps its page pictures; Reveal's end lays the piece out again above its taller bar
// on a phone; Home's latest piece keeps one shape for Your page | Plan, its pill on the picture; the photo's corners
// put Keep as is first when the page wasn't found; Focus mode's Undo of Mark all takes the hand-off card away; "Last
// coloured" moves only when the ticks do; Swap it says what it swapped, with Undo. Each test fails on v314.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setup, teardown, openApp, sampleGuide, idle, welcome, saveGuide } from './helpers.mjs';

before(setup);
after(teardown);

// the made-up phone photos of e2e/v314-page-photo (a Letter page, the sample on it, on wood or a white table)
const SRC = await readFile(new URL('./v314-page-photo.test.mjs', import.meta.url), 'utf8');
const GEN = SRC.slice(SRC.indexOf('String.raw`') + 11, SRC.indexOf('}`;') + 1);
const photo = (page, o) =>
  page.evaluate(
    ([src, o]) => {
      eval(src);
      return makePhoto(o);
    },
    [GEN, o],
  ); // eslint-disable-line no-eval
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
        t = [...document.querySelectorAll('#sfEdAsk .sfpdfth')].map((e) => e.getBoundingClientRect().height);
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
  await page.click('#sfAlongRev');
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
