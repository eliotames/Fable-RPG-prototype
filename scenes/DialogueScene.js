/**
 * DialogueScene — overlay that runs any dialogue JSON: branching nodes,
 * passive skill "voices" (internal commentary that surfaces when a skill is
 * high enough), condition-gated options, and active checks (roll + skill vs
 * DC, success and failure both routing somewhere). Effects are executed by
 * systems/Script.js; combat starts and slice endings are hooks back into the
 * scene manager. Nothing here knows any specific NPC, item or quest.
 *
 * Presentation: the conversation lives in a column fading in from the right
 * edge; the speaker stays framed at lower left for the whole exchange (only
 * redrawn when the speaker actually changes). When a node's text is taller
 * than the column — which depends on the player's font-scale setting, so it
 * is measured from the rendered objects, never assumed — the text becomes a
 * masked scrolling view and the options stay hidden until the player has
 * scrolled to the end.
 */
import { GameState } from '../systems/GameState.js';
import { evaluateConditions, applyEffects } from '../systems/Script.js';
import { activeCheck, passiveCheck, difficultyLabel } from '../systems/CheckResolver.js';
import { Palette, Ink, displayStyle, proseStyle, monoStyle, track } from '../ui/Theme.js';
import { tickFrame, hairline, makeNotifier, label } from '../ui/widgets.js';
import { Settings } from '../ui/Settings.js';
import { staggerIn } from '../ui/effects.js';

const TOP_M = 100;       // top/bottom margins of the column content
const BOT_M = 100;
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
    // the portrait persists across nodes; only a speaker change redraws it
    this.speakerName = null;
    this.speakerObjects = [];

    const sw = this.scale.width, sh = this.scale.height;
    this.colX = sw - COL_W;
    this.textX = this.colX + COL_PAD_L;

    this.add.rectangle(0, 0, sw, sh, 0x000000, 0.25).setOrigin(0);
    this.makeColumnGradient();
    const column = this.add.image(this.colX, 0, 'dialogue-gradient').setOrigin(0).setDisplaySize(COL_W, sh);
    if (Settings.data.animations !== false) {
      column.setAlpha(0);
      this.tweens.add({ targets: column, alpha: 1, duration: 320, ease: 'Quad.easeOut' });
    }

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
    this.optionsRevealed = false;
    const sh = this.scale.height;
    const put = (obj) => { this.nodeObjects.push(obj); return obj; };

    this.updateSpeaker(node.speaker);

    // --- text block (the part that may scroll) ------------------------------
    const scrollables = [];
    const sput = (o) => { scrollables.push(put(o)); return o; };
    const contentTop = TOP_M + 80;
    let y = contentTop;

    if (node.speaker) {
      sput(label(this, this.textX, y, node.speaker, { size: 20, color: Ink.dim }));
      y += 54;
    }
    const body = sput(this.add.text(this.textX, y, node.text,
      proseStyle({ fontSize: '30px', wordWrap: { width: TEXT_W } })));
    y += body.height + 36;

    // Passive voices: a skill speaks up if the PLAYER's skill meets the bar.
    for (const v of node.voices ?? []) {
      const value = GameState.player?.skills[v.skill] ?? 0;
      if (!passiveCheck(value, v.dc)) continue;
      const skill = this.reg.skills.get(v.skill);
      const line = sput(this.add.text(this.textX, y, `${skill.name} — ${v.text}`,
        proseStyle({
          fontSize: '28px', fontStyle: 'italic',
          color: skill.voiceColor ?? Ink.brass, wordWrap: { width: TEXT_W },
        })));
      y += line.height + 22;
    }
    const contentBottom = y - 16;

    // --- options, pinned to the bottom of the column, stacked upward --------
    const options = (node.options ?? []).filter((o) => evaluateConditions(o.conditions, this.reg));
    let bottom = sh - BOT_M - 56;
    const stack = options.length
      ? options.map((opt, i) => this.makeOption(put, opt, i))
      : [this.makeContinue(put, node)];
    this.optionGroup = [];
    for (let i = stack.length - 1; i >= 0; i--) {
      bottom -= stack[i].height;
      stack[i].placeAt(bottom);
      this.optionGroup.push(...stack[i].objects);
      bottom -= 26;
    }
    this.optionGroup.push(put(hairline(this, this.textX, bottom, TEXT_W)));

    // --- overflow gate: measured, so it follows the font-scale setting ------
    const availBottom = bottom - 28;
    if (contentBottom <= availBottom) {
      this.optionsRevealed = true;
      staggerIn(this, this.nodeObjects, { rise: 14, delayStep: 22, duration: 240 });
    } else {
      this.setupScroll(put, scrollables, contentTop, availBottom, contentBottom, bottom);
    }

    this.input.keyboard.off('keydown');
    this.input.keyboard.on('keydown', (ev) => {
      if (ev.key === 'ArrowDown' || ev.key === 'PageDown') return this.scrollBy(ev.key === 'PageDown' ? 400 : 90);
      if (ev.key === 'ArrowUp' || ev.key === 'PageUp') return this.scrollBy(ev.key === 'PageUp' ? -400 : -90);
      const n = parseInt(ev.key, 10);
      if (this.optionsRevealed && !this.locked && n >= 1 && n <= options.length) this.choose(options[n - 1]);
    });
  }

  /**
   * The node text is taller than the column: clip it, hide the options, and
   * scroll with wheel / arrow keys until the end is reached.
   */
  setupScroll(put, texts, top, availBottom, contentBottom, hairY) {
    // clip the text to its viewport
    const maskG = this.make.graphics();
    maskG.fillStyle(0xffffff, 1);
    maskG.fillRect(this.colX, top - 44, COL_W, availBottom - top + 60);
    this.scrollMaskG = maskG;
    const mask = maskG.createGeometryMask();
    this.scrollTexts = texts;
    for (const t of texts) {
      t.baseY = t.y;
      t.setMask(mask);
    }
    this.scrollPos = 0;
    this.maxScroll = contentBottom - availBottom;
    this.scrollView = { top, height: availBottom - top, contentH: contentBottom - top };

    for (const o of this.optionGroup) o.setVisible(false);

    this.scrollHint = put(label(this, this.textX + TEXT_W / 2, hairY, '▼  SCROLL',
      { size: 15, color: Ink.dim, origin: [0.5, 0.5] }));
    if (Settings.data.animations !== false) {
      this.tweens.add({ targets: this.scrollHint, alpha: 0.35, duration: 850, yoyo: true, repeat: -1 });
      for (const t of texts) {
        const a = t.alpha;
        t.setAlpha(0);
        this.tweens.add({ targets: t, alpha: a, duration: 260, ease: 'Quad.easeOut' });
      }
    }
    this.scrollBarG = put(this.add.graphics());
    this.drawScrollBar();

    this.wheelHandler = (pointer, over, dx, dy) => this.scrollBy(dy * 0.6);
    this.input.on('wheel', this.wheelHandler);
  }

  scrollBy(delta) {
    if (!this.maxScroll) return;
    this.scrollPos = Phaser.Math.Clamp(this.scrollPos + delta, 0, this.maxScroll);
    for (const t of this.scrollTexts) t.y = t.baseY - this.scrollPos;
    this.drawScrollBar();
    if (!this.optionsRevealed && this.scrollPos >= this.maxScroll - 1) this.revealOptions();
  }

  drawScrollBar() {
    const g = this.scrollBarG;
    if (!g || !g.scene) return;
    const v = this.scrollView;
    const x = this.colX + COL_W - 52;
    g.clear();
    g.lineStyle(2, Palette.line, 1);
    g.lineBetween(x, v.top, x, v.top + v.height);
    const thumbH = Math.max(40, v.height * (v.height / v.contentH));
    const thumbY = v.top + (this.scrollPos / this.maxScroll) * (v.height - thumbH);
    g.fillStyle(Palette.inkDim, 1);
    g.fillRect(x - 2, thumbY, 4, thumbH);
  }

  /** The reader reached the end: bring the choices in. */
  revealOptions() {
    this.optionsRevealed = true;
    this.scrollHint?.setVisible(false);
    for (const o of this.optionGroup) o.setVisible(true);
    staggerIn(this, this.optionGroup, { rise: 12, delayStep: 18, duration: 220 });
  }

  /** Redraw the portrait only when the speaker actually changes; narration
   *  nodes (no speaker) keep the current portrait up. */
  updateSpeaker(speaker) {
    if (!speaker || speaker === this.speakerName) return;
    this.speakerName = speaker;
    this.speakerObjects.forEach((o) => o.destroy());
    this.speakerObjects = [];
    const sp = (o) => { this.speakerObjects.push(o); return o; };

    const x = 170, w = 300, h = 360;
    const y = this.scale.height - BOT_M - 80 - h - 70;
    sp(this.add.rectangle(x, y, w, h, Palette.bg0, 0.96).setOrigin(0));
    const g = sp(this.add.graphics());
    g.lineStyle(2, Palette.line, 1);
    g.strokeRect(x, y, w, h);
    sp(tickFrame(this, x, y, w, h));
    sp(this.add.text(x + w / 2, y + h / 2, speaker.trim().charAt(0).toUpperCase(),
      displayStyle({ fontSize: '170px', color: Ink.faint })).setOrigin(0.5)).setAlpha(0.9);
    const name = sp(this.add.text(x, y + h + 18, speaker,
      displayStyle({ fontSize: '36px', backgroundColor: '#0c0a08cc', padding: { x: 12, y: 5 } })));
    track(name, 2);

    if (Settings.data.animations !== false) {
      for (const o of this.speakerObjects) {
        const a = o.alpha ?? 1;
        o.setAlpha(0);
        this.tweens.add({ targets: o, alpha: a, duration: 300, ease: 'Quad.easeOut' });
      }
    }
  }

  /**
   * Build one option (number, optional check tag, prose). Returns
   * {height, objects, placeAt(topY)} so the caller can stack options
   * bottom-up and toggle their visibility as a group.
   */
  makeOption(put, opt, i) {
    const objects = [];
    const parts = [];
    const num = put(this.add.text(0, 0, `${i + 1}.`, monoStyle({ fontSize: '20px', color: Ink.faint })));
    objects.push(num);
    parts.push({ o: num, dx: 0, dy: 4 });

    let dy = 0;
    if (opt.check) {
      const skill = this.reg.skills.get(opt.check.skill);
      const die = this.reg.tuning.checks?.die ?? 0;
      const value = GameState.player?.skills[opt.check.skill] ?? 0;
      const likely = value + die / 2 >= opt.check.dc;
      const tag = put(this.add.text(0, 0,
        `[${skill.name.toUpperCase()} — ${difficultyLabel(this.reg.tuning, opt.check.dc).toUpperCase()} ${opt.check.dc}]`,
        monoStyle({ fontSize: '19px', color: likely ? Ink.verdigris : Ink.accentBright })));
      objects.push(tag);
      parts.push({ o: tag, dx: 46, dy: 2 });
      dy = tag.height + 10;
    }
    const body = put(this.add.text(0, 0, opt.text,
      proseStyle({ fontSize: '28px', color: Ink.dim, wordWrap: { width: TEXT_W - 46 } })));
    objects.push(body);
    parts.push({ o: body, dx: 46, dy });
    this.wireOption([num, body], () => this.choose(opt));

    return {
      height: dy + body.height,
      objects,
      placeAt: (topY) => parts.forEach((p) => p.o.setPosition(this.textX + p.dx, topY + p.dy)),
    };
  }

  /** Linear node: single continue → node.next, or end of conversation. */
  makeContinue(put, node) {
    const body = put(this.add.text(0, 0, node.next ? '(Continue.)' : '(Leave.)',
      proseStyle({ fontSize: '28px', fontStyle: 'italic', color: Ink.dim })));
    this.wireOption([body], () => {
      if (node.next) this.enterNode(node.next);
      else this.close();
    });
    return {
      height: body.height,
      objects: [body],
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
    body.on('pointerdown', () => { if (this.optionsRevealed && !this.locked) onClick(); });
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
      { size: 20, color: Ink.brass, origin: [0.5, 0.5] });
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
    if (this.wheelHandler) {
      this.input.off('wheel', this.wheelHandler);
      this.wheelHandler = null;
    }
    this.scrollMaskG?.destroy();
    this.scrollMaskG = null;
    this.scrollTexts = null;
    this.scrollBarG = null;   // destroyed with nodeObjects
    this.scrollHint = null;
    this.maxScroll = 0;
    this.nodeObjects.forEach((o) => o.destroy());
    this.nodeObjects = [];
  }
}
