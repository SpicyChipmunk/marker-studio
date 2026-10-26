// Plan (the guide's style): the tabs over four panels (Colours, Pattern, Shading, Share) and the bar. Each panel's
// markup comes from its own function; ctlPlanWire (52-controls-plan-wire.js) then wires the lot.
// (v324) a name for this guide from its colours, each section weighed by its area (what you see), not starting with
// the first word of the last few guides' names (evoName, names.js)
function guideAutoName(used) {
  const hx = [],
    w = [];
  if (assignData)
    for (const l in assignData.assign) {
      hx.push(assignData.assign[l].hex);
      w.push(comps && comps[l] ? comps[l].area || 1 : 1);
    }
  return evoName(hx, Date.now(), used, { w: w, recent: recentGuideNames(5) });
}
function ctlPlan() {
  const mk = {};
  if (assignData) for (const l in assignData.assign) mk[assignData.assign[l].mkey] = 1;
  if (curName == null && assignData) curName = guideAutoName(usedGuideNames());
  // (v318.1: said shorter, its words of filler gone (palette, main colour, mood): with large text it had covered
  // the most of the picture)
  // (v318.34: a palette you chose is kept, and the toast says so in the harmony's place, U1-5)
  const _snote = surpriseNote
    ? (surpriseNote === 'kept' ? 'Kept your palette' : HARM[genHarmUsed()]) +
      ' \u00b7 ' +
      (family === 'random'
        ? 'Random: ' + surpriseRoles()
        : (gradShape === 'rings'
            ? 'Radial, following the drawing'
            : gradShape.charAt(0).toUpperCase() + gradShape.slice(1)) +
          (dir < 0 ? ' (reversed)' : '') +
          ', ' +
          LOOK_LABEL[look].toLowerCase() +
          ' look') +
      ' \u00b7 ' +
      MOODS[emphasis].label +
      ' \u00b7 ' +
      (lastPoolN || limitN) +
      ' markers'
    : '';
  surpriseNote = false;
  if (!isPlanTab(gTab)) gTab = 'colours';
  // what ✨ Surprise chose goes in its toast (with Undo) and the Undo button's label, not above the picture
  if (_snote) planWhy = 'Surprise' + (zones.length ? ' (' + zoneName(zoneCur) + ')' : '') + ': ' + _snote;
  ctlEl.innerHTML =
    ctlPlanHead() + ctlPlanColours() + ctlPlanPattern() + ctlPlanShading() + ctlPlanShare() + ctlPlanBar();
  ctlPlanWire();
  _moreNarrow = moreState();
  frameLineWire();
  ctlEl.setAttribute('data-tab', gTab);
  mpAfterPlan();
  heldNoteWire();
  pinNoteWire();
  sampleNoteWire();
  toolTipWire();
  lowLineWire();
  stripLineWire();
  ppShadeLineWire();
  roughWire();
  positionRough();
  speckWire();
  positionSpecks();
}
// a Plan panel's attributes: shown only while its tab is chosen
// (v318.16) "More options" on a phone: where the controls are narrower than MORE_W (a phone upright, or a phone on its
// side with the picture beside them), Shading and Colours show their main choices and fold the rest under one bar,
// open or shut for the session (moreOpen, per tab; not saved, not an Undo step). Wider, nothing is folded. It's open
// by itself while something in it is in use (choosing sections to leave flat; the Filters panel).
const MORE_W = 600;
// (the tests open it: window.__MS_MORE_OPEN, e2e/helpers.mjs)
const moreOpen = (function () {
  const o = typeof window !== 'undefined' && !!window.__MS_MORE_OPEN;
  return { shading: o, colours: o, pattern: o };
})();
let _moreNarrow = null;
// (a phone, upright or on its side, or an iPad's narrow split view: the screen's short side under MORE_W; an iPad's is
// 744 or more, so it keeps everything open either way round)
function moreNarrow() {
  if (typeof innerWidth !== 'number' || !innerWidth) return false;
  return Math.min(innerWidth, innerHeight || innerWidth) < MORE_W;
}
// (v318.18) an iPad on its side whose controls column, beside the picture, is narrow (an 11" with a portrait page):
// Colours folds as on a phone, as Theme's grid made it taller than the screen there (Shading and Pattern don't)
const MORE_COL_W = 420;
function moreColNarrow() {
  return !!(geo && geo.side && ctlEl && ctlEl.offsetWidth && ctlEl.offsetWidth < MORE_COL_W);
}
function moreState() {
  return moreNarrow() + '|' + moreColNarrow();
}
// whether the tab folds (the bar shown): its folded part exists and it's narrow
function moreFold(tab) {
  if (!moreNarrow() && !(tab === 'colours' && moreColNarrow())) return false;
  if (tab === 'shading') return shadeMode !== 'off';
  if (tab === 'colours') return family !== 'manual' && family !== 'photo' && paletteSource === 'owned';
  // (v318.17: Gradient's Direction, Start colour and Scatter, Random's two tick boxes, Blend's Spread and Mix)
  if (tab === 'pattern') return family === 'gradient' || family === 'random' || family === 'blend';
  return false;
}
function moreShut(tab) {
  if (moreOpen[tab]) return false;
  if (tab === 'shading') return !shadeFlatMode;
  if (tab === 'colours') return !state.filtersOpen;
  return true;
}
// the bar and the folded part's start, or '' when the tab doesn't fold
function moreBarHTML(tab, sum) {
  const shut = moreShut(tab);
  return (
    '<button type="button" id="sfMore-' +
    tab +
    '" class="filterbar sfmorebar sfc-mt12' +
    (shut ? '' : ' open') +
    '" aria-expanded="' +
    !shut +
    '" aria-controls="sfMoreIn-' +
    tab +
    // (Shading's texture is a second part, after the zones' group)
    (tab === 'shading' ? ' sfMoreIn-shading-2' : '') +
    '"><span class="fb-label">More options</span><span class="fb-sum">' +
    sum +
    '</span><span class="fb-chev"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M6 9l6 6 6-6"></path></svg></span></button>'
  );
}
function moreIn(tab, n) {
  return (
    '<div class="sfmorein" id="sfMoreIn-' +
    tab +
    (n ? '-' + n : '') +
    '"' +
    (moreShut(tab) ? ' hidden' : '') +
    '>'
  );
}
// (on a resize across MORE_W, or the column beside the picture across MORE_COL_W: drawn again, 72-frame)
function moreCheck() {
  const n = moreState();
  if (_moreNarrow !== null && n !== _moreNarrow && sfmode === 'guide' && assignData) renderControls();
  _moreNarrow = moreState();
}
// what's folded in Colours that isn't as it starts, said on the bar ("Warm · 2 filters · Browns on")
function moreColoursSum() {
  const bits = [];
  if (palette === 'warm' || palette === 'cool') bits.push(palette === 'warm' ? 'Warm' : 'Cool');
  // (the theme when Theme is shown: not under a saved or generated palette, which it doesn't steer)
  if (THEMES[theme] && (paletteSource === 'owned' || family === 'manual') && family !== 'photo')
    bits.push(THEMES[theme].n);
  const fs = typeof filterSummary === 'function' ? String(filterSummary()) : '';
  if (fs && !/^All/.test(fs)) bits.push(fs.replace(/<[^>]*>/g, ''));
  return bits.length ? bits.join(' \u00b7 ') : 'Filters, lean towards, include';
}
// (v318.16) the line under the Shading row when no style is chosen
function shCustomText() {
  return (
    (shadeMode === 'shadow' ? 'Shadows only: Highlights is None' : 'Custom: your own amounts') +
    (moreFold('shading') ? ', in More options' : ', below')
  );
}
// the row's chosen button and that line brought up to date after a slider (which doesn't draw the controls again)
function shRowSync() {
  const row = document.getElementById('sfShade');
  if (!row) return;
  const cur = shStyleCur();
  row.querySelectorAll('button').forEach(function (b) {
    const on = b.dataset.v === 'off' ? shadeMode === 'off' : !!cur && cur.k === b.dataset.v;
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', String(on));
  });
  let c = document.getElementById('sfShCustom');
  if (shadeMode === 'off' || cur) {
    if (c) c.remove();
    return;
  }
  if (!c) {
    c = document.createElement('div');
    c.id = 'sfShCustom';
    c.className = 'sfc-note sfc-mt6';
    row.after(c);
  }
  c.textContent = shCustomText();
}
function ctlTabAttrs(t) {
  return (
    ' id="sfPanel-' +
    t +
    '" role="tabpanel" aria-labelledby="sfTab-' +
    t +
    '"' +
    (gTab === t ? '' : ' style="display:none"')
  );
}
// The tab row, then the one-time hint about tapping sections (#8); in Blend a tap adds an anchor, so it's press and
// hold (under the tabs, so on a phone's first view the tabs aren't pushed down behind the bar)
function ctlPlanHead() {
  return (
    '<div class="sftabsen" aria-hidden="true"></div>' +
    '<div class="sftabs" role="tablist" aria-label="Plan">' +
    PTABS.map(function (t) {
      const on = gTab === t[0];
      return (
        '<button role="tab" type="button" id="sfTab-' +
        t[0] +
        '" aria-controls="sfPanel-' +
        t[0] +
        '" tabindex="' +
        (on ? 0 : -1) +
        '" class="sftabbtn' +
        (on ? ' on' : '') +
        '" data-t="' +
        t[0] +
        '" aria-selected="' +
        on +
        '">' +
        t[1] +
        '</button>'
      );
    }).join('') +
    '</div>' +
    frameLineHTML() +
    heldNoteHTML() +
    pinNoteHTML() +
    // (v313: a marker running low, ahead of the first-time lines)
    lowLineHTML() +
    // (v327.1: Shade it like the photo, after a photo-made page's Build; the first-time lines wait for it)
    ppShadeLineHTML() +
    sampleNoteHTML() +
    toolTipHTML() +
    // (one line at a time under the tabs: not beside the kept-sections or pinned line, v289)
    (tapLineUp()
      ? infoLine(
          'tap',
          '',
          (family === 'blend' ? 'Press and hold' : 'Tap') +
            ' a section on the picture to change or pin its colour.',
          true,
        )
      : '') +
    // (v313: Screens and ink differ, once, after the first-time lines)
    stripLineHTML() +
    // (v306: rough spots, last in the queue)
    roughLineHTML()
  );
}
/* (v308) The marker count: −, a slider and + (each 44 px, held down they keep going), and the count, which a tap
   turns into a box to type one. The slider runs from 2 to the smaller of the sections and the markers left (mkCap);
   its right end is "all" (limitN kept as MK_ALL, so a guide stays at all on any page), and a saved count at or over
   the end reads as all. The count says "24", or "all · 130" (how many all lays); a guide just opened, not laid since,
   counts its own markers ("all · 78"), as the guide on screen is what it says. */
const MK_ALL = 999;
function mkCap() {
  const N = labels && comps ? zoneList().length : 0,
    p = sliderMax();
  // (v308.3: Blend's ends at the markers its blend uses at all, so each step along it can change the picture)
  if (family === 'blend' && N >= 2) {
    const b = blendAllN();
    if (b > 0) return Math.max(2, Math.min(N, p, b));
  }
  return Math.max(2, N >= 2 ? Math.min(N, p) : p);
}
// how many markers the sections of the zone being edited have, while it's as it opened (not laid since); else -1
// (v318.29: any, however it was laid: mkCountLabel, with a pinned marker it isn't laid from)
function mkOwnCount(any) {
  if (!assignData || (!any && !_mkOpened[zoneCur])) return -1;
  const seen = {};
  let k = 0;
  zoneList().forEach(function (l) {
    const m = assignData.assign[l];
    if (m && !seen[m.mkey]) {
      seen[m.mkey] = 1;
      k++;
    }
  });
  return k;
}
// (v318.29) the markers you pinned in the zone being edited that the markers it's laid from don't have (Change
// colour to a 4th marker in a guide from a 3-marker palette): in the guide all the same, so the count adds them
function mkPinExtra() {
  if (!assignData || !labels || !comps) return 0;
  const N = zoneList().length;
  if (!N) return 0;
  const from = {},
    seen = {};
  poolSource(Math.min(limitN, N), true).items.forEach(function (m) {
    from[m.mkey] = 1;
  });
  let k = 0;
  zoneList().forEach(function (l) {
    const m = assignData.assign[l];
    if (m && locks[l] !== undefined && !from[m.mkey] && !seen[m.mkey]) {
      seen[m.mkey] = 1;
      k++;
    }
  });
  return k;
}
function mkCountLabel() {
  const cap = mkCap(),
    all = limitN >= cap,
    own = mkOwnCount();
  if (own >= 0)
    return all ? 'all \u00b7 ' + own : own !== limitN ? limitN + ' \u00b7 ' + own : String(limitN);
  // (v318.29: with them the count is the guide's own, as a guide just opened says it: "all · 4" over "4 markers on this
  // page", not "all · 3"; "3 · 4" for a count of 3)
  if (mkPinExtra()) {
    const has = mkOwnCount(true);
    if (!all) return has !== limitN ? limitN + ' \u00b7 ' + has : String(limitN);
    return 'all \u00b7 ' + has;
  }
  if (!all) return String(limitN);
  return 'all \u00b7 ' + (gradFamily() && labels && comps ? gradCountNow().M : cap);
}
// the count's words for a screen reader ("all, 130 markers")
function mkCountSay() {
  return mkCountLabel().replace(' \u00b7 ', ', ') + ' markers';
}
function mkCountCtl(off) {
  const cap = mkCap(),
    v = Math.max(2, Math.min(limitN, cap));
  return (
    '<div class="sfmkhead"><span id="sfMkWord">Markers in this ' +
    (zones.length ? 'zone' : 'guide') +
    '</span><button type="button" id="sfMkNum" class="sfmknum" aria-label="' +
    esc(mkCountSay()) +
    ', type a number"' +
    (off ? ' disabled' : '') +
    '><b id="sfMkNlbl">' +
    (off ? (off === 'one' ? 'one per section' : mkCountLabel()) : mkCountLabel()) +
    '</b></button></div><div class="sfmkrow"><button type="button" class="sfedit sfmkstep" id="sfMkMinus" aria-label="One marker fewer"' +
    (off || v <= 2 ? ' disabled' : '') +
    '>\u2212</button><input type="range" id="sfMkCount" min="2" max="' +
    cap +
    '" value="' +
    v +
    '" aria-labelledby="sfMkWord" aria-valuetext="' +
    esc(mkCountSay()) +
    '"' +
    (off ? ' disabled' : '') +
    '><button type="button" class="sfedit sfmkstep" id="sfMkPlus" aria-label="One marker more"' +
    (off || limitN >= cap ? ' disabled' : '') +
    '>+</button></div>'
  );
}
// Colours: how many markers comes first (it changes the guide the most), then where the colours come from (with
// the filters for Owned), then Temperature and Mood
// (v318.18) a Theme button: its name, and under it a strip of the colours it takes from your markers (themeStrip,
// 30-palette-assign; heard as the name alone). Greyed where next to none of its colours are the Lean towards
// temperature: still a button, which says so when tapped (aria-disabled), and the chosen one can be tapped off.
function themeChip(k, s) {
  const on = theme === k;
  return (
    '<button class="sfedit sfthemeb' +
    (on ? ' on' : '') +
    (s.off ? ' sfthoff' : '') +
    '" data-v="' +
    k +
    '" aria-pressed="' +
    on +
    '"' +
    (s.off && !on ? ' aria-disabled="true"' : '') +
    '><span class="sfthn">' +
    THEMES[k].n +
    '</span><span class="sfstrip' +
    (s.css ? '' : ' sfempty') +
    '" aria-hidden="true"' +
    (s.css ? ' style="background:' + s.css + '"' : '') +
    '></span></button>'
  );
}
// (v318.34) the palette the guide holds, for the Colours tab's card: its keys, name, scheme (a HARM key or null),
// where it came from, and gone (an older guide's Library palette, since deleted: nothing to draw)
function palCardInfo() {
  var o = { keys: [], name: '', h: null, src: '', gone: false };
  if (paletteSource === 'saved' && !palLinked()) {
    var pl = (api.listPalettes ? api.listPalettes() : []).filter(function (x) {
      return x.id === savedPalId;
    })[0];
    if (pl) {
      o.keys = genPalKeys(pl.keys || []);
      o.name = pl.name || 'Palette';
      o.h = HARM[pl.h] ? pl.h : null;
      o.src = 'From your Library';
    } else o.gone = true;
    return o;
  }
  o.keys = genPal.slice();
  if (fromPal) {
    o.name = fromPal.name;
    o.h = fromPal.h;
    // (v318.37: the Library palette it was copied from, since deleted: said, and Save to Library offered again, X3-6)
    o.src =
      fromPal.from === 'library'
        ? palLinked() && !palListed()
          ? 'From your Library (deleted)'
          : 'From your Library'
        : 'From Palette';
  } else {
    // (v319: the scheme it was made with, Analogous + accent while Greys + accent falls back, Y3-3)
    o.name = HARM[genHarmUsed()] || 'Palette';
    o.src = 'Made here';
  }
  return o;
}
// (v318.37) whether the Library still has the palette the guide links to (savedPalId)
function palListed() {
  return (api.listPalettes ? api.listPalettes() : []).some(function (x) {
    return x.id === savedPalId;
  });
}
// (v318.34) whether the palette on the card is in the Library as it is (Save to Library has nothing to add)
function palInLibrary() {
  // (v318.37: a linked palette only while the Library lists it; deleted, its keys are looked for like any other's)
  if (palLinked()) {
    if (palListed()) return true;
  } else if (paletteSource === 'saved' && !palCardInfo().gone) return true;
  var keys = genPalKeys(genPal);
  return (api.listPalettes ? api.listPalettes() : []).some(function (s) {
    return (
      s.keys &&
      s.keys.length === keys.length &&
      s.keys.every(function (k, i) {
        return k === keys[i];
      })
    );
  });
}
// (v318.34) the card and the row of actions under it (see ctlPlanColours)
function palCardHTML() {
  var info = palCardInfo(),
    pals = api.listPalettes ? api.listPalettes() : [],
    html = '';
  if (info.gone) {
    html +=
      '<div id="sfPalCard" class="sfpalnote sfpalgone sfc-mt8" role="group" aria-label="The palette"><div class="sfpntx"><b>Palette deleted</b><span>Choose another</span></div>' +
      '<button type="button" id="sfPalOff" class="mclose" aria-label="Stop using a palette: your markers instead">' +
      ic('x') +
      '</button></div>';
  } else {
    var sw = info.keys
        .slice(0, 12)
        .map(function (k) {
          var i = keyIdx(k);
          return i != null ? '<span style="background:' + COLORS[i].hex + '"></span>' : '';
        })
        .join(''),
      n = resolveKeys(info.keys).length,
      line = [nWord(n, 'marker'), info.h && info.h !== 'custom' ? HARM[info.h] : '', info.src]
        .filter(Boolean)
        .join(' · ');
    html +=
      '<div id="sfPalCard" class="sfpalnote sfc-mt8" role="group" aria-label="The palette"><div class="sstrip" aria-hidden="true">' +
      sw +
      '</div><div class="sfpntx"><b>' +
      esc(info.name) +
      '</b><span>' +
      esc(line) +
      '</span></div><button type="button" id="sfPalOff" class="mclose" aria-label="Stop using this palette: your markers instead">' +
      ic('x') +
      '</button></div>';
    // the cap: a palette used as it is caps the count at its size (the count had jumped, 16 to "all · 8", unsaid)
    if (!expand && n > 0 && limitN > n)
      html +=
        '<div id="sfPalCap" class="sfc-note sfc-mt6">A palette of ' + n + ': tick Expand for more.</div>';
  }
  html +=
    '<div class="sfpalact sfc-mt8"><button type="button" id="sfGenNew" class="sfghost">New palette</button>' +
    '<select id="sfHarm" class="sfc-select" aria-label="Harmony">' +
    GEN_HARMS.map(function (h) {
      // (v318.34) Greys + accent below 3 greys: greyed, and the option says why (v319: or with Greys & black off,
      // genNeutralWhy; it stays the one chosen, shown greyed, while generatePalette falls back, Y3-2/3)
      // (v319, Ben's choice: with only Greys & black off it can be chosen, and choosing it turns them on)
      var why = h === 'neutral' ? genNeutralShort() : null;
      return (
        '<option value="' +
        h +
        '"' +
        (genHarmony === h ? ' selected' : '') +
        (why ? ' disabled' : '') +
        '>' +
        HARM[h] +
        (why ? ' — ' + lcFirst(why) : '') +
        '</option>'
      );
    }).join('') +
    '</select></div>';
  if (genNote) html += '<div class="sfc-note sfc-mt6" id="sfGenNote">' + esc(genNote) + '</div>';
  html += '<div class="sfpalact sfc-mt8">';
  if (!info.gone)
    html +=
      '<button type="button" id="sfPalEdit" class="sfghost">Change it in Palette ' +
      ic('chevron-right') +
      '</button>' +
      (palInLibrary() ? '' : '<button type="button" id="sfPalSave" class="sfghost">Save to Library</button>');
  // (the Library palette in use shown as chosen; else the placeholder, also for one chosen and since deleted)
  var picked =
    paletteSource === 'saved' && !info.gone
      ? pals.some(function (pp) {
          return pp.id === savedPalId;
        })
      : false;
  if (pals.length)
    html +=
      '<select id="sfPalPick" class="sfc-select" aria-label="Choose a saved palette"><option value="" disabled' +
      (picked ? '' : ' selected') +
      '>Choose a saved palette\u2026</option>' +
      pals
        .map(function (pp) {
          return (
            '<option value="' +
            pp.id +
            '"' +
            (picked && pp.id === savedPalId ? ' selected' : '') +
            '>' +
            esc(pp.name || 'Palette') +
            ' (' +
            (pp.keys ? pp.keys.length : 0) +
            ')</option>'
          );
        })
        .join('') +
      '</select>';
  html += '</div>';
  if (!pals.length)
    html +=
      '<div class="sfc-note sfc-mt6" id="sfPalNone">No saved palettes yet' +
      (info.gone ? '.' : ': Save to Library keeps this one.') +
      '</div>';
  return html;
}
function ctlPlanColours() {
  let html = '<div class="sftab" data-tab="colours"' + ctlTabAttrs('colours') + '>' + zoneChipsHTML();
  // (v318.16: on a phone, with your own markers as the source, Filters, Temperature, Include and the count under More
  // options; Mood's buttons, where its pictures aren't shown, come up above the bar)
  const _mf = moreFold('colours'),
    FOLD = '<i data-fold></i>';
  // (v310) Mood as pictures of the page, first: 32-mood-pics (where they aren't shown, Mood's buttons as before)
  const _mpics = mpShow();
  if (_mpics) html += moodPicsHTML();
  var _mkH = '',
    _expH = '';
  if (family !== 'manual') {
    var _srcSeed = paletteSource === 'saved' || paletteSource === 'generate',
      // (a palette chosen: none saved, or a deleted one, uses your markers, v308)
      _seedN = _srcSeed ? seedPool(true).length : 0,
      // (Random's No repeats: as many as there are sections, so the count has nothing to say)
      _nr = family === 'random' && balance === 'mixed' && noRep,
      // (one marker to use: the slider, which starts at 2, has nothing to choose either; it said "all (2)", v304)
      _one = (_seedN && !expand ? _seedN : poolFor(palette).length) <= 1;
    _mkH +=
      '<div class="sfmkcount' +
      (_nr || _one ? ' sfoff' : '') +
      '">' +
      mkCountCtl(_nr ? 'one' : _one ? 'off' : '') +
      '</div>' +
      // (v318.32: why the count is greyed, as its cause is on another tab)
      (_nr
        ? '<div id="sfMkNrNote" class="sfc-note sfc-mt6">No repeats is on (Pattern): every section its own marker.</div>'
        : '');
    if (_srcSeed && (_seedN || paletteSource === 'generate')) {
      _expH +=
        '<label class="sfchk sfc-check sfc-inline sfc-mt8"><input type="checkbox" id="sfExpand"' +
        (expand ? ' checked' : '') +
        '> Expand with nearby markers</label>';
      if (expand) {
        _expH +=
          '<label class="sfc-slider sfc-mt8">Nearby colours <span class="sfc-ends">tints \u2194 hues</span><input type="range" id="sfExpChar" min="0" max="100" value="' +
          Math.round(expandChar * 100) +
          '" class="sfc-range"></label>';
        if (lastPoolN > 0 && lastPoolN < limitN)
          _expH +=
            '<div class="sfc-warn">Only ' +
            nWord(lastPoolN, 'marker') +
            ' close enough \u2014 lean towards hues or lower the count.</div>';
      }
    }
  }
  html += _mkH;
  // (v318.34) Colours from: Your markers | A palette. "A palette" is whatever palette the guide holds, made here (New
  // palette), handed over from Palette or chosen from the Library: a card with its swatches, name, count, scheme and
  // where it came from, and under it New palette with the harmony select, Change it in Palette, Choose a saved
  // palette and Save to Library. Before: Owned | Saved palette | Generate palette, where a palette handed over from
  // Palette lit "Generate palette" and showed only as a greyed option in the harmony select (G5, P2-10)
  var _onPal = paletteSource === 'saved' || paletteSource === 'generate';
  if (family !== 'manual')
    html +=
      '<div class="sfsublbl">Colours from</div><div id="sfSrc" role="group" aria-label="Colours from" class="sfc-segs sfc-mt6">' +
      ctlSeg('owned', 'Your markers', paletteSource === 'owned') +
      ctlSeg('palette', 'A palette', _onPal) +
      '</div>';
  if (family !== 'manual' && _onPal) {
    html += palCardHTML();
  } else {
    html += FOLD;
    {
      var _tot = coll.length,
        _pass = coll.filter(function (m) {
          return m.pass;
        }).length,
        _msg = isDemo()
          ? 'Demo: using all ' +
            _tot +
            ' catalogue markers \u00b7 <button class="sflink" data-gomk="1">add yours</button>'
          : _pass === 0
            ? 'None of your markers match the filters \u2014 using all ' + _tot
            : _pass >= _tot
              ? // (v318.16: nothing to say when every marker you own is in: the count of those the pattern draws on is
                // under Include, and two counts of "your markers" read as a contradiction)
                ''
              : _pass + ' of ' + _tot + ' owned match your filters';
      if (_msg) html += '<div class="sfc-note sfc-mt6">' + _msg + '</div>';
    }
    html +=
      '<div id="sfFiltToggle" role="button" tabindex="0" aria-expanded="' +
      (state.filtersOpen ? 'true' : 'false') +
      '" class="filterbar' +
      (state.filtersOpen ? ' open' : '') +
      ' sfc-mt12"><span class="fb-label">Filters</span><span class="fb-sum">' +
      filterSummary() +
      '</span><span class="fb-chev"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M6 9l6 6 6-6"></path></svg></span></div>';
    if (state.filtersOpen) html += '<div id="sfFiltSlot" class="sfc-mt10"></div>';
  }
  html += _expH;
  var _tShow = (paletteSource === 'owned' || family === 'manual') && family !== 'photo',
    _iShow = family !== 'manual' && family !== 'photo',
    // a saved palette is used as it is: its Mood is greyed out (the line under it says so); so is one handed over
    // from Palette (v308), until a new one is generated
    _mOff =
      _iShow &&
      (paletteSource === 'saved' || (paletteSource === 'generate' && !!fromPal)) &&
      curSeedLen() > 0;
  // (Random's Main colour with a colour chosen by hand: the colours are chosen, so Temperature has nothing to steer)
  var _tOff =
    _tShow &&
    family === 'random' &&
    balance === 'main' &&
    paletteSource === 'owned' &&
    (balM !== 'auto' || balS !== 'auto' || balA !== 'auto');
  // (v318.17: Lean towards, Temperature's Any, Cool and Warm with three themes, a six-wide row as Mood's)
  // (v318.18: Lean towards is Any, Cool and Warm again, and the themes are their own choice below it, Theme: twelve, each
  // with a strip of the colours it takes from your markers; tap the chosen one again for none. A hand-chosen Main
  // colour greys Lean towards only: the theme is still the markers Random chooses from)
  if (_tShow) {
    const _thN = themeNote(),
      _strips = THEME_KEYS.map(themeStrip),
      _anyOff = _strips.some(function (s) {
        return s.off;
      }),
      _thNotes = [];
    // (only while it's still so: not after Undo or another guide)
    if (themeDrop && themeDrop.t === palette && !theme)
      _thNotes.push(themeDrop.n + ' is off: next to none of its colours are ' + themeDrop.t + '.');
    else if (_thN) _thNotes.push(_thN);
    if (_anyOff) _thNotes.push('Greyed themes have next to none of your ' + palette + ' colours.');
    html +=
      '<div class="sfsublbl' +
      (_tOff ? ' sfoff' : '') +
      '" id="sfPalLbl">Lean towards</div><div id="sfPal" role="group" aria-labelledby="sfPalLbl" class="sfc-segs' +
      (_tOff ? ' sfoff' : '') +
      '">' +
      // (Any first, as in Mood, v300)
      ctlSeg('all', 'Any', palette === 'all', _tOff) +
      ctlSeg('cool', 'Cool', palette === 'cool', _tOff) +
      ctlSeg('warm', 'Warm', palette === 'warm', _tOff) +
      '</div>' +
      (_tOff
        ? '<div class="sfc-note sfc-mt6">Main colour sets this: its colours are chosen (Pattern).</div>'
        : '') +
      '<div class="sfsublbl" id="sfThemeLbl">Theme</div><div id="sfTheme" role="group" aria-labelledby="sfThemeLbl" class="sfc-segs sfthemes' +
      (moreNarrow() ? ' sfthemes3' : '') +
      '">' +
      THEME_KEYS.map(function (k, i) {
        return themeChip(k, _strips[i]);
      }).join('') +
      '</div>' +
      (_thNotes.length
        ? '<div id="sfThemeNote" class="sfc-note sfc-mt6">' + _thNotes.join(' ') + '</div>'
        : '');
  }
  if (_iShow && !_mpics) {
    const _moodH =
      '<div class="sfsublbl' +
      (_mOff ? ' sfoff' : '') +
      '">Mood</div><div id="sfMood" role="group" aria-label="Mood" class="sfc-segs sfsix' +
      (_mOff ? ' sfoff' : '') +
      '">' +
      MOOD_KEYS.map(function (k) {
        return ctlSeg(k, MOODS[k].label, emphasis === k, _mOff);
      }).join('') +
      '</div>';
    if (_mf && html.indexOf(FOLD) >= 0) html = html.replace(FOLD, _moodH + FOLD);
    else html += _moodH;
  }
  // (v308) Include, the Gradient from your markers (or a palette Expand adds to) in a guide made since v308: three
  // chips, a tick on those that are on; the line under says how many markers that leaves
  var _inShow = _iShow && inclShow();
  if (_inShow) {
    var _inc = inclOn(gradIncl, emphasis);
    html +=
      '<div class="sfsublbl" id="sfInclLbl">Include</div><div id="sfIncl" role="group" aria-labelledby="sfInclLbl" class="sfc-segs sfincl">' +
      INCL_KEYS.map(function (k) {
        return ctlSeg(k, INCL_LABEL[k].replace('&', '&amp;'), _inc[k]);
      }).join('') +
      '</div>';
  }
  if (_tShow || _iShow)
    html +=
      '<div class="sfpoolct" id="sfPoolCt">' +
      (_inShow && paletteSource === 'owned' ? inclStatus() : poolMsg()) +
      '</div>';
  // (the folded part: from the marker before Filters to here)
  if (html.indexOf(FOLD) >= 0)
    html = _mf
      ? html.replace(FOLD, moreBarHTML('colours', moreColoursSum()) + moreIn('colours')) + '</div>'
      : html.replace(FOLD, '');
  // (v288) the markers to get out of the box: every marker on the page, all zones, opens a list
  if (assignData) {
    const nm = pageMarkerKeys().length;
    html +=
      '<button type="button" id="sfMkList" class="sfghost sfmklist" aria-haspopup="dialog">' +
      nWord(nm, 'marker') +
      ' on this page ' +
      ic('chevron-right') +
      '</button>';
  }
  return html + '</div>';
}
// Gradient: which colour a loop right round the colour wheel starts with (hidden for an open ramp). The strip above
// the slider shows the loop from its smoothest start, each marker's colour under the slider's stop for it.
function gradStartHTML() {
  const gs = gradStartInfo();
  if (!gs) return '';
  const n = gs.n,
    stops = gs.cols
      .map(function (m, i) {
        return esc(m.hex) + ' ' + ((i * 100) / (n - 1)).toFixed(2) + '%';
      })
      .join(', ');
  return (
    // (v323: one style for a slider's row, the label on the left and its value on the right, white)
    '<div class="sfsublbl sfvrow">Start colour <span id="sfGStartC" class="sfval">' +
    gradStartName(gs, gs.r) +
    '</span></div><div class="sfgstart"><div class="sfgsstrip" aria-hidden="true" style="background:linear-gradient(90deg, ' +
    stops +
    ')"></div><input type="range" id="sfGStart" min="0" max="' +
    (n - 1) +
    '" step="1" value="' +
    gs.r +
    '" class="sfc-range" aria-label="Start colour" aria-describedby="sfGStartLbl" aria-valuetext="' +
    esc(gradStartSay(gs, gs.r)) +
    '"></div><div id="sfGStartLbl" class="sfc-note">' +
    gradStartNote(gs, gs.r) +
    '</div>'
  );
}
function gradStartSay(gs, r) {
  const m = gs.cols[r];
  return msay(m) + (capName(m) ? ' ' + capName(m) : '');
}
// the colour it starts with, beside "Start colour:" ("R16 Light Salmon")
function gradStartName(gs, r) {
  const m = gs.cols[r];
  return '<b>' + mcodeHTML(m) + '</b>' + (capName(m) ? ' ' + esc(capName(m)) : '');
}
// once turned from the smoothest start, where the loop's biggest colour step now falls (nothing at the smoothest
// start, where it is at the two ends of the flow)
function gradStartNote(gs, r) {
  if (!r) return '';
  return (
    'The biggest colour step (' +
    mcodeHTML(gs.cols[gs.n - 1]) +
    ' \u2192 ' +
    mcodeHTML(gs.cols[0]) +
    ') is now inside the picture; all the way left keeps it at the ends.'
  );
}
// Pattern: the chooser (one row where it fits), that pattern's options, then Shuffle and Pin side by side
const FAM_NAME = { gradient: 'Gradient', random: 'Random', blend: 'Blend', manual: 'Manual' };
function ctlPlanPattern() {
  let html = '<div class="sftab" data-tab="pattern"' + ctlTabAttrs('pattern') + '>';
  // the zone editor takes the tab's place while it's open (85-zones-ui)
  if (zoneEditOn()) return html + zoneEditorHTML() + '</div>';
  // (v318.17: the heading heard, here whatever the zones; ＋ Zone itself at the tab's end, zoneAddHTML)
  const _mf = moreFold('pattern');
  html +=
    '<h3 class="sfsr">Colour pattern</h3>' +
    zoneChipsHTML() +
    '<div id="sfFam" class="sffit" role="group" aria-label="Colour pattern">' +
    ctlSeg('gradient', 'Gradient', family === 'gradient') +
    ctlSeg('random', 'Random', family === 'random') +
    ctlSeg('blend', 'Blend', family === 'blend') +
    ctlSeg('photo', 'Photo', family === 'photo') +
    ctlSeg('manual', 'Manual', family === 'manual') +
    '</div>';
  if (family === 'gradient') {
    html +=
      '<div class="sfsublbl">Flow</div><div id="sfShape" role="group" aria-label="Flow" class="sffit">' +
      // (v318.17: each with a small picture of its path above its word)
      ctlSeg('serpentine', flowIco('serpentine') + 'Serpentine', gradShape === 'serpentine') +
      ctlSeg('vertical', flowIco('vertical') + 'Vertical', gradShape === 'vertical') +
      ctlSeg('diagonal', flowIco('diagonal') + 'Diagonal', gradShape === 'diagonal') +
      ctlSeg('radial', flowIco('radial') + 'Radial', gradShape === 'radial' || gradShape === 'rings') +
      ctlSeg('around', flowIco('around') + 'Around', gradShape === 'around') +
      '</div>' +
      // (v318.15) Radial's rings: circles round the centre, or out through the touching sections (Rings, gradShape
      // 'rings'), as a choice under Radial: a sixth Flow doesn't fit on a phone's row
      (gradShape === 'radial' || gradShape === 'rings'
        ? // (v318.16: one line, its label beside two compact choices)
          '<div id="sfRingKind" role="group" aria-label="Rings" class="sfringk"><span class="sfringl" aria-hidden="true">Rings</span>' +
          ctlSeg('radial', 'Circles', gradShape === 'radial') +
          ctlSeg('rings', 'Follow the drawing', gradShape === 'rings') +
          '</div>'
        : '') +
      // (Radial: where its rings start, the centre mark on the picture; Around: what the colours go round, v305)
      (gradShape === 'radial' || gradShape === 'around' || gradShape === 'rings'
        ? '<div id="sfRadNote" class="sfc-note sfc-mt6">Centre: ' +
          (radC
            ? '<b>moved</b> <button type="button" id="sfRadReset" class="sflink">Back to the middle</button>'
            : '<b>in the middle</b> · drag the ' +
              ic('crosshair') +
              '<span class="sfsr">centre mark</span> on the picture to move it') +
          '</div>'
        : '') +
      // (v318.17: a page that looks like a mandala: one group, its heading, Matching shapes alike, and with Radial's rings
      // Try Around, which keeps matching petals alike as Radial's rings cut across them, v308)
      mandalaHTML(gradShape === 'radial' || gradShape === 'rings') +
      '<div class="sfsublbl">Look</div><div id="sfLook" role="group" aria-label="Look" class="sffit">' +
      ctlSeg('auto', LOOK_LABEL.auto, look === 'auto') +
      ctlSeg('smooth', LOOK_LABEL.smooth, look === 'smooth') +
      ctlSeg('ltd', LOOK_LABEL.ltd, look === 'ltd') +
      '</div>';
    const _ln = lookNote();
    if (_ln) html += '<div id="sfLookNote" class="sfc-note sfc-mt6">' + _ln + '</div>';
    // (v318.17: Direction, Start colour and Scatter after Look, under More options on a phone)
    if (_mf) html += moreBarHTML('pattern', morePatternSum()) + moreIn('pattern');
    html +=
      '<div class="sfsublbl">Direction</div><div id="sfDir" role="group" aria-label="Direction" class="sffit"><button class="sfedit' +
      (dir > 0 ? ' on' : '') +
      '" data-d="1" aria-pressed="' +
      (dir > 0) +
      '">Forward</button><button class="sfedit' +
      (dir < 0 ? ' on' : '') +
      '" data-d="-1" aria-pressed="' +
      (dir < 0) +
      '">Reversed</button></div>' +
      gradStartHTML();
    // Scatter (v306): one line, and its note (v308: Polished's too); with too few markers it stays Polished and says why
    // (v307: its name over the slider as Flow, Direction, Start colour and Look have theirs, "Scatter: Polished")
    const _sOff = gradCountNow().M < GRAD_SCAT_MIN,
      _sv = _sOff ? 0 : gradScat;
    html +=
      '<div class="sfc-slider sfgscat' +
      (_sOff ? ' sfoff' : '') +
      '"><div class="sfsublbl sfvrow" id="sfGradScatLbl">Scatter <b id="sfGradScatName" class="sfval">' +
      GRAD_SCAT_LABEL[_sv] +
      '</b></div><input type="range" id="sfGradScat" min="0" max="4" step="1" value="' +
      _sv +
      '" aria-label="Scatter" aria-valuetext="' +
      GRAD_SCAT_LABEL[_sv] +
      '" class="sfc-range"' +
      (_sOff ? ' disabled aria-describedby="sfGradScatNote"' : '') +
      '></div><div id="sfGradScatNote" class="sfc-note sfc-mt6">' +
      (_sOff
        ? 'Scatter needs ' +
          GRAD_SCAT_MIN +
          ' or more markers in this ' +
          (zones.length ? 'zone' : 'guide') +
          '.'
        : GRAD_SCAT_DESC[_sv]) +
      '</div>';
    // (v315) markers seen only on specks, last: what spreads them, and where they are
    html += gradSpeckHTML();
    if (_mf) html += '</div>';
  } else if (family === 'random') {
    // (Balance, its share strip and role rows, Keep touching sections clearly different and No repeats: 31-balance;
    // v318.17: those two under More options on a phone, balHTML; v318.34: then Random's own row of Shuffle and Other
    // pairings, balActionsHTML, before the shared Pin colours below)
    html += balHTML(_mf) + balActionsHTML();
  } else if (family === 'blend') {
    html +=
      infoLine(
        'blend',
        'Tap the picture to add colour anchors',
        'Tap the picture to add colour anchors · drag to move · tap an anchor to recolour. Press and hold a section to change or pin its colour.',
      ) +
      '<div class="sfc-anchors"><button id="sfResetA" class="sfghost">Reset anchors</button><span class="sfc-note">' +
      anchors.length +
      (anchors.length === 1 ? ' anchor' : ' anchors') +
      '</span></div>';
    if (_mf) html += moreBarHTML('pattern', morePatternSum()) + moreIn('pattern');
    html +=
      '<div class="sfc-mt10"><label class="sfc-slider">Spread<input type="range" id="sfSpread" min="0.6" max="4" step="0.2" value="' +
      blendFall +
      '" class="sfc-range"></label></div><div class="sfsublbl">Mix</div><div id="sfMix" role="group" aria-label="Mix" class="sffit">' +
      BLEND_MIXES.map(function (k) {
        return ctlSeg(k, BLEND_MIX_LABEL[k], blendMix === k);
      }).join('') +
      // (what the chosen one does, in a line: v285)
      '</div><div id="sfMixHint" class="sfc-note sfc-mt6">' +
      (BLEND_MIX_DESC[blendMix] || '') +
      '</div>' +
      (_mf ? '</div>' : '');
  } else if (family === 'photo') {
    const _pw = !photoRef && photoWait[pwKey()] !== 'photo' ? photoWait[pwKey()] : null,
      _pwName = _pw ? FAM_NAME[_pw] || _pw : '';
    // (v325: a photo-made page's own photo, lined up exactly as it was made: nothing to line up or change, 47-photo-page)
    if (ppOn() && (photoRef || _phPend))
      html += photoRef
        ? '<div class="sfphrow"><img class="sfphthumb" src="' +
          esc(photoViewUrl(photoRef)) +
          '" alt=""><div class="sfphtx">' +
          esc(ppPlanLine()) +
          '</div></div>' +
          ppRemakeHTML() +
          photoStatsHTML() +
          '<label class="sfchk sfc-check sfc-flex sfc-mt8"><input type="checkbox" id="sfPhPaper"' +
          (photoPaper ? ' checked' : '') +
          '> Leave white areas of the photo white</label>'
        : '<div class="sfc-note" role="status">Getting the photo ready…</div>';
    else if (!photoRef)
      html +=
        infoLine(
          'photo',
          'Colours come from a photo you choose',
          'Colours come from a photo you choose — a sunset, a painting, a fabric, or a coloured version of this picture. Each section gets the colour under it, matched to your markers.',
        ) +
        // (v305: until a photo is chosen the picture keeps the pattern before, and that is what Colour along and the
        // Library use: said here, with a way back to it beside Choose a photo)
        (_pw
          ? '<div class="sfphwait"><button id="sfPhPick" class="sfghost sfphbtn">Choose a photo…</button>' +
            '<button type="button" id="sfPhBack" class="sfghost sfphbtn">Back to ' +
            esc(_pwName) +
            '</button></div><div id="sfPhWait" class="sfc-note sfc-mt6">Until you choose a photo, the picture keeps its ' +
            esc(_pwName) +
            ' colours.</div>'
          : '<button id="sfPhPick" class="sfghost sfphbtn">Choose a photo…</button>');
    else {
      html +=
        '<div class="sfphrow"><img class="sfphthumb" src="' +
        esc(photoViewUrl(photoRef)) +
        '" alt=""><div class="sfphtx">' +
        (photoChecking
          ? '<b>Checking whether this is a coloured version of your picture…</b>'
          : photoAlign
            ? 'Drag the photo to move it; pinch to size and turn it. The colours update when you let go.'
            : 'Colours come from this photo, matched to your markers.') +
        (!photoChecking && photoRef.lit && photoRef.lit.on
          ? ' <span class="sfphlit">Lighting corrected from the paper.</span>'
          : '') +
        '</div></div><div class="sfphbtns"><button id="sfPhAlign" class="sfedit' +
        (photoAlign ? ' on' : '') +
        '" aria-pressed="' +
        photoAlign +
        '">' +
        (photoAlign ? 'Done lining up' : 'Line up photo') +
        '</button><button id="sfPhPick" class="sfghost">Change photo</button>' +
        (photoAlign ? '<button id="sfPhAuto" class="sfghost">Line up automatically</button>' : '') +
        '</div>';
      // (v308: the choice as it stands, "Place it: Fill", or how it got there, "Lined up automatically")
      var _pl = photoAlign ? photoPlaceNow() : '';
      if (photoAlign)
        html +=
          '<div class="sfsublbl" id="sfPhFitLbl">Place it: <b>' +
          ({
            fill: 'Fill',
            fit: 'Fit',
            stretch: 'Stretch',
            auto: 'Lined up automatically',
            hand: 'Placed by hand',
          }[_pl] || 'Lined up') +
          '</b></div><div id="sfPhFit" role="group" aria-labelledby="sfPhFitLbl" class="sfc-segs">' +
          ctlSeg('fill', 'Fill', _pl === 'fill') +
          ctlSeg('fit', 'Fit', _pl === 'fit') +
          ctlSeg('stretch', 'Stretch', _pl === 'stretch') +
          '</div><label class="sfc-slider sfc-mt10">See-through<input type="range" id="sfPhOp" min="20" max="90" value="' +
          Math.round(photoOp * 100) +
          '" class="sfc-range"></label><div class="sfphint desk">On a computer: scroll to size it, Shift + scroll to turn it.</div>';
      html +=
        photoStatsHTML() +
        '<label class="sfchk sfc-check sfc-flex sfc-mt8"><input type="checkbox" id="sfPhPaper"' +
        (photoPaper ? ' checked' : '') +
        '> Leave white areas of the photo white</label>' +
        (photoRef.lit
          ? '<label class="sfchk sfc-check sfc-flex sfc-mt8"><input type="checkbox" id="sfPhLight"' +
            (photoRef.lit.on ? ' checked' : '') +
            '> Correct the lighting from the paper</label>'
          : '');
    }
  } else if (family === 'manual') {
    const _pb = paintOn ? paintBrush() : null,
      _np = Object.keys(locks).length,
      _npS = _np ? ' · ' + _np + ' pinned' : '';
    // Paint: a toggle, and while it's on the brush (swatch and code) with a way to change it
    html +=
      '<div class="sfpaint"><button id="sfPaint" class="sfedit' +
      (paintOn ? ' on' : '') +
      '" aria-pressed="' +
      paintOn +
      '">' +
      (paintOn ? 'Done painting' : 'Paint') +
      '</button>' +
      (_pb
        ? '<button id="sfBrush" class="sfbrush" aria-label="Brush ' +
          esc(_pb.brand + ' ' + capCode(_pb) + ' ' + (capName(_pb) || '')) +
          ', change"><i style="background:' +
          esc(_pb.hex) +
          '"></i><b>' +
          esc(capCode(_pb)) +
          '</b><span>' +
          esc(capName(_pb) || '') +
          '</span><em>Change</em></button>'
        : '') +
      '</div>' +
      (paintOn
        ? infoLine(
            'paint',
            'Tap or drag across sections to fill them' + _npS,
            'Tap or drag across sections to fill them with this marker (each one is pinned' +
              (_np ? ', ' + _np + ' pinned' : '') +
              '). Two fingers move and zoom the picture.',
          )
        : infoLine(
            'manual',
            'Tap a section to set its colour' + _npS,
            'Tap a section to set its colour (pins it' +
              (_np ? ', ' + _np + ' pinned' : '') +
              '), or turn on Paint to fill sections by dragging across them. Fill colours only unpinned sections.',
          )) +
      '<div class="sfshpin"><button id="sfFillAll" class="sfghost">Fill unpinned with a colour…</button></div>';
  }
  {
    // (v318.34: Random's Shuffle is in its own row above, balActionsHTML, so Pin colours is alone here for it)
    const _shId = family === 'gradient' ? 'sfVary' : '',
      _pin = family !== 'blend' && family !== 'manual',
      // a saved palette that runs end to end (not round the colour wheel) has nothing to shuffle
      _shOff = family === 'gradient' && savedRamp();
    if (_shId || _pin)
      html +=
        // (v318.34: under Random's own row, no second rule and a smaller gap, sfpinonly)
        '<div class="sfshpin sfrow2' +
        (family === 'random' ? ' sfpinonly' : '') +
        '">' +
        (_shId
          ? '<button id="' +
            _shId +
            '" class="sfghost"' +
            (_shOff ? ' disabled aria-describedby="sfShWhy"' : '') +
            '>' +
            ic('shuffle') +
            ' Shuffle</button>'
          : '') +
        (_pin
          ? '<button id="sfLock" class="sfedit' +
            (lockMode ? ' on' : '') +
            '" aria-pressed="' +
            lockMode +
            '">' +
            (lockMode ? 'Done pinning' : 'Pin colours') +
            // (the count only once there's one: "· 0" read as a score, v318.16)
            (Object.keys(locks).length ? ' · ' + Object.keys(locks).length : '') +
            '</button>'
          : '') +
        '</div>';
    if (_shOff)
      html +=
        '<div id="sfShWhy" class="sfc-note sfc-mt6">This palette runs from one end to the other: Direction flips it.</div>';
    if (_pin && lockMode)
      html += '<div class="sfc-note sfc-mt6">Tap sections to pin or unpin their colour.</div>';
  }
  // (v318.17: ＋ Zone last, the tab's most advanced choice; with zones their chips at the top choose)
  if (!zones.length) html += zoneAddHTML();
  return html + '</div>';
}
// (v318.17) the Flow's pictures: the path the colours take. Heard as their word only (aria-hidden, no text inside)
const FLOW_ICO = {
  serpentine: '<path d="M3 5.5h13.5a3.25 3.25 0 0 1 0 6.5h-9a3.25 3.25 0 0 0 0 6.5H21"/>',
  vertical: '<path d="M5 4v16M19 4v16M12 4v15.5M8.5 16 12 19.5l3.5-3.5"/>',
  diagonal: '<path d="M4 11.5 11.5 4M4 20 20 4M12.5 20 20 12.5"/>',
  radial: '<circle cx="12" cy="12" r="2.4"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="9.6"/>',
  around:
    '<circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><path d="M20 12a8 8 0 1 1-2.35-5.65"/><path d="M18.2 2.8v4h-4"/>',
};
function flowIco(k) {
  return (
    '<svg class="sfflowico" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
    FLOW_ICO[k] +
    '</svg>'
  );
}
// what's folded in Pattern that isn't as it starts, said on the bar
function morePatternSum() {
  const bits = [];
  if (family === 'gradient') {
    if (dir < 0) bits.push('Reversed');
    if (gradScat > 0) bits.push('Scatter: ' + GRAD_SCAT_LABEL[gradScat]);
    return bits.length ? bits.join(' \u00b7 ') : 'Direction, start colour, scatter';
  }
  if (family === 'random') {
    // (v318.27: not all of them, when too few different markers left some alike: the note under the box says how many)
    if (noAdj) bits.push(adjLeft[String(zoneCur)] ? 'Mostly kept apart' : 'Kept apart');
    if (balance === 'mixed' && noRep) bits.push('No repeats');
    return bits.length ? bits.join(' \u00b7 ') : 'Touching sections, repeats';
  }
  return 'Spread, mix';
}
// (v318.17) a page that looks like a mandala, in Gradient and Random: Matching shapes alike, and with Radial's rings
// Try Around
// (v318.32: the box's one sentence says it all; the "Looks like a mandala" heading over it is gone, U1-9)
function mandalaHTML(around) {
  const m = matchAlikeHTML();
  if (!m) return '';
  return (
    '<div class="sfmand"><div class="sfmandrow">' +
    m +
    (around
      ? '<span id="sfAroundTip" class="sfc-note">\u00b7 <button type="button" id="sfUseAround" class="sflink">Try Around</button></span>'
      : '') +
    '</div></div>'
  );
}
// Shading: the three modes, how the tones go (a one-line ⓘ after the first time), the sliders, where each tone
// goes, sections left flat and the suggestions line; texture at the bottom, always
// Shading (#8). The whole picture's first: Off / Shadows / Light & shadow, where the light comes from, the note on
// markers that would make it richer, the tone lines and Leave sections flat. Then, with zones, the chips and "Shade
// Bell" (the chips sit right above the settings they choose for, as they do in Pattern and Colours), and the chosen
// zone's own (Main's without zones): Roundness, Highlights and Shadows, each its kind and amount. Texture last.
function ctlPlanShading() {
  let html = '<div class="sftab" data-tab="shading"' + ctlTabAttrs('shading') + '>';
  // (v318.16: on a phone, the tone lines, Leave sections flat, the zones' shading and texture under More options)
  const _mf = moreFold('shading');
  html +=
    // (v318.16) one row: Off, or a style (45-shading SH_PRESETS), which turns shading on with its amounts. Amounts of
    // your own (a slider moved, or a guide saved before) are Custom, a line under the row, not a button: a sixth
    // didn't fit a phone's row, and it can't be chosen. Shadows only is Highlights › None.
    '<div class="sfgrp sfshade"><h3 class="sfsr">Shading</h3><div id="sfShade" class="sfshsegs sffit" role="group" aria-label="Shading">' +
    ctlSeg('off', 'Off', shadeMode === 'off') +
    shRowPresets()
      .map(function (p) {
        return ctlSeg(p.k, p.n, shadeMode !== 'off' && shPresetOn(p));
      })
      .join('') +
    '</div>' +
    (shadeMode !== 'off' && !shStyleCur()
      ? '<div id="sfShCustom" class="sfc-note sfc-mt6">' + shCustomText() + '</div>'
      : '') +
    // (v318.32) what Neuro is, a line under the row (after the Custom line, which shRowSync puts right after the
    // row): the name alone means nothing to a newcomer (U1-8)
    '<div id="sfShNeuro" class="sfc-note sfc-mt6">Neuro is for neurographic art: each section lit from its edges, not from one side.</div>';
  if (shadeMode !== 'off') {
    const _fp = shadeFromPhoto(),
      _nf = Object.keys(shadeFlat).length,
      zs = zsh(zoneCur),
      _sl = function (id, lbl, ends, v, name) {
        return (
          '<label class="sfshsl">' +
          lbl +
          ' <span>' +
          ends +
          '</span><input type="range" id="' +
          id +
          '" min="0" max="100" value="' +
          Math.round(v * 100) +
          '"' +
          (name ? ' aria-label="' + name + '"' : '') +
          '></label>'
        );
      };
    // one light for the whole picture: the sun, or the photo when there is one in place
    // (v318.15: always, with The edges: each section darker along its lines, lighter in its middle)
    {
      const _ed = shadeEdges();
      html +=
        '<div class="sfsublbl">Light from</div><div id="sfShLight" role="group" aria-label="Light from" class="sfc-segs">' +
        ctlSeg('sun', 'The sun ' + ic('sun'), !_fp && !_ed) +
        ctlSeg('edges', 'The edges', _ed) +
        (photoLightOK() ? ctlSeg('photo', 'The photo', _fp) : '') +
        '</div>';
    }
    if (photoLightOK()) {
      const _out = _fp ? shadeOutside() : 0;
      if (_out)
        html +=
          '<div class="sfphint" id="sfShOut">' +
          _out +
          (_out === 1 ? ' section is' : ' sections are') +
          ' outside the photo, so ' +
          (_out === 1 ? 'it stays' : 'they stay') +
          ' flat.</div>';
    }
    html += infoLine(
      'shade',
      (shAnyHi() ? '<b>H</b> › ' : '') + '<b>B</b> › <b>S</b>, laid light to dark',
      '<b>H</b> highlight › <b>B</b> base › <b>S</b> shadow, laid light to dark. ' +
        (_fp
          ? 'The light and dark come from your photo: where it’s lighter than a section’s colour you get H, darker gets S, and even areas stay flat.'
          : shadeEdges()
            ? 'Each section is darker along its lines and in its corners, lighter in its middle, as neurographic drawings are rounded. Roundness sets how far in the shadow reaches.'
            : shadeUse().sun
              ? 'Drag the ' + ic('sun') + '<span class="sfsr">sun</span> on the picture to move the light.'
              : '') +
        ' Tap a section to see its markers.',
    );
    html += shadeNoteHTML();
    if (_mf) html += moreBarHTML('shading', 'Roundness, tones, texture') + moreIn('shading');
    // the tone lines and Leave sections flat share a row where they fit
    html +=
      '<div class="sfshrow"><label class="sfchk sfc-check sfc-flex"><input type="checkbox" id="sfShLines"' +
      (shadeLines ? ' checked' : '') +
      '> Show tone lines</label><button id="sfShFlat" class="sfedit' +
      (shadeFlatMode ? ' on' : '') +
      '" aria-pressed="' +
      shadeFlatMode +
      '">' +
      (shadeFlatMode ? 'Done choosing' : 'Leave sections flat') +
      (_nf ? ' · ' + _nf : '') +
      '</button></div>' +
      (shadeFlatMode
        ? '<div class="sfphint">Tap sections to stop them being shaded (eyes, tiny details). Tap again to shade them.</div>'
        : '');
    // ---- the chosen zone's own (Main's without zones), a group a screen reader hears as the zone's
    const _zn = esc(zoneName(zoneCur));
    if (zones.length) html += zoneChipsHTML();
    html += zones.length ? '<div role="group" aria-label="' + _zn + '’s shading">' : '<div>';
    if (zones.length) {
      html +=
        '<label class="sfchk sfc-check sfzshade"><input type="checkbox" id="sfZoneShade"' +
        (zs.on ? ' checked' : '') +
        '> Shade ' +
        _zn +
        '</label>';
      if (!zs.on) html += '<div class="sfphint sfzflat">' + _zn + ' is flat: one colour per section.</div>';
    }
    if (zs.on) {
      if (!_fp) html += _sl('sfRound', 'Roundness', 'flat <i aria-hidden="true">↔</i> rounded', zs.round);
      // Highlights and Shadows side by side: each its kind (a lighter marker of the same colour, or another kind) and
      // how much of the section it takes (with Shadows only, just the shadow's)
      const _col = function (id, lbl, keys, labels, cur, slId, v, name) {
        return (
          '<div class="sfshcol"><label class="sfsublbl" for="' +
          id +
          '">' +
          lbl +
          '</label><select id="' +
          id +
          '" class="sfc-select">' +
          keys
            .map(function (k) {
              return (
                '<option value="' + k + '"' + (cur === k ? ' selected' : '') + '>' + labels[k] + '</option>'
              );
            })
            .join('') +
          '</select>' +
          (slId ? _sl(slId, 'Amount', 'less <i aria-hidden="true">↔</i> more', v, name) : '') +
          '</div>'
        );
      };
      // (v318.16: Shadows only, once a mode of its own, is Highlights › None: the whole picture's, mode 'shadow')
      // (v318.17: None per zone, a record's own; the Colorless Blender's lift where you own one, or it's chosen)
      const _none = shadeMode === 'shadow' || zs.hilite === 'none',
        _blOwn = blenderOwned(),
        // (v327: Matched to the photo, where the zone can have photo tones; chosen where it can't, Same colour)
        _pt = ptAvail(zoneCur),
        _hk = (_pt ? ['photo'] : []).concat(
          ['same', 'warm', 'paper'],
          _blOwn || zs.hilite === 'blender' ? ['blender'] : [],
          ['none'],
        ),
        _cur = function (v) {
          return v === 'photo' && !_pt ? 'same' : v;
        };
      html +=
        '<div class="sfshpair">' +
        _col(
          'sfHiStyle',
          'Highlights',
          _hk,
          SHADE_HILITE_LABEL_ALL,
          _none ? 'none' : _cur(zs.hilite),
          _none ? null : 'sfShHi',
          zs.hi,
          'Highlight amount',
        ) +
        _col(
          'sfShStyle',
          'Shadows',
          (_pt ? ['photo'] : []).concat(['same', 'cool', 'grey']),
          SHADE_SHADOW_LABEL,
          _cur(zs.shadow),
          'sfShLo',
          zs.lo,
          'Shadow amount',
        ) +
        '</div>' +
        // (v327) photo tones: Two tone sets, and how many sections stay flat
        (_pt && (zs.shadow === 'photo' || zs.hilite === 'photo')
          ? '<label class="sfchk sfc-mt6"><input type="checkbox" id="sfShSets"' +
            (shadeSets ? ' checked' : '') +
            '> Two tone sets per marker (closer to the photo)</label>' +
            (function () {
              // (v327.1: what was shaded first; the rest are the photo's even parts, mostly)
              const n = ptFlatN(),
                t = ptToneN();
              if (!n) return '';
              return (
                '<div class="sfc-note sfc-mt6" id="sfShEven">' +
                (t
                  ? 'Shaded from the photo: ' +
                    t +
                    (t === 1 ? ' section. ' : ' sections. ') +
                    n +
                    (n === 1 ? ' stays' : ' stay') +
                    ' flat: tones wouldn’t make ' +
                    // (one: "it … to it" read badly)
                    (n === 1 ? 'it much closer to the photo.' : 'them much closer to it.')
                  : 'No section is shaded from the photo: tones wouldn’t make any much closer to it.') +
                '</div>'
              );
            })()
          : '') +
        (shadeMode === 'shadow' && zones.length
          ? '<div class="sfc-note sfc-mt6">No highlights anywhere: the whole picture is shadows only. A highlight chosen here is this zone’s alone.</div>'
          : zs.hilite === 'none' && shadeMode === 'full'
            ? '<div class="sfc-note sfc-mt6">' + _zn + ' is shadows only: no highlights here.</div>'
            : zs.hilite === 'blender' && !_none
              ? '<div class="sfc-note sfc-mt6">' +
                (_blOwn
                  ? 'The 0 on the highlight first, then B over the whole section; while it’s wet, touch the 0 again to lift more.'
                  : 'No Colorless Blender in your markers: a lighter marker instead.') +
                '</div>'
              : '');
    }
    html += '</div>';
    if (_mf) html += '</div>';
  }
  html +=
    '</div>' +
    (_mf ? moreIn('shading', 2) : '') +
    // (v318.32) a hint line under the slider, as every other slider has (U1-8). Inside the label, so texture stays the
    // tab's last element; the slider is named by aria-label and the hint describes it, so the hint isn't its name
    '<label class="sftex">Marker texture <b id="sfTexVal">' +
    Math.round(texAmt * 100) +
    '%</b><input type="range" id="sfTex" min="0" max="100" value="' +
    Math.round(texAmt * 100) +
    '" aria-label="Marker texture" aria-describedby="sfTexHint"><span id="sfTexHint" class="sfrnghint">Higher: the colours look more like marker strokes on paper</span></label>' +
    (_mf ? '</div>' : '');
  return html + '</div>';
}
// Share (#9): show it off, Print… (a sheet), plan and keep
function ctlPlanShare() {
  return (
    '<div class="sftab" data-tab="share"' +
    ctlTabAttrs('share') +
    '>' +
    '<div class="sfgrp"><h3 class="sfglbl">Show it off</h3><div class="sfrow2"><button id="sfReveal" class="sfreveal">' +
    ic('sparkles') +
    ' Reveal &amp; share</button><button id="sfExport" class="sfghost">' +
    ic('image') +
    ' Save image</button></div><label class="sfchk sfc-check sfc-inline sfc-mt8"><input type="checkbox" id="sfExCodes"' +
    (exCodesNow() ? ' checked' : '') +
    '> Codes on the saved image</label>' +
    // (v306: Did any run low?, once the page is finished)
    lowHost('S') +
    '</div><div class="sfgrp"><h3 class="sfglbl">Print</h3><button id="sfPrint" class="sfghost sffull" aria-haspopup="dialog">' +
    ic('printer') +
    ' Print…</button></div><div class="sfgrp"><h3 class="sfglbl">Plan &amp; keep</h3><div class="sfrow2"><button id="sfPlan" class="sfghost">' +
    ic('blend') +
    ' Blend plan</button><button id="sfAsPal" class="sfghost">' +
    ic('palette') +
    ' Save as palette</button></div><button id="sfShareGuide" class="sfghost sffull">' +
    ic('file-down') +
    ' Guide file</button></div></div>'
  );
}
// the bottom bar (moved below the whole guide card by dockBar); Colour along is off while every section is left white
// (a photo with no colour, v307)
function ctlPlanBar() {
  return (
    '<div class="sfbar"><button id="sfBack2" class="sfghost" aria-label="Back to Edit sections" data-ic="back" data-long="Edit sections" data-short="Sections">' +
    icNav(-1) +
    ' Edit sections</button><button id="sfColor" class="sfcolorcta"' +
    (guideWhite() ? ' disabled title="Every section is left white: nothing to colour yet"' : '') +
    '>Colour along</button></div>'
  );
}

/* (v315) A Gradient's markers seen only on specks: on the Pattern tab, last, "Y29 only colours specks of this page.
   Fewer markers would spread the colours further. Show them" (Show them rings their sections, as the rough spots' line
   does; Hide them, or the plan laid again, a tab or a zone changed, takes the rings away). A marker counts when its
   sections together are under SPECK_SHARE of the zone (the same floor as the v315 Gradient rule, which lays to avoid
   them where it can: what is left is on pages with several huge sections). Not when scattered (Textured and up: specks
   are the look), nor when each section has a marker of its own, nor for a marker only on sections you pinned. More
   than three: how many, not their codes. */
const SPECK_SHARE = 0.003;
let _speckOn = null, // the plan whose speck sections are ringed (assignData, its zone)
  speckEl = null;
function gradSpecks() {
  if (family !== 'gradient' || !assignData) return null;
  const secs = zoneList(),
    c = gradCountNow();
  if (!secs.length || c.M >= secs.length || gradScatAt(c.M) >= 2) return null;
  const A = assignData.assign,
    by = {},
    ms = {},
    at = {};
  let all = 0;
  secs.forEach(function (l) {
    const m = A[l];
    if (!m) return;
    const a = comps[l].area || 1;
    all += a;
    if (locks[l] !== undefined) {
      by[m.mkey] = Infinity;
      return;
    }
    by[m.mkey] = (by[m.mkey] || 0) + a;
    ms[m.mkey] = m;
    (at[m.mkey] || (at[m.mkey] = [])).push(l);
  });
  const ks = Object.keys(by).filter(function (k) {
    return by[k] < SPECK_SHARE * all;
  });
  if (!ks.length) return null;
  let ls = [];
  ks.forEach(function (k) {
    ls = ls.concat(at[k]);
  });
  return { keys: ks, ms: ms, secs: ls };
}
function speckShown() {
  return !!_speckOn && _speckOn.a === assignData && _speckOn.z === zoneLive() && gTab === 'pattern';
}
function gradSpeckHTML() {
  const sp = gradSpecks();
  if (!sp) return '';
  const n = sp.keys.length,
    names = sp.keys.map(function (k) {
      return '<b>' + mcodeHTML(sp.ms[k]) + '</b>';
    }),
    who = n > 3 ? n + ' markers' : n > 1 ? names.slice(0, -1).join(', ') + ' and ' + names[n - 1] : names[0];
  return (
    '<div id="sfSpeck" class="sfc-note sfc-mt6">' +
    who +
    (n > 1 ? ' only colour' : ' only colours') +
    ' specks of this ' +
    (zones.length ? 'zone' : 'page') +
    '. Fewer markers would spread the colours further. <button type="button" id="sfSpeckShow" class="sflink" aria-pressed="' +
    speckShown() +
    '">' +
    (speckShown() ? 'Hide them' : 'Show them') +
    '</button></div>'
  );
}
function speckWire() {
  const b = document.getElementById('sfSpeckShow');
  if (b)
    b.addEventListener('click', function () {
      _speckOn = speckShown() ? null : { a: assignData, z: zoneLive() };
      renderControls();
      ctlRefocus('#sfSpeckShow');
      sayLive(_speckOn ? 'Their sections are ringed on the picture.' : 'Rings hidden.');
    });
}
// the rings, over the picture, while Show them is on for this plan
function positionSpecks() {
  if (!sfView || !cv) return;
  const sp = speckShown() && sfmode === 'guide' && document.getElementById('sfSpeck') ? gradSpecks() : null;
  if (!sp) {
    if (_speckOn && _speckOn.a !== assignData) _speckOn = null;
    if (speckEl) speckEl.innerHTML = '';
    return;
  }
  if (!speckEl) {
    speckEl = document.createElement('div');
    speckEl.className = 'sfroughs sfspecks';
    speckEl.setAttribute('aria-hidden', 'true');
  }
  if (speckEl.parentNode !== (picEl || sfView)) (picEl || sfView).appendChild(speckEl);
  if (cv.style.transition) {
    speckEl.innerHTML = '';
    setTimeout(positionSpecks, 400);
    return;
  }
  const r0 = cv.getBoundingClientRect(),
    vr = picHost().getBoundingClientRect(),
    q = picK(),
    k = r0.width / q / W;
  if (!(k > 0)) return;
  const ox = (r0.left - vr.left) / q,
    oy = (r0.top - vr.top) / q;
  speckEl.innerHTML = sp.secs
    .map(function (l) {
      const p = labelPos(l);
      return (
        '<span class="sfring" style="left:' +
        (ox + p.x * k).toFixed(1) +
        'px;top:' +
        (oy + p.y * k).toFixed(1) +
        'px"></span>'
      );
    })
    .join('');
}
