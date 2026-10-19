// v318.21 Scan, in the browser: a code misread by one character and put right by the whole name read beside it is
// listed with "read as “5110”" on its row, kept through a reload of the list. Fails on v318.20.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, idle, scanFromMarkers } from './helpers.mjs';

before(setup);
after(teardown);

const KEY = 'ohuhu-hb320-picker-v3';
const stored = {
  'ms-onboarded': '1',
  'ms-setup-tip': '1',
  'ms-last-ver': 'v318',
  'ms-scan-brand': '',
  [KEY]: JSON.stringify({
    mode: 'collection',
    ownedSeedV: 2,
    copicAdd1: 1,
    libAdj1: 1,
    setFix1: 1,
    owned: ['Ohuhu|R014'],
    saved: [],
  }),
};
// a photo's reading made up (nothing of anyone's): a tray of older Ohuhu caps, and "5110" with "Dark Suntan" under it
function read(page) {
  return page.evaluate(() => {
    scanList = [];
    ocrAnswered = [];
    ocrPhotos = 0;
    scanBrand = '';
    const r = {
      n: ++ocrPhotos,
      items: new Map(),
      taken: new Set(),
      brands: {},
      sure: 0,
      p: null,
      done: false,
      note: '',
    };
    ocrRun = r;
    const caps = [
      'YR170',
      'RP6',
      'BR3',
      'YR030',
      'G420',
      'CG050',
      'NG03',
      'PB1',
      'Y7',
      'R10',
      'YR2',
      'R6',
      '5110',
    ];
    const lines = [];
    let id = 0;
    caps.forEach((t, k) => {
      const me = ++id,
        x = 300 * (k % 6),
        y = 400 * Math.floor(k / 6);
      lines.push({ id: me, look: 1, text: t, conf: 0.97, unsure: false, nameOf: 0, box: [x, y, 60, 30, 0] });
      if (t === '5110')
        lines.push({
          id: ++id,
          look: 1,
          text: 'Dark Suntan',
          conf: 0.97,
          unsure: false,
          nameOf: me,
          box: [x, y + 30, 80, 20, 0],
        });
    });
    lines.forEach((it) => ocrLine(r, it));
    ocrDone(r, { lines: lines, stat: {}, ms: 1, aborted: false });
    clearTimeout(r.soon);
    ocrRun = null;
    scanSaveList();
    scanRender();
  });
}
const row = (page) =>
  page.$$eval(
    '#scList li',
    (ls) => ls.map((l) => l.textContent.replace(/\s+/g, ' ').trim()).find((t) => /YR312/.test(t)) || '',
  );

test('a code put right by its name: listed, "read as" on its row, kept through a reload', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, storage: stored });
  await idle(page);
  await scanFromMarkers(page);
  await idle(page);
  await read(page);
  await idle(page);
  assert.match(await row(page), /read as “5110”/);
  await page.reload();
  await idle(page);
  await scanFromMarkers(page);
  await idle(page);
  assert.match(await row(page), /read as “5110”/, 'after a reload');
  assert.deepEqual(errors, []);
});
