/* ===== Scan: a piece of text into the list (scan.js 1499–2039 until v318.8) =====
   The cards and sounds (scanSay, scanBeep), a marker into the list (scanTake), a question (scanAsk), sets named in
   pasted text (scanSets, scanSetCard), and scanHandle, which hands the codes to 65-codes.js. */
// (v303) no sound while the dialog closes (text left in the box read on the way out)
let scanMute = false;
// (v318) the photo reader's lines read: none as if upside down (the reader tried both ways up)
let scanNoFlip = false;
// (v318.2) the photo reader's reading: a reading of digits alone isn't bent into a code with letters, as a typed one is
// ("99" isn't G9, Ohuhu's old code for G112: a scrap of a cap; three digits or more, "808", are asked about). And while a
// photo's lines are settled, its generation (photo-read.js): 'new' when its caps plainly show the codes as they are now,
// so a code that's only an old one isn't taken (unless the name read with it is its marker's) and a code that's one
// marker's now and another's old code is the one it is now ("Which Y210?"); 'strict', for the photo's unsure lines, the
// first only. Either way, such a code read with a word of the old one's name only is asked about ("Y210 Golden")
let scanPhoto = false,
  scanGen = '';
// (v318.7) while a list typed, pasted or opened is read: a line naming its brand is read as that brand's
let scanLineBrand = false;
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
      // (v318: a heading over a set's choices)
      if (c.head) {
        const h = document.createElement('span');
        h.className = 'scphead';
        h.textContent = c.head;
        row.appendChild(h);
        return;
      }
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = c.label + (!c.go && state.owned.has(mkey(c.i)) ? ' · already yours' : '');
      b.addEventListener('click', function () {
        // (v318: or a set's markers)
        if (c.go) c.go();
        // (v318.21 debug: an answer by its old code tells its older cap, as a list chip's does)
        else
          scanTake(
            c.i,
            c.how,
            true,
            false,
            c.how === 'old' ? { with: { cv: capCvRead(c.i, true, true) } } : undefined,
          );
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
        // (v318.7: the keyboard's place follows the keyboard, as after a question in the list: not up over the list
        // after a photo's card)
        scanFocusAfter(-1);
      });
      row.appendChild(b);
    });
    el.querySelector('.sctext').appendChild(row);
  }
}
// into the list. loud: said and sounded even when it's the marker just read (a read from the camera holding still on
// one cap comes again and again: only the first says so). at (v318.7): where in the list it goes, with what else the
// entry carries (an answer takes its question's place and its photo); else at the top
function scanTake(i, how, loud, batch, at) {
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
    // (v318.21 debug: read again, what its cap says is the latest read's, caps.js)
    const cv = at && at.with && at.with.cv;
    if (cv) scanList.forEach((e) => !e.ask && e.i === i && (e.cv = cv));
    if (!again && !batch) {
      scanSay('same', scanName(i), 'Already in the list' + scanBrandOf(i), i);
      scanBeep('same');
    }
    return false;
  }
  const entry = Object.assign({ i: i, how: how || '' }, at && at.with);
  if (at && at.n >= 0 && at.n <= scanList.length) scanList.splice(at.n, 0, entry);
  else scanList.unshift(entry);
  // (v318.22 debug) a question waiting about this marker as another brand's, whose one answer it is, goes now it's in
  // (after the switch to both brands it was taken and still asked; Keep Ohuhu then asked it a second time)
  // (fourth pass: not while a photo is read, whose own pass answers such a question and keeps it for Undo this photo:
  // taken here, Undo had lost it for good)
  const qk = 'other ' + mkey(i);
  if (!scanPhoto && scanList.some((e) => e.ask === qk)) scanList = scanList.filter((e) => e.ask !== qk);
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
// 'quiet' (the cap's still in view, v303), 'again' (one brand's marker of the code is in the list: said, v318.7)
function scanAsk(key, title, opts, batch, loud) {
  // (asked already: the same question waiting)
  if (scanList.some((e) => e.ask === key)) return 'waiting';
  const now = Date.now();
  // (v303) nothing to ask: every answer is in the list already (a list pasted twice)
  if (opts.every((o) => scanList.some((e) => e.i === o.i))) return 'listed';
  // (v318.7) a code both brands use, read in the box when that brand's marker of it is in the list from a list pasted
  // or opened this visit and the last one-brand code read was that brand's too (a Copic list pasted, then its caps
  // swept): that cap read again, said so, not "Ohuhu or Copic?". Not one read in the box before (v303: a second cap
  // with the same code is asked about once the first has gone), nor when the caps just read were the other brand's
  if (!batch && /^brands /.test(key) && scanLastBrand) {
    const o = opts.find(
      (o) => COLORS[o.i].brand === scanLastBrand && scanList.some((e) => !e.ask && e.i === o.i && e.pasted),
    );
    if (o) {
      scanSay('same', scanName(o.i), 'Already in the list' + scanBrandOf(o.i), o.i);
      scanBeep('same');
      return 'again';
    }
  }
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
// (v318) A set's name in pasted text (its box, an order email, a shop's page): "Honolulu 120", "Ciao 36 Set A",
// "36 Skin Tones". Returns groups of MARKER_SETS indices, each the sets one name could be: one when the name says which,
// more when it doesn't (Ciao 36 with no letter read: Set A to E). Only a size the range comes in counts, and not a price
// ($48.99, 48.99) or part of an order number; a size said as colours ("120 Colors") first. A line, or a line and the
// next, at a time (an order of two sets is two names); the whole text when no line says (a box's words a line each).
// brand: only that brand's sets. hint: the brand chosen in Scan (its sets read without their brand's word too).
function scanSets(text, brand, hint) {
  const lines = String(text).normalize('NFKC').replace(/[‐-―]/g, '-').split(/\r?\n/),
    all = lines.join(' '),
    saysO = /\b(ohuhu|honolulu)\b/i.test(all),
    saysC = /\bcopic\b/i.test(all),
    // (v318.28) with a brand chosen, or Find mode's, and neither brand named: that brand's ("6 Skin Tones" with Ohuhu
    // chosen, "Sketch 72 Set A" in Copic's Find mode had found no set)
    b = brand || hint,
    ohuhu = saysO || (b === 'Ohuhu' && !saysC),
    copic = saysC || (b === 'Copic' && !saysO),
    // (v318.1) a tray's text (two or more codes read off caps): a number near the range's word on another line is a
    // cap's code, not the set's size, unless said as colours ("HONOLULU" on the case, then R014, 120 — Ohuhu's Black —
    // and Y28 had offered Honolulu 120 and dropped the 120 from the codes). A line of its own still says it.
    tray = (all.match(/\b[A-Z]{1,3}\d{1,4}\b/gi) || []).length >= 2,
    out = [],
    seen = new Set();
  const by = (n) => MARKER_SETS.findIndex((p) => p.n === n);
  const put = function (names, into) {
    const is = names.map(by).filter((i) => i >= 0 && (!brand || MARKER_SETS[i].b === brand)),
      k = is.join(',');
    if (is.length && !seen.has(k)) {
      seen.add(k);
      into.push(is);
    }
    return is.length > 0;
  };
  // the sizes in w that are among ok, as numbers standing alone, said as colours ("120 Colors") or near kw, the word
  // that says which range ("Honolulu 120", "Ciao Set 72A"): not a code read off a cap in a tray's text
  // (strict: lines joined — the line and the next, or the whole text — of a tray's text: only a size said as colours)
  let strict = false;
  const sizes = function (w, ok, kw) {
    const re = /\d+(?:[.,]\d+)*/g,
      near = [],
      col = [],
      at = [];
    let m;
    const k = new RegExp(kw.source, 'gi');
    while ((m = k.exec(w))) at.push(m.index, m.index + m[0].length);
    while ((m = re.exec(w))) {
      const v = m[0],
        i = m.index,
        before = w.slice(0, i),
        after = w.slice(i + v.length);
      // (not a price, an order number's part, nor a code's number: E24, or "R 24" as a tray's text can split one)
      // (v318.1: "Honolulu B 120" is the range's second series, not a code "B 120")
      if (
        /[.,]/.test(v) ||
        // (v318.28: a dash an order number's only touching the number before it: "Markers - 120 Colors" is a size)
        /[A-Za-z\d]$|[$£€#]\s?$|\S-$/.test(before) ||
        (/\b[A-Z]{1,3}\s$/.test(before) && !/\b(SET|OF|HONOLULU\s+B)\s$/i.test(before)) ||
        /^(-\d|\s?%)/.test(after)
      )
        continue;
      const n = +v;
      if (ok.indexOf(n) < 0) continue;
      if (/^\s*-?\s*(colou?rs?|pcs|pieces|count|ct|pack)\b/i.test(after)) col.push(n);
      else if (!strict && at.some((x) => Math.abs(x - i) <= 24 || Math.abs(x - i - v.length) <= 24))
        near.push(n);
    }
    const r = [...new Set(col.length ? col : near)];
    // (each said as colours: a set each, "Honolulu 24 Colors and Honolulu 48 Colors"; else which one it is, unsure)
    r.each = col.length > 0;
    return r;
  };
  // the sets of the sizes found: one name each when each was said as colours, else one question
  // (v318 review: and a set each for the letters named, "Ciao 72 Set A and Set B": sep)
  const named = function (ns, f, into) {
    let hit = false;
    const each = (names) =>
      names.sep ? names.forEach((x) => (hit = put([x], into) || hit)) : (hit = put(names, into) || hit);
    if (!ns.each && ns.length !== 1) return put(ns.flatMap(f), into);
    ns.forEach((n) => each(f(n)));
    return hit;
  };
  // a Copic set's letters: "Set A", "36A", "72 - B", and more than one, "Set A and Set B", "Sets A & B", "72A, 72B"
  const letters = function (w, n) {
    const out = [],
      add = (x) => out.indexOf(x) < 0 && out.push(x),
      join =
        '(?:\\s*(?:,|&|/|\\+|[Aa][Nn][Dd]|[Oo][Rr])\\s*(?:[Ss][Ee][Tt]\\s*-?\\s*|' +
        n +
        '\\s*-?\\s*)?[A-E]\\b)*';
    [
      new RegExp('\\b[Ss][Ee][Tt][Ss]?\\s*-?\\s*[A-E]\\b' + join, 'g'),
      new RegExp('\\b' + n + '\\s*-?\\s*[A-E]\\b' + join, 'g'),
    ].forEach(function (re) {
      (w.match(re) || []).forEach((m) =>
        (m.replace(/^[Ss][Ee][Tt][Ss]?|^\d+/, '').match(/\b[A-E]\b|(?<=\d)[A-E]\b/g) || []).forEach(add),
      );
    });
    return out;
  };
  const lettered = function (name, n, w) {
    const ls = letters(w, n);
    if (!ls.length) return 'ABCDE'.split('').map((x) => name + ' - Set ' + x);
    const r = ls.map((x) => name + ' - Set ' + x);
    r.sep = true;
    return r;
  };
  // (whether w named a set, new or not)
  const rules = function (w, into) {
    let hit = false;
    // (v318.28) the sizes a themed set took: Honolulu's own read beside them ("Honolulu 72 Colors + 6 Skin Tones")
    const took = new Set(),
      th = (ns) => (ns.forEach((n) => took.add(n)), ns);
    if (ohuhu) {
      if (/\bmid[\s-]?tones?\b/i.test(w) && th(sizes(w, [48], /mid[\s-]?tones?/)).length)
        hit = put(['48 Mid-tone Set'], into) || hit;
      // (v318.27) Ohuhu's three skin sets: the shop names the 24 "Honolulu 24 Skin Tone Colors", which had read as
      // Honolulu 24 (the app's "24 Portrait"); "6 Skin Tones" is the small one
      // (v318.28: as Honolulu's, a size each when said as colours, else one question: "24 Skin Tone Colors (Pack of 6)"
      // had offered both sets)
      if (/\bskin\b/i.test(w))
        hit =
          named(
            th(sizes(w, [6, 24, 36], /skin/)),
            (n) => [n === 36 ? '36 Skin Tones' : n === 24 ? '24 Portrait' : '6 Skin Tones'],
            into,
          ) || hit;
      if (/\bgr[ae]ys?\b/i.test(w) && th(sizes(w, [36], /gr[ae]ys?/)).length)
        hit = put(['36 Gray Tones'], into) || hit;
      if (/\bpastels?\b/i.test(w) && th(sizes(w, [48], /pastels?/)).length)
        hit =
          put(
            /sweet/i.test(w)
              ? ['48 Pastel - Sweetness']
              : /blossom/i.test(w)
                ? ['48 Pastel - Blossoming']
                : ['48 Pastel - Sweetness', '48 Pastel - Blossoming'],
            into,
          ) || hit;
      if (/\bportraits?\b/i.test(w) && th(sizes(w, [24], /portraits?/)).length)
        hit = put(['24 Portrait'], into) || hit;
      if (sizes(w, [104], /ohuhu/).length) hit = put(['104 Colors Set'], into) || hit;
      // (a line naming one of those isn't also Honolulu 48: "Honolulu Mid-tone 48 Colors". v318.28: only the size it
      // took is left out, not every size on the line: "Honolulu 72 Colors + 6 Skin Tones" had read only the 6)
      if (/\bhonolulu\b/i.test(w)) {
        const hs = sizes(w, [24, 48, 72, 120, 168, 216, 320], /honolulu/),
          left = hs.filter((n) => !took.has(n));
        left.each = hs.each;
        if (left.length)
          hit =
            named(left, (n) => [n === 320 ? 'Honolulu 320 (complete set)' : 'Honolulu ' + n], into) || hit;
      }
    }
    if (/\bciao\b/i.test(w))
      hit =
        named(
          sizes(w, [12, 24, 36, 72], /ciao/),
          (n) => (n < 36 ? ['Ciao ' + n] : lettered('Ciao ' + n, n, w)),
          into,
        ) || hit;
    if (copic && /\bsketch\b/i.test(w))
      hit =
        named(
          sizes(w, [12, 24, 36, 72], /sketch/),
          (n) =>
            n === 72
              ? lettered('Sketch 72', 72, w)
              : n === 24
                ? /manga/i.test(w)
                  ? ['Sketch 24 - Manga']
                  : []
                : ['Sketch ' + n],
          into,
        ) || hit;
    return hit;
  };
  lines.forEach(function (l, i) {
    strict = false;
    if (rules(l, out) || i + 1 >= lines.length) return;
    strict = tray;
    rules(l + ' ' + lines[i + 1], out);
  });
  strict = tray;
  if (!out.length && lines.length > 1) rules(all, out);
  return out;
}
// A piece of text from the box. loud: Enter or a paste, said even when nothing in it is a code. Returns how many
// markers or questions it held (0: nothing to clear the box for).
let scanHandling = '',
  scanHandleId = 0;
function scanHandle(text, loud) {
  // (v318: a set's name, in text pasted or typed: its box, an order email)
  // (v318 review: and read by Scan Text from a set's box, quietly: "HONOLULU 120" had added Ohuhu's 120, Black. Not in
  // Find mode, where a set's name goes straight on to Is this your set?: only on Enter or a paste there)
  let sets =
    String(text).trim() && (loud || !scanFind)
      ? scanSets(text, scanFind ? scanFind.brand : '', scanBrand)
      : [];
  // (read quietly with the name of the marker whose code is the size, "HONOLULU 120 Black": that cap, not the set)
  if (!loud && sets.length) {
    const tw = scanWords(text),
      zs = sets.flat().map((i) => (MARKER_SETS[i].n.match(/\d+/) || [''])[0]);
    if (
      COLORS.some(
        (c) => zs.indexOf(scanKey(c.code)) >= 0 && scanWords(c.name || '').every((w) => tw.indexOf(w) >= 0),
      )
    )
      sets = [];
  }
  // (the set's size isn't a code: a box's "120 Colors" had added Ohuhu 120, Black)
  let codes = String(text);
  const sizes = [];
  // (v328 review: only on a line that names the set, its range or says its size: a 120 on a line of its own among a
  // tray's codes, Ohuhu's Black, had gone from "Honolulu 120 Colors / R014 / 120 / Y28" without a word)
  const setLine = /\b(honolulu|ohuhu|copic|ciao|sketch|classic|set|colou?rs?|pcs|pieces|count|ct|pack)\b/i;
  new Set(sets.flat().map((i) => (MARKER_SETS[i].n.match(/\d+/) || [''])[0])).forEach(function (z) {
    const was = codes;
    if (z) {
      // (v328 review 2: or the size alone on its line, beside a line that names the set or says colours: a box's
      // "HONOLULU / 120 / COLORS")
      const parts = codes.split(/(\r?\n)/),
        lines = parts.filter(function (x, i) {
          return !(i % 2);
        }),
        // (beside a line naming the set that doesn't say the size itself: a tray's lone 120 under "Honolulu 120
        // Colors" is Black)
        alone = new RegExp('^\\s*' + z + '\\s*$'),
        inName = new RegExp('(^|[^A-Za-z0-9-])' + z + '(?![A-Za-z0-9])'),
        nameNb = function (j) {
          return j >= 0 && j < lines.length && setLine.test(lines[j]) && !inName.test(lines[j]);
        };
      codes = parts
        .map(function (ln, i) {
          if (i % 2) return ln;
          const k = i / 2;
          if (setLine.test(ln))
            return ln.replace(new RegExp('(^|[^A-Za-z0-9-])' + z + '(?![A-Za-z0-9])', 'g'), '$1');
          if (alone.test(ln) && (nameNb(k - 1) || nameNb(k + 1))) return '';
          return ln;
        })
        .join('');
    }
    // (said as colours, "120 COLORS", it's the set's size for sure: no cap offered)
    if (
      codes !== was &&
      !new RegExp('\\b' + z + '\\s*-?\\s*(colou?rs?|pcs|pieces|count|ct|pack)\\b', 'i').test(text)
    )
      sizes.push(z);
  });
  // (read quietly, the size could still be the cap of that code, Black's 120 beside "Ohuhu" on its barrel: offered on
  // the set's card, beside the set, and the card said once while the camera holds still on it)
  const offer = loud
    ? []
    : COLORS.map((c, i) => i).filter(
        (i) => sizes.indexOf(scanKey(COLORS[i].code)) >= 0 && (!scanBrand || COLORS[i].brand === scanBrand),
      );
  if (sets.length && !loud && scanCardAgain('sets ' + sets.flat().join(','), false)) return 1;
  const n = scanHandleCodes(codes, loud, sets.length > 0);
  if (!sets.length) return n;
  if (scanFind) {
    // (Find mode: the name says which set, straight to Is this your set?, with the caps read so far)
    const keys = scanList.filter((e) => !e.ask).map((e) => mkey(e.i)),
      f = scanFind;
    closeScan();
    f.done(keys, [...new Set(sets.flat())]);
    return n || 1;
  }
  scanSetCard(sets, n > 0, null, offer);
  return n || 1;
}
// (v318) a set added to the list by its name since the list was last added or cleared: the welcome offers Some are
// missing after it, as after a set ticked
let scanSetIn = false;
// the card for the sets named: a button for each, asked first (a set's markers are a lot to put in the list unasked,
// and the name may be a set you're giving away). codes: codes were read along with it. took: after one was added, what
// it added, with the other names' buttons still there
// offer: markers whose code is the size read (read quietly: it could be that cap), each a button of its own
function scanSetCard(groups, codes, took, offer) {
  const full = (p) => (p.allbrand ? p.n : p.b + ' ' + p.n),
    one = groups.length === 1 && groups[0].length === 1,
    choices = [];
  groups.forEach(function (g, gi) {
    // (a name that doesn't say which: its sets under a heading, by what tells them apart, "Ciao 36: which one?" Set A,
    // Set B…: five full names had made a column taller than a phone's screen)
    let base = '';
    if (g.length > 1) {
      const ns = g.map((si) => MARKER_SETS[si].n);
      base = ns.reduce(function (a, b) {
        let k = 0;
        while (k < a.length && a[k] === b[k]) k++;
        return a.slice(0, k);
      });
      base = base.slice(0, base.indexOf(' - ') >= 0 ? base.indexOf(' - ') : base.lastIndexOf(' '));
      if (base && groups.length > 1) choices.push({ head: base + ': which one?' });
    }
    g.forEach(function (si) {
      const p = MARKER_SETS[si],
        part = base ? p.n.slice(base.length).replace(/^\s*-?\s*/, '') : '';
      choices.push({
        label: part ? part : one && !took ? 'Add all ' + presetSize(p) + ' to the list' : 'Add ' + p.n,
        go: function () {
          scanSetTake(
            si,
            groups.filter((x, j) => j !== gi),
          );
        },
      });
    });
  });
  if (took) {
    scanSay(
      (took.took && took.mine < took.took) || took.bl ? 'ok' : 'same',
      took.took
        ? took.took + (took.bl ? ' and a Colorless Blender' : '') + ' added to the list'
        : took.bl
          ? 'Its Colorless Blender added to the list'
          : 'All already in the list',
      [
        took.p.n,
        took.mine ? took.mine + ' already yours' : '',
        took.took && took.same ? took.same + ' already in the list' : '',
        groups.length ? 'Another named below' : '',
      ]
        .filter(Boolean)
        .join(' · '),
      -1,
      choices,
    );
    return;
  }
  const p0 = MARKER_SETS[groups[0][0]];
  // ("Copic Ciao 36: which one?", as the choices' heading says it)
  const whichOf = function (g) {
    const a = MARKER_SETS[g[0]];
    let k = 0;
    while (k < a.n.length && g.every((si) => MARKER_SETS[si].n[k] === a.n[k])) k++;
    const c = a.n.slice(0, k),
      b = c.slice(0, c.indexOf(' - ') >= 0 ? c.indexOf(' - ') : c.lastIndexOf(' '));
    return b ? a.b + ' ' + b + ': which one?' : 'Which set is yours?';
  };
  // (v318 review: said as a question in plain words, "120 markers: a set's name, read" had been terse)
  scanSay(
    'ask',
    one
      ? 'Found a set: ' + full(p0)
      : groups.length === 1
        ? whichOf(groups[0])
        : 'Found ' + groups.length + ' sets',
    (one
      ? 'Add all ' + presetSize(p0) + ' of its markers to the list?'
      : groups.length === 1
        ? 'Found a set’s name, but not which one: choose yours'
        : 'Add each one you have') +
      (codes ? ' · The codes read with it are in the list' : '') +
      // (v318.7: and how the list was read, as its own brand, which this card would otherwise cover)
      (codes && scanReadNote ? ' · ' + scanReadNote : '') +
      (offer && offer.length ? ' · or a cap: ' + offer.map((i) => COLORS[i].code).join(', ') + '?' : ''),
    -1,
    choices.concat(
      (offer || []).map((i) => ({ i: i, how: '', label: 'Add ' + COLORS[i].code + ' ' + COLORS[i].name })),
    ),
  );
  scanBeep('same');
}
function scanSetTake(si, rest) {
  const p = MARKER_SETS[si];
  let took = 0,
    mine = 0,
    same = 0,
    bl = false;
  presetMkeys(p).forEach(function (k) {
    const i = keyIdx(k);
    if (i == null) return;
    if (scanTake(i, '', true, true)) {
      // (v318.28) the Colorless Blender an Ohuhu set brings said apart, as the card's "Add all 24" and Add's toast
      // count it: "25 added to the list" had followed "Add all 24 to the list"
      if (k === 'Ohuhu|0') {
        bl = true;
        return;
      }
      took++;
      if (state.owned.has(k)) mine++;
    } else same++;
  });
  scanSetIn = true;
  scanRender();
  scanSetCard(rest, false, { p: p, took: took, mine: mine, same: same, bl: bl });
  scanBeep((took && mine < took) || bl ? 'ok' : 'same');
}
