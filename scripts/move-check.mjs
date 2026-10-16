// Proves a move-only reorganisation of the app's main <script> changed nothing that runs.
//
//   node scripts/move-check.mjs OLD/index.html NEW/index.html [--allow name,name,...] [--acorn DIR]
//
// Reads both built pages, takes the main app script (the largest <script>, as test/harness.mjs does) and checks:
//   0. everything in index.html OUTSIDE the main script is byte-identical (the other scripts, the OCR worker text
//      block, the markup, the CSS);
//   1. no top-level name is declared twice in either script (a later function declaration would silently win);
//   2. the top-level FUNCTION declarations are the same set, each token-for-token identical (comments and whitespace
//      aside). Function declarations are hoisted and instantiated before any statement of the script runs, so their
//      position in the script does not matter — moving them is behaviour-neutral given 1;
//   3. every OTHER top-level statement (const/let/var/class, expression statements such as IIFEs and calls, try blocks,
//      if/for…) appears in the same relative order, token-for-token identical. These run in order, const/let/class have
//      a temporal dead zone, so their order is the whole of what a move could break;
//   4. a declaration named in --allow may move: it must still exist once in both, token-identical, and its initialisers
//      must be "inert": no identifier that is a top-level name of the script, no call other than a method of a string
//      literal (e.g. '...'.split(' ')), no `new` other than Set, Map or RegExp. So moving it can neither run anything
//      else's code nor read a binding that could be in its dead zone.
// Tokens: acorn's tokenizer over the statement's source, each token's exact text; so quote style, numbers, regex
// flags and template strings all count, while comments, blank lines and indentation don't.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const args = process.argv.slice(2);
const opt = (k) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : null;
};
const acorn = require(opt('--acorn') || 'acorn');
const allow = new Set((opt('--allow') || '').split(',').filter(Boolean));
const [oldPath, newPath] = args.filter(
  (a, i) => !a.startsWith('--') && (i === 0 || !args[i - 1].startsWith('--')),
);

let fails = 0;
const fail = (m) => {
  fails++;
  console.log('FAIL ' + m);
};
const ok = (m) => console.log('ok   ' + m);

function mainScript(html) {
  const ms = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)];
  const big = ms.reduce((a, m) => (m[1].length > a[1].length ? m : a));
  return {
    body: big[1],
    rest:
      html.slice(0, big.index + big[0].indexOf('>') + 1) +
      '\u0000' +
      html.slice(big.index + big[0].length - '</script>'.length),
  };
}
const parseOpts = { ecmaVersion: 'latest', sourceType: 'script', locations: true };
function tokens(src) {
  const out = [];
  for (const t of acorn.tokenizer(src, { ecmaVersion: 'latest', sourceType: 'script' })) {
    if (t.type.label === 'eof') break;
    out.push(src.slice(t.start, t.end));
  }
  return out.join('\u0001');
}
function patNames(p) {
  if (!p) return [];
  if (p.type === 'Identifier') return [p.name];
  if (p.type === 'ObjectPattern')
    return p.properties.flatMap((q) => (q.type === 'RestElement' ? patNames(q.argument) : patNames(q.value)));
  if (p.type === 'ArrayPattern') return p.elements.flatMap(patNames);
  if (p.type === 'AssignmentPattern') return patNames(p.left);
  if (p.type === 'RestElement') return patNames(p.argument);
  return [];
}
function names(n) {
  if (n.type === 'FunctionDeclaration' || n.type === 'ClassDeclaration') return n.id ? [n.id.name] : [];
  if (n.type === 'VariableDeclaration') return n.declarations.flatMap((d) => patNames(d.id));
  return [];
}
function walk(node, f) {
  if (!node || typeof node.type !== 'string') return;
  f(node);
  for (const k of Object.keys(node)) {
    if (k === 'loc') continue;
    const v = node[k];
    if (Array.isArray(v)) v.forEach((c) => c && typeof c.type === 'string' && walk(c, f));
    else if (v && typeof v.type === 'string') walk(v, f);
  }
}
// Is a declaration's initialiser inert (see 4)? Identifiers that are property keys / member property names don't count.
function inert(decl, topNames) {
  let why = null;
  for (const d of decl.declarations) {
    if (!d.init) continue;
    walk(d.init, (n) => {
      if (why) return;
      if (n.type === 'CallExpression') {
        const c = n.callee;
        if (!(
          c.type === 'MemberExpression' &&
          (c.object.type === 'Literal' || c.object.type === 'TemplateLiteral')
        ))
          why = 'calls ' + src(n).slice(0, 40);
      } else if (n.type === 'NewExpression') {
        if (!(n.callee.type === 'Identifier' && ['Set', 'Map', 'RegExp'].includes(n.callee.name)))
          why = 'new ' + src(n.callee);
      } else if (n.type === 'Identifier' && topNames.has(n.name)) why = 'reads top-level ' + n.name;
      else if (n.type === 'MemberExpression' && n.object.type === 'Identifier' && topNames.has(n.object.name))
        why = 'reads top-level ' + n.object.name;
      else if (
        ['AwaitExpression', 'YieldExpression', 'AssignmentExpression', 'UpdateExpression'].includes(n.type)
      )
        why = n.type;
    });
    // property names inside objects / member expressions were visited as Identifier: undo false positives
  }
  return why;
  function src(n) {
    return decl._src.slice(n.start - decl.start, n.end - decl.start);
  }
}
function analyse(html, label) {
  const { body, rest } = mainScript(html);
  let ast;
  try {
    ast = acorn.parse(body, parseOpts);
  } catch (e) {
    fail(`${label}: main script does not parse: ${e.message}`);
    process.exit(1);
  }
  const items = ast.body.map((n) => {
    const text = body.slice(n.start, n.end);
    n._src = text;
    return {
      node: n,
      kind: n.type,
      names: names(n),
      tok: tokens(text),
      line: n.loc.start.line,
      head: text.split('\n')[0].slice(0, 70),
    };
  });
  const all = items.flatMap((it) => it.names);
  const dup = all.filter((x, i) => all.indexOf(x) !== i);
  if (dup.length) fail(`${label}: top-level names declared twice: ${[...new Set(dup)].join(', ')}`);
  return { rest, items, topNames: new Set(all), count: ast.body.length };
}
// property keys are Identifier nodes too in acorn (key of Property when not computed, property of MemberExpression when
// not computed): mark them so `inert` ignores them
function markKeys(ast) {
  walk(ast, (n) => {
    if (n.type === 'Property' && !n.computed && n.key.type === 'Identifier') n.key.type = 'IdentifierKey';
    if (n.type === 'MemberExpression' && !n.computed && n.property.type === 'Identifier')
      n.property.type = 'IdentifierKey';
    if (n.type === 'MethodDefinition' && !n.computed && n.key.type === 'Identifier')
      n.key.type = 'IdentifierKey';
  });
}

const O = analyse(readFileSync(oldPath, 'utf8'), 'old'),
  N = analyse(readFileSync(newPath, 'utf8'), 'new');
console.log(
  `old: ${O.count} top-level statements, ${O.topNames.size} names; new: ${N.count} statements, ${N.topNames.size} names`,
);

// 0
if (O.rest === N.rest) ok('index.html outside the main script is byte-identical');
else fail('index.html outside the main script differs');

// 2: function declarations
const fns = (A) =>
  new Map(A.items.filter((it) => it.kind === 'FunctionDeclaration').map((it) => [it.names[0], it]));
const fo = fns(O),
  fn = fns(N);
let fnBad = 0;
for (const [k, it] of fo) {
  if (!fn.has(k)) {
    fail(`function ${k} (old line ${it.line}) is missing in new`);
    fnBad++;
  } else if (fn.get(k).tok !== it.tok) {
    fail(`function ${k} differs (old line ${it.line}, new line ${fn.get(k).line})`);
    fnBad++;
  }
}
for (const [k, it] of fn)
  if (!fo.has(k)) {
    fail(`function ${k} (new line ${it.line}) was not in old`);
    fnBad++;
  }
if (!fnBad) ok(`${fo.size} top-level function declarations: same set, each token-identical`);

// 3 + 4: everything else, in order
const others = (A) => A.items.filter((it) => it.kind !== 'FunctionDeclaration');
const oo = others(O),
  no = others(N);
const isAllowed = (it) => it.names.some((x) => allow.has(x));
const seqO = oo.filter((it) => !isAllowed(it)),
  seqN = no.filter((it) => !isAllowed(it));
let seqBad = 0;
const L = Math.max(seqO.length, seqN.length);
for (let i = 0; i < L; i++) {
  const a = seqO[i],
    b = seqN[i];
  if (!a || !b || a.tok !== b.tok) {
    seqBad++;
    fail(
      `order-sensitive statement #${i} differs:\n       old${a ? ` line ${a.line}: ${a.head}` : ': (none)'}\n       new${b ? ` line ${b.line}: ${b.head}` : ': (none)'}`,
    );
    if (seqBad > 5) {
      fail('…more');
      break;
    }
  }
}
if (!seqBad)
  ok(
    `${seqO.length} order-sensitive top-level statements (const/let/var/class, calls, IIFEs, try, …): same sequence, each token-identical`,
  );

// For a moved declaration: what runs at load between its old and new place could read it (moved later: a reader that
// used to find it initialised now hits its dead zone; moved earlier: a reader whose ReferenceError was caught today
// now succeeds). So: the order-sensitive statements between the two places (in the NEW script) must not mention its
// names, nor call (at load, i.e. outside nested function bodies, IIFE bodies included) any top-level function that
// mentions them — transitively through the functions those call, every call in their bodies counted (conservative).
const fnInfo = new Map(); // name → { mentions: Set, calls: Set }: top-level function declarations AND
// top-level const/let/var whose initialiser is a function or arrow (e.g. core.js `const $ = (id) => …`)
const callables = [];
for (const it of N.items) {
  if (it.kind === 'FunctionDeclaration') callables.push([it.names[0], it.node.body]);
  else if (it.kind === 'VariableDeclaration')
    for (const d of it.node.declarations)
      if (
        d.id.type === 'Identifier' &&
        d.init &&
        ['FunctionExpression', 'ArrowFunctionExpression'].includes(d.init.type)
      )
        callables.push([d.id.name, d.init.body]);
}
const callable = new Set(callables.map(([n]) => n));
for (const [name, body] of callables) {
  const mentions = new Set(),
    calls = new Set();
  markKeys(body);
  walk(body, (n) => {
    if (n.type === 'Identifier') mentions.add(n.name);
    if (n.type === 'CallExpression' && n.callee.type === 'Identifier' && callable.has(n.callee.name))
      calls.add(n.callee.name);
  });
  fnInfo.set(name, { mentions, calls });
}
function loadTime(stmt) {
  // identifiers mentioned and top-level functions called at load by an order-sensitive statement
  const mentions = new Set(),
    calls = new Set();
  markKeys(stmt);
  (function go(n, deferred) {
    if (!n || typeof n.type !== 'string') return;
    if (n.type === 'Identifier') mentions.add(n.name);
    if (
      n.type === 'CallExpression' &&
      n.callee.type === 'Identifier' &&
      callable.has(n.callee.name) &&
      !deferred
    )
      calls.add(n.callee.name);
    for (const k of Object.keys(n)) {
      if (k === 'loc') continue;
      const v = n[k];
      const kids = Array.isArray(v) ? v : [v];
      for (const c of kids) {
        if (!c || typeof c.type !== 'string') continue;
        let d = deferred;
        if (['FunctionExpression', 'ArrowFunctionExpression', 'FunctionDeclaration'].includes(c.type))
          d = deferred || !(n.type === 'CallExpression' && k === 'callee'); // an IIFE's body runs now
        go(c, d);
      }
    }
  })(stmt, false);
  return { mentions, calls };
}
function reachable(calls) {
  const seen = new Set();
  const stack = [...calls];
  while (stack.length) {
    const f = stack.pop();
    if (seen.has(f)) continue;
    seen.add(f);
    for (const g of fnInfo.get(f).calls) stack.push(g);
  }
  return seen;
}
for (const name of allow) {
  const a = oo.filter((it) => it.names.includes(name)),
    b = no.filter((it) => it.names.includes(name));
  if (a.length !== 1 || b.length !== 1) {
    fail(`--allow ${name}: found ${a.length} in old, ${b.length} in new`);
    continue;
  }
  if (a[0].tok !== b[0].tok) {
    fail(`--allow ${name}: statement differs`);
    continue;
  }
  if (b[0].kind !== 'VariableDeclaration') {
    fail(`--allow ${name}: not a variable declaration`);
    continue;
  }
  markKeys(b[0].node);
  const why = inert(b[0].node, N.topNames);
  if (why) {
    fail(`--allow ${name}: initialiser is not inert (${why}); moving it is not proven safe`);
    continue;
  }
  // the statements between the old and the new place, by position in the order-sensitive sequence
  const iOld = seqO.findIndex((it) => it.line > a[0].line), // first order-sensitive statement after it in old
    iNew = seqN.findIndex((it) => it.line > b[0].line);
  const lo = Math.min(iOld < 0 ? seqO.length : iOld, iNew < 0 ? seqN.length : iNew),
    hi = Math.max(iOld < 0 ? seqO.length : iOld, iNew < 0 ? seqN.length : iNew);
  const between = seqN.slice(lo, hi),
    mine = new Set(b[0].names);
  let bad = 0;
  const touched = new Set();
  for (const st of between) {
    const { mentions, calls } = loadTime(st.node);
    const reach = reachable(calls);
    const direct = [...mine].filter((x) => mentions.has(x));
    const via = [...reach].filter((f) => [...mine].some((x) => fnInfo.get(f).mentions.has(x)));
    if (direct.length || via.length) {
      bad++;
      fail(
        `--allow ${name}: load-time code between its old and new place could read it: new line ${st.line} "${st.head}"${direct.length ? ' mentions ' + direct : ''}${via.length ? ' calls (transitively) ' + via.slice(0, 5).join(', ') : ''}`,
      );
    }
    for (const f of calls) touched.add(f);
  }
  if (!bad)
    ok(
      `--allow ${name}: moved ${b[0].line > a[0].line ? 'later' : 'earlier'} (old line ${a[0].line} → new line ${b[0].line}); token-identical; initialiser inert; nothing of the ${between.length} order-sensitive statements it moved past reads it at load (they call at load: ${[...touched].join(', ') || 'no top-level function'})`,
    );
}

// anything whose names changed kind (e.g. a function became a const)
const kindOf = (A) => new Map(A.items.flatMap((it) => it.names.map((x) => [x, it.kind])));
const ko = kindOf(O),
  kn = kindOf(N);
for (const [k, v] of ko) if (kn.has(k) && kn.get(k) !== v) fail(`${k} changed kind: ${v} → ${kn.get(k)}`);
for (const k of ko.keys()) if (!kn.has(k)) fail(`name ${k} gone`);
for (const k of kn.keys()) if (!ko.has(k)) fail(`name ${k} new`);

console.log(
  fails
    ? `\n${fails} problem(s)`
    : '\nALL CHECKS PASSED: the new main script is the old one with its top-level pieces moved',
);
process.exit(fails ? 1 : 0);
