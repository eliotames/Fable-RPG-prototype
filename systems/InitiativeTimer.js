/**
 * InitiativeTimer — the tactical arena's action-timer turn order (distinct from
 * the old CombatMath.turnOrder speed-sort, which the legacy combat still uses).
 *
 * Model (references/combat-framework.md):
 *   - Every combatant has a timer in [timerMin, timerMax] (0–100), starting full.
 *   - At the start of each turn, every living combatant's timer decrements by
 *     its Speed (floored at timerMin).
 *   - The combatant with the LOWEST timer acts next; ties break to the highest
 *     Speed (then a stable id, so order is deterministic).
 *   - When a combatant ends its turn, its timer resets to timerMax.
 * Faster units decrement further each turn, so they reach the front of the queue
 * sooner and act more often — Speed drives turn frequency.
 *
 * Operates on plain unit objects with numeric `timer`, `speed`, and `uid`.
 * No Phaser dependency — imported directly by the Node test suite.
 */

/** Set every unit's timer to full. */
export function initTimers(units, tuning) {
  for (const u of units) u.timer = tuning.initiative.timerMax;
}

/** Decrement every (living) unit's timer by its Speed, floored at timerMin. */
export function decrementAll(units, tuning) {
  for (const u of units) u.timer = Math.max(tuning.initiative.timerMin, u.timer - u.speed);
}

/** The unit that acts next: lowest timer, ties → highest Speed, then lowest uid. */
export function pickNext(units) {
  return [...units].sort((a, b) =>
    a.timer - b.timer || b.speed - a.speed || a.uid - b.uid)[0] ?? null;
}

/** Reset a unit's timer to full (call when its turn ends). */
export function resetTimer(unit, tuning) {
  unit.timer = tuning.initiative.timerMax;
}
