/**
 * ExplorationScene — the top-down world. Renders a Tiled-format orthogonal
 * tilemap in an oblique top-down perspective, tile-by-tile player movement,
 * and interactables defined entirely in the map's object layer
 * (kind=npc|object|barrier|spawn with tx/ty tile coordinates). Every interaction opens a dialogue from data/dialogue/*.json
 * via the overlay DialogueScene — NPCs, crates, gates and doors all use the
 * same path, so new interactions are pure content.
 */
import { GameState } from '../systems/GameState.js';
import { QuestSystem } from '../systems/QuestSystem.js';
import { propsOf } from '../systems/ContentRegistry.js';
import { Palette, Ink, displayStyle, proseStyle, monoStyle, track } from '../ui/Theme.js';
import { panel, tickFrame, statBar, label, frameButton, makeNotifier } from '../ui/widgets.js';

const STEP_MS = 170;

export class ExplorationScene extends Phaser.Scene {
  constructor() {
    super('Exploration');
  }

  /** @param {{mapKey?: string, launchDialogue?: string}} data */
  create(data = {}) {
    /** @type {object} ContentRegistry */
    this.reg = this.registry.get('content');

    // Two cameras: the main one zooms with the world; the UI camera stays at
    // native scale (Phaser zoom scales scrollFactor-0 objects too, so fixed
    // HUD/panels/toasts must render through their own camera). Every game
    // object belongs to exactly one of them via asWorld/asUI.
    this.uiCam = this.cameras.add(0, 0, this.scale.width, this.scale.height);
    this.asWorld = (o) => { this.uiCam.ignore(o); return o; };
    this.asUI = (o) => { this.cameras.main.ignore(o); return o; };
    const baseNotify = makeNotifier(this);
    this.notify = (text) => this.asUI(baseNotify(text));

    this.mapKey = data.mapKey ?? GameState.flags['current-map'] ?? [...this.reg.maps.keys()][0];
    GameState.setFlag('current-map', this.mapKey);
    const rawMap = this.reg.maps.get(this.mapKey);
    this.mapProps = propsOf(rawMap);

    this.map = this.make.tilemap({ key: this.mapKey });
    const tsName = rawMap.tilesets[0].name;
    const tileset = this.map.addTilesetImage(tsName, 'tiles');
    const offsetX = Math.max(0, (this.scale.width - this.map.widthInPixels) / 2);
    this.layer = this.asWorld(this.map.createLayer(0, tileset, offsetX, 200));
    this.blocked = new Set(String(this.mapProps.blockedTiles ?? '').split(',').map((s) => parseInt(s, 10)).filter((n) => !isNaN(n)));

    this.parseObjects(rawMap);
    this.spawnPlayer();
    this.buildHud();

    this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,E,SPACE,J,C,Z,X');
    this.moving = false;
    this.uiPanel = null;

    const cam = this.cameras.main;
    cam.startFollow(this.playerToken, true, 0.12, 0.12);
    cam.setDeadzone(240, 180);
    this.zoomLevels = this.reg.tuning.exploration.zoomLevels;
    this.zoomIndex = Phaser.Math.Clamp(
      this.reg.tuning.exploration.zoomDefaultIndex, 0, this.zoomLevels.length - 1);
    cam.setZoom(this.zoomLevels[this.zoomIndex]);
    this.applyCameraBounds(this.zoomLevels[this.zoomIndex]);

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

  /** Center world position of a tile. */
  worldPos(tx, ty) {
    const p = this.map.tileToWorldXY(tx, ty, undefined, this.cameras.main, this.layer);
    if (p) return { x: p.x + this.map.tileWidth / 2, y: p.y + this.map.tileHeight / 2 };
    // fallback: orthogonal projection formula
    return {
      x: this.layer.x + tx * this.map.tileWidth + this.map.tileWidth / 2,
      y: this.layer.y + ty * this.map.tileHeight + this.map.tileHeight / 2,
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
      this.add.image(0, 0, 'token').setTint(tint),
      this.add.text(0, 0, it.glyph, monoStyle({ fontSize: '26px', color: '#0c0a08', fontStyle: 'bold' })).setOrigin(0.5),
    ];
    if (it.displayName) {
      parts.push(track(this.add.text(0, -58, it.displayName.toUpperCase(),
        monoStyle({ fontSize: '19px', color: it.color, backgroundColor: '#0c0a08aa', padding: { x: 10, y: 4 } })).setOrigin(0.5), 3));
    }
    it.token = this.asWorld(this.add.container(pos.x, pos.y, parts).setDepth(pos.y));
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
    this.playerToken = this.asWorld(this.add.container(pos.x, pos.y, [
      this.add.image(0, 0, 'token').setTint(Palette.brass),
      this.add.text(0, 0, '@', monoStyle({ fontSize: '28px', color: '#0c0a08', fontStyle: 'bold' })).setOrigin(0.5),
    ]).setDepth(pos.y + 1));
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
    if (Phaser.Input.Keyboard.JustDown(k.Z)) return this.stepZoom(1);
    if (Phaser.Input.Keyboard.JustDown(k.X)) return this.stepZoom(-1);
    if (this.uiPanel) {
      if (Phaser.Input.Keyboard.JustDown(k.E) || Phaser.Input.Keyboard.JustDown(k.SPACE)) this.togglePanel(this.uiPanel.kind);
      return;
    }

    const near = this.adjacentInteractable();
    this.promptText.setText(near ? `[E]  ${(near.label ?? near.name).toUpperCase()}` : '').setVisible(!!near);
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

  /** Z (+1) / X (−1): step the world camera one zoom level out or in. */
  stepZoom(dir) {
    const next = Phaser.Math.Clamp(this.zoomIndex + dir, 0, this.zoomLevels.length - 1);
    if (next === this.zoomIndex) return;
    this.zoomIndex = next;
    const cam = this.cameras.main;
    this.zoomTween?.stop();
    // Tween the zoom and re-derive the bounds from the in-between zoom every
    // frame: a one-shot bounds change snaps the clamped scroll position in a
    // single frame, which reads as a jerk mid-transition.
    this.zoomTween = this.tweens.add({
      targets: cam, zoom: this.zoomLevels[next],
      duration: this.reg.tuning.exploration.zoomTweenMs, ease: 'Sine.easeInOut',
      onUpdate: () => this.applyCameraBounds(cam.zoom),
    });
  }

  /**
   * Clamp the world camera to the map plus a margin, so it never frames empty
   * void. When the view at the given zoom is larger than that rect, grow the
   * bounds to the view size instead — Phaser pins oversized views to the
   * bounds' top-left corner, and matching the sizes keeps the map centered.
   */
  applyCameraBounds(zoom) {
    const w = Math.max(this.map.widthInPixels + 400, this.scale.width / zoom);
    const h = Math.max(this.map.heightInPixels + 400, this.scale.height / zoom);
    const cx = this.layer.x + this.map.widthInPixels / 2;
    const cy = this.layer.y + this.map.heightInPixels / 2;
    this.cameras.main.setBounds(cx - w / 2, cy - h / 2, w, h);
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
    const sw = this.scale.width, sh = this.scale.height;
    const ui = (o) => this.asUI(o.setScrollFactor(0).setDepth(4001));

    ui(track(this.add.text(48, 44, (this.mapProps.displayName ?? this.mapKey).toUpperCase(),
      monoStyle({ fontSize: '22px', color: Ink.ink, backgroundColor: '#0c0a08bb', padding: { x: 14, y: 8 } })), 5));
    this.hintText = ui(track(this.add.text(48, 106, '',
      monoStyle({ fontSize: '16px', color: Ink.dim, backgroundColor: '#0c0a08bb', padding: { x: 14, y: 7 } })), 3));
    ui(track(this.add.text(sw - 48, 48, 'WASD move · E interact · Z/X zoom · J journal · C party'.toUpperCase(),
      monoStyle({ fontSize: '15px', color: Ink.dim, backgroundColor: '#0c0a08bb', padding: { x: 12, y: 7 } }))
      .setOrigin(1, 0), 3));

    // bottom-right action buttons (mirrors the J / C keys)
    ui(frameButton(this, sw - 322, sh - 66, 'Journal', {
      framed: true, size: 16, padX: 26, padY: 13, onClick: () => this.togglePanel('journal'),
    }));
    ui(frameButton(this, sw - 136, sh - 66, 'Party', {
      framed: true, size: 16, padX: 26, padY: 13, onClick: () => this.togglePanel('party'),
    }));

    this.promptText = ui(track(this.add.text(sw / 2, sh - 72, '',
      monoStyle({ fontSize: '23px', color: Ink.ink, backgroundColor: '#0c0a08ee', padding: { x: 28, y: 14 } }))
      .setOrigin(0.5), 3)).setVisible(false);
    this.refreshHud();
  }

  refreshHud() {
    const active = QuestSystem.journalEntries().filter((e) => !e.done);
    this.hintText.setText(active.length
      ? `◆ ${active[0].quest.name}: ${active[0].stageDef?.hint ?? ''}`.toUpperCase()
      : 'EXPLORE THE CROSSING. SOMEONE HERE NEEDS HELP.');
  }

  togglePanel(kind) {
    if (this.uiPanel) {
      const wasSame = this.uiPanel.kind === kind;
      this.uiPanel.objects.forEach((o) => o.destroy());
      this.uiPanel = null;
      if (wasSame) return;
    }
    const objects = [];
    const w = 1760, h = 1120, x = (this.scale.width - w) / 2, y = 160;
    const ui = (o) => { objects.push(this.asUI(o.setScrollFactor(0).setDepth(4501))); return o; };
    ui(panel(this, x, y, w, h, 0.97).setDepth(4500));
    ui(tickFrame(this, x, y, w, h));
    const PX = 90; // inner padding
    const head = (title, sub) => {
      ui(label(this, x + PX, y + 64, sub, { size: 15, color: Ink.faint }));
      ui(track(this.add.text(x + PX, y + 96, title, displayStyle({ fontSize: '46px' })), 7));
    };

    if (kind === 'journal') {
      head('JOURNAL', 'KEPT AGAINST THE QUIET');
      ui(label(this, x + w - PX, y + 76, '[J] CLOSE', { size: 15, color: Ink.dim, origin: [1, 0] }));
      const entries = QuestSystem.journalEntries();
      let ey = y + 220;
      if (!entries.length) {
        ui(this.add.text(x + PX, ey, 'No quests yet. Talk to the people of the Crossing.',
          proseStyle({ fontSize: '30px', fontStyle: 'italic', color: Ink.dim })));
      }
      for (const e of entries) {
        ui(this.add.text(x + PX, ey + 8, e.done ? '◇' : '◆',
          monoStyle({ fontSize: '17px', color: e.done ? Ink.faint : Ink.accentBright })));
        ui(this.add.text(x + PX + 48, ey, e.quest.name,
          displayStyle({ fontSize: '38px', color: e.done ? Ink.faint : Ink.ink })));
        const body = ui(this.add.text(x + PX + 48, ey + 58,
          e.done ? 'Concluded.' : (e.stageDef?.journal ?? ''),
          proseStyle({ fontSize: '29px', color: Ink.dim, wordWrap: { width: w - PX * 2 - 48 } })));
        ey += 58 + body.height + 46;
      }
    } else {
      head('PARTY & PACK', 'THE COMPANY, COUNTED');
      ui(label(this, x + w - PX, y + 76, '[C] CLOSE', { size: 15, color: Ink.dim, origin: [1, 0] }));
      GameState.fullParty().forEach((m, i) => {
        const cx = x + PX + i * 540, cy = y + 210;
        ui(this.add.text(cx, cy, m.name, displayStyle({ fontSize: '38px' })));
        const race = this.reg.races.get(m.raceId)?.name ?? m.raceId;
        const klass = this.reg.classes.get(m.classId)?.name ?? m.classId;
        ui(label(this, cx, cy + 56, `${race} ${klass}${m.isPlayer ? ' · YOU' : ''}`, { size: 15, color: Ink.dim }));
        const hpBar = statBar(this, cx, cy + 106, 320, 8, Palette.accent);
        hpBar.update(m.hp, m.maxHp);
        ui(hpBar.gameObject);
        ui(this.add.text(cx + 340, cy + 98, `${m.hp} / ${m.maxHp}`, monoStyle({ fontSize: '17px', color: Ink.dim })));
        const focusBar = statBar(this, cx, cy + 134, 320, 6, Palette.brass);
        focusBar.update(m.focus, m.maxFocus);
        ui(focusBar.gameObject);
        ui(this.add.text(cx + 340, cy + 124, `${m.focus} ◈`, monoStyle({ fontSize: '17px', color: Ink.brass })));
        const attrs = [...this.reg.attributes.values()].map((a) => `${a.abbr} ${m.attributes[a.id]}`).join('   ');
        ui(label(this, cx, cy + 178, `DEF ${m.defense}  ·  SPD ${m.speed}     ${attrs}`, { size: 15, color: Ink.dim }));
        const abil = m.abilities.map((a) => this.reg.abilities.get(a)?.name ?? a).join('\n');
        ui(this.add.text(cx, cy + 226, abil, proseStyle({ fontSize: '27px', color: Ink.dim, lineSpacing: 8 })));
      });
      let sy = y + 620;
      ui(label(this, x + PX, sy, 'SKILLS — YOU', { size: 15, color: Ink.faint }));
      ui(this.hairlineIn(x + PX, sy + 34, w - PX * 2));
      const p = GameState.player;
      const skills = [...this.reg.skills.values()];
      skills.forEach((s, i) => {
        const col = i % 4, row = Math.floor(i / 4);
        const sx = x + PX + col * 400;
        ui(this.add.text(sx, sy + 56 + row * 48, s.name, proseStyle({ fontSize: '27px', color: Ink.dim })));
        ui(this.add.text(sx + 310, sy + 60 + row * 48, String(p.skills[s.id]), monoStyle({ fontSize: '19px', color: Ink.ink })));
      });
      sy += 56 + Math.ceil(skills.length / 4) * 48 + 40;
      ui(label(this, x + PX, sy, 'PACK', { size: 15, color: Ink.faint }));
      ui(this.hairlineIn(x + PX, sy + 34, w - PX * 2));
      const inv = Object.entries(GameState.inventory)
        .map(([id, qty]) => `${this.reg.items.get(id)?.name ?? id}${qty > 1 ? ` ×${qty}` : ''}`).join('   ·   ') || 'Empty.';
      ui(this.add.text(x + PX, sy + 54, inv, proseStyle({ fontSize: '29px', wordWrap: { width: w - PX * 2 } })));
    }
    this.uiPanel = { kind, objects };
  }

  /** Hairline used inside the overlay panels (kept here for depth routing). */
  hairlineIn(x, y, w) {
    const g = this.add.graphics();
    g.lineStyle(2, Palette.line, 1);
    g.lineBetween(x, y, x + w, y);
    return g;
  }
}
