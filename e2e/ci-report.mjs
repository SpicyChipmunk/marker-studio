// A test reporter for CI: writes one JSON line per finished test (pass, fail, skip) to the file named by E2E_REPORT as
// soon as node reports it, so the record survives a run that is stopped part-way. e2e/ci-summary.mjs turns it into
// the run's summary. (Node reports a test's start together with its end, so a hung test shows up only through
// --test-timeout, or as a file with no results.)
// Use alongside the normal reporter:
//   node --test --test-reporter=spec --test-reporter-destination=stdout \
//     --test-reporter=./e2e/ci-report.mjs --test-reporter-destination=stdout e2e/*.test.mjs
import { appendFileSync } from 'node:fs';
import { relative } from 'node:path';

const OUT = process.env.E2E_REPORT;
const where = (d) => (d.file ? relative(process.cwd(), d.file) : '');
const why = (e) => {
  const x = (e && e.cause) || e;
  if (!x) return '';
  return String((x && x.message) || x).slice(0, 600);
};

export default async function* ciReport(source) {
  for await (const ev of source) {
    if (!OUT) continue;
    const d = ev.data || {};
    let rec = null;
    if (ev.type === 'test:pass' || ev.type === 'test:fail') {
      const det = d.details || {};
      rec = { ev: ev.type === 'test:pass' ? (d.skip !== undefined ? 'skip' : 'pass') : 'fail', file: where(d), name: d.name, nesting: d.nesting, ms: Math.round(det.duration_ms || 0), t: Date.now() };
      if (ev.type === 'test:fail') rec.error = why(det.error);
    }
    if (rec) appendFileSync(OUT, JSON.stringify(rec) + '\n');
  }
  yield '';
}
