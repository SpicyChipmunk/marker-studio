// v308: ticks made just before a reload are kept on a guide whose section map was encoded by another browser engine
// (a backup or guide file made in Chrome and opened in Safari, or the other way). Opening such a guide re-encoded its
// map, so the copy kept as the page went away fingerprinted a different map from the stored one and was thrown away
// at the next start (pt8-pc §4). The stored map now stays the one saved until the sections change.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
import { setup, teardown, openApp, welcome, sampleGuide, idle, saveGuide, until } from './helpers.mjs';

before(setup);
after(teardown);

// a PNG of these RGBA pixels written the way no browser writes one (no row filters, the strongest compression), so
// the same picture comes back as a different file: what another engine's encoder makes of it
const CRC = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
const crc32 = (buf) => {
  let c = -1;
  for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};
const chunk = (type, data) => {
  const t = Buffer.from(type, 'ascii'),
    len = Buffer.alloc(4),
    crc = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
};
function pngOf(rgba, w, h) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  return (
    'data:image/png;base64,' +
    Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk('IHDR', ihdr),
      chunk('IDAT', deflateSync(raw, { level: 9 })),
      chunk('IEND', Buffer.alloc(0)),
    ]).toString('base64')
  );
}

// the sample guide as a backup whose section map was encoded "elsewhere" (the same pixels, a different file)
async function foreignBackup() {
  const { page, ctx } = await openApp();
  await sampleGuide(page);
  await saveGuide(page);
  const g = await page.evaluate(async () => {
    const s = state.saved.find((x) => x.type === 'guide'),
      pl = await IDB.get('guide-' + s.id);
    const img = new Image();
    await new Promise((r) => {
      img.onload = r;
      img.src = pl.lmap;
    });
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0);
    const px = x.getImageData(0, 0, c.width, c.height).data;
    let bin = '';
    for (let i = 0; i < px.length; i += 0x8000)
      bin += String.fromCharCode.apply(null, px.subarray(i, i + 0x8000));
    return {
      meta: { id: s.id, name: s.name, W: s.W, H: s.H, keys: s.keys, n: s.n, ts: s.ts },
      pl,
      w: c.width,
      h: c.height,
      px: btoa(bin),
      owned: [...state.owned],
    };
  });
  await ctx.close();
  const lmap = pngOf(Buffer.from(g.px, 'base64'), g.w, g.h);
  assert.notEqual(lmap, g.pl.lmap, 'a different file for the same picture');
  const backup = {
    v: 3,
    type: 'ms-backup',
    ts: g.meta.ts,
    owned: g.owned,
    saved: [],
    guides: [{ ...g.meta, payload: { ...g.pl, lmap } }],
  };
  return { backup, lmap, id: g.meta.id };
}

async function restoreInto(page, backup) {
  await page.evaluate(() => openLibrary());
  await page.waitForSelector('#savedOverlay.on');
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#guidesRestore')]);
  await fc.setFiles({
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await until(page, () => state.saved.some((s) => s.type === 'guide'), null, 'the guide restored');
  await idle(page);
}

const stored = (page, id) =>
  page.evaluate(
    (id) => IDB.get('guide-' + id).then((p) => p && { prog: (p.prog || []).length, lmap: p.lmap }),
    id,
  );

test('ticks just before a reload are kept on a guide whose section map another engine encoded', async () => {
  const { backup, lmap, id } = await foreignBackup();
  const { page, errors } = await openApp();
  await welcome(page, 'look');
  await idle(page);
  await restoreInto(page, backup);
  await page.evaluate((id) => loadGuide({ id }), id);
  await until(
    page,
    (id) => __mstest.curId === id && __mstest.assignData && __mstest.sfmode === 'guide',
    id,
    'the restored guide open',
  );
  await idle(page);
  // five ticks, then the page goes at once
  await page.evaluate(() => {
    const t = __mstest;
    t.assignData.order.slice(0, 5).forEach((l) => {
      t.colored[l] = 1;
    });
    t.guideDirty = true;
    t.renderGuide();
  });
  await page.reload();
  await idle(page);
  const s = await stored(page, id);
  assert.equal(s.prog, 5, 'all five ticks kept');
  assert.equal(
    await page.evaluate((id) => state.saved.find((x) => x.id === id).done, id),
    5,
    'and the Library row says so',
  );
  assert.equal(s.lmap, lmap, 'the stored section map is still the one restored');
  assert.deepEqual(errors, []);
});

test('the stored section map stays byte-identical through a save, and a section edit still saves a new one', async () => {
  const { backup, lmap, id } = await foreignBackup();
  const { page, errors } = await openApp();
  await welcome(page, 'look');
  await idle(page);
  await restoreInto(page, backup);
  await page.evaluate((id) => loadGuide({ id }), id);
  await until(
    page,
    (id) => __mstest.curId === id && __mstest.assignData && __mstest.sfmode === 'guide',
    id,
    'the restored guide open',
  );
  await idle(page);
  await page.evaluate(() => {
    const t = __mstest;
    t.assignData.order.slice(0, 2).forEach((l) => {
      t.colored[l] = 1;
    });
    t.guideDirty = true;
    t.renderGuide();
  });
  await page.evaluate(() => __mstest.flushSave());
  await idle(page);
  const s = await stored(page, id);
  assert.equal(s.prog, 2);
  assert.equal(s.lmap, lmap, 'not encoded again');
  // the sections changed: the map saved is the new one
  const changed = await page.evaluate(() => {
    const t = __mstest,
      L = t.labels;
    for (let i = 0; i < L.length; i++)
      if (L[i] > 0) {
        const was = L[i];
        L[i] = -1;
        const u = t.lmapURL();
        L[i] = was;
        return u;
      }
    return '';
  });
  assert.ok(changed && changed !== lmap, 'a change to the sections is encoded afresh');
  assert.deepEqual(errors, []);
});
