// Runs the browser tests that failed once more, for the WebKit job: GitHub's WebKit now and then misses a frame or a
// scroll event under load, so a test can fail there once and pass the next time. Reads the record written by
// e2e/ci-report.mjs, reruns each failed test by its exact name (and whole test files that gave no results, or failed
// outside any test), and writes their results to a second record. e2e/ci-summary.mjs then counts a test that failed
// and passed on its retry as flaky (a warning), and one that failed both times as a failure.
// Usage: node e2e/ci-retry.mjs <record> <retry record> [<part>/<parts>] ; exits 1 when anything still fails.
import { readFileSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { partFiles } from './ci-parts.mjs';

const [file, out, part] = process.argv.slice(2);
// no record at all: the tests never started (an earlier step failed, which the run already shows)
if (!existsSync(file)) {
  console.log('No test results to retry from.');
  process.exit(1);
}
const recs = existsSync(file) ? readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) : [];
let expected = readdirSync('e2e').filter((f) => f.endsWith('.test.mjs')).sort().map((f) => 'e2e/' + f);
// (a part's files as e2e/ci-parts.mjs shares them out, for the browser in E2E_BROWSER)
if (part) { const [i, n] = part.split('/').map(Number); expected = partFiles(process.env.E2E_BROWSER || 'chromium', i, n); }
const seen = new Set(recs.map((r) => r.file));

// what to run again: failed tests by name; whole files with no results or a failure outside any test
const byName = new Map(), whole = new Set(expected.filter((f) => !seen.has(f)));
for (const r of recs) {
  if (r.ev !== 'fail') continue;
  if (r.name === r.file) whole.add(r.file);
  else if (r.nesting === 0) {
    if (!byName.has(r.file)) byName.set(r.file, new Set());
    byName.get(r.file).add(r.name);
  }
}
for (const f of whole) byName.delete(f);
if (!byName.size && !whole.size) {
  console.log('Nothing to retry.');
  process.exit(0);
}
if (existsSync(out)) rmSync(out);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const node = (args) => spawnSync(process.execPath, ['--test', '--test-concurrency=1', '--test-timeout=720000', '--test-reporter=spec', '--test-reporter-destination=stdout', '--test-reporter=./e2e/ci-report.mjs', '--test-reporter-destination=stdout', ...args], { stdio: 'inherit', env: { ...process.env, E2E_REPORT: out } });
for (const [f, names] of byName) {
  console.log(`Retrying ${names.size} in ${f}: ${[...names].join(' | ')}`);
  node([`--test-name-pattern=^(?:${[...names].map(esc).join('|')})$`, f]);
}
for (const f of whole) {
  console.log(`Retrying all of ${f}`);
  node([f]);
}

// still failing: a retried test that didn't pass, or a whole file with a failure or no results again
const again = existsSync(out) ? readFileSync(out, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) : [];
const passed = new Set(again.filter((r) => r.ev === 'pass').map((r) => r.file + '\u0000' + r.name));
let still = 0;
for (const [f, names] of byName) for (const n of names) if (!passed.has(f + '\u0000' + n)) still++;
for (const f of whole) if (!again.some((r) => r.file === f) || again.some((r) => r.file === f && r.ev === 'fail')) still++;
console.log(still ? `${still} still failing after the retry.` : 'Everything passed on the retry.');
process.exit(still ? 1 : 0);
