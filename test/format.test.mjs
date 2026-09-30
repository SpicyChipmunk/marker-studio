// The app's JS and CSS stay formatted with the pinned Prettier and the repo's .prettierrc/.prettierignore,
// the same check as `npm run format:check`. If it fails, run `npm run format` and commit the result.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';
import * as prettier from 'prettier';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const IGNORE = join(ROOT, '.prettierignore');
const walk = (dir, ext) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? walk(join(dir, d.name), ext) : d.name.endsWith(ext) ? [join(dir, d.name)] : [],
  );

test('src/js and src/css are formatted with Prettier (run: npm run format)', async () => {
  const files = [...walk(join(ROOT, 'src/js'), '.js'), ...walk(join(ROOT, 'src/css'), '.css')];
  assert.ok(files.length > 40, `expected the app's JS and CSS files, found ${files.length}`);
  const bad = [];
  let checked = 0;
  for (const file of files) {
    const info = await prettier.getFileInfo(file, { ignorePath: IGNORE });
    if (info.ignored) continue;
    const options = await prettier.resolveConfig(file, { editorconfig: true });
    if (!(await prettier.check(readFileSync(file, 'utf8'), { ...options, filepath: file }))) {
      bad.push(relative(ROOT, file));
    }
    checked++;
  }
  assert.equal(checked, files.length, 'no src/js or src/css file should be in .prettierignore');
  assert.deepEqual(bad, [], `not formatted (run: npm run format):\n  ${bad.join('\n  ')}`);
});
