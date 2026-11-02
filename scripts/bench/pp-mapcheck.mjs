#!/usr/bin/env node
// The photo-to-page bench's map check (plan v4): for a few bench photos, the subject map the APP makes (headless
// Chromium: the photo opened as a page, Sharper subject chosen, the subject finder run in its worker with ONNX Runtime
// Web on the shipped file) against the bench's own (pp_maps.py's raw map through the app's subMapUp, Node): IoU of the
// maps cut at 0.5, the largest and mean difference; and the working pictures compared too.
//
//   node scripts/bench/pp-mapcheck.mjs --in <bench-photos> --cache <cache> [--ids id,id,...] [--map subject-te4]
//
// Passes at IoU 0.99 or more, largest difference 0.02 or less, mean 0.002 or less, on every photo checked.
import fs from 'node:fs';
import path from 'node:path';
import { answerAsks, idle, openApp, setup, teardown, until } from '../../e2e/helpers.mjs';
import { createApp } from '../../test/harness.mjs';

const argv = process.argv.slice(2),
  arg = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);
const IN = arg('--in'),
  CACHE = arg('--cache'),
  MAP = arg('--map', 'subject-te4');
const lines = fs.readFileSync(path.join(IN, 'index.csv'), 'utf8').split(/\r?\n/).filter(Boolean),
  head = lines[0].split(','),
  rows = lines
    .slice(1)
    .map((l) => l.split(','))
    .map((c) => Object.fromEntries(head.slice(0, 11).map((k, i) => [k, c[i]]))); // (the columns before masks/credit)
// (by default the photos that stress the map most, FINDINGS-AM N6: a colour profile, people, the smallest subject, a
// subject at the photo's edge, the lightest working picture; then the first others)
function stressing() {
  const have = rows.filter((r) => fs.existsSync(path.join(CACHE, 'maps', MAP, r.id + '.y'))),
    masks = (r) => {
      const f = path.join(CACHE, 'masks', r.id + '.json');
      return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f)) : null;
    },
    share = (r) => {
      const m = masks(r);
      return m ? m.objs.reduce((a, o) => a + o.area, 0) / (m.GW * m.GH) : 1;
    },
    light = (r) => {
      const b = fs.readFileSync(path.join(CACHE, 'prep', r.id + '.rgb'));
      let t = 0;
      for (let i = 0; i < b.length; i += 97) t += b[i];
      return t / Math.ceil(b.length / 97);
    },
    pick = [
      have.find((r) => r.icc === '1'),
      have.find((r) => r.kind === 'people'),
      [...have].sort((a, b) => share(a) - share(b))[0],
      have.find((r) => (masks(r) || { objs: [] }).objs.some((o) => o.border)),
      [...have].sort((a, b) => light(b) - light(a))[0],
      ...have,
    ];
  return [...new Set(pick.filter(Boolean).map((r) => r.id))].slice(0, 5);
}
const ids = arg('--ids') ? arg('--ids').split(',') : stressing();
const t = createApp().__mstest,
  side = JSON.parse(fs.readFileSync(path.join(CACHE, 'maps', MAP, 'model.json'))).side,
  out = [];
await setup();
try {
  for (const id of ids) {
    const r = rows.find((x) => x.id === id),
      { page } = await openApp({
        width: 820,
        height: 1180,
        storage: { 'ms-onboarded': '1', 'ms-setup-tip': '1' },
      });
    await idle(page);
    const [fc] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.evaluate(() => SF.ppPick(() => setMode('sections'))),
    ]);
    await fc.setFiles(path.join(IN, r.set, id + '.jpg'));
    await until(
      page,
      () => window.__mstest && __mstest.ppPrep && __mstest.pp && !__mstest.ppBusy,
      null,
      'the page',
      120000,
    );
    await idle(page);
    await page.click('#sfPpFoc [data-v="sharp"]');
    await answerAsks(page, true);
    await until(
      page,
      () => __mstest.pp.f === 'sharp' && !__mstest.ppBusy && !!__mstest.ppPrep.sal,
      null,
      'Sharper subject',
      180000,
    );
    const got = await page.evaluate(() => {
      const q = __mstest.ppPrep,
        b64 = (u8) => {
          let s = '';
          for (let i = 0; i < u8.length; i += 0x8000)
            s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
          return btoa(s);
        };
      return {
        w: q.w,
        h: q.h,
        rgb: b64(q.rgb),
        sal: b64(new Uint8Array(q.sal.buffer, q.sal.byteOffset, q.sal.byteLength)),
      };
    });
    await page.context().close();
    const rgbApp = new Uint8Array(Buffer.from(got.rgb, 'base64')),
      salApp = new Float32Array(new Uint8Array(Buffer.from(got.sal, 'base64')).buffer),
      rgbB = new Uint8Array(fs.readFileSync(path.join(CACHE, 'prep', id + '.rgb'))),
      y = new Float32Array(new Uint8Array(fs.readFileSync(path.join(CACHE, 'maps', MAP, id + '.y'))).buffer),
      salB = t.subMapUp(y, side, rgbB, got.w, got.h, 8, 0.004);
    let I = 0,
      U = 0,
      mx = 0,
      sm = 0,
      dr = 0;
    for (let i = 0; i < salApp.length; i++) {
      const a = salApp[i] >= 0.5,
        b = salB[i] >= 0.5,
        d = Math.abs(salApp[i] - salB[i]);
      if (a && b) I++;
      if (a || b) U++;
      if (d > mx) mx = d;
      sm += d;
    }
    for (let i = 0; i < rgbApp.length; i++) dr += Math.abs(rgbApp[i] - rgbB[i]);
    const res = { id, iou: U ? I / U : 1, max: mx, mean: sm / salApp.length, rgb: dr / rgbApp.length };
    res.ok = U > 0 && res.iou >= 0.99 && res.max <= 0.02 && res.mean <= 0.002;
    out.push(res);
    console.log(
      `${id}: IoU ${res.iou.toFixed(4)}, largest difference ${res.max.toFixed(4)}, mean ${res.mean.toFixed(5)}; working pictures differ by ${res.rgb.toFixed(3)} levels on average: ${res.ok ? 'pass' : 'FAIL'}`,
    );
  }
} finally {
  await teardown();
}
fs.writeFileSync(path.join(CACHE, 'mapcheck.json'), JSON.stringify(out, null, 1));
console.log(out.every((r) => r.ok) ? 'Map check: PASS' : 'Map check: FAIL');
