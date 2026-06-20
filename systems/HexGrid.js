/**
 * HexGrid — pure geometry for the tactical arena's point-up hex battlefield.
 *
 * The battlefield is six stacked rows: the enemy's Backline and Frontline at the
 * top, two rows of no-man's-land, then the player's Frontline and Backline at the
 * bottom. Frontlines face each other across no-man's-land. Each row holds
 * `spacesPerLane` cells of uniform width, so column centering stays symmetric and
 * cross-field distances are honest.
 *
 * Pixel-layout constants below are ENGINE GEOMETRY, not balance — they live here
 * (like the literal coordinates throughout scenes/), not in combat-tuning.json.
 * FY=1 keeps hexes flat top-down so click hit-testing against cell centers is
 * exact; an oblique look (FY<1) is a later cosmetic concern.
 *
 * No Phaser dependency — imported directly by the Node test suite.
 */

/** Radius (center → vertex). Sized so 6 rows × 3 lanes frame cleanly at 2560×1440. */
export const R = 78;
/** Vertical foreshortening; 1 = flat top-down (exact hit-testing). */
export const FY = 1;
/** Point-up column spacing (width of a hex). */
export const W = Math.sqrt(3) * R;
/** Row spacing. */
export const VSTEP = 1.5 * R * FY;
/** Canvas-x the rows center on, and y of row 0's centers. */
export const CENTER_X = 1280;
export const ORIGIN_Y = 300;

/** The six rows, top (enemy backline) to bottom (player backline). */
export const ROWS = [
  { side: 'enemy', lane: 'back' },
  { side: 'enemy', lane: 'front' },
  { side: 'noman', lane: 0 },
  { side: 'noman', lane: 1 },
  { side: 'player', lane: 'front' },
  { side: 'player', lane: 'back' },
];

/** Row index in ROWS for a side+lane (player/enemy only). */
export function rowIndexFor(side, lane) {
  const i = ROWS.findIndex((r) => r.side === side && r.lane === lane);
  if (i < 0) throw new Error(`no row for ${side}/${lane}`);
  return i;
}

/** Pixel center of a cell. @param {number} rowIndex @param {number} col @param {number} spacesPerLane */
export function cellPixel(rowIndex, col, spacesPerLane) {
  // alternate rows half-staggered for the interlocking look, kept centered (±W/4)
  const stagger = (rowIndex % 2 ? W / 2 : 0) - W / 4;
  const x = CENTER_X + (col - (spacesPerLane - 1) / 2) * W + stagger;
  const y = ORIGIN_Y + rowIndex * VSTEP;
  return { x, y };
}

/** Six point-up hex vertices around (cx, cy). */
export function hexCorners(cx, cy) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 90); // -90° → a vertex points straight up
    pts.push({ x: cx + R * Math.cos(a), y: cy + R * FY * Math.sin(a) });
  }
  return pts;
}

/** Odd-r offset (rowIndex, col) → axial. Odd rows are staggered right by half. */
function toAxial(rowIndex, col) {
  return { q: col - (rowIndex - (rowIndex & 1)) / 2, r: rowIndex };
}

/** Hex (cube) distance between two cells, each {rowIndex, col}. */
export function cellDistance(a, b) {
  const A = toAxial(a.rowIndex, a.col), B = toAxial(b.rowIndex, b.col);
  const as = -A.q - A.r, bs = -B.q - B.r;
  return (Math.abs(A.q - B.q) + Math.abs(A.r - B.r) + Math.abs(as - bs)) / 2;
}
