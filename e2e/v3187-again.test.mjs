// v318.7: a tray photographed again, to see that nothing was missed, says what it read that's in the list already and
// draws those caps as read, not as to check; a cap read unsure stays to check (amber) even when its code is listed.
// The reader's lines are made up here, as v3184-flow's; the boxes' colours are read off the canvas. Fails on v318.6.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, idle } from './helpers.mjs';

before(setup);
after(teardown);

const NOW = ['B015', 'B03', 'B08', 'B09', 'B111', 'B112', 'B114', 'B115'];
// (and two codes both brands have, settled as Ohuhu's at the photo's end once its caps plainly show the brand)
const middle = NOW.concat(['B04', 'Y06']).map((t, k) => [t, [200 + k * 200, 760, 110, 44, 0]]);
// a photo W×H read: lines [text, box, unsure]; the list's markers, the photo's tally, what it found listed, and the
// boxes' colours as drawn
function photo(page, { lines, n = 1, pre = null }) {
  return page.evaluate(
    ([lines, n, pre]) => {
      const W = 2048,
        H = 1536,
        cv = document.createElement('canvas');
      cv.width = W;
      cv.height = H;
      const g = cv.getContext('2d');
      g.fillStyle = '#ccc';
      g.fillRect(0, 0, W, H);
      if (n === 1) {
        scanList = [];
        ocrAnswered = [];
      }
      if (pre) pre.forEach((k) => scanList.push({ i: keyIdx(k), how: '' }));
      scanBrand = '';
      const r = {
        n,
        items: new Map(),
        taken: new Set(),
        brands: {},
        sure: 0,
        p: null,
        done: false,
        note: '',
      };
      r.img = { w: W, h: H, data: g.getImageData(0, 0, W, H) };
      ocrRun = r;
      const all = lines.map(([t, box, unsure], k) => ({
        id: k + 1,
        look: 1,
        text: t,
        conf: unsure ? 0.6 : 0.98,
        unsure: !!unsure,
        nameOf: 0,
        box,
        alts: [[t, 0.98, 0]],
      }));
      all.forEach((it) => ocrLine(r, it));
      ocrDone(r, { lines: all, stat: {}, ms: 1, aborted: false });
      clearTimeout(r.soon);
      // (drawn as the view draws it: a 600 px wide picture)
      const show = document.createElement('canvas');
      show.width = 600;
      show.height = 450;
      r.img.show = show;
      r.cv = document.createElement('canvas');
      ocrDraw(r);
      const x = r.cv.getContext('2d'),
        colour = (cx, cy) => {
          // (the box's left edge, where its stroke is)
          const k = 600 / W,
            d = x.getImageData(Math.round((cx - 55) * k), Math.round(cy * k), 1, 1).data;
          return d[3] === 0 ? 'none' : d[1] > 180 && d[0] < 120 ? 'green' : d[0] > 200 && d[2] < 120 ? 'amber' : 'other';
        };
      return {
        list: scanList.filter((e) => !e.ask).map((e) => mkey(e.i)),
        asks: scanList.filter((e) => e.ask).map((e) => e.title),
        added: r.added,
        same: r.same,
        listed: [...(r.listed || [])].map((i) => mkey(i)).sort(),
        boxes: lines.map(([t, box]) => colour(box[0], box[1])),
      };
    },
    [lines, n, pre],
  );
}

test('a tray photographed again: its caps are said to be in the list already, and drawn as read', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await page.evaluate(() => openScan());
  await idle(page);
  const a = await photo(page, { lines: middle });
  assert.equal(a.list.length, 10);
  assert.deepEqual([a.added, a.same], [10, 0]);
  assert.ok(
    a.boxes.every((c) => c === 'green'),
    a.boxes.join(' '),
  );
  const b = await photo(page, { lines: middle, n: 2 });
  assert.equal(b.list.length, 10, 'listed once');
  // (B04 and Y06, settled at the end, had been amber, to check, with no question in the list)
  assert.ok(
    b.boxes.every((c) => c === 'green'),
    'read already, not to check: ' + b.boxes.join(' '),
  );
  assert.deepEqual([b.added, b.same], [0, 10]);
  assert.equal(b.listed.length, 10);
  await page.evaluate(() => ocrFinish());
  await idle(page);
  assert.match(await page.textContent('#scStat'), /From the photo: nothing new10 already in the list/);
  assert.deepEqual(errors, []);
});

test('a cap read unsure whose code is in the list stays to check, amber and not counted; a sure cap listed from a sweep is read', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await page.evaluate(() => openScan());
  await idle(page);
  // the list from a sweep: the whole tray and B05 (a B06 cap, read unsure as "B05", is not that B05)
  const pre = NOW.concat(['B04', 'Y06', 'B05']).map((c) => 'Ohuhu|' + c);
  const lines = middle.concat([['B05', [400, 1100, 110, 44, 0], true]]);
  const a = await photo(page, { lines, pre });
  assert.equal(a.list.length, 11, a.list.join(' '));
  assert.deepEqual([a.added, a.same], [0, 10]);
  assert.ok(!a.listed.includes('Ohuhu|B05'), a.listed.join(' '));
  assert.deepEqual(a.boxes.slice(0, 10).filter((c) => c !== 'green'), [], a.boxes.join(' '));
  assert.equal(a.boxes[10], 'amber', 'the unsure B05: ' + a.boxes.join(' '));
  assert.deepEqual(errors, []);
});
