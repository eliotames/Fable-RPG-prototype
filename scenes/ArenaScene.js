/**
 * ArenaScene — standalone tactical-combat playtest (combat-framework.md Phase 1).
 *
 * A self-contained hex-arena encounter, reachable from the main menu and fully
 * DECOUPLED from progression: combatants are instantiated from data/arenas.json
 * + data/arena-combatants.json with stats authored directly, never from
 * GameState/CharacterFactory. The legacy CombatScene is untouched.
 *
 * The scene is the only Phaser-aware orchestrator; all rules live in pure
 * systems: HexGrid (geometry), Battlefield (positioning/targeting),
 * InitiativeTimer (action-timer order), CombatResolver (AP + hit/damage). Every
 * number comes from combat-tuning.json's `arena` block.
 *
 * Foundation actions: Basic Attack (Major; melee from the Frontline hits the
 * opposing Frontline, ranged hits any foe with a Frontline penalty; generates
 * AP), Reposition (Minor; move to an empty cell or swap with an ally), Use Item
 * (Minor; a stub field-kit), End Turn. Simple enemy AI drives the foe side.
 *
 * Single camera, all-UI (like CombatScene). Native 2560×1440.
 */
import { Palette, Ink, displayStyle, proseStyle, monoStyle, track } from '../ui/Theme.js';
import { panel, label, frameButton } from '../ui/widgets.js';
import { addMotes } from '../ui/effects.js';
import { pick } from '../systems/rng.js';
import { Battlefield } from '../systems/Battlefield.js';
import * as Hex from '../systems/HexGrid.js';
import { initTimers, decrementAll, pickNext, resetTimer } from '../systems/InitiativeTimer.js';
import * as CR from '../systems/CombatResolver.js';

const hexNum = (s, fallback) => {
  if (typeof s !== 'string') return fallback;
  const n = parseInt(s.replace('#', ''), 16);
  return Number.isNaN(n) ? fallback : n;
};

export class ArenaScene extends Phaser.Scene {
  constructor() { super('Arena'); }

  /** @param {{arenaId?: string}} data */
  create(data = {}) {
    this.reg = this.registry.get('content');
    this.tuning = this.reg.tuning;
    this.aTune = this.tuning.arena;
    this.rng = Math.random;

    this.arena = this.reg.arenas.get(data.arenaId) ?? [...this.reg.arenas.values()][0];
    this.units = this.instantiateRoster(this.arena);
    this.field = new Battlefield(this.arena, this.units);
    initTimers(this.units, this.aTune);

    this.phase = 'idle';
    this.actor = null;
    this.ended = false;
    this.fieldObjects = [];
    this.menuObjects = [];
    this.detailObjects = [];
    this.chipObjects = [];
    this.logLines = [];

    this.buildChrome();
    this.drawHexes();
    this.log(`— ${this.arena.name} —`);
    if (this.arena.desc) this.log(this.arena.desc);
    this.refresh();
    this.time.delayedCall(700, () => this.nextTurn());
  }

  /** Build runtime unit objects from the roster (stats authored directly in JSON). */
  instantiateRoster(arena) {
    let uid = 0;
    const counts = {};
    const units = arena.roster.map((r) => {
      const def = this.reg.combatants.get(r.combatant);
      counts[def.id] = (counts[def.id] ?? 0) + 1;
      return {
        uid: uid++, defId: def.id,
        name: counts[def.id] > 1 ? `${def.name} ${counts[def.id]}` : def.name,
        side: r.side, lane: r.lane, slot: r.slot,
        glyph: def.glyph ?? def.name.charAt(0),
        colorNum: hexNum(def.color, r.side === 'player' ? 0x9bd3c0 : 0xc0705a),
        maxHp: def.maxHp, hp: def.maxHp,
        speed: def.speed, power: def.power, accuracy: def.accuracy,
        meleeEvasion: def.meleeEvasion, rangedEvasion: def.rangedEvasion,
        resistance: def.resistance, guard: def.guard ?? 0,
        basicAttack: def.basicAttack,
        apCap: def.apCap, apGainPerTurn: def.apGainPerTurn,
        ap: def.apStart ?? this.aTune.ap.start,
        usedMajor: false, usedMinor: false,
        ai: def.ai ?? { targeting: 'lowestHp' },
        timer: 0, alive: true,
      };
    });
    // retroactively number the first of any duplicated template ("Wisp" → "Wisp 1")
    for (const u of units) if (counts[u.defId] > 1 && !/\d$/.test(u.name)) u.name += ' 1';
    return units;
  }

  // ------------------------------------------------------------- static chrome --

  buildChrome() {
    const sw = this.scale.width, sh = this.scale.height;
    this.add.rectangle(0, 0, sw, sh, Palette.bg0).setOrigin(0);
    addMotes(this, { count: 14, depth: 1, region: { x: 940, y: 230, w: 640, h: 740 } });

    const title = this.add.text(sw / 2, 56, this.arena.name.toUpperCase(),
      displayStyle({ fontSize: '46px' })).setOrigin(0.5);
    track(title, 8);
    label(this, sw / 2, 108, 'TACTICAL PLAYTEST', { size: 14, color: Ink.faint, origin: [0.5, 0.5] });

    // panels
    this.detailX = 40; this.detailY = 240; this.detailW = 520; this.detailH = 740;
    panel(this, this.detailX, this.detailY, this.detailW, this.detailH, 0.5);
    label(this, this.detailX + 30, this.detailY + 22, 'COMBATANT', { size: 14, color: Ink.faint });

    this.logX = 2000; this.logY = 240; this.logW = 520; this.logH = 740;
    panel(this, this.logX, this.logY, this.logW, this.logH, 0.5);
    label(this, this.logX + 30, this.logY + 22, 'THE RECORD', { size: 14, color: Ink.faint });
    this.logText = this.add.text(this.logX + 30, this.logY + 64, '',
      proseStyle({ fontSize: '23px', color: Ink.dim, lineSpacing: 8, wordWrap: { width: this.logW - 56 } }));

    this.menuX = 40; this.menuY = 1030; this.menuW = sw - 80; this.menuH = 380;
    panel(this, this.menuX, this.menuY, this.menuW, this.menuH, 0.5);

    // faint lane labels to the left of the battlefield
    const lx = 940;
    const laneLabel = (rowIndex, text) => {
      const { y } = Hex.cellPixel(rowIndex, 0, this.arena.spacesPerLane);
      label(this, lx, y, text, { size: 13, color: Ink.faint, origin: [1, 0.5] });
    };
    laneLabel(0, 'ENEMY · BACK');
    laneLabel(1, 'ENEMY · FRONT');
    laneLabel(2, "NO MAN'S LAND");
    laneLabel(4, 'YOUR · FRONT');
    laneLabel(5, 'YOUR · BACK');
  }

  /** Hex grid + obstacles (static; drawn once). */
  drawHexes() {
    const spp = this.arena.spacesPerLane;
    const g = this.add.graphics();
    Hex.ROWS.forEach((row, rowIndex) => {
      const fill = row.side === 'enemy' ? 0x251715 : row.side === 'player' ? 0x16231a : Palette.bg1;
      for (let col = 0; col < spp; col++) {
        const { x, y } = Hex.cellPixel(rowIndex, col, spp);
        const pts = Hex.hexCorners(x, y); // {x,y}[] — fillPoints accepts Point-likes
        g.fillStyle(fill, 0.85);
        g.fillPoints(pts, true);
        g.lineStyle(2, Palette.line, 1);
        g.strokePoints(pts, true, true);
      }
    });
    // obstacles: inert in Phase 1 (rendered; they block landing in Battlefield)
    for (const o of this.arena.obstacles ?? []) {
      const { x, y } = Hex.cellPixel(o.row, o.slot, spp);
      g.fillStyle(0x3a3026, 1);
      g.fillCircle(x, y, 30);
      g.lineStyle(3, 0x5a4a36, 1);
      g.strokeCircle(x, y, 30);
      this.add.text(x, y, o.kind === 'tree' ? '♣' : '▮',
        monoStyle({ fontSize: '28px', color: Ink.faint })).setOrigin(0.5);
    }
  }

  // -------------------------------------------------------------------- log --

  log(text) {
    this.logLines.push(text);
    this.logText.setText(this.logLines.slice(-16).join('\n'));
  }

  // ----------------------------------------------------------- field render --

  clearGroup(key) { this[key].forEach((o) => o.destroy()); this[key] = []; }

  refresh() {
    this.renderField();
    this.renderChips();
    this.renderDetail(this.actor);
  }

  renderField() {
    this.clearGroup('fieldObjects');
    const spp = this.arena.spacesPerLane;
    const put = (o) => { this.fieldObjects.push(o); return o; };

    // reposition: markers on empty landable cells
    if (this.phase === 'targetMove' && this.actor) {
      for (const m of this.field.legalMoves(this.actor)) {
        if (m.kind !== 'move') continue;
        const row = Hex.rowIndexFor(this.actor.side, m.lane);
        const { x, y } = Hex.cellPixel(row, m.slot, spp);
        const mk = put(this.add.circle(x, y, 24, Palette.verdigris, 0.45).setStrokeStyle(3, Palette.verdigris));
        mk.setInteractive({ useHandCursor: true });
        mk.on('pointerdown', () => this.doMove(m.lane, m.slot));
      }
    }

    const targetable = this.phase === 'targetAttack' && this.actor
      ? new Set(this.field.legalTargets(this.actor).map((e) => e.target.uid)) : new Set();

    for (const u of this.field.living()) {
      const row = Hex.rowIndexFor(u.side, u.lane);
      const { x, y } = Hex.cellPixel(row, u.slot, spp);

      if (u === this.actor) put(this.add.circle(x, y, 50).setStrokeStyle(4, Palette.brass));
      if (targetable.has(u.uid)) put(this.add.circle(x, y, 50).setStrokeStyle(4, Palette.accentBright));
      if (this.phase === 'targetMove' && this.actor && u.side === this.actor.side && u !== this.actor) {
        put(this.add.circle(x, y, 50).setStrokeStyle(4, Palette.verdigris));
      }

      const tok = put(this.add.image(x, y, 'token').setDisplaySize(82, 82).setTint(u.colorNum));
      put(this.add.text(x, y, u.glyph, displayStyle({ fontSize: '40px', color: '#10100c' })).setOrigin(0.5));

      const bw = 96, bh = 12, by = y + 44;
      const bar = put(this.add.graphics());
      bar.fillStyle(Palette.bg3, 1); bar.fillRect(x - bw / 2, by, bw, bh);
      bar.fillStyle(u.hp / u.maxHp > 0.3 ? Palette.verdigris : Palette.accent, 1);
      bar.fillRect(x - bw / 2, by, bw * Math.max(0, u.hp / u.maxHp), bh);
      put(this.add.text(x, by + 16, `${Math.max(0, u.hp)}/${u.maxHp}`,
        monoStyle({ fontSize: '15px', color: Ink.dim })).setOrigin(0.5, 0));

      tok.setInteractive({ useHandCursor: true });
      tok.on('pointerover', () => this.renderDetail(u));
      tok.on('pointerout', () => this.renderDetail(this.actor));
      tok.on('pointerdown', () => this.onTokenClick(u));
    }
  }

  /** Initiative order chips — sorted by who acts soonest (lowest timer). */
  renderChips() {
    this.clearGroup('chipObjects');
    const order = [...this.field.living()].sort((a, b) =>
      a.timer - b.timer || b.speed - a.speed || a.uid - b.uid);
    const w = 64, h = 60, gap = 12;
    order.forEach((u, i) => {
      const x = this.scale.width / 2 + (i - (order.length - 1) / 2) * (w + gap);
      const cont = this.add.container(x, 168);
      const g = this.add.graphics();
      const current = u === this.actor;
      g.fillStyle(Palette.bgPage, 0.85);
      g.fillRect(-w / 2, -h / 2, w, h);
      g.lineStyle(2, current ? Palette.brass : (u.side === 'player' ? Palette.line : 0x4a2620), 1);
      g.strokeRect(-w / 2, -h / 2, w, h);
      cont.add(g);
      cont.add(this.add.text(0, -10, u.glyph,
        monoStyle({ fontSize: '20px', color: current ? Ink.ink : Ink.dim })).setOrigin(0.5));
      cont.add(this.add.text(0, 16, String(Math.round(u.timer)),
        monoStyle({ fontSize: '13px', color: Ink.faint })).setOrigin(0.5));
      this.chipObjects.push(cont);
    });
  }

  renderDetail(unit) {
    this.clearGroup('detailObjects');
    if (!unit) return;
    const x = this.detailX + 30;
    const put = (o) => { this.detailObjects.push(o); return o; };
    put(this.add.text(x, this.detailY + 60, unit.name, displayStyle({ fontSize: '34px' })));
    put(label(this, x, this.detailY + 110,
      `${unit.side} · ${unit.lane}line · ${unit.basicAttack.range} attack`,
      { size: 14, color: Ink.faint }));
    const rows = [
      ['HP', `${Math.max(0, unit.hp)} / ${unit.maxHp}`],
      ['AP', `${unit.ap}`],
      ['POWER', `${unit.power}  (+${unit.basicAttack.power})`],
      ['ACCURACY', `${unit.accuracy}`],
      ['SPEED', `${unit.speed}  ·  timer ${Math.round(unit.timer)}`],
      ['MELEE EVASION', `${unit.meleeEvasion}`],
      ['RANGED EVASION', `${unit.rangedEvasion}`],
      ['RESISTANCE', `${unit.resistance}`],
      ['GUARD', `${unit.guard}`],
    ];
    rows.forEach((r, i) => {
      const yy = this.detailY + 180 + i * 52;
      put(label(this, x, yy, r[0], { size: 15, color: Ink.faint }));
      put(this.add.text(this.detailX + this.detailW - 30, yy, r[1],
        monoStyle({ fontSize: '20px', color: Ink.dim })).setOrigin(1, 0));
    });
  }

  // ------------------------------------------------------------- turn flow --

  nextTurn() {
    if (this.ended) return;
    this.refresh();
    if (!this.field.living('enemy').length) return this.finish(true);
    if (!this.field.living('player').length) return this.finish(false);

    decrementAll(this.field.living(), this.aTune);   // start-of-turn: every timer -= Speed
    const actor = pickNext(this.field.living());
    this.actor = actor;
    actor.ap = CR.apAfterGain(actor, this.aTune.ap);  // +AP, carryover, capped
    CR.resetActionFlags(actor);
    this.refresh();

    if (actor.side === 'player') this.beginPlayerTurn();
    else this.time.delayedCall(650, () => this.beginEnemyTurn());
  }

  beginPlayerTurn() {
    this.phase = 'menu';
    this.renderMenu();
  }

  /** End a turn: reset the actor's timer, then advance. */
  endActorTurn(actor) {
    if (this.ended || actor !== this.actor) return;
    this.clearGroup('menuObjects');
    this.phase = 'idle';
    resetTimer(actor, this.aTune);
    this.time.delayedCall(350, () => this.nextTurn());
  }

  // --------------------------------------------------------------- the menu --

  renderMenu() {
    this.clearGroup('menuObjects');
    if (this.phase !== 'menu' || !this.actor || this.actor.side !== 'player') return;
    const a = this.actor;
    const put = (o) => { this.menuObjects.push(o); return o; };
    const bx = this.menuX + 60, by = this.menuY + 44;
    put(label(this, bx, by, `${a.name} — TO ACT`, { size: 22, color: Ink.ink }));
    put(label(this, bx, by + 42,
      `${a.ap} AP   ·   MAJOR ${a.usedMajor ? 'SPENT' : 'READY'}   ·   MINOR ${a.usedMinor ? 'SPENT' : 'READY'}`,
      { size: 15, color: Ink.dim }));

    const targets = this.field.legalTargets(a);
    const moves = this.field.legalMoves(a);
    const repCost = this.aTune.reposition.apCost, itemCost = this.aTune.useItem.apCost;
    let x = bx + 110; const y = by + 156, step = 410;
    put(frameButton(this, x, y, 'Basic Attack', {
      primary: true, size: 18, disabled: a.usedMajor || targets.length === 0,
      onClick: () => this.enterTargetAttack(),
    }));
    x += step;
    put(frameButton(this, x, y, 'Reposition', {
      framed: true, size: 18, disabled: a.usedMinor || moves.length === 0 || !CR.canSpend(a, repCost),
      onClick: () => this.enterTargetMove(),
    }));
    x += step - 70;
    put(frameButton(this, x, y, 'Use Item', {
      framed: true, size: 18, disabled: a.usedMinor || !CR.canSpend(a, itemCost),
      onClick: () => this.useItem(),
    }));
    x += step - 90;
    put(frameButton(this, x, y, 'End Turn', { size: 18, onClick: () => this.endActorTurn(a) }));

    put(label(this, bx, y + 116,
      'BASIC ATTACK GENERATES AP  ·  MELEE STRIKES FROM THE FRONT  ·  REPOSITION & ITEMS ARE MINOR',
      { size: 13, color: Ink.faint }));
  }

  /** Replace the menu with a target prompt + cancel during selection. */
  promptMenu(text) {
    this.clearGroup('menuObjects');
    const put = (o) => { this.menuObjects.push(o); return o; };
    put(label(this, this.menuX + 60, this.menuY + 60, text, { size: 22, color: Ink.accentBright }));
    put(frameButton(this, this.menuX + 60 + 120, this.menuY + 180, 'Cancel', {
      framed: true, size: 18, onClick: () => { this.phase = 'menu'; this.refresh(); this.renderMenu(); },
    }));
  }

  // ------------------------------------------------------------ player acts --

  enterTargetAttack() {
    if (this.actor?.usedMajor) return;
    this.phase = 'targetAttack';
    this.refresh();
    this.promptMenu('CLICK A TARGET');
  }

  enterTargetMove() {
    if (this.actor?.usedMinor) return;
    this.phase = 'targetMove';
    this.refresh();
    this.promptMenu('CLICK AN EMPTY SPACE, OR AN ALLY TO SWAP');
  }

  onTokenClick(u) {
    if (this.phase === 'targetAttack') {
      if (this.field.legalTargets(this.actor).some((e) => e.target === u)) this.commitBasicAttack(u);
    } else if (this.phase === 'targetMove') {
      if (u.side === this.actor.side && u !== this.actor) this.doSwap(u);
    } else {
      this.renderDetail(u); // inspect
    }
  }

  doMove(lane, slot) {
    if (this.phase !== 'targetMove') return;
    this.field.move(this.actor, lane, slot);
    this.afterMinor(`${this.actor.name} repositions to the ${lane}line.`);
  }

  doSwap(ally) {
    if (this.phase !== 'targetMove') return;
    this.field.swap(this.actor, ally);
    this.afterMinor(`${this.actor.name} swaps places with ${ally.name}.`);
  }

  afterMinor(message) {
    CR.spend(this.actor, this.aTune.reposition.apCost);
    this.actor.usedMinor = true;
    this.log(message);
    this.phase = 'menu';
    this.refresh();
    this.renderMenu();
  }

  useItem() {
    const a = this.actor;
    if (a.usedMinor || !CR.canSpend(a, this.aTune.useItem.apCost)) return;
    CR.spend(a, this.aTune.useItem.apCost);
    a.usedMinor = true;
    const healed = Math.min(a.maxHp, a.hp + 10) - a.hp;
    a.hp += healed;
    this.log(`${a.name} uses a field kit (stub) and recovers ${healed} HP.`);
    this.phase = 'menu';
    this.refresh();
    this.renderMenu();
  }

  /** Resolve a basic attack from this.actor onto a target. Shared by player + AI. */
  commitBasicAttack(target) {
    const a = this.actor;
    if (a.usedMajor) return;
    const entry = this.field.legalTargets(a).find((e) => e.target === target);
    if (!entry) return;
    const ctx = { range: a.basicAttack.range, rangedFromFrontline: entry.rangedFromFrontline };
    a.usedMajor = true;

    const hit = CR.rollHit(a, target, ctx, this.aTune.accuracy, this.rng);
    if (!hit.hit) {
      this.log(`${a.name}'s ${a.basicAttack.range} attack misses ${target.name}.`);
    } else {
      const crit = CR.rollCrit(this.aTune.crit, this.rng);
      const dmg = CR.computeDamage(a, target, a.basicAttack, { crit }, this.aTune, this.rng);
      target.guard = Math.max(0, target.guard - dmg.toGuard);
      target.hp = Math.max(0, target.hp - dmg.toHp);
      this.log(`${a.name} strikes ${target.name} for ${dmg.amount}${crit ? ' — CRIT!' : ''}.`);
      if (target.hp <= 0) { target.alive = false; this.log(`${target.name} falls.`); }
    }
    CR.gainAp(a, this.aTune.ap.basicAttackGain, this.aTune.ap); // basic attack generates AP

    this.refresh();
    if (!this.field.living('enemy').length) return this.finish(true);
    if (!this.field.living('player').length) return this.finish(false);

    if (a.side === 'player') { this.phase = 'menu'; this.renderMenu(); }
  }

  // -------------------------------------------------------------- enemy AI --

  beginEnemyTurn() {
    if (this.ended) return;
    const a = this.actor;
    this.phase = 'enemy';
    const targets = this.field.legalTargets(a);

    if (targets.length) {
      const choices = targets.map((e) => e.target);
      let target;
      if (a.ai.targeting === 'nearest') target = choices.reduce((m, t) => this.field.distance(a, t) < this.field.distance(a, m) ? t : m);
      else if (a.ai.targeting === 'random') target = pick(choices, this.rng);
      else target = choices.reduce((m, t) => t.hp < m.hp ? t : m); // lowestHp
      this.commitBasicAttack(target);
      if (!this.ended) this.time.delayedCall(700, () => this.endActorTurn(a));
      return;
    }

    // no target in range: a melee unit in the back advances to the front
    const moves = this.field.legalMoves(a).filter((m) => m.kind === 'move' && m.lane === 'front');
    if (a.basicAttack.range === 'melee' && a.lane === 'back' && moves.length) {
      const m = moves[0];
      this.field.move(a, m.lane, m.slot);
      this.log(`${a.name} advances to the frontline.`);
    } else {
      this.log(`${a.name} holds position.`);
    }
    this.refresh();
    this.time.delayedCall(700, () => this.endActorTurn(a));
  }

  // --------------------------------------------------------------- endings --

  finish(victory) {
    if (this.ended) return;
    this.ended = true;
    this.phase = 'done';
    this.clearGroup('menuObjects');
    this.refresh();
    this.log(victory ? 'The enemy is broken. Victory.' : 'The party is overcome. Defeat.');

    const cx = this.scale.width / 2;
    const banner = this.add.text(cx, this.menuY + 110, victory ? 'VICTORY' : 'DEFEAT',
      displayStyle({ fontSize: '90px', color: victory ? Ink.brass : Ink.accentBright })).setOrigin(0.5);
    track(banner, 16);
    this.menuObjects.push(banner);
    this.menuObjects.push(frameButton(this, cx, this.menuY + 250, 'Return to Menu', {
      primary: true, size: 20, onClick: () => this.scene.start('MainMenu'),
    }));
  }
}
