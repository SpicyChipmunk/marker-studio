// Shares the browser test files out among the CI's parts so each part takes about as long (node's own --test-shard
// deals them out by name, which left one WebKit part twice as long as another). Uses e2e/ci-durations.json (seconds
// per file in each browser; a file not listed counts as a typical one): the longest files first, each to the part
// with the least so far. The same files come out for the same part every time, so the retry and the summary know
// what a part should have run.
// Usage: node e2e/ci-parts.mjs <chromium|webkit> <part> <parts>  (prints the part's files, one per line)
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));

export function partFiles(engine, part, parts, dir = 'e2e') {
  const files = readdirSync(join(HERE, '..', dir))
    .filter((f) => f.endsWith('.test.mjs'))
    .sort();
  let table = {};
  try {
    table = JSON.parse(readFileSync(join(HERE, 'ci-durations.json'), 'utf8'))[engine] || {};
  } catch {}
  const known = Object.values(table).sort((a, b) => a - b),
    typical = known.length ? known[Math.floor(known.length / 2)] : 1;
  const secs = (f) => (table[f] != null ? table[f] : typical);
  const load = new Array(parts).fill(0),
    of = new Array(parts).fill(null).map(() => []);
  files
    .slice()
    .sort((a, b) => secs(b) - secs(a) || (a < b ? -1 : 1))
    .forEach((f) => {
      let k = 0;
      for (let j = 1; j < parts; j++) if (load[j] < load[k]) k = j;
      load[k] += secs(f);
      of[k].push(f);
    });
  return of[part - 1].sort().map((f) => dir + '/' + f);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [engine, part, parts] = process.argv.slice(2);
  console.log(partFiles(engine, Number(part), Number(parts)).join('\n'));
}
