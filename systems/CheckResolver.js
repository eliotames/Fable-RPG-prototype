/**
 * CheckResolver — skill checks, both flavors:
 *  - Passive: a skill value silently meets a threshold (no roll); used for
 *    dialogue "voices" and for surfacing extra options/insights.
 *  - Active: roll die + skill vs DC; success and failure both route somewhere.
 * Dice size and named difficulties come from combat-tuning.json `checks`.
 * Pure logic, seedable for tests.
 */
import { rollDie } from './rng.js';

/** Resolve a DC that may be a number or a named difficulty ("hard"). */
export function resolveDc(tuning, dc) {
  if (typeof dc === 'number') return dc;
  const named = tuning.checks.difficulties[dc];
  if (named === undefined) throw new Error(`Unknown difficulty name "${dc}"`);
  return named;
}

/** A human label for a DC, for option tags like "[Persuasion — Hard]". */
export function difficultyLabel(tuning, dc) {
  const value = resolveDc(tuning, dc);
  let bestName = null;
  let bestValue = -Infinity;
  for (const [name, v] of Object.entries(tuning.checks.difficulties)) {
    if (v <= value && v > bestValue) { bestName = name; bestValue = v; }
  }
  return bestName ? bestName.charAt(0).toUpperCase() + bestName.slice(1) : `DC ${value}`;
}

/** Passive check: no roll, just skill ≥ threshold. */
export function passiveCheck(skillValue, dc) {
  return skillValue >= dc;
}

/**
 * Active check: d{die} + skill vs DC.
 * @returns {{roll: number, skillValue: number, total: number, dc: number, success: boolean}}
 */
export function activeCheck(tuning, skillValue, dc, rand = Math.random) {
  const resolved = resolveDc(tuning, dc);
  const roll = rollDie(tuning.checks.die, rand);
  const total = roll + skillValue;
  return { roll, skillValue, total, dc: resolved, success: total >= resolved };
}
