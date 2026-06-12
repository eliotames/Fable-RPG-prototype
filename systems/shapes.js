/**
 * Expected shape of every content type. This is the single place the engine
 * describes what JSON it accepts — extend a shape here if you add new fields.
 * Validation errors name the file and the exact field (see Validator.js).
 */
import { S } from './Validator.js';

/** {"type":"flag","flag":"met-senna"} etc. — interpreted by systems/Script.js */
const conditionShape = S.obj(
  { type: S.str },
  {
    open: true,
    optional: {
      flag: S.str, skill: S.str, attribute: S.str, item: S.str,
      race: S.str, class: S.str, member: S.str, ability: S.str,
      quest: S.str, stage: S.str, value: S.num,
    },
  }
);

/** {"type":"setFlag","flag":"gate-open"} etc. — interpreted by systems/Script.js */
const effectShape = S.obj(
  { type: S.str },
  {
    open: true,
    optional: {
      flag: S.str, value: S.any, item: S.str, qty: S.int, member: S.str,
      quest: S.str, stage: S.str, encounter: S.str, onWin: S.str, onLose: S.str,
      fraction: S.num, outcome: S.str, epilogue: S.str, amount: S.num,
    },
  }
);

/** Active skill check on a dialogue option. dc: number or named difficulty. */
const checkShape = S.obj(
  { skill: S.str, dc: S.any, success: S.str, failure: S.str },
  { optional: {} }
);

const dialogueOptionShape = S.obj(
  { text: S.str },
  {
    optional: {
      id: S.str,
      conditions: S.arr(conditionShape),
      check: checkShape,
      effects: S.arr(effectShape),
      next: S.str,
    },
  }
);

const dialogueNodeShape = S.obj(
  { text: S.str },
  {
    optional: {
      speaker: S.str,
      voices: S.arr(S.obj({ skill: S.str, dc: S.num, text: S.str })),
      options: S.arr(dialogueOptionShape),
      effects: S.arr(effectShape),
      next: S.str,
      // evaluated on node entry, before rendering: first match wins
      redirects: S.arr(S.obj({ node: S.str }, { optional: { conditions: S.arr(conditionShape) } })),
    },
  }
);

const combatUseShape = S.obj(
  { kind: S.oneOf(['damage', 'heal']), power: S.num, target: S.oneOf(['enemy', 'ally', 'self']) },
  { optional: { element: S.str, breakPower: S.num, timed: S.bool } }
);

export const shapes = {
  manifest: S.obj({
    files: S.arr(S.obj({ key: S.str, type: S.str, path: S.str })),
  }),

  attributes: S.obj({
    attributes: S.arr(S.obj({ id: S.str, name: S.str, abbr: S.str, desc: S.str })),
  }),

  skills: S.obj({
    skills: S.arr(S.obj(
      { id: S.str, name: S.str, attribute: S.str, desc: S.str },
      { optional: { voiceColor: S.str } }
    )),
  }),

  races: S.obj({
    races: S.arr(S.obj(
      { id: S.str, name: S.str, desc: S.str, attributeBonuses: S.dict(S.int), skillBonuses: S.dict(S.int) },
      { optional: { abilities: S.arr(S.str), blurb: S.str } }
    )),
  }),

  classes: S.obj({
    classes: S.arr(S.obj(
      {
        id: S.str, name: S.str, desc: S.str,
        attributeBonuses: S.dict(S.int), skillBonuses: S.dict(S.int),
        abilities: S.arr(S.str), armor: S.num,
      },
      { optional: { startingItems: S.arr(S.obj({ item: S.str, qty: S.int })), blurb: S.str } }
    )),
  }),

  abilities: S.obj({
    abilities: S.arr(S.obj(
      {
        id: S.str, name: S.str, desc: S.str,
        kind: S.oneOf(['damage', 'heal']),
        element: S.str, power: S.num, scaling: S.str, focusCost: S.num,
        target: S.oneOf(['enemy', 'ally', 'self']),
      },
      { optional: { breakPower: S.num, timed: S.bool, telegraph: S.str } }
    )),
  }),

  items: S.obj({
    items: S.arr(S.obj(
      { id: S.str, name: S.str, desc: S.str, type: S.oneOf(['consumable', 'key', 'trinket']) },
      { optional: { combat: combatUseShape } }
    )),
  }),

  enemies: S.obj({
    enemies: S.arr(S.obj(
      {
        id: S.str, name: S.str, desc: S.str,
        maxHp: S.num, attack: S.num, defense: S.num, speed: S.num, toughness: S.num,
        weaknesses: S.arr(S.str), resists: S.arr(S.str),
        abilities: S.arr(S.str),
        ai: S.obj({
          targeting: S.oneOf(['random', 'weakest', 'strongest']),
          moves: S.arr(S.obj({ ability: S.str, weight: S.num })),
        }),
      },
      { optional: { loreNote: S.str, glyph: S.str, color: S.str } }
    )),
    encounters: S.arr(S.obj(
      { id: S.str, name: S.str, enemies: S.arr(S.str), intro: S.str },
      {
        optional: {
          // story flags can pre-weaken or scout an enemy before the fight
          modifiers: S.arr(S.obj(
            { flag: S.str, enemy: S.str },
            { optional: { toughnessDelta: S.num, revealWeaknesses: S.bool } }
          )),
        },
      }
    )),
  }),

  npcs: S.obj({
    npcs: S.arr(S.obj(
      { id: S.str, name: S.str, dialogue: S.str, glyph: S.str, color: S.str },
      { optional: { desc: S.str } }
    )),
  }),

  party: S.obj({
    partyMembers: S.arr(S.obj(
      {
        id: S.str, name: S.str, race: S.str, class: S.str,
        attributes: S.dict(S.int), bio: S.str,
      },
      { optional: { glyph: S.str, color: S.str } }
    )),
  }),

  quests: S.obj({
    quests: S.arr(S.obj({
      id: S.str, name: S.str,
      stages: S.arr(S.obj({ id: S.str, journal: S.str, hint: S.str })),
    })),
  }),

  dialogue: S.obj({
    id: S.str,
    start: S.str,
    nodes: S.dict(dialogueNodeShape),
  }),

  /** Tiled-format top-down map; only the fields the engine relies on are checked. */
  map: S.obj(
    {
      orientation: S.oneOf(['orthogonal']),
      width: S.int, height: S.int, tilewidth: S.int, tileheight: S.int,
      layers: S.arr(S.any), tilesets: S.arr(S.any),
    },
    { open: true }
  ),

  tuning: S.obj(
    {
      creation: S.obj({ basePerAttribute: S.int, pool: S.int, maxAtCreation: S.int, minPerAttribute: S.int }),
      derivation: S.dict(S.obj({ base: S.num, attribute: S.str, per: S.num })),
      checks: S.obj({ die: S.int, difficulties: S.dict(S.num) }),
      damage: S.obj({ attrCoef: S.num, defenseCoef: S.num, minDamage: S.num, variance: S.num }),
      elements: S.obj({ list: S.arr(S.str), weaknessMult: S.num, resistMult: S.num }),
      timing: S.obj({
        attack: S.obj({ sweepMs: S.num, perfectMs: S.num, goodMs: S.num, perfectMult: S.num, goodMult: S.num, missMult: S.num }),
        parry: S.obj({ telegraphMinMs: S.num, telegraphMaxMs: S.num, windowMs: S.num, perfectMs: S.num, perfectMult: S.num, goodMult: S.num, failMult: S.num }),
      }),
      break: S.obj(
        { weaknessOnly: S.bool, brokenTurns: S.int, brokenDamageMult: S.num, breakBonusDamage: S.num },
        { optional: { recoverToFull: S.bool } }
      ),
      focus: S.obj({ regenPerTurn: S.num, defendRegen: S.num }),
      defend: S.obj({ damageMult: S.num }),
      party: S.obj(
        { maxSize: S.int, healAfterCombat: S.bool },
        { optional: { reviveHpFraction: S.num } }
      ),
    },
    { open: true }
  ),
};

/** Manifest `type` values the engine understands. */
export const KNOWN_TYPES = Object.keys(shapes).filter((t) => t !== 'manifest');
