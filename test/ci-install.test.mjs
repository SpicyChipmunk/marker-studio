// The CI's browser installs: kept between runs, and a stalled install stopped and tried again (e2e/ci-try.sh), so
// one slow download can't run a part out of time (a WebKit part's install once took 38 minutes).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const root = new URL('../', import.meta.url);
const read = (f) => readFileSync(new URL(f, root), 'utf8');
const tryRun = (...a) => spawnSync('bash', ['e2e/ci-try.sh', ...a], { cwd: root, encoding: 'utf8' });

test('test.yml: each browser kept between runs on the Playwright version, each install tried up to 3 times', () => {
  const wf = read('.github/workflows/test.yml');
  assert.ok(!/--with-deps/.test(wf), 'no installs left without the retry');
  for (const b of ['chromium', 'webkit']) {
    assert.match(
      wf,
      new RegExp(
        String.raw`uses: actions/cache@v\d+\n\s+with:\n\s+path: ~/\.cache/ms-playwright\n\s+key: playwright-\$\{\{ runner\.os \}\}-24\.04-${b}-\$\{\{ steps\.pw\.outputs\.v \}\}`,
      ),
      b,
    );
    assert.ok(wf.includes(`run: bash e2e/ci-try.sh 3 300 npx playwright install ${b}\n`), b);
    assert.ok(wf.includes(`run: bash e2e/ci-try.sh 3 300 npx playwright install-deps ${b}\n`), b);
  }
  assert.equal(wf.match(/require\('playwright\/package\.json'\)\.version/g).length, 2);
});

test('ci-try.sh: a command that works runs once', () => {
  const r = tryRun('3', '5', 'bash', '-c', 'echo ran');
  assert.equal(r.status, 0);
  assert.equal(r.stdout.match(/ran/g).length, 1);
  assert.ok(!r.stdout.includes('::warning::'));
});

test('ci-try.sh: a stalled command is stopped at the limit and tried again; one that keeps failing fails', () => {
  const t = Date.now();
  const r = tryRun('2', '1', 'sleep', '30');
  assert.equal(r.status, 1);
  assert.ok(Date.now() - t < 10000, 'stopped, not waited out');
  assert.equal(r.stdout.match(/::warning::sleep 30 failed or took over 1s \(try \d of 2\)/g).length, 2);
});

test('ci-try.sh: a try that fails is followed by one that works', () => {
  const f = `/tmp/ci-try-${process.pid}`;
  const r = tryRun(
    '3',
    '5',
    'bash',
    '-c',
    `if [ -e ${f} ]; then rm ${f}; echo second; else touch ${f}; exit 1; fi`,
  );
  assert.equal(r.status, 0);
  assert.match(r.stdout, /try 1 of 3[\s\S]*second/);
});
