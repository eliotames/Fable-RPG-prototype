/**
 * MainMenuScene — title screen: a thin horizon broken by a stopped clock-sun,
 * the title set wide in the display face, and a quiet vertical menu. "New
 * Game" resets run state and enters character creation.
 */
import { GameState } from '../systems/GameState.js';
import { Palette, Ink, displayStyle, monoStyle, track } from '../ui/Theme.js';
import { label } from '../ui/widgets.js';

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super('MainMenu');
  }

  create() {
    const sw = this.scale.width, sh = this.scale.height;
    const cx = sw / 2;

    this.add.rectangle(0, 0, sw, sh, Palette.bg0).setOrigin(0);

    // a faint field of drifting motes for atmosphere
    for (let i = 0; i < 40; i++) {
      const dot = this.add.circle(
        Phaser.Math.Between(0, sw), Phaser.Math.Between(0, sh),
        Phaser.Math.Between(2, 4), Palette.brass, Phaser.Math.FloatBetween(0.04, 0.18));
      this.tweens.add({
        targets: dot, y: dot.y - Phaser.Math.Between(60, 180),
        alpha: 0, duration: Phaser.Math.Between(4000, 9000), repeat: -1,
      });
    }

    this.drawHorizon(cx, 372);

    const title = this.add.text(cx, 580, 'WINDS OF SILENCE',
      displayStyle({ fontSize: '150px' })).setOrigin(0.5);
    track(title, 36);

    label(this, cx, 690, 'A QUIET TOLL  ·  THE HUSH IS CROSSING THE HILLS',
      { size: 17, color: Ink.faint, spacing: 7, origin: [0.5, 0.5] });

    // vertical menu — diamond appears on hover, like the design's tm-item
    const items = [
      { text: 'CONTINUE', sub: 'NO CHRONICLE KEPT YET', dim: true },
      { text: 'NEW GAME', onClick: () => { GameState.reset(); this.scene.start('CharacterCreation'); } },
      { text: 'OPTIONS', onClick: () => this.scene.start('Options') },
    ];
    let y = 830;
    for (const item of items) {
      this.menuItem(cx, y, item);
      y += item.sub ? 110 : 84;
    }

    // footer
    const fileCount = this.registry.get('contentFileCount');
    label(this, 75, sh - 56, `VERTICAL SLICE  ·  ${fileCount} CONTENT FILES VALIDATED ◆`,
      { size: 13, color: Ink.faint, origin: [0, 1] });
    label(this, sw - 75, sh - 56,
      'MOVE WASD/ARROWS · INTERACT E · JOURNAL J · PARTY C · COMBAT IS MOUSE + SPACE',
      { size: 13, color: Ink.faint, origin: [1, 1] });
  }

  /** Horizon hairline with a stopped clock-sun resting on it. */
  drawHorizon(cx, y) {
    const sw = this.scale.width;
    const g = this.add.graphics();
    g.lineStyle(2, Palette.line, 1);
    g.lineBetween(0, y, cx - 160, y);
    g.lineBetween(cx + 160, y, sw, y);

    const sy = y - 56, r = 20;
    g.lineStyle(2, Palette.inkDim, 1);
    g.strokeCircle(cx, sy, r);
    // hands stopped short of noon
    g.lineStyle(2, Palette.accentBright, 1);
    g.lineBetween(cx, sy, cx - r * 0.67, sy - r * 0.74);
    g.lineStyle(3, Palette.inkDim, 1);
    g.lineBetween(cx, sy, cx, sy - r * 0.56);
    g.fillStyle(Palette.inkDim, 1);
    g.fillCircle(cx, sy, 2);
    // cardinal ticks
    g.lineStyle(2, Palette.inkFaint, 1);
    g.lineBetween(cx, sy - r - 9, cx, sy - r - 3);
    g.lineBetween(cx, sy + r + 3, cx, sy + r + 9);
    g.lineBetween(cx - r - 9, sy, cx - r - 3, sy);
    g.lineBetween(cx + r + 3, sy, cx + r + 9, sy);
  }

  /** @param {{text:string, sub?:string, dim?:boolean, onClick?:Function}} item */
  menuItem(cx, y, item) {
    const t = this.add.text(cx, y, item.text,
      displayStyle({ fontSize: '33px', color: item.dim ? Ink.faint : Ink.dim })).setOrigin(0.5);
    track(t, 10);
    if (item.sub) {
      label(this, cx, y + 36, item.sub, { size: 12, color: Ink.faint, origin: [0.5, 0] });
    }
    if (item.dim || !item.onClick) return;
    const diamond = this.add.text(cx - t.width / 2 - 36, y, '◆',
      monoStyle({ fontSize: '12px', color: Ink.accentBright })).setOrigin(0.5).setVisible(false);
    t.setInteractive({ useHandCursor: true });
    t.on('pointerover', () => { t.setColor(Ink.ink); diamond.setVisible(true); });
    t.on('pointerout', () => { t.setColor(Ink.dim); diamond.setVisible(false); });
    t.on('pointerdown', item.onClick);
  }
}
