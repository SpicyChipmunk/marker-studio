/* ===== Scan: the code reader (src/js/scan.js 1–687 until v318.8) =====
   Text → the codes in it: the tables of look-alike characters, the index of codes and names, flips and turns, and
   scanRead. Pure: reads COLORS and the brand tables, touches no state and no DOM. */
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
// (v318.21: a Π read for the grey caps' Ⅱ, "CG∏04" or "CGΠ04", is that Ⅱ: no code has a Π, and Ⅱ's two strokes
// under a bar is how it's printed)
const scanKey = (s) =>
  String(s)
    .normalize('NFKC')
    .toUpperCase()
    .replace(/[∏Π]/g, 'II')
    .replace(/[^A-Z0-9]/g, '');
// codes as they are now; Ohuhu's old codes (on the caps of older sets) as well; the colour names
function scanIndex() {
  if (_scanIx) return _scanIx;
  const byCode = new Map(),
    byOld = new Map(),
    capOld = new Map(),
    names = [];
  const put = (m, k, i) => {
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(i);
  };
  COLORS.forEach(function (c, i) {
    put(byCode, scanKey(c.code), i);
    if (c.old && scanKey(c.old) !== scanKey(c.code)) {
      put(byOld, scanKey(c.old), i);
      // (v308.3) Copic's fluorescents by the code on their caps (FB2, FY1…): another brand's code to ask about when
      // Ohuhu is chosen, as FB is. Only these: other old codes stay the brand's own ("R4" is noise, or Ohuhu's R412)
      if (c.brand === 'Copic' && c.fam === 'Fluorescent') put(capOld, scanKey(c.old), i);
      // (v303: an old code with Ⅱ, "CGⅡ00", is printed in a font where it looks like two l's or 1's: read so too)
      // (v318.19: or as one stroke, I, L or 1, or an H, as photos of the caps read it: "CGI09", "CGlO7", "CGHo8"; none
      // is a code of its own. v318.21: a Π, "CG∏04", is read as Ⅱ by scanKey itself)
      if (/Ⅱ/.test(c.old))
        ['LL', '11', 'I', 'L', '1', 'H'].forEach((r) => put(byOld, scanKey(c.old.replace(/Ⅱ/g, r)), i));
    }
    const n = scanKey(c.name || ''),
      ws = scanWords(c.name || '');
    // (its words too: a short name, Fig or Tea, counts only as a word of its own)
    if (n.length >= 3) {
      names.push([n, i, ws]);
      // (v303: "Cool Gray 3" for Cool Gray No.3: the name without its "No")
      if (ws.indexOf('NO') > 0) names.push([n, i, ws.filter((w) => w !== 'NO')]);
    }
  });
  return (_scanIx = { byCode: byCode, byOld: byOld, capOld: capOld, names: names });
}
const scanWords = (s) =>
  String(s)
    .normalize('NFKC')
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);
// (v318.19) a marker's names: its own, and those printed on its older caps (COLORS[i].cap)
function scanNamesOf(i) {
  const c = COLORS[i];
  return c.cap ? [c.name || ''].concat(c.cap) : [c.name || ''];
}
// the words of all its names
function scanNameW(i) {
  const c = COLORS[i];
  return c.cap ? scanWords([c.name || ''].concat(c.cap).join(' ')) : scanWords(c.name || '');
}
// (v318.19) every older cap's name, as its words
let _scanCapN = null;
function scanCapNames() {
  if (!_scanCapN) {
    _scanCapN = [];
    COLORS.forEach((c) => (c.cap || []).forEach((nm) => _scanCapN.push(scanWords(nm))));
  }
  return _scanCapN;
}
// (v318.2) every word of the markers' names
let _scanNameW = null;
function scanNameWords() {
  if (!_scanNameW) {
    _scanNameW = new Set();
    // (the names they have now only: an older cap's words would make a misread word, "Graen", near two, GREEN and
    // Y150's old GRAIN, and settle nothing)
    COLORS.forEach((c) => scanWords(c.name || '').forEach((w) => _scanNameW.add(w)));
  }
  return _scanNameW;
}
// (v318.3) the one word of the markers' names (or of the words on every cap) a word read is one letter away from: a
// letter wrong, missing, extra, or two swapped; '' for none or more than one. Only for a word of 5 letters or more that
// isn't a name's word itself
const SCAN_CAP_WORDS = [
  'OHUHU',
  'HONOLULU',
  'COPIC',
  'SKETCH',
  'CLASSIC',
  'ALCOHOL',
  'MARKER',
  'MARKERS',
  'BRUSH',
  'CHISEL',
];
function scanNameNear(w) {
  const names = scanNameWords();
  if (w.length < 5 || !/^[A-Z]+$/.test(w) || names.has(w)) return '';
  const one = (a, b) => {
    if (Math.abs(a.length - b.length) > 1) return false;
    let i = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) i++;
    if (a.length === b.length)
      return (
        a.slice(i + 1) === b.slice(i + 1) ||
        (a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2))
      );
    return a.length > b.length ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
  };
  let hit = '';
  for (const v of SCAN_CAP_WORDS.concat([...names]))
    if (v.length >= 3 && one(w, v)) {
      if (hit && hit !== v) return '';
      hit = v;
    }
  return SCAN_CAP_WORDS.indexOf(hit) >= 0 ? '' : hit;
}
// words on the caps and their labels that are never a code, nor the reason a number-only code (0, 120) isn't one
const SCAN_NOISE =
  /^(OHUHU|HONOLULU|COPIC|SKETCH|CIAO|CLASSIC|ALCOHOL|ART|ARTS|MARKERS?|BRUSH|FINE|CHISEL|DUAL|TIPS?|NO|\d{8,}|X\d{1,3}|\d{1,3}X)$/;
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
// (v303: a T in the number part could be a 1 or a 7: both are tried)
function scanVariants(t) {
  const out = [t];
  for (let k = 0; k <= Math.min(3, t.length - 1); k++) {
    const pre = t.slice(0, k).replace(/[0-9]/g, (c) => SCAN_LET[c] || c);
    if (!/^[A-Z]*$/.test(pre)) continue;
    const rest = t.slice(k);
    for (const tv of /T/.test(rest) ? ['1', '7'] : ['1']) {
      const num = rest.replace(/[A-Z]/g, (c) => (c === 'T' ? tv : SCAN_NUM[c] || c));
      if (/^[0-9]+$/.test(num) && out.indexOf(pre + num) < 0) out.push(pre + num);
    }
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
    const out = { codes: [], byName: -1, flips: [], other: [], names: [], names2: [], many: true, unread: 0 },
      seen = {};
    // (v317) lines of plain words with nothing to read: counted apart, so that text copied from a photo of a tray
    // (Google Lens, Live Text), where every name comes on a line of its own, isn't "51 lines not read"
    let unreadWords = 0;
    lines.forEach(function (l) {
      // (v318.7) a pasted list's line that names its brand ("Copic E00", "Ohuhu B02") is read as that brand's, whatever
      // the brand chosen above the box: counted, to say so
      const lb = scanLineBrand ? scanBrandWord(l) : '';
      const r = scanRead(l, lb || brand);
      if (lb) {
        r.codes.forEach((c) => (c.lb = lb));
        if (lb !== brand && r.codes.length) {
          out.named = out.named || {};
          out.named[lb] = (out.named[lb] || 0) + r.codes.length;
        }
      }
      // (v308: a line with nothing in it to read, said, not dropped without a word)
      if (!r.codes.length && !r.flips.length && r.byName < 0 && !r.byNames && !r.other.length) {
        if (/\d/.test(l)) out.unread++;
        else unreadWords++;
      }
      r.codes.forEach(function (c) {
        const k = c.code + '|' + c.opts.join(',');
        if (!seen[k]) out.codes.push(c);
        seen[k] = 1;
      });
      out.flips.push(...r.flips);
      if (r.byName >= 0 && out.names.indexOf(r.byName) < 0) out.names.push(r.byName);
      // (v303: a line with only a name both brands use: one question between them)
      if (r.byNames && !out.names2.some((n) => n.join() === r.byNames.join())) out.names2.push(r.byNames);
      r.other.forEach((i) => out.other.indexOf(i) < 0 && out.other.push(i));
    });
    // (v317) text from a photo of a tray: each cap's name comes on a line of its own, under or beside its code. A line
    // with only a name settles nothing when a code in the same paste accounts for it: the name of a marker read by its
    // code ("E75" then "Light Rose Taupe"), or words of one ("CG17 Cool Grey" then "Grey" isn't a question about CG24
    // Grey), as a name read beside a code on one line already doesn't (told, partOf below). A list of names alone, or
    // a name no code here accounts for, still asks as before.
    if (out.codes.length) {
      // (and a name on the line after a code both brands use settles it, as on one line: "B04" then "Tahitian Blue"
      // is Copic's B04)
      const named = new Set(out.names.concat(...out.names2));
      // (v318: and one asked about as an old code that's now another marker's, R16 Light Salmon or RV316 once R16:
      // its name under it on a photo of the caps says which)
      out.codes.forEach(function (c) {
        if (c.named || c.opts.length < 2 || (c.asked && c.asked !== 'old')) return;
        const m = c.opts.filter((i) => named.has(i));
        if (m.length !== 1) return;
        c.opts = m;
        c.named = true;
        c.old = (c.oldOf || []).indexOf(m[0]) >= 0;
        if (c.asked) {
          delete c.asked;
          c.oldOf = c.old ? m : [];
        }
      });
      // (v318.19: a code's marker by its old code, with the names on its older caps too)
      const byCode = [].concat(
          ...out.codes.map((c) =>
            c.opts.map((j) => (c.oldSet && c.oldSet.has(j) ? scanNameW(j) : scanWords(COLORS[j].name || ''))),
          ),
        ),
        told = (i) => {
          const nw = scanWords(COLORS[i].name || '');
          return byCode.some((jw) => nw.every((w) => jw.indexOf(w) >= 0));
        };
      out.names = out.names.filter((i) => !told(i));
      out.names2 = out.names2.filter((is) => !is.some(told));
      // (and lines of plain words aren't counted as not read: the names and the noise around the codes)
    } else out.unread += unreadWords;
    return out;
  }
  const ix = scanIndex(),
    chosen = (i) => !brand || COLORS[i].brand === brand,
    has = (c) => ix.byCode.has(c) && ix.byCode.get(c).some(chosen);
  // (full-width letters and digits as plain ones; a turned Y read as ¥; v318.21: a Π as the grey caps' Ⅱ, scanKey)
  let up = String(text || '')
    .normalize('NFKC')
    .toUpperCase()
    .replace(/¥/g, 'Y')
    .replace(/[∏Π]/g, 'II');
  // (v303) a price or any number with a decimal point ("$2.99", "3.5"; a comma only after a currency sign: "100,110"
  // is two codes) is no code: gone, so its digits aren't read as
  // one ("99" as G9, Ohuhu's old code for G112); a dot inside a code joins it up ("WG0.5", Ohuhu's old code for YR02);
  // a | or ! between letters and digits is a 1 ("B|12")
  up = up
    .replace(/(^|[^A-Z0-9.])(?:[$€£]\d+[.,]\d+|\d+\.\d+)(?![A-Z0-9])/g, '$1 ')
    .replace(/([A-Z]+\d+)\.(\d+)/g, '$1$2')
    .replace(/[|!]/g, (m, o, str) =>
      /[A-Z0-9]/.test(str[o - 1] || '') && /[A-Z0-9]/.test(str[o + 1] || '') ? '1' : ' ',
    );
  // a brand's name on the cap: settles a code both brands use
  const hints = SCAN_BRANDS.filter((b) => b[0].test(up)).map((b) => b[1]),
    hint = hints.length === 1 ? hints[0] : '',
    ofHint = (i) => COLORS[i].brand === hint;
  // words; one with a turned character is left to the upside-down reading below; a dash on its own is dropped
  // ("C - 3")
  const words = up.split(new RegExp('[^A-Z0-9' + SCAN_TURNED + '-]+')).filter((w) => w && !/^-+$/.test(w));
  const toks = words.map((t) => (/[A-Z0-9]/.test(t) && !/[^A-Z0-9-]/.test(t) ? t.replace(/-/g, '') : null)),
    // (v303: a short word with a dash, "C-O", gets its misreads put right as one with a digit does: Copic's greys)
    dash = words.map((w, i) => !!toks[i] && /-/.test(w) && toks[i].length <= 4),
    lettersOnly = (x) => !!x && /^[A-Z]+$/.test(x);
  // (v303) a code read in pieces ("E 614", "B G05", "R V 17"): the pieces it's made of aren't read on their own as well
  // (E 614 had added Copic G14 too)
  const used = new Set(),
    tries = [];
  toks.forEach(function (t, i) {
    if (!t || used.has(i)) return;
    const u = toks[i + 1],
      w = toks[i + 2];
    if (
      lettersOnly(t) &&
      lettersOnly(u) &&
      w &&
      /^\d+$/.test(w) &&
      (t + u + w).length <= 6 &&
      scanIsCode(t + u + w)
    ) {
      tries.push({ t: t + u + w, joined: true, oldOk: true, at: i });
      used.add(i + 1).add(i + 2);
      return;
    }
    if (
      lettersOnly(t) &&
      u &&
      (t + u).length <= 6 &&
      (ix.byCode.has(t + u) || (ix.byOld.has(t + u) && !scanIsCode(u)))
    ) {
      // (an old code too, "WG 05" is Ohuhu YR02, once WG0.5; but not when the second piece is a code of its own:
      // "W G05" is Copic G05)
      tries.push({ t: t + u, joined: true, oldOk: true, at: i });
      used.add(i + 1);
      return;
    }
    tries.push({ t: t, at: i, dash: dash[i] });
    // a code with its name run on ("B015CELADON")
    const g = /^([A-Z]{1,3}[0-9]{1,4})[A-Z]{3,}$/.exec(t);
    if (g) tries.push({ t: g[1], at: i });
    // a code read in two pieces ("YG 06"): only as it is, no misreads put right across the gap, and only when
    // neither piece is a code of its own (v299: "E00 0", Copic E00 with the blender beside it, was read as E000, and a
    // count after a code, "BG21 1", as BG211)
    // ("C - 0" is still C-0: a first piece of letters only joins whatever follows)
    if (u && !used.has(i + 1) && (t + u).length <= 6 && (!/\d/.test(t) || (!scanIsCode(t) && !scanIsCode(u))))
      tries.push({ t: t + u, joined: true, at: i });
  });
  // the colour names in the text, of either brand: its words in a row ("Cool Gray No.1"), or run together when the
  // name is long enough not to turn up inside other words ("LightSalmon"); the longest (Honey Brown, not Honey too)
  const tw = scanWords(up),
    joined = tw.join(''),
    // (v318.6 debug: the words read, and the numbers after a "No", as sets, worked out once: looked up for every code's
    // markers below, a line of 20,000 codes had taken three times as long as before v318.2)
    twSet = new Set(tw),
    noNums = new Set(tw.filter((w, k) => /^\d+$/.test(w) && tw[k - 1] === 'NO'));
  // (v318.19) the name printed on one of a marker's older caps ("R6 Rose Red", R213 Pomegranate now), read whole: a
  // name of two words or more, or one of five letters or more. Its numbers are the name's ("Green Grey 02", "Cool
  // Grey Ⅱ 5": the Ⅱ read as II, 11 or LL; 02 as 2)
  // (the words read run together with a Ⅱ after them, "Greyll9", worked out once, when first needed: a long line stays
  // quick)
  let runT = null;
  const runs = () => {
      if (!runT) {
        runT = { base: new Set(), num: new Set(), two: false };
        tw.forEach((x) => {
          const m = /^([A-Z]+?)([IL1H]+)(\d*)$/.exec(x);
          if (!m) return;
          runT.base.add(m[1]);
          if (m[3]) runT.num.add(String(+m[3]));
          // (the Ⅱ as two strokes, or one after Grey, the only word it follows: "Greyl 4")
          if (m[2].length >= 2 || /^GR[AE]Y$/.test(m[1])) runT.two = true;
        });
      }
      return runT;
    },
    capRead = (w) =>
      twSet.has(w) ||
      (/^\d+$/.test(w)
        ? twSet.has(String(+w)) || twSet.has(w.padStart(2, '0')) || runs().num.has(String(+w))
        : w === 'II'
          ? runs().two
          : // ("Cool Greyll 5": Grey run together with the Ⅱ after it)
            runs().base.has(w)),
    // (a one-word name, "Pansy", not when it's a word of a longer name read whole: "P4 Lavender Mist" isn't V010,
    // once P4 "Lavender": that's another cap's name)
    longer = (w) =>
      ix.names.some((n) => n[2].length > 1 && n[2].indexOf(w) >= 0 && n[2].every((x) => twSet.has(x))) ||
      scanCapNames().some((ws) => ws.length > 1 && ws.indexOf(w) >= 0 && ws.every((x) => twSet.has(x))),
    // (v318.22) on a photo, an older cap's name told by a word of it alone, the code read being that cap's old code
    // and another brand's code now: a word of five letters or more, no plain colour word, read whole or all but its
    // first or last two letters, and no word of the other brand's marker's name. "Y13" with "Chestnut" is Ohuhu
    // E515's older cap (Chestnut Brown), not Copic Y13 Lemon Yellow; "R11" with "Mauve" Ohuhu V13's (Mauve Shadow).
    // A code of three characters or more: never a two-character one (R6, G4) by this
    capPart = (i, others) => {
      const theirs = new Set([].concat(...(others || []).map((j) => scanWords(COLORS[j].name || ''))));
      return (COLORS[i].cap || []).some((nm) =>
        scanWords(nm).some(
          (w) =>
            w.length >= 5 &&
            /^[A-Z]+$/.test(w) &&
            !OCR_PLAIN.has(w.toLowerCase()) &&
            !theirs.has(w) &&
            tw.some(
              (x) =>
                x === w || (x.length >= 5 && x.length >= w.length - 2 && (w.startsWith(x) || w.endsWith(x))),
            ),
        ),
      );
    },
    capOf = (i) =>
      (COLORS[i].cap || []).find((nm) => {
        const ws = scanWords(nm);
        // (the cheap test first: a long line of codes is read in good time)
        return (
          (ws.length > 1 || (ws[0] || '').length >= 5) &&
          ws.every(capRead) &&
          (ws.length > 1 || !longer(ws[0]))
        );
      });
  const inRow = (nw) => {
    for (let k = 0; k + nw.length <= tw.length; k++) if (nw.every((w, j) => tw[k + j] === w)) return true;
    return false;
  };
  // (v318.2: not a name found inside a longer word that's a name's word of its own: "Yellowish", of Copic YR20 Yellowish
  // Shade, R30, Y23 and YG06, isn't Copic Y06 Yellow, nor "Buttercup", Copic Y21's, Ohuhu Y06 Butter. Read the other
  // way round, "Shade Yellowish", YR20 had been asked about against Y06)
  const nameWord = scanNameWords(),
    inWord = (k) => tw.some((w) => w !== k && w.indexOf(k) >= 0 && nameWord.has(w));
  const hit = ix.names.filter(
    (n) => inRow(n[2]) || (n[0].length >= 6 && joined.indexOf(n[0]) >= 0 && !inWord(n[0])),
  );
  let named = new Set(
    hit
      .filter((n) => !hit.some((m) => m[0].length > n[0].length && m[0].indexOf(n[0]) >= 0))
      .map((n) => n[1]),
  );
  // (v303: the brand on the cap picks between two brands' markers of the same name, Tahitian Blue; other names read
  // stay, another cap's: "Copic B04 Tahitian Blue R46 Old Rose" is still Ohuhu's R46)
  if (hint)
    named = new Set(
      [...named].filter(
        (i) =>
          ofHint(i) ||
          // (one whose own code is read beside it stays: "B09 Tahitian Blue Copic" is Ohuhu's B09)
          toks.indexOf(scanKey(COLORS[i].code)) >= 0 ||
          ![...named].some(
            (j) => j !== i && ofHint(j) && scanKey(COLORS[j].name) === scanKey(COLORS[i].name),
          ),
      ),
    );
  const namedOk = [...named].filter(chosen),
    // (the words of the names read: beside codes, still caps in view)
    nameWords = new Set([].concat(...[...named].map((i) => scanWords(COLORS[i].name || ''))));
  // (v303) worked out once, not for every word: a long line of codes had taken seconds
  const plain = toks.filter((x) => x && !SCAN_NOISE.test(x)),
    // (words that are neither codes nor of a name read; a count, "2", is one only beside another code: "2 FB" is
    // Copic FB, "120 2" Ohuhu 120)
    stray = [...new Set(toks.filter((x) => x && !SCAN_NOISE.test(x) && !scanIsCode(x) && !nameWords.has(x)))],
    isCount = (x) => /^\d{1,2}$/.test(x),
    strayWords = stray.filter((x) => !isCount(x)),
    codeToks = new Set(plain.filter(scanIsCode)),
    otherCodes = (t) => codeToks.size > (codeToks.has(t) ? 1 : 0),
    strayW = new Set(strayWords),
    // (whether a stray word is beside t other than t itself and the words of its markers' own names: counted, not
    // filtered for every word, so a long line stays quick)
    strayBeside = function (t, markers) {
      if (!strayW.size) return false;
      const own = new Set([].concat(...markers.map((i) => scanWords(COLORS[i].name || ''))));
      own.add(t);
      let n = 0;
      own.forEach((w) => strayW.has(w) && n++);
      return strayW.size > n;
    };
  // (v318.19) the words of older caps' names, of the old codes read ("Cobalt Blue" with PB3, BV314 now)
  const capW = new Set();
  const codes = [],
    seen = {},
    other = new Set();
  for (const tr of tries) {
    const t = tr.t;
    if (t.length > 6) continue;
    const digits = /^\d+$/.test(t),
      // (v303) beside other words: a number isn't read as a code put right ("61" as G1), nor a code without a digit
      // ("FB") among words that aren't codes, nor a number after "No" ("Cool Gray No.0")
      beside = plain.length > 1,
      afterNo = digits && beside && tr.at > 0 && toks[tr.at - 1] === 'NO';
    if (afterNo) continue;
    // another brand's code exactly as read, or with that brand's colour name: said so, not bent into a code of the
    // brand chosen (Copic YG11 isn't Ohuhu Y611 misread; Copic B04 Tahitian Blue isn't Ohuhu B04)
    // (v303: nor a number beside stray words, "pack of 100": that's no code at all; beside another code, "E43 120", or a
    // word of its own name, "110 Black", it's still said to be the other brand's)
    if (
      brand &&
      !(
        digits &&
        beside &&
        strayBeside(t, ix.byCode.get(t) || []) &&
        !(ix.byCode.get(t) || []).some((i) => named.has(i))
      )
    ) {
      const ex =
        ix.byCode.get(t) || (ix.byOld.has(t) && ix.byOld.get(t).some(chosen) ? [] : ix.capOld.get(t)) || [];
      // (not when the brand chosen has the same code and name: both brands' colourless blender, 0)
      const sameNamed = [...named].some((i) => chosen(i) && scanKey(COLORS[i].code) === t),
        otherNamed = sameNamed ? [] : [...named].filter((i) => !chosen(i) && scanKey(COLORS[i].code) === t),
        // (v318.7) an old code of the brand chosen that's another brand's code now (R29, Ohuhu YR47's old code and
        // Copic's R29): asked, "Which R29?", with both, as Either brand asks it; it had been "another brand than the
        // one chosen" with Copic's offered and Ohuhu's not at all. Not a photo's lines, which the photo settles
        // (v318.19: on a photo too, when the name on its older cap is read with it: "R21 Fruit Pink" is Ohuhu R16,
        // not Copic's R21 Sardonyx)
        oldMine =
          (!scanPhoto ||
            (ix.byOld.get(t) || []).some(
              (i) => chosen(i) && (capOf(i) || (t.length >= 3 && capPart(i, ex))),
            )) &&
          !otherNamed.length &&
          (ix.byOld.get(t) || []).some(chosen);
      if (((ex.length && !ex.some(chosen)) || otherNamed.length) && !oldMine) {
        (otherNamed.length ? otherNamed : ex).forEach((i) => other.add(i));
        continue;
      }
    }
    // every reading of the word that is a real code, as now or an old Ohuhu code; misreads are put right only in a
    // word that has a digit ("Egg" isn't E66, "Bog" isn't B06, "No" isn't N-0)
    const cands = [];
    for (const v of (/\d/.test(t) || tr.dash) && !tr.joined ? scanVariants(t) : [t]) {
      const cur = ix.byCode.get(v) || [],
        // (a code made of two words is a code as it is now, not an old one: "E17 0" isn't E170, E58's old code)
        old = tr.joined && !tr.oldOk ? [] : (ix.byOld.get(v) || []).filter((i) => cur.indexOf(i) < 0),
        all = cur.concat(old);
      if (!all.length) continue;
      const isNamed = all.some((i) => named.has(i)),
        // (v303: a word of its own name beside it, "FB Blue", "0 Colorless", isn't stray)
        strayHere = strayBeside(t, all);
      if (digits && v !== t && (beside || (scanPhoto && t.length <= 2)) && !isNamed) continue;
      if (!/\d/.test(v) && v === t && beside && !isNamed && strayHere) continue;
      // a code that's only a number (0, 100, 120): only as read and on its own, or with its name
      // (words on every cap don't count: "Copic 0", "Ohuhu 120" are the code, v299)
      // (as read beside other codes only, two caps in view, "E43 120": asked about rather than dropped, v299)
      let numAsk = false;
      if (/^\d+$/.test(v) && (v !== t || beside) && !isNamed) {
        // (not a word of a name read: "Cool Gray No.0")
        if (v !== t || tr.joined || nameWords.has(t) || strayHere) continue;
        // (beside another code, two caps in view: asked; beside a count or a word of its name only, it's that code)
        numAsk = otherCodes(t);
      }
      // (v318.7) as read, an old code of the brand chosen that's another brand's code now: that brand's marker is an
      // answer too, after the brand chosen's ("Ohuhu YR47 · was R29", then Copic R29), outside photos
      const s0 = !scanPhoto && v === t && !!brand && cur.length > 0 && !cur.some(chosen) && old.some(chosen),
        opts = s0 ? old.filter(chosen).concat(cur) : all.filter(chosen);
      if (!opts.length) continue;
      let withName = opts.filter((i) => named.has(i));
      // (v318.2) a name of two words or more read in any order is its marker's ("Pink Ballet", R22 Ballet Pink: a cap's
      // lines are read in either order); and a name read that's only some of the words of another of the code's markers'
      // names settles nothing ("R22 Pink" isn't RV17 Pink, once R22, over R22 Ballet Pink: it had been added unasked)
      // (v318.3 debug: a name's number counts only as its "No.": "C-3 Cool Gray No.5" isn't C-3 Cool Gray No.3 by the
      // code's own 3, it's asked about, as before v318.2. Copic's greys are the names with a number)
      const nw = (i) => scanWords(COLORS[i].name || ''),
        isRead = (w) => (/^\d+$/.test(w) ? noNums.has(w) : twSet.has(w)),
        allRead = opts.filter((i) => nw(i).length > 1 && nw(i).every(isRead)),
        inside = (b, a) => nw(a).length > nw(b).length && nw(b).every((w) => nw(a).indexOf(w) >= 0),
        // (v318.19) an older cap: its old code with the name printed beside it then (capOf, above). Only with the old
        // code
        capName = (i) =>
          old.indexOf(i) >= 0 && (capOf(i) || (scanPhoto && v === t && v.length >= 3 && capPart(i, cur))),
        capHit = opts.filter(capName);
      if (allRead.length === 1) withName = allRead;
      else if (capHit.length === 1) withName = capHit;
      else if (withName.length === 1 && opts.some((j) => j !== withName[0] && inside(withName[0], j)))
        withName = [];
      // (the words of the older cap's names, for a code that is one marker's old code, when that name is read, whole or
      // two of its words at least: another marker named now by some of them settles nothing, below. "CG5 Cool Grey Ⅱ
      // 5", read "CG5 Cool Greyll 5", isn't asked about against CG17 Cool Grey)
      const one = withName.length ? withName : opts;
      if (one.length === 1 && old.indexOf(one[0]) >= 0)
        (COLORS[one[0]].cap || []).forEach((nm) => {
          const ws = scanWords(nm);
          if (ws.length > 1 ? ws.filter(capRead).length >= 2 : capOf(one[0]) === nm)
            ws.forEach((w) => capW.add(w));
        });
      cands.push({
        code: v,
        opts: withName.length ? withName : opts,
        named: withName.length > 0,
        fixed: v !== t,
        old: (withName.length ? withName : opts).every((i) => old.indexOf(i) >= 0),
        asked: '',
        hadOld: old.length > 0 && (cur.some(chosen) || s0),
        s0: s0,
        numAsk: numAsk,
        bent: digits && v !== t && scanPhoto && !isNamed,
        // (which of them are by an old code, for "by its old code" once the options are narrowed, v303)
        oldSet: new Set(old),
      });
    }
    if (!cands.length) continue;
    // the reading the colour name agrees with (YG11 read with "Dark Sand" is Ohuhu Y611), else the text as read
    let c = cands.find((x) => x.named) || cands[0];
    // (v303) misreads put right more than one way, none as read ("E1T": E11 or E17): asked, not the first taken
    if (!c.named && c.fixed && cands.length > 1) {
      const os = [],
        oldSet = new Set();
      cands.forEach((x) => {
        x.opts.forEach((i) => os.indexOf(i) < 0 && os.push(i));
        x.oldSet.forEach((i) => oldSet.add(i));
      });
      const cs = [...new Set(os.map((i) => COLORS[i].code))];
      if (cs.length > 1) c = Object.assign({}, c, { opts: os, fix: cs, oldSet: oldSet });
    }
    // the other brand's name on the cap: that brand's code, said so, not added as the brand chosen ("Ohuhu B04" with
    // Copic chosen had added Copic B04, v299)
    if (brand && hint && hint !== brand && !c.named) {
      const hb = (ix.byCode.get(c.code) || []).filter(ofHint);
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
  const toldWords = new Set([].concat(...[...told].map((i) => scanWords(COLORS[i].name || ''))));
  // (v303: nor does a name read that's only a word or two of the code's own marker's name: "BG212 Green" is BG212 Teal
  // Green, not a question about the marker called Green)
  const partOf = (i) =>
    codes.some((c) =>
      c.opts.some(
        (j) => j !== i && scanWords(COLORS[i].name).every((w) => scanWords(COLORS[j].name).indexOf(w) >= 0),
      ),
    );
  const loose = namedOk.filter(
      (i) =>
        !told.has(i) &&
        !partOf(i) &&
        (!hint || ofHint(i)) &&
        // (v318.19: "Cobalt Blue", BV315's name now, read with PB3, whose old cap it was: no question)
        !(capW.size && scanWords(COLORS[i].name || '').every((w) => capW.has(w))),
    ),
    // (nor a word of another marker's whole name read, "Light" of B06 Light Cerulean beside B02)
    looseWords = new Set([].concat(...loose.map((i) => scanWords(COLORS[i].name || '')))),
    // (v303) the words read that may be a word of a code's markers' names (not a word of a name read whole, another
    // cap's: "B015 Celadon Blue B04" isn't Copic B04 Tahitian Blue), and those of the options they're a word of (v318.3
    // debug: worked out once, not for each code)
    pw = new Set(
      tw.filter(
        (w) =>
          w.length >= 3 && !SCAN_NOISE.test(w) && !scanIsCode(w) && !toldWords.has(w) && !looseWords.has(w),
      ),
    ),
    cur = (j) => scanWords(COLORS[j].name || ''),
    byWord = (opts, oldSet) => {
      // (v318.19) an older cap's words, for a marker by its old code, when they're words no name the code's markers
      // have now has: "R16 Deep Violet" is RV316, once R16; "G410 Light Holly Green" is G24, once G410, but "G410
      // Green" is still G410 Grass Green, as before
      if (oldSet && oldSet.size) {
        const now = new Set([].concat(...opts.map(cur))),
          mc = opts.filter(
            (j) =>
              oldSet.has(j) &&
              (COLORS[j].cap || []).some((nm) => scanWords(nm).some((w) => !now.has(w) && pw.has(w))),
          );
        if (mc.length) return mc;
      }
      const m0 = opts.filter((j) => cur(j).some((w) => pw.has(w))),
        // (v318.3) from a photo, with no word of theirs read as it is: a word misread by one letter ("Yelliow"), of 5
        // letters or more, that's one name's word and no other's, chooses between the code's own markers only
        fw = scanPhoto && !m0.length ? new Set([...pw].map(scanNameNear).filter(Boolean)) : null;
      return fw && fw.size ? opts.filter((j) => cur(j).some((w) => fw.has(w))) : m0;
    };
  codes.forEach(function (c) {
    // (v318.2) a photo plainly of the codes as they are now (scanGen): a code that's only an old one is likely a scrap of
    // a cap read short ("GG1" of GG15), unless the name read with it is its marker's: asked about, never added unasked
    // (v318.3: with the cap's picture beside the question; v318.2 had left it out). One that's a marker's now and
    // another's old code is the one it is now. Not Copic's fluorescents, whose caps carry their old codes (FB2)
    if (scanGen && !c.named && c.oldSet.size && !ix.capOld.has(c.code)) {
      // (v318.4 review: the photo's unsure lines too, 'strict': "Y210 Golden" unsure had gone in as Y416 unasked)
      const cur = c.opts.filter((i) => !c.oldSet.has(i)),
        w = pw.size ? byWord(c.opts, c.oldSet) : [];
      if (!cur.length) c.oldOnly = true;
      // (v318.3 debug: not when a word read with it is of the old one's name alone: "Y210 Golden", Brown missed, an old
      // cap's, had gone in as Y210 Pumpkin Yellow, and read unsure as Y416: the code and the name disagree, asked below)
      else if (w.length && w.every((i) => c.oldSet.has(i))) c.byOld = true;
      // (v318.7: never narrowed to the other brand's marker alone: "Which R29?" stays asked)
      else if (scanGen === 'new' && !c.s0) {
        c.opts = cur;
        c.hadOld = false;
        c.old = false;
        if (c.fix) {
          const cs = [...new Set(cur.map((i) => COLORS[i].code))];
          c.fix = cs.length > 1 ? cs : null;
        }
      }
    }
    // (v303) the brand's name on the cap first: its markers only, when it has any here ("Copic R12" isn't asked about
    // Ohuhu's R12 or the Ohuhu marker whose old code was R12)
    if (hint && !c.named) {
      const h = c.opts.filter(ofHint);
      if (h.length && h.length < c.opts.length) {
        c.opts = h;
        c.hadOld = c.hadOld && h.length > 1;
        // (by its old code, if that's all the brand on the cap has under it: "Ohuhu Y13" is E515, once Y13)
        c.old = h.every((i) => c.oldSet.has(i));
        if (c.fix) {
          const cs = [...new Set(h.map((i) => COLORS[i].code))];
          c.fix = cs.length > 1 ? cs : null;
        }
      }
    }
    // (v303) a word of one of its markers' names read beside a code more than one marker has ("B21 Porcelain": Ohuhu's
    // B21 Porcelain Blue, not Copic's): that one
    if (!c.named && c.opts.length > 1 && !c.byOld) {
      const m = byWord(c.opts, c.oldSet);
      if (pw.size && m.length === 1) {
        c.opts = m;
        c.old = c.oldSet.has(m[0]);
        c.hadOld = false;
        c.fix = null;
      }
    }
    if (c.numAsk) c.asked = 'num';
    // (a brand's name on the cap, and a code that brand hasn't: "Ohuhu … 0" isn't simply Copic 0, v299)
    else if (hint && !c.named && !c.opts.some(ofHint)) c.asked = 'hint';
    else if (!c.named && loose.length) {
      // the colour name read says another marker (R4b with "Old Rose": R48 read, R46 named): ask between them
      loose.forEach((i) => c.opts.indexOf(i) < 0 && c.opts.push(i));
      c.asked = 'name';
    } else if (c.byOld) {
      // (v318.3 debug: the code as it is now and a word of its old marker's name, "Y210 Golden": the code and the name
      // don't match, asked so, not "Which Y210?", which the photo drops as a scrap of a cap once Y210 has gone in; with
      // Y210 Pumpkin Yellow's cap beside it, Y416 was missed)
      c.asked = 'name';
    } else if (c.fix) c.asked = 'fix';
    else if (!c.named && c.hadOld) {
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
    // (v318.2) digits bent into a code: asked, never added unasked
    if ((c.bent || c.oldOnly) && !c.asked) c.asked = 'confirm';
    if (c.asked === 'fix' || c.asked === 'confirm') c.as = c.t;
    // (the options asked about by an old code are said so)
    c.oldOf = c.opts.filter((i) => c.oldSet.has(i));
    delete c.oldSet;
    delete c.hadOld;
    delete c.numAsk;
    delete c.bent;
    delete c.oldOnly;
    delete c.byOld;
    delete c.t;
    delete c.fix;
  });
  // (another brand's cap read with this brand's: asked about in the list, not dropped, v299)
  if (codes.length) return { codes: codes, byName: -1, flips: [], other: [...other] };
  // another brand's code (with that brand chosen): that, not a reading of something else
  if (other.size) return { codes: [], byName: -1, flips: [], other: [...other] };
  if (namedOk.length === 1) return { codes: [], byName: namedOk[0], flips: [], other: [] };
  // (v303: a name both brands use, read alone: which one, rather than nothing)
  if (namedOk.length > 1 && new Set(namedOk.map((i) => scanKey(COLORS[i].name))).size === 1)
    return { codes: [], byName: -1, byNames: namedOk, flips: [], other: [] };
  if (!namedOk.length && named.size === 1) return { codes: [], byName: -1, flips: [], other: [...named] };
  // nothing the right way up: each word as if it was read upside down (not the photo reader's lines: it has read each
  // both ways up already, and a scrap of a line, "001", had become Ohuhu 100)
  if (scanNoFlip) return { codes: [], byName: -1, flips: [], other: [] };
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
