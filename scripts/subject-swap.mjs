// Swap the app's subject finder for a new model file (round 6's winner, step 6's results/models/subject-<name>-<side>-w8.onnx):
//   node scripts/subject-swap.mjs --onnx <file> --ver 5 --name te6 --side 576
// Copies it to vendor/subject/<ver>/subject-<name>.onnx with the old folder's LICENSE-TRACER, removes the old folder, and
// sets SUB_VER, the file's name, size and SHA-256 and SUB_SIDE (48-subject.js), SUBC (service-worker.js) and the download
// size in What's new (help.js: the Focus line only). Prose (48-subject.js's top comment, vendor/subject/README.md,
// CHANGES.md) and the bench's default map are left for a person: it prints them. Then npm run build.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k) => {
  const i = process.argv.indexOf(k);
  return i > 0 ? process.argv[i + 1] : null;
};
const src = arg('--onnx'),
  ver = arg('--ver'),
  name = arg('--name'),
  side = +arg('--side');
if (!src || !ver || !name || !(side > 0)) {
  console.error('usage: node scripts/subject-swap.mjs --onnx <file> --ver <n> --name <te6> --side <576>');
  process.exit(2);
}
const sub = path.join(ROOT, 'src/js/guide/48-subject.js'),
  sw = path.join(ROOT, 'service-worker.js'),
  help = path.join(ROOT, 'src/js/help.js');
let s = fs.readFileSync(sub, 'utf8');
const old = /const SUB_VER = '(\d+)'/.exec(s)[1];
if (old === ver) {
  console.error('SUB_VER is already ' + ver);
  process.exit(2);
}
const buf = fs.readFileSync(src),
  n = buf.length,
  h = crypto.createHash('sha256').update(buf).digest('hex'),
  file = 'subject-' + name + '.onnx',
  od = path.join(ROOT, 'vendor/subject', old),
  nd = path.join(ROOT, 'vendor/subject', ver);
fs.mkdirSync(nd, { recursive: true });
fs.writeFileSync(path.join(nd, file), buf);
fs.copyFileSync(path.join(od, 'LICENSE-TRACER'), path.join(nd, 'LICENSE-TRACER'));
fs.rmSync(od, { recursive: true });
const rep = (str, re, to, what) => {
  if (!re.test(str)) throw new Error('not found: ' + what);
  return str.replace(re, to);
};
s = rep(s, /const SUB_VER = '\d+'/, `const SUB_VER = '${ver}'`, 'SUB_VER');
s = rep(s, /f: 'subject-[a-z0-9]+\.onnx'/, `f: '${file}'`, 'the file name');
s = rep(s, /n: \d+,(\s+h: ')[0-9a-f]{64}'/, `n: ${n},$1${h}'`, 'the size and hash');
s = rep(s, /SUB_SIDE = \d+/, `SUB_SIDE = ${side}`, 'SUB_SIDE');
fs.writeFileSync(sub, s);
let w = fs.readFileSync(sw, 'utf8');
w = rep(w, /const SUBC='marker-studio-subject-\d+'/, `const SUBC='marker-studio-subject-${ver}'`, 'SUBC');
fs.writeFileSync(sw, w);
const mb = Math.round(n / 1e6);
let hp = fs.readFileSync(help, 'utf8');
hp = rep(hp, /(quicker finder \(a one-time download of about )\d+( MB\))/, `$1${mb}$2`, 'the What’s new size');
fs.writeFileSync(help, hp);
console.log(`subject finder: version ${old} -> ${ver}, ${file}, ${(n / 1e6).toFixed(1)} MB, sha256 ${h}, input ${side}`);
console.log('Still to do by hand: 48-subject.js top comment and service-worker.js comment (model, MB, size), vendor/subject/README.md,');
console.log(`CHANGES.md, What’s new wording ("quicker" for a slower model?), scripts/bench/pp_maps.py's default model and the`);
console.log("bench's default map tag; then npm run build, the subject browser tests and the bench's map check.");
