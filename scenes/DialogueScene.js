/**
 * DialogueScene — overlay that runs any dialogue JSON: branching nodes,
 * passive skill "voices" (internal commentary that surfaces when a skill is
 * high enough), condition-gated options, and active checks (roll + skill vs
 * DC, success and failure both routing somewhere). Effects are executed by
 * systems/Script.js; combat starts and slice endings are hooks back into the
 * scene manager. Nothing here knows any specific NPC, item or quest.
 */
import { GameState } from '../systems/GameState.js';
import { evaluateConditions, applyEffects } from '../systems/Script.js';
import { activeCheck, passiveCheck, difficultyLabel } from '../systems/CheckResolver.js';
import { Colors, uiStyle, bodyStyle } from '../ui/Theme.js';
import { panel, makeNotifier } from '../ui/widgets.js';

const PANEL_H = 320;

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
    this.panelTop = sh - PANEL_H;
    this.add.rectangle(0, 0, sw, sh, 0x000000, 0.35).setOrigin(0);
    panel(this, 0, this.panelTop, sw, PANEL_H, 0.97);

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
    const sw = this.scale.width;
    let y = this.panelTop + 18;
    const put = (obj) => { this.nodeObjects.push(obj); return obj; };

    if (node.speaker) {
      put(this.add.text(36, y, node.speaker.toUpperCase(), uiStyle({ fontSize: '14px', color: Colors.speaker, fontStyle: 'bold' })));
      y += 24;
    }
    const body = put(this.add.text(36, y, node.text, bodyStyle({ fontSize: '17px', wordWrap: { width: sw - 460 } })));
    y += body.height + 12;

    // Passive voices: a skill speaks up if the PLAYER's skill meets the bar.
    for (const v of node.voices ?? []) {
      const value = GameState.player?.skills[v.skill] ?? 0;
      if (!passiveCheck(value, v.dc)) continue;
      const skill = this.reg.skills.get(v.skill);
      const line = put(this.add.text(54, y, `${skill.name} — ${v.text}`,
        bodyStyle({ fontSize: '15px', fontStyle: 'italic', color: skill.voiceColor ?? Colors.voice, wordWrap: { width: sw - 480 } })));
      y += line.height + 8;
    }

    // Options (right column), filtered by conditions.
    const options = (node.options ?? []).filter((o) => evaluateConditions(o.conditions, this.reg));
    const ox = sw - 396;
    let oy = this.panelTop + 18;
    put(this.add.text(ox, oy, options.length ? 'YOU MIGHT…' : '', uiStyle({ fontSize: '11px', color: Colors.textDim })));
    oy += 20;

    if (!options.length) {
      // Linear node: single continue → node.next, or end of conversation.
      const label = node.next ? '▸ (Continue)' : '▸ (Leave)';
      this.makeOption(put, ox, oy, label, Colors.text, () => {
        if (node.next) this.enterNode(node.next);
        else this.close();
      });
      return;
    }

    options.forEach((opt, i) => {
      let label = `${i + 1}. ${opt.text}`;
      let color = Colors.text;
      if (opt.check) {
        const skill = this.reg.skills.get(opt.check.skill);
        label = `${i + 1}. [${skill.name} — ${difficultyLabel(this.reg.tuning, opt.check.dc)}] ${opt.text}`;
        color = Colors.check;
      }
      const h = this.makeOption(put, ox, oy, label, color, () => this.choose(opt));
      oy += h + 10;
    });

    this.input.keyboard.off('keydown');
    this.input.keyboard.on('keydown', (ev) => {
      const n = parseInt(ev.key, 10);
      if (!this.locked && n >= 1 && n <= options.length) this.choose(options[n - 1]);
    });
  }

  makeOption(put, x, y, label, color, onClick) {
    const txt = put(this.add.text(x, y, label,
      bodyStyle({ fontSize: '15px', color, wordWrap: { width: 360 } })))
      .setInteractive({ useHandCursor: true });
    txt.on('pointerover', () => txt.setColor('#ffe9b0'));
    txt.on('pointerout', () => txt.setColor(color));
    txt.on('pointerdown', () => { if (!this.locked) onClick(); });
    return txt.height;
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

    const sw = this.scale.width;
    const cx = sw / 2;
    const my = this.panelTop + PANEL_H / 2;
    const title = this.add.text(cx, my - 56, `${skill.name} check`, uiStyle({ fontSize: '15px', color: Colors.check })).setOrigin(0.5);
    const rollText = this.add.text(cx, my - 16, '…', bodyStyle({ fontSize: '26px', color: '#ffe9b0' })).setOrigin(0.5);
    const verdict = this.add.text(cx, my + 32, '', bodyStyle({ fontSize: '22px', fontStyle: 'bold' })).setOrigin(0.5);
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
          rollText.setText(`rolled ${result.roll}  +  ${skill.name} ${result.skillValue}  =  ${result.total}   vs   DC ${result.dc}`);
          verdict.setText(result.success ? 'SUCCESS' : 'FAILURE');
          verdict.setColor(result.success ? '#6dbb6d' : '#c4554d');
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
