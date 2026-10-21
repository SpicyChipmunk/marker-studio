// v318.30: Help's "More you can do" and "If something goes wrong" (and the README's), and the app icon.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const read = (f) => readFileSync(join(ROOT, f), 'utf8');
const dialogs = read('src/html/dialogs.html');
const sec = (id) => dialogs.match(new RegExp(`<details class="hlpsec" id="${id}">[\\s\\S]*?</details>`))[0];
// the app's own words, outside Help: every screen's HTML and script
const walk = (d) =>
  readdirSync(join(ROOT, d), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(d, e.name)) : /\.(js|html)$/.test(e.name) ? [join(d, e.name)] : [],
  );
const elsewhere = walk('src')
  .map((f) => {
    let t = read(f);
    if (f.endsWith('dialogs.html'))
      t = t.replace(
        /<div class="overlay" id="helpOverlay"[\s\S]*?<\/div><\/div>(?=<div class="overlay")/,
        '',
      );
    return t;
  })
  .join('\n')
  .replace(/&amp;/g, '&')
  .replace(/&nbsp;/g, ' ');

test('the new Help sections: after Adding markers by code, before the Glossary', () => {
  const ids = [...dialogs.matchAll(/<details class="hlpsec" id="(\w+)">/g)].map((m) => m[1]);
  assert.deepEqual(ids.slice(2, 6), ['helpScan', 'helpMore', 'helpTrouble', 'helpGloss']);
});

test('every button or place they name is a real one in the app (the label as it is on screen)', () => {
  for (const id of ['helpMore', 'helpTrouble']) {
    const names = [...sec(id).matchAll(/<b>([^<]+)<\/b>/g)]
      .map((m) => m[1].replace(/&amp;/g, '&').trim())
      // (the lines' own headings end in a full stop or are quoted)
      .filter((n) => !/[.”]$/.test(n));
    assert.ok(names.length >= 6, id + ': ' + names.length);
    for (const n of names) {
      // a path: each step on its own (Markers › Print a swatch chart)
      for (const step of n.split(' › ').map((x) => x.replace(/^← /, '').replace(/ \(↶\)$/, '')))
        assert.ok(elsewhere.includes(step), `${id}: “${step}” isn’t a label in the app`);
    }
  }
});

test('the README has both lists, and the colour line says where the colours come from (docs, Help)', () => {
  const r = read('README.md');
  assert.match(r, /## More you can do\n/);
  assert.match(r, /## If something goes wrong\n/);
  const t = read('docs/TESTERS.md').replace(/\s+/g, ' ');
  for (const s of [r.replace(/\s+/g, ' '), t, sec('helpBeta'), sec('helpTrouble')])
    assert.match(s, /Ohuhu(’|')s and Copic(’|')s own published colours/);
  assert.ok(!/six last questions/.test(t), 'five questions and a name');
});

test('the icon: a drop of sections drawn like a colouring page, one left white; the maskable one inside the safe circle', () => {
  const svg = read('src/assets/icon.svg'),
    mask = read('src/assets/icon-maskable.svg');
  assert.match(svg, /viewBox="0 0 1024 1024"/);
  assert.equal((svg.match(/fill="#ffffff"/g) || []).length >= 1, true, 'one section left white');
  assert.match(mask, /scale\(0\.\d+\)/);
});
