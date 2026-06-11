/**
 * ExplorationScene — the isometric world. Renders a Tiled-format isometric
 * tilemap, tile-by-tile player movement, and interactables defined entirely in
 * the map's object layer (kind=npc|object|barrier|spawn with tx/ty tile
 * coordinates). Every interaction opens a dialogue from data/dialogue/*.json
 * via the overlay DialogueScene — NPCs, crates, gates and doors all use the
 * same path, so new interactions are pure content.
 */
import { GameState } from '../systems/GameState.js';
import { QuestSystem } from '../systems/QuestSystem.js';
import { propsOf } from '../systems/ContentRegistry.js';
import { Colors, uiStyle, bodyStyle } from '../ui/Theme.js';
import { panel, makeNotifier } from '../ui/widgets.js';

const STEP_MS = 170;

export class ExplorationScene extends Phaser.Scene {
  constructor() {
    super('Exploration');
  }

  /** @param {{mapKey?: string, launchDialogue?: string}} data */
  create(data = {}) {
    /** @type {object} ContentRegistry */
    this.reg = this.registry.get('content');
    this.notify = makeNotifier(this);

    this.mapKey = data.mapKey ?? GameState.flags['current-map'] ?? [...this.reg.maps.keys()][0];
    GameState.setFlag('current-map', this.mapKey);
    const rawMap = this.reg.maps.get(this.mapKey);
    this.mapProps = propsOf(rawMap);

    this.map = this.make.tilemap({ key: this.mapKey });
    const tsName = rawMap.tilesets[0].name;
    const tileset = this.map.addTilesetImage(tsName, 'tiles');
    const offsetX = (this.map.height - 1) * (this.map.tileWidth / 2) + 240;
    this.layer = this.map.createLayer(0, tileset, offsetX, 200);
    this.blocked = new Set(String(this.mapProps.blockedTiles ?? '').split(',').map((s) => parseInt(s, 10)).filter((n) => !isNaN(n)));

    this.parseObjects(rawMap);
    this.spawnPlayer();
    this.buildHud();

    this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,E,SPACE,J,C');
    this.moving = false;
    this.uiPanel = null;

    const cam = this.cameras.main;
    cam.startFollow(this.playerToken, true, 0.12, 0.12);
    cam.setDeadzone(240, 180);

    this.events.on('resume', () => {
      this.input.keyboard.resetKeys();
      this.refreshWorldState();
      this.refreshHud();
    });

    if (data.launchDialogue) {
      this.time.delayedCall(250, () => this.openDialogue(data.launchDialogue));
    }
  }

  // ---------------------------------------------------------------- world --

  /** Diamond-center world position of a tile. */
  worldPos(tx, ty) {
    const p = this.map.tileToWorldXY(tx, ty, undefined, this.cameras.main, this.layer);
    if (p) return { x: p.x + this.map.tileWidth / 2, y: p.y + this.map.tileHeight / 2 };
    // fallback: Phaser's isometric projection formula
    return {
      x: this.layer.x + (tx - ty) * (this.map.tileWidth / 2) + this.map.tileWidth / 2,
      y: this.layer.y + (tx + ty) * (this.map.tileHeight / 2) + this.map.tileHeight / 2,
    };
  }

  parseObjects(rawMap) {
    /** @type {Array<object>} */
    this.interactables = [];
    this.playerStart = { tx: 1, ty: 1 };
    for (const layer of rawMap.layers) {
      if (layer.type !== 'objectgroup') continue;
      for (const obj of layer.objects ?? []) {
        const props = propsOf(obj);
        if (props.kind === 'spawn') {
          this.playerStart = { tx: props.tx, ty: props.ty };
          continue;
        }
        const entry = {
          name: obj.name, kind: props.kind, tx: props.tx, ty: props.ty,
          ref: props.ref ?? null,
          dialogueId: props.dialogue ?? null,
          flag: props.flag ?? null,           // barrier: open when this flag is set
          hideFlag: props.hideFlag ?? null,   // hide token when this flag is set
          label: props.label ?? null,
          glyph: props.glyph ?? '?',
          color: props.color ?? '#c8c4b8',
          token: null,
        };
        if (entry.kind === 'npc') {
          const npc = this.reg.npcs.get(entry.ref);
          entry.dialogueId = npc.dialogue;
          entry.label = entry.label ?? `Talk to ${npc.name}`;
          entry.glyph = npc.glyph;
          entry.color = npc.color;
          entry.displayName = npc.name;
        }
        this.interactables.push(entry);
      }
    }
    for (const it of this.interactables) this.makeToken(it);
    this.refreshWorldState();
  }

  makeToken(it) {
    const pos = this.worldPos(it.tx, it.ty);
    const tint = Phaser.Display.Color.HexStringToColor(it.color).color;
    const parts = [
      this.add.image(0, -16, 'token').setTint(tint),
      this.add.text(0, -16, it.glyph, uiStyle({ fontSize: '28px', color: '#0b0c10', fontStyle: 'bold' })).setOrigin(0.5),
    ];
    if (it.displayName) {
      parts.push(this.add.text(0, -68, it.displayName,
        uiStyle({ fontSize: '24px', color: it.color, backgroundColor: '#0b0c10aa', padding: { x: 8, y: 2 } })).setOrigin(0.5));
    }
    it.token = this.add.container(pos.x, pos.y, parts).setDepth(pos.y);
  }

  /** Apply flags to the world: open barriers, hide recruited NPCs / flagged tokens. */
  refreshWorldState() {
    for (const it of this.interactables) {
      let hidden = false;
      if (it.kind === 'barrier' && it.flag && GameState.hasFlag(it.flag)) hidden = true;
      if (it.hideFlag && GameState.hasFlag(it.hideFlag)) hidden = true;
      if (it.kind === 'npc' && GameState.hasPartyMember(it.ref)) hidden = true;
      it.hidden = hidden;
      it.token.setVisible(!hidden);
    }
  }

  spawnPlayer() {
    this.ptx = this.playerStart.tx;
    this.pty = this.playerStart.ty;
    const pos = this.worldPos(this.ptx, this.pty);
    this.playerToken = this.add.container(pos.x, pos.y, [
      this.add.image(0, -16, 'token').setTint(0xd8b36a),
      this.add.text(0, -16, '@', uiStyle({ fontSize: '30px', color: '#0b0c10', fontStyle: 'bold' })).setOrigin(0.5),
    ]).setDepth(pos.y + 1);
  }

  isBlocked(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= this.map.width || ty >= this.map.height) return true;
    const tile = this.layer.getTileAt(tx, ty);
    if (!tile || this.blocked.has(tile.index)) return true;
    return this.interactables.some((it) => !it.hidden && it.tx === tx && it.ty === ty);
  }

  // ----------------------------------------------------------------- loop --

  update() {
    if (this.moving || this.scene.isPaused()) return;
    const k = this.keys;

    if (Phaser.Input.Keyboard.JustDown(k.J)) return this.togglePanel('journal');
    if (Phaser.Input.Keyboard.JustDown(k.C)) return this.togglePanel('party');
    if (this.uiPanel) {
      if (Phaser.Input.Keyboard.JustDown(k.E) || Phaser.Input.Keyboard.JustDown(k.SPACE)) this.togglePanel(this.uiPanel.kind);
      return;
    }

    const near = this.adjacentInteractable();
    this.promptText.setText(near ? `[E] ${near.label ?? near.name}` : '').setVisible(!!near);
    if (near && (Phaser.Input.Keyboard.JustDown(k.E) || Phaser.Input.Keyboard.JustDown(k.SPACE))) {
      if (near.dialogueId) this.openDialogue(near.dialogueId);
      return;
    }

    let dx = 0, dy = 0;
    if (k.W.isDown || k.UP.isDown) dy = -1;
    else if (k.S.isDown || k.DOWN.isDown) dy = 1;
    else if (k.A.isDown || k.LEFT.isDown) dx = -1;
    else if (k.D.isDown || k.RIGHT.isDown) dx = 1;
    if (dx === 0 && dy === 0) return;

    const tx = this.ptx + dx, ty = this.pty + dy;
    if (this.isBlocked(tx, ty)) return;
    this.moving = true;
    this.ptx = tx; this.pty = ty;
    const pos = this.worldPos(tx, ty);
    this.tweens.add({
      targets: this.playerToken, x: pos.x, y: pos.y, duration: STEP_MS,
      onUpdate: () => this.playerToken.setDepth(this.playerToken.y + 1),
      onComplete: () => { this.moving = false; },
    });
  }

  adjacentInteractable() {
    const dirs = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [dx, dy] of dirs) {
      const found = this.interactables.find((it) =>
        !it.hidden && it.dialogueId && it.tx === this.ptx + dx && it.ty === this.pty + dy);
      if (found) return found;
    }
    return null;
  }

  openDialogue(dialogueId) {
    this.promptText.setVisible(false);
    this.scene.launch('Dialogue', { dialogueId, returnScene: 'Exploration' });
    this.scene.pause();
  }

  // ------------------------------------------------------------------ HUD --

  buildHud() {
    const sw = this.scale.width;
    this.add.rectangle(0, 0, sw, 116, Colors.panel, 0.92).setOrigin(0).setScrollFactor(0).setDepth(4000);
    this.add.text(40, 16, this.mapProps.displayName ?? this.mapKey,
      bodyStyle({ fontSize: '36px', color: '#ffe9b0' })).setScrollFactor(0).setDepth(4001);
    this.hintText = this.add.text(40, 68, '', uiStyle({ fontSize: '26px', color: Colors.textDim }))
      .setScrollFactor(0).setDepth(4001);
    this.add.text(sw - 40, 40, 'WASD move · E interact · J journal · C party',
      uiStyle({ fontSize: '24px', color: Colors.textDim })).setOrigin(1, 0.5).setScrollFactor(0).setDepth(4001);
    this.promptText = this.add.text(sw / 2, this.scale.height - 72, '',
      uiStyle({ fontSize: '34px', color: '#ffe9b0', backgroundColor: '#14161dee', padding: { x: 24, y: 12 } }))
      .setOrigin(0.5).setScrollFactor(0).setDepth(4001).setVisible(false);
    this.refreshHud();
  }

  refreshHud() {
    const active = QuestSystem.journalEntries().filter((e) => !e.done);
    this.hintText.setText(active.length
      ? `◈ ${active[0].quest.name}: ${active[0].stageDef?.hint ?? ''}`
      : 'Explore the Crossing. Someone here needs help.');
  }

  togglePanel(kind) {
    if (this.uiPanel) {
      const wasSame = this.uiPanel.kind === kind;
      this.uiPanel.objects.forEach((o) => o.destroy());
      this.uiPanel = null;
      if (wasSame) return;
    }
    const objects = [];
    const w = 1320, h = 1040, x = (this.scale.width - w) / 2, y = 180;
    objects.push(panel(this, x, y, w, h).setScrollFactor(0).setDepth(4500));
    const txt = (tx, ty, str, style) =>
      objects.push(this.add.text(x + tx, y + ty, str, style).setScrollFactor(0).setDepth(4501));

    if (kind === 'journal') {
      txt(48, 36, 'JOURNAL', uiStyle({ fontSize: '28px', color: '#ffe9b0' }));
      const entries = QuestSystem.journalEntries();
      if (!entries.length) txt(48, 112, 'No quests yet. Talk to the people of Greyreach.', bodyStyle({ fontSize: '32px' }));
      entries.forEach((e, i) => {
        txt(48, 112 + i * 220, `${e.done ? '✓' : '◈'} ${e.quest.name}`, bodyStyle({ fontSize: '36px', color: e.done ? '#8aa88a' : '#ffe9b0' }));
        txt(48, 168 + i * 220, e.done ? 'Complete.' : (e.stageDef?.journal ?? ''), bodyStyle({ fontSize: '30px', color: Colors.text, wordWrap: { width: w - 120 } }));
      });
      txt(48, h - 68, '[J] close', uiStyle({ fontSize: '24px', color: Colors.textDim }));
    } else {
      txt(48, 36, 'PARTY & PACK', uiStyle({ fontSize: '28px', color: '#ffe9b0' }));
      GameState.fullParty().forEach((m, i) => {
        const cx = 48 + i * 430;
        const race = this.reg.races.get(m.raceId)?.name ?? m.raceId;
        const klass = this.reg.classes.get(m.classId)?.name ?? m.classId;
        txt(cx, 104, `${m.name}${m.isPlayer ? ' (you)' : ''}`, bodyStyle({ fontSize: '32px', color: '#ffe9b0' }));
        txt(cx, 152, `${race} ${klass}`, uiStyle({ fontSize: '24px', color: Colors.textDim }));
        txt(cx, 196, `HP ${m.hp}/${m.maxHp}  Focus ${m.focus}/${m.maxFocus}\nDef ${m.defense}  Spd ${m.speed}`, uiStyle({ fontSize: '24px', lineSpacing: 8 }));
        const attrs = [...this.reg.attributes.values()].map((a) => `${a.abbr} ${m.attributes[a.id]}`).join('  ');
        txt(cx, 280, attrs, uiStyle({ fontSize: '24px', color: '#b8c8a0' }));
        const abil = m.abilities.map((a) => this.reg.abilities.get(a)?.name ?? a).join('\n');
        txt(cx, 328, abil, uiStyle({ fontSize: '24px', color: '#c8b8d8', lineSpacing: 8 }));
      });
      txt(48, 580, 'SKILLS (you)', uiStyle({ fontSize: '24px', color: Colors.textDim }));
      const p = GameState.player;
      const skills = [...this.reg.skills.values()].map((s) => `${s.name} ${p.skills[s.id]}`).join('   ');
      txt(48, 620, skills, uiStyle({ fontSize: '26px', color: Colors.text, wordWrap: { width: w - 120 }, lineSpacing: 10 }));
      txt(48, 740, 'PACK', uiStyle({ fontSize: '24px', color: Colors.textDim }));
      const inv = Object.entries(GameState.inventory)
        .map(([id, qty]) => `${this.reg.items.get(id)?.name ?? id}${qty > 1 ? ` ×${qty}` : ''}`).join(',   ') || 'Empty.';
      txt(48, 780, inv, bodyStyle({ fontSize: '30px', wordWrap: { width: w - 120 } }));
      txt(48, h - 68, '[C] close', uiStyle({ fontSize: '24px', color: Colors.textDim }));
    }
    this.uiPanel = { kind, objects };
  }
}
