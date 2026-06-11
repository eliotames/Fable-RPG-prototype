/**
 * EndScene — win / lose / end-of-slice screen. The epilogue text comes from
 * the `endSlice` dialogue effect (content-authored); defeat comes from combat.
 */
import { GameState } from '../systems/GameState.js';
import { QuestSystem } from '../systems/QuestSystem.js';
import { Colors, titleStyle, bodyStyle, uiStyle } from '../ui/Theme.js';
import { textButton } from '../ui/widgets.js';

export class EndScene extends Phaser.Scene {
  constructor() {
    super('End');
  }

  create() {
    const ending = GameState.ending ?? { outcome: 'win', epilogue: '' };
    const cx = this.scale.width / 2;
    const won = ending.outcome !== 'defeat';

    this.add.text(cx, 140, won ? 'THE TOLL RINGS CLEAR' : 'THE HUSH PREVAILS',
      titleStyle({ fontSize: '44px', color: won ? '#d8b36a' : '#c4554d' })).setOrigin(0.5);

    const epilogue = won
      ? (ending.epilogue || 'The slice ends here — thank you for playing.')
      : 'The party falls, and Greyreach Crossing goes quiet for good.\nBut every silence is only waiting for a braver sound. Try again.';
    this.add.text(cx, 240, epilogue,
      bodyStyle({ fontSize: '18px', align: 'center', wordWrap: { width: 880 } })).setOrigin(0.5, 0);

    // a small record of the run
    const p = GameState.player;
    if (p) {
      const reg = this.registry.get('content');
      const race = reg.races.get(p.raceId)?.name ?? p.raceId;
      const klass = reg.classes.get(p.classId)?.name ?? p.classId;
      const companions = GameState.party.map((m) => m.name).join(', ') || 'no one — you walked alone';
      const quests = QuestSystem.journalEntries().map((e) => `${e.done ? '✓' : '…'} ${e.quest.name}`).join('   ') || '—';
      this.add.text(cx, 420,
        `${p.name}, ${race} ${klass}\ncompanions: ${companions}\nquests: ${quests}`,
        uiStyle({ fontSize: '14px', color: Colors.textDim, align: 'center', lineSpacing: 8 })).setOrigin(0.5, 0);
    }

    this.add.text(cx, 530, won
      ? 'End of the vertical slice. Everything you just played — races, checks,\nthe gate puzzle, the Sentinel — is defined in the data/ JSON files.'
      : '', uiStyle({ fontSize: '13px', color: '#6a665c', align: 'center', lineSpacing: 6 })).setOrigin(0.5, 0);

    textButton(this, cx, 640, '[ Return to Title ]', {
      style: { fontSize: '22px', color: '#d8b36a' },
      onClick: () => this.scene.start('MainMenu'),
    }).setOrigin(0.5);
  }
}
