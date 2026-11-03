// (v329.4) Makes threads-test/: a copy of the built app, one folder down, cross-origin isolated by its own service
// worker so ONNX Runtime may use more than one thread, with the threads test's timing (tools/threads-test). Its files
// (the engine, the models, fonts, icons) are the app's own, one folder up; te6.onnx (E6-mix, 46 MB) is put there by hand.
// Run after scripts/build.mjs: node scripts/threads-test.mjs
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..'),
  OUT = join(ROOT, 'threads-test'),
  SRC = join(ROOT, 'tools', 'threads-test');
let h = readFileSync(join(ROOT, 'index.html'), 'utf8');
const swap = (from, to, n) => {
  const k = h.split(from).length - 1;
  if (n != null && k !== n) throw new Error(`${from}: ${k} found, ${n} expected`);
  if (!k) throw new Error(`${from}: not found`);
  h = h.split(from).join(to);
};
// (the app's files one folder up: the engine and models, PDF.js, fonts, icons, launch screens)
swap("PDFJS_DIR = 'vendor/pdfjs/'", "PDFJS_DIR = '../vendor/pdfjs/'", 1);
swap("SUB_DIR = 'vendor/subject/'", "SUB_DIR = '../vendor/subject/'", 1);
swap("OCR_DIR = 'vendor/ocr/'", "OCR_DIR = '../vendor/ocr/'", 1);
swap('url(src/assets/', 'url(../src/assets/');
swap('href="apple-touch-icon.png"', 'href="../apple-touch-icon.png"', 1);
swap('href="src/assets/', 'href="../src/assets/', 2);
swap('href="icon-192.png', 'href="../icon-192.png', 1);
swap('href="launch/', 'href="../launch/');
// (named apart on the Home Screen, and the timing added)
swap(
  '<meta name="apple-mobile-web-app-title" content="Marker Studio">',
  '<meta name="apple-mobile-web-app-title" content="MS threads">',
  1,
);
// (the subject finder's worker, as 48-subject.js's subFind makes it, given to the timing: its functions are the guide's own)
swap(
  'function subWorkerMain() {',
  "globalThis.__msThreadsSub = () => ({ src: subMapUp.toString() + '\\n' + subBoxMean.toString() + '\\n(' + subWorkerMain.toString() + ')();', r: SUB_GF_R, eps: SUB_GF_EPS });\nfunction subWorkerMain() {",
  1,
);
swap('</body>', '<script src="subtime.js"></script>\n</body>', 1);
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'index.html'), h);
for (const f of ['service-worker.js', 'manifest.webmanifest', 'subtime.js'])
  copyFileSync(join(SRC, f), join(OUT, f));
console.log('threads-test/ made (' + Math.round(h.length / 1024) + ' KB); te6.onnx goes in it by hand');
