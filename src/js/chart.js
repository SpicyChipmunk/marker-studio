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
  // (v318.22 debug) the markers you had when it opened: what Save changes is reckoned from these
  chartBase = new Set(),
  chartAfter = null,
  chartUndone = null,
  // (v318.26) opened from the welcome: its Undo is a link on "Anything else?" (the after callback's 4th argument), not
  // a toast over the step's choices
  chartWelcome = false,
  chartOpener = null,
  // (v318 review) Some are missing (the welcome, after a set): only the markers you had when it opened, to untick the
  // few lost or used up; null for every colour. Kept as they were, so a swatch unticked stays where it was
  chartOnly = null;
// the families with markers of the brand, in Markers' order, each with its markers (light to dark) and a dot: its
// most colourful marker of middle lightness (a grey family's middle one)
// (v309.1: grey is the brand's own markers' mean chroma, and lightness counts twice: Copic's Cool Grey, which f.neutral
// doesn't count as grey with both brands' in it, had a white dot, and Copic's Green a cream one, as a pale tint is
// "saturated" in HSL)
function chartFams(brand) {
  return families
    .map(function (f) {
      const idxs = f.idxs
        .filter((i) => COLORS[i].brand === brand && (!chartOnly || chartOnly.has(mkey(i))))
        .sort((a, b) => HS[b].l - HS[a].l);
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
// what Save would change: ticked here and not had, unticked here and had, from the markers had when it opened and as
// they are now (v318.22 debug: a marker another tab added while the chart was open was removed by Save, as it wasn't
// ticked here, and "Added 1, removed 1" said for a tick alone)
function chartChanges() {
  const add = [],
    del = [];
  chartOn.forEach((k) => {
    if (!chartBase.has(k) && !state.owned.has(k)) add.push(k);
  });
  chartBase.forEach((k) => {
    if (!chartOn.has(k) && state.owned.has(k)) del.push(k);
  });
  return { add: add, del: del };
}
function chartRender() {
  const fams = chartFams(chartBrand);
  if (!fams.some((f) => f.name === chartFam)) chartFam = fams.length ? fams[0].name : '';
  // (Some are missing: only the brands you have)
  const brands = [...new Set(COLORS.map((c) => c.brand))].filter(
    (b) => !chartOnly || [...chartOnly].some((k) => k.split('|')[0] === b),
  );
  $('chBrand').hidden = brands.length < 2 && !!chartOnly;
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
  // (fourth pass: two swatches of the family showing one code — your new R23, and R38 with an older cap's R23 — the
  // older cap's marked *, as on a swatch chart and in guides)
  const seen = {};
  f.idxs.forEach(function (i) {
    const k = capCodeAny(i);
    seen[k] = (seen[k] || 0) + 1;
  });
  g.innerHTML = f.idxs
    .map(function (i) {
      const c = COLORS[i],
        on = chartOn.has(mkey(i)),
        star = seen[capCodeAny(i)] > 1 && capIsOldAny(i);
      return (
        '<button type="button" class="chsw" data-i="' +
        i +
        '" aria-pressed="' +
        on +
        '" aria-label="' +
        esc(capCodeAny(c) + ' ' + capNameAny(c) + (star ? ', an older cap' : '')) +
        '"><i style="background:' +
        c.hex +
        '"></i><span>' +
        esc(capCodeAny(c) + (star ? '*' : '')) +
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
  // (Some are missing, none unticked: the button closes, all there)
  b.disabled = !ch.add.length && !ch.del.length && !chartOnly;
  b.textContent =
    chartOnly && !ch.add.length && !ch.del.length
      ? 'None are missing'
      : ch.add.length && ch.del.length
        ? 'Save: +' + ch.add.length + ' −' + ch.del.length
        : ch.del.length
          ? 'Remove ' + ch.del.length
          : ch.add.length
            ? 'Add ' + ch.add.length + ' marker' + (ch.add.length === 1 ? '' : 's')
            : 'Tick your colours';
}
// opts: { added(n, del, set, undo), undone, missing, welcome } from the welcome: added called after a save that changed
// your markers
function openChart(opts) {
  const ov = $('chartOverlay');
  if (!ov) return;
  const o = opts && !opts.type ? opts : {};
  chartAfter = o.added || null;
  chartUndone = o.undone || null;
  chartWelcome = !!o.welcome;
  chartOpener = document.activeElement;
  chartOn = new Set(state.owned);
  chartBase = new Set(state.owned);
  chartMiss(o.missing && state.owned.size ? new Set(state.owned) : null);
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
// (v318 review) Some are missing's view (only, the markers you have) or every colour's
function chartMiss(only) {
  chartOnly = only;
  const ov = $('chartOverlay');
  ov.querySelector('.chcard').classList.toggle('chmiss', !!only);
  $('chTitle').textContent = only ? 'Untick any you’ve lost' : 'Tick the colours you have';
  $('chAll').hidden = !only;
}
function closeChart() {
  const ov = $('chartOverlay');
  if (!ov || !ov.classList.contains('on')) return;
  closeDialog(ov);
  chartAfter = null;
  chartUndone = null;
  chartWelcome = false;
  openerBack(chartOpener);
  chartOpener = null;
}
// (v318.22 debug) closed with ticks not saved — a tap beside the card, Escape, Back or ×: asked first. They had all gone
// without a word (twenty ticks over four families, in a test), where Scan keeps its list
function chartLeave() {
  const ch = chartChanges();
  if ((!ch.add.length && !ch.del.length) || !(window.SF && SF.askBox) || $('sfEdAsk')) return closeChart();
  SF.askBox(
    'Keep your ticks?',
    'You’ve ticked or unticked colours here that aren’t saved yet.',
    '<button type="button" class="btn-primary" data-a="save">' +
      esc($('chSave').textContent) +
      '</button><button type="button" data-a="drop">Discard</button><button type="button" class="sfghost" data-a="stay">Keep ticking</button>',
  ).then(function (a) {
    if (a === 'save') chartSave();
    else if (a === 'drop') closeChart();
  });
}
function chartSave() {
  const ch = chartChanges(),
    after = chartAfter,
    undone = chartUndone,
    welcome = chartWelcome,
    opener = chartOpener;
  if (!ch.add.length && !ch.del.length) return closeChart();
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
  const undoAll = function () {
    undo();
    save();
    fullRender();
    if (typeof presetRelist === 'function') presetRelist();
    if (off.length || Object.keys(ink).length) wishChanged();
    // (the toast's button goes: the keyboard back on what opened the chart, as after the save)
    if (opener && opener.isConnected && opener.offsetParent) opener.focus({ preventScroll: true });
    if (undone) undone();
  };
  // (v318.26) from the welcome, no toast: on a phone it covered the step's own choices. Its Undo goes to the welcome,
  // a link there, named for what it does (the chart can untick as well as tick)
  if (!welcome) toastAction(said, 'Undo', undoAll);
  // (v309.1: removals said too, not as "added")
  if (after)
    after(
      ch.add.length,
      ch.del.length,
      0,
      welcome
        ? {
            fn: undoAll,
            label: ch.del.length
              ? 'Undo: put your collection back as it was'
              : 'Undo: take ' +
                (ch.add.length === 1 ? 'this marker' : 'these ' + ch.add.length + ' markers') +
                ' back out',
          }
        : null,
    );
}
(function () {
  const ov = $('chartOverlay');
  if (!ov) return;
  $('chClose').addEventListener('click', chartLeave);
  $('chSave').addEventListener('click', chartSave);
  // (Some are missing: every colour, to tick one bought on its own too)
  $('chAll').addEventListener('click', function () {
    chartMiss(null);
    chartRender();
    $('chGrid').scrollTop = 0;
    chartChipInView();
    const first = $('chFams').querySelector('[aria-pressed="true"]');
    if (first) first.focus({ preventScroll: true });
  });
  ov.addEventListener('click', function (e) {
    if (e.target === ov) return chartLeave();
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
