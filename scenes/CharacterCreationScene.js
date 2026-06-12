/**
 * CharacterCreationScene — name, race, class, attribute points. Everything
 * shown (races, classes, attributes, skills, derived stats, abilities,
 * starting gear) is read from the content registry; the live summary
 * recomputes through CharacterFactory so what you see is exactly what you
 * play. Three columns: choices · numbers · the prose of who you become.
 */
import { GameState } from '../systems/GameState.js';
import { buildCharacter, baseAttributes } from '../systems/CharacterFactory.js';
import { Palette, Ink, displayStyle, proseStyle, monoStyle, track } from '../ui/Theme.js';
import { label, hairline, rule, frameButton } from '../ui/widgets.js';

const PAD_X = 173;
const COL2_X = 790, COL2_W = 600;
const COL3_X = 1700, COL3_W = 690;

export class CharacterCreationScene extends Phaser.Scene {
  constructor() {
    super('CharacterCreation');
  }

  create() {
    /** @type {object} ContentRegistry */
    this.reg = this.registry.get('content');
    const reg = this.reg;

    this.name = 'Avel';
    this.typing = false;
    this.raceId = [...reg.races.keys()][0];
    this.classId = [...reg.classes.keys()][0];
    this.dist = baseAttributes(reg);

    this.add.rectangle(0, 0, this.scale.width, this.scale.height, Palette.bg1).setOrigin(0);

    // header
    label(this, PAD_X, 100, 'CHARACTER CREATION', { size: 16, color: Ink.faint });
    track(this.add.text(PAD_X, 136, 'FORGE YOUR WANDERER', displayStyle({ fontSize: '56px' })), 8);
    label(this, this.scale.width - PAD_X, 112, 'WHO WALKS INTO THE QUIET — I OF I',
      { size: 16, color: Ink.faint, origin: [1, 0] });

    // --- column 1: name, race, class pickers -------------------------------
    let y = 320;
    label(this, PAD_X, y, 'NAME — CLICK TO EDIT', { size: 13, color: Ink.faint });
    this.nameText = this.add.text(PAD_X, y + 32, '', displayStyle({ fontSize: '42px' }))
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => { this.typing = true; this.redrawAll(); });
    hairline(this, PAD_X, y + 100, 430, Palette.lineStrong);
    this.input.keyboard.on('keydown', (ev) => this.onKey(ev));

    y += 160;
    label(this, PAD_X, y, 'RACE', { size: 13, color: Ink.faint });
    this.raceButtons = [...reg.races.values()].map((race, i) =>
      this.pickerButton(PAD_X, y + 44 + i * 56, () => { this.raceId = race.id; this.redrawAll(); }));

    const classY = y + 44 + reg.races.size * 56 + 50;
    label(this, PAD_X, classY, 'CLASS', { size: 13, color: Ink.faint });
    this.classButtons = [...reg.classes.values()].map((klass, i) =>
      this.pickerButton(PAD_X, classY + 44 + i * 56, () => { this.classId = klass.id; this.redrawAll(); }));

    // --- column 2: attribute points ----------------------------------------
    label(this, COL2_X, 320, 'ATTRIBUTES', { size: 13, color: Ink.faint });
    this.poolText = this.add.text(COL2_X + COL2_W, 312, '',
      monoStyle({ fontSize: '14px', color: Ink.dim })).setOrigin(1, 0);
    track(this.poolText, 3);
    this.poolNum = this.add.text(0, 304, '', displayStyle({ fontSize: '30px', color: Ink.brass })).setOrigin(1, 0);

    hairline(this, COL2_X, 360, COL2_W);
    this.attrRows = [...reg.attributes.values()].map((attr, i) => {
      const rowY = 360 + i * 88, cy = rowY + 44;
      const name = label(this, COL2_X + 2, cy - 11, attr.name, { size: 17, color: Ink.dim });
      const bonus = this.add.text(COL2_X + 230, cy, '', monoStyle({ fontSize: '16px', color: Ink.brass })).setOrigin(0, 0.5);
      const value = this.add.text(COL2_X + 380, cy, '', displayStyle({ fontSize: '44px' })).setOrigin(0.5);
      const minus = this.stepBtn(COL2_X + 500, cy, '−', () => this.adjust(attr.id, -1));
      const plus = this.stepBtn(COL2_X + 572, cy, '+', () => this.adjust(attr.id, +1));
      hairline(this, COL2_X, rowY + 88, COL2_W);
      return { attr, name, bonus, value, minus, plus };
    });

    const ruleY = 360 + reg.attributes.size * 88 + 56;
    rule(this, COL2_X + COL2_W / 2, ruleY, COL2_W);
    this.derivedY = ruleY + 50;
    this.skillsY = this.derivedY + 150;
    label(this, COL2_X, this.skillsY, 'SKILLS — THEY GATE DIALOGUE, PUZZLES, INSIGHT',
      { size: 13, color: Ink.faint });

    // --- column 3 (prose) and live numbers are redrawn wholesale ------------
    this.descObjects = [];
    this.summaryObjects = [];
    this.beginButton = null;
    this.beginNote = null;

    frameButton(this, PAD_X + 80, this.scale.height - 84, '← Title', {
      onClick: () => this.scene.start('MainMenu'),
    });

    this.redrawAll();
  }

  pickerButton(x, y, onClick) {
    const t = this.add.text(x, y, '', displayStyle({ fontSize: '30px', color: Ink.faint }))
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', onClick);
    t.on('pointerover', () => { if (!t.selected) t.setColor(Ink.dim); });
    t.on('pointerout', () => { if (!t.selected) t.setColor(Ink.faint); });
    return t;
  }

  stepBtn(x, cy, glyph, onClick) {
    const c = this.add.container(x, cy);
    const g = this.add.graphics();
    g.lineStyle(2, Palette.line, 1);
    g.strokeRect(-18, -18, 36, 36);
    const t = this.add.text(0, 0, glyph, monoStyle({ fontSize: '20px', color: Ink.faint })).setOrigin(0.5);
    c.add([g, t]);
    c.setSize(36, 36).setInteractive({ useHandCursor: true });
    c.on('pointerover', () => t.setColor(Ink.ink));
    c.on('pointerout', () => t.setColor(Ink.faint));
    c.on('pointerdown', onClick);
    return c;
  }

  onKey(ev) {
    if (!this.typing) return;
    if (ev.key === 'Enter' || ev.key === 'Escape') this.typing = false;
    else if (ev.key === 'Backspace') this.name = this.name.slice(0, -1);
    else if (ev.key.length === 1 && this.name.length < 16 && /[\w '\-]/.test(ev.key)) this.name += ev.key;
    this.redrawAll();
  }

  poolRemaining() {
    const c = this.reg.tuning.creation;
    const spent = Object.values(this.dist).reduce((s, v) => s + (v - c.basePerAttribute), 0);
    return c.pool - spent;
  }

  adjust(attrId, delta) {
    const c = this.reg.tuning.creation;
    const next = this.dist[attrId] + delta;
    if (next < c.minPerAttribute || next > c.maxAtCreation) return;
    if (delta > 0 && this.poolRemaining() <= 0) return;
    this.dist[attrId] = next;
    this.redrawAll();
  }

  preview() {
    return buildCharacter(this.reg, {
      name: this.name || '???', raceId: this.raceId, classId: this.classId,
      attributes: this.dist, isPlayer: true,
    });
  }

  redrawAll() {
    const reg = this.reg;
    const race = reg.races.get(this.raceId);
    const klass = reg.classes.get(this.classId);

    this.nameText.setText((this.name || '…') + (this.typing ? '▌' : ''));

    [...reg.races.values()].forEach((r, i) => {
      const btn = this.raceButtons[i];
      btn.selected = r.id === this.raceId;
      btn.setText((btn.selected ? '◆  ' : '◇  ') + r.name);
      btn.setColor(btn.selected ? Ink.ink : Ink.faint);
    });
    [...reg.classes.values()].forEach((k, i) => {
      const btn = this.classButtons[i];
      btn.selected = k.id === this.classId;
      btn.setText((btn.selected ? '◆  ' : '◇  ') + k.name);
      btn.setColor(btn.selected ? Ink.ink : Ink.faint);
    });

    const remaining = this.poolRemaining();
    this.poolText.setText('TO ALLOT');
    this.poolNum.setText(String(remaining));
    this.poolNum.setX(this.poolText.x - this.poolText.width - 16);
    for (const row of this.attrRows) {
      row.value.setText(String(this.dist[row.attr.id]));
      const b = (race.attributeBonuses[row.attr.id] ?? 0) + (klass.attributeBonuses[row.attr.id] ?? 0);
      row.bonus.setText(b ? `+${b}` : '');
    }

    // live numbers (column 2) — built through the real CharacterFactory
    this.summaryObjects.forEach((o) => o.destroy());
    this.summaryObjects = [];
    const put = (o) => { this.summaryObjects.push(o); return o; };
    const ch = this.preview();

    const derived = [['VITALITY', ch.maxHp], ['FOCUS', ch.maxFocus], ['DEFENSE', ch.defense], ['SPEED', ch.speed]];
    derived.forEach(([name, value], i) => {
      const dx = COL2_X + i * 158;
      put(label(this, dx, this.derivedY, name, { size: 12, color: Ink.faint }));
      put(this.add.text(dx, this.derivedY + 26, String(value), displayStyle({ fontSize: '40px' })));
    });

    const skills = [...reg.skills.values()];
    skills.forEach((s, i) => {
      const col = Math.floor(i / Math.ceil(skills.length / 2)), rowI = i % Math.ceil(skills.length / 2);
      const sx = COL2_X + col * 310, sy = this.skillsY + 40 + rowI * 42;
      const boosted = ch.skills[s.id] > ch.attributes[s.attribute];
      put(this.add.text(sx, sy, s.name, proseStyle({ fontSize: '22px', color: Ink.dim })));
      put(this.add.text(sx + 250, sy + 2, `${ch.skills[s.id]}${boosted ? ' ◆' : ''}`,
        monoStyle({ fontSize: '17px', color: boosted ? Ink.brass : Ink.ink })));
    });

    // prose column (column 3)
    this.descObjects.forEach((o) => o.destroy());
    this.descObjects = [];
    const putDesc = (o) => { this.descObjects.push(o); return o; };
    const fmtBonuses = (bonuses, lookup) => Object.entries(bonuses)
      .filter(([k]) => k !== '//')
      .map(([k, v]) => `+${v} ${lookup.get(k)?.name ?? k}`).join('  ·  ') || '—';

    let y = 320;
    const block = (title, body, bonusLine) => {
      const head = putDesc(this.add.text(COL3_X, y, title.toUpperCase(),
        displayStyle({ fontSize: '40px' })));
      track(head, 4);
      y += head.height + 14;
      const prose = putDesc(this.add.text(COL3_X, y, body,
        proseStyle({ fontSize: '24px', color: Ink.dim, wordWrap: { width: COL3_W } })));
      y += prose.height + 16;
      const bonuses = putDesc(this.add.text(COL3_X, y, bonusLine,
        monoStyle({ fontSize: '15px', color: Ink.brass, wordWrap: { width: COL3_W } })));
      y += bonuses.height + 30;
    };
    block(race.name, race.desc,
      `${fmtBonuses(race.attributeBonuses, reg.attributes)}   ${fmtBonuses(race.skillBonuses, reg.skills)}`);
    putDesc(hairline(this, COL3_X, y, COL3_W));
    y += 32;
    block(klass.name, klass.desc,
      `${fmtBonuses(klass.attributeBonuses, reg.attributes)}   ${fmtBonuses(klass.skillBonuses, reg.skills)}`);

    putDesc(label(this, COL3_X, y, 'ABILITIES', { size: 13, color: Ink.faint }));
    const abilityNames = klass.abilities.map((a) => reg.abilities.get(a)?.name ?? a).join('  ·  ');
    const abil = putDesc(this.add.text(COL3_X, y + 30, abilityNames,
      proseStyle({ fontSize: '23px', wordWrap: { width: COL3_W } })));
    y += 30 + abil.height + 26;

    putDesc(label(this, COL3_X, y, 'GEAR', { size: 13, color: Ink.faint }));
    const gear = (klass.startingItems ?? [])
      .map((si) => `${reg.items.get(si.item)?.name ?? si.item}${si.qty > 1 ? ` ×${si.qty}` : ''}`).join('  ·  ') || '—';
    putDesc(this.add.text(COL3_X, y + 30, gear, proseStyle({ fontSize: '23px', color: Ink.dim, wordWrap: { width: COL3_W } })));

    // begin button (label depends on points left)
    const ready = remaining === 0 && (this.name || '').trim().length > 0;
    this.beginButton?.destroy();
    this.beginNote?.destroy();
    this.beginNote = ready ? null : label(this,
      this.scale.width - PAD_X - 150, this.scale.height - 142,
      remaining > 0 ? `${remaining} POINT${remaining === 1 ? '' : 'S'} STILL TO ALLOT` : 'A NAME IS REQUIRED',
      { size: 14, color: Ink.faint, origin: [0.5, 0.5] });
    this.beginButton = frameButton(this, this.scale.width - PAD_X - 150, this.scale.height - 84,
      'Begin — Step Onto the Crossing', {
        primary: true, disabled: !ready,
        onClick: () => this.confirm(),
      });
  }

  confirm() {
    if (this.poolRemaining() !== 0 || !(this.name || '').trim()) return;
    const ch = this.preview();
    GameState.player = ch;
    const klass = this.reg.classes.get(this.classId);
    for (const si of klass.startingItems ?? []) GameState.addItem(si.item, si.qty);
    this.scene.start('Exploration');
  }
}
