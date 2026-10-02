/* ===== Scan or type codes (Markers › Scan or type codes, v296) =====
   Add markers by their codes: typed, pasted (a list from notes or a spreadsheet), or read off the caps with the
   iPad's or iPhone's Scan Text (AutoFill › Scan Text in the box), which puts what the camera reads into the box as
   you aim, one marker after another. The page can't see the camera; it reads what arrives in the box. What's read
   collects in a list to check (each with its colour), and Add puts the new ones in the collection in one go.
   Reading: only real codes count, with the usual mix-ups put right (BO15 → B015, 8G011 → BG011); the colour name,
   when it comes along, confirms the code and picks the brand of a code both brands use; a cap read upside down
   (E19 comes out as "6L3") is turned the right way round, and asked about when that could be two codes. */
const SCAN_NUM = { O: '0', Q: '0', D: '0', I: '1', L: '1', T: '1', S: '5', B: '8', Z: '2', G: '6' };
const SCAN_LET = { 0: 'O', 1: 'I', 8: 'B', 6: 'G', 9: 'G', 5: 'S', 2: 'Z' };
// a character read upside down → what it is the right way up (some could be two things)
const SCAN_FLIP = {
  9: '6G',
  6: '9',
  L: '17',
  Z: '2',
  2: 'Z2',
  E: '3',
  3: 'E',
  A: 'VY',
  V: 'A',
  人: 'Y',
  '⅄': 'Y',
  Λ: 'Y',
  H: '4',
  Ч: '4',
  0: '0G',
  O: '0G',
  D: '0',
  8: '8B',
  日: 'B',
  S: 'S5',
  5: 'S5',
  B: 'B8',
  と: 'R',
  ᴚ: 'R',
  ɹ: 'R',
  1: '1',
  I: '1',
  N: 'N',
  X: 'X',
  W: 'M',
  M: 'W',
  C: 'C',
  G: '9',
  レ: '1',
  ﾚ: '1',
  タ: 'R',
  ク: 'R',
};
let _scanIx = null;
const scanKey = (s) =>
  String(s)
    .normalize('NFKC')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
// codes as they are now; Ohuhu's old codes (on the caps of older sets) as well; the colour names
function scanIndex() {
  if (_scanIx) return _scanIx;
  const byCode = new Map(),
    byOld = new Map(),
    names = [];
  const put = (m, k, i) => {
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(i);
  };
  COLORS.forEach(function (c, i) {
    put(byCode, scanKey(c.code), i);
    if (c.old && scanKey(c.old) !== scanKey(c.code)) put(byOld, scanKey(c.old), i);
    const n = scanKey(c.name || '');
    // (its words too: a short name, Fig or Tea, counts only as a word of its own)
    if (n.length >= 3) names.push([n, i, scanWords(c.name || '')]);
  });
  return (_scanIx = { byCode: byCode, byOld: byOld, names: names });
}
const scanWords = (s) =>
  String(s)
    .normalize('NFKC')
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);
// words on the caps and their labels that are never a code, nor the reason a number-only code (0, 120) isn't one
const SCAN_NOISE =
  /^(OHUHU|HONOLULU|COPIC|SKETCH|CIAO|CLASSIC|ALCOHOL|ART|ARTS|MARKERS?|BRUSH|FINE|CHISEL|DUAL|TIPS?|NO|\d{8,})$/;
// whether a word is a code as read, now or an old one
function scanIsCode(x) {
  const ix = scanIndex();
  return ix.byCode.has(x) || ix.byOld.has(x);
}
// a brand's name on the cap
const SCAN_BRANDS = [
  [/OHUHU|HONOLULU/, 'Ohuhu'],
  [/COPIC|SKETCH|CIAO/, 'Copic'],
];
// the text as read first, then every split into a letter part (up to 3) and a number part with its mix-ups put right
function scanVariants(t) {
  const out = [t];
  for (let k = 0; k <= Math.min(3, t.length - 1); k++) {
    const pre = t.slice(0, k).replace(/[0-9]/g, (c) => SCAN_LET[c] || c),
      num = t.slice(k).replace(/[A-Z]/g, (c) => SCAN_NUM[c] || c);
    if (/^[A-Z]*$/.test(pre) && /^[0-9]+$/.test(num) && out.indexOf(pre + num) < 0) out.push(pre + num);
  }
  return out;
}
// the codes a word could be if it was read upside down (reversed, each character turned round)
function scanFlipped(t, has) {
  const cs = [...t].reverse();
  if (cs.length < 2 || cs.length > 6) return [];
  let combos = [''];
  for (const c of cs) {
    const o = SCAN_FLIP[c];
    if (!o) return [];
    const next = [];
    for (const p of combos) for (const x of o) next.push(p + x);
    combos = next;
    if (combos.length > 512) return [];
  }
  return [...new Set(combos.filter(has))];
}
// characters only an upside-down read gives (a turned Y, B, R…)
const SCAN_TURNED = '人⅄Λ日とᴚɹレタクﾚЧ';
// the codes a word could be read upside down, with the longer codes whose first letter could have been lost
// (YR213 read as R213): [] when it isn't worth trying (no digit and no turned character: "Sea" isn't Y35)
function scanTurned(t, has) {
  if (!/[0-9]/.test(t) && ![...t].some((c) => SCAN_TURNED.indexOf(c) >= 0)) return [];
  const f = scanFlipped(t, has);
  if (!f.length || f.length > 4) return [];
  const ix = scanIndex(),
    like = new Set();
  f.forEach(function (x) {
    ix.byCode.forEach(function (is, c) {
      if (c.length <= x.length + 2 && c.slice(-x.length) === x && has(c)) like.add(c);
    });
  });
  return [...like];
}
// What a piece of read text holds. brand: '' for either, or the brand chosen above the box.
// → { codes: [{ code, opts: [colour indices], named, fixed, old, asked }], byName: index or -1, flips: [{ as, opts }],
//     other: [markers read whose brand isn't the one chosen] }
// A code with more than one option is asked about: asked 'name' (the code read and the colour name read disagree),
// 'turned' (a misread put right, or another code upside down: "603"), 'old' (an old code that's now another
// marker's), else two brands' (B04).
function scanRead(text, brand) {
  // a list (a paste): each line on its own, so one line's colour name can't settle another line's code
  const lines = String(text || '')
    .split(/[\r\n]+/)
    .filter((l) => l.trim());
  // (v298: every line counts — one with only a name, another brand's code or a code upside down too, as a question
  // in the list — and the same code is one entry only when it's the same marker: B04 Copic on one line and B04 Ohuhu
  // on another are two)
  if (lines.length > 1) {
    const out = { codes: [], byName: -1, flips: [], other: [], names: [], many: true },
      seen = {};
    lines.forEach(function (l) {
      const r = scanRead(l, brand);
      r.codes.forEach(function (c) {
        const k = c.code + '|' + c.opts.join(',');
        if (!seen[k]) out.codes.push(c);
        seen[k] = 1;
      });
      out.flips.push(...r.flips);
      if (r.byName >= 0 && out.names.indexOf(r.byName) < 0) out.names.push(r.byName);
      r.other.forEach((i) => out.other.indexOf(i) < 0 && out.other.push(i));
    });
    return out;
  }
  const ix = scanIndex(),
    chosen = (i) => !brand || COLORS[i].brand === brand,
    has = (c) => ix.byCode.has(c) && ix.byCode.get(c).some(chosen);
  // (full-width letters and digits as plain ones; a turned Y read as ¥)
  const up = String(text || '')
    .normalize('NFKC')
    .toUpperCase()
    .replace(/¥/g, 'Y');
  // a brand's name on the cap: settles a code both brands use
  const hints = SCAN_BRANDS.filter((b) => b[0].test(up)).map((b) => b[1]),
    hint = hints.length === 1 ? hints[0] : '';
  // words; one with a turned character is left to the upside-down reading below; a dash on its own is dropped
  // ("C - 3")
  const words = up.split(new RegExp('[^A-Z0-9' + SCAN_TURNED + '-]+')).filter((w) => w && !/^-+$/.test(w));
  const toks = words.map((t) => (/[A-Z0-9]/.test(t) && !/[^A-Z0-9-]/.test(t) ? t.replace(/-/g, '') : null));
  const tries = [];
  toks.forEach(function (t, i) {
    if (!t) return;
    tries.push({ t: t });
    // a code with its name run on ("B015CELADON")
    const g = /^([A-Z]{1,3}[0-9]{1,4})[A-Z]{3,}$/.exec(t);
    if (g) tries.push({ t: g[1] });
    // a code read in two pieces ("YG 06"): only as it is, no misreads put right across the gap, and only when
    // neither piece is a code of its own (v299: "E00 0", Copic E00 with the blender beside it, was read as E000, and a
    // count after a code, "BG21 1", as BG211)
    // ("C - 0" is still C-0: a first piece of letters only joins whatever follows)
    const u = toks[i + 1];
    if (u && (t + u).length <= 6 && (!/\d/.test(t) || (!scanIsCode(t) && !scanIsCode(u))))
      tries.push({ t: t + u, joined: true });
  });
  // the colour names in the text, of either brand: its words in a row ("Cool Gray No.1"), or run together when the
  // name is long enough not to turn up inside other words ("LightSalmon"); the longest (Honey Brown, not Honey too)
  const tw = scanWords(up),
    joined = tw.join('');
  const inRow = (nw) => {
    for (let k = 0; k + nw.length <= tw.length; k++) if (nw.every((w, j) => tw[k + j] === w)) return true;
    return false;
  };
  const hit = ix.names.filter((n) => inRow(n[2]) || (n[0].length >= 6 && joined.indexOf(n[0]) >= 0));
  const named = new Set(
    hit
      .filter((n) => !hit.some((m) => m[0].length > n[0].length && m[0].indexOf(n[0]) >= 0))
      .map((n) => n[1]),
  );
  const namedOk = [...named].filter(chosen),
    // (the words of the names read: beside codes, still caps in view)
    nameWords = new Set([].concat(...[...named].map((i) => scanWords(COLORS[i].name || ''))));
  const codes = [],
    seen = {},
    other = new Set();
  for (const tr of tries) {
    const t = tr.t;
    if (t.length > 6) continue;
    // another brand's code exactly as read, or with that brand's colour name: said so, not bent into a code of the
    // brand chosen (Copic YG11 isn't Ohuhu Y611 misread; Copic B04 Tahitian Blue isn't Ohuhu B04)
    if (brand) {
      const ex = ix.byCode.get(t) || [];
      const otherNamed = [...named].filter((i) => !chosen(i) && scanKey(COLORS[i].code) === t);
      if ((ex.length && !ex.some(chosen)) || otherNamed.length) {
        (otherNamed.length ? otherNamed : ex).forEach((i) => other.add(i));
        continue;
      }
    }
    // every reading of the word that is a real code, as now or an old Ohuhu code; misreads are put right only in a
    // word that has a digit ("Egg" isn't E66, "Bog" isn't B06, "No" isn't N-0)
    const cands = [];
    for (const v of /\d/.test(t) && !tr.joined ? scanVariants(t) : [t]) {
      const cur = ix.byCode.get(v) || [],
        // (a code made of two words is a code as it is now, not an old one: "E17 0" isn't E170, E58's old code)
        old = tr.joined ? [] : (ix.byOld.get(v) || []).filter((i) => cur.indexOf(i) < 0),
        all = cur.concat(old);
      if (!all.length) continue;
      // a code that's only a number (0, 100, 120): only as read and on its own, or with its name
      // (words on every cap don't count: "Copic 0", "Ohuhu 120" are the code, v299)
      // (as read beside other codes only, two caps in view, "E43 120": asked about rather than dropped, v299)
      let numAsk = false;
      if (
        /^\d+$/.test(v) &&
        (v !== t || toks.filter((x) => x && !SCAN_NOISE.test(x)).length > 1) &&
        !all.some((i) => named.has(i))
      ) {
        // (not a word of a name read: "Cool Gray No.0")
        if (
          v !== t ||
          tr.joined ||
          nameWords.has(t) ||
          !toks.every((x) => !x || x === t || SCAN_NOISE.test(x) || scanIsCode(x) || nameWords.has(x))
        )
          continue;
        numAsk = true;
      }
      const opts = all.filter(chosen);
      if (!opts.length) continue;
      const withName = opts.filter((i) => named.has(i));
      cands.push({
        code: v,
        opts: withName.length ? withName : opts,
        named: withName.length > 0,
        fixed: v !== t,
        old: (withName.length ? withName : opts).every((i) => old.indexOf(i) >= 0),
        asked: '',
        hadOld: old.length > 0 && cur.some(chosen),
        numAsk: numAsk,
      });
    }
    if (!cands.length) continue;
    // the reading the colour name agrees with (YG11 read with "Dark Sand" is Ohuhu Y611), else the text as read
    const c = cands.find((x) => x.named) || cands[0];
    // the other brand's name on the cap: that brand's code, said so, not added as the brand chosen ("Ohuhu B04" with
    // Copic chosen had added Copic B04, v299)
    if (brand && hint && hint !== brand && !c.named) {
      const hb = (ix.byCode.get(c.code) || []).filter((i) => COLORS[i].brand === hint);
      if (hb.length) {
        hb.forEach((i) => other.add(i));
        continue;
      }
    }
    if (seen[c.code]) continue;
    seen[c.code] = 1;
    c.t = t;
    codes.push(c);
  }
  // A colour name read that another code in the text already accounts for settles nothing more: two caps in view,
  // R46 and R48, with R46's "Old Rose" read, are R46 and R48, not a question about R48 (v298: they were)
  const told = new Set();
  codes.forEach((c) => c.named && c.opts.forEach((i) => told.add(i)));
  const loose = namedOk.filter((i) => !told.has(i));
  codes.forEach(function (c) {
    if (c.numAsk) c.asked = 'num';
    // (a brand's name on the cap, and a code that brand hasn't: "Ohuhu … 0" isn't simply Copic 0, v299)
    else if (hint && !c.named && !c.opts.some((i) => COLORS[i].brand === hint)) c.asked = 'hint';
    else if (!c.named && loose.length) {
      // the colour name read says another marker (R4b with "Old Rose": R48 read, R46 named): ask between them
      loose.forEach((i) => c.opts.indexOf(i) < 0 && c.opts.push(i));
      c.asked = 'name';
    } else if (!c.named && c.hadOld) {
      // an old code that's now another marker's (R25 was Pale Blue Violet, now BV26; R25 is Tender Pink): ask
      c.asked = 'old';
    } else if (c.fixed && !c.named) {
      // a reading put right that could also be another code read upside down: ask
      const turned = scanTurned(c.t, has).filter((x) => x !== c.code);
      if (turned.length) {
        turned.forEach((x) =>
          ix.byCode
            .get(x)
            .filter(chosen)
            .forEach((i) => c.opts.indexOf(i) < 0 && c.opts.push(i)),
        );
        c.asked = 'turned';
      }
    }
    // the brand's name on the cap settles a code both brands use
    if (!c.asked && c.opts.length > 1 && hint) {
      const h = c.opts.filter((i) => COLORS[i].brand === hint);
      if (h.length === 1) c.opts = h;
    }
    delete c.hadOld;
    delete c.numAsk;
    delete c.t;
  });
  // (another brand's cap read with this brand's: asked about in the list, not dropped, v299)
  if (codes.length) return { codes: codes, byName: -1, flips: [], other: [...other] };
  // another brand's code (with that brand chosen): that, not a reading of something else
  if (other.size) return { codes: [], byName: -1, flips: [], other: [...other] };
  if (namedOk.length === 1) return { codes: [], byName: namedOk[0], flips: [], other: [] };
  if (!namedOk.length && named.size === 1) return { codes: [], byName: -1, flips: [], other: [...named] };
  // nothing the right way up: each word as if it was read upside down
  const flips = [];
  for (const t of words) {
    // (a number-only code as read, 120, isn't BG21 upside down; nor is a word on every cap, v299)
    if ((/^\d+$/.test(t) && ix.byCode.has(t)) || SCAN_NOISE.test(t)) continue;
    const like = scanTurned(t, has);
    if (like.length)
      flips.push({ as: t, opts: [].concat(...like.map((x) => ix.byCode.get(x).filter(chosen))) });
  }
  return { codes: [], byName: -1, flips: flips, other: [] };
}

/* ---- the dialog ---- */
// The list, newest first, kept while the app is open: { i: colour index, how: '' | 'upside' | 'name' | 'chosen' }, or a
// question to answer before it counts: { ask: key, title, opts: [{ i, how }] } (two brands' B04, a code that could be
// either way up). Questions wait in the list, so sweeping on from cap to cap loses none.
const SCAN_BRAND_KEY = 'ms-scan-brand';
let scanList = [],
  scanBrand = '',
  scanOpener = null,
  scanAudio = null,
  scanLast = { i: -1, at: 0 },
  scanLastMany = { key: '', at: 0 },
  // the box's wait for Scan Text's text to hold still, and the text last read from it
  scanStill = null,
  scanText = '';
try {
  scanBrand = localStorage.getItem(SCAN_BRAND_KEY) || '';
} catch (_) {}
function scanBeep(kind) {
  try {
    if (!scanAudio) scanAudio = new (window.AudioContext || window.webkitAudioContext)();
    if (scanAudio.state === 'suspended') scanAudio.resume();
    const tones =
      kind === 'ok'
        ? [
            [880, 0],
            [1320, 0.09],
          ]
        : kind === 'same'
          ? [[520, 0]]
          : [
              [220, 0],
              [196, 0.12],
            ];
    for (const [f, at] of tones) {
      const o = scanAudio.createOscillator(),
        g = scanAudio.createGain(),
        t0 = scanAudio.currentTime + at;
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.2, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
      o.connect(g).connect(scanAudio.destination);
      o.start(t0);
      o.stop(t0 + 0.14);
    }
  } catch (_) {}
}
const scanName = (i) => COLORS[i].code + ' ' + COLORS[i].name;
const scanBrandOf = (i) => ' · ' + COLORS[i].brand;
const scanNew = () => scanList.filter((e) => !e.ask && !state.owned.has(mkey(e.i)));
const scanAsks = () => scanList.filter((e) => e.ask).length;
// the card under the box: what the last read did. kind: ok, same, ask, none; choices: buttons to add with
function scanSay(kind, big, small, i, choices) {
  const el = $('scStat');
  if (!el) return;
  el.className = 'scstat ' + kind;
  el.innerHTML =
    '<span class="scmark" aria-hidden="true">' +
    // (waiting: the crosshair, as for Match a colour; a "·" there read as a stray speck, v300)
    ({ ok: '✓', same: '=', ask: '?', none: '✕' }[kind] || ic('crosshair')) +
    '</span>' +
    (i >= 0 ? '<span class="scsw" style="background:' + COLORS[i].hex + '"></span>' : '') +
    '<span class="sctext"><b></b><span></span></span>';
  el.querySelector('b').textContent = big;
  el.querySelector('.sctext span').textContent = small;
  if (choices && choices.length) {
    const row = document.createElement('span');
    row.className = 'scpick';
    choices.forEach(function (c) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = c.label;
      b.addEventListener('click', function () {
        scanTake(c.i, c.how, true);
        scanFocusBox();
      });
      row.appendChild(b);
    });
    el.querySelector('.sctext').appendChild(row);
  }
}
// into the list. loud: said and sounded even when it's the marker just read (a read from the camera holding still on
// one cap comes again and again: only the first says so)
function scanTake(i, how, loud, batch) {
  const now = Date.now(),
    again = !loud && scanLast.i === i && now - scanLast.at < 6000;
  scanLast = { i: i, at: now };
  if (scanList.some((e) => e.i === i)) {
    if (!again && !batch) {
      scanSay('same', scanName(i), 'Already in the list' + scanBrandOf(i), i);
      scanBeep('same');
    }
    return false;
  }
  scanList.unshift({ i: i, how: how || '' });
  if (batch) return true;
  const mine = state.owned.has(mkey(i));
  scanSay(
    'ok',
    scanName(i),
    (mine ? 'Already in your collection' : 'Added to the list') +
      scanBrandOf(i) +
      (how === 'upside' ? ' · read upside down, check it' : how === 'old' ? ' · by its old code' : ''),
    i,
  );
  scanBeep(mine ? 'same' : 'ok');
  scanRender();
  return true;
}
// a question for the list (once per key)
function scanAsk(key, title, opts, batch, loud) {
  // (asked already: the same question waiting)
  if (scanList.some((e) => e.ask === key)) return false;
  // (one of its answers was read a moment ago: the same cap, still in view with less of it read, isn't asked about.
  // v299: once any answer was in the list it was never asked, so after Ohuhu B04, Copic B04's cap was lost)
  if (!batch && !loud && Date.now() - scanLast.at < 2500 && opts.some((o) => o.i === scanLast.i)) {
    // (still in view: the moment runs on while it's read again and again)
    scanLast.at = Date.now();
    return false;
  }
  scanList.unshift({ ask: key, title: title, opts: opts });
  if (batch) return true;
  scanSay('ask', title, 'Choose in the list below', -1);
  scanBeep('same');
  scanRender();
  return true;
}
// A card said once while the camera holds still on what it's about (the same name, the same other brand's code):
// again only after a while, or on Enter (v298: it buzzed and was said again every time the text settled)
let scanLastCard = { key: '', at: 0 };
function scanCardAgain(key, loud) {
  const now = Date.now(),
    again = !loud && scanLastCard.key === key && now - scanLastCard.at < 6000;
  scanLastCard = { key: key, at: now };
  return again;
}
// A piece of text from the box. loud: Enter or a paste, said even when nothing in it is a code. Returns how many
// markers or questions it held (0: nothing to clear the box for).
function scanHandle(text, loud) {
  if (!String(text).trim()) return 0;
  const r = scanRead(text, scanBrand);
  let n = 0;
  // several at once (a pasted list): into the list together, then said once
  // (another brand's codes read along with codes of the brand chosen, or in a list, are questions in the list)
  const others = r.many || r.codes.length ? r.other : [],
    many = r.codes.length + (r.many ? r.flips.length + r.names.length : 0) + others.length > 1,
    len0 = scanList.length;
  let took = 0,
    asked = 0;
  const ask = function (key, title, opts) {
    if (scanAsk(key, title, opts, many, loud)) asked++;
    else if (!many && loud) {
      // (said when it's typed: the question is waiting in the list already)
      scanSay('same', title, 'Waiting in the list below', -1);
      scanBeep('same');
    }
  };
  r.codes.forEach(function (c) {
    n++;
    if (c.asked === 'num' || c.asked === 'hint') {
      ask(
        c.asked + ' ' + c.code,
        c.asked === 'num'
          ? c.code + ' was read beside other codes: is it this one?'
          : c.code + ' isn\u2019t a code of the brand on the cap: is it this one?',
        c.opts.map((i) => ({ i: i, how: 'chosen' })),
      );
      return;
    }
    if (c.opts.length === 1) {
      if (scanTake(c.opts[0], c.old ? 'old' : c.named ? 'name' : '', loud, many)) took++;
      return;
    }
    const codeOf = (i) => scanKey(COLORS[i].code),
      others = [...new Set(c.opts.filter((i) => codeOf(i) !== c.code).map((i) => COLORS[i].code))];
    if (c.asked === 'turned')
      ask(
        'turned ' + c.code,
        c.code + ', or ' + others.join(' or ') + ' upside down?',
        c.opts.map((i) => ({ i: i, how: codeOf(i) === c.code ? 'chosen' : 'upside' })),
      );
    else if (c.asked === 'name')
      ask(
        'name ' + c.code + ' ' + c.opts.join(','),
        'The code and the name read don’t match: which one?',
        c.opts.map((i) => ({ i: i, how: 'chosen' })),
      );
    else if (c.asked === 'old')
      ask(
        'old ' + c.code,
        c.code + ': this one, or the old ' + c.code + '?',
        c.opts.map((i) => ({ i: i, how: codeOf(i) === c.code ? 'chosen' : 'old' })),
      );
    else
      ask(
        'brands ' + c.code,
        c.code + ': ' + c.opts.map((i) => COLORS[i].brand).join(' or ') + '?',
        c.opts.map((i) => ({ i: i, how: 'chosen' })),
      );
  });
  if (r.many) {
    // a list's other lines: each a question in the list, to say yes to (nothing from them is added unasked)
    r.flips.forEach(function (f) {
      n++;
      ask(
        'upside ' + f.as,
        f.opts.length === 1 ? 'Read upside down: is it this one?' : 'Upside down: which one?',
        f.opts.map((i) => ({ i: i, how: 'upside' })),
      );
    });
    r.names.forEach(function (i) {
      n++;
      ask('byname ' + i, 'Only its name was read: is it this one?', [{ i: i, how: 'name' }]);
    });
  }
  others.forEach(function (i) {
    n++;
    ask('other ' + i, 'Another brand than the one chosen (' + scanBrand + '): add it?', [
      { i: i, how: 'chosen' },
    ]);
  });
  if (many) {
    const same = n - took - asked,
      key = r.codes
        .map((c) => c.code + '|' + c.opts.join(','))
        .sort()
        .join(' '),
      now = Date.now(),
      again = !loud && !took && !asked && scanLastMany.key === key && now - scanLastMany.at < 6000;
    scanLastMany = { key: key, at: now };
    // (two caps held in view come again and again: said once)
    if (!again && n) {
      scanSay(
        took ? 'ok' : asked ? 'ask' : 'same',
        took
          ? took + ' added to the list'
          : asked
            ? asked + ' to choose in the list'
            : 'All already in the list',
        [took && asked ? asked + ' to choose below' : '', same ? same + ' already in the list' : '']
          .filter(Boolean)
          .join(' · ') || 'Check them below',
        -1,
      );
      scanBeep(took ? 'ok' : 'same');
    }
    if (scanList.length !== len0) scanRender();
  }
  if (n) return n;
  if (r.byName >= 0) {
    // (while aiming, the name can come before the code: said quietly, and only asked about on Enter)
    const i = r.byName;
    if (scanCardAgain('name ' + i, loud)) return 0;
    scanSay('ask', 'Is it ' + scanName(i) + '?', 'Only its name was read' + scanBrandOf(i), i, [
      { i: i, how: 'name', label: 'Add ' + COLORS[i].code },
    ]);
    if (loud) scanBeep('same');
    return 0;
  }
  r.flips.forEach(function (f) {
    n++;
    if (f.opts.length === 1) scanTake(f.opts[0], 'upside', loud);
    else
      scanAsk(
        'upside ' + f.as,
        'Upside down: which one?',
        f.opts.map((i) => ({ i: i, how: 'upside' })),
      );
  });
  if (n) return n;
  if (r.other.length) {
    if (scanCardAgain('other ' + r.other.join(','), loud)) return 0;
    const one = r.other.length === 1 ? r.other[0] : -1;
    // (v298: "Ohuhu E19 Dried Sage", not "E19 is a Ohuhu code")
    scanSay(
      'ask',
      one >= 0 ? COLORS[one].brand + ' ' + scanName(one) : COLORS[r.other[0]].code + ': another brand’s code',
      'Another brand than the one chosen (' + scanBrand + ')',
      one,
      r.other.map((i) => ({ i: i, how: 'chosen', label: 'Add ' + COLORS[i].brand + ' ' + COLORS[i].code })),
    );
    scanBeep('none');
    return 0;
  }
  if (loud) {
    scanSay('none', 'No marker code found', '“' + String(text).trim().slice(0, 40) + '”', -1);
    scanBeep('none');
  }
  return 0;
}
function scanRender() {
  const list = $('scList');
  if (!list) return;
  const fresh = scanNew().length,
    asks = scanAsks(),
    marks = scanList.length - asks;
  list.innerHTML = scanList
    .map(function (e, n) {
      const del =
        '<button type="button" class="scdel" data-n="' +
        n +
        '" aria-label="Take ' +
        esc(e.ask ? e.title : COLORS[e.i].code) +
        ' off the list">' +
        ic('x') +
        '</button>';
      if (e.ask)
        return (
          '<li class="scrow scask"><span class="scmark" aria-hidden="true">?</span><span class="scname"><b>' +
          esc(e.title) +
          '</b><span class="scpick">' +
          e.opts
            .map(
              (o) =>
                '<button type="button" class="scchoose" data-n="' +
                n +
                '" data-i="' +
                o.i +
                '" data-how="' +
                o.how +
                '"><span class="scsw" style="background:' +
                COLORS[o.i].hex +
                '"></span>' +
                esc(scanName(o.i)) +
                ' · ' +
                esc(COLORS[o.i].brand) +
                '</button>',
            )
            .join('') +
          '</span></span>' +
          del +
          '</li>'
        );
      const c = COLORS[e.i],
        mine = state.owned.has(mkey(e.i));
      return (
        '<li class="scrow' +
        (mine ? ' mine' : '') +
        '"><span class="scsw" style="background:' +
        c.hex +
        '"></span><span class="sccode">' +
        esc(c.code) +
        '</span><span class="scname">' +
        esc(c.name) +
        '<small>' +
        esc(c.brand) +
        (mine
          ? ' · <i>already yours</i>'
          : e.how === 'upside'
            ? ' · <i>read upside down</i>'
            : e.how === 'old'
              ? ' · <i>by its old code</i>'
              : '') +
        '</small></span>' +
        del +
        '</li>'
      );
    })
    .join('');
  $('scEmpty').hidden = scanList.length > 0;
  $('scCount').textContent = scanList.length
    ? // (each part kept on one line: "2 to / choose" had broken in two on a phone, v300)
      (marks ? marks + (marks === 1 ? '\u00a0marker' : '\u00a0markers') : '') +
      (fresh < marks ? ' · ' + fresh + '\u00a0new' : '') +
      (asks ? (marks ? ' · ' : '') + asks + '\u00a0to\u00a0choose' : '')
    : '';
  const add = $('scAdd');
  add.disabled = !fresh;
  add.textContent = fresh
    ? 'Add ' + fresh + ' to my collection'
    : marks
      ? 'All already in your collection'
      : 'Add to my collection';
  $('scClear').hidden = !scanList.length;
}
function scanFocusBox() {
  const b = $('scBox');
  if (b) b.focus({ preventScroll: true });
}
function scanBrandButtons() {
  const seg = $('scBrand'),
    brands = [...new Set(COLORS.map((c) => c.brand))];
  if (scanBrand && brands.indexOf(scanBrand) < 0) scanBrand = '';
  seg.innerHTML =
    '<button type="button" data-b="">Either brand</button>' +
    brands.map((b) => '<button type="button" data-b="' + esc(b) + '">' + esc(b) + '</button>').join('');
  seg
    .querySelectorAll('button')
    .forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.b === scanBrand)));
}
function openScan() {
  const ov = $('scanOverlay');
  if (!ov) return;
  scanOpener = document.activeElement;
  scanBrandButtons();
  scanSay('', 'Ready', 'Each marker read shows here, with a sound', -1);
  scanRender();
  openDialog(ov);
  // (straight into the box: what's done here is typing or Scan Text, which the box's own menu starts)
  scanFocusBox();
}
function closeScan() {
  const ov = $('scanOverlay');
  if (!ov || !ov.classList.contains('on')) return;
  closeDialog(ov);
  clearTimeout(scanStill);
  scanText = '';
  const bx = $('scBox');
  bx.value = '';
  bx.dispatchEvent(new Event('scanreset'));
  if (scanOpener && scanOpener.isConnected) scanOpener.focus({ preventScroll: true });
  scanOpener = null;
}
function scanAdd() {
  const fresh = scanNew();
  if (!fresh.length) return;
  const keys = fresh.map((e) => mkey(e.i)),
    wishWas = state.wish.slice();
  keys.forEach((k) => state.owned.add(k));
  // (bought: off the To buy list, as its Bought button does)
  state.wish = state.wish.filter((w) => keys.indexOf(w.k) < 0);
  const offList = wishWas.length - state.wish.length;
  if (
    !keep(function () {
      keys.forEach((k) => state.owned.delete(k));
      state.wish = wishWas;
    })
  )
    return;
  // (questions not yet answered stay for next time; what was added, and what was already yours, go; Undo brings
  // the list back too, to put right and add again)
  const listWas = scanList.slice();
  scanList = scanList.filter((e) => e.ask);
  closeScan();
  fullRender();
  if (offList) wishChanged();
  toastAction(
    'Added ' +
      keys.length +
      ' marker' +
      (keys.length === 1 ? '' : 's') +
      ' to your collection' +
      (offList ? ' (' + offList + ' off your To buy list)' : ''),
    'Undo',
    function () {
      const wishNow = state.wish.slice();
      scanList = scanList.filter((e) => listWas.indexOf(e) < 0).concat(listWas);
      keys.forEach((k) => state.owned.delete(k));
      // (back on the To buy list, unless put back there since)
      wishWas.forEach(function (w) {
        if (keys.indexOf(w.k) >= 0 && !state.wish.some((x) => x.k === w.k)) state.wish.push(w);
      });
      if (
        keep(function () {
          keys.forEach((k) => state.owned.add(k));
          state.wish = wishNow;
        })
      ) {
        fullRender();
        wishChanged();
      }
    },
  );
}
(function () {
  const ov = $('scanOverlay'),
    box = $('scBox'),
    go = $('scanOpen');
  if (!ov || !box || !go) return;
  go.addEventListener('click', openScan);
  $('scClose').addEventListener('click', closeScan);
  $('scAdd').addEventListener('click', scanAdd);
  $('scClear').addEventListener('click', function () {
    // (a second tap, as Clear collection: one mis-tap lost a whole sweep, v299)
    const cb = $('scClear');
    if (cb.dataset.arm !== '1') {
      cb.dataset.arm = '1';
      cb.textContent = 'Tap again to clear';
      clearTimeout(cb._t);
      cb._t = setTimeout(function () {
        cb.dataset.arm = '';
        cb.textContent = 'Clear list';
      }, 3000);
      return;
    }
    clearTimeout(cb._t);
    cb.dataset.arm = '';
    cb.textContent = 'Clear list';
    scanList = [];
    scanLast = { i: -1, at: 0 };
    scanSay('', 'Ready', 'List cleared', -1);
    scanRender();
    scanFocusBox();
  });
  ov.addEventListener('click', function (e) {
    if (e.target === ov) return closeScan();
    const t = e.target.closest ? e.target : null;
    if (!t) return;
    const d = t.closest('.scdel');
    // (after either, back to the box: the button tapped is gone, and on an iPad the keyboard and Scan Text with it)
    if (d) {
      const e2 = scanList[+d.dataset.n];
      scanList.splice(+d.dataset.n, 1);
      if (e2 && e2.i === scanLast.i) scanLast = { i: -1, at: 0 };
      scanRender();
      scanFocusBox();
      return;
    }
    const ch = t.closest('.scchoose');
    if (ch) {
      // the answer takes the question's place
      scanList.splice(+ch.dataset.n, 1);
      scanTake(+ch.dataset.i, ch.dataset.how, true);
      scanRender();
      scanFocusBox();
      return;
    }
    const b = t.closest('#scBrand button');
    if (b) {
      scanBrand = b.dataset.b;
      try {
        localStorage.setItem(SCAN_BRAND_KEY, scanBrand);
      } catch (_) {}
      $('scBrand')
        .querySelectorAll('button')
        .forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      // a question between the two brands that the brand just chosen answers: answered
      if (scanBrand) {
        let any = false;
        scanList = scanList
          .map(function (e) {
            if (!e.ask || e.ask.indexOf('brands ') !== 0) return e;
            const o = e.opts.filter((x) => COLORS[x.i].brand === scanBrand);
            if (o.length !== 1) return e;
            any = true;
            // (its answer already in the list: the question just goes, v299)
            return scanList.some((y) => y.i === o[0].i) ? null : { i: o[0].i, how: 'chosen' };
          })
          .filter(Boolean);
        if (any) scanRender();
      }
    }
  });
  // sound can only start from a tap
  box.addEventListener('pointerdown', function () {
    try {
      if (!scanAudio) scanAudio = new (window.AudioContext || window.webkitAudioContext)();
      scanAudio.resume();
    } catch (_) {}
  });
  // Scan Text puts in what it reads while you aim, and swaps it as the camera moves: read once the text has held
  // still for a moment, then the box clears for the next cap. Text with nothing in it to read is cleared too, a moment
  // later, so it can't run on into the next cap's. Typing (a letter at a time) waits for Enter; a paste is read at once.
  // (v298: the same text coming back is read once but still cleared — it was left in the box for good — and a
  // letter added to the end of a word being composed is typing too: Android's keyboards send each letter that way, and
  // a pause half-way through a code read what was there)
  let was = '',
    wasN = 0;
  const ANDROID = /Android/i.test(navigator.userAgent || '');
  const set = function (v) {
    box.value = v;
    was = v;
  };
  // (v299) pend: text read and about to be cleared; waiting: text arrived and waits to hold still
  let pend = '',
    waiting = false;
  const settle = function () {
    waiting = false;
    const text = box.value;
    if (text !== scanText) {
      scanText = text;
      wasN = scanHandle(text, false);
    }
    pend = text;
    scanStill = setTimeout(
      function () {
        pend = '';
        if (box.value === text) set('');
        scanText = '';
      },
      wasN ? 250 : 1500,
    );
  };
  box.addEventListener('scanreset', function () {
    was = '';
  });
  box.addEventListener('input', function (e) {
    clearTimeout(scanStill);
    waiting = false;
    const v = box.value,
      before = was,
      typed = e.inputType === 'insertText' && !e.isComposing && e.data && e.data.length === 1;
    was = v;
    // a letter typed while what Scan Text left is about to be cleared: that goes, the letter stays (v299: they ran
    // together, "R014E4")
    if (
      pend &&
      before === pend &&
      typed &&
      v.length === pend.length + 1 &&
      v.slice(0, pend.length) === pend
    ) {
      set(v.slice(pend.length));
      pend = '';
      scanText = '';
      return;
    }
    pend = '';
    if (typed) return; // typing
    if (e.inputType && e.inputType.indexOf('delete') === 0) return;
    if (
      ANDROID &&
      (e.isComposing || e.inputType === 'insertCompositionText') &&
      v.length === before.length + 1 &&
      v.slice(0, before.length) === before
    )
      return; // typing, composed (Android only: what Scan Text shows as it reads could come the same way, v299)
    waiting = true;
    scanStill = setTimeout(settle, 600);
  });
  // a paste is read at once, as pasted (a one-line box would run a list's lines together)
  box.addEventListener('paste', function (e) {
    const text = e.clipboardData && e.clipboardData.getData('text');
    if (!text) return;
    e.preventDefault();
    clearTimeout(scanStill);
    // (what Scan Text had put in the box, waiting to hold still, is read first and cleared; v299: it was left there)
    if (waiting && box.value.trim()) {
      if (box.value !== scanText) scanHandle(box.value, false);
      set('');
    } else if (pend && box.value === pend) set('');
    waiting = false;
    pend = '';
    scanText = '';
    scanHandle(text, true);
  });
  box.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' || e.isComposing) return;
    e.preventDefault();
    clearTimeout(scanStill);
    // (read now; the same text arriving again afterwards is read again, a new cap)
    scanText = '';
    pend = '';
    waiting = false;
    if (scanHandle(box.value, true)) set('');
  });
})();
