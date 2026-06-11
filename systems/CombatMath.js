/**
 * CombatMath — all combat numbers in one place, driven entirely by
 * combat-tuning.json. CombatScene orchestrates; this file calculates.
 * Pure logic, testable in Node.
 */

/** Element multiplier vs a target's weaknesses/resists. */
export function elementMult(tuning, element, target) {
  if (!element) return 1;
  if ((target.weaknesses ?? []).includes(element)) return tuning.elements.weaknessMult;
  if ((target.resists ?? []).includes(element)) return tuning.elements.resistMult;
  return 1;
}

/**
 * Damage for one hit.
 * base = power + scalingAttr * attrCoef, then element/timing/broken multipliers,
 * minus defense * defenseCoef, ± variance, floored at minDamage.
 *
 * @param {object} tuning combat-tuning.json
 * @param {{power: number, element?: string}} move ability or item combat block
 * @param {number} scalingValue attacker's scaling attribute (or attack stat)
 * @param {object} target {defense, weaknesses?, resists?, broken?}
 * @param {{timingMult?: number, parryMult?: number, defendMult?: number}} mults
 * @param {() => number} rand
 */
export function computeDamage(tuning, move, scalingValue, target, mults = {}, rand = Math.random) {
  const d = tuning.damage;
  const base = move.power + scalingValue * d.attrCoef;
  const elem = elementMult(tuning, move.element, target);
  const broken = target.broken ? tuning.break.brokenDamageMult : 1;
  const timing = mults.timingMult ?? 1;
  const parry = mults.parryMult ?? 1;
  const defend = mults.defendMult ?? 1;
  let dmg = base * elem * broken * timing * parry * defend - target.defense * d.defenseCoef;
  const spread = 1 + (rand() * 2 - 1) * d.variance;
  dmg *= spread;
  // A perfect parry fully negates regardless of the minimum-damage floor.
  if (parry === 0) return { amount: 0, element: elem, broken };
  return { amount: Math.max(d.minDamage, Math.round(dmg)), element: elem, broken };
}

/** Healing amount: power + scalingAttr * attrCoef (no defense, no variance). */
export function computeHeal(tuning, move, scalingValue) {
  return Math.round(move.power + scalingValue * tuning.damage.attrCoef);
}

/**
 * Apply a weakness hit to toughness. Returns {toughness, justBroke}.
 * If tuning.break.weaknessOnly, only weakness-element hits chip toughness.
 */
export function applyBreakDamage(tuning, target, element, breakPower = 0) {
  if (target.broken || target.toughness <= 0) return { toughness: target.toughness, justBroke: false };
  const isWeak = (target.weaknesses ?? []).includes(element);
  if (tuning.break.weaknessOnly && !isWeak) return { toughness: target.toughness, justBroke: false };
  const toughness = Math.max(0, target.toughness - breakPower);
  return { toughness, justBroke: toughness === 0 && target.toughness > 0 };
}

/** Speed-descending turn order; ties keep array order (stable sort). */
export function turnOrder(combatants) {
  return [...combatants]
    .filter((c) => c.hp > 0)
    .sort((a, b) => b.speed - a.speed);
}
