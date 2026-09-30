/* ---- Layers: what Escape closes, and the dialogs ----
    Everything that sits over the screen and goes with Escape, top first. One Escape closes the top one open, and only
    that; an Escape from a rename field is the field's own (it cancels the rename: #sfGName in 72-frame.js's headKey,
    a Library row's .sname-in in events.js), whatever is open around it.
      paper spot     Match's "Tap the white paper" while it waits for the tap (match.js): Escape leaves it, and a
                     second one closes Match
      dialog         an .overlay with class "on": the static ones in dialogs.html, and ones made on the fly (the Section
                     edits question, askEdits in 60-persist.js). The one latest in the page counts as on top, even
                     when another opened after it. Escape closes it as a tap on its backdrop does; the welcome has no such close, so it stays
                     (and still takes the Escape). While any dialog is open nothing under it gets Escape (nor Ctrl+Z,
                     87-undo.js), focus mode's keys stand aside (95-mount.js), and How it works doesn't open by itself.
      marker picker  the guide's picker sheet (84-popovers.js): as its Cancel, taking back a pick that was previewing
      sheet          any other guide sheet (72-frame.js): the ⋯ menu, Reset progress's question, Print; focus goes back
                     to what opened it
      section tip    the tip over a tapped section (40-render.js)
      focus sheet    focus mode's Colours sheet
      focus mode     (82-colour-mode.js exitFocus); these two let an Escape from a form field in focus mode go by
      Reveal         (86-reveal-share.js), then
      full screen    (70-view.js)
      paper spot     Palette › From photo's "Tap the white paper" while it waits for the tap (events.js)
    The guide's layers are added when it is first drawn (95-mount.js). Several can be open at once (Help over full
    screen, the ⋯ menu reached by keyboard behind full screen, the Library over a sheet, How it works over Help): each
    Escape closes the top one. Dialogs open and close with openDialog/closeDialog; watching their class (below) does
    the rest: focus moves in, an earlier toast goes, Tab stays inside, and focus goes back to what opened it. A dialog
    made on the fly does its own focus, and leaves the stack as it leaves the page. */
const ESC_FIELDS = '#sfGName, .sname-in, #sfZoneName';
const _layers = [];
// o: {name, order (higher is nearer the top), isOpen(), close(e): false leaves this Escape to the layers under it,
// stop (default true): the Escape stops there (preventDefault, stopPropagation)}
function addLayer(o) {
  _layers.push(o);
  _layers.sort(function (a, b) {
    return b.order - a.order;
  });
  return o;
}
function topDialog() {
  const ovs = document.querySelectorAll('.overlay.on');
  return ovs.length ? ovs[ovs.length - 1] : null;
}
function dialogOpen() {
  return !!document.querySelector('.overlay.on');
}
function openDialog(el) {
  el.classList.add('on');
}
function closeDialog(el) {
  el.classList.remove('on');
}
// a dialog's Escape isn't stopped or marked used, as before this file: nothing further on listens for it
addLayer({
  name: 'dialog',
  order: 100,
  isOpen: dialogOpen,
  close: function () {
    topDialog().dispatchEvent(new MouseEvent('click', { bubbles: true }));
  },
  stop: false,
});
// The one Escape handler. It listens in the capture phase, so it comes before any control's own keys and before focus
// mode's (which leave an Escape already taken alone); a rename field's Escape goes on to the field.
document.addEventListener(
  'keydown',
  function (e) {
    if (e.key !== 'Escape' || e.defaultPrevented) return;
    const t = e.target;
    if (t && t.closest && t.closest(ESC_FIELDS)) return;
    for (let i = 0; i < _layers.length; i++) {
      const L = _layers[i];
      if (!L.isOpen() || L.close(e) === false) continue;
      if (L.stop !== false) {
        e.stopPropagation();
        e.preventDefault();
      }
      return;
    }
  },
  true,
);
(function () {
  const FOC =
    'button:not([disabled]),[href],input:not([type=hidden]),select,textarea,[tabindex]:not([tabindex="-1"])';
  const back = new Map();
  const vis = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  // closing a dialog returns focus to what opened it. Chromium may still report the hidden Close button as focused when
  // this runs (Safari goes on reporting it), so focus left inside the closed dialog (or on something hidden) counts as
  // no focus.
  // A toast from before a dialog opened is about the screen underneath: it goes. On a touch screen the dialog itself takes
  // focus (no focus ring on a button nobody touched); with a keyboard or mouse its first control does. A marker cell
  // redrawn while its sheet was open is found again by its number (data-i).
  document.querySelectorAll('.overlay').forEach((ov) => {
    new MutationObserver(() => {
      const on = ov.classList.contains('on');
      if (on && !back.has(ov)) {
        back.set(ov, document.activeElement);
        if (Date.now() - (toast._at || 0) > 150) hideToast();
        setTimeout(() => {
          if (ov.contains(document.activeElement)) return;
          const coarse = !!(window.matchMedia && matchMedia('(pointer:coarse)').matches),
            card = ov.firstElementChild;
          if (coarse && card) {
            card.tabIndex = -1;
            card.focus({ preventScroll: true });
            return;
          }
          // a dialog's own first choice (data-first: How it works' Next), else its first control
          const f =
            [...ov.querySelectorAll('[data-first]')].find(vis) || [...ov.querySelectorAll(FOC)].find(vis);
          if (f) f.focus({ preventScroll: true });
        }, 30);
      } else if (!on && back.has(ov)) {
        const r = back.get(ov);
        back.delete(ov);
        setTimeout(() => {
          const a = document.activeElement;
          if (a && a !== document.body && !ov.contains(a) && vis(a)) return;
          const ri = r && !r.isConnected && r.dataset ? r.dataset.i : null,
            t =
              r && r.isConnected && vis(r)
                ? r
                : (ri != null && [...document.querySelectorAll('.cell[data-i="' + ri + '"]')].find(vis)) ||
                  document.querySelector('.modes button.on');
          if (t && t !== document.body && t.focus) t.focus({ preventScroll: true });
          // nothing to go back to (Safari doesn't focus a button that's clicked, so the opener is often the page
          // itself), or it wouldn't take focus: focus mustn't stay on a control of the closed dialog, where Safari
          // leaves it (Tab would then start from inside a hidden dialog)
          if (ov.contains(document.activeElement)) document.activeElement.blur();
        }, 0);
      }
    }).observe(ov, { attributes: true, attributeFilter: ['class'] });
  });
  // Tab stays in the top dialog, and reaches a toast's button (Undo) while one is showing, after the dialog's last control
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const ov = topDialog();
    if (!ov) return;
    const ts = document.getElementById('msToast'),
      tb = ts && ts.classList.contains('on') ? [...ts.querySelectorAll('button')] : [],
      of = [...ov.querySelectorAll(FOC)].filter(vis),
      f = of.concat(tb);
    if (!f.length) return;
    const a = f[0],
      z = f[f.length - 1],
      act = document.activeElement,
      inside = ov.contains(act) || tb.includes(act);
    if (tb.length && of.length && !e.shiftKey && act === of[of.length - 1]) {
      e.preventDefault();
      tb[0].focus();
      return;
    }
    if (tb.length && of.length && e.shiftKey && act === tb[0]) {
      e.preventDefault();
      of[of.length - 1].focus();
      return;
    }
    if (e.shiftKey && (act === a || !inside)) {
      e.preventDefault();
      z.focus();
    } else if (!e.shiftKey && (act === z || !inside)) {
      e.preventDefault();
      a.focus();
    }
  });
})();
