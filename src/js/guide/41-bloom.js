/* ---- Build bloom (v305): the first look at a new guide ----
   On the first Build of a new picture the line art shows, then the plan's colours flood out from where the gradient
   starts (out from its centre for Radial, or for a pattern with no direction; along the flow otherwise: down the rows,
   across, or corner to corner, the way Direction turns it), and the codes fade in on top. About 1.2 s. It's drawn on a
   canvas of its own over the picture, at the size it's shown (the picture's own pixels are right underneath all along,
   so a tap during it lands on the guide as usual: it ends the bloom and still reaches what was tapped). Not on Build
   again, Edit sections, a guide opened again or the sample; not with reduced motion; not in the browser tests unless a
   test asks for it (window.__MS_BLOOM). */
const BLOOM_FLOOD = 900,
  BLOOM_FADE = 300;
let _bloom = null,
  bloomCount = 0,
  // (the last one's setting-up time and frame times, for the tests)
  bloomLast = null;
// A device that can't draw it smoothly doesn't get it: when setting up takes too long or the first frames come slowly,
// the bloom ends there (the guide shows as usual) and stays off until the app is next launched (v308: it had stayed off
// for good, so one busy moment meant never seeing it again; a launch checks again). (In the browser tests only when a
// test asks: a test machine's speed says nothing about an iPad's.)
const BLOOM_SLOW_KEY = 'ms-bloom-slow';
// (kept for this launch: a reload in the same tab is the same launch, a new one starts afresh)
function bloomSlow() {
  try {
    sessionStorage.setItem(BLOOM_SLOW_KEY, '1');
  } catch (_) {}
}
// (v308) the lasting "too slow" an earlier version kept is let go, so it's checked again
try {
  localStorage.removeItem(BLOOM_SLOW_KEY);
} catch (_) {}
function bloomWanted() {
  if (window.__MS_TEST && !window.__MS_BLOOM) return false;
  try {
    if (sessionStorage.getItem(BLOOM_SLOW_KEY) === '1') return false;
  } catch (_) {}
  return !reducedMotion();
}
// where the flood starts and how it grows, in the overlay's pixels (dw × dh): a shape for how far along it is (0–1)
function bloomShape(dw, dh) {
  const dirn = dir < 0 ? -1 : 1;
  if (family === 'gradient' && gradShape === 'vertical')
    return function (g, e) {
      const x = e * dw;
      if (dirn > 0) g.rect(0, 0, x, dh);
      else g.rect(dw - x, 0, x, dh);
    };
  if (family === 'gradient' && gradShape === 'diagonal')
    return function (g, e) {
      const d = e * (dw + dh);
      // (x + y < d from the top left; the other way from the bottom right)
      if (dirn > 0) {
        g.moveTo(0, 0);
        g.lineTo(d, 0);
        g.lineTo(0, d);
      } else {
        g.moveTo(dw, dh);
        g.lineTo(dw - d, dh);
        g.lineTo(dw, dh - d);
      }
      g.closePath();
    };
  if (family === 'gradient' && gradShape === 'serpentine')
    return function (g, e) {
      const y = e * dh;
      if (dirn > 0) g.rect(0, 0, dw, y);
      else g.rect(0, dh - y, dw, y);
    };
  // Around: a sweep round the centre like a clock hand, clockwise from the top (Direction turned: anticlockwise)
  if (family === 'gradient' && gradShape === 'around' && W && H) {
    const ac = radCentre(),
      ax = (ac.x / W) * dw,
      ay = (ac.y / H) * dh,
      AR = Math.hypot(Math.max(ax, dw - ax), Math.max(ay, dh - ay)) + 2;
    return function (g, e) {
      const a0 = -Math.PI / 2,
        a1 = a0 + dirn * e * 2 * Math.PI;
      g.moveTo(ax, ay);
      g.arc(ax, ay, AR, a0, a1, dirn < 0);
      g.closePath();
    };
  }
  // Radial (and shapes round a centre), or a pattern with no direction: from the centre out (Direction turned: in)
  const rc = family === 'gradient' && W && H ? radCentre() : { x: W / 2, y: H / 2 },
    cx = (rc.x / W) * dw,
    cy = (rc.y / H) * dh,
    R = Math.hypot(Math.max(cx, dw - cx), Math.max(cy, dh - cy)),
    inward = family === 'gradient' && dirn < 0;
  return function (g, e) {
    if (inward) {
      g.rect(0, 0, dw, dh);
      g.moveTo(cx + R * (1 - e), cy);
      g.arc(cx, cy, Math.max(0, R * (1 - e)), 0, 6.2832, true);
    } else g.arc(cx, cy, e * R, 0, 6.2832);
  };
}
function bloomStart() {
  bloomEnd(true);
  if (!bloomWanted() || !assignData || !imgData || !cv || !cv.parentNode) return false;
  const cw = cv.offsetWidth,
    ch = cv.offsetHeight;
  if (cw < 20 || ch < 20) return false;
  const t0 = performance.now(),
    k = Math.min(1.5, window.devicePixelRatio || 1),
    dw = Math.max(1, Math.round(cw * k)),
    dh = Math.max(1, Math.round(ch * k));
  // the clean picture: the guide's own drawing without its codes (imgData: what renderGuide puts down before the
  // codes go on), at the size it's shown
  const clean = document.createElement('canvas');
  clean.width = dw;
  clean.height = dh;
  {
    const full = document.createElement('canvas');
    full.width = W;
    full.height = H;
    full.getContext('2d').putImageData(imgData, 0, 0);
    const g = clean.getContext('2d');
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(full, 0, 0, W, H, 0, 0, dw, dh);
    freeCanvas(full);
  }
  // the line art alone, on the paper
  const la = document.createElement('canvas');
  la.width = dw;
  la.height = dh;
  {
    const g = la.getContext('2d'),
      im = g.createImageData(dw, dh),
      u = new Uint32Array(im.data.buffer),
      le = new Uint8Array(new Uint32Array([0x01020304]).buffer)[0] === 4,
      pack = function (c) {
        return le
          ? ((255 << 24) | (c[2] << 16) | (c[1] << 8) | c[0]) >>> 0
          : ((c[0] << 24) | (c[1] << 16) | (c[2] << 8) | 255) >>> 0;
      },
      ink = pack(LINE),
      pap = pack(PAPER),
      xs = new Int32Array(dw);
    for (let x = 0; x < dw; x++) xs[x] = Math.min(W - 1, ((x * W) / dw) | 0);
    for (let y = 0, j = 0; y < dh; y++) {
      const row = Math.min(H - 1, ((y * H) / dh) | 0) * W;
      for (let x = 0; x < dw; x++, j++) u[j] = labels[row + xs[x]] === -1 ? ink : pap;
    }
    g.putImageData(im, 0, 0);
  }
  const ov = document.createElement('canvas');
  ov.className = 'sfbloom';
  ov.width = dw;
  ov.height = dh;
  Object.assign(ov.style, {
    left: cv.offsetLeft + 'px',
    top: cv.offsetTop + 'px',
    width: cw + 'px',
    height: ch + 'px',
    transform: cv.style.transform || '',
    transformOrigin: cv.style.transformOrigin || '',
  });
  cv.parentNode.insertBefore(ov, cv.nextSibling);
  const g = ov.getContext('2d'),
    shape = bloomShape(dw, dh),
    B = { ov: ov, raf: 0, frames: [], after: [], prep: performance.now() - t0 };
  _bloom = B;
  bloomCount++;
  // (setting up took too long: this device is too slow for it; the overlay goes before a frame is drawn)
  if (B.prep > (window.__MS_BLOOM_PREP_MAX || (window.__MS_TEST ? Infinity : 700))) {
    bloomSlow();
    freeCanvas(la);
    freeCanvas(clean);
    bloomEnd(true);
    return false;
  }
  const ease = function (x) {
    return 1 - Math.pow(1 - x, 3);
  };
  // The colour only spreads, so a frame needn't start again: the line art once, then each frame the picture at part
  // strength inside the flood's front, building up to full behind it (a soft edge, for one draw a frame), and at the
  // end the picture whole.
  g.drawImage(la, 0, 0);
  freeCanvas(la);
  const draw = function (e) {
    g.save();
    if (e < 1) {
      g.beginPath();
      shape(g, Math.min(1, e + 0.07));
      g.clip('evenodd');
      g.globalAlpha = 0.3;
    }
    g.drawImage(clean, 0, 0);
    g.restore();
  };
  // (the clock starts with the first frame drawn: the Build itself can take a moment more of that frame)
  let s0 = -1,
    last = 0;
  const step = function (now) {
    if (_bloom !== B) return;
    if (s0 < 0) s0 = now;
    else {
      B.frames.push(now - last);
      // (a frame held up by other work, a new guide's first save or the page laying itself out, doesn't jump the
      // flood ahead: the clock waits for it)
      if (now - last > 100) s0 += now - last - 17;
    }
    last = now;
    // (the first frames come slowly, on average over 45 ms: not smooth here, so it ends now and stays off this launch)
    if (B.frames.length === 6) {
      const avg = B.frames.slice(1).reduce((a, b) => a + b, 0) / 5;
      if (avg > (window.__MS_BLOOM_FRAME_MAX || (window.__MS_TEST ? Infinity : 45))) {
        bloomSlow();
        bloomEnd(false, true);
        return;
      }
    }
    const p = Math.max(0, Math.min(1, (now - s0) / BLOOM_FLOOD));
    draw(p < 1 ? ease(p) : 1);
    if (p < 1) B.raf = requestAnimationFrame(step);
    else {
      B.raf = 0;
      freeCanvas(clean);
      bloomEnd(false);
    }
  };
  B.raf = requestAnimationFrame(step);
  // a tap anywhere, a key, a wheel or a turn of the screen ends it (the tap still goes where it was going; the page
  // scrolling by itself, as a change of stage does, doesn't: the bloom is in the picture's own box and moves with it)
  B.stop = function () {
    bloomEnd(false, true);
  };
  ['pointerdown', 'keydown', 'wheel'].forEach(function (ev) {
    document.addEventListener(ev, B.stop, { capture: true, passive: true });
  });
  window.addEventListener('resize', B.stop);
  return true;
}
// something to do once the bloom is over, so it can't hold up its frames (a new guide's first save into the Library)
function bloomAfter(fn) {
  if (_bloom) _bloom.after.push(fn);
  else fn();
}
// the bloom's end: the codes fade in as it fades out (now: gone at once; quick: a tap's shorter fade)
function bloomEnd(now, quick) {
  const B = _bloom;
  if (!B) return;
  _bloom = null;
  if (B.raf) cancelAnimationFrame(B.raf);
  ['pointerdown', 'keydown', 'wheel'].forEach(function (ev) {
    document.removeEventListener(ev, B.stop, { capture: true, passive: true });
  });
  window.removeEventListener('resize', B.stop);
  bloomLast = { prep: B.prep, frames: B.frames.slice() };
  B.after.forEach(function (fn) {
    setTimeout(fn, 0);
  });
  const ov = B.ov;
  if (now || !ov.animate) {
    ov.remove();
    return;
  }
  try {
    const a = ov.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: quick ? 150 : BLOOM_FADE,
      easing: 'ease-out',
      fill: 'forwards',
    });
    a.onfinish = function () {
      ov.remove();
    };
  } catch (_) {
    ov.remove();
  }
}
