// Help: "How it works" (three cards), the help sheet (photo tips, glossary, your data, about with what's new) and
// "What's new" on Home.
// What's new, newest first, each with the version it came in (v308). After an update, a card on Home shows those
// newer than the version last seen (ms-last-ver), up to four (not on a fresh install); Help › About lists this
// version's. (Send feedback, Copy diagnostics and the beta's label: safety.js.)
const WHATS_NEW = [
  {
    v: 'v308.1',
    t: 'Home on an iPad: the guide you’re colouring across the top, with Markers, Palette and Library in a row under it. The Library no longer disappears after restoring a backup.',
  },
  {
    v: 'v308',
    t: 'Gradients at “all” stay clear and bright: choose whether browns, greys and fluorescents join in, and set the count with − and +. Photographed pages straighten and tilt better, the printed key is easier to read, restoring a backup keeps your markers unless you say otherwise, and Send feedback is at the foot of Home.',
  },
  {
    v: 'v307.1',
    t: 'Fixes: a new guide is kept even if you close the app straight after Build, and the Print sheet shows how far a PDF has got.',
  },
  {
    v: 'v307',
    t: 'Finished pages stay in full colour, shaded guides count every marker, and two-brand codes show both markers. PDFs and saving keep the app responsive, and warm photos of your marker trays can be balanced.',
  },
  {
    v: 'v306',
    t: 'Scatter a gradient from Polished to Confetti, and smooth rough spots in one tap. Codes in both brands are marked, and Colour along finds a marker by its code. Your finished piece leads Home.',
  },
  {
    v: 'v305',
    t: 'Finish a page and Reveal shows it off on its paper, ready to share. Gradients are smoother, with a new Around flow for mandalas, and Redo is beside Undo.',
  },
  {
    v: 'v304',
    t: 'Search finds a code however you type it (“c3”, “C-3”, “cool grey 3”). Restoring a backup keeps your newer progress, and Save image’s codes no longer sit on top of each other.',
  },
  {
    v: 'v303',
    t: 'A page downloaded from the internet now makes a better guide: lines close together no longer run into one. Scan is more careful: prices and counts in a list aren’t read as markers.',
  },
  {
    v: 'v302',
    t: 'When you tap a section, the box that opens now points to it. The guide’s rows of buttons are tidier.',
  },
  {
    v: 'v300',
    t: 'On an iPad, the Home, Markers and Palette screens now use the full width, and Home shows what a finished guide looks like before you make your first.',
  },
  {
    v: 'v299',
    t: 'Scan is more reliable and now reads the brand printed on the cap. You can now undo Mark all coloured, and a palette colour you re-rolled.',
  },
  {
    v: 'v298',
    t: 'Paste a whole list of codes and every line is read. Your ticks stay put when you merge or split sections.',
  },
  {
    v: 'v297',
    t: 'When a cap’s code and colour name don’t match, Scan asks which you have. It also knows Ohuhu’s older codes.',
  },
  {
    v: 'v296',
    t: 'New: add markers by typing their codes, or on an iPad or iPhone by scanning their caps one after another (Markers › Scan or type codes).',
  },
  { v: 'v294', t: 'Grainy photos of a page are read more reliably.' },
  {
    v: 'v293',
    t: 'Codes stay sharp when you zoom in. In Safari, swiping back closes what’s open before it leaves the app.',
  },
  {
    v: 'v293',
    t: 'Back closes what’s open before it leaves the app. On a phone, the guide’s tabs are on the first screen.',
  },
  {
    v: 'v287',
    t: 'Colour along now looks like your paper: what you’ve coloured is in colour, the rest pale. Change colour offers the closest markers first.',
  },
  {
    v: 'v287',
    t: 'The Print sheet shows what its page and label choices look like. On an iPad, the picture’s tools have names.',
  },
  {
    v: 'v285',
    t: 'Home has a Continue card that takes you back to the marker you were on. Your guides save themselves.',
  },
  {
    v: 'v285',
    t: 'On an iPad, the guide’s picture is bigger and fits beside the controls. New icons throughout.',
  },
  {
    v: 'v284',
    t: 'Sections you’ve coloured keep their markers when you change the plan. Turn codes off to see your picture as it is.',
  },
  {
    v: 'v284',
    t: 'Printed guides: labels never overlap, tiny sections get close-ups, and the key has boxes to tick.',
  },
  { v: 'v283', t: 'Random’s Balance can follow the 60-30-10 rule: one main colour, a second and an accent.' },
  { v: 'v282', t: 'Print a test strip to try each marker on your own paper first (Share › Print › Pages).' },
  { v: 'v281', t: 'Each zone can have its own shading, or none.' },
  { v: 'v279', t: 'New: zones. Give part of your picture its own pattern and colours (Pattern › + Zone).' },
  {
    v: 'v278',
    t: 'Greyscale shows your guide in greys, to check its lights and darks. Colour along lists markers lightest first.',
  },
  {
    v: 'v277',
    t: 'Shading has new highlight and shadow choices, and a gradient can start from the colour you choose.',
  },
  { v: 'v272', t: 'The Photo pattern matches markers more closely and suggests how many you need.' },
  { v: 'v271', t: 'Gradients and palettes avoid stray greys and colours too alike to tell apart.' },
  { v: 'v271', t: 'Codes are easier to read, and each shows its brand.' },
  {
    v: 'v270',
    t: 'Match a colour picks markers the way your eye would, and corrects a photo’s lighting from the white paper.',
  },
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
    const still = reducedMotion;
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
    // (v308: Send feedback and Copy diagnostics are buttons, handled in safety.js; the beta's label and its guide)
    if (typeof APP_BETA !== 'undefined' && APP_BETA) D.documentElement.classList.add('msbeta');
    else {
      const bg = D.getElementById('helpBeta');
      if (bg) bg.hidden = true;
    }
    const wipe = D.getElementById('helpWipe');
    if (wipe && typeof askWipe === 'function')
      wipe.addEventListener('click', function () {
        askWipe(false);
      });
    function openSheet() {
      const v = D.getElementById('helpVer');
      if (v) v.textContent = ver();
      // (v307) whether this device keeps your data (guide-bridge.js keepWords)
      const k = D.getElementById('helpKeep');
      if (k && typeof keepWords === 'function')
        keepWords(function (t) {
          k.textContent = t;
        });
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
        '<div class="homehelp"><button id="homeHiw" class="hlplink" data-help="hiw">How it works</button><span aria-hidden="true">·</span><button id="homeHelp" class="hlplink" data-help="sheet">Help</button><span aria-hidden="true">·</span><button id="homeFeedback" class="hlplink" data-feedback>Send feedback</button></div>',
      );
    // What's new: one card on Home after an update (never on a fresh install), when neither card above it is due (see
    // renderBackupNudge). It goes when ✕ is tapped, or by itself a week after it was first on screen: that time is kept
    // per version (WN_SHOWN, {v,t}), so time spent waiting behind the other cards doesn't count.
    const WN_SHOWN = 'ms-wn-shown',
      WN_DAYS = 7;
    // (v308) a version as a number to compare: v307.1 → 307.001; '' (none seen) → 0
    const verNum = function (v) {
      const m = /^v?(\d+)(?:\.(\d+))?/.exec(String(v || '').trim());
      return m ? +m[1] + (+m[2] || 0) / 1000 : 0;
    };
    // what's new since the version last seen (up to four, newest first), and never what's newer than this one
    const wnSince = function (last) {
      const lo = verNum(last),
        hi = verNum(ver()) || Infinity;
      return WHATS_NEW.filter(function (x) {
        const n = verNum(x.v);
        return n > lo && n <= hi;
      }).slice(0, 4);
    };
    const wnItems = function (list) {
      return list
        .map(function (x) {
          return '<li>' + esc(x.t) + '</li>';
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
      if (!wnSince(last).length || (t && Date.now() - t >= WN_DAYS * 864e5)) {
        put(LAST, v);
        return false;
      }
      return true;
    }
    function renderWhatsNew(allowed) {
      // (v308) the beta's thanks first, once; What's new waits behind it
      if (renderThanks(allowed)) allowed = false;
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
          '</h2><button id="wnClose" class="wnx" aria-label="Dismiss what’s new">' +
          ic('x') +
          '</button></div><ul>' +
          wnItems(wnSince(get(LAST))) +
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
    // (v308) "Thanks for testing": one card on Home in the beta, once set up (markers, or the welcome done), until its
    // ✕ or a button on it is tapped. Under the browser tests only when a test sets window.__MS_THANKS_AUTO.
    const THANKS = 'ms-beta-thanks';
    function thanksDue() {
      if (typeof APP_BETA === 'undefined' || !APP_BETA || get(THANKS)) return false;
      if (window.__MS_TEST && !window.__MS_THANKS_AUTO) return false;
      return !!(
        get('ms-onboarded') ||
        (typeof state !== 'undefined' && (state.owned.size || state.saved.length))
      );
    }
    function renderThanks(allowed) {
      let card = D.getElementById('betaThanks');
      if (!allowed || !thanksDue()) {
        if (card) card.remove();
        return false;
      }
      if (!card) {
        card = D.createElement('section');
        card.id = 'betaThanks';
        card.className = 'wnew';
        card.setAttribute('aria-labelledby', 'btTitle');
        card.innerHTML =
          '<div class="wnhead"><h2 id="btTitle">Thanks for testing Marker Studio</h2><button id="btClose" class="wnx" aria-label="Dismiss thanks for testing">' +
          ic('x') +
          '</button></div><p>It’s a beta, so back up once a week (<b>Library › Back up</b>). Tell us what goes wrong, and what you’d like: <b>Send feedback</b> is at the foot of Home, and in the guide’s ⋯ menu.</p><div class="nrow"><button type="button" id="btGuide" class="nb1">Tester guide</button><button type="button" id="btFeedback" data-feedback>Send feedback</button></div>';
        const after = D.getElementById('backupNudge') || D.querySelector('#homeView .homegrid');
        if (after) after.insertAdjacentElement('afterend', card);
        else if (av) av.insertAdjacentElement('beforebegin', card);
        else return false;
        const gone = function () {
          put(THANKS, '1');
          if (typeof homeCardGone === 'function') homeCardGone(card);
          else card.remove();
        };
        card.querySelector('#btClose').addEventListener('click', gone);
        card.querySelector('#btFeedback').addEventListener('click', gone);
        card.querySelector('#btGuide').addEventListener('click', function () {
          gone();
          openSheet();
          const g = D.getElementById('helpBeta');
          if (g) {
            g.open = true;
            setTimeout(function () {
              g.scrollIntoView({ block: 'start' });
            }, 0);
          }
        });
      }
      return true;
    }
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
      // (v308: this version's, or the newest version's that has any)
      const cur = WHATS_NEW.filter(function (x) {
          return verNum(x.v) <= (verNum(ver()) || Infinity);
        }),
        top = cur.length ? cur[0].v : '',
        mine = cur.filter(function (x) {
          return x.v === top;
        });
      if (hv) hv.textContent = top || ver();
      if (hl) hl.innerHTML = wnItems(mine);
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
