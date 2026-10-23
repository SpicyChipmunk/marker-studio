// v318.35 (Stage 4.6, E1-8): the PDF's pages with the picture in colour (the key's reference, Key + reference's picture
// and its close-ups) are written as JPEG (DCTDecode, quality 0.9); the colouring page stays lossless (FlateDecode).
// Fails on v318.34, where every page was deflated RGB.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setup, teardown, openApp, sampleGuide, idle, saveArtifact } from './helpers.mjs';

before(setup);
after(teardown);

async function sharePrint(page) {
  await page.click('.sftabbtn[data-t="share"]');
  await page.click('#sfPrint');
  await page.waitForSelector('#sfSheet.sfprsh');
  await idle(page);
}
// the PDF's image objects, in page order: { filter, w, h, len, jpegDims: [w, h] from the JPEG's own SOF marker }
function images(bytes) {
  const s = bytes.toString('latin1'),
    out = [],
    re =
      /<< \/Type \/XObject \/Subtype \/Image \/Width (\d+) \/Height (\d+) \/ColorSpace \/DeviceRGB \/BitsPerComponent 8( \/Filter \/(\w+))? \/Length (\d+) >>\nstream\n/g;
  let m;
  while ((m = re.exec(s))) {
    const at = m.index + m[0].length,
      len = +m[5],
      data = bytes.subarray(at, at + len),
      im = { filter: m[4] || 'none', w: +m[1], h: +m[2], len: len };
    if (im.filter === 'DCTDecode') {
      assert.equal(data[0] * 256 + data[1], 0xffd8, 'a JPEG starts with SOI');
      assert.equal(data[len - 2] * 256 + data[len - 1], 0xffd9, 'and ends with EOI');
      // (the frame header: height then width, after the marker and its length and the precision byte)
      for (let i = 2; i < len - 9;) {
        if (data[i] !== 0xff) break;
        const mk = data[i + 1],
          L = data[i + 2] * 256 + data[i + 3];
        if (mk >= 0xc0 && mk <= 0xcf && mk !== 0xc4 && mk !== 0xc8 && mk !== 0xcc) {
          im.jpegDims = [data[i + 7] * 256 + data[i + 8], data[i + 5] * 256 + data[i + 6]];
          break;
        }
        i += 2 + L;
      }
    }
    out.push(im);
  }
  assert.equal(s.slice(0, 5), '%PDF-');
  assert.match(s.slice(-6), /%%EOF/);
  return out;
}
async function pdf(page, name) {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.click('#sfPDF')]);
  const bytes = await readFile(await dl.path());
  await saveArtifact(name + '.pdf', bytes);
  return { bytes: bytes.length, images: images(bytes) };
}

test('Page + key: the colouring page deflated, the key page with the reference a JPEG of the page’s size; Key + reference: its picture a JPEG', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await sharePrint(page);
  const pk = await pdf(page, 'v31835-page-key');
  assert.ok(pk.images.length >= 2, pk.images.length + ' pages');
  assert.equal(pk.images[0].filter, 'FlateDecode', 'the colouring page stays lossless');
  const key = pk.images[pk.images.length - 1];
  assert.equal(key.filter, 'DCTDecode', 'the key page (with the reference in colour) is a JPEG');
  assert.deepEqual(key.jpegDims, [key.w, key.h], 'the JPEG is the page’s size');
  assert.ok(key.len < 1.5e6, 'the key page under 1.5 MB: ' + key.len);
  // (its close-ups, when the picture is line art, stay lossless too)
  pk.images.slice(1, -1).forEach((im, i) => assert.equal(im.filter, 'FlateDecode', 'close-up ' + (i + 1)));
  // Key + reference with labels: page 1 is the picture in colour
  await page.click('[data-pwhat="ref"]');
  await idle(page);
  const ref = await pdf(page, 'v31835-reference');
  assert.equal(ref.images[0].filter, 'DCTDecode', 'the reference picture is a JPEG');
  assert.deepEqual(ref.images[0].jpegDims, [ref.images[0].w, ref.images[0].h]);
  assert.ok(
    ref.images.every((im) => im.filter === 'DCTDecode'),
    'every page of it is in colour: ' + ref.images.map((im) => im.filter),
  );
  // (the sizes, for the notes)
  console.log(
    'v31835 sizes: page+key ' +
      pk.bytes +
      ' B ' +
      JSON.stringify(pk.images.map((im) => [im.filter, im.len])) +
      '; reference ' +
      ref.bytes +
      ' B ' +
      JSON.stringify(ref.images.map((im) => [im.filter, im.len])),
  );
  assert.deepEqual(errors, []);
});
