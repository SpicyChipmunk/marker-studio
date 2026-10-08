/* ===== Keeping work safe: a net for unexpected errors, installing to the Home Screen, keeping storage ===== */
// A safety net for anything unexpected: say so calmly and keep the details one tap away. The error still reaches
// the console and the browser (nothing is swallowed, no preventDefault). Noise the page can't act on is ignored:
// ResizeObserver loop notices, cancelled requests (AbortError) and errors from other origins or extensions.
const errNet = { last: 0, shown: 0, list: [] };
// (v308) The beta: "v308 · Beta" on Home and in Help › About, and once a "Thanks for testing" card on Home (help.js).
// false when the app leaves the beta.
const APP_BETA = true;
// (v308) Where "Send feedback" goes. Empty: the report opens the share sheet (Messages, Mail and so on), or is copied
// where there is no share sheet. An email address ("beta@example.com") makes it an email to that address instead.
const FEEDBACK_EMAIL = '';
// (v308) the last ERR_MAX errors, kept across reloads (ERR_KEY) for Copy details, Copy diagnostics and Send feedback:
// caught failures (errLog: opening a guide, a photo, a PDF or image, the worker, a backup) and unexpected ones
const ERR_KEY = 'ms-errors',
  ERR_MAX = 10;
function errNoise(msg, src, err) {
  if (err && err.name === 'AbortError') return true;
  if (/ResizeObserver loop/i.test(msg || '')) return true;
  return /(^|\()(chrome|moz|safari|safari-web)-extension:|webkit-masked-url:/.test(src || '');
}
function appVerShown() {
  try {
    return ((document.getElementById('appVer') || {}).textContent || '').trim();
  } catch (e) {
    return '';
  }
}
// "v308 · Beta"
function appVerWords() {
  const v = appVerShown();
  return v + (APP_BETA ? (v ? ' · ' : '') + 'Beta' : '');
}
// what this device is, in words: "iPad (iPadOS 17.4), Safari 17.4". An iPad asking for desktop websites (Safari's
// default on an iPad) says it is a Mac; a touch screen (maxTouchPoints) gives it away.
function deviceWords(ua, tp) {
  ua = ua == null ? navigator.userAgent || '' : String(ua);
  tp = tp == null ? +navigator.maxTouchPoints || 0 : +tp;
  const dot = function (x) {
      return x.replace(/_/g, '.');
    },
    m = function (re) {
      const r = ua.match(re);
      return r ? dot(r[1]) : '';
    },
    ios = m(/OS (\d+[_.]\d+(?:[_.]\d+)?) like Mac/),
    safari = m(/Version\/(\d+(?:\.\d+)?)/);
  let dev;
  if (/iPad/.test(ua)) dev = 'iPad' + (ios ? ' (iPadOS ' + ios + ')' : '');
  else if (/Macintosh/.test(ua) && tp > 1) dev = 'iPad (shown to websites as a Mac)';
  else if (/iPhone|iPod/.test(ua)) dev = 'iPhone' + (ios ? ' (iOS ' + ios + ')' : '');
  else if (/Android/.test(ua)) {
    const a = m(/Android (\d+(?:\.\d+)?)/);
    dev = 'Android' + (a ? ' ' + a : '') + (/Mobile/.test(ua) ? ' phone' : ' tablet');
  } else if (/Windows/.test(ua)) dev = 'Windows';
  else if (/CrOS/.test(ua)) dev = 'Chromebook';
  else if (/Macintosh/.test(ua)) dev = 'Mac';
  else if (/Linux/.test(ua)) dev = 'Linux';
  else dev = 'Unknown device';
  let br = '';
  if (/EdgiOS|EdgA?\//.test(ua)) br = 'Edge';
  else if (/CriOS/.test(ua)) br = 'Chrome';
  else if (/FxiOS/.test(ua)) br = 'Firefox';
  else if (/Chrome\/(\d+)/.test(ua)) br = 'Chrome ' + m(/Chrome\/(\d+)/);
  else if (/Firefox\/(\d+)/.test(ua)) br = 'Firefox ' + m(/Firefox\/(\d+)/);
  else if (/Safari\//.test(ua)) br = 'Safari' + (safari ? ' ' + safari : '');
  return dev + (br ? ', ' + br : '');
}
function screenWords() {
  try {
    const s = window.screen || {},
      dpr = Math.round((window.devicePixelRatio || 1) * 100) / 100;
    return (
      (s.width || '?') +
      '×' +
      (s.height || '?') +
      ', window ' +
      (window.innerWidth || '?') +
      '×' +
      (window.innerHeight || '?') +
      ', ' +
      dpr +
      '× pixels, touch points ' +
      (+navigator.maxTouchPoints || 0)
    );
  } catch (e) {
    return '?';
  }
}
function countWords() {
  try {
    if (typeof state === 'undefined' || !state) return '';
    const g = state.saved.filter(function (s) {
      return s && s.type === 'guide';
    }).length;
    return (
      state.owned.size +
      ' markers, ' +
      g +
      (g === 1 ? ' guide, ' : ' guides, ') +
      (state.saved.length - g) +
      (state.saved.length - g === 1 ? ' palette' : ' palettes')
    );
  } catch (e) {
    return '';
  }
}
// the lines every report starts with
function diagHead() {
  const c = countWords();
  return [
    'Marker Studio ' + appVerWords(),
    'Device: ' + deviceWords(),
    'Home Screen app: ' + (isStandalone() ? 'yes' : 'no'),
    'Screen: ' + screenWords(),
  ]
    .concat(c ? ['Saved here: ' + c] : [])
    .concat(['Browser: ' + (navigator.userAgent || '')]);
}
function errStored() {
  try {
    const a = JSON.parse(localStorage.getItem(ERR_KEY) || '[]');
    return Array.isArray(a)
      ? a.filter(function (x) {
          return x && typeof x === 'object' && typeof x.msg === 'string';
        })
      : [];
  } catch (e) {
    return [];
  }
}
// this visit's errors and the ones kept from before, oldest first, the last ERR_MAX
function errAll() {
  const seen = {},
    out = [];
  errStored()
    .concat(errNet.list)
    .forEach(function (x) {
      const k = x.when + '|' + x.msg;
      if (seen[k]) return;
      seen[k] = 1;
      out.push(x);
    });
  out.sort(function (a, b) {
    return a.when < b.when ? -1 : a.when > b.when ? 1 : 0;
  });
  return out.slice(-ERR_MAX);
}
// an error kept: in this visit's list and in storage (small, so it can't crowd out your work when storage is nearly
// full; a write that fails keeps it for this visit only)
function errKeep(x) {
  errNet.list.push(x);
  if (errNet.list.length > ERR_MAX) errNet.list.shift();
  try {
    const a = errStored();
    a.push({
      when: x.when,
      where: x.where || '',
      msg: x.msg.slice(0, 300),
      src: x.src,
      line: x.line,
      col: x.col,
      stack: x.stack.slice(0, 500),
    });
    localStorage.setItem(ERR_KEY, JSON.stringify(a.slice(-ERR_MAX)));
  } catch (e) {}
}
function errStack(e) {
  return String((e && e.stack) || '')
    .split('\n')
    .slice(0, 6)
    .join('\n')
    .slice(0, 1200);
}
// a failure the app caught and says something about itself: kept for Copy details (where: what it was doing)
function errLog(where, err) {
  try {
    const e = err && typeof err === 'object' ? err : null;
    errKeep({
      when: new Date().toISOString(),
      where: String(where || '').slice(0, 80),
      msg: String((e && (e.message || e.name)) || err || 'Unknown error').slice(0, 500),
      src: '',
      line: 0,
      col: 0,
      stack: errStack(e),
    });
  } catch (_) {}
}
// what goes after an error's message: Copy details and Send feedback (handled on any page, below). In the guide's
// meta line (which repeats the message) they're hidden by CSS.
function errBtns() {
  return (
    ' <span class="errbtns"><button type="button" class="sflink" data-errcopy>Copy details</button>' +
    ' <button type="button" class="sflink" data-feedback>Send feedback</button></span>'
  );
}
// a caught failure: kept, and its friendly words with the buttons
function errNote(words, where, err) {
  errLog(where, err);
  return words + errBtns();
}
// (v308.5) what Scan's box was sent, kept for Copy diagnostics: the last SCAN_TRACE_MAX events this visit (the event,
// its kind, how much text, the first characters). Scan Text on an iPad stopped after the first cap with nothing to
// see from here.
const SCAN_TRACE_MAX = 120,
  scanTrace = [];
let scanTrace0 = 0;
function scanTraceAdd(s) {
  const now = Date.now();
  if (!scanTrace0) scanTrace0 = now;
  scanTrace.push(((now - scanTrace0) / 1000).toFixed(2) + ' ' + s);
  if (scanTrace.length > SCAN_TRACE_MAX) scanTrace.splice(0, scanTrace.length - SCAN_TRACE_MAX);
}
function errDetails() {
  return diagHead()
    .concat(
      errAll().map(function (x) {
        return (
          '\n' +
          x.when +
          (x.where ? ' · ' + x.where : '') +
          '\n' +
          x.msg +
          (x.src ? '\nSource: ' + x.src + (x.line ? ':' + x.line + (x.col ? ':' + x.col : '') : '') : '') +
          (x.stack ? '\n' + x.stack : '')
        );
      }),
    )
    .concat(scanTrace.length ? ['\nScan box, this visit:'].concat(scanTrace) : [])
    .join('\n');
}
// Send feedback's report: room to write first, then the details (the last few errors in a line each), kept short
// enough for a message or an email link
function feedbackReport() {
  const errs = errAll()
    .slice(-3)
    .map(function (x) {
      return (
        '- ' +
        x.when.slice(0, 16).replace('T', ' ') +
        (x.where ? ' · ' + x.where : '') +
        ': ' +
        x.msg.slice(0, 160)
      );
    });
  const head = diagHead();
  return (
    'What happened, or what would you like? (A screenshot helps.)\n\n\n\n' +
    '— Details for Marker Studio’s maker (please keep) —\n' +
    head.join('\n').slice(0, 900) +
    '\n' +
    (errs.length ? 'Last errors:\n' + errs.join('\n') : 'No errors recorded.')
  );
}
function feedbackCopy(text) {
  return copyText(text).then(function (ok) {
    toast(
      ok
        ? 'Report copied — paste it into your feedback message, and add what happened or what you’d like.'
        : 'Couldn’t copy the details here.',
      ok ? 9000 : 5000,
    );
    return ok ? 'copy' : false;
  });
}
// the email link: to, subject and body (the report, cut to keep the link within what mail apps take)
function feedbackMailto(to, subj, text) {
  return (
    'mailto:' +
    encodeURIComponent(to).replace('%40', '@') +
    '?subject=' +
    encodeURIComponent(subj) +
    '&body=' +
    encodeURIComponent(String(text).slice(0, 1800))
  );
}
// Send feedback: an email when FEEDBACK_EMAIL is set; else the share sheet, or the clipboard where there is none.
// Resolves 'mail', 'share', 'cancel', 'copy' or false.
function sendFeedback() {
  const text = feedbackReport(),
    subj = 'Marker Studio ' + appVerWords() + ' feedback';
  if (FEEDBACK_EMAIL) {
    location.href = feedbackMailto(FEEDBACK_EMAIL, subj, text);
    return Promise.resolve('mail');
  }
  if (navigator.share) {
    let p;
    try {
      p = Promise.resolve(navigator.share({ title: subj, text: text }));
    } catch (e) {
      p = Promise.reject(e);
    }
    return p.then(
      function () {
        return 'share';
      },
      function (e) {
        return e && e.name === 'AbortError' ? 'cancel' : feedbackCopy(text);
      },
    );
  }
  return feedbackCopy(text);
}
// the buttons, wherever they are: Copy details (an error's), Copy diagnostics (Help › About), Send feedback
document.addEventListener('click', function (e) {
  const b = e.target && e.target.closest && e.target.closest('[data-errcopy],[data-diag],[data-feedback]');
  if (!b) return;
  e.preventDefault();
  if (b.hasAttribute('data-feedback')) {
    sendFeedback();
    return;
  }
  const diag = b.hasAttribute('data-diag');
  copyText(errDetails()).then(function (ok) {
    toast(
      ok
        ? (diag ? 'Diagnostics' : 'Details') +
            ' copied — paste them into a message when you report a problem, or tap Send feedback.'
        : 'Couldn’t copy the details here.',
    );
  });
});
function errReport(msg, src, line, col, stack) {
  try {
    const now = Date.now();
    errKeep({
      when: new Date(now).toISOString(),
      where: '',
      msg: String(msg || 'Unknown error').slice(0, 500),
      src: String(src || '').slice(0, 300),
      line: line || 0,
      col: col || 0,
      stack: String(stack || '')
        .split('\n')
        .slice(0, 6)
        .join('\n')
        .slice(0, 1200),
    });
    // at most one notice every 30 seconds, and a few per visit: a loop of errors shouldn't bury the page in toasts
    if (now - errNet.last < 30000 || errNet.shown >= 4 || typeof toast !== 'function') return;
    errNet.last = now;
    errNet.shown++;
    toastHTML(
      'Something went wrong. Your saved work is safe — reload if anything looks odd. <button class="sflink" id="errCopy">Copy details</button> <button type="button" class="sflink" data-feedback>Send feedback</button>',
      10000,
    );
    const b = document.getElementById('errCopy');
    if (b)
      b.addEventListener(
        'click',
        function () {
          copyText(errDetails()).then(function (ok) {
            toast(
              ok
                ? 'Details copied — paste them into a message when you report the problem.'
                : 'Couldn’t copy the details here.',
            );
          });
        },
        { once: true },
      );
  } catch (e) {}
}
window.addEventListener('error', function (e) {
  try {
    if (!e || (e.target && e.target !== window)) return;
    const src = e.filename || '',
      here = location.protocol + '//' + location.host;
    // other origins and extensions come through as "Script error." with no file, or with their own origin
    if (!src || src.indexOf(here) !== 0 || errNoise(e.message, src, e.error)) return;
    errReport(e.message || (e.error && e.error.message), src, e.lineno, e.colno, e.error && e.error.stack);
  } catch (_) {}
});
window.addEventListener('unhandledrejection', function (e) {
  try {
    const r = e && e.reason,
      msg = (r && r.message) || String(r),
      st = (r && r.stack) || '';
    if (errNoise(msg, st, r)) return;
    const at = st.match(/((?:https?|file):\/\/[^\s)]+?):(\d+):(\d+)/);
    if (at && at[1].indexOf(location.protocol + '//' + location.host) !== 0) return;
    errReport('Unhandled rejection: ' + msg, at ? at[1] : '', at ? +at[2] : 0, at ? +at[3] : 0, st);
  } catch (_) {}
});

// Add to Home Screen. iPhone and iPad Safari clear a website's storage after about a week without a visit, unless
// it's on the Home Screen, so Home suggests adding it there (two steps, since Safari has no install button).
// Android and desktop Chrome offer their own install prompt: it's kept and used from the same card.
// Never shown once installed; "Not now" hides it for a week. It is one of Home's cards (see renderBackupNudge), after
// the backup reminder when that is due, so it is drawn from there: any change here redraws them all.
const INSTALL_SNOOZE = 'ms-install-snooze';
let installEvt = null;
function isStandalone() {
  try {
    return (
      navigator.standalone === true ||
      !!(
        window.matchMedia &&
        (matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches)
      )
    );
  } catch (e) {
    return false;
  }
}
function isIOSDevice() {
  const ua = navigator.userAgent || '';
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}
function installKind() {
  if (isStandalone()) return '';
  if (isIOSDevice() && navigator.standalone === false) return 'ios';
  return installEvt ? 'prompt' : '';
}
window.addEventListener('beforeinstallprompt', function (e) {
  e.preventDefault();
  installEvt = e;
  renderBackupNudge();
});
window.addEventListener('appinstalled', function () {
  installEvt = null;
  renderBackupNudge();
});
const SHARE_ICON =
  '<svg class="instshare" width="15" height="17" viewBox="0 0 15 17" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7.5 1.5v9M4.5 4.3l3-2.9 3 2.9"/><path d="M5 7H2.5v8.5h10V7H10"/></svg>';
// true when the card is showing; `wait`: another card (the backup reminder) goes first, so this one stays hidden.
// keep (v304): Safari's backup reminder in a tab on an iPhone or iPad ({why: 'first' or 'gap', risk}, from backupDue),
// shown as this card with Back up now first, whatever Not now said before
function renderInstallCard(wait, keep) {
  const home = document.getElementById('homeView');
  if (!home) return false;
  let el = document.getElementById('installCard'),
    snooze = 0;
  try {
    snooze = +localStorage.getItem(INSTALL_SNOOZE) || 0;
  } catch (e) {}
  const kind = keep ? 'ios' : wait || Date.now() < snooze ? '' : installKind();
  if (!kind) {
    if (el) el.style.display = 'none';
    return false;
  }
  if (!el) {
    el = document.createElement('div');
    el.id = 'installCard';
    el.className = 'nudge instcard';
    const nb = document.getElementById('backupNudge');
    if (nb && nb.parentNode) nb.parentNode.insertBefore(el, nb);
    else home.appendChild(el);
    el.addEventListener('click', installClick);
  }
  el.style.display = '';
  el.dataset.kind = kind;
  el.dataset.keep = keep ? '1' : '';
  // Chrome and Firefox on an iPhone (CriOS, FxiOS) add to the Home Screen from their own Share menu, not Safari's
  if (kind === 'ios') {
    const ua = navigator.userAgent || '',
      dev = /iPad/.test(ua) || /Macintosh/.test(ua) ? 'iPad' : 'iPhone',
      has = state.owned.size || state.saved.length,
      saf = !/CriOS|FxiOS|EdgiOS/.test(ua),
      steps =
        '<ol class="insteps"><li>' +
        (saf
          ? 'Tap the Share button ' + SHARE_ICON + ' in Safari.'
          : 'Open this browser’s Share menu ' + SHARE_ICON + '.') +
        '</li><li>Choose <b>Add to Home Screen</b>, then open Marker Studio from its icon.</li></ol>';
    if (keep) {
      el.innerHTML =
        '<div class="ntxt"><b>Keep your ' +
        (keep.why === 'first' ? 'guide' : 'work') +
        ' safe on this ' +
        dev +
        '</b> <span>' +
        safariWords() +
        (keep.why === 'gap' && keep.risk
          ? ' ' +
            nWord(keep.risk, 'guide') +
            (keep.risk === 1 ? ' has' : ' have') +
            ' changed since your last backup.'
          : '') +
        ' Add Marker Studio to your Home Screen to stop that — back up first, then restore the file in the Home Screen app.</span></div>' +
        steps +
        '<div class="nrow"><button class="nb1" id="instBackup" data-inst="backup">Back up now</button><button data-inst="later">Not now</button></div>';
      return true;
    }
    el.innerHTML =
      '<div class="ntxt"><b>Add Marker Studio to your Home Screen</b> <span>so your ' +
      dev +
      ' keeps your markers and guides. ' +
      // (the same words as the Keep your guide safe card, v304)
      safariWords() +
      '</span></div><ol class="insteps"><li>' +
      (saf
        ? 'Tap the Share button ' + SHARE_ICON + ' in Safari.'
        : 'Open this browser’s Share menu ' + SHARE_ICON + '.') +
      '</li><li>Choose <b>Add to Home Screen</b>, then open Marker Studio from its icon.</li></ol>' +
      (has
        ? '<div class="instnote">What you’ve made here stays in ' +
          (saf ? 'Safari' : 'this browser') +
          '. <button class="sflink" id="instBackup" data-inst="backup">Back up first</button>, then restore the file in the Home Screen app.</div>'
        : '') +
      '<div class="nrow"><button data-inst="later">Not now</button></div>';
  } else
    el.innerHTML =
      '<div class="ntxt"><b>Install Marker Studio</b> <span>so it opens like an app, works offline and keeps your markers and guides.</span></div><div class="nrow"><button class="nb1" data-inst="go">Install app</button><button data-inst="later">Not now</button></div>';
  return true;
}
function snoozeInstall() {
  try {
    localStorage.setItem(INSTALL_SNOOZE, String(Date.now() + 7 * 864e5));
  } catch (e) {}
}
function installClick(e) {
  const b = e.target.closest('[data-inst]');
  if (!b) return;
  const a = b.dataset.inst;
  if (a === 'later') {
    snoozeInstall();
    // (the card Safari's backup reminder shares: both rest for a week, v304)
    if (b.closest('.nudge').dataset.keep) backupLater();
    homeCardGone(b.closest('.nudge'));
  } else if (a === 'backup') backupAll('instBackup');
  else if (a === 'go' && installEvt) {
    const ev = installEvt;
    installEvt = null;
    try {
      const p = ev.prompt();
      if (p && p.catch) p.catch(function () {});
    } catch (_) {}
    // the prompt can only be used once; if it's dismissed, rest for a week like "Not now"
    Promise.resolve(ev.userChoice)
      .then(function (c) {
        if (!c || c.outcome !== 'accepted') snoozeInstall();
      })
      .catch(function () {})
      .then(renderBackupNudge);
    renderBackupNudge();
  }
}
// One of Home's cards was put away (Not now, Later, ✕): the next one due takes its place, and focus that was on the
// card goes to it (or to New colouring guide), not to the top of the page
function homeCardGone(card) {
  const had = !!card && card.contains(document.activeElement);
  renderBackupNudge();
  if (had) homeCardNext(card);
}
function homeCardNext(card) {
  const next = ['backupNudge', 'installCard', 'betaThanks', 'whatsNew']
      .map(function (id) {
        return document.getElementById(id);
      })
      .find(function (x) {
        return x && x !== card && x.style.display !== 'none' && x.getClientRects().length;
      }),
    // (on an iPad with no guide in progress, New colouring guide is the start card's Choose a photo, v300)
    t = (next && next.querySelector('button')) || homeStartBtn();
  if (t) t.focus({ preventScroll: true });
}
// Ask the browser to keep this site's storage for good once there's something to lose: straight after the tap that
// sets up the collection (welcome's Add, a change in Markers) or saves a palette. Saving a guide asks too.
document.addEventListener(
  'click',
  function () {
    setTimeout(keepCheck, 0);
  },
  true,
);
function keepCheck() {
  try {
    if (!(state.owned.size || state.saved.length)) return;
    firstUse();
    askPersist();
  } catch (e) {}
}
// (v308) Help › Your data › Delete all my data: everything this app keeps on this device goes (its own storage keys,
// "ms-…" and the collection's, and the guides' database), after a question that offers a backup first and wants
// DELETE typed. Other sites at the same address (spicychipmunk.github.io) keep theirs. The page then starts again at
// the welcome; until it has, nothing this page does can write any of it back.
function appKey(k) {
  return typeof k === 'string' && (k.indexOf('ms-') === 0 || k.indexOf('ohuhu-hb320-picker') === 0);
}
// (a page that has wiped, or heard another tab wipe, writes none of it back: no app key, and the guides' database
// can't be opened again before it reloads)
function wipeLock() {
  try {
    const S = Storage.prototype,
      set0 = S.setItem;
    if (!set0._wiped) {
      const f = function (k, v) {
        if (this === localStorage && appKey(k)) return;
        return set0.call(this, k, v);
      };
      f._wiped = set0;
      S.setItem = f;
    }
  } catch (e) {}
  try {
    indexedDB.open = function () {
      throw new Error('deleted');
    };
  } catch (e) {}
}
// Other tabs of the app hear of it ("ms-wiped", the time, left behind on purpose: not data) and start again too:
// they had the collection and an open guide in memory, and their next save wrote them back. A tab away in the
// back/forward cache, or hidden, checks the time when it comes back (it hears no storage event while away).
const WIPED = 'ms-wiped',
  _wipeBoot = Date.now();
function wipedSince() {
  try {
    return +localStorage.getItem(WIPED) > _wipeBoot;
  } catch (e) {
    return false;
  }
}
function wipeHeard() {
  wipeLock();
  wipeReload();
}
addEventListener('storage', function (e) {
  if (e.key === WIPED && e.newValue) wipeHeard();
});
addEventListener('pageshow', function (e) {
  if (e.persisted && wipedSince()) wipeHeard();
});
document.addEventListener('visibilitychange', function () {
  if (document.visibilityState === 'visible' && wipedSince()) wipeHeard();
});
function wipeAllData() {
  wipeLock();
  const keys = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (appKey(k)) keys.push(k);
    }
    keys.forEach(function (k) {
      localStorage.removeItem(k);
    });
  } catch (e) {}
  try {
    (Storage.prototype.setItem._wiped || Storage.prototype.setItem).call(
      localStorage,
      WIPED,
      String(Date.now()),
    );
  } catch (e) {}
  return new Promise(function (res) {
    let r;
    try {
      r = indexedDB.deleteDatabase('ms-guides');
    } catch (e) {
      res(keys.length);
      return;
    }
    const t = setTimeout(function () {
      res(keys.length);
    }, 4000);
    r.onsuccess =
      r.onerror =
      r.onblocked =
        function () {
          clearTimeout(t);
          res(keys.length);
        };
  });
}
// the page starts again, at the welcome. Closing the question steps the history back (layers.js), which can cancel a
// reload asked for at the same moment, so it's asked for once that has happened, and again if the page is still here.
function wipeReload() {
  setTimeout(function () {
    location.reload();
  }, 250);
  setTimeout(function () {
    location.reload();
  }, 2000);
}
function askWipe(after) {
  const ask = window.SF && SF.askBox;
  if (!ask) {
    if (confirm('Delete all your Marker Studio data on this device? This can’t be undone.'))
      wipeAllData().then(wipeReload);
    return;
  }
  const p = ask(
    'Delete all your data?',
    (after ? 'Your backup is made. ' : '') +
      'This deletes your markers, palettes, guides and their photos from this device. It can’t be undone. ' +
      (after ? '' : 'Back up first if you might want them again. ') +
      'Type DELETE to go ahead.',
    '<input type="text" id="wipeWord" class="wipeword" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="Type DELETE to go ahead" placeholder="DELETE">' +
      (after ? '' : '<button type="button" class="btn-primary" data-a="backup">Back up first</button>') +
      '<button type="button" class="wipego" data-a="wipe" id="wipeGo" disabled>Delete everything</button>' +
      '<button type="button" class="sfghost" data-a="stay">Cancel</button>',
    true,
  );
  const w = document.getElementById('wipeWord'),
    go = document.getElementById('wipeGo');
  if (w && go) {
    const ok = function () {
      return w.value.trim().toUpperCase() === 'DELETE';
    };
    w.addEventListener('input', function () {
      go.disabled = !ok();
    });
    w.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && ok()) go.click();
    });
    if (after) w.focus();
  }
  p.then(function (a) {
    if (a === 'backup') {
      Promise.resolve(typeof backupAll === 'function' ? backupAll('guidesBackup') : false).then(
        function (made) {
          if (made) askWipe(true);
        },
      );
    } else if (a === 'wipe') wipeAllData().then(wipeReload);
  });
}
