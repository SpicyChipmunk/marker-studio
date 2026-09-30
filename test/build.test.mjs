// index.html is generated from src/ (npm run build). This keeps the two from drifting:
// if it fails, someone edited index.html directly or forgot to rebuild after editing src/.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from '../scripts/build.mjs';

test('index.html is up to date with src/ (run: npm run build)', () => {
  const built = build(), shipped = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(built === shipped, 'index.html differs from a fresh build of src/');
});
