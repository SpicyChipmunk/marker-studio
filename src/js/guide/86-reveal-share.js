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
    // (v309.2) the keyboard on the ✕ while it plays (it had been on the page: Tab started behind Reveal); Share takes
    // it at the end, as before
    var x = document.getElementById('sfRevX');
    if (x && document.activeElement !== x)
      try {
        x.focus({ preventScroll: true });
      } catch (_) {}
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
    x.addEventListener('click', function () {
      revClose();
    });
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
  // (Replay: the celebration goes, the picture plays again)
  showEnd();
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
      // the piece lifts onto its paper, with its title and markers (89-show.js)
      showStart();
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
  _revCol = null;
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
  // (v309.2: the keyboard on the ✕ at once, as the button that opened Reveal goes inert behind it; Share takes it at
  // the end)
  var rx = document.getElementById('sfRevX');
  if (rx)
    try {
      rx.focus({ preventScroll: true });
    } catch (_) {}
  requestAnimationFrame(function () {
    // (v308: not if it was closed before this frame: Escape straight away left the show up over the guide)
    if (rt && !rt.classList.contains('sfrev')) return;
    playRevealAnim();
  });
}
// Reveal closed by its ✕, Escape or Back: back to Colour along when it was opened from there (v308), its Page finished
// panel in view; otherwise where it was opened from
function revClose() {
  const back = _revCol;
  _revCol = null;
  endReveal();
  if (!back || !assignData || sfmode !== 'guide' || !root || root.style.display === 'none') return;
  gTab = back.tab;
  enterColor();
  doneAfterFocus();
  const b = document.getElementById('sfAlongRev');
  if (b && b.offsetParent !== null)
    try {
      b.focus({ preventScroll: true });
    } catch (_) {}
}
function endReveal() {
  _revCol = null;
  showEnd();
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
// (the shared image, its layout and Reveal's celebration: 89-show.js)
function downloadClip() {
  if (!revBlob) return;
  // (v310.1: named after the guide, as Save image and the PDF are)
  handOver(
    revBlob,
    fileSlug(curName, 'colour-guide', 80).toLowerCase() +
      '-reveal.' +
      (revMime.indexOf('mp4') >= 0 ? 'mp4' : 'webm'),
    {
      preferShare: false,
    },
  );
}
