/* ===== Tester tasks, and Send feedback's form (v312) =====
   In the beta only (APP_BETA, safety.js). Tester tasks: six things to try, each answered Easy / OK / Hard / Didn't try
   with a note, three more if there's time, and five last questions. The answers stay on this device (TT_KEY) until
   Send results. Ways in: the foot of Home ("Tester tasks · 2 of 6", "ready to send" once all six are answered and not
   sent), the thanks card and Help's Beta tester guide ([data-tasks]).
   Where answers go: the Google Form in RESULTS_FORM (safety.js; docs/tester-form-setup.gs makes it, with a sheet that
   gets a row per send). Send results posts to it, and so does Send feedback, from its own small dialog (Kind tells them
   apart). Posting is no-cors: the app can't read Google's answer, only whether it got through to the network. Offline,
   nothing is lost: the answers stay, the sheet says so, and Copy my answers (or Share, for feedback) is there instead.
   Without a form both fall back to the share sheet, or copying, as Send feedback did before. */
(function () {
  if (typeof APP_BETA === 'undefined' || !APP_BETA) return;
  const D = document,
    TT_KEY = 'ms-tester',
    POST_MS = 20000;
  // the form's fields, in the order docs/tester-form-setup.gs makes them (its pre-filled link lists them in this order).
  // (v318.26) Other brands and Colour most are new, at the end; a form made before has the first OLD_N, up to Message
  const FIELDS = [
    'Kind',
    'Tester',
    'Name',
    'Send',
    'Version',
    'Device',
    'App or tab',
    'Markers',
    'Use so far',
    '1 Add your markers',
    '1 Note',
    '2 Make a guide',
    '2 Note',
    '3 Make the plan yours',
    '3 Note',
    '4 Colour along',
    '4 Note',
    '5 Come back to it',
    '5 Note',
    '6 Share or print',
    '6 Note',
    'Extras',
    'Confused most',
    'Change first',
    'Colours matched',
    'Next page',
    'Message',
    'Other brands',
    'Colour most',
  ];
  const OLD_N = 27;
  const TASKS = [
    {
      k: 'add',
      t: 'Add your markers',
      s: 'You did this in the welcome: how did it go?',
      d: 'However suits how you got them: a set, photographing or scanning caps, ticking colours on a chart, or finding your set from 3 caps. There are more ways in <b>Markers › + Add markers</b>.',
      p: ['Was the way that suits you easy to find?', 'Anything go wrong?'],
    },
    {
      k: 'guide',
      t: 'Make a guide',
      s: 'From a page you’d really colour',
      d: 'Choose a photo of a page you’d like to colour, or one you downloaded (not the sample). Check its sections, then <b>Build guide</b>.',
      p: ['Did the sections match the drawing?', 'Anything go wrong?'],
    },
    {
      k: 'plan',
      t: 'Make the plan yours',
      s: 'Mood, Pattern, Surprise, Shuffle',
      d: 'Try <b>Mood</b>, a different <b>Pattern</b>, <b>Surprise</b>, or <b>Shuffle</b> (<b>Other pairings</b> in Random) until it’s a plan you’d colour.',
      p: ['Anything you expected that didn’t happen?', 'Anything go wrong?'],
    },
    {
      k: 'along',
      t: 'Colour along',
      s: 'Colour 10 sections on paper, ticking them off',
      d: 'Tap <b>Colour along</b> and colour at least 10 sections on paper, ticking each off as you go. Try <b>Focus mode</b> too. It’s fine to spread this over a few days: your answers are kept.',
      p: ['Was it easy to find the next section?', 'Anything go wrong?'],
    },
    {
      k: 'back',
      t: 'Come back to it',
      s: 'Close the app, reopen it, back up',
      d: 'Close the app, open it again and carry on where you were. Then back up: <b>Library › Back up</b>.',
      p: ['Was everything where you left it?', 'Anything go wrong?'],
    },
    {
      k: 'share',
      t: 'Share or print',
      s: 'Print, Save image or Reveal',
      d: 'Print your guide (<b>Share &amp; print › Print…</b>), save an image of it, or finish a page, add a photo of it, and try <b>Reveal &amp; share</b>.',
      p: ['Did it look right?', 'Anything go wrong?'],
    },
  ];
  const EXTRAS = [
    {
      k: 'palette',
      t: 'Palette',
      s: 'Make a palette and use it in a guide',
      d: 'In <b>Palette</b>, make a palette you like, then tap <b>Use in a guide</b>. Or, in a guide, <b>Colours › Colours from › A palette</b>, then <b>New palette</b>.',
      p: ['Anything go wrong?'],
    },
    {
      k: 'match',
      t: 'Match a colour',
      s: 'Point the camera at something colourful',
      d: 'In <b>Markers</b>, tap <b>Match a colour</b> and find the marker closest to something around you.',
      p: ['Was the closest marker a good match?'],
    },
    {
      k: 'low',
      t: 'Running low and To buy',
      s: 'Mark a marker running low, then see your list',
      d: 'In <b>Markers</b>, press and hold one of your markers and mark it running low. Then look at <b>To buy</b>.',
      p: ['Anything go wrong?'],
    },
  ];
  const RATES = [
    ['easy', 'Easy'],
    ['ok', 'OK'],
    ['hard', 'Hard'],
    ['skip', 'Didn’t try'],
  ];
  const QS = [
    ['confused', 'What confused you most?'],
    ['change', 'What would you change first?'],
    // (v318.26: which markers, too; and two questions about the tester, for what to build for next)
    [
      'colours',
      'Did the colours on paper match the screen well enough? Which markers looked most different?',
    ],
    ['brands', 'Which other marker brands do you use?'],
    ['subjects', 'What do you colour most (people, animals, flowers, patterns…)?'],
  ];
  const NEXT = [
    ['yes', 'Yes'],
    ['maybe', 'Maybe'],
    ['no', 'No'],
  ];
  const rateWord = function (r) {
    const x = RATES.find(function (y) {
      return y[0] === r;
    });
    return x ? x[1] : '';
  };

  // --- the answers, kept on this device ---
  function fresh() {
    return {
      id: 'T' + Math.random().toString(36).slice(2, 8).toUpperCase(),
      name: '',
      t: {},
      q: {},
      sends: 0,
      sig: '',
    };
  }
  let st = null;
  function load() {
    if (st) return st;
    try {
      const o = JSON.parse(localStorage.getItem(TT_KEY) || 'null');
      st = o && typeof o === 'object' && typeof o.id === 'string' ? o : fresh();
    } catch (e) {
      st = fresh();
    }
    st.t = st.t && typeof st.t === 'object' ? st.t : {};
    st.q = st.q && typeof st.q === 'object' ? st.q : {};
    return st;
  }
  // (v318.22 debug) another tab's answers read in at once, so this one's next answer doesn't write over them with what
  // it read when it opened (a rating and a note given in one tab were gone after the next answer in another). Read
  // again in place, never left empty: everything here reads the record as it is
  addEventListener('storage', function (e) {
    if (e.key !== TT_KEY || !st) return;
    st = null;
    load();
    // (v318.25) and Home's card and the foot line with them: they had said what this tab last saw until it reloaded
    footSync();
  });
  function save() {
    try {
      localStorage.setItem(TT_KEY, JSON.stringify(st));
    } catch (e) {}
    footSync();
  }
  // (v318 review) the answers go in a backup and come back with it: moving from a Safari tab to the Home Screen app
  // (back up, then restore there) had left them behind, and the tester's id with them. null when there's nothing yet.
  function clean(o) {
    if (!o || typeof o !== 'object' || typeof o.id !== 'string' || !/^T[A-Z0-9]{1,12}$/.test(o.id))
      return null;
    const t = {},
      q = {},
      str = function (x, n) {
        return typeof x === 'string' ? x.slice(0, n) : '';
      };
    if (o.t && typeof o.t === 'object')
      TASKS.concat(EXTRAS).forEach(function (x) {
        const a = o.t[x.k];
        if (!a || typeof a !== 'object') return;
        const r = RATES.some((y) => y[0] === a.r) ? a.r : '',
          n = str(a.n, 1000);
        if (r || n) t[x.k] = { r: r, n: n, v: str(a.v, 20) };
      });
    if (o.q && typeof o.q === 'object')
      QS.forEach(function (x) {
        const v = str(o.q[x[0]], 1500);
        if (v) q[x[0]] = v;
      });
    if (NEXT.some((y) => y[0] === (o.q && o.q.next))) q.next = o.q.next;
    return {
      id: o.id,
      name: str(o.name, 60),
      t: t,
      q: q,
      sends: Math.max(0, Math.min(999, +o.sends || 0)),
      sig: str(o.sig, 20000),
    };
  }
  function blank(x) {
    return !x.name && !Object.keys(x.t).length && !Object.keys(x.q).length && !x.sends;
  }
  window.testerBackup = function () {
    load();
    const c = clean(st);
    return c && !blank(c) ? c : null;
  };
  // the backup's answers: all of them on a device with none; else only those not answered here (yours stay)
  window.testerRestore = function (o) {
    const b = clean(o);
    if (!b || blank(b)) return 0;
    load();
    const here = clean(st);
    let n = 0,
      took = false;
    if (!here || blank(here)) {
      st = b;
      // (v318 audit: kept even with no answers, only a name or the sends: the tester's id with them)
      took = true;
      n = Object.keys(b.t).length + Object.keys(b.q).length;
    } else {
      for (const k in b.t)
        if (!(st.t[k] && (st.t[k].r || st.t[k].n))) {
          st.t[k] = b.t[k];
          n++;
        }
      for (const k in b.q)
        if (!st.q[k]) {
          st.q[k] = b.q[k];
          n++;
        }
      if (!st.name && b.name) st.name = b.name;
    }
    if (n || took) save();
    return n;
  };
  // what's been answered, to tell a change since the last send
  function sig() {
    return JSON.stringify([st.t, st.q, st.name]);
  }
  function answered() {
    load();
    return TASKS.filter(function (x) {
      return st.t[x.k] && st.t[x.k].r;
    }).length;
  }
  const ver = function () {
    return typeof appVerShown === 'function' ? appVerShown() : '';
  };

  // --- the form ---
  // RESULTS_FORM's pre-filled link: the form's id, and its fields' entry numbers in order. null if it isn't set, or
  // doesn't have the fields this version sends. (window.__MS_RESULTS_FORM: the browser tests' own)
  // (v318.26) The form of v318.25 (OLD_N fields, up to Message) or the form with the two new questions (all of FIELDS):
  // the app and the live form needn't change on the same day. Sent to the older form, the new answers go in Message
  // (post). Any other count is a link copied wrongly: said once in the console, as without it Send results and Send
  // feedback quietly use the share sheet.
  let warned = false;
  function formTarget() {
    const u = String(
      window.__MS_RESULTS_FORM != null
        ? window.__MS_RESULTS_FORM
        : typeof RESULTS_FORM === 'string'
          ? RESULTS_FORM
          : '',
    );
    const m = /\/forms\/d\/e\/([\w-]+)\//.exec(u);
    if (!m) return null;
    const ids = [];
    u.replace(/[?&]entry\.(\d+)=/g, function (_, d) {
      ids.push(d);
      return _;
    });
    if (ids.length !== FIELDS.length && ids.length !== OLD_N) {
      if (!warned) {
        warned = true;
        try {
          console.warn(
            'Marker Studio: RESULTS_FORM has ' +
              ids.length +
              ' fields; this version sends ' +
              OLD_N +
              ' or ' +
              FIELDS.length +
              '. Send results and Send feedback will use the share sheet.',
          );
        } catch (e) {}
      }
      return null;
    }
    return { action: 'https://docs.google.com/forms/d/e/' + m[1] + '/formResponse', ids: ids };
  }
  // posts the values ({field: text}); resolves true once it got through, false offline or on a network error
  function post(values) {
    const t = formTarget();
    if (!t) return Promise.resolve(false);
    if (navigator.onLine === false) return Promise.resolve(false);
    const body = new URLSearchParams(),
      v = Object.assign({}, values);
    // (v318.26) one entry per field the form has; to the older form, the answers it has no field for go in Message
    // ("Other brands: …"), which a Results row leaves empty
    if (t.ids.length < FIELDS.length) {
      const more = FIELDS.slice(t.ids.length)
        .filter(function (f) {
          return v[f];
        })
        .map(function (f) {
          return f + ': ' + v[f];
        });
      if (more.length) v.Message = (v.Message ? v.Message + '\n\n' : '') + more.join('\n');
    }
    t.ids.forEach(function (id, i) {
      const f = FIELDS[i];
      body.append('entry.' + id, String(v[f] == null ? '' : v[f]).slice(0, 4000));
    });
    // (v312.1: given up after POST_MS, as when offline: a stalled connection had left "Sending…" for good)
    const ac = typeof AbortController === 'function' ? new AbortController() : null;
    try {
      return new Promise(function (done) {
        const t0 = setTimeout(function () {
          if (ac) ac.abort();
          done(false);
        }, POST_MS);
        fetch(t.action, {
          method: 'POST',
          mode: 'no-cors',
          body: body,
          signal: ac ? ac.signal : undefined,
        }).then(
          function () {
            clearTimeout(t0);
            done(true);
          },
          function () {
            clearTimeout(t0);
            done(false);
          },
        );
      });
    } catch (e) {
      return Promise.resolve(false);
    }
  }
  // markers by brand: "Ohuhu 120, Copic 4"
  function markerWords() {
    try {
      const n = {};
      state.owned.forEach(function (k) {
        const b = String(k).split('|')[0];
        n[b] = (n[b] || 0) + 1;
      });
      const w = Object.keys(n).map(function (b) {
        return b + ' ' + n[b];
      });
      return w.length ? w.join(', ') : 'none yet';
    } catch (e) {
      return '';
    }
  }
  function context(kind) {
    load();
    return {
      Kind: kind,
      Tester: st.id,
      Name: st.name || '',
      Version: typeof appVerWords === 'function' ? appVerWords() : ver(),
      Device: typeof deviceWords === 'function' ? deviceWords() : '',
      'App or tab':
        typeof isStandalone === 'function' ? (isStandalone() ? 'Home Screen app' : 'browser tab') : '',
      Markers: markerWords(),
      'Use so far': (typeof countWords === 'function' && countWords()) || 'nothing saved yet',
    };
  }
  // one answer as the sheet shows it: "OK", with the version it was given on when that's not this one
  function answerWord(a) {
    if (!a || !a.r) return '';
    return rateWord(a.r) + (a.v && a.v !== ver() ? ' (on ' + a.v + ')' : '');
  }
  function resultValues() {
    const v = context('Results');
    v.Send = st.sends ? st.sends + 1 + ' (an update)' : '1';
    TASKS.forEach(function (x, i) {
      const a = st.t[x.k];
      v[FIELDS[9 + i * 2]] = answerWord(a) || 'not yet';
      v[i + 1 + ' Note'] = (a && a.n) || '';
    });
    v.Extras = EXTRAS.filter(function (x) {
      return st.t[x.k] && (st.t[x.k].r || st.t[x.k].n);
    })
      .map(function (x) {
        const a = st.t[x.k];
        return x.t + ': ' + (answerWord(a) || '–') + (a.n ? '. ' + a.n : '');
      })
      .join('\n');
    v['Confused most'] = st.q.confused || '';
    v['Change first'] = st.q.change || '';
    v['Colours matched'] = st.q.colours || '';
    v['Next page'] = (NEXT.find((y) => y[0] === st.q.next) || ['', ''])[1];
    v['Other brands'] = st.q.brands || '';
    v['Colour most'] = st.q.subjects || '';
    return v;
  }
  // the same as text, to copy (or share) when there's no form or no network
  function resultText() {
    const v = resultValues();
    return FIELDS.filter(function (f) {
      return f !== 'Message' && v[f];
    })
      .map(function (f) {
        return f + ': ' + v[f];
      })
      .join('\n');
  }

  // --- the sheet ---
  const ov = D.getElementById('ttOverlay');
  if (!ov) return;
  let openK = null;
  function rowHTML(x, n) {
    const a = st.t[x.k] || {},
      on = openK === x.k,
      done = !!a.r,
      mark = done ? (a.r === 'skip' ? '–' : '✓') : n;
    return (
      '<div class="ttrow' +
      (on ? ' open' : '') +
      '" data-k="' +
      x.k +
      '"><button type="button" class="tttop" aria-expanded="' +
      on +
      '" aria-controls="ttBody-' +
      x.k +
      '" id="ttTop-' +
      x.k +
      '"><span class="ttn' +
      (done ? ' ok' : '') +
      '" aria-hidden="true">' +
      mark +
      '</span><span class="ttt">' +
      esc(x.t) +
      '<small>' +
      esc(x.s) +
      '</small></span>' +
      (done ? '<span class="ttchip">' + esc(rateWord(a.r)) + '</span>' : '') +
      '<span class="ttcar" aria-hidden="true">' +
      ic(on ? 'chevron-down' : 'chevron-right') +
      '</span></button><div class="ttbody" id="ttBody-' +
      x.k +
      '"' +
      (on ? '' : ' hidden') +
      '><p>' +
      x.d +
      '</p><ul>' +
      x.p
        .map(function (q) {
          return '<li>' + esc(q) + '</li>';
        })
        .join('') +
      '</ul><div class="ttrate" role="group" aria-label="How was “' +
      esc(x.t) +
      '”?">' +
      RATES.map(function (r) {
        return (
          '<button type="button" data-r="' +
          r[0] +
          '" aria-pressed="' +
          (a.r === r[0]) +
          '"' +
          (a.r === r[0] ? ' class="on"' : '') +
          '>' +
          r[1] +
          '</button>'
        );
      }).join('') +
      '</div><textarea class="ttnote" data-note="' +
      x.k +
      '" maxlength="1000" rows="2" placeholder="A note (optional)" aria-label="A note on “' +
      esc(x.t) +
      '” (optional)">' +
      esc(a.n || '') +
      '</textarea></div></div>'
    );
  }
  function render() {
    load();
    D.getElementById('ttList').innerHTML = TASKS.map(function (x, i) {
      return rowHTML(x, i + 1);
    }).join('');
    D.getElementById('ttExtras').innerHTML = EXTRAS.map(function (x) {
      return rowHTML(x, '+');
    }).join('');
    D.getElementById('ttQs').innerHTML =
      QS.map(function (q) {
        return (
          '<label class="ttq"><span class="ttql">' +
          esc(q[1]) +
          '</span><textarea class="ttnote" data-q="' +
          q[0] +
          '" maxlength="1500" rows="2">' +
          esc(st.q[q[0]] || '') +
          '</textarea></label>'
        );
      }).join('') +
      '<div class="ttq"><span class="ttql" id="ttNextL">Would you use it for your next page?</span><div class="ttrate ttnext" role="group" aria-labelledby="ttNextL">' +
      NEXT.map(function (r) {
        return (
          '<button type="button" data-next="' +
          r[0] +
          '" aria-pressed="' +
          (st.q.next === r[0]) +
          '"' +
          (st.q.next === r[0] ? ' class="on"' : '') +
          '>' +
          r[1] +
          '</button>'
        );
      }).join('') +
      '</div></div>';
    D.getElementById('ttName').value = st.name || '';
    progress();
  }
  function progress() {
    const n = answered();
    D.getElementById('ttCount').textContent = n + ' of ' + TASKS.length + ' answered';
    D.getElementById('ttBarFill').style.width = Math.round((n / TASKS.length) * 100) + '%';
    const t = formTarget(),
      // (v318.28) the same details either way, all that context() adds: the share sheet's said only the version and
      // device, and the form's left out the tester number and Home Screen app or tab
      det =
        'a few details (a tester number made on this device, the app’s version, your device, Home Screen app or browser tab, how many markers of each brand, and how many guides and palettes you’ve saved)';
    D.getElementById('ttWhat').textContent = t
      ? 'Send results sends your answers, your name if you give it, and ' +
        det +
        ' to Marker Studio’s maker. Nothing else, and nothing until you tap it.'
      : 'Send results opens the share sheet with your answers, your name if you give it, and ' +
        det +
        ', for you to send to Marker Studio’s maker.';
  }
  function said(t) {
    D.getElementById('ttSaid').textContent = t || '';
  }
  function openTasks() {
    load();
    said(
      st.sends && st.sig === sig()
        ? 'Sent. Thank you. Change anything and you can send it again.'
        : st.sends
          ? 'You’ve changed things since you last sent them.'
          : '',
    );
    // the first one still to answer, open
    if (openK == null) {
      const f = TASKS.find(function (x) {
        return !(st.t[x.k] && st.t[x.k].r);
      });
      openK = f ? f.k : null;
    }
    render();
    openDialog(ov);
    const h = D.getElementById('ttTitle');
    if (h)
      setTimeout(function () {
        if (ov.classList.contains('on') && !ov.contains(D.activeElement)) h.focus({ preventScroll: true });
      }, 0);
  }
  window.openTesterTasks = openTasks;
  function closeTasks() {
    closeDialog(ov);
  }
  function refocus(sel) {
    const el = ov.querySelector(sel);
    if (el) el.focus({ preventScroll: true });
  }
  ov.addEventListener('click', function (e) {
    if (e.target === ov) return closeTasks();
    const t = e.target.closest ? e.target.closest('button') : null;
    if (!t || !ov.contains(t)) return;
    if (t.id === 'ttClose') return closeTasks();
    if (t.id === 'ttSend' || t.id === 'ttSendTop') return sendResults();
    if (t.id === 'ttCopy') return copyResults();
    const row = t.closest('.ttrow');
    if (t.classList.contains('tttop') && row) {
      const k = row.dataset.k;
      openK = openK === k ? null : k;
      render();
      refocus('#ttTop-' + k);
      return;
    }
    if (t.dataset.r && row) {
      const k = row.dataset.k,
        a = st.t[k] || (st.t[k] = {});
      // (tapping the chosen answer again takes it back)
      a.r = a.r === t.dataset.r ? '' : t.dataset.r;
      a.v = ver();
      save();
      render();
      refocus('.ttrow[data-k="' + k + '"] [data-r="' + t.dataset.r + '"]');
      return;
    }
    if (t.dataset.next) {
      st.q.next = st.q.next === t.dataset.next ? '' : t.dataset.next;
      save();
      render();
      refocus('[data-next="' + t.dataset.next + '"]');
    }
  });
  ov.addEventListener('input', function (e) {
    const el = e.target;
    load();
    if (el.dataset.note) {
      const a = st.t[el.dataset.note] || (st.t[el.dataset.note] = {});
      a.n = el.value;
    } else if (el.dataset.q) st.q[el.dataset.q] = el.value;
    else if (el.id === 'ttName') st.name = el.value.trim();
    else return;
    save();
  });
  // (v312.1: both Send results buttons off while one send is under way: tapping the other had sent it twice)
  let sending = false;
  function sendBtns(off) {
    ['ttSend', 'ttSendTop'].forEach(function (id) {
      const b = D.getElementById(id);
      if (b) b.disabled = off;
    });
  }
  // (v318 review) anything to send: a task answered or noted, a last question, or a name
  function anyAnswer() {
    const some = function (o) {
      return Object.keys(o || {}).some(function (k) {
        const v = o[k];
        return v && (typeof v === 'object' ? !!(v.r || (v.n && v.n.trim())) : !!String(v).trim());
      });
    };
    return some(st.t) || some(st.q) || !!(st.name && st.name.trim());
  }
  function sendResults() {
    load();
    if (sending) return;
    // (v318 review: Send results at the top, tapped before answering anything, sent six "not yet"s)
    if (!anyAnswer()) {
      said('Nothing to send yet: answer a task first (Easy, OK, Hard or Didn’t try), then Send results.');
      return;
    }
    if (!formTarget()) return shareResults();
    sending = true;
    sendBtns(true);
    said('Sending…');
    post(resultValues()).then(function (ok) {
      sending = false;
      sendBtns(false);
      if (ok) {
        st.sends = (st.sends || 0) + 1;
        st.sig = sig();
        save();
        said('Sent. Thank you. Change anything and you can send it again.');
      } else
        said(
          'Couldn’t send: check you’re online. Your answers are kept here: try again in a moment, or copy them instead.',
        );
    });
  }
  // no form: the share sheet, or the clipboard
  function shareResults() {
    const text = resultText(),
      subj = 'Marker Studio tester results';
    if (navigator.share) {
      let p;
      try {
        p = Promise.resolve(navigator.share({ title: subj, text: text }));
      } catch (e) {
        p = Promise.reject(e);
      }
      return p.then(
        function () {
          st.sends = (st.sends || 0) + 1;
          st.sig = sig();
          save();
          said('Shared. Thank you.');
        },
        function (e) {
          if (!(e && e.name === 'AbortError')) copyResults();
        },
      );
    }
    return copyResults();
  }
  function copyResults() {
    return copyText(resultText()).then(function (ok) {
      said(
        ok
          ? 'Copied. Paste your answers into a message to Marker Studio’s maker.'
          : 'Couldn’t copy them here.',
      );
    });
  }

  // --- the ways in ---
  D.addEventListener('click', function (e) {
    const b = e.target && e.target.closest && e.target.closest('[data-tasks]');
    if (!b) return;
    e.preventDefault();
    openTasks();
  });
  // (a line of its own under How it works · Help · Send feedback: four links wrapped badly on a small phone)
  const foot = D.querySelector('.homehelp');
  let footBtn = null;
  if (foot) {
    const row = D.createElement('div');
    row.className = 'homehelp tttasksrow';
    footBtn = D.createElement('button');
    footBtn.type = 'button';
    footBtn.id = 'homeTasks';
    footBtn.className = 'hlplink';
    footBtn.setAttribute('data-tasks', '');
    row.appendChild(footBtn);
    foot.insertAdjacentElement('afterend', row);
  }
  // (v318 review, prototype) a card on Home, under its cards, while there are tasks to answer or send: how
  // many are done and the next one ("Next to answer: 2 · Make a guide"; v318.26: "Next" alone read as a button to go
  // on), or "ready to send";
  // it opens the tasks at that one. Gone once they're sent as they are (the line at the foot is the way in then)
  let card = null;
  {
    // (under the Markers, Palette and Library cards: above them, on an iPad the cards no longer lined up with the
    // start card beside them)
    const at = D.querySelector('#homeView .homegrid');
    if (at) {
      card = D.createElement('button');
      card.type = 'button';
      card.id = 'homeTaskCard';
      card.className = 'tthomecard';
      card.setAttribute('data-tasks', '');
      at.insertAdjacentElement('afterend', card);
    }
  }
  function cardSync(n, all, sent) {
    if (!card) return;
    card.hidden = sent;
    if (sent) return;
    const nx = TASKS.find(function (x) {
      return !(st.t[x.k] && st.t[x.k].r);
    });
    card.classList.toggle('ttready', all);
    // (v321: the count in a ring that fills as tasks are answered)
    card.style.setProperty('--p', Math.round((n / TASKS.length) * 100) + '%');
    // (v318.32) the line's last word and the › in one nowrap span, so the › never wraps alone (V1-9: it did on an
    // iPad in portrait). A span, not a no-break space: the tests compare the text
    const line = all
        ? 'All ' + TASKS.length + ' answered: ready to send'
        : 'Next to answer: ' + (TASKS.indexOf(nx) + 1) + ' \u00b7 ' + nx.t,
      sp = line.lastIndexOf(' ');
    card.innerHTML =
      '<span class="ttcn" aria-hidden="true">' +
      n +
      '/' +
      TASKS.length +
      '</span><span class="ttct"><b>Beta tester tasks</b><span>' +
      line.slice(0, sp + 1) +
      '<span class="ttnw">' +
      line.slice(sp + 1) +
      ' <span aria-hidden="true">\u203a</span></span></span></span>';
    card.setAttribute(
      'aria-label',
      'Beta tester tasks, ' +
        n +
        ' of ' +
        TASKS.length +
        ' answered. ' +
        (all ? 'Ready to send.' : 'Next to answer: ' + nx.t + '.'),
    );
  }
  // "Tester tasks · 2 of 6"; "ready to send" once all six are answered and not sent as they are; "sent" after
  function footSync() {
    if (!footBtn) return;
    load();
    const n = answered(),
      all = n === TASKS.length,
      sent = st.sends > 0 && st.sig === sig();
    footBtn.textContent =
      'Tester tasks · ' + (sent ? 'sent' : all ? 'ready to send' : n + ' of ' + TASKS.length);
    footBtn.classList.toggle('ttready', all && !sent);
    cardSync(n, all, sent);
    // (v324: the foot's line goes again while the card shows, as v318.32 had it: two ways in, one above the other,
    // read as two things to do. Both open the tasks at the next one to answer. Once they're sent the card goes and the
    // line, "Tester tasks · sent", is the way back in)
    footBtn.parentNode.style.display = card && !card.hidden ? 'none' : '';
  }
  footSync();

  // --- Send feedback, to the form ---
  const fov = D.getElementById('fbOverlay');
  function fbSaid(t) {
    D.getElementById('fbSaid').textContent = t || '';
  }
  // Send feedback's buttons (safety.js): this dialog when there's a form, else the share sheet as before
  window.openFeedback = function () {
    if (!fov || !formTarget()) return sendFeedback();
    fbSaid('');
    openDialog(fov);
    setTimeout(function () {
      const t = D.getElementById('fbText');
      if (t && fov.classList.contains('on')) t.focus({ preventScroll: true });
    }, 0);
    return Promise.resolve('dialog');
  };
  if (fov) {
    const close = function () {
      closeDialog(fov);
    };
    fov.addEventListener('click', function (e) {
      if (e.target === fov) return close();
      const t = e.target.closest ? e.target.closest('button') : null;
      if (!t) return;
      if (t.id === 'fbClose') return close();
      const box = D.getElementById('fbText'),
        text = box.value.trim();
      if (t.id === 'fbShare') {
        close();
        sendFeedback(text);
        return;
      }
      if (t.id !== 'fbSend') return;
      if (!text) {
        fbSaid('Write a line first: what happened, or what you’d like.');
        box.focus();
        return;
      }
      const v = context('Feedback');
      // (v318.1: not the name given in Tester tasks, which was given for the results; the tester number made on this
      // device still links a note to them in the sheet)
      v.Name = '';
      // (v318.26: and this visit's longest waits, after the Screen line; the details made first and kept whole, the
      // words cut to fit the form's 4000 in place of the end of the details)
      const det =
        '\n\n' +
        (typeof feedbackErrLines === 'function' ? feedbackErrLines() : '') +
        '\nScreen: ' +
        (typeof screenWords === 'function' ? screenWords() : '') +
        (typeof feedbackWaitLines === 'function' ? feedbackWaitLines() : '');
      v.Message =
        typeof feedbackFit === 'function' ? feedbackFit(text, det, 4000) : (text + det).slice(0, 4000);
      t.disabled = true;
      fbSaid('Sending…');
      post(v).then(function (ok) {
        t.disabled = false;
        if (ok) {
          box.value = '';
          close();
          toast('Sent. Thank you.');
        } else
          fbSaid(
            'Couldn’t send: check you’re online. Your words are kept here: try again in a moment, or Share it instead.',
          );
      });
    });
  }
})();
