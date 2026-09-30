// Lints the app's JS as it ships (see eslint.config.mjs for why it isn't linted file by file) and
// reports each problem against its src/ file and line.
//
//   node scripts/lint.mjs            counts per rule and per file
//   node scripts/lint.mjs --verbose  also every message, as src/file.js:line:col
//   node scripts/lint.mjs --json     machine-readable
//   node scripts/lint.mjs --strict   exit 1 when there are errors (not used by CI yet)
//   node scripts/lint.mjs --rule no-undef   only that rule (repeatable; implies --verbose listing)
//
// Without --strict this always exits 0: the lint is informational until the cleanup gets there.
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { blocks, locate } from './lib/bundle.mjs';
import { BUNDLE_PATH } from '../eslint.config.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const onlyRules = args.flatMap((a, i) => (a === '--rule' ? [args[i + 1]] : []));

// The <script> blocks share one global scope in the page, so they are linted as one text,
// joined by a newline. Segments keep track of which src/ file each line came from.
const bs = await blocks(ROOT, 'js');
let text = '';
const segments = [];
for (const b of bs) {
  if (text) text += '\n';
  const base = text.length;
  for (const s of b.shippedSegments) segments.push({ rel: s.rel, start: base + s.start, end: base + s.end });
  text += b.shipped;
}

const eslint = new ESLint({ cwd: ROOT });
const [result] = await eslint.lintText(text, { filePath: join(ROOT, BUNDLE_PATH) });
if (!result) throw new Error(`ESLint ignored ${BUNDLE_PATH}; check eslint.config.mjs`);

let messages = result.messages.map((m) => {
  const at = locate(text, segments, m.line);
  return {
    rule: m.ruleId || (m.fatal ? 'parse-error' : 'other'),
    severity: m.severity === 2 ? 'error' : 'warning',
    file: at.rel ? `src/${at.rel}` : 'src/index.template.html (template glue)',
    line: at.line,
    column: m.column,
    message: m.message,
  };
});
if (onlyRules.length) messages = messages.filter((m) => onlyRules.includes(m.rule));

const byRule = {},
  byFile = {};
for (const m of messages) {
  byRule[m.rule] ??= { severity: m.severity, count: 0 };
  byRule[m.rule].count++;
  byFile[m.file] ??= {};
  byFile[m.file][m.rule] = (byFile[m.file][m.rule] || 0) + 1;
}
const errors = messages.filter((m) => m.severity === 'error').length;
const warnings = messages.length - errors;

if (has('--json')) {
  console.log(JSON.stringify({ errors, warnings, byRule, byFile, messages }, null, 2));
} else {
  if (has('--verbose') || onlyRules.length) {
    for (const m of messages)
      console.log(`${m.file}:${m.line}:${m.column}  ${m.severity}  ${m.message}  (${m.rule})`);
    console.log('');
  }
  console.log(
    `ESLint on the shipped app script (${bs.reduce((n, b) => n + b.files.length, 0)} files): ${errors} errors, ${warnings} warnings`,
  );
  console.log('\nper rule:');
  for (const [rule, r] of Object.entries(byRule).sort((a, b) => b[1].count - a[1].count)) {
    console.log(`  ${rule.padEnd(16)} ${String(r.count).padStart(5)}  (${r.severity})`);
  }
  console.log('\nper file:');
  const rules = Object.keys(byRule);
  for (const [file, counts] of Object.entries(byFile).sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`  ${file.padEnd(34)} ${rules.map((r) => `${r} ${counts[r] || 0}`).join(', ')}`);
  }
}
process.exitCode = has('--strict') && errors ? 1 : 0;
