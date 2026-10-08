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
      if (/Ⅱ/.test(c.old)) ['LL', '11'].forEach((r) => put(byOld, scanKey(c.old.replace(/Ⅱ/g, r)), i));
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
    lines.forEach(function (l) {
      const r = scanRead(l, brand);
      // (v308: a line with nothing in it to read, said, not dropped without a word)
      if (!r.codes.length && !r.flips.length && r.byName < 0 && !r.byNames && !r.other.length) out.unread++;
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
    return out;
  }
  const ix = scanIndex(),
    chosen = (i) => !brand || COLORS[i].brand === brand,
    has = (c) => ix.byCode.has(c) && ix.byCode.get(c).some(chosen);
  // (full-width letters and digits as plain ones; a turned Y read as ¥)
  let up = String(text || '')
    .normalize('NFKC')
    .toUpperCase()
    .replace(/¥/g, 'Y');
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
    joined = tw.join('');
  const inRow = (nw) => {
    for (let k = 0; k + nw.length <= tw.length; k++) if (nw.every((w, j) => tw[k + j] === w)) return true;
    return false;
  };
  const hit = ix.names.filter((n) => inRow(n[2]) || (n[0].length >= 6 && joined.indexOf(n[0]) >= 0));
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
        otherNamed = sameNamed ? [] : [...named].filter((i) => !chosen(i) && scanKey(COLORS[i].code) === t);
      if ((ex.length && !ex.some(chosen)) || otherNamed.length) {
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
      if (digits && v !== t && beside && !isNamed) continue;
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
  const loose = namedOk.filter((i) => !told.has(i) && !partOf(i) && (!hint || ofHint(i))),
    // (nor a word of another marker's whole name read, "Light" of B06 Light Cerulean beside B02)
    looseWords = new Set([].concat(...loose.map((i) => scanWords(COLORS[i].name || ''))));
  codes.forEach(function (c) {
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
    if (!c.named && c.opts.length > 1) {
      // (not a word of a name read whole, another cap's: "B015 Celadon Blue B04" isn't Copic B04 Tahitian Blue)
      const pw = new Set(
          tw.filter(
            (w) =>
              w.length >= 3 &&
              !SCAN_NOISE.test(w) &&
              !scanIsCode(w) &&
              !toldWords.has(w) &&
              !looseWords.has(w),
          ),
        ),
        m = c.opts.filter((j) => scanWords(COLORS[j].name).some((w) => pw.has(w)));
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
    if (c.asked === 'fix') c.as = c.t;
    // (the options asked about by an old code are said so)
    c.oldOf = c.opts.filter((i) => c.oldSet.has(i));
    delete c.oldSet;
    delete c.hadOld;
    delete c.numAsk;
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
// (v303) when each marker was last read (the same cap held in view, read again and again), and when each question was
// last answered or let go by: a cap still in view isn't asked about again
const scanTookAt = new Map(),
  scanAnsweredAt = new Map();
// (v303) the list is kept through a reload (Safari can reload a tab put away mid-sweep): markers by their keys
const SCAN_LIST_KEY = 'ms-scan-list';
// (v305) whether a brand was ever tapped here (Either brand counts): until then, a collection all of one brand starts
// on it (scanBrandAuto)
let scanBrandChosen = false;
try {
  const sb = localStorage.getItem(SCAN_BRAND_KEY);
  scanBrand = sb || '';
  scanBrandChosen = sb != null;
} catch (_) {}
function scanSaveList() {
  try {
    if (!scanList.length) localStorage.removeItem(SCAN_LIST_KEY);
    else
      localStorage.setItem(
        SCAN_LIST_KEY,
        JSON.stringify(
          scanList.map((e) =>
            e.ask
              ? {
                  ask: e.ask,
                  title: e.title,
                  opts: e.opts.map((o) => ({ k: mkey(o.i), how: o.how })),
                  // (all its answers, when the brand chosen has narrowed them: Either brand brings them back)
                  opts0: e.opts0 ? e.opts0.map((o) => ({ k: mkey(o.i), how: o.how })) : undefined,
                }
              : { k: mkey(e.i), how: e.how },
          ),
        ),
      );
  } catch (_) {}
}
(function scanLoadList() {
  try {
    const a = JSON.parse(localStorage.getItem(SCAN_LIST_KEY) || '[]');
    if (!Array.isArray(a)) return;
    const idx = (k) => (typeof k === 'string' ? keyIdx(k) : null);
    scanList = a
      .map(function (e) {
        if (!e || typeof e !== 'object') return null;
        if (typeof e.ask === 'string' && Array.isArray(e.opts)) {
          const opts = e.opts
            .map((o) => o && { i: idx(o.k), how: typeof o.how === 'string' ? o.how : '' })
            .filter((o) => o && o.i != null);
          const all = Array.isArray(e.opts0)
            ? e.opts0
                .map((o) => o && { i: idx(o.k), how: typeof o.how === 'string' ? o.how : '' })
                .filter((o) => o && o.i != null)
            : null;
          return opts.length
            ? {
                ask: e.ask,
                title: String(e.title || ''),
                opts: opts,
                opts0: all && all.length ? all : undefined,
                at: 0,
              }
            : null;
        }
        const i = idx(e.k);
        return i == null ? null : { i: i, how: typeof e.how === 'string' ? e.how : '' };
      })
      .filter(Boolean);
  } catch (_) {
    scanList = [];
  }
})();
// (v303) no sound while the dialog closes (text left in the box read on the way out)
let scanMute = false;
// (v308) lines of pasted lists with nothing to read in them since the last Add or Clear, said by Add's toast
let scanUnread = 0;
function scanBeep(kind) {
  if (scanMute) return;
  try {
    if (!scanAudio) scanAudio = new (window.AudioContext || window.webkitAudioContext)();
    if (scanAudio.state === 'suspended') {
      const pr = scanAudio.resume();
      if (pr && pr.catch) pr.catch(function () {});
    }
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
    const row = document.createElement('span'),
      from = scanHandling;
    row.className = 'scpick';
    choices.forEach(function (c) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = c.label + (state.owned.has(mkey(c.i)) ? ' · already yours' : '');
      b.addEventListener('click', function () {
        scanTake(c.i, c.how, true);
        // (v303) the text the card was about goes from the box (typed, and not cleared as it had no code in it): it
        // had run on into the next code typed ("Honey BrownB015")
        const bx = $('scBox');
        if (bx && from.trim() && bx.value.trim() === from.trim()) {
          clearTimeout(scanStill);
          bx.value = '';
          scanText = '';
          bx.dispatchEvent(new Event('scanreset'));
          scanAddState();
        }
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
  scanTookAt.set(i, now);
  // (v303) the cap's name read with its code settles a question about the same cap asked a moment ago, with less of
  // it read ("YG06", Ohuhu or Copic, then "YG06 Sugarcane"): the question goes
  // (only for Scan Text's reads: a pasted list's or a typed line's own questions stay, each line a marker of its own;
  // nor one asked by this same read; and it isn't asked again while the cap's in view)
  if (how === 'name' && !loud) {
    const n0 = scanList.length;
    scanList = scanList.filter(function (e) {
      const go =
        e.ask &&
        e.hid !== scanHandleId &&
        !/^(other|byname)/.test(e.ask) &&
        now - (e.at || 0) < 10000 &&
        e.opts.some((o) => o.i === i);
      if (go) scanAnsweredAt.set(e.ask, now);
      return !go;
    });
    if (scanList.length !== n0) scanRender();
  }
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
// Returns true when asked, else why not: 'waiting' (the same question is), 'listed' (every answer is in the list),
// 'quiet' (the cap's still in view, v303)
function scanAsk(key, title, opts, batch, loud) {
  // (asked already: the same question waiting)
  if (scanList.some((e) => e.ask === key)) return 'waiting';
  const now = Date.now();
  // (v303) nothing to ask: every answer is in the list already (a list pasted twice)
  if (opts.every((o) => scanList.some((e) => e.i === o.i))) return 'listed';
  if (!loud) {
    // (v303) answered a moment ago, and the cap's still in view: not asked again (it came back with a beep every time
    // the camera read it again). The moment runs on while it's read again and again.
    const was = scanAnsweredAt.get(key);
    if (was && now - was < 4000) {
      scanAnsweredAt.set(key, now);
      return 'quiet';
    }
    // (one of its answers was read a moment ago: the same cap, still in view with less of it read, isn't asked about;
    // v303: the moment runs from when that marker was last read, not from each partial read, so a second cap with the
    // same code, Copic B04 after Ohuhu B04, is asked about once the first has gone)
    if (opts.some((o) => now - (scanTookAt.get(o.i) || 0) < 2500)) return 'quiet';
  }
  scanList.unshift({ ask: key, title: title, opts: opts, at: now, hid: scanHandleId });
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
let scanHandling = '',
  scanHandleId = 0;
function scanHandle(text, loud) {
  if (!String(text).trim()) return 0;
  scanHandling = String(text);
  scanHandleId++;
  const r = scanRead(text, scanBrand);
  let n = 0;
  // several at once (a pasted list): into the list together, then said once
  // (another brand's codes read along with codes of the brand chosen, or in a list, are questions in the list)
  const others = r.many || r.codes.length ? r.other : [],
    many =
      r.codes.length + (r.many ? r.flips.length + r.names.length + r.names2.length : 0) + others.length > 1;
  let took = 0,
    mine = 0,
    asked = 0;
  const ask = function (key, title, opts) {
    const a = scanAsk(key, title, opts, many, loud);
    if (a === true) asked++;
    else if (!many && loud) {
      // (said when it's typed: the question is waiting in the list already, or its answers are in it)
      scanSay('same', title, a === 'listed' ? 'Already in the list' : 'Waiting in the list below', -1);
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
        c.opts.map((i) => ({ i: i, how: (c.oldOf || []).indexOf(i) >= 0 ? 'old' : 'chosen' })),
      );
      return;
    }
    if (c.opts.length === 1) {
      if (scanTake(c.opts[0], c.old ? 'old' : c.named ? 'name' : '', loud, many)) {
        took++;
        if (state.owned.has(mkey(c.opts[0]))) mine++;
      }
      return;
    }
    const codeOf = (i) => scanKey(COLORS[i].code),
      others = [...new Set(c.opts.filter((i) => codeOf(i) !== c.code).map((i) => COLORS[i].code))];
    if (c.asked === 'fix')
      ask(
        'fix ' + c.as,
        c.as + ': ' + [...new Set(c.opts.map((i) => COLORS[i].code))].join(' or ') + '?',
        c.opts.map((i) => ({ i: i, how: (c.oldOf || []).indexOf(i) >= 0 ? 'old' : 'chosen' })),
      );
    else if (c.asked === 'turned')
      ask(
        'turned ' + c.code,
        c.code + ', or ' + others.join(' or ') + ' upside down?',
        c.opts.map((i) => ({ i: i, how: codeOf(i) === c.code ? 'chosen' : 'upside' })),
      );
    else if (c.asked === 'name')
      ask(
        'name ' + c.code + ' ' + c.opts.map(mkey).join(','),
        'The code and the name read don’t match: which one?',
        c.opts.map((i) => ({ i: i, how: (c.oldOf || []).indexOf(i) >= 0 ? 'old' : 'chosen' })),
      );
    else if (c.asked === 'old')
      ask(
        'old ' + c.code,
        // (v308: it offered three markers across two brands as "this one, or the old R14?")
        'Which ' + c.code + '?',
        c.opts.map((i) => ({ i: i, how: codeOf(i) === c.code ? 'chosen' : 'old' })),
      );
    else
      ask(
        'brands ' + c.code,
        c.code + ': ' + c.opts.map((i) => COLORS[i].brand).join(' or ') + '?',
        c.opts.map((i) => ({ i: i, how: (c.oldOf || []).indexOf(i) >= 0 ? 'old' : 'chosen' })),
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
      ask('byname ' + mkey(i), 'Only its name was read: is it this one?', [{ i: i, how: 'name' }]);
    });
    // (v303: a name both brands use)
    r.names2.forEach(function (is) {
      n++;
      ask(
        'bynames ' + is.map(mkey).join(','),
        'Only its name was read: which one?',
        is.map((i) => ({ i: i, how: 'name' })),
      );
    });
  }
  others.forEach(function (i) {
    n++;
    ask('other ' + mkey(i), 'Another brand than the one chosen (' + scanBrand + '): add it?', [
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
    if (r.unread && !again) scanUnread += r.unread;
    // (two caps held in view come again and again: said once)
    if (!again && n) {
      // (v303: what's added that's already yours is said so, with the quieter sound, as one read alone is)
      const allMine = took && mine === took;
      scanSay(
        took && !allMine ? 'ok' : asked ? 'ask' : 'same',
        took
          ? took + ' added to the list'
          : asked
            ? asked + ' to choose in the list'
            : 'All already in the list',
        [
          allMine ? (took === 1 ? 'Already in your collection' : 'All already in your collection') : '',
          took && asked ? asked + ' to choose below' : '',
          same ? same + ' already in the list' : '',
          r.unread ? r.unread + (r.unread === 1 ? ' line' : ' lines') + ' not read' : '',
        ]
          .filter(Boolean)
          .join(' · ') || 'Check them below',
        -1,
      );
      scanBeep(took && !allMine ? 'ok' : 'same');
    }
    // (v303: drawn every time: a question settled by a name read can leave the list as long as it was)
    scanRender();
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
  if (r.byNames) {
    // (v303: a name both brands use, read alone: which one)
    if (scanCardAgain('names ' + r.byNames.join(','), loud)) return 0;
    scanSay(
      'ask',
      'Is it ' + scanName(r.byNames[0]) + '?',
      'Only its name was read: ' + r.byNames.map((i) => COLORS[i].brand).join(' and ') + ' both have it',
      -1,
      r.byNames.map((i) => ({ i: i, how: 'name', label: 'Add ' + COLORS[i].brand + ' ' + COLORS[i].code })),
    );
    if (loud) scanBeep('same');
    return 0;
  }
  r.flips.forEach(function (f) {
    n++;
    if (f.opts.length === 1) scanTake(f.opts[0], 'upside', loud);
    // (v303: through ask, so on Enter a question already waiting is said so)
    else
      ask(
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
                esc(o.how) +
                '"><span class="scsw" style="background:' +
                COLORS[o.i].hex +
                '"></span>' +
                esc(scanName(o.i)) +
                ' · ' +
                esc(COLORS[o.i].brand) +
                // (v305: which of the answers you have)
                (state.owned.has(mkey(o.i)) ? ' · <i>already yours</i>' : '') +
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
  scanAddState();
  add.textContent = fresh
    ? 'Add ' + fresh + ' to my collection'
    : marks
      ? 'All already in your collection'
      : 'Add to my collection';
  $('scClear').hidden = !scanList.length;
  scanSaveList();
}
// Add: on with new markers in the list, or (v303) text in the box, which it reads first
function scanAddState() {
  const add = $('scAdd'),
    bx = $('scBox');
  if (add) add.disabled = !scanNew().length && !(bx && bx.value.trim());
}
function scanFocusBox() {
  const b = $('scBox');
  if (b) b.focus({ preventScroll: true });
}
// (v305) the brand to start on when none was ever chosen: the one brand of your markers, when Brands I'd buy is that
// brand too (or automatic: your brands first). Shown pressed and said on the card, never stored; '' for Either brand.
// (Not silently: someone with only Ohuhu may be scanning their first Copic markers.)
function scanBrandAuto() {
  if (scanBrandChosen) return '';
  const own = buyOwnBrands(),
    bb = state.buyBrands;
  return own.length === 1 && (!bb || (bb.length === 1 && bb[0] === own[0])) ? own[0] : '';
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
  // (v303: sound can only start from a tap; the one that opened this counts, not only a tap in the box)
  try {
    if (!scanAudio) scanAudio = new (window.AudioContext || window.webkitAudioContext)();
    const pr = scanAudio.resume();
    if (pr && pr.catch) pr.catch(function () {});
  } catch (_) {}
  scanOpener = document.activeElement;
  // (no Scan Text session can be open yet: a composition left marked open by an earlier visit is over)
  scanIme = false;
  const auto = scanBrandAuto();
  if (!scanBrandChosen) scanBrand = auto;
  scanBrandButtons();
  scanSay(
    '',
    'Ready',
    auto
      ? 'Set to ' + auto + ', the brand of all your markers · Either brand reads both'
      : 'Each marker read shows here, with a sound',
    -1,
  );
  scanRender();
  openDialog(ov);
  // (straight into the box: what's done here is typing or Scan Text, which the box's own menu starts)
  scanFocusBox();
}
// (v303) text still in the box, typed without Enter or just put in by Scan Text, is read before the box is let go of
// (Add and Close had thrown it away)
// (v308.6: Scan Text's text, a composition still open, is read but left for Scan Text to take out: see the box's set)
let scanIme = false;
function scanFlushBox(loud) {
  const bx = $('scBox');
  if (!bx || !bx.value.trim()) return;
  clearTimeout(scanStill);
  const v = bx.value;
  if (v !== scanText) scanHandle(v, loud);
  if (scanIme) {
    scanText = v;
    scanRender();
    return;
  }
  scanText = '';
  bx.value = '';
  bx.dispatchEvent(new Event('scanreset'));
  scanRender();
}
function closeScan() {
  const ov = $('scanOverlay');
  if (!ov || !ov.classList.contains('on')) return;
  scanMute = true;
  try {
    scanFlushBox(false);
  } finally {
    scanMute = false;
  }
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
  const asks0 = scanAsks();
  scanFlushBox(true);
  const fresh = scanNew();
  if (!fresh.length) return;
  // (v303: the text left in the box raised a question: shown, with the dialog left open, before anything's added)
  if (scanAsks() > asks0) return;
  const keys = fresh.map((e) => mkey(e.i)),
    wishWas = state.wish.slice();
  keys.forEach((k) => state.owned.add(k));
  // (bought: off the To buy list, as its Bought button does, and fresh: a Running low or Dry mark from before it was
  // unticked goes, v308.3; Undo gives it back)
  const ink = inkAddedOff(keys);
  state.wish = state.wish.filter((w) => keys.indexOf(w.k) < 0);
  const offList = wishWas.length - state.wish.length;
  if (
    !keep(function () {
      keys.forEach((k) => state.owned.delete(k));
      state.wish = wishWas;
      inkPutBack(ink);
    })
  )
    return;
  // (questions not yet answered stay for next time; what was added, and what was already yours, go; Undo brings
  // the list back too, to put right and add again)
  const listWas = scanList.slice();
  scanList = scanList.filter((e) => e.ask);
  scanSaveList();
  // (v303: drawn first, then closed: the first markers in an empty collection move Add a set and this button with it,
  // and focus went back to the top tab; the sets' ticks and counts follow too)
  fullRender();
  if (typeof presetRelist === 'function') presetRelist();
  closeScan();
  if (offList || Object.keys(ink).length) wishChanged();
  // (v308) the questions still to answer, and lines not read, are said, with Open to go back to them
  const left = scanAsks(),
    unread = scanUnread;
  scanUnread = 0;
  const said =
    addedManyLine(keys.length, offList) +
    (left ? ' \u00b7 ' + left + ' still to choose' : '') +
    (unread ? ' \u00b7 ' + unread + (unread === 1 ? ' line' : ' lines') + ' not read' : '');
  toastActions(
    said,
    [{ label: 'Undo', fn: scanUndoAdd }].concat(left ? [{ label: 'Open', fn: openScan }] : []),
    left || unread ? 10000 : 8000,
  );
  function scanUndoAdd() {
    const wishNow = state.wish.slice();
    // (v303: the markers it added back on the list, once each; its questions are as they are now)
    scanList = scanList.concat(listWas.filter((e) => !e.ask && !scanList.some((x) => x.i === e.i)));
    scanSaveList();
    keys.forEach((k) => state.owned.delete(k));
    const inkNow = Object.assign({}, state.ink);
    inkPutBack(ink);
    // (back on the To buy list, unless put back there since: v303, where they were in it, not at its end)
    const back = wishWas.filter((w) => keys.indexOf(w.k) >= 0 && !state.wish.some((x) => x.k === w.k));
    if (back.length) {
      const order = wishWas.map((w) => w.k),
        all = state.wish.concat(back);
      state.wish = all
        .map((w, n) => ({ w: w, at: order.indexOf(w.k) >= 0 ? order.indexOf(w.k) : 1e6 + n }))
        .sort((a, b) => a.at - b.at)
        .map((x) => x.w);
    }
    if (
      keep(function () {
        keys.forEach((k) => state.owned.add(k));
        state.wish = wishNow;
        state.ink = inkNow;
      })
    ) {
      fullRender();
      if (typeof presetRelist === 'function') presetRelist();
      wishChanged();
    }
  }
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
    scanUnread = 0;
    scanLast = { i: -1, at: 0 };
    // (v303: a cleared list asks afresh)
    scanTookAt.clear();
    scanAnsweredAt.clear();
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
      // (v303: a question let go by isn't asked again while its cap's still in view)
      if (e2 && e2.ask) scanAnsweredAt.set(e2.ask, Date.now());
      scanRender();
      scanFocusBox();
      return;
    }
    const ch = t.closest('.scchoose');
    if (ch) {
      // the answer takes the question's place
      // (v303: and isn't asked again while its cap's still in view)
      const q = scanList[+ch.dataset.n];
      if (q && q.ask) scanAnsweredAt.set(q.ask, Date.now());
      scanList.splice(+ch.dataset.n, 1);
      scanTake(+ch.dataset.i, ch.dataset.how, true);
      scanRender();
      scanFocusBox();
      return;
    }
    const b = t.closest('#scBrand button');
    if (b) {
      scanBrand = b.dataset.b;
      scanBrandChosen = true;
      try {
        localStorage.setItem(SCAN_BRAND_KEY, scanBrand);
      } catch (_) {}
      $('scBrand')
        .querySelectorAll('button')
        .forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      // a question between the two brands that the brand just chosen answers: answered
      // (v303: and "another brand than the one chosen" for a marker of the brand now chosen, or with Either brand, is
      // answered too; other questions keep only the brand chosen's answers, where it has any; and it's said)
      let done = 0;
      const out = [];
      scanList.forEach(function (e) {
        if (!e.ask) return out.push(e);
        // (from all its answers as first asked: switching back to Either brand brings them back)
        const all = e.opts0 || e.opts,
          o = scanBrand ? all.filter((x) => COLORS[x.i].brand === scanBrand) : all;
        const answer =
          (/^(brands|bynames) /.test(e.ask) && scanBrand && o.length === 1) ||
          (/^other /.test(e.ask) && o.length === 1);
        if (answer) {
          done++;
          // (its answer already in the list: the question just goes, v299)
          if (!scanList.some((y) => y.i === o[0].i) && !out.some((y) => y.i === o[0].i))
            out.push({ i: o[0].i, how: o[0].how === 'name' ? 'name' : 'chosen' });
          return;
        }
        out.push(
          o.length && o.length < all.length
            ? Object.assign({}, e, { opts: o, opts0: all })
            : Object.assign({}, e, { opts: all, opts0: undefined }),
        );
      });
      scanList = out;
      scanRender();
      if (done)
        scanSay(
          'ok',
          done === 1 ? '1 question answered' : done + ' questions answered',
          scanBrand ? 'By the brand chosen: ' + scanBrand : 'Either brand',
          -1,
        );
      scanFocusBox();
    }
  });
  // (v308.5) Copy diagnostics' trace of what the box is sent (safety.js scanTraceAdd)
  const tr = function (what, e) {
    if (typeof scanTraceAdd !== 'function') return;
    const v = box.value || '';
    scanTraceAdd(
      what +
        (e && e.inputType ? ' ' + e.inputType : '') +
        (e && e.isComposing ? ' composing' : '') +
        (e && typeof e.data === 'string' ? ' data:' + e.data.length : '') +
        ' value:' +
        v.length +
        (v ? ' "' + v.slice(0, 18) + '"' : '') +
        (document.activeElement === box ? '' : ' (box not focused)'),
    );
  };
  ['beforeinput', 'compositionstart', 'compositionupdate', 'compositionend', 'focus', 'blur'].forEach(
    function (k) {
      box.addEventListener(k, function (e) {
        tr(k, e);
      });
    },
  );
  // sound can only start from a tap
  box.addEventListener('pointerdown', function () {
    try {
      if (!scanAudio) scanAudio = new (window.AudioContext || window.webkitAudioContext)();
      const pr = scanAudio.resume();
      if (pr && pr.catch) pr.catch(function () {});
    } catch (_) {}
  });
  // Scan Text puts in what it reads while you aim, and swaps it as the camera moves: read once the text has held
  // still for a moment, then the box clears for the next cap. Text with nothing in it to read is cleared too, a moment
  // later, so it can't run on into the next cap's. Typing (a letter at a time) waits for Enter; a paste is read at once.
  // (v298: the same text coming back is read once but still cleared — it was left in the box for good — and a
  // letter added to the end of a word being composed is typing too: Android's keyboards send each letter that way, and
  // a pause half-way through a code read what was there)
  let was = '',
    wasN = 0,
    keyAt = 0;
  const ANDROID = /Android/i.test(navigator.userAgent || '');
  // (v303) a key pressed just before text arrives: typing. Scan Text puts its text in without any key, so composed text
  // (a pinyin or Japanese keyboard) that follows keys is typing on an iPad too, not a cap read half-way
  box.addEventListener('keydown', function () {
    keyAt = Date.now();
  });
  // (v308.6) Scan Text on iPadOS 27 puts what it reads in as a composition (insertCompositionText) and takes it out
  // itself (deleteCompositionText) when the cap leaves view. Clearing the box while that composition is open broke
  // Scan Text for the rest of the visit: the camera went on reading, nothing more arrived. So the box is never cleared
  // by the app during a composition; Scan Text clears its own text, and the next cap is read as it arrives.
  box.addEventListener('compositionstart', function () {
    scanIme = true;
  });
  box.addEventListener('compositionend', function () {
    scanIme = false;
  });
  const set = function (v) {
    if (scanIme && v === '') {
      if (typeof scanTraceAdd === 'function') scanTraceAdd('left for Scan Text to clear');
      return;
    }
    box.value = v;
    was = v;
    scanAddState();
    if (typeof scanTraceAdd === 'function') scanTraceAdd('cleared by the app' + (v ? ' to ' + v.length : ''));
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
      if (typeof scanTraceAdd === 'function') scanTraceAdd('read: ' + wasN + ' found');
    } else if (typeof scanTraceAdd === 'function') scanTraceAdd('held still, read already');
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
    pend = '';
    waiting = false;
  });
  box.addEventListener('input', function (e) {
    tr('input', e);
    clearTimeout(scanStill);
    // (Add reads text left in the box: on while there's some)
    scanAddState();
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
    if (e.inputType === 'deleteCompositionText' && !v) {
      // (Scan Text took its text out: the next cap is read afresh)
      pend = '';
      scanText = '';
      return;
    }
    if (e.inputType && e.inputType.indexOf('delete') === 0) return;
    if (
      ANDROID &&
      (e.isComposing || e.inputType === 'insertCompositionText') &&
      v.length === before.length + 1 &&
      v.slice(0, before.length) === before
    )
      return; // typing, composed (Android only: what Scan Text shows as it reads could come the same way, v299)
    if ((e.isComposing || e.inputType === 'insertCompositionText') && Date.now() - keyAt < 1000) return;
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
  // (v303) a composition (a pinyin or Japanese keyboard) under way, or just ended: Safari's Enter that ends one can come
  // as key 229 with isComposing false, and isn't an Enter to read the box
  let composing = false,
    composedAt = 0;
  box.addEventListener('compositionstart', function () {
    composing = true;
  });
  box.addEventListener('compositionend', function () {
    composing = false;
    composedAt = Date.now();
  });
  box.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' || e.isComposing || composing) return;
    if (e.keyCode === 229 && Date.now() - composedAt < 200) return;
    e.preventDefault();
    clearTimeout(scanStill);
    // (read now; the same text arriving again afterwards is read again, a new cap)
    scanText = '';
    pend = '';
    waiting = false;
    if (scanHandle(box.value, true)) set('');
  });
})();
