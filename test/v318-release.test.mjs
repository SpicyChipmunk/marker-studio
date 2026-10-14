// v318 review: the service worker's caches are named as the release and the page expect. An app cache not renamed with
// the version leaves every installed copy on the old page for good (the page comes from the cache first, and an
// unchanged service worker is never updated); a reader's cache named apart from the page's is deleted at every update.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (f) => readFileSync(new URL(f, root), 'utf8');
const sw = read('service-worker.js');

test('the app’s cache is named after the version Home shows', () => {
  const appVer = read('index.html').match(/id="appVer"[^>]*>(v\d+(?:\.\d+)?)</)[1];
  assert.equal(sw.match(/const CACHE='([^']+)'/)[1], 'marker-studio-' + appVer);
});

test('the photo reader’s cache, kept through updates, is the one the page stores it in', () => {
  const ver = read('src/js/photo-read.js').match(/OCR_VER = '([^']+)'/)[1];
  assert.equal(sw.match(/const OCRC='([^']+)'/)[1], 'marker-studio-ocr-' + ver);
  assert.ok(
    existsSync(new URL('vendor/ocr/' + ver + '/', root)),
    'its files are where the page fetches them',
  );
});

test('PDF.js’s cache is named after the version the app ships', () => {
  const v = sw.match(/const PDFJS='([^']+)'/)[1];
  assert.ok(existsSync(new URL('vendor/pdfjs/' + v + '/pdf.min.mjs', root)));
});
