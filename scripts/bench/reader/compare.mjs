// Two replays (or recordings) of the same photos side by side: per photo, the markers only one of them listed and the
// questions only one asked. The check that a change to the reader moved only what it meant to.
//
//   node scripts/bench/reader/compare.mjs before.jsonl after.jsonl
import { readFileSync } from 'node:fs';

const [a, b] = process.argv.slice(2);
if (!a || !b) {
  console.error('usage: compare.mjs BEFORE.jsonl AFTER.jsonl');
  process.exit(2);
}
const load = (f) =>
  new Map(
    readFileSync(f, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l))
      .map((d) => [d.file.join(','), d]),
  );
const A = load(a),
  B = load(b);
const ask = (x) => x.ask + ' [' + x.opts.join(',') + ']';
let gained = 0,
  lost = 0,
  qa = 0,
  qb = 0,
  same = 0;
for (const [f, x] of A) {
  const y = B.get(f);
  if (!y) continue;
  const la = new Set(x.list.filter((e) => typeof e === 'string')),
    lb = new Set(y.list.filter((e) => typeof e === 'string'));
  const qA = x.list.filter((e) => typeof e !== 'string').map(ask),
    qB = y.list.filter((e) => typeof e !== 'string').map(ask);
  const plus = [...lb].filter((k) => !la.has(k)),
    minus = [...la].filter((k) => !lb.has(k)),
    qplus = qB.filter((q) => !qA.includes(q)),
    qminus = qA.filter((q) => !qB.includes(q));
  gained += plus.length;
  lost += minus.length;
  qa += qA.length;
  qb += qB.length;
  if (!plus.length && !minus.length && !qplus.length && !qminus.length) {
    same++;
    continue;
  }
  console.log(f + ':');
  if (plus.length) console.log('  + listed ' + plus.join(' '));
  if (minus.length) console.log('  - listed ' + minus.join(' '));
  qplus.forEach((q) => console.log('  + asked  ' + q));
  qminus.forEach((q) => console.log('  - asked  ' + q));
}
console.log(
  'photos ' +
    A.size +
    ', unchanged ' +
    same +
    ' | listed +' +
    gained +
    ' -' +
    lost +
    ' | questions ' +
    qa +
    ' → ' +
    qb,
);
