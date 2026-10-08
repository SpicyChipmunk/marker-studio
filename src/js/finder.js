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
        : COLORS[idx].brand + ' ' + COLORS[idx].code + ' ' + COLORS[idx].name + ', change',
    );
    if (idx == null) {
      b.classList.add('empty');
      b.style.background = '';
      cd.textContent = '+';
      cd.style.color = 'var(--sub)';
      b.title = 'Tap to choose a marker';
    } else {
      const c = COLORS[idx],
        own = customOk(idx),
        why = own
          ? ''
          : isOwned(idx) && isDry(idx)
            ? 'marked dry'
            : state.pool
              ? 'not in the selection'
              : 'no longer in your collection';
      b.classList.remove('empty');
      b.classList.toggle('unowned', !own);
      b.style.background = c.hex;
      cd.textContent = c.code;
      cd.style.color = txt(c.hex);
      b.title = c.brand + ' ' + c.code + ' · ' + c.name + (own ? '' : ' · ' + why) + ' · tap to change';
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

// a family's markers in order: by brand as the data has them (its first marker's place), then by code as the data
// lists them (by the code's text: YR015 before YR03, as printed on the sets' charts)
let _brandAt = null;
function famOrd(a, b) {
  if (!_brandAt) {
    _brandAt = {};
    COLORS.forEach((c, i) => {
      if (_brandAt[c.brand] == null) _brandAt[c.brand] = i;
    });
  }
  const A = COLORS[a],
    B = COLORS[b];
  return _brandAt[A.brand] - _brandAt[B.brand] || (A.code < B.code ? -1 : A.code > B.code ? 1 : a - b);
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
function finderMatches(fams) {
  const view = state.mode === 'collection' ? state.collView : state.finderScope === 'owned' ? 'owned' : 'all';
  const out = [],
    low = view === 'owned' && state.mode === 'collection' && lowOnly;
  for (let i = 0; i < COLORS.length; i++) {
    if (fams ? !(passes(i) && fams.has(COLORS[i].fam)) : !avail(i)) continue;
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
  const old = c.old && c.old !== c.code ? ' · old ' + oldCode(c) : '';
  const rk = rank ? '<span class="rankb">' + rank + '</span>' : '';
  const cls =
    'cell' + (col && !own && state.collView !== 'unowned' ? ' notown' : '') + (col && own ? ' own' : '');
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
        c.code +
        ' ' +
        c.name +
        (col ? (own ? ', owned. Activate to untick' : ', not owned. Activate to tick') : ''),
    ) +
    '" aria-description="Shift+F10 for details" title="' +
    c.brand +
    ' ' +
    c.code +
    ' · ' +
    c.name +
    old +
    ' · tap to ' +
    act +
    '">' +
    check +
    rk +
    inkBadge(i) +
    btHTML(c.brand, cellBt) +
    '<div class="sq" style="background:' +
    c.hex +
    '"></div><div class="cc">' +
    c.code +
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
    out = [];
  for (let i = 0; i < COLORS.length; i++) if (avail(i) && isOwned(i) !== own) out.push(i);
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
  ownAllBtn.disabled = !list.length;
  ownNoneBtn.disabled = !list.length;
  // (a palette needs a colour: not only the Colorless Blender, v304)
  toPalette.disabled = !list.some((i) => !NOINK.has(i));
}
function renderGrid(more) {
  let m = finderMatches();
  cellBt = brandsMixedIn(m);
  gridActs(m);
  matchHead(m.length, 'marker');
  if (!m.length && more.length && state.owned.size) {
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
  const sf = searchFams();
  if (sf && !m.length) {
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
        ? '<div class="empty">Your collection is empty. Tick the sets you own under <b>Add a set you own</b>, or switch to <b>All</b> to add single markers.</div>'
        : '<div class="empty">' +
          (searchStr
            ? 'No markers match \u201c' + esc(searchStr) + '\u201d with the current filters.'
            : 'No markers match these filters.') +
          '</div>';
    return;
  }
  if (state.mode === 'collection' && state.collView === 'unowned' && state.gapSort === 'gap') {
    const order = gapRank(m);
    gridActs(order);
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
    gridActs([].concat(...gps.map((g) => g.un)));
    cellBt = brandsMixedIn([].concat(...gps.map((g) => g.un)));
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
    fg.dataset.fams.split('|').forEach((n) => {
      if (families.some((f) => f.name === n) && !fgSel('fam', n)) fgTap('fam', n);
    });
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
// Markers' tools (Add a set you own, Back up & restore, Print a swatch chart) stay under the grid, where Home's backup
// card points; a link near the top goes down to them. It scrolls them into view and leaves the sets list closed (open,
// it is about 1,500px tall and would push the other two out of sight); focus goes to the first of them.
const mkJump = document.createElement('button');
mkJump.type = 'button';
mkJump.id = 'mkJump';
mkJump.className = 'mkjump';
mkJump.style.display = 'none';
ownHint.insertAdjacentElement('afterend', mkJump);
function mkJumpSync(col) {
  // (not in To buy: its sets aren't there, and Print a swatch chart is just under it, v300)
  col = col && state.collView !== 'wish';
  mkJump.style.display = col ? '' : 'none';
  if (!col) return;
  // with an empty collection the sets are at the top already (chrome.js), so the link names the other two
  const t = state.owned.size ? 'Sets & swatch chart' : 'Swatch chart';
  if (mkJump.dataset.t !== t) {
    mkJump.dataset.t = t;
    mkJump.innerHTML = esc(t) + '<span aria-hidden="true">\u2193</span>';
  }
}
mkJump.addEventListener('click', () => {
  const pw = $('presetWrap'),
    bottom = pw && pw.classList.contains('bottom') && pw.style.display !== 'none',
    to = bottom ? pw : $('backupWrap');
  if (!to) return;
  to.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
  const f = bottom ? $('presetHdr') : $('swatchBtn');
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
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch (e) {
    return false;
  }
}
