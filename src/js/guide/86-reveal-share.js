function computeRevOrder() {
  revOrder = new Float32Array(comps.length);
  var mx = W + H || 1;
  for (var l = 1; l < comps.length; l++) {
    var c = comps[l];
    revOrder[l] = c ? (c.cx + c.cy) / mx : 0;
  }
}
function revFrame() {
  if (revCv && revCtx) {
    try {
      revCtx.imageSmoothingEnabled = true;
      revCtx.drawImage(cv, 0, 0, revCv.width, revCv.height);
    } catch (e) {}
  }
}
function startRevRec() {
  stopRevRec();
  revRec = null;
  revBlob = null;
  revChunks = [];
  revMime = '';
  try {
    if (!cv.captureStream || typeof MediaRecorder === 'undefined') return false;
    var _rs = Math.min(1, 1080 / Math.max(cv.width, cv.height));
    revCv = document.createElement('canvas');
    revCv.width = Math.max(2, Math.round(cv.width * _rs)) & ~1;
    revCv.height = Math.max(2, Math.round(cv.height * _rs)) & ~1;
    revCtx = revCv.getContext('2d');
    if (!revCv.captureStream) return false;
    revFrame();
    var stream = revCv.captureStream(30);
    var cands = [
      'video/mp4;codecs=avc1.42E01E',
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
    ];
    for (var i = 0; i < cands.length; i++) {
      if (MediaRecorder.isTypeSupported(cands[i])) {
        revMime = cands[i];
        break;
      }
    }
    if (!revMime) return false;
    // (a recorder stopped by Close or Replay can still send its last data and stop late: only the current one counts,
    // and its capture stream ends with it)
    var rec = new MediaRecorder(stream, { mimeType: revMime, videoBitsPerSecond: 8000000 });
    revRec = rec;
    rec.ondataavailable = function (e) {
      if (rec === revRec && e.data && e.data.size) revChunks.push(e.data);
    };
    rec.onstop = function () {
      try {
        stream.getTracks().forEach(function (t) {
          t.stop();
        });
      } catch (_) {}
      if (rec !== revRec) return;
      try {
        revBlob = new Blob(revChunks, { type: revMime });
      } catch (e) {
        revBlob = null;
      }
      var b = document.getElementById('sfRevealBar');
      if (b && b.getAttribute('data-mode') === 'done') showRevealBar('done');
    };
    revRec.start();
    return true;
  } catch (e) {
    revRec = null;
    revMime = '';
    return false;
  }
}
function stopRevRec() {
  try {
    if (revRec && revRec.state && revRec.state !== 'inactive') revRec.stop();
  } catch (e) {}
}
function revBarEl() {
  var b = document.getElementById('sfRevealBar');
  if (!b) {
    b = document.createElement('div');
    b.id = 'sfRevealBar';
    b.className = 'sfrevbar';
    document.body.appendChild(b);
  }
  return b;
}
function showRevealBar(mode) {
  var b = revBarEl();
  b.style.display = 'flex';
  revCloseEl();
  b.setAttribute('data-mode', mode);
  if (mode === 'anim') {
    b.innerHTML = '<div class="rvmsg">Revealing\u2026</div>';
  } else {
    var clip = revMime && revBlob ? '<button id="revClip">Save clip</button>' : '';
    b.innerHTML =
      '<button id="revShare" class="rvmain">Share</button>' +
      clip +
      // (v288: one way to close, the ✕ at the top left, as in Focus mode; Escape too)
      '<button id="revReplay">Replay</button>';
    var _s = document.getElementById('revShare');
    if (_s) _s.addEventListener('click', shareCard);
    var _c = document.getElementById('revClip');
    if (_c) _c.addEventListener('click', downloadClip);
    var _r = document.getElementById('revReplay');
    if (_r)
      _r.addEventListener('click', function () {
        playRevealAnim();
      });
    // (the keyboard comes into the bar: its buttons are all there is on screen)
    if (_s && !b.contains(document.activeElement))
      try {
        _s.focus({ preventScroll: true });
      } catch (_) {}
  }
  revFitBar();
}
function hideRevealBar() {
  var b = document.getElementById('sfRevealBar');
  if (b) b.style.display = 'none';
  var x = document.getElementById('sfRevX');
  if (x) x.style.display = 'none';
}
// the picture leaves room for the bar (its height changes when the clip button appears or buttons wrap)
function revFitBar() {
  var b = document.getElementById('sfRevealBar');
  if (b) document.documentElement.style.setProperty('--revBot', b.offsetHeight + 'px');
}
function revCloseEl() {
  var x = document.getElementById('sfRevX');
  if (!x) {
    x = document.createElement('button');
    x.id = 'sfRevX';
    x.className = 'sfrevx';
    x.setAttribute('aria-label', 'Close');
    x.innerHTML = ic('x');
    x.addEventListener('click', endReveal);
    document.body.appendChild(x);
  }
  x.style.display = '';
}
function revFlash() {
  try {
    var f = document.createElement('div');
    f.className = 'sfrevflash';
    document.body.appendChild(f);
    setTimeout(function () {
      if (f.parentNode) f.parentNode.removeChild(f);
    }, 640);
  } catch (e) {}
}
function playRevealAnim() {
  if (!assignData) return;
  computeRevOrder();
  showRevealBar('anim');
  startRevRec();
  var t0 = performance.now(),
    DUR = 3400,
    HOLD = 900;
  revealF = 0;
  renderGuide();
  if (revRAF) cancelAnimationFrame(revRAF);
  function step(now) {
    var e = now - t0;
    if (e < DUR) {
      var f = e / DUR;
      revealF = f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;
      renderGuide();
      revFrame();
      revRAF = requestAnimationFrame(step);
    } else if (e < DUR + HOLD) {
      revealF = 1;
      renderGuide();
      revFrame();
      revRAF = requestAnimationFrame(step);
    } else {
      revRAF = 0;
      revealF = 1;
      renderGuide();
      revFrame();
      revFlash();
      stopRevRec();
      setTimeout(function () {
        if (root.classList.contains('sfrev')) showRevealBar('done');
      }, 280);
    }
  }
  revRAF = requestAnimationFrame(step);
}
// the button that opened Reveal, where the keyboard goes back to when it closes
var _revOp = null,
  _revInert = [];
// (v287) while Reveal is open the page behind it is inert: Tab stays on its picture, bar and ✕ (as in Focus mode)
function revModal(on) {
  _revInert.forEach(function (el) {
    el.inert = false;
  });
  _revInert = [];
  if (!on || !sfView) return;
  var keep = [sfView, revBarEl(), document.getElementById('sfRevX')].filter(Boolean);
  keep.forEach(function (k) {
    for (var n = k; n && n !== document.body && n.parentElement; n = n.parentElement) {
      [].forEach.call(n.parentElement.children, function (c) {
        if (
          c.inert ||
          keep.some(function (x) {
            return c === x || c.contains(x);
          }) ||
          /^(SCRIPT|STYLE|LINK)$/.test(c.tagName) ||
          c.classList.contains('overlay') ||
          c.id === 'msToast' ||
          c.id === 'sfLive'
        )
          return;
        c.inert = true;
        _revInert.push(c);
      });
    }
  });
}
function startReveal() {
  if (!assignData) return;
  _revOp = document.activeElement;
  hideTip();
  exitFull();
  closeSwatchPop(false);
  closeSheet();
  hideToast();
  holdScroll();
  resetZoom();
  var rt = document.getElementById('sfRoot');
  if (rt) rt.classList.add('sfrev');
  revCloseEl();
  revModal(true);
  requestAnimationFrame(function () {
    playRevealAnim();
  });
}
function endReveal() {
  if (revRAF) cancelAnimationFrame(revRAF);
  revRAF = 0;
  revealF = null;
  revOrder = null;
  stopRevRec();
  revRec = null;
  revBlob = null;
  revChunks = [];
  var rt = document.getElementById('sfRoot');
  if (rt) rt.classList.remove('sfrev');
  revModal(false);
  hideRevealBar();
  // (from leave(), the guide going off screen: nothing to draw or focus there)
  if (sfmode === 'guide' || sfmode === 'color') renderGuide();
  backScroll();
  var op =
    _revOp && _revOp.isConnected && _revOp.offsetParent !== null
      ? _revOp
      : document.getElementById('sfReveal');
  _revOp = null;
  if (op && op !== document.body && root.style.display !== 'none')
    try {
      op.focus({ preventScroll: true });
    } catch (_) {}
}
function distinctMk() {
  var seen = {},
    arr = [];
  assignData.order.forEach(function (l) {
    var m = assignData.assign[l];
    if (m && !seen[m.mkey]) {
      seen[m.mkey] = 1;
      arr.push(m);
    }
  });
  return arr;
}
function rrect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
function buildShareCard() {
  if (!assignData) return null;
  var CW = 1080,
    pad = 44,
    gW = CW - 2 * pad,
    gH = Math.round((gW * H) / W),
    hasName = !!curName,
    headerH = hasName ? 86 : 16,
    mk = distinctMk(),
    one = brandLine(
      mk.map(function (m) {
        return m.brand;
      }),
    ),
    chipW = 104,
    perRow = Math.max(1, Math.floor((CW - 2 * pad) / chipW)),
    shown = Math.min(mk.length, 24),
    rows = Math.ceil(shown / perRow),
    chipsH = shown ? rows * 44 + 18 : 0,
    footH = 44,
    CH = pad + headerH + gH + chipsH + footH + pad;
  var c = document.createElement('canvas');
  c.width = CW;
  c.height = CH;
  var g = c.getContext('2d');
  g.fillStyle = '#14110f';
  g.fillRect(0, 0, CW, CH);
  var y = pad;
  if (hasName) {
    g.fillStyle = '#f0ece6';
    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
    g.font = '600 40px "Hanken Grotesk",system-ui,sans-serif';
    g.fillText(curName.slice(0, 42), pad, y + 46);
  }
  y += headerH;
  g.save();
  rrect(g, pad, y, gW, gH, 16);
  g.clip();
  g.imageSmoothingEnabled = true;
  g.drawImage(cv, pad, y, gW, gH);
  g.restore();
  g.strokeStyle = 'rgba(255,255,255,.1)';
  g.lineWidth = 1.5;
  rrect(g, pad, y, gW, gH, 16);
  g.stroke();
  y += gH + 18;
  var cx = pad,
    cy = y;
  for (var i = 0; i < shown; i++) {
    var m = mk[i];
    if (cx + chipW > CW - pad + 1) {
      cx = pad;
      cy += 44;
    }
    g.fillStyle = m.hex;
    rrect(g, cx, cy, 26, 26, 6);
    g.fill();
    g.strokeStyle = 'rgba(255,255,255,.28)';
    g.lineWidth = 1;
    rrect(g, cx, cy, 26, 26, 6);
    g.stroke();
    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
    g.fillStyle = '#c8cdd0';
    g.font = '600 18px system-ui';
    g.fillText(m.code, cx + 34, cy + 12);
    if (!one) {
      g.font = '600 12px system-ui';
      g.fillStyle = '#828b91';
      g.fillText(bTag(m.brand), cx + 34, cy + 26);
    }
    cx += chipW;
  }
  g.fillStyle = '#7f8a90';
  g.font = '500 24px system-ui';
  g.textAlign = 'left';
  g.fillText('Made with Marker Studio', pad, CH - pad + 6);
  // the brand, said once (one brand) or as the letter key for the chips' letters
  g.textAlign = 'right';
  g.fillStyle = '#828b91';
  g.font = '500 20px system-ui';
  g.fillText(one || brandKey().replace(/\s{2,}/g, '   '), CW - pad, CH - pad + 6);
  g.textAlign = 'left';
  return c;
}
function shareCard() {
  var card = buildShareCard();
  if (!card) return;
  card.toBlob(function (blob) {
    if (!blob) {
      note('Couldn’t make the image.');
      return;
    }
    shareOrSave(blob, 'marker-studio-card.png', curName || 'My colouring', 'image', 'Image downloaded.');
  }, 'image/png');
}
function downloadClip() {
  if (!revBlob) return;
  handOver(revBlob, 'marker-studio-reveal.' + (revMime.indexOf('mp4') >= 0 ? 'mp4' : 'webm'), {
    preferShare: false,
  });
}
