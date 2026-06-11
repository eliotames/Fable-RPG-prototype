/**
 * MainMenuScene — title screen. "New Game" resets run state and enters
 * character creation.
 */
import { GameState } from '../systems/GameState.js';
import { titleStyle, uiStyle, bodyStyle } from '../ui/Theme.js';
import { textButton } from '../ui/widgets.js';

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super('MainMenu');
  }

  create() {
    const cx = this.scale.width / 2;

    // a faint field of drifting motes for atmosphere
    for (let i = 0; i < 40; i++) {
      const dot = this.add.circle(
        Phaser.Math.Between(0, 1280), Phaser.Math.Between(0, 720),
        Phaser.Math.Between(1, 2), 0xd8b36a, Phaser.Math.FloatBetween(0.05, 0.25));
      this.tweens.add({
        targets: dot, y: dot.y - Phaser.Math.Between(30, 90),
        alpha: 0, duration: Phaser.Math.Between(4000, 9000), repeat: -1,
      });
    }

    this.add.text(cx, 180, 'WINDS OF SILENCE', titleStyle({ fontSize: '56px', color: '#e8e4d8' })).setOrigin(0.5);
    this.add.text(cx, 238, '— A Quiet Toll —', bodyStyle({ fontSize: '20px', color: '#9a958a', fontStyle: 'italic' })).setOrigin(0.5);
    this.add.text(cx, 300,
      'The Hush is crossing the hills: a creeping stillness that swallows song,\n'
      + 'speech, and finally breath. At Greyreach Crossing, the mill has gone quiet.',
      bodyStyle({ fontSize: '16px', align: 'center', color: '#c8c4b8' })).setOrigin(0.5);

    textButton(this, cx, 400, '[ New Game ]', {
      style: { fontSize: '26px', color: '#d8b36a' },
      onClick: () => {
        GameState.reset();
        this.scene.start('CharacterCreation');
      },
    }).setOrigin(0.5);

    const fileCount = this.registry.get('contentFileCount');
    this.add.text(cx, 640, `content: ${fileCount} files loaded & validated ✓`,
      uiStyle({ fontSize: '12px', color: '#5f6b5f' })).setOrigin(0.5);
    this.add.text(cx, 668, 'move WASD/arrows · interact E · journal J · party C · combat is mouse + SPACE for timing',
      uiStyle({ fontSize: '12px', color: '#6a665c' })).setOrigin(0.5);
  }
}
