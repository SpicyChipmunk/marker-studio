(function () {
  var ov = document.getElementById('matchOverlay');
  if (!ov) return;
  var openB = document.getElementById('mkMatchBtn');
  var closeB = document.getElementById('matchClose');
  var picker = document.getElementById('matchPicker');
  var hexIn = document.getElementById('matchHex');
  var photoBtn = document.getElementById('matchPhotoBtn');
  var fileIn = document.getElementById('matchFile');
  var pWrap = document.getElementById('matchPhotoWrap');
  var cv = document.getElementById('matchCanvas');
  var eyeB = document.getElementById('matchEye');
  var res = document.getElementById('matchResult');
  var cx = cv ? cv.getContext('2d', { willReadFrequently: true }) : null;

  function rgb2hex(r, g, b) {
    return (
      '#' +
      [r, g, b]
        .map(function (x) {
          return ('0' + (x || 0).toString(16)).slice(-2);
        })
        .join('')
    );
  }
  // #3a7bd5 or 3a7bd5; the short form #f00 means #ff0000
  function normHex(v) {
    v = (v || '').trim();
    if (v.charAt(0) !== '#') v = '#' + v;
    if (/^#[0-9a-fA-F]{3}$/.test(v)) v = '#' + v[1] + v[1] + v[2] + v[2] + v[3] + v[3];
    return /^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : null;
  }
  // the words and their colour, by CIEDE2000 (colour.js matchWord)
  function word(d) {
    return matchWord(d);
  }
  function wcol(d) {
    return d < MATCH_STEPS[1][0]
      ? 'var(--ok)'
      : d < MATCH_STEPS[2][0]
        ? '#cfe6dc'
        : d < MATCH_STEPS[3][0]
          ? 'var(--warn)'
          : 'var(--sub)';
  }
  // a row's rating reads as a label, not a button: four small dots, filled by closeness (Near-exact all four, Loose
  // none), in the word's colour, before the word in muted text. The dots are decoration: the row's label says the word
  function meter(d) {
    var on = MATCH_STEPS.length;
    for (var k = 0; k < MATCH_STEPS.length; k++)
      if (d < MATCH_STEPS[k][0]) {
        on = k;
        break;
      }
    on = MATCH_STEPS.length - on;
    var h = '<span class="mqdots" aria-hidden="true" style="color:' + wcol(d) + '">';
    for (var j = 0; j < MATCH_STEPS.length; j++) h += '<i' + (j < on ? ' class="on"' : '') + '></i>';
    return h + '</span>';
  }
  var lastHex = null,
    mpick = picker ? picker.closest('.mpick') : null;
  // a new colour clears the hex field's complaint and the greyed-out result; the picker swatch stays empty until there's a colour
  function clearHexHint() {
    var h = document.getElementById('matchHexHint');
    if (h) {
      h.textContent = '';
      h.style.display = 'none';
    }
    res.style.opacity = '';
  }
  function pickEmpty(on) {
    if (mpick) mpick.classList.toggle('empty', on);
  }
  function cpText(c) {
    return (c.brand + ' ' + c.code + (c.name ? ' ' + c.name : '')).replace(/"/g, '');
  }
  var rowBt = true; // brand letters on the rows when the result or your collection mixes brands
  // (v304) Find similar: the marker it was opened from, left out of the result while its colour is the one shown
  var simFrom = null;
  function simHex() {
    return simFrom === null ? null : COLORS[simFrom].hex.toLowerCase();
  }
  // a row's word; a marker of exactly the colour Find similar came from says so (v304)
  function rword(o) {
    return simFrom !== null && COLORS[o.i].hex.toLowerCase() === simHex() ? 'Same colour' : word(o.d);
  }
  // full: another brand's marker, its brand written out (v304)
  function row(o, buy, full) {
    var c = COLORS[o.i],
      tag = rowBt && !full;
    return (
      '<div class="mrow' +
      (buy ? ' buy' : '') +
      (tag ? ' tagd' : '') +
      '" role="button" tabindex="0" data-copy="' +
      esc(cpText(c)) +
      '" title="ΔE00 ' +
      o.d.toFixed(1) +
      ' · tap to copy" aria-label="' +
      esc(cpText(c) + ', ' + rword(o) + ', copy') +
      '"><span class="msw" style="background:' +
      c.hex +
      '"></span>' +
      (tag ? '<span class="mtag" aria-hidden="true">' + bTag(c.brand) + '</span>' : '') +
      '<span class="mnm"><b>' +
      esc((full ? c.brand + ' ' : '') + c.code) +
      '</b>' +
      esc(c.name || '') +
      '</span><span class="mq">' +
      meter(o.d) +
      rword(o) +
      '</span>' +
      (buy ? '<span class="mbrk"></span>' + wishBtnHTML(mkey(o.i), 'from Match a colour', true) : '') +
      '</div>'
    );
  }
  // (v304) while a finger or the mouse is down on the result, it isn't redrawn under it: the live camera redrew it
  // about 7 times a second, and a tap on a row or + To buy was lost when its row was replaced mid-tap (about 1 press
  // in 14 worked). Nor while a row has the keyboard's focus (it went to the page when its row was replaced). The colour
  // that came meanwhile is shown once the tap is over, or the focus leaves the result.
  var resHold = false,
    heldHex = null,
    lastSig = null,
    holdT = 0;
  function keyHold() {
    var a = document.activeElement;
    if (!a || a === res || !res.contains(a)) return false;
    try {
      return a.matches(':focus-visible');
    } catch (e) {
      return false;
    }
  }
  function flushHeld() {
    if (resHold || !heldHex) return;
    var h = heldHex;
    heldHex = null;
    render(h);
  }
  function releaseHold() {
    clearTimeout(holdT);
    holdT = 0;
    resHold = false;
    flushHeld();
  }
  function dropHold() {
    clearTimeout(holdT);
    holdT = 0;
    resHold = false;
    heldHex = null;
  }
  function render(hex) {
    if (resHold || keyHold()) {
      heldHex = hex;
      return;
    }
    // (what's owned and what's dry, not just how many: swapping one marker for another, or one marked dry in
    // another tab, read again, v296)
    var _k =
      hex +
      '|' +
      simFrom +
      '|' +
      [...state.owned].join(',') +
      '|' +
      JSON.stringify(state.ink || {}) +
      '|' +
      JSON.stringify(state.buyBrands);
    if (_k === lastHex && res.innerHTML) return;
    lastHex = _k;
    var near = matchNearest(hexToLab(hex), simFrom === null ? null : { exclude: simFrom }),
      owned = near.owned,
      closer = near.buy,
      other = near.other,
      html;
    // (v304: the letters go by what you own and your brand's rows; another brand's row writes its brand out)
    rowBt = brandsMixedIn(
      owned.concat(closer).map(function (o) {
        return o.i;
      }),
    );
    // (v304) the same markers with the same words and letters as the result showing: only the colour and the ΔE00
    // tooltips change, in place, so the rows (and what VoiceOver is on) stay put
    var sig =
      [owned, closer, other]
        .map(function (l) {
          return l
            .map(function (o) {
              return o.i + ':' + rword(o);
            })
            .join(',');
        })
        .join('|') +
      '|' +
      inkOwned() +
      '|' +
      rowBt +
      '|' +
      JSON.stringify(state.buyBrands);
    if (sig === lastSig && res.querySelector('.mbest')) {
      var sw = res.querySelector('.mcmp span');
      if (sw) {
        sw.style.background = hex;
        if (owned.length) sw.style.color = txt(hex);
      }
      var cmp = res.querySelector('.mcmp');
      if (cmp && owned.length) cmp.title = cmpTitle(hex, COLORS[owned[0].i]);
      var bq = res.querySelector('.mbq');
      if (bq && owned.length) bq.title = 'ΔE00 ' + owned[0].d.toFixed(1);
      var rows = res.querySelectorAll('.mrow'),
        rest = owned.slice(1).concat(closer, other);
      for (var q = 0; q < rows.length && q < rest.length; q++)
        rows[q].title = 'ΔE00 ' + rest[q].d.toFixed(1) + ' · tap to copy';
      if (!owned.length) {
        var bb = res.querySelector('.mbbrand');
        if (bb) bb.textContent = noneLine(hex);
      }
      return;
    }
    lastSig = sig;
    var from = simFrom === null ? null : COLORS[simFrom];
    // (v304: Find similar says what it's similar to, and leaves that marker out)
    html = from ? '<div class="msimh">Similar to ' + esc(from.brand + ' ' + from.code) + '</div>' : '';
    if (owned.length) {
      var b = owned[0],
        c = COLORS[b.i],
        bw = rword(b);
      html +=
        '<div class="mbest"><div class="mcmp" title="' +
        esc(cmpTitle(hex, c)) +
        '"><span style="background:' +
        hex +
        ';color:' +
        txt(hex) +
        '"><i>' +
        esc(from ? from.code : 'You') +
        '</i></span><span style="background:' +
        c.hex +
        ';color:' +
        txt(c.hex) +
        '"><i>Marker</i></span></div>' +
        '<div class="mbinfo"><div class="mbq" style="color:' +
        wcol(b.d) +
        '" title="ΔE00 ' +
        b.d.toFixed(1) +
        '">' +
        (bw === 'Same colour' ? bw : bw + ' match') +
        '</div><div class="mbname"><b>' +
        esc(c.code) +
        '</b> ' +
        esc(c.name || '') +
        '</div><div class="mbbrand">' +
        esc(c.brand) +
        ' marker</div></div>' +
        '<button class="mcopy" data-copy="' +
        esc(cpText(c)) +
        '">Copy</button></div>';
      if (owned.length > 1)
        html +=
          '<div class="mlh">Also in your collection</div>' +
          owned
            .slice(1)
            .map(function (o) {
              return row(o);
            })
            .join('');
    } else {
      html +=
        '<div class="mbest"><div class="mcmp"><span style="background:' +
        hex +
        '"></span></div><div class="mbinfo"><div class="mbname mbnone">' +
        // (markers owned but every one marked dry is a different thing from none yet, v298)
        (inkOwned() ? 'None of your markers to use' : 'No markers in your collection yet') +
        '</div><div class="mbbrand">' +
        noneLine(hex) +
        '</div></div></div>';
    }

    if (closer.length)
      html +=
        '<div class="mlh">Closer ones you could buy' +
        // (Brands I'd buy narrowed to some brands: which, so a brand missing here isn't a puzzle, v304)
        (state.buyBrands && state.buyBrands.length < allBrands().length
          ? ' \u00b7 ' + esc(state.buyBrands.join(', '))
          : '') +
        '</div>' +
        closer
          .map(function (o) {
            return row(o, true);
          })
          .join('');
    // (v304) another brand's marker only when it's clearly closer than anything of your brands, after them
    if (other.length)
      html +=
        '<div class="mlh">Closer ' +
        (closer.length ? 'still ' : '') +
        'in ' +
        esc(COLORS[other[0].i].brand) +
        '</div>' +
        other
          .map(function (o) {
            return row(o, true, true);
          })
          .join('');
    res.innerHTML = html;
    sayBest(
      owned.length
        ? rword(owned[0]) +
            (rword(owned[0]) === 'Same colour' ? ': ' : ' match: ') +
            COLORS[owned[0].i].code +
            ' ' +
            (COLORS[owned[0].i].name || '')
        : res.textContent.replace(/\s+/g, ' ').trim(),
    );
  }
  function cmpTitle(hex, c) {
    return (
      (simFrom === null
        ? 'Your colour ' + hex.toUpperCase()
        : COLORS[simFrom].brand + ' ' + COLORS[simFrom].code) +
      ' (left) vs the marker ' +
      c.hex.toUpperCase() +
      ' (right)'
    );
  }
  function noneLine(hex) {
    return (
      'Sampled ' +
      hex.toUpperCase() +
      (inkOwned() ? ' · mark some as not dry in Markers' : ' · add your sets in Markers')
    );
  }
  // The best match, said once the colour holds still: not on every frame of a drag or of the live camera (the result
  // is redrawn each time, and was announced each time, v299)
  var sayT = 0,
    sayText = '';
  function sayBest(t) {
    sayText = t;
    clearTimeout(sayT);
    // (nothing while the camera is live: Freeze says it)
    if (_camStream && !_camFrozen) return;
    sayT = setTimeout(function () {
      if (_camStream && !_camFrozen) return;
      var el = document.getElementById('matchSay');
      if (el) el.textContent = sayText;
    }, 700);
  }
  res.addEventListener('pointerdown', function (e) {
    // (the main button only: a right-click or Ctrl-click opens a menu, and on a Mac its pointerup never comes)
    if (e.button !== 0) return;
    clearTimeout(holdT);
    resHold = true;
    // (never held longer than a long press, so a press whose end is lost can't leave the result stuck)
    holdT = setTimeout(releaseHold, 1500);
  });
  // (after the click that ends the tap; a new press on the result before then keeps it held)
  var resRelease = function () {
    if (!resHold) return;
    clearTimeout(holdT);
    holdT = setTimeout(releaseHold, 250);
  };
  document.addEventListener('pointerup', resRelease, true);
  document.addEventListener('pointercancel', resRelease, true);
  res.addEventListener('contextmenu', releaseHold);
  res.addEventListener('focusout', function () {
    setTimeout(flushHeld, 0);
  });
  // sim: Find similar's own sample; any other (a typed code, the photo, the camera) is an ordinary match again (v304)
  function sample(hex, sim) {
    hex = normHex(hex);
    if (!hex) return;
    if (!sim) simFrom = null;
    if (picker) picker.value = hex;
    if (hexIn) hexIn.value = hex;
    pickEmpty(false);
    clearHexHint();
    render(hex);
  }

  var curSrc = 'photo';
  function setSrc(k) {
    curSrc = k;
    ov.querySelectorAll('.msrc [data-src]').forEach(function (b) {
      var on = b.dataset.src === k;
      b.classList.toggle('on', on);
      // (v288: pressed buttons, one on at a time; not half a tabs pattern)
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    ov.querySelectorAll('.mpane').forEach(function (p) {
      p.style.display = p.dataset.pane === k ? '' : 'none';
    });
    if (k !== 'camera') stopCam();
    if (k !== 'photo') setPaperMode(false);
    res.style.opacity = '';
    if (!lastHex)
      res.innerHTML =
        k === 'hex' ? '<div class="mempty">Type a hex code or open the colour picker.</div>' : '';
  }
  function open() {
    openDialog(ov);
    lastHex = null;
    lastSig = null;
    simFrom = null;
    dropHold();
    res.innerHTML = '';
    clearHexHint();
    if (hexIn) hexIn.value = '';
    pickEmpty(true);
    setSrc('photo');
  }
  // open straight on a colour (a marker's "Find similar": opt.exclude, that marker, left out of the result, v304)
  window.msMatchHex = function (hex, opt) {
    open();
    setSrc('hex');
    var v = normHex(hex),
      ex = opt && COLORS[opt.exclude] ? opt.exclude : null;
    if (ex !== null && v === COLORS[ex].hex.toLowerCase()) simFrom = ex;
    if (hexIn) hexIn.value = v || hex;
    if (v) sample(v, true);
  };
  function close() {
    clearTimeout(sayT);
    dropHold();
    closeDialog(ov);
    stopCam();
    setPaperMode(false);
  }
  if (openB) openB.addEventListener('click', open);
  if (closeB) closeB.addEventListener('click', close);
  ov.addEventListener('click', function (e) {
    if (e.target === ov) close();
  });
  var _toast = document.createElement('div');
  _toast.className = 'mcopied';
  // (v304: said by screen readers too, "Copied" or that it couldn't)
  _toast.setAttribute('role', 'status');
  ov.appendChild(_toast);
  var _ttmr;
  function _showToast(m) {
    _toast.textContent = m;
    _toast.style.opacity = '1';
    clearTimeout(_ttmr);
    _ttmr = setTimeout(function () {
      _toast.style.opacity = '0';
    }, 1200);
  }
  res.addEventListener('click', function (e) {
    var rw = e.target && e.target.closest ? e.target.closest('[data-copy]') : null;
    if (!rw) return;
    var cp = rw.getAttribute('data-copy');
    if (cp) {
      Promise.resolve(copyText(cp)).then(
        function (ok) {
          _showToast(ok ? 'Copied ' + cp : 'Couldn\u2019t copy \u2014 select the code and copy it yourself.');
        },
        function () {
          _showToast('Couldn\u2019t copy \u2014 select the code and copy it yourself.');
        },
      );
    }
  });

  if (picker)
    picker.addEventListener('input', function () {
      stopCam();
      sample(picker.value);
    });
  if (hexIn) {
    hexIn.addEventListener('change', function () {
      stopCam();
      var v = normHex(hexIn.value);
      if (v) sample(v);
    });
    hexIn.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        var v = normHex(hexIn.value);
        if (v) sample(v);
      }
    });
    // while the code isn't a colour yet, say what's expected and grey out the previous result
    // (v305: a code left part-typed, "#12345", on Enter or leaving the field says so too, and while it's part-typed the
    // previous result is greyed out, not shown as if it matched)
    var hexHint = function (done) {
      var t = hexIn.value.trim(),
        ok = /^#?[0-9a-f]{6}$/i.test(t) || /^#?[0-9a-f]{3}$/i.test(t),
        bad = t.length > 0 && !ok && (done || t.replace('#', '').length >= 6 || /[^#0-9a-f]/i.test(t));
      var h = document.getElementById('matchHexHint');
      if (!h) {
        h = document.createElement('div');
        h.id = 'matchHexHint';
        h.className = 'mhexhint';
        var row = hexIn.parentNode;
        row.parentNode.insertBefore(h, row.nextSibling);
      }
      h.textContent = bad ? 'Enter 6 hex digits, e.g. #3A7BD5' : '';
      h.style.display = bad ? '' : 'none';
      res.style.opacity = t.length > 0 && !ok ? '.35' : '';
    };
    hexIn.addEventListener('change', function () {
      hexHint(true);
    });
    hexIn.addEventListener('input', function () {
      hexHint();
      if (/^#?[0-9a-f]{6}$/i.test(hexIn.value.trim())) {
        var v = normHex(hexIn.value);
        if (v) {
          stopCam();
          sample(v);
        }
      }
    });
  }

  if (photoBtn && fileIn)
    photoBtn.addEventListener('click', function () {
      stopCam();
      fileIn.click();
    });
  {
    var _pc = document.getElementById('matchPhotoChange');
    if (_pc && fileIn)
      _pc.addEventListener('click', function () {
        fileIn.value = '';
        fileIn.click();
      });
  }
  ov.querySelector('.msrc').addEventListener('click', function (e) {
    var b = e.target.closest('[data-src]');
    if (!b) return;
    var k = b.dataset.src;
    setSrc(k);
    if (k === 'camera' && !_camStream) startCam();
    if (k === 'screen') pickScreen();
    if (k === 'hex' && hexIn)
      setTimeout(function () {
        hexIn.focus();
      }, 30);
  });
  if (fileIn)
    fileIn.addEventListener('change', function () {
      var f = fileIn.files && fileIn.files[0];
      if (!f) return;
      var img = new Image();
      img.onload = function () {
        pWrap.style.display = '';
        photoBtn.style.display = 'none';
        var _ph = document.getElementById('mPhotoHint');
        if (_ph) _ph.style.display = '';
        var _rg = document.getElementById('matchRing');
        if (_rg) _rg.style.display = 'none';
        // sized to the space the photo has, not to the last photo's canvas (a tall one left it narrow, and the next
        // photo came out small)
        var dpr = Math.min(window.devicePixelRatio || 1, 3),
          cssW = pWrap.clientWidth || cv.clientWidth || 420,
          w = img.naturalWidth,
          hh = img.naturalHeight;
        var back = Math.min(Math.round(cssW * dpr), 1400),
          s = Math.min(back / w, 1);
        if (hh * s > 2200) s = 2200 / hh;
        cv.width = Math.max(1, Math.round(w * s));
        cv.height = Math.max(1, Math.round(hh * s));
        cx.imageSmoothingEnabled = true;
        cx.imageSmoothingQuality = 'high';
        // (in halving steps, so a colour read from it is the photo's, evened out, in Safari too, v296)
        drawShrunk(cx, img, cv.width, cv.height);
        URL.revokeObjectURL(img.src);
        paperReset();
        var _pr = document.getElementById('matchPaperRow');
        if (_pr) _pr.style.display = '';
      };
      img.onerror = function () {
        URL.revokeObjectURL(img.src);
        errCard(
          photoBtn.offsetParent ? photoBtn : document.getElementById('mPhotoHint'),
          'Couldn\u2019t read that image. Try a JPEG or PNG photo.',
        );
      };
      img.src = URL.createObjectURL(f);
    });
  function toSrgb(v) {
    v = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
    return Math.max(0, Math.min(255, Math.round(v * 255)));
  }
  // the canvas pixel under a point on the screen
  function canvasPt(clientX, clientY) {
    var rr = cv.getBoundingClientRect();
    var x = Math.round(((clientX - rr.left) / rr.width) * cv.width),
      y = Math.round(((clientY - rr.top) / rr.height) * cv.height);
    return [Math.max(0, Math.min(cv.width - 1, x)), Math.max(0, Math.min(cv.height - 1, y))];
  }
  // the photo as loaded: the canvas, or the copy kept while the canvas shows it with its lighting corrected
  function srcData(x0, y0, pw, ph) {
    if (!mOrig) return cx.getImageData(x0, y0, pw, ph).data;
    var out = new Uint8ClampedArray(pw * ph * 4),
      W = mOrig.width,
      yy;
    for (yy = 0; yy < ph; yy++)
      out.set(mOrig.data.subarray(((y0 + yy) * W + x0) * 4, ((y0 + yy) * W + x0 + pw) * 4), yy * pw * 4);
    return out;
  }
  // the colour of a small patch of the photo (averaged in linear light), through the lighting correction when there is one
  // (v304) the patch is the middle of the ring on screen (3 CSS px around its centre), in canvas pixels: it was 1 to 4
  // canvas pixels from the canvas's width alone. Not the whole ring: that mixed the outlines into a small area
  function sampleRad() {
    var w = cv.getBoundingClientRect().width || cv.width;
    return Math.max(1, Math.min(12, Math.round((3 * cv.width) / w)));
  }
  function sampleCanvas(x, y) {
    var rad = sampleRad();
    var x0 = Math.max(0, x - rad),
      y0 = Math.max(0, y - rad),
      pw = Math.min(rad * 2 + 1, cv.width - x0),
      ph = Math.min(rad * 2 + 1, cv.height - y0);
    try {
      var lin = patchLin(srcData(x0, y0, pw, ph), pw, ph, x - x0, y - y0, rad);
      if (!lin) return;
      var c = lightApply(mFix, toSrgb(lin[0]), toSrgb(lin[1]), toSrgb(lin[2]));
      sample(rgb2hex(c[0], c[1], c[2]));
    } catch (e) {}
  }
  function sampleAt(clientX, clientY) {
    if (!cv.width) return;
    lastPt = canvasPt(clientX, clientY);
    sampleCanvas(lastPt[0], lastPt[1]);
  }
  /* ---- Tap something white (v307; was Tap the white paper): the next tap on the photo sets the paper, and the photo (and every sample from it) is
     corrected so that the paper is white. Never automatic; a new photo starts without it. ---- */
  var paperB = document.getElementById('matchPaper'),
    lightB = document.getElementById('matchLight'),
    paperNote = document.getElementById('matchPaperNote'),
    paperMode = false,
    mFix = null,
    mOrig = null,
    lastPt = null;
  function setPaperNote(t) {
    if (paperNote) paperNote.textContent = t || '';
  }
  function setPaperMode(on) {
    paperMode = !!on;
    if (paperB) paperB.setAttribute('aria-pressed', paperMode ? 'true' : 'false');
    if (pWrap) pWrap.classList.toggle('paperpick', paperMode);
    setPaperNote(paperMode ? 'Now tap something white in the photo: the paper, or a white label.' : '');
  }
  function showFix() {
    if (lightB) lightB.style.display = mFix ? '' : 'none';
    // the photo itself shows the correction; the copy as loaded is kept for sampling the paper again and for undo
    if (mFix) {
      if (!mOrig) mOrig = cx.getImageData(0, 0, cv.width, cv.height);
      var im = new ImageData(new Uint8ClampedArray(mOrig.data), mOrig.width, mOrig.height);
      lightApplyData(mFix, im.data);
      cx.putImageData(im, 0, 0);
    } else if (mOrig) {
      cx.putImageData(mOrig, 0, 0);
      mOrig = null;
    }
    if (lastPt) sampleCanvas(lastPt[0], lastPt[1]);
  }
  function setPaper(x, y) {
    var rad = Math.max(2, Math.round(cv.width / 120)),
      x0 = Math.max(0, x - rad),
      y0 = Math.max(0, y - rad),
      pw = Math.min(x + rad + 1, cv.width) - x0,
      ph = Math.min(y + rad + 1, cv.height) - y0,
      r;
    try {
      r = paperSpot(whiteLin(srcData(x0, y0, pw, ph), pw, ph, x - x0, y - y0, rad), true);
    } catch (e) {
      return;
    }
    if (r.bad) {
      setPaperNote(r.note); // stays in the mode for another try
      return;
    }
    setPaperMode(false);
    mFix = r.fix;
    showFix();
    setPaperNote(r.note);
  }
  function paperReset() {
    setPaperMode(false);
    mFix = null;
    mOrig = null;
    lastPt = null;
    if (lightB) lightB.style.display = 'none';
  }
  if (paperB)
    paperB.addEventListener('click', function () {
      setPaperMode(!paperMode);
    });
  if (lightB)
    lightB.addEventListener('click', function () {
      mFix = null;
      showFix();
      setPaperNote('');
      if (paperB) paperB.focus();
    });
  // Escape leaves the mode before it closes the dialog
  addLayer({
    name: 'Match: tap the white paper',
    order: 110,
    isOpen: function () {
      return paperMode && ov.classList.contains('on');
    },
    close: function () {
      setPaperMode(false);
    },
  });
  var ring = document.getElementById('matchRing'),
    draggingM = false,
    rafM = 0,
    pendM = null;
  function placeRing(cxp, cyp) {
    // (v304: on the photo, where it's sampled: a drag past its edge left the ring over the black beside it)
    var cr = cv.getBoundingClientRect();
    if (cr.width && cr.height) {
      cxp = Math.max(cr.left, Math.min(cr.right - 1, cxp));
      cyp = Math.max(cr.top, Math.min(cr.bottom - 1, cyp));
    }
    if (ring) {
      var wr = pWrap.getBoundingClientRect();
      ring.style.left = cxp - wr.left + 'px';
      ring.style.top = cyp - wr.top + 'px';
      ring.style.display = '';
    }
    pendM = [cxp, cyp];
    if (!rafM)
      rafM = requestAnimationFrame(function () {
        rafM = 0;
        if (pendM) {
          sampleAt(pendM[0], pendM[1]);
          pendM = null;
        }
      });
  }
  if (cv) {
    cv.addEventListener('pointerdown', function (e) {
      if (paperMode) {
        e.preventDefault();
        if (cv.width) {
          var p = canvasPt(e.clientX, e.clientY);
          setPaper(p[0], p[1]);
        }
        return;
      }
      draggingM = true;
      try {
        cv.setPointerCapture(e.pointerId);
      } catch (_) {}
      e.preventDefault();
      placeRing(e.clientX, e.clientY);
    });
    cv.addEventListener('pointermove', function (e) {
      if (!draggingM) return;
      e.preventDefault();
      placeRing(e.clientX, e.clientY);
    });
    cv.addEventListener('pointerup', function (e) {
      draggingM = false;
      try {
        cv.releasePointerCapture(e.pointerId);
      } catch (_) {}
    });
    cv.addEventListener('pointercancel', function () {
      draggingM = false;
    });
  }
  function pickScreen() {
    if (!window.EyeDropper) return;
    try {
      new window.EyeDropper()
        .open()
        .then(function (r) {
          sample(r.sRGBHex);
        })
        .catch(function () {});
    } catch (e) {}
  }
  if (window.EyeDropper && eyeB) {
    eyeB.style.display = '';
    var _eg = document.getElementById('matchEyeGo');
    if (_eg) _eg.addEventListener('click', pickScreen);
  }
  // --- camera matching ---
  var _camStream = null,
    _camTimer = 0,
    _camBox = { x: 0.5, y: 0.5 },
    _camFrozen = false,
    _camDrag = false,
    _camRaf = 0,
    _camTrack = null,
    _torchOn = false,
    _camZoom = 1,
    _ptrs = {},
    _ringWas = null,
    _pinched = false,
    _pinchD0 = 0,
    _zoom0 = 1,
    _camOC = document.createElement('canvas'),
    _camOCx = _camOC.getContext('2d', { willReadFrequently: true });
  var camBtn = document.getElementById('matchCamBtn'),
    videoBox = document.getElementById('matchVideoBox'),
    camWrap = document.getElementById('matchCamWrap'),
    video = document.getElementById('matchVideo'),
    reticle = document.getElementById('matchReticle'),
    freezeB = document.getElementById('matchFreeze'),
    camStopB = document.getElementById('matchCamStop'),
    torchB = document.getElementById('matchTorch');
  // (v304) the frame's pixel under the ring is worked out each time from where the ring is on screen and the zoom of
  // the moment: it was kept in the video's own coordinates from the last drag, so after a pinch (or Stop and Start,
  // which goes back to 1x) the colour came from somewhere else than the ring, off the picture at 3x. Only the patch
  // is read, at the frame's own size (no shrinking of the whole frame, which Safari does without averaging), and it is
  // the middle of the ring at any zoom (8 CSS px around its centre; it was 7 pixels of a 360-wide copy, 9 to 37 CSS px).
  var _camEma = null;
  function camPatchHex(smooth) {
    var vw = video.videoWidth,
      vh = video.videoHeight;
    if (!vw || !vh) return null;
    var bx = (videoBox || video).getBoundingClientRect(),
      BW = (videoBox || video).clientWidth || bx.width || 1,
      BH = (videoBox || video).clientHeight || bx.height || 1,
      sc = Math.max(BW / vw, BH / vh),
      ux = 0.5 + (_camBox.x - 0.5) / _camZoom,
      uy = 0.5 + (_camBox.y - 0.5) / _camZoom,
      fx = (ux * BW - (BW - vw * sc) / 2) / (vw * sc),
      fy = (uy * BH - (BH - vh * sc) / 2) / (vh * sc);
    var cx = Math.max(0, Math.min(vw - 1, Math.floor(fx * vw))),
      cy = Math.max(0, Math.min(vh - 1, Math.floor(fy * vh))),
      rad = Math.max(1, Math.min(40, Math.round(8 / (sc * _camZoom)))),
      x0 = Math.max(0, cx - rad),
      y0 = Math.max(0, cy - rad),
      pw = Math.min(cx + rad + 1, vw) - x0,
      ph = Math.min(cy + rad + 1, vh) - y0;
    if (_camOC.width !== pw) _camOC.width = pw;
    if (_camOC.height !== ph) _camOC.height = ph;
    try {
      _camOCx.drawImage(video, x0, y0, pw, ph, 0, 0, pw, ph);
      var lin = patchLin(_camOCx.getImageData(0, 0, pw, ph).data, pw, ph, cx - x0, cy - y0, rad);
      if (!lin) return null;
      // (v304) live, the colour is eased over about half a second (each frame a third of the way), so the camera's
      // flicker doesn't reorder the list several times a second; a drag, a pinch or a new start reads it straight
      if (smooth && _camEma) for (var k = 0; k < 3; k++) lin[k] = _camEma[k] + (lin[k] - _camEma[k]) * 0.35;
      _camEma = lin;
      return rgb2hex(toSrgb(lin[0]), toSrgb(lin[1]), toSrgb(lin[2]));
    } catch (e) {
      return null;
    }
  }
  function camResample() {
    if (!_camRaf)
      _camRaf = requestAnimationFrame(function () {
        _camRaf = 0;
        var hex = camPatchHex();
        if (hex) sample(hex);
      });
  }
  function camTick() {
    if (_camFrozen) return;
    if (!video || video.readyState < 2) return;
    var hex = camPatchHex(true);
    if (hex) sample(hex);
  }
  // each camera request gets a number; one that finishes after the dialog closed, the tab changed or a newer request
  // started just stops its stream
  var _camReq = 0,
    _camPending = false;
  function stopCam() {
    _camReq++;
    _camPending = false;
    clearInterval(_camTimer);
    _camTimer = 0;
    _camFrozen = false;
    if (freezeB) freezeB.textContent = 'Freeze';
    if (_camTrack && _torchOn) {
      try {
        _camTrack.applyConstraints({ advanced: [{ torch: false }] }).catch(function () {});
      } catch (e) {}
    }
    _camTrack = null;
    _torchOn = false;
    if (torchB) torchB.style.display = 'none';
    _camZoom = 1;
    _camEma = null;
    _ptrs = {};
    _pinched = false;
    if (video) video.style.transform = '';
    if (_camStream) {
      try {
        _camStream.getTracks().forEach(function (t) {
          t.stop();
        });
      } catch (e) {}
      _camStream = null;
    }
    if (video) {
      try {
        video.pause();
      } catch (e) {}
      try {
        video.srcObject = null;
      } catch (e) {}
    }
    if (camWrap) camWrap.style.display = 'none';
    var _off = document.getElementById('matchCamOff');
    if (_off) _off.style.display = '';
    var _lv = document.getElementById('matchLive');
    if (_lv) {
      _lv.classList.remove('frozen');
      _lv.innerHTML = '<i></i>LIVE';
    }
  }
  function startCam() {
    if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) {
      lastHex = null;
      lastSig = null;
      res.innerHTML = '<div class="mempty">Camera isn\u2019t available on this device.</div>';
      return;
    }

    if (_camPending || _camStream) return;
    var req = ++_camReq;
    _camPending = true;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      .then(function (st) {
        if (req !== _camReq || !ov.classList.contains('on') || curSrc !== 'camera') {
          try {
            st.getTracks().forEach(function (t) {
              t.stop();
            });
          } catch (e) {}
          return;
        }
        _camPending = false;
        _camStream = st;
        video.srcObject = st;
        _camTrack = (st.getVideoTracks && st.getVideoTracks()[0]) || null;
        if (_camTrack && _camTrack.addEventListener) {
          var tr = _camTrack;
          tr.addEventListener('ended', function () {
            if (_camTrack !== tr) return;
            stopCam();
            lastHex = null;
            lastSig = null;
            res.innerHTML = '<div class="mempty">The camera stopped. Tap Start camera to go on.</div>';
          });
        }
        var _caps = _camTrack && _camTrack.getCapabilities ? _camTrack.getCapabilities() : {};
        if (torchB) {
          if (_caps && _caps.torch) {
            torchB.style.display = '';
            torchB.textContent = 'Light';
            _torchOn = false;
          } else torchB.style.display = 'none';
        }
        _camFrozen = false;
        if (freezeB) freezeB.textContent = 'Freeze';
        var p = video.play();
        if (p && p.catch) p.catch(function () {});
        camWrap.style.display = '';
        {
          var _off = document.getElementById('matchCamOff');
          if (_off) _off.style.display = 'none';
        }
        if (reticle) reticle.style.display = '';
        _camZoom = 1;
        _ptrs = {};
        _pinched = false;
        if (video) video.style.transform = '';
        clearInterval(_camTimer);
        _camTimer = setInterval(camTick, 140);
      })
      .catch(function (err) {
        if (req !== _camReq) return;
        _camPending = false;
        if (camWrap) camWrap.style.display = 'none';
        lastHex = null;
        lastSig = null;
        res.innerHTML =
          '<div class="mempty">Couldn\u2019t open the camera' +
          (err && err.name === 'NotAllowedError' ? ' \u2014 permission was denied.' : '.') +
          '</div>';
      });
  }
  function moveReticle(clientX, clientY) {
    var r = (videoBox || video).getBoundingClientRect();
    if (!r.width || !r.height) return;
    var sx = Math.max(0, Math.min(1, (clientX - r.left) / r.width)),
      sy = Math.max(0, Math.min(1, (clientY - r.top) / r.height));
    if (reticle) {
      reticle.style.left = sx * 100 + '%';
      reticle.style.top = sy * 100 + '%';
    }
    _camBox.x = sx;
    _camBox.y = sy;
    camResample();
  }
  if (camBtn && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    camBtn.style.display = '';
  }
  {
    var _co = document.getElementById('matchCamOff');
    if (_co)
      _co.addEventListener('click', function () {
        // (a request that never answered, e.g. its question put away with the app: ask again)
        if (_camPending) stopCam();
        startCam();
      });
  }
  // (v304) the camera stops when the page is put away (another app, the lock screen, another tab): Safari stops
  // sending frames, and the last frame (or a black one) was matched as LIVE until Stop and Start
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'hidden') return;
    if (_camStream || _camPending) stopCam();
    releaseHold();
  });
  if (freezeB)
    freezeB.addEventListener('click', function () {
      _camFrozen = !_camFrozen;
      freezeB.textContent = _camFrozen ? 'Go live' : 'Freeze';
      var _lv = document.getElementById('matchLive');
      if (_lv) {
        _lv.classList.toggle('frozen', _camFrozen);
        _lv.innerHTML = '<i></i>' + (_camFrozen ? 'FROZEN' : 'LIVE');
      }
      if (_camFrozen) {
        sayBest(sayText);
        try {
          video.pause();
        } catch (e) {}
      } else {
        var p = video.play();
        if (p && p.catch) p.catch(function () {});
      }
    });
  if (camStopB) camStopB.addEventListener('click', stopCam);
  if (torchB)
    torchB.addEventListener('click', function () {
      if (!_camTrack) return;
      var want = !_torchOn,
        tr = _camTrack;
      tr.applyConstraints({ advanced: [{ torch: want }] }).then(
        function () {
          if (_camTrack !== tr) return;
          _torchOn = want;
          torchB.textContent = want ? 'Light on' : 'Light';
        },
        function () {},
      );
    });
  function ptrDist() {
    var k = Object.keys(_ptrs);
    if (k.length < 2) return 0;
    var a = _ptrs[k[0]],
      b = _ptrs[k[1]];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }
  function setZoom(z) {
    _camZoom = Math.max(1, Math.min(4, z));
    if (video) video.style.transform = _camZoom > 1.005 ? 'scale(' + _camZoom + ')' : '';
    // (read again straight away, live or frozen: the live reading eased from the spot before the zoom, v304)
    camResample();
  }
  if (video) {
    var _endP = function (e) {
      delete _ptrs[e.pointerId];
      try {
        video.releasePointerCapture(e.pointerId);
      } catch (_) {}
      var k = Object.keys(_ptrs);
      if (k.length < 2) _pinchD0 = 0;
      // (the finger left after a pinch doesn't drag the ring)
      if (!k.length) _pinched = false;
      _camDrag = k.length === 1 && !_pinched;
    };
    video.addEventListener('pointerdown', function (e) {
      _ptrs[e.pointerId] = { x: e.clientX, y: e.clientY };
      try {
        video.setPointerCapture(e.pointerId);
      } catch (_) {}
      e.preventDefault();
      var k = Object.keys(_ptrs);
      if (k.length === 1) {
        _camDrag = true;
        _ringWas = { x: _camBox.x, y: _camBox.y };
        moveReticle(e.clientX, e.clientY);
      } else if (k.length === 2) {
        // (v304) a pinch, not a tap: the ring goes back to where it was before the first finger moved it there
        if (_ringWas && !_pinched) {
          var r = (videoBox || video).getBoundingClientRect();
          moveReticle(r.left + _ringWas.x * r.width, r.top + _ringWas.y * r.height);
        }
        _pinched = true;
        _camDrag = false;
        _pinchD0 = ptrDist();
        _zoom0 = _camZoom;
      }
    });
    video.addEventListener('pointermove', function (e) {
      if (!(e.pointerId in _ptrs)) return;
      _ptrs[e.pointerId] = { x: e.clientX, y: e.clientY };
      e.preventDefault();
      var k = Object.keys(_ptrs);
      if (k.length >= 2) {
        var d = ptrDist();
        if (_pinchD0 > 0) setZoom((_zoom0 * d) / _pinchD0);
      } else if (_camDrag) {
        moveReticle(e.clientX, e.clientY);
      }
    });
    video.addEventListener('pointerup', _endP);
    video.addEventListener('pointercancel', _endP);
  }
})();
