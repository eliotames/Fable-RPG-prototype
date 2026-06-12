/**
 * MainMenuScene — title screen: a thin horizon broken by a stopped clock-sun,
 * the title set wide in the display face, and a quiet vertical menu. "New
 * Game" resets run state and enters character creation.
 */
import { GameState } from '../systems/GameState.js';
import { Palette, Ink, displayStyle, monoStyle, track } from '../ui/Theme.js';
import { label } from '../ui/widgets.js';
import { addMotes, staggerIn, pointerParallax, fadeIn } from '../ui/effects.js';

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super('MainMenu');
  }

  create() {
    const sw = this.scale.width, sh = this.scale.height;
    const cx = sw / 2;

    this.add.rectangle(0, 0, sw, sh, Palette.bg0).setOrigin(0);
    fadeIn(this, 400);
    addMotes(this, { count: 42, embers: 9, depth: 1 });

    const horizon = this.drawHorizon(cx, 372);

    const title = this.add.text(cx, 580, 'WINDS OF SILENCE',
      displayStyle({ fontSize: '150px' })).setOrigin(0.5);
    track(title, 36);
    // keep the wordmark inside the frame at large font-scale settings
    if (title.width > sw - 160) title.setScale((sw - 160) / title.width);

    const tagline = label(this, cx, 692, 'A QUIET TOLL  ·  THE HUSH IS CROSSING THE HILLS',
      { size: 19, color: Ink.dim, spacing: 7, origin: [0.5, 0.5] });

    // vertical menu — diamond appears on hover, like the design's tm-item
    const items = [
      { text: 'CONTINUE', sub: 'NO CHRONICLE KEPT YET', dim: true },
      { text: 'NEW GAME', onClick: () => { GameState.reset(); this.scene.start('CharacterCreation'); } },
      { text: 'OPTIONS', onClick: () => this.scene.start('Options') },
    ];
    let y = 830;
    const menuObjs = [];
    for (const item of items) {
      menuObjs.push(...this.menuItem(cx, y, item));
      y += item.sub ? 112 : 88;
    }

    // footer
    const fileCount = this.registry.get('contentFileCount');
    label(this, 75, sh - 56, `VERTICAL SLICE  ·  ${fileCount} CONTENT FILES VALIDATED ◆`,
      { size: 15, color: Ink.faint, origin: [0, 1] });
    label(this, sw - 75, sh - 56,
      'MOVE WASD/ARROWS · INTERACT E · JOURNAL J · PARTY C · COMBAT IS MOUSE + SPACE',
      { size: 15, color: Ink.faint, origin: [1, 1] });

    // parallax captures rest positions, so wire it before the entrance motion
    pointerParallax(this, [
      { obj: horizon, factor: 0.5 },
      { obj: title, factor: 1 },
      { obj: tagline, factor: 1.3 },
    ], 9);
    staggerIn(this, [...menuObjs], { rise: 22, delayStep: 55, delay: 150 });
  }

  /** Horizon hairline with a stopped clock-sun resting on it. @returns the graphics */
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
    return g;
  }

  /**
   * @param {{text:string, sub?:string, dim?:boolean, onClick?:Function}} item
   * @returns {object[]} created objects (for entrance animation)
   */
  menuItem(cx, y, item) {
    const made = [];
    const t = this.add.text(cx, y, item.text,
      displayStyle({ fontSize: '36px', color: item.dim ? Ink.faint : Ink.dim })).setOrigin(0.5);
    track(t, 10);
    made.push(t);
    if (item.sub) {
      made.push(label(this, cx, y + 38, item.sub, { size: 14, color: Ink.faint, origin: [0.5, 0] }));
    }
    if (item.dim || !item.onClick) return made;
    const diamond = this.add.text(cx - t.width / 2 - 38, y, '◆',
      monoStyle({ fontSize: '14px', color: Ink.accentBright })).setOrigin(0.5).setVisible(false);
    t.setInteractive({ useHandCursor: true });
    t.on('pointerover', () => { t.setColor(Ink.ink); diamond.setVisible(true); });
    t.on('pointerout', () => { t.setColor(Ink.dim); diamond.setVisible(false); });
    t.on('pointerdown', item.onClick);
    return made;
  }
}
