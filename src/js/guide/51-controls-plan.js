// Plan (the guide's style): the tabs over four panels (Colours, Pattern, Shading, Share) and the bar. Each panel's
// markup comes from its own function; ctlPlanWire (52-controls-plan-wire.js) then wires the lot.
function ctlPlan() {
  const mk = {};
  if (assignData) for (const l in assignData.assign) mk[assignData.assign[l].mkey] = 1;
  if (curName == null && assignData) {
    var _hx = [];
    for (var _l in assignData.assign) _hx.push(assignData.assign[_l].hex);
    curName = evoName(_hx, Date.now(), usedGuideNames());
  }
  const _snote = surpriseNote
    ? HARM[genHarmony] +
      ' palette \u00b7 ' +
      (family === 'random'
        ? 'Random, main colour ' + surpriseRoles()
        : gradShape.charAt(0).toUpperCase() +
          gradShape.slice(1) +
          (dir < 0 ? ' (reversed)' : '') +
          ' \u00b7 ' +
          LOOK_LABEL[look] +
          ' look') +
      ' \u00b7 ' +
      MOODS[emphasis].label +
      ' mood \u00b7 ' +
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
  frameLineWire();
  ctlEl.setAttribute('data-tab', gTab);
  heldNoteWire();
  pinNoteWire();
  sampleNoteWire();
  toolTipWire();
  roughWire();
  positionRough();
}
// a Plan panel's attributes: shown only while its tab is chosen
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
    // (v306: rough spots, last in the queue)
    roughLineHTML()
  );
}
// The marker count's label: "all (451)" or "16"; for the Gradient, how many it lays when that's fewer (v306): "all ·
// 216 used" (fewer sections), "300 · 216 used", or "all · 268, some twice" (more sections than clear markers:
// gradCount's reuse)
function mkCountLabel(psz) {
  const all = limitN >= psz,
    base = all ? 'all' : String(limitN);
  if (gradFamily() && labels && comps) {
    const c = gradCountNow();
    if (c.reuse) return base + ' \u00b7 ' + c.M + ', some twice';
    if (c.M < Math.min(limitN, psz)) return base + ' \u00b7 ' + c.M + ' used';
  }
  return all ? 'all (' + psz + ')' : base;
}
// Colours: how many markers comes first (it changes the guide the most), then where the colours come from (with
// the filters for Owned), then Temperature and Mood
function ctlPlanColours() {
  let html = '<div class="sftab" data-tab="colours"' + ctlTabAttrs('colours') + '>' + zoneChipsHTML();
  var _mkH = '',
    _expH = '';
  if (family !== 'manual') {
    var _srcSeed = paletteSource === 'saved' || paletteSource === 'generate',
      _psz = sliderMax(),
      _cnt = Math.min(limitN, _psz),
      // (Random's No repeats: as many as there are sections, so the count has nothing to say)
      _nr = family === 'random' && balance === 'mixed' && noRep,
      // (one marker to use: the slider, which starts at 2, has nothing to choose either; it said "all (2)", v304)
      _one = (_srcSeed && !expand ? curSeedLen() : poolFor(palette).length) <= 1;
    _mkH +=
      '<label class="sfmkcount' +
      (_nr || _one ? ' sfoff' : '') +
      '">Markers in this ' +
      (zones.length ? 'zone' : 'guide') +
      ' <b id="sfMkNlbl">' +
      (_nr ? 'one per section' : _one ? 'all (1)' : mkCountLabel(_psz)) +
      '</b><input type="range" id="sfMkCount" min="2" max="' +
      _psz +
      '" value="' +
      _cnt +
      '"' +
      (_nr || _one ? ' disabled' : '') +
      '></label>';
    if (_srcSeed) {
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
  if (family !== 'manual')
    html +=
      '<div class="sfsublbl">Colours from</div><div id="sfSrc" role="group" aria-label="Colours from" class="sfc-segs sfc-mt6">' +
      ctlSeg('owned', 'Owned', paletteSource === 'owned') +
      ctlSeg('saved', 'Saved palette', paletteSource === 'saved') +
      ctlSeg('generate', 'Generate palette', paletteSource === 'generate') +
      '</div>';
  if (family !== 'manual' && paletteSource === 'saved') {
    const pals = api.listPalettes ? api.listPalettes() : [];
    if (!pals.length) {
      html +=
        '<div class="sfc-note sfc-mt6">No saved palettes yet \u2014 make one in Palette, or use Share \u203a Save as palette.</div>';
    } else {
      // a guide whose palette has since been deleted (or never had one) says so, and uses your markers until you
      // choose; showing the first palette as chosen would quietly switch the guide to it at its next change
      const found = pals.some(function (pp) {
        return pp.id === savedPalId;
      });
      html +=
        '<select id="sfPalPick" class="sfc-select" aria-label="Saved palette">' +
        (found
          ? ''
          : '<option value="" selected disabled>' +
            (savedPalId == null ? 'Choose a palette' : 'Palette deleted \u2014 choose another') +
            '</option>') +
        pals
          .map(function (pp) {
            return (
              '<option value="' +
              pp.id +
              '"' +
              (pp.id === savedPalId ? ' selected' : '') +
              '>' +
              esc(pp.name || 'Palette') +
              ' (' +
              (pp.keys ? pp.keys.length : 0) +
              ')</option>'
            );
          })
          .join('') +
        '</select>';
    }
  } else if (family !== 'manual' && paletteSource === 'generate') {
    html +=
      '<select id="sfHarm" class="sfc-select" aria-label="Harmony">' +
      GEN_HARMS.map(function (h) {
        return (
          '<option value="' + h + '"' + (genHarmony === h ? ' selected' : '') + '>' + HARM[h] + '</option>'
        );
      }).join('') +
      '</select>';
  } else {
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
              ? _tot === 1
                ? 'The one marker you own'
                : 'All ' + _tot + ' markers you own'
              : _pass + ' of ' + _tot + ' owned match your filters';
      html += '<div class="sfc-note sfc-mt6">' + _msg + '</div>';
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
    // a saved palette is used as it is: its Mood is greyed out (the line under it says so)
    _mOff = _iShow && paletteSource === 'saved' && curSeedLen() > 0;
  // (Random's Main colour with a colour chosen by hand: the colours are chosen, so Temperature has nothing to steer)
  var _tOff =
    _tShow &&
    family === 'random' &&
    balance === 'main' &&
    paletteSource === 'owned' &&
    (balM !== 'auto' || balS !== 'auto' || balA !== 'auto');
  if (_tShow) html += '<div class="sflean">Within your filters, lean towards\u2026</div>';
  if (_tShow)
    html +=
      '<div class="sfsublbl' +
      (_tOff ? ' sfoff' : '') +
      '">Temperature</div><div id="sfPal" role="group" aria-label="Temperature" class="sfc-segs' +
      (_tOff ? ' sfoff' : '') +
      '">' +
      // (Any first, as in Mood under it, v300)
      ctlSeg('all', 'Any', palette === 'all', _tOff) +
      ctlSeg('cool', 'Cool', palette === 'cool', _tOff) +
      ctlSeg('warm', 'Warm', palette === 'warm', _tOff) +
      '</div>' +
      (_tOff
        ? '<div class="sfc-note sfc-mt6">Main colour sets this: its colours are chosen (Pattern).</div>'
        : '');
  if (_iShow)
    html +=
      '<div class="sfsublbl' +
      (_mOff ? ' sfoff' : '') +
      '">Mood</div><div id="sfMood" role="group" aria-label="Mood" class="sfc-segs sfsix' +
      (_mOff ? ' sfoff' : '') +
      '">' +
      MOOD_KEYS.map(function (k) {
        return ctlSeg(k, MOODS[k].label, emphasis === k, _mOff);
      }).join('') +
      '</div>';
  if (_tShow || _iShow) html += '<div class="sfpoolct">' + poolMsg() + '</div>';
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
    '<div class="sfsublbl">Start colour: <span id="sfGStartC">' +
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
  return msay(m) + (m.name ? ' ' + m.name : '');
}
// the colour it starts with, beside "Start colour:" ("R16 Light Salmon")
function gradStartName(gs, r) {
  const m = gs.cols[r];
  return '<b>' + mcodeHTML(m) + '</b>' + (m.name ? ' ' + esc(m.name) : '');
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
  html +=
    (zones.length ? zoneChipsHTML() : zoneAddHTML()) +
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
      ctlSeg('serpentine', 'Serpentine', gradShape === 'serpentine') +
      ctlSeg('vertical', 'Vertical', gradShape === 'vertical') +
      ctlSeg('diagonal', 'Diagonal', gradShape === 'diagonal') +
      ctlSeg('radial', 'Radial', gradShape === 'radial') +
      ctlSeg('around', 'Around', gradShape === 'around') +
      '</div>' +
      // (Radial: where its rings start, the centre mark on the picture; Around: what the colours go round, v305)
      (gradShape === 'radial' || gradShape === 'around'
        ? '<div id="sfRadNote" class="sfc-note sfc-mt6">Centre: ' +
          (radC
            ? '<b>moved</b> <button type="button" id="sfRadReset" class="sflink">Back to the middle</button>'
            : '<b>in the middle</b> · drag the ' +
              ic('crosshair') +
              '<span class="sfsr">centre mark</span> on the picture to move it') +
          '</div>'
        : '') +
      '<div class="sfsublbl">Direction</div><div id="sfDir" role="group" aria-label="Direction" class="sffit"><button class="sfedit' +
      (dir > 0 ? ' on' : '') +
      '" data-d="1" aria-pressed="' +
      (dir > 0) +
      '">Forward</button><button class="sfedit' +
      (dir < 0 ? ' on' : '') +
      '" data-d="-1" aria-pressed="' +
      (dir < 0) +
      '">Reversed</button></div>' +
      gradStartHTML() +
      '<div class="sfsublbl">Look</div><div id="sfLook" role="group" aria-label="Look" class="sffit">' +
      ctlSeg('auto', LOOK_LABEL.auto, look === 'auto') +
      ctlSeg('smooth', LOOK_LABEL.smooth, look === 'smooth') +
      ctlSeg('ltd', LOOK_LABEL.ltd, look === 'ltd') +
      '</div>';
    const _ln = lookNote();
    if (_ln) html += '<div id="sfLookNote" class="sfc-note sfc-mt6">' + _ln + '</div>';
    // Scatter (v306): one line, its note only away from Polished; with too few markers it stays Polished and says why
    const _sOff = gradCountNow().M < GRAD_SCAT_MIN,
      _sv = _sOff ? 0 : gradScat;
    html +=
      '<label class="sfc-slider sfc-mt10' +
      (_sOff ? ' sfoff' : '') +
      '">Scatter <b id="sfGradScatName">' +
      GRAD_SCAT_LABEL[_sv] +
      '</b><input type="range" id="sfGradScat" min="0" max="4" step="1" value="' +
      _sv +
      '" aria-valuetext="' +
      GRAD_SCAT_LABEL[_sv] +
      '" class="sfc-range"' +
      (_sOff ? ' disabled aria-describedby="sfGradScatNote"' : '') +
      '></label><div id="sfGradScatNote" class="sfc-note sfc-mt6"' +
      (_sv || _sOff ? '' : ' hidden') +
      '>' +
      (_sOff
        ? 'Scatter needs ' +
          GRAD_SCAT_MIN +
          ' or more markers in this ' +
          (zones.length ? 'zone' : 'guide') +
          '.'
        : GRAD_SCAT_DESC[_sv]) +
      '</div>';
  } else if (family === 'random') {
    // (Balance, its bar, Keep touching sections clearly different and No repeats: 31-balance)
    html += balHTML();
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
      '</div>';
  } else if (family === 'photo') {
    const _pw = !photoRef && photoWait[pwKey()] !== 'photo' ? photoWait[pwKey()] : null,
      _pwName = _pw ? FAM_NAME[_pw] || _pw : '';
    if (!photoRef)
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
      if (photoAlign)
        html +=
          '<div class="sfsublbl">Place it</div><div id="sfPhFit" role="group" aria-label="Place it" class="sfc-segs">' +
          ctlSeg('fill', 'Fill', false) +
          ctlSeg('fit', 'Fit', false) +
          ctlSeg('stretch', 'Stretch', false) +
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
          esc(_pb.brand + ' ' + _pb.code + ' ' + (_pb.name || '')) +
          ', change"><i style="background:' +
          esc(_pb.hex) +
          '"></i><b>' +
          esc(_pb.code) +
          '</b><span>' +
          esc(_pb.name || '') +
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
    const _shId = family === 'gradient' ? 'sfVary' : family === 'random' ? 'sfShuffle' : '',
      _pin = family !== 'blend' && family !== 'manual',
      // a saved palette that runs end to end (not round the colour wheel) has nothing to shuffle
      _shOff = family === 'gradient' && savedRamp();
    if (_shId || _pin)
      html +=
        '<div class="sfshpin sfrow2">' +
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
            ' · ' +
            Object.keys(locks).length +
            '</button>'
          : '') +
        '</div>';
    if (_shOff)
      html +=
        '<div id="sfShWhy" class="sfc-note sfc-mt6">This palette runs from one end to the other: Direction flips it.</div>';
    if (_pin && lockMode)
      html += '<div class="sfc-note sfc-mt6">Tap sections to pin or unpin their colour.</div>';
  }
  return html + '</div>';
}
// Shading: the three modes, how the tones go (a one-line ⓘ after the first time), the sliders, where each tone
// goes, sections left flat and the suggestions line; texture at the bottom, always
// Shading (#8). The whole picture's first: Off / Shadows / Light & shadow, where the light comes from, the note on
// markers that would make it richer, the tone lines and Leave sections flat. Then, with zones, the chips and "Shade
// Bell" (the chips sit right above the settings they choose for, as they do in Pattern and Colours), and the chosen
// zone's own (Main's without zones): Roundness, Highlights and Shadows, each its kind and amount. Texture last.
function ctlPlanShading() {
  let html = '<div class="sftab" data-tab="shading"' + ctlTabAttrs('shading') + '>';
  html +=
    '<div class="sfgrp sfshade"><h3 class="sfglbl">Shading</h3><div id="sfShade" class="sfshsegs sffit" role="group" aria-label="Shading">' +
    ctlSeg('off', 'Off', shadeMode === 'off') +
    ctlSeg('shadow', 'Shadows', shadeMode === 'shadow') +
    ctlSeg('full', 'Light &amp; shadow', shadeMode === 'full') +
    '</div>';
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
    if (photoLightOK()) {
      html +=
        '<div class="sfsublbl">Light from</div><div id="sfShLight" role="group" aria-label="Light from" class="sfc-segs">' +
        ctlSeg('sun', 'The sun ' + ic('sun'), !_fp) +
        ctlSeg('photo', 'The photo', _fp) +
        '</div>';
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
      (shadeMode === 'full' ? '<b>H</b> › ' : '') + '<b>B</b> › <b>S</b>, laid light to dark',
      '<b>H</b> highlight › <b>B</b> base › <b>S</b> shadow, laid light to dark. ' +
        (_fp
          ? 'The light and dark come from your photo: where it’s lighter than a section’s colour you get H, darker gets S, and even areas stay flat.'
          : shadeUse().sun
            ? 'Drag the ' + ic('sun') + '<span class="sfsr">sun</span> on the picture to move the light.'
            : '') +
        ' Tap a section to see its markers.',
    );
    html += shadeNoteHTML();
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
      ' · ' +
      _nf +
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
          _sl(slId, 'Amount', 'less <i aria-hidden="true">↔</i> more', v, name) +
          '</div>'
        );
      };
      html +=
        '<div class="sfshpair">' +
        (shadeMode === 'full'
          ? _col(
              'sfHiStyle',
              'Highlights',
              ['same', 'warm', 'paper'],
              SHADE_HILITE_LABEL,
              zs.hilite,
              'sfShHi',
              zs.hi,
              'Highlight amount',
            )
          : '') +
        _col(
          'sfShStyle',
          'Shadows',
          ['same', 'cool', 'grey'],
          SHADE_SHADOW_LABEL,
          zs.shadow,
          'sfShLo',
          zs.lo,
          'Shadow amount',
        ) +
        '</div>';
    }
    html += '</div>';
  }
  html +=
    '</div><label class="sftex">Marker texture <b id="sfTexVal">' +
    Math.round(texAmt * 100) +
    '%</b><input type="range" id="sfTex" min="0" max="100" value="' +
    Math.round(texAmt * 100) +
    '"></label>';
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
// the bottom bar (moved below the whole guide card by dockBar)
function ctlPlanBar() {
  return '<div class="sfbar"><button id="sfBack2" class="sfghost" aria-label="Back to Edit sections" data-long="\u2190 Edit sections" data-short="\u2190 Sections">\u2190 Edit sections</button><button id="sfColor" class="sfcolorcta">Colour along</button></div>';
}
