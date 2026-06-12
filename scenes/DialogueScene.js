/**
 * DialogueScene — overlay that runs any dialogue JSON: branching nodes,
 * passive skill "voices" (internal commentary that surfaces when a skill is
 * high enough), condition-gated options, and active checks (roll + skill vs
 * DC, success and failure both routing somewhere). Effects are executed by
 * systems/Script.js; combat starts and slice endings are hooks back into the
 * scene manager. Nothing here knows any specific NPC, item or quest.
 *
 * Presentation: letterbox bars top and bottom, the conversation in a column
 * fading in from the right edge, the speaker framed at lower left — the world
 * stays visible behind it all.
 */
import { GameState } from '../systems/GameState.js';
import { evaluateConditions, applyEffects } from '../systems/Script.js';
import { activeCheck, passiveCheck, difficultyLabel } from '../systems/CheckResolver.js';
import { Palette, Ink, displayStyle, proseStyle, monoStyle, track } from '../ui/Theme.js';
import { tickFrame, hairline, makeNotifier, label } from '../ui/widgets.js';

const BAR_H = 100;       // letterbox bars
const COL_W = 1060;      // conversation column
const COL_PAD_L = 150;   // column left padding (inside the gradient)
const TEXT_W = 790;      // wrap width inside the column

export class DialogueScene extends Phaser.Scene {
  constructor() {
    super('Dialogue');
  }

  /** @param {{dialogueId: string, returnScene: string}} data */
  create(data) {
    /** @type {object} ContentRegistry */
    this.reg = this.registry.get('content');
    this.returnScene = data.returnScene ?? 'Exploration';
    this.dialogue = this.reg.dialogues.get(data.dialogueId);
    this.notify = makeNotifier(this);
    this.nodeObjects = [];
    this.locked = false;
    // set by hooks that hand control to another scene (end/combat/ending);
    // checked instead of scene.isActive() because create() runs pre-RUNNING
    this.terminated = false;

    const sw = this.scale.width, sh = this.scale.height;
    this.colX = sw - COL_W;
    this.textX = this.colX + COL_PAD_L;

    this.add.rectangle(0, 0, sw, sh, 0x000000, 0.25).setOrigin(0);
    this.makeColumnGradient();
    this.add.image(this.colX, 0, 'dialogue-gradient').setOrigin(0).setDisplaySize(COL_W, sh);
    // letterbox bars over everything static
    this.add.rectangle(0, 0, sw, BAR_H, 0x0a0806).setOrigin(0);
    this.add.rectangle(0, sh - BAR_H, sw, BAR_H, 0x0a0806).setOrigin(0);
    hairline(this, 0, BAR_H, sw, 0x15110d);
    hairline(this, 0, sh - BAR_H, sw, 0x15110d);

    this.hooks = {
      notify: this.notify,
      end: () => {
        this.terminated = true;
        this.close();
      },
      startCombat: (e) => {
        this.terminated = true;
        this.scene.stop(this.returnScene);
        this.scene.start('Combat', { encounterId: e.encounter, onWin: e.onWin ?? null });
      },
      endSlice: () => {
        this.terminated = true;
        this.scene.stop(this.returnScene);
        this.scene.start('End');
      },
    };

    this.enterNode(this.dialogue.start);
  }

  /** Horizontal fade from transparent to near-black, drawn once. */
  makeColumnGradient() {
    if (this.textures.exists('dialogue-gradient')) return;
    const tex = this.textures.createCanvas('dialogue-gradient', 256, 4);
    const ctx = tex.getContext();
    const grad = ctx.createLinearGradient(0, 0, 256, 0);
    grad.addColorStop(0, 'rgba(10,8,6,0)');
    grad.addColorStop(0.09, 'rgba(10,8,6,0.88)');
    grad.addColorStop(1, 'rgba(10,8,6,0.95)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 4);
    tex.refresh();
  }

  close() {
    this.scene.resume(this.returnScene);
    this.scene.stop();
  }

  /** Apply node entry effects, follow conditional redirects, then render. */
  enterNode(nodeId) {
    const node = this.dialogue.nodes[nodeId];
    if (!node) return this.close();
    for (const r of node.redirects ?? []) {
      if (evaluateConditions(r.conditions, this.reg)) return this.enterNode(r.node);
    }
    if (node.effects) applyEffects(node.effects, this.reg, this.hooks);
    if (this.terminated) return; // an effect handed control to another scene
    this.renderNode(node);
  }

  renderNode(node) {
    this.clearNode();
    this.locked = false;
    const sh = this.scale.height;
    let y = BAR_H + 80;
    const put = (obj) => { this.nodeObjects.push(obj); return obj; };

    if (node.speaker) {
      this.drawSpeakerFrame(put, node.speaker);
      put(label(this, this.textX, y, node.speaker, { size: 18, color: Ink.dim }));
      y += 50;
    }
    const body = put(this.add.text(this.textX, y, node.text,
      proseStyle({ fontSize: '27px', wordWrap: { width: TEXT_W } })));
    y += body.height + 36;

    // Passive voices: a skill speaks up if the PLAYER's skill meets the bar.
    for (const v of node.voices ?? []) {
      const value = GameState.player?.skills[v.skill] ?? 0;
      if (!passiveCheck(value, v.dc)) continue;
      const skill = this.reg.skills.get(v.skill);
      const line = put(this.add.text(this.textX, y, `${skill.name} — ${v.text}`,
        proseStyle({
          fontSize: '25px', fontStyle: 'italic',
          color: skill.voiceColor ?? Ink.brass, wordWrap: { width: TEXT_W },
        })));
      y += line.height + 22;
    }

    // Options pinned to the bottom of the column, stacked upward.
    const options = (node.options ?? []).filter((o) => evaluateConditions(o.conditions, this.reg));
    let bottom = sh - BAR_H - 56;

    const stack = options.length
      ? options.map((opt, i) => this.makeOption(put, opt, i))
      : [this.makeContinue(put, node)];
    for (let i = stack.length - 1; i >= 0; i--) {
      bottom -= stack[i].height;
      stack[i].placeAt(bottom);
      bottom -= 26;
    }
    put(hairline(this, this.textX, bottom, TEXT_W));

    this.input.keyboard.off('keydown');
    this.input.keyboard.on('keydown', (ev) => {
      const n = parseInt(ev.key, 10);
      if (!this.locked && n >= 1 && n <= options.length) this.choose(options[n - 1]);
    });
  }

  drawSpeakerFrame(put, speaker) {
    const x = 170, w = 300, h = 360;
    const y = this.scale.height - BAR_H - 80 - h - 70;
    put(this.add.rectangle(x, y, w, h, Palette.bg0, 0.96).setOrigin(0));
    const g = put(this.add.graphics());
    g.lineStyle(2, Palette.line, 1);
    g.strokeRect(x, y, w, h);
    put(tickFrame(this, x, y, w, h));
    const initial = put(this.add.text(x + w / 2, y + h / 2, speaker.trim().charAt(0).toUpperCase(),
      displayStyle({ fontSize: '170px', color: Ink.faint })).setOrigin(0.5));
    initial.setAlpha(0.9);
    const name = put(this.add.text(x, y + h + 18, speaker,
      displayStyle({ fontSize: '34px', backgroundColor: '#0c0a08cc', padding: { x: 10, y: 4 } })));
    track(name, 2);
  }

  /**
   * Build one option (number, optional check tag, prose). Returns
   * {height, placeAt(topY)} so the caller can stack options bottom-up.
   */
  makeOption(put, opt, i) {
    const parts = [];
    const num = put(this.add.text(0, 0, `${i + 1}.`, monoStyle({ fontSize: '18px', color: Ink.faint })));
    parts.push({ o: num, dx: 0, dy: 4 });

    let dy = 0;
    if (opt.check) {
      const skill = this.reg.skills.get(opt.check.skill);
      const die = this.reg.tuning.checks?.die ?? 0;
      const value = GameState.player?.skills[opt.check.skill] ?? 0;
      const likely = value + die / 2 >= opt.check.dc;
      const tag = put(this.add.text(0, 0,
        `[${skill.name.toUpperCase()} — ${difficultyLabel(this.reg.tuning, opt.check.dc).toUpperCase()} ${opt.check.dc}]`,
        monoStyle({ fontSize: '17px', color: likely ? Ink.verdigris : Ink.accentBright })));
      parts.push({ o: tag, dx: 46, dy: 2 });
      dy = tag.height + 10;
    }
    const body = put(this.add.text(0, 0, opt.text,
      proseStyle({ fontSize: '25px', color: Ink.dim, wordWrap: { width: TEXT_W - 46 } })));
    parts.push({ o: body, dx: 46, dy });
    this.wireOption([num, body], () => this.choose(opt));

    return {
      height: dy + body.height,
      placeAt: (topY) => parts.forEach((p) => p.o.setPosition(this.textX + p.dx, topY + p.dy)),
    };
  }

  /** Linear node: single continue → node.next, or end of conversation. */
  makeContinue(put, node) {
    const body = put(this.add.text(0, 0, node.next ? '(Continue.)' : '(Leave.)',
      proseStyle({ fontSize: '25px', fontStyle: 'italic', color: Ink.dim })));
    this.wireOption([body], () => {
      if (node.next) this.enterNode(node.next);
      else this.close();
    });
    return {
      height: body.height,
      placeAt: (topY) => body.setPosition(this.textX + 46, topY),
    };
  }

  wireOption(objects, onClick) {
    const body = objects[objects.length - 1];
    const num = objects.length > 1 ? objects[0] : null;
    body.setInteractive({ useHandCursor: true });
    body.on('pointerover', () => {
      body.setColor(Ink.ink);
      num?.setColor(Ink.accentBright);
    });
    body.on('pointerout', () => {
      body.setColor(Ink.dim);
      num?.setColor(Ink.faint);
    });
    body.on('pointerdown', () => { if (!this.locked) onClick(); });
  }

  choose(opt) {
    this.locked = true;
    if (opt.effects) applyEffects(opt.effects, this.reg, this.hooks);
    if (this.terminated) return;
    if (opt.check) return this.runCheck(opt.check);
    if (opt.next) return this.enterNode(opt.next);
    this.close();
  }

  /** Active check: show the roll, pause a beat, then route to success/failure. */
  runCheck(check) {
    const skill = this.reg.skills.get(check.skill);
    const value = GameState.player?.skills[check.skill] ?? 0;
    const result = activeCheck(this.reg.tuning, value, check.dc);
    this.clearNode();

    const cx = this.colX + COL_W / 2 + 40;
    const my = this.scale.height / 2;
    const title = label(this, cx, my - 130, `${skill.name} — ${difficultyLabel(this.reg.tuning, check.dc)} ${check.dc}`,
      { size: 18, color: Ink.brass, origin: [0.5, 0.5] });
    const rollText = this.add.text(cx, my - 30, '…', displayStyle({ fontSize: '64px', color: Ink.ink })).setOrigin(0.5);
    const verdict = this.add.text(cx, my + 80, '', displayStyle({ fontSize: '52px' })).setOrigin(0.5);
    track(verdict, 8);
    this.nodeObjects.push(title, rollText, verdict);

    // little dice shuffle, then the real result
    let ticks = 0;
    this.time.addEvent({
      delay: 70, repeat: 7,
      callback: () => {
        ticks++;
        if (ticks <= 7) {
          rollText.setText(`${1 + Math.floor(Math.random() * this.reg.tuning.checks.die)}`);
        } else {
          rollText.setText(`${result.roll} + ${result.skillValue}  =  ${result.total}  vs ${result.dc}`);
          verdict.setText(result.success ? 'SUCCESS' : 'FAILURE');
          verdict.setColor(result.success ? Ink.verdigris : Ink.accentBright);
          this.time.delayedCall(950, () => this.enterNode(result.success ? check.success : check.failure));
        }
      },
    });
  }

  clearNode() {
    this.nodeObjects.forEach((o) => o.destroy());
    this.nodeObjects = [];
  }
}
