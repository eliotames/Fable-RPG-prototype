/**
 * TimingJudge — grades timed hits and parries. Pure math; CombatScene supplies
 * elapsed milliseconds, this returns a grade + damage multiplier from
 * combat-tuning.json `timing`.
 */

/**
 * Timed HIT: a cursor sweeps for sweepMs; the perfect moment is the center.
 * @param {number} pressMs when the player pressed, ms since sweep start
 *   (null/undefined = never pressed).
 * @returns {{grade: 'perfect'|'good'|'miss', mult: number, offsetMs: number|null}}
 */
export function gradeHit(timing, pressMs) {
  const t = timing.attack;
  if (pressMs == null) return { grade: 'miss', mult: t.missMult, offsetMs: null };
  const offsetMs = Math.abs(pressMs - t.sweepMs / 2);
  if (offsetMs <= t.perfectMs) return { grade: 'perfect', mult: t.perfectMult, offsetMs };
  if (offsetMs <= t.goodMs) return { grade: 'good', mult: t.goodMult, offsetMs };
  return { grade: 'miss', mult: t.missMult, offsetMs };
}

/**
 * PARRY: after the "!" flash, the player has windowMs to press; within
 * perfectMs of the flash = perfect (negates). Pressing BEFORE the flash
 * (pressMs < 0) is a fail — no mashing through telegraphs.
 * @param {number|null} pressMs press time relative to the flash (negative = early).
 * @returns {{grade: 'perfect'|'good'|'fail', mult: number}}
 */
export function gradeParry(timing, pressMs) {
  const t = timing.parry;
  if (pressMs == null || pressMs < 0 || pressMs > t.windowMs) return { grade: 'fail', mult: t.failMult };
  if (pressMs <= t.perfectMs) return { grade: 'perfect', mult: t.perfectMult };
  return { grade: 'good', mult: t.goodMult };
}

/** Random telegraph delay before the parry flash. */
export function telegraphDelay(timing, rand = Math.random) {
  const t = timing.parry;
  return t.telegraphMinMs + rand() * (t.telegraphMaxMs - t.telegraphMinMs);
}
