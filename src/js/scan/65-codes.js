/* ===== Scan: the codes in a piece of text, into the list (scan.js 2265–2694 until v318.8) =====
   scanHandleCodes: each code read as one marker, a question, another brand's, a set's, with the brand rules of
   60-brands.js applied. */
// the card under the box, for a card said while a read's own would cover it
let scanReadNote = '',
  // the brand of the last code read in the box that one brand has (scanAsk)
  scanLastBrand = '';
// the codes in a piece of text. named: a set's name was read in it, said instead. list: read as a list even when it's
// one line (a photo's), so a name alone or another brand's code is a question in the list, not a card
function scanHandleCodes(text, loud, named, list) {
  const n = scanHandleCodes0(text, loud, named, list);
  // (v318.7) the switch to both brands this read made: its card said last, over the read's own
  if (scanSw.say) {
    const s = scanSw.say;
    scanSw.say = null;
    scanSay('ok', s[0], s[1], -1);
  }
  return n;
}
function scanHandleCodes0(text, loud, named, list) {
  if (!String(text).trim()) return 0;
  scanHandling = String(text);
  scanHandleId++;
  scanReadNote = '';
  // (v318.7) a list typed, pasted or opened (loud; not a photo's lines, nor Find mode, nor Scan Text's reads cap by
  // cap) plainly one brand's is read as that brand's; of both brands, as either; said on the card (scanListBrand)
  const auto = !list && !scanFind && !scanPhoto ? scanAuto() : '',
    lb = loud && !list && !scanFind && !scanPhoto ? scanListBrand(text) : null,
    one = !/[\r\n]/.test(String(text).trim());
  let brand = scanBrand,
    note = '';
  if (lb && lb.brand && lb.brand !== scanBrand) {
    brand = lb.brand;
    note =
      scanBrandChosen && scanBrand
        ? 'Read as ' + brand + ', though ' + scanBrand + ' is chosen above the box'
        : 'Read as ' + brand + ': its codes are plainly ' + brand + '’s';
    // (a list read as the other brand: the sweep's brand shown, both read from now on)
    if (auto && brand !== auto && !scanSw.on) {
      scanSwitchOn('paste');
      note += ' · both brands are read from now on';
    }
  } else if (lb && lb.mixed && scanBrand) {
    brand = '';
    note = 'Codes of both brands: those both have are asked · A brand tapped above answers them at once';
  }
  // (a line naming its brand is read as its, whatever is chosen: a list's, or one typed, unless the brand was set for
  // you and the word is the other brand's, read as evidence of the brand below)
  scanLineBrand = !!lb || (loud && !list && !scanFind && !scanPhoto && (!auto || scanSw.on));
  if (scanLineBrand && !lb && one && scanBrandWord(text)) brand = scanBrandWord(text);
  let r;
  try {
    r = lb && brand === '' && lb.r ? lb.r : scanRead(text, brand);
  } finally {
    scanLineBrand = false;
  }
  const before = new Set(scanList);
  if (!list && !scanFind && !scanPhoto && !lb) {
    const bs = new Set(r.other.map((i) => COLORS[i].brand));
    r.codes.forEach((c) => {
      const b = [...new Set(c.opts.map((i) => COLORS[i].brand))];
      if (b.length === 1) bs.add(b[0]);
    });
    if (bs.size === 1) scanLastBrand = [...bs][0];
  }
  // (v318.7) with the brand set for you, a cap read in the box as the other brand's alone: counted towards the
  // switch to both brands (scanSw); read noisily (a code of this brand read wrong, scanNotWhole), a card; whole, a
  // question in the list, or the read that makes the switch, read again under either brand
  let whole = [],
    noisy = null;
  if (auto && !lb && !r.many && r.other.length && !r.codes.length) {
    whole = r.other.filter((i) => scanWholeOther(i, text, auto));
    if (!scanSw.on) {
      whole.forEach((i) => scanSw.whole.add(i));
      r.other.forEach((i) => scanSw.other.add(i));
      const last = scanSw.seq[scanSw.seq.length - 1];
      if (!(last && last.k === 'other' && last.i === r.other[0]))
        scanSw.seq.push({ k: 'other', i: r.other[0] });
      const three = scanSw.seq.slice(-3),
        go =
          scanSw.whole.size >= 2 ||
          (scanSw.other.size >= 2 && !scanSw.autoOnly) ||
          (three.length === 3 && three.every((x) => x.k === 'other'));
      if (go && (!scanSw.off || scanSw.other.size >= 2)) {
        scanSwitchOn('read');
        if (whole.length === r.other.length) r = scanRead(text, '');
      }
    }
    if (r.other.length && whole.length < r.other.length) {
      noisy = r.other.slice();
      r = Object.assign({}, r, { other: [] });
    }
  }
  // (v318.7) a single quiet read of an old code of the brand set or chosen that's another brand's code now, where the
  // code could be a code of this brand read wrong (Y13 of BGY13): a card with every choice, never a question in the
  // list (the cap, held still, is read whole)
  // (v318.22 debug: not for text left in the box as Scan closes, whose card no one would see: asked in the list)
  if (
    !loud &&
    !scanMute &&
    !list &&
    !r.many &&
    r.codes.length === 1 &&
    r.codes[0].s0 &&
    r.codes[0].opts.length > 1
  ) {
    const c = r.codes[0],
      w = scanNotWhole(c.code, brand);
    if (w) {
      if (!scanCardAgain('s0 ' + c.code, loud)) {
        scanSay(
          'ask',
          c.code +
            ': ' +
            c.opts
              .map(
                (i) =>
                  COLORS[i].brand +
                  ' ' +
                  scanName(i) +
                  ((c.oldOf || []).indexOf(i) >= 0 && oldCode(COLORS[i])
                    ? ' (was ' + oldCode(COLORS[i]) + ')'
                    : ''),
              )
              .join(', or ') +
            '?',
          'Or ' + scanNotWholeWhy(w, brand) + ' · Hold the cap still',
          -1,
          c.opts.map((i) => ({
            i: i,
            how: (c.oldOf || []).indexOf(i) >= 0 ? 'old' : 'chosen',
            label: 'Add ' + COLORS[i].brand + ' ' + COLORS[i].code,
          })),
        );
        scanBeep('none');
      }
      return 0;
    }
  }
  // (v318.3 debug: a photo whose other lines all went in at once, or were unsure and read apart, left one cap's name or
  // another brand's code to say on a card, muted while a photo's settled: missed without a word)
  if (list && !r.many) {
    r.many = true;
    r.names = r.byName >= 0 ? [r.byName] : [];
    r.names2 = r.byNames ? [r.byNames] : [];
    r.unread = 0;
    r.byName = -1;
    delete r.byNames;
  }
  let n = 0;
  // several at once (a pasted list): into the list together, then said once
  // (another brand's codes read along with codes of the brand chosen, or in a list, are questions in the list)
  // (v318 review: not in Find mode, whose list is of the brand chosen there: another brand's marker in it matches no set.
  // Left out, and said)
  // (v318.7: and, with the brand set for you, another brand's cap read whole on its own)
  // (v318.22 debug: and with a brand chosen, one typed or left in the box as Scan closes: on a card it was lost to the
  // next code typed, which ran into it in the box, "RV10Y06")
  const others = scanFind
      ? []
      : r.many || r.codes.length || (auto && !scanSw.on) || loud || scanMute
        ? r.other
        : [],
    otherOut = scanFind && (r.many || r.codes.length) ? r.other.length : 0,
    many =
      r.codes.length +
        (r.many ? r.flips.length + r.names.length + r.names2.length : 0) +
        others.length +
        otherOut >
      1;
  let took = 0,
    mine = 0,
    asked = 0;
  const ask = function (key, title, opts) {
    const a = scanAsk(key, title, opts, many, loud);
    if (a === true) asked++;
    else if (!many && loud && a !== 'again') {
      // (said when it's typed: the question is waiting in the list already, or its answers are in it)
      scanSay('same', title, a === 'listed' ? 'Already in the list' : 'Waiting in the list below', -1);
      scanBeep('same');
    }
  };
  r.codes.forEach(function (c) {
    n++;
    if (c.asked === 'num' || c.asked === 'hint' || c.asked === 'confirm') {
      ask(
        c.asked + ' ' + (c.asked === 'confirm' ? c.as : c.code),
        c.asked === 'confirm'
          ? '“' + c.as + '” read: is it this one?'
          : c.asked === 'num'
            ? c.code + ' was read beside other codes: is it this one?'
            : c.code + ' isn\u2019t a code of the brand on the cap: is it this one?',
        c.opts.map((i) => ({ i: i, how: (c.oldOf || []).indexOf(i) >= 0 ? 'old' : 'chosen' })),
      );
      return;
    }
    if (c.opts.length === 1) {
      // (v318.21: and what its cap says, by the code read, caps.js)
      if (
        scanTake(c.opts[0], c.old ? 'old' : c.named ? 'name' : '', loud, many, {
          with: { cv: capCvRead(c.opts[0], !!c.old, !!c.named) },
        })
      ) {
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
    // (v318.7: with the brand set for you, not "chosen"; in a list read as its own brand, the rest of the list's)
    ask(
      'other ' + mkey(i),
      auto
        ? COLORS[i].brand + ' ' + scanName(i) + ': add it? ' + auto + ' was set for you'
        : // (v318.22 debug: one code on its own, typed, names its marker, as its card had, v298)
          !r.many && !r.codes.length && brand === scanBrand
          ? COLORS[i].brand +
            ' ' +
            scanName(i) +
            ': add it? Another brand than the one chosen (' +
            brand +
            ')'
          : (brand === scanBrand
              ? 'Another brand than the one chosen (' + brand + ')'
              : 'Another brand than the rest of the list (' + brand + ')') + ': add it?',
      [{ i: i, how: 'chosen' }],
    );
  });
  // (v318.7) what this read put in, for the switch to both brands: a code both brands use taken as the brand set for
  // you (e.auto, with the count of codes only its own read so far), a code only its own (counted), a question about a
  // cap read whole, and, once switched, the other brand's markers taken and the brand questions raised
  const listWords = auto && scanSw.on && r.many ? new Set(ocrWordsOf(text)) : null;
  if (auto)
    scanList.forEach(function (e) {
      // (a question waiting about a cap now read whole: so marked)
      if (e.ask && /^other /.test(e.ask) && e.opts.some((o) => whole.indexOf(o.i) >= 0)) e.whole = true;
      if (before.has(e)) return;
      if (e.ask) {
        if (scanSw.on && /^brands /.test(e.ask)) e.held = true;
        return;
      }
      const b = COLORS[e.i].brand;
      if (scanSw.on) {
        if (b !== auto) {
          e.flip = true;
          e.whole = e.whole || !!scanWholeOther(e.i, text, auto, listWords);
        }
        return;
      }
      if (b !== auto) return;
      if (scanShared(e.i)) {
        e.auto = true;
        e.autoAt = scanSw.autoOnly;
      } else {
        scanSw.autoOnly++;
        scanSw.seq.push({ k: 'auto' });
      }
    });
  // (v318.7) the markers a list typed, pasted or opened put in: a code both brands use read in the box after it is that
  // list's marker read again, scanAsk (v318.7 debug: this had been done before the list's markers were in, so none was
  // ever marked, and "YR07: Ohuhu or Copic?" was still asked after a Copic list was pasted and its caps swept)
  if (loud && !list && !scanFind && !scanPhoto && (r.many || many))
    scanList.forEach((e) => !before.has(e) && !e.ask && (e.pasted = true));
  if (many) {
    const same = n - took - asked,
      key = r.codes
        .map((c) => c.code + '|' + c.opts.join(','))
        .sort()
        .join(' '),
      now = Date.now(),
      again = !loud && !took && !asked && scanLastMany.key === key && now - scanLastMany.at < 6000;
    scanLastMany = { key: key, at: now };
    // (v318: not a box's other words, when its name was read)
    if (r.unread && !again && !named) scanUnread += r.unread;
    // (two caps held in view come again and again: said once)
    if (!again && n && !named) {
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
          // (v318.7: a list read as its own brand, or as either: said, as a photo's brand is; lines naming a brand)
          note,
          r.named
            ? Object.keys(r.named)
                .map((b) => r.named[b] + ' named ' + b)
                .join(' \u00b7 ')
            : '',
          allMine ? (took === 1 ? 'Already in your collection' : 'All already in your collection') : '',
          took && asked ? asked + ' to choose below' : '',
          same ? same + ' already in the list' : '',
          otherOut ? otherOut + ' not ' + scanFind.brand + ', left out' : '',
          r.unread ? r.unread + (r.unread === 1 ? ' line' : ' lines') + ' not read' : '',
        ]
          .filter(Boolean)
          .join(' · ') || 'Check them below',
        -1,
        // (v318.7: a list typed, pasted or opened: the set nearly all here, with what's missing, as Done's card says it)
        loud ? scanGapChoices() : null,
      );
      scanBeep(took && !allMine ? 'ok' : 'same');
    }
    // (v303: drawn every time: a question settled by a name read can leave the list as long as it was)
    scanRender();
    // (a set's name read with the codes: its card takes this one's place, with the note)
    if (named) scanReadNote = note;
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
    // (v318.21 debug: a code read upside down is one as it is now: its cap too, caps.js)
    if (f.opts.length === 1 && f.sure)
      scanTake(f.opts[0], 'upside', loud, false, { with: { cv: capCvRead(f.opts[0], false, false) } });
    // (v303: through ask, so on Enter a question already waiting is said so)
    else
      ask(
        'upside ' + f.as,
        f.opts.length === 1 ? 'Read upside down: is it this one?' : 'Upside down: which one?',
        f.opts.map((i) => ({ i: i, how: 'upside' })),
      );
  });
  if (n) return n;
  // (v318.7) with the brand set for you, another brand's code read that could be one of this brand's read wrong: a
  // card, with what it could be (the cap held still is read whole; typed, there's no cap to hold)
  if (noisy) {
    // (v318.22 review H) typed, Entered, or read from a list of one code: nothing was misread, there's no cap to hold
    // still, and the next code typed replaced the card, so a Copic RV10 typed with Ohuhu set for you was lost without
    // a word. A question in the list instead, as a cap read whole as the other brand's is; `ask` says it when the
    // question or its answer is in the list already
    // (v318.22 debug: and text left in the box when Scan is closed, read on the way out: no card would be seen)
    if (loud || scanMute) {
      noisy.forEach(function (i) {
        ask(
          'other ' + mkey(i),
          COLORS[i].code +
            ': ' +
            COLORS[i].brand +
            '\u2019s, or ' +
            scanNotWholeWhy(scanNotWhole(scanKey(COLORS[i].code), auto), auto) +
            '?',
          [{ i: i, how: 'chosen' }],
        );
      });
      return 1;
    }
    if (scanCardAgain('noisy ' + noisy.join(','), loud)) return 0;
    const i = noisy[0],
      w = scanNotWhole(scanKey(COLORS[i].code), auto);
    scanSay(
      'ask',
      COLORS[i].code + ': ' + COLORS[i].brand + '\u2019s, or ' + scanNotWholeWhy(w, auto) + '?',
      loud ? '' : 'Hold the cap still',
      noisy.length === 1 ? i : -1,
      noisy.map((i) => ({ i: i, how: 'chosen', label: 'Add ' + COLORS[i].brand + ' ' + COLORS[i].code })),
    );
    scanBeep('none');
    return 0;
  }
  if (r.other.length) {
    if (scanCardAgain('other ' + r.other.join(','), loud)) return 0;
    const one = r.other.length === 1 ? r.other[0] : -1;
    // (v318 review) Find mode: the set looked for is the brand chosen there, so no Add
    if (scanFind) {
      scanSay(
        'none',
        one >= 0
          ? COLORS[one].brand + ' ' + scanName(one)
          : COLORS[r.other[0]].code + ': another brand’s code',
        'Not ' +
          (scanFind.brand === 'Ohuhu' ? 'an' : 'a') +
          ' ' +
          scanFind.brand +
          ' code: this looks for ' +
          scanFind.brand +
          ' sets',
        one,
      );
      scanBeep('none');
      return 0;
    }
    // (v298: "Ohuhu E19 Dried Sage", not "E19 is a Ohuhu code")
    scanSay(
      'ask',
      one >= 0 ? COLORS[one].brand + ' ' + scanName(one) : COLORS[r.other[0]].code + ': another brand’s code',
      'Another brand than the one chosen (' + brand + ')',
      one,
      r.other.map((i) => ({ i: i, how: 'chosen', label: 'Add ' + COLORS[i].brand + ' ' + COLORS[i].code })),
    );
    scanBeep('none');
    return 0;
  }
  if (loud && !named) {
    scanSay('none', 'No marker code found', '“' + String(text).trim().slice(0, 40) + '”', -1);
    scanBeep('none');
  }
  return 0;
}
