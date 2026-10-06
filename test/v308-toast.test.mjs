// v308: toast() shows its message as plain text; a message built as HTML goes through toastHTML / toastActionHTML.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
