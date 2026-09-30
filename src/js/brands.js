/* brand tags: shortest unique uppercase prefix per brand (Copic->C, Ohuhu->O), future-proof for more brands */
const BRANDTAG = (function () {
  const bs = [...new Set(COLORS.map((c) => c.brand))];
  const t = {};
  for (const b of bs) {
    let L = 1,
      tg;
    for (;;) {
      tg = b.slice(0, L).toUpperCase();
      if (bs.filter((x) => x.slice(0, L).toUpperCase() === tg).length === 1 || L >= b.length) break;
      L++;
    }
    t[b] = tg;
  }
  return t;
})();
function bTag(b) {
  return BRANDTAG[b] || (b ? b[0].toUpperCase() : '?');
}
// On screen the letters show where a list mixes brands, and everywhere when your collection does (someone who owns
// both brands sees them on every list; an Ohuhu-only owner sees none on a list of Ohuhu markers). An empty
// collection stands for the whole range, so it mixes. The screen-reader labels always name the brand in full.
// Exports go by what they hold: the brand once when there's only one (brandLine), else the letters and brandKey.
function brandsIn(idxs) {
  const b = [];
  for (const i of idxs) {
    const c = COLORS[i];
    if (c && b.indexOf(c.brand) < 0) b.push(c.brand);
  }
  return b;
}
function collMixed() {
  if (!state.owned.size) return Object.keys(BRANDTAG).length > 1;
  let b = null;
  for (const k of state.owned) {
    const x = k.slice(0, k.indexOf('|'));
    if (b === null) b = x;
    else if (x !== b) return true;
  }
  return false;
}
// letters on screen for a list of these markers
function brandsMixedIn(idxs) {
  return collMixed() || brandsIn(idxs).length > 1;
}
function btHTML(brand, on) {
  return on ? '<span class="bt" aria-hidden="true">' + bTag(brand) + '</span>' : '';
}
// for an export's header: 'Ohuhu markers' when everything in it is one brand, '' when it mixes them (then the letters and brandKey say it)
function brandLine(brands) {
  const b = [...new Set(brands.filter(Boolean))];
  return b.length === 1 ? b[0] + ' markers' : '';
}
function brandKey() {
  return Object.keys(BRANDTAG)
    .sort()
    .map((b) => bTag(b) + ' = ' + b)
    .join('    ');
}
