// e2e/ci-summary.mjs (v318.1): a test whose browser page crashed (noted by e2e/helpers.mjs in the CI record, with the
// free memory then) is said to be the browser's crash, not the test's, as a flaky test or as a failure; others as before.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = new URL('../', import.meta.url);
// (a folder of one test file, so it's the only one expected)
const dir = mkdtempSync(join(tmpdir(), 'ci-summary-e2e-'));
writeFileSync(join(dir, 'x.test.mjs'), '');
after(() => rmSync(dir, { recursive: true, force: true }));
const F = dir + '/x.test.mjs';
const lines = (rs) => rs.map((r) => JSON.stringify(r)).join('\n') + '\n';
const fail = (name) => ({
  ev: 'fail',
  file: F,
  name,
  nesting: 0,
  ms: 9000,
  error: 'page.evaluate: Target page, context or browser has been closed',
});
const pass = (name) => ({ ev: 'pass', file: F, name, nesting: 0, ms: 9000 });
const crash = (name) => ({ ev: 'crash', file: F, name, engine: 'webkit', free: 9876 });

function summary(first, retry) {
  const d = mkdtempSync(join(tmpdir(), 'ci-summary-'));
  try {
    writeFileSync(join(d, 'rec.jsonl'), lines(first));
    if (retry) writeFileSync(join(d, 'retry.jsonl'), lines(retry));
    const env = { ...process.env, GITHUB_ACTIONS: '1', E2E_RETRY: retry ? join(d, 'retry.jsonl') : '' };
    delete env.GITHUB_STEP_SUMMARY;
    const r = spawnSync(
      process.execPath,
      ['e2e/ci-summary.mjs', join(d, 'rec.jsonl'), 'WebKit', 'all', dir],
      { cwd: root, env, encoding: 'utf8' },
    );
    assert.equal(r.status, 0, r.stderr);
    return r.stdout;
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
}

test('a flaky test whose page crashed says so, with the free memory; a crash isn’t counted as a test', () => {
  const out = summary([pass('a'), crash('b'), fail('b'), fail('c')], [pass('b'), pass('c')]);
  const warn = out.split('\n').filter((l) => l.startsWith('::warning') && l.includes('flaky'));
  assert.equal(warn.length, 2);
  assert.match(
    warn.find((l) => l.includes('::b:')),
    /failed once \(the browser's page process crashed, not the test \(WebKit; 9876 MB free then\): page\.evaluate/,
  );
  assert.ok(!warn.find((l) => l.includes('::c:')).includes('crashed'), 'another flaky test as before');
  assert.match(out, /\*\*3 passed · 0 failed · 0 skipped · 2 flaky \(passed on a retry\)\*\*/);
});

test('a failure whose page crashed says so too', () => {
  const out = summary([crash('b'), fail('b')], [crash('b'), fail('b')]);
  assert.match(out, /x\.test\.mjs \| b \| 9\.0 s \| the browser's page process crashed, not the test/);
  assert.match(out, /\*\*0 passed · 1 failed/);
});
