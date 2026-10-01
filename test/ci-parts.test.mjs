// e2e/ci-parts.mjs: every browser test file runs in exactly one CI part, and the parts take about as long.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { partFiles } from '../e2e/ci-parts.mjs';

const all = readdirSync(new URL('../e2e', import.meta.url))
  .filter((f) => f.endsWith('.test.mjs'))
  .sort()
  .map((f) => 'e2e/' + f);
const table = JSON.parse(readFileSync(new URL('../e2e/ci-durations.json', import.meta.url), 'utf8'));

for (const [engine, n] of [
  ['webkit', 6],
  ['chromium', 2],
]) {
  test(`${engine}: each test file in exactly one of ${n} parts, the parts within 25% of each other`, () => {
    const parts = Array.from({ length: n }, (_, i) => partFiles(engine, i + 1, n));
    assert.deepEqual(parts.flat().sort(), all);
    const secs = parts.map((p) => p.reduce((s, f) => s + (table[engine][f.slice(4)] ?? 30), 0));
    assert.ok(Math.max(...secs) <= Math.min(...secs) * 1.25, secs.join(', '));
    assert.deepEqual(partFiles(engine, 1, n), parts[0], 'the same files every time');
  });
}
