function ensureCustomSize() {
  const n = state.palSize,
    a = state.customPal || [],
    out = [];
  for (let k = 0; k < n; k++) out.push(k < a.length ? a[k] : null);
  state.customPal = out;
}
// a custom slot's marker is fine while it's in play: in the selection, or one of your markers that isn't dry (any
// marker while the collection is empty); filters don't count, the slot was chosen by hand
function customOk(i) {
  return state.pool
    ? poolSet.has(i) && !(isOwned(i) && isDry(i))
    : !state.owned.size || (isOwned(i) && !isDry(i));
}
// why a marker on the card isn't in play now ('' when it is): (v318.25) a scheme's or a photo's palette says so too
function customWhy(i) {
  return customOk(i)
    ? ''
    : isOwned(i) && isDry(i)
      ? 'marked dry'
      : state.pool
        ? 'not in the selection'
        : 'no longer in your collection';
}
function showCustom() {
  ensureCustomSize();
  palette.classList.add('custommode');
  phint.style.display = 'none';
  buildBands(state.customPal.length);
  bands.classList.toggle('grid', state.customPal.length > 8);
  palette.classList.toggle('gridmode', state.customPal.length > 8);
  const bs = [...bands.querySelectorAll('.band')],
    mixed = brandsMixedIn(state.customPal.filter((x) => x != null));
  bs.forEach((b, k) => {
    const idx = state.customPal[k],
      cd = b.querySelector('.bcode'),
      bt = b.querySelector('.bt');
    if (bt) {
      bt.textContent = mixed && idx != null ? bTag(COLORS[idx].brand) : '';
      bt.style.display = bt.textContent ? '' : 'none';
    }
    b.querySelector('.bhit').setAttribute(
      'aria-label',
      idx == null
        ? 'Empty slot ' + (k + 1) + ', choose a marker'
        : COLORS[idx].brand + ' ' + capCode(idx) + ' ' + capName(idx) + ', change',
    );
    if (idx == null) {
      b.classList.add('empty');
      b.style.background = '';
      cd.textContent = '+';
      cd.style.color = 'var(--sub)';
      b.title = 'Tap to choose a marker';
    } else {
      const c = COLORS[idx],
        why = customWhy(idx),
        own = !why;
      b.classList.remove('empty');
      b.classList.toggle('unowned', !own);
      b.style.background = c.hex;
      cd.textContent = capCode(idx);
      cd.style.color = txt(c.hex);
      b.title =
        c.brand + ' ' + capCode(idx) + ' · ' + capName(idx) + (own ? '' : ' · ' + why) + ' · tap to change';
      if (!own)
        b.insertAdjacentHTML(
          'beforeend',
          '<span class="uwarn" title="' +
            why.charAt(0).toUpperCase() +
            why.slice(1) +
            '">' +
            ic('triangle-alert') +
            '<span class="sfsr">(warning)</span></span>',
        );
    }
  });
  const filled = state.customPal.filter((x) => x != null);
  const miss = filled.filter((i) => !customOk(i)).length;
  // named like any palette once it has a marker (the name it will be saved under), "Custom palette" while it's empty
  palReadout(
    filled.length ? shownPaletteName(filled) : 'Custom palette',
    (filled.length ? 'Custom \u00b7 ' : '') +
      filled.length +
      ' of ' +
      state.customPal.length +
      ' chosen' +
      (miss ? ' · ' + miss + ' not in play' : ''),
    filled,
  );
  setAmb(filled.length ? COLORS[filled[0]].hex : null);
}

// a family's markers in order: by brand as the data has them (its first marker's place), then (v316) lightest first
// (L* of the marker's colour, the order the keys and Colour along use: a family reads as a ramp, R16 R28 R38 … R514,
// where by code it jumped R013 R014 R015 R16 R210) or, with Order set to Code order, by code as the data lists them
// (by the code's text: YR015 before YR03, as printed on the sets' charts, and as they sit in the case)
let _brandAt = null;
function famLight() {
  return state.gapSort !== 'code';
}
function famOrd(a, b) {
  if (!_brandAt) {
    _brandAt = {};
    COLORS.forEach((c, i) => {
      if (_brandAt[c.brand] == null) _brandAt[c.brand] = i;
    });
  }
  const A = COLORS[a],
    B = COLORS[b];
  return (
    _brandAt[A.brand] - _brandAt[B.brand] ||
    (famLight() ? LAB[b][0] - LAB[a][0] : 0) ||
    // (v318.22 debug: by the codes shown, your caps')
    cmpCap(a, b)
  );
}
function cmpCap(a, b) {
  const x = capCode(a),
    y = capCode(b);
  return x < y ? -1 : x > y ? 1 : a - b;
}
// the grid's groups in order: the markers whose code the search names exactly, as "Best match", then those whose old
// code it names, as "Old code" (v304: "g410" had shown G24, once G410, first), then each family, brand by brand and by
// code within a brand (markers added to the data later, Ohuhu's R12 and R14 say, had come after the other brand's, v303)
// (v305) a search that is the start of a code ("E", "BG", "E0", "r2": one to three letters, then any digits) shows
// the markers whose code starts so next, as "Codes starting E" ("BG" is BG's, not BGY's: the letters end there), and
// those whose old code does with the old codes; names come after ("E" had shown R014 first, every name with an e)
function searchPrefix() {
  const q = searchStr ? sQueryOf(searchStr) : null;
  return q && q.words.length === 1 && /^[a-z]{1,3}\d*$/.test(q.whole) ? q.whole : '';
}
function codeStarts(x, p) {
  return x.startsWith(p) && !/[a-z]/.test(x.charAt(p.length));
}
function searchGroups(m) {
  const by = {},
    best = [],
    was = [],
    wasPre = [],
    pre = [],
    p = searchPrefix(),
    out = [];
  for (const i of m) {
    const x = sExact(i),
      h = p && !x ? sHay(i) : null;
    if (x === 2) best.push(i);
    else if (x === 1) was.push(i);
    else if (h && codeStarts(h.codes[0], p)) pre.push(i);
    else if (h && h.codes.slice(1).some((c) => codeStarts(c, p))) wasPre.push(i);
    else (by[COLORS[i].fam] = by[COLORS[i].fam] || []).push(i);
  }
  // (v306) an old code that only starts with the search isn't an old code it names: "Y26" had filed Y39 (once Y260)
  // under Old code, "R25" R54 (once R250). They get their own group, or, after an exact match, their families.
  if (best.length) for (const i of wasPre) (by[COLORS[i].fam] = by[COLORS[i].fam] || []).push(i);
  if (best.length)
    out.push({ f: { name: 'Best match', repHex: COLORS[best[0]].hex }, list: best.sort(famOrd) });
  if (pre.length)
    out.push({
      f: { name: 'Codes starting ' + p.toUpperCase(), repHex: COLORS[pre[0]].hex },
      list: pre.sort(famOrd),
    });
  if (was.length) out.push({ f: { name: 'Old code', repHex: COLORS[was[0]].hex }, list: was.sort(famOrd) });
  if (wasPre.length && !best.length)
    out.push({
      f: { name: 'Old codes starting ' + p.toUpperCase(), repHex: COLORS[wasPre[0]].hex },
      list: wasPre.sort(famOrd),
    });
  for (const f of families) if (by[f.name]) out.push({ f: f, list: by[f.name].sort(famOrd) });
  return out;
}
// (v308) Markers › Owned › "Running low · 3": only the markers you marked running low or dry (for this visit)
let lowOnly = false;
function lowCount() {
  let n = 0,
    dry = 0;
  for (let i = 0; i < COLORS.length; i++) {
    const v = state.ink[mkey(i)];
    if (!v || !isOwned(i)) continue;
    n++;
    if (v === 'dry') dry++;
  }
  return { n: n, dry: dry };
}
// fams (v308.3): a Set of family names, in place of the search: those families' markers in the view, as filtered
// (v318.26) only: a Set of the markers to look at (the skin tones' search), with the filters, not the search
function finderMatches(fams, only) {
  const view = state.mode === 'collection' ? state.collView : state.finderScope === 'owned' ? 'owned' : 'all';
  const out = [],
    low = view === 'owned' && state.mode === 'collection' && lowOnly;
  for (let i = 0; i < COLORS.length; i++) {
    if (only ? !(only.has(i) && passes(i)) : fams ? !(passes(i) && fams.has(COLORS[i].fam)) : !avail(i))
      continue;
    if (view === 'owned' && !isOwned(i)) continue;
    if (low && !state.ink[mkey(i)]) continue;
    if (view === 'unowned' && isOwned(i)) continue;
    if (view === 'wish' && !isWished(mkey(i))) continue;
    out.push(i);
  }
  return out;
}
// whether the grid's cells carry their brand letter: when what's shown or your collection mixes brands (renderResults)
let cellBt = true;
function cellHtml(i, rank) {
  const c = COLORS[i];
  const col = state.mode === 'collection';
  const own = isOwned(i);
  // (v318.21: your older cap's code and name, "now R213"; else the old code, as before)
  const cc = capCode(i),
    cn = capName(i),
    old = capIsOld(i) ? ' · ' + capNow(i) : c.old && c.old !== c.code ? ' · old ' + oldCode(c) : '',
    // (v318.26) found by its older cap's name (sByCap): that cap named, as the cell shows only today's code
    byCap =
      !capIsOld(i) && searchStr && sByCap(i, searchStr)
        ? ', older cap ' + oldCode(c) + ' ' + capOldName(c)
        : '';
  const rk = rank ? '<span class="rankb">' + rank + '</span>' : '';
  // (v323) Markers' tiles as swatches (sw2, 02-picker.css): the ink to the tile's edge, a second coat on the right
  // (coatTwo, as shading's 2nd coat), the code on the ink in dark or white by contrast (txt), with a halo where neither
  // reads well (txtWeak); a near-white blender keeps an edge (swpale)
  const sw =
    col &&
    ' sw2' +
      (darkText(c.hex) ? ' swd' : '') +
      (txtWeak(c.hex) ? ' swweak' : '') +
      (relLum(c.hex) > 0.86 ? ' swpale' : '');
  const cls =
    'cell' +
    (col && !own && state.collView !== 'unowned' ? ' notown' : '') +
    (col && own ? ' own' : '') +
    (sw || '');
  // (the tick shows ownership where owned and not owned are mixed: All. In Owned every marker is yours, v305)
  const check = col && own && state.collView !== 'owned' ? '<span class="owncheck">\u2713</span>' : '';
  const act = col ? (own ? 'remove' : 'add') : 'copy';
  return (
    '<div class="' +
    cls +
    '" data-i="' +
    i +
    '" role="button" tabindex="0" aria-label="' +
    esc(
      c.brand +
        ' ' +
        cc +
        ' ' +
        cn +
        byCap +
        (col ? (own ? ', owned. Activate to untick' : ', not owned. Activate to tick') : ''),
    ) +
    '" aria-description="Shift+F10 for details" title="' +
    esc(c.brand + ' ' + cc + ' · ' + cn + old + byCap) +
    ' · tap to ' +
    act +
    '">' +
    check +
    rk +
    inkBadge(i) +
    btHTML(c.brand, cellBt) +
    '<div class="sq" style="background:' +
    c.hex +
    (sw ? ';--c2:rgb(' + coatTwo(rgb(c.hex)).join(',') + ')' : '') +
    '"></div><div class="cc">' +
    esc(cc) +
    '</div></div>'
  );
}
// Markers: how ticking works, above the grid. In full the first time on this device (for the rest of that visit), then
// as a one-line ⓘ that opens in place, like the guide's hints (hintSeen, markHint and infoLineHTML in core.js).
// With a mouse (a fine pointer) it says right-click rather than press and hold; once a keyboard is used (Tab or the
// arrow keys), it also names Shift+F10, the keyboard's way to the details.
const MK_HINT = 'mk-tick';
let _mkHintOpen = null,
  _mkKeys = false;
function mkHintRender() {
  const el = $('mkHint');
  if (!el) return;
  const on = state.mode === 'collection';
  el.style.display = on ? '' : 'none';
  if (!on) return;
  if (_mkHintOpen === null) {
    _mkHintOpen = !hintSeen(MK_HINT);
    if (_mkHintOpen) markHint(MK_HINT);
  }
  let fine = false;
  try {
    fine = !!(window.matchMedia && matchMedia('(pointer: fine)').matches);
  } catch (_) {}
  const open = _mkHintOpen,
    kb = _mkKeys ? ' or press Shift+F10' : '',
    long =
      'Tap a marker to tick or untick it. ' +
      (fine
        ? 'Right-click' + kb + ' for details.'
        : 'Press and hold (or right-click' + kb + ') for details.'),
    short =
      'Tap to tick \u00b7 ' +
      (fine ? 'right-click' : 'press and hold') +
      (_mkKeys ? ' or Shift+F10' : '') +
      ' for details';
  el.innerHTML = infoLineHTML(open, short, long);
}
document.addEventListener(
  'keydown',
  function (e) {
    if (_mkKeys || !/^(Tab|Arrow)/.test(e.key)) return;
    _mkKeys = true;
    if (state.mode === 'collection') mkHintRender();
  },
  true,
);
{
  const _mh = $('mkHint');
  if (_mh)
    _mh.addEventListener('click', function (e) {
      if (!e.target.closest('.sfinfo')) return;
      const had = _mh.contains(document.activeElement);
      _mkHintOpen = !_mkHintOpen;
      mkHintRender();
      const b = _mh.querySelector('.sfinfo');
      if (had && b) b.focus({ preventScroll: true });
    });
}
// the grid's heading: "Matches (12 markers)" while a search or filter narrows it, otherwise "Showing 120 markers"
function matchHead(n, unit) {
  const f = !!searchStr || ['brand', 'tone', 'sat', 'fam'].some((g) => !fgIsAll(g)),
    w = n + ' ' + unit + (n === 1 ? '' : 's'),
    l = $('matchLbl');
  if (l) l.textContent = f ? 'Matches' : 'Showing ' + w;
  matchn.textContent = f ? '(' + w + ')' : '';
}
// Markers' search looks in the view you're on (Owned, Unowned). When it also matches markers outside that view, a
// line under the results says how many, with Show to switch to All (the search stays); when the view has none of
// them, the empty state says so instead of "No markers match"
function searchOutside() {
  if (
    state.mode !== 'collection' ||
    !searchStr ||
    (state.collView !== 'owned' && state.collView !== 'unowned')
  )
    return [];
  const own = state.collView === 'owned',
    out = [],
    // (v318.28) "skin" counts the skin tones searchSkin shows, not names with the word: Owned's "Skin tones (12)" had
    // no "60 more in All", and with none of them yours it said "No markers match" though All has 72
    sk =
      typeof skinIdx === 'function' && SKIN_Q.test(sQueryOf(searchStr).words.join(' '))
        ? new Set(skinIdx())
        : null;
  for (let i = 0; i < COLORS.length; i++)
    if ((sk ? sk.has(i) && passes(i) : avail(i)) && isOwned(i) !== own) out.push(i);
  return out;
}
function moreInAllHTML(n, none) {
  return (
    '<div class="moreall">' +
    n +
    (none ? '' : ' more') +
    ' in All \u00b7 <button type="button" class="moreshow" aria-label="Show ' +
    (n === 1 ? 'it' : 'them') +
    ' in All">Show</button></div>'
  );
}
// the empty state when only other views have the search's markers: "R22 isn't in your collection"
function searchElsewhereHTML(more) {
  // a search for a code ("r22") names it, even when it also finds longer ones (R220); else the search as typed
  const typed = (searchInput.value || '').trim(),
    q = '\u201c' + esc(typed) + '\u201d',
    // (its own code before a marker that once had that code: "g410" is G410, not G24, whose old code it was, v304)
    cur = more.find((i) => sExact(i) === 2),
    exact = cur != null ? cur : more.find((i) => sExact(i) === 1),
    one = exact != null ? esc(COLORS[exact].code) : more.length === 1 ? esc(COLORS[more[0]].code) : '';
  return (
    '<div class="empty">' +
    (state.collView === 'owned'
      ? one
        ? one + ' isn\u2019t in your collection.'
        : 'None of the markers matching ' + q + ' are in your collection.'
      : one
        ? one + ' is already in your collection.'
        : 'Every marker matching ' + q + ' is already in your collection.') +
    '</div>' +
    moreInAllHTML(more.length, true)
  );
}
// (v307) a search for a hex code ("#ff0000", "ff0000", "f00") that finds no marker offers to match the colour
// instead of "No markers match": '#rrggbb', or null for any other search. `q`: the search (the box's, if not given)
function searchHex(q) {
  const r = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(q == null ? searchInput.value || '' : q).trim());
  if (!r) return null;
  const h = r[1].toLowerCase();
  return '#' + (h.length === 3 ? h[0] + h[0] + h[1] + h[1] + h[2] + h[2] : h);
}
function searchHexHTML(hex) {
  return (
    '<div class="empty">\u201c' +
    esc((searchInput.value || '').trim()) +
    '\u201d looks like a colour, not a marker code.</div><div class="moreall"><span class="hexdot" style="background:' +
    hex +
    '" aria-hidden="true"></span><button type="button" class="moreshow mkhexgo" data-hex="' +
    hex +
    '">Match this colour</button></div>'
  );
}
// (v308) a search that is a list of codes ("b02, b03"): search finds one marker at a time, so Scan or type codes, which
// takes a list, is offered
function searchList(q) {
  const t = String(q == null ? searchInput.value || '' : q)
    .toUpperCase()
    .split(/[\s,;/+&]+/)
    .filter(Boolean);
  if (t.length < 2 || typeof scanIsCode !== 'function') return false;
  return (
    t.filter(function (x) {
      return scanIsCode(x.replace(/-/g, ''));
    }).length >= 2
  );
}
function searchListHTML() {
  return (
    '<div class="empty">\u201c' +
    esc((searchInput.value || '').trim()) +
    '\u201d looks like a list of codes. Search finds one marker at a time; Scan or type codes takes a whole list.</div><div class="moreall"><button type="button" class="moreshow mkscanlist">Scan or type codes</button></div>'
  );
}
// (v308.3) Markers' search and the colour families. A search whose every word is one of a family's words ("skin",
// "yellow grey", "red") names that family (sFold's spellings: "grey" is Gray's). Families are never searched as names
// are ("red" would bring 191 markers, not 17), so: when the search finds no marker by name or code, the families it
// names are shown, with a line saying so; when it does find some, one line offers those families (their filter on, the
// search cleared). Counts are of the view and filters, as the results are. Not when the search is a list of codes
// (the Scan hint wins), nor outside Markers.
function searchFams() {
  if (state.mode !== 'collection' || !searchStr || searchList()) return null;
  const ws = sQueryOf(searchStr).words;
  if (!ws.length) return null;
  let names = families
    .map((f) => f.name)
    .filter((n) => {
      const fw = sFold(n).split(/[^a-z0-9]+/);
      return ws.every((w) => fw.indexOf(w) >= 0);
    });
  // (a search that is a family's whole name, "red" or "blue", names that family only: not Red-Violet and Yellow-Red /
  // Orange, nor Blue-Green, Blue-Violet and Blue Grey too)
  const whole = names.filter(
    (n) =>
      sFold(n)
        .split(/[^a-z0-9]+/)
        .filter(Boolean)
        .join(' ') === ws.join(' '),
  );
  if (whole.length) names = whole;
  if (!names.length) return null;
  const list = finderMatches(new Set(names));
  if (!list.length) return null;
  // (only the families with markers here are named)
  const shown = names.filter((n) => list.some((i) => COLORS[i].fam === n));
  return { names: shown, list: list };
}
// (v318.26) Markers' search "skin", "skin tone(s)" or "skintone(s)": the skin tones (skinIdx, events.js: Ohuhu's 36 Skin
// Tones set and Copic's picks), lightest first, within the view and filters, with a line naming the Earth / Skin /
// Brown family as a link to its filter (it had shown only that family, and "skin tones" nothing: every word must be a
// family's). null for any other search, or none of them here.
const SKIN_Q = /^skin(\s?tones?)?$/;
function searchSkin() {
  if (state.mode !== 'collection' || !searchStr || typeof skinIdx !== 'function') return null;
  if (!SKIN_Q.test(sQueryOf(searchStr).words.join(' '))) return null;
  const sk = skinIdx(),
    at = new Map(
      sk.map(function (i, n) {
        return [i, n];
      }),
    ),
    list = finderMatches(null, new Set(sk)).sort(function (a, b) {
      return at.get(a) - at.get(b);
    });
  if (!list.length) return null;
  const fam = 'Earth / Skin / Brown';
  return { list: list, fam: { names: [fam], list: finderMatches(new Set([fam])) } };
}
function skinLineHTML(sk) {
  return (
    '<div class="famline">Skin tones (' +
    sk.list.length +
    ')' +
    (sk.fam.list.length
      ? ' \u00b7 <button type="button" class="moreshow mkfamgo" data-fams="' +
        esc(sk.fam.names[0]) +
        '">' +
        famPhrase(sk.fam) +
        ' \u203a</button>'
      : '') +
    '</div>'
  );
}
// "the Earth / Skin / Brown family (94)", "the Red, Red-Violet and Yellow-Red / Orange families (191)"; more than three
// named briefly: "the Blue Grey, Cool Grey and 5 other families (87)"
function famPhrase(sf) {
  const ns = sf.names.map(esc),
    n = ns.length,
    named =
      n === 1
        ? ns[0] + ' family'
        : n <= 3
          ? ns.slice(0, -1).join(', ') + ' and ' + ns[n - 1] + ' families'
          : ns.slice(0, 2).join(', ') + ' and ' + (n - 2) + ' other families';
  return 'the ' + named + ' (' + sf.list.length + ')';
}
function famFallbackHTML(sf) {
  return (
    '<div class="famline">No names match \u201c' +
    esc((searchInput.value || '').trim()) +
    '\u201d \u00b7 showing ' +
    famPhrase(sf) +
    '</div>'
  );
}
function famOfferHTML(sf) {
  return (
    '<div class="famline">Also: <button type="button" class="moreshow mkfamgo" data-fams="' +
    esc(sf.names.join('|')) +
    '">' +
    famPhrase(sf) +
    ' \u203a</button></div>'
  );
}
// the line above the grid, from renderGrid: the fallback's or the offer's, or ''
let gridFamLine = '';
function renderResults(bySearch) {
  // (an armed Untick all shown counted what was shown then: a redraw disarms it, v304)
  if (ownNoneBtn.dataset.arm === '1') unownDisarm();
  results.classList.toggle('noanim', !!bySearch);
  mkHintRender();
  qClearSync();
  const more = searchOutside();
  gridFamLine = '';
  renderGrid(more);
  if (gridFamLine) results.insertAdjacentHTML('afterbegin', gridFamLine);
  if (more.length && results.firstElementChild && !results.querySelector('.moreall'))
    results.insertAdjacentHTML('beforeend', moreInAllHTML(more.length, !results.querySelector('.cell')));
}
// what the grid shows, in its order: what Tick all shown, Untick all shown, Copy codes and Palette from these act on
// (v304: Ramp gaps shows only some of the matches, and Tick all shown had ticked all of them). To buy has no grid.
let gridShown = [];
function shownMatches() {
  return state.mode === 'collection' && state.collView === 'wish' ? finderMatches() : gridShown.slice();
}
function gridActs(list) {
  gridShown = list;
  // (v318.28) only with one not yours among them: every one shown yours, its tap had done nothing, without a word
  ownAllBtn.disabled = !list.some((i) => !isOwned(i));
  // (v318.25) only with one of yours among them: in All, or a search of none of yours, it had armed "Untick 5
  // markers?" and its second tap did nothing
  ownNoneBtn.disabled = !list.some((i) => isOwned(i));
  // (a palette needs a colour: not only the Colorless Blender, v304)
  toPalette.disabled = !list.some((i) => !NOINK.has(i));
  $('toRandom').disabled = toPalette.disabled;
}
function renderGrid(more) {
  let m = finderMatches();
  cellBt = brandsMixedIn(m);
  gridActs(m);
  matchHead(m.length, 'marker');
  // (v318.28) the skin tones here first: some of them yours, "None of the markers matching “skin” are in your
  // collection" isn't said over them
  const sk = searchSkin();
  if (!m.length && more.length && state.owned.size && !sk) {
    results.innerHTML = searchElsewhereHTML(more);
    return;
  }
  if (!m.length && searchHex()) {
    results.innerHTML = searchHexHTML(searchHex());
    return;
  }
  if (!m.length && searchList()) {
    results.innerHTML = searchListHTML();
    return;
  }
  // (v308.3) the families the search names: shown when nothing else is, else offered in a line
  // (v318.26: "skin" shows the skin tones, with the family as a link)
  const sf = sk ? null : searchFams();
  if (sk) {
    m = sk.list;
    cellBt = brandsMixedIn(m);
    gridActs(m);
    matchHead(m.length, 'marker');
    gridFamLine = skinLineHTML(sk);
  } else if (sf && !m.length) {
    m = sf.list;
    cellBt = brandsMixedIn(m);
    gridActs(m);
    matchHead(m.length, 'marker');
    gridFamLine = famFallbackHTML(sf);
  } else if (sf) gridFamLine = famOfferHTML(sf);
  if (!m.length) {
    // (in Owned only: elsewhere a search that found nothing had said the collection was empty, v304)
    results.innerHTML =
      state.mode === 'collection' && !state.owned.size && state.collView === 'owned'
        ? '<div class="empty">Your collection is empty. Add your markers above, or switch to <b>All</b> to tick single markers.</div>'
        : '<div class="empty">' +
          (searchStr
            ? 'No markers match \u201c' + esc(searchStr) + '\u201d with the current filters.'
            : // (v328 review: every marker owned isn't a filter's doing)
              state.mode === 'collection' &&
                state.collView === 'unowned' &&
                COLORS.every(function (c, i) {
                  return state.owned.has(mkey(i));
                })
              ? 'You own every marker.'
              : 'No markers match these filters.') +
          '</div>';
    return;
  }
  // (v318.26) the skin tones as one group, lightest first, whatever the Order (not split into their families), under
  // their line ("Skin tones (60) · the Earth / Skin / Brown family")
  if (sk) {
    results.innerHTML =
      '<div class="rgroup"><div class="pile">' + m.map((i) => cellHtml(i)).join('') + '</div></div>';
    return;
  }
  if (state.mode === 'collection' && state.collView === 'unowned' && state.gapSort === 'gap') {
    const order = gapRank(m);
    gridActs(order);
    // (v318.25) the heading counts what's shown: it had said "Showing 601 markers" over 295
    matchHead(order.length, 'marker');
    // (v328 review: none of them fills a gap, a brand you don't buy or the Colorless Blender: said, not a blank grid)
    if (!order.length) {
      results.innerHTML =
        '<div class="empty">None of these markers fills a gap in your families. Try another Order.</div>';
      return;
    }
    results.innerHTML =
      '<div class="rgroup"><div class="pile">' +
      order.map((i, idx) => cellHtml(i, idx + 1)).join('') +
      '</div></div>';
    return;
  }
  if (state.mode === 'collection' && state.collView === 'unowned' && state.gapSort === 'complete') {
    let html = '',
      s = 0;
    const gps = completeGroups(m);
    const un = [].concat(...gps.map((g) => g.un));
    gridActs(un);
    cellBt = brandsMixedIn(un);
    // (v318.25) the heading counts what's shown (your brands' families, no fluorescents): it had said 601 over 239
    matchHead(un.length, 'marker');
    if (!gps.length) {
      results.innerHTML =
        '<div class="empty">None of these markers completes a family of a brand you buy. Try another brand in Brands I\u2019d buy, or another Order.</div>';
      return;
    }
    for (const gp of gps) {
      const rep = families.find((f) => f.name === gp.fam);
      html +=
        '<div class="rgroup" style="animation-delay:' +
        s * 45 +
        'ms"><div class="rghead"><span class="rgdot" style="background:' +
        (rep ? rep.repHex : '#888') +
        '"></span>' +
        gp.fam +
        ' <span class="rgn">' +
        gp.owned +
        '/' +
        gp.total +
        '</span></div><div class="pile">' +
        gp.un.map((i) => cellHtml(i)).join('') +
        '</div></div>';
      s++;
    }
    results.innerHTML = html;
    return;
  }
  if (state.mode === 'collection' && state.collView === 'unowned' && state.gapSort === 'ramps') {
    const order = rampRank(m);
    gridActs(order);
    cellBt = brandsMixedIn(order);
    matchHead(order.length, 'ramp gap');
    if (!order.length) {
      results.innerHTML =
        '<div class="empty">No gaps between light and dark here — each family already runs smoothly. Try widening the filters or owning more of a family first.</div>';
      return;
    }
    results.innerHTML =
      '<div class="rgroup"><div class="pile">' +
      order.map((i, idx) => cellHtml(i, idx + 1)).join('') +
      '</div></div>';
    return;
  }
  const groups = searchGroups(m);
  let html = '',
    s = 0;
  gridActs([].concat(...groups.map((g) => g.list)));
  for (const g of groups) {
    const f = g.f,
      list = g.list;
    html +=
      '<div class="rgroup" style="animation-delay:' +
      s * 45 +
      'ms"><div class="rghead"><span class="rgdot" style="background:' +
      f.repHex +
      '"></span>' +
      f.name +
      ' <span class="rgn">' +
      list.length +
      '</span></div><div class="pile">' +
      list.map((i) => cellHtml(i)).join('') +
      '</div></div>';
    s++;
  }
  results.innerHTML = html;
}
// the search's ✕: shown while there's text; clears it and keeps the keyboard in the field
const qClear = document.createElement('button');
qClear.type = 'button';
qClear.id = 'qClear';
qClear.className = 'qclear';
qClear.setAttribute('aria-label', 'Clear search');
qClear.innerHTML = ic('x');
searchInput.insertAdjacentElement('afterend', qClear);
function qClearSync() {
  qClear.style.display = searchInput.value ? '' : 'none';
}
qClearSync();
searchInput.addEventListener('input', qClearSync);
qClear.addEventListener('click', () => {
  searchInput.value = '';
  searchInput.dispatchEvent(new Event('input', { bubbles: true }));
  searchInput.focus();
});
results.addEventListener('click', (e) => {
  const hx = e.target.closest('.mkhexgo');
  if (hx) {
    if (window.msMatchHex) window.msMatchHex(hx.dataset.hex);
    return;
  }
  // (v308.3) "Also: the … family": its filter on, as its chip would, and the search cleared
  const fg = e.target.closest('.mkfamgo');
  if (fg) {
    // (v318.22 debug: that family only, as the line says: a family filter on before stayed on beside it)
    const ns = fg.dataset.fams.split('|').filter((n) => families.some((f) => f.name === n));
    if (ns.length) FG.fam.set(new Set(ns));
    searchInput.value = '';
    searchStr = '';
    filterChanged();
    if (typeof filterBar !== 'undefined' && filterBar && filterBar.offsetParent)
      filterBar.focus({ preventScroll: true });
    return;
  }
  // (v308: the list searched for, read by Scan or type codes, where each is added or asked about)
  if (e.target.closest('.mkscanlist')) {
    const q = (searchInput.value || '').trim();
    if (typeof openScan !== 'function') return;
    openScan();
    // (read as a pasted list is, a line each: the box is one line)
    if (q && typeof scanHandle === 'function') {
      scanHandle(q.replace(/[,;/+&]+\s*/g, '\n'), true);
      if (typeof scanRender === 'function') scanRender();
    }
    return;
  }
  if (!e.target.closest('.moreshow')) return;
  state.collView = 'all';
  save();
  fullRender();
  const a = ownView.querySelector('[data-v="all"]');
  if (a) a.focus({ preventScroll: true });
});
// (v311) Add markers, at the top: the ways to add in a sheet (the welcome's card: boot.js openAddMarkers). With no
// markers yet they're in a card at the top instead (chrome.js), so it shows only with a collection. And a way down
// to Brands I'd buy and Print a swatch chart, below the grid (as v300's link to the sets and the chart, which the
// sheet has now taken the sets from).
// (v318.33) both in the tools row with Random and Match a colour, as matching buttons (Fable V1-1: five idioms
// stacked before the first swatch; an underlined link, a 40px gap and Filters after a bordered button)
const mkDraw = $('mkDraw');
const mkAddBtn = document.createElement('button');
mkAddBtn.type = 'button';
mkAddBtn.id = 'mkAddBtn';
mkAddBtn.className = 'mkaddbtn';
mkAddBtn.innerHTML = ic('plus') + 'Add markers';
mkAddBtn.style.display = 'none';
if (mkDraw) mkDraw.appendChild(mkAddBtn);
else ownHint.insertAdjacentElement('afterend', mkAddBtn);
mkAddBtn.addEventListener('click', function () {
  addWay('add', mkAddBtn);
});
// (the same ways in the card at the top while there are no markers: a set or Find opens the sheet at that step)
{
  const aw = $('mkAddWays');
  if (aw)
    aw.addEventListener('click', function (e) {
      const b = e.target.closest('[data-add]');
      if (b) addWay(b.dataset.add, b);
    });
}
const mkJump = document.createElement('button');
mkJump.type = 'button';
mkJump.id = 'mkJump';
mkJump.className = 'mkjump';
mkJump.style.display = 'none';
mkJump.innerHTML = ic('printer') + 'Swatch chart';
mkAddBtn.insertAdjacentElement('afterend', mkJump);
function mkJumpSync(col) {
  // (not in To buy: Print a swatch chart is just under it there, v300)
  col = col && state.collView !== 'wish';
  mkJump.style.display = col ? '' : 'none';
  mkAddBtn.style.display = col && state.owned.size ? '' : 'none';
}
mkJump.addEventListener('click', () => {
  const pw = $('presetWrap'),
    bottom = pw && pw.classList.contains('bottom') && pw.style.display !== 'none',
    to = bottom ? pw : $('backupWrap');
  if (!to) return;
  to.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
  const f = $('swatchBtn');
  if (f) f.focus({ preventScroll: true });
});
let copyT = null;
function flashCopy(msg) {
  copyBtn.textContent = msg;
  clearTimeout(copyT);
  copyT = setTimeout(() => {
    copyBtn.textContent = 'Copy codes';
  }, 1400);
}
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {}
  // (v318.25: focus goes back where it was, for the keyboard and VoiceOver; read-only at 16 px, so iOS neither zooms
  // nor brings up its keyboard)
  const was = document.activeElement;
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.readOnly = true;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    ta.style.fontSize = 'max(16px, var(--t-lg))';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch (e) {
    return false;
  } finally {
    if (was && was !== document.body && was.isConnected && document.activeElement !== was)
      try {
        was.focus({ preventScroll: true });
      } catch (_) {}
  }
}
