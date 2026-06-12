/**
 * EndScene — win / lose / end-of-slice screen. The epilogue text comes from
 * the `endSlice` dialogue effect (content-authored); defeat comes from combat.
 */
import { GameState } from '../systems/GameState.js';
import { QuestSystem } from '../systems/QuestSystem.js';
import { Palette, Ink, displayStyle, proseStyle, track } from '../ui/Theme.js';
import { label, rule, frameButton } from '../ui/widgets.js';
import { addMotes, staggerIn, fadeIn } from '../ui/effects.js';

export class EndScene extends Phaser.Scene {
  constructor() {
    super('End');
  }

  create() {
    const ending = GameState.ending ?? { outcome: 'win', epilogue: '' };
    const sw = this.scale.width, sh = this.scale.height;
    const cx = sw / 2;
    const won = ending.outcome !== 'defeat';

    this.add.rectangle(0, 0, sw, sh, Palette.bg0).setOrigin(0);
    fadeIn(this, 450);
    addMotes(this, { count: 30, embers: won ? 8 : 0, depth: 1 });
    const entrance = [];
    const enter = (o) => { entrance.push(o); return o; };

    enter(rule(this, cx, 250, 360, won ? '◆' : '◇'));
    const title = enter(this.add.text(cx, 360, won ? 'THE TOLL RINGS CLEAR' : 'THE HUSH PREVAILS',
      displayStyle({ fontSize: '92px', color: won ? Ink.ink : Ink.accentBright })).setOrigin(0.5));
    track(title, 18);

    const epilogue = won
      ? (ending.epilogue || 'The slice ends here — thank you for playing.')
      : 'The party falls, and Greyreach Crossing goes quiet for good.\nBut every silence is only waiting for a braver sound. Try again.';
    enter(this.add.text(cx, 500, epilogue,
      proseStyle({ fontSize: '34px', color: Ink.dim, align: 'center', wordWrap: { width: 1700 } })).setOrigin(0.5, 0));

    // a small record of the run
    const p = GameState.player;
    if (p) {
      const reg = this.registry.get('content');
      const race = reg.races.get(p.raceId)?.name ?? p.raceId;
      const klass = reg.classes.get(p.classId)?.name ?? p.classId;
      const companions = GameState.party.map((m) => m.name).join(', ') || 'no one — you walked alone';
      const quests = QuestSystem.journalEntries().map((e) => `${e.done ? '◇' : '◆'} ${e.quest.name}`).join('    ') || '—';
      enter(label(this, cx, 830, 'THE RECORD', { size: 15, color: Ink.faint, origin: [0.5, 0.5] }));
      enter(label(this, cx, 880, `${p.name} — ${race} ${klass}`, { size: 18, color: Ink.ink, origin: [0.5, 0.5] }));
      enter(label(this, cx, 926, `COMPANIONS · ${companions}`, { size: 16, color: Ink.dim, origin: [0.5, 0.5] }));
      enter(label(this, cx, 968, `WORKS · ${quests}`, { size: 16, color: Ink.dim, origin: [0.5, 0.5] }));
    }

    if (won) {
      enter(this.add.text(cx, 1070,
        'End of the vertical slice. Everything you just played — races, checks,\nthe gate puzzle, the Sentinel — is defined in the data/ JSON files.',
        proseStyle({ fontSize: '27px', fontStyle: 'italic', color: Ink.dim, align: 'center' })).setOrigin(0.5, 0));
    }

    frameButton(this, cx, 1280, 'Return to Title', {
      primary: true,
      onClick: () => this.scene.start('MainMenu'),
    });
    staggerIn(this, entrance, { rise: 24, delayStep: 80, duration: 450 });
  }
}
