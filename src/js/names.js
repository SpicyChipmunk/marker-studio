/* ---- guide name generator: reads the palette (hue families, lightness, intensity, spread) and writes an evocative two/three-word name ---- */
var EVO_HUES = {
  red: {
    pale: ['Blush', 'Rosé', 'Petal', 'Strawberry', 'Coral'],
    mid: [
      'Scarlet',
      'Coral',
      'Cherry',
      'Poppy',
      'Crimson',
      'Ruby',
      'Cerise',
      'Rouge',
      'Cinnabar',
      'Vermilion',
      'Lipstick',
    ],
    deep: ['Garnet', 'Merlot', 'Claret', 'Oxblood', 'Bordeaux', 'Cabernet', 'Black Cherry'],
  },
  orange: {
    pale: ['Peach', 'Apricot', 'Melon', 'Nectarine', 'Sherbet'],
    mid: ['Tangerine', 'Ember', 'Papaya', 'Persimmon', 'Coral', 'Mango', 'Paprika', 'Clementine'],
    deep: ['Rust', 'Copper', 'Cognac', 'Terracotta', 'Cinnamon', 'Amberwood', 'Spice'],
  },
  yellow: {
    pale: ['Champagne', 'Butter', 'Vanilla', 'Limoncello', 'Primrose', 'Chiffon'],
    mid: ['Honey', 'Saffron', 'Citrine', 'Gold', 'Sunflower', 'Lemon', 'Buttercup', 'Mimosa', 'Marigold'],
    deep: ['Ochre', 'Mustard', 'Bronze', 'Brass', 'Amber', 'Turmeric', 'Old Gold'],
  },
  lime: {
    pale: ['Pistachio', 'Key Lime', 'Honeydew', 'Pear', 'Celery Silk'],
    mid: ['Chartreuse', 'Lime', 'Absinthe', 'Matcha', 'Kiwi', 'Limeade'],
    deep: ['Olive', 'Moss', 'Lichen', 'Martini Olive', 'Fern Shade'],
  },
  green: {
    pale: ['Mint', 'Sage', 'Celadon', 'Eucalyptus', 'Spearmint'],
    mid: ['Jade', 'Emerald', 'Fern', 'Basil', 'Clover', 'Shamrock', 'Palm'],
    deep: ['Forest', 'Juniper', 'Evergreen', 'Malachite', 'Ivy', 'Bottle Green', 'Pine'],
  },
  teal: {
    pale: ['Sea Glass', 'Seafoam', 'Aqua', 'Glacier', 'Mint Julep'],
    mid: ['Teal', 'Lagoon', 'Turquoise', 'Verdigris', 'Mermaid', 'Tidepool'],
    deep: ['Spruce', 'Peacock', 'Petrol', 'Deep Lagoon', 'Jadeite'],
  },
  blue: {
    pale: ['Powder Blue', 'Sky', 'Cornflower', 'Chambray', 'Ice', 'Periwinkle'],
    mid: ['Cobalt', 'Azure', 'Cerulean', 'Sapphire', 'Denim', 'Delft', 'Riviera Blue'],
    deep: ['Navy', 'Ink', 'Prussian', 'Marine', 'Midnight Blue', 'Oxford'],
  },
  violet: {
    pale: ['Lavender', 'Lilac', 'Wisteria', 'Thistle', 'Heather'],
    mid: ['Amethyst', 'Iris', 'Violet', 'Hyacinth', 'Ultraviolet'],
    deep: ['Aubergine', 'Indigo', 'Blackberry', 'Nightshade', 'Damson'],
  },
  magenta: {
    pale: ['Orchid', 'Peony', 'Mauve', 'Sweet Pea'],
    mid: ['Fuchsia', 'Magenta', 'Raspberry', 'Bougainvillea', 'Hibiscus'],
    deep: ['Plum', 'Mulberry', 'Sangria', 'Boysenberry', 'Black Plum'],
  },
  pink: {
    pale: ['Ballet Pink', 'Petal', 'Cotton Candy', 'Blush', 'Rose Quartz'],
    mid: ['Rose', 'Flamingo', 'Watermelon', 'Cerise', 'Hot Pink', 'Candy'],
    deep: ['Raspberry', 'Rosewood', 'Cranberry', 'Berry', 'Wild Rose'],
  },
};
var EVO_NEUTRAL = {
  pale: ['Linen', 'Pearl', 'Oyster', 'Cashmere', 'Porcelain', 'Ivory', 'Chalk', 'Moonstone', 'Alabaster'],
  mid: ['Pewter', 'Smoke', 'Stone', 'Fog', 'Ash', 'Driftwood', 'Taupe', 'Mink', 'Silver', 'Flint'],
  deep: ['Graphite', 'Onyx', 'Charcoal', 'Slate', 'Obsidian', 'Espresso', 'Gunmetal', 'Soot'],
};
var EVO_MOOD = {
  pale: [
    'Sugared',
    'Powdered',
    'Dewy',
    'Hushed',
    'Whispered',
    'Silken',
    'Blushing',
    'Misted',
    'Pearled',
    'Moonlit',
    'Gauzy',
    'Dreamy',
  ],
  deep: [
    'Midnight',
    'Velvet',
    'Smouldering',
    'Candlelit',
    'Inky',
    'Sultry',
    'Brooding',
    'Dusky',
    'Nocturnal',
    'Shadowed',
    'Moody',
    'Decadent',
  ],
  vivid: [
    'Electric',
    'Fevered',
    'Radiant',
    'Wild',
    'Blazing',
    'Lush',
    'Luminous',
    'Daring',
    'Molten',
    'Sunlit',
    'Juicy',
    'Brazen',
  ],
  soft: [
    'Smoky',
    'Faded',
    'Weathered',
    'Hazy',
    'Dusted',
    'Vintage',
    'Sun-Bleached',
    'Mellow',
    'Wistful',
    'Muted',
  ],
  mid: [
    'Satin',
    'Gilded',
    'Honeyed',
    'Burnished',
    'Glowing',
    'Tender',
    'Glossy',
    'Lacquered',
    'Golden',
    'Silken',
  ],
};
var EVO_VIBE = [
  'Affair',
  'Kiss',
  'Crush',
  'Tryst',
  'Whisper',
  'Serenade',
  'Tango',
  'Rendezvous',
  'Reverie',
  'Allure',
  'Secret',
  'Flirt',
  'Temptation',
  'Siren',
  'Muse',
  'Soirée',
  'Boudoir',
  'Afterglow',
  'Heatwave',
  'Mirage',
  'Riviera',
  'Cabana',
  'Martini',
  'Nightcap',
  'Encore',
  'Spell',
  'Charm',
  'Masquerade',
  'Starlight',
  'Moonrise',
  'Sundown',
  'Lullaby',
  'Sonnet',
  'Daydream',
  'Fever',
  'Rhapsody',
  'Liaison',
  'Desire',
  'Caress',
  'Embrace',
  'Slow Dance',
  'Last Dance',
  'Velvet',
  'Silk',
  'Satin',
  'Lace',
  'Chiffon',
  'Confession',
];
var EVO_NATURE = [
  'Bloom',
  'Tide',
  'Grove',
  'Meadow',
  'Dune',
  'Harbor',
  'Orchard',
  'Glade',
  'Horizon',
  'Aurora',
  'Canyon',
  'Reef',
  'Garden',
  'Willow',
  'Cascade',
  'Twilight',
  'Dusk',
  'Dawn',
  'Haze',
  'Solstice',
  'Monsoon',
  'Tempest',
  'Shore',
  'Oasis',
  'Coast',
  'Isle',
  'Lagoon',
  'Orchid House',
];
var EVO_SPEC_NOUN = [
    'Kaleidoscope',
    'Carnival',
    'Confetti',
    'Rainbow',
    'Spectrum',
    'Disco',
    'Candy Shop',
    'Mosaic',
    'Fiesta',
    'Festival',
    'Jewel Box',
    'Stained Glass',
    'Prism',
    'Pinwheel',
  ],
  EVO_SPEC_ADJ = ['Prismatic', 'Iridescent', 'Opaline', 'Technicolor', 'Kaleidoscopic'],
  EVO_SPECTRUM = EVO_SPEC_NOUN.concat(EVO_SPEC_ADJ);
function _evoRng(a) {
  a = a >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    var t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function _evoHash(s) {
  var x = 2166136261 >>> 0;
  for (var i = 0; i < s.length; i++) {
    x ^= s.charCodeAt(i);
    x = Math.imul(x, 16777619);
  }
  return x >>> 0;
}
function _evoHSL(hex) {
  var q = (hex || '').replace('#', '');
  if (q.length < 6) return null;
  var r = parseInt(q.substr(0, 2), 16) / 255,
    g = parseInt(q.substr(2, 2), 16) / 255,
    b = parseInt(q.substr(4, 2), 16) / 255;
  if (isNaN(r + g + b)) return null;
  var mx = Math.max(r, g, b),
    mn = Math.min(r, g, b),
    d = mx - mn,
    l = (mx + mn) / 2,
    h = 0;
  if (d) {
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h: h, l: l, c: d, s: d ? d / (1 - Math.abs(2 * l - 1) || 1) : 0 };
}
function _evoFam(h) {
  return h < 10
    ? 'red'
    : h < 42
      ? 'orange'
      : h < 68
        ? 'yellow'
        : h < 95
          ? 'lime'
          : h < 162
            ? 'green'
            : h < 198
              ? 'teal'
              : h < 252
                ? 'blue'
                : h < 288
                  ? 'violet'
                  : h < 328
                    ? 'magenta'
                    : h < 348
                      ? 'pink'
                      : 'red';
}
function _evoTone(l) {
  return l > 0.7 ? 'pale' : l < 0.36 ? 'deep' : 'mid';
}
function _evoWords(n) {
  return n
    .toLowerCase()
    .split(/[\s&-]+/)
    .filter(Boolean);
}
function evoName(hexes, seedExtra, avoid) {
  hexes = (hexes || []).filter(Boolean);
  var px = [];
  for (var i = 0; i < hexes.length; i++) {
    var o = _evoHSL(hexes[i]);
    if (o) px.push(o);
  }
  if (!px.length) return 'Colouring guide';
  var n = px.length,
    sumC = 0,
    sumL = 0,
    sx = 0,
    sy = 0,
    fam = {},
    famL = {},
    nC = 0;
  for (i = 0; i < n; i++) {
    var p = px[i];
    sumL += p.l;
    sumC += p.c;
    if (p.c >= 0.14 || (p.s >= 0.28 && p.c >= 0.07)) {
      nC++;
      var wc = Math.max(p.c, 0.14);
      var a = (p.h * Math.PI) / 180;
      sx += Math.cos(a) * wc;
      sy += Math.sin(a) * wc;
      var f = _evoFam(p.h);
      fam[f] = (fam[f] || 0) + wc;
      famL[f] = (famL[f] || 0) + p.l * wc;
    }
  }
  var meanL = sumL / n,
    meanC = sumC / n,
    chromW = 0;
  for (var k in fam) chromW += fam[k];
  var R = chromW ? Math.hypot(sx, sy) / chromW : 0,
    fams = Object.keys(fam).sort(function (a, b) {
      return fam[b] - fam[a];
    });
  var bigFams = fams.filter(function (f) {
    return fam[f] >= chromW * 0.1;
  });
  var type =
    nC < n * 0.4 || meanC < 0.12
      ? 'neutral'
      : (bigFams.length >= 5 && R < 0.5) || (bigFams.length >= 4 && R < 0.3)
        ? 'spectrum'
        : bigFams.length >= 2 && fam[fams[1]] >= chromW * 0.15
          ? 'duo'
          : 'mono';
  var tone = _evoTone(meanL),
    mood =
      tone === 'deep'
        ? 'deep'
        : tone === 'pale'
          ? 'pale'
          : meanC > 0.5
            ? 'vivid'
            : meanC < 0.22
              ? 'soft'
              : 'mid';
  var rng = _evoRng((_evoHash(hexes.join(',')) ^ ((seedExtra || 0) >>> 0)) >>> 0),
    pick = function (a) {
      return a[(rng() * a.length) | 0];
    };
  var hueWord = function (f) {
    var t = _evoTone(famL[f] / fam[f]);
    var L = EVO_HUES[f] || EVO_HUES.red;
    return pick(L[t]);
  };
  var neutralWord = function (t) {
    return pick(EVO_NEUTRAL[t || tone]);
  };
  var T;
  if (type === 'neutral') {
    var n1 = function () {
      return neutralWord();
    };
    T = [
      [
        2,
        function () {
          return pick(EVO_MOOD[tone === 'mid' ? 'soft' : tone]) + ' ' + n1();
        },
      ],
      [
        3,
        function () {
          return n1() + ' ' + pick(EVO_VIBE);
        },
      ],
      [
        2,
        function () {
          return (
            n1() +
            ' & ' +
            neutralWord(tone === 'pale' ? 'mid' : tone === 'deep' ? 'mid' : pick(['pale', 'deep']))
          );
        },
      ],
      [
        1,
        function () {
          return n1() + ' ' + pick(EVO_NATURE);
        },
      ],
    ];
  } else if (type === 'spectrum') {
    T = [
      [
        3,
        function () {
          return hueWord(fams[0]) + ' ' + pick(EVO_SPEC_NOUN);
        },
      ],
      [
        2,
        function () {
          return pick(EVO_SPECTRUM) + ' ' + pick(EVO_VIBE);
        },
      ],
      [
        2,
        function () {
          return pick(EVO_MOOD[mood]) + ' ' + pick(EVO_SPEC_NOUN);
        },
      ],
      [
        2,
        function () {
          return pick(EVO_SPEC_NOUN) + ' ' + pick(EVO_NATURE);
        },
      ],
    ];
  } else if (type === 'duo') {
    var fa = fams[0],
      fb = fams[1];
    T = [
      [
        3,
        function () {
          return hueWord(fa) + ' & ' + hueWord(fb);
        },
      ],
      [
        2,
        function () {
          var b = hueWord(fb);
          for (var q = 0; q < 4 && b.indexOf(' ') >= 0; q++) b = hueWord(fb);
          return b.indexOf(' ') >= 0 ? hueWord(fa) + ' & ' + b : b + '-Kissed ' + hueWord(fa);
        },
      ],
      [
        2,
        function () {
          return hueWord(fa) + ' ' + pick(EVO_VIBE);
        },
      ],
      [
        1,
        function () {
          return pick(EVO_MOOD[mood]) + ' ' + hueWord(fa);
        },
      ],
    ];
  } else {
    var f0 = fams[0] || _evoFam((Math.atan2(sy, sx) * 180) / Math.PI + 360);
    T = [
      [
        3,
        function () {
          return pick(EVO_MOOD[mood]) + ' ' + hueWord(f0);
        },
      ],
      [
        3,
        function () {
          return hueWord(f0) + ' ' + pick(EVO_VIBE);
        },
      ],
      [
        2,
        function () {
          return hueWord(f0) + ' ' + pick(EVO_NATURE);
        },
      ],
      [
        1,
        function () {
          return pick(EVO_MOOD[mood]) + ' ' + pick(EVO_VIBE);
        },
      ],
    ];
  }
  var tot = 0;
  T.forEach(function (t) {
    tot += t[0];
  });
  var av = avoid || null,
    best = null;
  for (var tries = 0; tries < 40; tries++) {
    var r = rng() * tot,
      acc = 0,
      fn = T[0][1];
    for (var j = 0; j < T.length; j++) {
      acc += T[j][0];
      if (r < acc) {
        fn = T[j][1];
        break;
      }
    }
    var name = fn();
    if (name.length > 24) continue;
    var w = _evoWords(name),
      dup = false;
    for (var u = 0; u < w.length; u++) if (w.indexOf(w[u]) !== u) dup = true;
    if (dup) continue;
    if (!best) best = name;
    if (av && av.has && av.has(name.toLowerCase())) continue;
    return name;
  }
  return best || 'Colouring guide';
}
function usedGuideNames(extra) {
  const u = new Set(state.saved.filter((s) => s.type === 'guide').map((s) => (s.name || '').toLowerCase()));
  if (extra) u.add(String(extra).toLowerCase());
  return u;
}
function usedSavedNames() {
  return new Set(
    state.saved.map(function (s) {
      return (s.name || '').toLowerCase();
    }),
  );
}
// the name for a copy, not yet used in the Library: "Rose Tango (copy)", then "(copy 2)", "(copy 3)"; a copy of a copy counts on
function copyName(name, used) {
  var base =
    String(name || '')
      .replace(/\s*\(copy(?: \d+)?\)\s*$/i, '')
      .trim()
      .slice(0, 106) || 'Colouring guide';
  used = used || usedSavedNames();
  for (var i = 1; i < 1000; i++) {
    var n = base + (i === 1 ? ' (copy)' : ' (copy ' + i + ')');
    if (!used.has(n.toLowerCase())) return n;
  }
  return base + ' (copy ' + Date.now() + ')';
}
// a new palette is named from its colours, like a guide, and never repeats a name already in the Library
function paletteName(idxs) {
  var hx = (idxs || [])
      .map(function (i) {
        return COLORS[i] ? COLORS[i].hex : null;
      })
      .filter(Boolean),
    nm = evoName(hx, 0, usedSavedNames());
  return nm === 'Colouring guide' ? 'Palette' : nm;
}
function evoWhen(ts) {
  if (!ts) return '';
  var d = new Date(ts),
    now = new Date();
  var o =
    d.getFullYear() === now.getFullYear()
      ? { month: 'short', day: 'numeric' }
      : { month: 'short', day: 'numeric', year: 'numeric' };
  try {
    return d.toLocaleDateString(undefined, o);
  } catch (e) {
    return '';
  }
}
