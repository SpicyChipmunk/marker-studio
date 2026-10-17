#!/usr/bin/env node
// The guide benchmark, stage A: how well the app finds a page's sections (scripts/bench/README.md).
//
//   node scripts/bench/run.mjs                 everything: TUNE and HELD, five sizes, Sensitivity 6, JPEG'd
//                                              downloads, photos (JPEG through Chromium)
//   node scripts/bench/run.mjs --quick         one size (1200), no JPEG, the first photo of each set
//   --set TUNE|HELD          one set only            --only t02,h0     pages whose id starts so
//   --out DIR                outputs (default: $BENCH_OUT, else <tmp>/marker-studio-bench); never inside the repo
//   --pics                   pictures of every run (page | truth | sections by class) in DIR/pics
//   --baseline               write bench/baseline.json (numbers only) from this run
//   --compare                compare this run with bench/baseline.json, row by row
//   --no-photos              the clean path only
//
// Needs the built index.html (npm run build). Pictures, the page cache and the report go to DIR; nothing is written in
// the repo except bench/baseline.json with --baseline.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { TUNE, HELD, PHOTOS, SIZES, SENS6_AT, QUICK } from './pages.mjs';
import { products, save, load } from './lib/build.mjs';
import { makeApp, cleanPath, photoPath } from './lib/app.mjs';
import { score } from './lib/score.mjs';
import { makePhoto, photoGeom } from './lib/photo.mjs';
import { jpegRoundTrip, close as closeBrowser } from './lib/browser.mjs';
import { writePNG, classPicture, truthPicture, greyToRGB, sideBySide } from './lib/png.mjs';
import { report } from './lib/report.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const argv = process.argv.slice(2),
  has = (f) => argv.includes(f),
  arg = (f, d) => {
    const i = argv.indexOf(f);
    return i >= 0 ? argv[i + 1] : d;
  };
const quick = has('--quick'),
  pics = has('--pics'),
  noPhotos = has('--no-photos');
const OUT = path.resolve(
  arg('--out', process.env.BENCH_OUT || path.join(os.tmpdir(), 'marker-studio-bench')),
);
if (OUT.startsWith(ROOT + path.sep)) {
  console.error('--out must be outside the repo');
  process.exit(2);
}
const CACHE = path.join(OUT, 'cache');
fs.mkdirSync(path.join(OUT, 'pics'), { recursive: true });
const sets = arg('--set') ? [arg('--set').toUpperCase()] : ['TUNE', 'HELD'];
const only = arg('--only') ? arg('--only').split(',') : null;
const want = (id) => !only || only.some((o) => id.startsWith(o));
const sizes = quick ? QUICK.sizes : SIZES,
  sens6 = quick ? QUICK.sens6 : SENS6_AT,
  jpeg = quick ? QUICK.jpeg : true;
const log = (s) => console.log(s);
const T0 = Date.now();

const t = makeApp();
const rows = [];
const summary = (sc) => {
  const o = { ...sc };
  delete o._per;
  delete o._spurious;
  return o;
};
function picture(name, meta, truth, r, sc) {
  const n = meta.W * meta.H,
    k = Math.max(1, Math.round(Math.max(meta.W, meta.H) / 1000));
  const sb = sideBySide(
    [greyToRGB(r.gray, n), truthPicture(meta, truth), classPicture(meta, truth, r, sc)],
    meta.W,
    meta.H,
    k,
  );
  writePNG(path.join(OUT, 'pics', name + '.png'), sb.W, sb.H, sb.rgb);
}
const rgbaOf = (input, n, rgb) => {
  const d = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < 3; c++) d[i * 4 + c] = rgb ? input[i * 3 + c] : input[i];
    d[i * 4 + 3] = 255;
  }
  return d;
};

for (const set of sets) {
  const specs = (set === 'TUNE' ? TUNE : HELD).filter((s) => want(s.id));
  for (const spec of specs) {
    const dl = jpeg ? [[600, 0.75], ...(spec.p.lw && spec.p.lw < 2.4 ? [[400, 0.5]] : [])] : [];
    const need = [...new Set([...sizes, ...sens6, 1200, ...dl.map((d) => d[0])])].sort((a, b) => a - b);
    const prods = await products(spec, need, CACHE, log);
    const runs = [
      ...sizes.map((s) => ['clean', s, 9]),
      ...sens6.map((s) => ['sens6', s, 6]),
      ...dl.map(([s, q]) => ['dljpeg', s, 9, q]),
    ];
    for (const [kind, size, adaptC, q] of runs) {
      let prod = prods[size];
      if (q) {
        // a download saved as JPEG: the picture through Chromium's encoder at q, cached
        const m = prod.meta,
          f = path.join(
            CACHE,
            'dljpeg',
            `${spec.id}-${size}-${q}-${crypto.createHash('sha1').update(prod.input).digest('hex').slice(0, 12)}.gz`,
          );
        let input;
        if (fs.existsSync(f)) input = load(f).input;
        else {
          const j = await jpegRoundTrip(m.inW, m.inH, rgbaOf(prod.input, m.inW * m.inH, m.rgb), q),
            n = m.inW * m.inH;
          input = new Uint8Array(n * (m.rgb ? 3 : 1));
          for (let i = 0; i < n; i++) {
            if (m.rgb) for (let c = 0; c < 3; c++) input[i * 3 + c] = j.d[i * 4 + c];
            else input[i] = j.d[i * 4];
          }
          save(f, { q, bytes: j.bytes }, { input });
        }
        prod = { meta: m, truth: prod.truth, input };
      }
      const r = cleanPath(t, prod, adaptC),
        sc = score(prod.meta, prod.truth, r);
      const name = `${spec.id}-${kind}-${size}${q ? '-q' + q : ''}`;
      rows.push({
        set,
        id: spec.id,
        family: spec.family,
        style: spec.style,
        kind,
        size,
        adaptC,
        q: q || null,
        W: prod.meta.W,
        H: prod.meta.H,
        srcK: +prod.meta.srcK.toFixed(3),
        lwW: +prod.meta.lwW.toFixed(2),
        segMs: Math.round(r.ms),
        hazards: [...new Set(prod.meta.hazards.map((h) => h.kind))],
        nTruth: prod.meta.nTruth,
        ambiguousTruth: prod.meta.ambiguous.length,
        ...summary(sc),
      });
      if (pics || (kind === 'clean' && size === 1200)) picture(name, prod.meta, prod.truth, r, sc);
    }
    log(`${set} ${spec.id}: ${runs.length} runs (${((Date.now() - T0) / 1000).toFixed(0)} s)`);
  }
  // photos
  if (noPhotos) continue;
  const phs = PHOTOS[set].filter((p) => want(p.page)).slice(0, quick ? QUICK.photos : 99);
  for (const ps of phs) {
    const spec = [...TUNE, ...HELD].find((s) => s.id === ps.page),
      page = (await products(spec, [1200], CACHE, log))[1200];
    const pm = page.meta,
      pg = { W: pm.W, H: pm.H, input: page.input, rgb: pm.rgb };
    const q = jpeg ? 0.9 : null,
      key = crypto
        .createHash('sha1')
        .update(JSON.stringify({ ps, q, v: 1 }))
        .update(page.input)
        .digest('hex')
        .slice(0, 16);
    const f = path.join(CACHE, 'photos', `${ps.page}-${ps.level.replace(/\W+/g, '_')}-${key}.gz`);
    let ph;
    if (fs.existsSync(f)) {
      const c = load(f);
      ph = { ...photoGeom(pm.W, pm.H, ps), d: c.d };
    } else {
      const t1 = Date.now();
      ph = makePhoto(pg, ps);
      if (q) ph.d = (await jpegRoundTrip(ph.W, ph.H, ph.d, q)).d;
      save(f, { ps, q }, { d: ph.d });
      log(`  photo ${ps.page} ${ps.level}: ${Date.now() - t1} ms`);
    }
    if (pics)
      writePNG(
        path.join(OUT, 'pics', `photo-${ps.page}-${ps.level.replace(/\W+/g, '_')}.png`),
        ph.W,
        ph.H,
        Uint8Array.from({ length: ph.W * ph.H * 3 }, (_, i) => ph.d[((i / 3) | 0) * 4 + (i % 3)]),
      );
    for (const [variant, o] of [
      ['f35-25', { f35: 25 }],
      ['f35-0', { f35: 0 }],
      ['none', { path: 'none' }],
    ]) {
      const res = photoPath(t, ph, page, { ...o, unsure: true });
      const sc = score(
        res.meta,
        res.truth,
        res.r,
        res.path === 'none' ? { inPage: res.inPage } : { edgeBand: 6 },
      );
      const name = `${ps.page}-photo-${ps.level.replace(/\W+/g, '_')}-${variant}`;
      rows.push({
        set,
        id: ps.page,
        family: spec.family,
        style: spec.style,
        kind: 'photo',
        level: ps.level,
        bg: ps.bg,
        variant,
        path: res.path,
        q,
        finder: res.finder,
        W: res.meta.W,
        H: res.meta.H,
        srcK: +res.r.srcK.toFixed(3),
        lwW: +res.meta.lwW.toFixed(2),
        segMs: Math.round(res.r.ms),
        hazards: [...new Set(pm.hazards.map((h) => h.kind))],
        nTruth: res.meta.nTruth,
        ambiguousTruth: pm.ambiguous.length,
        ...summary(sc),
      });
      if (pics || variant !== 'f35-0') picture(name, res.meta, res.truth, res.r, sc);
    }
    log(`${set} photo ${ps.page} ${ps.level} (${((Date.now() - T0) / 1000).toFixed(0)} s)`);
  }
}
await closeBrowser();

// numbers that must not change from one run to the next (determinism) and the baseline's form
const key = (r) => [r.set, r.id, r.kind, r.size || r.level, r.adaptC || r.variant, r.q || ''].join('|');
const numbers = (r) => ({
  matchedShare: +r.matchedShare.toFixed(4),
  defects: r.defects,
  defectArea: r.defectArea,
  spurious: r.spurious,
  counted: r.counted,
  defect: r.counts.defect,
  correct: r.counts.correct,
  expected: r.counts.expected,
  info: r.counts.info,
  feature: r.counts.feature,
  spuriousNearTangent: r.spuriousNearTangent,
  inkBloat: r.inkBloat,
  adjRecallA: r.adj.recallA,
  adjPrecisionB: r.adj.precisionB,
  warn: r.warn.code,
  ...(r.finder
    ? {
        tier: r.finder.tier,
        cornerErr: r.finder.cornerErr,
        aspectErr: r.finder.aspectErr == null ? null : r.finder.aspectErr,
      }
    : {}),
});
const base = Object.fromEntries(rows.map((r) => [key(r), numbers(r)]));
const digest = crypto.createHash('sha1').update(JSON.stringify(base)).digest('hex').slice(0, 12);
fs.writeFileSync(
  path.join(OUT, 'results.json'),
  JSON.stringify({ when: new Date().toISOString(), quick, digest, rows }, null, 1),
);
const md = report(rows, { quick, digest, secs: Math.round((Date.now() - T0) / 1000) });
fs.writeFileSync(path.join(OUT, 'report.md'), md);
if (has('--baseline')) {
  fs.mkdirSync(path.join(ROOT, 'bench'), { recursive: true });
  // (one row a line, so a change shows as the rows it changed)
  const head = {
    note: 'numbers only: node scripts/bench/run.mjs --baseline; see scripts/bench/README.md',
    quick,
    digest,
  };
  const lines = Object.entries(base).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`);
  fs.writeFileSync(
    path.join(ROOT, 'bench', 'baseline.json'),
    JSON.stringify(head, null, 1).slice(0, -2) + ',\n "rows": {\n' + lines.join(',\n') + '\n }\n}\n',
  );
}
if (has('--compare')) {
  const b = JSON.parse(fs.readFileSync(path.join(ROOT, 'bench', 'baseline.json'), 'utf8')).rows;
  let same = 0,
    diff = 0,
    gone = 0;
  for (const [k, v] of Object.entries(base)) {
    if (!b[k]) continue;
    if (JSON.stringify(b[k]) === JSON.stringify(v)) {
      same++;
      continue;
    }
    diff++;
    const ch = Object.keys(v)
      .filter((f) => JSON.stringify(v[f]) !== JSON.stringify(b[k][f]))
      .map((f) => `${f} ${JSON.stringify(b[k][f])} -> ${JSON.stringify(v[f])}`);
    log(`changed ${k}: ${ch.join('; ')}`);
  }
  for (const k of Object.keys(b))
    if (!base[k] && (!only || only.some((o) => k.split('|')[1].startsWith(o)))) gone++;
  log(
    `compare with bench/baseline.json: ${same} the same, ${diff} changed${gone ? `, ${gone} not run` : ''}`,
  );
}
log(
  `\n${rows.length} runs in ${Math.round((Date.now() - T0) / 1000)} s; digest ${digest}; report ${path.join(OUT, 'report.md')}`,
);
