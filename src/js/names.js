/* ---- guide name generator: reads the palette (hue families, lightness, intensity, spread) and writes an evocative two/three-word name ----
   (v324) The words: each listed once across all the lists (Coral had been under three families, so it came up three
   times as often), spread over gems and minerals, flowers, creatures, places, weather, textiles and times of day as
   well as food (half of all names had been food or drink: a menu); the romantic words gone (Affair, Crush, Tryst,
   Liaison, Temptation…: a colouring app many families use), British spellings (Harbour, Candyfloss). EVO_FOOD: at most
   one of them in a name. EVO_FIT: an adjective that means a colour (Golden, Inky) only with colours it suits.
   (v324, second pass) More words in every list, and titles of their own beside the two-word names: an old master's
   ("Nocturne in Navy and Gold"), a room or garden ("The Saffron Parlour"), a creature's song, where a flower grows,
   skies, seasons ("Plum Season"), "A Touch of Lilac", "Ode to Teal". */
var EVO_HUES = {
  red: {
    pale: [
      'Blush',
      'Camellia',
      'Rosehip',
      'Salmon',
      'Strawberry',
      'Coral',
      'Seashell',
      'Rosebud',
      'Tea Rose',
      'Conch',
    ],
    mid: [
      'Scarlet',
      'Cherry',
      'Poppy',
      'Crimson',
      'Ruby',
      'Rouge',
      'Cinnabar',
      'Vermilion',
      'Lipstick',
      'Geranium',
      'Pomegranate',
      'Cardinal',
      'Postbox',
      'Ladybird',
      'Robin',
      'Red Admiral',
      'Rowan',
      'Toadstool',
      'Fire Engine',
    ],
    deep: [
      'Garnet',
      'Merlot',
      'Claret',
      'Oxblood',
      'Bordeaux',
      'Black Cherry',
      'Mahogany',
      'Carnelian',
      'Brick',
      'Burgundy',
      'Jasper',
      'Red Oak',
    ],
  },
  orange: {
    pale: [
      'Peach',
      'Apricot',
      'Melon',
      'Sherbet',
      'Sunrise',
      'Daylily',
      'Calendula',
      'Peach Blossom',
      'Honeysuckle',
    ],
    mid: [
      'Tangerine',
      'Ember',
      'Persimmon',
      'Mango',
      'Paprika',
      'Clementine',
      'Marmalade',
      'Pumpkin',
      'Fox',
      'Monarch',
      'Bonfire',
      'Tiger Lily',
      'Koi',
      'Goldfish',
      'Nasturtium',
      'Lantern',
    ],
    deep: [
      'Rust',
      'Copper',
      'Cognac',
      'Terracotta',
      'Cinnamon',
      'Russet',
      'Burnt Sienna',
      'Autumn',
      'Chestnut',
      'Ginger',
      'Conker',
      'Copper Beech',
      'Red Squirrel',
    ],
  },
  yellow: {
    pale: [
      'Champagne',
      'Butter',
      'Vanilla',
      'Primrose',
      'Chiffon',
      'Daffodil',
      'Moonbeam',
      'Straw',
      'Cowslip',
      'Corn Silk',
      'Meadowsweet',
    ],
    mid: [
      'Honey',
      'Saffron',
      'Citrine',
      'Gold',
      'Sunflower',
      'Lemon',
      'Buttercup',
      'Mimosa',
      'Marigold',
      'Canary',
      'Sunbeam',
      'Goldfinch',
      'Dandelion',
      'Bumblebee',
      'Sunshine',
      'Yellowhammer',
      'Celandine',
    ],
    deep: [
      'Ochre',
      'Mustard',
      'Bronze',
      'Brass',
      'Amber',
      'Turmeric',
      'Old Gold',
      'Topaz',
      'Gold Leaf',
      'Harvest',
      'Goldenrod',
      'Wheatfield',
      'Antique Gold',
    ],
  },
  lime: {
    pale: [
      'Pistachio',
      'Key Lime',
      'Honeydew',
      'Pear',
      'Spring Bud',
      'Sprout',
      'Seedling',
      'Pea Shoot',
      'Spring Green',
      'Catkin',
      'Lacewing',
    ],
    mid: [
      'Chartreuse',
      'Lime',
      'Matcha',
      'Kiwi',
      'Grasshopper',
      'Tree Frog',
      'New Leaf',
      'Green Apple',
      'Lily Pad',
      'Peridot',
      'Greenfinch',
      'Gecko',
      'Caterpillar',
    ],
    deep: ['Olive', 'Moss', 'Lichen', 'Bracken', 'Avocado', 'Khaki', 'Hedgerow', 'Seaweed', 'Pondweed'],
  },
  green: {
    pale: ['Mint', 'Sage', 'Celadon', 'Eucalyptus', 'Spearmint', 'Aloe', 'Dewdrop', 'Mistletoe', 'Seagrass'],
    mid: [
      'Jade',
      'Emerald',
      'Fern',
      'Basil',
      'Clover',
      'Shamrock',
      'Palm',
      'Parakeet',
      'Ivy',
      'Holly',
      'Bamboo',
      'Cactus',
      'Dragon',
      'Woodpecker',
    ],
    deep: [
      'Forest',
      'Juniper',
      'Evergreen',
      'Malachite',
      'Bottle Green',
      'Pine',
      'Spruce',
      'Laurel',
      'Cedar',
      'Rainforest',
      'Yew',
      'Fir',
      'Hunter Green',
      'Conifer',
    ],
  },
  teal: {
    pale: [
      'Sea Glass',
      'Seafoam',
      'Aqua',
      'Glacier',
      'Duck Egg',
      'Surf',
      'Shallows',
      'Sea Spray',
      'Rock Pool',
      'Opal',
    ],
    mid: [
      'Teal',
      'Lagoon',
      'Turquoise',
      'Verdigris',
      'Mermaid',
      'Tidepool',
      'Kingfisher',
      'Dragonfly',
      'Caribbean',
      'Aquamarine',
      'Sea Turtle',
      'Kelp',
      'Tourmaline',
    ],
    deep: ['Peacock', 'Petrol', 'Jadeite', 'Deep Sea', 'Mallard', 'Fathom', 'Blue Spruce', 'Sea Moss'],
  },
  blue: {
    pale: [
      'Powder Blue',
      'Sky',
      'Cornflower',
      'Chambray',
      'Ice',
      'Periwinkle',
      'Forget-Me-Not',
      'Frost',
      'Hydrangea',
      'Baby Blue',
      'Snowmelt',
      'Morning Sky',
      'Blue Tit',
    ],
    mid: [
      'Cobalt',
      'Azure',
      'Cerulean',
      'Sapphire',
      'Denim',
      'Delft',
      'Lapis',
      'Ultramarine',
      'Bluebird',
      'Blue Jay',
      'Blue Whale',
      'Sailor Blue',
      'Blueberry',
    ],
    deep: [
      'Navy',
      'Ink',
      'Prussian',
      'Marine',
      'Midnight Blue',
      'Oxford',
      'Admiral',
      'Deep Ocean',
      'Night Sky',
      'Royal Blue',
      'Bilberry',
    ],
  },
  violet: {
    pale: [
      'Lavender',
      'Lilac',
      'Wisteria',
      'Thistle',
      'Heather',
      'Bluebell',
      'Crocus',
      'Bellflower',
      'Harebell',
      'Sea Holly',
    ],
    mid: [
      'Amethyst',
      'Iris',
      'Violet',
      'Hyacinth',
      'Ultraviolet',
      'Pansy',
      'Clematis',
      'Lupin',
      'Purple Emperor',
      'Allium',
      'Petunia',
      'Verbena',
    ],
    deep: ['Aubergine', 'Indigo', 'Blackberry', 'Damson', 'Tyrian', 'Royal Purple', 'Elderberry', 'Sloe'],
  },
  magenta: {
    pale: ['Orchid', 'Peony', 'Mauve', 'Sweet Pea', 'Mallow', 'Cosmos', 'Phlox', 'Sweet William'],
    mid: [
      'Fuchsia',
      'Magenta',
      'Raspberry',
      'Bougainvillea',
      'Hibiscus',
      'Foxglove',
      'Azalea',
      'Rhododendron',
      'Dragon Fruit',
      'Fireweed',
      'Primula',
    ],
    deep: ['Plum', 'Mulberry', 'Boysenberry', 'Beetroot', 'Heliotrope', 'Black Tulip', 'Dark Orchid'],
  },
  pink: {
    pale: [
      'Ballet Pink',
      'Petal',
      'Candyfloss',
      'Rose Quartz',
      'Cherry Blossom',
      'Tutu',
      'Marshmallow',
      'Apple Blossom',
      'Shell Pink',
    ],
    mid: [
      'Rose',
      'Flamingo',
      'Watermelon',
      'Cerise',
      'Hot Pink',
      'Bubblegum',
      'Carnation',
      'Begonia',
      'Rosebay',
      'Coral Pink',
      'Stargazer',
    ],
    deep: ['Rosewood', 'Cranberry', 'Berry', 'Wild Rose', 'Damask', 'Rhubarb', 'Old Rose'],
  },
};
var EVO_NEUTRAL = {
  pale: [
    'Linen',
    'Pearl',
    'Oyster',
    'Cashmere',
    'Porcelain',
    'Ivory',
    'Chalk',
    'Moonstone',
    'Alabaster',
    'Eggshell',
    'Cloud',
    'Snowdrift',
    'Sea Salt',
    'Swan',
    'Parchment',
    'Mist',
  ],
  mid: [
    'Pewter',
    'Smoke',
    'Stone',
    'Fog',
    'Ash',
    'Driftwood',
    'Taupe',
    'Mink',
    'Silver',
    'Flint',
    'Pebble',
    'Dove',
    'Heron',
    'Sandstone',
    'Tweed',
    'Granite',
    'Silver Birch',
    'Mushroom',
    'Moth',
  ],
  deep: [
    'Graphite',
    'Onyx',
    'Charcoal',
    'Slate',
    'Obsidian',
    'Espresso',
    'Gunmetal',
    'Soot',
    'Raven',
    'Basalt',
    'Jet',
    'Storm Cloud',
    'Ironstone',
    'Panther',
  ],
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
    'Frosted',
    'Feathered',
    'Snowy',
    'Airy',
    'Lacy',
  ],
  deep: [
    'Midnight',
    'Velvet',
    'Candlelit',
    'Inky',
    'Dusky',
    'Nocturnal',
    'Shadowed',
    'Moody',
    'Twilit',
    'Stormy',
    'Starlit',
    'Wintry',
  ],
  vivid: [
    'Electric',
    'Radiant',
    'Wild',
    'Blazing',
    'Lush',
    'Luminous',
    'Daring',
    'Molten',
    'Sunlit',
    'Juicy',
    'Bold',
    'Dazzling',
    'Fizzy',
    'Zesty',
    'Sparkling',
    'Vivid',
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
    'Gentle',
    'Quiet',
    'Dusty',
    'Chalky',
    'Drowsy',
  ],
  mid: [
    'Satin',
    'Gilded',
    'Honeyed',
    'Burnished',
    'Glowing',
    'Glossy',
    'Lacquered',
    'Golden',
    'Painted',
    'Shimmering',
    'Enamelled',
    'Polished',
    'Glazed',
  ],
};
// (the moods that mean a colour, and the families they suit: "Golden Turquoise" read as a contradiction)
var EVO_FIT = {
  Golden: ['red', 'orange', 'yellow', 'lime', 'neutral'],
  Gilded: ['red', 'orange', 'yellow', 'lime', 'neutral'],
  Honeyed: ['red', 'orange', 'yellow', 'pink', 'neutral'],
  Burnished: ['red', 'orange', 'yellow', 'neutral'],
  Molten: ['red', 'orange', 'yellow', 'pink', 'magenta'],
  Blazing: ['red', 'orange', 'yellow', 'pink', 'magenta'],
  Blushing: ['red', 'orange', 'pink', 'magenta', 'neutral'],
  Candlelit: ['red', 'orange', 'yellow', 'neutral'],
  Inky: ['blue', 'violet', 'teal', 'green', 'magenta', 'neutral'],
  Midnight: ['blue', 'violet', 'teal', 'green', 'magenta', 'neutral'],
  Frosted: ['blue', 'teal', 'violet', 'green', 'lime', 'pink', 'magenta', 'neutral'],
  Sunlit: ['red', 'orange', 'yellow', 'lime', 'green', 'teal', 'pink'],
  Snowy: ['blue', 'teal', 'violet', 'green', 'pink', 'magenta', 'neutral'],
  Wintry: ['blue', 'teal', 'violet', 'green', 'magenta', 'neutral'],
  Zesty: ['orange', 'yellow', 'lime', 'green'],
  Fizzy: ['red', 'orange', 'yellow', 'lime', 'green', 'teal', 'pink', 'magenta'],
};
var EVO_VIBE = [
  'Whisper',
  'Serenade',
  'Tango',
  'Reverie',
  'Secret',
  'Muse',
  'Soirée',
  'Afterglow',
  'Heatwave',
  'Mirage',
  'Riviera',
  'Cabana',
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
  'Rhapsody',
  'Silk',
  'Lace',
  'Postcard',
  'Parade',
  'Picnic',
  'Holiday',
  'Voyage',
  'Fable',
  'Legend',
  'Echo',
  'Carousel',
  'Kite',
  'Keepsake',
  'Wish',
  'Promise',
  'Story',
  'Jamboree',
  'Tea Party',
  'Treasure',
  'Snow Globe',
  'Music Box',
  'Sketchbook',
  'Lighthouse',
  'Paper Boat',
  'Fairy Tale',
  'Hideaway',
  'Adventure',
  'Escapade',
];
// (a piece of music, for "Mango Nocturne"; and a time, for "Lagoon at Low Tide")
var EVO_PIECE = [
    'Nocturne',
    'Sonata',
    'Ballad',
    'Waltz',
    'Overture',
    'Interlude',
    'Refrain',
    'Prelude',
    'Minuet',
    'Symphony',
    'Concerto',
    'Polka',
    'Fanfare',
    'Étude',
    'Jig',
  ],
  EVO_AT = [
    'First Light',
    'Low Tide',
    'High Summer',
    'Noon',
    'Daybreak',
    'Nightfall',
    'Teatime',
    'Midsummer',
    'Sunset',
    'Lamplight',
    'First Frost',
    'Harvest Moon',
    'Bedtime',
    'Elevenses',
    'Last Light',
  ];
var EVO_NATURE = [
  'Bloom',
  'Tide',
  'Grove',
  'Meadow',
  'Dune',
  'Harbour',
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
  'Valley',
  'Fjord',
  'Brook',
  'Moor',
  'Heath',
  'Cove',
  'Glen',
  'Rainfall',
  'Snowfall',
  'Summit',
  'Estuary',
  'Hollow',
  'Spring',
  'Equinox',
  'Bay',
  'Marsh',
  'Loch',
  'Woodland',
  'Waterfall',
  'Riverbank',
  'Hillside',
];
var EVO_SPEC_NOUN = [
    'Kaleidoscope',
    'Carnival',
    'Confetti',
    'Rainbow',
    'Spectrum',
    'Disco',
    'Sweet Shop',
    'Mosaic',
    'Fiesta',
    'Festival',
    'Jewel Box',
    'Stained Glass',
    'Prism',
    'Pinwheel',
    'Patchwork',
    'Quilt',
    'Bouquet',
    'Bazaar',
    'Regatta',
    'Lanterns',
    'Kites',
    'Fireworks',
    'Harlequin',
    'Tapestry',
    'Medley',
    'Paintbox',
    'Marbles',
    'Bunting',
    'Ribbons',
    'Flower Market',
    'Treasure Chest',
    'Parasols',
    'Beach Huts',
    'Circus',
    'Butterflies',
    'Balloons',
    'Crayon Box',
    'Toy Shop',
    'Sticker Book',
    'Pick and Mix',
    'Funfair',
    'Coral Garden',
    'Hot Air Balloons',
    'Rock Pools',
    'Seed Packets',
    'Button Tin',
    'Gemstones',
    'Street Party',
  ],
  EVO_SPEC_ADJ = ['Prismatic', 'Iridescent', 'Opaline', 'Kaleidoscopic', 'Technicolour', 'Many-Coloured'],
  // (every word for many colours: what the tests check a rainbow page's name has one of)
  // eslint-disable-next-line no-unused-vars
  EVO_SPECTRUM = EVO_SPEC_NOUN.concat(EVO_SPEC_ADJ);
// (v324.1) for titles of their own: the words that are creatures ("Song of the Kingfisher") and flowers ("Where the
// Heather Grows"), from the colour words above; the rooms and gardens of "The Saffron Parlour"; and the old masters'
// titles beside "Study in" ("Nocturne in Navy and Gold", "Arrangement in Grey")
var EVO_CREATURE = new Set(
    (
      'Robin|Red Admiral|Ladybird|Cardinal|Fox|Monarch|Koi|Goldfish|Red Squirrel|Goldfinch|Canary|Bumblebee|' +
      'Yellowhammer|Grasshopper|Tree Frog|Greenfinch|Gecko|Caterpillar|Lacewing|Parakeet|Dragon|Woodpecker|Mermaid|' +
      'Kingfisher|Dragonfly|Sea Turtle|Peacock|Mallard|Blue Tit|Bluebird|Blue Jay|Blue Whale|Purple Emperor|Flamingo|' +
      'Moth|Dove|Heron|Raven|Panther'
    ).split('|'),
  ),
  // (the creatures that are colours in their own right, "Study in Rouge and Fox", "Under Peacock Skies": in any title)
  EVO_HUEBEAST = new Set([
    'Fox',
    'Cardinal',
    'Canary',
    'Kingfisher',
    'Peacock',
    'Flamingo',
    'Raven',
    'Mermaid',
  ]),
  EVO_FLOWER = new Set(
    (
      'Camellia|Rosebud|Tea Rose|Poppy|Geranium|Daylily|Calendula|Honeysuckle|Tiger Lily|Nasturtium|Primrose|' +
      'Daffodil|Cowslip|Meadowsweet|Sunflower|Buttercup|Mimosa|Marigold|Dandelion|Celandine|Goldenrod|Clover|' +
      'Shamrock|Cornflower|Forget-Me-Not|Hydrangea|Lavender|Lilac|Wisteria|Thistle|Heather|Bluebell|Crocus|' +
      'Bellflower|Harebell|Sea Holly|Iris|Hyacinth|Pansy|Clematis|Lupin|Allium|Petunia|Verbena|Orchid|Peony|Sweet Pea|' +
      'Mallow|Cosmos|Phlox|Sweet William|Bougainvillea|Hibiscus|Foxglove|Azalea|Rhododendron|Fireweed|Primula|' +
      'Heliotrope|Black Tulip|Cherry Blossom|Apple Blossom|Peach Blossom|Carnation|Begonia|Rosebay|Stargazer|Wild Rose|' +
      'Rose|Old Rose'
    ).split('|'),
  ),
  EVO_ROOM = [
    'Room',
    'Garden',
    'Parlour',
    'Studio',
    'Atelier',
    'Pavilion',
    'Gallery',
    'Summerhouse',
    'Boathouse',
    'Attic',
    'Greenhouse',
    'Library',
  ],
  EVO_ART = [
    'Study in',
    'Study in',
    'Study in',
    'Portrait in',
    'Sketch in',
    'Nocturne in',
    'Symphony in',
    'Harmony in',
    'Arrangement in',
    'Variations on',
  ];
// food and drink: at most one in a name ("Mango & Gold" had come with "Mango Martini"). Single words, as a name's
// words are matched (Black Cherry by cherry, Sweet Shop by shop, Pea Shoot by shoot: never green, sweet or black)
var EVO_FOOD = new Set(
  (
    'Strawberry Salmon Cherry Pomegranate Merlot Claret Bordeaux Peach Apricot Melon Sherbet Persimmon Mango Paprika ' +
    'Clementine Marmalade Pumpkin Cognac Cinnamon Chestnut Champagne Butter Vanilla Honey Saffron Lemon Mustard ' +
    'Turmeric Pistachio Lime Honeydew Pear Matcha Kiwi Apple Avocado Mint Sage Spearmint Basil Aubergine Blackberry ' +
    'Damson Raspberry Plum Mulberry Boysenberry Beetroot Candyfloss Watermelon Bubblegum Cranberry Berry Espresso ' +
    'Shop Juicy Sugared Honeyed Picnic Teatime Shoot Ginger Mushroom Blueberry Bilberry Elderberry Sloe Fruit ' +
    'Rhubarb Marshmallow Zesty Elevenses Mix'
  )
    .toLowerCase()
    .split(' '),
);
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
const EVO_ARC = {
    red: 'r',
    orange: 'r',
    yellow: 'y',
    lime: 'y',
    green: 'g',
    teal: 'g',
    blue: 'b',
    violet: 'b',
    magenta: 'm',
    pink: 'm',
  },
  EVO_ARC_MIN = 0.04;
// the words of a title, not of its colours: passed over for a name's first word (opts.recent), and words that may
// come twice ("Study in Navy and Gold at Dusk" never does, but "the" and "of" may)
var EVO_JOIN = { and: 1, at: 1, the: 1, of: 1, in: 1, on: 1, a: 1, to: 1 },
  EVO_TITLE_WORDS = {};
'study in notes of the song where grows under skies a touch ode to portrait sketch nocturne symphony harmony arrangement variations on season'
  .split(' ')
  .forEach(function (w) {
    EVO_TITLE_WORDS[w] = 1;
  });
// hexes: one colour per section (or a palette's colours); opts.w: each one's weight, a section's area, so a big sky
// counts as what you see (v324: one per section, a page's many small red flowers had named it over its blue sky);
// opts.recent: names of the last few guides, whose first words this one doesn't start with
function evoName(hexes, seedExtra, avoid, opts) {
  opts = opts || {};
  var wts = opts.w && opts.w.length === (hexes || []).length ? opts.w : null;
  var px = [],
    pw = [],
    hx2 = [];
  for (var i = 0; i < (hexes || []).length; i++) {
    if (!hexes[i]) continue;
    var o = _evoHSL(hexes[i]);
    if (!o) continue;
    px.push(o);
    pw.push(wts ? Math.max(0, +wts[i] || 0) : 1);
    hx2.push(hexes[i]);
  }
  hexes = hx2;
  if (!px.length) return 'Colouring guide';
  var n = 0,
    sumC = 0,
    sumL = 0,
    sx = 0,
    sy = 0,
    fam = {},
    famL = {},
    nC = 0;
  for (i = 0; i < px.length; i++) {
    var p = px[i],
      q = pw[i];
    n += q;
    sumL += p.l * q;
    sumC += p.c * q;
    if (p.c >= 0.14 || (p.s >= 0.28 && p.c >= 0.07)) {
      nC += q;
      var wc = Math.max(p.c, 0.14) * q;
      var a = (p.h * Math.PI) / 180;
      sx += Math.cos(a) * wc;
      sy += Math.sin(a) * wc;
      var f = _evoFam(p.h);
      fam[f] = (fam[f] || 0) + wc;
      famL[f] = (famL[f] || 0) + p.l * wc;
    }
  }
  if (!(n > 0)) return 'Colouring guide';
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
  // (v308) a rainbow: its colours reach every part of the wheel (reds and oranges, yellows, greens, blues, pinks and
  // violets: EVO_ARC), each EVO_ARC_MIN of the colour or more. Weighed by chroma, a rainbow's warm half outweighs its
  // blues, so a full-rainbow page was named for its biggest band ("Paprika Sonnet", "Turquoise Nightcap").
  var arc = {};
  for (var fk in fam) arc[EVO_ARC[fk]] = (arc[EVO_ARC[fk]] || 0) + fam[fk];
  var arcs = 0;
  for (var ak in arc) if (arc[ak] >= chromW * EVO_ARC_MIN) arcs++;
  var type =
    nC < n * 0.4 || meanC < 0.12
      ? 'neutral'
      : (bigFams.length >= 5 && R < 0.5) || (bigFams.length >= 4 && R < 0.3) || arcs >= 5
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
  // (v324.1) a colour word for a title: never a creature ("Study in Tiger", "Under Blue Whale Skies"); and for a season,
  // only what has one, a flower or a fruit ("Plum Season", "Heather Season", not "Cobalt Season"); '' when the family
  // has none at its tone
  var plainWord = function (f, season) {
    var L = (EVO_HUES[f] || EVO_HUES.red)[_evoTone(famL[f] / fam[f])].filter(function (x) {
      return season
        ? EVO_FLOWER.has(x) || EVO_FOOD.has(_evoWords(x)[0])
        : !EVO_CREATURE.has(x) || EVO_HUEBEAST.has(x);
    });
    return L.length ? pick(L) : '';
  };
  var neutralWord = function (t) {
    return pick(EVO_NEUTRAL[t || tone]);
  };
  // (the family a mood word has to suit: the name's own colour, else the page's strongest)
  var lead = type === 'neutral' ? 'neutral' : fams[0] || 'neutral';
  var moodWord = function (m, f) {
    var L = EVO_MOOD[m];
    for (var t = 0; t < 8; t++) {
      var w = pick(L),
        ok = EVO_FIT[w];
      if (!ok || ok.indexOf(f || lead) >= 0) return w;
    }
    return pick(
      L.filter(function (w) {
        return !EVO_FIT[w];
      }),
    );
  };
  // (greys keep to the quiet times of day: "Cashmere at High Summer" read oddly)
  var at = function () {
    var L = EVO_AT.concat(['Dawn', 'Dusk', 'Twilight']);
    if (type === 'neutral')
      L = L.filter(function (w) {
        return ['High Summer', 'Midsummer', 'Noon'].indexOf(w) < 0;
      });
    return pick(L);
  };
  // (v324.1) the title words: a creature or a flower among a family's words at its tone ('' if it has none: that
  // title is passed over), the rooms and the old masters' titles
  var hueOf = function (f, set) {
    var L = f === 'neutral' ? EVO_NEUTRAL[tone] : (EVO_HUES[f] || EVO_HUES.red)[_evoTone(famL[f] / fam[f])];
    L = L.filter(function (x) {
      return set.has(x);
    });
    return L.length ? pick(L) : '';
  };
  var art = function () {
      return pick(EVO_ART);
    },
    room = function () {
      return pick(EVO_ROOM);
    },
    song = function (fs) {
      var c = hueOf(pick(fs), EVO_CREATURE);
      return c ? 'Song of the ' + c : '';
    },
    grows = function (fs) {
      var c = hueOf(pick(fs), EVO_FLOWER);
      return c ? 'Where the ' + c + ' Grows' : '';
    };
  // (v324) templates, weighted: "X & Y" and "Y-Kissed X" each about one name in ten at most (they had been 26% and
  // 13%), with art and music titles ("Study in Teal", "Mango Nocturne", "Teal Hour", "Notes of Ember", "Fern at
  // Daybreak") beside the mood and place ones; (v324.1) and the titles above, about one name in three
  var T;
  if (type === 'neutral') {
    var n1 = function () {
        return neutralWord();
      },
      // (for a title: no creature but one that's a colour, Dove, Heron, Raven: "Under Dove Skies", not "Study in Moth")
      nt = function (t) {
        var L = EVO_NEUTRAL[t || tone].filter(function (x) {
          return !EVO_CREATURE.has(x) || EVO_HUEBEAST.has(x);
        });
        return pick(L);
      };
    T = [
      [
        2,
        function () {
          return moodWord(tone === 'mid' ? 'soft' : tone, 'neutral') + ' ' + n1();
        },
      ],
      [
        2,
        function () {
          return n1() + ' ' + pick(EVO_VIBE);
        },
      ],
      [
        0.5,
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
      [
        1.2,
        function () {
          return art() + ' ' + nt();
        },
      ],
      [
        0.4,
        function () {
          return 'Arrangement in ' + nt() + ' and ' + nt(tone === 'deep' ? 'mid' : 'deep');
        },
      ],
      [
        1,
        function () {
          return n1() + ' at ' + at();
        },
      ],
      [
        1,
        function () {
          return 'The ' + nt() + ' ' + room();
        },
      ],
      [
        0.8,
        function () {
          return song(['neutral']);
        },
      ],
      [
        0.6,
        function () {
          return 'Under ' + nt() + ' Skies';
        },
      ],
    ];
  } else if (type === 'spectrum') {
    // (v324: the page's strongest colour beside a word for many colours, so colourful pages don't all read "… Prism")
    T = [
      [
        4,
        function () {
          return hueWord(fams[0]) + ' ' + pick(EVO_SPEC_NOUN);
        },
      ],
      [
        1,
        function () {
          return pick(EVO_SPEC_ADJ) + ' ' + pick(rng() < 0.5 ? EVO_VIBE : EVO_NATURE);
        },
      ],
      [
        2,
        function () {
          return moodWord(mood) + ' ' + pick(EVO_SPEC_NOUN);
        },
      ],
      [
        2,
        function () {
          return pick(EVO_SPEC_NOUN) + ' at ' + at();
        },
      ],
      [
        1,
        function () {
          return (
            'The ' +
            pick([
              'Kaleidoscope',
              'Carnival',
              'Confetti',
              'Rainbow',
              'Mosaic',
              'Patchwork',
              'Harlequin',
              'Paintbox',
              'Funfair',
              'Bazaar',
              'Circus',
              'Prism',
            ]) +
            ' ' +
            room()
          );
        },
      ],
      [
        0.6,
        function () {
          return pick(EVO_SPEC_ADJ) + ' ' + room();
        },
      ],
      [
        0.5,
        function () {
          return 'Under ' + pick(['Rainbow', 'Confetti', 'Kaleidoscope', 'Bunting', 'Patchwork']) + ' Skies';
        },
      ],
      [
        0.5,
        function () {
          return art() + ' ' + pick(['Rainbow', 'Confetti', 'Mosaic', 'Patchwork', 'Prism']);
        },
      ],
    ];
  } else if (type === 'duo') {
    var fa = fams[0],
      fb = fams[1];
    T = [
      [
        1.2,
        function () {
          return hueWord(fa) + ' & ' + hueWord(fb);
        },
      ],
      [
        1,
        function () {
          // (a light touch of a colour, one word: "Cherry-Kissed Fox"; not a deep one, "Fathom-Kissed Copper")
          if (_evoTone(famL[fb] / fam[fb]) === 'deep') return '';
          var b = plainWord(fb);
          for (var q = 0; q < 4 && (b.indexOf(' ') >= 0 || !b); q++) b = plainWord(fb);
          if (!b) return '';
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
          return moodWord(mood, fa) + ' ' + hueWord(fa);
        },
      ],
      [
        1.2,
        function () {
          return art() + ' ' + plainWord(fa) + ' and ' + plainWord(fb);
        },
      ],
      [
        1,
        function () {
          return hueWord(fa) + ' ' + pick(EVO_PIECE);
        },
      ],
      [
        0.3,
        function () {
          return 'Notes of ' + hueWord(fb);
        },
      ],
      [
        0.5,
        function () {
          return hueWord(fa) + ' Hour';
        },
      ],
      [
        0.8,
        function () {
          return 'The ' + plainWord(fa) + ' ' + room();
        },
      ],
      [
        0.7,
        function () {
          return song([fa, fb]);
        },
      ],
      [
        0.6,
        function () {
          return grows([fa, fb]);
        },
      ],
      [
        0.3,
        function () {
          return 'Under ' + plainWord(fa) + ' Skies';
        },
      ],
      [
        0.4,
        function () {
          var w = plainWord(fa, true);
          return w && w + ' Season';
        },
      ],
      [
        0.3,
        function () {
          return 'A Touch of ' + plainWord(fb);
        },
      ],
    ];
  } else {
    var f0 = fams[0] || _evoFam((Math.atan2(sy, sx) * 180) / Math.PI + 360);
    if (!fam[f0]) {
      fam[f0] = 1;
      famL[f0] = meanL;
    }
    T = [
      [
        3,
        function () {
          return moodWord(mood, f0) + ' ' + hueWord(f0);
        },
      ],
      [
        2,
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
          return moodWord(mood, f0) + ' ' + pick(EVO_VIBE);
        },
      ],
      [
        1,
        function () {
          return hueWord(f0) + ' ' + pick(EVO_PIECE);
        },
      ],
      [
        1.2,
        function () {
          return art() + ' ' + plainWord(f0);
        },
      ],
      [
        0.5,
        function () {
          return hueWord(f0) + ' Hour';
        },
      ],
      [
        1,
        function () {
          return hueWord(f0) + ' at ' + at();
        },
      ],
      [
        0.3,
        function () {
          return 'Notes of ' + hueWord(f0);
        },
      ],
      [
        1,
        function () {
          return 'The ' + plainWord(f0) + ' ' + room();
        },
      ],
      [
        0.8,
        function () {
          return song([f0]);
        },
      ],
      [
        0.7,
        function () {
          return grows([f0]);
        },
      ],
      [
        0.35,
        function () {
          return 'Under ' + plainWord(f0) + ' Skies';
        },
      ],
      [
        0.5,
        function () {
          var w = plainWord(f0, true);
          return w && w + ' Season';
        },
      ],
      [
        0.3,
        function () {
          return 'A Touch of ' + plainWord(f0);
        },
      ],
      [
        0.4,
        function () {
          return 'Ode to ' + plainWord(f0);
        },
      ],
    ];
  }
  var tot = 0;
  T.forEach(function (t) {
    tot += t[0];
  });
  // (the first words of the last few guides: three "Ember …" in a row read as one name)
  var leads = {};
  (opts.recent || []).forEach(function (r) {
    var w0 = _evoWords(String(r || '')).filter(function (x) {
      return !EVO_TITLE_WORDS[x];
    })[0];
    if (w0) leads[w0] = 1;
  });
  var av = avoid || null,
    best = null,
    good = null;
  for (var tries = 0; tries < 60; tries++) {
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
    if (!name || name.length > 24) continue;
    var w = _evoWords(name),
      dup = false,
      food = 0;
    for (var u = 0; u < w.length; u++) {
      if (w.indexOf(w[u]) !== u && !EVO_JOIN[w[u]]) dup = true;
      if (EVO_FOOD.has(w[u])) food++;
    }
    if (dup || food > 1) continue;
    if (!best) best = name;
    if (av && av.has && av.has(name.toLowerCase())) continue;
    if (!good) good = name;
    var w0 = w.filter(function (x) {
      return !EVO_TITLE_WORDS[x];
    })[0];
    if (leads[w0]) continue;
    return name;
  }
  return good || best || 'Colouring guide';
}
// the names of the last few guides saved, newest first (for evoName's opts.recent)
function recentGuideNames(n) {
  return state.saved
    .filter(function (s) {
      return s.type === 'guide';
    })
    .slice()
    .sort(function (a, b) {
      return (+b.ts || 0) - (+a.ts || 0);
    })
    .slice(0, n || 5)
    .map(function (s) {
      return s.name || '';
    });
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
// the name for a copy, not yet used in the Library: "Rose Tango (2)", then "(3)"; a copy of a copy counts on from the
// name it was copied from (a trailing " (n)", or v307's " (copy)", is taken off first). Within 120 characters.
// (v308: the one naming for every name clash: Save a copy, Duplicate, a guide imported again; was "(copy)", "(copy 2)")
function copyName(name, used) {
  // (v318.22 debug: not a year in brackets, part of the name: "Garden (2024)" had become "Garden (2)". A copy's own
  // number has at most three figures; four or more are the name's, "Kew (1759)" too)
  var base =
    String(name || '')
      .replace(/\s*\((?:copy(?: \d+)?|\d{1,3})\)\s*$/i, '')
      .trim() || 'Colouring guide';
  used = used || usedSavedNames();
  for (var i = 2; i < 100000; i++) {
    var suf = ' (' + i + ')',
      n = base.slice(0, 120 - suf.length).trim() + suf;
    if (!used.has(n.toLowerCase())) return n;
  }
  return base.slice(0, 100) + ' (' + Date.now() + ')';
}
// a name for something new that isn't used yet: the name itself when it's free, else as copyName (v308)
function freeName(name, used) {
  used = used || usedSavedNames();
  var n = String(name || '').slice(0, 120);
  return n && !used.has(n.toLowerCase()) ? n : copyName(n, used);
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
