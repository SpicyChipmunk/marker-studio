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
  return state.pool ? poolSet.has(i) : !state.owned.size || (isOwned(i) && !isDry(i));
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
    b.setAttribute(
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
          '<span class="uwarn" title="' + why.charAt(0).toUpperCase() + why.slice(1) + '">\u26a0</span>',
        );
    }
  });
  const filled = state.customPal.filter((x) => x != null);
  const miss = filled.filter((i) => !customOk(i)).length;
  palReadout(
    'Custom palette',
    filled.length + ' of ' + state.customPal.length + ' chosen' + (miss ? ' · ' + miss + ' not in play' : ''),
    filled,
  );
  setAmb(filled.length ? COLORS[filled[0]].hex : null);
}

function finderMatches() {
  const view = state.mode === 'collection' ? state.collView : state.finderScope === 'owned' ? 'owned' : 'all';
  const out = [];
  for (let i = 0; i < COLORS.length; i++) {
    if (!avail(i)) continue;
    if (view === 'owned' && !isOwned(i)) continue;
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
  const old = c.old && c.old !== c.code ? ' · old ' + c.old : '';
  const rk = rank ? '<span class="rankb">' + rank + '</span>' : '';
  const cls = 'cell' + (col && !own && state.collView !== 'unowned' ? ' notown' : '');
  const check = col && own ? '<span class="owncheck">\u2713</span>' : '';
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
function renderResults() {
  mkHintRender();
  const m = finderMatches();
  cellBt = brandsMixedIn(m);
  ownAllBtn.disabled = !m.length;
  ownNoneBtn.disabled = !m.length;
  matchHead(m.length, 'marker');
  toPalette.disabled = !m.length;
  if (!m.length) {
    results.innerHTML =
      state.mode === 'collection' && !state.owned.size && state.collView !== 'all'
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
    cellBt = brandsMixedIn(order);
    matchHead(order.length, 'ramp gap');
    if (!order.length) {
      results.innerHTML =
        '<div class="empty">No tonal gaps to bridge in this scope — your ramps are already smooth. Try widening the filters or owning more of a family first.</div>';
      return;
    }
    results.innerHTML =
      '<div class="rgroup"><div class="pile">' +
      order.map((i, idx) => cellHtml(i, idx + 1)).join('') +
      '</div></div>';
    return;
  }
  const by = {};
  for (const i of m) (by[COLORS[i].fam] = by[COLORS[i].fam] || []).push(i);
  let html = '',
    s = 0;
  for (const f of families) {
    const list = by[f.name];
    if (!list) continue;
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
