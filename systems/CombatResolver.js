/**
 * CombatResolver — the tactical arena's combat math: AP economy plus
 * accuracy/evasion, crit, and damage/resistance/guard. Kept separate from the
 * legacy CombatMath.js (which serves the old timed-hit combat).
 *
 * All numbers come from combat-tuning.json's `arena` block; `rand` is injectable
 * (systems/rng.js mulberry32) so the Node test suite is deterministic.
 * No Phaser dependency.
 */

// ----------------------------------------------------------------- AP economy --

/** A unit's effective AP stockpile cap: its own cap, never above the ceiling. */
export function apCapOf(unit, ap) {
  return Math.min(unit.apCap ?? ap.cap, ap.ceiling);
}

/** AP after a start-of-turn gain (carryover preserved, clamped to cap). */
export function apAfterGain(unit, ap) {
  return Math.min(apCapOf(unit, ap), unit.ap + (unit.apGainPerTurn ?? ap.gainPerTurn));
}

/** Add AP (e.g. a basic attack GENERATES AP), clamped to cap. @returns new AP */
export function gainAp(unit, amount, ap) {
  unit.ap = Math.min(apCapOf(unit, ap), unit.ap + amount);
  return unit.ap;
}

export function canSpend(unit, cost) { return unit.ap >= cost; }

/** Spend AP (floored at 0). @returns remaining AP */
export function spend(unit, cost) {
  unit.ap = Math.max(0, unit.ap - cost);
  return unit.ap;
}

/** Clear the one-Major / one-Minor flags for a fresh turn. */
export function resetActionFlags(unit) {
  unit.usedMajor = false;
  unit.usedMinor = false;
}

// ---------------------------------------------------------- accuracy / damage --

/** Evasion that applies against an attack of the given range. */
export function evasionFor(target, range) {
  return range === 'melee' ? target.meleeEvasion : target.rangedEvasion;
}

/**
 * To-hit percentage, clamped to [min, max].
 * @param {{range:string, rangedFromFrontline?:boolean, cover?:string}} ctx
 */
export function hitChance(attacker, target, ctx, acc) {
  let chance = attacker.accuracy - evasionFor(target, ctx.range) * acc.evasionCoef;
  if (ctx.rangedFromFrontline) chance -= acc.rangedFromFrontlinePenalty;
  if (ctx.cover) chance -= acc.coverPenalty[ctx.cover] ?? 0;
  return Math.max(acc.min, Math.min(acc.max, chance));
}

export function rollHit(attacker, target, ctx, acc, rand = Math.random) {
  const chance = hitChance(attacker, target, ctx, acc);
  const roll = rand() * 100;
  return { hit: roll < chance, chance, roll };
}

export function rollCrit(crit, rand = Math.random) {
  return rand() < crit.chance;
}

/**
 * Damage from a landed hit. Attack value = move.power + attacker.power (weapon
 * base + the unit's Power stat). Resistance is flat reduction; Guard absorbs what
 * remains before HP. Floored at minDamage. `rand` of 0.5 yields zero variance.
 * @returns {{amount:number, toGuard:number, toHp:number, crit:boolean}}
 */
export function computeDamage(attacker, target, move, opts, tuning, rand = Math.random) {
  const d = tuning.damage;
  const critMult = opts.crit ? tuning.crit.multiplier : 1;
  const spread = 1 + (rand() - 0.5) * 2 * d.variance;
  const raw = (move.power + attacker.power) * d.powerCoef * critMult * spread
    - (target.resistance ?? 0) * d.resistanceCoef;
  const amount = Math.max(d.minDamage, Math.round(raw));
  const toGuard = Math.min(Math.max(0, target.guard ?? 0), amount);
  return { amount, toGuard, toHp: amount - toGuard, crit: !!opts.crit };
}
