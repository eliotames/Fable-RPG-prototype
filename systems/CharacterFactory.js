/**
 * CharacterFactory — turns (race, class, attribute spread) into a playable
 * character: final attributes, skill values, derived combat stats, abilities,
 * starting items. Every coefficient comes from combat-tuning.json.
 * Pure logic, testable in Node (no Phaser).
 */

/**
 * @param {object} reg ContentRegistry
 * @param {{id?: string, name: string, raceId: string, classId: string,
 *          attributes: Object<string, number>, isPlayer?: boolean}} spec
 *   `attributes` are the points as distributed (race/class bonuses NOT included).
 */
export function buildCharacter(reg, spec) {
  const race = reg.races.get(spec.raceId);
  const klass = reg.classes.get(spec.classId);
  if (!race) throw new Error(`buildCharacter: unknown race "${spec.raceId}"`);
  if (!klass) throw new Error(`buildCharacter: unknown class "${spec.classId}"`);

  // Final attribute = distributed points + race bonus + class bonus.
  const attributes = {};
  for (const id of reg.attributes.keys()) {
    attributes[id] = (spec.attributes[id] ?? 0)
      + (race.attributeBonuses[id] ?? 0)
      + (klass.attributeBonuses[id] ?? 0);
  }

  // Skill = governing attribute + race bonus + class bonus.
  const skills = {};
  for (const [id, skill] of reg.skills) {
    skills[id] = (attributes[skill.attribute] ?? 0)
      + (race.skillBonuses[id] ?? 0)
      + (klass.skillBonuses[id] ?? 0);
  }

  const derived = deriveStats(reg.tuning, attributes, klass.armor);
  const abilities = [...new Set([...(race.abilities ?? []), ...klass.abilities])];

  return {
    sourceId: spec.id ?? null,
    name: spec.name,
    raceId: spec.raceId,
    classId: spec.classId,
    isPlayer: !!spec.isPlayer,
    attributes,
    skills,
    abilities,
    maxHp: derived.maxHp,
    hp: derived.maxHp,
    maxFocus: derived.maxFocus,
    focus: derived.maxFocus,
    defense: derived.defense,
    speed: derived.speed,
  };
}

/**
 * Derived stats from attributes via combat-tuning.json `derivation`:
 * each entry is {base, attribute, per} → base + attribute * per.
 */
export function deriveStats(tuning, attributes, armor = 0) {
  const out = {};
  for (const [stat, d] of Object.entries(tuning.derivation)) {
    if (stat === '//') continue;
    out[stat] = Math.round(d.base + (attributes[d.attribute] ?? 0) * d.per);
  }
  out.defense = (out.defense ?? 0) + armor;
  return out;
}

/** Build a recruitable party member from party.json by id. */
export function buildPartyMember(reg, memberId) {
  const m = reg.partyMembers.get(memberId);
  if (!m) throw new Error(`buildPartyMember: unknown party member "${memberId}"`);
  return buildCharacter(reg, {
    id: m.id, name: m.name, raceId: m.race, classId: m.class, attributes: m.attributes,
  });
}

/** Starting attribute block for character creation, all at tuning minimum. */
export function baseAttributes(reg) {
  const out = {};
  for (const id of reg.attributes.keys()) out[id] = reg.tuning.creation.basePerAttribute;
  return out;
}
