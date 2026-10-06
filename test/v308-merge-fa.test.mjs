// v308 merge (fixes pass A): What's new in version order; Help and the tester guide on other brands' markers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

test('What’s new is newest first: no item sits after an older version’s', () => {
  const src = read('src/js/help.js');
  const list = src.slice(
    src.indexOf('const WHATS_NEW = ['),
    src.indexOf('];', src.indexOf('const WHATS_NEW = [')),
  );
  const vs = [...list.matchAll(/\bv: '(v[\d.]+)'/g)].map((m) => m[1]);
  const num = (v) => {
    const m = /^v(\d+)(?:\.(\d+))?$/.exec(v);
    return +m[1] + (+m[2] || 0) / 1000;
  };
  assert.ok(vs.length > 20, String(vs.length));
  for (let i = 1; i < vs.length; i++) assert.ok(num(vs[i]) <= num(vs[i - 1]), `${vs[i]} after ${vs[i - 1]}`);
});

// (the app knows Ohuhu and Copic markers by brand and code; "Other markers with these codes work too", after the Copic
// line in Help, read as other brands, which the tester guide says aren't supported)
test('Help’s Beta tester guide and docs/TESTERS.md agree: other Ohuhu markers with these codes work, not other brands', () => {
  const html = read('index.html');
  const inApp = html.match(/<details class="hlpsec" id="helpBeta">[\s\S]*?<\/details>/)[0];
  const testers = read('docs/TESTERS.md').replace(/\s+/g, ' ');
  for (const t of [inApp, testers])
    assert.ok(t.includes('Other Ohuhu markers with these codes work too'), t.slice(0, 80));
  assert.ok(!/Other markers with these codes/.test(inApp), 'not "Other markers"');
  assert.ok(
    testers.includes('Other brands aren’t supported yet') ||
      testers.includes("Other brands aren't supported yet"),
  );
  // said with the Ohuhu ranges, before Copic's line
  assert.ok(inApp.indexOf('Other Ohuhu markers') < inApp.indexOf('Copic: all'), 'with Ohuhu');
});
