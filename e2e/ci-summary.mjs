// Turns the record written by e2e/ci-report.mjs into a Markdown summary and GitHub annotations for the first failures.
// Usage: node e2e/ci-summary.mjs <record file> "<title>" [<part>/<parts>] [<test folder, default e2e>]
// With E2E_RETRY naming the record of a retry (e2e/ci-retry.mjs), its results replace the first run's for the tests it
// ran again: a test that failed and then passed is flaky (listed, as a warning), one that failed again is a failure;
// a whole file it ran again (no results, or a failure outside any test) that then passed is a flaky file (v296).
// On GitHub the Markdown goes on the run's summary page ($GITHUB_STEP_SUMMARY); elsewhere it's printed.
// Test files with no results at all are listed: they were still running when the run was stopped (a test there hung,
// or the run ran out of time). With a part (2/3: e2e/ci-parts.mjs's files for it), only that part's files are expected.
import { readFileSync, existsSync, appendFileSync, readdirSync } from 'node:fs';
import { partFiles } from './ci-parts.mjs';

const [file, title = 'Browser tests', part, dir = 'e2e'] = process.argv.slice(2);
// no record at all: the tests never started (an earlier step failed), which the run already shows
if (!file || !existsSync(file)) {
  const msg = `## ${title}\n\nNot run: an earlier step failed.\n`;
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, msg);
  else console.log(msg);
  if (process.env.GITHUB_ACTIONS) console.log(`::notice title=${title.replace(/[:,]/g, ' ')}::Not run: an earlier step failed`);
  process.exit(0);
}
const lines = file && existsSync(file) ? readFileSync(file, 'utf8').split('\n').filter(Boolean) : [];
let recs = lines.map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
const rf = process.env.E2E_RETRY;
const again = rf && existsSync(rf) ? readFileSync(rf, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) : [];
let flaky = [], flakyFiles = [];
// (whole files the retry ran again: no results the first time, or a failure outside any test; with everything in
// them passing the second time, they're flaky too, as files)
const firstFiles = new Set(recs.map((r) => r.file)), firstFileFail = new Map(recs.filter((r) => r.ev === 'fail' && r.name === r.file).map((r) => [r.file, r.error]));
if (again.length) {
  const k = (r) => r.file + '\u0000' + r.name, re = new Map(again.map((r) => [k(r), r])), reFiles = new Set(again.map((r) => r.file));
  flaky = recs.filter((r) => r.ev === 'fail' && r.name !== r.file && re.has(k(r)) && re.get(k(r)).ev === 'pass');
  recs = [...recs.filter((r) => !re.has(k(r)) && !(r.name === r.file && r.ev === 'fail' && reFiles.has(r.file))), ...again];
  for (const f of reFiles) {
    if (firstFiles.has(f) && !firstFileFail.has(f)) continue;
    if (again.some((r) => r.file === f && r.ev === 'fail')) continue;
    flakyFiles.push({ file: f, why: firstFileFail.has(f) ? 'failed outside any test (' + String(firstFileFail.get(f) || '').slice(0, 200) + ')' : 'gave no results (stopped, or over the time limit for a file)' });
  }
}

// the files this part runs, as e2e/ci-parts.mjs shares them out (for the browser in E2E_BROWSER)
let expected = readdirSync(dir).filter((f) => f.endsWith('.test.mjs')).sort().map((f) => dir + '/' + f);
if (part && part !== 'all') { const [i, n] = part.split('/').map(Number); expected = partFiles(process.env.E2E_BROWSER || 'chromium', i, n, dir); }
const seen = new Set(recs.map((r) => r.file));
const missing = expected.filter((f) => !seen.has(f));

// a file-level entry (named by its path) only matters when the file failed outside any test
const tests = recs.filter((r) => r.nesting === 0 && r.name !== r.file);
const count = (ev) => tests.filter((r) => r.ev === ev).length;
const fails = recs.filter((r) => r.ev === 'fail' && (r.name !== r.file || !recs.some((x) => x.ev === 'fail' && x.file === r.file && x.name !== r.name)));
const cell = (s) => String(s || '').replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ').slice(0, 300);
const secs = (ms) => (ms / 1000).toFixed(1) + ' s';

const out = [`## ${title}`, ''];
out.push(`**${count('pass')} passed · ${count('fail')} failed · ${count('skip')} skipped${flaky.length ? ` · ${flaky.length} flaky (passed on a retry)` : ''}${flakyFiles.length ? ` · ${flakyFiles.length} flaky file${flakyFiles.length > 1 ? 's' : ''}` : ''}** · ${expected.length - missing.length} of ${expected.length} files finished`, '');
if (fails.length) {
  out.push('### Failed', '', '| File | Test | Time | Error |', '|---|---|---|---|');
  for (const r of fails) out.push(`| ${cell(r.file)} | ${cell(r.name)} | ${secs(r.ms)} | ${cell(r.error)} |`);
  out.push('');
}
if (flaky.length) {
  out.push('### Flaky: failed, then passed on a retry', '', '| File | Test | First error |', '|---|---|---|');
  for (const r of flaky) out.push(`| ${cell(r.file)} | ${cell(r.name)} | ${cell(r.error)} |`);
  out.push('');
}
if (flakyFiles.length) {
  out.push('### Flaky files: run again whole, then passed', '', '| File | The first time |', '|---|---|');
  for (const x of flakyFiles) out.push(`| ${cell(x.file)} | ${cell(x.why)} |`);
  out.push('');
}
if (missing.length) {
  out.push('### Files with no results', '', 'Still running when the run was stopped: a test there hung, or the run ran out of time.', '');
  for (const f of missing) out.push(`- ${f}`);
  out.push('');
}
const slow = tests.filter((r) => r.ev !== 'skip').sort((a, b) => b.ms - a.ms).slice(0, 12);
if (slow.length) {
  out.push('### Slowest', '', '| File | Test | Time |', '|---|---|---|');
  for (const r of slow) out.push(`| ${cell(r.file)} | ${cell(r.name)} | ${secs(r.ms)} |`);
  out.push('');
}
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, out.join('\n') + '\n');
else console.log(out.join('\n'));

// Annotations show on the run's page even to visitors who aren't signed in (the summary above doesn't). GitHub shows up
// to 10 of each kind per step, so: the counts and slowest files as notices, then one annotation per failing test (or
// file with no results), as errors while they last, then warnings, then notices; flaky tests as warnings or notices,
// never errors; and a last notice saying how many more there are. One line each, so they can be read as they are.
if (process.env.GITHUB_ACTIONS) {
  const esc = (s) => String(s || '').replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
  const prop = (s) => esc(s).replace(/:/g, '%3A').replace(/,/g, '%2C');
  const line = (s) => String(s || '').replace(/\s*\n\s*/g, ' ').slice(0, 300);
  console.log(`::notice title=${prop(title)}::${esc(`${count('pass')} passed, ${count('fail')} failed, ${count('skip')} skipped${flaky.length ? `, ${flaky.length} flaky (passed on a retry)` : ''}${flakyFiles.length ? `, ${flakyFiles.length} flaky file${flakyFiles.length > 1 ? 's' : ''}` : ''}; ${expected.length - missing.length} of ${expected.length} files finished`)}`);
  const per = new Map();
  for (const r of tests) per.set(r.file, (per.get(r.file) || 0) + r.ms);
  // (v303: every file's time, slowest first, not just the 8 slowest: e2e/ci-durations.json is refreshed from these, and
  // a part's other files had been guesses, which left one WebKit part 9 minutes longer than the rest)
  const slowF = [...per.entries()].sort((a, b) => b[1] - a[1]).map(([f, ms]) => `${f.replace(/^.*\//, '')} ${secs(ms)}`);
  if (slowF.length) console.log(`::notice title=${prop(title + ': file times, slowest first')}::${esc(slowF.join(', '))}`);
  // failures first (as errors while they last), then flaky tests (never as errors)
  const left = { error: 10, warning: 10, notice: 8 };
  const emit = (kinds, f, head, msg) => {
    const kind = kinds.find((x) => left[x] > 0);
    if (!kind) return false;
    left[kind]--;
    console.log(`::${kind} file=${prop(f)},title=${prop(title + ': ' + head + f)}::${esc(msg)}`);
    return true;
  };
  let over = 0;
  for (const r of fails) if (!emit(['error', 'warning', 'notice'], r.file, '', r.name === r.file ? `(the file) ${line(r.error)}` : `${line(r.name)} [${secs(r.ms)}]: ${line(r.error)}`)) over++;
  for (const f of missing) if (!emit(['error', 'warning', 'notice'], f, '', 'no results: still running when the run was stopped')) over++;
  for (const r of flaky) if (!emit(['warning', 'notice'], r.file, 'flaky, ', `${line(r.name)}: failed once (${line(r.error)}), passed on a retry`)) over++;
  for (const x of flakyFiles) if (!emit(['warning', 'notice'], x.file, 'flaky file, ', `the whole file ${line(x.why)} the first time; all of it passed on a retry`)) over++;
  if (over) console.log(`::notice title=${prop(title + ': more')}::${esc(over + ' more: see the run summary')}`);
}
