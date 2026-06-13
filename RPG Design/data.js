/* THE LONG NOON — shared game data & helpers */
(function () {
  const SIL = '#100d09', SIL2 = '#191410', BG = '#201a13', RIM = '#6b5d49';

  function bust(inner) {
    return `<svg viewBox="0 0 100 120" preserveAspectRatio="xMidYMid slice">
      <rect width="100" height="120" fill="${BG}"></rect>
      <circle cx="50" cy="44" r="34" fill="#262017" opacity="0.55"></circle>
      ${inner}
    </svg>`;
  }

  const PORTRAITS = {
    odile: bust(`
      <path d="M14 96 Q26 70 50 70 Q74 70 86 96 L86 120 L14 120 Z" fill="${SIL}"></path>
      <path d="M40 52 Q50 46 60 52 L60 74 L40 74 Z" fill="${SIL}"></path>
      <circle cx="50" cy="44" r="13" fill="${SIL}"></circle>
      <path d="M18 38 Q50 30 82 38 L82 41 Q50 33 18 41 Z" fill="${SIL2}"></path>
      <path d="M36 38 Q38 22 50 22 Q62 22 64 38 Z" fill="${SIL2}"></path>
      <path d="M37 36 L63 36" stroke="var(--accent)" stroke-width="1.5" opacity="0.85"></path>
      <path d="M42 78 L42 96" stroke="${RIM}" stroke-width="1" opacity="0.5"></path>
    `),
    casimir: bust(`
      <path d="M20 100 Q30 72 50 72 Q70 72 80 100 L80 120 L20 120 Z" fill="${SIL}"></path>
      <path d="M50 14 Q66 30 64 56 Q57 64 50 64 Q43 64 36 56 Q34 30 50 14 Z" fill="${SIL2}"></path>
      <circle cx="50" cy="46" r="11" fill="${SIL}"></circle>
      <circle cx="56" cy="44" r="6" fill="none" stroke="var(--brass)" stroke-width="1.4"></circle>
      <path d="M44 80 L44 86 M50 82 L50 90 M56 80 L56 86" stroke="${RIM}" stroke-width="1" opacity="0.55"></path>
    `),
    wren: bust(`
      <path d="M26 102 Q34 78 50 78 Q66 78 74 102 L74 120 L26 120 Z" fill="${SIL}"></path>
      <path d="M38 74 L50 60 L62 74 L62 84 L38 84 Z" fill="${SIL2}"></path>
      <circle cx="50" cy="48" r="12" fill="${SIL}"></circle>
      <path d="M36 42 Q44 30 60 33 L62 40 Q48 36 38 44 Z" fill="${SIL2}"></path>
      <path d="M61 35 L68 31" stroke="${RIM}" stroke-width="1.2"></path>
      <path d="M50 62 L50 70" stroke="var(--accent)" stroke-width="1.4" opacity="0.8"></path>
    `),
    greaves: bust(`
      <path d="M8 88 Q22 66 50 66 Q78 66 92 88 L92 120 L8 120 Z" fill="${SIL}"></path>
      <circle cx="50" cy="46" r="15" fill="${SIL}"></circle>
      <path d="M34 40 Q50 32 66 40 L66 44 Q50 37 34 44 Z" fill="${SIL2}"></path>
      <path d="M74 28 L92 66" stroke="${SIL2}" stroke-width="4"></path>
      <path d="M70 22 L80 34" stroke="${RIM}" stroke-width="1.2" opacity="0.6"></path>
    `),
    vicar: bust(`
      <path d="M24 104 Q32 76 50 76 Q68 76 76 104 L76 120 L24 120 Z" fill="${SIL}"></path>
      <path d="M42 12 L50 4 L58 12 L60 48 L40 48 Z" fill="${SIL2}"></path>
      <circle cx="50" cy="56" r="11" fill="${SIL}"></circle>
      <path d="M42 14 L58 14 M42 22 L58 22" stroke="${RIM}" stroke-width="0.8" opacity="0.5"></path>
      <circle cx="30" cy="98" r="3" fill="none" stroke="var(--brass)" stroke-width="1"></circle>
      <path d="M30 95 L34 80" stroke="${RIM}" stroke-width="0.8"></path>
    `),
    tallow: bust(`
      <path d="M22 108 Q28 84 50 84 Q72 84 78 108 L78 120 L22 120 Z" fill="${SIL}"></path>
      <path d="M36 70 Q32 36 50 32 Q68 36 66 64 Q70 78 60 82 Q44 86 36 70 Z" fill="${SIL2}"></path>
      <path d="M50 30 L50 24" stroke="${RIM}" stroke-width="1"></path>
      <path d="M50 22 q3 -4 0 -7 q-3 3 0 7" fill="var(--accent-bright)" opacity="0.9"></path>
      <path d="M44 88 Q46 98 44 108 M56 86 Q59 96 57 106" stroke="${SIL}" stroke-width="2" opacity="0.7"></path>
    `),
    ulm: bust(`
      <path d="M12 92 Q26 68 50 68 Q74 68 88 92 L88 120 L12 120 Z" fill="${SIL}"></path>
      <circle cx="50" cy="44" r="16" fill="${SIL}"></circle>
      <path d="M40 52 Q50 58 60 52 L60 56 Q50 62 40 56 Z" fill="${SIL2}"></path>
      <path d="M34 78 L66 78 M36 92 L64 92" stroke="${RIM}" stroke-width="1" opacity="0.45"></path>
      <circle cx="64" cy="36" r="1.6" fill="var(--brass)"></circle>
    `),
  };

  const SKILL_DEFS = {
    GRIT:  [['Iron Hand', 'Shoot straight while the world ends.'],
            ['Endure', 'Take the blow. Stand anyway.'],
            ['Menace', 'Make violence unnecessary by promising it.'],
            ['Labor', 'Dig, haul, pry, carry the dead.']],
    GUILE: [['Sleight', 'Hands quicker than honest eyes.'],
            ['Veilcraft', 'Move as the shadow of a stalled sun.'],
            ['Silver Tongue', 'Sell a drowning man his own river.'],
            ['Appraise', 'Know what a thing is worth, and to whom.']],
    LORE:  [['Horology', 'Read the gears beneath the world.'],
            ['Liturgy', 'The old rites. Some still answer.'],
            ['Physic', 'Stitch what can be stitched.'],
            ['Annals', 'Remember what the city would rather forget.']],
    NERVE: [['Composure', 'Keep your face when the bell tolls wrong.'],
            ['Intuition', 'Hear the lie underneath the words.'],
            ['Vigil', 'Notice the thing that notices you.'],
            ['Resolve', 'Hold the line inside your own skull.']],
  };

  const PARTY = [
    {
      id: 'odile', name: 'Odile Vance', epithet: 'The Warden',
      cls: 'Gun-Warden of the Meridian Line', lvl: 7,
      hp: [52, 64], res: [31, 40], ap: 6, init: 14, armor: 3,
      attrs: { GRIT: 4, GUILE: 2, LORE: 1, NERVE: 3 },
      skills: { 'Iron Hand': 9, 'Endure': 6, 'Menace': 7, 'Labor': 5, 'Sleight': 3, 'Veilcraft': 2, 'Silver Tongue': 4, 'Appraise': 3, 'Horology': 1, 'Liturgy': 2, 'Physic': 2, 'Annals': 1, 'Composure': 6, 'Intuition': 5, 'Vigil': 4, 'Resolve': 6 },
      status: ['Dust-Lunged — −1 Endure', 'Oathbound — +1 Resolve before noon'],
      bio: 'Last warden of a rail line that no longer runs. She kept the timetable for two years after the sun stopped, out of spite. The Company never paid her. She never asked twice; the second asking was done with the Sequence Six.',
    },
    {
      id: 'casimir', name: 'Casimir Mott', epithet: 'The Horologist',
      cls: 'Lapsed Brother of the Brass Synod', lvl: 7,
      hp: [38, 44], res: [52, 55], ap: 6, init: 11, armor: 1,
      attrs: { GRIT: 1, GUILE: 2, LORE: 4, NERVE: 3 },
      skills: { 'Iron Hand': 2, 'Endure': 2, 'Menace': 1, 'Labor': 2, 'Sleight': 4, 'Veilcraft': 3, 'Silver Tongue': 5, 'Appraise': 6, 'Horology': 9, 'Liturgy': 8, 'Physic': 6, 'Annals': 7, 'Composure': 4, 'Intuition': 5, 'Vigil': 5, 'Resolve': 3 },
      status: ['Excommunicate — Synod doors closed', 'Lamp-Eyed — +1 Vigil underground'],
      bio: 'He wound the cathedral escapement for eleven years and swears it wound him back. Defrocked for asking, in writing, what the sun was owed. The Synod kept his lens; he kept the question.',
    },
    {
      id: 'wren', name: 'Wren Tallow', epithet: 'The Latchkey',
      cls: 'Housebreaker, Dust Court Bastard', lvl: 7,
      hp: [44, 48], res: [36, 42], ap: 7, init: 17, armor: 2,
      attrs: { GRIT: 2, GUILE: 4, LORE: 2, NERVE: 2 },
      skills: { 'Iron Hand': 4, 'Endure': 4, 'Menace': 2, 'Labor': 3, 'Sleight': 9, 'Veilcraft': 8, 'Silver Tongue': 6, 'Appraise': 7, 'Horology': 4, 'Liturgy': 1, 'Physic': 3, 'Annals': 2, 'Composure': 5, 'Intuition': 4, 'Vigil': 6, 'Resolve': 3 },
      status: ['Marked — the Dust Court remembers'],
      bio: 'Born under a gambling debt and raised as collateral. There is no lock in Halver\u2019s Cross she has not opened, including several she should have left shut. Sleeps facing the door. Both doors.',
    },
    {
      id: 'greaves', name: 'Sexton Greaves', epithet: 'The Gravedigger',
      cls: 'Lay-Brother of the Quiet Yard', lvl: 7,
      hp: [71, 78], res: [44, 50], ap: 5, init: 8, armor: 4,
      attrs: { GRIT: 5, GUILE: 1, LORE: 2, NERVE: 4 },
      skills: { 'Iron Hand': 5, 'Endure': 9, 'Menace': 8, 'Labor': 9, 'Sleight': 1, 'Veilcraft': 1, 'Silver Tongue': 2, 'Appraise': 2, 'Horology': 1, 'Liturgy': 6, 'Physic': 4, 'Annals': 3, 'Composure': 7, 'Intuition': 4, 'Vigil': 5, 'Resolve': 8 },
      status: ['Consecrated Hands — undead fear his grip'],
      bio: 'Six years of noon and the dead still expect burying. Greaves obliges. He speaks rarely, digs constantly, and has opinions about exactly one subject: what the city owes the people under it.',
    },
  ];

  const ENEMIES = [
    { id: 'vicar', name: 'Rust-Vicar', epithet: 'of the Stalled Choir', hp: [88, 88], armor: 5 },
    { id: 'tallow1', pid: 'tallow', name: 'Tallowman', epithet: 'half-rendered', hp: [26, 34], armor: 0 },
    { id: 'tallow2', pid: 'tallow', name: 'Tallowman', epithet: 'still warm', hp: [41, 41], armor: 0 },
  ];

  const EQUIP = {
    odile: [
      ['Head', 'Warden\u2019s Hat'], ['Coat', 'Duster, Oil-Boiled'], ['Hands', '\u2014'],
      ['Weapon', 'The Sequence Six'], ['Off Hand', 'Iron Lantern'], ['Charm', 'Tin Vow'],
      ['Belt', 'Cartridge Sash'], ['Boots', 'Stirrup Boots'],
    ],
    casimir: [
      ['Head', 'Cowl of the Synod'], ['Coat', 'Pilgrim Greatcoat'], ['Hands', 'Winding Gloves'],
      ['Weapon', 'Censer of Spent Hours'], ['Off Hand', 'The Kept Lens'], ['Charm', 'Escapement Tooth'],
      ['Belt', 'Tool Roll'], ['Boots', '\u2014'],
    ],
    wren: [
      ['Head', 'Flat Cap'], ['Coat', 'Whisper Jacket'], ['Hands', 'Second Skins'],
      ['Weapon', 'Knifesong (pair)'], ['Off Hand', '\u2014'], ['Charm', 'Loaded Bone Die'],
      ['Belt', 'Pick Wallet'], ['Boots', 'Felt-Soled Boots'],
    ],
    greaves: [
      ['Head', '\u2014'], ['Coat', 'Sexton\u2019s Apron'], ['Hands', 'Consecrated Wraps'],
      ['Weapon', 'The Long Spade'], ['Off Hand', 'Coffin Plate'], ['Charm', 'Soil of the Yard'],
      ['Belt', 'Rope & Bell'], ['Boots', 'Mud Boots'],
    ],
  };

  const PACK = [
    { n: 'Cartridges, .44 Liturgical', q: 18, kind: 'Ammunition', wt: 1.2, val: 9, icon: 'ammo',
      d: 'Each round stamped with a minute-mark. The Synod blessed the press, not the bullets; a fine distinction, billed separately.' },
    { n: 'Physic Kit', q: 2, kind: 'Remedy', wt: 1.5, val: 14, icon: 'kit',
      d: 'Catgut, laudanum, a steel needle and no promises. Restores 12\u201318 Vitality outside of harm\u2019s way.' },
    { n: 'Tallow Candle', q: 6, kind: 'Sundry', wt: 0.3, val: 1, icon: 'candle',
      d: 'Renders a clean, honest light. In the Undercroft it burns blue at the wick when something is listening.' },
    { n: 'Clockwork Key, Unmarked', q: 1, kind: 'Curio', wt: 0.2, val: '\u2014', icon: 'key',
      d: 'Found on the Keywright\u2019s desk. It fits no lock yet catalogued, which either means nothing or everything.' },
    { n: 'Map of the Undercroft', q: 1, kind: 'Document', wt: 0.1, val: 3, icon: 'map',
      d: 'Torn along the third gallery. Someone has written DO NOT WIND IT in a careful, terrified hand.' },
    { n: 'Rail Spike, Blessed', q: 1, kind: 'Curio', wt: 0.9, val: 6, icon: 'spike',
      d: 'Pulled from the last mile the Meridian Line ever laid. Warm to the touch at seven minutes to noon. Always.' },
    { n: 'Flask of Black Mercury', q: 1, kind: 'Reagent', wt: 0.6, val: 40, icon: 'flask',
      d: 'It runs uphill if you let it. The Synod pays in gold for this; the Dust Court pays in silence.' },
    { n: 'Bone Dice', q: 1, kind: 'Sundry', wt: 0.1, val: 2, icon: 'dice',
      d: 'Wren insists they are not loaded. Appraise 7: they are loaded. Intuition 4: she knows you know.' },
    { n: 'Sealed Letter, Dust Court', q: 1, kind: 'Document', wt: 0.1, val: '\u2014', icon: 'letter',
      d: 'Addressed to no one in ink the color of dried blood. The seal shows a coyote swallowing a pocket watch.' },
    { n: 'Spent Mainspring', q: 3, kind: 'Salvage', wt: 0.8, val: 5, icon: 'spring',
      d: 'Fatigued steel from the cathedral works. Casimir hoards these the way other men hoard regrets.' },
  ];

  const WEAPON_DETAIL = {
    'The Sequence Six': { kind: 'Revolver \u2014 One Hand', stats: 'DMG 7\u201312 \u00b7 RNG 14m \u00b7 AP 2', wt: 2.1, val: 120,
      d: 'Six chambers, each engraved with an hour of the working day. Odile fires them in order. She says the gun keeps time now that nothing else does.' },
  };

  const QUESTS = [
    {
      id: 'stalled', group: 'THE GREAT WORK', title: 'The Stalled Sun', status: 'active',
      loc: 'Halver\u2019s Cross \u2014 the Undercroft',
      objectives: [
        ['Descend to the Vault Meridian', true],
        ['Find the Keywright who fled the Synod', false],
        ['Decide what the sun is owed', false],
      ],
      entries: [
        ['NOON +2,184', 'The Brass Synod admits, after six years and under duress, that the Great Escapement beneath the city has stopped \u2014 and that the sun stopped with it. They do not say which happened first. Casimir says the order matters more than anything has ever mattered.'],
        ['NOON +2,191', 'The Keywright\u2019s workshop stood empty, the kettle still warm in a city where nothing cools. On the desk: an unmarked key and a note reading SEVEN MINUTES WAS THE PRICE. We are going down to the Vault. Greaves is bringing the spade.'],
      ],
    },
    {
      id: 'bell', group: 'LESSER WORKS', title: 'The Hanging Bell', status: 'active',
      loc: 'Gallows Row',
      objectives: [['Learn why the bell rings at no hour', false], ['Speak with Ulm Halversen', true]],
      entries: [['NOON +2,189', 'The bell above Gallows Row rings without rope or hand, and only for funerals that have not happened yet. Ulm keeps a list behind the bar. Three names on it are still drinking.']],
    },
    {
      id: 'tallowdebt', group: 'LESSER WORKS', title: 'A Debt of Tallow', status: 'active',
      loc: 'The Renderworks',
      objectives: [['Find what the Renderworks renders now', false]],
      entries: [['NOON +2,190', 'Wren\u2019s family debt was sold to the Renderworks. The Renderworks has stopped buying fat and started buying debts exclusively. The arithmetic of that is somebody\u2019s nightmare, and it walks at no-hour on soft warm feet.']],
    },
    {
      id: 'teeth', group: 'LESSER WORKS', title: 'The Vicar\u2019s Teeth', status: 'done',
      loc: 'Chapel of the Stalled Choir',
      objectives: [['Recover the reliquary', true], ['Return the teeth. All of them.', true]],
      entries: [['NOON +2,186', 'Returned the reliquary to the chapel. The Rust-Vicar counted the teeth twice and did not thank us. Greaves says you do not thank people for postponing the inevitable; you just count the teeth.']],
    },
    {
      id: 'letters', group: 'LESSER WORKS', title: 'Letters from the Dust Court', status: 'failed',
      loc: 'The Dry Marches',
      objectives: [['Deliver the letters unopened', false]],
      entries: [['NOON +2,188', 'Wren opened the letters. We agreed not to discuss what they said, and we have kept that agreement so thoroughly that none of us has slept properly since. The Court considers the contract void.']],
    },
  ];

  const CHRONICLE = [
    ['NOON +2,191', 'Six years to the day, if days still counted. The city holds its breath out of habit. We stood on the platform of a station with no trains and Odile read the timetable aloud, all of it, like a rite. Nobody laughed.'],
    ['NOON +2,190', 'Casimir bought back his own lens from a pawnshop that should not have had it. He paid in marks. The broker wanted minutes. \u201cEveryone wants minutes,\u201d he said, \u201cthat\u2019s the whole economy now.\u201d'],
    ['NOON +2,187', 'A duel on Gallows Row at seven-to-noon, which is to say: whenever. Both men dead before the bell. The bell rang anyway, twice, satisfied. Greaves buried them facing east, \u201cso they\u2019ll see it first if it ever moves.\u201d'],
    ['NOON +2,184', 'There is a shadow on the sundial in Synod Square and it has not moved in six years and someone, every single morning-that-isn\u2019t, washes it. We do not know who. Vigil 6: the water runs uphill afterward, toward the cathedral.'],
  ];

  function roman(n) { return ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'][n] || n; }
  function bar(cur, max, cls) {
    return `<div class="bar ${cls || ''}"><i style="width:${Math.round((cur / max) * 100)}%"></i></div>`;
  }
  function pips(total, on) {
    let h = '<div class="pips">';
    for (let i = 0; i < total; i++) h += `<span class="pip ${i < on ? 'on' : 'spent'}"></span>`;
    return h + '</div>';
  }
  function portrait(id) { return PORTRAITS[id] || PORTRAITS.odile; }

  window.GAME = { PARTY, ENEMIES, SKILL_DEFS, EQUIP, PACK, WEAPON_DETAIL, QUESTS, CHRONICLE, portrait, roman, bar, pips };
})();
