// v318.25 in the browser.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setup, teardown, openApp, openAtScale, idle, pause, sampleGuide, sectionPoint } from './helpers.mjs';

before(setup);
after(teardown);

// ---------------------------------------------------------------------------------------------------------------------
// X3: making a guide (Undo through a turn while sections are found again; a PDF drawn in grey lines), Focus mode's
// hand-off card on a small phone, finishing a page again, the PDF's name, What's new and the tester card in two tabs
// ---------------------------------------------------------------------------------------------------------------------

// a 1800 x 2400 photo of rings (some faint) with grain, as a JPEG
async function ringPhoto(page) {
  const b64 = await page.evaluate(async () => {
    const c = document.createElement('canvas');
    c.width = 1800;
    c.height = 2400;
    const g = c.getContext('2d');
    g.fillStyle = '#f4f1ea';
    g.fillRect(0, 0, 1800, 2400);
    let k = 0;
    for (let y = 200; y < 2400; y += 300)
      for (let x = 200; x < 1800; x += 300) {
        g.strokeStyle = k % 3 === 0 ? '#b8b4ac' : '#1a1a1a';
        g.lineWidth = k % 2 ? 3 : 6;
        g.beginPath();
        g.arc(x, y, 120, 0, 6.283);
        g.stroke();
        g.beginPath();
        g.moveTo(x - 120, y);
        g.lineTo(x + 120, y);
        g.stroke();
        k++;
      }
    const im = g.getImageData(0, 0, 1800, 2400),
      d = im.data;
    let s = 7;
    for (let i = 0; i < d.length; i += 4) {
      s = (s * 16807) % 2147483647;
      const n = (s / 2147483647 - 0.5) * 30;
      d[i] += n;
      d[i + 1] += n;
      d[i + 2] += n;
    }
    g.putImageData(im, 0, 0);
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.92));
    return await new Promise((r) => {
      const f = new FileReader();
      f.onload = () => r(f.result.split(',')[1]);
      f.readAsDataURL(blob);
    });
  });
  return { name: 'page.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(b64, 'base64') };
}
const free = (page) =>
  page.waitForFunction(
    () =>
      !__mstest.segBusy &&
      !/Detecting|Reading/.test((document.getElementById('sfStat') || {}).textContent || ''),
    null,
    { timeout: 40000 },
  );
const secState = (page) =>
  page.evaluate(() => ({
    sig: __mstest.labelsSig(),
    c: __mstest.adaptC,
    sens: document.getElementById('sfSens').value,
    rot: __mstest.rot90,
  }));
// the Sensitivity slider moved, as a drag does
const sens = (page, v) =>
  page.evaluate((v) => {
    const s = document.getElementById('sfSens');
    s.value = String(v);
    s.dispatchEvent(new Event('input', { bubbles: true }));
  }, v);

test('X3 D1: turned while a new Sensitivity’s sections are found: one Undo, back to the sections and Sensitivity before both', async () => {
  const { page, errors } = await openApp({ width: 1180, height: 820 });
  await sampleGuide(page);
  await page.setInputFiles('#sfFile', await ringPhoto(page));
  await page.waitForFunction(() => __mstest.W === 1800 && !__mstest.segBusy, null, { timeout: 40000 });
  await free(page);
  await page.click('#sfAdjToggle');
  await idle(page);
  const r0 = await secState(page);
  await sens(page, 9);
  // (the turn before those sections are in place: the slider's change waits a moment for the next)
  await page.waitForFunction(() => __mstest.segBusy, null, { polling: 10 });
  await page.evaluate(() => document.getElementById('sfRotR').click());
  await free(page);
  await idle(page);
  assert.equal((await secState(page)).rot, 90);
  await page.evaluate(() => __mstest.doUndoSeg());
  await free(page);
  await idle(page);
  // (it had brought back the old sections with Sensitivity 9's setting, then a second Undo changed only the slider)
  assert.deepEqual(await secState(page), r0, 'the sections, setting and slider as they were before both');
  assert.equal(await page.evaluate(() => __mstest.undoCount), 0, 'no Undo step left that changes nothing');
  assert.deepEqual(errors, []);
});

// (straighten.test.mjs's made-up phone photo of a page on a table)
const GEN = /const GEN = String\.raw`([\s\S]*?)`;/.exec(
  readFileSync(new URL('./straighten.test.mjs', import.meta.url), 'utf8'),
)[1];
test('X3 D1: Adjust corners while a new Sensitivity’s sections are found, then Cancel: Undo still goes back from them', async () => {
  const { page, errors } = await openApp({ width: 1180, height: 820 });
  await sampleGuide(page);
  const ph = await page.evaluate(
    async ([src, o]) => (eval(src), makePhoto(o)),
    [GEN, { tilt: 25, roll: 8, size: 0.6 }],
  );
  await page.setInputFiles('#sfFile', {
    name: 'page.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from(ph.b64, 'base64'),
  });
  await page.waitForSelector('#sfPgAdj', { state: 'attached', timeout: 40000 });
  await free(page);
  await page.click('#sfAdjToggle');
  await idle(page);
  const r0 = await secState(page);
  await sens(page, 9);
  await page.waitForFunction(() => __mstest.segBusy, null, { polling: 10 });
  await page.evaluate(() => document.getElementById('sfPgAdj').click());
  await page.waitForSelector('#sfPgNo', { state: 'visible' });
  await page.click('#sfPgNo');
  await free(page);
  await idle(page);
  assert.equal((await secState(page)).sens, '9');
  await page.evaluate(() => __mstest.doUndoSeg());
  await free(page);
  await idle(page);
  assert.deepEqual(await secState(page), r0);
  assert.deepEqual(errors, []);
});

// a one-page Letter PDF of circles stroked in grey g (0 black, 1 white)
function greyPDF(g) {
  const circle = (cx, cy, r) => {
    const k = 0.5523 * r;
    return `${cx + r} ${cy} m ${cx + r} ${cy + k} ${cx + k} ${cy + r} ${cx} ${cy + r} c ${cx - k} ${cy + r} ${cx - r} ${cy + k} ${cx - r} ${cy} c ${cx - r} ${cy - k} ${cx - k} ${cy - r} ${cx} ${cy - r} c ${cx + k} ${cy - r} ${cx + r} ${cy - k} ${cx + r} ${cy} c S\n`;
  };
  const content =
    `1.5 w ${g} G\n` +
    circle(306, 396, 250) +
    circle(306, 396, 120) +
    circle(200, 250, 60) +
    circle(420, 560, 60);
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [4 0 R] /Count 1 >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 3 0 R /Resources << >> >>',
  ];
  let out = '%PDF-1.4\n';
  const offs = [];
  objs.forEach((o, i) => {
    offs.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const x = out.length;
  out +=
    `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` +
    offs.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('') +
    `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}
test('X3 D2: a PDF page drawn in mid or light grey lines opens; it isn’t “blank”', async () => {
  const { page, errors } = await openApp({ width: 1180, height: 820 });
  await sampleGuide(page);
  await page.setInputFiles('#sfPdfFile', {
    name: 'grey.pdf',
    mimeType: 'application/pdf',
    buffer: greyPDF(0.7),
  });
  await page.waitForFunction(
    () => __mstest.W !== 568 || /came out blank/.test(document.body.innerText),
    null,
    { timeout: 40000 },
  );
  await free(page);
  assert.doesNotMatch(await page.evaluate(() => document.body.innerText), /came out blank/);
  assert.notEqual(await page.evaluate(() => __mstest.W), 568, 'the PDF’s page, not the sample');
  assert.ok((await page.evaluate(() => __mstest.comps.length)) > 3, 'its rings found');
  assert.deepEqual(errors, []);
});

// Focus mode on the sample, Done through to the next three hand-offs: for each, how many of the next marker's
// uncoloured sections have their label point under the card, and whether the card says they're "shown on the picture"
async function handOffs(page) {
  await sampleGuide(page);
  await page.click('#sfColor');
  await idle(page);
  await page.click('#sfFocus');
  await idle(page);
  const res = [];
  for (let i = 0; i < 80 && res.length < 3; i++) {
    await page.click('#sfFDone');
    await idle(page);
    if (!(await page.evaluate(() => !document.getElementById('sfHand').hidden))) continue;
    await pause(page, 400, 'the card’s entrance and the picture’s move to the sections');
    res.push(
      await page.evaluate(() => {
        const t = __mstest,
          c = document.getElementById('sfCanvas').getBoundingClientRect(),
          cv = document.getElementById('sfCanvas'),
          k = document.querySelector('#sfHand .sfhcard').getBoundingClientRect();
        let n = 0,
          under = 0;
        for (const l of t.assignData.order) {
          if (t.assignData.assign[l].mkey !== t.hlKey || t.colored[l]) continue;
          n++;
          const q = t.labelPos(l),
            x = c.left + (q.x / cv.width) * c.width,
            y = c.top + (q.y / cv.height) * c.height;
          if (x >= k.left && x <= k.right && y >= k.top && y <= k.bottom) under++;
        }
        return {
          n,
          under,
          shown: /shown on the picture/.test(document.querySelector('#sfHand .sfhsub').innerText),
        };
      }),
    );
    await page.click('#sfFDone');
    await idle(page);
  }
  return res;
}
test('X3 E1: the hand-off card on a small phone with large text leaves the next marker’s sections in sight', async () => {
  for (const [w, h] of [
    [375, 667],
    [320, 568],
  ]) {
    const { page, errors, ctx } = await openAtScale(1.6, { width: w, height: h });
    const r = await handOffs(page);
    assert.equal(r.length, 3);
    for (const x of r) {
      assert.equal(x.under, 0, `${w}×${h}: ${x.under} of ${x.n} under the card`);
      // (the short card, which doesn't say so: it's only the full card that is sure to leave them all in sight)
      assert.equal(x.shown, false);
    }
    assert.deepEqual(errors, []);
    await ctx.close();
  }
  // a phone with room: the full card, as before
  const { page, errors } = await openApp({ width: 390, height: 844 });
  for (const x of await handOffs(page)) assert.deepEqual([x.under, x.shown], [0, true]);
  assert.equal(
    await page.evaluate(() => document.getElementById('sfHand').classList.contains('sfhtight')),
    false,
  );
  assert.deepEqual(errors, []);
});

test('X3 E2: finishing the page again after a tick taken back says so again', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await page.click('#sfColor');
  await idle(page);
  const last = await page.evaluate(() => {
    const t = __mstest,
      o = t.assignData.order;
    for (const l of o) t.colored[l] = 1;
    t.colored[o[o.length - 1]] = 0;
    window.__fin = 0;
    new MutationObserver((ms) =>
      ms.forEach((m) =>
        m.addedNodes.forEach((n) => n.classList && n.classList.contains('sfconfetti') && __fin++),
      ),
    ).observe(document.body, { childList: true });
    t.renderGuide();
    return o[o.length - 1];
  });
  const tap = async () => {
    const p = await sectionPoint(page, last);
    await page.mouse.click(p.x, p.y);
    await idle(page);
    await pause(page, 450, 'the next tap on the same section is not a double tap');
  };
  await tap();
  assert.equal(await page.evaluate(() => __fin), 1, 'finished');
  await tap();
  assert.equal(await page.evaluate((l) => __mstest.colored[l], last), 0, 'taken back');
  await tap();
  assert.equal(await page.evaluate(() => __fin), 2, 'finished again, celebrated and said again');
  assert.deepEqual(errors, []);
});

test('X3 G1: Pages changed while the PDF is written: the file is named for what was written', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await page.click('.sftabbtn[data-t="share"]');
  await page.click('#sfPrint');
  await page.waitForSelector('#sfSheet.sfprsh');
  await page.click('[data-pwhat="page"]');
  await idle(page);
  let dl = page.waitForEvent('download', { timeout: 60000 });
  await page.click('#sfPDF');
  await page.click('[data-pwhat="strip"]');
  assert.equal((await dl).suggestedFilename(), 'sample-jellyfish.pdf');
  await page.waitForFunction(() => !document.getElementById('sfPDF').disabled);
  dl = page.waitForEvent('download', { timeout: 60000 });
  await page.click('#sfPDF');
  await page.click('[data-pwhat="ref"]');
  assert.equal((await dl).suggestedFilename(), 'sample-jellyfish-test-strip.pdf');
  assert.deepEqual(errors, []);
});

const ONB = { 'ms-onboarded': '1', 'ms-setup-tip': '1', 'ms-beta-thanks': '1' };
test('X3 G2: an older copy of the app in another tab leaves the newer version seen as it is', async () => {
  const { page, errors } = await openApp({
    storage: { ...ONB, 'ms-first-use': String(Date.now()), 'ms-last-ver': 'v318.23' },
    init: () => {
      window.__MS_HELP_AUTO = true;
    },
  });
  await idle(page);
  // What's new shown, and closed: this version seen
  assert.equal(await page.isVisible('#whatsNew'), true);
  await page.click('#wnClose');
  await idle(page);
  // (this page standing in for the older one: a version newer than its own seen already)
  const v = await page.evaluate(() => {
    // (v319: a version can have no point, "v319": the next is then v319.1)
    const m = /^v(\d+)(?:\.(\d+))?/.exec(localStorage.getItem('ms-last-ver'));
    const newer = 'v' + m[1] + '.' + ((+m[2] || 0) + 1);
    localStorage.setItem('ms-last-ver', newer);
    window.renderWhatsNew(true);
    return [newer, localStorage.getItem('ms-last-ver')];
  });
  assert.equal(v[1], v[0]);
  assert.equal(await page.isVisible('#whatsNew'), false);
  assert.deepEqual(errors, []);
});

test('X3 G3: a tester task answered in another tab shows on Home’s card and foot line here', async () => {
  const KEYS = ['add', 'guide', 'plan', 'along', 'back', 'share'];
  const tester = (n) => {
    const t = {};
    KEYS.slice(0, n).forEach((k) => (t[k] = { r: 'easy', n: '', v: 'v318' }));
    return JSON.stringify({ id: 'TABC123', name: '', t, q: {}, sends: 0, sig: '' });
  };
  const { page, ctx, errors } = await openApp({ storage: { ...ONB, 'ms-tester': tester(2) } });
  await idle(page);
  const card = () =>
    page.evaluate(() => [
      document.getElementById('homeTaskCard').innerText.replace(/\s+/g, ' ').trim(),
      document.getElementById('homeTasks').textContent,
    ]);
  assert.match((await card())[0], /^2\/6 /);
  const b = await ctx.newPage();
  await b.goto(page.url());
  await b.evaluate((v) => localStorage.setItem('ms-tester', v), tester(3));
  await page.waitForFunction(() => /3 of 6/.test(document.getElementById('homeTasks').textContent));
  assert.deepEqual(await card(), [
    '3/6 Beta tester tasks Next to answer: 4 · Colour along ›',
    'Tester tasks · 3 of 6',
  ]);
  assert.deepEqual(errors, []);
});
