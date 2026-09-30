// Help: "How it works" (three cards), the help sheet (photo tips, glossary, your data, about with what's new) and
// "What's new" on Home.
// A feedback page or mailto: link. Empty hides "Send feedback" in About.
const FEEDBACK_URL = '';
// The "What's new" card on Home shows up to four of these, once per new version (not on a fresh install); Help › About
// lists them too.
const WHATS_NEW = [
  'Random has a Balance: Main colour lays one colour over about 60% of the picture, a second over 30% and an accent over 10% (tap the bar to choose them). Mixed is Random as before, now with No repeats. Surprise can pick it too.',
  'Test strip (Share › Print › Pages): a page of boxes to try each marker, and its highlight, base and shadow, on your own paper. Radial gradients have a ⊕ to drag where the rings start, and a zone’s sections can be chosen with the keyboard.',
  'Shading per zone: in Shading, the chips choose a zone to shade or leave flat, with its own roundness, highlights and shadows. The light stays one for the whole picture.',
  'Zones: give part of your picture its own pattern and colours. In Pattern, tap ＋ Zone, then tap or drag across sections. Colour along can go zone by zone.',
  'Values (the three grey bars under the picture) shows your guide in greys, to judge its light and dark. Colour along lists markers lightest first, and Find next goes through a marker the way focus mode does.',
  'Shading has Highlights (warmer, or the paper left white) and Shadows (cooler, or grey). A Gradient that goes right round the colour wheel lets you choose its start colour. The sample now keeps all 166 of its sections.',
  'The Photo pattern picks its markers more carefully, grades its matches in Match’s words, and suggests how many markers you need.',
  'Gradients and palettes choose markers by how they look: no stray greys and no two colours you can’t tell apart. Gradients have a new Look, and Mood replaces Intensity.',
  'Match a colour ranks markers by eye. In Match and From photo, Tap the white paper corrects a photo’s lighting; the Photo pattern does it by itself for photos of pages.',
  'Codes are easier to read: dark or white text, whichever stands out, and each code shows its brand as a small tag.',
];
(function () {
  if (typeof MutationObserver === 'undefined') return;
  try {
    const D = document,
      SEEN = 'ms-hiw-seen',
      LAST = 'ms-last-ver';
    const get = function (k) {
        try {
          return localStorage.getItem(k);
        } catch (_) {
          return null;
        }
      },
      put = function (k, v) {
        try {
          localStorage.setItem(k, v);
        } catch (_) {}
      };
    // The first-run cards and What's new appear by themselves only outside the browser tests (window.__MS_TEST), unless a test sets window.__MS_HELP_AUTO.
    const auto = function () {
      return !window.__MS_TEST || !!window.__MS_HELP_AUTO;
    };
    const ver = function () {
      const e = D.getElementById('appVer');
      return e ? e.textContent.trim() : '';
    };
    const hiw = D.getElementById('hiwOverlay'),
      sheet = D.getElementById('helpOverlay');
    if (!hiw || !sheet) return;
    // --- illustrations (inline SVG) ---
    const LN = '#2b2b30',
      PP = '#f6f1e6',
      PK = '#f4a3b8',
      PK2 = '#ee7f9e',
      YL = '#f6c945',
      GR = '#6cbf7a';
    function flower(x, y, s, f, focus) {
      f = f || {};
      const p = f.p || [PP, PP, PP, PP, PP];
      let g =
        '<g transform="translate(' +
        x +
        ' ' +
        y +
        ') scale(' +
        s +
        ')" stroke="' +
        LN +
        '" stroke-width="1.6" stroke-linejoin="round">';
      g += '<path d="M30 40 C27 58 33 72 30 90" fill="none" stroke-linecap="round"/>';
      g +=
        '<path d="M30.5 70 C38 60 49 60 53 64 C46 72 37 74 30.5 70Z" fill="' +
        (f.l1 || PP) +
        '"/><path d="M29.5 80 C22 70 11 70 7 74 C14 82 23 84 29.5 80Z" fill="' +
        (f.l2 || PP) +
        '"/>';
      for (let i = 0; i < 5; i++)
        g +=
          '<ellipse cx="30" cy="14" rx="7.5" ry="11" transform="rotate(' +
          i * 72 +
          ' 30 28)" fill="' +
          p[i] +
          '"/>';
      if (focus != null)
        g +=
          '<ellipse cx="30" cy="14" rx="7.5" ry="11" transform="rotate(' +
          focus * 72 +
          ' 30 28)" fill="none" stroke="#ffd84a" stroke-width="2.6"/>';
      g += '<circle cx="30" cy="28" r="7" fill="' + (f.c || PP) + '"/>';
      return g + '</g>';
    }
    const T = function (x, y, t, sz, fill, extra) {
      return (
        '<text x="' +
        x +
        '" y="' +
        y +
        '" font-size="' +
        sz +
        '" fill="' +
        (fill || '#f4f2ec') +
        '" font-weight="700" ' +
        (extra || '') +
        '>' +
        t +
        '</text>'
      );
    };
    function marker(x, y, col) {
      return (
        '<g transform="translate(' +
        x +
        ' ' +
        y +
        ') rotate(-12)"><rect x="0" y="16" width="14" height="46" rx="3" fill="#ebe7df"/><rect x="0" y="28" width="14" height="9" fill="' +
        col +
        '"/><rect x="-1" y="0" width="16" height="18" rx="4" fill="' +
        col +
        '"/></g>'
      );
    }
    const ART = {
      1:
        '<svg viewBox="0 0 260 150" role="img" aria-label="A phone photographing a page at an angle, and the same page straightened"><rect x="20" y="6" width="100" height="138" rx="16" fill="#1d1d25" stroke="#55556a" stroke-width="2"/><rect x="27" y="18" width="86" height="114" rx="6" fill="#4a4038"/><path d="M40 34 L100 29 L106 118 L33 113 Z" fill="' +
        PP +
        '"/>' +
        flower(44, 37, 0.82, null) +
        '<path d="M40 34 L100 29 L106 118 L33 113 Z" fill="none" stroke="#ffd84a" stroke-width="2" stroke-dasharray="5 3"/><path d="M131 75 H160 M153 68 L161 75 L153 82" fill="none" stroke="#b9a8ff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><rect x="172" y="22" width="76" height="104" rx="3" fill="' +
        PP +
        '"/>' +
        flower(180, 28, 1, null) +
        '<circle cx="244" cy="124" r="11" fill="#5fb89f"/><path d="M238.5 124 l4 4 7-8" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      2:
        '<svg viewBox="0 0 260 150" role="img" aria-label="The page with each section coloured by a marker, and a tapped section showing Change colour and Pin"><rect x="18" y="10" width="110" height="130" rx="4" fill="' +
        PP +
        '"/>' +
        flower(30, 16, 1.3, { p: [PK2, PK, PK, PK, PK], c: YL, l1: GR, l2: GR }) +
        '<circle cx="69" cy="33" r="7" fill="#fff" fill-opacity=".55"/><circle cx="69" cy="33" r="13" fill="none" stroke="#fff" stroke-width="2" stroke-opacity=".8"/><path d="M82 30 L104 26" stroke="#55556a" stroke-width="2"/><rect x="104" y="10" width="92" height="52" rx="9" fill="#1d1d25" stroke="#55556a" stroke-width="1.5"/><circle cx="118" cy="25" r="6" fill="' +
        PK2 +
        '"/>' +
        T(129, 29, 'RV17', 11) +
        '<rect x="112" y="37" width="46" height="17" rx="8.5" fill="#6f4ef5"/>' +
        T(135, 49, 'Change', 8.5, '#fff', 'text-anchor="middle"') +
        '<rect x="162" y="37" width="28" height="17" rx="8.5" fill="none" stroke="#8d86a3"/>' +
        T(176, 49, 'Pin', 8.5, '#f4f2ec', 'text-anchor="middle"') +
        marker(160, 72, PK2) +
        marker(184, 70, YL) +
        marker(208, 68, GR) +
        T(206, 146, 'your markers', 10, '#a8a4b3', 'text-anchor="middle" font-weight="600"') +
        '</svg>',
      3:
        '<svg viewBox="0 0 260 150" role="img" aria-label="A half-coloured page with one section outlined, next to a list of colours with ticks"><rect x="18" y="10" width="110" height="130" rx="4" fill="' +
        PP +
        '"/>' +
        flower(30, 16, 1.3, { p: [PK, PK, PP, PP, PK], c: YL, l1: GR }, 2) +
        '<rect x="140" y="12" width="106" height="92" rx="10" fill="#1d1d25" stroke="#55556a" stroke-width="1.5"/>' +
        [
          [YL, 'Y11', 1],
          [GR, 'G114', 1],
          [PK, 'RV17', 0],
        ]
          .map(function (r, i) {
            const y = 34 + i * 26;
            return (
              '<circle cx="155" cy="' +
              (y - 4) +
              '" r="7" fill="' +
              r[0] +
              '"/>' +
              T(168, y, r[1], 11) +
              (r[2]
                ? '<rect x="216" y="' +
                  (y - 13) +
                  '" width="18" height="18" rx="5" fill="#5fb89f"/><path d="M220 ' +
                  (y - 4) +
                  ' l4 4 6-7" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>'
                : '<rect x="216.5" y="' +
                  (y - 12.5) +
                  '" width="17" height="17" rx="5" fill="none" stroke="#8d86a3" stroke-width="1.5"/>')
            );
          })
          .join('') +
        '<rect x="140" y="114" width="106" height="26" rx="13" fill="#6f4ef5"/>' +
        T(193, 131, 'Reveal &amp; share', 10.5, '#fff', 'text-anchor="middle"') +
        '</svg>',
    };
    hiw.querySelectorAll('.hiwart').forEach(function (a) {
      a.innerHTML = ART[a.dataset.art] || '';
    });
    // --- How it works: swipe, Next / Back, the dots or the arrow keys ---
    const track = D.getElementById('hiwTrack'),
      slides = [].slice.call(track.querySelectorAll('.hiwslide')),
      dots = [].slice.call(D.querySelectorAll('#hiwDots .hiwdot')),
      back = D.getElementById('hiwBack'),
      next = D.getElementById('hiwNext'),
      live = D.getElementById('hiwLive');
    let cur = 0;
    const still = function () {
      return !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    };
    function paint() {
      slides.forEach(function (s, i) {
        if (i === cur) s.removeAttribute('aria-hidden');
        else s.setAttribute('aria-hidden', 'true');
      });
      dots.forEach(function (d, i) {
        d.classList.toggle('on', i === cur);
        if (i === cur) d.setAttribute('aria-current', 'step');
        else d.removeAttribute('aria-current');
      });
      if (!cur && D.activeElement === back) next.focus({ preventScroll: true });
      back.style.visibility = cur ? '' : 'hidden';
      next.textContent = cur === slides.length - 1 ? 'Got it' : 'Next';
      const h = slides[cur].querySelector('h3');
      live.textContent = 'Step ' + (cur + 1) + ' of ' + slides.length + ': ' + (h ? h.textContent : '');
    }
    // a card chosen with Next, Back, a dot or an arrow key: while the track glides there, a pause in its scrolling (a
    // busy device) mustn't read the half-way position as the card being shown, which would put the dots back a card
    // and make a quick second Next go to the same card again. A swipe of the track's own ends that.
    let aim = -1,
      aimT = 0;
    function go(i, smooth) {
      cur = Math.max(0, Math.min(slides.length - 1, i));
      const s = smooth && !still();
      aim = s ? cur : -1;
      aimT = Date.now();
      track.scrollTo({
        left: slides[cur].offsetLeft - slides[0].offsetLeft,
        behavior: s ? 'smooth' : 'auto',
      });
      paint();
    }
    const swipe = function () {
      aim = -1;
    };
    ['pointerdown', 'touchstart', 'wheel'].forEach(function (t) {
      track.addEventListener(t, swipe, { passive: true });
    });
    let _st = 0;
    track.addEventListener(
      'scroll',
      function () {
        clearTimeout(_st);
        _st = setTimeout(function () {
          const i = Math.round(track.scrollLeft / Math.max(1, slides[1].offsetLeft - slides[0].offsetLeft));
          if (aim >= 0) {
            if (i !== aim && Date.now() - aimT < 1500) return;
            aim = -1;
          }
          if (i !== cur && i >= 0 && i < slides.length) {
            cur = i;
            paint();
          }
        }, 90);
      },
      { passive: true },
    );
    // focus goes back to whatever opened a help dialog (or the open mode tab) when it closes
    const opener = new Map();
    function show(ov) {
      if (ov.classList.contains('on')) return;
      opener.set(ov, D.activeElement);
      if (typeof hideToast === 'function') hideToast();
      openDialog(ov);
    }
    function hide(ov) {
      if (!ov.classList.contains('on')) return;
      const r = opener.get(ov);
      opener.delete(ov);
      const had = ov.contains(D.activeElement);
      closeDialog(ov);
      if (!had && D.activeElement && D.activeElement !== D.body) return;
      const t = r && r.isConnected && r.getClientRects().length ? r : D.querySelector('.modes button.on');
      if (t && t.focus) t.focus({ preventScroll: true });
    }
    function openHiw() {
      put(SEEN, '1');
      show(hiw);
      go(0, false);
      setTimeout(function () {
        if (hiw.classList.contains('on')) next.focus({ preventScroll: true });
      }, 0);
    }
    function closeHiw() {
      hide(hiw);
    }
    next.addEventListener('click', function () {
      if (cur >= slides.length - 1) closeHiw();
      else go(cur + 1, true);
    });
    back.addEventListener('click', function () {
      go(cur - 1, true);
    });
    dots.forEach(function (d, i) {
      d.addEventListener('click', function () {
        go(i, true);
      });
    });
    D.getElementById('hiwClose').addEventListener('click', closeHiw);
    hiw.addEventListener('click', function (e) {
      if (e.target === hiw) closeHiw();
    });
    hiw.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        go(cur + 1, true);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        go(cur - 1, true);
      }
    });
    // --- the help sheet ---
    const fb = D.getElementById('helpFeedback');
    if (fb) {
      if (FEEDBACK_URL) {
        fb.href = FEEDBACK_URL;
        fb.hidden = false;
      } else fb.hidden = true;
    }
    function openSheet() {
      const v = D.getElementById('helpVer');
      if (v) v.textContent = ver();
      show(sheet);
    }
    // the guide's ⋯ menu opens it too (Help)
    window.openHelpSheet = openSheet;
    D.getElementById('helpClose').addEventListener('click', function () {
      hide(sheet);
    });
    sheet.addEventListener('click', function (e) {
      if (e.target === sheet) hide(sheet);
    });
    // any [data-help] button: "hiw" opens How it works (on top of the sheet when opened from it), anything else the sheet
    D.addEventListener('click', function (e) {
      const b = e.target && e.target.closest && e.target.closest('[data-help]');
      if (!b) return;
      if (b.dataset.help === 'hiw') openHiw();
      else openSheet();
    });
    // --- Home: How it works / Help links, and What's new ---
    const av = D.getElementById('appVer');
    if (av)
      av.insertAdjacentHTML(
        'beforebegin',
        '<div class="homehelp"><button id="homeHiw" class="hlplink" data-help="hiw">How it works</button><span aria-hidden="true">·</span><button id="homeHelp" class="hlplink" data-help="sheet">Help</button></div>',
      );
    // What's new: one card on Home after an update (never on a fresh install), when neither card above it is due (see
    // renderBackupNudge). It goes when ✕ is tapped, or by itself a week after it was first on screen: that time is kept
    // per version (WN_SHOWN, {v,t}), so time spent waiting behind the other cards doesn't count.
    const WN_SHOWN = 'ms-wn-shown',
      WN_DAYS = 7;
    const wnItems = function () {
      return WHATS_NEW.slice(0, 4)
        .map(function (t) {
          return '<li>' + esc(t) + '</li>';
        })
        .join('');
    };
    function wnShownAt(v) {
      try {
        const o = JSON.parse(get(WN_SHOWN) || 'null');
        return o && o.v === v ? +o.t || 0 : 0;
      } catch (_) {
        return 0;
      }
    }
    function wnDue() {
      const v = ver();
      if (!v) return false;
      const last = get(LAST);
      if (!last) {
        // no version seen yet: a fresh install just records it; someone who already used an older version sees the card
        const used = !!(
          get('ms-onboarded') ||
          get('ms-setup-tip') ||
          (typeof state !== 'undefined' && (state.owned.size || state.saved.length))
        );
        if (!used) {
          put(LAST, v);
          return false;
        }
      } else if (last === v) return false;
      const t = wnShownAt(v);
      if (!WHATS_NEW.length || (t && Date.now() - t >= WN_DAYS * 864e5)) {
        put(LAST, v);
        return false;
      }
      return true;
    }
    function renderWhatsNew(allowed) {
      let card = D.getElementById('whatsNew');
      if (!auto() || !wnDue() || !allowed) {
        if (card) card.remove();
        return;
      }
      const v = ver();
      if (!card) {
        card = D.createElement('section');
        card.id = 'whatsNew';
        card.className = 'wnew';
        card.setAttribute('aria-labelledby', 'wnTitle');
        card.innerHTML =
          '<div class="wnhead"><h2 id="wnTitle">What’s new in ' +
          esc(v) +
          '</h2><button id="wnClose" class="wnx" aria-label="Dismiss what’s new">✕</button></div><ul>' +
          wnItems() +
          '</ul>';
        const after = D.getElementById('backupNudge') || D.querySelector('#homeView .homegrid');
        if (after) after.insertAdjacentElement('afterend', card);
        else if (av) av.insertAdjacentElement('beforebegin', card);
        else return;
        card.querySelector('#wnClose').addEventListener('click', function () {
          put(LAST, v);
          if (typeof homeCardGone === 'function') homeCardGone(card);
          else card.remove();
        });
      }
      // it counts as shown once it is on screen (Home is showing)
      if (!wnShownAt(v) && card.getClientRects().length)
        put(WN_SHOWN, JSON.stringify({ v: v, t: Date.now() }));
    }
    window.renderWhatsNew = renderWhatsNew;
    // Home was first drawn before this script ran
    if (typeof renderBackupNudge === 'function') {
      try {
        renderBackupNudge();
      } catch (e) {
        if (window.console) console.warn('home cards', e);
      }
    } else renderWhatsNew(true);
    // Help › About lists the same, any time
    {
      const hv = D.getElementById('helpWnVer'),
        hl = D.getElementById('helpWnList');
      if (hv) hv.textContent = ver();
      if (hl) hl.innerHTML = wnItems();
    }
    // --- How it works, once: the first time the guide shows a photo or the sample (never over another dialog) ---
    if (
      auto() &&
      !get(SEEN) &&
      typeof state !== 'undefined' &&
      state.saved.some(function (s) {
        return s.type === 'guide';
      })
    )
      put(SEEN, '1'); // already made guides before this existed
    const root = D.getElementById('sfRoot');
    if (root && !get(SEEN)) {
      let _t = 0;
      const ready = function () {
        const w = D.getElementById('sfWork');
        return (
          auto() &&
          !!w &&
          w.style.display !== 'none' &&
          root.style.display !== 'none' &&
          (typeof state === 'undefined' || state.mode === 'sections') &&
          !dialogOpen()
        );
      };
      const mo = new MutationObserver(function () {
        if (_t) return;
        if (get(SEEN)) {
          mo.disconnect();
          return;
        }
        if (!ready()) return;
        _t = setTimeout(function () {
          _t = 0;
          if (get(SEEN)) {
            mo.disconnect();
            return;
          }
          if (ready()) {
            mo.disconnect();
            openHiw();
          }
        }, 700);
      });
      mo.observe(root, { attributes: true, attributeFilter: ['style'], childList: true, subtree: true });
    }
  } catch (e) {
    if (window.console) console.warn('help', e);
  }
})();
