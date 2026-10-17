#!/usr/bin/env node
// The guide benchmark, stage B step 3: colouring measures per family on the pages' TRUE sections (README.md).
//
//   node scripts/bench/colour.mjs              every page, three collections, the whole grid, splits, end to end
//   node scripts/bench/colour.mjs --quick      one page a family, Honolulu 24, the grid without moods / limitN
//   --set TUNE|HELD   --only t02,h0   --out DIR (default: $BENCH_OUT, else <tmp>/marker-studio-bench)
//   --baseline        write bench/colour-baseline.json (numbers only)    --compare   against it
//
// Uses the stage-A page cache in DIR/cache (built on first use). Writes DIR/colour-report.md,
// DIR/colour-results.json, and the A/B pair lists DIR/ab/*.json (never in the repo).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { TUNE, HELD } from './pages.mjs';
import { products } from './lib/build.mjs';
import { close as closeBrowser } from './lib/browser.mjs';
import { makeApp, cleanPath } from './lib/app.mjs';
import { appOn, lay, measure, strictAdj, seeded, BASE } from './lib/colour.mjs';
import { colourReport } from './lib/colour-report.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const argv = process.argv.slice(2),
  has = (f) => argv.includes(f),
  arg = (f, d) => {
    const i = argv.indexOf(f);
    return i >= 0 ? argv[i + 1] : d;
  };
const quick = has('--quick');
const OUT = path.resolve(
  arg('--out', process.env.BENCH_OUT || path.join(os.tmpdir(), 'marker-studio-bench')),
);
if (OUT.startsWith(ROOT + path.sep)) {
  console.error('--out must be outside the repo');
  process.exit(2);
}
const CACHE = path.join(OUT, 'cache');
fs.mkdirSync(path.join(OUT, 'ab'), { recursive: true });
const sets = arg('--set') ? [arg('--set').toUpperCase()] : ['TUNE', 'HELD'];
const only = arg('--only') ? arg('--only').split(',') : null;
const log = (s) => console.log(s);
const T0 = Date.now();

// the grid (Fable's PT-stageB: looks auto and ltd, since smooth equals auto on these pages)
const GRID = [];
for (const shape of ['serpentine', 'vertical', 'diagonal', 'radial', 'around'])
  for (const look of ['auto', 'ltd'])
    for (const scat of [0, 2])
      GRID.push({
        name: `grad ${shape} ${look} scat${scat}`,
        fam: 'gradient',
        vars: { family: 'gradient', gradShape: shape, look, gradScat: scat },
        core: true,
      });
for (const mood of ['vivid', 'muted', 'pastel', 'deep', 'earthy'])
  GRID.push({
    name: `grad serpentine ${mood}`,
    fam: 'gradient',
    vars: { family: 'gradient', emphasis: mood },
  });
for (const n of [8, 32])
  GRID.push({ name: `grad serpentine limit${n}`, fam: 'gradient', vars: { family: 'gradient', limitN: n } });
for (const [nm, v] of [
  ['mixed', {}],
  ['noAdj', { noAdj: true }],
  ['balance', { balance: 'main' }],
  ['noRep', { noRep: true }],
])
  GRID.push({ name: `random ${nm}`, fam: 'random', vars: { family: 'random', ...v }, core: true });
for (const mood of ['vivid', 'muted', 'pastel', 'deep', 'earthy'])
  GRID.push({ name: `random mixed ${mood}`, fam: 'random', vars: { family: 'random', emphasis: mood } });
for (const n of [8, 32])
  GRID.push({ name: `random mixed limit${n}`, fam: 'random', vars: { family: 'random', limitN: n } });
for (const mix of ['soft', 'vivid', 'paint'])
  GRID.push({ name: `blend ${mix}`, fam: 'blend', vars: { family: 'blend', blendMix: mix }, core: true });

const COLLS = quick
  ? ['Honolulu 24']
  : ['Large mixed', 'Honolulu 320', 'Honolulu 120', 'Honolulu 24', 'Ciao 12'];
const SPLIT_COLL = 'Honolulu 24',
  SPLITS = quick ? 2 : 5;
const rows = [],
  splits = [],
  drops = [],
  e2e = [],
  gates = [],
  abCands = [];

function pagesFor(set) {
  let ps = (set === 'TUNE' ? TUNE : HELD).filter((s) => !only || only.some((o) => s.id.startsWith(o)));
  if (quick) {
    const seen = new Set();
    ps = ps.filter((s) => (seen.has(s.family) ? false : seen.add(s.family)));
  }
  return ps;
}

for (const set of sets) {
  const seeds = set === 'TUNE' ? [1, 2] : [11, 12];
  for (const spec of pagesFor(set)) {
    const page = (await products(spec, [1200], CACHE, log))[1200],
      m = page.meta;
    const reach = Math.ceil(m.lwW) + 1;
    for (const coll of COLLS) {
      const a = appOn(page, coll),
        strict = strictAdj(a.t.labels, m.W, m.H, reach);
      for (const g of GRID) {
        if (quick && !g.core) continue;
        const sds = g.fam === 'random' ? seeds : [seeds[0]];
        for (const sd of sds) {
          const r = lay(a, g.vars, sd),
            ms = measure(a, r, strict, g.vars);
          if (!ms) {
            gates.push({ set, id: spec.id, coll, row: g.name, seed: sd, gate: 'no guide built' });
            continue;
          }
          // determinism gate: the first seed, laid again
          if (sd === sds[0]) {
            const r2 = lay(a, g.vars, sd);
            if (r2.ad.order.map((l) => r2.ad.assign[l].mkey).join(',') !== ms.sig)
              gates.push({ set, id: spec.id, coll, row: g.name, seed: sd, gate: 'not deterministic' });
          }
          const mood = g.vars.emphasis || 'neutral';
          if (g.fam === 'random') {
            // (gates on the app's own idea of touching: what it promises. Pairs only the eye sees touching are the
            // adjacency's misses, reported apart)
            if (ms.app.same)
              gates.push({
                set,
                id: spec.id,
                coll,
                row: g.name,
                seed: sd,
                gate: `touching sections share a marker (${ms.app.same})`,
              });
            if (ms.app.twin)
              gates.push({
                set,
                id: spec.id,
                coll,
                row: g.name,
                seed: sd,
                gate: `touching twins (${ms.app.twin})`,
              });
            if (g.vars.noAdj && ms.app.low)
              gates.push({
                set,
                id: spec.id,
                coll,
                row: g.name,
                seed: sd,
                gate: `noAdj: ${ms.app.low} touching pairs under ΔE 10`,
              });
          }
          if (g.fam === 'gradient' && mood === 'neutral' && ms.app.twin)
            gates.push({
              set,
              id: spec.id,
              coll,
              row: g.name,
              seed: sd,
              gate: `gradient twins at neutral (${ms.app.twin}; ${ms.usedTwins} twin pairs among the markers it picked)`,
            });
          const sig = ms.sig;
          delete ms.sig;
          rows.push({
            set,
            id: spec.id,
            family: spec.family,
            coll,
            row: g.name,
            fam: g.fam,
            seed: sd,
            ...ms,
          });
          if (g.fam === 'gradient' && g.core)
            abCands.push({
              set,
              id: spec.id,
              coll,
              row: g.name,
              vars: { ...BASE, ...g.vars },
              seed: sd,
              wRough: ms.strict.wRough,
              rough: ms.strict.rough,
              used: ms.used,
              meanDE: ms.flow.meanDE,
              assign: Object.fromEntries(sig.split(',').map((k, i) => [r.ad.order[i], k])),
              hex: Object.fromEntries(
                [...new Set(sig.split(','))].map((k) => [
                  k,
                  (r.ad.assign[r.ad.order[sig.split(',').indexOf(k)]] || {}).hex,
                ]),
              ),
              W: m.W,
              H: m.H,
            });
        }
      }
      // stability (a): one mid-sized section dropped (background), a fresh lay; how many others change
      for (const g of GRID.filter(
        (x) => x.core && /serpentine auto scat0|random mixed|blend soft/.test(x.name),
      )) {
        const r1 = lay(a, g.vars, seeds[0]),
          cl = a.t
            .countedList()
            .slice()
            .sort((x, y) => a.t.comps[y].area - a.t.comps[x].area),
          L = cl[cl.length >> 1];
        a.t.comps[L].bg = true;
        const r2 = lay(a, g.vars, seeds[0]);
        a.t.comps[L].bg = false;
        let ch = 0,
          n = 0;
        for (const l of r1.ad.order) {
          if (l === L || !r2.ad.assign[l]) continue;
          n++;
          if (r2.ad.assign[l].mkey !== r1.ad.assign[l].mkey) ch++;
        }
        drops.push({ set, id: spec.id, coll, row: g.name, changed: ch, of: n });
      }
      log(
        `${set} ${spec.id} ${coll}: ${rows.length} builds so far (${((Date.now() - T0) / 1000).toFixed(0)} s)`,
      );
    }
    // stability (b): the app's real edit path, in Review mode: split a section, Build with the old guide kept
    for (const g of [
      GRID.find((x) => x.name === 'grad serpentine auto scat0'),
      GRID.find((x) => x.name === 'random noAdj'),
    ]) {
      const a = appOn(page, SPLIT_COLL),
        t = a.t;
      t.assign.sfmode = 'review';
      lay(a, g.vars, seeds[0]);
      const cl = t
        .countedList()
        .slice()
        .sort((x, y) => t.comps[y].area - t.comps[x].area);
      for (let i = 0; i < SPLITS; i++) {
        const L = cl[Math.floor((cl.length * (i + 1)) / (SPLITS + 1))],
          c = t.comps[L];
        if (!c) continue;
        const A0 = Object.fromEntries(Object.entries(t.assignData.assign).map(([k, v]) => [k, v.mkey])),
          n0 = t.comps.length;
        const wide = c.x1 - c.x0 >= c.h,
          pts = wide
            ? [
                { x: c.x0 - 2, y: Math.round(c.cy) },
                { x: c.x1 + 2, y: Math.round(c.cy) },
              ]
            : [
                { x: Math.round(c.cx), y: c.y0 - 2 },
                { x: Math.round(c.cx), y: c.y1 + 2 },
              ];
        if (!t.splitAt(L, pts, true)) {
          splits.push({ set, id: spec.id, row: g.name, L, divided: false });
          continue;
        }
        // (applyBg re-derives background from the edge after a split: put back the answers' background on the old
        // sections; the new parts are drawing)
        for (let l = 1; l < n0; l++) if (t.comps[l]) t.comps[l].bg = a.tagBg[l];
        for (let l = n0; l < t.comps.length; l++) if (t.comps[l]) t.comps[l].bg = false;
        t.assign.adj = null;
        const r = lay(a, g.vars, seeds[0], true),
          A = r.ad.assign,
          adj = t.adj,
          mp = t.minPx();
        const parts = [L, ...Array.from({ length: t.comps.length - n0 }, (_, k) => n0 + k)].filter(
          (l) => t.comps[l] && t.comps[l].area >= mp,
        );
        let changed = 0,
          same = 0,
          twin = 0,
          rough = 0,
          nb = 0;
        for (const l in A0) if (+l !== L && A[l] && A[l].mkey !== A0[l]) changed++;
        for (const l of parts)
          for (const q of adj[l] || []) {
            if (!A[l] || !A[q] || parts.includes(q)) continue;
            nb++;
            if (A[q].mkey === A[l].mkey) same++;
            else {
              const d = a.de(A[q].lab, A[l].lab);
              if (d < 2.5) twin++;
              if (d > 30) rough++;
            }
          }
        splits.push({
          set,
          id: spec.id,
          row: g.name,
          L,
          divided: true,
          parts: parts.length,
          othersChanged: changed,
          oldKept: !!A[L] && A[L].mkey === A0[L],
          nb,
          same,
          twin,
          rough,
        });
      }
    }
    // end to end: the app's own sections on the clean page (1200), two families, Honolulu 24
    {
      const tt = makeApp(),
        r0 = cleanPath(tt, page),
        counted = new Set([...r0.counted]);
      const n = r0.comps.length - 1,
        a = appOn(page, 'Honolulu 24', {
          labels: r0.labels,
          n,
          tagOf: (l) => (counted.has(l) ? 'drawing' : 'margin'),
          srcK: r0.srcK || 1,
        });
      const strictApp = strictAdj(a.t.labels, m.W, m.H, reach);
      for (const g of [
        GRID.find((x) => x.name === 'grad serpentine auto scat0'),
        GRID.find((x) => x.name === 'random mixed'),
      ]) {
        const r = lay(a, g.vars, seeds[0]),
          ms = measure(a, r, strictApp, g.vars);
        const tr = rows.find(
          (x) =>
            x.set === set &&
            x.id === spec.id &&
            x.coll === 'Honolulu 24' &&
            x.row === g.name &&
            x.seed === seeds[0],
        );
        if (ms) {
          delete ms.sig;
          // (no timings in what must not change between runs)
          delete ms.ms;
          e2e.push({
            set,
            id: spec.id,
            row: g.name,
            app: ms,
            truth: tr ? { N: tr.N, strict: tr.strict, used: tr.used } : null,
          });
        }
      }
    }
    log(`${set} ${spec.id}: done (${((Date.now() - T0) / 1000).toFixed(0)} s)`);
  }
}
await closeBrowser();

// A/B session 1 (Gradient rough steps): pairs on the same page and collection whose settings differ in one thing (look,
// Scatter or shape), spread over the difference in border-weighted rough share; measure values never shown in the tool
const pairs = [];
const byKey = new Map();
for (const c of abCands) {
  const k = c.set + '|' + c.id + '|' + c.coll;
  (byKey.get(k) || byKey.set(k, []).get(k)).push(c);
}
for (const list of byKey.values())
  for (let i = 0; i < list.length; i++)
    for (let j = i + 1; j < list.length; j++) {
      const p = list[i],
        q = list[j],
        d = ['gradShape', 'look', 'gradScat'].filter(
          (k) => (p.vars[k] ?? BASE[k]) !== (q.vars[k] ?? BASE[k]),
        );
      if (d.length !== 1 || (p.assign && JSON.stringify(p.assign) === JSON.stringify(q.assign))) continue;
      pairs.push({
        page: p.id,
        set: p.set,
        coll: p.coll,
        differs: d[0],
        a: p,
        b: q,
        dRough: +(q.wRough - p.wRough).toFixed(4),
      });
    }
pairs.sort((x, y) => Math.abs(x.dRough) - Math.abs(y.dRough));
const pick = [];
if (pairs.length)
  for (let k = 0; k < 40; k++)
    pick.push(pairs[Math.min(pairs.length - 1, Math.floor(((k + 0.5) * pairs.length) / 40))]);
const uniq = [...new Set(pick)];
fs.writeFileSync(
  path.join(OUT, 'ab', 'session1-gradient-rough.json'),
  JSON.stringify({
    measure: 'Gradient rough steps (border-weighted share of touching pairs over ΔE00 30)',
    note: 'pairs of builds on the same page and collection, one setting apart; values are for analysis, never shown in the A/B tool. assign: section (the page truth label at W x H, scripts/bench cache) -> marker key; hex per marker key',
    pairs: uniq.map((p, i) => ({
      n: i + 1,
      page: p.page,
      set: p.set,
      coll: p.coll,
      differs: p.differs,
      W: p.a.W,
      H: p.a.H,
      a: {
        row: p.a.row,
        vars: p.a.vars,
        seed: p.a.seed,
        hex: p.a.hex,
        wRough: p.a.wRough,
        used: p.a.used,
        meanDE: p.a.meanDE,
        assign: p.a.assign,
      },
      b: {
        row: p.b.row,
        vars: p.b.vars,
        seed: p.b.seed,
        hex: p.b.hex,
        wRough: p.b.wRough,
        used: p.b.used,
        meanDE: p.b.meanDE,
        assign: p.b.assign,
      },
    })),
  }),
);

const keyOf = (r) => [r.set, r.id, r.coll, r.row, r.seed].join('|');
const numbers = (r) => ({
  N: r.N,
  used: r.used,
  giniN: r.giniN,
  strict: r.strict,
  app: r.app,
  flow: r.flow || null,
  mood: r.mood || null,
  balance: r.balance || null,
});
const base = Object.fromEntries(rows.map((r) => [keyOf(r), numbers(r)]));
const digest = crypto
  .createHash('sha1')
  .update(JSON.stringify({ base, splits, drops, e2e, gates }))
  .digest('hex')
  .slice(0, 12);
fs.writeFileSync(
  path.join(OUT, 'colour-results.json'),
  JSON.stringify(
    { when: new Date().toISOString(), quick, digest, rows, splits, drops, e2e, gates, abPairs: uniq.length },
    null,
    1,
  ),
);
fs.writeFileSync(
  path.join(OUT, 'colour-report.md'),
  colourReport({
    rows,
    splits,
    drops,
    e2e,
    gates,
    abPairs: uniq.length,
    quick,
    digest,
    secs: Math.round((Date.now() - T0) / 1000),
    colls: COLLS,
  }),
);
if (has('--baseline')) {
  const lines = Object.entries(base).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`);
  fs.writeFileSync(
    path.join(ROOT, 'bench', 'colour-baseline.json'),
    JSON.stringify(
      { note: 'numbers only: node scripts/bench/colour.mjs --baseline', quick, digest },
      null,
      1,
    ).slice(0, -2) +
      ',\n "rows": {\n' +
      lines.join(',\n') +
      '\n }\n}\n',
  );
}
if (has('--compare')) {
  const b = JSON.parse(fs.readFileSync(path.join(ROOT, 'bench', 'colour-baseline.json'), 'utf8')).rows;
  let same = 0,
    diff = 0;
  for (const [k, v] of Object.entries(base)) {
    if (!b[k]) continue;
    if (JSON.stringify(b[k]) === JSON.stringify(v)) same++;
    else {
      diff++;
      if (diff <= 30) log(`changed ${k}`);
    }
  }
  log(`compare with bench/colour-baseline.json: ${same} the same, ${diff} changed`);
}
log(
  `\n${rows.length} builds, ${splits.length} splits, ${gates.length} gate failures in ${Math.round((Date.now() - T0) / 1000)} s; digest ${digest}; report ${path.join(OUT, 'colour-report.md')}`,
);
