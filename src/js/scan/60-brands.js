/* ===== Scan: the brand rules (scan.js 2040–2264, 1513–1520 and 2916–2924, and photo-read.js 344–377 and 486–574, until v318.8) =====
   What a piece of text says about its brand (scanBrandWord, scanListBrand), the codes both brands share, a code read
   short or misread (scanNotWhole), another brand's marker read whole, the switch to both brands when the sweep shows
   the other brand (scanSw…), the brand to start on (scanBrandAuto); and the name rules the photo reader shares with
   Scan: a code as printed (ocrAsRead), the names read with a code (ocrWordsOf, ocrNameAgrees, ocrForeign, ocrExact,
   ocrNamed, ocrWholeName) and a question that's noise (ocrNoise). */
// The brand a list typed, pasted or opened is plainly of: its codes that only one brand has (not a line naming its
// brand, read as that brand's whatever the rest is) are five or more and all one brand's → that brand, whatever is
// chosen above the box (a Copic
// set's 36 codes pasted with Ohuhu set for you had put the 10 codes both brands have in as Ohuhu's, unasked, and asked
// about the other 26 one by one); codes only one brand has and codes only the other has, five or more together →
// mixed, read as either brand (each brand's codes as its, those both have asked); fewer → null, read as before.
// Not more text than a long list (a web page pasted is read once, not twice): the reading is kept for the mixed case
const SCAN_LIST_BRAND_MAX = 20000;
function scanListBrand(text) {
  if (String(text).length > SCAN_LIST_BRAND_MAX) return null;
  const n = {};
  scanLineBrand = true;
  let r;
  try {
    r = scanRead(text, '');
  } finally {
    scanLineBrand = false;
  }
  (r.codes || []).forEach(function (c) {
    const bs = [...new Set(c.opts.map((i) => COLORS[i].brand))];
    if (bs.length === 1 && !c.lb) n[bs[0]] = (n[bs[0]] || 0) + 1;
  });
  const bs = Object.keys(n);
  if (bs.reduce((s, b) => s + n[b], 0) < 5) return null;
  return bs.length === 1 ? { brand: bs[0], r: r } : { brand: '', mixed: true, r: r };
}
// the other brand's name
const scanOtherBrand = (b) => [...new Set(COLORS.map((c) => c.brand))].find((x) => x !== b) || '';
// whether another brand has the marker's code too
let _scanShared = null;
function scanShared(i) {
  if (!_scanShared) {
    const by = {};
    COLORS.forEach((c) => {
      const k = scanKey(c.code);
      (by[k] = by[k] || new Set()).add(c.brand);
    });
    _scanShared = new Set(Object.keys(by).filter((k) => by[k].size > 1));
  }
  return _scanShared.has(scanKey(COLORS[i].code));
}
// a brand's codes, by key
const _scanCodesOf = {};
function scanCodesOf(b) {
  if (!_scanCodesOf[b]) {
    const m = new Map();
    COLORS.forEach((c) => c.brand === b && m.set(scanKey(c.code), c.code));
    _scanCodesOf[b] = m;
  }
  return _scanCodesOf[b];
}
// A code read that could be one of a brand's codes read wrong: the start or the end of one (E71 of E711, Y13 of BGY13),
// one digit the camera confuses (0, 6, 8 and 9; 3 and 8; 1 and 7; 2 and 7; 5 and 6), one doubled character read once
// (B12 of B112) or one letter it confuses (B, E and R; G and C; V and Y) from one. Returns { longer, near } (the codes
// it could be), or null when it's none of them: read whole
const SCAN_NEAR_DIGIT = { 0: '689', 6: '0895', 8: '0693', 9: '068', 3: '8', 1: '7', 7: '12', 2: '7', 5: '6' },
  SCAN_NEAR_LETTER = { B: 'ER', E: 'B', R: 'B', G: 'C', C: 'G', V: 'Y', Y: 'V' };
function scanNotWhole(k, b) {
  if (!b || !k) return null;
  const codes = scanCodesOf(b),
    longer = [],
    near = [],
    nearKeys = new Set();
  codes.forEach((code, c) => {
    if (c !== k && (c.startsWith(k) || c.endsWith(k))) longer.push(code);
  });
  for (let j = 0; j < k.length; j++) {
    for (const a of (SCAN_NEAR_DIGIT[k[j]] || '') + (SCAN_NEAR_LETTER[k[j]] || ''))
      nearKeys.add(k.slice(0, j) + a + k.slice(j + 1));
    nearKeys.add(k.slice(0, j + 1) + k[j] + k.slice(j + 1));
  }
  nearKeys.forEach((x) => x !== k && codes.has(x) && near.push(codes.get(x)));
  return longer.length || near.length ? { longer: longer, near: near } : null;
}
// what a code that isn't whole could be, in words: "Ohuhu B114 read short", "an Ohuhu code read short (E711, E713)",
// "Ohuhu B28 misread"
function scanNotWholeWhy(w, b) {
  // (v318.7 debug: "a Copic code", not "an Copic code", with Copic set for you)
  const list = (cs) =>
      (cs.length === 1 ? b + ' ' + cs[0] : (b === 'Ohuhu' ? 'an ' : 'a ') + b + ' code') + ' ',
    tail = (cs) => (cs.length > 1 ? ' (' + cs.slice(0, 2).join(', ') + ')' : '');
  return w.longer.length
    ? list(w.longer) + 'read short' + tail(w.longer)
    : list(w.near) + 'misread' + tail(w.near);
}
// whether another brand's marker was read WHOLE: its code with a word of its own name (as a photo's names agree with
// a code, ocrNameAgrees), with its brand's word, or its code read whole (scanNotWhole). 'name', 'code' or false.
// words (v318.7 debug): a list's words, worked out once for all its markers (a 122 KB paste under the switch to both
// brands had taken over twice as long, the whole text searched again for each marker's name)
function scanWholeOther(i, text, auto, words) {
  if (words) {
    if (ocrWordsOf(COLORS[i].name).some((w) => words.has(w))) return 'name';
  } else if (ocrNameAgrees(i, [String(text)])) return 'name';
  if (scanBrandWord(text) && scanBrandWord(text) !== auto) return 'name';
  return scanNotWhole(scanKey(COLORS[i].code), auto) ? false : 'code';
}
// The brand set for you (scanBrandAuto, never tapped) and, with it, the sweep's evidence that the caps are the other
// brand's: Scan Text reads one cap at a time, and a Copic tray swept with Ohuhu set for you had put the codes both
// brands have in as Ohuhu's, and said each Copic-only code was "another brand's" on a card that vanished with the next.
// Now, with an automatic brand only, the other brand's markers read whole are questions in the list, read noisily (a
// code that could be this brand's read wrong) a card, and at the first of: two distinct markers read whole as the other
// brand; two distinct other-brand-only reads when no code only this brand has was read this visit; the last three
// one-brand codes read all the other brand's; a photo plainly of the other brand; a list read as the other brand — the
// switch goes to Either brand for the visit (not stored, scanBrandChosen stays false), said on a row at the top of the
// list with Keep Ohuhu to take it back. At the switch, codes both brands use taken as this brand's since the last
// code only this brand has (e.auto, e.autoAt) are asked "YR07: Ohuhu or Copic?", and the whole reads waiting as
// questions go in. A visit is the page's life; Clear list, a brand tapped and a reload end it.
let scanAutoB = '',
  scanSw = scanSwNew();
function scanSwNew() {
  return {
    on: false, // switched to both brands
    off: false, // Keep Ohuhu tapped: switched again only after two more distinct other-brand reads
    row: false, // the row at the top of the list (× takes it off, the switch stands)
    whole: new Set(), // distinct markers read whole as the other brand
    other: new Set(), // distinct other-brand markers read, whole or noisy
    seq: [], // the one-brand codes read, in order: { k: 'auto' } or { k: 'other', i }
    autoOnly: 0, // codes only the automatic brand has read this visit
    added: [], // codes both brands use Added to the collection as the automatic brand's this visit
    say: null, // the switch's card, said after the read that made it
  };
}
const scanAuto = () => (scanBrandChosen || scanFind ? '' : scanAutoB);
function scanSwitchOn(why) {
  const auto = scanAuto();
  if (!auto || scanSw.on) return;
  const other = scanOtherBrand(auto),
    now = Date.now(),
    was = scanList;
  scanSw.on = true;
  scanSw.off = false;
  scanSw.row = true;
  scanBrand = '';
  scanBrandButtons();
  scanList = was
    .map(function (e) {
      if (e.ask) {
        // (a whole read's question goes in; a noisy one stays)
        if (/^other /.test(e.ask) && e.whole && e.opts.length === 1) {
          scanAnsweredAt.set(e.ask, now);
          const o = e.opts[0];
          return was.some((y) => !y.ask && y.i === o.i)
            ? null
            : { i: o.i, how: o.how === 'name' ? 'name' : 'chosen', photo: e.photo, flip: true, whole: true };
        }
        return e;
      }
      if (!e.auto || e.autoAt !== scanSw.autoOnly) return e;
      const k = scanKey(COLORS[e.i].code),
        j = COLORS.findIndex((c) => c.brand === other && scanKey(c.code) === k);
      if (j < 0) return e;
      if (was.some((y) => y.ask === 'brands ' + k)) return null;
      return {
        ask: 'brands ' + k,
        title: COLORS[e.i].code + ': ' + auto + ' or ' + other + '?',
        opts: [
          { i: e.i, how: 'chosen' },
          { i: j, how: 'chosen' },
        ],
        at: now,
        held: true,
        photo: e.photo,
        crop: e.crop,
      };
    })
    .filter(Boolean);
  const say = [
    'Reading both brands: ' + other + ' caps were read',
    'Codes both brands use are asked from now on · Keep ' + auto + ' is at the top of the list',
  ];
  if (why === 'read') scanSw.say = say;
  else if (why === 'photo') scanSay('ok', say[0], say[1], -1);
  scanRender();
}
// Keep Ohuhu: the automatic brand back for the visit; the brand questions the switch raised, and any raised while
// it stood, answered as its; the other brand's markers taken since the switch asked about
function scanSwitchOff() {
  const auto = scanAuto();
  if (!scanSw.on || !auto) return;
  const other = scanOtherBrand(auto),
    now = Date.now(),
    was = scanList;
  scanSw.on = false;
  scanSw.off = true;
  scanSw.row = false;
  scanSw.whole = new Set();
  scanSw.other = new Set();
  scanSw.seq = [];
  scanBrand = auto;
  scanBrandButtons();
  scanList = was
    .map(function (e) {
      if (e.ask && e.held) {
        const o = e.opts.find((x) => COLORS[x.i].brand === auto);
        if (!o) return e;
        scanAnsweredAt.set(e.ask, now);
        return was.some((y) => !y.ask && y.i === o.i)
          ? null
          : { i: o.i, how: 'chosen', photo: e.photo, crop: e.crop, auto: true, autoAt: scanSw.autoOnly };
      }
      if (!e.ask && e.flip)
        return {
          ask: 'other ' + mkey(e.i),
          title: COLORS[e.i].brand + ' ' + scanName(e.i) + ': add it? ' + auto + ' was set for you',
          opts: [{ i: e.i, how: e.how === 'name' ? 'name' : 'chosen' }],
          at: now,
          photo: e.photo,
          whole: !!e.whole,
        };
      return e;
    })
    .filter(Boolean);
  scanSay('ok', auto + ' again', other + ' codes read since are asked below', -1);
  scanRender();
}
// the switch over: a brand tapped, the list cleared, or the brand set for you gone (keep: the brand it switched from
// comes back, Clear list)
function scanSwitchEnd(keep) {
  const auto = scanAuto();
  scanSw = scanSwNew();
  if (!keep || !auto) return;
  scanBrand = auto;
  scanBrandButtons();
}
// the one brand a piece of text names ('' for none or both)
function scanBrandWord(t) {
  const up = String(t || '')
      .normalize('NFKC')
      .toUpperCase(),
    hs = SCAN_BRANDS.filter((b) => b[0].test(up));
  return hs.length === 1 ? hs[0][1] : '';
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
// (v318.7) the markers whose name the names read are, as Scan reads them, in reading order and the other way ("Violet"
// then "Deep" is V013 Violet one way, V015 Deep Violet the other)
function ocrNamed(names, brand) {
  return [names, names.slice().reverse()]
    .map((n) => scanRead(n.join(' '), brand).byName)
    .filter((i) => i >= 0);
}
// (v318.3) the marker whose whole name the names read are, of the brand: a name of two words or more, or of one word of
// six letters or more that's no word of another's name; not one whose words are all in another's longer name. Else -1
function ocrWholeName(names, brand) {
  const r = scanRead(names.join(' '), brand);
  if (r.byName < 0) return -1;
  const ws = scanWords(COLORS[r.byName].name || ''),
    of = (c) => !brand || c.brand === brand;
  if (
    COLORS.some((c, j) => {
      if (j === r.byName || !of(c)) return false;
      const o = scanWords(c.name || '');
      return o.length > ws.length && ws.every((w) => o.indexOf(w) >= 0);
    })
  )
    return -1;
  if (ws.length >= 2) return r.byName;
  if ((ws[0] || '').length < 6) return -1;
  return COLORS.some(
    (c, j) =>
      j !== r.byName &&
      of(c) &&
      scanWords(c.name || '').length > 1 &&
      scanWords(c.name || '').indexOf(ws[0]) >= 0,
  )
    ? -1
    : r.byName;
}
// (v318.2) whether a reading is the code as it's printed: its letters as letters, its digits as digits or the letter a
// digit is often read as (O for 0, I, L or T for 1, S for 5, Z for 2). "W60g" isn't WG06, nor "Eg9" E69: Scan puts those
// right, but from a photo they're asked about
function ocrAsRead(text, code) {
  const t = scanKey(text),
    like = { 0: 'O', 1: 'ILT', 5: 'S', 2: 'Z' };
  for (let k = 0; k + code.length <= t.length; k++) {
    let ok = true;
    for (let j = 0; j < code.length && ok; j++) {
      const a = t[k + j],
        b = code[j];
      ok = a === b || (!!like[b] && like[b].indexOf(a) >= 0);
    }
    if (ok) return true;
  }
  return false;
}
// (v318.2) whether the names read with a code hold a word of another marker's name of the brand (4 letters or more, not
// one every family has) and none of the code's markers' own: "V91 Grayish Cherry" is RV91's cap, not V91's
let _ocrVocab = {};
function ocrForeign(text, names, brand) {
  const b = brand || '';
  if (!_ocrVocab[b]) {
    const s = new Set();
    COLORS.forEach((c) => (!b || c.brand === b) && ocrWordsOf(c.name).forEach((w) => s.add(w)));
    _ocrVocab[b] = s;
  }
  const V = _ocrVocab[b],
    is = [].concat(...(scanRead(text, brand).codes || []).filter((c) => c.opts.length).map((c) => c.opts));
  if (!is.length || is.some((i) => ocrNameAgrees(i, names, text))) return false;
  const own = [].concat(...is.map((i) => ocrWordsOf(ocrNameOf(i, text))));
  return ocrWordsOf(names.join(' ')).some(
    (w) => V.has(w) && !own.some((o) => o.indexOf(w) >= 0 || w.indexOf(o) >= 0),
  );
}
// (v318.2) whether a code's reading is to be trusted as it is: the code as printed, or a name of its own read with it
function ocrExact(text, names, brand) {
  const cs = (scanRead([text].concat(names).join(' '), brand).codes || []).filter((c) => c.opts.length);
  return (
    !cs.length ||
    cs.every((c) => c.named || ocrAsRead(text, c.code) || c.opts.some((i) => ocrNameAgrees(i, names, text)))
  );
}
// (v318.2) a question that's noise: only a name read, a one-word name that's a word of two or more of its brand's other
// names ("Grey"); another brand's code, on a photo plainly of one brand, that's the start or end of a code of that brand
// (Copic BG11 on a tray of Ohuhu's, BG114 read short)
function ocrNoise(e, brand) {
  if (/^byname /.test(e.ask) && e.opts.length === 1) {
    const i = e.opts[0].i,
      ws = scanWords(COLORS[i].name || '');
    if (
      ws.length === 1 &&
      COLORS.filter(
        (c, j) => j !== i && c.brand === COLORS[i].brand && scanWords(c.name || '').indexOf(ws[0]) >= 0,
      ).length >= 2
    )
      return true;
  }
  if (/^other /.test(e.ask) && brand && e.opts.length === 1) {
    const k = scanKey(COLORS[e.opts[0].i].code);
    if (
      COLORS.some(
        (c) =>
          c.brand === brand &&
          scanKey(c.code) !== k &&
          (scanKey(c.code).startsWith(k) || scanKey(c.code).endsWith(k)),
      )
    )
      return true;
  }
  return false;
}
// whether the names read with a code are its marker's: a word of them (4 letters or more, not a word every family has)
// is part of a word of its name, or the other way ("coal" of Charcoal, "akura" of Sakura)
const OCR_PLAIN = new Set(
  'grey gray light dark pale deep green blue pink yellow brown orange purple violet cool warm neutral bright soft'.split(
    ' ',
  ),
);
function ocrWordsOf(t) {
  return String(t || '')
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((w) => w.length >= 4 && !OCR_PLAIN.has(w));
}
// (v318.19) a marker's name, and with the code read (text) its OLD code, the names on its older caps too: "R6" with
// "Rose Red" is R213's old cap; "R213" with "Rose Red" isn't (that's Copic R85's name)
function ocrNameOf(i, text) {
  const c = COLORS[i];
  if (!c.cap || !text) return c.name || '';
  const k = scanKey(text);
  return (scanIndex().byOld.get(k) || []).indexOf(i) >= 0 ? scanNamesOf(i).join(' ') : c.name || '';
}
// (v318.19 debug) with the code read (text) as i's OLD code, one of the names on i's older caps read whole: plain
// words count here ("Y11 Brown Grey", "BG2 Deep Green": every word of them is one every family has, which
// ocrNameAgrees leaves out)
function ocrCapNamed(i, names, text) {
  const c = COLORS[i];
  if (!c.cap || !text || !names || !names.length) return false;
  if ((scanIndex().byOld.get(scanKey(text)) || []).indexOf(i) < 0) return false;
  const read = new Set(scanWords(names.join(' ')));
  return c.cap.some((nm) => {
    const ws = scanWords(nm);
    return (ws.length > 1 || (ws[0] || '').length >= 5) && ws.every((w) => read.has(w));
  });
}
function ocrNameAgrees(i, names, text) {
  const mine = ocrWordsOf(ocrNameOf(i, text));
  return ocrWordsOf(names.join(' ')).some((f) => mine.some((w) => w.indexOf(f) >= 0 || f.indexOf(w) >= 0));
}
