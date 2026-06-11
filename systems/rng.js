/**
 * Seedable RNG (mulberry32). The game uses an unseeded instance; tests seed it
 * so check rolls and combat math are deterministic.
 */

/** @param {number} seed @returns {() => number} float in [0, 1) */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Roll an n-sided die (1..n). @param {number} sides @param {() => number} rand */
export function rollDie(sides, rand = Math.random) {
  return 1 + Math.floor(rand() * sides);
}

/** Pick a random element. @template T @param {T[]} arr @param {() => number} rand @returns {T} */
export function pick(arr, rand = Math.random) {
  return arr[Math.floor(rand() * arr.length)];
}

/** Weighted pick from [{weight, ...}] entries. @param {() => number} rand */
export function weightedPick(entries, rand = Math.random) {
  const total = entries.reduce((s, e) => s + (e.weight ?? 1), 0);
  let r = rand() * total;
  for (const e of entries) {
    r -= e.weight ?? 1;
    if (r <= 0) return e;
  }
  return entries[entries.length - 1];
}
