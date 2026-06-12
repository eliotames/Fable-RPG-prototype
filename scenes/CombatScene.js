/**
 * CombatScene — turn-based party combat:
 *  - speed-ordered turns (CombatMath.turnOrder)
 *  - timed hits: a cursor sweeps a bar; SPACE near the center boosts damage
 *  - parries: when an enemy strikes, SPACE within the window after the "!"
 *    flash reduces damage; a perfect parry negates it (pressing early fails)
 *  - weakness/break: hits matching a weakness chip Toughness; at zero the
 *    enemy Breaks — loses its turn and takes bonus damage
 * All numbers come from combat-tuning.json; all enemies/abilities/encounters
 * from content JSON. High party Lore reveals enemy weaknesses from the start,
 * and story flags can pre-weaken enemies via encounter `modifiers`.
 *
 * Presentation: turn-order chips under the header, party and enemies in
 * hairline panels, the log kept as "The Record", abilities as framed cards.
 */
import { GameState } from '../systems/GameState.js';
import { computeDamage, computeHeal, applyBreakDamage, turnOrder } from '../systems/CombatMath.js';
import { gradeHit, gradeParry, telegraphDelay } from '../systems/TimingJudge.js';
import { weightedPick, pick } from '../systems/rng.js';
import { Palette, Ink, displayStyle, proseStyle, monoStyle, track } from '../ui/Theme.js';
import { panel, statBar, label, frameButton, textButton } from '../ui/widgets.js';

export class CombatScene extends Phaser.Scene {
  constructor() {
    super('Combat');
  }

  /** @param {{encounterId: string, onWin?: string}} data */
  create(data) {
    /** @type {object} ContentRegistry */
    this.reg = this.registry.get('content');
    this.tuning = this.reg.tuning;
    this.onWin = data.onWin ?? null;
    const encounter = this.reg.encounters.get(data.encounterId);

    this.party = GameState.fullParty().map((ref) => ({
      ref, isParty: true, name: ref.name,
      hp: ref.hp, maxHp: ref.maxHp, focus: ref.focus, maxFocus: ref.maxFocus,
      defense: ref.defense, speed: ref.speed,
      attributes: ref.attributes, abilities: ref.abilities,
      defending: false,
    }));

    const counts = {};
    this.enemies = encounter.enemies.map((id) => {
      const def = this.reg.enemies.get(id);
      counts[id] = (counts[id] ?? 0) + 1;
      const e = {
        id, isParty: false,
        name: counts[id] > 1 ? `${def.name} ${counts[id]}` : def.name,
        hp: def.maxHp, maxHp: def.maxHp,
        attack: def.attack, defense: def.defense, speed: def.speed,
        toughness: def.toughness, maxToughness: def.toughness,
        weaknesses: def.weaknesses, resists: def.resists,
        abilities: def.abilities, ai: def.ai,
        broken: false, brokenTurns: 0, revealed: false,
      };
      return e;
    });
    // fix duplicate naming retroactively ("Mute Wisp" → "Mute Wisp 1")
    for (const e of this.enemies) {
      if (counts[e.id] > 1 && !/\d$/.test(e.name)) e.name += ' 1';
    }

    // story flags can pre-weaken / scout enemies (encounter modifiers)
    for (const mod of encounter.modifiers ?? []) {
      if (!GameState.hasFlag(mod.flag)) continue;
      for (const e of this.enemies.filter((en) => en.id === mod.enemy)) {
        if (mod.toughnessDelta) e.toughness = Math.max(1, e.toughness + mod.toughnessDelta);
        if (mod.revealWeaknesses) e.revealed = true;
      }
    }

    this.buildUi(encounter);

    this.log(`— ${encounter.name} —`);
    this.log(encounter.intro);

    // party knowledge: high Lore identifies weaknesses immediately
    const loreNeed = this.tuning.knowledge?.loreRevealSkill ?? 999;
    if (GameState.bestSkill('lore') >= loreNeed) {
      this.enemies.forEach((e) => { e.revealed = true; });
      this.log('Your lore-steeped party reads the creatures\' natures at a glance.');
    }

    this.phase = 'idle';
    this.spaceHandler = null;
    this.input.keyboard.on('keydown-SPACE', () => this.spaceHandler?.());

    this.round = 0;
    this.time.delayedCall(900, () => this.startRound());
  }

  // ------------------------------------------------------------------- UI --

  buildUi(encounter) {
    const sw = this.scale.width, sh = this.scale.height;
    this.add.rectangle(0, 0, sw, sh, Palette.bg0).setOrigin(0);
    const title = this.add.text(sw / 2, 64, encounter.name.toUpperCase(),
      displayStyle({ fontSize: '46px' })).setOrigin(0.5);
    track(title, 8);
    this.roundText = label(this, sw / 2, 124, '', { size: 13, color: Ink.faint, origin: [0.5, 0.5] });
    this.chipObjects = [];

    // party column
    panel(this, 40, 230, 760, 790, 0.5);
    label(this, 72, 252, 'THE PARTY', { size: 13, color: Ink.faint });
    this.partyRows = this.party.map((m, i) => {
      const y = 304 + i * 240;
      const name = this.add.text(80, y, m.name, displayStyle({ fontSize: '34px' }));
      const status = label(this, 740, y + 14, '', { size: 13, color: Ink.faint, origin: [1, 0.5] });
      const hpBar = statBar(this, 80, y + 62, 480, 10, Palette.accent);
      const hpText = this.add.text(584, y + 56, '', monoStyle({ fontSize: '17px', color: Ink.dim }));
      const focusBar = statBar(this, 80, y + 92, 480, 8, Palette.brass);
      const focusText = this.add.text(584, y + 84, '', monoStyle({ fontSize: '17px', color: Ink.brass }));
      const zone = this.add.rectangle(420, y + 70, 740, 200, 0xffffff, 0).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => this.onAllyClicked(m));
      return { m, name, hpBar, hpText, focusBar, focusText, status, zone };
    });

    // enemy column
    panel(this, sw - 840, 230, 800, 790, 0.5);
    label(this, sw - 808, 252, 'WHAT STANDS AGAINST YOU', { size: 13, color: Ink.faint });
    this.enemyRows = this.enemies.map((e, i) => {
      const y = 304 + i * 240;
      const name = this.add.text(sw - 800, y, e.name, displayStyle({ fontSize: '34px' }));
      const banner = label(this, sw - 80, y + 14, '', { size: 14, color: Ink.accentBright, origin: [1, 0.5] });
      const hpBar = statBar(this, sw - 800, y + 62, 480, 10, Palette.accent);
      const hpText = this.add.text(sw - 296, y + 56, '', monoStyle({ fontSize: '17px', color: Ink.dim }));
      const tough = this.add.text(sw - 800, y + 92, '', monoStyle({ fontSize: '19px', color: Ink.brass }));
      track(tough, 6);
      const weak = this.add.text(sw - 800, y + 132, '', monoStyle({ fontSize: '15px', color: Ink.faint, wordWrap: { width: 720 } }));
      const zone = this.add.rectangle(sw - 440, y + 90, 780, 210, 0xffffff, 0).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => this.onEnemyClicked(e));
      const hover = this.add.rectangle(sw - 440, y + 90, 780, 210).setStrokeStyle(2, Palette.lineStrong, 1).setVisible(false);
      zone.on('pointerover', () => { if (this.phase === 'target' && this.targetSide === 'enemy' && e.hp > 0) hover.setVisible(true); });
      zone.on('pointerout', () => hover.setVisible(false));
      return { e, name, hpBar, hpText, tough, weak, banner, zone, hover };
    });

    // log
    panel(this, 40, 1050, 1200, 350, 0.5);
    label(this, 72, 1074, 'THE RECORD', { size: 13, color: Ink.faint });
    this.logLines = [];
    this.logText = this.add.text(72, 1116, '', proseStyle({ fontSize: '23px', color: Ink.dim, lineSpacing: 9, wordWrap: { width: 1136 } }));

    // action menu
    panel(this, 1280, 1050, 1240, 350, 0.5);
    this.menuObjects = [];

    // timing widget area (center)
    this.timingObjects = [];

    this.refreshUi();
  }

  log(text) {
    this.logLines.push(text);
    this.logText.setText(this.logLines.slice(-8).join('\n'));
  }

  refreshUi() {
    for (const r of this.partyRows) {
      r.hpBar.update(r.m.hp, r.m.maxHp);
      r.hpText.setText(`${Math.max(0, r.m.hp)} / ${r.m.maxHp}`);
      r.focusBar.update(r.m.focus, r.m.maxFocus);
      r.focusText.setText(`${r.m.focus} ◈`);
      r.status.setText(r.m.hp <= 0 ? 'DOWN' : r.m.defending ? 'BRACED' : '');
      r.status.setColor(r.m.hp <= 0 ? Ink.accentBright : Ink.faint);
      r.name.setColor(r.m.hp <= 0 ? Ink.faint : Ink.ink);
    }
    for (const r of this.enemyRows) {
      r.hpBar.update(r.e.hp, r.e.maxHp);
      r.hpText.setText(`${Math.max(0, r.e.hp)} / ${r.e.maxHp}`);
      const pips = '◆'.repeat(Math.max(0, r.e.toughness)) + '◇'.repeat(r.e.maxToughness - Math.max(0, r.e.toughness));
      r.tough.setText(r.e.hp > 0 ? pips : '');
      r.weak.setText(r.e.hp > 0
        ? (r.e.revealed
          ? `WEAK ${r.e.weaknesses.join(', ').toUpperCase()}  ·  RESISTS ${(r.e.resists.join(', ') || '—').toUpperCase()}`
          : 'WEAK ???')
        : '');
      r.banner.setText(r.e.hp <= 0 ? 'SLAIN' : r.e.broken ? 'BROKEN' : '');
      r.name.setColor(r.e.hp <= 0 ? Ink.faint : Ink.ink);
    }
    this.refreshChips();
  }

  clearMenu() {
    this.menuObjects.forEach((o) => o.destroy());
    this.menuObjects = [];
  }

  // ----------------------------------------------------------- order chips --

  /** One bordered chip per combatant in this round's order. */
  buildChips() {
    this.chipObjects.forEach((c) => c.destroy());
    this.chipObjects = this.order.map((c, i) => {
      const w = 56, h = 64, gap = 10;
      const x = this.scale.width / 2 + (i - (this.order.length - 1) / 2) * (w + gap);
      const cont = this.add.container(x, 184);
      const g = this.add.graphics();
      const initials = c.name.split(/\s+/).map((p) => p.charAt(0)).join('').slice(0, 3).toUpperCase();
      const t = this.add.text(0, 0, initials, monoStyle({ fontSize: '16px', color: Ink.faint })).setOrigin(0.5);
      cont.add([g, t]);
      cont.chipDraw = (current) => {
        g.clear();
        g.fillStyle(Palette.bgPage, 0.8);
        g.fillRect(-w / 2, -h / 2, w, h);
        g.lineStyle(2, c.isParty ? (current ? Palette.lineStrong : Palette.line) : 0x4a2620, 1);
        g.strokeRect(-w / 2, -h / 2, w, h);
        if (current) {
          g.lineStyle(3, Palette.accent, 1);
          g.lineBetween(-w / 2, h / 2 + 6, w / 2, h / 2 + 6);
        }
        t.setColor(c.hp <= 0 ? Ink.faint : current ? Ink.ink : Ink.dim);
        cont.setAlpha(c.hp <= 0 ? 0.3 : current ? 1 : 0.75);
      };
      cont.chipFor = c;
      cont.chipDraw(false);
      return cont;
    });
  }

  refreshChips() {
    const current = this.order?.[this.turnIdx - 1] ?? null;
    for (const chip of this.chipObjects ?? []) chip.chipDraw(chip.chipFor === current);
  }

  // ------------------------------------------------------------ turn flow --

  livingParty() { return this.party.filter((m) => m.hp > 0); }
  livingEnemies() { return this.enemies.filter((e) => e.hp > 0); }

  startRound() {
    this.round++;
    this.order = turnOrder([...this.party, ...this.enemies]);
    this.turnIdx = 0;
    this.roundText.setText(`ROUND ${this.round}`);
    this.buildChips();
    this.nextTurn();
  }

  nextTurn() {
    this.refreshUi();
    if (!this.livingEnemies().length) return this.victory();
    if (!this.livingParty().length) return this.defeat();
    if (this.turnIdx >= this.order.length) return this.startRound();
    const actor = this.order[this.turnIdx++];
    if (actor.hp <= 0) return this.nextTurn();
    this.refreshChips();
    if (actor.isParty) this.beginPlayerTurn(actor);
    else this.beginEnemyTurn(actor);
  }

  // ----------------------------------------------------------- player turn --

  beginPlayerTurn(actor) {
    this.phase = 'menu';
    this.actor = actor;
    actor.defending = false;
    actor.focus = Math.min(actor.maxFocus, actor.focus + this.tuning.focus.regenPerTurn);
    this.refreshUi();
    this.showActionMenu(actor);
  }

  showActionMenu(actor) {
    this.clearMenu();
    const put = (o) => { this.menuObjects.push(o); return o; };
    put(label(this, 1312, 1074, `${actor.name} — TO ACT`, { size: 14, color: Ink.ink }));

    actor.abilities.forEach((abilityId, i) => {
      const ab = this.reg.abilities.get(abilityId);
      const affordable = actor.focus >= ab.focusCost;
      put(this.abilityCard(1312 + (i % 4) * 300, 1112 + Math.floor(i / 4) * 136, ab, affordable, () => this.pickAbility(actor, ab)));
    });

    put(frameButton(this, 1392, 1296, 'Defend', {
      framed: true, size: 14, padX: 24, padY: 12,
      onClick: () => this.doDefend(actor),
    }));
    put(label(this, 1512, 1296, `+${this.tuning.focus.defendRegen}◈ · HALF DAMAGE`, { size: 12, color: Ink.faint, origin: [0, 0.5] }));

    const combatItems = Object.entries(GameState.inventory)
      .map(([id, qty]) => ({ item: this.reg.items.get(id), qty }))
      .filter((x) => x.item?.combat && x.qty > 0);
    combatItems.forEach((x, i) => {
      put(textButton(this, 1860 + (i % 2) * 320, 1284, `${x.item.name.toUpperCase()} ×${x.qty}`, {
        style: monoStyle({ fontSize: '15px', color: Ink.brass }),
        hoverColor: Ink.ink,
        onClick: () => this.pickItem(actor, x.item),
      }));
    });
    put(label(this, 1312, 1364, 'TIMED HITS & PARRIES — SPACE', { size: 12, color: Ink.faint }));
  }

  /** Framed ability card: name above, cost · element below. */
  abilityCard(x, y, ab, affordable, onClick) {
    const w = 288, h = 124;
    const c = this.add.container(x + w / 2, y + h / 2);
    const g = this.add.graphics();
    const drawBorder = (color) => {
      g.clear();
      g.lineStyle(2, color, 1);
      g.strokeRect(-w / 2, -h / 2, w, h);
    };
    drawBorder(Palette.line);
    const name = this.add.text(0, -20, ab.name.toUpperCase(),
      monoStyle({ fontSize: '15px', color: Ink.dim, align: 'center', wordWrap: { width: w - 24 } })).setOrigin(0.5);
    track(name, 2);
    const desc = `${ab.focusCost ? `${ab.focusCost}◈ · ` : ''}${ab.kind === 'heal' ? 'HEAL' : ab.element.toUpperCase()}`;
    const cost = this.add.text(0, 26, desc, monoStyle({ fontSize: '13px', color: Ink.faint })).setOrigin(0.5);
    c.add([g, name, cost]);
    c.setSize(w, h);
    if (!affordable) {
      c.setAlpha(0.35);
      return c;
    }
    c.setInteractive({ useHandCursor: true });
    c.on('pointerover', () => { drawBorder(Palette.lineStrong); name.setColor(Ink.ink); });
    c.on('pointerout', () => { drawBorder(Palette.line); name.setColor(Ink.dim); });
    c.on('pointerdown', onClick);
    return c;
  }

  pickAbility(actor, ability) {
    this.pendingMove = { kind: ability.kind, power: ability.power, element: ability.element,
      breakPower: ability.breakPower ?? 0, timed: ability.timed ?? (ability.kind === 'damage'),
      name: ability.name, scalingValue: actor.attributes[ability.scaling] ?? 0,
      payCost: () => { actor.focus -= ability.focusCost; } };
    this.enterTargeting(ability.target);
  }

  pickItem(actor, item) {
    const c = item.combat;
    this.pendingMove = { kind: c.kind, power: c.power, element: c.element ?? null,
      breakPower: c.breakPower ?? 0, timed: c.timed ?? false,
      name: item.name, scalingValue: 0,
      payCost: () => GameState.removeItem(item.id) };
    this.enterTargeting(c.target);
  }

  enterTargeting(targetType) {
    if (targetType === 'self') return this.commitTarget(this.actor);
    this.targetSide = targetType; // 'enemy' | 'ally'
    const pool = targetType === 'enemy' ? this.livingEnemies() : this.livingParty();
    if (pool.length === 1) return this.commitTarget(pool[0]);
    this.phase = 'target';
    this.clearMenu();
    this.menuObjects.push(label(this, 1312, 1090,
      `${this.pendingMove.name} — CLICK A ${this.targetSide === 'enemy' ? 'TARGET' : 'COMPANION'}`,
      { size: 15, color: Ink.ink }));
    this.menuObjects.push(this.add.text(1312, 1140, this.targetSide === 'enemy'
      ? 'Choose among what stands against you.' : 'Choose whom to spare the worst.',
      proseStyle({ fontSize: '23px', fontStyle: 'italic', color: Ink.faint })));
  }

  onEnemyClicked(e) {
    if (this.phase === 'target' && this.targetSide === 'enemy' && e.hp > 0) this.commitTarget(e);
  }

  onAllyClicked(m) {
    if (this.phase === 'target' && this.targetSide === 'ally' && m.hp > 0) this.commitTarget(m);
  }

  commitTarget(target) {
    this.enemyRows.forEach((r) => r.hover.setVisible(false));
    this.pendingTarget = target;
    this.pendingMove.payCost();
    this.clearMenu();
    this.refreshUi();
    if (this.pendingMove.kind === 'heal') return this.resolveHeal();
    if (this.pendingMove.timed) return this.runTimedHit();
    this.resolvePartyAttack({ grade: null, mult: this.tuning.timing.attack.missMult });
  }

  doDefend(actor) {
    actor.defending = true;
    actor.focus = Math.min(actor.maxFocus, actor.focus + this.tuning.focus.defendRegen);
    this.log(`${actor.name} braces, breathing with the quiet.`);
    this.clearMenu();
    this.refreshUi();
    this.time.delayedCall(450, () => this.nextTurn());
  }

  // ------------------------------------------------------------ timed hit --

  clearTiming() {
    this.timingObjects.forEach((o) => o.destroy());
    this.timingObjects = [];
  }

  runTimedHit() {
    this.phase = 'timing';
    const t = this.tuning.timing.attack;
    const cx = this.scale.width / 2, cy = 880, W = 720, H = 26;
    const put = (o) => { this.timingObjects.push(o); return o; };
    put(label(this, cx, cy - 64, `${this.pendingMove.name} — SPACE AT THE CENTER`,
      { size: 16, color: Ink.ink, origin: [0.5, 0.5] }));
    put(this.add.rectangle(cx, cy, W, H, Palette.bg3).setStrokeStyle(2, Palette.line));
    const goodW = (t.goodMs * 2 / t.sweepMs) * W;
    const perfW = (t.perfectMs * 2 / t.sweepMs) * W;
    put(this.add.rectangle(cx, cy, goodW, H - 8, Palette.verdigris));
    put(this.add.rectangle(cx, cy, perfW, H - 8, Palette.brass));
    const cursor = put(this.add.rectangle(cx - W / 2, cy, 6, H + 18, Palette.ink));

    const started = this.time.now;
    let pressMs = null;
    this.spaceHandler = () => {
      if (pressMs !== null) return;
      pressMs = this.time.now - started;
      finish();
    };
    const tick = this.time.addEvent({
      delay: 16, repeat: Math.ceil(t.sweepMs / 16),
      callback: () => {
        const el = this.time.now - started;
        cursor.x = cx - W / 2 + Math.min(1, el / t.sweepMs) * W;
        if (el >= t.sweepMs && pressMs === null) finish();
      },
    });
    const finish = () => {
      tick.remove();
      this.spaceHandler = null;
      const grade = gradeHit(this.tuning.timing, pressMs);
      put(label(this, cx, cy + 54,
        grade.grade === 'perfect' ? 'PERFECT' : grade.grade === 'good' ? 'GOOD' : 'OFF-BEAT',
        {
          size: 19, origin: [0.5, 0.5],
          color: grade.grade === 'perfect' ? Ink.brass : grade.grade === 'good' ? Ink.verdigris : Ink.faint,
        }));
      this.time.delayedCall(550, () => { this.clearTiming(); this.resolvePartyAttack(grade); });
    };
  }

  resolvePartyAttack(grade) {
    const move = this.pendingMove, target = this.pendingTarget;
    const result = computeDamage(this.tuning, move, move.scalingValue, target, { timingMult: grade.mult });
    target.hp = Math.max(0, target.hp - result.amount);
    const elemNote = result.element > 1 ? ' — weakness!' : result.element < 1 ? ' — resisted' : '';
    const gradeNote = grade.grade === 'perfect' ? ' (perfect)' : grade.grade === 'good' ? ' (good)' : '';
    this.log(`${this.actor.name}: ${move.name} hits ${target.name} for ${result.amount}${elemNote}${gradeNote}.`);
    if (result.element > 1) target.revealed = true;

    const brk = applyBreakDamage(this.tuning, target, move.element, move.breakPower);
    target.toughness = brk.toughness;
    if (brk.justBroke && target.hp > 0) {
      target.broken = true;
      target.brokenTurns = this.tuning.break.brokenTurns;
      const bonus = this.tuning.break.breakBonusDamage;
      target.hp = Math.max(0, target.hp - bonus);
      this.log(`BREAK! ${target.name} staggers — ${bonus} bonus damage, defenses split open.`);
    }
    if (target.hp <= 0) this.log(`${target.name} collapses into drifting ash.`);
    this.refreshUi();
    this.time.delayedCall(700, () => this.nextTurn());
  }

  resolveHeal() {
    const move = this.pendingMove, target = this.pendingTarget;
    const amount = computeHeal(this.tuning, move, move.scalingValue);
    target.hp = Math.min(target.maxHp, target.hp + amount);
    this.log(`${this.actor.name}: ${move.name} restores ${amount} to ${target.name}.`);
    this.refreshUi();
    this.time.delayedCall(600, () => this.nextTurn());
  }

  // ------------------------------------------------------------ enemy turn --

  beginEnemyTurn(enemy) {
    this.phase = 'enemy';
    if (enemy.broken) {
      enemy.brokenTurns--;
      this.log(`${enemy.name} is broken and cannot act.`);
      if (enemy.brokenTurns <= 0) {
        enemy.broken = false;
        if (this.tuning.break.recoverToFull ?? true) enemy.toughness = enemy.maxToughness;
        this.log(`${enemy.name} knits itself back together.`);
      }
      this.refreshUi();
      return this.time.delayedCall(800, () => this.nextTurn());
    }

    const move = weightedPick(enemy.ai.moves);
    const ability = this.reg.abilities.get(move.ability);
    const pool = this.livingParty();
    const target = enemy.ai.targeting === 'weakest'
      ? pool.reduce((a, b) => (a.hp <= b.hp ? a : b))
      : enemy.ai.targeting === 'strongest'
        ? pool.reduce((a, b) => (a.hp >= b.hp ? a : b))
        : pick(pool);

    this.log(ability.telegraph ? `${enemy.name} ${ability.telegraph}` : `${enemy.name} readies ${ability.name}…`);
    this.runParry(enemy, ability, target);
  }

  runParry(enemy, ability, target) {
    const t = this.tuning.timing.parry;
    const cx = this.scale.width / 2, cy = 840;
    const put = (o) => { this.timingObjects.push(o); return o; };
    put(label(this, cx, cy - 84, `${ability.name} → ${target.name} — SPACE AT THE FLASH TO PARRY`,
      { size: 16, color: Ink.accentBright, origin: [0.5, 0.5] }));

    let flashAt = null;       // time.now when the "!" appeared
    let pressMs;              // relative to flash; negative = early press
    this.spaceHandler = () => {
      if (pressMs !== undefined) return;
      pressMs = flashAt === null ? -1 : this.time.now - flashAt;
      if (pressMs < 0) put(label(this, cx, cy + 60, 'TOO EARLY', { size: 17, color: Ink.accentBright, origin: [0.5, 0.5] }));
    };

    const delay = telegraphDelay(this.tuning.timing);
    this.time.delayedCall(delay, () => {
      flashAt = this.time.now;
      const flash = put(this.add.text(cx, cy, '!', displayStyle({ fontSize: '150px', color: Ink.accentBright })).setOrigin(0.5));
      this.tweens.add({ targets: flash, scale: 1.6, alpha: 0.4, duration: t.windowMs, ease: 'Quad.easeOut' });
      this.time.delayedCall(t.windowMs + 60, () => {
        this.spaceHandler = null;
        const grade = gradeParry(this.tuning.timing, pressMs ?? null);
        this.clearTiming();
        this.resolveEnemyAttack(enemy, ability, target, grade);
      });
    });
  }

  resolveEnemyAttack(enemy, ability, target, parry) {
    const defendMult = target.defending ? this.tuning.defend.damageMult : 1;
    const result = computeDamage(this.tuning, ability, enemy.attack, target,
      { parryMult: parry.mult, defendMult });
    target.hp = Math.max(0, target.hp - result.amount);
    const note = parry.grade === 'perfect' ? ' — PERFECT PARRY, turned aside!'
      : parry.grade === 'good' ? ' (parried)' : '';
    this.log(`${enemy.name}: ${ability.name} hits ${target.name} for ${result.amount}${note}.`);
    if (target.hp <= 0) this.log(`${target.name} falls silent.`);
    this.refreshUi();
    this.time.delayedCall(700, () => this.nextTurn());
  }

  // -------------------------------------------------------------- endings --

  victory() {
    this.phase = 'done';
    this.log('The quiet lifts, just a little. Victory.');
    // write combat results back to the persistent characters
    for (const m of this.party) {
      m.ref.hp = this.tuning.party.healAfterCombat ? m.maxHp : Math.max(1, m.hp);
      m.ref.focus = m.maxFocus;
    }
    this.refreshUi();
    this.time.delayedCall(1400, () => {
      this.scene.start('Exploration', this.onWin ? { launchDialogue: this.onWin } : {});
    });
  }

  defeat() {
    this.phase = 'done';
    this.log('The Hush closes over the party…');
    GameState.ending = { outcome: 'defeat', epilogue: '' };
    this.time.delayedCall(1400, () => this.scene.start('End'));
  }
}
