#!/usr/bin/env node
// The guide benchmark, step 4: score real photos of the printed set (scripts/bench/README.md).
//
//   node scripts/bench/photos.mjs --in <folder of JPEGs>   registers each photo by its four squares and page code, then
//                                                          runs the app's photo path on it and scores it like stage A
//   node scripts/bench/photos.mjs --selftest               the same on stand-in photos of the sheets made here
//   --out DIR (default: $BENCH_OUT, else <tmp>/marker-studio-bench): needs DIR/print from print.mjs
//
// Photos are the person's own: they are read where they are and nothing of them is written into the repo; the report
// and pictures go to DIR/print/.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { load } from './lib/build.mjs';
import { decodeFit, jpegBytes, close as closeBrowser } from './lib/browser.mjs';
import { makeApp, photoPath, cleanPath } from './lib/app.mjs';
import { score } from './lib/score.mjs';
import { register } from './lib/register.mjs';
import { apply, homog, makePhoto } from './lib/photo.mjs';
import { PAPER } from './lib/paper.mjs';
import { writePNG, classPicture, truthPicture, greyToRGB, sideBySide } from './lib/png.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const argv = process.argv.slice(2),
  has = (f) => argv.includes(f),
  arg = (f, d) => {
    const i = argv.indexOf(f);
    return i >= 0 ? argv[i + 1] : d;
  };
const OUT = path.resolve(
  arg('--out', process.env.BENCH_OUT || path.join(os.tmpdir(), 'marker-studio-bench')),
);
if (OUT.startsWith(ROOT + path.sep)) {
  console.error('--out must be outside the repo');
  process.exit(2);
}
const PDIR = path.join(OUT, 'print'),
  CACHE = path.join(OUT, 'cache', 'print');
if (!fs.existsSync(path.join(PDIR, 'layout.json'))) {
  console.error('run print.mjs first (no ' + path.join(PDIR, 'layout.json') + ')');
  process.exit(2);
}
const layout = JSON.parse(fs.readFileSync(path.join(PDIR, 'layout.json'), 'utf8')).pages;
const sheets = {};
const sheet = (n) => sheets[n] || (sheets[n] = load(path.join(CACHE, `p${n}.gz`)));
const log = (s) => console.log(s);

// the self-test: stand-in photos of the sheets (two turned a quarter, two on the light desk, one dim with an arm)
async function selftest(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const looks = [
    { bg: 'darkwood', tilt: 8, yaw: 3, roll: 2, size: 0.8, light: 0.15, blur: 0.8, noise: 2 },
    { bg: 'wood', tilt: 22, yaw: -8, roll: -4, size: 0.72, light: 0.25, blur: 1, noise: 3, sharpen: 0.3 },
    { bg: 'cloth', tilt: 12, yaw: 6, roll: 91, size: 0.74, light: 0.2, blur: 1, noise: 3, W: 2400, H: 1800 },
    { bg: 'desk', tilt: 10, yaw: 4, roll: 3, size: 0.78, light: 0.18, blur: 1, noise: 3 },
    {
      bg: 'darkwood',
      tilt: 18,
      yaw: -5,
      roll: -2,
      size: 0.7,
      light: 0.45,
      shadow: [0.6, 0.4, 0.35, 0.45],
      arm: 0.9,
      blur: 1.2,
      noise: 5,
    },
    { bg: 'wood', tilt: 6, yaw: 2, roll: 178, size: 0.8, light: 0.15, blur: 0.8, noise: 2 },
    { bg: 'desk', tilt: 25, yaw: 8, roll: -6, size: 0.66, light: 0.3, blur: 1.2, motion: 4, noise: 4 },
    {
      bg: 'cloth',
      tilt: 14,
      yaw: -6,
      roll: -89,
      size: 0.75,
      light: 0.2,
      blur: 1,
      noise: 3,
      W: 2400,
      H: 1800,
    },
  ];
  const truthC = {};
  for (const L of layout) {
    const s = sheet(L.n),
      m = s.meta,
      o = { ...looks[L.n - 1], seed: 100 + L.n };
    const ph = makePhoto({ W: m.W, H: m.H, input: s.input, rgb: m.rgb }, o);
    const f = `selftest-p${L.n}.jpg`;
    fs.writeFileSync(path.join(dir, f), await jpegBytes(ph.W, ph.H, ph.d, 0.9));
    truthC[f] = { C: ph.C.map((p) => p.map((v) => +v.toFixed(1))), n: L.n };
  }
  fs.writeFileSync(path.join(dir, 'selftest-truth.json'), JSON.stringify(truthC));
  return truthC;
}

const IN = has('--selftest') ? path.join(PDIR, 'selftest') : arg('--in');
if (!IN) {
  console.error('--in <folder> or --selftest');
  process.exit(2);
}
const expect = has('--selftest') ? await selftest(IN) : null;
fs.mkdirSync(path.join(PDIR, 'pics'), { recursive: true });
const t = makeApp(),
  rows = [];
const files = fs
  .readdirSync(IN)
  .filter((f) => /\.(jpe?g|png)$/i.test(f))
  .sort();
for (const f of files) {
  const bytes = fs.readFileSync(path.join(IN, f));
  if (/\.hei[cf]$/i.test(f)) {
    rows.push({ file: f, ok: false, why: 'HEIC: set Camera › Formats to Most Compatible' });
    continue;
  }
  // (--decode N: the photo decoded up to N px instead of the app's working size, 2400: what straightening from more of
  // the photo's pixels would give)
  const img = await decodeFit(bytes, +arg('--decode', 2400));
  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  let f35 = 0;
  try {
    f35 = t.pgExifFocal(ab) || 0;
  } catch (e) {
    f35 = 0;
  }
  const reg = register(img);
  if (!reg.ok) {
    rows.push({ file: f, ok: false, why: reg.why, W: img.W, H: img.H });
    log(`${f}: not registered (${reg.why})`);
    continue;
  }
  const s = sheet(reg.n),
    m = s.meta,
    PX = m.W / PAPER.w;
  const Hinv = homog(reg.C, [
    [0, 0],
    [m.W, 0],
    [m.W, m.H],
    [0, m.H],
  ]);
  const ph = {
    W: img.W,
    H: img.H,
    d: img.d,
    C: reg.C,
    toPage: (x, y) => {
      const [u, v] = apply(Hinv, x, y);
      return u >= 0 && v >= 0 && u < m.W && v < m.H ? [u, v] : null;
    },
  };
  const row = {
    file: f,
    ok: true,
    n: reg.n,
    page: layout.find((L) => L.n === reg.n).page,
    turn: reg.turn,
    f35,
    W: img.W,
    H: img.H,
    orig: [img.ow, img.oh],
    runs: {},
  };
  if (expect && expect[f])
    row.regErr = +(
      (Math.max(...reg.C.map((p, i) => Math.hypot(p[0] - expect[f].C[i][0], p[1] - expect[f].C[i][1]))) /
        Math.hypot(img.W, img.H)) *
      100
    ).toFixed(3);
  // clean: the sheet itself at 1200, for comparison
  if (!rows.some((r) => r.n === reg.n && r.clean)) {
    const rc = cleanPath(t, s),
      sc = score(m, s.truth, rc, { pxPerMm: m.W / PAPER.w });
    row.clean = summary(sc);
  }
  for (const [variant, o] of [
    ['lens', { f35: f35 || 25 }],
    ['noLens', { f35: 0 }],
    ['asTaken', { path: 'none' }],
  ]) {
    const res = photoPath(t, ph, s, { ...o, unsure: true });
    const sc = score(res.meta, res.truth, res.r, {
      ...(res.path === 'none' ? { inPage: res.inPage } : { edgeBand: 6 }),
      list: has('--list'),
      // (the flat page's scale; as taken, the photo's frame isn't the page: no mm there)
      pxPerMm: res.path === 'none' ? 0 : res.meta.W / PAPER.w,
    });
    row.runs[variant] = { path: res.path, finder: res.finder, ...summary(sc) };
    // (--list: each defect, for looking into what a page loses; with the page's px per mm)
    if (has('--list') && variant === 'lens')
      row.runs[variant].defectList = { pxPerMm: res.meta.W / PAPER.w, list: sc.defectList };
    if (variant !== 'noLens') {
      const k = Math.max(1, Math.round(Math.max(res.meta.W, res.meta.H) / 900)),
        nn = res.meta.W * res.meta.H;
      const sb = sideBySide(
        [
          greyToRGB(res.r.gray, nn),
          truthPicture(res.meta, res.truth),
          classPicture(res.meta, res.truth, res.r, sc),
        ],
        res.meta.W,
        res.meta.H,
        k,
      );
      writePNG(path.join(PDIR, 'pics', `${f.replace(/\.\w+$/, '')}-${variant}.png`), sb.W, sb.H, sb.rgb);
    }
  }
  rows.push(row);
  const L1 = row.runs.lens;
  log(
    `${f}: page ${reg.n} (${row.page}), turn ${reg.turn}${row.regErr != null ? `, registration off by ${row.regErr}% of the diagonal` : ''}; finder ${L1.finder.tier} ${L1.finder.cornerErr}%; matched ${(100 * L1.matchedShare).toFixed(1)}%, defects ${L1.defects}`,
  );
}
await closeBrowser();
function summary(sc) {
  return {
    matchedShare: +sc.matchedShare.toFixed(4),
    defects: sc.defects,
    defectArea: sc.defectArea,
    defect: sc.counts.defect,
    spurious: sc.spurious,
    spuriousBy: sc.spuriousBy,
    warn: sc.warn.code,
    surround: sc.surround,
  };
}
fs.writeFileSync(path.join(PDIR, 'photo-results.json'), JSON.stringify(rows, null, 1));
// the report
const pc = (v) => (v == null ? '–' : (100 * v).toFixed(1) + '%');
const L = [
  '# Printed set: photos',
  '',
  `${rows.length} photos, ${rows.filter((r) => r.ok).length} registered. Finder: tier and corner error against the squares (% of the diagonal); lens: the photo's own (EXIF) or 25 mm; sections as in stage A (matched · defects (area) · spurious).`,
  '',
];
L.push(
  '| photo | page | lens | finder (lens) | aspect err lens / no lens | sheet clean | photo, as the app goes | as taken | main defects |',
  '|---|---|---|---|---|---|---|---|---|',
);
for (const r of rows) {
  if (!r.ok) {
    L.push(`| ${r.file} | – | – | not registered: ${r.why} | | | | | |`);
    continue;
  }
  const a = r.runs.lens,
    b = r.runs.noLens,
    c = r.runs.asTaken,
    cl = rows.find((x) => x.n === r.n && x.clean);
  const cell = (s) => `${pc(s.matchedShare)} · ${s.defects} (${pc(s.defectArea)}) · ${s.spurious}`;
  L.push(
    `| ${r.file} | ${r.n} ${r.page} | ${r.f35 || '25?'} | ${a.finder.tier} ${a.finder.cornerErr ?? '–'}% | ${a.finder.aspectErr ?? '–'}% / ${b.finder.aspectErr ?? '–'}% | ${cl ? cell(cl.clean) : '–'} | ${a.path}: ${cell(a)} | ${cell(c)} | ${
      Object.entries(a.defect)
        .sort((x, y) => y[1] - x[1])
        .slice(0, 3)
        .map(([k, v]) => `${k} ${v}`)
        .join(', ') || '–'
    } |`,
  );
}
if (expect)
  L.push(
    '',
    `Self-test: registration error ${rows
      .filter((r) => r.ok)
      .map((r) => r.regErr + '%')
      .join(
        ', ',
      )}; pages read ${rows.filter((r) => r.ok && expect[r.file] && expect[r.file].n === r.n).length} of ${files.length} right.`,
  );
fs.writeFileSync(path.join(PDIR, 'photo-report.md'), L.join('\n') + '\n');
log(`\nreport ${path.join(PDIR, 'photo-report.md')}`);
