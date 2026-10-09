/* chrome */
function filterSummary() {
  const parts = [];
  if (state.brands.size < BRAND_DEFS.length) parts.push([...state.brands].join(', ') || 'no brand');
  const onF = families.filter((f) => !state.excluded.has(f.name));
  if (onF.length < families.length)
    parts.push(
      onF.length === 0
        ? 'no family'
        : onF.length <= 3
          ? onF.map((f) => f.name.replace(' / ', ' ')).join(', ')
          : onF.length + ' families',
    );
  if (state.tones.size < TONE_DEFS.length)
    parts.push(
      TONE_DEFS.filter((t) => state.tones.has(t.k))
        .map((t) => t.t)
        .join(', ') || 'no tone',
    );
  if (state.sats.size < SAT_DEFS.length)
    parts.push(
      SAT_DEFS.filter((s) => state.sats.has(s.k))
        .map((s) => s.t)
        .join(', ') || 'no saturation',
    );
  return parts.length ? parts.join(' · ') : 'All markers';
}
function chrome() {
  // a toast belongs to the screen that made it: moving to another screen clears it
  if (chrome._mode !== state.mode) {
    if (chrome._mode !== undefined) hideToast();
    chrome._mode = state.mode;
  }
  const _home = state.mode === 'home',
    _sec = state.mode === 'sections';
  document.querySelector('.wrap').classList.toggle('homemode', _home);
  document.querySelector('.wrap').classList.toggle('sfmode', _sec);
  // (Palette: its settings beside the palette on a wide screen, 02-picker.css, v300)
  document.querySelector('.wrap').classList.toggle('palmode', state.mode === 'palette');
  palFiltersPlace();
  // (Markers: the search and the view on one row, the tools and the line about the view on the next, on a wide screen)
  document.querySelector('.wrap').classList.toggle('mkmode', state.mode === 'collection');
  // (the Guide tab's start card: the sample's picture until there's a guide, also after one is deleted or put back)
  if (window.SF && SF.startPic) SF.startPic();
  // (v288: the palette's glow belongs to Palette, and Random's draw; elsewhere the plain background)
  document.documentElement.classList.toggle('noamb', state.mode !== 'palette' && state.mode !== 'random');
  mSections.classList.toggle('on', _sec);
  if (mHome) mHome.classList.toggle('on', _home);
  var _hv = document.getElementById('homeView');
  if (_hv) _hv.style.display = _home ? '' : 'none';
  if (_home) {
    mPalette.classList.remove('on');
    mCollection.classList.remove('on');
    {
      const hc = document.querySelector('.homecard[data-go="collection"]');
      if (hc) {
        const n = state.owned.size;
        hc.classList.toggle('attn', !n);
        const sb = hc.querySelector('.hcsub');
        if (sb) sb.textContent = n ? n + (n === 1 ? ' marker' : ' markers') : 'Set up your markers';
      }
    }
    if (window.SF) SF.leave();
    if (window.SF && SF.maybeResume) SF.maybeResume();
    renderRecent();
    renderBackupNudge();
    return;
  }
  if (_sec) {
    mPalette.classList.remove('on');
    mCollection.classList.remove('on');
    if (window.SF) {
      SF.setCollection(sfCollection());
      SF.enter();
    }
    return;
  }
  if (window.SF) SF.leave();
  const M = state.mode,
    rnd = M === 'random',
    pal = M === 'palette',
    fnd = M === 'finder',
    col = M === 'collection',
    browse = fnd || col;
  const pooled = !!state.pool && !browse;
  mPalette.classList.toggle('on', pal);
  mCollection.classList.toggle('on', col || rnd);
  hero.style.display = browse ? 'none' : '';
  var _rb = document.getElementById('rndBack');
  if (_rb) _rb.style.display = rnd ? '' : 'none';
  swatch.style.display = rnd ? '' : 'none';
  palette.style.display = pal ? '' : 'none';
  primaryRow.style.display =
    browse || (pal && (state.harmony === 'custom' || state.harmony === 'photo')) ? 'none' : 'flex';
  secondaryRow.style.display = browse ? 'none' : 'flex';
  swapBtn.style.display = rnd ? '' : 'none';
  undoBtn.textContent = rnd ? 'Remove' : 'Undo';
  undoBtn.style.display = pal && (state.harmony === 'custom' || state.harmony === 'photo') ? 'none' : '';
  trackWrap.style.display = rnd ? '' : 'none';
  drawnWrap.style.display = rnd ? '' : 'none';
  harmWrap.style.display = pal ? 'flex' : 'none';
  sizeWrap.style.display = pal && state.harmony !== 'photo' ? 'flex' : 'none';
  seedWrap.style.display = pal && state.harmony !== 'custom' && state.harmony !== 'photo' ? 'flex' : 'none';
  var _phw = document.getElementById('photoWrap');
  if (_phw) {
    _phw.style.display = pal && state.harmony === 'photo' ? '' : 'none';
    var _phb = document.getElementById('photoBody');
    if (_phb) _phb.style.display = _photoImg ? '' : 'none';
    var _php = document.getElementById('photoPick');
    if (_php) _php.textContent = _photoImg ? 'Choose another photo' : 'Choose a reference photo';
    var _phs = document.getElementById('photoSize');
    if (_phs) {
      var _pc = _phs.children,
        _pi;
      for (_pi = 0; _pi < _pc.length; _pi++) segOn(_pc[_pi], +_pc[_pi].dataset.n === state.palSize);
    }
  }
  palette.classList.toggle('custommode', pal && state.harmony === 'custom');
  // a seed that's no longer in play (dry, not owned, filtered out) is shown struck through, saying why it's not used
  if (pal) {
    const si = keyIdx(state.seed),
      off = si != null && !inPool(si),
      why = off
        ? NOINK.has(si)
          ? 'not a colour'
          : state.pool
            ? 'not in the selection'
            : isOwned(si) && isDry(si)
              ? 'dry'
              : state.owned.size && !isOwned(si)
                ? 'not owned'
                : 'filtered out'
        : '';
    seedBtn.innerHTML =
      si != null
        ? (off
            ? '<s>' +
              COLORS[si].brand +
              ' ' +
              COLORS[si].code +
              '</s> <span class="seednote">' +
              why +
              ', not used</span>'
            : COLORS[si].brand + ' ' + COLORS[si].code) +
          ' <span class="sx">' +
          ic('x') +
          '</span>'
        : 'Random base';
  }
  findWrap.style.display = browse ? '' : 'none';
  findResults.style.display = browse ? '' : 'none';
  findActions.style.display = col ? 'flex' : 'none';
  ownWrap.style.display = col ? 'flex' : 'none';
  var _md = document.getElementById('mkDraw');
  if (_md) _md.style.display = col ? '' : 'none';
  // (Tick all shown; ⋯ is in the heading, v289)
  var _os = document.getElementById('ownStateWrap');
  if (_os) _os.style.display = col && state.collView !== 'owned' ? 'flex' : 'none';
  var _mm = document.querySelector('.mkmore');
  if (_mm) _mm.style.display = col ? '' : 'none';
  if (ownAllBtn) ownAllBtn.style.display = col && state.collView !== 'owned' ? '' : 'none';
  if (ownNoneBtn) ownNoneBtn.style.display = col && state.collView !== 'unowned' ? '' : 'none';
  var _bw = document.getElementById('backupWrap');
  if (_bw) _bw.style.display = col ? '' : 'none';
  var _pw = document.getElementById('presetWrap');
  if (_pw) {
    _pw.style.display = col ? 'block' : 'none';
    const _top = !state.owned.size,
      _bw = $('backupWrap'),
      _md = $('mkDraw');
    // (before the row Random is in, v300: its wrapper on an iPad, a box of its own there)
    const _mr = _md && (_md.closest('.mkh2') || _md);
    if (_top && _mr && _pw.nextElementSibling !== _mr) {
      _mr.parentNode.insertBefore(_pw, _mr);
      _pw.classList.remove('bottom');
    } else if (!_top && _bw && _pw.nextElementSibling !== _bw) {
      _bw.parentNode.insertBefore(_pw, _bw);
      _pw.classList.add('bottom');
      const _pb = $('presetBody'),
        _ph = $('presetHdr');
      if (_pb && _pb.style.display !== 'none' && _ph) _ph.click();
    }
  }
  if (col && !state.owned.size && !chrome._setsOpened) {
    chrome._setsOpened = 1;
    const _pb = $('presetBody');
    if (_pb && _pb.style.display === 'none') {
      const _ph = $('presetHdr');
      if (_ph) _ph.click();
    }
  }
  [...ownView.children].forEach((b) => segOn(b, b.dataset.v === state.collView));
  gapWrap.style.display = col && state.collView === 'unowned' ? 'flex' : 'none';
  lowChipSync(col);
  gapSort.value = state.gapSort;
  ownHint.style.display = col ? '' : 'none';
  mkJumpSync(col);
  if (col)
    ownHint.textContent =
      state.collView === 'unowned'
        ? state.gapSort === 'gap'
          ? 'Ranked to fill the biggest gaps in your collection — each pick adds coverage in a different area. Tap to add.'
          : state.gapSort === 'complete'
            ? 'Families you’ve invested in most, ordered by how close each is to complete. Tap to finish the ones you use.'
            : state.gapSort === 'ramps'
              ? 'Markers that best bridge a tonal jump between two you already own — smoother blends. Ranked by how much each closes the gap.'
              : 'Markers you don’t own yet — the gaps in your collection. Tap to add as you buy them.'
        : state.collView === 'all'
          ? 'Every marker. Narrow with filters, then “Tick all shown”.'
          : lowOnly
            ? 'The markers you marked running low or dry. Tap it again for all your markers.'
            : 'Your collection. Switch to All to add more.';
  filterBar.style.display = pooled ? 'none' : '';
  filtersEl.style.display = pooled || !state.filtersOpen ? 'none' : '';
  filterBar.classList.toggle('open', state.filtersOpen && !pooled);
  filterBar.setAttribute('aria-expanded', state.filtersOpen && !pooled ? 'true' : 'false');
  filterSum.textContent = filterSummary();
  poolBar.style.display = pooled ? 'flex' : 'none';
  if (pooled) {
    // (the ones in play: a dry one in the selection isn't, v299)
    var _pn = state.pool.filter(inPool).length;
    poolN.textContent = _pn;
    var _pwd = document.getElementById('poolW');
    if (_pwd) _pwd.textContent = _pn === 1 ? 'colour' : 'colours';
  }
  libRow.style.display = pal || rnd ? 'flex' : 'none';
  // (v289) the saved palettes and draws, a link at the top of Palette (they were only in ⋯ › Library)
  {
    const _ps = document.getElementById('palSavedWrap'),
      _np = state.saved.filter((s) => s.type !== 'guide').length;
    if (_ps) {
      _ps.style.display = pal && _np ? '' : 'none';
      const _pb = _ps.firstElementChild;
      if (_pb) _pb.firstChild.textContent = 'Saved palettes (' + _np + ') ';
    }
  }
  var _ug = document.getElementById('useGuideWrap');
  if (_ug) _ug.style.display = pal && currentPaletteIdxs().length ? '' : 'none';
  saveBtn.disabled = (pal && !currentPaletteIdxs().length) || (rnd && !state.drawn.length);
  exportBtn.disabled = (rnd && !state.drawn.length) || (pal && !currentPaletteIdxs().length);
  // Photo before a photo is chosen: nothing to save or clear yet, so no Save, Save image or Clear (and no ⋯ left on
  // its own: the Library is on Home); the card says what to do
  const noPhoto = pal && photoEmpty();
  if (noPhoto) {
    libRow.style.display = 'none';
    secondaryRow.style.display = 'none';
  }
  {
    const gt = phint.querySelector('.ghtext');
    if (gt)
      gt.textContent = noPhoto ? 'Tap to choose a photo and pull its colours' : 'Tap to generate a palette';
  }
  harmDescSync(pal);
  {
    [...segs.children].forEach((b) => {
      const n = +b.dataset.n;
      // (v308: and only what the markers in play can fill, palCap)
      const okn = sizeOffered(state.harmony, n) && n <= palCap(state.harmony);
      b.disabled = !okn;
      b.style.display = okn ? '' : 'none';
      segOn(b, okn && n === state.palSize);
    });
    const shown = [...segs.children].filter((b) => !b.disabled).length;
    segs.style.setProperty('--segcols', shown > 7 ? Math.ceil(shown / 2) : shown);
    // (beside the palette on an iPad held sideways, the column takes 9 on one row: Triadic's 3–10 had made a 4×2 block,
    // v300)
    segs.style.setProperty('--segcolsw', shown > 9 ? Math.ceil(shown / 2) : shown);
  }
  closeNote();
  harm.querySelectorAll('button').forEach((b) => segOn(b, b.dataset.h === state.harmony));
  // Clear only when there's something to clear
  if (rnd || pal) {
    const has = clearable();
    if (!has && resetBtn.dataset.arm === '1') disarm();
    resetBtn.disabled = !has;
  }
  fgNormalize();
  [
    ['brandAll', 'brand'],
    ['toneAll', 'tone'],
    ['satAll', 'sat'],
    ['all', 'fam'],
  ].forEach((p) => {
    const b = document.getElementById(p[0]);
    if (b) b.style.visibility = fgIsAll(p[1]) ? 'hidden' : '';
  });
  const af = anyFam(),
    at = anyTone(),
    as = anySat(),
    ab = anyBrand();
  if (rnd) {
    const { t, u, left } = counts();
    fill.style.width = (t ? (u / t) * 100 : 0) + '%';
    statusEl.innerHTML = '<b>' + u + '</b> drawn, <b>' + left + '</b> left to draw';
    // (nothing in play at all isn't "All drawn": a brand filtered out, every marker dry, v299)
    const none = t === 0 ? 'No markers to draw' : 'All drawn',
      bad = pooled
        ? left === 0
          ? none
          : null
        : !af
          ? 'Turn on a family'
          : !at
            ? 'Turn on a tone'
            : !as
              ? 'Turn on saturation'
              : !ab
                ? 'Turn on a brand'
                : left === 0
                  ? none
                  : null;
    drawBtn.disabled = !!bad || rolling;
    drawFocusBack();
    drawBtn.textContent = bad || 'Draw a marker';
    undoBtn.disabled = state.drawn.length === 0;
    swapBtn.disabled = state.drawn.length === 0 || left === 0 || rolling;
  } else if (pal) {
    let avail = 0;
    for (let i = 0; i < COLORS.length && avail < state.palSize; i++) if (inPool(i)) avail++;
    const bad = pooled
      ? avail < state.palSize
        ? 'Only ' + avail + ' marker' + (avail === 1 ? '' : 's') + ' to choose from'
        : null
      : !af
        ? 'Turn on a family'
        : !at
          ? 'Turn on a tone'
          : !as
            ? 'Turn on saturation'
            : !ab
              ? 'Turn on a brand'
              : avail < state.palSize
                ? 'Only ' + avail + ' marker' + (avail === 1 ? '' : 's') + ' to choose from'
                : null;
    drawBtn.disabled = !!bad;
    drawFocusBack();
    drawBtn.textContent = bad || 'Generate palette';
    undoBtn.disabled = state.harmony === 'custom' || state.palettes.length === 0;
  }
  const countView =
    rnd || pal
      ? 'owned'
      : fnd
        ? state.finderScope === 'owned'
          ? 'owned'
          : 'all'
        : col
          ? state.collView
          : 'all';
  const passOwn = (i) => (countView === 'owned' ? isOwned(i) : countView === 'unowned' ? !isOwned(i) : true);
  brandsEl.innerHTML = BRAND_DEFS.map((bd) => {
    let cnt = 0;
    for (let i = 0; i < COLORS.length; i++) {
      if (
        COLORS[i].brand !== bd.k ||
        state.excluded.has(COLORS[i].fam) ||
        !inTone(i) ||
        !inSat(i) ||
        !passOwn(i)
      )
        continue;
      cnt++;
    }
    return (
      '<button class="chip" data-brand="' +
      bd.k +
      '" data-sel="' +
      (fgSel('brand', bd.k) ? 1 : 0) +
      '" data-empty="' +
      (cnt ? 0 : 1) +
      '" aria-pressed="' +
      (fgSel('brand', bd.k) ? 1 : 0) +
      '">' +
      bd.t +
      ' <span class="rem">' +
      cnt +
      '</span></button>'
    );
  }).join('');
  famsEl.innerHTML = families
    .map((f) => {
      let cnt = 0;
      for (const i of f.idxs) if (inTone(i) && inSat(i) && inBrand(i) && passOwn(i)) cnt++;
      const glow = ';box-shadow:0 0 9px ' + rgba(f.repHex, 0.6);
      return (
        '<button class="chip" data-fam="' +
        f.name +
        '" data-sel="' +
        (fgSel('fam', f.name) ? 1 : 0) +
        '" data-empty="' +
        (cnt ? 0 : 1) +
        '" aria-pressed="' +
        (fgSel('fam', f.name) ? 1 : 0) +
        '"><span class="dot" style="background:' +
        f.repHex +
        glow +
        '"></span>' +
        f.name +
        ' <span class="rem">' +
        cnt +
        '</span></button>'
      );
    })
    .join('');
  tonesEl.innerHTML = TONE_DEFS.map((td) => {
    let cnt = 0;
    for (let i = 0; i < COLORS.length; i++) {
      if (TONE[i] !== td.k || state.excluded.has(COLORS[i].fam) || !inSat(i) || !inBrand(i) || !passOwn(i))
        continue;
      cnt++;
    }
    return (
      '<button class="chip" data-tone="' +
      td.k +
      '" data-sel="' +
      (fgSel('tone', td.k) ? 1 : 0) +
      '" data-empty="' +
      (cnt ? 0 : 1) +
      '" aria-pressed="' +
      (fgSel('tone', td.k) ? 1 : 0) +
      '"><span class="dot" style="background:' +
      td.d +
      ';box-shadow:inset 0 0 0 1px rgba(255,255,255,.22)"></span>' +
      td.t +
      ' <span class="rem">' +
      cnt +
      '</span></button>'
    );
  }).join('');
  satsEl.innerHTML = SAT_DEFS.map((sd) => {
    let cnt = 0;
    for (let i = 0; i < COLORS.length; i++) {
      if (SAT[i] !== sd.k || state.excluded.has(COLORS[i].fam) || !inTone(i) || !inBrand(i) || !passOwn(i))
        continue;
      cnt++;
    }
    return (
      '<button class="chip" data-sat="' +
      sd.k +
      '" data-sel="' +
      (fgSel('sat', sd.k) ? 1 : 0) +
      '" data-empty="' +
      (cnt ? 0 : 1) +
      '" aria-pressed="' +
      (fgSel('sat', sd.k) ? 1 : 0) +
      '"><span class="dot" style="background:' +
      sd.d +
      '"></span>' +
      sd.t +
      ' <span class="rem">' +
      cnt +
      '</span></button>'
    );
  }).join('');
  if (rnd) {
    pilen.textContent = state.drawn.length ? '(' + state.drawn.length + ')' : '';
    tiptap.textContent = state.drawn.length ? 'tap a colour to return it' : '';
    if (state.drawn.length) {
      pileEmpty.style.display = 'none';
      const dmix = brandsMixedIn(state.drawn);
      pile.innerHTML = state.drawn
        .map((i) => {
          const c = COLORS[i];
          return (
            '<div class="cell" data-i="' +
            i +
            '" role="button" tabindex="0" aria-label="' +
            esc(c.brand + ' ' + c.code + ' ' + c.name + ', put it back') +
            '" title="' +
            c.brand +
            ' ' +
            c.code +
            ' · ' +
            c.name +
            ' — tap to return">' +
            btHTML(c.brand, dmix) +
            '<div class="sq" style="background:' +
            c.hex +
            '"></div><div class="cc">' +
            c.code +
            '</div></div>'
          );
        })
        .join('');
    } else {
      pile.innerHTML = '';
      pile.appendChild(pileEmpty);
      pileEmpty.style.display = '';
    }
    const dn = new Set(state.drawn),
      rem = [];
    for (let i = 0; i < COLORS.length; i++) {
      if (inPool(i) && !dn.has(i)) rem.push(i);
    }
    pooln.textContent = rem.length ? '(' + rem.length + ')' : '';
    const pmix = brandsMixedIn(rem);
    poolGrid.innerHTML = rem.length
      ? rem
          .map((i) => {
            const c = COLORS[i];
            return (
              '<div class="cell cellro" role="img" aria-label="' +
              esc(c.brand + ' ' + c.code + ' ' + c.name) +
              '" title="' +
              c.brand +
              ' ' +
              c.code +
              ' · ' +
              c.name +
              ' · ' +
              c.hex.toUpperCase() +
              '">' +
              btHTML(c.brand, pmix) +
              '<div class="sq" style="background:' +
              c.hex +
              '"></div><div class="cc">' +
              c.code +
              '</div></div>'
            );
          })
          .join('')
      : '<div class="empty">Nothing left to draw.</div>';
  }
  {
    const _eo = $('emptyOwned'),
      _no = (pal || rnd) && !state.owned.size && !state.pool;
    if (_eo) _eo.style.display = _no ? '' : 'none';
    // (v308: the brands you'd buy, when Brands I'd buy has chosen)
    const _et = _no && _eo && _eo.firstElementChild,
      _bt =
        'Using every ' +
        (state.buyBrands || allBrands()).join(' + ') +
        ' marker. Add yours to match what you own.';
    if (_et && _et.textContent !== _bt) _et.textContent = _bt;
  }
  if (browse && !chrome.keepGrid) renderResults();
  wishChrome(col);
}

// a segmented control's choice: shown (on) and announced (aria-pressed), like the guide's
function segOn(b, on) {
  b.classList.toggle('on', on);
  b.setAttribute('aria-pressed', on ? 'true' : 'false');
}
function syncModeA11y() {
  [mHome, mSections, mCollection, mPalette].forEach((b) => {
    if (b) b.setAttribute('aria-current', b.classList.contains('on') ? 'page' : 'false');
  });
  // (the screen's name as a heading, for a screen reader's list of them: v284)
  const h = document.getElementById('screenH'),
    on = [mHome, mSections, mCollection, mPalette].find((b) => b && b.classList.contains('on'));
  if (h && on && h.textContent !== on.textContent) h.textContent = on.textContent;
}
// the header names the brands you actually own (both only when you own both)
function headBrands() {
  const el = document.querySelector('.head .set');
  if (!el) return;
  const b = [];
  state.owned.forEach(function (k) {
    const x = String(k).split('|')[0];
    if (x && b.indexOf(x) < 0) b.push(x);
  });
  b.sort(function (p, q) {
    return p === 'Ohuhu' ? -1 : q === 'Ohuhu' ? 1 : p < q ? -1 : 1;
  });
  const t = b.length ? b.join(' + ') + ' \u00b7 your collection' : 'Ohuhu + Copic \u00b7 full range';
  if (el.textContent !== t) el.textContent = t;
}
function fullRender() {
  // (the markers in play may have changed since: Markers, Brands I'd buy, another tab; v308.2: before the Colours row
  // and Generate are drawn, which had shown no size chosen and Generate refusing the old one)
  if (state.mode === 'palette') palSizeFit();
  chrome();
  syncModeA11y();
  headBrands();
  // (Brands I'd buy's row: another tab or a restore may have changed it, v304)
  if (typeof buySumSync === 'function') buySumSync();
  palNoneShow(false);
  if (state.mode === 'palette') {
    if (state.harmony === 'custom') showCustom();
    else if (palNone()) {
      clearPalette();
      phint.style.display = 'none';
      palNoneShow(true);
    } else {
      const p = state.palettes[state.palettes.length - 1],
        pv = p ? null : palPreview();
      if (p && !(state.harmony === 'photo' && !_photoImg)) showPalette(p, false);
      else if (pv) showPalette(pv, false);
      else {
        clearPalette();
        if (state.harmony === 'photo' && phint) phint.style.display = '';
      }
    }
  } else if (state.mode === 'random') {
    const c = state.drawn[0];
    if (c != null) showColor(c, false);
    else clearColor();
  }
}

// (v308) Palette with no marker in play (the filters, or a selection, leave none): an empty card that says so, with
// the way back, rather than the last palette, every marker of it filtered out, with Save and Use in a guide still on
function palNone() {
  if (state.mode !== 'palette' || state.harmony === 'custom' || photoEmpty()) return false;
  for (let i = 0; i < COLORS.length; i++) if (inPool(i)) return false;
  return true;
}
const palNoneEl = document.createElement('div');
palNoneEl.id = 'palNone';
palNoneEl.className = 'palnone';
palNoneEl.setAttribute('role', 'status');
palNoneEl.style.display = 'none';
palette.appendChild(palNoneEl);
function palNoneShow(on) {
  if (on) {
    // (v309.2) no filter on and still none: your markers are a Colorless Blender or dry ("Clear filters" did nothing)
    const sel = !!state.pool,
      mine = !sel && ['brand', 'tone', 'sat', 'fam'].every(fgIsAll),
      h =
        '<span>' +
        (sel
          ? 'No markers in this selection'
          : mine
            ? 'None of your markers lays down colour (a blender, or dry)'
            : 'No markers match these filters') +
        '</span><span aria-hidden="true"> \u00b7 </span><button type="button" class="sflink" id="palNoneClear">' +
        (sel ? 'Clear selection' : mine ? 'Add markers' : 'Clear filters') +
        '</button>';
    if (palNoneEl.innerHTML !== h) palNoneEl.innerHTML = h;
  }
  palNoneEl.style.display = on ? '' : 'none';
}
palNoneEl.addEventListener('click', (e) => {
  if (!e.target.closest('#palNoneClear')) return;
  if (!state.pool && ['brand', 'tone', 'sat', 'fam'].every(fgIsAll)) {
    setMode('collection');
    return;
  }
  if (state.pool) setPool(null);
  else ['brand', 'tone', 'sat', 'fam'].forEach(fgClear);
  filterChanged();
  const d = drawBtn && !drawBtn.disabled ? drawBtn : null;
  if (d) d.focus({ preventScroll: true });
});
// (v305) Palette's first visit: a palette made from your markers to look at, so the screen doesn't open empty. It
// isn't one of your palettes yet (not in state.palettes: not in Remove's history, not kept, no storage written just by
// opening the screen); it becomes yours once you lock or change one of its colours (palAdopt), and Save, Save image and
// Use in a guide take it as it is. Generate palette makes a new one as before. Not for Custom or From photo, and not
// again after Clear.
let palPv = null,
  palPvOff = false;
function palPreview() {
  if (
    palPvOff ||
    state.mode !== 'palette' ||
    state.palettes.length ||
    state.harmony === 'custom' ||
    state.harmony === 'photo'
  )
    return null;
  // (v308: made again when the markers in play change — your collection, the filters, a selection — not only the
  // scheme or size: added sets had left it showing markers you don't own)
  const k = state.harmony + '|' + state.palSize + '|' + poolSig();
  if (!palPv || palPv.k !== k)
    palPv = {
      p: genPalette(state.palSize, state.harmony, paletteOpts()),
      k: k,
    };
  return palPv.p || null;
}
// the markers in play (inPool), as a short string that changes whenever they do
function poolSig() {
  let s = '',
    b = 0,
    n = 0;
  for (let i = 0; i < COLORS.length; i++) {
    b = (b << 1) | (inPool(i) ? 1 : 0);
    if (++n === 16) {
      s += String.fromCharCode(65 + (b >> 8), 65 + (b & 255));
      b = n = 0;
    }
  }
  return s + n + ':' + b;
}
function palAdopt() {
  const p = palPreview();
  if (!p) return false;
  palPush(p.slice(), 24);
  palPv = null;
  palPvOff = true;
  save();
  return true;
}
let rolling = false;
function doDraw() {
  if (rolling) return;
  disarm();
  const dn = new Set(state.drawn),
    pool = [];
  COLORS.forEach((c, i) => {
    if (inPool(i) && !dn.has(i)) pool.push(i);
  });
  if (!pool.length) return;
  const pick = pool[(Math.random() * pool.length) | 0];
  retrigger(drawBtn, 'flash');
  const commit = () => {
    state.drawn.unshift(pick);
    save();
    showColor(pick, true);
    chrome();
    const fc = pile.querySelector('.cell');
    if (fc && !reduce) fc.classList.add('in');
  };
  if (reduce) {
    commit();
    return;
  }
  rolling = true;
  rollFocus();
  drawBtn.disabled = true;
  code.style.display = 'none';
  hint.style.display = 'none';
  const delays = [38, 42, 48, 58, 72, 94, 126, 170];
  let i = 0;
  const tick = () => {
    swatch.style.background = COLORS[(Math.random() * COLORS.length) | 0].hex;
    i++;
    if (i >= delays.length - 3) buzz(6);
    if (i < delays.length) setTimeout(tick, delays[i]);
    else {
      rolling = false;
      commit();
      buzz(32);
    }
  };
  setTimeout(tick, delays[0]);
}
function doReDraw() {
  if (rolling || state.mode !== 'random' || !state.drawn.length) return;
  disarm();
  const dn = new Set(state.drawn),
    pool = [];
  COLORS.forEach((c, i) => {
    if (inPool(i) && !dn.has(i)) pool.push(i);
  });
  if (!pool.length) return;
  const pick = pool[(Math.random() * pool.length) | 0];
  retrigger(drawBtn, 'flash');
  const target = state.drawn[0],
    commit = () => {
      const at = state.drawn.indexOf(target);
      if (at < 0) {
        chrome();
        return;
      }
      state.drawn[at] = pick;
      save();
      showColor(pick, true);
      chrome();
      const fc = pile.querySelector('.cell');
      if (fc && !reduce) fc.classList.add('in');
    };
  if (reduce) {
    commit();
    return;
  }
  rolling = true;
  rollFocus();
  drawBtn.disabled = true;
  swapBtn.disabled = true;
  undoBtn.disabled = true;
  code.style.display = 'none';
  const delays = [38, 42, 48, 58, 72, 94, 126, 170];
  let i = 0;
  const tick = () => {
    swatch.style.background = COLORS[(Math.random() * COLORS.length) | 0].hex;
    i++;
    if (i >= delays.length - 3) buzz(6);
    if (i < delays.length) setTimeout(tick, delays[i]);
    else {
      rolling = false;
      commit();
      buzz(32);
    }
  };
  setTimeout(tick, delays[0]);
}
function doReRollBand(k) {
  if (rolling || state.mode !== 'palette') return;
  const pal = state.palettes[state.palettes.length - 1];
  if (!pal || k >= pal.length) return;
  const pick = rerollPick(pal, k, state.harmony);
  // (said, not a tap that does nothing or a colour off the scheme, v304)
  if (pick < 0) {
    toast(
      state.pool
        ? 'No other marker in the selection fits this scheme \u2014 clear the selection to use all your markers.'
        : 'No other marker fits this scheme \u2014 add markers or loosen the filters.',
      4000,
    );
    return;
  }
  const b = [...bands.children][k];
  if (!b) return;
  const cd = b.querySelector('.bcode');
  const finish = () => {
    if (state.palettes[state.palettes.length - 1] !== pal || !b.isConnected) return;
    // (a new step in the history, so Undo brings the colour back, v299: it was gone for good)
    const np = pal.slice();
    np[k] = pick;
    palPush(np, 24);
    save();
    const c = COLORS[pick];
    b.style.background = c.hex;
    cd.textContent = c.code;
    cd.style.color = txt(c.hex);
    bandLabel(b, pick);
    if (!reduce) {
      b.style.animationDelay = '0ms';
      b.classList.remove('bin');
      void b.offsetWidth;
      b.classList.add('bin');
    }
    const base = COLORS[np[0]];
    palReadout(shownPaletteName(np), palSub(np), np);
    setAmb(base.hex);
    closeNote();
    buzz(24);
  };
  if (reduce) {
    finish();
    return;
  }
  rolling = true;
  rollFocus();
  drawBtn.disabled = true;
  let i = 0;
  const delays = [40, 46, 54, 66, 84, 110, 150];
  const tick = () => {
    b.style.background = COLORS[(Math.random() * COLORS.length) | 0].hex;
    cd.textContent = '';
    i++;
    if (i < delays.length) setTimeout(tick, delays[i]);
    else {
      rolling = false;
      finish();
      chrome();
      regenFlush();
    }
  };
  setTimeout(tick, delays[0]);
}
// The Draw / Generate button is disabled while it rolls, which drops a keyboard's focus to the page: noted here
// and given back once it's enabled again (v289)
function rollFocus() {
  if (document.activeElement === drawBtn) drawBtn._ret = 1;
}
function drawFocusBack() {
  if (drawBtn.disabled || !drawBtn._ret) return;
  drawBtn._ret = 0;
  const a = document.activeElement;
  if (!a || a === document.body) drawBtn.focus({ preventScroll: true });
}
function toggleLock(k) {
  const pal = state.palettes[state.palettes.length - 1];
  if (!pal || k >= pal.length) return;
  const idx = pal[k];
  if (state.locked.includes(idx)) state.locked = state.locked.filter((x) => x !== idx);
  else state.locked = [...state.locked, idx];
  save();
  const b = [...bands.children][k];
  if (b) {
    b.classList.toggle('locked', state.locked.includes(idx));
    const lk = b.querySelector('.blk');
    if (lk) lk.setAttribute('aria-pressed', state.locked.includes(idx) ? 'true' : 'false');
    bandLabel(b, idx);
  }
}
function doGenerate() {
  if (rolling || state.harmony === 'custom') return;
  disarm();
  palSizeFit();
  // (v306: Rainbow rolls another from a new seed; a scheme or size change makes the Gradient's own, regenReplace)
  const pal = genPalette(state.palSize, state.harmony, Object.assign(paletteOpts(), { reroll: true }));
  if (!pal) {
    palFailToast();
    return;
  }
  retrigger(drawBtn, 'flash');
  const commit = () => {
    palPvOff = true;
    palPush(pal, 24);
    state.locked = state.locked.filter((i) => pal.includes(i));
    save();
    showPalette(pal, true);
    chrome();
    buzz(28);
    regenFlush();
  };
  if (reduce) {
    commit();
    return;
  }
  rolling = true;
  rollFocus();
  drawBtn.disabled = true;
  phint.style.display = 'none';
  buildBands(pal.length);
  const bs = [...bands.querySelectorAll('.band')];
  bs.forEach((b, idx) => {
    if (state.locked.includes(pal[idx])) {
      const c = COLORS[pal[idx]];
      b.style.background = c.hex;
      b.classList.add('locked');
      const cd = b.querySelector('.bcode');
      cd.textContent = c.code;
      cd.style.color = txt(c.hex);
    }
  });
  let t = 0;
  const max = 9;
  const iv = setInterval(() => {
    t++;
    bs.forEach((b, idx) => {
      if (!state.locked.includes(pal[idx]))
        b.style.background = COLORS[(Math.random() * COLORS.length) | 0].hex;
    });
    if (t >= max - 2) buzz(5);
    if (t >= max) {
      clearInterval(iv);
      rolling = false;
      commit();
    }
  }, 50);
}

function action() {
  state.mode === 'palette' ? doGenerate() : state.mode === 'random' ? doDraw() : 0;
}
// The palette history, with each palette's scheme beside it (state.palH; `auto`: made by a size, scheme or filter
// change, palHarm)
function palPush(pal, max, auto) {
  state.palettes.push(pal);
  state.palH.push(state.harmony + (auto ? '+' : ''));
  while (state.palettes.length > max) {
    state.palettes.shift();
    state.palH.shift();
  }
}
function palPop() {
  state.palettes.pop();
  state.palH.pop();
}
function undo() {
  if (rolling) return;
  if (state.mode === 'palette') {
    if (!state.palettes.length) return;
    palPop();
    // (v308) a photo's palette whose photo has gone (the page was opened again since) can't be shown as one: skipped
    const lastH = () => palHarm(state.palH[state.palH.length - 1]);
    while (state.palettes.length > 0 && lastH() === 'photo' && !_photoImg) palPop();
    // (v296) back to the palette before with its own scheme and size, not under the ones chosen since; locks it
    // doesn't have go. (v308) Photo's palettes and the schemes' go back to their own: a photo's had been shown under
    // Complementary's name, and a scheme's as From photo.
    const top = state.palettes[state.palettes.length - 1],
      h = lastH();
    if (top) {
      const gen = (x) => x && x !== 'custom' && x !== 'photo';
      if (h === 'photo' && state.harmony !== 'photo' && state.harmony !== 'custom') state.harmony = 'photo';
      else if (gen(h) && (gen(state.harmony) || state.harmony === 'photo') && h !== state.harmony)
        state.harmony = h;
      const R = HARM_RANGE[state.harmony] || [2, 6];
      // (a Rainbow capped at the clear markers in play keeps the size chosen)
      if (
        state.harmony === 'photo'
          ? PHOTO_SIZES.indexOf(top.length) >= 0
          : top.length >= R[0] &&
            top.length <= R[1] &&
            (state.harmony !== 'rainbow' || sizeOffered('rainbow', top.length))
      )
        state.palSize = top.length;
    }
    state.locked = state.locked.filter((i) => top && top.includes(i));
  } else if (state.mode === 'random') {
    if (!state.drawn.length) return;
    state.drawn.shift();
  } else return;
  save();
  fullRender();
}
function filterChanged() {
  if (state.mode === 'palette') palSizeFit();
  if (state.mode === 'palette' && state.harmony !== 'custom' && state.harmony !== 'photo') regenReplace();
  else save();
  fullRender();
}
// Generate's palette can't be made from the markers in play (v304: a Finder selection has no filters to loosen)
function palFailToast() {
  toast(
    'Couldn\u2019t make a ' +
      state.palSize +
      '-colour palette from the markers in play \u2014 try fewer colours or ' +
      (state.pool ? 'clear the selection.' : 'loosen the filters.'),
    5000,
  );
}
// the palette made again for a new scheme, size, filter or base; when the markers in play can't fill it, said as
// Generate says it (the palette shown stays as it was, v304). While a palette or a colour is rolling it's made once
// the roll ends (v304: the roll's palette, made before the change, landed on top of it)
let regenLater = false;
function regenReplace() {
  if (rolling) {
    regenLater = true;
    return;
  }
  const pal = genPalette(state.palSize, state.harmony, paletteOpts());
  if (!pal) {
    if (!palNone()) palFailToast();
    return;
  }
  // (v308) a new step, so Undo goes back to the palette that was there; only one made this way is replaced (trying
  // 6, then 3, then Undo had lost the palette before both)
  if (state.palettes.length && palAuto(state.palH[state.palH.length - 1])) palPop();
  palPush(pal, 24, true);
  state.locked = state.locked.filter((i) => pal.includes(i));
  save();
  showPalette(pal, true);
}
function regenFlush() {
  if (!regenLater) return;
  regenLater = false;
  if (state.mode === 'palette' && state.harmony !== 'custom' && state.harmony !== 'photo') {
    regenReplace();
    chrome();
  }
}
function setSize(n) {
  if (rolling || state.palSize === n) return;
  const R = HARM_RANGE[state.harmony] || [2, 6];
  if (n < R[0] || n > R[1] || (state.harmony === 'rainbow' && !sizeOffered('rainbow', n))) return;
  if (n > palCap(state.harmony)) return;
  state.palSize = n;
  save();
  if (state.mode === 'palette') {
    if (state.harmony === 'custom') {
      ensureCustomSize();
      showCustom();
    } else regenReplace();
  }
  chrome();
}
function setHarmony(h) {
  if (rolling || state.harmony === h) return;
  state.harmony = h;
  const R = HARM_RANGE[h] || [2, 6];
  // (back to Custom: its own size, as many slots as it has; another scheme's smaller sizes had cut them, v304. A smaller
  // size chosen in Custom still cuts them: ensureCustomSize)
  if (h === 'custom' && (state.customPal || []).length) state.palSize = state.customPal.length;
  state.palSize = Math.max(R[0], Math.min(R[1], state.palSize));
  if (h === 'photo') state.palSize = photoSnap(state.palSize);
  if (h === 'rainbow') state.palSize = rainbowSnap(state.palSize);
  palSizeFit();
  save();
  if (state.mode === 'palette') {
    if (h === 'custom') {
      ensureCustomSize();
      showCustom();
    } else if (h === 'photo') {
      if (_photoImg) applyPhotoPalette();
      else clearPalette();
    } else regenReplace();
  }
  chrome();
}
function handoff(target) {
  // (what's shown, and not the Colorless Blender alone: that had given the whole collection, v304)
  const m = shownMatches().filter((i) => !NOINK.has(i));
  if (!m.length) return;
  setPool(m);
  disarm();
  state.mode = target;
  save();
  fullRender();
}

// Palette › Photo before a photo is chosen: the card is empty and waits for one
function photoEmpty() {
  return state.mode === 'palette' && state.harmony === 'photo' && !_photoImg;
}
// what Clear would empty: the palettes (Custom: its chosen markers; Photo with no photo: nothing shown, so nothing),
// or Random's drawn markers
function clearable() {
  if (state.mode === 'palette')
    return state.harmony === 'custom'
      ? state.customPal.filter((x) => x != null).length
      : photoEmpty()
        ? 0
        : state.palettes.length;
  return state.drawn.length;
}
// Palette: a line under the Harmony choices saying what the chosen one does, in plain words
const HARM_DESC = {
  complementary: 'Colours from opposite sides of the wheel',
  analogous: 'Neighbours on the wheel',
  triadic: 'Three colours evenly spaced round the wheel',
  split: 'One colour and the two either side of its opposite',
  tetradic: 'Two pairs of opposites',
  mono: 'One colour, light to dark',
  rainbow: 'Round the rainbow from red',
  custom: 'Markers you choose: tap a slot to pick one',
  photo: 'A photo\u2019s main colours, matched to markers',
};
const harmDesc = document.createElement('div');
harmDesc.id = 'harmDesc';
harmDesc.className = 'harmdesc';
{
  // the choices and the line under them share the column right of the "Harmony" label
  const col = document.createElement('div');
  col.className = 'harmcol';
  harm.parentNode.insertBefore(col, harm);
  col.appendChild(harm);
  col.appendChild(harmDesc);
}
function harmDescSync(pal) {
  const t = pal ? HARM_DESC[state.harmony] || '' : '';
  if (harmDesc.textContent !== t) harmDesc.textContent = t;
}

// (v300) Palette held sideways on an iPad: Filters with the other settings, in the column beside the palette (it had
// been under both, below the first screen); everywhere else, and in Markers and Random, where it always was, under
// the palette. The same query as the two columns' (02-picker.css)
const PAL_SIDEQ = '(min-width: 1000px) and (orientation: landscape)';
function palFiltersPlace() {
  const fb = document.getElementById('filterBar'),
    fl = document.getElementById('filters'),
    set = document.querySelector('.palset'),
    tw = document.getElementById('trackWrap');
  if (!fb || !fl || !set || !tw) return;
  let side = false;
  try {
    side = state.mode === 'palette' && matchMedia(PAL_SIDEQ).matches;
  } catch (_) {}
  if (side && fb.parentNode !== set) set.append(fb, fl);
  else if (!side && fb.parentNode === set) tw.after(fb, fl);
}
try {
  const _pq = matchMedia(PAL_SIDEQ);
  if (_pq.addEventListener) _pq.addEventListener('change', palFiltersPlace);
  else if (_pq.addListener) _pq.addListener(palFiltersPlace);
} catch (_) {}

// (v308) Owned's "Running low · 3", while any of yours are marked (v308.2: also straight after a marker's ink is set in
// its details, setInk; it had waited for the next view change)
function lowChipSync(col) {
  const lw = $('lowWrap'),
    lc = $('lowChip'),
    lo = lowCount();
  if (!lo.n) lowOnly = false;
  const on = !!col && state.collView === 'owned' && lo.n > 0;
  if (lw) lw.style.display = on ? 'flex' : 'none';
  if (lc && on) {
    lc.textContent = (lo.dry ? 'Running low or dry' : 'Running low') + ' \u00b7 ' + lo.n;
    lc.dataset.sel = lowOnly ? '1' : '';
    lc.setAttribute('aria-pressed', String(lowOnly));
  }
}
