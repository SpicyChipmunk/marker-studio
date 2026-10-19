// Replays recorded photo reads (record.mjs dumps: every line the OCR read, with its box and the name line it belongs
// to) through a build's end-of-photo reading — ocrLine for each line, then ocrDone — with no OCR and no browser. The
// parse layer only: Scan's reading, photo-read.js's settling, the questions. Fast (about a second a photo), so two
// builds can be compared on every recorded photo (compare.mjs).
//
//   node scripts/bench/reader/replay.mjs --out after.jsonl DUMP.jsonl [DUMP2.jsonl ...]
//   node scripts/bench/reader/replay.mjs --harness /path/to/other/test/harness.mjs --out before.jsonl DUMP.jsonl
//
// The harness loads the index.html beside its test/ folder: build first (npm run build). For "before", copy an older
// build's index.html and test/harness.mjs into a folder of their own and pass that harness.
// Writes one line per photo: {file, imgWH, list: ["Ohuhu|R213", ..., {ask, opts: [...]}, ...]}.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const opt = (k, d) => {
  const i = args.indexOf(k);
  return i < 0 ? d : args.splice(i, 2)[1];
};
const harness = opt('--harness', fileURLToPath(new URL('../../../test/harness.mjs', import.meta.url)));
const out = opt('--out', null);
if (!out || !args.length) {
  console.error('usage: replay.mjs [--harness H] --out OUT.jsonl DUMP.jsonl...');
  process.exit(2);
}
const { createApp } = await import(pathToFileURL(harness));
const res = [];
for (const f of args)
  for (const l of readFileSync(f, 'utf8').split('\n').filter(Boolean)) {
    const d = JSON.parse(l);
    const app = createApp();
    const o = JSON.parse(
      app.__eval(
        '(function () { scanList = []; scanBrand = ""; ocrPhotos = 1;' +
          'const r = { n: 1, items: new Map(), taken: new Set(), brands: {}, sure: 0, p: null, done: false, note: "",' +
          ' img: { w: ' +
          d.imgWH[0] +
          ', h: ' +
          d.imgWH[1] +
          ' } };' +
          'ocrRun = r; const lines = ' +
          JSON.stringify(d.lines || []) +
          ';' +
          'lines.forEach((it) => ocrLine(r, it));' +
          'ocrDone(r, { lines: lines, stat: {}, ms: 1, aborted: false }); clearTimeout(r.soon);' +
          'const k = (i) => COLORS[i].brand + "|" + COLORS[i].code;' +
          'return JSON.stringify({ list: scanList.filter((e) => !e.ask).map((e) => k(e.i)),' +
          ' how: scanList.filter((e) => !e.ask && e.how).map((e) => k(e.i) + " " + e.how),' +
          ' asks: scanList.filter((e) => e.ask).map((e) => ({ ask: e.title, opts: e.opts.map((o) => k(o.i)) })) }); })()',
      ),
    );
    res.push({ file: d.file, imgWH: d.imgWH, list: o.list.concat(o.asks), how: o.how });
  }
writeFileSync(out, res.map((x) => JSON.stringify(x)).join('\n') + '\n');
console.log(out + ': ' + res.length + ' photos');
