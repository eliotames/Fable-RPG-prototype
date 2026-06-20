/**
 * Battlefield — the tactical arena's positioning model: who stands where, who
 * may move where, and who may be targeted. Pure logic over the lane/slot grid
 * (geometry lives in HexGrid); no rendering, no Phaser.
 *
 * Each side owns two lanes — 'front' and 'back' — of `spacesPerLane` slots.
 * Targeting rules (from references/combat-framework.md):
 *   - Melee may be used only from the Frontline and hits the opposing Frontline.
 *   - Ranged may be used from either lane and hits any opposing unit, but takes
 *     an accuracy penalty (flagged here) when fired from the Frontline.
 * No-man's-land rows are traversal/visual only in Phase 1 — units occupy front
 * and back lanes; melee "reaches" across. Obstacle cells block landing.
 */
import { rowIndexFor, cellDistance } from './HexGrid.js';

const LANES = ['front', 'back'];

export class Battlefield {
  /** @param {object} arena arena definition  @param {object[]} units placed runtime units */
  constructor(arena, units) {
    this.spacesPerLane = arena.spacesPerLane;
    this.units = units;
    this.obstacles = arena.obstacles ?? [];
  }

  opposing(side) { return side === 'player' ? 'enemy' : 'player'; }

  /** Living units, optionally filtered to one side. */
  living(side) { return this.units.filter((u) => u.alive && (!side || u.side === side)); }

  /** Living unit occupying a cell, or null. */
  unitAt(side, lane, slot) {
    return this.living(side).find((u) => u.lane === lane && u.slot === slot) ?? null;
  }

  isFrontline(unit) { return unit.lane === 'front'; }

  /** Is a cell occupied by a (non-landable) obstacle? */
  cellBlocked(side, lane, slot) {
    const row = rowIndexFor(side, lane);
    return this.obstacles.some((o) => o.row === row && o.slot === slot);
  }

  /** Empty, landable cells on a side (both lanes). */
  emptyCells(side) {
    const out = [];
    for (const lane of LANES) {
      for (let slot = 0; slot < this.spacesPerLane; slot++) {
        if (!this.unitAt(side, lane, slot) && !this.cellBlocked(side, lane, slot)) out.push({ lane, slot });
      }
    }
    return out;
  }

  /**
   * Targets a unit's basic attack may strike.
   * @returns {{target: object, rangedFromFrontline: boolean}[]}
   */
  legalTargets(unit) {
    const foes = this.living(this.opposing(unit.side));
    if (unit.basicAttack.range === 'melee') {
      if (!this.isFrontline(unit)) return []; // melee only from the Frontline
      return foes.filter((f) => f.lane === 'front').map((target) => ({ target, rangedFromFrontline: false }));
    }
    // ranged: any opposing unit; penalty flagged when firing from the Frontline
    return foes.map((target) => ({ target, rangedFromFrontline: this.isFrontline(unit) }));
  }

  /**
   * Repositions available to a unit: move into an empty cell on its own side, or
   * swap with an ally.
   * @returns {({kind:'move', lane:string, slot:number} | {kind:'swap', lane:string, slot:number, target:object})[]}
   */
  legalMoves(unit) {
    const out = [];
    for (const lane of LANES) {
      for (let slot = 0; slot < this.spacesPerLane; slot++) {
        if (lane === unit.lane && slot === unit.slot) continue;
        const occ = this.unitAt(unit.side, lane, slot);
        if (occ) out.push({ kind: 'swap', lane, slot, target: occ });
        else if (!this.cellBlocked(unit.side, lane, slot)) out.push({ kind: 'move', lane, slot });
      }
    }
    return out;
  }

  /** Move a unit to an empty cell on its own side. */
  move(unit, lane, slot) {
    unit.lane = lane;
    unit.slot = slot;
  }

  /** Swap the cells of two allied units. */
  swap(a, b) {
    [a.lane, b.lane] = [b.lane, a.lane];
    [a.slot, b.slot] = [b.slot, a.slot];
  }

  /** Hex distance between two units (for 'nearest' AI / display). */
  distance(a, b) {
    return cellDistance(
      { rowIndex: rowIndexFor(a.side, a.lane), col: a.slot },
      { rowIndex: rowIndexFor(b.side, b.lane), col: b.slot },
    );
  }
}
