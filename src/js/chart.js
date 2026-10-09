/* ---- Tick colours on a chart (v309) ----
   For markers bought one at a time: a brand's markers as big swatches, one colour family at a time (chips across the
   top), tapped to tick or untick. Ticked from the start: the markers you have. Nothing changes until the button at the
   foot (Add 12 markers, Remove 2, or Save: +12 −2), with Undo on its toast. Opened from the welcome's "I bought them
   one by one" (on top of it, which then goes on: openChart's added) and from Markers, beside Scan or type codes. A
   marker ticked here is added by hand, as a tick in Markers: off To buy, and its Running low or Dry mark goes. */
const CHART_SHORT = {
  'Yellow-Red / Orange': 'Orange',
  'Earth / Skin / Brown': 'Earth & skin',
  'Neutral / Black': 'Neutral & black',
};
let chartBrand = 'Ohuhu',
  chartFam = '',
  chartOn = new Set(),
  chartAfter = null,
  chartUndone = null,
  chartOpener = null;
// the families with markers of the brand, in Markers' order, each with its markers (light to dark) and a dot: its
// most colourful marker of middle lightness (a grey family's middle one)
// (v309.1: grey is the brand's own markers' mean chroma, and lightness counts twice: Copic's Cool Grey, which f.neutral
// doesn't count as grey with both brands' in it, had a white dot, and Copic's Green a cream one, as a pale tint is
// "saturated" in HSL)
function chartFams(brand) {
  return families
    .map(function (f) {
      const idxs = f.idxs.filter((i) => COLORS[i].brand === brand).sort((a, b) => HS[b].l - HS[a].l);
      if (!idxs.length) return null;
      const grey = idxs.reduce((s, i) => s + LCH[i][1], 0) / idxs.length < GREY_C;
      let dot = idxs[Math.floor(idxs.length / 2)],
        best = -Infinity;
      idxs.forEach(function (i) {
        const sc = HS[i].s - 2 * Math.abs(HS[i].l - 0.55);
        if (!grey && sc > best) {
          best = sc;
          dot = i;
        }
      });
      return { name: f.name, idxs: idxs, dot: COLORS[dot].hex };
    })
    .filter(Boolean);
}
function chartChanges() {
  const add = [],
    del = [];
  chartOn.forEach((k) => {
    if (!state.owned.has(k)) add.push(k);
  });
  state.owned.forEach((k) => {
    if (!chartOn.has(k)) del.push(k);
  });
  return { add: add, del: del };
}
function chartRender() {
  const fams = chartFams(chartBrand);
  if (!fams.some((f) => f.name === chartFam)) chartFam = fams.length ? fams[0].name : '';
  const brands = [...new Set(COLORS.map((c) => c.brand))];
  $('chBrand').innerHTML = brands
    .map(
      (b) =>
        '<button type="button" data-b="' +
        esc(b) +
        '" aria-pressed="' +
        (b === chartBrand) +
        '">' +
        esc(b) +
        '</button>',
    )
    .join('');
  $('chFams').innerHTML = fams
    .map(function (f) {
      const n = f.idxs.filter((i) => chartOn.has(mkey(i))).length;
      return (
        '<button type="button" class="chfam" data-f="' +
        esc(f.name) +
        '" aria-pressed="' +
        (f.name === chartFam) +
        '"' +
        (CHART_SHORT[f.name] ? ' title="' + esc(f.name) + '"' : '') +
        '><i style="background:' +
        f.dot +
        '"></i>' +
        esc(CHART_SHORT[f.name] || f.name) +
        (n ? '<span class="chn">' + n + '</span>' : '') +
        '</button>'
      );
    })
    .join('');
  const f = fams.find((x) => x.name === chartFam);
  chartGrid(f);
  chartFoot();
}
function chartGrid(f) {
  const g = $('chGrid');
  if (!f) {
    g.innerHTML = '';
    $('chFamLbl').textContent = '';
    return;
  }
  g.innerHTML = f.idxs
    .map(function (i) {
      const c = COLORS[i],
        on = chartOn.has(mkey(i));
      return (
        '<button type="button" class="chsw" data-i="' +
        i +
        '" aria-pressed="' +
        on +
        '" aria-label="' +
        esc(c.code + ' ' + c.name) +
        '"><i style="background:' +
        c.hex +
        '"></i><span>' +
        esc(c.code) +
        '</span></button>'
      );
    })
    .join('');
  chartFamLabel(f);
}
// (v309.1) the chosen family's chip in view, clear of the row's faded edges: the row kept where it was scrolled to,
// so after a brand switch, or opening again, the chosen chip (the first) could be off to the left
function chartChipInView() {
  const row = $('chFams'),
    c = row && row.querySelector('[aria-pressed="true"]');
  if (!c) return;
  const r = row.getBoundingClientRect(),
    b = c.getBoundingClientRect(),
    pad = 24;
  if (b.left < r.left + pad) row.scrollLeft -= r.left + pad - b.left;
  else if (b.right > r.right - pad) row.scrollLeft += b.right - (r.right - pad);
}
function chartFamLabel(f) {
  const n = f.idxs.filter((i) => chartOn.has(mkey(i))).length;
  $('chFamLbl').textContent = f.name + ' · ' + n + ' of ' + f.idxs.length + ' ticked';
}
function chartFoot() {
  const ch = chartChanges(),
    b = $('chSave');
  $('chSum').innerHTML = '<b>' + chartOn.size + '</b> ticked in all';
  b.disabled = !ch.add.length && !ch.del.length;
  b.textContent =
    ch.add.length && ch.del.length
      ? 'Save: +' + ch.add.length + ' −' + ch.del.length
      : ch.del.length
        ? 'Remove ' + ch.del.length
        : ch.add.length
          ? 'Add ' + ch.add.length + ' marker' + (ch.add.length === 1 ? '' : 's')
          : 'Tick your colours';
}
// opts: { added(n) } from the welcome: called after a save that added markers
function openChart(opts) {
  const ov = $('chartOverlay');
  if (!ov) return;
  const o = opts && !opts.type ? opts : {};
  chartAfter = o.added || null;
  chartUndone = o.undone || null;
  chartOpener = document.activeElement;
  chartOn = new Set(state.owned);
  // the brand of most of your markers (Ohuhu with none)
  const n = {};
  state.owned.forEach((k) => {
    const b = k.split('|')[0];
    n[b] = (n[b] || 0) + 1;
  });
  const bs = Object.keys(n).sort((a, b) => n[b] - n[a]);
  chartBrand = bs[0] || 'Ohuhu';
  chartFam = '';
  chartRender();
  openDialog(ov);
  $('chGrid').scrollTop = 0;
  chartChipInView();
  const first = ov.querySelector('#chFams [aria-pressed="true"]');
  if (first) first.focus({ preventScroll: true });
}
function closeChart() {
  const ov = $('chartOverlay');
  if (!ov || !ov.classList.contains('on')) return;
  closeDialog(ov);
  chartAfter = null;
  chartUndone = null;
  if (chartOpener && chartOpener.isConnected) chartOpener.focus({ preventScroll: true });
  chartOpener = null;
}
function chartSave() {
  const ch = chartChanges(),
    after = chartAfter,
    undone = chartUndone,
    opener = chartOpener;
  if (!ch.add.length && !ch.del.length) return;
  ch.add.forEach((k) => state.owned.add(k));
  ch.del.forEach((k) => state.owned.delete(k));
  const ink = inkAddedOff(ch.add),
    off = wishOwnedOff(ch.add);
  const undo = function () {
    ch.add.forEach((k) => state.owned.delete(k));
    ch.del.forEach((k) => state.owned.add(k));
    inkPutBack(ink);
    wishPutBack(off);
  };
  if (!keep(undo)) return;
  fullRender();
  if (typeof presetRelist === 'function') presetRelist();
  if (off.length || Object.keys(ink).length) wishChanged();
  closeChart();
  const said =
    ch.add.length && ch.del.length
      ? 'Added ' + ch.add.length + ', removed ' + ch.del.length
      : ch.del.length
        ? 'Removed ' + ch.del.length + ' marker' + (ch.del.length === 1 ? '' : 's')
        : addedManyLine(ch.add.length, off.length);
  toastAction(said, 'Undo', function () {
    undo();
    save();
    fullRender();
    if (typeof presetRelist === 'function') presetRelist();
    if (off.length || Object.keys(ink).length) wishChanged();
    // (the toast's button goes: the keyboard back on what opened the chart, as after the save)
    if (opener && opener.isConnected && opener.offsetParent) opener.focus({ preventScroll: true });
    if (undone) undone();
  });
  // (v309.1: removals said too, not as "added")
  if (after) after(ch.add.length, ch.del.length);
}
(function () {
  const ov = $('chartOverlay'),
    go = $('chartOpen');
  if (!ov) return;
  if (go) go.addEventListener('click', openChart);
  $('chClose').addEventListener('click', closeChart);
  $('chSave').addEventListener('click', chartSave);
  ov.addEventListener('click', function (e) {
    if (e.target === ov) return closeChart();
    const t = e.target.closest ? e.target : null;
    if (!t) return;
    const sw = t.closest('.chsw');
    if (sw) {
      const k = mkey(+sw.dataset.i),
        on = !chartOn.has(k);
      if (on) chartOn.add(k);
      else chartOn.delete(k);
      // (just this swatch and the counts: the grid never shifts under the finger)
      sw.setAttribute('aria-pressed', String(on));
      const f = chartFams(chartBrand).find((x) => x.name === chartFam);
      if (f) chartFamLabel(f);
      const chip = $('chFams').querySelector('[aria-pressed="true"]');
      if (chip && f) {
        const n = f.idxs.filter((i) => chartOn.has(mkey(i))).length;
        let s = chip.querySelector('.chn');
        if (!n && s) s.remove();
        else if (n) {
          if (!s) {
            s = document.createElement('span');
            s.className = 'chn';
            chip.appendChild(s);
          }
          s.textContent = n;
        }
      }
      chartFoot();
      return;
    }
    const fb = t.closest('.chfam');
    if (fb) {
      chartFam = fb.dataset.f;
      chartRender();
      const again = $('chFams').querySelector('[data-f="' + CSS.escape(chartFam) + '"]');
      if (again) again.focus({ preventScroll: true });
      $('chGrid').scrollTop = 0;
      chartChipInView();
      return;
    }
    const bb = t.closest('#chBrand button');
    if (bb) {
      chartBrand = bb.dataset.b;
      chartFam = '';
      chartRender();
      const again = $('chBrand').querySelector('[data-b="' + CSS.escape(chartBrand) + '"]');
      if (again) again.focus({ preventScroll: true });
      $('chGrid').scrollTop = 0;
      chartChipInView();
    }
  });
})();
