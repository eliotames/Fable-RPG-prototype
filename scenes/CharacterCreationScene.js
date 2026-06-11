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

    this.add.text(40, 20, 'Forge your wanderer', titleStyle({ fontSize: '30px' }));

    panel(this, 30, 70, 280, 620);
    panel(this, 330, 70, 320, 620);
    panel(this, 670, 70, 270, 620);
    panel(this, 960, 70, 290, 620);

    // --- column 1: name, race, class pickers -------------------------------
    this.add.text(50, 86, 'NAME  (click to edit)', uiStyle({ fontSize: '12px', color: Colors.textDim }));
    this.nameText = this.add.text(50, 106, '', bodyStyle({ fontSize: '20px', color: '#ffe9b0' }))
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => { this.typing = true; this.redrawAll(); });
    this.input.keyboard.on('keydown', (ev) => this.onKey(ev));

    this.add.text(50, 156, 'RACE', uiStyle({ fontSize: '12px', color: Colors.textDim }));
    this.raceButtons = [...reg.races.values()].map((race, i) =>
      this.add.text(60, 178 + i * 26, '', uiStyle({ fontSize: '16px' }))
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => { this.raceId = race.id; this.redrawAll(); }));

    const classY = 178 + reg.races.size * 26 + 24;
    this.add.text(50, classY, 'CLASS', uiStyle({ fontSize: '12px', color: Colors.textDim }));
    this.classButtons = [...reg.classes.values()].map((klass, i) =>
      this.add.text(60, classY + 22 + i * 26, '', uiStyle({ fontSize: '16px' }))
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => { this.classId = klass.id; this.redrawAll(); }));

    // --- column 3: attribute points ----------------------------------------
    this.add.text(690, 86, 'ATTRIBUTES', uiStyle({ fontSize: '12px', color: Colors.textDim }));
    this.poolText = this.add.text(690, 106, '', uiStyle({ fontSize: '15px', color: '#ffe9b0' }));
    this.attrRows = [...reg.attributes.values()].map((attr, i) => {
      const y = 150 + i * 64;
      this.add.text(690, y, attr.name, uiStyle({ fontSize: '16px' }));
      const minus = textButton(this, 690, y + 22, ' − ', {
        style: { fontSize: '18px', backgroundColor: '#22242c', padding: { x: 6, y: 0 } },
        onClick: () => this.adjust(attr.id, -1),
      });
      const value = this.add.text(740, y + 22, '', uiStyle({ fontSize: '18px', color: '#ffe9b0' }));
      const plus = textButton(this, 790, y + 22, ' + ', {
        style: { fontSize: '18px', backgroundColor: '#22242c', padding: { x: 6, y: 0 } },
        onClick: () => this.adjust(attr.id, +1),
      });
      const bonus = this.add.text(830, y + 25, '', uiStyle({ fontSize: '13px', color: Colors.textDim }));
      return { attr, minus, value, plus, bonus };
    });
    this.add.text(690, 150 + reg.attributes.size * 64 + 10,
      'Race and class bonuses are\nadded on top of your points.',
      uiStyle({ fontSize: '12px', color: Colors.textDim, lineSpacing: 4 }));

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
      this.descObjects.push(this.add.text(350, y, title, uiStyle({ fontSize: '13px', color: Colors.textDim })));
      this.descObjects.push(this.add.text(350, y + 20, body, bodyStyle({ fontSize: '14px', color, wordWrap: { width: 280 } })));
    };
    desc(86, race.name.toUpperCase(), race.desc);
    this.descObjects.push(this.add.text(350, 236,
      `Attributes: ${fmtBonuses(race.attributeBonuses, this.reg.attributes)}\nSkills: ${fmtBonuses(race.skillBonuses, this.reg.skills)}`,
      uiStyle({ fontSize: '12px', color: '#b8c8a0', lineSpacing: 4 })));
    desc(300, klass.name.toUpperCase(), klass.desc);
    this.descObjects.push(this.add.text(350, 450,
      `Attributes: ${fmtBonuses(klass.attributeBonuses, this.reg.attributes)}\nSkills: ${fmtBonuses(klass.skillBonuses, this.reg.skills)}`,
      uiStyle({ fontSize: '12px', color: '#b8c8a0', lineSpacing: 4 })));
    const abilityNames = klass.abilities.map((a) => reg.abilities.get(a)?.name ?? a).join(', ');
    this.descObjects.push(this.add.text(350, 510, `Abilities: ${abilityNames}`,
      uiStyle({ fontSize: '12px', color: '#c8b8d8', wordWrap: { width: 280 }, lineSpacing: 4 })));
    const gear = (klass.startingItems ?? [])
      .map((si) => `${reg.items.get(si.item)?.name ?? si.item}${si.qty > 1 ? ` ×${si.qty}` : ''}`).join(', ') || '—';
    this.descObjects.push(this.add.text(350, 560, `Gear: ${gear}`,
      uiStyle({ fontSize: '12px', color: '#d8c8a8', wordWrap: { width: 280 } })));

    // summary column — built through the real CharacterFactory
    this.summaryObjects.forEach((o) => o.destroy());
    this.summaryObjects = [];
    const ch = this.preview();
    const add = (y, text, style) => this.summaryObjects.push(this.add.text(980, y, text, style));
    add(86, 'YOU WILL BE', uiStyle({ fontSize: '12px', color: Colors.textDim }));
    add(106, `${ch.name}\n${race.name} ${klass.name}`, bodyStyle({ fontSize: '17px', color: '#ffe9b0' }));
    add(170, `HP ${ch.maxHp}   Focus ${ch.maxFocus}\nDefense ${ch.defense}   Speed ${ch.speed}`,
      uiStyle({ fontSize: '14px', color: '#c8d8c8', lineSpacing: 5 }));
    add(230, 'SKILLS', uiStyle({ fontSize: '12px', color: Colors.textDim }));
    const skillLines = [...this.reg.skills.values()].map((s) => {
      const base = ch.attributes[s.attribute];
      const v = ch.skills[s.id];
      return `${s.name.padEnd(12, ' ')} ${v}${v > base ? '  ◆' : ''}`;
    });
    add(250, skillLines.join('\n'), {
      fontFamily: 'Consolas, Menlo, monospace', fontSize: '13px', color: Colors.text, lineSpacing: 5,
    });
    add(250 + skillLines.length * 18 + 14, '◆ boosted by race/class\n\nSkills gate dialogue choices,\npuzzle solutions and insights.\nAttributes drive combat.',
      uiStyle({ fontSize: '12px', color: Colors.textDim, lineSpacing: 4 }));

    const remaining = this.poolRemaining();
    const ready = remaining === 0 && (this.name || '').trim().length > 0;
    const label = remaining > 0
      ? `Spend your remaining ${remaining} attribute point${remaining === 1 ? '' : 's'} first`
      : '[ Begin — step onto the Crossing ]';
    this.beginButton?.destroy();
    this.beginButton = textButton(this, this.scale.width / 2, 706, label, {
      style: { fontSize: '20px', color: '#d8b36a' },
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
