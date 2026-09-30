// The app must stay installable: manifest + icons exist, match their declared sizes,
// and the service worker precaches them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const root = new URL('../', import.meta.url);
const read = (f) => readFileSync(new URL(f, root));

test('manifest is valid and its icons exist at the declared sizes', () => {
  const m = JSON.parse(read('manifest.webmanifest'));
  assert.equal(m.display, 'standalone');
  assert.ok(m.start_url && m.name);
  const sizes = new Set();
  for (const ic of m.icons) {
    const png = read(ic.src);
    assert.equal(png.toString('ascii', 1, 4), 'PNG', ic.src);
    const w = png.readUInt32BE(16), h = png.readUInt32BE(20);
    assert.equal(`${w}x${h}`, ic.sizes, ic.src);
    sizes.add(ic.sizes);
  }
  assert.ok(sizes.has('192x192') && sizes.has('512x512'), 'Chrome needs 192 and 512');
  assert.ok(m.icons.some((i) => i.purpose === 'maskable'), 'a maskable icon for Android');
});

test('index.html links the manifest and the service worker precaches it', () => {
  const html = read('index.html').toString();
  assert.match(html, /<link rel="manifest" href="manifest\.webmanifest">/);
  const sw = read('service-worker.js').toString();
  assert.match(html, /<link rel="apple-touch-icon" href="apple-touch-icon.png">/);
  for (const f of ['manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png']) assert.ok(sw.includes(f), f);
});

test('the version shown on Home matches the service-worker cache version', () => {
  const html = read('index.html').toString();
  const shown = html.match(/id="appVer"[^>]*>(v\d+)</)[1];
  const cache = read('service-worker.js').toString().match(/marker-studio-(v\d+)/)[1];
  assert.equal(shown, cache, 'bump both together on each release');
});
