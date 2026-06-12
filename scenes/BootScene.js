/**
 * BootScene — generates all placeholder textures programmatically (zero binary
 * assets) and fetches the content manifest. PreloadScene then loads everything
 * the manifest lists.
 *
 * Generated textures:
 *  - 'tiles': a 1-row top-down (oblique) tile sheet (128×128 per tile) used by
 *    the tilemap. Raised tiles draw a darker front face along the bottom edge
 *    so height reads in the oblique projection.
 *    Tile gids (in map JSON): 1 grass, 2 path, 3 water, 4 stone, 5 rock wall,
 *    6 hush (deadened ground), 7 field, 8 bridge.
 *  - 'token': a white circle, tinted per character/NPC at runtime.
 *
 * Also waits (briefly) for the UI webfonts from index.html — Phaser text
 * rasterizes at creation time, so fonts must be resolved before any scene
 * draws text. A timeout keeps an offline run from stalling on the fallbacks.
 */
import { Settings } from '../ui/Settings.js';

const FONT_PROBES = [
  '400 24px "Source Code Pro"', '600 24px "Source Code Pro"',
  '500 64px Cormorant', '600 64px Cormorant',
  '400 32px "Crimson Pro"', 'italic 400 32px "Crimson Pro"',
  '400 24px "IBM Plex Mono"', '500 24px "IBM Plex Mono"',
  '400 24px Roboto', '500 24px Roboto', '400 24px "Roboto Mono"',
];

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    this.load.json('manifest', 'data/manifest.json');
  }

  create() {
    this.makeTileSheet();
    this.makeToken();
    this.makeMote();
    Settings.load();
    Settings.apply();
    const fonts = (typeof document !== 'undefined' && document.fonts?.load)
      ? Promise.allSettled(FONT_PROBES.map((f) => document.fonts.load(f)))
      : Promise.resolve();
    Promise.race([fonts, new Promise((r) => setTimeout(r, 2000))])
      .then(() => this.scene.start('Preload'));
  }

  makeTileSheet() {
    const W = 128, H = 128;
    // fill + edge per tile; "inner" draws a smaller centered square (water/detail);
    // "face" draws a darker front face along the bottom (raised tiles, oblique view).
    const defs = [
      { fill: 0x4a6741, edge: 0x3a5234 },                       // 1 grass
      { fill: 0x8a7a5c, edge: 0x6e6149 },                       // 2 path
      { fill: 0x2e4a66, edge: 0x223a52, inner: 0x3a5e80 },      // 3 water
      { fill: 0x6e7078, edge: 0x55575e },                       // 4 stone floor
      { fill: 0x5d5f66, edge: 0x2c2e33, face: 0x3a3c42 },       // 5 rock wall
      { fill: 0x16131e, edge: 0x0c0a10, inner: 0x221d2e },      // 6 hush ground
      { fill: 0x5d7a3f, edge: 0x4a6233 },                       // 7 field
      { fill: 0x7a5c3d, edge: 0x614a31, inner: 0x8a6c4a },      // 8 bridge planks
    ];
    const g = this.add.graphics();
    defs.forEach((d, i) => {
      const x = i * W;
      g.fillStyle(d.fill, 1);
      g.fillRect(x + 1, 1, W - 2, H - 2);
      if (d.face !== undefined) {
        const faceH = Math.round(H * 0.35);
        g.fillStyle(d.face, 1);
        g.fillRect(x + 1, H - 1 - faceH, W - 2, faceH);
      }
      if (d.inner !== undefined) {
        const iw = W * 0.55, ih = H * 0.55;
        g.fillStyle(d.inner, 1);
        g.fillRect(x + (W - iw) / 2, (H - ih) / 2, iw, ih);
      }
      g.lineStyle(2, d.edge, 1);
      g.strokeRect(x + 1, 1, W - 2, H - 2);
    });
    g.generateTexture('tiles', W * defs.length, H);
    g.destroy();
  }

  /** Soft radial dot for ambient particles (ui/effects.js), tinted at use. */
  makeMote() {
    const S = 32;
    const tex = this.textures.createCanvas('mote', S, S);
    const ctx = tex.getContext();
    const grad = ctx.createRadialGradient(S / 2, S / 2, 1, S / 2, S / 2, S / 2);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.35)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, S, S);
    tex.refresh();
  }

  makeToken() {
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 1);
    g.fillCircle(28, 28, 24);
    g.lineStyle(4, 0x000000, 0.5);
    g.strokeCircle(28, 28, 24);
    g.generateTexture('token', 56, 56);
    g.destroy();
  }
}
