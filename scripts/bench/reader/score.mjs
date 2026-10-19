// Scores replayed (or recorded) reads against what's really in the photos. Two kinds of truth:
//
//   --caps DIR    a folder of PHOTO.json files, each {caps: [{code, name, brand?}, ...]}: every legible cap transcribed
//                 as printed (old or current code). Per photo: caps listed right, asked right, wrong listings, questions.
//   --keys FILE   {T: {photo: ["Brand|CODE", ...]}, A: {photo: [...]}} the markers in each photo (A: also acceptable),
//                 with an optional split file (--split FILE: {TUNE: [...], HELD: [...]}) reported side by side.
//
//   node scripts/bench/reader/score.mjs RES.jsonl --caps "$READER_BENCH/lent/truth"
//   node scripts/bench/reader/score.mjs RES.jsonl --keys "$READER_BENCH/ben/truth.json" --split "$READER_BENCH/ben/split.json"
//
// Old codes are mapped to markers with the app's own data (src/data/markers.json).
import { readFileSync, readdirSync } from 'node:fs';

const args = process.argv.slice(2);
const opt = (k) => {
  const i = args.indexOf(k);
  return i < 0 ? null : args.splice(i, 2)[1];
};
const caps = opt('--caps'),
  keysF = opt('--keys'),
  splitF = opt('--split'),
  brand = opt('--brand') || 'Ohuhu',
  verbose = args.includes('-v');
const resF = args.filter((a) => a !== '-v')[0];
if (!resF || (!caps && !keysF)) {
  console.error('usage: score.mjs RES.jsonl (--caps DIR | --keys FILE [--split FILE]) [-v]');
  process.exit(2);
}
const M = JSON.parse(readFileSync(new URL('../../../src/data/markers.json', import.meta.url), 'utf8'));
const N = (s) =>
  String(s || '')
    .normalize('NFKC')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
const byCode = new Map(); // printed code → marker keys (a code as it is now, or an old one)
for (const m of M) {
  const put = (c) => {
    const k = m.brand + '|' + N(c);
    if (!byCode.has(k)) byCode.set(k, new Set());
    byCode.get(k).add(m.brand + '|' + m.code);
  };
  put(m.code);
  if (m.old && m.old !== m.code) put(m.old);
}
const res = readFileSync(resF, 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((l) => JSON.parse(l));
const T = { photos: 0, caps: 0, hit: 0, wrong: 0, asks: 0, askHit: 0, unknown: 0 };
const pct = (a, b) => ((100 * a) / Math.max(1, b)).toFixed(1) + '%';

if (caps) {
  for (const d of res) {
    const n = d.file[0].replace(/\.[a-z]+$/i, '');
    let tr;
    try {
      tr = JSON.parse(readFileSync(caps + '/' + n + '.json', 'utf8'));
    } catch (_) {
      continue;
    }
    const listed = new Set(d.list.filter((x) => typeof x === 'string'));
    const asks = d.list.filter((x) => typeof x !== 'string');
    // (the brand scored: --brand, Ohuhu by default; a cap of another brand, or of none the app knows, is left out)
    const mine = tr.caps.filter((c) => (c.brand || 'Ohuhu') === brand);
    const tk = mine.map((c) => byCode.get(brand + '|' + N(c.code)) || new Set());
    const all = new Set(tk.flatMap((s) => [...s]));
    const hit = tk.filter((s) => [...s].some((k) => listed.has(k))).length;
    const askHit = tk.filter(
      (s) => ![...s].some((k) => listed.has(k)) && asks.some((a) => a.opts.some((k) => s.has(k))),
    ).length;
    const wrong = [...listed].filter((k) => k.split('|')[0] === brand && !all.has(k));
    T.photos++;
    T.caps += tk.length;
    T.hit += hit;
    T.askHit += askHit;
    T.wrong += wrong.length;
    T.asks += asks.length;
    T.unknown += tk.filter((s) => !s.size).length;
    console.log(
      n +
        ': caps ' +
        tk.length +
        ' | listed right ' +
        hit +
        ' (' +
        pct(hit, tk.length) +
        ') | asked right ' +
        askHit +
        ' | wrong ' +
        wrong.length +
        (wrong.length ? ' ' + wrong.join(' ') : '') +
        ' | questions ' +
        asks.length,
    );
  }
  console.log(
    'TOTAL ' +
      T.photos +
      ' photos, ' +
      T.caps +
      ' caps (' +
      T.unknown +
      ' not in the app): listed ' +
      pct(T.hit, T.caps) +
      ', listed or asked ' +
      pct(T.hit + T.askHit, T.caps) +
      ', wrong ' +
      T.wrong +
      ', questions ' +
      T.asks,
  );
} else {
  const tr = JSON.parse(readFileSync(keysF, 'utf8'));
  const split = splitF ? JSON.parse(readFileSync(splitF, 'utf8')) : null;
  const side = (n) =>
    split ? (split.TUNE.includes(n) ? 'TUNE' : split.HELD.includes(n) ? 'HELD' : '?') : 'all';
  const nk = (k) => k.split('|')[0] + '|' + N(k.split('|')[1]);
  const agg = {};
  for (const d of res) {
    const n = d.file[0].replace(/\.[a-z]+$/i, '');
    if (!tr.T[n]) continue;
    const t = new Set(tr.T[n].map(nk)),
      a = new Set((tr.A[n] || []).map(nk));
    const L = new Set(d.list.filter((x) => typeof x === 'string').map(nk));
    const hit = [...L].filter((k) => t.has(k)).length,
      wrong = [...L].filter((k) => !t.has(k) && !a.has(k)),
      asks = d.list.filter((x) => typeof x !== 'string').length;
    const g = (agg[side(n)] = agg[side(n)] || { photos: 0, t: 0, hit: 0, wrong: 0, asks: 0 });
    g.photos++;
    g.t += t.size;
    g.hit += hit;
    g.wrong += wrong.length;
    g.asks += asks;
    if (verbose) console.log('  ' + n, t.size, hit, wrong.length, asks, wrong.join(' '));
  }
  for (const k of Object.keys(agg).sort()) {
    const g = agg[k];
    console.log(
      k +
        ': ' +
        g.photos +
        ' photos, found ' +
        g.hit +
        '/' +
        g.t +
        ' (' +
        pct(g.hit, g.t) +
        '), wrong ' +
        g.wrong +
        ', questions ' +
        g.asks,
    );
  }
}
