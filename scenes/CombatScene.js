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
 */
import { GameState } from '../systems/GameState.js';
import { computeDamage, computeHeal, applyBreakDamage, turnOrder } from '../systems/CombatMath.js';
import { gradeHit, gradeParry, telegraphDelay } from '../systems/TimingJudge.js';
import { weightedPick, pick } from '../systems/rng.js';
import { Colors, uiStyle, bodyStyle, titleStyle } from '../ui/Theme.js';
import { panel, statBar, textButton } from '../ui/widgets.js';

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
    this.add.rectangle(0, 0, sw, sh, 0x101218).setOrigin(0);
    this.add.text(sw / 2, 26, encounter.name, titleStyle({ fontSize: '24px' })).setOrigin(0.5);
    this.roundText = this.add.text(sw / 2, 54, '', uiStyle({ fontSize: '13px', color: Colors.textDim })).setOrigin(0.5);

    // party column
    panel(this, 20, 80, 360, 420);
    this.partyRows = this.party.map((m, i) => {
      const y = 100 + i * 130;
      const name = this.add.text(40, y, m.name, bodyStyle({ fontSize: '17px', color: '#ffe9b0' }));
      const hpBar = statBar(this, 40, y + 28, 220, 12, Colors.good);
      const hpText = this.add.text(270, y + 26, '', uiStyle({ fontSize: '12px' }));
      const focusBar = statBar(this, 40, y + 48, 220, 8, Colors.focus);
      const focusText = this.add.text(270, y + 44, '', uiStyle({ fontSize: '12px', color: '#9ec4e8' }));
      const status = this.add.text(40, y + 64, '', uiStyle({ fontSize: '12px', color: Colors.textDim }));
      const zone = this.add.rectangle(200, y + 45, 350, 110, 0xffffff, 0).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => this.onAllyClicked(m));
      return { m, name, hpBar, hpText, focusBar, focusText, status, zone };
    });

    // enemy column
    panel(this, sw - 420, 80, 400, 420);
    this.enemyRows = this.enemies.map((e, i) => {
      const y = 100 + i * 130;
      const name = this.add.text(sw - 400, y, e.name, bodyStyle({ fontSize: '17px', color: '#e8b0a0' }));
      const hpBar = statBar(this, sw - 400, y + 28, 220, 12, Colors.danger);
      const hpText = this.add.text(sw - 170, y + 26, '', uiStyle({ fontSize: '12px' }));
      const tough = this.add.text(sw - 400, y + 46, '', uiStyle({ fontSize: '13px', color: '#d8c06a' }));
      const weak = this.add.text(sw - 400, y + 66, '', uiStyle({ fontSize: '12px', color: '#b89ad8' }));
      const banner = this.add.text(sw - 60, y + 2, '', uiStyle({ fontSize: '13px', color: '#ffd24a', fontStyle: 'bold' })).setOrigin(1, 0);
      const zone = this.add.rectangle(sw - 220, y + 45, 390, 110, 0xffffff, 0).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => this.onEnemyClicked(e));
      const hover = this.add.rectangle(sw - 220, y + 45, 390, 110).setStrokeStyle(1, 0xd8b36a, 0.9).setVisible(false);
      zone.on('pointerover', () => { if (this.phase === 'target' && this.targetSide === 'enemy' && e.hp > 0) hover.setVisible(true); });
      zone.on('pointerout', () => hover.setVisible(false));
      return { e, name, hpBar, hpText, tough, weak, banner, zone, hover };
    });

    // log
    panel(this, 20, 520, 600, 180);
    this.logLines = [];
    this.logText = this.add.text(36, 532, '', uiStyle({ fontSize: '13px', color: '#c8c4b8', lineSpacing: 5, wordWrap: { width: 570 } }));

    // action menu
    panel(this, 640, 520, 620, 180);
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
      r.hpText.setText(`${Math.max(0, r.m.hp)}/${r.m.maxHp}`);
      r.focusBar.update(r.m.focus, r.m.maxFocus);
      r.focusText.setText(`${r.m.focus}`);
      r.status.setText(r.m.hp <= 0 ? 'DOWN' : r.m.defending ? 'defending' : '');
      r.name.setColor(r.m.hp <= 0 ? Colors.disabled : '#ffe9b0');
    }
    for (const r of this.enemyRows) {
      r.hpBar.update(r.e.hp, r.e.maxHp);
      r.hpText.setText(`${Math.max(0, r.e.hp)}/${r.e.maxHp}`);
      const pips = '◆'.repeat(Math.max(0, r.e.toughness)) + '◇'.repeat(r.e.maxToughness - Math.max(0, r.e.toughness));
      r.tough.setText(r.e.hp > 0 ? `toughness ${pips}` : '');
      r.weak.setText(r.e.hp > 0 ? (r.e.revealed ? `weak: ${r.e.weaknesses.join(', ')} · resists: ${r.e.resists.join(', ') || '—'}` : 'weak: ???') : '');
      r.banner.setText(r.e.hp <= 0 ? 'slain' : r.e.broken ? 'BROKEN' : '');
      r.name.setColor(r.e.hp <= 0 ? Colors.disabled : '#e8b0a0');
    }
  }

  clearMenu() {
    this.menuObjects.forEach((o) => o.destroy());
    this.menuObjects = [];
  }

  // ------------------------------------------------------------ turn flow --

  livingParty() { return this.party.filter((m) => m.hp > 0); }
  livingEnemies() { return this.enemies.filter((e) => e.hp > 0); }

  startRound() {
    this.round++;
    this.order = turnOrder([...this.party, ...this.enemies]);
    this.turnIdx = 0;
    this.roundText.setText(`round ${this.round} · order: ${this.order.map((c) => c.name).join(' → ')}`);
    this.nextTurn();
  }

  nextTurn() {
    this.refreshUi();
    if (!this.livingEnemies().length) return this.victory();
    if (!this.livingParty().length) return this.defeat();
    if (this.turnIdx >= this.order.length) return this.startRound();
    const actor = this.order[this.turnIdx++];
    if (actor.hp <= 0) return this.nextTurn();
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
    put(this.add.text(656, 530, `${actor.name} — choose an action`, uiStyle({ fontSize: '14px', color: '#ffe9b0' })));

    actor.abilities.forEach((abilityId, i) => {
      const ab = this.reg.abilities.get(abilityId);
      const affordable = actor.focus >= ab.focusCost;
      const col = i % 2, row = Math.floor(i / 2);
      const label = `${ab.name}${ab.focusCost ? ` (${ab.focusCost}◈)` : ''} · ${ab.kind === 'heal' ? 'heal' : ab.element}`;
      put(textButton(this, 656 + col * 300, 558 + row * 26, label, {
        disabled: !affordable,
        style: { fontSize: '14px', color: affordable ? '#e8e4d8' : Colors.disabled },
        onClick: () => this.pickAbility(actor, ab),
      }));
    });

    const baseY = 558 + Math.ceil(actor.abilities.length / 2) * 26 + 8;
    put(textButton(this, 656, baseY, `[ Defend ]  (+${this.tuning.focus.defendRegen}◈, half damage)`, {
      style: { fontSize: '14px', color: '#9ec4e8' },
      onClick: () => this.doDefend(actor),
    }));

    const combatItems = Object.entries(GameState.inventory)
      .map(([id, qty]) => ({ item: this.reg.items.get(id), qty }))
      .filter((x) => x.item?.combat && x.qty > 0);
    combatItems.forEach((x, i) => {
      put(textButton(this, 656 + 300, baseY + i * 24, `Use ${x.item.name} ×${x.qty}`, {
        style: { fontSize: '14px', color: '#d8c06a' },
        onClick: () => this.pickItem(actor, x.item),
      }));
    });
    put(this.add.text(656, 676, 'timed hits & parries: SPACE', uiStyle({ fontSize: '11px', color: Colors.textDim })));
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
    this.menuObjects.push(this.add.text(656, 540,
      `${this.pendingMove.name} — click a ${targetType === 'enemy' ? 'target' : 'companion'}`,
      uiStyle({ fontSize: '15px', color: '#ffe9b0' })));
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
    const cx = this.scale.width / 2, cy = 440, W = 360, H = 18;
    const put = (o) => { this.timingObjects.push(o); return o; };
    put(this.add.text(cx, cy - 34, `${this.pendingMove.name} — SPACE at the center!`, uiStyle({ fontSize: '14px', color: '#ffe9b0' })).setOrigin(0.5));
    put(this.add.rectangle(cx, cy, W, H, 0x22242c).setStrokeStyle(1, Colors.panelEdge));
    const goodW = (t.goodMs * 2 / t.sweepMs) * W;
    const perfW = (t.perfectMs * 2 / t.sweepMs) * W;
    put(this.add.rectangle(cx, cy, goodW, H - 4, 0x5a7a4a));
    put(this.add.rectangle(cx, cy, perfW, H - 4, 0xd8b36a));
    const cursor = put(this.add.rectangle(cx - W / 2, cy, 3, H + 8, 0xffffff));

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
      put(this.add.text(cx, cy + 28,
        grade.grade === 'perfect' ? 'PERFECT!' : grade.grade === 'good' ? 'Good' : 'Off-beat',
        uiStyle({ fontSize: '16px', fontStyle: 'bold', color: grade.grade === 'perfect' ? '#ffd24a' : grade.grade === 'good' ? '#9ec48a' : '#8a8a8a' })).setOrigin(0.5));
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
    const cx = this.scale.width / 2, cy = 420;
    const put = (o) => { this.timingObjects.push(o); return o; };
    put(this.add.text(cx, cy - 40, `${ability.name} → ${target.name} — SPACE at the flash to parry!`,
      uiStyle({ fontSize: '14px', color: '#e8b0a0' })).setOrigin(0.5));

    let flashAt = null;       // time.now when the "!" appeared
    let pressMs;              // relative to flash; negative = early press
    this.spaceHandler = () => {
      if (pressMs !== undefined) return;
      pressMs = flashAt === null ? -1 : this.time.now - flashAt;
      if (pressMs < 0) put(this.add.text(cx, cy + 26, 'too early!', uiStyle({ fontSize: '14px', color: '#c4554d' })).setOrigin(0.5));
    };

    const delay = telegraphDelay(this.tuning.timing);
    this.time.delayedCall(delay, () => {
      flashAt = this.time.now;
      const flash = put(this.add.text(cx, cy, '!', titleStyle({ fontSize: '64px', color: '#ffd24a' })).setOrigin(0.5));
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
