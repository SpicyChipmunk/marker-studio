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
  function row(o, buy) {
    var c = COLORS[o.i];
    return (
      '<div class="mrow' +
      (buy ? ' buy' : '') +
      (rowBt ? ' tagd' : '') +
      '" role="button" tabindex="0" data-copy="' +
      esc(cpText(c)) +
      '" title="ΔE00 ' +
      o.d.toFixed(1) +
      ' · tap to copy" aria-label="' +
      esc(cpText(c) + ', ' + word(o.d) + ', copy') +
      '"><span class="msw" style="background:' +
      c.hex +
      '"></span>' +
      (rowBt ? '<span class="mtag" aria-hidden="true">' + bTag(c.brand) + '</span>' : '') +
      '<span class="mnm"><b>' +
      esc(c.code) +
      '</b>' +
      esc(c.name || '') +
      '</span><span class="mq">' +
      meter(o.d) +
      word(o.d) +
      '</span>' +
      (buy ? '<span class="mbrk"></span>' + wishBtnHTML(mkey(o.i), 'from Match a colour', true) : '') +
      '</div>'
    );
  }
  function render(hex) {
    var _k = hex + '|' + state.owned.size;
    if (_k === lastHex && res.innerHTML) return;
    lastHex = _k;
    var near = matchNearest(hexToLab(hex)),
      owned = near.owned,
      closer = near.buy,
      html;
    rowBt = brandsMixedIn(
      owned.concat(closer).map(function (o) {
        return o.i;
      }),
    );
    if (owned.length) {
      var b = owned[0],
        c = COLORS[b.i];
      html =
        '<div class="mbest"><div class="mcmp" title="Your colour ' +
        hex.toUpperCase() +
        ' (left) vs the marker ' +
        c.hex.toUpperCase() +
        ' (right)"><span style="background:' +
        hex +
        ';color:' +
        txt(hex) +
        '"><i>You</i></span><span style="background:' +
        c.hex +
        ';color:' +
        txt(c.hex) +
        '"><i>Marker</i></span></div>' +
        '<div class="mbinfo"><div class="mbq" style="color:' +
        wcol(b.d) +
        '" title="ΔE00 ' +
        b.d.toFixed(1) +
        '">' +
        word(b.d) +
        ' match</div><div class="mbname"><b>' +
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
      html =
        '<div class="mbest"><div class="mcmp"><span style="background:' +
        hex +
        '"></span></div><div class="mbinfo"><div class="mbname mbnone">No markers in your collection yet</div><div class="mbbrand">Sampled ' +
        hex.toUpperCase() +
        ' · add your sets in Markers</div></div></div>';
    }

    if (closer.length)
      html +=
        '<div class="mlh">Closer ones you could buy</div>' +
        closer
          .map(function (o) {
            return row(o, true);
          })
          .join('');
    res.innerHTML = html;
  }
  function sample(hex) {
    hex = normHex(hex);
    if (!hex) return;
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
    res.innerHTML = '';
    clearHexHint();
    if (hexIn) hexIn.value = '';
    pickEmpty(true);
    setSrc('photo');
  }
  // open straight on a colour (a marker's "Find similar")
  window.msMatchHex = function (hex) {
    open();
    setSrc('hex');
    var v = normHex(hex);
    if (hexIn) hexIn.value = v || hex;
    if (v) sample(v);
  };
  function close() {
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
      try {
        copyText(cp);
      } catch (_) {}
      _showToast('Copied ' + cp);
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
    var hexHint = function () {
      var t = hexIn.value.trim(),
        ok = /^#?[0-9a-f]{6}$/i.test(t) || /^#?[0-9a-f]{3}$/i.test(t),
        bad = t.length > 0 && !ok && (t.replace('#', '').length >= 6 || /[^#0-9a-f]/i.test(t));
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
      res.style.opacity = bad ? '.35' : '';
    };
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
        cx.drawImage(img, 0, 0, cv.width, cv.height);
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
  function toLin(v) {
    v /= 255;
    return v > 0.04045 ? Math.pow((v + 0.055) / 1.055, 2.4) : v / 12.92;
  }
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
  function sampleCanvas(x, y) {
    var rad = Math.max(1, Math.min(4, Math.round(cv.width / 240)));
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
  /* ---- Tap the white paper: the next tap on the photo sets the paper, and the photo (and every sample from it) is
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
    setPaperNote(paperMode ? 'Now tap a plain white part of the paper in the photo.' : '');
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
      r = paperSpot(patchLin(srcData(x0, y0, pw, ph), pw, ph, x - x0, y - y0, rad));
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
    _camPt = { x: 0.5, y: 0.5 },
    _camFrozen = false,
    _camDrag = false,
    _camRaf = 0,
    _camTrack = null,
    _torchOn = false,
    _camZoom = 1,
    _ptrs = {},
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
  function camPatchHex() {
    var vw = video.videoWidth,
      vh = video.videoHeight;
    if (!vw || !vh) return null;
    var w = Math.min(360, vw),
      s = w / vw,
      hh = Math.max(1, Math.round(vh * s));
    _camOC.width = w;
    _camOC.height = hh;
    try {
      _camOCx.drawImage(video, 0, 0, w, hh);
    } catch (e) {
      return null;
    }
    var bx = (videoBox || video).getBoundingClientRect(),
      BW = (videoBox || video).clientWidth || bx.width || 1,
      BH = (videoBox || video).clientHeight || bx.height || 1,
      sc = Math.max(BW / vw, BH / vh),
      fx = (_camPt.x * BW - (BW - vw * sc) / 2) / (vw * sc),
      fy = (_camPt.y * BH - (BH - vh * sc) / 2) / (vh * sc);
    var cx = Math.max(0, Math.min(w - 1, Math.round(fx * w))),
      cy = Math.max(0, Math.min(hh - 1, Math.round(fy * hh)));
    var rad = 3,
      x0 = Math.max(0, cx - rad),
      y0 = Math.max(0, cy - rad),
      pw = Math.min(rad * 2 + 1, w - x0),
      ph = Math.min(rad * 2 + 1, hh - y0);
    try {
      var d = _camOCx.getImageData(x0, y0, pw, ph).data,
        rl = 0,
        gl = 0,
        bl = 0,
        n = 0,
        i;
      for (i = 0; i < d.length; i += 4) {
        if (d[i + 3] === 0) continue;
        rl += toLin(d[i]);
        gl += toLin(d[i + 1]);
        bl += toLin(d[i + 2]);
        n++;
      }
      if (!n) return null;
      return rgb2hex(toSrgb(rl / n), toSrgb(gl / n), toSrgb(bl / n));
    } catch (e) {
      return null;
    }
  }
  function camTick() {
    if (_camFrozen) return;
    if (!video || video.readyState < 2) return;
    var hex = camPatchHex();
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
    _ptrs = {};
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
        if (video) video.style.transform = '';
        clearInterval(_camTimer);
        _camTimer = setInterval(camTick, 140);
      })
      .catch(function (err) {
        if (req !== _camReq) return;
        _camPending = false;
        if (camWrap) camWrap.style.display = 'none';
        lastHex = null;
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
    _camPt.x = Math.max(0, Math.min(1, 0.5 + (sx - 0.5) / _camZoom));
    _camPt.y = Math.max(0, Math.min(1, 0.5 + (sy - 0.5) / _camZoom));
    if (!_camRaf)
      _camRaf = requestAnimationFrame(function () {
        _camRaf = 0;
        var hex = camPatchHex();
        if (hex) sample(hex);
      });
  }
  if (camBtn && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    camBtn.style.display = '';
  }
  {
    var _co = document.getElementById('matchCamOff');
    if (_co) _co.addEventListener('click', startCam);
  }
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
      _torchOn = !_torchOn;
      _camTrack.applyConstraints({ advanced: [{ torch: _torchOn }] }).catch(function () {
        _torchOn = !_torchOn;
      });
      torchB.textContent = _torchOn ? 'Light on' : 'Light';
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
  }
  if (video) {
    var _endP = function (e) {
      delete _ptrs[e.pointerId];
      try {
        video.releasePointerCapture(e.pointerId);
      } catch (_) {}
      var k = Object.keys(_ptrs);
      if (k.length < 2) _pinchD0 = 0;
      _camDrag = k.length === 1;
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
        moveReticle(e.clientX, e.clientY);
      } else if (k.length === 2) {
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
