// v308 debug: specks of grain in the paper round a drawing are left out of what's printed and saved (outDebris), as
// on Ben's own page, where most of them (23-78 px) had been printed; the drawing's small details round it stay: a dot
// made with its pen, a small ring, a word, hatching and a dotted line. The page is drawn here in code.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, idle } from './helpers.mjs';

before(setup);
after(teardown);

// a 1200 x 1600 page: the drawing (8 px lines: a box in four sections, two dots for eyes in one), and round it on the
// paper the details (which stay) and the specks (which go), each with the box it lies in
const GEN = String.raw`
async function makePage() {
  const W = 1200, H = 1600, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
  g.strokeStyle = g.fillStyle = '#000'; g.lineCap = 'round';
  g.lineWidth = 8;
  g.strokeRect(320, 320, 560, 800);
  g.beginPath(); g.moveTo(600, 320); g.lineTo(600, 1120); g.moveTo(320, 720); g.lineTo(880, 720); g.stroke();
  for (const x of [430, 490]) { g.beginPath(); g.arc(x, 500, 6, 0, 6.283); g.fill(); }
  const keep = {}, go = {};
  // a dot made with the drawing's pen
  g.beginPath(); g.arc(180, 400, 5, 0, 6.283); g.fill(); keep.dot = [172, 392, 188, 408];
  // a small ring, drawn thin
  g.lineWidth = 2; g.beginPath(); g.arc(180, 600, 4.5, 0, 6.283); g.stroke(); keep.ring = [170, 590, 190, 610];
  // hatching: short thin strokes close together
  for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(980 + i * 7, 400); g.lineTo(1000 + i * 7, 430); g.stroke(); }
  keep.hatching = [975, 395, 1035, 435];
  // a dotted line
  for (let i = 0; i < 8; i++) { g.beginPath(); g.arc(150 + i * 11, 1300, 2.5, 0, 6.283); g.fill(); }
  keep.dots = [145, 1295, 235, 1305];
  // a word
  g.font = '15px sans-serif'; g.textBaseline = 'top'; g.fillText('Ben 26', 960, 1300); keep.word = [955, 1295, 1020, 1318];
  // the specks: short scratches as thin as grain, and small clumps
  g.lineWidth = 2;
  for (const [x, y, dx, dy] of [[180, 800, 10, 6], [1000, 800, -5, 11], [700, 1350, 12, 2], [180, 1000, 4, -12], [1000, 600, 8, 8]]) {
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + dx, y + dy); g.lineTo(x + dx + 4, y + dy - 3); g.stroke();
    go['scratch ' + x + ',' + y] = [x - 12, y - 18, x + 22, y + 18];
  }
  g.fillRect(500, 1400, 4, 4); go['clump 500,1400'] = [494, 1394, 510, 1410];
  g.fillRect(1020, 1050, 3, 3); g.fillRect(1023, 1053, 3, 3); go['clump 1020,1050'] = [1014, 1044, 1032, 1062];
  const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
  const b64 = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result.split(',')[1]); fr.readAsDataURL(blob); });
  return { b64, keep, go };
}`;

test('specks of grain on the paper are left out of what’s printed and saved; the drawing’s small details stay', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await page.check('#wcSets input[data-i="3"]');
  await page.click('#wcAdd');
  const pg = await page.evaluate(async (src) => {
    eval(src);
    return makePage();
  }, GEN);
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#wcPhoto')]);
  await fc.setFiles({ name: 'page.png', mimeType: 'image/png', buffer: Buffer.from(pg.b64, 'base64') });
  await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 40000 });
  await idle(page);
  // (Min section size up a little, to 48 px: the paper inside the ring and the letters isn't a section, so it's their
  // own shape that keeps them, not a section they touch)
  await page.$eval('#sfMin', (el) => {
    el.value = 60;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await idle(page);
  await page.click('#sfBuild');
  await page.waitForFunction(() => __mstest.assignData && __mstest.sfmode === 'guide', null, {
    timeout: 40000,
  });
  await idle(page);
  const r = await page.evaluate(
    ({ keep, go }) => {
      const t = __mstest,
        W = t.W,
        k = W / 1200,
        L = t.labels,
        m = t.outDebris(),
        // Save image as saved (without its codes): the picture at its top left, xs to a picture pixel
        ex = t.buildExportCanvas(false, true),
        xs = ex.width / W,
        px = ex.getContext('2d').getImageData(0, 0, ex.width, ex.height).data;
      // for each box: its ink, how much of that is left out, how much is dark on the saved image, and whether the
      // paper round it is coloured
      const look = (b) => {
        let ink = 0,
          out = 0,
          dark = 0,
          col = 0;
        for (let y = Math.round(b[1] * k); y <= Math.round(b[3] * k); y++)
          for (let x = Math.round(b[0] * k); x <= Math.round(b[2] * k); x++) {
            const p = y * W + x;
            if (L[p] > 0 && t.assignData.assign[L[p]]) col++;
            if (L[p] !== -1) continue;
            ink++;
            if (m && m[p]) out++;
            const j = (Math.min(ex.height - 1, Math.round(y * xs)) * ex.width + Math.round(x * xs)) * 4;
            if (px[j] + px[j + 1] + px[j + 2] < 3 * 128) dark++;
          }
        return { ink, out, dark, col };
      };
      const res = { keep: {}, go: {} };
      for (const n in keep) res.keep[n] = look(keep[n]);
      for (const n in go) res.go[n] = look(go[n]);
      res.eyes = look([420, 490, 500, 510]);
      res.lines = look([590, 330, 610, 710]);
      res.sections = t.assignData.order.length;
      return res;
    },
    { keep: pg.keep, go: pg.go },
  );
  assert.ok(r.sections >= 4, 'the drawing’s sections: ' + r.sections);
  const wrong = [];
  for (const [n, v] of Object.entries(r.go))
    if (v.col || !v.ink || v.out !== v.ink || v.dark) wrong.push(n + ' (to go) ' + JSON.stringify(v));
  // (and inside the drawing: a line and the eyes)
  for (const [n, v] of Object.entries(Object.assign({ eyes: r.eyes, lines: r.lines }, r.keep)))
    if ((v.col && n in r.keep) || !v.ink || v.out || v.dark < v.ink * 0.9)
      wrong.push(n + ' (to stay) ' + JSON.stringify(v));
  assert.deepEqual(wrong, []);
  assert.deepEqual(errors, []);
});
