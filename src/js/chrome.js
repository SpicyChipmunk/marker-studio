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
        if (sb) sb.textContent = n ? n + ' markers' : 'Set up your markers';
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
        ? state.pool
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
            : COLORS[si].brand + ' ' + COLORS[si].code) + ' <span class="sx">✕</span>'
        : 'Random base';
  }
  findWrap.style.display = browse ? '' : 'none';
  findResults.style.display = browse ? '' : 'none';
  findActions.style.display = col ? 'flex' : 'none';
  ownWrap.style.display = col ? 'flex' : 'none';
  var _md = document.getElementById('mkDraw');
  if (_md) _md.style.display = col ? '' : 'none';
  var _os = document.getElementById('ownStateWrap');
  if (_os) _os.style.display = col ? 'flex' : 'none';
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
    if (_top && _md && _pw.nextElementSibling !== _md) {
      _md.parentNode.insertBefore(_pw, _md);
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
  gapSort.value = state.gapSort;
  ownHint.style.display = col ? '' : 'none';
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
          : 'Your collection. Switch to All to add more.';
  filterBar.style.display = pooled ? 'none' : '';
  filtersEl.style.display = pooled || !state.filtersOpen ? 'none' : '';
  filterBar.classList.toggle('open', state.filtersOpen && !pooled);
  filterBar.setAttribute('aria-expanded', state.filtersOpen && !pooled ? 'true' : 'false');
  filterSum.textContent = filterSummary();
  poolBar.style.display = pooled ? 'flex' : 'none';
  if (pooled) poolN.textContent = state.pool.length;
  libRow.style.display = pal || rnd ? 'flex' : 'none';
  var _ug = document.getElementById('useGuideWrap');
  if (_ug) _ug.style.display = pal && currentPaletteIdxs().length ? '' : 'none';
  saveBtn.disabled = (pal && !currentPaletteIdxs().length) || (rnd && !state.drawn.length);
  exportBtn.disabled = (rnd && !state.drawn.length) || (pal && !currentPaletteIdxs().length);
  {
    const R = HARM_RANGE[state.harmony] || [2, 6];
    [...segs.children].forEach((b) => {
      const n = +b.dataset.n;
      const okn = n >= R[0] && n <= R[1];
      b.disabled = !okn;
      b.style.display = okn ? '' : 'none';
      segOn(b, okn && n === state.palSize);
    });
    const shown = [...segs.children].filter((b) => !b.disabled).length;
    segs.style.setProperty('--segcols', shown > 7 ? Math.ceil(shown / 2) : shown);
  }
  closeNote();
  [...harm.children].forEach((b) => segOn(b, b.dataset.h === state.harmony));
  // Reset only when there's something to reset
  if (rnd || pal) {
    const has = pal
      ? state.harmony === 'custom'
        ? state.customPal.filter((x) => x != null).length
        : state.palettes.length
      : state.drawn.length;
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
    statusEl.innerHTML = '<b>' + u + '</b> drawn, <b>' + left + '</b> left in your pool';
    const bad = pooled
      ? left === 0
        ? 'Pool complete'
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
                ? 'Pool complete'
                : null;
    drawBtn.disabled = !!bad || rolling;
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
            esc(c.brand + ' ' + c.code + ' ' + c.name + ', return to pool') +
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
      : '<div class="empty">Nothing left in your pool.</div>';
  }
  {
    const _eo = $('emptyOwned'),
      _no = (pal || rnd) && !state.owned.size && !state.pool;
    if (_eo) _eo.style.display = _no ? '' : 'none';
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
  chrome();
  syncModeA11y();
  headBrands();
  if (state.mode === 'palette') {
    if (state.harmony === 'custom') showCustom();
    else {
      const p = state.palettes[state.palettes.length - 1];
      if (p && !(state.harmony === 'photo' && !_photoImg)) showPalette(p, false);
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
  if (pick < 0) return;
  const b = [...bands.children][k];
  if (!b) return;
  const cd = b.querySelector('.bcode');
  const finish = () => {
    if (state.palettes[state.palettes.length - 1] !== pal || !b.isConnected) return;
    pal[k] = pick;
    save();
    const c = COLORS[pick];
    b.style.background = c.hex;
    cd.textContent = c.code;
    cd.style.color = txt(c.hex);
    b.setAttribute('aria-label', c.brand + ' ' + c.code + ' ' + c.name + ', re-roll');
    if (!reduce) {
      b.style.animationDelay = '0ms';
      b.classList.remove('bin');
      void b.offsetWidth;
      b.classList.add('bin');
    }
    const base = COLORS[pal[0]];
    palReadout(HARM[state.harmony], base.brand + ' · ' + base.name + ' base', pal);
    setAmb(base.hex);
    closeNote();
    buzz(24);
  };
  if (reduce) {
    finish();
    return;
  }
  rolling = true;
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
    }
  };
  setTimeout(tick, delays[0]);
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
  }
}
function doGenerate() {
  if (rolling || state.harmony === 'custom') return;
  disarm();
  const pal = genPalette(state.palSize, state.harmony, paletteOpts());
  if (!pal) {
    toast(
      'Couldn\u2019t make a ' +
        state.palSize +
        '-colour palette from the markers in play \u2014 try fewer colours or loosen the filters.',
      5000,
    );
    return;
  }
  retrigger(drawBtn, 'flash');
  const commit = () => {
    state.palettes.push(pal);
    if (state.palettes.length > 24) state.palettes.shift();
    state.locked = state.locked.filter((i) => pal.includes(i));
    save();
    showPalette(pal, true);
    chrome();
    buzz(28);
  };
  if (reduce) {
    commit();
    return;
  }
  rolling = true;
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
function undo() {
  if (rolling) return;
  if (state.mode === 'palette') {
    if (!state.palettes.length) return;
    state.palettes.pop();
  } else if (state.mode === 'random') {
    if (!state.drawn.length) return;
    state.drawn.shift();
  } else return;
  save();
  fullRender();
}
function filterChanged() {
  if (state.mode === 'palette' && state.harmony !== 'custom' && state.harmony !== 'photo') regenReplace();
  else save();
  fullRender();
}
function regenReplace() {
  const pal = genPalette(state.palSize, state.harmony, paletteOpts());
  if (pal) {
    if (state.palettes.length) state.palettes.pop();
    state.palettes.push(pal);
    state.locked = state.locked.filter((i) => pal.includes(i));
    save();
    showPalette(pal, true);
  }
}
function setSize(n) {
  if (rolling || state.palSize === n) return;
  const R = HARM_RANGE[state.harmony] || [2, 6];
  if (n < R[0] || n > R[1]) return;
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
  state.palSize = Math.max(R[0], Math.min(R[1], state.palSize));
  if (h === 'photo') state.palSize = photoSnap(state.palSize);
  save();
  if (state.mode === 'palette') {
    if (h === 'custom') {
      ensureCustomSize();
      showCustom();
    } else if (h === 'photo') {
      if (_photoImg) applyPhotoPalette();
      else {
        bands.innerHTML = '';
        phint.style.display = '';
      }
    } else regenReplace();
  }
  chrome();
}
function handoff(target) {
  const m = finderMatches();
  if (!m.length) return;
  setPool(m);
  disarm();
  state.mode = target;
  save();
  fullRender();
}
