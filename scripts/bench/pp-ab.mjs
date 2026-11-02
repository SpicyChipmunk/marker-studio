#!/usr/bin/env node
// The photo-to-page bench's blind comparison (decisions 80 and 99, plan v4): pages from two builders side by side, sides
// at random and unlabelled, for Ben to judge in one self-contained file (sent in the chat, never published: his photos
// are in it). 20 HELD photos where the two pages really differ (>= 2% of the page's pixels change section colour or line,
// or spill moves by 1 point or more, or the section count by 5 or more) and up to 10 of Ben's own photos, at Medium
// (Even); for each, Left / Same / Right, and a tap shows the line pages. "Copy answers" gives a short text to paste back.
//
//   node scripts/bench/pp-ab.mjs --cache <cache> --photos <bench-photos> --b <candidate checkout, built>
//        [--own-cache <cache of Ben's photos, from pp-prep.mjs on his folder>] [--n 20] [--own 10] [--pool large]
//        --out <file.html>          (the key, which side is which, stays in <cache>/ab-key-<tag>.json)
//   node scripts/bench/pp-ab.mjs --score <answers text> --key <ab-key json>   decision 99's verdict
//
// Ben's own photos: the first --own of the folder pp-prep.mjs prepared, by file name (he chooses by what he puts in it).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { createApp } from '../../test/harness.mjs';
import {
  appWith,
  poolOf,
  job,
  sigOf,
  pictures,
  parseCsv,
  SUB_GF_R,
  SUB_GF_EPS,
  lineTally,
} from './lib/pp.mjs';

const argv = process.argv.slice(2),
  arg = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);

// ---- decision 99's verdict from pasted answers ----
if (arg('--score')) {
  const key = JSON.parse(fs.readFileSync(arg('--key'))),
    text = fs.readFileSync(arg('--score'), 'utf8'),
    ans = Object.fromEntries([...text.matchAll(/(\d+)\s*([LRS])/g)].map((m) => [+m[1], m[2]]));
  const tally = (sel) => {
    let today = 0,
      cand = 0,
      same = 0;
    key.pairs.forEach((p, i) => {
      if (!sel(p) || !ans[i + 1]) return;
      const a = ans[i + 1];
      if (a === 'S') same++;
      else if ((a === 'L') === (p.left === 'A')) today++;
      else cand++;
    });
    return { today, cand, same };
  };
  const all = tally(() => true),
    bench = tally((p) => !p.own),
    own = tally((p) => p.own),
    n = all.today + all.cand,
    // (FINDINGS-AM 4: decision 99's 2:1 or 20 of 30, and never on fewer than 10 preferences nor when a one-sided sign
    // test on the preferences gives p 0.1 or more: 3 pairs at 2:1, or 4:2 among 24 Same, is not a verdict)
    tail = (k) => {
      let p = 0,
        c = 1;
      for (let i = 0; i <= n; i++) {
        if (i >= k) p += c;
        c = (c * (n - i)) / (i + 1);
      }
      return p / Math.pow(2, n);
    },
    wins = (x, y) => (x >= 2 * Math.max(1, y) || x >= 20) && n >= 10 && tail(x) < 0.1,
    verdict = wins(all.today, all.cand)
      ? "VETO: today's builder wins"
      : wins(all.cand, all.today)
        ? 'LIKED: the candidate wins'
        : 'UNDECIDED: Ben decides';
  console.log(
    `${verdict} (${n} pairs with a preference: today ${all.today}, candidate ${all.cand}, one-sided sign test p ${tail(Math.max(all.today, all.cand)).toFixed(3)}; same ${all.same}).` +
      ` Bench photos: today ${bench.today}, candidate ${bench.cand}, same ${bench.same}. Ben's own: today ${own.today}, candidate ${own.cand}, same ${own.same}.`,
  );
  process.exit(0);
}

const CACHE = arg('--cache'),
  PHOTOS = arg('--photos'),
  BROOT = arg('--b'),
  OWN = arg('--own-cache'),
  N = +arg('--n', 20),
  NOWN = +arg('--own', 10),
  POOL = arg('--pool', 'large'),
  OUT = arg('--out'),
  D = 2,
  // (FINDINGS-AP 8: a Focus mode too, with the subject maps pp_maps.py made for each cache; a photo without one, or not
  // Focus-ready, is left out)
  MODE = arg('--mode', 'even'),
  MAP = arg('--map', 'subject-te4'),
  XOPT = arg('--x')
    ? Object.fromEntries(
        arg('--x')
          .split(',')
          .map((kv) => kv.split('='))
          .map(([k, v]) => [k, isNaN(+v) ? v : +v]),
      )
    : null,
  TAG = path.basename(OUT || 'ab', '.html');
if (!CACHE || !PHOTOS || !BROOT || !OUT) {
  console.error(
    'usage: pp-ab.mjs --cache <cache> --photos <bench-photos> --b <candidate checkout> --out <file.html>',
  );
  process.exit(2);
}
const { createApp: createB } = await import(path.join(path.resolve(BROOT), 'test', 'harness.mjs'));
const A = appWith(createApp, POOL),
  B = appWith(createB, arg('--pool-b', POOL)),
  poolA = poolOf(A, MODE),
  poolB = poolOf(B, MODE); // (--pool-b: the bench's own test, a different pool on B)

function load(dir, id) {
  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'prep', id + '.json'))),
    rgb = new Uint8Array(fs.readFileSync(path.join(dir, 'prep', id + '.rgb')));
  return {
    key: 'ab',
    rgb,
    w: meta.w,
    h: meta.h,
    GW: meta.GW,
    GH: meta.GH,
    tl: new Float32Array(meta.tl),
    tw: new Float32Array(meta.tw),
    sal: MODE === 'even' ? null : salOf(dir, id, rgb, meta),
  };
}
function salOf(dir, id, rgb, meta) {
  const mp = path.join(dir, 'maps', MAP, id + '.y');
  if (!fs.existsSync(mp)) return undefined;
  const side = JSON.parse(fs.readFileSync(path.join(dir, 'maps', MAP, 'model.json'))).side;
  return A.subMapUp(
    new Float32Array(new Uint8Array(fs.readFileSync(mp)).buffer),
    side,
    rgb,
    meta.w,
    meta.h,
    SUB_GF_R,
    SUB_GF_EPS,
  );
}
let pid = 1; // (distinct for every build: ppBuildCore's smoothing cache is kept by pid)
function build(X, pool, prep) {
  const p = { ...prep, pid: ++pid },
    jb = Object.assign(job(X, p, D, MODE, pool, sigOf(pool)), X === B && XOPT ? { x: XOPT } : {}),
    r = X.ppBuildCore(jb);
  return { r, pl: jb.pl, GW: p.GW, GH: p.GH, rNeed: (jb._mm * jb._gpm) / 2 };
}
// each section's drawn colour as Lab (white for Leave white)
function secLab(b) {
  const { r, pl } = b,
    out = new Float32Array((r.S + 1) * 3).fill(-1);
  for (let s = 1; s <= r.S; s++) {
    const mk = r.secMk[s];
    if (r.secWhite[s] || mk < 0) out.set([100, 0, 0], s * 3);
    else out.set(pl.subarray(r.pick.chosen[mk] * 3, r.pick.chosen[mk] * 3 + 3), s * 3);
  }
  return out;
}
// spill (as pp-bench.mjs measures it) over the photo's outlined objects big enough for the step, when the masks are there
function spill(dir, id, b) {
  const mj = path.join(dir, 'masks', id + '.json');
  if (!fs.existsSync(mj)) return null;
  const { r, GW, GH } = b,
    area = new Float64Array(r.S + 1);
  for (let i = 0; i < r.lab.length; i++) if (r.lab[i] > 0) area[r.lab[i]]++;
  let sp = 0,
    w = 0;
  for (const o of JSON.parse(fs.readFileSync(mj)).objs) {
    if (o.r_in < b.rNeed) continue;
    const bits = zlib.gunzipSync(fs.readFileSync(path.join(dir, 'masks', `${id}-${o.k}.bits.gz`))),
      inC = new Map();
    for (let i = 0; i < GW * GH; i++)
      if ((bits[i >> 3] >> (7 - (i & 7))) & 1 && r.lab[i] >= 0)
        inC.set(r.lab[i], (inC.get(r.lab[i]) || 0) + 1);
    inC.forEach((a, s) => (sp += Math.min(a, area[s] - a)));
    w += o.area;
  }
  return w ? (100 * sp) / w : null;
}
// pages that really differ (FINDINGS-AL 8, -AM 4): sections by 5 or more, 2% of the page's pixels (every 7th looked
// at) a line on one and not the other or a different colour, or spill by 1 point or more
function differs(dir, id, a, b) {
  if (Math.abs(a.r.S - b.r.S) >= 5) return 'sections';
  const la = secLab(a),
    lb = secLab(b),
    n = a.r.lab.length;
  let d = 0;
  for (let i = 0; i < n; i += 7) {
    const x = a.r.lab[i],
      y = b.r.lab[i];
    if (x < 0 || y < 0) {
      if (x < 0 !== y < 0) d++;
    } else if (la[x * 3] !== lb[y * 3] || la[x * 3 + 1] !== lb[y * 3 + 1] || la[x * 3 + 2] !== lb[y * 3 + 2])
      d++;
  }
  if (d / (n / 7) >= 0.02) return 'pixels';
  // (FINDINGS-AQ 8: a same-marker split changes a few hundred line pixels, under the 2%: a page where two touching
  // sections with one marker appear or go is a page that differs)
  if (lineTally(a.r, a.GW, a.GH).splits !== lineTally(b.r, b.GW, b.GH).splits) return 'splits';
  const sa = spill(dir, id, a),
    sb = spill(dir, id, b);
  return sa !== null && sb !== null && Math.abs(sa - sb) >= 1 ? 'spill' : null;
}

const seed = crypto.createHash('sha256').update(TAG).digest();
let s32 = seed.readUInt32BE(0) || 1;
const rnd = () => (s32 = (s32 * 16807) % 2147483647) / 2147483647;
const index = fs.readFileSync(path.join(PHOTOS, 'index.csv'), 'utf8').split(/\r?\n/).filter(Boolean),
  ihead = parseCsv(index[0]),
  credit = new Map(),
  rows = index
    .slice(1)
    .map((l) => Object.fromEntries(parseCsv(l).map((v, i) => [ihead[i], v])))
    .filter((r) => (credit.set(r.id, r.credit), r.set === 'HELD' && (MODE === 'even' || r.focus_ok === '1')))
    .filter((r) => fs.existsSync(path.join(CACHE, 'prep', r.id + '.json')))
    .map((r) => r.id)
    .sort(() => rnd() - 0.5);
const esc = (v) =>
  String(v || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
// (each pair's pictures drawn as soon as it is found, the pages let go: FINDINGS-AM 8)
const pairs = [],
  draw = (a, b) => ({ a: pictures(a), b: pictures(b) });
let looked = 0;
for (const id of rows) {
  if (pairs.length >= N) break;
  looked++;
  const prep = load(CACHE, id);
  if (prep.sal === undefined) continue;
  const a = build(A, poolA, prep),
    b = build(B, poolB, prep),
    why = differs(CACHE, id, a, b);
  if (why) pairs.push({ id, own: false, why, ...draw(a, b) });
}
if (OWN)
  for (const f of fs
    .readdirSync(path.join(OWN, 'prep'))
    .filter((x) => x.endsWith('.json') && !x.startsWith('_'))
    .sort()
    .slice(0, NOWN)) {
    const id = f.slice(0, -5),
      prep = load(OWN, id);
    if (prep.sal === undefined) {
      console.log(`  ${id}: no subject map in ${OWN}/maps/${MAP} (pp_maps.py on that cache): left out`);
      continue;
    }
    pairs.push({ id, own: true, why: 'own', ...draw(build(A, poolA, prep), build(B, poolB, prep)) });
  }
pairs.sort(() => rnd() - 0.5);
const key = { tag: TAG, looked, pairs: [] },
  cards = [];
pairs.forEach((p) => {
  const left = rnd() < 0.5 ? 'A' : 'B',
    L = left === 'A' ? p.a : p.b,
    R = left === 'A' ? p.b : p.a;
  key.pairs.push({ id: p.id, own: p.own, why: p.why, left });
  cards.push({ L, R });
});
fs.writeFileSync(path.join(CACHE, `ab-key-${TAG}.json`), JSON.stringify(key, null, 1));
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Page comparison</title>
<style>
:root{--bg:#f7f6f3;--fg:#1f2328;--mut:#5c6370;--line:#d8d5cf;--acc:#2f6fd6;--accfg:#fff}
@media (prefers-color-scheme:dark){:root{--bg:#15171a;--fg:#e8e6e1;--mut:#9aa0a8;--line:#30343a;--acc:#6a9cf0;--accfg:#0d1117}}
body{background:var(--bg);color:var(--fg);font:16px/1.5 -apple-system,system-ui,sans-serif;margin:0;padding:16px}
main{max-width:1100px;margin:0 auto;display:grid;gap:22px}h1{font-size:1.4rem;margin:0}p{margin:0;color:var(--mut)}
.pair{border:1px solid var(--line);border-radius:10px;padding:12px;display:grid;gap:10px}
.two{display:grid;grid-template-columns:1fr 1fr;gap:10px}.two img{width:100%;border:1px solid var(--line);border-radius:6px;background:#fff;cursor:pointer}
.btns{display:flex;gap:8px;flex-wrap:wrap}button{font:600 1rem system-ui;padding:10px 16px;border-radius:8px;border:1px solid var(--acc);background:transparent;color:var(--acc);cursor:pointer}
button.on{background:var(--acc);color:var(--accfg)}textarea{width:100%;box-sizing:border-box;min-height:5em;font:13px ui-monospace,monospace}
@media (max-width:600px){.two{grid-template-columns:1fr}}
</style>
<main><h1>Which page would you rather colour?</h1>
<p>${cards.length} pairs of pages made from the same photo by two versions of the page builder, at Medium. The sides are random. For each, choose the page you'd rather colour, or Same if you have no preference. Tap a picture to see its line page; tap again for the coloured one.</p>
${cards
  .map(
    (c, i) => `<section class="pair" data-i="${i + 1}"><strong>Pair ${i + 1}</strong>
<div class="two"><img alt="Left page, pair ${i + 1}" data-c="${c.L.colour}" data-l="${c.L.lines}" src="data:image/png;base64,${c.L.colour}"><img alt="Right page, pair ${i + 1}" data-c="${c.R.colour}" data-l="${c.R.lines}" src="data:image/png;base64,${c.R.colour}"></div>
<div class="btns"><button data-v="L">Left</button><button data-v="S">Same</button><button data-v="R">Right</button></div></section>`,
  )
  .join('\n')}
<section class="pair"><strong>When you're done</strong><p id="left">Answered 0 of ${cards.length}.</p><button id="copy">Copy answers</button><textarea id="out" readonly></textarea><p>Paste the answers into the chat.</p></section>
<section class="pair"><strong>Photos</strong><p>The bench pages were made from these Open Images photos (CC BY 2.0): ${key.pairs
  .map((p, i) => (p.own ? null : `pair ${i + 1}: ${esc(credit.get(p.id))}`))
  .filter(Boolean)
  .join('; ')}.</p></section>
</main>
<script>
const ans={},n=${cards.length},out=document.getElementById('out');
function show(){const k=Object.keys(ans).sort((a,b)=>a-b);out.value='${TAG} '+k.map(i=>i+ans[i]).join(' ');document.getElementById('left').textContent='Answered '+k.length+' of '+n+'.';}
document.querySelectorAll('.pair[data-i]').forEach(s=>{s.querySelectorAll('button').forEach(b=>b.onclick=()=>{ans[s.dataset.i]=b.dataset.v;s.querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b));show();});
s.querySelectorAll('img').forEach(im=>im.onclick=()=>{const l=im.dataset.on==='1';im.src='data:image/png;base64,'+(l?im.dataset.c:im.dataset.l);im.dataset.on=l?'0':'1';});});
document.getElementById('copy').onclick=async()=>{show();try{await navigator.clipboard.writeText(out.value);document.getElementById('copy').textContent='Copied';}catch(e){out.focus();out.select();}};
show();
</script></html>`;
fs.writeFileSync(OUT, html);
console.log(
  `pp-ab: ${cards.length} pairs (${pairs.filter((p) => p.own).length} of Ben's photos; ${pairs.filter((p) => !p.own).length} bench photos whose pages differ, of ${looked} looked at), ${(html.length / 1e6).toFixed(1)} MB: ${OUT}; key ${path.join(CACHE, `ab-key-${TAG}.json`)}`,
);
