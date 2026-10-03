/* ===== Keeping work safe: a net for unexpected errors, installing to the Home Screen, keeping storage ===== */
// A safety net for anything unexpected: say so calmly and keep the details one tap away. The error still reaches
// the console and the browser (nothing is swallowed, no preventDefault). Noise the page can't act on is ignored:
// ResizeObserver loop notices, cancelled requests (AbortError) and errors from other origins or extensions.
const errNet = { last: 0, shown: 0, list: [] };
function errNoise(msg, src, err) {
  if (err && err.name === 'AbortError') return true;
  if (/ResizeObserver loop/i.test(msg || '')) return true;
  return /(^|\()(chrome|moz|safari|safari-web)-extension:|webkit-masked-url:/.test(src || '');
}
function errDetails() {
  let v = '';
  try {
    v = (document.getElementById('appVer') || {}).textContent || '';
  } catch (e) {}
  return ['Marker Studio ' + v, 'Browser: ' + (navigator.userAgent || '')]
    .concat(
      errNet.list.map(function (x) {
        return (
          '\n' +
          x.when +
          '\n' +
          x.msg +
          '\nSource: ' +
          x.src +
          (x.line ? ':' + x.line + (x.col ? ':' + x.col : '') : '') +
          (x.stack ? '\n' + x.stack : '')
        );
      }),
    )
    .join('\n');
}
function errReport(msg, src, line, col, stack) {
  try {
    const now = Date.now();
    errNet.list.push({
      when: new Date(now).toISOString(),
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
    if (errNet.list.length > 5) errNet.list.shift();
    // at most one notice every 30 seconds, and a few per visit: a loop of errors shouldn't bury the page in toasts
    if (now - errNet.last < 30000 || errNet.shown >= 4 || typeof toast !== 'function') return;
    errNet.last = now;
    errNet.shown++;
    toast(
      'Something went wrong. Your saved work is safe — reload if anything looks odd. <button class="sflink" id="errCopy">Copy details</button>',
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
  const next = ['backupNudge', 'installCard', 'whatsNew']
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
