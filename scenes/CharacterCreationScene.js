/**
 * CharacterCreationScene — name, race, class, attribute points. Everything
 * shown (races, classes, attributes, skills, derived stats, abilities,
 * starting gear) is read from the content registry; the live summary on the
 * right recomputes through CharacterFactory so what you see is exactly what
 * you play.
 */
import { GameState } from '../systems/GameState.js';
import { buildCharacter, baseAttributes } from '../systems/CharacterFactory.js';
import { Colors, uiStyle, bodyStyle, titleStyle } from '../ui/Theme.js';
import { panel, textButton } from '../ui/widgets.js';

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

    this.add.text(80, 40, 'Forge your wanderer', titleStyle({ fontSize: '60px' }));

    panel(this, 60, 140, 560, 1240);
    panel(this, 660, 140, 640, 1240);
    panel(this, 1340, 140, 540, 1240);
    panel(this, 1920, 140, 580, 1240);

    // --- column 1: name, race, class pickers -------------------------------
    this.add.text(100, 172, 'NAME  (click to edit)', uiStyle({ fontSize: '24px', color: Colors.textDim }));
    this.nameText = this.add.text(100, 212, '', bodyStyle({ fontSize: '40px', color: '#ffe9b0' }))
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => { this.typing = true; this.redrawAll(); });
    this.input.keyboard.on('keydown', (ev) => this.onKey(ev));

    this.add.text(100, 312, 'RACE', uiStyle({ fontSize: '24px', color: Colors.textDim }));
    this.raceButtons = [...reg.races.values()].map((race, i) =>
      this.add.text(120, 356 + i * 52, '', uiStyle({ fontSize: '32px' }))
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => { this.raceId = race.id; this.redrawAll(); }));

    const classY = 356 + reg.races.size * 52 + 48;
    this.add.text(100, classY, 'CLASS', uiStyle({ fontSize: '24px', color: Colors.textDim }));
    this.classButtons = [...reg.classes.values()].map((klass, i) =>
      this.add.text(120, classY + 44 + i * 52, '', uiStyle({ fontSize: '32px' }))
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => { this.classId = klass.id; this.redrawAll(); }));

    // --- column 3: attribute points ----------------------------------------
    this.add.text(1380, 172, 'ATTRIBUTES', uiStyle({ fontSize: '24px', color: Colors.textDim }));
    this.poolText = this.add.text(1380, 212, '', uiStyle({ fontSize: '30px', color: '#ffe9b0' }));
    this.attrRows = [...reg.attributes.values()].map((attr, i) => {
      const y = 300 + i * 128;
      this.add.text(1380, y, attr.name, uiStyle({ fontSize: '32px' }));
      const minus = textButton(this, 1380, y + 44, ' − ', {
        style: { fontSize: '36px', backgroundColor: '#22242c', padding: { x: 12, y: 0 } },
        onClick: () => this.adjust(attr.id, -1),
      });
      const value = this.add.text(1480, y + 44, '', uiStyle({ fontSize: '36px', color: '#ffe9b0' }));
      const plus = textButton(this, 1580, y + 44, ' + ', {
        style: { fontSize: '36px', backgroundColor: '#22242c', padding: { x: 12, y: 0 } },
        onClick: () => this.adjust(attr.id, +1),
      });
      const bonus = this.add.text(1660, y + 50, '', uiStyle({ fontSize: '26px', color: Colors.textDim }));
      return { attr, minus, value, plus, bonus };
    });
    this.add.text(1380, 300 + reg.attributes.size * 128 + 20,
      'Race and class bonuses are\nadded on top of your points.',
      uiStyle({ fontSize: '24px', color: Colors.textDim, lineSpacing: 8 }));

    // --- description + summary areas are redrawn wholesale ------------------
    this.descObjects = [];
    this.summaryObjects = [];

    // begin button is rebuilt by redrawAll (label depends on points left)
    this.beginButton = null;

    this.redrawAll();
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
      btn.setText((r.id === this.raceId ? '▸ ' : '  ') + r.name);
      btn.setColor(r.id === this.raceId ? '#ffe9b0' : Colors.text);
    });
    [...reg.classes.values()].forEach((k, i) => {
      const btn = this.classButtons[i];
      btn.setText((k.id === this.classId ? '▸ ' : '  ') + k.name);
      btn.setColor(k.id === this.classId ? '#ffe9b0' : Colors.text);
    });

    this.poolText.setText(`Points remaining: ${this.poolRemaining()}`);
    for (const row of this.attrRows) {
      row.value.setText(String(this.dist[row.attr.id]));
      const b = (race.attributeBonuses[row.attr.id] ?? 0) + (klass.attributeBonuses[row.attr.id] ?? 0);
      row.bonus.setText(b ? `+${b}` : '');
    }

    // description column
    this.descObjects.forEach((o) => o.destroy());
    this.descObjects = [];
    const fmtBonuses = (bonuses, lookup) => Object.entries(bonuses)
      .filter(([k]) => k !== '//')
      .map(([k, v]) => `${lookup.get(k)?.name ?? k} +${v}`).join(', ') || '—';
    const desc = (y, title, body, color = Colors.text) => {
      this.descObjects.push(this.add.text(700, y, title, uiStyle({ fontSize: '26px', color: Colors.textDim })));
      this.descObjects.push(this.add.text(700, y + 40, body, bodyStyle({ fontSize: '28px', color, wordWrap: { width: 560 } })));
    };
    desc(172, race.name.toUpperCase(), race.desc);
    this.descObjects.push(this.add.text(700, 472,
      `Attributes: ${fmtBonuses(race.attributeBonuses, this.reg.attributes)}\nSkills: ${fmtBonuses(race.skillBonuses, this.reg.skills)}`,
      uiStyle({ fontSize: '24px', color: '#b8c8a0', lineSpacing: 8 })));
    desc(600, klass.name.toUpperCase(), klass.desc);
    this.descObjects.push(this.add.text(700, 900,
      `Attributes: ${fmtBonuses(klass.attributeBonuses, this.reg.attributes)}\nSkills: ${fmtBonuses(klass.skillBonuses, this.reg.skills)}`,
      uiStyle({ fontSize: '24px', color: '#b8c8a0', lineSpacing: 8 })));
    const abilityNames = klass.abilities.map((a) => reg.abilities.get(a)?.name ?? a).join(', ');
    this.descObjects.push(this.add.text(700, 1020, `Abilities: ${abilityNames}`,
      uiStyle({ fontSize: '24px', color: '#c8b8d8', wordWrap: { width: 560 }, lineSpacing: 8 })));
    const gear = (klass.startingItems ?? [])
      .map((si) => `${reg.items.get(si.item)?.name ?? si.item}${si.qty > 1 ? ` ×${si.qty}` : ''}`).join(', ') || '—';
    this.descObjects.push(this.add.text(700, 1120, `Gear: ${gear}`,
      uiStyle({ fontSize: '24px', color: '#d8c8a8', wordWrap: { width: 560 } })));

    // summary column — built through the real CharacterFactory
    this.summaryObjects.forEach((o) => o.destroy());
    this.summaryObjects = [];
    const ch = this.preview();
    const add = (y, text, style) => this.summaryObjects.push(this.add.text(1960, y, text, style));
    add(172, 'YOU WILL BE', uiStyle({ fontSize: '24px', color: Colors.textDim }));
    add(212, `${ch.name}\n${race.name} ${klass.name}`, bodyStyle({ fontSize: '34px', color: '#ffe9b0' }));
    add(340, `HP ${ch.maxHp}   Focus ${ch.maxFocus}\nDefense ${ch.defense}   Speed ${ch.speed}`,
      uiStyle({ fontSize: '28px', color: '#c8d8c8', lineSpacing: 10 }));
    add(460, 'SKILLS', uiStyle({ fontSize: '24px', color: Colors.textDim }));
    const skillLines = [...this.reg.skills.values()].map((s) => {
      const base = ch.attributes[s.attribute];
      const v = ch.skills[s.id];
      return `${s.name.padEnd(12, ' ')} ${v}${v > base ? '  ◆' : ''}`;
    });
    add(500, skillLines.join('\n'), {
      fontFamily: 'Consolas, Menlo, monospace', fontSize: '26px', color: Colors.text, lineSpacing: 10,
    });
    add(500 + skillLines.length * 36 + 28, '◆ boosted by race/class\n\nSkills gate dialogue choices,\npuzzle solutions and insights.\nAttributes drive combat.',
      uiStyle({ fontSize: '24px', color: Colors.textDim, lineSpacing: 8 }));

    const remaining = this.poolRemaining();
    const ready = remaining === 0 && (this.name || '').trim().length > 0;
    const label = remaining > 0
      ? `Spend your remaining ${remaining} attribute point${remaining === 1 ? '' : 's'} first`
      : '[ Begin — step onto the Crossing ]';
    this.beginButton?.destroy();
    this.beginButton = textButton(this, this.scale.width / 2, 1412, label, {
      style: { fontSize: '40px', color: '#d8b36a' },
      disabled: !ready,
      onClick: () => this.confirm(),
    }).setOrigin(0.5, 1);
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
