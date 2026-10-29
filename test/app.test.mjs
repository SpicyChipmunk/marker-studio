// The app as a whole: build, CI, format, PWA, speed, text size, release, feedback.
// (v320) Tests organised by feature: each block below came from the file named above it, its tests unchanged.
import { createHash } from 'node:crypto';
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import fs, { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { build } from '../scripts/build.mjs';
import { spawnSync } from 'node:child_process';
import { partFiles } from '../e2e/ci-parts.mjs';
import { pwImageCheck } from '../e2e/ci-pw-image.mjs';
import { tmpdir } from 'node:os';
import path, { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as prettier from 'prettier';
import { app as shared, core, createApp, memoryStorage } from './harness.mjs';
import { convertSource, convertStyle, sizeFor } from '../scripts/textsize-codemod.mjs';
import vm from 'node:vm';

// ---- from build.test.mjs ----
// index.html is generated from src/ (npm run build). This keeps the two from drifting:
// if it fails, someone edited index.html directly or forgot to rebuild after editing src/.
{
  test('index.html is up to date with src/ (run: npm run build)', () => {
    const built = build(),
      shipped = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    assert.ok(built === shipped, 'index.html differs from a fresh build of src/');
  });
}

// ---- from ci-install.test.mjs ----
// The CI's browser installs: kept between runs, and a stalled install stopped and tried again (e2e/ci-try.sh), so
// one slow download can't run a part out of time (a WebKit part's install once took 38 minutes).
{
  const root = new URL('../', import.meta.url);
  const read = (f) => readFileSync(new URL(f, root), 'utf8');
  const tryRun = (...a) =>
    spawnSync('bash', ['e2e/ci-try.sh', ...a], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, CI_TRY_PAUSE: '0' },
    });
  test('test.yml: Chromium kept between runs on the Playwright version, each install tried up to 3 times (the libraries 4, with apt retrying stalls); WebKit in Playwright’s own image, nothing installed (v323.1)', () => {
    const wf = read('.github/workflows/test.yml');
    assert.ok(!/--with-deps/.test(wf), 'no installs left without the retry');
    assert.match(
      wf,
      new RegExp(
        String.raw`uses: actions/cache@v\d+\n\s+with:\n\s+path: ~/\.cache/ms-playwright\n\s+key: playwright-\$\{\{ runner\.os \}\}-24\.04-chromium-\$\{\{ steps\.pw\.outputs\.v \}\}`,
      ),
    );
    assert.ok(wf.includes('run: bash e2e/ci-try.sh 3 300 npx playwright install chromium\n'));
    assert.ok(wf.includes('run: bash e2e/ci-try.sh 4 300 npx playwright install-deps chromium\n'));
    assert.equal(wf.match(/require\('playwright\/package\.json'\)\.version/g).length, 1);
    // (v319) apt's own retries, set before the library install
    assert.equal(wf.match(/Acquire::Retries "5";.*Acquire::https::Timeout "30";.*80-ci-retries/g).length, 1);
    // WebKit: the image, its version checked first, and no installs or apt
    const wk = wf.slice(wf.indexOf('\n  webkit:'));
    assert.match(
      wk,
      /container:\n\s+image: mcr\.microsoft\.com\/playwright:v[\d.]+-noble\n\s+options: --user 1001\n/,
    );
    assert.ok(wk.includes('run: node e2e/ci-pw-image.mjs'));
    assert.ok(!/playwright install|apt\.conf|sudo /.test(wk), 'nothing installed in the WebKit jobs');
  });
  test('ci-try.sh: a command that works runs once', () => {
    const r = tryRun('3', '5', 'bash', '-c', 'echo ran');
    assert.equal(r.status, 0);
    assert.equal(r.stdout.match(/ran/g).length, 1);
    assert.ok(!r.stdout.includes('::warning::'));
  });
  test('ci-try.sh: a stalled command is stopped at the limit and tried again; one that keeps failing fails', () => {
    const t = Date.now();
    const r = tryRun('2', '1', 'sleep', '30');
    assert.equal(r.status, 1);
    assert.ok(Date.now() - t < 10000, 'stopped, not waited out');
    assert.equal(r.stdout.match(/::warning::sleep 30 failed or took over 1s \(try \d of 2\)/g).length, 2);
  });
  test('ci-try.sh: a try that fails is followed by one that works', () => {
    const f = `/tmp/ci-try-${process.pid}`;
    const r = tryRun(
      '3',
      '5',
      'bash',
      '-c',
      `if [ -e ${f} ]; then rm ${f}; echo second; else touch ${f}; exit 1; fi`,
    );
    assert.equal(r.status, 0);
    assert.match(r.stdout, /try 1 of 3[\s\S]*second/);
  });
  test('ci-try.sh (v319): waits before the next try, longer each time, and not after the last', () => {
    const t = Date.now();
    const r = spawnSync('bash', ['e2e/ci-try.sh', '3', '5', 'false'], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, CI_TRY_PAUSE: '1' },
    });
    const ms = Date.now() - t;
    assert.equal(r.status, 1);
    assert.ok(ms >= 2900 && ms < 6000, 'paused 1 s then 2 s, none after the last try: ' + ms);
  });
}

// ---- from ci-parts.test.mjs ----
// e2e/ci-parts.mjs: every browser test file runs in exactly one CI part, and the parts take about as long.
{
  const all = readdirSync(new URL('../e2e', import.meta.url))
    .filter((f) => f.endsWith('.test.mjs'))
    .sort()
    .map((f) => 'e2e/' + f);
  const table = JSON.parse(readFileSync(new URL('../e2e/ci-durations.json', import.meta.url), 'utf8'));
  for (const [engine, n] of [
    ['webkit', 10],
    ['chromium', 2],
  ]) {
    test(`${engine}: each test file in exactly one of ${n} parts, the parts within 25% of each other`, () => {
      const parts = Array.from({ length: n }, (_, i) => partFiles(engine, i + 1, n));
      assert.deepEqual(parts.flat().sort(), all);
      const secs = parts.map((p) => p.reduce((s, f) => s + (table[engine][f.slice(4)] ?? 30), 0));
      assert.ok(Math.max(...secs) <= Math.min(...secs) * 1.25, secs.join(', '));
      assert.deepEqual(partFiles(engine, 1, n), parts[0], 'the same files every time');
    });
  }
}

// ---- from ci-summary.test.mjs ----
// e2e/ci-summary.mjs (v318.1): a test whose browser page crashed (noted by e2e/helpers.mjs in the CI record, with the
// free memory then) is said to be the browser's crash, not the test's, as a flaky test or as a failure; others as before.
{
  const root = new URL('../', import.meta.url);
  // (a folder of one test file, so it's the only one expected)
  const dir = mkdtempSync(join(tmpdir(), 'ci-summary-e2e-'));
  writeFileSync(join(dir, 'x.test.mjs'), '');
  after(() => rmSync(dir, { recursive: true, force: true }));
  const F = dir + '/x.test.mjs';
  const lines = (rs) => rs.map((r) => JSON.stringify(r)).join('\n') + '\n';
  const fail = (name) => ({
    ev: 'fail',
    file: F,
    name,
    nesting: 0,
    ms: 9000,
    error: 'page.evaluate: Target page, context or browser has been closed',
  });
  const pass = (name) => ({ ev: 'pass', file: F, name, nesting: 0, ms: 9000 });
  const crash = (name) => ({ ev: 'crash', file: F, name, engine: 'webkit', free: 9876 });
  function summary(first, retry) {
    const d = mkdtempSync(join(tmpdir(), 'ci-summary-'));
    try {
      writeFileSync(join(d, 'rec.jsonl'), lines(first));
      if (retry) writeFileSync(join(d, 'retry.jsonl'), lines(retry));
      const env = { ...process.env, GITHUB_ACTIONS: '1', E2E_RETRY: retry ? join(d, 'retry.jsonl') : '' };
      delete env.GITHUB_STEP_SUMMARY;
      const r = spawnSync(
        process.execPath,
        ['e2e/ci-summary.mjs', join(d, 'rec.jsonl'), 'WebKit', 'all', dir],
        { cwd: root, env, encoding: 'utf8' },
      );
      assert.equal(r.status, 0, r.stderr);
      return r.stdout;
    } finally {
      rmSync(d, { recursive: true, force: true });
    }
  }
  test('a flaky test whose page crashed says so, with the free memory; a crash isn’t counted as a test', () => {
    const out = summary([pass('a'), crash('b'), fail('b'), fail('c')], [pass('b'), pass('c')]);
    const warn = out.split('\n').filter((l) => l.startsWith('::warning') && l.includes('flaky'));
    assert.equal(warn.length, 2);
    assert.match(
      warn.find((l) => l.includes('::b:')),
      /failed once \(the browser's page process crashed, not the test \(WebKit; 9876 MB free then\): page\.evaluate/,
    );
    assert.ok(!warn.find((l) => l.includes('::c:')).includes('crashed'), 'another flaky test as before');
    assert.match(out, /\*\*3 passed · 0 failed · 0 skipped · 2 flaky \(passed on a retry\)\*\*/);
  });
  test('a failure whose page crashed says so too', () => {
    const out = summary([crash('b'), fail('b')], [crash('b'), fail('b')]);
    assert.match(out, /x\.test\.mjs \| b \| 9\.0 s \| the browser's page process crashed, not the test/);
    assert.match(out, /\*\*0 passed · 1 failed/);
  });
}

// ---- from format.test.mjs ----
// The app's JS and CSS stay formatted with the pinned Prettier and the repo's .prettierrc/.prettierignore,
// the same check as `npm run format:check`. If it fails, run `npm run format` and commit the result.
{
  const ROOT = fileURLToPath(new URL('..', import.meta.url));
  const IGNORE = join(ROOT, '.prettierignore');
  const walk = (dir, ext) =>
    readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
      d.isDirectory() ? walk(join(dir, d.name), ext) : d.name.endsWith(ext) ? [join(dir, d.name)] : [],
    );
  test('src/js and src/css are formatted with Prettier (run: npm run format)', async () => {
    const files = [...walk(join(ROOT, 'src/js'), '.js'), ...walk(join(ROOT, 'src/css'), '.css')];
    assert.ok(files.length > 40, `expected the app's JS and CSS files, found ${files.length}`);
    const bad = [];
    let checked = 0;
    for (const file of files) {
      const info = await prettier.getFileInfo(file, { ignorePath: IGNORE });
      if (info.ignored) continue;
      const options = await prettier.resolveConfig(file, { editorconfig: true });
      if (!(await prettier.check(readFileSync(file, 'utf8'), { ...options, filepath: file }))) {
        bad.push(relative(ROOT, file));
      }
      checked++;
    }
    assert.equal(checked, files.length, 'no src/js or src/css file should be in .prettierignore');
    assert.deepEqual(bad, [], `not formatted (run: npm run format):\n  ${bad.join('\n  ')}`);
  });
}

// ---- from pwa.test.mjs ----
// The app must stay installable: manifest + icons exist, match their declared sizes,
// and the service worker precaches them.
{
  const root = new URL('../', import.meta.url);
  const read = (f) => readFileSync(new URL(f, root));
  test('manifest is valid and its icons exist at the declared sizes', () => {
    const m = JSON.parse(read('manifest.webmanifest'));
    assert.equal(m.display, 'standalone');
    assert.ok(m.start_url && m.name);
    const sizes = new Set();
    for (const ic of m.icons) {
      const png = read(ic.src);
      assert.equal(png.toString('ascii', 1, 4), 'PNG', ic.src);
      const w = png.readUInt32BE(16),
        h = png.readUInt32BE(20);
      assert.equal(`${w}x${h}`, ic.sizes, ic.src);
      sizes.add(ic.sizes);
    }
    assert.ok(sizes.has('192x192') && sizes.has('512x512'), 'Chrome needs 192 and 512');
    assert.ok(
      m.icons.some((i) => i.purpose === 'maskable'),
      'a maskable icon for Android',
    );
  });
  test('index.html links the manifest and the service worker precaches it', () => {
    const html = read('index.html').toString();
    assert.match(html, /<link rel="manifest" href="manifest\.webmanifest">/);
    const sw = read('service-worker.js').toString();
    assert.match(html, /<link rel="apple-touch-icon" href="apple-touch-icon.png">/);
    for (const f of [
      'manifest.webmanifest',
      'icon-192.png',
      'icon-512.png',
      'icon-maskable-512.png',
      'apple-touch-icon.png',
    ])
      assert.ok(sw.includes(f), f);
  });
  test('the version shown on Home matches the service-worker cache version', () => {
    const html = read('index.html').toString();
    const shown = html.match(/id="appVer"[^>]*>(v\d+(?:\.\d+)?)</)[1];
    const cache = read('service-worker.js')
      .toString()
      .match(/marker-studio-(v\d+(?:\.\d+)?)/)[1];
    assert.equal(shown, cache, 'bump both together on each release');
  });
  // v315: PDF.js's version is written in two places, the app (21-pdf.js) and the service worker (its own cache, kept from
  // one release to the next), and its files sit in a folder of that name: bumped in one only, the files would fall into
  // the app's cache and be fetched again every release
  test('PDF.js: the same version in the app, the service worker and the vendor folder', () => {
    const app = read('src/js/guide/21-pdf.js')
        .toString()
        .match(/PDFJS_VER = '([\d.]+)'/),
      sw = read('service-worker.js')
        .toString()
        .match(/PDFJS='([\d.]+)'/);
    assert.ok(app && sw, 'both say a version');
    assert.equal(sw[1], app[1], 'the service worker’s PDF.js is the app’s');
    for (const f of ['pdf.min.mjs', 'pdf.worker.min.mjs'])
      assert.ok(read(`vendor/pdfjs/${app[1]}/${f}`).length > 1000, f);
    assert.match(read('service-worker.js').toString(), /PDFC='marker-studio-pdfjs-'\+PDFJS/);
  });
}

// ---- from speed.test.mjs ----
// Unit checks for the speed work: packed undo snapshots round-trip exactly and stay small,
// and the section-map signature notices any change.
{
  // (v320: an app of its own, as when this was a file of its own)
  const _app = createApp(),
    core = _app.__mstest;
  test('undo snapshots pack the section map and unpack it exactly', () => {
    const W = 300,
      H = 200,
      a = new Int32Array(W * H);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++)
        a[y * W + x] = x % 50 === 0 || y % 40 === 0 ? -1 : 1 + ((x / 50) | 0) + 6 * ((y / 40) | 0);
    const p = core.packLabels(a);
    assert.ok(p.z.length * 4 < (a.length * 4) / 10, 'packed well under a tenth of the size');
    const b = core.unpackLabels(p);
    assert.equal(b.length, a.length);
    assert.ok(
      a.every((v, i) => v === b[i]),
      'identical after unpacking',
    );
    // edge cases: empty, one value, all different
    assert.equal(core.unpackLabels(core.packLabels(new Int32Array(0))).length, 0);
    const one = core.unpackLabels(core.packLabels(new Int32Array(7).fill(3)));
    assert.deepEqual([...one], [3, 3, 3, 3, 3, 3, 3]);
    const mixed = Int32Array.from([1, 2, 3, -1, -1, 4]);
    assert.deepEqual([...core.unpackLabels(core.packLabels(mixed))], [...mixed]);
  });
  test('the section-map signature changes when any single pixel changes', () => {
    core.W = 64;
    core.H = 48;
    core.labels = new Int32Array(64 * 48).fill(2);
    const s1 = core.labelsSig();
    core.labels[1234] = 3;
    const s2 = core.labelsSig();
    core.labels[1234] = 2;
    core.labels[1235] = 3;
    const s3 = core.labelsSig();
    // swapping two values between positions must not collide either
    core.labels[1235] = 2;
    core.labels[10] = 5;
    core.labels[11] = 6;
    const s4 = core.labelsSig();
    core.labels[10] = 6;
    core.labels[11] = 5;
    const s5 = core.labelsSig();
    assert.equal(new Set([s1, s2, s3, s4, s5]).size, 5);
  });
  test('v329: a Build reads the section map once (the signature held), and an edit meanwhile drops it', () => {
    core.W = 64;
    core.H = 48;
    core.labels = new Int32Array(64 * 48).fill(2);
    const n0 = core.labelsSigN;
    core.labelsSigWarm(true);
    const s1 = core.labelsSig(),
      s2 = core.labelsSig(),
      s3 = core.labelsSig();
    assert.equal(core.labelsSigN - n0, 1, 'one pass over the map for the held signature');
    assert.ok(s1 === s2 && s2 === s3);
    // an edit in place, told (labelsEdited): worked out afresh
    core.labels[99] = 4;
    core.labelsEdited();
    const s4 = core.labelsSig();
    assert.notEqual(s4, s1);
    assert.equal(core.labelsSigN - n0, 2);
    // after the Build, not held: a change in place without labelsEdited is still noticed
    core.labelsSigWarm(true);
    core.labelsSigDone();
    core.labels[100] = 5;
    assert.notEqual(core.labelsSig(), s4);
    // the old warm (not held) is taken once
    core.labelsSigWarm();
    const n1 = core.labelsSigN;
    core.labelsSig();
    assert.equal(core.labelsSigN, n1, 'taken from the warm');
    core.labelsSig();
    assert.equal(core.labelsSigN, n1 + 1, 'then gone');
  });
}

// ---- from text-size.test.mjs ----
// Text size follows the phone's setting: the inline-style codemod (scripts/textsize-codemod.mjs) and the CSS rule
// that every font size goes through the type scale, so nothing is left at a fixed pixel size by accident.
{
  test('the codemod maps pixel sizes onto the type scale, never below 12px', () => {
    assert.equal(sizeFor(13), 'var(--t-base)');
    assert.equal(sizeFor(14), 'var(--t-md)');
    assert.equal(sizeFor(9), 'var(--t-sm)');
    assert.equal(sizeFor(15), 'calc(15*var(--tpx))');
    assert.equal(
      convertStyle('color:red;font-size:11px;height:46px;line-height:20px'),
      'color:red;font-size:var(--t-sm);min-height:46px;line-height:20px',
    );
    assert.equal(convertStyle('font:700 18px/1.2 sans-serif'), 'font:700 calc(18*var(--tpx))/1.2 sans-serif');
    // a box with no text size set keeps its fixed height (a swatch, a dot)
    assert.equal(
      convertStyle('width:10px;height:10px;background:#fff'),
      'width:10px;height:10px;background:#fff',
    );
  });
  test('the codemod rewrites inline styles only, and a second run changes nothing', () => {
    const src = `h+='<div style="font-size:10px;height:40px">'+x+'</div>';ctx.font='700 12px sans-serif';el.style.fontSize='14px';svg='<text font-size="9">';`;
    const once = convertSource(src);
    assert.equal(
      once,
      `h+='<div style="font-size:var(--t-sm);min-height:40px">'+x+'</div>';ctx.font='700 12px sans-serif';el.style.fontSize='var(--t-md)';svg='<text font-size="9">';`,
    );
    assert.equal(convertSource(once), once);
  });
  test('the codemod finds inline sizes in Prettier-formatted source too (line breaks after = and +)', () => {
    const src = `el.style.cssText =\n  'color:red;font-size:10px';\nh +=\n  '<div style="font:700 18px/1.2 x">' +\n  x;\nb.style.fontSize = '14px';\n`;
    assert.equal(
      convertSource(src),
      `el.style.cssText =\n  'color:red;font-size:var(--t-sm)';\nh +=\n  '<div style="font:700 calc(18*var(--tpx))/1.2 x">' +\n  x;\nb.style.fontSize = 'var(--t-md)';\n`,
    );
  });
  test('src/js and src/html are already converted (run: node scripts/textsize-codemod.mjs)', () => {
    const root = new URL('../src/', import.meta.url);
    const walk = (u) =>
      readdirSync(u, { withFileTypes: true }).flatMap((d) =>
        d.isDirectory()
          ? walk(new URL(d.name + '/', u))
          : /\.(js|html)$/.test(d.name)
            ? [new URL(d.name, u)]
            : [],
      );
    for (const f of [...walk(new URL('js/', root)), ...walk(new URL('html/', root))]) {
      const s = readFileSync(f, 'utf8');
      assert.equal(convertSource(s), s, f.pathname);
    }
  });
  test('CSS font sizes go through the type scale (plain px only for fixed badges and drawings)', () => {
    const dir = new URL('../src/css/', import.meta.url);
    const allowed = new Set(['12px']); // badges on swatches, zone numbers on the picture: fixed geometry, 12px minimum
    for (const f of readdirSync(dir)) {
      const css = readFileSync(new URL(f, dir), 'utf8');
      for (const m of css.matchAll(/font-size:\s*([\d.]+(?:px|rem))/g))
        assert.ok(allowed.has(m[1]), `${f}: font-size:${m[1]}`);
    }
  });
  // (v323.1) GitHub's WebKit jobs run in Playwright's own image: its tag must be the Playwright installed, pinned exactly
  test('the WebKit jobs’ Playwright image is the Playwright version installed, pinned in package.json', () => {
    assert.deepEqual(pwImageCheck(new URL('../', import.meta.url)), []);
  });
  // (v323) a var() naming a custom property defined nowhere silently falls back (or inherits): --t-xs, gone since
  // v284, had left three labels unscaled or at the wrong size
  test('every CSS custom property used is defined somewhere (CSS, or set from the script)', () => {
    const src = new URL('../src/', import.meta.url);
    const walk = (u) =>
      readdirSync(u, { withFileTypes: true }).flatMap((d) =>
        d.isDirectory()
          ? walk(new URL(d.name + '/', u))
          : /\.(css|js|html)$/.test(d.name)
            ? [new URL(d.name, u)]
            : [],
      );
    const all = walk(src)
      .map((f) => readFileSync(f, 'utf8'))
      .join('\n');
    const defined = new Set([...all.matchAll(/(--[\w-]+)\s*['"]?\s*[:,]/g)].map((m) => m[1]));
    const missing = [...new Set([...all.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]))].filter(
      (n) => !defined.has(n),
    );
    assert.deepEqual(missing, []);
  });
}

// ---- from v306-welcome.test.mjs ----
// v306 (welcome branch): the welcome's picture. Its coloured guide without codes is a small picture of its own, the
// sample page's shape; it is in the app once; the flood and its undoing move in step; nothing runs over 15 s; reduced
// motion stops it; it shows only on a tall enough screen.
{
  const src = (p) => new URL('../src/' + p, import.meta.url);
  const css = readFileSync(src('css/07-home-onboarding.css'), 'utf8');
  // a WebP's size (lossy VP8, or VP8L / VP8X)
  function webpSize(b) {
    assert.equal(b.toString('ascii', 0, 4), 'RIFF');
    assert.equal(b.toString('ascii', 8, 12), 'WEBP');
    const k = b.toString('ascii', 12, 16);
    if (k === 'VP8 ') return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
    if (k === 'VP8L') {
      const v = b.readUInt32LE(21);
      return [(v & 0x3fff) + 1, ((v >> 14) & 0x3fff) + 1];
    }
    return [b.readUIntLE(24, 3) + 1, b.readUIntLE(27, 3) + 1];
  }
  function pngSize(b) {
    return [b.readUInt32BE(16), b.readUInt32BE(20)];
  }
  // a @keyframes block's selectors and declarations: { '15.38%': 'transform: none; opacity: 1', ... }
  function frames(name) {
    const m = css.match(new RegExp('@keyframes ' + name + ' \\{([\\s\\S]*?)\\n\\}'));
    assert.ok(m, name);
    const out = {};
    for (const [, sel, body] of m[1].matchAll(/([\d.%,\s]+)\{([^}]*)\}/g)) {
      const decl = body
        .split(';')
        .map((x) => x.trim())
        .filter((x) => x && !x.startsWith('animation-timing-function') && !x.startsWith('opacity'));
      for (const s of sel.split(',')) out[s.trim()] = decl.join('; ');
    }
    return out;
  }
  test('the welcome’s coloured sample: a small WebP, the sample page’s shape, embedded once', () => {
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    // (v320: Ben's two jellyfish and his page of them coloured, lined up with the drawing; the tests' jellyfish keeps
    // its own pair)
    for (const [col, page, kb] of [
      ['sample-dual-coloured.webp', 'sample-dual.png', 56],
      ['sample-plain.webp', 'sample-jellyfish.png', 36],
    ]) {
      const plain = readFileSync(src('assets/' + col)),
        [w, h] = webpSize(plain),
        [pw, ph] = pngSize(readFileSync(src('assets/' + page)));
      assert.ok(plain.length < kb * 1024, col + ' under ' + kb + ' KB (' + plain.length + ')');
      assert.ok(w >= 300 && h > w, w + '×' + h);
      assert.ok(
        Math.abs(w / h - pw / ph) < 0.001,
        'the page’s shape, so the two lie exactly over each other',
      );
      assert.equal(html.split(plain.toString('base64')).length - 1, 1, col + ' in index.html once');
    }
    // the picture's frame takes the sample's shape (SAMPLE_AR), the new sample's by default
    const [pw, ph] = pngSize(readFileSync(src('assets/sample-dual.png')));
    assert.ok(css.includes(`aspect-ratio: var(--wcar, ${pw} / ${ph})`));
  });
  test('the flood’s move and its undoing have the same keyframes, so the guide stays still under its edge', () => {
    const a = frames('wcflood'),
      b = frames('wcflood2');
    assert.deepEqual(Object.keys(a).sort(), Object.keys(b).sort());
    for (const k of Object.keys(a)) {
      if (a[k] === 'transform: none') assert.equal(b[k], 'transform: none', k);
      else {
        assert.equal(a[k], 'transform: translateY(-100%)', k);
        // the layer is 160% of the picture's height: the guide in it moves back by as much
        assert.equal(b[k], 'transform: translateY(160%)', k);
      }
    }
    assert.ok(/\.wcpicin > \.wcfl \{[^}]*top: -30%;[^}]*height: 160%;/.test(css));
    assert.ok(/\.wcard \.wcfl img \{[^}]*top: 18\.75%;[^}]*height: 62\.5%;/.test(css));
  });
  test('every welcome animation ends within 15 s, and none runs with reduced motion', () => {
    const runs = [...css.matchAll(/animation: (wc\w+) ([\d.]+)s(?: ([\d.]+)s)?/g)];
    assert.ok(runs.length >= 4);
    for (const [, n, d, delay] of runs) assert.ok(+d + +(delay || 0) <= 15, n + ' ends by 15 s');
    const rm = css.match(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/g).join('\n');
    for (const s of ['.wcfl,', '.wcfl img,', '.wcfan i'])
      assert.ok(rm.includes(s), s + ' stopped with reduced motion');
  });
  test('the picture shows only from 761 px of height', () => {
    assert.ok(/\.wcpic \{\s*display: none;/.test(css));
    assert.ok(/@media \(min-height: 761px\) \{\s*\.wcpic \{\s*display: block;/.test(css));
  });
}

// ---- from v307-final.test.mjs ----
// v307 (final): a worker job with no answer in time is given up on (the worker stopped for the session, the job done
// on the page, a late answer ignored); "That already looks white" for any white thing tapped.
{
  // (v320: an app of its own, as when this was a file of its own)
  const _app = createApp(),
    shared = _app;
  // an app whose worker only answers when told to (answer), and says whether it was stopped
  function withWorker() {
    const made = [];
    class FakeWorker {
      constructor() {
        this.sent = [];
        this.stopped = false;
        made.push(this);
      }
      postMessage(m) {
        this.sent.push(m);
      }
      terminate() {
        this.stopped = true;
      }
      answer(id, r) {
        this.onmessage({ data: { id, r } });
      }
    }
    const app = createApp({
      Worker: FakeWorker,
      URL: { createObjectURL: () => 'blob:jobs' },
      Blob: function () {},
      setTimeout,
      clearTimeout,
    });
    return { jobs: app.__mstest.jobs, made, app };
  }
  const settle = (p) =>
    p.then(
      (v) => ({ ok: true, v }),
      (e) => ({ ok: false, why: e.message }),
    );
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  test('a job with no answer in time: done on the page instead, the worker stopped for the session, a late answer ignored', async () => {
    const { jobs, made } = withWorker();
    assert.equal(jobs.on, true);
    jobs.hang(40);
    const a = settle(jobs.run('pdf', { n: 4 })),
      b = settle(jobs.run('png', { w: 2, h: 2 }));
    const wk = made[0];
    assert.equal(wk.sent.length, 2);
    assert.ok(
      wk.sent.every((m) => m.hang === true),
      'the test hook asks the worker to answer nothing',
    );
    // the first is due after 40 ms, the second after the first (it may wait on it): the first times out, and the worker
    // is stopped, so the second is done on the page too, at once
    const t0 = Date.now();
    assert.deepEqual(await a, { ok: false, why: 'timed out' });
    assert.ok(Date.now() - t0 >= 30, 'not before it was due');
    assert.deepEqual(await b, { ok: false, why: 'no worker' });
    assert.equal(wk.stopped, true, 'the worker is stopped');
    assert.equal(jobs.on, false, 'and not used again this session');
    assert.deepEqual(JSON.parse(JSON.stringify(jobs.stats.timedOut)), { pdf: 1 });
    // an answer arriving after all that changes nothing
    wk.answer(wk.sent[0].id, { zc: false, b: new Uint8Array(3) });
    wk.answer(wk.sent[1].id, null);
    assert.deepEqual(JSON.parse(JSON.stringify(jobs.stats.done)), {}, 'late answers aren’t counted');
    // later jobs go straight to the page: no new worker
    assert.deepEqual(await settle(jobs.run('lpts', { W: 2, H: 2 })), { ok: false, why: 'no worker' });
    assert.equal(made.length, 1);
  });
  test('a job answered in time isn’t timed out afterwards; jobs queued behind another are given its time too', async () => {
    const { jobs, made } = withWorker();
    jobs.hang(60);
    const a = settle(jobs.run('lmap', { w: 1, h: 1 }));
    const wk = made[0];
    await wait(20);
    wk.answer(wk.sent[0].id, 'data:image/png;base64,');
    assert.deepEqual(await a, { ok: true, v: 'data:image/png;base64,' });
    await wait(80);
    assert.equal(jobs.on, true, 'still on after its time would have run out');
    assert.equal(wk.stopped, false);
    // two at once: the second is due 60 ms after the first is, so answering the first late-ish (at 45 ms) and the
    // second at 100 ms keeps both
    const b = settle(jobs.run('pdf', { n: 1 })),
      c = settle(jobs.run('pdf', { n: 1 }));
    await wait(45);
    wk.answer(wk.sent[1].id, 1);
    await wait(55);
    wk.answer(wk.sent[2].id, 2);
    assert.deepEqual(await b, { ok: true, v: 1 });
    assert.deepEqual(await c, { ok: true, v: 2 });
    assert.equal(jobs.on, true);
    assert.deepEqual(JSON.parse(JSON.stringify(jobs.stats.timedOut)), {});
    // the test hook off: jobs are sent as usual
    jobs.hang(0);
    const d = settle(jobs.run('png', { w: 1, h: 1 }));
    assert.equal(wk.sent[3].hang, undefined);
    wk.answer(wk.sent[3].id, 3);
    assert.deepEqual(await d, { ok: true, v: 3 });
  });
  test('how long a job is given: 4 s, and half a second more per million pixels', () => {
    const budget = withWorker().jobs.budget;
    assert.equal(budget({}), 4000);
    assert.equal(budget({ n: 256 * 256 }), 4033);
    // a PDF page (1700 × 2200): about 6 s
    assert.equal(budget({ n: 1700 * 2200 }), 5870);
    // the saved image, the section map, the label points: by their pictures' sizes
    assert.equal(budget({ w: 2000, h: 1000 }), 5000);
    assert.equal(budget({ W: 1000, H: 1000 }), 4500);
  });
  test('Tap something white: something already white says so, whatever it is', () => {
    const E = (s) => shared.__eval(s),
      spot = E('paperSpot'),
      lin8 = (r, g, b) => [r, g, b].map((v) => E(`srgbToLin(${v})`));
    for (const loose of [false, true]) {
      for (const c of [
        [242, 242, 242],
        [255, 255, 255],
      ]) {
        const r = spot(lin8(...c), loose);
        assert.equal(r.fix, null, String(c));
        assert.equal(r.note, 'That already looks white: nothing to correct.');
        assert.doesNotMatch(r.note, /paper/);
      }
    }
  });
}

// ---- from v307-speed.test.mjs ----
// v307 speed work: the faster code gives exactly what the code it replaced gave (packing a PDF page's pixels, reading a
// saved section map's numbers), and the label points kept for the session are the ones worked out afresh.
{
  // (v320: an app of its own, as when this was a file of its own)
  const _app = createApp(),
    core = _app.__mstest;
  // a made-up RGBA picture, opaque or not
  function pixels(n, seed) {
    const d = new Uint8ClampedArray(n * 4);
    let s = seed;
    for (let i = 0; i < d.length; i++) {
      s = (Math.imul(s, 1103515245) + 12345) | 0;
      d[i] = (s >>> 16) & 255;
    }
    return d;
  }
  // the v306 way of reading a saved section map's numbers (97-open), kept here to compare with
  function oldLabels(data, n) {
    const raw = new Int32Array(n),
      labels = new Int32Array(n);
    for (let i = 0, j = 0; i < n; i++, j += 4) {
      const v = data[j] | (data[j + 1] << 8) | (data[j + 2] << 16);
      raw[i] = v === 0 ? -1 : v - 1;
    }
    const map = Object.create(null);
    let next = 0,
      lo = Infinity,
      hi = 0,
      cnt = 0;
    for (let i = 0; i < n; i++) {
      const r = raw[i];
      if (r < 0 || map[r] !== undefined) continue;
      map[r] = 0;
      cnt++;
      if (r < lo) lo = r;
      if (r > hi) hi = r;
    }
    const own = cnt > 0 && lo >= 1 && hi <= cnt * 2 + 64;
    for (const r in map) map[r] = own ? +r : undefined;
    if (own) next = hi;
    for (let i = 0; i < n; i++) {
      const r = raw[i];
      if (r < 0) {
        labels[i] = -1;
        continue;
      }
      if (map[r] === undefined) map[r] = ++next;
      labels[i] = map[r];
    }
    return { labels, map, next };
  }
  function mapData(vals) {
    const d = new Uint8ClampedArray(vals.length * 4);
    vals.forEach((v, i) => {
      d[i * 4] = v & 255;
      d[i * 4 + 1] = (v >> 8) & 255;
      d[i * 4 + 2] = (v >> 16) & 255;
      d[i * 4 + 3] = 255;
    });
    return d;
  }
  test('PDF pages: RGB packing gives the same bytes as the per-pixel loop it replaced', () => {
    for (const [n, seed] of [
      [1, 1],
      [7, 2],
      [1700 * 3, 3],
      [4099, 4],
    ]) {
      const d = pixels(n, seed),
        old = new Uint8Array(n * 3);
      for (let i = 0, j = 0; i < n; i++) {
        old[j++] = d[i * 4];
        old[j++] = d[i * 4 + 1];
        old[j++] = d[i * 4 + 2];
      }
      const got = core.rgbPack(d, n);
      assert.equal(got.length, n * 3);
      assert.ok(
        old.every((v, i) => v === got[i]),
        `same bytes for ${n} pixels`,
      );
    }
    // a view part-way into a bigger buffer reads only its own pixels
    const big = pixels(20, 9),
      view = new Uint8ClampedArray(big.buffer, 16, 40);
    assert.deepEqual([...core.rgbPack(view, 10)], [...core.rgbPack(new Uint8ClampedArray([...view]), 10)]);
  });
  test('opening a guide: its section numbers are read through a table, the same numbers as before', () => {
    const W = 60,
      H = 40,
      n = W * H,
      cases = {
        // a guide's own numbers, with gaps (sections merged away) and lines
        own: Array.from({ length: n }, (_, i) =>
          i % 13 === 0 ? 0 : 2 + 3 * (((i % W) / 10) | 0) + 20 * ((i / W / 10) | 0),
        ),
        // numbers that aren't a guide's: numbered afresh in the order they're met
        afresh: Array.from({ length: n }, (_, i) => (i % 11 === 0 ? 0 : 1 + 5000 + ((i * 7919) % 97) * 31)),
        // section 0 in the file (a 1 in the red): afresh
        zero: Array.from({ length: n }, (_, i) => 1 + (i % 5)),
        // numbers too big for a table: the object, as before
        huge: Array.from({ length: n }, (_, i) => (i % 3 ? 0x7f0000 + (i % 50) : 0)),
        lines: Array.from({ length: n }, () => 0),
      };
    for (const [name, vals] of Object.entries(cases)) {
      const d = mapData(vals),
        a = oldLabels(d, n),
        b = core.lmapLabels(d, W, H);
      assert.equal(b.next, a.next, name + ': highest number');
      assert.ok(
        a.labels.every((v, i) => v === b.labels[i]),
        name + ': every pixel the same section',
      );
      assert.deepEqual(
        JSON.parse(JSON.stringify(Object.assign({}, b.map))),
        JSON.parse(JSON.stringify(Object.assign({}, a.map))),
        name + ': the file’s numbers map the same way',
      );
      assert.equal(Object.getPrototypeOf(b.map), null, name + ': no prototype to look things up in');
    }
  });
  test('label points: kept for the session are the ones worked out afresh, and a changed section map isn’t mistaken for them', () => {
    const W = 90,
      H = 70,
      K = 1 + 6 * 5;
    const lab = new Int32Array(W * H);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++)
        lab[y * W + x] = x % 15 === 0 || y % 14 === 0 ? -1 : 1 + ((x / 15) | 0) + 6 * ((y / 14) | 0);
    core.W = W;
    core.H = H;
    core.labels = lab;
    core.comps = Array.from({ length: K }, (_, i) => (i ? { area: 1, cx: 0, cy: 0 } : null));
    core.labelPts = null;
    const afresh = core.labelPtsCore(lab, W, H, K);
    core.labelPos(1);
    const first = core.labelPts;
    assert.deepEqual(
      JSON.parse(JSON.stringify(first)),
      JSON.parse(JSON.stringify(afresh.lp)),
      'the same points',
    );
    core.labelPts = null;
    core.labelPos(1);
    assert.equal(core.labelPts, first, 'kept: not worked out again');
    // one pixel moved to another section: worked out again
    const lab2 = lab.slice();
    lab2[W * 20 + 20] = lab2[W * 20 + 50];
    core.labels = lab2;
    core.labelPts = null;
    core.labelPos(1);
    assert.notEqual(core.labelPts, first);
    assert.deepEqual(
      JSON.parse(JSON.stringify(core.labelPts)),
      JSON.parse(JSON.stringify(core.labelPtsCore(lab2, W, H, K).lp)),
    );
  });
}

// ---- from v308-beta.test.mjs ----
// v308 (beta branch): Send feedback's report, the errors kept for Copy details and Copy diagnostics, the device in
// words (an iPad asking for desktop websites included), Delete all my data, the service worker's one copy of the page,
// the release workflow and .nojekyll, the version in package.json, icon credits, and the tester guide's facts.
{
  const root = new URL('../', import.meta.url);
  const read = (f) => readFileSync(new URL(f, root), 'utf8');
  const html = read('index.html');
  const appVer = html.match(/id="appVer"[^>]*>(v\d+(?:\.\d+)?)</)[1];
  // a document whose #appVer says the version; everything else is a do-nothing stub, as in the harness
  function makeStub() {
    let s;
    s = new Proxy(function () {}, {
      get: (t, k) => {
        if (k === 'then' || k === Symbol.iterator) return undefined;
        if (k === Symbol.toPrimitive) return () => 0;
        if (k === 'length') return 0;
        return s;
      },
      apply: () => s,
      construct: () => s,
      set: () => true,
      has: () => true,
    });
    return s;
  }
  const stub = makeStub();
  const doc = new Proxy(
    {},
    {
      get: (t, k) =>
        k === 'getElementById' ? (id) => (id === 'appVer' ? { textContent: appVer } : stub) : stub,
    },
  );
  // Storage with key() and length, as a browser's
  function storage(init = {}) {
    const s = memoryStorage(init);
    s.key = (i) => [...s._map.keys()][i] ?? null;
    Object.defineProperty(s, 'length', { get: () => s._map.size });
    return s;
  }
  const IPAD_DESKTOP =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15';
  function app(o = {}) {
    return createApp({
      localStorage: o.localStorage || storage(),
      document: doc,
      navigator: { userAgent: IPAD_DESKTOP, maxTouchPoints: 5, standalone: true, ...(o.navigator || {}) },
      screen: { width: 820, height: 1180 },
      innerWidth: 820,
      innerHeight: 1100,
      devicePixelRatio: 2,
      ...(o.extra || {}),
    });
  }
  test('the device in words: an iPad asking for desktop websites is named an iPad (by its touch points)', () => {
    const dw = app().__eval('deviceWords');
    assert.equal(dw(IPAD_DESKTOP, 5), 'iPad (shown to websites as a Mac), Safari 18.1');
    assert.equal(dw(IPAD_DESKTOP, 0), 'Mac, Safari 18.1');
    assert.equal(
      dw(
        'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
        5,
      ),
      'iPad (iPadOS 17.4), Safari 17.4',
    );
    assert.equal(
      dw(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0 Mobile/15E148 Safari/604.1',
        5,
      ),
      'iPhone (iOS 18.0), Chrome',
    );
    assert.equal(
      dw(
        'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36',
        5,
      ),
      'Android 14 phone, Chrome 129',
    );
    assert.equal(
      dw(
        'Mozilla/5.0 (Linux; Android 13; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        10,
      ),
      'Android 13 tablet, Chrome 128',
    );
    assert.equal(
      dw(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0',
        0,
      ),
      'Windows, Edge',
    );
    assert.equal(dw('', 0), 'Unknown device');
  });
  test('caught errors are kept, the last 10, across a reload; Copy details has the device, screen and Home Screen', () => {
    const ls = storage();
    const a = app({ localStorage: ls });
    for (let i = 0; i < 12; i++) a.__eval(`errLog('Opening a guide', new Error('broke ${i}'))`);
    assert.equal(JSON.parse(ls.getItem('ms-errors')).length, 10);
    // a new visit sees them
    const b = app({ localStorage: ls });
    const d = b.__eval('errDetails()');
    assert.ok(d.startsWith(`Marker Studio ${appVer} · Beta\n`), d.slice(0, 60));
    assert.match(d, /\nDevice: iPad \(shown to websites as a Mac\), Safari 18\.1\n/);
    assert.match(d, /\nHome Screen app: yes\n/);
    assert.match(d, /\nScreen: 820×1180, window 820×1100, 2× pixels, touch points 5\n/);
    assert.match(d, /\nSaved here: \d+ markers, 0 guides, 0 palettes\n/);
    assert.ok(d.includes('Browser: ' + IPAD_DESKTOP));
    assert.ok(!d.includes('broke 1\n') && d.includes('broke 2') && d.includes('broke 11'), 'the last ten');
    assert.match(d, /· Opening a guide\nbroke 11\nError: broke 11/, 'where, what and its stack');
    // an error the net catches is kept too, after the caught ones
    b.__eval(`errReport('x is not a function', 'http://127.0.0.1/', 12, 3, '')`);
    assert.match(b.__eval('errDetails()'), /x is not a function\nSource: http:\/\/127\.0\.0\.1\/:12:3$/);
    // a Home Screen app or not
    assert.match(app({ navigator: { standalone: false } }).__eval('errDetails()'), /\nHome Screen app: no\n/);
  });
  test('storage that can’t be written: errors are kept for this visit', () => {
    const ls = storage();
    ls.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    const a = app({ localStorage: ls });
    a.__eval(`errLog('Saving the image', 'it couldn’t be encoded')`);
    assert.match(a.__eval('errDetails()'), /Saving the image\nit couldn’t be encoded/);
  });
  test('a caught error’s message gets Copy details and Send feedback; the raw error isn’t shown', () => {
    const a = app();
    const m = a.__eval(
      `errNote('Couldn’t open that guide.', 'Opening a guide', new TypeError("null is not an object (evaluating 'd.x')"))`,
    );
    assert.ok(m.startsWith('Couldn’t open that guide. <span class="errbtns">'), m);
    assert.match(m, /data-errcopy>Copy details<\/button>/);
    assert.match(m, /data-feedback>Send feedback<\/button>/);
    assert.ok(!m.includes('null is not'));
    assert.match(a.__eval('errDetails()'), /null is not an object/);
    // the shipped code routes these through it (no raw message any more)
    assert.ok(!/Couldn’t open that guide: '/.test(html) && !/Couldn’t process that photo: '/.test(html));
    assert.equal(
      (html.match(/errNote\('Couldn’t open that guide\.', 'Opening a guide', err\)/g) || []).length,
      2,
    );
    for (const w of [
      'Processing a photo',
      'Making the PDF',
      'Saving the image',
      'Reveal’s picture',
      'Restoring a backup',
      'Backing up',
      'Resuming',
    ])
      assert.ok(html.includes(`'${w}'`), w);
    assert.match(html, /errLog\('Worker', w\.k \+ ' job gave no answer in '/);
  });
  test('Send feedback’s report: version, device, Home Screen, screen, counts and the last errors, short', () => {
    const ls = storage({
      'ohuhu-hb320-picker-v3': JSON.stringify({
        mode: 'home',
        ownedSeedV: 2,
        copicAdd1: 1,
        libAdj1: 1,
        setFix1: 1,
        owned: ['Ohuhu|R014', 'Ohuhu|Y111', 'Copic|B00'],
        saved: [
          { id: 1, type: 'guide', name: 'A', ts: 1, keys: [] },
          { id: 2, type: 'palette', name: 'P', ts: 1, keys: ['Ohuhu|R014'] },
        ],
      }),
    });
    const a = app({ localStorage: ls });
    for (let i = 0; i < 5; i++) a.__eval(`errLog('Opening a guide', new Error('${'long '.repeat(80)}${i}'))`);
    const r = a.__eval('feedbackReport()');
    assert.ok(r.startsWith('What happened, or what would you like? (A screenshot helps.)\n'));
    for (const s of [
      `Marker Studio ${appVer} · Beta`,
      'Device: iPad (shown to websites as a Mac), Safari 18.1',
      'Home Screen app: yes',
      'Screen: 820×1180',
      'Saved here: 3 markers, 1 guide, 1 palette',
      'Last errors:',
    ])
      assert.ok(r.includes(s), s);
    assert.equal(
      (r.match(/^- \d{4}-\d\d-\d\d \d\d:\d\d · Opening a guide: /gm) || []).length,
      3,
      'the last three',
    );
    assert.ok(r.length < 2000, String(r.length));
    assert.match(app().__eval('feedbackReport()'), /No errors recorded\.$/);
    // one constant switches it to an email
    assert.match(html, /const FEEDBACK_EMAIL = '';/);
    assert.match(
      html,
      /if \(FEEDBACK_EMAIL\) \{\n\s+location\.href = feedbackMailto\(FEEDBACK_EMAIL, subj, text\);/,
    );
    const m = a.__eval(
      `feedbackMailto('beta@example.com', 'Marker Studio v308 · Beta feedback', feedbackReport())`,
    );
    assert.ok(
      m.startsWith(
        'mailto:beta@example.com?subject=Marker%20Studio%20v308%20%C2%B7%20Beta%20feedback&body=What%20happened',
      ),
      m.slice(0, 120),
    );
    assert.equal(decodeURIComponent(m.split('&body=')[1]), r);
  });
  test('Send feedback: the share sheet with the report, or the clipboard without one', async () => {
    let shared = null;
    const a = app({ navigator: { share: (o) => ((shared = o), Promise.resolve()) } });
    assert.equal(await a.__eval('sendFeedback()'), 'share');
    assert.equal(shared.title, `Marker Studio ${appVer} · Beta feedback`);
    assert.equal(shared.text, a.__eval('feedbackReport()'));
    // closed without sending: nothing else happens
    const c = app({
      navigator: { share: () => Promise.reject(Object.assign(new Error('x'), { name: 'AbortError' })) },
    });
    assert.equal(await c.__eval('sendFeedback()'), 'cancel');
    // no share sheet (or it fails): copied
    let copied = null;
    const clip = { writeText: (t) => ((copied = t), Promise.resolve()) };
    const b = app({ navigator: { clipboard: clip } });
    assert.equal(await b.__eval('sendFeedback()'), 'copy');
    assert.equal(copied, b.__eval('feedbackReport()'));
    const f = app({
      navigator: { clipboard: clip, share: () => Promise.reject(new Error('NotAllowedError')) },
    });
    assert.equal(await f.__eval('sendFeedback()'), 'copy');
  });
  test('Delete all my data: only this app’s keys go (other sites at the same address keep theirs), and its database', async () => {
    const ls = storage({
      'ms-onboarded': '1',
      'ms-errors': '[]',
      'ohuhu-hb320-picker-v3': '{}',
      'ohuhu-hb320-picker-v2': '{}',
      'other-site': 'keep',
      'msx': 'keep',
    });
    // (v318.7: every database deleted is noted, not the last: Scan's pictures of the questions waiting, 'ms-scan-pics',
    // go with the guides' — and the page deletes it itself at start when no question waits, so it's listed before the wipe)
    const deleted = [];
    const a = app({
      localStorage: ls,
      extra: {
        indexedDB: {
          deleteDatabase: (n) => {
            deleted.push(n);
            const r = {};
            setImmediate(() => r.onsuccess && r.onsuccess());
            return r;
          },
          open: () => stub,
        },
      },
    });
    const before = deleted.length;
    assert.ok((await a.__eval('wipeAllData()')) >= 4);
    assert.deepEqual([...ls._map.keys()].sort(), ['msx', 'other-site']);
    assert.deepEqual(deleted.slice(before).sort(), ['ms-guides', 'ms-scan-pics']);
    assert.throws(
      () => a.__eval(`indexedDB.open('ms-guides', 1)`),
      /deleted/,
      'nothing makes it again before the reload',
    );
  });
  test('service worker: the page is fetched and kept once (as index.html), and every load of it comes from that copy', async () => {
    const ORIGIN = 'https://ms.test/marker-studio/';
    const stores = new Map(),
      fetched = [],
      handlers = {};
    const key = (u) => new URL(typeof u === 'string' ? u : u.url, ORIGIN).href;
    const res = (b) => ({
      ok: true,
      body: b,
      clone() {
        return this;
      },
    });
    const cache = (n) => {
      if (!stores.has(n)) stores.set(n, new Map());
      const m = stores.get(n);
      return {
        match: async (r, o) => {
          const u = new URL(key(r));
          for (const [k, v] of m) {
            const c = new URL(k);
            if (o && o.ignoreSearch ? c.origin + c.pathname === u.origin + u.pathname : k === u.href)
              return v;
          }
        },
        put: async (r, x) => void m.set(key(r), x),
        add: async (u) => void (fetched.push(key(u)), m.set(key(u), res('file ' + key(u)))),
        addAll: async (l) =>
          l.forEach(
            (u) => (fetched.push(key(u.url || u)), m.set(key(u.url || u), res('file ' + key(u.url || u)))),
          ),
      };
    };
    const ctx = {
      online: true,
      URL,
      Promise,
      Request: function (u) {
        return { url: key(u), method: 'GET', mode: 'cors' };
      },
      caches: {
        open: async (n) => cache(n),
        keys: async () => [...stores.keys()],
        delete: async (n) => stores.delete(n),
        match: async (r, o) => {
          for (const n of stores.keys()) {
            const hit = await cache(n).match(r, o);
            if (hit) return hit;
          }
        },
      },
      fetch: async (r) => {
        fetched.push(key(r));
        if (!ctx.online) throw new TypeError('offline');
        return res('net ' + key(r));
      },
    };
    ctx.self = {
      location: { href: ORIGIN + 'service-worker.js' },
      addEventListener: (t, f) => (handlers[t] = f),
      skipWaiting: () => Promise.resolve(),
      clients: { claim: () => Promise.resolve() },
    };
    vm.createContext(ctx);
    vm.runInContext(read('service-worker.js'), ctx);
    const life = async (t) => {
      let p;
      handlers[t]({ waitUntil: (x) => (p = x) });
      await p;
    };
    const get = async (path, mode = 'navigate') => {
      let p;
      handlers.fetch({ request: { url: ORIGIN + path, method: 'GET', mode }, respondWith: (x) => (p = x) });
      const r = await p;
      await new Promise((s) => setTimeout(s, 0));
      return r && r.body;
    };
    await life('install');
    await life('activate');
    const pages = fetched.filter((u) => /marker-studio\/(index\.html)?$/.test(u));
    assert.deepEqual(pages, [ORIGIN + 'index.html'], 'the page downloaded once');
    const stored = () => [...stores.values()].flatMap((m) => [...m.keys()]);
    assert.ok(!stored().includes(ORIGIN) && stored().includes(ORIGIN + 'index.html'));
    fetched.length = 0;
    for (const p of ['', 'index.html', '?back=1', 'index.html?from=home'])
      assert.equal(await get(p), 'file ' + ORIGIN + 'index.html', p || './');
    assert.deepEqual(fetched, [], 'no network');
    // another page in the folder (a doc) still comes from the network, and offline the app answers
    assert.equal(await get('docs/TESTERS.md'), 'net ' + ORIGIN + 'docs/TESTERS.md');
    ctx.online = false;
    assert.equal(await get('docs/RELEASING.md'), 'file ' + ORIGIN + 'index.html');
    // the cached page gone (storage cleared): fetched, and kept once more as index.html
    ctx.online = true;
    stores.clear();
    assert.equal(await get('?back=1'), 'net ' + ORIGIN + '?back=1');
    assert.deepEqual(stored(), [], 'not a page with a query');
    assert.equal(await get(''), 'net ' + ORIGIN);
    assert.deepEqual(stored(), [ORIGIN + 'index.html']);
  });
  test('the version in package.json is the app’s (v307.1 → 307.1.0)', () => {
    const m = appVer.match(/^v(\d+)(?:\.(\d+))?$/);
    const want = `${m[1]}.${m[2] || 0}.0`;
    assert.equal(JSON.parse(read('package.json')).version, want);
    const lock = JSON.parse(read('package-lock.json'));
    assert.equal(lock.version, want);
    assert.equal(lock.packages[''].version, want);
    assert.ok(!/phone-first/i.test(read('package.json')));
  });
  test('releasing: Pages from a release branch that only takes a commit whose tests passed; .nojekyll', () => {
    assert.ok(existsSync(new URL('.nojekyll', root)));
    const wf = read('.github/workflows/release.yml');
    assert.match(wf, /workflow_dispatch:/);
    assert.match(wf, /contents: write/);
    assert.match(wf, /actions\/workflows\/test\.yml\/runs\?head_sha=\$SHA/);
    assert.match(wf, /if \[ "\$result" != "success" \]; then[\s\S]*exit 1/);
    assert.match(wf, /node scripts\/build\.mjs --check/);
    assert.match(wf, /merge-base --is-ancestor origin\/release "\$SHA"/);
    assert.match(wf, /git push --force origin "\$SHA:refs\/heads\/release"/);
    assert.match(read('.github/workflows/test.yml'), /push:\n\s+branches-ignore: \[release\]/);
    const doc = read('docs/RELEASING.md');
    for (const s of [
      'Settings › Pages',
      'Deploy from a branch',
      '`release`, folder `/ (root)`',
      'Actions › release › Run workflow',
      'Roll back',
      '.nojekyll',
    ])
      assert.ok(doc.includes(s), s);
  });
  test('README: for users (v318.11: how to use the app; working on it is docs/DEVELOPING.md), the CI as it runs (10 WebKit parts), nothing out of date; DEVICE-TEST and DEVELOPING are internal', () => {
    const r = read('README.md');
    for (const s of [
      'https://spicychipmunk.github.io/marker-studio/',
      'docs/TESTERS.md',
      'Send feedback',
      "isn't affiliated with or endorsed by Ohuhu or Copic",
      '## Getting started',
      '## Photographing a page',
      'All rights reserved',
    ])
      assert.ok(r.includes(s), s);
    // (nothing on building or changing the code: the licence doesn't allow reuse)
    assert.ok(
      !/npm run|## Working on it|## Running the tests|src\/js/.test(r),
      'no working on the code in the README',
    );
    const dev = read('docs/DEVELOPING.md');
    assert.match(dev, /^# [^\n]*\n\n> \*\*Internal\.\*\*/);
    for (const f of [r, dev]) assert.ok(!/phone-first|graduating|3 parts|6 parts|the few\s/i.test(f));
    assert.match(dev, /WebKit \(Safari's engine\), in 10 parts/);
    assert.match(dev, /Chromium in 2 parts/);
    const wf = read('.github/workflows/test.yml');
    assert.match(wf, /part: \[1, 2, 3, 4, 5, 6, 7, 8, 9, 10\]/, 'DEVELOPING matches the workflow');
    assert.match(read('docs/DEVICE-TEST.md'), /^# [^\n]*\n\n> \*\*Internal\.\*\*/);
  });
  // (v321) the launch screens: Apple's capable tag (iOS shows them only with it), and each link's picture there, the
  // size its media query names (device pixels, turned for landscape), every current iPad both ways up
  test('launch screens: each one listed is there at the size its screen is, with Apple’s capable tag', () => {
    assert.match(html, /<meta name="apple-mobile-web-app-capable" content="yes">/);
    const links = [
      ...html.matchAll(
        /<link rel="apple-touch-startup-image" media="screen and \(device-width: (\d+)px\) and \(device-height: (\d+)px\) and \(-webkit-device-pixel-ratio: (\d)\) and \(orientation: (portrait|landscape)\)" href="([^"]+)">/g,
      ),
    ];
    assert.ok(links.length >= 30, links.length + ' launch screens');
    const seen = new Set();
    for (const [, w, h, d, o, href] of links) {
      const b = readFileSync(new URL(href, root));
      // (a PNG's size: its IHDR, bytes 16-23)
      const pw = b.readUInt32BE(16),
        ph = b.readUInt32BE(20),
        [ew, eh] = o === 'portrait' ? [w * d, h * d] : [h * d, w * d];
      assert.deepEqual([pw, ph], [ew, eh], href);
      assert.ok(!seen.has(w + 'x' + h + '@' + d + o), 'one each: ' + href);
      seen.add(w + 'x' + h + '@' + d + o);
    }
    for (const ip of ['1032x1376@2', '1024x1366@2', '834x1194@2', '820x1180@2', '744x1133@2', '768x1024@2'])
      for (const o of ['portrait', 'landscape']) assert.ok(seen.has(ip + o), ip + ' ' + o);
    // (v322) the opening animation takes over from them: its markup made from the icon, a layer for each of the drop's
    // twelve sections, gated before the page is drawn; and the launch screens are its first picture
    assert.equal((html.match(/class="msinl msinf"/g) || []).length, 12);
    assert.ok(html.indexOf('msintro-on') < html.indexOf('<body>'), 'decided in the head');
    assert.match(read('scripts/launch.py'), /src\/assets\/intro\/plain\.png/);
  });
  test('icon credits: the 37 Lucide icons (v316: circle-help, message-square, square-minus; v320: arrow-left-right) by name, the notices in index.html, no "four icons" anywhere', () => {
    const syms = [...read('src/html/icons.html').matchAll(/<symbol id="i-([^"]+)"/g)].map((m) => m[1]);
    const lucide = syms.filter((s) => s !== 'codes' && s !== 'values');
    assert.equal(lucide.length, 37);
    const lic = read('src/assets/icons/LICENSE-Lucide-Feather.txt');
    const listed = lic
      .slice(0, lic.indexOf('licences:'))
      .match(/They are: ([^.]+)\./)[1]
      .replace(/\s+/g, ' ')
      .split(/, (?:and )?| and /);
    assert.deepEqual(listed.sort(), lucide.sort());
    assert.match(lic, /^37 of the line icons/);
    for (const f of [
      'LICENSE',
      'README.md',
      'docs/DEVELOPING.md',
      'index.html',
      'src/assets/icons/LICENSE-Lucide-Feather.txt',
    ])
      assert.ok(!/four (line )?icons|the few (lucide|icons)/i.test(read(f)), f);
    const head = html.slice(0, html.indexOf('<meta name="viewport"'));
    assert.match(head, /37 line icons from Lucide/);
    assert.match(
      head,
      /ISC License\. Copyright \(c\) 2026 Lucide Icons and Contributors\. Permission to use, copy/,
    );
    assert.match(head, /The MIT License \(MIT\)\. Copyright \(c\) 2013-present Cole Bemis\. Permission is/);
    assert.match(head, /Not affiliated with or endorsed\nby Ohuhu or Copic/);
  });
  test('the tester guide (docs and Help): its Ohuhu and Copic ranges are the app’s own, and it says what testers need', () => {
    const a = app();
    const C = a.__match.COLORS;
    const oh = C.filter((c) => c.brand === 'Ohuhu').length,
      co = C.filter((c) => c.brand === 'Copic').length;
    // every Ohuhu colour is in one of the sets named
    const sets = a.__eval('MARKER_SETS').filter((s) => s.b === 'Ohuhu');
    const OS = a.__eval('OHUHU_SETS');
    const all = new Set(sets.flatMap((s) => OS[s.oh].split(' ')));
    assert.ok(all.size > 300 && all.size < oh, 'the sets named hold most of them, not all');
    const names = sets.map((s) => s.n);
    assert.ok(names.includes('Honolulu 24') && names.includes('Honolulu 320 (complete set)'));
    const words = ['48 Mid-tone', '104 Colors', '36 Skin Tones', '36 Gray Tones', '48 Pastel', '24 Portrait'];
    for (const w of words)
      assert.ok(
        names.some((n) => n.startsWith(w)),
        w,
      );
    const testers = read('docs/TESTERS.md');
    const inApp = html.match(/<details class="hlpsec" id="helpBeta">[\s\S]*?<\/details>/)[0];
    for (const t of [testers, inApp]) {
      assert.ok(t.includes(`${oh} markers, among them every colour in the Honolulu sets`), 'Ohuhu');
      assert.ok(t.includes(`all ${co} markers, by the codes Sketch, Ciao and Classic share`), 'Copic');
      assert.match(t, /Honolulu sets \(24 up to the complete 320\)/);
      for (const w of words) assert.ok(t.includes(w), w);
      for (const s of [
        'Add to Home Screen',
        'Back up',
        'once a week',
        'screenshot',
        'approximate',
        'Send feedback',
        'Copy details',
        'Known limits',
        'What to try',
      ])
        assert.ok(t.includes(s), s);
    }
  });
  test('Scatter: Polished has its line', () => {
    const d = html.match(/const GRAD_SCAT_DESC = \[([\s\S]*?)\];/)[1];
    assert.match(d, /^\s*\/\/[^\n]*\n\s*'Neat bands in flow order',\n\s*'In flow order/);
    assert.ok(!/class="sfc-note sfc-mt6"' \+\s*\(_sv \|\| _sOff/.test(html), 'shown at Polished too');
  });
}

// ---- from v308-merge-fa.test.mjs ----
// v308 merge (fixes pass A): What's new in version order; Help and the tester guide on other brands' markers.
{
  const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
  const read = (p) => readFileSync(join(ROOT, p), 'utf8');
  test('What’s new is newest first: no item sits after an older version’s', () => {
    const src = read('src/js/help.js');
    const list = src.slice(
      src.indexOf('const WHATS_NEW = ['),
      src.indexOf('];', src.indexOf('const WHATS_NEW = [')),
    );
    const vs = [...list.matchAll(/\bv: '(v[\d.]+)'/g)].map((m) => m[1]);
    const num = (v) => {
      const m = /^v(\d+)(?:\.(\d+))?$/.exec(v);
      return +m[1] + (+m[2] || 0) / 1000;
    };
    assert.ok(vs.length > 20, String(vs.length));
    for (let i = 1; i < vs.length; i++)
      assert.ok(num(vs[i]) <= num(vs[i - 1]), `${vs[i]} after ${vs[i - 1]}`);
  });
  // (the app knows Ohuhu and Copic markers by brand and code; "Other markers with these codes work too", after the Copic
  // line in Help, read as other brands, which the tester guide says aren't supported)
  test('Help’s Beta tester guide and docs/TESTERS.md agree: other Ohuhu markers with these codes work, not other brands', () => {
    const html = read('index.html');
    const inApp = html.match(/<details class="hlpsec" id="helpBeta">[\s\S]*?<\/details>/)[0];
    const testers = read('docs/TESTERS.md').replace(/\s+/g, ' ');
    for (const t of [inApp, testers])
      assert.ok(t.includes('Other Ohuhu markers with these codes work too'), t.slice(0, 80));
    assert.ok(!/Other markers with these codes/.test(inApp), 'not "Other markers"');
    assert.ok(
      testers.includes('Other brands aren’t supported yet') ||
        testers.includes("Other brands aren't supported yet"),
    );
    // said with the Ohuhu ranges, before Copic's line
    assert.ok(inApp.indexOf('Other Ohuhu markers') < inApp.indexOf('Copic: all'), 'with Ohuhu');
  });
}

// ---- from v308-toast.test.mjs ----
// v308: toast() shows its message as plain text; a message built as HTML goes through toastHTML / toastActionHTML.
{
  // The toast is plain text (v308): a name in it can never become markup. A message built as HTML goes through toastHTML /
  // toastActionHTML, its names escaped. This check keeps HTML out of the plain ones, including toasts added later.
  test('toasts: no plain toast is given HTML or escaped text', () => {
    const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'js');
    const files = fs
      .readdirSync(root)
      .filter((f) => f.endsWith('.js'))
      .map((f) => path.join(root, f))
      .concat(fs.readdirSync(path.join(root, 'guide')).map((f) => path.join(root, 'guide', f)));
    const bad = [];
    for (const f of files) {
      const s = fs.readFileSync(f, 'utf8');
      const re = /\b(toast|toastAction|toastActions)\(/g;
      let m;
      while ((m = re.exec(s))) {
        if (/function\s+$/.test(s.slice(Math.max(0, m.index - 10), m.index))) continue;
        let i = m.index + m[0].length,
          d = 1,
          q = null;
        for (; i < s.length && d; i++) {
          const c = s[i];
          if (q) {
            if (c === '\\') {
              i++;
              continue;
            }
            if (c === q) q = null;
            continue;
          }
          if (c === "'" || c === '"' || c === '`') q = c;
          else if (c === '(') d++;
          else if (c === ')') d--;
        }
        // (the message: up to the first top-level comma would be exact; the whole call is a safe over-approximation,
        // as the callbacks after it don't build markup)
        const call = s.slice(m.index, i);
        if (/\besc\(|\bic\(|mcodeHTML\(|<\/?[a-z][^>]*>|&[a-z]+;/.test(call.split(/\bfunction\b|=>/)[0]))
          bad.push(path.relative(root, f) + ':' + s.slice(0, m.index).split('\n').length);
      }
    }
    assert.deepEqual(bad, []);
  });
}

// ---- from v318-release.test.mjs ----
// v318 review: the service worker's caches are named as the release and the page expect. An app cache not renamed with
// the version leaves every installed copy on the old page for good (the page comes from the cache first, and an
// unchanged service worker is never updated); a reader's cache named apart from the page's is deleted at every update.
{
  const root = new URL('../', import.meta.url);
  const read = (f) => readFileSync(new URL(f, root), 'utf8');
  const sw = read('service-worker.js');
  test('the app’s cache is named after the version Home shows', () => {
    const appVer = read('index.html').match(/id="appVer"[^>]*>(v\d+(?:\.\d+)?)</)[1];
    assert.equal(sw.match(/const CACHE='([^']+)'/)[1], 'marker-studio-' + appVer);
  });
  test('the photo reader’s cache, kept through updates, is the one the page stores it in', () => {
    const ver = read('src/js/photo-read.js').match(/OCR_VER = '([^']+)'/)[1];
    assert.equal(sw.match(/const OCRC='([^']+)'/)[1], 'marker-studio-ocr-' + ver);
    assert.ok(
      existsSync(new URL('vendor/ocr/' + ver + '/', root)),
      'its files are where the page fetches them',
    );
  });
  // (v325.1) the subject finder, as the reader: its cache kept, its file where the page fetches it, as listed
  test('the subject finder’s cache, kept through updates, is the one the page stores it in; its file as listed', () => {
    const src = read('src/js/guide/48-subject.js'),
      ver = src.match(/SUB_VER = '([^']+)'/)[1];
    assert.equal(sw.match(/const SUBC='([^']+)'/)[1], 'marker-studio-subject-' + ver);
    assert.match(sw, /x!==SUBC/, 'kept through updates');
    assert.match(sw, /\/vendor\/subject\//, 'never put in the app’s cache');
    const [, f, n, h] = src.match(/\{ f: '([^']+)', n: (\d+), h: '([0-9a-f]{64})' \}/),
      buf = readFileSync(new URL('vendor/subject/' + ver + '/' + f, root));
    assert.equal(buf.length, +n);
    assert.equal(createHash('sha256').update(buf).digest('hex'), h);
    assert.match(read('vendor/subject/README.md'), new RegExp(h));
  });
  test('PDF.js’s cache is named after the version the app ships', () => {
    const v = sw.match(/const PDFJS='([^']+)'/)[1];
    assert.ok(existsSync(new URL('vendor/pdfjs/' + v + '/pdf.min.mjs', root)));
  });
}

// ---- from v31826-w1.test.mjs ----
// v318.26 (W1): the polish set's unit-testable parts (A1 a kept error without a when, A7 an older cap's name found
// with the setting as it is) and Send feedback's waits (D). Each fails on v318.25.
{
  test('A1 a kept error without a string when (an older version’s, or written by hand): Send feedback and Copy details don’t throw', () => {
    const a = createApp({
      localStorage: memoryStorage({
        'ms-errors': JSON.stringify([
          { msg: 'old style' },
          { msg: 'a number', when: 1700000000000, where: 7 },
          { msg: 'kept', when: '2026-10-01T09:30:00.000Z', where: 'Opening a guide' },
        ]),
      }),
    });
    const r = a.__eval('feedbackReport()');
    assert.match(
      r,
      /\nLast errors:\n- : old style\n- : a number\n- 2026-10-01 09:30 · Opening a guide: kept$/,
    );
    const d = a.__eval('errDetails()');
    assert.ok(!/undefined|NaN/.test(d), d);
    assert.match(d, /\n2026-10-01T09:30:00\.000Z · Opening a guide\nkept/);
    // (a new error is still kept and listed after them)
    a.__eval(`errLog('Saving', new Error('fresh'))`);
    assert.match(a.__eval('feedbackReport()'), /· Saving: fresh$/);
  });
  {
    const a = createApp();
    const E = a.__eval;
    const found = (q) =>
      JSON.parse(
        E(
          `JSON.stringify(COLORS.flatMap((c, i) => sMatch(i, ${JSON.stringify(q)}) ? [c.brand + ' ' + c.code] : []))`,
        ),
      );
    const byCap = (q) =>
      JSON.parse(
        E(`JSON.stringify(COLORS.flatMap((c, i) => sByCap(i, ${JSON.stringify(q)}) ? [c.code] : []))`),
      );

    test('A7 Markers’ search: an older Ohuhu cap’s printed name finds its marker with the setting as it is (codes of now)', () => {
      assert.equal(E('state.capDef'), '');
      assert.ok(
        found('Rose Red').includes('Ohuhu R213'),
        'R213 Pomegranate, whose older cap says R6 Rose Red',
      );
      assert.ok(found('Rose Red').includes('Copic R85'), 'and Copic’s R85 Rose Red, by its own name');
      assert.ok(found('dark blush').includes('Ohuhu RV17'));
      // (while typing: once the query reaches the name's last word)
      assert.ok(found('dark b').includes('Ohuhu RV17'));
      assert.ok(!found('dark').includes('Ohuhu RV17'), 'not its first word alone');
      // (the start only: not a word inside the name, which had added 17 blues and 28 greys)
      assert.ok(!found('ose red').includes('Ohuhu R213'));
      assert.ok(!found('red').includes('Ohuhu R213'));
      // (and not a family's own words: "yellow grey" had found Yellow Grey 04, 08 and 100, "cool grey" 7 more)
      for (const q of [
        'blue',
        'gray',
        'light',
        'dark',
        'pale',
        'rose',
        'yellow grey',
        'cool grey',
        'warm gray',
      ])
        assert.deepEqual(byCap(q), [], q);
      // (its number begun, it's that cap's name: Yellow Grey 04 is E14's older cap)
      assert.ok(byCap('yellow grey 04').includes('E14'));
      assert.deepEqual(byCap('lemon yellow'), ['Y28']);
      // (found by the cap's name alone, for the cell's label; not when its own name or code is the match)
      assert.deepEqual(byCap('rose red'), ['R213']);
      assert.deepEqual(byCap('R213'), []);
      assert.deepEqual(byCap('pomegranate'), []);
    });

    test('A7 the cell found by an older cap’s name says that cap in its label and title', () => {
      E(`searchStr = 'rose red'; state.mode = 'collection'`);
      const i = +E(`COLORS.findIndex((c) => c.brand === 'Ohuhu' && c.code === 'R213')`);
      const h = E(`cellHtml(${i})`);
      assert.match(h, /aria-label="Ohuhu R213 Pomegranate, older cap R6 Rose Red, not owned/);
      assert.match(h, /title="Ohuhu R213 · Pomegranate · old R6, older cap R6 Rose Red · tap/);
      const j = +E(`COLORS.findIndex((c) => c.brand === 'Copic' && c.code === 'R85')`);
      assert.ok(!/older cap/.test(E(`cellHtml(${j})`)), 'found by its own name: no tag');
      E(`searchStr = ''`);
    });
  }
  test('D Send feedback carries this visit’s longest waits, after the errors; none, nothing added', () => {
    const a = createApp();
    const E = a.__eval;
    assert.match(E('feedbackReport()'), /No errors recorded\.$/);
    assert.equal(E('feedbackWaitLines()'), '');
    E(`holdAdd('Sections', 1234.4, '2048×1536'); holdAdd('Build', 300)`);
    assert.equal(
      E('feedbackWaitLines()'),
      '\nLongest waits, this visit:\nSections 1234 ms (2048×1536)\nBuild 300 ms',
    );
    assert.match(
      E('feedbackReport("It froze")'),
      /^It froze\n\n[\s\S]*\nNo errors recorded\.\nLongest waits, this visit:\nSections 1234 ms \(2048×1536\)\nBuild 300 ms$/,
    );
  });
  test('D the form’s Message: the details kept whole, the words cut to fit 4000', () => {
    const a = createApp();
    const fit = a.__eval('feedbackFit');
    const det =
      '\n\nLast errors:\n' +
      'e'.repeat(800) +
      '\nScreen: 820×1180\nLongest waits, this visit:\n' +
      'w'.repeat(390);
    const m = fit('x'.repeat(3000), det, 4000);
    assert.equal(m.length, 4000);
    assert.ok(m.endsWith(det));
    assert.equal(fit('short', det, 4000), 'short' + det);
    assert.equal(fit('short', 'd'.repeat(4100), 4000), 'd'.repeat(4100), 'never a negative cut');
  });
}

// ---- from v31830.test.mjs ----
// v318.30: Help's "More you can do" and "If something goes wrong" (and the README's), and the app icon.
{
  const ROOT = new URL('..', import.meta.url).pathname;
  const read = (f) => readFileSync(join(ROOT, f), 'utf8');
  const dialogs = read('src/html/dialogs.html');
  const sec = (id) => dialogs.match(new RegExp(`<details class="hlpsec" id="${id}">[\\s\\S]*?</details>`))[0];
  // the app's own words, outside Help: every screen's HTML and script
  const walk = (d) =>
    readdirSync(join(ROOT, d), { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(join(d, e.name)) : /\.(js|html)$/.test(e.name) ? [join(d, e.name)] : [],
    );
  const elsewhere = walk('src')
    .map((f) => {
      let t = read(f);
      if (f.endsWith('dialogs.html'))
        t = t.replace(
          /<div class="overlay" id="helpOverlay"[\s\S]*?<\/div><\/div>(?=<div class="overlay")/,
          '',
        );
      return t;
    })
    .join('\n')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ');
  test('the new Help sections: after Adding markers by code, before the Glossary', () => {
    const ids = [...dialogs.matchAll(/<details class="hlpsec" id="(\w+)">/g)].map((m) => m[1]);
    // (v318.32: What's new has its own section, second, so the run starts one later: found by its first id)
    const at = ids.indexOf('helpScan');
    assert.deepEqual(ids.slice(at, at + 4), ['helpScan', 'helpMore', 'helpTrouble', 'helpGloss']);
    assert.equal(ids[at - 1], 'helpPhoto');
  });
  test('every button or place they name is a real one in the app (the label as it is on screen)', () => {
    for (const id of ['helpMore', 'helpTrouble']) {
      const names = [...sec(id).matchAll(/<b>([^<]+)<\/b>/g)]
        .map((m) => m[1].replace(/&amp;/g, '&').trim())
        // (the lines' own headings end in a full stop or are quoted)
        .filter((n) => !/[.”]$/.test(n));
      assert.ok(names.length >= 6, id + ': ' + names.length);
      for (const n of names) {
        // a path: each step on its own (Markers › Print a swatch chart)
        for (const step of n.split(' › ').map((x) => x.replace(/^← /, '').replace(/ \(↶\)$/, '')))
          assert.ok(elsewhere.includes(step), `${id}: “${step}” isn’t a label in the app`);
      }
    }
  });
  test('the README has both lists, and the colour line says where the colours come from (docs, Help)', () => {
    const r = read('README.md');
    assert.match(r, /## More you can do\n/);
    assert.match(r, /## If something goes wrong\n/);
    const t = read('docs/TESTERS.md').replace(/\s+/g, ' ');
    for (const s of [r.replace(/\s+/g, ' '), t, sec('helpBeta'), sec('helpTrouble')])
      assert.match(s, /Ohuhu(’|')s and Copic(’|')s own published colours/);
    assert.ok(!/six last questions/.test(t), 'five questions and a name');
  });
  test('the icon: a drop of sections drawn like a colouring page, one left white; the maskable one inside the safe circle', () => {
    const svg = read('src/assets/icon.svg'),
      mask = read('src/assets/icon-maskable.svg');
    assert.match(svg, /viewBox="0 0 1024 1024"/);
    assert.equal((svg.match(/fill="#ffffff"/g) || []).length >= 1, true, 'one section left white');
    assert.match(mask, /scale\(0\.\d+\)/);
  });
}

// ---- from v31832-fixes.test.mjs ----
// v318.32 bug fixes (Fable R32: D1-2, D2-1, D3-2). Each fails on v318.31.
{
  // (v320: an app of its own, as when this was a file of its own)
  const _app = createApp(),
    core = _app.__mstest;
  const root = new URL('../', import.meta.url);
  // D1-2: a list file in UTF-16 (Excel's "Unicode Text", an older Notepad's "Unicode") read as the codes it holds, not a
  // letter at a time ("R16" had arrived as R, 1, 6 and added Ohuhu R210, Y27 for R16, Y13)
  const utf16 = (s, be, bom) => {
    const u = Buffer.from(s, 'utf16le');
    if (be) u.swap16();
    return bom ? Buffer.concat([be ? Buffer.from([0xfe, 0xff]) : Buffer.from([0xff, 0xfe]), u]) : u;
  };
  const asBuf = (b) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
  // D3-2: the service worker stores only the app's own origin's responses in its cache (an opaque cross-origin one would
  // take about 7 MB of quota each in Chrome)
  function loadSW() {
    const src = readFileSync(new URL('service-worker.js', root), 'utf8'),
      handlers = {},
      puts = [],
      cache = {
        match: async () => undefined,
        put: async (k, v) => puts.push([typeof k === 'string' ? k : k.url, v]),
        addAll: async () => {},
        add: async () => {},
        keys: async () => [],
      },
      ctx = {
        self: null,
        caches: {
          open: async () => cache,
          match: async () => undefined,
          keys: async () => [],
          delete: async () => true,
        },
        fetch: async (r) => ({ ok: true, type: 'basic', url: r.url, clone: () => ({ cloned: r.url }) }),
        URL,
        Request: function (u) {
          this.url = u;
        },
        Promise,
        console,
      };
    ctx.self = Object.assign(ctx, {
      location: { href: 'https://example.test/marker-studio/index.html' },
      addEventListener: (t, f) => (handlers[t] = f),
      skipWaiting: async () => {},
      clients: { claim: async () => {} },
    });
    vm.createContext(ctx);
    vm.runInContext(src, ctx, { filename: 'service-worker.js' });
    return { handlers, puts };
  }
  async function swFetch(url, mode = 'no-cors') {
    const { handlers, puts } = loadSW();
    let out = null;
    handlers.fetch({ request: { method: 'GET', url, mode }, respondWith: (p) => (out = p) });
    const res = await out;
    // (the put is queued behind caches.open: a few turns)
    for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
    return { res, puts };
  }
  test('D1-2: a list file decoded by its bytes: UTF-16LE and BE with a mark, UTF-16LE without one, and UTF-8', () => {
    const app = createApp({ TextDecoder });
    const text = 'B02 R16 Y13 CG5\n';
    assert.equal(app.scanDecode(asBuf(utf16(text, false, true))), text, 'UTF-16LE + BOM');
    assert.equal(app.scanDecode(asBuf(utf16(text, true, true))), text, 'UTF-16BE + BOM');
    assert.equal(app.scanDecode(asBuf(utf16(text, false, false))), text, 'UTF-16LE, no BOM');
    assert.equal(app.scanDecode(asBuf(Buffer.from('﻿' + text, 'utf8'))), text, 'UTF-8 + BOM');
    assert.equal(app.scanDecode(asBuf(Buffer.from('Café ' + text, 'utf8'))), 'Café ' + text, 'UTF-8');
    assert.equal(app.scanDecode(new ArrayBuffer(0)), '', 'empty');
    // what scanRead makes of each: the same four codes
    const codes = (buf) =>
      app
        .scanRead(app.scanDecode(buf), 'Ohuhu')
        .codes.map((c) => c.code)
        .sort();
    const want = codes(asBuf(Buffer.from(text, 'utf8')));
    assert.ok(want.length >= 4, 'the UTF-8 list reads its codes: ' + want);
    assert.deepEqual(codes(asBuf(utf16(text, false, true))), want);
    assert.deepEqual(codes(asBuf(utf16(text, true, true))), want);
    assert.deepEqual(codes(asBuf(utf16(text, false, false))), want);
  });
  // D2-1: buildNoRep's byUse bookkeeping with two pool entries of one marker (distinct objects, one mkey): the second's
  // pick looked for it in the list of the markers used once, found nothing, and splice(-1, 1) took that list's LAST
  // marker out of the rotation. (Every pool source dedupes today; the guard is for the one that won't.) The splice with
  // a negative start is what's watched for: the lay's counts can't show it, as the duplicate entry itself stays in the
  // unused list and is laid again and again either way.
  test('D2-1: No repeats with a pool holding one marker twice never splices at -1', () => {
    const app = createApp(),
      E = app.__eval,
      core = app.__mstest;
    E('state.owned = new Set()');
    E('presetMkeys(MARKER_SETS.find((s) => s.n === "Honolulu 120")).forEach((k) => state.owned.add(k))');
    core.coll = E('sfCollection()');
    Object.assign(core.styleVars, { noRep: true, paletteSource: 'owned', palette: 'all', limitN: 16 });
    // 8 squares that don't touch (a gap of background between): no neighbour rules, the rotation alone lays them
    const W = 8 * 20,
      H = 20,
      labels = new Int32Array(W * H),
      comps = [null];
    for (let x = 0; x < 8; x++) {
      const l = comps.length;
      comps.push({ cx: x * 20 + 8, cy: 8, area: 256, merged: false, bg: false });
      for (let py = 0; py < 16; py++) labels.fill(l, py * W + x * 20, py * W + x * 20 + 16);
    }
    core.W = W;
    core.H = H;
    core.labels = labels;
    core.comps = comps;
    core.secState = new Uint8Array(comps.length).fill(1);
    core.assignData = null;
    const cl = core.countedList();
    assert.equal(cl.length, 8);
    const by = (code) => core.coll.find((m) => m.code === code),
      A = by('R16'),
      B = by('B02'),
      C = by('Y07');
    assert.ok(A && B && C, 'the three markers are in the collection');
    // (a copy of A: the same mkey, another object, as a pool built from two sources could hold)
    // (the app's own Array: its literals are the context's, not Node's)
    const pool = [B, C, A, Object.assign({}, A)],
      AP = E('[].constructor.prototype'),
      splice = AP.splice,
      neg = [];
    AP.splice = function (start) {
      if (start < 0) neg.push([start, this.length]);
      return splice.apply(this, arguments);
    };
    try {
      for (let k = 0; k < 6; k++) core.buildNoRep(cl, pool);
    } finally {
      AP.splice = splice;
    }
    assert.equal(core.assignData.order.length, 8, 'every section laid');
    assert.deepEqual(neg, [], 'no splice from the end of a list');
  });
  test('D3-2: the service worker caches a same-origin file it fetched, and never a cross-origin one', async () => {
    const same = await swFetch('https://example.test/marker-studio/src/assets/fonts/x.woff2');
    assert.ok(same.res && same.res.ok, 'answered from the network');
    assert.deepEqual(
      same.puts.map((p) => p[0]),
      ['https://example.test/marker-studio/src/assets/fonts/x.woff2'],
    );
    const other = await swFetch('https://cdn.example.net/lib.js');
    assert.ok(other.res && other.res.ok, 'still answered from the network');
    assert.deepEqual(other.puts, [], 'not stored');
  });
}

// ---- from v31837-jobs.test.mjs ----
// v318.37 (Fable X2-3): JOBS times the jobs waiting one after another; a job that answers early no longer pads the
// timing of the ones behind it, nor of later jobs (retime, 03-jobs). On v318.36 the deadline tail kept every budget
// ever posted while any job waited: a Sensitivity drag's superseded seg jobs left the last one due many budgets out.
{
  // an app whose worker only answers when told to (answer): as test/v307-final
  function withWorker() {
    const made = [];
    class FakeWorker {
      constructor() {
        this.sent = [];
        this.stopped = false;
        made.push(this);
      }
      postMessage(m) {
        this.sent.push(m);
      }
      terminate() {
        this.stopped = true;
      }
      answer(id, r) {
        this.onmessage({ data: { id, r } });
      }
      drop(id) {
        this.onmessage({ data: { id, err: 'superseded' } });
      }
    }
    const app = createApp({
      Worker: FakeWorker,
      URL: { createObjectURL: () => 'blob:jobs' },
      Blob: function () {},
      setTimeout,
      clearTimeout,
    });
    return { jobs: app.__mstest.jobs, made };
  }
  const settle = (p) =>
    p.then(
      (v) => ({ ok: true, v }),
      (e) => ({ ok: false, why: e.message }),
    );
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const n = (o) => JSON.parse(JSON.stringify(o));
  test('superseded jobs answered: the one still waiting is due its own budget after the last answer, not every budget posted', async () => {
    const { jobs, made } = withWorker();
    jobs.hang(80, 'seg');
    // (a drag: four seg jobs posted at once, due 80, 160, 240 and 320 ms out)
    const ps = [1, 2, 3, 4].map(() => settle(jobs.run('seg', { W: 1, H: 1 })));
    const wk = made[0];
    assert.equal(wk.sent.length, 4);
    await wait(10);
    // the first three answer 'superseded' at once (their next step)
    wk.drop(wk.sent[0].id);
    wk.drop(wk.sent[1].id);
    wk.drop(wk.sent[2].id);
    assert.deepEqual(n(jobs.stats.dropped), { seg: 3 });
    const t0 = Date.now();
    // the fourth is now due 80 ms after that answer (v318.36: at 320 ms, a budget for each of the three)
    assert.deepEqual(await ps[3], { ok: false, why: 'timed out' });
    const dt = Date.now() - t0;
    assert.ok(dt >= 60 && dt < 200, 'given its own budget after the last answer: ' + dt + ' ms');
    assert.deepEqual(n(jobs.stats.timedOut), { seg: 1 });
    assert.equal(wk.stopped, true);
    for (const p of ps.slice(0, 3)) assert.deepEqual(await p, { ok: false, why: 'superseded' });
  });
  test('a later job is timed from the jobs still waiting, not from budgets already answered', async () => {
    const { jobs, made } = withWorker();
    jobs.hang(100);
    const a = settle(jobs.run('pdf', { n: 1 })),
      b = settle(jobs.run('pdf', { n: 1 }));
    const wk = made[0];
    await wait(10);
    wk.answer(wk.sent[0].id, 1);
    assert.deepEqual(await a, { ok: true, v: 1 });
    // b is still waiting (due 100 ms after a's answer); c, posted now, is due 100 ms after b is, and once b answers
    // (at 60 ms) 100 ms after that: about 160 ms from here, not 290 (v318.36: a's budget stayed in the tail)
    const t0 = Date.now(),
      c = settle(jobs.run('pdf', { n: 1 }));
    await wait(60);
    wk.answer(wk.sent[1].id, 2);
    assert.deepEqual(await b, { ok: true, v: 2 });
    assert.deepEqual(await c, { ok: false, why: 'timed out' });
    const dt = Date.now() - t0;
    assert.ok(dt >= 130 && dt < 240, 'c due a budget after b answered: ' + dt + ' ms');
  });
  test('a job ahead keeps its own time when one behind it answers first', async () => {
    const { jobs, made } = withWorker();
    jobs.hang(100);
    const a = settle(jobs.run('png', { w: 1, h: 1 })),
      b = settle(jobs.run('png', { w: 1, h: 1 }));
    const wk = made[0];
    await wait(10);
    // (answers may come back in another order: b first)
    wk.answer(wk.sent[1].id, 2);
    assert.deepEqual(await b, { ok: true, v: 2 });
    await wait(50);
    assert.equal(jobs.on, true, 'a is not due yet (at 60 ms of its 100)');
    wk.answer(wk.sent[0].id, 1);
    assert.deepEqual(await a, { ok: true, v: 1 });
    await wait(120);
    assert.equal(jobs.on, true, 'nothing timed out afterwards');
    assert.deepEqual(n(jobs.stats.timedOut), {});
  });
}

// ---- (v324) UI wording: the house rules in DEVELOPING.md › Wording ----
// Every string the app shows is in its source's string literals and its HTML: none has a straight apostrophe between
// letters (’, not '), and Colour along and Focus mode, named features, are written with capitals (the verb, "colour
// along", and the layer's own name stay as they are).
{
  const { createRequire } = await import('node:module');
  const { readdirSync, readFileSync: rf } = await import('node:fs');
  const { join: pj } = await import('node:path');
  const acorn = createRequire(import.meta.url)('acorn');
  const SRC = pj(import.meta.dirname, '..', 'src');
  const files = (d, ext) =>
    readdirSync(d, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? files(pj(d, e.name), ext) : e.name.endsWith(ext) ? [pj(d, e.name)] : [],
    );
  const strings = () => {
    const out = [];
    for (const f of files(pj(SRC, 'js'), '.js')) {
      const src = rf(f, 'utf8');
      for (const t of acorn.tokenizer(src, { ecmaVersion: 'latest', allowHashBang: true }))
        if ((t.type.label === 'string' || t.type.label === 'template') && typeof t.value === 'string')
          out.push([f.slice(SRC.length + 1) + ':' + src.slice(0, t.start).split('\n').length, t.value]);
    }
    // (the HTML's text and attributes: tags' insides are attribute values, between them the words shown)
    for (const f of files(pj(SRC, 'html'), '.html').concat(pj(SRC, 'index.template.html')))
      rf(f, 'utf8')
        .replace(/<!--[\s\S]*?-->|<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '')
        .split(/(?=<)|(?<=>)/)
        .forEach((s, i) => out.push([f.slice(SRC.length + 1) + '#' + i, s]));
    return out;
  };
  test('UI text: no straight apostrophes between letters', () => {
    const bad = strings().filter(([, v]) => /[A-Za-z]'[A-Za-z]/.test(v));
    assert.deepEqual(
      bad.map(([w, v]) => w + ' ' + v.slice(0, 80)),
      [],
    );
  });
  test('UI text: Colour along and Focus mode with capitals, as named features', () => {
    const bad = strings().filter(
      ([, v]) =>
        /(^|[^A-Za-z])(colour along|focus mode)\b/.test(v) &&
        !/\b(to|you|next) colour along\b/.test(v) &&
        v !== 'focus mode',
    );
    assert.deepEqual(
      bad.map(([w, v]) => w + ' ' + v.slice(0, 80)),
      [],
    );
  });
}
